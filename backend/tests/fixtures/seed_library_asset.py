"""Seed the trusted-path (library / docxtpl) UAT fixture into the LIVE local stack.

Phase 101 Plan 01 Task 4 (D-09 / 101-VALIDATION.md Wave 0 Requirements bullet 4).

This is DATA seeding, NOT schema — there is NO migration here (AssetRef / assets[]
are already locked from Phase 098). It mirrors the Phase 097/100 fixture-seeding
convention: psycopg2 direct to the live LOCAL Postgres (:54322) + the service-role
Supabase Storage API (:54321). Service-role bypasses RLS; the script is idempotent
(safe to re-run) and scopes every row to the test user.

It provisions the trusted-path fixture the Plan-03 resolver (``resolve_template_source``)
and the cross-provider scoreboard fill against:

  1. A real Storage object in the ``workspace-files`` bucket at a ``{user_id}/...``
     key (the RLS foldername[1]=uid convention) — this key IS the AssetRef.asset_id
     the resolver downloads via ``_read_from_storage(supabase, asset_ref.asset_id)``.
  2. A PUBLISHED ``WorkflowDefinition`` row whose ``definition`` jsonb carries an
     ``assets`` array with one ``AssetRef`` pointing at that Storage object.
  3. (Best-effort) a no-TTL ``workspace_files`` marker row (kind='agent',
     expires_at=NULL) distinguishing the library asset from an ephemeral
     template_input upload.
  4. The fixture IDs emitted to ``uat_fixture_ids.json`` for the live UAT to consume.

Security (threats T-101-01-04/05): the Supabase URL / service-role key / DB DSN are
read NAME-ONLY from backend/.env via the existing dotenv loader — never hard-coded,
never printed. The definition is scoped to created_by=<test user> (is_system_global=false)
and the Storage key to {user_id}/... — LOCAL-dev-only fixture data, no PII.

Run from the repo root (the local Supabase stack must be UP — `supabase start`):

    backend/venv/Scripts/python.exe backend/tests/fixtures/seed_library_asset.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# backend/tests/fixtures/seed_library_asset.py -> parents[3] == repo root
REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"
OUT_PATH = Path(__file__).resolve().parent / "uat_fixture_ids.json"

# Make backend/ importable, then load backend/.env so the service-role URL/key
# resolve (mirrors the spike-097 bootstrap). Secrets stay name-only.
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")  # secrets stay name-only — never echoed

import psycopg2  # noqa: E402
from supabase import Client, create_client  # noqa: E402  (mirrors dependencies.get_supabase)

# ── Constants (locked test user from STATE.md / spike-097) ─────────────────────
USER_ID = "d8a54002-6a29-4b88-b918-cff2aa4a06d5"  # fhdmrd@gmail.com — the local dev login
SLUG = "risk-register-fill-101uat"
VERSION = 1
NAME = "Risk Register Fill (101 UAT)"
BUCKET = "workspace-files"  # reuse workspace_service.BUCKET_NAME
STORAGE_PATH = f"{USER_ID}/_library/risk-register-101uat.docx"  # this string IS the AssetRef.asset_id
FILENAME = "risk-register.docx"
MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
DEFINITION_ID = "00000000-0000-0000-0000-0000000101a0"  # stable so re-runs are idempotent

# Reuse the Task-1 fixture; fall back to the spike template if absent.
_TASK1_DOCX = REPO_ROOT / "backend" / "tests" / "fixtures" / "templates" / "risk-register.docx"
_SPIKE_DOCX = REPO_ROOT / "scripts" / "spike-097" / "templates" / "risk-register.docx"

# The FULL WorkflowDefinition shape that model_validate() round-trips. The `assets`
# array carries one AssetRef (asset_id/filename/kind/mime — harness.py:167-171).
DEFINITION_JSON = {
    "slug": SLUG,
    "version": VERSION,
    "name": NAME,
    "status": "published",
    "phases": [
        {
            "slug": "fill",
            "phase_index": 0,
            "config": {
                "phase_type": "llm_agent",
                "prompt": "Fill the risk-register template from the bound KB.",
                # 101-06: the fill flow needs BOTH tools — search_documents to retrieve
                # the KB content the cited field-map draws from, and render_template to
                # actually fill the template. WITHOUT render_template here, _effective_tools
                # never whitelists it, so _phase_tools_override never admits the
                # RENDER_TEMPLATE_TOOL schema and the model can't call the tool (WR-01).
                # available_tools is a REQUIRED field on LlmAgentPhaseConfig (no default),
                # so a fill phase MUST declare it — this also fixes the prior fixture
                # which omitted it and would fail model_validate().
                "available_tools": ["search_documents", "render_template"],
            },
            "validators": [],
        }
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
    """Local-stack DSN — env override or the standard local default."""
    return os.environ.get("LOCAL_DB_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")


def get_supabase() -> Client:
    """Service-role client (mirrors dependencies.get_supabase()). Key name-only."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        raise SystemExit(f"Missing env var(s) in backend/.env: {', '.join(missing)}")
    return create_client(url, key)


