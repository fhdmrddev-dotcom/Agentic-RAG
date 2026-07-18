# Phase 123: Skill Triggering Quality - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make skills reliably **findable and firable**, and keep a loaded skill alive in context. Three requirements:

- **TRIG-01** — a **Skill Trigger Tuner**: an author tunes a skill's `description` against a held-out should-trigger / should-not-trigger benchmark, scored **cross-provider on production model-ids**, and picks the winning description by held-out score.
- **TRIG-03** — a **save-time description-quality lint** that flags weak/ambiguous trigger descriptions (at `save_skill` and in the skill-creator loop) so new skills start with descriptions that actually fire.
- **CTX-03** — **pin loaded-skill instructions out of the rolling trim window** so a skill doesn't silently fall out of context mid-session.

**Pivotal scope note:** Phase 123 also **relaxes the production triggering policy** so a skill's description actually drives `load_skill` firing (see D-01). This is the runtime change that makes TRIG-01 load-bearing rather than decorative. It is **in scope** for this phase, NOT a new capability.

**Not in this phase:** the autonomous description proposer (SI-02 / Phase 125), the smart-dispatch relevance pre-filter + catalog token budget (TRIG-02 / Phase 126), and the eval+versioning backend (SI-01 / v3.2).
</domain>

<decisions>
## Implementation Decisions

### Triggering semantics (the load-bearing decision)
- **D-01 — Descriptions drive firing.** Replace the conservative catalog instruction in `agent_loop.py:1099-1108` (the `## Available Skills` note: *"ONLY call `load_skill` when the user explicitly names a skill … Never auto-load based on description similarity"*) with an instruction that the model should `load_skill` **when the request clearly matches a catalog description**. The Tuner's **should-NOT-trigger** cases are the false-fire safety rail. This reconciles the existing contradiction with `LOAD_SKILL_TOOL` (`openai_service.py:434-436`, which already says "use when the request matches the catalog"). **Because this changes cross-provider runtime behavior, SC#10 UAT is MANDATORY** — prove no false-firing regression across all 4 axes (a previously-conservative skill must not start firing on unrelated prompts).
- **D-02 — Tuner output = SCORE + SUGGEST.** The Tuner (a) scores the current/typed description per-provider on held-out cases, and (b) can generate **≤N candidate description rewrites** (LLM rewrite via `forced_emit`), each auto-scored; the author **picks the winner by held-out score**. A human drives every iteration. This is explicitly NOT the autonomous proposer — that is Phase 125 SI-02 (eval → propose diff → DRAFT → human-approve → immutable version).
- **D-03 — Winner is author-confirmed, then saved.** The Tuner shows the winning description + scores; the author explicitly confirms before it is written via the existing **`PATCH /skills/{id}`** path (`skills.py:260`), which also runs the D-09 lint. No silent/auto-apply.

### Benchmark + Tuner UX (TRIG-01)
- **D-04 — Benchmark cases = hybrid auto-seed + author edits.** The Tuner generates a starter set (should-trigger = paraphrases of the description; should-not = sibling catalog skills + generic off-topic prompts); the author edits/approves/adds before running. **Held-out split 60/40 (train/held-out), 3 repeats, ≤5 iterations** (per CONSOLIDATED-SCOPE TRIG-01 spec).
- **D-05 — Benchmark targets = the 4 SC#10 axes**, one representative production model-id each (OpenAI, Anthropic, Google, OpenRouter); **configurable**. Reuse `scripts/eval_cross_provider.py`'s provider-as-first-class-axis scoreboard (trigger / force / recovery / honest-fail). A local-only shop can narrow targets to their own model.
- **D-06 — Run mode = background job + live progress.** A run is (cases × models × 3 repeats) live LLM calls — multi-minute. Kick off async, stream/poll progress (reuse the Phase-061+ run-buffer Redis keys + SSE), author keeps working. Not synchronous.
- **D-07 — Tuner UI = a panel hung off `SkillsPage` / `SkillDetailPanel`** (case editor + per-provider scoreboard + candidate list). **G-2 fires** → run `/gsd:sketch` BEFORE plan-phase (operator approved sketch-first).

### Skill-builder model (operator-raised — provider-agnostic, no SPOF)
- **D-08 — The skill-builder model is a configurable setting, reusing the existing knob pattern.** The model that *builds* skills (generates candidate descriptions in D-02 + auto-seed cases in D-04) is a configurable app/user setting that mirrors **`harness_authoring_model` + `resolve_authoring_model()`** (`config.py:1004`; sibling of `harness_judge_model`). It has a **strong default** (works well out of the box) but is selectable across the app's **FULL provider list — paid cloud (OpenAI/Anthropic/Google/OpenRouter) AND local/self-hosted (Ollama / LM Studio / OpenAI-compatible / DeepSeek-on-own-infra), treated equally.** **No paid-provider hardcoding / no SPOF** — mirrors the Phase 111.1 embedding-SPOF removal. The builder model is **decoupled** from the benchmark target set (D-05): the builder *writes* candidates, the targets *measure* firing. Lives in settings, not env (a model-id is a value, not a secret).

