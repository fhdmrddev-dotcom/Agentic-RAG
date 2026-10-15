---
phase: 283-every-member-reaches-their-own-settings
plan: 01
subsystem: ui
tags: [settings, g-5, tab-seam, behaviour-preserving, refactor, tdd, bug-261004-02]

requires: []
provides:
  - "frontend/src/components/settings/settingsTabs.ts — the one home for Settings tab id / audience / strip order / fallback (SETTINGS_TABS, RETIRED_SETTINGS_TABS, SETTINGS_TAB_STORAGE_KEY, visibleSettingsTabs, isSettingsTabVisible, settingsTabFallback, resolveSettingsTab)"
  - "frontend/src/components/settings/AuditLogSection.tsx — the Audit Log tab body, moved verbatim out of SettingsPage.tsx"
  - "a source-order fence tying the literal <TabsTrigger> strip to SETTINGS_TABS"
affects: [283-02 (adds Preferences '6' and switches the fallback rule in one place), 283-02 Task 3 ledger close]

tech-stack:
  added: []
  patterns:
    - "Tab registry in a React-free .ts module; the page asks it, the labels stay literal JSX for the docs/landing extractors"
    - "Registry receives the fail-closed canManageModels boolean, never the features map"

key-files:
  created:
    - frontend/src/components/settings/settingsTabs.ts
    - frontend/src/components/settings/__tests__/settingsTabs.test.ts
    - frontend/src/components/settings/AuditLogSection.tsx
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "Registry reproduces PHASE_BASE exactly, including the role-independent '3' fallback and unknown-id pass-through; both are pinned and named as 283-02 / D-05's to change"
  - "isSettingsTabVisible returns false for unknown ids, while resolveSettingsTab passes them through: visibility and resolution are separate questions, and only resolution had to match today's page"
  - "Memory and Audit Log triggers wrapped in the same isSettingsTabVisible guard for symmetry (always true today), so 283-02 changes one list, not the JSX"

requirements-completed: []  # FIX-01 is partly delivered here (the seam); 283-02 completes it

duration: ~45min
completed: 2026-10-16
---

# Phase 283 Plan 01: Settings tab registry seam Summary

**Every Settings tab is now declared once in `settingsTabs.ts` (id, audience, strip order, fallback). SettingsPage decides which tabs show and where a saved tab choice lands only by asking that file. The Audit Log tab body moved into its own file. Nothing a user sees changed.**

## Base

- **PHASE_BASE = `9a0b7862205d386cc3baee8b820f7a960fc63d6e`** (`9a0b78622`, `docs(283): create phase plan`, on develop).
- The worktree was created at `a248672f0` (the master merge), whose merge-base with the expected base was `60ce3797c`. **It was reset** with `git reset --hard 9a0b78622`, as the worktree_branch_check instructs, then bootstrapped (`BOOTSTRAP OK`: venv and node_modules junctioned, both .env files copied).
- Base files are in `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-283/`:
  - `tsc_base_9a0b78622_01.txt`: 103 lines of `tsc -p tsconfig.app.json --noEmit`, sorted
  - `eslint_base_01.txt` and `eslint_a11y_base_01.txt`: both **empty** (SettingsPage.tsx was lint-clean on both configs)
  - `suites_base_01.json` / `suites_after_01.json`: per-file vitest JSON reports
  - `SettingsPage.base.tsx`: the base page source, used to check the move was verbatim

## Behaviour-preservation baseline (four SettingsPage suites)

| Suite | Base (9a0b78622) | Final |
|---|---|---|
| `src/pages/SettingsPage.test.tsx` | 24 / 24 | 24 / 24 |
| `src/pages/__tests__/SettingsPage.a11y.test.tsx` | 4 / 4 | 4 / 4 |
| `src/pages/__tests__/SettingsPage.changedFields.test.tsx` | 23 / 23 | 23 / 23 |
| `src/pages/__tests__/SettingsPage.sourceCeiling.test.tsx` | 9 / 9 | 9 / 9 |
| `src/components/settings/__tests__/settingsTabs.test.ts` (new) | n/a | 11 / 11 |

