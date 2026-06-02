---
phase: 093-harness-cross-provider-parity
reviewed: 2026-06-02T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - backend/app/api/panel.py
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/config.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/harness/programmatic.py
  - backend/app/services/harness/reachability.py
  - backend/app/services/harness_engine.py
  - backend/app/services/sub_agent_models.py
  - backend/app/services/task_service.py
  - frontend/src/lib/api.ts
  - frontend/src/types/index.ts
  - supabase/migrations/065_harness_seed_fixes.sql
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: fixed
resolution:
  fixed:
    - CR-01  # commit 63e9f6c6 — system_prompt carried on GatewayRequest
    - WR-01  # commit f93c61fd — STRUCTURED tool-recovery gated on bool(tools)
  deferred_to_live_uat:
    - WR-02  # case-sensitive registry trap — non-deterministic; verify in cross-provider UAT
  acknowledged_no_code_change:
    - IN-01  # pre-existing persist-after-finish_run crash window (mirrors _shielded_finalize)
    - IN-02  # INPUT_UNSATISFIED lint stricter than runtime executor (fails safe)
    - IN-03  # gemini-3.5-flash default bump (evidence-backed; verifier confirms in available_models)
---

# Phase 093: Code Review Report

**Reviewed:** 2026-06-02
**Depth:** deep
**Files Reviewed:** 13
**Status:** fixed (CR-01 + WR-01 resolved 2026-06-02; WR-02 deferred to LIVE UAT; IN-01/02/03 acknowledged)

## Summary

Phase 093 routes the shared `task_service._stream_one_iteration` sub-agent call site through the provider gateway (`open_stream`), adds the harness ask_user workflow_run-id fallback (F10), moves harness answer-surfacing into a single owner (`harness_engine._surface_final_answer`), threads a resolved ctx model onto all three workflow entry paths, fixes the dead `sub_agent_models` validation (D-06), adds an INPUT_UNSATISFIED lint, plumbs a `draft` field end-to-end, and ships migration 065 for three seed fixes.

The cross-file invariants in the phase brief mostly hold up:

- **IDOR / no-leak (runs.py):** VERIFIED SOUND. The `submit_ask_user_response` fallback mirrors `continue_run` exactly — owner-scoped `workflow_runs` SELECT + thread-anchor confirm + 404-not-403 on every miss. Every query in the resolve chain carries `.eq("user_id", current_user["id"])`. The `publish_response(redis, run_id=path_id, ...)` lands on `ask_user:{workflow_run_id}:{tcid}` — the exact channel `subscribe_for_response(redis, ctx.run_id, ...)` (phase_types.py:481) blocks on. No existence leak, no cross-user publish.
- **Single-persist-owner:** VERIFIED SOUND. The inline F6/F7 block was removed from `threads.py`; `_surface_final_answer` is the only persist site, reached once per success terminal. The resume sweep (`find_resumable_runs`, workflows.py:193) only matches `status IN ('active','paused')`, so a `completed` run is never re-surfaced — no double-persist.
- **Resolve-don't-mutate:** VERIFIED SOUND. `resolve_workflow_ctx_model` and `resolve_sub_agent_model_safely` only read `user_settings` and return a string; no writes.
- **Migration 065:** VERIFIED SOUND. Trigger DISABLE→UPDATE→ENABLE is inside one `BEGIN…COMMIT`, the trigger is re-enabled, and all jsonb paths/ids are correct against the 061 seed on disk (`validators` is a phase-level sibling of `config`; the three prompt rewrites target `{phases,N,config,prompt}` at the right indices).

The **byte-identical-Deep RED LINE is breached** by one defect: the gateway `GatewayRequest` built in `task_service` omits `system_prompt`, and the native Anthropic adapter strips the system message from `messages`. This silently drops the sub-agent/phase system prompt for Deep `task()`/`analyze_document` and harness LLM phases on Anthropic. Details below.

## Critical Issues

### CR-01: Sub-agent system prompt silently dropped on native Anthropic (RED LINE regression)

**Status:** RESOLVED 2026-06-02 (commit 63e9f6c6). `_stream_one_iteration` now extracts the first `role="system"` message text and passes it as `system_prompt` on the `GatewayRequest` (the exact suggested fix). Verified: openai_compat ignores `system_prompt` (zero refs) → byte-identical for OpenAI/compat-natives/OpenRouter/Ollama; native Anthropic/Google now receive the top-level system param their converters require. Regression tests `test_anthropic_gateway_request_carries_system_prompt` + `test_openai_compat_system_stays_in_messages_unchanged` GREEN. Live Anthropic Deep `task()` semantic-prompt UAT remains a verifier-owned row.

**File:** `backend/app/services/task_service.py:190-198`
**Issue:**
`_stream_one_iteration` builds the `GatewayRequest` without setting `system_prompt`, so it defaults to `""`:

```python
_gw_request = GatewayRequest(
    messages=messages,            # messages[0] = {"role": "system", "content": sys_prompt}
    model=model,
    active_provider_name=_adapter_provider,
    tools=tools,
    user_settings=user_settings,
    tool_choice="auto",
)
stream, calling_mode = await open_stream(_provider, _gw_request)
```

