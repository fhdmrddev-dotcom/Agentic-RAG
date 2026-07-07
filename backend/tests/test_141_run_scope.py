"""Phase 141 / COLL-02 — run-scope the ephemeral ``template_input`` resolver.

The executable authorization spec + the faithful fail-before/pass-after repro (D-141-06).
This file is authored in Plan 141-01; it is the **RED backstop** Plan 141-02 flips GREEN.

Two layers of coverage:

  1. **GREEN now** (the pure helpers from Plan 141-01 Task 2 + the migration from Task 1):
     the 5-direction ``claim_visible`` truth table (3 blocked, 2 allowed), the
     ``own_claim_for_ctx`` derivation, and the migration-092 static contract.

  2. **xfail-pending Plan 141-02** (marked ``pytest.mark.xfail(strict=False)`` — Plan 02
     drops each marker as it wires the behavior): the resolver stamp + claim-aware WHERE,
     the honest "belongs to another run" relay, the claim-stamp losing-race fallthrough
     (Pitfall 2 / T-141-03), the ``_ProducerStreamCtx`` workflow lineage stamp (Landmine 2),
     the happy-path no-regression, the owner/thread scope-preservation backstop, and the
     source-level proof that BOTH Branch-2 resolve sites derive an own-claim.

Discipline mirrors ``test_120_origin_filter.py``: the pure helper + the SQL WHERE predicate
are the single source of the eligibility truth, so the full truth table is provable offline
against the real ``mock_asyncpg_pool`` recorder (no live DB) — not a proxy/mocked-helper
assertion. The recorder returns canned dicts and does NOT evaluate the WHERE, so resolver
tests pair a seeded row with the claim logic Plan 02 applies in code.
"""

from __future__ import annotations

import pathlib
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.template_asset_service import (
    DEEP_CLAIM,
    claim_visible,
    own_claim_for_ctx,
    resolve_template_source,
)

_BACKEND = pathlib.Path(__file__).resolve().parents[1]

# Two distinct workflow_run_id lineages; a Deep turn uses the DEEP_CLAIM sentinel.
_W1 = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
_W2 = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
_W1S = str(_W1)
_W2S = str(_W2)

_THREAD = "cccccccc-cccc-cccc-cccc-cccccccccccc"
_USER = "dddddddd-dddd-dddd-dddd-dddddddddddd"
_FILE_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

_PLAN_02 = "Plan 141-02 wires own_claim + claim-aware WHERE + stamp"


def _row(run_claim, *, content=b"TEMPLATE-BYTES", path="/report.docx", expires_at=None):
    """A seeded ``workspace_files`` template_input row (mirrors the Branch-2 projection)."""
    return {
        "id": _FILE_ID,
        "thread_id": _THREAD,
        "path": path,
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content_inline": content,  # _get_file_content returns this directly (no Storage I/O)
        "content_storage_path": None,
        "created_by": _USER,
        "created_at": None,
        "kind": "template_input",
        "expires_at": expires_at,
        "run_claim": run_claim,
    }


# ── (1) claim_visible — the 5-direction truth table (GREEN now, Plan 01 Task 2) ──────
# unclaimed → visible; same-mode reuse → visible; foreign lineage → invisible.


def test_unclaimed_visible():
    """A NULL-claim (unclaimed legacy/new) row is resolvable by the FIRST claimer, whether
    that claimer is Deep or a workflow run (then it gets stamped — see the resolver test)."""
    assert claim_visible(None, DEEP_CLAIM) is True
    assert claim_visible(None, _W1S) is True


def test_deep_to_deep_reuse():
    """SC#2 — upload once, reuse in the next Deep turn (no re-upload)."""
    assert claim_visible(DEEP_CLAIM, DEEP_CLAIM) is True


def test_same_workflow_run_reuse():
    """SC#2 — phases of ONE workflow_run share the same claimed template."""
    assert claim_visible(_W1S, _W1S) is True


def test_workflow_to_deep_blocked():
    """SC#1 — a workflow-run's template is invisible to a Deep turn (the Phase-120 collision)."""
    assert claim_visible(_W1S, DEEP_CLAIM) is False


