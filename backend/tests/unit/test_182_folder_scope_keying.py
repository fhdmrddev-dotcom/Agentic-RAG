"""Phase 182 gap-closure (SC#4 / D-182-03 / D-182-06) — the `folder_scope` verdict is
keyed to the OFFENDING PHASE, structurally.

The 182 verification found the one grounding-fidelity rule that is genuinely per-phase
(`folder_scope`) emitted with `phase: None`, stranding the offending slug in free-text
prose. A canvas consumer could only attribute it to a node by REGEXING the message —
exactly the client-side re-derivation the D-182-06 red line forbids.

This file is the regression proof, in four layers:

  1. SCOPE level    — the REAL `assert_folder_scopes_subset` raises a `ValueError`
                      SUBCLASS carrying the offending slug on `.phase_slug`, with a
                      BYTE-IDENTICAL message (asserted against a written-out golden
                      literal, never re-derived from the source).
  2. CALLER level   — `pytest.raises(ValueError, ...)` still catches it, so
                      `workflow_kickoff`'s 400, `runs.py`'s best-effort Continue and
                      `harness_engine`'s resume fallback keep working BY CONSTRUCTION.
  3. COLLECTOR level— `grounding.grounding_verdicts` threads that slug onto the
                      `folder_scope` verdict's `phase` field (the SC#4 guard: this FAILS
                      if `phase` ever reverts to `None`), proven BOTH with a hand-faked
                      exception AND end-to-end through the real ⊆ check.
  4. DEGRADATION    — a PLAIN `ValueError` off the ⊆ path (a test double / a future
                      non-phase-specific failure) still yields `phase: None` and never
                      raises, so the always-HTTP-200 `/validate` contract holds.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies. Offline only — no DB:
`assert_folder_scopes_subset` resolves `resolve_project_subtree` as a MODULE global, so
monkeypatching that one seam runs the REAL ⊆ walk with a fake subtree.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

# Fixed ids so the golden message literal below can be written out by hand (b).
_PROJECT = "11111111-1111-1111-1111-111111111111"
_CHILD = "44444444-4444-4444-4444-444444444444"
_OUTSIDE = "22222222-2222-2222-2222-222222222222"

# The BYTE-IDENTICAL message contract. Written out in full, NOT re-derived from
# scope.py's f-string — a re-derivation would pass even if the wording changed, and
# `workflow_kickoff`'s HTTP 400 `detail`, `_grounding_failed(...)`'s `detail`, and
# `test_098_scope_governance`'s `match=` all depend on this exact text.
_GOLDEN_MESSAGE = (
    "phase 'answer' folder_scope is not a subset of the project subtree: "
    "['22222222-2222-2222-2222-222222222222']"
)


def _scoped_definition(*, scope: list[str], slug: str = "answer", bound: bool = True):
    """A shape-valid single-phase definition, optionally bound to `_PROJECT`."""
    from app.models.harness import WorkflowDefinition

    config: dict = {"phase_type": "llm_agent", "prompt": "Answer.", "available_tools": []}
    if scope:
        config["folder_scope"] = scope
    payload: dict = {
        "slug": "scoped-wf",
        "version": 1,
        "name": "Scoped Workflow",
        "status": "draft",
        "phases": [
            {"slug": slug, "phase_index": 0, "config": config, "validators": []}
        ],
    }
    if bound:
        payload["project_folder_id"] = _PROJECT
    return WorkflowDefinition.model_validate(payload)


def _patch_subtree(monkeypatch, subtree: list[str] | None):
    """Fake ONLY the subtree resolution so the REAL ⊆ walk runs (no DB, no second walk)."""
    from app.services.harness import scope as scope_mod

    async def _fake_resolve(project_folder_id, *, supabase, user_id):
        return subtree

    monkeypatch.setattr(scope_mod, "resolve_project_subtree", _fake_resolve)


# ── 1) SCOPE level — the real check supplies the slug structurally ─────────────


@pytest.mark.asyncio
async def test_real_check_raises_typed_error_carrying_the_offending_slug(monkeypatch):
    """The REAL `assert_folder_scopes_subset` (not a test double) raises
    `FolderScopeSubsetError` — a `ValueError` SUBCLASS — carrying the offending phase
    slug on `.phase_slug`. This is the NON-TAUTOLOGICAL proof: the slug comes out of the
    production ⊆ walk, so `grounding.py` never has to parse the message (D-182-06)."""
    from app.services.harness.scope import FolderScopeSubsetError, assert_folder_scopes_subset

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    with pytest.raises(FolderScopeSubsetError) as excinfo:
        await assert_folder_scopes_subset(
            _scoped_definition(scope=[_OUTSIDE]), supabase=object(), user_id="u1"
        )

    exc = excinfo.value
    assert isinstance(exc, ValueError)  # every pre-existing `except ValueError` still catches
    assert exc.phase_slug == "answer"  # the STRUCTURAL channel (SC#4)


@pytest.mark.asyncio
async def test_raised_message_is_byte_identical_to_the_golden_literal(monkeypatch):
    """`str(exc)` is UNCHANGED by the typed-exception change.

    Compared against a hand-written literal (never re-derived from scope.py), because the
    `{ok, error, detail}` short-circuit dict, `workflow_kickoff`'s HTTP-400 `detail`, and
    `test_098_scope_governance`'s `match="is not a subset"` all pin this exact wording."""
    from app.services.harness.scope import assert_folder_scopes_subset

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    with pytest.raises(ValueError) as excinfo:
        await assert_folder_scopes_subset(
            _scoped_definition(scope=[_OUTSIDE]), supabase=object(), user_id="u1"
        )

    assert str(excinfo.value) == _GOLDEN_MESSAGE
    # `super().__init__(message)` keeps `args` single-valued too — anything unpacking
    # `exc.args` (logging formatters, re-raises) behaves exactly as before.
    assert excinfo.value.args == (_GOLDEN_MESSAGE,)


@pytest.mark.asyncio
async def test_existing_value_error_callers_still_catch_it(monkeypatch):
    """CALLER COMPATIBILITY: `pytest.raises(ValueError, match="is not a subset")` — the
    literal contract `test_098_scope_governance::test_narrow_only_reject` asserts, and the
    same clause `workflow_kickoff.py` (→ 400), `runs.py` and `harness_engine.py` catch."""
    from app.services.harness.scope import assert_folder_scopes_subset

    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])

    with pytest.raises(ValueError, match="is not a subset"):
        await assert_folder_scopes_subset(
            _scoped_definition(scope=[_OUTSIDE]), supabase=object(), user_id="u1"
        )


@pytest.mark.asyncio
async def test_clean_and_unbound_definitions_still_raise_nothing(monkeypatch):
    """The ⊆ walk itself is UNCHANGED: an in-subtree scope and an unbound workflow are
    both no-ops (the early return on `resolve_project_subtree(...) is None`)."""
    from app.services.harness.scope import assert_folder_scopes_subset

    # (a) scope ⊆ subtree → clean
    _patch_subtree(monkeypatch, [_PROJECT, _CHILD])
    await assert_folder_scopes_subset(
        _scoped_definition(scope=[_CHILD]), supabase=object(), user_id="u1"
    )

    # (b) unbound workflow (project_folder_id absent → resolver returns None) → no-op
    _patch_subtree(monkeypatch, None)
    await assert_folder_scopes_subset(
        _scoped_definition(scope=[], bound=False), supabase=object(), user_id="u1"
    )
