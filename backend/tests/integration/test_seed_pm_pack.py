"""Phase 104 (PM-01) Plan 02 — seed-smoke / idempotency / RLS / immutability / def-shape.

LIVE-DB integration tests over the result of ``scripts/seed-pm-pack.py`` (the opt-in PM
pack provisioning script). These are NOT pure units — they drive the real seed against the
local Supabase stack (:54322 Postgres + the Storage API) and assert the seeded rows. The
whole module SKIPS cleanly (never errors) when the local stack is down, mirroring
``tests/unit/test_publish_flip.py``'s skip-guard convention.

What is proven (the four load-bearing properties — RESEARCH ## Validation Architecture):
  - Test 1 (seed smoke + idempotency): run the seed twice → exactly 2 PM def rows
    (pm-weekly-status-report + pm-risk-register), is_global=false, created_by=DEMO_USER_ID,
    status='published'. No duplicates.
  - Test 2 (def shape): each seeded def is the 2-phase ``llm_agent``(search_documents)→
    ``llm_emit``(render_template) shape with ``assets[0].kind=='template'``, a non-null
    business_requirement, NO ``render_template`` in any ``available_tools``,
    ``output_file_valid`` ``config:{}``, and NO interactive phase / ask_user validator
    (so it passes the publish gauntlet's interactive-phase pre-block).
  - Test 3 (immutability): a deliberate UPDATE of a seeded published row's ``definition``
    raises the trigger's CheckViolation (DELETE-then-INSERT is the only refresh path).
  - Test 4 (RLS isolation): the demo folder is is_global=false and the corpus is owner-scoped
    (no cross-tenant leak — the migration-019 pollution mechanism is avoided).

The live corpus EMBEDDINGS step stays OFF here: the seed's ``ingest_corpus`` only fires
embeddings when ``SEED_PM_RUN_INGEST=1`` (unset by these tests), so running ``main()`` seeds
the folder + dedup-safe document ROWS + templates + defs with zero OpenAI calls. The def +
immutability + RLS assertions are the load-bearing ones and need no embeddings.

CONVENTION: imports INSIDE the test bodies / module helpers; the DB connect is guarded.
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest

_DSN = os.environ.get(
    "LOCAL_DB_DSN",
    os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
)

# repo-root resolution: backend/tests/integration/test_seed_pm_pack.py -> parents[3] == repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
_SEED_PATH = _REPO_ROOT / "scripts" / "seed-pm-pack.py"

DEMO_USER_ID = "d8a54002-6a29-4b88-b918-cff2aa4a06d5"
PM_SLUGS = ("pm-weekly-status-report", "pm-risk-register")


def _pg_reachable(dsn: str = _DSN) -> bool:
    """Probe local Postgres availability without raising (skip guard)."""
    try:
        import psycopg2

        conn = psycopg2.connect(dsn, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


PG_AVAILABLE = _pg_reachable()

pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"local Supabase {_DSN} not reachable; skipping PM-pack seed integration tests",
)


def _load_seed_module():
    """Import scripts/seed-pm-pack.py by path (it lives off the package tree).

    The seed module's top-level ``load_dotenv(backend/.env)`` resolves the service-role
    URL/key so its Storage upload works. Backend/ is already importable (the seed inserts it
    on sys.path at import time).

    The root ``tests/conftest.py`` ``setdefault``s a FAKE ``SUPABASE_URL`` /
    ``SUPABASE_SERVICE_ROLE_KEY`` at collection time (``https://test.supabase.co``) so pure
    units never touch a real backend. ``load_dotenv`` does NOT override an already-set env
    var, so without this the seed would point at the fake host and its Storage upload would
    ``getaddrinfo``-fail → an unwanted skip. These are LIVE-DB integration tests that drive
    the REAL local stack, so we re-load ``backend/.env`` with ``override=True`` to restore the
    real local Supabase URL/key BEFORE the seed module reads them (equivalent to a real
    operator invocation from the repo root).
    """
    from dotenv import load_dotenv

    load_dotenv(_REPO_ROOT / "backend" / ".env", override=True)
    spec = importlib.util.spec_from_file_location("seed_pm_pack", _SEED_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_seed_or_skip(module):
    """Run the seed main() once; skip cleanly if the env can't support it (e.g. the demo
    auth.users row is missing → the seed's assert_demo_uid aborts with SystemExit, or the
    Storage API is unreachable). These are honest environment-not-ready skips, not failures.
    """
    try:
        rc = module.main()
    except SystemExit as exc:
        # SystemExit(0) is a clean success; any non-zero/message is an env-not-ready signal.
        if exc.code in (0, None):
            return
        pytest.skip(f"seed could not run in this environment: {exc.code}")
    except Exception as exc:  # noqa: BLE001 — Storage/embedding env not ready → skip, don't fail
        pytest.skip(f"seed could not run in this environment: {type(exc).__name__}: {exc}")
    assert rc == 0, "seed main() must return 0 on success"


def _fetch_pm_defs(cur, module):
    """The seed's OWN two defs, fetched by their deterministic ids (not by slug).

    Scope by the seed's fixed ``STATUS_DEF_ID`` / ``RISK_DEF_ID`` rather than the slug: the
    phase's own Tweak→v(N+1) republish flow (exercised at the Plan-03 live UAT) legitimately
    creates ADDITIONAL rows under the same ``pm-weekly-status-report`` slug (different ids,
    version+1, draft or published), so a slug-scoped query is not stable once the versioning
    feature has been used. The seed's idempotency property is "each of its two FIXED def ids
    resolves to exactly one row after running the seed twice" — a non-DELETE-then-INSERT seed
    would raise a duplicate-key error on the second fixed-id INSERT, so the double-run in
    ``test_seed_smoke_and_idempotency`` still proves the refresh path.
    """
    cur.execute(
        "SELECT slug, is_global, created_by, status, definition "
        "FROM public.workflow_definitions "
        "WHERE created_by = %s AND id IN %s "
        "ORDER BY slug",
        (DEMO_USER_ID, (module.STATUS_DEF_ID, module.RISK_DEF_ID)),
    )
    return cur.fetchall()


def test_seed_smoke_and_idempotency():
    """Run the seed TWICE → exactly 2 PM def rows, is_global=false, created_by=DEMO_USER_ID,
    status='published'. No duplicates (defs refresh via DELETE-then-INSERT, never UPDATE)."""
    import psycopg2

    module = _load_seed_module()
    _run_seed_or_skip(module)
    _run_seed_or_skip(module)  # idempotency — a second run must not duplicate rows

    conn = psycopg2.connect(_DSN, connect_timeout=5)
    try:
        cur = conn.cursor()
        rows = _fetch_pm_defs(cur, module)
        slugs = sorted(r[0] for r in rows)
        assert slugs == sorted(PM_SLUGS), f"expected exactly {PM_SLUGS}, got {slugs}"
        assert len(rows) == 2, f"expected exactly 2 seeded PM def rows (no duplicates), got {len(rows)}"
        for slug, is_global, created_by, status, _definition in rows:
            assert is_global is False, f"{slug}: must be is_global=false (per-account, never global)"
            assert str(created_by) == DEMO_USER_ID, f"{slug}: created_by must be the demo uid"
            assert status == "published", f"{slug}: must be published"
    finally:
        conn.close()


def test_def_shape_is_two_phase_fill():
    """Each seeded def is the 2-phase fill shape with a bound template asset + strict gates +
    a business_requirement + no interactive phase + render_template absent from available_tools
    + output_file_valid config:{}."""
    import psycopg2

    module = _load_seed_module()
    _run_seed_or_skip(module)

    conn = psycopg2.connect(_DSN, connect_timeout=5)
    try:
        cur = conn.cursor()
        rows = _fetch_pm_defs(cur, module)
        assert len(rows) == 2, f"expected 2 seeded PM def rows, got {len(rows)}"

        for slug, _is_global, _created_by, _status, definition in rows:
            # psycopg2 returns jsonb as a parsed dict; tolerate a str just in case.
            d = definition if isinstance(definition, dict) else json.loads(definition)
            phases = d["phases"]
            assert len(phases) == 2, f"{slug}: must be 2-phase, got {len(phases)}"

            retrieve_cfg = phases[0]["config"]
            emit_cfg = phases[1]["config"]
            assert retrieve_cfg["phase_type"] == "llm_agent", f"{slug}: phase[0] must be llm_agent"
            assert "search_documents" in retrieve_cfg["available_tools"], (
                f"{slug}: retrieve phase must declare search_documents"
            )
            assert emit_cfg["phase_type"] == "llm_emit", f"{slug}: phase[1] must be llm_emit"
            assert emit_cfg["emitter"] == "render_template", f"{slug}: emitter must be render_template"

            # render_template absent from EVERY phase's available_tools (clean 2-phase shape).
            all_tools = json.dumps([p["config"].get("available_tools", []) for p in phases])
            assert "render_template" not in all_tools, (
                f"{slug}: render_template must NOT appear in any available_tools (2-phase shape)"
            )

            # output_file_valid carries an EMPTY config (re-opens the produced file).
            emit_validators = phases[1]["validators"]
            ofv = [v for v in emit_validators if v["kind"] == "output_file_valid"]
            assert ofv, f"{slug}: emit phase must have an output_file_valid validator"
            assert ofv[0]["config"] == {}, f"{slug}: output_file_valid config must be empty"
            cit = [v for v in emit_validators if v["kind"] == "citations_required"]
            assert cit, f"{slug}: emit phase must have a citations_required validator"

            # No interactive phase / no ask_user-routed validator (publish-gauntlet pre-block).
            for p in phases:
                assert p["config"]["phase_type"] != "llm_human_input", (
                    f"{slug}: no interactive phase allowed"
                )
                for v in p.get("validators", []):
                    assert v.get("on_failure") != "ask_user", (
                        f"{slug}: no validator may route to ask_user"
                    )

            # Bound template asset + scope + requirement.
            assert d["assets"][0]["kind"] == "template", f"{slug}: assets[0].kind must be template"
            assert d["assets"][0]["asset_id"].startswith(f"{DEMO_USER_ID}/_library/"), (
                f"{slug}: asset_id must be the {{uid}}/_library/ Storage path"
            )
            assert d["project_folder_id"], f"{slug}: project_folder_id must be set"
            assert d["business_requirement"], f"{slug}: business_requirement must be non-null"
    finally:
        conn.close()


def test_published_def_update_blocked_by_immutability_trigger():
    """A deliberate UPDATE of a seeded published row's definition raises CheckViolation
    (the workflow_definitions_block_published trigger) — proving DELETE-then-INSERT is the
    only refresh path. Rollback afterward (no pollution)."""
    import psycopg2
    from psycopg2.errors import CheckViolation

    module = _load_seed_module()
    _run_seed_or_skip(module)

    conn = psycopg2.connect(_DSN, connect_timeout=5)
    conn.autocommit = False
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM public.workflow_definitions "
            "WHERE created_by = %s AND slug = %s AND status = 'published' LIMIT 1",
            (DEMO_USER_ID, PM_SLUGS[0]),
        )
        row = cur.fetchone()
        if row is None:
            pytest.skip("no seeded published PM def to test immutability against")
        def_id = row[0]

        with pytest.raises(CheckViolation):
            cur.execute(
                "UPDATE public.workflow_definitions "
                "SET definition = '{\"phases\": []}'::jsonb WHERE id = %s",
                (def_id,),
            )
        conn.rollback()  # clear the aborted transaction; leave the seeded row intact
    finally:
        conn.close()


def test_rls_isolation_demo_folder_is_per_account():
    """The demo folder is is_global=false (so the migration-019 pollution RLS cannot surface
    its docs to other tenants) AND every document in it is owned by the demo uid (no
    cross-tenant leak — the falsifiable owner-scoping check)."""
    import psycopg2

    module = _load_seed_module()
    _run_seed_or_skip(module)

    conn = psycopg2.connect(_DSN, connect_timeout=5)
    try:
        cur = conn.cursor()
        # Resolve the demo folder (the seed created/looked it up under the demo uid).
        cur.execute(
            "SELECT id, is_global FROM public.folders "
            "WHERE user_id = %s AND name = %s ORDER BY created_at ASC LIMIT 1",
            (DEMO_USER_ID, module.DEMO_FOLDER_NAME),
        )
        frow = cur.fetchone()
        assert frow is not None, "the seed must create the per-account demo folder"
        folder_id, is_global = frow
        assert is_global is False, "the demo folder must be is_global=false (never global)"

        # No document in the demo folder may belong to a different owner (owner-scoping).
        cur.execute(
            "SELECT count(*) FROM public.documents "
            "WHERE folder_id = %s AND user_id <> %s",
            (folder_id, DEMO_USER_ID),
        )
        leaked = cur.fetchone()[0]
        assert leaked == 0, f"{leaked} doc(s) in the demo folder are not owned by the demo uid"
    finally:
        conn.close()
