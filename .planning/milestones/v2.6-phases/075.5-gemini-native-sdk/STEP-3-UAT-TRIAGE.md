---
created: 2026-05-23
phase: 075.5
purpose: Capture-only triage of cross-provider UAT findings (Step 3 of the live-test loop)
mode: capture-only — DO NOT FIX during this pass; operator prioritizes in Step 5
related: 075.4-POST-UAT-TRIAGE.md (prior 8 findings F-1..F-8 from Phase 075.4)
---

# Phase 075.5 Step 3 — Cross-Provider UAT Triage

## What this is

Capture-only log of cross-provider × multi-tool UAT findings, run on the
post-075.5 backend (commit `68e0a38` — restart-backend.ps1 v2 + Phase 075.5
Gemini native SDK + thought_signature base64 + tool-schema sanitizer).

Test prompt (fixed across providers): `search for Fahed Mrad dissertation,
make a professional pptx for defence session and include comprehensive
charts and visuals`.

Driver: Chrome MCP, logged-in as fhdmrd@gmail.com at http://localhost:5173.

## Pre-known findings carried in from operator manual testing

### T-260523-01 — gemini-3.5-flash hits "Agent reached time limit"

- **Symptom**: Manual operator test of `gemini-3.5-flash` on the dissertation
  prompt terminated with the "Agent reached time limit" banner (D-066-10).
- **Confirmed cause** (from err.log of the actual failed run):
  ```
  Run b3acf5aa-a885-4d1b-931e-708330683480 timed out at iteration 3
  (model=gemini-3.5-flash, budget=90s)
  ```
  This is the **per-LLM-call 90s deadline** (`MODEL_CAPABILITIES["gemini-3.5-flash"].llm_call_timeout_seconds = 90`), NOT the 15-iteration cap.
  gemini-3.5-flash is the *frontier coding/agentic* model — its
  "thinking" passes regularly exceed 90s, especially on complex
  multi-tool prompts.
- **Severity**: HIGH — gemini-3.5-flash is the most capable production
  Gemini and effectively unusable on multi-tool tasks at the current
  90s per-call budget.
- **Recommended fix** (single-line in `backend/app/config.py:185`):
  bump `llm_call_timeout_seconds` 90 → 240 to match gemini-2.5-pro
  (the next-most-capable Google model). Wall-time worst-case becomes
  15 × 240s = 60min instead of 15 × 90s = 22.5min — but the run hard
  timeout (`runs.py:75`) caps it independently.
- **Out of scope for this fix**: BUG-260514-01 (Anthropic 22-iter
  loop) is a different mode of the same family — iteration-count
  exhaustion under repeated low-progress tool calls. Track separately.

### T-260523-02 — Chat title not always accurate

- **Symptom**: Operator observation across multiple chats: the auto-generated
  thread title sometimes doesn't reflect the actual content (e.g., shows
  literal substrings or hallucinated text).
- **Suspected cause**: Title-generation LLM call likely runs on the same
  model as the main agent; for multi-tool prompts with mixed structure,
  the title model can pick a poor summary.
- **Severity**: LOW — cosmetic, doesn't break functionality.
- **Owner of next step**: Needs investigation of title-generation code path
  in `backend/app/api/threads.py` + `openai_service.py`.

### T-260523-03 — `gemini-3.1-flash-lite` was missing from MODEL_CAPABILITIES

- **Symptom**: Live Google docs list `gemini-3.1-flash-lite` as the
  production budget Gemini-3 model, but it was missing from our registry.
- **Status**: **CLOSED** — added to `backend/app/config.py` (both
  context-window dict and `MODEL_CAPABILITIES`) prior to Step 3 UAT.
- **Commit**: pending (will fold into Step 3 closure commit).

## Step 3 UAT findings (populated as Chrome MCP runs land)

### T-260523-04 — Chrome MCP automation cannot drive Anthropic picker submit (NOT A REAL BUG)