def _template_bytes() -> bytes:
    """Read the fixture docx bytes (Task-1 fixture preferred, spike fallback)."""
    src = _TASK1_DOCX if _TASK1_DOCX.exists() else _SPIKE_DOCX
    if not src.exists():
        raise SystemExit(
            f"No template fixture found. Looked for {_TASK1_DOCX} and {_SPIKE_DOCX}. "
            "Run make_fixtures.py first (Task 1)."
        )
    return src.read_bytes()


def upload_template(supabase: Client, data: bytes) -> None:
    """Step 1 — upload the template bytes to Storage (upsert so re-runs overwrite).

    Confirm the object exists afterward via a download whose byte length matches.
    """
    storage = supabase.storage.from_(BUCKET)
    storage.upload(STORAGE_PATH, data, {"content-type": MIME, "upsert": "true"})
    # Confirm the object exists (the resolver's _read_from_storage would succeed).
    downloaded = storage.download(STORAGE_PATH)
    if len(downloaded) != len(data):
        raise SystemExit(
            f"Storage round-trip byte length mismatch: uploaded {len(data)}, "
            f"downloaded {len(downloaded)}"
        )


def upsert_definition(conn) -> None:
    """Step 2 — INSERT the PUBLISHED WorkflowDefinition row (psycopg2, service-role).

    INSERT it already published in ONE statement. The 056/067 immutable-on-publish
    trigger is a BEFORE-UPDATE trigger that blocks authored-column UPDATEs of a
    published row — but DELETE is allowed. So this fixture seeder is DELETE-then-INSERT
    idempotent: if a row at DEFINITION_ID already exists but carries a STALE definition
    (e.g. the pre-101-06 fill config WITHOUT `available_tools`), DELETE it first, then
    re-INSERT the corrected definition. This is LOCAL-dev fixture data scoped to the
    test user — safe to replace. A fresh insert simply lands the corrected row.

    101-06: the fill phase config now DECLARES `available_tools: [search_documents,
    render_template]` (DEFINITION_JSON). Without a refresh, an old published row would
    keep the old config and the live UAT would still see render_template unadmitted.
    """
    target_def = json.dumps(DEFINITION_JSON)
    with conn.cursor() as cur:
        # Refresh a STALE fixture row (different definition jsonb) — DELETE-then-reinsert.
        cur.execute(
            "SELECT definition::text FROM public.workflow_definitions WHERE id = %s",
            (DEFINITION_ID,),
        )
        existing = cur.fetchone()
        if existing is not None and existing[0] != target_def:
            # Stale fixture row — drop it so the corrected definition can be inserted.
            # DELETE is permitted (the immutability trigger is BEFORE UPDATE only).
            cur.execute(
                "DELETE FROM public.workflow_definitions WHERE id = %s",
                (DEFINITION_ID,),
            )

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
        # Secondary idempotency key: a row already at (slug, version) under a
        # different id is also acceptable — DO NOTHING covers the unique constraint.
        conn.commit()

        # Read-back assertion: the row exists, carries the one-entry assets[], AND the
        # fill phase now declares render_template in available_tools (101-06).
        cur.execute(
            "SELECT definition->'assets'->0->>'filename', "
            "definition->'phases'->0->'config'->'available_tools' "
            "FROM public.workflow_definitions WHERE id = %s",
            (DEFINITION_ID,),
        )
        row = cur.fetchone()
        if not row or row[0] != FILENAME:
            raise SystemExit(
                f"Definition read-back failed: expected assets[0].filename={FILENAME!r}, "
                f"got {row}"
            )
        tools = row[1] or []
        if "render_template" not in tools:
            raise SystemExit(
                "Definition read-back failed: fill phase available_tools must include "
                f"'render_template' (101-06 WR-01), got {tools!r}"
            )


