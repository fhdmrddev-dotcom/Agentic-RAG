# Phase 123: Skill Triggering Quality - Research

**Researched:** 2026-06-23
**Domain:** Cross-provider tool-firing behavior (LLM function-calling), held-out benchmark/eval orchestration, context-window trim-pinning, deterministic text heuristics, settings-driven model routing
**Confidence:** HIGH (every code seam read at source; cross-provider firing behavior cross-checked against official OpenAI + Anthropic docs; all production model-ids confirmed in the live registry)

## Summary

Phase 123 is three loosely-coupled deliverables sharing one runtime change. The runtime change (D-01) is small and load-bearing: replace one over-conservative system-prompt instruction in `agent_loop.py:1099-1108` so a skill's `description` actually drives `load_skill` firing. That instruction today literally says *"ONLY call `load_skill` when the user explicitly names a skill … Never auto-load based on description similarity"* — which directly contradicts the already-shipped `LOAD_SKILL_TOOL` description (`openai_service.py:434-437`: *"Use when the user's request matches a skill in the catalog"*). The two surfaces tell opposite stories; D-01 reconciles them to one. Because this changes cross-provider runtime behavior, **SC#10 UAT is mandatory** — the false-fire safety rail is the Tuner's should-NOT benchmark axis, not a per-skill kill-switch (the kill-switch is a documented contingency only).

The **Trigger Tuner (TRIG-01)** is a net-new focused full-surface UI (sketch 041-A) that orchestrates a held-out benchmark: `(should-fire + should-NOT cases) × N configured provider-targets × 3 repeats`, 60/40 train/held-out split, ≤5 iterations, winner picked by held-out score. It is built almost entirely from existing substrate: `forced_emit` (candidate-description generation + per-case trigger classification), the `eval_cross_provider.py` provider-axis scoreboard rig (extended in Phase 122 with `--forced-emit`), the Phase-061+ Redis run-buffer + SSE (background job), `PATCH /skills/{id}` (author-confirm write), and the `resolve_authoring_model()` knob pattern (D-08 builder model). The genuinely net-new code is the held-out split/repeat orchestration, the per-case "did this fire?" measurement, the N-column provider-set adaptivity, and the React surface.

The **save-time lint (TRIG-03)** is a deterministic, no-LLM, warn-never-block heuristic living in a shared service layer so it covers `POST /skills` + `PATCH /skills` + the agent `save_skill` handler from one place. The **skill pinning (CTX-03)** is a minimal, surgical change to the G-5-hot `trim_messages_to_fit()` path: tag the `load_skill` tool-result as protected (identifiable by `tc["name"] == "load_skill"` in the reconstructed history), de-dupe on reload, pin-all-with-a-safety-valve, evict least-recently-loaded with the existing honest `_TRIM_MARKER`.

**Primary recommendation:** Sequence as four work-streams — (W1) D-01 runtime relaxation + the deterministic `skill_lint` shared utility + the three lint hooks; (W2) CTX-03 trim-pin on `context_window.py` (G-5, gated by re-running the full `test_context_window.py` suite); (W3) the `skill_tuner_service` benchmark runner + tuner-run routes on top of `forced_emit` + run-buffer; (W4) the Tuner React surface (041–044). W1/W2 are backend-only and independently shippable; W3 depends on W1's lint; W4 depends on W3's routes. SC#10 cross-provider UAT gates the whole phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| D-01 description-driven firing (relax catalog note) | API/Backend (`agent_loop.py` system-prompt assembly) | — | The firing decision is the model's, driven by the catalog (system prompt) + `load_skill` tool description; this is a backend prompt edit on the shared path. NO client involvement. |
| Trigger Tuner benchmark orchestration | API/Backend (`skill_tuner_service` + tuner routes) | Redis (run-buffer) | Multi-minute live LLM calls × N providers × 3 repeats — pure server work; Redis carries progress. |
| Candidate-description generation + per-case classification | API/Backend (`forced_emit` + builder model) | — | Reuses the sealed structured-emission service; the builder model is a server-side configurable routing decision. |
| Per-provider scoreboard render + candidate cards + N-column adaptivity | Frontend (focused full-surface via `ActiveView`) | API (target-set + scores) | UI reads server-computed scores; the N-column adaptivity is a render of the org's configured targets. |
| Save-time lint (deterministic heuristic) | API/Backend (shared `skill_lint` utility) | Frontend (render the warning + "Tune this") | The heuristic MUST be authoritative server-side (covers the agent `save_skill` path that never touches the form); the form renders the same result. |
| Skill pinning (CTX-03 trim-pin) | API/Backend (`context_window.py` trim path) | — | Pure context-assembly concern; G-5 hot file; no UI surface, not sketched. |
| Builder-model knob (D-08) | API/Backend (`config.py` setting + `resolve_*_model` pattern) | Frontend (Settings picker, 111.1 footer) | A model-id is a value, not a secret → settings, mirrors `harness_authoring_model`. |
| Author-confirm winner write | API/Backend (`PATCH /skills/{id}`, re-lints) | Frontend (diff-confirm strip) | The existing owner-scoped PATCH path is the write; the confirm is a UI gate. |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TRIG-01** | A skill author can tune a skill's description against a held-out should-trigger / should-not-trigger benchmark (Skill Trigger Tuner), pick the winning description by held-out score, measured cross-provider on production model-ids. | `forced_emit` (candidate gen + per-case classification) + `eval_cross_provider.py` provider-axis rig + Redis run-buffer/SSE (background job) + `PATCH /skills` (author-confirm write) + `resolve_authoring_model()` knob (builder model). Net-new: held-out 60/40 split, 3-repeat orchestration, per-case "did it fire?" measurement, N-column provider-set adaptivity, the React surface (041–044). |
| **TRIG-03** | At `save_skill` (and the skill-creator loop) a description-quality lint flags weak/ambiguous trigger descriptions before save. | Deterministic shared `skill_lint` utility (no LLM) hooked at `skills.py:127` (POST), `skills.py:260` (PATCH), and `tool_dispatcher.py:_handle_save_skill` (the agent path). Warn-never-block (D-09). Concrete thresholds in §Common Pitfalls + §Code Examples. |
| **CTX-03** | A loaded skill's instructions stay available for the rest of the session — pinned out of the rolling trim window. | Surgical change to `trim_messages_to_fit()` (`context_window.py:151`): tag the `load_skill` tool-result protected (identifiable via `tc["name"]=="load_skill"` in `_reconstruct_history`), de-dupe on reload, pin-all + safety-valve evicting least-recently-loaded with the existing `_TRIM_MARKER`. G-5 — re-run `test_context_window.py`. |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Triggering semantics:**
- **D-01 — Descriptions drive firing.** Replace the conservative catalog instruction in `agent_loop.py:1099-1108` with an instruction that the model should `load_skill` **when the request clearly matches a catalog description**. The Tuner's should-NOT cases are the false-fire safety rail. Reconciles the contradiction with `LOAD_SKILL_TOOL`. **SC#10 UAT is MANDATORY** — prove no false-firing regression across all 4 axes.
- **D-02 — Tuner output = SCORE + SUGGEST.** Scores the current/typed description per-provider on held-out cases AND can generate **≤N candidate rewrites** (LLM rewrite via `forced_emit`), each auto-scored; the author picks the winner by held-out score. A human drives every iteration. NOT the autonomous proposer (that is Phase 125 SI-02).
- **D-03 — Winner is author-confirmed, then saved.** Shows winning description + scores; the author explicitly confirms before it is written via `PATCH /skills/{id}` (`skills.py:260`), which also runs the D-09 lint. No silent/auto-apply.

