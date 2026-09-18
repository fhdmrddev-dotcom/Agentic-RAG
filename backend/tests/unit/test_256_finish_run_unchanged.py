"""Phase 256 / D-256-05 — Fence 3: ``finish_run`` is BYTE-UNCHANGED.

WHY A FENCE AND NOT A COMMENT. Phase 256 makes a harness run's token total
durable, and the obvious-looking way to do that is to widen the terminal status
writer everyone already calls. D-256-05 refuses that, and the refusal has a
reason a future reader must not have to reconstruct:

  * ``finish_run`` is called from FIVE sites across THREE files, and the cancel
    paths among them have no usage box at all. Widening it would make those
    callers pass ``None`` forever, re-introducing exactly the ``None``-vs-``0``
    ambiguity migration 182 was written to preserve (D-256-06).
  * Its docstring records a CROSS-WORKER INTERLEAVE contract that holds *by
    value-identity*: two workers may write the same row concurrently and that
    is benign only because both writes carry the SAME VALUE. A token total is
    not value-identical between two workers. Adding one would quietly void the
    property the docstring says the callers rely on.

So the token write lives in a NEW one-home writer (``persist_run_usage``) and
this fence exists to make "we did not touch finish_run" checkable rather than
claimed.

⚠ THE FIGURE THIS FENCE ASSERTS WAS RE-DERIVED, NOT INHERITED. D-256-05 and
256-RESEARCH.md both state "7 call sites across 4 files". Measured at this
plan's base with ``grep -rn "await finish_run(" backend/app/``: **FIVE call
sites across THREE files**. The decision the figure supports (leave the
function alone) is unaffected; the figure is wrong and is recorded here beside
its original rather than quietly replaced. The other ``finish_run(`` hits in the
tree are the ``def`` itself and four prose mentions in docstrings/comments.

⚠ WHAT THIS FENCE CANNOT SEE: it hashes the function's own source segment, so a
change to a helper ``finish_run`` calls, or to the table it writes, is invisible
here. It answers exactly one question — did this function's text change — and
nothing wider.
"""

from __future__ import annotations

import ast
import hashlib
import re
from pathlib import Path


_BACKEND_APP = Path(__file__).resolve().parents[2] / "app"
_WORKFLOWS_DB = _BACKEND_APP / "db" / "workflows.py"

# md5 of ast.get_source_segment(...) for `async def finish_run`, computed on the
# UNIVERSAL-NEWLINE text (Path.read_text translates CRLF -> LF), so the digest is
# stable across checkouts with different line endings.
_FINISH_RUN_MD5 = "2a3a1c4543f5a80c55d25a8d0e1bd1e0"

# file:line of every `await finish_run(` under backend/app/, re-derived at this
# plan's base. Sorted; compared as a SET so ordering cannot cause a false red.
_EXPECTED_CALL_SITES = {
    "api/workflows.py:1802",
    "services/harness_engine.py:2257",
    "services/harness_engine.py:2298",
    "services/harness_engine.py:2580",
    "services/run_lifecycle.py:521",
}

_CALL_RE = re.compile(r"await\s+finish_run\s*\(")


def _finish_run_source() -> str:
    src = _WORKFLOWS_DB.read_text(encoding="utf-8")
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "finish_run":
            segment = ast.get_source_segment(src, node)
            assert segment, "ast.get_source_segment returned nothing for finish_run"
            return segment
    raise AssertionError(
        "no `async def finish_run` in backend/app/db/workflows.py — the function "
        "was renamed or removed, which is a larger change than this fence guards"
    )


def test_finish_run_source_is_byte_unchanged():
    """D-256-05. Any edit to this function's text fails here, on purpose."""
    digest = hashlib.md5(_finish_run_source().encode("utf-8")).hexdigest()
    assert digest == _FINISH_RUN_MD5, (
        "finish_run's source changed (D-256-05 says it must not). If the change "
        "is deliberate, say WHY in the commit and update _FINISH_RUN_MD5 in the "
        "same commit — never update the digest to make a red go away. "
        f"expected {_FINISH_RUN_MD5}, measured {digest}"
    )


def test_the_fence_is_not_vacuous():
    """A digest over an empty string would pass silently. Prove there is a subject."""
    segment = _finish_run_source()
    assert segment.startswith("async def finish_run("), segment[:40]
    assert len(segment) > 2000, (
        f"finish_run's source segment measured {len(segment)} chars — far shorter "
        "than the ~7.6k this fence was written against; the extraction is probably "
        "matching the wrong node"
    )
    assert "UPDATE workflow_runs" in segment or "workflow_runs" in segment


def test_the_finish_run_call_site_set_is_unchanged():
    """A NEW caller is as much a contract change as an edit to the body.

    ⚠ Asserted as a SET of file:line, re-derived here rather than counted — a
    count would let one site move and another appear and still read green.
    """
    found: set[str] = set()
    for path in sorted(_BACKEND_APP.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        rel = path.relative_to(_BACKEND_APP).as_posix()
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if _CALL_RE.search(line):
                found.add(f"{rel}:{lineno}")

    assert found == _EXPECTED_CALL_SITES, (
        "the `await finish_run(` call-site set moved.\n"
        f"  appeared: {sorted(found - _EXPECTED_CALL_SITES)}\n"
        f"  vanished: {sorted(_EXPECTED_CALL_SITES - found)}\n"
        "A new caller means finish_run's contract is being relied on somewhere "
        "new; a vanished one means a terminal write was removed. Neither is a "
        "digest change, and neither may pass silently."
    )


def test_the_call_site_walk_visited_a_plausible_tree():
    """The vacuity control for the walk itself — an empty scan set proves nothing."""
    visited = [
        p
        for p in _BACKEND_APP.rglob("*.py")
        if "__pycache__" not in p.parts
    ]
    assert len(visited) >= 150, (
        f"only {len(visited)} .py files under backend/app/ — the walk collapsed, "
        "so a green call-site assertion above would mean nothing"
    )
