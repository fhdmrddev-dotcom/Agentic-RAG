---
seed_id: SEED-167
title: Incremental / stateful workflows — a run that reads its OWN last output, diffs it against the knowledge base, and updates it in place (the "living risk register")
created: 2026-08-16
planted_during: Phase 194.1 UAT (operator, mid-session)
status: partially-answered
partial: true
status_note: |
  AXIS: settled on the STATE-READ axis (Phase 205); OPEN on the UPDATE-IN-PLACE axis. That split is what
  `partial: true` above is asserting.

  ── 2026-09-18 · RE-MEASURED AGAINST THE TREE, not against a directory listing, and the status moved
  `planted` -> `partially-answered`. Prompted by an outside comparison document (archived under
  `screenshots/AGENTIC-RAG-VS-AIRIA-AND-THE-WORKFLOW-ENGINE-2026-09-18.md`) whose B5 row read
  "no durable state across runs" — that is FALSE, and it was reached by reading this file's TITLE from a
  directory listing rather than opening it. ⚠ Two sibling seeds it called unbuilt the same way,
  `SEED-191` and `SEED-201`, were ALREADY correctly recorded as `folded` and `answered`. **The register
  was right; the reading method was wrong.** Recorded here because the remedy for that is not a register
  repair.

  SHIPPED by Phase 205 (STATE-01 / D-01..D-04), measured in the tree:
    * `WorkflowDefinition.is_stateful` (`models/harness.py:693`).
    * `run_workflow` resolves `ctx.prior_run = get_latest_completed_workflow_run(slug, user, org)`
      (`harness_engine.py:~1697`).
    * `{{prior_run.output}}` / `{{prior_run.id}}` / `{{prior_run.created_at}}` interpolate into prompt
      text, with a BASELINE NOTICE on cold start (`harness/phase_types.py:215-244`).
  Against this seed's own 7-row decomposition table below: **#2 READ current state is CLOSED**, and
  **#3 gains the "since" anchor it lacked**. #7 (schedule) is served by `workflow_schedules` (mig 124).

  ⛔ STILL OPEN, and it is the load-bearing half: **#4 close/remove resolved entries** and **#5 append
  preserving what was untouched** have NO primitive. `PROGRAMMATIC_PHASE_REGISTRY` holds exactly two
  functions — `split_topic` and `eval_slow_step` — and neither diffs or merges. So today the read-modify-
  write is performed BY THE MODEL, inside prompt text.

  ⭐ THAT IS THE GOVERNANCE FINDING, NOT A CONVENIENCE GAP. A merge carried in prompt text is invisible
  to the publish gate, to `reachability.lint_workflow`, and to the audit trail — the same class of defect
  as a branch decision written into a prompt. This seed's own `relates_to` predicted the remedy before the
  problem was named: *"a deterministic step is the right home for the diff/merge"* (NODE-01 / `SEED-141`).
  ⛔ Do not close this seed on the strength of #2 shipping. The axis that makes it a LIVING register — that
  a run may UPDATE its own prior output under a gate that can see the update — is untouched.

  Re-open trigger unchanged, plus: any phase that proposes a deterministic diff/merge step, and any phase
  that scopes `SEED-141` utility nodes.
priority: high
relates_to:
  - SEED-014 (Automations & Routines) — the SCHEDULING half of this seed. Phase 105, explicitly deferred to a
    later milestone; its hard prerequisite is RUN-01, which is the very requirement 194.1 is verifying and
    whose SC#2 currently FAILS. **Do not plan the scheduler here — plan the STATE model here.**
  - SEED-142 (Connectors must be TWO-WAY / auto-ingest from a connected drive) — without auto-ingest, a weekly
    run reads a knowledge base that only changes when a human uploads to it, so "what is new this week" is
    answered by manual effort. The two seeds compound: neither alone delivers the operator's ask.
  - SEED-148 (a produced file has nowhere to show it) → RUN-02 / RUN-03, milestone phase 195.
  - SEED-110 / AUTH-03 (template-first authoring) — the CLOSEST shipped thing, and **it is not this**. See
    "Why AUTH-03 does not cover it" below; the distinction is fill-a-blank vs read-modify-write.
  - NODE-01 (milestone phase 198, `SEED-141`) — the one IN-MILESTONE requirement this business case
    strengthens. A deterministic step is the right home for the diff/merge, and this is a concrete,
    operator-supplied answer to that seed's own "establish that the need is real" precondition.
