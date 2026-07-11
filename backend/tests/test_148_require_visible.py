"""Phase 148 Wave 0 (VIS-01) — RED scaffold for the ``require_visible`` gate.

These tests encode the D-03 contract for the ``require_visible(feature)`` dependency
factory that 148-02 (wave 2) will build in ``app.dependencies``:

  - a non-operator hitting an Operators-only governed feature -> HTTP **403** with the
    exact plain body "This feature is available to administrators only." (NOT 404 — the
    /admin surface keeps its byte-identical 404; governed product features are ones an
    end user may legitimately have seen before a flip);
  - an operator -> literal no-op pass-through (returns None);
  - a feature whose audience resolves "everyone" -> no-op for a non-operator (byte-
    identical carve-out).

RED-by-design: the target is imported INSIDE each test body, so ``pytest --collect-only``
succeeds today (148-02 has not built ``require_visible`` yet) but the tests FAIL at run
time. They turn GREEN in wave 2. Owner: 148-02.
"""
import pytest
from unittest.mock import AsyncMock


async def test_non_operator_403(monkeypatch):
    """A non-operator on an Operators-only feature -> 403 + the exact plain body (D-03).

    Guards against a 404 regression: /admin is non-discoverable (404), but a governed
    product feature is a deliberate 403 the end user can understand.
    """
    from fastapi import HTTPException
    from app import dependencies as deps  # module exists; require_visible attr — RED until 148-02

    dep = deps.require_visible("skill_studio")

    # is_operator is the ONE swappable boundary (SEED-115) — patch the dependencies-module
    # global; feature_audience is lazy-imported inside the closure, patch its source.
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "operators")

    with pytest.raises(HTTPException) as ei:
        await dep(current_user={"id": "u1"})
    assert ei.value.status_code == 403, "operators-only + non-operator MUST be 403, never 404"
    assert ei.value.detail == "This feature is available to administrators only."


async def test_operator_noop(monkeypatch):
    """An operator passes through any governed feature (dependency returns None)."""
    from app import dependencies as deps  # RED until 148-02

    dep = deps.require_visible("skill_studio")
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=True))

    result = await dep(current_user={"id": "op-1"})
    assert result is None


async def test_everyone_noop(monkeypatch):
    """A feature whose audience is 'everyone' -> no-op for a non-operator (carve-out)."""
    from app import dependencies as deps  # RED until 148-02

    dep = deps.require_visible("workflow_authoring")
    monkeypatch.setattr(deps, "is_operator", AsyncMock(return_value=False))
    monkeypatch.setattr("app.models.user_settings.feature_audience", lambda feature: "everyone")

    result = await dep(current_user={"id": "u1"})
    assert result is None
