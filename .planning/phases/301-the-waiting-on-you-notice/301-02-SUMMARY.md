---
phase: 301-the-waiting-on-you-notice
plan: 02
subsystem: frontend / app-shell attention
tags: [frontend, hook, realtime, registry, attention, pins]
requires:
  - "301-01 wire contract: GET /notifications -> { notices: WaitingNotice[]; total }"
provides:
  - "getWaitingNotices(signal) + WaitingNotice / WaitingNotices (frontend/src/lib/api/notifications.ts)"
  - "useWaitingNotices() -> { notices, total, loading, verdictKnown, failedSinceLast, refresh }"
  - "AttentionCondition = LibraryCondition | WaitingCondition (required mark), AttentionContext, WaitingStatus"
  - "useWaitingRunConditions, conditionsForMark, waitingTotal; ATTENTION_PRODUCERS second tenant waiting-runs"
affects:
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/NavPanel.tsx
tech-stack:
  added: []
  patterns:
    - "fetch is truth, Realtime only triggers a refetch (D-v2.5-03)"
    - "union on a required discriminant (mark) + strict-leaf partition helpers"
    - "producers take one memoised context object"
key-files:
  created:
    - frontend/src/lib/api/notifications.ts
    - frontend/src/hooks/useWaitingNotices.ts
    - frontend/src/hooks/__tests__/useWaitingNotices.test.tsx
  modified:
    - frontend/src/components/layout/attentionConditions.ts
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/__tests__/attentionTab.test.ts
    - frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.badge.test.tsx
    - frontend/src/pages/__tests__/LibraryPage.tabAttention.test.tsx
    - frontend/src/components/sources/sourceComposition.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "The waiting dot (hamburger) = library count (when a Library navigator is wired) + the server's waiting total; it is NOT gated on onOpenLibraryHealth"
  - "Pre-existing tests that read condition.tab narrow on mark === 'library' inline, so a wrong mark still fails them (conditionsForMark would have silently dropped it)"
  - "ChatLayout reaches conditionsForMark / waitingTotal through the existing attentionRegistry namespace import; still exactly one ATTENTION_PRODUCERS.flatMap"
metrics:
  duration: "~1h50m"
  completed: 2026-10-30
  tasks: 3
  files: 14
---

# Phase 301 Plan 02: the waiting-on-you data half Summary

A `GET /notifications` client and a `useWaitingNotices` hook that learns the waiting list only from
the server (Realtime, focus, visibility, org/membership change and a 60 s poll all just refetch),
registered as `waiting-runs`, the attention registry's second tenant, behind a required `mark` so
waiting runs never add to the Library's badge, popover or tab marks, while a waiting run alone still
lights the phone's hamburger dot.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | wire client + useWaitingNotices (D-15, D-17, D-18, D-33) | `30a5e1689` | `6493fc50f` |
| 2 | second registry tenant, required mark, ctx object, pins 1 -> 2 (D-11, D-13, D-14, D-31) | `f71f90546` | `5b74d33e7` |
| 3 | D-12 partition in NavPanel + ChatLayout, dot lights for either | `83b572cb0` | `e30961eab` |

TDD gate: every task has a `test(301-02)` RED commit before its `feat(301-02)` GREEN commit. Each RED
run was observed failing (Task 1: module missing; Task 2: 11 failing; Task 3: 5 failing).

## Contract exported for 301-03 (names are load-bearing)

From `frontend/src/components/layout/attentionConditions.ts`:

```ts
export type AttentionCondition = LibraryCondition | WaitingCondition
export interface LibraryCondition { mark: "library"; id; title; detail; onOpen: () => void; tab?: LibraryTab }
export interface WaitingCondition {
  mark: "waiting"; id: string /* notice id */; title: string /* workflow_name verbatim */; detail: "" ;
  onOpen: () => void /* ctx.openRun(runId) */; runId: string; orgId: string; orgName: string;
  since: string /* created_at ISO */; kind: "question" | "approval";
  origin?: "app" | "schedule" | "key" | null; total: number /* server count of ALL open notices */
}
export type WaitingStatus = "loading" | "failed" | "answered" | "stale"
export interface AttentionContext {
  openLibraryHealth: () => void; openRun: (runId: string) => void;
  reportWaitingStatus?: (status: WaitingStatus) => void
}
export interface AttentionProducer { key: string; use: (ctx: AttentionContext) => AttentionCondition[] }
export function useStoppedSourceConditions(ctx: AttentionContext): AttentionCondition[]
export function useWaitingRunConditions(ctx: AttentionContext): AttentionCondition[]   // the ONE useWaitingNotices() call
export function conditionsForMark(c, "library"): LibraryCondition[]   // overload; "waiting" -> WaitingCondition[]
export function waitingTotal(c): number                               // server total from any waiting row, 0 when none
export function attentionCountByTab(c)                                // counts mark "library" only
export const ATTENTION_PRODUCERS  // keys ["stopped-sources", "waiting-runs"]
```

- `WaitingStatus` derivation: `!verdictKnown && loading` -> loading; `!verdictKnown && !loading` -> failed;
  `verdictKnown && failedSinceLast` -> stale; else answered. Reported via
  `useEffect(() => ctx.reportWaitingStatus?.(status), [report, status])`.
- The words ("Untitled workflow" / "Unnamed org" fallbacks, org · kind · origin · waited) are 301-03's to compose.
- ChatLayout today builds `attentionCtx = { openLibraryHealth, openRun }` (memoised) and does NOT pass
  `reportWaitingStatus` yet — 301-03 adds it to that same `useMemo` when it mounts the control.
