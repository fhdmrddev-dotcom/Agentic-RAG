# Phase 292 — UAT log (plan 292-03)

Run on the MAIN working tree, `develop`, after waves 1 and 2 merged (`7904e0345` 292-01 at
2026-10-24 05:05:50 +0400, `e2c1e8b2e` 292-02). Phase base: `ba8e38c05`. Every line marked
"verbatim" is copied from the tool's own output. Rows and verdicts live in `292-VALIDATION.md`.

## Gates (merged tree)

### 1. Both parity fences

`cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/chat/__tests__/artifactParity.fence.test.ts src/components/chat/__tests__/artifactParity292.fence.test.ts`
(verbatim):

```
 Test Files  2 passed (2)
      Tests  23 passed (23)
```

The 273 fence (10 cases) is unedited (`git diff --stat ba8e38c05 -- frontend/src/components/chat/__tests__/artifactParity.fence.test.ts`
is empty). The wave-1 in-worktree red on "ComponentName == ARTIFACT_COMPONENTS" is closed on the
merged tree. The new `artifactParity292.fence.test.ts` has 13 cases.

### RED drive of the new fence (it can fail)

Planted in a scratch copy of `frontend/src/components/chat/artifacts/artifactSpec.ts`: `VERDICTS`
without `"q"`, and `MAX_TERMS = 21`. Run of the new fence (verbatim):

```
     × NodeKind == NODE_KINDS and Verdict == VERDICTS (as sets) 6ms
     × every shared cap is the same number on both sides 1ms
     × every bad case is refused by parseArtifactRecord 1ms
 FAIL  ... > NodeKind == NODE_KINDS and Verdict == VERDICTS (as sets)
AssertionError: expected [ 'm', 'n', 'q', 'y' ] to deeply equal [ 'm', 'n', 'y' ]
 FAIL  ... > every shared cap is the same number on both sides
AssertionError: MAX_TERMS: expected 21 to be 20 // Object.is equality
 FAIL  ... > every bad case is refused by parseArtifactRecord
AssertionError: comparison with 21 terms: expected true to be false // Object.is equality
      Tests  3 failed | 10 passed (13)
```

Restored from the saved copy: `git hash-object` of the file = `4c602af50970975836517fe8aea40790e9ef5c7a`
= `git rev-parse HEAD:frontend/src/components/chat/artifacts/artifactSpec.ts`; `git status` shows it
unmodified. The third red is the useful one: a cap raised on one side alone lets a shared bad case
through.

Lift used for the shared fixture: exactly the `about` field of `artifact_bad_specs_292.json`. 292-01
needed no args flattening (its Gemini probe accepted nested `comparison.terms[].cells[]`), so no
`verdicts`/`texts`/`sources` re-assembly. MIN_NODES / MIN_EDGES are compared as the documented
asymmetry: backend 2 / 1, and a 1-node / 0-edge record parses ok in the frontend guard.

Carry-over from 292-02: the `ShowArtifactBody.test.tsx` `?raw` non-vacuity key list now includes
`edge_count` and `option_count` (both emitted by `show_artifact_tool.py:626/628` on the merged tree).
The new fence also asserts both keys sit in `RESULT_KEY_ORDER`.

### 2. Backend unit gate (under the local-DB lock)

`node scripts/check-backend-unit-baseline.cjs` (verbatim):

```
Summary:        70 failed, 9170 passed, 1 skipped, 2 xfailed, 2 xpassed, 47 warnings in 556.27s (0:09:16)
Failed tests:   70 (allowed ceiling: <= 71)
Errors:         0 (allowed: 0)
[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).
```

Failed SET compared with the base set (`base_failed_clean.txt`, 70 ids, measured at `ba8e38c05`
this session): `diff` = **identical** after stripping one pytest warning that was printed onto the
same line as `test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool`.
No new failure. Lock `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` taken with
noclobber and removed after.

### 3. Vitest count gate (run once, repo root)

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (verbatim):

```
  total 11870  ·  failed 1  ·  pinned total 10845
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 1 test(s) failed — the gate requires 0.
```

Rows for this plan's suites (verbatim): `artifactParity292.fence.test.ts 13 13 0`,
`artifactParity.fence.test.ts 10 10 0`, `ShowArtifactBody.test.tsx 26 26 0`. No per-file decrease
was reported (the only reason is `failing-tests`).

The failing test, read from the gate's own JSON report before anything was re-run
(`vitest-count-gate-91020-1792805025850.json`, copy in the session scratchpad):

```
frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx failed
  WorkflowBuilderPage canvas door — flag ON (D-183-01) clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns
  Error: STACK_TRACE_ERROR   (duration 6329 ms)
```

Attribution:
- `git diff --numstat ba8e38c05 HEAD -- frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx frontend/src/pages/WorkflowBuilderPage.tsx frontend/src/components/workflows`
  is empty. `git status --short` there shows only the operator's two pre-existing `seam286` snapshot
  edits (not this file, not staged by this plan). The suite is **provably unmodified** by phase 292.
