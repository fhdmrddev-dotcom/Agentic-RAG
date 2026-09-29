---
seed_id: SEED-325
title: A newly signed-up org has a NULL tier, so it sees the tier refusal instead of the Expert library
created: 2026-09-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "a plan/billing or self-serve signup flow gets a phase number (SEED-013 / Open Platform), OR the operator decides a default tier, OR a customer reports an empty/refused Experts page after signup"
trigger_paths: ["backend/app/db/entitlements.py", "backend/app/services/entitlement_service.py", "supabase/migrations/186_tier_capabilities.sql"]
trigger_surfaces: ["auth", "admin"]
migration_note:
relates_to: ["269", "266-PROD-PARITY.md §F", "D-269-P1", "D-258-06", "TIER-02", "SEED-013", "SEED-326"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-325: A newly signed-up org has a NULL tier, so it sees the tier refusal instead of the Expert library

## The finding

`handle_new_user` creates a personal org for every signup with `organizations.subscription_tier = NULL`.
The whole `/experts` router is capability-gated (`require_capability("experts")`), and `tier_capabilities`
(migration 186) enables `experts` for the `enterprise` tier only, so a fresh signup gets:

```
HTTP 403 — "Capability 'experts' requires 'enterprise' tier (current tier: 'unassigned')" …
"upgrade_hint":"Upgrade to Enterprise to use experts."
```

— measured live in Phase 269 (`269-UAT-LOG.md` § SC#1, `evidence/00-users-and-orgs.txt`,
`evidence/01-catalog-first-run.txt` part A). It is fail-CLOSED by design (D-258-06): a refusal sentence,
never a blank page.

**Local measurement, re-derived 2026-09-29 at 269-05 by a read-only count:** `13` of `52` local orgs have
`subscription_tier IS NULL` (38 `enterprise`, 1 `standard`). Production is not measured here (the Supabase
MCP was not used); `266-PROD-PARITY.md` A.3 / `269-PROD-PARITY.md` A.3 carry the read.

**The options, from `266-PROD-PARITY.md` §F:**

- (a) a default tier at org creation (a `handle_new_user` change or a column DEFAULT) — schema, its own phase;
- (b) operator-assigned per org via the Control Room — today's behaviour, manual;
- (c) a billing / plan flow that sets it — SEED-013 / Open Platform territory.

**Operator ruling D-269-P1 (2026-09-29): option (b) is kept.** Tiers stay operator-assigned; no
`handle_new_user`, tier or capability change. Phase 269's SC#1 is QUALIFIED to *"an org on the enterprise
tier sees the starter library"*; the drive used a named, recorded operator tier-assignment step.

## Why it matters

The ROADMAP 269 failure line reads *"the catalog in a new org is empty until someone runs a migration by
hand"*. After 269 the catalog is seeded (migration 198, OPERATOR.md Step-3), but a truly new org still
cannot see it until an operator runs a tier WRITE by hand. Nobody pays today (orgs are provisioned by the
operator); the first self-serve customer pays — they sign up and are refused the product's headline
feature.

⛔ **Why this is not simply fixed with a default:** choosing which tier a new org lands on is a pricing
decision, and TIER-02 recorded pricing as a one-way door — once customers hold a default entitlement,
narrowing it is a take-away. That decision belongs to the operator and a plan/billing phase, not to a
content phase.

## When to surface

- A plan/billing or self-serve signup flow gets a phase number (SEED-013 / Open Platform).
- The operator decides a default tier.
- A customer (or UAT) reports an empty or refused Experts page right after signup.
- Any phase touching `backend/app/db/entitlements.py`, `backend/app/services/entitlement_service.py`, or
  `tier_capabilities`.

## Scope estimate

Small in code (a DEFAULT or one line in `handle_new_user`, plus a backfill decision for the existing NULL
orgs), Large in consequence (pricing one-way door). The decision is the work.

## Breadcrumbs

- `269-UAT-LOG.md` § SC#1 — the refusal measured, then the named step "F-4 operator tier assignment
  (D-269-P1)" (`UPDATE organizations SET subscription_tier='enterprise'`, local, before `None`, after
  `'enterprise'`), then HTTP 200 with the catalog.
- `266-PROD-PARITY.md` §F (the original F-4 write-up); Phase 258 record ("2 of 2 prod orgs had a NULL
  tier", both set `enterprise` 2026-09-23).
- Migration 194 made `subscription_tier` non-client-writable (OV-265-01): only the service role or an
  operator path can set it.
