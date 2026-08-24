# Phase 192 — deferred items (out of scope, logged not fixed)

## D-192-DEF-01 — the count gate is RED at HEAD on ~5 s timeouts in `WorkflowsPage.test.tsx`, and it is NOT this round's

**Raised by:** `192-13` (gap-closure round 1), 2026-08-11
**Status:** deferred — out of the SCOPE BOUNDARY (a failure not caused by this plan's changes)

**What was measured — four `node scripts/vitest-count-gate.cjs` runs, alternating source state:**

| # | source state | `failed` | which cases |
|---|---|---|---|
| 1 | 192-13 HEAD | **1** | `WorkflowsPage.test.tsx` — D-08 paraphrase (5127 ms) |
| 2 | 192-13 HEAD | **1** | the same one case |
| 3 | **pre-plan base `7e4abd25`** (all three 192-13 files reverted with `git checkout`, `WorkflowCard.tsx` md5 `b3326479…` = the shipped blob) | **2** | the same `WorkflowsPage` case **+** `WorkflowBuilderPage.session.test.tsx` "pane click" |
| 4 | 192-13 HEAD | **4** | 3 × `WorkflowsPage` (5071 / 5445 / 5521 ms) + `WorkflowBuilderPage.session` |

**Why it is not 192-13's:** run 3 reproduces the failure with this plan's three files reverted to
their shipped bytes, so the defect predates the round. The count is also non-deterministic across
runs at one unchanged HEAD (1 → 1 → 4), which no source change explains.

**What it actually is:** every failing case reports `Error: STACK_TRACE_ERROR` with a duration of
**~5000–5500 ms** — vitest's default 5 s `testTimeout` — and all of them live in
`WorkflowsPage.test.tsx`'s `LIB-01 / SC#1: search finds a row among 200` describe. **Run standalone
that file is 40 passed / 0 failed in 32 s**, of which 29 s is test time: the 200-row suite is
genuinely slow, and under the gate's concurrent load individual cases tip over the per-test timeout.
This is the same render-timing-under-load class `192-11` hardened elsewhere with
`configure({ asyncUtilTimeout: 15000 })`, and the same class as the `WorkflowBuilderPage.canvas`
intermittent `192-12` rated at 2/14.

**What IS green, so the two are not confused:** the gate's *pin* dimension has no violation —
`[count-decrease]` did not fire, `pinned total` is 3152 unchanged, and `WorkflowCard.test.tsx` reads
**35 → 39 (+4)**, an increase above the pin, which is safe until pinned. The raise is owed to
`192-16` and is deliberately not taken here.

**Re-open trigger:** any phase touching `frontend/src/pages/WorkflowsPage.test.tsx`, or the first
occurrence of a gate failure in that file that is an ASSERTION rather than a ~5 s timeout. The
candidate fix is the 192-11 one — patience, never an assertion — but it belongs to a plan whose
`files_modified` names that file, not to a gap-closure round that must add no capability (G-7).

## D-192-DEF-02 — U5-b, card density

Recorded in `192-UAT.md` test 12 and routed there to a future `/gsd:sketch` under G-2. Explicitly
out of gap-closure round 1: re-composing the card is design work, not defect repair.
