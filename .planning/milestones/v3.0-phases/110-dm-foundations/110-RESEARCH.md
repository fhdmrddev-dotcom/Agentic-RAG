# Phase 110: DM Foundations - Research

**Researched:** 2026-06-15
**Domain:** Postgres schema substrate + audit-enum lockstep + RLS discipline + an `app_settings` capability flag (pure backend, no UI, no route, no tool)
**Confidence:** HIGH (every load-bearing claim re-anchored to live source by file:line this session; the few uncertainties are flagged explicitly in Open Questions)

> This is a substrate-only phase. There is NO ecosystem survey here — STACK.md already confirmed near-zero new dependencies and that holds: everything in this phase is `CREATE TABLE` / `ALTER TABLE` / RLS policies / a `boolean` column / a `~25-line` boot check + a CI test. The research below is an *internal precedent study*: it pins the EXACT current state to extend and the EXACT shapes to mirror, so the planner copies proven patterns rather than inventing them.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-110-1 — Audit action types: land the FULL DM set now (8).** Bake all 8 DM audit action types into the CHECK enum AND `VALID_ACTION_TYPES` this phase, not just the SC-required minimum 4. The 8 exact strings (dot-namespaced):
1. `view.create` *(SC-required)*
2. `view.delete`
3. `relationship.create` *(SC-required)*
4. `relationship.delete`
5. `classification.apply` *(SC-required)*
6. `classification.rule.create`
7. `metadata.update` *(SC-required)*
8. `metadata.field.create`

Takes the live CHECK from **11 → 19** total. Additively extensible later (a genuine 9th need = additive CHECK extension, never a re-migration of the closed constraint).

**D-110-2 — Capability flag gates net-new SURFACES + TOOLS only (not enrichment).** One master `app_settings` boolean flag, default **on**, gates the net-new DM surfaces/tools shipped in 113–119. Phase 111's metadata-enrichment change stays reversible via its OWN setting/default — deliberately NOT behind this master flag (avoids entangling the hot ingestion path / Deep / agent-loop). In Phase 110 the flag is only **defined + a read-helper landed**; nothing observable is gated yet. Default-on → byte-identical behavior when unset. Recommended key: `document_management_enabled`.

**D-110-3 — Tables ship with their FULL known column set now.** Create each of the 4 tables with every column the architecture research specified (ARCHITECTURE.md per-feature DDL), so 111–119 add behavior, not schema. Every table: `id uuid PK`, `user_id uuid` (FK `auth.users` ON DELETE CASCADE; nullable only on `metadata_field_definitions` where NULL = global/admin), nullable `org_id uuid` (no FK), RLS enabled.

**D-110-4 — Drift guard fails at BOTH boot and CI.** `VALID_ACTION_TYPES ⊆ live-DB CHECK enum` assertion fires in two places: (1) **Boot** — a lifespan startup assertion (hard-fail, mirroring the 075.4 `UnknownProviderError`-at-startup pattern; home = the Phase-081.1 "after asyncpg pool init" check block in `main.py`). (2) **CI** — a test asserting the same subset relationship. No existing boot-time subset assertion today (genuinely net-new). The harness `_AUDIT_EVENT_TYPES` frozenset is a SEPARATE sync pair — pattern to imitate, NOT reuse.

### Claude's Discretion

- Exact flag key name + read-helper placement (recommend `document_management_enabled`).
- Single migration file (`071_dm_foundations.sql` covering all 4 tables + audit-enum DROP/ADD + `org_id` columns + the flag column) vs splitting — recommend **one** numbered migration `071_…` (next free number is 071, highest applied is 070). Flag default can ride the migration (column DEFAULT true) or live as a code default — planner decides.
- Whether to add a btree index on `org_id` now (cheap forward-compat) — recommend yes, but non-blocking.
- The 4 tables carry no new audit types for their own CRUD beyond the 8 in D-110-1; extend additively if the planner finds a genuine gap.

### Deferred Ideas (OUT OF SCOPE)

- Entitlement/tier **enforcement** on the capability flag → SEED-080, v3.2 Operator UX. 110 ships only the seam.
- Real multi-tenancy / org-scoped RLS → v3.3. 110 ships only the nullable `org_id` column + a re-keyable policy shape.
- Auditing the creation of views/rules/fields beyond the 8 types (e.g. `view.update`, `classification.rule.delete`) — additively extensible later; not pre-landed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md verbatim) | Research Support |
|----|-------------|------------------|
| **DMF-01** | New DM actions (view created, relationship added/removed, classification applied, metadata edited) are recorded in the immutable audit log. *(closes the closed-CHECK-enum silent-reject trap; verify live, not with mocks)* | §1 (exact current CHECK + frozenset, 11 types verified), §"The audit lockstep + swallow trap", §"Validation Architecture" SC#4 live round-trip, §"CI drift-guard test" |
| **DMF-02** | All DM data is owner-private or intentionally global-shared with no cross-user leakage, and every new table carries a nullable `org_id` so the v3.3 multi-tenancy rewrite re-keys cleanly. | §2 (verbatim RLS precedents `skills`/`workflow_definitions`), §3 (final DDL per table with RLS + nullable `org_id` no-FK + the verbatim `org_id` comment), §"Security Domain" |
| **DMF-03** | The v3.0 DM capability is gated behind a single feature flag (`app_settings`, default **on**); the flag is the seam SEED-080 plugs into (no enforcement in v3.0). | §5 (full `app_settings` read pattern + `document_management_enabled` column + `UserEffectiveSettings` field + `_val_bool` resolution + read-helper signature), SEED-080 (seam only) |
</phase_requirements>

## Summary

Phase 110 lands the v3.0 Document Management substrate in **one numbered migration (`071`)** plus a small set of backend code edits, and nothing user-visible. The migration creates four RLS-enabled tables (`document_views`, `document_relationships`, `classification_rules`, `metadata_field_definitions`), extends the closed `audit_log.action_type` CHECK from 11 → 19 values, and adds a `document_management_enabled boolean DEFAULT true` column to `app_settings`. The code edits sync the `VALID_ACTION_TYPES` frozenset, add a boot-time + CI drift guard, and expose the flag through the existing settings read path. **Every shape this phase needs already exists in the codebase as a proven precedent** — the work is disciplined copying, not invention.