**Benchmark + Tuner UX (TRIG-01):**
- **D-04 — Benchmark cases = hybrid auto-seed + author edits.** Tuner generates a starter set (should-trigger = paraphrases of the description; should-not = sibling catalog skills + generic off-topic prompts); author edits/approves/adds before running. **Held-out split 60/40, 3 repeats, ≤5 iterations.**
- **D-05 — Benchmark targets = the 4 SC#10 axes**, one representative production model-id each (OpenAI, Anthropic, Google, OpenRouter); **configurable**. Reuse `eval_cross_provider.py`'s provider-as-first-class-axis scoreboard. A local-only shop can narrow targets to their own model.
- **D-06 — Run mode = background job + live progress.** A run is (cases × models × 3 repeats) live LLM calls — multi-minute. Kick off async, stream/poll progress (reuse Phase-061+ run-buffer Redis keys + SSE). Not synchronous.
- **D-07 — Tuner UI = a panel hung off `SkillsPage` / `SkillDetailPanel`** (case editor + per-provider scoreboard + candidate list). G-2 fired → sketch done (041–044 all winner A).

**Skill-builder model:**
- **D-08 — The skill-builder model is a configurable setting, reusing the existing knob pattern.** Mirrors `harness_authoring_model` + `resolve_authoring_model()` (`config.py:1004`). Strong default, selectable across the **FULL provider list — paid cloud AND local/self-hosted, treated equally. No paid-provider hardcoding / no SPOF.** **Decoupled** from the benchmark target set (D-05). Lives in settings, not env.

