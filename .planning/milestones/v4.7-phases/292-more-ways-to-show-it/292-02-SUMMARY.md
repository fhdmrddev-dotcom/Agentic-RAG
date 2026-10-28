---
phase: 292-more-ways-to-show-it
plan: 02
subsystem: chat-artifacts-frontend
tags: [vis-02, artifacts, diagram, comparison, timeline, guard, a11y, tdd]
requires:
  - "273 artifact frame, guard, copy, caption and rail (artifactSpec / artifactCopy / captionModel / ArtifactFrame / ShowArtifactBody)"
  - "292-01 stored contract (<interfaces>): six-name ComponentName, caps, stored specs, edge_count / option_count"
provides:
  - "Six-component frontend registry (chart, table, metric, diagram, comparison, timeline)"
  - "parseArtifactRecord arms for diagram / comparison / timeline mirroring 292-01's stored contract"
  - "Pure layoutDiagram(spec, width); pure timelineModel (buildRail, deadlinePill, formatEventDate, parseEventDate); pure comparisonModel"
  - "DiagramArtifact (2A), ComparisonArtifact (3A), TimelineArtifact (4A), one shared ArtifactTooltip"
  - "artifactRenderers.fence.test.ts source fence over the seven new files"
affects:
  - "292-03 (merged-tree proof: artifactParity fence green, cross-stack fixture fence through this guard)"
tech-stack:
  added: []
  patterns:
    - "Pure model beside each renderer (no UI framework, no clock); renderer reads the clock once and injects it"
    - "Roving tabindex + hover == focus highlight; anchored, portalled tooltip with Escape"
    - "Marker ids from useId() + validated record id; model ids never reach the DOM"
key-files:
  created:
    - frontend/src/components/chat/artifacts/diagramLayout.ts
    - frontend/src/components/chat/artifacts/DiagramArtifact.tsx
    - frontend/src/components/chat/artifacts/ArtifactTooltip.tsx
    - frontend/src/components/chat/artifacts/comparisonModel.ts
    - frontend/src/components/chat/artifacts/ComparisonArtifact.tsx
    - frontend/src/components/chat/artifacts/timelineModel.ts
    - frontend/src/components/chat/artifacts/TimelineArtifact.tsx
    - frontend/src/components/chat/artifacts/__tests__/diagramLayout.test.ts
    - frontend/src/components/chat/artifacts/__tests__/DiagramArtifact.test.tsx
    - frontend/src/components/chat/artifacts/__tests__/ArtifactTooltip.test.tsx
    - frontend/src/components/chat/artifacts/__tests__/comparisonModel.test.ts
    - frontend/src/components/chat/artifacts/__tests__/ComparisonArtifact.test.tsx
    - frontend/src/components/chat/artifacts/__tests__/timelineModel.test.ts
    - frontend/src/components/chat/artifacts/__tests__/TimelineArtifact.test.tsx
    - frontend/src/components/chat/artifacts/__tests__/artifactRenderers.fence.test.ts
  modified:
    - frontend/src/components/chat/artifacts/artifactSpec.ts
    - frontend/src/components/chat/artifacts/artifactCopy.ts
    - frontend/src/components/chat/artifacts/captionModel.ts
    - frontend/src/components/chat/artifacts/ArtifactFrame.tsx
    - frontend/src/components/chat/artifacts/artifactRegistry.ts
    - frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx
    - frontend/src/components/chat/artifacts/__tests__/fixtures.ts
    - frontend/src/components/chat/artifacts/__tests__/artifactSpec.test.ts
    - frontend/src/components/chat/artifacts/__tests__/captionModel.test.ts
    - frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx
    - frontend/src/components/chat/tool-bodies/ShowArtifactBody.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.artifacts.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "A month-precision deadline in the current month reads `this month` (amber, the month form of `due today`); the UI-SPEC's `passed this month` names the same case once the current month counts as past (UI-D-292-15), so it is not emitted"
  - "Spec-leak fences ban `events` only in its key forms (`\"events\"`, `events:`), because `events` is also the closed item word the catalogue sentences use (`it has no events to show`) — the same treatment 273 gave `rows`"
  - "A self-loop takes no gutter lane: rx = width − 8 − 8·(j mod 4) counts non-self back edges only"
  - "Roots for the back-edge DFS ignore self-loops when computing in-degree"
  - "Optional strings in the guard: absent / null / blank → null (mirrors the server's blank→null); an absent node kind → step; an absent deadline → false"
  - "`wrong-option-count` pluralises (`it has 1 option; …`); an alias starting with a vowel reads `an` (`an image`)"
