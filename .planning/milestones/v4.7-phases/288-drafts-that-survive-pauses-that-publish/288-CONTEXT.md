# Phase 288: Drafts That Survive, Pauses That Publish - Context

**Gathered:** 2026-10-19
**Status:** Ready for research and planning
**Mode:** autonomous. The operator is away. Every decision below was taken by Claude on the recommended option, with the reason written next to it. The operator can overrule any of them; none is a one-way door.

<domain>
## Phase Boundary

Two things, both on the workflow Builder and run surfaces. No new phase type, no new table planned.

1. **AUTH-03** - the configuration an author sets on a draft (the name and the decisions the describe door produced, plus node configuration) is still there after navigating away and back, and one draft never shows another draft's configuration.
2. **AUTH-01** - a workflow with a human-input pause publishes, and the run surface says in words who the run is waiting on, including after reload.

Requirements: AUTH-03, AUTH-01. Seeds: SEED-183, SEED-164.
</domain>

<measured>
## What is already true (measured 2026-10-19, not assumed)

- **Publishing a pause workflow was already unblocked in 200.3.** `_interactive_phase_failures` (`publish_service.py:1250`) no longer refuses `llm_human_input`; the golden run auto-continues the pause (`human_input.py:135`, `ctx.is_golden_run`). Success criterion 3's first half may already hold. This phase must PROVE it live, not rebuild it.
- **What the gauntlet still refuses:** a validator with `on_failure == "ask_user"`. That is the only "wait" refusal that exists. `timeout_seconds` on `LlmHumanInputPhaseConfig` (`models/harness.py:136`) is a bare `int = 300` with no bound; the executor clamps it silently to `ask_user_max_timeout_seconds` (1800). Nothing in lint rejects `0`, a negative, or a huge value.
- **Draft autosave exists** (Phase 186, `useDraftPersistence`). The saved draft survives navigation. What vanishes is the **decisions card**: `DraftArrivalCard` is gated by `showReceipt`, set in exactly one place (`onDrafted`, `WorkflowBuilderPage.tsx:827`). A re-opened draft never sees it, and with it goes the ONLY rename control (`decision-name-input` count 0, SEED-183).
- **The run surface already says "Paused for your answer"** (`WorkflowRunPage.tsx:390`) and `PhaseCard` says "Paused - waiting for your input." Neither names a person, and the reading is derived from a pending-ask slice that must be shown to survive reload.
- **Run reads are owner-scoped today** (`workflow_runs.py` filters `user_id`). Phase 289 opens a read-only page to others; the waiting-on line must not assume the viewer is the owner.
</measured>

<decisions>
## Implementation Decisions

### AUTH-03: the draft keeps its configuration

- **D-01 (split the card, do not widen the gate).** SEED-183's own finding stands: the card carries two classes of value. The **receipt** ("here is what I built") is past tense, reads a snapshot, and stays arrival-only (`showReceipt` is NOT widened; its setter count stays 1). The **decisions rows and the name field** read the definition as it is NOW and become a draft-lifetime surface. *Why:* persisting the receipt would make the AI narrate the author's later edits, the CR-01 shape hit five times already.
- **D-02 (graph column stays three children).** The persistent decisions surface lives INSIDE the existing `DraftArrivalCard` slot. After the author dismisses the arrival it collapses to a compact "Draft settings" row, it does not unmount. A fourth child strands the graph at 0 px (sketch 172 measured it). *Why:* structural, not a preference.
- **D-03 (rename works for the whole draft).** The name input stays reachable until publish, writing through `builderStore.setName` (the one write path; it never touches the slug). *Why:* today a name is editable during exactly one moment.
- **D-04 (a published workflow is not a draft).** The persistent surface renders only while the workflow is an unpublished draft. After publish it is gone, and the re-publish/tweak path is unchanged.
- **D-05 (no cross-draft bleed, proven first).** Success criterion 2 is driven in a browser BEFORE any fix is written: configure draft A, open draft B, return to A, and the reverse. If it reproduces, fix by keying builder state to the workflow id. If it does not, ship a regression test and say so. *Why:* the roadmap lists "two drafts overwrite each other" as a failure mode, and a fix for a bug nobody reproduced is a guess.
- **D-06 (hard reload counts).** "Survives" means navigate away and back AND a hard reload. The roadmap names "persists only until a hard reload" as the failure. Autosave is the mechanism; no new client store.