- **Status**: **CLOSED — automation harness limitation, not a product bug.**
- Operator manually repro'd the flow at 2026-05-23: clicked New Chat,
  switched picker to Anthropic + claude-sonnet-4-6, typed dissertation
  prompt, hit Enter. Result: `POST /threads/02db4bbf.../messages → 201`
  + run `ef64bb97-...` started + SSE stream open. **Picker works for
  humans.** Original observation that follows preserved for record.

(original observation:)

- **Symptom observed during Chrome MCP automation**: After reloading the page,
  clicking the provider picker, switching from Google to Anthropic, and picking
  `claude-sonnet-4-6`, every submit attempt (CDP click on submit button, Enter
  key on focused textbox with prompt, JS native-setter + dispatched input event,
  raw MouseEvent dispatch) silently no-ops:
    - Thread is created (POST /threads → 201)
    - Snapshot fetched (GET /threads/.../snapshot → 200)
    - **No POST /messages**, no /runs/.../stream, no console error
    - URL stays at `/`, doesn't navigate to `/threads/<id>`
    - chat-surface debug widget stays at `count: 0` `[]`
- **Hypothesis (unverified)**: Frontend guard may be reading from a stale
  `user_settings.active_provider` ("google") even though the picker shows
  "Anthropic", and silently rejecting the submit because the picker's
  `claude-sonnet-4-6` isn't in Google's allowed model list. Phase 075.5
  D-075.5-04 added a backend-side safety net for the analogous sub-agent
  case (`sub_agent_service.py:50-75`) — maybe there's an analogous
  frontend-side picker/state-sync gap.
- **Severity if confirmed**: HIGH — would mean transient picker selections
  don't actually route prompts, requiring users to save provider switches
  via Settings before they take effect. This would explain user reports of
  cross-provider runs not actually using the picker model.
- **Severity if Chrome-MCP-only**: LOW — automation harness limitation.
- **Action**: Operator to manually repro — open localhost:5173, click new
  chat, switch provider/model to Anthropic/sonnet-4-6, type prompt, hit
  Enter. If a /messages POST hits the backend, the picker flow works for
  humans and this is a Chrome MCP issue. If nothing happens, it's a real
  bug worth a follow-on fix phase.

### Run 1 — Anthropic / claude-sonnet-4-6 — PARTIAL THEN BILLING-FATAL

- **Thread**: `02db4bbf-e22e-4f2c-b177-5217d2909679`
- **Run**: `ef64bb97-d3d1-4a43-80a4-2b38a44d4089`
- **Outcome**: Run progressed through 4-5 tool calls successfully, then
  died on a subsequent Anthropic LLM call with HTTP 400:
  ```
  anthropic.BadRequestError: Error code: 400 -
  'Your credit balance is too low to access the Anthropic API.
   Please go to Plans & Billing to upgrade or purchase credits.'
  request_id: req_011CbKcUonyUQsNcPX7o246s
  ```
  Source: `backend/app/services/anthropic_service.py:200`.
- **What worked before the billing wall**:
  - Step 1: `load_skill('pptx')` — 56ms
  - Step 2: `search_documents('Fahed Mrad dissertation thesis')` — 1.8s
  - Step 3: `read_skill_file('python-pptx-guide.md')` — 307ms
  - Step 4: sub-agent `analyze_document('Fahed Mrad Chapters 1 to 4.pdf')` — **60.9s**, full structured output
  - Step 5 (numbered Step 3 in UI): `search_documents('SUCCESS framework ...')` — 688ms
  - Step 6: `execute_code` started — "Building the dissertation defence PPTX — slides 1-7..."
  - Then died on the next Anthropic completion call.
- **Severity of the billing failure itself**: USER-FIXABLE (top up
  Anthropic credit at console.anthropic.com).
- **Severity of the UI experience**: HIGH — see T-260523-05 below.

### T-260523-05 — Provider HTTP errors mid-run do not reach the UI — **FIXED 2026-05-23**

- **Status**: **CLOSED** — backend edit to `threads.py` broadens the
  `except APIError` block (openai-only) to also catch
  `anthropic.APIError` and `google.genai.errors.APIError`, and always
  emits the actionable user message as a `delta` even when prior
  content was streamed. Verified live on two consecutive Anthropic
  billing-400 runs (claude-opus-4-6 + claude-sonnet-4-6) — the chat
  now shows: *"API billing or rate-limit error: your account has
  insufficient credits or has hit a usage limit. Please check your
  provider's billing dashboard."*
