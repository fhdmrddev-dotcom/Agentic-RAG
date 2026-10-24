---
phase: 292-more-ways-to-show-it
plan: 03
subsystem: agent-artifacts (cross-stack proof, live board, UAT)
tags: [show_artifact, diagram, comparison, timeline, sc10-board, g-4, uat, VIS-02]
requires:
  - "292-01 backend six-component registry (models, handler, migration 213 applied locally)"
  - "292-02 frontend six-component registry (guard arms, renderers)"
  - "scripts/run-273-board.py helpers (derive_roster, _drive_turn, _reload, ...)"
provides:
  - "artifactParity292.fence.test.ts: one vocabulary, one cap set and one shared fixture set across both stacks"
  - "scripts/run-292-board.py: roster, seed, 8-row board, long, parallel, G-4 drives with computed observables, reload check, refusal probe, crafted bad row"
  - "frontend/uat/292-board-render.test.ts: the guard half of V2 over board evidence"
  - "292-VALIDATION.md and 292-UAT-LOG.md with every browser row marked owed"
  - "Ledger close for the 21 phase source files; SEED-337 partially-answered"
affects:
  - "Orchestrator: owes the Chrome drive of G4-1..G4-5 and the parallel-thread axis"
  - "Deploy: migration 213 to cloud before this backend; get_advisors(security) at that deploy"
tech-stack:
  added: []
  patterns:
    - "Cross-stack fence reads both stacks' source with ?raw and lifts shared fixtures by the rule the fixture itself states"
    - "G-4 expectations computed from the stored spec by a separate implementation, so the browser drive compares against numbers the frontend did not produce"
key-files:
  created:
    - frontend/src/components/chat/__tests__/artifactParity292.fence.test.ts
    - scripts/run-292-board.py
    - frontend/uat/292-board-render.test.ts
    - .planning/phases/292-more-ways-to-show-it/292-VALIDATION.md
    - .planning/phases/292-more-ways-to-show-it/292-UAT-LOG.md
    - .planning/phases/292-more-ways-to-show-it/evidence/ (fixtures, board, g4, parallel, crafted, probes, roster, seed)
  modified:
    - scripts/vitest-count-gate.cjs
    - frontend/src/components/chat/tool-bodies/ShowArtifactBody.test.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-337-artifact-vocabulary-v2-more-closed-components-then-sandboxed-html.md
decisions:
  - "G4-2 is driven on a 'Show it side by side.' variant, because the verbatim D-22 prompt produced a markdown table (no show_artifact) on 3/3 runs across anthropic and openai; the product question is recorded as F-1, not fixed here"
  - "Count gate recorded VIOLATED, not OK: the one failure is an unmodified WorkflowBuilderPage.canvas case that timed out under board load and is 158/158 green in isolation at HEAD and at base"
  - "API-level halves of the parallel-thread axis and of G4-5 were measured here; the browser halves stay owed to the orchestrator's Chrome drive"
metrics:
  duration: "~52 min"
  completed: 2026-10-24
  tasks: 4
  files: 45
---

# Phase 292 Plan 03: Merged-tree proof, live board and G-4 preparation Summary

On the merged tree, both stacks provably share one six-name vocabulary, one cap set and one fixture
set. On the live stack, all 8 required providers drew a diagram, a comparison and a timeline in one
turn, and every record reloaded identically and passed the frontend guard. A foreign type is refused
in words, and a broken stored row is refused by the guard. Every browser observation is written up,
with its thread id, artifact id and the expected numbers, for the orchestrator's Chrome drive.

## What was built and measured

| Task | Result | Commit |
|---|---|---|
| 1. Cross-stack fence + merged-tree gates | `artifactParity292.fence.test.ts` (13 cases) adopted in both count-gate knobs. It was RED-driven: a planted `VERDICTS` without `q` plus `MAX_TERMS = 21` turned 3 cases red, and the file was then restored to its HEAD blob. The rail `?raw` key list was widened to `edge_count` / `option_count`. | `0abb48ac8`, `825e0df34` |
| 2. Board script, fixtures, roster, ledger, seed | `run-292-board.py`, three generated fixtures (Borealis has no "renew"), the uat runner, and the roster quoted. 21 scan rows refreshed with `(was …)` plus Phase 292 close sections; 3 CLAUDE.md FIRING rows. SEED-337 set to `partially-answered`. | `0abed4aaf`, `4a2c9239a` |
| 3. Operator starts the merged backend/frontend | **Pre-satisfied by the orchestrator.** Worker PID 88204 started 05:06:51, after the 05:05:50 merge, and `/health` returned 200 when re-probed. Migration 213 verify: 8/8. Vite is on :5173. | n/a |
| 4. Board, probes, axes, G-4 prep, VALIDATION | 8/8 rows passed V1 and V2 (backend half) for all three types, and the uat runner passed 11/11. The refusal probe and the crafted row behaved as expected. The parallel and long axes passed at API level. G-4 threads were created on anthropic and openai. API reload was byte-identical. | `fa63aecac` |

### Gate lines (verbatim, details in 292-UAT-LOG.md)

- **Parity fences:** `Test Files 2 passed (2) · Tests 23 passed (23)`. The 273 fence is unedited.
- **Backend:** `70 failed, 9170 passed, 1 skipped, 2 xfailed, 2 xpassed`, `[GATE PASSED]`. The failed set is identical to the base set (70 ids).
- **Vitest count gate:** `total 11870 · failed 1 · pinned total 10845` / `RESULT: COUNT GATE VIOLATED (1 reason(s))`.
  - The one failure is `WorkflowBuilderPage.canvas.test.tsx` (STACK_TRACE_ERROR, 6.3 s). Its source is provably unmodified by phase 292, and it passes 158/158 alone, both at HEAD and at base `ba8e38c05` (checked in a throwaway worktree).
  - It is a timeout under the concurrent board load. The verdict is still recorded as VIOLATED.
