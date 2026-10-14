---
phase: 281-a-refusal-names-its-cause
plan: 04
subsystem: verification (G-4 live drives, merged-tree gates, hot-file ledger, register flips)
tags: [g4, chrome-mcp, live-evidence, ledger, gates, closed-core, close, owed-by-decision]

requires:
  - phase: 281-01
    provides: "emit_cause.py composed cause, template_fields_missing, freshness RETRIEVABLE filter"
  - phase: 281-02
    provides: "publish gauntlet golden-run link, describe-door refusal table wiring"
  - phase: 281-03
    provides: "frontend cause rendering, describeRefusalVocabulary.ts, PhaseCard copy"
provides:
  - "281-LIVE-EVIDENCE.md: G-4 rows A-D (B PASS; A, C, D OWED with reasons and re-drive recipes) + operator sign-off"
  - "re-derived hot-file ledger + CLAUDE.md FIRING rows for every non-test source file 281 touched (runVocabulary.ts and lib/api/knowledge.ts rows added)"
  - "evidence-gated flips: BUG-260815-06 closed (row B), SEED-218 answered (row C's connect click)"
affects: [phase 281 close, BUG-260730-02 (still folded), SEED-221 (still folded), next phase touching the 281 hot files]

tech-stack:
  added: []
  patterns: ["a row is PASS only when rendered DOM words and the DB read agree; otherwise OWED with its reason", "closing with owed UAT rows is recorded as a DECISION with a named re-run order"]

key-files:
  created:
    - .planning/phases/281-a-refusal-names-its-cause/281-LIVE-EVIDENCE.md
    - .planning/phases/281-a-refusal-names-its-cause/281-04-SUMMARY.md
  modified:
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/reported-bugs/BUG-260730-02-emit-gate-reports-citations-when-citations-were-perfect.md
    - .planning/reported-bugs/BUG-260815-06-structural-gate-refusal-names-nothing-actionable.md
    - .planning/seeds/SEED-218-the-refusals-connect-button-is-a-no-op-onopensettings-is-unwired.md
    - .planning/seeds/SEED-221-a-refusal-reaches-the-screen-as-a-machine-code.md
    - .planning/STATE.md

key-decisions:
  - "Operator verdict 'approved' (2026-10-15): close Phase 281 with rows A, C and D OWED by decision; B PASS and the flips accepted as made; re-run order A then C then D"
  - "Row A recorded OWED, not retried: the model passed the emit gate and a second publish could have published the operator's draft (Pitfall 2)"
  - "The vitest count gate's one red sample is reported beside the orchestrator's green re-run; it is classed as load-timing, not proven inherited"

patterns-established:
  - "Owed G-4 rows carry their own re-drive recipe in the evidence file, so a later session can run them without re-planning"

requirements-completed: [FIX-09, FIX-10, DEBT-07]  # code shipped in 281-01..03 and unit-pinned; LIVE proof is owed for A (FIX-09), C (FIX-10's describe-door half; B passed) and D (DEBT-07), by operator decision

duration: ~1h47m (2026-10-14T19:48Z to 21:35Z, including the operator checkpoints)
completed: 2026-10-15
---

# Phase 281 Plan 04: Live Proof and Close Summary

**Closed by operator decision: row B ✅ PASS. The golden-run link has no "coming soon" text, and it opened the judged run (3 ids equal). The SEED-218 "Connect …" click landed on Connections. Rows A, C and D are ⛔ OWED with their reasons: the model passed the emit gate, the drafting model failed twice, and the archive write was not approved and the data could not produce the case. Every merged-tree gate is green or accounted for, and the ledger is re-derived.**

## Performance

- **Duration:** ~1h47m, including two operator checkpoints.
- **Started:** 2026-10-14T19:48Z (local-DB lock taken for the Task 1 gates).
- **Completed:** 2026-10-14T21:35Z (2026-10-15 local, the sign-off date).
- **Tasks:** 4/4 (2 auto, 2 checkpoints).
- **Files modified:** 9, docs and planning only. No source, no migration.

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 | `6b85944da` | `docs(281-04): re-derive the hot-file ledger for 281 (D-22)`. CLAUDE.md + docs/HOT-FILE-LEDGER.md in ONE commit. |
| 2 | `33886624f` | `docs(281-04): G-4 evidence file — rows A-D pending the operator's approval`. |
| 3 | `a093ae370` | `docs(281-04): G-4 drives A-D + evidence-gated closes`. Evidence, 2 bugs, 2 seeds, STATE. |
| 4 | this commit | `docs(281-04): operator sign-off; plan summary`. Sign-off section + this file. |

