# Architecture Research — v3.4 Multi-Tenancy & Org Access

**Domain:** Retrofitting org multi-tenancy + membership-based RLS onto an existing single-tenant, per-user Agentic RAG platform (FastAPI + Supabase/Postgres/pgvector + Redis)
**Researched:** 2026-07-18
**Confidence:** HIGH (grepped against the live `supabase/full-schema.sql` @ migration head 103; every table/function/policy count is from the real schema, not the stale brief)

> **This file RE-AUTHORS the stale brief** (`.planning/PRDs/v3.3-multi-tenancy.md`, authored 2026-05-10). The brief's headline numbers are OBSOLETE and must not be carried into planning:
> - Brief claims **"18 user-facing tables"** (`brief:14,55,§6`). **REAL count = 38** (see §1). The v2.7–v3.3 pivot (harness, workflow studio, skill-eval studio, DM) roughly doubled the surface.
> - Brief reserves **migration range `075–094`** (`brief:8`). **STALE** — the live migration head is **103**; the next free slot is **104**.
> - Brief says the milestone is **v3.2/v3.3**. Authoritative slot per `PRDs/SEQUENCE.md:21` is **v3.4**.
> - Brief says **4 owned roots** carry the `org_id` stub. **REAL = 12 user-facing tables** already carry it (see §1.2).
>
> The brief's *intent* (§3 Scope, §5 Architecture, §6 Compatibility, §13 Decisions) is sound and mined below; only its schema anchors are re-verified.

---

## 0. Executive orientation — the load-bearing fact

Before any table count, one architectural truth governs the entire milestone, confirmed verbatim in **~10 RLS policy comments** in the live schema:

> "the service-role writer bypasses RLS and the app-code `.eq("user_id", …)` filter is the **real runtime gate**" — `full-schema.sql:3757` (and 3673, 3687, 3701, 3736, 3771, 3792, and the table COMMENTs at 716, 754, 807, 1111, 1163, 1220, 1244, 1269).

**Today, RLS is DEFENSE-IN-DEPTH ONLY, not the boundary.** The backend runs on a single **service-role Supabase singleton** (`dependencies.py:21-25`) that bypasses RLS entirely. The actual per-user isolation is enforced by **253 hand-written `.eq("user_id", …)` filters across 32 files** (grep count) plus a handful of `SECURITY DEFINER` function `WHERE` clauses.

This means the v3.4 rewrite is a **two-front war**, and both fronts must land atomically:

| Front | What must change | Blast radius |
|---|---|---|
| **A — Data layer (RLS)** | Rewrite every RLS predicate from `auth.uid() = user_id` to membership-based; add `org_id`; retire `is_global`. | 38 tables, 110 policies, 6 `is_global` columns, 4 Storage-bucket policy sets, ~9 `SECURITY DEFINER`/scoping functions |
| **B — App layer (the real gate)** | Switch hot paths from the service-role singleton to a **per-request user-JWT client** so RLS becomes load-bearing; the 253 `.eq("user_id")` filters become belt-and-suspenders (or org-aware). Retain service-role only behind hardened `org_id`-requiring wrappers. | `dependencies.py` seam + 32 files |

If only Front A ships, **nothing changes** — the service-role client still bypasses the new predicates. If only Front B ships, RLS still says "owner-only" and blocks legitimate org sharing. They are a single atomic unit (brief `Q-v3.2-08` = atomic rollout; `D-v2.5-11` precedent).

---

## 1. LIVE-SCHEMA RE-INVENTORY (headline deliverable)

**42 tables** exist in the live `public` schema (`full-schema.sql`, grepped `CREATE TABLE public.*`). Of these:

- **38 are user-facing data tables** in the org-RLS-rewrite blast radius (vs the stale brief's "18").
- **4 are non-user-facing** and stay OUT of the core RLS rewrite: `app_settings` (single global config row, `id='global'`), `model_capabilities_overrides` (global model registry), `operator_users` + `operator_audit_log` (org-agnostic system principal, deny-all RLS by design — `mig 095:5-8` explicitly keeps operators org-spanning; `operator_audit_log.org_id` is a future per-org-attribution stub only).

### 1.1 The 38 user-facing tables, by owning root

| # | Table | Owner col | `org_id` stub? | `is_global`? | Scoping approach for v3.4 |
|---|---|---|---|---|---|
| **Owned roots — get a DIRECT `org_id` column + top-level RLS** ||||||
| 1 | `documents` (`:663`) | `user_id` | ✓ mig 096 | via folder | direct `org_id` (backfill NOT NULL) |
| 2 | `folders` (`:835`) | `user_id` | ✓ mig 096 | ✓ `:840` | direct `org_id`; `is_global`→`is_org_shared` |
| 3 | `threads` (`:1302`) | `user_id` | ✓ mig 096 | — | direct `org_id` |
| 4 | `skills` (`:1276`) | `user_id` | ✓ mig 096 | ✓ `:1283` | direct `org_id`; `is_global`→`is_org_shared`; **`is_system` already exists** `:1286` |
| 5 | `workflow_definitions` (`:1395`) | `created_by` | ✓ (v2.8) | ✓ `:1404` | direct `org_id`; `is_global`→`is_org_shared` |
| 6 | `workflow_runs` (`:1456`) | `user_id` (nullable) | ✓ (v2.8) | — | direct `org_id` |
| 7 | `document_views` (`:640`) | `user_id` | ✓ (v3.0) | ✓ `:647` | direct `org_id`; `is_global`→`is_org_shared` |
| 8 | `document_relationships` (`:598`) | `user_id` | ✓ (v3.0) | — | direct `org_id` |
| 9 | `classification_rules` (`:525`) | `user_id` | ✓ (v3.0) | ✓ `:532` | direct `org_id`; `is_global`→`is_org_shared` |
| 10 | `metadata_field_definitions` (`:930`) | `user_id` (nullable) | ✓ (v3.0) | ✓ `:937` | direct `org_id`; `is_global`→`is_org_shared`; `mfd_reachable` CHECK `:941` must widen |
| 11 | `eval_runs` (`:782`) | `user_id` | — | — | direct `org_id` (Studio queries it independently) |
| 12 | `skill_test_cases` (`:1227`) | `user_id` | — | — | direct `org_id` |
| 13 | `skill_proposals` (`:1134`) | `user_id` | — | — | direct `org_id` |
| 14 | `tuner_runs` (`:1344`) | `user_id` | — | — | direct `org_id`; inherits skill-global via EXISTS `:3827` |
| 15 | `user_memory` (`:1369`) | `user_id` | — | — | direct `org_id` (agent memory is per-user-per-org) |
| 16 | `audit_log` (`:511`) | `user_id` | — | — | direct `org_id`; org-admin read via permission |
| 17 | `harness_audit` (`:858`) | `user_id` | ✓ (v2.8) | — | direct `org_id`; org-admin read via permission |
| **Identity / preference — user-keyed, org-membership-aware read** ||||||
| 18 | `profiles` (`:1030`) | `id`=user | — | — | **NO `org_id`** (a person is cross-org); RLS → "self OR shares an org with viewer" |
| 19 | `user_settings` (`:1383`) | `user_id` (PK) | — | — | stays user-keyed; SEED-117 revives `preferences` jsonb `:1387` (dead since mig 011); org-context read only |
| **Child tables — INHERIT org via parent FK (RLS joins to parent)** ||||||
| 20 | `document_chunks` (`:564`) | `user_id` | — | — | **HOT — denormalize `org_id`** (pgvector path, see §2) |
| 21 | `document_images` (`:582`) | `user_id` | — | — | inherit via `documents` |
| 22 | `document_tables` (`:622`) | `user_id` | — | — | inherit via `documents` |
| 23 | `pdf_extraction_runs` (`:1012`) | `user_id` | — | — | inherit via `documents` |
| 24 | `messages` (`:897`) | `user_id` | — | — | inherit via `threads` (REPLICA IDENTITY FULL `:916` — Realtime) |
| 25 | `runs` (`:1043`) | `user_id` | — | — | inherit via `threads`; Redis `run:{id}` implicitly org-scoped |
| 26 | `code_executions` (`:549`) | `user_id` | — | — | inherit via `threads` |
| 27 | `todos` (`:1326`) | **none** (`thread_id`) | — | — | pure inherit via `threads` (no owner col at all) |
| 28 | `sandbox_files` (`:1081`) | `user_id` | — | — | inherit via `code_executions`→`threads` |
| 29 | `message_feedback` (`:881`) | `user_id` | — | — | inherit via `messages` |
| 30 | `skill_files` (`:1118`) | `user_id` | — | — | inherit via `skills`; global branch `:3608` |
| 31 | `skill_versions` (`:1251`) | `user_id` | — | — | inherit via `skills` |
| 32 | `skill_embeddings` (`:1096`) | `user_id` | — | — | **HOT — denormalize `org_id`** (`match_skills` path) |
| 33 | `skill_publish_overrides` (`:1205`) | `user_id` | — | — | inherit via `skills` |
| 34 | `eval_results` (`:723`) | `user_id` | — | — | inherit via `eval_runs` |
| 35 | `eval_ratings` (`:701`) | `user_id` | — | — | inherit via `eval_results` |
| 36 | `workflow_phases` (`:1431`) | **none** (`workflow_run_id`) | ✓ (v2.8) | — | inherit via `workflow_runs` (stub present) |
| 37 | `workspace_files` (`:1545`) | `created_by` | — | — | inherit via `threads` |
| 38 | `workspace_file_versions` (`:1529`) | **none** (`workspace_file_id`) | — | — | pure inherit via `workspace_files` |

### 1.2 The stub-status correction (the brief's biggest error)

**12 user-facing tables already carry an `org_id` column** (grep `org_id` in `full-schema.sql`), not the 4 the orchestrator brief implies:

- **mig 096 (v3.3) added 4 owned roots** — `documents`, `folders`, `threads`, `skills` (COMMENT says "NULL in v3.3").
- **The v3.0 DM + v2.8 harness/workflow era added 8 more** — `classification_rules`, `document_relationships`, `document_views`, `metadata_field_definitions`, `harness_audit`, `workflow_definitions`, `workflow_phases`, `workflow_runs` (COMMENTs say "NULL in v2.8"). Evidence: `mig 096:11-12` itself states *"workflow_definitions / workflow_runs already carry an org_id stub (prior phase) — NOT touched."*
- A 13th stub sits on the **system** table `operator_audit_log` (`:984`).

**Index tension already live in the schema:** the DM-era stubs got `idx_*_org_id` btree indexes (`:2103, 2117, 2145, 2250` — classification_rules, document_relationships, document_views, metadata_field_definitions), but the mig-096 sweep deliberately did NOT (`mig 096:6-8` — "follows the leaner harness_audit shape, not the DM shape"). **The v3.4 RLS rewrite must add `org_id` indexes on every table it filters on** — the missing indexes on the owned roots are a latent perf cliff once RLS predicates start scanning `org_id`.

### 1.3 The `is_global` footprint (6 columns → `is_org_shared` + `is_system_global`)

`is_global boolean` exists on exactly **6 tables**: `classification_rules:532`, `document_views:647`, `folders:840`, `metadata_field_definitions:937`, `skills:1283`, `workflow_definitions:1404`. (`documents` has NO `is_global` — it inherits global visibility through its parent folder via `folder_is_globally_visible(folder_id)`, `:3722`.)

**The `is_system_global` exception is PARTIALLY PRE-BUILT.** `skills.is_system boolean` (`:1286`, added mig 087) already marks the seeded `skill-creator` as a system asset — `mig 087:27` notes *"is_system is write-locked to this migration — no route sets it."* This is precisely the "small system-skills allow-list" the brief wants (`brief:52,314,320`). v3.4 can rename/promote `is_global`→`is_org_shared` and let `is_system` (or a new `is_system_global`) carry the ONE legitimate cross-org visibility for seeded skills — no per-org copy of skill-creator needed.

---

## 2. SECURITY DEFINER function audit (Q2)

Grep `SECURITY DEFINER` across `supabase/` finds **11 functions in the live schema** (plus stale duplicates in old migration files that the full-schema supersedes). Ranked by cross-org leak risk:

| Function (`full-schema.sql`) | Kind | Current isolation gate | Caller | v3.4 rewrite | Risk |
|---|---|---|---|---|---|
| **`match_document_chunks(vector, match_user_id uuid, …)`** `:163-181` | SD RPC | `WHERE dc.user_id = match_user_id` `:172` + JOIN `documents` | `retrieval_service.py:65` | **HIGHEST — the pgvector cross-org leak.** Add `org_id` param; filter `dc.org_id = :org` (denormalized col) OR resolve org from membership inside body. Prefer **SECURITY INVOKER + RLS on `document_chunks`** so isolation is structural. Benchmark: RLS-per-row adds latency; keep an `org_id` partial index next to the HNSW index (`document_chunks_embedding_idx`, `:261`). | 🔴 Critical |
| **`keyword_search_chunks(text, match_user_id uuid, …)`** `:136-156` | SD RPC | `WHERE dc.user_id = match_user_id` `:148` | `retrieval_service.py:87` | **Same class as above — the brief MISSED this one.** Twin of `match_document_chunks` on the keyword/tsvector half of hybrid search. Identical rewrite. | 🔴 Critical |
| **`query_user_documents(sql_query text)`** `:219-241` | plpgsql RPC — **NOT SECURITY DEFINER** | **NONE in the function** — only `SELECT`-only + no-semicolon guards `:229-234`. Runs as the service-role caller (bypasses RLS). The ACTUAL scope is a **regex string-injection in Python** (`sql_service.py:31-68` `_inject_user_id`) that appends `documents.user_id = '{uid}'`. | `kb.py:263` (grep tool) + `sql_service.py:113` | **The text-to-SQL bypass class.** The regex only knows the `documents`/`folders` tables; a CTE/subquery/aliased shape can defeat it → unfiltered read. For org: the injection must become `org_id`-scoped AND membership-checked. **Correct fix = SECURITY INVOKER + real RLS** so a defeated regex still can't cross orgs. | 🔴 Critical |
| **`match_skills(vector, match_user_id uuid, …)`** `:188-205` | SD RPC | `WHERE (s.user_id = match_user_id OR s.is_global = true)` `:201` | `agent_loop.py:1307` | COMMENT `:212` calls itself *"the ONLY cross-user gate."* Rewrite `is_global`→`(is_org_shared AND org_id=:org) OR is_system_global`. Denormalize `org_id` onto `skill_embeddings` for the join. | 🟠 High |
| **`folder_is_globally_visible(p_folder_id uuid)`** `:97-113` | SD, SQL STABLE | recursive ancestor walk → `bool_or(is_global)` | RLS policies: `folders:3631`, `documents:3722` | Becomes `folder_is_org_shared(folder_id, org_id)` — walk ancestors, return true when an ancestor is `is_org_shared` **within the same org**. Keep SECURITY DEFINER (it must read folders across the owner set) but add the `org_id` guard. This is the recursive-CTE that both `folders` and `documents` SELECT policies depend on. | 🟠 High |
| `handle_new_user()` `:120-129` / `:4392-4407` | SD trigger `AFTER INSERT ON auth.users` | n/a (writes `profiles`) | Postgres trigger `on_auth_user_created` | **The JIT / personal-org seam.** Extend to also create the personal `orgs` row + `org_members` row on signup — OR do it app-layer in the signup/SSO-callback path (brief prefers app-layer for SSO attribute mapping, `brief:79`). | 🟡 Provisioning |
| `resize_embedding_column(int)` `:248-266` | SD | n/a (DDL: drops/recreates HNSW index) | re-embed job (`reembed_service.py`) | Operator/maintenance only. No cross-org data path; leave SD, gate behind operator/org-admin. | 🟢 Low |
| `capture_skill_version()` `:54-90` | SD trigger on `skills` | writes `skill_versions` w/ `NEW.user_id` `:83` | trigger | Must ALSO copy `NEW.org_id` into the version row once `skill_versions.org_id` exists. | 🟢 Low |
| `stale_skill_embedding()` `:303-317` / `stale_skill_embedding_from_case()` `:324-332` | SD triggers | delete `skill_embeddings` by `skill_id` | triggers | Internal cache-invalidation; no cross-org path. No change beyond inheriting `org_id`. | 🟢 Low |

**Non-SD trigger functions** (`set_updated_at:273`, `update_search_vector:339`, `skill_versions_block_mutation:287`, `view_iso_to_date:353`, `workflow_definitions_block_published_update:375`) carry no isolation logic. Note `workflow_definitions_block_published_update` **already references `NEW.org_id`** (`:388`) in its immutability check — the org column is already wired into that trigger.

**Storage is a 4th, separate isolation surface** the brief under-weights. Four private buckets (`documents`, `sandbox-outputs`, `skill-files`, `workspace-files`, `:4319-4332`) enforce RLS by **first-path-segment = `auth.uid()`** (`:4337` etc.). The `skill-files` read policy has an `is_global` cross-user branch (`:4366`) that must become org-aware. Since the backend reaches Storage via service-role signed URLs, these policies are also defense-in-depth — but the `is_global` branch is a real cross-org leak once orgs share skills.

---

## 3. Tenancy-model ADR input (Q3) — co-tenant vs isolated vs hybrid

**Recommendation: RATIFY the locked hybrid (D-PRD-02). Do NOT re-litigate.** The evidence in THIS codebase confirms it:

| Model | Fit against this codebase | Verdict |
|---|---|---|
| **Co-tenant** (single Supabase, `org_id` + membership RLS) | The schema is already 1/3 stubbed for it (12 `org_id` columns, §1.2). One Supabase instance, one Redis, one connection pool — matches the current `dependencies.py` singletons. SMB/free-tier viable. | **DEFAULT** |
| **Isolated** (Supabase project per org) | Strongest isolation + data residency, and it maps 1:1 onto the **already-shipped Solo/Team/Enterprise deploy presets** (v3.3 DEPLOY-01/-02, `docs/OPERATOR.md`, one-box compose). The local↔cloud switch is already pure-env-var (`SUPABASE_URL`/`REDIS_URL`), so "same code, customer's instance" needs **zero code**. | **Enterprise, via DEPLOYMENT** |
| **Pure isolated as the co-tenant model** | Would force every SMB onto its own Supabase — operationally infeasible at SMB pricing; fights the 3-tier pricing posture. | **Rejected** (brief §10.5) |

**Why the hybrid is nearly free here:** the co-tenant path is the RLS rewrite (this milestone); the isolated path is *already built* (v3.3 deploy presets + env-var parity). The Phase-0 ADR's job is to **write down that `org_id`+RLS is the co-tenant substrate and the enterprise "isolation" is the existing single-tenant deployment shape re-pointed at a customer Supabase** — i.e., an enterprise install is literally today's app with one org in it. That is the cheapest possible enterprise story and it is already shipping.

**One challenge to surface to the operator (not a blocker):** co-tenant on a **single shared connection pool** means one noisy org can exhaust `POSTGRES_POOL_MAX` (`dependencies.py:98-104`, default 2/10 ×`WORKER_COUNT`) for all orgs. The `org_rate_limits` foothold (brief Theme I) is the right place to note this; enforcement is v3.5. Ops burden of co-tenant is otherwise low (one instance to patch/back up); isolated multiplies ops by customer count — which is exactly why it's enterprise-tier-priced.

---

## 4. RLS predicate rewrite strategy (Q4)

### 4.1 The membership predicate shape

Replace `USING (auth.uid() = user_id)` with a membership-keyed predicate. The general form (per-table tunable, from `brief:57-67`):

```sql
USING (
  org_id = ANY (public.current_user_org_ids())   -- caller is a member of the row's org
  AND (
    user_id = auth.uid()                          -- private to creator within org
    OR is_org_shared = true                       -- shared to all org members
    OR is_system_global = true                    -- the seeded skill-creator ONLY
    -- OR dept_id = ANY(public.current_user_dept_ids())   -- optional dept scope
  )
)
```

**Per-table variants:**
- `messages` / `runs` / `threads` / `code_executions` / `todos`: **private-within-org only** — no `is_org_shared` branch (conversations aren't org-shared). Child tables (`messages`, `runs`) join to `threads.org_id` rather than carrying their own.
- `documents` / `folders`: keep the recursive `folder_is_org_shared()` branch (rewrite of `:3722`, `:3631`).
- `audit_log` / `harness_audit`: `user_id = auth.uid() OR caller_has_permission('org:audit_view', org_id)` — org-admins read all org rows.
- `skills` / `document_views` / `classification_rules` / `metadata_field_definitions` / `workflow_definitions`: full predicate with `is_org_shared` + `is_system_global`.

### 4.2 The recursive-RLS-on-`org_members` trap + the standard fix

The predicate references `org_members` to resolve "which orgs is the caller in." But `org_members` **itself** needs an RLS policy, and the naive one (`brief:256`) —
```sql
-- ⚠️ RECURSIVE: policy on org_members that SELECTs from org_members
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()))
```
— causes **infinite RLS recursion** (Postgres error `42P17`), the single most common Supabase multi-tenancy footgun.

**Standard fix (recommend both layers):**
1. A **`SECURITY DEFINER` helper** `current_user_org_ids() RETURNS uuid[]` that reads `org_members` **with RLS bypassed** (SD breaks the recursion), marked `STABLE` + `SET search_path`. Every table's predicate calls this instead of an inline subquery. `org_members`' OWN policy uses `user_id = auth.uid()` (self-rows only — no recursion). This mirrors the existing `folder_is_globally_visible` SD pattern (`:97`) the codebase already trusts.
2. Optionally denormalize `org_ids` into a **JWT custom claim** via a Supabase Auth access-token hook, so the predicate reads `(auth.jwt() -> 'org_ids')` with zero DB round-trip. This is the perf play for the hottest tables; the SD helper is the correctness floor. (The org-switcher's `X-Org-Id` header, `brief:91`, is validated against `org_members` server-side regardless.)

### 4.3 Migration bundling (sized for review)

Re-number the brief's 5 bundles onto the **live head (next slot = 104)**. Recommended order + sizing:

- **Additive schema first** (nullable `org_id` everywhere, new org tables) — 1-2 migrations, zero behavior change.
- **RLS bundles, ~4-6 tables each, one DROP+CREATE POLICY transaction per table:**
  - Bundle 1 — documents cluster: `documents`, `document_chunks`, `document_images`, `document_tables`, `pdf_extraction_runs` (+ `match_document_chunks`/`keyword_search_chunks` INVOKER rewrite must ship in the SAME bundle — chunk RLS must exist before the RPC relies on it).
  - Bundle 2 — chat cluster: `threads`, `messages`, `runs`, `code_executions`, `todos`, `message_feedback`, `sandbox_files`.
  - Bundle 3 — skills cluster: `skills`, `skill_files`, `skill_versions`, `skill_embeddings`, `skill_test_cases`, `skill_proposals`, `skill_publish_overrides`, `tuner_runs`, `folders` + `is_global`→`is_org_shared` + `is_system_global` + `folder_is_org_shared()` INVOKER.
  - Bundle 4 — DM cluster: `document_views`, `document_relationships`, `classification_rules`, `metadata_field_definitions`.
  - Bundle 5 — workflow/eval cluster: `workflow_definitions`, `workflow_phases`, `workflow_runs`, `eval_runs`, `eval_results`, `eval_ratings`, `harness_audit`.
  - Bundle 6 — identity/audit: `audit_log`, `user_memory`, `user_settings`, `profiles`.
- **`query_user_documents` INVOKER rewrite** + remove the `sql_service.py` regex — after Bundle 1.

**Every bundle must add an `idx_<table>_org_id`** (the owned roots lack it, §1.2) and preserve the `messages.confidence_*` columns (`D-v2.5-12`) and `messages REPLICA IDENTITY FULL` (`:916`).

### 4.4 `is_global` retirement

Rename `is_global`→`is_org_shared` on the 6 tables (§1.3) via `ALTER … RENAME COLUMN` (preserves values). Add `is_system_global boolean DEFAULT false`; set it TRUE only for the seeded skill-creator (leverage/rename the existing write-locked `skills.is_system`, `:1286`). Update the 6 SELECT policies (`:3617, 3624, 3631, 3638, 3645, 3652`), the `skill_files` (`:3608`) + `tuner_runs` (`:3827`) EXISTS-join policies, and the `skill-files` **Storage** policy (`:4366`).

---

## 5. Service-role singleton → per-request user-JWT client (Q5)

### 5.1 The seam

`backend/app/dependencies.py:18-25`:
```python
_supabase: Client | None = None
def get_supabase() -> Client:                      # ← the singleton, service-role, BYPASSES RLS
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase
```
Wired into nearly every route/service via `Depends(get_supabase)` and passed as the `supabase` arg. **232 `get_supabase`/`create_client`/`service_role` references** across the backend (grep).

### 5.2 What must switch

Introduce a **`get_user_supabase(request) -> Client`** factory that builds a client bound to the caller's JWT (`.postgrest.auth(jwt)` / `create_client(..., anon_key)` + per-request token), so `.execute()` runs under the user's identity and the new RLS is enforced. Switch **hot read/write paths** to it. The `.eq("user_id")` density map (grep) shows where the work concentrates:

| File | `.eq("user_id")` count | Priority |
|---|---|---|
| `api/evals.py` | 69 | high (eval studio) |
| `api/documents.py` | 30 | high (upload/ingest/chunk INSERT) |
| `api/knowledge_health.py` | 19 | medium |
| `api/threads.py` | 18 | **highest — the `send_message` god path + G-5 hot file** |
| `api/skills.py` | 12 | high |
| `api/runs.py` | 10 | high (stream/cancel ownership SELECTs; 404-not-403 invariant `D-062-12` — an RLS-hidden row → 404, which is CORRECT) |
| `services/document_relationship_service.py`, `api/skill_test_cases.py`, `api/folders.py` | 9/9/8 | medium |
| …26 more files | 1-7 each | tail |

Under a user-JWT client, each `.eq("user_id")` becomes **belt-and-suspenders** (RLS already scopes). They don't all have to be deleted — but the client swap is what makes RLS load-bearing.

### 5.3 Where service-role MUST be retained (behind hardened wrappers)

Service-role can't be fully removed — several paths legitimately cross the user boundary:
- **JIT provisioning** (SSO callback / signup): create `auth.users` + `orgs` + `org_members` before the user has a session. (`handle_new_user` trigger `:4392` or app-layer.)
- **Org-admin cross-user reads/writes**: audit-log view across members, member management, invitations.
- **All background/async writes that already bypass RLS**: the streaming agent loop, eval runner, harness engine, re-embed job, `skill_embeddings` backfill, `capture_skill_version` — these run with no `auth.uid()` (COMMENTs at `:807, 1111, 1163` etc. confirm "service-role writes, `.eq` is the gate"). These **keep** service-role but their `.eq("user_id")` filters must widen to org-aware `.eq("org_id")` (or `.in_("org_id", …)`), because RLS won't save them.

**Hardened wrapper pattern:** `get_service_role_supabase(org_id: uuid)` that REFUSES to construct without an explicit `org_id` (brief `RLS-REWRITE-03` / `brief:319`), forcing every cross-tenant op to name the org it's writing to. This is the mitigation for the fact that ~half the writes in this app are async service-role paths where RLS is structurally absent.

---

## 6. Personal-org backfill migration (Q6)

The one-shot data migration that makes "every existing user keeps working, no action required." **Ordering is load-bearing:**

1. **Add columns nullable** — `ALTER TABLE … ADD COLUMN org_id uuid` on every table that lacks one (26 tables; 12 already have the nullable stub). Zero behavior change.
2. **Create org tables** (orgs, departments, org_members, dept_members, roles, role_permissions, org_invitations, sso_configs) with RLS from day 1 (no unprotected window).
3. **Create one personal org per user** — `INSERT INTO orgs (…) SELECT … FROM auth.users`, `is_personal=true`, slug `personal-<short_id>`; one default department; one `org_members` row with the personal-org-admin role, `joined_via='personal_auto'`.
4. **Backfill `org_id`** on every table: `UPDATE <t> SET org_id = (SELECT om.org_id FROM org_members om WHERE om.user_id = <t>.user_id AND om.joined_via='personal_auto' LIMIT 1) WHERE org_id IS NULL`. For **owner-less child tables** (`todos`, `workflow_phases`, `workspace_file_versions`) resolve org_id through the parent FK, not `user_id`. For `workflow_definitions`/`workspace_files` use `created_by`, not `user_id`.
5. **Flip NOT NULL** per table AFTER backfill (`ALTER … SET NOT NULL`) + attach the FK to `orgs(id)`.

**Idempotency:** every step keyed on `WHERE org_id IS NULL` / `ON CONFLICT DO NOTHING` / `ADD COLUMN IF NOT EXISTS` — re-runnable (matches the existing mig 087/096 idempotent idiom, and the project's SQL-editor-apply rule: never `db push`/`db reset`).

**Transactional batching to avoid lock storms:** the biggest tables (`document_chunks`, `messages`, `eval_results`) can be large. Batch UPDATEs in ~10k-row windows (`WHERE org_id IS NULL … LIMIT 10k` loop) rather than one table-locking UPDATE. Apply during a low-traffic window; this is a maintenance-mode candidate (v3.3 already ships `maintenance_mode`, `app_settings.maintenance_mode:467`).

**Skill-creator special case:** the seeded global skill-creator (`is_system=true`, `:1286`) should get `is_system_global=true` and does NOT need per-personal-org duplication (its whole point is cross-org visibility) — brief `:314,320`.

---

## 7. Permission-aware RAG (Q7) — CORE vs STRETCH

**Assessment: STRETCH, and cleanly separable. The org-isolation rewrite does NOT depend on it, and vice-versa.**

Two different questions, often conflated:
- **Org isolation of retrieval** (CORE, this milestone): "can org A's query ever return org B's chunk?" — closed by the `match_document_chunks`/`keyword_search_chunks` INVOKER rewrite + `document_chunks.org_id` (§2). This is non-negotiable and lands in RLS Bundle 1.
- **Intra-org folder-level ACL** (STRETCH): "within one org, does retrieval only cite folders THIS member may see?" — the Glean model. This threads folder-scope through more places:

| Integration point | Evidence | Effort |
|---|---|---|
| `retrieval_service.search_documents(folder_ids=…)` already accepts a folder scope | `retrieval_service.py:263, 292-298` | scope already plumbed; ACL just narrows the `folder_ids` set |
| `match_document_chunks` / `keyword_search_chunks` already take `p_folder_ids` | `:163, 176` / `:136, 152` | additive |
| Folder-visibility resolution exists **twice** — SQL `folder_is_globally_visible` (`:97`) AND Python `is_in_global_subtree`/`get_globally_visible_folder_ids` (`folder_utils.py:18-55`) | both must become dept/role-ACL-aware | **the real cost — two implementations to keep in sync** |
| Workflow KB folder-scope (SEED-112) binds a workflow to a folder subtree | workflow run scope | inherits the same ACL resolver |
| **CITE-01** per-claim citations key to the real retrieval set | v3.3 CITE-01 (`PROJECT.md:88`) | if retrieval is already ACL-filtered, citations are correct **for free** — the citation layer reads whatever retrieval returned |

**Why STRETCH and first-to-cut:** folder-level ACL needs the dept/role model *fully* wired (roles → folder grants), which is the last thing to stabilize. Org isolation gives 90% of the enterprise value (cross-tenant safety); intra-org folder ACL is a within-trust-boundary refinement. Ship org isolation as CORE; gate folder ACL behind the dept/role tables landing, and cut it first if the milestone runs long. The retrieval seam is already ACL-ready (`folder_ids` param), so it can be added later without re-plumbing.

---

## 8. Suggested build order / phase decomposition (Q8)

Dependency-aware, honoring the two-front atomicity and the existing verification discipline. Migration numbers start at the **live head + 1 = 104**.

```
Phase 0  ADR ratification (no code) ─ writes down co-tenant-default + isolation-via-deployment;
         confirms is_system→is_system_global reuse; locks the migration re-numbering (104+).
   │
Phase 1  SCHEMA-FIRST ADDITIVE ─ org tables (orgs/departments/org_members/dept_members/
   │     roles/role_permissions/org_invitations/sso_configs) w/ RLS from day 1;
   │     + current_user_org_ids() SD helper; + nullable org_id on the 26 tables lacking it.
   │     ZERO behavior change. (This is the safe, reviewable base.)
   │
Phase 2  PERSONAL-ORG BACKFILL ─ create personal orgs + memberships; backfill org_id;
   │     flip NOT NULL + FKs; batched/idempotent (§6). Still no RLS behavior change.
   │
Phase 3  RLS REWRITE (atomic across bundles, its OWN verification harness) ─ Bundles 1-6 (§4.3)
   │     + is_global→is_org_shared + Storage skill-files policy. Ships WITH the service-role→
   │     user-JWT client swap (§5) — Front A + Front B land together or not at all.
   │
Phase 4  SECDEF AUDIT + CROSS-ORG ISOLATION TEST SUITE ─ match_document_chunks +
   │     keyword_search_chunks + query_user_documents → INVOKER; folder_is_org_shared;
   │     a per-table two-org test asserting cross-org SELECT/UPDATE/DELETE = 0 rows,
   │     and match_document_chunks cross-org return count = 0. (Highest-severity gate.)
   │
Phase 5  is_global RETIREMENT CLEANUP ─ frontend labels ("Global"→"Shared with org"),
   │     folder_utils.py Python mirror, remaining EXISTS-join policies. (Can overlap Phase 4.)
   │
Phase 6  ORG-ADMIN SHELL + SWITCHER + PROFILE-MENU ANCHOR (SEED-113) ─ reuses v3.3
   │     Control-Room shell pattern; <OrgContext> provider; X-Org-Id header validated
   │     server-side; role/group feature-visibility + greenlists (SEED-099/115) + revived
   │     user_settings.preferences (SEED-117 §2).
   │
Phase 7  INVITATIONS + ROLES + JIT PROVISIONING ─ email + link invites; role assignment;
   │     org_members lifecycle; extend handle_new_user / signup path for personal-org auto-create.
   │
Phase 8  SSO (SAML 2.0 + OIDC) ─ LAST: biggest external lift (python3-saml/authlib,
         new env vars, IdP config), first-to-cut. Email/password fallback retained.

Research-gated STRETCH (separable, first-to-cut): PERMISSION-AWARE RAG folder ACL (§7).
```

**Ordering rationale:**
- **Schema-additive → backfill → RLS** is forced: you cannot flip `org_id` NOT NULL before backfilling, and you cannot rely on RLS predicates before the column is populated.
- **RLS + client-swap are one phase** because of §0 (RLS alone changes nothing under service-role).
- **SECDEF audit + isolation tests AFTER the RLS rewrite** — the INVOKER rewrites depend on the new `org_id` columns + policies existing (esp. `match_document_chunks` needs `document_chunks` RLS live first).
- **SSO last** — it's the only piece with a heavy external dependency (IdP libraries, CVE-prone SAML XML parsing) and no other phase depends on it; cutting it still ships a usable multi-tenant platform (invitations cover onboarding).
- **Org-admin shell after the data layer** — the UI is meaningless until org isolation is real; it reuses the shipped v3.3 Control-Room shell so it's mostly composition.

---

## 9. Integration points — new vs modified

### New components
| Component | Purpose |
|---|---|
| 8 org tables + `roles`/`role_permissions` | membership-keyed authz model |
| `current_user_org_ids()` SD helper + (opt) JWT org-claim hook | breaks RLS recursion; perf |
| `get_user_supabase(request)` factory (`dependencies.py`) | per-request RLS-enforcing client |
| `get_service_role_supabase(org_id)` hardened wrapper | forces org_id on cross-tenant ops |
| `folder_is_org_shared(folder_id, org_id)` | INVOKER replacement for `folder_is_globally_visible` |
| `backend/app/api/auth.py` (SSO router) | SAML/OIDC + JIT |
| `<OrgContext>` provider + org-switcher + profile-menu anchor | frontend org context (SEED-113) |
| cross-org isolation test suite | the security gate |

### Modified (highest-touch, evidence-anchored)
| File | Change | Anchor |
|---|---|---|
| `dependencies.py` | singleton → per-request user-JWT + hardened service-role wrapper | `:21-25` |
| `retrieval_service.py` | pass user JWT; org-scoped RPCs | `:65, 87` |
| `sql_service.py` | delete `_inject_user_id` regex; rely on INVOKER RLS | `:31-68, 113` |
| `agent_loop.py` | `match_skills` org scope; async writes widen `.eq(user_id)`→org | `:1307` |
| `folder_utils.py` | Python global-subtree mirror → org/ACL-aware | `:18-55` |
| `api/threads.py`, `documents.py`, `evals.py`, `skills.py`, `runs.py`, +27 | user-JWT client; `.eq("user_id")` → belt-and-suspenders | grep (§5.2) |
| 6 `is_global` tables + policies + Storage `skill-files` policy | `is_org_shared`+`is_system_global` | §1.3, `:4366` |
| `handle_new_user()` trigger OR signup path | personal-org + membership creation | `:4392-4407` |

---

## 10. Anti-patterns to avoid (domain-specific)

1. **Trusting RLS while the service-role singleton is still wired.** The #1 trap here: writing beautiful membership policies, deploying, and leaking anyway because `get_supabase()` bypasses them. RLS is inert until Front B (client swap) ships. Every isolation test MUST run through a user-JWT client, not service-role.
2. **Recursive `org_members` policy** (`42P17`). Never `SELECT FROM org_members` inside `org_members`' own policy — use the SD helper (§4.2).
3. **Forgetting the async/background write paths.** ~Half this app's writes are service-role async (agent loop, eval runner, harness, re-embed, embedding backfill). RLS never applies to them; their `.eq("user_id")` filters must become org-aware or they leak cross-org on write.
4. **Scoping only `match_document_chunks` and forgetting `keyword_search_chunks`.** Hybrid search has TWO retrieval halves; the brief named only one. Both are `SECURITY DEFINER` cross-org leaks.
5. **Treating `query_user_documents` as already-safe because it "has a guard."** Its only guard is a Python regex over two table names (`sql_service.py`); a CTE/subquery defeats it. Needs real RLS.
6. **Denormalizing `org_id` onto every child table "for consistency."** Denormalize only the HOT ones (`document_chunks`, `skill_embeddings`); let cold children inherit via parent FK to avoid backfill/consistency burden (matches the mig-096 "children inherit" philosophy).
7. **Per-org copies of the skill-creator.** It's a system asset — one row, `is_system_global=true`. Copying it per personal org re-creates the leak surface and bloats every org.
8. **Big-bang backfill UPDATEs.** A single `UPDATE document_chunks SET org_id=…` table-locks the hottest table. Batch it (§6).

---

## 11. Open questions / gaps for the roadmapper

- **JWT org-claim vs SD-helper-only** for the RLS predicate: the SD helper is the correctness floor; the JWT custom-claim hook is a perf optimization that adds an Auth-hook dependency. Decide per measured latency (Phase 3 verification).
- **`document_chunks.org_id` denormalization vs join-through-`documents`** in `match_document_chunks`: denormalization is faster but adds a backfill + a consistency trigger (org can't change post-creation, so low risk). Recommend denormalize; confirm at plan time.
- **Where personal-org creation lives** — extend the `handle_new_user` SD trigger (SQL-only, atomic with signup) vs app-layer (flexible for SSO attribute mapping). Brief leans app-layer for SSO; the trigger is simpler for email/password. May need both.
- **`profiles` and `user_settings` cross-org semantics** — a person is one identity across orgs; do org-admins see member `profiles`? (Recommend: yes, scoped to shared-org membership.) SEED-117's revived `user_settings.preferences` — per-user or per-user-per-org? (Deferred to v3.5 config pass, but the RLS rewrite touches the table now.)
- **Realtime tenant filtering** — `documents`/`folders`/`messages` are in the `supabase_realtime` publication (`:4414-4421`); Realtime is best-effort (`D-v2.5-03`), reconcile-via-fetch remains canonical. Org filtering at Realtime is best-effort only; the fetch path (now org-RLS'd) is the source of truth.
- **v3.3 cloud-parity debt** — migrations 099–103 + `SECRETS_ENCRYPTION_KEY` are still owed on production (`PROJECT.md:92,118`). The v3.4 migrations stack on top; sequence them after that parity lands.

---

## Sources

- `supabase/full-schema.sql` @ migration head 103 — the live schema (tables, 11 SECURITY DEFINER functions, 110 policies, 4 Storage buckets, JIT trigger). Primary evidence for §1, §2, §4.
- `supabase/migrations/095_operator_foundation.sql`, `096_org_id_stub_sweep.sql` — the shipped org-agnostic operator principal + the 4-root org_id stub sweep (and its note that workflow tables were already stubbed).
- `supabase/migrations/087_skill_creator_reborn.sql` — `skills.is_system` write-locked marker (the pre-built `is_system_global` seed).
- `backend/app/dependencies.py` — the service-role singleton seam (`:21-25`) + asyncpg pool + ban check.
- `backend/app/services/retrieval_service.py` — `match_document_chunks`/`keyword_search_chunks` callers (`:65, 87`).
- `backend/app/services/sql_service.py` — the `_inject_user_id` regex scoping of the non-SD text-to-SQL RPC.
- `backend/app/utils/folder_utils.py` — the Python mirror of the global-subtree logic.
- `.planning/PRDs/v3.3-multi-tenancy.md` — the STALE brief (intent mined from §3/§5/§6/§10/§13; every schema anchor re-verified and corrected).
- `.planning/PRDs/SEQUENCE.md:21` — authoritative slot: v3.4 = Multi-tenancy.
- `.planning/PROJECT.md:94-114` — the operator-approved v3.4 scope cut + one-way-door framing.
- Grep metrics (live): 253 `.eq("user_id")` across 32 files; 232 service-role client references; 42 `CREATE TABLE`; 6 `is_global` columns; 12 user-facing `org_id` stubs.

---
*Architecture research for: v3.4 Multi-Tenancy & Org Access — re-authored against the live schema*
*Researched: 2026-07-18 · Confidence: HIGH*
