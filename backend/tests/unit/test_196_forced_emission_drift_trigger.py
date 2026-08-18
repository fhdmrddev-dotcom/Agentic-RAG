"""The mechanical re-open trigger for SEED-175 — the D-122-04 `forced_emission` / `emit_tier` drift.

WHY THIS FILE EXISTS, AND WHY IT IS A SEPARATE FILE (do not fold it into a judge test).

Two ladders in this codebase answer "can this model be forced to emit?", and they read
DIFFERENT columns:

  * the EMISSION ladder — what actually happens at the provider call — reads ``emit_tier``
    (``forced_emit._RUNGS_BY_TIER``, via ``cap.get("emit_tier", "coerce")``);
  * the FALLBACK-CANDIDATE ladders — which default model a resolver picks when its knob is
    unset — still read the DEPRECATED-UNREAD ``forced_emission`` bool, in THREE places:
    ``validator_kinds.resolve_judge_model``, ``workflow_authoring.resolve_authoring_model``
    and ``skill_tuner_service.resolve_skill_builder_model``.

D-122-04 demoted ``forced_emission``. The emission path stopped reading it; the three
fallback ladders did not. Measured 2026-08-18: **0 of 61** registry rows disagree, so the
drift is LATENT, not live — and both candidates the judge ladder walks (``claude-opus-4-8``,
``gpt-5.5``) resolve identically under either flag.

Plan 196-02 deliberately did NOT edit the line. It was a critical-bug plan carrying one
binding test, the drift lives in a different function of the same file, and changing
measurably-inert code inside that diff would have made a red result harder to attribute —
the "bug-fix plans smuggle in cleanups" generalisation of G-7.

⚠ THIS FILE IS WHAT WAS BUILT INSTEAD, AND IT IS STRICTLY BETTER THAN THE LINE EDIT: it
converts a latent inconsistency into a gate that fires the DAY it stops being latent, and it
watches the REGISTRY rather than one of three ladders. A separate file is the point — a red
result here names the drift and nothing else, where an assertion bolted onto a judge test
would have made "the judge broke" and "the registry drifted" look the same.

⚠ DO NOT "FIX" A RED RUN BY EDITING THE ASSERTION. A red run means a registry row now
disagrees, which is the event this file exists to catch. Read SEED-175 for the fix (point all
THREE fallback ladders at ``emit_tier``, together, docstrings included) — and do NOT delete
``forced_emission`` from MODEL_CAPABILITIES as part of it; that is a separate change with its
own blast radius, and bundling it would destroy this test's ability to say which thing broke.

Both guards below carry a NON-VACUITY assertion and a POSITIVE CONTROL that exercises THE
SAME predicate over an inline fixture known to disagree — the ``test_audit_event_registration``
habit. A guard whose control was never observed red is not evidence, and a predicate that
silently examined zero rows would otherwise pass forever while checking absolutely nothing.
"""

from app.config import MODEL_CAPABILITIES

# The emission ladder's own vocabulary. Anything outside this set is best-effort, which is
# what ``forced_emit`` means by its read-time ``coerce`` default.
FORCEABLE_TIERS = {"force", "force_strict"}

SEED = "SEED-175"


def _disagreeing_rows(registry):
    """THE predicate, defined ONCE so the guard and its positive control cannot diverge.

    Returns ``[(model_id, forced_emission, emit_tier), ...]`` for every row where the
    deprecated bool and the shipped tier disagree about forceability.
    """
    return [
        (model_id, cap.get("forced_emission"), cap.get("emit_tier"))
        for model_id, cap in registry.items()
        if bool(cap.get("forced_emission")) != (cap.get("emit_tier") in FORCEABLE_TIERS)
    ]