## Task 1: gate verdicts on the merged tree (develop `3931b0978`, PHASE_BASE `95c62fc83`)

- **Backend baseline** (local-DB lock held from 2026-10-14T19:48:24Z, released after S-7):
  `71 failed, 7435 passed, 1 skipped, 2 xfailed, 2 xpassed … [GATE PASSED] (failed: 71 <= 71, errors: 0)`.
  Failing SET compared with `base_failed_set_95c62fc83.txt`: 71 = 71, `only_base []`, `only_head []`.
- **Root-level suites:** `tests/test_harness_engine.py tests/test_094_rc4_failure.py tests/unit/test_255_extension_contract_guard.py` → **71 passed**, equal to the 281-01 base (71 passed). Plan path correction: `test_publish_service.py` lives at `tests/unit/`, which the baseline gate already covers. Run alone, it gave **83 passed**. `tests/test_harness_gates.py` was not run (it hangs at both revs).
- **S-7:** `tests/integration/test_214_argument_seams.py -k S7 -q -rs` → **2 passed, 18 deselected, 0 skipped**.
- **Closed core:** `test_255` + `test_259` → 13 passed. Live counts: **phase types 7 / emitters 1 / tools 30 / validators 10 at HEAD and at PHASE_BASE**. The base counts came from a `git archive 95c62fc83 backend/app` extract placed first on `sys.path`.
- **tsc:** `npx tsc -p tsconfig.app.json --noEmit` gives 103 lines. `comm -13` against `tsc_base_95c62fc83.txt` = **0 new errors**.
- **Migrations:** the tail is `206_retention_hold_hardening.sql` (no migration). Plan files: 4.
- **Vitest count gate, BOTH samples reported:**
  - **First sample (executor, repo root, `GSD_VITEST_MAX_WORKERS=2`): RED.** `RESULT: COUNT GATE VIOLATED (1 reason): [failing-tests] 1. total 10255 · failed 1 · pinned total 9400. No per-file decrease.` Failing case, from the gate's persisted JSON (copied to `vitest_report_281-04.json` BEFORE any re-run): `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` → *"WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14) POSITIVE CONTROL — with the flag ON the very same read finds the key"*, `expected 0 to be greater than 0` at 1061 ms, which is past the 1000 ms `waitFor` ceiling.
  - **Classification:** the file IS in 281's diff (+9 −2, the 281-02 re-pin at :148 and :2599-2610). The failing case (:726) and its subject (the `rails` prop) are not: `git diff 95c62fc83 HEAD -- WorkflowBuilderPage.tsx | grep -i "rail|PhaseFormPanel"` is empty. At PHASE_BASE (worktree `b281`, bootstrapped, torn down with `teardown-worktree.sh`, TEARDOWN OK, venv + node_modules intact) the full gate read `total 10216 · failed 0`, and the case passed in 107 ms. So the red is **NOT proven inherited**. Run alone at HEAD 4 times, the file gave 154 passed each time.
  - **Second sample (orchestrator re-run at HEAD, 2026-10-15): GREEN.** `count gate OK — 434/434 pinned files present, no per-file decrease, 0 failing.` total 10255 · failed 0. The 184-11 POSITIVE CONTROL case passed.
  - **Verdict:** one red sample and one green full-gate sample at HEAD, green at PHASE_BASE, and 4/4 isolated passes. This reads as a load-timing failure in a hunk 281 did not change, not a 281 regression. It is still one red sample of a flaky case, so it is recorded here rather than waved through as "fine".
