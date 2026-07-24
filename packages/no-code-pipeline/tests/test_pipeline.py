from __future__ import annotations

from no_code_pipeline import PipelineConfig, NodeConfig, NodeType


def test_pipeline_config() -> None:
    config = PipelineConfig(
        nodes=[
            NodeConfig(node_id="n1", node_type=NodeType.FACE_SWAP, params={"source": "face.jpg"}),
            NodeConfig(node_id="n2", node_type=NodeType.OUTPUT),
        ],
        edges=[("n1", "n2")],
    )
    assert len(config.nodes) == 2
    assert config.edges[0] == ("n1", "n2")


def test_node_type_enum() -> None:
    assert NodeType.FACE_SWAP.value == "face_swap"
    assert NodeType.VOICE_CONVERT.value == "voice_convert"