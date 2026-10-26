---
phase: 296-close-v4-7-debt
plan: 05
subsystem: tests, gates, roster, records, seeds (W5)
tags: [tests, gates, cross-provider, roster, records, seeds, g-4, close-out]
requires:
  - phase: 296-01..04, 296-06, 296-07
    provides: every FIX row; this plan records, proves and gates them
provides:
  - "scripts/run-296-board.py — the D-21 roster driver (per-request model+provider, local-only asserts, lock, ledger-driven cleanup)"
  - "296-HUMAN-UAT.md — the eight D-20 G-4 scenarios with exact setup (pending, orchestrator), optional rows 9-12, the roster board, the 4 axes, the 287-V-3 cloud read"
  - "296-INVENTORY.md ## Outcome (296-05) — one line per inventory row (133/133)"
  - "SEED-375..387 planted; SEED-360..365 answered/updated; SEED-367 routed"
  - "check-backend-unit-baseline.cjs fails closed; check-seeds-register.cjs reads 4-digit ids; decision-fault-server.py answers choice"
affects: [STATE.md (orchestrator blocks below), /gsd:secure-phase 296, DEPLOY]
tech-stack:
  added: []
  patterns:
    - "A real-Postgres fault-injection test: only the engine edges faked; every verdict read back from the DB"
    - "Line-number pins re-keyed on the enclosing function (ast)"
key-files:
  created:
    - scripts/run-296-board.py
    - backend/tests/unit/test_296_redrive_fault_injection.py
    - backend/tests/unit/test_296_describe_caps_lockstep.py
    - .planning/phases/296-close-v4-7-debt/296-HUMAN-UAT.md
    - .planning/phases/296-close-v4-7-debt/evidence/roster/
    - .planning/phases/296-close-v4-7-debt/evidence/gates/tsc-head-file-code-set.txt
    - .planning/seeds/SEED-375..387 (13 files)
  modified:
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
    - backend/tests/unit/test_287_fork_isolation.py
    - backend/tests/test_182_extraction_parity.py
    - backend/tests/test_182_canvas_gate.py
    - backend/tests/test_200_human_gate_pause.py
    - backend/tests/unit/test_075_4_unknown_provider_error.py
    - backend/tests/unit/test_294_fault_base_guard.py
    - scripts/check-seeds-register.cjs
    - scripts/decision-fault-server.py
    - scripts/check-backend-unit-baseline.cjs
    - .planning/reported-bugs/ (21 reports)
    - .planning/seeds/SEED-360..365, SEED-367
    - .planning/phases/296-close-v4-7-debt/296-INVENTORY.md
    - .planning/phases/287-start-from-a-thread-fork-a-starter/287-VERIFICATION.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "293-F-4 is NOT closed: the live board reproduced OpenAI's 400 for an emit pinned to gpt-5.6-luna from every non-OpenAI run provider (API surface resolved under the run provider's settings); a pin to a chat-completions model passes everywhere. Routed to the orchestrator under G-7."
  - "The live :8000 backend predates the 296-06 merge (its /openapi.json lacks AutoAnsweredNote / needs_task / unplaced_sentences that the main checkout's source has); 296-06-dependent board rows are re-run after the operator restarts uvicorn."
  - "User-visible bug reports stay `folded` into 296 with their fixing commit and the G-4 row that closes them; none is closed before its live PASS (D-19 / SC#5)."
  - "Close-only 295 bugs read verified_closed_by \"295\" (295's signed G-4 verified them); only BUG-261020-03 reads \"296\" among the closes made now."
  - "check-backend-unit-baseline.cjs was fixed in scope (Rule 2): the D-22 gate's own instrument reported a false pass."
requirements-completed: []
duration: in progress (checkpoint)
completed: pending
---

# Phase 296 Plan 05: tests, gates, roster, records and seeds — SUMMARY (at the checkpoint)

**Every TEST row is fixed, and every inventory row has a written outcome (133/133; the coverage loop finds 0 missing). 13 seeds are planted and 7 updated. 9 close-only bugs are closed, and 12 fixed bugs wait on their named G-4 row. The live board passed 291-S6-F8 on all six reachable providers and found a remaining 293-F-4 defect. The plan stops at a checkpoint for two reasons: the hung pytest (PID 94388) still blocks the full backend and vitest gates, and the G-4 drive belongs to the orchestrator.**

