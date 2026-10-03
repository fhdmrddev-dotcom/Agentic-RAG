# Phase 273 — UAT log (plan 273-06)

## Step (0) — location assertion (before any read or write), verbatim

```
$ git rev-parse --show-toplevel
C:/Vibe Apps/Agentic RAG
$ git branch --show-current
develop
$ git merge-base --is-ancestor b48e67273 HEAD; echo "is-ancestor exit=$?"
is-ancestor exit=0
$ git rev-parse --short HEAD
acc48f3be
```

Main working tree, not a worktree (`.claude/worktrees/` is not in the toplevel). Wave-3 merge
`b48e67273` is an ancestor of HEAD. `273-01..05-SUMMARY.md` present. Pre-existing dirty files
(`.mcp.json`, `.planning/config.json`, `graphify-out/GRAPH_REPORT.md`, untracked
`.planning/ui-reviews/`, `scratch/`, `screenshots/`) are not this plan's and were never staged.
PHASE_BASE = `f764734979c25696544b2408232f4fbdc779ae5f` (273-BASELINES.md).

## Merged-tree gates (Task 1 step 1), verbatim — quiet tree, nothing else running

### Backend unit gate (`cd backend && node ../scripts/check-backend-unit-baseline.cjs`)

```
Summary:        71 failed, 6695 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 347.07s (0:05:47)

[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

Failed SET extracted with the 273-BASELINES.md recipe (`grep "^FAILED " | sed -E 's/^FAILED //;
s/ - .*$//; s/C:.*$//' | sort -u`) and compared with `comm` against the frozen 71 (CR stripped):
**new = ∅, fixed = ∅ — the SET is identical.** passed 6474 → 6695 is the phase's own new tests.

### Phase suites (`pytest tests/unit/test_273_*.py -q`, 9 files)

```
218 passed, 1 warning in 3.61s
```

### Count pins — executed, never substring-matched

HEAD = the live modules; BASE = `git show f76473497:<file>` loaded as a scratch module (session
scratchpad) and executed in the same interpreter.

```
HEAD  _TOOL_REGISTRY=30 get_tools(web/sandbox off)=26 get_tools(all on)=29 get_tools(all three off)=24
BASE  _TOOL_REGISTRY=29 get_tools(web/sandbox off)=25 get_tools(all on)=28 get_tools(all three off)=23
HEAD - BASE registry: ['show_artifact'] | BASE - HEAD: []
```

Exactly one counted tool added (D-14), matching 273-03-SUMMARY's table.

### SYSTEM_PROMPT negative fence (`agent_loop.SYSTEM_PROMPT`, HEAD vs PHASE_BASE module)

```
SYSTEM_PROMPT HEAD sha256[:16]=7265842ce8a22a24 len=11844 | BASE sha256[:16]=7265842ce8a22a24 len=11844 | byte-identical=True
```

### Vitest count gate (repo root, `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`)

```
  total                                      8865    9620    +755
  total 9620  ·  failed 0  ·  pinned total 8865
count gate OK — 389/389 pinned files present, no per-file decrease, 0 failing.
```

Green on the first run; the cap was neither adjusted nor needed. The figures equal the 273-05
executor's reading on the same content. `+755` is the unpinned suites the gate prints as `new`
(`PromptVariableChips`, `RunHero`, `automationFacts`, `nodeEffectBanner`, `toolReadOnlyMap`), as at
the frontend baseline — none is this phase's.

### TypeScript (`cd frontend && npx tsc -p tsconfig.app.json --noEmit`) — SET diff

```
tsc exit=2 · 70 errors now · 70 at base (273-BASELINES-FRONTEND.md)
new (now − base): ∅
gone (base − now): ∅
```

Compared as `file:line:code` sets, column dropped. No error in any file the phase touched.

### Hot-file ledger gate (`node scripts/check-hot-file-ledger.cjs 273`)

```
hot-file ledger — .planning/phases/273-agent-authored-artifacts
  scan list: 405 rows · subject: 83 files · watched: 35
ledger gate OK — every watched file has a row.
ledger-gate exit=0
```

