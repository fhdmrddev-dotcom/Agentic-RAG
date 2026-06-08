# Phase 090: Harness Schema + RLS + Config Models - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 7 (4 SQL migrations + 1 Pydantic model + 1 unit test + 1 live-DB verify script)
**Analogs found:** 7 / 7 (all exact or strong role-match; verify_090.sql has no in-repo precedent → noted)

> All analogs named in CONTEXT.md / RESEARCH.md were verified by reading the actual files. The literal excerpts below are pulled with confirmed line numbers from the shipped migrations and models. Migration head confirmed at `055_todos_table.sql` (last file in `supabase/migrations/`), so new migrations number **056–059**.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/056_workflow_definitions.sql` | migration (table + ownership RLS + immutable trigger + seed) | CRUD + transform | `017_skills.sql` (ownership/is_global) + `018_skill_creator_seed.sql` (global seed user) | exact (ownership); NEW (immutable trigger) |
| `supabase/migrations/057_workflow_runs.sql` | migration (table + 1-hop FK-chain RLS) | CRUD | `055_todos_table.sql` (1-hop RLS) + `054_workspace_files.sql` (1-hop RLS) | exact |
| `supabase/migrations/058_workflow_phases.sql` | migration (table + 2-hop FK-chain RLS) | CRUD | `054_workspace_files.sql` (2-hop JOIN RLS, `workspace_file_versions`) | exact |
| `supabase/migrations/059_harness_audit_and_threads_col.sql` | migration (INSERT-only audit + ALTER threads) | event-driven (append-only) + transform | `030_missing_tables.sql` (`audit_log` INSERT-only) + `055_todos_table.sql` (ALTER ADD COLUMN + FK SET NULL) | exact |
| `backend/app/models/harness.py` | model (Pydantic config) | transform (JSONB parse) | `backend/app/models/workspace.py` + `backend/app/models/skill.py` | role-match (conventions); discriminated-union shape is NEW per RESEARCH §Pattern 6 |
| `backend/tests/unit/test_harness_models.py` | test (pure-Python unit) | request-response (validate) | `backend/tests/unit/test_write_todos_coercion.py` (pure-Python, no live DB) + `test_resolve_max_tokens.py` (parametrize/assert-raises shape) | role-match |
| `supabase/verify_090.sql` | test (live-DB SQL verification) | request-response | NO in-repo precedent | none (see No Analog Found) |

---

## Pattern Assignments

### `supabase/migrations/056_workflow_definitions.sql` (migration, CRUD + transform)

**Analogs:** `supabase/migrations/017_skills.sql` (ownership/sharing + trigger structure), `supabase/migrations/018_skill_creator_seed.sql` (global seed user).

**Ownership + global-SELECT RLS pattern** — `017_skills.sql:25-41` (copy verbatim, rename `user_id` → `created_by`):
```sql
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global skills"
  ON public.skills FOR SELECT
  USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "Users can insert own skills"
  ON public.skills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own skills"
  ON public.skills FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own skills"
  ON public.skills FOR DELETE
  USING (auth.uid() = user_id);
```
> Rename `user_id` → `created_by` (D-01 names the column `created_by`). Semantics identical. The SELECT predicate `auth.uid() = created_by OR is_global = true` is the D-01/D-02 sharing model verbatim.
>
> **Security flag (RESEARCH §Security Domain):** the 017 INSERT policy does NOT prevent a user setting `is_global = true` on their own row. If v2.8 wants to reserve global publishing for seeds/operators, planner should add `WITH CHECK (auth.uid() = created_by AND is_global = false)` on INSERT. D-03 defers the operator tier, so mirroring skills (allow self-set globals) is the conservative default — surface to the user.

**updated_at trigger reuse** — `017_skills.sql:46-49` (the universal `set_updated_at()` function from `014_folders.sql` is already shipped; reuse it on draft edits):
```sql
DROP TRIGGER IF EXISTS skills_set_updated_at ON public.skills;
CREATE TRIGGER skills_set_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

