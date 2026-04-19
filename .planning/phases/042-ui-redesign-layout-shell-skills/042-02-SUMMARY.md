---
phase: 042-ui-redesign-layout-shell-skills
plan: "02"
subsystem: frontend-skills
tags: [ui, skills, 3-pane, layout, react, tailwind, inline-panel]
dependency_graph:
  requires:
    - 042-01 (AppDock layout shell — provides 3-column app structure)
  provides:
    - SkillDetailPanel component (inline panel for 3-pane SkillsPage)
    - 3-pane SkillsPage layout (decorative left | skill list | detail right)
    - SkillCard onSelect prop wiring
  affects:
    - frontend/src/pages/SkillsPage.tsx
    - frontend/src/components/skills/SkillCard.tsx
    - frontend/src/components/skills/SkillFormDialog.tsx
tech_stack:
  added: []
  patterns:
    - SkillForm inner component shared between modal and inline panel
    - 3-pane tonal layout (bg-sidebar | flex-1 | bg-card/30) with border-border/10 separators
    - isCreatingNew state flag to distinguish "no selection" from "create mode"
    - stopPropagation on Pencil button to prevent double-trigger with card onClick
key_files:
  created: []
  modified:
    - frontend/src/components/skills/SkillFormDialog.tsx
    - frontend/src/pages/SkillsPage.tsx
    - frontend/src/components/skills/SkillCard.tsx
decisions:
  - SkillForm extracted as private inner component — not exported, only used by SkillFormDialog and SkillDetailPanel within the same file
  - isCreatingNew boolean state added to SkillsPage to distinguish empty-right-pane from create-mode (skill=null in SkillDetailPanel)
  - Pencil button uses e.stopPropagation() to avoid firing both card onClick and button onClick simultaneously
  - D-10/D-11 pill styling added as comment block in SkillForm — no live env var fields exist yet in the Skill schema; comment provides exact implementation instructions for when they are added
  - SkillFormDialog modal retained as a named export (unchanged behavior) — removed from SkillsPage JSX but available for future use
metrics:
  duration: "~25 minutes"
  completed: "2026-04-19"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 3
---

# Phase 42 Plan 02: SkillsPage 3-Pane Layout + SkillDetailPanel Summary

SkillsPage rebuilt as a 3-pane tonal workspace (decorative left strip | scrollable skill list | inline detail panel). SkillFormDialog refactored to extract a shared SkillForm inner component and export a new SkillDetailPanel for inline use. SkillCard gains onSelect prop so clicking any card populates the right pane without opening a modal.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extract SkillForm + add SkillDetailPanel export | 8769589 | SkillFormDialog.tsx |
| 2 | Rebuild SkillsPage 3-pane layout + wire SkillCard onSelect | 328975d | SkillsPage.tsx, SkillCard.tsx |
| 3 | D-10/D-11 pill styling and badges | 8769589 | SkillFormDialog.tsx (comment block in Task 1 commit) |

## What Was Built

**SkillFormDialog.tsx** — Refactored into three logical sections:

1. `SkillForm` (private inner component) — Receives all form field state as props, renders Name / Description / Instructions / Attached Files fields. Contains the D-10/D-11 comment placeholder specifying exact pill styling (`bg-card/50 ghost-border rounded-lg`) and badge markup (`bg-rose-500/10 text-rose-400` for Required, `bg-muted text-muted-foreground` for ReadOnly) for when env var fields are added.

2. `SkillFormDialog` (modal, unchanged behavior) — Manages its own state, delegates form rendering to `<SkillForm>`, calls `onOpenChange(false)` on save.

3. `SkillDetailPanel` (new export) — Standalone inline panel with own state management, resets on `skill` prop change via `useEffect([skill])`, renders `<SkillForm>` inside a flex-col panel with header/body/footer zones.

**SkillsPage.tsx** — Full rebuild:
- Outer shell: `flex h-full overflow-hidden`
- Pane 1: `w-16 shrink-0 bg-sidebar` (decorative depth anchor)
- Pane 2: `flex-1` center with page header + `space-y-3` skill list (replaced 3-col grid)
- Pane 3: `w-96 shrink-0 bg-card/30` right panel — shows `SkillDetailPanel` when `selectedSkill || isCreatingNew`, otherwise shows "Select a skill to view details" empty state with Zap icon
- State: `selectedSkill`, `isCreatingNew` — no more `dialogOpen`, `editingSkill`, `handleEdit`
- New Skill button: sets `isCreatingNew=true`, clears `selectedSkill` (no modal)

**SkillCard.tsx** — Surgical additions:
- `onSelect: (skill: Skill) => void` added to Props interface and destructure
- Root div: `cursor-pointer` added to className, `onClick={() => onSelect(skill)}`
- Pencil button: `onClick={(e) => { e.stopPropagation(); onSelect(skill); onEdit(skill) }}`

## Verification Results

- `npx tsc --noEmit` exits 0 (no TypeScript errors)
- `export function SkillDetailPanel` found at line 291 of SkillFormDialog.tsx
- `onSelect: (skill: Skill) => void` found in SkillCard Props interface
- `onClick={() => onSelect(skill)}` on SkillCard root div
- `w-16 shrink-0 bg-sidebar` left pane present in SkillsPage
- `w-96 shrink-0` right pane present in SkillsPage
- `Select a skill to view details` empty state text present
- `bg-rose-500/10` and `bg-card/50` present in SkillFormDialog (D-10/D-11)

## Deviations from Plan

None — plan executed exactly as written. The D-10/D-11 comment block was added during Task 1 (as the plan specified for cases where no live env var fields exist), satisfying Task 3's done criteria without a separate commit.

## Known Stubs

None. All three panes render real data. The SkillDetailPanel loads real skill data from the API (name, description, instructions, files). The D-10/D-11 env var input comment is a forward-compatibility marker, not a stub — the current Skill schema has no env_vars field.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced. SkillDetailPanel delegates to existing `updateSkill`/`createSkill` hooks (T-042-03 accepted in plan threat model). File upload/delete paths are unchanged (T-042-04 accepted).

## Checkpoint Status

Task 4 is a `checkpoint:human-verify` gate — execution paused awaiting visual verification at http://localhost:5173 (Skills page via AppDock Zap icon).

## Self-Check: PASSED

- frontend/src/components/skills/SkillFormDialog.tsx: FOUND (modified)
- frontend/src/pages/SkillsPage.tsx: FOUND (modified)
- frontend/src/components/skills/SkillCard.tsx: FOUND (modified)
- Commit 8769589: FOUND
- Commit 328975d: FOUND
