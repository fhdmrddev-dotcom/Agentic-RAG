---
phase: 284-library-at-scale
plan: 05
subsystem: guards + ledger close / library
tags: [guards, request-recorder, frontend-fence, red-drive, count-gate, ledger-close, d-16, d-23, tdd]

requires:
  - phase: 284-01
    provides: "the paged clients (listDocumentsPage, getDocument, the four per-document page clients)"
  - phase: 284-02
    provides: "migration 207 library_documents, the paged GET /documents, GET /library/summary, the 50k scale account"
  - phase: 284-03
    provides: "every Library caller on the paged clients"
  - phase: 284-04
    provides: "Find / resolve paging in SQL, the server-searching pickers, the route inventory (D-23 layer 1)"
provides:
  - "D-23 layer 2: backend/tests/unit/test_284_request_recorder.py — violations() over the shared user-JWT transport (_shared_httpx), unit over MockTransport"
  - "D-23 layer 2 live: backend/tests/integration/test_284_request_recorder_live.py — 0 violations at 50k, largest in.() 1"
  - "D-16: frontend/src/lib/__tests__/libraryListFence.test.ts — ?raw fence over every product file, with a permanent planted-source self-test"
  - "the five whole-list clients deleted from lib/api/documents.ts and the barrel"
  - "count-gate pins for every suite Phase 284 grew or created (both knobs)"
  - "the Phase 284 ledger / CLAUDE.md close (37 subsections, 8 FIRING rows added)"
affects: [284-05 Task 3 (orchestrator), docs/HOT-FILE-LEDGER.md, CLAUDE.md, scripts/vitest-count-gate.cjs]

tech-stack:
  added: []
  patterns:
    - "Runtime request guard: swap the ONE shared httpx transport for a recording one, build the client with the production factory, assert on real httpx.Request query strings"
    - "Named, narrow exemptions as predicates (folder_id lists; Find's relationship allow-list ≤ REL_EDGE_CAP) — and a test that proves the exemption is load-bearing"

key-files:
  created:
    - backend/tests/unit/test_284_request_recorder.py
    - backend/tests/integration/test_284_request_recorder_live.py
    - frontend/src/lib/__tests__/libraryListFence.test.ts
  modified:
    - frontend/src/lib/api/documents.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/library/find/FindQuickAdd.tsx
    - frontend/src/__tests__/lib/api.test.ts
    - frontend/src/lib/api/__tests__/libraryPaging284.test.ts
    - frontend/src/lib/__tests__/apiBarrel.test.ts
    - frontend/src/components/library/find/__tests__/FindQuickAdd.test.tsx
    - frontend/src/components/metadata/__tests__/TakeoffSection.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - docs/public/api/concepts/pagination.md

key-decisions:
  - "The legacy-ARRAY tolerance inside the page clients is KEPT: one push may land the frontend before the backend. It is removed one release after Phase 284's production deploy; the D-16 fence does not forbid it (it is not a whole-list call)."
  - "LibraryPage.tsx: the D-24 extraction is TAKEN, but G-5 is NOT discharged — its line count rose (1302 at PHASE_BASE → 1344). OWED: the page-UI state (pager, selection, Find wiring, states composition)."
  - "The backend base failing set was derived from the orchestrator's merged-wave-2 run at this exact tree (backend_merged_w2.txt, 71 failed), not a fresh step-0 run — the 284-04 precedent; the after-run set diff is the evidence."
  - "Plan shape (D-25): 5 plans in 3 waves (284-01 ∥ 284-02 → 284-03 ∥ 284-04 → 284-05). D-26 (G-2 sketch skipped) is recorded in the orchestrator's phase close (Task 3)."

requirements-completed: []  # FIX-11 is marked by the orchestrator at phase close (Task 3), on evidence

duration: ~51min
completed: 2026-10-16
---

# Phase 284 Plan 05: The guards, the merged-tree gates and the ledger close — Summary

**A list route that drops its `.range()` or rebuilds the id-batching loop now fails a test (the request recorder, unit and live at 50,000 documents), a component that asks for the whole library fails a fence, and the five functions that made that possible are deleted. Every merged-tree gate is green; the ledger and CLAUDE.md say what the phase did to each of the 37 files it touched.** Task 3 (the AFTER measurement, R-09, G-4 and the close) is the orchestrator's checkpoint and was not started.

