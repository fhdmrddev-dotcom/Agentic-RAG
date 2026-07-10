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
import io
import zipfile
from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport

from tests.test_evals_router import (  # noqa: F401
    _FilterSupabase,
    _FilterTable,
    _clear_overrides,
    _override,
)

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
# Gate-compute service tests (pure compute_publish_gate calls against a seeded
# _FilterSupabase store; no HTTP needed — the endpoint owner-verifies before compute).
# ══════════════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_gate_unmet_when_no_passing_eval():
    """No completed passing run → met=False, state='never_evaled', last_override=None."""
    from app.services.publish_gate_service import compute_publish_gate

    store, ids = _seed()  # no eval_runs at all
    sb = _FilterSupabase(store)

    gate = await compute_publish_gate(sb, ids.skill_id, OWNER["id"])

    assert gate.met is False
    assert gate.state == "never_evaled"
    assert gate.measured is None and gate.passed is None
    assert gate.passing_run_id is None
    assert gate.last_override is None
    assert gate.reason  # honest human-readable explanation, never empty


@pytest.mark.asyncio
async def test_gate_met_after_passing_eval_current_version():
    """Completed run measured=2 passed=2 on a version whose instructions == live
    skills.instructions → met=True, state='passed', counts + passing_run_id set (D-03+D-04).
    Also proves last_override carries the MOST-RECENT override record (D-02)."""
    from app.services.publish_gate_service import compute_publish_gate

    store, ids = _seed(
        runs=[{"version": 0, "passed": 2, "measured": 2}],
        # Two historical force-publishes — last_override must be the NEWEST one (D-02).
        overrides=[
            {"gate_state": "never_evaled", "created_at": "2026-07-01T00:00:00Z"},
            {"gate_state": "latest_failed", "created_at": "2026-07-02T00:00:00Z"},
        ],
    )
    sb = _FilterSupabase(store)

    gate = await compute_publish_gate(sb, ids.skill_id, OWNER["id"])

    assert gate.met is True
    assert gate.state == "passed"
    assert gate.measured == 2 and gate.passed == 2
    assert gate.passing_run_id == ids.run_ids[0]
    assert gate.last_override is not None
    assert gate.last_override["gate_state"] == "latest_failed"
    assert gate.last_override["created_at"] == "2026-07-02T00:00:00Z"


@pytest.mark.asyncio
async def test_edit_after_pass_resets_gate():
    """Same passing run, but live skills.instructions edited to differ → met=False,
    state='passed_on_older_version' (D-04). ALSO seeds a MORE-RECENT failing completed run:
    'passed_on_older_version' must win over 'latest_failed' (mixed-history precedence — the
    more actionable pointer is 're-eval the current version')."""
    from app.services.publish_gate_service import compute_publish_gate

    store, ids = _seed(
        instructions="EDITED INSTRUCTIONS",       # live text no longer matches any version
        versions=["ORIGINAL INSTRUCTIONS"],
        runs=[
            {"version": 0, "passed": 2, "measured": 2},   # D-03 pass — but stale content
            {"version": 0, "passed": 1, "measured": 2},   # newer completed run FAILING D-03
        ],
    )
    sb = _FilterSupabase(store)

    gate = await compute_publish_gate(sb, ids.skill_id, OWNER["id"])

    assert gate.met is False
    # Precedence: the stale-content pass beats the newer numeric fail (D-04 mixed history).
    assert gate.state == "passed_on_older_version"
    assert gate.measured == 2 and gate.passed == 2  # counts of the stale-content passing run
    assert gate.passing_run_id is None  # nothing satisfies the gate → no passing run id


@pytest.mark.asyncio
async def test_promoted_near_dup_version_counts_as_current():
    """Passing run pins the OLDER skill_version_id; a NEWER version row exists with IDENTICAL
    instructions == live → content-equality yields met=True (id-equality would wrongly say
    unmet — the 135-promotion near-dup trap, D-04)."""
    from app.services.publish_gate_service import compute_publish_gate

    text = "PROMOTED INSTRUCTIONS"
    store, ids = _seed(
        instructions=text,
        versions=[text, text],                      # near-dup: identical text, distinct ids
        runs=[{"version": 0, "passed": 3, "measured": 3}],  # pass pinned to the OLDER id
    )
    sb = _FilterSupabase(store)
    assert ids.version_ids[0] != ids.version_ids[1]  # the trap: ids differ, text does not

    gate = await compute_publish_gate(sb, ids.skill_id, OWNER["id"])

    assert gate.met is True, "content-equality must beat version-id equality (D-04)"
    assert gate.state == "passed"
    assert gate.measured == 3 and gate.passed == 3
    assert gate.passing_run_id == ids.run_ids[0]


