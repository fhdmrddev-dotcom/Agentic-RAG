---
gsd_state_version: 1.0
milestone: "v3.7"
milestone_name: "Workflow Product Completion"
status: in-progress
last_updated: 2026-08-16T00:00:00.000Z
last_activity: "2026-08-10 — **v3.7 Workflow Product Completion OPENED** (Phases 192-198, 13 requirements; 191 reserved). Prior: 2026-08-09 — **v3.6 Visual / No-Code Workflow Studio CLOSED and TAGGED.** 13 phases (CORE 181-189 + STRETCH 190 + inserts 184.1/188.1/188.2), 151 plans, 1,064 commits over 18 days, migrations 114-118. Closed on a FRESH audit re-run at HEAD `bdd3e54b` (`41ae2618`) after the on-disk one was found to predate Phases 189 and 190 entirely. **CORE closed 19/21 satisfied with ZERO unsatisfied — every CORE requirement wired in shipped source, confirmed file:line.** The one unsatisfied requirement is STRETCH **CONN-02**: only 1 of 3 connectors is drivable from a workflow, and Slack works by coincidence. STRETCH 191 deferred, never built."
stopped_at: "2026-08-16 — **Phase 194 EXECUTING — 11 of 13 plans complete and merged; TWO PLANS BLOCKED ON AN OPERATOR MEASUREMENT, and the phase is deliberately NOT verified and NOT marked complete.** Merged: 194-02 (mig 119 authored), 194-03 (panel Stop mount), 194-04 (the frontend `cancelled` phase-status union), 194-06 (`db/workflows.py` cancel writers), 194-08 (composer+tray Stop pins), 194-09 (`_cancel_run_internals` cross-heal, exporting `cancel_workflow_run_internals`), 194-10 (engine cancel arm), 194-11 (the DELETE dual-id fallback), 194-12 (mig 119 APPLIED to the live local DB), 194-13 (the five-row heal + 4 new ledger rows). ⛔ **194-01 is 2/3 — its Task 2 `checkpoint:human-verify` (the duplicate-assistant-icon root cause) needs a LIVE run and the Chrome extension was not connected; Task 3 was executed BEFORE it under a recorded orchestrator deviation (`194-01-DEVIATION.md`), because Task 3 has zero dependency on Task 2. ⛔ 194-05 and 194-07 are UNSTARTED — both read `194-MEASUREMENTS.md`, which Task 2 owes.** ⚠ **MIGRATION 119 IS APPLIED TO THE LIVE LOCAL DB** (`33eeb270`) by the orchestrator at the operator's explicit instruction, via the SQL-editor path (the file's own statements executed against 127.0.0.1:54322, its BEGIN/COMMIT governing) — **never `db push`/`db reset`**. Verified LITERAL BY LITERAL, not by counting: all six shipped literals individually present, `ADDED=['cancelled']`, `REMOVED=[]`, 496 rows byte-identical. `full-schema.sql` regenerated (no `--reset`), diff exactly ONE line. `test_migration_119.py` 3 skipped → **3 passed**, which discharges 194-02's own caveat that its F-8 green proved little while the OLD constraint also refused the display sentence. ⚠ **THE FIVE-ROW HEAL IS DONE AND THE PLAN'S 'EXACTLY FOUR ROWS' WAS WRONG — corrected before the write, not after.** The 3-vs-2 `active`-phase discrepancy RESOLVED IN D-17's FAVOUR: the two orphans are `961c290d`/`9e6acf54` (both `confirm`, under already-`failed` runs); the third, `0e0cf57c` (`summarize`), is the interrupted phase OF stuck run `4b0feda7` — so healing that run also terminalizes it, which is **SC#3 working on live data** and the best evidence in the phase. Live DB now: `workflow_runs` active 2 → **cancelled 2**; `workflow_phases` active 3 → **cancelled 3**, total still 496; thread anchors 2 → **0**; `runs` histogram byte-identical. ⚠ **THE HTTP ROUTE WAS NOT DRIVEN AND THE RECEIPT SAYS SO PER ROW** — `DELETE /runs/{id}` needs a Supabase JWT that could not be obtained; the executor REFUSED to forge or weaken auth (verified live at `403 Not authenticated`, wrote nothing) and healed via `cancel_workflow_run_internals`, which is what the route's no-live-producer arm calls. **The two `204`s the plan's acceptance criteria ask for DO NOT EXIST AND ARE NOT CLAIMED.** Read-only forward-resolution confirmed `producer_id IS NULL` on both ids, so the arm that would have run is the arm whose writer was called. ⚠ **NINE FOR NINE: EVERY PLAN THAT PLANTED ITS FENCES FOUND AT LEAST ONE THAT COULD NOT FIRE — none caught by reading.** 194-02's own docstring tripped its grep twice; 194-03's FOUR REQUIRED PLANTS ALL RED ON ONE CLAUSE (a fifth, unplanned, was needed to prove clause (b) non-redundant) and its empty-sweep control left clauses GREEN with a third of the union invisible; 194-06 found a fence VACUOUS ON ITS RED RUN, passing on a tree where neither writer existed because a nine-phase-old shipped READ carried the predicate byte-identically (**a count-only read of a RED run would have shipped it** — read WHICH cases failed); 194-08's plant C could not fire in TWO independent ways; 194-10 shipped SIX plants where its plan named two, FOUR load-bearing, because `assert` SHORT-CIRCUITS; 194-11 found a clause that reds under NO realistic cross-user world; **194-12 needed ELEVEN plants and found one that produces a SKIP rather than a RED — it would have shipped with no RED observation while the receipt claimed one**; and the orchestrator's own migration pre-flight guard fired on the word UPDATE inside mig 119's COMMENT block. ⚠ **194-12 also found F-7's plant is IMPOSSIBLE on a populated DB** (Postgres refuses the constraint outright, `violated by some row`) — a real defence the fence does not provide, **which exists only where live rows exist and therefore vanishes on a greenfield DB restored from `full-schema.sql`**; re-driven with `NOT VALID` to reproduce the greenfield case. ⚠ **7 OF 7 WORKTREES FORKED FROM THE WRONG BASE**, every one returning `3781a3fe`, one HEAD on a 'Merge develop into master' commit — all self-corrected because the base assertion runs before anything is written. This is now DEFAULT behaviour here, not a Phase-192 curiosity. ⚠ **The by-name unit comparison needed its PARSER fixed before it could be believed, in TWO spellings**: 194-06 hit truncated `- ImportE...` suffixes (8 PHANTOM regressions AND 8 phantom disappearances, same names both sides) and 194-09 hit an interleaved Windows path glued onto a node id (one test reading as NEW and DISAPPEARED at once). Final: **62/62 set-identical, 0 new, 0 disappeared.** ⚠ **The count gate does NOT execute `src/components/chat`** — `TARGETS` covers `src/components/workflows` + four named Builder files, so 194-08's two new suites are invisible to it (total 3954 before and after); run explicitly, **16 passed**. Deferred with a trigger rather than widening TARGETS mid-phase. ⚠ **A count-gate run VIOLATED with `failed 0` and two `[missing-file]` entries, then passed on re-run** — cap-2 non-determinism in a NEW spelling: it can present as MISSING FILES rather than as failures, and `failed 0` on a violated gate reads like a pass at a glance. ⚠ **CONTEXT D-01 is FALSE and corrected beside it: `RunCard.tsx` and `WorkspacePanel.tsx` do not 'occur only inside other rows prose' in `CLAUDE.md` — `grep -o` returns 0 for both; neither appears AT ALL.** ⚠ **RESEARCH's UAT roster command is subtly WRONG** — its third column is `ms[-1]`, dict-insertion-order-last rather than NEWEST, stale on 4 of 8 providers; transcribing it would have scored the board on `o1` and `moonshot-v1-8k` instead of `gpt-5.6-sol` and `kimi-k2.6` (the SEED-040/SEED-135 failure). ⚠ **FOUR MORE HOT FILES WERE ABSENT FROM THE LEDGER and now have rows** — `harness_engine.py` **45/16/2536** (16 phases, G-5 never once fired), `api/runs.py` **33/16/1376** (`grep` → 0 occurrences), `run_lifecycle.py` 4/3/437, `WorkspacePanel.tsx` 14/9/580; `db/workflows.py` re-derived **32/17/1447 → 34/18/1582**. ⚠ **`RunCard.tsx` got NO row: `git log 743965a1..HEAD` is EMPTY — this phase never touched it**, so its triple `20/8/550` is carried in the heal receipt with 194-05/194-07 named as owing it. ⚠ **The ledger cells 194-13 wrote WILL go stale when 194-05 and 194-07 land, and the cells SAY SO** — 194-05's `files_modified` includes `CLAUDE.md`. **NO GUARDRAIL OVERRIDE FOR PHASE 194 — G-5 fired on six files and every one was honoured BY CONSTRUCTION with a measured test; that absence is a measurement.** Gates at this checkpoint: `tsc -p tsconfig.app.json` **33** unmoved all phase · count gate `OK` **3954** · failed **0** · 75/75 · backend cancel path **110 passed, 0 skipped**. **NEXT = drive the 194-01 Task 2 console dump on a LIVE streaming harness run (`await import('/src/stores/streamsStore.ts')` — the plan's bare `useStreamsStore` is not a global and throws), then `/gsd:execute-phase 194` to run 194-05 + 194-07, then verification.** Prior: 2026-08-16 — **Phase 194 PLANNED (`67e87b88`) — 13 plans in 8 waves; plan-checker VERIFICATION PASSED on the FIRST iteration, zero blockers, four warnings (one fixed, one judged correct-as-is, two close-out items).** ⚠ **RESEARCH REFUTED EIGHT CONTEXT.md CLAIMS BEFORE ONE LINE WAS PLANNED, and three of them changed what ships — recorded as operator rulings D-16/D-17/D-18 with the originals STRUCK THROUGH, never overwritten.** **D-16 — mount 4 (the Workflows-page library-row Stop) is DESCOPED because its premise was measured FALSE:** `LibraryRow` carries no run field, all three feeds are DEFINITION feeds, and a grep across the whole `library/` directory returns ONE hit which is prose inside a docblock — so *'using a run id the library already has'* named an id that does not exist on the row or on the wire; delivering it needs a new backend read + a new row field + a poll, i.e. a genuinely SECOND concern on `WorkflowsPage.tsx`, whose ledger row already owes a G-5 refactor recommendation FIRST (`34/12/1176`). ⚠ **SC#1 is NOT weakened, and that is measured rather than argued: mount 3 (`ActiveRunsTray`) ALREADY ships per-run Stop + Stop-all, which IS the 'stoppable from outside its thread without navigating in' property mount 4 was reached for.** Trigger: *the first phase that puts any live-run state on the library row*. **D-17 — the heal covers FOUR rows, not two:** beyond D-12's two stuck `workflow_runs`, research found **two orphan `workflow_phases` rows stuck `active` under runs that already FAILED** (both `confirm` phases, 2026-07-18) — SC#3's exact failure mode already sitting in the live data. ⚠ One of the two run rows is `is_golden_run = True` (permanently unresumable since Phase 190's A4 gate); if it needs distinguishing that is an audit note, **NEVER a new status literal**. **D-18 — the banner fix ships and crosses PANEL-09 with the cost STATED:** the mechanism is `hasAnyTools = tool_calls.length > 0` and a harness run writes NO `tool_calls`, so `MessageItem.tsx:635` holds the pre-tools banner for the entire run; the re-render is **per-PHASE, not per-token**, so the cost PANEL-09 was protecting against is not the cost incurred. ⚠ **THE SINGLE MOST IMPORTANT FINDING, which nobody had named: `WorkflowLock.runId` CARRIES TWO ID TYPES** — two of its four write sites store a `workflow_runs.id`, two a producer `runs.run_id`, its own JSDoc asserts only the first, `DELETE /runs/{id}` accepts only the second, and `cancelRun` **SWALLOWS 404** ⇒ a Stop wired to the lock **silently succeeds while doing nothing**, the exact dishonesty SC#2 forbids. ⚠ **`WorkspacePanel.tsx:161-165` already recorded this in Phase 188 and it was NOT carried forward** — a measurement that lives only in one file's comment is invisible to the next phase. The fix already ships TWICE (`continue_run`, `ask_user_response`); `DELETE` is the only route on that prefix without it. ⚠ **D-09/D-10's whole backend fix is ALREADY WRITTEN, in the wrong file** — `delete_workflow_cascade` (`api/workflows.py:1494-1518`) already composes `_cancel_run_internals` + `finish_run(wf_id,'cancelled')`; 194's work is largely MOVING that composition into the shared writer so all three callers get it. ⚠ **THE PLANNER FOUND A GAP NEITHER RESEARCH NOR PATTERNS MAPPED, and SC#3 fails without it:** the panel spine reads a DIFFERENT, CLOSED union — `Phase['status']` (`types/index.ts:1035-1043`, eight members, **no `cancelled`**) fed by a TOTAL `phaseStatusFromDb` that resolves anything unrecognised to `unknown` — **so a stopped run's interrupted phase would render 'Unknown' on the spine.** Fail-closed, so not a lie, but not D-13's *'reads stopped, not failed'* and a guaranteed G-4 failure ⇒ plan `194-04`. **Also corrected: a FOURTH shipped mark for the cancelled concept research missed (`⊘ Cancelled`, `WorkflowRunPage.tsx:299`), and `ActiveRunsTray.test.tsx` DOES NOT EXIST** (VALIDATION marked V-08 *extend*; measured, the tray has no dedicated suite anywhere — it is a Wave-0 CREATE). ⚠ **BUG-260815-07's *'permanent delete blocker'* claim measured FALSE** (the cascade already terminalizes them; neither definition is `is_system_global`) — recorded, and it does not remove the reason to heal the rows. **Definitively answered: do NOT add `is_app_shutting_down()` to Step 3b** (three independent proofs; resumability is already forfeit there) **while the F2 terminalize MUST keep its gate** (096-09, Phase 096 UAT Test 2) — both arms are fenced. **12 fences, each naming the REAL production-source plant it must be driven RED against; F-4/F-6/F-10 carry TWO plants each and F-1 additionally needs an empty-sweep RED ⇒ 24 required RED observations, each with a post-revert md5** — because this project shipped FIVE inert fences in 193.2, four in 193.1, three in 192.1 and five in 190, every one caught by planting and none by reading. **All 20 VALIDATION rows V-01..V-20 covered and cited; RUN-01 in all 13 plans.** ⚠ **G-5 FIRES ON THREE FILES — `RunCard.tsx` (8 phases), `WorkspacePanel.tsx` (8), `db/workflows.py` (17) — honoured BY CONSTRUCTION with a measured test rather than an argument, each plan carrying a STOP condition if the measurement disagrees. A G-5 override was OFFERED AND DECLINED for the FOURTH CONSECUTIVE PHASE; this file records NO guardrail override for Phase 194, and that absence is a measurement.** ⚠ **D-01's claim that both G-5 filenames *'occur only inside other rows prose'* is FALSE — `grep -o` returns 0 for both; neither filename appears in `CLAUDE.md` AT ALL.** Waves 7 and 8 are ⛔ **SERIALIZED** (rule 4): the mig-119 apply takes an ACCESS EXCLUSIVE lock on `workflow_phases`, and the four-row heal mutates real, irreplaceable rows — both `autonomous: false`. **NEXT = `/gsd:execute-phase 194`.** Prior: 2026-08-16 — **Phase 194 CONTEXT GATHERED (`99b6a5b4`) — 15 decisions locked in `194-CONTEXT.md`, and the phase was RE-SCOPED against BOTH planning artifacts that describe it.** ⚠ **The ROADMAP's scope flag and STATE.md's own correction of it are BOTH half wrong, and both are recorded rather than overwritten.** ROADMAP:494-495 says *'mostly UI over an endpoint that already exists'*; the pre-discuss finding below says *'194 is a NEW runtime path'*. Measured at HEAD: a harness run is driven by **the same producer task as a Deep run**, so `DELETE /runs/{id}` (`api/runs.py:1155`) already cancels it, and the F2 block (`run_producer.py:254-277`) already calls `finish_run(workflow_run_id, 'cancelled')` — whose own comment names it the *'v2.8-audit cancel-honesty fix'*. `workflow_runs.status` has admitted `cancelled` since mig 057. **The finding's four individual measurements are each CORRECT; only its INFERENCE is wrong** — it searched the workflow-side modules for a cancel verb and concluded none exists, when the cancel lives on the `runs` side by design. ⇒ 194 is not *'build cancel'* but *'is the shipped cancel REACHABLE, HONEST and SAFE from the workflow run surface?'*, and **three gaps were measured, one per success criterion**: **G-A/SC#1** `WorkspacePanel.tsx` has **no Stop control of any kind**, and every shipped Stop keys off a streaming assistant message's `runId` that `BUG-260815-04` may defeat; **G-B/SC#2** `_cancel_run_internals` Step 3b heals **only** the `runs` row — `workflow_runs` stays `active`, the anchor is never cleared, the thread wedges, and with `WORKER_COUNT=2` + a per-process `RUN_TASKS` that is roughly **half of all missed Stops**, not an edge case (it is measurably the two rows stuck `active` since **2026-06-14** and **2026-08-01**); **G-C/SC#3** `finish_run` writes the run row + anchor only, so the interrupted `workflow_phases` row stays `active` forever — and `workflow_phases_status_check` (mig 115) admits **no `cancelled` literal**. **Decisions: migration `119` widens that CHECK 6 → 7 in the mig-115 shape** (reusing `failed`/`skipped` was offered and REJECTED as dishonest — the phase did not fail and was not skipped, it ran and was interrupted); **four Stop mounts, ONE mechanism** (panel spine PRIMARY · composer · ActiveRunsTray · library row), no second cancel path; **the zombie arm is extended across to `workflow_runs` AND the two historically stuck rows are healed**, with their ids + before/after captured because *a data repair with no receipt is indistinguishable from a claim*; a stopped run **keeps its completed phases, marks the interrupted one, and is TERMINAL** (resumability rejected — `workflow_runs.status` already carries a distinct `paused`). ⚠ **G-5 fires on `RunCard.tsx` (20 commits) and `WorkspacePanel.tsx` (13), both ABSENT from the ledger; honoured BY CONSTRUCTION and writing the two rows is a PHASE DELIVERABLE (D-01/D-02). A G-5 override was OFFERED AND DECLINED for the FOURTH consecutive phase — this file records NO guardrail override for 194, and that absence is a measurement.** **Bug routing (frontmatter UPDATED, not just decided): `BUG-260815-07` FOLDED — reproducible half only, the non-reproducible delete failure stays open; `BUG-260815-04` FOLDED — ⚠ its `\"Starting workflow…\"` string is DELIBERATE and byte-pinned, the defect is that the surface never ADVANCES; `BUG-260808-02` FOLDED with a scope fence — ⚠ its OWN trigger fired, since it bundles SEED-140 which IS RUN-01; `BUG-260815-03` ⚠ FOLDED IN THE FIRST PASS AND UN-FOLDED ON MEASUREMENT → DEFERRED to 195** with the trigger *'the first phase that renders a completed workflow run's phases outside the chat thread'* — 194 makes a LIVE run stoppable from the library row, but the complaint was about a COMPLETED run's history, which this phase structurally cannot close, and marking it `folded_into: 194` would have put a bug in the *claimed* state against a phase that cannot address it. ⚠ **All four reports previously read `folded_into: null` while STATE.md recorded the routing — a routing that lives only in prose is invisible to every audit that reads frontmatter.** **NEXT = `/gsd:plan-phase 194`.** Prior: 2026-08-15 — **Phase 193.2 ✅ CLOSED — 10 of 10 plans, all four success criteria DRIVEN by the operator, and `AUTH-03` SATISFIED END TO END for the first time.** The evidence is the row no test could stand in for (`193.2-UAT.md` U1): run **`b021c7b0` COMPLETED**, definition `93a86e21` / slug `northwind-qbr-fa65a43c`, all five phases, **zero gate failures** — `/Northwind-QBR-Template.docx` at **39,698 B** against a 37,424 B template, **10 of 10 fields filled** each with a real `source_doc`, **0** residual `{{ }}`, **0** literal `None`, **branding verified against an operator screenshot** (navy band, Georgia title, amber account-health block, teal headings 1-6, grey summary panel, navy footer rule), and **all eight planted facts grounded** (68% utilisation · 412 of 605 seats · INC-4471 · a 6h12m outage on 12 Aug · £284,000 ARR · term to 31 Jan 2027 · Freight Analytics ~£62,000 · AMBER). **A template attached AT AUTHORING TIME and a real run that FILLS THAT SAME TEMPLATE — both halves observed in one sitting**, which is exactly what 193.1 declined to tick on unit evidence alone. ⚠ **The 193.1 ATTRIBUTION REGRESSION DID NOT RECUR — Marcus Feld is named TWICE in the rendered document**, a second data point in the right direction, so the *'a second sighting earns a seed'* trigger is NOT fired and no seed is owed. **M1 the requirement arrived pre-filled, durable and NOT an echo of describe** (so 193.2-07's anti-echo predicate EARNED the mark rather than defaulting to it), `business_requirement_seeded_by_ai: true`. **M2 published with the canvas UNTOUCHED.** **M3 found without searching at rendered position 4 of 112 — the predicted index `starters.length` held EXACTLY — and the post-publish Run CTA appeared and NAMED the workflow**; recency is proved against a near-identical OLDER row (the new QBR at 14:17 above the old Q3 at 02:07), not by alphabetical luck. ⏸ **CLOSED WITH TWO UAT ROWS NOT DRIVEN, BY DECISION: U5** (the composer Harness picker — the one user-visible consequence of the sort that lands OUTSIDE the library, and nobody has looked at it; thirty seconds) **and U2** (the rendered interactive refusal — ⚠ **it could NOT be driven: no interactive step ever appeared, so the surface never rendered, and *the defect not occurring* is NOT the same as *its message reading well*. The rewritten two-arm copy has still never been read by a person**). ⚠ **ONE HONESTY CAVEAT ON M1: the operator confirmed *'I think all pass'* broadly and did NOT specifically confirm the VISIBLE mark — the DURABLE half is measured, the VISIBLE half rests on a general confirmation, and it is NOT recorded as a specifically-observed mark.** ⚠ **THREE PUBLISH ATTEMPTS WERE BLOCKED FIRST AND NONE WAS A PRODUCT DEFECT ON THE PUBLISH PATH**: the OpenAI credit balance was **exhausted** (`429 insufficient_quota`, confirmed by a live `embeddings.create`), and since every document is embedded with `text-embedding-3-small` **every search must embed its query** — retrieval returned 0 sources, `citations_required` failed 3× per run, and publish **correctly refused**. All three rows read `blocked_stage: structural_gate` (14:02:21 / 14:07:42 / 14:10:29), read through the **C-7 accessor** `metadata #>> '{}'`. Ruled out by measurement: 5 docs / 18 chunks / 0 null embeddings / matching `org_id`. **Four bugs and three seeds were filed from that session** — `BUG-260815-05` (blocking: a provider outage is reported as *'nothing was retrieved (0 sources)'*), `BUG-260815-06` (major: the structural-gate refusal names a stage, not a cause — ⚠ **the same failure class this phase fixed for the interactive gate, surviving on the gate next door**), `BUG-260815-07` (major, **NOT reproducible**, stays open; two runs stuck `active` since 2026-08-01 and 2026-06-14 are a permanent delete blocker), `BUG-260815-08` (minor, Workflows header — **G-2 fires, sketch it with `SEED-155`'s card density**), **`SEED-159` — trigger FIRED and its PREDICTION WAS WRONG** (not a silent blank but a verbose internal disclaimer, *'Not explicitly stated in the KB.'*, rendered in the front-page header of a document footed *'Commercial in confidence'* — the model behaved correctly and the real defect is that **a deliverable has no register distinct from an internal answer**), `SEED-165` (52 out-of-gate backend failures, triaged 34 stale / 18 undiagnosed), `SEED-166` (settings/operator/admin IA). **Code review: 0 Critical / 0 Warning / 5 Info**, all six Warnings fixed post-review. **G-7 CLEAR** — 10 plans, 0 gap-closure rounds. Gates at close: count gate **`OK` · 3918 · failed 0 · 75/75** · backend workflow suites **210 / 0** · full `tests/unit` **62 failed / 2221 passed** (the 62 is the baseline rot set) · `tsc -p tsconfig.app.json` **33**, unmoved all phase. NEXT = drive **U5** when someone next opens the composer, then `/gsd:discuss-phase 194`. *(Superseded, kept for the record: this entry previously read 'EXECUTED … ALL FIVE UAT ROWS ARE OWED … NEXT = drive U1'. U1 was driven hours later.)* Gates re-run at HEAD by `193.2-10` against `193.2-BASELINE.md`: backend `tests/unit` **62 failed / 2154 passed** (failures IDENTICAL to baseline — the SEED-056 rot set; passes grew from 2092) · six backend workflow suites **110 / 0** (was 81) · five frontend workflow suites **359 / 0** (was 337) · count gate **`count gate OK` · total 3918 · failed 0 · pinned 3868 · 75/75** (was 3892) · `tsc -p tsconfig.app.json` **33, unmoved across all ten plans**. **NO NEW FAILURE.** ⚠ **NO GUARDRAIL OVERRIDE FOR PHASE 193.2 — offered and declined for the THIRD consecutive phase (193, 193.1, 193.2); that absence is a measurement.** G-5 fired on SEVEN files, all honoured by construction. ⚠ **FIVE `CLAUDE.md` ledger rows were owed, not the three D-03 planned** — `db/workflows.py` **31/17/1405** (the SECOND-HOTTEST BACKEND FILE IN THE TREE, absent from the table for seventeen phases), `publish_service.py` **17/7/1158**, `workflow_authoring.py` **11/6/540**, `models/harness.py` **17/16/611**, and `builderStore.ts` **11/5/837**, which appeared in NO prior artifact of this phase at all. ⚠ **THE MEASURED RESULT, and the D-08 rule binds every word of it: `business_requirement` 5/5 on all four arms (pre-fix 0/N); `llm_human_input` 0/5 on all four (pre-fix 2/2 with a template); the SC#4 `render_template` control 5/5 LIKE-FOR-LIKE and it DID NOT FALL; `external_action` displacement 0/5. A MEASURED REDUCTION, NEVER AN ABSENCE — the publish gate STAYS.** ⚠ **D-10's escape hatch is recorded NOT TRIGGERED: neither candidate fact was false — BOTH are true. The false premise was the unstated third one, that a 400 was ever received.** Prior: **Phase 193.2 PLANNED (`2ddac519`) — 10 plans in 6 waves; plan-checker VERIFICATION PASSED first iteration, zero blockers. NEXT = /gsd:execute-phase 193.2.** Research REFUTED D-10 premise before any code: harness_audit measured 1 publish_attempted / 1 publish_succeeded / 0 publish_blocked, so the publish endpoint never refused anything and the refusal came from an already-greyed control — rewriting the string IS the fix, Wave 1 is confirm-and-record. A shipped green fence (test_no_feed_orders_by_updated_at) FORBIDS D-15/D-16 and is rewritten in place, never deleted, driven RED against the pre-change source. FOUR ledger rows owed not three — a seventh hot file, backend/app/models/harness.py (16/15/578), was absent from the table. BUG-260815-02 arithmetic was over the wrong feed: rendered 17 of 109 (scope=mine), landing at 4 of 109 after the sort, not 1. The post-publish Run CTA has had ZERO automated coverage since it shipped. NO guardrail override recorded — third consecutive phase to decline one. Prior: CONTEXT GATHERED (`4d1d9374`). 26 decisions locked in `193.2-CONTEXT.md`. ⚠ Two scouting findings reshaped the phase and both are recorded as DELIVERABLES rather than assumptions: (1) `/validate` ALREADY mints an `interactive_phase` verdict, it is registered route-assigned + incomplete, it ALREADY greys the Publish control with the server message verbatim, and there is a PINNED test — so the operator could not have clicked Publish and got a 400, and Wave 1 must establish which of those two facts is false on the live path (D-10); (2) the post-publish Run CTA ALREADY names the workflow and offers Run (`WorkflowsPage.tsx:897-908`), so 'the product never told me the name' is at least partly already closed and the operator was still lost (D-19). ⚠ **G-5 fires on SIX files and THREE are ABSENT from the `CLAUDE.md` hot-file ledger** — `db/workflows.py` **30 commits / 16 phases**, `publish_service.py` 16/6, `workflow_authoring.py` 9/5 — the same invisibility failure `WorkflowsPage.tsx` had for 10 phases. Honoured by construction; writing the three missing ledger rows is a phase deliverable (D-01/D-03). ⚠ **A G-5 override was OFFERED AND DECLINED for the THIRD consecutive phase, so this file records NO guardrail override for 193.2 — that absence is a measurement.** ⚠ `WorkflowsPage.tsx`'s ledger cell measured STALE for the 4th time (`33/12/1160` → **34/12/1176**). Prior: **Phase 193.1 ✅ CLOSED, AUTH-03 satisfied on a real end-to-end run.** 193.2 bundles three items the operator hit in ONE sitting on 193.1s own headline path: SEED-163 (the AI leaves business_requirement blank), BUG-260815-01 (BLOCKING — the draft grows an llm_human_input step the publish gate refuses; caused by 193.1s OWN D-26 fix, measured 2 for 2), BUG-260815-02 (BLOCKING — a just-published workflow is unfindable; ORDER BY name at three call sites, no recency anywhere, position 129 of 146). ⚠ **I routed all three to 197 and the operator OVERRULED it; the original reasoning is left visible rather than overwritten.** They are one phase because they share one root: authoring makes decisions the author is never shown and does not know what publish requires. ⚠ G-2 fires on the library half and must NOT absorb the sort bug. ⚠ G-1 does not fire but a THIRD 193.x would trip it. Also filed and routed to 194: BUG-260815-03 (run history unreachable from canvas) and BUG-260815-04 (chat stuck on Starting workflow — the string is DELIBERATE and pinned, do not reword). ⚠ Phase 193 still owes U1/U2; 193.1 closed with U2/U3/U4 owed by decision."
resume_file: .planning/phases/194-stop-a-running-workflow/194-CONTEXT.md
---

