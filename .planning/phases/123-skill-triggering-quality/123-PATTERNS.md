# Phase 123: Skill Triggering Quality - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 17 (8 net-new, 9 modified)
**Analogs found:** 17 / 17 (every file has a strong in-repo analog — this phase is orchestration over proven primitives, zero new packages)

## File Classification

### Net-new files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `backend/app/services/skill_lint.py` | utility (pure heuristic) | transform | `backend/app/services/workflow_authoring.py` (`_strip_discriminator` pure-fn idioms) + `backend/app/services/context_window.py` (`_parse_model_limits` pure parse) | role-match (pure no-I/O module) |
| `backend/app/services/skill_tuner_service.py` | service (benchmark orchestrator) | batch / event-driven | `scripts/eval_cross_provider.py` (`score_forced_emit_axes` + `_build_forced_emit_cell` scoring shape) + `backend/app/services/workflow_authoring.py` (`forced_emit` orchestration) | role+flow match |
| `backend/app/api/skill_tuner.py` (or fold into `skills.py`) | route (start/status/results + SSE) | request-response + streaming | `backend/app/api/runs.py` (SSE replay-tail consumer) + `backend/app/api/document_governance.py` (owner-scoped read-only router) + `backend/app/api/threads.py:1100` (run-buffer ZADD start) | role+flow match |
| `backend/app/services/skill_builder_model` resolver (lives in a service or `config.py`) | config resolver | request-response | `backend/app/services/workflow_authoring.py:83` `resolve_authoring_model()` | exact |
| `frontend/src/pages/SkillTunerPage.tsx` | page (focused full-surface) | request-response | `frontend/src/pages/GovernancePage.tsx` (self-fetch focused home) + the `ActiveView` mount in `ChatLayout.tsx:295` | role-match (focused surface; differs — entered WITH a `skillId`, not a cold nav) |
| `frontend/src/components/skills/tuner/ProviderScoreboard.tsx` | component (N-col grid) | transform (render server scores) | `frontend/src/pages/GovernancePage.tsx` stacked-card render; no existing per-provider grid component (RESEARCH: cell shape mirrors `score_forced_emit_axes`) | partial (render-only analog) |
| `frontend/src/components/skills/tuner/CaseEditor.tsx` + `CandidateCard.tsx` + `LiveRunCard.tsx` | components | request-response + streaming | `LiveRunCard` → the Phase 095 run-status strip / live tool-card (sketch 043-A cites the never-vanishes elapsed-timer lesson) | role-match |
| `backend/tests/unit/test_skill_lint.py` (+ tuner/scoring/builder/catalog-note + integration) | test | — | existing `backend/tests/unit/test_context_window.py` (extend) + `scripts/eval_cross_provider.py` structure-only test pattern | exact (extend existing) |

### Modified files

| Modified File | Role | Data Flow | Current Shape (what to preserve) |
|---------------|------|-----------|----------------------------------|
| `backend/app/services/agent_loop.py:1099-1108` | service (system-prompt assembly) | transform | The `## Available Skills` `catalog_note` string + the owner-scoped query at `:1090-1094` |
| `backend/app/services/context_window.py:151` `trim_messages_to_fit()` | service (G-5 hot) | transform | The system/rest/protected-tail partition + `_remove_oldest_atomic` atomic groups + `_TRIM_MARKER` |
| `backend/app/services/tool_dispatcher.py:655` `_handle_load_skill` + `:705` `_handle_save_skill` | service (tool handler) | event-driven | The owner-scoped `.or_(...)` skill read + the `ToolResult(result=json.dumps(...))` shape |
| `backend/app/api/skills.py:127` create + `:260` update/PATCH | route | CRUD | The owner-scoped insert/update + `SkillCreate`/`SkillUpdate` Pydantic bodies |
| `backend/app/services/openai_service.py:430` `LOAD_SKILL_TOOL` / `:452` `SAVE_SKILL_TOOL` | config (tool defs) | — | The `LOAD_SKILL_TOOL.description` (already D-01-aligned — confirm one story) |
| `backend/app/config.py:1004` | config | — | The `harness_authoring_model` / `harness_judge_model` knob block (add `skill_builder_model` beside it) |
| `frontend/src/App.tsx:9` | config (nav union) | — | The `ActiveView` union (add `"skill-tuner"`) |
| `frontend/src/components/layout/ChatLayout.tsx:295` | layout (mount switch) | — | The `activeView === "..."` conditional render chain |
| `frontend/src/components/skills/SkillFormDialog.tsx` | component (Skills form) | request-response | The `SkillForm` Description `<Textarea>` block (`:69-78`) — lint warning mounts under it |

