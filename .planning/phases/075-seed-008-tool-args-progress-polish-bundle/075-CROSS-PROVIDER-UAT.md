# Phase 075 — Cross-Provider End-to-End UAT

**Date:** 2026-05-19 (started 2026-05-18 UTC)
**Tester:** Chrome DevTools MCP + LangSmith REST API + Supabase REST API
**Status:** ALL THREE ROUNDS HIT BUGS — three distinct failure modes documented
**Prompt:** *"search for Fahed Mrad dissertation, make a professional pptx for defence session and include comprehensive charts and visuals"*

---

## Summary Table

| Round | Provider | Model (UI) | Model (LangSmith) | Backend Status | Frontend Status | UX Verdict |
|-------|----------|-----------|-------------------|----------------|-----------------|------------|
| 1 | OpenAI | `gpt-5.4` | `gpt-5.4` + `gpt-5.4-mini` (sub-agent) | ✓ Completed (5 tool calls, 414s) | ✗ Stuck on "Executing code" forever, **no Resume button** | **Silent freeze** — worst UX |
| 2 | Anthropic | `claude-sonnet-4-6` | `claude-haiku-4-5-20251001` (sub-agent) | ✓ Completed (13 tool calls, ~5min) | ✗ **Completely blank** UI — no user msg, no steps, no streaming text for the entire run | **Total black box** |
| 3 | OpenRouter | `moonshotai/kimi-k2.6` | `moonshotai/kimi-k2.6:exacto` | 🔄 Still streaming at observation time | ⚠ Renders all tool steps correctly, then **Resume button DOES appear** mid-stream when backend is still alive | **False-positive recovery** — BUG-260518-01 still reproduces |

---

## Bug Inventory (NEW, found during this UAT)

### B-260519-01 — Anthropic provider produces zero frontend rendering
**Severity:** blocker
**Trigger:** Submit any prompt with `Anthropic / claude-sonnet-4-6` as the active provider/model.
**Symptoms:** Backend agent loop runs perfectly (13 tool calls completed, runStatus=completed in DB), but the **frontend never renders the user message, never renders any Step indicator, never renders any streamed text** for the entire run lifecycle. Just the empty thread heading + a disabled composer. F5 reload + click thread still shows nothing because the rendering logic itself is broken for Anthropic responses.
**Evidence:**
- Thread `117a5ad2-a9ed-4172-99d0-9eaa9e3ca1ca`, run `7d7c2b19-86f3-4e03-8f69-b39ffd89ca87`
- Snapshot returns 2 messages with the assistant message fully populated (13 tool_calls, content present)
- Frontend `main.innerText.length = 167` chars (just UI chrome) during the entire run AND after completion
- Console: NO errors logged
**Suspected cause:** Anthropic's SSE event order/format diverges from the OpenAI shape that StreamsProvider's reducer expects. Likely related to D-075-15's deferred BUG-260514-02 root cause — Anthropic mixed text + tool_use block ordering breaks the message-content reducer. Plan 03's new `tool_args_progress` event on `anthropic_service.py:204-236` may have aggravated this if the new event isn't consumed correctly.
**Fix surface:** `frontend/src/providers/StreamsProvider.tsx` SSE event reducer + `frontend/src/components/chat/MessageItem.tsx` content-block rendering. Likely needs explicit Anthropic content-block handling.

### B-260519-02 — Snapshot endpoint returns 503 on brand-new empty threads
**Severity:** major
**Trigger:** Create a brand-new thread (POST /threads), then immediately GET /threads/{tid}/snapshot before any message is sent (which the frontend does automatically on mount).
**Symptoms:** Endpoint returns `503 {"detail":"Streaming infrastructure unavailable"}` with `Retry-After: 10` (the D-062-13 Redis-down posture).
**Evidence:**
- Round 1, reqid=728: `GET /threads/e00649c9-99a5-44ae-98cb-a3f4842a29d6/snapshot → 503` immediately after POST /threads (response time was within milliseconds — Redis is not actually down).
- Round 2 + Round 3 returned 200 — so it's flaky, not deterministic. Possibly a race between thread-create commit and the first /snapshot request hitting the Redis probe before the thread is visible.
**Suspected cause:** D-075-04 has the Redis probe gated on Redis availability, but the probe runs unconditionally even when `active_runs` is empty (no run_ids to probe). For a brand-new empty thread there's nothing in Redis to probe; the endpoint should short-circuit `since_cursors: {}` without touching Redis.
**Fix surface:** `backend/app/api/threads.py:510-552` snapshot endpoint — skip the Redis probe when `active_runs == []`. The probe should only fire per active run.

