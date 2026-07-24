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

    # The route mints exactly two codes itself — neither owning module emits them.
    assert set(workflows._ROUTE_ASSIGNED_CODES) == {
        "business_requirement",
        "interactive_phase",
    }
    assert set(workflows._ROUTE_ASSIGNED_CODES).isdisjoint(owned), (
        "a route-minted code collided with an owning module's code — one of them must move"
    )
    assert set(workflows._KNOWN_CODES) == owned | set(workflows._ROUTE_ASSIGNED_CODES)

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

    # _ERROR_CODES is derived, so it must still equal the historical literal set exactly —
    # the WR-05 fix reclassifies nothing.
    assert errors == {
        "bad_index",
        "orphan_phase",
        "unsatisfiable_skip",
        "folder_scope",
        "unregistered_tool",
        "unregistered_skill",
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


# ── 8) BOUNDARY: publish-only codes are ACKNOWLEDGED, not accidental ─────────


def test_publish_only_codes_are_an_acknowledged_boundary():
    """`publish_service` mints ONE code `/validate` deliberately does not know.

    Plan 182-06 added the fail-closed stage-2.6 code `grounding_unavailable`. Its canonical
    home is `publish_service.py`: it says "we could not CHECK", not "the definition is
    wrong", and it travels on the D-08 publish verdict's `named_failures` — `/validate` calls
    `grounding.grounding_verdicts` directly, never `_grounding_fidelity_failures`, so it can
    never reach `_severity`.

    This test pins that boundary so it stays a DECISION. If publish mints another verdict
    code later, this fails and forces the author to answer the question the WR-05 gap existed
    because nobody asked: is it a `/validate` code (compose it in) or publish-only
    (acknowledge it here)?
    """
    from app.api import workflows

    publish_codes = _scan(
        _VERDICT_EMIT_RE, _read("app", "services", "harness", "publish_service.py")
    )
    unknown_to_validate = publish_codes - set(workflows._KNOWN_CODES)

    assert unknown_to_validate == {"grounding_unavailable"}, (
        "the publish path mints a verdict code /validate does not classify, and it is not "
        f"the one acknowledged boundary: {sorted(unknown_to_validate)}. Decide its home — "
        "add it to the owning module's published set if /validate can emit it, or extend "
        "this test's acknowledged set (with a comment saying why it is publish-only)."
    )

    # Even so, if it EVER reached the classifier the answer would be the fail-closed one.
    # "could not verify" must never paint soft grey; the WR-05 branch gets this right by
    # construction, which is precisely why failing closed is the correct default.
    assert workflows._severity("grounding_unavailable", phases_empty=False) == "error"
    assert workflows._severity("grounding_unavailable", phases_empty=True) == "error"
