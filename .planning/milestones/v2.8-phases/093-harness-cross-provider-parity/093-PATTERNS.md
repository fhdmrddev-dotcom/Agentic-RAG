# Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 11 (10 modified + 1 new migration)
**Analogs found:** 11 / 11 (every file has a verbatim in-repo analog — this is a CONSUMPTION + plumbing phase, ~zero net-new logic)

> **RED LINE (D-14):** Deep is byte-identical on all native-7. Every analog below is reproduced as an *additive, None-default* change or a *service-boundary* consume. The single sharpest fact for Task 1 is the **IN-05 sync-generator trap** (drive `for chunk in stream:` in `run_in_threadpool`, NEVER `async for`).

> **SHARED-FILE RISK:** `backend/app/services/task_service.py` serves BOTH Deep `task()`/`analyze_document` AND the harness. Its change MUST default to a Deep byte-identical no-op for the `task()` path (the eval `task` cell is the regression backstop, judged by skeleton/twin not a single run — D-13).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/task_service.py` | service (SHARED Deep+harness) | streaming / request-response | `backend/app/services/agent_loop.py:1352-1708` (Deep gateway consumer) | exact (verbatim template) |
| `backend/app/services/sub_agent_models.py` | service (model-resolution helper) | transform | self (field fix) + `config._SUB_AGENT_MODEL_DEFAULTS` + `models/user_settings.py:100` | exact |
| `backend/app/api/runs.py` (ask_user endpoint) | controller (HTTP) | request-response / event-driven (pub/sub) | `runs.py:636-673` (Continue endpoint workflow_run fallback) | exact (D-07 mirrors it verbatim) |
| `backend/app/services/harness/programmatic.py` | utility (pure fn) | transform | self (`split_topic:89` key read) | exact |
| `backend/app/services/harness/phase_types.py` | service (executor registry) | event-driven / request-response | self (`:401-476` ask_user keying) | exact |
| `backend/app/services/harness/reachability.py` | utility (pure lint) | transform / batch | self (existing `LintError` rule shape `:34-146`) | exact |
| `backend/app/services/harness_engine.py` | service (orchestrator) | event-driven | `threads.py:1268-1373` (live-kickoff surfacing) + `harness_engine.py:661-696` (terminal) | exact |
| `backend/app/api/threads.py` (live-kickoff surfacing) | controller (HTTP) | streaming | self (`:1268-1373` block to EXTRACT) | exact (extract, don't rewrite) |
| `backend/app/api/panel.py` (`/pending` payload) | controller (HTTP) | request-response | self (`:144-152` payload dict) | exact (add `draft` field) |
| `supabase/migrations/065_harness_seed_fixes.sql` | migration | batch / file-I/O | migrations 056-064 numbered-SQL pattern | role-match (immutability constraint differs — see landmine) |
| `frontend/src/lib/api.ts` (`PendingAsk` shape) | utility (client dispatch) | request-response | self (`answerAskUser` / dispatch `:485-575`) | exact (additive `draft` only) |

---

## Pattern Assignments

### `backend/app/services/task_service.py` (service, streaming) — Finding 1, the F9 core fix

**Analog:** `backend/app/services/agent_loop.py:1352-1708` (the Deep gateway consumer — VERBATIM TEMPLATE) + the existing in-file threadpool drain at `task_service.py:121-193`.

**Current F9 bug-site** (`task_service.py:176-184`) — discards `calling_mode`, bypasses the gateway entirely (OpenAI-only path):
```python
def _run_sync() -> tuple[str, list[dict]]:
    stream, _calling_mode = create_adaptive_streaming_chat(   # ← discards calling_mode (the bug)
        messages=messages,
        model=model,
        user_settings=user_settings,
        tools_override=tools,
    )
    try:
        return _consume_sync_stream(stream)                   # ← OpenAI-shaped accumulator only
    finally:
        ...