def test_deep_to_workflow_blocked():
    """SC#1 — the 'deep' sentinel earns its keep: a Deep-claimed row is invisible to a
    workflow run (without the sentinel a Deep row would stay NULL and be claimable = a leak)."""
    assert claim_visible(DEEP_CLAIM, _W1S) is False


def test_cross_workflow_run_blocked():
    """SC#1 — W1's template is invisible to a different workflow-run W2."""
    assert claim_visible(_W1S, _W2S) is False


# ── (2) own_claim_for_ctx — lineage derivation (GREEN now, Plan 01 Task 2) ───────────


def test_own_claim_deep_vs_workflow():
    """None → 'deep' sentinel; a workflow_run_id → str(workflow_run_id). Keyed off
    workflow_run_id ONLY — run_id / parent_run_id must NEVER influence the claim (keying off
    run_id would break Deep→Deep reuse; parent_run_id is null on top-level runs)."""
    assert own_claim_for_ctx(SimpleNamespace(workflow_run_id=None)) == DEEP_CLAIM
    assert own_claim_for_ctx(SimpleNamespace(workflow_run_id=_W1)) == _W1S
    # run_id / parent_run_id present but workflow_run_id None → still the Deep sentinel.
    assert (
        own_claim_for_ctx(
            SimpleNamespace(workflow_run_id=None, run_id=uuid.uuid4(), parent_run_id=uuid.uuid4())
        )
        == DEEP_CLAIM
    )
    # A ctx missing the attribute entirely (e.g. a bare proxy) → the Deep sentinel default.
    assert own_claim_for_ctx(SimpleNamespace()) == DEEP_CLAIM


# ── (3) Migration 092 static contract (GREEN now, Plan 01 Task 1) ────────────────────


def test_migration_092_additive_nullable():
    """Migration 092 adds a NULLABLE text run_claim column: no NOT NULL, no DEFAULT, no
    backfill, IF NOT EXISTS (idempotent), and it does NOT prescribe the destructive CLI apply
    commands (mirror test_workspace_template.test_existing_rows_valid). Copying 076's
    ``NOT NULL DEFAULT 'deep'`` here would permanently deep-claim every legacy row (Pitfall 3)."""
    migration = _BACKEND.parent / "supabase" / "migrations" / "092_workspace_files_run_claim.sql"
    assert migration.exists(), "migration 092 not authored (Plan 141-01 Task 1)"
    sql = migration.read_text(encoding="utf-8")

    # Present: the additive, idempotent, nullable ADD (D-141-02) + the apply-by-hand contract.
    assert "ADD COLUMN IF NOT EXISTS run_claim text" in sql
    assert "regenerate-full-schema" in sql

    # Assert the EXECUTABLE DDL only — strip `--` rationale prose, which (per CLAUDE.md) MUST
    # name db push/reset in its NEVER warning AND explains the NOT-NULL-DEFAULT divergence from
    # 076. The static contract is about what the migration DOES, not its documentation.
    ddl = "\n".join(l for l in sql.splitlines() if not l.strip().startswith("--"))

    # Nullable — no NOT NULL sneaks onto run_claim (the whole point vs. migration 076).
    assert "NOT NULL" not in ddl.replace("IS NOT NULL", "")
    # No DEFAULT clause on the run_claim ADD (NULL = unclaimed, D-141-04 / Pitfall 3).
    add_stmt = ddl.split("ADD COLUMN IF NOT EXISTS run_claim text", 1)[1].split(";", 1)[0]
    assert "DEFAULT" not in add_stmt.upper()
    # No data-migration backfill (no UPDATE statement, D-141-04).
    assert "UPDATE" not in ddl.upper()
    # Does NOT prescribe the destructive Supabase CLI apply commands (apply-by-hand only).
    assert "db push" not in ddl.lower()
    assert "db reset" not in ddl.lower()


# ── (4) Resolver stamp + honest error + race (xfail-pending Plan 141-02) ─────────────


