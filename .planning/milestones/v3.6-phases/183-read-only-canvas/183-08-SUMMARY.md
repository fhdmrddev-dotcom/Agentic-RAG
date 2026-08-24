---
phase: 183-read-only-canvas
plan: 08
subsystem: frontend/workflows-canvas
tags: [a11y, wcag-2.1.1, governance-honesty, lint, gap-closure, tdd]
gap_closure: true
requires:
  - "183-06 (WorkflowCanvas + PhaseNode shipped)"
  - "183-02 (phaseVocabulary shared module)"
provides:
  - "Keyboard activation on the read-only canvas (Enter/Space -> onSelectNode)"
  - "Honest React Flow node description (no delete / no arrow-key promise)"
  - "groundingFor <-> deriveTier MIDDLE-band agreement, test-pinned"
  - "Lint-clean PhaseNode.tsx"
affects:
  - "frontend/src/components/workflows/WorkflowCanvas.tsx"
  - "frontend/src/components/workflows/phaseVocabulary.ts"
  - "frontend/src/components/workflows/PhaseNode.tsx"
tech-stack:
  added: []
  patterns:
    - "ariaLabelConfig override on <ReactFlow> (both description keys, inverted library mapping)"
    - "wrapper-level onKeyDown + closest('.react-flow__node').dataset.id, guarded against the memoized projection"
    - "module-scope ReactNode helper (not a leaf component) to clear react-hooks/static-components"
key-files:
  created: []
  modified:
    - "frontend/src/components/workflows/WorkflowCanvas.test.tsx"
    - "frontend/src/components/workflows/WorkflowCanvas.tsx"
    - "frontend/src/components/workflows/phaseVocabulary.ts"
    - "frontend/src/components/workflows/phaseVocabulary.test.ts"
    - "frontend/src/components/workflows/PhaseNode.tsx"
decisions:
  - "The keyboard guard reads the MEMOIZED projection (projection.nodes) rather than re-deriving, so mouse and keyboard share ONE selection rule keyed on CANVAS_NODE_TYPES.phase."
  - "BOTH ariaLabelConfig description keys overridden — the library renders the counter-intuitively named keyboardDisabled key when its keyboard-a11y opt-out sits at its false default."
  - "'partial' joins 'flag' on the MIDDLE face rather than gaining a fourth grounding face — D-183-07 locks the three-face vocabulary and PhaseNode's GROUNDING_TONE record stays exhaustive with no edit."
  - "react-hooks/static-components cleared with a module-scope helper returning a ReactNode via createElement, NOT a hoisted leaf component (a hoisted component does not clear the rule)."
metrics:
  tasks: 3
  commits: 3
  duration: "~25 min"
  completed: 2026-07-26
---

# Phase 183 Plan 08: Gap Closure (CR-01 / WR-06 / WR-01 / WR-05) Summary

Keyboard-only users can now open a canvas step's details with Enter or Space through the
same D-183-05 contract the mouse uses, the screen reader is told only what this read-only
surface actually does, `citation_policy: "partial"` reads the same MIDDLE strictness on the
canvas as it does on the workflow soul, and `PhaseNode.tsx` is lint-clean.

## What Was Built

| Finding | Severity | Closure |
|---|---|---|
| **CR-01** | Critical | `activateFromKeyboard` on the `<ReactFlow>` wrapper: Enter / Space resolve the pressed `.react-flow__node`'s `data-id`, verify it is a `CANVAS_NODE_TYPES.phase` node in the memoized projection, `preventDefault()`, then call `onSelectNode(id)` — the exact call a click makes. SC#3's keyboard half is now kept, not merely advertised. |
| **WR-06** | Warning | `ARIA_LABELS` overrides both `node.a11yDescription.*` keys with *"Press enter or space to open this step's details."*, replacing the library default that promised arrow-key movement and delete-to-remove. |
| **WR-01** | Warning | `groundingFor` maps `"partial"` to the MIDDLE `flag` face alongside `"flag"`, matching `deriveTier.ts:112-115`. Pinned cross-module by a test importing `deriveTier` / `TIERS`. |
| **WR-05** | Warning | Zero-arity `EndCapNode` (no unused `_props`, no `^_` ignore pattern in this config) + a module-scope `renderPhaseMark(phaseType): ReactNode` helper replacing the render-body `Glyph` binding. Rendered output identical: same bundled SVG, same `h-8 w-8`, same `"•"` fallback. |

