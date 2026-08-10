---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 03
subsystem: workflows
tags: [react, presentational-component, g5-extraction, workflow-canvas, type-enforced-budget, source-guards, provider-free-render]

# Dependency graph
requires:
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential, pinned at 16 files / 424 tests, green at 595 after 184-02"
  - phase: 183-read-only-canvas
    provides: "`PhaseNode.tsx`'s shipped card body, `canvasModel.CANVAS_LAYOUT` / `PhaseNodeData`, the shared `StatusChip` primitive and the 31-assertion `WorkflowCanvas.test.tsx` DOM contract"
provides:
  - "`nodePresentation.ts` — the canvas node presentation tables in ONE copy: `ICON_TINT`, `DEFAULT_TINT`, `GROUNDING_TONE`, `renderPhaseMark`; a hard cut out of `PhaseNode.tsx` with no re-export shim"
  - "`PhaseNodeCard.tsx` — the purely presentational phase card with ZERO canvas-graph-library import, renderable outside a provider, reusable by Phase 188"
  - "`BadgeSlots` — the 137-D two-badge budget as a max-2 TUPLE: a third badge is a TS2322 typecheck error, not a review comment"
  - "The declared-but-unrendered `status` / `verdict` / `technicalLine` / `stepNumber` slots — extensibility seam #1, so 185 / 184-08 / 188 add DATA, not layout"
  - "`PhaseNodeCard.test.tsx` — 30 provider-free assertions plus four falsifiable `?raw` fences, each with a positive control"
affects: [184-04, 184-08, 184-12, 185, 188, 189]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A presentational card whose graph-library independence is a machine-checked property, not a convention — the adapter injects library-owned nodes through a plain `ReactNode` slot"
    - "A UI budget enforced by a tuple type, so exceeding it fails the build rather than a review"
    - "A source fence whose forbidden token is ASSEMBLED from halves, proved correct positively against a real import, so the fence never forces a neighbouring docblock to omit the identifier it explains"
    - "Declared-but-unrendered slots proved harmless by a byte-identical-DOM comparison between a call with and without them"

key-files:
  created:
    - frontend/src/components/workflows/nodePresentation.ts
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx
  modified:
    - frontend/src/components/workflows/PhaseNode.tsx

key-decisions:
  - "`EdgeAnchors` reaches the card through an `anchors?: ReactNode` slot rendered as the FIRST child, not as a sibling of the card — a sibling would move the handles out of the `relative` wrapper and the split would no longer be DOM-identical"
  - "`BadgeSlot` carries an optional `glyph?: string` beyond the plan's four fields, because the shipped grounding chip renders an aria-hidden glyph before its label; the alternative (widening `label` to `ReactNode`) would have weakened the never-colour-alone rule"
  - "Every source fence in the new suite is anchored on the USE form (a JSX element, a type annotation, an import line, a prop assignment) rather than the bare identifier — a bare-identifier grep would only pass by making the card's own docblock lie"
  - "The tint assertions compare two renders instead of a literal, because jsdom normalises the project's modern `hsl(H S% L% / A)` into `rgba(...)`; a literal would have forced a second, driftable copy of the tint table into the test"
  - "`requirements.mark-complete` was deliberately NOT run — see the Requirements section"

patterns-established:
  - "Guard falsification for a source fence: plant the real import, watch the fence name the file, revert, watch it go green"
  - "A positive control that proves the fence's token is REAL by asserting the adapter contains it — stronger than a planted string, because a typo in the token turns the control red"

requirements-completed: []  # CANVAS-02 and VALID-03 are this plan's frontmatter requirements and NEITHER is complete. This plan ships presentation substrate with zero user-observable canvas editing and zero verdict rendering. REQUIREMENTS.md deliberately left Pending — see "Requirements" below.

# Metrics
duration: 38min
completed: 2026-07-27
---

# Phase 184 Plan 03: PhaseNodeCard — the Zero-Graph-Library Card and its Slot Contract Summary

