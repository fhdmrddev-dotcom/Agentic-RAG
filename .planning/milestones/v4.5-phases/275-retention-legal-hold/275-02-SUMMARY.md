---
phase: 275-retention-legal-hold
plan: 02
subsystem: library-delete-paths, agent-tools, library-find
tags: [legal-hold, retention, delete-paths, agent-tools, rls, find, refusal-ux]

requires:
  - phase: 275-01
    provides: "hold_guard.assert_none_held / map_hold_refusal (one 409 shape, PT409 mapping), retention_held_folders, RETRIEVABLE_COLUMN, documents.retrievable, the folder.delete audit type"
provides:
  - "five app delete doors that check the hold first, delete rows before bytes and never swallow a refusal"
  - "folder delete refused WHOLE over every document AND every subtree folder (B-1), plus one folder.delete audit row on the folder's org"
  - "backend/app/services/retention/agent_wall.py: unretrievable() + not_retrievable_result()"
  - "the agent's id doors, filename doors and listing tools exclude archived / source-gone documents; resolve_filter + get_related_documents gain a default-False retrievable_only"
  - "frontend/src/lib/api/refusal.ts: ApiRefusal + refusalOf; HoldRefusalNotice; retentionCopy.ts"
  - "Find: include_archived state + SET_INCLUDE_ARCHIVED + the Include archived toggle chip"
affects: [275-03, 275-04, 275-05]

tech-stack:
  added: []
  patterns:
    - "Guard first, rows second, bytes last: a refused (or raced) delete never costs a file"
    - "A shared core gains a keyword-only default-False flag; only the agent handler passes True (Library callers byte-unchanged)"
    - "A typed client refusal module that imports nothing, so no suite's _core mock can break it at mount"

key-files:
  created:
    - backend/app/services/retention/agent_wall.py
    - backend/tests/unit/test_275_delete_paths.py
    - backend/tests/unit/test_275_agent_wall.py
    - frontend/src/lib/api/refusal.ts
    - frontend/src/components/retention/retentionCopy.ts
    - frontend/src/components/retention/HoldRefusalNotice.tsx
    - frontend/src/components/retention/__tests__/retentionCopy.test.ts
    - frontend/src/components/retention/__tests__/holdRefusals.test.tsx
  modified:
    - backend/app/api/documents.py
    - backend/app/api/folders.py
    - backend/app/api/sources.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/retrieval_documents.py
    - backend/app/api/kb.py
    - backend/app/services/document_view_resolver.py
    - backend/app/services/document_relationship_service.py
    - backend/tests/unit/test_272_pure_move.py
    - backend/tests/unit/test_115_handler_modes.py
    - backend/tests/integration/test_documents.py
    - frontend/src/lib/api/documents.ts
    - frontend/src/lib/api/sources.ts
    - frontend/src/components/ingestion/DocumentList.tsx
    - frontend/src/components/ingestion/FolderNode.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/pages/findState.ts
    - frontend/src/components/library/find/FindQuickAdd.tsx
    - frontend/src/pages/__tests__/findState.test.ts
    - frontend/src/components/library/find/__tests__/FindQuickAdd.test.tsx
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "275-02: the ls / tree / glob filter lives in kb.py's document reads (one home, at the query), not in tool_dispatcher post-filtering; read_path is untouched"
  - "275-02: agent_wall.unretrievable fails CLOSED on a read error and skips non-UUID ids (they cannot name a document)"
  - "275-02: get_related_documents omits a non-retrievable endpoint by reading RETRIEVABLE_COLUMN off the endpoint row it already selects, rather than a second query"
  - "275-02: ApiRefusal extends Error, not ApiError — a class extending ApiError broke two suites whose _core mock lacks ApiError"
  - "275-02: FolderTree keeps the inline confirm open until the delete answers and rethrows only a 409, so FolderNode can render the refusal"
  - "275-02: include_archived is a preference, not a condition — it alone does not start a search, and Clear search keeps it"

patterns-established:
  - "A held delete is a sentence in the door that was used, with one Close — never 'Delete failed. Please try again.'"

