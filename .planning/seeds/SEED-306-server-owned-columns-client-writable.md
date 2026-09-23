---
seed_id: SEED-306
title: Server-owned columns and tables are writable by the authenticated role (run metering columns; tier_capabilities TRUNCATE)
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator rules on the BUS item cited in 265-TRIAGE.md, OR the next migration touches grants on workflow_runs or tier_capabilities, OR the next deploy parity checklist runs (get_advisors security).
trigger_paths: ["supabase/migrations/**", "backend/app/db/workflows.py", "backend/app/services/entitlement_service.py"]
trigger_surfaces: [admin, harness, deployment]
migration_note:
relates_to: ["256", "258", "265", R265-256-01, R265-audit-fixes-11, R265-audit-fixes-01]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-306: Server-owned columns and tables are client-writable

## The finding

- **R265-256-01 (major, CONFIRMED on local grants).** Migration 182 added `workflow_runs.input_tokens`, `output_tokens` and `token_coverage`. The `authenticated` role can UPDATE all three, and the `workflow_runs_update_own` policy admits the row owner. So a user can zero their own run's spend through PostgREST.
- **R265-audit-fixes-11 (info).** Migration 192 revoked only `anon` on `tier_capabilities`. `authenticated` still holds INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES. RLS blocks the DML, but it does not govern TRUNCATE.

This is the same class as R265-audit-fixes-01, which migration 194 fixed as a Phase 265 hotfix (OV-265-01).

## Why it matters

Metering underpins the commercial story of v4.3, and spend that a user can edit is not a measurement. A TRUNCATE on the tier table would remove every plan's capabilities.

## When to surface

See `trigger_when`. Phase 265 did not read production grants, so read them (read-only) before anything else.

## Scope estimate

Small in code: one revoke migration, following the 194 pattern. It is still a schema change, so D-04 rules it out as a Phase 265 fix.

## Breadcrumbs

265-REVIEW-256.md · 265-REVIEW-audit-fixes.md · 265-HOTFIX-194.md (the precedent).
