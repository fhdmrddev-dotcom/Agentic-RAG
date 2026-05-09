---
phase: 067
plan: 05
type: execute
wave: 3
depends_on:
  - "067-01"
  - "067-02"
  - "067-03"
  - "067-04"
files_modified:
  - .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md
  - .planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md
  - .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md
autonomous: false
requirements:
  - STREAM-04-polish
must_haves:
  truths:
    - "UX-067-01 verified live (Chrome MCP): on submitting a prompt, the optimistic placeholder + first SSE delta paint within ~1s — no extended empty period, no manual refresh required"
    - "UX-067-02 verified live (Chrome MCP): no `Saving response…` text appears at any point during a run; banner copy only on terminal states"
    - "UX-067-03 verified live (Chrome MCP): F5 mid-stream reattaches via replay-tail and continues painting from the offset cursor — refresh is a recovery path, not a workaround"
    - "UX-067-04 verified live (Chrome MCP + backend log inspection): tab refresh during an open SSE consumer produces ZERO `redis.exceptions.TimeoutError` tracebacks in backend logs; an INFO line `consumer disconnected; xread cancellation-equivalent` IS present with the run_id"
    - "UX-067-05 verified live (Chrome MCP): on a multi-iteration agent run, `data-testid='iteration-divider'` elements render between iteration boundaries with `Step N` labels; first iteration has NO divider above it"
    - "Phase 066 SC#6 closed live: synthetic per-call timeout (LLM_CALL_TIMEOUT_OVERRIDES override) produces `runs.status='timed_out'`, `runs.error LIKE 'timed_out: %'`, `Agent reached time limit` banner, working Resume button, LangSmith trace shows clean `TimeoutError` with NO `GeneratorExit` exception column"
    - "066-HUMAN-UAT.md SC#6 row updated from `deferred` → `green` with concrete evidence (run_id, timestamps, LangSmith trace URL)"
    - "067-HUMAN-UAT.md created with green/red rows for UX-067-01..05 + SC#6 — closing UAT scoreboard for the phase"
    - "067-VALIDATION.md per-task verification map populated; nyquist_compliant flipped to true after all rows are green"
  artifacts:
    - path: ".planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md"
      provides: "Closing UAT scoreboard with 6 rows (UX-067-01, UX-067-02, UX-067-03, UX-067-04, UX-067-05, SC#6) — each row carries concrete evidence (DOM selector, run_id, timestamp, LangSmith trace URL)"
      contains: "iteration-divider"
    - path: ".planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md"
      provides: "SC#6 row flipped from `deferred` → `green` with run_id + LangSmith URL evidence"
      contains: "green"
    - path: ".planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md"
      provides: "Per-task verification map with all rows green; nyquist_compliant: true"
      contains: "nyquist_compliant: true"
  key_links:
    - from: "Chrome MCP take_snapshot of message bubble during streaming"
      to: "no Saving response… text + first delta visible within 1s"
      via: "DOM presence/absence assertion"
      pattern: "Saving response"
    - from: "backend logs (uvicorn stdout) during a tab-refresh test"
      to: "no Traceback (most recent call last) lines from runs.py xread paths"
      via: "log scrape + grep"
      pattern: "redis.exceptions.TimeoutError"
    - from: "Supabase CLI runs SELECT WHERE run_id=<from Chrome MCP test>"
      to: "status='timed_out', error LIKE 'timed_out: %'"
      via: "SQL query"
      pattern: "status.*timed_out"
    - from: "LangSmith MCP trace fetch with the timed_out run's trace_id"
      to: "no GeneratorExit at run_helpers.py:1680 in exception column"
      via: "trace tree exception inspection"
      pattern: "GeneratorExit"
---

<objective>
Closing UAT for Phase 067. Run Chrome MCP + Supabase MCP/CLI + LangSmith MCP verifications across all five UX fixes (UX-067-01..05) AND re-run Phase 066 Plan 05 Task 2 protocol verbatim to close out SC#6 (D-067-05). Update `066-HUMAN-UAT.md` SC#6 row from `deferred` → `green`. Create `067-HUMAN-UAT.md` and finalize `067-VALIDATION.md`.

This plan is `autonomous: false` — every visible UX fix requires human verification of MCP outputs (Chrome MCP screenshot/snapshot, Supabase row inspection, LangSmith trace URL). Cannot be fully scripted.

Purpose: closes the phase. Without this plan, Phase 067 would have plans 01–04 landed in code but no live evidence that the fixes work end-to-end. D-067-07 makes live verification non-substitutable.

