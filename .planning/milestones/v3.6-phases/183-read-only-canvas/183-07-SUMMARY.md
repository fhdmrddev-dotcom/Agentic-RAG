---
phase: 183-read-only-canvas
plan: 07
subsystem: frontend
tags: [workflows, canvas, builder, feature-flag, fail-closed, code-split, lazy, tablist, a11y]

# Dependency graph
requires:
  - phase: 183-read-only-canvas
    plan: 03
    provides: "`useEffectiveFeaturesOptional` + the null-context-is-fail-closed rule this page's gate implements"
  - phase: 183-read-only-canvas
    plan: 04
    provides: "the one ⌥ Technical-names reveal both graph views spend (consumed inside WorkflowCanvas, untouched here)"
  - phase: 183-read-only-canvas
    plan: 06
    provides: "`WorkflowCanvas` — the drop-in peer with a prop set byte-identical in shape to `PhaseSpineGraphProps`, plus a default export"
  - phase: 183-read-only-canvas
    plan: 01
    provides: "the pre-xyflow `vite build` chunk baseline the A6 measurement is read against, and the 33-signature `tsc -b` differential"
  - phase: 181-revert-foundation
    provides: "the `visual_workflow_canvas` flag, the Off|On operator card, and `revertByteIdentical.test.tsx`'s scope-freeze gate"
  - phase: 103-workflow-studio
    provides: "`WorkflowBuilderPage`'s push grid + the 400px `PhaseFormPanel` the click opens"
provides:
  - "the flag-gated `[≣ Spine] [⬡ Canvas]` toggle on the Builder's graph column — the ONLY door to the canvas in the app"
  - "the D-183-03 flag-off DOM proof in five render variants"
  - "the A6 verdict as a measurement: `WorkflowCanvas-*.js` is a SEPARATE 174.16 kB / 55.39 kB gzip chunk; the lazy boundary is KEPT"
  - "the corrected `revertByteIdentical.test.tsx` docblock — the last of the four stale in-code claims this phase found"
