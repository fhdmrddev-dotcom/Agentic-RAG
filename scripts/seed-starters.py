"""Phase 143 (WF-01) Plan 03 — the Starter-library STORAGE seed + migration validator.

The 3 curated starter DEFINITIONS live in the SQL migration
``supabase/migrations/094_starter_workflows.sql`` (the ONLY path that can set
``is_global=true`` — mig 056 RLS; captured by ``full-schema.sql``). But a SQL migration
CANNOT place Storage bytes, and every starter is a template-fill workflow whose
``render_template`` emit resolves a bound ``.docx`` by raw Storage path. So this script owns
the two things the migration cannot:

  * ``--upload`` (default): re-home the 3 committed ``.docx`` templates to the SEED-user
    Storage prefix ``00000000-0000-0000-0000-000000000001/_library/<slug>.docx`` (D-143-4b),
    via a service-role client, with a byte round-trip assert. This is the physical bytes the
    migration's ``assets[].asset_id`` points at. Needs the local Supabase stack UP.
  * ``--validate-migration PATH``: a deterministic, NO-live-DB gate that parses the migration,
    extracts each ``::jsonb`` definition literal, and asserts the D-143-4b transforms held:
    the def ``model_validate``s as a ``WorkflowDefinition``, carries ``category='starter'``,
    has NO private project-folder binding, no phase carries a KB scope, and every
    ``assets[].asset_id`` sits under the seed-user ``_library/`` prefix. Exits non-zero on
    ANY failure — the plan's deterministic Pydantic gate for the seed rows.

It mirrors ``scripts/seed-pm-pack.py`` mechanic-for-mechanic (``parents[1]`` repo-root
bootstrap, ``load_dotenv(BACKEND_DIR/".env")``, the ``get_supabase()`` name-only secret
bootstrap, the ``upload_template`` byte round-trip, the ``_assert_slug`` path-traversal
guard) and DEVIATES on: the DEMO operator uid is swapped for the SEED system user
``00000000-...-01`` (the re-home target), and the DB half is storage-only + validate (the
canonical def INSERT lives in the migration, not here).

Security: the Supabase URL / service-role key are read NAME-ONLY from ``backend/.env`` via
dotenv — never hard-coded, never printed. Every Storage object is scoped to the seed-user
prefix. This file lives under repo-root ``scripts/`` (NOT ``backend/``, which uvicorn
--reload watches).

Run from the repo root:

    # validate the seed migration (no live DB, no secrets needed):
    backend/venv/Scripts/python.exe scripts/seed-starters.py --validate-migration supabase/migrations/094_starter_workflows.sql

    # upload the 3 re-homed templates (local Supabase stack must be UP):
    backend/venv/Scripts/python.exe scripts/seed-starters.py --upload
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

# scripts/seed-starters.py -> parents[1] == repo root (this script lives at the repo-root
# scripts/ dir, off the uvicorn --reload watched backend/ tree).
REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
TEMPLATES_DIR = REPO_ROOT / "scripts" / "pm-pack" / "templates"

# Make backend/ importable (WorkflowDefinition for --validate-migration), then load
# backend/.env so the service-role URL/key resolve for --upload. Secrets stay NAME-ONLY.
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")  # secrets stay name-only — never echoed

# ── Constants ───────────────────────────────────────────────────────────────────────
SEED_UID = "00000000-0000-0000-0000-000000000001"  # seed system user (mig 056/061) — re-home target
BUCKET = "workspace-files"  # the library-asset bucket (workspace_service.BUCKET_NAME)
MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"  # docx OOXML

# The 3 starter slugs -> the committed local template each re-homes. slug == filename stem
# for all 3, and the slug is the Storage key segment + the migration's assets[].filename.
STARTERS: dict[str, Path] = {
    "risk-register": TEMPLATES_DIR / "risk-register.docx",
    "weekly-status-report": TEMPLATES_DIR / "weekly-status-report.docx",
    "compliance-gap-report": TEMPLATES_DIR / "compliance-gap-report.docx",
}

_SLUG_RE = re.compile(r"^[a-z0-9-]+$")  # path-traversal guard for the Storage key


def _assert_slug(slug: str) -> str:
    """Path-traversal guard (mirror seed-pm-pack :118-125): each slug is an author-fixed
    constant; assert it matches ``^[a-z0-9-]+$`` BEFORE it is interpolated into the
    server-side Storage key. No user-supplied path component, no ``../``.
    """
    if not _SLUG_RE.match(slug):
        raise SystemExit(f"Unsafe slug {slug!r}: must match {_SLUG_RE.pattern}")
    return slug


def get_supabase():
    """Service-role client (mirrors dependencies.get_supabase()). Key name-only."""
    from supabase import create_client  # noqa: PLC0415  (lazy — --validate-migration needs no client)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        raise SystemExit(f"Missing env var(s) in backend/.env: {', '.join(missing)}")
    return create_client(url, key)


def upload_starter(supabase, local_path: Path, slug: str) -> str:
    """Upload the COMMITTED docx bytes to the seed-user Storage prefix; return the path
    string (which IS the migration's ``assets[].asset_id``). Mirrors
    ``seed-pm-pack.py:upload_template`` with ``DEMO_USER_ID`` swapped for ``SEED_UID`` — the
    re-home step D-143-4b needs. Uploads the committed bytes (NOT a re-build — python-docx
    output is not byte-deterministic), upsert so re-runs overwrite, then a download
    round-trip + byte-length assert (the resolver's ``_read_from_storage`` would succeed).
    """
    _assert_slug(slug)
    if not local_path.exists():
        raise SystemExit(
            f"Template not found: {local_path} "
            "(run backend/venv/Scripts/python.exe scripts/pm-pack/make_pm_templates.py first)."
        )
    data = local_path.read_bytes()
    path = f"{SEED_UID}/_library/{slug}.docx"

    storage = supabase.storage.from_(BUCKET)
    storage.upload(path, data, {"content-type": MIME, "upsert": "true"})
    downloaded = storage.download(path)
    if len(downloaded) != len(data):
        raise SystemExit(
            f"Storage round-trip byte length mismatch for {path}: uploaded {len(data)}, "
            f"downloaded {len(downloaded)}"
        )
    return path


def do_upload() -> int:
    """--upload mode: re-home all 3 committed templates to the seed-user _library prefix."""
    supabase = get_supabase()
    paths = {}
    for slug, local_path in STARTERS.items():
        paths[slug] = upload_starter(supabase, local_path, slug)
    # ids/paths only — no secret values.
    print("UPLOADED " + " ".join(f"{slug}={p}" for slug, p in paths.items()))
    return 0


# ── --validate-migration: deterministic, NO live DB ─────────────────────────────────

# Match each SQL string literal immediately followed by ``::jsonb`` and un-escape SQL
# doubled single-quotes. ``(?:[^']|'')*`` correctly spans a literal that may contain an
# escaped ``''`` (none today, but robust against a future prompt with an apostrophe).
_JSONB_LITERAL_RE = re.compile(r"'((?:[^']|'')*)'::jsonb", re.DOTALL)


def _extract_defs(sql_text: str) -> list[dict]:
    """Extract + parse each ``::jsonb`` definition literal from the migration SQL."""
    defs = []
    for raw in _JSONB_LITERAL_RE.findall(sql_text):
        defs.append(json.loads(raw.replace("''", "'")))
    return defs


def validate_migration(sql_path: Path) -> int:
    """Deterministic gate: every seed def model_validates + carries the D-143-4b transforms.

    Asserts per def: WorkflowDefinition.model_validate passes; category=='starter';
    NO private project-folder binding; no phase carries a KB scope; every assets[].asset_id
    sits under the seed-user ``_library/`` prefix. Exits non-zero on ANY failure.
    """
    from app.models.harness import WorkflowDefinition  # noqa: PLC0415

    if not sql_path.exists():
        alt = REPO_ROOT / sql_path
        if alt.exists():
            sql_path = alt
        else:
            raise SystemExit(f"Migration not found: {sql_path}")

    sql_text = sql_path.read_text(encoding="utf-8")
    defs = _extract_defs(sql_text)
    if not defs:
        raise SystemExit(f"No ::jsonb definition literals found in {sql_path}")

    prefix = f"{SEED_UID}/_library/"
    failures: list[str] = []
    for d in defs:
        slug = d.get("slug", "<unknown>")
        try:
            WorkflowDefinition.model_validate(d)
        except Exception as exc:  # noqa: BLE001 — surface the validation error verbatim
            failures.append(f"{slug}: model_validate failed: {exc}")
            continue
        if d.get("category") != "starter":
            failures.append(f"{slug}: category expected 'starter', got {d.get('category')!r}")
        if d.get("project_folder_id") is not None:
            failures.append(f"{slug}: must NOT bind a private project folder (D-143-4b)")
        for ph in d.get("phases", []):
            if ph.get("config", {}).get("folder_scope"):
                failures.append(f"{slug}: phase '{ph.get('slug')}' must NOT carry a KB scope (D-143-4b)")
        for a in d.get("assets", []) or []:
            asset_id = a.get("asset_id", "")
            if not asset_id.startswith(prefix):
                failures.append(f"{slug}: asset_id {asset_id!r} not under seed prefix {prefix!r}")

    if failures:
        print(f"VALIDATE-MIGRATION FAILED ({len(defs)} defs, {len(failures)} problem(s)):", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print(f"VALIDATE-MIGRATION OK: {len(defs)} starter defs valid, transformed, re-homed, strict-gated.")
    for d in defs:
        print(f"  - {d['slug']} -> {d['assets'][0]['asset_id']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Phase 143 Starter-library storage seed + migration validator.",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="upload the 3 re-homed templates to seed-user Storage (default action; needs local Supabase up)",
    )
    parser.add_argument(
        "--validate-migration",
        metavar="PATH",
        dest="validate_migration",
        help="validate the seed migration def JSONB (deterministic, no live DB)",
    )
    args = parser.parse_args()

    if args.validate_migration:
        return validate_migration(Path(args.validate_migration))
    # Default action = upload (the ONLY step a SQL migration cannot do).
    return do_upload()


if __name__ == "__main__":
    raise SystemExit(main())
