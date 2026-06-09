# Phase 099: Workflow ↔ Skill Composition - Research

**Researched:** 2026-06-10
**Domain:** Internal codebase composition — harness phase configs + phase executors + tool dispatcher + Supabase Storage snapshot. NOT external library research.
**Confidence:** HIGH (every seam verified against live code; one load-bearing finding contradicts a CONTEXT assumption — see Pitfall 6)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Snapshot mechanics (the load-bearing decision — skills have NO versioning today):**
- **D-01: Snapshot = content copy into the definition.** At snapshot time, the skill's instructions (plus name + description) and a file manifest are copied INTO the workflow definition JSONB. Zero new tables; runs always use the snapshot. Rejected: a `skill_versions` table, and hash-pin-with-live-lookup.
- **D-02: Skill FILES are physically copied at snapshot time** to a workflow-owned Storage path keyed by definition id + version. `read_skill_file` serves from the snapshot copies during workflow runs.
- **D-03: Snapshot is taken at the draft→published transition.** Drafts keep a LIVE skill reference. Enforced in the definition validate/save path (098 D-07 precedent) — NOT dependent on the Phase 103 publish UI. Republishing re-snapshots. Drafts cannot execute (kickoff requires `status='published'`, `threads.py` ~line 854).
- **D-04 (derived; red line):** In skill-bearing workflow phases, `read_skill_file` resolves against the SNAPSHOT via a **gated branch** — the gate is the presence of skill-snapshot context on the phase `ToolContext`. When absent (Deep mode, non-skill phases), the existing live-skill resolution path is byte-identical (098 D-05a applied to `_handle_read_skill_file`).