### AUTH-01: pauses publish and say who they wait on

- **D-07 (prove, do not rebuild, publishing).** Publish a real `llm_human_input` workflow through the real gauntlet in the browser. Add what 200.3 left out: the publish verdict says, in words from the server, that the pause step was answered automatically during validation and has not been exercised (SEED-164 cost 1: "the claim narrows"). The shape check (prompt present, options well-formed) stays static and named.
- **D-08 (the gauntlet is taught the pause, never loosened).** Nothing is removed. Two refusals after this phase: the existing `on_failure == "ask_user"` validator refusal (kept, SEED-137 coupling), and a NEW named lint failure for a human-input step whose `timeout_seconds` is `<= 0` or above `ask_user_max_timeout_seconds` (today clamped silently). Both are driven RED against planted definitions, and the driving is recorded in the SUMMARY. *Why:* "unbounded wait" had no definition in code; this one is observable and testable. SEED-137 must be read before the gate is touched.
- **D-09 (the server says who, in words).** The run read gains one optional field describing the pause: the person it waits on (display name, falling back to email, falling back to the words "the person who started this run"), the step's own name, and the prompt's first line. Built from the durable pending-prompt row, NOT from SSE, so it is the same after reload. The client renders the sentence; it never builds it from an id. *Why:* the roadmap's failure mode is "waiting on shows an id or nothing".
- **D-10 (the viewer may not be the owner).** The sentence reads "Waiting on <name>" for everyone and appends "(you)" only when the viewer is that person. Phase 289 depends on this not assuming ownership.
- **D-11 (a pause that outlives its timer says so).** The pause is durable (Phase 200 D-10). When the answer window has passed, the line stays and says the run is still waiting and will continue when answered. It never says "expired" about a run that will in fact resume. Research confirms the current post-timeout state before the copy is written.
- **D-12 (no new phase type).** `llm_human_input` only. `external_action` approval and long-artifact review are other shapes (SEED-164 table) and stay out.

### Process and guardrails

- **D-13 (G-2 skipped, audited).** The operator is away, so no sketch is made. The decisions surface reuses sketch 174's vocabulary; the waiting-on line reuses the existing `waiting` tone. Recorded under `STATE.md` guardrail overrides, as in 287.
- **D-14 (G-4 scenarios, defined by Claude, driven in Chrome).** S1: generate a draft, rename it, dismiss the arrival, navigate to the library and back, hard reload; name, decisions and node config all present. S2: two drafts, no bleed in either direction. S3: publish a pause workflow, start a run, see the waiting-on sentence with a real name, reload, still there, answer, run completes. S4: a planted unbounded wait is refused with a named reason.
- **D-15 (G-5, one touch per hot file).** `WorkflowBuilderPage.tsx`, `builderStore.ts`, `PublishGauntlet.tsx`, `publish_service.py`, `WorkflowRunPage.tsx`: at most one mount, prop, field or helper each; ledger rows and detail sections in the same commit. Read each file's section in `docs/HOT-FILE-LEDGER.md` before planning. 289 also edits `WorkflowRunPage.tsx`, so leave it smaller, not larger.
- **D-16 (UAT four axes, VALIDATION.md).** The phase touches run state and UI state, so the VALIDATION rows cover the full native roster plus OpenRouter, a multi-tool row, a parallel-thread row and a long-message row. Blocked rows are recorded with their reason, never dropped.
- **D-17 (plan count 3-5, G-8).** Suggested shape, planner may merge: (1) draft surface split plus bleed proof, (2) gauntlet: unbounded-wait lint plus the verdict row, (3) waiting-on server field plus run surface, (4) live proof. Plans 1 and 3 touch disjoint files and can share a wave.
- **D-18 (reported bugs).** No open `surface: Agentic-RAG` report is folded. `BUG-260610-01` (run nav timer reset and duplicate avatar) stays open: the timer half went to 200 and the avatar half is not this phase.
</decisions>