**Save-time lint (TRIG-03):**
- **D-09 — Lint WARNS, never blocks.** Never-silent flag with the specific reason; the save always proceeds.
- **D-10 — Lint lives in the shared service/API layer** — covers the human Skills form (`POST /skills` `skills.py:127` / `PATCH /skills/{id}` `skills.py:260`) AND the agent's `SAVE_SKILL_TOOL` path (`openai_service.py:452` → the `save_skill` handler in `tool_dispatcher.py`).
- **D-11 — Lint engine = deterministic heuristic only** (no LLM call in the save path): non-empty; doesn't merely echo the name; contains a verb/trigger phrase; not too short / too generic; not duplicated across the author's catalog. (Cheap length-bound check also covers STD-01's ≤1024 hint.) Expensive cross-provider measurement stays opt-in in the Tuner.
- **D-12 — Lint → Tuner handoff.** A weak-description warning offers a one-click **"Tune this"** that opens the Trigger Tuner for that skill.

**Skill pinning (CTX-03 — G-5 hot path):**
- **D-13 — Pin mechanism = tag the `load_skill` tool-result as protected.** At load-skill time (`_handle_load_skill`, `tool_dispatcher.py:655`), mark its tool-result message with an explicit flag; teach `trim_messages_to_fit()` (`context_window.py:151`) to treat flagged messages as non-trimmable, alongside the system message + `reserve_recent` tail. **De-dupe on reload.** NOT pattern-matching the JSON; NOT a system-prompt hoist.
- **D-14 — Pin budget = pin all, with a safety valve.** Pin every loaded skill, BUT cap total pinned at a fraction of the resolved context budget (`resolve_context_budget()`); if exceeded, evict the **least-recently-loaded** pinned skill and emit an **honest trim marker** (reuse `_TRIM_MARKER`).

### Claude's Discretion
- Exact heuristic thresholds for D-11 (min length, generic-phrase list, name-echo ratio) — choose sensible defaults.
- Exact `≤N` candidate count for D-02 and the pinned-budget fraction for D-14 — pick defaults grounded in the ≤5-iter spec and the trim budget.
- Concrete service/route names (`skill_tuner_service.py`, `skill_lint.py`, the tuner-run endpoints) — planner's call.

### Deferred Ideas (OUT OF SCOPE)
- **Per-skill auto-trigger opt-in / kill-switch** — contingency the planner MAY include only if SC#10 surfaces false-fire regressions; the should-NOT benchmark rail is the first-line defense.
- **Smart-dispatch relevance pre-filter + catalog token budget** — TRIG-02 / Phase 126 (STRETCH).
- **Autonomous description proposer** — SI-02 / Phase 125 (STRETCH). D-02 stops at human-driven suggest.
- **agentskills.io frontmatter enforcement** (full name rules, description ≤1024) — STD-01 / v3.2. D-11's length check covers the ≤1024 hint cheaply now.
</user_constraints>

## Project Constraints (from CLAUDE.md)

These have the same authority as locked decisions — research must not recommend approaches that contradict them:

- **No LangChain, no LangGraph — raw SDK calls only.** The Tuner orchestration is plain Python over `forced_emit` + the gateway; no agent framework.
- **Use Pydantic for structured LLM outputs.** Candidate-description generation and per-case classification go through `forced_emit(schema_model=...)` with Pydantic models.
- **Provider-docs-first (evidence-based).** Because D-01 + the Tuner touch cross-provider tool-firing behavior, research each provider's own docs first (done below for OpenAI + Anthropic; Google/OpenRouter constraints carried from Phase 115/122), then cross-check against `MODEL_CAPABILITIES` / `emit_tier`. Conventions do NOT transfer 1:1 — keep provider-specific handling at the gateway boundary.
- **All tables need Row-Level Security; users only see their own data** (global skills are the shared scope). The Tuner's skill reads MUST preserve the owner-scoped `.or_(user_id.eq.{id}, is_global.eq.true)` query (`agent_loop.py:1090-1094`, `_handle_load_skill` `tool_dispatcher.py:663`). Tuner-run state, if persisted, must be owner-scoped.
- **Settings live in `user_settings`/`app_settings` and the Settings UI; env vars are for secrets and infra only.** The D-08 builder model is a settings value, mirroring `harness_authoring_model` / `extraction_model` (app_settings).
- **Python backend must use a `venv`.** Worktrees-off pattern (venv/node_modules) per recent phases — sequential-on-main-tree.
- **Stream chat responses via SSE; stateless chat completions.** The background tuner job reuses the SSE + Redis run-buffer the chat loop already uses.
- **G-5 hot files:** `agent_loop.py` (D-01 catalog note + the trim caller) and `context_window.py` (CTX-03 trim path). Re-run trim/replay tests after any touch — `backend/tests/unit/test_context_window.py` and `backend/tests/integration/test_075_4_subagent_truncation.py`.
- **SC#10 UAT 4-axis recipe (MANDATORY here):** cross-provider × multi-tool × parallel-thread × long-message; rows authored in VALIDATION.md, never PLAN.md tasks. The cross-provider axis for this phase IS the false-fire safety rail.

## Standard Stack

This phase reuses the existing stack — **no new external packages are required.** Every capability is built from in-repo substrate.

### Core (all in-repo — reuse, do not add)
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `forced_emit()` | `backend/app/services/forced_emit.py:318` | Single-shot forced structured emission (4-rung ladder, `schema_model=` Pydantic) | Already cross-provider via the gateway; the candidate generator + per-case classifier ride it `[VERIFIED: source read]` |
| `eval_cross_provider.py` | `scripts/eval_cross_provider.py` | Provider-as-first-class-axis scoreboard rig (`--forced-emit`, PROVIDERS roster `:82-93`, `score_forced_emit_axes` `:1412`) | Phase 088/096/120/122 proven; extend for the trigger benchmark `[VERIFIED: source read]` |
| `trim_messages_to_fit()` | `backend/app/services/context_window.py:151` | Sliding-window trim; preserves system msg + `reserve_recent` tail; atomic tool-pair removal; `_TRIM_MARKER` `:65` | The CTX-03 seam — add a third protected class `[VERIFIED: source read]` |
| Redis run-buffer + SSE | `run:{run_id}` stream, `runs_by_thread:{thread_id}`, `runs:active` (Phase 061+) | Background job + live progress | D-06 — reuse, never re-build `[CITED: CLAUDE.md run-buffer key conventions]` |
| `resolve_authoring_model(settings)` | `backend/app/services/workflow_authoring.py:83` | Resolves a configurable model id with a forced-emission strong default | The D-08 builder-model knob pattern `[VERIFIED: source read]` |
| `PATCH /skills/{id}` | `backend/app/api/skills.py:260` | Owner-scoped update (name/description/instructions) | The author-confirm winner write (D-03) `[VERIFIED: source read]` |
| `get_model_capability()` + `MODEL_CAPABILITIES` + `emit_tier` | `backend/app/config.py:495 / :207-337` | Provider routing + force tier per model | Drives which rung the classifier emission uses `[VERIFIED: source read]` |
| `ActiveView` no-router switch + `NAV_ITEMS` | `frontend/src/App.tsx:9`, `frontend/src/lib/nav-items.ts` | Focused-surface navigation (no react-router) | The 041-A focused-surface precedent (publish gauntlet / GovernancePage / ClassificationRulesPage) `[VERIFIED: source read]` |

### Supporting
| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| `pydantic` BaseModel | already a dep | Structured candidate + classification schemas | Every `forced_emit` shot |
| `tiktoken` (cl100k) | already installed | Token estimation for the pin-budget cap | `estimate_messages_tokens` / `estimate_tokens` reuse for D-14 |
| `useSkills` hook + `SkillCard` / `SkillDetailPanel` | `frontend/src/hooks/useSkills.ts`, `frontend/src/components/skills/` | Skills CRUD UI host | Lint warning render + "Tune triggers" entry action |
| shadcn/ui + Tailwind (Aether Deep Midnight) | `frontend/src` | The Tuner surface chrome | All 041–044 render |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend `eval_cross_provider.py` directly into the Tuner | A new `skill_tuner_service.py` that *imports* `forced_emit` directly | The eval script is an operator-run localhost-gated harness driving the live HTTP route; the Tuner is an in-app background job. They share the *scoring concepts* (per-provider PASS-style cells) but the Tuner calls `forced_emit` in-process, not over HTTP. **Recommendation:** new `skill_tuner_service.py`; reuse the eval script's *cell/axis scoring shape* (`score_forced_emit_axes` pattern) but not its HTTP-driver plumbing. |
| Real tool-call inspection (drive the full agent loop per case) | `forced_emit`-style classification: ask the target model "given this catalog + this user prompt, would you call load_skill for skill X?" and force a structured yes/no | Driving the real agent loop per case × N × 3 is enormously expensive and entangles the whole tool surface. A scoped forced classification isolates the firing decision and is what makes the multi-minute (not multi-hour) run feasible. See Open Question 1 for the fidelity caveat — the classification prompt MUST mirror the real catalog-note wording so it measures the real policy. |
| LLM lint in the save path | Deterministic heuristic only (D-11) | An LLM call in `save_skill` would add latency + a provider dependency to every save and could hard-fail the agent mid-task. Deterministic = fast/free/offline; the expensive measurement is opt-in in the Tuner. **Locked by D-11.** |
| New DB tables for tuner runs/cases | Ephemeral Redis-buffered run state + client-held cases | The eval+versioning backend (SI-01) is explicitly deferred to v3.2. The Tuner is a transient measurement tool; benchmark cases can live client-side per-session (auto-seeded + edited) and only the winning *description* is persisted (via PATCH). See Open Question 5. |

**Installation:** None. No external packages added this phase.

## Package Legitimacy Audit

> **Not applicable.** This phase installs **zero** external packages. Every dependency (`forced_emit`, `eval_cross_provider.py`, `context_window.py`, Redis run-buffer, `resolve_authoring_model`, pydantic, tiktoken, shadcn/ui) is already in-repo and shipped. There is no `npm install` / `pip install` step.

*If the planner introduces any package (it should not need to), it must run the Package Legitimacy Gate before adding it.*

## Architecture Patterns

### System Architecture Diagram

```
                              ┌─────────────────────────── TRIG-03 LINT (deterministic, no LLM) ───┐
                              │                                                                     │
  Human Skills form ─POST/PATCH /skills──┐                                                          │
                                         ├──► [shared skill_lint() util] ──► {ok | warnings[]} ─────┤
  Agent save_skill tool ──tool_dispatcher┘         (name-echo / no-verb /        │                  │
                                                    too-short / generic /        │ never blocks     │
                                                    dup-in-catalog / >1024)      ▼                  │
                                                                          save proceeds; warning    │
                                                                          surfaced (form inline /   │
                                                                          chat note) + "Tune this"──┼──┐
                                                                                                    │  │
  ──────────────────────────────────────── TRIG-01 TUNER (focused full-surface, ActiveView) ───────┘  │
                                                                                                       ▼
  Author "Tune triggers" ─► Tuner surface ──┐                                          ┌──────────────────┐
    (current description + auto-seeded       │  start-run (cases, targets, ≤N cands)   │ skill_tuner_     │
     should-fire / should-NOT cases,         ├────────────POST /skills/{id}/tuner/runs─► service.py       │
     edited by author; 60/40 split)          │                                         │                  │
                                             │                                         │ 1. build_candidates(≤N)
  Live progress card ◄──SSE (run-buffer)─────┤◄───run:{run_id} stream───────────────── │    via forced_emit(builder_model)
    per-provider lanes, elapsed timer,       │                                         │ 2. for cand × target × case × 3:
    "reconciles on return"                    │                                         │      classify_fires() via forced_emit(target)
                                             │                                         │ 3. score: fires-recall + no-false-precision
  Scoreboard + candidate cards ◄──GET results│◄──GET /skills/{id}/tuner/runs/{run_id}──│    split train(60)/held-out(40)
    N-column (org's configured targets),     │                                         └──────────────────┘
    each cell: fires + no-false               │
                                             │
  Author picks winner by HELD-OUT ──confirm──┴──PATCH /skills/{id} (re-lints) ──► live description updated
                                                                                  (skill begins firing immediately)

  ──────────────────────────────── D-01 RUNTIME (the policy that makes the above load-bearing) ──────────
  Chat turn (General Mode) ─► agent_loop assembles system prompt:
    ## Available Skills catalog (owner-scoped query :1090) + RELAXED note (:1099-1108):
    "call load_skill when the request clearly matches a catalog description"
    ─► model decides (tool_choice=auto) ─► load_skill fires by description match

  ──────────────────────────────── CTX-03 PINNING (backend-only, G-5 trim path) ─────────────────────────
  load_skill result ─► tool_dispatcher tags it pinned ─► persisted ─► _reconstruct_history rebuilds
    ─► trim_messages_to_fit() treats load_skill tool-results as a 3rd protected class
       (system msg + reserve_recent tail + pinned skills), de-dupe same-skill,
       pin-budget cap → evict least-recently-loaded + _TRIM_MARKER (honest)
```

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── skill_lint.py            # NET-NEW — deterministic TRIG-03 heuristic (pure, no I/O, no LLM)
│   ├── skill_tuner_service.py   # NET-NEW — benchmark runner: build_candidates + classify_fires + held-out scoring
│   ├── forced_emit.py           # REUSE — candidate gen + per-case classification
│   ├── context_window.py        # EDIT (G-5) — trim_messages_to_fit pins load_skill tool-results (D-13/14)
│   ├── tool_dispatcher.py       # EDIT — _handle_load_skill tags result pinned (D-13); _handle_save_skill calls skill_lint (D-10)
│   └── agent_loop.py            # EDIT (G-5) — relax the :1099-1108 catalog note (D-01); preserve owner-scoped query
├── api/
│   ├── skills.py                # EDIT — POST/PATCH call skill_lint (D-10); + NET-NEW tuner-run routes (or a new router)
│   └── skill_tuner.py           # OPTIONAL NET-NEW — start/status/results routes (planner's call vs. folding into skills.py)
└── config.py                    # EDIT — add skill_builder_model setting (mirror harness_authoring_model)

frontend/src/
├── pages/
│   └── SkillTunerPage.tsx       # NET-NEW — the focused full-surface (041-A), reached via ActiveView
├── components/skills/
│   ├── SkillFormDialog.tsx      # EDIT — inline lint warning under Description (044-A) + "Tune this" handoff
│   └── tuner/                   # NET-NEW — CaseEditor, ProviderScoreboard, CandidateCard, LiveRunCard (042/043)
├── App.tsx                      # EDIT — add "skill-tuner" to the ActiveView union
└── lib/nav-items.ts             # (no new top-level nav entry — the Tuner is reached FROM a skill, not a peer nav home)
```

### Pattern 1: Focused full-surface via the `ActiveView` no-router switch
**What:** The app navigates with a `useState<ActiveView>` switch, NOT react-router. A focused surface (publish gauntlet, GovernancePage, ClassificationRulesPage) adds a member to the `ActiveView` union and mounts in `ChatLayout`'s conditional render.
**When to use:** The Tuner (041-A) takes the whole working area (rail stays, list+detail hidden), reached from a "Tune triggers" action on a skill, returns via `‹ Skills`.
**Example:**
```typescript
// Source: frontend/src/App.tsx:9 + frontend/src/components/layout/ChatLayout.tsx:295 (VERIFIED)
// App.tsx — extend the union:
export type ActiveView =
  "chat" | "documents" | "skills" | "settings" | "library-health" |
  "workflows" | "classification-rules" | "governance" | "skill-tuner"  // <- NET-NEW

// ChatLayout.tsx — mount the focused surface (mirrors the classification-rules branch :295):
) : activeView === "skill-tuner" ? (
  <SkillTunerPage skillId={tunerSkillId} onBack={() => onNavigate("skills")} />
) : ...
```
**Note:** Unlike Workflows/Governance/Classification, the Tuner is NOT a top-level `NAV_ITEMS` entry (you don't navigate to "the Tuner" cold — you tune *a specific skill*). It is a sub-surface of Skills, entered with a `skillId`. Carry `tunerSkillId` alongside `activeView` (a sibling `useState` in App.tsx, like the existing per-view selection state).

### Pattern 2: `forced_emit` for structured generation AND classification
**What:** Both the builder (candidate-description rewrites) and the per-case classifier (did this description make the model fire?) are single-shot forced structured emissions through the existing 4-rung ladder.
**When to use:** Every candidate-generation call (builder model, D-08) and every per-case classification call (target model, D-05).
**Example:**
```python
# Source: backend/app/services/forced_emit.py:318 (VERIFIED signature)
from pydantic import BaseModel
from app.services.forced_emit import forced_emit