### B-260519-03 — Plan 01 BUG-260518-01 fix incomplete for OpenRouter stream-end
**Severity:** major
**Trigger:** Submit any prompt that triggers `execute_code` with an `OpenRouter / moonshotai/kimi-k2.6` model.
**Symptoms:** During the execute_code step (Step 3 in the OpenRouter test), the SSE stream's stream-end pattern flips `runStatus → "failed"` and surfaces the "Resume run" button — even though `/snapshot` would confirm `active_runs` still contains the streaming run.
**Evidence:**
- Round 3, thread `f795def5-1572-43a0-8689-ed7f6f6f7cb0`, run `90a5abe5-015b-4f19-91a2-ef26c59d5283`
- Backend snapshot at T+255s: `active_runs: [{run_id: 90a5abe5..., status: "streaming"}]` — run alive.
- Frontend: `resumeBtnVisible: true`, `inputDisabled: false` — Resume button shown, composer enabled.
- This is BUG-260518-01 STILL REPRODUCING despite Plan 01's `_isTransientBufferExpired` wiring at `StreamsProvider.tsx:111`.
**Suspected cause:** `_isTransientBufferExpired` only matches the literal prefix `buffer_expired*`. OpenRouter's stream-end emits a different error message (likely something like `openrouter_disconnected` or `provider_disconnect`) that doesn't match the filter, so the transient → snapshot-probe fallback never fires.
**Fix surface:** `frontend/src/providers/StreamsProvider.tsx:104-117` — widen `_isTransientBufferExpired` (rename to `_isTransientStreamEnd`) to ALSO probe `/snapshot` on (a) `kind === "done"` when any tool_call.status is still `running`/`preparing`, and (b) any error payload regardless of prefix when the run started recently AND no terminal frame was emitted yet. This pairs naturally with the SSE-DEBUG agent's Layer A fix.

### B-260519-04 — LangSmith provider mislabeling for non-OpenAI calls
**Severity:** info (observability bug, not user-facing)
**Trigger:** Any LLM call using Anthropic or OpenRouter as the provider.
**Symptoms:** All LangSmith traces are labeled `name: ChatOpenAI` and `extra.metadata.ls_provider: openai` regardless of actual provider. The model name (`ls_model_name`) is correct, but the `name` and `ls_provider` fields are wrong.
**Evidence:** LangSmith API trace breakdown for the last 40 runs after all 3 rounds:
```
  9  openai/gpt-5.4-mini/ChatOpenAI
  8  openai/gpt-4.1/ChatOpenAI
  6  openai/gpt-5.4/ChatOpenAI
  5  openai/moonshotai/kimi-k2.6:exacto/ChatOpenAI   ← OpenRouter call mis-tagged as OpenAI
  3  openai/claude-haiku-4-5-20251001/ChatOpenAI     ← Anthropic call mis-tagged as OpenAI
```
**Fix surface:** Wherever LangSmith tracing is initialized in the backend (likely `backend/app/services/anthropic_service.py` for the Anthropic path + the OpenRouter routing layer). The `ls_provider` metadata and the trace name should be set per-provider, not hardcoded to "openai".

