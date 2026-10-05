# Phase 274 — UAT log (plan 274-05)

## Step (0) — location assertion, verbatim

```
$ git rev-parse --show-toplevel
C:/Vibe Apps/Agentic RAG
$ git branch --show-current
develop
$ git rev-parse HEAD            # at plan start, before any 274-05 write
250cea6bc0a03d6fdfb2c5cca5add9955ed9fa13
$ git merge-base --is-ancestor 327c7aae2 HEAD; echo "is-ancestor exit=$?"
is-ancestor exit=0
$ git log --oneline -12         # at plan start
250cea6bc docs(276): video queue — ep5 downloaded + poster; all five NotebookLM episodes done
4a642db19 docs(276): video queue — ep5 queued cleanly at 07:31 UTC; failed leftovers deleted
9a02c9012 docs(276): video queue — ep4 downloaded + poster; ep5 waits for rolling window (67.6%)
7b66f608d docs(phase-274): update tracking after wave 2
327c7aae2 chore: merge executor worktree (274-04)
daa195ef7 docs(274-04): complete the Save-to-Library mounts plan
050c431f3 chore: merge executor worktree (274-02)
7b00aad77 docs(274-02): complete the promote / preview / library-links plan
7d9bfd049 feat(274-04): the panel Files row offers Save to Library and shows the full path once saved
fefb24065 test(274-04): failing tests for the panel row's trailing slot and its keyboard reach
b954e78db feat(274-04): the sent chip offers Save to Library and shows where the copy lives; no 24h on chat files
2e3d3cb6e test(274-04): failing chip cases for thread-life, the ⋯ and the after-mark; the D-18 composer fence
```

Main working tree, not a worktree. The wave-2 merge `327c7aae2` (274-04) is an ancestor of HEAD; `274-01..04-SUMMARY.md`
are all present. Other sessions share this tree (276 video work); every 274-05 commit is by explicit path. Pre-existing dirty
files (`.claude/settings.local.json`, `.mcp.json`, `.planning/config.json`, `graphify-out/GRAPH_REPORT.md`, untracked
`.planning/ui-reviews/`, `scratch/`, `screenshots/`) are not this plan's and were never staged.
PHASE_BASE = `75cd73782d8651d7d976d287e40d6c6802a2dc95` (274-BASELINES.md).

## Merged-tree gates (Task 1 step 3) — run by the ORCHESTRATOR on develop with waves 1+2 merged (`327c7aae2`), recorded verbatim

The orchestrator ran the full gates once, before dispatching this plan, and directed that they not be re-run here.

| Gate | Verdict line (verbatim) |
|---|---|
| Vitest count gate, `GSD_VITEST_MAX_WORKERS=2` | `total 9954 · failed 0 · pinned total 9190` / `count gate OK — 423/423 pinned files present, no per-file decrease, 0 failing.` |
| Backend unit baseline | `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0)` — Passed 6920 |
| `npx tsc -p tsconfig.app.json --noEmit` | 66 errors = the phase base (274-BASELINES-FRONTEND.md), zero new |
| `node scripts/build-public-openapi.cjs --check` | OK |
| `node scripts/check-hot-file-ledger.cjs …/274-thread-scoped-attachments` | OK |
| `node scripts/check-claude-md-size.cjs` | OK — CLAUDE.md 118,373 chars |

⚠ **Backend failed-SET diff — not re-captured here, stated rather than implied.** The orchestrator's reading gives the COUNT
(71 = the ceiling = the base). The SET equality was last proven by 274-02 under the lock (`71 failed, 6920 passed`, failed SET
`comm`-identical to `274-BASELINES.md`); the orchestrator's merged-tree run reads the same 71 / 6920. This plan adds no backend
source (only `scripts/run-274-board.py`, gate-exempt), so it cannot have moved the set.

### Gates re-run by this plan after its own edits

