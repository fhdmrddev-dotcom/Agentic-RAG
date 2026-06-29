# Phase 132: Skill Versioning + Eval Test-Case Persistence - Research

**Researched:** 2026-06-29
**Domain:** Postgres schema + triggers + RLS (Supabase) / FastAPI CRUD (owner-scoped)
**Confidence:** HIGH (all claims verified against live codebase files)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Capture versions via a **Postgres trigger on the `skills` table** (AFTER INSERT OR UPDATE), NOT app-code in each router. Fires on every write path automatically with zero duplicated app code.
- **D-02:** A new version is created when **any of name / description / instructions changes** (full content trifecta), AND only when at least one *actually* changed (`IS DISTINCT FROM` guard). A `toggle-enabled` / `toggle-global` flip MUST NOT spawn a version.
- **D-03:** Each version row carries a **monotonic `version_number`** (v1, v2, … per-skill as max+1 inside the trigger), `created_at`, and a **`source`** provenance tag (`manual` / `import` / `tuner` / `self_improve` / `backfill`). Snapshot stores name + description + instructions as they were at save time. Append-only — no UPDATE/DELETE of version rows.
- **D-04:** Distinct from the existing workflow-scoped `skill_snapshots` (migration 067). Name the new table `skill_versions`. Do NOT reuse/extend the workflow snapshot machinery.
- **D-05:** New table `skill_test_cases`: `id`, `skill_id` (FK → skills), `user_id` (owner), `prompt` (text), `expected_behavior` (free text), `order_index` (int), `created_at`, `updated_at`. Optional `name`/label fine but not required.
- **D-06:** `expected_behavior` is a **free-text description** — NOT a regex/assertion. Pass/fail is judge-based (Phase 134); 132 only persists text.
- **D-07:** **Cases belong to the SKILL, not to a version** — freely editable/deletable before any run. Traceability lives on the eval RUN (Phase 133 records `skill_version_id`), not the case. Cases are NOT version-locked.
- **D-08:** Test cases are **provider-agnostic**. No provider/model columns on `skill_test_cases`.
- **D-09:** Lay **only the two 132 tables now** (`skill_versions` + `skill_test_cases`). Do not design `eval_runs`.
- **D-10:** Design the two tables **forward-compatibly** — stable PKs so 133 can FK `eval_runs.skill_version_id → skill_versions.id` and per-case results can FK `skill_test_cases.id`.
- **D-11:** **Backfill a v1 snapshot for every existing skill** at migration time (`INSERT … SELECT`, `source='backfill'`, `version_number=1`).
- **D-12:** **Owner-only RLS on BOTH tables, even for global (`is_global`) skills.** Version history + cases are the author's private authoring/eval harness.
- **D-13:** New migration starts at **`079_*`** (latest applied is `078`). Apply via Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no-reset live dump), commit both. Apply to BOTH local and (at deploy) cloud.

### Claude's Discretion
- Exact column types/constraint names, trigger function naming, discrete columns vs JSONB blob on `skill_versions` (operator leans discrete for queryability), CRUD route shapes (consistent with `backend/app/api/skills.py`).
- **RESOLVED (operator, 2026-06-29):** ship a **thin functional CRUD surface** in 132 — schema/trigger/RLS/migration + CRUD API + a minimal, non-designed test-case editor & version-history read. NO design polish, NO UI-SPEC (treated as `--skip-ui`). The real sketch-gated Skill Evals panel is Phase 137 (G-2). The thin surface must not pre-empt/constrain the 137 design.

### Deferred Ideas (OUT OF SCOPE)
- Eval runner (with/without-skill, SSE, two completions/case) → Phase 133 (EVAL-02).
- Per-provider verdict + side-by-side + thumbs ratings → Phase 134 (EVAL-03/04).
- Self-improvement loop → Phase 135 (SI-01); description-only proposer → Phase 139 (SI-02).
- Publish gate → Phase 136 (GATE-01).
- Consolidated sketch-gated Skill Evals panel → Phase 137 (PANEL-01, G-2).
- Skill EXECUTION / sandbox / non-Python runtime / agent_loop / provider gateway / threads.py — SEED-096, separate concern. **This phase touches NONE of it.**
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | On skill save (create or update), an immutable version snapshot is created — eval history traceable to exact instruction state; prior versions viewable. | `skill_versions` table + AFTER INSERT OR UPDATE trigger (covers all 5 write paths verified below) + append-only block trigger (067 pattern) + v1 backfill + owner-only RLS + version-history GET route. |
| EVAL-01 | User can define test cases (prompt + expected-behavior), save persistently, survive session, editable before any run. | `skill_test_cases` table + owner-scoped CRUD router (mirrors `skills.py` conventions) + minimal non-designed editor UI. |
</phase_requirements>

