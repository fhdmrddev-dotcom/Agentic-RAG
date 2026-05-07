---
phase: 067
plan: 01
subsystem: frontend-streaming
tags: [state-machine, sse, race-condition, react-hooks, ux-polish]
dependency_graph:
  requires:
    - "Phase 063.1 D-063.1-08 (guardedSetMessages)"
    - "Phase 063.1 D-063.1-09 (lastSeenOffsetRef cursor cache)"
    - "Phase 063.1 D-063.1-11 (reconcileInFlightRef boolean lock)"
    - "Phase 063.1 D-063.1-12 (loadMessages MERGE-preserve filter)"
    - "Phase 063.1 BL-03 (subscriptionsRef cleanup ordering)"
  provides:
    - "D-067-01 deterministic POST→subscribe handoff (subscription slot reserved BEFORE runId-stamping setMessages)"
    - "D-067-02 existence-checked terminal flips (sendMessage + reconcile)"
    - "D-067-02 banner-copy-only-on-terminal (no 'Saving response…' fallback)"
  affects:
    - "frontend/src/hooks/useMessages.ts — sendMessage POST→subscribe handoff window"
    - "frontend/src/hooks/useMessages.ts — sendMessage onTerminal terminal flip"
    - "frontend/src/hooks/useMessages.ts — reconcile onTerminal terminal flip"
    - "frontend/src/components/chat/MessageItem.tsx — hasAnyTools branch banner ternary"
    - "frontend/src/types/index.ts — stale JSDoc reference cleanup"
tech_stack:
  added: []
  patterns:
    - "Existence-check guard before setMessages map: `prev.some((m) => m.id === <id>) ? prev.map(...) : prev` (avoids array realloc + React reconcile when target absent)"
    - "Subscription slot reservation BEFORE state mutation (mirrors WR-06 reconcile pattern at line 769)"
key_files:
  created:
    - ".planning/phases/067-frontend-streaming-ux-fix/067-01-SUMMARY.md"
  modified:
    - "frontend/src/hooks/useMessages.ts"
    - "frontend/src/components/chat/MessageItem.tsx"
    - "frontend/src/types/index.ts"
decisions:
  - "D-067-01 architectural cleanup delivered as audit-comment + 2-line reorder (no extraction to a separate hook); diff stayed well under the ~150 LOC split threshold."
  - "D-067-02 mirrored existence-check guards in BOTH sendMessage and reconcile terminal-flip blocks; reconcile path preserves asymmetric NO `stopped: true` (intentional — re-attaches mid-run)."
  - "Pure-React state guard, no new tampering surface — STRIDE T-067-01-01..04 dispositions accept (no new auth/network surface) or mitigate (DoS via wasted reconcile work; race via reorder)."
  - "Stale JSDoc in types/index.ts:93 referencing the deleted 'Saving response…' string updated as Rule 1 deviation (factually incorrect comment now points at D-067-02)."
metrics:
  duration: "6min"
  completed_date: "2026-05-07"
---

# Phase 67 Plan 01: State Machine Cleanup Summary

Pulled SSE attach + optimistic placeholder insertion + reconcile-on-mount into one well-ordered React state machine: audit comment + 2-line POST→subscribe reorder + existence-checked terminal flips + deletion of "Saving response…" fallback.

## Tasks Completed

### Task 1: Audit + reorder POST→subscribe handoff (D-067-01)

**Commit:** `a83479d` — `refactor(067-01): audit + reorder POST→subscribe handoff (D-067-01)`

- Inserted audit comment block at `frontend/src/hooks/useMessages.ts:500-516` documenting the FIVE setMessages call sites in the first-paint window with guard rationale (optimistic user/assistant inserts, runId stamp + temp-id swap, terminal-flip override, finally cleanup).
- Reordered `subscriptionsRef.current.set(run_id, controller)` to fire BEFORE the runId-stamping setMessages: was at line 521 (after setMessages); now at line 525 (after the new comment block, BEFORE the setMessages at line 533-540 in current source). The awk gate confirms the reorder structurally — `set` prints (not `setMessages`) when scanning forward from `registeredRunId = run_id`.
- Mirrors the SAME ordering pattern reconcile uses at line 815 (WR-06 fix: "RESERVE the subscription slot BEFORE firing subscribeToRun").
- Closes the only remaining race window where ChatArea's four reconcile triggers (`mount/visibilitychange/focus/pageshow` at ChatArea.tsx:163-188) could fire `loadMessages` AND a parallel `subscribeToRun` against the same run before sendMessage's own subscribeToRun is wired up.
- Phase 063.1 D-063.1-08 `guardedSetMessages` declaration intact (1 occurrence).
- Phase 063.1 D-063.1-11 `reconcileInFlightRef` intact (5 occurrences).
- Phase 063.1 D-063.1-09 `lastSeenOffsetRef` intact (6 occurrences).
- Reconcile's WR-06 `const controller = new AbortController()` immediately preceding `subscriptionsRef.current.set(run.run_id, controller)` byte-identical (1 occurrence).

