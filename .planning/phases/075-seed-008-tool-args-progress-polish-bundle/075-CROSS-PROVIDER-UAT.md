# Phase 075 — Cross-Provider End-to-End UAT (v2, with user-provided transcripts)

**Date:** 2026-05-19 (started 2026-05-18 UTC)
**Tester:** Chrome DevTools MCP + LangSmith REST API + Supabase REST API + user-supplied transcripts
**Status:** ALL THREE ROUNDS HIT BUGS — 10 distinct issues catalogued
**Prompt:** *"search for Fahed Mrad dissertation, make a professional pptx for defence session and include comprehensive charts and visuals"*

---

## Universal Confirmed Finding (the headline)

**Code execution is stuck on "Running code…" until the user manually refreshes the page** — reproduced across all three providers (OpenAI gpt-5.4, Anthropic claude-sonnet-4-6, OpenRouter kimi-k2.6). Backend completes correctly; frontend never receives the terminal frame. **POLISH-SEED-008-02 (live line-by-line code streaming) does not work in production for any provider.** This is the same SSE-break regression all 3 debug agents pinpointed:

- **Backend:** `harvest_output_files` at `sandbox_service.py:67-149` runs synchronous blocking I/O directly on the async event loop after the cell completes (D-v2.5-01 violation), starving the SSE keepalive and tearing down the stream before the terminal frame ships.
- **Frontend:** `_isTransientBufferExpired` at `StreamsProvider.tsx:111` only matches the literal `buffer_expired*` prefix, so plain `reader.done` stream-ends bypass the snapshot-probe recovery entirely.
- **Tests:** `test_075_code_stdout_progressive.py:54-57` skipif gates all 4 binding tests on `SANDBOX_ENABLED=1`. Under `asyncio_mode=auto` the tests collect but skip silently when Docker isn't bound. The "11/11 GREEN" claim from Plan 02 exercised the OLD Phase 062 non-sandbox path. New path has zero CI coverage.

---

## Summary Table

| Round | Provider | Model (UI) | Model (LangSmith) | Backend Result | Live UX | PPTX produced? |
|-------|----------|-----------|-------------------|----------------|---------|----------------|
| 1 | OpenAI | `gpt-5.4` | `gpt-5.4` + `gpt-5.4-mini` (sub-agent) | ✓ completed (5 tools, 414s) | ✗ stuck on "Running code", no Resume | ✗ failed — model didn't try `pip install` after ModuleNotFoundError |
| 2 | Anthropic | `claude-sonnet-4-6` | `claude-haiku-4-5-20251001` (sub-agent) | ✓ completed (13 tools, ~5min) | ✗ blank during run; **populates after F5** | ✓ 16-slide deck (634 KB) + 8 chart PNGs |
| 3 | OpenRouter | `moonshotai/kimi-k2.6` | `moonshotai/kimi-k2.6:exacto` | ✗ erred with Resume button (path issue at step 7) | ✗ Resume button mid-stream | ✗ failed — model wrote to wrong path; harvest missed the file |

**Note on Round 2 success:** Anthropic actually produced the most complete, well-designed presentation of the three (16 slides, 8 charts, professional layout). The agent installed `python-pptx`, generated all charts, built slides part 1, built slides part 2, ran a QA check on shape counts. The Phase 075 streaming-layer regression hides this success from the user during the run — they only see it after F5 reload.

---

## Bug Inventory (10 distinct issues)

