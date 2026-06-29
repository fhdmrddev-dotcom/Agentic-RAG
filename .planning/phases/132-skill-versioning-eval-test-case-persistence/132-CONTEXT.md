# Phase 132: Skill Versioning + Eval Test-Case Persistence - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

The persistence/schema foundation for the v3.2 Skill Eval Studio. Two net-new owner-scoped capabilities:

1. **VER-01 — immutable skill version history.** Every content change to a skill captures an immutable version snapshot, so later eval-run history is traceable to the exact instruction state that produced it and prior versions are viewable.
2. **EVAL-01 — persistent, editable eval test cases.** A user defines a set of test cases (prompt + expected-behavior description) for a skill, saves them, and can edit/delete them before any eval run; they survive reload.

**In scope:** two new tables (`skill_versions`, `skill_test_cases`), their RLS, the version-capture trigger, a one-time v1 backfill, and the CRUD API + minimal UI wiring to author/persist test cases and read version history.

**Out of scope (later phases — do NOT build here):** the eval RUNNER (eval_runs / per-case result tables, SSE) = Phase 133; results/verdict/ratings = Phase 134; self-improvement loop = Phase 135; publish gate = Phase 136; the consolidated sketch-gated Evals panel = Phase 137. No agent-loop, provider-gateway, or `threads.py` touch.
</domain>

<decisions>
## Implementation Decisions

### Version capture mechanism (VER-01)
- **D-01:** Capture versions via a **Postgres trigger on the `skills` table** (AFTER INSERT OR UPDATE), NOT app-code in each router. Rationale: safe-by-construction — fires on *every* write path automatically (`create_skill` POST, `update_skill` PATCH, bulk `import_skill`, the Trigger Tuner author-confirm PATCH at `skills.py:333`, and the skill-creator agent), with zero duplicated app code. Matches the project "safe-by-construction + publish-time validation" principle ([[feedback_separate_per_feature_safe_by_construction]]).
- **D-02:** A new version is created when **any of name / description / instructions changes** (the full content trifecta), AND only when at least one *actually* changed (`IS DISTINCT FROM` guard). A `toggle-enabled` / `toggle-global` flip MUST NOT spawn a version. Versioning description (not just instructions) gives the Phase 139 description self-improve proposer an immutable version trail for free.
- **D-03:** Each version row carries a **monotonic `version_number`** (v1, v2, … computed per-skill as max+1 inside the trigger), `created_at`, and a **`source`** provenance tag (`manual` / `import` / `tuner` / `self_improve` / `backfill`). The snapshot stores name + description + instructions as they were at save time. Append-only — no UPDATE/DELETE of version rows.
- **D-04:** This is **distinct from the existing workflow-scoped `skill_snapshot`** (`workflow_definitions.skill_snapshots` sibling column, migration 067, `backend/app/services/harness/skill_snapshot.py`). That copies a skill into a *workflow definition* for deterministic runs; VER-01 is a *per-skill* version history. Name the new table `skill_versions` to avoid confusion — do NOT reuse or extend the workflow snapshot machinery.

### Test-case schema & binding (EVAL-01)
- **D-05:** New table `skill_test_cases`: `id`, `skill_id` (FK → skills), `user_id` (owner), `prompt` (text), `expected_behavior` (free text), `order_index` (int), `created_at`, `updated_at`. Optional `name`/label is fine but not required.
- **D-06:** `expected_behavior` is a **free-text description** per the requirement — NOT a regex/assertion. The honest pass/fail verdict (Phase 134) is judge-based, so 132 only persists the text.
- **D-07:** **Cases belong to the SKILL, not to a version** — freely editable/deletable before any run (EVAL-01). Traceability lives on the eval RUN, not the case: when an eval run executes (Phase 133), *the run* records which `skill_version_id` it used. Cases are NOT version-locked.
- **D-08:** Test cases are **provider-agnostic** here. Provider/model selection is a run-time concern deferred to Phase 133. Do not add provider/model columns to `skill_test_cases`.

