# Phase 295: Runs That Don't Dead-End - Research

**Researched:** 2026-10-20
**Domain:** workflow engine run-state (harness_engine durable pause, gate dispositions, resume/reconcile), publish gauntlet (lint + judge), run page / evidence vocabulary
**Confidence:** HIGH for code paths and DB measurements (read and queried this session); MEDIUM for the recommended seam shapes (designed, not driven); LOW where marked (causes not reproducible from the local DB)

## Summary

The phase is mostly engine plumbing. The pause machinery it needs already exists: `PhaseOutcome("pause_run")`, `pause_run`, the answer-triggered `_redrive_paused_workflow_run` and the single-use `ctx.resume_answered_tool_call_id`. What it lacks is a way for an engine-owned ask to end in that outcome instead of the in-process `subscribe_for_response` wait. The citations gate and the armed approval both go through `_resolve_failure_with_ask_user` (`harness_engine.py:1387-1714`), and that function blocks in-process. The durable version touches at least four places in `harness_engine.py`: the ask helper, an answer-consume step at the top of `_run_phase_with_gates`, the boot sweep, and `_resume_run`'s missing terminalize. That is more than one helper, so under D-32 the first plan should take the named seam: move the gate-disposition machinery verbatim into a new `harness/engine_ask.py` and keep a re-import in the engine. The feature code comes after that.

The measurements change several CONTEXT premises; see "Refuted / adjusted" below.
- **Both stuck `active` runs are live runs, not golden runs.** In each, the armed checkpoint of the last step was re-driven by the boot sweep and then cancelled, and nothing on the resume path finalizes `workflow_runs`.
- **The 7 "waiting for approval" failures were answered declines**, not unanswered waits. The person clicked "Do not run it", and the failure reason quotes the prompt's own words "The run is waiting here".
- **Of the 20 failed runs with no reason,** 15 are fixture rows leaked by an integration test. The other 5 are June F2 escapes.
- **Every measured "0 sources" step had `folder_scope = null`.** A bound limited to the project subtree would never offer "search another folder" for any of them.
- **`grounding_cause()` returns `detected` for every step that carries the engine gate,** so D-05's `escalated / already-set` lock can never apply to a step that actually pauses.
- **A workflow with an `llm_emit` step and no bound template is a shipped, designed shape:** the Run modal offers a template upload at launch for it. The run-start refusal must therefore accept a template staged on the thread.

**Primary recommendation:**
1. Extract the disposition seam first.
2. Make the engine asks return `pause_run` immediately: write the durable prompt row, then the producer stops. They should not wait in-process.
3. Consume the answer at the top of `_run_phase_with_gates` on re-drive.
4. Keep `ValidatorSpec.on_failure="fail_run"` on the appended gate, and identify the gate with a pure `grounding` predicate.
5. Put the template refusal in `lint_workflow` (publish) and in `preflight_workflow_kickoff` / `launch_scheduled_run` (run start), with a check for a template staged at launch.

## Refuted / adjusted (read before planning)

| # | CONTEXT premise | Evidence | Adjustment |
|---|---|---|---|
| R1 | D-05: "locked" = `grounding_cause(phase) in {"escalated","already-set"}` | `grounding_cause` checks `detected` FIRST (`grounding.py:1183-1189`), and `effective_phase` appends the gate ONLY when the cause is `detected` (`grounding.py:1404-1413`). A KB step therefore always reads `detected`, and a stored `grounding_escalated: True` "goes inert" (`grounding.py:1170-1175`). `citation_policy` exists only on `LlmEmitConfig` (`models/harness.py:169`), which is never detected. `GovernanceSection.tsx:27` says a detected step has "NO switch exists in any variant". [VERIFIED: codebase read] | As written, D-05 never matches a step that pauses, so every pause would offer "continue". That is the roadmap failure mode "a locked must-prove-it workflow can skip its evidence". **Recommend `locked := bool(phase.grounding_escalated)`, read from the stored bit and not through `grounding_cause`.** The UI cannot set that bit on a detected step today (it is set only if the author escalated before adding a KB tool). So the planner needs an **operator decision**: (a) accept that "locked" means the stored bit, with S3 planted by direct DB; or (b) add an author affordance on detected steps, which is new UI scope; or (c) treat every detected step as locked, which removes "continue" entirely. Note: every KB step's canvas already reads "⛨ Must prove it / Because this step reads your documents" (`definitionOps.ts:492, 515`). [ASSUMED: operator intent] |
| R2 | D-12/D-13: refuse any `llm_emit` step when `definition.assets` has no `template` | `soulData.templateAdmission` returns `"admits"` exactly for this shape (`soulData.ts:491-523`). The Run modal then shows "Upload template" (`RunModal.tsx:151, 435-528`). `ChatLayout.tsx:430` uploads it before the send, and the executor resolves it via Branch 2 (`template_asset_service.py:209-226`, `phase_types.py:1530-1561`). | **Publish refusal is still right:** the golden run has no upload, so it can never pass today anyway. **Run-start refusal must check the definition asset OR a staged `template_input` on the thread** (the Branch-2 predicate: `kind='template_input'`, `created_by`, unexpired, `expires_at IS NOT NULL`, `run_claim IS NULL`). **`/validate` severity should be `incomplete`** (add the code to `_INCOMPLETE_CODES`, `api/workflows.py:741-753`), not `error`. |
| R3 | D-20: the golden run's `finally` is "the likely BUG-10 source" | Both stuck runs have `is_golden_run=false` (Q-9a). Both are armed `act` steps whose waits the boot sweep re-drove (prompt rows 2026-10-19 18:44 / 2026-10-20 00:12). The step was then cancelled by a non-shutdown `CancelledError` (the escape handler wrote `act:cancelled`, `harness_engine.py:2347-2349`). `_resume_run` (`:3139-3149`) and the sweep's `except Exception` (`:3275`) never terminalize `workflow_runs` on a `BaseException`. The resume shells were even written `completed` (`85a7cbda`, `0c64f361`). [VERIFIED: local DB + code] | **Add the missing site: `_resume_run` must F2-terminalize on escape** (it covers the boot sweep and `_wake`). The golden-run gap is real but latent: 0 golden runs are non-terminal locally. Still fix it under D-20. **What triggered the cancellation is not established [LOW]**: the anchor is intact, so it was not a user Stop through `run_lifecycle` (`run_lifecycle.py:695-706` clears it). |
| R4 | BUG-261020-12 / D-18: "7 runs recorded failed while waiting for approval" | All 7 `run_failed` rows are **answered**: 5 carry `ask_user_response "Do not run it"` (choice 1) → `— aborted by user`. 07-31 reads `— not approved: the answer did not match`, and 08-27 reads `— aborted by user` (Q-9c). The reason embeds the armed prompt "…The run is waiting here and will not continue until you answer." (`grounding.py:1252-1255` via `harness_engine.py:1600-1602`). | No historical row is an unanswered wait that failed. **What remains true:** (1) during an in-process armed wait the run reads `active` / "● Running" (`WorkflowRunPage.tsx:381-392`), so D-18's durable `paused` stays right; (2) a decline's reason should not quote "The run is waiting". Compose a decline reason from the step label instead. |
| R5 | BUG-261020-11: 20 reasonless runs, "most likely F2 or pre-`run_failed` code" | **15** (2026-08-28) are fixtures `tests/integration/test_214_argument_seams.py:215` INSERTs as `status 'failed'`, which its teardown failed to delete (thread title "phase 214-14 seam thread", no phases, no audit, no `runs` rows). **5** (2026-06-01..11) are producer escapes: shells failed with `BadRequestError` / `UntranslatableCharacterError` or were cancelled, then F2 wrote `failed` with no audit (`run_producer.py:366-379`). `updated_at 2026-07-18 20:43:42` is a 144-row bulk touch, not the failure time. | Record both causes. The fixtures are test pollution, not a product path; the planner may propose an approval-gated local cleanup (out of phase scope). D-20's F2 audit closes the product path. |
| R6 | BUG-261020-08: the gate reports a citation error | All 10 `no field_map on output` events are dated 2026-06-15 and 2026-07-30, before Phase 281 (2026-10-15). Since 281, `error` and the final reason are the composed cause (`harness_engine.py:1173-1190`). The only remaining residue is `validator_error` (`:1189`), pinned by `test_281_engine_cause_precedence.py:137`. | D-14 shrinks to one expression plus updating that pin. |
| R7 | D-01: "The pause still has a window … shown on the card" | `PendingAskCard` renders a `paused` card with a deadline as "The answer window has passed…" (`PendingAskCard.tsx:207-214, 664`), and `compose_waiting_on` treats `paused` as `window_passed` (`api/workflow_runs.py:880`). An immediate durable pause would show that sentence at second 0. | **Use `timeout_seconds=None` for engine asks** (no deadline), as the armed ask already does. A durable pause has no window that changes anything. The alternative (wait in-process for the window, then pause) keeps the run "● Running" while it waits, which is SC#4's failure. The operator should re-confirm D-01's window bullet. |
| R8 | D-03: bound = "the author's subtree" | All 13 measured "0 sources" KB steps have `folder_scope = null` (Q-D3), so the step already searches the whole project subtree. No folder inside the project could be offered. `resolve_run_scope_root` (`scope.py:191-280`) **admits any owner-visible folder as a per-run override when the definition declares no per-phase `folder_scope`**, and the author-subtree containment applies only when one is declared (`:240-277`). | Bound "another folder" by **the same acceptance rule as `resolve_run_scope_root`**, which is "the rule the run already obeys". Scoped definitions get author-subtree members; unscoped ones get owner-visible folders. An unbound definition (whole KB) gets no option. |
| R9 | D-10: `_latest_phase_text` "gets the same treatment" (question + answer) | `_latest_phase_text` feeds the **external action's `content`** (`phase_types.py:2134-2136`) and the **next human step's draft** (`human_input.py:199`). With KB → approve → email, the email body today is the approval *question*. | `_prior_output_text` gets question + answer, labelled. **`_latest_phase_text` should skip human-step outputs** (those carrying `answer`) so content and draft come from the latest produced text. Both fixes serve BUG-01. |
| R10 | D-17: "research reproduces it and reads the judge's quoted evidence" | The local DB has no `judge_verdict` after 2026-10-14, and the 288/289 pause drives are not in it. The only evidence is `288-04-SUMMARY.md:67` (3 of 4 UI attempts and 3 of 4 API attempts blocked; "User only replied 'Yes.' with no task context"). [VERIFIED: local DB] | **Not reproducible from data at research time.** The most likely cause is BUG-01: the wrap step never receives the answer (`_prior_output_text` reads `text` only). Order the work: D-10 first, then re-drive 4 publishes of the 288 plant, then add the `_golden_run_mock` note only if the judge still cites the auto-answer. [LOW] |
| R11 | D-08: "an armed step whose citations gate pauses still asks the armed approval first" | True by construction: the armed block (`:885-1076`) runs before the body, and post gates run after it. **The real post-gate SEED-137 hazard is different:** an author-declared post `ask_user` validator that fails first gets a Proceed → `completed` (`:1712-1714`), and the appended citations gate (later in the list, first-failure-wins, `validators.py:230-249`) is never evaluated. The result is an unsourced output with no mark. | Pin D-08's ordering in one test. Also record the post hazard. Exposure is drafts only, because publish refuses author `ask_user` (`publish_service.py:1334-1346`). Recommend fixing it in the same plan: after an author post Proceed, run the engine citations gate on the produced output. Otherwise D-04's "never a silent pass" has a hole. |
| R12 | D-19: the cancel sentinel → `failed` for engine asks | With durable engine pauses, no in-process waiter is left for engine asks, so a Stop on a paused run takes the no-producer arm → `cancel_workflow_run_internals` → `cancelled` (`run_lifecycle.py:676-689`). The sentinel still matters for **author `ask_user` validators** (`:1630-1633`) and for the **`llm_human_input` in-process window**, where a cancel falls through to `answer: ""` and completes the step (`human_input.py:302-327`). | Fix both remaining waiters by raising `CancelledError` on `kind == "cancel"`, following the shutdown precedent at `:1594-1598` and `human_input.py:283-287`. |
| R13 | D-02: three choices for both findings | For "0/N markers", sources *were* retrieved (`validator_kinds.py:306` passed). "Search another folder" is a dead option there. | 0 sources → folder options (when permitted) + continue + stop. 0 markers → continue + stop. Retrieval outage → unchanged `fail_run` (D-06). |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(Copied verbatim from `295-CONTEXT.md` `<decisions>`.)