# Repaired 2026-10-12 (Phase 277, REG-05): requirements-completed was [] and is replaced with the list copied verbatim from 275-02-PLAN.md frontmatter requirements (D-15)
requirements-completed: [RET-02, RET-04]

duration: 50min
completed: 2026-10-12
---

# Phase 275 Plan 02: Every door honours the hold, with a readable reason — Summary

**The five app delete doors now check the legal hold before touching anything, delete rows before file bytes, and turn a database refusal into the same 409 sentence instead of swallowing it. No agent tool can read or list an archived or source-gone document, while the Library still opens it. The frontend shows the server's hold sentence at every delete door, and Find gains an `Include archived` chip.**

## Performance

- **Duration:** about 50 min
- **Started:** 2026-10-12T05:55Z
- **Completed:** 2026-10-12T06:45Z
- **Tasks:** 3 of 3, each RED then GREEN
- **Files:** 8 created, 21 modified

## Accomplishments

### Task 1: the five delete doors (D-14, D-15, D-32, D-38)

- **`DELETE /documents/{id}`**, both scopes: one `assert_none_held` call per scope, then the row delete inside `map_hold_refusal`, then the storage removal. The removal moved below the row delete, and its swallow became `log.warning`. `delete_document` gained no `ast.If` (an AST fence compares it with PHASE_BASE). `Request` is added to the signature, which does not appear in OpenAPI. The snapshot test stays green without regeneration.
- **`DELETE /folders/{id}`**:
  - The guard runs over every document id and every folder id in the BFS subtree (revision B-1) before any delete or removal.
  - Then documents are deleted, then the folder (both inside `map_hold_refusal`), then the bytes (logged).
  - One `folder.delete` audit row is written with the folder's own `org_id`, read from a new folder select.
- **`DELETE /sources/watches/{id}?purge_documents=true`** and **`POST …/purge`**:
  - The guard runs first.
  - The `except Exception: logger.warning` swallows are gone. A PT409 becomes the 409, and any other error propagates.
  - The watch delete, the watch-item delete and `purged_count` all run only after the document delete succeeded.

### Task 2: the agent's document wall (D-18, D-36, revision B-2)

- **`agent_wall.unretrievable`** runs one batched `select("id, retrievable").in_("id", …)` and refuses only rows whose column is `False`. An unknown id is not refused. A non-UUID id costs no read. A read error fails closed.
- **Id doors.** One call sits beside each existing folder wall: `read_document`, `_fetch_owned_document_bytes` (which serves both `fetch_document_file` and `attach_skill_file`) and `analyze_document`. Each returns `{"error": "Document … is archived or no longer available at its source, so it can't be read here.", "error_kind": "not_retrievable"}`.
- **Filename doors.** `resolve_document_id`, `resolve_document` (behind `query_tables`) and `fetch_full_document` each gain `.eq(RETRIEVABLE_COLUMN, True)`. The two 272 pure-move pins are retired by name with the reason. A new case proves each function was a pure move up to PHASE_BASE and now differs **only** by that filter.
- **Listing tools.** `ls`, `tree` and `glob` are filtered on all seven document reads in `kb.py`; `read_path` (shared with the Library content route) is untouched. `resolve_filter(retrievable_only=…)` applies the filter to both row legs and both count legs, so the reported total counts the filtered set. `get_related_documents(retrievable_only=…)` omits a non-retrievable endpoint. Only `tool_dispatcher.py` passes `True`, on 3 lines: the two `resolve_filter` calls and the one relationship call.
- **D-33:** `git diff --stat b41d51d6b -- backend/app/services/retrieval_service.py backend/app/services/scheduler_service.py` is **empty**.

### Task 3: the frontend (S9, S10)

- **`ApiRefusal` / `refusalOf`.**
  - `deleteDocument`, `deleteFolder` and `purgeWatchFiles` throw it on every non-OK response, carrying status, title and the server sentence.
  - A non-JSON 500 carries the old fallback text.
  - `documents.ts` exports nothing new, so the barrel contract is kept.
