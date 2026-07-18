# Phase 162: Personal-Org Backfill - Research

**Researched:** 2026-07-18
**Domain:** One-time idempotent SQL data-migration (Postgres 17.6 / Supabase local) — personal-org provisioning + `org_id` backfill + NOT-NULL flip + forward `handle_new_user` trigger
**Confidence:** HIGH — every table/column/FK/row-count claim below is verified against the LIVE local catalog (`psql`/psycopg2 @ `127.0.0.1:54322`), cross-checked with `full-schema.sql` + mig 104. The batching/COMMIT and NOT-NULL-guard SQL patterns were executed live on PG 17.6.

## Summary

162 is a pure SQL data migration at **slot 105**. It (1) creates one personal org + default `'General'` department + `org-admin` membership for every existing `auth.users` row, (2) backfills `org_id` non-NULL across **35 user-facing tables** by resolving each row's owning user's personal org, (3) flips those columns `NOT NULL` behind a self-verifying zero-NULL guard, and (4) extends the `handle_new_user` DEFINER trigger so future signups auto-provision a personal org. No UI, no agent-loop/provider/retrieval change; RLS stays service-role-bypassed until 163 (Deep Mode byte-identical).

The live schema matches D-10's accounting almost exactly (41 tables carry `org_id`; the target set resolves to 35 after excluding org-infra, the 2 Phase-163-deferred vector tables, and the 4 system/identity tables). The single most important correction: **`operator_audit_log` carries an `org_id` column but has NO owning user** (its `operator_user_id` points at `operator_users`, not `auth.users`) — it is org-agnostic system data and must be **excluded from the backfill and kept nullable** (this is exactly the D-11 open item, now resolved by evidence). Two other schema facts the research-phase ARCHITECTURE.md assumed but that mig 104 did **not** ship: there is **no `organizations.is_personal` column** and **no `org_members.joined_via` column** — the idempotency gate must be designed around their absence.

**Primary recommendation:** Deliver 105 as one idempotent file with four ordered parts — (1) personal-org creation as a normal transactional `DO` loop gated on `NOT EXISTS org_members`, (2) a **reusable batched-backfill stored PROCEDURE with per-batch `COMMIT`** invoked once per target table, (3) per-table self-guarded `SET NOT NULL`, (4) the defensive `handle_new_user` extension. Apply via **psycopg2 `autocommit=True` @ :54322** (proven path) so the procedure's `COMMIT` is legal — see the "invalid transaction termination" pitfall, which is the real trap, not DO-vs-procedure.

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01…D-11 — research THESE, do not re-open)
- **D-01:** Each existing user gets exactly one personal org via `create_org_with_default_dept(p_name, p_subscription_tier, p_default_dept_name)` (mig 104, `service_role`-only SECDEF): name = `"{email}'s Organization"`, `subscription_tier = NULL`, default dept `'General'`, user seeded `org_members.role='org-admin'`. Idempotency gate = "this user has no personal org yet"; membership insert `ON CONFLICT (org_id, user_id) DO NOTHING`.
- **D-02 / D-03:** Ship the forward-looking personal-org auto-create in 162 by **extending the existing `handle_new_user` DEFINER trigger** (today inserts only a `profiles` row). Must be idempotent + defensive so a failure can NEVER abort the `auth.users` insert (a trigger error breaks signup). Invitations (167)/SSO JIT (168) later ADD "join org X" on top — they do not replace the universal personal org.
- **D-04:** 162 is **HANDS-OFF `is_global` / `is_system`** — never rename/drop/rewrite those columns (closes the is_global data-loss threat by construction).
- **D-05 (HANDOFF, binding on 163/165):** the value-preserving `is_global`→`is_org_shared` / `is_system_global` rename stays in **165**; 163 writes RLS against the CURRENT column names.
- **D-06:** Delivery = idempotent numbered SQL migration at slot **105**, applied via the Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated `full-schema.sql` **same-commit**.
- **D-07:** Batching = a **stored PROCEDURE** (NOT a `DO` block) looping `UPDATE <t> SET org_id=<resolved> WHERE org_id IS NULL … LIMIT ~10000` with a `COMMIT` between batches; `CALL`ed once then dropped.
- **D-08:** NOT-NULL flip = **self-verifying**: before each `ALTER … SET NOT NULL`, `IF EXISTS (SELECT 1 FROM <t> WHERE org_id IS NULL) THEN RAISE EXCEPTION …` + a remaining-NULL-count `SELECT` for operator visibility. DB enforces "verified zero-NULL"; whole file re-paste-safe.
- **D-09:** `org_id` = the owning user's personal org, resolved directly via `user_id` or transitively via parent FK for owner-less children. GLOBAL/shared/`is_system` rows get their creating user's personal org — cross-org reach stays an orthogonal flag, never a synthetic "system org." Invariant: **`org_id` = home org; sharing flag = who else sees it.**
- **D-10:** Backfill every user-facing table with an `org_id` column, EXCEPT `document_chunks` + `skill_embeddings` (→163) and system/identity tables (`operator_users`, `profiles`, `app_settings`, `model_capabilities_overrides`). RE-VERIFY the live set at plan time (done below).
- **D-11 (planner resolves):** `audit_log` / `operator_audit_log` and any genuinely org-agnostic system rows — decide per-table whether they flip NOT NULL or stay nullable. Default lean: keep genuinely org-agnostic rows nullable. (Resolved by evidence below: `audit_log` → flip; `operator_audit_log` → keep nullable + exclude from backfill.)

### Claude's / Executor's Discretion
- Exact batch size (~10k), procedure/index/constraint names, precise parent-FK resolution joins per child table, per-table NOT-NULL decision (within D-11), idempotency idioms — executor discretion as long as SC#1–4 + D-01…D-11 hold.