metrics:
  duration: "~40 min"
  completed: "2026-10-24"
  tasks: 3
  commits: 6
  files: 28
---

# Phase 292 Plan 02: The six-component frontend registry Summary

The frontend now draws three new agent-authored artifact types inside the unchanged 273 frame: a flow diagram (2A), a comparison matrix (3A) and a vertical timeline (4A). A hand-rolled guard checks every stored diagram, comparison and timeline record against plan 01's contract before any renderer sees it. The diagram layout and the timeline rail are pure, deterministic code, and one shared tooltip shows each element's server-resolved source.

## What was built

- **Guard (`artifactSpec.ts`).** The vocabulary is now six names. `LABEL_RE` is built from those six. There is one arm each for diagram, comparison and timeline.
  - Each arm enforces the backend's caps, uniqueness, references, the duplicate `from→to` rule, the unlabelled self-loop rule, the kinds and verdicts (read through `own()`), calendar dates parsed from integer parts, the source shape, `row_count` parity and `lineage: null`.
  - One asymmetry is deliberate: the guard renders 1-25 nodes and 0-40 edges, where the backend requires at least 2 nodes and 1 edge.
  - Each failure maps to one closed reason: `too-many-items`, `wrong-option-count`, `no-items`, `broken-link`, `ragged-term`, `bad-date`, or `invalid-settings`.
- **Copy (`artifactCopy.ts`).**
  - The `COMPONENT_ALIASES` table and `componentAlias()`.
  - The widened unknown-component sentence, plus the alias sentence.
  - The six new notice sentences.
  - Every count, verdict, Today, pill, gap, aria and tooltip string from UI-SPEC §Copywriting.
- **Caption and frame.**
  - The count segment is phrased per component from the validated spec: `8 steps · 9 links`, `3 options × 7 terms`, `9 events`.
  - Comparison alone gets a `note`, shown as a full-width italic second caption line.
- **Rail (`ShowArtifactBody`).** It handles six components and reads only `row_count`, `edge_count` and `option_count`. It shows `Flow diagram · 8 steps, 9 links`, `Comparison · 3 options × 7 terms` and `Timeline · 9 events`.
- **Diagram.**
  - `layoutDiagram` follows the UI-SPEC's 14 steps: iterative DFS for back edges, longest path in Kahn order, row wrap, the 48px gutter, line-estimate heights, and forward / gutter / self-loop paths.
  - `DiagramArtifact` draws HTML node boxes over one SVG edge layer. Width is measured with a guarded ResizeObserver.
  - Hover and focus give the same highlight. Keyboard focus roves through reading order.
  - Node names follow the form `… Leads to … Loops back to … Comes from …`.
  - Marker ids come from `useId()` plus the record id.
- **Comparison.**
  - `comparisonModel` holds the identical-term rule (same verdict and same displayed text; `q` = Not stated) and the glyph table.
  - `ComparisonArtifact` is a real `<table>` with one lucide or `?` badge and an sr-only word per cell, and an italic `Not stated` for `q` cells.
  - The differ toggle shows the hidden count. It is disabled, with a title, when nothing is identical, and shows an all-identical row when everything is.
  - The term column is sticky, the cells use a 2-D roving tab stop, and sourced cells show the tooltip.
- **Timeline.**
  - `timelineModel` parses dates from integer parts and sorts stably. It places exactly one Today row and adds gap rows (6+ months) only between events on the same side. Day pills use UTC-noon maths, month pills use calendar months, and month names come from a fixed table. `today` is an argument.
  - `TimelineArtifact` reads the viewer's clock once per render; tests can inject it. It draws filled, hollow and amber dots, worded pills, sr-only state words and focusable source lines.