### Task 2: Guard terminal-flip in sendMessage onTerminal (D-067-02)

**Commit:** `51f4a9d` — `fix(067-01): guard sendMessage terminal-flip with existence check (D-067-02)`

- Wrapped sendMessage's onTerminal `setMessages` updater at `frontend/src/hooks/useMessages.ts:599-610` in `prev.some((m) => m.id === assistantId) ? prev.map(...) : prev` existence-check guard.
- If a thread switch + reconcile collapsed the placeholder via Phase 063.1 D-063.1-12 MERGE-preserve filter or D-063.1-04 runId-match DB-row swap, the terminal flip is now a no-op (no array realloc, no React reconcile) AND the next reconcile picks up the DB-row runStatus via D-063.1-13/15 LEFT JOIN.
- Phase 063.1 BL-03 cleanup ordering preserved: `subscriptionsRef.current.delete(registeredRunId)` STILL appears BEFORE `originalOnTerminal(kind, errorPayload)` (verified by reading lines 612-621).

### Task 3: Guard terminal-flip in reconcile onTerminal (D-067-02 mirrored)

**Commit:** `ee603ff` — `fix(067-01): guard reconcile terminal-flip with existence check (D-067-02)`

- Wrapped reconcile's onTerminal `setMessages` updater at `frontend/src/hooks/useMessages.ts:843-855` in `prev.some((m) => m.id === targetId) ? prev.map(...) : prev` existence-check guard.
- Mirrors Task 2 — but on the reconcile path uses the dedup-resolved `targetId` from D-063.1-04 instead of `assistantId`.
- Asymmetric NO `stopped: true` on cancelled/timed_out branches preserved verbatim (reconcile re-attaches to a possibly-not-yet-stopped run; adding `stopped: true` would mis-render mid-stream).
- Phase 063.1 D-063.1-09 `lastSeenOffsetRef.current.set(run.run_id, msId)` cursor advancement intact (1 occurrence).
- Phase 063.1 D-063.1-11 `reconcileInFlightRef` lock pattern unchanged.
- Reconcile for-loop body byte-identical except for the targeted existence-check wrap (Pitfall 1 hygiene satisfied — diff is the 9-line wrap + 4-line comment).

### Task 4: Delete "Saving response…" fallback in MessageItem.tsx (D-067-02)

**Commit:** `0936772` — `fix(067-01): delete "Saving response…" fallback from MessageItem (D-067-02)`

- Replaced inner-ternary fallback at `frontend/src/components/chat/MessageItem.tsx:140` from `: "Saving response…"` to `: null /* D-067-02: no mid-stream chrome — terminal states only carry text. Match Claude/ChatGPT. */`.
- Banner copy is now reserved for terminal states only (`runStatus === "timed_out"` → "Agent reached time limit"; `runStatus === "cancelled" || message.stopped` → "Response stopped").
- Dual banner block at MessageItem.tsx:159-166 untouched (already keys correctly on `runStatus === "timed_out"` vs `stopped`).
- Resume button gating at MessageItem.tsx:104-115 (`failed || timed_out`) untouched.
- Pitfall 3 audit gate: `grep -rn "Saving response" frontend/src/` returns 0 matches.

## Verification Results

