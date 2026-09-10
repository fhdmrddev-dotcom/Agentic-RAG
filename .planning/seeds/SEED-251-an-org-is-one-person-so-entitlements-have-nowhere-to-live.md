---
seed_id: SEED-251
title: "An \"org\" is effectively one person and there are only TWO access levels — mine and whole-org — so per-seat/per-org pricing and department-scoped RBAC both have nowhere honest to live"
created: 2026-09-06
planted_during: "2026-09-06 packaging analysis — the prerequisite that kept surfacing under both the licensing and the RBAC questions"
status: planted
surface: Agentic-RAG
severity: high
category: tenancy / rbac / pricing-prerequisite
priority: high
relates_to:
  - project_org_model_flat_with_inert_departments (memory) — 46 tables carry `org_id`, ONE carries `dept_id` with zero rows, no dept routes
  - SEED-249 — entitlements attach to an org; this blocks per-org and per-seat pricing
  - docs/PRODUCT-PACKAGING.md §Part 2 #8 — RBAC scored ⚠ for exactly this reason
  - Phase 231 — connection-scoped visibility, which is a THIRD scoping axis that is real
trigger_when: >
  Per-seat or per-org pricing; any enterprise RFP asking for department-scoped access;
  any phase proposing to make `dept_id` meaningful. Also fires if a customer asks
  "can team A see team B's documents?" — today the honest answer is no middle ground.
---

## The measurement

- **46 tables carry `org_id`.** Tenancy at the org grain is real and enforced by RLS.
- **One table carries `dept_id`, and it holds zero rows.** There are no department routes.
- **Nested orgs were never built** — there is no `parent_id`.
- Effective access levels: **mine** or **the whole org**. Nothing between.

In practice today an "org" is one person, so none of this has hurt yet.

## The two things it blocks

**1. Pricing.** Per-seat and per-org licensing both need an org that means something. An
entitlement row keyed to an org that is really one user cannot express "250 seats across 8
departments" — and the first enterprise contract is priced exactly that way.

**2. RBAC as an enterprise DMS claim.** "Role-Based Access Control" on a capability list implies a
buyer can say *finance sees finance, HR sees HR*. With two levels the honest answer is: a document
is either private to one person or visible to everybody in the company. That is not a middle
ground an enterprise will accept for a document repository.

## Why this is the unglamorous prerequisite

It is invisible while there is one user, and it is load-bearing under **both** commercial questions
the operator asked. It is also the kind of change that is far cheaper now than after real customer
data exists in the shape it assumes — every RLS policy, every `org_id` filter and every visibility
predicate is touched by introducing a genuine middle scope.

⚠ **`dept_id` already exists on one table and is inert.** That is a decision waiting to be made
rather than a clean slate: either make it real, or remove it so nobody infers a capability that is
not there. Leaving a column that implies department scoping while nothing enforces it is the
`connector_watches`-shaped failure — a surface that reads as supported and is not.

⚠ **A third scoping axis already ships and works:** connection-scoped visibility (Phase 231), where
a document's reach is bounded by the connection that brought it in. Any department model must be
reconciled with it rather than invented beside it, or the product will have two disagreeing answers
to "who can see this?".
