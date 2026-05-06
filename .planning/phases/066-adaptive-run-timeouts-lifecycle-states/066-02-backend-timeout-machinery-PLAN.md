---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 02
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - backend/app/config.py
  - backend/app/api/threads.py
  - backend/app/api/runs.py
autonomous: true
requirements:
  - STREAM-04-polish

must_haves:
  truths:
    - "The outer `async with asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper at threads.py:855 is DELETED — agent loop has no hard total cap (Claude/ChatGPT-class behavior per D-066-01)"
    - "Each LLM stream iteration is wrapped in `async with asyncio.timeout(per_call_budget)` — both Anthropic native (line ~1161) AND OpenAI/Google/OpenRouter (line ~1215) paths"
    - "On TimeoutError, the SDK stream is closed cleanly (`_ant_gen.close()` for Anthropic, `stream.close()` for OpenAI) BEFORE the exception re-raises — LangSmith trace ends cleanly with no GeneratorExit at run_helpers.py:1680"
    - "Per-call budget resolves from MODEL_CAPABILITIES[model_id].llm_call_timeout_seconds with 180s default for unknown models"
    - "Tool execution (sandbox / web_search / sub-agent / execute_code) is OUTSIDE the per-call timer — D-066-02"
    - "TimeoutError branch's `_terminal_error` is refined from Plan 01's static placeholder to include per_call_budget, iteration number, and model_id values"
    - "runs.py cancel handler still writes `status='cancelled'` — partition guard UNCHANGED"
  artifacts:
    - path: "backend/app/config.py"
      provides: "ModelCapability TypedDict with llm_call_timeout_seconds field + per-model overrides + LLM_CALL_TIMEOUT_OVERRIDES env var parser + Settings.run_hard_timeout_seconds removal (or no-op marker)"
      contains: "llm_call_timeout_seconds"
    - path: "backend/app/api/threads.py"
      provides: "Per-LLM-call asyncio.timeout wraps in both provider paths + close-then-raise pattern + outer wrapper deletion + refined timed_out error string"
      contains: "async with asyncio.timeout(per_call_budget)"
    - path: "backend/app/api/runs.py"
      provides: "References to settings.run_hard_timeout_seconds replaced with a static fallback or settings.consumer_timeout_seconds (60+10)"
      contains: "consumer_timeout_seconds"
  key_links:
    - from: "MODEL_CAPABILITIES[model_id]"
      to: "per_call_budget at the start of each agent loop iteration"
      via: "get_per_call_timeout(model_id, settings) helper called inside the while-True loop"
      pattern: "get_per_call_timeout\\("
    - from: "asyncio.TimeoutError raised inside the per-call timer block"
      to: "outer except asyncio.TimeoutError at threads.py:2140 (Plan 01 wrote _terminal_status='timed_out')"
      via: "raise after stream.close() — propagates cleanly"
      pattern: "stream\\.close\\(\\)|_ant_gen\\.close\\(\\)"
---

<objective>
Replace the 120s total-deadline `asyncio.timeout(settings.run_hard_timeout_seconds)` wrapper at `threads.py:855` (which silently kills complex tool-calling agents mid-iteration — Gap-006) with a per-LLM-call deadline that resets on every iteration. Tool execution stays OUTSIDE the timer (D-066-02). Per-model budgets live on `MODEL_CAPABILITIES` (D-066-03). On TimeoutError the SDK stream closes cleanly before re-raise — LangSmith records a clean termination, not GeneratorExit (D-066-11).

Purpose: This is THE headline behavior change for Phase 066. After this plan lands, the agent loop has no hard total cap (matches Claude/ChatGPT UX); only individual LLM stream blocks have budgets. Combined with Plan 01's terminal classification, the producer now writes `runs.status='timed_out'` with a richly-formatted `runs.error` whenever a per-LLM-call deadline fires.

Output:
- `backend/app/config.py`: `ModelCapability` TypedDict gains `llm_call_timeout_seconds` field; per-model overrides for known-slow reasoning models; `LLM_CALL_TIMEOUT_OVERRIDES` env-var parser mirroring `MODEL_CONTEXT_LIMITS`; `Settings.run_hard_timeout_seconds` removed (or kept as no-op marker — see action).
- `backend/app/api/threads.py:855` outer `asyncio.timeout` wrapper DELETED.
- `backend/app/api/threads.py:1149-1244`: per-LLM-call `asyncio.timeout(per_call_budget)` wraps + try/except TimeoutError that calls `_ant_gen.close()` (Anthropic) or `stream.close()` (OpenAI/Google/OpenRouter) before re-raising.
- `backend/app/api/threads.py:2147` TimeoutError branch's static placeholder error string refined to include per_call_budget, iteration, and model_id.
- `backend/app/api/runs.py:70, 85, 180` `settings.run_hard_timeout_seconds` references replaced with a new `settings.consumer_timeout_seconds` (default 600+10=610s) so the replay-tail consumer's deadline survives wrapper deletion.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md
@C:/Vibe Apps/Agentic RAG/CLAUDE.md
@C:/Vibe Apps/Agentic RAG/backend/app/config.py
@C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py
@C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py
@C:/Vibe Apps/Agentic RAG/backend/app/services/anthropic_service.py

<interfaces>
<!-- Existing contracts the executor MUST preserve. -->

From backend/app/config.py:63-71 (CURRENT 2-field TypedDict — extend with 3rd field):
```python
class ModelCapability(TypedDict):
    native_tools: bool
    provider: str  # documentation only; actual provider from user settings
```

From backend/app/config.py:71-108 (CURRENT MODEL_CAPABILITIES — extend selected entries with llm_call_timeout_seconds):
```python
MODEL_CAPABILITIES: dict[str, ModelCapability] = {
    "gpt-4o": {"native_tools": True, "provider": "openai"},
    "gpt-4o-mini": {"native_tools": True, "provider": "openai"},
    # ... 30 entries ... 
}
```

From backend/app/config.py:246-251 (CURRENT — to be deleted or made no-op):
```python
# Server-side hard timeout for the agent producer task (Phase 061 — D-061-01).
# ... 120s ... Override in .env: RUN_HARD_TIMEOUT_SECONDS=<int>.
run_hard_timeout_seconds: int = 120
```

From backend/app/api/threads.py:855 (CURRENT — to be DELETED per D-066-01):
```python
async with asyncio.timeout(settings.run_hard_timeout_seconds):
```

