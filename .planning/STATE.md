---
gsd_state_version: 1.0
milestone: v4.7
milestone_name: Workflows You Can See and Start Anywhere
status: ready_to_plan
last_updated: "2026-10-22T00:00:00.000Z"
progress:
  total_phases: 17
  completed_phases: 6
  total_plans: 35
  completed_plans: 34
  percent: 35
---

# Project State

> ⚠ **This file was RESET at the v4.6 close (2026-10-18)** — the ninth reset, same reason each time.
> **Nothing was deleted:** the full pre-close file is archived verbatim at
> [`.planning/milestones/v4.6-STATE-at-close.md`](milestones/v4.6-STATE-at-close.md).
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs or `milestone.complete`.**

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-18)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** Phase 291 — describe-it-from-your-own-files (context gathered 2026-10-22; sketch next). Phase 290 executed, G-4 UAT owed.

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Current Position

Phase: 290 (the-card-and-the-team-picture) — EXECUTING
Previous: Phase: 294 (decision-engine-rerank-and-citation-check) — EXECUTED, human_needed (2026-10-20)
Plan: 1 of 4

### Roadmap Evolution

- Phase 294 added (2026-10-20, operator): Decision Engine: Rerank and Citation Check (DEC-01..03). It is outside the workflow theme, independent of 290-293, and can run any time after 289. Intake research: `phases/294-decision-engine-rerank-and-citation-check/294-INTAKE-RESEARCH.md`. `gsd-sdk query phase.add` wrote the entry under the v3.0 section; it was moved by hand into v4.7.
- Phase 294 context gathered (2026-10-20): `phases/294-decision-engine-rerank-and-citation-check/294-CONTEXT.md` (D-01..D-24). DEC-01 amended: Jev via OpenRouter only. Next for 294: `/gsd:sketch` (D-20, G-2) before `/gsd:plan-phase 294`. Phase 290 is still the current position.
- Phase 295 added (2026-10-20, operator): Runs That Don't Dead-End (RUN-01..04). It came from a measurement during sketch 290: 35 of 36 workflow gate failures in 60 days are `citations_required`, and no failure came from a missing branch or loop (`SEED-295` stays parked). Bugs `BUG-261020-07`..`12` are folded. `gsd-sdk query phase.add` wrote the entry under the v3.0 section again; it was moved by hand into v4.7. Sketch 290 winner: A org chart (`46c23fe00`).
- Phase 295 context gathered (2026-10-20, `--auto`): `phases/295-runs-that-don-t-dead-end/295-CONTEXT.md` (D-01..D-35). Folded BUG-261020-01, BUG-261015-01, SEED-360 F-2. Key finding: the engine-owned ask (citations gate + armed approval) is an in-process wait that fails on timeout, so RUN-01 and BUG-12 share one durable-pause fix. Next: `/gsd:plan-phase 295`.
- Phase 295 planned (2026-10-20, `--auto`): 7 plans in 4 waves (wave 1: 01, 02, 05; wave 2: 03, 06; wave 3: 04; wave 4: 07). Research `295-RESEARCH.md` (R1-R13 adopted as D-36..D-51), UI-SPEC approved 6/6, PATTERNS mapped. Plan check passed in round 2 (1 blocker + 8 warnings fixed in round 1). Requirements 4/4, decisions 45/45 cited (checked by hand: the decision gate parsed 0 and passed vacuously). Next: `/gsd:execute-phase 295`.
- Phase 295 executing (2026-10-21): waves 1-3 merged on develop (01 `ea1347c4d`, 02 `4c0549b43`, 05 `8cb01049e`, 06 `b78b8d14b`, 03 `288e995a9`, 04 `dec6986be`). 6 of 7 plans done; 453 cross-plan backend tests pass after the 04 merge. Plan 04 residual: the armed block writes a duplicate `action_risk_pending` row on re-drive (re-open: the phase that takes the armed-block seam). Plan 04 gap: a Stop on a live producer records no "Stopped by" reason (re-open: user id on the cancel broadcast). Next: backend restart, then plan 07 (live proof S1-S7, after-measures, ledger rows).
- Phase 295 all 7 plans merged (2026-10-21, `796c86919`). Live proof: S2-S7 pass; S1 fails in the chat panel (a paused run's ask reads Retired: SEED-361). Code review `bc4a31d54`: 1 critical (CR-01, an answer is not bound to the current question), 7 warnings, 8 info. G-7 gap round 1 of 2 (an SC#1 miss + a critical justify it): fix 295-08 (frontend: SEED-361 + WR-04) and fix 295-09 (backend: CR-01, WR-01..03, WR-05..07) run in parallel worktrees; IN-01..08 recorded, not fixed. New bug BUG-261021-01 (provider error offered as found nothing) is WR-01. Next: merge both, live re-drive of S1 in the chat panel, then the verifier.
- Phase 295 gap round 1 done (2026-10-21): fixes 295-08 (`88f62deec`) and 295-09 (`128266ef6`) merged; live re-drive `61eedca76`: S1 chat panel now answerable, CR-01/WR-01/02/03/05/07 pass live, BUG-261021-01 closed. Re-drive found 4 new defects: D-r1-01 (stale card says the run ended), D-r1-02 (open tab stops following the run after an answer, so SC#4 is unmet in the chat home), D-r1-03 (paused composer refusal says cancel, no cancel exists), D-r1-04 (owned folders from the other org still offered). **Guardrail record (G-7):** `check-gap-closure-rounds.cjs` reads 0 rounds because 08/09 had no PLAN.md; by hand this is round 1 done. Round 2 (295-10, the LAST allowed) is justified by SC#4 unmet (D-r1-02); it fixes all four. Any finding after round 2 is fast-fix / defer / accept, never round 3. Next: merge 295-10, live check of the four, then the verifier.
- **Phase 295 EXECUTED — human_needed (2026-10-21).** Gap round 2 fix 295-10 merged `9f11f3b21`; its live check passed 7/8, and the one fail (D-r2-01, a re-driven active run's next ask read as stopped) was fixed under G-3 as a fast fix (`07b7632bc`, not a round 3) and re-driven PASS (`0c1d60d53`). Verifier `6db3d0020`: 5/5 SC and RUN-01..04 verified; SC#3 is one judge sample, SC#5 is a mechanism measure on planted runs, not a production rate. Gates: backend unit 70 failed (same set as base, ceiling 71, run by 295-10); typecheck 63 (= base); ledger, CLAUDE.md size and seeds gates OK. ✅ Full vitest count gate OK on 2026-10-21 after close (486/486 pinned files, no per-file decrease, 0 failing, total 11015). Post-close agent drive: S3 (incl. the `Answered · run stopped` header, ~0.1 s on screen), S6 and S7 PASS; new D-uat-01 → BUG-261021-04 (followed run's final answer missing from chat, deferred), D-uat-02 (chat panel reads `act — Running` while the armed run is paused) owed to the operator. **Owed:** (1) operator G-4 sign-off on `295-HUMAN-UAT.md`, S1 first; (2) the cross-provider Anthropic row (billing). **Deferred with triggers:** BUG-261021-02 (folder/workflow create ignores X-Org-Id, major), BUG-261021-03 (followed run loses Unsourced mark), BUG-261021-04 (followed run's answer missing from chat), SEED-366 (author lock), SEED-367 (open thread cannot see an API-started run), SEED-363 (unit tests claim live local runs), review IN-01..08, plan-04 residuals (duplicate action_risk_pending; Stop on a live producer records no reason), paused composer vs F2 stale lock. Not pushed.
- **Operator decision (2026-10-21): moved on to Phase 290 with 295 still human_needed.** The G-4 sign-off on `295-HUMAN-UAT.md` (S1 first) and the D-uat-02 call stay owed; 295 is not closed as passed. Current position: Phase 290.
- Phase 290 context gathered (2026-10-21): `phases/290-the-card-and-the-team-picture/290-CONTEXT.md` (D-01..D-16). Measured first: sketch 179 C (shipped 192.2) already cut the card's purpose and phase glyphs, so VIS-04 adds only ONE chip line (first 3 + `+N more`). Production has 29 definitions, 7 with steps (2-3 each), 0 judges, 0 batch, 0 skip links. Team picture: org chart (sketch 290 A), builder `Steps | Team` switch only, no step-to-step lines, honest 1-step node, absence said in words, shipped step words + Judge/Check. SEED-155 and SEED-086 folded partially. Next: chip-line sketch (D-05) rendering the real card, then plan.

---

## Milestone close (2026-10-18)

**v4.6 Pay It Down COMPLETED by hand:** archives in `.planning/milestones/v4.6-*` (ROADMAP, REQUIREMENTS,
MILESTONE-AUDIT, STATE-at-close, phases/), tag `v4.6` (local, not pushed), 24/24 requirements, audit
`tech_debt`, no blockers, integration 9/9. Closed core 7 phase types / 1 emitter / **30 tools**.

## Production

Live at `4e767a3a2` (2026-10-16): phases 280-285, migrations 207-209 in cloud. Branch `develop`.

## Owed (operator)

- Confirm the Coolify rebuild from outside; run a logged-in production smoke test.
- 282: G4-4, G4-6 (needs an approved write), A1 LangSmith nesting, Add-form click-through.
- 281: G-4 rows A, C, D.
- Pre-close artifact audit: 39 open entries, almost all pre-v4.6 (`gsd-sdk query audit-open`).
- v4.6 public changelog line for the `GET /documents` envelope breaking change (R-06).
- Open bugs not named in v4.6 requirements: see `.planning/reported-bugs/` (`status: open`).
- 295 decisions, answered by the operator 2026-10-20 ("proceed with what you recommend"):
  1. No author lock on detected KB steps in 295; sketch 142 stands. "Locked" = the stored `grounding_escalated` bit (D-36). Held in `SEED-366`.
  2. Yes, delete the 15 leaked `test_214` fixture rows locally. **DONE 2026-10-20 by the operator** (the auto-mode classifier blocked Claude from running it): `runs: DELETE 15`, `threads: DELETE 15`. Failed runs without `run_failed` now **5** (the June producer escapes, D-43). Plan 02's base measure runs after this delete. Research's 285-run SC#5 denominator included these 15 rows and is superseded by plan 02's re-measure.

## Guardrail overrides

- **Phase 295 — G-2 (sketch before plan for UX), 2026-10-20:** not run. The operator asked for autonomous end-to-end completion. The found-nothing pause reuses `PendingAskCard`'s live-answer layout, and the unsourced mark reuses the 289 evidence-line vocabulary (295-CONTEXT D-30). The G-4 browser drive is the check. The operator may ask for a sketch of the pause card.
- **Phase 295 — plan 05 G-5 over budget, recorded, not hidden (2026-10-21):** the work stayed one-touch in shape but exceeded the count:
  - `api/workflow_runs.py`: +5 functions. 3 do I/O, so they cannot live in the new pure `run_read_wire.py`.
  - `api/threads.py`: one field plus one one-time name lookup.
  - `types/index.ts`: 3 fields, not 2, because `AskUserAnswerBody.folder_id` lives there.
  - `db/workflows.py`: edited outside the plan's file list. `get_unanswered_ask_user` returns `created_at` and `engine_pause`.
  - `WorkflowRunPage.tsx`: deliberately untouched. A finished run renders the evidence report (since 289-04), so a band mount could never render; the reason line lives in the report instead.
  - Detail: `295-05-SUMMARY.md`.
- **Phase 295 — SC#3 reading, measured 2026-10-20 (295-02):** at base, the production DMT shape is refused at **lint** (Phase 214: the email step has no `to` / `subject`), not by the judge. With those two set, it published **4 of 4** (judge 100 / 100 / 95 / 100, `gpt-5.4-mini`), and the judge graded the honesty of the NOT-SENT envelope rather than the content.
  - The August blocks came from an older judge.
  - After 295-02 the judge sees the full recorded content, so plan 07's after-publish of draft `edd81b32` is the real SC#3 test.
- **Phase 295 — G-8 plan count 7, 2026-10-20:** 7 plans in 4 waves, against the 3-5 target. Plan 01 is a pure-move seam that must stand alone (D-51). The frontend splits between `PendingAskCard.tsx` (plan 06) and the read-side change (plan 05), which cannot share one context budget (295-CONTEXT D-52). Verifier, TDD RED, security review and migration discipline not cut.
- **Phase 295 — ledger rows deferred to plan 07, 2026-10-20:** 8 files with no ledger row (`engine_ask.py`, `run_handoff.py`, `run_read_wire.py`, `api/panel.py`, `harness/human_input.py`, `RunEndReasonLine.tsx`, `enginePause.ts`, `AskFolderChoice.tsx`) get their rows and sections in one plan-07 commit (289 precedent), so parallel worktrees never collide on `docs/HOT-FILE-LEDGER.md`.
- **Phase 295 — UI-SPEC interprets CONTEXT D-30, 2026-10-20:** two deliberate departures from D-30's examples. (1) The unsourced glyph is `◌`, not `○`, because `○` already means "searched, nothing matched" on the same 289 evidence line. (2) The folder choice is a new small `Select` fed by a list the server has already bounded, following `MoveToFolderDialog`'s pattern. It does not reuse a shipped picker, because every shipped picker loads the user's whole folder list, which would break D-03 (never widen access). The operator may reverse either.
- **Phase 295 — auto-fold rule overridden, 2026-10-20:** the todo `spike-nl-workflow-authoring` matched at score 0.6 (≥ 0.4 auto-folds), on keywords only. It was not folded on the scope guardrail, because it is NL authoring and already routed to Phase 152 (295-CONTEXT `<deferred>`).
- **Phase 289 — G-5 audited reading of 'one touch' (D-16), 2026-10-19, written before any source edit:** two hot files get two touches each, and each touch is the smallest shape D-16 names. `frontend/src/pages/WorkflowRunPage.tsx`: plan 01 adds one attribute (`paused`) at the existing PendingAskCard mount; plan 04 adds one early return after every hook mounting RunEvidenceReport; useState and useEffect counts unchanged (measured before and after in 289-01 and 289-04 SUMMARYs). `backend/app/api/workflow_runs.py`: plan 02 adds one declared wire field (`confidence`, produced in lockstep); plan 05 changes the compose_waiting_on paused sentence ONLY if S5 is driven green. Recorded as an audited reading of D-16's 'at most one mount, prop, field or helper', not silently applied; plan 05 confirms it with the measured counts; the operator may overrule. (Written by the execute-phase orchestrator instead of plan 01 Task 1 step 0, because worktree executors may not write STATE.md; this also orders it before plan 02's parallel edits.) **CONFIRMED by 289-05, measured (not a second entry):** `WorkflowRunPage.tsx`: 289-01 `useState(` 1 → 1, `useState[(<]` 4 → 4, `useEffect(` 4 → 4 (one attribute, 1580 → 1581); 289-04 `useState(` 1 → 1, `useState<` 3 → 3, `useEffect(` 4 → 4 (one import + one early return, 1581 → 1594). `workflow_runs.py`: 289-02's `confidence` field landed in lockstep; the second touch HAPPENED: S5 was driven PASS live, so the paused sentence was restored at `dd863ca5a` (+2 lines). Both readings held.
- **Phase 289 — G-8 plan count, 2026-10-19:** five plans, against D-18's and research's four. The fifth exists because the evidence read (backend, plan 03) and the report (frontend, plan 04, an 87-case terminal-test migration, not the 45 researched) could not share one context budget; plan 04 ran four tasks (plan-check W2). The verifier, TDD RED drives, security review and migration discipline were not cut; no migration was needed.
- **Phase 289 — drive tooling, 2026-10-19:** S1-S5 and the roster were driven through headless Chromium (Playwright) and local DB reads, not the claude-in-chrome tools, which the 289-05 executor did not have (same deviation as 288). Evidence: `289-VALIDATION.md`, `evidence/`.
- **Phase 289 — named gaps, recorded not fixed (no gap round):** the chat panel's `PendingAskStack` cannot see a paused run (SEED-361; trigger: next phase naming `StreamsProvider.tsx` or `streamsStore.ts`); a resumed segment runs on the owner's default model, measured on every roster row (SEED-362); the run-level final-message confidence uses default buckets (F3, `harness_engine._finalize_run_grounding`); SEED-360 F-2 and F-4 stay deferred; a TestClient lifespan can claim a live run in the shared DB, reproduced three times this phase (SEED-363); org default names embed the founder's email (SEED-364, observation from S4). Report follow-ups F-A..F-E (289-04) open. Anthropic roster row BLOCKED (billing, re-tested).
- **Phase 289 — backend unit gate over the 71 ceiling, inherited:** final HEAD `217e90d33` 78 failed / 7862 passed; the phase base `dcf6ba649` 78 failed / 7779 passed; the two 78-id failing SETS are identical (two HEAD-only fence reds were this phase's own and were re-pinned with reasons). The ceiling was not raised. Detail: `289-05-SUMMARY.md`.
- **Phase 289 — D-214-06 escape-hatch fence, audited reading:** the report's "Download JSON" (D-14a) is exempted EXACTLY (file + constant + value) in `argumentVocabulary.test.ts`, with a scope case; a second JSON label still fails (driven red). The operator may reverse it by renaming the label instead.
- **Phase 287 — G-2 (sketch before plan for UX), 2026-10-19:** not run. The operator was away and asked for autonomous completion; both surfaces reuse shipped vocabulary (Run modal/ChatLaunchForm shell, Starters shelf card). The G-4 browser drive is the visual acceptance bar. No operator-approved mockup exists for the in-thread "Run a workflow" action.
- **Phase 287 — sketch 011 anti-pattern tension:** the in-thread start is an action button (no aria-pressed, no composer state), not a mode pill. Recorded as a deliberate departure; the operator may reverse it.
- **Phase 288 — G-2 (sketch before plan for UX), 2026-10-19:** not run. The operator was away and asked for autonomous completion. The decisions surface reuses sketch 174's vocabulary; the waiting-on line reuses the shipped `waiting` tone. The G-4 browser drive is the check. The operator may ask for a sketch of the waiting-on moment.
- **Phase 288 — G-8 plan count, 2026-10-19:** four plans (01 draft row, 02 gauntlet, 03 waiting-on, 04 live proof), inside the 3-5 target. The verifier, TDD RED drives, security review and migration discipline were not cut.
- **Phase 288 — drive tooling, 2026-10-19:** the live drives S1-S4 and the roster were run through headless Chromium (Playwright) and local DB reads, not the claude-in-chrome tools, which the executor did not have. Evidence: `288-VALIDATION.md`, `evidence/`.
- **Phase 288 — plan 04 notes:** SEED-183 flipped to `answered` (generate-and-dismiss arm owed, billing) and SEED-164 to `partially-answered`; SEED-137 cited as re-run green (`test_187_armed_checkpoint_property`, `test_185_engine_attachment`). The 286 OpenAPI/AST pins and the 276 OpenAPI snapshot were deliberately re-baselined for the two additive wire fields (reason in the test docstring). `test_182_validate`'s interactive-phase case was inherited red since 200.3 and is re-pointed.
- **Phase 288 — open defects found live (not fixed, no gap round):** F-1 Expired card offers no answer while the line says it will continue; F-2 the judge blocks a mock-answered pause workflow often; F-3 a paused run answered after its window strands `active`; F-4 the Builder closes the gauntlet on success so the `auto_answered` note is never seen. Details in `288-04-SUMMARY.md`.