---

## Pattern Assignments

### `backend/app/services/skill_lint.py` (utility, pure transform — TRIG-03 / D-11)

**Analog:** `backend/app/services/workflow_authoring.py` (pure-fn module idioms) + `backend/app/services/context_window.py:45` (`_parse_model_limits` pure parse with module-level constants).

**Module-constants + pure-fn pattern** (mirror `context_window.py:64-68` `_TRIM_MARKER` + RESEARCH §Code Examples thresholds):
```python
# Module-level tunables (Claude's-discretion defaults from RESEARCH §Code Examples):
MIN_DESCRIPTION_CHARS = 25
MAX_DESCRIPTION_CHARS = 1024        # STD-01 ≤1024 hint, free length-bound
NAME_ECHO_RATIO = 0.6
TRIGGER_VERBS = {"use", "when", "for", "to", "generate", "create", "analyze", ...}
GENERIC_PHRASES = {"a skill", "this skill", "helps with", "various tasks", ...}

def lint_description(name: str, description: str, sibling_descriptions: list[str]) -> list[dict]:
    """Returns a list of {code, message} warnings; EMPTY list = healthy. NEVER raises (D-09)."""
    warnings = []
    d = (description or "").strip()
    if not d: warnings.append({"code": "empty", "message": "..."})
    # ... (full body in RESEARCH §Code Examples lines 399-422)
    return warnings   # caller NEVER blocks on this (D-09)
```
**Hard rule (D-09/D-11):** pure, no I/O, no LLM call, NEVER raises. The function returns warnings; every caller decides what to do (none blocks). This mirrors how `context_window._parse_model_limits` swallows bad input and returns a partial dict rather than raising.

---

### `backend/app/services/skill_tuner_service.py` (service, batch/event-driven — TRIG-01)