### Deploy-artifact drift (`bash scripts/check-deploy-drift.sh`)

```
  ok     sandbox tag consistent everywhere: agentic-rag-sandbox:101.1
  WARN   docker compose unavailable/denied here — CI (ubuntu-latest) runs the authoritative parse; using a structural fallback
  ok     structural check: backend mounts setup_data:/data AND top-level volumes declares setup_data
RESULT: PASS — the one-box deploy artifacts are in sync.
exit=0
```

**No new env var is expected and none was added**: `git diff f76473497..HEAD -- backend/app
frontend/src` adds no `os.getenv` / `os.environ` / `import.meta.env` read, and touches none of
`backend/.env.example`, `deploy/`, `docker-compose.prod.yml`, `docs/OPERATOR.md`,
`backend/Dockerfile.sandbox`. Migration 202 seeds no rows (no OPERATOR.md seed-list change).

## Registers (Task 1 steps 2-3)

### Ledger close — commit `e643b6c36`

Every non-test source file in `git diff --name-only f76473497..HEAD` (minus tests / sql / css /
scripts / json): **35 files, 35 scan-list rows refreshed in place** (old triple kept as `(was …)`),
re-derived with the CLAUDE.md recipe, six-digit quick-task buckets subtracted, plus the
`## Phase 273 — close re-derivation` section in `docs/HOT-FILE-LEDGER.md`. Every disposition ≤ 200
chars (asserted by the script before writing). Firing rows now: `threads.py 264/89/2456`,
`agent_loop.py 61/30/3635`, `tool_dispatcher.py 97/42/5057`, `openai_service.py 78/39/2569`,
`StreamsProvider.tsx 106/40/4982`, `MessageItem.tsx 78/36/1030`, `ToolCallPanel.tsx 55/23/409`,
`message.py 22/14/285`, `grounding.py 22/9/1417`, `lib/api/threads.ts 19/11/1967`,
`toolMeta.ts 12/8/367`, `types/index.ts 96/75/1532`. OWED seams recorded: **OV-273-02**
(`tool_dispatcher.py` registry/handler split) and **OV-273-03** (`agent_loop.py` prompt-assembly
seam, SEED-192).

**CLAUDE.md abridged rows left stale BY DECISION — warn band.** Measured before any edit:

```
  CLAUDE.md                                  119524 chars   79.7% of limit  headroom   30476  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

476 chars under the 120,000 warn band; refreshing the twelve firing rows (each gains a `(was …)`)
would cross it. CLAUDE.md is untouched by this plan. The gate reads the ledger's scan list, so G-5
still sees every row. The CLAUDE.md split stays owed (since 271).

### SEED-193 — commit `7f5651543`

`status: folded` → **`partially-answered`** (`partial: true` kept), `status_note` rewritten, and an
"ANSWERED IN PART by Phase 273" section appended: slice 1 (chart-as-spec) + table + metric in a
CLOSED registry; by-reference re-encode of stored rows (trigger (a)); the data-thread branch/compare
half stays DEFERRED.

```
seeds register gate OK — 343/343 parsed, 0 duplicate ids, 343/343 carry all 5 required keys.
```

`node scripts/check-seeds-register.cjs --phase 273` fires **33** seeds (same count as planning):

```
SEED-052 SEED-054 SEED-169 SEED-170 SEED-177 SEED-179 SEED-185 SEED-188 SEED-192 SEED-198 SEED-266
SEED-272 SEED-280 SEED-284 SEED-287 SEED-288 SEED-290 SEED-291 SEED-303 SEED-305 SEED-306 SEED-308
SEED-309 SEED-310 SEED-314 SEED-319 SEED-323 SEED-326 SEED-327 SEED-328 SEED-330 SEED-333 SEED-335
```

All routed **LEAVE** by decision (none is in 273's scope), matched on path only (the phase declares
no surfaces). SEED-306 honoured by construction (migration 202 grants `authenticated` SELECT only);
SEED-192 is the seam recorded as OV-273-03; SEED-326 does not apply (202 seeds no rows); SEED-335 is
WATCHED in Task 3 (does an artifact-led answer with no `[n]` markers show the "Unmarked claims"
footer?). No seed was edited for these — nothing was measured yet.

## Board script + render runner (Task 1 steps 4-5) — commit `d159f1ef8`

`scripts/run-273-board.py` (`--roster | --seed | --run | --observe`) and
`frontend/uat/273-board-render.test.ts`.

### Roster — `--roster` dry run, verbatim

```
ROSTER overlay rows read by load_all_model_overrides: 49 · direct SQL (removed=false): 49
ROSTER seed ids (MODEL_CAPABILITIES): 61 · union rows: 80
ROSTER eligible (enabled, not deprecated, not removed): 77
ROSTER openrouter_tool_strategy (app settings) = <OpenRouterToolStrategy.QUALITY: 'quality'>
ROSTER groups=9 (required 8, extra 1)
ROSTER REQUIRED provider=anthropic  newest=claude-opus-5-5 source=overlay (DB-only row) native_tools=True emit_tier=None predicted_calling_mode=NATIVE (native SDK adapter) ids_in_group=10 tied_with=['claude-sonnet-5-5', 'claude-opus-5-5']
ROSTER REQUIRED provider=deepseek   newest=deepseek-v4-pro source=seed + overlay native_tools=True emit_tier=force predicted_calling_mode=NATIVE ids_in_group=2 tied_with=['deepseek-v4-flash', 'deepseek-v4-pro']
ROSTER REQUIRED provider=google     newest=gemini-3.8-flash source=overlay (DB-only row) native_tools=True emit_tier=None predicted_calling_mode=NATIVE (native SDK adapter) ids_in_group=10
ROSTER EXTRA    provider=lmstudio   newest=qwen-agentworld-35b-a3b source=overlay (DB-only row) native_tools=True emit_tier=None predicted_calling_mode=NATIVE ids_in_group=6
ROSTER REQUIRED provider=minimax    newest=MiniMax-M3 source=seed native_tools=True emit_tier=force predicted_calling_mode=NATIVE ids_in_group=8
ROSTER REQUIRED provider=moonshot   newest=kimi-k3 source=overlay (DB-only row) native_tools=True emit_tier=None predicted_calling_mode=NATIVE ids_in_group=4
ROSTER REQUIRED provider=openai     newest=gpt-5.6-luna source=seed native_tools=True emit_tier=force_strict predicted_calling_mode=NATIVE ids_in_group=12 tied_with=['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']
ROSTER REQUIRED provider=openrouter newest=z-ai/glm-5.3-flash source=overlay (DB-only row) native_tools=True emit_tier=None predicted_calling_mode=NATIVE ids_in_group=15
ROSTER REQUIRED provider=zhipu      newest=glm-5.3-flash source=overlay (DB-only row) native_tools=True emit_tier=None predicted_calling_mode=NATIVE ids_in_group=10 tied_with=['glm-5.3', 'glm-5.3-flash']
ROSTER rows predicted STRUCTURED: NONE
ROSTER ⚠ no derived row is predicted STRUCTURED — the live SC#2 holdback check needs a STRUCTURED row; see 273-UAT-LOG.md (the plan assumed OpenRouter is STRUCTURED).
ROSTER STRUCTURED-routing candidates (keyed, enabled, any group): ['lmstudio:nvidia_nvidia-nemotron-nano-9b-v2']
```

- **8 required rows derived** (7 native + OpenRouter) plus one EXTRA self-hosted group (`lmstudio`),
  which `--run` records ⛔ unless named in `--providers`.
- **The overlay is read, and proven read:** the anthropic row is `claude-opus-5-5`, a DB-only row
  that exists nowhere in `MODEL_CAPABILITIES`; so are google, moonshot, openrouter and zhipu. The
  overlay read (49) equals a direct SQL count (49); a mismatch exits before printing a roster,
  because `load_all_model_overrides` returns an empty cache on a DB blip rather than raising.
- Ties broken by sc10's rule (last-declared), every tied id printed. anthropic ties
  `claude-sonnet-5-5` / `claude-opus-5-5` at `(5, 5)`.
- ⚠ **FINDING — no derived row routes STRUCTURED.** The plan treats OpenRouter as the STRUCTURED
  row (SC#2 / OV-273-04 live holdback check, WARNING 9 observations). Measured: OpenRouter resolves
  **NATIVE** — `resolve_calling_mode` takes the OpenRouter strategy branch and `quality` returns
  NATIVE, and every OpenRouter override row carries `native_tools = true`. The only keyed, enabled
  id that routes STRUCTURED with a per-request model + provider is the self-hosted
  `lmstudio:nvidia_nvidia-nemotron-nano-9b-v2`. The prediction is the router's own function
  evaluated against the effective settings; Task 3's leak probe reads the Redis `delta` stream on
  EVERY row regardless. **Needs an operator ruling before Task 3** (see the checkpoint).

### `frontend/uat/273-board-render.test.ts` — driven against planted data (session scratchpad, never the evidence dir)

Input: the frozen wire fixture `backend/tests/unit/fixtures/artifact_record_v1.json` (a `chart`,
id `a_k3j9x0p2qd`) as `reload_artifacts`; the RED copy edits that record's `component` to
`gauge_widget`.

```
=== GREEN (fixture)
 Test Files  1 passed (1)
      Tests  2 passed (2)