trigger_when:
  - Planning the automations/scheduling milestone (SEED-014 / Phase 105) — this seed defines what a scheduled
    run must be ABLE to do; a scheduler over stateless runs does not deliver it
  - Any phase proposing "run this workflow on a schedule", "recurring report", "keep X up to date"
  - Any second operator request of the shape "update the existing document" rather than "produce a document"
  - Planning NODE-01 (phase 198) — bring this seed as the worked example
surface: Agentic-RAG
---

# SEED-167: Incremental / stateful workflows — the "living risk register"

> ## ⚠⚠ READ `SEED-168` FIRST — THIS SEED IS AN INSTANCE, NOT THE REQUIREMENT
>
> **Added 2026-08-16 (same day), on the operator's explicit correction:**
>
> > "This is an example. I don't want you to just take the specific thing and implement things according to
> > the specific example. The point is that we need to automate as much as possible business cases in
> > different domains based on the knowledge in knowledge base."
>
> **Anyone who plans from this file alone will build a risk-register feature, and that is the wrong outcome.**
> The risk register is a *probe* that exposed one axis (state — a run that reads its own last output) out of
> six. `SEED-168` derives all six from cases across PM, HR, finance, legal, education and healthcare, and
> carries the measured coverage table.
>
> **What stays valid here:** everything below is accurate about the STATE axis specifically — the measurement
> that no run-to-run state exists, the AUTH-03 comparison, the six open questions, and the fit analysis. Read
> it as the deep-dive on axis **B**, with `SEED-168` as the map.

## The business requirement, in the operator's words

> "Suppose for example I will run a workflow or author a workflow that look into my project folder for a
> specific folder and first of all it will [be] a risk registry report with symbols and this risk Registry
> [re]port it should read it first to understand what is inside. Then it will search my knowledge base to see
> what new risks are there that are not captured with awareness of the dates and the reporting. It delete or
> close the open risks that were closed from the files, and look in new risks. So this should be automatically
> updating for example every week."
> — operator, 2026-08-16, during Phase 194.1 UAT

## What it decomposes into

| # | Capability | Shipped? |
|---|---|---|
| 1 | Scope the run to a specific project folder | ✅ folder-scoped grounding + virtual folders (Phase 114) |
| 2 | **READ an existing populated report to learn current state** | ❌ **no primitive** |
| 3 | Search the KB for items not already in that state, **date/period aware** | ⚠ partial — retrieval ships; "since the last report" has no anchor to be since OF |
| 4 | **Close / remove entries the evidence says are resolved** | ❌ no update-in-place semantics |
| 5 | Append newly found entries, preserving everything untouched | ❌ same gap as 4 |
| 6 | Show the produced file from the run surface | ❌ RUN-02 / RUN-03 — **milestone phase 195**, planned |
| 7 | Run it automatically every week | ❌ SEED-014 / Phase 105 — **deferred to a later milestone** |

## The load-bearing gap — and it is NOT the scheduler

The obvious missing piece is scheduling, and it is the *least* interesting one, because it is already planned
and well understood.

**The real gap is that a run has no memory of the previous run.** Measured 2026-08-16, not assumed:
`grep -rn "previous_run|prior_run|last_run_output|incremental|since_last"` over
`backend/app/services/harness/` and `backend/app/models/harness.py` returns **ZERO hits**. There is no
concept anywhere in the harness of *"the last run's output is this run's input."* Every run starts from nothing.

⚠ **Putting a scheduler on top of stateless runs does not produce this feature — it produces a NEW full report
every Monday, with no idea what last Monday said.** The operator's ask contains the words *"read it first to
understand what is inside"*, *"delete or close"*, and *"not captured"* — every one of those is a statement
about **prior state**. So the ordering is: **state model first, scheduler second.** A milestone that ships
them the other way round will look complete and satisfy none of this.

