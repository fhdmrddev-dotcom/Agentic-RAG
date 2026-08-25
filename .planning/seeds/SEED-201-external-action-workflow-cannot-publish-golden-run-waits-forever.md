---
seed_id: SEED-201
title: "A workflow containing an MCP-shaped external_action step cannot publish — blocked at golden_run_error. ⚠ THE ORIGINAL TITLE AND CAUSAL DIAGNOSIS (‘ANY external_action step … stops at the mandatory approval’) WERE REFUTED AT VERIFICATION — see the correction; the CAPABILITY shape publishes fine and has a passing regression test proving it."
created: 2026-08-25
planted_during: Phase 206.2 plan 04, task 3 (the driven round trip) — found by actually pressing ◆ Publish, not by reading code
status: planted
diagnosis_status: CAUSE REFUTED 2026-08-25 at Phase 206.2 verification — the symptom is real and reproduced, the named cause is not. Re-diagnose before scoping any fix.
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-200 (an MCP connection cannot be bound to any step) — the door 206.2 opened; this is the NEXT closed door behind it
  - D-206.2-19 (206.2-01's publish-validator fix) — that fix is CORRECT and PROVED; this blocker is one stage LATER
  - D-04 / Phase 185 (the action-risk checkpoint, "Stop and ask me first" — "That cannot be switched off")
  - Phase 103 (the 8-stage publish gauntlet and its golden run)
trigger_when:
  - ⚠ CORRECTED — Any request to PUBLISH a workflow carrying an MCP-SHAPED external_action step. The original read "every such workflow is affected, not just MCP ones"; that is REFUTED (see the correction block below). The capability shapes publish.
  - Any work on the golden run, the publish gauntlet's stage 3, or unattended run execution
  - Any change to the external_action approval checkpoint's "cannot be switched off" rule
  - The first operator report of "I can Test Run it but I cannot publish it"
---

# ⚠ CORRECTION 2026-08-25 — THE CAUSE NAMED BELOW IS REFUTED. THE SYMPTOM IS NOT.

**Found at Phase 206.2's verification, by an agent that re-derived the claim instead of repeating
it.** The measurement below is real and reproducible: an MCP-shaped `external_action` workflow was
driven through `◆ Publish` and blocked at `golden_run_error`, `published: false`. **Keep that.**

**What is wrong is the CAUSAL STORY** — *"every `external_action` step always stops for approval, so
an unattended golden run waits forever, for every shape"*. That is contradicted by a **passing,
already-shipped regression test**:

- `backend/tests/unit/test_publish_service.py::test_v20_an_external_action_workflow_publishes`
  drives the **real armed checkpoint** through a **real golden-run ctx** for a **capability-shaped**
  step and asserts a **successful publish**. A sibling test is a deliberate fence against exactly
  the hang this seed describes. **Both pass on the current tree** (re-run at verification: `2 passed`).

So the general mechanism is NOT the blocker, and **only the MCP-shaped case was ever actually
driven**. The true cause is very likely something **MCP-connector-specific**, hidden inside the same
broad `except Exception` handler in `backend/app/services/harness/publish_service.py`'s golden-run
path — an exception-swallowing bug that **predates this entire feature** (it dates to Phase 102-09,
commits `78aad9ee` / `18eff014`, long before 206 / 206.1 / 206.2). That is also why SC#3b is a
**discovery in a different subsystem, not a regression Phase 206.2 introduced**, and why G-7 and the
evidence together say it is a phase, never a gap-closure round on 206.2.

⚠ **DO NOT "FIX" THE APPROVAL-CHECKPOINT MECHANISM.** The evidence says it is not the blocker, and
D-04 / Phase 185's *"that cannot be switched off"* rule is a governance guarantee — weakening it to
chase a symptom would trade a publish bug for a safety one.

**Where to start instead:** add an **MCP-shaped mirror** of `test_v20_an_external_action_workflow_publishes`
so the real exception is localized and NAMED, rather than swallowed. The seed's own second finding —
`golden_run_id: null` rendered beside an explanation that contradicts the run which demonstrably
exists — is probably the same swallowed exception seen from the UI side.

**The original measurement and its (refuted) reasoning are preserved verbatim below, never
overwritten** — the way this diagnosis failed is itself the lesson: a symptom driven in a browser is
evidence; the cause inferred from it is a hypothesis, and this one was never tested against the
suite that already covered the sibling case.

---

# The measurement

Driven 2026-08-25 in real Chromium against the live local backend, on a draft carrying one
`external_action` step (MCP shape, DeepWiki, `read_wiki_structure`, granted) plus two LLM steps.
`◆ Publish…` → a golden input typed → **`Publish — run the checks`** pressed. The gauntlet's own
verdict, read verbatim off the modal:

```
✓Owner  ✓Valid  ✓Goal  ✓Structure  ✓Pause  ✓Grounding    Golden run  Citations  Judge  Commit
⛔ Publish was blocked — nothing was published. What stopped it is named below.

published        false
version          null
golden_run_id    null
blocked_stage    golden_run_error
named_failures   ["golden run could not complete: None"]
```

And the corresponding audit rows, in order, at `07:32:00`:

```
phase_started    {"phase": "act", "phase_index": 0}
publish_blocked  {"definition_id": "22a99fa2-…", "blocked_stage": "golden_run_error",
                  "named_failures": ["golden run could not complete: None"], "golden_run_id": null}
```

The golden run `5d67d004-acc6-44b4-95f3-35528868433d` was created, started its first phase, and was
still `status: active` minutes later — **waiting at the external-action approval checkpoint.** It was
cancelled through the UI at teardown.

# Why it happens

An `external_action` step ALWAYS stops for the author's approval before it acts outside. The panel
says so in its own words and states that the rule is not negotiable:

> *This step reaches outside your workspace, so it always stops and asks you first. That cannot be
> switched off.*

The golden run is an UNATTENDED trial run. There is nobody to press *Approve this step*, so it waits
until the publish service gives up. **Every workflow containing any external_action step is therefore
unpublishable, whatever its shape** — this is not MCP-specific, and it is not a regression: it is the
collision of two correct rules that had never met, because until Phase 206.2 no MCP step could be
authored and (per `D-206-06`) the capability shapes were rarely published either.

⚠ **DO NOT CONFUSE THIS WITH THE STAGE-2.6 BLOCKER `206.2-01` FIXED.** That one WAS about MCP, and it
is CLOSED and proved: `✓Grounding` above is that fix passing, with the MCP step present, in the real
gauntlet. This blocker is one stage later and has a different cause.

# A SECOND defect, found by the same drive

The verdict reports `golden_run_id: null` and the receipt explains, in rendered copy:

> *golden_run_id is null — this blocked before stage 3, so there is no run to open. (A pre-run block
> never has a run link.)*

**Both halves are false here.** It blocked INSIDE stage 3, and the run exists (`5d67d004…`). The
person is told there is nothing to look at, about the one artifact that would explain the failure. And
`named_failures` reads `"golden run could not complete: None"` — the cause is literally the string
`None`, so even the named failure names nothing.

# What a fix probably has to decide

Three routes, none obviously right, which is why this is a seed and not a fast-fix:

1. **The golden run auto-approves its own action-risk checkpoints** — and then a trial run really does
   reach outside, unattended, during a publish. That is a governance decision, not a bug fix.
2. **The golden run stops SHORT of an external_action step and records that it did** — honest, but the
   published workflow then carries a golden run that never exercised its riskiest step.
3. **Publishing such a workflow requires an attended golden run** — the author answers the checkpoint
   inside the publish flow. Most honest, most UI work.

⚠ **Whichever is chosen, the `golden_run_id: null` half is separable and should be fixed regardless:**
carry the run id when a run was created, and stop printing an explanation that contradicts the reading
beside it.