**Base:** `a3cac42da` (develop, with 296-01..04, 06 and 07 merged). Phase base: `a5077f083`.

## Commits

| Hash | What |
|---|---|
| `19f54cf71` | 286-IN-02: finish_run call sites keyed on the enclosing function (ast) |
| `439f8f86a` | 286-S04-1: eslint `no-useless-escape` |
| `c12c758ac` | 287-WR-03: the fork-isolation test attempts the attack (service-role path and user-JWT RLS, with positive controls) |
| `40d2629ce` | 288-T-3: canvas schema set re-pinned with 293's `RunOriginWire` (run under the lock) |
| `f617cc5b4` | 288-T-2: grounding-fidelity count 8 → 11 (206.2-01 `7740e0106`) |
| `2cfefddbe` | 289-T-1: audit kinds 24 → 25 (`circuit_breaker_tripped`, 204-02 `daf6c123b`) |
| `7af00ac5d` | 292.1-test_075_4: known providers 5 → 11, each dated |
| `67cc8c701` | 293-IN-07: `\d{3,}` seed ids (driven RED in a scratch copy of the register) |
| `ac7cd871f` | 294-IN-03: the fault server answers `choice` |
| `6a9fd0745` | 291-R1-IN-01: describe caps lockstep (driven RED by a planted 201, file restored md5-identical) |
| `21327fb9c` | 289-V-2: re-drive fault injection against real Postgres |
| `e7dbed0de` | the backend baseline gate fails closed and keeps `tests/unit` |
| `f1d6dbd70` | seeds: SEED-375..387 planted; SEED-360..365 and 367 updated |
| `a11f9c670` | bug records (21 reports) |
| `0ffbd72a0` | ledger rows for the three scripts touched |
| `4f0e234e3` | `run-296-board.py`, roster evidence, `296-HUMAN-UAT.md` |
| `996f527c8` | the inventory `## Outcome (296-05)` table and the 287 D-12 note |

## Task 1: TEST rows (all fixed; RED evidence per row)

| Row | RED → GREEN |
|---|---|
| 286-IN-02 | The file records 19 earlier line re-derivations. Sites are now keyed `<file>::<function>[#n]` by ast, with an AST-vs-text count cross-check. 4 passed |
| 286-S04-1 | eslint reported `958:38 no-useless-escape`. Now clean; the suite passes 42/42 |
| 287-WR-03 | New test `test_a_non_owner_cannot_write_a_starter_or_anothers_fork`, run under the lock. 3 passed. Measured: <br>• Service-role path: B's update and delete on the starter and on A's fork are refused. A cannot edit or delete the PUBLISHED global it created. <br>• User JWT (`SET LOCAL ROLE authenticated` + `request.jwt.claims`): the same writes return 0 rows, and A cannot flip its fork to global (WITH CHECK). <br>• Positive controls on both boundaries; byte-equal re-reads; 0 rows left |
| 288-T-2 | RED `11 == 8`. The three extra defs are 206.2-01's MCP boundary cases (`7740e0106~1` has 8, `7740e0106` has 11). 6 passed |
| 288-T-3 | Run under the lock. RED only on `RunOriginWire` in the schema diff (293-03 `e84122d60`); the path set is unchanged. 8 passed |
| 289-T-1 | RED `25 == 24`. The 25th kind is `circuit_breaker_tripped` (204-02, five days after the pin). The test name is kept so its id moves red → green |
| 289-V-2 | New real-Postgres test, 4 passed, 3/3 repeat runs, 0 rows left. Each fault ends the run truthfully: <br>• spawn fault → `failed`, a worded phase reason, one `run_failed`, anchor cleared; <br>• held lease → one retry re-drives once; <br>• a second lost claim → stops (no loop); <br>• unloadable definition → `failed` from `paused`. |
| 291-R1-IN-01 | New lockstep test: 7 caps plus the field-key character class. RED: a planted `FORM_LABEL_MAX = 201` gives `the client mirrors 201, the server enforces 200`. File restored, md5 `d57d0d32…` |
| 292.1-test_075_4 | RED: 6 extra providers. Dated table: 076.1-01 (4 providers), 111-01 (lmstudio), mig 180 (custom). 7 passed |
| 293-IN-07 | Driven in a copy of the register, never the real one. RED: 381 files counted, `[unknown-seed] SEED-1000`. GREEN: 382 counted, settled. Self-test 10/10 |
| 294-IN-03 | New case in `test_294_fault_base_guard.py`. RED: the base script gives `couldnt_check`. GREEN: `(supported, 0.9)` for both jev and openai; refusal mode still refuses. 107 passed |
| 293-INH / 295-TEST | ⏳ waits on the vitest count gate (blocked, below) |