**Analog (orchestration):** `backend/app/services/workflow_authoring.py` — a thin orchestration over `forced_emit` that NEVER opens the agent loop or a new SDK path (the RED LINE banner at `workflow_authoring.py:20-24`).
**Analog (scoring shape):** `scripts/eval_cross_provider.py:1412` `score_forced_emit_axes` + `:1484` `_build_forced_emit_cell` (the per-provider PASS/FAIL cell shape — Tuner's cells are `fires`-recall + `no-false`-precision instead of trigger/force/recovery/honest_fail).

**`forced_emit` call pattern** (used for BOTH candidate generation AND per-case classification — RESEARCH Pattern 2; signature verified at `forced_emit.py:318`):
```python
from pydantic import BaseModel
from app.services.forced_emit import forced_emit

class CandidateDescriptions(BaseModel):   # FLAT, single-typed (Gemini trap — Pitfall 4)
    candidates: list[str]

class TriggerDecision(BaseModel):
    would_load: bool
    skill_name: str | None   # str | None -> nullable (OK); NEVER Union[A,B] discriminated

result = await forced_emit(
    messages=[{"role": "user", "content": prompt}],
    model=skill_builder_model,                                  # D-08 knob (builder) OR target model (classifier)
    provider=get_model_capability(model)["provider"],
    emitter="emit_candidates",
    tools=[...],
    user_settings=user_settings,
    system_prompt=...,            # NON-EMPTY required (anthropic cache_control 400 — eval rig :1400-1409)
    schema_model=CandidateDescriptions,
)
# result["emitted"] is CandidateDescriptions | None — honest-fail floor, NEVER silent.
```

**Per-provider scoring cell** (mirror `eval_cross_provider.py:1499-1514` `_build_forced_emit_cell` — pure, no I/O):
```python
# Tuner analog: each cell is {provider, model_effective, axes: {fires: PASS/FAIL, no_false: PASS/FAIL}}.
# The 60/40 train/held-out split + 3-repeat aggregation is NET-NEW pure scoring math
# (test target: test_skill_tuner_scoring.py — winner picked by HELD-OUT score, never train).
```

**Owner-scoped sibling auto-seed (D-04, leak-safe)** — reuse the EXACT query from `agent_loop.py:1090-1094` / `_handle_load_skill:663`:
```python
supabase.table("skills").select("name, description")
    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
    .eq("is_enabled", True)
```
**Anti-patterns (RESEARCH):** never drive the full agent loop per case (use scoped `forced_emit` classification); never pick the winner by train score; the classifier prompt MUST mirror the post-D-01 catalog-note wording (Pitfall 1 — consider a shared constant with `agent_loop.py`).

---

### `backend/app/api/skill_tuner.py` (route — start/status/results + SSE — TRIG-01 / D-06)

**Analog (router + owner-scoping):** `backend/app/api/document_governance.py` — a thin, net-new, READ-ONLY, owner-scoped router with `APIRouter(prefix=...)`, `get_current_user`/`get_supabase` deps, and `run_in_threadpool` wrapping blocking supabase calls.

**Router skeleton** (`document_governance.py:45-55`):
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from supabase import Client
from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/skills", tags=["skill-tuner"])  # mount under /skills/{id}/tuner/...
```

**Background-run start (run-buffer ZADD)** — mirror `threads.py:1116-1121`:
```python
_started_score = time_mod.time()
await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _started_score})
await redis.zadd("runs:active", {str(run_id): _started_score})
```
RESEARCH Open-Q4 recommends a tuner-specific event set (`tuner_progress`, `tuner_provider_done`, `tuner_complete`) on the same `run:{tuner_run_id}` stream transport — do NOT overload chat event types.

**SSE status/progress stream** — reuse the `run:{run_id}` XREAD consumer pattern from `runs.py:90-164` (`replay_tail_consumer`): `stream_key = f"run:{run_id}"`, two-phase replay-then-tail with a `since` cursor, RedisError/CancelledError/timeout guards yielding clean SSE error events.

**Owner-scoping gate (V4 / RLS — load-bearing):** every tuner read AND the eventual PATCH write MUST carry `.eq("user_id", current_user["id"])` (mirror `skills.py:278`'s `update_skill`). `get_supabase()` is the SERVICE-ROLE client — app-code owner-scoping is the SOLE leak gate (the `document_governance.py:25-31` discipline).

---

### `resolve_skill_builder_model()` + the `skill_builder_model` setting (D-08)

**Analog:** `backend/app/services/workflow_authoring.py:83` `resolve_authoring_model()` (EXACT pattern) + `backend/app/config.py:1000-1004` knob block.

**Resolver** (mirror `resolve_authoring_model` verbatim, swap the setting name + default candidates):
```python
def resolve_skill_builder_model(settings) -> str | None:
    model = getattr(settings, "skill_builder_model", None)
    if model:
        return model
    from app.config import get_model_capability   # function-local (Pitfall-4 discipline)
    for candidate in ("claude-haiku-4-5-20251001", "gpt-5.4-mini"):  # strong forced_emission default (A7)
        if (get_model_capability(candidate) or {}).get("forced_emission"):
            return candidate
    return None
