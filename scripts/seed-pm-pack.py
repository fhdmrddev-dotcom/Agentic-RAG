"""Seed the PM Flagship Content Pack into the LIVE local stack (opt-in, idempotent).

Phase 104 (PM-01) Plan 02. This is DATA/seed provisioning, NOT schema — there is NO
migration here (``llm_emit`` / ``render_template`` / ``assets[]`` / ``business_requirement``
are all already shipped from Phases 101/101.1/102). It ships the PM pack as authored
CONTENT on the generic harness primitives: ZERO PM-specific engine code, ZERO new route,
ZERO new migration.

It mirrors ``backend/tests/fixtures/seed_library_asset.py`` mechanic-for-mechanic
(dotenv NAME-ONLY bootstrap, service-role Supabase client, psycopg2 to the live local
Postgres :54322, ``{uid}/_library/<slug>.docx`` Storage upload with byte round-trip,
DELETE-then-INSERT published-def refresh, an ``*_ids.json`` manifest) and DEVIATES on:
  (a) ``parents[1]`` not ``parents[3]`` — this script lives at repo-root ``scripts/``;
  (b) the def JSONB is the 2-phase ``llm_agent``(search_documents)→``llm_emit``
      (render_template) shape (the S-5 DRIFT FLAG — see ``build_status_def`` / ``build_risk_def``);
  (c) a NET-NEW corpus-ingest step before the def INSERT (the Plan-01 sample corpus);
  (d) a NET-NEW ``assert_demo_uid`` pre-flight against the live ``auth.users`` row.

It provisions the whole pack atomically + idempotently:
  1. The per-account demo folder "PM Demo Project (sample data)" (is_global=false).
  2. The 5 Plan-01 markdown corpus docs ingested into that folder (sha256 dedup so
     re-runs short-circuit; ONE live OpenAI embeddings call per NEW doc).
  3. The 2 Plan-01 ``.docx`` templates uploaded to Storage bucket ``workspace-files`` at
     ``{demo_uid}/_library/<slug>.docx`` (that path string IS the ``AssetRef.asset_id``).
  4. The 2 published ``workflow_definitions`` rows (the 2-phase fill defs with ``assets[]``
     baked in, strict gates, a business_requirement, project_folder_id, is_global=false)
     via DELETE-then-INSERT (the immutability trigger blocks UPDATE on a published row).
  5. ``scripts/pm-pack/pm_pack_ids.json`` — the manifest the verifier + Plan-03 scoreboard
     consume (def ids, asset paths, folder id).

Corpus ingest path (RESEARCH Q4 — both are sanctioned by CONTEXT D-104-3): this script
uses the IN-PROCESS ``documents._upload_pipeline`` (storage upload + extract + ingest +
embeddings) against a service-role supabase + the demo uid — byte-equivalent rows to a
human upload, with no running backend required. The live-embedding step is gated behind
the ``SEED_PM_RUN_INGEST`` env var: unset (the default) seeds the corpus DOCUMENT rows
only (status='pending', dedup-safe) WITHOUT firing extraction/embeddings; set it to "1"
to drive the full ingest pipeline (the operator-driven path at the Plan-03 checkpoint).

Security (threats T-104-02-03/-06/-07): the Supabase URL / service-role key / OpenAI key
/ DB DSN are read NAME-ONLY from backend/.env via dotenv — never hard-coded, never printed
(the summary line prints ids/paths only). Every row + Storage object is scoped to the demo
uid (is_global=false, RLS-correct). The seed ABORTS LOUDLY if DEMO_USER_ID does not match
the live ``auth.users`` id for fhdmrd@gmail.com (a stale carried-forward uid after a local
Supabase reset would seed the WRONG RLS owner — fail-closed, never a silent wrong-owner seed).

Run from the repo root (the local Supabase stack must be UP — `supabase start`):

    backend/venv/Scripts/python.exe scripts/seed-pm-pack.py

To also run the live corpus ingest (fires OpenAI embeddings — operator-driven):

    SEED_PM_RUN_INGEST=1 backend/venv/Scripts/python.exe scripts/seed-pm-pack.py
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path

# scripts/seed-pm-pack.py -> parents[1] == repo root (NOT parents[3]; this script
# lives at the repo-root scripts/ dir, off the uvicorn --reload watched backend/ tree).
REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
PM_PACK_DIR = REPO_ROOT / "scripts" / "pm-pack"
TEMPLATES_DIR = PM_PACK_DIR / "templates"
CORPUS_DIR = PM_PACK_DIR / "sample-corpus"
OUT_PATH = PM_PACK_DIR / "pm_pack_ids.json"

# Make backend/ importable, then load backend/.env so the service-role URL/key + the
# OpenAI key resolve (mirrors the spike-097 / seed_library_asset bootstrap). Secrets
# stay NAME-ONLY — never hard-coded, never echoed.
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")  # secrets stay name-only — never echoed

import psycopg2  # noqa: E402
from supabase import Client, create_client  # noqa: E402  (mirrors dependencies.get_supabase)

# ── Constants (locked demo user from STATE.md / spike-097) ─────────────────────────
DEMO_USER_ID = "d8a54002-6a29-4b88-b918-cff2aa4a06d5"  # fhdmrd@gmail.com — the local dev login
DEMO_USER_EMAIL = "fhdmrd@gmail.com"
DEMO_FOLDER_NAME = "PM Demo Project (sample data)"  # clearly-labeled, per-account (D-104-3)

BUCKET = "workspace-files"  # reuse workspace_service.BUCKET_NAME (the library-asset bucket)
MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"  # docx OOXML

# Stable fixed def UUIDs so re-runs are idempotent (DELETE-then-INSERT keyed on these).
STATUS_DEF_ID = "00000000-0000-0000-0000-0000001040a0"
RISK_DEF_ID = "00000000-0000-0000-0000-0000001040a1"
DEF_VERSION = 1

_SLUG_RE = re.compile(r"^[a-z0-9-]+$")  # path-traversal guard for the Storage key

# Template specs: (slug, local docx path, AssetRef.filename). The slug becomes the
# Storage key segment; the local path is the committed Plan-01 artifact (uploaded
# byte-for-byte — python-docx output is NOT byte-deterministic, so we upload the
# COMMITTED bytes, never re-build at seed time; see 104-01-SUMMARY caveat).
TEMPLATE_SPECS = [
    {
        "slug": "pm-weekly-status-report",
        "local_path": TEMPLATES_DIR / "weekly-status-report.docx",
        "filename": "weekly-status-report.docx",
    },
    {
        "slug": "pm-risk-register",
        "local_path": TEMPLATES_DIR / "risk-register.docx",
        "filename": "risk-register.docx",
    },
]


def _assert_slug(slug: str) -> str:
    """Path-traversal guard (T-104-02-01): each slug is an author-fixed constant; assert
    it matches ``^[a-z0-9-]+$`` BEFORE it is interpolated into the server-side Storage key.
    No user-supplied path component, no ``../``.
    """
    if not _SLUG_RE.match(slug):
        raise SystemExit(f"Unsafe slug {slug!r}: must match {_SLUG_RE.pattern}")
    return slug


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


def assert_demo_uid(conn) -> None:
    """NET-NEW RLS-owner pre-flight (T-104-02-07) — run FIRST in main(), before any write.

    A stale carried-forward ``DEMO_USER_ID`` (local Supabase reset since spike-097) would
    silently seed the WHOLE pack under the WRONG RLS owner — corpus/templates/defs would be
    unreachable for the real login and rows would carry an orphan/foreign owner id. So:
    look up the live ``auth.users`` id for ``DEMO_USER_EMAIL`` and assert it equals the
    constant. Abort LOUDLY on a missing row or a mismatch (fail-closed — never a silent
    wrong-owner seed).
    """
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM auth.users WHERE email = %s", (DEMO_USER_EMAIL,))
        rows = cur.fetchall()
    if not rows:
        raise SystemExit(
            f"No auth.users row for {DEMO_USER_EMAIL}; cannot verify DEMO_USER_ID. "
            "Is the local Supabase stack up and seeded with the dev login? "
            "(Sign in once via the app to create the auth.users row.)"
        )
    if len(rows) > 1:
        raise SystemExit(
            f"Expected exactly one auth.users row for {DEMO_USER_EMAIL}, found {len(rows)}; "
            "cannot safely resolve the RLS owner."
        )
    found = str(rows[0][0])
    if found != DEMO_USER_ID:
        raise SystemExit(
            f"DEMO_USER_ID {DEMO_USER_ID} does not match auth.users id {found!r} for "
            f"{DEMO_USER_EMAIL}; local Supabase was likely reset — update DEMO_USER_ID before "
            "seeding (seeding the wrong owner makes the pack unreachable for the real login)."
        )


def resolve_demo_folder(conn) -> str:
    """Resolve (or create) the per-account demo folder. Returns its id string.

    Per-account (is_global=false) — NEVER global (T-104-02-02: a global-folder-subtree doc
    surfaces in EVERY tenant's search_documents with no exclusion mechanism — the verified
    pollution mechanism, migration 019). Folders are RLS-scoped on user_id; the columns
    match full-schema.sql:434-442 (id/user_id/name/parent_id/is_global/created_at/updated_at).
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM public.folders "
            "WHERE user_id = %s AND name = %s AND is_global = false "
            "ORDER BY created_at ASC LIMIT 1",
            (DEMO_USER_ID, DEMO_FOLDER_NAME),
        )
        row = cur.fetchone()
        if row is not None:
            return str(row[0])

        cur.execute(
            "INSERT INTO public.folders (user_id, name, parent_id, is_global) "
            "VALUES (%s, %s, NULL, false) RETURNING id",
            (DEMO_USER_ID, DEMO_FOLDER_NAME),
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return str(new_id)


def _corpus_files() -> list[Path]:
    """The Plan-01 sample-corpus markdown docs (sorted for deterministic ordering)."""
    if not CORPUS_DIR.exists():
        raise SystemExit(f"Corpus dir not found: {CORPUS_DIR} (run Plan-01 make_pm_corpus.py first).")
    files = sorted(CORPUS_DIR.glob("*.md"))
    if not files:
        raise SystemExit(f"No *.md corpus docs found under {CORPUS_DIR}.")
    return files


def ingest_corpus(supabase: Client, conn, folder_id: str) -> list[str]:
    """Ingest the Plan-01 markdown corpus into the demo folder. Returns the document ids.

    Mirrors documents.upload_document's mechanics (sha256 dedup folder-scoped, the
    documents-row INSERT shape) but in-process with a service-role supabase scoped to the
    demo uid. The HEAVY extract+embed step (documents._upload_pipeline) fires ONE live
    OpenAI embeddings call per NEW doc and is GATED behind SEED_PM_RUN_INGEST: unset =>
    seed the document rows only (status='pending', dedup-safe — no embeddings); "1" =>
    drive the full pipeline. The dedup SELECT makes the whole step idempotent either way.
    """
    from uuid import uuid4

    run_ingest = os.environ.get("SEED_PM_RUN_INGEST") == "1"
    md_mime = "text/markdown"
    doc_ids: list[str] = []

    for path in _corpus_files():
        raw = path.read_bytes()
        content_hash = hashlib.sha256(raw).hexdigest()
        filename = path.name

        # Folder-scoped sha256 dedup (documents.py:404-423) — re-runs short-circuit.
        existing = (
            supabase.table("documents")
            .select("id")
            .eq("user_id", DEMO_USER_ID)
            .eq("content_hash", content_hash)
            .eq("status", "completed")
            .eq("is_latest", True)
            .eq("folder_id", folder_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            doc_ids.append(existing.data[0]["id"])
            continue

        document_id = str(uuid4())
        storage_path = f"{DEMO_USER_ID}/{document_id}/{filename}"
        doc_data = {
            "id": document_id,
            "user_id": DEMO_USER_ID,
            "filename": filename,
            "file_path": storage_path,
            "file_size": len(raw),
            "mime_type": md_mime,
            "status": "pending",
            "content_hash": content_hash,
            "folder_id": folder_id,
            "version_number": 1,
            "is_latest": True,
        }
        supabase.table("documents").insert(doc_data).execute()
        doc_ids.append(document_id)

        if run_ingest:
            # Drive the real ingest pipeline (storage upload + extract + embeddings).
            from app.api.documents import _upload_pipeline  # noqa: PLC0415

            _upload_pipeline(
                document_id=document_id,
                raw=raw,
                mime_type=md_mime,
                filename=filename,
                user_id=DEMO_USER_ID,
                storage_path=storage_path,
                supabase=supabase,
                engines_dict=None,
            )

    return doc_ids


def upload_template(supabase: Client, local_path: Path, slug: str) -> str:
    """Upload the COMMITTED docx bytes to Storage; return the path string (the AssetRef.asset_id).

    Builds ``path = f"{DEMO_USER_ID}/_library/{slug}.docx"`` (the leading folder MUST equal
    the owner uid for RLS — D-104-5). Uploads the committed Plan-01 bytes (NOT a re-build —
    python-docx output is not byte-deterministic), upsert so re-runs overwrite, then a
    download round-trip + byte-length assert (the resolver's _read_from_storage would succeed).
    """
    _assert_slug(slug)
    if not local_path.exists():
        raise SystemExit(f"Template not found: {local_path} (run Plan-01 make_pm_templates.py first).")
    data = local_path.read_bytes()
    path = f"{DEMO_USER_ID}/_library/{slug}.docx"

    storage = supabase.storage.from_(BUCKET)
    storage.upload(path, data, {"content-type": MIME, "upsert": "true"})
    downloaded = storage.download(path)
    if len(downloaded) != len(data):
        raise SystemExit(
            f"Storage round-trip byte length mismatch for {path}: uploaded {len(data)}, "
            f"downloaded {len(downloaded)}"
        )
    return path


# ── Task 2: def authoring + DELETE-then-INSERT + manifest ───────────────────────────


def _build_def(
    *,
    def_id: str,
    slug: str,
    name: str,
    folder_id: str,
    asset_path: str,
    asset_filename: str,
    business_requirement: str,
    retrieve_prompt: str,
    emit_prompt: str,
) -> dict:
    """Author the FULL WorkflowDefinition JSONB to the 2-phase fill shape (S-5 DRIFT FLAG).

    Phase[0] ``llm_agent`` with ``available_tools:["search_documents"]`` retrieves the KB
    evidence (its source_refs build the citation valid-id set). Phase[1] ``llm_emit``
    (``emitter:"render_template"``) renders the bound template — ``render_template`` is in
    NO phase's available_tools because the emit resolves the ``assets[kind=="template"]``
    entry SERVER-SIDE via ``_emit_bound_asset_ref`` (phase_types.py:724-741), so the model
    never selects it. Both phases set ``folder_scope:[folder_id]`` → ``project_folder_id``
    MUST be set (the ``_folder_scope_requires_project`` model_validator). ``output_file_valid``
    carries an EMPTY ``config:{}`` (the emit IS the producer; the validator re-opens the
    produced file — validator_kinds.py:285-286,315-339; the config["path"] branch at :287-313
    is the author-supplied WR-07 path, NOT needed here). Every gate ``on_failure:"fail_run"``
    (no interactive/ask_user phase — the publish gauntlet pre-blocks those, S-8).
    """
    return {
        "slug": slug,
        "version": DEF_VERSION,
        "name": name,
        "status": "published",
        "project_folder_id": folder_id,
        "business_requirement": business_requirement,
        "phases": [
            {
                "slug": "retrieve",
                "phase_index": 0,
                "config": {
                    "phase_type": "llm_agent",
                    "prompt": retrieve_prompt,
                    "available_tools": ["search_documents"],
                    "folder_scope": [folder_id],
                },
                "validators": [],
            },
            {
                "slug": "emit",
                "phase_index": 1,
                "config": {
                    "phase_type": "llm_emit",
                    "emitter": "render_template",
                    "prompt": emit_prompt,
                    "folder_scope": [folder_id],
                    "citation_policy": "strict",
                    "integrity_policy": "strict",
                },
                "validators": [
                    {
                        "kind": "citations_required",
                        "config": {"mode": "deterministic"},
                        "on_failure": "fail_run",
                    },
                    {
                        "kind": "output_file_valid",
                        "config": {},
                        "on_failure": "fail_run",
                    },
                ],
            },
        ],
        "assets": [
            {
                "asset_id": asset_path,
                "filename": asset_filename,
                "kind": "template",
                "mime": MIME,
            }
        ],
    }


def build_status_def(folder_id: str, asset_path: str) -> dict:
    """The Weekly Status Report fill def (the SC#2 headline + SC#10 scoreboard target)."""
    return _build_def(
        def_id=STATUS_DEF_ID,
        slug="pm-weekly-status-report",
        name="Weekly Status Report",
        folder_id=folder_id,
        asset_path=asset_path,
        asset_filename="weekly-status-report.docx",
        business_requirement=(
            "Produce a cited weekly status report from the project KB with overall RAG "
            "status, accomplishments this period, planned work next period, risks/blockers, "
            "and key milestones. Every reported value must be grounded in the project's "
            "knowledge base; leave a value null where the sources do not support it."
        ),
        retrieve_prompt=(
            "Search the project KB for the latest reporting-period status: accomplishments, "
            "planned next steps, risks/blockers, milestones, and the overall RAG status. "
            "Gather the source passages that support each value the status report will fill."
        ),
        emit_prompt=(
            "Fill the weekly-status-report template from the retrieved KB evidence. Cite "
            "every non-null value against its source chunk; set a value to null where the "
            "sources do not support it (do not invent)."
        ),
    )


def build_risk_def(folder_id: str, asset_path: str) -> dict:
    """The Risk Register fill def (full publishable; no full scoreboard required, D-104-2)."""
    return _build_def(
        def_id=RISK_DEF_ID,
        slug="pm-risk-register",
        name="Risk Register",
        folder_id=folder_id,
        asset_path=asset_path,
        asset_filename="risk-register.docx",
        business_requirement=(
            "Produce a cited project risk register from the project KB: one row per "
            "identified risk with id, description, category, probability, impact, owner, "
            "mitigation, and status — every cell grounded in the knowledge base. The Score "
            "is computed by the template (probability x impact); leave any cell null where "
            "the sources do not support a value."
        ),
        retrieve_prompt=(
            "Search the project KB for all identified project risks: for each risk gather "
            "its description, category, probability, impact, owner, mitigation, and current "
            "status, with the source passages that support each field."
        ),
        emit_prompt=(
            "Fill the risk-register template's rows from the retrieved KB evidence — one "
            "row per risk with the 8 cited columns (id, description, category, probability, "
            "impact, owner, mitigation, status). Cite every non-null cell against its source "
            "chunk; set a cell to null where the sources do not support it. Do NOT emit a "
            "Score — the template computes it (probability x impact) from the cited cells."
        ),
    )


def _validate_def(def_dict: dict) -> None:
    """Validate a def dict through the live Pydantic model BEFORE the INSERT — a mis-shaped
    def must never land. Exercises the model_validator (folder_scope ⊆ project_folder_id)
    + the discriminated-union phase configs. Raises (aborts the seed) on a ValidationError.
    """
    from app.models.harness import WorkflowDefinition  # noqa: PLC0415

    WorkflowDefinition.model_validate(def_dict)


def upsert_definition(conn, def_id: str, def_dict: dict) -> None:
    """DELETE-then-INSERT the published def (S-3 — the immutability trigger blocks UPDATE).

    SELECT the existing ``definition::text``; if a row exists and differs, DELETE it (the
    BEFORE-UPDATE immutability trigger is UPDATE-only — DELETE is allowed), then INSERT the
    published row (ON CONFLICT (id) DO NOTHING covers a concurrent insert). Read-back assert
    the 2-phase shape: assets[0].kind=='template', the retrieve phase declares
    'search_documents', the emit phase is 'llm_emit', business_requirement is non-null.
    Never UPDATEs a published row.
    """
    target_def = json.dumps(def_dict)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT definition::text FROM public.workflow_definitions WHERE id = %s",
            (def_id,),
        )
        existing = cur.fetchone()
        if existing is not None and existing[0] != target_def:
            # Stale published row — DELETE so the corrected def can be re-inserted.
            # DELETE is permitted (the immutability trigger is BEFORE UPDATE only).
            cur.execute(
                "DELETE FROM public.workflow_definitions WHERE id = %s",
                (def_id,),
            )

        cur.execute(
            """
            INSERT INTO public.workflow_definitions
                (id, slug, version, name, status, definition, created_by, is_global)
            VALUES (%s, %s, %s, %s, 'published', %s::jsonb, %s, false)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                def_id,
                def_dict["slug"],
                def_dict["version"],
                def_dict["name"],
                target_def,
                DEMO_USER_ID,
            ),
        )
        conn.commit()

        # Read-back assert the 2-phase shape (S-5 — NOT the 1-phase render-on-agent assert).
        cur.execute(
            "SELECT definition->'assets'->0->>'kind', "
            "definition->'phases'->0->'config'->'available_tools', "
            "definition->'phases'->1->'config'->>'phase_type', "
            "definition->>'business_requirement' "
            "FROM public.workflow_definitions WHERE id = %s",
            (def_id,),
        )
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"Definition read-back failed: no row at id={def_id}")
        asset_kind, retrieve_tools, emit_type, biz_req = row
        if asset_kind != "template":
            raise SystemExit(f"Read-back: assets[0].kind expected 'template', got {asset_kind!r}")
        if "search_documents" not in (retrieve_tools or []):
            raise SystemExit(
                f"Read-back: retrieve phase available_tools must include 'search_documents', "
                f"got {retrieve_tools!r}"
            )
        if emit_type != "llm_emit":
            raise SystemExit(f"Read-back: emit phase phase_type expected 'llm_emit', got {emit_type!r}")
        if not biz_req:
            raise SystemExit("Read-back: business_requirement must be non-null")


def emit_ids(folder_id: str, status_asset: str, risk_asset: str) -> None:
    """Emit scripts/pm-pack/pm_pack_ids.json — the manifest the verifier + Plan-03 scoreboard
    consume (def ids, asset paths, folder id). NO secrets — ids/paths only.
    """
    payload = {
        "demo_user_id": DEMO_USER_ID,
        "demo_folder_id": folder_id,
        "definitions": [
            {
                "def_id": STATUS_DEF_ID,
                "slug": "pm-weekly-status-report",
                "version": DEF_VERSION,
                "asset_id": status_asset,
                "filename": "weekly-status-report.docx",
            },
            {
                "def_id": RISK_DEF_ID,
                "slug": "pm-risk-register",
                "version": DEF_VERSION,
                "asset_id": risk_asset,
                "filename": "risk-register.docx",
            },
        ],
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    supabase = get_supabase()
    conn = psycopg2.connect(_db_dsn())
    try:
        # 0. RLS-owner pre-flight FIRST — abort loudly on a stale DEMO_USER_ID.
        assert_demo_uid(conn)

        # 1. Per-account demo folder (is_global=false).
        folder_id = resolve_demo_folder(conn)

        # 2. Ingest the Plan-01 corpus (embeddings gated behind SEED_PM_RUN_INGEST).
        doc_ids = ingest_corpus(supabase, conn, folder_id)

        # 3. Upload both committed templates; capture the asset paths.
        asset_paths = {
            spec["slug"]: upload_template(supabase, spec["local_path"], spec["slug"])
            for spec in TEMPLATE_SPECS
        }

        # 4. Build + validate + upsert both 2-phase defs (DELETE-then-INSERT).
        status_asset = asset_paths["pm-weekly-status-report"]
        risk_asset = asset_paths["pm-risk-register"]
        status_def = build_status_def(folder_id, status_asset)
        risk_def = build_risk_def(folder_id, risk_asset)
        _validate_def(status_def)  # abort the seed on a mis-shaped def (never INSERT it)
        _validate_def(risk_def)
        upsert_definition(conn, STATUS_DEF_ID, status_def)
        upsert_definition(conn, RISK_DEF_ID, risk_def)

        # 5. Emit the manifest for the verifier + Plan-03 scoreboard (ids/paths only).
        emit_ids(folder_id, status_asset, risk_asset)

        print(
            f"SEEDED folder_id={folder_id} docs={len(doc_ids)} "
            f"status_def={STATUS_DEF_ID} status_asset={status_asset} "
            f"risk_def={RISK_DEF_ID} risk_asset={risk_asset} manifest={OUT_PATH.name}"
        )
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