@pytest.mark.asyncio
async def test_interrupted_run_does_not_satisfy():
    """A run with status != 'completed' never satisfies the gate — the honest NULL rollup
    (D-03 finalize guard) AND, adversarially, even a non-completed row carrying counts that
    'would' pass is excluded by the completed-only filter (D-03)."""
    from app.services.publish_gate_service import compute_publish_gate

    store, ids = _seed(
        runs=[
            {"version": 0, "status": "interrupted"},                # honest NULL rollup
            {"version": 0, "status": "cancelled", "passed": 2, "measured": 2},  # adversarial
        ],
    )
    sb = _FilterSupabase(store)

    gate = await compute_publish_gate(sb, ids.skill_id, OWNER["id"])

    assert gate.met is False
    # No COMPLETED evidence exists at all → never_evaled (not latest_failed).
    assert gate.state == "never_evaled"
    assert gate.passing_run_id is None


# ══════════════════════════════════════════════════════════════════════════════════════
# Enforcement tests (Plan 02 — real FastAPI app via
# httpx.AsyncClient(transport=ASGITransport(app=app)) with _override/_clear_overrides).
# ══════════════════════════════════════════════════════════════════════════════════════


class _CreateSupabase(_FilterSupabase):
    """``_FilterSupabase`` whose ``skills`` INSERT back-fills the DB-side defaults (id /
    is_enabled / timestamps) a real Postgres row carries, so ``create_skill``'s
    ``SkillResponse`` serialization succeeds through the fake store. ``is_global`` is
    deliberately NOT back-filled — the endpoint must hard-set it (D-08), so whatever value it
    inserts is exactly what the test reads back (a born-global bypass would surface as True)."""

    def table(self, name):
        t = _FilterTable(self.store, name)
        if name == "skills":
            _orig_insert = t.insert

            def _insert(payload, *a, **k):
                rows = payload if isinstance(payload, list) else [payload]
                for r in rows:
                    r.setdefault("id", str(uuid4()))
                    r.setdefault("is_enabled", True)
                    r.setdefault("created_at", "2026-07-03T00:00:00Z")
                    r.setdefault("updated_at", "2026-07-03T00:00:00Z")
                return _orig_insert(payload, *a, **k)

            t.insert = _insert
        return t


@pytest.mark.asyncio
async def test_toggle_global_blocked_when_no_passing_eval():
    """Private→global toggle with no passing eval → 409 {'error': 'publish_gate_unmet',
    'gate': {...}}; skills.is_global stays False (GATE-01 SC#1 / D-07)."""
    from app.main import app

    store, ids = _seed(is_global=False)  # no eval_runs → gate unmet (never_evaled)
    sb = _FilterSupabase(store)

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.patch(f"/skills/{ids.skill_id}/toggle-global", json={}, headers=_H)
    finally:
        _clear_overrides(app)

    assert resp.status_code == 409, f"expected 409, got {resp.status_code}: {resp.text}"
    detail = resp.json()["detail"]
    assert detail["error"] == "publish_gate_unmet"
    # The server-computed gate travels in the refusal payload (server→client only, T-136-03).
    assert "gate" in detail and detail["gate"]["met"] is False
    # The is_global UPDATE never ran — the skill stays private.
    assert sb.store["skills"][0]["is_global"] is False
    # A plain (non-override) refusal records nothing.
    assert sb.store["skill_publish_overrides"] == []


@pytest.mark.asyncio
async def test_toggle_global_allowed_after_passing_eval():
    """After a completed passing run on the CURRENT version, the toggle succeeds (200) and
    flips is_global true — the gate was MET, so NO override row is recorded (GATE-01 SC#2)."""
    from app.main import app

    store, ids = _seed(
        is_global=False,
        runs=[{"version": 0, "passed": 2, "measured": 2}],  # D-03 full pass on the current version
    )
    sb = _FilterSupabase(store)

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.patch(f"/skills/{ids.skill_id}/toggle-global", json={}, headers=_H)
    finally:
        _clear_overrides(app)

    assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text}"
    assert resp.json()["is_global"] is True
    assert sb.store["skills"][0]["is_global"] is True
    # Met gate → a straight publish, no owner-visible override row.
    assert sb.store["skill_publish_overrides"] == []


