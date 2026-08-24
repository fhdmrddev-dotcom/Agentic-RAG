---
phase: 200-the-workflow-journey
plan: 06
subsystem: ui
tags: [react-flow, workflow-canvas, theming, context-provider, connection-states, edge-labels, fences]

# Dependency graph
requires:
  - phase: 200-01
    provides: the CHECKLIST §3 acceptance bar, §6 baselines and §0's refutations (X-2, X-6, X-15)
  - phase: 200-02
    provides: the executor-declared per-step count (`step_count` / `step_noun`) on all four transports
  - phase: 200-05
    provides: the wave's spine work; `phaseDuration.ts` / `receiptVocabulary.ts` (untouched here)
provides:
  - "A connection that carries the upstream step's DECLARED count — one mechanism, no second counting path"
  - "The four connection states (`at rest` · `selected` · `hovered` · `not taken`) with a legend, in one leaf"
  - "A branch node that states its own condition in the TARGET STEP'S NAME, never a slug"
  - "`BUG-260813-01` closed by an app-wide ThemeProvider — the canvas follows the theme, cards included"
  - "A §3.2 MUST-NOT-RENDER fence in the role-SET + rendered-text shape, driven RED and restored"
  - "The seeded `constructor`-slug fixture that lets `BUG-260807-01` / `BUG-260808-01` be closed on evidence"
