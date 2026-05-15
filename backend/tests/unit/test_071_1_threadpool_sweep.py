"""Phase 071.1 + 071.2 — assert /reextract, /upload, /reingest handlers have zero
unwrapped sync supabase calls.

Grep-based test: slices each route's function body out of documents.py source and
verifies every line containing `supabase.table(...).execute()` or
`supabase.storage(...).execute()` is preceded within 4 lines by
`await run_in_threadpool`. Also catches unwrapped `supabase.storage.from_(...)
.download(` and `.upload(` calls — Phase 071.2 D-071.2-06 sweep targets.

Plan 01 of 071.2 extends the original `/reextract`-only sweep to cover all three
ingestion routes (`/upload`, `/reingest`, `/reextract`) per D-v2.5-01 +
D-071.2-05/06.
"""
import re
from pathlib import Path

import pytest


def _slice_route_body(src: str, anchor: str) -> str:
    """Return the body of the function starting at `anchor` (e.g. 'async def upload_document(')
    up to (but not including) the next top-level `def ` / `async def ` declaration.
    """
    start = src.find(anchor)
    assert start != -1, f"{anchor} not found in documents.py"
    rest = src[start + len(anchor):]
    next_top_def = re.search(r"\n(async def |def )\w+\(", rest)
    end = (start + len(anchor)) + (
        next_top_def.start() if next_top_def else len(rest)
    )
    return src[start:end]


def _find_unwrapped_offenders(body: str) -> list[str]:
    """Return any line in `body` that performs a sync supabase call (table().execute,
    storage().execute, or storage().download/upload chain) without `run_in_threadpool`
    appearing within the preceding 4 non-blank lines.
    """
    lines = body.splitlines()
    offenders: list[str] = []
    for idx, line in enumerate(lines):
        # Match .table(...).execute() / .storage(...).execute() / .download( / .upload( on supabase chains
        sync_call = (
            re.search(r"supabase\.(table|storage)\([^)]*\)[^#]*\.execute\(\)", line)
            or re.search(r"supabase\.storage\.from_\([^)]*\)\.download\(", line)
            or re.search(r"supabase\.storage\.from_\([^)]*\)\.upload\(", line)
        )
        if not sync_call:
            continue
        # Allow if `run_in_threadpool` appears on the same line OR in the few
        # preceding non-blank lines — covers the multi-line lambda form:
        #   await run_in_threadpool(
        #       lambda: supabase.table(...).execute()
        #   )
        # AND the bound-method form:
        #   raw = await run_in_threadpool(
        #       supabase.storage.from_("documents").download, target["file_path"]
        #   )
        window = "\n".join(lines[max(0, idx - 4): idx + 1])
        if "run_in_threadpool" not in window:
            offenders.append(f"line {idx + 1}: {line.strip()}")
    return offenders


@pytest.mark.parametrize(
    "route_anchor",
    [
        "async def upload_document(",
        "async def reingest_document(",
        "async def reextract_document(",
    ],
)
def test_no_unwrapped_sync_calls_in_route(route_anchor):
    """Static grep gate — every supabase call in every ingestion route must be
    wrapped in `run_in_threadpool` (D-v2.5-01 + Phase 071.2 D-071.2-06)."""
    repo_backend = Path(__file__).resolve().parents[2]
    documents_py = repo_backend / "app" / "api" / "documents.py"
    assert documents_py.exists(), f"documents.py not found at {documents_py}"
    src = documents_py.read_text(encoding="utf-8")

    body = _slice_route_body(src, route_anchor)
    offenders = _find_unwrapped_offenders(body)

    assert not offenders, (
        f"Unwrapped sync supabase calls found in {route_anchor!r} "
        f"(D-v2.5-01 / D-071.2-06 violation):\n" + "\n".join(offenders)
    )


def test_no_unwrapped_sync_calls_in_reextract():
    """Legacy 071.1 test — preserved as a named regression guard so the original
    071.1 binding gate still exists by name (some downstream gating greps for
    this function name)."""
    repo_backend = Path(__file__).resolve().parents[2]
    documents_py = repo_backend / "app" / "api" / "documents.py"
    assert documents_py.exists(), f"documents.py not found at {documents_py}"
    src = documents_py.read_text(encoding="utf-8")

    body = _slice_route_body(src, "async def reextract_document(")
    offenders = _find_unwrapped_offenders(body)

    assert not offenders, (
        "Unwrapped sync supabase calls found in /reextract handler "
        "(D-071.1-01 violation):\n" + "\n".join(offenders)
    )
