# Session Report: Streaming Timeout & Silence Gap Investigation

**Date:** 2026-05-25
**Scope:** Cross-provider timeout failures, output token truncation, silence gap analysis
**Commits:** `0dce56a` (original fix), `61e5eb1` (partial revert)
**Related phases:** 075, 075.1–075.11, 066

---

## 1. Issues Reported

The user tested a complex prompt (generate a PPTX from a 180-page DBA dissertation) across multiple providers and observed:

| Issue | Provider(s) | Severity |
|-------|-------------|----------|
| "Agent reached time limit" despite `.env` overrides | Anthropic (Sonnet 4.6), Google (Flash) | Critical |
| `search_documents` failing with OpenAI 429 | All non-OpenAI providers | High |
| No visible progress during multi-iteration runs | All providers | Medium |
| Output truncation ("Response truncated — output token limit reached") | Google (Flash) | High |
| `GeneratorExit` errors in LangSmith | Anthropic | Low |

---

## 2. Root Causes Found

### 2a. `.env` split-line bug (CRITICAL — timeout overrides not loading)

**File:** `backend/.env` line 134-135

The `LLM_CALL_TIMEOUT_OVERRIDES` value was split across two lines:
```
L134: LLM_CALL_TIMEOUT_OVERRIDES=...minimax-m2.7=1800,claude-sonnet-\n
L135: 4-6=1800,claude-opus-4-6=1800,...
```

Pydantic's dotenv parser does NOT support line continuation. It read only line 134, which ended at `claude-sonnet-` (incomplete). ALL Claude overrides were silently dropped. Result: `claude-sonnet-4-6` used the registry default of **240s** instead of the intended **1800s**.

**Fix:** Joined the value onto one line. Verified with diagnostic script run from `backend/` directory.

**Diagnosis method:** Wrote `scripts/diag_timeout.py` that imported `app.config.settings` and printed resolved timeouts. Initially run from repo root (wrong CWD — Pydantic reads `.env` relative to CWD), then from `backend/` directory which confirmed the fix.

### 2b. Registry timeout defaults too aggressive

**File:** `backend/app/config.py` MODEL_CAPABILITIES dict

The Phase 066 research calibrated timeouts for typical chat turns, not code generation:

| Tier | Old default | Problem |
|------|-------------|---------|
| nano/lite | 60s | Chokes on any non-trivial response |
| mini/flash/haiku | 90s | Insufficient for code generation |
| capable (Sonnet, Pro, GPT-5) | 180-240s | Fails on 500+ line python-pptx scripts |
| reasoning (Opus, o-series) | 600s | Adequate for most tasks |

**Fix:** Bumped to 3-tier model: 180s (nano/lite), 300s (standard), 600s (capable), 900s (reasoning). The timeout is a ceiling, not a target — simple chats finish fast regardless.

### 2c. Output token ceilings too low

**File:** `backend/app/services/openai_service.py`

`_PROVIDER_DEFAULT_MAX_TOKENS` was 16,384 for all cloud providers. For the main agent generating python-pptx code (500+ lines), this caused `finish_reason=length` (truncation). Sub-agents also clamped to 16k via `_MODEL_OUTPUT_DEFAULTS`.

**Fix:** Bumped `_PROVIDER_DEFAULT_MAX_TOKENS` from 16k to 32k for all cloud providers. Updated per-model defaults for Haiku (8k→32k), Opus 4.7/4.6 (16k→32k). All values verified against `MODEL_CAPABILITIES` API caps via clamp gate.

### 2d. Embeddings always use OpenAI

**File:** `backend/app/services/openai_service.py:566-589`

`search_documents` calls `embed_texts()` which creates an `OpenAI(...)` client regardless of the user's LLM provider. When the user's LLM provider is Anthropic/Google and no dedicated `EMBEDDING_API_KEY` is set, the fallback sends the Anthropic/Google key to OpenAI's API → 429 error.

**Fix:** User added OpenAI credits. Structural fix (dedicated `EMBEDDING_API_KEY`) documented but not implemented — deferred to future phase.

### 2e. `GeneratorExit` in LangSmith

Caused by the too-short per-call timeout (240s). When `asyncio.timeout` fires, it closes the SDK stream. LangSmith's `_TracedStream.__iter__` catches the `GeneratorExit` during cleanup and records it as an error. With the bumped timeouts, the LLM finishes before the timer fires, so `GeneratorExit` should be rare.

---

## 3. Silence Gap Analysis

A comprehensive investigation of the 075.x phase series was conducted to understand why users perceive "nothing happening" during multi-iteration agent runs.

### What 075.x delivered (all working)

| Phase | What it solved |
|-------|---------------|
| 075 | Snapshot endpoint + line-by-line stdout + `tool_args_progress` |
| 075.1 | 11 cross-provider streaming bugs (harvest blocking, drain step) |
| 075.4 | Per-thread streaming state + `system_warning` events |
| 075.5 | Google native SDK + provider error surfacing |
| 075.6 | Live code panel + Working badge + step-list collapse |
| 075.8 | StatusPill + thinking row + past-step fold |
| 075.9 | Shiki streaming handoff (no code "blink") |
| 075.10 | Fine-grained `tool_args_progress` (256B) for OpenAI/OpenRouter |
| 075.11 | Timeout config knobs (`.env` overrides) |

### The unsolved gap: TTFT (Time-To-First-Token)

The 2-60 second window between stream creation and the provider's first token is **fundamentally silent** — the backend has NO data from the provider during this window. In a 10-iteration run, this accumulates to 20-300s of total silence.

**Provider comparison during this window:**

