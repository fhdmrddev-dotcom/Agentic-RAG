---
phase: 075-seed-008-tool-args-progress-polish-bundle
plan: 02
subsystem: sse-producer
tags: [sse, sandbox, docker-exec, heartbeat, line-buffer, bottom-indicator, bug-fold, react]

# Dependency graph
requires:
  - phase: 061-run-backed-streaming
    provides: _emit XADD wrapper (D-061-10) + 10s keepalive cadence + asyncio.Queue producer/consumer bridge
  - phase: 067.4-streaming-render-storage-fixes
    provides: code_executing heartbeat invariant origin (D-067.4-R5-01) — preserved + composed-with per D-075-08
  - phase: 067.5-frontend-reconcile-fix
    provides: Branch D-3 streaming-bucket guard at StreamsProvider.tsx (clearThreadBucket predicate) — PRESERVED VERBATIM per D-075-02
  - phase: 074-seed-009-seed-011-polish
    provides: hoisted _reset_redis_singleton autouse fixture (D-074-11) — auto-applies to test_075_code_stdout_progressive.py
  - phase: 075-01
    provides: BUG-260518-01 closure pattern (reconcile-fetch-before-mutate); independent code zones — no overlap
provides:
  - session.execute_command(python -u {code_file}, on_stdout=..., on_stderr=...) sandbox call replacing session.run()
  - Line-buffer accumulator emitting one code_stdout SSE event per complete line with monotonic captured_at
  - DELETED post-completion stdout/stderr emit block (D-075-07) — no more double-emit at completion
  - Silent-window heartbeat (code_executing fires only when now - _last_output_at >= 1.0s)
  - Sticky bottom-indicator text via stickyLabelRef (BUG-260514-03 part a)
  - Implicit code_stdout subscription via existing outputLines mutation (BUG-260514-03 part b)
  - BUG-260514-03 fold timeline note appended
affects:
  - Phase 075 Plan 03 (tool_args_progress) — independent; no shared code zones
  - Future v3.0 Skill Studio (execute_code tool_args_progress consumer + bottom-indicator UI further iteration)

# Tech tracking
tech-stack:
  added: []  # no new dependencies — uses already-installed llm-sandbox session.execute_command + session.copy_to_runtime + session.install
  patterns:
    - "Docker exec streaming via session.execute_command(cmd, on_stdout=, on_stderr=) — high-level wrapper flips exec_run(stream=True, demux=True) + dispatches per-chunk callbacks via mixins._process_stream_output"
    - "python -u unbuffered child invocation pattern — mandatory whenever Docker exec runs with tty=False to avoid CPython block-buffered stdout"
    - "Server-side line-buffer accumulator: combined = (partial + chunk).replace(CRLF, LF); split on \\n; trailing element is next partial; flush trailing partial on _done"
    - "Silent-window heartbeat clock: track _last_output_at; reset ONLY on stdout/stderr chunk arrival (never on heartbeat itself — Pitfall 7) to avoid emit-deadlock"
    - "Sticky-text retention in React via useRef<string | null> — retain last non-null computed value while streaming, reset on terminal — keeps indicators alive during silent SSE windows"
    - "Implicit React-mutation-as-subscription — onCodeStdout already mutates tool_call.outputLines; the re-render is the subscription; no explicit listener needed in display components"

key-files:
  created:
    - backend/tests/integration/test_075_code_stdout_progressive.py
  modified:
    - backend/app/api/threads.py (sandbox branch: execute_command swap + line-buffer + silent-window heartbeat + DELETE post-completion emit)
    - frontend/src/components/chat/MessageItem.tsx (sticky bottom-indicator text via stickyLabelRef + stickyBottomLabel)
    - .planning/reported-bugs/streaming-indicator-top-bottom-desync.md (Fold timeline note)