The single most dangerous failure mode is the one the phase exists to neutralize: `write_audit_entry` **swallows the Postgres `23514` CHECK violation** (`audit_service.py:38-39`), so any audit type present in the frozenset but absent from the live DB CHECK (or vice-versa) fails **silently** — the action succeeds, the user sees success, and the audit row never lands. Mock-based tests false-green this completely (the existing `test_audit.py` is entirely mock-based and would pass against a broken enum). This is the direct D-102 "static would false-green" trap. The acceptance bar (SC#4) is therefore a **live INSERT+SELECT round-trip against local Postgres :54322** for each of the 8 new action types — and the codebase already has the exact precedent for that test (`test_092_harness_audit_live.py`).

**Primary recommendation:** One migration `071_dm_foundations.sql` (4 tables + audit DROP/ADD CONSTRAINT + `org_id` columns + the flag column), applied via the Supabase SQL editor (operator-manual — `autonomous:false`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated `full-schema.sql` together. Sync `VALID_ACTION_TYPES` to the 19 strings in the same commit. Add the boot drift guard between `main.py:231` and `:233` (it must HARD-FAIL — `raise` — unlike the best-effort blocks around it). Add a live SC#4 round-trip test + a CI subset-assertion test, both mirroring `test_092_harness_audit_live.py`'s live-pool harness. Mirror the `skills` table RLS shape (`user_id` + `is_global`) for the four new tables — NOT the `workflow_definitions` shape, which uses `created_by` as its owner column (a subtle trap, see §2).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 4 new DM tables + RLS + `org_id` | Database / Storage | — | Pure schema; RLS is enforced in Postgres, mirroring every existing per-user table |
| Audit CHECK enum extension | Database / Storage | API / Backend | CHECK lives in DB; `VALID_ACTION_TYPES` frozenset lives in `audit_service.py` — two-place lockstep |
| Boot drift guard | API / Backend | Database / Storage | Runs in FastAPI `lifespan` startup; reads the live CHECK via the asyncpg pool |
| CI drift guard | API / Backend (test) | Database / Storage | pytest against live :54322 |
| Capability flag (`document_management_enabled`) | API / Backend | Database / Storage | `app_settings` column read through `UserEffectiveSettings`; no gating logic built yet |

No Browser/Client, Frontend-Server, or CDN tier is touched this phase. This is a single-tier (DB + backend) substrate phase.

---

## 1. The EXACT current state to extend (audit CHECK + frozenset) — VERIFIED

### Current `audit_log.action_type` CHECK — 11 types `[VERIFIED: full-schema.sql:333, this session]`

```sql
-- supabase/full-schema.sql:333 (inside CREATE TABLE public.audit_log, :327-334)
CONSTRAINT audit_log_action_type_check CHECK ((action_type = ANY (ARRAY[
  'document.upload'::text, 'document.delete'::text, 'search.query'::text,
  'code.execute'::text, 'skill.load'::text, 'thread.create'::text,
  'thread.delete'::text, 'settings.update'::text, 'memory.remember'::text,
  'memory.recall'::text, 'feedback.submit'::text
])))
```

Count = **11** (`document.upload, document.delete, search.query, code.execute, skill.load, thread.create, thread.delete, settings.update, memory.remember, memory.recall, feedback.submit`). The "11 → 19" claim in CONTEXT.md is **verified, not assumed.** `[VERIFIED: full-schema.sql:333]`

### Current `VALID_ACTION_TYPES` frozenset — 11 types, in sync `[VERIFIED: audit_service.py:13-19, this session]`

```python
# backend/app/services/audit_service.py:13-19
VALID_ACTION_TYPES = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",   # Phase 33
    "feedback.submit",                    # Phase 39
})
```

Count = **11.** Identical set to the DB CHECK. The two are currently in lockstep. `[VERIFIED]`

> **Line-number drift note:** CONTEXT.md cited `audit_service.py:13` for the frozenset start — confirmed exact. CONTEXT cited `full-schema.sql:333` for the CHECK — confirmed exact. No drift in these two anchors this session.

### Target after Phase 110 — 19 types

Add the 8 D-110-1 strings to BOTH places: `view.create, view.delete, relationship.create, relationship.delete, classification.apply, classification.rule.create, metadata.update, metadata.field.create`. New total = **19**.

### The migration idiom (safe to paste into the SQL editor)

The closed CHECK has no in-place "append a value" operation in Postgres; you DROP and re-ADD the named constraint in one transaction. This is exactly the idiom the harness audit migrations already used (059 → 069 → 070 extended `harness_audit.event_type` the same way). `[CITED: workflows.py:40-44 comment documents migrations 059/069/070 extending a CHECK]`

```sql
-- 071_dm_foundations.sql (audit-enum section)
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- existing 11 (preserve verbatim)
    'document.upload','document.delete','search.query','code.execute','skill.load',
    'thread.create','thread.delete','settings.update','memory.remember','memory.recall','feedback.submit',
    -- 8 new DM types (D-110-1)
    'view.create','view.delete','relationship.create','relationship.delete',
    'classification.apply','classification.rule.create','metadata.update','metadata.field.create'
  ]::text[]));
```

`[ASSUMED A1]` — that a plain `DROP CONSTRAINT` + `ADD CONSTRAINT` (not `... NOT VALID` + `VALIDATE`) is acceptable. It is, because there are no existing rows with the new values to validate against (the new values are net-new); the full-table re-validation on ADD only scans existing rows, all of which already satisfy the broader constraint. On a dev DB this is instant. Flag for the planner: if the **production** `audit_log` is large at deploy time, the ADD takes an `ACCESS EXCLUSIVE` lock for the validation scan — acceptable here (dev), note for the prod cutover.

### The audit lockstep + swallow trap (why SC#4 must be live) `[VERIFIED: audit_service.py:32-39]`

```python
# backend/app/services/audit_service.py:32-39
try:
    await aexec(supabase.table("audit_log").insert({
        "user_id": user_id, "action_type": action_type, "metadata": metadata,
    }))
except Exception as exc:
    logger.error("audit write failed [action=%s user=%s]: %s", action_type, user_id, exc)
```

The `except Exception ... logger.error` swallows the `23514` CHECK violation and **returns None normally**. Consequence: a frozenset string that isn't in the live CHECK produces a silently-dropped audit row. A test that mocks `aexec`/the supabase client (which is what `test_audit.py` does today) NEVER hits the CHECK and false-greens. **This is the exact reason SC#4 demands a live INSERT+SELECT, not a mock.** `[VERIFIED — direct source]`

> **Caller-path note for the planner:** `write_audit_entry` runs through the **supabase-py client** (`aexec` → `run_in_threadpool`), NOT the asyncpg pool. The 8 callers all `ctx.spawn(...)` / pass `write_audit_entry` to `BackgroundTasks.add_task` (`tool_dispatcher.py:233,369,858,907,952`; `documents.py:509,1276`; `threads.py:507,594`; `settings.py:290`; `feedback.py:68`). The CHECK is enforced at the DB regardless of client. The SC#4 live test can use EITHER the asyncpg pool (simplest, like test_092) or supabase-py — both hit the same CHECK. **The test must INSERT a row and then SELECT it back — do NOT call `write_audit_entry` and assert on its return value (it always returns None, even on a swallowed failure).**

---

## 2. The EXACT RLS precedent to mirror — VERIFIED VERBATIM

There are two candidate precedents. **`skills` is the correct one to copy** for the four new DM tables; `workflow_definitions` has a trap.

### The trap: `workflow_definitions` keys on `created_by`, not `user_id` `[VERIFIED: full-schema.sql:720, 1863, 1961, 2052, 2117]`

`workflow_definitions` uses `created_by uuid NOT NULL` as its owner column (`:720`), so its policies read `auth.uid() = created_by`. The four new DM tables use `user_id` (per D-110-3), so copying `workflow_definitions`' policy text verbatim would reference a non-existent column. **Use `skills` as the template** (it keys on `user_id` + `is_global`, exactly the DM shape) and borrow only the global-INSERT-forcing `WITH CHECK` clause from `workflow_definitions`.

### `skills` RLS — the per-user + is_global precedent (the one to copy) `[VERIFIED, this session]`

```sql
-- supabase/full-schema.sql — skills policies (user_id + is_global shape)
-- SELECT (:2110): own OR global
CREATE POLICY "Users can view own and global skills" ON public.skills
  FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));
-- INSERT (:1954): own only — NOTE: skills does NOT force is_global=false here
CREATE POLICY "Users can insert own skills" ON public.skills
  FOR INSERT WITH CHECK ((auth.uid() = user_id));
-- UPDATE (:2045): own only
CREATE POLICY "Users can update own skills" ON public.skills
  FOR UPDATE USING ((auth.uid() = user_id));
-- DELETE (:1856): own only
CREATE POLICY "Users can delete own skills" ON public.skills
  FOR DELETE USING ((auth.uid() = user_id));
```

### `workflow_definitions` — the global-INSERT-forcing precedent (borrow the WITH CHECK) `[VERIFIED, this session]`

```sql
-- INSERT (:1961): non-admin CANNOT create a global row (is_global forced false)
CREATE POLICY "Users can insert own workflow definitions" ON public.workflow_definitions
  FOR INSERT WITH CHECK (((auth.uid() = created_by) AND (is_global = false)));
-- UPDATE (:2052): same forcing on update
CREATE POLICY "Users can update own workflow definitions" ON public.workflow_definitions
  FOR UPDATE USING ((auth.uid() = created_by))
  WITH CHECK (((auth.uid() = created_by) AND (is_global = false)));
-- SELECT (:2117): own OR global
CREATE POLICY "Users can view own and global workflow definitions" ON public.workflow_definitions
  FOR SELECT USING (((auth.uid() = created_by) OR (is_global = true)));
```

### Recommended per-table RLS shape (translate to `user_id`)

For each of the four new tables (using `user_id` as the owner column):

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global <table>" ON public.<table>
  FOR SELECT USING (((auth.uid() = user_id) OR (is_global = true)));
CREATE POLICY "Users can insert own <table>" ON public.<table>
  FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));   -- borrow the workflow_definitions forcing
