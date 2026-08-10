---
phase: 183-read-only-canvas
plan: 04
subsystem: frontend
tags: [workflows, spine, extraction, glyph-migration, technical-names-reveal, anti-drift]

# Dependency graph
requires:
  - phase: 183-read-only-canvas
    plan: 02
    provides: "`phaseVocabulary.ts` — the shared read shapes, the corrected `parseSkipTarget`, `nodeTitle` / `technicalTitle`"
  - phase: 183-read-only-canvas
    plan: 01
    provides: the recorded 33-signature `tsc -b` baseline this plan's tsc gate is read against
  - phase: 124-workflow-soul
    provides: "`soulData.PHASE_GLYPHS` — the icon vocabulary the Spine now imports"
  - phase: 127-icon-convention
    provides: "`phaseGlyph()` — the 3D fluent-emoji render-time resolver"
  - phase: 154-plain-language
    provides: "`TechnicalNamesProvider` / `useTechnicalNamesOptional` — the app-wide ⌥ reveal state"
provides:
  - "`PhaseSpineGraph` with ZERO private vocabulary — one glyph map, one parse, one title resolver in the whole tree"
  - "the Spine rendering the 3D fluent-emoji marks (Phase 127 migration finished)"
  - "the Spine's symmetric ⌥ reveal — the exact title expression plan 183-06 must mirror"
  - "a green `src/components/workflows` directory (the Phase-127-era soulData RED is fixed)"
  - "a tree-wide `?raw` guard set covering all four glyph-map consumers"
