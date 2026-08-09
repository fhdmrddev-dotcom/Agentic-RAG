# Phase 161: Org / Dept / Role Schema - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 1 new file (`supabase/migrations/104_*.sql`) + 1 regenerated artifact (`supabase/full-schema.sql`)
**Analogs found:** 11 / 12 DB-object classes (only `sso_configs` SAML depth has no in-repo analog — by design)

> This is an **additive Supabase schema migration** phase. There is essentially ONE authored file
> (the numbered migration) plus the regenerated `full-schema.sql` bootstrap dump. The real planning
> surface is the set of **DB objects inside that migration** — so this map classifies DB objects
> (tables / function / policies / indexes / seeds), not "files," and points each at the closest
> in-repo analog to copy verbatim.
>
> **All line references are into `supabase/full-schema.sql` (migration head = 103) unless a
> `NNN_*.sql` migration file is named.** RE-VERIFY line numbers at plan time — a dump regenerates.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/104_<name>.sql` | migration | batch (DDL + seed) | `095_operator_foundation.sql` (new tables + RLS) · `096_org_id_stub_sweep.sql` (stub sweep) · `094_starter_workflows.sql` (idempotent seed) | exact (composite) |
| `supabase/full-schema.sql` | config (generated artifact) | n/a | regenerated via `bash scripts/regenerate-full-schema.sh` — **never hand-edited** | n/a |

### DB-object classification (the planning surface)

| DB object (this migration) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `current_user_org_ids()` SECDEF helper | function | request-response (RLS predicate) | `folder_is_globally_visible()` `full-schema.sql:97-113` | exact |
| `organizations` table + RLS | table | CRUD (membership-gated) | `skills` table + `skills` CRUD policies | role-match |
| `departments` (+`parent_id` self-FK, `is_default`) | table | CRUD + self-referential tree | `folders` (self-FK `parent_id`) `full-schema.sql:839, 2837, 2089` | exact |
| `org_members` + **non-recursive self-rows-only policy** | table | CRUD (self-scoped, recursion-break) | `todos` FK-derived-ownership policy shape `4055-4084` (BUT via helper, not inlined subquery) | role-match |
| `dept_members` + RLS | table | CRUD (membership-gated) | `todos` FK-through-parent policy `4055-4084` | role-match |
| `roles` (4 fixed tiers) — GLOBAL ref data | table | reference (read-all) | `model_capabilities_overrides` + `model_overrides_read_all` policy `3944` | exact |
| `role_permissions` (grant catalog) — GLOBAL ref data | table | reference (read-all) + composite key | `model_overrides_read_all` `3944` + `user_memory_user_key_unique UNIQUE` `1919` | exact |
| `org_invitations` (near-complete) + RLS | table | CRUD (membership-gated, enum status) | `skills`/`threads` CRUD + `documents_status_check` enum `686` | role-match |
| `sso_configs` (deliberately thin) + RLS | table | CRUD (membership-gated) | shape: `skills` RLS; **SAML columns: NO analog** (Supabase owns `auth.saml_providers`) | partial |
| permission catalog seed (roles + grants) | seed | batch INSERT (idempotent) | `094_starter_workflows.sql:59-60` (`ON CONFLICT (id) DO NOTHING`) | exact |
| `departments.is_default` partial-unique index | index | constraint | `documents_completed_hash_unique_idx ... WHERE` `2040` | exact |
| nullable `org_id` stub sweep (~23-26 tables) + btree index | migration DDL | batch ALTER | `096_org_id_stub_sweep.sql:18-26` (col) + `idx_classification_rules_org_id` `2103` (index) | exact |

---

## Pattern Assignments

### `current_user_org_ids()` — SECURITY DEFINER helper (function, RLS predicate)

**Analog:** `folder_is_globally_visible()` — `supabase/full-schema.sql:97-113`. This is **the existing
`SECURITY DEFINER` precedent this codebase already trusts** to break RLS recursion (a SECDEF function
runs as owner → its internal read of `public.folders` bypasses the folders RLS policy, so the policy
that CALLS it never re-enters itself). `current_user_org_ids()` must follow this shape exactly to break
the `42P17` recursion on `org_members` (Pitfall 4).

**Full definition to copy the shape of** (`full-schema.sql:97-113`):
```sql
CREATE FUNCTION public.folder_is_globally_visible(p_folder_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_global
    FROM public.folders
    WHERE id = p_folder_id
    UNION ALL
    SELECT f.id, f.parent_id, f.is_global
    FROM public.folders f
    INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_global), false) FROM ancestors;
