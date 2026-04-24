---
phase: 042-ui-redesign-layout-shell-skills
plan: "03"
subsystem: frontend-skills-settings
tags: [ui, skills, settings, toggle, gradient, tonal, react, tailwind]
dependency_graph:
  requires:
    - 042-01 (AppDock layout shell)
    - 042-02 (SkillsPage 3-pane layout + SkillCard onSelect)
  provides:
    - SkillCard gradient track toggle (indigo-to-cyan pill when enabled)
    - SettingsPage tonal card depth (bg-card/60 outer, space-y-1, bg-card/40 nested sub-sections)
  affects:
    - frontend/src/components/skills/SkillCard.tsx
    - frontend/src/pages/SettingsPage.tsx
tech_stack:
  added: []
  patterns:
    - Inline backgroundImage style for gradient toggle track (avoids Tailwind gradient-opacity limitations)
    - Two-level tonal depth: bg-card/60 outer Card + bg-card/40 nested field-group div
    - space-y-1 replaces divide-y divide-border/30 for ghost-style section separation
key_files:
  created: []
  modified:
    - frontend/src/components/skills/SkillCard.tsx
    - frontend/src/pages/SettingsPage.tsx
decisions:
  - backgroundImage inline style used for gradient track (not Tailwind class) — Tailwind cannot apply arbitrary gradient with opacity modifiers at runtime; inline style is the correct pattern per UI-SPEC
  - Embedding and Web Search sections wrapped in bg-card/40 sub-section — both have 2+ related fields; single-field sections (Code Execution) and sections with their own internal card treatment (LLM Providers using ProviderCard) excluded per plan judgment guidance
  - Eye/EyeOff imports fully removed from SkillCard — no other usage in file; Button import retained for other action buttons
metrics:
  duration: "~10 minutes"
  completed: "2026-04-19"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 42 Plan 03: Toggle Glow + SettingsPage Tonal Treatment Summary

SkillCard enable/disable toggle upgraded from an icon-only Eye/EyeOff button to a pill-track switch with indigo-to-cyan gradient when enabled. SettingsPage SectionCard and AuditLogSection Card upgraded from bg-card/50 to bg-card/60, divide-y separator replaced with space-y-1, and nested field groups in Embedding and Web Search sections wrapped in bg-card/40 tonal sub-section containers.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | SkillCard toggle glow — replace Eye/EyeOff with gradient track toggle | 1ff29c0 | frontend/src/components/skills/SkillCard.tsx |
| 2 | SettingsPage tonal card treatment — bg-card/60 outer + divide-y replacement + bg-card/40 nested sub-sections | 23a9732 | frontend/src/pages/SettingsPage.tsx |

## What Was Built

**SkillCard.tsx** — Toggle redesign:
- Removed `Eye` and `EyeOff` from lucide-react imports (no longer used)
- Replaced `<Button variant="ghost" size="icon">` wrapping Eye/EyeOff icons with a plain `<button>` containing a pill-track `<div>`
- Track: `h-5 w-9 rounded-full transition-all duration-200` — `bg-muted` when disabled, `backgroundImage: linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))` inline style when enabled
- Thumb: `h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform` — `translate-x-4` when enabled, `translate-x-1` when disabled
- Accessibility: `aria-pressed={localEnabled}` and `aria-label` on the button, `focus-visible:ring-2 focus-visible:ring-primary/30` focus ring
- `onSelect` prop from Plan 02 retained (no regression)

**SettingsPage.tsx** — Tonal treatment:
- `SectionCard`: `bg-card/50` → `bg-card/60`, `divide-y divide-border/30` → `space-y-1` in the CardContent wrapper div
- `AuditLogSection` Card: `bg-card/50` → `bg-card/60`
- Embedding SectionCard children: all 4 FieldRows wrapped in `<div className="bg-card/40 rounded-md px-3 py-2">`
- Web Search SectionCard children: both FieldRows wrapped in `<div className="bg-card/40 rounded-md px-3 py-2">`
- No bare `border` without `ghost-border` found on Card-level wrappers — scan confirmed clean

## Verification Results

- `grep -n "backgroundImage.*linear-gradient" SkillCard.tsx` → line 162: FOUND
- `grep -n "Eye \|EyeOff" SkillCard.tsx` → no matches (imports removed, no usage)
- `grep -n "translate-x-4" SkillCard.tsx` → line 167: FOUND
- `grep -n "bg-card/60" SettingsPage.tsx` → lines 118, 319 (SectionCard + AuditLogSection): FOUND
- `grep -n "bg-card/40" SettingsPage.tsx` → lines 649, 728 (Embedding + Web Search): FOUND
- `grep -n "divide-y divide-border/30" SettingsPage.tsx` → no matches: FOUND
- `grep -n "space-y-1" SettingsPage.tsx` → line 124 (SectionCard CardContent): FOUND
- `npx tsc --noEmit` → exits 0 (no TypeScript errors)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All changes are pure visual/CSS — no data flow or stub values introduced.

## Threat Flags

None. Both files contain only CSS class changes and toggle UI replacement using the same existing `handleToggleEnabled` handler. No new network endpoints, auth paths, or data exposure surfaces introduced. Consistent with T-042-05 and T-042-06 accepted dispositions in the plan threat model.

## Self-Check: PASSED

- frontend/src/components/skills/SkillCard.tsx: FOUND (modified)
- frontend/src/pages/SettingsPage.tsx: FOUND (modified)
- Commit 1ff29c0: FOUND
- Commit 23a9732: FOUND