From backend/app/api/threads.py:1149-1186 (CURRENT Anthropic native path — wrap with per-call timer):
```python
_ant_gen = stream_anthropic(messages=messages, ...)
tool_calls_buffer: dict = {}
finish_reason: str | None = None
_announced_tools_ant: set[int] = set()
for _ant_event in _ant_gen:
    _etype = _ant_event.get("type")
    if _etype == "delta":
        _text = _ant_event.get("content", "")
        if _text:
            full_content += _text
            await _emit(redis, run_id, 'delta', content=_text)
    elif _etype == "tool_preparing":
        _idx = _ant_event.get("index", len(tool_calls_buffer))
        if _idx not in _announced_tools_ant:
            _announced_tools_ant.add(_idx)
            await _emit(redis, run_id, 'tool_preparing', name=_ant_event['name'], index=_idx)
    elif _etype == "tool_start":
        _idx = len(tool_calls_buffer)
        tool_calls_buffer[_idx] = {
            "id": _ant_event["id"],
            "name": _ant_event["name"],
            "arguments": json.dumps(_ant_event.get("args", {})),
        }
    elif _etype == "finish":
        finish_reason = _ant_event.get("finish_reason", "stop")
break  # stream completed
```

From backend/app/api/threads.py:1190-1244 (CURRENT OpenAI/Google/OpenRouter path — wrap with per-call timer):
```python
stream, calling_mode = create_adaptive_streaming_chat(...)
# ... tool_calls_buffer setup ...
for chunk in stream:
    if not chunk.choices:
        continue
    choice = chunk.choices[0]
    delta = choice.delta
    if choice.finish_reason:
        finish_reason = normalize_finish_reason(choice.finish_reason)
    if delta.content:
        full_content += delta.content
        await _emit(redis, run_id, 'delta', content=delta.content)
    if delta.tool_calls:
        # ... existing tool_calls_buffer accumulation ...
        ...
```

From backend/app/api/runs.py:70, 85, 180 (CURRENT — references settings.run_hard_timeout_seconds):
```python
#   - Deadline = monotonic + run_hard_timeout_seconds + 10
deadline = time_mod.monotonic() + settings.run_hard_timeout_seconds + 10
# ... and at line 180 ...
# the full run_hard_timeout_seconds + 10 for consumer_timeout.
```

From backend/app/services/anthropic_service.py:144-169 (CONTEXT — _ant_gen wraps `with client.messages.stream() as stream:`; calling `_ant_gen.close()` triggers the inner `with` __exit__ which closes the MessageStream):
```python
def stream_anthropic(...) -> Generator[dict, None, None]:
    client = anthropic.Anthropic(api_key=api_key)
    # ...
    with client.messages.stream(**stream_kwargs) as stream:
        for event in stream:
            # ... yields dict events ...
```

From RESEARCH.md verified SDK methods (anthropic 0.97.0, openai 2.28.0):
- Anthropic: calling `_ant_gen.close()` (sync) on the producer-side generator triggers `GeneratorExit` inside the `with client.messages.stream():` block → `MessageStream.__exit__` → underlying httpx response close. **Sync — do NOT `await`.**
- OpenAI: `stream.close()` (sync) closes the underlying httpx response on the `Stream` object directly. Idempotent. **Sync — do NOT `await`.**
</interfaces>

<key_decisions>
**Locked decisions from CONTEXT.md (NON-NEGOTIABLE):**
- D-066-01: Per-LLM-call budget that resets on each iteration. NO overall total cap. Replaces `async with asyncio.timeout(settings.run_hard_timeout_seconds)` at line 855.
- D-066-02: Timer scope = LLM stream block ONLY. Wraps `for _ant_event in _ant_gen:` (line 1161) and `for chunk in stream:` (line 1215). Tool execution OUTSIDE.
- D-066-03: Per-model budget via `MODEL_CAPABILITIES[model_id].llm_call_timeout_seconds`; default 180s for unknown models.
- D-066-11: Close SDK stream BEFORE re-raising TimeoutError so LangSmith records clean termination (no GeneratorExit at run_helpers.py:1680).
- D-066-12: `RUN_HARD_TIMEOUT_SECONDS=600` is the pre-phase stopgap in `backend/.env`. Plan 02 deletes the wrapper that consumes it. The env var name remains parsed by Pydantic (`extra="ignore"` in Settings model_config) so legacy deploys with the env set don't error at startup.

