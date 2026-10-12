---
phase: 273-agent-authored-artifacts
plan: 02
subsystem: frontend / chat artifacts
tags: [artifacts, recharts, closed-registry, error-boundary, a11y, count-gate]
requires: []
provides:
  - "ArtifactBlock({ artifacts: readonly unknown[] }) — the body of the one MessageItem mount (273-05 mounts it)"
  - "artifactSpec.ts — the ONE home of ArtifactRecord / ArtifactMissing / NoticeReason + parseArtifactRecord"
  - "artifactRegistry.ts — ARTIFACT_COMPONENTS (chart, table, metric), rendererFor, lazyChartFrom"
  - "artifactCopy.ts — kindChipLabel(component, kind, stacked, seriesCount), kindChipLabelOf, operationPhrase, noticeText (reused by 273-05's rail body)"
  - "--chart-1..--chart-4 in index.css (:root and .dark, same values)"
affects: [273-05]
tech-stack:
  added: []
  patterns:
    - "hand-rolled never-throwing guard mapping every failure to one closed catalogue code"
    - "the tree's first React error boundary (per-artifact)"
    - "lazy chart chunk whose failed load throws a coded ArtifactNoticeError the boundary words"
    - "own() for every payload-keyed table read (registry, chart kinds, alias table)"
key-files:
  created:
    - frontend/src/components/chat/artifacts/artifactSpec.ts
    - frontend/src/components/chat/artifacts/artifactCopy.ts
    - frontend/src/components/chat/artifacts/captionModel.ts
    - frontend/src/components/chat/artifacts/chartModel.ts
    - frontend/src/components/chat/artifacts/artifactRegistry.ts
    - frontend/src/components/chat/artifacts/ArtifactFrame.tsx
    - frontend/src/components/chat/artifacts/ArtifactNotice.tsx
    - frontend/src/components/chat/artifacts/ArtifactErrorBoundary.tsx
    - frontend/src/components/chat/artifacts/TableArtifact.tsx
    - frontend/src/components/chat/artifacts/MetricArtifact.tsx
    - frontend/src/components/chat/artifacts/ChartArtifact.tsx
    - frontend/src/components/chat/artifacts/ArtifactBlock.tsx
    - frontend/src/components/chat/artifacts/__tests__/fixtures.ts
    - frontend/src/components/chat/artifacts/__tests__/artifactSpec.test.ts
    - frontend/src/components/chat/artifacts/__tests__/captionModel.test.ts
    - frontend/src/components/chat/artifacts/__tests__/chartModel.test.ts
    - frontend/src/components/chat/artifacts/__tests__/TableArtifact.test.tsx
    - frontend/src/components/chat/artifacts/__tests__/MetricArtifact.test.tsx
    - frontend/src/components/chat/artifacts/__tests__/ChartArtifact.test.tsx
    - frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx
    - .planning/phases/273-agent-authored-artifacts/273-BASELINES-FRONTEND.md
  modified:
    - frontend/src/index.css
    - scripts/vitest-count-gate.cjs
decisions:
  - "Numbers are formatted with a pinned en-US locale so live and reload render byte-identically whatever the machine locale (G4-2)"
  - "A chart-chunk load failure is a coded ArtifactNoticeError thrown into the per-artifact boundary, so the notice REPLACES the frame instead of nesting inside it"
  - "Unknown keys inside a record are ignored, not rejected; the closed vocabulary is enforced on component, chart kind, lineage op and encoding shape"
  - "A unit with a leading currency symbol renders as a prefix ($K -> $1,532K); word units get a space (12 days)"
  - "Stacked tooltip Total appears only with 2+ visible series (a Total equal to the one value is noise)"
metrics:
  duration: "~40 min (19:35 -> 20:15)"
  completed: 2026-10-03
  tasks: 3
  files: 23
---

# Phase 273 Plan 02: Frontend artifact surface Summary

Every new frontend file for agent-authored artifacts now exists. A never-throwing guard maps any bad
record to one of ten worded notice reasons. A registry closed to chart/table/metric is read through
`own()`. Each artifact sits in its own error boundary. The lazy recharts chart has aria-pressed
legend toggles and colours that stay with the series. The table sorts on click and the metric shows
one value with a delta. 273-05 still has to wire it into the stream, the reload mapper and the
MessageItem mount.

**PHASE_BASE:** `f764734979c25696544b2408232f4fbdc779ae5f`

## Exported names (the contract 273-05 consumes)

