---
phase: 301-the-waiting-on-you-notice
plan: 03
subsystem: frontend / app-shell attention UI
tags: [frontend, ui, rail, popover, mobile, a11y, ledger]
requires:
  - "301-01: GET /notifications -> { notices, total }"
  - "301-02: AttentionCondition union (mark), WaitingCondition, WaitingStatus, AttentionContext.reportWaitingStatus, conditionsForMark, waitingTotal"
provides:
  - "waitingVocabulary.ts — every waiting-list word (zero-import leaf)"
  - "OrgAvatar size xs (16px, 10px initial)"
  - "WaitingOnYouControl (rail + drawer variants) and WaitingOnYouList (rows as DropdownMenuItems)"
  - "the control on the rail, the drawer row, the hamburger dot on every non-chat view"
  - "301-VALIDATION.md — G-4, SC#4 and four-axis rows (all owed)"
affects:
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/AppViewSwitch.tsx
  - frontend/src/components/layout/AttentionPopover.tsx
tech-stack:
  added: []
  patterns:
    - "rows inside a Radix menu are DropdownMenuItems (Tab is cancelled in menu content)"
    - "the pill shows only an ANSWERED server total above 0; status travels beside the rows"
    - "minute tick lives in the list, which Radix mounts only while open"
key-files:
  created:
    - frontend/src/components/layout/waitingVocabulary.ts
    - frontend/src/components/layout/waitingVocabulary.test.ts
    - frontend/src/components/layout/WaitingOnYouList.tsx
    - frontend/src/components/layout/WaitingOnYouControl.tsx
    - frontend/src/components/layout/__tests__/WaitingOnYouControl.test.tsx
    - .planning/phases/301-the-waiting-on-you-notice/301-VALIDATION.md
  modified:
    - frontend/src/components/org/OrgIdentity.tsx
    - frontend/src/components/org/OrgIdentity.test.tsx
    - frontend/src/components/layout/AttentionPopover.tsx
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/AppViewSwitch.tsx
    - frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "301-03: the waiting control is presentational; ChatLayout owns waitingStatus (useState) and passes reportWaitingStatus through the one memoised attention ctx"
  - "301-03: the Library popover's Open Library health is a DropdownMenuItem (D-26 / BUG-261029-01), found by role menuitem"
  - "301-03: AppViewSwitch.tsx now FIRES G-5 (3 phases: 297, 299, 301) — CLAUDE.md row added; the next feature phase on it should extract first"
metrics:
  duration: "~1h40m"
  completed: 2026-10-30
  tasks: 3
  files: 17
---

# Phase 301 Plan 03: the Waiting on you control Summary

A "Waiting on you" control now sits on the rail directly under New chat, on every view and at both
rail widths. It is always present. Its amber pill shows the server's total across every org, but only
once an answer has arrived and only when the total is above 0. It opens a flat list, waited longest
first, and each row names the workflow, the org (the active org too), "needs your answer" or "needs your
approval", how long it has waited (re-rendered each minute) and "· scheduled" or "· started by an API
key". Rows are menu items, so arrow keys and Enter reach them. Selecting one calls `openRun(run_id)`
and never `switchOrg`. On a phone the drawer has the same row and list, and the hamburger dot now lights
on non-chat views too. The Library popover's "Open Library health" became a menu item (BUG-261029-01).

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | vocabulary leaf, OrgAvatar xs, 301-VALIDATION.md (D-02, D-06, D-10, D-24, D-25, D-28, D-34) | `341a19132` | `33299084b` |
| 2 | WaitingOnYouControl + WaitingOnYouList; Library action as menu item (D-01, D-02, D-05..D-10, D-17, D-26, D-29) | `7bca41767` | `44031c5ac` |
| 3 | mounts on the rail, in the drawer and on the non-chat bar; phase ledger refresh (D-01, D-03, D-17, D-30) | `2dfecd298` | `560647ea6` |
| — | closing-gate fix: `router:notifications` added to the docs coverage list (Rule 3) | — | `e66cedc7b` |

TDD gate: every task has its `test(301-03)` RED commit before its `feat(301-03)` GREEN commit. I watched
each RED run fail: Task 1 had a missing module plus 2 failing xs cases, Task 2 had 3 failing cases plus
a collection error, and Task 3 had 9 failing cases.

## Closing gates (verdict lines verbatim)

- **Backend baseline** (`node scripts/check-backend-unit-baseline.cjs`):
  `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).`
  (`70 failed, 10728 passed, 1 skipped, 2 xfailed, 2 xpassed`.) 301-03 changes no backend file, so this
  confirms the 301-01 merge.