affects: [184-editable-canvas, 185-graded-governance, 188-run-observability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "flag-off byte-identity by CONSTRUCTION: the gated branch renders the shipped element with no wrapper at all, so 'nothing reserves space' is one `firstElementChild` assertion rather than a CSS argument"
    - "the flag out-ranks stale session state (`activeGraphView = canvasEnabled ? graphView : \"spine\"`), so a mid-session tighten cannot strand a user on a surface that just vanished"
    - "a `React.lazy` boundary is justified by a measured chunk listing, not by an assumption about bundler behaviour"

key-files:
  created:
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/admin/revertByteIdentical.test.tsx

key-decisions:
  - "Flag OFF renders `graphChild` DIRECTLY as the grid's first child — no wrapper div — so the flag-off DOM is provably the column that shipped, not merely a visually similar one"
  - "The plan's stated mutation (`=== true` → truthy) is VACUOUS: `undefined` is falsy, so a truthy gate still hides an absent key. The real strictness mutation is `!== false`, which was run and fails 3 tests"
  - "`waitFor` on the two lazy-mount waits carries an explicit 10 s timeout — the dynamic import exceeds Testing Library's 1 s default under a full-suite parallel run, which would have read as a NEW failing name"
  - "The A6 lazy split is KEPT on measured evidence: 55.39 kB gzip never reaches a flag-off user, and the flag cold-defaults to off for everyone"

patterns-established:
  - "when a plan's acceptance grep binds a comment rather than a call, reword the COMMENT and state why inline — the fifth instance of D-ITEM-183-02 in this phase"

requirements-completed: [CANVAS-01]

# Metrics
duration: 22min
completed: 2026-07-25
---

# Phase 183 Plan 07: The Builder Canvas Door Summary

**The canvas now has a door: a `[≣ Spine] [⬡ Canvas]` toggle on the Builder's existing graph column
that appears only when `visual_workflow_canvas` resolves strictly true on a resolved map, swaps one
grid child for a lazily-imported peer fed the identical three props, and — with the flag off —
renders the shipped spine element as the grid's first child with no wrapper, no strip and no
`.react-flow` root anywhere, proven in five render variants. `@xyflow` lands in its own 55.39 kB gzip
chunk that a flag-off user never downloads.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-25T22:04:31Z
- **Completed:** 2026-07-25T22:26:20Z
- **Tasks:** 3 of 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **CANVAS-01 is now TRUE.** All seven plans claimed the requirement and the prior six deliberately
  did not mark it complete, because its text ("a user can view an existing definition as a node
  canvas … opening it performs no network call and writes nothing") is only satisfied once a user can
  actually reach the canvas. This plan lands that reach, and the no-write half is asserted rather
  than asserted-about: mounting the Builder, switching to Canvas and selecting a node calls neither
  draft mutation and neither generate.
- **Flag-off byte-identity is structural, not cosmetic.** With the flag off the graph column is
  `<PhaseSpineGraph>` itself — the same element, in the same grid slot, with no wrapper introduced —
  so the "no reserved space" clause of D-183-03 is a single `firstElementChild` assertion. All five
  variants (absent key / explicit `false` / operator-like map / no provider / still loading) assert
  the toggle absent, `.react-flow` absent, and that first child.
- **Each of the three gate clauses was mutated red and reverted.** `!== false` (the real strictness
  mutation) fails 3 tests; dropping `!featuresCtx.loading` fails the loading test; the plan's own
  suggested truthy mutation fails only the source guard, and that fact is recorded below rather than
  papered over.
- **A6 is answered by the build, not by the assumption.** `grep -l xyflow dist/assets/*.js` names
  exactly one file and it is NOT the entry: `dist/assets/WorkflowCanvas-DWoW14H5.js`, 174.16 kB /
  55.39 kB gzip. The main entry did not grow. The lazy boundary is kept.
- **The last stale in-code claim in this phase is corrected**, with zero assertions touched — the
  181 scope-freeze guard remains byte-identical and green.
- **Zero new failing names in the full suite**, and the total test count rose to 2,175 (baseline
  1,877), with the `soulData` glyph name gone as plan 183-04 promised.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | The flag-gated toggle + the graph-column swap | `5131e030` | feat |
| 2 | The flag-off vanish proof + the canvas wiring test | `c7200d45` | test |
| 3 | Correct the stale claims, measure A6, record the differential | `b23f77dd` | docs |

## The A6 lazy-chunk measurement (the deliverable this plan owed)

Measured AFTER the mount site existed — the 183-06 warning that a pre-mount measurement would read
as a false positive was honoured.

| Asset | Plan 183-01 (pre-xyflow) | Plan 183-06 (canvas built, unmounted) | This plan (canvas MOUNTED) |
|---|---|---|---|
| `dist/assets/index-*.js` (main entry) | 1,726.81 kB │ gzip 434.24 kB | 1,727.32 kB │ gzip 434.40 kB | **1,726.26 kB │ gzip 434.13 kB** |
| A chunk whose source contains `xyflow` | none | none | **`WorkflowCanvas-DWoW14H5.js`** |
| That chunk's size | — | — | **174.16 kB │ gzip 55.39 kB** |
| Total emitted JS chunks | 308 | 308 | **311** |
| `npx vite build` | exit 0 | exit 0 | **exit 0** |

**Verdict: KEEP the `lazy` / `<Suspense>` wrapper.** The xyflow JS did not enter the entry chunk at
all — the entry is 0.55 kB *smaller* than the pre-xyflow baseline (chunk-graph noise, well inside
run-to-run variance). The saving is real and it is the whole 55.39 kB gzip, because
`visual_workflow_canvas` cold-defaults to `"off"` for every user
(`backend/app/models/user_settings.py:1086-1092`), so today literally nobody downloads it. The
counterfactual the plan asked to guard against — "if the bundler hoists it into the entry anyway,
remove the wrapper" — did not occur, so no wrapper was removed.

The **stylesheet** remains the part that cannot be split: +15.41 kB raw / +2.33 kB gzip is paid
eagerly by everyone including flag-off, the documented plan 183-01 trade (deferring it would make
cascade order relative to Tailwind non-deterministic).

## The phase-level suite differential (how this phase is graded)

| Measure | Recorded baseline | Plan 183-06 | **This plan** |
|---|---|---|---|
| Total tests | 1,877 | 2,158 | **2,175** (+17 = exactly this plan's new file) |
| Failed | 33 (flaky 28–35) | 31 | **33** |
| Failed files | 10 of 205 | 10 | **10 of 213** |
| `soulData` glyph name in the failing set | present (RED since Phase 127) | **removed** | **still removed** ✅ |

**Failing NAME SET — no name introduced by this plan.** Nine of the ten failing files are the
documented pre-existing set: `PublishGauntlet.test.tsx` (9), `streamsProvider.test.tsx` (7),
`StreamsProvider.dedup.test.ts` (2), `streamsProvider_075_9_clientkey.test.tsx` (1),
`IngestionPage.test.tsx` (4), `MessageItem.test.tsx` (1), `useMessages.test.ts` (1),
`Plan04.frontend.test.tsx` (1), `model-info.test.ts` (1) — the SEED-056 rot plus the documented
parallel-load flake.

**The tenth needs naming honestly:** `WorkflowCanvas.test.tsx › has no axe violations on a rendered
canvas` failed under the full parallel run with `Error: Test timed out in 5000ms` — a load timeout,
not an assertion failure, in a file this plan did not touch. In isolation
`npx vitest run src/components/workflows` is **370 passed / 0 failed**, byte-matching the 183-06
baseline. It is the same flake family as PublishGauntlet (which is likewise 24/24 green in
isolation). Recorded rather than hidden, because a failures-only read would have shown "33 ≈ 33, fine".

**Zero failures from this plan's own files:** `WorkflowBuilderPage.canvas.test.tsx` (17),
`WorkflowBuilderPage.test.tsx` (15) and `revertByteIdentical.test.tsx` (7) are all green in the full
run and in isolation.

## Files Created/Modified

- **`frontend/src/pages/WorkflowBuilderPage.tsx` — +164 / −6.** A 45-line docblock section
  (D-183-01 … D-183-05, the code-split argument, the two scope fences), the `lazy` declaration at
  module scope, one `useState<"spine" | "canvas">`, the three-clause gate + `activeGraphView`, one
  `useCallback` selection contract, the `graphChild` / `graphColumn` pair, and the segmented control.
  **Removed lines: exactly two things** — the React import line and the old inline
  `<PhaseSpineGraph …/>` mount. No save path, no `draftId` / `draftIdRef` / `creatingRef` /
  `onPersist` / `onSaveDraft` line appears in the diff at all.
- **`frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — 329 lines / 17 tests** across 5
  describe blocks: flag-off ×5, flag-on ×3, selection ×3, no-writes ×1, source guards ×5.
- **`frontend/src/components/admin/revertByteIdentical.test.tsx` — +10 / −3, comment text only.**

## Decisions Made

- **Flag off renders the spine with NO wrapper.** The plan asked for the strip to live "inside the
  graph column, above the graph". The literal reading — always wrap the column in a flex container
  and conditionally render the strip inside it — would have introduced a permanent net-new DOM
  element for flag-off users, which is exactly what D-181-07's *observable* definition of
  byte-identity forbids. Instead `canvasEnabled` selects between the bare `graphChild` and a wrapper
  containing the strip plus that same `graphChild`, so the two branches share one child expression
  and the flag-off DOM is provably today's. The wrapper uses
  `grid-rows-[auto_minmax(0,1fr)]` so both `<section className="h-full">` children (spine and canvas)
  size identically without either being told about the strip.
- **`activeGraphView`, not `graphView`, drives the render.** A tightened map mid-session must not
  strand a user on a surface that just vanished, and it must not leave stale state able to
  out-rank the flag on the next re-render.
- **One `useCallback` feeds both views.** The shipped inline arrow was lifted to `handleSelectNode`
  rather than duplicated, so "both views share one selection contract" (D-183-05) is structural —
  it cannot drift into two subtly different toggle-off semantics.
- **`fireEvent.click` throughout the new suite.** Inherited verbatim from 183-06's finding: a
  `user-event` click inside the canvas plane also dispatches `mousedown`, reaching d3-zoom, and
  d3-drag dereferences a null `event.view` under jsdom — every assertion passes and vitest exits 1.
  Using one driver for both the plane and the toggle keeps the file free of that trap.
- **The `?raw` guards are anchored on call/prop forms.** `useEffectiveFeaturesOptional\(\)`,
  `useEffectiveFeaturesContext\(`, the full `lazy(() => import("…"))` expression — never a bare
  identifier, which is the collision plans 183-02/03/04/05/06 each paid for.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two of the new tests failed under a parallel run while passing in isolation**

- **Found during:** Task 2, the `src/pages src/components/workflows` sweep
- **Issue:** `clicking Canvas flips aria-selected and mounts the canvas` and `clicking a canvas node
  opens the shipped 400px form panel` both failed with `expected null not to be null` at ~1.5 s. The
  cause is the `React.lazy` dynamic import: under a 27-file parallel run the chunk transform exceeds
  Testing Library's **1 s default `waitFor` timeout**. Left alone this is precisely the failure this
  phase grades on — a NEW failing name that appears only in the full-suite differential.
- **Fix:** a single named `const LAZY = { timeout: 10_000 }` applied to the waits that depend on the
  lazy mount, with an inline comment stating that widening the WAIT changes no assertion — the same
  DOM must still appear.
- **Files modified:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`
- **Verification:** `npx vitest run src/pages src/components/workflows` → the only remaining failures
  are the pre-existing PublishGauntlet flake; the full suite carries zero names from this file.
- **Committed in:** `c7200d45` (Task 2 commit)

### Acceptance criteria executed with a stated adjustment

**1. `npx tsc -b` exits 0 → executed as the plan-01 differential (inherited, unchanged from plans
01-06).** Per **D-ITEM-183-01** this is unachievable at baseline: `develop` is red with 33
pre-existing signatures across ~20 unrelated files. After all three tasks the count is **still
exactly 33**, and `grep -cE "WorkflowBuilderPage|revertByteIdentical"` over the full `tsc -b` output
is **0**. `npx vite build` is the hard gate and **exits 0**.

**2. `grep -c "useEffectiveFeaturesOptional" …` returns 1 → returns 2, which is the MINIMUM
possible.** The import statement plus the single call site. The criterion's intent — the OPTIONAL
accessor is what the page reads, and the throwing one is not used — holds exactly:
`grep -c "useEffectiveFeaturesContext"` is **0**, and there is exactly one call. Identical in shape
to plan 183-06's `useTechnicalNamesOptional` adjustment.

**3. "temporarily changing the gate from `=== true` to a truthy check makes the 'flag absent' test
fail" → the mutation as written is VACUOUS, and the honest mutation was run instead.** `features` is
`Partial<Record<GovernedFeature, boolean>>`, so an absent key is `undefined`, which is falsy — a
truthy gate hides it just as a strict one does. Running that mutation
(`Boolean(featuresCtx.features.visual_workflow_canvas)`) failed **1** test, and it was the *source
guard*, not a behavioural one. The mutation that actually exercises strictness is `!== false`:

| Mutation | Failing tests | Which |
|---|---|---|
| `=== true` → `Boolean(…)` (as the plan wrote it) | 1 | the source guard only — no behavioural change |
| `=== true` → **`!== false`** (the real strictness mutation) | **3** | flag ABSENT, OPERATOR-LIKE map, + the source guard |
| drop `!featuresCtx.loading` | **1** | STILL LOADING |

All three were reverted and the suite re-verified at 17/17, `git diff --stat` empty on the source
file before the commit.

**4. `grep -c "lands WITH the view in 183" …` returns 0 → satisfied on the second attempt.** The
first correction QUOTED the released sentence while explaining that it was released, which made the
guard bind the corrective prose. Reworded to describe the released note without reproducing it, with
the reason stated inline. **This is the fifth instance in this phase of a grep guard binding a
comment or a prefix rather than the real thing** (183-02 `grounding_mode`, 183-03 `useEffect`,
183-04 `PHASE_GLYPHS`, 183-05 the migrations path, 183-06 `dangerouslySetInnerHTML`), and the same
trap fired twice more inside Task 1 alone: the docblock's `<nav>` and `createWorkflowDraft` mentions
each broke their own acceptance grep and were reworded. Logged as **D-ITEM-183-02**.

**5. `npx vitest run src/pages src/components/workflows` reports zero failures → executed as the
isolation differential.** `PublishGauntlet.test.tsx` fails 2-3 tests under parallel load and is
**24/24 green in isolation**; `src/components/workflows` alone is **370 passed / 0 failed**,
byte-matching the 183-06 baseline. This is the documented pre-existing flake, not this plan's.

**6. `git status --porcelain backend/app supabase scripts` empty → executed as a differential.** The
working tree carries ~400 files of pre-existing unrelated dirt (documented in the execution brief).
The verifiable form passes: `git diff --name-only cc4e7a66..HEAD` lists **three files, all under
`frontend/src/`**, with zero backend source, zero migrations, zero seed scripts.

**Total deviations:** 1 auto-fixed (Rule 1, inside this plan's own new test file) + 6 acceptance
criteria executed with stated, evidenced adjustments. No scope creep; no file outside the plan's
`files_modified` list was touched.

## Issues Encountered

- **A `React.lazy` boundary changes a suite's timing profile, and the default `waitFor` budget is
  1 second.** Worth carrying into Phase 184: any test that crosses a lazy boundary under parallel
  load needs an explicit timeout, or it becomes a load-dependent false-fail.
- **`WorkflowCanvas.test.tsx`'s axe test is now a load-timeout candidate** (5 s test timeout, 14 s
  file time under the full run). It is not this plan's regression — green in isolation — but it is a
  new member of the flake family and will keep appearing in full-suite name sets. Recorded for the
  verifier so it is not mistaken for a canvas defect.
- **Nothing else.** No toolchain surprise, no snapshot instability, no unexpected coupling.

## Verification Results

| Gate | Result |
|---|---|
| `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx` | **17 passed / 17, exit 0** ✅ (first run) |
| `npx vitest run src/pages/WorkflowBuilderPage.test.tsx` (the shipped suite, no provider) | **15 passed, exit 0** ✅ unaffected |
| `npx vitest run src/components/admin/revertByteIdentical.test.tsx` | **7 passed, exit 0** ✅ incl. the scope-freeze test |
| `npx vitest run src/pages src/components/admin src/providers src/test-utils` | **377 passed / 0 failed**, 40 files ✅ |
| `npx vitest run src/components/workflows` | **370 passed / 0 failed** ✅ byte-matches the 183-06 baseline |
| `npm test` (full) | 213 files, **2,175 tests, 33 failed** ⚠️ — 9 documented pre-existing suites + 1 load-timeout flake; **zero names from this plan's files**; total up from 1,877 |
| `npx tsc -b` | **33 signatures — identical to the 183-01 baseline, 0 new, 0 from our files** ⚠️ D-ITEM-183-01 |
| `npx vite build` | **exit 0** ✅ (run after every task) |
| `grep -l xyflow dist/assets/*.js` | **`WorkflowCanvas-DWoW14H5.js`** ✅ a non-entry chunk |
| `backend … pytest tests/unit/test_183_skip_parse_parity.py -q` | **13 passed** ✅ |
| Mutation: `=== true` → `!== false` | **3 failed** → reverted, 17/17, source restored ✅ |
| Mutation: drop `!featuresCtx.loading` | **1 failed** → reverted, 17/17, source restored ✅ |
| Mutation: `=== true` → truthy | **1 failed** (source guard only — the criterion is vacuous, see Deviation 3) |
| `grep -c "useEffectiveFeaturesOptional"` / `"useEffectiveFeaturesContext"` | **2 (import + call) / 0** ✅ |
| `grep -c "visual_workflow_canvas === true"` | **1** ✅ strict, not truthy |
| `grep -c 'lazy(() => import("@/components/workflows/WorkflowCanvas")'` | **1** ✅ at module scope (line 86) |
| `grep -cE 'role="tablist"\|role="tab"\|aria-selected'` / `grep -c "<nav"` | **5 / 0** ✅ |
| `grep -c "aria-pressed"` / `grep -cE "localStorage\|user_settings"` / `grep -c "reactflow"` | **0 / 0 / 0** ✅ |
| `grep -c "createWorkflowDraft"` | **5** ✅ exactly the pre-existing count |
| `builder-grid` inline `gridTemplateColumns` + `motion-safe:` classes | **absent from the diff** ✅ unchanged |
| save-path lines in the diff (`draftIdRef`/`creatingRef`/`onPersist`/`onSaveDraft`/`updateWorkflowDraft`) | **0** ✅ |
| `git diff -U0 …/revertByteIdentical.test.tsx` `expect(` lines changed | **0** ✅ comment text only |
| `grep -c "lands WITH the view in 183"` / `grep -c visual_workflow_canvas src/lib/nav-items.ts` | **0 / 0** ✅ |
| `npx eslint … -c eslint.a11y.config.js` (both changed source files) | **exit 0** ✅ A11Y-01 clean |
| `git diff --name-only cc4e7a66..HEAD` | **3 files, all `frontend/src/`** ✅ |

## Threat Model Compliance

- **T-183-02 (EoP — the client feature map is not the security boundary):** accepted as planned and
  unchanged. This plan adds no route, no endpoint and no gated data path — there is nothing new to
  bypass. `require_visible` (148-05) and `require_canvas`'s pre-auth 404 (181, D-181-02 / WR-02)
  remain the wall.
- **T-183-03 (Info disclosure — a governed surface flashing to a non-audience user):** mitigated and
  proven. The three-part gate is asserted across five render variants, and each clause was
  independently mutated red and reverted. Strict `=== true`, `!loading`, and null-context-fail-closed
  all fire.
- **T-183-12 (Tampering — opening a view mutating persisted state):** mitigated and proven. No save
  path appears in the diff; no published-workflow Tweak door was added; and the suite asserts that
  mounting the Builder, switching to Canvas and selecting a node calls `createWorkflowDraft` **0**
  times, `updateWorkflowDraft` **0** times and `generateWorkflow` **0** times.
- **T-183-SC (the lazily-imported chunk fetched at runtime):** accepted as planned. The dynamic
  `import()` resolves a same-origin, build-time-emitted asset with Vite's content hash
  (`WorkflowCanvas-DWoW14H5.js`) — no CDN, no runtime URL construction, no user-controlled specifier.
- **ASVS conclusion INTACT.** Frontend-only: three files, all under `frontend/src/`. Zero backend
  source, zero routes, zero migrations, no cloud parity owed. The "this conclusion is VOID" condition
  did **not** trigger, so the ROADMAP's "no threat model" flag for Phase 183 stands.

## Known Stubs

None. Every branch of the toggle is implemented and exercised by a green assertion.

**Deliberately not built (D-183-04, not a stub):** the published-workflow canvas door. Viewing a
published definition's canvas requires Tweak, whose draft-create call is an INSERT — so merely
looking would mint a v(N+1) row. The re-open trigger is Phase 184 (if the editable canvas needs a
view-only sibling) or Phase 188 (a run view opening a canvas nobody can edit). The library card's
existing glyph-dot `PhaseSpine` continues to cover the at-a-glance read for published workflows.

## ⚠ OUTSTANDING — the four G-4 lived-experience UAT rows

**`183-VALIDATION.md`'s U-1 … U-4 are NOT satisfied by this plan and cannot be automated away.** They
are operator-defined "I'd recognise failure here" scenarios and MUST be driven live (Chrome MCP or
operator-clicks) **before `/gsd:verify-work`**. Wire format and screenshots are explicitly
insufficient. All four are now reachable for the first time, because this plan is what puts the
toggle on screen:

| Row | Scenario | How to reach it now |
|---|---|---|
| **U-1** | Spine ⇄ Canvas agree — same steps, same order, same icons, nothing in one view and not the other | Open a real draft in the Builder, flip `[≣ Spine] [⬡ Canvas]` both ways |
| **U-2** | The 5-phase maximum reads — titles not truncated to nonsense, **no horizontal page overflow**, the `○ end` cap visible | Open `eval_coverage` (the only 5-phase definition) on Canvas |
| **U-3** | The empty draft doesn't look broken — no stray grid, zoom pills or minimap floating in space | Open any zero-phase draft on Canvas |
| **U-4** | Flag off = yesterday's Builder, **including on an operator account** (D-181-01) | Control Room → `visual_workflow_canvas` → Off → reload |

**Operator prerequisite for U-1/U-2/U-3:** the flag cold-defaults to `"off"`, so the Control Room's
`visual_workflow_canvas` row must be flipped **On** (audience `"everyone"`) before the toggle is
visible at all. U-4 flips it back.

## User Setup Required

None for the code — no dependency, no env var, no migration, no cloud parity owed. The only manual
step is the operator flag flip described above, and only to exercise the UAT rows.

## Next Phase Readiness

**Ready — Phase 183 is complete.** Hand-offs, explicitly:

- **184 (editable canvas)** — upgrade `WorkflowCanvas` IN PLACE; the mount site, the flag gate and the
  lazy boundary need no change. D-183-02 explicitly hands 184 the decision of whether to flip the
  default view to Canvas; if it does, the `useState<"spine" | "canvas">("spine")` initialiser and the
  D-183-02 docblock paragraph are the two lines to change together. Persisting the preference is
  still deferred. Any test crossing the lazy boundary needs the explicit `waitFor` timeout.
- **185 (graded governance)** — the toggle is the only door; a graded dial reaches the user through
  `PhaseNode`'s `data-grounding` seam, not through this page.
- **188 (run observability)** — `CanvasRunView` will want a canvas that opens on a PUBLISHED
  definition without forking a draft; that is the D-183-04 deferred door, and 188 is one of its two
  named re-open triggers.
- **All future work on this file** — the flag-off branch renders `graphChild` with **no wrapper**.
  Anyone adding chrome to the graph column must keep that branch bare or the D-181-01 byte-identity
  contract breaks silently; `WorkflowBuilderPage.canvas.test.tsx`'s `firstElementChild` assertion is
  the tripwire.
- **`tsc -b` remains a differential against 33** (D-ITEM-183-01); `vite build` remains a hard exit-0
  gate; `?raw` and acceptance greps must be anchored on a call or a prop form (D-ITEM-183-02).

No blockers.

## Self-Check: PASSED

Files verified present on disk:

- FOUND: `frontend/src/pages/WorkflowBuilderPage.tsx` (contains `WorkflowCanvas`, `builder-view-toggle`)
- FOUND: `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`
- FOUND: `frontend/src/components/admin/revertByteIdentical.test.tsx` (0 hits for the stale phrase)
- FOUND: `frontend/dist/assets/WorkflowCanvas-DWoW14H5.js` (the measured lazy chunk)

Commits verified in `git log`:

- FOUND: `5131e030` — feat(183-07): add the flag-gated [Spine|Canvas] toggle to the Builder graph column
- FOUND: `c7200d45` — test(183-07): prove flag-off byte-identity in five variants and the canvas wiring
- FOUND: `b23f77dd` — docs(183-07): correct the last stale nav-entry claims in the 181 revert gate

---
*Phase: 183-read-only-canvas*
*Completed: 2026-07-25*
