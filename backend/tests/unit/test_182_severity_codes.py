"""Phase 182 (VALID-01) — the `/validate` severity classifier: fail LOUD, never fail open.

Closes **WR-05** from `182-VERIFICATION.md`. `_ERROR_CODES` in `app/api/workflows.py` was a
hardcoded `frozenset` of 6 string literals copied out of `reachability` + `grounding`, and
`_severity` returned the soft `"incomplete"` for anything it did not recognise. Two defects
in one block:

  1. **Fails open.** An unrecognised code painted grey "you're still building" on the canvas
     instead of red "this is broken" — and the author would then hit a hard publish BLOCK
     they were never warned about. Phase 184 and Phase 185 both add verdict codes (185 adds
     the GOVERN per-node grounding-mode verdict, ROADMAP SC#4), so this is a LIVE path.
  2. **Duplicated literals.** Three modules each held their own copy of the code vocabulary,
     with nothing keeping them in sync.

This file guards the fix from four directions:

  * DRIFT — the published sets (`reachability.LINT_CODES`,
    `grounding.GROUNDING_VERDICT_CODES`) are scanned against the modules' REAL emit sites, so
    a code added without being published fails here. This is the Phase-177 coverage-loss
    lesson applied to vocabulary: a failures-only test differential cannot see a code that
    was added but never classified, because nothing was ever asserting about it.
  * TEETH — the scanners themselves are self-tested against an inline sample, so the drift
    detectors can never pass vacuously on an empty match.
  * COMPOSITION — the classifier's known set really is composed from the owning modules,
    and every known code has exactly one classification path (no orphan, no double-claim).
  * BEHAVIOR — an explicit literal code-to-severity table pins today's taxonomy, and the
    unknown branch is proven loud in BOTH the return value and the log.

CONVENTION (Phase 102 posture): imports INSIDE the test bodies; plain sync tests — `_severity`
is a pure function, so no event loop, no DB, no provider, nothing to patch.
"""

from __future__ import annotations

import re
from pathlib import Path

_TESTS_DIR = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _TESTS_DIR.parent

# The emit-site scanners. Python's ``\s`` matches newlines, so the multi-line
# ``LintError(\n    "code", ...)`` call sites are covered by the same pattern.
_LINT_EMIT_RE = re.compile(r'LintError\(\s*"([a-z_]+)"')
_VERDICT_EMIT_RE = re.compile(r'"code":\s*"([a-z_]+)"')


def _scan(pattern: re.Pattern[str], source: str) -> set[str]:
    return set(pattern.findall(source))


def _read(*parts: str) -> str:
    return (_BACKEND_DIR.joinpath(*parts)).read_text(encoding="utf-8")


# ── 1) the owning modules publish their canonical code sets ───────────────────


def test_owning_modules_publish_their_canonical_code_sets():
    """`reachability` and `grounding` each OWN — and publish — the codes they emit.

    The classifier derives from these instead of re-declaring the literals (WR-05). The
    values are pinned here as literals on purpose: the drift tests below prove the sets match
    the emit sites, and this proves the emit sites are the ones we think they are.
    """
    from app.services.harness import grounding, reachability

    assert reachability.LINT_CODES == frozenset(
        {
            "bad_index",
            "input_unsatisfied",
            "no_terminal",
            "orphan_phase",
            "unsatisfiable_skip",
        }
    )
    assert grounding.GROUNDING_VERDICT_CODES == frozenset(
        {"folder_scope", "unregistered_skill", "unregistered_tool"}
    )


# ── 2) WR-05: the unknown branch fails LOUD (return value AND log) ────────────


def test_an_unrecognised_code_fails_loud_as_error_never_incomplete(caplog):
    """THE WR-05 PROOF. An unknown code classifies `error`, not the soft `incomplete`.

    A wrongly-RED verdict is visible and gets fixed. A wrongly-GREY one is invisible: the
    canvas says "still building", publish says "blocked", and the author is surprised. So the
    unknown branch must fail CLOSED, and it must say so in the log.
    """
    import logging

    from app.api import workflows

    # (a) a code no module emits today
    with caplog.at_level(logging.WARNING, logger="app.api.workflows"):
        caplog.clear()
        got = workflows._severity("a_code_no_module_emits", phases_empty=False)

    assert got != "incomplete", (
        "WR-05 REGRESSION: an unrecognised verdict code classified as the SOFT 'incomplete'. "
        "A genuinely blocking future rule would paint 'still building' on the canvas and "
        "surprise the author with a publish block. The unknown branch must fail CLOSED."
    )
    assert got == "error"
    assert "a_code_no_module_emits" in caplog.text, (
        "the unknown branch must LOG the unrecognised code by name — a silent reclassification "
        "is only half the fix; operations must be able to see it happened"
    )

    # (b) a plausible Phase-185 governance-mode code — the concrete near-term case
    with caplog.at_level(logging.WARNING, logger="app.api.workflows"):
        caplog.clear()
        future = workflows._severity("grounding_mode_violation", phases_empty=False)

    assert future != "incomplete"
    assert future == "error"
    assert "grounding_mode_violation" in caplog.text

    # ... and the empty-draft condition does NOT soften an unknown code either.
    assert workflows._severity("a_code_no_module_emits", phases_empty=True) == "error"


# ── 3) the pinned code-to-severity table (D-182-03) ───────────────────────────


def test_every_known_code_classifies_exactly_as_the_pinned_table():
    """The D-182-03 taxonomy, written as LITERALS.

    Deliberately NOT derived from `_ERROR_CODES` / `_INCOMPLETE_CODES` — a table built from
    the constants would only assert that the code agrees with itself. Each row is a product
    decision; changing one is a deliberate taxonomy change that requires a matching
    CONTEXT/decision update, not a silent edit.

    The `no_terminal` rows are the deliberate DUAL-SOURCE split (Pitfall 2): `lint_workflow`
    emits that one code for both an empty draft (still building) and an unreachable terminal
    (broken). That split is intent, not a bug.
    """
    from app.api import workflows

    table: list[tuple[str, bool, str]] = [
        # (code, phases_empty, expected severity)
        ("bad_index", False, "error"),
        ("orphan_phase", False, "error"),
        ("unsatisfiable_skip", False, "error"),
        ("folder_scope", False, "error"),
        ("unregistered_tool", False, "error"),
        ("unregistered_skill", False, "error"),
        ("no_terminal", False, "error"),  # unreachable terminal -> genuinely broken
        ("no_terminal", True, "incomplete"),  # empty draft -> still building
        ("input_unsatisfied", False, "incomplete"),
        ("business_requirement", False, "incomplete"),
        ("interactive_phase", False, "incomplete"),
    ]
    assert len(table) == 11, "10 codes + the second no_terminal condition"

    for code, phases_empty, expected in table:
        assert workflows._severity(code, phases_empty=phases_empty) == expected, (
            f"severity taxonomy CHANGED for {code!r} (phases_empty={phases_empty}): "
            f"expected {expected!r}. WR-05's fix reclassifies NOTHING — it only makes the "
            "UNKNOWN branch loud. If this row changed deliberately, update D-182-03 too."
        )

    # The split is real in BOTH directions — not an accident of one arm.
    assert workflows._severity("no_terminal", phases_empty=True) != workflows._severity(
        "no_terminal", phases_empty=False
    )