- **tsc set diff** (`npx tsc -p tsconfig.app.json --noEmit`): base set **61**, HEAD set **61**,
  **NEW: none · GONE: none**. For the base set I checked out base versions of the 8 modified frontend
  files, moved the 5 new files aside and ran tsc, then restored everything from HEAD (status clean
  afterwards).
- **Count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, worktree root). It ran
  twice and neither run reached `count gate OK`. I took each failure from the gate's persisted JSON
  report before re-running anything.
  - Run 1: `total 13414 · failed 1 · pinned total 12259` / `RESULT: COUNT GATE VIOLATED (1 reason(s))`
    / `[failing-tests]`. The failing case was `src/docs/__tests__/docsCoverageGate.test.ts`, with
    `[uncovered] router:notifications`. This was **inherited from 301-01**: its
    `include_router(notifications.router)` in `main.py` had no docs page covering it. Every input
    `check-docs-coverage.cjs` reads (main.py, nav-items, App.tsx, tool_dispatcher, phase_types, harness/,
    SettingsPage, docs/public, the inventory) is byte-identical between base `e600ea159` and the 301-03
    HEAD (`git diff --numstat e600ea159 HEAD`), so the finding was red at base. **Fixed** in `e66cedc7b`
    by adding one token to `docs/public/api/overview.md` `covers:`. `check-docs-coverage.cjs` now reports
    `docs coverage OK`, and `src/docs src/landing` passes 190/190.
  - Run 2 (after the fix): `total 13414 · failed 1 · pinned total 12259` / `COUNT GATE VIOLATED` /
    `[failing-tests]`. The failing case was `src/pages/WorkflowBuilderPage.canvas.test.tsx` ("184-11 …
    POSITIVE CONTROL — with the flag ON the very same read finds the key"). That file is **provably
    unmodified** (absent from the base→HEAD diff, and nothing under `components/workflows` or
    `WorkflowBuilderPage.tsx` changed). It **passed in run 1**, and it passes alone at **164/164**. I
    read it as a load flake, not a 301-03 regression. One green sample does not prove it innocent.
  - Both runs reported only `[failing-tests]`. No `per-file decrease` reason fired, and no pinned file
    went missing. New pins match the printed actuals: `waitingVocabulary.test.ts` 24,
    `OrgIdentity.test.tsx` 17 (its first pin ever), `WaitingOnYouControl.test.tsx` 24. Pins raised:
    `NavPanel.badge.test.tsx` 17 → 18 → 22, `ChatLayout.badge.test.tsx` 14 → 19. No pin was lowered.
- **Targeted suites**: the five-suite verify set passes (100/100). The wider
  `src/components/layout src/__tests__/routing LibraryPage.tabAttention src/components/org` run was
  696/697. The one failure is `ChatHistoryColumn.test.tsx` "shows the per-group count in each group
  header", which is the known date-grouping red, already red at base, with the file byte-unchanged.
  Base had 4 date cases failing; today 1 fails, depending on the date.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/301-the-waiting-on-you-notice` →
  `ledger gate OK — every watched file has a row.` `node scripts/check-claude-md-size.cjs` →
  `claude-md size gate OK` (105.6k chars).

Acceptance greps all hold:
- `^import` in waitingVocabulary.ts = 0.
- `switchOrg` in the List and Control = 0 / 0.
- `supabase|@/hooks/|@/lib/api` in the Control = 0.
- `DropdownMenuItem` appears 4 times in the List and 3 times in AttentionPopover.
- dismiss/snooze/mark-read in code lines = 0.
- `dangerouslySetInnerHTML` = 0 / 0.
- `<WaitingOnYouControl` = 1 in NavPanel and 1 in ChatLayout.
- `ATTENTION_PRODUCERS.flatMap` = 1.
- `drawer-trigger-dot` in AppViewSwitch = 1.
- AppViewSwitch hook count is 0 before and after.
- ChatArea, StreamsProvider, PendingAskCard and WorkflowRunPage are unmodified.
- `AppViewSwitch.tsx` appears in CLAUDE.md = 1.

## Ledger rows touched (re-derived with the CLAUDE.md recipe)

| File | Triple | Note |
|---|---|---|
| `waitingVocabulary.ts` | 1 / 1 / 79 | created |
| `WaitingOnYouList.tsx` | 1 / 1 / 157 | created |
| `WaitingOnYouControl.tsx` | 1 / 1 / 135 | created |
| `OrgIdentity.tsx` | 2 / 2 / 99 | xs size |
| `AttentionPopover.tsx` | 2 / 2 / 117 | D-26 |
| `NavPanel.tsx` | 29 / 15 / 442 | FIRES; scan + CLAUDE.md rows |
| `ChatLayout.tsx` | 76 / 37 / 970 | FIRES; scan + CLAUDE.md rows |
| `AppViewSwitch.tsx` | 8 / 3 / 609 | **now FIRES** (297, 299, 301); new CLAUDE.md row |
| `backend/app/api/notifications.py` | 1 / 1 / 107 | 301-01, its AT-PLANNING 0/0/0 cell replaced |
| `backend/app/db/notifications.py` | 3 / 2 / 384 | 301-01 |
| `backend/app/main.py` | 99 / 73 / 1021 | 301-01; CLAUDE.md row |
| `scripts/build-public-openapi.cjs` | 13 / 7 / 473 | 301-01; prior row `11 / 5` was stale, corrected; CLAUDE.md row |
| `scripts/full-schema-supplement.sql` | 27 / 19 / 891 | 301-01; CLAUDE.md row |
| `scripts/vitest-count-gate.cjs` | 403 / 84 / 6894 | CLAUDE.md row |

Every replaced cell was moved verbatim into a dated 301-03 subsection of that file's section in
`docs/HOT-FILE-LEDGER.md`.

## Owed rows (Claude drives them after merge; operator signs SC#4)

- Every G-4 row in `301-VALIDATION.md` §2: G4-1 … G4-5. Prove the active org first and record the
  starting count, because the account already has open notices.
- **SC#4**: operator approval that the built control matches sketch 301 winner A. I picked that winner
  myself under the autonomous mandate.
- Every four-axis row in §3: 8 cross-provider rows, MT-1, PT-1, LM-1. Moonshot and OpenRouter are
  pre-marked "expected ⛔, confirm at run time".
- At deploy: paste `219_notifications_realtime.sql` into the cloud SQL editor, then run
  `get_advisors(security)`.
- **D-35 is DISCHARGED**: `supabase/full-schema.sql` was regenerated in main at `cb74b23dc`. I did not
  redo it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docs coverage gate red from 301-01's new router**
- Found during: closing count gate (run 1).
- Issue: `router:notifications` was not covered by any `docs/public` page.
- Fix: one token in `docs/public/api/overview.md` `covers:` (beside `router:links`). I did not add an
  exclusion.
- Commit: `e66cedc7b`.

**2. [Rule 1 - Bug] Two defects in my own RED test file, fixed in the GREEN commit (`44031c5ac`)**
- The `switchOrg` spy was a top-level `const` used inside a hoisted `vi.mock` factory, so the suite
  failed at collection. It is now `vi.hoisted`. The RED run still failed, but for this reason as well
  as the missing modules.
- The keyboard case opened the list with Enter and then pressed ArrowDown. Radix's Enter already
  focuses the first row, so the case selected row 2. It now opens with ArrowDown, asserts that row 1 has
  focus, then presses Enter, as the plan offered ("ArrowDown (or Enter) then Enter").

**3. CLAUDE.md `· ⛔` markers kept.** The new main.py and full-schema-supplement cells keep the trailing
`· ⛔` marker the old cells carried, because the verbatim text in the docs still holds a hard
constraint.

**4. Extra cases beyond the behavior list:**
- The Library action is driven by arrow keys + Enter in NavPanel.badge (D-26). The plan only asked for
  the role change.
- WaitingOnYouControl.test covers the drawer variant.
- WaitingOnYouControl.test has a "no status given" fallback case.

Otherwise the plan executed as written.

## Known Stubs

None in this plan's files. `WaitingCondition.detail` stays `""` by design (from 301-02): the list builds
the row's words when it renders.

## Threat Flags

None. No new endpoint or trust boundary. T-301-18..23 mitigations are in place and tested:
- names render as React text only;
- selecting a row calls `onOpen` only, and a `switchOrg` spy stays uncalled;
- absence tests check for raw kind words, ISO times and ids;
- the pill and states follow the status rules;
- the tick only runs while the list is open;
- no dismiss control exists.

## Notes for the orchestrator

- I did not run `graphify update .` inside this worktree. Run it after merge.
- STATE.md and ROADMAP.md are untouched, as instructed.
- `.omc/` was untracked before this run and is not mine. I left it alone.

## Self-Check: PASSED