**Per-model overrides (from RESEARCH.md A1 — starting matrix; user-tunable):** Plan 02 adds the field to all current MODEL_CAPABILITIES entries. The matrix:
- 60s — fast non-reasoning: `gpt-5.4-nano`, `gemini-2.5-flash-lite`
- 90s — fast: `gpt-4o-mini`, `gpt-4.1-nano`, `gpt-5.4-mini`, `gpt-5.5`, `claude-haiku-4-5-20251001`, `gemini-2.5-flash`, `gemini-3-flash-preview`, `gpt-4.1-mini`
- 180s (default — explicit for documentation): `gpt-4o`, `gpt-4.1`, `gpt-5`
- 240s — agentic / capable: `gpt-5.4`, `claude-sonnet-4-6`, `claude-sonnet-4-5`, `gemini-2.5-pro`, `gemini-3.1-pro-preview`, `deepseek/deepseek-chat`, `z-ai/glm-5.1`, `minimax/minimax-01`, `minimax/minimax-m2.7`, `minimax/minimax-m2.5:free`
- 600s — slow reasoning (Anthropic Issue #51568 documents 7.5min stalls): `o1`, `o3`, `o4`, `claude-opus-4-7`, `claude-opus-4-6`, `deepseek/deepseek-reasoner`, `deepseek/deepseek-r1`, `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2.6`

**Disposition of `Settings.run_hard_timeout_seconds`:** RESEARCH.md Open Question 2 + CONTEXT.md "Configuration surface" sketch say "lean delete." Plan 02 deletes the field. Two side-effects:
1. `runs.py:70, 85, 180` reference `settings.run_hard_timeout_seconds` — these are the **replay-tail consumer's deadline** (consumer_timeout = run_hard_timeout + 10), which is unrelated to the producer's per-LLM-call timeout. To preserve the consumer's deadline, introduce a NEW setting `consumer_timeout_seconds: int = 610` (mirrors today's `120 + 10 = 130`, but bumped to `600 + 10 = 610` to match the worst-case wall-time for `max_iterations=15 × 240s ≈ 60min` floor). The replay-tail consumer is intentionally generous; this prevents a slow agent from being prematurely closed by the consumer-side deadline. Update all 3 `runs.py` references.
2. `tests/integration/test_061_hard_timeout.py` references `settings.run_hard_timeout_seconds` (lines 36, 46) — Plan 04 will mark this test as legacy/obsolete (the wrapper it tests is deleted). Plan 02 leaves the test file alone; Plan 04 owns the rewrite/skip.
</key_decisions>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator env config ↔ producer behavior | `LLM_CALL_TIMEOUT_OVERRIDES` parser is operator-side input — must validate to prevent DoS via `model=0` |
| LangSmith wrapper ↔ SDK stream | `wrap_openai`-decorated stream interleaves with the SDK; close-before-raise is the contract that keeps the trace clean |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-066-05 | DoS / availability | `LLM_CALL_TIMEOUT_OVERRIDES=mymodel=0` causes timer to fire instantly → all runs `timed_out` | mitigate | Parser bounds value to range `[1, 3600]`; reject 0 / negative with `ValueError`; log warning if value < 30s. Implemented in `_parse_llm_call_timeout_overrides()` helper (action below). |
| T-066-06 | Information Disclosure | TimeoutError formatted error string leaks model id (could be sensitive in multi-tenant deploys) | accept | Per CLAUDE.md, this app targets per-user RLS isolation, not multi-tenant org isolation. `runs.error` is RLS-scoped to `auth.uid() = user_id` — only the user can see their own model id. Acceptable disclosure surface. |
| T-066-07 | Tampering / regression | Per-call timer fires too aggressively → false-positive `timed_out` on legitimate slow chats | mitigate | Plan 04 includes a test asserting 90s tool execution does NOT count against the per-call budget (D-066-02). User-facing live UAT in Plan 05 confirms the user's Gap-006 prompt completes. Per-model overrides err on the conservative side per RESEARCH.md A1. |
| T-066-08 | Tampering | LangSmith trace still records GeneratorExit despite close-before-raise (RESEARCH A4 risk) | mitigate | Plan 04 includes `test_no_generator_exit_on_timeout` asserting via caplog that no log line contains `'GeneratorExit'`. RED-state assertion drives the integration. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Extend ModelCapability + populate per-model llm_call_timeout_seconds + add env-var parser + add consumer_timeout_seconds setting + remove run_hard_timeout_seconds</name>
  <files>backend/app/config.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-03 + Configuration surface sketch + Claude's Discretion bullet on RUN_HARD_TIMEOUT_SECONDS removal)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md ("Code Examples → MODEL_CAPABILITIES field extension at config.py:63-71"; "Don't Hand-Roll → Per-model timeout policy"; "Open Questions → 2 / 3"; "Security Domain → Pattern: Per-call budget can be set to 0 → bound to [1, 3600]")
    - C:/Vibe Apps/Agentic RAG/backend/app/config.py (current TypedDict + MODEL_CAPABILITIES + Settings — read in full)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md (confirms migration applied + Plan 01 deltas)
  </read_first>
  <action>
**Subtask 1a — Extend `ModelCapability` TypedDict at config.py:63-71** to add `llm_call_timeout_seconds`:

```python
class ModelCapability(TypedDict, total=False):
    """Per-model capability registry entry. `total=False` so partial entries
    are allowed — only `native_tools` and `provider` were previously required;
    Phase 066 D-066-03 adds `llm_call_timeout_seconds` as optional. Models
    without this field fall back to the 180s unknown-model default at the
    lookup site (get_per_call_timeout below).
    """
    native_tools: bool
    provider: str  # documentation only; actual provider from user settings
    llm_call_timeout_seconds: int  # Phase 066 D-066-03 — per-LLM-call deadline
```

**Subtask 1b — Update MODEL_CAPABILITIES dict at config.py:71-108** to include `llm_call_timeout_seconds` per the matrix in `<key_decisions>` above. EXAMPLE replacement (apply the matrix to ALL 30 entries):

```python
MODEL_CAPABILITIES: dict[str, ModelCapability] = {
    # OpenAI — proven native tool support
    "gpt-4o":      {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180},
    "gpt-4o-mini": {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  90},
    "gpt-4.1":     {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180},
    "gpt-4.1-mini":{"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  90},
    "gpt-4.1-nano":{"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  60},
    "gpt-5":       {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 180},
    "gpt-5.4":     {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 240},
    "gpt-5.4-mini":{"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  90},
    "gpt-5.4-nano":{"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  60},
    "gpt-5.5":     {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds":  90},
    "o1":          {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600},
    "o3":          {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600},
    "o4":          {"native_tools": True, "provider": "openai", "llm_call_timeout_seconds": 600},
    # Anthropic direct — native tool_use
    "claude-opus-4-7":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600},  # extended thinking — Issue #51568
    "claude-opus-4-6":           {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 600},
    "claude-sonnet-4-6":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 240},
    "claude-sonnet-4-5":         {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds": 240},
    "claude-haiku-4-5-20251001": {"native_tools": True, "provider": "anthropic", "llm_call_timeout_seconds":  90},
    # Google direct — native function calling
    "gemini-2.5-pro":            {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 240},
    "gemini-2.5-flash":          {"native_tools": True, "provider": "google", "llm_call_timeout_seconds":  90},
    "gemini-2.5-flash-lite":     {"native_tools": True, "provider": "google", "llm_call_timeout_seconds":  60},
    "gemini-3-flash-preview":    {"native_tools": True, "provider": "google", "llm_call_timeout_seconds":  90},
    "gemini-3.1-pro-preview":    {"native_tools": True, "provider": "google", "llm_call_timeout_seconds": 240},
    # OpenRouter — mixed; structured-mode default
    "deepseek/deepseek-chat":      {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 240},
    "deepseek/deepseek-reasoner":  {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600},
    "deepseek/deepseek-r1":        {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600},
    "z-ai/glm-5.1":                {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 240},
    "moonshotai/kimi-k2.5":        {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600},
    "moonshotai/kimi-k2.6":        {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 600},
    "minimax/minimax-01":          {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 240},
    "minimax/minimax-m2.7":        {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 240},
    "minimax/minimax-m2.5:free":   {"native_tools": False, "provider": "openrouter", "llm_call_timeout_seconds": 240},
}
```

**Subtask 1c — Add helper function `get_per_call_timeout` immediately after `get_model_capability`** at config.py:114 (with module-level constant for the default):

