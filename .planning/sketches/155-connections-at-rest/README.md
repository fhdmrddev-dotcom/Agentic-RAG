---
sketch: 155
name: connections-at-rest
question: "Where does a per-row, per-org CRUD surface live in a whole-tab-Save Settings — and what is a connection's 3-second identity, at 3 connections and at 24?"
winner: null
tags: [settings, connections, connectors, phase-190, placement, scale, kill-switch]
phase: 190
---

# Sketch 155: Connections at rest

## Design Question

Two questions that have to be answered together:

1. **Placement.** `SettingsPage.tsx:875-884` ships five tabs, and every one of them is a
   *single-value form saved en masse* — the Integrations tab ends in one **Save Integrations**
   button (`:1354-1365`). A connector connection is the opposite shape: per-org, **per-row**,
   created/edited/deleted one at a time, each carrying a write-only secret. Does it become a
   sixth tab, or a `SectionCard` inside the shipped Integrations tab?
2. **Identity.** What are the facts a connection must lead with, such that the same line works
   on this page *and* inside the author's picker?

## How to View

```
open .planning/sketches/155-connections-at-rest/index.html
```

## Variants

- **A: Own tab · capability board** — a new "Connections" tab, grouped into Email / Tickets /
  Messages, each group with its own count and Add. Reads as three shelves.
- **B: Inside Integrations (the foil)** — Connections as a third `SectionCard` below Web Search
  and Code Execution, under the tab's single Save button. **Built to be rejected, not to win** —
  it exists to make the two-save-models conflict visible rather than argued about. Press
  *Save Integrations* to flash the conflict note.
- **C: Own tab · instrument table** — one table (the 068-A roster lineage): Connection ·
  Sends to · Used by · Credential · State, over a filter bar with capability chips and a live count.

## What to Look For

**Run the `scale` control first — it is the point of this sketch.** Everything looks fine at 3.
The real question is 24, because SEED-013's broad catalog and the MCP client both land on this
exact page, and a surface that only works at three capabilities has to be rebuilt the day a
fourth arrives. Your own findings already carry this lesson twice: the 045 real-scale rule
(*"sketch density surfaces at the org's REAL scale"*) and BUG-260624-01, where a fixed grid
crammed illegibly at the real 7–8 provider roster.

Specifically:

- **At 24, does A still read?** Three long shelves with no filter — Messages alone is 13 rows.
- **At 24, does C's filter bar earn itself?** The capability chips + live count (`13 of 24`)
  are C's answer to the same problem A solves with headings.
- **The `tell it` control** — with live sending **off**, compare `banner` / `rows` / `both`.
  At 3 rows the repetition is tolerable; at 24 it is 24 identical amber lines. This is the
  control for the recommended rule: *the banner owns platform-wide truth, the row owns only
  what is true of that row.*
- **State words are never colour alone** (WCAG 1.4.1) — `✓ Ready` · `◌ Not checked` ·
  `✕ Credential failed` · `⏻ Disabled`. Check they read in greyscale.
- **The `empty` scale** — 0 connections is the state every new org sees first, and it has to
  explain what a connection *is* without a manual.
- **The seam strip at the bottom.** Out of scope by D-27 and drawn anyway, at ~1/8 the size:
  it proves the row's identity (name · sends-to · state) is exactly what the author's picker
  renders, so no second vocabulary gets invented at the seam. At `empty` scale it reads
  *"nothing bound — this step will record, not send"*, which is the shipped `recorded_not_sent`
  terminal (D-17) told at author time.

## Grounding

- The 🔒 destination line is the **024-A always-on endpoint footer**, applied to a destination
  rather than a model: you can never bind a connection without seeing where it sends.
- Slack rows carry a `fixed` tag because D-02 makes its host a code constant — one of the three
  destinations is unforgeable by construction, and the surface should say so.
- `Used by N steps` is drawn as a real column because deleting a connection that three published
  workflows depend on is the 073-A victim-naming case, and the count is what names the victims.
- Data is a plausible mid-size org (Northwind), not fixtures — 6 mailboxes, 5 Jira projects,
  13 Slack channels at the 24 scale, which is what per-department binding actually produces.

## Open Questions

- **`Used by` needs a wire that may not exist.** Counting steps that reference a `connection_id`
  means scanning `workflow_definitions.definition` JSONB across published versions. Cheap enough
  as a count, but it is net-new and should be flagged rather than assumed.
- **Capability glyphs here (`✉ ▣ ＃`) are placeholders.** The icon convention says one source per
  concept; these are not canvas `PHASE_GLYPHS` and must not become a fourth icon vocabulary.
  Settle the source before build.
- **Does the sixth tab need an org-admin gate?** D-12 makes connections org-shared, but nothing
  in 190's context says a *member* may create one.