=== RED (planted gauge_widget)
     × fixture-planted.json: every reload_artifacts item parses ok
 FAIL  uat/273-board-render.test.ts > 273 board — every reloaded artifact passes the frontend guard (verdict 2) > fixture-planted.json: every reload_artifacts item parses ok
AssertionError: fixture-planted.json · record a_k3j9x0p2qd · unknown-component: expected [ Array(1) ] to deeply equal []
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
=== empty evidence dir (non-vacuity)
AssertionError: no *.json evidence in …\scratchpad\uat-empty: expected 0 to be greater than 0
      Tests  1 failed (1)
=== env var unset
 Test Files  1 skipped (1)
      Tests  1 skipped (1)
```

Only the planted file fails; its sibling passes. It sits under `frontend/uat/`, outside every
count-gate TARGETS entry, BY DECISION (it reads phase evidence, not source).

## Live stack (Task 2 checkpoint) — state found BEFORE the operator restart

```
GET http://localhost:8000/health  -> 200 {"status":"ok","redis":"ok","maintenance":false}
:8000 listeners: ONE — 0.0.0.0, PID 57592
  57592  "C:\Python312\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
         parent 58028 (the --reload supervisor), both created 2026-10-03 17:35:58 local
:5173 listener: ::1 (IPv6 only), PID 22912 — GET http://localhost:5173/ -> 200
served /openapi.json: MessageResponse.artifacts present = True
GET /settings (dev user, X-Org-Id 22f9c615-…): sandbox_enabled = True, web_search_enabled = True
```

Process tree: 58028 (launcher) → 57592 (the `--reload` supervisor holding :8000, 17:35:58 local) →
**60748, the serving worker, created 20:44:27 local** — 19 s after the last backend merge
`984d013e0` (20:44:08 +0400). So the served backend is a hot reload onto the merged backend code,
and the served schema carries 273-04's field. A hot reload is not a clean start, so the plan's
restart still stands (Task 2). `C:\Python312\python.exe` in the command line is what a venv
launcher's child reports on Windows; the operator should still confirm the restart uses the
backend venv.

## OWED (recorded, never executed here)

- Task 2: operator restart of backend (venv) + frontend on the merged tree; the post-restart
  `message_artifacts` probe.
- Task 3: `--seed`, `--run` (8 rows + extra), `--observe`, Chrome reload per row, G4-1..G4-4,
  parallel-thread axis; the operator ruling on the STRUCTURED row (finding above).
- Task 4: D-18 after-restart comparison; operator sign-off per scenario.
- Production: migration 202 BEFORE the backend that writes `message_artifacts` deploys, then
  `get_advisors(security)`. No production write in this plan.
- OV-273-02 (tool_dispatcher registry/handler split) and OV-273-03 (prompt-assembly seam).
- CLAUDE.md split (warn band; abridged rows stale by decision).
