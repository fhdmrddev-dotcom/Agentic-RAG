# Phase 090: Harness Schema + RLS + Config Models - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the **Postgres substrate for workflows** — and only the substrate.
No engine, no runtime, no API endpoints beyond what the schema implies; those are Phase 091/092.

In scope:
- Migrations (renumbered from the real head **056+**) creating `workflow_definitions`,
  `workflow_runs`, `workflow_phases`, `harness_audit`, and the `threads.active_workflow_run_id` column.
- Immutable-on-publish enforcement on `workflow_definitions` (`UNIQUE(slug, version)` + `BEFORE UPDATE`
  trigger + FK `ON DELETE RESTRICT`).
- Row-Level Security on all new run/phase/audit tables via the proven `threads.user_id` FK chain
  (exact pattern from migrations 054/055); `harness_audit` INSERT-only like `audit_log`.
- `app/models/harness.py` Pydantic models: `PhaseConfig` (discriminated union over the 5 phase types),
  `ValidatorSpec`, `WorkflowDefinition` — parsing the phase-config JSONB via `model_validate()`.
- Regenerate `supabase/full-schema.sql` after applying each migration via the SQL editor.

Out of scope (later phases): the harness engine + 5 phase executors + gates + whitelist (091),
dual-mode wiring + Continue (092), panel timeline (094). This phase parallels 089 — pure schema,
no runtime dependency on the agent-loop extraction.

Requirements covered: **HARNESS-02** (versioned/immutable-on-publish), **HARNESS-06** (INSERT-only audit trail).
</domain>

<decisions>
## Implementation Decisions

### Workflow-definition sharing & authoring (D-090-01)
- **D-01:** `workflow_definitions` uses the **skills ownership model**: a `created_by uuid` (FK `auth.users`)
  + an `is_global boolean DEFAULT false` column. SELECT RLS = `auth.uid() = created_by OR is_global = true`
  (mirrors `017_skills.sql` "Users can view own and global skills"). INSERT/UPDATE/DELETE scoped to
  `auth.uid() = created_by`.
- **D-02:** The 2–3 **seed workflow templates ship as `is_global = true`** — every user sees them, exactly
  like global skills. (Seeding mechanism — system user vs NULL `created_by` for globals — is a planner/
  researcher detail; follow whatever pattern global skills already use.)
- **D-03:** Regular users **CAN author their own private workflow definitions** in v1 (owned, RLS-scoped).
  No operator/super_admin role gate — that tier is deferred to v2.9 (D-v2.8-01), and the skills model
  already gives self-service authoring without it.

### Publish lifecycle & versioning (D-090-02)
- **D-04:** A definition carries a **`status` column (`draft` | `published`)**. Draft rows are freely
  editable; **publishing freezes the row** — the `BEFORE UPDATE` trigger blocks mutations once
  `status = 'published'` (the immutability is conditional on published state, NOT on every insert).
- **D-05:** To change a published workflow you **create a NEW row with the next version** (same `slug`,
  `version + 1`). `UNIQUE(slug, version)` enforces no in-place version reuse. This gives true
  reproducibility and mirrors skill-version immutability.
- **D-06:** FK `ON DELETE RESTRICT` from `workflow_runs` → `workflow_definitions`: a published version
  referenced by any run cannot be deleted (SC#2).

### Pydantic config-model strictness (D-090-03)
- **D-07:** Phase-config Pydantic models use **strict parsing — `extra = 'forbid'`**. An unknown/typo'd
  key in a phase-config JSONB fails `model_validate()` with a structured error. Justified because v1
  authoring is by-hand seed/JSONB/API (HARNESS-07, no visual builder) — strictness catches authoring
  mistakes immediately. Lenient/forward-compat parsing is deferred until a real cross-version compat
  need exists.

### Audit retention & delete behavior (D-090-04)
- **D-08:** **No TTL / retention purge in v2.8.** `harness_audit` keeps all rows forever (volume is tiny
  at current scale; revisit only when audit volume becomes a real concern).
- **D-09:** The audit trail is **independent of run/definition deletion** — `harness_audit` rows do NOT
  cascade-delete with a parent run (the audit trail survives). `workflow_definitions` already uses
  `ON DELETE RESTRICT` so referenced definitions can't be deleted while live anyway. (Whether the
  audit→run linkage is a nullable FK `SET NULL` or a plain stored `run_id` with no hard FK is a
  planner detail; the invariant is: audit rows persist.)
- **D-10:** `harness_audit` is **INSERT-only** (no UPDATE/DELETE RLS policies — only SELECT for the
  owner + INSERT), mirroring the `audit_log` table in `030_missing_tables.sql`.

### Forward-compat (locked, carried into schema)
- **D-11:** Every new table carries **`org_id uuid NULL`** from day 1 (D-PRD-02 forward-compat), but all
  RLS predicates stay **user-scoped** for v2.8 — org-level multi-tenancy is deferred (org schema
  direction undecided; see project memory `project_org_level_deferred`).
- **D-12:** `threads.deep_mode_metadata jsonb` is **NOT created** — dropped per research delta #4
  (no consumer in v2.8 scope). Only `threads.active_workflow_run_id` is added.

### Claude's Discretion
- Exact migration file split (one-per-table 056–059 vs combined), column names/types beyond those named
  above, index choices (research suggests `(workflow_run_id, phase_index)` on `workflow_phases`),
  trigger function naming, and the seed-template `created_by` mechanism for globals.
- The precise `harness_audit` event-type enum/shape (SC#3 names: phase transitions, gate results, tool
  refusals) and the audit→run linkage mechanism (SET NULL FK vs plain stored id).