$$;
```

**Key attributes to preserve** (each load-bearing):
- `LANGUAGE sql STABLE SECURITY DEFINER` — `STABLE` (safe inside a policy, cached per-statement);
  `SECURITY DEFINER` = the recursion-break. `current_user_org_ids()` returns `setof uuid` (or `uuid[]`)
  of the caller's org ids; body reads `org_members WHERE user_id = auth.uid()`.
- `SET search_path TO 'public'` — **mandatory** on every SECDEF body here (search-path pinning is the
  standard SECDEF hardening; see also `handle_new_user()` `120-123`, `capture_skill_version()` `54-56`
  which pin `'public','pg_temp'`). Copy this line — a SECDEF function without a pinned search_path is a
  security finding 164's isolation suite (TEN-05) will flag.
- **Usage in a policy** — the helper is called bare-qualified, exactly like `folder_is_globally_visible`
  at `full-schema.sql:3631` and `3722`:
  ```sql
  CREATE POLICY "Users can view own and global folders" ON public.folders
    FOR SELECT USING (((auth.uid() = user_id) OR public.folder_is_globally_visible(id)));
  ```
  Org tables' membership predicate becomes `USING (org_id IN (SELECT public.current_user_org_ids()))`
  (or `= ANY(...)`). **Every other table's membership predicate calls the helper — never inlines an
  `org_members` subquery** (D-10 / the recursion contract).

**Idempotency note:** the schema DUMP shows bare `CREATE FUNCTION`, but the **migration must use
`CREATE OR REPLACE FUNCTION`** so a re-paste is safe (Discretion: "CREATE OR REPLACE guards").

---

### `departments` — self-referential tree + one-default-per-org (table, CRUD + tree)

**Analog for the self-FK:** `folders` — the only self-referential parent tree in the schema.
- Column (`full-schema.sql:839`): `parent_id uuid`
- FK (`full-schema.sql:2833-2837`):
  ```sql
  ALTER TABLE ONLY public.folders
      ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id)
      REFERENCES public.folders(id) ON DELETE CASCADE;
  ```
- Index (`full-schema.sql:2086-2089`): `CREATE INDEX folders_parent_id_idx ON public.folders USING btree (parent_id);`

  → `departments.parent_id uuid REFERENCES public.departments(id) ON DELETE CASCADE` + a
  `departments_parent_id_idx` btree. (D-14: "large orgs nest via `departments.parent_id` — zero schema
  change." Small orgs leave it NULL.)

**Analog for a self-reference guard CHECK:** `document_relationships` — `full-schema.sql:607`:
```sql
CONSTRAINT no_self_rel CHECK ((source_doc_id <> target_doc_id))
```
  → optionally add `CHECK (parent_id IS NULL OR parent_id <> id)` so a department cannot be its own
  parent (cheap, matches house style).

**Analog for the one-default-per-org guarantee (D-11):** the **partial unique index** —
`full-schema.sql:2040`:
```sql
CREATE UNIQUE INDEX documents_completed_hash_unique_idx ON public.documents
    USING btree (user_id, content_hash) WHERE ((content_hash IS NOT NULL) AND (status = 'completed'::text));