async def test_resolver_stamps_unclaimed(mock_asyncpg_pool):
    """A NULL-claim row resolves for the resolving context AND is stamped with that context's
    own-claim via a conditional ``UPDATE ... SET run_claim = $ WHERE ... AND run_claim IS NULL``
    (race-safe, Pitfall 2). The stamp is recorded on the real pool.calls — not a mocked helper."""
    supabase = MagicMock()
    mock_asyncpg_pool.set_fetchrow_result(_row(None, content=b"OWN-TEMPLATE"))
    result = await resolve_template_source(
        pool=mock_asyncpg_pool,
        supabase=supabase,
        thread_id=_THREAD,
        user_id=_USER,
        own_claim=DEEP_CLAIM,
    )
    assert result["bytes"] == b"OWN-TEMPLATE"
    stamps = [c for c in mock_asyncpg_pool.calls if "UPDATE" in c[0].upper() and "run_claim" in c[0]]
    assert stamps, "resolver must stamp the unclaimed row with a conditional UPDATE"
    sql, args = stamps[0]
    assert "IS NULL" in sql.upper(), "the stamp must be conditional (WHERE ... run_claim IS NULL)"
    assert DEEP_CLAIM in args, "the resolving context's own-claim must be bound into the stamp"


async def test_resolver_foreign_claim_honest_error(mock_asyncpg_pool):
    """A foreign-claimed (str(W)) non-expired row must NEVER leak as bytes to a Deep resolve —
    the resolver returns the honest 'belongs to another run' relay string (D-141-05), never a
    raw 404 and never the foreign bytes.

    Faithful repro: pre-fix the resolver has NO claim dimension in the WHERE, so THIS exact row
    is read and returned AS BYTES (the leak). Post-fix the claim check rejects it."""
    supabase = MagicMock()
    mock_asyncpg_pool.set_fetchrow_result(_row(_W1S, content=b"FOREIGN-BYTES", path="/foreign.docx"))
    result = await resolve_template_source(
        pool=mock_asyncpg_pool,
        supabase=supabase,
        thread_id=_THREAD,
        user_id=_USER,
        own_claim=DEEP_CLAIM,
    )
    assert result["bytes"] is None, "foreign-claimed template bytes must NEVER leak (the COLL-02 fix)"
    assert result["error"], "a foreign-claimed row must yield a relay-able error string"
    low = result["error"].lower()
    assert "run" in low or "context" in low, "the error must name the run/context condition (D-141-05)"


async def test_resolver_claim_race_falls_through(mock_asyncpg_pool):
    """Claim-stamp losing race (Pitfall 2 / T-141-03): two contexts resolve the same NULL-claim
    row; our conditional ``UPDATE ... WHERE run_claim IS NULL`` affects 0 rows (the other context
    won). The resolver re-SELECTs, sees the row is now FOREIGN-claimed, and returns the honest
    error — NEVER bytes. Seeds ``set_execute_result('UPDATE 0')`` + a foreign re-SELECT."""
    supabase = MagicMock()
    mock_asyncpg_pool.set_fetchrow_results(
        [
            _row(None, content=b"RACY-BYTES"),  # first SELECT: still unclaimed
            _row(_W1S, content=b"RACY-BYTES"),  # re-SELECT after we lose the stamp: now foreign
        ]
    )
    mock_asyncpg_pool.set_execute_result("UPDATE 0")  # our conditional stamp lost the race
    result = await resolve_template_source(
        pool=mock_asyncpg_pool,
        supabase=supabase,
        thread_id=_THREAD,
        user_id=_USER,
        own_claim=DEEP_CLAIM,
    )
    assert result["bytes"] is None, "a lost claim-stamp race must NOT return bytes"
    assert result["error"], "a lost race resolving to a foreign claim must relay the honest error"
    low = result["error"].lower()
    assert "run" in low or "context" in low


# ── (5) Emit-path lineage (xfail-pending Plan 141-02 — Landmine 2 guard) ──────────────


@pytest.mark.xfail(strict=False, reason="Plan 141-02 stamps _ProducerStreamCtx.workflow_run_id (Landmine 2)")
def test_emit_ctx_carries_workflow_lineage():
    """The harness emit re-dispatch wraps the harness bag in ``_ProducerStreamCtx`` (which
    overrides run_id to the producer id and hides workflow_run_id). Plan 02 stamps the workflow
    lineage onto the proxy from the bag's run_id (= workflow_runs.id) so ``own_claim_for_ctx``
    derives ``str(W)``, NEVER the 'deep' sentinel — the single most likely green-but-broken
    failure (a workflow emit render mis-claiming as Deep re-opens the leak)."""
    from app.services.harness.phase_types import _ProducerStreamCtx  # lazy: heavy harness import

    inner = SimpleNamespace(run_id=_W1)  # the harness bag: run_id IS workflow_runs.id
    render_ctx = _ProducerStreamCtx(inner, "producer-stream-1")
    assert own_claim_for_ctx(render_ctx) == _W1S, "a workflow emit render must claim str(W), not 'deep'"