#### RUN-01: the found-nothing pause

Measured at discuss (scout, file:line in `<code_context>`):

- The engine appends `citations_required` to every KB-detected step, hard-coded `on_failure="fail_run"` (`grounding.py:1404-1413`). Its comment says why: "185 ships no run surface to ask on (that is Phase 188)". That surface now exists (288/289).
- Simply switching the default to `ask_user` is NOT enough. The validator ask path (`_resolve_failure_with_ask_user`) is an **in-process** wait, not a durable pause. It offers only "Proceed anyway / Abort". Proceed accepts the output with **no mark**. An unanswered ask **fails** the run. Both are failure modes the roadmap names.

- **D-01 (a durable pause, the human-step kind).** When the engine's citations gate fails after its retries, on a "0 sources" or "0/N markers" finding (and, per D-18, when the armed approval waits), the run pauses with the same durability as an `llm_human_input` step. That means `PhaseOutcome("pause_run")` → `paused`, a durable prompt row, and a re-drive on answer. It must not block in-process.
  - When the answer window passes, the run stays paused and the card keeps its answer control (288 D-11, 289 D-13).
  - It never fails for want of an answer.
  - *Why:* the roadmap's failure mode "the pause has no timeout or loses the person's choice" (the BUG-261020-01 family).
  - The pause still **has** a window: the existing `ask_user_max_timeout_seconds` clock, shown on the card.
- **D-02 (three worded choices, server-built).** The prompt and choices come from the server, in plain words. The card renders them and never composes them.
  1. **Search another folder**: the person picks a folder; the step re-runs once with that folder.
  2. **Continue without sources**: the output is kept and marked unsourced.
  3. **Stop**: the run ends `failed`, with a reason naming the finding and "stopped by <person>".
  - The 0-sources and 0-markers findings get different first sentences, e.g. "Searched <folder> and found nothing" vs "Answered without citing its sources". The validator already produces distinct messages (`validator_kinds.py:306-334`).
- **D-03 (search another folder can never widen access).** The folders offered are bounded by the rule the run already obeys: `scope.resolve_run_scope_root`'s owner gate and the author's subtree.
  - The re-run uses a per-run override of the step's folder scope, recorded on the phase row and in the audit.
  - It is never written back to the definition.
  - If no other folder is permitted, the choice is not offered. A dead option is worse than a missing one.
  - The re-run goes through the same gates, so a second "nothing found" pauses again rather than looping silently.
  - Research names the smallest seam. Today's intersection with `ctx.folder_subtree_ids` (`phase_types.py:636-641`) only narrows; that is the intended bound, not a bug.
- **D-04 (continue-unsourced keeps the output it produced).** The output that failed the gate is kept as produced, not regenerated. It carries ONE optional field on the phase output, `unsourced` (the 289 D-08 pattern: one optional output field, no new type), holding who chose it and when.
  - The mark shows in **three places**: the step on the run surface (spine card / evidence line), the 289 evidence page, and the receipt / export.
  - A downstream step's prior-output text says the input is unsourced, so the next model does not present it as sourced.
  - Asserted on rendered CONTENT, not testids (memory: presence assertions miss content drift).
  - *Why:* "continue without sources becomes a silent pass" is the roadmap's first named failure.
- **D-05 (a locked workflow never offers continue).** "Locked" means grounding the author chose: `grounding_cause(phase) in {"escalated", "already-set"}` ("Must prove it", or `citation_policy="strict"`).
  - For a locked step, choice 2 is absent server-side. An answer that names it anyway is refused (an allow-list, the T-185-04-01 lesson: a decline must not be read as a proceed).
  - Only `"detected"` steps offer it.
  - Proven with a test that posts the continue choice to a locked run and asserts refusal.
- **D-06 (other findings keep failing, with words).** `retrieval_error` (a provider outage) still fails the run with its existing outage sentence: "search another folder" cannot fix an outage, and the message is already true. Author-declared validators keep their own `on_failure`. Only the engine-appended gate's disposition changes.
- **D-07 (publish never auto-continues).** During the golden run, the found-nothing pause resolves as **stop**. Publish is refused with the worded finding ("Searched <folder> and found nothing during validation"), never with a citation code. It is never auto-answered "continue".
  - `_interactive_phase_failures` keeps refusing **author-declared** `ask_user` validators (288 D-08 / SEED-137 coupling). The engine gate is not in the definition, so that refusal does not apply to it; research confirms.
