---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 10
subsystem: workflow-canvas
tags: [govern-03, action-risk, armed-checkpoint, custom-edge, xyflow, detour, sketch-147, d-185-18]
requires:
  - "185-01 (the 137-B card rebuild — NODE_MIN_HEIGHT 104, from which EDIT_AFFORDANCE derives the gap)"
  - "185-02 (PhaseSpec.action_risk_armed — the author's stored intent)"
  - "185-06 (phaseVocabulary.actionRiskArmed — the ONE client read of that intent)"
  - "185-08 (PhaseNodeData.armed on the canvas face; badge slot 1 freed)"
provides:
  - "frontend/src/components/workflows/FlowEdge.tsx — the first custom @xyflow/react edge in this tree"
  - "the module-scope edgeTypes map on WorkflowCanvas (net-new canvas infrastructure)"
  - "CanvasEdgeData.armed — a THREE-state checkpoint reading on the edge running INTO a step"
  - "edge.type set on flow edges by toCanvas"
  - "exported ARC / LINE / DETOUR / DETOUR_ARMED_LABEL / DETOUR_OPEN_LABEL"
  - "EDIT_AFFORDANCE exported from WorkflowCanvas for the cross-module geometry pin"
affects:
  - "every flow edge on the canvas now renders through FlowEdge instead of the library's built-in bezier"
  - "Phase 188 (run state on the canvas) inherits the edgeTypes seam and the G-5 extraction flag"
  - "Phase 189 (external-action nodes) is the producer of the armed:false open-ghost state"
tech-stack:
  added: []
  patterns:
    - "Pattern 4 — module-scope component-type maps (edgeTypes beside nodeTypes)"
    - "S5 — one frozen const table (DETOUR), never a literal at a use site"
    - "S7 — the ?raw source fence with a positive control and fragment-assembled needles"
    - "D-14 spread-conditional ({...(cond ? { x } : {})}) for byte-identical absence"
key-files:
  created:
    - frontend/src/components/workflows/FlowEdge.tsx
    - frontend/src/components/workflows/FlowEdge.test.tsx
  modified:
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/canvasModel.test.ts
    - frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
decisions:
  - "D-185-10-A — CanvasEdgeData.armed is THREE states (absent / false / true), not two. Absent is the ordinary connector and renders byte-identically to today; that third state is the only way the plan's own must_have truths (\"an ordinary unarmed flow edge renders identically to today\" AND \"not armed shows a ghost, present and open, never absent\") can both hold. Sketch 147 index.html:459 gates the whole mark on step.risky, which is exactly this distinction."
  - "D-185-10-B — FlowEdge derives GAP/INSERT_Y from CANVAS_LAYOUT in its own DETOUR table rather than importing WorkflowCanvas's EDIT_AFFORDANCE, because a value-level import back would close an ESM cycle. EDIT_AFFORDANCE is exported and the two tables are pinned equal by a test, which is what makes the deviation safe."
  - "D-185-10-C — the detour OWNS the line in both non-absent states: the baseline bezier is not drawn. Armed it would be the bypass the shape exists to deny; open it would double the ink. This is sketch 147's own detourOwnsLine (index.html:539)."
  - "D-185-10-D — the open label is \"nobody is asked\", not the sketch's \"nobody asked\": same fact, stated as a state of the run rather than as a verdict on the author, per the plan's explicit instruction to prefer a state over a judgement."
metrics:
  duration: "~40 min active (across a provider session-limit interruption between Task 2's edits and their verification)"
  tasks: 3
  files: 6
  completed: 2026-07-30
---

# Phase 185 Plan 10: The Armed Detour Edge — Summary

Armed action-risk checkpoints now read on the canvas as a **detour**: the connector into
the risky step leaves the flow, passes through a point that represents the person, and
comes back — built on four net-new pieces of canvas infrastructure, with every ordinary
edge on the canvas proven unchanged by a before/after capture of the library's own
rendering.

## What shipped