```

**Config knob** (add beside `config.py:1004`, mirror the `harness_authoring_model` comment style):
```python
# Phase 123 (D-08 / TRIG-01) — the skill-builder model (candidate descriptions + case auto-seed).
# Settings-not-env (a model id is a VALUE, not a secret). None = a registry default resolved by
# resolve_skill_builder_model(). Selectable across the FULL provider list incl. local; decoupled
# from the benchmark targets (the builder WRITES, the targets MEASURE). No paid-provider SPOF (111.1).
skill_builder_model: str | None = None
```
**Anti-pattern (D-08 / 111.1):** never hardcode a paid provider as the only option — selectable across the full list incl. local (Ollama / LM Studio / openai-compat / DeepSeek-on-own-infra).

---

### `backend/app/services/agent_loop.py:1099-1108` (modify — D-01 catalog note relaxation, G-5)

**Current shape (the conservative note to RELAX):**
```python
catalog_note = (
    f"\n\n## Available Skills\n"
    f"The following skills are available. ONLY call `load_skill(skill_name)` when the user "
    f"explicitly names a skill or says 'use [skill name]'. Never auto-load based on "
    f"description similarity — wait for an explicit request:\n{catalog_lines}"
)
```
**Reconcile with** `openai_service.py:434-437` `LOAD_SKILL_TOOL.description` (already says "Use when the user's request matches a skill in the catalog"). D-01 rewrites the note to match — e.g. "Call `load_skill(skill_name)` when the user's request clearly matches one of these skill descriptions. Match on intent, not just exact names. Do not load a skill for an unrelated request." (exact wording = planner's; should-NOT benchmark is the safety rail).
**PRESERVE:** the owner-scoped query at `:1090-1094` untouched. **G-5:** re-run `test_context_window.py` + `test_075_4_subagent_truncation.py` after touching this file (it also hosts the two `trim_messages_to_fit` call sites at `:1164`).

---

### `backend/app/services/context_window.py:151` (modify — CTX-03 trim-pin, G-5 RED LINE)

**Analog = the function itself.** CTX-03 adds a THIRD protected class inside `trim_messages_to_fit` — NEVER a parallel trim function (D-14 RED LINE).

**Current partition (the seam — `:184-198`):**
```python
if messages[0].get("role") == "system":
    system_msg = messages[0]; rest = messages[1:]
# Protected tail:
if reserve_recent > 0 and len(rest) > reserve_recent:
    protected = rest[-reserve_recent:]; trimmable = list(rest[:-reserve_recent])
