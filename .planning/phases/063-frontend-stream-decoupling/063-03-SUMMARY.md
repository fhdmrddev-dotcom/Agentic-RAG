---
phase: 063-frontend-stream-decoupling
plan: 03
subsystem: frontend-api
tags: [frontend, api-client, sse, types, hard-cutover, phase-063, stream-04, stream-02b]

# Dependency graph
requires:
  - phase: 062-replay-tail-api
    provides: GET /runs/{rid}/stream replay-tail consumer, GET /threads/{tid}/active-runs, DELETE /runs/{rid}, TERMINAL_TYPES wire-format invariants (D-062-05), 404 cross-user (D-062-12), 503 Redis-down disposition (D-062-13)
  - phase: 063-01
    provides: e2e Playwright spec stubs (063-refresh-mid-stream.spec.ts, 063-resume-failed.spec.ts) that exercise the postMessage + subscribeToRun + getActiveRuns + cancelRun chain Plan 04 will consume
  - phase: 063-02
    provides: backend POST /threads/{tid}/messages contract returning 201 JSON {message_id, run_id} that postMessage in this plan binds against; module-level event_consumer deletion in threads.py
provides:
  - "frontend/src/lib/api.ts::postMessage(threadId, content, options) → Promise<PostMessageResponse> matching the D-063-01 backend contract"
  - "frontend/src/lib/api.ts::subscribeToRun(runId, since, callbacks, signal?) → fetch+ReadableStream consumer of GET /runs/{rid}/stream with byte-identical wire format to the legacy POST-stream parser plus NEW 'error' (with payload) + 'cancelled' terminal branches"
  - "frontend/src/lib/api.ts::getActiveRuns(threadId, signal?) → Promise<ActiveRun[]> mirroring Phase 062 ActiveRunResponse"
  - "frontend/src/lib/api.ts::cancelRun(runId) → DELETE /runs/{rid}; idempotent with 404 swallowed"
  - "Three new exported types: PostMessageResponse, ActiveRun, StreamCallbacks"
  - "frontend/src/types/index.ts::Message extended with optional runId?: string and runStatus?: 'streaming' | 'completed' | 'failed' | 'cancelled' fields"
  - "Legacy streamMessage POST-and-stream-on-the-same-request orchestrator (~128 lines) physically deleted — no compat shim per RESEARCH Open Question #3"