## Summary

This is a pure persistence/schema phase plus a thin CRUD surface. The live codebase already contains every pattern needed — there is **no external library research** to do. The work is: one migration (`079_skill_versions_and_test_cases.sql`), a new owner-scoped CRUD router, two Pydantic models, and a minimal UI.

The single most important live-codebase fact that shapes the entire design: **the backend writes to Supabase exclusively through the service-role client** (`backend/app/dependencies.py:19` — `create_client(supabase_url, supabase_service_role_key)`). The service-role role **bypasses RLS entirely**, and app code enforces owner-scope manually via `.eq("user_id", current_user["id"])` filters. Two consequences:
1. The version-capture trigger runs in a service-role transaction. `auth.uid()` will be **NULL** inside the trigger — so the version row's `user_id` MUST be sourced from `NEW.user_id` (the skills row), never `auth.uid()`. The trigger's INSERT into `skill_versions` succeeds because service-role bypasses RLS.
2. RLS on the two new tables is **defense-in-depth only** — the real access gate is the app-code owner filter. This exactly matches the documented `077_tuner_runs.sql` reasoning.

**Primary recommendation:** Mirror `077_tuner_runs.sql` for table/RLS/grants shape, mirror `067` for the append-only immutability trigger, mirror `017_skills.sql` for owner-scoped RLS, and mirror `skills.py` for the CRUD router. One genuine conflict to resolve (see Conflict C-1 below): a pure Postgres trigger **cannot** distinguish `manual` vs `import` vs `tuner` vs `self_improve` provenance — all write paths arrive as identical PostgREST INSERT/UPDATE statements. Recommend collapsing trigger-captured `source` to `'manual'` by default with `'backfill'` set by the migration, and treating finer provenance as a deferred enhancement.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Version snapshot capture | Database (trigger) | — | D-01: safe-by-construction, fires on every write path with zero app code. |
| Version-number monotonicity | Database (trigger) | — | Computed `max+1` inside the trigger; protected by a unique constraint. |
| Version append-only enforcement | Database (trigger) | — | BEFORE UPDATE/DELETE block trigger (067 pattern) — robust regardless of role. |
| Owner-scope access control | API / Backend | Database (RLS, defense-in-depth) | Service-role bypasses RLS; app `.eq("user_id", ...)` filter is the real gate (077 precedent). |
| Test-case CRUD | API / Backend | — | New owner-scoped router mirroring `skills.py`. |
| Version-history read / test-case editor | Frontend (thin, non-designed) | — | Minimal functional surface; full design = Phase 137. |
| v1 backfill | Database (one-time migration DML) | — | D-11 INSERT…SELECT. |

## Standard Stack

No new external packages. This phase uses only existing project infrastructure.

| Component | Existing Asset | Purpose |
|-----------|----------------|---------|
| DB / migrations | Supabase Postgres, numbered SQL under `supabase/migrations/` | Schema + trigger + RLS + backfill `[VERIFIED: supabase/migrations/]` |
| Supabase client | `supabase-py` via `get_supabase()` (service-role) | All table reads/writes `[VERIFIED: backend/app/dependencies.py:19]` |
| API framework | FastAPI `APIRouter` | CRUD routes `[VERIFIED: backend/app/api/skills.py:22]` |
| Models | Pydantic `BaseModel` | Request/response shapes `[VERIFIED: backend/app/models/skill.py]` |
| updated_at | `public.set_updated_at()` trigger fn | Reuse on `skill_test_cases` `[VERIFIED: supabase/migrations/014_folders.sql:52]` |

**No `## Package Legitimacy Audit` section** — this phase installs zero external packages.

## Write Paths the Version Trigger Must Cover (VERIFIED ENUMERATION)

