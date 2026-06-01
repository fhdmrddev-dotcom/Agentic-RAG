# Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening - Research

**Researched:** 2026-06-02
**Domain:** Cross-provider LLM tool-calling inside the harness sub-agent loop; provider-gateway consumption; durable workflow resume/answer surfacing
**Confidence:** HIGH (the gateway contract, the F9/F10 bug-sites, and the Deep consumer pattern are all verified on disk this session; the only [ASSUMED] items are the live behavior of the STRUCTURED post-parse path inside `task_service` and the Google default-model currency)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Phase rescoped — PARITY-01 (Deep-mode Anthropic polish) re-deferred; 093 = harness cross-provider + phase-type hardening.
- **D-02:** Harness reaches parity by **consuming the shared provider gateway** (Phase 092.5), NOT by adding a harness-local provider branch. One home for all provider logic.
- **D-03:** The gateway must cover BOTH halves: (a) native Anthropic/Google SDK boundary AND (b) STRUCTURED-mode tool-call recovery (`TOOL_USAGE_INSTRUCTIONS` injection + `parse_structured_tool_calls`) for the OpenAI-compat natives (DeepSeek/Moonshot/GLM/MiniMax).
- **D-04:** Fix the stale-model class at the root via ONE shared model-resolver — resolve effective model from active provider's `available_models`; thread onto `wf_ctx.model` at all 3 build sites (live kickoff, resume `_build_resume_context`, POST /continue). Precedence: `phase.config.model or ctx.model`.
- **D-05:** **Resolve, never mutate.** Do NOT change `override_provider` to reset saved `llm_model` globally.
- **D-06:** Fix the dead safety net — `resolve_sub_agent_model_safely` (`sub_agent_models.py:70`) reads non-existent `user_settings.llm_models`; the real field is `available_models`. Confirm per-provider defaults current before enabling. `sub_agent_service.py` is byte-frozen (D-085-16) — fix via the replicating helper, do not edit the frozen file.
- **D-07:** ask_user fix = **Option (i): answer endpoint detects a workflow_run id.** `POST /runs/{id}/ask_user_response` falls back to a `workflow_runs` ownership resolve (owner-scoped, anchor-confirmed) — exactly the Continue endpoint pattern (`runs.py:645-670`) — then publishes/emits under the workflow_run id. Rejected Option (ii).
- **D-08:** **Branch, never replace** — when the id IS a real `runs.run_id` (Deep), the existing runs-table SELECT must still succeed.
- **D-09:** Fix BOTH seed bugs: (a) `split_topic` reads literal `'topic'` but runs carry `kickoff_prompt` → code fix paired with seed `input_keys` edit (seed alone insufficient, verified). (b) Relax verify-gate: route-forward (`skip_to_phase`) or relax the literal `VERIFIED` regex so a non-echoing model doesn't dead-end the run.
- **D-10:** **Safe-by-construction** — 5 phase-types must be robust contract-validated primitives, and the publish-time reachability lint (091) must be extended to catch input/output-contract breaks. Scope guard: harden the 5 + extend the lint — no full contract-validation framework, no builder.
- **D-11:** Wire F6/F7 answer surfacing into resume + Continue re-entry paths. Cleanest: refactor surfacing into ONE shared helper `run_workflow` calls on its success terminal.
- **D-12:** Carry the prior phase's draft into `ask_user_prompt` payload + durable row + frontend `PendingAsk` shape. Agree the per-phase event-shape contract now so 094 renders it without redoing it.
- **D-13:** MANDATORY UAT gate = native-7 × all-5-phase-types × all-4-seed-workflows live, plus 4-axis bandwidth, plus resume + Continue + reload + Deep-parity regression rows. Seed the runs. Add live-DB / real-provider tests (audit row 31). Authored in VALIDATION.md.
- **D-14 (🔴 RED LINE):** Investigate first; never break working things. Deep is byte-identical on all 7. Every fix is at the service boundary or purely additive.

### Claude's Discretion
- Exact gateway consumption mechanism inside `task_service` (how the harness sub-agent loop calls the gateway), provided D-02/D-03/D-14 hold.
- The shared model-resolver's exact signature/location, provided D-04/D-05 hold.
- The shared answer-surfacing helper's exact shape (D-11).

### Deferred Ideas (OUT OF SCOPE)
- The provider-gateway extraction itself → Phase 092.5 (SHIPPED).
- The visible workflow legibility frame (phase timeline, run-card, mode clarity) → Phase 094 (sketch-first). 093 ships substrate/events, 094 ships chrome.
- PARITY-01 (Deep-mode Anthropic polish) → re-deferred.
- Workflow builder / authoring UI → v2.9. New phase-types → none. Deep behavior changes → none.
- Admin/settings-controllability-at-scale → SEED-024 / SEED-012. Native Google SDK service → SEED-028 (behind the gateway). `llm_judge` validator → v2.9.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARITY-02 | The Harness path reaches cross-provider parity by consuming the gateway — all 5 phase-types + all 4 seed workflows run end-to-end on native-7: shared model-resolver, ask_user round-trip, 3 never-run phase-types completed + safe-by-construction lint, resume/Continue surface answer + draft. Deep byte-identical. Acceptance = native-7 × 5-phase-type × 4-workflow LIVE UAT + live-DB/real-provider tests. | Routing `task_service._stream_one_iteration:177` + `run_task_sub_agent:379` through `open_stream` + consuming `calling_mode` (Finding 1); the Deep consumer pattern at `agent_loop.py:1352-1708` is the verbatim template (Finding 2); the model-resolver shape (Finding 3); the F10 workflow_run-id branch (Finding 4); the lint extension + split_topic/verify-gate fixes (Finding 5); the shared surfacing helper (Finding 6); the live UAT + live-DB tests (Validation Architecture). |
</phase_requirements>

## Summary

Phase 092.5 shipped exactly the seam Phase 093 needs: `provider_gateway/open_stream(provider, request) -> (stream, CallingMode)` is the single home for all provider dispatch, and Deep mode is verified byte-identical on the native-7. **093 is a pure CONSUMPTION + plumbing phase — it adds no provider logic above the gateway.** The single milestone-blocking requirement (PARITY-02) decomposes into five mechanically-independent edits plus a UAT gate:

1. **Route the harness sub-agent loop through the gateway.** `task_service._stream_one_iteration` (`:177`) currently calls `create_adaptive_streaming_chat(...)` directly, **discards `calling_mode`**, and drives the OpenAI-shaped sync accumulator `_consume_sync_stream`. This is the F9 bug-site: native Anthropic/Google never reach their SDK adapters, and the OpenAI-compat natives never get STRUCTURED-mode recovery, so `search_documents` is narrated as text and never fires. The fix is to call `open_stream(provider, GatewayRequest(...))`, consume the canonical `GatewayEvent` stream, and — when `calling_mode == STRUCTURED` — replicate the consumer-side residue the Deep path keeps (TOOL_USAGE_INSTRUCTIONS injection + `parse_structured_tool_calls`). The Deep consumer at `agent_loop.py:1352-1708` is the verbatim template.

2. **One shared model-resolver** kills the stale-id class. The real field is `UserEffectiveSettings.available_models: list[str]` — the dead safety net at `sub_agent_models.py:70` reads `user_settings.llm_models` which **does not exist**, so the validation never fires and `_SUB_AGENT_MODEL_DEFAULTS` never engages. Fix that one field read AND thread an effective model onto `wf_ctx.model` at all 3 build sites (live `threads.py:1216`, resume `_build_resume_context`, Continue `runs.py:814`). Precedence `phase.config.model or ctx.model`. All native-7 defaults exist in the registry; only Google's default (`gemini-2.5-flash`) lags the eval representative (`gemini-3.5-flash`).

3. **ask_user round-trip (F10)** is an id-namespace mismatch. The harness `llm_human_input` executor stores `run_id = ctx.run_id` (the **workflow_run id**) in the durable prompt row and subscribes on `ask_user:{workflow_run_id}:{tcid}`. The frontend posts the answer to `/runs/{workflow_run_id}/ask_user_response`, whose Step-1 SELECT queries the `runs` table → 404. Fix: branch on id-namespace exactly like the Continue endpoint (`runs.py:645-670`) — resolve a `workflow_runs` row under caller ownership + thread anchor, then persist/emit/publish under that workflow_run id. Deep's runs-keyed path stays untouched (D-08).

4. **Phase-type completion** is two seed bugs + a lint extension. `split_topic` reads `input.get("topic")` but the run inputs carry `kickoff_prompt` — a code alias + seed `input_keys` edit. The `plan_execute_verify` verify-gate uses `on_failure:"retry"` on a literal `VERIFIED` regex that exhausts to `fail_run` — relax to route-forward. The 091 reachability lint (`harness/reachability.py`) is extended with an input/output-contract check so a phase reading a never-produced key fails validation, not runtime.

