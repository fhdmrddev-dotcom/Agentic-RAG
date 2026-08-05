# Phase 188.1 — deferred items

Out-of-scope discoveries logged during execution. Per the executor SCOPE BOUNDARY rule these
are **not** fixed by the plan that found them.

---

## D-188.1-DEF-01 — `WorkflowRunPage.test.tsx` has a genuinely FLAKY case inside the count gate

**Found during:** plan `188.1-02`, Task 2 (the count-gate verification runs)
**File:** `frontend/src/pages/WorkflowRunPage.test.tsx:498-505`
**Case:** `WorkflowRunPage — a reconcile leaves every visible node reading > calls the reconcile its own hook returns when the tab wakes — this page closes that locally`

**What was observed.** Six consecutive `node scripts/vitest-count-gate.cjs` runs were made on
2026-08-05 across this plan. **Five reported `failed 0`; one reported `failed 1`**, and the gate
correctly went red on it (`[failing-tests] 1 test(s) failed — the gate requires 0`). The failing
assertion was recovered from that run's own JSON report
(`%TEMP%/vitest-count-gate-55384-1785958136679.json`):

```
AssertionError: expected "vi.fn()" to be called at least once
  at src/pages/WorkflowRunPage.test.tsx:504:23
```

**Why it is out of scope for 188.1-02.** The red run came *after* an edit that touched only
`scripts/vitest-count-gate.cjs` and a prose comment block in
`frontend/src/components/workflows/WorkflowCanvas.test.tsx`. Neither file is imported by
`WorkflowRunPage.test.tsx`, and the two runs on either side of the red one were green with an
identical tree. It is a pre-existing timing flake, not a regression this plan caused.

**The likely mechanism, recorded so the next reader does not re-derive it.** The case fires
`fireEvent(window, new Event("visibilitychange"))` and then asserts `toHaveBeenCalled()`
**synchronously**, with no `waitFor` and no `act` around the dispatch — every other assertion in
that describe awaits. If the effect that registers the `visibilitychange` listener has not
flushed, or the handler defers a tick, the assertion runs before the call lands.

**Why this matters more than a normal flake.** `WorkflowRunPage.test.tsx` is pinned in the gate's
`BASELINE` at 87, and the gate requires `failed 0`. So this case can red the gate for any plan in
any phase, at a rate of roughly 1 run in 6 — a CI failure attributable to nothing the author did.

**Re-open trigger:** the next phase that touches `frontend/src/pages/WorkflowRunPage.tsx` or its
suite. The fix is one line — wrap the assertion in `await waitFor(...)`, matching the shape the
rest of that describe already uses.
