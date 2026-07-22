---
phase: 176-chat-render-correctness-exec-reliability
reviewed: 2026-07-22T21:27:49Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/services/tool_dispatcher.py
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/stores/streamsStore.ts
  - frontend/src/pages/SkillStudioPage.tsx
  - frontend/src/pages/SkillTunerPage.tsx
  - frontend/src/components/skills/studio/TriggeringTab.tsx
  - frontend/src/components/skills/studio/VersionsTab.tsx
  - backend/tests/unit/test_tool_dispatcher.py
  - frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx
  - frontend/src/__tests__/providers/streamsProvider_bug_260707_03_final_answer_resolve.test.tsx
  - frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx
  - frontend/src/components/chat/__tests__/MessageInputDrafts.test.tsx
  - frontend/src/pages/SkillStudioPage.test.tsx
  - frontend/src/components/skills/studio/VersionsTab.test.tsx
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
findings_open:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: fixed
resolution: "CR-01 + WR-01 + WR-02 fixed via /gsd:code-review 176 --fix (2026-07-23). 4 Info findings remain as advisory."
fix_commits:
  - "7098cd0b — CR-01 bound heal re-run + pip installs by the execute_code wall-clock abort"
  - "b946cac8 — WR-01 dedup optimistic user temp by message_id identity, not cross-clock timestamp"
  - "41097139 — WR-02 healed re-run output is the output of record on the live code card"
---

# Phase 176: Code Review Report

**Reviewed:** 2026-07-22T21:27:49Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** fixed (Critical + Warning resolved; 4 Info advisory)

## Resolution (2026-07-23)

The Critical Blocker and both Warnings were fixed and re-verified green
(backend `test_tool_dispatcher.py` 31/31; frontend touched suite 42/42):

- **CR-01 (Critical) → fixed** `7098cd0b` — new `_run_bounded_sandbox` helper
  routes the auto-heal re-run **and** both pip-install paths through the same
  wall-clock abort the primary run uses (`asyncio.wait` + container `kill_session`
  on overrun, `abandon_on_cancel=False`-safe), returning an honest
  `install_failed` instead of wedging the run. Closes the re-opened zombie-run risk.
- **WR-01 (Warning) → fixed** `b946cac8` — RENDER-01 dedup now keys on
  `registeredUserMsgId` (message_id identity), not a skew-fragile cross-clock
  `created_at >=`. Masking 2099-timestamp test rewritten to exercise the skew case.
- **WR-02 (Warning) → fixed** `41097139` — the healed run's stdout/stderr is now
  the output of record on the live code card (`healed` marker on the completion
  event replaces the stale pre-heal error). Live per-line streaming of the re-run
  deferred as disproportionate machinery (persisted result was already correct).

**Still open (advisory, not fixed):** the 4 Info findings (IN-01 Redis TTL leak on
EXPIRE-after-SADD, IN-02 arbitrary import-name install / import≠package mismatch,
IN-03 mislabeled `install_failed.reason` on already-attempted, IN-04 unconditional
`versionsNonce` bump).

## Summary

Phase 176 bundles four seams: (RENDER-01/02) StreamsProvider render-correctness
(content-supersede drop for user temps + mount-path un-fold), (RENDER-03) a
no-silent-send-drop honesty path in ChatArea + streamsStore + StreamsProvider,
(EXEC-01) a hardened declared-library install + bounded run-scoped ModuleNotFound
auto-heal in tool_dispatcher, and (RENDER-04) live version-pointer refetch across
the Skill Studio shell.

The frontend render/send-drop changes are additive, well-guarded (`is not None` /
`sendInFlightOnThisThread` composition), and thoroughly tested. The Skill Studio
refetch wiring is clean and low-risk. The **one BLOCKER is in the EXEC-01 auto-heal**:
the heal re-run of user code (and the pip installs) bypass the *only* wall-clock
protection `execute_code` has, re-opening the exact runaway-container "zombie run"
failure mode (SEED-063 / 096 UAT Test 3) that the codebase explicitly fixed. Two
WARNINGs concern render-honesty: a clock-skew hole in the user-temp dedup that can
re-introduce the duplicate user bubble RENDER-01 set out to kill, and the healed
re-run's output never reaching the live code card.

No `provider ==` fork was introduced anywhere (D-14 respected), and every new
StreamsProvider branch is guarded so the shared render path stays intact for the
non-fresh / non-heal cases (G-5 respected).

## Critical Issues

### CR-01: Auto-heal re-run and pip installs bypass the execute_code wall-clock abort — re-opens the runaway "zombie run"