### Schema scope now vs later
- **D-09:** Lay **only the two 132 tables now** (`skill_versions` + `skill_test_cases`). The ROADMAP "~5 new tables" is the *milestone* total across 132–134 (133 adds the run/result tables, 134 adds ratings). Designing `eval_runs` now would be guessing at 133's SSE/provider shape.
- **D-10:** Design the two tables **forward-compatibly**: stable PKs so 133 can FK `eval_runs.skill_version_id → skill_versions.id` and per-case results can FK `skill_test_cases.id`. Minimal columns, stable keys.

### Backfill & global-skill visibility
- **D-11:** **Backfill a v1 snapshot for every existing skill** at migration time (one `INSERT … SELECT` from current `skills` into `skill_versions`, `source='backfill'`, `version_number=1`). Without it, an existing skill's first eval has no version to point at until its next edit.
- **D-12:** **Owner-only RLS on BOTH tables, even for global (`is_global`) skills.** Version history + test cases are the author's private authoring/eval harness; consumers of a shared skill run it but don't see its edit history or eval cases. Matches the skills RLS precedent and the roadmap "owner-scoped (skills RLS precedent)" flag.

### Migration mechanics
- **D-13:** New migrations start at **`079_*`** (latest applied is `078`). Apply each via the Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no-reset live dump) and commit both files ([[feedback_apply_migrations_via_sql_editor]], [[feedback_regen_full_schema_no_reset]]). Apply to BOTH local and (at deploy time) cloud Supabase.

### Claude's Discretion
- Exact column types/constraint names, trigger function naming, whether `skill_versions` snapshots into discrete columns vs a JSONB blob (lean discrete columns for queryability), and the CRUD route shapes — planner/researcher decide, consistent with `backend/app/api/skills.py` conventions.
- ~~Whether the minimal version-history read + test-case CRUD UI lands in this phase or is left as a thin API the sketch-gated Phase 137 panel consumes (132 is foundation; a thin functional surface is acceptable, full panel = 137).~~ **RESOLVED (operator, 2026-06-29):** ship a **thin functional CRUD surface** in 132 — schema/trigger/RLS/migration + CRUD API + a minimal, non-designed test-case editor & version-history read so the foundation is usable end-to-end. NO design polish and NO UI-SPEC (treated as `--skip-ui`); the real sketch-gated Skill Evals panel is Phase 137 (G-2). The thin surface must not pre-empt or constrain the 137 design.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements / roadmap
- `.planning/REQUIREMENTS.md` — VER-01 (line 22) + EVAL-01 (line 15); v3.2 traceability table
- `.planning/ROADMAP.md` §"v3.2 … Phase 132" — goal, 4 success criteria, flags (schema/RLS foundation, owner-scoped, no agent-loop/provider touch)
- `.planning/PRDs/v3.1-skill-studio-eval.md` — the eval-studio brief (scope source)

### Existing skills schema + code (the surface being extended)
- `supabase/migrations/017_skills.sql` — `skills` + `skill_files` tables, owner-scoped RLS, skill-files first-segment storage RLS (the RLS precedent to mirror)
- `backend/app/api/skills.py` — all skill write paths the version trigger must cover (create / update / import / toggle); `update_skill` PATCH is also the tuner author-confirm write
- `backend/app/models/skill.py` — `SkillCreate` / `SkillUpdate` / `SkillResponse` models
- `supabase/full-schema.sql` lines 762–788 — current `skills` / `skill_files` table shape

### Distinct prior "snapshot" concept — do NOT conflate (D-04)
- `supabase/migrations/067_skill_snapshots_sibling_column.sql` — workflow-scoped `workflow_definitions.skill_snapshots` + the published-immutability trigger pattern (useful as an *immutability* reference, but a different table/purpose)
- `backend/app/services/harness/skill_snapshot.py` — `materialize_skill_snapshots` (workflow determinism, NOT per-skill version history)

