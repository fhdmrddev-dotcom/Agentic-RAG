---
phase: 273-agent-authored-artifacts
plan: 05
subsystem: frontend / chat artifacts wiring + tool rail
tags: [artifacts, sse, reload, streams-provider, message-item, tool-rail, parity-fence, count-gate]
requires:
  - phase: 273-02
    provides: "ArtifactBlock, parseArtifactRecord, ARTIFACT_COMPONENTS, CHART_KINDS, artifactCopy (kindChipLabel, operationPhrase, rowsPhrase, cellPhrase), fixtures"
  - phase: 273-03
    provides: "the `artifact` SSE event ({artifact: row}), the id-first success result, the {status, reason, detail} refusal, CHAT_ONLY_TOOLS"
  - phase: 273-04
    provides: "MessageResponse.artifacts on GET /messages and GET /snapshot"
provides:
  - "Message.artifacts (types/index.ts) — the wire type re-exported as a TYPE from artifactSpec.ts, never re-declared"
  - "StreamCallbacks.onArtifact + the `artifact` SSE branch (no return, cursor advances)"
  - "_mapMessageResponse carries `artifacts` through (Array.isArray guard)"
  - "StreamsProvider's ONE artifact handler (append + replace-by-id, text untouched)"
  - "MessageItem's ONE <ArtifactBlock> mount (after the answer, before RunTerminalStatus)"
  - "tool-bodies: ShowArtifactBody + summarize, TOOL_BODIES/TOOL_SUMMARIES.show_artifact, ARGS_HIDDEN"
  - "NodeState `refused` (amber) derived from the result's {status:'refused'} marker"
  - "toolName('show_artifact') = 'Show an artifact'; toolLabel = 'Showing an artifact'; stepLabel (rail)"
affects: [273-06]
tech-stack:
  added: []
  patterns:
    - "One shared visibility set (ARGS_HIDDEN) read by both rail components instead of two name checks"
    - "Node state from a structured result marker, never from the tool name"
    - "Backend ↔ frontend closed-vocabulary parity read from SOURCE through ?raw on both sides"
key-files:
  created:
    - frontend/src/components/chat/tool-bodies/ShowArtifactBody.tsx
    - frontend/src/components/chat/tool-bodies/ShowArtifactBody.test.tsx
    - frontend/src/components/chat/__tests__/ToolCallPanel.showArtifact.test.tsx
    - frontend/src/components/chat/__tests__/MessageItem.artifacts.test.tsx
    - frontend/src/components/chat/__tests__/artifactParity.fence.test.ts
    - frontend/src/lib/api/__tests__/threads.artifact.test.ts
    - frontend/src/providers/__tests__/streamsProviderArtifact.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api/threads.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/tool-bodies/index.ts
    - frontend/src/components/chat/ToolCallDetails.tsx
    - frontend/src/components/chat/ToolCallPanel.tsx
    - frontend/src/components/chat/StepRow.tsx
    - frontend/src/components/chat/toolStepDerivation.ts
    - frontend/src/lib/toolNames.ts
    - frontend/src/lib/toolMeta.ts
    - frontend/src/components/workflows/toolNames.test.ts
    - frontend/src/components/workflows/StepPanelPort.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "The rail's step label and the run's activity string are two strings (UI-SPEC names both), so a `stepLabel` reads the phrase for show_artifact and falls through to `toolLabel` byte-for-byte for every other tool"
  - "The rail's narrowed essence names only the VALUE of a single-value filter (`filtered to Q3`), per the UI-SPEC row; the other lineage ops reuse artifactCopy.operationPhrase"
  - "show_artifact sits after search_documents in TOOL_PHRASES (true alphabetical order), not between save_skill and search_documents as the plan text said"
  - "ToolArgsBlock's early return sits AFTER its useState, so the hook order can never depend on the tool name"
metrics:
  duration: "~75 min"
  completed: 2026-10-03
  tasks: 2
  files: 21
---

# Phase 273 Plan 05: Artifacts in the chat, live and on reload, with a rail that never prints the spec