### Save-time lint (TRIG-03)
- **D-09 — Lint WARNS, never blocks.** Surface a never-silent flag with the specific reason; the save always proceeds. Avoids hard-failing the agent's own `save_skill` tool mid-task.
- **D-10 — Lint lives in the shared service/API layer** so it covers BOTH the human Skills form (`POST /skills` `skills.py:127` / `PATCH /skills/{id}` `skills.py:260`, pre-persist) AND the agent's `SAVE_SKILL_TOOL` path (`openai_service.py:452` → the `save_skill` handler in `tool_dispatcher.py`).
- **D-11 — Lint engine = deterministic heuristic only** (no LLM call in the save path): non-empty; doesn't merely echo the name; contains a verb/trigger phrase; not too short / too generic; not duplicated across the author's catalog. (Cheap length-bound check also covers STD-01's ≤1024 hint for free.) The expensive cross-provider quality measurement stays opt-in in the Tuner — a clean fast/slow split.
- **D-12 — Lint → Tuner handoff.** A weak-description warning in the Skills form offers a one-click **"Tune this"** that opens the Trigger Tuner for that skill, tying TRIG-03 → TRIG-01 into one authoring flow.

### Skill pinning (CTX-03 — G-5 hot path)
- **D-13 — Pin mechanism = tag the `load_skill` tool-result as protected.** At load-skill time (`_handle_load_skill`, `tool_dispatcher.py:655`), mark its tool-result message with an explicit flag; teach **`trim_messages_to_fit()`** (`context_window.py:151`) to treat flagged messages as non-trimmable, alongside the system message + `reserve_recent` tail. **De-dupe on reload** (same skill loaded twice = one pinned copy). NOT pattern-matching the JSON; NOT a system-prompt hoist — minimal blast radius on the G-5 hot file.
- **D-14 — Pin budget = pin all, with a safety valve.** Pin every loaded skill (skills are few + instructions modest), BUT cap total pinned at a fraction of the resolved context budget (`resolve_context_budget()`); if exceeded, evict the **least-recently-loaded** pinned skill and emit an **honest trim marker** (reuse the `_TRIM_MARKER` pattern, `context_window.py:65` — never silent). Delivers "available for the rest of the session" for the realistic case while preventing pinning from starving the recent-message budget (the exact failure CTX-03 must not create).

### Claude's Discretion
- Exact heuristic thresholds for D-11 (min length, generic-phrase list, name-echo ratio) — planner/researcher to choose sensible defaults.
- Exact `≤N` candidate count for D-02 and the pinned-budget fraction for D-14 — pick defaults grounded in the ≤5-iter spec and the trim budget.
- Concrete service/route names (`skill_tuner_service.py`, `skill_lint.py`, the tuner-run endpoints) — planner's call.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirement specs
- `.planning/ROADMAP.md` — Phase 123 row (goal, requirements TRIG-01/TRIG-03/CTX-03, flags: G-5 + SC#10) and the STRETCH boundary (125 SI-02, 126 TRIG-02).
- `.planning/REQUIREMENTS.md` §"Skill Triggering Quality" — TRIG-01, TRIG-03, CTX-03 verbatim; plus the deferred boundary (SI-01/SI-02/TRIG-02/STD-01/DISC-01).
- `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` §51-54 — the TRIG-01 benchmark spec (**60/40, 3 runs, ≤5 iter, pick by held-out, cross-provider on production model-ids**) and the TRIG-03/CTX-03 sizing.
- `.planning/PRDs/v3.1-skill-studio-eval.md` — the milestone PRD this scope derives from.

### Cross-provider eval + emission patterns to reuse (from Phase 122)
- `.planning/phases/122-cross-provider-trust-honesty-parity/122-CONTEXT.md` — the `emit_tier` / `forced_emit` retry-ladder / per-provider scoreboard decisions the Tuner builds on.

### Sketch (after CONTEXT, before plan)
- `Skill("sketch-findings-agentic-rag")` — load before sketching the Tuner panel (G-2). The Skills surface is net-new for this skill but the panel/scoreboard idioms carry from the workflow-run + document-detail panels.

No additional external ADRs — implementation decisions are fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`backend/app/services/forced_emit.py`** — single-shot forced structured emission (3 tiers: `force_strict`/`force`/`coerce`). Reuse for (a) the builder's candidate-description generation and (b) the per-case trigger classification in the benchmark.
- **`backend/app/config.py`** — `harness_authoring_model` + `resolve_authoring_model()` (`:1004`) and `harness_judge_model` + `resolve_judge_model()` are the **knob pattern for D-08**. `MODEL_CAPABILITIES` + `get_model_capability()` (`:495`) + `emit_tier` (Phase 122) drive provider routing.
- **`scripts/eval_cross_provider.py`** — the provider-as-first-class-axis scoreboard rig (8 providers, representative models, native-7 gate). Extend it for the trigger benchmark (D-05).
- **`backend/app/services/context_window.py`** — `trim_messages_to_fit()` (`:151`), `_remove_oldest_atomic()` (`:251`), `_TRIM_MARKER` (`:65`), `resolve_context_budget()` — the CTX-03 seam (D-13/D-14).
- **Redis run-buffer** — `run:{run_id}` stream + `runs_by_thread` / `runs:active` (Phase 061+) + SSE — for the D-06 background tuner job.
- **Frontend** — `frontend/src/pages/SkillsPage.tsx`, `frontend/src/components/skills/SkillFormDialog.tsx` (`SkillForm` + `SkillDetailPanel`), `frontend/src/components/skills/SkillCard.tsx` — host for the Tuner panel (D-07) + the inline lint warning (D-12).

### Established Patterns
- **Settings-not-env knobs** (`harness_authoring_model` / `harness_judge_model`) → D-08 builder model.
- **Leak-safe owner-scoped catalog query** — the enabled-skills query at `agent_loop.py:1090-1094` already uses `.or_(user_id.eq.{id}, is_global.eq.true).eq(is_enabled,true)`. Preserve this scope in the Tuner's skill reads.
- **Background run + SSE + run-buffer** (Phase 061+) → D-06.
- **Never-silent trim marker** (`_TRIM_MARKER`) → D-14 eviction honesty.

### Integration Points
- `backend/app/services/agent_loop.py:1099-1108` — relax the `## Available Skills` catalog instruction (D-01). **G-5 hot file** — re-run trim/replay tests after touching the trim path here / in `context_window.py`.
- `backend/app/services/openai_service.py:434` `LOAD_SKILL_TOOL` — already aligned with D-01; confirm both surfaces tell one story.
- `backend/app/api/skills.py:127` (`create_skill`) + `:260` (`update_skill`) — lint hook (D-09/10/11).
- `backend/app/services/tool_dispatcher.py` `save_skill` handler — lint also applies to the agent's authoring path (D-10).
- `backend/app/services/tool_dispatcher.py:655` `_handle_load_skill` — tag the tool-result message as protected (D-13).
- New (planner to name): a `skill_tuner_service.py` (benchmark runner + candidate generation), a `skill_lint` utility (D-11 heuristic), and tuner-run API routes (start/status/results).
</code_context>

<specifics>
## Specific Ideas

- "**Production model-ids**" means real ids from `MODEL_CAPABILITIES`, one representative per axis — not test stubs.
- Benchmark mechanics are fixed by the spec: **60/40 train/held-out split, 3 repeats per case, ≤5 tuning iterations, pick by held-out score.**
- The builder/target decoupling is the operator's explicit ask: **any provider — paid cloud or locally self-hosted — can build skills; nothing is locked to a paid provider.**
</specifics>

<deferred>
## Deferred Ideas

- **Per-skill auto-trigger opt-in / kill-switch** — if SC#10 UAT surfaces false-fire regressions from the D-01 policy relaxation, the fallback is a per-skill `auto_trigger` flag (only flagged skills fire by description; others stay explicit-name). Captured as a **contingency the planner may include**, not a separate phase.
- **Smart-dispatch relevance pre-filter + catalog token budget** — the natural follow-on once descriptions drive firing (catalog grows → noise). Already roadmapped: **TRIG-02 / Phase 126 (STRETCH).**
- **Autonomous description proposer** (eval → propose → DRAFT → approve → immutable version) — **SI-02 / Phase 125 (STRETCH).** D-02 deliberately stops at human-driven suggest.
- **agentskills.io frontmatter enforcement** (name rules, description ≤1024) — STD-01 / v3.2. D-11's length check covers the ≤1024 hint cheaply now; full enforcement is later.

None of the above expand this phase's scope — they are the explicit boundaries with adjacent roadmapped work.
</deferred>

---

*Phase: 123-skill-triggering-quality*
*Context gathered: 2026-06-23*