`git diff 9a0b78622 --stat -- frontend/src/pages/SettingsPage.test.tsx frontend/src/pages/__tests__/` prints nothing. **The four existing suites are unedited.**

## Task Commits

1. **Task 1 RED:** `0c6340002`, `test(283-01): pin the Settings tab registry to today's rule` (suite plus both count-gate knobs)
2. **Task 1 GREEN:** `6ed90fddd`, `refactor(283-01): one home for the Settings tab ids, audiences and fallback (D-14)`
3. **Task 2:** `984045570`, `refactor(283-01): SettingsPage asks the tab registry; AuditLogSection gets its own file (D-14)`

## RED evidence

**Missing-module RED (Task 1, before `settingsTabs.ts` existed):**
```
 FAIL  src/components/settings/__tests__/settingsTabs.test.ts [ src/components/settings/__tests__/settingsTabs.test.ts ]
Error: Failed to resolve import "@/components/settings/settingsTabs" from "src/components/settings/__tests__/settingsTabs.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
(The failure is at import time, so the whole file fails, Test 4 included. After GREEN, Test 4 (source order) passed against the **unmodified** SettingsPage.tsx, before Task 2 touched the strip.)

**Planted-fidelity RED (not committed).** I changed `settingsTabFallback` to return the first VISIBLE tab (`visibleSettingsTabs(canManageModels)[0]`), which is the 283-02 / D-05 rule:
```
     × falls back to the first everyone tab ("3") for both roles
     × redirects the retired "5" for both roles
AssertionError: expected '0' to be '3' // Object.is equality
AssertionError: expected '0' to be '3' // Object.is equality
      Tests  2 failed | 9 passed (11)