The system framing lives only in `messages[0]` (`role="system"`). When `_provider == "anthropic"`, `open_stream` routes to `open_anthropic_stream` (provider_gateway/anthropic.py:65), which calls `stream_anthropic(system_prompt=request.system_prompt="" , messages=...)`. Inside, `_convert_messages_to_anthropic` (anthropic_service.py:56-74) **strips every `role="system"` message** ("caller passes system separately") and `stream_anthropic` builds `system = [{"type":"text","text":""}]` — so the entire sub-agent / phase system prompt is dropped.

This is a true regression and breaches the byte-identical-Deep RED LINE:
- **Pre-093**, every `_stream_one_iteration` call went through `create_adaptive_streaming_chat` (the OpenAI-compat client), which sends the full `messages` list — including the `role="system"` entry — inline. The system prompt was preserved for all providers, including Anthropic-account users.
- **Post-093**, native Anthropic sub-agents lose it. Affected: Deep `task()`/`analyze_document` sub-agents AND harness `llm_single` / `llm_agent` / `llm_batch_agents` phases (the phase prompt arrives as `system_prompt_override` → `messages[0]`).

The correct pattern is visible in the Deep main loop (`agent_loop.py:1548-1557` / `1623-1632`), which passes `system_prompt=active_system_prompt` on the GatewayRequest *redundantly* (it also keeps it at `messages[0]`) precisely so the native adapters receive it. Google is incidentally protected because `_convert_messages_to_google` recovers the system from the messages array (`effective_system = system_prompt or system_instruction_from_messages`, google_service.py:404) — Anthropic has no such fallback.

**Fix:** Extract the system message and pass it on the request so the native Anthropic/Google adapters receive it (mirror agent_loop; harmless for the openai_compat path, which ignores `system_prompt` and reads `messages`):

```python
# Pull the system framing out of messages so the native Anthropic/Google
# adapters receive it (their message-converters strip role="system"). The
# openai_compat adapter ignores system_prompt and reads messages, so this is
# additive there — matches agent_loop.py:1553 / :1628.
_system_prompt = next(
    (m.get("content", "") for m in messages if m.get("role") == "system"),
    "",
)
_gw_request = GatewayRequest(
    messages=messages,
    model=model,
    active_provider_name=_adapter_provider,
    tools=tools,
    system_prompt=_system_prompt,
    user_settings=user_settings,
    tool_choice="auto",
)
```

Note: the STRUCTURED inject block at :211-218 mutates `messages[_i]` (the system entry) AFTER `open_stream`. Since native Anthropic/Google are always NATIVE mode (never STRUCTURED), reading `_system_prompt` from `messages` before that mutation is correct; the STRUCTURED-only mutation never applies to the adapters that consume `system_prompt`. Verify with a live Anthropic Deep `task()` UAT row (the eval `task`-cell skeleton diff will not catch a *semantic* prompt loss).

## Warnings

### WR-01: STRUCTURED-mode tool-call recovery can blank an `llm_single` answer

**Status:** RESOLVED 2026-06-02 (commit f93c61fd). Both the STRUCTURED inject block and the STRUCTURED post-parse block are now gated on `_has_tools = bool(tools)` (the suggested fix). The `get_tools` fallback expression itself is unchanged per scope. No-tools `llm_single` answer is preserved verbatim; the sub-agent loop (which passes the harness tool set) still runs recovery unchanged. Regression test `test_no_tools_structured_call_preserves_content` (parametrized `tools=None` and `tools=[]`) GREEN; the existing STRUCTURED-recovery-fires test updated to pass a real tool schema.

**File:** `backend/app/services/task_service.py:286-301` (+ `harness/phase_types.py:228-237`)
**Issue:**
After the drain, when `calling_mode == STRUCTURED`, `_stream_one_iteration` runs `parse_structured_tool_calls(content)` and, on any match, sets `content = ""` and returns the parsed tool calls. `_exec_llm_single` calls this with `tools=[]` and discards the returned `tool_calls`, returning only `{"text": content or ""}` (phase_types.py:228-237). On a STRUCTURED-mode provider (registry-miss / `native_tools:False`), the inject-once block at :204-218 falls back to injecting the FULL `get_tools(user_settings)` instruction block into a no-tools phase (because `tools=[]` is falsy → `_format_tool_list(get_tools(...))`). If the model then echoes anything `parse_structured_tool_calls` recognizes as a tool call, `content` is blanked and the phase returns an empty answer — silently losing the `research_summarize` / `literature_review` merge / `doc_qa_human` finalize output.

**Fix:** Skip the STRUCTURED inject + post-parse entirely when the call has no tools (an `llm_single` phase can never legitimately call a tool):

```python
# llm_single passes tools=[]; never inject tool instructions or run the
# structured tool-call recovery for a no-tools call (it can only blank content).
_has_tools = bool(tools)
if _has_tools and calling_mode == CallingMode.STRUCTURED and not structured_injected[0]:
    ...  # inject
...
if _has_tools and calling_mode == CallingMode.STRUCTURED:
    structured = parse_structured_tool_calls(content)
    ...
```

