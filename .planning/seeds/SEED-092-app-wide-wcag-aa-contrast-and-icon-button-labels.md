---
seed_id: SEED-092
title: App-wide WCAG 2.1 AA gap — low-contrast `text-muted-foreground/60` token + unlabeled icon-only buttons across the app
status: planted
planted: 2026-06-20
phase_origin: "Phase 114 verify-work (114-VERIFICATION.md SC#4 human_needed) + orchestrator-driven Lighthouse accessibility audit (snapshot, desktop): accessibility 87/100 — 2 failing audits: color-contrast (19 nodes) + button-name (46 nodes)"
category: accessibility / design-system — a cross-cutting UX-01 acceptance gap (shared Tailwind tokens + icon-button labeling), NOT a Phase-114-specific defect
related_seeds: []
related_memories: [feedback_exhaustive_ui_state_sweep, feedback_uat_lived_experience_gap, project_114_planned]
related_decisions:
  - "UX-01 is the cross-cutting 'Deep Midnight / Aether, mobile-responsive, WCAG 2.1 AA' acceptance bar on every v3.0 phase. Phase 114 met Deep Midnight + mobile live, but the WCAG AA contrast + accessible-name failures are inherited from the shared design system, not introduced by 114."
re_open_triggers:
  - Any phase whose verify-work runs a calibrated a11y audit (Axe/Lighthouse) and is blocked from a clean UX-01 pass by these same shared failures (color-contrast on muted tokens, unlabeled DocumentList/nav icon buttons).
  - A formal accessibility audit, VPAT request, or enterprise/procurement requirement that demands documented WCAG 2.1 AA conformance.
  - A design-system refresh / token pass that is touching color tokens anyway — cheapest moment to raise the muted-foreground contrast.
priority: medium
suggested_phase: a dedicated app-wide accessibility-remediation pass (decide once, app-wide). NOT folded into a single feature phase — fixing only one surface while the shared token + other pages fail identically would be inconsistent and give a false "AA-clean" signal.
---

# SEED-092 — App-wide WCAG 2.1 AA: muted-token contrast + unlabeled icon buttons

## The gap

A calibrated Lighthouse accessibility audit of the live Documents page (Phase 114
verify-work, 2026-06-20) scored **87/100** with two failing categories:

1. **color-contrast (19 nodes)** — the offenders are predominantly the shared
   `text-muted-foreground/60` (and `/50`) Tailwind token used **app-wide**
   (CitationCard, MessageInput, OutputFileCard, ToolCallPanel, DocumentUpload,
   FolderBreadcrumb, FolderTree, ConditionPopover, …) plus `transition-opacity`
   count/name spans. At reduced opacity over the Deep Midnight surfaces these fall
   below the WCAG AA 4.5:1 ratio.
2. **button-name (46 nodes)** — icon-only buttons without an accessible name,
   predominantly **pre-existing** (DocumentList row action icons + the persistent
   left nav), audited page-wide. Phase 114's own new controls (FilterBar remove,
   ViewsGroup/NavRow actions, RelativeDateControl steppers) DO carry accessible
   names — verified in the a11y snapshots during the 114 G-4 UAT.

## Why it's a seed, not a Phase-114 fix

These are cross-cutting design-system issues (the muted token + the icon-button
labeling convention) shared across every page. Fixing them properly is an
app-wide token-contrast bump + a sweep to label all icon-only buttons — far
beyond a single feature phase's blast radius, and risky to graft onto 114.
Phase 114 introduced no NEW AA regression beyond the shared tokens. The operator
elected (2026-06-20) to complete Phase 114 and log this as the UX-01 follow-up.

## Concrete starting points when this re-opens

- Raise the muted-foreground token (or stop stacking `/60` opacity on it over
  dark surfaces) so it clears 4.5:1; re-audit with Axe + Lighthouse.
- Add `aria-label`/`sr-only` names to the DocumentList row action icons and any
  other icon-only buttons surfaced by the `button-name` audit (46 nodes).
- Add a keyboard-only navigation pass (Tab/Enter reach every row action + popover)
  to the UX-01 acceptance checklist — Lighthouse snapshot cannot fully exercise it.
