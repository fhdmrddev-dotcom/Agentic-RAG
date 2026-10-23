---
phase: 295-runs-that-don-t-dead-end
plan: 07
subsystem: live proof, ledger, gates
tags: [uat, g-4, sc-3, sc-5, roster, ledger, g-5, seed-361, seed-363]
requires:
  - "295-01..06 merged to develop and served by the :8000 worker (reloaded 2026-10-21 03:42:42 +04)"
provides:
  - "295-VALIDATION.md filled: S1-S7, SC#3 after, D-47, the four-axis scoreboard, SC#5 after with its queries"
  - "295-HUMAN-UAT.md: the owed operator G-4 rows, S1 first"
  - "docs/HOT-FILE-LEDGER.md + CLAUDE.md: rows and sections for every file 295 touched, six new rows"
  - "scripts/vitest-count-gate.cjs: the four new 295 suites adopted into both knobs"
affects: [295 verification, SEED-361, SEED-363, SEED-360, SEED-137, BUG-261020-07..12, BUG-261020-01, BUG-261015-01]
tech-stack:
  added: []
  patterns:
    - "Live drive: headless Playwright with a magic-link GoTrue session placed in localStorage; API steps on the same token"
key-files:
  created:
    - .planning/phases/295-runs-that-don-t-dead-end/295-HUMAN-UAT.md
    - .planning/phases/295-runs-that-don-t-dead-end/evidence/ (43 screenshots, 4 JSON records)
  modified:
    - .planning/phases/295-runs-that-don-t-dead-end/295-VALIDATION.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - scripts/vitest-count-gate.cjs
    - .planning/seeds/SEED-360-answering-a-paused-run-does-not-resume-it.md
    - .planning/seeds/SEED-137-armed-checkpoint-precedence-bypass.md
    - .planning/seeds/SEED-361-chat-panel-ask-stack-cannot-see-a-paused-run.md
    - .planning/seeds/SEED-363-a-testclient-test-can-claim-a-live-run-in-the-shared-db.md
    - .planning/reported-bugs/ (8 folded reports, a dated body note each)
decisions:
  - "D-47 / D-17: no _golden_run_mock note. 4 of 4 pause-plant publishes passed and none cited the auto-answer, so validator_kinds.py and publish_service.py are unchanged and no after-merge re-drive is owed"
  - "S7's two historical stuck runs were ended before the merge by a worktree test process, not by the shipped reconciler; the merged reconciler was proven on a freshly planted stuck run instead"
  - "S1 is recorded FAIL in the chat-panel home (the live ask is shown RETIRED), PASS on the run page; not fixed here because it is not caused by 295-07 and needs its own RED test"
metrics:
  duration: "~1h30m"
  completed: 2026-10-21
  tasks: 3
  files: 65
---

# Phase 295 Plan 07: Live proof, the ledger once, every gate once

**The phase was driven as a user against the merged code.** On the run page:
- a KB step that finds nothing pauses, offers worded choices, re-runs on another folder, and completes cited;
- Continue is marked unsourced in all four places;
- a Must-prove-it step refuses a forged Continue with 422;
- a template-less report step is named at save and refused at publish and at run start;
- the DMT shape publishes;
- the next step hears the person's answer;
- runs end with true reasons.

**One real defect was found:** the chat thread's Workspace panel shows the same live ask as RETIRED. The ledger, the FIRING cells and the count-gate adoption landed once, and every gate ran once.

## Verdicts (plain)

