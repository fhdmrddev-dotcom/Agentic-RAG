---
status: partial
phase: 123-skill-triggering-quality
source: [123-VERIFICATION.md]
started: 2026-06-23T21:22:25Z
updated: 2026-06-25T21:20:00Z
---

## How to run

**Division of labor:** the operator drives the browser (pick models, send prompts, start Tuner runs); Claude runs the cross-checks (Postgres `:54322`, Redis via the backend venv, LangSmith, `observe-run.py`). After each step, hand Claude the `thread_id` (from the chat URL) or `run_id` and it returns the verdict from the DB.

**Three corrections to the original strategy text (do NOT chase these ghosts):**
1. There is **no** `scripts/eval_cross_provider.py` "trigger axis" — that CLI mode was never built (the one unchecked Wave-0 item at VALIDATION.md:76). The script's "trigger" word is Phase 122's forced-emit concept, unrelated to skill firing. Axis 1 uses the **in-app Trigger Tuner + live chat** instead.
2. There is **no** saved numeric pre-D-01 baseline. "No regression" = operator judgment that the skill doesn't start over-firing on off-topic prompts.
3. Use the dated Anthropic id **`claude-haiku-4-5-20251001`** (undated `claude-haiku-4-5` is not a served model).

**Switching model:** chat composer bottom-left → Provider dropdown (Layers icon) → pick provider → Model dropdown → pick model.

## Pre-flight (verified by Claude 2026-06-26)

| Check | Status | Detail |
|---|---|---|
| Backend up on `:8000` | ✅ | `{"status":"ok","redis":"ok"}` |
| Redis run-buffer | ✅ clean | reachable on `localhost:6379`; `run:*` / `runs_by_thread:*` / `runs:active` all empty (clean axis-3 baseline) |
| Sandbox | ✅ | `sandbox_enabled = true` (Docker must be running for `execute_code`) |
| Ingested docs | ✅ | 36 completed documents / 1875 chunks under the test user → `search_documents` returns hits |
| Test skill | ✅ | `weekly-report-writer` (most specific trigger of the 4 skills: `docx`, `pptx`, `risk-lens_099uat`, `weekly-report-writer`; no `zscore` skill exists) |
| Tuner durable table | ✅ | `tuner_runs` present (2 prior rows) |
| 4 provider keys in `.env` | ⬜ operator confirm | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY` (all 4 needed so each provider appears in the composer dropdown) |
| LangSmith tracing | ⬜ operator confirm | `LANGSMITH_TRACING=true`, project `agentic-rag` — **load-bearing for axes 2–4** |

**Models to cycle:** `gpt-5.4-mini` · `claude-haiku-4-5-20251001` · `gemini-3.5-flash` · `z-ai/glm-5.1`

## Current Test

Axis 1 PASS. Axis 2 = functional pass but surfaced BUG-260626-01/-02/-03 (see Gaps). Axis 3 started then interrupted. Next: finish **Test 3 — Parallel-thread isolation** + **Test 4 — long-message pin**.

## Tests

### 1. Cross-provider D-01 trigger fidelity (no false-fire / no missed-fire)
expected: With the relaxed D-01 catalog note in production, on each of the 4 providers (OpenAI, Anthropic, Google, OpenRouter — one representative model each), a skill whose description matches the user's intent gets `load_skill`-fired, AND an unrelated prompt does NOT spuriously fire `load_skill`. Description now drives firing; no over-conservative suppression and no fire-on-everything regression.

steps:
- Part A (structured, one run covers all providers): Skills (Zap nav) → select `weekly-report-writer` → "Tune triggers" → "Run tuning". When done, Claude reads the durable scoreboard: `SELECT id, target_count, scoreboard FROM tuner_runs ORDER BY created_at DESC LIMIT 1;` — confirm fires-recall + no-false-precision per provider column. PASS = high recall AND high no-false precision across the configured provider columns.
- Part B (lived per-provider, repeat for all 4 models): new thread → set provider+model → should-fire prompt `Write my weekly report.` (expect a "Loading skill 'weekly-report-writer'" row) → new thread → off-topic prompt `What's a good recipe for weeknight pasta?` (expect NO skill-load row). Hand Claude both thread_ids; it confirms via `messages.tool_calls` (load_skill present on should-fire, absent on off-topic).
pass: fires when it should, silent when it shouldn't, on all 4 providers.
result: PASS (2026-06-25, Trigger Tuner run 3c4508e0 on `weekly-report-writer`). All 4 SC#10 providers scored fires=1.0 / no_false=1.0 on every candidate; winner = the CURRENT description (held-out 1.0 — the tuner couldn't beat it). Full native-8 roster near-perfect: only 2 single-repeat missed-fires (moonshot cand-1, deepseek cand-2), ZERO false-fires anywhere → no D-01 over-fire regression. Result durably upserted to `tuner_runs` (run_id 3c4508e0, target_count 8) and confirmed visible in the UI on reload. Evidence pulled from Redis `tuner_result` + Postgres `tuner_runs` (DB == Redis scoreboard). Caveat: `weekly-report-writer` has an explicit trigger (easy case); lived per-provider chat spot-checks + an ambiguous-skill stress remain optional deepening.