- **`HoldRefusalNotice`** is an amber `role="alert"` box: bold title, the sentence, one `Close`. Amber text uses the UI-SPEC light/dark pair.
- **DocumentList.** A 409 swaps the dialog footer for the notice. Any other failure still reads `Delete failed. Please try again.`
- **FolderNode.** A 409 swaps Delete and Cancel for the notice, and the folder stays. **FolderTree** keeps the confirm open until the delete answers.
- **WatchedFoldersSection** shows the purge sentence in its existing error line, with no source change.
- **Find.**
  - `include_archived` lives in state, with a `SET_INCLUDE_ARCHIVED` action that resets to the first page.
  - `toSearchRequest` sends `include_archived: true` only when it is on.
  - The `Include archived` chip sits immediately right of Version; when on it reads `Archived: included`, with the ✕ labelled `Stop including archived documents`.

## Task Commits

1. **Task 1:** RED `03150394e`, GREEN `aecd4a4ef`
2. **Task 2:** RED `a80de7fe5`, GREEN `a99ce4b7b`
3. **Task 3:** RED `21f65141c`, GREEN `628f20040`

## Verification (measured, verdict lines verbatim)

- **Task 1 verify:** `test_275_delete_paths.py` + `test_276_openapi_snapshot_fresh.py` + `tests/unit/api` → **62 passed**.
- **Task 2 verify:** `test_275_agent_wall.py` + `test_272_pure_move.py` + `test_276_openapi_snapshot_fresh.py` and eleven neighbouring fences → **234 passed**. Every unit suite naming a walled tool (29 files) → 7 failed, 444 passed:
  - 5 failures are base-set `test_multimodal_query` ids.
  - 2 were `test_115_handler_modes` spies that did not accept the new kwarg. Their signatures were fixed and the suite reads 5 passed.
- **Task 3 verify:** `vitest run src/components/retention findState FindQuickAdd apiBarrel` → **5 files, 96 passed**. Neighbours (ingestion, sources, pages, library, lib, FolderNode, FolderTree) → **129 files, 2503 passed, 1 skipped**.
- **Backend baseline** (local-DB lock held, then released):
  - Run 1: `72 failed`, gate FAILED. The one extra id was `test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery`. It was captured before any re-run and is outside this diff (`git diff --numstat c961d2c90 HEAD` names no ingestion file). It passed 4/4 in isolation. It is a live claim race on the shared queue.
  - Run 2:
    ```
    71 failed, 7025 passed, 1 skipped, 2 xfailed, 2 xpassed, 47 warnings in 353.33s (0:05:53)
    [GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
    ```
    **FAILED SET identical to base.** The one raw `comm` line is the same interleaved `RuntimeWarning` artifact that 275-01 recorded. Passed rose 6973 → 7025.
- **Vitest count gate** (once, from the worktree root, `GSD_VITEST_MAX_WORKERS=2`):
  ```
    total 10007  ·  failed 0  ·  pinned total 9220
  count gate OK — 426/426 pinned files present, no per-file decrease, 0 failing.
  ```
  Base was `9983 · 9196 · 424/424`. Both totals rose by +24 (5 + 10 + 5 + 4), with no residual.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): 66 errors. **The set diff against 275-BASELINES.md is EMPTY.**
- **Ledger gate:** `check-hot-file-ledger --files <20 touched files>` → `ledger gate OK — every watched file has a row`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FolderTree.tsx edited (not in `files_modified`)**
- **Issue:** `FolderTree.handleConfirmDelete` closed the inline confirm before awaiting the delete and swallowed every error. FolderNode could therefore never show a refusal.
- **Fix:** the confirm stays open until the delete answers. A 409 `ApiRefusal` is rethrown to FolderNode; any other error closes and logs as before. This is covered by the FolderTree case in `holdRefusals.test.tsx`.
- **Commit:** `628f20040`.