**`FlowEdge.tsx` — the first custom `@xyflow/react` edge in this tree.** Before this
plan `grep -rn "BaseEdge|getBezierPath|getSmoothStepPath|EdgeProps|EdgeLabelRenderer"
frontend/src` returned zero matches. Three states, read off `data.armed`:

| State | What is drawn |
|---|---|
| **absent** | the library's built-in bezier, byte-for-byte. No detour, no ghost. Every canvas shipped today is in this state. |
| **`false`** | the faint dashed ghost arc + dashed person-point, PLUS the solid `LINE` straight through — present and open, never absent. |
| **`true`** | the solid `ARC` **is** the path, with the person-point at (30, 62) and the label at y = 72. **No straight line runs past it.** |

**The module-scope `edgeTypes` map** on `WorkflowCanvas`, with the Pattern-4 docblock
copied from `nodeTypes` — an inline object identity would make React Flow warn and
re-render every edge on every parent render. Only `flow` is registered; `skip`, the
unresolvable-skip stub edge and the `end` cap set no `type` and keep the built-in
renderer, which is what holds the blast radius to the flow edges.

**`edge.type` on flow edges**, set in `toCanvas`, plus `CanvasEdgeData.armed` resolved
from the **TARGET** phase through `checkpointOnTarget` — a named total function
delegating to the same `phaseVocabulary.actionRiskArmed` the node face reads, so the
mark on the connector and the state of the step cannot disagree.

## D-185-18 was the load-bearing correction, and it held

SPEC Req 8's build note said the detour "rides the `edgeTypes` entry named `flow` that
`WorkflowCanvas.tsx:279` already registers — no net-new canvas infrastructure."
**Verified false at execution start**, exactly as D-185-18 recorded:

```
$ grep -rn edgeTypes frontend/src
frontend/src/components/workflows/WorkflowCanvas.tsx:279: * `edgeTypes` entry named `flow` and fall back with a warning, since 183 registers
```

One hit, and it was a comment asserting the opposite. Four pieces were built, and the
fourth is the one that made this its own task: setting `type` moves **every** flow edge
off `builtinEdgeTypes.default` (`BezierEdgeInternal`) and onto ours.

**The arrowhead claim needed correcting too, in our favour.** The plan says
"`DEFAULT_EDGE_OPTIONS` no longer applies once `type` is set". Reading the installed v12
source, `defaultEdgeOptions` *still merges* (`edge = defaultEdgeOptions ? {
...defaultEdgeOptions, ...edge } : edge`) — but the library only hands the custom edge
the **resolved `url('#…')`** as a `markerEnd` prop and draws nothing itself. So the
conclusion stands (the component must re-render it) while the mechanism is different;
recorded here so the next reader does not inherit a wrong model.

## The no-visible-change guard, and how the "before" was obtained

A hand-typed baseline `d` proves only what the author believed. So the guard renders the
**same two-node probe harness twice in the same run** — once with an edge carrying no
`type` (which *is* the pre-185-10 edge, routed through `builtinEdgeTypes.default`), once
with `type: "flow"` plus the `edgeTypes` map — and compares the rendered `d`, `style` and
`marker-end`, with a non-vacuity guard that the captured `d` and marker are non-null. It
also pins that the library's invisible `react-flow__edge-interaction` path survives, so
hit-testing is unchanged.

The **full** visual claim remains the manual row in `185-VALIDATION.md` (screenshot a
5-step unarmed workflow before and after; edges must be indistinguishable). That row is
satisfiable precisely because of the three-state reading below.

## The snapshot audit (Task 1 acceptance)

```
$ git diff --stat -- frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
 .../__snapshots__/canvasModel.fixtures.test.ts.snap | 21 +++++++++++++++++++++
 1 file changed, 21 insertions(+)

$ git diff --numstat -- ...snap
21      0       frontend/src/components/workflows/__snapshots__/canvasModel.fixtures.test.ts.snap
```