CREATE POLICY "Users can update own <table>" ON public.<table>
  FOR UPDATE USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND (is_global = false)));
CREATE POLICY "Users can delete own <table>" ON public.<table>
  FOR DELETE USING ((auth.uid() = user_id));
```

**Two table-specific deviations the planner must handle:**

1. **`metadata_field_definitions` has a NULLABLE `user_id`** (D-110-3: NULL = global/admin field). With a nullable owner column, `auth.uid() = user_id` is NULL (not true) when `user_id IS NULL` — so a global field row is invisible via that clause and is reached only through `OR is_global = true`. That is the intended shape **provided every global field row sets `is_global = true`**. The planner should decide whether to add a table CHECK like `CHECK (user_id IS NOT NULL OR is_global = true)` to prevent an orphan row (user_id NULL AND is_global false = unreachable by RLS). `[ASSUMED A2]` — recommend adding that guard CHECK; it is cheap and prevents a silently-unreachable row class.

2. **`is_global` global-INSERT forcing for non-admins.** There is **no admin role in the DB RLS layer today** — the `workflow_definitions` policy simply forbids ALL users from inserting a global row via the authenticated client (`is_global = false` forced); global rows are seeded by migrations / the service-role key, which bypasses RLS. `[VERIFIED: no admin predicate anywhere in full-schema.sql RLS policies — grep confirms every policy uses `auth.uid() = <owner>` or `is_global`/`folder_is_globally_visible`, none reference a role/claim]`. So "admin determines global" = "global rows are created by the service-role path (migration seed / backend), never by an end-user request." Mirror that: force `is_global = false` in the WITH CHECK; do not build an admin predicate this phase.

> **Forward-compat (Pitfall 7):** Do NOT inline two-valued `is_global` logic into any helper this phase — but since 110 ships no read paths (no RPCs, no queries), there is nothing to route through a helper yet. The re-keyable shape is satisfied by `auth.uid() = user_id` (swappable for `org_membership(...)` in v3.3) + the nullable `org_id` column. `[CITED: PITFALLS.md Pitfall 7]`

---

## 3. The final DDL per table — reconciled (D-110-3 × ARCHITECTURE.md §1–4)

All four use `gen_random_uuid()` (project default, `[VERIFIED: every table in full-schema.sql uses DEFAULT gen_random_uuid()]`), FK to `auth.users(id) ON DELETE CASCADE` `[VERIFIED: the universal owner-FK pattern, e.g. :1580, :1732]`, a nullable `org_id uuid` with **no FK** + the verbatim forward-compat comment `[VERIFIED: full-schema.sql:455/722/755/779 + comment text :734]`, and `ENABLE ROW LEVEL SECURITY`.

### The verbatim `org_id` comment to attach to each new table `[VERIFIED: full-schema.sql:734]`

```sql
COMMENT ON COLUMN public.<table>.org_id IS 'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';
```

(Update "v2.8" → "v3.0" in the new comment for accuracy, or keep verbatim for grep-consistency — planner's call; recommend keeping the phrase grep-consistent and noting the milestone in the migration header.)

### 3.1 `document_views` `[CITED: ARCHITECTURE.md §1 :82-93]` + D-110-3

```sql
CREATE TABLE public.document_views (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid,                                   -- forward-compat, no FK
    name          text NOT NULL,
    filter_expr   jsonb NOT NULL DEFAULT '{}'::jsonb,
    folder_scope  uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    is_global     boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);
```
`folder_scope` ON DELETE **SET NULL** matches `documents.folder_id` precedent (`[VERIFIED: full-schema.sql:1572 documents_folder_id_fkey ... ON DELETE SET NULL]`). A view losing its folder anchor should survive (become unscoped), not vanish.

### 3.2 `document_relationships` `[CITED: ARCHITECTURE.md §2 :105-116]` + D-110-3

```sql
CREATE TABLE public.document_relationships (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id        uuid,                                   -- forward-compat, no FK
    source_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    target_doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    rel_type      text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT no_self_rel CHECK (source_doc_id <> target_doc_id),
    CONSTRAINT document_relationships_rel_type_check
      CHECK (rel_type = ANY (ARRAY['supersedes','amends','references','attached_to']::text[]))
);
```
Both `source_doc_id`/`target_doc_id` ON DELETE **CASCADE** to `documents.id` matches the `document_chunks`/`document_images`/`document_tables` precedent (`[VERIFIED: :1524, :1540, :1556 all REFERENCES documents(id) ON DELETE CASCADE]`). Deleting a doc drops its links (acceptable per ARCHITECTURE.md §2 — audit it via `relationship.delete` if the planner wires a trigger, but no trigger is required this phase). `rel_type` is a closed CHECK = the same enum-extension discipline as `audit_log` — additive only.

### 3.3 `classification_rules` `[CITED: ARCHITECTURE.md §3 :129-141]` + D-110-3

```sql
CREATE TABLE public.classification_rules (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id            uuid,                               -- forward-compat, no FK
    name              text NOT NULL,
    match_expr        jsonb NOT NULL,
    suggest_folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
    is_global         boolean NOT NULL DEFAULT false,
    enabled           boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now()
);
```
**DISCREPANCY FLAG:** ARCHITECTURE.md §3 specifies `suggest_folder_id ... ON DELETE CASCADE` (deleting the folder deletes the rule), while CONTEXT.md D-110-3 line 54 says "FK folders" without specifying. CASCADE means deleting a target folder silently destroys the classification rule. **Recommend ON DELETE SET NULL instead** (a rule whose suggested folder is gone should become inert/editable, not vanish — consistent with `document_views.folder_scope`). This is a Claude's-discretion design call the planner should make explicit. `[ASSUMED A3]`

### 3.4 `metadata_field_definitions` `[CITED: ARCHITECTURE.md §4 :153-164]` + D-110-3

```sql
CREATE TABLE public.metadata_field_definitions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,   -- NULLABLE: NULL = global/admin field
    org_id      uuid,                                               -- forward-compat, no FK
    field_key   text NOT NULL,
    field_type  text NOT NULL DEFAULT 'string',
    description text,
    is_global   boolean NOT NULL DEFAULT false,
    enabled     boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
    -- recommend: CONSTRAINT mfd_reachable CHECK (user_id IS NOT NULL OR is_global = true)  -- prevents an RLS-unreachable orphan (A2)
);
```
This is the ONLY table with a nullable `user_id` (per D-110-3). See §2 deviation (1) for the RLS implication and the recommended reachability CHECK.

### Indexes (Claude's discretion, recommend yes)

- **`org_id` btree per table** (D-110-3 / CONTEXT discretion) — cheap forward-compat, non-blocking. Recommend: `CREATE INDEX idx_<table>_org_id ON public.<table> USING btree (org_id);` Matches the `idx_workflow_definitions_created_by` btree-index convention (`[VERIFIED: :1324]`).
- **`user_id` btree per table** — recommend, mirrors `skills_user_id_idx` (`[VERIFIED: :1401]`); every RLS SELECT filters on `user_id`.
- **`document_relationships(source_doc_id)` + `(target_doc_id)` btree** — recommend, the `get_related_documents` tool (Phase 116) will join on these; cheap to land now (PITFALLS.md Performance Traps flags unindexed relationship traversal). Non-blocking for 110 but trivially cheap.

> No GIN index on `filter_expr`/`match_expr` jsonb is needed this phase — those are evaluated by 111+/113+, not 110. Don't pre-optimize a query path that doesn't exist yet.

---

## 4. The boot drift-guard insertion point — VERIFIED EXACT

### Where: `main.py` lifespan, between line 231 and line 233 `[VERIFIED: main.py:205-233, this session]`

The lifespan function is `async def lifespan(app_instance)` decorated `@asynccontextmanager` at `main.py:205-206`. The Phase-081.1 "after asyncpg pool init" block runs at `:225-231`:

```python
# main.py:225-231 — the pool IS guaranteed live after this block
from app.dependencies import get_pg_pool
try:
    await get_pg_pool()  # ensure pool exists before migration
    await _migrate_settings_override()