class CandidateDescriptions(BaseModel):
    candidates: list[str]  # ≤N rewrites

class TriggerDecision(BaseModel):
    would_load: bool
    skill_name: str | None  # which skill the model would load, if any

# Candidate generation (builder model — D-08):
result = await forced_emit(
    messages=[{"role": "user", "content": rewrite_prompt}],
    model=skill_builder_model,        # resolve via the D-08 knob (resolve_*_model pattern)
    provider=get_model_capability(skill_builder_model)["provider"],
    emitter="emit_candidates",
    tools=[...],
    user_settings=user_settings,
    schema_model=CandidateDescriptions,
)
# result["emitted"] is a CandidateDescriptions | None (honest-fail floor, never silent)
```

### Pattern 3: CTX-03 trim-pin — a third protected class, NOT a fork
**What:** `trim_messages_to_fit()` today preserves two classes: the system message (index 0) and the `reserve_recent` tail. CTX-03 adds a third: `load_skill` tool-results flagged pinned. The flag is set in code (D-13), never by pattern-matching the JSON.
**When to use:** CTX-03. This is the entire G-5 surface.
**Example:**
```python
# Source: backend/app/services/context_window.py:151-229 (VERIFIED current shape)
# The pin flag travels on the message dict (e.g. msg["_pinned_skill"] = "<name>").
# trim_messages_to_fit() partitions rest into: pinned | trimmable | protected(tail).
# Pinned are kept like protected; the safety valve (D-14) evicts least-recently-loaded
# pinned when sum(pinned tokens) > pin_budget_fraction * max_tokens, inserting _TRIM_MARKER.
# CRITICAL: keep the existing atomic tool-pair removal intact — a pinned tool-result
# message has a parent assistant+tool_calls message; both must stay together.
```
See §Common Pitfalls Pitfall 2 for the atomic-pair trap and §Code Examples for the de-dupe.

### Pattern 4: Provider-set adaptivity from configured API keys
**What:** The org's "configured/enabled targets" = providers with a non-empty API key (`Settings.{provider}_api_key`) intersected with the models the org actually uses. The scoreboard renders N columns where N = that set; a provider with no key never renders.
**When to use:** The Tuner's target selection (D-05) + the N-column scoreboard (042-A band).
**Example:**
```python
# Source: backend/app/config.py:718-731, :769-778 (VERIFIED — per-provider api_key fields)
# Configured providers = those with a non-empty key:
PROVIDER_KEY_ATTRS = {
    "openai": "openai_api_key", "anthropic": "anthropic_api_key",
    "google": "google_api_key", "openrouter": "openrouter_api_key",
    "deepseek": "deepseek_api_key", "moonshot": "moonshot_api_key",
    "minimax": "minimax_api_key", "zhipu": "zhipu_api_key",
}  # + local: ollama / lm-studio / openai-compat have base_url, not keys
def configured_providers(settings) -> list[str]:
    return [p for p, attr in PROVIDER_KEY_ATTRS.items() if getattr(settings, attr, "")]
# Default targets = one representative per configured provider (mirror the
# eval PROVIDERS roster / SUB_AGENT defaults config.py:694-696). N=1 is the clean baseline.
```
**Hard rules (load-bearing honesty, sketch 042-A band):** (1) a provider the org doesn't run **never renders** — a score you can't act on is a fabricated measurement; (2) **OpenRouter is one gateway** — native DeepSeek/GLM(zhipu/z-ai)/Kimi(moonshot)/MiniMax are first-class targets *distinct* from OpenRouter-routed copies (serving path ≠ model name; cf. Phase 115 Gemini schema, Phase 122 `emit_tier` per provider).

### Anti-Patterns to Avoid
- **Forking the trim path per-skill (G-5 / D-14 RED LINE).** CTX-03 is ONE new protected class inside the existing function — never a parallel trim function for skills. The shared path stays single.
- **Pattern-matching JSON to find skill results.** D-13 forbids this — tag in code at `_handle_load_skill`. The reconstructed tool-result is identifiable by its parent `tc["name"] == "load_skill"`, not by sniffing `{"instructions": ...}`.
- **Hoisting skill instructions into the system prompt.** D-13 explicitly rejects this — minimal blast radius means keeping it a normal (pinned) tool-result message.
- **Hardcoding a paid provider as the builder model.** D-08 / 111.1 lesson — the builder must be selectable across the full provider list incl. local; default is a *configurable* strong default, not a SPOF.
- **Picking the winner by the train score.** The held-out 40% (never used to select) is the honest pick. Sketch 042-A: the number the author picks by is the held-out score.
- **Driving the full agent loop per benchmark case.** Multi-hour, entangles the whole tool surface. Use scoped `forced_emit` classification (see Open Question 1 for the fidelity guard).
- **Rendering a fixed four-column scoreboard.** N-column = configured targets. N=1 is the clean baseline, not a degraded mode.
- **An LLM call in the save path.** D-11 — deterministic heuristic only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-provider structured emission | A per-provider tool-call requester | `forced_emit(schema_model=...)` | The 4-rung ladder + gateway already handle every provider's forcing quirks (Phase 122); rebuilding forks the shared path (D-14 RED LINE). |
| Background job + live progress | A new task queue / polling scheme | Redis run-buffer (`run:{run_id}` + `runs_by_thread` + `runs:active`) + SSE | Phase 061+ proven; the chat loop + workflows already use it; the never-vanishes elapsed-timer lesson (095) is baked in. |
| Per-provider scoreboard scoring | A bespoke pass/fail tally | The `score_forced_emit_axes` / cell-shape pattern from `eval_cross_provider.py:1412` | Already the canonical per-provider cell shape; the Tuner's fires/no-false cells are an analog. |
| Configurable model routing with a strong default | An env var + ad-hoc fallback | The `resolve_authoring_model()` pattern (settings → registry-default-with-forced-emission → honest None) | D-08; mirrors `harness_judge_model` / `harness_authoring_model` / `extraction_model` — the established settings-not-env knob. |
| Token estimation for the pin budget | A char-count guess | `estimate_messages_tokens` / `estimate_tokens` (`context_window.py:94/120`) | Already tiktoken-backed for OpenAI, chars/4 floor elsewhere; the trim path already uses it. |
| Owner-scoped skill reads | A new query | The existing `.or_(user_id.eq.{id}, is_global.eq.true).eq(is_enabled, True)` (`agent_loop.py:1090`, `_handle_load_skill:663`) | RLS + leak-safety; the sibling-skill auto-seed (D-04) MUST use this exact scope. |
| Focused-surface navigation | A react-router route | The `ActiveView` + `useState` switch | The app has no router; every focused surface (gauntlet, governance, classification) uses this. |

**Key insight:** Phase 123's value is *orchestration over proven primitives*, not new machinery. The only genuinely net-new logic is the held-out split/repeat math, the per-case firing measurement, the deterministic lint heuristic, the trim-pin protected class, and the React surface. Everything else is wiring existing parts.

## Runtime State Inventory

> This is a feature phase, not a rename/refactor. However, two cross-cutting state concerns matter:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `skills` table — the live `description` column is the thing the Tuner ultimately writes (via PATCH). NO schema change needed for TRIG-01/03 (cases can be ephemeral/client-held; see Open Q5). CTX-03 needs NO new column (the pin flag is in-memory on the reconstructed message). | None for schema; the winner write reuses PATCH. |
| Live service config | Redis run-buffer keys for the tuner job (`run:{tuner_run_id}` etc.) — created on first write, no migration. | None (Redis has no schema). |
| Secrets/env vars | Per-provider API keys (`Settings.{provider}_api_key`, `config.py:718-731`) gate which targets are "configured". The D-08 builder-model id is a SETTING (app_settings), NOT a secret. | None (read-only use of existing keys). |
| OS-registered state | None — no OS-level registration involved. | None — verified by scope (in-app feature). |
| Build artifacts | None — no package/binary changes. | None — verified (no new deps). |

**Nothing found in OS-registered / build-artifact categories:** confirmed — this phase adds in-app code only.

## Common Pitfalls

### Pitfall 1: The classification prompt doesn't mirror the REAL firing policy
**What goes wrong:** The Tuner measures "would this description fire?" with a forced classification, but the prompt it uses differs from the real `## Available Skills` catalog note (D-01). The score then measures a *different* policy than production runs.
**Why it happens:** Convenience — writing a clean "yes/no would you load X" prompt instead of replicating the exact runtime catalog assembly + relaxed note.
**How to avoid:** Build the classifier's context from the SAME pieces as the live path: the owner-scoped catalog (sibling skills included, for false-fire realism) + the EXACT relaxed catalog-note wording from `agent_loop.py:1099-1108` (after D-01). The classifier prompt = "Here is the catalog and the policy; here is a user turn; would you call load_skill, and for which skill?" forced to `TriggerDecision`. When D-01's wording changes, the classifier wording must change in lockstep (single source — consider a shared constant).
**Warning signs:** Tuner says a description is great but live UAT shows it not firing (or false-firing). This is the core fidelity risk — see Open Question 1.