### B-260519-01 — Anthropic: streaming doesn't render in real-time (reframed)
**Severity:** blocker
**Trigger:** Submit any prompt with `Anthropic` as the active provider.
**Symptoms:** During the entire run lifecycle (text streaming, tool calls, code execution), the frontend main panel renders **nothing** — no user message, no step indicators, no streaming text. Backend agent loop completes successfully and saves messages + tool_calls to DB. After F5 reload, the full conversation is visible (and looks great in the Anthropic case — full 16-slide deck was generated). So this is a streaming bug, not a rendering bug per se: the SSE consumer can't process Anthropic's event order/format, but the post-completion snapshot fetch works fine.
**Suspected cause:** Anthropic's mixed text + tool_use content-block ordering breaks the StreamsProvider reducer mid-stream (the BUG-260514-02 root cause that D-075-15 deferred). Plan 03's new `tool_args_progress` emit on `anthropic_service.py:204-236` may also produce events in an order the frontend doesn't expect.
**Fix surface:** `frontend/src/providers/StreamsProvider.tsx` SSE reducer + `frontend/src/components/chat/MessageItem.tsx` content-block rendering. Needs Anthropic-specific content-block handling.

### B-260519-02 — Snapshot endpoint returns 503 on brand-new empty threads
**Severity:** major
**Trigger:** Create a brand-new thread (POST /threads), then immediately GET /threads/{tid}/snapshot before any message is sent (which the frontend does on mount).
**Symptoms:** Endpoint returns `503 {"detail":"Streaming infrastructure unavailable"}` with `Retry-After: 10`. Race-flaky — Round 1 hit it, Rounds 2 + 3 didn't.
**Suspected cause:** D-075-04's Redis probe runs unconditionally even when `active_runs` is empty. For a brand-new empty thread there's nothing to probe; the endpoint should short-circuit `since_cursors: {}` without touching Redis.
**Fix surface:** `backend/app/api/threads.py:510-552` — skip the Redis probe when `active_runs == []`. The probe should only fire per active run id.

### B-260519-03 — Plan 01 BUG-260518-01 fix incomplete for OpenRouter stream-end
**Severity:** major
**Trigger:** Any `execute_code` step with OpenRouter (kimi-k2.6 observed; likely all OpenRouter models).
**Symptoms:** During the execute_code step, the SSE stream's stream-end pattern surfaces the "Resume run" button **while backend is still alive**. Plan 01's `_isTransientBufferExpired` filter doesn't match OpenRouter's stream-end format.
**Fix surface:** `frontend/src/providers/StreamsProvider.tsx:104-117` — widen the transient filter to probe `/snapshot` on (a) `kind === "done"` when any tool_call.status is `running`/`preparing`, AND (b) any error payload when the run started recently AND no terminal frame was emitted yet. Pairs naturally with SSE-DEBUG agent's Layer A fix.

