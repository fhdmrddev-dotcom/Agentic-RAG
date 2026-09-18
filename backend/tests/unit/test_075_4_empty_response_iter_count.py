"""Phase 075.4 Plan 03 Task 2 — BUG-260522-01 one-liner.

The empty-response fallback used to render ``f"after {max_iterations} iterations"`` —
misleading, because the model typically returns empty after ONE iteration rather than after
exhausting all 15.

⚠ **UPDATED AT PHASE 250 (HONEST-02), DELIBERATELY AND NOT BY SURPRISE.** The sentence this
fence was written against — *"The model returned an empty response after {iteration + 1}
iteration(s)."* — **no longer exists**, because `BUG-260722-02` showed it was one message for
every possible cause: it named a count and a workaround and said nothing about what happened.
It is replaced by a four-arm taxonomy (`agent_loop.py`, and
`tests/unit/test_250_run_honesty_agent_loop.py` §2).

⭐ **THE INVARIANT SURVIVED THE REWORDING, AND THAT IS WHY THIS FENCE IS UPDATED RATHER THAN
DELETED.** `BUG-260522-01`'s actual claim was never about the wording — it was *"report the
iterations that RAN, never the cap"*. Every arm of the new taxonomy still reports
``iteration + 1`` (via the local ``_steps``), and ``max_iterations`` still appears nowhere in
that message. So the assertions below now pin the **claim**, not the **sentence**.

`SEED-177`'s rule applies here: a fence whose subject is retired must be retired CONSCIOUSLY,
with the reason written into the test body — never tripped by accident and then "fixed" by
loosening it.
"""
from __future__ import annotations

import re
from pathlib import Path


def _fallback_block() -> str:
    """The `if not full_content:` branch, up to its `_emit` call."""
    src = Path(__file__).parent.parent.parent / "app" / "services" / "agent_loop.py"
    text = src.read_text(encoding="utf-8")
    start = text.index("# Fallback: if the loop ended with no content produced")
    end = text.index("await _emit(redis, run_id, 'delta', content=fallback)", start)
    block = text[start:end]
    # ⚠ COMMENTS STRIPPED, AND THIS IS NOT FUSSINESS. The block retains the ORIGINAL
    # BUG-260522-01 comment, which names `max_iterations` while explaining why the message
    # must not use it. A raw substring fence reads that explanation as a violation — the
    # Python twin of `frontend/src/lib/stripComments.testutil.ts`. A text fence cannot tell
    # code from a comment, and one that cannot is asserting about prose.
    out = []
    for line in block.splitlines():
        i = line.find("#")
        out.append(line if i == -1 else line[:i])
    return chr(10).join(out)


def test_empty_response_fallback_uses_actual_iteration_count() -> None:
    """BUG-260522-01: the count must be the iterations that RAN, never the cap."""
    block = _fallback_block()

    # The actual-count expression must be how the step figure is computed.
    assert re.search(r"=\s*iteration \+ 1", block), (
        "the empty-output message must derive its step figure from `iteration + 1` — the "
        "iterations that actually ran (BUG-260522-01). If the expression moved, update THIS "
        "fence rather than deleting it."
    )

    # …and the cap must not be what the user is told.
    assert "max_iterations" not in block, (
        "BUG-260522-01 root: the fallback must never report `max_iterations`. A model "
        "typically returns empty after ONE iteration, not after exhausting the cap."
    )


def test_the_superseded_sentence_is_gone_and_stays_gone() -> None:
    """The Phase 250 half — the single generic sentence must not creep back.

    A future edit that "simplifies" the taxonomy back into one message would re-open
    BUG-260722-02 while leaving the test above perfectly green, because that sentence also
    carried the correct count. This is the fence for the thing the count fence cannot see.
    """
    block = _fallback_block()
    assert "returned an empty response after" not in block, (
        "the one-sentence-for-every-cause fallback was retired at Phase 250 (HONEST-02). "
        "A run that produced nothing must say WHICH of four things happened — and say that "
        "the reason was not captured when it does not know."
    )
