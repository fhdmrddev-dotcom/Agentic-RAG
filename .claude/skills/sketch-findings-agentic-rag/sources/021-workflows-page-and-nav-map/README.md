---
sketch: 021
name: workflows-page-and-nav-map
question: >
  What is the Workflows page — a project-filtered library of drafts AND published
  workflows with CRUD, a strictness-tier badge per card, a Run-into-a-thread handoff,
  and an explicit "tweak → new version" path that never edits a frozen published row —
  plus a clear nav/redirect map of where every action lands?
winner: "A"
tags: [workflows-page, library, crud, strictness-tier, run-handoff, versioning, nav-map, project-filter, extends-012]
---

# Sketch 021 — Workflows Page + Nav/Redirect Map

Extends **012** (the Workflows page library + launcher) with the four things 012 predates:
the **strictness-tier badge** per card, a **project filter** + **drafts/published shelf**,
the **tweak → new version** fork path, and an explicit **nav/redirect map** of where every
action lands. Sits visually beside 012/013 and references the 018→019→020→022 journey
sketched in this family.

## Design Question

Where do you browse, manage (CRUD), and launch a workflow once you own a *library* of them
across a project — drafts you're still shaping and published versions you've frozen — and how
does every actionable element redirect (Run into a thread, Build into the describe screen,
Tweak into a new-version draft, Publish into the gauntlet) so the operator can *see* where they'll land?

## How to View

Open `index.html` in a browser. Three variants switch via the top tabs. Use the bottom-right
**flow toggle** to cycle page states: `0 · Load` (skeleton) → `1 · Browse` → `2 · Run dialog`
→ `3 · In thread` (the Run handoff landing) → `∅ · Empty`. The **🗺️ Map** toolbar button (or
the "Where things go" header button) opens the nav/redirect map overlay. Hover the strictness
badges, the `net-new`/`GET /workflows/published` chips, and the ⓘ dots for the tiered-guidance
popovers. `Esc` closes any overlay.

## Variants

- **A · Card grid + filter rail ★** — extends 012-A: a left **project rail** (the live
  `project_folder_id` filter), a **Drafts & seeds** shelf above a **Published** section, each
  card carrying the strictness badge + phase chain + entry `input_keys`; Run / Tweak / Open actions per source.
- **B · Master-detail** — workflow list (drafts shelf + published shelf) on the left, a detail
  pane on the right with the phase chain, the **gate set** (real validator kinds + always-on
  publish judge + `citation_policy`), **version history** (frozen vs superseded), and Run/Tweak
  (published, read-only) or Open/Publish (draft) actions.
- **C · Compact list** — SkillsPage-style vertical rows optimized for many workflows; inline
  strictness + source badges, a quick-Run button, click-to-expand for the chain + metadata.

## What to Look For

- **Strictness tier badge** — STRICT 🔒 / MIDDLE ◐ / LOOSE ○, each mapping to the *real*
  gate set + `citation_policy` enum (strict / flag / draft). No invented labels (no level 1/2/3,
  no "compliance-mode"). Hover for the plain-language caption.
- **Drafts vs published as a calm shelf** — drafts/seeds shelf above published; a shelf toggle,
  a collapsed search/filter that opens only when needed, a dismissible honesty banner. The page reads clean at rest.
- **Honesty flags in the UI** — the **net-new** violet chip on every draft-CRUD surface and the
  net-new nav entry; the **GET /workflows/published** green chip on the published section
  (the only live list endpoint).
- **Run → thread handoff** — the launch modal collects a kickoff prompt (project folder already
  bound), then `3 · In thread` lands you in a NEW chat thread in **workflow mode** that reuses
  the existing run/stream/lock plumbing (008-D timeline + 009-C seam + 011-A composer). Nothing runs on the page.
- **Tweak → new version** — opening a published workflow is read-only; Tweak forks a new draft
  version (v2 → v3), the frozen row untouched, with the per-version immutability made explicit.
- **Nav / redirect map overlay** — the operator-requested surface: the whole journey
  (Workflows → 018 → 019 → 020 → Run → thread/022) plus a row-per-action table of exactly where
  each element lands.
