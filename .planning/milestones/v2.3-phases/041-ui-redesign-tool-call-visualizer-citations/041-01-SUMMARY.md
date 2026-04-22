---
phase: 041-ui-redesign-tool-call-visualizer-citations
plan: "01"
subsystem: frontend-chat-ui
tags: [ui, glassmorphism, tool-call-visualizer, citations, deep-midnight]
dependency_graph:
  requires: []
  provides:
    - ToolCallPanel glassmorphic depth upgrade
    - CitationCard gradient left-accent + file-type icons
  affects:
    - frontend/src/components/chat/ToolCallPanel.tsx
    - frontend/src/components/chat/CitationCard.tsx
tech_stack:
  added: []
  patterns:
    - bg-card/80 backdrop-blur-sm (done-state panel wrapper)
    - bg-card/50 backdrop-blur-md (nested content blocks)
    - w-0.5 bg-gradient-to-b (gradient left-accent strip)
    - getFileType + getAccentClasses helpers (color-coded file icons)
key_files:
  created: []
  modified:
    - frontend/src/components/chat/ToolCallPanel.tsx
    - frontend/src/components/chat/CitationCard.tsx
decisions:
  - Done-state ToolCallPanel uses bg-card/80 backdrop-blur-sm (lighter glass) consistent with HealthPanel outer card pattern
  - Inner content blocks (ToolArgsBlock, ToolResultBlock) use bg-card/50 backdrop-blur-md for nested depth
  - CitationCard gradient strip replaces border-l-2 solid border to match Deep Midnight aesthetic
  - getFileType extension check covers pdf, docx/doc, md/markdown with default fallback
  - FileCode icon used for Markdown only; FileText for pdf/docx/default
metrics:
  duration: "~4 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  files_modified: 2
---

# Phase 041 Plan 01: ToolCallPanel & CitationCard Visual Upgrade Summary

Glassmorphic depth applied to ToolCallPanel done-state wrapper and inner content blocks; CitationCard upgraded with w-0.5 gradient left-accent strip and color-coded file-type icons (red/blue/purple).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Upgrade ToolCallPanel glassmorphic wrapper and parameter blocks | 5b6868e | frontend/src/components/chat/ToolCallPanel.tsx |
| 2 | Upgrade CitationCard gradient left-accent strip and file-type icons | f75b19e | frontend/src/components/chat/CitationCard.tsx |

## Changes Made

### Task 1 — ToolCallPanel.tsx

Three targeted Tailwind class replacements:

1. **Done-state wrapper** (line 520): `bg-muted/30 ghost-border` → `bg-card/80 backdrop-blur-sm ghost-border`
2. **ToolArgsBlock parameter block** (line 96): `bg-muted/30` → `bg-card/50 backdrop-blur-md`
3. **ToolResultBlock result block** (line 434): `bg-muted/15` → `bg-card/50 backdrop-blur-md`

Active state (`bg-primary/5 border border-primary/20 shadow-[...]`) unchanged.

### Task 2 — CitationCard.tsx

Full component rewrite (logic unchanged):

- Added `FileCode` to lucide-react import
- Added `getFileType(filename)` helper returning `"pdf" | "docx" | "md" | "default"`
- Added `getAccentClasses(fileType)` helper returning `{ gradient, iconColor }` per type
- Replaced `border-l-2 border-muted-foreground/30 pl-3` outer div with flex row containing:
  - `w-0.5 self-stretch bg-gradient-to-b` gradient strip div (first child)
  - `pl-3 flex-1 min-w-0` content wrapper (second child)
- File icon: `FileCode` (purple) for `.md`/`.markdown`; `FileText` (red/blue/muted) for other types
- Expand/collapse passage behavior unchanged

## Verification

- `grep "bg-card/80 backdrop-blur-sm ghost-border" ToolCallPanel.tsx` → 1 match
- `grep "bg-card/50 backdrop-blur-md" ToolCallPanel.tsx` → 2 matches
- `grep "bg-muted/30\|bg-muted/15" ToolCallPanel.tsx` → 0 matches (in target lines)
- `grep "bg-gradient-to-b" CitationCard.tsx` → 1 match
- `grep "w-0.5 self-stretch" CitationCard.tsx` → 1 match
- `grep "FileCode" CitationCard.tsx` → 2 matches (import + usage)
- TypeScript: `tsc --noEmit` exits 0 (no errors)

## Deviations from Plan

None — plan executed exactly as written. Three Tailwind class swaps in ToolCallPanel.tsx and a full CitationCard.tsx rewrite per plan specification.

## Known Stubs

None — all changes are visual Tailwind class modifications with no placeholder data or hardcoded empty values.

## Threat Flags

None — extension parsing in `getFileType` is read-only string manipulation; filename rendered as text node via JSX (not dangerouslySetInnerHTML). Consistent with T-041-01 accepted disposition in plan threat model.

## Self-Check: PASSED

- FOUND: frontend/src/components/chat/ToolCallPanel.tsx
- FOUND: frontend/src/components/chat/CitationCard.tsx
- FOUND: .planning/phases/041-ui-redesign-tool-call-visualizer-citations/041-01-SUMMARY.md
- FOUND commit: 5b6868e (ToolCallPanel glassmorphic upgrade)
- FOUND commit: f75b19e (CitationCard gradient left-accent + file-type icons)
- TypeScript: tsc --noEmit exits 0 (no errors in modified files)