**File:** `backend/app/services/tool_dispatcher.py:3032` (re-run) + `:1740` / `_pip_install` `:1489-1500`
**Issue:**
The primary run's runaway protection is the 096/SEED-063 wall-clock abort inside the
drain loop (`:1784-1823`): on `elapsed > _exec_timeout_s` it kills the container
(`kill_session`), emits an honest `[execution aborted…]` completion, and returns a
`124` tool-result so "a runaway / non-terminating script must not wedge the run
forever … never a 40-minute zombie."

The new heal path bypasses this entirely. `_autoheal_missing_module` re-runs the
(now-importable) user code with **no timeout, no heartbeat, no container-kill on
overrun**:

```python
new_result = await run_in_threadpool(session.execute_command, f"python -u {code_file}")
```

`session.execute_command` is a blocking call in a threadpool thread that cannot be
cancelled. There is no `asyncio.timeout` around `dispatch_tool` in the agent loop
(`agent_loop.py:2580` — the only `asyncio.timeout` at `:514` wraps the *LLM stream
drain*, not tool dispatch), so nothing backstops a hung heal re-run. A script such as
`import fpdf2\nwhile True: pass` fails the first run at import (ModuleNotFound, before
the loop), the heal installs `fpdf2`, then the re-run reaches the infinite loop and
wedges the run until the container's own eventual death / 30-min idle eviction — the
precise zombie the phase's own guard was built to prevent. The declared-install
(`:1740`) and heal-install (`_pip_install`) threadpool calls share the same
no-timeout exposure (a hung `pip install` network stall wedges identically).

Secondary effects on the same path: the re-run emits no `code_executing` /
`keepalive` heartbeats, so even a legitimately slow-but-terminating healed run is
dead-air on the code card (the very silence the SAND fix removed for the first run).

**Fix:** Route the heal re-run (and, ideally, the pip installs) through the same
wall-clock abort the first run uses — e.g. wrap the threadpool call with
`asyncio.wait_for(..., timeout=settings.sandbox_exec_timeout_seconds)` and, on
`TimeoutError`, `kill_session` + emit the honest aborted-completion + return the
`124` error result, instead of re-running under a bare, uncancellable
`run_in_threadpool`. Minimum viable fix (bound the hang + free the container):

```python
try:
    new_result = await asyncio.wait_for(
        run_in_threadpool(session.execute_command, f"python -u {code_file}"),
        timeout=settings.sandbox_exec_timeout_seconds
        if settings.sandbox_exec_timeout_seconds > 0 else None,
    )
except asyncio.TimeoutError:
    await run_in_threadpool(sandbox_manager.kill_session, ctx.thread_id)
    return {"install_failed": _install_failed_detail(
        module, "installed, but the re-run exceeded the execution time limit and was aborted.")}
```

## Warnings

### WR-01: RENDER-01 user-temp dedup relies on cross-clock `created_at` comparison — duplicate user bubble under client-ahead clock skew

**File:** `frontend/src/providers/StreamsProvider.tsx:1503-1511`
**Issue:**
The content-supersede drop keeps/drops the optimistic user temp with:

```js
const supersededByPersisted = snapshot.messages.some(
  (s) => s.role === "user" && s.content === m.content &&
         !s.id.startsWith("temp-") &&
         new Date(s.created_at) >= new Date(m.created_at),
)
return sendInFlightOnThisThread && !supersededByPersisted
```

`m.created_at` is the temp's **client** clock (`new Date().toISOString()` at
`:1871`); `s.created_at` is the persisted row's **server** clock. Comparing them with
`>=` is skew-fragile: if the client clock runs ahead of the server by more than the
send round-trip (a common few-seconds skew), the genuine twin's server timestamp is
*less* than the temp's client timestamp → `supersededByPersisted` is false → both the
temp and the persisted row render = the duplicate user bubble RENDER-01 exists to
prevent, and it persists until a full reload. (The mirror case — client behind — can
prematurely drop the fresh temp against an older identical-content row, though that
self-heals once the real twin persists.)

The reconcile-race test masks this: it hardcodes `created_at: "2099-01-01T00:00:00Z"`
(`streamsProvider_075_7_reconcile_race.test.tsx:358`) so the guard always passes —
the realistic near-equal / skewed timestamp case is never exercised.

Also fragile: `s.content === m.content` is an exact-match; any backend
trim/normalization of user content on persist would break the dedup permanently
(temp never drops).

**Fix:** Don't dedup on a cross-clock inequality. Prefer identity: once `postMessage`
returns `{ message_id }`, drop the temp when the snapshot contains that exact
`message_id` (stamp `registeredUserMsgId` on the temp and match on it). If a
timestamp guard is retained to reject prior-turn twins, add a tolerance window and/or
gate on the returned `message_id` rather than raw `>=`.