- Isolated re-run at HEAD: `Test Files 1 passed (1) · Tests 158 passed (158)`.
- Checked out the base in a throwaway worktree (`.claude/worktrees/base292` at `ba8e38c05`,
  bootstrapped, torn down with `scripts/teardown-worktree.sh`, source venv and node_modules
  asserted intact): `Test Files 1 passed (1) · Tests 158 passed (158)`.
- The gate ran while the live board and the G-4 drives were running against the backend on the same
  machine; a 6.3 s case is a timeout under load. One green sample does not prove the suite is not
  flaky, so the count gate verdict for this plan stays **VIOLATED (1 inherited-flake failure, not
  caused by 292)**, not "OK".

### 4. Frontend typecheck (set diff)

`npx tsc -p tsconfig.app.json --noEmit`: **63 errors at HEAD, 63 at base `ba8e38c05`** (base run in
the same throwaway worktree). The error SETS (file + code + message, positions stripped) are
**identical**. None of the 28 frontend files the phase touched appears in the error list.

### 5. Closed-core pins (30 tools)

`cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_259_closed_core_inventory.py tests/unit/test_261_closed_core_inventory.py tests/unit/test_273_tool_wiring.py tests/unit/test_267_tool_floor_union.py tests/unit/test_085_tool_registration.py -q`
(verbatim): `63 passed, 1 warning in 1.56s`.

`git diff --stat ba8e38c05 HEAD -- <those five files>` (verbatim):
`backend/tests/unit/test_273_tool_wiring.py | 4 +++-` — only 292-01's enum edit at
`test_schema_converts_for_anthropic` (the enum now derived from `ARTIFACT_COMPONENTS`).

### 6. Ledger, CLAUDE.md size and seeds gates

- `node scripts/check-hot-file-ledger.cjs .planning/phases/292-more-ways-to-show-it` (verbatim):
  `scan list: 648 rows · subject: 60 files · watched: 21` · `ledger gate OK — every watched file has a row.`
- `node scripts/check-claude-md-size.cjs` (verbatim): `CLAUDE.md 98041 chars 65.4% of limit headroom 51959 [OK]`
  · `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- `node scripts/check-seeds-register.cjs` (verbatim): `seeds register gate OK — 377/377 parsed, 0 duplicate ids, 377/377 carry all 5 required keys.`
  Unswept figures, not summed: `130 carry no trigger_when at all · 113 carry prose but no structured trigger`.

## Roster (D-26)

`backend/venv/Scripts/python.exe scripts/run-292-board.py --roster` (run-273's `derive_roster`, the
effective registry; full output `evidence/roster.txt`), verbatim:

```
ROSTER overlay rows read by load_all_model_overrides: 50 · direct SQL (removed=false): 50
ROSTER seed ids (MODEL_CAPABILITIES): 61 · union rows: 82
ROSTER eligible (enabled, not deprecated, not removed): 79
ROSTER groups=9 (required 8, extra 1)
ROSTER REQUIRED provider=anthropic  newest=claude-opus-5-5 source=overlay (DB-only row) ... predicted_calling_mode=NATIVE (native SDK adapter) ids_in_group=10 tied_with=['claude-sonnet-5-5', 'claude-opus-5-5']
ROSTER REQUIRED provider=deepseek   newest=deepseek-v4-pro source=seed + overlay ... emit_tier=force predicted_calling_mode=NATIVE ids_in_group=2 tied_with=['deepseek-v4-flash', 'deepseek-v4-pro']
ROSTER REQUIRED provider=google     newest=gemini-3.8-flash source=overlay (DB-only row) ... predicted_calling_mode=NATIVE (native SDK adapter) ids_in_group=10
ROSTER EXTRA    provider=lmstudio   newest=qwen-agentworld-35b-a3b source=overlay (DB-only row) ... predicted_calling_mode=NATIVE ids_in_group=7
ROSTER REQUIRED provider=minimax    newest=MiniMax-M3 source=seed ... emit_tier=force predicted_calling_mode=NATIVE ids_in_group=8
ROSTER REQUIRED provider=moonshot   newest=kimi-k3 source=overlay (DB-only row) ... emit_tier=None predicted_calling_mode=NATIVE ids_in_group=4
ROSTER REQUIRED provider=openai     newest=gpt-5.6-luna source=seed ... emit_tier=force_strict predicted_calling_mode=NATIVE ids_in_group=13 tied_with=['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']
ROSTER REQUIRED provider=openrouter newest=z-ai/glm-5.3-flash source=overlay (DB-only row) ... predicted_calling_mode=NATIVE ids_in_group=15
ROSTER REQUIRED provider=zhipu      newest=glm-5.3-flash source=overlay (DB-only row) ... predicted_calling_mode=NATIVE ids_in_group=10 tied_with=['glm-5.3', 'glm-5.3-flash']
ROSTER rows predicted STRUCTURED: NONE
```

All 8 required rows derived (7 native providers + OpenRouter); one extra self-hosted group
(`lmstudio`), recorded ⛔ as not required. ⚠ `kimi-k3` derives from a DB-only overlay row with
`emit_tier=None`, so the "Moonshot is `emit_tier: coerce`" expectation in D-26 does not describe the
row this board actually drove.
