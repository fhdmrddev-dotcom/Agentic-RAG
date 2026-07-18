---
status: passed
phase: 123-skill-triggering-quality
source: [123-VERIFICATION.md]
started: 2026-06-23T21:22:25Z
updated: 2026-06-26T00:00:00Z
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
| LangSmith tracing | ⚠️ NOT emitting | `langsmith_tracing=true` + key set, but project `agentic-rag-module2` shows **no traces since 2026-06-20** — the running backend isn't emitting (raw-SDK `wrap_openai` path). Axes 2–4 were verified WITHOUT LangSmith: live render + Supabase DB + Redis + the deterministic `_reconstruct_history`+`trim_messages_to_fit` replay. (Tracing wiring worth a separate look.) |

**Models to cycle:** `gpt-5.4-mini` · `claude-haiku-4-5-20251001` · `gemini-3.5-flash` · `z-ai/glm-5.1`

## Current Test

ALL 4 SC#10 AXES PASS (2026-06-26). Axis 1 PASS. Axis 2 PASS (render re-test — BUG-260626-01 verified fixed live + its workspace-todos sibling BUG-260626-04 fixed+verified; BUG-260626-02 confirmed-live-but-deferred to SEED-094; BUG-260626-03 deferred to SEED-094). Axis 3 PASS (3-run simultaneous buffer isolation + cross-thread pinned-skill isolation, watched the render). Axis 4 PASS (forced a real 12,150→4,102-token trim at the 8000 cap — pinned skill survives + honest `_TRIM_MARKER`; live model still used the skill after the trim). **Operator cleanup pending: remove `CONTEXT_WINDOW_MAX_TOKENS=8000` from backend/.env + restart.**

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
result: PASS (render re-test 2026-06-26, OpenAI `gpt-5.4-mini`). First pass was a FUNCTIONAL pass that surfaced 3 defects by watching the rendered UI (which an earlier wire-only pass had skipped); the render re-test then verified the fixes live.

- First pass (2026-06-25, thread 13ae9bfe, run 89125149): CTX-03/multi-tool MECHANISM passed — one prompt drove FOUR tools (`[write_todos, search_documents, load_skill, task, execute_code, execute_code]`, 5 citations); `load_skill` loaded `weekly-report-writer` and it stayed usable to produce `Weekly_Report_2026-06-25.docx`. Watching the render exposed **BUG-260626-01** (file cards duplicate 4× + source bleed in MULTI-RUN threads — frontend duplicate React key `run-${runId}`), **BUG-260626-03** (todos stuck — model omitted completion `write_todos`, no run-end finalizer), and the separate latent **BUG-260626-02** (Phase-120 baseline leak into the live final_output_files emit). All root-caused + adversarially verified (workflow wf_cf429301-479).
- Render re-test (2026-06-26, watching the render — 2 multi-tool runs + a clean single run): **BUG-260626-01 VERIFIED FIXED** (commit 2a48fea4) — each run's persisted GENERATED FILES panel shows exactly its own file, no same-file duplication, no source bleed, console 100% clean (zero duplicate-key warnings; pre-fix fired 273×). The re-test ALSO surfaced **BUG-260626-04** (workspace "DERIVED FROM ACTIVITY" todos doubled in the temp+persisted window — same root cause, second consumer); FIXED + verified live in commit 6ec8be77 (hoisted the dedup to a shared `dedupMessagesByRunId` helper used by MessageList AND useDerivedPanel; single-run thread now shows 2 todos, was 4). **BUG-260626-02 confirmed LIVE** with richer evidence (run 2's live emit re-lists run 1's *valid/downloadable* file, not just dead baseline cards; self-heals on reload) → stays deferred to SEED-094. **BUG-260626-03** → deferred to SEED-094.

LESSON (reinforced): the wire being correct ≠ the screen being correct — watch the render, count rendered cards/todos, test single AND multi-run.

### 3. Parallel-thread isolation (tuner run vs pinned context)
expected: Thread A streaming a Trigger Tuner run (background job + tuner_* SSE events) does NOT contaminate Thread B's chat context or its pinned skill. Tuner events never overload chat event types; Thread B's pinned `load_skill` group and streaming are unaffected while Thread A tunes.