**Immutable-on-publish trigger (NEW — no literal analog; structural shape from `set_updated_at`):** per RESEARCH §Pattern 3, write a NEW `plpgsql` `BEFORE UPDATE FOR EACH ROW` function that raises when `OLD.status = 'published'` (keys on `OLD`, NOT `NEW`, so the draft→published transition itself is allowed — RESEARCH Pitfall 3). Use `ERRCODE = 'check_violation'` (SQLSTATE 23514) so the verify script can assert on it.

**Table skeleton** — RESEARCH §Code Examples (assembled from D-01..D-06, D-11): `UNIQUE(slug, version)` constraint (D-05), `status text CHECK (status IN ('draft','published'))` (D-04), `created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `is_global boolean NOT NULL DEFAULT false`, `org_id uuid` (no FK, D-11), `definition jsonb`.

**Global seed user pattern** — `018_skill_creator_seed.sql:9-32` (the seed system user `00000000-…-0001` already exists after 018 ran; global workflow seeds reference it as `created_by`):
```sql
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seed@system.local', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;
```
> The seed user already exists (018 ran); a global workflow seed just references `'00000000-0000-0000-0000-000000000001'` as `created_by` with `is_global = true` and `status = 'published'`. RESEARCH OQ1 recommends Phase 090 ship ONE minimal valid seed (doubles as the `model_validate()` fixture for SC#5); real 2–3 templates are Phase 091's job. Seed rows ship `status='published'` → the block-published trigger then freezes them (correct per D-04).

---

### `supabase/migrations/057_workflow_runs.sql` (migration, CRUD)

**Analog:** `supabase/migrations/055_todos_table.sql` (1-hop FK-chain RLS) and `054_workspace_files.sql` (same 1-hop pattern).

**1-hop FK-chain RLS** — `055_todos_table.sql:21-37` (copy verbatim, rename `todos` → `workflow_runs`, predicate identical):
```sql
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_select_own" ON public.todos
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_insert_own" ON public.todos
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_update_own" ON public.todos
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "todos_delete_own" ON public.todos
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));
```
> `workflow_runs.thread_id → threads.user_id` is the same 1-hop the `todos`/`workspace_files` tables use. No new RLS reasoning.

**ON DELETE RESTRICT FK (D-06 / SC#2)** — RESEARCH §Code Examples; NO existing migration uses `ON DELETE RESTRICT` (all shipped FKs are CASCADE/SET NULL), so this is the one FK behavior new to the codebase:
```sql
definition_id uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,  -- D-06: SC#2
thread_id     uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
```
> `thread_id` keeps the project's standard `ON DELETE CASCADE` (matches `todos`/`workspace_files`); only the `definition_id` FK is RESTRICT (a referenced published version cannot be deleted). Also carry `org_id uuid` (D-11) and a `status text CHECK (...)`.

---

### `supabase/migrations/058_workflow_phases.sql` (migration, CRUD)

**Analog:** `supabase/migrations/054_workspace_files.sql` — the `workspace_file_versions` 2-hop JOIN RLS (`054:55-76`) is the exact template (child reaches `threads.user_id` through its parent run).

**2-hop JOIN FK-chain RLS** — `054_workspace_files.sql:56-76` (copy verbatim; rename `workspace_file_versions` → `workflow_phases`, `workspace_files wf`/`workspace_file_id` → `workflow_runs wr`/`workflow_run_id`):
```sql
ALTER TABLE workspace_file_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_versions_select_own" ON workspace_file_versions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workspace_files wf ON wf.thread_id = t.id
            WHERE wf.id = workspace_file_id
        )
    );

CREATE POLICY "workspace_versions_insert_own" ON workspace_file_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workspace_files wf ON wf.thread_id = t.id
            WHERE wf.id = workspace_file_id
        )
    );