```

**Gateway-drive pattern to copy** (analog `agent_loop.py:1558-1580` for native + `:1633-1672` for openai-compat). `open_stream` is `async def` (picks the adapter) but the RETURNED stream is a **bare SYNC generator** — IN-05. Drive it with `for chunk in stream:` inside `run_in_threadpool`, `close_fn=stream.close`:
```python
# Source: agent_loop.py:1558-1560/:1633-1635 (open_stream call) + :1575-1580 (drain+close)
from app.services.provider_gateway import GatewayRequest, open_stream
_gw_request = GatewayRequest(
    messages=messages, model=model, active_provider_name=<adapter_provider>,
    tools=tools, user_settings=user_settings, tool_choice="auto",
)
stream, calling_mode = await open_stream(<adapter_provider>, _gw_request)   # async call, SYNC stream
# Drive in a worker thread (mirror _consume_sync_stream / _drain_stream_with_close_on_cancel):
#   for event in stream:        ← NEVER `async for` (annotation lies — IN-05)
#   ... finally: close = getattr(stream, "close", None); close and close()
```

**Canonical-event drain pattern to copy** — the shared `_on_chunk` accumulator (analog `agent_loop.py:1382-1506`). Build `tool_calls_buffer` from the two NON-colliding families (one stream emits only one family):
```python
# Source: agent_loop.py:1433-1491 (the _on_chunk event-type dispatch)
# delta            → content_parts.append(event["content"])
# reasoning_delta  → reasoning_parts.append(event["content"])
# tool_preparing   → buffer[idx] = {"id": event.get("id",""), "name": event["name"], "arguments": ""}   (openai-compat: _build_from_progress)
# tool_args_progress→ buffer[event["tool_index"]]["arguments"] = event.get("code_so_far","")  (full cumulative — L-4)
# tool_start       → buffer[len(buffer)] = {"id": event["id"], "name": event["name"], "arguments": json.dumps(event["args"])}  (anthropic/google)
```
The sub-agent loop may IGNORE `usage`/`finish` events today (no thought_signature round-trip needed unless the harness loops Gemini-3 — confirm in UAT, Assumption A1).

**STRUCTURED-recovery residue to copy (D-03 half b)** — the consumer-side L-1 inject + L-3 post-parse (analog `agent_loop.py:1639-1696`). The gateway openai_compat adapter SKIPS `tool_preparing`/`tool_args_progress` and does NOT inject on STRUCTURED (`openai_compat.py:306`), so the harness consumer MUST replicate both halves, gated on `calling_mode`:
```python
# Source: agent_loop.py:1639-1648 (L-1 inject, inject-ONCE flag) + :1675-1696 (L-3 post-parse)
from app.services.agent_loop import TOOL_USAGE_INSTRUCTIONS, _format_tool_list   # reuse, never re-derive
from app.services.tool_parser import parse_structured_tool_calls
# (a) inject ONCE per loop (carry an `_injected` flag like Deep's `_structured_tools_injected`):
if calling_mode == CallingMode.STRUCTURED and not _injected:
    _tl = _format_tool_list(tools if tools is not None else get_tools(user_settings))
    for _i, _m in enumerate(messages):
        if _m.get("role") == "system":
            messages[_i] = {"role": "system", "content": _m["content"] + TOOL_USAGE_INSTRUCTIONS.format(tool_list=_tl)}
            _injected = True; break
# (b) post-parse AFTER the drain:
if calling_mode == CallingMode.STRUCTURED:
    structured = parse_structured_tool_calls(content)
    if structured:
        tool_calls = [{"id": c.id, "name": c.function.name, "arguments": c.function.arguments} for c in structured]
        content = ""