def seed_workspace_file_marker(conn) -> str | None:
    """Step 3 (best-effort) — a no-TTL workspace_files marker row for the library
    asset (kind='agent', expires_at=NULL) so the "no-TTL distinguishes it from an
    ephemeral template_input" contract holds. workspace_files.thread_id is NOT NULL,
    so anchor to the newest thread owned by USER_ID; if none exists, SKIP (the
    Plan-03 library branch reads Storage directly by asset_id and does not require
    this row). Returns the workspace_file id or None.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM threads WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (USER_ID,),
        )
        trow = cur.fetchone()
        if not trow:
            return None  # no thread to anchor — skip (not required for the trusted-path UAT)
        thread_id = trow[0]

        cur.execute(
            """
            INSERT INTO public.workspace_files
                (thread_id, path, size_bytes, mime_type, content_storage_path,
                 created_by, kind, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'agent', NULL)
            ON CONFLICT (thread_id, path) DO NOTHING
            RETURNING id
            """,
            (
                thread_id,
                "_library/risk-register-101uat.docx",
                0,  # marker row; the real bytes live in Storage at STORAGE_PATH
                MIME,
                STORAGE_PATH,
                USER_ID,
            ),
        )
        ins = cur.fetchone()
        conn.commit()
        if ins:
            return str(ins[0])
        # Already present (DO NOTHING) — read back its id.
        cur.execute(
            "SELECT id FROM public.workspace_files WHERE thread_id = %s AND path = %s",
            (thread_id, "_library/risk-register-101uat.docx"),
        )
        existing = cur.fetchone()
        return str(existing[0]) if existing else None


def emit_ids(workspace_file_id: str | None) -> None:
    """Step 4 — emit uat_fixture_ids.json for the Plan-03 resolver + the scoreboard."""
    payload = {
        "definition_id": DEFINITION_ID,
        "asset_id": STORAGE_PATH,       # the resolver keys off asset_id
        "storage_path": STORAGE_PATH,   # same key; a human reads storage_path
        "slug": SLUG,
        "version": VERSION,
        "filename": FILENAME,
        "user_id": USER_ID,
        "workspace_file_id": workspace_file_id,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    data = _template_bytes()
    supabase = get_supabase()

    # 1. Storage upload (idempotent upsert).
    upload_template(supabase, data)

    # 2 + 3. DB seed (psycopg2 service-role; idempotent).
    conn = psycopg2.connect(_db_dsn())
    try:
        upsert_definition(conn)
        workspace_file_id = seed_workspace_file_marker(conn)
    finally:
        conn.close()

    # 4. Emit the fixture IDs.
    emit_ids(workspace_file_id)

    print(
        f"SEEDED definition_id={DEFINITION_ID} asset_id={STORAGE_PATH} "
        f"storage_path={STORAGE_PATH} workspace_file_id={workspace_file_id}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
