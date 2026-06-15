# Phase 099: Workflow ↔ Skill Composition - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

An authored workflow phase (`llm_agent` / `llm_single` / `llm_batch_agents`) can reference a
project skill via an optional `skill_ref`. The skill's instructions + attached-file list
compose into the phase framing, and `read_skill_file` is auto-whitelisted for that phase.
At **publish time** the skill's content is **snapshotted into the locked definition**
(instructions copied into the definition JSONB; files copied to a workflow-owned Storage
path), so editing or deleting the skill later **cannot change or break** an already-published
workflow. Deep-mode chat behavior is **byte-identical** — the `skill_ref` path is a literal
no-op outside workflow phases (the red line).

This phase delivers REQ **WFSKILL-01**. It is an **additive seam** on
`backend/app/services/harness/phase_types.py` + `backend/app/models/harness.py` +
`backend/app/services/tool_dispatcher.py` — composition of shipped primitives, no new
runtime, no provider-path changes.

**In scope:** the additive-optional `skill_ref` field on the three LLM phase configs;
publish-time snapshot (content + files); framing composition; `read_skill_file`
auto-whitelist + snapshot-routed reads in workflow phases; definition-save validation;
representative-4 cross-provider UAT.
**Out of scope:** the authoring UI that sets `skill_ref` (Phase 103); skill versioning as a
general Skills feature (future Skill Studio direction); Skills-UI awareness of referencing
workflows (deferred below); template/asset handling (Phases 100/101).

</domain>

<decisions>
## Implementation Decisions

### Snapshot mechanics (the load-bearing decision — skills have NO versioning today)
- **D-01: Snapshot = content copy into the definition.** At snapshot time, the skill's
  instructions (plus its name + description for display and routing) and a file manifest are
  copied INTO the workflow definition JSONB. The published workflow is fully self-contained;
  zero new tables; runs **always** use the snapshot (deterministic — live skill state is
  irrelevant at run time). Rejected: a `skill_versions` table (much bigger blast radius —
  Skills CRUD, `save_skill`, ZIP import/export, Skills UI would all become version-aware;
  that is future Skill-Studio territory) and hash-pin-with-live-lookup (a deleted skill
  still breaks the run).
- **D-02: Skill FILES are physically copied at snapshot time** to a workflow-owned Storage
  path keyed by definition id + version. `read_skill_file` serves from the snapshot copies
  during workflow runs. Fully honors "delete cannot break"; skill files are typically small,
  so duplication cost is negligible.
- **D-03: Snapshot is taken at the draft→published transition.** Drafts keep a LIVE skill
  reference (authors iterate against the current skill). Enforced in the definition
  validate/save path that exists today (098 D-07 precedent) — NOT dependent on the Phase 103
  publish UI. Consequence: republishing (the 097 "tweak → new version" path) re-snapshots
  the current skill state — that is how an author intentionally picks up skill improvements.
  Code fact that simplifies this: drafts cannot execute (workflow kickoff requires
  `status='published'`, `threads.py` ~line 854) — so only snapshotted definitions ever run.
- **D-03a (amendment, locked at plan time 2026-06-10):** Research verified the "definition
  validate/save path that exists today" assumed by D-03 does NOT exist — `api/workflows.py`
  has only a GET picker route; the publish endpoint is Phase 103 (WFAUTH-01), and the 098
  publish-gate precedent actually enforces at workflow kickoff (`threads.py` ~871), not at
  save. **Operator decision: snapshot at FIRST KICKOFF — lazy + idempotent.** The first run
  of a published skill-bearing workflow materializes the snapshot (D-10 gate enforced at that
  moment); all subsequent runs use it. Implemented as a standalone service function shaped so
  Phase 103's publish endpoint can call the exact same code at true publish time; `threads.py`
  gains only a one-line call into the service (G-5: do not grow the hot file). Accepted
  trade-off: a skill edited between manual publish and first run snapshots at first-run state —
  still immutable afterward. D-03's intent (drafts stay live; published runs are deterministic;
  republish = re-snapshot) is unchanged.