except Exception as e:
    logger.error("Settings migration failed (app continues with file fallback): %s", e)
```

**Insert the drift guard immediately after line 231** (after the settings-migration block, which already guarantees the pool exists) **and before line 233** (the Phase 091 `_resume_stranded` block). The pool is initialized; the DB is reachable.

> **Line-number drift note:** CONTEXT.md cited `main.py:~115,206` and "lifespan at :206". Verified: lifespan decorator at `:205`, function at `:206`; the `:115` reference is to the `_migrate_settings_override` docstring ("Runs in lifespan after asyncpg pool init") — the actual call site is `:229`, and the pool-init guarantee is `:228`. Use `:231` as the insertion anchor.

### CRITICAL — this block must HARD-FAIL, unlike its neighbors

Every surrounding lifespan block is **best-effort** (Redis ping `:222-223` warns-and-continues, settings migration `:230-231` logs-and-continues, resume sweep `:247-248` logs-and-continues). The drift guard is the **opposite**: it must `raise` to crash startup loudly, mirroring the 075.4 `UnknownProviderError`-at-startup pattern (D-110-4). Do NOT wrap it in a swallowing `try/except`. A drift = a guaranteed silent audit hole in production = exactly what we refuse to ship.

### How to read the live CHECK enum and assert subset

Query `pg_constraint` (more robust than `information_schema`, which doesn't expose CHECK bodies cleanly) and parse the array literal, OR — simpler and equally valid — probe by attempting a constrained read. Recommended approach (read the constraint definition via `pg_get_constraintdef`):

```python
# Sketch — planner refines. Runs at main.py:~232 (after pool init, before resume sweep).
from app.services.audit_service import VALID_ACTION_TYPES
pool = await get_pg_pool()
row = await pool.fetchrow(
    "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint "
    "WHERE conname = 'audit_log_action_type_check'"
)
if row is None:
    raise RuntimeError("audit drift guard: audit_log_action_type_check constraint missing from live DB")
# Extract the quoted 'string' literals from the CHECK body
import re
live_check = set(re.findall(r"'([^']+)'", row["def"]))
missing = VALID_ACTION_TYPES - live_check
if missing:
    raise RuntimeError(
        f"audit drift guard: VALID_ACTION_TYPES not a subset of live audit_log CHECK enum; "
        f"missing from DB: {sorted(missing)}. The migration (071) is not applied to this DB. "
        f"Audit writes for these action types would SILENTLY drop (audit_service.py swallows 23514)."
    )
```

`[ASSUMED A4]` — that `pg_get_constraintdef` returns the array as quoted string literals parseable by `re.findall(r"'([^']+)'", ...)`. This is the standard Postgres rendering (`CHECK ((action_type = ANY (ARRAY['document.upload'::text, ...])))`). The planner should verify the exact rendered text against the live DB during Wave 0 and pin the parse. An alternative that sidesteps parsing entirely: attempt `await pool.execute("SAVEPOINT s; <test each type via a constrained no-op>; ROLLBACK TO s")` — but parsing `pg_get_constraintdef` is cleaner. Note: the guard asserts **subset** (`VALID_ACTION_TYPES ⊆ live CHECK`), per SC#3 — a frozenset type missing from the DB is the dangerous direction (silent drop). The reverse (a DB type not in the frozenset) is harmless (no code writes it) and need not fail boot.

> **Cross-check vs CONTEXT/ARCHITECTURE:** ARCHITECTURE.md §"closed audit_log CHECK enum" and PITFALLS.md Pitfall 2 both prescribe exactly this boot/CI subset assertion. No disagreement with live code. The `_AUDIT_EVENT_TYPES` runtime guard (`workflows.py:730`, `[VERIFIED: raises ValueError at write time]`) is confirmed a **separate** sync pair (it guards `harness_audit.event_type`, not `audit_log.action_type`) — imitate the lockstep discipline, do not reuse the frozenset.

---

## 5. The capability-flag mechanics — VERIFIED against the live `app_settings` path

### The `app_settings` model is column-per-setting, single global row `[VERIFIED: full-schema.sql:259-306]`

`app_settings` has `id text DEFAULT 'global'` PK and one column per setting. Boolean settings with `DEFAULT true` already exist as direct precedents: `sandbox_enabled boolean DEFAULT true` (`:293`), `token_capture_enabled boolean DEFAULT true` (`:303`). The flag column is a drop-in clone of these.

### Recommended column (rides the migration) — D-110-2

```sql
-- in 071_dm_foundations.sql
ALTER TABLE public.app_settings ADD COLUMN document_management_enabled boolean DEFAULT true;
COMMENT ON COLUMN public.app_settings.document_management_enabled IS
  'Phase 110 DMF-03. Master gate for net-new DM surfaces+tools (113-119). Default true => v3.0 behavior unchanged. The seam SEED-080 (v3.2) entitlement enforcement plugs into. NOT entangled with Phase 111 enrichment (D-110-2).';
```
**Recommend the column DEFAULT rides the migration** (not a pure code default) — it's the established pattern for every other `app_settings` boolean (`sandbox_enabled`, `token_capture_enabled` both carry the DB DEFAULT). The single `id='global'` row gets the value automatically; no separate seed INSERT needed (the row already exists; `ADD COLUMN ... DEFAULT true` backfills it). `[VERIFIED: the global row is read via SELECT * FROM app_settings WHERE id='global' at user_settings.py:193]`

### The read path — full chain `[VERIFIED: user_settings.py, this session]`

1. **DB read + 30s TTL cache:** `_load_settings_from_db()` (`:178-204`) does `SELECT * FROM app_settings WHERE id = 'global'` via the asyncpg pool and caches the row dict for 30s.
2. **Resolution to a typed model:** `_build_settings_from_row(row)` (around `:460-499`) maps each column into the `UserEffectiveSettings` Pydantic model using `_val_bool(row, key, env_attr, default)` (`:318-329`) which returns the DB value if non-None else the default. The `sandbox_enabled` line is the exact template: `sandbox_enabled=_val_bool(row, "sandbox_enabled", "sandbox_enabled", True)` (`:473`).
3. **Public read-helpers:** `load_app_settings()` (sync, `:504-511`, reads the cache) and `load_app_settings_async()` (async, `:514-517`, refreshes cache from DB then builds).

### The three edits for DMF-03

1. **Migration:** add the `document_management_enabled` column (above).
2. **`UserEffectiveSettings` model** (`user_settings.py:95`): add a field
   ```python
   # Phase 110 DMF-03 — master DM capability gate (migration 071). Default True => unchanged behavior.
   document_management_enabled: bool = True
   ```
   Place it near `sandbox_enabled` (`:134`) for locality.
3. **`_build_settings_from_row`** (near `:473`): add the resolution line
   ```python
   document_management_enabled=_val_bool(row, "document_management_enabled", None, True),
   ```
   (`env_attr=None` — there is no env-var fallback for this flag; it's app_settings-only per CLAUDE.md "Settings live in user_settings/app_settings ... env vars are for secrets and infra only".)

### The read-helper signature callers use (113–119 will call this; 110 only lands it)

```python
from app.models.user_settings import load_app_settings, load_app_settings_async
# sync (cache-backed):
if load_app_settings().document_management_enabled: ...
# async (cache-refresh):
if (await load_app_settings_async()).document_management_enabled: ...
```

No NEW helper function is strictly required — the existing `load_app_settings*()` already exposes every `app_settings` field through `UserEffectiveSettings`, so `.document_management_enabled` is the helper. **Optional convenience wrapper** (planner's discretion, mirrors `tool_args_progress_emit_boundary_bytes()` at `:545`):

```python
def document_management_enabled() -> bool:
    """Phase 110 DMF-03 — master DM capability gate. Defensive: True on any read failure."""
    try:
        return load_app_settings().document_management_enabled
    except Exception:
        return True   # default-on: a settings read failure must NOT hide DM surfaces