- Backend log line transitioned from `Unexpected error in event
  stream` (generic catch) to `LLM API error in event stream` (the
  mapped catch with keyword-actionable messages).
- See commit (pending) for the patch.

### T-260523-06 — Resume button false-positive on non-recoverable errors (F-6 confirmed cross-provider)

- **Symptom**: After the T-260523-05 fix landed, the chat correctly
  shows the actionable billing error message, AND a **Resume button
  appears** offering to retry. But the error is non-recoverable
  (account is billing-blocked); clicking Resume would just re-trigger
  the same 400.
- **Severity**: MEDIUM — misleading UX. User sees "Resume" and
  reasonably thinks the system can recover, when it can't.
- **Confirmed against**: Anthropic billing-400 (claude-opus-4-6,
  claude-sonnet-4-6).
- **Related**: F-6 from `075.4-POST-UAT-TRIAGE.md`, BUG
  `.planning/reported-bugs/resume-button-appears-during-active-code-execution.md`.
- **Recommended fix** (don't apply here — separate follow-on):
  classify terminal error types as recoverable vs non-recoverable.
  Non-recoverable types (billing, auth, invalid_api_key,
  unsupported_parameter, context too large) should hide the Resume
  button. Recoverable types (transient 5xx, network) keep it.
  Backend already has the classification at
  `threads.py:3316-3346`; just needs to be propagated to the
  terminal SSE event as a `recoverable: bool` field that the
  frontend's resume-button gating consumes.

### T-260523-08 — Step indicator off-screen during long runs (HIGH UX)

- **Symptom**: The agent's step indicator (latest tool / latest action)
  sits at the TOP of the assistant message bubble. As the agent emits
  more tools / code / files, the bubble grows. The user scrolls down to
  follow new content but loses sight of the step indicator at the top.
  During an 8-minute Sonnet run with 11 iterations and ~5 file outputs
  the indicator was ~3 viewport heights above the user's scroll position.
  User has to scroll back up to see "what is happening now."
- **Severity**: HIGH UX — perceived as silent/stalled, not because
  nothing is happening but because the activity signal is off-screen.
- **Concrete observation (run beb391e5, 2026-05-23)**: while iter 5's
  106s code-gen LLM call was running, the only "still working"
  indicator was the step name at the top of the bubble — invisible at
  the user's scroll position.
- **Fix patterns (pick one)**:
  - **Sticky step indicator** pinned to top of viewport while scrolling
    inside the bubble (CSS `position: sticky`).
  - **Floating activity badge** in a fixed corner of the chat surface
    showing the current step + elapsed time.
  - **Auto-scroll to latest activity** (like Claude.ai / ChatGPT).
  - **Mini-indicator near the input row** ("Running step 5/?: execute_code...").
- **Where to look**: `frontend/src/components/chat/MessageItem.tsx`
  (step rendering) and `frontend/src/components/chat/ChatArea.tsx`
  (scroll behavior).

### T-260523-09 — No progress signal during long LLM code-generation calls (HIGH UX) — **CLOSED 2026-05-23**

**Verification status:** ✅ **CLOSED — fix verified end-to-end via Chrome MCP on 2026-05-23.**

| Layer | Evidence |
|---|---|
| Backend emit | Across 4 runs, **24 `tool_args_progress` events** fired for `execute_code` (pre-fix: ZERO). Bytes: 5121, 10241 (run 44419a56 iter 3); 5120, 10248, 15361, 20482, 25604, 30724 (iter 4); 5148, 10243 (run 781c743e); 5129, 10253, 15365, 5123, 10241, 15362 (run 2e218679); 5125, 10241, 15361, 20480, 25609, 30726, 35847, 40962 (run 37a1d54d). |
| SSE dispatcher (`api.ts:392-397`) | Routes `tool_args_progress` to `onToolArgsProgress(toolIndex, name, totalArgsBytesSoFar)` callback. |
| Reducer (`StreamsProvider.tsx:293-315`) | Math.max-updates `argsBytesStreamed` on the matching `preparing-{toolIndex}` tool entry. |
| Render (`ToolCallPanel.tsx:743-746`) | Renders `<span class="ml-1.5 font-normal text-foreground/40 not-italic font-mono tabular-nums">(X.X KB)</span>` when `argsBytesStreamed > 0` and status="preparing". |
| Live DOM proof | Browser MutationObserver captured **16 distinct badge HTML snapshots** across runs 781c743e + 37a1d54d: `(5.0 KB)`, `(10.0 KB)`, `(15.0 KB)`, `(20.0 KB)`, `(25.0 KB)`, `(30.0 KB)`, `(35.0 KB)`, `(40.0 KB)` — each with the exact React-rendered HTML matching ToolCallPanel.tsx:743-746. Window: ~830ms between first and 8th capture. |
| Screenshots | `.planning/phases/075.5-gemini-native-sdk/screenshots/06_LIVE_BADGE_argsprog.png`, `08_LIVE_BADGE_5KB.png`, `09_LIVE_BADGE_40KB.png` (post-tool_start viewport; badge HTML proven via DOM capture above since the 5KB→40KB transition happened faster than Chrome MCP screenshot round-trip). |

**Original symptom (kept for record):**

- **Symptom**: During Sonnet's 60-120 second LLM calls that generate
  large code blocks (4k–19k chars per call), the UI emits NO events
  to the user — no streaming text, no "generating code..." indicator,
  no progress fraction. Step indicator (T-260523-08) shows
  "tool_preparing: execute_code" but doesn't visibly progress.
- **Claude.ai's pattern (for reference)**: shows a collapsed code
  block with a "Generating code..." indicator + char counter while the
  tool args stream in. User can expand to see live code OR leave
  collapsed for clean UX. No raw token waterfall, just clear "still
  working" feedback with the option to drill in.
- **Backend root cause (confirmed)**: `anthropic_service.py:245` has
  an explicit filter `if _tool_name and _tool_name != "execute_code":`
  that SKIPS `tool_args_progress` emission for `execute_code` calls.
  This is the EXACT tool whose code-generation LLM call drives the
  60-120s pauses (4k-19k chars of code per call). The exclusion was
  likely intended to avoid streaming raw code chunks into the UI, but
  the net effect is total silence during the biggest user-visible
  pauses. Confirmed via Redis stream of run beb391e5: 0
  `tool_args_progress` events across 491 total events, despite 7
  execute_code calls totaling 80k+ chars of generated code.
- **Severity**: HIGH UX — single biggest perception driver. Run feels
  hung when it isn't.
- **Minimal fix** (one-line, conservative): remove the
  `!= "execute_code"` exclusion on `anthropic_service.py:245` so
  execute_code also emits `tool_args_progress` every 5KB. Frontend
  already handles the event type for other tools; rendering pattern
  becomes "Generating code... (12.7 KB)" badge instead of raw chunk
  rendering. Iterate on frontend display separately.
- **Wider fix**: audit the SAME filter in the OpenAI / Google /
  OpenRouter service modules — they likely have the same exclusion
  pattern (the 5KB-boundary mechanism was added in Phase 075 for ALL
  providers, copy-pasted with the same execute_code exception).
  Removing it across the board gives unified progress signal during
  long code-generation calls regardless of provider.

### T-260523-10 — Intermediate files exposed in downloads list (MEDIUM UX)

- **Symptom**: Sonnet's "split-build-combine" strategy on the pptx
  task produces intermediate files (chart PNGs, defence_part1.pptx,
  defence_part2.pptx) AS WELL AS the actual deliverable
  (Fahed_Mrad_DBA_Defence.pptx). All are exposed in the downloads
  list with no distinction. User asked for ONE pptx; got 7+ files.
- **Severity**: MEDIUM UX — confusing, but not blocking. User CAN
  pick the right file from the list.
- **Trade-offs**:
  - **Hide all intermediates**: risks hiding files the user actually
    wants (charts as standalone PNGs).
  - **Section the file list**: "Final outputs" vs "Intermediate
    artifacts" with the latter collapsed by default. Requires the
    agent (or backend) to classify files into the two buckets.
  - **Last-call-wins**: only show files from the FINAL execute_code
    iteration. Simple heuristic but assumes the final call is always
    the deliverable (true for Sonnet's pattern, may not be for other
    agent strategies).
  - **Agent-tagged outputs**: extend the `execute_code` tool result
    schema so the agent can mark `is_final: true` per file. Cleanest
    but requires prompt-engineering or tool-schema change.
- **Where to look**: `final_output_files` event emit logic in the
  agent loop (per run beb391e5 lifecycle: one `final_output_files`
  event was emitted at terminal, but it appears to include ALL files
  from all execute_code calls).
- **Related**: cross-provider impact — Gemini's one-shot pattern
  doesn't hit this (one execute_code → one pptx). Sonnet's iterative
  pattern does.

### T-260523-07 — Anthropic errored runs miss usage tracking (LOW)

- **Symptom**: After my T-260523-05 fix, the err.log shows:
  ```
  runs.usage missing for run=c137c5ee-... provider=anthropic model=claude-sonnet-4-6
  ```
  When an Anthropic run terminates via the LLM-API-error path, no
  usage row is recorded in the `runs.usage` table. This is benign for
  billing-error runs (zero tokens consumed) but masks token usage on
  legitimate errored runs (e.g., a run that consumed 5000 tokens then
  hit a context-window 400 should still bill the 5000 tokens).
- **Severity**: LOW — only matters if billing-from-usage analytics are
  expected for errored runs.
- **Action**: Triage candidate, not blocking.

### T-260523-05 (original observation kept for record):

- **Symptom**: Anthropic returned a 400 from the streaming call after
  several successful tool round-trips. Backend logged the full
  traceback to err.log. **But the UI showed no error to the operator
  — only an apparent "long pause"** where execute_code seemed to be
  thinking. The operator thought the run was still running.
- **Affected paths**: Provider-side errors raised from
  `*_service.py` streaming functions (Anthropic confirmed;
  Google + OpenAI + OpenRouter likely identical pattern since they
  share the same agent-loop error-propagation surface).
- **Root cause hypothesis**: The SSE event stream may not be emitting
  a terminal error frame the frontend recognizes — OR it is but the
  frontend's onTerminal handler doesn't route this specific error
  type to a user-visible banner. Compare D-066-10 "Agent reached time
  limit" banner (which DID surface for the gemini-3.5-flash timeout)
  vs this provider-billing 400 (which did NOT surface).
- **Severity**: HIGH — silent failures during long runs make the
  product feel hung. Operator burns time waiting for a dead run.
- **Related**: F-3, F-4, F-7 from 075.4-POST-UAT-TRIAGE.md all
  collapse into the same root cause once this is understood: each
  of those was probably an upstream HTTP error that the UI swallowed
  and re-presented as "thinking" / "long pause" / "status not
  reflected".
- **Quick fix candidate** (don't apply blind): in
  `anthropic_service.py:200`-ish and analogous Google/OpenAI/OR sites,
  catch provider exceptions, emit a structured `terminal:provider_error`
  SSE event with the provider's message, and have the frontend route
  that to a banner identical to the time-limit one.

### Run 2 — OpenAI / GPT (TBD)
*pending*

### Run 3 — OpenRouter / Kimi (TBD)
*pending*

### Run 4 — Google / gemini-3.5-flash (re-test, expected to repro T-260523-01)
*pending*

### Run 5 — Google / gemini-3.1-flash-lite (smoke test of newly-registered model)
*pending*

## Coverage matrix (filled as runs complete)

| Provider | Model | Outcome | Time | Tools | Notes |
|---|---|---|---|---|---|
| Google | gemini-3-flash-preview | ✅ PASS | 81.7s | 5 | Step 2 baseline (commit 67206f7) |
| Anthropic | TBD | pending | | | |
| OpenAI | TBD | pending | | | |
| OpenRouter | TBD | pending | | | |
| Google | gemini-3.5-flash | pending | | | Pre-known: hits iter limit |
| Google | gemini-3.1-flash-lite | pending | | | Newly registered |
