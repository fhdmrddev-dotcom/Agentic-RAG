---
seed_id: SEED-390
title: Unit runs leave rows in the shared local DB, and 289's G-4 fixtures vanished
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next backend gate run that creates orgs/users, or the next G-4 drive that relies on a prior phase's fixture rows.
trigger_paths: ["backend/tests/conftest.py", "backend/tests/unit"]
trigger_surfaces: ["testing"]
migration_note:
relates_to: ["296 G-4 fixture note", "mig 216 neutral org name"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-390: Unit runs leave rows in the shared local DB, and 289's G-4 fixtures vanished

## The finding

Measured 2026-10-27: a dozen `organizations` rows named `My organization` with 0 members, all created 2026-10-26 19:59 (the 296 test runs; mig 216 names a signup's org neutrally, so these are signup-trigger orgs whose users were removed). Separately, 289's fixtures (runs a052667d / b464d95d, `s289-ev-*` definitions, both 289 colleague accounts) were gone by 2026-10-27; G-4 rows 2 and 4 had to be rebuilt.

## Why it matters

Tests that write the operator's local DB without full cleanup make G-4 fixtures unreliable and grow orphan rows.

## What to do

Find which suites create auth users/orgs against :54322 and make their teardown delete the signup org too; give G-4 fixtures a plant script under scripts/ so they can be re-created on demand (296's `s2_plant`/`s4_plant` are the shape).
