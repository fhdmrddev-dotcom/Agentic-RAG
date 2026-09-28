---
seed_id: SEED-320
title: LLM calls made outside a run (the Expert handoff summary) are disclosed on /admin/spend but never metered
created: 2026-09-28
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching backend/app/services/thread_handoff.py, adding or changing a provider call that is not made inside a runs row (summaries, titles, authoring drafts), or changing what /admin/spend counts.
trigger_paths: ["backend/app/services/thread_handoff.py", "backend/app/services/expert_authoring.py", "backend/app/services/skill_body_authoring.py", "backend/app/db/rates.py", "frontend/src/components/admin/spend/AttributionDisclosures.tsx"]
trigger_surfaces: [admin, chat, provider]
migration_note:
relates_to: ["268", "D-268-11", "SEED-303", "frontend/src/components/admin/spend/AttributionDisclosures.tsx"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-320: Non-run LLM calls are disclosed, not metered

## The finding

Phase 268 meters every `runs` row (roots and sub-agents) on `/admin/spend`. Provider calls made OUTSIDE a run have no
`runs` row and therefore no tokens and no cost anywhere. The handoff summary (`thread_handoff.py`, Phase 267) is the
named case: D-268-11 chose to DISCLOSE it — the Blind Spots tile "Handoff summaries not metered" — rather than meter it.
Other non-run calls (auto-titles, Expert / skill authoring drafts) are the same shape and are not even disclosed.

## Why it matters

The cockpit's thesis is that the total is honest. Every non-run call is spend the org pays that the total omits. It is
small per call today; it grows with every feature that calls a model outside the agent loop.

## When to surface

Any phase that edits `thread_handoff.py` or adds a provider call outside a run, or changes what `/admin/spend` counts.

## Scope estimate

Medium: a usage sink for non-run calls (a small ledger table or a synthetic run kind), priced through the one
`cost_usd_sql` home, plus a line on the Spend by Expert table. A migration and a disclosure-copy change.

## Breadcrumbs

- 268-CONTEXT.md D-268-11; `AttributionDisclosures.tsx` (the tile that states it).