affects: [200-07, workflow-run-surface, chat-shell, theming, any future canvas plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Theme as a CONTEXT (throwing hook for writers, non-throwing for leaf reads) — the TechnicalNamesProvider shape"
    - "Connection state as a pure leaf: words + deltas + precedence in one module, resolved by the shell"
    - "Edge payload as a pass-through: the page declares, the shell relays, the edge renders or renders nothing"

key-files:
  created:
    - frontend/src/providers/ThemeProvider.tsx
    - frontend/src/components/workflows/connectionState.ts
    - frontend/src/components/workflows/connectionState.test.ts
    - scripts/seed-constructor-slug-workflow.py
  modified:
    - frontend/src/components/workflows/FlowEdge.tsx
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/canvasModel.ts
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/runVocabulary.ts
    - frontend/src/components/workflows/PhaseNode.tsx
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/phaseNodeCardContract.ts
    - frontend/src/hooks/useTheme.ts
    - frontend/src/main.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .claude/skills/sketch-findings-agentic-rag/references/icon-convention.md

key-decisions:
  - "BC-MR-04 is PARTLY built and the remainder is NAMED, not dropped: the node's 62px filled icon-well disc is pinned BYTE-FOR-BYTE by three CARD_HTML_BASELINE captures plus a shape array, and read by 11 further assertions across two suites. The house precedent (199-03) is to WITHDRAW rather than re-baseline a characterization pin."
  - "The theme fix is a PROVIDER, not a second `useTheme()` call — a forked per-consumer hook gives each consumer its own state and neither re-renders the other."
  - "`hooks/useTheme.ts` becomes a re-export rather than being deleted: three shipped suites `vi.mock` that path, and repointing the import would make all three inert SILENTLY."
  - "`ChatLayout.tsx` was NOT modified — the re-export made an edit unnecessary, which is safer than touching a file carrying a `?raw` ordering fence."
  - "`not taken` is a fact about the DEFINITION (the conditional branch), never a claim that a run did not take a line."
  - "The run page's one-line supply of `count`/`noun` into `NodeRunState` is `200-07`'s to wire — this plan does not edit `WorkflowRunPage.tsx`."

patterns-established:
  - "A MUST-NOT-RENDER fence is role-SET + rendered LEAF text, with two PERMANENT controls (planted violation, deliberate absence) — the only shape measured to fire on this surface"
  - "A guard's own explanatory prose must not contain the guard's needle: two fences in this plan went RED against a correct tree for exactly that reason"

requirements-completed: [DES-02]

# Metrics
duration: 62min
completed: 2026-08-20
---

# Phase 200 Plan 06: The Canvas Summary

**The connection now carries a fact it did not invent, a branch names its own condition in business words, and the canvas finally follows the app's theme — through one shared theme state rather than a second forked hook.**

## Performance

- **Duration:** ~62 min
- **Tasks:** 3/3
- **Commits:** 3 (one per task)
- **Files modified:** 18 (4 created, 14 modified)
- **Base SHA:** `d174fe96b09ba569d5b50f7660f550d9ffe9cfe6` (asserted; the wrong-base fork fired as predicted — `merge-base` read `3781a3fe` and was corrected by `git reset --hard`)

## `builder-canvas`: 9/10 atoms fully built, 1 PARTIAL and NAMED

Per `200-CHECKLIST.md` §3, cited by row id. The `MUST NOT RENDER` half is reported exactly as strictly as the `MUST RENDER` half.

| id | verdict | evidence |
|---|---|---|
| **BC-MR-01** | ✅ BUILT | The payload label IS the upstream's declared count, read through the existing `runState` seam. Driven: change the seam, the plane changes (`312 zzqx` → `7 zzqx`). ⚠ **Hand-off named below.** |
| **BC-MR-02** | ✅ BUILT | `connectionState.ts` owns the four; `at-rest` and `not-taken` carry EMPTY deltas so shipped connectors are unmoved. Hover and selection are **driven for real** through the plane's first-class props, not merely representable. A legend strip names all four. |
| **BC-MR-03** | ✅ BUILT | `branchConditionOf` resolves `on_failure: skip_to_phase:<slug>` to the target step's NAME through the same `nodeTitle` the face uses. Driven on `branching`: `If the check fails → Wait for your approval`, with `escalate` and `skip_to_phase` both asserted ABSENT. |
| **BC-MR-04** | ⚠ **PARTIAL — the miss is NAMED, see below** | Every mark this plan draws is line vocabulary (weight + dash, no glyph, no hue); §4 gains their row FLAGGED AS A PROPOSAL and its stale `6` is corrected to `7` (X-15). **The existing filled icon-well disc is NOT re-toned.** |
| **BC-MR-05** | ✅ BUILT | Light mode asserted on **BOTH** halves — the plane's class AND a node card's computed `.closest(".dark")` — in both directions, plus a provider-broadcast toggle. **Driven RED** (see below). |
| **BC-MNR-01** | ✅ FENCED | A DOM absence, never `0`, never a dash, never an empty pill; a declared `0` renders. Source fence forbids `?? 0` and `if (count)` with positive controls. |
| **BC-MNR-02** | ✅ FENCED | The noun passes VERBATIM (driven with `zzqx`, a word no vocabulary here contains) and `FlowEdge.tsx` is grepped for all three shipped nouns → zero. The fence also catches the sheet's own `312 docs matched` shape. |
| **BC-MNR-03** | ✅ BUILT | `colorMode="dark"` gone; `colorMode="system"` also forbidden, with its reason recorded. |
| **BC-MNR-04** | ✅ FENCED | Ligatures scanned two ways — whole-text for the unambiguous underscore forms, LEAF-EXACT for the ones that are ordinary English (`add`, `search`, `lock`), so honest copy such as *"Add the first step"* does not fire it. |
| **BC-MNR-05** | ✅ FENCED | No second counting path: the canvas calls the page's function and keeps what came back. Proved by the pass-through case rather than by a grep alone. |

### ⚠ The named miss — BC-MR-04's second half, and why it was not taken

The atom reads *"Node marks drawn in the line vocabulary, not as large filled circles."* The **large filled circle is `NodeIconWell.tsx`'s 62px disc** — a `radial-gradient` plus two blurred layers behind the 3D phase mark.

**Measured before deciding, not estimated:**

- **3** `CARD_HTML_BASELINE` captures in `PhaseNodeCard.test.tsx` contain that markup **byte for byte**, alongside a captured shape array;
- **7** further `radial-gradient` assertions in `PhaseNodeCard.test.tsx` and **4** in `PhaseNode.test.tsx` read the tint through that exact element — including the one that proves the per-type tint reaches the DOM at all.

Re-toning it therefore means re-baselining a **characterization pin**, and this repository's own precedent is explicit: `199-03` **withdrew a completed soul re-tone** rather than re-baseline `WorkflowDoorSwitch.baseline.test.tsx`. Doing it inside a plan whose other nine atoms are behaviour changes would also mix a visual re-skin into a diff whose value is that everything else is provably unmoved.

**Re-open trigger:** *the next phase that opens `PhaseNodeCard.tsx` or `NodeIconWell.tsx` for a visual reason* — it should carry the icon-well re-tone and the baseline splice together, in the documented `withHoverLift199` splice idiom that file already uses.

### ⚠ The hand-off BC-MR-01 owes to `200-07` — stated, not left silent

The seam, the relay and the render all ship here, and are driven end-to-end in both suites. **What does not ship here is the production supply line:** `WorkflowRunPage.tsx:721` builds the `NodeRunState` map, and that file belongs to `200-07`. One line — forwarding the phase row's `step_count` / `step_noun` into the object it already builds — makes the label appear on the live run canvas.

Recorded rather than done, because the executor prompt for this plan is explicit that `200-07` owns that file. **`200-07` inherits it**, and its own plan already renders those two wire fields in the panel, so the data is in its hands.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] `--help` on the seed script raised `UnicodeEncodeError` on Windows**
- **Found during:** Task 3, smoking the new script
- **Issue:** `argparse.ArgumentParser(description=__doc__)` printed the module docstring — em-dashes, box rules, `⚠` — into a cp1252 console, producing a traceback instead of usage text. The operator running the fixture would have hit it first.
- **Fix:** an ASCII-only `description` pointing at the docstring; the same correction applied to one `print` line.
- **Commit:** `14ced7bd`

