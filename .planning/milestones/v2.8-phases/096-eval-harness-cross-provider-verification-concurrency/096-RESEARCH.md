# Phase 096: Eval Harness + Cross-Provider Verification + Concurrency - Research

**Researched:** 2026-06-07
**Domain:** Verification engineering — cross-provider eval extension, CI structural gate, restart/resume UAT, concurrency fairness, frontend stream-cap
**Confidence:** HIGH (codebase claims verified by direct read; provider model currency MEDIUM — live `/models` validation is itself a phase deliverable)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CI gate semantics (EVAL-01)**
- **D-01 — Hybrid CI gate:**
  1. A **deterministic harness-workflow regression test with a fake/mock provider** added to real GitHub CI (`.github/workflows/backend-tests.yml`) — drives a full multi-phase workflow through the engine, catching structural breaks (phase sequencing, gate retries, whitelist enforcement, resume 2-phase writes) on every push. Free, never flaky, no secrets.
  2. The **live cross-provider eval stays operator-run** and becomes the **documented mandatory gate** for phase closure on any provider-touching phase (same standing as the 4-axis UAT recipe), with a greppable scoreboard diff. The script's localhost-hard-gate stays; no GitHub secrets for provider keys.

**Eval scope & curation (EVAL-01)**
- **D-02 — One max-coverage workflow per provider:** the eval drives a single workflow chosen to touch the most phase types (programmatic split → `llm_batch_agents` fan-out → `llm_agent` → `llm_single`), once per provider. The full native-7 × 5-phase-type × 4-workflow matrix is NOT re-run per eval — that breadth was proven live in 093 D-21 and stays the VALIDATION.md deep-check.
- **D-02a — Auto-answered `ask_user`:** the script answers the `llm_human_input` prompt via the same POST endpoint the panel uses — the F10 round-trip (broken twice: F10, BUG-260605-01) is robot-watched on every eval run.
- **D-03 — Provider matrix carried forward (D-089-05):** native-7 (openai, anthropic, google, deepseek, moonshot, zhipu, minimax) is the hard pass/fail bar; OpenRouter best-effort (recorded, never gating).
- **D-04 — Measure feature-fit, don't act on it:** the eval scoreboard is extended to persist a **per-provider capability table** (tool-use fidelity, workflow completion, retry counts, wall-clock) as a versioned artifact. Actual routing changes (per-feature provider defaults) are a deliberate separate pass — **deferred to v2.9**.
- **D-05 — Full-registry model curation:** curate `MODEL_CAPABILITIES` + Settings model lists (not just the eval PROVIDERS constant), validated against each provider's **live `/models` endpoint**, newest-first ordering with newest as default (standing operator preference). The registry is where the case-sensitive silent-downgrade trap lives (zhipu/minimax → structured-mode regression).