- **D-08 (SEED-137 precedence check).** SEED-137 left open whether the appended grounding gate has the same precedence hazard. It is a `timing="post"` gate, and the armed gate is pre. Research confirms in one test that an armed step whose citations gate pauses still asks the armed approval first. That test is the record.
- **D-09 (SC#5 is measured).** Before any code, run the 2026-10-20 queries over the local DB and record the baseline share of runs ending in a `citations_required` failure, query text included. Re-run them over the phase's UAT runs and record the before/after in VERIFICATION. A share quoted without its query does not count.

#### BUG-261020-01: the person's answer reaches the next step

- **D-10.** `_prior_output_text` (`phase_types.py:173-190`) reads only `text`. A human step's `text` is the **question**; the answer sits under `answer` (`human_input.py:142-147, 188-192, 327`).
  - Fix at the reader: when a prior output carries `answer`, the next step sees the question AND the answer, labelled.
  - `human_input._latest_phase_text` (`:330-340`) gets the same treatment, or reuses the helper.
  - The stored `text` stays the question: the receipt and evidence page already read it.
  - Pinned by a test where the wrap step's input contains the stored answer, and driven live with the 289 Run A shape (KB → approve → wrap). The wrap must quote the real answer.
  - *Why:* 289 S5 proved completion only, never that the answer was used.
- **D-11.** The same reader carries D-04's unsourced note. That is one helper change in `phase_types.py` serving both. G-5: one helper, by construction.

#### RUN-02: a missing template is refused before the run

Measured: `no_template_bound` is first known inside `_exec_llm_emit` at run time (`phase_types.py:1550-1561`). The template is not a phase field: it is `WorkflowDefinition.assets[kind="template"]`. Save does no lint (`workflows.py:1155-1161`). Publish stage 2 `lint_workflow` (`reachability.py:355`) is pure, sees `assets`, and has no template code. The citation wording comes from `validator_kinds.py:341-343` ("no field_map on output") evaluating the failure output's shape. Phase 281 makes the emit cause win in the message, but the raw string still lands in the `gate_failed` audit (`harness_engine.py:1186-1190`).

- **D-12 (a lint code, one home).** Add `no_template_bound` to `LINT_CODES` and to `lint_workflow`. It fires for any `llm_emit` / `render_template` step when the definition has no `assets` entry of kind `template`. Publish stage 2 then refuses with a message naming what is missing, in plain words ("<step> fills a template, and no template is attached to this workflow. Attach one."), never a citation code.
  - Extending the one lint stage follows the 214 precedent (`publish_service.py:177-191`).
  - The wording comes from `emit_cause.py`'s existing `KIND_NO_TEMPLATE` sentence, so it is one string in one place.
- **D-13 (save says it; run start refuses it).** SC#2 says "refused when saved or published". The roadmap's failure mode is "fires only at publish while drafts still fail at run time".
  - **Save:** a hard refusal at save would break draft autosave, which Phase 288 AUTH-03 relies on: an author legitimately adds the step before uploading the template. So save returns the same lint finding as a **named, visible warning** in the builder (the existing advisory `POST /validate` shape). It does not reject the write.
  - **Run start:** every path that starts a run (kickoff, and any draft or test run research finds) refuses **before phase 1** with the D-12 sentence.
  - This interpretation of SC#2 is recorded for the verifier: "refused" = publish + run start, "named at save" = warning. Re-open if the operator wants a hard save refusal.
- **D-14 (the gate never misreports an executor failure).** When a phase output carries an executor `failure` (the `_emit_failure_output` shape), the citations gate does not evaluate it. It records the executor's composed cause instead, in the message AND in the `gate_failed` audit's `validator_error`. "no field_map on output" must not appear for a no-template run. Test: plant a no-template definition past lint (direct DB) and assert neither the audit nor the chat contains `citations_required`.

#### RUN-03: the judge is told what a step is designed to produce

Measured: the judge prompt (`JUDGE_RUBRIC_CORE`, `validator_kinds.py:135-157`) gets only the business requirement and author criteria. Phases are never described to it. It grades `_deliverable_output`, the last non-empty phase. For a workflow ending in `external_action`, that is the "NOT SENT — recorded only … This is a record of an intention, not a receipt" body (`phase_types.py:2140-2169`). The judge then scores "did the work" 0.

- **D-15 (teach, never loosen).** The rubric's criteria and threshold are unchanged for every workflow.
  - The one shared seam, `_judge_graded_text` (`validator_kinds.py:184-202`, used by the in-run and publish judges), gains a fixed server-written note.
  - The note is added **only when the graded output carries `recorded_intent`**. It says that this step is designed to record the action rather than perform it, that not sending is correct behaviour, and that the judge should grade whether the recorded action (destination, content) satisfies the requirement.
  - A workflow with no such step gets byte-identical judge input. That is pinned by a test comparing the text with and without, the "judge loosened for every workflow" failure mode.
- **D-16 (grade the content, not the envelope).** Research checks whether the judge should see the recorded body's content and the upstream deliverable rather than only the NOT-SENT envelope, and picks the smaller change that lets a correct DMT-shape run score above threshold. The 2026-08-26 *DMT Project Status Summary & Email* shape is the drive (SC#3): read its definition from production (MCP read, free), recreate it locally, publish it. Before the fix, re-run it to show it is still blocked. After the fix, publish it.
- **D-17 (SEED-360 F-2, the same lesson).** The judge also blocks the planted pause workflow most of the time. Before writing anything, research reproduces it and reads the judge's quoted evidence.
  - If the cause is the auto-answered human step (`_golden_run_mock`), the D-15 note gets a sibling, keyed on `_golden_run_mock`: "this answer was supplied automatically during validation".
  - If the cause is something else, it is recorded and left; it is not fixed by guesswork.

#### RUN-04: every run ends true, with a reason

Measured:

- Allowed run statuses are `active, paused, cap_paused, completed, failed, cancelled`. There is no `waiting`.
- An armed action-risk approval wait keeps the run **`active`** (the band reads "● Running"). It sits in the same in-process `_resolve_failure_with_ask_user` wait as RUN-01, and on an unanswered window it goes to `fail_run`. That is BUG-12: "The run is waiting" recorded as failed.
- A cancel publishes `{"kind":"cancel"}` before the durable cancel. It reaches the waiter as `choice=""`, which is in `_ABORT_LIKE_CHOICES`, so the run becomes **failed "aborted by user"** instead of cancelled.
- The golden run's `finally` (`publish_service.py:1758-1789`) finalises the `runs` shell but never the `workflow_runs` row. `find_resumable_runs` excludes golden runs, so nothing sweeps them. This is the likely BUG-10 source.
- `run_producer.py:366-379` (F2) writes `failed` with **no** `run_failed` audit (BUG-11).
- The resume sweep `continue`s without finalising when a definition won't load (`harness_engine.py:3213-3224`).
- `run_reconciler.py` never touches `workflow_runs`. The `updated_at` bumps come from the BEFORE UPDATE trigger on `claim_run` / `advance_current_phase` / `persist_run_usage`.

Decisions:

- **D-18 (one durable pause for every engine-owned ask).** D-01's durable pause covers both engine-appended gates: the citations gate (RUN-01) and the armed action-risk approval (BUG-12). A run waiting for a person is `paused`, whose band already reads "Paused for your answer" / "Waiting on <name>" (288 D-09). "Reads waiting" (SC#4) is met by `paused` plus the existing waiting tone. **No new status value, no migration for it.** An unanswered window never fails such a run.
  - Author-declared `ask_user` validators stay refused at publish (unchanged).
  - The armed allow-list stays: a decline is never read as a proceed (T-185-04-01).
- **D-19 (cancel reads cancelled).** The cancel sentinel is told apart from an empty answer. A cancelled wait ends the run `cancelled` with "stopped by <person>", never `failed` "aborted by user". Test: cancel during a pending ask → `cancelled`, 0 `run_failed`.
- **D-20 (no run stays active after its phases end).** Each of the following finalises the `workflow_runs` row with a worded reason and a `run_failed` audit when it fails:
  - the golden run's `finally`;
  - the resume sweep's definition-won't-load `continue`;
  - F2 in `run_producer`.
  - First-terminal-wins (`finish_run`'s guard) stays the one write rule.
- **D-21 (a sweep, not a hide).** The boot reconciler gains one sweep. A `workflow_runs` row that is `active` with **every** phase terminal and no live producer is finalised from its phases: `cancelled` if its last phase was cancelled, else `failed`, with the reason "finalised by the reconciler: its steps had ended". This is the SEED-297 shape: it never NULLs real totals. Stuck runs are finalised, never filtered out of the UI (the roadmap's failure mode).
- **D-22 (the historical rows are explained, not backfilled).**
  - The 2 stuck local runs are finalised by D-21's sweep on the next boot. Record before/after rows.
  - For the 20 reasonless failed runs, research finds the path that produced them, most likely F2 or pre-`run_failed` code from 2026-06/08, and records it in RESEARCH. No reason is invented for them: no fabricated audit rows. The run page and evidence page render a failed run with no recorded reason as "No reason was recorded when this run failed", never a blank.
  - Production (20 runs) is read via MCP (free) to state whether the same states exist there. Any production write is approval-gated and not part of this phase.
- **D-23 (BUG-261015-01: one failure, one message).** The executor's per-attempt `_surface_failure_message` is suppressed while the engine will still retry or route: a ctx flag set in `_run_phase_with_gates`. The engine's final message is the only one and equals the composed cause. Test: count the thread's assistant rows for one failed emit run and expect 1. This rides the D-14 helper path; G-5 one flag.

#### Process and guardrails

- **D-30 (G-2 skipped, audited).** The roadmap flags a sketch for the found-nothing pause. The operator is away (autonomous run), so no sketch is made, as in 288 D-13.
  - The pause reuses `PendingAskCard`'s existing live-answer layout and choice-button vocabulary, plus the 289 evidence-line vocabulary for the unsourced mark: glyph + word, e.g. "○ Unsourced · continued by <name>".
  - The folder choice reuses the existing folder picker.
  - Recorded under `STATE.md → Guardrail overrides`.
- **D-31 (G-4 scenarios, defined now, driven in Chrome):**
  - **S1:** a KB step over an empty folder pauses with three choices; reload, still paused; answer "search another folder" with a populated folder; the run completes, cited.
  - **S2:** same plant, answer "continue without sources"; the step, the evidence page and the export all say unsourced.
  - **S3:** a "Must prove it" step over an empty folder offers no continue, and a forged continue POST is refused.
  - **S4:** saving a report step with no template is refused, naming the template.
  - **S5:** the DMT-shaped workflow (KB → summary → recorded email) publishes.
  - **S6:** KB → approve → wrap, where the wrap quotes the real answer.
  - **S7:** the two stuck runs and the reasonless failed runs read truthfully after the reconcile.
- **D-32 (G-5, one touch per hot file).** `harness_engine.py` (FIRES, seam owed: the `run_workflow` phase loop vs `_run_phase_with_gates` vs the armed block), `phase_types.py`, `grounding.py`, `validator_kinds.py`, `publish_service.py`, `run_reconciler.py` and `PendingAskCard.tsx` each get at most one mount, prop, field or helper. The claim is arithmetic, as in 256-05 / 289-02: branch counts before and after.
  - If the durable validator pause (D-01) cannot be one helper in `harness_engine.py`, the planner makes **taking the named seam the first plan** (extract the gate-failure disposition arm out of `_run_phase_with_gates`), before any feature code.
  - Read each file's `docs/HOT-FILE-LEDGER.md` section before planning. Ledger rows and sections land in the same commit.
- **D-33 (UAT four axes in VALIDATION.md).** The phase touches the agent loop's run state and provider-routed retrieval. VALIDATION covers the full native roster plus OpenRouter, a multi-tool row, a parallel-thread row and a long-message row. Blocked rows are recorded with a reason; Anthropic was billing-blocked in 288/289/294, so re-test rather than assume.
- **D-34 (plan count 3-5, G-8).** Suggested shape (the planner may merge):
  1. **The durable engine-ask pause** (D-01, D-18, D-19): seam first if D-32 requires it. `harness_engine.py` + `grounding.py`.
  2. **The found-nothing choices** (D-02..D-08, D-10, D-11): server choices, folder re-run, unsourced mark, locked refusal, prior-output reader, card + evidence line.
  3. **Pre-run refusals and the judge** (D-12..D-17): `reachability.py`, save warning, run-start check, gate-skip on executor failure, judge note. Mostly `publish_service.py` / `validator_kinds.py`.
  4. **Truthful run ends** (D-20..D-23): golden-run finalise, F2 audit, sweep finalise, reconciler sweep, no-reason wording, one failure message.
  5. **Live proof** (D-31 S1-S7, D-09 SC#5 measurement, the D-33 roster).
  - Plans 3 and 4 touch mostly disjoint files and may share a wave once plan 1 lands. Plan 2 depends on plan 1.
  - `harness_engine.py` is touched by 1, 2 (maybe) and 4, so those are serial on that file. The planner either sequences them or merges them so the G-5 one-touch claim stays true per plan.
  - A plan whose tests mutate the local DB is serialised (worktree rule 4).
- **D-35 (closed core).** No new phase type, emitter or tool. The new things are one validator disposition and one optional output field.

### Claude's Discretion
- Exact wording of the pause prompt and choices, within D-02's plain-language rule and the copy/vocabulary files the ledger names.
- Whether the per-run folder override lives on the phase row or in run inputs (D-03), provided it is recorded and never written to the definition.

### Deferred Ideas (OUT OF SCOPE)
- **Branching / loops (SEED-295)**: parked; its evidence gate is still unmet.
- **SEED-360 F-4**: the `auto_answered` note unmounts with the gauntlet; it needs a decision on where a post-publish note lives.
- **A hard save refusal for a missing template**: rejected for now (D-13) because it would break draft autosave. Re-open if the operator wants it.
- **A new `waiting` run status**: not needed (D-18); `paused` plus the waiting tone carries it.
- **Backfilling reasons for historical failed runs**: rejected (D-22); no invented reasons.
- Reviewed bugs not folded: `BUG-261020-02`, `BUG-260828-05`, `BUG-260610-01`. Reviewed todo not folded: `todos/pending/spike-nl-workflow-authoring.md`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | A KB step that finds nothing, or answers without citations, pauses and asks (search elsewhere / continue unsourced, visibly marked / stop); a locked step never offers continue | §A (durable engine-ask design), §B (choices, folder bound, unsourced field, locked predicate R1), §G (SC#5 baseline query) |
| RUN-02 | A report step with no template is refused at save and publish, naming the template | §D (lint code + launch-template admission R2, run-start sites list, `/validate` severity) |
| RUN-03 | The publish judge does not fail a recorded-not-sent action for not sending | §E (`_judge_graded_text` note + full `recorded_intent.inputs`, the 500-char clip finding, F-2 status R10) |
| RUN-04 | Every run ends true with a reason; none stays active; waiting reads waiting | §F (stuck-run root cause R3, `_resume_run` terminalize, golden finally, F2 audit, reconciler sweep, decline wording R4, no-reason sentence) |
| BUG-261020-01 | The human step's answer reaches the next step | §C (`_prior_output_text` Q+A, `_latest_phase_text` skip R9) |
| BUG-261015-01 | One emit failure, one chat message | §F.5 (suppress the executor surface when validators exist; engine surfaces once in every failure-terminal arm) |
| SEED-360 F-2 | The judge blocks pause workflows | §E.3 (not reproducible from the DB; fix BUG-01 first, then re-measure) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Raw SDK calls only; no LangChain/LangGraph. Pydantic for structured LLM outputs (the judge already uses `JudgeVerdict`).
- `run_in_threadpool` (or `aexec`) for supabase-py calls inside async code (D-v2.5-01). The engine-ask prompt-row insert already uses `aexec`.
- Every table has RLS. No new table is expected in this phase.
- Migrations: numbered `supabase/migrations/<digits>_name.sql`, applied by pasting into the SQL editor, then `bash scripts/regenerate-full-schema.sh`. **This phase needs no migration**: `paused` exists, `policy_applied` / `validator_ask_user_approved` / `run_failed` are existing audit kinds, and `unsourced` is a jsonb output key. Any new `harness_audit` kind would be a migration plus the lockstep test `test_audit_event_registration.py`; avoid one.
- **Backend unit gate:** `pytest tests/unit -q --continue-on-collection-errors` in `backend/` with the venv. The ceiling is 71 failed; 289 measured 78 inherited at base. **Re-derive at base; never quote** (measured this session, see Validation Architecture).
- Frontend: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root, with at most 2 concurrent test agents. Typecheck: `npx tsc -p tsconfig.app.json --noEmit` with a set diff against base (`npx tsc --noEmit` checks zero files).
- Worktrees: run `bash scripts/bootstrap-worktree.sh "$(pwd)"` first, tear down with `scripts/teardown-worktree.sh`, never `rm -rf`. **Plans whose tests mutate the local DB run serially.**
- G-5: `node scripts/check-hot-file-ledger.cjs <phase-dir>` fails on a `files_modified` source file with no ledger row. Rows and sections land in the same commit, with the disposition cell ≤ 200 chars in the docs scan list and ≤ 80 in the CLAUDE.md FIRING table.
- G-8: 3-5 plans. Never cut the verifier, TDD RED drives, security review or migration discipline. Run targeted suites per task and full gates once per wave.
- UAT 4-axis scoreboard in VALIDATION.md, with the full native roster derived from `MODEL_CAPABILITIES` (8 rows). Blocked rows are recorded, never omitted.
- Supabase MCP = production. Reads are free; **every write needs per-action operator approval**.
- Provider-docs-first applies only if provider prompting changes. The judge note is provider-neutral server text, so no provider-specific handling is needed.
- The Extension Contract and closed core stay 7 / 1 / 30: no new phase type, emitter or tool.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Engine-owned ask → durable pause | API / Backend (`harness/engine_ask.py` new, `harness_engine.py`) | Database (`workflow_runs.status`, `messages` prompt row, `workflow_phases.output`) | The engine is the only party that knows the gate failed; durability lives in Postgres |
| Answer consumption + re-drive | API / Backend (`api/runs.py` redrive, engine consume) | — | Already owner-scoped and anchor-confirmed; the server alone maps answer → action |
| Choice list / folder options / locked refusal | API / Backend | Browser renders server words only | 288 D-09: the server builds the sentence; allow-list enforcement must be server-side |
| Unsourced mark | Backend (phase output key) | Browser (`StepEvidenceLine`, evidence report, export) | The 289 D-08 pattern: one output field, rendered read-only |
| Template refusal | Backend pure lint (`reachability.py`) + run-start (`workflow_kickoff.py`, `scheduler_service.py`) | Browser (live `/validate` verdicts already rendered) | One rule, three readers; the Builder already renders lint verdicts generically |
| Judge teaching note | Backend (`validator_kinds._judge_graded_text`) | — | The one shared seam for the in-run and publish judges |
| Truthful run ends | Backend (engine, producer F2, reconciler) | Database | First-terminal-wins `finish_run` is the one write rule |
| "No reason recorded" wording | Browser (vocabulary leaf) | Backend (no change) | Absent data rendered honestly, never invented |

## Standard Stack

No new libraries. The phase is pure application code on the shipped stack.

| Layer | What is used | Verified |
|---|---|---|
| Backend | Python 3.12, FastAPI, asyncpg pool (`get_pg_pool`), supabase-py via `aexec`, Redis pub/sub (`ask_user_service`) | [VERIFIED: codebase read; venv `asyncpg` imported in this session] |
| Tests | pytest (`backend/tests/unit`, `backend/tests`), vitest (frontend) | [VERIFIED: files listed] |
| Frontend | React + TS. `PendingAskCard`, `StepEvidenceLine`, `RunEvidenceReport`, `evidenceView`, `runVocabulary` / `evidenceVocabulary` | [VERIFIED] |

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck was not run because there is nothing to check.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram (the found-nothing / armed pause, after the change)

```
 kickoff (send_message / scheduler) ──► preflight: template refusal (§D) ──► run_workflow loop
                                                                                  │
                                                       mark_phase_active ─────────┤
                                                                                  ▼
            ┌──────────── _run_phase_with_gates(phase, ctx) ─────────────────────────────────┐
            │ 0. consume_engine_answer(ctx.resume_answered_tool_call_id)  ◄── re-drive only   │
            │      ├─ stop/decline ─────────────► PhaseOutcome(fail_run, worded reason)      │
            │      ├─ continue (allowed) ───────► PhaseOutcome(completed, stashed+unsourced) │
            │      ├─ folder F (allowed) ───────► ctx.phase_scope_override[slug]=subtree(F)  │
            │      ├─ armed approve (exact) ────► receipt; skip armed ask once               │
            │      └─ unmatched ────────────────► re-issue the same ask (stay paused)        │
            │ 1. author pre-gates (unchanged)                                               │
            │ 2. armed checkpoint ── golden? auto-continue (189 D-19)                        │
            │                     └─ live? engine_ask.pause(kind=action_risk) ─► pause_run   │
            │ 3. retry loop: execute → post gates                                            │
            │      └─ exhausted on the ENGINE citations gate (grounding predicate)?          │
            │           ├─ retrieval_error ─► fail_run (outage words, D-06)                 │
            │           ├─ golden run ──────► fail_run (worded finding, D-07)               │
            │           └─ live ────────────► stash produced output; prompt row; emit       │
            │                                  ─► PhaseOutcome(pause_run)                   │
            └────────────────────────────────────────────────────────────────────────────────┘
                     │ pause_run arm (existing): pause_run() [+ release claim], policy_applied, run_paused
                     ▼
   workflow_runs.status = 'paused'  ── /pending serves prompt row ── PendingAskCard (server words)
                     │
   POST /runs/{id}/ask_user_response ─► persist answer ─► _redrive_paused_workflow_run
                     │                                        (claim → resume_run → ctx.resume_answered_tool_call_id)
                     ▼
   _resume_run(run_workflow) ─► skips completed rows ─► re-enters the paused phase at step 0
                     │
   escape (BaseException, not shutdown) ─► NEW: finish_run + run_failed  (the stuck-run gap, R3)
```

### Recommended module layout

```
backend/app/services/harness/
├── engine_ask.py      # NEW (plan 1, verbatim move first): _parse_on_failure, _failing_on_failure,
│                      #   _route_on_failure, _ask_user_choices_from_finding, _is_abort_choice,
│                      #   _ABORT_LIKE_CHOICES, _ACTION_RISK_*, _resolve_failure_with_ask_user;
│                      #   then the durable pause + consume_engine_answer helpers
├── grounding.py       # + ONE pure predicate: is_engine_citation_gate(phase, failed_idx)
└── phase_types.py     # ONE helper change: _prior_output_text (Q+A, unsourced note);
                       #   ONE expression: _build_phase_tool_context scope override
backend/app/services/harness_engine.py  # re-imports the moved names (load-bearing, like human_input)
```

### Pattern 1: Take the seam first (D-32), as a verbatim move with a re-import

**What:** move the disposition family listed above out of `harness_engine.py` into `harness/engine_ask.py`, and re-import it into `harness_engine`. The precedent is `human_input.py`'s 200 extraction (`human_input.py:1-45`).

**Why it is required:**
- The durable pause needs ≥ 4 touches in `harness_engine.py`: (1) the ask helper's durable branch; (2) an answer-consume call at the top of `_run_phase_with_gates`; (3) the boot sweep's handling of paused engine asks; (4) `_resume_run`'s terminalize. That is not one helper.
- Branch counts at HEAD, AST-measured this session:
  - `_run_phase_with_gates` (`:676-1225`): If 14 · IfExp 7 · While 1 · Try 4 · BoolOp 10.
  - `_resolve_failure_with_ask_user` (`:1387-1714`): If 14 · IfExp 4 · Try 4 · BoolOp 10.
  - `run_workflow` (`:1725-2816`): If 19 · IfExp 6 · For 3 · While 1 · Try 12.
  - `resume_stranded_workflows` (`:3152-3338`): If 11 · IfExp 2 · For 1 · Try 3 · BoolOp 11.
  - `_resume_run` (`:3139-3149`): 0 branches.
  - Module `ast.If` = 107.

**Patch-surface cost of the move:**
- `harness_engine._resolve_failure_with_ask_user` is referenced **22 times** in tests (`test_185_engine_attachment.py`, `test_ask_user_disposition.py`, `test_publish_service.py`).
- `_ACTION_RISK_APPROVE_CHOICE` / `_ACTION_RISK_FINDING_PREFIX` once each.
- The function reads `write_audit`, `_emit` and `subscribe_for_response` as module globals, so tests that patch `harness_engine.write_audit` / `_emit` (6 + 2 references) will stop intercepting calls made from the moved code. Handle it as `human_input` did: measure RED, then repoint the patch sites in the extraction commit.

**Fences that must stay green:**
- `test_200_human_gate_pause.py:294-341` slices `harness_engine` source between `# The outcome of running a phase…` and `PhaseOutcome = namedtuple(`, and between `if outcome.kind == "pause_run":` and `# ── fail_run:`. **Keep `PhaseOutcome` and the outcome arms in `harness_engine.py`.**
- `test_185_engine_attachment.py:77` asserts the appended spec's `on_failure == "fail_run"`. Keep it, which is why the recommendation below identifies the gate by predicate rather than by disposition.

### Pattern 2: The engine citations gate is identified by a pure predicate, not by a new disposition literal

```python
# grounding.py — ONE pure helper, zero I/O (the grounding_cause idiom)
def is_engine_citation_gate(phase, failed_idx: int | None) -> bool:
    """True iff the failing validator is the citations gate effective_phase appended.
    effective_phase appends exactly ONE spec, at the END, only when cause == 'detected'
    (:1404-1417); an author's own citations_required sits at a lower index (D-185-05)."""
    vs = list(getattr(phase, "validators", None) or [])
    return (
        failed_idx is not None and failed_idx == len(vs) - 1
        and grounding_cause(phase) == "detected"
        and vs[failed_idx].kind == "citations_required"
        and (vs[failed_idx].config or {}).get("mode") == "retrieved_and_cited"
    )
```

Why not `on_failure="ask_user"` or a new literal:
- `"ask_user"` on the appended spec would route through the author ask path (in-process).
- A new literal is author-writable through `ValidatorSpec.on_failure: str` (`models/harness.py:505`), which would open a second pause path authors can opt into. `_interactive_phase_failures` reads `getattr(v, "on_failure") == "ask_user"` (`publish_service.py:1334-1346`) and would not refuse it.

**D-07 confirmation:** `_interactive_phase_failures` iterates `definition.phases[*].validators`, the *stored* list, never `effective_phase`. The engine gate is invisible to it and stays so under this design. [VERIFIED: `publish_service.py:1309-1347`]

### Pattern 3: The finding kind comes from the produced output, not by sniffing the message

The engine helper re-derives the finding from the same keys the validator reads:

| Condition | Finding | Action |
|---|---|---|
| `output.get("retrieval_error")` | outage | D-06 `fail_run` |
| `not output.get("citations")` | no_sources | pause |
| otherwise | no_markers | pause |

(`validator_kinds.py:289-334`.) This needs no change in `validator_kinds.py` (which spends its single G-5 touch on D-15) and keeps the shipped validator messages byte-identical. Several tests pin them: `test_185_detection.py`, `test_validator_kinds.py`, `test_260828_09_publish_names_the_failing_step.py`.

### Pattern 4: Immediate durable pause (no in-process wait) for both engine asks

`engine_ask.pause(...)`:
1. If `ctx.is_golden_run`: return the D-07 `fail_run` (citations) or keep the 189 auto-continue (armed; unchanged at `:874-884`).
2. Compose the server prompt and choices (§B).
3. Stash what the re-drive needs: the produced output (citations only), the kind, `continue_allowed`, `folder_option_ids` aligned to the options, and the phase slug. Store it on the active `workflow_phases.output` under a key that is **not** `tool_call_id` at top level, e.g. `{"_awaiting_answer": {...}}`. `_is_llm_human_input` keys on `"tool_call_id" in output` (`harness_engine.py:3352-3354`). The alternative is the prompt row's `tool_calls[0]`; see Open Q1.
4. `pause_run(pool, run_id)` **before** the emit (WRITE-before-EMIT). This closes the race in which an answer arrives while the status is still `active`: `_redrive_paused_workflow_run` requires `status='paused'` (`api/runs.py:697`) and would return False, leaving the answer durable but with no re-drive.
5. Insert the prompt row. **It is no longer best-effort**, because it is the only way back in. On insert failure return `fail_run` with words (fail closed).
6. Emit `ask_user_prompt` with `timeout_seconds=None` (R7).
7. Return `PhaseOutcome("pause_run", None, None, reason)`. The existing arm (`:2444-2458`) does the rest. Its forbidden-things fence stays satisfied.

### Pattern 5: Consuming the answer on re-drive (top of `_run_phase_with_gates`)

The single-use key is `ctx.resume_answered_tool_call_id`, set only by `_redrive_paused_workflow_run` (`api/runs.py:733`) and read today only by `human_input` (`:169-192`).
- The engine consume step reads it **only if** the active phase row's `_awaiting_answer.tool_call_id` equals it. Otherwise it leaves the flag for the human executor.
- It fetches the answer with `get_ask_user_response(pool, run_id, tcid)` (`db/workflows.py:2290-2348`). That function is run-scoped through the prompt row and excludes `expired` rows.
- It resolves `response_text` or `choice_index` through an **exact-label allow-list**:
  - armed: `_ACTION_RISK_APPROVE_CHOICE` only; otherwise the shipped decline reason;
  - citations: the stored option list. "Continue…" is honoured only if `continue_allowed` **and** the step is still unlocked when re-checked from the live definition (D-05). A folder label maps to its stored `folder_option_ids[i]`; "Stop" → fail.
  - An unmatched answer re-issues the same ask (the run stays paused and never fails for want of a readable answer).
- Receipt: `validator_ask_user_approved` with `{phase, choice, finding, folder_id?, unsourced?}`. This is an existing kind, so no migration.

### Pattern 6: Folder re-run override

Store the override in memory on ctx and record it in the audit. Apply it with **one expression** at `phase_types.py:636-641`:

```python
_override = (getattr(ctx, "phase_scope_override", None) or {}).get(phase.slug)
_proj = _override if _override is not None else getattr(ctx, "folder_subtree_ids", None)
```

`_override` is `resolve_project_subtree(F)` (a list, Pitfall 1: never a set). The phase's own `folder_scope` intersection still applies on top, so the result only narrows from F. A restart in the middle of a re-run loses the override; the re-run then repeats with the definition's scope and pauses again on "nothing found". That degradation is honest. Persisting the override in `workflow_runs.inputs` would make it durable, but `_external_action_inputs` sweeps every `ctx.inputs` key except `kickoff_prompt` into the email arguments (`phase_types.py:2084-2133`), so a new inputs key would leak into recorded intents unless it is also added to `_NON_ACTION_RUN_INPUTS`. (The scheduler's `_schedule_*` keys appear to leak today [VERIFIED by reading; not driven].)

### Anti-Patterns to Avoid
- **Changing the appended spec's `on_failure`:** it breaks `test_185_engine_attachment.py:77` and routes through the in-process author path.
- **Sniffing the validator message to classify the finding:** use the output keys (Pattern 3).
- **A client-composed choice list or a client folder picker over all folders:** the server owns the bound (D-02/D-03). A generic picker shows folders the server would refuse, which is a dead option.
- **Re-asking with a new `tool_call_id` on re-drive:** the person's card stops being the one the run listens to (the 185 L-7 lesson). On re-drive, consume; never re-ask the same question.
- **`try/finally` around `run_workflow`'s loop:** already rejected (`harness_engine.py:2383-2394`). Put the new terminalize in `_resume_run`, outside the engine loop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable pause/resume | A new status or a new wait loop | `PhaseOutcome("pause_run")` + `pause_run` + `_redrive_paused_workflow_run` + `ctx.resume_answered_tool_call_id` | Shipped, fenced (`test_200_human_gate_pause.py`), owner-scoped |
| Answer lookup | A new query | `db.workflows.get_ask_user_response` | Run-scoped via the prompt row; excludes expired |
| Folder bound | A new permission rule | `scope.resolve_run_scope_root`'s acceptance rule + `resolve_project_subtree` + `fetch_visible_folders` | "The rule the run already obeys" (D-03); 152-08 containment |
| KB label in sentences | A folder-name query | `phase_confidence.resolve_kb_label(pool, definition)` (`:130-155`) | Scrubbed, clamped, never raises |
| Person's name ("continued by") | A new name chain | The `compose_waiting_on` name chain (`api/workflow_runs.py:791-830`, `profiles.display_name` → owner email → fallback) | One name chain |
| Terminal write | Raw UPDATEs | `finish_run` (first-terminal-wins, `db/workflows.py:2351-2461`) | Value-identity guard |
| Template-staged check | A new predicate | A helper next to Branch 2 in `template_asset_service.py:209-226` | One eligibility truth (274 WR-01) |
| No-template sentence | A new string | Export a composer from `emit_cause.py` (`_NO_TEMPLATE_SENTENCE`, `:121`; check line `:136`) | D-12 "one string in one place" |

## Runtime State Inventory

Not a rename phase, but run state matters, so each category is answered:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 2 stuck `workflow_runs` (`51924c91…`, `a77ed2c0…`) `active` + anchored, phases terminal, unexpired prompt rows (2 + 2, a77 has expired responses). 20 reasonless `failed` (15 leaked fixtures, 5 June F2). | D-21 sweep finalizes the 2 (it must also expire their pending prompts). The 20 are explained, not backfilled. Fixture cleanup is out of scope and approval-gated. |
| Live service config | None. Production read via MCP is owed to the coordinator (this subagent has no MCP); the coordinator already captured DMT at `evidence/dmt-shape-prod-75922069.json`. | Coordinator: MCP SELECT the same Q-9 queries on prod for D-22. |
| OS-registered state | None. Verified: no task-scheduler or pm2 coupling to run state. | — |
| Secrets/env vars | None. Uses `ask_user_max_timeout_seconds` (1800) and `harness_resume_lease_seconds` (300) (`config.py:1412, 1655`); no new var, so no deploy-drift artifact change. | — |
| Build artifacts | Two snapshot files are **modified in the working tree at research time**: `frontend/src/pages/__tests__/__snapshots__/WorkflowRunPage.seam286.pin.test.tsx.snap` and `WorkflowBuilderPage.seam286.pin.test.tsx.snap`. | The planner must establish base before any RunPage change. These pins may red for reasons not caused by 295. |

## Common Pitfalls

### Pitfall 1: The claim lease is never released on pause
**What goes wrong:** `claim_run` stamps `claimed_at` and matches only when the lease is unset or older than 300 s (`db/workflows.py:2495-2507`; `config.py:1655`). Nothing ever clears it. After a re-drive, a second pause ("search another folder" also finds nothing, or armed then citations) answered within 300 s fails the claim ("re-drive skipped, run already claimed", `api/runs.py:705-708`). The answer is durable but **nothing re-drives it except the next boot**.
**Avoid:** release the lease when the run pauses (`pause_run` sets `claimed_at = NULL`). `test_200_human_gate_pause.py:153-157` matches the substring `UPDATE workflow_runs SET status = 'paused'` and the NOT-IN guard, so an extra `, claimed_at = NULL` keeps it green. This also fixes a latent pre-existing case: a short-timeout second human step.
**Warning sign:** a log line "re-drive skipped, run … already claimed" after an answer.

### Pitfall 2: The boot sweep re-runs paused runs and re-asks
`find_resumable_runs` returns `paused` runs too (`db/workflows.py:1647`). For a paused engine ask, a re-run would re-execute the KB body and mint a second prompt. The measured stuck runs carry 2 prompt rows each, and in the human branch the `resume_pending_prompt` return value is ignored (`harness_engine.py:3197-3209`).
**Avoid:** in the sweep, an engine-ask phase (`_awaiting_answer` present) that is unanswered → skip (leave paused); if answered → set `ctx.resume_answered_tool_call_id` before `_resume_run`. Whether to extend the same rule to paused human steps is the planner's choice (a behaviour change; check `test_harness_resume.py` and `test_200_human_gate_pause.py`).

### Pitfall 3: `_resume_run` misreports and strands a cancelled re-drive
`_redrive_failed` is set only on `except Exception` (`:3275-3277`; `api/runs.py:746-747`), so a `CancelledError` finalizes the resume shell `completed` and never touches `workflow_runs`. This is what the two stuck runs show.
**Avoid:** `_resume_run` mirrors F2: on a non-shutdown `BaseException`, `finish_run(cancelled|failed)` + `run_failed` (for failed), then re-raise. The shell status should also read `cancelled` on `CancelledError`.

### Pitfall 4: The prompt-row insert is "best-effort" today
`_resolve_failure_with_ask_user:1508-1543` logs and continues on insert failure. For a durable pause, that would leave a paused run with no card (unanswerable).
**Avoid:** fail closed with words.

### Pitfall 5: "Window has passed" at second 0
See R7. **Avoid:** `timeout_seconds=None` for engine asks. Then `hasDeadline` is false and neither the clock nor the window line renders (`PendingAskCard.tsx:651, 664`).

### Pitfall 6: D-23 suppression can drop the only message
An emit failure on a phase **without** validators completes with `failure`. `fail_phase` runs at `:2587-2606`, the run continues and ends `completed`, and the executor's surface is the ONLY failure message. A valid `skip_to` and an author ask_user Proceed on a failure output also surface nothing from the engine.
**Avoid:** suppress the executor surface (`phase_types._surface_failure_message`, `:372-384`, one guard on a ctx flag set at the top of `_run_phase_with_gates` when validators exist). Then have the engine surface the composed cause once in each failure-terminal arm: `fail_run` (exists, `:2473`), missing `skip_to` target (exists, `:2515`), valid `skip_to`, and completed-with-`failure` (`:2587`). Test: count assistant rows = 1 for each arm.

### Pitfall 7: The cancel sentinel completes a human step with an empty answer
`human_input.py:302-327`: a `{"kind":"cancel"}` payload falls through to `answer = ""` and returns normally. The engine would `complete_phase` unless `task.cancel()` lands first (a race). [MEDIUM: read, not driven]
**Avoid:** raise `CancelledError` on cancel, as on shutdown (`:283-287`).

### Pitfall 8: Moving functions moves the patch surface
See Pattern 1. Measure RED before repointing, as the `human_input` extraction did.

### Pitfall 9: The template lint must not refuse the launch-upload shape at run start
See R2. A thread-life chat attachment (`expires_at NULL`) is never a workflow template (`template_asset_service.py:194-218`). The run-start check must use the same predicate, or it will admit a chat PDF.

### Pitfall 10: The `unsourced` note leaks into the external action body
If the downstream step is `external_action`, `_latest_phase_text` → `content`. If the D-11 note is added inside `_latest_phase_text`, the email body would carry it.
**Avoid:** put the note in `_prior_output_text` (the model user turn) only. Showing it to the recipient is a separate decision; see Open Q4.

## Code Examples

### §A — Where the engine ask is decided today (the exhausted branch)
```python
# harness_engine.py:1216-1225 (HEAD) — the single post-gate exit that becomes the pause decision
_clear_retry_feedback(ctx)
return await _resolve_failure_with_ask_user(
    phase, cause, attempt, failed_idx,
    run_id=run_id, pool=pool, redis=redis, ctx=ctx,
    _audit_user_id=_audit_user_id, stream_run_id=stream_run_id,
    produced_output=output, is_pre=False, reason_is_final=diagnosed,
)
```
Inside the moved helper (`engine_ask.py`), the first `if not is_action_risk:` arm (`:1448-1454`) gains one condition:

```python
if not is_action_risk:
    disp = _parse_on_failure(_failing_on_failure(phase, failed_idx))
    if disp.kind != "ask_user":
        if not is_pre and is_engine_citation_gate(phase, failed_idx):
            return await engine_citations_pause(...)   # §Pattern 4 (golden → D-07 fail_run)
        return _route_on_failure(phase, error_message, attempt, failed_idx, reason_is_final=reason_is_final)
```
The armed call (`:1067-1072`) becomes `engine_action_risk_pause(...)`, the same durable helper with `kind="action_risk"`.

### §C — BUG-261020-01 reader (`phase_types.py:173-190`)
```python
def _handoff_text(out) -> str | None:          # ONE helper (D-11)
    if not isinstance(out, dict):
        return None
    text = out.get("text")
    if "answer" in out and out.get("tool_call_id") is not None:   # an llm_human_input output
        a = (out.get("answer") or "").strip()
        return f"Question asked: {text}\nThe person answered: {a or '(no answer)'}"
    if out.get("unsourced"):
        return f"[Note: this step's output was accepted without sources; do not present it as sourced.]\n{text}" if text else None
    return text or None
```
`_prior_output_text` maps `_handoff_text` over the outputs. `human_input._latest_phase_text` skips outputs carrying `answer` (R9). The live golden mock output (`human_input.py:142-147`) carries `answer` + `tool_call_id`, so the publish judge's wrap step now sees "The person answered: Yes", which bears on F-2.

### §D — Lint code (`reachability.py`)
```python
LINT_CODES = frozenset({..., "no_template_bound"}) | ARGUMENT_GAP_CODES
# in lint_workflow, after _check_input_contracts:
has_template = any(getattr(a, "kind", None) == "template" for a in (definition.assets or []))
if not has_template:
    for p in phases:
        cfg = p.config
        if getattr(cfg, "phase_type", None) == "llm_emit" and getattr(cfg, "emitter", "render_template") == "render_template":
            errors.append(LintError("no_template_bound", p.slug, no_template_lint_sentence(p)))  # from emit_cause
```
Constraints:
- `test_182_severity_codes.py` scans for literal codes in `LintError(` calls and asserts `scanned | ARGUMENT_GAP_CODES == LINT_CODES`, so add both in one commit.
- Add the code to `_INCOMPLETE_CODES` (`api/workflows.py:741-753`).
- `test_103_lint_block.py` / `test_288_pause_lint.py` may build emit definitions without assets; re-run them.

### §E — Judge seam (`validator_kinds.py:184-202`)
```python
_RECORDED_INTENT_NOTE = (
    "\n\n--- HOW THIS STEP IS DESIGNED (data, written by the server) ---\n"
    "The last step records an outward action instead of performing it. Not sending is the "
    "correct, designed behaviour here. Grade whether the RECORDED action (where it would go, "
    "what it would say) satisfies the business requirement.\n"
)
ri = output.get("recorded_intent")
if ri:
    graded = f"{graded}{_RECORDED_INTENT_NOTE}--- THE RECORDED ACTION, IN FULL ---\n{_render_inputs(ri.get('inputs'))[:8000]}"
```
- **Why D-16 needs the full inputs:** the NOT-SENT body clips every value at **500 chars** (`_INTENT_TEXT_MAX_CHARS`, `phase_types.py:2072-2081`). For the DMT shape (`content` = the whole summary), the judge sees the summary truncated with "… (N chars — kept in full in the record)". `recorded_intent["inputs"]` keeps it whole (`:2068-2071`).
- This uses no `_deliverable_output` change, so `publish_service.py`'s judge path is untouched.
- A graded output without `recorded_intent` returns byte-identical text (pin it).

## State of the Art (within this codebase)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| The armed gate as a validator in the author list | A hoisted pre-body checkpoint | 187 (D-187-01) | The armed ask has its own call site; easy to make durable |
| Human gate fails open on timeout | `HumanInputTimeout` → `pause_run` | 200 (D-10) | The durable pause exists, and the answer-triggered re-drive exists (200/289) |
| The validator shape message wins | The executor's composed cause wins (`reason_is_final`) | 281 (2026-10-15) | BUG-08's chat and reason halves were already fixed |
| `/validate` lint only for structure | + argument gaps (214) | 214 | Precedent for extending one lint stage |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The operator means "author-locked" = `grounding_escalated` (R1) | Refuted R1 | Continue is offered or withheld on the wrong steps; SC#1 misjudged |
| A2 | Mid-run panel template upload (after kickoff) is not a flow the operator relies on, so a run-start refusal is acceptable | §D / Pitfall 9 | A workflow started first and given its template later is refused at kickoff |
| A3 | An immediate durable pause with no deadline satisfies D-01's intent (R7) | Pattern 4 | The operator wanted a visible clock |
| A4 | A restart mid-folder-re-run may lose the in-memory override (re-pauses honestly) | Pattern 6 | One extra pause after a restart |
| A5 | The 2 stuck runs' cancellation trigger is not product-relevant beyond the missing terminalize | R3 | Another cancel source keeps producing stuck rows; D-21's sweep remains the backstop |
| A6 | Search returned 0 citations over populated folders for reasons outside this phase (agent did not search, `ls`/`tree`-only steps, or vectors absent at the time) | Q-D3 | The measured "0 sources" population rarely benefits from "another folder"; SC#5 falls because pause replaces fail, not because sources are found |
| A7 | The judge passes a correct DMT run once it sees the note + full content | §E | SC#3 still fails; then D-16's "upstream deliverable" variant (render the previous phase's text too) is the next step |

## Open Questions

1. **Stash location for the produced output (D-04) and the engine-ask metadata.**
   - Option (a): `workflow_phases.output` of the active row under `_awaiting_answer`. It survives a restart, is readable by `get_active_phase` in the sweep, and needs one new db writer (`db/workflows.py`, FIRES at 28 phases).
   - Option (b): the prompt row `tool_calls[0]`. No new writer, but the read needs the prompt payload (extend `get_ask_user_response`'s return additively, since it already joins `p`).
   - Recommendation: (a). It is phase-keyed and the sweep can see it. Check the 289 evidence and run-page readers ignore a non-`text` key on an active row.
2. **Locked predicate (R1).** Operator decision; see options (a)/(b)/(c).
3. **Decline vs stop status.** D-02 Stop → `failed` "stopped by <person>". Should the armed "Do not run it" also end `failed` (today) or `cancelled`? Recommend `failed`, with a reason that names the person and the step and drops the prompt sentence (R4).
4. **Should an unsourced input be stated to the external action's recipient?** Out of D-04's three places; recommend no (Pitfall 10).
5. **Production state for D-22.** Run the Q-9a/b queries against production via MCP (read-only). This subagent had no MCP tools.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres (Supabase) 127.0.0.1:54322 | DB measurements, DB-mutating tests | ✓ (queried this session, read-only) | — | — |
| backend venv python + asyncpg | tests, queries | ✓ | Python 3.12 | — |
| Redis (local) | engine pause/answer tests that use real pub/sub | not probed (most unit tests stub it) | — | stubbed `redis` in unit tests |
| Live providers (8-row roster) | UAT S1-S7, D-33 | not probed; Anthropic billing-blocked in 288/289/294 per CONTEXT | — | record ⛔ rows |
| Supabase MCP (prod reads) | D-22 production statement | ✗ in this subagent | — | the coordinator runs it |

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`, but the orchestrator explicitly requested this section (item 13), so it is included.

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest. Quick: `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_295_*.py -q`. Full: `pytest tests/unit -q --continue-on-collection-errors` |
| Frontend | vitest. Quick: `npx vitest run <files>` with `GSD_VITEST_MAX_WORKERS=2`. Gate: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root |
| Backend baseline (this session, HEAD `e88a776c6`, working tree as in git status) | measured this session: **70 failed, 8421 passed, 1 skipped, 2 xfailed, 2 xpassed** in 471 s (`pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider`). Under the 71 ceiling; the passed count far exceeds the locked 3497, so the ceiling compares FAILED only. The executor re-derives at its own base and diffs the failing SET, never the count |

### Phase Requirements → Test Map (TDD RED targets)
| Decision | Behavior | Type | File (new = ❌ Wave 0) |
|---|---|---|---|
| D-32 seam | The move is verbatim: `engine_ask._resolve_failure_with_ask_user is harness_engine._resolve_failure_with_ask_user`; every repointed patch still intercepts | unit | ❌ `tests/unit/test_295_engine_ask_seam.py` |
| D-01/D-18 | Engine citations gate exhausted (no_sources / no_markers) → `pause_run`, prompt row written, status `paused` before emit, no `subscribe_for_response` call, `timeout_seconds=None` | unit (stub pool/redis) | ❌ `tests/unit/test_295_engine_ask_pause.py` |
| D-18 | Armed live → `pause_run` (not an in-process wait); golden → unchanged auto-continue; `test_187_armed_checkpoint_property.py` stays green | unit | same + existing |
| D-01 re-drive | Answer → `_redrive_paused_workflow_run` → consume: continue → `completed` with the stashed output + `unsourced`; stop → `failed`; folder → body re-runs with the override; armed approve → body runs once, no second prompt | unit / integration (local DB, **serial**) | ❌ `tests/test_295_engine_ask_redrive.py` |
| Pitfall 1 | Second pause after a re-drive → answer within 300 s still re-drives (lease released) | unit | same |
| Pitfall 2 | Boot sweep: paused + unanswered engine ask → not re-driven, no new prompt row | unit | ❌ in `test_295_engine_ask_redrive.py` |
| D-05 / R1 | Locked step: options lack continue; a forged continue (`response_text` or index) → refused (re-asked or failed per the decided rule) and never `completed` | unit | ❌ `tests/unit/test_295_found_nothing_choices.py` |
| D-03 | Folder options = only folders `resolve_run_scope_root` would accept; none → no folder choice; a forged index out of range → refused | unit | same |
| D-06 | `retrieval_error` → `fail_run` with the outage sentence (unchanged) | unit | same |
| D-07 | Golden run: engine gate → `fail_run` with "Searched <KB> and found nothing during validation", no "citations_required:" in `_failure_reason` / blocked_step cause | unit | same (+ update `test_260828_09_*` expectations if wording changes) |
| D-08 / R11 | Armed + KB: the approval prompt precedes body; author post ask_user Proceed still runs the engine gate (if fixed) | unit | same |
| D-10/D-11 | Wrap input contains "The person answered: Yes"; unsourced note in user turn; `_latest_phase_text` skips human outputs; email `content` = summary not question | unit | ❌ `tests/unit/test_295_prior_output_answer.py`; keep `test_198_node_vocabulary.py:130-139` green |
| D-12 | `lint_workflow` emits `no_template_bound` for emit-without-asset; `LINT_CODES` lockstep (`test_182_severity_codes.py`); `/validate` severity `incomplete`; publish blocked at stage `lint` with the sentence | unit | ❌ `tests/unit/test_295_template_lint.py` |
| D-13 | Preflight refuses without an asset and without a staged template; admits with a staged `template_input`; scheduler refuses | unit | same |
| D-14 | Diagnosed emit failure: `gate_failed.validator_error` not "no field_map"; chat contains no `citations_required` | unit | update `test_281_engine_cause_precedence.py:137` deliberately |
| D-15/D-16 | `_judge_graded_text`: byte-identical without `recorded_intent`; with it, the note + full inputs (> 500 chars survive) | unit | ❌ `tests/unit/test_295_judge_recorded_intent.py` |
| D-19 | Cancel payload on an author ask / human window → `CancelledError` path → run `cancelled`, 0 `run_failed`; paused-run Stop → `cancelled` | unit | ❌ `tests/unit/test_295_truthful_run_ends.py` |
| D-20 | `_resume_run` escape → `finish_run` + `run_failed`; golden-run crash/timeout → workflow_runs terminal; sweep definition-won't-load → `failed` + reason; F2 writes `run_failed` | unit | same |
| D-21 | Reconciler finalizes active-with-all-phases-terminal-and-old; leaves an in-flight run alone (age guard); expires pending prompts; does not NULL totals | unit + local DB read | same + `test_250_reconciler_gate.py` |
| D-22 | Run page / evidence: failed + no step reason → "No reason was recorded when this run failed." (content assertion) | vitest | `WorkflowRunPage.test.tsx`, `evidenceView.test.ts`, `RunEvidenceReport.test.tsx` |
| D-23 | One failed emit run (with validators) → exactly 1 assistant row; each failure-terminal arm surfaces once | unit | ❌ in `test_295_truthful_run_ends.py` |
| D-04 FE | `StepEvidenceLine` renders "○ Unsourced · continued by <name>" (content), evidence report the same, export payload carries `unsourced` | vitest | `StepEvidenceLine.test.tsx`, `RunEvidenceReport.test.tsx`, `evidenceView.test.ts`, `RunSpine.test.tsx` |
| Card | Server options render as buttons unchanged; engine ask with `timeout_seconds=null` shows no clock / no window line | vitest | `PendingAskCard.test.tsx`, `PendingAskCard.paused.test.tsx`, `PendingAskStack.oneInput.test.tsx` |

Existing suites to re-run per wave: `test_200_human_gate_pause.py`, `test_harness_resume.py`, `test_289_redrive_failure.py`, `test_ask_user_disposition.py` (invariant: every presented pair classified — new citation choices must be handled by the engine-ask allow-list and must not regress `_is_abort_choice`), `test_185_engine_attachment.py`, `test_187_armed_checkpoint_property.py`, `test_publish_service.py`, `test_288_pause_lint.py`, `test_audit_event_registration.py`, `test_189_no_egress.py`.

### UAT roster (D-33), derived from `MODEL_CAPABILITIES` (`config.py`) plus the local Model Registry
| Provider | Newest registry-backed id (seed → local registry) | Note |
|---|---|---|
| OpenAI | `gpt-5.6-sol` (seed) | force_strict |
| Anthropic | `claude-opus-4-8` (seed); registry also has `claude-opus-5-5`, `claude-sonnet-5-5` | billing-blocked in 288/289/294; re-test |
| Google | `gemini-3.5-flash` / `gemini-3.1-pro-preview` (seed); registry `gemini-3.8-flash` | |
| DeepSeek | `deepseek-v4-pro` | |
| Zhipu / GLM | `glm-5.2` (seed); `glm-5.3` registry row (BUG-261020-06 closed) | |
| MiniMax | `MiniMax-M3` (seed) | |
| Moonshot / Kimi | `kimi-k2.6` (seed); registry `kimi-k3` | `coerce` tier |
| OpenRouter | `deepseek/deepseek-v4-pro` or `z-ai/glm-5.2` | non-native tool path |

The planner should re-derive at plan time by grouping `MODEL_CAPABILITIES` by `provider`, preferring the newest registry-backed id. Axes: multi-tool (KB search + `execute_code` in one run), parallel-thread (thread A paused at the found-nothing card while thread B starts a run), long-message (≥ 5 KB kickoff into the KB step).

### Wave 0 Gaps
- [ ] `tests/unit/test_295_engine_ask_seam.py`, `test_295_engine_ask_pause.py`, `test_295_found_nothing_choices.py`, `test_295_prior_output_answer.py`, `test_295_template_lint.py`, `test_295_judge_recorded_intent.py`, `test_295_truthful_run_ends.py`
- [ ] `tests/test_295_engine_ask_redrive.py` (local DB; serial)
- [ ] Ledger rows for `ask_user_service.py` (5/3/370), `harness/human_input.py` (3/2/340), `harness/scope.py` (9/3/419), `api/panel.py` (5/4/282), `services/template_service.py` if touched. These are re-derived triples; `check-hot-file-ledger.cjs --files` reported `[no-row]` for each.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no (unchanged) | — |
| V3 Session | no | — |
| V4 Access Control | **yes** | Answer route stays owner-scoped and anchor-confirmed (`api/runs.py:880-907`). The folder override is bounded server-side by `resolve_run_scope_root`'s rule and `resolve_project_subtree` (never a client id). `tool_call_id` is consumed only when it matches the phase's stashed ask (run-scoped `get_ask_user_response`). |
| V5 Input Validation | **yes** | An exact-label allow-list for every engine-ask answer (T-185-04-01). An unmatched answer is never a proceed. `choice_index` range-checked against the stored option list. |
| V6 Crypto | no | — |
| V7 Logging | yes | Receipts via existing audit kinds. No answer text in failure reasons (shipped rule, `:1666-1668`). |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Forged "continue" on a locked step (S3) | Tampering / EoP | Server re-checks locked on consume against the live definition; continue is absent from the stored options; refusal test |
| Forged folder id / index → widening retrieval | EoP / Info disclosure | Server-built options only; the index maps to the stored id; the id is re-validated against the same rule on consume |
| Answer for another run's prompt | Spoofing | `get_ask_user_response` joins the prompt row on `run_id` (`db/workflows.py:2319-2340`) |
| Golden run performing or approving an action | EoP | Golden runs never pause (D-07 fail / 189 auto-continue), and `find_resumable_runs` / redrive exclude `is_golden_run` (`api/runs.py:699`, `db/workflows.py:1649`) |
| Judge prompt injection via recorded inputs | Tampering | Render inputs inside a delimited DATA block (the `JUDGE_RUBRIC_CORE` convention, T-102-03-02); `overall_passed` is schema-bound |
| Unsourced output presented as sourced downstream | Repudiation | D-11 note in the user turn; mark in three render sites asserted on content |

## Measurements (read-only, local DB `127.0.0.1:54322`, 2026-10-20) — queries verbatim

Harness used: asyncpg with `SET default_transaction_read_only = on` inside a read-only transaction. `harness_audit.metadata` is often a jsonb **string scalar**, so `metadata #>> '{}'` unwraps both shapes.

**Q-9a: the stuck active runs**
```sql
select wr.id, wr.status, wr.is_golden_run, wr.created_at, wr.updated_at, wr.claimed_at, wd.name,
  (select active_workflow_run_id = wr.id from threads t where t.id=wr.thread_id) anchored,
  (select string_agg(wp.phase_index||':'||wp.slug||':'||wp.status, ' | ' order by wp.phase_index)
     from workflow_phases wp where wp.workflow_run_id=wr.id) phases
from workflow_runs wr left join workflow_definitions wd on wd.id=wr.definition_id
where wr.status='active';
```
Result:
- `51924c91` "200-Word Essay Writer": golden false, anchored true, `0:write-essay:completed | 1:act:cancelled`, claimed/updated 2026-10-19 18:58:47.
- `a77ed2c0` "Knowledge Base Library Structure Summary": golden false, anchored true, `…:completed | 2:act:cancelled`, claimed/updated 2026-10-20 00:17:00.
- Audit for both: `action_risk_pending` at creation, then `phase_started act` + `action_risk_pending` again at the re-drive.
- Prompt rows: 2 per run. a77 shows two `expired:true` response rows at 00:17:01.
- `runs` shells: the originals are `cancelled`; the resume shells `85a7cbda` / `0c64f361` are `completed`.

**Q-9b: failed runs with no `run_failed`**
```sql
select wr.id, wr.created_at::date d, wr.is_golden_run g, wd.name,
  (select string_agg(wp.phase_index||':'||wp.slug||':'||wp.status, ' | ' order by wp.phase_index) from workflow_phases wp where wp.workflow_run_id=wr.id) phases,
  (select string_agg(r.status||':'||coalesce(r.error,''), ',') from runs r where r.thread_id=wr.thread_id) shells
from workflow_runs wr left join workflow_definitions wd on wd.id=wr.definition_id
where wr.status='failed'
  and not exists (select 1 from harness_audit ha where ha.run_id=wr.id and ha.event_type='run_failed')
order by wr.created_at;
```
Result: 20 rows.
- 5 dated 2026-06-01..06-11 ("Doc Q&A" ×2, "Risk Register Fill" ×2, "Ephemeral Template Fill"). They have phase rows (failed or cancelled) and shells that failed with provider/DB exceptions or were cancelled.
- 15 dated 2026-08-28 11:10-11:12 ("Global WF"): no phases, no audit, no shells, thread title "phase 214-14 seam thread", the fixtures from `tests/integration/test_214_argument_seams.py:212-215`.

**Q-9c: approval "waiting" failures**
```sql
select ha.event_type, ha.created_at, wr.status, left(ha.metadata::text, 220) head, right(ha.metadata::text,100) tail
from harness_audit ha left join workflow_runs wr on wr.id=ha.run_id
where (ha.metadata::text ilike '%action_risk:approval%' or ha.metadata::text ilike '%run is waiting%')
  and ha.event_type <> 'validator_ask_user_approved' order by ha.created_at;
```
Result: 7 `run_failed` rows (2026-07-31, 08-27, 09-12 ×5). All carry an answered outcome: `— aborted by user` (6, with response "Do not run it", choice_index 1, where the run still exists) and `— not approved: the answer did not match the approval option` (1).

**Q-D3: scope of the failing KB steps.** The scratchpad script ran this; its logic: for each `gate_failed` row matching `%nothing was retrieved%`, read the run's `definition_snapshot` (or definition), take that phase's `config.folder_scope`, and count `documents` in the scope, the project root and the project subtree.
- Result: 13 distinct (workflow, step) pairs. **All have `folder_scope = null`.**
- 9 pairs have 3-6 completed, fully embedded documents in the project subtree today (e.g. project `37380338…`: 6 docs / 784 embedded chunks).
- "Summarize DeepWiki…" has 0 docs. 3 pairs are unbound (`project_folder_id` null).

**Gate-failure mix (reproduces the 2026-10-20 memory)**
```sql
select count(*) filter (where (metadata #>> '{}') ilike '%citations_required%') cit,
       count(*) filter (where (metadata #>> '{}') ilike '%nothing was retrieved%') zero_src,
       count(*) filter (where (metadata #>> '{}') ilike '%citation markers in the answer%') zero_markers,
       count(*) filter (where (metadata #>> '{}') ilike '%no field_map on output%') no_fm,
       count(*) total
from harness_audit where event_type='gate_failed';
-- → cit 109 · zero_src 53 · zero_markers 22 · no_fm 10 · total 122   (last 60 days: 35 of 36 citations_required)
```

### §G — D-09 / SC#5 baseline: the share of runs ending in a `citations_required` failure

**Definition:**
- **Denominator:** terminal `workflow_runs` (`status in completed, failed, cancelled`) in the window.
- **Numerator:** those with `status = 'failed'` whose LATEST `run_failed` audit reason contains `citations_required`.
- Reported separately for live (`is_golden_run = false`) and golden (`true`) runs, plus combined.

```sql
-- SC#5 share. Set :since to the window start (all-time baseline = '-infinity'; UAT = the 295 UAT start).
with term as (
  select wr.id, wr.is_golden_run, wr.status,
         (select ha.metadata #>> '{}' from harness_audit ha
           where ha.run_id = wr.id and ha.event_type = 'run_failed'
           order by ha.created_at desc limit 1) as fail_md
  from workflow_runs wr
  where wr.status in ('completed','failed','cancelled')
    and wr.created_at >= :since
)
select is_golden_run,
       count(*)                                                            as terminal_runs,
       count(*) filter (where status='failed')                             as failed_runs,
       count(*) filter (where status='failed' and fail_md ilike '%citations_required%') as citations_failed,
       round(100.0 * count(*) filter (where status='failed' and fail_md ilike '%citations_required%')
             / nullif(count(*),0), 1)                                      as pct_of_terminal
from term group by is_golden_run order by is_golden_run;
```

**Baseline (all time, 2026-10-20):**

| | terminal | failed | citations_failed | share |
|---|---|---|---|---|
| live | 227 | 41 | 13 | **5.7 %** |
| golden | 58 | 19 | 14 | **24.1 %** |
| combined | 285 | — | 27 | **9.5 %** |

**Since 2026-09-01:** live 10 terminal (3 completed / 7 failed, of which 1 citations); golden 2 (2 completed). The memory's "5 completed / 7 failed" counts the two golden completions.
- After the change, live runs should contribute 0 to the numerator: a found-nothing step now pauses, and only Stop fails, with a worded reason that has no "citations_required" code.
- Golden runs still fail (D-07), but their reason drops the code. **So the numerator falls by construction of the wording.**
- VERIFICATION should therefore report BOTH this query AND a behaviour-level count: runs whose engine gate fired and that ended `paused` or `completed` vs `failed`. Otherwise the drop could be read as a renaming. A second query for that is the `policy_applied` audit rows with the engine-ask policy name over the UAT window.

## Sources

### Primary (HIGH confidence, read or queried this session)
- `backend/app/services/harness_engine.py` (`:594-1725`, `:2040-2700`, `:3139-3396`): disposition, armed block, outcome arms, resume sweep.
- `backend/app/api/runs.py:635-1034`: re-drive and answer route.
- `backend/app/db/workflows.py:1601-1826, 2219-2507`: resumable, pending, pause/resume/finish/claim.
- `backend/app/services/harness/{human_input,grounding,validator_kinds,publish_service,reachability,phase_types,scope,phase_confidence,emit_cause}.py`.
- `backend/app/services/{run_producer,run_reconciler,run_lifecycle,ask_user_service,workflow_kickoff,scheduler_service,template_asset_service}.py`.
- `backend/app/api/{workflows,workflow_runs,panel}.py`.
- `frontend/src/components/{panel/PendingAskCard.tsx, workflows/StepEvidenceLine.tsx, workflows/soulData.ts, workflows/definitionOps.ts, workflows/GovernanceSection.tsx, workflows/library/RunModal.tsx, workflows/stepIdentityVocabulary.ts, layout/ChatLayout.tsx}`, `frontend/src/pages/WorkflowRunPage.tsx`.
- Local DB queries above, plus an AST branch count script (scratchpad).
- `docs/HOT-FILE-LEDGER.md` § harness_engine.py (the named seam), `check-hot-file-ledger.cjs --files` output.
- `.planning/phases/295-runs-that-don-t-dead-end/evidence/dmt-shape-prod-75922069.json` (coordinator, prod MCP read).
- `.planning/phases/288-…/288-04-SUMMARY.md:67` (F-2 evidence).

### Tertiary (LOW)
- The cause of the 2 stuck runs' cancellation (R3), the cause of F-2 (R10), the cause of "0 sources" over populated folders (A6).

## Metadata

**Confidence breakdown:**
- Engine/seam design: MEDIUM-HIGH. Every touched path was read; the design was not driven.
- DB findings: HIGH. Queries recorded verbatim.
- Judge fix sufficiency (SC#3): MEDIUM. It needs the live DMT drive.
- F-2 cause: LOW. Not reproducible from data.

**Research date:** 2026-10-20 · **Valid until:** 2026-11-03 (hot engine files move every phase; re-derive line numbers at plan time)