| Module | Exports |
|---|---|
| `artifactSpec.ts` | `parseArtifactRecord`, types `ArtifactRecord`, `ArtifactMissing`, `NoticeReason`, `NoticeContext`, `ParseResult`, `ArtifactSpec`, `ArtifactColumn`, `ChartEncoding`, `MetricEncoding`, `LineageOperation`, `ArtifactCaption`, `CaptionSource`, `CaptionLineage`, `Cell`, `ComponentName`, `ChartKind`, `ArtifactBodyProps`; `ArtifactNoticeError`; constants `ARTIFACT_COMPONENT_NAMES`, `CHART_KINDS`, `MAX_SERIES`, `MAX_ROWS`, `MAX_COLUMNS`, `PALETTE_SLOTS` |
| `artifactRegistry.ts` | `ARTIFACT_COMPONENTS`, `rendererFor`, `lazyChartFrom`, type `ArtifactRenderer` |
| `artifactCopy.ts` | `noticeText`, `kindChipLabel(component, kind, stacked, seriesCount)`, `kindChipLabelOf(record)`, `operationPhrase(op)`, `kindAlias`, `KIND_ALIASES`, `NOTICE_TITLE`, `NOTICE_FOOTNOTE`, `ALL_SERIES_HIDDEN`, `CAPTION_*`, `formatNumber`, `formatCompact`, `rowsPhrase`, `truncateValue`, `withUnit`, `splitUnit`, … |
| `captionModel.ts` | `captionSegments(record) → { icon: "file" \| "info"; parts: string[] }` |
| `chartModel.ts` | `seriesSlots`, `seriesNames`, `seriesColor`, `isStacked`, `chartData`, `visibleDomain`, `niceTicks`, `xDomain`, `tooltipRows`, `formatTick`, `formatValue`, `formatX`, `ariaLabel`, `srSummary`, `valueToY`, `decollide` |
| `ArtifactBlock.tsx` | `ArtifactBlock({ artifacts?: readonly unknown[] \| null })` |
| `ChartArtifact.tsx` | default `ChartArtifact` (lazy), named `ChartTooltipContent` |
| `ArtifactFrame.tsx` / `ArtifactNotice.tsx` / `ArtifactErrorBoundary.tsx` / `TableArtifact.tsx` / `MetricArtifact.tsx` | the components of the same names (`ArtifactBusyBody` from the frame) |

## Count gate (from the repo root, `GSD_VITEST_MAX_WORKERS=2`): verdict line verbatim

```
  total                                      8808    9563    +755
  total 9563  ·  failed 0  ·  pinned total 8808
count gate OK — 383/383 pinned files present, no per-file decrease, 0 failing.
```

The seven suites appear in both TARGETS (by file path, because `src/components/chat` has no
directory entry) and BASELINE, pinned at measured counts: `artifactSpec` 28, `chartModel` 19,
`ChartArtifact` 15, `captionModel` 12, `ArtifactBlock` 8, `MetricArtifact` 6, `TableArtifact` 6
(94 total). Arithmetic check: 9469 + 94 = 9563 and 8714 + 94 = 8808, so nothing is left unexplained.
The base run's one red (`WorkflowsPage.test.tsx`, a SEED-171 flake, read from the persisted JSON) did
not come back. That is an observation only. It does not prove the suite is fine.

## tsc set-diff (`npx tsc -p tsconfig.app.json --noEmit`)

The base set has 70 errors and so does the set after this plan. **Added: none. Removed: none.**
Nothing new appears under `src/components/chat/artifacts/` (test files are included by this config).
`eslint src/components/chat/artifacts` is clean.

## Verification

- `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/chat/artifacts`: 7 files, 94 passed.
- All plan acceptance greps pass. Nothing outside tests uses `JSON.stringify`,
  `dangerouslySetInnerHTML` or `MarkdownRenderer`. `artifactSpec.ts` imports `ownProperty` once and
  `ArtifactErrorBoundary.tsx` declares `getDerivedStateFromError` once. There are no
  `isAnimationActive={true}`, `animationDuration` or `animate-` occurrences. `index.css` has 8 lines
  matching `--chart-[1-4]:`. `ChartArtifact.tsx` is the only file that imports recharts, it carries
  `aria-pressed` and it has no `<Legend`.