| Row | Verdict | Evidence (295-VALIDATION.md) |
|---|---|---|
| S1 found nothing → pause → another folder → cited | **FAIL in the chat-panel home**, PASS on the run page | `b8a3e6f3`. Run page: prompt, three chips, no clock, reload, 30 server-bounded folders, the folder recorded, completed with 10 cited passages. Chat panel: `RETIRED · The run was stopped, so this question no longer needs an answer` on live paused runs `3ec118a2` / `108bb381` |
| S2 Continue → unsourced in four places | **PASS** | `d5d77eed`: run-page spine, chat panel card, evidence page, downloaded JSON (`unsourced.continued_by` + `at`, no stored id) |
| S3 locked step: no Continue, forged answer refused | **PASS** (the answered header was not seen live) | `b9c4635d`: paused with 2 choices and the locked addendum; `Continue without sources` absent from the HTML; 4 forged POSTs → 422, 0 response rows, still paused; Stop → failed with the Stop sentence |
| S4 no template: named, refused at publish and run start | **PASS** | Builder tray + Publish disabled + Save works; publish `blocked_stage: lint`; Run modal and thread entry both 400 with the server's sentence in the DOM; a template asset clears it |
| S5 DMT shape publishes | **PASS** | `edd81b32` published; the judge now grades the email's content |
| S6 the wrap quotes the answer | **PASS** | `dda11389`: wrap text quotes "Yes" |
| S7 truthful ends | **PASS, cause corrected** | Fresh stuck run `ef53f1fc` ended by the merged reconciler in 23 s with its sentence; 5 reasonless June runs read the no-reason sentence; the armed run reads Paused, then Cancelled + `Stopped by …` |

## Success criteria

- **SC#1 (pause with choices, survives, answerable): not fully met.** It is met on the run page, and live on 7 providers + 3 axes. It is **not met in the chat-panel home**, which shows the live ask as retired. Owed: one fix plus its live re-drive.
- **SC#2 (missing template refused before the run): met** (S4, all four paths).
- **SC#3 (DMT shape publishes): met** on one sample (S5).
- **SC#4 (every run ends true, with a reason; waiting reads waiting): met on the run page** (S7, S3, armed Stop). The two historical runs read Cancelled with no reason line, which UI-SPEC C.1 specifies for a cancelled run with no recorded reason. The live-producer Stop gap (295-04) was seen live and is recorded.
- **SC#5 (citation-failure share measured): met as a measurement.** 0 of 23 terminal runs in the UAT window ended in `citations_required`, against 8.3 % since 2026-09-01. 15 gate firings went 13 completed, 1 failed (Stop), 1 cancelled. ⚠ This is the mechanism on planted runs, not a production rate.

## Gates (each run once)

- **Backend unit:** `cd backend && venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider -rf` at HEAD gave **70 failed, 8638 passed, 1 skipped, 2 xfailed, 2 xpassed** (8:44). Ceiling 71: within it.
  - **Failing-id SET diff vs base `018fbd5c7`: empty.** This plan changed no backend or frontend source (`git diff --stat 018fbd5c7 -- backend frontend` is empty), so HEAD and base share the source and this one run measures both.
  - Cross-check against 295-04's recorded HEAD id list (70 ids): `comm` is empty in both directions.
  - ⚠ This run re-drove a live run (see SEED-363 below).
- **Out-of-unit suites** (`test_200_human_gate_pause`, `test_harness_resume`, `test_295_engine_ask_redrive`, `test_run_reconciler`, `test_228_cap_paused_reconcile`, `test_288_waiting_on`, `tests/integration/test_214_argument_seams`, `test_259_closed_core_inventory`, `test_295_judge_recorded_intent`; `-p no:randomly`, no live runs present): **128 passed, 1 failed.** The failure is `test_200::test_no_twenty_fifth_audit_kind_was_added`, inherited and red at base. The hanging `test_096_ci_workflow_regression`, `test_harness_gates::test_caps_step_and_wall_clock` and `test_harness_templates` e2e were not run (inherited hangs).
- **Closed core:** `test_259_closed_core_inventory.py` passed (7 phase types / 1 emitter / 30 tools).
  - No migration: `ls supabase/migrations | tail -1` = `211_message_citation_checks.sql` = the phase base `7fdf86e70`, and `git diff 7fdf86e70 HEAD -- supabase/migrations` is empty.
  - No audit kind added.
- **Frontend typecheck:** `npx tsc -p tsconfig.app.json --noEmit` gives 63 errors (55 distinct after line-number normalisation). **The set diff against the phase base set (7fdf86e70, recorded by 295-05) is empty**, and no error sits in a file 295 touched.
- **Vitest count gate:** see `## Vitest gate` below.
- **Ledger:** `node scripts/check-hot-file-ledger.cjs .planning/phases/295-runs-that-don-t-dead-end` gives `ledger gate OK — every watched file has a row` (exit 0; 621 rows, 44 watched). `node scripts/check-claude-md-size.cjs` reads 97,438 chars, exit 0. `node scripts/check-seeds-register.cjs` passes.

