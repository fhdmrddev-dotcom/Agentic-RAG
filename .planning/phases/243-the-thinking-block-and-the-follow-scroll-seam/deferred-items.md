## `Plan04.frontend.test.tsx` — one INHERITED red, in a suite NEITHER gate knob names (found by 243-04)

`frontend/src/__tests__/components/Plan04.frontend.test.tsx` §"Atom C" fails:
`AssertionError: expected '' to contain 'text-emerald-400'`.

**Not this plan's, and not new.** Measured:

- The suite is in **neither** gate knob — `grep -c "Plan04.frontend" scripts/vitest-count-gate.cjs`
  is **0** — so the phase's green `count gate OK` never saw it and never could.
- `text-emerald-400` no longer exists on the node the case asserts: `grep -rln "emerald-400"
  frontend/src/components/chat/` returns **`StepRow.tsx` only**, i.e. the class moved when
  **Phase 227-02 decomposed `ToolCallPanel`** (`a743aeef4`). The suite itself was last touched at
  `d1e724361` (Phase 095-05) and was never re-aimed.
- 243-04's whole diff is `ThinkingBlock.tsx` + its two suites; it adds and removes no colour class.
  The suite fails identically in isolation.

**Deferred, not fixed** (SCOPE BOUNDARY: only issues DIRECTLY caused by this plan's changes are
auto-fixed). ⚠ The useful finding is the second bullet's shape, not the red itself: **a suite that
is in neither knob is invisible to the gate, so a class rename can orphan it for 16 phases and the
verdict line still reads `count gate OK`.** Same failure mode `SEED-222` names for the six unpinned
suites, one file over.
