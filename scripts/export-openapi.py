#!/usr/bin/env python3
"""Phase 276 (DOCS-03) — export the backend's OpenAPI document to the committed snapshot.

Run it with the backend virtualenv, from the repository root::

    backend/venv/Scripts/python scripts/export-openapi.py

then rebuild the public spec and commit both files::

    node scripts/build-public-openapi.cjs

Writes ``docs/public/api/openapi.snapshot.json`` (``json.dump(..., indent=1)``, ASCII-escaped,
no trailing newline — the committed formatting). No server, no database, no network.

**Why the FastAPI CLASS method and not ``app.openapi()``.** ``main.py`` replaces the instance's
``openapi`` with ``build_canvas_aware_openapi(app)``, which filters the canvas surface while the
canvas flag reads off — and on a cold settings read it fails CLOSED, so it would export a
FILTERED document. ``FastAPI.openapi(app)`` is the unfiltered generator, independent of any flag.

``build_snapshot()`` is the ONE home of the generation: the backend drift test
(``backend/tests/unit/test_276_openapi_snapshot_fresh.py``) loads it from this file, so the test
and the export can never disagree.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# scripts/<this file> -> parents[1] == repo root. Put backend/ on the path so `app` resolves.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

SNAPSHOT_PATH = _REPO_ROOT / "docs" / "public" / "api" / "openapi.snapshot.json"
_TEST_PREFIX = "/__test__"


def build_snapshot() -> dict:
    """The full, unfiltered OpenAPI document, minus test-fixture routes."""
    from fastapi import FastAPI

    from app.main import app  # noqa: E402  (path setup must precede the import)

    doc = FastAPI.openapi(app)
    # Never mutate FastAPI's memoized document — work on a copy.
    doc = json.loads(json.dumps(doc))
    doc["paths"] = {p: v for p, v in doc.get("paths", {}).items() if not p.startswith(_TEST_PREFIX)}
    return doc


def main() -> int:
    # The drift test runs under the unit conftest; a bare CLI run needs the same settings floor
    # so importing app.main does not fail on a box with no backend/.env.
    os.environ.setdefault("SUPABASE_URL", "https://example.invalid")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "export-openapi")
    doc = build_snapshot()
    with open(SNAPSHOT_PATH, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1)
    ops = sum(
        1
        for item in doc["paths"].values()
        for m in item
        if m in ("get", "put", "post", "delete", "patch", "options", "head", "trace")
    )
    print(
        f"wrote {SNAPSHOT_PATH.relative_to(_REPO_ROOT).as_posix()}: "
        f"{len(doc['paths'])} paths, {ops} operations, "
        f"{len(doc.get('components', {}).get('schemas', {}))} schemas"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