An artifact now shows up under the answer the moment its `artifact` SSE event arrives. It comes
back on reload through the same mapper and renders the same DOM through the one `<ArtifactBlock>`
mount (a test compares the live and reload `innerHTML`). The tool rail names the step in words, and
none of its four shipped leak paths can put the spec, the rows or the model-facing refusal text on
the page.

**Base:** worktree started on `master` (`86d9559bb`, the known quirk). It was reset to the expected
base `25405398311f75c70ae7e77ae8b6965b945d2cb7` (develop with 273-01..04 merged) before any edit,
then bootstrapped.

## Scope authority

D-16 names one StreamsProvider handler and one MessageItem mount. The seven rail files edited beyond
that (`tool-bodies/index.ts`, `ToolCallDetails.tsx`, `ToolCallPanel.tsx`, `StepRow.tsx`,
`toolStepDerivation.ts`, `lib/toolNames.ts`, `lib/toolMeta.ts`) are authorised by **OV-273-04**
(operator-approved 2026-10-03, STATE.md Guardrail overrides). Each hunk is listed below with that
authority.

## Hunks (sizes are `git diff --numstat <base> HEAD`, added / removed)

| File | +/- | What | Authority |
|---|---|---|---|
| `providers/StreamsProvider.tsx` (FIRES) | 16 / 0 | ONE handler, `onArtifact`, beside `onFinalOutputFiles`. It appends in arrival order and replaces a same-id record in place (a replay after reconnect never duplicates). It never touches `content` or `narrationContent`. `grep -c onArtifact` = **1** | D-16 |
| `components/chat/MessageItem.tsx` (FIRES) | 3 / 0 | one import, one JSX comment, one mount line directly before `<RunTerminalStatus>`. Non-comment added lines by the plan's grep = **3** (≤ 4). No hook added, `producedDeliverables` untouched | D-16 |
| `lib/api/threads.ts` | 15 / 0 | `onArtifact?: (raw: unknown) => void`; the `t === "artifact"` branch beside `final_output_files`, with **no `return`**; `_mapMessageResponse` destructures `artifacts` and maps it with `Array.isArray` (undefined otherwise) | D-16 / I-2 |
| `types/index.ts` | 12 / 0 | `export type { ArtifactRecord as ArtifactRecordWire, ArtifactMissing as ArtifactMissingWire } from …artifactSpec` (type-only, no second declaration: `grep -cE "(interface\|type) ArtifactRecordWire\b"` = 0); `Message.artifacts?` with a Phase 273 doc comment | one home |
| `components/chat/ToolCallPanel.tsx` (FIRES) | 10 / 8 | `hideBody={isExecuteCode}` → `ARGS_HIDDEN.livePanel.has(tc.name)` (L-1). Four rail-label call sites `toolLabel` → `stepLabel` (see Deviations) | OV-273-04 |
| `components/chat/ToolCallDetails.tsx` | 13 / 3 | `ToolArgsBlock` returns null for `ARGS_HIDDEN.paramsBlock` (L-2), placed after its `useState`. `ToolResultBlock` dispatches `show_artifact` to `ShowArtifactBody` BEFORE the `parsed.error` arm and never to GenericBody (L-3/L-4) | OV-273-04 |
| `components/chat/StepRow.tsx` | 11 / 7 | `NodeState` gains `"refused"`. Node gets `bg-amber-600 border-amber-600 dark:bg-warning dark:border-warning`; step number and essence text get `text-amber-700 dark:text-warning`. Three rail labels `toolLabel` → `stepLabel` | OV-273-04 |
| `components/chat/toolStepDerivation.ts` | 20 / 0 | `nodeStateOf` returns `"refused"` for a done call whose result parses to an object with `status === "refused"`. Derived from the marker, never the name (`grep '"show_artifact"'` = nothing) | OV-273-04 |
| `components/chat/tool-bodies/index.ts` | 20 / 0 | import/export, `TOOL_BODIES.show_artifact`, `TOOL_SUMMARIES.show_artifact`, and `ARGS_HIDDEN = { livePanel: {execute_code, show_artifact}, paramsBlock: {show_artifact} }` | OV-273-04 |
| `lib/toolMeta.ts` (FIRES) | 15 / 0 | `toolLabel("show_artifact")` = `Showing an artifact` (activity string); `stepLabel(name)` = the phrase for `show_artifact`, otherwise `toolLabel` unchanged | OV-273-04 |
| `lib/toolNames.ts` | 3 / 0 | `show_artifact: "Show an artifact"` | OV-273-04 |
| `tool-bodies/ShowArtifactBody.tsx` | new, 192 | `summarize(tc)` + default body `{ parsed }` | plan |