**21 insertions, 0 deletions**, and the set of unique added lines has exactly one member:

```
+      "type": "flow",
```

A representative hunk:

```diff
@@ -10,6 +10,7 @@ exports[`toCanvas sweep — 'branching (synthetic skip_to_phase)' > matches its
       "id": "seq:gather->assess",
       "source": "gather",
       "target": "assess",
+      "type": "flow",
     },
```

No `id`, `source`, `target` or `position` value changed, and **no `"armed"` key appears
anywhere** — no corpus fixture arms a step, which is what the plan predicted ("added
`armed` keys where a target phase is armed").

## Measured clearance

Computed by **parsing the exported `ARC` constant** and sampling both cubics 2001 times
each, rather than by re-typing its numbers — so an edit to the transcription is
re-measured instead of silently escaping:

```
box x: 17 .. 43   y: 15 .. 41       (INSERT_SIZE 26 centred at INSERT_Y in a GAP of 60)
samples in x-range: 1670
min y in range: 49.1941
MEASURED MIN CLEARANCE: 8.1941 px
```

Against the sketch's computed **8.2px**. Every sample inside the ＋'s x-range is below its
bottom edge — the curve never enters the box — and the whole arc lives inside the 60×88
detour box, starting and ending exactly on the connector line at `(0, 28)` / `(60, 28)`,
which is what lets the arc *be* the path.

## Falsifications — both observed RED, both reverted

**1 · The armed line.** A `<path d={LINE}>` planted in the armed branch:

```
FAIL  FlowEdge.test.tsx > FlowEdge — the armed detour > makes the ARC the path and lets NO straight line run past it
AssertionError: expected [ 'M0,28 L60,28', …(3) ] to not include 'M0,28 L60,28'
 ❯ src/components/workflows/FlowEdge.test.tsx:228:38
      expect(allPathDs(container)).not.toContain(LINE)
