---
seed_id: SEED-364
title: Auto-created organisation names embed the founder's email ("x@y.com's Organization"), so every surface that names the org shows that email to every member
created: 2026-10-19
surface: Agentic-RAG
status: answered
partial: false
status_note: "ANSWERED by Phase 296 (296-01, D-06): migration 216 (216_neutral_default_org_name.sql) names a NEW personal org 'My organization' (a constant, so no email can reach it); existing org names are untouched (the owner can rename). RED test_296_migration_shape.py 67040639c, GREEN 08c9a600e, full-schema regen 006f0365c; applied to LOCAL Supabase (check-migration-216-live.py prints '216 live'). The CLOUD apply of 216 is owed in 296's DEPLOY row (migrations 214 -> 215 -> 216, each shown first)."
trigger_when: "The next phase touching org creation or naming, an org-shared read that ships org_name, or any privacy review of what a member can see about another member."
trigger_paths: ["backend/app/api/org.py", "backend/app/api/workflow_run_evidence.py", "supabase/migrations/**"]
trigger_surfaces: ["auth", "admin"]
migration_note:
relates_to: [".planning/phases/289-the-run-page-and-its-evidence/289-VALIDATION.md (S4)"]
folded_into: "296"
renumbered_from: null
renumbered_because: null
---

# SEED-364: an org's default name is its founder's email

## Observed (289-05 S4, 2026-10-19)

The evidence read hides the run owner's email from a same-org colleague (`started_by.email: null`),
and the raw response still contained `fhdmrd@gmail.com` once: in `run.org_name`, which reads
`"fhdmrd@gmail.com's Organization"`. That is the org's display name, generated from the founder's
email at signup (the two local test users got `"<email>'s Organization"` the same way). The colleague
already receives the same string from `GET /org/me` (`memberships[].name`) and sees it in the org
switcher, so the evidence page discloses nothing new, but the default name itself puts the founder's
email in front of every member on every surface that names the org.

## What would close it

Name a new org without the email (for example the display name, or "My organization"), and offer a
one-time rename for existing orgs whose name still equals the generated default. Not a phase 289 defect.
