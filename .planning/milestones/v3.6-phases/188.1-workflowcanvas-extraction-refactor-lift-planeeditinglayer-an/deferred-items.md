# Phase 188.1 — deferred items

Out-of-scope discoveries logged during execution. Per the executor SCOPE BOUNDARY rule these
are **not** fixed by the plan that found them.

---

## D-188.1-DEF-01 — `WorkflowRunPage.test.tsx` has a genuinely FLAKY case inside the count gate

> **✅ CLOSED by plan `188.1-04`, commit `23046860`.** Its own re-open trigger — *"the next phase
> that touches `WorkflowRunPage.tsx` or its suite"* — fired: `188.1-04` extends this suite with the
> WR-07 falsification, so the one-line fix was in the plan's declared blast radius rather than a
> widening of it. The assertion is now `await waitFor(() => expect(reconcile).toHaveBeenCalled())`,
> matching the shape the rest of that describe already used. It did **not** fire in any of the four
> gate runs `188.1-04` performed, so the fix is preventive, not a diagnosis of an observed red.
> The original report is kept in full below.


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

---

## D-188.1-DEF-02 — `providerLogo.tsx` is an EIGHTH prototype-key lookup, on the same pattern

**Found during:** plan `188.1-04`, Task 2 (the A7 audit widened by the site-1 crash)
**File:** `frontend/src/lib/providerLogo.tsx:107-108`

```typescript
  // The `?? null` mirrors fileIcon's `?? DEFAULT_SPEC` — total over any key.
  return provider ? (MARKS[provider] ?? null) : null
```

**What it is.** Byte-for-byte the same defect `188.1-04` closed at `lib/phaseGlyph.tsx:78` — the
comment even carries the same false *"total over any key"* claim, because one file was written by
copying the other. `MARKS` is a plain object literal, so `MARKS["constructor"]` is the `Object`
FUNCTION, `?? null` does not fire, and the caller does `createElement(Object, …)` → *"Objects are
not valid as a React child"*, a hard render crash.

**Why it is out of scope for `188.1-04`.** `phaseGlyph` was fixed because the WR-04 site-1 and
site-2 falsifications physically could not go green while it crashed — it was a **blocker**, not a
sweep. `providerLogo` sits on no path this plan's falsifications drive, and `188.1-CONTEXT.md`
`<deferred>` is explicit: fixes at prototype-key sites beyond the five SC#6 names are deferred, and
*"a sixth site is recorded and routed to the next phase touching that file rather than widening this
refactor."* `provider` is also a narrower input than `phase_type` — it comes from the model
registry, not from author-supplied definition JSONB.

**Re-open trigger:** the next phase touching `frontend/src/lib/providerLogo.tsx`, or any phase that
lets a user-supplied string reach `providerLogo(...)`. The fix is the same three lines
`phaseGlyph.tsx` now carries, and `fileIcon`'s `?? DEFAULT_SPEC` (which the comment cites as its
model) should be re-measured in the same pass.