### Migration workflow
- `CLAUDE.md` §"Schema changes" + `supabase/SETUP.md` — numbered migrations, SQL-editor apply, `regenerate-full-schema.sh`
- `supabase/migrations/077_tuner_runs.sql` — recent owner-scoped table + RLS pattern (Phase 123.1 precedent to mirror for shape/RLS/grants)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills.py` owner-scoped `.or_(user_id.eq.{id},is_global.eq.true)` filter + the `_sibling_descriptions` owner-scope helper — the RLS/query idiom to mirror (but versions/cases are owner-ONLY per D-12, so drop the `is_global` branch).
- `077_tuner_runs.sql` — copy/paste-grade table + RLS + grants template for a new owner-scoped table.
- `067` published-immutability trigger — reference for enforcing append-only on `skill_versions` if desired (block UPDATE/DELETE).

### Established Patterns
- Migrations are numbered SQL files applied via SQL editor; full-schema regenerated by no-reset live dump. Next number = `079`.
- All new tables need RLS (CLAUDE.md rule) — users only see their own data; global skills are the only shared scope, and versions/cases are explicitly NOT shared (D-12).
- Triggers already used in this codebase (`set_updated_at`, the workflow published-update block trigger) — a version-capture trigger is idiomatic here.

### Integration Points
- The version trigger hangs off the `skills` table writes in `backend/app/api/skills.py` — no router code changes needed for capture (safe-by-construction, D-01).
- New CRUD router (e.g. `backend/app/api/skill_test_cases.py` or routes added to `skills.py`) for test-case persistence + a version-history GET — net-new, owner-scoped, does NOT touch `threads.py` / `agent_loop.py` / the provider gateway (G-5 clean; this phase has no hot-file exposure).
</code_context>

<specifics>
## Specific Ideas

- The whole eval substrate must reuse the existing agent loop + provider gateway later (red line D-14) — but Phase 132 is pure persistence and touches none of it. Keep it that way.
- Lean toward discrete snapshot columns (name/description/instructions) on `skill_versions` over a JSONB blob, for queryable diff/version-history reads (Phase 137 diff viewer).
</specifics>

<deferred>
## Deferred Ideas

- **Eval runner (with-skill vs without-skill, SSE, two completions/case)** → Phase 133 (EVAL-02). Needs `skill_versions.id` as a stable FK target — designed for here, built there.
- **Per-provider verdict + side-by-side + thumbs up/down ratings** → Phase 134 (EVAL-03/04).
- **Self-improvement loop (propose instruction diff → approve → new version → re-eval gate)** → Phase 135 (SI-01); description-only proposer → Phase 139 (SI-02). Both consume the version trail D-02 creates.
- **Publish gate (no publish until an eval passes)** → Phase 136 (GATE-01).
- **Consolidated, sketch-gated Skill Evals panel** (case editor, run history, run detail, inline ratings, diff-viewable version history) → Phase 137 (PANEL-01, G-2 sketch-gated). 132 may ship only a thin functional API/surface.
- **Skill-script MIME fidelity gap** ([[project_skills_mime_known_gap.md]]) — unrelated; not in scope.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope.

**Reported-bugs cross-check (mandatory):** 8 open `surface: Agentic-RAG` reports reviewed; NONE overlap Phase 132's domain (skill versioning + test-case persistence / schema-RLS). All are chat/streaming/run-honesty (BUG-260609-02, BUG-260609-04, BUG-260610-01), provider-routing (BUG-260623-01, gpt4o-max-tokens), workflows-page filtering (BUG-260628-01), composer (general-chat-silent-send-drop), or dispatch-banner (setting-up-agent-hides-model-activity). All **left open, none folded** — no frontmatter changes.
</deferred>

---

*Phase: 132-skill-versioning-eval-test-case-persistence*
*Context gathered: 2026-06-29*