### Pitfall 2: CTX-03 breaks the atomic tool-pair invariant
**What goes wrong:** Pinning the `load_skill` tool-result message but letting its parent assistant+tool_calls message get trimmed orphans the tool result → providers 400 on an orphaned tool message with no matching tool_call id.
**Why it happens:** `_remove_oldest_atomic()` (`context_window.py:251`) removes an assistant+tool_calls block PLUS its following tool messages as a unit. If you pin only the tool-role result, the parent is still in `trimmable`.
**How to avoid:** Pin the WHOLE atomic group (the assistant+tool_calls message that called load_skill AND its tool-result), or — simpler and recommended — when partitioning, move the entire atomic group containing a pinned load_skill result into the pinned set. Re-run `test_context_window.py` atomic-removal tests (`:219`, `:244`, `:272`) after the change.
**Warning signs:** A provider 400 ("tool_call_id has no matching tool_calls") after a trim that dropped a skill's caller but kept its result.

### Pitfall 3: De-dupe on reload double-counts a re-loaded skill
**What goes wrong:** A skill loaded twice in a session (D-13 de-dupe requirement) gets two pinned copies, doubling its pin-budget cost and showing duplicate instructions.
**Why it happens:** Each `load_skill` call persists a tool-result row; `_reconstruct_history` rebuilds both.
**How to avoid:** When partitioning for the pin set, keep only the MOST RECENT pinned tool-result per skill name (dedupe key = skill name). The older duplicate falls back to the normal trimmable pool (so it can be dropped). Track "least-recently-loaded" by the original message order for the D-14 eviction.
**Warning signs:** Pin budget exhausts faster than expected; identical skill instructions appear twice in context.

### Pitfall 4: Gemini schema constraints break the classification emission
**What goes wrong:** A `forced_emit` schema for the classifier (or candidate gen) uses `anyOf`/`oneOf` or a multi-type `type: [...]` array → google-genai 400s, breaking ALL Gemini targets.
**Why it happens:** Documented Phase 115 trap (`reference_gemini_schema_type_array_trap`) — Gemini rejects union schemas and multi-type arrays.
**How to avoid:** Keep the classifier/candidate Pydantic schemas FLAT and single-typed. `TriggerDecision { would_load: bool, skill_name: str | None }` — note `str | None` becomes `nullable`, which is fine; avoid `Union[A, B]` discriminated shapes. The `forced_emit` path already strips discriminators (`_strip_discriminator`, `forced_emit.py:108`) but don't rely on it for the type-array case.
**Warning signs:** Gemini target column shows transport FAIL across all cells while other providers pass.