```
The defensive default-True matters: a cold-cache or DB-read failure must keep DM **on** (D-110-2 default-on guarantee), never silently off.

> **DMF-03 "metadata-enrichment change is backward-compatible/reversible":** this clause refers to Phase 111's OWN knob, NOT this flag (D-110-2 explicit). Phase 110 builds NEITHER the enrichment knob NOR any gating logic — it lands only the master flag column + read field. The plan must NOT wire this flag to any surface (none exist) and must NOT touch the enrichment path. `[CITED: CONTEXT.md D-110-2]`

---

## 6. The CI test shape (drift guard + live round-trip) — precedent VERIFIED

Backend tests live in `backend/tests/` (unit-ish, mock-based) and `backend/tests/integration/` (live-DB). `pytest.ini` sets `asyncio_mode = auto`, `testpaths = tests`. `[VERIFIED: pytest.ini:1-3]`

### The gold-standard live-DB harness to mirror: `test_092_harness_audit_live.py` `[VERIFIED, read in full this session]`

This file IS the precedent for "a live audit test that closes a mock blind spot" — its docstring literally says "THIS IS THE TEST THAT CLOSES THE 091 MOCK BLIND SPOT." Copy its harness exactly:

- **DSN:** `os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")` (`:42-45`).
- **Availability guard:** `PG_AVAILABLE = _check_pg_available_sync()` + `pytestmark = pytest.mark.skipif(not PG_AVAILABLE, ...)` (`:48-75`) — skips cleanly (never errors) when :54322 is down, so the suite stays green on a machine without local Postgres.
- **Function-scoped `pg_pool` fixture** (`:82-105`) — REQUIRED to be function-scoped (asyncpg pools are event-loop-bound; pytest-asyncio creates a fresh loop per test). Includes the jsonb type codec init.
- **Seeded throwaway `auth.users` + FK-safe teardown** (`:108-144`) — because `audit_log.user_id` FKs `auth.users(id) ON DELETE CASCADE` (`[VERIFIED: full-schema.sql:1500]`), a real `auth.users` row is required for the INSERT to satisfy the FK.

### SC#4 — live INSERT+SELECT round-trip per action type (the acceptance gate)

New file `backend/tests/integration/test_110_dm_audit_live.py`, mirroring test_092's harness:

```python
# Sketch — for each of the 8 new action types:
@pytest.mark.asyncio
@pytest.mark.parametrize("action_type", sorted(NEW_DM_ACTION_TYPES))  # the 8 D-110-1 strings
async def test_dm_audit_type_round_trips_live(pg_pool, test_thread_user, action_type):
    _thread_id, user_id = test_thread_user
    await pg_pool.execute(
        "INSERT INTO audit_log (user_id, action_type, metadata) VALUES ($1, $2, $3::jsonb)",
        user_id, action_type, json.dumps({"phase": "110", "probe": True}),
    )  # if the CHECK lacks this type, this RAISES CheckViolationError (NOT swallowed here — that's the point)
    row = await pg_pool.fetchrow(
        "SELECT action_type FROM audit_log WHERE user_id = $1 AND action_type = $2",
        user_id, action_type,
    )
    assert row is not None, f"audit row for {action_type} did not land — CHECK enum drift"
    assert row["action_type"] == action_type
    # teardown deletes audit_log WHERE user_id = $1 (add to the fixture's FK-safe cleanup)
```

**Why this is mock-proof:** it INSERTs directly against the live CHECK and SELECTs back. A frozenset/CHECK drift raises `asyncpg.exceptions.CheckViolationError` on the INSERT (the test goes RED), or the SELECT returns None (RED). There is no swallow path here — this is raw asyncpg, not `write_audit_entry`. Add `audit_log` deletion (`DELETE FROM audit_log WHERE user_id = $1`) to the fixture teardown.

> **Optional belt-and-suspenders:** also drive ONE type through the REAL `write_audit_entry` (supabase-py path) and SELECT it back — proves the production code path (not just raw SQL) lands the row. But the raw-asyncpg parametrized test is the load-bearing SC#4 gate.

### SC#3 — CI subset-assertion test (the same logic the boot guard runs)

New file `backend/tests/integration/test_110_audit_drift_guard.py`:

```python
@pytest.mark.asyncio
async def test_valid_action_types_subset_of_live_check(pg_pool):
    """SC#3 CI half: VALID_ACTION_TYPES MUST be a subset of the live audit_log CHECK enum.
    RED on drift — catches a forgotten migration before deploy, without waiting for a boot crash."""
    from app.services.audit_service import VALID_ACTION_TYPES
    row = await pg_pool.fetchrow(
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint "
        "WHERE conname = 'audit_log_action_type_check'"
    )
    assert row is not None, "audit_log_action_type_check missing from live DB"
    import re
    live_check = set(re.findall(r"'([^']+)'", row["def"]))
    missing = VALID_ACTION_TYPES - live_check
    assert not missing, f"VALID_ACTION_TYPES not subset of live CHECK; missing from DB: {sorted(missing)}"
```

Factor the parse+assert into a shared helper (e.g. `audit_service.assert_action_types_synced(pool)`) so the **boot guard and the CI test call the same function** — single source of truth, no drift between the two assertions. Recommended: put the helper in `audit_service.py` next to `VALID_ACTION_TYPES`.

### Keeping it from being mock-masked

- The SC#4 and SC#3 tests live in `integration/` and use the **real `pg_pool`**, never `mock_asyncpg_pool` / `mock_builder` / `mock_execute_result`. The existing `test_audit.py` (mock-based, `tests/test_audit.py`) stays as-is for the API-shape tests but is NOT the SC#4 gate.
- Both skip cleanly via `PG_AVAILABLE` when :54322 is down (so the broader unit suite is unaffected), but the **phase gate requires them GREEN against a live DB with migration 071 applied** — that is the verification bar.

---

## 7. Migration apply + full-schema regeneration sequence (operator steps — autonomous:false)

This is the HARD RULE from CLAUDE.md. The apply step is **manual** (operator pastes into the Supabase SQL editor); the plan task that applies the migration MUST be marked `autonomous:false`. `[CITED: CLAUDE.md "Apply each new migration to the live local DB by pasting it into the Supabase SQL editor — never supabase db push/db reset"]`

**Sequence (one migration, `071_dm_foundations.sql`):**

