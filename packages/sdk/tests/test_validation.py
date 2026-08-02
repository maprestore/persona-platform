from __future__ import annotations

import pytest
from fastapi import HTTPException

from sdk.server import _parse_color, _safe_storage_path


def test_safe_storage_path_rejects_traversal(tmp_path) -> None:
    with pytest.raises(HTTPException):
        _safe_storage_path(tmp_path, "../secret.txt")


def test_parse_color_requires_three_integers() -> None:
    assert _parse_color("1,2,3") == (1, 2, 3)
    assert _parse_color("1,2") is None