## Tasks

| # | Task | Commit |
|---|---|---|
| 1 | RED — install the keyboard-activation and ARIA-honesty gates, prove they fail | `94c9c642` |
| 2 | GREEN — wire keyboard activation and correct the announced affordance | `9488bd05` |
| 3 | Align the `partial` grounding face to `deriveTier` (WR-01) + clear the two lint errors (WR-05) | `bda98813` |

## The Task-1 RED output (verbatim)

Run on unmodified `WorkflowCanvas.tsx` (`git diff --stat` on it printed nothing at the time):

```
 ❯ src/components/workflows/WorkflowCanvas.test.tsx (29 tests | 3 failed) 3585ms
   × Enter on a focused phase node fires onSelectNode with exactly that phase's slug 80ms
   × Space on a focused phase node fires onSelectNode with exactly that phase's slug 54ms
   × describes only what this surface does — no delete, no arrow-key movement 98ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/workflows/WorkflowCanvas.test.tsx > WorkflowCanvas — keyboard activation (CR-01, SC#3) > Enter on a focused phase node fires onSelectNode with exactly that phase's slug
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ src/components/workflows/WorkflowCanvas.test.tsx:176:26
    174|     expect(node).not.toBeNull()
    175|     fireEvent.keyDown(node!, { key: "Enter" })
    176|     expect(onSelectNode).toHaveBeenCalledTimes(1)
       |                          ^
    177|     expect(onSelectNode).toHaveBeenCalledWith("summarize")
    178|   })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/components/workflows/WorkflowCanvas.test.tsx > WorkflowCanvas — keyboard activation (CR-01, SC#3) > Space on a focused phase node fires onSelectNode with exactly that phase's slug
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ src/components/workflows/WorkflowCanvas.test.tsx:187:26
    185|     // The single space character — what KeyboardEvent.key reports for…
    186|     fireEvent.keyDown(node!, { key: " " })
    187|     expect(onSelectNode).toHaveBeenCalledTimes(1)
       |                          ^
    188|     expect(onSelectNode).toHaveBeenCalledWith("research")
    189|   })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/components/workflows/WorkflowCanvas.test.tsx > WorkflowCanvas — the announced affordance (WR-06) > describes only what this surface does — no delete, no arrow-key movement
AssertionError: expected 'Press enter or space to select a node…' to match /open this step's details/i

- Expected:
/open this step's details/i

+ Received:
"Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel."

 ❯ src/components/workflows/WorkflowCanvas.test.tsx:356:18
    354|
    355|     const text = desc!.textContent ?? ""
    356|     expect(text).toMatch(/open this step's details/i)
       |                  ^
    357|     expect(text).not.toMatch(/delete/i)
    358|     expect(text).not.toMatch(/arrow keys/i)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

 Test Files  1 failed (1)
      Tests  3 failed | 26 passed (29)
```

Independently re-run for the exit code: **`vitest exit=1`** — the failure count and the exit
status agree, so no d3-drag "all passed AND exit 1" trap was tripped. Test 3 (the inert
end-cap / stub guard) passed at RED as the plan predicted: it guards the fix from
over-reaching, it is not a CR-01 reproduction.

## Gate differentials (before → after)

