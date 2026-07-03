"""Phase 136 (GATE-01) — skill publish gate: gate-compute service tests + enforcement tests.

The publish gate is a READ MODEL over the already-honest eval substrate (migrations 079-084):
``compute_publish_gate(supabase, skill_id, user_id)`` recomputes ``met`` from the NUMERIC
``eval_runs.passed_count`` / ``measured_count`` columns (D-03 — never the ``verdict_summary``
display text) and binds a passing run to the skill's CURRENT instructions by CONTENT-EQUALITY
(D-04 — ``skill_versions.instructions == skills.instructions``), the only rule correct under
BOTH a manual instruction edit (gate honestly resets) AND the Phase-135 promotion near-duplicate
-version trap (a new version row with identical text still reads "current version passed").

Scaffold (test_skill_proposals_router.py precedent): reuses ``_FilterSupabase`` /
``_override`` / ``_clear_overrides`` from ``test_evals_router`` so the in-memory fake-store
semantics (``.eq()`` / ``.in_()`` chains, ``.insert()`` returning rows in ``.data``,
``.order(...).limit(1)``) stay identical to the sibling eval tests. ``_seed`` builds the exact
store the gate reads: one owner-scoped ``skills`` row (with ``instructions`` + ``is_global``),
N ``skill_versions`` rows (each ``id`` + ``instructions`` — two rows with IDENTICAL text but
DISTINCT ids model the D-04 near-dup case), zero-or-more ``eval_runs`` rows
(``status``/``passed_count``/``measured_count``/``skill_version_id`` — non-completed runs carry
the honest NULL rollup), and an (empty-by-default) ``skill_publish_overrides`` table for the
``last_override`` read.

Test inventory (RESEARCH Requirements → Test Map — 11 rows):
  Gate-compute (five service tests, filled by Plan 01 Task 3):
    * test_gate_unmet_when_no_passing_eval
    * test_gate_met_after_passing_eval_current_version
    * test_edit_after_pass_resets_gate                (+ mixed-history precedence)
    * test_promoted_near_dup_version_counts_as_current
    * test_interrupted_run_does_not_satisfy
  Enforcement (six API tests, filled by Plan 02):
    * test_toggle_global_blocked_when_no_passing_eval
    * test_toggle_global_allowed_after_passing_eval
    * test_force_publish_records_override
    * test_create_skill_ignores_body_is_global
    * test_import_and_save_skill_stay_private
    * test_unshare_never_gated_reshare_regated
"""
from types import SimpleNamespace
from uuid import uuid4

import pytest

from tests.test_evals_router import _FilterSupabase, _clear_overrides, _override  # noqa: F401

OWNER = {"id": "00000000-0000-0000-0000-000000000001", "email": "owner@example.com"}
OTHER_USER = {"id": "00000000-0000-0000-0000-000000000099", "email": "other@example.com"}

_H = {"Authorization": "Bearer test"}


