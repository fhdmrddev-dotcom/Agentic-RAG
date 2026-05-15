"""Phase 071.1 D-071.1-01 — assert /reextract handler has zero unwrapped sync supabase calls.

Grep-based test: slices the reextract_document function body out of documents.py source
and verifies every line containing `supabase.table(...).execute()` or
`supabase.storage(...).execute()` is preceded on the same line by `await run_in_threadpool`.
"""
import re
from pathlib import Path


def test_no_unwrapped_sync_calls_in_reextract():
    # Resolve documents.py via the package layout so the test works regardless of cwd.
    repo_backend = Path(__file__).resolve().parents[2]
    documents_py = repo_backend / "app" / "api" / "documents.py"
    assert documents_py.exists(), f"documents.py not found at {documents_py}"
    src = documents_py.read_text(encoding="utf-8")

    # Slice the reextract_document function body (until the next top-level `async def`/`def `).
    start = src.find("async def reextract_document(")
    assert start != -1, "reextract_document function not found in documents.py"

    # Find next top-level def/async def AFTER reextract_document
    rest = src[start + len("async def reextract_document("):]
    next_top_def = re.search(r"\n(async def |def )\w+\(", rest)
    end = (start + len("async def reextract_document(")) + (
        next_top_def.start() if next_top_def else len(rest)
    )
    body = src[start:end]

    # Find every line containing supabase.table(...).execute() OR supabase.storage(...).execute()
    lines = body.splitlines()
    offenders = []
    for idx, line in enumerate(lines):
        # Match .table(...).execute() or .storage(...).execute() chains
        if re.search(r"supabase\.(table|storage)\([^)]*\)[^#]*\.execute\(\)", line):
            # Allow if `run_in_threadpool` appears on the same line (rare) OR on any
            # of the few preceding non-blank lines — covers the multi-line
            # `await run_in_threadpool(\n    lambda: supabase...execute()\n)` form.
            window = "\n".join(lines[max(0, idx - 4): idx + 1])
            if "run_in_threadpool" not in window:
                offenders.append(f"line {idx + 1}: {line.strip()}")

    assert not offenders, (
        "Unwrapped sync supabase calls found in /reextract handler "
        "(D-071.1-01 violation):\n" + "\n".join(offenders)
    )