## Targeted runs, one after each rail arm, in order (`GSD_VITEST_MAX_WORKERS=2`, `--maxWorkers=2`, from `frontend/`)

1. **Step (2)** ShowArtifactBody + `tool-bodies/index.ts` (+ the `toolNames.ts` entry, see Deviations): `npx vitest run src/components/chat/tool-bodies` → `Test Files 3 passed (3) · Tests 30 passed (30)`.
2. **Step (3)** ToolCallDetails: `src/__tests__/components/ToolCallPanel.test.tsx` + `ToolCallPanel.showArtifact.test.tsx` → `1 failed | 1 passed (2) · 5 failed | 31 passed (36)`. Every L-2/L-3/L-4 case and the shipped panel suite were green. The 5 reds were the later arms' own cases (live panel ×1, refused node ×3, toolLabel ×1), which is expected.
3. **Step (4)** ToolCallPanel: + `ToolArgsLivePanel.test.tsx` → `1 failed | 2 passed (3) · 4 failed | 37 passed (41)`. The live-panel case went green. The 4 remaining reds were arms 5 and 6.
4. **Step (5)** StepRow + toolStepDerivation: `RunCard.test.tsx`, `RunCard.characterization.test.tsx`, `stepCount.test.ts`, `Seam.test.tsx`, `ToolCallPanel.test.tsx`, `ToolCallPanel.showArtifact.test.tsx` → `1 failed | 5 passed (6) · 1 failed | 92 passed (93)`. Every `NodeState` consumer was green. The one red was arm 6's `toolLabel` case.
5. **Step (6)** toolNames + toolMeta: `workflows/toolNames.test.ts`, `lib/__tests__/toolNames.test.ts`, `lib/__tests__/toolMeta.test.ts`, `ToolCallPanel.showArtifact.test.tsx` → `Test Files 4 passed (4) · Tests 57 passed (57)`.

Wider sweep after the arms: `src/components/chat src/__tests__/components src/lib/__tests__ src/components/panel` → `Test Files 131 passed (131) · Tests 1787 passed (1787)`. Task 1 sweep: every `MessageItem*` suite, every `*treamsProvider*` suite and `src/lib/api.test.ts` → `37 passed · 341 passed`.

## Count gate (repo root, `GSD_VITEST_MAX_WORKERS=2`): verdict, verbatim

```
  total                                      8865    9620    +755
  total 9620  ·  failed 0  ·  pinned total 8865
count gate OK — 389/389 pinned files present, no per-file decrease, 0 failing.
```

Both knobs, same commit. The six new suites are TARGETS **file** entries, because
`src/components/chat`, `src/lib/api` and `src/providers` have no bare-directory entry, and
`src/providers` is in neither knob. They are pinned in BASELINE at their measured counts:
`threads.artifact` 6, `streamsProviderArtifact` 5, `MessageItem.artifacts` 5,
`artifactParity.fence` 7, `ShowArtifactBody` 17, `ToolCallPanel.showArtifact` 16 (56 in all).
`toolNames.test.ts` (`src/components/workflows`, already gated) was raised from **10 to 11**.
Arithmetic: 8808 + 56 + 1 = 8865 pinned and 9563 + 57 = 9620 total, with no residual.

**This verdict came on the third run, and the two red runs before it are recorded:**
- **Run 1: `failed 2`, and both were REAL.** They were in `src/components/workflows/StepPanelPort.test.tsx`
  (`expected 29 to be 28`, `Show 17 more` vs `Show 16 more`). That suite derived "every id the server
  can offer" from `Object.keys(TOOL_PHRASES)`, and the table now also names the chat-only
  `show_artifact`. Fixed under Rule 1: the suite now subtracts `CHAT_ONLY_TOOLS` parsed from
  `openai_service.py` through `?raw`, so its existing `toBe(28)` doubles as the non-vacuity check.