D-01 claims the trigger covers every write path with zero app code. Verified — **all** writes to the `skills` table go through the service-role `supabase.table("skills")` API. There are **no** raw asyncpg/SQL writes to `skills` in app code (grep found only one in a test file, `backend/tests/integration/test_123_1_tuner_runs_timestamp.py:130`).

| # | Write path | Location | DB op | Trigger result |
|---|-----------|----------|-------|----------------|
| 1 | `create_skill` POST | `skills.py:174` `.insert(...)` | INSERT | Captures v1 ✅ |
| 2 | `import_skill` (bulk, per skill) | `skills.py:244` `.insert(...)` | INSERT (1+) | Captures v1 per skill ✅ |
| 3 | `update_skill` PATCH (also the **tuner author-confirm** write per `skills.py:332`) | `skills.py:322` `.update(...)` | UPDATE | Captures vN if trifecta changed ✅ |
| 4 | `toggle_enabled` PATCH | `skills.py:396` `.update({"is_enabled": ...})` | UPDATE | `IS DISTINCT FROM` guard → **no version** ✅ (D-02) |
| 5 | `toggle_global` PATCH | `skills.py:433` `.update({"is_global": ...})` | UPDATE | guard → **no version** ✅ (D-02) |
| 6 | skill-creator agent (`save_skill` tool) | `tool_dispatcher.py:745` update / `:755` insert | UPDATE/INSERT | Captures version ✅ |

**Conclusion:** D-01's "trigger covers all paths, zero app code" is **VALID** for *capture*. The append-only `delete_skill` (`skills.py:367`) cascades `skill_files`; `skill_versions`/`skill_test_cases` will also need `ON DELETE CASCADE` so a deleted skill cleans up its versions/cases (no orphan rows). Confirm with the planner whether retaining version history past skill deletion is ever desired — default recommendation is CASCADE (matches `skill_files`).

## Architecture Patterns

### Migration file structure (recommended order — single file `079`)
```
079_skill_versions_and_test_cases.sql
├── 1. CREATE TABLE skill_versions  (discrete columns, UNIQUE(skill_id, version_number))
├── 2. CREATE TABLE skill_test_cases (FK skill_id, order_index, updated_at)
├── 3. Indexes (skill_id, user_id)
├── 4. Version-capture trigger fn + AFTER INSERT OR UPDATE trigger on skills
├── 5. Append-only block trigger fn + BEFORE UPDATE OR DELETE trigger on skill_versions
├── 6. set_updated_at trigger on skill_test_cases (reuse existing fn)
├── 7. RLS enable + owner-only policies on BOTH tables
├── 8. v1 backfill: INSERT … SELECT from skills  (run AFTER trigger created — see note)
└── 9. COMMENTs documenting service-role / RLS-defense-in-depth semantics
```
**Backfill ordering note:** the backfill INSERTs directly into `skill_versions` (not into `skills`), so it does **not** fire the skills capture trigger — order relative to the trigger does not cause double-capture. Place it last for readability.

### Pattern 1: Version-capture trigger (the core mechanism)
**What:** AFTER INSERT OR UPDATE on `skills`; on UPDATE only fire when the trifecta changed.
**Recommended shape:**
```sql
-- [CITED: pattern derived from 014_folders.sql set_updated_at + 067 IS DISTINCT FROM guard]
CREATE OR REPLACE FUNCTION public.capture_skill_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER                       -- robust even for a future RLS-respecting writer
SET search_path = public, pg_temp      -- SECURITY DEFINER hardening
AS $$
DECLARE
  next_num integer;
BEGIN
  -- D-02: on UPDATE, skip when none of the trifecta changed (toggles must not version)
  IF (TG_OP = 'UPDATE') AND NOT (
        NEW.name         IS DISTINCT FROM OLD.name
     OR NEW.description  IS DISTINCT FROM OLD.description
     OR NEW.instructions IS DISTINCT FROM OLD.instructions
  ) THEN
    RETURN NEW;
  END IF;

  -- D-03: monotonic per-skill version_number = max+1
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_num
    FROM public.skill_versions
   WHERE skill_id = NEW.id;

  INSERT INTO public.skill_versions
    (skill_id, user_id, version_number, name, description, instructions, source)
  VALUES
    (NEW.id, NEW.user_id, next_num, NEW.name, NEW.description, NEW.instructions, 'manual');
  -- ^ user_id = NEW.user_id, NOT auth.uid() (NULL under service-role)
  -- ^ source = 'manual' default (see Conflict C-1)

  RETURN NEW;
END;
$$;

CREATE TRIGGER skills_capture_version
  AFTER INSERT OR UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.capture_skill_version();
```

