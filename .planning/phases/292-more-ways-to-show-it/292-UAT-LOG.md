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

## Environment (Task 3, pre-satisfied by the orchestrator; re-probed here)

- Merge commits: `7904e0345` (292-01) at 2026-10-24 05:05:50 +0400, `e2c1e8b2e` (292-02); HEAD `develop`.
- uvicorn runs with `--reload`: reloader PID 70864 (started 2026-10-23 13:18:46); its serving worker
  PID 88204 started **2026-10-24 05:06:51**, after the merge, so it serves the merged code. Re-probed
  by this executor before the live board: `curl http://localhost:8000/health` returned `200`, and the
  same process tree was listening on :8000. No backend application file changed after the merge (this
  plan touched tests, scripts and docs only), so the reloader had nothing to reload.
- `scripts/apply_migration_213.py --verify-only` returned `VERIFY: 8/8 PASS`; the live CHECKs list all
  six components and the six-name label regex (orchestrator's run).
- Vite dev server listening on :5173 (orchestrator).

## Board method

`scripts/run-292-board.py` loads `scripts/run-273-board.py` with importlib and reuses its
`derive_roster`, `_assert_local_db`, `_headers`, `_single_org`, `_user_id`, `_wait_run`, `_send`,
`_drive_turn` and `_reload`. Every mode runs `conc_probe.assert_localhost_only` and asserts a
127.0.0.1 / localhost DSN and Redis before any request or DB write. Turns use a per-request
`model` + `provider` on `POST /threads/{id}/messages`; no `app_settings` / `user_settings` write.
The dev user `d8a54002-…` is in exactly ONE org (`22f9c615-…`, asserted from `org_members`) before
`X-Org-Id` is sent. Verdicts are read from `message_artifacts`, `messages.tool_calls` and `runs`.

Order of runs: `--seed`, `--run` (all rows), `--g4 --providers anthropic`, `--g4 --providers openai`,
two extra G-4 comparison runs (F-1), `--long --providers openai`, `--parallel --providers deepseek`,
`--reload-check --out board` and `--out g4`, `--g4-recompute` (offline), then the uat runner.

### Seed

First `--seed` run: the invoice policy and Borealis ingested; the Atlas MSA **failed ingestion with
`[Errno 11001] getaddrinfo failed`** (a transient DNS failure on the embedding call), and the search
step then crashed on a second `asyncio.run` (the pg pool singleton is bound to its first loop). Both
fixed in the script (Rule 1/3): a failed fixture is re-queued through `POST /documents/{id}/reingest`,
and the three searches run in one event loop. Second run (verbatim, `evidence/seed.txt`):

```
SEED reingest 292-atlas-msa.md HTTP 200
SEED 292-atlas-msa.md status=completed chunks=3
SEED search_documents('invoice approval three-way match budget holder finance controller') -> 5 chunks · top files ['292-invoice-approval-policy.md', ...] · finds 292-invoice-approval-policy.md: True
SEED search_documents('Atlas Logistics termination liability renewal notice deadline') -> 5 chunks · top files ['292-atlas-msa.md', ...] · finds 292-atlas-msa.md: True
SEED search_documents('Borealis Freight termination liability cap') -> 5 chunks · top files ['292-borealis-msa.md', ...] · finds 292-borealis-msa.md: True
SEED verdict: OK
```

### Board table (printed by `--run`, verbatim)

```
| anthropic | claude-opus-5-5 | NATIVE (native SDK adapter) | PASS/PASS | PASS/PASS | PASS/PASS | 12/12,10/10,8/8 | 3 | 1: diagram: a step name is over 48 characters |
| deepseek | deepseek-v4-pro | NATIVE | PASS/PASS | PASS/PASS | PASS/PASS | 11/11,8/8,8/8 | 3 | 0:  |
| google | gemini-3.8-flash | NATIVE (native SDK adapter) | PASS/PASS | PASS/PASS | PASS/PASS | 0/10,0/10,0/8 | 0 | 0:  |
| lmstudio | qwen-agentworld-35b-a3b | NATIVE | ⛔ | ⛔ | ⛔ | — | — | extra (self-hosted) group — not one of the required 8; not driven unless named in --providers |
| minimax | MiniMax-M3 | NATIVE | PASS/PASS | PASS/PASS | PASS/PASS | 12/12,24/24,9/9 | 0 | 2: diagram: its settings weren't valid; diagram: a step name is over 48 characters |
| moonshot | kimi-k3 | NATIVE | PASS/PASS | PASS/PASS | PASS/PASS | 0/11,0/14,0/8 | 3 | 2: diagram: a step name is over 48 characters; comparison: a comparison was sent another artifact type's fields |
| openai | gpt-5.6-luna | NATIVE | PASS/PASS | PASS/PASS | PASS/PASS | 11/11,10/10,8/8 | 4 | 3: diagram: a step name is over 48 characters; diagram: a link label is over 24 characters; diagram: two links join the same two steps |
| openrouter | z-ai/glm-5.3-flash | NATIVE | PASS/PASS | PASS/PASS | PASS/PASS | 12/12,6/12,8/8 | 4 | 3: diagram: a step name is over 48 characters; comparison: its settings weren't valid; diagram: a link label is over 24 characters |
| zhipu | glm-5.3-flash | NATIVE | PASS/PASS | PASS/PASS | PASS/PASS | 11/11,12/12,8/8 | 4 | 2: diagram: a step name is over 48 characters; diagram: a link label is over 24 characters |
```

The "search calls" column counts `search_documents` only; Google and MiniMax retrieved with other
tools. Every refused call was followed by a successful retry in the same turn; refusal reasons are
quoted verbatim in each evidence file's `score.refusals`.

### Guard half of V2 (uat runner)

`cd frontend && ARTIFACT_BOARD_EVIDENCE_292="../.planning/phases/292-more-ways-to-show-it/evidence/board" GSD_VITEST_MAX_WORKERS=2 npx vitest run uat/292-board-render.test.ts`
(verbatim): `Test Files 1 passed (1) · Tests 11 passed (11)`. That is non-vacuity, 9 evidence files (8 rows
plus the long run), and the crafted row refused with `broken-link`. The same runner over
`evidence/g4`: `Tests 11 passed (11)`. `ls evidence/board/*.json | wc -l` = 9 = 8 non-⛔ rows + 1 long run.

### Probes (verbatim, `evidence/probes/`)

```
PROBE stored table: table 1 in thread 563886b2-d2e1-41ae-bb8c-a96c20658f12
PROBE mindmap: keys=['detail', 'reason', 'status'] keys_exact=True
PROBE mindmap: payload={"status": "refused", "reason": "\"mindmap\" is not an artifact type", "detail": "`component` must be one of chart, table, metric, diagram, comparison, timeline. Use a table for anything else."}
PROBE flowchart: payload={"status": "refused", "reason": "something other than a chart, table, metric, diagram, comparison or timeline", "detail": "`component` must be one of chart, table, metric, diagram, comparison, timeline. Use a table for anything else."}
PROBE diagram from a stored table: payload={"status": "refused", "reason": "a table can't be turned into a diagram; send the data again", "detail": "table 1 is a table; a diagram is never built from another artifact by reference. Call show_artifact again with the full `diagram` data and no from_artifact."}
PROBE emitted events on refusal paths: 0 (must be 0)
PROBE message_artifacts rows before=22 after=22 (no DB write on refusal: True)
```

The probe ran the real handler against the real local pool (the stored-table read is real);
`insert_artifact` was patched to raise, so a refusal path that tried to store would have failed loudly.

Crafted bad row (under the local-DB lock, local DSN only):

```
CRAFT thread=8ef83b95-201c-4219-8e2a-188533fd192c assistant_message=ce0f4811-6087-4ce6-aaf4-9f597b5adf32 artifact=a_rvhc2e8nbd tool_call=call_292crafted7401b003
CRAFT persisted args (redacted): {"component": "diagram", "title": "Invoice approval", "diagram": "<stored in artifact a_rvhc2e8nbd, diagram of 3 steps>"}
CRAFT reload HTTP 200 items=[{"id": "a_rvhc2e8nbd", ... "label": "diagram 1", "component": "diagram", ...
```

The row satisfies migration 213's CHECKs (component, id pattern, label regex, row_count 3, spec size).
The tool call's args went through the real `redact_artifact_args` and its result through the real
`build_encoded_result`, so the thread looks exactly like a live one.

### Parallel-thread (verbatim)

```
PARALLEL A run=9d14c67a-6880-42a3-ba20-0e00bd6e254e  · A status when B was sent: streaming · B run=9a88498e-1e0b-4b66-8089-69480bd887b9
PARALLEL artifact a_71l0vjmekm timeline 1 thread=938bfa44-15de-419c-9543-1c04f05c3d8c run=9a88498e-1e0b-4b66-8089-69480bd887b9
PARALLEL artifact a_bmdx11tz1s diagram 1 thread=838fdecf-eafb-4ac4-96f8-e96202a06a2a run=9d14c67a-6880-42a3-ba20-0e00bd6e254e
PARALLEL artifact a_zjf7qohyo1 comparison 1 thread=838fdecf-eafb-4ac4-96f8-e96202a06a2a run=9d14c67a-6880-42a3-ba20-0e00bd6e254e
PARALLEL artifact a_8lmetdadsx timeline 1 thread=838fdecf-eafb-4ac4-96f8-e96202a06a2a run=9d14c67a-6880-42a3-ba20-0e00bd6e254e
PARALLEL verdict PASS (A completed, B completed)
```

### Long-message (verbatim)

```
LONG prompt = 5195 bytes (long-message axis needs >= 5120)
BOARD openai gpt-5.6-luna run=completed diagram=V1:PASS/V2:PASS/src:['0/9'] comparison=V1:PASS/V2:PASS/src:['0/10'] timeline=V1:PASS/V2:PASS/src:['0/8'] ...
```

### Reload check (API half of G4-5)

Every board file and every G-4 file with an artifact: `identical_to_first_reload_and_db=True`
(`evidence/board-reload-check.json`, `evidence/g4-reload-check.json`). The three F-1 files read
`records=0` by construction (no artifact was shown).

## Deploy-parity note (D-12)

**Cloud must receive migration 213 BEFORE the backend that emits a diagram deploys.** Until then the
cloud `message_artifacts` CHECKs refuse `diagram` / `comparison` / `timeline` rows, and every new-type
`show_artifact` call fails its insert (a worded refusal, not a crash). **Run `get_advisors(security)`
at that deploy**, after 213 is pasted into the cloud SQL editor. 292-01 recorded why the local advisor
run was replaced by the deploy-time one: the Supabase MCP reaches production only, and 213 adds no
table, function, grant or policy. This plan ran no cloud or MCP write.

## OWED

1. Chrome drive of G4-1..G4-5 and the parallel-thread axis, in the order listed in
   `292-VALIDATION.md` §5 (this executor had no Chrome MCP tools).
2. Operator sign-off of the G4 rows.
3. F-1 product decision: should a plain "compare these two contracts…" produce the comparison matrix
   (tool-description steering), or is the markdown table acceptable for that phrasing?
4. At deploy: migration 213 to cloud first, then `get_advisors(security)`.