- **Tooltip (`ArtifactTooltip`).**
  - It is anchored to the element, never the cursor. It sits above, flips below with less than 8px of room, and is clamped 8px inside the viewport.
  - It is portalled into the body with `role=tooltip` and id `{artifactId}-tip`.
  - Escape anywhere dismisses it. The header and excerpt are React text.

## Commits

| Task | Gate | Commit | What |
|---|---|---|---|
| 1 | RED | 6736fe526 | fixtures for the three types; guard, caption and rail cases |
| 1 | GREEN | 89df17669 | guard arms, copy, caption counts, frame note, rail lines; pins raised |
| 2 | RED | d34695cb0 | layout, renderer and tooltip tests; three suites adopted in both knobs |
| 2 | GREEN | 575f6a689 | diagramLayout, DiagramArtifact, ArtifactTooltip; registry + diagram |
| 3 | RED | 2122f0de9 | comparison, timeline, fence, ArtifactBlock and MessageItem tests; five suites adopted; ALL_VALID widened |
| 3 | GREEN | 51a4bffcd | comparison and timeline models + renderers; registry is six |

## Verification

- **Targeted vitest** (`GSD_VITEST_MAX_WORKERS=2`): `src/components/chat/artifacts` + `ShowArtifactBody.test.tsx` + `MessageItem.artifacts.test.tsx` gave **17 files, 291 passed, 0 failed**. Per-file counts were measured with the JSON reporter, and every pin matches:

  | Suite | Cases | Status |
  |---|---|---|
  | artifactSpec | 64 | raised from 28 |
  | captionModel | 21 | raised from 12 |
  | ShowArtifactBody | 26 | raised from 17 |
  | ArtifactBlock | 13 | raised from 8 |
  | MessageItem.artifacts | 8 | raised from 5 |
  | diagramLayout | 20 | new |
  | DiagramArtifact | 17 | new |
  | ArtifactTooltip | 9 | new |
  | comparisonModel | 8 | new |
  | ComparisonArtifact | 14 | new |
  | timelineModel | 16 | new |
  | TimelineArtifact | 11 | new |
  | artifactRenderers.fence | 12 | new |