```python
# Phase 066 D-066-03: default per-LLM-call timeout for models not enumerated
# in MODEL_CAPABILITIES. 180s is the conservative middle ground (per RESEARCH.md
# A1) — wide enough to accommodate typical agent calls without false-positive
# timed_out, narrow enough that pathologically-stalling streams terminate
# within a reasonable window.
DEFAULT_LLM_CALL_TIMEOUT_SECONDS: int = 180

# Phase 066 D-066-03 / T-066-05 mitigation: lower / upper bounds for the
# LLM_CALL_TIMEOUT_OVERRIDES env-var parser. Operator misconfiguration to 0
# or a negative integer would cause the per-call timer to fire instantly,
# making all runs `timed_out` (DoS). 3600s upper bound is a soft sanity cap.
_LLM_CALL_TIMEOUT_MIN_S: int = 1
_LLM_CALL_TIMEOUT_MAX_S: int = 3600


def get_per_call_timeout(model_id: str, settings_obj: "Settings | None" = None) -> int:
    """Resolve the per-LLM-call deadline (seconds) for a given model.

    Phase 066 D-066-03. Lookup precedence:
      1. settings_obj.llm_call_timeout_overrides (operator env override) — if
         settings_obj is provided AND the model_id has an override.
      2. MODEL_CAPABILITIES[model_id].llm_call_timeout_seconds — registered
         per-model default.
      3. DEFAULT_LLM_CALL_TIMEOUT_SECONDS (180s) — unknown-model fallback.

    Called inside agent_runner once per iteration just before each LLM stream
    block. The result is bounded to [_LLM_CALL_TIMEOUT_MIN_S,
    _LLM_CALL_TIMEOUT_MAX_S] as a defense-in-depth check on the env-var path.
    """
    # 1. Env override
    if settings_obj is not None:
        overrides = _parse_llm_call_timeout_overrides(
            settings_obj.llm_call_timeout_overrides
        )
        if model_id in overrides:
            return overrides[model_id]

    # 2. Per-model registered default
    cap = MODEL_CAPABILITIES.get(model_id, {})
    if "llm_call_timeout_seconds" in cap:
        return cap["llm_call_timeout_seconds"]  # type: ignore[typeddict-item]

    # 3. Unknown-model fallback
    return DEFAULT_LLM_CALL_TIMEOUT_SECONDS


def _parse_llm_call_timeout_overrides(raw: str) -> dict[str, int]:
    """Parse LLM_CALL_TIMEOUT_OVERRIDES env-var value.

    Phase 066 D-066-03. Syntax mirrors MODEL_CONTEXT_LIMITS / MODEL_OUTPUT_LIMITS:
    ``model-id=seconds,model-id=seconds`` (uses ``=`` not ``:`` because some
    model ids contain colons, e.g. ``minimax/minimax-m2.5:free``).

    T-066-05 mitigation: every value is integer-coerced and bounded to
    ``[1, 3600]``. Out-of-range values are dropped with a logged warning.
    """
    out: dict[str, int] = {}
    if not raw or not raw.strip():
        return out
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry or "=" not in entry:
            continue
        model_id, val_str = entry.rsplit("=", 1)  # rsplit handles colon-in-model-id
        model_id = model_id.strip()
        try:
            val = int(val_str.strip())
        except ValueError:
            logger.warning(
                "LLM_CALL_TIMEOUT_OVERRIDES: ignoring non-integer value for %r: %r",
                model_id, val_str,
            )
            continue
        if val < _LLM_CALL_TIMEOUT_MIN_S or val > _LLM_CALL_TIMEOUT_MAX_S:
            logger.warning(
                "LLM_CALL_TIMEOUT_OVERRIDES: ignoring out-of-range value for %r: %d (must be in [%d, %d])",
                model_id, val, _LLM_CALL_TIMEOUT_MIN_S, _LLM_CALL_TIMEOUT_MAX_S,
            )
            continue
        if val < 30:
            logger.warning(
                "LLM_CALL_TIMEOUT_OVERRIDES: tight per-call budget for %r: %ds (consider >=30s)",
                model_id, val,
            )
        out[model_id] = val
    return out
```

(Add `import logging` and `logger = logging.getLogger(__name__)` at the top of `config.py` if not already present. Verify by `grep -n "import logging" backend/app/config.py` before adding.)

**Subtask 1d — Replace `Settings.run_hard_timeout_seconds` (config.py:246-251) with `consumer_timeout_seconds` and add the new override env**:

DELETE lines 246-251 (the `run_hard_timeout_seconds` block) and INSERT in their place:

```python
    # Phase 066 D-066-01: the legacy 120s total-deadline asyncio.timeout wrapper
    # at threads.py:855 has been DELETED. The agent loop now has no hard total
    # cap (matches Claude/ChatGPT UX). Per-LLM-call budgets live on
    # MODEL_CAPABILITIES.llm_call_timeout_seconds + LLM_CALL_TIMEOUT_OVERRIDES env
    # (resolved via get_per_call_timeout()). The legacy `RUN_HARD_TIMEOUT_SECONDS`
    # env-var symbol is silently parsed-and-ignored (Pydantic Settings
    # `extra="ignore"` at line 129) so legacy deploys with the env set don't
    # error at startup, but the value has no effect.

    # Phase 066: consumer-side deadline for the replay-tail consumer at
    # runs.py. Independent from the producer's per-LLM-call budget — this
    # bounds how long a CONSUMER (frontend SSE client) will wait without an
    # event before emitting buffer_expired_during_tail. Worst-case agent
    # wall-time is max_iterations × per_call_budget; the consumer must
    # outlast that. Default 610s = 600s budget + 10s slack mirrors the
    # legacy `run_hard_timeout_seconds + 10` shape but with the new horizon.
    # Override in .env: CONSUMER_TIMEOUT_SECONDS=<int>.
    consumer_timeout_seconds: int = 610

    # Phase 066 D-066-03: optional per-model per-LLM-call timeout overrides.
    # Syntax: model-id=seconds,model-id=seconds (rsplit on '=' handles model
    # ids containing ':' like ``minimax/minimax-m2.5:free``). Bounded to
    # [1, 3600]. Mirrors MODEL_CONTEXT_LIMITS / MODEL_OUTPUT_LIMITS pattern.
    # Example: LLM_CALL_TIMEOUT_OVERRIDES=claude-opus-4-7=900,gpt-5.4=300
    llm_call_timeout_overrides: str = ""
```