def _seed(
    *,
    instructions="CURRENT INSTRUCTIONS",
    is_global=False,
    versions=None,
    runs=(),
    overrides=(),
):
    """Build the in-memory store ``compute_publish_gate`` reads. Returns ``(store, ids)``.

    Args:
        instructions: the LIVE ``skills.instructions`` text (what D-04 binds against).
        is_global:    the skill's current share state.
        versions:     list of instruction texts, one ``skill_versions`` row each, in creation
                      order (index 0 = oldest). Defaults to ONE version matching ``instructions``.
                      Two entries with IDENTICAL text but distinct auto-generated ids model the
                      135-promotion near-dup case (point the passing run at index 0, the OLDER id).
        runs:         list of dicts, one ``eval_runs`` row each:
                        ``version`` (int, index into ``versions``) — the run's pinned version;
                        ``status`` (default "completed");
                        ``passed`` / ``measured`` (default None — the honest NULL rollup a
                        non-completed run must carry).
        overrides:    list of dicts appended to ``skill_publish_overrides`` (``gate_state`` +
                      optional ``created_at``/``gate_snapshot``) for the last_override read.

    ids: SimpleNamespace(skill_id, version_ids [creation order], run_ids [seed order]).
    """
    if versions is None:
        versions = [instructions]
    skill_id = str(uuid4())
    version_ids = [str(uuid4()) for _ in versions]

    store = {
        "skills": [
            {
                "id": skill_id,
                "user_id": OWNER["id"],
                "name": "S",
                "description": "d",
                "instructions": instructions,
                "is_enabled": True,
                "is_global": is_global,
                "created_at": "2026-07-03T00:00:00Z",
                "updated_at": "2026-07-03T00:00:00Z",
            }
        ],
        "skill_versions": [
            {
                "id": vid,
                "skill_id": skill_id,
                "user_id": OWNER["id"],
                "instructions": vtext,
                "name": "S",
                "description": "d",
                "version_number": i + 1,
                "created_at": f"2026-07-03T00:0{min(i, 9)}:00Z",
            }
            for i, (vid, vtext) in enumerate(zip(version_ids, versions))
        ],
        "eval_runs": [],
        "skill_publish_overrides": [],
    }

    run_ids = []
    for i, spec in enumerate(runs):
        rid = str(uuid4())
        run_ids.append(rid)
        store["eval_runs"].append(
            {
                "id": rid,
                "skill_id": skill_id,
                "skill_version_id": version_ids[spec.get("version", 0)],
                "user_id": OWNER["id"],
                "status": spec.get("status", "completed"),
                # Non-completed runs keep the honest NULL rollup (D-03: the finalize guard
                # only writes counts on final_status == "completed").
                "passed_count": spec.get("passed"),
                "measured_count": spec.get("measured"),
                "created_at": f"2026-07-03T01:{i:02d}:00Z",
            }
        )

    for i, spec in enumerate(overrides):
        store["skill_publish_overrides"].append(
            {
                "id": str(uuid4()),
                "skill_id": skill_id,
                "skill_version_id": spec.get("skill_version_id"),
                "user_id": OWNER["id"],
                "gate_state": spec.get("gate_state", "never_evaled"),
                "gate_snapshot": spec.get("gate_snapshot", {}),
                "created_at": spec.get("created_at", f"2026-07-03T02:{i:02d}:00Z"),
            }
        )

    return store, SimpleNamespace(
        skill_id=skill_id, version_ids=version_ids, run_ids=run_ids
    )


# ══════════════════════════════════════════════════════════════════════════════════════
# Gate-compute service tests (Plan 01 Task 3 fills these — pure compute_publish_gate calls
# against a seeded _FilterSupabase store; no HTTP needed).
# ══════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_gate_unmet_when_no_passing_eval():
    """No completed passing run → met=False, state='never_evaled', last_override=None."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_gate_met_after_passing_eval_current_version():
    """Completed run measured=2 passed=2 on a version whose instructions == live
    skills.instructions → met=True, state='passed', counts + passing_run_id set (D-03+D-04)."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_edit_after_pass_resets_gate():
    """Same passing run, but live skills.instructions edited to differ → met=False,
    state='passed_on_older_version' (D-04). ALSO seeds a failing completed run:
    'passed_on_older_version' must win over 'latest_failed' (mixed-history precedence)."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_promoted_near_dup_version_counts_as_current():
    """Passing run pins the OLDER skill_version_id; a NEWER version row exists with IDENTICAL
    instructions == live → content-equality yields met=True (id-equality would wrongly say
    unmet — the 135-promotion near-dup trap, D-04)."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_interrupted_run_does_not_satisfy():
    """A run with status != 'completed' (NULL rollup) never satisfies the gate even if it
    'would' pass → met=False (D-03 completed-only)."""


# ══════════════════════════════════════════════════════════════════════════════════════
# Enforcement tests (Plan 02 fills these — real FastAPI app via
# httpx.AsyncClient(transport=ASGITransport(app=app)) with _override/_clear_overrides).
# ══════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_toggle_global_blocked_when_no_passing_eval():
    """Private→global toggle with no passing eval → 409 {'error': 'publish_gate_unmet',
    'gate': {...}}; skills.is_global stays False (GATE-01 SC#1)."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_toggle_global_allowed_after_passing_eval():
    """After a passing eval on the current version, the toggle succeeds (200) and the gate
    reads satisfied X/N (GATE-01 SC#2)."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_force_publish_records_override():
    """override=true publishes AND appends a skill_publish_overrides row carrying gate_state +
    gate_snapshot at the moment of override — owner-visible, non-repudiable (D-01/D-02)."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_create_skill_ignores_body_is_global():
    """POST /skills with body is_global=true → the created row is is_global=False; the
    born-global side door is hard-closed server-side (D-08 / T-118-02-01)."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_import_and_save_skill_stay_private():
    """Skill import and the agent save_skill tool both produce is_global=False rows —
    the D-08 regression guard on the two non-create write paths."""


@pytest.mark.asyncio
@pytest.mark.skip(reason="Wave 0 stub — implemented in Task 3 / Plan 02")
async def test_unshare_never_gated_reshare_regated():
    """Global→private (unshare) is never gated; a subsequent private→global re-share IS
    re-gated (D-07/D-09)."""