- **tsc** (`-p tsconfig.app.json`): 63 errors at base and 63 at HEAD, and the two error sets are identical.
- **30-tool pins:** `63 passed`. The only diff is 292-01's enum edit.
- **Ledger, CLAUDE.md size and seeds gates:** all OK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The seed step could not finish.**
- **Found during:** Task 4, `--seed`.
- **Issue:** The Atlas fixture failed ingestion with `[Errno 11001] getaddrinfo failed`, a transient DNS failure on the embedding call. Then the search step crashed on a second `asyncio.run`, because the pg pool singleton stays bound to the first event loop.
- **Fix:** A failed fixture is now re-queued with `POST /documents/{id}/reingest`, and the three searches run in one event loop. The second run printed `SEED verdict: OK`.
- **Files:** `scripts/run-292-board.py`. **Commit:** `fa63aecac`.

**2. [Rule 2 - Missing critical functionality] Browser-ready G-4 threads with computed expectations (`--g4`, `--g4-recompute`, `--scenario`), plus `--parallel` and `--reload-check`.**
- **Issue:** This executor had no Chrome tools. The orchestrator still needs real threads and numbers it can compare the page against.
- **Fix:** Each G-4 thread's stored spec now yields, from a separate implementation, the expected values the browser should show:
  - for diagrams: the degree per node, the DFS back edges and the caption count;
  - for comparisons: the identical-term N and the `q` count;
  - for timelines: the full rail with Today, the gaps and the `in N days` counts;
  - for sources: a check that each excerpt is a substring of the KB document.
- **Files:** `scripts/run-292-board.py`. **Commit:** `fa63aecac`.

**3. [Rule 1 - Bug, in my own measurement] Wrong source of retrieved text.**
- **Issue:** The first version of `_retrieved_text` read only `search_documents` results, so it reported false excerpt mismatches whenever a turn retrieved with another tool.
- **Fix:** It now reads every retrieval tool's result, and also compares against the KB document text.

### Other deviations

- **G4-2 prompt variant (finding F-1).** The verbatim D-22 prompt produced no comparison on 3 runs:
  - 2 runs on anthropic (`c4c6bd2d-…`, `b589517c-…`);
  - 1 run on openai (`49bbac20-…`).

  In each case the model answered with a markdown table. Adding *"Show it side by side."* produced a comparison on both providers, and those G4-2b threads are what the browser drive uses. The product question (should a plain "compare" trigger the matrix?) is recorded as OWED and left unfixed: changing the tool description would move the schema digest pins and the steering behaviour, and that is a decision, not a gap.
- **Carry-over edit outside `files_modified`.** The orchestrator asked for an edit to `ShowArtifactBody.test.tsx`: its key list was widened, and its case count is unchanged (26).
- **Commit order.** The Task 1 "gate lines" commit (`825e0df34`) lands after the Task 2 commits, because it had to wait for the full vitest gate run to finish.
- **The tsc base set was measured, not assumed.** I measured it in a throwaway worktree, which was bootstrapped and then torn down with the teardown script. The source venv and node_modules were checked as intact afterwards.

## Findings for the orchestrator

- **O-1.** The 48-character step-name cap was the most common first-try refusal (7 of 8 rows). Every one recovered on retry in the same turn.
- **O-2.** Whether sources carry an excerpt depends on the retrieval tool:
  - `search_documents` turns carry excerpts;
  - `query_documents` / `analyze_document` turns resolve each source to its document with `excerpt: null` (MiniMax, and both G4-2b threads);
  - Google and Moonshot sent no source numbers at all.
- **O-3.** Borealis has no renewal clause. Only 3 of 8 rows wrote a `q` (Not stated) cell; the rest wrote an `n` or `m` verdict with explanatory text.
- **Roster:** `kimi-k3` derives with `emit_tier=None`, not `coerce`.

## Known Stubs

None. The script, the fence and the runner read real data. The evidence fixtures are generated test documents by design (T-292-23).

## Threat Flags

None. No endpoint, auth path or schema changed. The crafted row and the seeded documents were written to the LOCAL database only:
- the DSN was asserted to be local before any write;
- the crafted row was written under the local-DB lock;
- a scan for `Bearer`, JWT prefixes and `sk-` keys found nothing in the evidence.

## Self-Check: PASSED

- Created files exist: the fence, `run-292-board.py`, `292-board-render.test.ts`, `292-VALIDATION.md`, `292-UAT-LOG.md`, the three fixtures, and 9 board JSON files plus the g4 / parallel / crafted / probes evidence.
- Commits exist on `develop`: `0abb48ac8`, `0abed4aaf`, `4a2c9239a`, `825e0df34`, `fa63aecac`.
- Acceptance greps all return the expected counts:
  - `artifactParity292.fence.test.ts` in `scripts/vitest-count-gate.cjs`: 2
  - `status: partially-answered` in SEED-337: 1
  - `127.0.0.1|localhost` in the script: 6
  - `renew` in Borealis: 0
  - `G4-5` in VALIDATION: ≥ 1
  - `213` in the UAT-LOG: 6
- No STATE.md or ROADMAP.md edit. No unrelated file was staged; the operator's `.mcp.json`, `settings.local.json`, seam286 snapshots and `graphify-out` changes were left as they were.
