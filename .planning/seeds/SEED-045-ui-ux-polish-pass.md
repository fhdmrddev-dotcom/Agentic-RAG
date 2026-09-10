---
id: SEED-045
status: folded          # folded_into v4.1 (SHELL-01) at /gsd:new-milestone 2026-09-11
folded_into: "v4.1"

planted: 2026-05-31
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 090 operator-testing-notes triage)
trigger_when: A dedicated UI/UX polish milestone is scoped (v2.4 "Stability, Polish & UX Fixes" precedent), typically after v2.8 harness ships; OR any specific nav/chat-list usability item is reported
scope: Medium
---

# SEED-045: UI/UX Polish Pass — nav-panel collapse, long chat-list usability, and the minor-enhancements umbrella

## Why This Matters

The app "looks very good now" (operator, 2026-05-31) but has accumulated minor UX rough edges worth a dedicated polish pass before/after the harness work. Two concrete, confirmed anchors plus an umbrella for the broader set the operator is collecting:

**Anchor 1 — collapsed nav panel hides "New Chat."** In `frontend/src/components/layout/NavPanel.tsx`, when the panel is collapsed to its 64px rail (`w-16`, line 216-217; state persisted in `localStorage` `nav_panel_collapsed`, line 64-71), the **entire chat-list region is `opacity-0 pointer-events-none`** (line 295-296) — and the **New Chat button lives inside that region** (line 311). Net effect (operator-reported): you must **expand the panel to see or create a new chat.** Ironically the *workspace* panel already adopted a "collapse-to-rail, key action stays reachable" pattern (087-08, memory `project_087_08_toggle_consolidation`) — the nav panel never got it.

**Anchor 2 — long chat list is a flat endless scroll.** The recent-chats list (`threads.map`, line 115, inside a `flex-1 overflow-y-auto`, line 293) has **no search, no grouping, no date sections, no pinning, no folder grouping** — so with the operator's 280+ threads it's an unwieldy scroll. (Folders already exist in the data model — grouping by folder or by date is low-hanging.)

**Umbrella:** the operator is planning a broader "polish the whole UI/UX — minor enhancements" pass. This seed is the anchor/collection point for that, so individual polish items don't scatter into one-off notes and get lost.

## When to Surface

**Trigger:** a dedicated UI/UX polish milestone is scoped (the v2.4 "Stability, Polish & UX Fixes" milestone is the precedent — a whole milestone of UX fixes), typically AFTER v2.8 harness ships; OR a specific nav/chat-list usability item is reported.

Present during `/gsd:new-milestone` when the milestone scope matches:
- A UI/UX polish / stability / UX-fixes milestone (v2.4-style)
- Any frontend-experience or navigation/information-architecture work
- Recurrence of a "this part of the UI is clunky" report

## Scope Estimate

**Medium** — sized as a focused polish milestone OR a running list of small `/gsd:quick` fixes (operator chose **future-milestone anchor**: collect items into a dedicated polish milestone surfaced at `/gsd:new-milestone`). Concrete items so far:
- **Collapsed-rail New Chat (small, ship-early candidate):** keep New Chat (and ideally a search / recent affordance) reachable in the 64px rail when collapsed — mirror the 087-08 workspace-panel collapse-to-rail pattern. Contained frontend change; could ship via `/gsd:quick` ahead of the full pass.
- **Chat-list usability:** search/filter box; date-section grouping (Today / Yesterday / Last 7 days / Older); pinning favourites; optional folder grouping (folders already exist). Tames the 280+-thread scroll.
- **(Umbrella) other minor enhancements** as the operator surfaces them — add line-items here.

## Breadcrumbs

- `frontend/src/components/layout/NavPanel.tsx` — collapse state `localStorage('nav_panel_collapsed')` (64-71); rail/expanded widths `w-16`/`w-64` (216-217); chat-list region opacity/pointer gate when collapsed (293-296); New Chat button inside that region (311); `threads.map` flat list (115)
- 087-08 precedent: workspace panel "collapse-to-rail, always-present toggle/action" (memory `project_087_08_toggle_consolidation`)
- Aether Intelligence / Deep Midnight design system (keep polish on-system) — see project skill `sketch-findings-agentic-rag`
- Related seeds: [[SEED-039]] (workspace-panel reliability + polish — panel-specific sibling), [[SEED-015]] (per-thread URL routing — navigation IA), [[SEED-008]] (streaming UX polish — closed; precedent)

## Notes

The collapsed-rail New Chat is the one item worth considering BEFORE the milestone — it's a real "can't do the most common action while collapsed" usability bug, and a small contained fix. Everything else collects into the polish milestone. Keep all changes on the Aether/Deep-Midnight design system and run the lived-experience UI UAT (memory `feedback_uat_lived_experience_gap` / `feedback_exhaustive_ui_state_sweep`) — polish work is exactly where felt-experience defects hide.