### WR-02: Healed re-run output is never streamed — live code card shows the pre-heal error text under a success badge

**File:** `backend/app/services/tool_dispatcher.py:1893-1906` (adopt heal result) + `:3032` (re-run has no `on_stdout`/`on_stderr`)
**Issue:**
On a successful heal, `exec_result` is swapped for the re-run's result and
`actual_exit_code` becomes 0, but the re-run is executed **without** the
`on_stdout`/`on_stderr` callbacks that feed `code_stdout` / `code_stderr` SSE. The
drain loop already broke on the first run's `_done`, so the only thing the live
surface streamed is the *first* run's `ModuleNotFoundError` stderr. After heal,
`code_execution_complete` is emitted with `exit_code=0` but carries no stdout, so the
live code card renders the pre-heal error text next to a green success badge; the
actual healed stdout only appears in the persisted `tool_result` on
reconcile/reload. For a phase whose charter is chat-render correctness, this is a
visible honesty gap in the live moment.

**Fix:** Either stream the heal re-run through the same drain/`on_stdout`/`on_stderr`
pipeline as the first run (so the card reflects the healed output live), or, at
minimum, on a successful heal emit a corrective `code_stdout` with the healed
`exec_result.stdout` (and clear/replace the stale error text) before the
`code_execution_complete`, so the streamed view matches the persisted result.

## Info

### IN-01: `_heal_bound_record` can leave `heal_attempted:{run_id}` without a TTL

**File:** `backend/app/services/tool_dispatcher.py` (`_heal_bound_record`, ~`:2967-2982`)
**Issue:** `await redis.sadd(key, module)` then `await redis.expire(key, _HEAL_BOUND_TTL_S)`.
If `sadd` succeeds but `expire` raises, the `except` falls to the call-local set — but
the Redis key now exists with **no expiry** and leaks (bounded by unique run_ids, so
low impact). **Fix:** Use `SADD` with a follow-up `EXPIRE ... NX`, or set the TTL in
the same pipeline/atomic step, and treat a partial failure as "clear the key" rather
than leaving it un-expiring.

### IN-02: Auto-heal assumes import-name == pip-package-name and auto-installs arbitrary import-derived names

**File:** `backend/app/services/tool_dispatcher.py:3015-3035`
**Issue:** The heal installs the *import* name captured from `ModuleNotFoundError`
(`_extract_missing_module`). For the common import≠package packages (`PIL`/Pillow,
`cv2`/opencv-python, `sklearn`/scikit-learn, `bs4`/beautifulsoup4, `Crypto`/pycryptodome)
the install either fails or pulls a wrong-but-real package, then re-run still fails and
surfaces the honest `install_failed` — correct, but a wasted install. Separately, a
typo'd import (`reqeusts`) triggers `pip install reqeusts`, enabling a typosquat pull.
Blast radius is contained to the already-arbitrary-code Docker sandbox, so this is not
a new privilege, but it lowers the bar from "explicitly declared libraries" to "any
mistyped import." **Fix:** Consider a small import-name→package-name alias map for the
known mismatches, and/or restrict auto-heal to a curated allowlist of installable
packages rather than any regex-matched import name.

### IN-03: `install_failed.reason` mislabels the already-attempted-module path with declared-install stderr

**File:** `backend/app/services/tool_dispatcher.py:3007-3010`
**Issue:** When `_heal_bound_seen` is true, the honest note is built with
`_install_failed_detail(module, declared_install_stderr or "Already attempted…")`. The
`declared_install_stderr` describes the *declared libraries*, not the heal-attempted
`module`, so the model-facing `reason` can attribute an unrelated declared-install
error to this module. **Fix:** For the already-attempted branch, use the fixed
"Already attempted to install this module earlier in this run…" string unconditionally
(don't fall back to `declared_install_stderr`).

### IN-04: `refreshVersions` bumps `versionsNonce` unconditionally (not skill-switch-guarded)

**File:** `frontend/src/pages/SkillStudioPage.tsx` (`refreshVersions`, ~`:120-136`)
**Issue:** `setVersions` is guarded by `currentSkillRef.current === requested`, but
`setVersionsNonce((n) => n + 1)` fires unconditionally. If the user switches skills
between an approve and the refetch resolving, the nonce still bumps and forces the new
skill's `VersionsTab` to re-run its self-fetch. Harmless (a redundant refetch of the
correct, current skill), but inconsistent with the guarded `setVersions`. **Fix:**
Move the nonce bump inside the `then`/guard, or leave as-is and note the redundant
refetch is intentional.

---

_Reviewed: 2026-07-22T21:27:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
