# Phase 133: Eval Runner — With-Skill vs Without-Skill - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver an **eval runner** (EVAL-02): a user launches an eval run for one skill, and for each saved test case the system runs the existing agent loop **twice** — once with the skill active, once without — producing two comparable completions per case. Per-case progress streams live over SSE so the user watches the run advance case-by-case, and the full result set persists so it is still readable after a page reload or backend restart.

**Reuses the existing agent loop + provider gateway — NO new runtime** (D-14 red line). The eval runner is a **net-new router + service** that DRIVES `run_agent_loop` read-only; it must not edit the shared Deep/agent-loop/provider path. Deep Mode stays byte-identical (SC#10).

This phase is the runner *engine* + a thin functional surface. The honest per-provider verdict, side-by-side comparison UI, and ratings are **Phase 134** (EVAL-03/04). The designed Skill Evals panel is **Phase 137** (PANEL-01, G-2 sketch-gated).
</domain>

<decisions>
## Implementation Decisions

### Provider scope of a run
- **D-01:** One eval run targets **a single provider/model, picked at launch**. To compare providers, the user launches another run. Simplest, cheapest, clearest live progress (cost = 2 variants × N cases per run).
- **D-02:** The result schema is **provider-keyed regardless** (every result row records its provider/model), so multi-provider fan-out in one run is a later **additive** change — not a rewrite. (Deferred — see `<deferred>`.)

### What "with-skill" injects (SEED-002 catalog-injection-cost decision — RESOLVED here)
- **D-03:** The WITH-skill completion injects **ONLY the target skill** into the catalog — not the user's full enabled catalog. The with-vs-without delta is then purely this one skill, so the comparison cleanly attributes any change to it. Cheaper prompt, honest A/B. This resolves the SEED-002 pre-work note ("full vs target-only inject during eval"). Lever: the skill-catalog injection block at `agent_loop.py:1174-1195` (queries enabled skills, appends `## Available Skills`) must be driven with a catalog scoped to just the target skill for this arm.

### What "without-skill" means (the baseline)
- **D-04:** The WITHOUT-skill completion injects **no skills at all** (empty catalog — same lever as `agent_mode == "explorer"`, which skips injection at `agent_loop.py:1174`). Combined with D-03 (target-only on the other arm), the **only variable across the two runs is the target skill itself** — the cleanest, most honest A/B.

### Live progress + run lifecycle
- **D-05:** Live progress is **per-case / per-variant status transitions + full completion text dropped when each arm finishes** (e.g. `case 3/10 · without-skill running → done` then the output appears). NOT full token-by-token streaming of each completion. Meets SC#2 ("advance case-by-case") with lighter SSE traffic. Streams through the existing `_emit → run:{run_id}` buffer; case/variant status events are **additive** event types on the shared vocabulary.
- **D-06:** **Persist-per-case, reattach-on-reload, no server-crash auto-resume.** Each case result is persisted the instant that arm completes (survives reload — SC#3). A page reload **reattaches to the still-live run and keeps streaming** (same model as chat runs: `getActiveRuns` + `subscribeToRun(since=0)`). If the **backend dies mid-run**, the run is marked interrupted, partials stay readable, and the user re-runs. **No new durable worker/job infra** — matches the existing chat-run lifecycle.

### UI scope
- **D-07:** Ship a **thin, non-designed functional surface** (treat as `--skip-ui`, mirrors Phase 132): a "Run eval" control, a live case-by-case progress list, and a plain results readout — enough to drive and watch a real run end-to-end. **No polish, no UI-SPEC.** The designed Skill Evals panel stays **Phase 137** (PANEL-01, G-2). The thin surface must not pre-empt or constrain the 137 design.

### New persistence (this phase lays the eval-run tables Phase 132 deferred — D-09 there)
- **D-08:** Add the eval-run tables in **migration `080`** (079 is the latest applied). Shape (planner finalizes columns): an **`eval_runs`** table (FK `skill_version_id → skill_versions.id` per Phase-132 D-10 — the run is traceable to the exact instruction state; plus `skill_id`, `user_id`, `provider`, `model`, `status`, `created_at`) and an **`eval_results`** table (FK `eval_run_id`, FK `test_case_id → skill_test_cases.id`, a `variant` discriminator `with_skill` / `without_skill`, output text, per-result status + error, tokens). **Owner-only RLS + app-code `.eq("user_id", …)` as the real gate** (service-role bypasses RLS) — the 077/079 precedent. Apply via Supabase SQL editor, regen `full-schema.sql` (no-reset), commit both.

### Claude's Discretion
- **How an eval completion is driven through the thread-keyed loop** — `run_agent_loop` needs a `RunContext` with a `thread_id` + `run_id`. Whether to mint an ephemeral/throwaway thread per eval completion, or run eval-scoped without a persisted chat thread, is the researcher/planner's call (follow the `threads.py:1490` `RunContext` construction + the `skill_tuner_service.py` drive-without-fork precedent).
- Whether the two arms (with/without) for a case run **sequentially or concurrently** — live progress is per-case/variant either way.
- Exact `eval_runs` / `eval_results` columns, status enums, SSE event type names, and endpoint shapes — consistent with `runs.py` + `skill_tuner.py` conventions.
- Provider/model picker UI specifics in the thin surface.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement / scope contract
- `.planning/REQUIREMENTS.md` — EVAL-02 (this phase), the **D-14 red line** (never fork the shared Deep/agent-loop/provider path; provider differences stay at the gateway/adapter/sanitizer boundary), the **SC#10 mandate**, and the SEED-002 pre-work note resolved here.
- `.planning/ROADMAP.md` — Phase 133 section (goal + 4 success criteria); Phase 134 (EVAL-03/04) and Phase 137 (PANEL-01) for the scope fence.
- `.planning/seeds/SEED-002-skill-studio-milestone-prep.md` — catalog-injection-cost question (resolved by D-03/D-04).

### Phase 132 foundation (FK targets + RLS model — MUST honor)
- `.planning/phases/132-skill-versioning-eval-test-case-persistence/132-CONTEXT.md` — D-05..D-12: test-case binding, owner-only RLS, **stable FK targets D-10** (`eval_runs.skill_version_id → skill_versions.id`, results → `skill_test_cases.id`), run-records-the-version traceability (D-07).
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — the two tables + immutability trigger + RLS this phase FKs into.
- `backend/app/api/skill_test_cases.py` — owner-scoped CRUD precedent (app-code `.eq("user_id")` gate, service-role bypass).
- `backend/app/models/skill_test_case.py`, `backend/app/models/skill_version.py` — Pydantic precedent.

### Agent loop + provider gateway (REUSE read-only — D-14)
- `backend/app/services/agent_loop.py` — `run_agent_loop(ctx, emit=, emit_terminal=, spawn=, …)` (:1031, the single-completion driver), `RunContext` (:166), `AgentLoopResult` (:197), and the **skill-catalog injection block (:1174-1195)** + the `agent_mode == "explorer"` skip (the with/without lever).
- `backend/app/services/skill_tuner_service.py` — closest precedent for measuring skill behavior **without forking** the loop (reuses `LOAD_SKILL_POLICY` + `forced_emit`).
- `backend/app/services/provider_gateway/dispatcher.py` — `open_stream(provider, GatewayRequest)` (:87); `backend/app/services/provider_gateway/__init__.py` exports.
- `backend/app/config.py` — `MODEL_CAPABILITIES` (:228), `get_model_capability_async` (:654).

### SSE streaming + run buffer + persistence
- `backend/app/api/threads.py` — `_emit` (:152) / `_emit_terminal` (:169) → `run:{run_id}`; run-buffer keys `run:{run_id}` / `runs_by_thread:{thread_id}` / `runs:active`; the reference `RunContext` build + loop call site (:1490-1508); `_shielded_finalize` (:1574).
- `backend/app/api/runs.py` — consumer surface `GET /runs/{run_id}/stream?since=`, `DELETE /runs/{run_id}`, replay/synthetic-terminal logic.
- `supabase/migrations/035_runs_table.sql` — durable `public.runs` audit model (status enum, survives Redis TTL).
- `backend/app/db/runs.py` — `insert_assistant_message` + `finalize_run` durable path; `agent_loop.py:238/258` carrier-row-then-event pattern for partials surviving reload.
- `backend/app/main.py:446` — router-mount pattern (new eval router added here).

### Frontend reattach model
- `frontend/src/providers/StreamsProvider.tsx`, `frontend/src/stores/streamsStore.ts` — stream store.
- `frontend/src/lib/api.ts` — `subscribeToRun(runId, since)` (:503), `getActiveRuns(threadId)` (:848); reattach-on-reconnect at `frontend/src/hooks/useMessages.ts:81`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`run_agent_loop` (`agent_loop.py:1031`)** — drive one eval completion per arm by constructing a `RunContext` (mirror `threads.py:1490`) with the chosen provider/model and an `emit` callback. No edits to the loop.
- **SSE `_emit` + `run:{run_id}` buffer** — the eval run streams through the same Redis-stream + `GET /runs/{run_id}/stream` machinery the chat runs use; the frontend reattaches with the existing `getActiveRuns` + `subscribeToRun` flow.
- **`skill_test_cases` / `skill_versions` (migration 079)** — the run reads cases for a skill and FKs the run to a `skill_version_id`.
- **`skill_tuner_service.py`** — precedent for an eval-style service that reuses the loop's skill policy without forking it.

### Established Patterns
- **Owner-scoping:** app-code `.eq("user_id", …)` is the real gate (service-role bypasses RLS); RLS owner-only is defense-in-depth (079/077 precedent).
- **Skill injection lever:** catalog membership at `agent_loop.py:1174-1195` decides what skills are offered; `agent_mode == "explorer"` skips injection entirely → the natural "no skills" baseline (D-04).
- **Durable-vs-ephemeral run split:** Redis `run:{run_id}` is bounded/TTL'd; `public.runs` + persisted result rows are the durable record the reload reads (D-06).
- **Migrations:** apply via SQL editor, `bash scripts/regenerate-full-schema.sh` (no-reset), commit migration + full-schema together. Next = `080`.

### Integration Points
- **New eval router** mounted at `backend/app/main.py` (~:446) alongside `skill_test_cases.router` / `runs.router`.
- **New eval service** drives `run_agent_loop`; streams via `_emit`.
- **New tables** `eval_runs` + `eval_results` (migration 080) FK into `skill_versions.id` + `skill_test_cases.id`.
- **Thin frontend surface** consumes the existing run-stream client; no designed panel.
</code_context>

<specifics>
## Specific Ideas

- The honest A/B is a hard requirement: **target-skill-only WITH vs no-skills WITHOUT**, single variable. Do not "enrich" either arm with the rest of the catalog.
- Blocking I/O reminder: wrap `supabase-py` calls in `run_in_threadpool` inside async handlers (D-v2.5-01; SEED-097 backfill note).
- Multi-worker uvicorn is the default (`WORKER_COUNT=2`) — eval run state lives in Redis + DB, never in-process singletons (D-PRD-12).
- **SC#10 (MANDATORY):** this phase touches streaming + agent loop + provider routing + UI state, so VALIDATION.md must carry UAT rows across the 4 axes — cross-provider (OpenAI/Anthropic/Google/OpenRouter representative) × multi-tool × parallel-thread × long-history — authored in VALIDATION.md (not PLAN tasks). Deep Mode must stay byte-identical.
</specifics>

<deferred>
## Deferred Ideas

- **Multi-provider fan-out in one run** — results are already provider-keyed (D-02), so this is a later additive change, not part of 133.
- **Full token-by-token streaming of each completion** — revisit only if per-case status (D-05) feels insufficient in lived UAT.
- **Fully resumable runs (server-crash auto-resume)** — needs a durable job/worker model on top of multi-worker uvicorn; v3.3+ if ever.
- **Per-provider pass/fail verdict + side-by-side comparison UI + thumbs-up/down ratings** — Phase 134 (EVAL-03/04).
- **Designed Skill Evals panel** — Phase 137 (PANEL-01, G-2 sketch-gated).

None of the above are in scope for Phase 133.
</deferred>

---

*Phase: 133-eval-runner-with-skill-vs-without-skill*
*Context gathered: 2026-06-30*
