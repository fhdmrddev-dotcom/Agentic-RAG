---
phase: 183-read-only-canvas
plan: 01
subsystem: infra
tags: [xyflow, react-flow, vite, vitest, jsdom, tailwind, frontend, toolchain]

# Dependency graph
requires:
  - phase: 181-revert-foundation
    provides: the `visual_workflow_canvas` flag + the flag-off byte-identity contract (D-181-07) this plan's CSS placement had to stay compatible with
provides:
  - "`@xyflow/react@^12.11.2` installed as a frontend `dependencies` entry (resolved 12.11.2, MIT, no postinstall)"
  - "the mandatory React Flow stylesheet loaded once, as statement #1 of `frontend/src/index.css`, above `@tailwind base`"
  - "`frontend/src/test-utils/mockReactFlow.ts` — the file-local jsdom mock helper every later canvas suite imports"
  - "the A1 verdict as an executable assertion: a handle-free custom node renders 0 edges; the same fixture with handles renders 1"
  - "the pre-canvas `vite build` chunk baseline for plan 183-07's A6 lazy-split measurement"
  - "D-ITEM-183-01 — the recorded 33-signature `tsc -b` baseline that every later 183 plan's tsc gate must be read against"
affects: [183-02, 183-03, 183-04, 183-05, 183-06, 183-07, 184-editable-canvas, 188-run-observability]

# Tech tracking
tech-stack:
  added: ["@xyflow/react@12.11.2 (MIT; nested zustand@4.5.7, classcat, @xyflow/system, d3-*)"]
  patterns:
    - "file-local jsdom mocks (never setupTests.ts) so global prototype mutation cannot perturb the 1877-test baseline"
    - "research assumptions discharged by committed spikes rather than prose"
    - "third-party CSS imported once, above @tailwind base, so @layer base tokens win the cascade"

key-files:
  created:
    - frontend/src/test-utils/mockReactFlow.ts
    - frontend/src/test-utils/handleSpike.test.tsx
    - .planning/phases/183-read-only-canvas/deferred-items.md
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/index.css

key-decisions:
  - "A1 RESOLVED: a custom node with no <Handle> renders 0 edges — PhaseNode (183-06) MUST render hidden handles, not omit them"
  - "A4 DISCHARGED: @xyflow/react v12 builds clean under Vite 8 (vite build exits 0; the stylesheet's exports subpath resolves)"
  - "The xyflow stylesheet loads eagerly for everyone including flag-off; only the ~59 KB of JS is deferred in 183-07, because deferring the CSS would make cascade order relative to Tailwind non-deterministic"
  - "The official jsdom ResizeObserver recipe is INCOMPLETE for @xyflow/system 0.0.79 — its bare { target } entry must carry contentRect or a post-assertion TypeError makes vitest exit 1 despite green tests"
  - "`npx tsc -b` is RED on develop at baseline (33 pre-existing signatures, 0 xyflow-related); Phase 183's tsc gates are differential, not absolute"

patterns-established:
  - "src/test-utils/ is the home for shared frontend test helpers (net-new structure; nothing existed before)"
  - "jsdom mock helpers are imported and called per-suite behind an idempotent init guard — setupTests.ts stays minimal"
  - "assumption spikes ship as permanent committed tests so an upstream upgrade re-fails them"

requirements-completed: [CANVAS-01]

# Metrics
duration: 22min
completed: 2026-07-25
---

# Phase 183 Plan 01: Canvas Toolchain + jsdom Harness Summary

**`@xyflow/react@12.11.2` installed and proven green under Vite 8, its mandatory stylesheet wired as `index.css` statement #1, and a file-local jsdom mock helper plus a committed spike that answers assumption A1 with hard numbers: a handle-free custom node renders zero edges.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-25T19:39:00Z
- **Completed:** 2026-07-25T20:00:54Z
- **Tasks:** 3 of 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- The ONE net-new dependency of milestone v3.6 is in, at `^12.11.2` in `dependencies`, with the
  frozen v11 name `reactflow` appearing nowhere in the tree.