```
**Add (RESEARCH Pattern 3 + §Code Examples lines 424-436):** after the system/rest split and BEFORE the protected-tail split, partition `rest` into atomic groups (mirror `_remove_oldest_atomic`'s grouping at `:251`), mark a group "pinned" if it contains a tool-result flagged `_pinned_skill`, de-dupe to the LATEST group per skill name, cap at `PIN_BUDGET_FRACTION * max_tokens` (recommend 1/3 — A3), evict least-recently-loaded over budget + insert `_TRIM_MARKER` (`:65`).
**CRITICAL (Pitfall 2):** pin the WHOLE atomic group (assistant+tool_calls parent AND its tool-result) — never just the tool-role message, or providers 400 on an orphaned tool result. Reuse `estimate_messages_tokens` (`:120`) for the budget math.
**Token honesty:** the `_TRIM_MARKER` reuse (D-14) is the never-silent contract — `_build_candidate` (`:232`) already inserts it when `add_marker=True`.

---

### `backend/app/services/tool_dispatcher.py:655` `_handle_load_skill` + `:705` `_handle_save_skill` (modify — D-13 tag + D-10 lint)

**Current `_handle_load_skill` ToolResult shape (`:698-702`):**
```python
return ToolResult(result=json.dumps({
    "name": row["name"], "instructions": row["instructions"], "files": file_names,
}))
```
**D-13:** tag the persisted tool-result message as protected (the pin flag travels in code at load-skill time — identifiable later via `tc["name"] == "load_skill"` in `_reconstruct_history`; NEVER pattern-match the JSON). The owner-scoped read at `:663` (`.or_(user_id.eq.{id}, is_global.eq.true).eq(is_enabled, True)`) is the leak gate — preserve it.

**`_handle_save_skill` (`:705-739`)** is one of the THREE D-10 lint hook points. After resolving name/description/instructions, call `lint_description(...)` and append the warnings to the `ToolResult(result=json.dumps(...))` as a non-fatal note — NEVER raise (Pitfall 6: the lint must not abort the agent's task). The save (insert/update) ALWAYS proceeds.

---

### `backend/app/api/skills.py:127` create + `:260` PATCH (modify — D-09/D-10 lint hooks)

**Current `create_skill` (`:127-145`)** and **`update_skill` (`:260-283`)** — owner-scoped insert/update with `SkillCreate`/`SkillUpdate` Pydantic bodies.
**D-10 hook:** call `skill_lint.lint_description(name, description, sibling_descriptions)` PRE-persist (fetch siblings via the existing owner-scoped `.or_(...)` query at `:114`). Attach warnings to the response (e.g. a `lint_warnings` field) but ALWAYS proceed with the insert/update (D-09). PATCH is also the D-03 author-confirm winner write — it re-lints by virtue of this same hook.
**PRESERVE:** `update_skill`'s `.eq("id", skill_id).eq("user_id", current_user["id"])` owner-scoping (`:277-278`) and the `model_dump(exclude_none=True)` partial-update.

---

### `frontend/src/pages/SkillTunerPage.tsx` + `App.tsx` + `ChatLayout.tsx` (focused full-surface — D-07 / sketch 041-A)

**Analog:** `frontend/src/pages/GovernancePage.tsx` (self-fetch focused home) + the mount switch in `ChatLayout.tsx:295-307`.

**`App.tsx:9` union extension** (RESEARCH Pattern 1):
```typescript
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health"
  | "workflows" | "classification-rules" | "governance" | "skill-tuner"   // <- NET-NEW
```

**`ChatLayout.tsx` mount** (mirror the `governance` branch `:301-307`):
```tsx
) : activeView === "skill-tuner" ? (
  <SkillTunerPage skillId={tunerSkillId} onBack={() => onNavigate("skills")} />
) : (
  <KnowledgeHealthPage />
)}
```
**DIFFERS from Governance/Classification (RESEARCH Pattern 1 note):** the Tuner is NOT a top-level `NAV_ITEMS` entry — it's a sub-surface entered WITH a `skillId`. Carry a sibling `tunerSkillId` `useState` in `App.tsx` (like the existing per-view selection state) and thread it through `ChatLayout` props. **Reachability lesson (Phase 118):** the phase that adds the `ActiveView` member MUST also own the mount branch + the entry action in-phase, or the surface ships built-but-unreachable.

---

### `frontend/src/components/skills/SkillFormDialog.tsx` (modify — inline lint warning + "Tune this" — D-12 / sketch 044-A)

**Current Description field (`:69-78`, in the shared `SkillForm`):**
```tsx
{/* Description */}
<div className="flex flex-col gap-1.5">
  <label className="text-sm font-medium text-foreground">Description</label>
  <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
    placeholder="One sentence describing what this skill does" rows={2} />
</div>
```
**044-A:** mount the never-block lint warning DIRECTLY under this `<Textarea>` (variant A — closest to the field, hardest to miss). Render the specific reason codes + a "Tune this →" button that navigates to the `skill-tuner` `ActiveView` for this skill (D-12 handoff). The warning is advisory — the existing `handleSave` (`:220` / `:347`) always proceeds. Both `SkillFormDialog` (modal) and `SkillDetailPanel` (3-pane, `:291`) share the `SkillForm` inner component, so the warning render lands in one place.

---

## Shared Patterns

### Owner-scoped skill read (RLS leak gate)
**Source:** `backend/app/services/agent_loop.py:1090-1094` (also `_handle_load_skill` `tool_dispatcher.py:663`, `skills.py:114`)
**Apply to:** the Tuner's sibling auto-seed (D-04), every tuner-run read, the PATCH winner write.
```python
supabase.table("skills").select("name, description")
    .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
    .eq("is_enabled", True)