```
$ cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/attachments/__tests__/promoteContract.fence.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)

$ cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/docs
 Test Files  17 passed (17)
      Tests  131 passed (131)

$ node scripts/check-docs-coverage.cjs
111 code keys · 261 inventory IDs · 119 pages (32 written / 87 stubs)
docs coverage OK — every code key and inventory ID has a page (excluded by decision: I20).

$ node scripts/check-hot-file-ledger.cjs .planning/phases/274-thread-scoped-attachments
  scan list: 467 rows · subject: 63 files · watched: 22
ledger gate OK — every watched file has a row.

$ node scripts/check-claude-md-size.cjs
  CLAUDE.md                                  118456 chars     79% of limit  headroom   31544  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

The new contract fence is pinned in `BASELINE` at its measured 6 (the `src/components/attachments` directory was already in
`TARGETS` from 274-03), so the next full gate reads pinned total 9196 / 424 files. That full re-run was not performed here
(orchestrator directive); the pin equals the measured count.

## Registers (Task 1 steps 2, 4, 5)

- **Contract fence** — `e6d145897`. `promoteContract.fence.test.ts` `?raw`-reads `backend/app/models/workspace_promote.py`,
  `backend/app/api/workspace_promote.py`, `lib/api/attachments.ts`, `lib/attachmentLifetime.ts`: (a) all 13 client keys are
  declared pydantic fields; (a') the client declares each; (b) `LibraryLink = Literal["saved", "already"]`; (c) `r"^[0-9a-f]{8}-"`
  in the route module and `/^[0-9a-f]{8}-/` in the client rule, and `WORKSPACE_UPLOAD_PREFIX.source` equals it. Its NEGATIVE
  case renames `next_version` in a copy of the model source and asserts the checker reports exactly `["next_version"]`.
- **Docs** — `89d235849`. `docs/public/use/attachments.md` stub → written (reviewed 2026-10-05); inventory row A7 now reads
  "shipped (thread-scoped attachments + Save to Library shipped in v4.5 Phase 274)". `grep -c "not built"` on the page → 0.
- **Ledger close** — `9d5e6019b`. 23 phase-touched non-test source files re-derived with the CLAUDE.md recipe; scan-list rows
  refreshed in place with `(was …)` kept; `## Phase 274 close — re-derivation` section; the eight FIRING CLAUDE.md rows refreshed
  in the same commit. **Finding:** `frontend/src/components/attachments/folderDisplay.ts` had no row at all — created by 274-04's
  pre-task and named in no plan's `files_modified`, so the planning-time gate could not see it. Row added at its first phase.

## Live stack (Task 2) — probed, not started (operator preference; operator confirmed "stack up")

```
127.0.0.1:54322 OPEN
127.0.0.1:6379 OPEN
127.0.0.1:54321 OPEN
127.0.0.1:8000 OPEN
health 200
library-links unauth 403          # GET /threads/<zero-uuid>/workspace/library-links — 403, not 404: the 274 routes are served
vite localhost:5173 200
```

Migration 203 present locally (`information_schema.columns`, `public.workspace_files`):

```
[{'column_name': 'expires_at', 'data_type': 'timestamp with time zone'}, {'column_name': 'kind', 'data_type': 'text'},
 {'column_name': 'library_document_id', 'data_type': 'uuid'}, {'column_name': 'library_link', 'data_type': 'text'}]
```

Dev user `d8a54002-6a29-4b88-b918-cff2aa4a06d5` (fhdmrd@gmail.com) is in exactly ONE org today:
`22f9c615-0eec-440a-8804-ed4784d6f57f` ("fhdmrd@gmail.com's Organization", org-admin) — `_single_org` passes; every call
sends `X-Org-Id`.