### B-260519-04 — LangSmith Anthropic main-loop is UNTRACED + provider mislabel for traced calls (REFRAMED after code review)
**Severity:** major (was: info — escalated after finding the Anthropic gap)
**Trigger:** Any LLM call using Anthropic as the provider; secondary mislabel issue affects any non-OpenAI provider.
**Root cause from code (verified):**
- LangSmith tracing is wired via `wrap_openai(client)` at `backend/app/services/openai_service.py:539-540` — it ONLY wraps the OpenAI client.
- Anthropic main-loop uses raw `anthropic.Anthropic` SDK at `backend/app/services/anthropic_service.py:128` (`stream_anthropic`). It is **NOT WRAPPED**. Confirmed by inline comment at `backend/app/api/threads.py:1567-1573`: "anthropic_service.py uses raw anthropic.Anthropic — the GeneratorExit-trace pollution is OpenAI-only".
- → **Result: Anthropic main-loop calls do NOT appear in LangSmith at all.** Total observability gap.
- The Haiku traces I saw for Anthropic Round 2 are the SUB-AGENT only (which uses the OpenAI client even for Anthropic, against an OpenAI-compatible endpoint — see `sub_agent_service.py:40` + `openai_service.get_llm_client`). Those traces ARE wrapped, hence labeled `ChatOpenAI`.
- For OpenRouter (OpenAI-compatible API), wrap_openai catches everything, but the trace name and `ls_provider` are hardcoded to "openai".
**Fix surface:**
- (a) Add LangSmith wrapping to the Anthropic path. Options: use `langsmith.wrappers.wrap_anthropic` (if available in the installed langsmith version), OR wrap the streaming calls with `@traceable(name="ChatAnthropic", run_type="llm")`. Closes the Anthropic blind-spot.
- (b) Set `ls_provider` and trace `name` per actual provider (don't rely on the wrap_openai default labels).
- Both fixes are small, independent, and high-value for debugging future provider-specific issues.

### B-260519-05 — Sub-agent silently downgrades to cheaper model; no UI surface (REFRAMED — by design, but invisible)
**Severity:** major (was: major — same severity, refined cause)
**Trigger:** Any agentic loop that invokes a sub-agent tool (currently only `analyze_document`).
**Root cause from code (verified):**
- `backend/app/config.py:255-261` defines `_SUB_AGENT_MODEL_DEFAULTS`:
  ```python
  {"anthropic": "claude-haiku-4-5-20251001",
   "openai":    "gpt-5.4-mini",
   "google":    "gemini-2.5-flash",
   "openrouter": "",   # falls back to user's selected model
   "ollama":    ""}
  ```
- `backend/app/services/sub_agent_service.py:46-61` applies this default when no explicit override (`user_settings.sub_agent_model` or `settings.sub_agent_model`) exists.
- Inline comment at `sub_agent_service.py:43-46` justifies the design: *"Sub-agents always use their dedicated model — the main agent handles generation. Escalating to the orchestrator model caused sub-agents to use the expensive main model (e.g. gpt-4.1) even for pure document analysis tasks, burning TPM quota."*
- **The MAIN loop IS using the user-selected model correctly** — verified at `threads.py:1545`: `_model_id = body.model or user_settings.llm_model` is passed to `stream_anthropic(model=_model_id, ...)`. So Anthropic Round 2's main loop DID use Sonnet-4-6 (it's just invisible per B-260519-04).
- **The sub-agent downgrade is intentional cost optimization** but: (1) the user has no way to know it's happening, (2) `_SUB_AGENT_MODEL_DEFAULTS` is a flat per-provider mapping with no per-task routing.

**Best practice for sub-agent model assignment** (from research):
- ✓ **Per-task routing** — cheap models (Haiku, mini, flash) for extraction/summarization; capable models for reasoning, coding, planning. The current single-tier-per-provider mapping handles `analyze_document` well (extraction is Haiku-appropriate) but won't scale gracefully as more sub-agent tools are added.
- ✓ **Transparency in UI** — surface the sub-agent model in the tool card metadata. Right now the user sees "Analyzing document — Fahed Mrad Chapters 1 to 4.docx — 79.9s" with no indication that Haiku was used instead of their selected Sonnet.
- ✓ **User-overridable** — `user_settings.sub_agent_model` already exists as an override knob, but isn't exposed in the Settings UI.
- ✓ **Logged + auditable** — log an info line per sub-agent invocation: `sub-agent invoked tool=analyze_document main_model=claude-sonnet-4-6 sub_model=claude-haiku-4-5-20251001 reason=cost_default`. Currently silent.

**Fix surface:** Three layers, can ship in Plan 04:
- Backend: add an info log per sub-agent invocation with both models + reason.
- Frontend: include the sub-agent model in the tool-card hover/expand view (read from existing tool_call metadata; backend needs to add a `sub_agent_model` field to the tool_call result payload).
- Settings UI: expose `sub_agent_model` override with helpful defaults + a "Use main model" escape hatch.
- (Future scope, not Plan 04): per-tool routing config (`sub_agent_models: { analyze_document: "haiku", reasoning_task: "sonnet" }`) — defer to a Skill Studio or Settings polish phase.

### B-260519-06 — Frontend isStreaming state diverges from backend active_runs over long runs
**Severity:** major
**Trigger:** Long-running prompts (>~3 min). Observed on Anthropic Round 2.
**Symptoms:** After ~4-5 minutes, the frontend's textbox became NOT disabled (user could type a new message), but backend `active_runs` still showed `status: streaming`. If the user typed a new prompt now, race condition or rejection.
**Fix surface:** Frontend isStreaming should reconcile against `/snapshot.active_runs` periodically, not rely solely on the SSE event stream. Downstream of B-260519-01 + the duplicate-`/messages` bug from Test 2.