- **D-04 (derived; red line):** In skill-bearing workflow phases, `read_skill_file` resolves
  against the SNAPSHOT (not the live skill) via a **gated branch** — the gate is the presence
  of skill-snapshot context on the phase `ToolContext`. When absent (Deep mode, non-skill
  phases), the existing live-skill resolution path is **byte-identical** (the 098 D-05a
  gated-no-op pattern applied to `_handle_read_skill_file`).

### Composition shape
- **D-05: Append as a delimited block.** The phase prompt stays first and primary (it
  defines the phase's job); the snapshotted skill instructions follow as a clearly-delimited
  block (e.g. `## Skill: {name}` + instructions + file list) in the SINGLE system string at
  the existing seam (`system_prompt = phase.config.prompt + ...`, `phase_types.py`).
  Provider-agnostic by construction. (`_retry_suffix` ordering relative to the skill block
  is Claude's discretion; lean: retry suffix stays last.)
- **D-06: File contents are NOT inlined.** The framing lists the snapshot's filenames
  (mirroring what `load_skill` returns today: instructions + file names); the agent pulls
  contents on demand via the auto-whitelisted `read_skill_file`. Context stays lean.
- **D-07: `llm_single` = instructions-only compose.** `llm_single` runs with `tools=[]`, so
  the skill block composes WITHOUT the file list and the auto-whitelist is simply inert there
  — the same "carried for shape symmetry, inert where tool-less" pattern `folder_scope`
  already uses. No new machinery, honors the SC verbatim.
- **D-08: `skill_ref` rides ALL THREE LLM phase configs** (`llm_agent`, `llm_single`,
  `llm_batch_agents`) — the 098 `folder_scope` shape-symmetry precedent. Each fanned-out
  batch sub-agent gets the same skill framing + `read_skill_file` whitelist. Avoids a second
  additive schema change later; batch reuses the `llm_agent` substrate anyway.

### skill_ref identity & lifecycle
- **D-09: `skill_ref` is the skill's UUID** — consistent with 098's resolved-ids-not-hints
  rule (`project_folder_id` / `folder_scope` are UUIDs). Rename-proof. The Phase 103 NL
  generator resolves spoken skill names → ids exactly like folders. The snapshot also stores
  the skill's name + description (display + `read_skill_file` routing by name within the
  phase).
- **D-10: Publish gate = visible + enabled.** At publish/snapshot time the skill must exist,
  be visible to the author (owned-or-global — the same predicate workflow kickoff uses), AND
  be `is_enabled`. A disabled skill was deliberately turned off — snapshotting it would
  resurrect it silently. Violation = **definition-save validation error** (098 D-07 pattern),
  never silent.
- **D-11: Single `skill_ref` per phase** (optional). The SC's wording ("reference a skill").
  One delimited block, unambiguous framing. Going to a list later is an additive,
  zero-migration change if a real workflow ever needs it.

### Cross-provider validation depth (SC#10)
- **D-12: Representative-4 live UAT** (OpenAI, Anthropic, Google, OpenRouter — one model per
  SC#10 axis): skill framing composes + `read_skill_file` round-trips per provider. Skill
  composition is a provider-agnostic string append (single system string, no per-provider
  code path) — mirrors 098 D-09's reasoning. **Full native-7 + OpenRouter stays reserved for
  Phase 101** (field-map emission, where GLM/MiniMax tool-use-drop + DeepSeek/Moonshot
  reasoning-truncation actually bite).

### Carried-forward patterns (settled, not re-asked)
- **Additive-optional fields on `_StrictBase` (`extra="forbid"`)** — zero-migration; old
  published JSONB rows `model_validate()` cleanly (098 D-10).
- **Immutability = "no-edit-published", per-version** (097) — snapshot lives inside the
  immutable version.
- **Deep byte-identical red line** — shared paths get gated no-ops when the new field/context
  is absent (098 D-05a).

### Claude's Discretion
- Exact delimiter format of the skill block; whether the skill description composes into the
  framing or stays metadata-only.
- Snapshot JSONB field shape/naming inside the definition (e.g. a `skill_snapshot` object on
  the phase config vs a definition-level map) — planner picks what serializes cleanly with
  `_StrictBase`.
- Storage bucket/path layout for snapshot file copies + the RLS/access rule for them
  (must be readable by whoever can legitimately run the workflow).
- Whether a snapshot size guardrail is needed (instructions are text; lean: no cap in 099,
  observe first).
- Migration mechanics (whether any DB change is needed at all beyond JSONB content — the
  field is inside the `phases`/definition JSONB, so likely zero-migration; if a migration IS
  needed, follow CLAUDE.md rules: numbered SQL, apply via SQL editor, regenerate
  `full-schema.sql`).
- **Security note for the planner:** a globally-shared published workflow snapshotting a
  PRIVATE skill would expose that skill's content to other users. Acceptable today — there is
  no self-serve global publish (that's STRETCH Phase 109) — but the snapshot/storage access
  design should note it so Phase 109 inherits the consideration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Phase requirements & success criteria
- `.planning/ROADMAP.md` → "### Phase 099: Workflow ↔ Skill Composition" — the 3 success
  criteria + the SC#10 VALIDATION note (additive seam on `phase_types.py` `_exec_llm_agent`;
  Deep path untouched).
- `.planning/REQUIREMENTS.md` → **WFSKILL-01** (optional `skill_ref`; instructions + files
  compose into framing; `read_skill_file` auto-whitelisted; version snapshotted into the
  locked definition; Deep path byte-identical).

### Prior-phase decisions this phase builds on
- `.planning/phases/098-project-binding-server-side-kb-scope-governance/098-CONTEXT.md` —
  D-05a (gated no-op on shared paths = the red-line pattern D-04 reuses), D-07 (definition-save
  validation precedent D-10 reuses), D-09 (representative-4 reasoning D-12 mirrors), D-10
  (additive-optional `_StrictBase` pattern).
- `scripts/spike-097/CONCLUSION.md` — §3 schema philosophy (additive-optional, resolved ids);
  §2 Condition 7 (full-roster cross-provider reserved for the Phase 101 field-map surface);
  unknown (c): skill registry as authoring grounding (Phase 103 consumes `skill_ref` in the
  generator prompt).

### Existing code seams (where the work lands)
- `backend/app/models/harness.py` — `LlmSinglePhaseConfig` / `LlmAgentPhaseConfig` /
  `LlmBatchAgentsPhaseConfig` (where `skill_ref` lands; `folder_scope` shows the exact
  additive pattern, lines ~43-85) + `WorkflowDefinition` + `_StrictBase` (`extra="forbid"`)
  + the `_folder_scope_requires_project` `model_validator` (the validator shape D-10's
  publish-gate check follows).
- `backend/app/services/harness/phase_types.py` — `_exec_llm_single` (~line 252: tool-less,
  `system_prompt = phase.config.prompt + _retry_suffix(ctx)`), `_exec_llm_agent` (~line 273:
  whitelist → `apply_tool_budget` → `run_task_sub_agent(system_prompt_override=...)`),
  `_exec_llm_batch_agents` (~line 340), `_build_phase_tool_context` (~line 151 — where
  skill-snapshot context joins the per-phase `ToolContext`). **The framing seam.**
- `backend/app/services/tool_dispatcher.py` — `_handle_load_skill` (~line 333: what a skill
  "is" to the agent today — instructions + file names), `_handle_read_skill_file` (~line 420:
  name-based owned-or-global resolution + Storage path; where the D-04 gated snapshot
  routing attaches), `ToolContext` (carries `phase_whitelist`; gains skill-snapshot context),
  the `TOOL_HANDLERS` registry.
- `backend/app/api/threads.py` ~line 837-857 — workflow kickoff resolves only **published**,
  owned-or-global definitions (drafts cannot run — the fact that simplifies D-03).
- `backend/app/api/skills.py` — Skills CRUD + file upload/delete (what can mutate/delete out
  from under a reference; the snapshot makes runs immune to all of it).
- `supabase/full-schema.sql` — `skills` table (NO version column: `name/description/
  instructions/is_enabled/is_global`) + `skill_files` (filename, `file_path` → Supabase
  Storage, mime_type) — why "version snapshot" must be invented as a content copy.

### Governing rules
- `CLAUDE.md` — Deep-mode red line / no shared-path breakage; cross-provider mandate +
  provider-docs-first; migration rules (if any migration is needed); G-1/G-5 hot-file ledger
  (099 is additive on `phase_types.py`/`harness.py`/`tool_dispatcher.py`; it must NOT grow
  `backend/app/api/threads.py`, whose extraction is still due).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The framing seam already exists:** `system_prompt = phase.config.prompt +
  _retry_suffix(ctx)` in both `_exec_llm_single` and `_exec_llm_agent` — the skill block is
  a string-compose at exactly this point. `llm_agent` delivers it via
  `system_prompt_override` on `run_task_sub_agent` (unchanged substrate).
- **Per-phase whitelist machinery is shipped:** `available_tools` → `apply_tool_budget`
  (layer 1, what the model sees) + `ToolContext.phase_whitelist` (layer 2, dispatch
  backstop). "Auto-whitelist `read_skill_file`" = adding it to both layers when `skill_ref`
  is present — no new enforcement mechanism.
- **`load_skill` defines the composition vocabulary:** it returns `{name, instructions,
  files: [names]}` — the skill block should compose the same trio (D-06 mirrors it).
- **Storage copy primitives:** skill files already live in Supabase Storage with
  owner-keyed paths (`_handle_read_skill_file` resolves them); the snapshot copy is a
  Storage-to-Storage copy into a workflow-owned prefix.

### Established Patterns
- **Additive-optional config fields:** `folder_scope` on all three LLM phase configs is the
  byte-for-byte template for adding `skill_ref` (including the "inert where not applicable"
  convention on `llm_single`).
- **Gated no-op on shared paths (098 D-05a):** `_handle_read_skill_file` is shared with Deep
  mode — snapshot routing MUST be gated on workflow skill-snapshot context; absent context =
  existing behavior, byte-identical.
- **Definition-save validation (098 D-07):** publish-gate checks (skill exists / visible /
  enabled) live in the harness validate/save path that runs today, independent of Phase 103
  UI.

### Integration Points
- `skill_ref: UUID | None = None` → the three phase configs in `backend/app/models/harness.py`.
- Snapshot materialization (instructions copy + file copies) → the publish/validate path +
  a Storage copy step.
- Skill block composition → `_exec_llm_single` / `_exec_llm_agent` / `_exec_llm_batch_agents`
  in `phase_types.py`.
- Auto-whitelist + snapshot-context → `_build_phase_tool_context` + `ToolContext` +
  `_handle_read_skill_file` (gated).
- **RED LINE:** Deep-mode chat is byte-identical. `skill_ref` absent → every touched code
  path is a literal no-op (`phase_types` only runs in workflows; the one genuinely shared
  surface is `_handle_read_skill_file`, hence the D-04 gate).

</code_context>

<specifics>
## Specific Ideas

- **"The snapshot IS the published artifact"** — a published workflow must behave identically
  on every run regardless of what happens to the source skill afterward. Determinism beats
  freshness; picking up skill improvements is an explicit author act (republish → new
  version → fresh snapshot).
- **Compose like `load_skill` reads:** the agent should experience the skill in a workflow
  phase the same way it experiences `load_skill` in Deep chat — instructions + a file list,
  contents on demand.

</specifics>

<deferred>
## Deferred Ideas

- **Skills UI awareness of referencing workflows** (e.g. "this skill is snapshotted by N
  published workflows" + delete-warning UX) → Phase 103 (Workflows page) or the future Skill
  Studio direction. Snapshots make this informational, not protective.
- **General skill versioning (`skill_versions` table)** → future Skill Studio milestone
  territory; 099's content-copy snapshot deliberately avoids building it.
- **Multiple skills per phase** → additive `list[UUID]` later if a real workflow needs it.
- **Full native-7 + OpenRouter cross-provider gauntlet** → Phase 101 (spike Condition 7;
  field-map emission is where provider variance bites).
- **Global-publish privacy interaction** (private skill snapshotted into a globally-shared
  workflow) → noted for STRETCH Phase 109 (operator role / self-serve global publish).

*No reviewed-but-deferred todos — `todo.match-phase` surfaced none for this phase.*

</deferred>

---

*Phase: 099-workflow-skill-composition*
*Context gathered: 2026-06-10*
