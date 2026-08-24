---
phase: 183-read-only-canvas
plan: 05
subsystem: frontend
tags: [workflows, canvas, projection, purity, fixtures, snapshot, reachability-parity]

# Dependency graph
requires:
  - phase: 183-read-only-canvas
    plan: 01
    provides: "`@xyflow/react@12.11.2` (the `Node` / `Edge` types this model imports) + the 33-signature `tsc -b` differential baseline"
  - phase: 183-read-only-canvas
    plan: 02
    provides: "`phaseVocabulary.ts` — the read shapes, `parseSkipTarget`, `nodeTitle`, `technicalTitle`, `groundingFor`, `waitsForYou`, `PHASE_TYPE_SUBTITLES`"
  - phase: 091-harness
    provides: "`backend/app/services/harness/reachability.py:162-169` — the authoritative adjacency this model's edge set mirrors"
provides:
  - "`frontend/src/components/workflows/canvasModel.ts` — `toCanvas`, the PURE definition→{nodes,edges} projection"
  - "`CANVAS_LAYOUT` — the one frozen layout constants table 183-06's CSS must agree with"
  - "`CANVAS_NODE_TYPES` / `CANVAS_EDGE_KINDS` — the node/edge type-string vocabulary for 183-06's `nodeTypes` map"
  - "`frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` — the 15-entry SC#4 corpus + `ALL_FIXTURES`"
  - "`__snapshots__/canvasModel.fixtures.test.ts.snap` — 15 committed projection snapshots (the drift tripwire)"
  - "`canvasModel.purity.test.ts` — the D-183-12 / G-6 determinism, non-mutation and no-DOM-read controls"
