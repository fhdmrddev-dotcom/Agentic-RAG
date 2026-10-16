---
phase: quick-261016-u3w
plan: 01
subsystem: frontend-ui
tags: [loader, iris, branding, a11y, SEED-359]
requires: [IrisAvatar (Phase 276-06)]
provides: [SyrelLoader (section / panel / page)]
affects: [23 page/panel/section/dialog-body loading arms in 22 files]
tech-stack:
  added: []
  patterns: ["one shared branded loader: IrisAvatar thinking inside one polite status root"]
key-files:
  created:
    - frontend/src/components/ui/SyrelLoader.tsx
    - frontend/src/components/ui/__tests__/SyrelLoader.test.tsx
  modified:
    - scripts/vitest-count-gate.cjs
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
    - docs/HOT-FILE-LEDGER.md
    - (22 call-site files, listed below)
decisions:
  - "SyrelLoader reuses IrisAvatar state=thinking at 20/32/48 px; never a fork"
  - "Wrappers that carry a testid or card style are kept (case b); otherwise the whole wrapper is replaced (case a)"
  - "Ledger rows were added for 10 row-less files because check-hot-file-ledger.cjs failed [no-row]"
metrics:
  completed: 2026-10-16
  tasks: 3
  commits: 5
---

# Quick 261016-u3w: Swap page and panel loaders to the Syrel Iris — Summary

One shared `SyrelLoader` (the Syrel Iris mark in its working state, inside one `role="status" aria-live="polite"` root) now replaces the generic spinner at all 23 page-, panel-, section- and dialog-body loading arms. Every site keeps its exact visible words.

## Commits

| Commit | What |
|---|---|
| `e5e9f92ce` | test: SyrelLoader behaviour fence (RED, failed on the missing module) |
| `afb95174d` | feat: SyrelLoader + suite adopted into BOTH count-gate knobs (10 measured) |
| `dc5a8ba34` | feat: 16 sites in admin, classification, experts, org, metadata, panel, settings, skills, pages |
| `8f2ebae09` | feat: 7 sites in sources + workflows; PublishedCardDelete `loading` literal re-captured; SyrelLoader `Size` alias |
| `912808491` | docs: ledger rows + sections for the 10 files the hot-file gate found row-less |

## The 23 swapped sites

| # | File | Size | Words kept |
|---|---|---|---|
| 1 | admin/ModelRegistryTab.tsx | panel (inside the kept card, its own role dropped) | Loading the model registry… |
| 2 | classification/ClassificationRulesPage.tsx | panel | Loading rules… |
| 3 | experts/catalog/ExpertCatalogPage.tsx | panel | Loading the expert catalog... |
| 4 | org/OrgExpertsTab.tsx | panel | Loading organization experts... |
| 5 | metadata/TakeoffSection.tsx | panel | Reading CAD geometry and block counts... |
| 6 | panel/FilePreview.tsx | panel | (none, "Loading") |
| 7 | settings/AuditLogSection.tsx | panel | (none) |
| 8 | settings/EngineHealthCard.tsx (card testid kept) | section | Loading engine health… |
| 9 | settings/EngineHealthCard.tsx | section | Loading smoke run… |
| 10 | settings/MemorySection.tsx | panel | (none) |
| 11 | skills/PublishGateDialog.tsx | section | Checking the publish gate… |
| 12 | skills/SkillTestCasesSection.tsx | section | Loading test cases… |
| 13 | skills/studio/CaseEditor.tsx | section | Loading test cases… |
| 14 | skills/studio/VersionsTab.tsx | section | Loading version history… |
| 15 | pages/SettingsPage.tsx | page | (none) |
| 16 | pages/SkillTunerPage.tsx | panel | Loading skill… |
| 17 | sources/ConnectedSourceSection.tsx | section | Looking for connected sources… |
| 18 | sources/CreateWatchModal.tsx | section | Loading connections... |
| 19 | sources/SourceFolderPicker.tsx (`folder-picker-loading` kept) | panel | Loading folders… |
| 20 | sources/SourcePreviewPanel.tsx | section | `{SCANNING}` |
| 21 | sources/WatchedFoldersSection.tsx | panel | Loading watched folders... |
| 22 | sources/WatchRowCard.tsx (`sources-history-loading` kept) | section | Loading the checks for this source... |
| 23 | workflows/library/WorkflowDeleteSheet.tsx (whole `<p role=status>` replaced) | section | Checking what this will remove… |