```
`CallingMode` is **re-exported** from the gateway (`provider_gateway` / `openai_service` — Pitfall 3; not a new enum). There is NO `calling_mode` event — it rides alongside the stream (`events.py:22-24`).

**Protect-surface guard:** Deep `task()`/`analyze_document` callers pass `tools_override`/`system_prompt_override` additively (`None` = byte-identical). Routing Deep sub-agents through the gateway is CORRECT (makes them cross-provider-robust as a bonus) but must be proven non-regressing via the eval `task`-prompt skeleton/twin check (Pitfall 1).

---

### `backend/app/services/sub_agent_models.py` (service, transform) — Finding 3, the stale-id root fix

**Analog:** self — the dead field read at `:69-74` against the real field `UserEffectiveSettings.available_models: list[str]` (`models/user_settings.py:100`) + provider defaults at `config.py:594-604`.

**The dead safety net** (`sub_agent_models.py:70-79`) — reads a field that does NOT exist on `UserEffectiveSettings` (the model has `available_models`, NOT `llm_models`), so `getattr` returns None → `_active_models_list` is ALWAYS `[]` → the validation at `:96` never fires → `_SUB_AGENT_MODEL_DEFAULTS` never engages (silently dead since Phase 085):
```python
# WRONG today (sub_agent_models.py:70-79):
_active_models = (
    user_settings.llm_models                                  # ← field does NOT exist on UserEffectiveSettings
    if (user_settings and getattr(user_settings, "llm_models", None))
    else ""
)
_active_models_list = ([m.strip() for m in _active_models.split(",") if m.strip()] if _active_models else [])
```
```python
# RIGHT (D-06) — read the real field; it is already list[str], no comma-split:
_active_models = (
    user_settings.available_models                            # user_settings.py:100 → list[str]
    if (user_settings and getattr(user_settings, "available_models", None))
    else []
)
_active_models_list = list(_active_models)
```

**Provider defaults that actually fire after the fix** (`config.py:594-604`) — all native-7 present; only Google lags the eval representative (`gemini-2.5-flash` vs `gemini-3.5-flash` — Open Q1, gate on a live `/models` probe at plan time):
```python
_SUB_AGENT_MODEL_DEFAULTS = {
    "anthropic": "claude-haiku-4-5-20251001", "openai": "gpt-5.4-mini",
    "google": "gemini-2.5-flash",  # ← Open Q1: confirm vs gemini-3.5-flash live
    "openrouter": "", "ollama": "",  # flexible → keep candidate best-effort
    "deepseek": "deepseek-v4-flash", "moonshot": "kimi-k2.6",
    "minimax": "MiniMax-M2.5-highspeed", "zhipu": "glm-4.6",
}
```

**The ctx-build-site resolver wrapper (NEW — D-04, resolve-never-mutate D-05).** Add a thin precedence wrapper in THIS file (the non-frozen helper — `sub_agent_service.py` is byte-frozen, D-085-16); thread its output onto `wf_ctx.model` at all 3 build sites (live `threads.py:1216`, resume `_build_resume_context`, Continue `runs.py:814`). Precedence stays `phase.config.model or ctx.model`. **Open Q2:** resume + Continue set `user_settings=None` today — to fire the resolver there, load the owner's effective settings from `run["user_id"]`/`current_user["id"]`, else only `phase.config.model` applies.

---

### `backend/app/api/runs.py` — ask_user_response endpoint (controller, request-response + pub/sub) — Finding 4, the F10 fix

**Analog:** `runs.py:636-673` (the Continue endpoint's owner-scoped + thread-anchor-confirmed `workflow_runs` fallback — D-07 mirrors it verbatim).

**Current endpoint Step-1 SELECT** (`runs.py:512-524`) — keys the path id against `runs` only; for a harness `llm_human_input` prompt the path id is a `workflow_runs.id` → 404:
```python
# runs.py:512-524 (the SELECT that 404s for harness):
row_resp = await aexec(
    supabase.table("runs").select("run_id, thread_id, status")
    .eq("run_id", str(run_id)).eq("user_id", current_user["id"]).maybe_single()
)
row = row_resp.data if row_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