affects: [183-06, 183-07, 184-editable-canvas, 185-graded-governance, 188-run-observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "the client edge set is derived by the SAME index lookup as the server linter, so canvas and lint cannot disagree about what an edge is"
    - "an unresolvable reference renders as a terminating stub node rather than a silent drop — the picture stays honest and no phantom edge is created"
    - "reserved node ids are built by a deterministic prefix-and-escape helper, so an unconstrained user slug can never collide with canvas chrome"
    - "purity is asserted by controls that were PROVEN to fire (clock planted → red; input mutated → red), not by convention"

key-files:
  created:
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/canvasModel.test.ts
    - frontend/src/components/workflows/__fixtures__/canvasFixtures.ts
    - frontend/src/components/workflows/canvasModel.fixtures.test.ts
    - frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
    - frontend/src/components/workflows/canvasModel.purity.test.ts
  modified: []

key-decisions:
  - "C-2 shipped: the sequential edge is `byIndexValue.get(phase.phase_index + 1)` — a LOOKUP, so `phase_index [0,1,3]` yields exactly one edge and no phantom bridge"
  - "The sort comparator is TOTAL (phase_index, then slug) so even duplicate indices order deterministically regardless of the caller's array order — order-independence holds unconditionally"
  - "The ○ end cap is fed by the phase with the MAXIMUM phase_index only; on a gap the pre-gap phase is deliberately left with no outgoing edge (the honest orphan picture)"
  - "Fixture SQL sources are cited as `migrations/NNN_*.sql` (no platform prefix) — the plan's own anti-live-read guard forbids the prefix token"
  - "Prompt bodies, tool lists, folder scopes and template assets are NOT transcribed: `toCanvas` never reads them, so including them would only make the snapshot a diff magnet"

patterns-established:
  - "`__fixtures__/canvasFixtures.ts` + a single `ALL_FIXTURES` sweep list — a fixture that is not registered cannot be silently skipped"
  - "a snapshot suite pairs structural invariants (the real gate) with `toMatchSnapshot()` (the drift tripwire), never the snapshot alone"

requirements-completed: [CANVAS-01]

# Metrics
duration: 20min
completed: 2026-07-25
---

# Phase 183 Plan 05: canvasModel + the SC#4 Fixture Corpus Summary

**`toCanvas` is now the pure, deterministic, non-mutating projection that carries this phase — its
sequential edge derived by the same `phase_index + 1` lookup the server's reachability linter uses, so
the `[0,1,3]` gap provably yields one edge and no phantom bridge — proven across a 15-fixture corpus
transcribed from checked-in migrations and seed scripts, with 195 new green tests and two mutation
checks confirming the purity controls actually fire.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-25T21:05:28Z
- **Completed:** 2026-07-25T21:25:50Z
- **Tasks:** 3 of 3
- **Files created:** 6 (0 modified)

## The contract plan 183-06 must agree with (verbatim)

### `CANVAS_LAYOUT` — the exact values

| Key | Value | What it governs |
|---|---|---|
| `NODE_WIDTH` | `260` | Uniform card width; content wraps, never widens |
| `NODE_MIN_HEIGHT` | `96` | The floor; the card grows DOWNWARD from here |
| `PITCH_X` | `320` | Horizontal distance between adjacent phase columns |
| `LANE_Y` | `0` | The single spine lane every phase node sits on |
| `SKIP_LANE_Y` | `200` | The lane where an unresolved-skip stub is parked |
| `EDGE_ANCHOR_Y` | `28` | Handle offset from the node TOP — **never 50%** |
| `END_CAP_SIZE` | `40` | The ○ end cap's square size |

UAT row U-2 passes **by construction**: the 5-phase maximum spans `4 × 320 + 260 = 1,540px`, inside
sketch 136-B's measured ~1,600px budget. Asserted in both `canvasModel.test.ts` and the fixture sweep.

### The type-string vocabulary

Node `type` (183-06's `nodeTypes` map keys — exported as `CANVAS_NODE_TYPES`):

| `type` | Data shape | Interactivity |
|---|---|---|
| `"phase"` | `PhaseNodeData` | `draggable: false`, `ariaRole: "button"`, `ariaLabel` set — the ONLY selection target |
| `"unresolvedSkip"` | `UnresolvedSkipNodeData` | `draggable/selectable/focusable: false` |
| `"endCap"` | `{}` | `draggable/selectable/focusable: false` |

Edge `data.kind` (exported as `CANVAS_EDGE_KINDS`) — **there is no edge `type` field; styling is
183-06's job via `defaultEdgeOptions`**:

| `kind` | Edge id form | Meaning |
|---|---|---|
| `"flow"` | `seq:<from>-><to>` | The run-order `phase_index + 1` link |
| `"skip"` | `skip:<from>-><target>` / `skip:<from>->?<target>` | A resolved / a BROKEN `skip_to_phase` branch |
| `"end"` | `end:<terminal>-><capId>` | The terminal phase → the ○ end cap |

`PhaseNodeData` fields: `slug`, `phaseIndex`, `phaseType`, `title` (plain-language),
`technicalTitle` (`"<label> · <slug>"`), `subtitle` (`""` for an unknown type), `grounding`
(`{ mode, words, glyph }`), `waitsForYou`. **Both title forms ride on every node** — the ⌥ reveal is a
render-time choice, which is what keeps `toCanvas` a function of the definition alone.

`UnresolvedSkipNodeData`: `declaredTarget`, `fromSlug`.

Reserved ids are namespaced `__canvas__…` and escaped with a leading `_` while taken, so a slug
spelling `__canvas__end` cannot collide (asserted).

## Accomplishments

- **The phantom edge is impossible, not merely absent.** `byIndexValue.get(phase.phase_index + 1)`
  mirrors `reachability.py:164` line-for-line. Two tests assert the gap case from both sides: exactly
  one `flow` edge, and `edges.some(e => e.source === "b" && e.target === "d") === false`.
- **A broken `skip_to_phase` is now VISIBLE.** The shipped spine drops it silently
  (`slugSet.has(target)`); the canvas emits an `unresolvedSkip` stub plus an edge terminating on it,
  agreeing with the backend's `UNSATISFIABLE_SKIP` verdict. No edge ever targets a non-emitted id.
- **Order-independence is unconditional.** The sort comparator is total (index, then slug), so even a
  malformed definition with duplicate `phase_index` values projects identically from any input order.
  Asserted for all 15 fixtures.
- **The purity controls were proven to fire.** Planting `Date.now()` turned the suite red (1 failed);
  mutating the input inside `toCanvas` turned it red (14 failed). Both reverted, `git status` on the
  module empty afterwards. A control nobody has seen fail is a decoration.
- **The corpus cannot drift.** Every fixture is transcribed from a checked-in artifact with a
  `file:line` citation; the module performs no I/O; `ALL_FIXTURES` is the single sweep list.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1a | Failing canvasModel behaviour spec (TDD RED) | `e1758acf` | test |
| 1b | `canvasModel.toCanvas` — the pure projection (TDD GREEN) | `cd53a5c9` | feat |
| 2 | The SC#4 fixture corpus + sweep + 15 snapshots | `0a3ade75` | test |
| 3 | The D-183-12 / G-6 purity tripwire | `ce2095aa` | test |

No REFACTOR commit — the GREEN implementation needed no cleanup pass.

## Files Created

- `canvasModel.ts` — **339 lines**. Docblock, `CANVAS_LAYOUT`, `CANVAS_NODE_TYPES`,
  `CANVAS_EDGE_KINDS`, the three data shapes + node/edge union types, `reservedId`, `ariaLabelFor`,
  `buildPhaseData`, `toCanvas`.
- `canvasModel.test.ts` — **366 lines / 26 tests** across 8 describe blocks, one assertion per
  behaviour row in the plan.
- `__fixtures__/canvasFixtures.ts` — **362 lines / 15 fixtures** + `ALL_FIXTURES`.
- `canvasModel.fixtures.test.ts` — **143 lines / 100 tests** (4 corpus-coverage + 6 × 15 swept + 6
  targeted).
- `__snapshots__/canvasModel.fixtures.test.ts.snap` — **1,513 lines**, 15 snapshots, committed.
- `canvasModel.purity.test.ts` — **129 lines / 69 tests** (4 × 15 parametrized + the planted-key
  control + the layout-constant guard + 6 `?raw` source greps).

## The corpus (15 entries)

| Fixture | Phases | Source |
|---|---|---|
| `research_summarize` | 2 | `backend/tests/conftest.py:852-866` |
| `plan_execute_verify` | 3 | `backend/tests/conftest.py:867-892` |
| `literature_review` | 3 | `backend/tests/conftest.py:893-912` |
| `doc_qa_human` | 3 | `backend/tests/conftest.py:913-932` |
| `risk-register` | 2 | `migrations/094_starter_workflows.sql:59-109` |
| `weekly-status-report` | 2 | `migrations/094_starter_workflows.sql:114-164` |
| `compliance-gap-report` | 2 | `migrations/094_starter_workflows.sql:169-219` |
| `pm-weekly-status-report` | 2 | `scripts/seed-pm-pack.py:104-109,353-389` |
| `pm-risk-register` | 2 | `scripts/seed-pm-pack.py:110-114,353-389` |
| `eval_coverage` | 5 | `migrations/066_eval_coverage_seed.sql:61-124` |
| empty draft | 0 | hand-authored, test-only (D-183-11) |
| single phase | 1 | hand-authored, test-only |
| branching | 4 | hand-authored, test-only (D-183-09) |
| unresolvable skip | 2 | hand-authored, test-only (D-183-10) |
| non-contiguous `[0,1,3]` | 3 | hand-authored, test-only (C-2) |

All six phase types covered; node counts 0, 1, 2, 3 and 5 covered. The four canonical seeds were
transcribed from the conftest mirror and **cross-checked against
`migrations/061_harness_seed_templates.sql:53-246`** — slugs, indices, phase types and the single
`regex_match`/`retry` validator agree exactly.

## Decisions Made

- **A total sort comparator, not just `phase_index`.** The plan only required index sorting, but with
  a duplicate `phase_index` a stable sort makes output depend on input array order — which would have
  made the order-independence property conditional on well-formed input. The slug tiebreak removes
  that footgun for one extra clause.
- **`data.kind` carries the edge classification, not `edge.type`.** The RESEARCH skeleton used
  `type: "flow"`. Setting `Edge.type` would make xyflow look up an `edgeTypes` entry named `flow` and
  fall back with a warning when 183-06 has not registered one. `data.kind` is inert data the view can
  style however it likes, which is exactly the model/view split the plan asked for.
- **Dedupe by id on both nodes and edges.** Two validators on one phase can declare the same skip
  target; without a guard that emits duplicate node and edge ids, which React Flow renders
  unpredictably. A `repeated validators` test pins it.
- **The end cap edge is `end:<from>-><capId>`, not id-less.** Every edge needs a stable id for the
  snapshot to be a real tripwire.

## Deviations from Plan

### Acceptance criteria executed with a stated adjustment

**1. `cd frontend && npx tsc -b` exits 0 → executed as the plan-01 differential.** Both Task 1 and
Task 2 name this. Per D-ITEM-183-01 it is unachievable at baseline (`develop` is red with 33
pre-existing signatures across ~20 unrelated files). Executed as the inherited differential: after all
three tasks the count is **still exactly 33**, and `grep -c "canvasModel\|canvasFixtures"` over the
full `tsc -b` output is **0** — this plan added no type error. `npx vite build` is the hard gate and
**exits 0** after every task.

**2. `git status --porcelain backend supabase scripts` is empty → executed as a differential.** The
working tree carries ~400 files of pre-existing unrelated dirt (documented in the execution brief),
including entries under `scripts/` and the platform snippets directory. The verifiable form of the
criterion — *this plan touched no backend source, no migration, no seed script* — was executed
instead and passes: `git diff --name-only e1758acf~1..HEAD` lists **six files, all under
`frontend/src/components/workflows/`**.

**3. Fixture source citations omit the platform directory prefix.** Task 2's acceptance requires
`grep -cE "psycopg2|postgres://|localhost:54322|supabase" …` to return `0`, AND requires every fixture
to cite its checked-in source `file:line`. Three of those sources live under the platform's
`migrations/` directory, whose full repo path contains the forbidden token — the guard binds the
file's own comments (the exact class of collision plan 183-02 hit with `grounding_mode`, and 183-04
with `PHASE_GLYPHS`). Resolved by citing SQL sources as `migrations/NNN_*.sql`, with the convention
and its reason stated in the module docblock. The guard's intent (transcribed, never read live) is
fully satisfied: the module performs no I/O and imports nothing but a type. Guard returns **0**.

### Auto-fixed issues

None. No bug, no missing critical functionality, no blocking issue arose — the three suites went
green on their first run after the RED step.

**Total deviations:** 0 auto-fixed + 3 acceptance criteria executed with stated, evidenced
adjustments. No scope creep; no file outside the plan's `files_modified` list was touched.

## Issues Encountered

- **A pre-existing full-suite interference flake nearly read as a regression.**
  `PublishGauntlet.test.tsx` is green in isolation (24/24) and green in the workflows-directory run
  (345/345) but fails under full-suite concurrency. Rather than assume, the full suite was re-run with
  `--exclude "**/canvasModel*.test.ts"`: the **same 10 suites** fail without this plan's files
  (33 failures vs 34 — one-test variance inside the streaming family). The failing NAME set is
  unchanged. Recorded here because the cheap read ("PublishGauntlet fails, and I touched the workflows
  directory") would have been wrong.
- **Nothing else.** No toolchain surprise, no snapshot instability, no path arithmetic error.

## Verification Results

| Gate | Result |
|---|---|
| `npx vitest run …/canvasModel.test.ts` | **26 passed / 26** ✅ |
| `npx vitest run …/canvasModel.fixtures.test.ts` | **100 passed / 100** ✅ |
| `npx vitest run …/canvasModel.purity.test.ts` | **69 passed / 69** ✅ |
| all three together | **195 passed / 195** ✅ |
| snapshot re-run | **0 written, 0 obsolete** ✅ (15 committed) |
| `npx vitest run src/components/workflows` | **345 passed / 0 failed**, 12 files ✅ (baseline 150/0 → +195, no new failing name) |
| full `npx vitest run` | 2,133 tests, **34 failed** ⚠️ — identical failing SUITE set to the same run with this plan's files excluded (1,938 tests / 33 failed). Pre-existing rot (SEED-056 family) |
| `npx tsc -b` | 33 signatures — **identical to the 183-01 baseline, 0 new, 0 from our files** ⚠️ D-ITEM-183-01 |
| `npx vite build` | **exit 0** ✅ (run after every task) |
| Mutation check: plant `Date.now()` | purity suite **1 failed** → reverted, 69/69 ✅ |
| Mutation check: mutate the input | purity suite **14 failed** → reverted, 69/69, `git status` clean ✅ |
| `grep -c "phase_index + 1" canvasModel.ts` | **4** ✅ (≥ 1 required) |
| `grep -cE "ordered\[i ?\+ ?1\]\|ordered\[index ?\+ ?1\]"` | **0** ✅ |
| `grep -cE "getBoundingClientRect\|offsetHeight\|offsetWidth\|document\.\|window\.\|Date\.now\|Math\.random\|fetch\("` | **0** ✅ |
| `grep -c "@/lib/api" canvasModel.ts` | **0** ✅ |
| `grep -c "^import type" / value-import from "@xyflow/react"` | **1 / 0** ✅ (types-only) |
| `grep -cE "psycopg2\|postgres://\|localhost:54322\|supabase" canvasFixtures.ts` | **0** ✅ |
| `grep -c 'type === "phase"' canvasModel.fixtures.test.ts` | **4** ✅ (≥ 1 required) |
| `git diff --name-only` for this plan | **6 files, all `frontend/src/components/workflows/`** ✅ |

## Threat Model Compliance

- **T-183-04 (layout leaking into `workflow_definitions.definition`):** mitigated AND proven. The
  recursive `position` / `x` / `y` / `layout` walk runs over the INPUT after every one of the 15
  fixture calls, and a planted-key control asserts the walk actually finds one. The input-mutation
  mutation check turned 14 tests red, so the non-mutation assertion is load-bearing.
- **T-183-06 (a malformed definition crashing the projection):** mitigated. Totality is inherited from
  `phaseVocabulary` (unknown `phase_type` echoes, unknown validator kind ignored, malformed
  `on_failure` returns null, missing `validators` defaults to `[]`) and extended here: duplicate and
  non-contiguous `phase_index` values are handled by lookup rather than array arithmetic, and a slug
  colliding with the reserved namespace is resolved deterministically. All asserted.
- **T-183-07 (the canvas edge set disagreeing with the server adjacency):** mitigated. The sequential
  edge is the `phase_index + 1` lookup; the gap fixture asserts the absence of the bridging edge by
  name; the unresolvable case agrees with `UNSATISFIABLE_SKIP` instead of dropping.
- **T-183-10 (a client call leaking definition content):** accepted as planned and now asserted —
  no `@/lib/api` import, no `workflows/validate` reference, no `fetch(`. There is nothing to leak.
- **ASVS conclusion INTACT.** Frontend-only: zero backend files, zero routes, zero migrations. The
  "this conclusion is VOID" condition did **not** trigger.

## Known Stubs

None. `toCanvas` is fully implemented and every branch is exercised by a green assertion. The module
has no rendering consumer yet **by design** — plan 183-06 builds the view that mounts it.

## User Setup Required

None — no dependency, no env var, no migration, no cloud parity owed.

## Next Phase Readiness

**Ready.** Hand-offs, explicitly:

- **183-06 (the view)** — map `nodeTypes` to exactly `"phase"` / `"unresolvedSkip"` / `"endCap"` and
  read `CANVAS_LAYOUT` for every CSS number (do not re-type the literals). Per the 183-01 A1 verdict,
  `PhaseNode` **MUST** render a hidden target + source `<Handle>` or zero edges paint; anchor them at
  `top: CANVAS_LAYOUT.EDGE_ANCHOR_Y`, never `50%`. Edges carry `data.kind`, **not** `edge.type` — set
  arrow markers and dashed/solid styling via `defaultEdgeOptions` keyed off `data.kind`. Every phase
  node already carries `title` AND `technicalTitle`, so the ⌥ reveal is a pure render switch; the
  emitted `ariaLabel` uses the plain-language form.
- **183-06 (empty state)** — `toCanvas([])` returns `{ nodes: [], edges: [] }` with no cap and no
  ghost node; D-183-11 requires the view to suppress the plane, grid, zoom controls and minimap
  entirely in that case.
- **184 (editable canvas)** — this is the seam that must stay one-way. If 184 adds persistence it must
  not write layout back into the definition; the purity walk in `canvasModel.purity.test.ts` is the
  tripwire that will catch it.
- **185 (graded governance)** — `PhaseNodeData.grounding` is the field a graded dial replaces; its
  `Grounding` shape already widens cleanly.
- **All 183 plans** — `tsc -b` remains a differential against 33; `vite build` remains exit-0.

No blockers.

## Self-Check: PASSED

Files verified present on disk:

- FOUND: `frontend/src/components/workflows/canvasModel.ts`
- FOUND: `frontend/src/components/workflows/canvasModel.test.ts`
- FOUND: `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts`
- FOUND: `frontend/src/components/workflows/canvasModel.fixtures.test.ts`
- FOUND: `frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap`
- FOUND: `frontend/src/components/workflows/canvasModel.purity.test.ts`

Commits verified in `git log`:

- FOUND: `e1758acf` — test(183-05): add the failing canvasModel behaviour spec (TDD RED)
- FOUND: `cd53a5c9` — feat(183-05): add canvasModel.toCanvas — the pure definition->canvas projection
- FOUND: `0a3ade75` — test(183-05): add the SC#4 fixture corpus and the projection sweep
- FOUND: `ce2095aa` — test(183-05): add the D-183-12 / G-6 purity tripwire for canvasModel

---
*Phase: 183-read-only-canvas*
*Completed: 2026-07-25*