- Assumption **A4 discharged before any component work**: `npx vite build` exits 0 with the package
  installed AND with its stylesheet imported — the ESM `exports` subpath resolves cleanly under
  Vite 8/rolldown.
- Assumption **A1 resolved by measurement, not guesswork** — the verdict plan 183-06 needs before
  `PhaseNode`'s shape is locked.
- The jsdom harness exists without touching a single global: `setupTests.ts` is byte-unchanged, so
  the phase's failing-name differential is intact.
- A real pre-existing toolchain defect (`tsc -b` red on `develop`) was found, proven not-ours, and
  recorded rather than silently absorbed.

## The A1 verdict (recorded verbatim — plan 183-06 reads this)

> **A handle-free custom node renders 0 edge(s). The identical two-node / one-edge fixture rendered
> through a custom node with `<Handle type="target" position={Position.Left} />` +
> `<Handle type="source" position={Position.Right} />` renders 1 edge.**

Measured by `frontend/src/test-utils/handleSpike.test.tsx`, which asserts both counts as literal
integers (`toBe(0)` / `toBe(1)`) and is green.

**Consequence for plan 183-06:** `PhaseNode` **MUST** render both handles. Omitting them does not
"render the edge to the node centre" and does not warn — the edge simply never appears. The control
case proves the harness *can* paint edges, so the 0 is a real negative, not a jsdom artifact. Per
Pitfall 4 the handles ship **hidden** (`opacity: 0` / zero-size) with `nodesConnectable={false}`,
positioned by CSS `top: <fixed offset>` rather than the default `50%` — which is also exactly
D-183-12's "edges anchor to a fixed offset from the node top, so a taller card never moves the edge
baseline".

## The `vite build` chunk baseline (plan 183-07 measures A6 against this)

Nothing imports xyflow **JS** yet, so this is the clean pre-canvas reference point.

| Asset | Before this plan (Task 1) | After this plan (Task 2) | Delta |
|---|---|---|---|
| `dist/assets/index-*.css` | 105.07 kB │ gzip 17.73 kB | **120.48 kB │ gzip 20.06 kB** | **+15.41 kB raw / +2.33 kB gzip** — the whole cost of the stylesheet |
| `dist/assets/index-*.js` (main entry) | 1,726.81 kB │ gzip 434.24 kB | **1,726.81 kB │ gzip 434.24 kB** | **0** — no xyflow JS in the bundle yet |
| `dist/assets/wasm-*.js` (largest chunk) | 622.32 kB │ gzip 232.09 kB | unchanged | 0 |
| `dist/assets/RetrievalTrendChart-*.js` | 359.00 kB │ gzip 104.52 kB | unchanged | 0 |
| Total emitted JS chunks | 308 | 308 | 0 |
| Build time | 5.29s | 4.12s | — |
| A chunk whose name contains `xyflow` | none | **none** | — |

**How 183-07 should read this:** the A6 question is whether `React.lazy` yields a *real* first-load
saving. The main entry is **1,726.81 kB / 434.24 kB gzip today with zero xyflow JS in it**. After the
canvas lands, if `index-*.js` has grown by roughly the bundlephobia figure (~184 kB raw / ~59 kB
gzip) then the split is NOT working and a separate `xyflow`-bearing chunk should appear instead. The
CSS delta above is the part that can never be split off — it is already paid, eagerly, for everyone
including flag-off, and that is the deliberate trade.

## Task Commits

1. **Task 1: Install `@xyflow/react` and prove the toolchain (A4)** — `2d8e4e4c` (chore)
2. **Task 2: Load the mandatory xyflow stylesheet at `index.css` line 1** — `939c167e` (feat)
3. **Task 3: jsdom mock helper + the A1 handle spike** — `8a661713` (test)

