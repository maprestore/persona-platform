from __future__ import annotations

import numpy as np
from pydantic import BaseModel
from enum import Enum


class NodeType(str, Enum):
    FACE_SWAP = "face_swap"
    VOICE_CONVERT = "voice_convert"
    BACKGROUND_REMOVE = "background_remove"
    SCENE_RELIGHT = "scene_relight"
    ANIMATE = "animate"
    OUTPUT = "output"


class NodeConfig(BaseModel):
    node_id: str
    node_type: NodeType
    params: dict = {}


class PipelineConfig(BaseModel):
    nodes: list[NodeConfig]
    edges: list[tuple[str, str]]


class PipelineEngine:
    def __init__(self) -> None:
        self._swap_engine = None

    def _get_swap_engine(self):
        if self._swap_engine is None:
            from persona_swap_core import PersonaSwapCore
            self._swap_engine = PersonaSwapCore()
            self._swap_engine.load(device="cpu")
        return self._swap_engine

    def execute(self, config: PipelineConfig) -> dict[str, object]:
        node_map = {n.node_id: n for n in config.nodes}
        adjacency: dict[str, list[str]] = {n.node_id: [] for n in config.nodes}
        for src, dst in config.edges:
            if src in adjacency:
                adjacency[src].append(dst)

        results: dict[str, object] = {}
        visited: set[str] = set()

        def _process(node_id: str, data: object = None) -> object:
            if node_id in visited:
                return results.get(node_id, data)
            visited.add(node_id)

            node = node_map[node_id]
            output = self._execute_node(node, data)
            results[node_id] = output

            for child_id in adjacency.get(node_id, []):
                output = _process(child_id, output)

            return output

        for node_id in node_map:
            if node_id not in visited:
                _process(node_id)

        return results

    def _execute_node(self, node: NodeConfig, data: object | None) -> object:
        if node.node_type == NodeType.FACE_SWAP:
            return self._run_face_swap(node, data)
        elif node.node_type == NodeType.VOICE_CONVERT:
            return self._run_voice_convert(node, data)
        elif node.node_type == NodeType.BACKGROUND_REMOVE:
            return self._run_background_remove(node, data)
        elif node.node_type == NodeType.SCENE_RELIGHT:
            return self._run_scene_relight(node, data)
        elif node.node_type == NodeType.ANIMATE:
            return self._run_animate(node, data)
        elif node.node_type == NodeType.OUTPUT:
            return self._run_output(node, data)
        return data

    def _run_face_swap(self, node: NodeConfig, data: object) -> object:
        if not isinstance(data, dict):
            return data
        engine = self._get_swap_engine()
        from shared.types import VideoFrame
        source = data.get("source")
        target = data.get("target")
        if source is None or target is None:
            return data
        source_frame = VideoFrame(image=np.array(source))
        target_frame = VideoFrame(image=np.array(target))
        result = engine.swap(source_frame, target_frame)
        return {**data, "output": result.image.tolist()}

    def _run_voice_convert(self, node: NodeConfig, data: object) -> object:
        if not isinstance(data, dict):
            return data
        engine = self._get_swap_engine()
        from shared.types import AudioFrame
        audio_data = data.get("audio")
        if audio_data is None:
            return data
        audio = AudioFrame(
            samples=np.array(audio_data, dtype=np.float32),
            sample_rate=node.params.get("sample_rate", 16000),
        )
        result = engine.convert_voice(audio)
        return {**data, "output": result.samples.tolist()}

    def _run_background_remove(self, node: NodeConfig, data: object) -> object:
        if not isinstance(data, dict):
            return data
        image = data.get("output") or data.get("target")
        if image is None:
            return data
        img = np.array(image)
        try:
            import cv2
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY) if len(img.shape) == 3 else img
            _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            return {**data, "mask": mask.tolist(), "output": img.tolist()}
        except ImportError:
            return {**data, "mask": np.ones_like(img).tolist(), "output": img.tolist()}

    def _run_scene_relight(self, node: NodeConfig, data: object) -> object:
        if not isinstance(data, dict):
            return data
        image = data.get("output") or data.get("target")
        if image is None:
            return data
        img = np.array(image, dtype=np.float32)
        brightness = node.params.get("brightness", 1.0)
        relit = np.clip(img * brightness, 0, 255).astype(np.uint8)
        return {**data, "output": relit.tolist()}

    def _run_animate(self, node: NodeConfig, data: object) -> object:
        if not isinstance(data, dict):
            return data
        image = data.get("output") or data.get("target")
        if image is None:
            return data
        return {**data, "animated": True, "output": image}

    def _run_output(self, node: NodeConfig, data: object) -> object:
        return {"final_output": data, "node_id": node.node_id, "params": node.params}