## Roster — `scripts/run-274-board.py --roster`, verbatim (derived by run-273-board.py's `derive_roster`, imported)

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
```

8 required rows (7 native + OpenRouter) + 1 extra (lmstudio, self-hosted — ⛔ by the board's rule, not one of the required 8).
Full output: `evidence/board/roster.txt`.

## Task 3 — the board (`--run`), 2026-10-05 ~14:27-14:41 UTC, exit 0

Ordinary app traffic through the running backend (no local-DB lock needed — no bulk writes, no backend gate).

```
BOARD documents(user) before = 185 · connector_watches(user) before = 3
BOARD anthropic claude-opus-5-5 D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['workspace_read', 'execute_code'] B=completed threads=88923833-74ff-4833-94cc-d4113727a823,3c6a0ca2-5207-44c4-89dd-281a5e38e431
BOARD deepseek deepseek-v4-pro D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['workspace_read', 'execute_code'] B=completed threads=1343ef32-3288-470e-8a10-0827c390793a,cee7ea14-5a62-445e-9cc9-39c60e865d6c
BOARD google gemini-3.8-flash D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['workspace_list', 'workspace_read'] B=completed threads=ab60c716-6c23-40d8-8cf0-cb068c009b31,bc475a55-5188-4692-935a-156aa34c5350
BOARD lmstudio ⛔ extra (self-hosted) group — not one of the required 8; not driven unless named in --providers
BOARD minimax MiniMax-M3 D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['execute_code'] B=completed threads=4439fca2-500a-4f8a-808d-132c06d4f8a3,fc20197f-9255-488a-a934-d9c77f8c2a87
BOARD moonshot kimi-k3 D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['workspace_read', 'workspace_list', 'workspace_list', 'workspace_read'] B=completed threads=edd20fa4-53db-4c59-9756-bc07e7d50a50,60a1d669-a1cb-4821-bf5c-0d2ffba468cc
BOARD openai gpt-5.6-luna D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['execute_code'] B=completed threads=0e5324e2-2943-443c-80a2-75d477b50ed8,6cb89123-8a66-4ff9-8c12-9bba0be19cb8
BOARD openrouter z-ai/glm-5.3-flash D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['workspace_read', 'execute_code', 'execute_code'] B=completed threads=5f8c6fff-6e34-45df-9a24-91a29352e588,d650e5a5-1845-4780-9306-b00f960a98f8
BOARD zhipu glm-5.3-flash D05=PASS ANSWER=PASS SECOND=PASS SEARCH=PASS(total=0) DB=PASS A=completed tools=['workspace_read', 'execute_code'] B=completed threads=57dc0f47-3ab2-4eba-b96a-ffd02c231ada,adad837c-36e2-4438-8c64-ef8ae95bb261
BOARD documents(user) after = 185 (delta 0) · connector_watches(user) after = 3 (delta 0)
```

**8/8 required rows PASS; 0 FAIL, so nothing needed investigating; 0 ⛔ among the required 8.** The table is in
274-VALIDATION.md §1. No row was re-run. Per-row JSON: `evidence/board/`.

## Task 3 — the G-4 API probe (`--promote-probe`), exit 0

Verbatim lines in `evidence/g4-api/promote-probe.log`; summarised in 274-VALIDATION.md §2. Headline readings:
attach → `documents(user)` 185 → 185, search total 0; promote X → 201 `saved`, `documents.folder_id = X`; version 2 on a
same-named different-bytes file with version 1 kept (`is_latest=false`); the original bytes from a second thread → 200 `already`
naming X, nothing in Y; `storage.objects` 1 → 0 on each thread delete (T1, T2); the Library copy downloads byte-identical
(335,731 bytes, sha256 equal). Post-probe check: both promoted versions `completed` (v1 has 350 chunks — it is a Library
document now, which is correct); both probe threads gone.

## Task 3 — the 4-axis API rows (`--axes --providers anthropic`), exit 0

Multi-tool PASS (`execute_code` + `search_documents` in one run, token + Library summary in the answer); parallel-thread PASS
(runs overlap by 25 s, A was `streaming` when B attached, each answer in its own thread); long-message PASS (6,692-byte prompt).
`evidence/axes/`.

## D-18 audit — static and API halves (274-VALIDATION.md §4)

Static: the pinned six-module minter set (`test_274_minter_inventory.py`) + `api/workspace.py` minter-free → 13 passed with the
244 cloud-attach suite; the composer fence (`composerNoLibraryDoor.test.ts`) 4/4; `ConnectorsFlyout`'s three buttons all route
through `onOpenConnections` → `onNavigate("connections")` (a view switch; its only API import is `listConnectorConnections`).
API: `documents(user)` and `connector_watches(user)` unchanged across the board and the probe; the only path from a chat file
into the Library was the explicit promote. **Verdict: no composer or attach path writes a Library row (static + API PASS).**
The live network-log half and the flyout click are PENDING-ORCHESTRATOR.

## Observations (not criteria)

1. **The agent names attachments with their upload prefix.** 7 of 11 measured answers (4 of 8 board rows + all 3 axes answers, the parallel one from its first 300 chars) wrote the file name as
   `<8 hex>-<name>` (e.g. `55ab08ff-meridian-clearance-anthropic.md`). The agent note derives the name from the container path;
   D-27's strip covers the chip, the dialog and the Library name only. Candidate for G-4 #2's judgement; not a 274 criterion.
2. **The second-thread negative went looking.** 8/8 B threads called `search_documents` (plus `grep` / `query_documents` /
   `read_document` on most) and found nothing — D-01 confirmed from the retrieval side.
3. **The panel Files row still shows the stored path** (`/648ef8d7-274-g4-api-keeper.pdf`) — 274-04's stated limit; G-4 #3
   judges it in Chrome.
4. **Dev data written by this plan (local only):** 16 board threads + 7 axes threads (each with one thread-life attachment),
   and two Library documents in `Client ACME / Q3 Contracts` — `274-g4-api-keeper.pdf` v1 `3cd6dddd…` and v2 `74783d70…`.
   The two probe threads were deleted by the probe.

## OWED

1. **Chrome halves of G-4 #1-#4 and the D-18 live half** — the orchestrator (click-paths in 274-05-SUMMARY.md).
2. **Operator sign-off** (Task 4) on the board and the G-4 rows.
3. **`BUG-260905-01` / `SEED-247` routing** (Task 3 step 8) — depends on G-4 #1, #3 and the D-18 live half; not done here.
4. **Production: migration 202, then 203, before the backend deploy** (operator-gated; the Supabase MCP is read-only for this plan).
5. **Post-apply production `get_advisors(security)`** — the Supabase MCP tools were not available to this executor.
6. **Pre-274 orphaned bucket bytes** — attachments of threads deleted before Phase 274 stay in `workspace-files` (observation,
   out of scope; 274-01 OWED #4).
7. **A full vitest count-gate re-run** to read the new pin (expected pinned total 9196 / 424 files) — not run here by directive.
8. **The board's ⛔ row:** lmstudio (extra, self-hosted) — not one of the required 8.
