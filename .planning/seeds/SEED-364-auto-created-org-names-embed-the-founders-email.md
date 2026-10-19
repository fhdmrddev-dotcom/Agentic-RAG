---
seed_id: SEED-364
title: Auto-created organisation names embed the founder's email ("x@y.com's Organization"), so every surface that names the org shows that email to every member
created: 2026-10-19
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The next phase touching org creation or naming, an org-shared read that ships org_name, or any privacy review of what a member can see about another member."
trigger_paths: ["backend/app/api/org.py", "backend/app/api/workflow_run_evidence.py", "supabase/migrations/**"]
trigger_surfaces: ["auth", "admin"]
migration_note:
relates_to: [".planning/phases/289-the-run-page-and-its-evidence/289-VALIDATION.md (S4)"]
folded_into: null
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