## Files Created/Modified

- `frontend/package.json` — `"@xyflow/react": "^12.11.2"` added to `dependencies` (one line).
- `frontend/package-lock.json` — **+178 / −0**. Purely additive; `zustand@4.5.7` lands *nested*
  under `@xyflow/react` while the app's top-level `zustand@5.0.13` is untouched.
- `frontend/src/index.css` — **+11 / −0**. `@import "@xyflow/react/dist/style.css";` as the first
  statement, under a comment recording the eager-CSS / lazy-JS tradeoff. Every existing token line
  byte-unchanged.
- `frontend/src/test-utils/mockReactFlow.ts` — the four official jsdom mocks (`ResizeObserver`,
  `DOMMatrixReadOnly`, `offsetHeight`/`offsetWidth` getters, `SVGElement.getBBox`) behind an
  idempotent module-level `init` guard, plus a header explaining why this must never move into
  `setupTests.ts`.
- `frontend/src/test-utils/handleSpike.test.tsx` — the A1 spike: one fixture, two node types, two
  literal-integer assertions, and the verdict stated in prose above each.
- `.planning/phases/183-read-only-canvas/deferred-items.md` — D-ITEM-183-01 (below).

## Decisions Made

- **Where the stylesheet lives.** `index.css` statement #1, not a component file and not the lazy
  module. Verified in the built artifact, not just asserted: in `dist/assets/index-BKqyuBAQ.css` the
  first `.react-flow` rule sits at **byte 0** while the Deep Midnight `--background` token appears at
  **byte ~18,920** — so `@layer base` provably still wins the cascade.
- **The helper is per-suite, not global.** `Object.defineProperties` on `HTMLElement.prototype`
  reaches every suite; with a baseline already flaky at 28-35 of 1877, a global install would have
  made this phase's failing-name differential unreadable. Cost: every canvas suite must remember to
  call `mockReactFlow()` — and plan 183-01 already paid that tuition (see Issues).
- **The spike is permanent.** It is the machine-readable record of A1 and re-fails if a future
  `@xyflow/react` upgrade changes handle/edge behaviour.
- **No second dependency.** `zundo` (184), `elkjs`/`dagre` (191) and `tldraw` (out of scope) were
  not touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The official jsdom `ResizeObserver` recipe throws against `@xyflow/system@0.0.79`**