```
> For `workflow_phases`: `phase.workflow_run_id → workflow_runs.thread_id → threads.user_id`. The JOIN becomes `JOIN workflow_runs wr ON wr.thread_id = t.id WHERE wr.id = workflow_run_id`. Note 054 only ships SELECT+INSERT on the versions table; planner must add UPDATE/DELETE with the same JOIN predicate in `USING`/`WITH CHECK` if phases are mutated by the engine.

**Index** — D-090 discretion / RESEARCH suggests `(workflow_run_id, phase_index)`. Mirror the `054:34` composite-index shape:
```sql
CREATE INDEX idx_workspace_versions_file ON workspace_file_versions(workspace_file_id, version DESC);
```
> → `CREATE INDEX idx_workflow_phases_run ON public.workflow_phases(workflow_run_id, phase_index);`. Carry `output jsonb` (resumability substrate, large outputs spill to `workspace-files` bucket path-only) and `org_id uuid` (D-11).

---

### `supabase/migrations/059_harness_audit_and_threads_col.sql` (migration, event-driven + transform)

**Analogs:** `supabase/migrations/030_missing_tables.sql` (`audit_log` INSERT-only) and `055_todos_table.sql` (ALTER ADD COLUMN + FK SET NULL).

**INSERT-only audit table** — `030_missing_tables.sql:7-32` (the `audit_log` pattern: SELECT-owner is implied missing here — 030 ships ONLY an INSERT policy; for `harness_audit` D-10 wants SELECT owner + INSERT, no UPDATE/DELETE):
```sql
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_type_check CHECK (
    action_type IN (
      'document.upload', 'document.delete', 'search.query',
      'code.execute', 'skill.load', 'thread.create',
      'thread.delete', 'settings.update',
      'memory.remember', 'memory.recall',
      'feedback.submit'
    )
  )
);