Task 1's verify command, non-DB part: `44 passed`. The DB part ran under the lock: fork isolation 3 passed, fault injection 4 passed.

## Gates (D-22): HEAD vs base

| Gate | Result |
|---|---|
| Backend unit gate (`node scripts/check-backend-unit-baseline.cjs`, no args, under the lock) | ⛔ **NOT RUN: blocked.** The hung pytest from 296-02 (Windows PID **94388**, about 28-31 GB, launcher **101060**) was alive at every check, including the last one. Per instruction, it was neither killed nor run alongside. **Expected result:** 69 failed, with the set ⊆ base. 296-06's final set was 70, and 292.1-test_075_4 was its one red inside the gated set; that test is now green. Every other 296-05 change is a test or a script outside `app/`. |
| Vitest count gate (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`) | ⛔ **NOT RUN: blocked** by the same process. 296-04 and 296-07 each deferred their gate to this plan, so their new test files may need count-gate pins. |
| tsc (`npx tsc -p tsconfig.app.json --noEmit`) | **62 errors at HEAD.** The set is saved to `evidence/gates/tsc-head-file-code-set.txt`. **No new error vs base:** <br>• 296-05 touched one frontend file, a test outside the app config. <br>• Against the phase base, 296-04 measured 63 → 62. The removed error, `streamsStore.ts TS2345`, is absent from the HEAD set. <br>• 296-07 and 296-06 each measured an identical set at their own base. <br>• No fresh base checkout was built; it would have needed a second node_modules junction. |
| `check-hot-file-ledger.cjs .planning/phases/296-close-v4-7-debt` | **OK** (695 rows · subject 165 · watched 99) |
| `check-seeds-register.cjs --phase 296` | **exit 0.** 394/394 parsed, every file with all 5 required keys; routing table below |
| `check-claude-md-size.cjs` | **OK**: 102,064 chars (68%) |

## Task 2: the D-21 roster board

The 8 roster rows were derived from the effective registry (`evidence/roster/roster.txt`).

**⛔ Blocked, both probed live first (`probe.json`):**
- **Moonshot:** 429, "suspended due to insufficient balance".
- **OpenRouter:** 402, insufficient credit.

**Verdicts on the six reachable providers:**
- **291-S6-F8 (first step names the launch answer):** 6/6 PASS.
- **Multi-tool axis + markup scan:** 6/6 PASS. Both tools ran and `detect_markup` found 0 hits.
- **Parallel-thread** (google): PASS.
- **Long message** (6,606 bytes, deepseek): PASS.
- **293-F-4 pinned emit:**
  - a pin to `deepseek-v4-pro` PASSES from 5 run providers;
  - unpinned controls PASS on openai and deepseek;
  - ⚠ a pin to `gpt-5.6-luna` FAILS from all 5 non-OpenAI run providers with OpenAI's 400 `Function tools with reasoning_effort are not supported for gpt-5.6-luna in /v1/chat/completions`.

**Why 293-F-4 fails (`evidence/roster/pinned-emit-diagnosis.json`):** the routing works, but the API surface is resolved under the RUN provider's settings. Reproduced on 296-06 worktree code by one direct `forced_emit` shot.

**SEED-362 resume:** the board mechanics PASS on google (pause → answer 200 → re-drive → completed). The verdict is FAIL on the record: `metadata.provider` is null because the live backend predates 296-06. Re-run after a restart.

**⚠ The live :8000 backend predates the 296-06 merge.** Its `/openapi.json` has 296-02's `outcome` but none of 296-06's `AutoAnsweredNote`, `needs_task` or `unplaced_sentences`. The main checkout's source does have them. No workflow run in the DB has ever carried `metadata.provider`.

**Cleanup:** 33 threads and 22 definitions deleted, 0 left. Credential grep over `evidence/`: 0 hits.

## Task 3: G-4 (checkpoint, orchestrator)

`296-HUMAN-UAT.md` holds:
- **(a)** the eight D-20 scenarios, each with exact setup, the UI-SPEC "Pass looks like" text verbatim, and empty Verdict / Evidence columns;
- **optional rows 9-12**, for user-visible 296 fixes that no D-20 scenario reaches: the BUG-261021-05 seal plus the SeedReceipt look, BUG-261024-02, 287-V-4 and 287-V-5;
- **(e)** the 287-V-3 cloud read.

## Task 4: records

**Bugs closed now (9):**
- BUG-261020-03: `6d14ccf59` plus the 2026-10-24 key rotation; `verified_closed_by: "296"`.
- BUG-261020-01: its report file is `human-step-answer-never-reaches-the-next-step.md`.
- BUG-261015-01 and BUG-261020-07..12.
- All of these except BUG-261020-03 were fixed and verified in 295 (`verified_closed_by: "295"`).

**Fixed in 296, folded into 296, waiting on their G-4 row (12):**
- BUG-261021-02 → #1
- BUG-261020-02 (evidence page) → #2
- BUG-261021-03 and -04 → #3
- BUG-261025-03 → #4
- BUG-261025-01 → #5
- BUG-261025-02 → #7
- BUG-261024-04, defect half → #8
- BUG-261021-05 → optional row 9
- BUG-261024-02 → optional row 10

Each report's `re_open_trigger` says how to flip it on a PASS, and its `fixed_by_commit` names the RED and GREEN commits.

**Exceptions:**
- BUG-261024-01 is folded into 296 (Moonshot answers 429 today).
- BUG-261024-03 stays folded into 292.1, with the OpenRouter trigger.

⚠ **SC#3 is half met in the records.** BUG-261020-03 reads closed. BUG-261021-02 closes only on G-4 #1.

**Seeds planted (13, starting at max(id)+1 = 375):**

| Seed | What |
|---|---|
| SEED-375 | kb_auto engine lookup |
| SEED-376 | sandbox egress (D-11) |
| SEED-377 | split `api/workflows.py` |
| SEED-378 | starter-card wording |
| SEED-379 | deliverable size and path |
| SEED-380 | inbound task field |
| SEED-381 | F2 lock agreement |
| SEED-382 | schedule backoff |
| SEED-383 | intermediates (D-10) |
| SEED-384 | escalated-step search tool (D-04 c) |
| SEED-385 | golden inputs from the test instruction (D-08) |
| SEED-386 | agent steps honour their pin (293-F-4; 296-06 confirmed the silent swap) |
| SEED-387 | page-text labels for unfilled fields |

**Seeds updated:**
- **Answered:** SEED-360, 361, 362, 363, 364.
- **Partially answered:** SEED-365.
- **Routed:** SEED-367.
- **Unchanged:** SEED-366 and SEED-368..374 were confirmed still `planted`.

**Outcome table:** `## Outcome (296-05)` in `296-INVENTORY.md`. The coverage loop `evidence/gates/outcome-coverage.py` prints `inventory row IDs: 133 · outcome rows: 138 · missing: 0`.

## Seeds sweep routing (`check-seeds-register.cjs --phase 296`)

| Routing | Seeds |
|---|---|
| Answered / updated by 296 (frontmatter edited) | SEED-360, 361, 362, 363, 364, 365, 367 |
| Planted by 296 | SEED-375..387 |
| Leave. Reason: "296 is a debt close-out; D-03 forbids new capability". Status unchanged | SEED-052, 053, 054, 067, 177, 185, 188, 191, 192, 198, 199, 266, 284, 286, 288, 290, 291, 292, 295, 296, 298, 299, 300, 301, 303, 304, 305, 306, 307, 308, 309, 310, 311, 314, 316, 319, 323, 326, 327, 328, 337, 339, 340, 341, 343, 346, 347, 348, 352, 358, 359, 366, 368, 369, 371, 372 |
| Leave, but they border a 296 fix, so they are named here | **SEED-350**: `Stopped by you` for operator kills (borders 295-RES-b) <br>**SEED-351**: eval runs born without an org (the BUG-261021-02 class) <br>**SEED-297**: the boot reconciler NULLs cap_paused token totals (borders 296-02) <br>**SEED-324**: /continue accepts a run that is not cap_paused |

None of these was folded into 296.

## Deviations from Plan

1. **[Rule 2] `scripts/check-backend-unit-baseline.cjs` was fixed** (`e7dbed0de`), although it is outside `files_modified`. The D-22 gate's own instrument printed a false pass for a killed run, and it replaced `tests/unit` whenever arguments were given. Both arms were driven.
2. **[Rule 3] `test_294_fault_base_guard.py` got the 294-IN-03 case.** The fault server has no test file of its own.
3. **[Rule 1] The board's first resume attempt answered under the producer's `runs` id** and got `409 already ended`; a paused workflow run is answered under its workflow-run id. The mode was fixed and that run's evidence discarded. The google row then drove the run to completion.
4. **[Rule 1] The first draft of 289-V-2 read the DB too early.** It waited only for `_BACKGROUND_TASKS`; it now also waits for `RUN_TASKS`. It also needed the app pool's jsonb codec.
5. **Optional G-4 rows 9-12 were added**, so that user-visible fixes outside D-20 close on evidence instead of staying folded.
6. **The board's resume verdict asserts the run's RECORD** (`model` + `metadata.provider`). The re-drive's `runs` shell is minted with `model='unknown'` by design, and nothing else names the resumed segment's model.

## STATE.md guardrail overrides

> **Phase 296, consolidated from 296-01..07:**
>
> - **G-8:** 7 plans in 4 waves. W2 and W3 were split on context cost (02/06 and 03/07). The verifier, the TDD RED drives, security enforcement and migration discipline were not cut. **Amendments made after research:** D-04 (option b) and D-08 (typed stand-ins). Their capability halves are SEED-384 and SEED-385.
> - **296-01:** no overrides.
> - **296-02:** `harness_engine.py` took 4 audited touches, each larger than one statement; `api/runs.py` took 4 touches. Touched outside `files_modified`: `human_input.py` (a comment), `models/schedule.py`, and the OpenAPI snapshots. The armed-block seam is still owed.
> - **296-03:** `workflow_authoring.py` (FIRES) went from def 11 to def 15 against a one-condition forecast. Its named seam is `connection_vocabulary`. `phase_types.py` was touched outside the plan list. The plan-end gate is owed to 296-05.
> - **296-04:** `WorkflowScheduleModal.tsx` (FIRES) took 3 `useState`. Two pins were rewritten in place, with the originals quoted.
> - **296-06:** `workflow_runs.py` was a one-touch; `phase_types.py` took 3 touches. `scheduler_service.py` and `publish_service.py` were touched outside `files_modified`. `workflow_authoring_doors.py` crossed the G-5 threshold. `test_278` was retired by name.
> - **296-07:** `WorkflowCanvas.tsx` got a controlled view pair (D-09). `WorkflowBuilderPage.tsx` took 6 touches against a forecast of 5. The `useTemplateFirstDraft` extraction was taken first.
> - **296-05:** `check-backend-unit-baseline.cjs` was fixed outside `files_modified`. The full backend and vitest gates were NOT run (hung PID 94388).

## STATE.md owed items

**Run first: the OpenRouter top-up.** It unblocks three rows: 287-V-2 / the 291 roster, the 292.1 OpenRouter row, and BUG-261024-03.

1. **Restart uvicorn.** The running :8000 predates 296-06. Then re-run `scripts/run-296-board.py` with `--resume-model`, `--multi-tool` and `--pinned-emit --pin openai`, then `--cleanup`.
2. **End the hung pytest (PIDs 94388 / 101060).** Then run the full backend gate (no args, under the lock; expect ≤ 70 with the set ⊆ base) and ONE vitest count gate, pinning any new 296 test files.
3. **G-4 drive** of `296-HUMAN-UAT.md` 1-8, plus optional rows 9-12. Then flip each named bug per its `re_open_trigger`.
4. **293-F-4 (a G-7 decision).** A pinned Responses-API model 400s from any non-OpenAI run. Options: a fast fix (resolve the API surface under the PINNED provider's settings in the cross-provider forced-emit path), or defer it to SEED-386.
5. **OpenRouter top-up**, then:
   - `scripts/run-2921-board.py --run --providers openrouter`
   - `scripts/run-296-board.py --first-step --providers openrouter`
   - flip BUG-261024-03
6. **Moonshot:** reinstate the account, or record it as permanently blocked.
7. **287-V-3:** the cloud read (Supabase MCP, read-only).
8. **294-ENV:** remove the two dev `.env` lines (operator only).
9. **286-V-2:** the SEED-280 status note.
10. **Confirm the operator-owned values:**
    - `CITATION_CHECKS_PER_MINUTE = 10`
    - `DESCRIBE_PDF_MAX_PAGES = 50`
    - the golden stand-ins `2026-01-15`, `1`, `a short example answer`, and an enum's first option
    - `LOCAL_INFERENCE_TIMEOUT_S = 30`
    - `EVAL_MAX_TOOL_ROUNDS = 15`
11. **DEPLOY:** cloud migrations 214 → 215 → 216 (each shown first), then the backend, then `get_advisors(security)`.

## Threat notes for /gsd:secure-phase 296

| Threat | Plan | Disposition | Evidence |
|---|---|---|---|
| T-296-01/02 | 01 | mitigate | `test_296_create_org_stamp.py` and `test_296_two_org_create.py` (13 passed). A non-member header is ignored; a cross-org parent gets 404 |
| T-296-03/04 | 01 | mitigate | The D-05 cascade and the UUID filter (`test_289_run_evidence.py`, RED → GREEN) |
| T-296-05/06 | 01 | mitigate | Mig 216 uses a constant name; the shape test finds no `new.email`; `check-greenfield-privileges.py` passes |
| T-296-07 | 01 | mitigate | 10 per minute per user, checked before the claim; fails closed with 503 |
| T-296-08 | 01 | mitigate | Canonical UUID regex in mig 215 |
| T-296-09 | 01 | accept | The key owner's own output |
| T-296-10 | 04 | mitigate | Step output goes through MarkdownRenderer (DOMPurify). Flagged: a model-written image URL loads, as it does in chat |
| T-296-11/12/13 | 04 | mitigate | Neutral copy; the row-local `outcome`; listener cleanup |
| T-296-14 | 04 | accept | The owner reads their own thread |
| T-296-15..20 | 02 | mitigate | `test_296_lifespan_no_sweeps`, `test_296_boot_sweep_human_ask`, `test_296_run_ends_truthfully`, and the 296-05 real-DB claim-twice case |
| T-296-21..25 | 03 | mitigate | PDF page and byte caps; a requirement taken from the description; `.invalid` stand-ins; the model object never traced; a 30 s timeout |
| T-296-26 | 03 | accept | Worded refusal only |
| T-296-27..35 | 06 | mitigate | Tests in `test_296_kickoff_and_keys.py`, `test_296_step_inputs_and_routing.py`, `test_296_moonshot_schema.py` and `test_296_chat_and_wire.py`. ⚠ T-296-28 residual: a chunked body without a length is bounded only by the onebox nginx (`client_max_body_size 100m`). Accepted; re-open on any deploy target without that nginx |
| T-296-36..39 | 07 | mitigate | The seal is narrowed; files are snapshotted and locked; text children only; `teamShown` gates (G-4 #6 is the live check) |
| T-296-40 | 05 | mitigate | Localhost and local-DB asserts run before any request; the lock is held on every write mode; `--cleanup` works from a ledger and left 0 rows |
| T-296-41 | 05 | mitigate | `_write` refuses `Bearer ` / `sk-` and redacts `org-…` / `ak-…` (Moonshot's 429 body carried both); the grep over `evidence/` finds 0 |
| T-296-42 | 05 | mitigate | Nothing user-visible was closed before its G-4 PASS; did-not-reproduce rows name their RED test; the coverage loop finds 0 missing |
| T-296-43 | 05 | mitigate | 296-05 made no Supabase MCP call; 287-V-3 is a SELECT |
| T-296-44 | 05 | accept | Operator-only `.env` lines |

## Known Stubs

None.

## Threat Flags

None new. The board is a local-only dev script, covered by T-296-40 and T-296-41.

## Self-Check

See the section appended below.

## Self-Check: PASSED (at the checkpoint)

- Created files found: `scripts/run-296-board.py`, `test_296_redrive_fault_injection.py`, `test_296_describe_caps_lockstep.py`, `296-HUMAN-UAT.md`, `evidence/gates/tsc-head-file-code-set.txt`, `evidence/gates/outcome-coverage.py`, `evidence/roster/cleanup.json`, SEED-375..387.
- 17 commits on the branch since `a3cac42da`, every one by path; `git diff --diff-filter=D a3cac42da HEAD` is empty.
- An initial `run-2921-board.py --roster` read had overwritten `292.1/evidence/roster.txt`; it was restored with `git checkout --` on that one file before this commit.
- STATE.md and ROADMAP.md were not modified.
- **Open at the checkpoint:** the full backend gate, the vitest count gate (hung PID 94388), the G-4 drive, the 287-V-3 cloud read, and the 296-06-dependent board re-runs after a backend restart.