# Project State

> ⚠ **This file was RESET at the v3.6 close (2026-08-09).** The previous STATE.md had ballooned to
> **562 KB** and its YAML frontmatter was corrupted — unquoted multi-line strings had been parsed
> as top-level keys (`recorded:`, `carrying:`, `change:`, `measured:`, `inherited:`, `verbatim:` …),
> which is exactly the damage the GSD SDK `state.*` verbs did five times during Phase 190 alone
> while reporting success. **Nothing was deleted:** the full 562 KB file is archived verbatim at
> `.planning/milestones/v3.6-STATE-at-close.md`, including every Decisions entry, Performance
> Metrics table and Roadmap-shape block back to v2.9.
>
> **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-08-09)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** *No milestone active.* Planning the next one.

## Current Position

**Milestone:** v3.7 Workflow Product Completion — **opened 2026-08-10**
**Phase:** **194 Stop a Running Workflow — PLANNED 2026-08-16 (`67e87b88`). 13 plans in 8 waves; plan-checker PASSED first iteration, zero blockers. NEXT = `/gsd:execute-phase 194`.** *(This line read "194 … CONTEXT GATHERED" before planning, "193.2 From Authored to Runnable — ✅ CLOSED…" until 194 opened, and "193.1 Template-First Authoring" before that; all prior readings are kept.)*

⚠ **Read before executing: research refuted EIGHT CONTEXT.md claims and the planner found a ninth gap
neither research nor the pattern map had.** The three that changed scope are locked as **D-16**
(mount 4 descoped — the library has no run id), **D-17** (heal FOUR rows, not two) and **D-18**
(the banner fix crosses PANEL-09, cost stated). The one an executor must not step past: **a Stop
wired to `workflowLock.runId` silently succeeds while doing nothing** — that lock carries two id
types, `DELETE /runs/{id}` accepts only one, and `cancelRun` swallows the 404. `WorkspacePanel.tsx`
recorded this in Phase 188 and it was not carried forward.

**Prior:** **193.2 From Authored to Runnable — ✅ CLOSED. Validated + `U5` driven 2026-08-16; only UAT row `U2` remains owed (unschedulable).**

**Prior:** **193.1 Template-First Authoring — ✅ CLOSED 2026-08-15. `AUTH-03` SATISFIED on a real end-to-end run.**

**The evidence, and it is the row no test could stand in for** (`193.1-UAT.md` § U5): a purpose-built 10-field `.docx` attached at authoring time, a five-document knowledge base, and run `d8331add` completed producing `/Northwind-QBR-Template.docx` — **38,763 B against a 37,424 B template, all ten fields rendered, zero unrendered `{{ }}`, zero literal `None`**, branding intact (navy ×11, amber, teal ×7, Georgia, 4 shading elements), and **11 of 13 planted facts** grounded including `INC-4471`, 412/605 seats, £284,000 and AMBER. **Both halves of the rewritten requirement are observed: attached WHEN AUTHORING, and the run FILLS THAT SAME TEMPLATE.**

⛔ **CLOSED WITH THREE UAT ROWS OWED — U2, U3, U4 — BY DECISION, NOT OVERSIGHT.** They are screen-judgement rows (is the new control confusable with the shipped starter link; does the greyed draft button say WHY; does the describe column still fit a laptop fold). The operator spent real time on that screen during U5 and nothing jumped out, which is weak positive evidence and **is not recorded as a pass**.

⚠ **TWO PUBLISH BLOCKERS WERE FOUND ON THE PHASE'S OWN HEADLINE PATH AND ARE NOT FIXED HERE.** `SEED-163` — the AI authors five phases from the describe text then leaves `business_requirement` blank, so the author restates the same intent by hand. **`BUG-260815-01` (severity BLOCKING)** — the draft grows an `llm_human_input` phase that the synchronous publish gate categorically refuses; the operator deleted the step on the canvas to proceed. ⚠ **The second is a consequence of THIS PHASE'S OWN D-26 fix**: once the model knows it must fill ten named fields it adds a step to ask the human — measured **2 for 2** whenever a template step appears. Neither side is wrong in isolation (the publish gate is deliberate; its docblock names the deferred Phase-103 background-job publish as the real fix). **The shared root is named and both are routed to 197 / AUTH-02: authoring does not know what publish requires.**

⚠ **One quality observation, seeded nowhere yet by decision:** the model grounded Marcus Feld's quote and **stripped his name** — content kept, attribution lost. Fine internally; a downgrade for a client-facing document. Hold until it recurs.

~~**NEXT = drive UAT row `U5`** (the composer's Harness picker — thirty seconds, the one consequence of
the sort nobody has looked at), then **`/gsd:discuss-phase 194`**.~~ *(Superseded three times, all
kept: this line read "NEXT = `/gsd:execute-phase 193.2`" before execution, then "NEXT = drive U1",
then "NEXT = drive U5".)*

~~**NEXT = `/gsd:discuss-phase 194`.**~~ *(Superseded — 194's context was gathered `99b6a5b4` and the
phase was planned `67e87b88`.)*

**NEXT = `/gsd:execute-phase 194`.**

### 2026-08-16 — `/gsd:validate-phase 193.2` + UAT row `U5` DRIVEN. Phase 193.2 is fully closed bar `U2`.

**`/gsd:validate-phase 193.2`** (`fc5e8d50`, `54639093`): VALIDATION.md was `status: draft` /
`nyquist_compliant: false` with every row `⬜ pending` — ten plans and a code-review pass after the
fact. Now scored on RUNS: **17 of 17 automated rows COVERED and green** · backend workflow suites
**213 / 0** · count gate **total 3918 · failed 1**. ⚠ **That one gate failure is NOT this phase's** —
`WorkflowsPage … a PENDING project re-query never zeroes a count` fails with `STACK_TRACE_ERROR`
(the oversubscription signature); `git log -S` attributes it to **`bf7f986f` (192-11)** and the file
passes **55/55 alone**. Name captured from the gate's JSON report BEFORE any re-run.

**ONE GAP FOUND AND FILLED — `G-1`, a property with verification of NEITHER kind.** Nothing covered
whether the stage-2.5 interactive block writes a `publish_blocked` receipt, and the two sources
DISAGREED: `193.2-UAT.md` U2 said *"no `publish_blocked` row is written"*; `_block`'s docstring says
it writes one. U2 was never driven (0/20), so nothing settled it. **Measured: a POST reaching stage
2.5 DOES write the receipt.** U2's sentence is true only of the client-greys-the-button path — two
tiers conflated. 3 cases added, **both plants observed RED**, **zero implementation files modified**.

**UAT row `U5` DRIVEN (`d1e50f98`) — PASS by measurement, and the row's own premise was FALSE.** It
asked whether the composer's Harness workflow picker reads sensibly under recency ordering. **THE
PICKER DOES NOT EXIST.** `list_published_workflows` has **exactly ONE backend call site**
(`api/workflows.py:339`); of the row's four named consumers, **`WorkspacePanel` is order-insensitive**
(`.find(w => w.slug === slug)`), **`threads.py:97` is a DEAD IMPORT** (imported, never called — the
wording *"`:97` imports it"* was literally true and read as *"consumes it"*), and a fourth it never
named (`ConnectionsTab:841`) aggregates into counts. **So the reorder is user-visible in exactly ONE
surface — the library — already driven by U4.** Live feed at `127.0.0.1:54322`: **156 published rows**,
recency correct, U1's QBR at index 0; the observed identical-timestamp PAIRS make the review's
**WR-03** `, id DESC` tiebreaker load-bearing rather than defensive.

⚠ **The false claim had THREE homes** — `CLAUDE.md`'s `db/workflows.py` ledger row, `193.2-UAT.md`
§U5 and `193.2-VALIDATION.md`, the latter two inherited verbatim from the first. *A sentence repeated
across three artifacts is not three pieces of evidence.* All three corrected BESIDE their originals.

**UAT tally: 3 driven → 4 driven · 3 PASS + 1 PARTIAL · 0 FAIL · 1 NOT DRIVEN.** Only **U2** remains
owed and **it still cannot be scheduled** — it waits on an interactive step appearing, which is
exactly what this phase reduced to 0/20. Its receipt half is now automated by G-1; only the *rendered*
observation is outstanding.

---

### ⚠ PHASE 194 — TWO FINDINGS MEASURED 2026-08-16, BEFORE DISCUSS-PHASE OPENS

**1. THE ROADMAP'S SCOPE FLAG FOR 194 IS MEASURABLY WRONG, AND IT IS THE ONE THAT SIZES THE PHASE.**
`ROADMAP.md:491-503` says *"**Depends on**: Nothing structural — mostly UI over an endpoint that
already exists"* and *"Reuses the owned cancel endpoint + `run_lifecycle` internals — **this is not a
new runtime path**"*. Measured at HEAD:

| Claim | Measured |
|---|---|
| a workflow-run cancel endpoint exists | ⛔ **NO.** `backend/app/api/workflow_runs.py` has **exactly ONE route, a `GET`** (`:164`) |
| `db/workflows.py` can cancel a run | ⛔ **NO** cancel function, no `cancelled` write |
| *"the owned cancel endpoint"* | ✅ exists — but it is `DELETE /runs/{run_id}` (`api/runs.py:1155`) over the **`runs`** table, i.e. **deep-agent** runs |
| workflow runs live in `runs` | ⛔ **NO** — `create_workflow_run` writes `INSERT INTO workflow_runs` (`db/workflows.py:175-203`), a **separate table** |

⇒ **194 is a NEW runtime path on the workflow side**: an endpoint, a DB writer, and harness-engine
cooperation so a run can be interrupted mid-phase. SC#3 (*"safe mid-phase: no partial write is
presented as finished"*) is **structural, not UI**. ⚠ **This is the same failure class U5 just
exposed** — an unmeasured premise in a planning artifact, scheduled as a small job. Re-scope at
discuss time; do not plan against the flag as written.

⚠⚠ **CORRECTED AT `/gsd:discuss-phase 194` (2026-08-16), BESIDE THE ORIGINAL RATHER THAN OVER IT —
AND THE CORRECTION IS ITSELF AN INSTANCE OF WHAT THIS FINDING WARNS ABOUT.** **All four rows of the
table above are individually TRUE. The INFERENCE drawn from them is not.** The four measurements
searched the *workflow-side* modules (`api/workflow_runs.py`, `db/workflows.py`) for a cancel verb,
found none, and concluded no cancel path exists. Measured at HEAD:

- **A harness run is driven by the SAME producer task as a Deep run.** `run_producer.run_producer`
  takes `active_workflow_run_id`; the one additive branch (`run_producer.py:386`) calls `run_workflow`
  when the thread holds a live workflow anchor, else the Deep loop. The task registers in `RUN_TASKS`
  under the **`runs`-row id**, so the cancel lives on the `runs` side **by design**.
- ⇒ **`DELETE /runs/{id}` already cancels a workflow run**, and the **F2 block**
  (`run_producer.py:254-277`) already calls `finish_run(active_workflow_run_id, "cancelled")` — its
  own comment names it the *"v2.8-audit cancel-honesty fix"*. `finish_run` (`db/workflows.py:1308`)
  writes `workflow_runs.status` **and** clears the thread anchor in ONE transaction.
- `workflow_runs.status` has admitted `cancelled` since **mig 057**; `harness_engine.py:1615-1644`
  already has a dedicated `CancelledError` arm; `RunCard.tsx:534,548` already renders `■ cancelled`;
  `cancelRun`, `composer-stop` and `ActiveRunsTray`'s per-run + Stop-all all ship.

**So BOTH artifacts were half wrong and neither should be planned against as written.** The ROADMAP
flag is right that little new machinery is needed and wrong that it is *"mostly UI"*; this finding is
right that structural work is owed and wrong about which structure. **The real phase is: is the
shipped cancel REACHABLE, HONEST and SAFE from the workflow run surface?** Three gaps, one per SC —
see `194-CONTEXT.md` `<code_context>` § *The three gaps*. ⚠ **Finding 2 (G-5 on `RunCard.tsx` and
`WorkspacePanel.tsx`) STANDS unchanged and became D-01/D-02.** ⚠ **Finding 3 STANDS and is
DISCHARGED** — all four reports' frontmatter is now written, including two the finding did not name.

*The lesson worth keeping: a measurement that looks in the right place for the wrong thing reads
exactly like an absence.*

**2. G-5 FIRES ON TWO LIKELY-194 FILES AND BOTH ARE ABSENT FROM THE `CLAUDE.md` HOT-FILE LEDGER** —
the invisibility failure that hid `WorkflowsPage.tsx` for ten phases, `WorkflowDoorSwitch.tsx` for six
and `WorkflowBuilderPage.tsx` for ten. Neither appears as a ledger ROW (both names occur only inside
other rows' prose, the same trap the `WorkflowCard.tsx` row documents about itself):

| File | Measured | Ledger |
|---|---|---|
| `frontend/src/components/chat/RunCard.tsx` | **20 commits / ~9 buckets** | ⛔ absent — **G-5 fires** |
| `frontend/src/components/panel/WorkspacePanel.tsx` | **13 commits / ~8 buckets** | ⛔ absent — **G-5 fires** |

Re-derive with `git log --oneline -- <file> | wc -l` and the standard `sed` bucket recipe (⚠ that
recipe counts quick-task buckets as phases — subtract them). **Per G-5, if 194's `files_modified`
names either, discuss-phase owes a refactor recommendation as its FIRST option**, and the ledger rows
should be written in that phase.

**3. Two bugs were routed to 194 but their frontmatter never recorded it** — `folded_into` is `null`
on both `workflow-run-history-not-reachable-from-canvas.md` (BUG-260815-03) and
`chat-stuck-on-starting-workflow-with-duplicate-icon.md` (BUG-260815-04), though STATE records the
routing decision. ⚠ The second carries a standing warning: *the "Starting workflow" string is
DELIBERATE and pinned — do not reword it.*

---

### Phase 193.2 — ✅ CLOSED 2026-08-15 · 10 of 10 plans · all four SCs DRIVEN · `AUTH-03` SATISFIED

**⚠ `AUTH-03` IS SATISFIED END TO END, AND UAT ROW U1 IS THE ONLY REASON IT MAY BE SAID.** A template
attached **at authoring time**, and a real run that **fills that same template** — both halves
observed in one sitting on run **`b021c7b0`**. 193.1 built the capability and **deliberately declined
to tick it on unit evidence alone**; this is the evidence it was waiting for.

| Moment | Verdict | The measurement |
|---|---|---|
| **M1** requirement pre-filled + marked | ✅ **PASS** ⚠ *with one caveat* | Durable, **NOT an echo of describe** — so `193.2-07`'s anti-echo predicate **EARNED** the mark rather than defaulting to it. `business_requirement_seeded_by_ai: true`; `assets[]` carries the bound template (193.1's auto-bind works) |
| **M2** publishes without a canvas edit | ✅ **PASS** | Canvas untouched. ⚠ after three blocked attempts, **all environmental** |
| **M3** findable without searching | ✅ **PASS** | **Rendered position 4 of 112** (3 starters + 29 published + 80 drafts) — **the predicted index `starters.length` held EXACTLY**. The post-publish **Run CTA appeared and NAMED the workflow** |
| **M4** the run fills the template | ✅ **PASS** | `/Northwind-QBR-Template.docx` **39,698 B** vs a 37,424 B template; **10 of 10 fields** each with a real `source_doc`; **0** residual `{{ }}`; **0** literal `None`; **branding verified against an operator SCREENSHOT**, not merely the field map |
| **M5** planted facts | ✅ **PASS — all eight** | 68% utilisation · 412/605 seats · INC-4471 · 6h12m outage 12 Aug · £284,000 ARR · term to 31 Jan 2027 · Freight Analytics ~£62,000 · AMBER |
| **M6** composer picker | ⏸ **NOT DRIVEN** | optional row; recorded as not driven, **never as a pass** |