steps:
- Thread A: start a Trigger Tuner run (or a loaded-skill chat) and let it stream.
- Thread B (second tab): new thread → `Summarize one of my documents.`
- While both are live, Claude inspects Redis (via the backend venv, no docker): `run:*`, `runs_by_thread:*`, `runs:active` — confirm distinct `run:{id}` keys and the tuner's namespaced `runs_by_thread:tuner:{skill_id}`; and checks Thread B's LangSmith input carries none of Thread A's `weekly-report-writer` content.
pass: distinct run-buffer keys (no collision) AND Thread B has its own clean context (no inherited pinned skill).
result: PASS (render re-test 2026-06-26, OpenAI `gpt-5.4-mini`, watching the render). Ran two concurrent Thread-A(skill-loaded)/Thread-B(no-skill) pairs.
- **Run-buffer isolation (no collision):** captured a true simultaneous snapshot of **3 distinct runs streaming at once** — A4's main run (thread `19fbf5ff`, run `9ad73e3b`), A4's `task` sub-agent (thread `38879ffe`, run `954dadf8`, its OWN buffer), and B4 (thread `4354808a`, run `e51e5370`). 3 distinct run_ids → 3 distinct `run:{id}` stream buffers → 3 distinct `runs_by_thread:{thread}` buckets, **zero shared keys**. Even the sub-agent is namespaced to its own buffer.
- **Pinned-skill isolation:** across BOTH pairs, the skill-loading thread's DB tool_calls include `load_skill` (weekly-report-writer) while the concurrent Thread B used NONE — pair 1: A `[load_skill, write_todos, task, execute_code]` vs B `[search_documents]`; pair 2: A4 `[write_todos, load_skill, search_documents, analyze_document, execute_code]` vs B4 `[write_todos, search_documents, write_todos, execute_code, write_todos]` (loaded a skill: False). Thread B never inherited A's pinned skill.
- **Render isolation + no concurrency regression:** B4's foreground showed no skill card and only its OWN file (`cm_iso.png`; 1 GENERATED FILES header, 1 card), no A-thread docx bleed; console stayed 100% clean under concurrent streaming (the BUG-01 dedup fix holds under parallel load).
Note: tuner_* namespacing (`runs_by_thread:tuner:{skill_id}`) was not separately exercised (no tuner run during this pass) — the chat-thread isolation above covers the SC#10 parallel-thread axis; tuner-vs-chat namespacing remains an optional deepening.

### 4. Long-message pin durability + honest eviction (CTX-03)
expected: After ≥ 50 prior messages (or a ≥ 5 KB prompt) roll the trim window, a loaded skill's instructions persist in context (3rd protected class, capped at 1/3 budget). On genuine LRU eviction of a pinned skill over budget, the honest `_TRIM_MARKER` appears; it NEVER drops a pinned skill silently. Reload of the same skill de-dupes (no duplicate pinned group).