**Composition shape:**
- **D-05: Append as a delimited block.** Phase prompt stays first and primary; the snapshotted skill instructions follow as a clearly-delimited block in the SINGLE system string at the existing seam (`system_prompt = phase.config.prompt + ...`). Provider-agnostic. (`_retry_suffix` ordering relative to the skill block is Claude's discretion; lean: retry suffix stays last.)
- **D-06: File contents are NOT inlined.** The framing lists the snapshot's filenames (mirroring what `load_skill` returns); the agent pulls contents via auto-whitelisted `read_skill_file`.
- **D-07: `llm_single` = instructions-only compose.** `llm_single` runs with `tools=[]`, so the skill block composes WITHOUT the file list and the auto-whitelist is inert there — the `folder_scope` "inert where tool-less" pattern.
- **D-08: `skill_ref` rides ALL THREE LLM phase configs** (`llm_agent`, `llm_single`, `llm_batch_agents`) — the 098 `folder_scope` shape-symmetry precedent. Each fanned-out batch sub-agent gets the same skill framing + whitelist.

**skill_ref identity & lifecycle:**
- **D-09: `skill_ref` is the skill's UUID** — consistent with 098's resolved-ids-not-hints rule. The snapshot also stores the skill's name + description (display + `read_skill_file` routing by name within the phase).
- **D-10: Publish gate = visible + enabled.** At publish/snapshot time the skill must exist, be visible to the author (owned-or-global), AND be `is_enabled`. Violation = definition-save validation error (098 D-07 pattern), never silent.
- **D-11: Single `skill_ref` per phase** (optional). Going to a list later is additive, zero-migration.

**Cross-provider validation depth (SC#10):**
- **D-12: Representative-4 live UAT** (OpenAI, Anthropic, Google, OpenRouter — one model per axis): skill framing composes + `read_skill_file` round-trips per provider. Full native-7 + OpenRouter stays reserved for Phase 101.

**Carried-forward patterns (settled, not re-asked):**
- Additive-optional fields on `_StrictBase` (`extra="forbid"`) — zero-migration; old published JSONB rows `model_validate()` cleanly (098 D-10).
- Immutability = "no-edit-published", per-version (097) — snapshot lives inside the immutable version.
- Deep byte-identical red line — shared paths get gated no-ops when the new field/context is absent (098 D-05a).

### Claude's Discretion
- Exact delimiter format of the skill block; whether the skill description composes into the framing or stays metadata-only.
- Snapshot JSONB field shape/naming inside the definition (e.g. a `skill_snapshot` object on the phase config vs a definition-level map) — planner picks what serializes cleanly with `_StrictBase`.
- Storage bucket/path layout for snapshot file copies + the RLS/access rule for them (must be readable by whoever can legitimately run the workflow).
- Whether a snapshot size guardrail is needed (lean: no cap in 099, observe first).
- Migration mechanics (whether any DB change is needed at all beyond JSONB content — the field is inside the `phases`/definition JSONB, so likely zero-migration; if a migration IS needed, follow CLAUDE.md rules).
- **Security note for the planner:** a globally-shared published workflow snapshotting a PRIVATE skill would expose that skill's content to other users. Acceptable today — no self-serve global publish (STRETCH Phase 109) — but the snapshot/storage access design should note it so Phase 109 inherits the consideration.

### Deferred Ideas (OUT OF SCOPE)
- **Skills UI awareness of referencing workflows** → Phase 103 / Skill Studio. Snapshots make this informational, not protective.
- **General skill versioning (`skill_versions` table)** → future Skill Studio milestone; 099's content-copy snapshot deliberately avoids building it.
- **Multiple skills per phase** → additive `list[UUID]` later.
- **Full native-7 + OpenRouter cross-provider gauntlet** → Phase 101.
- **Global-publish privacy interaction** → noted for STRETCH Phase 109.
- **The authoring UI that sets `skill_ref`** → Phase 103.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WFSKILL-01 | An `llm_agent` / `llm_single` phase can reference a skill via an optional `skill_ref`; the skill's instructions + referenced files compose into the phase framing and `read_skill_file` is auto-whitelisted. The skill version is snapshotted into the locked definition so a later edit/delete can't break a published workflow. (Deep path byte-identical.) | SC#1 → §Standard Stack (`skill_ref` on 3 configs) + §Architecture Pattern 2 (framing compose at the `system_prompt =` seam) + Pattern 3 (auto-whitelist on both layers). SC#2 → §Architecture Pattern 4 (snapshot at publish; Storage copy) + Pitfall 6 (NO publish endpoint exists today — D-03 needs a host). SC#3 → §Architecture Pattern 5 (gated `read_skill_file` snapshot routing = D-04) + Deep byte-identical proof method in §Validation Architecture. |
</phase_requirements>

## Summary

This is a pure **composition-of-shipped-primitives** phase. Every seam the three success criteria need already exists and was verified against live code in this session: the framing seam is the literal string `system_prompt = phase.config.prompt + _retry_suffix(ctx)` in `_exec_llm_single` (line 258) / `_exec_llm_agent` (line 302) / `_exec_llm_batch_agents` (line 364); the per-phase tool whitelist is wired on both layers (`apply_tool_budget` layer 1 + `ToolContext.phase_whitelist` layer 2); `load_skill` (`tool_dispatcher.py:333`) already defines the exact composition vocabulary `{name, instructions, files:[names]}` that D-06 mirrors; skill files already live in the private `skill-files` Supabase Storage bucket under `{user_id}/{skill_id}/{filename}`; and the 098 `folder_scope` field is a byte-for-byte template for adding `skill_ref` to all three configs.

**The one load-bearing finding that contradicts a CONTEXT assumption (Pitfall 6, HIGH confidence):** CONTEXT D-03 says the snapshot is taken "in the definition validate/save path that exists today (098 D-07 precedent)." **That path does not exist.** Workflow definitions are not created or published through any HTTP API today — `backend/app/api/workflows.py` has exactly one route (a GET picker feed). The 098 publish-gate precedent (`assert_folder_scopes_subset`) is enforced **at workflow kickoff in `threads.py` (~line 871), not at save/publish.** The pure `lint_workflow` reachability function has **no live caller** (the publish endpoint was deferred to Phase 103). So the planner must decide where the snapshot materializes: (a) enforce + snapshot at **kickoff** (`threads.py`, but that's a G-5 hot file the phase must not grow — so the logic belongs in a new harness-service module that kickoff calls in one line, exactly like `assert_folder_scopes_subset`), or (b) lean into the spirit of D-03 and build the thin save/publish seam now. Given the red-line "do not grow `threads.py`" + the cleaner determinism story, the **recommended shape is: a new `harness/skill_snapshot.py` service that (1) validates the publish gate and (2) materializes the snapshot, callable from a future publish endpoint OR — until Phase 103 ships that endpoint — invoked at the first kickoff if no snapshot is present yet** (idempotent, definition-keyed). See Pitfall 6 + Open Question 1 for the full decision surface.

**Primary recommendation:** Add `skill_ref: UUID | None = None` to all three LLM phase configs (098 `folder_scope` template) plus an optional `skill_snapshot` object (instructions + name + description + file manifest + storage prefix) that carries the materialized snapshot. Build a `harness/skill_snapshot.py` service for the publish-gate validation + Storage-to-Storage file copy into a `skill-files` (or new `workflow-snapshots`) prefix keyed by definition id + version. Compose the snapshot as a delimited block appended to the existing `system_prompt =` seam; auto-add `read_skill_file` to both whitelist layers when `skill_ref` is present; gate `_handle_read_skill_file` to route to the snapshot copies only when snapshot context rides the `ToolContext` (D-04). Deep path stays a literal no-op.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `skill_ref` schema field + `skill_snapshot` shape | API/Backend (Pydantic model layer) | Database (JSONB column, no migration) | Additive-optional fields on `_StrictBase`; the value lives inside the existing `workflow_definitions.definition` JSONB — no new column needed (098 precedent). |
| Publish-gate validation (skill exists/visible/enabled) | API/Backend (harness service) | Database (RLS-mirroring skills query) | Owner-or-global visibility predicate mirrors workflow kickoff; lands in a new `harness/skill_snapshot.py` (NOT `threads.py` — G-5). |
| Snapshot materialization (instructions copy + Storage file copy) | API/Backend (harness service) | Storage (Supabase `skill-files` bucket) | Storage-to-Storage copy via supabase-py `.download()` + `.upload()`; keyed by definition id + version. Must run via `run_in_threadpool` (D-v2.5-01). |
| Skill framing compose into phase prompt | API/Backend (`phase_types.py` executors) | — | String append at the single `system_prompt =` seam; provider-agnostic by construction. |
| `read_skill_file` auto-whitelist | API/Backend (`phase_types.py` + `tool_dispatcher.py`) | — | Add to `apply_tool_budget` input (layer 1) + `ToolContext.phase_whitelist` (layer 2) when `skill_ref` present. No new enforcement machinery. |
| Snapshot-routed `read_skill_file` reads (gated) | API/Backend (`tool_dispatcher._handle_read_skill_file`) | Storage | Gated branch on snapshot context; Deep/non-skill path byte-identical (D-04 / 098 D-05a). |
| Deep-mode chat | (unchanged — red line) | — | `phase_types.py` only runs in workflows; the one genuinely shared surface is `_handle_read_skill_file`, hence the D-04 gate. |

## Standard Stack

This phase adds **no new libraries**. It composes shipped primitives. The "stack" is the existing internal modules and the supabase-py Storage API.

### Core (existing modules the work lands in)
| Module | Symbol(s) | Purpose | Verified Location |
|--------|-----------|---------|-------------------|
| `backend/app/models/harness.py` | `LlmSinglePhaseConfig` / `LlmAgentPhaseConfig` / `LlmBatchAgentsPhaseConfig`, `_StrictBase`, `WorkflowDefinition`, `_folder_scope_requires_project` validator | Where `skill_ref` + `skill_snapshot` land; `folder_scope` is the template | lines 43–85 (configs), 27–30 (`_StrictBase`), 147–175 (`WorkflowDefinition` + validator) |
| `backend/app/services/harness/phase_types.py` | `_exec_llm_single` (252), `_exec_llm_agent` (273), `_exec_llm_batch_agents` (338), `_build_phase_tool_context` (151), `_retry_suffix` (135) | The framing seam + whitelist wiring + per-phase ToolContext build | lines as noted (all verified) |
| `backend/app/services/tool_dispatcher.py` | `_handle_read_skill_file` (420), `_handle_load_skill` (333), `ToolContext` (59), `_TOOL_REGISTRY` (1567), `dispatch_tool` (1629) | Snapshot-routed reads (gated) + the composition vocabulary + the whitelist backstop | lines as noted (all verified) |
| `backend/app/services/openai_service.py` | `apply_tool_budget` (787), `get_tools` (768), `READ_SKILL_FILE_TOOL` (329) | Layer-1 whitelist filter; the `read_skill_file` tool schema | lines as noted |
| `backend/app/services/harness/scope.py` | `assert_folder_scopes_subset` (92), `resolve_project_subtree` (51) | The 098 D-07 validate-path PRECEDENT the D-10 publish gate mirrors (a harness service, NOT a Pydantic validator — it needs supabase+user_id) | lines as noted |
| `backend/app/api/threads.py` | kickoff block (~836–878) | Where `status='published'` is enforced + where 098's `assert_folder_scopes_subset` is invoked at run-start | lines verified |

### Supporting (Storage primitives — already in use, no new dependency)
| Primitive | API | Purpose | Where It's Already Used |
|-----------|-----|---------|-------------------------|
| Supabase Storage download | `supabase.storage.from_("skill-files").download(path)` | Read a skill file's bytes | `tool_dispatcher.py:450`, `skills.py:553` (export) |
| Supabase Storage upload | `supabase.storage.from_("skill-files").upload(path=..., file=..., file_options={...})` | Write the snapshot copy | `skills.py:90,445` (upsert via `"upsert":"true"`) |
| Supabase Storage remove | `supabase.storage.from_("skill-files").remove([path])` | Cleanup (not needed in 099 happy path) | `skills.py:305,498` |

**There is no `.copy()` primitive in use** — the Storage-to-Storage copy is a `download()` then `upload()` pair (verified: `skills.py:553` downloads on export; no `storage.copy` anywhere in the codebase). `[VERIFIED: codebase grep — no `storage.*copy` call exists]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `download()`+`upload()` byte copy | supabase-py `storage.from_(b).copy(from, to)` (if exposed) | A native copy would be one round-trip, but it is NOT used anywhere in the codebase and copies within a single bucket only. The download+upload pair is the proven pattern (export uses it) and works across bucket boundaries. Lean: download+upload. |
| New `workflow-snapshots` bucket | Reuse `skill-files` bucket under a `workflow-snapshots/{def_id}/{version}/` prefix | A new bucket needs a migration (`INSERT INTO storage.buckets` + 3 storage RLS policies — see `017_skills.sql:95–132`). Reusing `skill-files` under a distinct prefix avoids a bucket migration but the existing storage RLS keys read access on `(storage.foldername(name))[1] = auth.uid()` — i.e. the FIRST path segment must be the reader's user id. A workflow-owned prefix breaks that predicate (see Pitfall 7 — this is the RLS decision the planner owns). |

**Installation:** None. No `pip install`, no `Dockerfile.sandbox` change, no `SANDBOX_IMAGE` bump (snapshot reads happen in the backend, not the sandbox).

**Version verification:** N/A — no new package. The supabase-py Storage API is already pinned in `backend/requirements.txt` and exercised by `skills.py`. `[VERIFIED: codebase — supabase Storage API already imported and used]`

## Architecture Patterns

### System Architecture Diagram

```
AUTHOR TIME (draft, live skill reference)
  author sets skill_ref (UUID) on an llm_agent/llm_single/llm_batch_agents phase
        │  (the UI that sets this is Phase 103 — out of scope here)
        ▼
  WorkflowDefinition JSONB  ──  draft, skill_ref present, NO skill_snapshot yet

PUBLISH TIME (draft → published)  ── the snapshot materializes
        │
        ▼
  harness/skill_snapshot.py  (NEW service — the D-03/D-10 host)
    ├─ publish gate (D-10): skill exists? visible (owned-or-global)? is_enabled?  ── else ValueError → 400
    ├─ copy skill.instructions + name + description  ──►  skill_snapshot.instructions (into JSONB)
    └─ for each skill_file:  storage.download(skill path) ─► storage.upload(snapshot path)
                                              keyed by definition id + version
        │
        ▼
  WorkflowDefinition JSONB  ──  published, skill_snapshot fully self-contained
                                 (live skill edit/delete now CANNOT affect this version)

RUN TIME (kickoff → phase execution)
  threads.py kickoff  ── resolves PUBLISHED definition (line 854) ── model_validate()
        │
        ▼
  harness_engine → phase_types._exec_llm_agent / _exec_llm_single / _exec_llm_batch_agents
        │
        ├─ FRAMING (D-05/D-06):  system_prompt = phase.config.prompt
        │                          + skill_block(snapshot.name, snapshot.instructions, file_manifest)
        │                          + _retry_suffix(ctx)        [retry suffix stays last]
        │
        ├─ WHITELIST (D-04 auto-whitelist): add "read_skill_file" to
        │      available_tools (→ apply_tool_budget layer 1) AND phase_whitelist (layer 2)
        │
        └─ _build_phase_tool_context: attach skill_snapshot context onto the per-phase ToolContext
                │
                ▼
        sub-agent calls read_skill_file(skill_name, filename)
                │
                ▼
        tool_dispatcher._handle_read_skill_file
            ├─ GATE (D-04): ctx has skill-snapshot context?
            │     YES → resolve filename against SNAPSHOT manifest, download from snapshot prefix
            │     NO  → existing live-skill resolution (BYTE-IDENTICAL — Deep & non-skill phases)
            └─ return file text

DEEP MODE (the red line)
  agent_loop → tool_dispatcher._handle_read_skill_file
        └─ ctx.skill_snapshot is None → existing live-skill path → BYTE-IDENTICAL no-op
```

### Recommended Project Structure
```
backend/app/
├── models/harness.py                      # + skill_ref + skill_snapshot fields (098 folder_scope template)
├── services/harness/
│   ├── phase_types.py                     # framing compose + auto-whitelist + snapshot ctx attach
│   ├── skill_snapshot.py                  # NEW — publish gate (D-10) + Storage materialization (D-02/D-03)
│   └── scope.py                           # (READ ONLY — the precedent for skill_snapshot.py's shape)
├── services/tool_dispatcher.py            # _handle_read_skill_file gated snapshot routing + ToolContext field
└── api/threads.py                         # ONE-LINE call site only (do NOT grow — G-5)
```

### Pattern 1: Additive-optional field on all three LLM phase configs (098 `folder_scope` template)
**What:** Add `skill_ref: UUID | None = None` to `LlmSinglePhaseConfig`, `LlmAgentPhaseConfig`, `LlmBatchAgentsPhaseConfig` — byte-for-byte the way `folder_scope` was added.
**When to use:** Always — this is the D-08 shape-symmetry decision.
**Example:**
```python
# Source: backend/app/models/harness.py:52,67,84 (folder_scope — the verified template)
class LlmAgentPhaseConfig(_StrictBase):
    phase_type: Literal["llm_agent"]
    prompt: str
    available_tools: list[str]
    max_steps: int = 12
    wall_clock_seconds: int | None = None
    model: str | None = None
    folder_scope: list[UUID] | None = None   # 098 PROJ-02 — the additive-optional template
    skill_ref: UUID | None = None             # 099 WFSKILL-01 — resolved id, NOT a name (D-09)
    # skill_snapshot: <discretion shape> | None = None   # materialized at publish (D-01/D-02)
```
Because every field is optional on `_StrictBase` (`extra="forbid"`), every already-published `WorkflowDefinition` JSONB row still `model_validate()`s cleanly — zero migration (098 D-10, `[VERIFIED: models/harness.py:30 ConfigDict(extra="forbid") + harness.py:154-161 the 098 additive block did exactly this]`).

### Pattern 2: Compose the skill block at the single `system_prompt =` seam (D-05)
**What:** Append a delimited skill block to the phase prompt at the exact existing string-concat point.
**When to use:** In all three executors. Provider-agnostic — it's one system string, no per-provider branch.
**Example:**
```python
# Source: backend/app/services/harness/phase_types.py:258 (_exec_llm_single — verified)
system_prompt = phase.config.prompt + _retry_suffix(ctx)
# 099: insert the skill block BEFORE the retry suffix (lean per D-05 discretion):
system_prompt = phase.config.prompt + _skill_block(phase, ctx) + _retry_suffix(ctx)
# where _skill_block returns "" when no snapshot (no-op), else e.g.:
#   "\n\n## Skill: {name}\n{instructions}\n\nAttached files (read with read_skill_file):\n- {f1}\n- {f2}"
# llm_single (D-07): compose instructions WITHOUT the file list (tools=[], so read_skill_file is inert)
```
`_exec_llm_agent` (line 302) and `_exec_llm_batch_agents` (line 364) have the identical `phase.config.prompt + _retry_suffix(ctx)` shape — the same `_skill_block` helper slots into all three. `llm_agent` delivers it via `system_prompt_override` on `run_task_sub_agent` (unchanged substrate). `[VERIFIED: phase_types.py:258,302,364]`

### Pattern 3: Auto-whitelist `read_skill_file` on both layers (D-04)
**What:** When `skill_ref` is present, add `"read_skill_file"` to the phase's effective tool list so layer-1 (`apply_tool_budget`) exposes it to the model AND layer-2 (`phase_whitelist`) admits it at dispatch.
**When to use:** `llm_agent` + `llm_batch_agents` (tool-bearing). Inert on `llm_single` (tools=[]) — D-07.
**Example:**
```python
# Source: phase_types.py:283-293 (_exec_llm_agent — verified) + :208-210 (_build_phase_tool_context)
# Today both layers derive from phase.config.available_tools:
whitelist = frozenset(phase.config.available_tools)            # line 283
tools_override = apply_tool_budget(get_tools(...), model, whitelist)   # line 291
# ... and in _build_phase_tool_context:
available_tools=list(phase.config.available_tools),           # line 208
phase_whitelist=frozenset(phase.config.available_tools),      # line 210
# 099: when skill_ref present, compute an effective list = available_tools ∪ {"read_skill_file"}
#      and feed THAT to all four sites. read_skill_file is already a registered handler
#      (tool_dispatcher.py:1579) and a real tool schema (openai_service.py:329) — no new tool.
```
`apply_tool_budget` (verified `openai_service.py:787`) never drops a whitelisted tool, so auto-whitelisting `read_skill_file` survives the per-provider `max_tools` budget cap. `[VERIFIED: openai_service.py:818-846]`

### Pattern 4: Publish gate + snapshot materialization as a harness service (098 `scope.py` precedent)
**What:** A new `harness/skill_snapshot.py` with two async functions mirroring `scope.py`'s two-function shape: a publish gate (skill exists/visible/enabled → `ValueError` on violation) and a materializer (copy instructions into JSONB + Storage-copy files).
**When to use:** At publish (D-03). Because there is NO publish endpoint today (Pitfall 6), the call site is either a future Phase-103 endpoint or a one-line idempotent invocation at kickoff.
**Example:**
```python
# Source: backend/app/services/harness/scope.py:92 (assert_folder_scopes_subset — the verified precedent)
#   - takes (definition, *, supabase, user_id) — a SERVICE, not a Pydantic validator
#     (a validator has no supabase/user_id; scope.py:32-35 documents exactly this anti-pattern)
#   - owner-scoped visibility query mirrors threads.py kickoff (owned-or-global)
async def validate_skill_refs(definition, *, supabase, user_id) -> None:
    """D-10 publish gate: each phase skill_ref must resolve to a visible, enabled skill."""
    # owned-or-global + is_enabled, mirroring _handle_load_skill (tool_dispatcher.py:338-345)
    # raise ValueError(...) on miss → 400 at the caller (same as assert_folder_scopes_subset)

async def materialize_skill_snapshots(definition, *, supabase, user_id) -> WorkflowDefinition:
    """D-01/D-02: copy instructions into JSONB + Storage-copy files to a def-id+version prefix.
       MUST wrap supabase-py Storage calls in run_in_threadpool (D-v2.5-01)."""
```
**Skill resolution query (verified pattern to reuse, `tool_dispatcher.py:338-345`):**
```python
supabase.table("skills")
  .select("id, name, description, instructions, user_id")
  .or_(f"user_id.eq.{user_id},is_global.eq.true")
  .eq("id", str(skill_ref))         # D-09: resolve by UUID, not name
  .eq("is_enabled", True)           # D-10: enabled gate
```

### Pattern 5: Gated snapshot routing in `_handle_read_skill_file` (D-04 / 098 D-05a)
**What:** A branch at the top of `_handle_read_skill_file` — if the ToolContext carries skill-snapshot context, resolve the file against the snapshot manifest + download from the snapshot prefix; otherwise the existing live-skill resolution runs unchanged.
**When to use:** Always present in the handler; the gate (`ctx.skill_snapshot is None`) makes it a literal no-op for Deep mode and non-skill workflow phases.
**Example:**
```python
# Source: tool_dispatcher.py:420-487 (_handle_read_skill_file — verified) +
#         the 098 D-05a gate pattern at :179 (_handle_search_documents: `if ctx.folder_subtree_ids is not None:`)
async def _handle_read_skill_file(args, ctx):
    # 099 D-04 GATE — mirrors the 098 search-scope gate (byte-identical when absent):
    snapshot = getattr(ctx, "skill_snapshot", None)
    if snapshot is not None:
        # resolve args["filename"] against snapshot.file_manifest; download from snapshot prefix
        # (same download → ext-decode logic as the live path, just a different storage_path)
        ...
        return ToolResult(result=...)
    # ELSE: existing live-skill resolution (lines 421-487) — UNCHANGED, byte-identical
```
The 098 search-scope gate (`if ctx.folder_subtree_ids is not None:` at `_handle_search_documents:179`) is the proven precedent for "gated branch on a new ToolContext field, additive, Deep byte-identical." `[VERIFIED: tool_dispatcher.py:179]`

### Anti-Patterns to Avoid
- **Putting the publish gate in a Pydantic `@model_validator`:** A pure validator has no `supabase`/`user_id` — it cannot check skill existence/visibility/enabled. `scope.py:32-35` documents this exact anti-pattern for the 098 DB-aware ⊆ check. The gate MUST be an async service. The structural `@model_validator` on `WorkflowDefinition` (harness.py:163) can only do pure-shape checks (e.g. "skill_snapshot present ⇒ skill_ref present").
- **Growing `threads.py`:** It's a G-5-firing hot file (9+ touches; extraction due). Any kickoff-time snapshot/validation call must be a ONE-LINER into a harness service — exactly how `assert_folder_scopes_subset` is invoked at `threads.py:871`.
- **Calling supabase-py Storage synchronously in the async handler:** `.download()`/`.upload()` are blocking I/O — wrap in `run_in_threadpool` (D-v2.5-01). NOTE the existing `_handle_read_skill_file` calls `.download()` directly (line 450) WITHOUT threadpool — that's a pre-existing pattern; the snapshot materializer (new code) should do it right, but matching the existing read path for the read side avoids a behavior change on the gated branch (planner's call — see Pitfall 1).
- **Inlining file contents into the framing:** D-06 — list filenames only, let `read_skill_file` pull on demand. Context stays lean and mirrors `load_skill`.
- **A new `skill_versions` table or any DB migration for the snapshot:** D-01 — the snapshot is JSONB content inside the existing `definition` column. The file COPIES go to Storage. A new bucket is the only thing that would need a migration (and even that is avoidable — see Pitfall 7).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-phase tool whitelist enforcement | A new dispatch guard for `read_skill_file` | The shipped two-layer whitelist: `apply_tool_budget` (layer 1) + `ToolContext.phase_whitelist` + `dispatch_tool` backstop (layer 2) | Already enforces hallucinated-tool refusal with a `tool_refused` audit. Auto-whitelist = add the name to both layers. `[VERIFIED: tool_dispatcher.py:1636]` |
| Skill composition vocabulary | A bespoke skill→prompt format | Mirror `load_skill`'s `{name, instructions, files:[names]}` return | The agent already experiences skills this way in Deep chat (D-06 "compose like load_skill reads"). `[VERIFIED: tool_dispatcher.py:376-380]` |
| Skill file storage path scheme | A new path convention | The existing `{user_id}/{skill_id}/{filename}` scheme + a workflow-owned snapshot prefix variant | `_handle_read_skill_file:448` + `skills.py:441` use `{user_id}/{skill_id}/{filename}`; the snapshot just keys by `{def_id}/{version}/...`. |
| Definition-validity → HTTP error mapping | A new error pathway | The `ValueError → 400` pattern from `assert_folder_scopes_subset` at `threads.py:874-878` | A definition validity failure already maps cleanly to a 400. Reuse it. `[VERIFIED: threads.py:870-878]` |
| Published-definition resolution under RLS | A new resolve path | The kickoff resolver at `threads.py:841-863` (owned-or-global, published, `model_validate()`) | It already refuses non-owned/private/unpublished with 404 and parses to the typed model. `[VERIFIED]` |
| Run-keyed parent ToolContext build | A new context builder | `_build_phase_tool_context` (phase_types.py:151) | This is the single seam where the snapshot context attaches to the per-phase ToolContext. `[VERIFIED]` |

**Key insight:** This phase is ~95% wiring of existing seams. The only genuinely net-new code is `harness/skill_snapshot.py` (publish gate + Storage materialization) and a `_skill_block` helper + a gated branch in `_handle_read_skill_file`. Everything else is adding a field and threading a value.

## Runtime State Inventory

> 099 is an additive feature phase (greenfield seam), NOT a rename/refactor/migration. This section is included only because the snapshot introduces *new* persisted runtime state — it documents what 099 CREATES, so the planner accounts for cleanup/lifecycle.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Snapshot instructions/name/description/file-manifest are NEW content inside `workflow_definitions.definition` JSONB (no new column, no new table per D-01). | None beyond writing it at publish; it lives and dies with the definition version (immutable). |
| Live service config | None — no external service (n8n / Datadog / Tailscale / etc.) holds any 099 state. | None — verified: 099 touches only Supabase (DB + Storage) and the backend process. |
| OS-registered state | None — no Task Scheduler / pm2 / systemd registration. | None. |
| Secrets/env vars | None — no new secret or env var. Storage access uses the existing supabase client. | None. |
| Build artifacts | None — no new pip package, no `Dockerfile.sandbox` change, no `SANDBOX_IMAGE` bump (snapshot reads are backend-side, not in the sandbox). | None — verified against CLAUDE.md sandbox section: snapshot does not touch the sandbox image. |
| **NEW: Storage objects** | Snapshot file COPIES in the `skill-files` (or a new `workflow-snapshots`) bucket under a `{def_id}/{version}/` prefix. **These are orphaned if a definition is hard-deleted** (no cascade — `workflow_definitions` has no FK to storage objects). | Lifecycle decision for the planner: leave orphans (cheap, files are small per D-02) OR add a delete-cascade later. 099 lean: leave (deferred-ideas / Phase 103 Skills-UI awareness). Document it. |

## Common Pitfalls

### Pitfall 1: supabase-py Storage I/O in async handlers without `run_in_threadpool`
**What goes wrong:** `.download()`/`.upload()` are synchronous blocking HTTP calls; calling them directly inside an async handler blocks the event loop (CLAUDE.md decision D-v2.5-01).
**Why it happens:** The existing `_handle_read_skill_file:450` calls `.download()` directly (a pre-existing pattern that predates the rule). Copying that pattern into NEW snapshot-materialization code would block the loop during a multi-file copy.
**How to avoid:** Wrap the snapshot materializer's Storage calls in `run_in_threadpool` (`from starlette.concurrency import run_in_threadpool` — already imported in `tool_dispatcher.py:26`). For the gated READ branch, the planner may match the existing un-wrapped read for byte-symmetry with the live path OR wrap it (both acceptable; the read is a single small file).
**Warning signs:** A publish with several skill files visibly stalls other requests; uvicorn worker latency spikes during publish.

### Pitfall 2: `extra="forbid"` rejects old published rows if the snapshot shape is non-optional
**What goes wrong:** If `skill_snapshot` (or any sub-field) is added as a required field, every already-published `WorkflowDefinition` JSONB row fails `model_validate()` at the next kickoff → existing workflows break.
**Why it happens:** `_StrictBase` sets `ConfigDict(extra="forbid")` (harness.py:30); the nested snapshot object is itself a `_StrictBase` if modeled as one.
**How to avoid:** EVERY new field optional with a default (`skill_ref: UUID | None = None`, `skill_snapshot: SkillSnapshot | None = None`). The nested `SkillSnapshot` model's own fields can be required (it only exists when present), but the field that HOLDS it on the phase config must default to `None`. This is the exact 098 D-10 pattern (harness.py:154-161). `[VERIFIED]`
**Warning signs:** A pre-099 published workflow 400s at kickoff with a pydantic ValidationError.

### Pitfall 3: Multi-worker uvicorn — no in-process state for the snapshot
**What goes wrong:** Caching a snapshot in a module-level dict would be invisible to the other worker (`WORKER_COUNT=2` default, CLAUDE.md / D-PRD-12).
**Why it happens:** The snapshot is cross-request state.
**How to avoid:** The snapshot lives in the DB JSONB + Storage — both shared across workers by construction. Don't add any in-process cache. (This is already the natural design; the pitfall is only if someone "optimizes" with a memo dict.)
**Warning signs:** A snapshot visible on one request and absent on the next under load.

### Pitfall 4: Deep-path regression in `_handle_read_skill_file` (the red line)
**What goes wrong:** Any change to the live-skill resolution branch (lines 421-487) changes Deep-mode `read_skill_file` behavior — the explicit SC#3 violation.
**Why it happens:** `_handle_read_skill_file` is the ONE genuinely shared surface (Deep chat + workflow phases both dispatch through it).
**How to avoid:** Add ONLY the gated branch at the top (`if ctx.skill_snapshot is not None: ... return`). Do NOT touch the existing code below it. The new `ToolContext.skill_snapshot` field defaults to `None` (098 D-05a: absent context = byte-identical). Prove it with the cross-provider SSE byte-identical method (§Validation Architecture) + a `test_deep_noop`-style unit test (the 098 test at `test_098_scope_governance.py` has the exact analog: `test_deep_noop` asserting no behavior change when the new ctx field is None).
**Warning signs:** A Deep-chat `read_skill_file` call returns different bytes / errors after the change; the byte-identical SSE diff is non-empty.

### Pitfall 5: There is NO `skill_versions` / version column on `skills` — the snapshot is the ONLY versioning
**What goes wrong:** Assuming a skill has a queryable version to pin would lead to a hash-pin-with-live-lookup design that D-01 explicitly rejected (a deleted skill still breaks the run).
**Why it happens:** "Version snapshotted into the locked definition" (SC#2) sounds like there's a version to reference.
**How to avoid:** The `skills` table has `name/description/instructions/is_enabled/is_global` and NO version column (`[VERIFIED: full-schema.sql:618-628, migration 017_skills.sql:8-18]`). "Version" is INVENTED as a content copy (D-01). The published definition's own `version` integer (WorkflowDefinition.version, harness.py:149) is the version that matters — republish = new definition version = fresh snapshot.
**Warning signs:** Design references a `skill.version` that doesn't exist.

### Pitfall 6 (THE LOAD-BEARING ONE): There is NO definition save/publish path today — D-03's "validate/save path that exists today" does not exist
**What goes wrong:** CONTEXT D-03 says snapshot at "the definition validate/save path that exists today (098 D-07 precedent)." That path does NOT exist. `backend/app/api/workflows.py` has exactly one route — `GET /workflows/published` (a read). There is no draft create, no draft→publish transition endpoint, no save. The 098 publish-gate (`assert_folder_scopes_subset`) is enforced at **workflow KICKOFF in `threads.py:871`, at run-start** — not at save. The pure `lint_workflow` reachability function (`harness/reachability.py:83`) has **zero live callers** — its docstring says "the HTTP publish endpoint is deferred to Phase 092" and it was further deferred; WFAUTH-01 (the draft CRUD + publish API) is **Phase 103**.
**Why it happens:** 098's D-07 precedent is itself enforced at kickoff, not save — the CONTEXT conflates "validate/save path" with the actual run-start enforcement seam.
**How to avoid:** The planner must choose the snapshot host. Two viable shapes:
  - **(A) Snapshot-at-kickoff, lazy + idempotent (recommended for 099 scope):** at `threads.py` kickoff, after `model_validate()`, call a one-line `materialize_skill_snapshots_if_needed(definition, ...)` in `harness/skill_snapshot.py`. If the published definition already carries `skill_snapshot` on its skill-bearing phases, no-op; otherwise materialize once and (optionally) persist back. The publish GATE (D-10 visible+enabled) runs here too, surfacing `ValueError → 400` exactly like `assert_folder_scopes_subset`. PRO: ships fully within 099, no new API surface, doesn't grow `threads.py` (one-liner into a service). CON: technically "first-run" not "publish-time" — but since drafts can't run (D-03's own simplifying fact, `threads.py:854`), first-run IS the first moment a snapshot is needed, and it's deterministic thereafter.
  - **(B) Build the thin publish endpoint now:** add a minimal `POST /workflows/{id}/publish` that runs the gate + lint + snapshot. PRO: matches D-03's letter. CON: overlaps Phase 103's WFAUTH-01 (draft CRUD + publish API) — risk of building it twice / diverging.
  **The decision is the planner's; surface it to discuss-phase.** Recommendation: (A) for 099, with `skill_snapshot.py` structured so a Phase-103 publish endpoint can call the same materializer. See Open Question 1.
**Warning signs:** A plan task says "add the snapshot to the publish endpoint" without first noting the endpoint doesn't exist.

### Pitfall 7: skill-files Storage RLS keys read access on the FIRST path segment = the reader's user id
**What goes wrong:** The existing `skill-files` storage RLS SELECT policy (migration 017_skills.sql:102-116) grants read when `(storage.foldername(name))[1] = auth.uid()::text` OR the file belongs to a global skill. A snapshot copied under `{def_id}/{version}/...` has a DEFINITION id as its first segment — so the owner-segment predicate fails, and the global-skill EXISTS predicate (joins `skill_files`→`skills`) won't match a snapshot file (it's not a `skill_files` row). A user running the workflow could be UNABLE to read their own snapshot via the user-scoped client.
**Why it happens:** The backend `_handle_read_skill_file` runs with the request's supabase client (user JWT) for Deep, but harness phases run as **service role** (which bypasses storage RLS — see `harness_engine` / `scope.py` header "the engine runs as service role"). So at RUN time the read may be fine (service role). But the publish-time WRITE and any user-scoped access need a deliberate RLS decision.
**How to avoid:** Three options for the planner (Claude's Discretion per CONTEXT): (i) keep snapshots in `skill-files` under a `{user_id}/_snapshots/{def_id}/{version}/...` prefix so the existing owner-segment RLS still grants the author read access; (ii) write+read snapshots exclusively via the service-role client (harness runs as service role anyway — `[VERIFIED: scope.py:24-26 "the engine runs as service role (bypasses RLS)"]`) and never expose them to the user-scoped client; (iii) a new `workflow-snapshots` bucket with its own RLS (needs a migration — bucket INSERT + 3 storage policies, per 017_skills.sql:95-132). Recommendation: (i) or (ii) — avoid the migration. **The global-publish privacy note (CONTEXT discretion) lives here:** a globally-published workflow's snapshot files must be readable by other users, which (i) does NOT grant — so global publish (Phase 109) will need option (iii) or a global-readable prefix. Document for Phase 109 inheritance.
**Warning signs:** `read_skill_file` works in a workflow run (service role) but 403s if ever read via a user JWT; or a globally-shared workflow can't read its snapshot files.

## Code Examples

### Verified composition vocabulary (`load_skill` — the D-06 template)
```python
# Source: backend/app/services/tool_dispatcher.py:376-380 (_handle_load_skill return — verified)
return ToolResult(result=json.dumps({
    "name": row["name"],
    "instructions": row["instructions"],
    "files": file_names,          # [filename, ...] — names only, NOT contents (D-06)
}))
```

### Verified 098 gated-no-op (the D-04 / D-05a template)
```python
# Source: backend/app/services/tool_dispatcher.py:179 (_handle_search_documents — verified)
# The gate: new ToolContext field is None in Deep → branch skipped → byte-identical.
if ctx.folder_subtree_ids is not None:        # 099 analog: if ctx.skill_snapshot is not None:
    ...                                        #   resolve against snapshot + return
# else: existing path runs unchanged (the red line)
```

### Verified publish-gate → 400 mapping (the D-10 template)
```python
# Source: backend/app/api/threads.py:870-878 (098 assert_folder_scopes_subset call — verified)
try:
    await assert_folder_scopes_subset(_kickoff_definition, supabase=supabase, user_id=current_user["id"])
except ValueError as _scope_err:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(_scope_err))
# 099: the skill publish-gate (validate_skill_refs) raises ValueError the same way → same 400 mapping.
```

### Verified skill resolution by id + enabled (the D-09/D-10 query)
```python
# Source: backend/app/services/tool_dispatcher.py:338-345 (_handle_load_skill — verified, adapted to id)
supabase.table("skills")
    .select("id, name, description, instructions, user_id")
    .or_(f"user_id.eq.{user_id},is_global.eq.true")   # owned-or-global visibility (D-10)
    .eq("id", str(skill_ref))                          # D-09: by UUID
    .eq("is_enabled", True)                            # D-10: enabled gate
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scope/skill refs land as ids embedded in prompt TEXT (the model can widen/ignore) | Resolved-id schema fields bound server-side (`folder_scope`, now `skill_ref`) | Phase 098 (folder_scope); spike-097 CONCLUSION §3 (iii) | A schema field is authoritative + immutable in the locked definition; a prompt hint is not. `skill_ref` follows the same rule. |
| Skill content read live from `skills`/`skill_files` at run time | Snapshot content-copy into the locked definition (D-01) | Phase 099 (this phase) | A published workflow is deterministic regardless of later skill edit/delete. |
| Publish-time lint/gate is a pure function with no caller | Still no caller — publish endpoint deferred to Phase 103 | (unchanged) | 099 must choose its own snapshot host (Pitfall 6). |

**Deprecated/outdated:** Nothing deprecated. The `_handle_load_skill` / live-skill path stays — it's the Deep-mode behavior 099 must NOT touch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Harness phases run as service role, so storage RLS is bypassed at run-time snapshot reads | Pitfall 7 | If a future change runs harness reads under a user JWT, the `{def_id}` first-segment RLS predicate would 403. `[VERIFIED via scope.py:24-26 header, but the specific storage-read client for the gated branch was not traced end-to-end — flagged]` |
| A2 | Reusing `skill-files` bucket under a new prefix needs NO migration; only a NEW bucket does | Standard Stack / Pitfall 7 | If the storage RLS must change to admit the new prefix, that IS a migration (storage.objects policy). Low risk — option (i)/(ii) avoid it. |
| A3 | The snapshot file copy is small enough that download+upload (no native copy) is fine | Standard Stack | If skills carry large files, a multi-MB download+upload per publish adds latency. D-02 asserts files are "typically small"; no cap in 099 (discretion). |

**Note:** This table is intentionally short — the bulk of this research is `[VERIFIED]` against live code, not `[ASSUMED]`. The three assumptions above are the only material unknowns and all are low-risk with documented mitigations.

## Open Questions (RESOLVED)

1. **Where does the snapshot materialize, given no publish endpoint exists? (THE decision — Pitfall 6)**
   - **RESOLVED by operator decision D-03a (CONTEXT.md, 2026-06-10):** snapshot at FIRST KICKOFF — lazy + idempotent, via the standalone `harness/skill_snapshot.py` service, one-liner call from `threads.py`, shaped for Phase 103's publish endpoint to reuse. Implemented by Plans 099-03 + 099-04.
   - What we know: no save/publish API today; kickoff is the only enforcement seam; drafts can't run.
   - What's unclear: snapshot-at-first-kickoff (lazy/idempotent, ships in 099) vs build-the-publish-endpoint-now (overlaps Phase 103 WFAUTH-01).
   - Recommendation: snapshot-at-first-kickoff via a `harness/skill_snapshot.py` service called as a one-liner from `threads.py` kickoff (mirrors `assert_folder_scopes_subset`), structured so a Phase-103 publish endpoint reuses the same materializer. Surface to discuss-phase — this changes the plan shape.

2. **Snapshot JSONB shape: per-phase `skill_snapshot` object vs a definition-level snapshot map? (Claude's Discretion)**
   - **RESOLVED by planner discretion:** per-phase co-located `skill_snapshot` on the phase config (the recommendation) — Plan 099-01 Task 2.
   - What we know: `skill_ref` rides each phase config (D-08); a phase references at most one skill (D-11).
   - What's unclear: whether the materialized content sits on the same phase config (co-located, simplest) or in a `WorkflowDefinition`-level `skill_snapshots: dict[skill_id, SkillSnapshot]` (de-duplicated if two phases reference the same skill).
   - Recommendation: per-phase co-located `skill_snapshot` on the phase config — simplest, serializes cleanly with `_StrictBase`, matches the "phase is self-contained" model. De-dup is a non-issue at current scale (files are small). Planner picks.

3. **Storage bucket/prefix + RLS for snapshot copies (Claude's Discretion — Pitfall 7)**
   - **RESOLVED by planner discretion:** `{user_id}/_snapshots/{def-slug}-v{version}/{skill_id}/...` in the existing `skill-files` bucket (author-scoped first segment keeps existing RLS valid, no migration) — Plan 099-03 Task 1. Global-publish variant noted for Phase 109.
   - What we know: existing `skill-files` RLS keys read on the first path segment = reader's user id; harness runs as service role.
   - What's unclear: `{user_id}/_snapshots/...` (author-readable, not global-readable) vs service-role-only vs a new bucket.
   - Recommendation: `{user_id}/_snapshots/{def_id}/{version}/{filename}` in the existing `skill-files` bucket (no migration, author-readable). Note for Phase 109 that global publish needs a global-readable variant.

4. **Wrap the gated READ branch in `run_in_threadpool` or match the existing un-wrapped read? (Pitfall 1)**
   - **RESOLVED by planner discretion:** match the existing un-wrapped `.download()` on the snapshot READ (byte-symmetry with the live path); wrap only the multi-file WRITE materializer — Plan 099-03 Task 2.
   - Recommendation: match the existing un-wrapped `.download()` for the read (byte-symmetry with the live path; single small file); wrap only the multi-file WRITE materializer. Low stakes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Storage (`skill-files` bucket) | Snapshot file copies (D-02) | ✓ | n/a (managed) | — (bucket exists since migration 017) |
| supabase-py Storage API | download/upload primitives | ✓ | pinned in requirements.txt, used by skills.py | — |
| `skills` / `skill_files` tables | Publish-gate resolution + file manifest | ✓ | schema verified (full-schema.sql:618, migration 017) | — |
| Postgres `workflow_definitions.definition` JSONB | Snapshot content (instructions/name/desc/manifest) | ✓ | column exists (full-schema.sql:701) | — |
| Docker sandbox / `SANDBOX_IMAGE` | NOT required — snapshot reads are backend-side | n/a | — | — (no sandbox involvement) |

**Missing dependencies with no fallback:** None. Every dependency this phase needs is already provisioned (Supabase Storage + the skills tables + the JSONB column).
**Missing dependencies with fallback:** None.

## Validation Architecture

> Nyquist validation is ENABLED (`config.json` → `workflow.nyquist_validation: true`). VALIDATION.md is generated from this section. UAT rows belong in VALIDATION.md, NOT in PLAN.md tasks.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend, `venv`) — `[VERIFIED: backend/tests/ has 098 + harness test suites]` |
| Config file | `backend/` runs pytest from the venv (no separate pytest.ini surfaced; tests live under `backend/tests/`) |
| Quick run command | `cd backend && .\venv\Scripts\python -m pytest tests/test_099_skill_composition.py -x` (new file) |
| Full suite command | `cd backend && .\venv\Scripts\python -m pytest tests/ -q` (baseline: 81/81 green per Phase 098 close) |

**Offline-first convention (verified from `test_098_scope_governance.py:23-25`):** unit tests use conftest fakes (`_FakeRedis`, `make_tool_context`, `mock_asyncpg_pool`) — no live Redis/Postgres. The skill-snapshot + framing + whitelist tests follow the same offline pattern; the cross-provider round-trip is LIVE UAT (VALIDATION.md, manual per D-12).

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC#1a | `skill_ref` parses on all 3 LLM configs; old rows still `model_validate()` | unit | `pytest tests/test_099_skill_composition.py::test_skill_ref_additive_optional -x` | ❌ Wave 0 |
| SC#1b | Skill block composes into `system_prompt` at the seam (3 executors); `llm_single` omits file list (D-07) | unit | `pytest tests/test_099_skill_composition.py::test_skill_block_compose -x` | ❌ Wave 0 |
| SC#1c | `read_skill_file` auto-whitelisted on both layers when `skill_ref` present; inert on `llm_single` | unit | `pytest tests/test_099_skill_composition.py::test_auto_whitelist -x` | ❌ Wave 0 |
| SC#2a | Publish gate raises `ValueError` on missing / not-visible / disabled skill (D-10) | unit | `pytest tests/test_099_skill_composition.py::test_publish_gate_rejects -x` | ❌ Wave 0 |
| SC#2b | Snapshot materializer copies instructions into JSONB + Storage-copies files; run uses snapshot not live skill | unit (faked Storage) | `pytest tests/test_099_skill_composition.py::test_snapshot_materialize -x` | ❌ Wave 0 |
| SC#2c | Editing/deleting the live skill after publish does NOT change the snapshot read | unit | `pytest tests/test_099_skill_composition.py::test_snapshot_immune_to_live_edit -x` | ❌ Wave 0 |
| SC#3 | `_handle_read_skill_file` emits NO new behavior when `ctx.skill_snapshot is None` (Deep + non-skill byte-identical) | unit | `pytest tests/test_099_skill_composition.py::test_deep_noop -x` (analog: `test_098_scope_governance.py::test_deep_noop`) | ❌ Wave 0 |
| SC#3 | Gated branch routes to snapshot when context present | unit | `pytest tests/test_099_skill_composition.py::test_snapshot_routing -x` | ❌ Wave 0 |

### Byte-identical Deep-path proof method (SC#3 — the red line)
The project has an established cross-provider SSE byte-identical proof method from Phase 089/092.5 (Deep stays byte-identical across the native-7 by diffing the SSE event stream). For 099 SC#3 the proof is twofold:
1. **Unit (automated):** `test_deep_noop` — call `_handle_read_skill_file` with `ctx.skill_snapshot = None` and assert the result is byte-identical to the pre-099 path (the 098 `test_deep_noop` at `test_098_scope_governance.py` is the exact template — it asserts no `scope_violation` emit when the new ctx field is absent).
2. **Live (UAT, manual):** run a Deep-mode chat that calls `load_skill` + `read_skill_file` on a real skill across the representative-4 providers; the SSE stream + the returned file bytes must be identical to a pre-099 baseline capture. `skill_ref` is absent outside workflows → every touched path is a literal no-op.

### Sampling Rate
- **Per task commit:** `pytest tests/test_099_skill_composition.py -x` (quick, offline).
- **Per wave merge:** `pytest tests/ -q` (full backend suite — must stay green; baseline 81/81 + the new 099 file).
- **Phase gate:** full suite green + the representative-4 cross-provider UAT (VALIDATION.md) all PASS before `/gsd:verify-work`.

### Cross-provider UAT (D-12 — representative-4, SC#10 4-axis bandwidth)
Authored in VALIDATION.md, NOT PLAN.md. Per D-12: OpenAI, Anthropic, Google, OpenRouter (one model per axis). The 4-axis SC#10 bandwidth (CLAUDE.md UAT scoreboard recipe) maps as:

| Axis | 099 coverage |
|------|--------------|
| Cross-provider | A skill-bearing `llm_agent` phase runs per provider (OpenAI / Anthropic / Google / OpenRouter): the skill instructions compose into the framing AND `read_skill_file` round-trips from the snapshot. Skill composition is a provider-agnostic single-string append (D-12 reasoning mirrors 098 D-09). |
| Multi-tool | One row: a skill-bearing phase that uses `read_skill_file` (auto-whitelisted) + `search_documents` in one phase (2+ tools). |
| Parallel-thread | One row: Thread A running a skill-bearing workflow phase while Thread B accepts a new Deep prompt — asserts no cross-thread snapshot/whitelist bleed. |
| Long-message | One row: a skill with long instructions (≥ 5 KB) composes into the framing without truncation; the phase still completes. |

### Wave 0 Gaps
- [ ] `backend/tests/test_099_skill_composition.py` — covers SC#1/SC#2/SC#3 (all 8 unit tests above)
- [ ] Conftest fixtures: reuse existing `_FakeRedis` / `make_tool_context` / `mock_asyncpg_pool` (no new fixtures needed — verified they exist in `conftest.py`); add a faked Storage download/upload recorder for `test_snapshot_materialize` (analog: the conftest XADD recorder pattern)
- [ ] Framework install: none — pytest + venv already in place

## Security Domain

> `security_enforcement` is not explicitly disabled in config — treat as enabled. This phase touches input validation (a new schema field), access control (skill visibility + storage RLS), and data exposure (snapshot of private content).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change; reuses request `current_user` / service-role engine. |
| V3 Session Management | no | No session surface. |
| V4 Access Control | **yes** | Publish gate uses the owned-or-global visibility predicate (`.or_(user_id.eq…,is_global.eq.true)`) — the SAME predicate workflow kickoff uses (`threads.py:845`). Storage RLS for snapshot copies (Pitfall 7). Snapshot of a PRIVATE skill into a GLOBAL workflow is the documented cross-user-exposure case → deferred to Phase 109 (no self-serve global publish today). |
| V5 Input Validation | **yes** | `skill_ref: UUID \| None` typed on `_StrictBase` (`extra="forbid"`) — a typo'd/injected key raises `ValidationError` before the engine consumes it (the existing T-090-01 mitigation). Publish gate validates the referenced skill resolves. |
| V6 Cryptography | no | No crypto. |

### Known Threat Patterns for {harness skill composition}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Snapshot a private skill into a globally-shared workflow → other users read private content | Information Disclosure | No self-serve global publish today (Phase 109 / `is_global=false` INSERT check). Document for Phase 109 inheritance (CONTEXT security note). |
| `skill_ref` pointing at another user's private skill | Elevation / IDOR | Publish gate resolves under owned-or-global predicate (mirrors kickoff T-092-05 IDOR mitigation) → a non-visible id raises `ValueError` → 400, never leaks existence. |
| Disabled skill silently resurrected by a snapshot | Tampering / intent violation | D-10: `is_enabled` gate at publish; a disabled skill = a validation error, never silently snapshotted. |
| Injected key in the snapshot JSONB | Tampering | `_StrictBase` `extra="forbid"` rejects unknown keys at `model_validate()` (T-090-01). |
| Deep-path behavior change via the shared `_handle_read_skill_file` | Tampering (red-line breach) | D-04 gated branch; `ctx.skill_snapshot is None` ⇒ byte-identical (098 D-05a). Proven by `test_deep_noop` + live SSE diff. |
| Storage-RLS misconfiguration exposing snapshot files cross-user | Information Disclosure | Pitfall 7 — author-scoped `{user_id}/_snapshots/...` prefix OR service-role-only access; no global-readable prefix until Phase 109. |

## Sources

### Primary (HIGH confidence — verified against live code this session)
- `backend/app/models/harness.py` — phase configs, `_StrictBase`, `WorkflowDefinition`, `folder_scope` template, `_folder_scope_requires_project` validator (lines 27–176)
- `backend/app/services/harness/phase_types.py` — the `system_prompt =` framing seam (258/302/364), `_build_phase_tool_context` (151), whitelist wiring (208–210, 283–293), `_retry_suffix` (135)
- `backend/app/services/tool_dispatcher.py` — `_handle_read_skill_file` (420), `_handle_load_skill` (333), `ToolContext` (59), `dispatch_tool` whitelist backstop (1629), the 098 gated-no-op (179), `_TOOL_REGISTRY` (1567)
- `backend/app/services/harness/scope.py` — `assert_folder_scopes_subset` (92) + the validator-vs-service anti-pattern note (32–35) — the D-10 precedent
- `backend/app/services/harness/reachability.py` — `lint_workflow` (83) + "publish endpoint deferred" docstring (3–6) — proves no live publish gate
- `backend/app/api/threads.py` — kickoff: published-resolution (841–863), `assert_folder_scopes_subset` call + 400 mapping (870–878)
- `backend/app/api/workflows.py` — the ONLY workflows route is `GET /published` (proves no save/publish API)
- `backend/app/api/skills.py` — skills CRUD + Storage upload/download/remove patterns + `{user_id}/{skill_id}/{filename}` path scheme
- `backend/app/services/openai_service.py` — `apply_tool_budget` (787), `get_tools` (768), `READ_SKILL_FILE_TOOL` schema (329)
- `backend/app/db/workflows.py` — `list_published_workflows` JSONB-path project filter (130), `create_workflow_run` (58)
- `supabase/full-schema.sql` — `skills` (618, no version column), `workflow_definitions` (694, JSONB `definition`), `skill_files` (599)
- `supabase/migrations/017_skills.sql` — `skill-files` bucket + storage RLS (first-segment = auth.uid predicate, 95–132)
- `scripts/spike-097/CONCLUSION.md` — §3 additive-optional schema philosophy + resolved-ids rule; §2 Condition 7 (full-roster cross-provider → Phase 101); unknown (c) skill registry as authoring grounding (Phase 103)
- `.planning/phases/098-...-098-CONTEXT.md` — D-05a (gated no-op), D-07 (validate path), D-09 (representative-4), D-10 (additive-optional)
- `backend/tests/test_098_scope_governance.py` — the `test_deep_noop` template + offline-fixture conventions

### Secondary (MEDIUM confidence)
- `.planning/config.json` — `nyquist_validation: true` (confirms Validation Architecture is mandatory)
- `CLAUDE.md` — D-v2.5-01 (no blocking I/O in async), D-PRD-12 (multi-worker), migration rules, G-5 hot-file ledger (`threads.py`), SC#10 UAT scoreboard recipe

### Tertiary (LOW confidence — flagged for validation)
- None. This phase's research is codebase-verified; no WebSearch / external claims were needed.

## Metadata

**Confidence breakdown:**
- Standard stack (the seams): HIGH — every module/symbol/line verified against live code.
- Architecture patterns: HIGH — all five patterns trace to a verified existing precedent (098 folder_scope / D-05a gate / scope.py service / apply_tool_budget / load_skill vocabulary).
- The snapshot-host gap (Pitfall 6): HIGH — verified that no publish/save API exists and `lint_workflow` has no caller; this is the one finding that reshapes the plan.
- Pitfalls: HIGH — each pitfall cites a verified code location; the storage-RLS one (Pitfall 7) carries one flagged assumption (A1, the run-time read client).

**Research date:** 2026-06-10
**Valid until:** ~30 days for the internal seams (stable backend; only changes if Phase 100+ touches `phase_types.py`/`tool_dispatcher.py`/`harness.py` first — check the hot-file ledger before planning).