### 2. Multi-tool pin durability (CTX-03 alongside other tools)
expected: A loaded skill's instructions stay pinned and usable while a single prompt exercises 2+ tools (e.g. `search_documents` + `execute_code`). The pinned `load_skill` group survives the trim window; the agent still acts on the loaded skill's instructions after the other tool calls complete.

steps:
- New thread, pick a provider/model. Turn 1: `Load the weekly-report-writer skill.`
- One multi-tool prompt (fill a real KB topic): `Search my documents for <a topic in your KB> and then run Python to count how many chunks mention it and plot a quick bar chart.`
- Confirm BOTH `search_documents` and `execute_code` fire (two tool rows).
- Hand Claude the run_id/thread_id; Claude pulls the LangSmith trace inputs (or open the run in LangSmith → the LLM call's `inputs.messages`) and confirms the `weekly-report-writer` tool-result is still present in that turn's context.
pass: both tools fire AND the loaded skill's instructions are still in the messages sent to the provider.
result: FUNCTIONAL PASS, but lived-experience UAT surfaced 2 real defects (do NOT mark a clean pass). (2026-06-25, OpenAI `gpt-5.4-mini`, thread 13ae9bfe, run 89125149.) The CTX-03/multi-tool MECHANISM passed: one prompt drove FOUR tools (`[write_todos, search_documents, load_skill, task, execute_code, execute_code]`, 5 citations); `load_skill` loaded `weekly-report-writer` and the skill stayed usable through the sequence to produce `Weekly_Report_2026-06-25.docx`. BUT watching the rendered UI (which the first pass skipped) exposed: **BUG-260626-01** — generated-file cards duplicate (file card rendered 4× / 4 "GENERATED FILES" headers; KB source-docs bleed in) in MULTI-RUN threads (frontend duplicate React key `run-${runId}`; DB clean; self-heals on reload); and **BUG-260626-03** — todos left visibly stuck (model omitted a completion `write_todos`; panel faithful; no run-end finalizer). Single clean run is clean (1 card; todos 2/2). Also logged the separate latent **BUG-260626-02** (Phase-120 baseline leak into the live final_output_files emit). All 3 root-caused + adversarially verified (workflow wf_cf429301-479). LESSON: the wire being correct ≠ the screen being correct — watch the render.

### 3. Parallel-thread isolation (tuner run vs pinned context)
expected: Thread A streaming a Trigger Tuner run (background job + tuner_* SSE events) does NOT contaminate Thread B's chat context or its pinned skill. Tuner events never overload chat event types; Thread B's pinned `load_skill` group and streaming are unaffected while Thread A tunes.

steps:
- Thread A: start a Trigger Tuner run (or a loaded-skill chat) and let it stream.
- Thread B (second tab): new thread → `Summarize one of my documents.`
- While both are live, Claude inspects Redis (via the backend venv, no docker): `run:*`, `runs_by_thread:*`, `runs:active` — confirm distinct `run:{id}` keys and the tuner's namespaced `runs_by_thread:tuner:{skill_id}`; and checks Thread B's LangSmith input carries none of Thread A's `weekly-report-writer` content.
pass: distinct run-buffer keys (no collision) AND Thread B has its own clean context (no inherited pinned skill).
result: [pending]

### 4. Long-message pin durability + honest eviction (CTX-03)
expected: After ≥ 50 prior messages (or a ≥ 5 KB prompt) roll the trim window, a loaded skill's instructions persist in context (3rd protected class, capped at 1/3 budget). On genuine LRU eviction of a pinned skill over budget, the honest `_TRIM_MARKER` appears; it NEVER drops a pinned skill silently. Reload of the same skill de-dupes (no duplicate pinned group).

steps:
- The 4 models have 200K–600K budgets, so force a trim: add `CONTEXT_WINDOW_MAX_TOKENS=8000` to `backend/.env` → restart backend (pin budget = ⅓ ≈ 2,666 tokens).
- New thread, pick a model. Turn 1: `Load the weekly-report-writer skill.` Turns 2–12: ~10 throwaway DISTINCT prompts (`Give me a one-line fun fact about the number 7.` … `8.` …). Final turn: `Using the skill you loaded, draft the report's heading.`
- Hand Claude the final run_id; Claude pulls the LangSmith input for that turn and checks: (a) skill tool-result still present, (b) `_TRIM_MARKER` text `[Earlier conversation history was trimmed…]` present, (c) an early "fun fact" turn is gone.
- Cleanup: remove `CONTEXT_WINDOW_MAX_TOKENS`, restart backend.
pass: skill survives the trim; trim is honest (marker present). The ONLY fail is the skill vanishing with NO marker (silent drop). If the skill is large enough to be evicted, the marker MUST still appear (honest eviction = acceptable).
result: [pending]

## Evidence commands (Claude runs)

- Backend up: `curl -s http://localhost:8000/health`
- Did load_skill fire: `SELECT role, created_at, tool_calls FROM messages WHERE thread_id=%s AND role='assistant' ORDER BY created_at DESC LIMIT 3;`
- Tuner scoreboard: `SELECT id, target_count, scoreboard FROM tuner_runs ORDER BY created_at DESC LIMIT 1;`
- Redis isolation (no docker): backend venv `redis.Redis.from_url('redis://localhost:6379')` → `keys('run:*')`, `keys('runs_by_thread:*')`, `zrange('runs:active',0,-1)`
- One-shot run dump (Redis + Postgres + LangSmith + logs): `cd backend && ./venv/Scripts/python.exe ../scripts/observe-run.py <run_id> <thread_id>`

## Summary

total: 4
passed: 1
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

Defects found during Axis 2 lived-experience UAT (all root-caused + adversarially verified — workflow wf_cf429301-479; logged in .planning/reported-bugs/). **Routing applied 2026-06-26:**

- **BUG-260626-01** (major) — **FIX COMMITTED `2a48fea4`** (unit + tsc green; status stays `open` until the Axis-2 multi-run scenario is re-run live and the screen is confirmed). Generated-file cards duplicate + KB source-docs bleed in MULTI-RUN chat threads. Frontend duplicate React key `run-${runId}` in MessageList.tsx:167 (temp + persisted same-runId rows coexist in the live window). Fix = dedup-by-runId before map (prefer persisted) + tighten BOTH StreamsProvider keep-predicates with `&& !dbRunIds.has(runId)` + 5 regression tests (MessageList.dedup.test.tsx). Frontend-only, shared-path-safe (D-14 intact); harness path confirmed unaffected.
- **BUG-260626-03** (minor) — **ROUTED → SEED-094** (status `deferred`). Workspace TODOS left stuck after a run when the model omits a completion `write_todos`. Panel is faithful to the DB; root cause = model behavior + no run-end finalizer. NOT a code regression. Fix: additive run-end todo reconciler (honest "ended with open todos", not silent auto-complete).
- **BUG-260626-02** (minor, separate latent) — **ROUTED → SEED-094** (status `deferred`). Phase-120 sandbox baseline files leak into the LIVE final_output_files emit (agent_loop.py ~2239 aggregates the whole `_previous_files_in_run` incl. `iteration:-1`); shows dead "Download unavailable" cards on a reused sandbox. Phase-120 tests covered the delta, not the emit. Fix: filter `iteration == -1` from the emit.

BUG-02 + BUG-03 are bundled into **SEED-094** (`.planning/seeds/SEED-094-run-end-honesty-baseline-emit-leak-and-todo-finalizer.md`) — one dedicated backend run-end-honesty fix phase, candidate to schedule after CORE Phase 124 or at the next agent_loop.py-touching phase / /gsd:new-milestone.

Process note: the first Axis-2 pass was declared on wire/DB evidence WITHOUT watching the render — missed all of the above. Lived-experience watch (count rendered cards, watch todos to completion, both single- and multi-run) is mandatory before marking a streaming/UI axis pass.
