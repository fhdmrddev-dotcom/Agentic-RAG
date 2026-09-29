---
seed_id: SEED-326
title: Seed-like migrations that the OPERATOR.md Step-3 greenfield runbook does not list — the drift warning that named them was silenced by Phase 269
created: 2026-09-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "the next greenfield/one-box bootstrap, or any phase that adds a seed-bearing migration"
trigger_paths: ["docs/OPERATOR.md", "scripts/check-deploy-drift.sh", "supabase/migrations/**"]
trigger_surfaces: ["deployment"]
migration_note:
relates_to: ["docs/OPERATOR.md", "scripts/check-deploy-drift.sh", "269", "269-RESEARCH.md M-8 / M-9 / Pitfall 5", "SEED-325"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-326: Seed-like migrations the greenfield runbook does not list

## The finding

`supabase/full-schema.sql` is a schema-only dump and carries no seed rows (269-RESEARCH M-8), so a
greenfield box gets exactly the seed rows `docs/OPERATOR.md` Step-3 tells the operator to paste.
`scripts/check-deploy-drift.sh` (`check_seed_list`, lines 148-189) greps the WHOLE of OPERATOR.md for
`NNN_name.sql`, takes the highest number listed as a CEILING, and soft-WARNs only for seed-like
migrations numbered ABOVE it.

**The WARN line, captured VERBATIM before Phase 269 edited OPERATOR.md (2026-09-29, ceiling 089):**

```
  - migration(s) above #089 carry seed-like INSERT/UPDATE — review whether the OPERATOR.md Step-3 list needs them: 093_skill_creator_sandbox_library_awareness.sql 094_starter_workflows.sql 098_feature_visibility.sql 104_org_dept_role_schema.sql 105_personal_org_backfill.sql 106_org_id_autofill_trigger.sql 107_ten04_chunk_embedding_org_id.sql 111_is_global_retirement_rename.sql 113_sso_configs_firming.sql 118_connector_secret_column_privilege.sql 122_workflow_runs_definition_snapshot.sql 123_repair_definition_snapshot_string_scalars.sql 127_connector_connection_service_identity.sql 128_connector_connection_posture.sql 150_connector_oauth_client_secret.sql 178_app_settings_vision_calls_bound.sql 183_model_rates.sql 184_model_rates_complete_roster.sql 185_model_rates_db_roster.sql 186_tier_capabilities.sql 187_expert_bundles.sql 188_expert_chat_scoping.sql 189_expert_presentation_and_grants.sql 193_expert_seed_org_portable.sql 195_expert_installs_and_seed_retirement.sql 198_starter_expert_library.sql
```

(26 names. This is the line as printed under the script's `WARN summary` footer, which carries no
ANSI colour bytes; the in-section copy of the same line differs only by those colour codes, and
control bytes are deliberately kept out of planning prose.)

**Listing `198` raised the drift ceiling from 089 to 198 (M-9), so that WARN is now QUIET for every
name above.** After the edit the script reads `all 13 runbook seed migrations exist (highest listed:
198)` and prints no seed-list WARN at all. The guard did not stop being needed; it stopped being able
to see these names. This seed is where they live now.

**What Phase 269 DID list, and why (4 of the 26):**

| Migration | Why it belongs in a greenfield runbook |
|---|---|
| 186 | `tier_capabilities` rows — without them `experts` is enabled for no tier, so the catalog is unreachable |
| 187 | the Financial Analyzer system Expert row |
| 189 | presentation columns' values + `experts:manage` role permissions; UPDATEs 187's row |
| 198 | the starter Expert library (3 new rows) + the Financial Analyzer copy fix; UPDATEs 187's row |

**What 269 deliberately did NOT list:** 188 (the retired hardcoded-org knowledge seed — it inserts
rows bound to one org and must never run on a fresh box), 193 (re-points 188's rows) and 195 (schema
plus a DELETE of 188's rows). None belongs in Step-3, and OPERATOR.md does not spell their filenames,
because a prose mention would count as "listed" for the drift script.

**The remaining 19 names are UNDECIDED, not cleared.** Some are plainly backfills over existing data
(105, 106, 107, 111, 123) that do nothing on an empty DB; some very likely carry rows a fresh box needs
(098 feature visibility, 104 org/dept/role schema with role rows, 183-185 model rates, 094 starter
workflows, 093 skill-creator update, 178 app_settings). Deciding each one is OUT of Phase 269's scope
(269-RESEARCH Pitfall 5): that phase fixed the Expert catalog path only.

## Why it matters

A greenfield operator who follows the runbook exactly can get a box that silently runs on defaults for
anything in the undecided list — the lessons-log A6 failure mode the Step-3 table exists to prevent.
Nobody pays today (the only boxes are local dev and the existing prod, both bootstrapped by migration
history, not by the runbook); the first one-box customer install pays.

## When to surface

- The next greenfield / one-box bootstrap (before it happens, not after).
- Any phase that adds a seed-bearing migration — it must decide whether that migration joins Step-3,
  and while it is there, decide some of the 19 above.
- Any change to `scripts/check-deploy-drift.sh` `check_seed_list` — a ceiling that silences names by
  construction is the mechanism under this seed; a per-migration disposition list would fix it.

## Scope estimate

Medium: read 19 migrations, classify each as needed-on-fresh-box / backfill-only / superseded, extend
Step-3 for the needed ones (idempotency checked), and ideally replace the ceiling with an explicit
"reviewed, not a seed" list in the drift script so no future listing silences anything.

## Breadcrumbs

- Pre-edit drift run: 2026-09-29, Phase 269 plan 05, `RESULT: PASS`, `WARN summary (2)`.
- Post-edit drift run: `all 13 runbook seed migrations exist (highest listed: 198)`, `WARN summary (1)`
  (only the docker-compose structural-fallback WARN remains).
- `docs/OPERATOR.md` Step-3 (the "Migrations currently run to" note records the filename trap).
- 269-RESEARCH.md M-8, M-9, Pitfall 5.