**2. [Rule 1 - Bug] ApiRefusal extends `Error`, not `ApiError`**
- **Issue:** the first version subclassed `ApiError`. That class is evaluated when `documents.ts` loads, so `attachmentsApi.test.ts` and `documents.search271.test.ts` (both mock `_core` without `ApiError`) threw at mount.
- **Fix:** `ApiRefusal` is a dependency-free `Error` subclass with `status` and `title`, which matches the plan's interface text. `purgeWatchFiles` loses only `ApiError`'s constructor-side handling on that one call; the other two clients threw a plain `Error` before.
- **Commit:** `628f20040`.

**3. [Rule 3 - Blocking] Two existing tests updated for the guard's new call**
- `tests/integration/test_documents.py` (a mocked suite): the two delete cases queue `execute()` results in order, so each gained one result for the guard's `retention_held_documents` RPC.
- `tests/unit/test_115_handler_modes.py`: two `resolve_filter` spies now accept `retrievable_only`.
- **Commits:** `aecd4a4ef`, `a99ce4b7b`.

**4. [Rule 1 - Design] The relationship filter reads the column off the endpoint row instead of adding `.eq` to a query**
- **Issue:** the plan asks for "one `.eq` per read leg". In `get_related_documents`, the related read is `_resolve_readable_latest`, which is shared with the create gate and the subject resolution. Filtering there would turn an archived endpoint into the masked "no access" row rather than omitting it.
- **Fix:** one guarded early return in `_append_edge`, reading `RETRIEVABLE_COLUMN` from the `select("*")` row already fetched. That is zero new queries, the agent read omits the endpoint, and the Library read is unchanged (tested).
- **Commit:** `a99ce4b7b`.

**5. [Scope note] `query_tables` / `analyze_document` by filename answer "not found", not `not_retrievable`**
- With the filter at the query, an archived file cannot be resolved by name at all, so these tools answer with their existing not-found sentence.
- The `analyze_document` wall still returns `not_retrievable` when a resolved id is non-retrievable (defence in depth, tested).

**6. [Count] `retrievable_only=True` appears on 3 lines, not 2**
- The plan said "exactly the two calls". The view handler calls `resolve_filter` twice (count leg and row leg), plus there is one relationship call. The fence pins `{"services/tool_dispatcher.py": 3}`.

---

**Total deviations:** 6 (2 blocking, 2 bug/design, 2 recorded scope/count notes). **Impact:** no scope added. Each change makes a planned property true or keeps an existing suite honest.

## Issues Encountered

- **A live ingestion-queue test is racy on the shared local DB** (`test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery`). It went red once in a full baseline run while 275-03 ran in parallel. It is outside this diff and was green on 4 isolated runs and on the re-run. It is recorded here so a future red is triaged by procedure.
- `graphify update .` was **not** run: `graphify-out/` is shared with the operator's uncommitted main-tree changes and with a parallel worktree, and regenerating it here would conflict at merge.
- **The two watch-purge paths still never remove file bytes.** This storage orphan predates 275 and stays a deferred bug for 275-05 to file, as the plan directs. This plan does not make it worse: no byte is removed anywhere on those paths.

## TDD Gate Compliance

- Each task has a `test(275-02)` RED commit followed by a `feat(275-02)` GREEN commit.
- **RED runs:**
  - Task 1: 23 failed, 1 passed. The pass is the D-32 AST fence, true at base by construction.
  - Task 2: 20 failed, 7 passed. The passes are positive controls and Library-default cases.
  - Task 3: 4 files failed. Two of them failed at import because their modules did not exist yet. 7 cases were red in the other two.

## Ledger cells for 275-05 (each ≤ 200 chars; triples measured at `628f20040` with the CLAUDE.md recipe)