```
`get_supabase()` is SERVICE-ROLE (RLS bypassed) — this app-code scoping is the SOLE gate (the `document_governance.py:25-31` discipline). A user must NEVER tune or read another user's non-global skill.

### `forced_emit` for structured generation + classification
**Source:** `backend/app/services/forced_emit.py:318` (signature) + `backend/app/services/workflow_authoring.py` (orchestration)
**Apply to:** `skill_tuner_service.py` (candidate gen via builder model; per-case classification via target model)
- Pydantic schemas FLAT + single-typed — NO `anyOf`/`oneOf`, NO multi-type `type: [...]` arrays (Gemini trap, Pitfall 4 / `reference_gemini_schema_type_array_trap`). `str | None` -> nullable is fine.
- ALWAYS pass a NON-EMPTY `system_prompt` (anthropic `cache_control` 400s on empty text blocks — eval rig `:1400-1409`, a 122 live-UAT fix).
- `result["emitted"]` is `BaseModel | None` — honest-fail floor, never silent.
- NEVER fork the gateway / open a new SDK path (the `workflow_authoring.py:20-24` RED LINE).

### Settings-not-env model-id knob
**Source:** `backend/app/config.py:1000-1004` (`harness_judge_model` / `harness_authoring_model`) + `backend/app/services/workflow_authoring.py:83` `resolve_authoring_model()`
**Apply to:** the D-08 `skill_builder_model` setting + `resolve_skill_builder_model()`.
A model id is a VALUE not a secret -> `app_settings` / Settings UI, never env. Resolution order: explicit setting -> first registry default with `forced_emission:True` -> honest `None`.

### Background run + SSE over the Redis run-buffer
**Source:** `backend/app/api/threads.py:1116-1121` (ZADD start) + `backend/app/api/runs.py:90-164` (SSE replay-tail consumer) + CLAUDE.md run-buffer key conventions
**Apply to:** the D-06 background tuner job + its live-progress card.
Keys: `run:{tuner_run_id}` (stream), `runs_by_thread:{thread_id}`, `runs:active` (cleanup). Tuner-specific event vocab on the same transport (Open-Q4). Frontend `LiveRunCard` derives the elapsed timer from a stable start-ts (the 095 never-vanishes lesson, sketch 043-A).

### Never-block / never-silent honesty
**Source:** `backend/app/services/context_window.py:65` `_TRIM_MARKER` (eviction honesty) + the lint warn-never-block contract (D-09)
**Apply to:** `skill_lint` (returns warnings, never raises, save always proceeds — all 3 hook points incl. the agent path) AND the D-14 pin-eviction (`_TRIM_MARKER` on every evict).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/skills/tuner/ProviderScoreboard.tsx` | component | transform | No existing per-provider scoreboard COMPONENT in the React tree (the scoreboard rig `eval_cross_provider.py` is a Python operator script, not a UI). The N-column cell render is genuinely net-new; the closest render idiom is `GovernancePage.tsx` stacked cards, and the cell SHAPE mirrors `score_forced_emit_axes`. Planner should use sketch 042-A + RESEARCH Pattern 4 directly. |

(All other files have strong in-repo analogs above.)

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/api/`, `backend/app/config.py`, `scripts/`, `frontend/src/pages/`, `frontend/src/components/skills/`, `frontend/src/components/layout/`, `frontend/src/App.tsx`
**Files scanned (read at source):** `workflow_authoring.py`, `context_window.py`, `skills.py`, `tool_dispatcher.py`, `agent_loop.py`, `openai_service.py`, `config.py`, `forced_emit.py`, `eval_cross_provider.py`, `runs.py`, `threads.py`, `document_governance.py`, `SkillsPage.tsx`, `SkillFormDialog.tsx`, `App.tsx`, `ChatLayout.tsx`, `GovernancePage.tsx`
**Pattern extraction date:** 2026-06-23