5. **Answer surfacing** (D-11/D-12): the F6/F7 surfacing currently lives inline in the live-kickoff branch (`threads.py:1268-1418`) and is never reached by resume/Continue (both call `run_workflow` directly). Refactor into one shared helper invoked on `run_workflow`'s success terminal.

**Primary recommendation:** Sequence the work so the gateway-consumption rewrite of `task_service` (Finding 1) lands FIRST as its own task with the Deep-consumer-template comparison and the byte-identical-Deep guard, then the model-resolver, then ask_user, then the phase-type/lint fixes, then the surfacing refactor — each isolatable and independently testable. The acceptance gate is the live native-7 × 5-phase-type × 4-workflow UAT using the 092.5 skeleton-diff + Anthropic-twin method.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-provider streaming dispatch + chunk normalization | API/Backend — `provider_gateway/` | — | 092.5 made this the single home; 093 CONSUMES it, never re-derives (D-02/D-14) |
| STRUCTURED-mode tool recovery (inject + post-parse) | API/Backend — harness consumer (`task_service`) | gateway surfaces `calling_mode` | The gateway deliberately keeps L-1 injection + L-3 post-parse consumer-side (openai_compat.py:36-42); the harness must replicate the Deep consumer residue |
| Sub-agent model resolution | API/Backend — `sub_agent_models.py` resolver + ctx build sites | `config._SUB_AGENT_MODEL_DEFAULTS` | Resolve-don't-mutate (D-05); the resolver consults `available_models` + provider defaults |
| ask_user round-trip (pause/resume) | API/Backend — `runs.py` answer endpoint + `ask_user_service` pub/sub | `workflow_runs` ownership resolve | The id-namespace branch lives at the HTTP boundary; the channel keying is fixed already (it's the answer endpoint that 404s) |
| Workflow phase orchestration + completion surfacing | API/Backend — `harness_engine.run_workflow` | shared surfacing helper | The engine owns the terminal; the surfacing helper must move from the live-only branch to the engine terminal so all 3 entry paths surface (D-11) |
| Definition validation (reachability + contract) | API/Backend — `harness/reachability.py` (pure) | publish endpoint | Publish-time pure lint; no I/O; extend for input/output-contract breaks (D-10) |
| Per-phase render of answer/sources/confidence | Frontend (Phase 094) | 093 emits the events | 093 ships the event vocabulary (delta/sources/citations/confidence); 094 renders the chrome |

## Standard Stack

This is a backend consumption/plumbing phase inside an existing codebase. **No new dependencies** (CLAUDE.md: raw SDK only, no LangChain/LangGraph; the gateway already abstracts dispatch). The "stack" is the existing modules 093 consumes and modifies.

### Core (consumed verbatim — do NOT re-implement)
| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `backend/app/services/provider_gateway/dispatcher.py` | `open_stream(provider, GatewayRequest) -> (stream, CallingMode)` | The 092.5 seam; single source of provider dispatch (GATEWAY-01) [VERIFIED: on disk] |
| `backend/app/services/provider_gateway/events.py` | Canonical `GatewayEvent` TypedDicts (delta/reasoning_delta/tool_preparing/tool_args_progress/tool_start/finish/usage/usage_delta) | The wire vocabulary; type 093 against these [VERIFIED: on disk] |
| `backend/app/services/provider_gateway/openai_compat.py` | The entangled adapter — owns `<think>` machine, reasoning routing, usage accumulation, 5KB boundary, EMITS canonical events, SURFACES `calling_mode` | The STRUCTURED-recovery half lives partly here (event emit) and partly consumer-side (inject + post-parse) [VERIFIED: on disk] |
| `app.services.tool_parser.parse_structured_tool_calls` | STRUCTURED-mode tool-call extraction from full text | Deep's L-3 post-parse; harness reuses it [VERIFIED: agent_loop.py:60,1676] |
| `agent_loop.TOOL_USAGE_INSTRUCTIONS` + `_format_tool_list` | STRUCTURED-mode prompt injection (L-1) | Deep's injection; harness reuses [VERIFIED: agent_loop.py:608,1342,1640] |
| `config._SUB_AGENT_MODEL_DEFAULTS` | Per-provider safe sub-agent defaults | The fallback the dead safety net should consult (D-06) [VERIFIED: config.py:594] |

### Supporting (modified — additive, None-default)
| Module | Change | Constraint |
|--------|--------|------------|
| `backend/app/services/task_service.py` | `_stream_one_iteration` / `_consume_sync_stream` rewired to drive the gateway + consume `calling_mode` | `None`-default behavior for Deep `task()`/`analyze_document` callers must be byte-identical (protect surface) |
| `backend/app/services/sub_agent_models.py` | `resolve_sub_agent_model_safely` reads `available_models` not `llm_models`; the resolver gets a thin precedence wrapper for ctx build sites | Replicates frozen `sub_agent_service.py` logic; never edit the frozen file (D-06) |
| `backend/app/api/runs.py` | `submit_ask_user_response` branches on id-namespace (workflow_run fallback) | Branch, never replace (D-08) |
| `backend/app/services/harness/programmatic.py` | `split_topic` aliases `kickoff_prompt`→`topic` | Pure/idempotent contract preserved |
| `backend/app/services/harness/phase_types.py` | (possibly) `_exec_programmatic` input aliasing; draft carry into `ask_user_prompt` payload | Additive |
| `backend/app/services/harness/reachability.py` | New `INPUT_UNSATISFIED` lint code | Pure function; no I/O |
| `backend/app/services/harness_engine.py` | Shared surfacing helper invoked on `run_workflow` success terminal | Mirror `_shielded_finalize` ordering |
| `backend/app/api/threads.py` | Live-kickoff surfacing block (`:1268-1418`) extracted into the shared helper | Deep `else` branch byte-identical (protect surface) |
| `supabase/migrations/061_harness_seed_templates.sql` | NEW migration (062+) overriding `literature_review` seed `input_keys` + `plan_execute_verify` verify-gate `on_failure` | Numbered migration; apply via SQL editor (CLAUDE.md) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Routing `task_service` through `open_stream` | A harness-local provider branch mirroring agent_loop's 3 branches | REJECTED by D-02 — creates the "third copy" of the 4-provider dispatch (075.x drift risk). The gateway is the one home. |
| Option (i) ask_user fix (endpoint detects workflow_run id) | Option (ii) — harness stores producer id in the prompt row | REJECTED by D-07 — the producer id is re-minted per resume/Continue, so it's not stable across restarts → would re-break resume. |
| Aliasing `kickoff_prompt`→`topic` in code | Editing the seed `input_keys` alone | INSUFFICIENT (verified) — the executor builds `fn_input` only for keys present in `accumulated_outputs` OR `run_inputs`; `run_inputs` carries `kickoff_prompt`, not `topic`, so `input_keys:["topic"]` resolves to nothing. Need BOTH the seed edit AND the code alias. |

**Installation:** None — no packages added.

**Version verification:** N/A (no new packages). Native-7 sub-agent default models verified present in `config.py` MODEL_CAPABILITIES this session [VERIFIED: config.py:196-241]:
- `anthropic: claude-haiku-4-5-20251001` ✓ (line 209)
- `openai: gpt-5.4-mini` ✓ (line 196)
- `google: gemini-2.5-flash` ✓ (line 221) — **but lags eval representative `gemini-3.5-flash` (line 231); see Open Questions**
- `deepseek: deepseek-v4-flash` ✓ (line 236)
- `moonshot: kimi-k2.6` ✓ (line 241)
- `minimax: MiniMax-M2.5-highspeed` ✓ (line 115)
- `zhipu: glm-4.6` ✓ (line 121)

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────── HARNESS KICKOFF (3 entry paths) ───────────────┐
                         │                                                                │
  live POST /threads ────┤  threads.py:1216  (wf_ctx, MODEL THREADING D-04)               │
  startup sweep      ────┤  harness_engine._build_resume_context  (resume)                │
  POST /continue     ────┤  runs.py:814  _harness_continuation  (Continue)                │
                         └───────────────────────────┬────────────────────────────────────┘
                                                      │ wf_ctx (run_id=workflow_run, producer_run_id=runs row)
                                                      ▼
                                       harness_engine.run_workflow(run_id, definition, ctx)
                                                      │  index-driven, locked phase order
                                  ┌───────────────────┼────────────────────────────────┐
                                  ▼                   ▼                                  ▼
                        PHASE_TYPE_REGISTRY dispatch (phase_types.py)
                ┌──────────────┬──────────────┬──────────────┬───────────────┬──────────────┐
                ▼              ▼              ▼              ▼               ▼
          programmatic    llm_single      llm_agent    llm_batch_agents  llm_human_input
          split_topic     _stream_one_   run_task_     gather(run_task_   ask_user pub/sub
          (pure Python)   iteration      sub_agent     sub_agent × N)     (subscribe→emit→block)
                │              │              │              │               │
                │              └──────┬───────┴──────────────┘               │
                │                     ▼  (THE F9 BUG-SITE — 093's core fix)   │
                │      task_service._stream_one_iteration:177                 │
                │      ❌ TODAY: create_adaptive_streaming_chat() discards     │
                │         calling_mode → _consume_sync_stream (OpenAI-shaped)  │
                │      ✅ 093:  open_stream(provider, GatewayRequest)          │
                │              ─→ canonical GatewayEvent stream               │
                │              ─→ if calling_mode==STRUCTURED:                 │
                │                   inject TOOL_USAGE_INSTRUCTIONS (L-1)       │
                │                   + parse_structured_tool_calls (L-3)        │
                │                     │                                        │
                │                     ▼                                        │
                │      provider_gateway.open_stream  (092.5 — CONSUMED)        │
                │      ┌─────────────┬─────────────┬──────────────────────┐    │
                │      ▼             ▼             ▼                       │    │
                │   anthropic.py  google.py   openai_compat.py            │    │
                │   (NATIVE)     (NATIVE)     (NATIVE or STRUCTURED;       │    │
                │                             <think>/reasoning/usage/     │    │
                │                             5KB boundary owned here,     │    │
                │                             EMITS canonical events,      │    │
                │                             SURFACES calling_mode)       │    │
                │      └──────────────────────────────────────────────────┘    │
                ▼                                                               │
          run_workflow SUCCESS TERMINAL (harness_engine.py:661-696)            │
          sets ctx.final_output / final_source_refs / final_citations /        │
          final_confidence                                                     │
                │                                                              │
                ▼  D-11: SHARED SURFACING HELPER (move out of threads.py:1268) │
          emit delta + sources + citations + confidence on producer stream;    │
          persist assistant message + grounding (insert_assistant_message)     │
          ─→ identical for live / resume / Continue                            │
                                                                               │
  ask_user ANSWER (F10 fix): frontend POST /runs/{workflow_run_id}/ask_user_response
          runs.py:496  ─→ Step1 SELECT runs table (Deep path, KEEP)
                       ─→ if 404: workflow_runs fallback (owner-scoped + thread anchor)
                          then persist + emit + PUBLISH under workflow_run id
                          ─→ ask_user_service publishes ask_user:{wf_run}:{tcid}
                          ─→ wakes the harness subscribe_for_response (same channel) ◄──┘
```

A reader can trace the primary use case: a user kicks off `research_summarize` on DeepSeek → `run_workflow` runs the `research` (`llm_agent`) phase → `run_task_sub_agent` → `_stream_one_iteration` opens the gateway stream for DeepSeek, gets `calling_mode` (NATIVE for deepseek per registry) → `search_documents` fires → grounding accumulates → `summarize` (`llm_single`) phase → terminal → shared helper surfaces the cited answer.

### Recommended Code Structure (the edits, by file)
```
backend/app/services/
├── task_service.py            # Finding 1 — gateway consumption + calling_mode + STRUCTURED residue
├── sub_agent_models.py        # Finding 3 — available_models field fix + resolver wrapper
├── harness_engine.py          # Finding 6 — shared surfacing helper on success terminal
├── harness/
│   ├── programmatic.py        # Finding 5 — split_topic kickoff_prompt alias
│   ├── phase_types.py         # Finding 5 — _exec_programmatic input aliasing (alt site); Finding 6 — draft carry
│   └── reachability.py        # Finding 5 — INPUT_UNSATISFIED lint code
backend/app/api/
├── runs.py                    # Finding 4 — ask_user_response workflow_run-id branch
└── threads.py                 # Finding 6 — extract surfacing block into the shared helper; D-04 model thread
supabase/migrations/
└── 0NN_harness_seed_fixes.sql # Finding 5 — literature_review input_keys + verify-gate on_failure
```

### Pattern 1: Driving the gateway sync-generator inside the harness sub-agent loop
**What:** `open_stream` is `async def` but the adapters return **bare SYNC generators** driven in a threadpool (IN-05 sync-generator trap). The harness must drive with `for chunk in stream:` inside `run_in_threadpool`, never `async for`.
**When to use:** In the rewrite of `_stream_one_iteration` / `_consume_sync_stream`.
**Example:**
```python
# Source: agent_loop.py:1633-1672 (Deep consumer template) + task_service.py:176-193 (existing threadpool pattern)
# open_stream is async (picks the adapter); the RETURNED stream is a sync generator.
stream, calling_mode = await open_stream(provider, gw_request)   # async call, sync stream
# Drive the sync stream in a worker thread, mirroring _consume_sync_stream:
def _drain() -> tuple[str, list[dict], str]:   # (content, tool_calls, reasoning)
    content_parts, reasoning_parts = [], []
    buffer: dict[int, dict] = {}              # build from tool_preparing + tool_args_progress
    try:
        for event in stream:                  # NEVER async for (the annotation lies — IN-05)
            et = event.get("type")
            if et == "delta":            content_parts.append(event["content"])
            elif et == "reasoning_delta": reasoning_parts.append(event["content"])
            elif et == "tool_preparing":
                buffer.setdefault(event["index"], {"id": "", "name": "", "arguments": ""})
                buffer[event["index"]]["id"] = event.get("id", "")
                buffer[event["index"]]["name"] = event["name"]
            elif et == "tool_args_progress":
                b = buffer.setdefault(event["tool_index"], {"id": "", "name": "", "arguments": ""})
                b["name"] = event["name"]
                b["arguments"] = event["code_so_far"]   # full cumulative args (Open Q2 / L-4)
            elif et == "tool_start":         # Anthropic/Google family (complete args)
                buffer[len(buffer)] = {"id": event["id"], "name": event["name"],
                                       "arguments": json.dumps(event["args"])}
            # usage/finish: optional — sub-agent loop may ignore usage today
    finally:
        close = getattr(stream, "close", None)
        if close: close()
    return "".join(content_parts), [buffer[i] for i in sorted(buffer)], "".join(reasoning_parts)
content, tool_calls, _reasoning = await run_in_threadpool(_drain)
```
**Note:** The OpenAI-compat adapter emits NO synthetic `tool_start` — build the buffer from `tool_preparing` (id+name) + `tool_args_progress` (`code_so_far` full args). Anthropic/Google emit `tool_start` with complete args. Each stream emits only ONE family, so the two build paths never collide (mirrors the Deep `_build_from_progress` flag at agent_loop.py:1380).

### Pattern 2: STRUCTURED-mode recovery in the harness consumer (D-03 half b)
**What:** When `calling_mode == STRUCTURED` (DeepSeek/Moonshot/GLM/MiniMax models that lack native tool support per `resolve_calling_mode`), the gateway adapter does NOT pass `tools` to the API and does NOT emit `tool_preparing`/`tool_args_progress` (it skips them on STRUCTURED — openai_compat.py:306). The CONSUMER must (a) inject `TOOL_USAGE_INSTRUCTIONS` into the system message before the call, and (b) post-parse the full text with `parse_structured_tool_calls`.
**When to use:** Inside the harness sub-agent loop, gated on `calling_mode`.
**Example:**
```python
# Source: agent_loop.py:1639-1696 (the consumer residue the gateway leaves to the caller — L-1/L-3)
# (a) Inject BEFORE the call (once per loop), into the system message:
if calling_mode == CallingMode.STRUCTURED and not _injected:
    tl = _format_tool_list(sub_tool_schemas)
    for i, m in enumerate(messages):
        if m.get("role") == "system":
            messages[i] = {"role": "system",
                           "content": m["content"] + TOOL_USAGE_INSTRUCTIONS.format(tool_list=tl)}
            _injected = True
            break
# (b) Post-parse AFTER the drain:
if calling_mode == CallingMode.STRUCTURED:
    structured = parse_structured_tool_calls(content)   # content = full text from the drain
    if structured:
        tool_calls = [{"id": c.id, "name": c.function.name, "arguments": c.function.arguments}
                      for c in structured]
        content = ""    # it was a tool call, not user-facing text
```
**Whether the model is NATIVE or STRUCTURED is determined by `resolve_calling_mode(model_id, user_settings)` (openai_service.py:1155)** — the gateway returns it; the harness must honor it. **CRITICAL:** today `_stream_one_iteration` discards it (`stream, _calling_mode = ...`), which is precisely why STRUCTURED-mode natives narrate tools as text and never fire `search_documents` in the harness.

### Pattern 3: id-namespace branch at the ask_user answer endpoint (D-07)
**What:** The answer endpoint's Step-1 SELECT keys the path `{run_id}` against the `runs` table. For Deep that succeeds; for harness `llm_human_input`, the path id is a `workflow_runs.id` (not a `runs` row) → 404. Add a fallback that resolves it as a `workflow_runs` row under caller ownership + thread anchor (exactly the Continue pattern), then persist/emit/PUBLISH under that id so the harness subscribe channel `ask_user:{workflow_run_id}:{tcid}` is woken.
**When to use:** `submit_ask_user_response` (runs.py:496).
**Example (the fallback to add after the Step-1 404, mirroring runs.py:645-670):**
```python
# Source: runs.py:645-670 (the Continue endpoint's proven workflow_run fallback — D-07 mirrors it)
if not row:
    wf_self = (await aexec(
        supabase.table("workflow_runs").select("id, thread_id")
        .eq("id", str(run_id)).eq("user_id", current_user["id"]).maybe_single())).data
    if wf_self:
        anchor = (await aexec(
            supabase.table("threads").select("active_workflow_run_id")
            .eq("id", wf_self["thread_id"]).eq("user_id", current_user["id"]).maybe_single())).data or {}
        if str(anchor.get("active_workflow_run_id")) == str(run_id):
            row = {"run_id": str(run_id), "thread_id": wf_self["thread_id"]}   # synthesize → Deep path persists/publishes under this id
if not row:
    raise HTTPException(404, "Run not found")
# Steps 2-4 (persist messages row + _emit + publish_response) then run unchanged —
# and because run_id is now the workflow_run id, publish_response hits
# ask_user:{workflow_run_id}:{tcid}, the SAME channel subscribe_for_response blocks on
# (phase_types.py:469 passes ctx.run_id = workflow_run id). Deep's runs-keyed path is unchanged (D-08).
```
**Worker-restart path:** the same fix covers the re-subscribe case. After a restart, `resume_stranded_workflows` (harness_engine.py:880-898) calls `resume_pending_prompt(redis, run_id, ...)` with `run_id` = the workflow_run id, re-subscribing on `ask_user:{workflow_run_id}:{tcid}`. The answer endpoint now publishes on the same channel → the re-subscribed handler wakes. (If the answer arrived while no subscriber was alive, the durable `ask_user_response` messages row is already persisted; `ask_user_response_exists` (workflows.py:253) returns True on the next resume sweep and `run_workflow` re-reads the durable answer — both paths covered.)

### Anti-Patterns to Avoid
- **`async for chunk in stream`** — the `open_stream` return annotation says `AsyncIterator` but the adapters return SYNC generators (IN-05). `async for` will raise. Use `for chunk in stream:` in `run_in_threadpool`.
- **Re-implementing the `<think>` machine / reasoning routing / usage accumulation in the harness** — all of that lives in `openai_compat.py` and is EMITTED as canonical events. The harness consumes events; it never re-derives provider normalization (D-02/D-14).
- **Editing `sub_agent_service.py`** — byte-frozen (D-085-16). All sub-agent model fixes go through the replicating `sub_agent_models.py`.
- **Mutating saved `llm_model` / calling `override_provider` to reset it globally** — D-05. Resolve onto `wf_ctx.model` only.
- **Replacing the Deep runs-keyed ask_user SELECT** — D-08. The workflow_run resolve is a FALLBACK appended after the Step-1 404, not a replacement.
- **Editing the published seed JSONB in-place** — published definitions are immutable-on-publish (056 BEFORE-UPDATE trigger). Seed fixes ship as a NEW migration that overrides the row (the seeds use fixed UUIDs + `ON CONFLICT DO NOTHING`, so a corrective migration must UPDATE the `definition` jsonb or insert a new version — confirm the trigger allows the corrective UPDATE; see Landmines).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-provider stream dispatch | A harness-local provider branch | `provider_gateway.open_stream` | The whole point of 092.5 (D-02); a third copy re-opens the 075.x drift cascade |
| `<think>`-strip / reasoning_content routing / usage accumulation | A harness chunk normalizer | The events `openai_compat.py` already emits | Already extracted byte-identically; consume `reasoning_delta`/`delta`/`usage` |
| STRUCTURED tool extraction | A regex/JSON parser for tool calls in text | `tool_parser.parse_structured_tool_calls` + `TOOL_USAGE_INSTRUCTIONS` | Deep's proven L-1/L-3 residue; reuse verbatim |
| Sub-agent model safety | A new cross-provider validator | `resolve_sub_agent_model_safely` (after the field fix) + `_SUB_AGENT_MODEL_DEFAULTS` | The footgun mitigation already exists; D-06 just fixes the field it reads |
| Workflow_run ownership resolve for the answer endpoint | A bespoke ownership query | The Continue endpoint pattern (runs.py:645-670) | D-07 explicitly mirrors it — owner-scoped + thread-anchor-confirmed, no existence leak |
| Confidence / grounding dedup | A new confidence calculator | `_compute_confidence` + `_deduplicate_citations` (already wired into the engine, harness_engine.py:676) | Shared with Deep; F7 already uses it |
| Answer surfacing (delta/sources/citations/confidence emit + persist) | A second surfacing path for resume/Continue | The shared helper extracted from threads.py:1268-1418 | D-11 — one helper on the engine terminal so all 3 paths surface identically |

**Key insight:** Phase 093 has almost no net-new logic. The hard provider work is done (092.5). 093's value is correct CONSUMPTION + moving existing surfacing to a shared site + two seed data fixes + one lint rule. The dominant risk is not building something new — it's accidentally breaking Deep while rewiring `task_service` (a SHARED file).

## Common Pitfalls

### Pitfall 1: Breaking Deep's `task()` / `analyze_document` callers when rewiring `task_service`
**What goes wrong:** `_stream_one_iteration` is called by the harness AND by Deep's `task()` sub-agent tool (and `analyze_document` via the byte-frozen `sub_agent_service`). A naive rewrite changes behavior for Deep sub-agents too.
**Why it happens:** `task_service` is a SHARED file (CONTEXT protect surface). Deep sub-agents currently go through `_consume_sync_stream` (OpenAI-shaped). Routing through the gateway changes which adapter Deep's sub-agents use.
**How to avoid:** The gateway IS the correct path for Deep sub-agents too (Deep's main loop already uses it post-092.5). Routing `task_service` through `open_stream` makes Deep sub-agents cross-provider-correct as a *bonus* — but the byte-identical-Deep guard (D-14) means the rewrite must be proven non-regressing for the Deep `task()` path. Include a Deep-task UAT row (the eval's `task` prompt — `_assert_task_sub_agent`) in the regression set. Note: the eval's `task` cell is KNOWN-FLAKY (D-13) — judge it by skeleton/twin method, not a single run.
**Warning signs:** Deep `task()` sub-agents that previously returned summaries now narrate tools as text on a NATIVE provider, or Anthropic Deep `task()` skeleton diff goes non-empty.

### Pitfall 2: STRUCTURED injection idempotency across iterations
**What goes wrong:** The harness sub-agent loop runs up to `max_steps` iterations. If TOOL_USAGE_INSTRUCTIONS is injected on every iteration, the system prompt grows unboundedly and the model gets confused.
**Why it happens:** The Deep loop injects ONCE (`_structured_tools_injected` flag, agent_loop.py:1639) and the instruction persists in the message history across iterations.
**How to avoid:** Carry an `_injected` flag in the harness loop (like Deep's `_structured_tools_injected`). Inject into the system message once; subsequent iterations already carry it.
**Warning signs:** Repeated TOOL_USAGE_INSTRUCTIONS blocks in the system message on iteration 2+.

### Pitfall 3: Dropping `calling_mode` (the original F9 bug, do not re-introduce)
**What goes wrong:** `stream, _calling_mode = open_stream(...)` discards the mode, so the STRUCTURED skip/inject/post-parse never runs.
**Why it happens:** It's the existing code (`task_service.py:177`). Pitfall 3 / L-3 in 092.5: dropping `calling_mode` is the exact bug that makes the harness OpenAI-only.
**How to avoid:** `stream, calling_mode = await open_stream(...)` and gate the STRUCTURED residue on it. There is NO `calling_mode` event — it rides alongside the stream (events.py:22).
**Warning signs:** DeepSeek/Moonshot/GLM/MiniMax harness runs produce prose describing a search instead of firing `search_documents`.

### Pitfall 4: split_topic seed-only edit (verified insufficient)
**What goes wrong:** Editing the `literature_review` seed `input_keys` from `["topic"]` to `["kickoff_prompt"]` alone makes `_exec_programmatic` resolve `kickoff_prompt` from `run_inputs` — but `split_topic` reads `input.get("topic")` (programmatic.py:89), so it still finds nothing.
**Why it happens:** Two layers — the executor builds `fn_input` from `input_keys`, then the fn reads a hardcoded key. Both must agree.
**How to avoid:** Alias in code. Cleanest: have `split_topic` read `input.get("topic") or input.get("kickoff_prompt")` (handles both the seed key and the run input) AND set the seed `input_keys` to include `kickoff_prompt`. Or alias in `_exec_programmatic` (map `kickoff_prompt`→`topic` when building `fn_input`). The code alias is the load-bearing half; the seed `input_keys` edit makes the executor surface the value to the fn.
**Warning signs:** `literature_review` runs produce `sub_questions: []` → the batch phase degrades to a single sub-agent on the prompt (the `if not sub_questions` fallback at phase_types.py:316).

### Pitfall 5: Surfacing helper double-emit / ordering vs `_shielded_finalize`
**What goes wrong:** Moving the surfacing into the engine terminal could double-emit (engine + the old threads.py block) or emit the terminal `run_completed` before the `delta`/grounding.
**Why it happens:** The live path currently emits surfacing AFTER `run_workflow` returns (threads.py:1268), while the engine emits `run_completed` INSIDE `run_workflow` (harness_engine.py:696). If the helper goes inside `run_workflow`, the ordering relative to `run_completed` and `_shielded_finalize` matters.
**How to avoid:** Place the shared helper so it emits `delta` + `sources`/`citations`/`confidence` BEFORE the terminal `run_completed` (mirror `_shielded_finalize`: durable status UPDATE → persist → terminal emit, harness_engine.py:689-696). Remove the inline threads.py:1268-1418 block in the same commit so there's exactly one surfacing site. The persist must populate `_result_sink["persist"]` for the live path (so `_shielded_finalize` threads the message_id) — but resume/Continue have no `_result_sink`/`_shielded_finalize`, so the helper must do the persist directly on those paths. Reconcile: the helper persists directly and returns the message_id; the live path's `_shielded_finalize` is then a no-op for harness (or the helper installs the persist callable as today). Pick ONE persist owner per path; do not persist twice.
**Warning signs:** Two assistant messages per harness run; references rendering before the answer text; `run_completed` arriving before the `delta`.

### Pitfall 6: Embeddings SPOF masquerading as a provider regression (SEED-048)
**What goes wrong:** During the live native-7 UAT, a search-heavy prompt BLOCKs with ONE identical fingerprint across MANY providers, and you chase a per-provider gateway/harness regression.
**Why it happens:** `search_documents` + ingestion embeddings are hardwired to OpenAI (`retrieval_service.py:36` → `openai_service.embed_texts`) with no fallback. An OpenAI 429/outage breaks RAG grounding for ALL chat providers at once (this exact thing produced a fake 7-provider BLOCK on the 092.5-06 gate).
**How to avoid:** If many providers BLOCK with the SAME fingerprint, check OpenAI embeddings health FIRST (this is a UAT false-alarm guard, NOT a 093 dependency — SEED-048 is the resilience fix, deferred).
**Warning signs:** Uniform `search_documents` failure across providers; OpenAI `429 insufficient_quota` in logs.

## Runtime State Inventory

> This phase is primarily code + 2 seed-data fixes (not a rename/refactor), but the seed-data and durable-state surfaces warrant an explicit inventory.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workflow_definitions` rows b1–b4 (the 4 seeds) carry `definition` JSONB with `literature_review.input_keys:["topic"]` and `plan_execute_verify` verify-gate `on_failure:"retry"`. These are PUBLISHED + immutable-on-publish (056 BEFORE-UPDATE trigger). | NEW corrective migration (062+) — see Landmines for the immutability constraint. Apply via SQL editor (CLAUDE.md). |
| Stored data | `messages` rows with `tool_calls[0].kind = ask_user_prompt` carry `run_id` = workflow_run id (the durable prompt rows). The F10 fix does NOT change what's stored — it fixes the ANSWER endpoint's id resolution. | None — code-only fix at the answer endpoint. |
| Live service config | No external service config (n8n/Datadog/etc.) embeds harness state. | None — verified by scope (backend + Supabase + Redis only). |
| OS-registered state | None — no OS-level registrations. | None — verified by scope. |
| Secrets/env vars | Native-7 provider keys in `backend/.env` (read by name only). `harness_phase_max_steps`, `max_continues_per_run`, `ask_user_max_timeout_seconds`, `task_per_run_concurrency` env knobs already exist. | None — no new secrets. |
| Build artifacts | None — no compiled artifacts; Python source + SQL. | None. |
| Redis keys | `ask_user:{run_id}:{tcid}` pub/sub channels + `ask_user:channels:{run_id}` SET. The F10 fix relies on the harness subscribing on `ask_user:{workflow_run_id}:{tcid}` (already does) and the answer endpoint publishing on the same key (the fix). | Code-only — no key-convention change. |

## Code Examples

### Model resolver (D-04) — recommended signature + location
```python
# Source: composition of resolve_sub_agent_model (user_settings.py:565) + the field fix (D-06)
# Location: extend backend/app/services/sub_agent_models.py (the non-frozen replicating helper).
# (1) The field fix — the dead safety net (sub_agent_models.py:70):
#     WRONG today:  user_settings.llm_models           (does not exist → always "")
#     RIGHT:        user_settings.available_models      (list[str], user_settings.py:100)
_active_models = (
    user_settings.available_models
    if (user_settings and getattr(user_settings, "available_models", None))
    else []
)
_active_models_list = list(_active_models)   # already a list[str] — no comma-split needed

# (2) The ctx-build-site resolver wrapper (NEW — D-04). Resolve, never mutate (D-05):
def resolve_workflow_ctx_model(user_settings) -> str:
    """Effective model for a workflow ctx, resolved from the active provider.
    Precedence at the phase level stays phase.config.model or ctx.model
    (phase_types._effective_model:131); THIS resolves ctx.model itself."""
    if user_settings is None:
        return ""
    # Reuse the safe resolver — fallback to the provider default if the saved
    # llm_model is stale-cross-provider (the BUG-260528-01 footgun, now actually firing
    # because available_models is read correctly).
    return resolve_sub_agent_model_safely(user_settings, override_model=None,
                                          fallback_model=user_settings.llm_model)
# Thread onto wf_ctx.model at all 3 build sites:
#   threads.py:1216  wf_ctx = SimpleNamespace(..., model=resolve_workflow_ctx_model(user_settings), ...)
#   harness_engine._build_resume_context  (user_settings is None on resume → "" → phase.config.model
#                                          still applies; resume reads inputs from durable outputs)
#   runs.py:814 _harness_continuation      (user_settings is None on Continue today — same)
# NOTE: resume + Continue currently set user_settings=None (harness_engine.py:803, runs.py:822).
#       Threading the model there requires loading user_settings for the run owner OR accepting
#       phase.config.model-only on those paths. See Open Questions Q2.
```

### Reachability lint extension (D-10) — input/output-contract check
```python
# Source: extend backend/app/services/harness/reachability.py (the pure 091 lint).
# New LintError code INPUT_UNSATISFIED: a phase's input_keys must be satisfiable by
# either an upstream phase output OR a known run input. Mirror the executor's resolution
# (phase_types._exec_programmatic:205-214 — accumulated_outputs key OR run_inputs key).
_KNOWN_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "topic"})   # what create_workflow_run stores

def _check_input_contracts(phases) -> list[LintError]:
    errors: list[LintError] = []
    produced: set[str] = set()        # keys produced by upstream phases (slug + structured output keys)
    for p in sorted(phases, key=lambda q: q.phase_index):
        input_keys = list(getattr(p.config, "input_keys", []) or [])
        for k in input_keys:
            if k not in produced and k not in _KNOWN_RUN_INPUT_KEYS:
                errors.append(LintError("input_unsatisfied", p.slug,
                    f"input_key {k!r} is never produced by an upstream phase or a run input"))
        # A phase produces its own slug as a key, plus declared output keys if the model carries them.
        produced.add(p.slug)
        produced.update(getattr(p.config, "output_keys", []) or [])   # if/when output_keys exist
    return errors
# Append _check_input_contracts(phases) results into lint_workflow's errors list.
# SCOPE GUARD (D-10): this is the ONLY new lint dimension — no full contract-validation
# framework. The 4 seed shapes must lint clean AFTER the split_topic seed fix (so the
# corrective migration + this lint land together / the seed fix lands first).
```

### Per-phase event-shape contract (D-12) — what 094 will render
```
# 093 EMITS these on the producer stream (run:{producer_run_id}); 094 RENDERS them.
# Vocabulary is the EXISTING delta/sources/citations/confidence (no new event types).
phase_started     { phase: <slug>, phase_index: <int> }            # already emitted (engine)
phase_completed   { phase: <slug>, phase_index: <int> }            # already emitted (engine)
phase_transition  { from_phase: <slug>, to_phase: <slug> }         # already emitted (engine)
ask_user_prompt   { tool_call_id, prompt, options, timeout_seconds,
                    draft: <prior phase text> }                    # D-12 ADD: draft field
delta             { content: <final answer text> }                 # surfacing helper (D-11)
sources           { sources: [<source_ref>...] }                   # surfacing helper (F7)
citations         { citations: [{document_id, chunk_index, passage(≤400), ...}] }
confidence        { level, avg_similarity, disclaimer }
run_completed     { status: "completed"|"failed" }                 # already emitted (engine)
```
The `draft` carry (D-12): the `llm_human_input` executor sets `_first_phase_user_turn`/prior-output text; thread the prior phase's `text` into both the durable `ask_user_prompt` row's `tool_calls[0]` payload AND the `ask_user_prompt` SSE event AND `PendingAsk` (panel.py:144-152 already returns the payload fields — add `draft` to the payload dict at phase_types.py:427-435 and panel.py:144).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `agent_loop.py` had 3 inline provider branches + 3 `_on_chunk_*` | ONE `open_stream` + ONE shared `_on_chunk` consuming canonical events | Phase 092.5 (2026-06-01) | 093 consumes the seam; no provider branch in the harness |
| `task_service` discards `calling_mode`, uses OpenAI-only `_consume_sync_stream` | (093) route through `open_stream`, consume `calling_mode`, STRUCTURED residue | Phase 093 (this) | The F9 fix — harness becomes cross-provider |
| ask_user answer endpoint SELECTs only `runs` table | (093) branch on id-namespace → workflow_runs fallback | Phase 093 (this) | The F10 fix — harness ask_user resumes |
| Surfacing inline in live-kickoff branch only | (093) shared helper on `run_workflow` terminal | Phase 093 (this) | resume/Continue surface identically (D-11) |

**Deprecated/outdated:**
- `sub_agent_models.py:70` reading `user_settings.llm_models` — that field never existed on `UserEffectiveSettings`; the real field is `available_models` (D-06). The safety net has been silently dead since Phase 085.
- `_SUB_AGENT_MODEL_DEFAULTS["google"] = "gemini-2.5-flash"` lags the eval/registry representative `gemini-3.5-flash` (config.py:231). [ASSUMED currency — see Open Questions Q1.]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Deep consumer residue (TOOL_USAGE_INSTRUCTIONS inject + parse_structured_tool_calls) transplants cleanly into the harness sub-agent loop without the full agent_loop machinery (message trimming, force_no_tools, provider-error retry). | Finding 1 / Pattern 2 | The harness loop is simpler than the Deep loop; if the STRUCTURED path needs force_no_tools-on-last-iteration or provider-retry to behave, the transplant is incomplete. Mitigate: include STRUCTURED-mode providers (deepseek/moonshot/glm/minimax) in the UAT and confirm `search_documents` fires. [ASSUMED] |
| A2 | `_SUB_AGENT_MODEL_DEFAULTS["google"]` should be updated to `gemini-3.5-flash` to match the eval representative. | Standard Stack / Open Q1 | If Google's served GA model differs at execution time, the default 404s. Verify against a live `/models` probe before locking. [ASSUMED] |
| A3 | A corrective migration can UPDATE the published `literature_review` / `plan_execute_verify` `definition` JSONB despite the 056 immutability trigger (or the fix ships as a new version row). | Finding 5 / Landmines | If the trigger blocks the UPDATE and a new-version approach is required, the seed-fix task is larger (new UUID + version bump + the engine must select the latest version). [ASSUMED — must verify the trigger scope before planning the migration shape] |
| A4 | resume + Continue paths can accept `phase.config.model`-only model resolution (they set `user_settings=None`), OR loading user_settings for the run owner is acceptable. | Code Examples / Open Q2 | If a resumed/Continue'd run MUST resolve a fresh model from the owner's current provider settings (e.g., the owner switched providers between crash and resume), `user_settings=None` means the resolver returns "" and only `phase.config.model` applies. [ASSUMED] |

## Open Questions

1. **Is `gemini-2.5-flash` (the Google sub-agent default) still served, or should it be `gemini-3.5-flash`?**
   - What we know: the registry has both; the eval (`PROVIDERS`) and CONTEXT D-03 use `gemini-3.5-flash` as the representative; the `_SUB_AGENT_MODEL_DEFAULTS` default is the older `gemini-2.5-flash`.
   - What's unclear: whether `gemini-2.5-flash` still resolves at the live Google endpoint, and which to lock as the default.
   - Recommendation: at plan time, verify against a live Google `/models` probe (the eval's presence/route helpers can drive it) and update the default to the confirmed-served representative. This is a one-line config edit gated on a live check (matches `feedback_prioritize_newest_models` + `feedback_model_names_representative`).

2. **Should resume + Continue load `user_settings` for the run owner to resolve a fresh model, or accept `phase.config.model`-only?**
   - What we know: both paths currently set `user_settings=None` (harness_engine.py:803, runs.py:822). The resolver returns "" without user_settings, so `phase.config.model` is the only model source on those paths.
   - What's unclear: whether D-04 ("thread onto wf_ctx.model at all 3 build sites") requires loading user_settings on resume/Continue, or whether the durable-outputs-driven re-run is fine with phase-level model only.
   - Recommendation: prefer loading the owner's effective settings on resume/Continue (the run owner is known: `run["user_id"]` / `current_user["id"]`) so the resolver fires there too — this is the root-cause fix D-04 intends and closes part of SEED-047. Confirm with the operator at plan time; if loading settings is too heavy on the startup sweep, accept phase-level model and document the limitation.

3. **Does the 056 immutability trigger permit a corrective UPDATE of the seed `definition` JSONB?**
   - What we know: published definitions are immutable-on-publish (HARNESS-02 / 056 BEFORE-UPDATE trigger + FK ON DELETE RESTRICT). The seeds use fixed UUIDs.
   - What's unclear: whether the trigger blocks ALL updates to a `status='published'` row, or only specific columns; whether a corrective fix must be a new version (`UNIQUE(slug, version)` → version 2).
   - Recommendation: read `056_workflow_definitions.sql` trigger body at plan time. If it blocks the UPDATE, ship the seed fix as a new version row and confirm the engine selects the latest published version per slug (or the seed UUIDs are referenced directly by the UAT — adjust accordingly).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Postgres/Auth/Realtime) | All harness DB writes + UAT | ✓ (operator starts) | CLI v2.101 | — |
| Local Redis | Run buffer + ask_user pub/sub + UAT | ✓ (docker-compose.dev.yml) | — | — |
| Native-7 provider keys in backend/.env | Live cross-provider UAT (D-13) | ✓ (operator's .env) | — | — (OpenRouter best-effort, not in gate) |
| Backend uvicorn (operator-started, visible terminal) | Live UAT + SSE capture | ✓ (operator starts; NEVER run_in_background — `feedback_user_starts_backend`) | WORKER_COUNT=2 | — |
| `scripts/capture_sse_baseline.py` + `_diag_skeleton_diff.py` + `eval_cross_provider.py` | D-13 proof method | ✓ (on disk) | — | — |
| Docker sandbox image (`execute_code`) | `plan_execute_verify` execute phase | ✓ (SANDBOX_IMAGE) | 075.1.1 | bare image (slow warm-up) |
| OpenAI embeddings (search_documents) | RAG-grounded UAT prompts | ✓ but SPOF | — | NONE — SEED-048 (UAT false-alarm guard, not a 093 dep) |

**Missing dependencies with no fallback:** None block 093. The OpenAI-embeddings SPOF (SEED-048) is a UAT false-alarm risk, not a blocker.

**Missing dependencies with fallback:** Sandbox bare-image fallback for `execute_code` (slow but functional).

## Validation Architecture

> nyquist_validation is `true` in config.json — this section is MANDATORY and seeds VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend/venv) + the operator-run live drivers (`scripts/`) |
| Config file | `backend/tests/conftest.py` (fixtures incl. `four_seed_defs`); pytest invoked via `backend/venv/Scripts/python.exe -m pytest` |
| Quick run command | `backend/venv/Scripts/python.exe -m pytest backend/tests/test_harness_reachability.py backend/tests/unit/test_085_task_service.py -x` |
| Full suite command | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` (note: ~99-105 pre-existing failures are flaky live-infra per 092.5-05; gate on net-new, not absolute) |

### The two-layer validation model (why wire-format alone is insufficient — D-13)
F1→F8 each passed unit tests and failed live (CONTEXT). Mocked LLM tests prove plumbing, NOT the per-provider round-trip. So 093 validates on TWO layers:
- **Layer 1 — deterministic / mocked (pytest):** lint rules, split_topic aliasing, id-namespace branch routing, surfacing-helper single-emit, model-resolver field fix. Fast, CI-able.
- **Layer 2 — live cross-provider (operator-run):** the native-7 × 5-phase-type × 4-workflow gate using the 092.5 skeleton-diff + Anthropic-twin method. This is the real acceptance bar; closes the mock blind spot (audit row 31).

### Phase Requirements → Test Map
| Req facet | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| PARITY-02 / gateway consumption | `_stream_one_iteration` calls `open_stream` + consumes `calling_mode`; STRUCTURED inject+post-parse fires | unit (mock gateway) | `pytest backend/tests/unit/test_085_task_service.py -x` | ✅ exists; ❌ Wave 0 — add gateway-consumption + STRUCTURED cases |
| PARITY-02 / model resolver | `resolve_sub_agent_model_safely` reads `available_models`; stale-cross-provider → provider default | unit | `pytest backend/tests/unit/test_sub_agent_routing.py -x` | ✅ exists; ❌ Wave 0 — add available_models field case |
| PARITY-02 / ask_user F10 | answer endpoint resolves a workflow_run id (owner+anchor) and publishes under it; Deep runs-id path still 200s | integration (live DB) | `pytest backend/tests/integration/test_092_subagent_parent_fk_live.py` (sibling pattern) | ❌ Wave 0 — new `test_093_ask_user_workflow_run_live.py` |
| PARITY-02 / split_topic | `split_topic` produces sub_questions from `kickoff_prompt`; `literature_review` fans out N>1 | unit | `pytest backend/tests/test_harness_reachability.py -x` (+ new programmatic test) | ❌ Wave 0 — new `test_093_split_topic.py` |
| PARITY-02 / lint | `INPUT_UNSATISFIED` fires for an unproduced input_key; 4 seeds lint clean after the fix | unit (pure) | `pytest backend/tests/test_harness_reachability.py -x` | ✅ exists; ❌ Wave 0 — add INPUT_UNSATISFIED cases |
| PARITY-02 / surfacing | shared helper emits delta+sources+citations+confidence exactly once, before run_completed | unit (mock redis/pool) | new `test_093_surfacing.py` | ❌ Wave 0 |
| PARITY-02 / verify-gate | `plan_execute_verify` reaches completion without dead-ending when VERIFIED isn't echoed | integration | new `test_093_verify_gate_route_forward.py` | ❌ Wave 0 |

### Live cross-provider UAT matrix (D-13 — authored in VALIDATION.md, NOT PLAN tasks)
**Dimension 1 — native-7 × 5-phase-type × 4-seed-workflow (the headline gate).** Seed the runs (no "if data permits"). The 4 seeds collectively exercise all 5 phase types:
- `research_summarize` (llm_agent → llm_single) — run on ALL native-7
- `plan_execute_verify` (llm_single → llm_agent + gate → llm_single) — run on ALL native-7 (exercises execute_code + the verify-gate fix)
- `literature_review` (programmatic split_topic → llm_batch_agents → llm_single) — run on ALL native-7 (exercises the split_topic fix + fan-out)
- `doc_qa_human` (llm_agent → llm_human_input → llm_single) — run on ALL native-7 (exercises ask_user round-trip)

**Dimension 2 — 4-axis bandwidth (UAT scoreboard recipe, MANDATORY):**
| Axis | Coverage |
|------|----------|
| Cross-provider | All native-7 (the matrix above already covers this) |
| Multi-tool | `plan_execute_verify` execute phase (search_documents + execute_code) ≥1 row |
| Parallel-thread | Thread A streaming `literature_review` (batch fan-out) while Thread B accepts a `research_summarize` kickoff |
| Long-message | One workflow kicked off with a ≥5KB prompt OR after ≥50 prior messages in the thread |

**Dimension 3 — durability rows:**
- Resume: kill uvicorn mid-`llm_agent` phase → restart → `resume_stranded_workflows` re-drives → answer surfaces (D-11) on ≥1 native provider.
- Resume mid-ask_user: kill uvicorn while paused in `doc_qa_human` confirm phase → restart → re-subscribe → submit answer → run completes.
- Continue: drive a phase to its step cap → POST /continue → run resumes + surfaces.
- Reload: page reload during a streaming harness run → reconcile → no stale lock (F2 self-heal intact).

**Dimension 4 — Deep-parity regression row (the RED LINE, D-14):** run the 092.5 SSE-diff driver on Deep — Anthropic must stay byte-identical (0 skeleton edits); the other 6 within tool-path-noise. Plus the eval `task` prompt (Deep `task()` sub-agent) to confirm the `task_service` rewrite didn't regress Deep sub-agents.

### How to detect a REAL regression on this non-deterministic surface (inherit 092.5's method)
- **Structural-skeleton diff, not raw diff.** `scripts/_diag_skeleton_diff.py` collapses volatile chunk types (delta/tool_args_progress counts vary run-to-run with zero code change). Gate on the skeleton (event-type order + tool names/sequence + code-exec lifecycle + terminal classification), NOT the raw stream.
- **run1-vs-run2 noise isolation.** Re-run BEFORE+AFTER 2-3× — a residual that changes run1↔run2 is noise; a PERSISTENT structural diff is a regression.
- **Anthropic-as-twin cross-check.** A shared-consumer regression hits Anthropic (whose stream proved 0-edit in 092.5). If Anthropic stays byte-identical, the shared path is intact; per-provider residuals are then adapter/LLM noise.
- **Eval non-regression floor = native-7 16/28.** The `multi-tool`/`task`/`ask_user` cells are KNOWN-FLAKY (moonshot multi-tool can time out; OpenRouter is credit-sensitive). Do NOT over-read cell flips as regressions; the deterministic `factual-doc-search` cell must PASS on all 7.
- **2 live re-checks carried from 092.5 (still owed):** (1) the assistant-message `tool_call_id` is non-empty + round-trips on a LIVE multi-tool turn per compat provider (Supabase `messages.tool_calls`); (2) token totals non-zero + equal across a multi-iteration run (`runs` token cols). These ride the harness UAT (the harness sub-agent loop now drives the same compat adapter).
- **SEED-048 false-alarm guard:** if many providers BLOCK with the SAME fingerprint on a search prompt, suspect the OpenAI-embeddings SPOF before a per-provider regression.
- **Do NOT lean on Playwright (SEED-049):** the E2E suite is rotted (16/17 fail — composer never submits). The live operator UAT + skeleton-diff is the real gate, not Playwright.

### Sampling Rate (Nyquist)
- **Per task commit:** Layer-1 quick run (`pytest <touched test files> -x`) — the deterministic gate for the edited surface.
- **Per wave merge:** full backend suite (gate on net-new failures vs the worktree A/B baseline, per 092.5-05) + the relevant live single-provider smoke (`eval_cross_provider.py --provider <x> --prompt factual-doc-search`).
- **Phase gate (before /gsd-verify-work):** the FULL live native-7 × 5-phase-type × 4-workflow matrix + all 4 durability rows + the Deep-parity regression row — GREEN by the skeleton/twin judgment.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_085_task_service.py` — extend: gateway-consumption (open_stream called, calling_mode honored) + STRUCTURED inject/post-parse cases
- [ ] `backend/tests/unit/test_sub_agent_routing.py` — extend: `available_models` field read; stale-cross-provider → provider default fires
- [ ] `backend/tests/test_harness_reachability.py` — extend: `INPUT_UNSATISFIED` lint cases + 4-seeds-lint-clean-after-fix
- [ ] `backend/tests/test_093_split_topic.py` (NEW) — split_topic reads kickoff_prompt; fan-out N>1
- [ ] `backend/tests/integration/test_093_ask_user_workflow_run_live.py` (NEW, live DB) — workflow_run-id answer resolve + publish; Deep runs-id path unaffected
- [ ] `backend/tests/test_093_surfacing.py` (NEW) — shared helper single-emit + ordering before run_completed
- [ ] `backend/tests/integration/test_093_verify_gate_route_forward.py` (NEW) — verify-gate doesn't dead-end
- [ ] VALIDATION.md — the live native-7 × 5-phase-type × 4-workflow matrix + 4-axis + durability + Deep-parity rows (operator-run; authored here, not PLAN tasks)

## Security Domain

> security_enforcement not set to false in config → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | All endpoints `Depends(get_current_user)`; the ask_user fallback resolves `workflow_runs` UNDER caller ownership (`.eq("user_id", current_user["id"])`) — never trust the path id alone |
| V3 Session Management | no | No new session surface |
| V4 Access Control | yes | RLS on all tables; the workflow_run resolve is owner-scoped + thread-anchor-confirmed (mirrors runs.py:645-670); 404 (never 403) on missing — no existence leak (T-092-07-02). Resume uses the service-role client → retrieval MUST stay owner-scoped (`search_documents` filters by `current_user["id"]` / `run["user_id"]`) |
| V5 Input Validation | yes | Pydantic `AskUserResponseBody`; `WorkflowDefinition.model_validate`; the lint is a pure validation gate (T-091-04 DoS mitigation extended) |
| V6 Cryptography | no | No crypto in scope |

### Known Threat Patterns for {harness + cross-provider}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ask_user answer accepted for another user's run (id confusion) | Spoofing / Elevation | Owner-scoped `workflow_runs` resolve + thread-anchor confirm; 404 on missing (no existence leak) — D-07 mirrors the Continue endpoint's proven gate |
| Resume service-role client reading another user's documents | Information Disclosure | `search_documents` filters by `current_user["id"]` set from the durable `run["user_id"]` (harness_engine.py:773 comment) — retrieval stays owner-scoped despite RLS-bypassing service-role client |
| Malicious workflow definition smuggling code via `fn` | Tampering | Closed `PROGRAMMATIC_PHASE_REGISTRY` (never eval'd, T-091-12) — unchanged; the lint extension adds input-contract DoS protection |
| Stale cross-provider model name leaking to wrong provider client | Tampering (mis-routing) → 400/404 | The model-resolver field fix (D-06) makes the safety net actually validate against `available_models` and fall back to the provider default |
| Unbounded STRUCTURED-instruction growth across iterations | DoS (context bloat) | Inject-once flag (Pitfall 2) |

## Landmines (flag explicitly)

1. **The seed `definition` JSONB is immutable-on-publish.** The `literature_review` `input_keys` fix and the `plan_execute_verify` verify-gate fix touch PUBLISHED rows guarded by the 056 BEFORE-UPDATE trigger (HARNESS-02). **Read the trigger body before writing the migration** — it may block the corrective UPDATE entirely, forcing a new-version row (and the engine must then select the latest published version per slug). This is Open Question 3 and could change the seed-fix task shape materially.

2. **`task_service` is a SHARED Deep + harness file (RED LINE).** Rewiring `_stream_one_iteration` through the gateway changes the path Deep's `task()` sub-agents take too. This is *correct* (Deep sub-agents become cross-provider-robust as a bonus) but MUST be proven non-regressing for the Deep `task()` path (D-14). Land this rewrite as its own task with the byte-identical-Deep guard and the eval `task`-prompt regression check.

3. **The sync-generator trap (IN-05) is the single highest-value first-task fact.** `open_stream` is `async def` annotated `-> AsyncIterator` but returns SYNC generators. Drive with `for chunk in stream:` in `run_in_threadpool`, `close_fn=stream.close`. `async for` will break. (Confirmed: dispatcher.py:89 + the existing task_service.py:135 sync-drain pattern.)

4. **STRUCTURED residue is consumer-side, not in the gateway.** The gateway's openai_compat adapter SKIPS tool_preparing/tool_args_progress on STRUCTURED (openai_compat.py:306) and does NOT inject TOOL_USAGE_INSTRUCTIONS. The harness consumer MUST replicate both halves (inject + post-parse) gated on `calling_mode`. Forgetting this leaves DeepSeek/Moonshot/GLM/MiniMax narrating tools as text (the F9 symptom).

5. **Surfacing single-owner.** Don't let the live path's `_shielded_finalize`-driven persist AND the new shared helper both persist — pick one persist owner per entry path (Pitfall 5). Remove the inline threads.py:1268-1418 block in the same commit as the helper extraction.

6. **resume/Continue set user_settings=None today.** The model-resolver fires only when user_settings is present. If D-04's "all 3 build sites" intent requires a live model resolve on resume/Continue, those paths need user_settings loaded for the run owner (Open Question 2) — otherwise only `phase.config.model` applies there.

## Sources

### Primary (HIGH confidence — verified on disk this session)
- `backend/app/services/provider_gateway/dispatcher.py` — `open_stream` signature + sync-generator reality (lines 75-116)
- `backend/app/services/provider_gateway/events.py` — canonical `GatewayEvent` TypedDicts + `calling_mode`-rides-alongside note
- `backend/app/services/provider_gateway/openai_compat.py` — what moves in (emit) vs stays consumer-side (L-1 inject + L-3 post-parse); STRUCTURED skip at :306
- `backend/app/services/agent_loop.py:1352-1708` — the Deep consumer template (gateway drive, STRUCTURED inject/post-parse, build-from-progress)
- `backend/app/services/task_service.py:121-193,251-505` — the F9 bug-site + sub-agent loop + grounding accumulation
- `backend/app/services/openai_service.py:1150-1285` — `CallingMode`, `resolve_calling_mode`, `create_adaptive_streaming_chat` STRUCTURED branch
- `backend/app/services/sub_agent_models.py:69-119` — the dead `llm_models` field read (D-06)
- `backend/app/models/user_settings.py:99-101,514-524,565-578` — `available_models` field, `override_provider`, `resolve_sub_agent_model`
- `backend/app/config.py:594-604,196-241` — `_SUB_AGENT_MODEL_DEFAULTS` + registry model IDs
- `backend/app/api/runs.py:480-588,618-877` — ask_user_response endpoint + the Continue workflow_run fallback (D-07 template)
- `backend/app/api/panel.py:103-153` — `/pending` returns the stored (workflow_run) `run_id`
- `backend/app/services/ask_user_service.py:55-160` — channel keying `ask_user:{run_id}:{tcid}`
- `backend/app/services/harness/phase_types.py` — the 5 executors; ask_user keying (:401-476); batch fan-out (:305-389)
- `backend/app/services/harness/programmatic.py:71-112` — split_topic reads `topic`
- `backend/app/services/harness/reachability.py` — the 091 lint to extend
- `backend/app/services/harness_engine.py:620-696,725-938` — terminal + `_build_resume_context` + resume sweep
- `backend/app/api/threads.py:1216-1438` — live-kickoff wf_ctx + the F6/F7 surfacing block to extract
- `backend/app/db/workflows.py:240-316` — ask_user resume matchers (run-scoped by prompt run_id)
- `supabase/migrations/061_harness_seed_templates.sql` — the 4 seeds + verify gate (:123-130) + literature_review input_keys (:159)
- `scripts/SSE_DIFF_RUNBOOK.md` + `scripts/eval_cross_provider.py` — the D-13 proof method + PROVIDERS model IDs
- `frontend/src/lib/api.ts:874-893` — `answerAskUser` posts to `/runs/{runId}` (runId from PendingAsk.run_id)
- `.planning/phases/092.5-.../092.5-05-SUMMARY.md` + `092.5-06-SUMMARY.md` — gateway delivery facts + I1-I8 invariants + the 2 carry-forward live re-checks

### Secondary (MEDIUM confidence)
- CONTEXT.md `[092.5]`-tagged additions (trusted as ground truth per the objective)
- `.planning/REQUIREMENTS.md` PARITY-02 traceability

### Tertiary (LOW confidence — flagged for validation)
- Google served-model currency (Open Q1) — needs a live `/models` probe at plan time
- 056 immutability trigger scope (Open Q3) — needs reading the trigger body at plan time

## Metadata

**Confidence breakdown:**
- Gateway contract + consumption mechanism: HIGH — verified on disk; the Deep consumer is the verbatim template
- F9/F10 bug-sites + fixes: HIGH — both traced end-to-end (channel keying, id namespace, SELECT target)
- Model resolver: HIGH — the field bug (`llm_models` vs `available_models`) confirmed against the model class
- Phase-type + lint fixes: HIGH — split_topic/seed/lint surfaces read directly; only the migration shape (Open Q3) is uncertain
- Surfacing helper: MEDIUM — the extraction is mechanical but the single-persist-owner reconciliation across 3 entry paths needs care (Pitfall 5)
- Live UAT detection method: HIGH — inherited verbatim from the 092.5 proven gate

**Research date:** 2026-06-02
**Valid until:** ~2026-06-16 (14 days — fast-moving harness substrate; the gateway contract is stable, but model IDs and the live UAT environment drift)

## RESEARCH COMPLETE
