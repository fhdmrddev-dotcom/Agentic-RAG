---
phase: 302-close-out-and-a-true-register
plan: 03
subsystem: frontend/schedules, planning register, gates
tags: [frontend, schedules, register, seeds, reported-bugs, ledger, gates, FIX-03, REG-08]
requires: ["302-01", "302-02"]
provides:
  - "F-1 fixed: a refused Run now says its sentence once (WorkflowScheduleModal, +3 −1)"
  - "302-VALIDATION.md: G4-1..G4-3 (D-19), FIX-01 four-axis rows (D-20), register routing at close — all owed"
  - "the register reads true (15 files) and two bugs filed (BUG-261030-01, BUG-261030-02)"
  - "count-gate pins, ledger rows + sections, CLAUDE.md FIRING rows for every file the phase touched"
affects: [302 verification, 298 / 300 / 301 closes]
tech-stack:
  added: []
  patterns: ["a newer per-row result line suppresses the older outcome line for the same press"]
key-files:
  created:
    - .planning/phases/302-close-out-and-a-true-register/302-VALIDATION.md
    - .planning/reported-bugs/BUG-261030-01-built-images-cannot-send-invite-email.md
    - .planning/reported-bugs/BUG-261030-02-vercel-previews-cannot-open-the-app.md
  modified:
    - frontend/src/components/workflows/WorkflowScheduleModal.tsx
    - frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - 7 reported-bugs + 6 seeds (see the register table)
decisions:
  - "F-1 fix: render the outcome line only when the row has no Run now result (outcome && !runResult) — the result line is the newer word on the same press"
  - "SEED-281's N-2 urgency corrected high -> low beside the original: an unanswered human gate pauses (pause_run, 200 D-10), it does not fail"
  - "BUG-260828-05/-06 gained the three TEMPLATE keys they lacked (verified_closed_by, related_seeds, reproduces_on) so the key check could pass honestly"
  - "BUG-261027-05: the 300 FIX-05 re-run already PASSED 8/8 (300-HUMAN-UAT); the note says so and names F-5, instead of calling the re-run owed as the plan text assumed"
metrics:
  completed: 2026-10-30
  tasks: 3
---

# Phase 302 Plan 03: close-out and a true register — Summary

A schedule row whose Run now was refused now says why once, not twice. The three G-4 scenarios and FIX-01's four-axis rows are written down in `302-VALIDATION.md`, all owed. Every seed and bug that v4.8 touched now says what is true today. That means nothing reads closed while its phase is still `human_needed`. Two bugs that were known but never filed now exist. The phase's pins, ledger rows and CLAUDE.md FIRING rows are refreshed, and the full gates ran once.

## Tasks

| Task | Commits | What |
|---|---|---|
| 1 | `dd9610797` (RED), `993948b65` (GREEN) | F-1: `{outcome && !runResult ? (` plus a two-line comment (+3 −1). Two new cases, both RED at base: the row showed the sentence twice and kept the stale outcome line next to ✓. Also `302-VALIDATION.md` |
| 2 | `0f6568c57` | REG-08: 15 register files, two of them new |
| 3 | `ceadde6f6` | Pins, ledger, CLAUDE.md rows, gates |

TDD gate: the `test(302-03)` commit comes before the `fix(302-03)` commit. The modal diff against phase base `cf5a463d4` is 3 + 1 = 4 lines. `schedules.py` and `scheduleOutcomeVocabulary.ts` have no diff.

## Gate verdicts (verbatim)