- A throwaway smoke test rendered all six chart fixtures through REAL recharts in jsdom with a
  ResizeObserver stub. Every fixture drew SVG marks and produced no console errors or warnings. The
  test was deleted and never committed.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/273-agent-authored-artifacts`: `ledger gate OK`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ChartArtifact.tsx landed in Task 2 as a minimal module**
- **Found during:** Task 2. The registry's `lazy(() => import("./ChartArtifact"))` must resolve at
  transform time.
- **Fix:** Task 2 committed a 10-line placeholder, and Task 3 replaced it with the recharts
  implementation. Commits 9360b0ef9 and d89cf3618.

**2. [Rule 1 - Bug] `erasableSyntaxOnly` forbids TS parameter properties**
- **Found during:** Task 1 typecheck.
- **Fix:** the `Refusal` class declares its fields explicitly. Commit 85bcbd979.

**3. [Rule 1 - Bug] The lazy chart resolved in an earlier test, which hid the Suspense fallback**
- **Fix:** the busy-frame test re-imports `ArtifactBlock` after `vi.resetModules()`, so it gets a
  fresh lazy instance. Commit 9360b0ef9.

**4. [Rule 1] The leak-token assertion would contradict two catalogue sentences**
- The plan asks that notice text never contain `rows`. The UI-SPEC sentences for `too-many-rows` and
  `no-rows`, and every caption ("16 rows"), legitimately contain the English word. The fences
  therefore ban the KEY forms (`"rows"`, `rows:`) plus `{"`, `component`, `columns`, `spec`, `[` and
  `Error`. That keeps the intent (no spec key reaches the page) without failing on prose.

**5. Fixture row counts follow the data, not the UI-SPEC's illustrative strings**
- A wide bar chart of 4 quarters × 4 regions is 4 rows, so `chartBar` reads `4 rows` and its
  `ariaLabel` reads `Bar chart: FY25 revenue by region · $K, 4 rows`. The 16-row long-form source is
  `table16`. `chartFromFilter` therefore derives from `table 1` (16 rows → `4 of 16 rows`), and
  `chartRedrawn` redraws `chart 1` with `same 4 rows`. Every caption GRAMMAR case in the plan is
  still pinned, word for word.

**6. Lint cleanup (refactor commit 4b700d23c)**
- `ArtifactBlock` renders the registry entry with `createElement`, which satisfies the
  "components created during render" rule because the entry is a stable module-level component.
- `sortedRowIndexes` was made module-private to satisfy react-refresh.
- Thirteen explicit `any`s in the tests were replaced by one typed `Mutable` / `mutable()` helper in
  `fixtures.ts`.

### UI-SPEC choices made where the spec was silent
- **Table header:** shows the unit as `revenue ($K)`.
- **Metric value:** a currency unit is split into a prefix, so `$K` shows as `$1,656` with a muted `K`.
- **Zero comparison:** shows `▲ +$274K vs FY24 ($0K)`.
- **Null filter value in a caption:** reads `(empty)`.
- **Open-ended range:** reads `≥ N` or `≤ N`.
- **Legend group:** has the aria-label `Series`.
- **Scatter y-axis title:** shown only for a single series (`columnHeading`). For multi-series
  scatter the legend names the series.
- **Kind aliases:** pie, donut, radar and funnel read `… chart`; gauge reads `gauge chart`; heatmap,
  histogram and treemap read as bare nouns.
- **Line direct labels:** absolutely-positioned HTML placed from the same domain the y-axis uses and
  de-collided by `chartModel.decollide`. jsdom cannot show them, so the G-4 Chrome drive has to
  confirm their placement.

## TDD Gate Compliance

Each task has a RED commit followed by a GREEN commit:
- Task 1: 19a455060 → 85bcbd979
- Task 2: bad99fe26 → 9360b0ef9
- Task 3: 63d199a45 → d89cf3618

A refactor commit follows (4b700d23c). Every RED run failed before its GREEN commit: Tasks 1 and 2
failed on missing modules, and Task 3 failed 15 of 15 tests against the placeholder.

## Known Stubs

None. The Task 2 `ChartArtifact` placeholder was replaced in Task 3.

## Threat Flags

None. This plan opens no endpoint, auth path, storage or schema. The threat register's mitigations
T-273-09 through T-273-13 are all implemented and pinned by tests:
- **React text only:** grep fence, plus a markup-looking cell that renders as text.
- **`own()` for prototype keys:** `__proto__`, `constructor` and `toString` become the
  unknown-component notice.
- **Closed notice catalogue:** no-leak text assertions, including mutated records and a thrown
  error message.
- **Per-artifact boundary:** a sibling still renders when one artifact throws.
- **Caption built from server facts only.**

## Notes for the orchestrator

- `graphify update .` was NOT run in this worktree, so tracked `graphify-out/` files stay untouched.
  Run it after the wave merges.
- `backend/tests/unit/fixtures/artifact_record_v1.json` (273-01) did not exist in this tree. The
  frontend fixtures carry the full v1 top-level key set (`id`, `thread_id`, `user_id`, `org_id`,
  `run_id`, `tool_call_id`, `parent_id`, `label`, `component`, `spec`, `caption`, `row_count`,
  `spec_version`, `created_at`) so that 273-05's key-set parity fence can compare them.

## Self-Check: PASSED

- All 12 source files, 8 test/fixture files, `273-BASELINES-FRONTEND.md` and this SUMMARY exist on disk.
- All eight commits exist: 19a455060, 85bcbd979, bad99fe26, 8cd567116, 9360b0ef9, 63d199a45,
  d89cf3618, 4b700d23c.
