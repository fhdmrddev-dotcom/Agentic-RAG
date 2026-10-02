# Phase 270 — UAT log (plan 270-05)

Driven 2026-10-03 on the MAIN working tree against LOCAL services only (Supabase :54321/:54322, backend :8000 on the merged code, Vite :5173). Operator account `fhdmrd@gmail.com` (177 documents). No signed URL and no key is recorded anywhere in this file or in `evidence/`.

## Gates (merged tree)

| Gate | Result |
|---|---|
| Backend unit baseline (`check-backend-unit-baseline.cjs`, in `backend/`) | `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0)`. Count only: the failed SET was not diffed against `270-BASELINES.md` by this run. The 270-02 and 270-01 executors each recorded 71 before and after. |
| Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`) | RED, triaged: see "Vitest verdict" at the foot of this file |
| `tsc -p tsconfig.app.json --noEmit` | 70 errors = the baseline count of 70 (`270-BASELINES.md` line 129). Count compared, SET not re-diffed here; 270-03 and 270-04 each reported "no new error" as a set diff against base. |
| `check-hot-file-ledger.cjs 270` | `ledger gate OK — every watched file has a row` (356 rows, 37 subject files, 14 watched) |
| `check-claude-md-size.cjs` | `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` |
| `check-seeds-register.cjs` | `seeds register gate OK — 336/336 parsed, 0 duplicate ids` (after SEED-330 was planted) |
| `check-deploy-drift.sh` | `RESULT: PASS — the one-box deploy artifacts are in sync` (docker compose denied here, structural fallback used) |
| Closed-core guards (`test_259_…`, `test_261_…`, `test_255_…`) | 18 passed |

## Fixtures (local DB only, all deleted at the end, see Cleanup)

- `uat270-colleague@example.test`: member of the operator's org (`22f9c615…`). The signup trigger also gave it an org of its own.
- `uat270-orgb@example.test`: **membership count query returned 1**, in its own org `9345c77b…`, which is NOT the operator's org. Proven before the refusal row.
- `uat270-versions.txt` uploaded three times with different bytes (v1, v2, v3); `uat270-2019-contract.pdf` built with reportlab + pypdf (`/CreationDate D:20190312140300Z`, `/ModDate D:20190401093000Z`, `/Author Amina Rahman`, 3 pages).
- Existing rows used: shared-folder document `ACME_MSA_2026.md` in "Client ACME"; failed-ingest row `bc002444…` whose storage object is absent (storage info 400); connector-placed documents (Microsoft 365 and Google Workspace connections).

## Results

| Row | What was done | Expected | Observed | Evidence | Verdict |
|---|---|---|---|---|---|
| SC#1 | `POST /documents/{v3}/download-url` as the operator; fetched the returned URL; sha256 of the bytes | equals `documents.content_hash` of that row | mint 200, keys `expires_in, filename, url, version_number`, `expires_in` 60, `version_number` 3, `Cache-Control: no-store`; storage 200; bytes sha `f19995ab8fa5e6d2…` = DB `content_hash` = locally computed sha; `Content-Disposition: attachment; filename=uat270-versions.txt; filename*=UTF-8''uat270-versions.txt` | script output (hashes only) | PASS |
| SC#2 | same for the older version v2 | hash of v2 bytes = v2 row's hash, and differs from v3 | mint 200, `version_number` 2; bytes sha `df7e533bee1859e6…` = DB = local; filename preserved | script output | PASS |
| SC#3 | org-B user (membership count 1) requests v3; colleague requests a shared-folder doc and the operator's private doc; same URL re-requested after TTL+5 s; failed row | org-B: 404, no `url` key; colleague: 200 on the shared doc; URL refused after expiry; failed row: 410 `file_missing` | org-B: **404, body `{"detail":"Document not found"}`, no `url` key**; colleague on `ACME_MSA_2026.md`: **200** with `url`; colleague on the operator's private doc: 404; URL fetched at 0 s = 200, after `expires_in` 60 + 5 s = **400 `InvalidJWT "exp" claim timestamp check failed`** from Storage; failed row: **410** `{"reason_code":"file_missing","message":"The original file is missing from storage."}` | script output | PASS |
| SC#4 | `SELECT` on the 2019 PDF row and on a pre-270 row; same two read in the panel | 3 pages, created 2019-03-12, modified 2019-04-01, author, `created_at` = today; pre-270 row four NULLs | PDF row: `page_count` 3, `source_created_at` 2019-03-12 14:03, `source_modified_at` 2019-04-01 09:30, `source_author` Amina Rahman, `created_at` 2026-10-02 (UTC; panel shows 3 Oct 2026, 00:49 local, UTC+4). Pre-270 rows show `not recorded` ×4 | g4-1, g4-2 | PASS |
| G4-1 | Opened the 2019 PDF in the panel | `Created in the file` reads a 2019 date, `Added to Agentic RAG` reads today, both at rest in the `File` section above Details | `File` is the first section, open, 8 rows: File type, File size, Pages `3 pages`, Created in the file `12 Mar 2019, 18:03` (local time), Last modified in the file `1 Apr 2019, 13:30`, Author in the file `Amina Rahman`, Added to Agentic RAG `3 Oct 2026, 00:49`, Added by `You`. Header shows a `Download` button | `evidence/g4-1-panel-2019-pdf.png` | PASS |
| G4-2 | Opened `TOR_Fahed Mrad.pdf` (ingested before this phase) | Pages / Created / Last modified / Author each italic `not recorded`, footnote with `Re-ingest it to read them.`, size/type/added real | exactly that: four italic `not recorded` rows, footnote visible, `961.4 KB`, `PDF application/pdf`, `Added … 8 Sept 2026, 00:38`, `You` | `evidence/g4-2-panel-pre270-doc.png` | PASS |
| G4-3 | 3-version document: row, panel header, version history | row and panel `Download v3 (latest)`, history `Download v2 (viewed, not latest)`; each file hashes to its row | Row `Download v3 (latest)`, panel header `Download v3 (latest)`, panel caption `3 Oct 2026, 00:49 · when v3 was added`. History (panel CLOSED) lists `Download v3 (latest)`, `Download v2 (viewed, not latest)`, `Download v1 (viewed, not latest)`. Clicking v2 sent `POST /documents/fb40421d…/download-url` (v2's own id) = 200; no signed URL in the DOM. Hashes per version are SC#1/SC#2. The saved file name in the browser's download folder was not inspected (headless drive); the `Content-Disposition` filename is recorded above. **Defect F-1: with the detail panel OPEN the history's Size and Actions columns are `display:none`, so per-version Download and Restore are unreachable** | `evidence/g4-3-version-history.png` (panel open, buttons hidden), `evidence/g4-3-version-history-panel-closed.png` | PASS (F-1 found, FIXED, re-driven: see Fixes) |
| G4-4 (a) | Connector-placed document download + `Added by` | download succeeds, hash matches, `Added by` reads `<connection name> (connected source)` | Download: PASS (Google Workspace and Microsoft 365 documents minted 200 and hash matched `content_hash`, SC list above; the Microsoft 365 PDF was driven in the UI). Panel banner reads `Placed here by a connected source, not uploaded by a person.`, but **`Added by` reads `You`**, not `Microsoft 365 (connected source)`. The API returns `source_connection_name: "Microsoft 365"`; `DocumentFileFacts.tsx:32-37` tests `doc.user_id === currentUserId` BEFORE the connection. **Defect F-2** | `evidence/g4-4a-connector-doc.png` | FAIL on `Added by` at first drive, then FIXED and re-driven (see Fixes); download PASS |
| G4-4 (b) | Download on the failed-ingest row with no storage object | sentence visible without hovering | red text `The original file is missing from storage. Upload it again to make it downloadable.` under the `Download v1 (viewed, not latest)` row | `evidence/g4-4b-missing-file.png` | PASS |
| G4-5 | Colleague (not the uploader) downloads the shared-folder doc; then access is removed while the panel is open | colleague's download succeeds; the other-org case shows `You don't have access to this file, so no download link was created.` and no body carries a URL | Colleague signed in through a local magic link, opened `Client ACME` → `ACME_MSA_2026.md`, clicked Download: `POST /documents/1417fc12…/download-url` = **200**; `Added by` reads `name not available` (no email). Then the colleague's org membership was deleted in the local DB and Download clicked again: **404** and the page shows `You don't have access to this file, so no download link was created.` The org-B API half is SC#3 (404, no `url`). An org-B user cannot see the document in the UI at all, so the sentence was driven through a revoked membership instead | `evidence/g4-5-colleague-shared-doc.png`, `evidence/g4-5-refusal-sentence.png` | PASS |