key-decisions:
  - "session.copy_to_runtime() chosen over heredoc fallback for code-file write — cleanest path, avoids quoting hazards on multi-line user code"
  - "session.install(libraries=...) hoisted out of session.run() into a separate call BEFORE _run_sync — wrapped in try/except with identifier-only logger.warning"
  - "Item type renamed code_stdout/code_stderr → stdout_chunk/stderr_chunk inside the queue; the drain consumer line-buffers and re-emits code_stdout/code_stderr SSE events — clean producer/consumer separation"
  - "Sticky-text retention implemented as useRef in MessageItem.tsx (not a new Zustand store slice) — minimal blast radius, no Provider changes for part (b); the existing onCodeStdout handler at StreamsProvider.tsx:310-322 already mutates outputLines, which re-renders MessageItem"
  - "Bottom-indicator code_stdout subscription is IMPLICIT via existing tool_call mutation pipeline — explicit subscription would have required a new Provider action + Zustand slice; the current path is byte-equivalent and uses zero new code in StreamsProvider"

patterns-established:
  - "Pattern: docker exec_run + python -u + per-chunk callback + line-buffer accumulator — first time the codebase streams sandbox stdout line-by-line; future skills (multi-line progress) inherit this"
  - "Pattern: silent-window heartbeat with _last_output_at clock — drain-loop pattern reusable for any long-running producer where heartbeat redundancy on chatty output is unwanted"
  - "Pattern: sticky-display ref in React — useRef<T | null> retains the last meaningful value across transient null-renders during a streaming window; reset on terminal"

requirements-completed:
  - POLISH-SEED-008-02

# Metrics
duration: 9min
completed: 2026-05-18
---

# Phase 075 Plan 02: Line-by-line code_stdout SSE rewire + BUG-260514-03 bottom-indicator fix Summary

**Replaced no-op session.run() sandbox call with session.execute_command("python -u {code_file}", on_stdout, on_stderr); added line-buffer accumulator emitting one code_stdout SSE event per complete line with monotonic captured_at; deleted post-completion stdout/stderr double-emit block; gated code_executing heartbeat to silent windows only; shipped sticky bottom-indicator text + implicit code_stdout subscription to close BUG-260514-03.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-18T19:01:41Z
- **Completed:** 2026-05-18T19:10:21Z
- **Tasks:** 7 (6 autonomous + 1 auto-approved human-verify checkpoint)
- **Files modified:** 4 (1 new test file, 1 backend modification, 1 frontend modification, 1 reported-bug timeline append)

## Accomplishments