### B-260519-07 — Successful stdout shown in red (stderr styling)
**Severity:** minor (cosmetic but misleading)
**Trigger:** Any successful code-execution output (per user observation on Anthropic Round 2 + others).
**Symptoms:** User reports "some of outputs of code execution are appearing in red." Tracebacks are correctly red (stderr). But Anthropic Round 2's success outputs — `Chart 1 saved`, `Slide 1 ✓ … Slide 7 ✓ Part 1 saved`, `Total slides: 16 Slide 01: 13 shapes…` — should be neutral/green, not red.
**Suspected cause:** Either (a) Plan 02's new line-buffer accumulator may be writing successful stdout into the stderr branch, OR (b) the frontend `code_stdout` event renderer is applying the stderr-red class regardless of channel.
**Fix surface:** Two-step audit: grep `backend/app/api/threads.py` sandbox branch for stdout/stderr stream-tagging in the new exec_run callback; grep `frontend/src/components/chat/` for `code_stdout` / `code_stderr` event styling.

### B-260519-08 — OpenAI gpt-5.4 gives up after ModuleNotFoundError without trying `pip install`
**Severity:** major (capability regression)
**Trigger:** Any prompt where the cell needs a missing package (Round 1 hit `python-pptx`).
**Symptoms:** Anthropic + OpenRouter both retried after `ModuleNotFoundError` by running `pip install python-pptx matplotlib …` and recovered cleanly. OpenAI gpt-5.4 ran the same code twice (both `ModuleNotFoundError`), wrote a user-facing apology, and stopped. The user got a text explanation and no .pptx file.
**Fix surface:** System prompt (in the agent-runner) needs an explicit "if you hit ImportError, try `pip install <pkg>` first" hint. Model-side capability gap, but the system prompt should compensate. Bonus: pre-install common packages (`python-pptx`, `matplotlib`, `numpy`, `pandas`) in the sandbox Docker image so this doesn't happen at all.

### B-260519-09 — OpenRouter sandbox path inconsistency + error UX
**Severity:** major
**Trigger:** OpenRouter Round 3 multi-step code execution.
**Symptoms:** Step 6 reported `Slides 1-4 created.` but the `.pptx` file wasn't in the output-files panel (only the chart PNGs harvested). Step 7 tried `Presentation('/sandbox/output/Fahed_Mrad_Defense.pptx')` → `PackageNotFoundError: Package not found`. The model wrote the .pptx to a path that `harvest_output_files` doesn't sweep (likely `/tmp/` or `cwd`).
**Suspected cause:** Two parts:
- (a) Model-side: kimi-k2.6 isn't following the convention of writing to `/sandbox/output/`. Anthropic's transcript shows it correctly used `/sandbox/output/Fahed_Mrad_DBA_Defence_Presentation.pptx`.
- (b) Phase 075 part: when Step 7 errored, the error-handling surfaced a Resume button (B-260519-03) instead of letting the agent loop recover — that's the streaming-layer bug.
**Fix surface:** (a) System prompt should explicitly tell models "always write outputs to `/sandbox/output/`". (b) The Resume button surfacing is covered by B-260519-03's fix.

### B-260519-10 — OpenRouter re-rendered Steps 1 + 2 mid-flight (UI duplication)
**Severity:** minor (confusing UX)
**Trigger:** OpenRouter Round 3 after Step 3 errored.
**Symptoms:** After the matplotlib `ModuleNotFoundError`, the transcript shows Steps 1 (search-documents, 0ms) and 2 (analyze_document, 183ms) re-rendering with very fast durations. Either the tool-card renderer is duplicating cards or the model re-issued the same calls and got cache hits.
**Fix surface:** Audit `frontend/src/components/chat/ToolCallPanel.tsx` (or wherever step cards render) for de-duplication keyed on `tool_call_id`. If the model genuinely re-called, that's a model-side waste; if the frontend duplicated the same `tool_call_id` into a second card, that's a reducer bug.