```
  → `CREATE UNIQUE INDEX ... ON public.departments (org_id) WHERE (is_default = true);` — exactly one
  `is_default = true` row per `org_id`, enforced **by construction** (D-11). The SECDEF creation helper
  (`create_org_with_default_dept()`, this phase ships only the schema support) inserts the org + its one
  default dept atomically; the partial-unique index is the backstop.

---

### `org_members` — the LOCKED non-recursive self-rows-only policy (table, recursion-break)

**Analog (shape only):** `todos` — the FK-through-parent ownership policy at `full-schema.sql:4055-4084`
shows the subquery-through-a-related-table policy shape:
```sql
CREATE POLICY todos_select_own ON public.todos FOR SELECT TO authenticated
  USING ((auth.uid() = ( SELECT threads.user_id FROM public.threads
                          WHERE (threads.id = todos.thread_id))));
```

**Divergence (the whole point of ORG-02 / SC#2):** `org_members` must NOT be gated by a subquery over
`org_members` (that is the `42P17` self-recursion). The LOCKED policy is **self-rows-only, direct
column compare, no subquery**:
```sql
-- Members read their OWN membership rows directly — NO org_members subquery (breaks 42P17).
CREATE POLICY org_members_self_select ON public.org_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```
Plus the org-admin-can-read-org-members path (D-10) routes through the **helper**, not an inline
`org_members` subquery:
```sql
CREATE POLICY org_members_admin_select ON public.org_members
  FOR SELECT TO authenticated USING (org_id IN (SELECT public.current_user_org_ids()));
```
(The helper is SECDEF → its internal `org_members` read bypasses these policies → no recursion.)

---

### `roles` + `role_permissions` — GLOBAL reference data (table, read-all)

**Analog:** `model_capabilities_overrides` + its read-all policy — the exact "global reference data,
read-all-authenticated, writes are migration/service-role only" pattern (D-04).

**Read-all policy** (`full-schema.sql:3944`):
```sql
CREATE POLICY model_overrides_read_all ON public.model_capabilities_overrides
  FOR SELECT TO authenticated USING (true);
```
  → `roles_read_all` and `role_permissions_read_all` are byte-identical (`FOR SELECT TO authenticated
  USING (true)`), with **NO write policy** = INSERT/UPDATE/DELETE denied to every JWT; only the seed
  migration (service-role / SQL editor, which bypasses RLS) writes them. Confirmed idiom: mig
  `099_model_registry_deprecated.sql:14-16` — *"No RLS policy: migration 053 already ships `FOR SELECT
  TO authenticated USING (true)` on model_capabilities_overrides (read-all), and ... writes are
  service-role only."*

**Composite grant key** (`role_permissions` = `(role, permission_key)`) — analog
`full-schema.sql:1919`:
```sql
ALTER TABLE ONLY public.user_memory
    ADD CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key);