CREATE INDEX IF NOT EXISTS audit_log_user_created_idx
  ON public.audit_log (user_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own audit entries"
  ON public.audit_log FOR INSERT
  WITH CHECK (user_id = auth.uid());
-- NO UPDATE/DELETE policy → RLS denies mutation (INSERT-only)
```
> The INSERT-only enforcement is the *absence* of UPDATE/DELETE policies (RESEARCH §Pattern 4). For `harness_audit`, ADD a SELECT-owner policy (D-10 wants the user/operator to inspect): `CREATE POLICY "Users can view own harness audit" ON public.harness_audit FOR SELECT USING (auth.uid() = user_id);`. Use the same `text + CHECK` constraint shape for `event_type` (NOT a Postgres ENUM — RESEARCH anti-pattern; CHECK is cheap to ALTER). The CHECK list MUST cover SC#3's three categories (phase transitions, gate results, tool refusals) — RESEARCH §Pattern 4 proposes the full set.
>
> **audit→run linkage (D-09):** RESEARCH recommends a plain `run_id uuid` with NO FK (audit survives run deletion). The `SET NULL` FK alternative also satisfies D-09 — planner's call. Do NOT use CASCADE (RESEARCH anti-pattern).

**ALTER ADD COLUMN + FK SET NULL** — `055_todos_table.sql:39-42` (the exact shape for the `threads.active_workflow_run_id` add):
```sql
ALTER TABLE public.runs
    ADD COLUMN parent_run_id uuid REFERENCES public.runs(run_id) ON DELETE SET NULL;
CREATE INDEX idx_runs_parent ON public.runs(parent_run_id) WHERE parent_run_id IS NOT NULL;
```
> → `ALTER TABLE public.threads ADD COLUMN active_workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL;` (D-12: ONLY this column; `deep_mode_metadata` is NOT created). The partial-index-WHERE-NOT-NULL idiom (`055:42`) is reusable if planner wants an index. **Apply-ordering:** if the FK to `workflow_runs` is included, 059 must apply AFTER 057 (sequential SQL-editor apply handles this — RESEARCH OQ2).

---

### `backend/app/models/harness.py` (model, transform — JSONB parse)

**Analogs:** `backend/app/models/workspace.py` (the `from __future__ import annotations` + plain v2 `BaseModel` convention) and `backend/app/models/skill.py` (model-grouping conventions).

**Module/import convention** — `backend/app/models/workspace.py:1-6` (copy the header verbatim):
```python
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel
```
> Existing models are plain v2 `BaseModel` with NO `model_config`. `harness.py` is the FIRST file to introduce `ConfigDict(extra='forbid')` (D-07) — add `ConfigDict` to the import line. The `from __future__ import annotations` header is present in `workspace.py` (NOT in `skill.py`) — use it for the discriminated-union forward refs.

**Discriminated-union + strict-parsing shape (NEW — no in-repo Pydantic-v2-discriminated-union analog; verified against pydantic 2.12.5 + official docs):** RESEARCH §Pattern 6 has the full literal skeleton (`_StrictBase(BaseModel)` with `model_config = ConfigDict(extra="forbid")`, 5 phase-config classes each with a `Literal["..."]` `phase_type` field, `PhaseConfig = Annotated[Union[...], Field(discriminator="phase_type")]`, plus `ValidatorSpec`, `PhaseSpec`, `WorkflowDefinition`). Copy that skeleton directly.
> **Field shapes are PROVISIONAL** (RESEARCH A1 / Claude's Discretion): the discriminator mechanism + `extra='forbid'` + union structure are LOCKED; individual per-phase field names (`prompt`, `available_tools`, `max_steps`, `merge_strategy`) are derived from Phase 091's needs and must stay flexible. The 5 phase-type names and 4 validator kinds are firm (ROADMAP 091 SC#1/#3, verbatim).

---

### `backend/tests/unit/test_harness_models.py` (test, request-response)

**Analogs:** `backend/tests/unit/test_write_todos_coercion.py` (pure-Python, no live DB — the model the planner must follow since pytest mocks Supabase) and `backend/tests/unit/test_resolve_max_tokens.py` (parametrize + structured-assert shape).

**Pure-Python test convention** — `test_write_todos_coercion.py:1-21` (module docstring stating WHAT each case proves + "no live Postgres", `from __future__ import annotations`, focused imports):
```python
"""Regression tests for ... (no live Postgres):
  (a) a valid stringified JSON array is parsed ...
  (b) a malformed string returns a friendly error ...
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, patch

from app.services.tool_dispatcher import _handle_write_todos, ToolContext, ToolResult
```

**assert-raises / boundary style** — `test_resolve_max_tokens.py:32-52` shows the `@pytest.mark.parametrize` + assert-on-structured-error idiom. For `harness.py`, the equivalent is `pytest.raises(ValidationError)` on the extra-key / wrong-phase_type cases:
```python
@pytest.mark.parametrize("explicit,expected_returned,should_clamp", [
    (32000, 32000, False),
    (64000, 64000, False),
    (65536, 64000, True),
])
def test_clamp_haiku_4_5(haiku_settings, caplog, explicit, expected_returned, should_clamp):
    ...
    assert result == expected_returned, (...)
```
> Required cases (RESEARCH §Wave 0 Gaps + Test Map, covers SC#5 / D-07): (1) `test_valid_seed_parses` — `WorkflowDefinition.model_validate(seed)` succeeds against the migration 056 seed JSONB; (2) `test_extra_key_rejected` — `pytest.raises(ValidationError)` on an unknown key (D-07 `extra='forbid'`); (3) wrong `phase_type` rejected; (4) each of the 5 phase configs validates. This file runs cleanly in the MOCKED pytest harness (NO DB needed) — it is the ONLY phase-090 test that does. Quick run: `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_harness_models.py -x`.

---

### `supabase/verify_090.sql` (test, live-DB SQL verification) — NO in-repo analog

This live-DB verification script is the `autonomous: false` human-run gate (pasted into the Supabase SQL editor against the local DB). There is no `verify_*.sql` precedent in `supabase/` (confirmed: none exist). It is a new artifact type, but its CONTENTS map directly to introspection queries against shipped objects:
- **Immutability refusal (HARNESS-02):** publish a row, attempt UPDATE → expect SQLSTATE 23514 (the trigger from 056 raises with `ERRCODE='check_violation'`).
- **DELETE RESTRICT (HARNESS-02/SC#2):** insert a run referencing a def, attempt DELETE def → expect FK violation 23503.
- **UNIQUE collision:** two rows same `(slug, version)` → expect 23505.
- **Cross-user RLS denial (SC#3):** two auth contexts, user B SELECTs user A's run → expect 0 rows.
- **INSERT-only check (HARNESS-06):** query `pg_policies` for `harness_audit` → only SELECT + INSERT present.
- **Presence introspection (SC#1):** `information_schema.tables` / `columns` confirm 4 tables + `threads.active_workflow_run_id`.

> RESEARCH §Pitfall 1 + §Validation Architecture are emphatic: pytest MOCKS Supabase (`backend/tests/conftest.py` returns MagicMock) — RLS / immutability / DELETE-RESTRICT CANNOT be verified in pytest. This SQL script (or a documented SQL-editor checklist) is the only path for SC#1/#2/#3 + HARNESS-06.

---

## Shared Patterns

### org_id forward-compat column (D-11)
**Source:** NEW — no existing table carries `org_id` (RESEARCH A3, grep across all migrations found zero).
**Apply to:** ALL four new tables (`workflow_definitions`, `workflow_runs`, `workflow_phases`, `harness_audit`).
```sql
org_id uuid,   -- nullable, NO FK, NO RLS predicate references it in v2.8
COMMENT ON COLUMN public.workflow_definitions.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';
```

### RLS-on-every-table (CLAUDE.md non-negotiable)
**Source:** Every shipped migration (017, 030, 054, 055).
**Apply to:** ALL four new tables. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` is mandatory; globals (`workflow_definitions.is_global`) are the only shared scope, exactly like skills/folders.

### Migration apply + regenerate process (CLAUDE.md schema rule)
**Source:** CLAUDE.md § schema-changes.
**Apply to:** Every migration task in this phase.
1. Filename `<digits>_name.sql` — NO letter suffixes (`056b` silently skipped by Supabase CLI).
2. Apply by PASTING into the Supabase SQL editor in order 056→059 (NEVER `db push`/`db reset` — destroys dev data). This is an `autonomous: false` human checkpoint.
3. After each apply: `bash scripts/regenerate-full-schema.sh` (no-reset live dump). NEVER hand-edit `full-schema.sql`.
4. Commit migration + regenerated schema together.

### Pydantic for structured config (CLAUDE.md)
**Source:** All `backend/app/models/*.py` are Pydantic; `workspace.py` / `skill.py` are plain v2 `BaseModel`.
**Apply to:** `harness.py` — but introduce `ConfigDict(extra='forbid')` (D-07), the first strict-parsing model in the codebase.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `supabase/verify_090.sql` | test (live-DB SQL) | request-response | No `verify_*.sql` exists in `supabase/` — first live-DB verification script. Contents map to standard `information_schema` / `pg_policies` introspection + error-code assertions (23514/23503/23505), but the file as a deliverable has no in-repo precedent. The pytest suite cannot substitute (mocks Supabase). |

**Partial-NEW artifacts** (have a structural analog but core logic is new):
- The immutable-on-publish `BEFORE UPDATE` trigger in 056 — structural shape from `set_updated_at()` (`full-schema.sql:198-205`), but the `OLD.status='published'` RAISE logic is new (RESEARCH §Pattern 3).
- The discriminated-union in `harness.py` — model conventions from `workspace.py`, but the `Annotated[Union[...], Field(discriminator=...)]` + `extra='forbid'` pattern is new to this codebase (verified vs pydantic 2.12.5).
- `ON DELETE RESTRICT` FK in 057 — no shipped migration uses RESTRICT (all are CASCADE / SET NULL).

## Metadata

**Analog search scope:** `supabase/migrations/` (017, 018, 030, 054, 055 read in full), `backend/app/models/` (skill.py, workspace.py), `backend/tests/unit/` (test_write_todos_coercion.py, test_resolve_max_tokens.py).
**Files scanned:** 9 analog files read in full; migration head + verify-script-absence confirmed via `ls`.
**Pattern extraction date:** 2026-05-31
