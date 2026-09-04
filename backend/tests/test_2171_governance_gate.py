"""Phase 217.1-13 (T-217.1-04) — the governance_health server-side gate.

The router-level ``require_visible("governance_health")`` dependency at
``document_governance.py:61-65`` is already correct (Plan 148) and needs no code
change. This test proves it by test rather than by inspection.

Two tests:
1. With ``governance_health`` audience not ``"everyone"`` and the caller NOT an
   operator, ``require_visible("governance_health")`` raises HTTP 403.
2. With the caller IS an operator, the same dependency is a no-op (non-vacuity).
"""
import pytest
from unittest.mock import patch

from app.dependencies import require_visible
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_non_operator_gets_403_when_governance_not_everyone():
    """A non-operator caller is refused when governance_health isn't everyone."""
    dep = require_visible("governance_health")
    with (
        patch("app.dependencies.is_operator", return_value=False),
        patch("app.models.user_settings.feature_audience", return_value="operators"),
    ):
        with pytest.raises(HTTPException) as exc:
            await dep({"id": "non-op-user"})
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_operator_bypasses_governance_gate():
    """An operator caller passes through the gate regardless of audience."""
    dep = require_visible("governance_health")
    with patch("app.dependencies.is_operator", return_value=True):
        result = await dep({"id": "op-user"})
        assert result is None