**2. [Rule 3 — Blocking] Two fences went RED against a CORRECT tree, both because prose contained the needle**
- **`WorkflowCanvas.tsx`:** the payload memo's docblock quoted the literal string the suite slices its source on, which moved the `indexOf` and handed the fence an **empty slice**. Reworded to describe the anchor rather than spell it; the file now says so.
- **`WorkflowCanvas.test.tsx`:** the "no consumer forks the theme state" fence read RAW source, and both files **explain** the forked-state defect in their docblocks. Re-anchored on `stripComments`, with the reason recorded — a fence a correct explanation can break is a fence that gets its explanation deleted.
- This is the 187-24 trap, twice in one plan.

**3. [Rule 1 — Bug] The role-SET pin's first form was wrong**
- Predicted `["button", "implicit:button"]`; the real plane also carries `application`, `img` and **`implicit:link`** — the React Flow attribution anchor. A link is precisely the tag `199-03` proved a button scan walks past. Captured from the render rather than reasoned.

### Deliberate departures from the plan text

- **`ChatLayout.tsx` was NOT modified**, though the plan's `files_modified` lists it. Making `hooks/useTheme.ts` a re-export means the seam is identical and the three suites that `vi.mock` that path stay pointed at what they intercept. Editing a file carrying a `?raw` ordering fence for no functional gain is the worse trade.
- **`FlowEdge.test.tsx` did not need a `--reporter=basic` drop** — the flag was never used; per the binding constraint it is absent from every command run here.
- **The snapshot `canvasModel.fixtures.test.ts.snap` was updated deliberately** — see below.

## Evidence: the fences were DRIVEN, not read

| What was planted | Result | Restored |
|---|---|---|
| `colorMode="dark"` re-hardcoded in `WorkflowCanvas.tsx` | **4 RED** — including *"a NODE CARD has no `.dark` ancestor"*, the half a source-only fence cannot see | md5 `c5bc0e1827243bea0d50f22727f2e9a2`, **identical before and after** |
| Five violations in a detached container (2 ligature forms, `0`, `—`, `312 docs matched`) | predicate finds **all five**; a link's role found by the role-SET scan and not by a button count | permanent control, committed |
| Honest copy (`Add the first step`, `312 sources`, `0 sources`) | predicate **silent** | permanent control, committed |

⚠ **The projection's own drift tripwire fired too, and that is the evidence rather than a nuisance.** `canvasModel.fixtures.test.ts.snap` went red on **exactly one line, on exactly one node of exactly one fixture** — `"condition": "If the check fails → Wait for your approval"` on `branching`'s `assess`. Updated deliberately; `git diff --numstat` reads **`1 0`**, which is the proof the conditional spread left every other projected node byte-identical.

## Baselines — re-derived, not inherited

| Gate | §6 baseline | measured at this plan's close | verdict |
|---|---|---|---|
| count gate | `4970 · failed 0 · 4543 · 96/96` | **`total 5135 · failed 0 · pinned total 4755 · 101/101`** | **OK** — no per-file decrease, 0 failing, **first run at cap 2 every time** |
| `tsc -p tsconfig.app.json --noEmit` | `33 errors / 19 files` | **33 / 19**, unmoved, **zero in this plan's files** | OK |
| `check-claude-md-size.cjs` | — | **95,881 chars · 63.9% · exit 0** | OK |

