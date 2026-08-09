"""Phase 187-28 (GAP C · VOCAB-02) — how far a ROUTE-ASSIGNED verdict code actually reaches.

`app/api/workflows.py` used to claim, in the comment block above `_ROUTE_ASSIGNED_CODES`, that
those codes were confined to the canvas and therefore left publishing untouched from the
author's seat. Measured live on 2026-08-04 in the Builder, the second half of that sentence is
FALSE: a draft whose SOLE verdict is `unbound_retrieval` renders a DISABLED `publish-trigger`
with the route's own message beside it. Plan 187-28 corrected the comment. This file is the
half of the evidence that keeps it corrected — a docblock asserting a property the code does
not have is exactly the WR-14 defect class, and a correction with no fence under it is just a
second unmeasured claim.

THE CORRECTED SENTENCE HAS TWO HALVES, AND THEY ARE MEASURED IN TWO PLACES:

  * the TRUE half — a route-assigned code never reaches the SERVER publish gate, because it
    never enters the collector that gate enforces through (`grounding.grounding_verdicts`,
    made enforcing by plan 182-06).                    ← **THIS FILE OWNS IT**
  * the GATED half — a route-assigned code DOES gate the CLIENT publish CONTROL, and that is
    intended (`BUG-260731-03`, operator decision 2026-08-04).
    ← owned by `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`, describe block
      "187-28 — a route-assigned verdict GATES the Publish control".

WHY A NEW FILE RATHER THAN AN EXTENSION OF `test_182_severity_codes.py`. That file's docstring
states its convention outright: *"plain sync tests — `_severity` is a pure function, so no
event loop, no DB, no provider, nothing to patch."* The behavioural half here CALLS
`grounding_verdicts`, which is `async` and takes a `supabase` handle, so it needs an event loop
and a monkeypatched ⊆ seam. Adding that to the pure-function scanner suite would break a stated
convention to save a file. What the scanner suite already owns is named rather than copied:
`test_182_severity_codes.py::test_known_codes_compose_from_the_owning_modules_with_no_orphan`
pins `_ROUTE_ASSIGNED_CODES`'s exact MEMBERSHIP against the literal three codes (and therefore
its size), so the inventory comment's digit has a real guard beneath it — nothing here
duplicates that assertion. The same file's
`test_unbound_retrieval_classifies_incomplete_without_taking_the_loud_branch` pins the
fail-loud branch for ONE code; the version below quantifies the same claim over the whole SET,
which is the difference between an example and a property.

CONVENTION: imports INSIDE the test bodies (Phase 102 posture), matching every sibling in this
directory.
"""

from __future__ import annotations

from pathlib import Path

import pytest

_TESTS_DIR = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _TESTS_DIR.parent
_WORKFLOWS_PY = _BACKEND_DIR / "app" / "api" / "workflows.py"

_USER = "00000000-0000-0000-0000-000000000001"
_PROJECT = "11111111-1111-1111-1111-111111111111"


# ── definition builder (shape-valid; mirrors test_182_validate.py) ────────────


def _definition(phases: list[dict], **extra) -> dict:
    base = {
        "slug": "reach-wf",
        "version": 1,
        "name": "Reach Workflow",
        "status": "draft",
        "business_requirement": "Deliver a cited answer to the requester.",
        "phases": phases,
    }
    base.update(extra)
    return base


def _agent(slug: str, index: int, *, tools: list[str], skill_ref: str | None = None) -> dict:
    cfg: dict = {
        "phase_type": "llm_agent",
        "prompt": "Research the topic.",
        "available_tools": tools,
    }
    if skill_ref is not None:
        cfg["skill_ref"] = skill_ref
    return {"slug": slug, "phase_index": index, "config": cfg, "validators": []}


# ═══════════════════════════════════════════════════════════════════════════════
# THE PROPERTY — the TRUE half of the corrected sentence, MEASURED.
#
# Quantified over the SET every time. A hand-picked `unbound_retrieval` assertion would
# still pass on the day a FOURTH route-assigned code is added straight into the shared
# collector, which is the drift this file exists to catch.
# ═══════════════════════════════════════════════════════════════════════════════