**Note on `extra="ignore"`:** Already set at config.py:129 — verify by `grep "extra" backend/app/config.py | head -3`. Legacy `RUN_HARD_TIMEOUT_SECONDS` env will be silently ignored (no startup error) per Pydantic settings semantics. No code change needed.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.config import ModelCapability, MODEL_CAPABILITIES, get_per_call_timeout, DEFAULT_LLM_CALL_TIMEOUT_SECONDS; assert DEFAULT_LLM_CALL_TIMEOUT_SECONDS == 180; assert get_per_call_timeout('claude-opus-4-7') == 600; assert get_per_call_timeout('gpt-4o-mini') == 90; assert get_per_call_timeout('unknown-model-xyz') == 180; print('OK')"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.config import _parse_llm_call_timeout_overrides; r = _parse_llm_call_timeout_overrides('claude-opus-4-7=900,gpt-5.4=300,minimax/minimax-m2.5:free=120'); assert r == {'claude-opus-4-7': 900, 'gpt-5.4': 300, 'minimax/minimax-m2.5:free': 120}, r; print('OK', r)"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.config import _parse_llm_call_timeout_overrides; r = _parse_llm_call_timeout_overrides('bad-model=0,worse=-5,outofrange=99999'); assert r == {}, r; print('OK bounds-rejected')"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.config import settings; assert settings.consumer_timeout_seconds == 610; assert settings.llm_call_timeout_overrides == ''; assert not hasattr(settings, 'run_hard_timeout_seconds'), 'run_hard_timeout_seconds should be deleted'; print('OK')"</automated>
    <automated>! grep -n "run_hard_timeout_seconds" "C:/Vibe Apps/Agentic RAG/backend/app/config.py"</automated>
  </verify>
  <done>
    - `ModelCapability` TypedDict includes `llm_call_timeout_seconds: int` field
    - All 30 entries in `MODEL_CAPABILITIES` carry an explicit `llm_call_timeout_seconds` value per the matrix
    - `get_per_call_timeout(model_id)` returns 180 for unknown models, 600 for `claude-opus-4-7`, 90 for `gpt-4o-mini`
    - `_parse_llm_call_timeout_overrides()` handles `=`-separated entries, rsplit for colon-in-model-id, and rejects out-of-range values
    - `Settings.run_hard_timeout_seconds` is GONE; `Settings.consumer_timeout_seconds = 610` and `Settings.llm_call_timeout_overrides = ""` are present
    - Pydantic-settings `extra="ignore"` confirmed at line 129 — legacy `RUN_HARD_TIMEOUT_SECONDS` env won't error
  </done>
</task>

<task type="auto">
  <name>Task 2: Wrap each LLM stream block in per-call asyncio.timeout + close-then-raise; delete outer wrapper at line 855; refine TimeoutError error string; update runs.py consumer deadline references</name>
  <files>backend/app/api/threads.py, backend/app/api/runs.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-01, 02, 11)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md ("Code Examples → Per-call timer wrapping the OpenAI / Google / OpenRouter stream block"; "Code Examples → Per-call timer wrapping the Anthropic native stream block"; "Pattern 1: Per-iteration asyncio.timeout reset"; "Pattern 2: Close-stream-then-raise on timeout"; "Anti-Patterns to Avoid → 'Using await stream.close()'", "Pitfalls → 1, 2, 5")
    - C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py lines 840-870 (agent_runner entry — line 855 wrapper to delete)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py lines 1139-1244 (the while-True iteration loop with both provider paths to wrap)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py lines 2140-2159 (Plan 01 wrote the placeholder static error string; Task 2 refines it)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py lines 60-95, 175-185 (3 settings.run_hard_timeout_seconds references to swap)
    - C:/Vibe Apps/Agentic RAG/backend/app/services/anthropic_service.py lines 128-220 (stream_anthropic generator — its `with client.messages.stream() as stream:` is what _ant_gen.close() unwinds)
  </read_first>
  <action>
**Subtask 2a — DELETE the outer wrapper at threads.py:855** (D-066-01).

Find this exact block in `agent_runner`:

```python
        try:                          # OUTER try → finally runs shielded finalizer (Plan 03 Task 3)
            async with asyncio.timeout(settings.run_hard_timeout_seconds):
                # Reuse the user_settings already resolved by the route handler
```

Replace with:

```python
        try:                          # OUTER try → finally runs shielded finalizer (Phase 061 Plan 03 Task 3)
            # Phase 066 D-066-01: the outer asyncio.timeout(settings.run_hard_timeout_seconds)
            # wrapper that lived here in Phase 061 has been DELETED. The agent loop now has
            # no hard total cap (matches Claude/ChatGPT UX where complex tool-calling
            # workflows can run as long as needed within max_iterations). Per-LLM-call
            # deadlines live INSIDE the iteration loop at the SDK stream blocks (D-066-02);
            # see the `async with asyncio.timeout(per_call_budget)` wraps at the Anthropic
            # native path (around line ~1161) and OpenAI/Google/OpenRouter path (around
            # line ~1215). Tool execution (sandbox / web_search / sub-agent) is OUTSIDE
            # the per-call timer — tools own their own timeout discipline.
            #
            # Worst-case wall-time = max_iterations × per_call_budget (15 × 180s ≈ 45min
            # for unknown models; per-model overrides in MODEL_CAPABILITIES tune this).
            # The replay-tail consumer's deadline at runs.py:85 (settings.consumer_timeout_seconds)
            # is independent from this scope — it bounds the CONSUMER, not the producer.
            if True:  # preserve indentation of the existing body — minimal diff strategy
                # Reuse the user_settings already resolved by the route handler
```

The `if True:` is a deliberate indentation-preserving wrapper so the entire ~1100-line agent loop body does NOT need reflowing. The Phase 061 plan precedent (atomic re-indent) was 22a814c; this plan avoids that by using `if True:` instead. The closing block structure remains identical.

Alternatively (cleaner — recommended), if the executor judges the diff cost acceptable: remove the `async with` line entirely and re-indent the entire body LEFT by one level (4 spaces). Use `python` AST parse before commit to verify syntax. Choose ONE strategy; document the choice in the SUMMARY.md.

**Subtask 2b — Wrap the Anthropic native path (threads.py:1149-1186) in per-call timer + close-then-raise.**

Find this block:

```python
                                if active_provider_name == "anthropic":
                                    # --- Anthropic native SDK path (GEN-02) ---
                                    from app.services.openai_service import _resolve_max_tokens
                                    _ant_max_tokens = _resolve_max_tokens(None, user_settings)
                                    _ant_api_key = user_settings.llm_api_key or settings.llm_api_key or ""
                                    _ant_tools = active_tools if active_tools is not None else get_tools(user_settings)
                                    _ant_gen = stream_anthropic(
                                        messages=messages,
                                        tools=_ant_tools,
                                        system_prompt=active_system_prompt,
                                        model=body.model or user_settings.llm_model,
                                        api_key=_ant_api_key,
                                        max_tokens=_ant_max_tokens,
                                        force_no_tools=force_no_tools,
                                    )
                                    tool_calls_buffer: dict = {}
                                    finish_reason: str | None = None
                                    _announced_tools_ant: set[int] = set()
                                    for _ant_event in _ant_gen:
```

Replace with (preserving the indentation of every line — note the addition of `from app.config import get_per_call_timeout` import at top of file if missing, and the per-call resolution + `async with`):

```python
                                if active_provider_name == "anthropic":
                                    # --- Anthropic native SDK path (GEN-02) ---
                                    from app.services.openai_service import _resolve_max_tokens
                                    from app.config import get_per_call_timeout  # Phase 066 D-066-03
                                    _ant_max_tokens = _resolve_max_tokens(None, user_settings)
                                    _ant_api_key = user_settings.llm_api_key or settings.llm_api_key or ""
                                    _ant_tools = active_tools if active_tools is not None else get_tools(user_settings)
                                    # Phase 066 D-066-03: resolve per-LLM-call deadline before stream
                                    _model_id = body.model or user_settings.llm_model
                                    per_call_budget = get_per_call_timeout(_model_id, settings)
                                    _ant_gen = stream_anthropic(
                                        messages=messages,
                                        tools=_ant_tools,
                                        system_prompt=active_system_prompt,
                                        model=_model_id,
                                        api_key=_ant_api_key,
                                        max_tokens=_ant_max_tokens,
                                        force_no_tools=force_no_tools,
                                    )
                                    tool_calls_buffer: dict = {}
                                    finish_reason: str | None = None
                                    _announced_tools_ant: set[int] = set()
                                    # Phase 066 D-066-02 + D-066-11: per-LLM-call timer wraps
                                    # ONLY the SDK iteration block (tool execution stays
                                    # OUTSIDE — D-066-02). On TimeoutError, close the
                                    # generator BEFORE re-raising so anthropic_service.py:169
                                    # `with client.messages.stream():` __exit__ fires
                                    # (calling MessageStream.close() → response.close() —
                                    # all sync methods per anthropic 0.97.0 venv probe).
                                    # This converts the LangSmith trace from "unexpected
                                    # GeneratorExit at run_helpers.py:1680" to a clean
                                    # stream-end + raised TimeoutError.
                                    try:
                                        async with asyncio.timeout(per_call_budget):
                                            for _ant_event in _ant_gen:
```

Then at the END of the Anthropic for-loop body (right after the existing `break  # stream completed` at the original line 1186), add the `except` branch:

```python
                                            elif _etype == "finish":
                                                finish_reason = _ant_event.get("finish_reason", "stop")
                                        break  # stream completed
                                    except asyncio.TimeoutError:
                                        # Phase 066 D-066-11: clean termination contract.
                                        # _ant_gen.close() raises GeneratorExit inside
                                        # anthropic_service.py:169's `with` block →
                                        # MessageStream.__exit__ → response.close().
                                        # SYNC method (anthropic 0.97.0); do NOT `await`.
                                        try:
                                            _ant_gen.close()
                                        except Exception:
                                            logger.debug(
                                                "_ant_gen.close() raised during timeout — non-fatal",
                                                exc_info=True,
                                            )
                                        # Re-raise — propagates to the outer `except
                                        # asyncio.TimeoutError` at threads.py:~2140 which
                                        # sets _terminal_status='timed_out' (Plan 01).
                                        raise
```

(The exact indentation is critical — the `try:` opens at the same indent as the original `for _ant_event in _ant_gen:` line; the `async with` is one level deeper; the `for` is one level deeper than that. The `except asyncio.TimeoutError:` aligns with the original `try:`. The `break` stays at its original level INSIDE the async-with.)

**Subtask 2c — Wrap the OpenAI/Google/OpenRouter path (threads.py:~1215) in per-call timer + close-then-raise.**

Find:

```python
                                else:
                                    # --- OpenAI / Google / OpenRouter / Ollama path (unchanged) ---
                                    stream, calling_mode = create_adaptive_streaming_chat(
                                        messages=messages,
                                        ...
                                    )
                                    # ... (calling_mode check + tool_calls_buffer setup) ...
                                    for chunk in stream:
                                        if not chunk.choices:
                                            continue
                                        ...
```

Replace the `for chunk in stream:` block with the per-call-timer wrap. After `_announced_tools: set[int] = set()` (around line 1213) and BEFORE `for chunk in stream:`, insert:

```python
                                    # Phase 066 D-066-02 + D-066-03 + D-066-11: per-LLM-call
                                    # timer + close-then-raise. Resolve budget before each
                                    # iteration so per-iteration reset is honored
                                    # (asyncio.timeout creates a fresh deadline per `async with`).
                                    from app.config import get_per_call_timeout  # local import — same module already imported above for Anthropic path
                                    _model_id = body.model or user_settings.llm_model
                                    per_call_budget = get_per_call_timeout(_model_id, settings)
                                    try:
                                        async with asyncio.timeout(per_call_budget):
                                            for chunk in stream:
                                                if not chunk.choices:
                                                    continue
                                                choice = chunk.choices[0]
                                                delta = choice.delta
                                                if choice.finish_reason:
                                                    finish_reason = normalize_finish_reason(choice.finish_reason)
                                                if delta.content:
                                                    full_content += delta.content
                                                    await _emit(redis, run_id, 'delta', content=delta.content)
                                                if delta.tool_calls:
                                                    for tc in delta.tool_calls:
                                                        idx = tc.index
                                                        if idx not in tool_calls_buffer:
                                                            tool_calls_buffer[idx] = {"id": "", "name": "", "arguments": ""}
                                                        if tc.id:
                                                            tool_calls_buffer[idx]["id"] = tc.id
                                                        if tc.function and tc.function.name:
                                                            tool_calls_buffer[idx]["name"] = tc.function.name
                                                            if idx not in _announced_tools:
                                                                _announced_tools.add(idx)
                                                                await _emit(redis, run_id, 'tool_preparing', name=tc.function.name, index=idx)
                                                        if tc.function and tc.function.arguments:
                                                            tool_calls_buffer[idx]["arguments"] += tc.function.arguments
                                    except asyncio.TimeoutError:
                                        # Phase 066 D-066-11: openai 2.28.0 Stream.close() is sync
                                        # and idempotent — closes underlying httpx response.
                                        # SYNC method; do NOT `await`. Suppresses GeneratorExit at
                                        # langsmith/run_helpers.py:1680 because the wrap_openai
                                        # generator sees a normal stream-end.
                                        try:
                                            stream.close()
                                        except Exception:
                                            logger.debug(
                                                "stream.close() raised during timeout — non-fatal",
                                                exc_info=True,
                                            )
                                        raise