Tests  1 failed | 21 passed (22)
```

**2 · The geometry drift pin.** `DETOUR.GAP` widened by 4:

```
×  never enters the ＋'s box, with a measured minimum clearance of at least 8px
×  derives GAP and INSERT_Y to the same numbers WorkflowCanvas does
×  agrees with the ONE frozen layout table both derive from
×  holds the box size the verbatim transcription is only valid at
AssertionError: expected 4.968533588 to be greater than or equal to 8
AssertionError: expected 64 to be 60 // Object.is equality
Tests  4 failed | 18 passed (22)
```

Worth recording: the clearance test went red **too**, and for the right reason — the ＋'s
box moves with the gap while the arc's transcribed control points do not, so the margin
collapsed from 8.19px to 4.97px. The pin and the clearance guard each catch the drift
independently.

After both reverts, `git diff --stat -- frontend/src/components/workflows/FlowEdge.tsx`
is **empty** against the committed file — neither plant survived.

## Deviations from Plan

### 1. `[Rule 2 — missing distinction]` `CanvasEdgeData.armed` is THREE states, not two

**Found during:** Task 1.

**Issue:** The plan's own artefacts require mutually exclusive things of a two-state
boolean. `must_haves.truths` asserts both *"an ordinary unarmed flow edge renders
identically to today"* and *"not armed: the arc remains a faint dashed ghost … present
and open, never absent"*, and `185-VALIDATION.md`'s manual row requires a 5-step
**unarmed** workflow to be **indistinguishable** before and after. With a plain boolean,
either every connector on every canvas gains a ghost arc (manual row fails, and the
objective's "every other edge looks exactly as it did before" fails), or the ghost is
unreachable dead code and Task 3's ghost assertions test nothing.

**Fix:** `armed?: boolean` carries three readings, which is exactly sketch 147's own
model — `index.html:459` gates the whole mark on `step.risky`, a signal independent of
`armed`, and step 5 of its `STEPS` array is `risky: true, armed: false` (the ghost) while
step 4 is `risky: true, armed: true` (the arc). ABSENT ⇒ no checkpoint declared ⇒ ordinary
connector; `false` ⇒ declared and open ⇒ ghost + line; `true` ⇒ armed ⇒ the arc is the
path. `checkpointOnTarget` returns `true | undefined` today because SPEC Req 8 arms
nothing by default in 185 and no shipped step type performs outbound egress.

**Files modified:** `canvasModel.ts`, `FlowEdge.tsx`, `canvasModel.test.ts`,
`FlowEdge.test.tsx`. **Commits:** `94a89425`, `6badaa6e`, `7c3f8b7c`.

### 2. `[Rule 3 — blocking issue]` `DETOUR` derives from `CANVAS_LAYOUT` instead of importing `EDIT_AFFORDANCE`

**Found during:** Task 2.

**Issue:** The plan's interfaces block says to read `GAP` and `INSERT_Y` from
`EDIT_AFFORDANCE` at `WorkflowCanvas.tsx:314-327`, "never as literals". But
`WorkflowCanvas` imports `FlowEdge`'s component **value** at module scope for its
`edgeTypes` map, so importing back would close a live ESM cycle: whichever module a
caller reaches first hits a TDZ `ReferenceError` on the other's `const`.
`FlowEdge.test.tsx` imports `FlowEdge` directly and would reach it first, so this is not
a theoretical risk.

**Fix:** `FlowEdge` declares its own frozen `DETOUR` table deriving `GAP` /`INSERT_Y`
from **`CANVAS_LAYOUT`** — the same one frozen table `EDIT_AFFORDANCE` derives them from,
so the "no stray literal" rule is honoured. `EDIT_AFFORDANCE` is now **exported** and
`FlowEdge.test.tsx` pins `DETOUR.GAP === EDIT_AFFORDANCE.GAP` and
`DETOUR.INSERT_Y === EDIT_AFFORDANCE.INSERT_Y`, plus their agreement with `CANVAS_LAYOUT`
and the box size the verbatim transcription is only valid at. **That pin is what makes
this deviation safe and it is therefore load-bearing** — falsified RED above.

**Files modified:** `FlowEdge.tsx`, `WorkflowCanvas.tsx`, `FlowEdge.test.tsx`.
**Commits:** `6badaa6e`, `7c3f8b7c`.

### 3. `[Rule 1 — guard defeated by its own prose]` three acceptance greps were comment-only false positives

**Found during:** Task 2 verification.

**Issue:** Three of Task 2's acceptance greps came back non-zero on clean code, tripped
entirely by docblock prose: `FlowEdge.tsx:78` and `:336` spelled the four focusable
attribute tokens while *asserting their absence*, and both `WorkflowCanvas.tsx:312` and
`FlowEdge.tsx:16` quoted the old false comment verbatim, resurrecting the banned string
`"since 183 registers none"`. A guard whose own documentation defeats it is the
D-ITEM-183-02 trap this tree keeps catching.

**Fix:** the prose was reworded to say the same thing without the literal tokens ("no
ARIA role, no tab index and no handler"; the old comment paraphrased rather than quoted),
and `FlowEdge.tsx`'s docblock now states *why* it is written that way. The guard was not
weakened — `FlowEdge.test.tsx` additionally greps the file's own `?raw` source for the
four spellings with a positive control against `WorkflowCanvas?raw`.

**Verified after rewording:**
```
role=|tabIndex|onClick|onPointer in FlowEdge.tsx:        0
'since 183 registers none' in WorkflowCanvas.tsx:        0
'since 183 registers none' anywhere in frontend/src:     0 files
```

**Files modified:** `FlowEdge.tsx`, `WorkflowCanvas.tsx`. **Commit:** `6badaa6e`.

### 4. `[wording]` the open label reads as a state, not a judgement

The sketch's unarmed label is **"nobody asked"**. The plan instructed to "check them
against Req 7's banned list before committing to the wording — prefer wording that reads
as a state, not a judgement." *"Nobody asked"* reads as a verdict on the author; it ships
as **"nobody is asked"** — the same fact as a property of this point in the run. The armed
label is the sketch's **"you say yes"**, verbatim. Neither contains a Req 7 banned term,
and both are asserted character-identical to their exported constants.

### 5. `[additive]` a G-5 flag was added to `WorkflowCanvas.tsx`

Per the plan's Task 2 instruction. `PlaneEditingLayer` + the `EDIT_AFFORDANCE` table are
named as the natural extraction, flagged for **Phase 188** — this plan had to export that
table for a cross-module pin, which is the seam asking to become a module.

## Plan-vs-tree corrections recorded (no code change forced)

- **The sketch's own build note is wrong** and says so in its README: *"It rides the
  `edgeTypes` entry named `flow` that `WorkflowCanvas.tsx:279` already registers … No
  net-new canvas infrastructure."* `:279` is the comment saying none is registered.
  D-185-18 already corrected this; recording it here so the sketch README's line is not
  re-trusted by a later reader.
- **The detour's container is a `<g transform>`, not an HTML `<span>` + nested `<svg>`.**
  A custom xyflow edge renders inside the library's own `<svg><g>`, so the sketch's HTML
  container is not representable; `overflow: visible` is moot on a `<g>` and the library
  already sets it on the edges `<svg>` (`style.css:151-155`). The 60×88 box ships as a
  `data-detour-box` attribute so the test can still assert it.

## Known state that is rendered and tested but not yet produced

`armed: false` — the *declared but open* checkpoint, with its ghost arc and its line
through — is fully implemented and asserted, but **`toCanvas` cannot produce it today**:
SPEC Req 8 arms nothing by default in 185 and no shipped step type performs outbound
egress, so `checkpointOnTarget` returns only `true` or `undefined`. **Phase 189's
external-action node is the named producer** (it arrives armed-on per its SC#2, and an
author turning it off is what mints `false`). This is deliberate and is documented in
both `CanvasEdgeData.armed` and `FlowEdge`'s docblock: shipping the unarmed reading now
makes it a tested behaviour rather than a promise 189 has to re-derive.

## Known transient

Mid-**drag** the detour is anchored to the live source handle, so a card dragged more
than a few pixels horizontally separates from the arc's far end until it snaps back to
its computed lane on drop. The shipped `＋` already has exactly this transient —
`insertPointX` reads the computed `lanes`, never the live drag x
(`WorkflowCanvas.tsx:466-472`) — so it is consistent with the surface rather than a new
defect, and every settled state is exact. Recorded in `FlowEdge.tsx`'s docblock.

## Gates

| Gate | Result |
|---|---|
| `npx tsc -b` | **33** errors = baseline, **0** naming `FlowEdge.tsx` / `WorkflowCanvas.tsx` / `canvasModel.ts` |
| `npx vite build` | exit **0**; canvas still its own lazy chunk — `dist/assets/WorkflowCanvas-qmTgt9GJ.js  195.49 kB │ gzip: 60.92 kB` |
| `npx vitest run src/components/workflows` | **27 files / 1514 tests, all passed** |
| `npx vitest run …canvasModel.{fixtures,,purity}` | **220 passed** (212 before; +8 new cases) |
| `npx vitest run …FlowEdge.test.tsx` | **22 passed** |
| `node scripts/vitest-count-gate.cjs` | **`count gate OK`** — 16/16 pinned files present, no per-file decrease, **0 failing**. Total 415 → **1628** |
| react-flow "created a new edgeTypes object" warning | **0** occurrences across all three canvas suites |
| `git diff --stat -- supabase/migrations` | **0 files** (live head stays `113_sso_configs_firming.sql`) |
| `git diff --stat -- backend/` | **0 files** |
| snapshot diff | **21 insertions, 0 deletions** |

**Count-gate detail.** No `[count-decrease]`, no `[total-below-baseline]`, no
`[missing-file]`, and this run had **no `[failing-tests]` either** — the known
`PublishGauntlet.test.tsx` flake (SEED-056, 2–6 failures run to run on an unchanged tree,
recorded by 185-09) did not fire. `canvasModel.fixtures.test.ts` sits at **delta 0**
against its pin of 100, as the plan required. `FlowEdge.test.tsx` reports as **`new`** with
22 and was correctly **NOT** added to `BASELINE` — it postdates the 415 pin and is already
inside the `src/components/workflows` target glob, so `TARGETS` needed no edit. Pinned
files that grew: `canvasModel.test.ts` 26 → 41 (+8 from this plan), `canvasModel.purity`
79, `WorkflowCanvas.test.tsx` 35 (185-09's +4).

## Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| T1 | `grep -c "type: CANVAS_EDGE_KINDS.flow" canvasModel.ts` ≥ 1, none on skip/end | **1**; all four push sites read — only the sequential one sets `type` |
| T1 | `grep -c "armed?: boolean" canvasModel.ts` = 1 | **1** |
| T1 | snapshot: insertions, **0** deletions | **21 / 0** |
| T2 | `grep -rn edgeTypes frontend/src` ≥ 3, module scope | **12**; declared at `WorkflowCanvas.tsx:303`, outside every component body |
| T2 | `grep -c markerEnd FlowEdge.tsx` ≥ 1 | **6** |
| T2 | `grep -cE 'role=\|tabIndex\|onClick\|onPointer' FlowEdge.tsx` = 0 | **0** |
| T2 | `grep -c EDIT_AFFORDANCE FlowEdge.tsx` ≥ 1, no bare GAP/INSERT_Y literal | **4**; `DETOUR` reads `CANVAS_LAYOUT`, `BOX_DROP` is a named table entry |
| T2 | `grep -c "since 183 registers none" WorkflowCanvas.tsx` = 0 | **0** (and 0 tree-wide) |
| T2 | banned terms in `FlowEdge.tsx` = 0 | **0** |
| T2 | no re-created-`edgeTypes` warning | **0** |
| T3 | clearance ≥ 8px, measured value quoted | **8.1941px** |
| T3 | armed-line falsification observed RED, output quoted | ✔ |
| T3 | read-only walk includes `expect(nodes.length).toBeGreaterThan(0)` | ✔, plus a second non-vacuity guard that the detour is on the canvas |
| T3 | `git diff --stat -- supabase/migrations` = 0 files | **0** |

`FlowEdge.tsx` is **366 lines** (min 80).

## Requirements

**GOVERN-02 and GOVERN-03 both stay `Pending`**, following the 185-02 / 03 / 05 / 06 / 08 /
09 precedent. The canvas half of GOVERN-03 is real, wired and pinned, but
`185-VALIDATION.md` criterion 4 (*"the detour reads as a detour … armed and unarmed are
indistinguishable at a glance"* is the failure mode) and the D-185-18 manual visual row
(*screenshot a 5-step unarmed workflow before and after*) are **operator UAT that has not
run**. Marking them Complete at plan 10 of 11 would make the traceability table lie. The
orchestrator owns the requirement write.

## Threat Flags

None. The detour is a projection of a boolean already in the edge data — no new input, no
new fetch, no new write, no new endpoint, no schema change. `git diff` over `backend/` and
`supabase/migrations` is **0 files**. T-185-10-01 through -04 are all mitigated and each
has a live test: the read-only walk plus the source fence (01), the open-ghost state being
rendered and asserted rather than dropped (02), module-scope `edgeTypes` + `memo` + the
warning check (03), and the audited insertions-only snapshot (04).

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `94a89425` | the projection routes flow edges to a renderer that does not exist yet |
| 2 | `6badaa6e` | the armed checkpoint is a detour through a person, and every other edge is untouched |
| 3 | `7c3f8b7c` | ordinary edges proven unchanged, the detour proven a detour, the mark proven not a control |

## Self-Check: PASSED

All six files present on disk; all three commit hashes found in `git log`.