affects: [063-04, 063-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bearer-authed SSE consumer via fetch + ReadableStream (NOT EventSource — WHATWG html#2177 forbids custom headers)"
    - "Single-responsibility callback bag (StreamCallbacks) replacing 28-positional-parameter orchestrator signature"
    - "Differentiated 4xx/5xx degradation: 404→run_not_found terminal, 503→streaming_unavailable terminal, all other non-OK→throw"
    - "Idempotent DELETE: 204 → ok, 404 → silently swallow (cross-tab Stop falls out for free)"
    - "options-object parameter pattern for postMessage (matches createThread but with named opts for forward-compat without positional bloat)"

key-files:
  created: []
  modified:
    - "frontend/src/types/index.ts (+4 lines net — runId? + runStatus? appended to Message)"
    - "frontend/src/lib/api.ts (+230/-79 lines net — 4 new functions + 3 new types added; legacy 128-line streamMessage orchestrator deleted)"

key-decisions:
  - "D-063-01 hard cutover honored — no compat shim, no @deprecated marker; physical deletion of streamMessage so callers in useMessages.ts intentionally break (Plan 04 owns the rewrite)"
  - "subscribeToRun parser body copied verbatim from legacy streamMessage's L137-220 to structurally guarantee wire-format byte-identity (D-062-05); only the terminal branches diverge (added 'error' with payload + 'cancelled')"
  - "options-object for postMessage instead of three positional params — leaves room for future fields (e.g. tools_override) without re-shuffling argument order; matches the zero-arg-bloat objective of decoupling"
  - "Comment-block copy edits (replaced literal 'streamMessage' text with 'legacy POST-stream' phrasing) — required to satisfy the plan's literal acceptance criterion `grep -c streamMessage frontend/src/lib/api.ts is exactly 0`. Architectural intent (breadcrumbs explaining the cutover) is preserved without a literal name reference"

patterns-established:
  - "Hard-cutover frontend rewrite: physically delete the legacy orchestrator, expose the new building blocks as separate exports, let the caller-of-record (useMessages.ts) intentionally break — the next plan in the wave fixes it. No compat shim, no deprecation noise."
  - "Bearer-authed SSE via fetch + ReadableStream as the canonical pattern when server requires JWT — explicit anti-pattern flag against EventSource lives in the function docstring."

requirements-completed:
  - STREAM-04
  - STREAM-02b

# Metrics
duration: 12min
completed: 2026-05-03
---

# Phase 063 Plan 03: Frontend API Layer for Run-Backed Streaming Summary

**Split the legacy `streamMessage` POST-and-stream-on-the-same-request orchestrator (~128 lines, 28 positional callback params) into four focused exports — `postMessage` (POST), `subscribeToRun` (GET stream), `getActiveRuns` (GET active list), `cancelRun` (DELETE) — and extended the `Message` type with `runId` + `runStatus` fields per D-063-04. Legacy orchestrator physically deleted; useMessages.ts intentionally left in a 16-error broken state for Plan 04 to fix.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-03 (worktree `agent-a713374cd1f1c4403`)
- **Completed:** 2026-05-03
- **Tasks:** 2
- **Files modified:** 2 (`frontend/src/types/index.ts`, `frontend/src/lib/api.ts`)
- **Files created:** 0

## Accomplishments

### Task 1 — Message type extension (D-063-04)

Added two optional fields to `Message` interface in `frontend/src/types/index.ts`:

```typescript
runId?: string
runStatus?: "streaming" | "completed" | "failed" | "cancelled"
```

Both optional (DB-loaded historical messages do not carry them). All four enum values land in this commit (no scope reduction to "streaming" only — Plan 04's reconcile + Resume code reads all four).

### Task 2 — api.ts split + legacy deletion

**Added:**

| Symbol | Type | Purpose |
| ------ | ---- | ------- |
| `PostMessageResponse` | interface | `{message_id, run_id}` shape returned by POST |
| `ActiveRun` | interface | `{run_id, started_at, status: 'streaming'}` per D-062-02 |
| `StreamCallbacks` | interface | Callback bag — replaces 28-positional-param signature |
| `postMessage` | async function | POST /threads/{tid}/messages → `PostMessageResponse` |
| `subscribeToRun` | async function | GET /runs/{rid}/stream → dispatches SSE events to callbacks |
| `getActiveRuns` | async function | GET /threads/{tid}/active-runs → `ActiveRun[]` |
| `cancelRun` | async function | DELETE /runs/{rid} (idempotent) |

**Deleted:**

- The entire `streamMessage(threadId, content, onDelta, onDone, ...26 more params)` function (~128 lines, formerly api.ts L97-224). Per D-063-01 hard cutover + RESEARCH Open Question #3 (no compat shim).

**Line-count delta:** `frontend/src/lib/api.ts` `+230/-79` net. The 230 additions cover four new functions, three new exported types, and Phase-063 module header comment block; the 79 deletions are the chunks of `streamMessage` that the Edit tool's hunking saw as removable.

### subscribeToRun TERMINAL_TYPES handling (verbatim excerpt)

Per the plan's `<output>` requirement, paste of the terminal-event handling section:

**HTTP-level pre-stream (api.ts:229-237):**

```typescript
if (res.status === 404) {
  callbacks.onTerminal("error", "run_not_found")
  return
}
if (res.status === 503) {
  callbacks.onTerminal("error", "streaming_unavailable")
  return
}
if (!res.ok) throw new Error(`Failed to open run stream (status ${res.status})`)
```

**SSE-event terminal branches inside the parser loop (api.ts:307-322):**

```typescript
} else if (t === "done") {
  if (!doneFired) {
    doneFired = true
    callbacks.onDone()
  }
} else if (t === "suggestions" && callbacks.onSuggestions) {
  callbacks.onSuggestions((parsed.questions ?? []) as string[])
} else if (t === "stream_end") {
  callbacks.onTerminal("done")
  return
} else if (t === "error") {
  callbacks.onTerminal("error", parsed.error as string | undefined)
  return
} else if (t === "cancelled") {
  callbacks.onTerminal("cancelled")
  return
}
```

**Reader-closed defensive terminal (api.ts:339-340):**

```typescript
// Defensive: reader closed without explicit terminal SSE event.
callbacks.onTerminal("done")
```

The `error` (with payload) and `cancelled` branches are NEW vs the legacy parser; everything else is byte-identical for wire-format compat per D-062-05.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Message type with runId + runStatus** — `4678056` (`feat`)
2. **Task 2: Split streamMessage into 4 functions; delete legacy POST-stream** — `7722080` (`feat`)

## Files Created/Modified

- `frontend/src/types/index.ts` — `+4 lines`. Two field declarations (`runId?: string`, `runStatus?: "streaming" | ...`) with JSDoc comments referencing D-063-04 + RESEARCH Open Question 2. Inserted immediately after the existing `stopped?: boolean` field (which is preserved verbatim).
- `frontend/src/lib/api.ts` — `+230/-79 net`. Logical edits: (1) imports already had `OutputFile, SourceReference, Citation` so no import-block change needed; (2) `streamMessage` function body L97-224 replaced with a Phase-063 module header comment, three new `export interface` declarations, four new `export async function` declarations.

## Verification

### Hard counts (`grep`)

```bash
# Functions/types — target 1 each:
grep -c '^export async function postMessage'        frontend/src/lib/api.ts  # → 1
grep -c '^export async function subscribeToRun'     frontend/src/lib/api.ts  # → 1
grep -c '^export async function getActiveRuns'      frontend/src/lib/api.ts  # → 1
grep -c '^export async function cancelRun'          frontend/src/lib/api.ts  # → 1
grep -c '^export interface PostMessageResponse'     frontend/src/lib/api.ts  # → 1
grep -c '^export interface ActiveRun'               frontend/src/lib/api.ts  # → 1
grep -c '^export interface StreamCallbacks'         frontend/src/lib/api.ts  # → 1

# streamMessage residuals — target 0 each:
grep -c '^export async function streamMessage'      frontend/src/lib/api.ts  # → 0
grep -c streamMessage                                frontend/src/lib/api.ts  # → 0

# Terminal branches:
grep -cE 'onTerminal\(.cancelled.\)'                 frontend/src/lib/api.ts  # → 2 (one in subscribeToRun, plus one in module-doc comment)
grep -cE 'onTerminal\(.error.,\s*parsed\.error'     frontend/src/lib/api.ts  # → 1

# DELETE method count — target >= 2 (cancelRun + existing deleteThread):
grep -cE 'method:\s*"DELETE"'                        frontend/src/lib/api.ts  # → 6 (cancelRun + 5 pre-existing DELETE callers)

# URL pattern (must_haves key_link) checks:
grep -cE '/runs/\$\{runId\}/stream'                  frontend/src/lib/api.ts  # → 1
grep -cE '/threads/\$\{threadId\}/active-runs'      frontend/src/lib/api.ts  # → 1

# Combined exports — target 7 (success_criteria final check):
grep -cE '^export (async function|interface) (postMessage|subscribeToRun|getActiveRuns|cancelRun|PostMessageResponse|ActiveRun|StreamCallbacks)' frontend/src/lib/api.ts  # → 7

# Type extensions:
grep -cE 'runId\?:\s*string'                          frontend/src/types/index.ts  # → 1
grep -cE 'runStatus\?:.*"streaming".*"completed".*"failed".*"cancelled"' frontend/src/types/index.ts  # → 1
grep -c 'export interface Message'                    frontend/src/types/index.ts  # → 1
grep -c 'stopped\?:'                                  frontend/src/types/index.ts  # → 1 (preserved)
```

All hard counts match plan acceptance criteria.

### Type-check (`tsc --noEmit -p tsconfig.app.json`)

Targeted to plan-relevant files (per scope-boundary rule, pre-existing errors in unrelated test files / FolderNode / SettingsPage are out of scope):

| File                          | Errors | Target |
| ----------------------------- | ------ | ------ |
| `src/types/index.ts`          | **0**  | 0      |
| `src/lib/api.ts`              | **0**  | 0      |
| `src/hooks/useMessages.ts`    | **16** | ≥ 1 (expected) |

The 16 errors in `useMessages.ts` are exactly the plan's `<expected_failure>`:

- 1× `TS2305 Module '"../lib/api"' has no exported member 'streamMessage'` (line 3 import) — proves hard cutover took effect
- 15× `TS7006 Parameter '...' implicitly has an 'any' type` cascading from the broken signature in the `await streamMessage(...)` call site (lines 121-310) — Plan 04 fixes by rewriting the hook to call `postMessage(...) → subscribeToRun(...)` separately

### useMessages.ts error reference target for Plan 04

Plan 04 must reduce `src/hooks/useMessages.ts` errors from **16 → 0**. The 16 baseline is documented here so Plan 04 has a precise GREEN target (any residual implicit-any errors after Plan 04's hook rewrite indicate incomplete typing of the new callback bag).

## Decisions Made

- **Comment-text rewrite to satisfy literal acceptance criterion.** The plan's success criteria #2 says `grep -c streamMessage frontend/src/lib/api.ts is exactly 0`. My initial implementation kept seven historical breadcrumbs ("the legacy `streamMessage` orchestrator…") inside the new module header / function docstrings. Those breadcrumbs were valuable but tripped the literal criterion. I rewrote them to use generic phrasing ("the legacy POST-stream orchestrator", "previous parser") which preserves the architectural breadcrumb without the literal name. Architectural intent (explaining the cutover to future readers) is intact.
- **Verbatim parser-body copy.** The 100+ lines of SSE-event dispatch logic in `subscribeToRun` were copied byte-for-byte from the legacy `streamMessage` parser (formerly api.ts L137-220). Only the terminal-event branches diverge: legacy parser had `done`, `stream_end` (returns), and "ignore everything else"; new parser keeps those plus adds `error` (with payload extraction) and `cancelled` (Phase 062 TERMINAL_TYPES). This guarantees wire-format byte-identity (D-062-05 invariant) at the source-code-structural level — any future parser drift would diff the two halves, not introduce a parser the backend never serialized.
- **options-object parameter for `postMessage`.** Plan-suggested signature was `postMessage(threadId, content, options = {})` rather than three positional `(threadId, content, model, provider, agentMode)`. This means future fields (e.g. tools_override, agent flags) can be added to options without forcing every caller-of-record to update positional argument order. Mirrors the createThread → `(title, folderId)` shape but with a typed options bag.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment-text rewrite for `streamMessage` residual**

- **Found during:** Task 2 acceptance verification.
- **Issue:** Initial Task 2 implementation included seven historical breadcrumb comments referencing the literal word `streamMessage` (e.g. "Mirrors the legacy `streamMessage` callback signature…"). The plan's success criterion `grep -c streamMessage frontend/src/lib/api.ts is exactly 0` would have failed with count 7.
- **Fix:** Rewrote each occurrence to use generic phrasing ("the legacy POST-stream orchestrator", "previous parser") that preserves the architectural breadcrumb without the literal name. No structural code change; no semantic change to function behavior.
- **Files modified:** `frontend/src/lib/api.ts` (5 single-line comment edits inside the same file as Task 2's main edit).
- **Committed in:** Same commit as Task 2 main edit (`7722080`) — the cleanup landed before the commit was authored; no separate fix commit.
- **Verification:** Post-edit `grep -c streamMessage frontend/src/lib/api.ts` → 0.

---

**Total deviations:** 1 auto-fixed (Rule 1 — literal acceptance-criterion compliance, no architectural impact).

## Issues Encountered

- **Worktree had no `node_modules`** for tsc verification. Resolved by creating an NTFS junction from the worktree's `frontend/node_modules` to the main repo's `frontend/node_modules` via PowerShell `New-Item -ItemType Junction`. This made `./node_modules/.bin/tsc` invocable from the worktree without npm install. The junction is excluded from git (existing `frontend/node_modules` gitignore rule) so it has no commit footprint.
- **Plan acceptance-criteria URL regex was unmatchable** as written. The plan listed `grep -cE 'fetch\(.*\$\{API_BASE\}/runs/\$\{runId\}/stream\?since=' is >= 1` as an acceptance criterion. The plan's own provided code (action block §D, lines 273-277) factors the URL into a `const url = ...` separate from the `fetch(url, {...})` call, so the regex would never match. The structural intent — that the URL has the right shape — is verified instead via the must_haves `key_link` pattern `/runs/\${runId}/stream` (count: 1, matches). Documented for posterity; no code change needed since the plan-provided code is what shipped.

## Deferred Items

None — all in-scope work landed in the two task commits.

## User Setup Required

None — no external services configured, no env-var changes, no migrations.

## Next Phase Readiness

- **063-04 (hook + components rewrite)** is unblocked: the 4 functions + 3 types are exported and type-checked; the hook can `import { postMessage, subscribeToRun, cancelRun, getActiveRuns, type StreamCallbacks } from "../lib/api"` and rewrite `sendMessage` as a `postMessage(...) → subscribeToRun(...)` chain. The Resume button can read `message.runStatus === 'failed'` from the extended Message type. Cross-tab Stop falls out for free via `cancelRun(runId)`.
- **063-05 (legacy test rewrite)** has its first concrete frontend-side input: the legacy `streamMessage` is gone, so any frontend test mocking it needs to be rewritten against the new four-function surface. (Plan 05's audit document from 063-01 is backend-focused; if any frontend tests existed for `streamMessage` they would surface during Plan 05.)

## Self-Check: PASSED

**Files verified to exist (post-write):**

- `frontend/src/types/index.ts` (modified, runId + runStatus present) — FOUND
- `frontend/src/lib/api.ts` (modified, 7 new exports + 0 streamMessage references) — FOUND
- `.planning/phases/063-frontend-stream-decoupling/063-03-SUMMARY.md` (this file) — FOUND

**Commits verified to exist:**

- `4678056` (feat(063-03): extend Message type with runId + runStatus (D-063-04)) — FOUND in `git log`
- `7722080` (feat(063-03): split streamMessage into 4 functions; delete legacy POST-stream (D-063-01)) — FOUND in `git log`

**Plan success criteria all met:**

- Combined exports = 7 (target 7) ✓
- `streamMessage` references in api.ts = 0 (target 0) ✓
- `src/lib/api.ts` tsc errors = 0 (target 0) ✓
- `src/types/index.ts` tsc errors = 0 (target 0) ✓
- `src/hooks/useMessages.ts` tsc errors = 16 (target ≥ 1, expected — Plan 04 fixes) ✓

---

*Phase: 063-frontend-stream-decoupling*
*Plan: 03 (Wave 2)*
*Completed: 2026-05-03*
