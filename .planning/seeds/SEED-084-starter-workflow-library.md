---
seed_id: SEED-084
title: Starter / seed workflow library (fork-a-starter)
status: planted
status_note: |
  Phase 251 frontmatter migration: this file had NO frontmatter block at all, so no status was
  ever recorded for it. `planted` here is a MIGRATION DEFAULT — it is a statement about the
  absence, never a claim about the seed. Read the body and set it deliberately.
surface: Agentic-RAG
trigger_when: unset
---
# SEED-084: Starter / seed workflow library (fork-a-starter)

**Planted:** 2026-06-14 (during Phase 103 discuss-phase, decision D-103-4)
**Status:** dormant
**Source:** Phase 103 CONTEXT — drafts/seeds shelf scoping

## Idea

The Phase 103 Workflows page ships a shelf above Published containing the caller's **own saved
drafts** + the dashed "Build a workflow" card. The label "seeds" is reserved but 103 ships **no
pre-built starter workflows**. This SEED captures the deferred capability: a curated library of
**fork-able starter workflows** (e.g. "Risk register from KB", "Weekly status digest",
"Compliance gap report") that a user can Tweak→`v(N+1)` into their own draft as a starting point,
instead of describing from a blank box every time.

## Why deferred

- 103's headline birth path is **NL-describe-first** (D-103-C); a starter library is a *second*
  birth path that competes for the same surface and isn't required by any WFAUTH requirement.
- Starter content is **content-pack work** (authoring real, validated, publishable workflows),
  not authoring-infrastructure work — it belongs with the PM flagship content pack / a v3.x
  content milestone, not the authoring-engine phase.
- Forking already exists structurally (Tweak→`v(N+1)` INSERT, immutability-on-publish), so the
  capability is additive later with no rework — only curated `is_global` starter definitions +
  a shelf section need to be added.

## Re-open trigger

Fire when **either**:
1. The Workflows page is live with ≥1 published workflow AND users ask for pre-built templates to
   fork (a recurring "I don't want to start from scratch" signal), **or**
2. Content-pack / flagship-content planning begins (e.g. Phase 104 PM Flagship Content Pack, or a
   v3.x content milestone) — surface this SEED as a candidate so starters ship as `is_global`
   published definitions that the existing shelf can render in a "Starters" section.

## Implementation sketch (when promoted)

- Author starter workflows as real `is_global=true`, `status='published'` `workflow_definitions`
  (they pass the same 8-stage gauntlet — no special-casing).
- Add a "Starters" section to the Workflows page shelf rendering `is_global` published defs
  (the `list_published_workflows` RLS predicate already returns `created_by=$2 OR is_global`).
- Reuse the existing **Tweak→`v(N+1)` fork** flow verbatim — a user forks a starter into a
  personal draft; the starter row stays frozen by the immutability trigger.
- No new runtime, no new CRUD — purely curated content + one shelf section.

## Related
- Phase 103 CONTEXT `<deferred>` (this is the named landing for the deferred item).
- D-103-4 (drafts/seeds shelf decision).
- Tweak→`v(N+1)` fork + immutability-on-publish (Phase 103 REQ-7, migrations 056/067).