# ── (6) No-regression happy path (xfail-pending Plan 141-02) ─────────────────────────


async def test_in_scope_render_unchanged(mock_asyncpg_pool, monkeypatch):
    """SC#2 — the render happy path is byte-identical: an own-upload (Branch 2, unclaimed →
    resolves for the resolving context) AND a library AssetRef (Branch 1, trusted, NO run
    scoping) both resolve their bytes unchanged."""
    supabase = MagicMock()

    # Branch 2 — own ephemeral upload (unclaimed → resolvable + stamped).
    mock_asyncpg_pool.set_fetchrow_result(_row(None, content=b"OWN-TEMPLATE"))
    r2 = await resolve_template_source(
        pool=mock_asyncpg_pool,
        supabase=supabase,
        thread_id=_THREAD,
        user_id=_USER,
        own_claim=DEEP_CLAIM,
    )
    assert r2["bytes"] == b"OWN-TEMPLATE"
    assert r2["provenance"] == "template_input"

    # Branch 1 — library AssetRef is UNTOUCHED by the claim work (no run scoping on trusted assets).
    async def _fake_download(_supabase, _path):
        return b"LIBRARY-TEMPLATE"

    monkeypatch.setattr(
        "app.services.template_asset_service._read_from_storage", _fake_download
    )
    asset = SimpleNamespace(
        asset_id=f"{_USER}/_library/report.docx", filename="report.docx", mime="application/docx"
    )
    r1 = await resolve_template_source(
        pool=mock_asyncpg_pool,
        supabase=supabase,
        thread_id="",
        user_id=_USER,
        asset_ref=asset,
        own_claim=_W1S,  # even a workflow own-claim must not affect the trusted library branch
    )
    assert r1["bytes"] == b"LIBRARY-TEMPLATE"
    assert r1["provenance"] == "library"


# ── (7) Scope-preservation + both-sites wiring (xfail-pending Plan 141-02) ───────────


def test_where_preserves_user_and_thread_scope():
    """V4 backstop — the claim-aware Branch-2 WHERE (Plan 02) must NEVER widen the existing
    owner/thread scope: ``thread_id = $1`` + ``created_by = $2`` stay, and ``run_claim`` joins
    the SELECT/WHERE. Asserted against the EXECUTABLE code (comment lines stripped so the
    Plan-01 helper comments describing the predicate don't false-pass this)."""
    src = (_BACKEND / "app" / "services" / "template_asset_service.py").read_text(encoding="utf-8")
    code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
    assert "thread_id = $1" in code, "owner/thread scope must be preserved (V4)"
    assert "created_by = $2" in code, "owner/thread scope must be preserved (V4)"
    assert "run_claim" in code, "Plan 02 must add the claim dimension to the executable Branch-2 SQL"


@pytest.mark.xfail(strict=False, reason=_PLAN_02)
def test_both_branch2_resolve_sites_pass_own_claim():
    """Landmine 1 — BOTH Branch-2-reaching resolve sites must derive an own-claim (Plan 02):
    the tool-call/emit re-dispatch site (tool_dispatcher.py, via own_claim_for_ctx) AND the
    harness emit pre-resolve (phase_types.py, via str(ctx.run_id)). Editing only
    _handle_render_template would ship the fix green-but-broken on the emit phase."""
    td = (_BACKEND / "app" / "services" / "tool_dispatcher.py").read_text(encoding="utf-8")
    pt = (_BACKEND / "app" / "services" / "harness" / "phase_types.py").read_text(encoding="utf-8")
    assert "own_claim_for_ctx" in td, "tool_dispatcher must derive own-claim via the helper (Plan 02)"
    assert "own_claim" in pt, "the harness emit pre-resolve must pass an own-claim (Plan 02)"
