# Migration Number Reservations

**Purpose:** Prevent number-collision when 6 PRD-authoring agents (Plans 03-08) run in parallel. Each PRD claims a contiguous range up-front. Authors MUST consult this file before assigning any migration number in their PRD's §5 (Architecture & Data Model changes).

**Current head (committed to repo):** `038_runs_timed_out_status.sql` — see `STACK.md:13` and `supabase/migrations/`. Next available number is `039`.

## How to use this file (PRD authors)

1. Read the table below.
2. Use migration numbers from your milestone's reserved range.
3. If you need MORE migrations than the range gives you, EXTEND your range by editing this file's table — increment your high-water number AND adjust every later milestone's range accordingly. Document the change in your PRD's §5 with a one-line note.
4. If your milestone needs FEWER migrations, leave unused numbers unclaimed — later milestones do NOT compress the range. The unclaimed slots become a buffer that absorbs future estimation errors. (Migration numbers are cheap; gaps don't break anything.)
5. NEVER reuse a number claimed by another milestone.

## Reservation table

| Milestone | Range | Width | Rationale |
|---|---|---|---|
| **v2.6** — Foundation: RAG Quality + Multi-Worker + Polish | `039 – 049` | 11 | Likely 6-8 actual migrations: pdf_extraction_runs telemetry, documents.extractor column, document_images.bbox, asyncpg connection-pool config table (if needed), polish-bug schema fixes, Streams Provider cleanup. 11-slot range gives 2-3 slot buffer. |
| **v3.0** — Skill Studio (full PRD) | `050 – 064` | 15 | Heavy: eval_cases, eval_runs, eval_run_outputs (with-skill / without-skill rows), eval_feedback, skill_versions, possibly skill_marketplace_metadata. SKILL-01/02 dispatch tracking columns. RLS policies per table. 15-slot range. |
| **v3.1** — Operator UX + Deployment Flexibility | `065 – 074` | 10 | operator_users (RBAC role above users), audit_log_extensions for ops actions, deployment_presets, secrets_store_metadata, model_capabilities_overrides (admin-editable surface). |
| **v3.2** — Multi-Tenancy (Hybrid SaaS Foundation) | `075 – 094` | 20 | Largest range. Per SEED-004 + RECOVERED_PRD_Enterprise_RAG F-04 successor: orgs, departments, org_members, dept_members, roles, role_permissions. RLS rewrite TOUCHES EVERY EXISTING TABLE — each table needs a migration to switch RLS predicates from `user_id = auth.uid()` to membership-based (documents, folders, threads, messages, runs, skills, skill_files, document_chunks, eval_cases, eval_runs, etc.). SSO + audit. |
| **v3.3** — Open Platform: API + MCP + Service Accounts | `095 – 109` | 15 | service_accounts, api_keys, api_key_scopes, webhooks, webhook_deliveries, rate_limits (Redis-only or hybrid Redis+Postgres), mcp_server_metadata, sdk_audit. Org-aware variants of each. |
| **v3.4** — Automations + DM Tier B | `110 – 124` | 15 | schedules, scheduled_runs (history), event_subscriptions (event-bus consumers), routine_definitions, dm_retention_policies, dm_check_in_out_state, dm_approvals, dm_approval_steps, dm_lifecycle_audit. Per-org variants where multi-tenancy applies. |

**Total reserved through v3.4:** `039 – 124` (86 slots across 6 milestones, expecting ~50-60 actual migrations).

## Conflict resolution

If two PRDs need the SAME conceptual table (e.g., both v3.2 multi-tenancy and v3.3 service-accounts touch `audit_log`):
- The earlier-shipping milestone owns the original migration.
- The later milestone's migration is a `*_extend` or `*_alter` migration in its own range.
- Document the cross-reference in BOTH PRDs' §5.

## Buffer for unanticipated migrations

`125+` is unreserved. If a milestone needs more than its range AND the gap to the next milestone's range can't absorb it, add a `*_overflow` reservation row above and shift later ranges. Coordination via this file, not via implicit ordering.

## Updates

This file is owned by the meta-phase. After all 6 PRDs ship, this file's purpose ends; subsequent milestones manage migrations directly through `supabase/migrations/`.