**Every increment attributed, so growth is distinguishable from drift.** Pinned total `4678 → 4755` (+77): `FlowEdge.test.tsx` 22 → 34 (+12, all this plan's), `connectionState.test.ts` new at 13, `WorkflowCanvas.test.tsx` 53 → 105 (+52, of which **+24 was PRE-EXISTING drift absorbed deliberately** and +28 is this plan's, raised across its three commits and recorded as three separate lines so the decomposition survives).

⚠ **The gate NEVER redded**, so `SEED-171`'s triage procedure was never entered — recorded as an observation, not as proof of innocence. `WorkflowBuilderPage.canvas.test.tsx`, one of the five and this plan's adjacent page suite, was green on the first run of every invocation, including a full 70-file / 4077-test run of `src/components/workflows`. The worker cap was never touched.

## Cross-surface consequences the next plan inherits

1. ⚠ **The theme change LANDS IN CHAT FIRST.** `ChatLayout.tsx` is `useTheme`'s sole consumer *and* `WorkspacePanel`'s only production mount. A UAT that exercises only a workflow surface will miss it — the chat shell must be exercised in **both** themes.
2. ⚠ **`WorkflowCanvas.tsx` is mounted on BOTH pages.** Every change here reaches `WorkflowRunPage.tsx:1091` (`editable={false}` + `runState`) as well as the builder. The run-page mount gains: the payload label (inert until the page supplies the two fields), `data-connection-state` on flow edges, the legend strip, edge hover/selection, and the theme-following plane. **None of it is gated on `editable`** — that is deliberate (a run canvas benefits from all five) but `200-07` should know it inherits them.
3. **The branch condition renders on both surfaces too**, since it is projection-derived rather than run-derived.

## Owed as driven rows (scheduled, never claimed)

Both belong in `200-VALIDATION.md`; neither is asserted as done here.

1. **Light mode on both canvas mounts**, including a toggle made in `ChatLayout` while a workflow surface is open — the property a forked hook could not have.
2. **The `constructor`-slug row that flips `BUG-260807-01` AND `BUG-260808-01`.** The fixture is **seeded and ready**: `zz-200-06-fixture-constructor` (`890c3827…`) and its control `zz-200-06-fixture-harmless` (`c95f71c1…`) exist in the local database now. The five steps live in the script's docstring; the slug must be swung **both ways** and the readings must agree before either report is closed. An automated floor already guards the class between browsers.

⚠ **`SEED-143`** — constraining `slug` at the API/schema boundary — **stays NOT TAKEN**, per §0.2 X-6. Trigger unchanged: *the next phase that opens a `workflow_phases` migration for another reason.*

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. The one new slug-keyed lookup routes through `own()` over a null-prototype map (T-200-06-01), the label invents no number (T-200-06-02), the theme has exactly one writer (T-200-06-04), and the fence was driven red (T-200-06-05). **No package was installed** (T-200-06-SC) — `package.json` and the lockfile are untouched.

## Known Stubs

None. Every element added renders from real data or renders nothing by design; there is no placeholder text and no hardcoded empty value flowing to a surface.

## Commits

| # | hash | what |
|---|---|---|
| 1 | `9160deea` | BC-MR-01 / BC-MR-02 / BC-MNR-01 / BC-MNR-02 / BC-MNR-05 — the payload label and the four states |
| 2 | `cd6f7b1d` | BC-MR-03, BC-MR-04 (partial + named), §4's `6` → `7` |
| 3 | `14ced7bd` | BC-MR-05 / BC-MNR-03 / BC-MNR-04 — ThemeProvider, the two fences, the fixture, the ledger |

## Self-Check: PASSED

- Files created — all FOUND: `frontend/src/providers/ThemeProvider.tsx`, `frontend/src/components/workflows/connectionState.ts`, `frontend/src/components/workflows/connectionState.test.ts`, `scripts/seed-constructor-slug-workflow.py`, `.planning/phases/200-the-workflow-journey/200-06-SUMMARY.md`.
- Commits — all three FOUND in `git log --oneline --all`: `9160deea`, `cd6f7b1d`, `14ced7bd`.
- `STATE.md` and `ROADMAP.md` — **not modified** (the orchestrator owns those writes); `git status` is clean apart from this file.