```

The original `for chunk in stream:` body (lines 1215-1244) is preserved verbatim INSIDE the new `async with` — only its surrounding indentation level shifts inward by 8 spaces (two levels: outer try/except + inner async-with). No logic changes.

**Subtask 2d — Refine the Plan 01 placeholder error string at threads.py:~2147** to include the iteration counter, model id, and budget.

Plan 01 wrote:

```python
                except asyncio.TimeoutError:
                    _terminal_status = "timed_out"
                    _terminal_error = "timed_out: per-call deadline exceeded"
                    logger.warning(
                        "Run %s timed out (Plan 01 placeholder — Plan 02 will refine)",
                        run_id,
                    )
```

Replace with the D-066-07 final format. Note: `iteration`, `_model_id`, and `per_call_budget` are local variables inside the agent loop body. They go OUT OF SCOPE by the time control reaches this `except` at the agent_runner top level — so capture them via closure variables initialized before the while-True loop:

At the top of `agent_runner` (just after `_terminal_error: str | None = None` at threads.py:852), add:

```python
        # Phase 066 D-066-07: capture per-iteration context for the timed_out
        # error string. Updated each iteration BEFORE the LLM stream block
        # (around line ~1149 / ~1213) so the outer except sees the iteration
        # at which the timer fired.
        _last_iteration: int = 0
        _last_model_id: str = ""
        _last_per_call_budget: int = 0
```

Inside the agent loop, RIGHT AFTER `_model_id` and `per_call_budget` are computed (in BOTH provider paths — once in the Anthropic block, once in the OpenAI block, AND tracking iteration), update the trio:

```python
                                    # Phase 066 D-066-07: capture for outer-except error format
                                    _last_iteration = iteration
                                    _last_model_id = _model_id
                                    _last_per_call_budget = per_call_budget
```

Place this immediately after `per_call_budget = get_per_call_timeout(...)` in BOTH provider paths.

Then refine the outer `except asyncio.TimeoutError:` branch at threads.py:~2140:

```python
                except asyncio.TimeoutError:
                    # Phase 066 D-066-05 + D-066-07: per-LLM-call asyncio.timeout fired
                    # inside the SDK iteration block. _last_iteration / _last_model_id /
                    # _last_per_call_budget were captured at the iteration start
                    # (closure variables initialized to defaults at top of agent_runner).
                    # The format mirrors the contract documented in CONTEXT.md D-066-07
                    # exactly so log/audit consumers can grep on the prefix.
                    _terminal_status = "timed_out"
                    _terminal_error = (
                        f"timed_out: {_last_per_call_budget}s per-call deadline "
                        f"exceeded at iteration {_last_iteration} "
                        f"(model={_last_model_id})"
                    )
                    logger.warning(
                        "Run %s timed out at iteration %d (model=%s, budget=%ds)",
                        run_id, _last_iteration, _last_model_id, _last_per_call_budget,
                    )
```

**Subtask 2e — Update runs.py consumer-deadline references.**

Find at runs.py:70:
```python
#   - Deadline = monotonic + run_hard_timeout_seconds + 10
```

Replace with:
```python
#   - Deadline = monotonic + consumer_timeout_seconds (Phase 066: 610s default;
#     was run_hard_timeout_seconds + 10 = 130s pre-066. Bumped to outlast the
#     producer's max_iterations × per_call_budget worst-case wall-time.)
```

Find at runs.py:85:
```python
    deadline = time_mod.monotonic() + settings.run_hard_timeout_seconds + 10
```

Replace with:
```python
    deadline = time_mod.monotonic() + settings.consumer_timeout_seconds
```

Find at runs.py:180 (within the `try:` block):
```python
                # the full run_hard_timeout_seconds + 10 for consumer_timeout.
```

Replace with:
```python
                # the full consumer_timeout_seconds for this consumer.
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "import ast; t = ast.parse(open('app/api/threads.py').read()); print('threads.py parses OK')"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "import ast; t = ast.parse(open('app/api/runs.py').read()); print('runs.py parses OK')"</automated>
    <automated>! grep -n "asyncio.timeout(settings.run_hard_timeout_seconds)" "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>grep -c "async with asyncio.timeout(per_call_budget)" "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py" | grep -E "^2$"</automated>
    <automated>grep -q "_ant_gen.close()" "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>grep -q "stream.close()" "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>grep -q "from app.config import get_per_call_timeout" "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>grep -q "f\"timed_out: {_last_per_call_budget}s per-call deadline " "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>! grep -n "run_hard_timeout_seconds" "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>! grep -n "settings.run_hard_timeout_seconds" "C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py"</automated>
    <automated>grep -q "settings.consumer_timeout_seconds" "C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py"</automated>
    <automated>grep -q '"status": "cancelled"' "C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py"</automated>
    <automated>! grep -E '"status".*"timed_out"' "C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.api.threads import agent_runner_module_marker if False else None; from app.api import threads, runs; print('imports OK')" 2>&amp;1 || cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.api import threads, runs; print('imports OK')"</automated>
  </verify>
  <done>
    - Outer `async with asyncio.timeout(settings.run_hard_timeout_seconds)` at threads.py:855 is GONE
    - Per-LLM-call `async with asyncio.timeout(per_call_budget)` appears EXACTLY 2 times (Anthropic path + OpenAI path)
    - `_ant_gen.close()` and `stream.close()` both appear in the file (sync — no `await`)
    - TimeoutError outer-except branch at threads.py:~2140 uses the refined format `f"timed_out: {_last_per_call_budget}s per-call deadline exceeded at iteration {_last_iteration} (model={_last_model_id})"`
    - threads.py + runs.py both parse as valid Python
    - All 3 `settings.run_hard_timeout_seconds` references in runs.py are now `settings.consumer_timeout_seconds`
    - runs.py cancel handler still writes `status="cancelled"` (T-066-01 partition guard intact — verified by negation grep)
    - Backend imports cleanly (no startup ImportError)
  </done>
