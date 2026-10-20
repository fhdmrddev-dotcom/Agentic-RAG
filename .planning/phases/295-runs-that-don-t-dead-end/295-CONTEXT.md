# Phase 295: Runs That Don't Dead-End - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning
**Mode:** `--auto` (operator: "proceed autonomously end to end"). No questions were asked; every choice below is the recommended option, logged in `295-DISCUSSION-LOG.md`. Re-open any of them by editing this file before `/gsd:plan-phase 295`.

<domain>
## Phase Boundary

A workflow run does not dead-end:

- A KB step that finds nothing, or answers without citation markers, **pauses and asks** (search another folder / continue unsourced, visibly marked / stop) instead of failing the run (RUN-01).
- A report step with no template is **refused at save and publish**, naming the template (RUN-02).
- The publish judge stops failing a recorded-not-sent action for not sending (RUN-03).
- Every run **ends in a true state with a reason** (RUN-04).

Folded in, because they belong to the same "runs that don't run as intended" family:

- The person's answer to a human step reaches the next step (BUG-261020-01).
- One emit failure writes one chat message (BUG-261015-01).
- The judge blocks pause workflows (SEED-360 F-2).

**Not in scope:** branching or loops (SEED-295 stays parked; the 2026-10-20 measure found no failure caused by a route the engine cannot express). No new phase type, emitter or tool: the closed core stays 7 / 1 / 30.

</domain>

<decisions>
## Implementation Decisions

### RUN-01: the found-nothing pause

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

### BUG-261020-01: the person's answer reaches the next step

- **D-10.** `_prior_output_text` (`phase_types.py:173-190`) reads only `text`. A human step's `text` is the **question**; the answer sits under `answer` (`human_input.py:142-147, 188-192, 327`).
  - Fix at the reader: when a prior output carries `answer`, the next step sees the question AND the answer, labelled.
  - `human_input._latest_phase_text` (`:330-340`) gets the same treatment, or reuses the helper.
  - The stored `text` stays the question: the receipt and evidence page already read it.
  - Pinned by a test where the wrap step's input contains the stored answer, and driven live with the 289 Run A shape (KB → approve → wrap). The wrap must quote the real answer.
  - *Why:* 289 S5 proved completion only, never that the answer was used.
- **D-11.** The same reader carries D-04's unsourced note. That is one helper change in `phase_types.py` serving both. G-5: one helper, by construction.

### RUN-02: a missing template is refused before the run

Measured: `no_template_bound` is first known inside `_exec_llm_emit` at run time (`phase_types.py:1550-1561`). The template is not a phase field: it is `WorkflowDefinition.assets[kind="template"]`. Save does no lint (`workflows.py:1155-1161`). Publish stage 2 `lint_workflow` (`reachability.py:355`) is pure, sees `assets`, and has no template code. The citation wording comes from `validator_kinds.py:341-343` ("no field_map on output") evaluating the failure output's shape. Phase 281 makes the emit cause win in the message, but the raw string still lands in the `gate_failed` audit (`harness_engine.py:1186-1190`).

- **D-12 (a lint code, one home).** Add `no_template_bound` to `LINT_CODES` and to `lint_workflow`. It fires for any `llm_emit` / `render_template` step when the definition has no `assets` entry of kind `template`. Publish stage 2 then refuses with a message naming what is missing, in plain words ("<step> fills a template, and no template is attached to this workflow. Attach one."), never a citation code.
  - Extending the one lint stage follows the 214 precedent (`publish_service.py:177-191`).
  - The wording comes from `emit_cause.py`'s existing `KIND_NO_TEMPLATE` sentence, so it is one string in one place.
- **D-13 (save says it; run start refuses it).** SC#2 says "refused when saved or published". The roadmap's failure mode is "fires only at publish while drafts still fail at run time".
  - **Save:** a hard refusal at save would break draft autosave, which Phase 288 AUTH-03 relies on: an author legitimately adds the step before uploading the template. So save returns the same lint finding as a **named, visible warning** in the builder (the existing advisory `POST /validate` shape). It does not reject the write.
  - **Run start:** every path that starts a run (kickoff, and any draft or test run research finds) refuses **before phase 1** with the D-12 sentence.
  - This interpretation of SC#2 is recorded for the verifier: "refused" = publish + run start, "named at save" = warning. Re-open if the operator wants a hard save refusal.