### Pitfall 5: Pin budget starves the recent-message budget (the exact failure CTX-03 must not create)
**What goes wrong:** Pinning every loaded skill consumes so much budget that `reserve_recent` recent turns get squeezed → the model loses the live conversation to keep stale skills.
**Why it happens:** No cap on total pinned tokens (D-14's whole point).
**How to avoid:** Cap pinned at a FRACTION of `resolve_context_budget()` (Claude's-discretion default: recommend **1/3** — generous for "few skills, modest instructions" while leaving 2/3 for system + history + recent tail). On overflow, evict least-recently-loaded pinned + emit `_TRIM_MARKER` (honest, never silent).
**Warning signs:** Long sessions with many loaded skills lose recent context; the user notices the agent forgetting the current turn.

### Pitfall 6: The lint blocks the agent's save_skill mid-task
**What goes wrong:** The lint hard-fails or returns an error from the `save_skill` handler, aborting the agent's task.
**Why it happens:** Treating the lint as validation rather than advisory.
**How to avoid:** D-09 — the lint NEVER blocks. On the agent path, the save proceeds and the warning is surfaced as a non-fatal note in the tool result (so the agent can mention it) — never an exception. On the form path, the warning renders inline (044-A) but the PATCH/POST still succeeds.
**Warning signs:** An agent task aborts after trying to save a skill with a thin description.

## Code Examples

Verified patterns from the live codebase:

### The D-01 contradiction to reconcile (the exact text)
```python
# Source: backend/app/services/agent_loop.py:1099-1108 (VERIFIED — the conservative note to RELAX)
catalog_note = (
    f"\n\n## Available Skills\n"
    f"The following skills are available. ONLY call `load_skill(skill_name)` when the user "
    f"explicitly names a skill or says 'use [skill name]'. Never auto-load based on "
    f"description similarity — wait for an explicit request:\n{catalog_lines}"
)
# Source: backend/app/services/openai_service.py:434-437 (VERIFIED — already aligned with D-01)
# LOAD_SKILL_TOOL description: "Use when the user's request matches a skill in the catalog."
# ^ These two tell OPPOSITE stories. D-01 rewrites the catalog_note to match the tool description:
# e.g. "Call load_skill(skill_name) when the user's request clearly matches one of these skill
#       descriptions. Match on intent, not just exact names. Do not load a skill for an unrelated
#       request."  (exact wording is the planner's; the should-NOT benchmark is the safety rail.)
```

### `forced_emit` signature (the orchestration primitive)
```python
# Source: backend/app/services/forced_emit.py:318-330 (VERIFIED)
async def forced_emit(
    *, messages: list[dict], model: str, provider: str, emitter: str,
    tools: list[dict], user_settings: Any, system_prompt: str = "",
    max_tokens: int | None = None, schema_model: type[BaseModel] | None = None,
    strict: bool | None = None,
) -> dict:
    # returns {"emitted": BaseModel|None, "tier", "emit_rung", "provider",
    #          "forced", "recovered_from_narration", "truncated", "failure"}
```

### Deterministic lint heuristic (D-11 — sensible defaults)
```python
# NET-NEW: backend/app/services/skill_lint.py — pure, no I/O, no LLM.
# Returns a list of (code, message) warnings; EMPTY list = healthy. NEVER raises.
# Claude's-discretion thresholds (grounded, planner may tune):
MIN_DESCRIPTION_CHARS = 25          # below this = "too short"
MAX_DESCRIPTION_CHARS = 1024        # STD-01 hint, free length-bound
NAME_ECHO_RATIO = 0.6               # if >60% of description tokens are just the name = "echoes name"
TRIGGER_VERBS = {"use", "when", "for", "to", "generate", "create", "analyze",
                 "summarize", "convert", "build", "extract", "format", "draft", ...}
GENERIC_PHRASES = {"a skill", "this skill", "helps with", "various tasks",
                   "general purpose", "useful for", "does things", ...}
def lint_description(name: str, description: str, sibling_descriptions: list[str]) -> list[dict]:
    warnings = []
    d = (description or "").strip()
    if not d:                              warnings.append({"code": "empty", ...})
    if 0 < len(d) < MIN_DESCRIPTION_CHARS: warnings.append({"code": "too_short", ...})
    if len(d) > MAX_DESCRIPTION_CHARS:     warnings.append({"code": "too_long", ...})  # STD-01 freebie
    if _name_echo_ratio(name, d) > NAME_ECHO_RATIO: warnings.append({"code": "name_echo", ...})
    if not _has_trigger_verb(d, TRIGGER_VERBS):     warnings.append({"code": "no_trigger_verb", ...})
    if _is_generic(d, GENERIC_PHRASES):             warnings.append({"code": "generic", ...})
    if _is_duplicate(d, sibling_descriptions):      warnings.append({"code": "duplicate", ...})
    return warnings   # caller never blocks on this (D-09)
```

### CTX-03 partitioning + de-dupe (the trim-pin core)
```python
# EDIT: backend/app/services/context_window.py — inside trim_messages_to_fit, after the
# system/rest split (:185) and BEFORE the protected-tail split (:193). Pseudocode:
#   1. Walk `rest` building atomic groups (mirror _remove_oldest_atomic's grouping).
#   2. A group is "pinned" if it contains a tool-result message flagged _pinned_skill.
#   3. De-dupe: keep only the LATEST pinned group per skill name; demote older ones to trimmable.
#   4. pin_budget = int(PIN_BUDGET_FRACTION * max_tokens)   # recommend 1/3
#   5. If sum(estimate of pinned) > pin_budget: evict least-recently-loaded pinned groups
#      (lowest original index) until under budget; set trimmed_any=True so _TRIM_MARKER is inserted.
#   6. Assemble: [system] + [_TRIM_MARKER if trimmed] + [pinned] + [trimmable…trimmed] + [protected tail].
# CRITICAL: pinned groups keep their assistant+tool_calls parent (Pitfall 2). Re-run test_context_window.py.
```

### The D-08 builder-model knob (mirror the authoring/judge pattern)
```python
# Source: backend/app/services/workflow_authoring.py:83-105 (VERIFIED pattern to mirror)
def resolve_skill_builder_model(settings) -> str | None:
    model = getattr(settings, "skill_builder_model", None)   # NET-NEW setting in config.py
    if model:
        return model
    from app.config import get_model_capability
    for candidate in ("claude-haiku-4-5-20251001", "gpt-5.4-mini"):  # strong, forced_emission default
        if (get_model_capability(candidate) or {}).get("forced_emission"):
            return candidate
    return None
# config.py: add `skill_builder_model: str | None = None` near harness_authoring_model:1004.
# Selectable across the FULL provider list incl. local (Ollama/LM Studio/openai-compat/DeepSeek-on-own-infra),
# decoupled from the benchmark targets — the builder WRITES, the targets MEASURE (D-08).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conservative skill loading ("ONLY on explicit name") | Description-driven firing (`tool_choice=auto` + clear catalog note) | This phase (D-01) | The whole reason TRIG-01 is load-bearing; both OpenAI + Anthropic docs confirm the model decides tool-calls from the description + context. |
| Implicit two-bool forcing (`forced_emission` + `strict_json_schema`) | Explicit `emit_tier` enum per model | Phase 122 (D-122-04) | The Tuner's classifier emission reads `emit_tier` via `forced_emit`; no per-provider special-casing. |
| Silent trim drops | Honest `_TRIM_MARKER` on any trim | Phase 075.4 / 078 | CTX-03 eviction reuses this marker — the pin safety-valve is never silent. |
| Eval as manual UAT only | Provider-as-first-class-axis scoreboard (`--forced-emit`, PASS/FAIL/DOCUMENTED) | Phase 088→122 | The Tuner's per-provider grid is the same shape, applied to fires/no-false. |

**Deprecated/outdated:**
- The over-conservative catalog note (`agent_loop.py:1099-1108`) — superseded by D-01 this phase. It was always contradicted by `LOAD_SKILL_TOOL`.
- `forced_emission` + `strict_json_schema` bools — DEPRECATED-UNREAD by `emit_tier` (Phase 122); do not re-read them.

## Assumptions Log

> All claims tagged `[ASSUMED]` that need user/operator confirmation before becoming locked plan decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-case firing is measured via scoped `forced_emit` classification (not by driving the full agent loop per case). | Alternatives / Open Q1 | If classification fidelity is too low, the Tuner measures the wrong policy. Mitigation: mirror the real catalog-note wording (Pitfall 1) and validate with at least one live full-loop spot-check in SC#10 UAT. **Operator should confirm the classification-vs-real-loop tradeoff is acceptable.** |
| A2 | Benchmark cases are ephemeral/client-held per tuning session; only the winning *description* is persisted (via PATCH). No new DB tables. | Alternatives / Open Q5 | If the operator wants cases to persist across sessions, a small table is needed (but SI-01 eval tables are explicitly deferred to v3.2). |
| A3 | Pin-budget fraction = 1/3 of the resolved context budget. | Pitfall 5 | Too low → skills evict too soon; too high → recent context starves. Claude's-discretion default; tunable. |
| A4 | `≤N` candidate count default = **3** (grounded in the ≤5-iteration spec — small enough to scan, enough to beat the baseline). | D-02 | Too many → slow/expensive runs; too few → weak tuning. Claude's-discretion. |
| A5 | "Configured targets" = providers with a non-empty API key (or a local base_url), one representative model each. | Pattern 4 | If the operator wants explicit per-org target curation in the run config, that's a UI affordance (043-A run config already implies it). |
| A6 | The D-01 relaxed wording is sufficient as a false-fire guard *with* the should-NOT benchmark; the per-skill `auto_trigger` kill-switch is NOT built unless SC#10 surfaces a regression. | D-01 / Deferred | If SC#10 shows false-firing the contingency must be added; CONTEXT marks it as a planner-includable contingency. **Decide at plan time whether to pre-build the flag or treat it as a fast-follow.** |
| A7 | Builder-model strong default = `claude-haiku-4-5-20251001` (sketch 044-A names `claude-haiku-4-5`), falling back to `gpt-5.4-mini`. | D-08 / Code Examples | A paid default; D-08 requires it be *selectable* incl. local, and the resolve function must not SPOF. The default firing only when configured. |

## Open Questions

1. **Classification fidelity vs. cost (the core TRIG-01 mechanics question).**
   - What we know: driving the full agent loop per (case × target × 3) is multi-hour and entangles the whole tool surface; a scoped `forced_emit` classification ("given this catalog + policy + user turn, would you call load_skill, and for which skill?") is what makes the run multi-minute.
   - What's unclear: how faithfully a forced yes/no classification reproduces the *real* tool_choice=auto firing decision per provider (a model asked to classify may behave differently than the same model deciding to emit a tool call in a live turn).
   - Recommendation: use the scoped classification BUT (a) build its context from the exact live catalog assembly + the post-D-01 catalog-note wording (shared constant), and (b) include at least one live full-agent-loop spot-check per provider in the SC#10 UAT to validate the classifier tracks reality. Surface to the operator as A1.

2. **Should-NOT case auto-seed realism (the false-fire rail quality).**
   - What we know: D-04 seeds should-NOT from sibling catalog skills (leak-safe owner-scoped) + generic off-topic prompts. Sibling skills are the realistic false-fire bait.
   - What's unclear: whether sibling descriptions alone produce hard enough negatives (two skills with overlapping domains are the real risk).
   - Recommendation: seed should-NOT from (a) sibling skills' *paraphrased* trigger prompts (not just their descriptions) + (b) a small fixed generic off-topic set. The author edits/adds (043-A). Good enough to start; the author is in the loop.

3. **Where the tuner-run routes live.**
   - What we know: `skills.py` already hosts skill CRUD; the run is a background job over Redis + SSE.
   - What's unclear: fold start/status/results into `skills.py` (`/skills/{id}/tuner/runs`) vs. a new `skill_tuner.py` router.
   - Recommendation: a new `skill_tuner.py` router mounted under `/skills/{id}/tuner/...` keeps `skills.py` lean (it's not a G-5 file but stays small). Planner's call (Claude's discretion per CONTEXT).

4. **SSE event shape for the tuner job vs. the chat run-buffer.**
   - What we know: the chat loop emits typed SSE events over `run:{run_id}`; the Tuner's per-provider live progress (043-A) needs per-lane progress + a stable-start-ts elapsed timer (095 never-vanishes lesson).
   - What's unclear: reuse the exact chat event vocabulary or a tuner-specific event set on the same stream.
   - Recommendation: reuse the run-buffer *transport* (`run:{tuner_run_id}` stream + `runs_by_thread`/`runs:active` for cleanup) with a small tuner-specific event set (`tuner_progress`, `tuner_provider_done`, `tuner_complete`). Don't overload chat event types.

5. **Case persistence (no DB vs. minimal table).**
   - What we know: SI-01's eval/versioning tables are explicitly deferred to v3.2.
   - What's unclear: whether benchmark cases must survive a page reload / second session.
   - Recommendation: keep cases ephemeral/client-held for this phase (auto-seed is fast; the author edits per session); persist ONLY the winning description via PATCH. If the operator wants persistence, that's the smallest possible additive table — but it edges toward SI-01's deferred scope. Surface as A2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis (local docker-compose.dev.yml) | D-06 background tuner job + SSE | ✓ (project infra) | per docker-compose | — (already required for chat) |
| Provider API keys (≥1) | Tuner targets (D-05) | depends on org | — | N=1 single-provider is the clean baseline; air-gapped self-hosted runs one column |
| tiktoken | Pin-budget token estimation (D-14) | ✓ (installed) | cl100k_base | chars/4 heuristic (already the non-OpenAI floor) |
| Supabase (skills table, RLS) | Skill reads/writes | ✓ (project infra) | local CLI | — |
| A local model server (Ollama/LM Studio) | D-08 self-hosted builder model (optional) | depends on org | — | A configured cloud builder model (default) |

**Missing dependencies with no fallback:** None — the phase degrades gracefully to N=1 (single configured provider) and a default cloud builder model.
**Missing dependencies with fallback:** Local model servers are optional (D-08 supports them but defaults to a cloud model).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest (`backend/venv/Scripts/python.exe -m pytest`) |
| Backend config | `backend/pytest.ini` / project conftest (existing) |
| Frontend framework | vitest (`.test.tsx` / `.spec.tsx`) |
| Quick run command (backend) | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_context_window.py backend/tests/unit/test_skill_lint.py -x` |
| Full suite command (backend) | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` |
| Cross-provider live eval (operator) | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py` (localhost-gated, SC#10 axis) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIG-03 | Deterministic lint flags name-echo / no-verb / too-short / generic / dup / >1024; never raises | unit | `pytest backend/tests/unit/test_skill_lint.py -x` | ❌ Wave 0 |
| TRIG-03 | Lint surfaces on POST /skills, PATCH /skills, and the agent save_skill path; save always proceeds (D-09/D-10) | integration | `pytest backend/tests/integration/test_skills_lint.py -x` | ❌ Wave 0 |
| CTX-03 | `load_skill` tool-result is pinned (kept) when older non-skill messages trim out | unit | `pytest backend/tests/unit/test_context_window.py::test_pin_load_skill_survives_trim -x` | ❌ Wave 0 (extend existing file) |
| CTX-03 | Pinned group keeps its assistant+tool_calls parent (no orphan) | unit | `pytest backend/tests/unit/test_context_window.py::test_pin_keeps_atomic_pair -x` | ❌ Wave 0 |
| CTX-03 | De-dupe: same skill loaded twice = one pinned copy | unit | `pytest backend/tests/unit/test_context_window.py::test_pin_dedupe_same_skill -x` | ❌ Wave 0 |
| CTX-03 | Pin-budget overflow evicts least-recently-loaded + inserts `_TRIM_MARKER` (honest) | unit | `pytest backend/tests/unit/test_context_window.py::test_pin_budget_evicts_lru_with_marker -x` | ❌ Wave 0 |
| CTX-03 | Existing trim invariants unbroken (G-5 regression) | unit | `pytest backend/tests/unit/test_context_window.py -x` + `pytest backend/tests/integration/test_075_4_subagent_truncation.py -x` | ✅ |
| TRIG-01 | Held-out split is 60/40 and the winner is picked by held-out score (pure scoring math) | unit | `pytest backend/tests/unit/test_skill_tuner_scoring.py -x` | ❌ Wave 0 |
| TRIG-01 | Per-case classification returns a structured TriggerDecision; honest-fail never silent | unit (mocked forced_emit) | `pytest backend/tests/unit/test_skill_tuner_service.py -x` | ❌ Wave 0 |
| TRIG-01 | Provider-set adaptivity: configured_providers → N targets; a provider with no key never appears | unit | `pytest backend/tests/unit/test_skill_tuner_service.py::test_n_column_configured_only -x` | ❌ Wave 0 |
| TRIG-01 | Tuner-run routes start/status/results (background job, owner-scoped) | integration | `pytest backend/tests/integration/test_skill_tuner_routes.py -x` | ❌ Wave 0 |
| TRIG-01 | Builder-model resolution (settings → strong default → honest None) | unit | `pytest backend/tests/unit/test_skill_builder_model.py -x` | ❌ Wave 0 |
| D-01 | The catalog note reconciles with LOAD_SKILL_TOOL (both tell one story) — structural assertion | unit | `pytest backend/tests/unit/test_skill_catalog_note.py -x` | ❌ Wave 0 |
| TRIG-01 / D-01 | **Cross-provider firing + no false-fire regression + pinning across long history (SC#10)** | manual + operator eval | `scripts/eval_cross_provider.py` + VALIDATION.md 4-axis UAT | partial (eval rig ✅, trigger axis extension ❌) |
| All UI (041–044) | Tuner surface renders N-column scoreboard, candidate cards, case editor, lint warning, "Tune this" | frontend | `vitest run` on net-new `.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest backend/tests/unit/test_context_window.py backend/tests/unit/test_skill_lint.py backend/tests/unit/test_skill_tuner_scoring.py -x` (the fast deterministic core)
- **Per wave merge:** `pytest backend/tests/ -q` (full backend) + `vitest run` (frontend)
- **Phase gate:** Full suite green + the operator cross-provider eval (SC#10 trigger axis) attached to VALIDATION.md before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_skill_lint.py` — covers TRIG-03 heuristic (all warning codes + never-raises)
- [ ] `backend/tests/integration/test_skills_lint.py` — covers TRIG-03 D-09/D-10 (3 hook points, save-always-proceeds)
- [ ] Extend `backend/tests/unit/test_context_window.py` — covers CTX-03 (pin survives, atomic-pair kept, de-dupe, LRU evict + marker)
- [ ] `backend/tests/unit/test_skill_tuner_scoring.py` — covers TRIG-01 held-out split/repeat math + winner-by-held-out
- [ ] `backend/tests/unit/test_skill_tuner_service.py` — covers candidate gen + classification (mocked forced_emit) + N-column adaptivity
- [ ] `backend/tests/integration/test_skill_tuner_routes.py` — covers tuner-run routes (owner-scoped, background job)
- [ ] `backend/tests/unit/test_skill_builder_model.py` — covers D-08 resolution
- [ ] `backend/tests/unit/test_skill_catalog_note.py` — covers D-01 structural reconciliation
- [ ] Frontend `.test.tsx` for the Tuner surface + the lint warning + "Tune this" handoff
- [ ] Extend `scripts/eval_cross_provider.py` with a trigger/no-false benchmark mode (or a sibling script) for the SC#10 operator gate

## Security Domain

> `security_enforcement` is enabled (no `false` in config) — included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; reuses `get_current_user` dependency on all routes. |
| V3 Session Management | no | No session change; tuner-run state is per-request/owner-scoped. |
| V4 Access Control | **yes** | RLS — the Tuner's skill reads + sibling auto-seed MUST use the owner-scoped `.or_(user_id.eq.{id}, is_global.eq.true)` query (`agent_loop.py:1090`, `_handle_load_skill:663`). Tuner-run start/status/results routes MUST scope to the skill's owner (mirror `update_skill`'s `.eq("user_id", current_user["id"])`). A user must never tune or read another user's non-global skill. |
| V5 Input Validation | **yes** | The author-typed description + benchmark cases are user input fed to `forced_emit` (the builder + target models). Pydantic models (FastAPI bodies) validate shapes; the description PATCH already goes through `SkillUpdate`. Prompt-injection in a case prompt only affects that case's classification (no privilege boundary crossed — the target model never gets tools in the classification shot). |
| V6 Cryptography | no | No crypto; provider keys are read from `Settings` (env, never logged). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user skill read/tune via the tuner routes | Information Disclosure / Elevation | Owner-scoped query on every tuner read + the PATCH write (`.eq("user_id", ...)`); never a service-role cross-user read. |
| Sibling auto-seed leaks another user's private skill descriptions | Information Disclosure | The sibling pull uses the SAME owner-scoped `.or_(...)` catalog query — only the author's own + global skills are seeded as negatives. |
| API-key disclosure via the configured-providers probe | Information Disclosure | `configured_providers()` reads key PRESENCE only (truthy check), never the value; mirror `eval_cross_provider.py`'s presence-only discipline. Never log key values. |
| Tuner background job as a DoS (cases × N × 3 live LLM calls) | Denial of Service | Bound the run: cap cases, cap N targets, cap ≤5 iterations (spec), wrap each provider lane in a per-call timeout (`llm_call_timeout_seconds` from the registry), and run as ONE background job per skill (no unbounded fan-out). Mirror the harness publish wall-budget discipline. |
| Prompt injection in a should-NOT case prompt influencing classification | Tampering | The classification shot gives the target model NO tools and NO write capability — worst case is a wrong PASS/FAIL on one cell, visible to the author who picks the winner. No privilege boundary. |
| D-01 relaxation causes false-firing → wrong skill loads sensitive instructions | Tampering / Elevation | The should-NOT benchmark axis is the measured guard (SC#10 mandatory); `load_skill` still only loads the author's own/global enabled skills (owner-scoped). The contingency `auto_trigger` flag (A6) is the fallback if UAT shows regressions. |

## Sources

### Primary (HIGH confidence — source read this session)
- `backend/app/services/agent_loop.py:751-837, 1075-1173, 1440-1480` — `_reconstruct_history`, the catalog-note (D-01), the two `trim_messages_to_fit` call sites.
- `backend/app/services/context_window.py` (full) — `trim_messages_to_fit`, `_remove_oldest_atomic`, `_TRIM_MARKER`, `resolve_context_budget`, `estimate_*`.
- `backend/app/services/forced_emit.py:99-330` — `forced_emit` signature, `_RUNGS_BY_TIER`, narration recovery.
- `backend/app/services/tool_dispatcher.py:655-729` — `_handle_load_skill` (D-13 tag site), `_handle_save_skill` (D-10 hook).
- `backend/app/api/skills.py:110-283` — list/create/PATCH (owner-scoped CRUD; lint hooks D-10; author-confirm write D-03).
- `backend/app/services/openai_service.py:430-467` — `LOAD_SKILL_TOOL` (already D-01-aligned), `SAVE_SKILL_TOOL`.
- `backend/app/services/workflow_authoring.py:83-105` — `resolve_authoring_model` (the D-08 knob pattern).
- `backend/app/config.py:136-194, 245-349, 375-413, 694-696, 718-731, 769-791, 980-1041` — `ModelCapability`/`emit_tier`, MODEL_CAPABILITIES (all production model-ids confirmed real), provider sets, per-provider API keys, `harness_authoring_model`/`harness_judge_model` knobs.
- `backend/app/models/user_settings.py:148-167` — the app_settings model-id knob precedent (`extraction_model`).
- `scripts/eval_cross_provider.py:1-120, 1400-1509` — PROVIDERS roster, `score_forced_emit_axes`, `_build_forced_emit_cell`, `--forced-emit` entry.
- `frontend/src/App.tsx:9`, `frontend/src/lib/nav-items.ts`, `frontend/src/components/layout/ChatLayout.tsx:285-307`, `frontend/src/pages/SkillsPage.tsx:1-55` — `ActiveView` union + the focused-surface mount pattern.
- `backend/tests/unit/test_context_window.py:295-348` — existing trim/marker tests to re-run (G-5 gate).

### Secondary (HIGH-MEDIUM — official docs, cross-checked)
- OpenAI Function calling docs — `tool_choice: auto` is the default; the model decides whether/which tool to call from the description + prompt. https://developers.openai.com/api/docs/guides/function-calling , https://developers.openai.com/api/docs/guides/tools
- Anthropic Tool use docs — Claude decides when to call a tool based on the user's request and the tool's description; description quality (3-4+ sentences) is the primary firing driver. https://docs.anthropic.com/en/docs/build-with-claude/tool-use , https://docs.claude.com/en/docs/agents-and-tools/tool-use/how-tool-use-works
- Phase 122 CONTEXT — `emit_tier`, `forced_emit` ladder, per-provider scoreboard, native-7 roster, OpenRouter best-effort. (`.planning/phases/122-cross-provider-trust-honesty-parity/122-CONTEXT.md`)
- Phase 115 Gemini schema trap (no anyOf/oneOf, no multi-type arrays) — carried as Pitfall 4. (project memory `reference_gemini_schema_type_array_trap`)

### Tertiary (project planning docs — scope-authoritative)
- `123-CONTEXT.md` (D-01..14), sketches 041–044 + MANIFEST decisions 32–35, `CONSOLIDATED-SCOPE.md` (TRIG-01 60/40/3/≤5 spec), `REQUIREMENTS.md`/`ROADMAP.md` (TRIG-01/03/CTX-03 + SC#10).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every reused component read at source; no new packages; all production model-ids confirmed in the live registry.
- Architecture (D-01 / CTX-03 / lint / tuner wiring): HIGH — exact code seams + line numbers verified; cross-provider firing behavior cross-checked against official OpenAI + Anthropic docs.
- Benchmark mechanics (TRIG-01 held-out/classification): MEDIUM — the orchestration is well-grounded but the classification-vs-real-loop fidelity (Open Q1 / A1) is the one genuine unknown; mitigated by the SC#10 live spot-check.
- Pitfalls: HIGH — derived from the actual trim-path code (atomic-pair, de-dupe, budget) and documented project traps (Gemini schema, never-silent marker).

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable in-repo substrate; re-verify production model-ids + provider docs if the registry changes)