</task>

<task type="auto">
  <name>Task 3: Commit per-call timer + outer wrapper deletion + consumer deadline rename</name>
  <files>backend/app/config.py, backend/app/api/threads.py, backend/app/api/runs.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md (Plan 01 commit pattern)
    - C:/Vibe Apps/Agentic RAG/CLAUDE.md (commit guidelines)
  </read_first>
  <action>
Stage exactly the 3 files (no `git add -A`):

```bash
git add backend/app/config.py backend/app/api/threads.py backend/app/api/runs.py
```

Commit (HEREDOC):

```
feat(066-02): per-LLM-call timeout + clean SDK stream close on timeout — replace 120s total-deadline wrapper

Phase 066 D-066-01, 02, 03, 11. Closes Gap-006 (LLM agent stops mid-iteration
on complex tool-call prompts; surfaces as GeneratorExit in LangSmith).

- backend/app/config.py: ModelCapability TypedDict gains llm_call_timeout_seconds
  field; all 30 entries get explicit values per RESEARCH.md A1 matrix (60s
  fast / 90s mini-tier / 180s default / 240s capable / 600s reasoning).
  get_per_call_timeout(model_id, settings) helper resolves env override →
  per-model default → 180s fallback. _parse_llm_call_timeout_overrides()
  parses LLM_CALL_TIMEOUT_OVERRIDES env (mirrors MODEL_CONTEXT_LIMITS shape;
  bounds [1, 3600] per T-066-05). Settings.run_hard_timeout_seconds DELETED;
  consumer_timeout_seconds=610 added (independent of producer per-call budget;
  bounds the replay-tail consumer's deadline at runs.py:85).
- backend/app/api/threads.py:855: outer asyncio.timeout(run_hard_timeout_seconds)
  wrapper DELETED (D-066-01). Agent loop has no hard total cap.
- backend/app/api/threads.py:1149-1186 (Anthropic native): per-LLM-call
  asyncio.timeout(per_call_budget) wraps the for _ant_event in _ant_gen
  block; on TimeoutError calls _ant_gen.close() (sync — anthropic 0.97.0
  generator) which triggers anthropic_service.py:169 `with client.messages.stream()`
  __exit__ → MessageStream.close() → response.close(). Then re-raises.
- backend/app/api/threads.py:1215-1244 (OpenAI/Google/OpenRouter): same
  pattern with stream.close() (sync — openai 2.28.0 Stream method).
- backend/app/api/threads.py:2140-2147: TimeoutError error string refined
  to D-066-07 format using _last_iteration / _last_model_id /
  _last_per_call_budget closure vars captured at iteration start.
- backend/app/api/runs.py:70, 85, 180: settings.run_hard_timeout_seconds
  references swapped to settings.consumer_timeout_seconds. Cancel handler
  at lines 422-424 UNCHANGED (still status='cancelled' / error='cancelled_by_user'
  per D-066-05 partition guard).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --pretty=%s | grep -q "066-02"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --name-only --pretty=format: | tr -d '\r' &gt; /tmp/066-02-files.txt &amp;&amp; grep -q "backend/app/config.py" /tmp/066-02-files.txt &amp;&amp; grep -q "backend/app/api/threads.py" /tmp/066-02-files.txt &amp;&amp; grep -q "backend/app/api/runs.py" /tmp/066-02-files.txt</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git status --porcelain | grep -E "^(M|A) " | grep -v "PLAN\.md$" | grep -v "SUMMARY\.md$" | wc -l | tr -d ' ' | grep -E "^0$"</automated>
  </verify>
  <done>
    - Single commit named "feat(066-02): ..." on the current branch
    - Touches exactly the 3 files
    - Working tree clean post-commit
  </done>
</task>

</tasks>

<verification>
- All Task 2 grep gates pass:
  - 0 hits for `asyncio.timeout(settings.run_hard_timeout_seconds)`
  - exactly 2 hits for `async with asyncio.timeout(per_call_budget)`
  - both `_ant_gen.close()` and `stream.close()` present
  - 0 hits for `run_hard_timeout_seconds` anywhere in `backend/app/`
  - threads.py uses `settings.consumer_timeout_seconds` in runs.py only (it never appears in threads.py)
- `cd backend && venv/Scripts/python.exe -c "from app.api import threads, runs; print('OK')"` exits 0
- `cd backend && venv/Scripts/python.exe -c "from app.config import get_per_call_timeout; assert get_per_call_timeout('claude-opus-4-7') == 600"` exits 0
- `runs.py:422-424` still writes `status="cancelled"` (T-066-01 partition guard unchanged) — verified via grep negation
- Single commit landed
</verification>

<success_criteria>
- Outer `asyncio.timeout` wrapper at threads.py:855 is deleted (D-066-01)
- Per-LLM-call timer wraps both provider stream blocks (D-066-02)
- SDK stream is closed cleanly before re-raising TimeoutError (D-066-11) — both paths
- `MODEL_CAPABILITIES` carries per-model `llm_call_timeout_seconds` for all 30 known models (D-066-03)
- `LLM_CALL_TIMEOUT_OVERRIDES` env-var parser bounds values to [1, 3600] (T-066-05)
- TimeoutError error string format matches D-066-07 contract (`timed_out: Ns per-call deadline exceeded at iteration N (model=...)`)
- runs.py cancel handler partition guard UNCHANGED (T-066-01)
- Backend imports clean — no module-level errors at startup
</success_criteria>

<output>
After completion, create `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-02-SUMMARY.md` documenting:
- Indentation strategy chosen for outer-wrapper deletion (`if True:` preservation vs full re-indent) — and why
- Files modified with exact line ranges
- Per-model timeout matrix as committed (any deviations from the planned matrix)
- Confirmation that `runs.py:422-424` cancel handler is byte-identical to pre-Plan-02 state
- Plan 04's prerequisite test scaffolding signal: the `_last_iteration / _last_model_id / _last_per_call_budget` closure variables are now in place; tests can assert on the formatted error string content
</output>
