---
seed_id: SEED-293
title: "The competitive record crawled Beam, Glean and n8n — and missed Airia, the one company making OUR differentiator claim. A crawl is perishable, and this one is 40 days old."
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note: "Planted 2026-09-18. MEASURED before planting: `grep -rli airia` over `.planning/` and `docs/` returns ZERO. The v3.6 crawl (Beam / Glean / n8n) is the record, it dates to 2026-08-09, and it is what every differentiator claim in this project currently rests on."
trigger_when: >
  Fire at EVERY /gsd:new-milestone. A competitive crawl is perishable in exactly the way a
  milestone audit is — the v4.2 close proved an audit describing a tree that no longer existed,
  and a market read goes stale faster than a tree does.

  Fire ALSO before any claim of the form "nobody else does this" is written into a ROADMAP, a
  README, a landing page, an investor deck or a pitch. That sentence is the liability; this seed
  is the check on it.

  Mechanical check that the record is still the stale one, from the repo root:
    grep -rli "airia" .planning/ docs/ README.md
trigger_paths:
  - ".planning/PROJECT.md"
  - ".planning/ROADMAP.md"
  - "README.md"
trigger_surfaces: []
migration_note:
relates_to:
  - SEED-291 — the extension contract. The differentiator this record is supposed to defend.
  - SEED-294 — go-to-market. A GTM built on an unverified "nobody else does this" is built on sand.
  - SEED-068 — public benchmark scoreboard. The outward-facing half of the same problem.
  - Phase 185 / v3.6 — graded governance, and the crawl that declared it white space.
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-293: The competitive record is stale, and it missed the closest competitor

## The finding

The project's competitive record is the **v3.6 deep crawl of Beam, Glean and n8n**, dated
2026-08-09. Its conclusion — that none of them grade strictness by grounding — is the evidence
behind the graded-governance differentiator claim, which is in turn the thing SEED-291's whole
extension contract exists to protect.

**Measured 2026-09-18: `grep -rli "airia"` across `.planning/` and `docs/` returns nothing.**

Airia is described publicly as a unified enterprise platform for discovering, governing, securing
and orchestrating AI models, tools and agents, with runtime guardrails, policy enforcement and
audit-ready governance — and is reported to have won a Gold Globee for Best Agentic Workflow
Orchestration Platform and a Globee for Best Data Management and Governance Platform.
**[UNVERIFIED — web-sourced 2026-09-18, confirm against primary sources before quoting.]**

That description is our claim, in our words. The crawl that declared the position unoccupied did
not include the company occupying it.

## Why it matters

**This is not really about Airia.** It is about what the crawl's absence means structurally:

1. **A differentiator claim is only as current as its crawl**, and this one is 40 days old in a
   category that moves monthly.
2. **"Nobody else does this" is the single most dangerous sentence in a pitch.** It is the one a
   buyer, an investor or a sponsor will personally check, and being wrong on it costs more
   credibility than the feature was worth.
3. **The register has no home for competitors at all.** There is no `COMPETITORS.md`, no crawl
   cadence, no re-open trigger. The v3.6 crawl exists as milestone prose, which means it can only
   ever be as fresh as the milestone that wrote it.

⭐ **The reframe that survives the finding:** even if Airia sells governance, the claim this
project can still make is narrower and harder to copy — **governance that the extension surface
is structurally incapable of loosening** (SEED-291). "We govern agents" is a crowded sentence.
"Our plugin surface cannot loosen policy, by construction" is not. **Verify before claiming
either.**

## When to surface

1. **Every `/gsd:new-milestone`** — re-crawl, or explicitly record that the crawl was skipped and
   the claim is therefore unverified this cycle.
2. **Before any "nobody else does this" sentence** reaches a ROADMAP, README, landing page,
   investor deck or customer conversation.

## Scope estimate

**Small, and the first increment is one paragraph.** Add Airia to the record. The durable version
is slightly larger: give competitors a home with a crawl date and a re-open trigger, so the next
claim inherits a dated record instead of a remembered one.

## Breadcrumbs

- Outside architecture read, 2026-09-18 (`.planning/external-reviews/`) §3.1. The reviewer had no
  working tree and got much of the tree wrong, **but this finding needed no tree — and it is
  correct.**
- Measurement, 2026-09-18: zero hits for `airia` anywhere in `.planning/` or `docs/`.
- The v3.6 ROADMAP entry carries the original claim verbatim: the crawl "found none of them
  covering" graded governance. That sentence is what this seed dates.
- Same read named three other market signals worth confirming rather than believing: a GDPR
  pre-model masking layer (maps to SEED-079), a provenance-preserving contract/invoice analysis
  product, and local-inference hardware appetite (maps to SEED-003 / SEED-172).