- **PLAN_BASE:** `49f93d8b7` (develop, wave 2 merged). The worktree started on master's tip; it was bootstrapped, then `git reset --hard 49f93d8b7`, and `git rev-parse HEAD` asserted `49f93d8b7fbc…` before any edit.
- **PHASE_BASE:** `f8659ac2d` (the ready_to_execute commit, before any 284 code).
- Base / evidence files (not committed): `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-284/` — `base_failed_49f93d8_05.txt`, `vitest_base_49f93d8_05.json`, `red_05_plant_a.txt`, `red_05_plant_b.txt`, `red_05_fence_legacy.txt`, `red_05_fence_plant.txt`, `recorder_green_05.txt`, `countgate_05.txt` / `.json`, `backend_gate_05.txt`, `integ_284_05.txt`, `tsc_t1_05.txt`, `eslint_phase_05.txt`, `eslint_a11y_phase_05.txt`, `ledger_measure_05.json`.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | The runtime guard and the whole-list fence, each driven RED; the legacy array clients deleted | RED `23029ca74` · recorder refinement `cc209e798` · GREEN `6bfc47a77` |
| 2 | Merged-tree gates, count-gate pins, the ledger / CLAUDE.md close | pins `30ea18d40` · ledger close `58b4bc367` · pagination doc `6c66cbbc5` |
| 3 | AFTER measurement, R-09, G-4 drive A-F, evidence-gated close | **pending — orchestrator checkpoint** |

## Task 1 — the guards

### D-23 layer 2: the request recorder