- **Adjacent suites:** `ToolCallPanel.showArtifact`, `threads.artifact` and `streamsProviderArtifact` are green.
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` reports 63 errors at the base and 63 at HEAD. Compared as an error set, **no new error and none removed**.
- **Lint:** `npx eslint src/components/chat/artifacts` exits 0. One error remains in `ShowArtifactBody.tsx`: `react-refresh/only-export-components` on `export function summarize`. That export is **inherited**: it exists at base `ba8e38c05`, line 153.
- **Untouched:** `git diff --stat ba8e38c05 -- frontend/package.json frontend/package-lock.json frontend/src/index.css frontend/src/components/chat/__tests__/artifactParity.fence.test.ts` is empty. No dependency was added (D-19).
- **Acceptance greps:** all return the expected counts.
  - `ComponentName` line = 1
  - `"actor"` = 0
  - the comparison note string ≥ 1
  - `Favourable` ≥ 1
  - `"yes"` / `"partly"` = 0
  - `diagramLayout` holds no react / document / window = 0
  - `useId` ≥ 1, `id="ah"` = 0
  - `createPortal` = 1
  - no innerHTML / mermaid / dagre / elkjs = 0
  - registry lines = 3
  - timelineModel: `Date.now(` / `new Date(` with an argument = 0, and `Intl` = 0
  - hex colours = 0
- **Full vitest count gate:** not run here, by plan. It runs once on the merged tree in plan 03.

### Known in-worktree red, expected

- **`frontend/src/components/chat/__tests__/artifactParity.fence.test.ts` › "ComponentName == ARTIFACT_COMPONENTS (as sets)"** is the **only** failing case among the artifact suites. It reads `backend/app/models/artifact.py?raw`, which in this worktree still lists three names. It turns green when plan 01 merges; plan 03 re-runs it. The file is unedited.
- **`node scripts/check-hot-file-ledger.cjs 292`** exits 1 with 8 `[no-row]` entries:
  - 7 are this plan's new frontend files (named by 292-02-PLAN.md);
  - 1 is plan 01's `artifact_sources.py`.
  - Plan 01's STEP-0 ledger commit adds all eight rows. No ledger row was added here, by instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectation for the gutter lane was wrong.**
- **Found during:** Task 2 GREEN.
- **Issue:** The RED test took the invoice diagram's two back edges as two gutter lanes. One of those back edges is a self-loop, which arcs off its own node and takes no lane.
- **Fix:** The test now uses a graph with two non-self back edges plus a self-loop. It asserts `rx` = 854, `null` and 846. The layout does not advance `j` for self-loops.
- **Files:** `diagramLayout.ts`, `diagramLayout.test.ts`. **Commit:** 575f6a689.

**2. [Rule 1 - Bug] Live and reload diagram HTML differ only in the useId fragment.**
- **Found during:** Task 3.
- **Issue:** React's client `useId` counter is page-global, so a second mount gets a different marker-id fragment. This is a render-order artifact, not content. Marker ids must stay per-instance (T-292-13).
- **Fix:** The MessageItem live == reload case normalises only the `{recordId}-<fragment>-ah[-hot]` pattern. Every other byte is still compared.
- **Files:** `MessageItem.artifacts.test.tsx`. **Commit:** 2122f0de9.

**3. [Rule 3 - Blocking] One new type error and three lint errors in this plan's files.**
- **Found during:** Task 3 checks.
- **Issue:** The type error was an unused map parameter in `diagramLayout.ts` (introduced in Task 2). The lint errors were `jsx-a11y` on the role=img roving node and the focusable timeline source line, plus `react-refresh` on the exported `tooltipPosition`.
- **Fix:** Renamed the parameter to `_edge`. Added three justified `eslint-disable-next-line` directives. Two cite UI-D-292-08 / WCAG 2.1.1 / 1.4.13, which require focusable, hover-revealing elements. The third covers the placement rule pinned by its own unit test. The tree has precedent for this (`DocumentChunksSection.tsx`).
- **Commit:** 51a4bffcd.

### Decisions recorded, not deviations

- The plan's behaviour list says no notice sentence may contain `events`. The UI-SPEC catalogue makes `events` the closed item word for timelines (`it has no events to show`, `max 40` events). UI-SPEC wins conflicts, so the fence bans only the key forms. 273 handled `rows` the same way.
- **`passed this month` is not emitted.** The UI-SPEC lists both `this month` (upcoming) and `passed this month` (past) for month precision. UI-D-292-15 puts the current month on the past side, so both phrases would describe the same case. That case reads `this month`, in amber, as the month form of `due today`.
- **The ShowArtifactBody `?raw` non-vacuity key list was not widened** with `edge_count` / `option_count`. Inside this worktree the backend does not emit those keys yet, and widening the list would add a second in-worktree red. Plan 03 proves them on the merged tree.

## Known Stubs

None. Every renderer reads only validated record data. The timeline's Today row comes from the viewer's clock by design (D-18).

## Threat Flags

None. The new surface is the client-side renderers and the guard, all covered by the plan's T-292-10..16 register:

- text-only rendering, fenced by `artifactRenderers.fence.test.ts`;
- `own()` lookups for the closed tables;
- marker ids from `useId()`;
- caps checked before render;
- a closed notice catalogue;
- an injected clock.

## TDD Gate Compliance

Every task has a `test(292-02)` RED commit before its `feat(292-02)` GREEN commit (6736fe526 → 89df17669, d34695cb0 → 575f6a689, 2122f0de9 → 51a4bffcd). Each RED run was confirmed failing before implementation. Some new cases passed at RED, and those are regression pins: unchanged tabular captions, "no note → nothing extra" and the diagram live == reload case once Task 2 had landed.

## Self-Check: PASSED

- All 15 created files and 13 modified files are present in the worktree.
- All six commits are present in `git log`.