**The fallback to copy** (analog `runs.py:645-670` — the EXACT Continue pattern; BRANCH, never replace per D-08). Insert it BEFORE the `if not row: raise 404`:
```python
# Source: runs.py:645-670 (Continue endpoint) — mirrored for ask_user_response (D-07)
if not row:
    wf_self_resp = await aexec(
        supabase.table("workflow_runs").select("id, thread_id")
        .eq("id", str(run_id)).eq("user_id", current_user["id"]).maybe_single()   # owner-scoped
    )
    wf_self = wf_self_resp.data if wf_self_resp is not None else None
    if wf_self:
        anchor_resp = await aexec(
            supabase.table("threads").select("active_workflow_run_id")
            .eq("id", wf_self["thread_id"]).eq("user_id", current_user["id"]).maybe_single()   # thread-anchor confirm
        )
        _anchor = (anchor_resp.data if anchor_resp is not None else None) or {}
        if str(_anchor.get("active_workflow_run_id")) == str(run_id):
            row = {"run_id": str(run_id), "thread_id": wf_self["thread_id"]}   # synthesize → Steps 2-4 persist/emit/PUBLISH under workflow_run id
```
Steps 2-4 (`runs.py:526-588` — persist messages row → `_emit` → `publish_response`) then run UNCHANGED. Because `run_id` is now the workflow_run id, `publish_response` hits `ask_user:{workflow_run_id}:{tcid}` — the SAME channel `subscribe_for_response` blocks on (`phase_types.py:469` passes `ctx.run_id` = workflow_run id). Deep's runs-keyed path stays untouched (D-08). 404 (never 403) on missing — no existence leak (T-092-07-02).

---

### `backend/app/services/harness/programmatic.py` (utility, transform) — Finding 5a, split_topic

**Analog:** self — `split_topic:89` reads the literal `'topic'` key:
```python
# programmatic.py:89 (TODAY — reads only 'topic'; runs carry 'kickoff_prompt'):
topic = (input.get("topic") or "").strip()
```
**Fix (D-09a):** alias both keys (code half is load-bearing) — `topic = (input.get("topic") or input.get("kickoff_prompt") or "").strip()`. Paired with the seed `input_keys` edit (migration below) — the executor builds `fn_input` only for keys in `input_keys`, so the seed must surface `kickoff_prompt` to the fn (seed-only edit verified INSUFFICIENT — Pitfall 4). Same root cause revives the `llm_batch_agents` fan-out (`_collect_sub_questions` at `phase_types.py:479-484` reads the `sub_questions` split_topic produces).

---

### `backend/app/services/harness/reachability.py` (utility, pure lint) — Finding 5c, safe-by-construction

**Analog:** self — the existing `LintError` NamedTuple (`:28-32`) + the established rule shape (e.g. `unsatisfiable_skip` at `:92-101`, `orphan_phase` at `:127-131`). Each rule appends `LintError(code, phase_slug, message)` into the `errors` list inside `lint_workflow`.

