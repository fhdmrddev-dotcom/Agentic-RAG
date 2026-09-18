---
seed_id: SEED-294
title: "Go-to-market — sell the ecosystem, not the app. Operator direction 2026-09-18: packs and plugins sold commercially, a marketing strategy, and a sponsor. Two OPERATOR blockers gate all of it, and neither is engineering."
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note: "Planted 2026-09-18 on direct operator direction, immediately after the v4.2 close and during the v4.2 production push. This seed is the COMMERCIAL umbrella; the engineering it depends on is owned by other seeds and is named rather than duplicated here."
trigger_when: >
  Fire at the /gsd:new-milestone that first scopes commercialisation, pricing, packaging, an
  ecosystem, a partner surface or a customer-facing offering — and fire it BEFORE the scope is
  written, because this seed's dependency chain decides what that milestone is even allowed to
  promise.

  Fire ALSO the moment either operator blocker below clears (a legal entity exists, or the
  employment / IP position is settled in writing). Each unlocks a route that is unreachable today,
  and the seed should be re-read rather than remembered.

  Fire ALSO before any pricing metric is chosen. Choosing one is a one-way door and this project
  has already recorded that metrics get picked by accident when nobody names the moment.
trigger_paths:
  - ".planning/PROJECT.md"
  - ".planning/ROADMAP.md"
  - "README.md"
  - "frontend/index.html"
trigger_surfaces: [admin, settings, deployment]
migration_note:
relates_to:
  - SEED-291 — the extension contract. ⭐ THE PREREQUISITE DECISION. It defines what a pack is allowed to be, and therefore what can be sold without dissolving the product claim.
  - SEED-198 — Experts / domain bundles. THE SKU. A vertical pack is the unit of sale, and it is mostly data.
  - SEED-073 / SEED-074 — token-to-USD cost registry and harness token rollup. ⛔ Nothing is priceable until cost is attributable.
  - SEED-080 / SEED-083 — entitlement gating and capability-tier packaging. ⛔ What makes a pack a PACK rather than a folder of files.
  - SEED-120 — per-org BYO provider keys. Enterprise buyers ask for this by name, and it moves model cost to the customer.
  - SEED-292 — assurance export. The strongest procurement asset, and nobody visible is selling it.
  - SEED-293 — the stale competitive record. ⛔ Do not build a pitch on "nobody else does this" until this is re-crawled.
  - SEED-004 — org / dept / role multi-tenancy. The ORG door shipped in v3.4; the DEPARTMENT axis did not. A per-org offering needs the residue closed.
  - SEED-129 / SEED-091 — residual service-role reads that bypass org scoping. A cross-tenant read found during a customer security review is a rejected vendor, not a bug report.
  - SEED-003 / SEED-075 — install UX and backup/restore. The self-hosted and sovereign offering.
  - SEED-013 — Open Platform. The partner/API surface, and the one unbuilt slot left in `PRDs/SEQUENCE.md`.
  - SEED-225 — an external step cannot attach a file. ⛔ A workflow that produces a deliverable cannot DELIVER it; several sellable shapes have no ending until this closes.
  - SEED-241 / SEED-242 — the landing page and `app.<domain>`. The marketing surface that already exists. Domain: `superrag.cloud`.
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-294: Go-to-market — sell the ecosystem, not the app

## The operator's direction

> *"I want this application to be as an ecosystem that has plugins, other things around it that
> could be connected, that could be sold to clients on a commercial basis — which means we should
> find a strategy for marketing, and someone to sponsor our application."*
> — operator, 2026-09-18, immediately after the v4.2 close and during the v4.2 production push

Three asks, and they are not the same ask:

1. **An ecosystem** — plugins and connected things around the core.
2. **A commercial basis** — sold to clients, which means priced, entitled and delivered.
3. **Marketing and a sponsor** — demand, and someone funding or backing it.

## The finding

**The ecosystem is nearer than it looks, and the commercial basis is further.**

**Nearer than it looks.** The extension surface already exists and is already open at every edge
that matters — providers, source families, connections, MCP servers, skills, extractors. v3.9
added a Notion connection returning 41 tools for zero lines of tool code; v4.0 proved a new
source family costs `sources/base.py` zero lines; Phase 249 made a model registrable from the UI
with no deploy. **A partner can extend this product today without touching engine code** — see
SEED-291 for why that is a deliberate property and not an accident.

**Further than it looks.** Nothing can be *sold* yet, and the gap is not features:

| Missing | Owner | Why it blocks a sale |
|---|---|---|
| Cost attribution | SEED-073, SEED-074 | A price needs a unit, and no unit is measured |
| Entitlement gating | SEED-080, SEED-083 | Without it a "pack" is a folder anyone can copy |
| The pack format | SEED-198 | There is no installable unit to sell |
| Deliverable attachments | SEED-225 | A workflow that makes a document cannot send it |
| Org-scope residue | SEED-129, SEED-091, SEED-004 | A cross-tenant read ends a deal, not a sprint |
| Evidence a buyer can file | SEED-292 | Every serious buyer asks "how do you know it works?" |