### Pattern 2: Append-only enforcement (block UPDATE/DELETE on skill_versions)
**What:** Mirror the `067` published-immutability trigger so version rows can never be mutated or deleted (except the cascade from skill deletion — see note).
```sql
-- [CITED: supabase/migrations/067_skill_snapshots_sibling_column.sql:30-53]
CREATE OR REPLACE FUNCTION public.skill_versions_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'skill_versions is append-only (row %); versions are immutable',
    COALESCE(OLD.id, NEW.id)
    USING ERRCODE = 'check_violation';   -- SQLSTATE 23514
END;
$$;

CREATE TRIGGER skill_versions_no_update
  BEFORE UPDATE ON public.skill_versions
  FOR EACH ROW EXECUTE FUNCTION public.skill_versions_block_mutation();
```
**DELETE caveat:** if `skill_versions.skill_id` has `ON DELETE CASCADE`, a BEFORE DELETE block trigger would *break* skill deletion (the cascade delete would raise). Recommendation: enforce append-only on **UPDATE only** (block mutation of an existing version's content), and allow DELETE solely via the FK cascade. Do **not** add a BEFORE DELETE block trigger if you keep CASCADE. Flag this trade-off to the planner explicitly.

### Pattern 3: Owner-only RLS (D-12 — differs from 077)
`077_tuner_runs.sql` SELECT policy includes an `is_global` branch. D-12 requires **owner-only**, so drop that branch:
```sql
-- [CITED: 017_skills.sql:27-41 owner-scope form, with is_global branch removed per D-12]
ALTER TABLE public.skill_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can view skill versions"
  ON public.skill_versions FOR SELECT
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies: trigger writes via service-role (bypasses RLS);
-- the append-only trigger is the mutation gate. Mirrors 077's "writes bypass RLS" model.

ALTER TABLE public.skill_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can view test cases"   ON public.skill_test_cases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert test cases" ON public.skill_test_cases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update test cases" ON public.skill_test_cases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner can delete test cases" ON public.skill_test_cases FOR DELETE USING (auth.uid() = user_id);
```
RLS here is defense-in-depth; the app still enforces `.eq("user_id", current_user["id"])` on every query (the real gate).

### Recommended table column sets

`skill_versions` (discrete columns per operator preference — queryable diffs for Phase 137):
```sql
CREATE TABLE public.skill_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- stable FK target for 133 (D-10)
  skill_id       uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- = skills.user_id
  version_number integer NOT NULL,
  name           text NOT NULL,
  description    text NOT NULL DEFAULT '',
  instructions   text NOT NULL DEFAULT '',
  source         text NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual','import','tuner','self_improve','backfill')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_versions_skill_num_unique UNIQUE (skill_id, version_number)
);
CREATE INDEX skill_versions_skill_id_idx ON public.skill_versions(skill_id);
CREATE INDEX skill_versions_user_id_idx  ON public.skill_versions(user_id);
```
Note: no `updated_at` (append-only). Keep the CHECK enum even though the trigger only writes `'manual'`/`'backfill'` — it future-proofs for 133/135 writers (D-10).

`skill_test_cases`:
```sql
CREATE TABLE public.skill_test_cases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- stable FK target for 133 (D-10)
  skill_id          uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt            text NOT NULL,
  expected_behavior text NOT NULL DEFAULT '',  -- free text (D-06), not an assertion
  order_index       integer NOT NULL DEFAULT 0,
  name              text,                       -- optional label (D-05)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_test_cases_skill_id_idx ON public.skill_test_cases(skill_id);
CREATE INDEX skill_test_cases_user_id_idx  ON public.skill_test_cases(user_id);

CREATE TRIGGER skill_test_cases_set_updated_at
  BEFORE UPDATE ON public.skill_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();   -- reuse 014's fn
```

### v1 backfill (D-11)
```sql
INSERT INTO public.skill_versions
  (skill_id, user_id, version_number, name, description, instructions, source)
SELECT id, user_id, 1, name, description, instructions, 'backfill'
  FROM public.skills;
```

### CRUD route shapes
Recommend a **new router** `backend/app/api/skill_test_cases.py` (keeps `skills.py` focused; clean G-5 — no hot-file growth). Mirror `skills.py` conventions: service-role client, explicit `.eq("user_id", current_user["id"])` owner gate, `maybe_single()` for fetch-one. Register it in the app router include list alongside `skills`.

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/skills/{skill_id}/test-cases` | List cases for a skill (owner-scoped), ordered by `order_index` |
| POST   | `/skills/{skill_id}/test-cases` | Create a case |
| PATCH  | `/test-cases/{case_id}` | Edit prompt/expected_behavior/order_index/name |
| DELETE | `/test-cases/{case_id}` | Delete a case |
| GET    | `/skills/{skill_id}/versions` | List version history (owner-scoped), ordered by `version_number DESC` |

(Version routes are read-only — no POST/PATCH/DELETE; versions are created by the trigger and are immutable.) Models go in `backend/app/models/` — e.g. `skill_test_case.py` (`TestCaseCreate`, `TestCaseUpdate`, `TestCaseResponse`) and a `SkillVersionResponse` (add to `skill.py` or a new `skill_version.py`).

### Anti-Patterns to Avoid
- **Setting `user_id` from `auth.uid()` in the trigger** — it is NULL under service-role; use `NEW.user_id`.
- **Adding capture logic in routers** — violates D-01; the trigger is the single source.
- **A BEFORE DELETE block trigger on `skill_versions` while keeping `ON DELETE CASCADE`** — they conflict; skill deletion would 500.
- **Reusing `skill_snapshots` (067) machinery** — different table/purpose (D-04).
- **Including an `is_global` branch in the new RLS policies** — D-12 is owner-only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `updated_at` maintenance | A custom timestamp trigger | Existing `public.set_updated_at()` (014) | Already project-standard. |
| Per-request capture in each router | App-code snapshot calls × 6 paths | One AFTER trigger (D-01) | Safe-by-construction; can't be forgotten on a new path. |
| Immutability enforcement | App-code "don't update" checks | BEFORE UPDATE block trigger (067 pattern) | DB-enforced regardless of caller/role. |
| Owner-scope RLS | Bespoke policy logic | Copy `017_skills.sql` / `077_tuner_runs.sql` shapes | Proven precedent; reviewers recognize it. |

## Common Pitfalls

### Pitfall 1: `auth.uid()` is NULL inside the trigger
**What goes wrong:** version rows get NULL `user_id` (or the INSERT fails the NOT NULL).
**Why:** all writes use the service-role client; there is no authenticated JWT context in the DB session.
**How to avoid:** source `user_id` from `NEW.user_id`.
**Warning sign:** backfill works (it SELECTs `user_id` from skills) but live edits produce NULL `user_id`.

### Pitfall 2: version_number race → unique violation
**What goes wrong:** two near-simultaneous edits of the same skill compute the same `max+1`.
**Why:** the `SELECT MAX` + `INSERT` is not atomic across concurrent transactions.
**How to avoid:** the `UNIQUE(skill_id, version_number)` constraint turns a race into a clean retry-able error rather than a duplicate. Risk is low (single-author edits) but the constraint is mandatory defense. Document that a 23505 on this constraint is a benign concurrency signal.

### Pitfall 3: append-only DELETE trigger vs FK cascade
**What goes wrong:** deleting a skill 500s because the cascade tries to delete version rows that a BEFORE DELETE block trigger forbids.
**How to avoid:** enforce append-only on UPDATE only; let DELETE flow through the FK cascade (see Pattern 2).

### Pitfall 4: forgetting the live-DB apply step
**What goes wrong:** code merges but the table doesn't exist in local/cloud Supabase; CRUD 500s.
**How to avoid:** the plan MUST include a `[BLOCKING] autonomous:false` task: paste `079` into the Supabase SQL editor (local), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit both files. Cloud apply is a deploy-time operator step. (See `077_tuner_runs.sql` header — Plan 01 Task 2 did exactly this.)

### Pitfall 5: import path multi-skill capture
**What goes wrong:** none expected — but note `import_skill` can INSERT multiple skills in one request; the trigger fires per row (FOR EACH ROW), so each imported skill correctly gets its own v1. Verified at `skills.py:241-255`.

## Flagged Conflicts (CONTEXT.md vs live code)

### Conflict C-1 (RESOLVE BEFORE PLANNING): `source` provenance vs pure-trigger capture
**D-03** wants a 5-value `source` enum (`manual`/`import`/`tuner`/`self_improve`/`backfill`). **D-01** wants capture via a pure Postgres trigger with **zero app code**. These are partially incompatible:

- At the DB level, `create_skill`, `import_skill`, `update_skill`, the tuner author-confirm, and the skill-creator agent **all arrive as identical PostgREST INSERT/UPDATE statements** via the same service-role connection. The trigger has **no signal** to tell them apart.
- The usual provenance trick (`SET LOCAL app.source = '…'` + `current_setting()` in the trigger) is **not available** through supabase-py/PostgREST — there is no per-request GUC hook on the pooled connection. Using it would require raw asyncpg writes, abandoning the existing `supabase.table()` write path (large, risky change — contradicts the phase's "thin" scope and the no-hot-file rule).

**Recommended resolution (lowest-risk, honors D-01):**
1. Trigger writes `source = 'manual'` for **all** live captures (INSERT and UPDATE).
2. Migration backfill writes `source = 'backfill'`.
3. Keep the full 5-value CHECK enum on the column (forward-compat for 133/135 writers that may write rows directly with explicit `source`, per D-10).
4. Treat true `import`/`tuner`/`self_improve` provenance as a **deferred enhancement** — achievable later by having those *specific* paths write their own `skill_versions` row explicitly (with the trigger suppressed for that path via a guard column) OR by a small targeted app-code hook. Do not solve it in 132.

This keeps 132 pure-trigger and zero-app-code while still shipping the `source` column. **The planner/operator should confirm this collapse is acceptable** (it means version history in 132 will show `manual`/`backfill` only). `[ASSUMED]` that the operator accepts the collapse — flag for confirmation.

### Conflict C-2 (minor): `ON DELETE CASCADE` + append-only
D-03 says "append-only — no UPDATE/DELETE of version rows," but a deleted skill must not leave orphaned versions. Resolution in Pattern 2: block UPDATE (immutability), allow DELETE only via FK cascade. Confirm the operator wants version history to vanish with the skill (recommended, matches `skill_files`). `[ASSUMED]`.

## Runtime State Inventory

This is a greenfield-additive schema phase, not a rename/refactor. Brief inventory of pre-existing runtime state the new objects interact with:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `skills` rows (local + cloud Supabase) need a v1 backfill row each | D-11 INSERT…SELECT migration step (data migration) |
| Live service config | None — no external service stores skill version/case state | None |
| OS-registered state | None | None — verified, no scheduler/daemon touches skills |
| Secrets/env vars | None new (`SUPABASE_SERVICE_ROLE_KEY` already present) | None |
| Build artifacts | None | None |

**Cloud parity:** the `079` migration + backfill must be applied to **both** local and cloud Supabase. Cloud apply is operator-gated at deploy time (CLAUDE.md deployment rules) — not done in this phase's execution but the plan should note it as a deploy-time follow-up.

## Code Examples

All canonical patterns are inline above (Patterns 1–3, table DDL, backfill). Sources:
- updated_at fn: `supabase/migrations/014_folders.sql:52-58` `[VERIFIED]`
- IS DISTINCT FROM + immutability trigger: `supabase/migrations/067_skill_snapshots_sibling_column.sql:30-60` `[VERIFIED]`
- Owner-scoped RLS: `supabase/migrations/017_skills.sql:25-41` `[VERIFIED]`
- Owner-scoped table + service-role-writes-bypass-RLS model: `supabase/migrations/077_tuner_runs.sql` `[VERIFIED]`
- CRUD router conventions (service-role + `.eq(user_id)` gate): `backend/app/api/skills.py` `[VERIFIED]`

## State of the Art

| Old Approach | Current Approach | Source | Impact |
|--------------|------------------|--------|--------|
| Snapshot state copied into a workflow definition (067 `skill_snapshots`) | Per-skill immutable version history table (`skill_versions`) | D-04 | Different purpose; do not conflate. |
| Tuner result lived only in Redis (lost on refresh) | Durable owner-scoped table (`tuner_runs`, 077) | 077 header | Same durability pattern this phase follows. |

## Project Constraints (from CLAUDE.md)

- Numbered SQL migrations under `supabase/migrations/` matching `<digits>_name.sql`; **no letter suffixes** (e.g. `079_...`, not `079b`). `[VERIFIED]`
- **Apply each migration by pasting into the Supabase SQL editor — never `supabase db push`/`db reset`** (preserves dev data). Then `bash scripts/regenerate-full-schema.sh` (no `--reset` = live dump). Commit both files. **Never hand-edit `full-schema.sql`.** `[VERIFIED: CLAUDE.md]`
- **All tables need RLS** — users only see their own data (global skills are the only shared scope; versions/cases are explicitly NOT shared per D-12). `[VERIFIED: CLAUDE.md]`
- Do not run blocking I/O directly in async handlers — wrap with `run_in_threadpool`. Note: existing `skills.py` routes are `async def` but call the **sync** supabase client directly (no threadpool). The new router should match the *prevailing local convention* in `skills.py` for consistency, but the planner should flag that this is technically against the D-PRD rule (existing tech debt, not introduced here). `[VERIFIED: skills.py]`
- Local setup must never break; local↔cloud is a pure env-var switch. `[VERIFIED: CLAUDE.md]`
- Red line: NO agent-loop / provider-gateway / `threads.py` touch. This phase touches none — clean. `[VERIFIED]`

## Validation Architecture

`nyquist_validation` is `true` in config — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) — `backend/tests/` exists, integration tests present (e.g. `test_123_1_tuner_runs_timestamp.py`) |
| Config file | `backend/pytest.ini` or `pyproject.toml` (planner verify in Wave 0) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/ -x -k "skill_version or test_case" -q` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest tests/ -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | INSERT skill → v1 captured | integration (DB) | `pytest tests/integration/test_132_skill_versions.py::test_insert_captures_v1 -x` | ❌ Wave 0 |
| VER-01 | UPDATE trifecta → vN+1 | integration | `...::test_content_change_captures_new_version` | ❌ Wave 0 |
| VER-01 | toggle-enabled/global → NO version | integration | `...::test_toggle_does_not_version` | ❌ Wave 0 |
| VER-01 | version rows immutable (UPDATE blocked) | integration | `...::test_version_update_blocked` | ❌ Wave 0 |
| VER-01 | backfill gives every existing skill a v1 | integration | `...::test_backfill_v1` | ❌ Wave 0 |
| EVAL-01 | create/list/edit/delete test case persists | integration | `pytest tests/integration/test_132_test_cases.py -x` | ❌ Wave 0 |
| EVAL-01/VER-01 | owner-scope: other user can't read versions/cases | integration | `...::test_owner_scope_isolation` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run command above.
- **Per wave merge:** full suite.
- **Phase gate:** full suite green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_132_skill_versions.py` — covers VER-01 (use the existing `test_123_1_tuner_runs_timestamp.py` integration harness as the template; it already does raw `INSERT INTO public.skills` for fixtures).
- [ ] `backend/tests/integration/test_132_test_cases.py` — covers EVAL-01.
- [ ] Confirm the integration tests apply migration `079` against the test DB (or run after manual SQL-editor apply). Document the apply step.

> **SC#10 / UAT scoreboard:** NOT applicable. This phase does not touch streaming, the agent loop, provider routing, or chat UI state. The thin UI surface is a non-designed CRUD form. No cross-provider × multi-tool × parallel-thread × long-message matrix required.

## Security Domain

`security_enforcement` not present in config → treat as enabled. Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `get_current_user` bearer-token dependency (unchanged). |
| V3 Session Management | no | Stateless JWT; no new session state. |
| V4 Access Control | **yes** | Owner-scope: app-code `.eq("user_id", current_user["id"])` gate (real gate, service-role bypasses RLS) + owner-only RLS (defense-in-depth, D-12). |
| V5 Input Validation | yes | Pydantic models on CRUD bodies (`prompt`, `expected_behavior`, `order_index`). |
| V6 Cryptography | no | No crypto in scope. |

### Known Threat Patterns for FastAPI + Supabase (service-role)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `/test-cases/{case_id}` / `/skills/{id}/versions` (read/edit another owner's data) | Information disclosure / Tampering | Every query MUST include `.eq("user_id", current_user["id"])` — service-role bypasses RLS, so app-code is the ONLY runtime gate. Verify each route. |
| SQL injection | Tampering | None — PostgREST parameterizes; no raw f-string SQL in app routes. |
| Version-history tampering | Tampering | Append-only block trigger (immutable). |
| Cross-owner version leak via global skill | Information disclosure | D-12 owner-only RLS (no `is_global` branch) — a consumer of a global skill cannot read its version history/cases. |

**Primary security control to verify in plan-check:** every new route's owner filter. Because RLS is bypassed by the service-role client, a missing `.eq("user_id", ...)` is a silent full-table leak (not caught by RLS).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Operator accepts collapsing trigger `source` to `manual`/`backfill` (no `import`/`tuner`/`self_improve` distinction in 132) | Conflict C-1 | If finer provenance is required in 132, app-code participation is needed → larger scope, partly contradicts D-01. |
| A2 | Version history should be deleted with its skill (FK CASCADE), append-only enforced on UPDATE only | Conflict C-2 / Pattern 2 | If history must outlive skill deletion, need a different FK strategy (SET NULL / no FK) + a DELETE block. |
| A3 | New CRUD router follows the prevailing sync-supabase-in-async-handler convention in `skills.py` (not `run_in_threadpool`) | Project Constraints | Minor: matches existing tech debt; a stricter reading of D-PRD-01 would wrap calls. |
| A4 | pytest is the backend test framework with an integration harness that can reach the test DB | Validation Architecture | If integration tests can't apply/reach `079`, VER-01 trigger behavior can only be verified manually. |
| A5 | `delete_skill` should cascade-clean versions/cases (matches `skill_files` cascade) | Write-paths table | Confirmed pattern, low risk. |

## Open Questions

1. **`source` provenance fidelity (C-1).** Recommendation: collapse to `manual`/`backfill` in 132; defer finer provenance. Needs operator confirmation.
2. **Version retention on skill delete (C-2).** Recommendation: CASCADE + UPDATE-only immutability. Needs operator confirmation.
3. **Where do the thin UI surfaces live?** Operator said "thin, non-designed." Planner to decide: a minimal section in the existing skill edit view vs a standalone debug page. Must not constrain Phase 137 design (G-2). Low risk — keep it functional/ugly on purpose.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (local) | migration apply + integration tests | ✓ (project standard) | — | — |
| `scripts/regenerate-full-schema.sh` | full-schema regen | ✓ `[VERIFIED: referenced in CLAUDE.md + 077 header]` | — | — |
| Python venv + pytest | backend tests | ✓ (project standard) | — | — |

No missing dependencies. No external services beyond existing Supabase.

## Sources

### Primary (HIGH confidence — live codebase, VERIFIED)
- `backend/app/dependencies.py:16-20` — service-role client (the RLS-bypass fact driving the whole design)
- `backend/app/api/skills.py` — all 5 router write paths + CRUD conventions
- `backend/app/services/tool_dispatcher.py:742-764` — skill-creator agent write path (6th path)
- `backend/app/models/skill.py` — existing Pydantic model shapes
- `supabase/migrations/017_skills.sql` — skills table + owner-scoped RLS precedent
- `supabase/migrations/067_skill_snapshots_sibling_column.sql` — IS DISTINCT FROM + immutability trigger pattern
- `supabase/migrations/077_tuner_runs.sql` — owner-scoped table + service-role-write/RLS-defense model
- `supabase/migrations/014_folders.sql:52-63` — `set_updated_at()` reusable fn
- migrations dir listing — latest is `078` → next is `079` (confirms D-13)
- `.planning/config.json` — nyquist_validation true, security default-enabled, no UI safety issue

### Secondary
- `CLAUDE.md` — migration mechanics, RLS rule, deployment parity rules
- `.planning/REQUIREMENTS.md` — VER-01, EVAL-01 wording

### Tertiary
- None requiring external validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all assets verified in-repo.
- Architecture (trigger/RLS/tables): HIGH — every pattern cited from an existing migration.
- Write-path coverage: HIGH — exhaustively grepped; only app paths + one test-file raw SQL.
- `source` provenance resolution: MEDIUM — recommendation sound, but needs operator confirmation (C-1/A1).

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (stable — internal schema, no fast-moving external deps)