| File | Triple | Cell |
|---|---|---|
| `backend/app/api/documents.py` | 92 / 36 / 2532 | **275-02**: 2 `assert_none_held` calls + `map_hold_refusal` + storage moved below the row delete (D-38). 0 new `if` (AST-pinned vs PHASE_BASE). `Request` param only |
| `backend/app/api/folders.py` | 12 / 8 / 277 | **275-02**: guard over subtree docs + folder ids (B-1) before any delete; rows → folder → bytes; one `folder.delete` audit on the folder's org |
| `backend/app/api/sources.py` | 9 / 3 / 706 | **275-02**: both purge doors guard first; the log-and-continue swallow is GONE (PT409 → 409, else propagates). Bytes still orphaned: deferred bug (275-05) |
| `backend/app/services/tool_dispatcher.py` | 98 / 43 / 5068 | **275-02**: 1 import + 3 `unretrievable` walls beside the folder walls + `retrievable_only=True` on 3 calls. ⛔ registry/handler split still OWED |
| `backend/app/services/retrieval_documents.py` | 3 / 3 / 206 | **275-02**: `.eq(RETRIEVABLE_COLUMN, True)` on resolve_document_id / resolve_document / fetch_full_document; 272 pins retired by name (D-18) |
| `backend/app/api/kb.py` | 14 / 9 / 515 | **275-02**: ls/tree/glob's 7 document reads gain `.eq(RETRIEVABLE_COLUMN, True)`. ⛔ `read_path` untouched (Library GET content shares it) |
| `backend/app/services/document_view_resolver.py` | 5 / 5 / 412 | honoured by construction — one default-False kwarg + one `.eq` per read leg, Library callers unchanged, source fence |
| `backend/app/services/document_relationship_service.py` | 6 / 4 / 465 | honoured by construction — one default-False kwarg + one `.eq` per read leg, Library callers unchanged, source fence (row column, not a 2nd query) |
| `frontend/src/components/ingestion/DocumentList.tsx` | 30 / 15 / 356 | **275-02**: one `refusal` state; a 409 `ApiRefusal` swaps the footer for `HoldRefusalNotice` (one Close). Non-409 still "Delete failed" |
| `frontend/src/components/ingestion/FolderNode.tsx` | 13 / 7 / 303 | **275-02**: one `refusal` state (cleared when the confirm closes); a 409 swaps Delete+Cancel for the notice. ⛔ no fetch here |
| `frontend/src/components/ingestion/FolderTree.tsx` | 13 / 8 / 213 | **275-02**: confirm stays open until the delete answers; rethrows ONLY a 409 `ApiRefusal` to FolderNode. ⛔ no fetch here |
| `frontend/src/pages/findState.ts` | 3 / 3 / 374 | **275-02**: `include_archived` state + `SET_INCLUDE_ARCHIVED` (offset 0); request key sent only when true (Pitfall 13). Still a zero-import leaf |
| `frontend/src/components/library/find/FindQuickAdd.tsx` | 2 / 2 / 380 | **275-02**: one toggle `FilterChip` right of Version: `Include archived` / `Archived: included` + labelled ✕ |
| `frontend/src/lib/api/documents.ts` | 8 / 8 / 503 | **275-02**: deleteDocument / deleteFolder `throw await refusalOf(...)`; imports refusal.ts, exports nothing new (barrel contract) |
| `frontend/src/lib/api/sources.ts` | 6 / 2 / 313 | **275-02**: purgeWatchFiles throws `ApiRefusal` (was `ApiError`); the section renders its sentence unchanged |

Rows for `agent_wall.py`, `refusal.ts`, `HoldRefusalNotice.tsx` and `retentionCopy.ts` were pre-registered by 275-01 (the ledger gate passed over them). Their measured triples are `1/1/64`, `1/1/50`, `1/1/39` and `1/1/40`.

## Known Stubs

None. `retentionCopy.ts` carries the S9/S10 strings only, and 275-04 adds its own (planned). The `Include archived` state is wired into Find's request. Browse's archived-hidden line is 275-04's.

## Threat Flags

None beyond the plan's register. T-275-12/13/14/15/16/17/18 are each mitigated and tested. The new `folder.delete` audit write and the folder `org_id` select read the caller's own folder through the RLS client, and write through the service role (D-05).

## Self-Check: PASSED

- All 8 created files exist on disk.
- Commits `03150394e`, `aecd4a4ef`, `a80de7fe5`, `a99ce4b7b`, `21f65141c` and `628f20040` are present in `git log`.