<amendments>
## Amendments from research (2026-10-19, supersede the decisions they name)

- **A-01 (D-05):** bleed cannot be reproduced by reading (store created per mount; Builder unmounts between drafts). No keying fix. Ship a regression test plus the S2 browser drive; fix only if the drive reproduces it.
- **A-02 (D-02):** one optional prop on `DraftArrivalCard`; its closed branch renders one collapsed "Draft settings" row with a new testid and neutral new words. The existing pin "dismissing takes the column down to TWO children" is retired deliberately and re-baselined, with the reason written in the test.
- **A-03 (D-08):** the timeout lint lives in `_interactive_phase_failures`, not `lint_workflow`. Message states the 30-minute ceiling. Backend tests for it run explicitly (some sit outside `tests/unit`).
- **A-04 (D-07):** `PublishVerdict` gains one optional field for "answered automatically during validation", filled from the golden run's `_golden_run_mock` outputs. Stale copy at `PublishGauntlet.tsx:212` and `landing/facts.ts:144` is corrected in the same plan.
- **A-05 (D-09):** no pending-prompt table exists; the prompt is a `messages` row. Use a NOT-EXISTS variant of the pending read and take the step name from the active phase row. Field: `waiting_on {sentence, step_name, prompt_line, window_passed}`, composed server-side. Name from `profiles.display_name` via a pool read after the ownership select.
- **A-06 (D-10, operator-free ruling):** the email fallback applies only when the viewer is the owner. For anyone else the sentence says "the person who started this run", and `prompt_line` is withheld.
- **A-07 (D-11):** the line covers BOTH states: run `active` (band says Running, node says waiting) and `paused` (window passed). Both show the same sentence.
</amendments>

<deferred>
## Deferred Ideas

- **Notification when a run pauses** (who is told, where). A pause nobody hears about is a hang; this needs its own phase and its own surface.
- **Batching** several gaps into one ask.
- **Long-artifact review** as a separate phase type (SEED-164 case 4) and **approval of an outward act** (already `external_action`).
- **Answerer other than the run's owner** (assignees, org roles). Phase 288 names the owner and does not invent routing.
- **Duplicate-avatar half of BUG-260610-01.**
- **SEED-182 (composing moment) and SEED-184 (density language).** Same journey as SEED-183, sketched together later.
- **Server-side enforcement of required launch inputs** (carried from 287).
</deferred>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 288 (goal, 4 success criteria, failure modes)
- `.planning/seeds/SEED-183-draft-configuration-vanishes-while-the-workflow-is-still-a-draft.md`
- `.planning/seeds/SEED-164-a-workflow-that-legitimately-pauses-for-a-person.md`; also `SEED-137` (armed-checkpoint bypass, goes live if the gate is relaxed) and `SEED-159` (an unanswered ask must not become a silent blank)
- `.planning/milestones/v3.7-phases/200.3-publish-and-run-human-in-the-loop/200.3-VERIFICATION.md`
- `docs/HOT-FILE-LEDGER.md` sections for the five hot files in D-15
- `backend/app/services/harness/publish_service.py` (`_interactive_phase_failures`), `human_input.py`, `backend/app/models/harness.py` (`LlmHumanInputPhaseConfig`)
- `frontend/src/components/workflows/DraftArrivalCard.tsx`, `DecisionsList.tsx`, `builderStore.ts`, `frontend/src/pages/WorkflowRunPage.tsx`, `frontend/src/components/panel/PendingAskCard.tsx`
- Skill `sketch-findings-agentic-rag` (sketch 172, 174 and the run-surface contracts)
</canonical_refs>

<how_we_would_know_this_failed>
## How we would know this failed

The draft survives navigation but not a hard reload. Two drafts show each other's settings. The gauntlet passes a `timeout_seconds` of `0` or `99999`, or a check was deleted rather than taught the pause. The waiting-on line shows a UUID, an email the person never chose, or nothing after reload. A published pause workflow runs, stops, and no surface says it is waiting.
</how_we_would_know_this_failed>