- **Run 2: `failed 7`, all in files this plan never touched.** Names were read from the gate's
  persisted JSON (`vitest-count-gate-45300-…json`) BEFORE any re-run: `src/pages/WorkflowsPage.test.tsx`
  ×5 and `src/components/workflows/WorkflowCanvas.test.tsx` ×2, all `STACK_TRACE_ERROR` plus one axe
  "already running" cascade. `git diff --numstat <base>` over both suites and their components is
  empty, and `git status` names neither. Between run 1 (where both passed) and run 2 the PRODUCT tree
  did not change; only `StepPanelPort.test.tsx` did. Run in isolation they gave
  `Test Files 2 passed (2) · Tests 164 passed (164)`. `WorkflowsPage.test.tsx` is one of SEED-171's
  named cap-independent flakes and was also the base run's one red in 273-BASELINES-FRONTEND.md.
  This is recorded as **provably unmodified**. That is an observation, not "fine".

## tsc set-diff (`npx tsc -p tsconfig.app.json --noEmit`, `file:line:code`, sorted)

There are 70 errors at base (273-BASELINES-FRONTEND.md §1) and 70 after. **Added: none.
Removed: none.** The first Task 1 run added 6 errors in two of this plan's own new test files (a
fixture typed `Record<string, unknown>` for `spec`, and a partial `StreamCallbacks` cast). Both were
fixed with `as unknown as` casts before the GREEN commit.

## No other tool emits the refusal marker (T-273-30 accept, grep-verified)

`grep -rn 'REFUSED_STATUS\|"status": "refused"\|status="refused"' backend/app/services backend/app/models`
returns only `backend/app/models/artifact.py:87` (`REFUSED_STATUS = "refused"`), `:154` (the
refusal dict) and `:696` (`is_refusal_result`). The wider `app/` hits are an API route body
(`api/runs.py:1086`), a connector failure bucket and a source poke outcome. None of them is a
tool result. The search tool's own refusal is `{"error": "refused_retry"}`, which the rail
pins as `done`.

## Verification