## Vitest gate

One full run: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the worktree root, read from the gate's own JSON report (`C:\Users\fhdmr\AppData\Local\Temp\vitest-count-gate-49124-1792544168682.json`).

- **Verdict line:** `RESULT: COUNT GATE VIOLATED (1 reason(s))`, `[failing-tests] 1 test(s) failed`. Total 10,990 against a pinned 10,215.
- **No per-file decrease:** the only reason given was failing tests.
- **The four adopted suites ran in the gate at their pins:** `enginePause.test.ts` 17/17, `RunEndReasonLine.test.tsx` 13/13, `AskFolderChoice.test.tsx` 7/7, `threads.engineAsk.test.ts` 2/2.
- **The one failure,** read from the report before anything was re-run: `src/docs/__tests__/publicOpenapi.test.ts` › "--check passes on the committed file and fails once a copy drifts" (`expected 1 to be +0`).
  - **It was inherited, not caused here:** `node scripts/build-public-openapi.cjs --check` printed `[drift] docs/public/api/openapi.public.json does not match the snapshot`. `git diff --numstat 018fbd5c7 HEAD -- docs/public/api scripts/build-public-openapi.cjs frontend/src/docs` was empty before the fix, so the inputs are byte-identical to base and the suite was red at base too.
  - **Its cause:** 295-03's `e9be97a04` regenerated `openapi.snapshot.json` (adding `AskUserResponseBody.folder_id`), but not the public spec derived from it.
- **[Rule 3] Fixed:** `node scripts/build-public-openapi.cjs` regenerated the public spec (+11 lines, exactly the `folder_id` property), and `--check OK` followed.
  - The single suite was re-run alone: 15/15 passed.
  - The full gate was **not** re-run (one gate run per plan), so `count gate OK` is not claimed. What stands: 1 failing, inherited and now fixed, plus no per-file decrease.
- `WorkflowBuilderPage.canvas.test.tsx` (SEED-171) was green in this run. It is provably unmodified. One green sample is an observation, not proof.

## Deviations from Plan

1. **[Drive method] Session by magic link, not the login form.** A GoTrue session was minted with the local admin `generate_link` plus `/verify` (295-02's method) and placed in `localStorage`. No password was read. Every UI verdict still reads the live DOM.
2. **[Rule 1, driver bug] Two driver mistakes, caught and undone.**
   - A loose card locator pressed Run on a shared starter ("Compliance Gap Report"). The run was cancelled in 21 s and its thread deleted.
   - A stray click on a sidebar thread made the first thread-entry S4 read look like a missing sentence. It was re-driven without the click.
3. **[S7] The plan's expected sentence was not written for the historical runs**, because the evidence shows they were ended before the merge, as `cancelled`. Instead, the merged reconciler was proven on a planted stuck run (the operator's brief allowed this).
4. **[S2 plant] KB → approve → wrap, not the bare S1 plant**, so the run stays live after the KB step and the run-page spine can be read.
5. **[S4] Published past lint by direct DB** for the Run modal drive (drafts show only "Open"). It was deleted at cleanup, because published rows are immutable.
6. **[Commits] Tasks 1 and 2 share one VALIDATION commit** (`f97e6fbdd`), because both fill the same file. No source changed, so Task 2 has no TDD commits (the D-17 condition did not trigger).
7. **[Rule 3] The public OpenAPI spec was regenerated** (`docs/public/api/openapi.public.json`, +11 lines, `folder_id`). It was inherited drift from 295-03 that turned the count gate red. See `## Vitest gate`.
8. **[Rule 2] SEED-361 and SEED-363 were updated** although they are not in the plan's file list. Both are the record of live findings (the panel retirement, and the test-process sweeps).

## For the orchestrator

**STATE.md lines** (this worktree writes neither STATE.md nor ROADMAP.md):
- **Guardrail overrides:**
  - G-2 skipped (D-30): no sketch for the found-nothing pause; the existing card layout was reused.
  - ◌ (U+25CC) proposed as the "kept without sources" glyph against `references/icon-convention.md`, distinct from 289's ○ (295-05).
  - Folder picker: the D-30 "reuse the existing folder picker" was interpreted as a new server-bounded leaf (`AskFolderChoice`) on the shadcn Select pattern, because every existing picker reads the whole folder list (295-06; T-295-06-01).
