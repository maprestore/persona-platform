from __future__ import annotations

from enum import Enum
from typing import Any

import numpy as np
from pydantic import BaseModel, Field

from shared.errors import PipelineValidationError


class NodeType(str, Enum):
    INPUT = "input"
    FACE_SWAP = "face_swap"
    VOICE_CONVERT = "voice_convert"
    BACKGROUND_REMOVE = "background_remove"
    SCENE_RELIGHT = "scene_relight"
    ANIMATE = "animate"
    OUTPUT = "output"


class NodeConfig(BaseModel):
    node_id: str
    node_type: NodeType
    params: dict[str, Any] = Field(default_factory=dict)


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

    def _topological_order(self, config: PipelineConfig) -> tuple[list[str], dict[str, list[str]]]:
        node_map = {node.node_id: node for node in config.nodes}
        if len(node_map) != len(config.nodes):
            raise PipelineValidationError("duplicate node ids")
        incoming: dict[str, list[str]] = {node.node_id: [] for node in config.nodes}
        outgoing: dict[str, list[str]] = {node.node_id: [] for node in config.nodes}
        for src, dst in config.edges:
            if src not in node_map or dst not in node_map:
                raise PipelineValidationError(f"edge references an unknown node: {src}->{dst}")
            if dst == src or dst in outgoing[src]:
                raise PipelineValidationError(f"invalid duplicate or self edge: {src}->{dst}")
            outgoing[src].append(dst)
            incoming[dst].append(src)
        indegree = {node_id: len(parents) for node_id, parents in incoming.items()}
        queue = [node_id for node_id, degree in indegree.items() if degree == 0]
        order: list[str] = []
        while queue:
            node_id = queue.pop(0)
            order.append(node_id)
            for child in outgoing[node_id]:
                indegree[child] -= 1
                if indegree[child] == 0:
                    queue.append(child)
        if len(order) != len(node_map):
            raise PipelineValidationError("pipeline contains a cycle")
        return order, incoming

    def execute(self, config: PipelineConfig) -> dict[str, object]:
        order, incoming = self._topological_order(config)
        results: dict[str, object] = {}
        for node_id in order:
            node = next(node for node in config.nodes if node.node_id == node_id)
            parents = incoming[node_id]
            if len(parents) == 0:
                data: object | None = None
            elif len(parents) == 1:
                data = results[parents[0]]
            else:
                data = [results[parent] for parent in parents]
            results[node_id] = self._execute_node(node, data)
        return results

    def _execute_node(self, node: NodeConfig, data: object | None) -> object:
        handlers = {
            NodeType.INPUT: self._run_input,
            NodeType.FACE_SWAP: self._run_face_swap,
            NodeType.VOICE_CONVERT: self._run_voice_convert,
            NodeType.BACKGROUND_REMOVE: self._run_background_remove,
            NodeType.SCENE_RELIGHT: self._run_scene_relight,
            NodeType.ANIMATE: self._run_animate,
            NodeType.OUTPUT: self._run_output,
        }
        return handlers[node.node_type](node, data)

    def _run_input(self, node: NodeConfig, data: object | None) -> object:
        if "data" in node.params:
            return node.params["data"]
        if "source" in node.params:
            return {"source": node.params["source"]}
        raise PipelineValidationError(f"input node {node.node_id} has no data or source")

    @staticmethod
    def _require_mapping(node: NodeConfig, data: object | None) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise PipelineValidationError(f"node {node.node_id} requires an object input")
        return data

    def _run_face_swap(self, node: NodeConfig, data: object | None) -> object:
        payload = self._require_mapping(node, data)
        source = payload.get("source") or node.params.get("source")
        target = payload.get("target") or node.params.get("target")
        if source is None or target is None:
            raise PipelineValidationError(f"node {node.node_id} requires source and target")
        engine = self._get_swap_engine()
        from shared.types import VideoFrame
        result = engine.swap(VideoFrame(image=np.array(source, dtype=np.uint8)), VideoFrame(image=np.array(target, dtype=np.uint8)))
        return {**payload, "output": result.image.tolist()}

    def _run_voice_convert(self, node: NodeConfig, data: object | None) -> object:
        payload = self._require_mapping(node, data)
        audio_data = payload.get("audio") or payload.get("output")
        if audio_data is None:
            raise PipelineValidationError(f"node {node.node_id} requires audio input")
        engine = self._get_swap_engine()
        from shared.types import AudioFrame
        result = engine.convert_voice(AudioFrame(samples=np.array(audio_data, dtype=np.float32), sample_rate=int(node.params.get("sample_rate", 16000))))
        return {**payload, "output": result.samples.tolist()}

    def _run_background_remove(self, node: NodeConfig, data: object | None) -> object:
        payload = self._require_mapping(node, data)
        image = payload.get("output") or payload.get("target")
        if image is None:
            raise PipelineValidationError(f"node {node.node_id} requires image input")
        img = np.array(image, dtype=np.uint8)
        engine = self._get_swap_engine()
        mask, foreground = engine.remove_background(img, str(node.params.get("method", "auto")))
        return {**payload, "mask": mask.tolist(), "output": foreground.tolist()}

    def _run_scene_relight(self, node: NodeConfig, data: object | None) -> object:
        payload = self._require_mapping(node, data)
        image = payload.get("output") or payload.get("target")
        if image is None:
            raise PipelineValidationError(f"node {node.node_id} requires image input")
        brightness = float(node.params.get("brightness", 1.0))
        if brightness < 0:
            raise PipelineValidationError("brightness must be non-negative")
        relit = np.clip(np.array(image, dtype=np.float32) * brightness, 0, 255).astype(np.uint8)
        return {**payload, "output": relit.tolist()}

    def _run_animate(self, node: NodeConfig, data: object | None) -> object:
        payload = self._require_mapping(node, data)
        image = payload.get("output") or payload.get("target")
        if image is None:
            raise PipelineValidationError(f"node {node.node_id} requires image input")
        return {**payload, "animated": True, "output": image}

    def _run_output(self, node: NodeConfig, data: object | None) -> object:
        if data is None:
            raise PipelineValidationError(f"output node {node.node_id} has no input")
        return {"final_output": data, "node_id": node.node_id, "params": node.params}