`violations(requests, page_limit, *, exempt=None)` reads real `httpx.Request` objects recorded off `app.dependencies._shared_httpx` (the one transport every user-JWT client shares; the client is built by `get_user_supabase` itself). A GET / HEAD on `documents`, `library_documents`, `document_chunks`, `document_tables` or `document_images` with no `limit` that is not an `id=eq.` single read is `unbounded select on <table>`; an `id` / `document_id` `in.()` longer than the page limit is `<col> in.() carries N ids > L`. Declared exemptions: `folder_id` lists (bounded by folders — `test_a_folder_id_list_is_exempt`), and on the Find relationship case ONLY, `RELATIONSHIP_EXEMPTION` (one document's lineage / edge-endpoint reads, ≤ `REL_EDGE_CAP`); that case also asserts the exemption is load-bearing (without it the lineage read IS flagged) and that the page itself is still ranged.

- **Unit (14 cases, MockTransport + canned PostgREST bodies with `Content-Range`):** the detector's four shapes; `list_documents` (≤ 3 requests, 0 violations) at Root / a folder / the last page; the four per-document routes at their own limits; `get_document`; `search_documents` (empty, name, last page; relationship with the named waiver); both resolve routes (page, count, ad-hoc last page); the summary's asyncpg SQL reads `public.library_documents` and passes no parameter list.
- **Live (2 cases, the seeded 50,000 + 20 account, real GoTrue JWT, real PostgREST, under the local-DB lock, 0 skipped):**
  ```
  [284-05] GET /documents root: 1 request(s), largest in.() = 0
  [284-05] GET /documents Big page 1: 1 request(s), largest in.() = 0
  [284-05] GET /documents Big LAST page: 1 request(s), largest in.() = 0
  [284-05] GET /documents whole library: 1 request(s), largest in.() = 0
  [284-05] POST /document-search (empty): 1 request(s), largest in.() = 0
  [284-05] POST /document-search (name): 1 request(s), largest in.() = 0
  [284-05] GET /document-views/{id}/resolve: 14 request(s), largest in.() = 1
  [284-05] POST /document-views/resolve: 2 request(s), largest in.() = 0
  [284-05] GET /documents/{id}/chunks: 2 request(s), largest in.() = 0
  [284-05] largest in.() per handler: {...}; overall max = 1
  [284-05] summary: 1 statement(s); params per statement = [0]
  16 passed, 1 warning in 5.34s
  ```
  **Largest `in.()` list seen at 50k: 1** (the saved view's folder subtree, a `folder_id` list). Zero violations.

### RED drive 1 — backend plant (a): the BUG-261014-06 batching loop re-inserted into `list_documents`

Plant (four lines after the page read): an unranged `documents?select=id` read, then `for i in range(0, len(all_ids), 100)` issuing `document_tables … in_("document_id", batch)`.
```
E       AssertionError: GET /documents -- 21 violation(s):
E         document_id in.() carries 100 ids > 25: document_tables
E         unbounded select on document_tables
E         unbounded select on documents
E       AssertionError:  -- 63 violation(s):            (root / Big / last page, unit)
E         document_id in.() carries 100 ids > 25: document_tables
E         unbounded select on document_tables
E         unbounded select on documents
E       AssertionError: GET /documents root -- 21 violation(s):   (LIVE, 50k)
E         document_id in.() carries 100 ids > 25: document_tables
E         unbounded select on document_tables
E         unbounded select on documents
FAILED tests/unit/test_284_request_recorder.py::test_list_documents_is_one_bounded_read
FAILED tests/unit/test_284_request_recorder.py::test_list_documents_root_and_last_page_are_bounded
FAILED tests/integration/test_284_request_recorder_live.py::test_every_library_read_is_bounded_at_50k
3 failed, 13 passed, 1 warning in 4.36s
```
**Restore proof (a):** the plant was removed by re-applying the exact text with the editor; `git diff --exit-code backend/app/api/documents.py` → **0**; md5 `e76d9f8d13c0adda4d8d9765b9a9c754` before and after.

### RED drive 2 — backend plant (b): `.range(offset, offset + limit - 1)` deleted from `list_documents`
```
E       AssertionError: GET /documents -- 1 violation(s):
E         unbounded select on library_documents
E       AssertionError: GET /documents root, Big, last page -- 3 violation(s):
E         unbounded select on library_documents
E       AssertionError: GET /documents root -- 1 violation(s):      (LIVE, 50k)
E         unbounded select on library_documents
FAILED tests/unit/test_284_request_recorder.py::test_list_documents_is_one_bounded_read
FAILED tests/unit/test_284_request_recorder.py::test_list_documents_root_and_last_page_are_bounded
FAILED tests/integration/test_284_request_recorder_live.py::test_every_library_read_is_bounded_at_50k
3 failed, 13 passed, 1 warning in 3.56s
```
**Restore proof (b):** `git diff --exit-code backend/app/api/documents.py` → **0**; md5 `e76d9f8d13c0adda4d8d9765b9a9c754`. Green after restore: 16 passed.

(The first drive of each plant failed on a content assert placed before the recorder check; `cc209e798` moved the recorder assertion first and made it print every DISTINCT violation, so the red names the shape. The outputs above are from after that change.)

### D-16: the whole-list fence

`libraryListFence.test.ts` sweeps every product `.ts` / `.tsx` under `src/` (`import.meta.glob(?raw)`; tests, `__tests__/`, `*.testutil.ts`, `test-utils/`, `setupTests.ts` excluded), comments stripped with the shared `stripComments`, and fails on a call of `listDocuments(` / `listDocumentChunks(` / `listDocumentTables(` / `listDocumentImages(` / `fetchDocumentVersions(`, an import or re-export of those names, and an unparameterised `` fetch(`${API_BASE}/documents` ``. Self-guards: > 200 files loaded and > 200 product files; `lib/api/documents.ts`, `lib/api.ts`, `CreateLinkDialog.tsx` present; no test file in the sweep; the stripper strips. The planted-source case is permanent (a whole-list import, call and fetch are named; a comment, a paged fetch and `listDocumentsPage(` are not).

### RED drive 3 — the fence on the legacy definitions (at the RED commit, before the deletion)
```
× no product file calls, imports or defines a whole-list client
- []
+ [
+   "lib/api.ts: imports or re-exports fetchDocumentVersions",
+   "lib/api.ts: imports or re-exports listDocumentChunks",
+   "lib/api.ts: imports or re-exports listDocumentImages",
+   "lib/api.ts: imports or re-exports listDocumentTables",
+   "lib/api.ts: imports or re-exports listDocuments",
+   "lib/api/documents.ts: calls fetchDocumentVersions(",
+   "lib/api/documents.ts: calls listDocumentChunks(",
+   "lib/api/documents.ts: calls listDocumentImages(",
+   "lib/api/documents.ts: calls listDocumentTables(",
+   "lib/api/documents.ts: calls listDocuments(",
+   "lib/api/documents.ts: unparameterised fetch of /documents",
+ ]
Tests  1 failed | 2 passed (3)
```
Definitions only — 284-03 / 284-04 had already removed every call.

### RED drive 4 — the fence on a scratch `CreateLinkDialog.tsx` import (after the deletion)

Plant: `import { listDocuments } from "@/lib/api"` + `export const plantedWholeLibrary = () => listDocuments()`.
```
× no product file calls, imports or defines a whole-list client
+ [
+   "components/relationships/CreateLinkDialog.tsx: calls listDocuments(",
+   "components/relationships/CreateLinkDialog.tsx: imports or re-exports listDocuments",
+ ]
Tests  1 failed | 2 passed (3)
```
**Restore proof:** `git diff --exit-code frontend/src/components/relationships/CreateLinkDialog.tsx` → **0**; md5 `b6fbd60833e7506be519b16ac91ebb63` before and after; the fence is green again (3 passed).

### GREEN — the legacy clients deleted (`6bfc47a77`)

- Deleted from `lib/api/documents.ts`: `listDocuments`, `listDocumentChunks`, `listDocumentTables`, `listDocumentImages`, `fetchDocumentVersions`; their five barrel lines in `lib/api.ts`. Acceptance greps: `export async function (…)\(` in documents.ts → **0**; `^\s+(…),$` in api.ts → **0**.
- **No product importer remained** (the fence and tsc agree). Test files that referenced the names, converted in place, counts unchanged: `api.test.ts` 42 → 42 (the `listDocuments` case is now `listDocumentsPage` with `?offset=0&limit=25`); `libraryPaging284.test.ts` 22 → 22 (the three legacy-client cases now pin the deploy-window tolerance inside the page clients: same rows from either shape, exact totals kept, a legacy array claims no more than its length); `apiBarrel.test.ts` 5 → 5 (the "five detail reads by name" now name the paged successors); `TakeoffSection.test.tsx` 8 → 8 (`api.listDocuments` no longer exists, so the case asserts every read is a bounded page).
- `FindQuickAdd.tsx`: the unused `documents?` prop and the `Document` import deleted; the test fixture prop and the `DOCS` fixture gone. **No caller edit was needed** — `LibraryPage.tsx` already passed no `documents`. `FindQuickAdd.test.tsx` 27 → 27; the converted case asserts the declaration is absent from the comment-stripped source. `grep -c "documents?:" FindQuickAdd.tsx` → **0**.
- **Deploy-window decision:** the legacy-ARRAY tolerance in the page clients is **KEPT** (documented in `lib/api/documents.ts`'s block comment): remove it **one release after Phase 284's production deploy**.

## Task 2 — merged-tree gates

| Gate | Verdict |
|---|---|
| **vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root, once) | `count gate OK — 446/446 pinned files present, no per-file decrease, 0 failing.` total 10481 · failed 0 · pinned total 9612. The `WorkflowBuilderPage.canvas` red did **not** recur (154/154), so no PHASE_BASE re-run was needed. |
| **backend unit** (`check-backend-unit-baseline.cjs`, under the lock) | `[GATE PASSED] … (failed: 71 <= 71, errors: 0)` — **71 failed, 7673 passed**, 0 collection errors. Failing SET vs base (`base_failed_49f93d8_05.txt`, from the orchestrator's merged-w2 run at this tree): **`comm -3` empty, 71 = 71** after cutting each FAILED line at the first `C:` (pytest glues a `RuntimeWarning` path onto `test_111_1_reembed_kickoff::test_no_change_save_does_not_reembed` on the base side). |
| **backend integration** `tests/integration/test_284_*.py` together | **27 passed, 0 skipped** (find, list, request_recorder, resolve, summary, view) |
| **tsc** `-p tsconfig.app.json` | 63 raw lines; multiset (`(line,col)` stripped, sorted, no `-u`) vs `tsc_merged_w2.txt` (PLAN_BASE): **identical**. Set vs PHASE_BASE `f8659ac2d` (284-01's base file): **`comm -13` empty** — 55 unique now ⊂ 58 then. |
| **eslint** (rule-id multiset per file, base via `git show f8659ac2d:… \| eslint --stdin`, JSON) over all 26 frontend product files the phase touched | **nothing new**; DocumentChunksSection 1 → 0, TakeoffSection 2 → 1 |
| **eslint a11y** (`eslint.a11y.config.js`), same 26 files | **nothing new** (IngestionTab 1, StructurePopovers 1 — inherited) |
| `build-public-openapi.cjs --check` | exit 0 (208/250 paths) |
| `check-docs-coverage.cjs` | exit 0 (34 written / 85 stubs) |
| `check-seeds-register.cjs` | exit 0 (363/363) |
| `check-hot-file-ledger.cjs .planning/phases/284-library-at-scale` | exit 0 (scan list 558 rows · 35 watched) |
| `check-claude-md-size.cjs` | exit 0 (CLAUDE.md 94,018 chars) |
| `src/docs` suites (after the pagination.md line) | 17 files / 136 passed |

### Count-gate pins (`30ea18d40`) — each read from a real `npx vitest run` of the file on the merged tree

Raised (BASELINE): useLibraryDocuments 13 → **24**, IngestionTab 42 → **50**, LibraryHeaderBar 13 → **16**, DetailSections.tables 15 → **18**, DocumentDetailPanel.images 3 → **4**, CreateLinkDialog 8 → **14**, LinkTargetCombobox 9 → **17**, LegalHolds 25 → **29**, FindQuickAdd 26 → **27**, StructurePopovers 27 → **30**. Adopted in BOTH knobs (TARGETS file-level + BASELINE): `LibraryPage.states284` **15**, `DocumentChunksSection.paging284` **8**, `DocumentRow.versions284` **3**, `libraryListFence` **3**, `TakeoffSection` **8** (it was in NEITHER knob). Checked and already right: libraryPaging284 22, FolderDetail284 5, LibraryStatTiles 16, useDocuments 7, DocumentsPager.exact271 3, IngestionTab.readerOff 5 / reconnectControl 6, DetailSections.lazy 20, apiBarrel 5. **No pin lowered; every new basename is unique under `src/`.**

Per-file deltas in the gate run (pinned → actual): every one of the 26 pins above reads delta **0** (e.g. `IngestionTab.test.tsx 50 50 0`, `LibraryPage.states284.test.tsx 15 15 0`, `libraryListFence.test.ts 3 3 0`, `TakeoffSection.test.tsx 8 8 0`). Positive slack elsewhere is pre-existing (`WorkflowBuilderPage.canvas 128 → 154`, `publicOpenapi 11 → 15`), plus 6 unpinned files reported `new`.

### Ledger / CLAUDE.md close (one commit, rows and sections together)

- **37 subsections** under `## Phase 284 close (2026-10-16, 284-05)`: the **35 watched files** under `backend/app` / `frontend/src` that `git diff --name-only f8659ac2d HEAD` prints (tests / migrations excluded; `test-utils/fakeLibraryApi.ts` included because the gate does not exempt `test-utils/`), plus the **2 gate-exempt scripts** carrying CLAUDE.md FIRING rows (`vitest-count-gate.cjs`, `full-schema-supplement.sql`). Each quotes the replaced scan-list cell verbatim and, where one existed, the CLAUDE.md cell under "CLAUDE.md verdict cell as of 2026-10-16 (replaced by 284-05)". `scripts/seed-scale-284.py`, `measure-library-284.py`, `apply_migration_207.py` are gate-exempt with no rows (none owed).
- Triples re-derived with the recipe at `30ea18d40`; six-digit quick-task buckets subtracted and named per file; `LibraryPage.tsx` gives `--follow` **63 / 20 / 1344** (plain recipe 37 / 11 / 1344).
- **CLAUDE.md:** 18 existing FIRING rows updated (triple + verdict ≤ 80); **8 rows ADDED**: `api/document_views.py` (6 phases), `models/document_view.py` (4), and the six files that reached 3 phases in 284 — `FolderDetail.tsx`, `DocumentsPager.tsx`, `FindQuickAdd.tsx`, `StructurePopovers.tsx`, `DocumentChunksSection.tsx`, `CreateLinkDialog.tsx`.
- Binding verdicts as written: `LibraryPage.tsx` — **extraction TAKEN (284-01, `useLibraryDocuments.ts`); the page derives nothing from documents (its one `.documents` read is `retention.documents[id]`); G-5 NOT discharged because the line count ROSE 1302 → 1344; OWED: the page-UI state (pager, selection, Find wiring, states composition).** `documents.py` — honoured by construction, the `_ID_BATCH` stopgap removed. `document_search_service.py` — the "two legs" invariant retired deliberately (284-04).
- **Owed corrections done:** the DocumentChunksSection bullet "Above 1,000 chunks the header count is the PostgREST cap" is struck and corrected in place (not deleted); `retrieval_scope.py`'s scan row and FIRING row now record the verbatim `_fetch_all` move.
- CRLF preserved in both files (`file` reports CRLF; one `sed -i` that silently converted the ledger to LF was caught by `file` and reverted to CRLF before the commit).
- **Optional doc line done:** `docs/public/api/concepts/pagination.md`'s bounds table names both resolve routes (25 / 200); docs coverage and the OpenAPI check stay green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The live recorder could not reach the local stack.** The unit conftest points `settings.supabase_url` at a placeholder, so `get_user_supabase` resolved `test.supabase.co` (`getaddrinfo failed`). The live fixture monkeypatches `settings.supabase_url` / `supabase_anon_key` from `backend/.env` (the `_271_gotrue_users.user_client` shape); the client is still built by the production factory on the recorded shared transport. File: `test_284_request_recorder_live.py`.

**2. [Rule 1 - Test honesty] The recorder assertion now runs before content asserts and names each distinct violation** (`cc209e798`): the first plant drives failed on a length assert first. Test-only change.

**3. [Rule 3 - Blocking] Three test files outside the plan's list referenced deleted names** and would have broken tsc or their own pins: `apiBarrel.test.ts` (named `listDocumentChunks/Tables/Images`), `TakeoffSection.test.tsx` (`api.listDocuments`). Both converted in place, counts unchanged. (`DetailSections.*`, `DocumentList.moveToFolder`, `useDocuments`, `DocumentRow.*` tests only carry extra keys in `vi.mock` factories — harmless, left alone.)

**4. [Rule 2 - Coverage] `TakeoffSection.test.tsx` was in neither count-gate knob**; 284-04 listed it to pin, so it is adopted in both (8).

**5. [Rule 1 - Honesty] Backend base set not re-run at step 0** — derived from the orchestrator's `backend_merged_w2.txt` at the identical SHA (71 failed / 7659 passed); the after-run set diff is the evidence (284-04 precedent).

**6. [Hygiene] The ledger `G-5` column** was normalised to `⚠ **FIRES**` / `no (N phases)` / `no (young)` for the rows touched (one previously read "FIRES — 10 phases", another "FIRES — EXACTLY AT THRESHOLD"); the replaced cells are quoted in each subsection.

**Not needed:** no caller edit for the FindQuickAdd prop removal (LibraryPage passed none).

**Total:** 5 auto-fixed + 1 hygiene. No scope creep; no product source changed outside the plan's list.

## TDD Gate Compliance

RED `23029ca74` (`test(284-05)`) precedes GREEN `6bfc47a77` (`refactor(284-05)`). At RED the backend recorder PASSED against the real handlers by design (the code was already bounded — the guard proves it), and the frontend fence FAILED on the legacy definitions (drive 3). The backend RED was then driven by the two plants (drives 1-2), never committed.

## Known Stubs

None.

## Threat Flags

None. Task 1 adds tests and deletes client functions; Task 2 touches pins and docs. T-284-30 (recorder, unit + live, two RED drives) and T-284-31 (fence, permanent self-test + scratch-import RED drive, legacy clients deleted) are mitigated as planned; T-284-33 is covered by the 27 live `test_284_*` cases re-run together on the merged tree.

## Owed to Task 3 (orchestrator)

- **The synthetic 50k account `scale284@example.com` is still seeded and was NOT torn down** (the recorder ran against it read-only, plus one throwaway `document_views` row deleted in `finally`).
- AFTER measurement (D-22) at 10k and 50k — needs the operator-restarted backend on the merged tree; R-09 production `max_rows` read (read-only); G-4 A-F in Chrome MCP; the evidence-gated flips (BUG-261014-07, BUG-261014-06 note, SEED-248, REQUIREMENTS FIX-11, ROADMAP, STATE).
- STATE.md OWED items to record: production migration 207 BEFORE the backend deploy + `get_advisors(security)`; the v4.6 public changelog entry for the `GET /documents` breaking change; **the legacy-array tolerance removal one release after the production deploy**; `graphify update .` on the merged tree (no worktree ran it).
- The local-DB lock is released (file absent).

## Self-Check: PASSED

- FOUND: `backend/tests/unit/test_284_request_recorder.py`, `backend/tests/integration/test_284_request_recorder_live.py`, `frontend/src/lib/__tests__/libraryListFence.test.ts`.
- FOUND commits: `23029ca74`, `cc209e798`, `6bfc47a77`, `30ea18d40`, `58b4bc367`, `6c66cbbc5` (all six on this branch since `49f93d8b7`).
- STATE.md / ROADMAP.md / REQUIREMENTS.md untouched. No `FilterBar.find271.test.tsx.snap` churn (working tree clean after every vitest run). No Supabase MCP call, no migration, no push, the operator's :8000 backend untouched.