- **Owed operator decisions:**
  - D-36: should detected KB steps get a lock control? It would reverse sketch 142's "NO switch".
  - Does the canvas label "⛨ Must prove it" still read true on a KB step whose pause offers Continue?
  - Should a Cancelled record carry the ⊘ glyph?
  - Does the empty thread a refused Run-modal start leaves behind matter?
- **D-43, proposed, not done:** delete the 15 leaked `test_214` fixture rows. Measured 2026-10-21: they are already absent from the local DB (Q-9b returns 5 rows), so there is nothing left to delete locally.
- **G-8 (D-34 / D-52):** the phase ran 7 plans, not the suggested 5.
  - Plan 01 is the pure-move seam D-51 requires on its own.
  - The frontend split exists because the 33-file read change (05, wave 1) and the 1,052-line FIRING `PendingAskCard` (06, wave 2) cannot share one worktree budget.
  - The verifier, TDD RED, security review and migration discipline were not cut.
- **G-4 sign-off OWED:** `295-HUMAN-UAT.md`, S1 first. It is known to fail in the chat panel until the fix below lands.

**New work found (route it; not fixed here):**
1. **The chat panel retires a live engine ask (SEED-361 fired, now `open`).** This is a 295 regression for the armed approval and a 295 exposure for the found-nothing pause.
   - Code: `frontend/src/components/panel/PendingAskCard.tsx:897`, with the lock-seed gates at `frontend/src/providers/StreamsProvider.tsx:2536` and `frontend/src/components/chat/ChatArea.tsx:380`.
   - Proposed: `/gsd:fast` with a RED test in `PendingAskCard.retired.baseline.test.tsx`, then a live re-drive of S1 in the chat home.
   - G-7: phase 295 has run 0 gap rounds.
2. **A provider error on the KB step is offered as "found nothing".** Seen on the Anthropic row: the step text is the raw `credit balance is too low` error, `retrieval_error` is null, and Continue keeps the error as unsourced output. Propose a reported bug.
3. **SEED-363 is now observed three times; route it to a phase.** A worktree `tests/unit` run boots the real lifespan against the local DB.
   - It ended S7's two runs at 23:22:22Z.
   - 295-07's own gate re-drove live run `6ec2f298`.
   - Until it is fixed, never run `tests/unit` while live runs exist.
4. **Seeds whose triggers fired for 295 and were not routed at discuss** (`check-seeds-register --phase 295`): SEED-361, SEED-362 (a resumed run finishes on the owner's default model; the roster's sub-runs used each provider's sub-agent model), SEED-363, SEED-364, SEED-366. The verifier or discuss for the next phase should fold, defer or leave each one.
5. The judge rubric names no score scale (scores 8 / 10 / 100 in one hour). It is an observation only.

**ROADMAP progress row:** `295 | 7/7 plans | executed; verification owed; G-4 sign-off owed; S1 FAIL (chat panel) routed to /gsd:fast`.

**Merge note:** this branch changes no source. `graphify update .` was not run (it would write `graphify-out/` in a worktree); run it after the merge.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. T-295-07-01: local DB under the lock, ids snapshotted and diffed, 0 ids removed except the operator's background watch rows. T-295-07-02: no Supabase MCP call. T-295-07-03: driven as an attack; every forged answer got 422. T-295-07-04: no token in VALIDATION or the evidence JSON (scanned). T-295-07-05: the D-17 note was not added.

## Self-Check: PASSED

- FOUND: 295-VALIDATION.md (0 `_(owed)_` left), 295-HUMAN-UAT.md (S1 listed first), evidence/ (43 screenshots, 4 JSON records), docs/HOT-FILE-LEDGER.md rows for all six new files
- FOUND commits: `f97e6fbdd` (drives and measurements), `02f2a200f` (ledger), `cf53df6e9` (gates, owed G-4 rows, seeds and bugs)
- `git diff --diff-filter=D --name-only 018fbd5c7 HEAD` is empty; no application source file changed (only the generated public OpenAPI spec was regenerated); no migration; STATE.md and ROADMAP.md untouched
- The local-DB lock was taken at 23:57:57Z, refreshed at 00:38:33Z and released at 00:56:13Z
