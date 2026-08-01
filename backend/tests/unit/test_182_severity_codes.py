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


def _strip_comment_lines(source: str) -> str:
    """Drop whole-line ``#`` comments before scanning.

    Same hygiene `test_182_extraction_parity.py`'s count guard applies (`grep -v '^#'`): a
    commented-out or merely DISCUSSED emit site is not a real one, and both owning modules
    now carry comment blocks that talk ABOUT their codes. Docstrings are deliberately NOT
    stripped — a prose emit site inside one would over-report, which is the safe direction
    (the published set would simply have to carry a code that cannot arrive).
    """
    return "\n".join(
        line for line in source.splitlines() if not line.lstrip().startswith("#")
    )


def _scan(pattern: re.Pattern[str], source: str) -> set[str]:
    return set(pattern.findall(_strip_comment_lines(source)))


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


# ── 4) DRIFT DETECTOR: reachability's published set vs its real emit sites ────


def test_lint_codes_match_the_reachability_emit_sites():
    """`reachability.LINT_CODES` EQUALS the codes `lint_workflow` can really emit.

    Scans every `LintError(` call site in the module's own source. This is the guard a
    failures-only test differential structurally cannot provide: a NEW lint code added
    without being published breaks nothing and fails nothing — it just arrives at
    `_severity` as an unknown, and (pre-WR-05) silently painted soft grey.
    """
    from app.services.harness import reachability

    scanned = _scan(_LINT_EMIT_RE, _read("app", "services", "harness", "reachability.py"))

    assert scanned, (
        "the LintError emit-site scanner matched NOTHING — the scanner is broken (or the "
        "emit sites were reshaped), so this drift detector would pass vacuously"
    )
    assert scanned == set(reachability.LINT_CODES), (
        "DRIFT: a lint_workflow code was added or removed without updating "
        f"reachability.LINT_CODES. Symmetric difference: "
        f"{sorted(scanned.symmetric_difference(set(reachability.LINT_CODES)))}. "
        "Until the published set matches, the /validate severity classifier composes an "
        "incomplete known-code set and would mis-classify the code (WR-05). Add it to "
        "LINT_CODES in the SAME commit — and to workflows._INCOMPLETE_CODES if it is a "
        "still-building condition rather than a hard break."
    )


# ── 5) DRIFT DETECTOR: grounding's published set vs its real emit sites ───────


def test_grounding_verdict_codes_match_the_grounding_emit_sites():
    """`grounding.GROUNDING_VERDICT_CODES` EQUALS the codes `grounding_verdicts` emits.

    Same guard, other owning module. Phase 185 adds the GOVERN per-node grounding-mode
    verdict to this exact collector, so this detector fires on a real, scheduled change —
    forcing the classification decision to be made rather than defaulted.
    """
    from app.services.harness import grounding

    scanned = _scan(_VERDICT_EMIT_RE, _read("app", "services", "harness", "grounding.py"))

    assert scanned, (
        "the verdict emit-site scanner matched NOTHING in grounding.py — the scanner is "
        "broken, so this drift detector would pass vacuously"
    )
    assert scanned == set(grounding.GROUNDING_VERDICT_CODES), (
        "DRIFT: a grounding_verdicts code was added or removed without updating "
        f"grounding.GROUNDING_VERDICT_CODES. Symmetric difference: "
        f"{sorted(scanned.symmetric_difference(set(grounding.GROUNDING_VERDICT_CODES)))}. "
        "The /validate severity classifier derives its known set from this frozenset, so an "
        "unpublished code reaches _severity as an unknown (WR-05)."
    )


# ── 6) COMPOSITION: the classifier really derives, and nothing is orphaned ────