steps:
- The 4 models have 200K–600K budgets, so force a trim: add `CONTEXT_WINDOW_MAX_TOKENS=8000` to `backend/.env` → restart backend (pin budget = ⅓ ≈ 2,666 tokens).
- New thread, pick a model. Turn 1: `Load the weekly-report-writer skill.` Turns 2–12: ~10 throwaway DISTINCT prompts (`Give me a one-line fun fact about the number 7.` … `8.` …). Final turn: `Using the skill you loaded, draft the report's heading.`
- Hand Claude the final run_id; Claude pulls the LangSmith input for that turn and checks: (a) skill tool-result still present, (b) `_TRIM_MARKER` text `[Earlier conversation history was trimmed…]` present, (c) an early "fun fact" turn is gone.
- Cleanup: remove `CONTEXT_WINDOW_MAX_TOKENS`, restart backend.
pass: skill survives the trim; trim is honest (marker present). The ONLY fail is the skill vanishing with NO marker (silent drop). If the skill is large enough to be evicted, the marker MUST still appear (honest eviction = acceptable).
result: PASS (2026-06-26, OpenAI `gpt-5.4-mini`, `CONTEXT_WINDOW_MAX_TOKENS=8000` set by operator + backend restarted; thread `2dc4d3da`). Ran Turn 1 `Load the weekly-report-writer skill` → 10 distinct throwaway turns (fun facts 7–16) → a ~28.7 KB filler message (also satisfies the SC#10 ≥5 KB long-message sub-axis) → final `Using the skill…draft the heading with placeholders`.
- **Live behavioral:** the final turn (overflowing context) still drove the loaded skill — the model wrote python-docx code producing `weekly_report_heading_placeholder.docx` with the skill's heading fields. The pin kept the skill usable AFTER the trim. (An earlier final-turn variant fired `ask_user` asking for the exact weekly-report heading fields — also only possible if the skill instructions were still in context.)
- **Deterministic trace-equivalent** (LangSmith was NOT emitting — last trace 2026-06-20 — so verified via the REAL production `_reconstruct_history` + `trim_messages_to_fit` on the actual DB conversation at the live 8000 budget): PRE-trim total **12,150 tokens** > 8000 → trim fires → POST-trim **4,102** ≤ 8000. (a) pinned `weekly-report-writer` tool-result **SURVIVES** ✓; (b) honest `_TRIM_MARKER` **present** ✓ (never silent); (c) all 10 fun-fact turns (7–16) dropped ✓. Post-trim order = `[system, TRIM-MARKER(user), …, PINNED-SKILL(tool)]` — exactly the CTX-03 design (pin placed right after system + marker, out of the trim window). The fail mode (skill vanishes with no marker) did NOT occur.
- Sanity: with only the skill + 10 short turns the context was just 4,210 tokens (< 8000) → no trim, no marker (correct — marker only required when trimming occurs); the ~28.7 KB message is what forced the genuine overflow.
**Cleanup required:** operator should REMOVE `CONTEXT_WINDOW_MAX_TOKENS=8000` from backend/.env and restart the backend (it globally caps ALL chats to 8000 tokens).

## Evidence commands (Claude runs)

- Backend up: `curl -s http://localhost:8000/health`
- Did load_skill fire: `SELECT role, created_at, tool_calls FROM messages WHERE thread_id=%s AND role='assistant' ORDER BY created_at DESC LIMIT 3;`
- Tuner scoreboard: `SELECT id, target_count, scoreboard FROM tuner_runs ORDER BY created_at DESC LIMIT 1;`
- Redis isolation (no docker): backend venv `redis.Redis.from_url('redis://localhost:6379')` → `keys('run:*')`, `keys('runs_by_thread:*')`, `zrange('runs:active',0,-1)`
- One-shot run dump (Redis + Postgres + LangSmith + logs): `cd backend && ./venv/Scripts/python.exe ../scripts/observe-run.py <run_id> <thread_id>`

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Defects found during Axis 2 (all root-caused + adversarially verified — workflow wf_cf429301-479; logged in .planning/reported-bugs/). **Status after the 2026-06-26 render re-test:**

- **BUG-260626-01** (major) — **CLOSED.** Fixed `2a48fea4`, hardened `6ec8be77`; verified live in the render re-test (multi-run file cards correct, no source bleed, console clean). Generated-file cards duplicate + KB source bleed in MULTI-RUN threads via duplicate React key `run-${runId}` (temp + persisted twin in the live window).
- **BUG-260626-04** (minor) — **CLOSED.** Found DURING the BUG-01 re-test: workspace "DERIVED FROM ACTIVITY" todos doubled in the temp+persisted window (same root cause, second consumer — `useDerivedPanel` flat-maps across the twin; `dedupToolCalls` can't merge temp's `clientKey` vs persisted's none). Fixed `6ec8be77` by hoisting the dedup to a shared `dedupMessagesByRunId` helper used by both MessageList AND useDerivedPanel; verified live (single run → 2 todos, was 4).
- **BUG-260626-03** (minor) — **ROUTED → SEED-094** (`deferred`). Workspace TODOS left stuck when the model omits a completion `write_todos`. Panel faithful to DB; root cause = model behavior + no run-end finalizer. Fix: additive run-end todo reconciler (honest "ended with open todos", not silent auto-complete).
- **BUG-260626-02** (minor, separate latent) — **ROUTED → SEED-094** (`deferred`); **confirmed LIVE** in the re-test with richer evidence (run 2's live emit re-lists run 1's *valid/downloadable* file, not just dead `iteration:-1` cards; self-heals on reload → live-emit artifact, DB persist is clean). Fix scope widened: filter the emit to the current run's freshly-produced files, not merely drop `iteration == -1`.

BUG-02 + BUG-03 remain bundled in **SEED-094** (`.planning/seeds/SEED-094-run-end-honesty-baseline-emit-leak-and-todo-finalizer.md`) — one dedicated backend run-end-honesty fix phase, candidate to schedule after CORE Phase 124 or at the next agent_loop.py-touching phase / /gsd:new-milestone.

Process note: the first Axis-2 pass was declared on wire/DB evidence WITHOUT watching the render — missed all of the above. Lived-experience watch (count rendered cards, watch todos to completion, both single- and multi-run) is mandatory before marking a streaming/UI axis pass.