1. **Author** `supabase/migrations/071_dm_foundations.sql` containing, in one file: the 4 `CREATE TABLE` + RLS enable + policies + indexes, the `audit_log` DROP/ADD CONSTRAINT (19 types), and the `app_settings.document_management_enabled` column. (Filename must match `<digits>_name.sql`; `071` is the next free number — `[VERIFIED: highest applied = 070_harness_validation_gate_library.sql, this session]`. No letter suffixes — `071b` is silently skipped by the CLI.)
2. **Apply (MANUAL, autonomous:false):** operator pastes the full `071_…sql` into the Supabase SQL editor and runs it against the live local DB on :54322. NEVER `supabase db push` / `db reset` (preserves dev data). Wrap the whole migration in a single transaction (`BEGIN; ... COMMIT;`) so a partial failure rolls back cleanly.
3. **Regenerate the bootstrap artifact:** `bash scripts/regenerate-full-schema.sh` (NO `--reset` — defaults to a live-DB schema dump, no reset, preserves data). `[VERIFIED: scripts/regenerate-full-schema.sh header — "Default mode (NO RESET): dumps the schema of whatever your local Supabase DB currently looks like"]`. Never hand-edit `full-schema.sql`.
4. **Sync code in the same commit:** extend `VALID_ACTION_TYPES` to the 19 strings (`audit_service.py:13`); add the boot drift guard (`main.py:~232`); add the `UserEffectiveSettings` field + `_build_settings_from_row` resolution line.
5. **Commit migration + regenerated `full-schema.sql` + code edits together** (one logical change; CLAUDE.md: "Commit migration + regenerated full-schema.sql together").
6. **Run the live tests** (`test_110_dm_audit_live.py`, `test_110_audit_drift_guard.py`) against the now-migrated DB — they must be GREEN.

> **Multi-worker note:** `WORKER_COUNT=2` is the default. The boot drift guard runs per worker; that's fine — it's a read-only assertion, idempotent, and a drift crashes all workers identically (the desired loud failure). No locking needed.

---

## 8. Failure modes to design verification against (what could silently false-green)

| # | Silent false-green | Why it happens | Verification that catches it |
|---|--------------------|----------------|------------------------------|
| F1 | **Migration applied to DB but frozenset NOT synced** (or vice-versa) | Two-place sync; easy to edit one and forget the other | SC#3 CI subset test (RED) + boot guard (crash) |
| F2 | **Audit type written but CHECK rejects it** → row swallowed | `write_audit_entry` swallows `23514` (`audit_service.py:38`) | SC#4 live INSERT+SELECT (raw asyncpg raises CheckViolationError; mock can't) |
| F3 | **`test_audit.py`-style mock test passes against a broken enum** | Mocks never hit the CHECK | Tests MUST use the real `pg_pool`, never `mock_builder`/`mock_execute_result` |
| F4 | **Boot guard wrapped in a swallowing try/except** by copy-paste from its best-effort neighbors | Surrounding lifespan blocks all swallow | Guard must `raise`; a unit test can assert it raises on a simulated missing constraint |
| F5 | **RLS policy copied from `workflow_definitions` references `created_by`** (non-existent column on DM tables) | The two precedents differ in owner column | Copy `skills` (user_id) shape; a live RLS test (two users, cross-user SELECT returns 0 rows) confirms |
| F6 | **`metadata_field_definitions` global row unreachable** (user_id NULL AND is_global false) | Nullable owner + `auth.uid()=user_id` is NULL not true | Recommended reachability CHECK (A2); RLS test that a NULL-user global field is visible |
| F7 | **`org_id` column added but with a FK or NOT NULL** | Over-building tenancy now | Schema assertion: `org_id` is nullable, no FK (matches the 4 workflow-table precedents) |
| F8 | **Flag defaults OFF on read failure** → DM silently hidden despite default-on guarantee | Defensive code returns False on exception | Read-helper returns True on any failure (default-on); test the exception path |
| F9 | **`full-schema.sql` regenerated with `--reset`** (wipes dev data) or hand-edited | Wrong flag / shortcut | Operator step explicitly NO `--reset`; commit diff review |
| F10 | **`ADD CONSTRAINT` re-validation locks a large prod audit_log** | Validation scan takes ACCESS EXCLUSIVE | Dev is instant; flag the prod cutover (A1) — out of scope for 110's local verification but note in plan |

---

## Validation Architecture (MANDATORY — nyquist_validation: true)

The Nyquist principle: prove the substrate works by exercising the **minimum representative set** of action types / tables / RLS paths live, with a concrete observable per check. The two highest-stakes criteria are SC#4 (live audit round-trip) and SC#3 (boot+CI drift guard) — both are unfalsifiable by mocks, which is precisely why the gate is live.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode = auto`) `[VERIFIED: pytest.ini]` |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Live-DB harness precedent | `backend/tests/integration/test_092_harness_audit_live.py` (copy verbatim: DSN, PG_AVAILABLE skipif, function-scoped `pg_pool`, seeded `auth.users` + FK-safe teardown) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/integration/test_110_dm_audit_live.py tests/integration/test_110_audit_drift_guard.py -x` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest -x` |
| DSN | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (env override `POSTGRES_DSN`) `[VERIFIED: test_092:42-45]` |

### Phase Requirements → Test Map
| SC / Req | Behavior | Test Type | Automated Command | File |
|----------|----------|-----------|-------------------|------|
| SC#1 / DMF-02 | 4 tables exist, RLS enabled, each has nullable `org_id` (no FK), `auth.uid()=user_id OR is_global` SELECT shape | integration (schema + RLS) | `pytest tests/integration/test_110_dm_schema.py -x` | ❌ Wave 0 |
| SC#2 / DMF-01 | CHECK enum = 19 types AND `VALID_ACTION_TYPES` = same 19; `full-schema.sql` regenerated | integration (subset both directions) + manual regen | `pytest tests/integration/test_110_audit_drift_guard.py -x` | ❌ Wave 0 |
| SC#3 / DMF-01 | Boot crashes loud when frozenset ⊄ live CHECK; CI test RED on same drift | unit (boot guard raises) + integration (CI subset) | `pytest tests/test_110_boot_guard.py tests/integration/test_110_audit_drift_guard.py -x` | ❌ Wave 0 |
| SC#4 / DMF-01 | Real audit row INSERTs + SELECTs back for EACH of 8 new action types, LIVE | integration (parametrized live round-trip) | `pytest tests/integration/test_110_dm_audit_live.py -x` | ❌ Wave 0 |
| SC#5 / DMF-03 | `document_management_enabled` flag column exists, default true, readable via `UserEffectiveSettings`; default-on when unset | integration (column + read) + unit (default-on on failure) | `pytest tests/integration/test_110_flag.py tests/test_110_flag_default.py -x` | ❌ Wave 0 |