⛔ **Retrofitting cost attribution across a shipped plugin surface is materially harder than
building it in.** Metering is the cheapest thing on this list today and the most expensive thing
on it later. If exactly one engineering item precedes the rest, it is SEED-073 + SEED-074.

## ⛔ Two operator blockers, and neither is engineering

**These are not Claude Code's to action, and no amount of building substitutes for them.** They
are recorded here because they gate the value of everything above, and because they get harder to
unwind the longer the work compounds.

1. ⛔ **No legal entity exists.** Every accelerator, grant, sponsorship and enterprise contract
   requires a registered company. Nothing in the funding routes below is reachable without one.
   A client cannot buy from a person with no entity to invoice them.

2. ⛔ **The employment and IP position is unsettled.** The operator works in Digital Transformation
   at a firm delivering projects to a similar buyer set, in a similar category, in the same
   market. **Ownership of this code under the employment contract, permission to commercialise
   it, and the handling of customer overlap all need written certainty BEFORE any client,
   investor or accelerator is approached.** This needs a lawyer, not a plan. It is the single item
   most likely to end the effort after significant investment.

⚠ **Neither blocker stops the engineering.** Metering, entitlement, the pack format and the
assurance export are all worth building regardless of who ends up owning them — they make the
product better on its own terms. What the blockers stop is *approaching anyone*.

## Marketing — what exists and what is missing

**Exists:** a landing page (SEED-241, source at `.planning/design/landing-canvas/`), B2B framing,
a book-a-demo call to action, the domain `superrag.cloud`, and `app.<domain>` staged for a
production push (SEED-242). ⚠ `VITE_DEMO_URL` is deferred until a real booking link exists, and
it falls back **silently** — a wrong value never errors.

**Missing, and each is a decision rather than a build:**

- **Who the first customer is, by name or by shape.** Every item above is sequenced differently
  for a self-hosted enterprise than for a hosted SaaS tenant.
- **Which claim leads.** "Governed extensibility" (SEED-291) and "proof it works" (SEED-292) are
  the two unoccupied positions. ⛔ Neither may be claimed as unique until SEED-293 is re-crawled.
- **The pricing metric.** Projects, connections, runs, seats or evaluations — a one-way door.
- **Whether packs version independently of the core.** A pack that must match a core version is
  not really a plugin, and this decision is expensive to reverse.

## Sponsorship and funding — routes to check, not routes to take

**[UNVERIFIED — all of this is web-sourced as of 2026-09-18 and must be confirmed against primary
sources before anything is committed. It is recorded so the options are not rediscovered, not
because any of it is decided.]** Every route below sits behind both operator blockers.

- **Accelerators and innovation programmes** that pair startups with named institutional pilots.
  A pilot with a named customer is worth more than a grant, because it produces a reference.
- **Zero-equity startup programmes** offering compute credits — directly useful to the
  local-model and sovereign direction (SEED-003, SEED-172).
- **Capex / payroll rebate schemes** — growth stage, later, entity required.
- ⚠ Several regional cash-grant programmes prioritise national founders; non-national founders
  typically route through incubators and incentive programmes instead.
- ⛔ **A trade-show booth is not a strategy.** Walking a show and talking to the two or three
  companies making adjacent claims is worth more than a rushed presence, and costs nothing.

## When to surface

1. **The `/gsd:new-milestone` that first scopes commercialisation, pricing, packaging, an
   ecosystem or a partner surface** — read this seed BEFORE writing that scope.
2. **The moment either operator blocker clears.** Each unlocks routes that are unreachable today.
3. **Before any pricing metric is chosen.** Naming the moment is the whole point.

## Scope estimate

**Large, and deliberately not a single milestone.** The honest decomposition is roughly:

- **Priceable** — metering, entitlement, the pack format, deliverable attachments. One milestone.
- **Provable** — org-scope residue closed as one root cause with a mechanical fence, plus the
  assurance export. One milestone.
- **Sellable** — one real vertical pack, one reference customer, a re-crawled competitive record.
  Not a milestone; a business activity that the two above make possible.

⚠ **This ordering is a proposal, and it conflicts with `PRDs/SEQUENCE.md`, whose next unbuilt slot
is Open Platform (SEED-013).** That conflict is a real decision for the operator at the next
`/gsd:new-milestone` — it is named here rather than silently resolved.

## Breadcrumbs

- Operator direction, 2026-09-18, quoted above.
- Outside architecture read, 2026-09-18, archived under `.planning/external-reviews/` — the source
  of the licensing sketch, the funding routes and the two operator blockers. ⚠ **It read the tree
  one full milestone stale** (v4.1, "phases resume at 247"; the truth was v4.2 closed the same day
  and phases resume at 255) and four of its nine challenges were already closed. Its commercial
  framing survived reconciliation; its engineering assessment largely did not. See the
  reconciliation note filed beside it.
- v3.4 shipped org tenancy (the one-way RLS door); SEED-004's live residue is the DEPARTMENT axis,
  not org isolation. A reviewer without the tree read "multi-tenancy dormant" and was wrong.
- v4.2 closed 2026-09-18, tag `v4.2`, phases resume at **255**.