- **Ledger gates after the commit:** `check-claude-md-size.cjs` → CLAUDE.md 91,721 chars, 61.1% [OK], `claude-md size gate OK`. `check-hot-file-ledger.cjs 281` → `scan list: 537 rows · subject: 43 files · watched: 17 · ledger gate OK`. The first run caught a `[malformed-row]` from an unescaped `|` in the knowledge.ts cell; it was fixed to `\|` before the commit.
- **G-7:** `check-gap-closure-rounds.cjs 281` → `plans: 4 total · 0 gap-closure · G-7 clear`.

## Ledger triples (old scan list → new, re-derived with the CLAUDE.md recipe)

| File | Old | New |
|---|---|---|
| `harness/emit_cause.py` | 0/0/0 | 1/1/292 |
| `harness/freshness.py` | 1/1/113 | 2/2/123 |
| `harness/phase_types.py` | 54/27/2954 | 55/28/3014 |
| `harness_engine.py` | 60/23/3297 | 61/24/3387 (OV-281-01) |
| `workflow_authoring.py` | 16/10/1002 | 17/11/1025 |
| `ChatLayout.tsx` | 60/30/1134 | 61/31/1137 |
| `PhaseCard.tsx` | 17/11/788 | 18/12/796 |
| `PublishBlockedStepCard` | 0/0/101 | 2/1/109 |
| `PublishGauntlet.tsx` | 19/9/1343 | 20/10/1372 |
| `describeRefusalVocabulary.ts` | 0/0/0 | 1/1/151 |
| `publishBlockedStep` | 0/0/176 | 2/1/183 |
| `runVocabulary.ts` | 9/4/660 | 10/5/662 (CLAUDE.md FIRING row ADDED) |
| `useTemplateFirstDraft.ts` | 6/3/673 | 7/4/677 |
| `lib/api/knowledge.ts` | 4/3/812 | 5/4/825 (CLAUDE.md FIRING row ADDED) |
| `WorkflowBuilderPage.tsx` | 56/21/2977 | 57/22/2993 |
| `WorkflowsPage.tsx` | 43/17/1415 | 45/18/1447 |
| `types/index.ts` | 98/77/1542 | 99/78/1546 |

Ten CLAUDE.md FIRING rows were updated and two were added. `documents.py` was excluded: its only change is the quick fix BUG-261014-06, and its row is untouched. The `emit_cause.py` invariant "never leads with a step name or slug" is struck through, with a dated D-32 correction beside it.

## Seeds sweep (`check-seeds-register.cjs --phase 281`)

`seeds register gate OK — 361/361 parsed, 0 duplicate ids`. Unswept: **130 carry no trigger_when** · **113 carry prose but no structured trigger**. The two figures are not summed. The gate printed "the phase declares NO surfaces". 15 seeds matched:
- SEED-177, 185, 188, 198, 284, 291, 295, 298, 300, 305, 307, 309, 340 → left unmodified: "path match only; 281 changed no subject of this seed".
- SEED-339, SEED-350 → stay deferred (D-31).
- SEED-218 / SEED-221 did not path-match. They were routed in Task 3 on row C's evidence.

## G-4 rows (281-LIVE-EVIDENCE.md, driven at `33886624f`, 1440x900, technical names OFF)

| Row | Outcome | One line |
|---|---|---|
| A (D-17 / D-06 live / D-32) | ⛔ OWED | The model passed: golden run `e4b3625a-5d4b-4cc2-96db-cf3e54c57bfc` (`deepseek-v4-flash`) emitted on its first call (`uncited 0`, `invented 0`, `covers_template true`), and publish was refused by the JUDGE (score 18). There was no emit cause to read. |
| B (D-18) | ✅ PASS | `/coming soon/i` was absent from innerText and innerHTML. The click opened WorkflowRunPage. The loaded id = verdict `golden_run_id` = DB `is_golden_run` row. The failed-step-reason sub-check could not be exercised (no step failed). |
| C (D-19) + SEED-218 | ⛔ OWED · connect click ✅ PASS | Both no-service drafts returned `could_not_generate` (`model_failed_to_emit`, then `provider_error`), so `connection_not_allowed · no_service_chosen` never rendered. `Connect Linear` landed on Connections. |
| D (D-20) | ⛔ OWED | The archive write was not approved. Read-only, all 3 folder documents date from 2026-06-08, against `max_age_days 2`, so no decisive arrangement exists without a fresh upload. |