- Plan verify (Task 1): the four new suites plus `src/components/chat/artifacts` → `11 passed · 117 passed`.
- Plan verify (Task 2): `tool-bodies`, `ToolCallPanel.showArtifact`, `workflows/toolNames`, `MessageItem.artifacts` → all green (inside the sweeps above).
- Acceptance greps: `ARGS_HIDDEN.livePanel` in ToolCallPanel = 1; `ARGS_HIDDEN.paramsBlock` in ToolCallDetails = 1; `detail` in ShowArtifactBody.tsx = **none** (the word appears nowhere in the file); `"show_artifact"` in toolStepDerivation.ts = none; `toolNames.test.ts` has the `openai_service.py?raw` import and still asserts `toHaveLength(28)`; `<ArtifactBlock` in MessageItem = 1; `ArtifactRecord as ArtifactRecordWire` in types = 1.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/273-agent-authored-artifacts` → `ledger gate OK`.
- `eslint` on the touched files: no finding introduced by this plan's logic. The one new finding is
  `react-refresh/only-export-components` on `ShowArtifactBody.tsx`'s named `summarize`. That is the
  shape the plan mandates and the one every `tool-bodies/*Body.tsx` already has. The other ten
  findings in those files (`StepRow` helper exports, `ToolCallPanel` conditional hooks, `any`s in
  `threads.ts` / `types` / `ToolCallDetails`) are pre-existing lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - contradiction in the plan] The rail label and the activity string cannot be one string**
- **Found during:** Task 2, step (6).
- **Issue:** The plan requires `toolLabel("show_artifact") === "Showing an artifact"`. It also
  requires the rail to read `Preparing Show an artifact…` and `Show an artifact → …`, and the
  UI-SPEC rail table names both strings. Every rail line (`StepRow` ×3, `ToolCallPanel` ×4) renders
  `toolLabel`, so adding the arm alone would have shown `Preparing Showing an artifact…` and
  `Showing an artifact → Bar chart · 12 rows`.
- **Fix:** `lib/toolMeta.ts` gains `stepLabel(name)`. It returns the phrase for `show_artifact` and
  `toolLabel(name)` for every other tool, byte-for-byte. The seven rail call sites read `stepLabel`.
  The activity readers (`MessageItem.tsx:414`, `RunCard.tsx:228`) keep `toolLabel`.
- **Files:** `lib/toolMeta.ts`, `StepRow.tsx`, `ToolCallPanel.tsx`. **Commit:** `0cbb7ac19`.

**2. [Rule 1 - Bug] `StepPanelPort.test.tsx` treated the phrase table as the offered set**
- **Found during:** Task 2, step (7), count-gate run 1 (2 real failures, quoted above).
- **Fix:** It subtracts `CHAT_ONLY_TOOLS`, parsed through `?raw` and never hand-typed. This is the
  same OQ3 resolution as `toolNames.test.ts`. The file is outside `files_modified`; its edit is
  test-only and is a direct consequence of the planned `TOOL_PHRASES` entry. **Commit:** `0cbb7ac19`.

**3. [Rule 3 - ordering] The `toolNames.ts` entry landed with arm (2), not arm (6)**
- ShowArtifactBody's neutral essence reads `toolName("show_artifact")` (the one home of the
  phrase), so arm (2)'s targeted run needed the entry. `toolMeta.ts` still landed in arm (6).

**4. [Rule 1] Alphabetical position**
- The plan said to put `show_artifact` "between `save_skill` and `search_documents`". Alphabetically
  it sorts after `search_documents`, and the table's docblock pins alphabetical order, so it sits there.

**5. Rail essence for a single-value filter**
- The UI-SPEC/plan string is `chart 1 rows filtered to Q3 (4 rows)`, but artifactCopy's
  `operationPhrase` gives `filtered to quarter = Q3`. For `filter_eq` the rail therefore names only
  the value (`filtered to Q3`, through `cellPhrase`). Every other op reuses `operationPhrase`,
  ordered by `OPERATION_ORDER`. The ops are rebuilt field by field from the untrusted result before
  either phrase function sees them.

**6. The `rows` leak-token in the body assertion**
- The plan asks that the body's text never contain `rows`. The mandated done body
  (`… · 12 rows · chart 1.`) contains that English word. Following 273-02's precedent, the fence
  bans the KEY forms (`"rows"`, `rows:`) plus `{"`, `detail`, `type=` and sampled values.

**7. The parity fence was green on its first run**
- `artifactParity.fence.test.ts` passed on its first run. It is a fence over code 273-01/02 had
  already aligned, so it could not RED for the right reason without a plant. The other three Task 1
  suites did RED (11 failures: no `onArtifact`, unmapped `artifacts`, no mount).

## TDD Gate Compliance

- Task 1: RED `1cc8957c4` (11 failed / 12 passed) → GREEN `3fa48d2d0`.
- Task 2: RED `d8999c070` (ShowArtifactBody suite failed to import; 15 rail and toolNames cases red) → GREEN `0cbb7ac19`.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, storage or schema. Each mitigation in T-273-26..29 is pinned by a
test:
- **L-1:** a raw-spec `code_so_far` renders header-only.
- **L-2:** 500-row args produce no parameters block.
- **L-3/L-4:** a refusal, even one carrying an `error` key, never reaches GenericBody or the italic arm.
- **The model-facing text never renders.**
- **I-1:** the parity fence.

## Notes for the orchestrator

- `graphify update .` was NOT run in this worktree, so the tracked `graphify-out/` files stay
  untouched. Run it after the wave merges.
- No background test process of this plan is left running. All of them completed: one first gate
  attempt was killed by a 590 s foreground `timeout` (a harness error, `exit 143`, no report), and
  the three background gate runs exited with codes 1, 1 and 0.
- STATE.md and ROADMAP.md were not touched (orchestrator-owned).

## Self-Check: PASSED

- All 7 created files exist on disk; all 14 modified files are in the four commits.
- All four commits exist: `1cc8957c4`, `3fa48d2d0`, `d8999c070`, `0cbb7ac19`.