| Gate | Baseline at HEAD | After this plan | Verdict |
|---|---|---|---|
| Phase-file suite (`vitest run src/components/workflows`) | 13 files / **370 passed** / 0 failed | 13 files / **376 passed** / 0 failed | ✅ +6 (4 from Task 1, 2 from Task 3); ≥ 376 required |
| Phase-scoped superset | **408 passed** / 0 failed | **414 passed** / 0 failed (16 files) | ✅ ≥ 414 required |
| Typecheck (`tsc -b --force`) | **33** `error TS`, **0** naming a phase file | **33** `error TS`, **0** naming a phase file | ✅ no new signature (D-ITEM-183-01 baseline held) |
| Build (`vite build`) | exit 0; `WorkflowCanvas-*.js` own chunk ~174 kB; main entry ~1,726 kB | exit **0**; `dist/assets/WorkflowCanvas-CqK7aPrP.js` = **174,610 B**; main entry **1,726.27 kB** | ✅ lazy boundary intact, entry ≤ 1,740 kB |
| Lint (scoped) `eslint PhaseNode.tsx` | **2 errors** (`react-hooks/static-components`, `@typescript-eslint/no-unused-vars`) | **0 problems** | ✅ WR-05 closed |
| Lint (a11y, CI-gated) on `PhaseNode.tsx` + `WorkflowCanvas.tsx` | clean | **clean** | ✅ no regression |
| Backend parity half (`test_183_skip_parse_parity.py`) | 13 passed | **13 passed**; `git status --porcelain -- backend/app backend/tests` empty | ✅ frontend-only confirmed |
| Snapshot `canvasModel.fixtures.test.ts.snap` | — | 100 passed **without `-u`**; `git diff --stat` on the snap file prints nothing | ✅ no fixture uses `partial`, as planned |

Source assertions (all run against the shipped files):

- `grep -c "CANVAS_NODE_TYPES.phase" WorkflowCanvas.tsx` → **5** (≥ 2 required — mouse guard + keyboard guard + the map keys)
- `grep -cE "onNodesChange|disableKeyboardA11y" WorkflowCanvas.tsx` → **0**
- `grep -cE "dangerouslySetInnerHTML\s*=" WorkflowCanvas.tsx` → **0**
- `grep -cE "MiniMap|hideAttribution|workflows/validate|grounding_mode" WorkflowCanvas.tsx` → **0**
- all seven read-only opt-outs still present: `showInteractive={false}`, `nodesDraggable={false}`, `nodesConnectable={false}`, `edgesReconnectable={false}`, `connectOnClick={false}`, `edgesFocusable={false}`, `deleteKeyCode={null}` → **1 each**
- `grep -cE "citation_policy|GROUNDINGS\." WorkflowCanvas.tsx` → **0**; same on `PhaseNode.tsx` → **0** (the WR-01 fix lives only in the shared module)
- `grep -cE "grounding_mode|lastIndexOf|const PHASE_GLYPHS" phaseVocabulary.ts` → **0** (the Phase-185 forward reference stays HYPHENATED as `grounding-mode`)
- `grep -c "deriveTier" phaseVocabulary.test.ts` → **4**
- `grep -cE "(import\(...user-event...\)|userEvent\.[a-zA-Z]+\()" WorkflowCanvas.test.tsx` → **2** at HEAD and **2** after (the one dynamic import + its `setup()` call, both driving the ⌥ control outside the plane)
- `grep -c "fireEvent.keyDown" WorkflowCanvas.test.tsx` → **4**
- `git diff -- frontend/src/components/admin/revertByteIdentical.test.tsx` → empty (the 181 scope-freeze tripwire is byte-identical)

## Test name-set differential — the ONE intentional retirement

| Status | Name |
|---|---|
| **RETIRED** | `'partial', 'draft', an absent policy and an unknown value all → open` |
| replaced by | `citation_policy 'partial' → the MIDDLE face, never 'no sources needed' (WR-01)` |
| replaced by | `'draft', an absent policy and an unknown value all → open` |
| net-new (pin) | `agrees with deriveTier for the whole MIDDLE band ('flag' and 'partial')` |

The retired name asserted the defect. Its `draft` / absent / `"tomorrow"` assertions were
kept verbatim in the renamed test — totality over an UNKNOWN policy is still correct and is
not what WR-01 challenged. This is the only test name removed by this plan; every other
counted name is additive. Net: 370 → 376 passing (+4 CR-01/WR-06, +2 WR-01; one rename).

Also net-new (Task 1): `Enter on a focused phase node fires onSelectNode with exactly that
phase's slug`, `Space on a focused phase node fires onSelectNode with exactly that phase's
slug`, `Enter on the end cap and on the unresolved-skip stub fires nothing (mirrors the mouse
path)`, `describes only what this surface does — no delete, no arrow-key movement`.

## Deviations from Plan

**One, in Task 3 Part B — a mechanical consequence of the prescribed fix.**

