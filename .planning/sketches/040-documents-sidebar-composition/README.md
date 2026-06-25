---
sketch: 040
name: documents-sidebar-composition
question: "Does the Documents left rail hold with Folders + Views + Automation all present — and where is governance health reached from?"
winner: "A"
tags: [phase-119, consistency, layout, sidebar, navrow, folders, views, automation, governance, push-split, mobile]
---

# Sketch 040: Documents Sidebar Composition (consistency)

> **WINNER: A — governance is a top-level nav home; rail stays pure Folders+Views+Automation**
> (operator + adversarial judge panel `wf_a961f729-247`, 2026-06-21; MEDIUM confidence,
> 3 of 4 lenses). **Key clarity:** 040-A and 040-C are **identical on the load-bearing
> PLACEMENT axis** (both keep governance top-level) — they differ only on the secondary
> *density* axis (A static-stacked vs C collapsible group headers). A adds **literally nothing
> to the rail** (governance is the `NAV_ITEMS`/`ActiveView` route SC#1 already mandates) and
> quarantines all alarm chrome to the icon rail (no standing warn-color in the docnav). **C is
> the documented density FALLBACK — promote it the moment real folder-tree depth (the only
> group that grows) becomes the dominant rail pain; it stays fully IA-coherent with 038-A.**
> **B is the forbidden pick:** it demotes governance to a 4th in-rail entry (a permanently
> amber false-alarm-at-rest) and forces the inconsistent 038-C pairing. **IA lock satisfied:
> 038-A + 040-A both top-level.**

A consistency pass, not a new surface. Sketch **032** validated the 4-column Documents
composition **before** the Automation group (sketch 037) and a governance surface
(Phase 119) existed. This re-checks: does the left rail still hold with **Folders +
Views + Automation** all present from the shared `NavRow`, and where does governance get
reached from?

## Design Question

Does the growing Documents rail compose without crowding, and where should the Phase-119
governance health view live relative to it?

## How to View

```
open .planning/sketches/040-documents-sidebar-composition/index.html
```

Toggle **panel:** (top-right) to open the shared detail panel — the rail collapses to a
50px icon stub (sketch-032 precedent); "Pin sidebar" keeps it expanded. In C, click a
group header ("Views" / "Automation") to collapse it. Use 📱 in the toolbar for mobile.

## Variants

- **A: Governance = top-level nav** — the rail stays purely about *finding* documents
  (Folders + Views + Automation); governance is a sibling top-level home (the shield, badge
  22). Clean separation; governance is one nav-hop from its documents. *(Pairs with 038-A.)*
- **B: Governance = 4th rail entry** — a single "Governance health" `NavRow` at the **foot
  of the rail** with the warn-count, co-located with the documents. Co-location at the cost
  of a fourth element competing with a long folder tree. *(Pairs with 038-C.)*
- **C: Collapsible group headers** — each group header (Folders / Views / Automation)
  **collapses** with its count retained, so a long folder tree can't bury Views/Automation.
  The density cure for the growing rail; governance stays a top-level home.

## What to Look For

- **Density** — with a real folder tree + 3 saved views + 2 rules, does any variant feel
  crowded? Does C's collapse meaningfully help a 5-deep tree?
- **Group legibility** — do Folders (amber folder), Views (funnel), Automation (Zap/green)
  read as distinct *peers* built from one `NavRow`, or do three groups blur together?
- **Collapse-to-rail** — when the detail panel opens, the rail shrinks to a 50px icon stub
  (folder + funnel-3 + bolt-2). Does the stub still signal what's there? Does B's
  governance entry survive the collapse legibly?
- **Where governance belongs** — sibling home (A/C) vs. in-rail (B). This is the same IA
  question 038 asks from the surface side — the two winners must agree.
- **Mobile** — at ≤420px the rail goes off-canvas (drawer); confirm the composition
  degrades, not breaks.

## Build Handover (reuse vs net-new)

- **Reuse (all already shipped):** the shared `NavRow` (count slot, tooltip `G` pill,
  reachable actions), `FolderTree`/`FolderNode`, `ViewsGroup`, `AutomationGroup`, the
  sketch-032 sidebar→icon-rail collapse (pinnable, session-persisted), the `MoveToFolderDialog`
  shell. Nothing in the rail itself is net-new for 119.
- **Net-new (only if B wins):** a governance `NavRow`-style entry inside the Documents
  sidebar + its warn-count source. A/C add nothing to the rail — governance is its own
  route via `NAV_ITEMS` / `ActiveView`.
- **Consistency lock:** whichever IA the 038 + 040 winners pick must match — don't ship
  a top-level governance home (038-A) with an in-rail entry (040-B), or governance ends up
  reachable two inconsistent ways.