```
**Restore:** I copied the file back from the backup; `grep -c 'visibleSettingsTabs(canManageModels)\[0\]'` returned `0`, and the re-run showed `Tests 11 passed (11)`. The suite can see the difference between the wave-1 and wave-2 rules (RESEARCH Pitfall 3).

## What changed

- **`settingsTabs.ts`** is a React-free `.ts` module. Its header explains (a) react-refresh, (b) why the labels stay literal JSX (two CI extractors; orchestrator ruling 2 / Option A), and (c) the fail-closed boolean. `SETTINGS_TABS` is in strip order, with a marker where 283-02 inserts Preferences "6". `RETIRED_SETTINGS_TABS = ["5"]` carries a never-reuse comment (D-03). `SETTINGS_TAB_STORAGE_KEY` notes that `EmbeddingModelCard.tsx` also writes the key. `resolveSettingsTab` reproduces the page exactly, including unknown-id pass-through, and its doc comment names 283-02.
- **`SettingsPage.tsx`:** `effectiveTab = resolveSettingsTab(activeTab, canManageModels)`. `MODEL_TABS`, `RETIRED_TABS` and the hardcoded `"3"` ternary are gone; the explanatory comment block stays, with one added sentence pointing at the registry. All five triggers are `{isSettingsTabVisible("N", canManageModels) && <TabsTrigger className={SETTINGS_TAB_CLASS} value="N">Literal</TabsTrigger>}`, and the retrieval one keeps `{retrievalTabLabel}`. There is no `.map` in the strip. The localStorage read and write go through `SETTINGS_TAB_STORAGE_KEY`. Unused imports were removed (`getAuditLogs`, `exportAuditLogs`, `AuditEntry`, `Download`, `ChevronLeft`, `ChevronRight`).
- **`AuditLogSection.tsx`:** base lines 377-582 moved verbatim. A line-by-line comparison against the base found **206 lines, 1 diff**: `function AuditLogSection()` became `export function AuditLogSection()`. The imports come from the `@/lib/api` barrel, with a comment saying why.
- **SettingsPage.tsx line delta: 1849 → 1645 (-204 lines)**, against an expected ~-205.

## Gate outputs

- `node scripts/check-docs-coverage.cjs`: exit 0. `112 code keys · 261 inventory IDs · 119 pages (33 written / 86 stubs)` / `docs coverage OK — every code key and inventory ID has a page (excluded by decision: I20).`
- `node scripts/check-landing-drift.cjs`: exit 0. `✓ Landing facts match application code (zero drift)`
- **tsc set diff:** the raw `comm -13` printed two lines, `SettingsPage.tsx(1145,60) TS2322` and `SettingsPage.tsx(794,9) TS2561`. Both are **base errors moved by the 204-line shift**: the base file has them at `(1349,60)` and `(998,9)`, identical messages. Comparing with line numbers stripped, `comm -13` and `comm -23` are both **empty**, so there are no new type errors and none disappeared.
- **eslint** (default config and `eslint.a11y.config.js`) over `SettingsPage.tsx`, `AuditLogSection.tsx` and `settingsTabs.ts`: no output, exit 0, matching the empty base. The new test file is also eslint-clean.
- **Acceptance greps:** `export function resolveSettingsTab` = 1; `export function isSettingsTabVisible` = 1; `^import.*react` in settingsTabs.ts = 0; `settingsTabs.test.ts` in count gate = 2; `function AuditLogSection` in SettingsPage.tsx = 0; `export function AuditLogSection` = 1; `@/lib/api/settings` in AuditLogSection.tsx = 0; non-comment `MODEL_TABS|RETIRED_TABS` = 0; `resolveSettingsTab(activeTab, canManageModels)` = 1; `<TabsTrigger className={SETTINGS_TAB_CLASS} value=` = 5; `SETTINGS_TABS.map|.map((t` in SettingsPage.tsx = no hits.
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root, run once after the Task 2 commit, exit 0):
  ```
  count gate OK — 437/437 pinned files present, no per-file decrease, 0 failing.
  total 10317  ·  failed 0  ·  pinned total 9448
  ```
  Rows for this plan's suites:
  ```
  SettingsPage.test.tsx                        24      24       0
  SettingsPage.changedFields.test.tsx          17      23      +6   (inherited: pin 17 vs actual 23, as the plan's interfaces note)
  settingsTabs.test.ts                         11      11       0
  SettingsPage.sourceCeiling.test.tsx           9       9       0
  SettingsPage.a11y.test.tsx                    4       4       0
  ```
  **The `settingsTabs.test.ts` actual is 11, equal to the pin**, so no `chore(283-01)` pin-correction commit was needed. Nothing was red, so there were no per-file red attributions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed a `@ts-ignore` from the new test's `?raw` import**
- **Found during:** Task 1 GREEN lint run
- **Issue:** `@typescript-eslint/ban-ts-comment` rejects `@ts-ignore`. The `?raw` import resolves without it, as in the `SearchDocumentsBody.test.ts` idiom.
- **Fix:** replaced the directive with a plain comment.
- **Files:** `frontend/src/components/settings/__tests__/settingsTabs.test.ts`
- **Commit:** `6ed90fddd` (included in the GREEN commit and noted in its message)

**2. [Rule 1 - Acceptance fidelity] Reworded a comment in AuditLogSection.tsx**
- **Issue:** my own barrel-import warning comment spelled out `@/lib/api/settings`, which made the plan's `grep -c "@/lib/api/settings"` = 0 check read 1.
- **Fix:** the comment now says "a `lib/api/` SUBMODULE" and still makes the same point. Fixed before the Task 2 commit.

Otherwise the plan was executed as written. No package was installed; no backend file, migration, `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`, STATE.md or ROADMAP.md was touched.

## D-15: the deeper split stays OWED

**This plan takes ONLY the tab-registration seam.** Per-tab state, `hydrate`, payload and save handlers stay in `SettingsPage.tsx`. The deeper per-tab split of SettingsPage.tsx **remains OWED** and must be recorded that way by 283-02's ledger close, **never as "G-5 discharged"**.

## Known Stubs

None.

## Threat Flags

None. T-283-01, T-283-02 and T-283-03 are mitigated as the threat register specifies: the boolean-only registry and `visibleSettingsTabs(false)` are pinned to `["3","4"]`; `resolveSettingsTab` redirects retired and governed ids; the barrel import is in place with a grep of 0.

## Next Phase Readiness

283-02 can add Preferences "6" as one `SETTINGS_TABS` entry plus one literal trigger, and switch the fallback rule in `settingsTabFallback` / `resolveSettingsTab`. The pinned "3" and pass-through cases in `settingsTabs.test.ts` are the ones it must flip on purpose.