**1. [Rule 3 - Blocking] Removed the now-unused `EndCapCanvasNode` type import**
- **Found during:** Task 3
- **Issue:** The plan directs `EndCapNode` to take no parameters. That drops the file's only
  use of the `EndCapCanvasNode` type import, which would have produced a NEW
  `@typescript-eslint/no-unused-vars` error — trading one WR-05 error for another and failing
  the task's own "0 problems" criterion.
- **Fix:** Dropped `type EndCapCanvasNode` from the `canvasModel` import list. The plan's
  instruction to "keep its `NodeProps<EndCapCanvasNode>` type intent in a one-line comment
  rather than an unused binding" is honoured — the docblock names the props type React Flow
  calls the component with, and why the underscore convention does not apply in this config.
- **Files modified:** `frontend/src/components/workflows/PhaseNode.tsx`
- **Commit:** `bda98813`

**One in-flight self-correction, recorded for honesty (not a plan deviation).** The first
draft of the Task-2 docblock quoted the library flag name `disableKeyboardA11y` in prose,
which the plan's own source assertion
(`grep -cE "onNodesChange|disableKeyboardA11y" → 0`) correctly caught — a textbook
D-ITEM-183-02 recurrence (a guard binding its own file's comments). The sentence was
rewritten to describe the flag without naming it, before the Task-2 commit. The grep reads 0.

No Rule 1, Rule 2 or Rule 4 events. No package installed (T-183-SC holds: `package.json`
and `package-lock.json` untouched).

## Out-of-scope debt — confirmed UNTOUCHED

Verified by diff inspection of the three commits: the only files this plan touched are the
five in `files_modified`, and `git status --porcelain -- frontend` is empty at close.

| Finding | Still open | Evidence it was not touched |
|---|---|---|
| **WR-02** hardcoded `colorMode="dark"` | yes | `colorMode="dark"` still present in `WorkflowCanvas.tsx`, unchanged |
| **WR-03** duplicate-slug node collapse | yes | `canvasModel.ts` not in the diff |
| **WR-04** reserved-id / edge-id string collisions | yes | `canvasModel.ts` not in the diff |
| **IN-01 … IN-07** | yes | incl. IN-01 (the unreachable glyph fallback) — `renderPhaseMark` preserves the `?? "•"` fallback verbatim rather than removing it |

Also untouched, as the scope fence requires: `PhaseSpineGraph.tsx`, `soulData.ts`,
`WorkflowBuilderPage.tsx`, `deriveTier.ts`, `package.json`, and every snapshot file.

## Still outstanding after this plan (NOT closed by it)

- **U-1 … U-4** — the four G-4 lived-experience UAT rows in `183-VALIDATION.md` must still be
  driven LIVE by the operator before `/gsd:verify-work` can pass Phase 183:
  U-1 Spine ⇄ Canvas agree · U-2 the 5-phase maximum reads without horizontal overflow ·
  U-3 the empty draft does not look broken · U-4 flag-off = yesterday's Builder, operator
  accounts included.
- `visual_workflow_canvas` cold-defaults to `"off"`, so it must be flipped **On in the Control
  Room** before any of those rows can be exercised.
- The out-of-scope debt above remains recorded in `183-REVIEW.md`.

**Recommended addition to the live UAT pass, now that CR-01 is closed:** tab to a canvas step
and press Enter (and Space) with a real screen reader running — the jsdom gate proves the
callback fires and proves the description text, but only a live pass proves what a user
actually hears.

## Threat surface

No new surface. The two `ARIA_LABELS` values are static string literals with zero
interpolation of definition data (T-183-01 holds: `dangerouslySetInnerHTML\s*=` greps 0 on
both files). The keyboard path's only outward call is `onSelectNode(id)` → the page's
`handleSelectNode` (`WorkflowBuilderPage.tsx:205-207`), read at execution time and confirmed
to be a pure `setSelectedSlug` state update with no fetch, no PATCH and no draft mint
(T-183-12 holds). No backend file, no route, no migration, no dependency, **no cloud parity
owed**.

## Known Stubs

None.

## Validation map

`183-VALIDATION.md` rows `183-08-01` / `183-08-02` / `183-08-03` flipped ⬜ pending → ✅ green.

## Self-Check: PASSED

All 5 modified source files and this SUMMARY exist on disk; all 4 commits
(`94c9c642`, `9488bd05`, `bda98813`, `c549e0a1`) resolve in `git log`.