- ChatLayout's AppViewSwitch mount receives `showAttention={dotCount > 0}` / `attentionCount={dotCount}`
  (ChatArea's hamburger dot only) and the FULL `attentionConditions`; NavPanel receives the full list and
  filters to library itself. 301-03's waiting control reads `conditionsForMark(attentionConditions, "waiting")`
  and `waitingTotal(attentionConditions)`.

From `frontend/src/hooks/useWaitingNotices.ts`: `useWaitingNotices(): WaitingNoticesState` (`notices`,
`total`, `loading`, `verdictKnown`, `failedSinceLast`, `refresh`). From `frontend/src/lib/api/notifications.ts`:
`getWaitingNotices(signal?)`, `WaitingNotice`, `WaitingNotices` — NOT in the `@/lib/api` barrel; every suite
mounting ChatLayout must `vi.mock("@/lib/api/notifications", () => ({ getWaitingNotices: ... }))` by path.

## Verification

- Targeted: `useWaitingNotices.test.tsx` 23/23; `attentionTab` 20, `NavPanel.badge` 17, `ChatLayout.badge` 14,
  `LibraryPage.tabAttention` 15 — all green.
- Broad: `src/components/layout src/__tests__/routing LibraryPage.tabAttention sourceComposition` — 504 tests,
  6 failed: 4 in `ChatHistoryColumn.test.tsx` (date grouping) and 2 in `sourceComposition.test.tsx`.
  - `ChatHistoryColumn.test.tsx`: the SAME 4 cases fail with base `d9ff4c5eb` versions of every touched
    source file checked out — inherited (date-dependent), provably not this plan's. File byte-unchanged.
  - `sourceComposition.test.tsx` (standing red) — before/after failing set:
    - BEFORE (base versions of attentionConditions/ChatLayout/NavPanel/sourceComposition checked out, 2-file run): **0 failing**.
    - AFTER, run alone: **0 failing (49/49)**.
    - AFTER, inside the 169-file broad run: 2 failing — `LibraryPage renders its heading` timed out at 5008 ms,
      and the next case then saw duplicate "Ingestion" tabs from the timed-out render (cascade). A load timeout,
      not a regression: the same file passes alone, and the count gate run (below) reported 0 failing overall.
      Only fixture edits were made to it (two `mark: "library"` lines).
- **Count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root):
  `count gate OK — 574/574 pinned files present, no per-file decrease, 0 failing.` (total 13339 · failed 0 · pinned total 12162)
  Pins raised to the printed actuals: NavPanel.badge 14 -> 17, ChatLayout.badge 5 -> 14, attentionTab 10 -> 20;
  new pin useWaitingNotices 23 (+ FILE-LEVEL TARGET). LibraryPage.tabAttention unchanged at 15.
- **tsc set diff** (`npx tsc -p tsconfig.app.json --noEmit`): base set 61 errors (measured at the Task 1 state,
  where the only changes were two new files with zero errors of their own); final 61 errors; **NEW: none ·
  GONE: none**. (A mid-Task-2 run surfaced 2 new TS2339 `condition.tab` errors in attentionTab.test.ts; fixed
  in the GREEN commit by narrowing on the mark.)
- `node scripts/check-hot-file-ledger.cjs .planning/phases/301-the-waiting-on-you-notice` -> ledger gate OK;
  `node scripts/check-claude-md-size.cjs` -> OK (105.4k chars).

Acceptance greps: payload outside `//` lines in the hook = 0; `recipient_id=eq.` = 2; `60_000` = 1;
`notifications` in `lib/api.ts` = 0; `"waiting-runs"` in attentionConditions.ts = 1; `SEED-281` = 6; the
D-235-03 sentence present (struck through); `ATTENTION_PRODUCERS.flatMap` in ChatLayout = 1;
`conditionsForMark` in NavPanel = 3; `attentionConditions={attentionConditions}` in ChatLayout = 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing attentionTab cases stopped typechecking under the union**
- Found during: Task 2 (tsc set diff)
- Issue: `condition.tab` does not exist on `AttentionCondition` once it is a union.
- Fix: narrowed inline (`condition.mark === "library" && condition.tab`), so a wrong mark still fails.
- Commit: `5b74d33e7`

**2. [Rule 3 - Blocking] RED commit of Task 2 does not typecheck**
- The new exports did not exist yet and the `homeless` fixture gained `mark`; recorded in the RED commit
  message. The remaining `mark: "library"` fixture edits (NavPanel.badge, LibraryPage.tabAttention,
  sourceComposition) rode in the GREEN commit with the type change, per D-31.

**3. Stale ledger cells corrected while updating them** — attentionConditions.ts read `3 / 2 / 200`
(measured `4 / 2 / 226` at base) and NavPanel.tsx `26 / 14 / 420` (measured `27 / 14 / 422`); both noted
in their 301-02 sections. ChatLayout.badge's pin had trailed the file (5 pinned, 10 cases at base).

Otherwise the plan executed as written.

## Known Stubs

- `WaitingCondition.detail` is always `""` — intentional (interfaces block / UI-SPEC): the row's words are
  composed at render time by 301-03's list, because the waited phrase ticks each minute.
- No waiting control is mounted yet — that is 301-03 (`WaitingOnYouControl` / `WaitingOnYouList`). Until
  then a waiting run lights only the hamburger dot.

## Threat Flags

None. No new endpoint or trust boundary beyond the plan's threat model; T-301-11..17 mitigations are in
place and tested (payload never read + `?raw` fence, user-scoped filter, refetch on every trigger, defensive
Realtime, keep-last-verdict, mark partition, no question text on the wire type).

## Notes for the orchestrator

- `graphify update .` was not run inside this worktree (parallel agent in wave 1); run it after merge.
- STATE.md / ROADMAP.md untouched, as instructed.

## Self-Check: PASSED