### Sampling Rate (the Nyquist sample — minimum representative set)
- **Per task commit:** the quick run command (the two live audit tests) — proves the enum lockstep at every step.
- **The SC#4 sample is ALL 8 action types, not a subset.** Rationale: each is an independent string in a closed CHECK; one missing from the migration is a silent hole for exactly that action. There is no "representative subset" — the 8 strings are the population, and the parametrized test exercises every one. This is the one place under-sampling = a shipped audit hole.
- **RLS sample (SC#1):** exercise the cross-user path on at least **2 of the 4 tables** plus the nullable-`user_id` global-field path on `metadata_field_definitions` (the only table with the nullable-owner deviation). Two users; user B's SELECT of user A's private row returns 0 rows; user B's SELECT of a global (`is_global=true`) row returns it. The remaining two tables share the identical policy shape — schema-assert their policies match.
- **Per wave merge:** full suite (`pytest -x`).
- **Phase gate:** full suite green (with :54322 up + migration 071 applied) before `/gsd:verify-work`.

### The exact observables that prove PASS
- **SC#4 PASS:** for each of the 8 types, a row is present after INSERT+SELECT against live :54322 (raw asyncpg, not `write_audit_entry`). FAIL = `CheckViolationError` on INSERT or `None` on SELECT.
- **SC#3 PASS:** (a) the CI subset test is GREEN with migration applied and goes RED when `VALID_ACTION_TYPES` has a type absent from the live CHECK; (b) the boot guard raises `RuntimeError` (crashing startup) on a simulated missing constraint — assert via a unit test that constructs the guard against a stub pool returning a constraint def missing one type.
- **SC#1 PASS:** `pg_constraint`/`information_schema` confirms 4 tables with `rowsecurity = true`, each with an `org_id` column that is nullable and has no FK; cross-user RLS test returns the right row sets.
- **SC#5 PASS:** `SELECT document_management_enabled FROM app_settings WHERE id='global'` returns `true`; `load_app_settings().document_management_enabled is True`; the defensive helper returns True on a forced read exception.

### Wave 0 Gaps
- [ ] `tests/integration/test_110_dm_audit_live.py` — SC#4 parametrized live round-trip (8 types) — covers DMF-01
- [ ] `tests/integration/test_110_audit_drift_guard.py` — SC#3 CI subset assertion — covers DMF-01
- [ ] `tests/integration/test_110_dm_schema.py` — SC#1 table existence + RLS-enabled + nullable-no-FK `org_id` + cross-user RLS (2 users) — covers DMF-02
- [ ] `tests/integration/test_110_flag.py` — SC#5 flag column + read through `UserEffectiveSettings` — covers DMF-03
- [ ] `tests/test_110_boot_guard.py` — SC#3 boot-guard-raises unit test (stub pool) — covers DMF-01
- [ ] `tests/test_110_flag_default.py` — SC#5 default-on-on-failure unit test — covers DMF-03
- [ ] Shared helper `audit_service.assert_action_types_synced(pool)` — single source of truth for boot + CI assertion
- [ ] Extend the test_092-style `test_thread_user` fixture teardown to also `DELETE FROM audit_log WHERE user_id = $1`
- [ ] Framework install: none — pytest + pytest-asyncio already present and used by the integration suite

---

## Security Domain (security_enforcement enabled — ASVS L1, block-on-high)

This phase touches RLS (cross-user leakage class) + audit integrity (silent-drop class) + a capability flag. The planner populates the PLAN.md `<threat_model>` block from this.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control (this phase) |
|---------------|---------|-------------------------------|
| V1 Architecture | yes | RLS-on-every-table discipline; nullable `org_id` re-keyable seam (no premature tenancy) |
| V2 Authentication | no | No auth surface added |
| V3 Session Management | no | No session surface |
| V4 Access Control | **yes (primary)** | RLS policies: `auth.uid()=user_id OR is_global` SELECT; `is_global=false` forced on INSERT for non-service-role; per-table owner scoping. The CORE control of this phase. |
| V5 Input Validation | yes (low) | Closed CHECK enums (`audit_log.action_type`, `rel_type`) reject unknown values at the DB. No user-input compiled to SQL this phase (no filter DSL — that's 113). |
| V6 Cryptography | no | No crypto |
| V7 Error Handling / Logging | **yes** | Audit-log integrity: the swallow-on-error (`audit_service.py:38`) is the integrity risk; the drift guard (boot+CI) is the integrity CONTROL that turns a silent 23514 into a loud failure |
| V8 Data Protection | yes | Owner-private DM data; global rows are an explicit share, results still per-caller (no read paths shipped this phase, so no leakage surface yet) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation (this phase) |
|---------|--------|----------------------------------|
| Cross-user read of another user's DM rows | Information Disclosure | RLS `auth.uid()=user_id OR is_global` on all 4 tables; live 2-user RLS test (SC#1). Mirror `skills`, not `workflow_definitions` (owner-column trap). |
| Non-admin creates a global (`is_global=true`) DM row to force-share | Elevation of Privilege | `WITH CHECK ((auth.uid()=user_id) AND (is_global=false))` on INSERT/UPDATE — borrowed verbatim from `workflow_definitions:1961`. Globals are service-role/migration-seeded only (no DB admin role exists). |
| Silent audit drop (governance hole in the feature meant to ADD governance) | Repudiation / Tampering | Drift guard (boot raise + CI RED) + SC#4 live round-trip; the swallow stays (D-05) but can no longer hide a drift |
| `metadata_field_definitions` global row unreachable by RLS (NULL owner + is_global false) | Denial of Service (self-inflicted) | Recommended reachability CHECK `(user_id IS NOT NULL OR is_global=true)` (A2) |
| FK ON DELETE cascade silently destroys links/rules on parent delete | Tampering (data loss) | Documented + intentional: `document_relationships` CASCADE on doc delete (acceptable); recommend `classification_rules.suggest_folder_id` SET NULL not CASCADE (A3) so a rule survives folder deletion |
| `org_id` mis-added with FK/NOT NULL, breaking the v3.3 re-key | (forward-compat correctness) | nullable, no FK — matches the 4 verified workflow-table precedents |

**Block-on-high check:** No HIGH-severity unmitigated threat is introduced by 110 *as a substrate phase* — every read path that could leak (views, relationships, governance) ships in 113–119 under their own secure-phase gates. The one integrity-HIGH (silent audit drop) is directly mitigated by the SC#3+SC#4 controls this phase builds. The RLS-correctness control (V4) is verified live (2-user test), not trusted by label.

---

## Standard Stack

No new dependencies. `[VERIFIED: STACK.md "near-zero new dependencies" + this phase is CREATE/ALTER TABLE + RLS + a boolean column + a ~25-line boot check + pytest tests, all on the existing stack]`

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL (Supabase local) | as-shipped | 4 tables, CHECK enum, RLS, `app_settings` column | The DB substrate; all on :54322 |
| asyncpg | already installed | live-DB tests + boot guard pool read | The project's async DB path; test_092 precedent |
| supabase-py | already installed | `write_audit_entry` path (aexec → threadpool) | Existing audit write path |
| pytest + pytest-asyncio | already installed | live integration + unit tests | `pytest.ini` asyncio_mode=auto; integration suite established |
| Pydantic | already installed | `UserEffectiveSettings` field for the flag | Project rule: Pydantic for structured config |

**Installation:** none.

**Version verification:** N/A — no package added or upgraded this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live-DB test harness | A bespoke psycopg2 connection + manual cleanup | Copy `test_092_harness_audit_live.py`'s `pg_pool` + `test_thread_user` fixtures | Solves loop-binding, PG_AVAILABLE skip, FK-safe teardown, jsonb codec — all already debugged |
| Reading the live CHECK enum | Parsing `information_schema.check_constraints` (renders the body awkwardly) | `pg_get_constraintdef(oid)` from `pg_constraint` | Standard, stable rendering; one query |
| Capability-flag read | A new settings table / env var / bespoke cache | An `app_settings` boolean column + `UserEffectiveSettings` field + `_val_bool` | The established single-global-row settings pattern with a 30s TTL cache already exists |
| Audit-enum extension | An ENUM type / app-side validation only | DROP/ADD the named CHECK constraint (migration) + frozenset sync + drift guard | Matches the harness 059/069/070 precedent; the closed CHECK is intentional hygiene |
| Boot startup assertion | A custom health endpoint / cron | A hard-`raise` in the `main.py` lifespan after pool init | Mirrors the 075.4 UnknownProviderError-at-startup pattern; D-110-4 |

**Key insight:** Every primitive this phase needs is already in the repo as a proven, debugged precedent. The risk here is NOT "how do I build X" — it's "did I sync both halves of the lockstep, and did I verify it LIVE." Design verification against the swallow, not against the happy path.

## Code Examples

All examples above (§1 migration idiom, §2 RLS shapes, §3 DDL, §4 boot guard, §5 flag read, §6 tests) are drawn from live source this session and are the patterns to copy. No external examples needed.

## State of the Art

Not applicable — this is an internal substrate phase, not an ecosystem-tracking one. The only "currency" concern is that line numbers drift; all anchors in this doc were re-verified against HEAD this session (see the inline drift notes).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Plain `DROP CONSTRAINT` + `ADD CONSTRAINT` (not `NOT VALID`+`VALIDATE`) is safe to paste; instant on dev | §1 | LOW on dev (instant). On a large PROD audit_log the ADD takes an ACCESS EXCLUSIVE validation lock — flag for prod cutover, not local verification |
| A2 | A reachability CHECK `(user_id IS NOT NULL OR is_global=true)` on `metadata_field_definitions` prevents an RLS-unreachable orphan row | §2, §3.4 | LOW — recommended guard; without it a `user_id NULL, is_global false` row is silently invisible (not a security hole, a data-integrity papercut) |
| A3 | `classification_rules.suggest_folder_id` should be ON DELETE **SET NULL**, not CASCADE (ARCHITECTURE.md §3 says CASCADE) | §3.3 | MEDIUM — CASCADE silently destroys a rule when its target folder is deleted; SET NULL keeps the rule (inert). Planner should confirm the intended semantics. A real discrepancy between ARCHITECTURE.md and the safer choice. |
| A4 | `pg_get_constraintdef` renders the CHECK array as quoted `'string'::text` literals parseable by `re.findall(r"'([^']+)'", ...)` | §4, §6 | LOW — standard Postgres rendering; Wave 0 should pin the exact rendered text against the live DB and lock the parse (or use the SAVEPOINT-probe alternative) |

> All four assumptions are LOW-MEDIUM risk and confined to design-detail choices the planner finalizes. None affects the core lockstep/RLS/flag mechanics, which are all `[VERIFIED]`.

## Open Questions

1. **`classification_rules.suggest_folder_id` ON DELETE behavior (A3).**
   - What we know: ARCHITECTURE.md §3 DDL says CASCADE; `document_views.folder_scope` and `documents.folder_id` use SET NULL.
   - What's unclear: whether a rule should die with its target folder (CASCADE) or survive inert (SET NULL).
   - Recommendation: SET NULL (a rule is config, not a child of the folder). Planner decides explicitly in the DDL task.

2. **Whether the boot guard should ALSO assert the reverse direction (live CHECK ⊆ frozenset).**
   - What we know: SC#3 mandates `VALID_ACTION_TYPES ⊆ live CHECK` (the dangerous direction — a frozenset type missing from DB = silent drop).
   - What's unclear: a DB type not in the frozenset is harmless (no writer), so failing boot on it would be over-strict.
   - Recommendation: assert subset only (frozenset ⊆ CHECK), not equality. Keep the boot guard tolerant of an extra DB type.

3. **Single migration `071` vs split (CONTEXT discretion).**
   - Recommendation: ONE file `071_dm_foundations.sql`, all changes in one `BEGIN;…COMMIT;`. Atomic apply, single regen, single commit. (CONTEXT D-110 discretion already leans this way.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres :54322 | Migration apply + SC#3/SC#4 live tests | Operator-confirmed at runtime | — | Tests skip via PG_AVAILABLE when down; **migration apply + phase gate REQUIRE it up** |
| Supabase CLI + Docker | `regenerate-full-schema.sh` (pg_dump in container) | Operator env | — | None — required for the regen step (CLAUDE.md) |
| Python venv (backend) | pytest run | Operator starts backend in venv | — | None — project rule |

**Missing dependencies with no fallback:** none at research time — all are operator-environment standard for this repo. The phase gate REQUIRES :54322 up with migration 071 applied (the live tests are the acceptance bar; they skip-not-fail when DB is down, so a green run on a DB-down machine is NOT a pass — the operator must run the gate against the live, migrated DB).

## Sources

### Primary (HIGH confidence — live source re-anchored this session)
- `backend/app/services/audit_service.py:13-19` (frozenset, 11 types), `:32-39` (swallow-on-error) — VERIFIED
- `supabase/full-schema.sql:333` (CHECK, 11 types), `:259-306` (app_settings columns incl. `sandbox_enabled`/`token_capture_enabled` bool DEFAULT true), `:636-646` (skills table), `:712-734` (workflow_definitions table + org_id comment), `:1856/1954/2045/2110` (skills RLS), `:1863/1961/2052/2117` (workflow_definitions RLS), `:1898` (audit_log INSERT-only policy), `:1500/1572/1580/1732/1524-1564` (FK ON DELETE patterns), `:455/722/755/779` (org_id forward-compat columns) — VERIFIED
- `backend/app/main.py:205-233` (lifespan + Phase-081.1 post-pool-init block = insertion point), `:228` (pool-init guarantee) — VERIFIED
- `backend/app/models/user_settings.py:95-165` (UserEffectiveSettings), `:178-204` (`_load_settings_from_db`), `:318-329` (`_val_bool`), `:460-499` (`_build_settings_from_row`), `:504-517` (load_app_settings*), `:545` (helper precedent) — VERIFIED
- `backend/app/db/workflows.py:40-44` (CHECK-extension migration history 059/069/070), `:45` (`_AUDIT_EVENT_TYPES` start), `:730-734` (runtime ValueError guard — SEPARATE pair) — VERIFIED
- `backend/tests/integration/test_092_harness_audit_live.py` (full live-DB harness precedent: DSN, PG_AVAILABLE, pg_pool, seeded auth.users + FK-safe teardown) — VERIFIED
- `backend/tests/test_audit.py` (mock-based — confirms the mock-masking risk SC#4 exists to defeat) — VERIFIED
- `backend/pytest.ini`, `scripts/regenerate-full-schema.sh` header, `.planning/config.json` (nyquist_validation: true), migrations dir (next free = 071) — VERIFIED
- `backend/app/utils/db.py:32` (`aexec` = supabase-py threadpool wrap) — VERIFIED

### Secondary (project research, cited)
- `.planning/research/v3.0-document-management/ARCHITECTURE.md` §1–4 (DDL), §"closed audit_log CHECK enum", §"load-bearing RLS finding" — CITED (DDL source for D-110-3)
- `.planning/research/v3.0-document-management/PITFALLS.md` Pitfalls 2/3/7, "Looks Done But Isn't" checklist — CITED
- `.planning/research/v3.0-document-management/SUMMARY.md`, `STACK.md` (near-zero-deps) — CITED
- `.planning/REQUIREMENTS.md:12-14` (DMF-01/02/03 verbatim), `.planning/seeds/SEED-080-…md` (entitlement seam, enforcement at v3.2) — CITED
- `CLAUDE.md` (migration discipline, settings-in-app_settings, RLS-on-all-tables, no-blocking-I/O) — CITED

### Tertiary (LOW confidence)
- None. This phase had no unverified web/training claims — it is entirely internal-precedent-grounded.

## Metadata

**Confidence breakdown:**
- Audit enum (current state + extension + drift guard): **HIGH** — both halves re-read this session; 11→19 verified; swallow trap confirmed at source; boot insertion point pinned exact; test precedent read in full.
- RLS (the shapes to mirror): **HIGH** — skills + workflow_definitions policies read verbatim; the `created_by`-vs-`user_id` trap surfaced; org_id precedent + verbatim comment confirmed.
- Final DDL: **HIGH** with 2 flagged design discretion points (A2 reachability CHECK, A3 folder FK semantics) — both LOW-MEDIUM and the planner's call.
- Capability flag: **HIGH** — full app_settings read chain traced; direct boolean-DEFAULT-true precedents (sandbox_enabled, token_capture_enabled) identified.
- Validation architecture: **HIGH** — the live-DB harness precedent (test_092) is exact; SC#4-as-all-8-types and the mock-proof raw-asyncpg approach are concrete.

**Research date:** 2026-06-15
**Valid until:** ~2026-07-15 for stack/precedents (stable internal substrate). Re-anchor line numbers at plan time if HEAD advances materially — the inline drift notes flag the anchors most likely to move (main.py lifespan, user_settings.py builder).