def test_no_route_assigned_code_is_published_by_an_owning_module():
    """PROPERTY 1 — no member of `_ROUTE_ASSIGNED_CODES` appears in either owning module's set.

    `grounding.GROUNDING_VERDICT_CODES` is the vocabulary of the collector the PUBLISH gate
    enforces through (182-06). A route-assigned code that leaked into it would silently
    become a hard server publish blocker — the outcome the route placement exists to avoid,
    and the one half of the old comment that was always true.
    """
    from app.api import workflows
    from app.services.harness import grounding, reachability

    route_codes = set(workflows._ROUTE_ASSIGNED_CODES)

    # Not vacuous: the set is non-empty, so the quantifier below has something to range over.
    assert route_codes, (
        "_ROUTE_ASSIGNED_CODES is EMPTY — every assertion in this file would then hold "
        "vacuously. The route mints codes; if it stopped, delete this file deliberately "
        "rather than letting it pass over nothing."
    )

    leaked = route_codes & set(grounding.GROUNDING_VERDICT_CODES)
    assert leaked == set(), (
        f"a ROUTE-assigned code entered the SHARED grounding collector: {sorted(leaked)}. "
        "`grounding.grounding_verdicts` is what the publish gate enforces through (182-06), "
        "so this code now blocks a real publish server-side — not just the client's Publish "
        "control. That is the one thing D-187-11's route placement is for. Either move it "
        "back to the route, or make the decision to change the SERVER gate explicitly."
    )
    assert route_codes.isdisjoint(set(reachability.LINT_CODES)), (
        f"a ROUTE-assigned code collided with a structural lint code: "
        f"{sorted(route_codes & set(reachability.LINT_CODES))} — one of them must move"
    )


@pytest.mark.asyncio
async def test_grounding_verdicts_emits_no_route_assigned_code_for_any_input_we_can_build(
    monkeypatch,
):
    """PROPERTY 2 — the BEHAVIOURAL form: the collector never *emits* a route-assigned code.

    Property 1 reads the published constant; this one drives the real function. Both are
    needed, because the constant and the emit sites are two different things that can drift
    apart (that is precisely what `test_182_severity_codes.py`'s drift scanners exist for,
    from the other direction).

    All three grounding rules are made to fire AT ONCE, so the returned list is as wide as
    this collector can be made — and the assertion is over that whole list.
    """
    from app.api import workflows
    from app.models.harness import WorkflowDefinition
    from app.services.harness import grounding
    import app.services.harness.scope as scope_mod

    # Rule 1: stub the ONE ⊆ walk (the Phase-103 / Phase-182 monkeypatch seam) so it reports
    # a violation without a DB. The collector maps `(str(exc), exc.phase_slug)` off whatever
    # this returns.
    class _Violation(ValueError):
        def __init__(self, slug: str) -> None:
            super().__init__(f"phase {slug!r} declares a folder outside the project subtree")
            self.phase_slug = slug

    async def _violations(definition, *, supabase, user_id, restrict_org_ids=None):
        return [_Violation("research"), _Violation("draft")]

    monkeypatch.setattr(scope_mod, "folder_scope_violations", _violations)

    wd = WorkflowDefinition.model_validate(
        _definition(
            [
                # Rule 2: a tool the registry does not know. Rule 3: an unknown skill_ref.
                _agent(
                    "research",
                    0,
                    tools=["search_documents", "a_tool_no_registry_has"],
                    skill_ref="99999999-9999-9999-9999-999999999999",
                ),
                _agent("draft", 1, tools=["another_unregistered_tool"]),
            ],
            project_folder_id=_PROJECT,
        )
    )

    emitted = await grounding.grounding_verdicts(
        wd,
        supabase=object(),
        user_id=_USER,
        tool_names={"search_documents"},
        skill_ids=set(),
    )
    codes = {v["code"] for v in emitted}

    # POSITIVE CONTROL FIRST — a collector that returned nothing would make the real
    # assertion below pass over an empty set, which is the classic vacuous green. Stated as
    # a SUBSET rather than an equality on purpose: an equality would fail here the instant
    # the collector emitted a route-assigned code, so the disjointness assertion below could
    # never be the thing that goes red, and the fence would be measuring the fixture instead
    # of the property (observed while writing probe P-24).
    assert set(grounding.GROUNDING_VERDICT_CODES) <= codes, (
        "the fixture was meant to fire ALL THREE grounding rules at once so the emitted set "
        f"is as wide as this collector gets. Got {sorted(codes)}, expected at least "
        f"{sorted(grounding.GROUNDING_VERDICT_CODES)} — fix the fixture before trusting the "
        "disjointness assertion below, which would otherwise be measuring a short list."
    )

    offenders = codes & set(workflows._ROUTE_ASSIGNED_CODES)
    assert offenders == set(), (
        f"`grounding_verdicts` EMITTED a route-assigned code: {sorted(offenders)}. The "
        "publish gate runs this exact collector, so that code is now a hard server publish "
        "blocker (D-187-11 places these codes on the route to prevent precisely this)."
    )