| Provider | TTFT (typical) | Events during gap |
|----------|----------------|-------------------|
| Anthropic (Sonnet) | 2-15s | ZERO |
| Google (Flash) | 1-10s | ZERO |
| OpenAI (GPT-5.x) | 1-8s | ZERO |
| Anthropic (Opus) | 10-60s | ZERO |

The existing "Thinking... planning next step" row from Phase 075.8 IS visible during this gap, but users perceive it as "stuck" because nothing changes.

### Additional gaps

- **Google tool args**: Delivered atomically (not progressively). Live code panel works on Anthropic/OpenAI but shows code all-at-once on Google. Structural SDK limitation — cannot be fixed.
- **Step-list collapse**: Phase 075.6's Focus Mode collapses completed tool calls after 3+. Download cards from earlier `execute_code` batches get hidden inside collapsed rows.
- **No text between tool calls**: Claude emits ZERO text deltas between batch `execute_code` calls (goes directly to `tool_use`). The `message.content` area stays empty for the entire multi-iteration run until the final text response.

---

## 4. Attempted Fixes & Outcomes

### Fix attempt: 5 changes to close silence gaps (commit `0dce56a`)

| Change | Description | Outcome |
|--------|-------------|---------|
| System prompt narration rule | Tell model to emit brief status between `execute_code` batches | **REVERTED** — caused unpredictable model behavior, thinking text leaked into chat |
| `planning` on iteration 0 | Removed `iteration > 0` guard | **REVERTED** — extra events caused heavy React re-renders |
| `planning` with `hint` before LLM call | 3 emit sites (Anthropic/Google/OpenAI) | **REVERTED** — `planningHint` field leaked into chat area, heavy re-renders |
| `max_iterations` in `iteration_start` | Enable "Step N of M" display | **REVERTED** — `maxIterations` field unused, added complexity |
| Frontend: `planningHint` + `maxIterations` in RunCard | Show model name in thinking row, step count | **REVERTED** — caused visible regressions, frontend became sluggish |

**All 5 streaming/UI changes were reverted in commit `61e5eb1`.**

### Fixes kept (working, no regressions)

| Change | File | Impact |
|--------|------|--------|
| Timeout defaults bumped to 3-tier | `config.py` | Prevents false-positive timeouts on complex tasks |
| Output token ceilings bumped (16k→32k) | `openai_service.py` | Prevents "Response truncated" on code generation |
| `.env` split-line fix | `backend/.env` | All Claude overrides now load correctly |
| Worst-case wall-time comment updated | `threads.py` | Documentation accuracy |

---

## 5. Lessons Learned

1. **The TTFT silence gap cannot be solved with quick SSE additions.** The backend genuinely has no data from the provider during this window. Attempting to paper over it with extra `planning` events caused more harm (extra re-renders, state leakage) than the original silence.

2. **Frontend state changes must be minimal and tested.** Adding fields to the Message type (`planningHint`, `maxIterations`) and reading them in RunCard caused rendering regressions that weren't caught by `tsc --noEmit` alone.

3. **System prompt changes affect model behavior unpredictably.** The "narration between batches" rule caused some models to emit thinking process text, retry code in the chat area, or behave inconsistently across providers.

4. **The `.env` split-line was a silent configuration failure.** Pydantic Settings doesn't warn about truncated values. The override was set in Phase 075.11 but never actually loaded by the backend. Future `.env` changes should be verified with a diagnostic script.

5. **Timeout ceilings should be generous by default.** The per-call timeout is a safety net for hung streams, not a performance constraint. Simple chats finish fast regardless of the ceiling. The Phase 066 research calibrated for typical turns, not agentic code-generation workflows.

---

## 6. What Remains Open

| Item | Description | Recommendation |
|------|-------------|----------------|
| TTFT silence gap | 2-60s per iteration with no visible progress | Needs a dedicated UX phase — not a quick fix. Consider: artifact-style preview panel, progress estimation based on past iteration timing, or a visible "Waiting for model response" state with elapsed timer. |
| Google atomic tool args | Live code panel empty until `tool_start` | Structural SDK limitation. Cannot be fixed without Google changing their streaming behavior. |
| No text between `execute_code` batches | Model goes directly to `tool_use` without text | Model behavior — cannot be forced via system prompt without side effects. Consider: backend-injected synthetic `delta` events (risky) or accept as inherent to the architecture. |
| Step-list collapse hides download cards | Output files from earlier batches are in collapsed rows | Consider: exempt `execute_code` with `output_files` from Focus Mode collapse. Low risk, pure frontend change. |
| Embedding always uses OpenAI | `search_documents` fails when no OpenAI key | Set `EMBEDDING_API_KEY` in `.env` as a dedicated OpenAI key. Structural fix would be per-provider embedding routing — future phase. |

---

## 7. Files Modified (net of revert)

Only the timeout/token changes survive:

| File | Change |
|------|--------|
| `backend/app/config.py` | MODEL_CAPABILITIES timeouts bumped; DEFAULT_LLM_CALL_TIMEOUT_SECONDS 180→300; _INFERRED_DEFAULT_TIMEOUT_S 90→300; tier comments updated |
| `backend/app/services/openai_service.py` | _PROVIDER_DEFAULT_MAX_TOKENS 16k→32k; _FALLBACK_MAX_TOKENS 8k→16k; per-model output defaults bumped (Haiku, Opus, flash-lite); added gemini-3.5-flash and gemini-3.1-flash-lite entries |
| `backend/app/api/threads.py` | Worst-case wall-time comment updated (15×180s→15×300s) |
| `backend/.env` | Split-line fix for LLM_CALL_TIMEOUT_OVERRIDES |

Frontend files are **unchanged** from the pre-session state (all streaming/UI changes reverted).