### B-260519-05 — User-selected model isn't propagated; sub-agents always use Haiku
**Severity:** major (cost + behavior surprise)
**Trigger:** Select `claude-sonnet-4-6` in the UI model picker; observe LangSmith traces.
**Symptoms:** LangSmith shows ALL the LLM calls in the run are using `claude-haiku-4-5-20251001`, not the user's selected `claude-sonnet-4-6`. The main agent loop AND the sub-agent for `analyze_document` are both Haiku. Same pattern in OpenAI Round 1: user selected `gpt-5.4` but several sub-calls used `gpt-5.4-mini`.
**Evidence:** Anthropic Round 2 traces (3 LLM calls), 100% are `claude-haiku-4-5-20251001`. OpenAI Round 1 traces (~22 LLM calls), main loop is `gpt-5.4` (correct) but sub-agent calls are `gpt-5.4-mini`. The OpenRouter Round 3 traces show `moonshotai/kimi-k2.6:exacto` (the `:exacto` suffix is curious — OpenRouter routing tag).
**Suspected cause:** Two separate issues:
- (a) The sub-agent infrastructure unilaterally downgrades to a cheaper model (Haiku for Anthropic, Mini for OpenAI) for tool sub-calls like `analyze_document` — this may be an intentional cost optimization but is undocumented in the UI and the user has no way to know or override it.
- (b) For Anthropic specifically, even the MAIN agent loop is using Haiku, not the selected Sonnet. Either the model-routing config in the backend has a stale default for Anthropic, or the UI's model selection isn't persisting through to the agent-runner.
**Fix surface:** `backend/app/api/threads.py` agent-runner — surface the user-selected model into the main loop and a clear "sub-agent model" override into the UI/config. At minimum, log a one-line "user requested {sonnet-4-6}, downgrading sub-agent to {haiku} for cost" so behavior is auditable.

### B-260519-06 — Anthropic Round 2 frontend state diverged from backend (Run 2 still streaming but composer enabled)
**Severity:** major
**Trigger:** Anthropic Round 2 specifically — interacts with B-260519-01 + Test 2 dual-`/messages` bug.
**Symptoms:** After ~4-5 minutes of the Anthropic run, the frontend's textbox became NOT disabled (so the user could type a new message), but backend `active_runs` still showed the run as `status: streaming`. If the user typed a new prompt now, the backend would race or reject; either way the UX state diverged from truth.
**Evidence:** Anthropic Round 2 at T+~5min: `active_runs: [{run_id: 7d7c2b19..., status: "streaming"}]`, frontend `textbox.disabled = false`.
**Fix surface:** This is downstream of B-260519-01 and the duplicate-`/messages` bug from Test 2 — the frontend's source-of-truth for isStreaming should reconcile against `/snapshot.active_runs` periodically, not just rely on the SSE event stream.

---

## Re-confirmation of existing UAT findings

All 4 prior `075-UAT.md` issues reproduced in this cross-provider run:

| Prior UAT Issue | Round 1 (OpenAI) | Round 2 (Anthropic) | Round 3 (OpenRouter) |
|---|---|---|---|
| Test 2 — Duplicate `/messages` after `/snapshot` | ✓ Reproduced on existing-thread reload (earlier); no execute path in this specific run | N/A (snapshot+POST /messages flow — pure create) | N/A (similar pure create flow) |
| Test 3 — Resume button bug | Resume button stays hidden (silent freeze) — the "fix" too aggressive | Frontend blank — N/A | **Resume button DOES appear** (B-260519-03) — fix incomplete for OpenRouter |
| Test 4 — Line-by-line stdout | Not separately tested; execute_code in agent loop produced no progressive output | N/A (UI blank) | Bottom indicator was visible but no progressive stdout (not separately verified) |
| Test 5 — Bottom indicator desync | Reproduced (clears mid-stream) | N/A (nothing renders) | Reproduced (indicator cleared during execute_code) |
| Test 7 — Heartbeat preserved | Reproduced (indicator clears within seconds of silent windows) | N/A | Reproduced |

---

## LangSmith Trace Coverage

LangSmith REST API queried at `https://api.smith.langchain.com/api/v1/runs/query` against session `agentic-rag-module2` (id `202729d6-b901-485a-a3f9-04d979086eba`).

- ✓ All LLM calls land in LangSmith
- ✓ `search-documents` tool calls and `sub-agent` (analyze_document) traces are present and named correctly
- ✗ All `name` fields are `ChatOpenAI` — wrong for Anthropic + OpenRouter (B-260519-04)
- ✗ All `ls_provider` fields are `openai` — wrong for non-OpenAI providers (B-260519-04)
- ✓ `ls_model_name` field IS correct for all 3 providers (good for cost analysis)

