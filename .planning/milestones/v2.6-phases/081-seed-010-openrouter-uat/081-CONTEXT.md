# Phase 081: SEED-010 OpenRouter UAT - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that the synthetic-timeout protocol (`LLM_CALL_TIMEOUT_OVERRIDES`) produces clean `runs.status='timed_out'` on OpenRouter-routed Kimi-k2.5 and MiniMax-m2.7 — closing 067.2 Rows 11-12 that were deferred since v2.5. UAT-only phase: no code changes, no schema changes, no API surface changes.

</domain>

<decisions>
## Implementation Decisions

### Verification Depth (D-081-01)
- **D-01:** Each of the 4 runs verifies three layers: (1) `runs.status='timed_out'` in Supabase DB, (2) backend logs confirm clean timeout format (`timed_out: Xs per-call deadline exceeded at iteration N` — NOT `GeneratorExit`), (3) frontend shows appropriate timeout badge/error state AND title generation still works despite the failed run. Chrome MCP drives the frontend verification.
- **D-02:** Matches Phase 067.2 Row 8 precedent depth (DB + logs) PLUS frontend verification. SSE event replay and LangSmith trace inspection are NOT required.

### Test Prompt Design (D-081-03)
- **D-03:** 4 runs total — 2 per model (1 simple chat + 1 tool-calling per model):
  - Run 1 (Kimi-k2.5): Simple chat prompt (e.g., "Write a 500-word essay on AI safety") — tests plain streaming timeout
  - Run 2 (Kimi-k2.5): Tool-calling prompt (e.g., "Search my documents about X and summarize") — tests timeout during agent loop iteration
  - Run 3 (MiniMax-m2.7): Simple chat prompt (same pattern)
  - Run 4 (MiniMax-m2.7): Tool-calling prompt (same pattern)
- **D-04:** Timeout override is 10 seconds per model (`LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10,minimax/minimax-m2.7=10`). This is tight enough to trigger a timeout on any non-trivial prompt.

### BUG-260526-02 Observability (D-081-05)
- **D-05:** During the 4 runs, observe whether OpenRouter-routed Kimi-k2.5 exhibits the thinking/reasoning text leakage documented in BUG-260526-02 (known on direct Moonshot API). Document findings as an observation in the UAT notes — does NOT affect pass/fail of the timeout verification. If leakage is observed on OpenRouter, update BUG-260526-02 with the expanded repro scope.

### Environment Protocol (D-081-06)
- **D-06:** The `.env` change (`LLM_CALL_TIMEOUT_OVERRIDES`) is temporary — restore the original value after UAT completes. Operator restarts uvicorn manually before and after the test runs.

### Claude's Discretion
- Exact prompt wording for the 4 runs (must be complex enough to not finish in <10 seconds)
- Whether to capture screenshots or just text-based evidence
- Order of the 4 runs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Timeout Machinery
- `.planning/milestones/v2.5-phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md` — Phase 066 timeout architecture (L1/L2/L3 layers)
- `backend/app/config.py:376-462` — `LLM_CALL_TIMEOUT_OVERRIDES` parser + `get_per_call_timeout()` resolution

### Prior UAT Protocol
- `.planning/milestones/v2.5-phases/067.2-streaming-render-and-storage-fixes/067.2-HUMAN-UAT.md` — Rows 8, 11, 12: Row 8 = GREEN precedent on GPT-5.4; Rows 11-12 = deferred OpenRouter Kimi/MiniMax verification (this phase closes them)

### Model Registry
- `backend/app/config.py:232-238` — OpenRouter MODEL_CAPABILITIES entries for `moonshotai/kimi-k2.5`, `minimax/minimax-m2.7`, etc.
- `backend/app/services/openai_service.py:654-656` — OpenRouter `_MODEL_OUTPUT_DEFAULTS` entries

### Requirement
- `.planning/REQUIREMENTS.md` — POLISH-SEED-010-01: `LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10,minimax/minimax-m2.7=10` produces clean `runs.status='timed_out'` (NOT `GeneratorExit`)

### Reported Bugs
- `.planning/reported-bugs/kimi-thinking-leaks-into-content.md` — BUG-260526-02 (observe-only during this UAT)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`LLM_CALL_TIMEOUT_OVERRIDES` env-var parser** (`config.py:416-457`): already handles the `model=seconds` syntax with validation bounds [1, 3600] and warning for tight budgets (<30s). No code changes needed — just set the env var.
- **`get_per_call_timeout(model_id)`** (`config.py:462+`): resolves MODEL_CAPABILITIES → env override → default. OpenRouter models (`moonshotai/kimi-k2.5`, `minimax/minimax-m2.7`) are registered in the capabilities dict with `llm_call_timeout_seconds: 900/600`.
- **Timeout machinery** (`threads.py` agent loop): `asyncio.wait_for(timeout=per_call_budget)` wraps each LLM call. On timeout → `runs.status='timed_out'`, `runs.error='timed_out: Xs per-call deadline exceeded at iteration N'`.
- **Chrome MCP**: available for frontend verification per `feedback_chrome_mcp_testing.md`.

### Established Patterns
- **Phase 067.2 Row 8 protocol**: set `LLM_CALL_TIMEOUT_OVERRIDES=gpt-5.4=5`, restart uvicorn, submit prompt, verify DB + logs + title-gen. Same pattern reused for OpenRouter models.
- **OpenRouter routing**: `moonshotai/kimi-k2.5` and `minimax/minimax-m2.7` route through `openai_service.py` (OpenAI-compat path) via OpenRouter's API, using `OPENROUTER_API_KEY`.

### Integration Points
- **`backend/.env`**: `LLM_CALL_TIMEOUT_OVERRIDES` line (temporary addition for UAT)
- **Supabase `runs` table**: `status`, `error` columns for verification
- **Frontend chat surface**: timeout badge/error state display

</code_context>

<specifics>
## Specific Ideas

No specific requirements — follows the established synthetic-timeout UAT protocol from Phase 067.2 Row 8.

</specifics>

<deferred>
## Deferred Ideas

The following UX issues were raised during discussion. All are real observations but outside Phase 081's UAT-only scope — they belong in a dedicated polish/UX phase.

1. **Title generation not working for some providers** — New bug report needed. Some providers don't generate thread titles. Needs investigation of which providers are affected and whether the title-gen path handles provider-specific response formats.

2. **Duplicated summarizing agents / reading documents in tool panel** — Likely related to BUG-260526-01 (tool card duplication during streaming). May need investigation of whether the dedup logic in StreamsProvider handles all sub-agent tool types correctly.

3. **Final output download section should be outside the tool panel** — UX feature request. Currently users must open the tool panel and scroll to find the download section. Should be promoted to a visible position outside the collapsed tool panel (e.g., pinned below the assistant message or in a dedicated output section).

4. **Overall timer sometimes does not appear** — BUG-260526-04 (already open, status: open). Timer disappears mid-cycle on temp-id remount. Known issue.

5. **Pulsing app logo below tool panel above chat box** — UX feature request inspired by Claude.ai's pulsing orange logo indicator. Shows "still working" signal between the last response and the chat input. Would provide a persistent visual signal that the agent is active, especially during long-running tasks where the tool panel is collapsed.

</deferred>

---

*Phase: 081-seed-010-openrouter-uat*
*Context gathered: 2026-05-27*
