"""Phase 075.4 Plan 03 Task 2 — BUG-260522-01 one-liner.

The empty-response fallback at threads.py:~3044-3048 region used to render
``f"after {max_iterations} iterations"`` — misleading because the model
typically returns empty after ONE iteration, not after exhausting all 15.

Plan 03 fix: substitute ``{iteration + 1} iteration(s)`` so the message
reflects how many iterations actually ran.

Source-text assertion (the literal lives deep in send_message; the loop
variable `iteration` is in scope from `for iteration in range(max_iterations):`).
"""
from __future__ import annotations

import re
from pathlib import Path


def test_empty_response_fallback_uses_actual_iteration_count() -> None:
    """The empty-response fallback string MUST use ``{iteration + 1} iteration(s)``
    not ``{max_iterations} iterations`` (BUG-260522-01 one-liner)."""
    src = Path(__file__).parent.parent.parent / "app" / "services" / "agent_loop.py"
    text = src.read_text(encoding="utf-8")

    # New shape must exist
    assert re.search(
        r'f"\*The model returned an empty response after \{iteration \+ 1\} iteration\(s\)\.',
        text,
    ), (
        "Empty-response fallback must use `{iteration + 1} iteration(s)` "
        "(BUG-260522-01 one-liner fix)."
    )

    # Old shape must NOT exist anywhere in the file
    assert not re.search(
        r'f"\*The model returned an empty response after \{max_iterations\} iterations',
        text,
    ), (
        "Old `{max_iterations} iterations` shape must be removed (BUG-260522-01 root)."
    )