**`PhaseNode.tsx` is now a 40-line `NodeProps`→slots adapter over a purely presentational `PhaseNodeCard` that provably imports nothing from the canvas graph library and renders under a plain `render()` with no provider — with the 137-D two-badge budget enforced as a max-2 tuple (a third badge is `TS2322`), the 185 / 184-08 / 188 slots declared and rendering byte-identical DOM whether passed or omitted, and the whole split landing with the canvas snapshot unmoved, every pinned test count at delta 0, and ZERO assertions edited in any pre-existing test file.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-07-27T04:20:00Z
- **Completed:** 2026-07-27T04:58:00Z
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 3 · **Files modified:** 1

## Task Commits

1. **Task 1: `nodePresentation.ts` — the const-tables and the mark resolver, moved verbatim** — `c3100c36` (refactor) — `nodePresentation.ts` (new), `PhaseNode.tsx`
2. **Task 2: the zero-graph-library card + `PhaseNode` becomes an adapter** — `b7603244` (refactor) — `PhaseNodeCard.tsx` (new), `PhaseNode.tsx`
3. **Task 3: the provider-less render proof and the source fences** — `a3972719` (test) — `PhaseNodeCard.test.tsx` (new, 30 tests)

## (a) Every import-path-only change, enumerated (D-184-08)

D-184-08 permits import-path-only changes and requires every one to be listed. **All eight are in a single file — `frontend/src/components/workflows/PhaseNode.tsx` — and no other file's import block was touched by this plan.**

### In `c3100c36` (Task 1) — five edits

| # | Change | Why |
|---|---|---|
| 1 | **Removed** `import { createElement, type ReactNode } from "react"` | Both bindings existed only for `renderPhaseMark`, which moved |
| 2 | **Removed** `import { PHASE_GLYPHS } from "@/components/workflows/soulData"` | Used only by `renderPhaseMark` |
| 3 | **Removed** `import { phaseGlyph } from "@/lib/phaseGlyph"` | Used only by `renderPhaseMark` |
| 4 | **Removed** `import type { Grounding } from "@/components/workflows/phaseVocabulary"` | Used only to type `GROUNDING_TONE` |
| 5 | **Narrowed** `import { StatusChip, type ChipTone } from "@/components/org/StatusChip"` → `import { StatusChip } from "@/components/org/StatusChip"` | `ChipTone` typed `GROUNDING_TONE` only |
| 6 | **Added** `import { DEFAULT_TINT, GROUNDING_TONE, ICON_TINT, renderPhaseMark } from "@/components/workflows/nodePresentation"` | The four moved declarations |

### In `b7603244` (Task 2) — two edits

| # | Change | Why |
|---|---|---|
| 7 | **Removed** `import { StatusChip } from "@/components/org/StatusChip"` | The chips are rendered by the card now; the adapter only builds `BadgeSlot` objects |
| 8 | **Added** `import { PhaseNodeCard, type BadgeSlot, type BadgeSlots } from "@/components/workflows/PhaseNodeCard"` | The card and its slot types |

`cn` and `CANVAS_LAYOUT` imports were **kept** — `UnresolvedSkipNode`, `EndCapNode` and `HIDDEN_HANDLE_STYLE` still use them. `@xyflow/react` was **kept** — the adapter is the only file of the pair that names it, which is the point.

**No rendered output changes from any of these eight.** Confirmed by the byte-unchanged canvas snapshot and by all 31 `WorkflowCanvas.test.tsx` + 22 `WorkflowBuilderPage.canvas.test.tsx` assertions passing unmodified.

## (b) The three-badge probe — the observed typecheck error

The max-2 tuple is only a budget if exceeding it fails the build. A temporary three-element literal was appended to `PhaseNode.tsx`, `tsc -b` run, and the probe removed.

```
src/components/workflows/PhaseNode.tsx(249,14): error TS2322: Type
'[{ testId: string; tone: "muted"; label: string; },
  { testId: string; tone: "muted"; label: string; },
  { testId: string; tone: "muted"; label: string; }]'
is not assignable to type 'BadgeSlots'.
```

**Observed error code: `TS2322`.** Total `tsc` error count **34 with the probe, 33 without** — i.e. the probe contributed exactly one error and the baseline is untouched. The probe is gone: `grep -c "__threeBadgeProbe" PhaseNode.tsx` → 0, and the post-removal count is 33.

Phase 185 therefore **cannot** add a third badge to this surface without a type error. The 137-D budget is enforced by the compiler, not by a review comment.