def test_every_route_assigned_code_is_classified_without_the_fail_loud_branch(caplog):
    """PROPERTY 3 — `_severity` never falls through to the fail-loud default for these codes.

    `test_182_severity_codes.py::test_unbound_retrieval_classifies_incomplete_without_taking_
    the_loud_branch` already proves this for ONE code. It is NOT duplicated — this is the
    SET-quantified form, which is what makes it survive a fourth route-assigned code being
    added: a code registered in `_ROUTE_ASSIGNED_CODES` (so `_KNOWN_CODES` contains it) but
    in NEITHER severity bucket lands in the derived `_ERROR_CODES` silently, and a code in
    neither set at all lands there LOUDLY, logging a warning on every single canvas edit.
    """
    import logging

    from app.api import workflows

    incomplete = set(workflows._INCOMPLETE_CODES)
    errors = set(workflows._ERROR_CODES)
    dual = set(workflows._DUAL_SOURCE_CODES)

    for code in sorted(workflows._ROUTE_ASSIGNED_CODES):
        assert code in workflows._KNOWN_CODES, (
            f"{code!r} is minted by the route but is not in `_KNOWN_CODES` — "
            "`_severity` will classify it through the unknown branch"
        )
        assert (code in incomplete) ^ (code in errors), (
            f"{code!r} belongs to {'BOTH' if code in incomplete and code in errors else 'NEITHER'} "
            "severity bucket — the taxonomy must claim it exactly once"
        )
        assert code not in dual, (
            f"{code!r} is registered as dual-source; the route mints it from ONE condition"
        )

        with caplog.at_level(logging.WARNING, logger="app.api.workflows"):
            caplog.clear()
            severity = workflows._severity(code, phases_empty=False)

        assert severity in {"error", "incomplete"}
        assert code not in caplog.text, (
            f"{code!r} reached the fail-loud UNKNOWN branch of `_severity` — it would log a "
            "warning on EVERY canvas edit that produces it. Register it in "
            "`_ROUTE_ASSIGNED_CODES` AND (if it is a still-building condition) in "
            "`_INCOMPLETE_CODES`."
        )


# ═══════════════════════════════════════════════════════════════════════════════
# THE REGRESSION PIN — RANKED BENEATH THE PROPERTIES ABOVE, DELIBERATELY.
#
# ⚠ THIS IS A PIN, NOT A FENCE. Everything above measures BEHAVIOUR; everything below
# greps SOURCE for two specific stale phrases. A deny-list of phrases cannot be made
# fail-closed by adding more phrases — the Phase-185 lesson (WR-12's whole existence), and
# the reason this section is at the BOTTOM of the file and says so out loud. Somebody can
# restate the false claim in words nobody listed here and this pin will stay green; the
# properties above are what actually hold the line, because they measure the world instead
# of the prose. The pin's only job is to stop THIS EXACT sentence coming back by copy-paste.
#
# THE NEEDLES ARE ASSEMBLED FROM PARTS so this test file's own source cannot satisfy them
# (the conflict plan 187-25 hit: a guard that greps for a string it also contains). Each one
# carries a POSITIVE CONTROL proving the matcher can fire, so an unmatchable needle fails
# here instead of passing everywhere.
# ═══════════════════════════════════════════════════════════════════════════════


def _module_source() -> str:
    return _WORKFLOWS_PY.read_text(encoding="utf-8")


# Assembled at import time from fragments; the joined form appears nowhere in this file.
_NEEDLE_CANVAS_ONLY = "canvas" + "-" + "only"
_NEEDLE_NOT_SCOPED = "scoped to change what " + "publishes"