⚠ **The recency claim is proved against a near-identical OLDER row rather than by alphabetical luck:**
the new QBR (14:17) sorts **above** the old Q3 one (02:07). Without that pairing a pass at position 4
would have been ambiguous.

⚠ **THE 193.1 ATTRIBUTION REGRESSION DID NOT RECUR — Marcus Feld is named TWICE in the rendered
document.** 193.1 observed the model grounding his quote and **stripping his name**, and held it
*"until it recurs"*. **This is a second data point in the right direction, so the deferral's own
trigger (*"a second sighting earns a seed"*) is NOT fired and no seed is owed.**

#### ⏸ CLOSED WITH TWO ROWS NOT DRIVEN — a DECISION, never a claim that everything ran

- **U5 / M6 — the composer's Harness workflow picker.** Simply not opened. **It is the ONE
  user-visible consequence of `193.2-03` that lands outside the library** (the same feed also drives
  `WorkspacePanel`'s run-soul and `threads.py`'s kickoff), and **nobody has looked at it.** Thirty
  seconds. **Run it first.**
- **U2 — the rendered interactive refusal. ⚠ IT COULD NOT BE DRIVEN.** The surface only renders when
  an interactive step exists, and **none did** — the run's five phases contain no `llm_human_input`,
  consistent with the measured 0/20. **The defect not occurring is NOT the same as its message
  reading well**, and it is deliberately not recorded as a pass. ⇒ **the rewritten two-arm refusal
  copy has still never been read by a person on a real screen.** Re-open: the next time an
  interactive step appears on a real draft.

⚠ **ONE HONESTY CAVEAT ON M1, recorded rather than rounded up:** the operator confirmed *"I think all
pass"* **broadly** and did **not** specifically confirm the **VISIBLE** mark. **The DURABLE half is
measured; the VISIBLE half rests on a general confirmation** — and `193.2-09` had already flagged
that its mark shipped with **no browser UAT**. *A general "all pass" is weak positive evidence and is
not a driven row.* Carried as a residual in `SEED-163`.

#### ⚠ Three publish attempts were blocked first, and NONE was a product defect on the publish path

The **OpenAI credit balance was exhausted** (`429 insufficient_quota` / `credit_balance_exhausted`,
confirmed by a live `embeddings.create`). Every document is embedded with `text-embedding-3-small`,
so **every search must embed its query**; with no credits retrieval returned **0 sources**,
`citations_required` failed **3× per run**, the golden run failed and publish **correctly refused**.
**The gauntlet behaved exactly as designed.** Ruled out *by measurement*: 5 docs / 18 chunks / **0
null embeddings** / matching `org_id` / a definition byte-comparable to one that had worked hours
earlier. ⚠ Attempt 2 additionally bound the **wrong KB folder** — incidental; it would have failed
anyway.

**Re-measured in `harness_audit` afterwards:** `publish_blocked` **3 today** (14:02:21 / 14:07:42 /
14:10:29, **`blocked_stage: structural_gate` on all three**), `publish_attempted` **5**,
`publish_succeeded` **2**, all-time `publish_blocked` **35** (was 32). ⚠ **These are the first
`publish_blocked` rows since 2026-08-07 and they CONFIRM rather than contradict `193.2-02`'s D-10
finding** — that finding was that the *original* refusal wrote **no** such row and therefore came from
the greyed control; these came from a **different gate**, reached only by getting **past** the
interactive question entirely. ⚠ **The stage is only readable through the C-7 accessor
`metadata #>> '{}'`** — `->>'blocked_stage'` returns NULL on every row of that column by definition.

#### Filed from the same session — four bugs and three seeds, referenced not re-derived

| Id | Sev | What |
|---|---|---|
| `BUG-260815-05` | **blocking** | a provider outage is reported as *"nothing was retrieved (0 sources)"* |
| `BUG-260815-06` | major | the structural-gate refusal **names a stage, not a cause**. ⚠ **The same failure class 193.2 fixed for the interactive gate, surviving on the gate next door** — one refusal was rewritten and its neighbour still names machinery |
| `BUG-260815-07` | major | a delete failed once, **NOT reproducible**, stays open. Adjacent finding that IS reproducible: **two runs stuck `active` since 2026-08-01 and 2026-06-14 are a permanent delete blocker** |
| `BUG-260815-08` | minor | Workflows header — uncoloured Build button, wrapping project dropdown, a search field that does not read as one. **G-2 FIRES; sketch it together with `SEED-155`'s card density** |
| **`SEED-159`** | — | ⚠ **TRIGGER FIRED on the first customer-facing deliverable, AND ITS PREDICTION WAS WRONG.** Not a silent blank but a **verbose internal disclaimer** (*"Not explicitly stated in the KB."*) rendered in the **front-page header** of a document footed *"Commercial in confidence"*. **The model's behaviour was correct**; the defect is that **a deliverable has no register distinct from an internal answer** |
| `SEED-165` | — | 52 out-of-gate backend test failures, triaged **34 stale / 18 undiagnosed** |
| `SEED-166` | — | settings / operator / admin information architecture |

#### Gates at close, after the code-review fix pass

| Gate | At close | Note |
|---|---|---|
| count gate (`GSD_VITEST_MAX_WORKERS=2`) | **`OK` · 3918 · failed 0 · 75/75** | |
| backend workflow suites | **210 / 0** | |
| full `backend/tests/unit` | **62 failed / 2221 passed** | the 62 is the recorded baseline rot set — **failures unmoved, passes grown** |
| `tsc -p tsconfig.app.json` | **33** | unmoved across the whole phase |
| **Code review** | **0 Critical / 0 Warning / 5 Info** | all six Warnings fixed post-review (`e09e3a13`, `82d622ad`, `c4fe1066`, `accf9539`, `ab7e8ca2`, `3265dc80`) + two out-of-gate test repairs (`f6e853f8`, `138568dd`) |
| **G-7** | **CLEAR** | 10 plans, **0 gap-closure rounds** |

#### ⚠ Three ledger rows went stale ON THE DAY THEY WERE WRITTEN — corrected beside, in `CLAUDE.md`

The close-out plan measured at its own HEAD; the review's WR-fix commits then landed on three of the
five files **the same afternoon**. **This is the sharpest instance yet of the self-staling that table
documents about itself** — *"the next commit" can be hours away.*

| File | written at close-out | **re-derived after the fix pass** |
|---|---|---|
| `backend/app/db/workflows.py` | 31 / 17 / 1405 | **32 / 17 / 1447** |
| `backend/app/services/harness/publish_service.py` | 17 / 7 / 1158 | **19 / 7 / 1243** |
| `backend/app/services/workflow_authoring.py` | 11 / 6 / 540 | **12 / 6 / 572** |

The other six rows are unmoved (`models/harness.py` 17/16/611 · `builderStore.ts` 11/5/837 ·
`WorkflowsPage.tsx` 34/12/1176 · `WorkflowBuilderPage.tsx` 41/12/2348 · `api/workflows.py`
34/17/1951 · `WorkflowCard.tsx` 8/3/818).

#### ⚠ ONE DEFERRAL THIS PHASE RECORDED AS OWED WAS DISCHARGED BY THE REVIEW — and it taught the lesson twice

**`publish_service.py`'s *"the deferred Phase-103 rework"* prose is GONE (WR-05, `ab7e8ca2`) — and it
was retired the right way: the sentence is QUOTED VERBATIM AS SUPERSEDED rather than deleted**,
because *a deferral that lives only in a deleted comment is exactly as invisible as one that was
never written*. The capability it named is routed to `SEED-164`.

⚠ **And the fix recorded a SECOND instance of this phase's own "a copy a machine cannot find is not a
copy" lesson:** as shipped, that sentence was **split across two lines**, so a line-oriented `grep`
for the phrase **returned NOTHING and read as "already fixed"**. It is now quoted **on one line on
purpose.** (The first instance was `193.2-08`, whose verbatim rule was written WRAPPED and failed its
own literal `grep -q`.) **Two independent occurrences in one phase — treat a multi-line quote of a
governed string as unfindable by default.**

#### What is STILL owed after the close

**U5** (thirty seconds, run it first) · **U2** (unschedulable — waits on an interactive step
appearing) · the **VISIBLE half of M1** · the eight other deferrals listed below, each with its
trigger. **`DEF-193.2-03-01`'s three stale citations and the `libraryFilter.test.ts` pin at 48 vs 60
are unchanged.** ⚠ **The refusal-length residual (196 chars worst case) is now MORE owed, not less** —
U2 never rendered, so nobody has read it.

**Gates re-run at HEAD by `193.2-10`, each beside its `193.2-BASELINE.md` value:**

| Gate | Baseline | At close | Verdict |
|---|---|---|---|
| backend `tests/unit` (full) | 62 failed / 2092 passed | **62 failed / 2154 passed** | ✅ failures **identical** — the recorded SEED-056 rot set; passes grew by the new cases |
| the six backend workflow suites | 81 / 0 failed | **110 / 0 failed** | ✅ |
| the five frontend workflow suites | 337 / 0 failed | **359 / 0 failed** | ✅ |
| count gate (`GSD_VITEST_MAX_WORKERS=2`) | OK · 3892 · failed 0 · 75/75 | **`count gate OK` · total 3918 · failed 0 · pinned 3868 · 75/75** | ✅ first run, quiet tree |
| `tsc -p tsconfig.app.json` | 33 | **33** | ✅ unmoved across all ten plans |

**No NEW failure appeared.** ⚠ Gate on the count gate + the named suites, **never on a bare full
frontend run** — `193.2-01` measured that tree at **49 then 46** failures on one identical commit, so
that figure cannot pass or fail a plan.

#### ⚠ THE MEASURED RESULT — and D-08 binds every word of it

> *"The claim is a reduction, not an absence — the publish gate stays because a prompt cannot guarantee absence."*