- Pydantic model field shapes for each of the 5 phase-type configs (derived from what the 091 engine
  needs — coordinate with the Phase 091 substrate, but 091 is downstream).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema design (the v2.8 research — authoritative for this phase)
- `.planning/research/ARCHITECTURE.md` — the 3-table design (§ Postgres `workflow_definitions/_runs/_phases`),
  the **RLS data flow** diagram (FK chain through `threads.user_id`, 1-hop + 2-hop JOIN), the
  immutable-on-publish recommendation, the `org_id NULL` forward-compat call, the `deep_mode_metadata`
  drop (research delta #4), and **"Phase B — Schema + RLS"** (migrations 056–059 build note).
- `.planning/research/SUMMARY.md` — migration-head reconciliation (real head 055 → renumber 056+; PRD's
  125-139 is stale fiction) and the lean-gate rationale for dropping unused columns.

### Reference migration patterns (copy these — proven, zero new RLS thinking)
- `supabase/migrations/017_skills.sql` — the **ownership/sharing analog** (`is_global boolean` +
  `auth.uid() = user_id OR is_global = true` SELECT policy) AND the `BEFORE UPDATE` trigger shape to
  mirror for immutability. NOTE: 017's trigger is `set_updated_at`, NOT an immutability trigger — the
  immutable-on-publish trigger is NEW here; 017 is the structural template, not a literal copy.
- `supabase/migrations/054_workspace_files.sql` — the **RLS FK-chain pattern** (1-hop `threads.user_id`
  at :41, 2-hop JOIN at :58-66) to replicate for `workflow_runs` / `workflow_phases`.
- `supabase/migrations/055_todos_table.sql` — second instance of the same FK-chain RLS pattern (:25).
- `supabase/migrations/030_missing_tables.sql` — the `audit_log` **INSERT-only** table pattern for
  `harness_audit`.

### Requirements & success criteria (locked)
- `.planning/REQUIREMENTS.md` — HARNESS-02 (line 20) and HARNESS-06 (line 24) verbatim requirements.
- `.planning/ROADMAP.md` § "Phase 090" — the 5 success criteria (the binding acceptance bar).

### Process (project conventions — MANDATORY)
- `CLAUDE.md` § schema-changes rule — numbered migrations under `supabase/migrations/`, apply via
  **Supabase SQL editor** (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh`
  (no-reset live dump), then commit both. Filenames must match `<digits>_name.sql`.

### Design source (validated/refined — secondary)
- `.planning/PRDs/v2.7.md` §3 Theme B + §5 — original harness schema design; **sound on tables /
  phase-config / SSE**, but **corrected** by the research on migration numbers and `deep_mode_metadata`.
  Read for intent, defer to ARCHITECTURE.md on conflicts.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`017_skills.sql` `is_global` + global-SELECT RLS** — the exact sharing model for `workflow_definitions`
  (D-01/D-02). Copy the policy shape.
- **`054_workspace_files.sql` / `055_todos_table.sql` FK-chain RLS** — the exact run/phase RLS pattern;
  no new RLS reasoning required.
- **`030_missing_tables.sql` `audit_log`** — INSERT-only template for `harness_audit` (D-10).
- **`public.set_updated_at()` trigger function** (from `014_folders.sql`, reused by skills) — available for
  `updated_at` columns on the new tables.
- **`jsonschema` 4.26.0** already installed (per research) — available if planner wants JSON-schema
  validation alongside Pydantic, though `extra='forbid'` Pydantic (D-07) is the primary validator.

### Established Patterns
- All tables need RLS (CLAUDE.md non-negotiable); global templates are the only shared scope, exactly as
  with skills/folders.
- Migrations are numbered SQL files applied by hand via the SQL editor; `full-schema.sql` is regenerated,
  never hand-edited.
- Pydantic for all structured LLM/config outputs (CLAUDE.md) — `app/models/harness.py` is the new home.

### Integration Points
- `threads` table gets one new column (`active_workflow_run_id`) — the dual-mode anchor consumed by
  Phase 092's `agent_runner` branch. This phase only adds the column; no runtime reads it yet.
- `workflow_phases.output jsonb` is the resumability substrate Phase 091 will 2-phase-write; large
  outputs spill to the `workspace-files` bucket (path-only), mirroring the workspace hybrid-storage
  decision — schema should not force inline-only.
</code_context>

<specifics>
## Specific Ideas

- "Just like global skills" — the user anchored the sharing model on the existing skills `is_global`
  behavior. Reuse it literally; don't invent a new sharing concept.
- "Draft → publish → new version on edit" — the user wants an explicit, reproducible publish moment with
  a mutable draft phase before it, not frozen-on-insert.
</specifics>

<deferred>
## Deferred Ideas

- **Operator / super_admin role tier** for restricting who can publish global workflows — deferred to v2.9
  (D-v2.8-01). v1 uses the skills self-service model (any user authors their own; seeds are global).
- **Audit retention / TTL purge mechanism** — deferred until audit volume is a real concern (D-08).
- **Lenient / forward-compatible config parsing** (`extra='ignore'`) — deferred until a real cross-version
  compatibility need exists (D-07 chose strict for now).
- **Org-level RLS / multi-tenancy** — `org_id` carried NULL for forward-compat, but org-scoped predicates
  are out of v2.8 (see `project_org_level_deferred`).
- **`deep_mode_metadata jsonb`** — dropped, not deferred; revive only if a concrete consumer appears
  (research delta #4).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.
</deferred>

---

*Phase: 090-harness-schema-rls-config-models*
*Context gathered: 2026-05-30*