- **D-14 (the gate never misreports an executor failure).** When a phase output carries an executor `failure` (the `_emit_failure_output` shape), the citations gate does not evaluate it. It records the executor's composed cause instead, in the message AND in the `gate_failed` audit's `validator_error`. "no field_map on output" must not appear for a no-template run. Test: plant a no-template definition past lint (direct DB) and assert neither the audit nor the chat contains `citations_required`.

### RUN-03: the judge is told what a step is designed to produce

Measured: the judge prompt (`JUDGE_RUBRIC_CORE`, `validator_kinds.py:135-157`) gets only the business requirement and author criteria. Phases are never described to it. It grades `_deliverable_output`, the last non-empty phase. For a workflow ending in `external_action`, that is the "NOT SENT — recorded only … This is a record of an intention, not a receipt" body (`phase_types.py:2140-2169`). The judge then scores "did the work" 0.

- **D-15 (teach, never loosen).** The rubric's criteria and threshold are unchanged for every workflow.
  - The one shared seam, `_judge_graded_text` (`validator_kinds.py:184-202`, used by the in-run and publish judges), gains a fixed server-written note.
  - The note is added **only when the graded output carries `recorded_intent`**. It says that this step is designed to record the action rather than perform it, that not sending is correct behaviour, and that the judge should grade whether the recorded action (destination, content) satisfies the requirement.
  - A workflow with no such step gets byte-identical judge input. That is pinned by a test comparing the text with and without, the "judge loosened for every workflow" failure mode.
- **D-16 (grade the content, not the envelope).** Research checks whether the judge should see the recorded body's content and the upstream deliverable rather than only the NOT-SENT envelope, and picks the smaller change that lets a correct DMT-shape run score above threshold. The 2026-08-26 *DMT Project Status Summary & Email* shape is the drive (SC#3): read its definition from production (MCP read, free), recreate it locally, publish it. Before the fix, re-run it to show it is still blocked. After the fix, publish it.
- **D-17 (SEED-360 F-2, the same lesson).** The judge also blocks the planted pause workflow most of the time. Before writing anything, research reproduces it and reads the judge's quoted evidence.
  - If the cause is the auto-answered human step (`_golden_run_mock`), the D-15 note gets a sibling, keyed on `_golden_run_mock`: "this answer was supplied automatically during validation".
  - If the cause is something else, it is recorded and left; it is not fixed by guesswork.

### RUN-04: every run ends true, with a reason

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

### Process and guardrails

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

### Post-research amendments (2026-10-20, auto): these SUPERSEDE the decisions they name

`295-RESEARCH.md` §"Refuted / adjusted" (R1-R13) measured where the decisions above were wrong. Each amendment is the research's recommendation, adopted in `--auto` mode. Where an original decision conflicts with an amendment, the amendment wins.

