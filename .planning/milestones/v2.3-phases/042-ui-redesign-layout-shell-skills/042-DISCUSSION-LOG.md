# Phase 42: UI Redesign — Layout Shell & Skills - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 042-ui-redesign-layout-shell-skills
**Areas discussed:** AppDock shape & placement, SkillsPage 3-pane layout, Toggle glow & pill styling, SettingsPage tonal shifts

---

## AppDock Shape & Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Vertical icon rail + Sidebar unchanged | AppDock is a narrow icon-only column far left; Sidebar stays with thread list to its right. Layout: AppDock \| Sidebar \| Main. | ✓ |
| AppDock replaces Sidebar bottom | Nav buttons move into a sub-component inside existing Sidebar. No layout change. | |

**User's choice:** Vertical icon rail + Sidebar unchanged

---

| Option | Description | Selected |
|--------|-------------|----------|
| Chat, Docs, Health, Skills, Settings \| Sign Out | Top cluster all 5 views; Sign Out pinned to bottom. | ✓ |
| Chat, Docs, Skills, Settings \| Theme, Sign Out | Omit Library Health; theme toggle in AppDock. | |
| Custom | Describe own arrangement. | |

**User's choice:** Chat, Docs, Health, Skills, Settings | Sign Out (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Indigo-to-cyan gradient pill background | Active icon gets gradient-primary pill behind it. | ✓ |
| Gradient icon color + glow | Icon itself is gradient-colored with drop-shadow glow. | |
| White icon + left accent bar | Left 2px gradient bar marks active. | |

**User's choice:** Indigo-to-cyan gradient pill background (recommended)

---

## SkillsPage 3-Pane Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Nav sidebar \| Skill list \| Inline detail panel | Left: decorative tonal. Center: SkillCards. Right: inline edit form. | ✓ |
| Filter/nav \| Skill list \| Detail panel | Left: My Skills / Global filter tabs. | |
| Nav sidebar \| Skill list \| Dialog stays modal | 3-pane visual only; dialog remains modal. | |

**User's choice:** Nav sidebar | Skill list | Inline detail panel (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Empty / decorative tonal column | Left pane is visual depth only, no interactive content. | ✓ |
| Filter tabs: My Skills / Global | Left pane filters center list. | |
| Import / New buttons | Left pane houses action buttons. | |

**User's choice:** Empty / decorative tonal column

---

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state with prompt | "Select a skill to view details" + Zap icon. | ✓ |
| New Skill form pre-loaded | Right panel shows blank create form by default. | |
| Stats / summary card | Aggregate skill stats when nothing selected. | |

**User's choice:** Empty state with prompt (recommended)

---

## Toggle Glow & Pill Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle switch track | Track uses gradient-primary when checked; thumb stays white. | ✓ |
| Toggle + card row left accent | Track glows AND card gets gradient left bar when enabled. | |
| Toggle icon glow only | Zap icon glows; toggle switch unchanged. | |

**User's choice:** Toggle switch track (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Pill badges inline after the input | Small rounded pill spans after input field. Required=rose, ReadOnly=muted. | ✓ |
| Badges inside the input pill | Badge embedded as suffix chip inside pill-shaped input. | |
| Label annotation only | Asterisk on label, italic 'read only' text. | |

**User's choice:** Pill badges inline after the input (recommended)

---

## SettingsPage Tonal Shifts

| Option | Description | Selected |
|--------|-------------|----------|
| Cards stay, get tonal bg treatment | Cards kept; bg-card/60 outer, bg-card/40 nested. Border → ghost-border only. | ✓ |
| Cards removed, raw sections with tonal bg bands | Strip Card wrappers; raw divs with alternating bg shades. | |
| Sticky section headers + subtle bg tint | Cards stay; CardHeader becomes sticky with darker bg. | |

**User's choice:** Cards stay, get tonal bg treatment (recommended)

---

## Claude's Discretion

- AppDock rail width (w-12 vs w-14)
- Left pane width in SkillsPage (fixed vs proportional)
- Exact tonal bg values for SkillsPage panes
- Whether SkillFormDialog modal trigger kept for accessibility fallback

## Deferred Ideas

None.