**Bug routing + restart UAT (EVAL-02)**
- **D-06 — BUG-260605-01 FOLDED as a fix** (not UAT-only): backend harness-failure cleanup (a run reaching terminal status clears/marks its pending `ask_user`) + frontend honesty (a card whose run is terminal renders expired/disabled; a 404 on submit surfaces a visible error, never silence). EVAL-02's restart-mid-`ask_user` UAT verifies the fix. Frontmatter updated (status=folded, folded_into=096).
- **D-07 — BUG-260603-01 stays open:** composer/send surface, no overlap with 096; SEED-055 holds the residual. re_open_trigger records the 096 review.
- **D-08 — Operator-driven restart smoke, script-assisted:** a helper script seeds the right workflow, signals exactly when to kill ("phase N is now `active` — restart now"), and after the operator restarts uvicorn asserts DB truth: no skipped phases, no double-applied side effects, `ask_user` prompt re-emitted. Operator runs the backend in a visible terminal (standing preference) — the human IS the restart mechanism; the robot owns setup + assertions. Kill points: mid-`programmatic`, mid-`llm_agent`, mid-`ask_user` (SC#4).

**Stream-cap behavior (CONC-01 frontend — approach locked 2026-05-30: frontend cap-live-streams)**
- **D-09 — Pool size 3:** the viewed thread ALWAYS holds a live stream + the **2 most-recently-viewed** background runs; max 3 held-open streaming fetches, leaving 3 of the browser's 6 per-host connections free for normal traffic. One configurable constant.
- **D-10 — Honest background indicator:** a capped-out background thread keeps its "running" pulse/spinner (run status is known from the runs list, not the stream) — **no live token progress, no fake activity**. Show what we know, never simulate what we don't.
- **D-11 — Switch-back reconcile:** snapshot fetch (`GET /threads/{id}/snapshot`) renders full current state instantly, then the live stream **re-attaches with replay from the Redis `run:{run_id}` buffer** (lossless reconnect is what the run-buffer was built for), evicting the least-recently-viewed background stream. <1s reconcile per SC#5.
- **D-11a — The cap trade-off is asserted, not apologized for:** with ≥4 concurrent runs, threads beyond the pool show NO live tokens until visited — a designed behavior. The 4-axis parallel-thread UAT row asserts this explicitly so a future phase doesn't "fix" it as a bug.

### Claude's Discretion
- Exact mock-provider design for the CI structural test (fixture vs fake gateway adapter).
- Capability-table artifact format (markdown vs JSON vs both) and storage location.
- Cross-tab GET <50ms measurement method + AnyIO threadpool budget verification approach (SEED-036a, SC#3).
- Helper-script UX details for the restart smoke (polling cadence, output format).
- LRU bookkeeping details for the stream pool, as long as PANEL-06 isolation + per-thread demux are preserved.

### Deferred Ideas (OUT OF SCOPE)
- **Feature-fit provider routing changes** (per-feature provider defaults driven by the D-04 capability table) → v2.9, as a deliberate decision pass once the measurement artifact exists.
- **BUG-260603-01** (silent send-drop) → stays open; dedicated composer/send-reliability fix when scoped (SEED-055 residual).
- **Live-eval GitHub Actions job** (manual-trigger workflow_dispatch with provider secrets) → possible later hardening of D-01; rejected for now (cost, secrets, provider flakiness, localhost-gate philosophy).
- **Playwright E2E revival** → SEED-049 (separate effort; explicitly NOT part of 096's CI gate).
- **Retrieval-quality eval fixtures** (bare-ID lookup, ID+intent-words, tabular-attribute correctness) → deliberately OUT of 096; parked in SEED-059/SEED-020; surfaces at the v2.9 `/gsd:new-milestone` sweep.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVAL-01 | `scripts/eval_cross_provider.py` extended to run a multi-phase workflow on all 6 native providers, asserting the locked phase sequence + correct tool round-trips; wired as the CI regression gate; model-ID curation pass | §Eval Extension Anatomy (kickoff via `workflow_definition_id`, DB assertion patterns, ask_user auto-answer path), §CI Mock-Provider Design (fake gateway adapter at `open_stream` seam), §Model Curation Findings (registry deltas: Opus 4.8 missing, MiniMax M3 missing, live `/models` validation method per provider) |
| EVAL-02 | 4-axis UAT scoreboard + uvicorn-restart-mid-workflow smoke per phase type (incl. mid-`ask_user`) + HARNESS-03 kill-and-resume verification | §Restart Smoke Design (kill points, DB-truth assertions via `workflow_phases`/`harness_audit`, startup-sweep mechanics at `main.py:237-242` + `resume_stranded_workflows`), §D-06 Fix Surface (the restart-mid-ask_user UAT doubles as the BUG-260605-01 verification), §Validation Architecture (scoreboard rows) |
| CONC-01 | `llm_batch_agents` bounded by `max_parallel_agents=5` composing with Redis-Lua cap 20; N=10 → ≤5 concurrent; cross-tab GET <50ms; AnyIO budget verified; BUG-260530-01 frontend stream-cap fix | §Fan-out Verification (semaphore at `phase_types.py:347`, N=10 via clause-split kickoff, DB-overlap measurement), §Latency + Threadpool Measurement (`GET /admin/backpressure` already exposes AnyIO borrowed/total), §Stream-Cap Implementation Map (5 `subscribeToRun` call sites, abort-is-silent semantics, eviction bookkeeping) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Provider-docs-first (evidence-based):** any provider-touching work researches that provider's OWN official docs first, then cross-checks against app behavior with real evidence (DB, logs, LangSmith, live UAT). Applied in §Model Curation Findings.
- **No LangChain/LangGraph** — raw SDK calls only. (No new orchestration deps; this phase adds zero runtime dependencies.)
- **Python backend uses `venv`** — all scripts run via `backend/venv/Scripts/python.exe` (the eval script already enforces this).
- **RLS everywhere** — new DB queries in eval/restart scripts stay owner-scoped + parameterized (the eval's `_COUNT_QUERIES` allowlist pattern).
- **SSE streaming, stateless completions** — the stream-cap fix must not alter the SSE vocabulary or shared chunk path.
- **Migrations:** numbered SQL under `supabase/migrations/`, applied via Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no reset). A new eval-coverage seed workflow needs migration 066+ (next free number — verify at plan time).
- **Settings live in `user_settings`/`app_settings`** — env vars for secrets/infra only.
- **Multi-worker uvicorn default (`WORKER_COUNT=2`)** — restart smoke and fan-out measurements must be valid under 2 workers (the workflow producer runs in ONE worker's process; the Redis-Lua cap is cross-worker).
- **UAT scoreboard recipe (MANDATORY):** 4-axis rows (cross-provider × multi-tool × parallel-thread × long-message) authored in VALIDATION.md, NEVER in PLAN.md tasks.
- **Guardrails:** `StreamsProvider.tsx` and `backend/app/api/threads.py` are G-5 hot-file-ledger files. threads.py G-5 currently FIRES ("extraction due") — this phase should touch threads.py **minimally or not at all** (the stream-cap is frontend-only; D-06 lands in `panel.py`/`runs.py`/`harness_engine.py`, not threads.py). G-2: no new visual surface is planned (D-10 keeps the existing pulse) — sketch not required, but if any new visible state is added to the run-status strip, load `Skill("sketch-findings-agentic-rag")` first.
- **Operator starts uvicorn in a visible terminal** — never `run_in_background`; this is what makes D-08's human-restart design natural.
- **Never write scratch files into `backend/`** (uvicorn --reload watched tree) — restart-smoke helper scripts live in `scripts/`.
- **Reported-bugs cross-check:** BUG-260605-01 and BUG-260530-01 both have `folded_into: "096"`; plan-phase must verify each is covered by at least one plan task; on close, flip `status: closed` + `verified_closed_by` only if no longer reproducing.

## Summary

Phase 096 is a **verification phase, not a feature phase** — ~80% of its substance is proving already-shipped machinery (091 engine, 092.5 gateway, 093 parity) trustworthy and making that proof permanent. The three genuinely new code artifacts are: (1) the eval script's workflow-mode extension + a CI structural test with a fake provider, (2) the frontend stream-cap (BUG-260530-01), and (3) the orphaned-ask_user fix (BUG-260605-01). Everything else is scripts, measurements, and UAT rows.

The codebase is unusually well-prepared for this phase. The eval script (`scripts/eval_cross_provider.py`, 702 lines) already drives the real `POST /threads/{id}/messages` route with per-request provider overrides, already covers native-8, and already emits a greppable scoreboard — the extension adds a workflow row type (kickoff via the existing `workflow_definition_id` body field), workflow-phase DB assertions, and a robot ask_user answer. The CI seam already exists: `provider_gateway.dispatcher.open_stream(provider, request)` is a clean injection point, and `tests/unit/test_085_task_service.py:562` already ships an `open_stream` stub builder. The AnyIO-threadpool measurement SC#3 demands is **already an endpoint** — `GET /admin/backpressure` returns `anyio_threadpool_depth.borrowed/total`, `redis_active_runs`, and pg-pool usage. The stream-cap has exactly 5 `subscribeToRun` call sites in `StreamsProvider.tsx`, and `api.ts` treats AbortError as a silent return (no `onTerminal` fired) — meaning eviction-by-abort is safe by construction provided the evictor does its own bookkeeping.

Two findings will surprise the planner if not flagged early. First, **no single seed workflow covers all 5 phase types** — `literature_review` covers programmatic+batch+single, `doc_qa_human` covers agent+human_input+single; D-02's "one max-coverage workflow" implies a NEW 5-type eval seed (and there is no workflow-authoring API — only `GET /workflows/published` — so it ships as a migration). Second, the per-request **model** override does NOT reach harness phases: the harness ctx model resolves via `resolve_workflow_ctx_model(user_settings)`, which ignores `body.model`; the eval's per-provider workflow rows will run on the per-provider default-model table at `config.py:596-603`, making THAT table a first-class curation target.

**Primary recommendation:** Build the phase as four independent work streams — (A) eval extension + new eval seed migration + CI fake-gateway test, (B) D-06 ask_user fix (backend cleanup + `/pending` liveness filter + PendingAskCard honesty), (C) frontend stream-cap with thread-keyed LRU-3 pool, (D) measurement scripts (restart smoke, fan-out/latency probe) — then converge in VALIDATION.md where the 4-axis scoreboard, restart smokes, and curation evidence are operator-driven.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Eval workflow drive + assertions | Operator script (`scripts/`) | Backend HTTP API + local Postgres | Eval must exercise the REAL route (Pitfall 2 in the script's own header); DB is the assertion truth |
| CI structural regression test | Backend test suite (`backend/tests/`) | GitHub Actions (`backend-tests.yml`) | Deterministic, no secrets; runs in the existing pytest job — no workflow YAML change strictly required |
| ask_user auto-answer (D-02a) | Operator script | Backend `POST /runs/{id}/ask_user_response` | Same endpoint the panel uses — robot-watches the F10 round-trip |
| Restart smoke (D-08) | Operator (kills/restarts uvicorn) + helper script | Backend startup sweep (`main.py` lifespan → `resume_stranded_workflows`) | Human is the restart mechanism; robot owns seed + DB-truth assertions |
| Batch fan-out bound (CONC-01 backend) | Backend (`harness/phase_types.py:347` semaphore) | Redis (Lua global cap 20) | Already shipped in 091 — this phase only MEASURES it |
| Latency/threadpool measurement | Operator script polling HTTP | Backend `GET /admin/backpressure` | The four backpressure signals already exist as JSON |
| Stream-cap (BUG-260530-01) | Frontend (`StreamsProvider.tsx`) | Backend `GET /threads/{id}/snapshot` (unchanged) | Operator-locked approach: frontend cap-live-streams; backend untouched |
| Background "running" indicator (D-10) | Frontend (runs-list state, not stream presence) | — | Honesty rule: status from `snapshot.active_runs`/store, never simulated tokens |
| Orphaned ask_user cleanup (D-06 backend) | Backend (`harness_engine.py` terminal sites + `panel.py` /pending filter) | DB (`workflow_runs.status`, `threads.active_workflow_run_id`) | Terminal-status cleanup for new runs + liveness filter for historical orphans |
| 404-on-submit honesty (D-06 frontend) | Frontend (`PendingAskCard.tsx`) | — | The 404 is CORRECT (IDOR-safe anchor check); only the UX hides it |
| Model curation (D-05) | Backend registry (`config.py`) + Settings data | Provider live `/models` endpoints | Registry is code; Settings model lists are `app_settings` data |

## Standard Stack

### Core (all already in the repo — zero new dependencies)

| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | repo-pinned (backend/requirements.txt) | CI structural test | Existing suite + `mock_asyncpg_pool` fixture + harness test scaffolds |
| psycopg2 + RealDictCursor | repo-pinned | Eval/restart-script DB assertions | The eval + `observe-run.py` pattern; parameterized, allowlisted queries |
| requests | repo-pinned | Eval/probe HTTP driving | Already the eval's HTTP layer |
| python-dotenv | repo-pinned | `backend/.env` load (names only, never values) | `load_env()` pattern in eval script |
| GitHub Actions + docker-compose Redis | existing | D-01 CI home | `backend-tests.yml` already boots real Redis (no fakeredis — Streams drift) |
| vitest + @testing-library | repo-pinned | Stream-cap + PendingAskCard unit tests | Existing frontend test substrate; 16-failure baseline cluster documented (prove net-new=0 via git stash, the 095.1 pattern) |

### Supporting

| Asset | Location | Purpose | When to Use |
|-------|----------|---------|-------------|
| `_make_open_stream_stub` | `backend/tests/unit/test_085_task_service.py:562` | Fake-gateway stub builder | Seed for the D-01 fake provider (generalize, don't duplicate) |
| `mock_asyncpg_pool` fixture | harness test conftest | DB-less engine runs in CI | D-01 structural test |
| `GET /admin/backpressure` | `backend/app/api/admin.py:52` | AnyIO borrowed/total, redis_active_runs, pg pool, per-worker run count | SC#3 measurement — dev/local is fail-open for any authenticated user |
| `scripts/observe-run.py`, `scripts/capture_run_events.py` | `scripts/` | env-load + DB polling patterns | Restart-smoke helper + fan-out probe reuse |
| 093 D-21 re-UAT scoreboard | `.planning/phases/093-harness-cross-provider-parity/` | VALIDATION.md format model | EVAL-02 scoreboard authoring |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fake gateway adapter (D-01) | Recorded SSE fixture replay | Fixtures rot as the event vocabulary evolves; a fake adapter speaking the canonical `GatewayEvent` schema exercises the REAL consumer drain path and stays valid as long as the contract holds |
| Mock asyncpg pool in CI | Real Postgres service container + `full-schema.sql` | Closes the 093 "mock blind spot" for DB too, but heavier CI, schema-apply maintenance; recommend as OPTIONAL hardening, not the D-01 baseline |
| New eval seed migration (5-type workflow) | Run 2 seed workflows per provider (literature_review + doc_qa_human) | 2-per-provider doubles wall-clock and API spend ×7 providers; a single 5-type seed satisfies D-02's "one max-coverage workflow" verbatim AND gives D-08 one canonical restart target |
| Polling `workflow_phases` via psycopg2 | Listening to SSE phase events | DB is durable truth (the script's standing posture); SSE adds parser complexity for no assertion value |

**Installation:** none — `pip list`/`npm ls` deltas are zero. [VERIFIED: codebase — eval script + tests import only existing deps]

## Architecture Patterns

### System Architecture Diagram

```
                        ┌──────────────────────────── EVAL-01 (operator-run, localhost-gated) ───────────────────────────┐
                        │                                                                                                  │
  eval_cross_provider.py│  POST /threads (create) ──► POST /threads/{id}/messages                                         │
   per native-7 provider│        {content, provider: P, workflow_definition_id: <eval seed>}                              │
                        │                                   │                                                             │
                        │                                   ▼                                                             │
                        │   threads.py send_message ── create_workflow_run (anchor set) ── run_workflow(engine)           │
                        │                                   │                                                             │
                        │        programmatic split ─► llm_batch_agents (Semaphore≤5) ─► llm_agent ─► llm_human_input ─► llm_single
                        │                                   │                                  │                          │
                        │   script polls workflow_phases ◄──┘          script polls /pending ──┘                          │
                        │   (psycopg2, parameterized)                  POST /runs/{wf_run_id}/ask_user_response (D-02a)   │
                        │                                   │                                                             │
                        │   scoreboard row: phase sequence ✓ tool round-trips ✓ wall-clock, retries → capability table    │
                        └──────────────────────────────────────────────────────────────────────────────────────────────────┘

   ┌─────────── D-01 CI (every push, no secrets) ───────────┐    ┌────────── CONC-01 frontend (browser) ──────────┐
   │ pytest: fake adapter monkeypatches                      │    │ StreamsProvider: subscriptionsRef Map           │
   │   provider_gateway open_stream / phase_types seams      │    │   pool = {viewed thread} ∪ {2 MRU threads}      │
   │   + mock_asyncpg_pool (+ real Redis from compose)       │    │   evict: controller.abort() (SILENT — api.ts)   │
   │ asserts: sequencing, gate retry, whitelist refusal,     │    │   keep lastSeenOffsetRef cursor                 │
   │   2-phase writes, resume sweep                          │    │ switch-back: GET /snapshot ─► subscribeToRun    │
   └─────────────────────────────────────────────────────────┘    │   ?since=<cursor> (Redis run:{id} replay)       │
                                                                  └─────────────────────────────────────────────────┘
```

### Pattern 1: Eval Extension Anatomy (EVAL-01)

**What:** Add a `workflow` row type to the existing eval, reusing its auth/localhost-gate/scoreboard plumbing verbatim.

**Verified mechanics** [VERIFIED: codebase reads 2026-06-07]:
- Kickoff: `POST /threads/{id}/messages` body accepts `workflow_definition_id` (`threads.py:835`); the frontend sends it the same way (`api.ts:430-445`). The eval already sends `{content, provider, model}` — adding the field is additive.
- Provider steering: `body.provider` → `override_provider(_user_settings, body.provider)` (`threads.py:917-918`) → flows into the harness ctx (`user_settings=user_settings` at `threads.py:1248`). **Works per provider.**
- Model steering: **does NOT flow.** `wf_ctx.model = resolve_workflow_ctx_model(user_settings)` (`threads.py:1255`) calls `resolve_sub_agent_model_safely(user_settings, override_model=None)` — `body.model` is never consulted; `override_provider` swaps `available_models` but NOT `llm_model` (`user_settings.py:513-524`), so a cross-provider stale `llm_model` falls back to the per-provider default table at `config.py:596-603`. **The harness eval's effective model per provider = that defaults table.** The eval PROVIDERS constant's model column is Deep-mode-only unless the plan adds a model path.
- Run polling: `workflow_runs.status` (terminal: completed/failed/cancelled per `threads.py:815`) + `workflow_phases` per-phase status — extend the eval's `_COUNT_QUERIES`-style allowlist with constant query strings, `%s`-parameterized.
- Phase-sequence assertion: every phase row reaches `completed` (or `skipped` only where the definition routes it), `harness_audit` has exactly one `phase_completed` event per phase (INSERT-only trail = double-execution detector).
- ask_user detection: same JSONB containment the panel uses — `tool_calls @> '[{"kind":"ask_user_prompt"}]'` without a matching `ask_user_response` (`panel.py:122-137`); the prompt payload's `run_id` field carries the **workflow_run id** for harness prompts. POST answer to `/runs/{workflow_run_id}/ask_user_response` with the prompt's `tool_call_id` (the F10 fallback at `runs.py:521-567` resolves it owner-scoped + anchor-confirmed).
- Timing: answer while the run is live (anchor == run id). Post-terminal answers 404 by design — the eval should poll `/pending` (or DB equivalent) every few seconds during the run.

**Max-coverage workflow:** no seed covers all 5 types [VERIFIED: migration 061 — `research_summarize` (agent→single), `plan_execute_verify` (single→agent→single), `literature_review` (programmatic→batch→single), `doc_qa_human` (agent→human_input→single)]. There is **no authoring API** (only `GET /workflows/published` — `api/workflows.py`), so a new published seed `eval_coverage` (programmatic `split_topic` → `llm_batch_agents` → `llm_agent` → `llm_human_input` → `llm_single`) ships as migration 066+ (SQL-editor apply + full-schema regen). This one definition serves D-02, D-02a, AND D-08 (one canonical restart target with all kill points).

### Pattern 2: CI Mock-Provider Design (D-01 discretion — recommendation)

**Recommendation: fake gateway adapter, not fixtures.** The seam is `app.services.provider_gateway.dispatcher.open_stream(provider, request) -> (AsyncIterator[GatewayEvent], CallingMode)` [VERIFIED: dispatcher.py:75-115]. The harness consumes it through `task_service._stream_one_iteration` (rewired in 093-02); harness tests already mock at `phase_types._stream_one_iteration` / `phase_types.run_task_sub_agent` (`test_harness_engine.py:554-699`), and `test_085_task_service.py:562` ships `_make_open_stream_stub`.

**Mock at the GATEWAY seam (lower), not the executor seam (higher):** 093's lesson was that executor-level mocks passed while live broke — a scripted fake provider injected at `open_stream` lets the REAL `task_service` drain loop, REAL engine, REAL gate retries, and REAL `dispatch_tool` whitelist guard run. The fake emits canonical `GatewayEvent`s (schema in `provider_gateway/events.py`) from a per-phase script: text deltas, a whitelisted tool call, a NON-whitelisted tool call (asserts clean refusal `tool_result`), a gate-failing output then a passing retry (asserts bounded retry), and a finish event.

**Infra in CI:** real Redis (compose, already in `backend-tests.yml`), `mock_asyncpg_pool` for DB (Supabase-dependent integration tests are conditionally skipped in CI by existing convention). Resume 2-phase-write coverage: drive `run_workflow`, interrupt between `mark_phase_active` and `complete_phase` (cancel the task at a scripted event), then call `resume_stranded_workflows` against the same mock pool state — the harness resume tests (`test_harness_resume.py`) already model this; the D-01 test composes them into ONE full-workflow journey with a greppable name (e.g. `test_096_ci_workflow_regression`). No `backend-tests.yml` edit is required (the file already triggers on `backend/**`), though adding a dedicated `-k` smoke step is an option for log legibility.

**Operator live gate (D-01 part 2):** document in VALIDATION.md + the eval script header: "mandatory for phase closure on any provider-touching phase" with the `EVAL_ROW`/`EVAL_SUMMARY` grep-diff ritual.

### Pattern 3: Stream-Cap Implementation Map (D-09/D-10/D-11)

**Current state** [VERIFIED: StreamsProvider.tsx (2,517 lines) + api.ts]:
- `subscriptionsRef = useRef<Map<runId, AbortController>>` (`:975`); per-thread mirror `subscriptionsByThread` in the zustand store (added/removed in lockstep).
- Streams are opened at **5 call sites**: producer re-subscribe (`:1062`), reconcile attach (`:1362`), reconcile transient re-attach (`:1315`), sendMessage attach (`:1654`), sendMessage transient re-attach (`:1595`).
- Cleanup happens ONLY in `onTerminal` wrappers — background runs hold their fetch across thread switches (the BUG-260530-01 mechanism).
- `lastSeenOffsetRef = Map<runId, cursor>` advances per event (`onCursor`); reconcile seeds missing cursors from `snapshot.since_cursors` (client cursors win — `:1218-1222`).
- **AbortError is a silent return** in `subscribeToRun` (`api.ts:516-517`) — no `onTerminal` fires, so eviction-by-abort cannot mis-flip a placeholder to done/failed. BUT the evictor must do the bookkeeping the onTerminal wrapper would have done: delete from `subscriptionsRef` + `_removeRunFromThread(subscriptionsByThread)`. **Keep `lastSeenOffsetRef`** — the cursor is the D-11 replay substrate.
- Switch-back already works: `setViewingThread` (sole writer of `activeThreadIdRef`, `:1134-1161`) fires `reconcile(threadId)` → `getSnapshot` → re-subscribes all `active_runs` with retained cursors. D-11's "snapshot then replay-attach" is the EXISTING reconcile path — the only new work is eviction.

**LRU shape (discretion — recommendation):** key the pool by THREAD, not run (D-09's wording: viewed thread + 2 most-recently-viewed background threads). One module-level constant (e.g. `STREAM_POOL_SIZE = 3`). Maintain an MRU thread list in a ref updated by `setViewingThread`. A single helper (e.g. `enforceStreamPool(viewedThreadId)`) computes the keep-set = `{viewed} ∪ first 2 of MRU minus viewed` and aborts every `subscriptionsRef` entry whose thread (via `subscriptionsByThread` reverse lookup) is outside it. Call it from `setViewingThread` AFTER reconcile starts, and gate the 5 open sites: opening a stream for a thread outside the keep-set is skipped (background sends: the send's thread is the viewed thread at send time, so in practice only navigation triggers eviction). PANEL-06: pool bookkeeping lives in refs; `subscriptionsByThread` store writes already happen on every subscribe/unsubscribe today, and chat message selectors don't read it — verify with the existing PANEL-06 isolation test pattern (zero chat re-renders on pool churn).

**D-10:** background "running" indicators must derive from `streamingThreads` / `snapshot.active_runs` / runs-list state — audit any component that keys a spinner on `subscriptionsByThread` membership (that membership now under-counts by design). D-11a: author the UAT row asserting "≥4 concurrent → unwatched threads show pulse but NO tokens until visited — EXPECTED."

### Pattern 4: Restart Smoke Design (D-08)

**Startup sweep mechanics** [VERIFIED: `main.py:237-242` lifespan → `resume_stranded_workflows(pool, redis)`; `harness_engine.py:1085-1180`]: on boot, find resumable runs; a phase left `active` re-runs from the top (2-phase write — `mark_phase_active` before work, `complete_phase` only after durable output); a pending `llm_human_input` re-SUBSCRIBEs + re-emits its prompt (`resume_pending_prompt`); a CAS claim (091-08 / migration 062) prevents double-resume across the 2 workers; the resume finalizer always terminalizes the producer shell.

**Helper script shape (discretion):** `scripts/restart_smoke.py` — reuse the eval's env-load + auth + psycopg2 plumbing. Flow: (1) create thread, kick off `eval_coverage` (or `doc_qa_human` for the ask_user point) with a `--kill-at {programmatic|llm_agent|ask_user}` arg; (2) poll `workflow_phases` (~0.5s cadence) until the target phase is `active`; print an unmistakable banner: `>>> PHASE '<slug>' IS ACTIVE — KILL THE BACKEND NOW (Ctrl+C in the uvicorn terminal) <<<`; (3) poll the backend health endpoint until it's back (operator restarts in their visible terminal); (4) assert DB truth: no phase skipped (statuses), `harness_audit` has exactly ONE `phase_completed` per completed phase (double-side-effect detector), side-effect row counts (e.g. `workspace_files`, sub-agent `runs` count) not duplicated, and for ask_user: a fresh prompt emission exists post-restart; (5) for the ask_user case, answer via POST and assert the run completes (this run IS the BUG-260605-01 fix verification — after restart the prompt re-renders AND the POST reaches the engine).

**Kill-point honesty:** mid-`programmatic` is a sub-second window (`split_topic` is pure Python) — the operator cannot reliably kill inside it. Plan options: (a) assert the resume-from-`active`-programmatic path via the CI test (deterministic cancel between 2-phase writes) and let the LIVE smoke kill "at the programmatic→batch boundary" best-effort, or (b) register a deliberately slow `eval_slow_step` programmatic fn (sleep ~20s) in the eval seed. (b) gives a REAL mid-programmatic kill for SC#4 — recommend (b); the registry decorator (`programmatic.py:44`) makes it a ~10-line addition, and it lives only in the eval seed workflow.

### Pattern 5: D-06 Fix Surface (BUG-260605-01)

[VERIFIED: bug report + code reads]
- **Backend cleanup (new runs):** the terminal sites in `harness_engine.py` — `fail_run` (`:769-782`), missing-skip-target (`:802-812`), the resume finalizer (`:1141-1163`), and the cancel path — currently clear the anchor but never resolve the pending prompt. Fix: at terminal-status write, mark/resolve any outstanding ask_user prompt for that run (e.g. insert the matching `ask_user_response`-shaped resolution row with a `kind` marking expiry, OR an `expired` marker the /pending query excludes).
- **Backend filter (historical orphans):** `panel.py:103-156` `/pending` returns any prompt without a response row — old threads ALREADY contain orphans that cleanup-on-terminal will never touch. Add a liveness filter: exclude prompts whose `tool_calls->0->>'run_id'` resolves to a `workflow_runs` row with terminal status OR ≠ the thread's `active_workflow_run_id` (Deep prompts — `runs`-keyed — need the equivalent terminal-status check on `runs`). Recommend BOTH cleanup + filter; the filter alone closes the user-visible bug for all history.
- **Frontend honesty:** `PendingAskCard.tsx` — (1) the submit `catch {}` (`:216-219`) swallows the 404 silently → surface "This prompt has expired — the run is no longer active" (api's `ApiError` carries `.status`; `answerAskUser` error path needs the status preserved — verify at plan time) and roll back the optimistic state; (2) the countdown seeds `useState(timeout_seconds)` on mount (`:168`) — the misleading fresh 5:00 — derive remaining from `created_at` (GET-reconciled prompts carry it, `panel.py:154`) and render the existing calm `.expired` state when elapsed; SSE-path prompts without `created_at` are genuinely fresh (emission time ≈ mount time), so the fallback is honest.
- **IDOR posture unchanged:** the 404-never-403 anchor-confirm logic in `runs.py` is CORRECT and must not be weakened — honesty comes from filtering + error surfacing, never from a new existence-leaking response.

### Pattern 6: Fan-out + Latency Measurement (CONC-01 / SC#3)

- **N=10 fan-out:** `split_topic` has NO cap — it splits on `;`/newlines/" and "/" vs " (`programmatic.py:97-114`), so a kickoff prompt with 10 semicolon-separated sub-topics yields exactly N=10 branches into `asyncio.Semaphore(phase.config.max_parallel_agents)` (`phase_types.py:347`, default 5 from `harness.py:72`).
- **≤5-concurrent proof:** post-hoc DB interval analysis — each branch creates a sub-agent `runs` row; compute max pairwise overlap of `(started_at, completed_at)` windows for the 10 sub-runs (a ~20-line script assertion: max overlapping ≤ 5). Supplement with live sampling: poll `GET /admin/backpressure` (`redis_active_runs`) + the Redis `tasks:global:active` counter every ~1s during the batch phase.
- **Cross-tab GET <50ms (discretion — recommendation):** a probe loop (requests, separate thread) hitting `GET /threads/{other_thread_id}/snapshot` every ~500ms for the duration of the batch phase, recording wall-clock latencies; assert p95 < 50ms. Probe from a direct HTTP client, NOT a browser — this measures **backend starvation** (the SC#3 claim); browser connection-pool behavior is the separate stream-cap UAT. Caveat: `/snapshot` of an idle thread short-circuits before Redis (`threads.py:418-423`) — also probe one endpoint that exercises the threadpool (e.g. `GET /threads` list via supabase-py) for a representative reading.
- **AnyIO budget (discretion — recommendation):** `GET /admin/backpressure` already exposes `anyio_threadpool_depth: {borrowed, total}` (`admin.py:64-67`; dev/local fail-open auth). Record `total` (the live budget — AnyIO default 40 tokens unless raised) and peak `borrowed` during the N=10 batch + probe run; the SC#3 "verified before sizing defaults" deliverable = a documented reading in VALIDATION.md (e.g. "total=40, peak borrowed=N under N=10 fan-out → max_parallel_agents=5 default safe / not safe"). Multi-worker note: each uvicorn worker has its own threadpool; the probe + the workflow may land on different workers — record `per_worker_run_count` from the same response to interpret readings.

### Anti-Patterns to Avoid

- **Mocking at the executor seam for the CI gate** — repeats the 093 mock blind spot; mock at `open_stream` so engine + task_service + dispatch_tool run real.
- **Evicting streams by deleting cursors** — `lastSeenOffsetRef` is the replay substrate; eviction deletes the controller + subscription maps ONLY.
- **Touching `threads.py` for the stream-cap or D-06** — G-5 fires on it; the fix surfaces are frontend / `panel.py` / `runs.py` / `harness_engine.py`.
- **Measuring cross-tab latency from the browser** — conflates the HTTP/1.1 6-connection cap (the bug being fixed) with backend starvation (the thing SC#3 measures).
- **Letting the eval mutate global settings per provider** — the per-request `provider` override exists precisely to avoid cross-test bleed; keep it.
- **Authoring UAT rows in PLAN.md** — VALIDATION.md only (CLAUDE.md mandatory recipe).
- **Printing secret values anywhere** — presence/absence only (the eval's `report_env_presence` discipline extends to all new scripts).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Eval env/auth/DB plumbing | New dotenv/psycopg2/token code | `eval_cross_provider.py` helpers (`load_env`, `get_bearer_token`, `connect_db`, `wait_for_run`) | Localhost hard-gate + secrets discipline already audited (T-088-02-*) |
| Fake provider event stream | A bespoke fake SSE server | `GatewayEvent` schema (`provider_gateway/events.py`) + `_make_open_stream_stub` pattern | Speaks the canonical contract the real consumer drains |
| Threadpool introspection | A new diagnostic endpoint | `GET /admin/backpressure` | Ships all four signals since Phase 078; additive-only JSON |
| Lossless stream re-attach | A resume protocol | Redis `run:{run_id}` replay + `since` cursor + `getSnapshot` | Built in 061/075 exactly for this |
| Pending-prompt detection | New SQL shapes | `panel.py` JSONB containment + NOT EXISTS pattern | Proven, RLS-postured |
| Double-execution detection | Custom side-effect ledger | `harness_audit` INSERT-only trail | One `phase_completed` per phase == no double-apply |
| Restart-resume machinery | Anything | `resume_stranded_workflows` + CAS claim (migration 062) | The thing being VERIFIED, not built |

**Key insight:** this phase's deliverables are mostly *proofs over existing machinery* — every time a plan task wants new runtime code, ask whether a script + an existing endpoint can prove the same thing.

## Model Curation Findings (D-05)

**Registry home:** `MODEL_CAPABILITIES` at `backend/app/config.py:186-273`; context budgets `MODEL_CONTEXT_DEFAULTS` (`config.py:66-126`); per-provider fast defaults dict near `config.py:596-603` (the table harness eval rows will actually use); provider base URLs `_PROVIDER_BASE_URLS` (`config.py:10-20`); Settings model lists live as `available_models` data in `app_settings` rows (not code). The eval `PROVIDERS` constant (`eval_cross_provider.py:68-79`) is a fourth curation target. [VERIFIED: codebase]

**The silent-downgrade trap, current severity:** since Phase 075.3, a registry-miss no longer forces structured mode — `_NATIVE_TOOL_PROVIDERS` includes deepseek/moonshot/minimax/zhipu, and the inference patterns (`config.py:288-299`) are case-INSENSITIVE (`^minimax-`, `^glm-`), so a mis-cased ID now infers `native_tools=True` (`config.py:307-321`). The trap is narrower than the memory note implies, BUT inferred entries get conservative defaults (8192 max_output_tokens, 300s timeout, no `max_tools`), and any ID matching NO pattern falls to the ollama bucket (`native_tools=False`) — registry registration still matters. [VERIFIED: config.py read]

**Per-provider current state vs registry (2026-06-07):**

| Provider | Registry top | External signal (2026-06) | Curation action | Live `/models` validation |
|----------|-------------|---------------------------|-----------------|---------------------------|
| openai | `gpt-5.5` (registered) | GPT-5.5 (Apr 2026) is the flagship, id `gpt-5.5` [CITED: artificialanalysis.ai/articles/openai-gpt5-5-is-the-new-leading-AI-model] | Verify mini/nano 5.5 tiers exist; newest-first default; note registry's gpt-5.5 timeout=300s vs flagship-tier 600s convention | `GET https://api.openai.com/v1/models` (Bearer) |
| anthropic | `claude-opus-4-7` | **Claude Opus 4.8 released 2026-05-28 — NOT registered** [CITED: artificialanalysis.ai + mindstudio.ai GPT-5.5 vs Opus 4.8 comparisons] | Add Opus 4.8 (verify exact ID via live list); also register the `claude-haiku-4-5` ALIAS the eval uses (only the dated `claude-haiku-4-5-20251001` is registered — alias currently rides inference) | `GET https://api.anthropic.com/v1/models` (x-api-key + anthropic-version) |
| google | `gemini-3.5-flash`, `gemini-3.1-pro-preview` | Gemini 3.1 Pro GA (Feb 2026) [CITED: albato.com/mindstudio comparisons] | Check whether GA id `gemini-3.1-pro` superseded `-preview`; fill omitted `max_output_tokens` for 3.x rows once GA specs published | `GET https://generativelanguage.googleapis.com/v1beta/models?key=` (native) or `/v1beta/openai/models` (compat base the app uses) |
| deepseek | `deepseek-v4-flash`/`-pro` | V4 (Mar 2026) still current; `deepseek-chat`/`-reasoner` deprecated 2026-07-24 [CITED: api-docs.deepseek.com/quick_start/pricing + news260424] | Confirm V4 IDs; plan removal/flag of the two deprecating IDs before 2026-07-24 | `GET https://api.deepseek.com/models` [CITED: api-docs.deepseek.com/api/list-models] |
| moonshot | `kimi-k2.6` | K2.6 (Apr 2026, 256K ctx) still flagship [CITED: platform.kimi.ai/docs/models + deepinfra/miraflow overviews] | Fix stale comment "api.moonshot.cn" (actual base: api.moonshot.ai); context note: K2.6 = 256K (registry caps 200K — fine) | `GET https://api.moonshot.ai/v1/models` (Bearer) |
| zhipu | `glm-5.1` | GLM-5.1 still latest flagship [CITED: docs.z.ai-derived listings via mastra.ai/docs.continue.dev] | Re-validate all 7 IDs against live list (D-089 method, only 8 days stale) | `GET https://api.z.ai/api/paas/v4/models` (Bearer) — endpoint proven live at D-089 curation [VERIFIED: config.py comments "all 7 from live /models 2026-05-30"] |
| minimax | `MiniMax-M2.7` | **MiniMax M3 listed in official API overview — NOT registered** [CITED: platform.minimax.io/docs/api-reference/api-overview] | Add M3 (verify exact PascalCase ID via live list — API is case-sensitive); keep the int'l host | `GET https://api.minimax.io/v1/models` (Bearer) |
| openrouter (best-effort) | `z-ai/glm-5.1` etc. | not gating (D-03) | refresh opportunistically | `GET https://openrouter.ai/api/v1/models` (public) |

**Method (the actual deliverable):** a curation script or documented ritual — for each provider, hit the live `/models` endpoint with the operator's key (names-only output, never key values), diff against `MODEL_CAPABILITIES` keys + Settings `available_models`, apply newest-first ordering with newest as default. External-signal rows above are MEDIUM confidence (secondary sources); the live `/models` pass is the authoritative check and is itself SC#1's "curation pass."

## Common Pitfalls

### Pitfall 1: Eval model column silently ignored for harness rows
**What goes wrong:** the eval reports "openai/gpt-5.4-mini workflow PASS" but the harness actually ran the per-provider default from `config.py:596-603`.
**Why:** `resolve_workflow_ctx_model` ignores `body.model` (verified above).
**How to avoid:** assert the ACTUAL model from the sub-agent `runs.model` rows in the scoreboard (the 093-08 work guarantees correct per-provider models there); print effective model per row. Decide at plan time: accept defaults-table models (curate it) vs add an explicit model path.
**Warning signs:** scoreboard model column ≠ `runs.model` in DB.

### Pitfall 2: Auto-answering ask_user races the terminal status
**What goes wrong:** the robot answers after a gate failure terminalizes the run → 404 → row marked FAIL for the wrong reason.
**How to avoid:** poll both the pending prompt AND `workflow_runs.status`; treat "terminal before prompt answered" as its own diagnostic outcome; generous-but-bounded answer window.

### Pitfall 3: Eviction abort without bookkeeping leaks ghost subscriptions
**What goes wrong:** `controller.abort()` returns silently (api.ts:517 — no onTerminal), so `subscriptionsRef`/`subscriptionsByThread` still claim the run is subscribed; reconcile's `subscriptionsRef.has(run_id)` short-circuit (`:1259`) then SKIPS re-attach on return — the thread never reattaches.
**How to avoid:** the eviction helper must delete the map entries itself (the exact bookkeeping the onTerminal wrapper does at `:1051-1059`). Unit-test: evict → return to thread → reconcile re-subscribes.

### Pitfall 4: Killing uvicorn mid-`programmatic` is humanly impossible
**What goes wrong:** `split_topic` completes in microseconds; the operator can never land the kill inside the 2-phase write window → SC#4's mid-`programmatic` cell silently becomes "didn't really test it."
**How to avoid:** the slow eval-seed programmatic fn (Pattern 4 option b), or explicitly cover the mid-programmatic window deterministically in the CI test and document the live smoke as boundary-kill. Don't fake it.

### Pitfall 5: CI test flakes on real Redis timing
**What goes wrong:** the structural test subscribes/publishes against compose Redis; ask_user pub/sub waits can hang CI.
**How to avoid:** for the CI workflow journey, script the human-input phase with a pre-published answer or mock `subscribe_for_response` ONLY (the one seam where determinism beats realism — its real path is covered by the operator restart smoke); keep `asyncio.wait_for` bounds on every await.

### Pitfall 6: `/pending` liveness filter breaks Deep-mode prompts
**What goes wrong:** filtering by `workflow_runs` status excludes Deep ask_user prompts (runs-keyed, no workflow_runs row) → live Deep prompts vanish from the panel.
**How to avoid:** branch the filter: workflow_run-id prompts check `workflow_runs.status` + anchor; runs-id prompts check `runs.status` (`streaming` = live). Add tests for both ID namespaces (the F10 dual-namespace is exactly where this broke twice before).

### Pitfall 7: Frontend/vitest + backend pytest baselines misread as regressions
**What goes wrong:** the frontend has a documented ~16-failure pre-existing cluster, `tsc -b` baseline 37; the backend full suite has a large pre-existing failure baseline (093-08 recorded 111 failed/1119 passed). A naive "all green" gate is unachievable; a naive count compare hides net-new breaks.
**How to avoid:** the 095.1 git-stash baseline-proof pattern: prove net-new=0 in the touched surface against the pre-plan commit.

### Pitfall 8: Stream-cap UAT run on too few runs
**What goes wrong:** with <6 concurrent streams the connection pool never saturates and SC#5 "passes" vacuously.
**How to avoid:** the UAT row seeds ≥6 concurrent active runs (6 threads × 1 long-running prompt — e.g. `execute_code` sleep tasks), confirms the pre-fix stall would apply (6 streams > pool 3 → 3 evicted), then asserts switch reconcile <1s with DevTools network evidence.

## Code Examples

### Driving a harness workflow per provider (eval extension)
```python
# Source: threads.py:835 + api.ts:430-445 (verified request shape)
resp = requests.post(
    f"{base_url()}/threads/{thread_id}/messages",
    headers=_auth_headers(token),
    json={
        "content": "Compare A; B; C",                    # kickoff_prompt → split_topic input
        "provider": provider,                            # flows to harness via override_provider
        "workflow_definition_id": eval_coverage_def_id,  # harness kickoff (MODE-01)
    },
    timeout=30,
)
run_id = resp.json()["run_id"]   # producer runs row; workflow_run id is threads.active_workflow_run_id
```

### Fake gateway adapter seam (CI structural test)
```python
# Source: provider_gateway/dispatcher.py:75 contract + test_085_task_service.py:562 stub pattern
async def fake_open_stream(provider: str, request: GatewayRequest):
    async def _events():
        yield {"type": "tool_call", "name": "search_documents", "args": {...}, "id": "tc1"}
        yield {"type": "finish", ...}
    return _events(), CallingMode.NATIVE
monkeypatch.setattr("app.services.task_service.open_stream", fake_open_stream)
# then drive harness_engine.run_workflow(...) with mock_asyncpg_pool + real Redis
```

### Threadpool budget reading (SC#3)
```python
# Source: backend/app/api/admin.py:52-99 (verified shape; dev/local = fail-open auth)
bp = requests.get(f"{base_url()}/admin/backpressure", headers=_auth_headers(token)).json()
# {"anyio_threadpool_depth": {"borrowed": int, "total": int},
#  "redis_active_runs": int, "postgres_pool_in_use": int, "per_worker_run_count": int}
```

### Eviction-safe abort (stream-cap)
```typescript
// Source: api.ts:516-517 — AbortError is a SILENT return; no onTerminal fires.
// Evictor must replicate the onTerminal wrapper's bookkeeping (StreamsProvider.tsx:1051-1059):
const controller = subscriptionsRef.current.get(runId)
controller?.abort()
subscriptionsRef.current.delete(runId)
useStreamsStore.setState((s) => ({
  subscriptionsByThread: _removeRunFromThread(s.subscriptionsByThread, threadId, runId),
}))
// DO NOT touch lastSeenOffsetRef — the cursor is the D-11 replay substrate.
```

### Double-execution detector (restart smoke assertion)
```sql
-- harness_audit is INSERT-only (HARNESS-06): exactly one phase_completed per completed phase
SELECT metadata->>'phase' AS slug, count(*) AS n
FROM harness_audit
WHERE run_id = %s AND event_type = 'phase_completed'
GROUP BY 1 HAVING count(*) > 1;   -- any row = double-applied side effect
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Eval = Deep-mode 4-prompt matrix | + workflow row type (this phase) | 096 | EVAL-01 |
| Registry-miss → structured mode (the trap) | Inference grants native_tools to native-7 prefixes | Phase 075.3 + quick 260530 | Curation trap narrower; registry still owns caps/timeouts/max_tools |
| One stream per active run, forever | Thread-keyed LRU-3 pool (this phase) | 096 | BUG-260530-01 |
| Mock-blind harness tests | Gateway-seam fake + live operator gate split | 093 lesson → 096 D-01 | "CI proves structure; operator proves providers" |
| `deepseek-chat`/`deepseek-reasoner` | deprecated 2026-07-24 → v4 family | DeepSeek docs | Curation should flag before deprecation date |
| eval providers as pass/fail only | + persisted per-provider capability table (D-04) | 096 | Feeds the v2.9 feature-fit routing pass (measure only) |

**Deprecated/outdated:** registry comment "api.moonshot.cn" (`config.py:240`) — actual base URL is `api.moonshot.ai` (`config.py:17`); `minimax/minimax-01` (OpenRouter) noted legacy/discontinued in the registry itself.

## Capability-Table Artifact (D-04 discretion — recommendation)

**Both JSON + Markdown, git-versioned.** JSON (machine-diffable, feeds the v2.9 routing pass): `.planning/eval/capability-table-<date>.json` — one object per provider: `{provider, model_effective, workflow_completed, phase_type_results: {...}, tool_invocation_fidelity, arg_shape_ok, retry_count, gate_failures, wall_clock_s, ask_user_roundtrip_ok}`. Markdown twin in the same folder for human review + VALIDATION.md citation. The eval script emits both at the end of a full run (extends `print_scoreboard`). Rationale: the scoreboard is ephemeral stdout; D-04 explicitly wants a *versioned artifact* the v2.9 decision pass can diff across runs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Opus 4.8's API model ID is `claude-opus-4-8` (pattern-inferred from prior IDs; exact ID unverified) | Model Curation | Wrong registry key → inference fallback (harmless but uncurated); live `/models` check resolves it |
| A2 | MiniMax M3's API ID follows PascalCase `MiniMax-M3` | Model Curation | Case-sensitive 401/404 at the API; live `/models` check resolves it |
| A3 | AnyIO default thread limiter total is 40 in this deployment (no override observed in config) | Latency + Threadpool | Budget math off; `/admin/backpressure` reading IS the verification — assumption only sets expectations |
| A4 | Chat message selectors do not read `subscriptionsByThread` (PANEL-06 holds under pool churn) | Stream-Cap | Pool churn re-renders chat; must be confirmed by the existing PANEL-06 isolation test before merging |
| A5 | `answerAskUser` propagates HTTP status on failure (ApiError pattern like postMessage) | D-06 frontend | If it throws a bare Error, the 404-honesty message needs a small api.ts touch |
| A6 | The CI runner's pytest job currently passes (the documented backend full-suite failure baseline is local-environment-dependent; CI runs the unit+mock subset green) | CI Mock-Provider | If CI is red at baseline, D-01's "never flaky" promise needs a baseline-fix pre-task — check the repo's recent Actions runs at plan time |
| A7 | Next free migration number is 066 (065 was 093's seed fix; none added since) | Eval seed | Renumber at plan time — trivial |

## Open Questions

1. **Harness model steering for the eval (Pitfall 1):** accept the per-provider defaults table (curate it, assert `runs.model` in the scoreboard) — or add an explicit model path (e.g. honor `body.model` in `resolve_workflow_ctx_model` when set)?
   - What we know: provider override works; model override is ignored by design (resolve-never-mutate, D-093-04/05).
   - Recommendation: accept + curate the defaults table for v2.8 (zero shared-path risk; the table IS a D-05 target); flag the model path as a v2.9 option. Plan should make this an explicit task-level decision.
2. **CI Postgres hardening:** add a real Postgres service container + `full-schema.sql` apply to `backend-tests.yml` (closes the DB half of the mock blind spot) or keep mock-pool-only for D-01?
   - Recommendation: mock-pool baseline now; Postgres container as a stretch/optional plan if time allows — D-01's wording ("free, never flaky") favors the lighter baseline.
3. **D-06 expiry representation:** synthesize an `ask_user_response`-shaped resolution row vs an `expired` marker vs filter-only?
   - Recommendation: filter-first (closes all history), plus a terminal-site cleanup write; exact row shape is planner's choice — keep it INSERT-only-compatible with the audit posture.
4. **`gpt-5.5` timeout tier:** registered at 300s while flagship convention is 600s — intentional or drift? Resolve during curation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Postgres :54322) | eval, restart smoke, D-06 tests | ✓ (project standard, auto-start) | CLI-managed | none — blocking for live work |
| Redis (compose) | run buffers, CI tests | ✓ local + CI workflow boots it | docker-compose.dev.yml | none |
| backend venv (psycopg2, requests, dotenv, pytest) | all scripts | ✓ (eval already runs on it) | repo-pinned | none |
| Provider API keys (7 native, names only: OPENAI/ANTHROPIC/GOOGLE/DEEPSEEK?via config/OPENROUTER/ZHIPU/MINIMAX _API_KEY) | live eval + curation | ✓ per backend/.env presence convention (eval prints presence) | — | per-provider row marked MISSING, never blocks others |
| GitHub Actions | D-01 CI gate | ✓ (`backend-tests.yml` exists, Redis-booting) | — | none |
| Chrome DevTools MCP | stream-cap live UAT | ⚠ calls can HANG (memory 2026-06-06) | — | operator-drives-clicks + Claude DB cross-checks via psycopg2 (documented fallback) |
| Playwright E2E | — | ✗ rotted (SEED-049, 16/17 fail) | — | explicitly NOT a backstop for this phase (CONTEXT known constraint) |
| uvicorn (operator-started, visible terminal) | restart smoke, live eval | ✓ standing practice | WORKER_COUNT=2 | none — by design the operator IS the restart mechanism |

**Missing dependencies with no fallback:** none identified.

## Validation Architecture

> workflow.nyquist_validation = true in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest (backend venv) |
| Backend config | `backend/` (tests under `backend/tests/`) |
| Backend quick run | `cd backend && venv/Scripts/python.exe -m pytest tests/<file>.py -x -q` |
| Backend full suite | `cd backend && venv/Scripts/python.exe -m pytest tests -q` (known pre-existing failure baseline — judge net-new vs pre-plan commit, 095.1 stash pattern) |
| Frontend framework | vitest (+ vitest-axe) |
| Frontend quick run | `cd frontend && npx vitest run <file>` |
| Frontend full suite | `cd frontend && npx vitest run` (~16-failure documented baseline cluster) + `npx tsc -b` (baseline 37) + `npm run build` |
| Live eval | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py` (operator; uvicorn + Supabase up; localhost-gated) |

### Phase Requirements → Test Map

| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVAL-01 / SC#1 (structure) | Full workflow journey: sequencing, gate retry, whitelist refusal, resume 2-phase writes, fake provider | unit/integration (CI) | `pytest tests/test_096_ci_workflow_regression.py -x -q` | ❌ Wave 0 |
| EVAL-01 / SC#1 (live) | Native-7 workflow rows complete with correct tool round-trips + correct `runs.model` | operator script | `python scripts/eval_cross_provider.py --workflow` (flag name TBD) | ❌ extension of existing script |
| EVAL-01 / D-02a | ask_user auto-answered; run resumes to completion | inside eval workflow row | same as above | ❌ |
| EVAL-01 / D-05 | Registry/Settings/defaults-table curation validated vs live `/models` | operator script + code diff | curation script or documented ritual; output = names-only model list diff | ❌ |
| EVAL-02 / SC#2+#4 | Restart smoke per kill point; no skipped phases, no double side-effects, prompt re-emitted; mid-ask_user POST reaches engine | operator + helper script | `python scripts/restart_smoke.py --kill-at {programmatic\|llm_agent\|ask_user}` | ❌ Wave 0 |
| EVAL-02 / 4-axis | cross-provider × multi-tool × parallel-thread × long-message scoreboard | manual-only (VALIDATION.md rows; Chrome-MCP or operator-driven + DB cross-check) | — (manual; justification: lived-experience gate G-4, Chrome MCP flaky) | VALIDATION.md |
| CONC-01 / SC#3 (fan-out) | N=10 → max 5 concurrent sub-agents | script assertion | overlap analysis in `scripts/conc_probe.py` (or folded into restart/eval script) | ❌ Wave 0 |
| CONC-01 / SC#3 (latency) | cross-tab GET p95 <50ms during batch; AnyIO borrowed/total recorded | script assertion | same probe script polling `/admin/backpressure` + `/snapshot` | ❌ Wave 0 |
| CONC-01 / SC#5 (stream-cap) | pool=3 enforcement, eviction bookkeeping, switch-back reattach | unit (vitest) | `npx vitest run src/providers/__tests__/streamPool.test.tsx` | ❌ Wave 0 |
| CONC-01 / SC#5 (live) | ≥6 concurrent runs → thread-switch reconcile <1s; D-11a no-fake-tokens asserted | manual-only (UAT row) | — (manual; network-tab evidence) | VALIDATION.md |
| D-06 backend | terminal run → `/pending` excludes its prompt (both ID namespaces) | unit/integration | `pytest tests/test_096_askuser_cleanup.py -x -q` | ❌ Wave 0 |
| D-06 frontend | expired card renders disabled; 404 surfaces visible error; countdown from created_at | unit (vitest) | `npx vitest run src/components/panel/__tests__/PendingAskCard.test.tsx` (extend existing) | ✅ extend |

### Sampling Rate
- **Per task commit:** the touched file's quick run (`pytest <file> -x -q` / `vitest run <file>`)
- **Per wave merge:** backend full suite + frontend `vitest run` + `tsc -b` + build — judged net-new=0 vs baseline (stash pattern)
- **Phase gate:** CI green on the new structural test + full live eval scoreboard + restart smokes + VALIDATION.md scoreboard before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_096_ci_workflow_regression.py` — D-01 structural gate (fake gateway adapter + mock pool + real Redis)
- [ ] `backend/tests/test_096_askuser_cleanup.py` — D-06 backend (terminal cleanup + /pending liveness filter, both ID namespaces)
- [ ] `frontend/src/providers/__tests__/streamPool.test.tsx` — pool enforcement / eviction bookkeeping / reattach-on-return / PANEL-06 isolation guard
- [ ] `scripts/restart_smoke.py` — D-08 helper (seed, kill-signal banner, DB-truth assertions)
- [ ] `scripts/conc_probe.py` (or merged into restart helper) — fan-out overlap + latency + backpressure sampling
- [ ] migration 066+ — `eval_coverage` 5-type seed workflow (+ optional slow programmatic fn for the mid-programmatic kill point)
- [ ] eval script extension — workflow row type + capability-table emitter
- No framework installs needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Eval/scripts mint test-user bearer via Supabase password grant (existing pattern); `/admin/backpressure` fail-open ONLY in dev — scripts must not assume it in prod |
| V3 Session Management | no (no new session surface) | — |
| V4 Access Control | yes | All new DB queries owner-scoped + RLS-postured; D-06 must preserve the 404-never-403 anchor-confirm (no existence leak); `/pending` filter adds NO new cross-user read |
| V5 Input Validation | yes | Eval/script SQL: constant-query allowlist + `%s` parameterization (T-088-02-04 pattern); PendingAskCard renders text children only (T-087-11 — keep `dangerouslySetInnerHTML == 0`) |
| V6 Cryptography | no | — |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Eval pointed at cloud DB | Tampering/DoS | Localhost hard-gate FIRST (existing `assert_localhost_only`) — replicate in every new script |
| Secret values in script output / CI logs | Information disclosure | Presence/absence printing only; no provider keys in GitHub secrets (D-01 explicitly) |
| Cross-user ask_user answer | Spoofing | Existing owner-scope + anchor-confirm preserved verbatim (D-06 changes filtering/UX only) |
| SQL injection via thread/run ids in new queries | Tampering | Parameterized `%s`/`$1` everywhere; constant query strings |
| Admin endpoint exposure | Elevation | `/admin/backpressure` is allow-list gated in production; probe scripts are dev-local only |

## Sources

### Primary (HIGH confidence — direct codebase reads, 2026-06-07)
- `scripts/eval_cross_provider.py` (full, 702 lines) — extension surface, security posture, scoreboard format
- `backend/app/api/threads.py` (`:350-460` snapshot, `:782-1010` send_message + overrides, `:1153-1300` harness ctx build) — kickoff/override/model-resolution semantics
- `backend/app/api/runs.py:460-637` — `submit_ask_user_response` + F10 fallback + anchor-confirm 404
- `backend/app/api/panel.py:103-156` — `/pending` query (D-06 filter site)
- `backend/app/services/harness_engine.py` (terminal sites `:769-812`, `:885-900`; resume `:1085-1180`) — D-06 cleanup sites + restart sweep
- `backend/app/services/harness/phase_types.py:320-430` — batch semaphore + ask_user executor
- `backend/app/services/harness/programmatic.py:71-116` — split_topic (no N cap)
- `backend/app/models/harness.py` — phase-config fields (`max_parallel_agents=5`, `max_steps=12`)
- `backend/app/services/provider_gateway/dispatcher.py` — `open_stream` seam contract
- `backend/app/config.py` (`:10-20` base URLs, `:186-273` registry, `:288-340` inference, `:596-603` per-provider defaults)
- `backend/app/models/user_settings.py:513-524` — `override_provider` (no llm_model swap)
- `backend/app/services/sub_agent_models.py:137-167` — `resolve_workflow_ctx_model`
- `backend/app/api/admin.py` — backpressure endpoint shape
- `frontend/src/providers/StreamsProvider.tsx` (subscription refs `:971-1000`, producer-resubscribe `:1024-1075`, setViewingThread `:1134-1161`, reconcile `:1170-1330`) + `frontend/src/lib/api.ts:400-560` (AbortError silent return `:516-517`)
- `frontend/src/components/panel/PendingAskCard.tsx` (countdown `:168`, silent catch `:216-219`, expired state `:225-246`)
- `.github/workflows/backend-tests.yml`; `backend/tests/` inventory (`test_harness_*`, `test_085_task_service.py` open_stream stub)
- `supabase/migrations/061_*.sql` — 4 seed workflows' phase-type composition
- `.planning/reported-bugs/orphaned-askuser-prompt-failed-run-404-silent.md`, `thread-switch-hang-stream-connection-saturation.md`
- `.planning/seeds/SEED-034`, `SEED-036`; `096-CONTEXT.md`; ROADMAP Phase 096 entry

### Secondary (MEDIUM confidence — web, cross-referenced)
- [MiniMax API overview (M3 + M2.x roster, api.minimax.io endpoints)](https://platform.minimax.io/docs/api-reference/api-overview)
- [DeepSeek list-models endpoint](https://api-docs.deepseek.com/api/list-models), [models & pricing / V4 news](https://api-docs.deepseek.com/quick_start/pricing)
- [GPT-5.5 flagship status + `gpt-5.5` API id](https://artificialanalysis.ai/articles/openai-gpt5-5-is-the-new-leading-AI-model)
- [Claude Opus 4.8 release (2026-05-28) comparisons](https://www.mindstudio.ai/blog/gpt-5-5-review-developers-builders)
- [Kimi model list / platform docs](https://platform.kimi.ai/docs/models), [K2.6 overview](https://deepinfra.com/blog/kimi-k2-6-model-overview)
- [Z.AI base URL + GLM-5.x roster (community provider docs)](https://docs.continue.dev/customize/model-providers/more/zai)

### Tertiary (LOW confidence — flagged for live validation)
- Exact API IDs for Claude Opus 4.8 / MiniMax M3 / Gemini 3.1 Pro GA — resolve via live `/models` during the D-05 curation pass (Assumptions A1/A2).

## Metadata

**Confidence breakdown:**
- Eval extension + CI seam: HIGH — every claim verified by direct code read
- D-06 fix surface: HIGH — bug report itself is "verified, not hypothesis"; both fix sites read
- Stream-cap map: HIGH — all 5 call sites + abort semantics verified; A4 (PANEL-06 selector isolation) needs a test-time confirm
- CONC-01 measurement: HIGH — backpressure endpoint + semaphore + split behavior verified
- Model curation: MEDIUM — external signals are secondary sources by design; the live `/models` pass IS the phase deliverable

**Research date:** 2026-06-07
**Valid until:** ~2026-06-21 for codebase claims (repo moves fast); model-currency claims valid only until the live curation pass runs (days)