---

## Updated UAT findings (carry-forward from 075-UAT.md)

| Original UAT issue | Round 1 (OpenAI) | Round 2 (Anthropic) | Round 3 (OpenRouter) |
|---|---|---|---|
| Test 2 — Duplicate `/messages` after `/snapshot` | Reproduced earlier on existing-thread reload | N/A (new-thread flow) | N/A |
| Test 3 — Resume button bug | Stays hidden (silent freeze) — "fix" too aggressive | N/A (UI blank during run) | **Resume button DOES appear** (B-260519-03) |
| Test 4 — Line-by-line stdout (SC #2) | **Confirmed broken** — no progressive output | **Confirmed broken** — no live rendering at all | **Confirmed broken** — Resume blocks observation |
| Test 5 — Bottom indicator desync | Reproduced (clears mid-stream) | N/A | Reproduced |
| Test 7 — Heartbeat preserved | Reproduced (indicator clears during silent windows) | N/A | Reproduced |

---

## LangSmith + Supabase Cross-Check Evidence

**LangSmith** (session `agentic-rag-module2`, id `202729d6-b901-485a-a3f9-04d979086eba`):
- ✓ Every LLM call lands in LangSmith
- ✓ Tool calls (`search-documents`, `sub-agent` for analyze_document) traced correctly
- ✓ `ls_model_name` is accurate per call
- ✗ `name` field is always `ChatOpenAI`, `ls_provider` always `openai` regardless of actual provider (B-260519-04)
- ✗ For Anthropic Round 2: NO Sonnet traces, only Haiku (B-260519-05)

**Supabase via backend REST** (`/threads`, `/snapshot`, `/messages`):
- ✓ All 3 runs' assistant messages and tool_calls successfully persisted to DB
- ✓ Backend agent loop is healthy across all 3 providers
- ✓ The UX bugs are entirely in the **streaming/rendering layer**, not in the agent or persistence layer

---

## Phase 075.1 Plan Proposal (4 plans, ranked by impact)

### Plan 01 — Universal stream-end recovery (HIGH PRIORITY)
**Scope:** Frontend only. Closes B-260519-03, Test 3 silent freeze, "stuck on Running code until refresh" universal symptom.
- Widen `_isTransientBufferExpired` (rename to `_isTransientStreamEnd`) at `StreamsProvider.tsx:104-117` to ALSO probe `/snapshot` on:
  - `kind === "done"` when any tool_call.status is still `running`/`preparing`
  - Generic error payloads when run started recently AND no terminal frame received
  - Plain `reader.done` from `api.ts:477` defensive close
- Always reconcile against `/snapshot.active_runs` after any non-explicit terminal — if backend says still streaming, re-attach SSE from `snapshot.since_cursors[run_id]`
- Add a Chrome MCP UAT test: 45-second `time.sleep` cell completes and UI shows result without manual reload

### Plan 02 — Backend SSE transport stability (HIGH PRIORITY)
**Scope:** Backend only. Closes the root cause SSE-break that underlies everything.
- Wrap `harvest_output_files` at `sandbox_service.py:67-149` in `run_in_threadpool` (D-v2.5-01 violation fix)
- Extract drain-loop line-buffer into a pure `drain_step` helper with deterministic unit tests (no Docker required)
- Add a narrow safety-net post-completion stdout emit gated on `_emitted_stdout_line_count == 0` (so if line-by-line truly produced nothing, the final `exec_result.stdout` still ships — prevents zero-output regressions in case of further bugs)
- Fix `test_075_code_stdout_progressive.py:54-57` skipif to use per-function decorators that actually fire under `asyncio_mode=auto`, OR adopt the `PG_AVAILABLE + seeded_thread` pattern from `test_075_tool_args_progress.py`

### Plan 03 — Anthropic content-block rendering + sticky indicator (MEDIUM PRIORITY)
**Scope:** Frontend only. Closes B-260519-01 (Anthropic blank during run), Test 5 (bottom-indicator clear).
- Fix the StreamsProvider reducer for Anthropic's mixed text + tool_use block ordering (BUG-260514-02 root cause that D-075-15 deferred)
- Fix MessageItem.tsx sticky-cache reset trigger: change from provider-level `isStreaming` to per-message `runStatus` terminal state (per INDICATOR-DEBUG agent's diagnosis)
- Add an Anthropic-specific Chrome MCP UAT scenario as regression guard

### Plan 04 — Observability + sub-agent transparency + polish (MEDIUM PRIORITY after the routing audit)
**Scope:** Backend + frontend, small surface, high information density. Closes the remaining 7 bugs.
- Delete stale `loadMessages(thread.id)` at `ChatArea.tsx:166` — closes Test 2 dual-`/messages` (per MESSAGES-DEBUG agent's single-line fix)
- Snapshot endpoint: skip Redis probe when `active_runs == []` — closes B-260519-02
- **LangSmith Anthropic wrap** — add `@traceable(name="ChatAnthropic", run_type="llm")` (or `wrap_anthropic` if available in the installed langsmith) to `anthropic_service.stream_anthropic`. **High-priority sub-bug** of B-260519-04 because it makes Anthropic runs un-debuggable today.
- LangSmith provider/name tagging — set `ls_provider` and trace `name` per actual provider; remove the hardcoded `ChatOpenAI` label for non-OpenAI calls — closes B-260519-04
- **Sub-agent transparency** — backend: log `sub-agent invoked tool=X main_model=Y sub_model=Z reason=cost_default` per invocation. Frontend: surface `sub_agent_model` in the tool-card metadata (read from new field on tool_call payload). Settings UI: expose the `sub_agent_model` override knob (already exists at `user_settings.sub_agent_model`, just not in UI). Closes B-260519-05 with current design intact.
- System prompt: add "if you hit ImportError, try `pip install <pkg>` first" — closes B-260519-08
- System prompt: add "always write outputs to `/sandbox/output/`" — partially closes B-260519-09 (a)
- Audit `code_stdout` vs `code_stderr` styling in `frontend/src/components/chat/` — closes B-260519-07
- Pre-install `python-pptx`, `matplotlib`, `numpy`, `pandas` in the sandbox Docker image — eliminates B-260519-08 root cause + speeds up Rounds 2+3 by ~15s each
- ToolCallPanel de-duplication keyed on `tool_call_id` — closes B-260519-10

### Deferred from Plan 04 (out of scope for 075.1)
- Per-tool sub-agent model routing (e.g., `analyze_document → Haiku`, `code_planning → Sonnet`). Today's flat per-provider default is fine for the single sub-agent tool we have. Revisit in Skill Studio or Settings polish milestone.

### Execution order
- **Plan 02 first** (backend root cause) — once `harvest_output_files` is in threadpool, the SSE stream stays alive long enough for the terminal frame to arrive; many downstream symptoms vanish.
- **Plan 01 + Plan 03 parallel** (both frontend, non-overlapping files: Plan 01 owns transient filter + reconcile; Plan 03 owns reducer + MessageItem sticky)
- **Plan 04 last** (polish bundle, can ship as a single small PR)

---

## Open Verification Items

1. After Plan 02 + Plan 01 ship, retest the 45-second sleep cell — UI should auto-recover.
2. After Plan 03 ships, retest the Anthropic dissertation prompt — UI should render live, not blank-until-refresh.
3. After Plan 04 ships, confirm `claude-sonnet-4-6` selection in UI actually routes to Sonnet (LangSmith should show Sonnet traces, not Haiku).
4. Round 1's pptx output file was never harvested (OpenAI failed before generation); Round 3's pptx was created but not at `/sandbox/output/`. Only Round 2's `Fahed_Mrad_DBA_Defence_Presentation.pptx` (634 KB) is downloadable. The user has not been able to actually download/open any of the 3 attempts.