Output: 6 verified UAT rows (5 UX issues + SC#6); 066-HUMAN-UAT.md updated; 067-HUMAN-UAT.md created; 067-VALIDATION.md filled out and nyquist-compliant.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-PATTERNS.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-01-state-machine-cleanup-PLAN.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-02-step-n-divider-PLAN.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-03-runs-xread-cancellation-cleanup-PLAN.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/067-frontend-streaming-ux-fix/067-04-stopgap-env-removal-PLAN.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-05-live-uat-gap-006-regression-PLAN.md

<interfaces>
<!-- The verbatim Phase 066 Plan 05 Task 2 protocol that this plan re-runs. -->

From `066-CONTEXT.md` D-066-09 / `066-HUMAN-UAT.md` "SC#6 + SC#7 (Task 2 — DEFERRED to Phase 067)":

Phase 066 Plan 05 Task 2 protocol (verbatim, used here for SC#6 closure):
1. Set `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` in `backend/.env` (active model can be checked from Settings or LLM_MODEL env).
2. Restart backend (`uvicorn` reload or kill-and-relaunch).
3. Submit a deliberately-slow prompt against the active model (any prompt that takes the LLM provider > 10s to respond — e.g. a long-form generation request).
4. Observe in Chrome MCP:
   - "Agent reached time limit" banner renders.
   - Resume button is visible on the assistant message.
   - Resume click re-POSTs the original prompt with full conversation context.
5. Verify in LangSmith MCP:
   - Trace shows clean `TimeoutError`.
   - NO `GeneratorExit` exception column at `run_helpers.py:1680`.
6. Verify in Supabase MCP/CLI:
   - `runs.status='timed_out'`.
   - `runs.error LIKE 'timed_out: %'`.
   - `started_at` and `completed_at` populated.
7. Cleanup: revert `LLM_CALL_TIMEOUT_OVERRIDES` to empty string after the test.

Test login: `fhdmrd@gmail.com` / `123456` (memory: `reference_local_dev_app.md`).
Dev app: `http://localhost:5173/`.
Backend: `http://localhost:8000/health`.
Supabase Studio: `http://127.0.0.1:54323/` (local).

DOM selectors / `data-testid` anchors set by Plan 02:
- `data-testid="iteration-divider"` — UX-067-05 Step N divider.
- `data-iteration={tc.iteration}` — UX-067-05 attribute carrying the 0-based iteration index.

Banner copy anchors (from MessageItem.tsx):
- `Agent reached time limit` — `timed_out` terminal state.
- `Response stopped` — `cancelled` or `stopped`.
- `Resume` (button text) — UX-067-05 / SC#6 Resume button visibility check.
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Live UAT — UX-067-01 + UX-067-02 + UX-067-03 (real-time first-paint, no Saving response, refresh recovery)</name>
  <what-built>
    - Plan 01: useMessages.ts terminal-flip guards (sendMessage + reconcile) wrapped in existence-check; MessageItem.tsx "Saving response…" fallback deleted.
    - Plan 03: runs.py xread cancellation cleanup (relevant to UX-067-04, but the refresh-recovery path tested in this task exercises the same SSE consumer — verifies UX-067-03 doesn't regress).
  </what-built>
  <how-to-verify>
    Pre-flight:
    - Frontend dev server up at `http://localhost:5173/` (vite running).
    - Backend up at `http://localhost:8000/health` returning 200 with `{"redis": "ok"}`.
    - Supabase local stack up (`supabase status` shows all green).
    - Backend log streaming visible (terminal tailing uvicorn stdout).

    Steps for UX-067-01 + UX-067-02 (first-paint + no Saving response):
    1. Chrome MCP: navigate to `http://localhost:5173/`, log in as `fhdmrd@gmail.com` / `123456`.
    2. Create a new chat thread.
    3. Submit a prompt that triggers a multi-iteration tool-call run, e.g. the Phase 066 Gap-006 verbatim prompt:
       > search for research authored by Fahed Mrad → professional short report → charts/diagrams → docx
    4. Take Chrome MCP `take_snapshot` immediately after submit (within ~1s window): assistant placeholder bubble visible, with first SSE delta beginning to render. Capture the run_id from the placeholder's stream URL in DevTools network panel.
    5. While the run is in progress, evaluate this script in Chrome MCP: `Array.from(document.querySelectorAll('span.italic')).map(e => e.textContent).filter(t => t.includes('Saving'))` — MUST return `[]` (empty array). UX-067-02 asserts the literal "Saving response…" text never appears.
    6. Take Chrome MCP `take_snapshot` again ~5s into the run: assistant message has visible content (tokens are painting), tool-call panel has at least one tool entry with status="running" or "done".

    Steps for UX-067-03 (refresh recovery):
    7. Mid-run (with the prompt still streaming), refresh the browser tab (Cmd-R / F5). The page should reload, the active-runs query should reattach to the in-flight run, and the assistant message should continue painting from where it left off.
    8. Chrome MCP `evaluate_script`: `document.querySelector('[data-streaming]')?.textContent.length > 0` — assistant message body is non-empty after refresh (replay-tail caught up).
    9. Verify Chrome MCP: NO duplicate assistant bubble. `document.querySelectorAll('[data-message-role="assistant"]').length` should be exactly 1 for the in-progress run.
    10. Wait for the run to complete naturally (or the test prompt may be shortened to make this faster). Verify the final assistant message renders with tool-call panel + content.

    Evidence to capture:
    - run_id from step 4.
    - Two Chrome MCP snapshots (step 4 + step 6).
    - Chrome MCP evaluate_script result from step 5 (the empty-array proof).
    - One Chrome MCP snapshot post-refresh (step 7-8).

    On the human reviewer side: type "approved UX-067-01,02,03 with run_id=&lt;...&gt;" or describe issues.
  </how-to-verify>
  <resume-signal>Type "approved UX-067-01,02,03 with run_id=&lt;...&gt;" or describe issues</resume-signal>
  <files>(checkpoint task — no source files modified; verifies plans 01 + 03 outputs live)</files>
  <action>This is a human-verification checkpoint. Execute the steps in `<how-to-verify>` above using Chrome MCP. Capture the run_id, the empty-array evaluate_script result, and three snapshots (t=0 / t=5s / post-refresh). Record evidence in the SUMMARY for use by Task 6 in the 067-HUMAN-UAT.md scoreboard.</action>
  <verify>
    <automated>echo "checkpoint:human-verify — see how-to-verify steps; resume-signal expected from human reviewer"</automated>
  </verify>
  <done>Human reviewer types the resume-signal phrase with the captured run_id. UX-067-01, UX-067-02, UX-067-03 confirmed live via Chrome MCP. Evidence captured for SUMMARY.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Live UAT — UX-067-04 (xread cancellation cleanup; backend log shows no traceback on tab refresh)</name>
  <what-built>
    Plan 03: runs.py imports `RedisTimeoutError` alias at module top; three xread call sites (lines 104, 163, 184) have differentiated handlers — `asyncio.CancelledError` re-raises, `RedisTimeoutError` logs INFO without traceback, `RedisError` keeps full traceback.
  </what-built>
  <how-to-verify>
    Pre-flight: same as Task 1; ensure no other backend uvicorn process is competing for port 8000.

    BLK-4 fix: deterministic stdout-redirect protocol with grep gates (replaces the prior
    "if logs are file-based, else visual inspection of stdout" non-deterministic step).
    Operator environment is now uniform — every reviewer sees the same evidence file.

    Steps:
    1. Stop any running backend uvicorn process. Linux/macOS: `pkill -f 'uvicorn app.main:app'`. Windows PowerShell: `Get-Process | Where-Object {$_.ProcessName -eq 'python' -and $_.CommandLine -like '*uvicorn*'} | Stop-Process -Force`. Verify port 8000 is free: `curl -s http://localhost:8000/health || echo 'free'`.

    2. Start uvicorn with stdout AND stderr redirected to a file (so all log output, including tracebacks, is captured deterministically):

       Linux/macOS:
       ```bash
       cd backend && source venv/bin/activate && \
         uvicorn app.main:app --reload --log-level info > /tmp/067-task2.log 2>&1 &
       echo $! > /tmp/067-task2.pid
       ```

       Windows PowerShell:
       ```powershell
       cd backend ; .\venv\Scripts\Activate.ps1 ; \
         $proc = Start-Process -FilePath uvicorn -ArgumentList 'app.main:app','--reload','--log-level','info' \
           -RedirectStandardOutput "$env:TEMP\067-task2.log" -RedirectStandardError "$env:TEMP\067-task2.err.log" \
           -PassThru -NoNewWindow
       $proc.Id | Out-File "$env:TEMP\067-task2.pid"
       ```

       (On Windows the stderr is redirected to a separate file because PowerShell's
       `Start-Process` does not support `2>&1` style merging directly; the test logic
       below greps both files with the same patterns.)

    3. Wait ~3s for uvicorn to bind. Verify backend boot: `curl -s http://localhost:8000/health` returns `{"redis": "ok", ...}`.

    4. Open dev app at http://localhost:5173/ as fhdmrd@gmail.com / 123456. Create a new chat thread. Submit a streaming prompt that takes ≥10s to complete (any prompt against a real LLM that triggers a multi-iteration tool-call run is fine; e.g., the Phase 066 Gap-006 prompt from Task 1).

    5. Wait until backend logs show the run started AND the consumer's xread is in BLOCK
       (the SSE EventStream is open in DevTools Network tab; backend log shows `replay_tail_consumer xread (tail phase)` or equivalent — the SSE consumer is now blocked on xread, which is the precise moment a tab refresh exercises UX-067-04).

    6. Refresh the browser tab (Cmd-R / F5). This forces an SSE consumer disconnect, which converts to a `redis.exceptions.TimeoutError` in the redis-py async_timeout wrapper at the BLOCKed xread.

    7. Wait ~3s for log buffer flush.

    8. Run grep gates against the captured log file (deterministic — no visual inspection):

       Linux/macOS (single log file):
       ```bash
       # Gate 1: NO redis.exceptions.TimeoutError traceback ABSENT after fix
       test "$(grep -c 'redis.exceptions.TimeoutError' /tmp/067-task2.log)" -eq 0 \
         || (echo "FAIL: redis.exceptions.TimeoutError still present"; exit 1)

       # Gate 2: canonical INFO substring present at least once with run_id
       test "$(grep -c 'consumer disconnected' /tmp/067-task2.log)" -ge 1 \
         || (echo "FAIL: canonical 'consumer disconnected' INFO line missing"; exit 1)

       # Gate 3: no Traceback block from runs.py xread paths
       test "$(grep -c 'Traceback (most recent call last)' /tmp/067-task2.log)" -eq 0 \
         || (echo "FAIL: Traceback present (genuine RedisError or xread regression)"; exit 1)

       echo "OK: all three grep gates passed"
       ```

       Windows PowerShell (two log files — stdout + stderr):
       ```powershell
       $combined = "$env:TEMP\067-task2.log","$env:TEMP\067-task2.err.log"
       $tb_count    = (Select-String -Path $combined -Pattern 'redis.exceptions.TimeoutError' | Measure-Object).Count
       $info_count  = (Select-String -Path $combined -Pattern 'consumer disconnected'         | Measure-Object).Count
       $generic_tb  = (Select-String -Path $combined -Pattern 'Traceback \(most recent call last\)' | Measure-Object).Count
       if ($tb_count   -ne 0)    { Write-Error "FAIL: redis.exceptions.TimeoutError still present ($tb_count)"; exit 1 }
       if ($info_count -lt 1)    { Write-Error "FAIL: canonical 'consumer disconnected' INFO line missing"; exit 1 }
       if ($generic_tb -ne 0)    { Write-Error "FAIL: Traceback present"; exit 1 }
       Write-Host "OK: all three grep gates passed"
       ```

       The canonical INFO substring is `consumer disconnected` (substring match — the
       full Plan 03 Task 2 string is `consumer disconnected; xread cancellation-equivalent`,
       but a substring of the canonical phrase is sufficient for the gate).

    9. Cleanup: kill the redirected uvicorn (Linux/macOS: `kill $(cat /tmp/067-task2.pid)`; Windows PowerShell: `Stop-Process -Id (Get-Content "$env:TEMP\067-task2.pid")`). Restart uvicorn normally (without redirect) so subsequent tasks have a clean log stream.

    Evidence to capture (deterministic — no operator-environment dependence):
    - run_id from step 4 (DevTools Network tab carries it as path param).
    - The three grep gate outputs from step 8 (each prints OK or FAIL).
    - 5-10 line snippet of `/tmp/067-task2.log` (or `$env:TEMP\067-task2.log`) around the refresh moment, captured to the SUMMARY for posterity.

    Acceptance for the checkpoint (Pass = all three gates print OK):
    - Gate 1 (no `redis.exceptions.TimeoutError`): `grep -c` returns 0.
    - Gate 2 (canonical INFO substring present): `grep -c 'consumer disconnected'` returns ≥ 1.
    - Gate 3 (no generic `Traceback`): `grep -c 'Traceback (most recent call last)'` returns 0.

    On the human reviewer side: type "approved UX-067-04 with run_id=&lt;...&gt; — gates 1/2/3 all OK" or describe failures.
  </how-to-verify>
  <resume-signal>Type "approved UX-067-04 with run_id=&lt;...&gt;" or describe issues</resume-signal>
  <files>(checkpoint task — no source files modified; verifies plan 03 output live; backend stdout/log file is the evidence surface)</files>
  <action>This is a human-verification checkpoint. Execute the steps in `<how-to-verify>` above using Chrome MCP for the trigger and visual log inspection (or `grep` against `backend/logs/*.log` if logs are persisted) for the post-refresh assertion. Capture the run_id, the 5-10 line backend log snippet around the refresh moment, and confirm both the INFO log presence and the absence of any traceback block. Record evidence in the SUMMARY.</action>
  <verify>
    <automated>echo "checkpoint:human-verify — see how-to-verify steps; backend log inspection required; resume-signal expected from human reviewer"</automated>
  </verify>
  <done>Human reviewer types the resume-signal phrase with the captured run_id. UX-067-04 confirmed: INFO log present with run_id, no `redis.exceptions.TimeoutError` traceback in the post-refresh window. Evidence captured for SUMMARY.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Live UAT — UX-067-05 (Step N iteration-divider DOM presence on multi-iteration run)</name>
  <what-built>
    Plan 02: `iteration?: number` field on ToolCall; `currentIteration` counter stamped onto new tool calls in `useMessages.ts` (onIterationStart bumps; onToolPreparing + onToolStart stamp); `data-testid="iteration-divider"` element rendered in ToolCallPanel.tsx between iteration boundaries.
  </what-built>
  <how-to-verify>
    Pre-flight: same as Task 1.

    Steps:
    1. Chrome MCP: navigate to `http://localhost:5173/`. Submit a prompt that explicitly triggers multiple iterations of tool calls. Recommended:
       > Run this Python code, then make a chart from the result and save it as PNG, then run another Python snippet that reads the PNG and writes a description to a docx file.
    2. Wait for the run to either complete or have at least 2 iteration boundaries (i.e., the agent has made at least 2 distinct LLM calls, each followed by tool calls).
    3. Chrome MCP `evaluate_script`: `document.querySelectorAll('[data-testid="iteration-divider"]').length` — MUST return ≥ 1 (at least one iteration boundary divider rendered between consecutive tool entries).
    4. Chrome MCP `evaluate_script`: `Array.from(document.querySelectorAll('[data-testid="iteration-divider"]')).map(e => e.textContent.trim())` — captures the visible label text. Each MUST contain a "Step N" substring with N ≥ 2 (Pitfall 4: never above first iteration).
    5. Chrome MCP `take_snapshot`: visual confirmation that the divider has the gradient styling (subtle horizontal line with center label, matching the user mockup `──── Step 2 ──────`).

    Edge case verification:
    6. On the same run, confirm there is NO divider above the FIRST tool call. Chrome MCP `evaluate_script`: `(() => { const panel = document.querySelector('[data-tool-call-panel]') ?? document.querySelector('.tool-call-panel'); const firstChild = panel?.children[0]; return firstChild?.getAttribute('data-testid'); })()` — should NOT return "iteration-divider" for the first child of the panel.

    Evidence to capture:
    - run_id from step 1.
    - Output of step 3 (count of dividers, integer ≥ 1).
    - Output of step 4 (array of labels, each containing "Step N" with N ≥ 2).
    - One Chrome MCP snapshot showing the divider visually.
    - Confirmation that no divider rendered above the first tool call.

    On the human reviewer side: type "approved UX-067-05 with N dividers visible at Step 2/3/..." or describe issues.
  </how-to-verify>
  <resume-signal>Type "approved UX-067-05 with N dividers" or describe issues</resume-signal>
  <files>(checkpoint task — no source files modified; verifies plan 02 output live; DOM is the evidence surface)</files>
  <action>This is a human-verification checkpoint. Execute the steps in `<how-to-verify>` above using Chrome MCP for both DOM querying (via `evaluate_script`) and visual confirmation (via `take_snapshot`). Capture the divider count, the array of label texts, and at least one snapshot showing the gradient styling. Record evidence in the SUMMARY.</action>
  <verify>
    <automated>echo "checkpoint:human-verify — see how-to-verify steps; Chrome MCP DOM query required; resume-signal expected from human reviewer"</automated>
  </verify>
  <done>Human reviewer types the resume-signal phrase with the divider count. UX-067-05 confirmed: at least one `[data-testid='iteration-divider']` rendered with `Step N` label (N ≥ 2) and no divider above the first iteration. Evidence captured for SUMMARY.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: SC#6 closure — synthetic per-call timeout protocol re-run (Phase 066 Plan 05 Task 2 verbatim)</name>
  <what-built>
    All four upstream plans landed; this task re-runs the Phase 066 Plan 05 Task 2 protocol verbatim against the now-fixed frontend so SC#6 (frontend timed_out banner + Resume button + clean LangSmith trace) gets its live verification and 066-HUMAN-UAT.md SC#6 row flips from `deferred` to `green`.
  </what-built>
  <how-to-verify>
    Pre-flight: ensure all of plans 01-04 have been verified and committed; backend up; frontend up; Supabase up.

    Steps (mirrors Phase 066 Plan 05 Task 2 verbatim — D-067-05):

    Setup:

    **BLK-6 / RESEARCH-correction note (2026-05-07):** CONTEXT.md SC#6 (line 65) references
    `per_call_budget=1` against `slow_llm_response_seconds=2` — that is INACCURATE per
    RESEARCH.md correction #3. The corrected protocol below uses
    `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` against the real LLM (no synthetic
    mock fixture). The `slow_llm_response_seconds` symbol DOES NOT EXIST in the codebase;
    do not search for it. Plan 05 Task 7 (below) appends a one-line correction note to
    CONTEXT.md so the canonical scope document no longer carries the drift forward.

    1. Identify the active LLM model. Check Settings UI in dev app, or `grep LLM_MODEL backend/.env`. Note the model name (e.g. `gpt-4o`, `claude-sonnet-4`, `openrouter/google/gemini-2.5-pro`, etc.).
    2. Edit `backend/.env`: set `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10` (where `<active-model>` is the exact string from step 1). Save.
    3. Restart the backend (kill and relaunch the uvicorn process — reload may not pick up env var changes).
    4. Verify backend boot: `curl http://localhost:8000/health` returns `{"redis": "ok", ...}`.

    Trigger the timed_out path:
    5. Chrome MCP: open `http://localhost:5173/`, log in if needed, create a new thread.
    6. Submit a deliberately-slow prompt against the active model. Anything that the LLM would take > 10s to start streaming. Recommended:
       > Write a thoroughly detailed 5000-word essay on the history of Byzantine emperors, including the political dynamics of the Komnenian restoration, the Macedonian dynasty's reconquest of Anatolia, the impact of the Fourth Crusade, and concluding with the fall of Constantinople in 1453. Cite primary and secondary sources throughout.
    7. Within ~10-15s, the per-call timeout fires server-side. Backend emits a `timed_out` SSE terminal event.

    Frontend verification (Chrome MCP):
    8. Chrome MCP `evaluate_script`: `document.querySelector('[data-message-role="assistant"]:last-of-type span.italic')?.textContent` — captures the banner text. Expected: `"Agent reached time limit"`.
    9. Chrome MCP `evaluate_script`: `!!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Resume')` — Resume button is rendered. Expected: `true`.
    10. Chrome MCP: click the Resume button. Expected behavior: a new POST to `/threads/{tid}/messages` is fired, and a new run begins streaming. Take a snapshot showing the new placeholder bubble appearing.

    Backend / Supabase verification:
    11. Capture the timed_out run's `run_id` from step 7 (DevTools Network tab, or backend log).
    12. Supabase CLI / MCP / Studio SQL editor: run
        ```sql
        SELECT run_id, status, error, started_at, completed_at
        FROM public.runs
        WHERE run_id = '<run_id from step 11>';
        ```
        Expected:
        - `status='timed_out'`
        - `error LIKE 'timed_out: %'` (e.g. `timed_out: 10s deadline exceeded at iteration 0`)
        - `started_at` and `completed_at` both populated.

    LangSmith verification:
    13. LangSmith MCP: fetch the trace for the timed_out run (use the model + run_id timestamp window if a direct mapping isn't available; LangSmith trace IDs are model-API-call-scoped, but the run window is queryable).
    14. Inspect the trace tree:
        - Top-level run terminates with `TimeoutError` (clean).
        - NO `GeneratorExit` row in the exception column at `run_helpers.py:1680` (Phase 066 D-066-11 invariant — `stream.close()` runs cleanly before the timeout).
        - Capture the LangSmith trace URL for evidence.

    Cleanup:
    15. Edit `backend/.env`: revert `LLM_CALL_TIMEOUT_OVERRIDES` to empty string (`LLM_CALL_TIMEOUT_OVERRIDES=`). Save.
    16. Restart backend.
    17. Verify a normal prompt against the active model now completes without timing out.

    Evidence to capture (used in Tasks 5+6 below):
    - run_id from step 11.
    - Banner text from step 8 (must equal "Agent reached time limit").
    - Resume button presence from step 9.
    - SQL row from step 12 (status, error, started_at, completed_at).
    - LangSmith trace URL from step 14.
    - Confirmation that no `GeneratorExit` appears in the trace.

    On the human reviewer side: type "approved SC#6 with run_id=&lt;...&gt;, trace=&lt;url&gt;" or describe issues.
  </how-to-verify>
  <resume-signal>Type "approved SC#6 with run_id=&lt;...&gt;, trace=&lt;url&gt;" or describe issues</resume-signal>
  <files>backend/.env (temporary edit + revert), .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md (evidence input for Task 5)</files>
  <action>This is a human-verification checkpoint that follows the verbatim Phase 066 Plan 05 Task 2 protocol (D-067-05). Execute the steps in `<how-to-verify>` above: temporarily edit `backend/.env` to add `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10`, restart backend, trigger the timed_out path via Chrome MCP with a deliberately-slow prompt, capture the run_id and verify all three live-tool surfaces (Chrome MCP banner + Resume; Supabase runs row; LangSmith trace). Cleanup step REQUIRED: revert `LLM_CALL_TIMEOUT_OVERRIDES` to empty string in `backend/.env` and restart backend before exiting the checkpoint. Record full evidence in the SUMMARY for Task 5's 066-HUMAN-UAT.md row update.</action>
  <verify>
    <automated>echo "checkpoint:human-verify — see how-to-verify steps; Chrome MCP + Supabase MCP/CLI + LangSmith MCP required; resume-signal expected from human reviewer"</automated>
  </verify>
  <done>Human reviewer types the resume-signal phrase with run_id and LangSmith trace URL. SC#6 confirmed: banner "Agent reached time limit" rendered, Resume button visible + clickable, runs row `status='timed_out'` and `error LIKE 'timed_out: %'`, LangSmith trace clean (no `GeneratorExit`). LLM_CALL_TIMEOUT_OVERRIDES reverted to empty string. Evidence captured for SUMMARY and downstream Tasks 5+6.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Update 066-HUMAN-UAT.md SC#6 row from deferred to green</name>
  <files>.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md</files>
  <read_first>
    - .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md (the SC#6 row marked `deferred` and the Task 2 deferral rationale that follows it)
    - Evidence captured in Task 4 (run_id, banner text, SQL row, LangSmith trace URL)
  </read_first>
  <behavior>
    - One row in the success criteria scoreboard table flips from `deferred` to `green` with concrete evidence inline.
    - The "SC#6 + SC#7 (Task 2 — DEFERRED to Phase 067)" rationale section below the table is updated to note that the deferral was closed by Phase 067 plan 05; do NOT delete the rationale (preserve historical context per CONTEXT.md "feedback_preserve_all_deferred_ideas.md" memory).
  </behavior>
  <action>
    In `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md`:

    1. Find the SC#6 row (currently marked `carry-forward` per the file content read, with body `"Live verification deferred to Phase 067..."`). Replace the status cell `carry-forward` with `green`. Replace the evidence cell with concrete evidence captured in Task 4:

    ```
    | SC#6 | Frontend renders "Agent reached time limit" banner + Resume on `timed_out` | green | **Phase 067 Plan 05 Task 4 closed live (2026-05-07).** run_id `<run_id>`, banner text "Agent reached time limit" verified via Chrome MCP, Resume button visible + clickable, runs row `status='timed_out'` and `error LIKE 'timed_out: %'`, LangSmith trace `<url>` shows clean `TimeoutError` with NO `GeneratorExit` at `run_helpers.py:1680`. |
    ```

    Where `<run_id>` and `<url>` are filled from Task 4 evidence.

    2. Find the "SC#6 + SC#7 (Task 2 — DEFERRED to Phase 067)" subsection (~line 100). Append a new paragraph at the end:

    ```
    **2026-05-07 — Closure note:** Phase 067 Plan 05 Task 4 re-ran this protocol verbatim against the post-067 fixed frontend. SC#6 closed `green` with evidence in the row above. `LLM_CALL_TIMEOUT_OVERRIDES` was reverted to empty string after the test (cleanup step 15-16 of the protocol). The deferral that originally lived here is now historical — the architectural Gap-006 fix (Phase 066) is end-to-end live-verified.
    ```

    3. If the file's frontmatter has `status: partial`, leave it as-is (the file documents Phase 066, not Phase 067; the project_level_approval was already `approved`).

    Do NOT touch any other row, table cell, or section. Do NOT regenerate the entire file from a template. Surgical edit only.
  </action>
  <acceptance_criteria>
    - `grep -n "Phase 067 Plan 05 Task 4 closed live" .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` returns at least 1 match.
    - The SC#6 row status cell is `green` (not `carry-forward` or `deferred`): `grep "SC#6.*green" .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` returns at least 1 match.
    - SC#7 row status preserved (was `green` per pre-067 state): `grep "SC#7.*green" .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md` returns at least 1 match (no regression).
    - Closure note paragraph contains the "2026-05-07" date and "Phase 067 Plan 05 Task 4" reference.
  </acceptance_criteria>
  <verify>
    <automated>grep -c "Phase 067 Plan 05 Task 4 closed live" .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md</automated>
  </verify>
  <done>
    066-HUMAN-UAT.md SC#6 row marked `green` with concrete evidence (run_id, banner text, SQL row state, LangSmith trace URL); closure-note paragraph appended to the deferral rationale section. SC#7 row preserved.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 6: Create 067-HUMAN-UAT.md scoreboard + finalize 067-VALIDATION.md</name>
  <files>.planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md, .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md</files>
  <read_first>
    - .planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-HUMAN-UAT.md (template for the scoreboard format and frontmatter conventions)
    - .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md (current draft state with placeholder per-task verification map)
    - Evidence captured in Tasks 1-4
  </read_first>
  <behavior>
    - 067-HUMAN-UAT.md is a NEW file with 6 success criteria rows: UX-067-01, UX-067-02, UX-067-03, UX-067-04, UX-067-05, SC#6 closure. Each row carries concrete evidence inline. Frontmatter uses `status: green` with `project_level_approval: approved` (the phase ships green per the architectural verdict, and the live UAT closes the only deferral 067 carried — Phase 066 SC#6).
    - 067-VALIDATION.md per-task verification map gets all 5 rows (Task ID 067-01-* through 067-05-*) marked `✅ green` (using the existing emoji from the legend at line 56). Frontmatter `nyquist_compliant` flips from `false` to `true`. `wave_0_complete` stays `false` per the existing draft note (Wave 0 was not introduced because vitest is now functional and existing infrastructure covers the surface).
  </behavior>
  <action>
    **Create `.planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md`** with the following content (filling concrete evidence from Tasks 1-4):

    ```markdown
    ---
    phase: 067-frontend-streaming-ux-fix
    status: green
    reviewed_at: 2026-05-07T<timestamp>Z
    project_level_approval: approved
    ---

    # Phase 067 — HUMAN-UAT Scoreboard

    ## Summary

    Phase 067 closed the 5-issue carry-forward dossier (UX-067-01..05) from Phase 066's
    live UAT and re-ran Phase 066 Plan 05 Task 2 protocol verbatim to close out SC#6.
    Real-time first-paint of streaming agent events restored; "Saving response…"
    fallback removed; tool-call iteration boundaries surfaced via "Step N" gradient
    dividers; backend Redis-consumer cancellation logging cleaned up; obsolete
    RUN_HARD_TIMEOUT_SECONDS stopgap removed.

    All five UX fixes verified live via Chrome MCP. SC#6 closed via the
    LLM_CALL_TIMEOUT_OVERRIDES synthetic-timeout protocol with full Chrome MCP +
    Supabase + LangSmith evidence.

    ## Pre-flight Environment

    | Property | Value |
    |----------|-------|
    | Frontend | http://localhost:5173/ — UP |
    | Backend | http://localhost:8000/health — UP, Redis: ok |
    | Test login | fhdmrd@gmail.com / 123456 |
    | Active model | <model from Task 4 step 1> |

    ## Success Criteria Scoreboard

    | SC | Description | Status | Evidence |
    |----|-------------|--------|----------|
    | UX-067-01 | Real-time first-paint of streaming agent events (no manual refresh) | green | Task 1 — Chrome MCP snapshot at t=0 + t=5s shows progressive token render; placeholder appears within ~1s of POST. run_id `<run_id_t1>` |
    | UX-067-02 | "Saving response…" never appears mid-stream | green | Task 1 — Chrome MCP `evaluate_script` Array.from(...).filter(t=>t.includes('Saving')) returned [] across full run cycle. |
    | UX-067-03 | F5 mid-stream reattaches via replay-tail; refresh is recovery, not workaround | green | Task 1 — F5 mid-stream test: assistant message continues painting from offset cursor; no duplicate bubble; <code>data-streaming</code> body non-empty post-refresh. |
    | UX-067-04 | Tab refresh produces no `redis.exceptions.TimeoutError` traceback in backend log | green | Task 2 — backend log scrape post-refresh: 0 traceback lines; 1 INFO line `consumer disconnected; xread cancellation-equivalent` with run_id `<run_id_t2>`. |
    | UX-067-05 | Multi-iteration agent runs surface "Step N" iteration-boundary dividers | green | Task 3 — Chrome MCP `document.querySelectorAll('[data-testid="iteration-divider"]').length` returned <N>; labels `Step 2`, `Step 3` visible; no divider above first iteration (Pitfall 4 confirmed). run_id `<run_id_t3>` |
    | SC#6 (Phase 066 closure) | Synthetic per-call timeout produces banner + Resume + clean LangSmith trace | green | Task 4 — `LLM_CALL_TIMEOUT_OVERRIDES=<model>=10` synthetic timeout: banner "Agent reached time limit" via Chrome MCP; Resume button visible + clickable; runs row `status='timed_out'`, `error LIKE 'timed_out: %'`; LangSmith trace `<url>` clean `TimeoutError`, NO `GeneratorExit`. run_id `<run_id_t4>` |

    ## Evidence detail

    ### UX-067-01 + 02 + 03 (Task 1)
    - run_id: `<run_id_t1>`
    - Snapshots: <snapshot file refs or inline base64-thumbnails if captured>
    - evaluate_script proof: `[]` (empty array — no "Saving" matches)
    - F5 mid-stream: assistant body non-empty within 1s of reload; no duplicate bubble.

    ### UX-067-04 (Task 2)
    - run_id: `<run_id_t2>`
    - Backend log snippet around refresh moment:
      ```
      <5-10 lines from backend stdout, including the INFO log line>
      ```
    - Traceback grep: 0 matches.

    ### UX-067-05 (Task 3)
    - run_id: `<run_id_t3>`
    - Divider count: `<N>` (≥ 1)
    - Divider labels: `["Step 2", "Step 3", ...]`
    - First-iteration check: panel.children[0] data-testid is NOT "iteration-divider".

    ### SC#6 closure (Task 4)
    - run_id: `<run_id_t4>`
    - Banner text: "Agent reached time limit"
    - Resume button: visible, clickable, fires new POST.
    - SQL row:
      ```
      run_id    | status     | error                                            | started_at | completed_at
      <run_id_t4> | timed_out  | timed_out: 10s deadline exceeded at iteration 0  | <ts>       | <ts>
      ```
    - LangSmith trace: `<url>`
    - GeneratorExit absent at `run_helpers.py:1680`.
    - Cleanup: LLM_CALL_TIMEOUT_OVERRIDES reverted to empty string post-test.

    ## Outcome

    All 6 success criteria green. Phase 067 closed.
    ```

    Replace each `<...>` placeholder with the concrete evidence captured in Tasks 1-4.

    **Update `.planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md`**:

    1. In the frontmatter, change `nyquist_compliant: false` → `nyquist_compliant: true`. Also change `wave_0_complete: false` → `wave_0_complete: true` (BLK-2 closure: Plan 03 Task 3 now creates `backend/tests/api/test_runs_cancellation.py`, satisfying the Wave 0 requirement that VALIDATION.md previously listed as a broken link).

    2. In the Per-Task Verification Map table (lines 48-54), update the Status column for each row from `⬜ pending` to `✅ green`. The other columns are already populated; do NOT change them.

    3. In the "Wave 0 Requirements" section (lines 60-66), DO NOT replace the bulleted list with the "Existing infrastructure covers all phase requirements" boilerplate. Instead, flip each existing `- [ ]` checkbox to `- [x]`:
       - The first two rows (frontend test stubs) — flip if the executor confirms vitest tests exist or were created during execution; otherwise leave `- [ ]` and document in SUMMARY (vitest may still be deferred per Phase 063.1 carry-forward).
       - The third row (`backend/tests/api/test_runs_cancellation.py`) — flip to `- [x]` because Plan 03 Task 3 (BLK-2 closure) created this file.

    4. In the Validation Sign-Off section (lines 82-92), check all 7 boxes (`- [x]` instead of `- [ ]`). Replace `**Approval:** pending — to be set by planner during PLAN.md generation` with `**Approval:** approved — UAT closed via Plan 05 (2026-05-07).`

    Do NOT touch any other section, row, or comment in 067-VALIDATION.md (Test Infrastructure table, Sampling Rate, Manual-Only Verifications) — those are filled out at the planning layer and remain accurate.
  </action>
  <acceptance_criteria>
    - File `.planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md` exists.
    - File contains all 6 SC rows: `grep -c "^| UX-067-0\\|^| SC#6" .planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md` returns at least 6.
    - All 6 rows show `green` status (no `deferred`, `partial`, `red`): `grep -c "| green |" .planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md` returns at least 6.
    - Concrete run_ids inserted (no `<run_id_...>` placeholder remains): `grep -c "<run_id" .planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md` returns 0.
    - Concrete LangSmith URL inserted (no `<url>` placeholder remains): `grep -c "<url>" .planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md` returns 0.
    - 067-VALIDATION.md frontmatter `nyquist_compliant: true`: `grep -c "nyquist_compliant: true" .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md` returns 1.
    - 067-VALIDATION.md frontmatter `wave_0_complete: true` (BLK-2 closure): `grep -c "wave_0_complete: true" .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md` returns 1.
    - 067-VALIDATION.md Wave 0 Requirements row for `test_runs_cancellation.py` is checked: `grep -c "\[x\] .backend/tests/api/test_runs_cancellation.py." .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md` returns 1.
    - All 5 per-task verification rows marked `✅ green`: `grep -c "✅ green" .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md` returns at least 5.
    - All 7 sign-off checkboxes flipped: `grep -c "- \\[x\\]" .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md` returns at least 7.
  </acceptance_criteria>
  <verify>
    <automated>test -f .planning/phases/067-frontend-streaming-ux-fix/067-HUMAN-UAT.md && grep -c "nyquist_compliant: true" .planning/phases/067-frontend-streaming-ux-fix/067-VALIDATION.md</automated>
  </verify>
  <done>
    067-HUMAN-UAT.md exists with 6 green rows and concrete evidence. 067-VALIDATION.md frontmatter is `nyquist_compliant: true`, per-task map all green, sign-off checkboxes flipped. Phase closes here.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 7: BLK-6 — append RESEARCH.md correction #3 note to CONTEXT.md + NIT-2 graphify update</name>
  <files>.planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md, graphify-out/</files>
  <read_first>
    - .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md (line 65 — the SC#6 line that references the obsolete `per_call_budget=1` / `slow_llm_response_seconds=2`)
    - .planning/phases/067-frontend-streaming-ux-fix/067-RESEARCH.md (correction #3 — the canonical correction the note will reference)
    - CLAUDE.md (graphify section — `graphify update .` is the post-modification rule)
  </read_first>
  <behavior>
    - One-line correction note appended under the SC#6 reference paragraph (around CONTEXT.md
      line 65) so CONTEXT.md is no longer a drift source for SC#6's protocol semantics.
    - Per CLAUDE.md graphify rule: after all phase commits, run `graphify update .` from the
      repo root so graphify-out reflects the post-067 codebase.
  </behavior>
  <action>
    **Part A — BLK-6 CONTEXT.md correction note:**

    In `.planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md`, locate the SC#6
    bullet point at approximately line 65 (the "synthetic per-call timeout (per_call_budget=1
    against slow_llm_response_seconds=2)" reference inside the "What done looks like"
    section). After that bullet point's closing line, insert this paragraph (preserve
    document structure — append at the end of the SC#6 bullet, do NOT rewrite the bullet):

    ```markdown

    **Correction (RESEARCH.md #3, applied 2026-05-07 by Plan 05 Task 7):** the SC#6
    protocol uses `LLM_CALL_TIMEOUT_OVERRIDES=<active-model>=10`, NOT `per_call_budget=1`
    / `slow_llm_response_seconds=2`. The latter symbols DO NOT EXIST in the codebase. See
    Plan 05 Task 4 for the verbatim corrected protocol.
    ```

    Acceptance: `grep -c "LLM_CALL_TIMEOUT_OVERRIDES" .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md` returns ≥ 1 after this edit.

    **Part B — NIT-2 graphify update:**

    Run from the repo root (Linux/macOS or Windows PowerShell — graphify is the standalone
    CLI per memory `reference_graphify_standalone.md`):

    ```bash
    graphify update .
    ```

    The CLI is AST-only and incremental — no API cost, completes in seconds for a typical
    diff size. Captures the file-modification deltas from Plans 01-05 so graphify-out stays
    in sync with the working tree (CLAUDE.md project rule).

    If `graphify` is not on PATH (operator environment variance), the executor records the
    deviation in the SUMMARY per Rule 3 and proceeds — graphify-out staleness is not a
    UAT-blocker. The grep acceptance below is best-effort.

    Do NOT touch:
    - The original SC#6 bullet text (preserve historical intent — append the correction; do
      not rewrite the bullet).
    - Any other CONTEXT.md decision (D-067-01..07 frozen).
    - Any code under `graphify-out/wiki/` directly — those are graphify-managed.
  </action>
  <acceptance_criteria>
    - CONTEXT.md correction note present: `grep -c "LLM_CALL_TIMEOUT_OVERRIDES" .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md` returns ≥ 1.
    - The note carries the date stamp and Plan reference: `grep -c "Correction (RESEARCH.md #3, applied 2026-05-07 by Plan 05 Task 7)" .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md` returns ≥ 1.
    - The original SC#6 bullet's `per_call_budget=1` reference is preserved (history): `grep -c "per_call_budget=1" .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md` returns ≥ 1 (the bullet still exists; the correction sits below it, not in place of it).
    - NIT-2 graphify update: `git log --since='2 hours ago' -- graphify-out/ | grep -c '^commit'` returns ≥ 1 OR `graphify update .` exit code 0 was recorded in the SUMMARY (allowance for environments where graphify is not on PATH — best-effort per CLAUDE.md).
  </acceptance_criteria>
  <verify>
    <automated>grep -c "LLM_CALL_TIMEOUT_OVERRIDES" .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md && grep -c "per_call_budget=1" .planning/phases/067-frontend-streaming-ux-fix/067-CONTEXT.md</automated>
  </verify>
  <done>
    CONTEXT.md SC#6 reference no longer carries the drift forward — a correction note dated
    2026-05-07 references RESEARCH.md #3 and the corrected protocol uses
    `LLM_CALL_TIMEOUT_OVERRIDES`. `graphify update .` ran successfully (or deviation
    recorded). BLK-6 closed; NIT-2 closed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Authenticated user → POST /threads/{tid}/messages | Existing trust boundary; Resume button click fires another POST that goes through the same auth + RLS pipeline as the original. |
| Operator → backend/.env (LLM_CALL_TIMEOUT_OVERRIDES override) | Operator-trust scoped — env vars are operator-set (per CLAUDE.md), not user-input. The override is reverted after the test. |
| LangSmith MCP → trace data | Trace data is read-only; no write surface from this plan. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-067-05-01 | Tampering | Resume button replay attack on stale prompt | accept (mitigated by existing surface) | The Resume button (Phase 066 D-066-09) re-POSTs the original prompt with full conversation context. Server-side `runs.status` gating already exists: a Resume on a `failed` or `timed_out` run creates a NEW run with a NEW run_id. There is no replay surface — the original prompt content was already submitted by the user; resending it is a deliberate retry, not an attack vector. The threat is documented here for traceability but the existing architecture already handles it. |
| T-067-05-02 | Information disclosure | LangSmith trace URL in 067-HUMAN-UAT.md | accept | LangSmith trace URLs are operator-scoped (require LangSmith dashboard auth to view). The URL itself is not sensitive — comparable to a Sentry issue link. |
| T-067-05-03 | Denial of Service | Synthetic per-call timeout test in production | mitigate | The protocol explicitly requires running on local dev (`http://localhost:5173/`), not on production. `backend/.env` `LLM_CALL_TIMEOUT_OVERRIDES` is reverted to empty string in cleanup step 15. Production deployments do not see this test fixture. |

UX-067-04 mitigation note: the deletion of the `redis.exceptions.TimeoutError` traceback from operator-facing logs (Plan 03) is itself a security improvement — it removes incidental info-leak (async stack frames, internal file paths) on every legitimate user tab cycle. T-067-03-01 in Plan 03's threat model documents this.
</threat_model>

<verification>
This plan is the verification for the entire phase. Its tasks ARE the verification criteria. Outputs:
- 6 green rows in 067-HUMAN-UAT.md.
- 1 row flipped from deferred to green in 066-HUMAN-UAT.md (SC#6 closure).
- 067-VALIDATION.md per-task map populated and nyquist-compliant.
</verification>

<success_criteria>
- All 5 UX fixes (UX-067-01..05) verified live via Chrome MCP with concrete run_ids and DOM/log evidence.
- Phase 066 SC#6 closed live with concrete run_id, banner text, SQL row, and LangSmith trace URL.
- 066-HUMAN-UAT.md SC#6 row flipped to `green` with closure note.
- 067-HUMAN-UAT.md created with all 6 green rows.
- 067-VALIDATION.md per-task map populated; `nyquist_compliant: true`; sign-off checkboxes flipped.
- LLM_CALL_TIMEOUT_OVERRIDES reverted to empty string post-test (cleanup).
- BLK-6 closure: CONTEXT.md SC#6 reference annotated with RESEARCH.md #3 correction so future readers see the corrected protocol.
- NIT-2 closure: `graphify update .` ran post-phase (CLAUDE.md project rule) so graphify-out reflects the 067 diff.
</success_criteria>

<output>
After completion, create `.planning/phases/067-frontend-streaming-ux-fix/067-05-SUMMARY.md` documenting:
- Each task's outcome (Tasks 1-7).
- Evidence references (run_ids, snapshots, log snippets, SQL rows, LangSmith URLs).
- Task 2 deterministic gate outputs (BLK-4): the three `grep -c` results from the redirected log file.
- Task 7 outputs (BLK-6 + NIT-2): CONTEXT.md correction note line, `graphify update .` exit code (or deviation note).
- Any deviations from the plan (with rationale per Rule 3 of execute-plan.md).
- Phase 067 closing verdict: green or any open carry-forwards.
</output>