Org proven before the drives: one membership (`22f9c615-…`, *fhdmrd@gmail.com's Organization*), and `x-org-id` was read from the request headers.

## Flips (evidence-gated, accepted by the operator)

- **BUG-260815-06 → `closed`** (row B). `verified_closed_by` cites `33886624f` + 281-LIVE-EVIDENCE.md row B.
- **SEED-218 → `answered`** (row C's connect click). Its `status_note` records the residual: the `DOOR_REFUSAL` sentence (`doorVocabulary.ts:535`) still says "connect it in Settings", but the control opens Connections.
- **BUG-260730-02 stays `folded`** (row A owed). A dated note names the 281 attempt.
- **SEED-221 stays `folded`** (row C owed). A dated note names the 281 attempt.

## Operator sign-off (Task 4)

Verbatim: **`approved`** (2026-10-15). The operator had been shown the four rows, the draft's temporary KB binding and its restore, and the flips. They chose "close with A, C, D owed" over "re-run". **No flip is disputed, so none is reverted.** The full ruling is in 281-LIVE-EVIDENCE.md § Operator sign-off (Task 4).

## Owed (by decision)

The phase closes with three G-4 rows owed. This is an operator DECISION (CLAUDE.md G-7 note), not a claim that they ran. **Run A first.**

1. **Row A (D-17, D-06 live half, D-32 chat half).** Owed because the live model passed the emit gate, so there was no emit refusal to read. A retry was not attempted because a second publish could have turned the operator's draft into a published workflow. This row also carries row B's leftover sub-check (the run panel's failed-step reason equals A's cause), and it gates BUG-260730-02. Re-drive: § Row A, "To re-drive" (publish a draft whose emit reliably misses a template field). The emit step is unnamed, so only the `This step failed after N attempt(s):` arm runs live.
2. **Row C (D-19).** Owed because the drafting model returned `could_not_generate` on both tries, before any connection check ran. It gates SEED-221. Re-drive: § Row C (same two prompts once the drafting model is healthy; first confirm `reason_code: no_service_chosen` on `POST /workflows/generate`).
3. **Row D (D-20).** Owed because the reversible `archived_at` write was not approved, and the folder's data cannot make the archived row decisive without a fresh upload. Re-drive: § Row D. It needs a new per-action operator approval for the write.

## Deviations from Plan

1. **[Rule 3 - Blocking] The draft was bound to a knowledge base to publish (row A).** The current app refuses an unbound publish upstream ("it would search everything"). The draft was bound to *Security & Compliance Policies* through the Builder's own select, then restored. A DB read confirmed `project_folder_id = null`, `status = draft`. This confounds row A: it did not reproduce July's unbound conditions. The operator was told before sign-off.
2. **Plan path correction (Task 1):** `tests/test_publish_service.py` is at `tests/unit/`. It was run there alone (83 passed). The baseline gate covers it as well.
3. **The "dev account is in two orgs" premise is stale for this DB:** the account has one `org_members` row. The org was proven by DB read + request headers rather than an org switcher.

## Known Stubs

None. This plan changed docs and planning files only.

## Self-Check

- FOUND: `281-LIVE-EVIDENCE.md`, which has rows A-D and the `## Operator sign-off (Task 4)` section.
- FOUND: commits `6b85944da`, `33886624f`, `a093ae370` (`git log`).
- FOUND: BUG-260815-06 `status: closed`, SEED-218 `status: answered`; BUG-260730-02 and SEED-221 stay `folded`.
- NOT VERIFIED BY ME: I did not run the Task 1 gates. Their verdict lines come from the executor's recorded file `task1_gates_281-04.md` and the orchestrator's re-run note, and are quoted, not re-measured.
- OPEN, BY DECISION: G-4 rows A, C, D are owed (see above). The plan's success criterion "each unprovable row recorded ⛔ OWED with its reason" is met; "proven on the rendered screen" is met for B only.

## Self-Check: PASSED (with rows A, C, D owed by operator decision)
