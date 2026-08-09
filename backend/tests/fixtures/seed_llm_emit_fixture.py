"""Re-seed the live UAT WorkflowDefinition to the Phase 101.1 D-13 TWO-STEP llm_emit shape.

Phase 101.1 Plan 05 Task 2 (D-13 two-step authoring shape, baked into the live UAT fixture).

WHY this seeder exists
----------------------
Phase 101's live UAT BLOCKED — 0 .docx produced across 4 runs (GAP-A..D). The root cause
(GAP-A) was that the seeded `fill` phase was a single OPEN auto-tool-choice `llm_agent` loop:
reasoning-native models NARRATE a structured field-map as prose instead of committing the
forced emission. Phase 101.1 closes this with the `llm_emit` phase type + capability-tiered
gateway forcing + a pinned deterministic driver. This seeder RE-WRITES the live UAT definition
`00000000-0000-0000-0000-0000000101a0` from the GAP-A open loop to the D-13 TWO-STEP shape so
the operator can run the 8 `101-HUMAN-UAT.md` rows + the SC#10 4-axis scoreboard against a real
`llm_emit` workflow.

The D-13 two-step shape (CONTEXT D-13)
--------------------------------------
  Phase 1 (`gather`, llm_agent): retrieve + summarize the cited risk evidence from the bound
    project KB folder via `search_documents` over a server-side `folder_scope`. Its text feeds
    the emit phase. This makes the reasoning a separate inspectable phase output.
  Phase 2 (`fill`, llm_emit): phase_type="llm_emit", emitter="render_template"; the model is
    FORCED (never an open loop — D-01) to emit a cited flat field-map derived from phase 1's
    evidence; a pinned deterministic driver renders it into the bound library template (.docx).
    `model=None` (D-07 provider-feature-fit — emit-critical phases default to a forceable
    provider; the operator selects a forceable model per cross-provider axis run). `available_tools`
    is OMITTED on the emit phase — the emit tool is injected server-side, NOT model-selected.

This is DATA seeding, NOT schema — there is NO migration here (LlmEmitPhaseConfig / the assets[]
AssetRef are already locked in Plan 01 / Phase 098). It clones the 101-01/101-06
``seed_library_asset.py`` convention: psycopg2 direct to the live LOCAL Postgres (:54322); the
DEFINITION_JSON ``WorkflowDefinition.model_validate()``s before insert (fail fast if the Wave-1
schema drifted); idempotent DELETE-then-INSERT (the 056/067 immutability trigger is BEFORE-UPDATE
only => DELETE is permitted, so a stale published row is safely refreshed). The Storage object the
template AssetRef points at (``{user_id}/_library/risk-register-101uat.docx``) is already seeded by
``seed_library_asset.py`` — this seeder reuses it (it does NOT re-upload bytes).

Security (threats T-101.1-05-02/03): the DB DSN is read NAME-ONLY from backend/.env (never
hard-coded, never printed). The definition is scoped to created_by=<test user> (is_system_global=false);
the bound AssetRef reuses the existing user-scoped ``{user_id}/_library/...`` object — LOCAL-dev
fixture data, no PII. Never runs ``supabase db push``/``db reset`` (psycopg2 only; preserves dev data).

Run from the repo root or backend/ (the local Supabase stack must be UP — ``supabase start``):

    cd backend && python tests/fixtures/seed_llm_emit_fixture.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# backend/tests/fixtures/seed_llm_emit_fixture.py -> parents[3] == repo root
REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"
OUT_PATH = Path(__file__).resolve().parent / "uat_fixture_ids.json"

# Make backend/ importable, then load backend/.env so the local DSN resolves (mirrors
# seed_library_asset.py). Secrets stay name-only.
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")  # secrets stay name-only — never echoed

import psycopg2  # noqa: E402

from app.models.harness import WorkflowDefinition  # noqa: E402  (the seeded JSON must model_validate())

# ── Constants (locked test user + fixture ids from STATE.md / uat_fixture_ids.json) ────
USER_ID = "d8a54002-6a29-4b88-b918-cff2aa4a06d5"  # fhdmrd@gmail.com — the local dev login
SLUG = "risk-register-fill-101uat"
VERSION = 1
NAME = "Risk Register Fill (101.1 UAT — D-13 two-step llm_emit)"
DEFINITION_ID = "00000000-0000-0000-0000-0000000101a0"  # stable so re-runs are idempotent

# Reuse the EXISTING library template Storage object (seeded by seed_library_asset.py). This
# string IS the AssetRef.asset_id the resolver downloads (a workspace-files Storage key under
# {user_id}/_library/...). The GAP-B source — the bound template the emit phase renders into.
STORAGE_PATH = f"{USER_ID}/_library/risk-register-101uat.docx"
FILENAME = "risk-register.docx"
MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# The bound project KB folder the gather phase retrieves under (the spike-097 corpus:
# "Project Meridian — Risks", 3 docs, owned by USER_ID). A per-phase folder_scope requires the
# definition to carry a project_folder_id for it to be a subset of (the harness.py structural
# validator _folder_scope_requires_project) — so project_folder_id is set to the same folder
# (the gather scope is a subset of itself).
RISK_FOLDER_ID = "75755ec9-5ba7-495b-ad93-7500011cf6f2"

# The FULL WorkflowDefinition shape that model_validate() round-trips. The D-13 TWO-STEP:
#   phase 0 `gather` (llm_agent) — bound-scope retrieval feeding the emit
#   phase 1 `fill`   (llm_emit)  — the SEALED FORCED EMIT into the bound library template
DEFINITION_JSON = {
    "slug": SLUG,
    "version": VERSION,
    "name": NAME,
    "status": "published",
    # project_folder_id is REQUIRED whenever any phase declares folder_scope (the structural
    # validator _folder_scope_requires_project). The gather scope is a subset of this folder.
    "project_folder_id": RISK_FOLDER_ID,
    "phases": [
        {
            # ── Phase 1 (D-13): the PRIOR llm_agent planning/retrieval phase. Its cited
            # evidence text feeds the llm_emit fill phase. search_documents over the bound
            # folder_scope (server-side resolved id list — PROJ-02, NOT a prompt hint).
            "slug": "gather",
            "phase_index": 0,
            "config": {
                "phase_type": "llm_agent",
                "prompt": (
                    "Retrieve and summarize the cited risk evidence from the project knowledge "
                    "base. Use search_documents over the bound project folder to gather every "
                    "risk: its id, description, likelihood, impact, owner, and mitigation. For "
                    "each fact you surface, keep the exact source chunk it came from so the next "
                    "phase can cite it. Do NOT invent risks that are not in the retrieved "
                    "evidence — an honest gap is better than a fabricated row."
                ),
                "available_tools": ["search_documents"],
                "folder_scope": [RISK_FOLDER_ID],
            },
            "validators": [],
        },
        {
            # ── Phase 2 (D-13): the SEALED FORCED EMIT. phase_type=llm_emit, emitter=render_template.
            # The model is FORCED to emit a cited flat field-map derived from the gather evidence;
            # a pinned deterministic driver renders it into the bound library template. model=None
            # (D-07 — the operator selects a forceable model per cross-provider axis run). NO
            # available_tools: the emit tool is injected server-side at phase-build time (D-10),
            # NOT model-selected.
            "slug": "fill",
            "phase_index": 1,
            "config": {
                "phase_type": "llm_emit",
                "prompt": (
                    "Using ONLY the cited risk evidence gathered in the prior phase, derive a flat "
                    "field-map for the risk register: one row per risk, with every value carrying "
                    "its source chunk as a sibling citation. Fill the scalar header fields "
                    "(project name, report date) from the evidence. Do NOT invent values — leave a "
                    "field null if the evidence does not support it. Emit the field-map; the bound "
                    "template is rendered server-side."
                ),
                "emitter": "render_template",
                "model": None,
            },
            "validators": [],
        },
    ],
    "assets": [
        {
            "asset_id": STORAGE_PATH,
            "filename": FILENAME,
            "kind": "template",
            "mime": MIME,
        }
    ],
}


def _db_dsn() -> str:
    """Local-stack DSN — env override or the standard local default (mirrors seed_library_asset.py)."""
    return os.environ.get("LOCAL_DB_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")


def _validate_definition() -> str:
    """Fail fast if the Wave-1 schema drifted — model_validate() the seeded JSON BEFORE insert.

    Returns the canonical JSON text to insert (the DEFINITION_JSON, NOT the model dump — the
    DB stores the authored definition; the validate is the drift gate, T-101.1-05-02).
    """
    WorkflowDefinition.model_validate(DEFINITION_JSON)  # raises pydantic.ValidationError on drift
    return json.dumps(DEFINITION_JSON)


def reseed_definition(conn, target_def: str) -> None:
    """DELETE-then-INSERT the PUBLISHED WorkflowDefinition row to the D-13 two-step shape.

    Idempotent: the 056/067 immutable-on-publish trigger is a BEFORE-UPDATE trigger — it blocks
    authored-column UPDATEs of a published row, but DELETE is permitted. So this seeder DELETEs any
    existing row at DEFINITION_ID first (stale GAP-A open-loop OR an already-correct D-13 row), then
    re-INSERTs the corrected definition published in ONE statement (never trips the trigger). A clean
    2nd run simply DELETEs the row it just wrote and re-inserts the identical shape — exit 0, no dup.

    FK note (the GAP-A run history): ``workflow_runs.definition_id`` references this row with
    ``ON DELETE RESTRICT``, so the prior 4 superseded GAP-A live-UAT runs (the documented "0 .docx
    across 4 runs", evidence preserved in 101-LIVE-UAT-FINDINGS.md) block a bare DELETE. The
    immutability trigger ALSO blocks an in-place UPDATE of a published row's authored columns (incl.
    a status flip), so the only way to land the corrected D-13 definition under the SAME stable id
    the live UAT reads is to first clear the superseded fixture runs that point at it. We DELETE ONLY
    the workflow_runs whose definition_id is THIS fixture id (their workflow_phases CASCADE;
    threads.active_workflow_run_id is SET NULL; the INSERT-only harness_audit receipts have no FK and
    are preserved as immutable history keyed by run_id). This is fixture-run maintenance of a
    superseded definition, scoped to the one fixture id — it never touches any other definition's runs.
    """
    with conn.cursor() as cur:
        # Are there superseded fixture runs that FK-block a DELETE of this published row?
        cur.execute(
            "SELECT count(*) FROM public.workflow_runs WHERE definition_id = %s",
            (DEFINITION_ID,),
        )
        referencing_runs = cur.fetchone()[0]
        if referencing_runs:
            # The prior GAP-A live-UAT runs (the documented "0 .docx across 4 runs",
            # 101-LIVE-UAT-FINDINGS.md) reference this row via workflow_runs.definition_id
            # (ON DELETE RESTRICT). The immutability trigger ALSO blocks an in-place UPDATE of a
            # published row, so re-seeding the SAME stable id needs these superseded fixture runs
            # cleared first. This DELETEs pre-existing run HISTORY the seeder did not create, so it
            # is GATED behind an explicit operator opt-in (never silent). Set the env flag to allow:
            #     SEED_LLM_EMIT_CLEAR_RUNS=1  (PowerShell: $env:SEED_LLM_EMIT_CLEAR_RUNS=1)
            if os.environ.get("SEED_LLM_EMIT_CLEAR_RUNS") not in ("1", "true", "yes"):
                raise SystemExit(
                    f"BLOCKED: {referencing_runs} superseded GAP-A fixture run(s) reference "
                    f"{DEFINITION_ID} (workflow_runs.definition_id ON DELETE RESTRICT), and the "
                    "published row is immutable in place (the BEFORE-UPDATE trigger). To re-seed the "
                    "SAME stable id, these superseded fixture runs must be cleared first.\n"
                    "This DELETEs pre-existing run history (workflow_phases CASCADE; "
                    "threads.active_workflow_run_id SET NULL; the INSERT-only harness_audit receipts "
                    "have NO FK and are PRESERVED as immutable history keyed by run_id).\n"
                    "Re-run with the explicit operator opt-in to proceed:\n"
                    "    SEED_LLM_EMIT_CLEAR_RUNS=1 python tests/fixtures/seed_llm_emit_fixture.py"
                )
            # Operator-authorized: clear ONLY the runs of THIS fixture definition (scoped — never
            # any other definition's runs). CASCADE removes their workflow_phases;
            # threads.active_workflow_run_id is SET NULL; harness_audit receipts are preserved.
            cur.execute(
                "DELETE FROM public.workflow_runs WHERE definition_id = %s",
                (DEFINITION_ID,),
            )
            print(
                f"CLEARED {cur.rowcount} superseded fixture run(s) referencing {DEFINITION_ID} "
                "(operator-authorized via SEED_LLM_EMIT_CLEAR_RUNS; GAP-A history, "
                "harness_audit receipts preserved)"
            )
        # DELETE any existing definition row (stale or current) — the immutability trigger is
        # BEFORE UPDATE only, so DELETE is permitted once no FK-referencing runs remain.
        cur.execute(
            "DELETE FROM public.workflow_definitions WHERE id = %s",
            (DEFINITION_ID,),
        )
        # INSERT it already published, in one statement (never an UPDATE of a published row).
        cur.execute(
            """
            INSERT INTO public.workflow_definitions
                (id, slug, version, name, status, definition, created_by, is_system_global)
            VALUES (%s, %s, %s, %s, 'published', %s::jsonb, %s, false)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                DEFINITION_ID,
                SLUG,
                VERSION,
                NAME,
                target_def,
                USER_ID,
            ),
        )
        conn.commit()

        # Read-back assertion: the D-13 two-step shape landed — a `fill` llm_emit phase with the
        # render_template emitter, a prior `gather` llm_agent phase with search_documents, and the
        # template AssetRef.
        cur.execute(
            """
            SELECT
                definition->'phases'->1->>'slug',
                definition->'phases'->1->'config'->>'phase_type',
                definition->'phases'->1->'config'->>'emitter',
                definition->'phases'->0->>'slug',
                definition->'phases'->0->'config'->>'phase_type',
                definition->'phases'->0->'config'->'available_tools',
                definition->'assets'->0->>'kind'
            FROM public.workflow_definitions WHERE id = %s
            """,
            (DEFINITION_ID,),
        )
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"Definition read-back failed: no row at {DEFINITION_ID}")
        (
            fill_slug,
            fill_type,
            fill_emitter,
            gather_slug,
            gather_type,
            gather_tools,
            asset_kind,
        ) = row
        problems = []
        if fill_type != "llm_emit":
            problems.append(f"fill phase phase_type expected 'llm_emit', got {fill_type!r}")
        if fill_emitter != "render_template":
            problems.append(f"fill phase emitter expected 'render_template', got {fill_emitter!r}")
        if gather_type != "llm_agent":
            problems.append(f"gather phase phase_type expected 'llm_agent', got {gather_type!r}")
        if "search_documents" not in (gather_tools or []):
            problems.append(f"gather phase available_tools must include 'search_documents', got {gather_tools!r}")
        if asset_kind != "template":
            problems.append(f"assets[0].kind expected 'template', got {asset_kind!r}")
        if problems:
            raise SystemExit("Definition read-back failed:\n  - " + "\n  - ".join(problems))

        print(
            "READBACK OK: "
            f"phase0={gather_slug!r}/{gather_type} tools={gather_tools} | "
            f"phase1={fill_slug!r}/{fill_type} emitter={fill_emitter} | "
            f"asset.kind={asset_kind}"
        )


