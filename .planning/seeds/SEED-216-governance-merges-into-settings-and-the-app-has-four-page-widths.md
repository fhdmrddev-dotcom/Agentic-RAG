---
seed_id: SEED-216
title: Governance merges into Settings — and the app carries FOUR page widths across six pages with no convention
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, from the operator while driving the Settings width — "in the future this governance will be merged with other settings, this is a future milestone"
surface: Agentic-RAG
severity: minor
category: information architecture / design system
priority: medium
scope: >
  TWO separable things, deliberately in one seed because the first decides the second:
  (1) Governance becomes a Settings tab rather than its own page — the operator's stated
  future milestone; (2) the app picks ONE page measure instead of four.
affected_areas: [frontend/settings, frontend/governance, design-system, app-navigation]
relates_to:
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/GovernancePage.tsx
  - .claude/skills/sketch-findings-agentic-rag/references/app-information-architecture.md
re_open_trigger: >
  Either (a) the milestone that merges Governance into Settings is scoped, or (b) any phase
  that adds a page and has to choose a width — that phase should not have to invent a fourth
  answer, and picking one is cheap while only six pages exist.
trigger_when: unset
---

# SEED-216 — one page absorbing another, and the measure question underneath it

## The operator's direction, verbatim

> *"If it's that simple make governance also full width. In the future this governance will
> be merged with other settings — this is a future milestone."*

Governance is a **future Settings tab**, not a permanent page. That is the fact this seed
exists to keep, because nothing else in the tree records it.

## What was measured, 2026-08-28

Asked *"why is Settings narrow — shouldn't the pages be consistent?"*, the honest answer was
that **there was no convention to break**:

| page | container | |
|---|---|---|
| `SettingsPage` | `max-w-3xl` → **`max-w-6xl`** | changed 2026-08-28 |
| `GovernancePage` | `max-w-3xl` → **`max-w-6xl`** | changed 2026-08-28, this seed |
| `KnowledgeHealthPage` | `max-w-6xl` (1152) | the precedent both adopted |
| `SkillsPage` | *unconstrained* | |
| `IngestionPage` | *unconstrained* | |
| `SkillStudioPage` | *unconstrained* | |

**Four widths, six pages.** Settings was not an outlier that broke a rule; it inherited one
of four answers, and so did everything else.

⚠ **The two changes above narrowed it to THREE widths and standardised NOTHING.** They were
made for concrete reasons — Connections puts a five-column table inside a form measure, and
Governance should already share the measure it will be merged into — not as a convention.
Recording that distinction is the point: a later reader must not mistake two local fixes for
a decision that was never taken.

## Why `6xl` and not unconstrained, since the operator said "full width"

Stated so the next person does not read it as a half-measure. `max-w-6xl` is **1152px**, and
it is a width the app **already uses** — adopting it invents nothing. Dropping the constraint
entirely would fix the one cramped table by running every FORM on both pages edge-to-edge on
a wide monitor, and a paragraph at full screen width is the readability problem a measure
exists to prevent. Settings' AI Model and Memory tabs, and most of Governance, are forms and
prose with no table to justify paying that cost.

⚠ **If the merged surface turns out to need more room, the answer is a wider measure or a
per-tab one — not the absence of one.**

## What the merge itself has to settle, when it is scoped

- **Routing.** Settings tabs carry numeric routing keys and a persisted
  `settings_active_tab`; `SettingsPage.tsx` records that appending a key renumbers nothing
  and that a user's stored tab keeps pointing where they left it. Governance arriving as a
  tab must take the next FREE key, never renumber.
- **The operator/org boundary.** Governance is org-scoped; some of what sits near it is
  operator-only and lives behind `/admin`'s router-level `require_operator` — which Phase 146
  makes a byte-identical 404. A merged surface must not offer an org admin a tab that 404s;
  that exact defect was caught once already (212 REACH-1).
- **Whether the page keeps a URL.** ⚠ `SEED-185` — the app has **no URL router**, so a
  Governance *tab* is not reachable by link the way a page is. Anything that links to
  Governance today has to be found first.

## Explicitly NOT in scope here

Standardising the three unconstrained pages. That is the real convention question, it touches
surfaces nobody has driven, and it should be decided once — with a screenshot of each — rather
than page by page as each one is noticed.