```
  (siblings: `skill_versions_skill_num_unique UNIQUE (skill_id, version_number)` `1855`;
  `workflow_definitions_slug_version_unique UNIQUE (slug, version)` `1943`;
  `todos_thread_todo_unique UNIQUE (thread_id, todo_id)` `1887`) → `role_permissions` uses a composite
  PK `(role, permission_key)` or a `UNIQUE (role, permission_key)`. **`permission_key` is an OPEN
  `text` string, NOT a DB enum** (D-03) — so 167/169 `INSERT` new keys with no schema change.

**Seeded rows (idempotent)** — analog `094_starter_workflows.sql:59-60`:
```sql
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES ('00000000-0000-0000-0000-0000000094c1', 'risk-register', 1, ...)
ON CONFLICT (id) DO NOTHING;
```
  → seed the 4 fixed `roles` + the default `role_permissions` grants (D-02) with **fixed keys +
  `ON CONFLICT DO NOTHING`** = re-paste-safe. Milestone-known permission keys to seed (D-02):
  `org:manage`, `org:audit_view`, `dept:manage`, `org:invite`, `sso:manage`. Default grants:
  super-admin → all; org-admin → `org:*`; dept-admin → `dept:*`; member → baseline (none of the manage
  keys). (12 existing migrations use `ON CONFLICT` — 053/054/056/061/066/087/088/094/097/098/100/102.)

---

### 4-tier `role` enum + `org_invitations.status` — enum-via-CHECK, NOT native enums

**Analog (house style):** this codebase uses `text` columns with a named `CHECK (col = ANY (ARRAY[...]))`
constraint — **it has ZERO native Postgres `CREATE TYPE ... AS ENUM`**. Copy this idiom, not a DB enum
(a DB enum would force `ALTER TYPE` migrations; a CHECK matches the "extensible additively" posture).

- Status enum (`full-schema.sql:686`):
  ```sql
  CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
  ```
- 2-value enum (`full-schema.sql:1409`):
  ```sql
  CONSTRAINT workflow_definitions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
  ```
  → `org_members.role` / `dept_members.role` / `org_invitations.role`:
  `CHECK (role = ANY (ARRAY['super-admin','dept-admin','org-admin','member']::text[]))` (exact tier
  keys = executor discretion per D-03; the **fixed 4-tier** value set lives on `org_members.role`).
  → `org_invitations.status`:
  `CHECK (status = ANY (ARRAY['pending','accepted','expired','revoked']::text[]))` (adoption states, D-06).

---

### nullable `org_id` stub sweep on the remaining user-facing tables (migration DDL, batch)

**Analog (the column shape):** `096_org_id_stub_sweep.sql:18-26` — the precedent for adding a nullable
`org_id uuid` stub with a forward-compat comment:
```sql
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS org_id uuid;
-- ...
COMMENT ON COLUMN public.documents.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v3.3; no FK until org schema exists.';
```
mig 096 deliberately added **NO index** (leaner `harness_audit` shape). **This phase differs:** the
Discretion note says the ~26 newly-stubbed tables get a **plain btree index on `org_id` at creation**
(cheap on all-NULL columns; ready for the 162 backfill + 163 RLS).

**Analog (the btree index):** the DM/v3.0-era `org_id` index — `full-schema.sql:2100-2103`:
```sql
CREATE INDEX idx_classification_rules_org_id ON public.classification_rules USING btree (org_id);
```
  → each newly-stubbed table gets `CREATE INDEX IF NOT EXISTS idx_<table>_org_id ON public.<table>
  USING btree (org_id);`.

> **The exact set of tables to sweep is a plan-time decision — see the "org_id reconciliation"
> section below. The stale "12 stubbed / 26 remaining" counts do NOT match the live head-103 schema
> (which has 13). Derive the sweep set from the live dump, not the research counts.**

---

### `organizations`, `dept_members`, `org_invitations`, `sso_configs` — new content tables + RLS

**Analog (whole-table creation with RLS, recent, idempotent):** `095_operator_foundation.sql` — the
"create net-new tables + ENABLE RLS in the SAME migration" house style, and the closest sibling (the
operator principal is described in CONTEXT as *"the org tables' system-principal counterpart"*).

- **`CREATE TABLE IF NOT EXISTS` + PK/timestamp defaults** (`095:29-50`):
  ```sql
  CREATE TABLE IF NOT EXISTS public.operator_users (
      user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      granted_at timestamptz NOT NULL DEFAULT now(),
      granted_by uuid,
      note       text
  );
  CREATE TABLE IF NOT EXISTS public.operator_audit_log (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ...
      metadata   jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
  );
  ```
  → org tables use `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz NOT NULL
  DEFAULT now()`. **`organizations.settings jsonb NOT NULL DEFAULT '{}'`** (D-01, the SEED-120
  forward-compat home) and **`organizations.add_ons jsonb`** (ENT-01 entitlements — kept SEPARATE from
  `settings`) copy the `metadata jsonb NOT NULL DEFAULT '{}'` shape at `095:47`. Also carry
  `subscription_tier text` from day one (SC#1).

- **`ENABLE ROW LEVEL SECURITY` in the same migration** (`095:62-63`):
  ```sql
  ALTER TABLE public.operator_users      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.operator_audit_log  ENABLE ROW LEVEL SECURITY;
  ```
  (095 is deny-all-by-omission; the org tables instead get the CORRECT membership policies below — D-08.)

- **FK `org_id` → `organizations` with cascade** — analog `full-schema.sql:2653`:
  ```sql
  ADD CONSTRAINT code_executions_thread_id_fkey FOREIGN KEY (thread_id)
      REFERENCES public.threads(id) ON DELETE CASCADE;
  ```
  → every org-scoped new table: `org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE
  CASCADE` (D-05: all 8 tables ship with FK + org_id + indexes from creation). NOTE: this is a **real FK
  from creation** on the 8 NEW tables — distinct from the nullable/no-FK stub on the existing tables.

- **Membership-gated CRUD policies** — copy the `skills` owned-table 4-policy set, swapping the
  `auth.uid() = user_id` predicate for the helper `org_id IN (SELECT public.current_user_org_ids())`
  (read = member; write = role-gated per the permission catalog, D-10):
  ```sql
  CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));  -- full-schema.sql:3645
  CREATE POLICY "Users can insert own skills"          ON public.skills FOR INSERT WITH CHECK ((auth.uid() = user_id));                    -- :3433
  CREATE POLICY "Users can update own skills"          ON public.skills FOR UPDATE USING ((auth.uid() = user_id));                         -- :3559
  CREATE POLICY "Users can delete own skills"          ON public.skills FOR DELETE USING ((auth.uid() = user_id));                         -- :3300
  ```
  Two naming conventions coexist in-repo — human-readable double-quoted (`"Users can view own and
  global skills"`) and snake_case (`todos_select_own`, `workflow_phases_delete_own`). Recent migrations
  (095/097/098) lean snake_case; executor discretion.