- **Found during:** Task 3 (the A1 spike's first green run)
- **Issue:** The React Flow testing guide's snippet — copied verbatim as the plan instructed —
  passes a bare `{ target }` as the `ResizeObserverEntry`. `@xyflow/system@0.0.79`'s `XYPanZoom`
  extent observer dereferences `entry.contentRect.width`
  (`node_modules/@xyflow/system/dist/esm/index.mjs:2923`). The result was a genuinely nasty failure
  mode: **both assertions passed** ("2 passed") but a `TypeError: Cannot read properties of
  undefined (reading 'width')` fired from the timer *after* the test body, and vitest still **exited
  1**. A gate that reports green tests and a red exit code is worse than a plain failure.
- **Fix:** extracted `resizeEntryFor(target)`, which builds a complete entry — `contentRect` from the
  target's own `getBoundingClientRect()`, plus `borderBoxSize` / `contentBoxSize` /
  `devicePixelContentBoxSize`. Behaviour is otherwise identical to the published recipe.
- **Files modified:** `frontend/src/test-utils/mockReactFlow.ts`
- **Verification:** `npx vitest run src/test-utils/handleSpike.test.tsx` → **exit 0**, 2 passed,
  0 errors (was: exit 1, 2 passed, 2 uncaught exceptions).
- **Committed in:** `8a661713` (Task 3 commit)
- **Forward note:** every later canvas suite inherits the corrected helper. If a future xyflow
  upgrade reads another entry field, this one function is the single place to widen.

**2. [Rule 1 - Bug] The spike imported `mockReactFlow` without calling it**

- **Found during:** Task 3, first run
- **Issue:** `ReferenceError: ResizeObserver is not defined` on mount — the helper was imported but
  never invoked, which would also have surfaced as an unused-import type error.
- **Fix:** module-level `mockReactFlow()` call directly after the imports, with a comment naming why
  it must precede any `render()`.
- **Files modified:** `frontend/src/test-utils/handleSpike.test.tsx`
- **Verification:** same run as above.
- **Committed in:** `8a661713` (Task 3 commit)

### Out-of-scope discovery (logged, NOT fixed)

**D-ITEM-183-01 — `npx tsc -b` is red on `develop` at baseline.** Full evidence in
`.planning/phases/183-read-only-canvas/deferred-items.md`.

`cd frontend && npx tsc -b` exits **2** with **33 distinct error signatures** across ~20 files. Since
`npm run build` is `tsc -b && vite build`, the scripted frontend build was already red before this
phase touched anything. Proof it is not ours:

1. the lockfile diff is **178 insertions / 0 deletions** — no existing dependency was re-resolved;
2. `grep -c xyflow` over the full `tsc -b` output = **0**;
3. `npm ls zustand` shows `4.5.7` nested under `@xyflow/react` with top-level `5.0.13` untouched, so
   the one zustand-flavoured error (`src/stores/streamsStore.ts:295`) resolves against the unchanged v5;
4. `git status --porcelain -- frontend/` listed only `package.json` + `package-lock.json` — every
   erroring source file is byte-identical to HEAD.

After all three tasks the signature set is **still exactly 33, with `comm -13` against the recorded
baseline returning nothing** — this plan added zero new type errors.

**Why not fixed:** ~33 errors across ~20 shipped, unrelated files is precisely the scope violation
the executor's SCOPE BOUNDARY rule forbids, and churning that many test files would wreck the
failing-name differential Phase 183 grades on. Roughly two thirds are `*.test.*` prop-shape drift of
the same family as the recorded vitest rot (SEED-056).

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both inside this plan's own new files) +
1 out-of-scope item logged.
**Impact on plan:** No scope creep. Both fixes were required for the plan's own `<automated>` gate to
be honestly green. The one substantive plan-contract change is that **the `tsc -b exits 0` acceptance
criterion is unachievable at baseline** and was executed as a differential (`no NEW signature vs the
recorded 33`), which every later 183 plan should inherit.

## Issues Encountered

- **A gate that lies.** The spike's second run reported "Test Files 1 passed / Tests 2 passed" *and*
  exit code 1. Trusting the summary line instead of the exit code would have shipped a broken helper
  to five downstream plans. Both numbers get checked from here on.
- **`tsc -b` vs `tsc --noEmit`** (the v3.3 lesson) held again: the plan correctly demanded the
  project-references build, and that is what exposed D-ITEM-183-01.
- **Pre-existing red in the workflows suite is unchanged and expected.**
  `npx vitest run src/components/workflows` → 104 passed, **1 failed**: `soulData.test.ts` ›
  *"maps the 6 phase types to ⚙✎🤖⛓☺◆ exactly"*. That is the documented RED-since-Phase-127
  assertion, already dispositioned as an in-phase FIX by plan **183-04 Task 3**. No new failing name,
  no drop in count.

## Verification Results

| Gate | Result |
|---|---|
| `npm ls @xyflow/react` | `@xyflow/react@12.11.2` ✅ |
| `grep -c '"reactflow"' frontend/package.json` | `0` ✅ |
| `@xyflow/react` `scripts.postinstall` | `none` ✅ (T-183-SC mitigation re-confirmed locally) |
| `npx vite build` | **exit 0** ✅ (A4 discharged) |
| `dist/assets/*.css` contains `react-flow` | ✅ `index-BKqyuBAQ.css`, first rule at byte 0 |
| stylesheet imported from any `src/*.ts(x)` | `0` hits ✅ (lives only in `index.css`) |
| `git diff --numstat frontend/src/index.css` | `11  0` ✅ insertions only |
| `npx vitest run src/test-utils` | **exit 0**, 2 passed ✅ |
| literal-integer assertions in the spike | `2` matches ✅ |
| `grep -c ResizeObserver\|mockReactFlow frontend/src/setupTests.ts` | `0` / `0` ✅ (file byte-unchanged) |
| `npx tsc -b` | exit 2, **33 signatures — identical to baseline, 0 new, 0 xyflow** ⚠️ see D-ITEM-183-01 |
| `npx vitest run src/components/workflows` | 104 passed / 1 failed — the known `soulData.test.ts` RED, no new name ✅ |

## Threat Model Compliance

- **T-183-SC (Tampering — npm supply chain):** mitigated as planned. RESEARCH's Package Legitimacy
  Gate (`[OK]` under `--ecosystem npm`, MIT, name discovered from official docs) was **not**
  re-litigated; the cheap local confirmation ran and `scripts.postinstall` is absent. No install-time
  code executed.
- **T-183-05 (third-party CSS in the cascade):** accepted as planned, and the acceptance is now
  *evidenced* — the built asset shows xyflow rules at byte 0 and the app's `@layer base` tokens
  ~18.9 kB later, so Deep Midnight wins every overlap.
- **ASVS conclusion intact:** the plan's footprint stayed entirely inside `frontend/`. No backend
  source was touched, no route, no migration, no authz decision — the "this conclusion is VOID"
  condition did not trigger.

## Known Stubs

None. Every artifact this plan created is fully wired: the dependency is resolved and building, the
stylesheet is in the shipped CSS asset, and the helper is exercised by a green test.

## User Setup Required

None — no external service configuration, no env var, no migration, no cloud parity owed.

## Next Phase Readiness

**Ready.** Every downstream plan in this phase can now import xyflow types, render `<ReactFlow>` in
jsdom, and rely on the stylesheet being loaded.

Hand-offs, explicitly:

- **183-06** — `PhaseNode` MUST render a hidden target + source `<Handle>`. A1 says omitting them
  silently renders no edge. Anchor them by CSS `top: <fixed offset>`, not `50%` (D-183-12).
- **183-07** — measure the lazy split against the chunk table above: main entry today is
  **1,726.81 kB / 434.24 kB gzip with zero xyflow JS**. The stylesheet's +15.41 kB is already paid
  and cannot be deferred.
- **All 183 plans** — read the `tsc -b` gate as a differential against the 33-signature baseline
  (D-ITEM-183-01). `vite build` remains a hard exit-0 gate.
- **183-04** — the `soulData.test.ts` glyph assertion is confirmed still RED and still the only
  failing name in `src/components/workflows`; its fix should shrink the differential by exactly one.

No blockers.

## Self-Check: PASSED

Files verified present on disk:

- FOUND: `frontend/src/test-utils/mockReactFlow.ts`
- FOUND: `frontend/src/test-utils/handleSpike.test.tsx`
- FOUND: `.planning/phases/183-read-only-canvas/deferred-items.md`
- FOUND: `frontend/src/index.css` (contains `@xyflow/react/dist/style.css` at statement #1)
- FOUND: `frontend/package.json` (contains `"@xyflow/react": "^12.11.2"`)

Commits verified in `git log`:

- FOUND: `2d8e4e4c` — chore(183-01): install @xyflow/react ^12.11.2 and prove the toolchain
- FOUND: `939c167e` — feat(183-01): load the mandatory xyflow stylesheet at index.css statement #1
- FOUND: `8a661713` — test(183-01): add the file-local jsdom mock helper and the A1 handle spike

---
*Phase: 183-read-only-canvas*
*Completed: 2026-07-25*