def emit_ids() -> None:
    """(Re)write definition_id + asset_id to uat_fixture_ids.json for the live UAT to consume."""
    payload = {
        "definition_id": DEFINITION_ID,
        "asset_id": STORAGE_PATH,       # the resolver keys off asset_id
        "storage_path": STORAGE_PATH,   # same key; a human reads storage_path
        "slug": SLUG,
        "version": VERSION,
        "filename": FILENAME,
        "user_id": USER_ID,
        "project_folder_id": RISK_FOLDER_ID,  # the bound retrieval scope (D-13 gather phase)
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    # 1. Validate the seeded JSON BEFORE touching the DB (fail fast on schema drift — T-101.1-05-02).
    target_def = _validate_definition()
    print("VALIDATE OK: WorkflowDefinition.model_validate() passed (D-13 two-step llm_emit shape)")

    # 2. DB re-seed (psycopg2 service-role to local :54322; idempotent DELETE-then-INSERT).
    conn = psycopg2.connect(_db_dsn())
    try:
        reseed_definition(conn, target_def)
    finally:
        conn.close()

    # 3. Emit the fixture IDs.
    emit_ids()

    print(
        f"SEEDED definition_id={DEFINITION_ID} asset_id={STORAGE_PATH} "
        f"project_folder_id={RISK_FOLDER_ID} (D-13 two-step: gather llm_agent -> fill llm_emit)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