## (c) ZERO assertions in pre-existing test files were edited

**Stated explicitly, as `<output>` requires: this plan edited ZERO assertions in any pre-existing test file.**

Proof, not claim — the diff across all three commits, restricted to test files:

```
$ git diff --stat c3100c36~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
 .../src/components/workflows/PhaseNodeCard.test.tsx | 366 ++++++++++++++++++
 1 file changed, 366 insertions(+)
```

Exactly one test file appears across the whole plan, it is **net-new**, and its diff is **366 insertions / 0 deletions**. No pre-existing test file appears in the diff at all.

The 184-01 carve-out (`soulData.test.ts`'s glyph map) remains the only permitted assertion edit in phase 184, and it stays spent — `soulData.test.ts` reported its pinned **14** on all three of this plan's gate runs.

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run src/components/workflows src/pages/WorkflowBuilderPage.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/admin/revertByteIdentical.test.tsx` | 0 failures | **18 files / 625 tests passed, 0 failed** |
| `node scripts/vitest-count-gate.cjs` | exit 0, 16/16 pinned at their counts, no per-file decrease | **exit 0** on all three commits; every one of the 16 deltas **0**; total 595 → 595 → **625** |
| `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` | 0 failures | **30 passed** |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (D-ITEM-183-01 differential) | **33** — equal to the `develop` baseline, on every task |
| `npx vite build` | exit 0 | **exit 0**, built in 6.26 s |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0** (pathspec re-confirmed non-vacuous: it matches `canvasModel.fixtures.test.ts.snap`) |
| `grep -c '@xyflow' PhaseNodeCard.tsx` | 0 | **0** |
| `grep -c '@xyflow/react' PhaseNode.tsx` | ≥ 1 | **2** (the import + the adapter docblock that explains the boundary) |
| `grep -cE '@xyflow\|mockReactFlow\|ReactFlowProvider' PhaseNodeCard.test.tsx` | 0 | **0** — see Deviation 3 for how this and the plan's own `/@xyflow/` assertion were reconciled |
| `grep -nE 'const (ICON_TINT\|DEFAULT_TINT\|GROUNDING_TONE)\|function renderPhaseMark' PhaseNode.tsx` | no matches | **no matches** — a hard cut, no re-export shim |
| Moved values byte-identical | diff vs `git show HEAD:PhaseNode.tsx` | **`ICON_TINT` + `DEFAULT_TINT` byte-identical** (modulo the added `export` keyword); **`GROUNDING_TONE` byte-identical**; **`renderPhaseMark` byte-identical** — all three diffed programmatically against the pre-split source |
| `PhaseNode` signature | `({ data, selected }: NodeProps<PhaseCanvasNode>)` and still renders `<EdgeAnchors />` | **both intact** |
| Three-badge literal | a typecheck error | **TS2322** (above) |
| `git diff --name-only -- supabase/migrations \| wc -l` | 0 | **0** — slot 114 stays RESERVED |
| Deletions in any commit | none | **none** (`git diff --diff-filter=D` empty on all three) |
| REQUIREMENTS.md | untouched, all 5 phase REQ-IDs Pending | **untouched**; VALID-02, VALID-03, CANVAS-02, CANVAS-03, CANVAS-04 all `- [ ]` / **Pending** |

## Guard falsification — the fences were made to fail before they were trusted

This plan added four brand-new source fences. A guard that has only ever passed is not evidence.

**Falsified —** `import { Handle } from "@xyflow/react"` was temporarily inserted at the top of `PhaseNodeCard.tsx`:

```
FAIL  PhaseNodeCard — the scope fences (source guard) >
      the card names the canvas graph package NOWHERE (D-184-06)
AssertionError: expected '/**\r\n * Phase 184-03 Task 2 (D-184-…' not to contain '@xyflow'

 Tests  1 failed | 29 passed (30)
```

→ the fence named the violation and the file. **Restored —** 30/30 green, `grep -c 'Handle' PhaseNodeCard.tsx` → 0.

Three further controls are permanent parts of the suite rather than one-off experiments:

1. **The assembled token is proved REAL against the adapter.** `expect(phaseNodeSource).toContain(GRAPH_PKG)` and `toContain(\`from "${GRAPH_PKG}"\`)`. A typo in the assembly, or a rename of the dependency, turns this red instead of turning the fence vacuous. This is stronger than a planted literal, because a planted literal only proves the regex works on itself.
2. **The API-client and HTML-sink fences carry planted-literal controls** — the same regexes are asserted to MATCH `'import { x } from "@/lib/api"'` and `'<p dangerouslySetInnerHTML={{ __html: x }} />'`.
3. **The hard-cut fence carries an inverse control** — `nodePresentation?raw` is asserted to declare all four exports, so "PhaseNode no longer declares them" cannot pass by them having vanished entirely.

## Design decisions worth carrying forward

- **The adapter injects, the card renders.** `anchors?: ReactNode` is the whole mechanism by which a library-owned element sits inside a library-free component. Phase 188 reuses the card by simply omitting it.
- **A budget expressed as a tuple is a budget.** `BadgeSlots = readonly [] | readonly [BadgeSlot] | readonly [BadgeSlot, BadgeSlot]`. The 185 planner does not need to remember D-183-07; the compiler remembers it.
- **"Renders nothing" is asserted by DOM equality, not by absence.** The strongest test in the suite renders the card twice — once with `verdict` / `status` / `stepNumber`, once without — and asserts `innerHTML` is identical. That is the machine-checkable form of "Wave 0 added the seam without adding behaviour".
- **Fences anchor on use forms.** Four separate assertions in this plan would have forced the card's docblock to omit the very identifier it was explaining. Each is anchored on an import line, a JSX element, a type annotation or a prop assignment instead. This is the fifth-plus instance of D-ITEM-183-02 in this project; the convention now has four fresh examples in one file.
- **The card performs no lookup.** It receives a resolved `tint` and a resolved `icon`. That is why it is total by construction: there is no table for an unknown discriminator to miss.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `<EdgeAnchors />` is injected through an `anchors` slot, not rendered as a sibling of the card**

- **Found during:** Task 2
- **Issue:** The plan says the adapter should "render `<PhaseNodeCard {...slots} />` **beside** `<EdgeAnchors />`". Taken literally that makes the handles a SIBLING of the card's outer `className="relative"` wrapper — but in the shipped node the handles are its FIRST CHILD (`PhaseNode.tsx:190`). Moving them out changes both the DOM tree and the positioning context the absolutely-positioned handles resolve against, which contradicts the same task's stronger requirement that "the DOM the card emits MUST match the pre-split output byte-for-byte".
- **Fix:** `PhaseNodeCardProps.anchors?: ReactNode`, rendered as the first child inside the wrapper. The adapter passes `anchors={<EdgeAnchors />}`. The card still imports nothing from the graph library — a `ReactNode` is a `ReactNode` — and a provider-less render simply omits it. Both intents are satisfied: the adapter owns `EdgeAnchors`, and the DOM is unchanged.
- **Files modified:** `PhaseNodeCard.tsx`, `PhaseNode.tsx`
- **Verification:** canvas snapshot byte-unchanged; all 31 `WorkflowCanvas.test.tsx` assertions (including the edge-painting and axe rows) pass unmodified; a dedicated test asserts the anchors slot renders as `firstElementChild`
- **Committed in:** `b7603244`

---

**2. [Rule 3 - Blocking] `BadgeSlot` carries an optional `glyph?: string` beyond the plan's four fields**

- **Found during:** Task 2
- **Issue:** The plan specifies `BadgeSlot = { testId; tone; label: string; dataAttr? }`. But the shipped grounding chip renders `<span aria-hidden="true" className="mr-1">{glyph}</span>` **before** its words (`PhaseNode.tsx:217-220`). With `label` a plain string and no glyph field, the pre-split DOM is unreachable.
- **Fix:** added `glyph?: string`, rendered `aria-hidden` before the label when present and omitted entirely when absent. The alternative — widening `label` to `ReactNode` — was rejected because it would let a caller put arbitrary markup where the plan (and WCAG 1.4.1, and `StatusChip`'s own docblock) says a WORD must carry the meaning.
- **Files modified:** `PhaseNodeCard.tsx`, `PhaseNode.tsx`
- **Verification:** the "Waits for you" chip has no glyph and its `textContent` is exactly `"Waits for you"`; the grounding chip's is `"🔒Grounded in your files"`; snapshot byte-unchanged
- **Committed in:** `b7603244`

---

**3. [Rule 1 - Bug] Task 3's assertion 7 and its own acceptance criterion were mutually unsatisfiable; resolved by assembling the token**

- **Found during:** Task 3
- **Issue:** The plan requires BOTH `expect(phaseNodeCardSource).not.toMatch(/@xyflow/)` (which spells the token) AND `grep -cE '@xyflow|mockReactFlow|ReactFlowProvider' PhaseNodeCard.test.tsx` **returns 0** (which forbids spelling it). Only one can hold literally. This is D-ITEM-183-02 in its purest form: a guard that can only pass by making a neighbouring claim false.
- **Fix:** the token is ASSEMBLED from halves in exactly one place — `const GRAPH_PKG = ["@xy", "flow/react"].join("")` — and its correctness is proved POSITIVELY against the adapter's real import rather than assumed. Both requirements now hold literally: the criterion greps **0**, and the fence tests the real string. The falsification above proves the fence still fires on a real violation, naming `'@xyflow'` in its own failure message.
- **Files modified:** `PhaseNodeCard.test.tsx`
- **Verification:** `grep -cE '@xyflow|mockReactFlow|ReactFlowProvider' PhaseNodeCard.test.tsx` → **0**; fence falsified and restored
- **Committed in:** `a3972719`

---

**4. [Rule 1 - Bug] Three further fences re-anchored on the USE form after they fired on the card's own docblock**

- **Found during:** Task 3 (first run: 3 failures)
- **Issue:** As first written, `not.toMatch(/\bNodeProps\b|\bReactFlow/)` and `not.toMatch(/ICON_TINT|DEFAULT_TINT/)` both went red — on the card's DOCBLOCK, which legitimately names the provider component, the node-props type and `nodePresentation.DEFAULT_TINT` in order to explain what the card does *not* import and who resolves the tint. Passing them would have required deleting the explanation.
- **Fix:** re-anchored on the use forms — `/<Handle[\s/>]/`, `/<ReactFlow/`, `/:\s*NodeProps</`, `/from\s+["']@\/components\/workflows\/nodePresentation["']/`, `/ICON_TINT\[/` — each with a positive control asserting the ADAPTER contains that exact form. This is the shipped `canvasFixtures.ts:20-23` convention (a guard must not force a docblock to omit the real identifier) applied to five new fences.
- **Files modified:** `PhaseNodeCard.test.tsx`
- **Committed in:** `a3972719`

---

**5. [Rule 1 - Bug] The two tint assertions compare renders instead of literals (jsdom normalises `hsl` → `rgba`)**

- **Found during:** Task 3 (first run)
- **Issue:** `expect(container.innerHTML).toContain(DEFAULT_TINT)` failed. jsdom's cssstyle rewrites the project's modern `hsl(220 30% 100% / 0.18)` into `rgba(255, 255, 255, 0.18)` before it lands on the element (verified directly with a throwaway probe). Hard-coding the rgba form would put a second, re-encoded copy of the tint table in the test — free to drift from `nodePresentation`, which is exactly the duplication this plan exists to remove.
- **Fix:** a `wellBackground(tint)` helper renders the card and reads the icon-well's `style` back. The unknown-type test asserts `wellBackground(resolved) === wellBackground(DEFAULT_TINT)`; a sibling test asserts a KNOWN tint produces a DIFFERENT background, so neither can pass vacuously. The literal values are still pinned — once, in the hard-cut describe block, against `nodePresentation`'s exports rather than against the DOM.
- **Files modified:** `PhaseNodeCard.test.tsx`
- **Committed in:** `a3972719`

---

**6. [Rule 1 - Bug] `gsd-sdk query requirements.mark-complete` was NOT run**

- **Found during:** Post-plan state updates
- **Issue:** This plan's frontmatter names `requirements: [CANVAS-02, VALID-03]`. Running the verb would flip both to **Complete** — as it did in 184-01, which had to revert it. CANVAS-02 is *"a user can add, move, connect, and delete phase-nodes…"* and VALID-03 is *"a user sees per-node validation status derived from the server verdict"*. **This plan delivers neither.** It ships presentation substrate: no canvas editing exists, and the `verdict` slot deliberately renders nothing.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched by this plan — verified: all five phase REQ-IDs (`VALID-02`, `VALID-03`, `CANVAS-02`, `CANVAS-03`, `CANVAS-04`) remain `- [ ]` / **Pending**. The orchestrator marks them at phase end when the behaviour is observable, matching Phase 182's VALID-01 precedent.
- **Files modified:** none
- **Verification:** `git status --short .planning/REQUIREMENTS.md` → clean; `grep` shows `| CANVAS-02 | Phase 184 | Pending |`

### Honesty corrections applied while writing (not defects — anti-drift discipline)

**7. [Rule 2 - Missing Critical] Three stale comments in `PhaseNode.tsx` were corrected rather than left standing**

- **Found during:** Tasks 1 and 2
- **Issue:** (a) `"The 3D mark is resolved by the module-scope helper **above**"` — after the cut the helper is in another file. (b) The file header opened *"the three canvas node faces… these three components only PAINT it"*, which stopped describing an adapter. (c) The `PhaseNode` docblock described a card.
- **Fix:** (a) now names `nodePresentation.renderPhaseMark` and says it lives in another file "since the 184-03 split". (b) a new `WHAT THIS FILE IS AFTER THE 184-03 SPLIT` paragraph states plainly what stayed and what left. (c) the `PhaseNode` docblock opens `THIS IS AN ADAPTER, NOT A CARD` and explains why the adapter — not the card — owns the handles. None is an assertion.
- **Files modified:** `PhaseNode.tsx` (comments only)
- **Committed in:** `c3100c36`, `b7603244`

---

**8. [Rule 2 - Missing Critical] `nodePresentation.ts`'s extraction claim names the guard that keeps it honest — and that guard was actually built**

- **Found during:** Task 1
- **Issue:** 184-CONTEXT anti-drift note 3: an in-code claim of a prior extraction is unverified until grepped, because `soulData.ts` once asserted an extraction that had not happened. The plan asks the docblock to name "the `?raw` guard added in Task 3".
- **Fix:** the `STATE OF THE EXTRACTION` paragraph states literally what was cut, that no re-export shim was left, and that `PhaseNodeCard.test.tsx`'s `?raw` fence fails the moment a second declaration reappears in `PhaseNode.tsx`. That fence was then actually written (three assertions plus an inverse control). **The claim briefly preceded its guard by one commit** — `c3100c36` names it, `a3972719` ships it — which is recorded here so the sequence is not mistaken for the hazard itself.
- **Files modified:** `nodePresentation.ts` (docblock), `PhaseNodeCard.test.tsx`
- **Committed in:** `c3100c36`, `a3972719`

---

**Total deviations:** 8 (2 blocking, 4 bugs, 2 missing-critical)
**Impact on plan:** none expands scope — the file set is exactly the four in `files_modified`. Deviations 1 and 2 are the only differences from the plan's literal text, and both exist to satisfy the plan's own stronger requirement (byte-identical DOM). Deviations 3–5 are the plan's intent implemented correctly rather than literally, each recorded with its falsification. Deviation 6 prevents a false completion claim in a planning artifact.

## Requirements

**Neither CANVAS-02 nor VALID-03 is complete, and REQUIREMENTS.md was deliberately left untouched.**

What this plan contributes toward each:

- **CANVAS-02** — the card the editing surface will manipulate is now presentational and reusable, and the adapter boundary means 184-04's editing code has a stable face to render. **Zero** editing behaviour ships here.
- **VALID-03** — the `verdict` slot exists, typed `"error" | "incomplete" | "unknown"`, with a docblock recording that every value is a SERVER verdict. It renders **nothing**, is never passed, and is asserted to change no DOM. 184-08 lands the marks.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-03-01 (tampering — title / subtitle / technicalLine) | mitigate | **CLOSED.** Every authored string is a plain React text child. Machine-checked: the card source is asserted not to match `/dangerouslySetInnerHTML=/`, anchored on the prop form so the docblock may quote the identifier, with a planted-literal positive control. The XSS clause travelled onto the card with the code it constrains |
| T-184-03-02 (DoS — unknown `phase_type`) | mitigate | **CLOSED.** The card performs no lookup at all — it receives a resolved `tint` and a resolved `icon`, so an unrecognised discriminator cannot even reach a table. The adapter's `ICON_TINT[x] ?? DEFAULT_TINT` fallback is asserted, and a card rendered with `phaseType: "llm_time_travel"` renders without throwing at the default tint |
| T-184-03-03 (EoP — flag-off surface drift) | mitigate | **CLOSED.** DOM-identical by construction and gated on it: canvas snapshot byte-unchanged, all 31 + 22 shipped canvas assertions passing unmodified, `revertByteIdentical.test.tsx` green at its pinned 7. The extraction cannot change what a flag-off audience sees |
| T-184-03-SC (supply chain — npm installs) | accept | **Honoured — this plan installed nothing.** `frontend/package.json` and the lockfile are absent from all three commits. `zundo` remains absent and is 184-04's job |

## Scope Fence Compliance

- **Frontend only.** All three commits touch exactly four files, all under `frontend/src/components/workflows/`. Nothing under `backend/`, `scripts/` or `supabase/`.
- **No migration.** `git diff --name-only -- supabase/migrations` returns 0 lines; slot 114 stays RESERVED.
- **No env var. No dependency added. No `zundo` import** (it is not installed and is 184-04's job).
- **`__fixtures__/canvasFixtures.ts` untouched** — the new suite hand-authors its own minimal props inline.
- **No new colour.** The card body stays neutral; tint is behind the icon only; nothing motion-keys off selection. The strong colours stay reserved for Phase 188.
- **No `grounding_mode`** invented anywhere — that is Phase 185's field.

## Issues Encountered

- **jsdom normalises modern `hsl()` to `rgba()`** inside a `radial-gradient`. Diagnosed with a throwaway probe file (written under `src/` and deleted immediately — never left in the watched tree) rather than guessed at. Handled as Deviation 5.
- **The plan's Task 3 contained two mutually unsatisfiable requirements** (Deviation 3). Worth flagging to future plan authors in this phase: a `?raw` fence's acceptance criterion must be scoped to the USE form, or it will contradict the assertion it is describing. This is now the sixth-plus instance of D-ITEM-183-02 in the project and the first where the conflict was between a plan's own two criteria.
- The Vite dev server started during 184-01's checkpoint may still be running on port 5173. Unrelated to this plan; noted for continuity.

## User Setup Required

None. No external service, no env var, no migration, no dependency.

## Next Phase Readiness

- **184-04 is unblocked.** The card it will render is stable and its slot contract is fixed. The `anchors` slot is the only place a graph-library element enters the card.
- **184-08 lands on `verdict`.** The slot is typed and asserted to render nothing today; adding the ✕ / dashed-○ marks is a change to the card's body, not to its contract or to any caller.
- **Phase 185 lands on `badges` — and cannot exceed it.** A third badge is `TS2322`. The graded-governance dial must add data to the grounding row or replace a badge, which is exactly the constraint D-184-06 wanted.
- **Phase 188 lands on `status` and on the zero-graph-library property.** `PhaseNodeCard` can be mounted anywhere; `NodeRunStatus` is a deliberately opaque alias for 188 to replace with its own union, which cannot break a 184 caller because 184 has none.
- **The zero-assertion-edit gate is still armed and the 184-01 carve-out is still spent.** This plan consumed none of it.
- **Carried forward from 184-01:** the live in-app five-surface icon sweep remains a phase-verification G-4 row (needs Docker up).

## Self-Check: PASSED

- `frontend/src/components/workflows/nodePresentation.ts` — FOUND
- `frontend/src/components/workflows/PhaseNodeCard.tsx` — FOUND
- `frontend/src/components/workflows/PhaseNodeCard.test.tsx` — FOUND
- `frontend/src/components/workflows/PhaseNode.tsx` — FOUND
- `scripts/vitest-count-gate.cjs` (consumed, not modified) — FOUND
- Commit `c3100c36` — FOUND
- Commit `b7603244` — FOUND
- Commit `a3972719` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