- **`updated_at` maintenance** (if org tables carry `updated_at`) — the shared trigger, NOT app code:
  function `set_updated_at()` `full-schema.sql:273-280` wired per-table at `2509`:
  ```sql
  CREATE TRIGGER folders_set_updated_at BEFORE UPDATE ON public.folders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  ```

- **`org_invitations` near-complete shape (D-06):** `org_id`, `email text`, `role` (4-tier CHECK),
  `token_hash text`, `status` (CHECK enum above), `expires_at timestamptz`, `invited_by uuid`,
  `created_at`/`updated_at`. Phase 167 adds only app-layer provider wiring — no churny rewrite.

---

## Shared Patterns

### Migration apply-discipline header (every migration)
**Source:** `099_model_registry_deprecated.sql:18-26`, `101_skill_files_unique_index.sql:19-32`,
`094_starter_workflows.sql:50-54`
**Apply to:** the top-of-file comment block of `104_*.sql`
Every migration opens with a comment block stating: apply by pasting into the **LOCAL Supabase SQL
editor** (NEVER `db push`/`db reset`), idempotent/safe-to-re-run, THEN
`bash scripts/regenerate-full-schema.sh` (no `--reset`) + commit the migration **and** `full-schema.sql`
together, NEVER hand-edit `full-schema.sql`, filename digits-only (letter suffix is silently skipped),
and a CLOUD-PARITY line (migrations 099/100/101 are already pending on cloud — defer, do not touch cloud
now). **Deployment-artifact same-commit parity** (CLAUDE.md / Phase-158 D-16): a seed-bearing migration
touches the `docs/OPERATOR.md` Step-3 seed list — check `scripts/check-deploy-drift.sh`.

### RLS-policy idempotency idiom (load-bearing nuance)
**Source:** `015_global_folder_document_rls.sql:4`, `019_...:38,52`, `029_storage_buckets.sql:22+`,
`030_missing_tables.sql:29+`
**Apply to:** every `CREATE POLICY` on the 8 new tables
`CREATE POLICY` has **no `IF NOT EXISTS`** — a re-paste of a bare `CREATE POLICY` errors `42710`
("policy already exists"). New-table migrations (077/079) get away with bare `CREATE POLICY` only
because a fresh table has no prior policy — but that breaks the **re-paste-safe** requirement
(Discretion) on re-run. Honor idempotency with the established idiom:
```sql
DROP POLICY IF EXISTS org_members_self_select ON public.org_members;
CREATE POLICY org_members_self_select ON public.org_members FOR SELECT TO authenticated USING (user_id = auth.uid());
```