## Why AUTH-03 (template-first authoring) does not cover it

AUTH-03 shipped and was verified on a real run (193.1): attach a `.docx`, and every run fills that same
template's placeholders with current information. It is the nearest shipped thing and it is a **different
operation**:

| | AUTH-03 (shipped) | This seed |
|---|---|---|
| Input document | a **blank template** with `{{ }}` placeholders | the **previous OUTPUT**, already populated |
| Operation | fill the blanks | read → diff → close some rows → append others → preserve the rest |
| Run N vs run N+1 | independent; both fill the same blank | N+1's input **is** N's output |
| What "correct" means | every placeholder rendered | **nothing lost that should have been kept** |

The last row is the hard one. AUTH-03's correctness is checkable by "zero unrendered `{{ }}`". This seed's
correctness is *"the 14 risks that are still open are still there, unaltered"* — a preservation property, and
preservation is exactly what an LLM rewriting a document is worst at. **That is the argument for NODE-01**: the
diff/merge should be a deterministic step, not a prompt asking a model to be careful.

## Fit against the CURRENT milestone (v3.7), stated honestly

The operator asked whether this could be covered in the remaining phases. **Mostly no, and pretending
otherwise would be worse than saying so:**

| Phase | Requirement | Does it help? |
|---|---|---|
| 195 | RUN-02 / RUN-03 — show a produced file from the run surface | **Partially.** You would at least SEE the register the run produced. Does nothing for state. |
| 196 | AUTH-04 — model picker from the live registry | No |
| 197 | AUTH-02 — guided authoring | No — though a guided author is where "what should this workflow read first?" would eventually be asked |
| 198 | **NODE-01** — a deterministic step between two AI steps | **Yes, genuinely.** This is the worked example NODE-01's seed asks for before any primitive ships |
| 198 | NODE-02 — collect structured input mid-run | Tangential — a human confirming "close these 3 risks?" is a natural checkpoint |

⚠ **Recommendation: do NOT stretch v3.7 to absorb this.** It needs a state model, and a state model inserted
into a milestone whose remaining phases are authoring polish and file display would be the largest thing in the
milestone, arriving last and unplanned. **Carry it as the anchor use-case for the automations milestone
(SEED-014), and bring it into phase 198's NODE-01 discussion as evidence.**

## What to settle before building (open questions, deliberately unanswered)

1. **Where does prior state live?** The previous run's output file, a dedicated durable "workflow state"
   record, or a KB document the workflow both reads and rewrites? These have very different blast radii.
2. **What is the diff key?** A risk register needs stable per-row identity to say "this row is the same risk,
   still open." Free-text rows have no identity — does the register need an id column, and does the workflow
   own that convention or does the operator?
3. **What happens on a bad run?** If run N produces a damaged register, run N+1 reads the damage as truth and
   compounds it. Stateless runs cannot compound errors; stateful ones can. **Versioning/rollback is not
   optional here** — it is what makes the feature safe to schedule.
4. **Who approves a deletion?** *"Delete or close the open risks that were closed"* is a destructive write
   driven by model judgement. This is the strongest human-in-the-loop case in the product so far, and it
   collides with `BUG-260815-01` (the publish gate categorically refuses `llm_human_input`).
5. **Does "with symbols" mean a rendering convention** (✅/⚠/❌ status marks in the document) **that must
   survive the rewrite?** If so it is a preservation requirement, not a formatting one.
6. **Date awareness anchored to what?** Document dates, ingestion dates, or last-run timestamp — they
   disagree, and the operator said *"awareness of the dates and the reporting"*, which reads as reporting
   PERIOD rather than file mtime.

## Why this matters

This is the first operator requirement that is not "produce something" but **"keep something true."** Every
workflow the product ships today is a one-shot generator. A register, a status report, a compliance matrix and
a supplier-risk review are all the same shape — and it is the shape businesses actually run on a cadence.
⚠ It is also the shape that makes scheduling worth having: a scheduled one-shot generator produces a pile of
disconnected documents, which is work rather than leverage.