| Gate | Expected | Observed | Status |
|------|----------|----------|--------|
| TypeScript build | exit 0 | exit 0 (after every task; final from worktree) | PASS |
| Awk gate (Task 1 reorder) | prints `set` | prints `set` | PASS |
| Audit comment present | ≥1 | 1 | PASS |
| 5 sites listed in audit | ≥5 | 6 (5 sites + 1 audit-block-header reference) | PASS |
| `prev.some((m) => m.id === assistantId)` (Task 2) | ≥1 | 1 | PASS |
| `prev.some((m) => m.id === targetId)` (Task 3) | ≥1 | 2 (Task 3's guard + pre-existing D-063.1-04 idempotent insert) | PASS |
| `Saving response` in frontend/src | 0 | 0 | PASS |
| D-067-02 marker in MessageItem | ≥1 | 1 | PASS |
| `Agent reached time limit` count | 2 (ternary + dual banner) | 3 (extra match: comment-block reference at line ~153) | PASS (≥2) |
| Resume button gating | ≥1 | 1 | PASS |
| `guardedSetMessages` declaration | ≥1 | 1 | PASS |
| `reconcileInFlightRef` | ≥3 | 5 | PASS |
| `lastSeenOffsetRef` | ≥4 | 6 | PASS |
| reconcile WR-06 set-before-subscribe | ≥1 | 1 | PASS |
| BL-03 ordering (sendMessage) | preserved | confirmed (delete BEFORE originalOnTerminal at lines 612-621) | PASS |
| BL-03 ordering (reconcile) | preserved | confirmed (delete BEFORE originalOnTerminal at lines 858-862) | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale JSDoc reference to "Saving response…" in types/index.ts**

- **Found during:** Task 4 (Pitfall 3 audit gate)
- **Issue:** `frontend/src/types/index.ts:93` contained a JSDoc comment for the `stopped?` field that read: `True if the user clicked Stop — shows "Response stopped" indicator instead of "Saving response…"`. With Task 4's deletion of the "Saving response…" fallback string, this comment became factually incorrect — the no-text fallback is now `null`, not "Saving response…".
- **Fix:** Updated JSDoc to: `True if the user clicked Stop — shows "Response stopped" indicator (D-067-02: no fallback chrome between SSE end and DB persistence).` — preserves the original informational intent while pointing at D-067-02 for the rationale.
- **Files modified:** `frontend/src/types/index.ts` (line 93)
- **Commit:** `0936772` (rolled into Task 4 commit since they share the same audit gate)
- **Rationale:** Rule 1 (Bug) — code documentation that materially misrepresents current behavior misleads future maintainers. The fix is a 1-line JSDoc edit, well within Rule 1 auto-fix scope.

No other deviations. Plan executed as written.

## Authentication Gates

None — all changes are pure frontend TypeScript edits with no auth/secret surface.

## Threat Flags

None — no new network surface, auth paths, file access patterns, or schema changes introduced. STRIDE register from PLAN.md `<threat_model>` (T-067-01-01..04) covers all changes; T-067-01-03 (DoS via wasted reconcile) and T-067-01-04 (Tampering via duplicate-consumer race) actively mitigated by Tasks 2+3 and Task 1 respectively.

## Known Stubs

None — all UI paths render terminal-state-aware content; the deleted `"Saving response…"` fallback is intentionally `null` (D-067-02 design — no mid-stream chrome, mirrors Claude/ChatGPT).

## Live UAT Smoke

Deferred to Plan 05 closing UAT per D-067-07 / VERIFICATION.md. Plan 05 will drive a Chrome MCP session at `localhost:5173` (login `fhdmrd@gmail.com / 123456`) to:

1. Verify placeholder + first SSE delta paint within 1s of POST returning (UX-067-01).
2. Verify "Saving response…" never appears in any state (UX-067-02).
3. Verify a Cmd-Tab during the POST→subscribe handoff window does NOT open a duplicate `EventStream` request to `/runs/{run_id}/stream` (D-067-01 race-fix evidence).
4. Verify a thread switch mid-stream + return + late terminal SSE event does NOT mutate state for a non-existent assistantId (UX-067-02 invariant — observe via React DevTools or console.error count).

## TDD Gate Compliance

Plan type `execute` (not `tdd`) — TDD gate sequence not required. Each task committed individually with `refactor` (Task 1) or `fix` (Tasks 2-4) commit prefixes per task_commit_protocol.

## Self-Check

**Created files:**
- `.planning/phases/067-frontend-streaming-ux-fix/067-01-SUMMARY.md` — FOUND (this file).

**Modified files:**
- `frontend/src/hooks/useMessages.ts` — FOUND (3 commits: a83479d, 51f4a9d, ee603ff).
- `frontend/src/components/chat/MessageItem.tsx` — FOUND (1 commit: 0936772).
- `frontend/src/types/index.ts` — FOUND (1 commit: 0936772, Rule 1 deviation).

**Commits exist:**
- `a83479d refactor(067-01): audit + reorder POST→subscribe handoff (D-067-01)` — FOUND.
- `51f4a9d fix(067-01): guard sendMessage terminal-flip with existence check (D-067-02)` — FOUND.
- `ee603ff fix(067-01): guard reconcile terminal-flip with existence check (D-067-02)` — FOUND.
- `0936772 fix(067-01): delete "Saving response…" fallback from MessageItem (D-067-02)` — FOUND.

## Self-Check: PASSED