@pytest.mark.asyncio
async def test_force_publish_records_override():
    """override=true on an UNMET gate publishes AND appends exactly ONE skill_publish_overrides
    row carrying gate_state + gate_snapshot AT THE MOMENT OF OVERRIDE, with skill_version_id ==
    the LATEST skill_versions.id — owner-visible, non-repudiable (D-01/D-02)."""
    from app.main import app

    # Two versions, no runs → gate unmet (never_evaled); the latest version is index 1
    # (version_number 2 — resolved via order("version_number", desc).limit(1)).
    store, ids = _seed(is_global=False, instructions="V2", versions=["V1", "V2"])
    sb = _FilterSupabase(store)

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.patch(
                f"/skills/{ids.skill_id}/toggle-global", json={"override": True}, headers=_H
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code == 200, f"expected 200, got {resp.status_code}: {resp.text}"
    assert resp.json()["is_global"] is True
    assert sb.store["skills"][0]["is_global"] is True

    overrides = sb.store["skill_publish_overrides"]
    assert len(overrides) == 1, "force-publish records exactly one owner-visible override row"
    row = overrides[0]
    assert row["user_id"] == OWNER["id"]
    assert row["gate_state"] == "never_evaled"           # the honest state at the moment of override
    assert row["skill_version_id"] == ids.version_ids[1]  # the LATEST version (version_number desc)
    snap = row["gate_snapshot"]
    assert "measured_count" in snap and "passed_count" in snap
    assert snap.get("reason"), "the gate snapshot carries a human-readable reason"


@pytest.mark.asyncio
async def test_create_skill_ignores_body_is_global():
    """POST /skills with body is_global=true → the created row is is_global=False; the
    born-global side door is hard-closed server-side (D-08 / T-118-02-01)."""
    from app.main import app

    sb = _CreateSupabase({"skills": []})

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post(
                "/skills",
                json={"name": "Sneaky", "description": "d", "instructions": "i", "is_global": True},
                headers=_H,
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code == 201, f"expected 201, got {resp.status_code}: {resp.text}"
    assert resp.json()["is_global"] is False, "the server must ignore body.is_global (D-08)"
    assert sb.store["skills"][0]["is_global"] is False


@pytest.mark.asyncio
async def test_import_and_save_skill_stay_private():
    """Skill import (ZIP → POST /skills/import) AND the agent save_skill tool both produce
    is_global=False rows — the D-08 regression guard on the two non-create write paths."""
    from app.main import app
    from app.services.tool_dispatcher import _handle_save_skill

    # ── import path: a minimal SKILL.md-only ZIP (no companion files → no storage calls) ──
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "SKILL.md",
            "---\nname: Imported Skill\ndescription: d\n---\n\nImported body instructions",
        )
    zip_bytes = buf.getvalue()

    # _CreateSupabase back-fills the inserted skills row's ``id`` (the import path threads
    # ``skill_row["id"]`` into the companion-file upload) while leaving is_global untouched.
    sb = _CreateSupabase({"skills": []})
    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post(
                "/skills/import",
                files={"file": ("skill.zip", zip_bytes, "application/zip")},
                headers=_H,
            )
    finally:
        _clear_overrides(app)

    assert resp.status_code in (200, 201), f"import {resp.status_code}: {resp.text}"
    created = resp.json()["created"]
    assert len(created) == 1
    assert created[0]["is_global"] is False, "import must land is_global=False (D-08)"
    assert sb.store["skills"][0]["is_global"] is False

    # ── save_skill tool path: the insert carries NO is_global key → the DB default (False)
    #    applies; a caller can never make a born-global skill through the agent tool. ──
    save_store = {"skills": []}
    save_sb = _FilterSupabase(save_store)
    ctx = SimpleNamespace(supabase=save_sb, current_user=OWNER)
    await _handle_save_skill(
        {"name": "Tool Skill", "description": "d", "instructions": "i"}, ctx
    )
    assert len(save_store["skills"]) == 1
    assert save_store["skills"][0].get("is_global") is not True


@pytest.mark.asyncio
async def test_unshare_never_gated_reshare_regated():
    """Global→private (unshare) is NEVER gated (200, no override); a subsequent private→global
    re-share with an unmet gate IS re-gated (409) — no was-ever-published grandfathering
    (D-07/D-09). The gate call lives ONLY inside the ``new_value is True`` branch, so the
    ungated unshare returning 200 proves it is not invoked on the global→private direction."""
    from app.main import app

    store, ids = _seed(is_global=True)  # already global, but no passing eval
    sb = _FilterSupabase(store)

    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            unshare = await c.patch(f"/skills/{ids.skill_id}/toggle-global", json={}, headers=_H)
            reshare = await c.patch(f"/skills/{ids.skill_id}/toggle-global", json={}, headers=_H)
    finally:
        _clear_overrides(app)

    # Unshare: an ungated straight UPDATE (no gate, no override).
    assert unshare.status_code == 200, f"unshare expected 200, got {unshare.status_code}: {unshare.text}"
    assert unshare.json()["is_global"] is False
    assert sb.store["skill_publish_overrides"] == [], "unshare must NOT record an override"
    # Re-share: the gate runs fresh — unmet → 409 (no grandfathering).
    assert reshare.status_code == 409, f"reshare expected 409, got {reshare.status_code}: {reshare.text}"
    assert reshare.json()["detail"]["error"] == "publish_gate_unmet"
    assert sb.store["skills"][0]["is_global"] is False, "the blocked re-share left the skill private"
