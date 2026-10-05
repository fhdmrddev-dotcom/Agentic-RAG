---
seed_id: SEED-345
title: Per-org data retention and rate-limit settings do not exist — ENT-02 (v3.4 STRETCH Phase 170) was deferred; its ENT-01 half later shipped as the v4.3 tier gate
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "A customer or a contract asks for an enforced retention period or per-org usage limits; OR a data-protection review (SEED-072) is scheduled; OR any phase adds a per-org setting to the org-admin shell or the entitlement service."
trigger_paths: ["backend/app/api/org.py", "backend/app/services/entitlement_service.py", "backend/app/db/entitlements.py", "frontend/src/lib/api/org.ts"]
trigger_surfaces: ["admin", "settings"]
migration_note:
relates_to: [".planning/v3.4-STRETCH-CARRYFORWARD.md § 170 (ENT-01, ENT-02)", "SEED-072 (data-subject rights)", "SEED-081 (provider rate-limit resilience)", "SEED-249", "docs/history/v3.4-multi-tenancy-and-org-access.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-345: per-org retention and rate-limit settings

## The finding

v3.4 STRETCH Phase 170 had two halves:
- **ENT-01**, an entitlement check that reads the org's tier. Shipped later as the v4.3 tier gate
  (`backend/app/services/entitlement_service.py`, Phase 258).
- **ENT-02**, a per-org retention and rate-limit data layer with org-admin settings (the dials first, the
  sweeper/token-bucket enforcement after). **Not built.** Measured 2026-10-04: no `retention_days`,
  `retention_policy` or per-org rate-limit field anywhere in `backend/app`; `api/org.py` has no retention
  reference.

ENT-02 lives only in `.planning/v3.4-STRETCH-CARRYFORWARD.md`, which no sweep reads.

## Why it matters

Enterprise and regulated buyers routinely ask "how long do you keep our chats and documents?" and "can we
cap usage per team?". Today the honest answer is "forever, unless someone deletes it" and "no". The
carry-forward warned that settings without enforcement read as fake, so the two must ship together.

## When to surface

The first customer or contract that requires a retention period or usage cap, or a data-protection review.

## Scope estimate

Medium to Large: schema + org-admin surface + a retention sweeper (soft-delete then purge of messages,
documents, chunks, storage objects) + a per-org token bucket. Pair with SEED-072.

## Breadcrumbs

- `.planning/v3.4-STRETCH-CARRYFORWARD.md` lines 42-48