def test_forced_emission_and_emit_tier_still_agree_on_every_registry_row():
    """SEED-175's trigger. RED here means the D-122-04 drift has stopped being latent."""
    # NON-VACUITY, twice over: an empty registry, or one whose rows carry neither key,
    # would make the predicate below trivially true forever.
    assert len(MODEL_CAPABILITIES) > 0, (
        "NON-VACUITY FLOOR: MODEL_CAPABILITIES is empty, so the drift check examined zero "
        "rows and proves nothing. Something has gone wrong with the import, not with the "
        "registry's contents."
    )
    tiered = [m for m, c in MODEL_CAPABILITIES.items() if c.get("emit_tier") is not None]
    assert len(tiered) > 0, (
        "NON-VACUITY FLOOR: not one row in MODEL_CAPABILITIES carries an emit_tier, so "
        "every comparison below reduced to `bool(forced_emission) != False`. The emission "
        "vocabulary has moved; this guard is measuring nothing."
    )

    disagreeing = _disagreeing_rows(MODEL_CAPABILITIES)

    assert disagreeing == [], (
        f"{SEED} HAS FIRED — the forced_emission / emit_tier drift is no longer latent.\n"
        f"\n"
        f"{len(disagreeing)} of {len(MODEL_CAPABILITIES)} registry rows now disagree about "
        f"whether the model can be forced to emit:\n"
        + "".join(
            f"    {model_id}: forced_emission={fe!r} but emit_tier={tier!r}\n"
            for model_id, fe, tier in disagreeing
        )
        + "\n"
        "WHY THIS MATTERS: the EMISSION path reads emit_tier, while THREE fallback-candidate "
        "ladders still gate on the deprecated forced_emission bool — "
        "validator_kinds.resolve_judge_model (:83-86), "
        "workflow_authoring.resolve_authoring_model, and "
        "skill_tuner_service.resolve_skill_builder_model. While the two columns agreed, that "
        "was harmless. They no longer agree, so a resolver can now pick a default model the "
        "emission ladder will NOT force — and the caller will get a coerced, possibly "
        "truncated verdict from a shot it believes is schema-bound.\n"
        "\n"
        "WHAT TO DO — do NOT edit this assertion:\n"
        f"  1. Read .planning/seeds/{SEED}-forced-emission-emit-tier-latent-drift.md.\n"
        "  2. Point all THREE fallback ladders at emit_tier, in ONE commit, updating each "
        "docstring in the same commit (all three currently state the forced_emission rule as "
        "the design).\n"
        "  3. Do NOT delete forced_emission from MODEL_CAPABILITIES in that commit — that is "
        "a separate change with its own blast radius, and bundling it destroys this guard's "
        "ability to say which thing broke.\n"
        "  4. This test then passes because the columns agree again, OR is superseded by one "
        "asserting the ladders read emit_tier directly. Either is a fix; editing the "
        "assertion is not."
    )


def test_positive_control_the_same_predicate_really_can_find_a_disagreeing_row():
    """The guard above is only evidence if its predicate has been OBSERVED to fail.

    This runs THE SAME ``_disagreeing_rows`` function over an inline fixture built to
    disagree in BOTH directions, so a predicate that silently stopped matching — a renamed
    key, an inverted comparison, a widened tier set — fails here rather than passing the
    real check forever.
    """
    fixture = {
        # AGREES: forceable bool, forceable tier. Must NOT be reported.
        "agrees-force": {"forced_emission": True, "emit_tier": "force"},
        # AGREES: not forceable either way. Must NOT be reported.
        "agrees-coerce": {"forced_emission": False, "emit_tier": "coerce"},
        # DISAGREES: the bool says forceable, the shipped tier says best-effort.
        "drift-bool-says-yes": {"forced_emission": True, "emit_tier": "coerce"},
        # DISAGREES the OTHER way — a ladder gating on the bool would SKIP a model the
        # emission path would happily force. Both directions matter.
        "drift-tier-says-yes": {"forced_emission": False, "emit_tier": "force_strict"},
    }

    reported = {model_id for model_id, _, _ in _disagreeing_rows(fixture)}

    assert reported == {"drift-bool-says-yes", "drift-tier-says-yes"}, (
        "POSITIVE CONTROL FAILED: the drift predicate did not report exactly the two rows "
        f"planted to disagree — it reported {sorted(reported)}. The guard above is therefore "
        "NOT evidence about the real registry, whatever colour it shows. Fix the predicate "
        "before trusting the check."
    )


def test_the_two_judge_fallback_candidates_are_unaffected_either_way():
    """The narrower claim SEED-175 actually rests on, pinned so it cannot rot silently.

    Even a partial drift only changes a resolver's ANSWER if it lands on one of the two ids
    the judge ladder walks. Recording that here means a future reader can see at a glance
    whether a red run above is merely untidy or actually changes which model grades a publish.
    """
    candidates = ("claude-opus-4-8", "gpt-5.5")

    present = [c for c in candidates if c in MODEL_CAPABILITIES]
    assert present, (
        "NON-VACUITY FLOOR: neither judge fallback candidate "
        f"{candidates} is in MODEL_CAPABILITIES, so this check compared nothing. The ladder "
        "in validator_kinds.resolve_judge_model has moved and this pin must move with it."
    )

    for model_id in present:
        cap = MODEL_CAPABILITIES[model_id]
        assert bool(cap.get("forced_emission")) == (cap.get("emit_tier") in FORCEABLE_TIERS), (
            f"{SEED}: judge fallback candidate {model_id!r} now resolves DIFFERENTLY under "
            f"the two columns (forced_emission={cap.get('forced_emission')!r}, "
            f"emit_tier={cap.get('emit_tier')!r}). This is the arm of the drift that is NOT "
            "cosmetic — it changes which model the publish gauntlet's hard wall grades with "
            "when the operator's knob is unset. Treat it as higher priority than a bare "
            "registry disagreement."
        )
