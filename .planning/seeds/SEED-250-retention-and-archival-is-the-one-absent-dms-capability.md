---
seed_id: SEED-250
title: "Retention and archival is the ONE absent capability on the enterprise DMS list — zero retention/archival/legal-hold code exists, and it is the capability regulated buyers ask about first"
created: 2026-09-06
planted_during: "2026-09-06 packaging analysis — assessing an 11-point enterprise DMS capability list against the code"
status: planted
surface: Agentic-RAG
severity: high
category: dms / compliance / lifecycle
priority: high
relates_to:
  - docs/PRODUCT-PACKAGING.md §Part 2 — the full capability matrix (4 shipped, 6 partial, 1 absent)
  - backend/app/services/scheduler_service.py — the sweep engine this would ride; already shipped
  - migration 170 — the `audit_log` action-type vocabulary a disposition record would extend
  - SEED-249 — retention is a strong first candidate for a licensed add-on module
trigger_when: >
  Any enterprise/regulated prospect, any compliance questionnaire, or any phase touching
  document deletion. Also fires the first time somebody asks "how long do we keep this?"
---

## The measurement

Zero hits for retention/archival policy code across `backend/app`. No retention policy table, no
legal hold, no scheduled disposition, no archive tier, no disposition audit record. Measured
2026-09-06 against an 11-point enterprise DMS capability list, where it was the **only** ⛔.

For contrast, the neighbouring capabilities are ✅ or ⚠ — classification, metadata with per-field
confidence, hybrid search, versioning, workflow automation and shared-folder migration all exist
in some form. **Retention is the single hole.**

## Why it matters more than its size suggests

It is the capability regulated buyers (finance, healthcare, government, legal) raise in the FIRST
meeting, and the one that most often appears as a hard requirement in an RFP rather than a nice-to-
have. Its absence is disqualifying in a way that a partial integration story is not.

## Why it is cheap here, relative to that value

Every substrate it needs already ships:

- **The sweep engine** — `scheduler_service` already claims due work with `FOR UPDATE SKIP LOCKED`
  and reclaims stale leases. A nightly disposition sweep is another claimant, not new machinery.
- **The audit vocabulary** — `audit_log` already carries a constrained action-type list (migration
  170 rebuilt it). Disposition events extend it.
- **Soft-delete precedent** — versioning already keeps `is_latest=false` rows rather than deleting.

The shape:

1. `retention_policies` — scope (folder / view / metadata match), duration, action (archive |
   delete | review), and an owner.
2. `documents.legal_hold boolean` — ⛔ **a hold must BLOCK deletion from every path**, including
   the ordinary delete endpoint and any future purge, or it is decorative.
3. A scheduled sweep that proposes, and (per policy) either acts or queues for human review.
4. A disposition record in `audit_log` for every action — *what was deleted, under which policy,
   when, and who could have stopped it*.

⚠ **Retention DELETES CUSTOMER DATA on a timer. It is the most dangerous feature in this list.**
It must ship with the same fail-closed discipline as the source-completeness fence (`SRC-06`): an
incomplete or ambiguous policy evaluation deletes NOTHING, and a dry-run mode that reports what
*would* be disposed must exist before the first real sweep runs.