### Deferred Ideas (OUT OF SCOPE)
- `is_global`→`is_org_shared` rename + `is_system_global` allow-list → **165**.
- `document_chunks` / `skill_embeddings` `org_id` denormalize + composite index + backfill → **163** (TEN-04).
- Membership RLS rewrite of the 38 tables + per-request user-JWT client swap → **163** (atomic crux; RLS still bypassed after 162).
- Invitation / SSO "join an existing org" onboarding → **167 / 168** (layered on top of 162's universal personal org).
- Subscription-tier semantics → STRETCH **170 / ENT-01** (162 sets personal-org tier `NULL`).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MIG-01 | Personal-org backfill: every existing user → 1 personal org + default dept + org-admin membership; `org_id` backfilled across every table (batched ~10k, idempotent on `WHERE org_id IS NULL`, owner-less children via parent FK), flipped `NOT NULL` only after verified zero-NULL; all data preserved, no user action. | The 35-table target set + per-table resolver (§Backfill-Target Table Set + §Parent-FK Resolution Graph); the batched-COMMIT procedure proven on PG 17.6 (§Batched Backfill); the self-guarded flip proven live (§NOT-NULL Flip); the personal-org loop + idempotency gate (§Personal-Org Creation & Idempotency); the defensive trigger (§handle_new_user Extension). |

## Project Constraints (from CLAUDE.md)

- **Numbered migrations:** filename `105_<name>.sql` (digits-only prefix; a letter suffix like `105b` is silently skipped by the CLI). Apply by pasting into the **local** Supabase SQL editor — **NEVER** `supabase db push`/`db reset` (preserves dev data). Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit the migration **and** regenerated `supabase/full-schema.sql` **in the same commit**. Never hand-edit `full-schema.sql`.
- **Idempotent / re-paste-safe** required (mig 104 style): `CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`, `INSERT … ON CONFLICT DO NOTHING`, drop-guard-then-create for policies, `WHERE org_id IS NULL` for every backfill write.
- **Cloud parity (standing rule):** migrations 099–104 + `SECRETS_ENCRYPTION_KEY` are already owed at the next operator-gated production push; **105 joins that pending set** — this phase AUTHORS + applies LOCAL only. Do not touch cloud.
- **Deployment-artifact parity (D-16):** if 105 becomes seed-bearing, add to `docs/OPERATOR.md` Step-3 seed list + re-run `scripts/check-deploy-drift.sh`. (162 seeds no reference data — it writes user-owned rows — so it is **not** seed-bearing; note this and move on.)
- **No blocking I/O in async handlers** (D-v2.5-01) — N/A this phase (no app code touched except the SQL trigger body).
- Deep Mode byte-identical (D-14) — satisfied by construction: RLS stays service-role-bypassed; the only "code" touch is the SQL trigger, signup-path-adjacent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Personal-org + dept + membership creation | Database (SECDEF fn + migration) | — | `create_org_with_default_dept()` is a service_role/owner SECDEF; 162 runs as owner in the SQL editor. No app tier involved. |
| `org_id` backfill across 35 tables | Database (stored procedure) | — | Batched `UPDATE…FROM` joins; pure SQL. |
| NOT-NULL flip + zero-NULL guard | Database (DDL + guard) | — | The DB, not a human, is the "verified zero-NULL check" (D-08). |
| Future-signup auto-org | Database (`handle_new_user` AFTER INSERT trigger on `auth.users`) | — | Trigger fires for every signup path (email/pw now, SSO-callback later) atomically; the established pattern (D-03). NOT app-layer. |
| RLS enforcement of `org_id` | **Deferred to 163** | — | 162 populates the column; 163 makes it load-bearing. |

## Standard Stack

No new libraries. This phase uses only Postgres 17.6 / Supabase built-ins already present.

| Tool | Version | Purpose | Why standard |
|------|---------|---------|--------------|
| PostgreSQL | **17.6** (verified `SHOW server_version`) | Stored `PROCEDURE` with per-batch `COMMIT`; `UPDATE…FROM`; `ALTER … SET NOT NULL`; DEFINER trigger | Native; procedural `COMMIT` supported since PG11, fully available on 17.6. |
| `create_org_with_default_dept(text,text,text)` | mig 104 | Atomic org + default-dept construction | The exact helper D-01/D-03 mandate; already `service_role`/owner-locked (CR-01). |
| psycopg2 (backend venv) + local Supabase :54322 | live | Apply path with `autocommit=True` (guarantees the procedure `COMMIT` is legal) | Project-established evidence/apply tool (mig 104 was applied this way per MEMORY). |

**Installation:** none. Apply command (recommended, proven): run the 105 file through `backend/venv/Scripts/python.exe` with a psycopg2 connection at `127.0.0.1:54322` (`postgres`/`postgres`/`postgres`) and `conn.autocommit = True`. The Supabase SQL editor is the D-06 canonical path, but see the atomic-context pitfall for how the batched `CALL` must be run there.

**No Package Legitimacy Audit needed** — this phase installs zero external packages.

## Backfill-Target Table Set (D-10 — RE-VERIFIED against the live catalog)

Live query: `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='org_id'` → **41 tables** carry `org_id`. Decomposition:

| Bucket | Count | Tables | Disposition |
|--------|-------|--------|-------------|
| Org-infrastructure (mig 104, populated by 162 itself, not "backfilled") | 5 | `departments`, `dept_members`, `org_invitations`, `org_members`, `sso_configs` | **NOT a backfill target** (already `NOT NULL`; `departments`+`org_members` are *written* by the personal-org loop) |
| Phase-163-deferred vector tables | 0 with col | `document_chunks`, `skill_embeddings` (verified: **no `org_id` column** — "no-col") | **EXCLUDED → 163 / TEN-04** |
| System/identity | 4 | `operator_users`, `profiles`, `app_settings`, `model_capabilities_overrides` (verified: **no `org_id` column**) | **EXCLUDED** (never swept) |
| Org-agnostic system audit (HAS `org_id` but no owning user) | 1 | `operator_audit_log` | **EXCLUDED from backfill; stays NULLABLE** (D-11 — see below) |
| **BACKFILL TARGETS** | **35** | see below | backfill + NOT-NULL flip (metadata_field_definitions conditional) |

**The 35 backfill targets** (all have a resolvable owning user → personal org):

- **28 direct `user_id` (NOT NULL):** `audit_log`, `code_executions`, `document_images`, `document_tables`, `eval_ratings`, `eval_results`, `eval_runs`, `message_feedback`, `messages`, `pdf_extraction_runs`, `runs`, `sandbox_files`, `skill_files`, `skill_proposals`, `skill_publish_overrides`, `skill_test_cases`, `skill_versions`, `tuner_runs`, `user_memory`, `user_settings`, `classification_rules`, `document_relationships`, `document_views`, `documents`, `folders`, `harness_audit`, `skills`, `threads`.
- **2 direct `created_by` (NOT NULL):** `workflow_definitions`, `workspace_files`.
- **2 nullable-owner, resolvable:** `metadata_field_definitions` (`user_id` nullable; 0 NULL rows live), `workflow_runs` (`user_id` nullable — 0 NULL live — but `thread_id` is NOT NULL → resolve via thread).
- **3 owner-less children (resolve via parent FK):** `todos` (→`threads`), `workspace_file_versions` (→`workspace_files`), `workflow_phases` (→`workflow_runs`).

**Discrepancy flags vs CONTEXT.md D-10 (the planner MUST honor these):**
1. **`operator_audit_log`** is listed in D-10's "13 already-stubbed pre-104" set, which implies it's a backfill target. Evidence says it is **not** backfillable: it has **no `user_id`/`created_by`**, only `operator_user_id` (→ `operator_users`, which is deliberately outside the org model, mig 095). It is the D-11 case: **exclude from backfill, keep `org_id` nullable.** Its 163 RLS predicate handles `NULL` (it's operator-only / deny-all-to-users anyway). `[VERIFIED: live catalog — operator_audit_log cols = id, operator_user_id, action, label, is_write, target_type, target_id, metadata, org_id, created_at; operator_user_id FK = none-to-auth.users]`
2. **`is_personal` / `joined_via` do NOT exist.** ARCHITECTURE.md §6 assumed `organizations.is_personal=true`, `org_members.joined_via='personal_auto'`, and a `slug='personal-<id>'`. Mig 104 shipped **none** of these (`organizations` cols = id, name, slug, subscription_tier, add_ons, settings, created_at, updated_at; `org_members` cols = id, org_id, user_id, role, created_at, updated_at). The idempotency gate + any "which org is personal" logic must not assume them. `[VERIFIED: live catalog]`
3. The "23 swept by mig 104" is exact — all 23 `ALTER TABLE … ADD COLUMN org_id` from mig 104 §Section-4 are present and nullable. The "12 user-facing pre-104" (documents, folders, threads, skills, classification_rules, document_relationships, document_views, harness_audit, metadata_field_definitions, workflow_definitions, workflow_phases, workflow_runs) are present. 23 + 12 = 35 user-facing; + `operator_audit_log` = D-10's "36 with a stub minus exclusions." `[VERIFIED: live catalog]`

## Parent-FK Resolution Graph (D-09 — the highest-value output for the executor)

**Key finding that simplifies the plan:** despite the ARCHITECTURE framing that many child tables "inherit org via parent FK," **30 of the 35 targets carry their OWN `user_id`/`created_by`** and resolve directly. Only **4 tables are truly owner-less**, of which one (`operator_audit_log`) is excluded. So only **3 tables genuinely need a transitive/parent join.**

### Group A — direct owner resolution (30 tables)
Resolver shape (same for all; owner column = `user_id`, except `workflow_definitions`/`workspace_files` = `created_by`):

```sql
UPDATE public.<t> t
SET org_id = pm.org_id
FROM public.org_members pm
WHERE pm.user_id = t.<owner_col>      -- user_id | created_by
  AND t.org_id IS NULL
  AND t.id IN (SELECT id FROM public.<t> WHERE org_id IS NULL LIMIT <batch>);
```
At 162 time each user has exactly ONE `org_members` row (their personal org, just created), so `pm.org_id` is unambiguous. (If the optional `is_personal` marker is added — see Idempotency — join `organizations o ON o.id=pm.org_id AND o.is_personal` to be forward-safe.)

`workflow_runs` and `metadata_field_definitions` have a **nullable** owner but 0 NULL rows live. `metadata_field_definitions` uses `user_id` directly (the self-guard catches any cloud NULL-owner straggler). `workflow_runs` should resolve via its parent thread (below) for robustness because `thread_id` is NOT NULL.

### Group B — parent-FK resolution (the 3 owner-less children + workflow_runs), with ORDER

Resolve child `org_id` from the parent's ALREADY-BACKFILLED `org_id` (guarantees the RLS-join invariant `child.org_id = parent.org_id` that 163 relies on). This imposes a wave ordering:

| # | Table | No owner col? | Resolve via | Parent (must be backfilled first) | Concrete JOIN |
|---|-------|---------------|-------------|-----------------------------------|---------------|
| Wave 1 | all Group A (incl. `threads`, `workspace_files`) | — | own `user_id`/`created_by` → `org_members` | — | see Group A |
| Wave 2 | `workflow_runs` | no (user_id nullable) | `thread_id` → `threads.org_id` | `threads` | `UPDATE workflow_runs wr SET org_id=p.org_id FROM threads p WHERE p.id=wr.thread_id AND wr.org_id IS NULL AND p.org_id IS NOT NULL AND wr.id IN (…LIMIT batch)` |
| Wave 2 | `todos` | **yes** | `thread_id` → `threads.org_id` | `threads` | `UPDATE todos t SET org_id=p.org_id FROM threads p WHERE p.id=t.thread_id AND t.org_id IS NULL AND p.org_id IS NOT NULL AND t.id IN (…LIMIT batch)` |
| Wave 2 | `workspace_file_versions` | **yes** | `workspace_file_id` → `workspace_files.org_id` | `workspace_files` | `UPDATE workspace_file_versions v SET org_id=p.org_id FROM workspace_files p WHERE p.id=v.workspace_file_id AND v.org_id IS NULL AND p.org_id IS NOT NULL AND v.id IN (…LIMIT batch)` |
| Wave 3 | `workflow_phases` | **yes** | `workflow_run_id` → `workflow_runs.org_id` | `workflow_runs` (Wave 2) | `UPDATE workflow_phases wp SET org_id=p.org_id FROM workflow_runs p WHERE p.id=wp.workflow_run_id AND wp.org_id IS NULL AND p.org_id IS NOT NULL AND wp.id IN (…LIMIT batch)` |

**Verified FK edges** (subset of the live FK catalog): `todos.thread_id→threads.id`, `workspace_file_versions.workspace_file_id→workspace_files.id`, `workflow_phases.workflow_run_id→workflow_runs.id`, `workflow_runs.thread_id→threads.id`, `messages.thread_id→threads.id`, `code_executions.thread_id→threads.id`, `sandbox_files.execution_id→code_executions.id`, `document_images.document_id→documents.id`, `document_tables.document_id→documents.id`, `pdf_extraction_runs.document_id→documents.id`, `message_feedback.message_id→messages.id`, `skill_files.skill_id→skills.id`, `skill_versions.skill_id→skills.id`. `[VERIFIED: live information_schema key_column_usage + constraint_column_usage]`

**Note (executor discretion, D-09):** Group A children that ALSO have a parent FK (e.g. `messages`, `code_executions`, `document_images`) can be resolved *either* by their own `user_id` (Wave-1, simplest — recommended) *or* by parent inherit. For personal orgs the two are identical (child owner == parent owner == same user == same personal org). Use own-`user_id` for the 30; reserve parent-inherit for the 3 owner-less + `workflow_runs`.

## `create_org_with_default_dept()` — signature + behavior (D-01/D-03)

`[VERIFIED: mig 104 lines 206–236 + live routine_privileges]`

```sql
create_org_with_default_dept(
    p_name text,
    p_subscription_tier text DEFAULT NULL,
    p_default_dept_name text DEFAULT 'General'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
```
Body (exact): `INSERT INTO organizations (name, subscription_tier) VALUES (p_name, p_subscription_tier) RETURNING id INTO v_org_id; INSERT INTO departments (org_id, name, is_default) VALUES (v_org_id, p_default_dept_name, true); RETURN v_org_id;`

- **Creates:** one `organizations` row (name + tier only — **slug stays NULL**, add_ons/settings default `'{}'`) + one `departments` row (`is_default=true`). Protected by `departments_one_default_per_org_idx` (partial-unique on `org_id WHERE is_default`).
- **Does NOT create:** the `org_members` row. **The caller MUST insert membership separately** (this is why D-01 mandates a separate membership insert).
- **NOT idempotent by itself** — every call `INSERT`s a NEW org. Idempotency is entirely the caller's responsibility (the "no personal org yet" gate). Calling it unconditionally on a re-run creates duplicate orgs.
- **Grants:** `EXECUTE` = `postgres` + `service_role` ONLY (anon/authenticated REVOKEd — CR-01). The migration (runs as owner) and the SECDEF `handle_new_user` (runs as its owner `postgres`) can both call it. `[VERIFIED: routine_privileges → {postgres, service_role}]`

**Membership insert shape** (D-01):
```sql
INSERT INTO public.org_members (org_id, user_id, role)
VALUES (v_org_id, <user_id>, 'org-admin')
ON CONFLICT (org_id, user_id) DO NOTHING;   -- constraint: org_members_org_user_unique (org_id,user_id)
```
`[VERIFIED: live — unique constraint org_members_org_user_unique on (org_id,user_id); role CHECK allows 'org-admin']`

## Personal-Org Creation & Idempotency (D-01, SC#1, SC#4)

**Live state (pre-162):** `auth.users`=8, `profiles`=8, `organizations`=0, `departments`=0, `org_members`=0 → mig 104 shipped the org tables **empty**; 162 is the first writer. `[VERIFIED]` Note: only **5 distinct users own** documents/threads/skills, but **all 8** users must get a personal org (D-01 "every existing user") → iterate `auth.users`, not owners. All 8 users have non-NULL emails (0 NULL/empty). `[VERIFIED]`

**Recommended creation loop (normal transactional `DO` block — small, no COMMIT needed):**
```sql
DO $$
DECLARE u record; v_org_id uuid;
BEGIN
  FOR u IN
    SELECT id, email FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = au.id)   -- the gate
  LOOP
    v_org_id := public.create_org_with_default_dept(u.email || '''s Organization', NULL, 'General');
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (v_org_id, u.id, 'org-admin')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END LOOP;
END $$;
```
Because the whole `DO` block is ONE transaction (no per-iteration `COMMIT`), a mid-loop failure rolls back entirely → no half-created orgs → clean re-run. It is bounded by user count (tiny), so no lock-storm concern.

### The "user has no personal org yet" predicate — THE key plan-time decision

There is **no `is_personal`/`joined_via` marker** (verified). Two viable gates:

| Option | Gate predicate | Schema change | Idempotency proof | Recommendation |
|--------|----------------|---------------|-------------------|----------------|
| **B (recommended)** | `NOT EXISTS (SELECT 1 FROM org_members WHERE user_id = <uid>)` | **none** | `org_members` is empty pre-162 (verified). Run 1 creates one membership per user; re-run sees the membership → skips. The forward trigger fires at `auth.users` INSERT when the user has zero memberships (invitation memberships are added *after* signup) → correct forever. | Aligns with D-01's name-based identity + mig-104 minimalism; zero schema change; provably idempotent for 162's window + trigger. |
| A (optional robustness) | add `organizations.is_personal boolean NOT NULL DEFAULT false` (idempotent `ADD COLUMN IF NOT EXISTS`), `UPDATE … SET is_personal=true WHERE id=v_org_id` after creation; gate `NOT EXISTS (org_members m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=<uid> AND o.is_personal)` | +1 col +1 UPDATE/org | Precise even if 162 is re-run *after* 167 invitation memberships exist. Also gives 166's switcher a machine-checkable personal-org flag. | Only if the team wants an explicit flag now; otherwise **YAGNI — defer to 166** when the switcher actually needs it. |

**Honest limitation of Option B:** if, far in the future, a NEW user's trigger silently failed to create their personal org (swallowed WARNING) AND they later accepted an invitation (gaining a membership) AND 162 were re-run, they'd be skipped and stay personal-org-less. Mitigation: the trigger's `RAISE WARNING` surfaces failures; repair is a targeted query, not a full 162 re-run. This scenario cannot occur within 162's actual lifetime (167 doesn't exist yet). Recommend Option B; flag this limitation for the planner to accept or upgrade to A. `[ASSUMED: cloud-scale re-run timing — no way to observe]`

## Batched Backfill Procedure with COMMIT (D-07) — plus the REAL trap

### The load-bearing finding (verified live on PG 17.6)

D-07's premise ("a `DO` block runs in a single transaction and never releases locks") is **imprecise for PG17** — the actual determinant is **atomic vs non-atomic execution context**, not DO-vs-procedure:

| Executed as | DO block `COMMIT` | `CALL proc` with internal `COMMIT` |
|-------------|-------------------|-------------------------------------|
| `autocommit=True` / top-level single statement | **OK** (ran a real 30k-row batched loop to completion) | **OK** |
| inside an explicit `BEGIN … COMMIT` wrapper | **ERROR: invalid transaction termination** | **ERROR: invalid transaction termination** |
| `autocommit=False` (driver opened a txn) | **ERROR** | **ERROR** |

`[VERIFIED: executed all six cases live @ :54322]`

**Consequence for the plan (the #1 pitfall):** if the operator pastes the whole 105 file into the Supabase SQL editor and runs it as ONE multi-statement string, Postgres treats it as an implicit transaction and the procedure's `COMMIT` fails with **"invalid transaction termination."** This fails *loud* (safe) — but it means the batching strategy collapses unless the `CALL` runs in a **non-atomic** context.

**Still follow D-07 (use a PROCEDURE, not a DO block)** — it is the portable, decision-locked choice and it's what fails-loud correctly. The value-add here is the **execution requirement**, not the DO-vs-proc choice.

### Recommended shape — one reusable batching procedure, invoked per table (executor discretion, D-11)

```sql
CREATE OR REPLACE PROCEDURE public._mig105_backfill(p_sql text, p_batch int DEFAULT 10000)
LANGUAGE plpgsql AS $$
DECLARE v_rows int; v_iter int := 0;
BEGIN
  LOOP
    EXECUTE p_sql USING p_batch;      -- p_sql is a parameterized UPDATE…LIMIT $1 (see resolvers)
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_iter := v_iter + 1;
    RAISE NOTICE 'batch % -> % rows', v_iter, v_rows;
    COMMIT;                            -- releases the lock window between batches
    EXIT WHEN v_rows = 0;
  END LOOP;
END; $$;
-- CALL once per target table with its resolver, then:  DROP PROCEDURE public._mig105_backfill(text,int);
```
**Single reusable procedure vs per-table code — recommendation:** a **single parameterized batching procedure** (batching/COMMIT logic written once, provably correct) invoked with each table's explicit resolver SQL at the call site. Rationale: the batch/COMMIT loop is the error-prone part and should exist once; the per-table resolver is the auditable part and stays visible per call. A pure per-table hand-written loop ×35 duplicates the COMMIT logic 35× (35 chances to get it wrong). A single fully-dynamic loop-over-a-mapping hides the resolvers. The parameterized-procedure hybrid is the balance. (Executor may instead write ~3 concrete procedures — one per resolver shape — if it prefers zero dynamic SQL; both satisfy D-07.)

**Batch size:** ~10k is fine. Live scale is tiny (largest target `audit_log`=5080 rows; `harness_audit`=1706, `messages`=1326, `runs`=819, `sandbox_files`=744, `threads`=580) so locally every table completes in 1 batch. The batching is **forward-insurance for cloud scale** — correctness there is by construction (bounded lock window), not observable locally.

### Recommended apply path
Run the entire 105 file through **psycopg2 `autocommit=True` @ :54322** (the proven path; MEMORY confirms mig 104 was applied via psycopg2). Under autocommit every statement is its own transaction: the personal-org `DO` block is atomic-per-statement, the batched `CALL`s' `COMMIT`s are legal, the NOT-NULL flips and the trigger `CREATE OR REPLACE` all apply cleanly. If the operator insists on the SQL editor (D-06 canonical), the `CALL` statements must be run as **separate executions** (highlight + run each `CALL` alone) so each is top-level/non-atomic.

## NOT-NULL Flip — self-verifying (D-08) + per-table decision (D-11)

**Proven pattern (executed live — guard passes on clean data, FIRES on one straggler):**
```sql
-- per target table, AFTER all backfill CALLs have COMMITted:
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.<t> WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'MIG105 <t>: % rows still NULL — NOT-NULL flip aborted',
      (SELECT count(*) FROM public.<t> WHERE org_id IS NULL);
  END IF;
END $$;
ALTER TABLE public.<t> ALTER COLUMN org_id SET NOT NULL;
```
`[VERIFIED live: guard raised "BACKFILL INCOMPLETE: 1 NULL rows remain" on a dirty table; SET NOT NULL succeeded on the zero-NULL table]`

**Ordering (load-bearing):** ALL backfill `CALL`s must `COMMIT` before ANY `SET NOT NULL`. Never flip first.

**Operator-visibility pre-flip census (one query, run before the flips):**
```sql
SELECT 'audit_log' t, count(*) FILTER (WHERE org_id IS NULL) nulls FROM audit_log
UNION ALL SELECT 'messages', count(*) FILTER (WHERE org_id IS NULL) FROM messages
-- … all 35 targets …
ORDER BY nulls DESC;   -- must be all-zero before flipping
```

**Per-table flip decision (resolves D-11):**

| Table | Flip `NOT NULL`? | Evidence |
|-------|------------------|----------|
| All 34 backfill targets except `metadata_field_definitions` | **YES** | every row user-owned; `audit_log` distinct owners=2, **0 non-auth rows** — user-owned, flips (distinct from operator_audit_log); `harness_audit` user_id NN, 0 orphans → flips. `[VERIFIED]` |
| `metadata_field_definitions` | **YES if zero NULL-owner rows survive** (live: 0 NULL user_id → flips). If cloud has global system field-defs with NULL `user_id`, the self-guard fires → planner chooses: keep nullable (D-11 lean) or assign to a designated org. | `[VERIFIED local=0; ASSUMED cloud may differ]` |
| `operator_audit_log` | **NO — keep nullable, exclude from backfill** | operator actions are org-agnostic; no owning `auth.users`. Its 163 RLS predicate must handle `NULL` explicitly. `[VERIFIED: no user_id/created_by column]` |

After 162, the ONLY user-facing `org_id` columns still nullable should be `operator_audit_log` (+ `metadata_field_definitions` iff kept nullable). Verify with:
```sql
SELECT table_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='org_id' AND is_nullable='YES';
-- expect: operator_audit_log  (+ metadata_field_definitions if the planner keeps it nullable)
```

## `handle_new_user` Extension (D-03)

**Current live body** (identical at `full-schema.sql:174-183` and re-applied at `:5393-5408`; the `:5393` `CREATE OR REPLACE` is the effective definition):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end; $$;
-- trigger: on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW
```
`[VERIFIED: full-schema.sql + live]` — SECURITY DEFINER + `search_path='public'` already set (keep both).

**Recommended defensive extension** (D-03 — must never abort signup):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name')
  ON CONFLICT (id) DO NOTHING;                          -- hardening (was a bare insert)

  BEGIN                                                  -- defensive sub-block
    IF NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = new.id) THEN
      v_org_id := public.create_org_with_default_dept(
                    COALESCE(new.email, new.id::text) || '''s Organization', NULL, 'General');
      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES (v_org_id, new.id, 'org-admin')
      ON CONFLICT (org_id, user_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: personal-org creation failed for %: %', new.id, SQLERRM;
  END;

  RETURN new;
END; $$;
```
**Why this is safe:** a trigger that raises an *uncaught* exception aborts the triggering `auth.users` INSERT (breaks signup). The inner `BEGIN … EXCEPTION WHEN OTHERS … RAISE WARNING … END` **catches and swallows** any org-creation failure, so signup always succeeds; the failure is logged for repair. The SECDEF owner is `postgres`, which holds `EXECUTE` on `create_org_with_default_dept` (verified) → the CR-01 lock does not block the trigger. `COALESCE(new.email, new.id::text)` guards the theoretical NULL-email signup. `ON CONFLICT`/`NOT EXISTS` make it idempotent. Re-applying the whole function is `CREATE OR REPLACE` (re-paste-safe). `[VERIFIED: grants + trigger semantics; the ON CONFLICT (id) on profiles assumes profiles PK=id — confirm profiles PK at plan time]`

**Recommendation (executor discretion):** reuse the exact same `NOT EXISTS org_members` gate + membership insert as the batch loop so the two creation paths are literally the same logic (D-03 intent).

## is_global / is_system HANDS-OFF Confirmation (D-04/D-05/D-08)

162 never reads or writes `is_global`/`is_system` — it resolves `org_id` purely through the owning `user_id`/`created_by`. Evidence that this is fully achievable (every shared/system row has a resolvable owner → NO orphan edge case):

| Table.col | `=true` rows (live) | rows with NULL owner | Resolves? |
|-----------|--------------------:|---------------------:|-----------|
| `folders.is_global` | 1 | 0 | ✓ via user_id |
| `skills.is_global` | 1 | 0 | ✓ via user_id |
| `skills.is_system` (seeded skill-creator) | 1 | 0 | ✓ via user_id |
| `workflow_definitions.is_global` | 15 | 0 (created_by) | ✓ via created_by |
| `classification_rules` / `document_views` / `metadata_field_definitions .is_global` | 0 | 0 | n/a |

`[VERIFIED: live counts]` All `is_global`/`is_system` columns are `NOT NULL DEFAULT false` (verified) — 162 leaves them exactly as-is. The seeded `skill-creator` (skills.is_system=true) lands in its creating user's personal org and stays cross-org-visible later via the orthogonal flag (165), never via a synthetic system org (D-09). **No global/system row lacks an owning user** → the is_global data-loss threat is closed by construction, and the NOT-NULL flip cannot orphan a shared resource. `[VERIFIED]`

## Runtime State Inventory (migration phase)

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data (the migration's whole subject) | 41 tables carry `org_id`, all currently 100% NULL on the 35 targets; `organizations`/`org_members`/`departments` empty (0 rows) | This IS the backfill — populate per §Backfill + create personal orgs. Verified counts in §Personal-Org Creation. |
| Live service config | None — no external service embeds an org identifier at 162 (RLS still bypassed; no n8n/Datadog/Tailscale coupling to org_id) | None. |
| OS-registered state | None — no Task Scheduler / pm2 / systemd unit references org_id | None. |
| Secrets / env vars | None renamed. `SECRETS_ENCRYPTION_KEY` is owed at prod push (cloud-parity) but unrelated to 162's data. | None (cloud-parity handled at deploy). |
| Build artifacts / installed packages | `supabase/full-schema.sql` is the one artifact that MUST be regenerated post-apply (D-06); it is a live-DB dump, not hand-edited. No egg-info/compiled artifacts. | `bash scripts/regenerate-full-schema.sh` (no `--reset`) + commit same-commit. |

**The canonical question — "after every file is updated, what runtime systems still hold the old state?":** none. This is a forward data-fill, not a rename; there is no cached old string. The only "runtime state" is the DB rows themselves, fully inventoried above.

## Common Pitfalls

### Pitfall 1: "invalid transaction termination" — the batched CALL runs inside a wrapping transaction
**What goes wrong:** pasting the whole 105 file as one SQL-editor run makes Postgres treat it as an implicit transaction; the procedure's `COMMIT` errors out. **Why:** both DO blocks and procedures can only `COMMIT` in a non-atomic (top-level/autocommit) context (proven above). **How to avoid:** apply via psycopg2 `autocommit=True`, or run each `CALL` as its own SQL-editor execution. **Warning sign:** `ERROR: invalid transaction termination` on the `CALL`.

### Pitfall 2: calling `create_org_with_default_dept` without the idempotency gate → duplicate orgs on re-run
**What goes wrong:** the helper always `INSERT`s a new org; an ungated re-run doubles every user's org. **How to avoid:** the `NOT EXISTS org_members WHERE user_id=…` gate wraps the call; membership insert `ON CONFLICT DO NOTHING`. **Warning sign:** `SELECT count(*) FROM organizations` grows on the second paste.

### Pitfall 3: flipping NOT NULL before the backfill COMMITs, or on `operator_audit_log`
**What goes wrong:** `SET NOT NULL` before batches commit fails the migration; forcing it on `operator_audit_log` (no owner) is impossible and would wedge the file. **How to avoid:** flips come last, each behind the RAISE-guard; exclude `operator_audit_log`. **Warning sign:** the guard raises "% rows still NULL".

### Pitfall 4: assuming `is_personal`/`joined_via`/`slug` exist (stale ARCHITECTURE.md §6)
**What goes wrong:** planning a gate/resolver against columns mig 104 never shipped → SQL errors. **How to avoid:** use only the verified columns; if a personal-org flag is wanted, add `is_personal` explicitly (Option A). **Warning sign:** `column "is_personal" does not exist`.

### Pitfall 5: an uncaught exception in the extended trigger breaks signup
**What goes wrong:** any error in the org-creation path aborts the `auth.users` INSERT — nobody can sign up. **How to avoid:** the inner `BEGIN…EXCEPTION WHEN OTHERS…RAISE WARNING…END` swallow (D-03). **Warning sign:** signups start 500ing after the trigger change.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Org + default-dept creation | A bespoke `INSERT organizations; INSERT departments` | `create_org_with_default_dept()` (mig 104) | Already atomic, `service_role`-locked (CR-01), respects the one-default-per-org partial-unique index. |
| Autonomous per-batch transactions | `dblink`/`pg_background` autonomous-txn hacks | A stored PROCEDURE with `COMMIT`, run in autocommit | Native, zero extension dependency; proven on PG17. |
| "Verified zero-NULL" gate | A human eyeballing counts | `IF EXISTS(… org_id IS NULL) RAISE EXCEPTION` before each flip | The DB enforces D-08; re-paste-safe; catches cloud stragglers automatically. |
| Idempotent membership | Pre-`SELECT` then conditional insert | `INSERT … ON CONFLICT (org_id,user_id) DO NOTHING` | Matches `org_members_org_user_unique`; race-free. |

## Validation Architecture

This is a SQL-migration-only phase with **no test harness and no UI**. `nyquist_validation: true`, so validation = **operator-run verification SQL** pasted into the Supabase SQL editor (or run via psycopg2 `:54322`). The local dev DB is tiny (fast, exact row counts) but the migration must be correct at **cloud scale** — items marked *(reason-only)* below can be proven only by construction/pattern, not by local counts.

### Test "framework"
| Property | Value |
|----------|-------|
| Framework | none — verification SQL (no pytest/jest; this phase writes no app code) |
| Config file | none |
| Quick run | paste the SC#1–4 query pack below into the SQL editor / psycopg2 |
| Full "suite" | the same pack, run twice (once after apply, once after a re-paste, for SC#4) |

### SC → verification-query map (turn each into an acceptance criterion)

**SC#1 — every user gets exactly one personal org + default dept + org-admin membership; idempotent:**
```sql
-- (a) coverage: personal orgs == users, memberships present
SELECT (SELECT count(*) FROM auth.users)                         AS users,          -- 8 local
       (SELECT count(*) FROM organizations)                      AS orgs,           -- == users at 162
       (SELECT count(*) FROM org_members WHERE role='org-admin') AS admin_members;  -- >= users
-- (b) exactly ONE membership per user (no duplicate orgs)
SELECT user_id, count(*) FROM org_members GROUP BY user_id HAVING count(*) <> 1;    -- expect 0 rows
-- (c) exactly ONE default department per org
SELECT org_id FROM departments GROUP BY org_id
HAVING count(*) FILTER (WHERE is_default) <> 1;                                     -- expect 0 rows
-- (d) idempotency: capture orgs+members, RE-PASTE the whole migration, re-count -> MUST be identical
```

**SC#2 — org_id backfilled non-NULL across every target; NOT-NULL only after verified zero-NULL:**
```sql
-- remaining-NULL census across the 35 targets (must be all-zero before/after flips)
SELECT c.table_name,
       (SELECT count(*) FROM information_schema.columns) AS _  -- placeholder; generate per-table:
FROM (VALUES ('documents'),('folders'),('threads'),('skills'),('messages'),('runs'),
             ('audit_log'),('harness_audit'),('todos'),('workflow_phases'),('workflow_runs'),
             ('workspace_file_versions') /* … all 35 … */) c(table_name);
-- practical form: the pre-flip census UNION query in §NOT-NULL Flip -> every 'nulls' = 0.
-- post-flip: only operator_audit_log (+ metadata_field_definitions if kept nullable) remain nullable:
SELECT table_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='org_id' AND is_nullable='YES';
```
The self-guard (`RAISE EXCEPTION`) makes SC#2 **structurally impossible to violate** — the flip cannot run on dirty data (proven live).

**SC#3 — all data preserved; nothing disappears:**
```sql
-- row counts are INVARIANT (backfill only UPDATEs; never INSERT/DELETE on target rows).
-- Capture BEFORE, compare AFTER, per target table:  SELECT count(*) FROM <t>;  -> equal.
-- is_global / is_system reach unchanged (162 never touches these flags):
SELECT 'folders' t, count(*) FILTER (WHERE is_global) g FROM folders
UNION ALL SELECT 'skills', count(*) FILTER (WHERE is_global) FROM skills
UNION ALL SELECT 'skills_sys', count(*) FILTER (WHERE is_system) FROM skills
UNION ALL SELECT 'workflow_definitions', count(*) FILTER (WHERE is_global) FROM workflow_definitions;
-- expect identical before/after: folders=1, skills(global)=1, skills(system)=1, wf_def=15.
```

**SC#4 — re-run neither lock-storms nor duplicates:**
```sql
-- (a) duplicate check == SC#1(d): re-paste -> org/member counts unchanged.
-- (b) batching evidence: the procedure's RAISE NOTICE 'batch N -> M rows' shows M <= 10000 and
--     a COMMIT between batches (captured in the SQL-editor notices / psql output).
-- (c) lock-storm safety at cloud scale — (reason-only): bounded 10k-row lock window per batch,
--     released by COMMIT; cannot be observed on the tiny local DB (largest target = 5080 rows,
--     completes in one batch). Argue by construction + the live COMMIT-releases-lock proof.
```

### Wave 0 gaps
- [ ] No test files needed (SQL-only phase). Author the SC#1–4 query pack as `162-VALIDATION.md` acceptance criteria (the orchestrator generates VALIDATION.md from this section).
- [ ] Capture BEFORE-counts (row counts per target + is_global/is_system census) as a baseline snapshot before applying 105 (needed for the SC#3 diff).

*(No framework install; no conftest; no unit tests — this is intentional and correct for a data migration.)*

## Security Domain

`security_enforcement` is enabled and this phase is **threat-modeled at secure-phase** (flags: lock-storm, idempotency, NOT-NULL-flip ordering, is_global data-loss). This research directly feeds those mitigations.

### Applicable ASVS categories

| ASVS category | Applies | Standard control (this phase) |
|---------------|---------|-------------------------------|
| V1 Architecture/Data-flow | yes | `org_id`=home-org invariant; no synthetic system principal (D-09) |
| V4 Access Control | yes (indirect) | populates the substrate for 163 RLS; `create_org_with_default_dept` stays `service_role`/owner-only (CR-01 preserved); trigger runs SECDEF as owner |
| V5 Input Validation | n/a | no user input; migration operates on existing owned rows |
| V6 Cryptography | no | none |
| V7 Error handling/logging | yes | trigger swallows org-creation errors → `RAISE WARNING` (never aborts signup) |
| V10 Malicious code / stored procs | yes | dynamic-SQL batching procedure takes only a fixed, migration-authored `p_sql` (not user input); `search_path` pinned on the DEFINER trigger + helper |

### Known threat patterns for a Postgres backfill migration

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Duplicate orgs/memberships on re-run | Tampering / integrity | `NOT EXISTS` gate + `ON CONFLICT DO NOTHING` (idempotent by construction) |
| Lock storm on large-table UPDATE | Denial of Service | batched ~10k UPDATE + `COMMIT` between batches (proven lock-release) |
| NOT-NULL flip on incomplete data | Availability / integrity | RAISE-guarded flip after all COMMITs (DB-enforced zero-NULL) |
| is_global sharing lost | Info-disclosure / integrity | HANDS-OFF is_global/is_system (D-04) — verified 0 orphan shared rows |
| Trigger aborts signup | Denial of Service | defensive `EXCEPTION WHEN OTHERS` swallow (D-03) |
| SECDEF privilege escalation via search_path | Elevation of Privilege | `SET search_path TO 'public'` pinned on trigger + helper (already present) |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres | apply + verify | ✓ | **17.6** @ `127.0.0.1:54322` | — |
| psycopg2 (autocommit apply path) | run the batched `CALL` non-atomically | ✓ | `backend/venv/Scripts/python.exe` | Supabase SQL editor (run CALL as separate execution) |
| `create_org_with_default_dept()` | personal-org creation | ✓ | mig 104, service_role/owner-granted | — |
| `scripts/regenerate-full-schema.sh` | post-apply artifact | ✓ (per CLAUDE.md) | — | — |
| psql on PATH | optional | ✗ | — | use psycopg2 (present) |

**No blocking gaps.** All apply/verify tooling is present.

## State of the Art

| Old assumption (research-phase docs) | Current live truth | Impact |
|--------------------------------------|--------------------|--------|
| ARCHITECTURE §6: personal orgs use `is_personal=true`, `joined_via='personal_auto'`, `slug='personal-<id>'` | mig 104 shipped **none** of these columns | Idempotency gate must use membership-existence (Option B) or add `is_personal` (Option A) |
| D-07: "a DO block runs in a single transaction and never releases locks" | On PG17 a DO block CAN `COMMIT` at top level; the real gate is atomic vs non-atomic context; a `CALL` inside a wrapper ALSO can't `COMMIT` | Follow D-07 (procedure) but the plan's true risk is "invalid transaction termination," addressed by the autocommit apply path |
| D-10: `operator_audit_log` implied to be a backfill target | It has `org_id` but no owning `auth.users` (operator FK) | Exclude from backfill; keep nullable (D-11 resolved) |
| PG "15+" (CONTEXT/ARCHITECTURE) | Actually **17.6** | Procedural COMMIT + all patterns fully supported |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Cloud DB has no `metadata_field_definitions` rows with NULL `user_id` (global system field-defs) | NOT-NULL Flip | If it does, the self-guard fires and blocks the flip → planner must keep it nullable or assign an org. Low risk (fails safe/loud). |
| A2 | Option B (membership-existence gate) is sufficient — no future 162 re-run after 167 memberships exist | Idempotency | An extreme far-future re-run could skip a personal-org-less user; mitigated by trigger WARNING + targeted repair. Adopt Option A if unacceptable. |
| A3 | The Supabase SQL editor wraps a multi-statement paste in an implicit transaction (making the CALL's COMMIT fail there) | Batched Backfill | If the editor actually runs statement-by-statement autocommit, the CALL works directly; either way the psycopg2-autocommit path is safe. Verify at apply time. |
| A4 | `profiles` PK is `id` (for the `ON CONFLICT (id)` hardening on the trigger's profile insert) | handle_new_user | If not, drop the ON CONFLICT clause (leaves existing behavior). Trivial to confirm at plan time. |
| A5 | Cloud has no orphan `user_id`/`created_by` (owner not in `auth.users`) on target tables | Backfill | Local = 0 orphans across all checked tables. A cloud orphan would leave a NULL row → self-guard fires → surfaced before flip. Fails safe. |

## Open Questions

1. **Idempotency gate: Option B (membership-existence, no schema change) vs Option A (add `is_personal`)?**
   - Known: no marker column exists; B is provably idempotent for 162's window + the trigger; A is more precise + helps 166's switcher.
   - Recommendation: **Option B** (aligns with D-01's name-based identity + mig-104 minimalism); adopt A only if the team wants a machine-checkable personal-org flag now (else defer to 166).
2. **`metadata_field_definitions` NOT-NULL flip at cloud scale** — flip (local-safe) or keep nullable if cloud has NULL-owner global defs? The self-guard forces the decision at apply time; default lean = flip, fall back to nullable (D-11).
3. **Apply mechanics** — confirm whether the operator applies via psycopg2-autocommit (recommended) or the SQL editor with per-CALL execution. Purely operational; both are safe.

## Sources

### Primary (HIGH confidence)
- **Live local catalog @ `127.0.0.1:54322` (PG 17.6)** — `information_schema.columns` (41 org_id tables + nullability), `key_column_usage`/`constraint_column_usage` (full FK graph), `routine_privileges` (create_org grants), row counts + owner-NULL + is_global/is_system censuses, and **executed** COMMIT-context + NOT-NULL-guard tests. THE source of truth for every table/column/row claim.
- `supabase/migrations/104_org_dept_role_schema.sql` — `create_org_with_default_dept` signature/body, the 23-table sweep, CR-01/CR-02 locks, RLS idioms.
- `supabase/full-schema.sql` — `handle_new_user` body (`:174`, `:5393`), org_id column comments.
- `supabase/migrations/096_org_id_stub_sweep.sql` — the 4-root stub precedent ("children inherit via parent FK — NOT stubbed").
- `.planning/phases/162-personal-org-backfill/162-CONTEXT.md` — D-01…D-11 (the contract).

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` Pitfall 7 (lock storms / NOT-NULL ordering / is_global loss / idempotency / handle_new_user) — reused, not redone.
- `.planning/research/ARCHITECTURE.md` §1/§6 — the 38-table map + backfill ordering (note: §6's `is_personal`/`joined_via`/`slug` assumptions are STALE vs the shipped mig 104 — corrected above).

## Metadata

**Confidence breakdown:**
- Backfill-target table set + FK resolution graph: **HIGH** — live catalog, exhaustive.
- create_org helper + trigger + grants: **HIGH** — verified body + privileges.
- Batched-COMMIT + NOT-NULL guard SQL: **HIGH** — executed live on PG 17.6.
- Idempotency-gate recommendation: **MEDIUM** — sound for 162's window; the far-future re-run edge is reasoned, not observed.
- Cloud-scale correctness (lock windows, NULL-owner stragglers): **MEDIUM** — by construction; local DB too small to exercise.

**Research date:** 2026-07-18
**Valid until:** stable — re-verify only if migrations 105+ land or the org schema changes before this phase executes (~14 days).