affects: [183-05, 183-06, 183-07, 184-editable-canvas, 185-graded-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a leaf surface CONSUMES the app-wide reveal via the OPTIONAL accessor and never owns a second toggle"
    - "the resolved title is computed ONCE per node and spent in both the visible text and the aria-label (WCAG 2.5.3)"
    - "`?raw` source guards assert the absence of a duplicate declaration, so a comment claiming an extraction is backed by a test"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/PhaseSpineGraph.tsx
    - frontend/src/components/workflows/PhaseSpineGraph.test.tsx
    - frontend/src/components/workflows/PhaseSpine.test.tsx
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/soulData.test.ts
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/PhaseFormPanel.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx

key-decisions:
  - "Tasks 1 and 2 ship as ONE commit — the must_haves truth demands all five importers repoint in the same commit, and a Task-1-only commit would not compile"
  - "Only `PhaseSpecJSON` is imported from phaseVocabulary; `ValidatorJSON` / `PhaseConfigJSON` are unused in this file and `noUnusedLocals` is on"
  - "The soulData RED was FIXED, not accepted — the expectation now names the six fluent-emoji slugs"
  - "No ⌥ control was added to the Spine header — it is a leaf consumer, the control ships elsewhere"

requirements-completed: [CANVAS-01]

# Metrics
duration: 21min
completed: 2026-07-26
---

# Phase 183 Plan 04: The D-183-13 Hard Cut Summary

**`PhaseSpineGraph` no longer declares any of the phase vocabulary — it imports the glyph map, the
on-fail parse, the read shapes and both title resolvers from their one home, visibly gains the 3D
fluent-emoji marks Phase 127 shipped, and resolves its node title through the SAME app-wide ⌥ reveal
the canvas will read, so the two views cannot disagree in either mode.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-07-25T20:41:55Z
- **Completed:** 2026-07-25T21:02:00Z
- **Tasks:** 3 of 3 (committed as 2 commits — see Deviations)
- **Files modified:** 9 (0 created)

## The title expression — verbatim, for plan 183-06 to be checked against

Two lines, `frontend/src/components/workflows/PhaseSpineGraph.tsx`:

```ts
// once per component, at the top of PhaseSpineGraph(...)
const showTechnical = useTechnicalNamesOptional()?.showTechnical ?? false

// once per phase, inside the ordered.map(...)
const title = showTechnical ? technicalTitle(phase) : nodeTitle(phase)
```

That single `title` value is spent in **both** places a title appears — the
`data-testid="node-title"` span and the `aria-label` (`Phase N: ${title} (${phase.config.phase_type})`)
— so the accessible name can never drift from the visible one.

Plan 183-06 must land the equivalent on `WorkflowCanvas` / `PhaseNode`: the same
`useTechnicalNamesOptional()` hook, the same `?? false` null-context fallback, and the same ordering
(`technicalTitle` when on, `nodeTitle` when off — expressed there as `data.technicalTitle` /
`data.title`). Any other ordering, or a second `useState`, reopens the G-6 tripwire.

Observed faces on an unnamed phase (asserted, not asserted-by-prose):

| slug | type | reveal OFF | reveal ON |
|---|---|---|---|
| `retrieve` | `llm_agent` | `Work out how to do it` | `AI agent step · retrieve` |
| `m1` | `llm_emit` | `Produce the deliverable` | `Deliverable · m1` |

A real `phase.name` still wins in both modes off, exactly as before.

## What was deleted from `PhaseSpineGraph.tsx`

Six blocks, ~70 lines, replaced by four import statements:

| Deleted | Replaced by |
|---|---|
| local `PHASE_GLYPHS` (the flat `⚙ ✎ 🤖 ⛓ ☺ ◆` marks Phase 127 retired) | `PHASE_GLYPHS` from `@/components/workflows/soulData` + `phaseGlyph()` from `@/lib/phaseGlyph` |
| local `PHASE_TYPE_LABELS` | `technicalTitle` from `phaseVocabulary` |
| `ValidatorJSON` / `PhaseConfigJSON` / `PhaseSpecJSON` | `type PhaseSpecJSON` from `phaseVocabulary` |
| the FALSE parity docblock (`:73-77`) | deleted, not moved — it was the C-1 lie |
| local `parseSkipTarget` (the `lastIndexOf` split) | `parseSkipTarget` from `phaseVocabulary` (prefix-length slice) |
| module-private `nodeTitle` (`<label> · <slug>`) | `nodeTitle` / `technicalTitle` from `phaseVocabulary` |

`READ_ONLY_LEGEND` stays where it ships (zero external importers). **No re-export shim** — matching
the Phase 124-01 `soulData` and Phase 177-01 `StatusChip` precedents.

## The four stale claims, deleted

1. `PhaseSpineGraph.tsx:73-77` — the docblock falsely asserting backend parse parity. **Gone.**
2. `PhaseSpineGraph.test.tsx:110-111` — "split on the last `:`". Replaced with the truth (prefix-length
   slice, `reachability.py:89-98`), and the assertion value is unchanged because the fixture's
   `on_failure` carries no second colon.
3. `soulData.ts:19-21` — "previously duplicated … in PhaseSpineGraph.tsx:24-31", which implied a
   removal that had not happened. Now states the literal history: 124-01 removed the WorkflowsPage
   copy, **183-04 removed the PhaseSpineGraph copy**, and names the `?raw` guards that keep the claim
   honest.
4. `PhaseSpineGraph.test.tsx:39` — "the fallback (type label / slug) must render". Now says both
   halves: the default face is the plain-language sentence with no slug, and the `label · slug` form
   is still reachable behind the ⌥ reveal.

A fifth was fixed for the same reason (Rule 2, see Deviations): `phaseVocabulary.ts`'s
"STATE OF THE EXTRACTION" paragraph, which correctly said the cut had **not** happened and would have
become the very false-claim failure it was written to call out.

## The soulData RED — FIXED, in writing

**Confirmed: the pre-existing failure was fixed, not accepted, not skipped, not deleted.**

`soulData.test.ts` › *"maps the 6 phase types to ⚙✎🤖⛓☺◆ exactly"* had been RED since Phase 127-01
replaced the flat unicode glyphs with verified fluent-emoji slug strings. The test now asserts
`gear / memo / robot / busts-in-silhouette / raised-hand / package`, is renamed to describe slugs
rather than glyphs, carries a one-line comment naming Phase 127-01 as the change that made the old
expectation stale, and **keeps the exact-6-key key-set assertion byte-identical**. The file's own
docblock carried the same stale claim on line 11 and was corrected in the same commit (the plan's
`grep -c "⚙"` → 0 criterion caught it).

## The failing-name differential (the Phase 177 lesson)

Both runs are `cd frontend && npm test` on this working tree; names extracted from the `FAIL` lines
and compared with `comm`.

| | Test files | Tests collected | Passed | Failed |
|---|---|---|---|---|
| **Before** (this tree, after the hard-cut commit, before Task 3) | 208 | **1937** | 1900 | 37 |
| **After** (Task 3 complete) | 208 | **1938** | 1905 | 33 |
| Recorded phase baseline | — | 1877 | — | 28–35 (flaky band) |

- **Count guard: PASSED.** 1938 ≥ 1877, and +1 versus the immediately-preceding run — exactly the one
  test Task 3 adds to `PhaseSpine.test.tsx`. No suite was replaced, no coverage was traded away.
- **NEW failing names: ZERO.** `comm -13` returns nothing.
- **Names that went green (4):**
  1. `soulData.test.ts > … > maps the 6 phase types to ⚙✎🤖⛓☺◆ exactly` — **the deliberate in-phase
     fix.** This is the "shrink by exactly one" the plan predicted.
  2–4. Three `PublishGauntlet.test.tsx` cases. **Not attributable to this plan and not claimed as a
     win:** `PublishGauntlet.tsx`/`.test.tsx` are untouched here, the suite imports nothing this plan
     modified (`./PublishGauntlet`, `@/lib/api` only), and it runs **24/24 green in isolation** both
     before and after. These are the known full-run timing flakiness inside the recorded 28–35 band —
     11 of its cases failed in the "before" run, 8 in the "after" run.

Directory-scoped, which is the honest read for this plan's blast radius:

| | Test files | Tests | Failed |
|---|---|---|---|
| `npx vitest run src/components/workflows` **before** | 9 | 145 | **1** (the soulData RED) |
| `npx vitest run src/components/workflows` **after** | 9 | **150** | **0** |

+5 tests: 3 reveal cases + 1 no-second-copy source guard in `PhaseSpineGraph.test.tsx`, +1 tree-wide
glyph guard in `PhaseSpine.test.tsx`.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 + 2 | The hard cut + all five importers repointed + the migrated/extended tests | `1125f575` | refactor |
| 3 | The tree-wide one-glyph-map guard + the soulData RED fix | `71bb79c4` | test |

## Accomplishments

- **One glyph map, one parse, one title resolver in the tree.** `grep -rn "const PHASE_GLYPHS"
  frontend/src` finds one declaration (`soulData.ts:35`); `grep -rn "function parseSkipTarget"` finds
  one (`phaseVocabulary.ts:94`). Every other hit is a test **guard asserting the absence** of a copy.
- **The Spine visibly gained the 3D marks.** Both render sites (spine bullet + card glyph) now do
  `{Glyph ? <Glyph className="h-4 w-4" /> : glyphFallback}` with `glyphFallback =
  PHASE_GLYPHS[type] ?? "•"`, the canonical `PhaseSpine.tsx:87-89` pattern. Proven by
  `querySelector("svg")` assertions on three node cards, not by eye.
- **The reveal is symmetric by construction.** The Spine reads the shipped app-wide context through
  the OPTIONAL accessor and owns no state; `grep -c "useTechnicalNames\b"` and
  `grep -c "TechnicalNamesToggle"` both return 0, so it cannot become a second control.
- **The anti-drift guards are now machine-checkable, tree-wide.** `PhaseSpineGraph.test.tsx` gained a
  dedicated no-second-copy case asserting the source matches none of `/const PHASE_GLYPHS/`,
  `/const PHASE_TYPE_LABELS/`, `/(function|const)\s+parseSkipTarget/`,
  `/interface (PhaseSpecJSON|PhaseConfigJSON|ValidatorJSON)/` or `/lastIndexOf/`, and does import
  `phaseVocabulary` + `soulData`. `PhaseSpine.test.tsx` asserts the glyph invariant across BOTH spine
  consumers from one place. The no-graph-lib guard now also excludes `xyflow`.
- **The shipped structure is untouched.** Same `data-testid`/`data-slug`/`data-phase-type`/
  `data-selected`/`aria-pressed`, same `aria-label` SHAPE, same `READ_ONLY_LEGEND` and its render,
  same non-mutating `phase_index` sort, same `slugSet.has(target)` skip filter (D-183-10's broken-
  reference marker stays a CANVAS behaviour for 183-05/06), same `skip-edge` row, same `onSelectNode`
  contract, same drag-free `<button>` invariant. Only the resolved title text and the glyph element
  moved.

## Decisions Made

- **Tasks 1 and 2 are one commit.** The plan's own must_haves truth requires all five importers to be
  repointed "in the SAME commit with NO re-export shim". Since Task 1 deletes the exports those
  importers read, any Task-1-only commit is a non-compiling tree. One atomic commit satisfies both the
  truth and the no-broken-intermediate rule; the two tasks' verifications were still run and recorded
  separately.
- **Only `PhaseSpecJSON` is imported from `phaseVocabulary`.** The plan said "the three types", but
  `ValidatorJSON` and `PhaseConfigJSON` are not referenced anywhere in `PhaseSpineGraph.tsx` and
  `tsconfig.app.json` sets `noUnusedLocals: true` — importing them would have been a type error. The
  criterion that matters (`grep -c "interface PhaseSpecJSON"` → 0) holds.
- **The glyph fallback moved from `"●"` to `"•"`**, per the plan and matching `PhaseSpine.tsx:88`. It
  is only reachable for a `phase_type` outside the known six, none of which exist in the live corpus.
- **`h-4 w-4` for the SVG**, the sizing the plan cites, consistent with the 13px type scale around it.
- **No ⌥ control on the Spine header.** The Spine is a leaf consumer; the control ships in Settings,
  the operator band, and (from 183-06) the canvas header. A second control here is the exact
  "two toggles disagree" failure `TechnicalNamesProvider`'s docblock exists to prevent.

## Deviations from Plan

### Auto-fixed / auto-added

**1. [Rule 3 - Blocking] Tasks 1 and 2 committed together**

- **Found during:** Task 1 verification
- **Issue:** Task 1's `<automated>` gate includes `npx tsc -b`, but deleting `PhaseSpecJSON` from
  `PhaseSpineGraph` breaks `WorkflowBuilderPage`, `PhaseFormPanel` and `PhaseFormPanel.test` until
  Task 2 lands. A shim would fix it and is explicitly forbidden. A Task-1-only commit would therefore
  be a non-compiling tree — and would break the must_haves truth "all FIVE importers … in the SAME
  commit".
- **Fix:** performed both tasks' edits, ran both tasks' verifications, and made one commit
  (`1125f575`).
- **Files modified:** as listed in that commit.
- **Verification:** `npx vitest run …/PhaseSpineGraph.test.tsx …/PhaseFormPanel.test.tsx` → 31/31;
  `tsc -b` differential clean; `vite build` exit 0.

**2. [Rule 2 - Missing critical] `phaseVocabulary.ts`'s "STATE OF THE EXTRACTION" paragraph updated**

- **Found during:** Task 1
- **Issue:** That paragraph stated (correctly, at the time) that `PhaseSpineGraph` STILL carried its
  duplicates and that 183-04 would perform the cut. After this plan it becomes a false claim — the
  precise `soulData.ts` failure the paragraph itself calls out, and an explicit hand-off item from the
  183-02 summary. The file is not in the plan's `files_modified` list.
- **Fix:** rewrote it to state the cut has happened, that no shim was left, and that the claim is held
  honest by the `?raw` guards rather than by habit. Comment-only; no code in that module changed.
- **Files modified:** `frontend/src/components/workflows/phaseVocabulary.ts`
- **Verification:** `phaseVocabulary.test.ts` 40/40 green (its `?raw` purity block forbids
  `lastIndexOf`, `const PHASE_GLYPHS`, `grounding_mode`, `@/lib/api` — none of which the new prose
  contains).
- **Committed in:** `1125f575`

**3. [Rule 1 - Bug] `soulData.test.ts`'s docblock carried the same stale glyph claim**

- **Found during:** Task 3 acceptance grep (`grep -c "⚙"` returned 1 after the assertion was fixed)
- **Issue:** line 11 of the file's own header still summarised the suite as asserting `⚙✎🤖⛓☺◆`.
  Fixing only the assertion would have left a second copy of the falsehood.
- **Fix:** the docblock now names the six fluent-emoji slugs and Phase 127-01 as the retirement.
- **Verification:** `grep -c "⚙"` → 0; suite 14/14 green.
- **Committed in:** `71bb79c4`

### Acceptance criteria executed with a stated adjustment

**1. `npx tsc -b` exits 0 → executed as the inherited D-ITEM-183-01 differential.** `develop` is red
at baseline with 33 pre-existing signatures across ~20 unrelated files. After both commits the count
is **still exactly 33**, and `grep -cE "PhaseSpineGraph|phaseVocabulary|PhaseFormPanel|
WorkflowBuilderPage|soulData"` over the `tsc -b` output is **0** — this plan added no type error.
`npx vite build` remains the hard gate and **exits 0**.

**2. `grep -c "useTechnicalNamesOptional" PhaseSpineGraph.tsx` returns 2, not 1.** `grep -c` counts
matching LINES, and a used import needs two: the `import` statement and the one call site. The
criterion's intent — one hook, one call site, no second copy of the state — is verified exactly:
`grep -c "useTechnicalNamesOptional("` returns **1**. Aliasing the import purely to hit a literal `1`
would have obscured the very symmetry the criterion exists to prove. (Same class as plan 183-02's
`skipParseCases.json` count adjustment.)

**3. `grep -rn "const PHASE_GLYPHS" frontend/src` returns 6 hits, not 1** — one **declaration**
(`soulData.ts:35`) plus five test lines that are `not.toMatch(/const PHASE_GLYPHS/)` **guards**
asserting its absence. Same for `function parseSkipTarget`: one declaration in `phaseVocabulary.ts`,
one guard string. The invariant the criterion states ("exactly one home") holds; the extra hits are
the controls enforcing it.

**4. `git diff --stat WorkflowBuilderPage.tsx` shows `2 insertions(+), 1 deletion(-)`** rather than a
single changed line — the one combined import necessarily becomes two statements because the component
and the type now live in different modules. Nothing else in that file changed (the view toggle is
plan 183-07).

**Total deviations:** 3 auto-fixed/auto-added (1 blocking, 1 missing-critical, 1 bug — all comment or
sequencing, no behaviour beyond the plan) + 4 acceptance criteria executed with stated, evidenced
adjustments. One file outside `files_modified` was touched (`phaseVocabulary.ts`), comment-only, under
Rule 2 and per the 183-02 hand-off.

## Issues Encountered

- **`noUnusedLocals` bites a literal reading of an extraction plan.** "Import the three types" is only
  correct for the types actually referenced; the other two would have been type errors. Worth carrying
  into 183-05/06.
- **A `grep -c` criterion cannot be satisfied at `1` by any *used* import.** Future plans should write
  such criteria against the call form (`grep -c "hook("`) rather than the bare name.
- **The full-suite failing set is genuinely noisy.** `PublishGauntlet.test.tsx` failed 11 cases in one
  full run and 8 in the next while being 24/24 green in isolation, with no code of its own changed.
  The directory-scoped run is the honest blast-radius read for a plan like this one; the full-suite
  differential is still worth running for the NEW-names check (which was empty).

## Verification Results

| Gate | Result |
|---|---|
| `npx vitest run …/PhaseSpineGraph.test.tsx -t "technical names"` | **3 passed**, 10 skipped ✅ (≥ 3 required) |
| `npx vitest run …/PhaseSpine.test.tsx` (Task 1 gate) | **10 passed** ✅ |
| `npx vitest run …/PhaseSpineGraph.test.tsx …/PhaseFormPanel.test.tsx` | **31 passed / 31** ✅ (was 27 collected) |
| `npx vitest run …/PhaseSpine.test.tsx …/soulData.test.ts` | **25 passed / 25** ✅ |
| `npx vitest run src/components/workflows` | **150 passed, 0 failed** ✅ (baseline 144/1) |
| `cd frontend && npm test` | 1938 collected, 33 failed — **0 new names**, 4 gone ✅ |
| `npx tsc -b` | 33 signatures — identical to the 183-01 baseline, **0 from our files** ⚠️ D-ITEM-183-01 |
| `npx vite build` | **exit 0** ✅ |
| `grep -c` on `PhaseSpineGraph.tsx`: `const PHASE_GLYPHS` / `const PHASE_TYPE_LABELS` / `lastIndexOf` / `function parseSkipTarget` / `interface PhaseSpecJSON` / `split on the LAST` / `export .* from` / `xyflow` / `TechnicalNamesToggle` / `useTechnicalNames\b` | **all 0** ✅ |
| `grep -c` on `PhaseSpineGraph.tsx`: `phaseGlyph` / `technicalTitle` / `useTechnicalNamesOptional(` | `3` / `2` / `1` ✅ |
| `grep -cE 'data-testid=\{\`spine-node-\|data-phase-type=\|aria-pressed=\|READ_ONLY_LEGEND'` | **5** ✅ (≥ 4 — shipped hooks survive) |
| `git diff -U0 soulData.ts` non-comment changed lines | **0** ✅ (comment-only, inside the header block) |
| `grep -c phaseVocabulary` on WorkflowBuilderPage / PhaseFormPanel / PhaseFormPanel.test | `1` / `1` / `1` ✅ |
| residual `from "./PhaseSpineGraph"` imports | only the COMPONENT + the `?raw` source ✅ |
| `grep -c "🤖"` / `-ci "split on the last"` / `-c xyflow` / `-c "technical names"` on the test | `0` / `0` / `2` / `3` ✅ |
| `grep -c "⚙"` on `soulData.test.ts` | **0** ✅ |
| `git diff --diff-filter=D` on both commits | **no deletions** ✅ |

## Threat Model Compliance

- **T-183-01 (Tampering — authored `name`/`slug` into a Spine node):** mitigated and preserved. Every
  authored string is still a plain React text child or an `aria-label` attribute value; the ⌥ reveal
  selects between two plain strings and constructs no markup. `dangerouslySetInnerHTML` appears
  nowhere in the file.
- **T-183-08 (Tampering — SVG injection via the icon path):** mitigated by the shipped
  `phaseGlyph.tsx` deep-subpath bundling; this plan adds **no new slug** (D-183-14's `compass` /
  `handshake` swaps remain a separate dedicated commit) and renders the resolver's return value as a
  React element, never as interpolated markup.
- **T-183-09 (Repudiation — stale in-code parity/extraction claims):** mitigated. Four claims deleted
  (plus the fifth in `phaseVocabulary.ts` and the sixth in `soulData.test.ts`'s docblock), and the
  `?raw` guards make their reappearance a test failure.
- **ASVS conclusion INTACT.** Frontend-only: `git status --porcelain backend/` is untouched by this
  plan. No route, no migration, no authz decision, no data path, no input surface. The "if any task
  grows a backend touch this conclusion is VOID" condition did not trigger.

## Known Stubs

None. Nothing was left placeholder-shaped; every symbol the Spine reads resolves to a real shared
implementation, and D-183-10's broken-reference marker is deliberately NOT stubbed here (the Spine
keeps its shipped silent-drop semantics for 183; the honest marker is a canvas behaviour landing in
183-05/06).

## User Setup Required

None — no dependency, no env var, no migration, no cloud parity owed.

## Next Phase Readiness

**Ready.** Hand-offs, explicitly:

- **183-06 (the canvas node + reveal)** — mirror the two-line title expression quoted verbatim above.
  The same hook, the same `?? false`, the same ordering. If the canvas ever computes a title any other
  way, the Spine/Canvas symmetry claim is void even if both suites are green.
- **183-05 / 183-06** — `parseSkipTarget`, `nodeTitle`, `technicalTitle`, `groundingFor`,
  `waitsForYou`, `PHASE_TYPE_SUBTITLES` all come from `phaseVocabulary`; the icon comes from
  `phaseGlyph()` with `PHASE_GLYPHS[type] ?? "•"` as the fallback. Re-deriving any of them now trips a
  `?raw` guard rather than merely being discouraged.
- **183-07 (the view toggle)** — `WorkflowBuilderPage.tsx` is otherwise untouched; its
  `PhaseSpineGraph` mount and the push grid are exactly as shipped.
- **184 / 185** — they inherit ONE vocabulary module, which was the roadmap's
  refactor-before-the-third-consumer ask. 185's seam is still `groundingFor`.
- **All 183 plans** — `tsc -b` remains a differential against 33; `vite build` remains the exit-0 hard
  gate; `src/components/workflows` is now expected **fully green**, so any failure there is new.

No blockers.

## Self-Check: PASSED

Files verified present on disk (all 9 modified files exist and carry the changes):

- FOUND: `frontend/src/components/workflows/PhaseSpineGraph.tsx` (imports `phaseVocabulary`, `soulData`, `phaseGlyph`, `useTechnicalNamesOptional`)
- FOUND: `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` (contains `technical names`, `xyflow`, `data-phase-type`)
- FOUND: `frontend/src/components/workflows/PhaseSpine.test.tsx` (contains `PhaseSpineGraph?raw`)
- FOUND: `frontend/src/components/workflows/soulData.ts` (comment-only diff)
- FOUND: `frontend/src/components/workflows/soulData.test.ts` (asserts `"gear"`, contains no `⚙`)
- FOUND: `frontend/src/components/workflows/phaseVocabulary.ts` (extraction paragraph corrected)
- FOUND: `frontend/src/components/workflows/PhaseFormPanel.tsx`
- FOUND: `frontend/src/components/workflows/PhaseFormPanel.test.tsx`
- FOUND: `frontend/src/pages/WorkflowBuilderPage.tsx`

Commits verified in `git log`:

- FOUND: `1125f575` — refactor(183-04): hard-cut PhaseSpineGraph onto the shared phase vocabulary
- FOUND: `71bb79c4` — test(183-04): extend the one-glyph-map guard and fix the soulData RED

---
*Phase: 183-read-only-canvas*
*Completed: 2026-07-26*