- **D-36 (R1, supersedes D-05's predicate).** "Locked" means `bool(phase.grounding_escalated)`: the author's stored bit, read directly and **not** through `grounding_cause`, which always reads `detected` on a KB step.
  - A locked step's pause has no continue choice, and a forged continue is refused (allow-list).
  - S3 plants the bit by direct DB write.
  - ⚠ **Operator decision owed (not made autonomously):** the UI cannot set this bit on a detected step. Sketch 142 (operator) says "NO switch exists" on a detected step. So, today, an author can lock a KB step only by escalating before adding a KB tool.
    - Adding a lock control on detected steps would reverse an operator design decision. It stays out of scope, recorded in `<deferred>` and in STATE.md's owed list.
    - Also owed: whether every KB step's canvas label "⛨ Must prove it" still reads true when the pause offers continue. The output is then marked unsourced in three places, never silently passed.
- **D-37 (R7, supersedes D-01's window bullet).** Engine asks pause **immediately** and durably with `timeout_seconds=None`: no deadline and no countdown, as the armed ask already behaves.
  - The run reads paused / "Waiting on <name>" from the first second.
  - `compose_waiting_on` and `PendingAskCard` must not say "the answer window has passed" for a prompt with no deadline. That sentence keys on a passed deadline, never on `paused` alone (UI-SPEC pitfall 1).
  - The roadmap's "the pause has no timeout" failure is read as "a wait with no surface or no way out". The wait is visible, Stop is always offered, and nothing is lost. This interpretation is recorded for the verifier.
- **D-38 (R13, refines D-02).**
  - 0 sources → search another folder (only when permitted, per D-39) + continue (unless locked) + stop.
  - 0 citation markers → continue (unless locked) + stop. Sources were found, so another folder is a dead option.
  - Outage → unchanged `fail_run` (D-06).
  - When the only remaining choice is stop, the step fails with its worded reason instead of pausing. A one-choice pause is a dead end with an extra click (UI-SPEC).
- **D-39 (R8, refines D-03).** The folders offered use **the same acceptance rule as `scope.resolve_run_scope_root`**:
  - A definition that declares a per-phase `folder_scope` → author-subtree members.
  - A definition without one → owner-visible folders.
  - An unbound definition (whole KB) → the option is not offered.
  - The list is built server-side; the client is fed only that list.
- **D-40 (open question 1, D-04 stash).** The produced-but-gate-failed output and the ask metadata are stashed on the active `workflow_phases.output` under `_awaiting_answer`. It survives a restart and the sweep can read it.
  - One new writer in `db/workflows.py` (G-5: one helper).
  - The 289 evidence and run-page readers are checked to ignore that key on an active row.
  - The `unsourced` field carries `continued_by` and `at`, per the UI-SPEC.
- **D-41 (R3, extends D-20).** The stuck runs came from `_resume_run` / the boot sweep, not the golden run. `_resume_run` must terminalize `workflow_runs` on escape (it covers both the boot sweep and `_wake`), and the resume shell must not be written `completed` when the run did not complete. The golden-run `finally` is still fixed (latent).
- **D-42 (R4, refines D-18 / BUG-12).** No historical "waiting" failure was an unanswered wait: all 7 were answered declines. What stays true and gets fixed:
  1. A waiting run reads paused (D-37).
  2. A decline's reason names the person and the step and **drops** the armed prompt sentence ("The run is waiting here…").
  - A decline ends `failed` (open question 3), with words. Stop on the found-nothing pause also ends `failed`, "stopped by <person>".
- **D-43 (R5, refines D-22).** The 20 reasonless runs: 15 are `test_214_argument_seams.py:212-215` fixtures that its teardown leaked; 5 are June producer escapes (F2).
  - The test's teardown is fixed in this phase, so it stops leaking.
  - Deleting the 15 local fixture rows is **not** done by the phase: it is a destructive local write, proposed to the operator.
  - Production was read on 2026-10-20 (MCP, read-only): **0 `active` runs and 0 failed runs without `run_failed`** (17 completed / 2 failed / 1 cancelled). D-22's defects are local-only.
- **D-44 (R6, shrinks D-14).** Since 281 the message is already the composed cause. D-14 is one expression (`validator_error` at `harness_engine.py:1189`) plus re-pinning `test_281_engine_cause_precedence.py:137` with a reason.
- **D-45 (R2, refines D-13).** A template-less `llm_emit` step is a designed shape: the Run modal uploads a template at launch.
  - Publish still refuses it (the golden run has no upload).
  - Run start refuses only when neither a definition asset nor a staged thread `template_input` exists (the Branch-2 predicate in `template_asset_service.py:209-226`).
  - `/validate` reports the code as **incomplete** (`_INCOMPLETE_CODES`), not as an error.
- **D-46 (R9, refines D-10).**
  - `_prior_output_text` gives the next step the question AND the answer, labelled.
  - `_latest_phase_text` **skips** human-step outputs (those carrying `answer`), so an external action's content and a later human step's draft come from the latest produced text, not the approval question.
  - The `unsourced` note goes into the prior-output text only, **never** into an external action's body (Pitfall 10; open question 4).
- **D-47 (R10, orders D-17).** D-10 lands first. Then re-drive 4 publishes of the 288 pause plant. Add a `_golden_run_mock` judge note only if the judge still cites the auto-answer; record the counts either way.
  - D-15 also renders `recorded_intent.inputs` in full for the judge. The NOT-SENT body truncates each value at 500 characters.
- **D-48 (R11, extends D-04's "never a silent pass").** After an author-declared post `ask_user` validator's Proceed, the engine citations gate still evaluates the produced output, so an unsourced output cannot pass unmarked. Drafts only today (publish refuses author `ask_user`). D-08's ordering gets its one pinning test.
- **D-49 (R12, refines D-19).** Engine asks no longer wait in-process, so a Stop on a paused run already ends `cancelled`. The remaining in-process waiters (author `ask_user` validators, and the `llm_human_input` window, where a cancel today completes the step with an empty answer) raise `CancelledError` on `kind == "cancel"`, following the shutdown precedent.
- **D-50 (research pitfalls, binding).**
  - Release the claim lease on pause, so an answer within 300 s re-drives.
  - The boot sweep must not re-run a paused run and ask again.
  - The prompt-row insert stops being best-effort for engine asks: a durable pause without its prompt row is a dead end.
  - D-23's suppression must never drop the only message.
- **D-51 (D-32 resolved).** The seam is taken first. The engine-ask disposition (`_resolve_failure_with_ask_user` and its helpers) moves **verbatim** into `backend/app/services/harness/engine_ask.py`, with the names re-exported from `harness_engine.py` so patch targets survive (Pitfall 8). The engine gate keeps `on_failure="fail_run"` in `grounding.py`, and a pure predicate identifies it (`test_185:77` stays green; no new author-writable disposition literal).
- **SC#5 baseline (D-09, from RESEARCH §G):** runs ending in a `citations_required` failure: live **13/227 (5.7%)**, golden **14/58 (24.1%)**, combined **27/285 (9.5%)**. Query in RESEARCH §G. Backend unit baseline at research: **70 failed / 8421 passed**. Re-derive it at execute; never quote it.

- **D-52 (G-8, plan count 7, justified) [informational].** The planner produced 7 plans in 4 waves, not the 5 D-34 suggested. Two things genuinely cannot share a worktree:
  1. Plan 01 is the pure-move seam. D-51 requires it to land alone with zero behaviour change, so a pure-move proof can see it.
  2. The frontend splits in two. `PendingAskCard.tsx` (1,052 L, FIRES) is plan 06, and the read-side change across ~33 files is plan 05. Each fits one executor's context budget only when separate.
  - The verifier, TDD RED drives, security review and migration discipline are not cut.

### Claude's Discretion
- Exact wording of the pause prompt and choices, within D-02's plain-language rule and the copy/vocabulary files the ledger names.
- Whether the per-run folder override lives on the phase row or in run inputs (D-03), provided it is recorded and never written to the definition.

### Folded bugs and seeds
- **BUG-261020-07..12**: this phase's requirement evidence (already folded at roadmap time).
- **BUG-261020-01**: folded (roadmap's "first candidate"), as D-10/D-11. Frontmatter updated.
- **BUG-261015-01**: folded. Its `re_open_trigger` fired (this phase names `phase_types.py` and `harness_engine.py`). See RUN-04 below.
- **SEED-360 F-2**: folded into RUN-03 (the judge-prompt question; its deferral said "for a phase that touches `publish_service.py`'s judge"). Seed `status_note` / `folded_into` updated.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement and evidence
- `.planning/ROADMAP.md` §"Phase 295: Runs That Don't Dead-End" — goal, 5 success criteria, failure modes, flags
- `.planning/REQUIREMENTS.md` — RUN-01..04
- `.planning/reported-bugs/BUG-261020-07-kb-step-that-finds-nothing-fails-the-whole-run.md` … `BUG-261020-12-waiting-for-approval-recorded-as-a-failed-run.md` — the six measured defects (counts, dates, workflows)
- `.planning/reported-bugs/human-step-answer-never-reaches-the-next-step.md` — BUG-261020-01 (folded)
- `.planning/reported-bugs/BUG-261015-01-emit-failure-writes-repeated-chat-messages-with-different-totals.md` — folded, D-23
- `C:/Users/fhdmr/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_workflow_blocking_measured_20261020.md` — the 2026-10-20 measurement (re-derive its queries for D-09)

### Prior decisions this phase builds on
- `.planning/phases/288-drafts-that-survive-pauses-that-publish/288-CONTEXT.md` — D-07/D-08 (gauntlet taught the pause, author ask_user refusal kept), D-09/D-11 (waiting-on sentence, a pause that outlives its timer)
- `.planning/phases/289-the-run-page-and-its-evidence/289-CONTEXT.md` — D-08 (one optional output field), D-11..D-13 (resume, no run left active), D-14a (evidence-line vocabulary), deferred SEED-360 F-2
- `.planning/seeds/SEED-137-armed-checkpoint-precedence-bypass.md` — gate precedence; read before touching `_resolve_failure_with_ask_user` or the attachment seam (D-08)
- `.planning/seeds/SEED-360-*.md` — F-2 (folded here), F-4 (not)
- `.planning/seeds/SEED-297-*.md` — the reconciler must not NULL a capped run's totals (D-21)
- `.planning/seeds/SEED-295-*.md` — branching stays parked; do not scope it in

### Hot files (read the section before planning — G-5)
- `docs/HOT-FILE-LEDGER.md` → `backend/app/services/harness_engine.py` (seam owed), `backend/app/services/harness/phase_types.py`, `backend/app/services/harness/publish_service.py`, `backend/app/services/harness/validator_kinds.py`, `backend/app/services/run_reconciler.py`, `frontend/src/components/panel/PendingAskCard.tsx`, `backend/app/services/run_producer.py`, `backend/app/services/harness/grounding.py`
- `docs/EXTENSION-CONTRACT.md` — closed core (no new phase type / emitter / tool)

### Design vocabulary
- `Skill("sketch-findings-agentic-rag")` — ask_user interrupt, run honesty, evidence line, graded-governance refusal copy ("must prove it"). Load it for the card and the unsourced mark (D-30).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `harness_engine._resolve_failure_with_ask_user` (`harness_engine.py:1387-1714`): the prompt row, SSE `ask_user_prompt`, `subscribe_for_response`, choice routing and the `validator_ask_user_approved` audit. It is the arm D-01/D-18 make durable.
- `PhaseOutcome("pause_run")` → `pause_run` (`harness_engine.py:1102-1121`, `:2444`) + `_redrive_paused_workflow_run` (`api/runs.py:1025`) + `ctx.resume_answered_tool_call_id`: the durable human-step pause to reuse (D-01).
- `_ask_user_choices_from_finding` (`harness_engine.py:1280-1312`): where server-built choices come from (D-02).
- `grounding.effective_phase` / `grounding_cause` (`grounding.py:1157-1189`, `:1347-1417`): `detected` vs `escalated` / `already-set` (D-05). The hard-coded `fail_run` is at `:1404-1413`.
- `validator_kinds` citations messages (`:293-343`): distinct 0-sources / 0-markers / outage / no-field_map strings (D-02, D-06, D-14).
- `scope.resolve_run_scope_root` (`scope.py:191-280`) + `phase_types.py:636-641`: the folder bound (D-03).
- `reachability.lint_workflow` / `LINT_CODES` (`reachability.py:131-139, 355`): the one lint stage (D-12). `emit_cause.KIND_NO_TEMPLATE` (`emit_cause.py:80, 121`): the sentence.
- `validator_kinds._judge_graded_text` (`:184-202`): the one judge seam (D-15). `recorded_intent` on external_action output (`phase_types.py:2603-2622`).
- `db/workflows.finish_run` (`:2351-2461`, first-terminal-wins), `write_audit` `run_failed` (`:360`).
- `PendingAskCard.tsx` (answer layout, paused-card answer control from 289), `runVocabulary.ts` (step words), `WorkflowRunPage.readBand` (`:377-418`).

### Established Patterns
- One optional output field, no new type (289 D-08): `unsourced` follows `confidence`.
- Server builds the sentence; the client renders it (288 D-09).
- Allow-list on approvals: a decline or forgery is never a proceed (T-185-04-01).
- First-terminal-wins on run status; the reconciler finalises from evidence and never hides.
- Golden run (`publish_service._drive_golden_run`) is a draft run with no producer: anything relying on F2 does not run there.

### Integration Points
- `ctx` → `_prior_output_text` (`phase_types.py:173-190`): BUG-261020-01 answer + unsourced note (D-10/D-11).
- Publish stages 2 (lint) and 4 (judge); save path `api/workflows.py:1171-1362` (warning only, D-13); run start `workflow_kickoff.py` (refusal, D-13).
- Evidence read (`api/workflow_runs.py`) and receipt/export: carry `unsourced` and the "no reason was recorded" wording (D-04, D-22).
- `run_reconciler.py` boot sweep: the new `workflow_runs` sweep (D-21).

</code_context>

<specifics>
## Specific Ideas

- SC#3's drive is the real 2026-08-26 *DMT Project Status Summary & Email* shape (blocked 4 times, 2 in production): read it from prod via MCP and recreate it locally.
- SC#4 names concrete rows: *200-Word Essay Writer* (2026-09-12) and *Knowledge Base Library Structure Summary* (2026-09-19), the stuck runs; and 20 reasonless failed runs (5 in 2026-06, 15 in 2026-08). Record each one's before/after.
- The 289 Run A plant (KB → approve → wrap) is the BUG-261020-01 drive: the wrap must quote the stored answer.

</specifics>

<deferred>
## Deferred Ideas

- **Branching / loops (SEED-295)**: parked; its evidence gate is still unmet.
- **SEED-360 F-4**: the `auto_answered` note unmounts with the gauntlet; it needs a decision on where a post-publish note lives.
- **A hard save refusal for a missing template**: rejected for now (D-13) because it would break draft autosave. Re-open if the operator wants it.
- **A new `waiting` run status**: not needed (D-18); `paused` plus the waiting tone carries it.
- **Backfilling reasons for historical failed runs**: rejected (D-22); no invented reasons.
- **An author lock control on detected KB steps (D-36)**: an operator decision. It would reverse sketch 142's "no switch on a detected step". Until then, "locked" means the stored `grounding_escalated` bit.
- **Deleting the 15 leaked `test_214` fixture rows from the local DB (D-43)**: a destructive local write, proposed to the operator and not done by the phase.
- **Stating "unsourced" to an external action's recipient**: no (D-46). The mark lives on the step, the evidence page and the receipt.

### Reviewed bugs (not folded)
- `BUG-261020-02` (evidence page shows a later step restating a withheld document): privacy / run-evidence, not dead-ends. A `re_open_trigger` was written.
- `BUG-260828-05` (send receipt names the SMTP host, not the recipient): RUN-03 changes what the judge is told, not what the receipt records. A `re_open_trigger` was written.
- `BUG-260610-01` (run nav timer, duplicate avatar): live chat stream, unchanged.

### Reviewed Todos (not folded)
- `todos/pending/spike-nl-workflow-authoring.md` (score 0.6, keyword match only): NL authoring, already routed to Phase 152 (`resolves_phase: 152`). This is a phase-scope guardrail override of the auto-fold rule, logged.

</deferred>

---

*Phase: 295-runs-that-don-t-dead-end*
*Context gathered: 2026-10-20*