## Findings (both fixed in this plan after the first drive, see Fixes)

- **F-1 (G4-3):** `frontend/src/pages/LibraryPage.tsx:107-108` `SHED_COLUMNS_3_TO_5` is `[&_table_td:nth-child(n+3):nth-child(-n+5)]:hidden`, a DESCENDANT selector, so it also hides columns 3-4 (Size, Actions) of the nested version-history table in `DocumentRow.tsx:154-175` whenever the shed is applied (detail panel open). The new per-version Download and the pre-existing Restore are therefore unreachable while a panel is open, and reachable once it is closed. Size: 1-2 lines, a G-3 fast fix (scope the shed to the list's own table, for example a `data-` attribute on the nested table and a `:not()` in the selector), but `LibraryPage.tsx` is a G-5 hot file, so it needs the ledger note.
- **F-2 (G4-4a):** `DocumentFileFacts.tsx:32-37` `addedBy()` checks the current user first; connector-placed documents are owned by the user who connected the source, so they always read `You` while the banner above says a connected source placed them. One reorder (connection check first) fixes it. 270-03's executor flagged the order as a deliberate reading of the plan; the live drive shows it contradicts G4-4(a).
- Observation, not investigated: at a 1442 px viewport with the folder rail open the main list table's Actions column is clipped (horizontal scroll). Not touched by this phase.

## Fixes (operator decision "fix both", 2026-10-03)

- **F-2 fixed** in `DocumentFileFacts.tsx` `addedBy()`: the connection is tested before "is it me". New case in `DocumentFileFacts.test.tsx` (own connected document: `Microsoft 365 (connected source)` and no `You`); the pre-existing test used `currentUserId="other"` for the connected cases, which is why it never saw this. **Re-driven live:** `BAckend - Unicorn commands README.pdf` now reads `Added by` = `Microsoft 365 (connected source)`.
- **F-1 fixed:** `LibraryPage.tsx` `SHED_COLUMNS_3_TO_5` now targets the list's own table by child combinators and excludes `[data-version-history]`; `DocumentRow.tsx` marks the nested history table with `data-version-history`. Source fence added to `DocumentRow.download270.test.tsx` (selector excludes the marker, the marker is on the table; a CSS rule cannot be evaluated in jsdom). **Re-driven live with the detail panel OPEN** on `pgmp exam content outline.pdf`: `Download v3`, `Download v2`, `Download v1` and `Restore` are all visible (155 / 224 / 221 / 68 px wide), the history's Size and Actions headers compute `display: table-cell`, and the main list still sheds Type, Size and Chunks (`display: none`). Evidence: `evidence/g4-3-fixed-history-with-panel-open.png`.
- Targeted suites (`src/pages/LibraryPage`, `src/components/ingestion`, `src/components/metadata`): 15 of 15 in the two edited files pass; the wider directory run showed `STACK_TRACE_ERROR` timeouts in `DocumentDetailPanel.a11y.test.tsx`, `DetailSections.lazy.test.tsx`, `AutomationGroup.test.tsx`, `InlineEdit.test.tsx`, `DetailSections.tables.test.tsx`, `DocumentDetailPanel.file270.test.tsx` across three runs (1, 6, then 2 failures; the set moved). `git diff --numstat` shows none of `DocumentDetailPanel.a11y.test.tsx` / `DetailSections.lazy.test.tsx` modified, and the two re-run alone at cap 1 passed 21/21. Recorded as an observation (SEED-171 pattern), not proof of innocence.

## Cleanup (T-270-27)

Deleted: documents `5e6e5ec5…`, `fb40421d…`, `cb34697b…` (uat270-versions.txt v1-v3) and `6a3a6964…` (uat270-2019-contract.pdf) with their 4 storage objects; users `uat270-colleague@example.test` and `uat270-orgb@example.test`; their two auto-created orgs `944580bf…` and `9345c77b…`. Verified after: 0 documents named `uat270-%`, 0 users `uat270-%`, operator documents 177 (before 177). The colleague's membership in the operator's org was removed during G4-5 and is gone with the user. No real storage object was deleted to fake a missing file (`bc002444…` was already absent).

## Signed-URL audit

`grep -ciE "https?://[^ ]*(token=|/sign/)"` over this file and `evidence/` is 0 by construction: only statuses, hashes and headers were recorded.

## Vitest verdict

Two full runs on the merged tree, cap 2, no sibling agent:

- Run 1 (before the F-1/F-2 fixes; files were being edited while it ran): `total 9149 · failed 1 · pinned total 8394` → `FAIL [failing-tests] 1 test(s) failed`. The one failure was `DocumentFileFacts.test.tsx` "names who added it…", i.e. a file mid-edit at that moment; the same file passes 15/15 after the edit finished.
- Run 2 (final tree, after the fixes, commit `96d59b622`): `total 9149 · failed 5 · pinned total 8394` → `FAIL [failing-tests] 5 test(s) failed — the gate requires 0.` Filenames captured from the gate's own JSON BEFORE any re-run:
  - `src/pages/WorkflowsPage.test.tsx` (3 cases) — one of SEED-171's five named flaky suites
  - `src/pages/__tests__/SettingsPage.changedFields.test.tsx` (1 case)
  - `src/components/library/__tests__/sketchComposition.test.tsx` (1 case) — also red once in 270-03's own run and green 46/46 at base and with its changes
  - all five are `STACK_TRACE_ERROR` timeouts. `git diff --name-only 26308281a HEAD -- frontend` lists 16 files and NONE of these three is among them (provably unmodified by this phase). The failing SET moved between runs (1 file, then 3 files), which is the SEED-171 signature, so this is recorded as an observation, never as proof of innocence.
- The deterministic evidence for this phase is therefore: the in-scope suites (`src/components/ingestion`, `src/components/metadata`, `src/lib/__tests__/documentDownload.test.ts`, `src/pages/LibraryPage*`) with the two edited files 15/15 and the two timeout-prone neighbours 21/21 at cap 1, plus the backend gate (71 ≤ 71), the tsc count (70 = baseline) and the live drive above. `count gate OK` was NOT reached, and a plan that needs it green cannot promise it (CLAUDE.md consequence for planning).

## Operator sign-off (G-4)

2026-10-03: the operator reviewed the three checks asked for at close (Download button naming the version; `File` first with eight rows; four italic `not recorded` rows on an old document) and replied **"1 2 3 are confirmed"**. Recorded as the G-4 sign-off.
