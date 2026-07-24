from __future__ import annotations

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
    def execute(self, config: PipelineConfig) -> None:
        pass