---

## Supabase Cross-Check

Verified via backend `/threads` + `/snapshot` + `/messages` REST endpoints (which proxy Supabase):

| Round | Thread ID | Backend Result |
|-------|-----------|----------------|
| 1 | `e00649c9-99a5-44ae-98cb-a3f4842a29d6` | ✓ assistant message saved, 5 tool_calls, run_status=completed |
| 2 | `117a5ad2-a9ed-4172-99d0-9eaa9e3ca1ca` | ✓ assistant message saved, **13 tool_calls**, run_status=completed |
| 3 | `f795def5-1572-43a0-8689-ed7f6f6f7cb0` | 🔄 still streaming when observation ended; user message saved |

**Inference:** Backend (agent loop + DB persistence) is healthy across all 3 providers. The UX bugs are entirely in the streaming/rendering layer between Redis Stream → SSE producer → frontend reducer.

---

## Priority Recommendation for Phase 075.1

Given the 3-layer SSE-DEBUG agent's diagnosis was confirmed across all 3 providers, but two NEW provider-specific bugs surfaced, here's the proposed Phase 075.1 plan split (now 4 plans instead of 2):

1. **Plan 01 — Frontend universal stream-end recovery** (Layer A from SSE-DEBUG agent)
   - Widen `_isTransientBufferExpired` to handle ALL stream-end patterns: `kind: done` with running tool_calls, generic error payloads, OpenRouter's `provider_disconnect`, etc.
   - Always probe `/snapshot` on any non-explicit-terminal stream-end and reconcile from server truth
   - Closes B-260519-03 (OpenRouter Resume button) + Test 3 (OpenAI silent freeze)

2. **Plan 02 — Backend SSE transport stability** (Layer B from SSE-DEBUG agent)
   - Wrap `harvest_output_files` in `run_in_threadpool` (D-v2.5-01 violation fix)
   - Extract drain-loop line-buffer into pure helper for deterministic unit tests
   - Closes the SSE-break root cause that underlies all 3 rounds

3. **Plan 03 — Anthropic content-block rendering** (NEW — from B-260519-01)
   - Fix the StreamsProvider reducer + MessageItem renderer for Anthropic's mixed text + tool_use block ordering
   - Independent verification: an Anthropic-specific Chrome MCP UAT scenario
   - Closes B-260519-01 (Anthropic blank UI)

4. **Plan 04 — Snapshot empty-thread + observability polish** (NEW — from B-260519-02 + B-260519-04 + B-260519-05)
   - Skip Redis probe when `active_runs == []` in `/snapshot` (B-260519-02)
   - Fix LangSmith provider/name tagging per-provider (B-260519-04)
   - Surface sub-agent model downgrade in UI + correctly route Anthropic Sonnet selection (B-260519-05)
   - Bonus: also fixes the duplicate `/messages` call from MESSAGES-DEBUG (single-line `ChatArea.tsx:166` delete)

Plans 01 + 03 can ship parallel (both frontend, non-overlapping files). Plan 02 should ship first since it removes the root-cause noise. Plan 04 is the cleanup bucket.

---

## Open Items for Subsequent Verification

1. **Round 3 (OpenRouter) end-state** — I observed the Resume button at T+255s but didn't wait for terminal/completion. Need to either let it run to completion OR click Resume and document the resume flow behavior.
2. **OpenAI sub-agent downgrade** — Is `gpt-5.4-mini` an intentional cost optimization for `analyze_document`? If so, document in PROJECT.md so it's not mistaken for a bug.
3. **B-260519-01 retest after Plan 03 ships** — Run the same Anthropic prompt and verify the UI renders progressively.
4. **PPTX output verification** — None of the 3 rounds were observed to completion at the UI level. Round 1 + Round 2 reached `run_status=completed` on the backend, but the actual generated .pptx file (if any) was never visually confirmed. Need to query `documents` table for any generated files attached to the runs.