def test_the_needles_can_actually_match(caplog):
    """PIN TEETH — the positive controls. An unmatchable needle would pass vacuously forever.

    Each control is a synthetic line carrying the assembled needle. If the fragments are ever
    mis-joined (a typo, a hyphen lost to a formatter) this fails HERE, loudly, rather than
    quietly turning the pin below into a no-op.
    """
    control_a = "The route is the only seam where a verdict can be " + _NEEDLE_CANVAS_ONLY + "."
    control_b = "Phase 187 is not " + _NEEDLE_NOT_SCOPED + "; it tells the author sooner."

    assert _NEEDLE_CANVAS_ONLY in control_a
    assert _NEEDLE_NOT_SCOPED in control_b
    # …and each needle is specific: neither matches the other's control.
    assert _NEEDLE_CANVAS_ONLY not in control_b
    assert _NEEDLE_NOT_SCOPED not in control_a
    # …and a clean sentence matches neither, so the pin is not matching everything.
    clean = "The route keeps this verdict out of the SERVER publish gate."
    assert _NEEDLE_CANVAS_ONLY not in clean
    assert _NEEDLE_NOT_SCOPED not in clean


def test_the_stale_claim_phrases_are_gone_from_the_module():
    """PIN — the two phrases from the pre-187-28 comment are absent from `workflows.py`.

    Both were measured false end-to-end in the live Builder on 2026-08-04. The corrected
    block PARAPHRASES the old claim and points at commit `a68132db` for the original wording
    rather than requoting it — a verbatim quote, even one framed as "this used to say", would
    satisfy this pin and disarm it.
    """
    source = _module_source()

    assert _NEEDLE_CANVAS_ONLY not in source, (
        f"`app/api/workflows.py` says {_NEEDLE_CANVAS_ONLY!r} again. That word was measured "
        "FALSE from the author's seat: an `ok:false` envelope carrying only this route's "
        "codes disables the Publish control (see the `blockedReason` memo in "
        "`frontend/src/pages/WorkflowBuilderPage.tsx`). If the claim is being restated, say "
        "SERVER publish gate — that is the part that is genuinely untouched."
    )
    assert _NEEDLE_NOT_SCOPED not in source, (
        f"`app/api/workflows.py` says {_NEEDLE_NOT_SCOPED!r} again. Phase 187 DID change what "
        "the author can publish — deliberately, per BUG-260731-03 and the operator decision "
        "of 2026-08-04. What it did not change is the SERVER gate."
    )


def test_the_inventory_comment_states_the_real_set_size():
    """PIN — the inventory line's DIGIT is derived from the set, so it cannot drift again.

    The block above `_ROUTE_ASSIGNED_CODES` used to say *"the 2 codes THIS route mints
    itself"* while a comment nineteen lines below said *"The three codes the ROUTE mints
    itself"* — the same file contradicting itself about its own set size, in the same block,
    ever since D-187-11 added a third member. Fixing a digit is not a fence; comparing it to
    `len()` is.

    The MEMBERSHIP (and therefore the size) is pinned independently and behaviourally in
    `test_182_severity_codes.py::test_known_codes_compose_from_the_owning_modules_with_no_orphan`
    — this only keeps the PROSE honest about it.
    """
    from app.api import workflows

    n = len(workflows._ROUTE_ASSIGNED_CODES)
    expected = f"the {n} codes THIS route mints itself"

    assert expected in _module_source(), (
        f"the `_ROUTE_ASSIGNED_CODES` inventory line no longer says {expected!r}. The set now "
        f"has {n} members; a comment that disagrees with `len()` is the same defect class this "
        "whole file was written to close (WR-14 — a docblock asserting a property the file "
        "does not have). Update the comment in the SAME commit as the set."
    )
    # TEETH: the matcher is not matching anything shaped like that sentence.
    assert f"the {n + 1} codes THIS route mints itself" not in _module_source()


def test_the_corrected_comment_names_both_halves_and_points_at_its_evidence():
    """PIN — the correction is not merely a deletion of the false words.

    The WR-14 shape 187-24 established: a comment that makes a claim must name the file that
    measures it. This checks the corrected block still distinguishes the two publish surfaces
    and still points at both test files — so a future tidy-up cannot quietly reduce it back to
    an unsourced assertion.
    """
    source = _module_source()

    assert "SERVER publish GATE" in source, (
        "the corrected block no longer names the SERVER publish gate — that is the half that "
        "is genuinely unchanged, and dropping it lets the next reader collapse the two "
        "surfaces again (which is how the original false claim was written)"
    )
    assert "CLIENT publish CONTROL" in source, (
        "the corrected block no longer names the CLIENT publish control — that is the half "
        "that IS gated, and it is the correction's whole point"
    )
    assert "test_187_route_assigned_reach.py" in source, (
        "the comment stopped pointing at the file that measures its server-side half"
    )
    assert "WorkflowBuilderPage.canvas.test.tsx" in source, (
        "the comment stopped pointing at the file that measures its client-side half"
    )