| Figure | anth `kit10` | anth `uat8` | oai `kit10` | oai `uat8` | Pre-fix |
|---|---|---|---|---|---|
| `business_requirement` non-empty (**SC#1**) | **5/5** | **5/5** | **5/5** | **5/5** | **0/N** |
| `llm_human_input` present (**SC#2**) | **0/5** | **0/5** | **0/5** | **0/5** | **2/2** w/ template; 4/6 overall |
| `render_template` (**SC#4 CONTROL — did NOT fall**) | **5/5** | **5/5** | **5/5** | **5/5** | 193.1's **3/3**, like-for-like |
| `external_action` (displacement) | **0/5** | **0/5** | **0/5** | **0/5** | not measured |

20 real paid generations, 0 failed calls, 410.9 s. ⚠ **The counters were PLANTED before their zeroes
were published** — a zero from a blind counter and a zero the model earned are indistinguishable in
an artifact — and the positive control ships permanently in the harness. ⚠ **The SC#4 control counts
a `render_template` PHASE IN A DRAFT; it does NOT prove a template gets FILLED.** Only U1 can.

#### ⚠ D-10's escape hatch: NOT TRIGGERED — and the reason is better than the question

CONTEXT said *"one of those two facts is false on the live path."* **BOTH are TRUE.** The false
premise was the unstated third one — **that a 400 was ever received.** `publish_blocked` was **0**
that day; there was exactly **1 `publish_attempted`** and **1 `publish_succeeded`, 7.57 ms apart**,
and the newest `publish_blocked` anywhere is **2026-08-07**. ⇒ **Rewriting the string IS the fix.**
The defect is real and unchanged in severity; only its location moved — **it is on the canvas, not
behind a publish click.**

#### The plan-08 premise was FALSE and the blocking checkpoint is why it was caught

`193.2-08-PLAN.md` said to reuse the kit's ten-field `.docx` *"so SC#2 and SC#4 measure the same
artefact"*. **Measured before spending anything: 193.1's 3/3 was driven on the eight-key
weekly-status set with its own describe — same kit folder, different artefact.** A ten-field arm
could only have been compared to 3/3 as a floor. **The operator authorized a SECOND like-for-like
arm**, which is the only reason figure 3 is a comparison rather than a floor. *That is what the
checkpoint bought.*

#### Five findings that must not be lost

1. **⚠ FIVE INERT-FENCE FINDINGS, and EVERY ONE was caught by PLANTING a failure, none by reading**
   (plans 03, 06, 07, 08, 09). `03` — a clause already green from a prior phase's unrelated use of
   the same `D-16` literal. `06` — a fence asserting only `a != b` **passed** a plant where the arms
   shared a sentence but differed as strings. `07` — a realistic regression failed **exactly one case
   in thirty-three**. `08` — three of four headline figures were zeroes from counters nobody had shown
   could fire. `09` — **a nine-phase-old byte pin stayed GREEN under the exact plant it was credited
   with catching**, because its fixture cannot express the condition. ⚠ **Plus 09's second-order
   lesson: a plant EASIER to catch than the real regression proves less than it looks like** — the
   duplicate mount reds 7 cases, the realistic moved form only 2. **A fence is only real once you
   have watched it fail.**
2. **⚠ A verbatim quote written WRAPPED made a literal `grep -q` return 0** (`193.2-08`). *A copy a
   machine cannot find is not a copy.* Reflowed onto one line with a note saying why it must stay.
3. **⚠ `193.1-11`'s *"`inputs[]` is fed by nothing"* is TRUE OF ANTHROPIC AND FALSE AS A GENERAL
   CLAIM** — anthropic 0/10, `gpt-5.5` **7/10** with keys that ARE placeholder names. **A PROVIDER
   difference, not this phase's effect** — 193.1 never drove `gpt-5.5`.
4. **⚠ The AI-proposal mark means *"a model wrote this"*, NEVER *"this is durable"*.** openai named
   one-run parameters in **5 of 5** QBR requirements, anthropic in **0 of 5**; all 20 were still
   correctly stamped `seeded_by_ai: True`, because the stamp's question is *"is this a normalised copy
   of describe?"* and a fuzzy similarity metric was deliberately rejected.
5. **⚠ `external_action` is a real hole in the publish gate that CANNOT wedge a publish** (armed
   checkpoint auto-continued at `harness_engine.py:837`; send skipped at `phase_types.py` GATE 1) —
   **and widening the gate is FORBIDDEN by a shipped fence** (CONFLICT-1 Option B, REJECTED).
   `SEED-164`'s *"always asks approval"* is true of a LIVE run and misleading as a publish claim.

#### Two jsonb traps, both measured

- **`harness_audit.metadata` is a DOUBLE-ENCODED jsonb STRING** — `metadata->>'blocked_stage'` returns
  **NULL on all 32 rows by definition**; the working accessor is `metadata #>> '{}'` then a parse.
  ⚠ *A NULL that reads like "the field is empty" is indistinguishable from "you asked the wrong way"*
  — the same failure class this phase fixes in user-facing copy, appearing in our own diagnostics.
- **`definition` is a jsonb string scalar on 194 of 223 rows**, so `definition->'phases'` silently
  returns nothing. Re-confirmed through the model round-trip probe in `193.2-07`.

#### ⚠ Guardrail overrides: NONE for Phase 193.2 — and the phase has now EXECUTED without one

A G-5 override was **OFFERED AND DECLINED** at discuss time; **that absence is a measurement, not an
omission**, and this is the **THIRD consecutive phase** (193, 193.1, 193.2) to decline one. **G-5
fired on SEVEN files and every one was honoured BY CONSTRUCTION**, each carrying its D-02
no-second-concern argument **proved by measurement rather than asserted** (the complete non-comment
diff; `new[:len(old)] == old`; 0 deletions; hunk offsets showing the untouched regions).
**G-1 does NOT fire** — second `193.x`; ⚠ **a THIRD `193.x` would trip it, and whoever comes next
should know that before proposing one.** **G-2 did not fire on anything in scope** — the library work
is an `ORDER BY`, not a render; the card-density / list-vs-card question the operator raised in the
same breath is a design question, routed out (below).

#### FIVE ledger rows written, not the three D-03 anticipated

| File | Measured at close | Was it on the table? |
|---|---|---|
| `backend/app/db/workflows.py` | **31 / 17 / 1405** | ❌ absent for 17 phases — **2nd-hottest backend file in the tree** |
| `backend/app/services/harness/publish_service.py` | **17 / 7 / 1158** | ❌ absent |
| `backend/app/services/workflow_authoring.py` | **11 / 6 / 540** | ❌ absent |
| `backend/app/models/harness.py` | **17 / 16 / 611** | ❌ absent — found by RESEARCH, **not in CONTEXT's own six-file table** |
| `frontend/src/components/workflows/builderStore.ts` | **11 / 5 / 837** | ❌ absent — **in NO prior artifact of this phase at all** |
| `frontend/src/pages/WorkflowsPage.tsx` | **34 / 12 / 1176** | ✅ cell said `33/12/1160` — **STALE for the 4th time, and INHERITED: this phase never touched the file** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | **41 / 12 / 2348** | ✅ corrected beside `40/11/2252` |
| `backend/app/api/workflows.py` | **34 / 17 / 1951** | ✅ **UNCHANGED — the phase never touched it**, though CONTEXT D-02 and the ROADMAP flag both predicted it would |
| `.../library/WorkflowCard.tsx` | **8 / 3 / 818** | ✅ **UNCHANGED — out of scope by D-04**; its inherited G-5 obligation passes forward untouched |

⚠ **TWO PHASE COUNTS WERE DISPUTED AND WERE RESOLVED BY MEASUREMENT, NOT BY CHOOSING.** The standard
recipe `git log --format=%s -- <f> | sed -E 's/^[a-z]+\\(([^)]+)\\).*/\\1/' | sed -E 's/-.*//' | sort -u`
returns **quick-task buckets alongside real phases**. `builderStore.ts` → 6 buckets, of which
`260809` is a quick task ⇒ **5 phases** (plan 09 right, the brief's 6 wrong).
`WorkflowBuilderPage.tsx` → 14 buckets, of which `260809` and `260814` are quick tasks ⇒ **12 phases**
(plan 09 right, the brief's 14 wrong). `publish_service.py` → 8 buckets, of which `quick` is a quick
task ⇒ **7 phases**. **The losers are recorded beside the winners**, which is this table's habit.

#### The inherited pattern for 197 (D-22) — a MEASURED pattern, not one to re-derive

`SEED-163` predicted that a third *"the authoring path did not supply something it already had"*
makes **the pattern the phase, not the field.** There are now three: **`SEED-157`** (`/generate`
accepted `template_placeholders` for five phases and the frontend never sent it) · **`SEED-163`**
(the emit tool **advertised** `business_requirement` and the prompt never asked for it) · **the
AI-chosen `name`** the author never gets to set. **197 / AUTH-02 inherits this measured rather than
re-derived** — the same habit the hot-file ledger keeps, and the answer to the standing lesson that a
deferral living in one phase's context file is exactly as invisible as a hot file missing from that
table.

#### Deferred and NOT delivered here — each with a concrete re-open trigger

| Item | Routed to | Re-open trigger |
|---|---|---|
| **D-24 — letting the author NAME or RENAME the workflow** | **197 / AUTH-02** | 197 itself, **or** a report of a wrong AI-chosen name reaching a client. `ForkNameDialog.tsx` (192.1) is the shipped asset when it is taken up; a rename on a PUBLISHED row touches the slug that identity, forks and versioning key off |
| **D-25 — a workflow that DELIBERATELY pauses for a person and can still be published** | **`SEED-164`** | ⚠ **193.2 SUPPRESSED the unwanted step; it did NOT deliver this, and nothing shipped may imply otherwise.** A user asking for genuine human-in-the-loop raises it from seed to requirement. The expensive part is the durable pause on REAL runs, not publish (`LlmHumanInputPhaseConfig` has **no artifact field** and a **1800 s hard cap**) |
| **D-18 — a user-facing recency ⇄ A–Z sort control** | the deferred **library layout sketch** | that sketch, **or** a second report of wanting alphabetical back. Building it now is building it twice |
| **Card density / list-vs-card layout** | `/gsd:sketch` — **G-2 FIRES**, `SEED-155` binds | run `/gsd:sketch` on the library list before any layout plan. ⚠ **Sorting shipped regardless and must not be absorbed into this** |
| ~~`publish_service.py:196-197` still says *"the deferred Phase-103 rework"*~~ **✅ DISCHARGED by code-review WR-05 (`ab7e8ca2`) hours after this row was written** | — | ⚠ **Kept rather than deleted, because the row is now evidence rather than debt.** It was the evaporated-deferral problem `SEED-164` exists to correct, surviving in a comment; `193.2-06` had honoured an explicit UNCHANGED constraint on `:190-208` over the docstring rule and **flagged rather than hid it**, which is the only reason the review found it. **The fix retired it the right way — the sentence is QUOTED VERBATIM AS SUPERSEDED, not deleted**, and the capability is routed to `SEED-164`. ⚠ **It also proved the "a copy a machine cannot find is not a copy" lesson a second time:** the sentence had shipped **split across two lines**, so a line-oriented `grep` returned NOTHING and read as *"already fixed"* |
| **The count-gate pin for `libraryFilter.test.ts` sits at 48 against an actual of 60** | a later phase | The gate's contract is *no per-file DECREASE* and the pinned TOTAL did not move, so nothing is broken. Raise it **from the gate's own printed column across two agreeing runs**, never from a summary |
| **Refusal-message length grew to 196 chars worst case** (vs a 105/99 baseline; ~150 realistic, 135/143 degraded) | UAT / a copy pass | The stated cost of carrying a step label and an action. Trigger: an operator reading the refusal and finding it long, at U1 moment 2 |
| **Attribution between the suppression clause and the shortened bullet** | not scheduled | ⚠ **UNRESOLVED and UNDRIVEN — the phase claims a COMBINED effect and attributes nothing.** The third arm needs a temporary edit to production source and 20 more paid calls to answer a question no success criterion asks. Trigger: a regression in figure 2 that needs blame assigned |
| **`DEF-193.2-03-01` — three stale frontend line-number citations** of `db/workflows.py` | `/gsd:fast` (3 files, 3 lines) | The next plan whose `files_modified` already names one of the three corrects it in the same commit; otherwise one `/gsd:fast` pass closes all three. All are comments; **not one is an import** |
| **Plan 09's AI-proposal mark has had NO browser UAT** | U1 moment 1 | Its live contrast against the Deep Midnight theme at `text-[9px]`, and whether *"AI-proposed"* reads right beside a real sentence, are operator judgements no plan claims to have made |

#### ⚠ The wrong-base bug: 12 for 12 across 193.1 / 193.2, 22+ project-wide

**Every worktree this phase dispatched arrived at `fda79214`** — a `master` merge tip — instead of its
dispatched base, and **in the last five the dispatched base was not even an ancestor**. Every one was
caught by the `git merge-base --is-ancestor` assertion in the executor prompt and reset **before any
measurement was taken**. ⚠ **The one NON-fire is also a data point:** `193.2-08` ran serially on the
MAIN tree (real paid calls + local Supabase writes — worktrees isolate files, not Postgres) and
arrived where it was sent. **This is now the most reproducible defect in this project's tooling.
Keep the assertion in every prompt** — it is the only thing standing between a phase and a set of
baselines that prove nothing.

⚠ **`.planning/STATE.md` was HAND-EDITED throughout this phase. No `gsd-sdk state.*` verb was called
by any plan.** Seven of them write false records; one deleted ~9 KB of locked decisions inside a
193.1 worktree while reporting `"updated": true`.

---

### Phase 193.2 — PLANNED 2026-08-15 · 10 plans / 6 waves · Ready to execute

**Status:** Ready to execute. **Artifacts:** `193.2-CONTEXT.md` (26 decisions) · `193.2-RESEARCH.md` (882 L, measured) · `193.2-PATTERNS.md` · `193.2-VALIDATION.md` (fences F-1…F-8) · `193.2-01…10-PLAN.md`.

⚠ **NO GUARDRAIL OVERRIDE IS RECORDED FOR PHASE 193.2, AND THAT ABSENCE IS A MEASUREMENT (D-01).** It is the third consecutive phase (193, 193.1, 193.2) to be offered one and decline it. G-5 is honoured **by construction** on all seven hot files, each carrying the D-02 no-second-concern argument in its plan.

⚠ **RESEARCH REFUTED D-10's PREMISE BEFORE ANY CODE WAS WRITTEN — and this is the second consecutive phase whose Wave-1-first sequencing paid for itself.** `harness_audit` for 2026-08-15 measured **1 `publish_attempted`, 1 `publish_succeeded`, 0 `publish_blocked`** (the latest `publish_blocked` anywhere is 2026-08-07), and `publish_attempted` is written only at stage 3 while every pre-run gate writes `publish_blocked`. **The publish endpoint never refused anything.** Both CONTEXT facts are true across nine verified hops; the refusal the operator met came from `blockedReason` beside an already-greyed `publish-trigger`. ⇒ **D-10's escape hatch does not trigger and rewriting the string IS the fix.** Wave 1 is therefore a *confirmation-and-record* wave, planned as the cheaper thing it is rather than padded out. It also settles a `Claude's Discretion` item on measurement: the surface is the Builder header — a `text-[12px] shrink-0` span with a ~105-char ceiling — so D-13's removal action ships as a **precise instruction, not a live control**.

⚠ **A SHIPPED GREEN FENCE FORBIDS D-15/D-16.** `backend/tests/unit/test_workflows_updated_at.py::test_no_feed_orders_by_updated_at` asserts `"ORDER BY updated_at" not in source` for all three feeds. Plan 03 **rewrites it in place as the D-16 divergence fence — never deletes it** — with the old reasoning kept beside the new under a `SUPERSEDED` token, and drives it RED against the pre-change source (F-1, mandatory).

⚠ **FOUR ledger rows are owed, not the three D-03 anticipated.** Research found a **seventh** hot file absent from the `CLAUDE.md` table: `backend/app/models/harness.py` — **16 commits / 15 phases / 578 L** — needed because a durable AI-proposal mark requires an additive field on `WorkflowDefinition` (`extra="forbid"`, measured). The row is owed **whether or not** the phase edits the file. Measured today: `db/workflows.py` **30/16/1296** · `publish_service.py` **16/6/1047** · `workflow_authoring.py` **9/5/389** · `models/harness.py` **16/15/578**. `WorkflowsPage.tsx`'s cell is stale for the **fourth** time (`33/12/1160` → **34/12/1176**) and is corrected BESIDE, never over.

⚠ **`BUG-260815-02`'s arithmetic was over the WRONG FEED, and the correction is stated rather than smoothed.** The page passes `?scope=mine` → 28 published rows, QBR at 14/28 → rendered **17 of 109**, not 129 of 146. After the sort it lands at **4 of 109, not 1** — `mergeLibrary` concatenates starters first. Whether position 4 satisfies "findable" is an operator judgement carried as an open question into UAT.

⚠ **The post-publish Run CTA has had ZERO automated coverage since it shipped.** Plan 02 lands its first pin ever.

**Wave shape:** 1 baselines-on-the-unmoved-tree → 2 D-10/D-19 confirmation + the CTA pin → **3 parallel (cap 2): `db/workflows.py` ORDER BY · rendered-position arithmetic · the authoring prompt · the two-arm refusal** → 4 the additive model field + provenance stamp → **5 the k/N frequency run (SERIAL — real provider calls + local Supabase writes) + the Builder AI mark** → 6 close-out (four ledger rows, STATE/ROADMAP/bug frontmatter, D-21's operator UAT run).

⚠ **D-08 binds every plan: the `SEED-163` fix is explicitly NON-DETERMINISTIC.** No plan may claim the field is "always" populated; the claim is a **measured reduction, never an absence**, reported k/N with the rule stated verbatim — which is why the publish gate stays.

⚠ **Baselines a plan must not mistake for its own breakage** (RUN, not estimated, at HEAD): backend `tests/unit` **62 failed / 2092 passed** · the six workflow backend suites **81/0** · the five workflow frontend suites **337/0** · **count gate `total 3892 · failed 0`** — ⚠ **`CLAUDE.md` records 3604 and is one day stale** · frontend full **26 failed / 5595 passed**, all 26 the pre-existing SEED-056 rot set outside the gate. Gate on the count gate + the named suites, never a bare full run.

**Prior context (unchanged):**

⚠ **Two shipped surfaces are treated as SUSPECTS, not scenery, and measuring them is a
deliverable rather than a preamble.** Both should already have covered half of this phase:

1. **D-10** — `/validate` already mints an `interactive_phase` verdict on every canvas edit
   (`backend/app/api/workflows.py:895-903`), it is registered in BOTH `_ROUTE_ASSIGNED_CODES`
   (`:686`) and `_INCOMPLETE_CODES` (`:700`), `blockedReason` already renders the server's
   message **verbatim** (`WorkflowBuilderPage.tsx:1341`), and a test pins it
   (*"187-28 — a route-assigned verdict GATES the Publish control"*). **If the control was
   greyed, the operator could not have clicked Publish and received a 400.** One of those two
   facts is false on the live path. Wave 1 establishes which, before anything is built.
2. **D-19** — the post-publish Run CTA already renders *"Published **{name}** v{n}. Ready to
   run it."* with a Run button (`WorkflowsPage.tsx:897-908`, set on gauntlet PASS). So *"the
   product never told me the name"* is at least partly already closed **and the operator was
   still lost.** Measure it before building a second hand-off beside it.

⚠ **G-5 FIRES ON SIX FILES AND THREE ARE ABSENT FROM THE `CLAUDE.md` HOT-FILE LEDGER**, so the
guardrail has never fired on them once — the identical invisibility failure `WorkflowsPage.tsx`
suffered for ten phases and `WorkflowDoorSwitch.tsx` for six. Hotness was **derived with
`git log`**, not read off the table:

| File | Measured 2026-08-15 | On the ledger? |
|---|---|---|
| `backend/app/db/workflows.py` | **30 commits / 16 phases / 1296 L** | ❌ ABSENT — 2nd-hottest backend file in the tree |
| `backend/app/services/harness/publish_service.py` | 16 / 6 / 1047 | ❌ ABSENT |
| `backend/app/services/workflow_authoring.py` | 9 / 5 / 389 | ❌ ABSENT |
| `backend/app/api/workflows.py` | 34 / 17 / 1951 | ✅ obligation inherited |
| `frontend/src/pages/WorkflowsPage.tsx` | **34 / 12 / 1176** | ✅ ⚠ cell says `33/12/1160` — **STALE, 4th time** |
| `.../library/WorkflowCard.tsx` | 8 / 3 / 818 | ✅ next phase naming it owes a refactor rec FIRST |

**Honoured by construction (D-01/D-02), and writing the three missing ledger rows is a phase
deliverable (D-03).** `WorkflowCard.tsx` should not be touched at all (D-04).

### Guardrail overrides

⚠ **NONE for Phase 193.2. A G-5 override was OFFERED AND DECLINED — the THIRD consecutive phase
(193, 193.1, 193.2) to decline one. That absence is a measurement, not an omission.**

### Phase 193.2 — the three items, unchanged

**From Authored to Runnable** — everything between *"the AI wrote my workflow"* and *"I can run
it and find it again"*. Three items, **all found by the operator in ONE sitting**, on Phase
193.1's own headline path, immediately after `AUTH-03` was proven working:

| Item | What happens today |
|---|---|
| `SEED-163` | The AI writes five phases from the describe text, then leaves `business_requirement` blank — the author restates the same intent by hand before publish is possible |
| **`BUG-260815-01`** (blocking) | The draft grows an `llm_human_input` step that the synchronous publish gate categorically refuses; the operator deleted it on the canvas to proceed |
| **`BUG-260815-02`** (blocking) | A just-published workflow is unfindable — the AI names it, the library sorts `ORDER BY name` at three call sites with **no recency ordering anywhere**, and *"Quarterly Business Review…"* landed at **position 129 of 146** |

⚠ **I ROUTED ALL THREE TO 197 AND THE OPERATOR OVERRULED IT — the original reasoning is left
visible in each artifact rather than overwritten.** It optimised for tidiness of scope (197 is
the phase already scoped to authoring) and not for whether the product could be used. Hitting
two publish walls in one sitting is what settled it.

**They are ONE phase and not three fixes because they share ONE root: the authoring path makes
decisions the author is never shown, and does not know what the publish gate requires.**

⚠ **`BUG-260815-01` is a consequence of Phase 193.1's OWN `D-26` fix** — measured 2 for 2
whenever a template step appears. **Neither side is wrong in isolation**; the gate is deliberate
and its docblock names the deferred Phase-103 background-job publish as the real fix. **Do NOT
fix it by removing the gate.** The generalisable lesson, worth carrying past this phase: *a
change to what a model EMITS can push its output across a gate nobody thought to re-check.*

⚠ **G-2 fires on the library half and MUST NOT absorb the sort bug.** The operator also raised
card density and floated a list view — that is a **design question** needing `/gsd:sketch`
first, bound by `SEED-155`. **Sorting is a defect and ships regardless of any layout decision.**
⚠ **G-1 does not fire** (second `193.x`; the rule needs ≥ 2 priors) — **a third would trip it.**

### Two further findings from the same session — routed to 194 / RUN-01, NOT to 193.2

- **`BUG-260815-03`** (major) — a run's history is reachable from chat but **not from the
  canvas** after reopening the thread. Not root-caused; the investigation is *named* rather than
  guessed (`workflow_runs` is keyed by `definition_id` as well as `thread_id`, so the data
  likely already exists).
- **`BUG-260815-04`** (major) — while a workflow runs, chat keeps a **duplicate assistant icon**
  and stays on **"Starting workflow…"** for the entire run. ⚠ **That string is DELIBERATE and
  pinned byte-exact** (`toolMeta.ts:92`, D-14) — so this must **not** be fixed by rewording. The
  defect is that the surface never leaves its pre-tools state while `workflow_phases` rows are
  being written throughout. Check the existing `toolcallpanel-dedup` report before opening a
  fresh investigation into the duplicate icon.

**Both are run-surface truthfulness, not authoring** — deliberately kept out of 193.2.

**NEXT = drive UAT rows U2, U3 and U4** (`193.1-UAT.md`), with a person who has not read the source. Nothing else is owed by the code.

**⚠ THE PHASE IS DELIBERATELY NOT MARKED COMPLETE, and `AUTH-03` is deliberately NOT TICKED.** The wire and the bind shipped in the same commit and the first half of the requirement is measured true — but **no test in this phase observes a real run filling a template end-to-end**, and AUTH-03's rewritten wording requires exactly that. Ticking it on unit evidence alone is precisely the trap Phase 193 fell into: built exactly to the written criteria, missed the requirement.

### Phase 193.1 — execution log, ALL SEVEN WAVES (2026-08-14/15)

**Gates on the merged tree, measured by the orchestrator rather than inherited from any executor:**
`tsc -p tsconfig.app.json` **33, unmoved across all eleven plans** · count gate (cap 2) **exit 0 · total 3892 ·
failed 0 · 75/75 pinned** · backend unit **62 failed / 2092 passed** · deploy-drift **PASS** · **G-7 CLEAR**
(`plans: 11 total · 0 gap-closure` — no gap-closure round was opened) (62 is the recorded SEED-056 rot baseline,
failures unchanged, passes grown by the new cases).

**⚠ THE PHASE'S CENTRAL ASSUMPTION WAS MEASURED FALSE IN WAVE 1, AND FIXING IT REQUIRED A PLAN THAT
DID NOT EXIST AT PLAN TIME.** `193.1-04` drove six real `/generate` calls (`claude-opus-4-8` /
`anthropic`) and found that **sending `template_placeholders` does NOT flip the DELIVERABLE RULE's
branch** — 0 `render_template` phases on 3 of 3 runs. The wire was never broken (all eight names reach
the prompt; RESEARCH §B's four-hop trace re-verified **exact at HEAD**, all 18 claims). What failed was
the **inference**: the grounding header hedged (*"**if** the workflow must fill a template"*) and the
rule's own condition is *"(i.e. the user **provided** a .docx to fill)"* — **nothing asserted
provision.** Adding one sentence to `describe` saying a template was attached flipped it 2 of 2.

⇒ **`D-26`**, and a new plan **`193.1-11`** authored mid-phase to fix it. **Measured after the fix:
Call B 0/3 → 3/3 `render_template`, key coverage 3–4/8 → 8/8; the control stays at 0, so the absent
arm is provably no weaker and SC#4 / D-08 still hold by construction.** Driven **in-process**, which
removes the stale-module question more completely than restarting the operator's backend would have.

**⚠ D-19 is CORRECTED in one direction and CONFIRMED in the other — both stated, neither smoothed.**
The rule is real and the control obeys it; but *"names present ⇒ `render_template`"* is FALSE — the
trigger is the assertion of **provision**. **D-19's derived hazard (`no_template_bound`, terminal at
run) was UNREACHABLE while the branch never fired and is now LIVE as of `9cf97033`** — so Plan 07
landing wire+bind together stopped being a principle and became load-bearing. **Do not remove that
guard on the grounds that the hazard was never observed.**

**⚠ A prediction written INTO the UAT file by the orchestrator was itself measured false one wave
later, and is corrected there rather than deleted:** U1 predicted the fix would begin populating the
reconcile's run-input bucket. Measured, `inputs[]` is **`null` on 6 of 6** post-fix runs and slug/name
reach is 0–2 of 8; the 8/8 coverage lands almost entirely inside the emit phase's `prompt`, which is
**not** one of D-20's three bucket sources. **D-20's degenerate-first design STANDS and Plan 09 keeps
its original brief.**

**G-5 honoured, no override.** `193.1-05` cut the pre-draft template concern out of
`WorkflowBuilderPage.tsx` **before** the feature that needs it (the 192.1 D-01 order). **The proof
held: `git diff --numstat` EMPTY across all six characterization captures and both nine-phase-old
byte-exact pins (`header.test.tsx:382`, `describe.test.tsx:307`) — ZERO re-capture**, verified
independently on the merged tree. Subtree **2073 → 2324 (+12.1 %)**, the **smallest of this project's
five cuts** (188.2 +67 %, 192 +126 %, 192.1 +53 %, 193 +124 %) because one concern landed in one
module rather than five-plus; COMMENT is **73 %** of the growth — prose dominant for the fifth cut
running.

**⚠ THE GSD SDK STATE VERB CORRUPTED `STATE.md` AGAIN, and this is the sixth-plus recorded instance.**
Inside `193.1-05`'s worktree a `state.*` verb **deleted `stopped_at` (~9 KB of this phase's locked
decisions), dropped `resume_file` and injected a stale `last_activity` — while reporting
`"updated": true`.** The two verbs that *failed* failed honestly; the one that claimed success did the
damage. Reverted; integrity re-verified by re-parsing the YAML (8 keys, `stopped_at` 9701 chars).
**Every STATE.md edit this phase was made BY HAND. Do not call `state.*`.**

**⚠ THE WRONG-BASE BUG IS NOW 6 FOR 6 ON THIS PHASE** (instances 13-18 project-wide). Every worktree
arrived at `fda79214`, the `master` merge tip, instead of its dispatched base; every one was caught by
the `git merge-base --is-ancestor` assertion in the executor prompt and reset. **That assertion is the
only thing standing between this phase and a set of baselines that prove nothing.** Keep it in every
prompt.

**⚠ `GSD_VITEST_MAX_WORKERS=2` IS NO LONGER DETERMINISTIC EITHER — the cap-2 rule has begun rotting
exactly as cap-4 did.** `193.1-01` measured, on ONE identical tree at 3620 gated cases: **`failed 3`,
then 0, 0, 0** — `STACK_TRACE_ERROR` timeouts, reproduced zero times. 2 remains the best value; it is
no longer a guarantee. **Capture failing filenames BEFORE re-running.**

**Other findings worth not re-deriving:** a shipped pin credited in THREE places
(`test_grounding_bundle_has_no_template_read_axis`) **passed under a real plant** — it asserts the
absence of *fields*, and `degraded.add("template")` adds no field; a permanent positive control was
added beside it. `193.1-02` found three of its own plan's acceptance criteria unsatisfiable as
written, including a `grep` that would have forbidden the new route's docblock from naming
`get_supabase` to explain why it must never take one. `193.1-05` had to re-scope a fence **outside**
its `files_modified` (187-22's adjacency assertion in `canvas.test.tsx`) across the seam — **re-scoped,
not weakened**, where deleting the adjacency half was the easy fix and would have retired the guard.

**⚠ Ledger rows owed at close (all measured, all stale in `CLAUDE.md`):**
`backend/app/api/workflows.py` **34 commits / 1951 L** (cell says 32/1813; CONTEXT D-01's own
re-measurement of 33/1813 is already stale too) · `backend/app/services/harness/grounding.py`
**16-17 commits / 5 phases / ~1190 L** (cell says 15 / 1150→1186) ·
`frontend/src/pages/WorkflowBuilderPage.tsx` post-cut **2045 L**.

**⚠ AUTH-03 is deliberately NOT ticked.** CONTEXT forbids it until a draft is grounded in a real
template's real placeholder keys **and every run fills that same template** — the bind (Plan 07) has
not shipped.

**Owed UAT:** row **U1's operator confirmation** (the assistant drove it under standing delegation;
artifacts are recorded in full so confirming is a reading task, not a re-run) · rows **U2, U3, U4**
after Plan 08. ⚠ **Phase 193's OWN owed rows U1/U2 are NOT discharged by any of this.**

**Waves 3-7, in one line each.** `06` the governed words + `DescribeTemplateRow` + the client — ⚠ **`SWEPT_SOURCES` needed 6 entries, not the plan's 5: the plan counted the new component and not the new VOCABULARY MODULE created in the same wave, leaving the higher-risk file unswept, and that sixth entry is the one that fired** (the WR-01 shape exactly). `07` **the wire AND the bind in ONE COMMIT** (`02606a08`) — no commit exists where the wire is present and the bind is not, so D-19 is satisfied by construction rather than by sequencing discipline. `08` both mounts + the hand-off crossing, via the SHIPPED `initialProjectFolderId` mechanism — no store, no context, no global — with **ten re-captures DECLARED, `removed: ""` on every row** (pure insertions; not one captured byte dropped). `09` the three-bucket name check as its own component, ONE gated line at `PhaseFormPanel.tsx:1116`, panel diff **+31/−0** with zero added `useMemo`/`useState`/`useEffect`/`.filter`/`.map`. `10` close-out.

**⚠ FOUR FENCES WERE FOUND THAT COULD NOT FIRE, and every one was found by PLANTING a failure rather than by reading.** (1) `test_grounding_bundle_has_no_template_read_axis` **passed** under a planted `degraded.add("template")` — it asserts the absence of *fields* and a set member adds no field — yet it is credited in THREE places with defending that rule. (2) The missing `SWEPT_SOURCES` entry above. (3) Plan 07's own test harness was **swallowing the callback's return value**, so its rejected-promise case had been defending nothing. (4) Plan 08's capture harness leaked state between arms and would have baked a baseline of the **error** DOM as if it were the composing DOM. **The standing lesson: a fence is only real once you have watched it fail.**

**⚠ A capture of a DELEGATING component sees its delegate's markup.** The orchestrator instructed plan 08 that the `GOVERN_*` baseline rows must not move; **that was FALSE** — the govern door *is* the Builder (`WorkflowDoorSwitch.tsx:182-223` returns `<WorkflowBuilderPage>`), so both `GOVERN_*` whole-`innerHTML` rows moved by exactly the same **+1015 chars / +11 tags** as the `DESCRIBE_*` ones. That byte-identical span across ten rows in two independent suites is also the strongest available proof the two mounts are the same control.

**⚠ Ledger corrected at close — five rows, all re-derived, one rewritten.** `WorkflowBuilderPage.tsx` **40/11/2252** · `workflows.py` **34/17/1951** · `grounding.py` **18/5/1252** · `WorkflowDoorSwitch.tsx` **12/8/522** · `PhaseFormPanel.tsx` **16 commits / 8 phases / 1167 L** — that last row was **wrong in BOTH directions**, naming a **phase 140 that never touched the file** and omitting five that did. ⚠ **Two figures written by THIS PHASE were already stale when written** (CONTEXT D-01's `33/1813`, D-22's `15/7/1136`), corrected beside their originals.

**⚠ THE PAGE GREW EVEN THOUGH IT WAS EXTRACTED, and the two facts must not be quoted as one:** `2073 → 2252`. The cut removed 28 lines; waves 4-5 then added ~207 (the wire, the bind, both mounts). Subtree `2073 → 2324 (+12.1 %)` — the **smallest of this project's five cuts** (188.2 +67 %, 192 +126 %, 192.1 +53 %, 193 +124 %), because one concern landed in ONE module rather than five-plus.

**Guardrail overrides: NONE recorded for Phase 193.1** — G-5 fired on three files
(`WorkflowBuilderPage.tsx` extracted; `workflows.py` third door in a block it already owns;
`PhaseFormPanel.tsx` own-component-one-gated-line) and all three were honoured. A waiver was offered
at discuss time and declined (D-01); that absence is a measurement.

**Prior:** PLANNED 2026-08-14 (`5892e6c4`, fixes `ceb96dea`) — 10 plans in 7 waves; **11 after D-26
forced `193.1-11`**.

### Phase 193.1 — PLANNED (2026-08-14): the five things a later reader should not re-derive

**10 plans / 7 waves · plan-checker `ISSUES FOUND` at 0 BLOCKERS / 2 warnings, both applied before
this was written** (the D-14 fence-scope exclusion in `193.1-09` is now GUARDED rather than asserted;
`193.1-RESEARCH.md`'s Open-Questions heading now carries its RESOLVED map). **`AUTH-03` on all 10
plans. Decision coverage 21/21.**

⚠ **The decision-coverage gate returned a VACUOUS PASS again** — `{"passed":true,"skipped":true,
"reason":"no trackable decisions","total":0}` — the identical failure Phase 193 recorded, because the
parser wants literal `D-NN` tokens and this CONTEXT bolds them. **Re-run by hand: 21 defined
(D-01…D-14, D-19…D-25), 21 covered, 0 uncovered.** Do not read that gate's green as evidence.

**1. ⚠ RESEARCH OVERTURNED THE PHASE'S CENTRAL ASSUMPTION: `template_placeholders` FLIPS A BRANCH,
IT IS NOT A HINT.** `AUTHORING_SYSTEM_PROMPT` (`workflow_authoring.py:82-91`) carries a *"DELIVERABLE
RULE (CRITICAL)"* whose **entire condition** is the grounding section rendered at
`grounding.py:576-577`: names present ⇒ `llm_emit`/`render_template`; **absent ⇒ the deliverable MUST
be plain text and `render_template` is FORBIDDEN.** So today every draft is *actively steered away*
from templates — that is the mechanism behind SEED-157, not merely a missing parameter. And an
unbound `render_template` draft is **terminal at run** (`no_template_bound`, `phase_types.py:1271`).
⇒ **D-06's auto-bind is load-bearing for CORRECTNESS, not just for AUTH-03's wording: shipping the
wire without the bind would produce drafts strictly WORSE than the blind ones they replace.** Plan 07
holds both **in the same TASK**, not merely the same wave.

**2. ⚠ THE APPROVED MOCKUP AND THE PHASE'S TARGET FILE WERE TWO DIFFERENT COMPONENTS — found by
pattern-mapping, invisible to CONTEXT and to RESEARCH.** There are **two** pre-draft describe
screens, both rendering a KB picker, a describe box, the same CTA-group class and the same hint:
`WorkflowDoorSwitch.tsx:227-380` (the FAST door — CTA at `:305-315` is a **handoff, no network
call**) and `WorkflowBuilderPage.tsx:1533-1615` (the GOVERN door — **the only `/generate` caller**).
**Sketch 165 dumped the first; every CONTEXT pointer targets the second.** ⚠ **The splice anchor
`<div className="flex flex-col items-center gap-3">` occurs in BOTH files** — it was unique within
the sketch's *dump*, which is all `build.cjs` ever asserted, so a plan reading the sketch contract
can land on either surface and both look right. **Operator ruling D-24: mount on BOTH, build once,
carry the read across the handoff via the SHIPPED `initialProjectFolderId` precedent
(`WorkflowDoorSwitch.tsx:202-209`, added 187-26 for the identical problem) — not a new mechanism.**

**3. ⚠ D-10's BUCKETS RESTED ON A FIELD THAT DOES NOT EXIST, AND THE DEGENERATE CASE IS THE COMMON
CASE.** `output_keys` is **not a schema field** (all seven phase configs are `extra="forbid"`; **0 of
223** live rows carry it; it survives only as dead `getattr` at `reachability.py:85`), and
`input_keys` exists on `ProgrammaticPhaseConfig` only and means *keys a step READS* — a category
error for the run-input bucket. Re-sourced (**D-20**) to phase **slugs** + `WorkflowDefinition.inputs[].key`.
⚠ **Measured: across all 74 template-binding definitions, ZERO slugs match any known placeholder** —
slugs are verbs (`retrieve` ×70, `emit` ×69), placeholders are nouns — so the buckets render
**0 / 0 / ALL** today. D-10 called being told *twice* that a correct workflow is broken a red line;
measured, the author is told **eight times out of eight**. Also: **sketch 167's fixture is invented,
not derived** (its `retrieval` / `llm_analysis` are not real phase types) — **CONTEXT elevated a
fixture's premise into a measured claim, and that is the drift.** Plan 09 forbids that fixture shape
by `grep`.

**4. Four more plan-time decisions, recorded as `D-19…D-25` in `193.1-CONTEXT.md`'s dated amendment
section** (the original 14 left standing, not rewritten): **D-21** reword the NEW control, never the
shipped governed `STARTER_DOOR_LINE` (⚠ the collision is measured on the **Builder's** screen only —
the sketch's own screen has no starter picker); **D-22** ⚠ **G-5 fires on a THIRD file** —
`PhaseFormPanel.tsx` measures **15 commits / 7 phases / 1136 L** against a ledger cell reading
*"140/183/184/185 — 1095 L"*, **wrong in both directions** — honoured by construction as its own
component + one gated line; **D-23** SC#2 **is provable** (`resolve_authoring_model` falls through to
`claude-opus-4-8`, `forced_emission: True`, key present) and its live call is sequenced **EARLY** as
Plan 04, not at the phase gate; **D-25** `useWorkflowFork.ts` is the right analog for the MODULE and
the **wrong** one for the STATE MACHINE (it has no `loading`, no `AbortController`, no staleness
rule) — `useTemplatePlaceholders.ts` is.

**5. ⚠ NO GUARDRAIL OVERRIDE IS RECORDED FOR PHASE 193.1, AND THAT ABSENCE IS A MEASUREMENT.**
G-5 fired on **three** files and all three were honoured: the extraction ships FIRST (Plan 05,
wave 2, before Plans 06-09); `workflows.py` gets a third door in the template block it already owns;
`PhaseFormPanel.tsx` gets one gated line. A waiver was offered at discuss time and **declined**
(D-01). G-1 does not fire. **The phase owes `PhaseFormPanel.tsx` a corrected ledger row at close**,
exactly as 193 owed `WorkflowDoorSwitch.tsx` one.

⚠ **Two plans are `autonomous: false` — `193.1-04` (the live `/generate` checkpoint, which also
carries a `checkpoint:decision` on two 167-C strings) and `193.1-10` (close-out + UAT).** Both run
against the **primary tree**, not a worktree.

**⚠ Phase 193 is STILL NOT COMPLETE and still owes UAT rows U1 and U2. Opening 193.1 does not
discharge them** — its position is preserved verbatim immediately below, unedited, so a reader
cannot mistake a new phase starting for the old one finishing.

### Phase 193.1 — guardrails, settled at discuss time

**G-5 fired on TWO files and was HONOURED. An override was OFFERED AND DECLINED — there is NO
guardrail override recorded for Phase 193.1, and that absence is a measurement, not an omission.**

| File | `CLAUDE.md` cell said | **Measured 2026-08-14** | Ruling |
|---|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 33 commits / 2055 L | **34 / 2073** | gains a genuinely **sixth** concern ⇒ **extraction ships FIRST**, in an early wave, before the feature (the 192.1 D-01 order) |
| `backend/app/api/workflows.py` | 32 commits / 1813 L | **33 / 1813** | gains a **third door in the template block it already owns**, twenty lines from its two siblings ⇒ honoured by construction, obligation inherited forward |

⚠ **Both ledger cells were stale by one commit** — the corrected figures are above; re-derive with
`git log --oneline -- <file> | wc -l` and `wc -l <file>` rather than re-reading the cell.
**G-2 SATISFIED** — sketches 165/166/167 are the acceptance bar; winners **165-C** / **166-B** /
**167-C** (`.planning/sketches/MANIFEST.md`).

**⚠ The finding the sketches could not see, and it is what makes AUTH-03 tickable: NONE of the four
ROADMAP success criteria mention the FILL.** A phase that stops at reading the placeholders passes
all four and still leaves AUTH-03 unmet — the exact trap Phase 193 fell into. Hence **D-06,
auto-bind on first save.** Measured on the wire: `template_asset_id` is typed `UUID` while asset
ids are Storage **paths** (a 422), so `template_placeholders` is the **only** wire that works from
the browser and the read cannot be folded into the bind.

---

**Phase (193, carried forward unedited):** **193 Authoring Doors + Template Placement — EXECUTED 2026-08-14, NOT YET COMPLETE**
**Plan:** **10 of 11 plans have a SUMMARY.** `193-11` (the operator UAT checkpoint) is PART-DONE: its Task 1 and Task 3 are written, its Task 2 is 6 of 8 rows.
**Status:** ⏸ **ALL GATES RUN AND GREEN — blocked on human evidence, not on code.** `tsc -p tsconfig.app.json` **33 (baseline, unmoved all phase)** · count gate **exit 0 · total 3561 · failed 0 · 67/67 pinned** · code review **11 findings, ALL resolved** (10 fixed, 1 ruled+seeded) · security audit **50/51 closed, 0 code threats open** · verification **`human_needed`, 1/3**.
**NEXT = drive UAT row U1, then U2**, with a person who has not used the Builder (`193-UAT.md`). Nothing else is owed by the code.

**⚠ THE PHASE IS DELIBERATELY NOT MARKED COMPLETE.** `phase.complete` was NOT called. Marking it
would write `[x]` against a phase whose headline claim — *the two doors are tellable apart* — has
no evidence, and this project's STATE.md has been corrupted five times by verbs that wrote
optimistic records. **1 of 3 success criteria verified is the honest number.**

### Phase 193 — the four gates, run 2026-08-14 (all after execution, none skipped)

| Gate | Verdict |
|---|---|
| **Code review** (`193-REVIEW.md`) | 0 Critical / 8 Warning / 3 Info — **all 11 resolved**: 10 fixed in code, WR-04 ruled ACCEPT+SEED. Scoped from `git diff`, NOT from SUMMARY `key_files` — the default would have missed `WorkflowBuilderPage.tsx`, the least-reviewed file in the phase. |
| **Security** (`193-SECURITY.md`) | **50/51 closed, 0 code threats open.** The provenance claim was RE-TRACED TO CODE (`workspace.py:281` → `template_asset_service.py:197` → `tool_dispatcher.py:3320` → `template_render_service.py:947-951`, `assert engine != "docxtpl"`) rather than string-matched. T-193-48 was a blank-field gap, closed by marking U1/U2 ⛔ per the UAT file's own rule. |
| **Verification** (`193-VERIFICATION.md`) | **`human_needed`, 1/3.** Reached independently rather than by trusting this file. |
| **G-7** | **CLEAR** — `plans: 11 total · 0 gap-closure`, exit 0. Zero fails to route; no round opened. |

**⚠ THE MOST IMPORTANT SINGLE FINDING — `SEED-156`, measured not impressionistic.** Comparing this
phase's own committed captures node by node, **`GOVERN_STANDALONE` shares 11 of its 14 text nodes
with `DESCRIBE_STANDALONE`**: below the header strip the two authoring doors open onto **the same
screen**. Someone who picks *"you decide every setting"* is shown a box asking them to describe the
goal, under *"the AI writes the steps, sets how strict it is"* — door A's promise, on door B.
**It was NOT caused by the phase's fast-fix** — before it the same two screens read
`Draft the workflow`/`drafts the phases` against `Write the first draft`/`writes the steps`:
synonymous words on an identical screen. The fix removed the cosmetic difference and made the
duplication legible. **No copy was authored in response**, because G-2 requires a sketch and
sketch 164 draws no mockup of either pre-draft screen; the instrument that settles it is U1/U2.

**Review findings worth carrying forward:** WR-01 — the D-24(a) copy fence swept two files while
`WorkflowBuilderPage.tsx` had become a third consumer, so **the exact regression the phase closed
could have recurred with every gate green**; fixed and DRIVEN RED. WR-05 — `templateAdmission`
returned a POSITIVE `does-not-admit` for a `config`-silent phase list, inverting D-20; fixed and
driven RED. WR-07 — nothing pinned the jsonb string scalar, **the shape 194 of 223 live rows
carry**; now pinned.

### ⚠ Phase 193 — why it is NOT complete, stated so a later reader cannot mistake green gates for a delivered phase

**SC#1 and SC#2 are NOT verified, and nothing in the repository can verify them.**

| SC | What must be TRUE | Decided by | Status |
|---|---|---|---|
| SC#1 | a person who has not seen the Builder can predict what each door does before clicking | **U1** | ⏸ **owed** |
| SC#2 | the number of perceived choices does not increase | **U2** | ⏸ **owed** |
| SC#3 | a user with a template to fill can find where to supply it | **U4** pass (+U5) | ✅ verified |

Both open criteria are, by their own wording, properties of *a person's* prediction and *a person's*
count. **3557 passing frontend cases cannot stand in for either.** The phase's headline claim — the
two doors are tellable apart — is therefore **not yet evidenced**, and six other rows passing does
not change that.

**UAT tally: 6 driven · 5 pass · 1 partial · 0 fail · 2 owed** (`193-UAT.md`, commits `18404fe5`,
`cd94618b`). Driven in Chrome against the operator's real library at `eb7f7e5e` — 107 identity lines
rendered, 145 published / 78 draft.

- ✅ **U3** — driven at **BOTH** `visual_workflow_canvas` values, and D-05's conditional is proved in
  **both directions**: `ml-auto` is **absent** on the badge in the merged row and **present** in the
  standalone band (gap label→badge 95 px vs **937 px**). Driving only one value would have reported a
  pass while half the shipped behaviour went unmeasured. The flag was flipped through the Control Room
  UI (not SQL — the settings sync-cache has no staleness check) and **restored to its exact recorded
  pre-test value** `{"roles": [], "groups": [], "audience": "everyone"}`.
- ✅ **U3b** — the describe band's escape classes are **byte-identical** to the govern band's;
  `dividerCount: 0` where there is no third peer to divide from.
- ✅ **U4** — both halves. The provenance sentence matched **byte-for-byte** against
  `RunModal.tsx:429`. The non-admitting modal has `fileInputCount: 0` and `orphanSeparators: 0` —
  shorter, not damaged, so D-17's claim holds at the surface.
- ✅ **U6** — the card says `Build it myself`, the strip says `Build it myself`.
- ✅ **U7** — a blocked `POST /threads` produced a **visible `role="alert"`** on a workflow with **no
  template control at all**. This is the WR-03 class defect Phase 192 had to repair on this very
  surface; a naive hide would have silenced every non-template launch failure. It does not.
- ◐ **U5** — structure/placement/treatment pass and are proved (`<span>needs a template</span>` with
  **no class attribute**, index 2 per D-14, 5 of 107 rows). Its verdict turns on whether it reads as a
  **requirement of you**; that is a reader's property. Becomes a fail if a reader concludes the
  unmarked rows definitely need no template — D-15 failing at the surface though it holds in code.
- ⏸ **U1, U2** — structurally not the assistant's to drive. Scoring them from an agent that has read
  the source would be the check-that-cannot-fail `193-UAT.md` exists to prevent.

**G-7: CLEAR** — `node scripts/check-gap-closure-rounds.cjs 193` → `plans: 11 total · 0 gap-closure`,
exit `0`. **Zero fails to route, so no gap-closure round is warranted and none was opened.**

**Guardrail overrides: NONE recorded for Phase 193.** G-5 fired on `WorkflowDoorSwitch.tsx` and was
**honoured by construction** (the extraction `193-03` shipped BEFORE the feature that needed it), so
no override was required and D-09 declined to record one.

**Hot-file ledger, re-derived at close by `193-10` (do not quote — re-derive):**
- `WorkflowDoorSwitch.tsx` — **11 commits / 7 phases / 426 L.** The row G-5 never had: this file was
  ABSENT from the `CLAUDE.md` ledger for six phases, which is why the guardrail never fired on it.
- `library/WorkflowCard.tsx` — **8 commits / 3 phases / 818 L. G-5 now FIRES.** The next phase to
  touch it owes a refactor recommendation FIRST.

**⚠ One operator-approved change landed mid-phase that no plan owned** (`294a2ac8`): `193-08` found a
SECOND, ungoverned copy of the describe screen's words in `WorkflowBuilderPage.tsx`. Four strings were
predicted; **five were found** (`DESCRIBE_H1` too, caught only by sweeping the page programmatically
against all 21 governed values). It redded **24 cases across five suites** — a red `193-08` had
PREDICTED IN WRITING in `WorkflowBuilderPage.describe.test.tsx`'s docblock, which is the only reason
those reds could be trusted as the fix working. **A literal-only sweep cannot see a regex query**: the
first sweep missed two sites querying `/draft the workflow/i`. This change is the least-reviewed code
in the phase and is the reason `/gsd:code-review 193` matters.

**⚠ Environmental finding for the next phase — the vitest worker cap is now wrong in `CLAUDE.md`.**
`GSD_VITEST_MAX_WORKERS=4` was calibrated at ~3400 gated cases for TWO concurrent agents; the gate now
executes **3557**. On one identical commit it reported, in order: cap 4 → **17, 4, 3** failures;
UNCAPPED → **11**; **cap 2 → 0 and 0**. Every failure was `STACK_TRACE_ERROR` (a timeout, never an
assertion), in files no plan touched, each passing IN ISOLATION at full green counts. **Use
`GSD_VITEST_MAX_WORKERS=2`.** The gate remains non-deterministic under load on
`WorkflowsPage.test.tsx` — worth a seed, not a phase defect.

**Deferred triggers checked at close:** BUG-260813-01 **not fired** (still `open`, routed to
`/gsd:fast`); D-06 breadcrumb move **not fired**; `WorkflowCard.tsx` refactor **FIRED** (now armed for
the next phase); D-10 vocabulary merge **FIRED and SPENT** — `doorVocabulary.ts` is confirmed the
**fourth** `*Vocabulary` module (`door`, `library`, `phase`, `run`), and the deferral was still judged
right because merging them mid-phase would have put a shared module under a words-only proof.

### Phase 193 — PLANNED (2026-08-13): the four things a later reader should not re-derive

**11 plans / 7 waves, `VERIFICATION PASSED` with 0 blockers and 2 warnings, both closed before this
was written** (the RESEARCH open-questions heading now carries its `RESOLVED` map; `193-11` now
carries an explicit `<worktree_protocol>` saying it runs against the **primary tree**, because its
instrument is a running dev server on the operator's machine, not a file checkout).

**1. ⚠ RESEARCH OVERTURNED AUTH-03'S PREMISE, AND THE OPERATOR RE-DECIDED IT AT PLAN TIME.**
The BUILD-CONTRACT, the sketch README and CONTEXT's own `<canonical_refs>` all describe the fill
signal as *"admits `render_template` in the phase tool whitelist"*. Measured over **223 live
definitions: ZERO carry it.** A predicate written to the contract's letter would have marked nothing
at all. The live signal is `phases[].config.phase_type == "llm_emit"`.
Underneath that sat the expensive half: `_exec_llm_emit` → `resolve_template_source` **returns
unconditionally on Branch 1** (`template_asset_service.py:144`) whenever the definition binds a
library template in `assets[]`, and **nothing clears `asset_ref` because a user uploaded something**.
So on the 16 published rows that bind one, the run-time upload is **unreachable code** — `Template to
fill` would promise what the engine discards.
⇒ **D-21: the predicate is P2 + an unknown arm** — admits ⟺ an emit phase is present **AND** no bound
`assets[kind=="template"]`; `phases: []` ⇒ `unknown` (110 of 145 published rows, so without that arm
D-17 would strip a shipped capability from three-quarters of the library on the strength of a stub).
Live scoring: **1 admits / 34 does-not-admit / 110 unknown.**
⚠ **THE COST IS RECORDED, NOT SMOOTHED: the card mark is visible on exactly ONE published row —
`ephemeral-template-fill-101uat`. UAT rows U4 and U5 MUST be driven against that slug** or they
cannot see the feature at all. `P1′` (17 rows) was rejected twice over: false on 16 of them, **and**
byte-for-byte the same predicate as `soulDeliverable`, which already drives the shipped *Makes a
file* chip — a second word for a fact the surface already states, against SC#2.

**2. Four more plan-time decisions, all recorded as `D-22…D-25` in `193-CONTEXT.md`'s dated
amendment section** (the original 20 left standing, not rewritten): the D-04 restack applies to
**both** bands, describe getting the demotion without a divider (**D-22**); `strip.labelGovern`
becomes the **21st** governed COPY id with the string `Build it myself`, added to `build.cjs` and
regenerated rather than typed into JSX (**D-23** — it was the one surviving instance of the exact
wording SEED-147 calls illegible); both new modules ship **with fences** (**D-24**); and
`templateAdmission()` lives in `soulData.ts` as a **three-state union, never a boolean** (**D-25** —
a boolean cannot express D-20's deliberate asymmetry).

**3. ⚠ TEN INHERITED CLAIMS MEASURED FALSE across research and pattern-mapping, all encoded in the
plans so no executor re-discovers them.** The four that would each have cost a wave:
`libraryVocabulary.ts` is the **wrong analog** (`runVocabulary.ts` is — same directory, and
`libraryVocabulary` cites it as *its* precedent and has no suite at all); the **188.2 two-badge
ceiling guards the CANVAS `PhaseNodeCard`, NOT `library/WorkflowCard.tsx`** — there is no badge
ceiling of any kind under `library/`, so D-13's plain-text ruling stands on **SEED-155 / U8 grounds
only** and **no plan may claim a typecheck enforces it**; `launchError` is **not template-only**
(`RunModal.tsx:198` sets it on *any* `onRun` rejection and its node sits **inside** the wrapper D-17
removes — hiding it naively reproduces WR-03 on the surface 192's gap round already repaired); and
`definition` is a jsonb **string scalar on 194 of 223 rows**, so `definition->'phases'` silently
returns nothing.

**4. ⚠ THE LANDMINE CONTEXT NEVER NAMED:** `frontend/src/pages/WorkflowBuilderPage.header.test.tsx:304`
holds a **byte-exact `innerHTML` literal of the entire `doorGroup` band**. Waves 2–3 must keep it
green with **ZERO edits** — it predates this phase by nine phases, so an unedited pass is a *stronger*
move-proof than any baseline 193 could author for itself. Waves 4 and 5 will red it once each
(copy, then structure); both re-captures are labelled "1 of 2" / "2 of 2" in the plans and must be
stated in the SUMMARYs, never quietly absorbed. Three further suites outside `components/workflows/`
also assert door copy; all are in `files_modified`.

### Phase 193 — the context it was planned from (2026-08-13)

**G-2 is SATISFIED.** Sketch 164 (`telling-the-doors-apart`) is the acceptance bar; the operator's
pick is **variant D — "the mix"** (B's door NAMES + C's two TIER labels), committed at `20ca7cf7`
together with the ruling that **the header-strip restack is IN SCOPE**. D is **derived** in
`build.cjs` (`D_FROM_C`), never re-typed — audit **18 matched / 0 missed** against the real
`WorkflowDoorSwitch` DOM.

**`193-CONTEXT.md` — 20 decisions** (`48ad67fd`). The four that a later reader should not re-derive:

- ⚠ **G-5 FIRES on `WorkflowDoorSwitch.tsx`, and the file was ABSENT from the CLAUDE.md ledger** —
  measured **8 commits / 6 phases** (124, 155, 184, 184.1, 186, 187) / **385 L**. The identical
  failure to `WorkflowsPage.tsx` escaping G-5 for ten phases: the audit scans `files_modified`
  *against the table*, so a file missing from the table is invisible to its own guardrail.
  **193 owes it a ledger row at close.** **HONOURED BY CONSTRUCTION, not waived** — the sketch's
  build contract already requires the vocabulary module, so wave 1 is a pure move with baselines
  captured on the UNMOVED tree and wave 2+ applies the copy. **No override is recorded.**
- ⚠ **AUTH-03 needs NO backend change — measured, not assumed.** `definition` is already projected
  on the wire (`backend/app/db/workflows.py`) and the card already derives its tier from it. The
  **opposite** of Phase 192's D-04 surprise.
- ⚠ **The two unknown-fallbacks are OPPOSITE ON PURPOSE** (D-15 vs D-20). Card: absent `definition`
  renders **nothing**, indistinguishable from "does not admit" — absence must never read as a claim.
  Run modal: absent `definition` renders the control **exactly as today**, because hiding on unknown
  would silently strip shipped WFIN-01 from a user who cannot know it existed. ⇒ **the predicate
  must be THREE-STATE, not boolean.** Do not "fix" this into consistency.
- **The card mark is PLAIN TEXT, never a chip** — the card structurally forbids a third badge
  (`@ts-expect-error` pinned, 188.2) and `SEED-155` exists *because* sketch 163 drew a chip the card
  could not render (UAT U8).

⚠ **This discussion is the SECOND attempt. The first was lost entirely to a laptop restart** — the
session died on the sketch's `AskUserQuestion` and **nothing reached disk**: no commit, no file, no
transcript message, no subagent dir. Nine recovery angles searched; the work was **never written**,
not deleted. The two operator answers were therefore committed BEFORE the discussion re-ran.

**Ledger drift found while measuring:** the `WorkflowCard.tsx` row reads `6 commits / 721 L`;
measured **7 / 747**. 193 makes it the card's **3rd phase**, arming G-5 for the phase after.

**Prior:** Phase 192.1 Workflow Identity ✅ CLOSED 2026-08-13 (8/8 plans, 7 waves, LIB-05 satisfied,
UAT 9/9 driven, `threats_open: 0`, U8 accepted → `SEED-155`) — detail below.

**The close, in one line each:** LIB-05 satisfied · 9/9 UAT rows driven (7 pass, 2 fail) · U7's fail
fixed same-day under G-3 · **U8's fail STANDS**, its in-scope half accepted → `SEED-155` · security
`threats_open: 0` with E-1/E-2 repaired and E-3 open by decision · G-5 honoured in the order D-01
requires (the extraction shipped Wave 3, *before* the feature it made room for) · ⚠ **no
`192.1-VERIFICATION.md` exists.**

⚠ **192.1 WAS ABSENT FROM THE ROADMAP CHECKLIST ENTIRELY UNTIL THIS CLOSE** — the list ran
192 → 193 while an eight-plan phase executed between them, exactly as **188.2** was missing at the
v3.6 close. Added as `- [x]` in the same commit. A phase missing from its own checklist is invisible
to every audit that reads the checklist.

⚠ **THIS BLOCK WAS STALE FROM `0b2b7520` UNTIL 2026-08-13, AND THE STALENESS DID DAMAGE RATHER THAN
JUST SITTING THERE.** It read *"⛔ AWAITING THE OPERATOR. Drive `U1…U9` … The phase is NOT complete
and NOT verified"* — written **before** the drive, and left unedited through the four commits that
performed it (`8b34eb69`, `a20414ab`, `773e6365`, `5646d043`). The consequence is recorded because it
is the whole reason this file matters: at the close of `/gsd:secure-phase 192.1` the orchestrator
emitted `▶ /gsd:verify-work 192.1 — U8 is the owed row`, which was **wrong twice over** — the UAT was
complete, and U8 was not *owed* but **driven and FAILED**. The operator caught it (*"I think we
already verified work why you are proposing it again"*). **A state file that describes work already
done manufactures a request to redo it.** This is the same class as the v3.6 close, where a stale
checklist read `184 | 1/13 In Progress` thirteen days after 184 shipped 13/13.

**G-4 UAT: 9 of 9 rows DRIVEN — 7 pass, 2 fail. Not owed, not deferred, not partial.**
Every row carries a recorded `result:` in `192.1-UAT.md` (`:275, 327, 372, 426, 480, 534, 606, 716,
826`), and D-27 held — no row located its target by id.

| Row | Result | Note |
|---|---|---|
| U1 | pass | SC#1, the row Phase 192 failed. Driven by the **operator**, by reading the screen |
| U2 · U3 · U9 | pass | U3 cross-checked against the database rather than the screen alone; U9 is *"the most decisive row in this file"* |
| U4 | pass | **the answer CHANGED THE PRODUCT** — `1 of 43` read as an index, fixed same-day under G-3 (`773e6365`) |
| U5 · U6 | pass | U6 passes on BEHAVIOUR with its **disclosure half recorded NOT VERIFIED** — carried, not hidden |
| U7 | **FAIL on salience → FIXED same-day** under G-3 (`5646d043`, one `className`) | wording half accepted, no change |
| U8 | **FAIL — stands, unrepaired** | driven by the **operator** with sketch 163 open beside the live library; two screenshots captured |

**U8 is a taste fail, not a breakage fail, and three of its four complaints are NOT this phase's
code** — dated by `git log --diff-filter=A`, which changes only WHERE a fix goes, never whether the
complaint is valid: the 2-bare-line cards and the description hero are **Phase 124**
(`PhaseSpine.tsx:50` — `showNames = scale !== "card"`, created `c5a6c610` 2026-06-27, seven weeks
before the sketch was drawn); the toolbar/create-button styling is **Phase 192**
(`LibraryToolbar.tsx`, `2dd9b748`). Every mechanical `fail:` condition measured green at 1536 px
**and** at 375 px true device emulation (0 of 108 collisions, 0 clipped, no horizontal scroll).

**192.1's own in-scope half of U8 is small and is THE ONE OPEN PRODUCT DECISION: the counter lost its
CHIP treatment.** The mockup renders `1 of 2` as a bordered pill; the build renders plain inline
text. ⚠ **It is not a free restyle** — U4's fix widened the string to `43 share this name`, roughly
**four times** the mockup's width, so the pill must hold a phrase it was never drawn for. Root cause
is **sketch→build drift and it is structural**: sketch 163 hand-wrote its own CSS and drew an atom
the card **cannot** produce, because the card consumes `WorkflowSoul scale="card"` UNCHANGED by
explicit decision. The acceptance bar and the build disagreed from the moment the sketch was approved.

**Security: `/gsd:secure-phase 192.1` COMPLETE — `threats_open: 0`** (`192.1-SECURITY.md`, `9a3df6f8`).
29 entries across 8 plans (24 mitigate CLOSED · 4 accept logged as ARL-01…04 · 1 n/a), audited in
**verify-mitigations** mode at HEAD `5646d043` because all 8 PLANs carried a parseable
`<threat_model>`. Every SUMMARY claim was re-verified independently rather than believed. It found
**three DURABILITY holes where the property held but nothing defended it** — the Phase-190 CR-01
shape. **E-1 and E-2 are CLOSED under G-3** (`15472e7c`): T-192.1-16's register claimed the `[rows]`
memo key was *"grep-asserted"* and it was not (the only hit in any test file was a **comment**), and
the subtree non-vacuity guard proved only **3 of 12** modules load. Both driven RED against real
plants; **E-2's plant showed the four `it.each` sweeps passing green against the empty string.**
`tsc` unmoved at 33; count-gate pin 117 → 118. **E-3 (INFO) is OPEN by decision** — the `forkFailed`
shape has no fence at its new home in `useWorkflowFork.ts`; routed to the next phase touching it.

**⚠ NO `192.1-VERIFICATION.md` EXISTS.** Phase 192 closed *verified 6/6*; 192.1 has **no
goal-achievement record at all**. That is a missing artifact, stated rather than implied — and per
the v3.6 close, 9 requirements once rode on 3 missing VERIFICATION.md files.

**NEXT = decide U8's counter-chip half** (restyle to a pill that fits `43 share this name`, or accept
the plain-text counter and record it as a deviation with its reason). Then the phase can close.
`/gsd:verify-work 192.1` would produce the missing VERIFICATION.md, but **its UAT half is already
done — do not re-drive the nine rows.**

Prior position (Phase 192, closed 2026-08-12):

**`192-15` — a fork click that fails now says so, on both handlers.** WR-03: `catch (e) {
console.error(…) }` and nothing else, which is why the operator's *"nothing happened, even the
card's still the same"* was **literally accurate**. One piece of state (`forkFailed`), one
`role="status"` node (`library-fork-failed`) in the region that already hosts this page's failure
banners, two catch blocks. **Both** handlers, because `onTweak` and `onUseStarter` share ONE WORD on
the card face (D-12) and a person cannot tell which they clicked. It fires on the shape that
actually still fails — Test A drives a published `vendor-risk` with **no** matching draft, i.e. the
2 residual `published + published` slugs `192-14` deliberately did not close.
**`onUseStarter`'s single 409 retry is PRESERVED and now pinned from the inside at exactly two
`createWorkflowDraft` calls — measured RED-side too**, so it provably pre-dates this plan and cannot
be deleted under cover of the repair. Both `console.error` calls survive: the log is the developer's
evidence, the sentence is the person's. `forkFailed` holds a display NAME and a BOOLEAN, never the
error, so no status code or server prose can reach the surface **by signature**. No toast library was
added — this repo has none.
**Driven RED first** against the unedited page (md5 `f2d2af05…` identical before and after): all
four cases failed as real `AssertionError`s (`expected null not to be null` on `library-fork-failed`),
never bare timeouts. ⚠ **That was designed in:** this file's `asyncUtilTimeout` (15 s) is LONGER than
vitest's 5 s per-test budget, so a plain `findByTestId` on the absent notice would have blown the
test timeout first and produced exactly the uninformative RED `192-14` warned about. Each case waits
on the call count (true on both paths) and then asserts the notice under an explicit 2 s budget.
Gates: tsc **33** unmoved, eslint 0 (incl. a11y), fences 64/64, library subtree **223/223**, count
gate **exit 0** capped (`total 3188 · failed 0`).
⚠ **`192-16`'s owed pin raise is now `WorkflowsPage.test.tsx` 40 → 48, NOT the 40 → 44 recorded
below** (192-14's 44 plus this plan's 4), still on top of `192-13`'s `WorkflowCard.test.tsx`
**35 → 39**. `ROADMAP.md` / `CLAUDE.md` / `192-UAT.md` again deliberately not written — `192-16`
owns them. **The U5 UAT row itself is still owed**, with the two slugs to drive it against named in
`WorkflowsPage.tsx`.

**`192-14` — the fork verb stops being a dead button.** `onTweak` now looks the caller's own drafts
up by slug (`draftBySlug`, highest version wins) and OPENS the existing draft instead of minting a
colliding version; nothing is created, so nothing can 409. `onOpenDraft` was relocated ABOVE
`onTweak` **verbatim** (proved by an empty extracted-function diff) because a dep array is evaluated
at render time and a later `const` is a TDZ crash, not a lint warning. `hasExistingFork` is now
passed from the page, so the card's sentence and the verb agree in the same render.
**Driven RED first** against the unedited page (md5 `b7799812…` identical before and after): the
shipped code called `createWorkflowDraft` with `{slug: "vendor-risk", version: 3}`. ⚠ **The only
difference between the new describe and the shipped one above it is ONE EXTRA ROW in the drafts
feed** — that is the whole reason 3176 passing tests never entered this branch.
**The residual is NOT hidden:** re-measured against the live DB, 18 slugs carry >1 version and
exactly **2** (`meridian-risk-summary-good-07aedc33`, `readonly_refusal_098uat`) are
`published + published` with no draft — their fork still 409s, and `192-15` is what makes that
refusal visible. Both are named in `WorkflowsPage.tsx`. Gates: tsc **33** unmoved, eslint 0 (incl.
a11y), fences 64/64, library subtree 219/219.
⚠ **D-192-DEF-01 REFINED by measurement:** the count gate exits **0** when run with
`GSD_VITEST_MAX_WORKERS=4` (and the gate's own 19-file argv runs **3184/3184 green** capped), and
reds `failed 1` / `failed 2` when run uncapped. The cap is a CLAUDE.md rule, not an optional flag —
`192-16` should read this before deciding what to do with that deferred item.
**Owed to `192-16`:** the count-gate pin raise `WorkflowsPage.test.tsx` **40 → 44**, on top of
`192-13`'s `WorkflowCard.test.tsx` **35 → 39**. ROADMAP.md was deliberately not written here —
`192-16` owns it, with `CLAUDE.md` and `192-UAT.md`.

### How 192 verified

Verification scored **5/6** and found ONE gap — the honest-empty-state contract — which the code
review had also found as **CR-01**. It was **closed under G-3 as a fast-fix, not a gap-closure
round** (`60b8842f`), because: G-7 ran **clear** (0 gap-closure plans); **all four ROADMAP success
criteria were already verified**; the offending code was DATED to this phase's own same-day output
(`b4d2f837` / `94a565f4`), which G-7 names as a signal to fast-fix; and the change is one render
branch plus one test with no schema or API surface.

**The defect, worth remembering:** `loading = !anySettled` and a **failed** source counts as settled,
so when all three feeds rejected the page rendered *"You have no workflows yet."* — an affirmative
claim about the user's own data made from evidence we do not have — directly beneath three banners
saying we could not load them. `LIBRARY_STATES["source-failed"]` had been authored in `192-05` for
exactly this state and had **zero consumers**: the vocabulary knew the honest answer before the page
asked for it. **Both existing failure tests reject only `/drafts` and let the other two feeds return
rows, so they never reach the empty-state branch at all — they pin the correct branch without ever
entering the wrong one.** That is the shape of a suite that looks thorough and cannot see the bug.
The new case was driven RED against the pre-fix source (failing exactly on
`queryByTestId("library-empty")`) and the source restored md5-identical before the green run.

**Also from the review, recorded as anti-patterns rather than gaps** (8 warnings, confirmed real,
non-blocking): a by-design 403 on gated `/drafts` shows a permanent un-retryable banner to run-only
users (WR-01); a failed published re-query keeps the PREVIOUS project's rows while `matchesProject`
waves published rows through unconditionally (WR-02); `CHIP_PREDICATES.yours` gates the cascade
delete although its documented degraded default is *assume yours* — right for a chip, wrong for an
authorization-shaped gate (WR-04); both fork handlers swallow failures into `console.error` while the
card's own delete honours "never silent" (WR-03). Two pre-existing bugs inside the verbatim-moved
bodies are labelled as such — fixing them requires re-capturing the move baselines.

**No cross-tenant or RLS defect in the diff** — the backend change is projection-only, predicates
untouched, and the `created_by` fence is load-bearing (exact field set + a serialized-payload sweep
on both handlers).

### Gap-closure round 1 — `192-13` executed 2026-08-11 (the U5 blocker's WORDS)

**Round 1 of 4 plans (13-16). G-7 clear at plan time.** `192-13` gives the library the two facts
the shipped surface could not state: *you already have a copy of this* and *your click failed*.
Three commits — `5bbe0a8a` (vocabulary), `efbd57e3` (the card's state-aware sentence), `f085c29d`
(4 new cases, 39/39). `tsc` **33** unmoved across three measurements, eslint + a11y clean, fences
**64** unmoved by the new copy, library subtree **175 passed**.

1. **The gap was not only the silent 409 — it was the sentence that was ABOUT to become a lie.**
   `FORK_CONSEQUENCE` promises *a new private copy*; under the operator's 2026-08-11 decision a row
   you already forked opens your EXISTING draft. `192-14` changes the verb; without this the card
   would have kept stating a false consequence, which is trading a silent failure for a quiet lie.
   `WorkflowCard` gains ONE optional prop defaulting to `false` — one node, two sentences, selected
   never appended, so no card atom was added (U5-b stays out of the round).
2. **⚠ THE PLAN'S OWN NUMBER WAS WRONG AND WAS CORRECTED IN THE OPEN.** It instructed the docblock
   to record *"16 of the 18"* multi-version slugs as `published v1 + draft v2`. Re-measured against
   the live DB: **18 is confirmed**, but the exact shape is **14** (**15** under a loose predicate
   that admits `pm-weekly-status-report`'s four versions). No predicate yields 16. Sixth phase in a
   row in which an inherited figure measured false.
3. **⚠ THE COUNT GATE IS RED AND IT IS NOT 192-13's — dated, not assumed.** Four runs alternating
   the source state: HEAD `failed 1`, HEAD `failed 1`, **base `7e4abd25` with all three files
   reverted to their shipped bytes `failed 2`**, HEAD `failed 4`. Every failure is
   `STACK_TRACE_ERROR` at **~5000–5500 ms** = vitest's default 5 s `testTimeout`, and all the
   `WorkflowsPage.test.tsx` ones sit in its `search finds a row among 200` describe — a file that
   runs **40 passed / 0 failed in 32 s standalone**. Same class 192-11 hardened elsewhere with
   `asyncUtilTimeout` and 192-12 rated at 2/14 on `WorkflowBuilderPage.canvas`. Logged as
   **`D-192-DEF-01`** in `.planning/phases/192-workflow-library-ia/deferred-items.md`, NOT fixed.
   **The PIN dimension is clean:** no `[count-decrease]`, `pinned total` 3152 unchanged.
4. **Owed to `192-16`:** the `WorkflowCard.test.tsx` pin raise **35 → 39** (read from the gate's own
   `actual`, measured 39 four times), plus the ROADMAP / CLAUDE.md / `192-UAT.md` writes — this plan
   deliberately wrote none of those three files, and `192-13-SUMMARY.md` says so, so the absence
   reads as ownership rather than oversight.

### ⛔ OWED — eleven G-4 UAT rows, NOT run (operator decision 2026-08-11)

**This is a DECISION, not a claim that everything ran.** The operator chose to close with the rows
owed. Record: `192-VALIDATION.md` § Manual-Only Verifications — `0 driven · 0 passed · 0 failed ·
11 owed`, every row ⛔. Threats `T-192-21` / `T-192-32` remain **UNMITIGATED — OWED**.

**Run U6 FIRST** — pick a project; starters must remain **with a stated reason**, and **silence is a
FAIL**. It exists because of a measured IA defect under D-17 that no structural test can catch; the
outcome must quote exact rendered text. **Then U4** — count `[title]` in the library subtree
**excluding `workflow-soul`**; must be 0 in this phase's chrome. Its two survivors
(`WorkflowSoul.tsx:99`, `PhaseSpine.tsx:77`) are INHERITED and out of scope by D-01 — left unstated,
that row fails 192 for a defect two prior phases shipped. Then U1, U2, U3, U5, U7, U8, U9, U10, U11.

**Driving notes (do not re-derive):** 200 workflows, **never 12**; `evaluate_script` for DOM geometry
because `take_screenshot` times out on this setup; `computer` clicks can deliver zero events while
`hover` / `left_click_drag` work. ⚠ **The search does NOT highlight the hit** — matched text renders
plain. Do not verify a behaviour that does not exist.

**Next action:** `/gsd:verify-work 192` when you want the owed rows driven — or proceed knowing they
are owed. Downstream MUST read `192-CONTEXT.md` (**18** decisions) and `192-RESEARCH.md`, which **corrects six CONTEXT.md line numbers** measured at `HEAD = a0795512` — re-derive every line number, HEAD has moved.
**Last activity:** 2026-08-14 — **Quick task `260814-q5r` completed and merged** (`22244732`): a template's placeholders now show on the authoring panel when one is attached. The brief's premise was refuted by measurement (the shipped palette route's `template_asset_id` is typed `UUID`; the Phase-193 upload door mints a Storage **path** → 422), and widening it would have opened a **cross-tenant read** on a service-role Storage client — so a dedicated owner-gated route shipped instead. **Post-merge gates verified independently by the orchestrator on the merged tree, not inherited from the executor:** `tsc -p tsconfig.app.json` unmoved at **33**, count gate **exit 0 / failed 0** (`GSD_VITEST_MAX_WORKERS=2`, total 3604, pin 25 → 43), new backend suite **14/14**. ⚠ **D-5's live user-JWT Storage read is UNDETERMINED — see the owed-UAT note under Quick Tasks Completed; it is the one check that can invalidate the feature.**

**Prior activity:** 2026-08-10 — **Phase 192 wave 1 executed and merged** (`5178100e`). `192-01`: five `WorkflowsPage`-covering suites adopted into BOTH count-gate knobs (pinned files 51 → 56, pinned total 2838 → 2910), zero source changed. `192-02`: D-04 ownership — `is_mine` + `is_system_global` computed server-side on `/published` and `/starters`, raw `created_by` fenced off the wire. Post-merge gate green: `tsc -p tsconfig.app.json` unmoved at **33**, count gate exit 0 / `failed 0`, new backend suite 17/17.

### Wave 1 — three measured findings not to re-derive

1. **Claude Code's worktree isolation did NOT fork from the orchestrator's HEAD.** `192-02`'s
   worktree came up at `fda79214` (a `master` merge commit), not the dispatched base `17c30d4f`.
   The prompt's `git merge-base` assertion caught it and `reset --hard`-ed to the correct base;
   both branches merged from `17c30d4f` cleanly. **Keep the base assertion in every executor
   prompt — it is load-bearing here, not ceremony.**
2. **The count-gate marker was stale by 63 at HEAD** — it read `2775 (190-15)` while the reduce
   computed **2838** on an unmodified tree. Ninth staleness event; corrected in place. Two NEW
   drifted pins were found and deliberately left alone (`WorkflowBuilderPage.canvas.test.tsx` +5,
   `builderStore.test.ts` +6), joining the two owed since 190-12 (`ExternalActionSection` +9,
   `PhaseTimeline` +4) — **24 cases are deletable with the gate green today**, all outside 192's
   blast radius. Re-pinning them inside 192 would fold unrelated drift into a commit that did not
   cause it.
3. **One degradation claim in `192-02` was measured FALSE and scoped rather than shipped.** A
   malformed caller id does NOT yield `is_mine=False` on `/published`; it raises, because a
   **pre-existing** `UUID(user_id)` coercion at `workflows.py:252` fires first. The claim is true
   of the helper and of `/starters` only. The shipped coercion was left alone (out of scope) and
   the measurement recorded in the test docstring, so no later reader concludes 192 either
   introduced or removed a 500 path.

### Wave 2 — what it measured (merged `3d1a9567`)

`192-03` RunModal baseline (8 captured strings + 6 focus/dialog assertions, two dumps byte-identical
at 20,065 B) · `192-04` delete-Sheet baseline (7 states + both graded-guard invariants, three RED
plants each reddening only their own cases) · `192-05` the four library leaves + four subtree fences.
Post-merge: count gate exit 0 / `failed 0` / total 2910 → 3060 all-growth, `tsc` 33, eslint clean.

1. **The wrong-base bug is SYSTEMATIC, not incidental — 3 of 3 wave-2 worktrees hit it**, plus
   `192-02` in wave 1. Every one came up at `fda79214` (a `master` merge commit) instead of the
   dispatched base. Claude Code's `isolation="worktree"` does not fork from the orchestrator's HEAD
   here. The `git merge-base` assertion in the executor prompt is the only thing catching it —
   **keep it in every prompt**; a baseline captured on the wrong base proves nothing.
2. **`GSD_VITEST_MAX_WORKERS=4` is calibrated for TWO concurrent runs, not three.** At three agents
   `192-05` measured the count gate non-deterministic on ONE commit: `failed 6 → 0 → 1 → 3`. The
   failures were read from the gate's own JSON (session suite, canvas suite, two `WorkflowCanvas`
   axe assertions) — **none under `library/`**, and one run was `failed 0` with all code present.
   Re-run serially by the orchestrator it was green first try. **Amends CLAUDE.md's parallel-run
   rule: the cap holds at 2 concurrent vitest runs; at 3 it is still oversubscribed on 16 cores.**
3. **F1 (192-03): the mid-launch Escape guard is DOUBLE and the baseline can only see the outer
   half.** Deleting the modal's own `if (!submitting)` left the assertion GREEN — the page's
   `onCancel` still refuses; only deleting both reddens. D-01 moves the modal and LEAVES `onCancel`
   on the page, so nothing in the baseline would catch `192-06` dropping the inner guard. Closing it
   requires testing `RunModal` in isolation, which is only possible once it has its own module.
4. **RESEARCH's "≈169 L" delete-Sheet extent was 165 by its own span list** (192-04). The missing 4
   are the `onDeleted` prop + docblock — the re-fetch seam the no-optimistic-vanish invariant runs
   through, which cannot stay behind. Spans, not a number, are recorded in the test.
5. **Three plan-text corrections from 192-05, each of which would have cost a downstream plan:**
   the plan's `soulDeliverable` paraphrase is wrong (the real `chat` variant has **no `label`** —
   code written against it does not compile); `UNBOUND` could not be "reused" (module-private in
   `WorkflowsPage.tsx:67`, and fence F4 forbids the subtree importing the page) so it is re-homed in
   `libraryFilter.ts` at an identical value — **two identical declarations exist until 192-10
   deletes the page's copy**; and F1 must be parsed, not grepped, or the file documenting the rule
   trips it.

**Owed to `192-12`** (the pinning sweep): `RunModal.test.tsx` 11 → **32** (192-06 re-measured; wave 2 read 27 before the move added cases), `RunModal.a11y.test.tsx`
8 → **16**, `PublishedCardDelete.test.tsx` 7 → **32** (192-08 re-measured; 192-04-SUMMARY.md records 26, which is stale), plus first pins for `libraryFilter.test.ts`
(36) and `librarySubtree.fences.test.ts` (47), plus RED plants for the four subtree modules.
⚠ **If `192-06` moves tests into a new `library/RunModal.test.tsx`, the old files' counts DECREASE —
the one thing this gate fails on. 192-06 and 192-12 must settle those pins together.**
⚠ **F1 will fire on the moved code in 192-06/07** — `RunModal` and the delete Sheet carry `title=`
today. That is D-14 working; the `aria-describedby` conversion belongs with the move.

### Wave 3 — the first D-01 move, proved (merged `15f1b5c2`)

`192-06` moved `RunModal` out of the page; `192-07` built `LibraryToolbar` (358 L + 36 cases).
**`WorkflowsPage.tsx` 1407 → 1068 L.** Post-merge: count gate exit 0 / `failed 0` / total 3101,
`tsc` 33, eslint 0/0 incl. a11y.

1. **The verbatim move was proved MECHANICALLY, not asserted.** `sed` the moved range out of the
   base blob and out of the new module, strip the one added `export `, `diff` → IDENTICAL. **Zero
   re-capture**: `RunModal.test.tsx`'s diff is 143 insertions / **0 deletions**, so not one
   `*_BASELINE` literal was edited. This is the 188.1/188.2 method holding a third time.
2. **F1 (the double Escape guard) is CLOSED and was driven RED.** Once `RunModal` is a module it
   can be rendered in isolation with an `onCancel` carrying no outer guard; deleting the inner
   `if (!submitting)` gave 1 failed / 31 passed — exactly the isolated row, positive control green.
3. **An inherited claim was measured FALSE.** `192-05-SUMMARY.md` said `RunModal` "carries `title=`
   today" and that F1 would fire on the moved code. All six `title=` hits sit ABOVE the moved
   range — RunModal carries zero and no `aria-describedby` work was owed. ⚠ **The other half
   STANDS: `:857` is a genuine hit for `192-08`'s delete-Sheet move.**
4. **`192-05-SUMMARY.md` also maps this phase's plan numbers OFF BY ONE** (it calls 07 the
   delete-Sheet move and 09 the toolbar). Measured from the plan files: **07 toolbar · 08 delete
   Sheet · 09 card**. This matters because `192-12`'s owed obligations are addressed by plan number.
5. **`T-192-04` greps where `F1` parses** — an asymmetry that reddened a docblock for spelling the
   React prop the fence forbids. The next author will hit it too.
6. **A "create leads" plant that would have passed falsely was rejected** (192-07): CSS
   `flex-direction: row-reverse` leaves every `compareDocumentPosition` assertion green while
   visually putting create last. Replaced with a real JSX reorder — so the suite proves create
   leads in **focus and screen-reader order**; the visual half is owed to UAT U2/U7 and `192-11`
   and was NOT claimed.
7. **Wrong base: 6 of 6 worktrees.** Unchanged and systematic.

### Wave 4 — the second D-01 move, and a claim this orchestrator got wrong (merged `b52bd4f4`)

`192-08` moved the WFIN-03 delete Sheet out of `PublishedCard` into
`library/WorkflowDeleteSheet.tsx` (296 L). **Page 1068 → 926 L** (40 ins / 182 del). Four spans
`diff`ed IDENTICAL against the base blob, **zero characters added inside any span**. All seven
192-04 captures + both graded-guard invariants green with **zero re-capture** — `git diff` over
`pages/__tests__/` was empty at the moment they re-ran. Post-merge: count gate exit 0 / `failed 0` /
total 3107, `tsc` 33.

1. **⚠ THE `title=` CLAIM WAS FALSE, AND THIS ORCHESTRATOR PROPAGATED IT.** `192-05` claimed both
   D-01 moves would trip fence F1; `192-06` refuted it for `RunModal` but kept "`:857` is a genuine
   hit for 192-08" — and the wave-4 dispatch brief repeated that as fact **without re-deriving it**.
   Measured: the page's six `title` attributes sit at `:98 :564 :588 :871 :1042 :1058`, and `:871`
   (the post-cut position of old `:857`) is the **⑂ Tweak button in `PublishedCard`'s footer**, ten
   lines ABOVE the Sheet's comment at `:886`. **Zero `title` attributes were inside the moved
   range.** No conversion was owed; none was performed; the plan's own acceptance criterion
   (`grep -c "title=" ` on the module = 0) had it right. **⇒ The `:871` D-14 conversion is now
   `192-09`/`192-10`'s debt** — 192-09 must not reintroduce it on the new card, and 192-10 deletes
   the old one. **Lesson, same class as the project's standing rule: a claim inherited through two
   summaries and an orchestrator brief is still an unmeasured claim.**
2. **Every inherited line number was +14 stale** — all four spans re-derived by content, not number.
   Third line-number correction in this phase.
3. **192-04's "169-line extent" measures 175 here** — two comment blocks documenting the moved code
   that its span list did not name.
4. **The guard was re-proved ON the moved code:** deleting the mid-delete refusal inside
   `WorkflowDeleteSheet.tsx` reddened exactly 4 rows — **including 192-04's two page-driven rows**,
   which is the cleanest available proof the invariants follow the code and not the filename — with
   all four positive controls green, then restored.
5. **New pattern introduced, cost stated:** the Sheet opens via a React 19 ref-as-prop imperative
   handle, chosen so `sheetOpen` could not stay on the caller. `useImperativeHandle` had **zero**
   prior uses in this codebase.
6. **The count gate did NOT flake in this single-executor wave** — consistent with the
   concurrency-induced explanation, not a latent suite problem.

### Wave 5 — the unified card (merged `67f46794`)

`192-09` shipped `library/WorkflowCard.tsx` + 35 cases. Post-merge: count gate exit 0 / `failed 0` /
total 3142, `tsc` 33, eslint + a11y 0, library subtree 154 passed, the 10 suites consuming shipped
testids 176 passed untouched.

1. **The plan contained a genuine contradiction, resolved rather than papered over.** Task 1 requires
   `grep -c "Publish"` on the module = **0**; Task 2 named a prop `onForkPublished`, and the delete
   Sheet's row type is `PublishedWorkflow`. Both cannot hold. Resolution: props are
   `onForkNewVersion` / `onForkStarter` — named for what each fork PRODUCES, which is the real D-12
   distinction — and the delete target's type is derived as `WorkflowDeleteSheetProps["wf"]` rather
   than re-imported. The grep is truthfully 0 and D-10 is proved by rendered-DOM absence across all
   three row states with a self-planted positive control.
2. **The heavy `Delete workflow…` is gated on OWNERSHIP, not on "runnable".** D-09's table taken
   literally offers a destructive action on a curated system-global starter against an owner-gated
   endpoint — an action that can only fail. The shipped starter card never had one; the gate
   reproduces that through the shipped `CHIP_PREDICATES.yours`, not a second copy of the predicate.
3. **Eight plants, each RED, each restored md5-identical.** The suite passed 35/35 first try, which
   proves nothing on its own. **Plant 5 is the one to remember:** it left the consequence sentence
   fully rendered and changed only the id it is ADDRESSED BY — presence, attribute and text checks
   all stayed green; exactly two cases failed, both resolving the id through `getElementById`. That
   is the difference between asserting a contract and asserting its shadow.
4. **Two more stale numbers corrected — and one of them was in the orchestrator's own brief again.**
   The ⑂ Tweak tooltip is at `WorkflowsPage.tsx:853`, **not `:871`** (192-08's summary and the wave-5
   brief both carried the stale figure); it is now gone, replaced by `aria-describedby`.
   `deleteWorkflowDraft` is at `api.ts:3542` with signature `(id, signal?)`, not `:3525` /
   `(definitionId)`. **Running total: line numbers have been corrected in FIVE of the six waves.**
5. F1 / F4 / T-192-04 were driven RED inside a real module here, discharging that part of 192-12's
   obligation.

**Owed forward from wave 5:** `192-10` deletes the three shipped cards — `draft-publish` is the one
testid that dies with them and its single consumer is 192-10's own. Five module-private strings in
the card (plus 192-07's four) still owe a re-home into `libraryVocabulary.ts`.

### Wave 6 — the page becomes composition (merged `ee62cbbe`)

`192-10`: one merged feed, one toolbar, one flat list; the shelves, rail, three cards and banner are
gone. Post-merge: count gate exit 0 / `failed 0`; **pinned total 2910 → 2909, which is the one
authorized lowering** (`WorkflowsPage.test.tsx` 23 → 22) appearing exactly where it should and
nowhere else. `tsc` 33.

1. **⚠ `allSettled` IS NOT WHAT SAVES THE LIBRARY — and the orchestrator's brief said it was.**
   Plant 1 swapped `Promise.allSettled` for `Promise.all` and the partial-failure test stayed
   **GREEN**: the aggregate has no consumer, so the two forms are behaviourally identical here. The
   isolation that actually works is the **per-source `try`/`catch` in each `refetch*`**. Rather than
   let a green stand for a guarantee it does not provide, the property was proved RED against the
   REAL defect (gating the list on "no source failed"), the keyword pinned separately as source in
   the same `it()` (also RED), and `WorkflowsPage.tsx:359-371` says so plainly. **Same class as
   185's lesson: verify the PROPERTY, not the PATCH.**
2. **Two plan contradictions resolved rather than papered over.** `grep -c "GET /workflows/published"
   == 0` cannot hold alongside `NetNewFlag`'s byte-exact `title=`, which contains that literal — the
   count is honestly **1** at `:173`, recorded as two Phase-193 residuals with a named trigger.
3. **RESEARCH predicted "2 deletions, 4 rewrites"; measured, 13 of 23 tests went RED.** Its contract
   classification was right (all eleven survivors intact) but it did not model seven interaction
   changes — including two cases it called "must stay green" that both reach the page through the
   deleted rail or build-card.
4. **THE PAGE GREW: 926 → 1007 L.** Its CODE shrank **615 → 479 (−22.1 %)**; comments 270 → 484.
   Stated rather than smoothed, exactly as 188.2 did with its +67 % subtree.
5. **NO file was deleted** — the 223 removed lines are four function declarations inside a surviving
   file; all twelve deleted things are named in the SUMMARY. Three files outside the plan's
   `files_modified` were touched, all anticipated consumer updates: `build-card` → `library-create`
   and `drafts-shelf` → `library-toolbar` in two builder suites, and the delete-Sheet "exactly one
   host" row re-pointed from page to card. Each keeps the PROPERTY and re-points only its subject.
   Continuity testids survived verbatim; consumer suites 195 → 194 with the −1 fully accounted for.

### Wave 7 — the requirements proved at the surface (merged `62eef6d5`)

`192-11`: LIB-01…04 at **200 rows** through the real filter and real DOM. Post-merge: count gate
exit 0 / `failed 0` / total 3158, `tsc` 33 across four measurements. Twelve plants, all restored
md5-identical.

1. **⚠ D-07's search HIGHLIGHT is NOT shipped — found by measuring, not assuming.** No module under
   `components/workflows/library/` consumes `HighlightTitle` (its three live call sites are all in
   `components/layout/`), and `WorkflowCard` takes **no `query` prop at all** — 192-09's SUMMARY
   records the same fact from the other side. Wiring it is a source change across two files outside
   192-11's one-file gate, so the suite **asserts the gap BY NAME with a positive control** proving
   the `mark` selector finds a real highlight instantly. **It does NOT block LIB-01** —
   REQUIREMENTS.md's wording is "search by name and filter the list"; the highlight is decision
   D-07. ⚠ Related: `librarySubtree.fences.test.ts:355` asserts in prose that *"192 IMPORTS it and
   edits nothing"* — the byte-identity half holds, **the "imports it" half is now FALSE**.
   **Both files are in `192-12`'s `files_modified`.**
2. **The five-wave-old D-04 cross-check is DISCHARGED**, in two halves because either alone is weak:
   the wire half over all 140 rows (positive control: a contradicting starter fails it), and the
   surface half where the *Yours* chip promises and then delivers exactly the non-starter rows. The
   degraded case deletes the key from the payload entirely and proves the chip stays **correct**,
   not merely non-fatal — driven RED against `row.isMine ?? false`.
3. **Two plants proved the assertions are not redundant with one another.** A `Publish…` item hidden
   in the draft MENU reddened the menu fence and left the FACE fence green — exactly how that button
   could come back. Demoting create below the search field reddened *first-interactive* while
   leaving *row-precedence* green, because a control demoted inside the toolbar still precedes every
   row. A CSS `row-reverse` plant was deliberately NOT used: 192-07 measured it cannot fire.
   **SC#4 proves ORDER only; the visual half stays UAT's (U2/U3/U7).**
4. **One flake hardened rather than tolerated:** 1 failure in 646 on a first wide run, not reproduced
   in four re-runs; an UNCAPPED gate run reproduced one too. `configure({ asyncUtilTimeout: 15000 })`
   now applies to that file — it changes patience, never an assertion. The executor stated the
   evidence is consistent with BOTH the worker-cap and the timeout explanation and **proves neither**.
5. **`WorkflowsPage.test.tsx` is 22 → 39** (gate `actual`, three agreeing runs). 192-10's note that
   its pin was "settled at 22 and needs nothing further" is **stale**.

### Wave 8 (PARTIAL) — the close, minus the operator's rows (merged `62c3aab4`)

`192-12` Tasks 1-2 only. Fences 47 → 64 cases, all driven RED against real plants and restored
md5-identical; every suite pinned from a read number (**60/60 pinned files, total 3175, pinned total
3151**); the `WorkflowsPage.tsx` G-5 ledger row written into CLAUDE.md with re-derivable figures.
`tsc` 33, eslint + a11y 0, zero deletions. **Task 3 — the eleven G-4 UAT rows — is OUTSTANDING.**

1. **D-07's highlight is DEFERRED, and the reason was measured rather than argued: wiring
   `HighlightTitle` REDS fence F1 by construction**, because its prop is spelled `title`. Observed
   with a real plant, not reasoned. The plan's own `<what-built>` copy claimed "the hit highlighted"
   and was corrected before the operator could be asked to verify a behaviour that does not exist.
   LIB-01's REQUIREMENTS.md wording is "search by name and filter the list", so this is a deferred
   DECISION, not a requirement gap.
2. **⚠ THE INTERMITTENT GATE FAILURE IS NOW NAMED, LOCATED AND RATED — it is NOT 192's.** Across 14
   gate runs at this HEAD, 2 failed, both the SAME test:
   `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` →
   *"WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14) >>
   POSITIVE CONTROL — with the flag ON the very same read finds the key"*, failing
   `expected 0 to be greater than 0`. One occurrence was in the main tree, one inside an executor
   worktree. **This is a PHASE-184 suite**; 192 touched `WorkflowBuilderPage.header.test.tsx` and
   `.session.test.tsx` (testid re-points) and never `.canvas`. It is the same suite `192-05` named
   in its flaky-under-load set, and the same render-timing class `192-11` hardened elsewhere with
   `asyncUtilTimeout`. **Rate 2/14 (~14 %). Deliberately NOT fixed inside 192** — it would fold
   unrelated drift into a commit that did not cause it. Re-open trigger: any phase touching
   `WorkflowBuilderPage.canvas.test.tsx`, or a third sighting outside 192.
3. **Still owed, recorded not absorbed:** the four drifted pins outside 192's blast radius
   (`ExternalActionSection` +9, `PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5, `builderStore`
   +6 — **24 cases deletable with the gate green today**); the RED-plant obligation on
   `WorkflowDeleteSheet.tsx` from 192-08; nine string re-homes into `libraryVocabulary.ts`.
4. **LIB-01…04 remain UNMARKED by deliberate choice.** They are user-observable, which is exactly
   what makes an auto-flip look plausible and still be premature — the phase is not verified until
   the operator's rows are driven.

**Owed to a later plan** (raised by `192-02`, from RESEARCH): an integration assertion that
`is_mine === (provenance !== "starter")` over the merged list — the cross-check that makes feed
provenance and the new server bit agree. `192-10` or `192-11` is its home. And `?scope=mine` must
stay: D-16's dedupe-free property depends on it.

### Phase 192 planning — the four things a later reader should not have to re-derive

1. **The count gate does not cover this phase's own file.** `WorkflowsPage.test.tsx` and the three
   `src/pages/__tests__/` suites are in **neither `TARGETS` nor `BASELINE`** of
   `scripts/vitest-count-gate.cjs` — **74 of the 123 covering tests are invisible to it**, so a
   deleted `it()` during the restructure leaves it green. **Eighth recorded occurrence of the
   two-knob trap.** `192-01` is therefore commit 1 of the phase, before any source change.
2. **`/drafts` IS feature-gated; `/published` and `/starters` are the documented RUN CARVE-OUT and
   are not** (`workflows.py:171`). A naive `Promise.all` on the merged fetch re-introduces the gate
   client-side and **empties the entire library** for any user without the authoring capability. The
   merge uses `allSettled`, and dedupes by **`id`, never `slug`** (`onTweak` deliberately mints a
   same-slug row).
3. **D-04 does NOT block D-12 — the waves genuinely parallelize.** Provenance is already available
   three ways (feed origin, `definition.category`, and after D-04 `is_system_global`). This is the
   dependency everyone assumes exists; it is not encoded, on purpose.
4. **Four testids must survive the card rewrite verbatim** — `published-run` (`:864`),
   `published-tweak` (`:855`), `use-starter` (`:1042`) and **`draft-open` (`:722`)**. 22 references
   across five suites; three of those suites are pinned by `192-01` in wave 1, so a renamed id lands
   as a **gate red**. `draft-open` reaches `WorkflowBuilderPage.header.test.tsx`, which asserts its
   band by **byte-exact `innerHTML`** at a pinned 32. `draft-publish` is the one id that dies (D-10).

**Two decisions the operator made at plan time**, both on measured findings rather than taste:

- **D-17** — the project filter **holds starters out and says so** in the toolbar. `?project_folder_id=`
  narrows only `/published` (`db/workflows.py:291–293`) and mig 094 seeds starters with no project at
  all. Under three shelves that read as scoping; under one flat list it reads as a broken filter.
  **Silence is a FAIL** (UAT row U6).
- **D-18** — draft `Delete` **ships as wiring, not new capability**: `delete_draft` (204) and
  `deleteWorkflowDraft` (`api.ts:3525`) already exist and are tested, with **zero UI callers**.
  Never the cascade path — that resolves a *slug* and destroys every version under it.

### Guardrail activity

| Date | Rule | Phase | Outcome |
|---|---|---|---|
| 2026-08-13 | **UI-SPEC gate** (workflow gate, not a G-rule) | **193** | **SKIPPED BY OPERATOR DECISION — audited, not silent.** `/gsd:plan-phase 193` detected frontend indicators and no `193-UI-SPEC.md`, whose default is to stop and route to `/gsd:ui-phase 193`. Skipped on the **same reasoning as 192, and the reasoning is stronger here**: sketch 164's `BUILD-CONTRACT.generated.md` is **generated FROM the real component DOM** (substitution audit **18 matched / 0 missed**), which is a harder acceptance bar than a generated UI-SPEC — it cannot drift from the component because it is derived from it. ⚠ **The caveat was stated at decision time, not discovered later: the sketch draws NO mockup of the D-04/D-22 header restack**, so that half is a human comparison at UAT either way (rows U3/U3b). Recorded so a later reviewer does not read the absent artifact as an oversight. |
| 2026-08-13 | **G-5** (refactor between feature waves) | **193** | **FIRES → HONOURED BY CONSTRUCTION at discuss-phase (D-07/D-08). NOT an override — no waiver recorded** (a G-5 override was explicitly offered and **declined**, D-09). Measured at discuss-time: `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` = **8 commits across 6 phases** (124/155/184/184.1/186/187), **385 L** — and the file was **ABSENT from the CLAUDE.md hot-file ledger**, the identical failure to `WorkflowsPage.tsx` escaping G-5 for ten consecutive phases, because the audit scans `files_modified` *against that table* and a file missing from it is permanently invisible to its own guardrail. **193 owes it a ledger row at close** (`193-10` owns that write). Honoured by construction because the sketch's own build contract already requires porting the COPY table into a vocabulary module: the extraction G-5 wants and the refactor the contract wants are **the same act**. Wave order is load-bearing — wave 1 captures baselines on the **UNMOVED** tree, wave 2–3 move nothing but structure, wave 4+ changes words (the 188.1 rule: a baseline only proves something if it PREDATES the change). |
| 2026-08-13 | **G-2** (sketch before discuss/spec on visual scope) | **193** | **SATISFIED BEFORE PLANNING.** Sketch **164 `telling-the-doors-apart`** is the acceptance bar; the operator picked **variant D — "the mix"** (B's door NAMES + C's two TIER labels) at `20ca7cf7`, together with the ruling that the header-strip restack is **in scope**. D is **derived** in `build.cjs` (`D_FROM_C`), never re-typed. **Not an override — no waiver recorded.** |
| 2026-08-13 | **G-7** (gap-closure round cap) | **193** | **NOT APPLICABLE** — first planning pass, no `--gaps`. Recorded so the absence of a check is distinguishable from a skipped one. |
| 2026-08-13 | **G-3 / reported-bugs routing** | **193** | **BUG-260813-01** (the workflow canvas stays DARK in light mode — `colorMode` hardcoded) left **`open`**, deliberately **NOT folded** into 193. Adjacent only (the govern door opens the Builder that hosts the canvas) but a different concern; it is a one-line `colorMode → useTheme` change and belongs to `/gsd:fast` under **G-3**. Re-open trigger: any phase touching `WorkflowCanvas.tsx`'s render props. |
| 2026-08-13 | **Decision-coverage gate** (workflow gate) | **193** | ⚠ **THE GATE RETURNED A VACUOUS PASS AND WAS RE-RUN BY HAND.** `check.decision-coverage-plan` reported `passed: true, skipped: true, reason: "no trackable decisions"` — it did not parse a single one of CONTEXT.md's **25** decisions (the known GSD quirk: the parser wants literal `D-NN` tokens in a shape this file does not use). A gate that passes without checking anything is exactly the failure class 192.1's security audit found in three fences. Coverage was therefore verified manually with `grep -o "D-NN\b"` over all 11 plans: **25 of 25 covered**, every id cited in at least one plan (`D-16` weakest at 1 mention / 1 plan; `D-23` strongest at 34 / 5). |
| 2026-08-10 | **G-2** (sketch before discuss/spec on visual scope) | 192 | **HONORED → SATISFIED same day.** `/gsd:discuss-phase 192` was requested; the ROADMAP itself flags 192 *G-2 fires (visual)*, and SEED-136 re-open trigger #3 independently says *"do the IA question FIRST, do not restyle underneath it."* No existing sketch covered this IA — sketch 021 (Phase 103) designed the very card-grid + project rail that SEED-136 now calls unbrowsable. Routed to `/gsd:sketch 192` → sketches **157/158/159** built and driven; operator picked **157-B · 158-A · 159-C** (2026-08-10). The approved mockup is now the acceptance bar. **Not an override — no waiver recorded.** |
| 2026-08-10 | **G-5** (refactor between feature waves) | 192 | **FIRED → HONORED at discuss-phase** (`514c8e64`). **Not an override — no waiver recorded.** The refactor question was asked FIRST, before the feature, per the orchestrator protocol. Answer: **split the seam by what survives 192**, rather than a uniform 188.2-style verbatim cut. `RunModal` (`:1054–1407`) and the WFIN-03 delete Sheet (`:872–1003`, currently trapped inside `PublishedCard`) survive unchanged → **verbatim move with the characterization baseline captured BEFORE the move** (the 188.1 rule: a baseline only proves something if it PREDATES the change). `DraftCard`/`PublishedCard`/`StarterCard` are **replaced** by 159-C's single card → rewritten as new code under `components/workflows/library/` (which does not exist today), never extracted-then-rewritten, because 188.2 measured that a pure extraction grows the subtree **+67 %** and paying that on code the phase deletes is waste. Target end state: the page is composition — the 188.2 shape, without the 188.2 tax. *Original firing evidence retained below.* |
| 2026-08-10 | **UI-SPEC gate** (workflow gate, not a G-rule) | 192 | **SKIPPED BY OPERATOR DECISION — audited, not silent.** `/gsd:plan-phase` detected frontend indicators and no `192-UI-SPEC.md`, whose default is to stop and route to `/gsd:ui-phase 192`. Skipped because the design contract already exists in a stronger form: **G-2 was satisfied the same day** (sketches 157/158/159 driven, operator picked 157-B · 158-A · 159-C) and CONTEXT.md fixes the frame (D-02/03/05), search scope (D-06/07/08), verb table (D-09/10/12) and a11y mechanism (D-14) at higher fidelity than a generated UI-SPEC would. Recorded so a later reviewer does not read the absent artifact as an oversight. |
| 2026-08-10 | **G-7** (gap-closure round cap) | 192 | **NOT APPLICABLE** — first planning pass, no `--gaps`. Recorded so the absence of a check is distinguishable from a skipped one. |
| 2026-08-10 | **G-5** — original firing evidence | 192 | **FIRES.** Measured during the sketch: `frontend/src/pages/WorkflowsPage.tsx` = **21 commits across 10 phases** (103/124/143/152/155/165/184/184.1/186/188), **1407 lines** — and the file was **ABSENT from the CLAUDE.md hot-file ledger**, so ten phases touched it without the guardrail ever firing, because the audit step scans against that table and a file missing from it is invisible to its own guardrail. Ledger row added 2026-08-10 (`d0c76525`). 157-B is a structural rewrite of this file's library view (not a 185-style mount point), so **`/gsd:discuss-phase 192` MUST produce a refactor recommendation as its FIRST option.** Named seam: three card components → `components/workflows/library/`; `RunModal` + the WFIN-03 delete Sheet → their own modules; page becomes composition (the 188.2 shape). |

> Phase numbering continues from 190 and **starts at 192** — **191 is reserved** for the deferred
> canvas-scale phase (`.planning/v3.6-STRETCH-CARRYFORWARD.md`). Do not reuse it.

---

<details>
<summary>Previous milestone — v3.6, shipped 2026-08-09</summary>

**v3.6 Visual / No-Code Workflow Studio — ✅ SHIPPED 2026-08-09, git tag `v3.6`.**

| | |
|---|---|
| Phases | 13 (CORE 181-189 + STRETCH 190 + inserts 184.1 / 188.1 / 188.2) |
| Plans | **151** (150 summaries — `184-14` has none) |
| Commits | 1,064 over 18 days (`7c85f9ec` 2026-07-23 → `bdd3e54b` 2026-08-09) |
| Migrations | 114, 115, 116, 117, 118 |
| Requirements | **20/24 satisfied · 2 partial · 1 unsatisfied · 1 deferred** — CORE **19/21 with zero unsatisfied** |
| Security | **zero debt** — 9/9 threat-modelled phases at `threats_open: 0` |
| Archives | `milestones/v3.6-ROADMAP.md` · `-REQUIREMENTS.md` · `-MILESTONE-AUDIT.md` · `-MILESTONE-AUDIT-midflight-260806.md` · `-STATE-at-close.md` |

**What shipped:** a drag-and-drop visual authoring + non-technical live-run-observability layer over
the existing governed harness engine. **The differentiator is graded per-node governance** — strict
when KB-grounded, flexible when open, enforced at RUN time so it is not author-loosenable-away; the
Beam / Glean / n8n deep crawl found none of them grade strictness by grounding. **The D-14 red line
held across all 13 phases: 7 harness executors at close, exactly as at open.**

</details>

## ⚠ Open at close — read before starting anything

**1. CONN-02 — the one unsatisfied requirement, and the reason the audit reads `gaps_found`.**
A real Slack message DOES send through the full governed path (approval gate → six ordered guards →
send → `external_action_sent` audit receipt, `6379787c`). But `_adapter_args`
(`phase_types.py:1985-2005`) fills exactly one field, the capability's `body_arg`. Slack requires
only `["text"]`, which IS that arg — **so Slack works by coincidence**. Jira requires `summary`
(`jira_adapter.py:422`) and SMTP requires `to`/`subject` (`smtp_adapter.py:296`), and none of those
has an author-facing field in `ExternalActionPhaseConfig` (`harness.py:242`). Both raise at
`phase_types.py:2318-2332`, are caught, and report `failed`. **`D-190-DEF-17` — a phase, not a
patch** → connections milestone.

**2. ✅ CLOUD PARITY IS CLEAR — closed 2026-08-09, corrected here 2026-08-12.**
Re-derived mechanically: `bash scripts/pending-cloud-migrations.sh` → **"(none) — cloud is already at
the same migration watermark."** Migrations **104 → 118 were applied to cloud on 2026-08-09** during
the v3.4+v3.5+v3.6 cutover (`origin/production` `4c9b487a` → `5d5ea200`, since advanced to
`7dc53ffa`), and **118 — the credential exposure — is closed in cloud.** For the record, the defect
118 fixed: both `anon` and `authenticated` held column-level SELECT on
`connector_connections.secret_ciphertext`. It shipped in the same operation as the
`connector_service.py` deploy, as its own rule required.

> ⚠ **Why this correction is recorded rather than silently overwritten.** For three days this block
> read *"Until 118 is applied, cloud still has that defect."* On **2026-08-12** an external reviewer
> read exactly that line and reported, in good faith, that a product sold on its governance story had
> **live customer credentials readable by the wrong database roles**. It did not. The reviewer was
> right to trust the file; the file was wrong. **A stale security line in STATE.md is itself a
> security-adjacent defect** — it is what an auditor, a technical buyer, or the next agent reads
> first. The standing instruction on this block has always been *"re-derive; never quote a prose
> number"* — that instruction was correct and nobody ran it, on either side. Run the script.

**3. Verification debt — nine requirements ride on three missing `VERIFICATION.md` files.**
Phase 184 (CANVAS-02/03/04 + VALID-02/03), Phase 188 (RUNVIZ-01/02/03), Phase 189 (**CONN-01**, the
CORE half of operator HARD gate #3). All nine are wired in shipped source and carry passing UAT.
**Documentation debt, not engineering debt** — the cheapest outstanding item in the project.
⚠ Phase 184 carries a standing instruction **not** to route to `/gsd:verify-work 184`; close it by
retroactive documentation from the existing UAT results.

**4. Two records that asserted more than happened.** SEED-133's binding re-open trigger — *"Phase
189's discuss-phase MUST surface this row"* — **fired and was not honoured, for the second
consecutive phase** (it also missed at 187). And seven Phase-190 summaries mark CONN-02/CONN-03
complete against that phase's own `D-190-DEF-02` convention; for CONN-02 that claim is measurably
false.

**5. Accepted risks, both still `open`:** SEED-133 (NL generation ignores `bundle.degraded` → a
folder-blind draft presented as `ok:true` during a registry outage) · SEED-134 (the two flag-gated
single-segment `/workflows/<x>` paths are the only ones answering 404 — an enumeration oracle).

**6. Nyquist:** 4 phases at `nyquist_compliant: false` — 181, 182, 183, 184. Phase 188.1 showed such
a file can often be closed by measurement alone, without generating a single test.

**7. G-5 hot files firing:** `backend/app/services/harness/phase_types.py` (35 commits / 14 phases /
1918 L — **the CONN-02 fix will touch it**), `backend/app/api/threads.py`,
`backend/app/services/anthropic_service.py`. `PhaseNodeCard.tsx` was PAID DOWN by Phase 188.2
(797 → 274 L).

## Next milestone — the sequenced slot

**Connections / integrations.** Not a fresh idea — a debt with four converging records.
**Read `SEED-146` first (the umbrella).** Inputs: `SEED-144` (connections should be
**provider-shaped**, not action-shaped) · `SEED-145` (connections are **platform assets usable in
CHAT**, not workflow-only assets) · `SEED-142` (two-way — read / pull / auto-ingest, which would
amend CLAUDE.md's manual-upload-only rule) · `D-190-DEF-17` (the concrete unfinished edge).

⚠ **Two standing warnings recorded with those seeds:** **every capability shipped so far is a
WRITE — no read / search / list exists at all**, and **no outbound capability may be added to
`_TOOL_REGISTRY` before the approval model exists.** Sequence with SEED-142 or Google gets connected
twice.

Also unclaimed: v3.4 STRETCH 169-173 · v3.5 STRETCH 178-180 (**180 agent-loop honesty = priority
revive**) · 11 dormant seeds.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-08-09. **46 total.** None belongs to
v3.6 — the 25 quick tasks are legacy stubs (all `status: missing`, dating from 2026-03 onward) and
the 11 seeds are intentionally dormant.

| Category | Item | Status |
|---|---|---|
| quick_task | 260322-26g-improve-tool-call-display-for-ls-tree-gr | missing |
| quick_task | 260328-v6n-investigate-and-plan-fixes-for-duplicate | missing |
| quick_task | 260328-wqj-fix-folder-scoped-chat-returning-results | missing |
| quick_task | 260328-x6n-fix-bug-folder-not-created-when-pressing | missing |
| quick_task | 260404-vel-fix-streaming-cursor-bug-and-add-meaning | missing |
| quick_task | 260405-rgy-fix-folder-public-visibility-files-and-s | missing |
| quick_task | 260405-s1e-hide-toggle-global-from-non-owners-and-b | missing |
| quick_task | 260405-stg-add-chat-references-cascade-deletions-an | missing |
| quick_task | 260407-vqw-review-and-fix-context-window-management | missing |
| quick_task | 260411-wj5-fix-skill-file-upload-bug-files-not-save | missing |
| quick_task | 260412-dqu-fix-four-issues-in-backend-app-api-skill | missing |
| quick_task | 260412-jnc-import-skill-return-202-backgroundtask-f | missing |
| quick_task | 260522-gdg-google-15-iter-loop-diagnostic | missing |
| quick_task | 260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t | missing |
| quick_task | 260529-1wb-fix-bug-260529-01-write-todos-crashes-on | missing |
| quick_task | 260530-wjp-infer-native-tools-for-deepseek-moonshot | missing |
| quick_task | 260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th | missing |
| quick_task | 260531-00x-add-reportlab-to-sandbox-image-pdf-writi | missing |
| quick_task | 260611-irx-worker-log-rotation-pid | missing |
| quick_task | 260630-226-chat-tool-card-live-state-de-duplication | missing |
| quick_task | 260705-hz1-fix-seed-102-reverse-the-name-collision- | missing |
| quick_task | 260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip- | missing |
| quick_task | 260731-3y4-armed-approval-allow-list | missing |
| quick_task | 260807-x9p-bound-steptypepicker-height-to-measured- | missing |
| quick_task | 260808-148-steptypepicker-keyboard-navigation-rovin | missing |
| seed | SEED-003-deployment-flexibility-install-ux | dormant |
| seed | SEED-004-org-multi-tenancy | dormant |
| seed | SEED-040-model-registry-self-service | dormant |
| seed | SEED-041-conversation-compaction | dormant |
| seed | SEED-042-chat-input-modalities | dormant |
| seed | SEED-043-sandbox-package-management | dormant |
| seed | SEED-045-ui-ux-polish-pass | dormant |
| seed | SEED-046-library-health-dashboard-enrichment | dormant |
| seed | SEED-084-starter-workflow-library | dormant |
| seed | SEED-127-reasoning-first-forced-emission-gap | dormant |
| seed | SEED-128-collapsible-reasoning-run-timeline | dormant |
| todo | spike-nl-workflow-authoring | high — largely satisfied by shipped work |
| uat_gap | 184 — 184-UAT-RESULTS.md | unknown (0 open scenarios) |
| uat_gap | 187 — 187-UAT.md | testing (7 open scenarios) |
| uat_gap | 188 — 188-UAT.md | complete (16 pass / 0 fail / 1 blocked) |
| uat_gap | 188.2 — 188.2-UAT.md | partial — 4 driven / 1 blocked |
| verification_gap | 182 — 182-VERIFICATION-round1.md | gaps_found |
| verification_gap | 182 — 182-VERIFICATION-round2.md | gaps_found |
| verification_gap | 182 — 182-VERIFICATION.md | gaps_found (⚠ its recorded regression is FIXED at `api/workflows.py:852`; the file is stale) |
| verification_gap | 188.2 — 188.2-VERIFICATION.md | human_needed |
| verification_gap | 190 — 190-VERIFICATION.md | human_needed (⚠ frontmatter says `3/5` + "no SECURITY.md"; its own body addendum says `4/5` and `190-SECURITY.md` exists at `threats_open: 0`) |

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260809-klo | fix BUG-260809-02 — add a `business_requirement` input to the canvas Builder | 2026-08-09 | `da668c96` + `1c58a3fb` | [260809-klo-…](./quick/260809-klo-fix-bug-260809-02-add-a-business-require/) |
| 260813-e12 | `/gsd:fast` — close **E-1** and **E-2** from `192.1-SECURITY.md`: the identity memo's `[rows]`-only key had NO assertion despite its register claiming one, and the subtree non-vacuity guard proved only 3 of 12 modules load. Both driven RED against real plants; E-2's plant showed the four `it.each` sweeps passing green against the empty string — the Phase-190 CR-01 shape. E-3 (INFO) left to the next phase touching `useWorkflowFork.ts`. | 2026-08-13 | `15472e7c` | — (inline, no plan dir) |
| 260814-q5r | Show a template's placeholders when it is attached. **The brief's premise was refuted by measurement:** the shipped `/workflows/grounding-bundle?template_asset_id=` types that param `UUID`, while the Phase-193 upload door mints a Storage **path** — a real asset id is a **422** at offset 37, so the seam was not merely unwired but unwirable. And widening it would have opened a **cross-tenant read** (`resolve_template_source` Branch 1 does not scope by `user_id`, and that route injects the **service-role** client — the `UUID` coercion was the only guard, accidentally). Shipped instead: an owner-gated `GET /workflows/{id}/template/placeholders` (user-JWT client, prefix + `..` traversal fences), a `(names, read)` three-state that splits "we read it and found none" from "we never read it", a leaf `useTemplatePlaceholders` hook, and four non-collapsible readings on `TemplateAttachSection` (incl. the Word-only sentence — the parser reads `word/document.xml` only, so `.pptx`/`.xlsx` templates would otherwise be told they have no fields). RED-1…RED-4 each observed failing against real plants. | 2026-08-14 | `22244732` (merge) · `19b94a1a` `ce9d6f74` `9521dfb6` | [260814-q5r-…](./quick/260814-q5r-show-a-template-s-placeholders-when-it-i/) |

✅ **`260814-q5r` — THE OWED MANUAL UAT WAS DRIVEN 2026-08-14 AND ALL FOUR READINGS PASSED. D-5 is
CLOSED: the live user-JWT Storage read WORKS and no fallback to `get_supabase` was needed.** The
note this replaces said D-5 was UNDETERMINED and was the one thing that could invalidate the
feature — it is kept in the git history rather than in this file, because the risk is now measured
rather than open.

**What was driven, by the operator in the live app, on a seeded draft fixture** (`0143b84f`, since
deleted — a clone of `286a2428` binding `d8a54002/_library/risk-register-101uat.docx`):

| # | Reading | Result |
|---|---|---|
| 1 | **(b) a draft OPENED with a template already bound — no upload** | ✅ all **11** names (`cause · effect · event · impact · owner · probability · project_name · report_date · response_strategy · risk_id · status`) |
| 2 | **(a) a fresh upload in-session** (`q5r-template-with-fields.docx`) | ✅ list changed 11 → the correct **4** (`client_name · owner · project_name · risk_id`) — proving the refetch-on-replace, not a stale list |
| 3 | **honest empty** — a real `.docx` with zero tokens | ✅ *"We read this template and found no fill-in fields in it."*, NOT the unreadable sentence |
| 4 | **Word-only** — a real `.pptx` | ✅ *"Fields can only be read from Word (.docx) templates…"*, NOT the no-fields sentence |

**Why reading 1 is proof and not just a green screen:** those 11 names appear NOWHERE in the
frontend. They were obtained independently before the test by downloading the stored object with
the service role and running the real `parse_docx_template_variables` over it — so the only path
that puts them on screen is the server fetching the bytes under the caller's JWT and parsing them.
Corroborated server-side afterwards: all three UAT uploads are present in `storage.objects` under
`d8a54002-…/_library/0143b84f-…/`, so the upload path really ran.

⚠ **Two things were NOT driven live and are stated rather than implied.** (a) The **owner fence**
(another author's `asset_id` → 404) is covered by unit test RED-1 only — it was deliberately not
driven through the UI because a fenced read renders the SAME sentence as a genuine failure, so a
live pass would prove nothing a unit test does not prove better. (b) A trap worth inheriting: **three
of this operator's workflows** (`e7c68d09` Slack Connector UAT, `f77e72a0` + `84c45250` the SC10
probes) bind templates under the **seed user's** prefix `00000000-…/_library/`, so the fence
correctly 404s them and they render *"We could not read this template's fields"*. That is the fence
working, NOT a defect — do not test this feature with those three.

⚠ **`BUG-260809-02` is deliberately still `open`.** The unit suite proves the typed sentence reaches
the recorded `updateWorkflowDraft` argument; it cannot prove the live gauntlet accepts it. The plan
gates closure on a live reload + publish row that **was not driven** — no browser automation was
available in the executor session. **Owed manual UAT (run this first):** on the canvas door, type a
requirement, reload, confirm it survived, then Publish and confirm stage 1 "Goal" passes. Local
`feature_visibility.visual_workflow_canvas.audience` is `"everyone"`, so the control is visible.

## Guardrail overrides

None recorded during the v3.6 close. G-7 did not fire — no gap-closure round was opened; CONN-02
was routed to a future milestone precisely because closing it here would have added a user-facing
capability inside a closure round, which G-7 forbids.

## Accumulated Context

Cleared at the v3.6 close — the full decision log lives in `.planning/PROJECT.md` (`## Key
Decisions`) and the pre-close snapshot in `.planning/milestones/v3.6-STATE-at-close.md`. Open
blockers carried forward are the seven items under *Open at close* above.
