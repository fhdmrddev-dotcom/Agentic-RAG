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


def test_extract_composable_calls_wrapped_in_threadpool():
    """Phase 071.2 Plan 05 — composer is sync; async route bodies MUST wrap
    extract_composable calls in run_in_threadpool.

    Static grep gate: every USE of `extract_composable` as a callable target
    in documents.py — whether `extract_composable(...)` direct call OR
    `run_in_threadpool(extract_composable, ...)` argument form — must have
    `run_in_threadpool` within a small preceding window (same expression or
    a few characters back). Import lines (e.g. `import extract_composable`)
    are excluded by the `\b` check + skipping if it's part of an import path.
    """
    import re
    repo_backend = Path(__file__).resolve().parents[2]
    documents_py = repo_backend / "app" / "api" / "documents.py"
    src = documents_py.read_text(encoding="utf-8")

    # Match either `extract_composable(` (direct call) or `extract_composable,`
    # (callable arg form). Both are USES; imports use `extract_composable\n` or
    # `extract_composable, get_extractor` patterns we have to handle separately.
    pattern = re.compile(r"\bextract_composable\s*[\(,]")

    for match in pattern.finditer(src):
        start = match.start()
        # Skip if this is an `import ... extract_composable, ...` line
        # (look back at the start of the line for `import`).
        line_start = src.rfind("\n", 0, start) + 1
        line_prefix = src[line_start:start]
        # Imports look like:   "from ... import a, b, extract_composable, c"
        # or "    from app.services.extraction_service import extract_composable"
        if "import" in line_prefix and "(" not in line_prefix:
            continue
        # Walk back ~400 chars to find run_in_threadpool nearby.
        window_start = max(0, start - 400)
        window = src[window_start:start]
        assert "run_in_threadpool" in window, (
            f"extract_composable use at offset {start} not wrapped in "
            f"run_in_threadpool within 400 chars preceding. Window tail: "
            f"{window[-200:]!r}"
        )