**New rule to add (D-10) — `INPUT_UNSATISFIED`,** matching the established pattern (pure, no I/O). Append `_check_input_contracts(phases)` results into `lint_workflow`'s `errors` list. Mirror the executor's resolution (a phase's `input_keys` must be satisfiable by an upstream phase output OR a known run input):
```python
# Mirror the existing rule shape (reachability.py:92-101 / :127-131):
_KNOWN_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "topic"})   # what create_workflow_run stores
# for each phase in phase_index order: any input_key not in produced (upstream slugs + output_keys)
# and not in _KNOWN_RUN_INPUT_KEYS → errors.append(LintError("input_unsatisfied", p.slug, "..."))
```
**SCOPE GUARD (D-10):** this is the ONLY new lint dimension — no full contract-validation framework, no builder. The 4 seeds MUST lint clean AFTER the split_topic seed fix lands (so the migration + this rule land together / seed fix first).

---

### `backend/app/services/harness_engine.py` + `backend/app/api/threads.py` (service orchestrator + controller) — Finding 6, the shared surfacing helper (D-11)

**Analog:** `threads.py:1268-1373` (the live-kickoff F6/F7 surfacing block — the ONLY place that currently emits the answer) + the engine terminal `harness_engine.py:661-696` (which sets `ctx.final_output`/`final_source_refs`/`final_citations`/`final_confidence` but does NOT surface them).

**The block to EXTRACT** (`threads.py:1268-1373`, summarized — emit on producer stream then persist):
```python
# threads.py:1310-1354 (the emit half — copy into the shared helper):
if _wf_final_text:
    await _harness_emit(redis, run_id, "delta", content=_wf_final_text)         # LIVE render
if _wf_source_refs:  await _harness_emit(redis, run_id, "sources", sources=_wf_source_refs)
if _wf_citations:    await _harness_emit(redis, run_id, "citations", citations=_sse_citations)  # passage ≤400
if _wf_confidence:   await _harness_emit(redis, run_id, "confidence", level=..., avg_similarity=..., disclaimer=...)
# threads.py:1361+ (the persist half — insert_assistant_message with source_refs + confidence, mirroring Deep)
```

**Refactor target (D-11):** move this into ONE shared helper invoked on `run_workflow`'s success terminal (`harness_engine.py:689-696`), so live + resume + Continue all surface identically. Currently resume (`_build_resume_context` path) and Continue (`_harness_continuation` at `runs.py:814-873`) call `run_workflow` directly and NEVER reach the threads.py surfacing block → they lose the answer (verified: `_harness_continuation` has no F6/F7 block after `run_workflow` returns).

**Ordering + single-persist-owner (Pitfall 5 — CRITICAL):**
- Mirror `_shielded_finalize` ordering — emit `delta` + grounding BEFORE the terminal `run_completed` (the terminal `_emit` is at `harness_engine.py:696`, durable `finish_run` at `:691`).
- Pick ONE persist owner per path: the live path currently persists via `_result_sink["persist"]` + `_shielded_finalize`; resume/Continue have NO `_result_sink`/`_shielded_finalize` → the helper must persist DIRECTLY there. Remove the inline `threads.py:1268-1373` block in the SAME commit so there is exactly one surfacing site (no double-emit / two assistant messages).

---

### `backend/app/services/harness/phase_types.py` + `backend/app/api/panel.py` + `frontend/src/lib/api.ts` — Finding 6 / D-12, the draft carry

**Analog:** `phase_types.py:427-435` (the durable `ask_user_prompt` `tool_calls[0]` payload) + `phase_types.py:457-463` (the `ask_user_prompt` SSE emit) + `panel.py:144-152` (the `/pending` replay payload).

**Add `draft` to all three** (the prior phase's text — the thing being confirmed; existing event vocabulary, no new event type):
```python
# phase_types.py:427-435 — durable prompt row payload (ADD "draft"):
"tool_calls": [{"kind": "ask_user_prompt", "tool_call_id": tool_call_id,
                "prompt": prompt, "options": options, "timeout_seconds": timeout_seconds,
                "run_id": str(run_id), "draft": <prior phase text>}]   # ← D-12 ADD
# phase_types.py:457-463 — SSE emit (ADD draft=...); panel.py:144-152 — /pending payload (ADD "draft": payload.get("draft"))
```
**Per-phase event-shape contract (agree now so 094 renders without redoing — D-12):** `ask_user_prompt {tool_call_id, prompt, options, timeout_seconds, draft}`; surfacing emits the EXISTING `delta`/`sources`/`citations`/`confidence`. Frontend `PendingAsk` shape (`api.ts`) gets an additive `draft` field; `api.ts:485-575` phase_* dispatch stays purely additive (protect surface).

---

### `supabase/migrations/065_harness_seed_fixes.sql` (migration, batch) — Finding 5, the seed data fixes

**Analog:** the numbered-SQL + operator-SQL-editor-apply pattern (migrations 056-064). Filenames `<digits>_name.sql`; next free number is **065** (064 is the last on disk). Apply via the Supabase SQL editor (NEVER `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (CLAUDE.md).

**Two seed fixes** (against `061_harness_seed_templates.sql`):
- `literature_review` (`061:159`) — `input_keys: ["topic"]` → `["topic", "kickoff_prompt"]` (or `["kickoff_prompt"]`).
- `plan_execute_verify` verify-gate (`061:123-130`) — `on_failure: "retry"` (exhausts to `fail_run`) → route-forward `skip_to_phase:<next>` OR relax the literal `VERIFIED` regex (D-09b).

**🔴 LANDMINE — the 056 immutability trigger BLOCKS the corrective UPDATE (Open Q3, now RESOLVED on disk).** `056_workflow_definitions.sql:81-99` defines a BEFORE-UPDATE trigger that raises on ANY update to a `status='published'` row:
```sql
-- 056_workflow_definitions.sql:85-91 (the blocker):
IF OLD.status = 'published' THEN
  RAISE EXCEPTION 'workflow_definitions row % is published and immutable; create a new version instead',
    OLD.id USING ERRCODE = 'check_violation';
END IF;
```
The 4 seeds ship `status='published'` with `ON CONFLICT (id) DO NOTHING`, so a plain `UPDATE ... definition = ...` will RAISE. The corrective migration must do ONE of (decide at plan time):
1. `ALTER TABLE ... DISABLE TRIGGER workflow_definitions_block_published` → UPDATE → re-ENABLE (simplest; superuser SQL-editor context can do this).
2. `DELETE` + re-`INSERT` the fixed seed rows (same fixed UUIDs `...b3` / `...b2`).
3. New version row (`UNIQUE(slug, version)` → version 2) — heaviest; requires the engine to select the latest published version per slug (it does NOT today — would expand scope). Avoid unless 1/2 are unacceptable.

---

## Shared Patterns

### Gateway consumption (the one home for provider logic — D-02)
**Source:** `backend/app/services/provider_gateway/dispatcher.py:75-116` (`open_stream`) + `events.py` (canonical `GatewayEvent` TypedDicts).
**Apply to:** `task_service.py` (the only harness LLM call site). The harness NEVER adds provider logic above the gateway.
```python
# dispatcher.py:75-78 — the contract (calling_mode rides alongside, never an event):
async def open_stream(provider: str, request: GatewayRequest) -> tuple[AsyncIterator[GatewayEvent], CallingMode]
# events.py:60-80 — type against these; emit_sse is NotRequired[bool] (boundary-gate flag, default True)
```
**IN-05 trap:** the return is annotated `AsyncIterator` but the adapters return SYNC generators. Drive `for chunk in stream:` in `run_in_threadpool`, `close_fn=stream.close`. `async for` will break.

### Owner-scoped + thread-anchor-confirmed resolve (V2/V4 security)
**Source:** `runs.py:645-670` (Continue endpoint).
**Apply to:** the ask_user_response workflow_run fallback (D-07). Always `.eq("user_id", current_user["id"])`; confirm `threads.active_workflow_run_id == run_id`; 404 (never 403) on missing — no existence leak.

### Additive, None-default overrides (the F1-F8 invariant — SC#2)
**Source:** `task_service.py` `tools_override`/`system_prompt_override` (`None` = byte-identical for Deep); F7 return keys additive.
**Apply to:** every change to a shared file (`task_service.py`, `threads.py`, `phase_types.py`, `panel.py`, `api.ts`). Each harness addition defaults to a Deep byte-identical no-op.

### `_shielded_finalize` ordering (durable-UPDATE-before-terminal-emit)
**Source:** `harness_engine.py:689-696` (`finish_run` → audit → `_emit run_completed`).
**Apply to:** the shared surfacing helper (D-11) — emit `delta`/grounding BEFORE the terminal `run_completed`.

### Reuse Deep's STRUCTURED-mode residue (never re-implement — D-03)
**Source:** `agent_loop.py` `TOOL_USAGE_INSTRUCTIONS` (`:608`) + `_format_tool_list` + `tool_parser.parse_structured_tool_calls`.
**Apply to:** `task_service.py` STRUCTURED branch (DeepSeek/Moonshot/GLM/MiniMax). Inject-ONCE flag (Pitfall 2).

---

## No Analog Found

None. Every file in scope has a verbatim in-repo analog (this is a CONSUMPTION + plumbing phase). The only NEW artifact is the corrective migration `065_harness_seed_fixes.sql`, which follows the established numbered-SQL pattern — its only novel constraint is the 056 immutability trigger (resolved above; not a missing-pattern, a migration-shape decision).

---

## Metadata

**Analog search scope:** `backend/app/services/` (task_service, agent_loop, sub_agent_models, harness_engine, harness/programmatic, harness/phase_types, harness/reachability, provider_gateway/{dispatcher,events}), `backend/app/api/` (runs, threads, panel), `backend/app/models/user_settings.py`, `backend/app/config.py`, `supabase/migrations/056-064`.
**Files scanned:** 16 (all verified on disk this session).
**Pattern extraction date:** 2026-06-02
