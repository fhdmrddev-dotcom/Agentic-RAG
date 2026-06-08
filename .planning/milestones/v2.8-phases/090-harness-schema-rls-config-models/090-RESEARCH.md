# Phase 090: Harness Schema + RLS + Config Models - Research

**Researched:** 2026-05-30
**Domain:** Postgres schema + RLS + Pydantic config models (the v2.8 workflow-harness substrate — migrations + ownership/immutability/audit + discriminated-union config parsing)
**Confidence:** HIGH (every SQL pattern extracted from real shipped migrations; Pydantic pattern cross-checked against official v2 docs and the installed version 2.12.5)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `workflow_definitions` uses the **skills ownership model**: `created_by uuid` (FK `auth.users`) + `is_global boolean DEFAULT false`. SELECT RLS = `auth.uid() = created_by OR is_global = true`. INSERT/UPDATE/DELETE scoped to `auth.uid() = created_by`.
- **D-02:** The 2–3 **seed workflow templates ship as `is_global = true`** — every user sees them, like global skills. Follow whatever pattern global skills already use for the `created_by` of globals.
- **D-03:** Regular users **CAN author their own private workflow definitions** in v1 (owned, RLS-scoped). No operator/super_admin gate (deferred to v2.9 / D-v2.8-01).
- **D-04:** A definition carries a **`status` column (`draft` | `published`)**. Draft rows freely editable; **publishing freezes the row** — a `BEFORE UPDATE` trigger blocks mutations once `status = 'published'` (immutability conditional on published state, NOT on every insert).
- **D-05:** To change a published workflow, **create a NEW row with `version + 1`** (same `slug`). `UNIQUE(slug, version)` enforces no in-place version reuse.
- **D-06:** FK `ON DELETE RESTRICT` from `workflow_runs` → `workflow_definitions`: a referenced version cannot be deleted (SC#2).
- **D-07:** Phase-config Pydantic models use **strict parsing — `extra = 'forbid'`**. Unknown/typo'd keys fail `model_validate()` with a structured error. Lenient/forward-compat parsing deferred.
- **D-08:** **No TTL / retention purge in v2.8.** `harness_audit` keeps all rows forever.
- **D-09:** Audit trail is **independent of run/definition deletion** — `harness_audit` rows do NOT cascade with a parent run. Whether audit→run is a nullable FK `SET NULL` or a plain stored `run_id` is a planner detail; invariant = audit rows persist.
- **D-10:** `harness_audit` is **INSERT-only** (no UPDATE/DELETE RLS policies — only SELECT for the owner + INSERT), mirroring `audit_log` in `030_missing_tables.sql`.
- **D-11:** Every new table carries **`org_id uuid NULL`** from day 1 (D-PRD-02 forward-compat), but all RLS predicates stay **user-scoped** for v2.8.
- **D-12:** `threads.deep_mode_metadata jsonb` is **NOT created** (research delta #4). Only `threads.active_workflow_run_id` is added.

### Claude's Discretion
- Exact migration file split (one-per-table 056–059 vs combined), column names/types beyond those named, index choices (research suggests `(workflow_run_id, phase_index)` on `workflow_phases`), trigger function naming, and the seed-template `created_by` mechanism for globals.
- The precise `harness_audit` event-type enum/shape (SC#3 names: phase transitions, gate results, tool refusals) and the audit→run linkage mechanism (SET NULL FK vs plain stored id).
- Pydantic model field shapes for each of the 5 phase-type configs (derived from what the 091 engine needs — coordinate with Phase 091, which is downstream).

### Deferred Ideas (OUT OF SCOPE)
- Operator / super_admin role tier for restricting who publishes global workflows → v2.9 (D-v2.8-01).
- Audit retention / TTL purge mechanism → until audit volume is a real concern (D-08).
- Lenient / forward-compatible config parsing (`extra='ignore'`) → until a real cross-version compat need (D-07).
- Org-level RLS / multi-tenancy (`org_id` carried NULL only; no org-scoped predicates in v2.8).
- `deep_mode_metadata jsonb` — dropped, not deferred; revive only if a concrete consumer appears.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARNESS-02 | Workflow definitions are **versioned and immutable-on-publish** (`UNIQUE(slug, version)` + `BEFORE UPDATE` DB trigger + FK `ON DELETE RESTRICT`); a published workflow re-runs reproducibly. | The immutable-on-publish trigger SQL (§ Pattern 3), `UNIQUE(slug, version)` constraint shape, and `ON DELETE RESTRICT` FK from `workflow_runs` are all specified below with literal SQL. The `set_updated_at` trigger (`full-schema.sql:198`) is the structural template; the immutability trigger is NEW. `[VERIFIED: supabase/full-schema.sql, supabase/migrations/017_skills.sql]` |
| HARNESS-06 | Every phase transition, gate result, and tool refusal is recorded to an **INSERT-only `harness_audit` trail** the user/operator can inspect. | `audit_log` in `030_missing_tables.sql` is the exact INSERT-only template (SELECT owner + INSERT WITH CHECK, no UPDATE/DELETE policies). `harness_audit` shape + event-type CHECK constraint + audit→run linkage proposed below. `[VERIFIED: supabase/migrations/030_missing_tables.sql]` |
</phase_requirements>

## Summary

This phase is pure Postgres substrate plus three Pydantic config models — **zero runtime, zero API endpoints, zero engine code** (those are Phases 091/092). Every piece has a proven precedent already shipped in this repo, so there is almost no novel design risk. The four new tables (`workflow_definitions`, `workflow_runs`, `workflow_phases`, `harness_audit`) plus one column add (`threads.active_workflow_run_id`) map onto patterns lifted verbatim from migrations 017 (ownership/is_global), 054/055 (FK-chain RLS), and 030 (INSERT-only audit). The single genuinely-new SQL artifact is the **immutable-on-publish `BEFORE UPDATE` trigger** — and even that reuses the structural shape of the universal `set_updated_at()` trigger function.

The migration head is confirmed at **055** (`055_todos_table.sql` is the last file) — so the new migrations number **056–059**. The PRD's reserved range 125–139 is stale fiction (per SUMMARY.md finding #5). Pydantic is **2.12.5** and jsonschema is **4.26.0**, both installed in `backend/venv`. The `PhaseConfig` discriminated union is the canonical Pydantic v2 `Annotated[Union[...], Field(discriminator='phase_type')]` pattern with `ConfigDict(extra='forbid')` on each member — verified against the official docs and the installed version.

The one execution-shape gotcha the planner MUST internalize: **migrations are applied BY HAND via the Supabase SQL editor (never `db push`/`db reset`), and the pytest suite mocks Supabase entirely — there is no live-DB fixture.** This means (a) the migration-apply task is `autonomous: false` (a human pastes SQL), and (b) the RLS/immutability/DELETE-RESTRICT success criteria cannot be verified by the existing mocked pytest harness — they must be verified by querying the live local Supabase directly (psql or the SQL editor), OR by a NEW live-DB integration test fixture. The Pydantic `model_validate()` strict-reject test is the ONLY SC that runs cleanly in plain pytest.

**Primary recommendation:** Split into 4 one-per-table migration files (`056`–`059`) + one Pydantic models file (`backend/app/models/harness.py`) + a seed-templates migration (or fold seeds into 056). Copy the RLS policy SQL verbatim from 054/055, the ownership SQL from 017, the INSERT-only SQL from 030. Write the immutable-on-publish trigger as a NEW `plpgsql` function that raises when `OLD.status = 'published'`. Verify RLS/immutability against the **live local Supabase**, not the mock suite.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workflow definition storage + versioning | Database / Storage | — | Versioned templates with `UNIQUE(slug, version)` are inherently a relational-integrity concern. |
| Immutable-on-publish enforcement | Database / Storage | — | A DB `BEFORE UPDATE` trigger is the only tamper-proof enforcement point (HARNESS-02 demands DB-level, not app-level). |
| Per-user data isolation (runs/phases/audit) | Database / Storage | — | RLS at the Postgres row level is the project's non-negotiable isolation mechanism (CLAUDE.md). |
| Audit trail (INSERT-only) | Database / Storage | — | INSERT-only enforced by RLS policy shape (no UPDATE/DELETE policies = no path to mutate). |
| Phase-config schema validation | API / Backend | — | Pydantic `model_validate()` runs in the backend (Phase 091 engine reads the JSONB and parses it). This phase only DEFINES the models; nothing calls them at runtime yet. |
| Dual-mode anchor (`active_workflow_run_id`) | Database / Storage | API / Backend | The column lives in Postgres; Phase 092's `agent_runner` branch reads it. This phase only adds the column. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL (via Supabase) | local CLI v2.101 | Tables, RLS, triggers, constraints | `[VERIFIED: reference_evidence_tools_inventory memory]` Project's sole datastore for relational data; RLS is the isolation mechanism. |
| pydantic | 2.12.5 | `PhaseConfig` / `ValidatorSpec` / `WorkflowDefinition` config models, discriminated union, strict parsing | `[VERIFIED: backend/venv python -c "import pydantic; pydantic.VERSION" → 2.12.5]` CLAUDE.md mandates Pydantic for structured outputs; v2 has first-class discriminated-union + `extra='forbid'`. |
| jsonschema | 4.26.0 | Optional JSON-schema validation alongside Pydantic (Phase 091's `json_schema` validator gate) | `[VERIFIED: backend/venv → 4.26.0]` Already installed; NOT required for this phase's config models (Pydantic `extra='forbid'` is the primary validator per D-07) but available. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| asyncpg | >=0.29 | Typed DB helpers (`db/workflows.py`) | `[CITED: ARCHITECTURE.md sources]` NOT in this phase — Phase 091 adds `db/workflows.py`. This phase is schema only. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `is_global` boolean ownership | `org_id`-scoped sharing | `[ASSUMED]` org schema undecided (D-11); `is_global` is the shipped, proven sharing model for skills/folders. Use it. |
| App-level immutability check | DB `BEFORE UPDATE` trigger | HARNESS-02 explicitly demands a DB trigger — app-level checks are bypassable via direct SQL. Use the trigger. |
| Pydantic discriminated union | Plain `Union` + manual `phase_type` switch | Plain union gives worse error messages and slower validation; discriminated union is the Pydantic-v2 idiom and `extra='forbid'` works per-member. Use discriminated. |

**Installation:** No new packages. pydantic 2.12.5 + jsonschema 4.26.0 already in `backend/venv`.

**Version verification:**
```
pydantic 2.12.5     [VERIFIED: backend/venv/Scripts/python.exe -c "import pydantic; print(pydantic.VERSION)"]
jsonschema 4.26.0   [VERIFIED: same]
```

## Architecture Patterns

### System Architecture Diagram (data flow through the schema)

```
                AUTHORING / SEED                          RUNTIME (Phase 091/092 — NOT this phase)
                      │                                              │
  is_global seed user │  regular user (auth.uid())                  │  agent_runner reads
  00000…0001          │                                             │  threads.active_workflow_run_id
        │             │                                             │         │
        ▼             ▼                                             ▼         ▼
  ┌─────────────────────────────┐   ON DELETE RESTRICT   ┌──────────────────────────┐
  │ workflow_definitions        │◀──────────────────────│ workflow_runs            │
  │  slug, version              │   (D-06: referenced    │  thread_id ─FK─▶ threads │
  │  UNIQUE(slug, version)      │    version undeletable)│  status                  │
  │  status draft|published     │                        │  org_id NULL             │
  │  created_by ─FK─▶ auth.users│                        └────────────┬─────────────┘
  │  is_global                  │                                     │ FK
  │  org_id NULL                │                                     ▼
  │  ── BEFORE UPDATE trigger ──│                        ┌──────────────────────────┐
  │     raises if OLD.status    │                        │ workflow_phases          │
  │     = 'published' (D-04)    │                        │  workflow_run_id ─FK─▶   │
  └─────────────────────────────┘                        │  phase_index             │
   RLS: auth.uid()=created_by                            │  status, output jsonb    │
        OR is_global=true                                │  org_id NULL             │
                                                          └──────────────────────────┘
                                                          RLS: 2-hop JOIN through
                                                               workflow_runs → threads.user_id

  ┌──────────────────────────────────────┐
  │ harness_audit (INSERT-only, D-10)     │   audit→run linkage:
  │  user_id ─FK─▶ auth.users             │   plain stored run_id (no hard FK) OR
  │  run_id (nullable, NO cascade — D-09) │   nullable FK SET NULL — EITHER preserves
  │  event_type CHECK (...)               │   audit rows on run delete (D-09 invariant)
  │  metadata jsonb, org_id NULL          │
  └──────────────────────────────────────┘
  RLS: SELECT auth.uid()=user_id ; INSERT WITH CHECK auth.uid()=user_id ; NO update/delete

  threads ──ADD COLUMN active_workflow_run_id uuid NULL── (D-12: deep_mode_metadata NOT added)
```

### Recommended Project Structure
```
supabase/migrations/
├── 056_workflow_definitions.sql   # table + ownership RLS + UNIQUE(slug,version) + immutable trigger + (optional) seeds
├── 057_workflow_runs.sql          # table + FK→definitions (ON DELETE RESTRICT) + FK-chain RLS
├── 058_workflow_phases.sql        # table + 2-hop FK-chain RLS + index (workflow_run_id, phase_index)
└── 059_harness_audit_and_threads_col.sql  # harness_audit (INSERT-only) + ALTER threads ADD active_workflow_run_id
                                            # (combine the audit table + the threads column, OR split 059/060)

backend/app/models/
└── harness.py    # NEW: PhaseConfig (discriminated union), ValidatorSpec, WorkflowDefinition

supabase/full-schema.sql           # REGENERATED after each migration applied (never hand-edited)
```

> **File-split recommendation (Claude's Discretion D-090):** One-per-table (056–059) is the cleaner choice and matches how 054/055 each own one logical concern. The `threads` column add is tiny — fold it with `harness_audit` into 059, or give it its own 060. Seed templates (D-02) can fold into 056 (the definitions migration) OR ship as a separate `060_workflow_seed_templates.sql` — separate is cleaner because seeds may be iterated independently of the schema. **Filename rule (CLAUDE.md): `<digits>_name.sql` — NO letter suffixes (`056b` is silently skipped by the Supabase CLI).**

### Pattern 1: Ownership + global sharing (workflow_definitions) — copy from 017_skills.sql

**What:** Owner-private with a global-shared escape hatch, exactly like skills/folders.
**When to use:** `workflow_definitions` (D-01/D-02/D-03).
**Source:** `supabase/migrations/017_skills.sql:27-41` `[VERIFIED]`

```sql
-- workflow_definitions ownership/sharing (mirror 017_skills.sql exactly)
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global workflow definitions"
  ON public.workflow_definitions FOR SELECT
  USING (auth.uid() = created_by OR is_global = true);

CREATE POLICY "Users can insert own workflow definitions"
  ON public.workflow_definitions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own workflow definitions"
  ON public.workflow_definitions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own workflow definitions"
  ON public.workflow_definitions FOR DELETE
  USING (auth.uid() = created_by);
```

> NOTE: D-01 names the column `created_by` (not `user_id`). 017 uses `user_id`; substitute `created_by` consistently. The semantics are identical.

### Pattern 2: FK-chain RLS (workflow_runs 1-hop, workflow_phases 2-hop) — copy from 054/055

**What:** Tables with no direct `user_id` reach `auth.uid()` by walking the FK chain to `threads.user_id`.
**When to use:** `workflow_runs` (1-hop), `workflow_phases` (2-hop JOIN).
**Source:** `supabase/migrations/054_workspace_files.sql:39-76` + `055_todos_table.sql:23-37` `[VERIFIED]`

```sql
-- workflow_runs: 1-hop chain (run.thread_id → threads.user_id) — mirrors todos/workspace_files
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_runs_select_own" ON public.workflow_runs
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workflow_runs_insert_own" ON public.workflow_runs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workflow_runs_update_own" ON public.workflow_runs
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workflow_runs_delete_own" ON public.workflow_runs
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

-- workflow_phases: 2-hop JOIN (phase.workflow_run_id → workflow_runs.thread_id → threads.user_id)
-- mirrors workspace_file_versions (054:58-66) EXACTLY
ALTER TABLE public.workflow_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_phases_select_own" ON public.workflow_phases
    FOR SELECT TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workflow_runs wr ON wr.thread_id = t.id
            WHERE wr.id = workflow_run_id
        )
    );
-- INSERT/UPDATE/DELETE: same JOIN predicate in WITH CHECK / USING
```

### Pattern 3: Immutable-on-publish BEFORE UPDATE trigger (NEW) — structural template from set_updated_at

**What:** A `BEFORE UPDATE` trigger function that raises an exception when the row being updated is already `published` (D-04). This is the HARNESS-02 enforcement core and the ONLY genuinely-new SQL artifact in this phase.
**When to use:** `workflow_definitions` only.
**Structural template:** `public.set_updated_at()` (`full-schema.sql:198-205`) shows the `plpgsql` `BEFORE UPDATE FOR EACH ROW` shape `[VERIFIED]`. The immutability LOGIC is new.

```sql
-- NEW trigger function — block any UPDATE on an already-published definition (D-04)
CREATE OR REPLACE FUNCTION public.workflow_definitions_block_published_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION
      'workflow_definitions row % is published and immutable; create a new version instead',
      OLD.id
      USING ERRCODE = 'check_violation';   -- SQLSTATE 23514, distinguishable in tests
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_definitions_block_published ON public.workflow_definitions;
CREATE TRIGGER workflow_definitions_block_published
  BEFORE UPDATE ON public.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION public.workflow_definitions_block_published_update();
```

> **Design note:** The trigger keys on `OLD.status` so a DRAFT row stays freely editable (including the `draft → published` transition itself, where `OLD.status = 'draft'`). Once a row is published, ALL subsequent updates raise. This is exactly D-04 ("immutability conditional on published state, NOT on every insert"). The `set_updated_at` trigger can ALSO be attached for `updated_at` maintenance on draft edits — order doesn't matter since the block-published trigger short-circuits with an exception before any other trigger fires meaningfully on published rows.

### Pattern 4: INSERT-only audit table — copy from 030_missing_tables.sql audit_log

**What:** A table with only SELECT (owner) + INSERT (owner) RLS policies — the absence of UPDATE/DELETE policies means RLS denies all mutation, making rows immutable (D-10).
**Source:** `supabase/migrations/030_missing_tables.sql:7-32` `[VERIFIED]`

```sql
CREATE TABLE IF NOT EXISTS public.harness_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id      uuid,                 -- D-09: plain stored id, NO hard FK → audit survives run delete
                                    --       (alternative: uuid REFERENCES workflow_runs(id) ON DELETE SET NULL)
  event_type  text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}',
  org_id      uuid,                 -- D-11 forward-compat, NULL, no FK
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
      'phase_started', 'phase_completed', 'phase_transition',
      'gate_passed', 'gate_failed',
      'tool_refused',
      'run_started', 'run_completed', 'run_failed'
    )
  )
);
CREATE INDEX idx_harness_audit_user_created ON public.harness_audit (user_id, created_at DESC);
CREATE INDEX idx_harness_audit_run ON public.harness_audit (run_id) WHERE run_id IS NOT NULL;

ALTER TABLE public.harness_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own harness audit" ON public.harness_audit
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own harness audit" ON public.harness_audit
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- NO UPDATE policy, NO DELETE policy → RLS denies all mutation (INSERT-only, D-10)
```

> **Event-type set (Claude's Discretion):** The CHECK list above covers SC#3's three named categories (phase transitions, gate results, tool refusals) plus run lifecycle. The planner may trim or extend; the only hard requirement is that the three SC#3 categories are representable. SC#3 names exactly: phase transitions, gate results, tool refusals. **Coordinate the precise enum with Phase 091** (the engine emits these) — keep it a CHECK constraint (cheap to ALTER later) rather than a Postgres `ENUM` type (harder to extend).
>
> **audit→run linkage (D-09, Claude's Discretion):** A plain `run_id uuid` with NO FK is the simplest way to guarantee audit rows survive run deletion. The nullable-FK-`SET NULL` alternative also satisfies D-09 but couples the audit table to `workflow_runs` existence at insert time (the FK would reject an audit row referencing a not-yet-committed run). **Recommend the plain stored `run_id` with no hard FK** — it decouples the audit trail completely and matches "the audit trail is independent of run/definition deletion."

### Pattern 5: org_id forward-compat column

**What:** `org_id uuid NULL` on every new table (D-11). No FK (the org table doesn't exist yet). No RLS predicate references it in v2.8.
**Precedent:** No existing table carries `org_id` yet `[VERIFIED: grep across migrations found none]` — this is the first introduction, per D-PRD-02. The shape is simply `org_id uuid` (nullable by default, no constraint). Document the intent in a column comment:
```sql
COMMENT ON COLUMN public.workflow_definitions.org_id IS
  'Forward-compat (D-PRD-02/D-11): org-level multi-tenancy. NULL in v2.8; no FK until org schema exists; RLS stays user-scoped.';
```

### Pattern 6: Pydantic v2 discriminated union with strict parsing (harness.py)

**What:** `PhaseConfig` is a discriminated union over the 5 phase types, each with `extra='forbid'`.
**Source:** `[CITED: pydantic.dev/docs/validation/latest/concepts/unions]` + installed pydantic 2.12.5.

```python
# backend/app/models/harness.py
from __future__ import annotations
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field


class _StrictBase(BaseModel):
    model_config = ConfigDict(extra="forbid")   # D-07: typo'd/unknown key → ValidationError


# ── 5 phase-type configs (HARNESS-01 / 091 SC#1) ────────────────────────────
class ProgrammaticPhaseConfig(_StrictBase):
    phase_type: Literal["programmatic"]
    fn: str                                      # PROGRAMMATIC_PHASE_REGISTRY key
    # input mapping fields — coordinate with 091

class LlmSinglePhaseConfig(_StrictBase):
    phase_type: Literal["llm_single"]
    prompt: str
    # model/temperature overrides — coordinate with 091

class LlmAgentPhaseConfig(_StrictBase):
    phase_type: Literal["llm_agent"]
    prompt: str
    available_tools: list[str]                   # the per-phase whitelist (091 Pattern 1)
    max_steps: int = 10

class LlmBatchAgentsPhaseConfig(_StrictBase):
    phase_type: Literal["llm_batch_agents"]
    prompt: str
    available_tools: list[str]
    max_steps: int = 10
    max_parallel_agents: int = 5                 # scaling cap (ARCHITECTURE.md)
    merge_strategy: str = "concat"

class LlmHumanInputPhaseConfig(_StrictBase):
    phase_type: Literal["llm_human_input"]
    prompt: str                                  # the ask_user prompt

PhaseConfig = Annotated[
    Union[
        ProgrammaticPhaseConfig,
        LlmSinglePhaseConfig,
        LlmAgentPhaseConfig,
        LlmBatchAgentsPhaseConfig,
        LlmHumanInputPhaseConfig,
    ],
    Field(discriminator="phase_type"),
]


class ValidatorSpec(_StrictBase):
    # HARNESS-04 gate kinds (091 owns execution; this is the shape)
    kind: Literal["json_schema", "regex_match", "workspace_file_exists", "programmatic"]
    config: dict = Field(default_factory=dict)
    on_failure: str = "fail_run"                 # fail_run | retry | skip_to_phase:<slug>
    max_retries: int = 2


class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig                          # parsed via discriminator
    validators: list[ValidatorSpec] = Field(default_factory=list)


class WorkflowDefinition(_StrictBase):
    slug: str
    version: int
    name: str
    status: Literal["draft", "published"] = "draft"
    phases: list[PhaseSpec]                       # the JSONB column parsed via model_validate()
```

Parsing the JSONB column:
```python
# Phase 091 will do this; the test in THIS phase proves it works against a seed:
wf = WorkflowDefinition.model_validate(row["definition_jsonb"])   # raises ValidationError on bad config
```

> **Field shapes are PROVISIONAL (Claude's Discretion + coordinate-with-091).** The discriminator mechanism, `extra='forbid'`, and the union structure are LOCKED and correct. The individual field names inside each phase config (`prompt`, `available_tools`, `max_steps`, `merge_strategy`, etc.) are **derived from what the Phase 091 engine needs** and MUST stay flexible — 091 is downstream and may refine them. `[ASSUMED]` on the exact per-phase field set; the union skeleton is `[VERIFIED]` against pydantic 2.12.5 + official docs. The 091 SC#1/#3 in ROADMAP.md confirm the 5 phase-type names and the 4 validator kinds verbatim, so those literals are firm.

### Anti-Patterns to Avoid
- **Letter-suffixed migration filenames (`056b_...`)** — the Supabase CLI silently skips them (CLAUDE.md). Use `056`, `057`, ... only.
- **`supabase db push` / `db reset`** — destroys dev data. Apply by pasting into the SQL editor (CLAUDE.md).
- **Hand-editing `full-schema.sql`** — always regenerate via `bash scripts/regenerate-full-schema.sh` (no-reset live dump).
- **Postgres `ENUM` type for event_type** — harder to ALTER than a `text` + CHECK constraint when 091 adds event kinds. Use CHECK.
- **Cascading `harness_audit` with runs** — violates D-09 (audit must survive run deletion). Use plain `run_id` or `SET NULL`, never `CASCADE`.
- **`extra='ignore'` on phase configs** — violates D-07. Use `extra='forbid'`.
- **Adding `threads.deep_mode_metadata`** — explicitly dropped (D-12). Add ONLY `active_workflow_run_id`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-user data isolation | Manual `WHERE user_id = ?` in every query | Postgres RLS (copy 054/055 policies) | RLS is enforced at the DB even for direct SQL; app-level filtering is bypassable and project-forbidden. |
| Immutability enforcement | App-level "is it published?" check before UPDATE | DB `BEFORE UPDATE` trigger | HARNESS-02 demands DB-level; app checks bypassable via SQL editor / direct asyncpg. |
| Audit immutability | A `is_deleted` soft-delete flag | Omit UPDATE/DELETE RLS policies (030 pattern) | No policy = RLS denies the operation = truly INSERT-only. Simpler and tamper-proof. |
| Config validation | Hand-written `if "phase_type" not in cfg` dispatch | Pydantic discriminated union | Discriminated union gives structured per-field errors, `extra='forbid'` catches typos, and is the idiom for the JSONB-parse path. |
| Global-template ownership | A nullable `created_by` for globals | The seed system user `00000000-…-0001` (018 pattern) | Keeps the FK NOT-NULL-able and matches the shipped global-skill seed mechanism exactly. |

**Key insight:** This phase has essentially zero legitimate hand-rolling. Every artifact is a copy-with-rename of a shipped migration, except the immutable-publish trigger (which reuses the `set_updated_at` structural shape).

## Runtime State Inventory

> This is a greenfield schema-addition phase (new tables, one new column, new Pydantic file). It is NOT a rename/refactor/migration-of-existing-data phase. The Runtime State Inventory categories below are answered for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — all four tables are NEW; no existing data is renamed or re-keyed. `threads.active_workflow_run_id` is a new nullable column (existing rows get NULL). | None |
| Live service config | None — no external service (n8n/Datadog/Tailscale) references these table names; they don't exist yet. | None |
| OS-registered state | None — no Task Scheduler / pm2 / systemd registration touches schema. | None |
| Secrets/env vars | None — no new secret or env var; DB connection is the existing `SUPABASE_URL`. | None |
| Build artifacts | `full-schema.sql` MUST be regenerated after applying each migration (it is a build artifact, not hand-edited). | Run `bash scripts/regenerate-full-schema.sh` after the SQL-editor apply, then commit both migration + regenerated schema. |

**The canonical question — after every file is updated, what runtime systems still hold stale state?** Only `full-schema.sql` (regenerate it) and the live local Supabase DB (the migrations must be pasted into the SQL editor — they are NOT auto-applied by writing the file). Both are handled by the apply-and-regenerate task.

## Common Pitfalls

### Pitfall 1: Assuming pytest can verify RLS / immutability / DELETE RESTRICT
**What goes wrong:** Planner writes pytest tests for the RLS-denial and immutability SCs; they pass trivially because the suite MOCKS Supabase (`tests/conftest.py` returns a `MagicMock` for every `.table().select()...`). The tests prove nothing about the actual DB.
**Why it happens:** `pytest.ini` + `conftest.py` `[VERIFIED]` build a fully-mocked Supabase client — there is no live-DB fixture anywhere in `backend/tests/`.
**How to avoid:** RLS/immutability/DELETE-RESTRICT verification MUST run against the **live local Supabase** (psql against the local container, or the SQL editor, or a NEW live-DB integration test that connects with a real anon/service key). Only the Pydantic `model_validate()` strict-reject test runs in plain mocked pytest. See Validation Architecture below.
**Warning signs:** A "RLS test" that imports `client` from `conftest` and never opens a real Postgres connection.

### Pitfall 2: Migration applied to file but not to the live DB
**What goes wrong:** The `.sql` file is written and committed, but the table never actually exists in the local Supabase because no one pasted it into the SQL editor (CLAUDE.md forbids `db push`).
**Why it happens:** Writing the migration file is a code edit; applying it is a separate MANUAL step (`autonomous: false`).
**How to avoid:** The migration-apply task MUST be a human-checkpoint task ("paste 056–059 into the Supabase SQL editor, in order, then confirm"). Verification queries the live DB (`information_schema.tables`, `pg_policies`, `information_schema.triggers`) to confirm presence.
**Warning signs:** `full-schema.sql` regenerated with no new tables → the apply never happened.

### Pitfall 3: Published-row trigger blocks the draft→published transition itself
**What goes wrong:** A naive trigger keyed on `NEW.status = 'published'` would block the very UPDATE that publishes a draft.
**Why it happens:** Confusing "publishing a draft" (allowed) with "mutating a published row" (forbidden).
**How to avoid:** Key the trigger on `OLD.status = 'published'` (Pattern 3). When publishing, `OLD.status = 'draft'` → the trigger allows it; the NOW-published row is frozen against all future updates.
**Warning signs:** An integration test that can't publish a draft at all.

### Pitfall 4: org_id with a FK to a non-existent table
**What goes wrong:** Adding `org_id uuid REFERENCES organizations(id)` fails because no `organizations` table exists.
**Why it happens:** Over-eager forward-compat.
**How to avoid:** `org_id uuid` with NO FK, NO NOT-NULL, NO RLS reference (D-11). Just the column + a comment.

### Pitfall 5: `UNIQUE(slug, version)` without a default-version strategy
**What goes wrong:** Two drafts of the same slug collide on `version` if both default to 1.
**Why it happens:** The uniqueness is on `(slug, version)`, so the author must assign distinct versions.
**How to avoid:** `version integer NOT NULL DEFAULT 1` is fine for the first draft; the "edit a published workflow" flow (D-05) explicitly inserts `version + 1`. Drafts of the SAME slug at the SAME version are a legitimate constraint violation — surface it as an authoring error (this is the desired behavior, not a bug).

## Code Examples

### Example: workflow_definitions table skeleton (assembled from D-01..D-06, D-11)
```sql
-- Source: composed from 017_skills.sql (ownership) + D-04/05/06/11
CREATE TABLE public.workflow_definitions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text NOT NULL,
    version     integer NOT NULL DEFAULT 1,
    name        text NOT NULL,
    description text NOT NULL DEFAULT '',
    status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    definition  jsonb NOT NULL DEFAULT '{}',     -- the phases config parsed by WorkflowDefinition.model_validate()
    created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_global   boolean NOT NULL DEFAULT false,
    org_id      uuid,                            -- D-11 forward-compat
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workflow_definitions_slug_version_unique UNIQUE (slug, version)  -- D-05
);
CREATE INDEX idx_workflow_definitions_created_by ON public.workflow_definitions(created_by);
CREATE INDEX idx_workflow_definitions_slug ON public.workflow_definitions(slug);
```

### Example: workflow_runs + ON DELETE RESTRICT FK (D-06)
```sql
CREATE TABLE public.workflow_runs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id     uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    definition_id uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,  -- D-06: SC#2
    status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'completed', 'failed', 'cancelled')),
    current_phase_id uuid,                       -- nullable; advanced by the engine (091)
    org_id        uuid,                          -- D-11
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_runs_thread ON public.workflow_runs(thread_id);
```

### Example: threads column add (D-12)
```sql
-- Source: D-12 — ONLY active_workflow_run_id; deep_mode_metadata is NOT created
ALTER TABLE public.threads
  ADD COLUMN active_workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL;
-- NULL = Deep Mode; non-null = Harness Mode (Phase 092 reads this).
-- NOTE ordering: this ALTER must run AFTER 057 (workflow_runs) exists if the FK is included.
--                If you prefer to decouple, drop the FK and store a plain uuid.
```

### Example: global seed template (D-02) — reuse the 018 seed-user pattern
```sql
-- Source: 018_skill_creator_seed.sql — the seed system user already exists (00000000-…-0001)
-- after 018 ran, so global workflow seeds just reference it as created_by:
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000a0',
  'research-summarize', 1, 'Research → Summarize', 'published',
  '{ "phases": [ ... ] }'::jsonb,
  '00000000-0000-0000-0000-000000000001',   -- seed system user from 018
  true                                        -- D-02: global
)
ON CONFLICT (id) DO NOTHING;
```
> Seed templates publish-immutable means they ship with `status='published'`. The block-published trigger will then prevent any later UPDATE to them — correct per D-04. (HARNESS-07's 2–3 seed templates are owned by Phase 091; this phase only needs the seed MECHANISM proven, or may ship a single trivial seed as the `model_validate()` fixture.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PRD migration range 125–139 | Real head 055 → renumber 056+ | SUMMARY.md finding #5 (2026-05-30) | The PRD's migration numbers are stale fiction; use 056–059. `[VERIFIED: ls supabase/migrations → last is 055_todos_table.sql]` |
| PRD `threads.deep_mode_metadata jsonb` | Dropped (only `active_workflow_run_id`) | ARCHITECTURE.md research delta #4 | No consumer in v2.8; adding it violates the lean gate (D-12). |
| Pydantic v1 `Union` + custom `__root__` | Pydantic v2 `Annotated[Union, Field(discriminator=...)]` | pydantic 2.x | The installed 2.12.5 uses the v2 idiom; v1 patterns are deprecated. `[CITED: pydantic.dev/docs/validation/latest/concepts/unions]` |

**Deprecated/outdated:**
- Pydantic v1 `class Config:` inner class → v2 `model_config = ConfigDict(...)`. The codebase models (`skill.py`, `workspace.py`) are plain v2 `BaseModel` with no config; `harness.py` introduces `ConfigDict(extra='forbid')`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-phase-config field names (`prompt`, `available_tools`, `max_steps`, `merge_strategy`, etc.) | Pattern 6 | LOW — Phase 091 is the consumer and will refine; the union skeleton + discriminator + `extra='forbid'` are verified. Keep fields flexible. |
| A2 | The exact `harness_audit` event_type enum values | Pattern 4 | LOW — CHECK constraint is cheap to ALTER; only the 3 SC#3 categories are hard requirements. Coordinate final set with 091. |
| A3 | `org_id` is the first introduction (no prior table carries it) | Pattern 5 | LOW — grep across all migrations found zero `org_id`; verified. |
| A4 | Recommending plain `run_id` (no FK) over nullable-FK-SET-NULL for harness_audit | Pattern 4 | LOW — both satisfy D-09; D-09 explicitly leaves this to the planner. |
| A5 | `is_global` ownership preferred over org_id-scoped sharing | Alternatives table | NONE — locked by D-01/D-11. |

**Note:** All structural SQL claims (RLS policy shapes, INSERT-only pattern, trigger structure, UNIQUE/FK constraints, migration head 055) are `[VERIFIED]` against shipped files, not assumed.

## Open Questions

1. **Where do the 2–3 seed templates' `phases` JSONB come from?**
   - What we know: D-02 says they ship `is_global=true`; HARNESS-07 (Phase 091) owns the actual template content (Research→Summarize, Plan→Execute→Verify).
   - What's unclear: Whether Phase 090 ships the full seed templates or just ONE trivial seed as the `model_validate()` test fixture, deferring real templates to 091.
   - Recommendation: Phase 090 ships ONE minimal valid seed (proves the seed mechanism + serves as the `model_validate()` fixture for SC#5). Phase 091 ships the real 2–3 templates with full phase configs. Flag this boundary in PLAN.md.

2. **Does the `threads.active_workflow_run_id` FK to `workflow_runs` create an apply-ordering constraint?**
   - What we know: If the column FKs `workflow_runs(id)`, migration 059 must run after 057.
   - What's unclear: Whether to include the FK at all or store a plain uuid (decoupling apply order).
   - Recommendation: Include the FK with `ON DELETE SET NULL` (cleaner referential integrity) and apply migrations strictly in order 056→059 (the manual SQL-editor apply is sequential anyway). If decoupling is preferred, drop the FK.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Postgres) | Applying migrations, RLS/immutability verification | ✓ (assumed running per CLAUDE.md local-dev) | CLI v2.101 | — (must be running to apply + verify) |
| pydantic | harness.py models | ✓ | 2.12.5 | — |
| jsonschema | optional gate validator (091, not this phase) | ✓ | 4.26.0 | — |
| `scripts/regenerate-full-schema.sh` | Regenerate full-schema.sql | ✓ (referenced in CLAUDE.md) | — | — |

**Missing dependencies with no fallback:** None. (Local Supabase must be running for the apply + live-DB verification steps — confirm with the user before the apply task.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio (asyncio_mode=auto) `[VERIFIED: backend/pytest.ini]` |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_harness_models.py -x` |
| Full suite command | `cd backend && venv/Scripts/python.exe -m pytest` |

> **CRITICAL CONSTRAINT:** `backend/tests/conftest.py` builds a **fully-mocked Supabase client** `[VERIFIED]`. There is NO live-DB fixture. Therefore RLS, immutability-trigger, and DELETE-RESTRICT behavior **cannot be verified by the standard pytest harness** — those SCs are verified against the **live local Supabase** (SQL editor / psql / a new live-connection integration test). Only the Pydantic `model_validate()` test runs in plain mocked pytest.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARNESS-02 | UPDATE on a published definition is REFUSED (trigger raises) | live-DB integration (SQL) | `psql` / SQL-editor script: publish a row, attempt UPDATE → expect SQLSTATE 23514 | ❌ Wave 0 (no live-DB harness exists) |
| HARNESS-02 | DELETE of a definition referenced by a run is REFUSED (FK RESTRICT) | live-DB integration (SQL) | insert run referencing def, attempt DELETE def → expect FK violation 23503 | ❌ Wave 0 |
| HARNESS-02 | `UNIQUE(slug, version)` rejects duplicate | live-DB integration (SQL) | insert two rows same (slug,version) → expect 23505 | ❌ Wave 0 |
| SC#3 | Cross-user SELECT of workflow_runs/phases/audit denied by RLS | live-DB integration (two auth contexts) | connect as user B, SELECT user A's run → expect 0 rows | ❌ Wave 0 |
| HARNESS-06 | harness_audit has NO UPDATE/DELETE policy (INSERT-only) | live-DB integration (SQL) | query `pg_policies` for harness_audit → only SELECT+INSERT; attempt UPDATE → denied | ❌ Wave 0 |
| SC#1 | All 4 tables + threads column exist after apply | live-DB introspection | query `information_schema.tables` + `columns` | ❌ Wave 0 |
| SC#5 | `WorkflowDefinition.model_validate(seed)` parses a valid seed | unit (pure Python) | `pytest tests/unit/test_harness_models.py::test_valid_seed_parses -x` | ❌ Wave 0 |
| SC#5 / D-07 | A malformed config (unknown key / wrong phase_type) raises `ValidationError` | unit (pure Python) | `pytest tests/unit/test_harness_models.py::test_extra_key_rejected -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_harness_models.py -x` (the only pure-Python tests; fast).
- **Per wave merge:** full `pytest` suite (must stay GREEN — the new models file must not break imports).
- **Phase gate:** full pytest GREEN **AND** the live-DB verification script run against the local Supabase (RLS denial, immutability refusal, DELETE-RESTRICT refusal, INSERT-only policy check, table-presence introspection) all confirmed.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_harness_models.py` — Pydantic model tests (valid seed parses; `extra='forbid'` rejects unknown key; wrong `phase_type` rejected; each of the 5 phase configs validates). Covers SC#5 / D-07. Runs in mocked pytest (no DB needed).
- [ ] `supabase/verify_090.sql` (or a documented SQL-editor checklist) — live-DB verification script covering immutability refusal, DELETE RESTRICT, UNIQUE collision, cross-user RLS denial, INSERT-only policy presence, table/column introspection. Covers SC#1/#2/#3 + HARNESS-06. This is the **`autonomous: false` human-run verification** — pasted into the SQL editor against the live local DB.
- [ ] (Optional) `backend/tests/integration/test_090_harness_rls.py` — only if a live-DB connection fixture is introduced; otherwise the SQL script above is the verification path. The existing integration tests still use the mock client, so a NEW real-connection fixture would be required — recommend the SQL-script path to avoid scope creep.

## Security Domain

> `security_enforcement` is absent in `.planning/config.json` → treated as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase (RLS leans on existing Supabase `auth.uid()`). |
| V3 Session Management | no | No session handling. |
| V4 Access Control | **yes** | Postgres RLS on every new table (FK-chain for runs/phases/audit; owner+global for definitions). This is THE security control of the phase. |
| V5 Input Validation | **yes** | Pydantic `extra='forbid'` strict parsing of phase-config JSONB (D-07) — rejects malformed/injected config keys. |
| V6 Cryptography | no | No crypto; no secrets introduced. |

### Known Threat Patterns for Postgres/Supabase RLS + JSONB config
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data read (tenant isolation break) | Information Disclosure | RLS USING predicate via FK chain to `threads.user_id` (copy 054/055); verify with a two-context cross-user SELECT test. |
| Audit tampering (hide a tool refusal) | Repudiation / Tampering | INSERT-only RLS (no UPDATE/DELETE policy) — copy 030 audit_log. |
| Published-workflow tampering (break reproducibility) | Tampering | DB `BEFORE UPDATE` trigger raising on `OLD.status='published'` + `ON DELETE RESTRICT`. |
| Malformed/injected phase config | Tampering | Pydantic `extra='forbid'` rejects unknown keys before the engine consumes them. |
| Global-template privilege confusion | Elevation of Privilege | Globals owned by the dedicated seed user (`00000000-…-0001`); regular users can only author `is_global=false` rows (no operator gate in v1 — D-03; publishing a global is a seed-migration act, not a user action). `[ASSUMED]` — no RLS prevents a user from setting `is_global=true` on their own row in v1; if that matters, add a WITH CHECK on `is_global`. Flag for the planner. |

> **Security flag for the planner (A5-adjacent):** The skills model (017) does NOT prevent a user from inserting their own row with `is_global=true` — the INSERT policy only checks `auth.uid() = user_id`. If v2.8 wants to prevent regular users from publishing GLOBAL workflows (reserving that for seeds/operators), add `WITH CHECK (auth.uid() = created_by AND is_global = false)` on the INSERT policy. D-03 defers the operator tier to v2.9 and the skills precedent allows self-set globals, so the conservative default is to MIRROR skills (allow it) — but surface this to the user during discuss/plan, because "any user can publish a global workflow everyone sees" may be undesirable. `[CITED: 017_skills.sql INSERT policy]`

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/017_skills.sql` — ownership + is_global SELECT policy + BEFORE UPDATE trigger shape `[VERIFIED: read in full]`
- `supabase/migrations/054_workspace_files.sql` — 1-hop + 2-hop FK-chain RLS `[VERIFIED]`
- `supabase/migrations/055_todos_table.sql` — 1-hop FK-chain RLS + ALTER ADD COLUMN + FK SET NULL `[VERIFIED]`
- `supabase/migrations/030_missing_tables.sql` — audit_log INSERT-only pattern + CHECK constraint shape `[VERIFIED]`
- `supabase/migrations/018_skill_creator_seed.sql` — seed system-user mechanism for globals (`00000000-…-0001`) `[VERIFIED]`
- `supabase/full-schema.sql:198-205` — `set_updated_at()` plpgsql trigger structural template `[VERIFIED]`; `:585` threads table (no active_workflow_run_id yet) `[VERIFIED]`
- `ls supabase/migrations/` — confirms head = `055_todos_table.sql` `[VERIFIED]`
- `backend/venv` python — pydantic 2.12.5, jsonschema 4.26.0 `[VERIFIED]`
- `backend/pytest.ini` + `backend/tests/conftest.py` — pytest config + fully-mocked Supabase client (no live-DB fixture) `[VERIFIED]`
- `backend/app/models/skill.py`, `workspace.py` — existing model conventions (plain v2 BaseModel, `__future__` annotations) `[VERIFIED]`
- `.planning/ROADMAP.md` § Phase 090 + 091 — the 5 SCs + the 5 phase-type/4-validator names verbatim `[VERIFIED]`
- `.planning/REQUIREMENTS.md` — HARNESS-02 (line 20), HARNESS-06 (line 24) `[VERIFIED]`
- `.planning/research/ARCHITECTURE.md` + `SUMMARY.md` — 3-table design, RLS data flow, migration-head 055, deep_mode_metadata drop `[VERIFIED]`

### Secondary (MEDIUM confidence)
- `pydantic.dev/docs/validation/latest/concepts/unions` — canonical v2 discriminated-union + `ConfigDict(extra='forbid')` + `model_validate()` pattern `[CITED]` (cross-checked against installed 2.12.5)

### Tertiary (LOW confidence)
- None. Every claim is verified against a shipped file or the official Pydantic docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified in venv; no new packages.
- Architecture (SQL patterns): HIGH — every RLS/trigger/constraint shape copied from a shipped, in-production migration.
- Pydantic discriminated union: HIGH — pattern verified against official v2 docs AND installed 2.12.5; field SHAPES are MEDIUM (provisional, coordinate with 091).
- Pitfalls: HIGH — the mock-only test harness and manual-apply constraints are verified facts, not assumptions.

**Research date:** 2026-05-30
**Valid until:** ~2026-06-29 (stable domain; the only fast-moving piece is pydantic, and 2.12.5 is pinned in venv)