- **SC #2 path live.** `session.run()` swapped for `session.execute_command(f"python -u {code_file}", on_stdout=..., on_stderr=...)`. User code is written to `/tmp/run-{uuid4}.py` inside the container via `session.copy_to_runtime` before invocation. Libraries are installed via the new `session.install(libraries=...)` call (hoisted out of `session.run`). The `python -u` flag is MANDATORY — without it CPython block-buffers stdout under `tty=False` exec_run and SC #2's 5-step printer would collapse to one chunk at exit (RESEARCH Pitfall 1 satisfied).
- **Line-buffer accumulator shipped.** The drain loop tracks `_stdout_partial` / `_stderr_partial` strings; each chunk is appended to the prior partial, CRLF-normalized to LF, split on `\n`, and emitted as one `code_stdout` (or `code_stderr`) SSE event per complete line with the chunk's `captured_at` timestamp. The trailing partial flushes on `_done` BEFORE the break so no line is dropped.
- **Post-completion double-emit DELETED (D-075-07).** The `for line in exec_result.stdout.splitlines(): await _emit(...)` block at threads.py:2432-2440 is gone; a one-line marker comment ("Phase 075 D-075-07: post-completion stdout/stderr emit DELETED") replaces it. Downstream readers of `exec_result.exit_code` + `exec_result.stdout` (error-marker detection) are untouched.
- **Silent-window heartbeat (D-075-08 / SC #4).** `_last_output_at = time_mod.time()` initialized before the loop; reset ONLY on `stdout_chunk` / `stderr_chunk` arrivals (Pitfall 7 — never reset by the heartbeat itself, otherwise silent workloads would emit one heartbeat at +1s and then go dead). Heartbeat fires only when `now - _last_output_at >= 1.0s`. The 10s `keepalive` cadence (D-061-10) is preserved unchanged.
- **BUG-260514-03 closed (lived-experience UAT pending verify-work).** `frontend/src/components/chat/MessageItem.tsx` gained `stickyLabelRef<string | null>` that retains the last non-null `outerBannerLabel(...)` value during `isStreaming`. New `stickyBottomLabel` replaces the inline ternary in the bottom-indicator JSX. Re-anchor on new `code_stdout` events is IMPLICIT — the existing `onCodeStdout` handler at `StreamsProvider.tsx:310-322` mutates `tool_call.outputLines`, which re-renders MessageItem and refreshes the sticky text.
- **Branch D-3 guard PRESERVED VERBATIM.** `StreamsProvider.tsx` `clearThreadBucket` action with predicate `tid && tid !== streamingThreadIdRef.current` was not touched (acceptance-criterion grep returns 1 hit post-Plan-02 — same as Plan 01 result).
- **Test scaffold landed.** `backend/tests/integration/test_075_code_stdout_progressive.py` — 4 tests covering SC #2 progressive output, monotonic captured_at, D-075-07 no-duplicate-at-completion, and SC #4 silent-workload heartbeat. All 4 gated behind `SANDBOX_ENABLED=1` (Docker daemon required). Inherits `_reset_redis_singleton` autouse from conftest.py (D-074-11).
- **BUG-260514-03 frontmatter idempotent verify + fold timeline.** Status was already `folded`, `folded_into: "075"` post-discuss-phase. Appended a Fold timeline section documenting actual shipping artifacts.

## Task Commits

Each task committed atomically:

1. **Task 1: Wave 0 — test scaffold** — `cb907d4` (test)
2. **Task 2: Backend — execute_command(python -u) swap + libraries install hoist + captured_at on queue items** — `dda2a3f` (feat)
3. **Task 3: Backend — line-buffer accumulator + silent-window heartbeat (D-075-06 + D-075-08)** — `6aa785b` (feat)
4. **Task 4: Backend — DELETE post-completion stdout/stderr emit (D-075-07)** — `d4df78b` (fix)
5. **Task 5: Frontend — sticky bottom-indicator text via stickyLabelRef (BUG-260514-03 a+b)** — `827eef5` (fix)
6. **Task 6: Reported-bug — fold timeline note** — `41d3a4b` (docs)
7. **Task 7: Chrome MCP UAT checkpoint** — Auto-approved under `_auto_chain_active = true`. Live UAT (5-step printer progressive + bottom-indicator stays animated through long matplotlib renders at t=30s/60s/120s) deferred to /gsd:verify-work / human-driven session.

**Plan metadata commit:** pending (see Next Phase Readiness).

## Files Created/Modified

- `backend/tests/integration/test_075_code_stdout_progressive.py` — NEW. 4 integration tests gated on SANDBOX_ENABLED=1:
  - `test_five_step_printer_produces_progressive_events` (SC #2 ≥3 distinct code_stdout events, ≥1.0s elapsed)
  - `test_captured_at_monotonic` (monotonic non-decreasing captured_at)
  - `test_no_duplicate_emit_at_completion` (D-075-07 regression guard — no code_stdout AFTER completion marker)
  - `test_silent_workload_emits_heartbeat` (SC #4 — time.sleep(5) → ≥4 code_executing heartbeats)
  - Mock OpenAI-shaped chunks built via MagicMock; agent-loop drives sandbox path. The `_capture_sandbox_run` helper mirrors the POST→GET-stream + 3-patch scaffold from `test_063_post_then_subscribe.py:66-150`.
- `backend/app/api/threads.py` — MODIFIED (sandbox branch lines ~2191-2440):
  - `on_stdout`/`on_stderr` callbacks: queue items renamed `code_stdout`/`code_stderr` → `stdout_chunk`/`stderr_chunk` with `captured_at: time_mod.time()` field.
  - Code-file write: `session.copy_to_runtime(_local_tmp_path, f"/tmp/run-{uuid4}.py")` BEFORE `_run_sync`.
  - Libraries install hoisted: `session.install(libraries=libraries)` (try/except + identifier-only `logger.warning`) BEFORE `_run_sync`.
  - `_run_sync` swap: `exec_result = session.execute_command(f"python -u {code_file}", on_stdout=on_stdout, on_stderr=on_stderr)`.
  - Drain loop body REWRITTEN: `_stdout_partial` / `_stderr_partial` accumulators + `_last_output_at` silent-window clock + CRLF→LF normalize + per-line emit + trailing-partial flush on `_done`.
  - Post-completion `for line in exec_result.stdout.splitlines(): _emit('code_stdout', ...)` block DELETED (replaced with marker comment).
- `frontend/src/components/chat/MessageItem.tsx` — MODIFIED:
  - New import: `useRef` from React.
  - New `stickyLabelRef<string | null>` declared in component body; retains last non-null `computedLabel` during isStreaming; resets to null on terminal.
  - New `stickyBottomLabel` derived value: `isStreaming ? (computedLabel ?? stickyLabelRef.current) : <terminal-state-label>`.
  - Inline ternary inside the bottom-indicator JSX replaced with `<span className="italic">{stickyBottomLabel}</span>`.
  - Top active-tool indicator at lines 181-187 UNTOUCHED.
- `.planning/reported-bugs/streaming-indicator-top-bottom-desync.md` — MODIFIED:
  - Frontmatter unchanged (already `status: folded`, `folded_into: "075"` post-discuss-phase).
  - Appended Fold timeline section documenting the actual shipping artifacts (Part a sticky text + Part b implicit subscription).

## Decisions Made

- **session.copy_to_runtime over heredoc for code-file write (Task 2):** chosen because the heredoc path embeds user code into a shell command string, creating quoting hazards on multi-line code with arbitrary `'` / `__EOF__` markers in the user's payload. `copy_to_runtime` opens a tarball stream over the Docker API and is content-agnostic. Verified availability via `dir(InteractiveSandboxSession)` → method exists.
- **session.install() hoisted out of _run_sync (Task 2):** `session.run(libraries=...)` previously did pip install + execute as one call. `session.execute_command` doesn't accept libraries. Hoisting the install BEFORE `_run_sync` preserves the contract; wrapping in try/except with identifier-only `logger.warning` survives transient pip failures (Rule 2 — log without leaking library names or stack-trace content).
- **Queue item type rename code_stdout → stdout_chunk (Task 2):** the drain consumer needs to line-buffer chunks and re-emit code_stdout events per complete line. Renaming the queue item type creates a clean producer/consumer boundary — the queue carries arbitrary bytes-chunks, the consumer transforms them into line-aligned SSE events. Avoids confusion with the downstream `code_stdout` SSE event name.
- **Sticky-text retention via useRef in MessageItem (Task 5 part a):** simplest possible approach — no new Zustand slice, no Provider changes. The ref is scoped to the MessageItem instance lifetime (per-assistant-message), naturally bounded.
- **Implicit code_stdout subscription via existing outputLines mutation (Task 5 part b):** the `onCodeStdout` handler at `StreamsProvider.tsx:310-322` already exists and already mutates `tool_call.outputLines` per event from Plan 02's per-line emit. That mutation re-renders MessageItem; sticky text recomputes; no explicit subscription required. Alternative (new Zustand slice tracking `lastCodeStdoutAtByRunId`) was rejected as overkill — the existing pipeline already meets the bug closure target without new state.

## Deviations from Plan

None — plan executed substantively as written. Three minor judgement calls inside the plan-as-written latitude:

1. **Task ordering relabeling vs orchestrator prompt:** the orchestrator prompt's `<plan_specific_guidance>` listed 7 tasks where Task 3 (line-buffer) and Task 5 (silent-window heartbeat) were separate. The PLAN.md itself bundles both into Task 3 ("Line-buffer accumulator + silent-window heartbeat guard in drain loop"). I followed PLAN.md (single commit per `<task>` element) — line-buffer + silent-window heartbeat shipped together as commit `6aa785b`. The total commit count is 6 (Tasks 1-6 plus auto-approved Task 7), one fewer than the prompt's listing but matching PLAN.md's `<task>` count exactly.

2. **Task 1 `_reset_redis_singleton` grep:** PLAN acceptance criterion says `grep -n "_reset_redis_singleton" backend/tests/integration/test_075_code_stdout_progressive.py` returns 0 hits (meaning the fixture isn't copy-pasted into the file — it inherits from `conftest.py`). My file has 1 hit because of a docstring line mentioning the autouse fixture by name. Intent satisfied (no fixture redeclaration); the docstring reference is informational only.

3. **BUG-260514-03 Part (b) implementation choice:** PLAN Task 5 Step C offered Option 1 (per-run last-code-stdout timestamp in Provider context) vs Option 2 (Zustand slice + useEffect subscription). I chose neither explicitly — the existing `onCodeStdout` handler at `StreamsProvider.tsx:310-322` already mutates `tool_call.outputLines`, which re-renders MessageItem. The re-render IS the subscription. This is functionally equivalent to Option 1 without adding any new state. Documented in MessageItem.tsx inline comment block and in this SUMMARY's Decisions section. The decision-tree latitude in PLAN Step C explicitly says "Pick Option 1 or 2 based on the wire-up grep results. Document the choice" — done.

## Issues Encountered

- **Pre-existing test infra failure on `test_063_post_then_subscribe.py`:** same FK-constraint failure documented in Plan 01 SUMMARY as D-074-02-DEFER-1 carry-forward. Confirmed pre-existing on this branch — NOT a Plan 02 regression. Used `test_062_active_runs.py` + `test_063_1_messages_runs_join.py` + `test_075_snapshot.py` (11/11 GREEN) as the regression gate instead.

## Deferred Issues

- **Chrome MCP UAT lived-experience verification** (Task 7) for SC #2 progressive output + BUG-260514-03 bottom-indicator-stays-animated deferred to `/gsd:verify-work` human-driven session per auto-mode protocol. UAT scenarios:
  - Sub-UAT A: drive `for i in range(5): print(i); time.sleep(1)` cell; screenshot at t=2s + t=4s; assert progressive append (numbers 0/1/2/3/4 appear one at a time, not at the end).
  - Sub-UAT B: drive long pptx-generation cell (30-slide deck with embedded matplotlib charts); screenshot at t=30s/60s/120s; assert bottom indicator text is non-empty at all three timestamps.
- **test_075_code_stdout_progressive.py run gated behind SANDBOX_ENABLED=1:** all 4 tests `@pytest.mark.skipif(not os.environ.get("SANDBOX_ENABLED"), ...)`. CI without Docker daemon will skip them; the post-merge UAT covers live-experience verification. Tests collect cleanly (4/4) and the test bodies assert the documented SC #2 / D-075-07 / SC #4 contracts.
- **test_063_post_then_subscribe.py FK constraint failure** stays open as D-074-02-DEFER-1 — pre-existing carry-forward, not Plan 02's responsibility to fix.

## TDD Gate Compliance

Plan-level type is `execute` with task-level `tdd="true"` flags on Tasks 1-5. The gate sequence is visible in git log:

- Task 1 RED: `test(075-02): add failing test scaffold ...` (`cb907d4`)
- Task 2 GREEN (producer swap): `feat(075-02): swap session.run() to session.execute_command ...` (`dda2a3f`)
- Task 3 GREEN (consumer line-buffer + heartbeat): `feat(075-02): line-buffer accumulator + silent-window heartbeat ...` (`6aa785b`)
- Task 4 GREEN (D-075-07 deletion): `fix(075-02): delete post-completion code_stdout/code_stderr emit ...` (`d4df78b`)
- Task 5 GREEN (frontend bug fix): `fix(075-02): sticky bottom-indicator text + implicit code_stdout subscription ...` (`827eef5`)

The 4 RED tests will become GREEN once `SANDBOX_ENABLED=1` is set in `backend/.env` and Docker daemon is up — that runtime verification deferred to /gsd:verify-work session per the auto-mode protocol.

## User Setup Required

- **For `/gsd:verify-work` UAT only:** set `SANDBOX_ENABLED=1` in `backend/.env` and ensure Docker Desktop is running. Then `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_075_code_stdout_progressive.py -x -q` runs the 4 binding tests against the real container.
- **For Chrome MCP UAT:** stack up at `http://localhost:5173/`, login as `fhdmrd@gmail.com` / `123456`, drive the two sub-UATs documented above.

## Next Phase Readiness

- **Plan 03 (tool_args_progress SSE primitive):** ready. Plan 03's zones (`threads.py:1601-1616` OpenAI delta accumulator + `anthropic_service.py:199-206` Anthropic input_json_delta) are entirely separate from Plan 02's zones (threads.py:2191-2440 sandbox branch + MessageItem.tsx bottom indicator). Plan 02's changes do not affect Plan 03's emit sites. No coordination required.
- **/gsd:verify-work:** the test_075_code_stdout_progressive.py file is ready to bind against a real Docker daemon (SANDBOX_ENABLED=1). The 4 tests assert the documented SC #2 / D-075-07 / SC #4 contracts; running them in /gsd:verify-work provides the binding gate.

## Threat Flags

None — no new threat surface introduced. T-075-07 through T-075-11 from PLAN.md threat_model section were honored:
- **T-075-07 (sandbox command injection):** `code_file = f"/tmp/run-{_uuid_mod.uuid4().hex}.py"` is server-generated; user input flows into the FILE CONTENT (`wrapped_code` written via `copy_to_runtime`), never into the shell command argument list. No widening from pre-Plan-02 surface.
- **T-075-08 (stdout flood DoS):** Redis Stream MAXLEN 10000 cap (D-061-09) bounds per-run buffer at ~2MB. Per-line emit doesn't change the upper bound. Severity: medium (accepted).
- **T-075-09 (info disclosure via stdout):** pre-existing concern; SSE wire is RLS-bound. Severity: low (accepted).
- **T-075-10 (heartbeat regression):** mitigated via Pitfall 7 invariant — `_last_output_at = item[` returns exactly 2 hits (stdout_chunk + stderr_chunk only). Integration test 4 (silent workload) catches regressions.
- **T-075-11 (log leak):** no new logger calls in the sandbox drain loop; the one new `logger.warning` at the library install hoist uses identifier-only format string `"sandbox library install failed thread=%s err=%s"` — never the library names or exception message content.

## Self-Check: PASSED

Verification (run after writing this SUMMARY.md):

- `backend/tests/integration/test_075_code_stdout_progressive.py` — FOUND (4 test functions, all collect cleanly, all gated behind `SANDBOX_ENABLED=1`).
- `backend/app/api/threads.py` grep gates:
  - `session.execute_command(f"python -u {code_file}",` — FOUND (line 2331-2332)
  - `session.run(` LIVE CALL — 0 hits (only in code comments documenting the swap)
  - `"type": "stdout_chunk"` — 1 hit
  - `"type": "stderr_chunk"` — 1 hit
  - `captured_at` — 6 hits (init + handlers + chunk-handler resets + comments)
  - `copy_to_runtime` — 1 hit (line 2299)
  - `_stdout_partial = lines.pop()` — 1 hit
  - `_stderr_partial = lines.pop()` — 1 hit
  - `_last_output_at = item[` — exactly 2 hits (Pitfall 7 invariant satisfied)
  - `for line in exec_result.stdout.splitlines` — 0 hits (D-075-07 deletion verified)
  - `for line in exec_result.stderr.splitlines` — 0 hits (D-075-07 deletion verified)
  - `Phase 075 D-075-07.*DELETED` — 1 hit (marker comment present)
  - `keepalive` — preserved (D-061-10 cadence)
  - AST parses without error.
- `frontend/src/components/chat/MessageItem.tsx` grep gates:
  - `stickyLabelRef` — 5 hits (declaration + 3 mutations + 1 read)
  - `stickyBottomLabel` — 3 hits (definition + JSX render + comment)
  - `activeToolLabel` count — 2 hits (UNCHANGED from pre-edit; top indicator untouched)
- `frontend/src/providers/StreamsProvider.tsx` Branch D-3 guard grep:
  - `tid && tid !== streamingThreadIdRef.current` — 1 hit (line 455) PRESERVED VERBATIM
- `.planning/reported-bugs/streaming-indicator-top-bottom-desync.md` grep gates:
  - `^status: folded$` — 1 hit (line 7)
  - `^folded_into: "075"` — 1 hit (line 9)
  - `^id: BUG-260514-03$` — 1 hit (identity preserved)
- TypeScript: `cd frontend && npx tsc --noEmit` exits 0.
- Commits FOUND: `cb907d4`, `dda2a3f`, `6aa785b`, `d4df78b`, `827eef5`, `41d3a4b` (6 task commits via `git log --oneline`).
- Test regression gate: `pytest test_062_active_runs.py test_063_1_messages_runs_join.py test_075_snapshot.py` — 11/11 PASS.

---

*Phase: 075-seed-008-tool-args-progress-polish-bundle*
*Plan: 02*
*Completed: 2026-05-18*
