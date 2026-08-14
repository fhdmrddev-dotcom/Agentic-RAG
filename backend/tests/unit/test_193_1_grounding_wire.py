"""Phase 193.1 Plan 03 — the mechanism the whole phase rests on, pinned mechanically.

WHAT THIS FILE DEFENDS, in one sentence: ``template_placeholders`` is **not a hint** — it
FLIPS A BRANCH, and before this file **nothing in this repository asserted either half of
that branch**.

THE MECHANISM (D-19, traced across four hops in ``193.1-RESEARCH.md`` §B and re-verified at
this commit):

  1. ``GenerateRequest.template_placeholders: list[str] | None``  — ``api/workflows.py:1547``
  2. route -> service, keyword-forwarded                          — ``api/workflows.py:1583``
  3. ``generate_workflow_definition`` -> ``_assemble_grounding``  — ``workflow_authoring.py:242``,
     ``:298``, ``:172``/``:197`` -> ``harness/grounding.py:345``
  4. resolver -> bundle -> **prompt** — ``grounding.py:288-289`` returns a SUPPLIED list
     verbatim as ``"ok"``; ``:507-513`` resolves; ``:523`` puts it on
     ``GroundingBundle.placeholders``; ``render_grounding_prompt`` at ``:576-577`` RENDERS it.

  The grounded prompt is then the FIRST user message (``workflow_authoring.py:301-303``).

WHY THE RENDER IS THE WHOLE MECHANISM. ``AUTHORING_SYSTEM_PROMPT``
(``workflow_authoring.py:82-91``, passed as ``system_prompt`` at ``:316``) carries a rule
labelled *"DELIVERABLE RULE (CRITICAL — a wrong choice makes the workflow unpublishable)"*
whose **entire condition is that one rendered section**:

  * names PRESENT  => the deliverable may be ``llm_emit`` with ``emitter: 'render_template'``
  * names ABSENT   => the deliverable **MUST be plain text** and ``render_template`` is
    FORBIDDEN — *"at run time it fails with ``no_template_bound`` and the workflow can NEVER
    publish"*.

Two consequences these assertions exist to defend:

  1. Today the frontend sends nothing, the section always renders ``(none)``, and clause (b)
     always fires — so **every draft is ACTIVELY STEERED AWAY from templates**. That is the
     real mechanism behind ``SEED-157``, not merely a parameter nobody sent.
  2. An unbound ``render_template`` draft is **terminal at run** — ``phase_types.py:1271``,
     substep ``no_template_bound``, verified at this commit. So the wire and the bind cannot
     ship apart, which is why plan 07 holds both in one task.

**A prompt edit that dropped clause (b) would silently restore SEED-157 with every gate
green.** That is the failure this file makes impossible, and it is why the assertions are on
the RULE and not only on the render.

SCOPE — deliberately mechanical. This is the mechanical half of SC#2 and it makes **no
provider call**: no network, no mocked model, no emit path. The REAL half is plan 04's live
call, sequenced early on purpose (D-23) because a stub proves the wire and never the
grounding — the 101.1 precedent, where run ``7fa36d2a`` failed because a model that had never
seen the placeholders invented its own key names.

⚠ ACCEPTED, BOUNDED, PRE-EXISTING RISK — stated here rather than "fixed" (T-193.1-03-01).
A ``.docx`` can carry a placeholder literally spelled ``ignore_previous_instructions``, and
it lands VERBATIM in the authoring prompt. ``test_a_name_carrying_injection_text_is_rendered_verbatim``
asserts exactly that, so the exposure is a MEASURED FACT in the suite rather than a sentence
in a document a later audit can "discover". It is **pre-existing since Phase 103** — the same
path has been reachable via ``template_asset_id`` all along — and this plan neither introduces
nor closes it. What bounds it, and what a reader should check before proposing a mitigation:

  * server-side grounding FIDELITY enforcement applied AFTER the emit
    (``_check_grounding_fidelity``, ``workflow_authoring.py:203-230``) — folder scopes must be
    inside the bound project subtree, tool names must be in the real registry, ``skill_ref``
    must be in the enabled set; and
  * ``extra="forbid"`` on the emitted schema, which rejects invented keys.

A definition steered by injected prose still has to survive both.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

_USER = "3f2b0a11-1111-4c1e-9a00-00000000beef"
_ASSET = "00000000-0000-4000-8000-000000000001"

# ── The heading literals, each spelled EXACTLY ONCE in this file ──────────────────────
#
# One spelling apiece on purpose: a second copy in a docblock or a second assertion would
# make the exactly-once fence below read as a coincidence rather than a property. A SECOND
# grounding section in the rendered prompt is a silent duplication — the model would see two
# answers to "what template fields exist", and the DELIVERABLE RULE branches on that section.
# Hence the count, not merely the presence.
#
# ⚠ DECLARED RE-CAPTURE, 1 of 1 — 2026-08-14, plan `193.1-11`, decision **D-26**.
#
# Until this commit there was ONE constant here:
#
#   "### Template placeholder fields (if the workflow must fill a template)"
#
# and it served BOTH meanings — the arm where a template exists and the arm where it does
# not. **That was the defect, not merely the pin's subject.** Plan `193.1-04` drove six real
# `/generate` calls and measured the hedge buying nothing: with the names sent under it, a
# `render_template` deliverable appeared **0 times out of 3**; with an explicit statement of
# provision, **2 out of 2** (`193.1-UAT.md` row U1). `render_grounding_prompt` now branches,
# so the pin branches with it.
#
# ⚠ THE GUARD NOTICED, WHICH IS THE MECHANISM WORKING. On the pre-edit run — the source
# already changed, this file untouched — FOUR cases RED'd, every one of them heading-derived
# because `_section_line` applies the count fence on every read (the same coupling
# `193.1-03-SUMMARY.md` recorded when its plant-3 duplication RED'd three cases at once):
# `test_every_supplied_name_reaches_the_prompt`,
# `test_the_section_heading_appears_exactly_once`,
# `test_an_empty_list_renders_the_literal_none_and_no_name_anywhere` and
# `test_a_name_carrying_injection_text_is_rendered_verbatim`. **Nothing else moved** — the
# DELIVERABLE RULE fence, the terminal-failure fence, the supplied-list short circuit, the
# two `degraded` membership cases and the `degraded` positive control all stayed green.
_HEADING_PRESENT = (
    "### Template placeholder fields — the user HAS attached a template document to this "
    "workflow; the final deliverable MUST therefore be an `llm_emit` phase with "
    "`emitter: 'render_template'` that fills EXACTLY the fields named on the next line"
)
_HEADING_ABSENT = (
    "### Template placeholder fields — NO template document was provided with this "
    "workflow; the final deliverable MUST therefore be PLAIN TEXT / markdown, and a "
    "`render_template` emit phase is FORBIDDEN because it would fail at run time"
)

# The eight REAL field names, parsed from `pm-weekly-status-report.docx` during quick task
# 260814-q5r. Real placeholders are NOUNS (real phase slugs are verbs) — using the real set
# keeps this suite's fixture derived rather than invented (the 193.1-CONTEXT D-20 warning).
_EIGHT_NAMES = [
    "accomplishments",
    "milestones",
    "overall_rag_status",
    "planned_next",
    "project_name",
    "reporting_period",
    "risks_blockers",
    "summary",
]

_INJECTION_NAME = "ignore_previous_instructions"


# ── Helpers ───────────────────────────────────────────────────────────────────────────
def _bundle(placeholders):
    """A bundle carrying ONLY the axis under test. Every other field keeps its default, so a
    failure here can only be about the placeholder render."""
    from app.services.harness.grounding import GroundingBundle

    return GroundingBundle(placeholders=list(placeholders))


def _render(placeholders) -> str:
    from app.services.harness.grounding import render_grounding_prompt

    return render_grounding_prompt(_bundle(placeholders), None)


def _section_line(rendered: str) -> str:
    """The ONE line that follows the heading — and the count fence, applied on every read.

    Parsing the section out (rather than asserting over the whole prompt) is what makes the
    per-name assertions EXACT: eight names joined by ", " would satisfy a substring check on
    the joined form even if the join shape changed, and a name that leaked into a DIFFERENT
    section would pass a whole-prompt containment check while being invisible to the rule
    that branches on this one.
    """
    n_present = rendered.count(_HEADING_PRESENT)
    n_absent = rendered.count(_HEADING_ABSENT)
    assert n_present + n_absent == 1, (
        "the grounding section heading must appear EXACTLY once in the rendered prompt; "
        f"found {n_present} present-arm and {n_absent} absent-arm headings"
    )
    heading = _HEADING_PRESENT if n_present else _HEADING_ABSENT
    return rendered.split(heading, 1)[1].lstrip("\n").split("\n")[0]


def _rendered_names(rendered: str) -> list[str]:
    return [n.strip() for n in _section_line(rendered).split(",") if n.strip()]


# ── 1. The names reach the prompt ─────────────────────────────────────────────────────
def test_every_supplied_name_reaches_the_prompt():
    """SC#2's mechanical half. Membership is asserted PER NAME against the parsed section —
    never as one containment check over the joined string."""
    names = _rendered_names(_render(_EIGHT_NAMES))

    for name in _EIGHT_NAMES:
        assert name in names, f"{name!r} never reached the grounding prompt"
    assert names == _EIGHT_NAMES, (
        "the section must carry the supplied names, in order, and nothing else"
    )


def test_the_section_heading_appears_exactly_once():
    """Asserted on BOTH arms, because a duplicated section is equally wrong when empty.

    ⚠ Re-pinned at D-26 and STRICTLY STRONGER than the assertion it replaces. The old form
    counted ONE constant, so a render that emitted two DIFFERENT template sections — the
    exact shape a careless two-arm branch produces — would have counted 1 and passed. The
    fence is now over the SUM of both arms, and each arm is additionally asserted to carry
    its own heading and NOT the other's.
    """
    present = _render(_EIGHT_NAMES)
    absent = _render([])

    assert present.count(_HEADING_PRESENT) == 1
    assert present.count(_HEADING_ABSENT) == 0
    assert absent.count(_HEADING_ABSENT) == 1
    assert absent.count(_HEADING_PRESENT) == 0


def test_an_empty_list_renders_the_literal_none_and_no_name_anywhere():
    """The arm that fires TODAY on every single draft, and the reason SEED-157 exists.

    The frontend sends nothing, so this is the section every real ``/generate`` has rendered
    since Phase 103 — which makes the DELIVERABLE RULE's clause (b) fire every time.
    """
    rendered = _render([])

    assert _section_line(rendered) == "(none)"
    for name in _EIGHT_NAMES:
        assert name not in rendered, (
            f"{name!r} appeared in a prompt built from an EMPTY placeholder list"
        )


def test_the_two_arms_assert_opposite_facts_and_share_no_sentence():
    """⚠ THE CASE THE OLD SUITE COULD NOT HAVE HAD, and the one that pins **D-26** itself.

    Before 2026-08-14 ONE string served both meanings — *"### Template placeholder fields
    (if the workflow must fill a template)"* — so there was no distinction to assert. That
    was measured to be the defect: with the names sent under that hedge, a
    ``render_template`` deliverable appeared **0 times out of 3** on real ``/generate``
    calls, and **2 out of 2** once provision was stated outright (``193.1-UAT.md`` row U1).
    A suite that pinned only the present arm would let the two collapse back into one
    string and never notice.

    Three properties, and each is a different way the regression could arrive:

      1. **The present arm asserts PROVISION and licenses the branch.** Not merely that the
         names render — the model was already getting the names and declining anyway.
      2. **The absent arm asserts ABSENCE and forbids the branch.** ⚠ This one is a
         correctness requirement, not symmetry: a ``render_template`` phase with no
         template bound is TERMINAL at run (``no_template_bound``,
         ``phase_types.py:1271``) and can NEVER publish, so an absent arm weakened toward
         templates trades a slow deliverable for an impossible one. SC#4 (*the fast door
         stays fast*) and D-08 both rest on this arm, and Call A measured it already
         behaving correctly — this pin is what keeps it that way.
      3. **They share no sentence.** Segment-wise, not merely "the strings differ": one
         string that could be read as either meaning is exactly what D-26 removed.
    """
    present = _render(_EIGHT_NAMES)
    absent = _render([])

    # 1. the present arm states a file EXISTS and names the deliverable it licenses
    assert "HAS attached a template document" in present
    assert "`emitter: 'render_template'`" in present
    assert "fills EXACTLY the fields" in present

    # 2. the absent arm states the opposite and FORBIDS the branch
    assert "NO template document was provided" in absent
    assert "PLAIN TEXT / markdown" in absent
    assert "FORBIDDEN" in absent

    # neither arm may leak the other's claim
    assert "HAS attached a template document" not in absent
    assert "NO template document was provided" not in present
    assert "render_template" not in _section_line(absent)

    # 3. no shared SENTENCE — segments split on the separators the two headings use
    def _segments(text: str) -> set[str]:
        line = [ln for ln in text.splitlines() if ln.startswith("### Template")][0]
        parts: list[str] = []
        for chunk in line.split(";"):
            parts.extend(chunk.split(". "))
        return {p.strip() for p in parts if p.strip()}

    shared = _segments(present) & _segments(absent)
    assert shared == set(), (
        "the two template arms share a sentence, so one could be mistaken for the other — "
        f"which is the D-26 defect this case exists to prevent: {sorted(shared)!r}"
    )


@pytest.mark.asyncio
async def test_a_supplied_list_short_circuits_verbatim_and_reads_no_storage(monkeypatch):
    """``grounding.py:288-289`` — a SUPPLIED list is returned verbatim as ``"ok"`` and the
    Storage round trip never happens.

    The asset id is supplied TOO, on purpose: without the short circuit this call would take
    the resolve branch, so the recorder staying empty is a statement about control flow and
    not merely about the return value. Note the resolver swallows exceptions by design
    (``:324-326``), so a bypass would surface as ``("unreadable", [])`` — which is why the
    recorder, not the raise, is the load-bearing assertion.
    """
    import app.services.template_asset_service as tas
    from app.services.harness import grounding

    reached: list[str] = []

    async def _must_not_run(**kwargs):
        reached.append(str(kwargs.get("asset_ref")))
        raise AssertionError("the supplied-list short circuit was bypassed")

    monkeypatch.setattr(tas, "resolve_template_source", _must_not_run)

    supplied = list(reversed(_EIGHT_NAMES))
    names, read = await grounding.resolve_template_placeholders(
        supabase=MagicMock(),
        pool=None,
        user_id=_USER,
        template_asset_id=_ASSET,
        template_placeholders=supplied,
    )

    assert reached == [], "a supplied list must never trigger a Storage read"
    assert read == "ok"
    assert names == supplied, "pass-through, NOT re-sorted (the shipped behaviour)"


# ── 2. The rule that BRANCHES on the section ──────────────────────────────────────────
def test_the_deliverable_rule_carries_both_clauses_and_the_consequence():
    """⚠ THIS IS THE ONLY BRANCH THAT MAKES ``template_placeholders`` MATTER, and nothing
    else in this repository asserts it.

    Both clauses are pinned by their load-bearing fragments, plus the run-time consequence:

      (a) ``render_template`` is permitted ONLY when the grounding lists placeholders;
      (b) when NO template is listed the deliverable MUST be plain text.

    Dropping clause (b) is the edit that would silently restore SEED-157 with every gate
    green — the model would be free to author a ``render_template`` phase for a workflow with
    no template bound, which is UNPUBLISHABLE and TERMINAL at run
    (``phase_types.py:1271``, substep ``no_template_bound``).

    Dropping clause (a) is the opposite failure and just as invisible: the wire this phase
    ships would carry the names into the prompt and no rule would tell the model what they
    licence, so plan 04's live call could pass on one draft and fail on the next.
    """
    from app.services.workflow_authoring import AUTHORING_SYSTEM_PROMPT as rule

    assert "DELIVERABLE RULE (CRITICAL" in rule

    # (a) — permitted ONLY when the grounding lists placeholders
    assert "ONLY when the grounding explicitly lists template placeholders" in rule

    # (b) — plain text when NO template is listed
    assert (
        "When NO template is listed in the grounding, the final deliverable MUST be "
        "PLAIN TEXT / markdown" in rule
    )
    assert "NEVER create a `render_template` emit phase without a provided template" in rule

    # the consequence that makes (b) a correctness rule rather than a style preference
    assert "no_template_bound" in rule
    assert "can NEVER publish" in rule


def test_the_terminal_run_time_failure_the_rule_names_really_exists():
    """The rule's threat is checkable, so it is checked: ``no_template_bound`` is a real
    substep the emit executor really reaches when no bytes resolve
    (``phase_types.py:1263-1275``). A rule that threatened a code the engine never emits
    would be prose."""
    from app.services.harness import phase_types

    source = __import__("inspect").getsource(phase_types)
    assert 'failure="no_template_bound"' in source
    assert '_emit_failure_output("no_template_bound"' in source


# ── 3. The accepted, bounded, pre-existing injection surface ──────────────────────────
def test_a_name_carrying_injection_text_is_rendered_verbatim():
    """⚠ ACCEPTED AND BOUNDED — see this module's docblock (T-193.1-03-01).

    A placeholder name parsed from an attacker-supplied document reaches the authoring prompt
    with NO escaping, sanitisation or filtering. This asserts that fact rather than hiding
    it, so the exposure is measured rather than discovered later.

    PRE-EXISTING since Phase 103 via ``template_asset_id``; this plan neither introduces nor
    closes it, and deliberately attempts NO mitigation it did not scope. What bounds it:
    ``_check_grounding_fidelity`` (``workflow_authoring.py:203-230``) is applied server-side
    AFTER the emit — folder scopes must be inside the bound project subtree, tool names must
    be in the real registry, ``skill_ref`` must be in the enabled set — and ``extra="forbid"``
    rejects invented keys. Prose can steer the model; it cannot widen those three sets.
    """
    rendered = _render([_INJECTION_NAME, "project_name"])

    assert _rendered_names(rendered) == [_INJECTION_NAME, "project_name"]


# ── 4. A template-read failure may NEVER enter ``degraded`` ───────────────────────────
#
# ⚠ A CORRECTION STATED BESIDE THE ORIGINAL, NOT OVER IT.
#
# The shipped pin is ``test_grounding_bundle_has_no_template_read_axis``
# (``tests/unit/test_q5r_template_placeholders.py:324-335``). It is CREDITED — in that test's
# own docblock, in ``resolve_template_placeholders``'s docblock (``grounding.py:279-286``) and
# in this project's ``CLAUDE.md`` hot-file row for ``grounding.py`` — with defending the rule
# *"a template-read failure must NEVER enter ``degraded``"*.
#
# **It does not defend that rule.** Measured: it asserts the ABSENCE OF FIELDS
# (``template_read`` / ``read``) on the ``GroundingBundle`` DATACLASS. A future
# ``degraded.add("template")`` inside ``assemble_grounding_bundle`` adds no field to the
# dataclass, so that test stays GREEN through exactly the change it is quoted as preventing.
# The original assertion is CORRECT about what it checks and is left untouched and still
# green; the two cases below add the membership property it never covered.
#
# WHY IT MATTERS — the consumers, named so a reader can see what a template code would do:
# ``bundle.degraded`` feeds ``grounding_unavailable_finding`` (``grounding.py:615``), which is
# emitted by ``POST /workflows/validate`` AND by the publish gauntlet. A document-read blip
# would therefore become a VALIDATION FINDING and change PUBLISH behaviour — far outside the
# template concern, on a definition that is actually correct. That is the WR-01 failure shape
# (a vacuously-false membership test read by the author as a factual accusation), which is the
# whole reason ``degraded`` suppresses the fidelity rules rather than reporting them.

# Substrings that would make a degraded code template-shaped. The check is over the WHOLE SET
# and over the WORD SHAPE — not equality against one guessed code — because the defect this
# guards is a future author adding *some* template code, not the specific one we imagined.
_TEMPLATE_WORDS = ("template", "placeholder", "docx", "asset")


def _template_offenders(degraded) -> list[str]:
    return sorted(c for c in degraded if any(w in str(c).lower() for w in _TEMPLATE_WORDS))


def _assert_no_template_code(degraded) -> None:
    offenders = _template_offenders(degraded)
    assert offenders == [], (
        "a template-read axis entered bundle.degraded: "
        f"{offenders!r} (whole set: {sorted(degraded)!r}). That set feeds "
        "grounding_unavailable_finding, consumed by POST /workflows/validate and by the "
        "publish gauntlet — a document-read blip must never become a validation finding."
    )


def test_the_degraded_predicate_itself_fires_on_a_template_shaped_code():
    """⚠ THE POSITIVE CONTROL, and it is load-bearing rather than decorative.

    MEASURED at this commit: under the offline ``MagicMock`` posture the two guarded reads in
    ``assemble_grounding_bundle`` do NOT raise, so ``bundle.degraded`` comes back **EMPTY** in
    both cases below. An "is empty of template codes" assertion over an empty set is
    vacuously true, and a fence that can only ever be true is not a fence.

    Two things fix that, and both were done rather than one:
      * this control, which pins the PREDICATE against a synthetic set and therefore keeps
        firing forever (a typo in ``_TEMPLATE_WORDS`` would red HERE); and
      * a one-time RED plant of ``degraded.add("template")`` inside
        ``assemble_grounding_bundle``, observed failing and then restored byte-identical —
        recorded in ``193.1-03-SUMMARY.md``, because a fence nobody has seen fire is a fence
        nobody knows is connected.

    Stating the vacuity rather than hiding it is the point: the next reader must not inherit
    "the degraded cases are green" as though it meant "a template code would have been caught".
    """
    assert _template_offenders(frozenset({"folders", "skills"})) == []
    assert _template_offenders(frozenset({"folders", "template"})) == ["template"]
    assert _template_offenders(frozenset({"template_read"})) == ["template_read"]
    assert _template_offenders(frozenset({"placeholders"})) == ["placeholders"]


@pytest.mark.asyncio
async def test_a_SUCCESSFUL_template_read_puts_no_template_code_in_degraded():
    """The supplied-list arm — ``read == "ok"`` — carried through the real assembler.

    ``bundle.placeholders`` is asserted first as anti-vacuity: it proves the template axis was
    actually exercised on this call, so the empty-offender result below is a statement about
    ``degraded`` rather than about a code path that never ran.
    """
    from app.services.harness.grounding import assemble_grounding_bundle

    bundle = await assemble_grounding_bundle(
        supabase=MagicMock(),
        user_id=_USER,
        template_placeholders=_EIGHT_NAMES,
    )

    assert bundle.placeholders == _EIGHT_NAMES  # anti-vacuity: the template axis really ran
    _assert_no_template_code(bundle.degraded)


@pytest.mark.asyncio
async def test_a_FAILED_template_read_puts_no_template_code_in_degraded(monkeypatch):
    """The arm that matters: the Storage read RAISES, the resolver answers ``"unreadable"``,
    and ``degraded`` still carries nothing template-shaped.

    ``assemble_grounding_bundle`` unpacks the status and discards it (``grounding.py:504-513``,
    with the comment saying so). This is the case that would RED on a
    ``degraded.add("template")`` and that the shipped dataclass-field pin cannot see.
    """
    import app.services.template_asset_service as tas
    from app.services.harness.grounding import assemble_grounding_bundle

    async def _explode(**kwargs):
        raise RuntimeError("storage object is gone")

    monkeypatch.setattr(tas, "resolve_template_source", _explode)

    bundle = await assemble_grounding_bundle(
        supabase=MagicMock(),
        user_id=_USER,
        template_asset_id=_ASSET,
    )

    assert bundle.placeholders == []  # anti-vacuity: the read really did fail
    _assert_no_template_code(bundle.degraded)