- Targeted (Task 1): `Test Files 2 passed (2)` · `Tests 47 passed (47)` (WorkflowScheduleModal 31 + scheduleOutcomeVocabulary).
- Seeds register: `seeds register gate OK — 403/403 parsed, 0 duplicate ids, 403/403 carry all 5 required keys.` (exit 0). It also reports `unswept: 130 carry no trigger_when at all · 113 carry prose but no structured trigger`. Those are two separate figures and should not be added together.
- Bug key check (a throwaway script in the scratchpad, not in the repo): `bug key check OK — 9/9`. Positive controls fired: `TEMPLATE.md` failed on its id, and the base copy of BUG-260828-05 failed with `missing key verified_closed_by; missing key related_seeds; missing key reproduces_on`.
- Vitest count gate (one full run, `GSD_VITEST_MAX_WORKERS=2`): `total 13464 · failed 0 · pinned total 12312` then `count gate OK — 580/580 pinned files present, no per-file decrease, 0 failing.` After raising DescribeTemplateRow I re-checked against that run's persisted report (`--json`): `total 13464 · failed 0 · pinned total 12426` and `count gate OK — 580/580 pinned files present, no per-file decrease, 0 failing.` No load-flaky red this time.
- tsc (`npx tsc -p tsconfig.app.json --noEmit`): 61 errors, none in `WorkflowScheduleModal*`. `git diff 762fc6c85 --stat -- frontend` covers only the modal and its test (the modal's exports are unchanged), so the set diff against base is empty.
- Backend baseline: `Summary: 71 failed, 10738 passed, 1 skipped, 2 xfailed, 2 xpassed` · `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).` ⚠ **That is zero headroom.** 302-02 measured 70 on its own branch. This plan changed no backend file (`git diff 762fc6c85 -- backend` is empty), so the 71st failure is a property of the merged wave-1 tree or of load. I have **not** shown it to be inherited at a base. The failing set is spread over 24 files, and the largest are `test_retrieval_service` 15 and `test_sql_service` 12.
- `check-hot-file-ledger.cjs` exit 0 (`ledger gate OK`), `check-claude-md-size.cjs` exit 0 (CLAUDE.md 106,023 chars, 70.7%).
- D-18: `grep -c "302 G-2" .planning/STATE.md` = 1 (line 124). Confirmed. STATE.md was not edited.

## Register: before → after

| Item | Before | After |
|---|---|---|
| BUG-261027-01 | folded → 302 | folded → 302, plus a status_note: fixed in code by 302-01; closes at 302 G4-1 |
| BUG-261027-03 | folded → 300 | folded → "300, 302": 300 G4-5 PASS, F-1 fixed by 302-03; closes at 302 G4-2 |
| BUG-261027-04 | folded → 300 | folded → 300: G4-5 PASS; 300 owes G4-8 and the real-provider G4-1 |
| BUG-261027-05 | folded → 300 | folded → 300: FIX-05 **already PASSED 8/8** (300-HUMAN-UAT); F-5 (model drifts across a pause) named; 300 is human_needed |
| BUG-260828-05 / -06 | folded → 300, 3 TEMPLATE keys missing | folded → 300, keys added; 300 G4-8 (operator, real mailbox) owed |
| BUG-261029-01 | folded → 301 | folded → 301: 301-HUMAN-UAT test 2 (G4-4 keyboard arm) owed |
| BUG-261030-01 | — | **new**, folded → 300 (fixed in code by D-21; real-mail G4-1 owed, Resend deferred) |
| BUG-261030-02 | — | **new**, open. Evidence: `frontend/vercel.json:5-14` redirect; CORS FRONTEND_URL is the secondary hypothesis; no fix in this phase |
| SEED-185 | folded → 297, partial true | **shipped**, partial false (297 passed, 299 closed) |
| SEED-281 | folded "300, 301" | folded "300, 301": 3× `CORRECTED 2026-10-30` beside struck originals (mailer at `:50`, the fail_run paragraph, the N-2 row); excluded pause kinds recorded; owed rows named |
| SEED-391 | folded → 302 | **answered**, with the disposition table; trigger_paths now TeamPicture / teamVocabulary / schema_moonshot / StreamsProvider in place of WorkflowCanvas |
| SEED-313 / 317 / 389 | unchanged status | status unchanged; notes added: 298 human_needed, G4-1 first, 0 of 8 rows run |

Miss sweep (`grep -rlE '^folded_into: "?(297|...|302)'` plus the v4.8-dated reports): nothing outside the inventory. SEED-015/178/312 and BUG-261027-02 already read true and were left byte-unchanged.

## Pins and ledger

New pins with FILE-LEVEL TARGETS: `generatedFiles.test.ts` 8, `GeneratedFilesGroup.test.tsx` 7, `useSandboxDownload.test.tsx` 6. Raised to the gate's printed actuals: FilesSection 33→40, WorkspacePanel 58→65, ThreadWorkflowPicker 17→18, useStartWorkflowInThread 24→30, TeamPicture 42→44, teamVocabulary 15→16, WorkflowScheduleModal 29→31, and DescribeTemplateRow 42→156 (the pin had trailed the file by 114). OutputFileCard.baseline stays at 21, as the gate prints. None lowered.

Ledger: 21 scan-list rows were re-derived and the five AT-PLANNING `0 / 0 / 0` rows replaced. Each file has a new `302-0N` section holding its replaced cell verbatim, under "Phase 302 refresh" at the end of `docs/HOT-FILE-LEDGER.md`. CLAUDE.md: 13 FIRING rows refreshed. **TeamPicture.tsx (4/3/587) and teamVocabulary.ts (3/3/206) now FIRE**, so rows were added for them. phase_types.py still reads "G-5 OWED".

## Deviations from Plan

1. **[Rule 1 - accuracy] The BUG-261027-05 note does not call FIX-05 owed.** Re-reading 300-HUMAN-UAT.md showed the 8-row re-run PASSED 8/8 on 2026-10-29, with finding F-5. The note says that. The owed items are 300's G4-8 and the real-provider half of G4-1.
2. **[Rule 2] Three TEMPLATE keys were added to BUG-260828-05/-06** (`verified_closed_by`, `related_seeds`, `reproduces_on`, each with an inline comment saying it was added). Without them the key check would have failed. `reproduces_on.commit` is the commit that filed them (`de4d7e69c`), which the comment says.
3. **The SEED-281 N-2 urgency cell was also corrected** (struck through, high → low), not just its evidence cell, because the urgency rested on the false premise.
4. **The pin for DescribeTemplateRow went from 42 to 156.** The plan expected a small raise. The printed actual showed the pin had lagged since 291/296.

## Owed rows, in the order to run them

1. **302 G4-1** (first): repro thread 3586b900, panel FILES lists generated files and each downloads. Closes BUG-261027-01.
2. **302 G4-2**: the five S2 checks plus F-1. Closes BUG-261027-03.
3. **302 G4-3**: in-thread start 409 wording (locked / paused / Expert-org).
4. **302 four-axis rows**: 8-provider files-produced row (Moonshot expected ⛔, OpenRouter ⛔ if 402 persists), MT-1, PT-1, LM-1.
5. **298**: G4-1 Library switch first, then G4-2, G4-5, G4-6, G4-7, G4-4, G4-3 (two-org account).
6. **300**: G4-8 (operator, real mailbox) and the real-provider half of G4-1 (Resend deferred).
7. **301**: SC#4 operator sketch approval first, then G4-4 (stopped source + keyboard), G4-3 arm 3, the live approval row.

## Threat Flags

None. T-302-10: the modal change removes a line and adds no sink. T-302-11: nothing reads closed or shipped while its phase is human_needed. T-302-12: pins were only raised; no floor, cap or ceiling was lowered.

## Known Stubs

None.

## Self-Check: PASSED

- Files: `302-VALIDATION.md`, `BUG-261030-01-…`, `BUG-261030-02-…` exist.
- Commits: `dd9610797`, `993948b65`, `0f6568c57`, `ceadde6f6` are all in `git log`.