### WR-02: D-06 fix makes a previously-dead validation live — can override a valid user-selected model

**Status:** DEFERRED to LIVE UAT 2026-06-02. This is the case-sensitive-registry trap (zhipu/MiniMax/GLM model-id sensitivity), which is non-deterministic against `available_models` completeness — NOT a deterministic code fix here. No code change. Verifier confirms in cross-provider UAT that each native provider's `available_models` actually contains the selected model so the fallback does not fire on a legitimately-selected model.

**File:** `backend/app/services/sub_agent_models.py:89-94, 111-130`
**Issue:**
The D-06 fix is correct (the old `user_settings.llm_models` attribute does not exist on `UserEffectiveSettings`; `available_models: list[str]` is the real field). But the cross-provider validation at :111 was *dead* before this phase and is now live for the first time. `available_models` resolves to the active provider's `provider.models` list (user_settings.py:412/523). If that curated list is incomplete or has a casing/id mismatch relative to the model the user actually selected (the documented zhipu/minimax registry-casing trap), `resolve_sub_agent_model_safely` will now silently replace the user's chosen model with the provider's `_SUB_AGENT_MODEL_DEFAULTS` entry. This is a newly-reachable behavior change across every sub-agent and every workflow ctx model resolution (`resolve_workflow_ctx_model` calls into it).

**Fix:** Low-risk but verify in cross-provider UAT (especially zhipu/MiniMax/GLM, which the memory notes have registry-id sensitivity): confirm the selected model is present in `available_models` for each native provider so the fallback does not fire on a legitimately-selected model. If a provider's `available_models` can legitimately exclude a valid model id, consider gating the override behind a registry-membership check rather than the raw `available_models` list. No code change required if UAT confirms the lists are complete.

## Info

**Status (all three):** ACKNOWLEDGED 2026-06-02 — informational, no code change applied this pass. IN-01 is a pre-existing crash-window pattern mirroring `_shielded_finalize` (acceptable v1); IN-02 is intentional fail-safe conservatism (publish-time rejection, never a runtime hang; no shipped seed trips it); IN-03 is an evidence-backed default bump (verifier confirms `gemini-3.5-flash` is in Google's `available_models`).

### IN-01: `_surface_final_answer` persists AFTER `finish_run` — crash window leaves a completed run with no assistant message

**File:** `backend/app/services/harness_engine.py:810-823`
**Issue:**
Ordering is `finish_run(pool, run_id, "completed")` → `_surface_final_answer(...)` (which persists the assistant `messages` row) → terminal `run_completed` emit. If the worker dies between `finish_run` and the persist, the run is durably `completed` but no assistant message exists. The resume sweep only re-runs `active`/`paused` runs (workflows.py:193), so this run is never re-surfaced and the answer is permanently lost (only the live `delta`, if it was emitted, survives transiently). This mirrors the existing `_shielded_finalize` ordering, so it is a pre-existing risk pattern rather than a new defect, but the single-owner consolidation widens the blast radius (resume + Continue now share it).

**Fix:** Acceptable for v1 given the mirror to `_shielded_finalize`. If hardening later: persist the message BEFORE `finish_run` (durable answer before status flip), or include a "completed but unpersisted" reconcile pass. Not blocking.

### IN-02: INPUT_UNSATISFIED lint is stricter than the runtime executor (fails safe)

**File:** `backend/app/services/harness/reachability.py:37-57`
**Issue:**
`_check_input_contracts` flags any phase whose `input_keys` are not produced upstream or in `_KNOWN_RUN_INPUT_KEYS`. But only `programmatic` phases actually consume `input_keys` at runtime — the LLM executors ignore them (confirmed by the migration 065 Fix 3 comment and `_exec_llm_single`/`_exec_llm_agent`, which never read `input_keys`). So a non-programmatic phase declaring an unsatisfiable `input_key` is rejected at publish even though it would not strand at runtime. This is over-strict but fails closed (publish-time rejection, not a runtime hang), and no shipped seed trips it (only `literature_review` split declares `input_keys`, now `["topic","kickoff_prompt"]` — both known run inputs). No action needed; documenting the intentional conservatism.

### IN-03: `gemini-2.5-flash` → `gemini-3.5-flash` default bump is a behavior change for Google sub-agents

**File:** `backend/app/config.py:597`
**Issue:**
`_SUB_AGENT_MODEL_DEFAULTS["google"]` changed from `gemini-2.5-flash` to `gemini-3.5-flash`. This is the fallback that now fires for Google sub-agents whose selected model fails the (newly-live, WR-02) `available_models` validation. The inline comment documents a live `/models` probe on 2026-06-02 confirming `3.5` serves and rationalizes the choice (2.5 narrates tools without emitting). Reasonable and evidence-backed; flagged only so the verifier confirms `gemini-3.5-flash` is in Google's `available_models` for existing users (else WR-02's fallback could route to a model their key/tier does not serve). No code change.

---

_Reviewed: 2026-06-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