def test_known_codes_compose_from_the_owning_modules_with_no_orphan():
    """`_KNOWN_CODES` is COMPOSED, and every known code has exactly one classification path.

    Two distinct failures this catches: (a) the classifier quietly going back to a hardcoded
    literal set that omits an owning module; (b) a code being known but claimed by no bucket
    (it would fall through to the unknown branch and log on every single request) or claimed
    by two (an ambiguous taxonomy).
    """
    from app.api import workflows
    from app.services.harness import grounding, reachability

    owned = set(reachability.LINT_CODES) | set(grounding.GROUNDING_VERDICT_CODES)
    assert owned <= set(workflows._KNOWN_CODES), (
        "the /validate classifier does NOT know every code its owning modules can emit: "
        f"missing {sorted(owned - set(workflows._KNOWN_CODES))}. _KNOWN_CODES must be "
        "composed from LINT_CODES + GROUNDING_VERDICT_CODES + _ROUTE_ASSIGNED_CODES."
    )

    # The route mints exactly three codes itself — no owning module emits them.
    # `unbound_retrieval` (Phase 187 / D-187-11) is deliberately a ROUTE code rather than a
    # `grounding.GROUNDING_VERDICT_CODES` one: that collector is shared with publish, so a
    # rule added there would silently become a publish blocker too.
    assert set(workflows._ROUTE_ASSIGNED_CODES) == {
        "business_requirement",
        "interactive_phase",
        "unbound_retrieval",
    }
    assert set(workflows._ROUTE_ASSIGNED_CODES).isdisjoint(owned), (
        "a route-minted code collided with an owning module's code — one of them must move"
    )

    # The DEGRADED bucket (round-2 gap closure — WR-01 / WR-02): an infrastructure-honesty
    # code, not a rule finding. It is NOT in `GROUNDING_VERDICT_CODES` because
    # `grounding_verdicts` does not emit it — both CONSUMERS of that collector mint it, from
    # the one shared `grounding.grounding_unavailable_finding`, whenever a grounding read is
    # unresolvable. Its string is sourced from `grounding.py`, so neither consumer carries a
    # literal and this composition cannot drift from a copy.
    assert set(workflows._DEGRADED_CODES) == {grounding.GROUNDING_UNAVAILABLE_CODE}
    assert set(workflows._DEGRADED_CODES).isdisjoint(
        owned | set(workflows._ROUTE_ASSIGNED_CODES)
    )
    assert set(workflows._KNOWN_CODES) == (
        owned | set(workflows._ROUTE_ASSIGNED_CODES) | set(workflows._DEGRADED_CODES)
    )

    # Exactly one classification path per known code: the three buckets PARTITION the set.
    incomplete = set(workflows._INCOMPLETE_CODES)
    errors = set(workflows._ERROR_CODES)
    dual = set(workflows._DUAL_SOURCE_CODES)

    assert incomplete.isdisjoint(errors), (
        f"a code is BOTH incomplete and error: {sorted(incomplete & errors)}"
    )
    assert dual.isdisjoint(incomplete | errors), (
        "the dual-source code must be resolved by the split, not also sit in a bucket"
    )
    assert incomplete | errors | dual == set(workflows._KNOWN_CODES), (
        "ORPHANED CODE: a known code belongs to no classification bucket, so it falls "
        "through to the fail-loud unknown branch and logs a warning on EVERY request that "
        f"produces it. Unclaimed: "
        f"{sorted(set(workflows._KNOWN_CODES) - (incomplete | errors | dual))}"
    )

    # _ERROR_CODES is DERIVED (`_KNOWN_CODES - _INCOMPLETE_CODES - _DUAL_SOURCE_CODES`), so
    # the literal set here is the taxonomy decision written out by hand. `grounding_unavailable`
    # joins it by construction: widening `_KNOWN_CODES` without touching `_INCOMPLETE_CODES`
    # drops it into the error bucket, which is the REQUIRED classification. "We could not
    # verify" must never paint the soft `incomplete` — an author shown "still building" would
    # hit a hard publish block nobody warned them about (the WR-05 posture).
    assert errors == {
        "bad_index",
        "orphan_phase",
        "unsatisfiable_skip",
        "folder_scope",
        "unregistered_tool",
        "unregistered_skill",
        "grounding_unavailable",
    }


# ── 7) TEETH: the scanners cannot pass vacuously ──────────────────────────────