### Idempotency guards (DDL)
**Source:** `095:29,39` · `096:18` · `099:30` · `101:34`
**Apply to:** all DDL
`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
`CREATE UNIQUE INDEX IF NOT EXISTS`, **`CREATE OR REPLACE FUNCTION`** (for the helper), and
`INSERT ... ON CONFLICT (...) DO NOTHING` (for seeds). Together these make the whole SQL-editor-paste
re-runnable as a recovery step (CONTEXT Discretion).

### SECURITY DEFINER hardening
**Source:** `full-schema.sql:97-99` (`folder_is_globally_visible`), `120-123` (`handle_new_user`),
`54-56` (`capture_skill_version`)
**Apply to:** `current_user_org_ids()` and any `create_org_with_default_dept()` helper
Every SECDEF function pins `SET search_path TO 'public'` (or `'public','pg_temp'`). A SECDEF body
without a pinned search_path is a standard security finding — 164's two-org isolation suite (TEN-05)
will exercise these functions.

### Enum-via-CHECK (never native `CREATE TYPE`)
**Source:** `full-schema.sql:686, 1409, 606, 913` (+ ~18 more `_check CHECK ((col = ANY (ARRAY[...])))`)
**Apply to:** `*.role` (4 tiers), `org_invitations.status`
The repo has zero native enums; every constrained-vocabulary column is `text` + a named CHECK.

---

## org_id reconciliation — CRITICAL DISCREPANCY (planner MUST reconcile against live schema)

**Flag:** the research base cites "12 stubbed / 38 user-facing / ~26 remaining"; a fuzzy grep suggests
"~14." **The ACTUAL count in `full-schema.sql` at head 103 is 13 tables carrying an `org_id` column** —
matching neither figure. Derive the sweep set from the live dump, not the stale counts.

**The 13 tables that ALREADY have `org_id`** (column line in `full-schema.sql`):

| Table | `org_id` col | Has btree index on `org_id`? |
|---|---|---|
| `classification_rules` | 528 | **yes** — `idx_classification_rules_org_id` (2103) |
| `document_relationships` | 601 | **yes** — `idx_...` (2117) |
| `document_views` | 643 | **yes** — `idx_...` (2145) |
| `documents` | 685 | no (mig 096 leaner shape) |
| `folders` | 843 | no |
| `harness_audit` | 864 | no |
| `metadata_field_definitions` | 933 | **yes** — `idx_...` (2250) |
| `operator_audit_log` | 984 | no (mig 095) |
| `skills` | 1287 | no |
| `threads` | 1311 | no |
| `workflow_definitions` | 1405 | no |
| `workflow_phases` | 1438 | no |
| `workflow_runs` | 1462 | no |

> **Secondary inconsistency to note:** only **4 of the 13** existing `org_id` columns carry a btree
> index (the DM/v3.0-era columns); the other 9 do not (the leaner `096`/`095` `harness_audit` shape —
> see `096_org_id_stub_sweep.sql:6-8` "RESEARCH INDEX TENSION" flag). Since this phase's Discretion says
> the newly-stubbed columns DO get a btree index, the migration's new indexes will be shape-consistent
> with the 4 DM-era columns but shape-INconsistent with the 9 un-indexed existing ones. The planner may
> optionally backfill `idx_<t>_org_id` on those 9 for uniformity (cheap on all-NULL) — but that is not
> required by CONTEXT and can defer.

**The 29 tables WITHOUT `org_id`** (42 `CREATE TABLE` total − 13) — the raw candidate pool the planner
narrows to the "~26 user-facing" sweep set:

`app_settings`(408†), `audit_log`(511), `code_executions`(549), `document_chunks`(564‡),
`document_images`(582), `document_tables`(622), `eval_ratings`(701), `eval_results`(723),
`eval_runs`(782), `message_feedback`(881), `messages`(897), `model_capabilities_overrides`(956†),
`operator_users`(1000†), `pdf_extraction_runs`(1012), `profiles`(1030†), `runs`(1043),
`sandbox_files`(1081), `skill_embeddings`(1096‡), `skill_files`(1118), `skill_proposals`(1134),
`skill_publish_overrides`(1205), `skill_test_cases`(1227), `skill_versions`(1251), `todos`(1326),
`tuner_runs`(1344), `user_memory`(1369), `user_settings`(1383), `workspace_file_versions`(1529),
`workspace_files`(1545).

**Planner exclusion guidance (derive final set at plan time):**
- **† system / identity, NOT user-facing → exclude from the sweep** (4): `app_settings`,
  `model_capabilities_overrides` (both global config), `operator_users` (deliberately org-agnostic per
  `095:5-8` — stubbing `org_id` here would "poison the one-way door"), `profiles` (1:1 with
  `auth.users`, user identity).
- **‡ Phase-163-DEFERRED → exclude here** (2): `document_chunks`, `skill_embeddings` — the CONTEXT
  Out-of-Scope + Deferred both route their `org_id` **denormalize + composite index** to Phase 163
  (TEN-04, the perf-gated crux). Do NOT plain-stub them in 161.
- **Child tables inherit org via parent FK** (mig `096:11` convention) — e.g. `messages`→`threads`,
  `document_images`/`document_tables`→`documents`, `skill_files`/`skill_versions`→`skills`. Whether to
  additionally stub each child's own `org_id` is a plan-time judgment (163's RLS may want a denormalized
  `org_id` on hot child tables to avoid a join-per-row; but 096 chose NOT to stub children). **The
  CONTEXT's "~26" strongly implies a broad sweep** (29 − 3 system tables ≈ 26), so the intent is likely
  "stub nearly everything user-facing including children EXCEPT the two 163-deferred embedding/chunk
  tables and the system/identity tables." Confirm the exact list with the operator or against the live
  schema before writing the ALTER block.

**Net:** 29 candidates − 4 system/identity − 2 Phase-163-deferred ≈ **23-26 tables** to stub in this
migration. This reconciles the "~26" research figure once the correct baseline (13, not 12) and the
exclusions are applied.

---

## No Analog Found

| DB object | Role | Data Flow | Reason |
|---|---|---|---|
| `sso_configs` SAML/IdP columns | table | CRUD | **By design.** Supabase Auth IS the SAML SP — the certs/IdP-metadata/XML live in `auth.sso_providers` / `auth.saml_providers` (Supabase-owned), NOT our app (D-07). No in-repo SAML schema exists to copy. Ship THIN: `org_id`, `email_domain text`, a nullable pointer to the Supabase SSO provider id, `attribute_mapping jsonb`, timestamps. Phase 168 reveals the real shape live — don't guess SAML columns now. (The table's RLS/FK/`org_id`/index shell DOES have an analog — use `skills`/`095` as above; only the SAML column depth is analog-free.) |
| `organizations.settings jsonb` / `add_ons jsonb` **semantics** | column | n/a | The `jsonb NOT NULL DEFAULT '{}'` **shape** has an analog (`operator_audit_log.metadata` `095:47`; `app_settings` jsonb columns). What has no analog is a per-ORG config/entitlement container — this is net-new (SEED-120 forward-compat home). BYO-key VALUES inside `settings` will later reuse the SEC-01 `enc:v1:` MultiFernet envelope (`backend/app/security/secret_cipher.py`) — but that is v3.5; 161 only reserves the column. No new crypto, no reader in v3.4. |

---

## Metadata

**Analog search scope:** `supabase/full-schema.sql` (head 103, 4421 lines — targeted reads only),
`supabase/migrations/09*.sql` + `10*.sql` (recent table-creation / stub / seed / index migrations),
`supabase/migrations/{015,019,029,030}.sql` (RLS-policy idempotency idiom).
**Files scanned:** ~10 (1 schema dump via targeted offset reads + 4 full migration reads + grep sweeps).
**Pattern extraction date:** 2026-07-18