Imports dropped only where nothing else used them: `Loader2` in FilePreview, EngineHealthCard, PublishGateDialog, SkillTestCasesSection, CaseEditor, VersionsTab, ConnectedSourceSection, WatchedFoldersSection, WatchRowCard; `RefreshCw` in SkillTunerPage. `Sparkles` stayed in ExpertCatalogPage and OrgExpertsTab (used elsewhere). EngineHealthCard and WatchRowCard lost `Loader2` because their out-of-scope spinners are `RefreshCw` + `animate-spin`, not `Loader2`; those lines are byte-unchanged.

## Scope fence (end state)

- Spinner tokens left outside chat/tests/imports: **88** (= 111 − 23).
- `<SyrelLoader` call sites: **23** across the **22** inventory files.
- `git diff --name-only 264c65d73 -- frontend/src/components/chat/`: **empty**. IrisAvatar.tsx byte-unchanged.

## Gates

- SyrelLoader.test.tsx: **10 passed**, adopted into BASELINE (`"SyrelLoader.test.tsx": 10`) and TARGETS.
- Task 2 targeted suites: 16 files, 209 passed. Task 3 targeted suites: 10 files, 194 passed.
- PublishedCardDelete.test.tsx: 42 passed now, 42 at base (BASELINE floor 32, unchanged). Only the normaliser lines, the `loading` literal and its comment changed; the other six literals are byte-identical.
- Typecheck set diff (`npx tsc -p tsconfig.app.json --noEmit`): 63 error lines at base, 63 after. **No new errors.** Three lines differ only by line number (an import line was added above them in MemorySection and SettingsPage).
- Count gate: `count gate OK — 450/450 pinned files present, no per-file decrease, 0 failing.` (total 10524, failed 0, pinned total 9654). One run, no flake rerun needed. The six `new` suites it lists were not added by this task (its only new suite is SyrelLoader.test.tsx); SyrelLoader.test.tsx reads 10 / 10.

## G-5 record

| File | Ledger row | Fires (≥3 phases) | Note |
|---|---|---|---|
| ui/SyrelLoader.tsx | added (young) | no | new |
| scripts/vitest-count-gate.cjs | yes | yes | two additive entries, honoured by construction |
| admin/ModelRegistryTab.tsx | yes | yes (7) | loading-arm swap, honoured by construction |
| pages/SettingsPage.tsx | yes | yes (27) | loading-arm swap, honoured by construction |
| sources/SourceFolderPicker.tsx | yes | no (row: `2 / 1 / 375`, carries ⛔ in CLAUDE.md) | loading-arm swap, honoured by construction; failed-vs-empty invariant untouched |
| sources/WatchedFoldersSection.tsx | yes | yes (4) | loading-arm swap |
| panel/FilePreview.tsx | **added** | yes (4) | was row-less its entire life |
| skills/PublishGateDialog.tsx | **added** | yes (3) | was row-less |
| skills/studio/VersionsTab.tsx | **added** | yes (3) | was row-less |
| pages/SkillTunerPage.tsx | **added** | yes (5) | was row-less; refactor-first audit owed before next feature phase |
| settings/EngineHealthCard.tsx, settings/MemorySection.tsx, skills/SkillTestCasesSection.tsx, skills/studio/CaseEditor.tsx, workflows/library/WorkflowDeleteSheet.tsx | **added** | no | were row-less |
| The other 9 call-site files (ClassificationRulesPage, ExpertCatalogPage, OrgExpertsTab, TakeoffSection, AuditLogSection, ConnectedSourceSection, CreateWatchModal, SourcePreviewPanel, WatchRowCard) | yes | per their rows | loading-arm swap, honoured by construction |

`node scripts/check-hot-file-ledger.cjs .planning/quick/261016-u3w-…`: failed `[no-row]` on 10 files, then **ledger gate OK** after the rows were added.

## Deviations from Plan

1. **[Rule 3 - Blocking] Ledger rows added for 10 files.** The plan said to add rows only if a gate demanded it; `check-hot-file-ledger.cjs` did (exit 1, `[no-row]`). Rows and sections were added to `docs/HOT-FILE-LEDGER.md` in the same commit (`912808491`), with cells under 200 chars. CLAUDE.md was not touched.
2. **[Rule 1 - Bug] The `<SyrelLoader` check would have read 25.** `Record<SyrelLoaderSize, …>` in SyrelLoader.tsx also matched the grep. A local `type Size` alias fixes it so the plan's check gives 23. This edit went into the Task 3 commit (`8f2ebae09`).
3. **ModelRegistryTab card (case b):** the kept card div dropped its `flex items-center gap-2` as well as its `role="status"`. Left on a flex row, the panel loader would sit left-aligned. The a11y test still finds exactly one status with the registry words.
4. **Commit 5 uses a `docs(...)` prefix** for the ledger, because it is a docs-only change.

## Known Stubs

None.

## Self-Check: PASSED