def test_drift_scanners_have_teeth():
    """The drift detectors are only worth having if the scanners actually extract codes.

    Mirrors `test_182_extraction_parity.py::test_count_guard_has_teeth`. A scanner that
    silently matched nothing would make tests (4) and (5) pass vacuously the moment a
    published set was also emptied — a green suite over a fully broken guard.
    """
    lint_sample = "\n".join(
        [
            'errors.append(LintError("real_code", p.slug, "boom"))',
            "errors.append(",
            "    LintError(",  # the multi-line call shape the real module uses
            '        "multiline_code", None, "spans lines"',
            "    )",
            ")",
            '# errors.append(LintError("commented_out", None, "not real"))',
            "  # LintError(\"indented_comment\", None, \"also not real\")",
            "return errors  # LintError is only mentioned here",
        ]
    )
    assert _scan(_LINT_EMIT_RE, lint_sample) == {"real_code", "multiline_code"}

    verdict_sample = "\n".join(
        [
            'out.append({"code": "real_verdict", "phase": None, "message": m})',
            "out.append(",
            "    {",
            '        "code": "spaced_verdict",',
            '        "phase": phase.slug,',
            "    }",
            ")",
            '# out.append({"code": "commented_verdict", "phase": None})',
            'assert body["codes"] == ["not_a_match"]',
        ]
    )
    assert _scan(_VERDICT_EMIT_RE, verdict_sample) == {"real_verdict", "spaced_verdict"}

    # And an empty/irrelevant source yields an empty set — which tests (4) and (5) both
    # assert against explicitly, so a broken scanner fails there instead of passing.
    assert _scan(_LINT_EMIT_RE, "") == set()
    assert _scan(_VERDICT_EMIT_RE, "def f():\n    return 1\n") == set()


# ── 8) BOUNDARY: publish mints NO code /validate cannot classify ─────────────


def test_publish_mints_no_code_validate_cannot_classify():
    """The acknowledged boundary set is now EMPTY — and that is the point.

    WHAT CHANGED (round-2 gap closure — WR-01 / WR-02). Plan 182-06 gave publish a
    fail-closed stage-2.6 code, `grounding_unavailable`, and this test acknowledged it as
    publish-only: `/validate` called `grounding.grounding_verdicts` directly, so the code
    could not reach `_severity`. That was a real boundary, and it was also the shape of a
    real defect — the two sides shared the same RULES with OPPOSITE FAILURE postures, so an
    unresolvable registry produced a structured block on the publish side and an HTTP 500 on
    the route the canvas calls on every edit.

    Both sides now mint that code from the ONE shared `grounding.grounding_unavailable_finding`
    and `/validate` composes it into `_KNOWN_CODES` (as `workflows._DEGRADED_CODES`). So the
    boundary set is empty for TWO independent reasons: the code is now known to the
    classifier, and publish no longer spells it as a literal at all — it returns the shared
    builder's dict.

    THE FORCING FUNCTION IS INTACT. If publish ever mints a NEW verdict code of its own, this
    scan sees the literal and fails, forcing the author to answer the question the WR-05 gap
    existed because nobody asked: is it a `/validate` code (compose it in) or publish-only
    (acknowledge it here, with a comment saying why)?
    """
    from app.api import workflows
    from app.services.harness import grounding

    publish_codes = _scan(
        _VERDICT_EMIT_RE, _read("app", "services", "harness", "publish_service.py")
    )
    unknown_to_validate = publish_codes - set(workflows._KNOWN_CODES)

    assert unknown_to_validate == set(), (
        "the publish path mints a verdict code /validate cannot classify: "
        f"{sorted(unknown_to_validate)}. Decide its home — add it to the owning module's "
        "published set if /validate can emit it, or acknowledge it here (with a comment "
        "saying why it is publish-only)."
    )

    # The degraded code IS classified now, deliberately rather than through the fail-loud
    # branch — and the answer is the fail-closed one in both `phases_empty` states. "Could not
    # verify" must never paint soft grey.
    assert grounding.GROUNDING_UNAVAILABLE_CODE in workflows._KNOWN_CODES
    assert workflows._severity("grounding_unavailable", phases_empty=False) == "error"
    assert workflows._severity("grounding_unavailable", phases_empty=True) == "error"
