# Phase 284 — Live evidence (G-4 D-27, R-09, AFTER run conditions)

**Driven:** 2026-10-16, by the orchestrator (284-05 Task 3), Chrome DevTools MCP.
**Served code:** backend `uvicorn --reload` on :8000. Its worker respawned 06:12:57 local, 11 s after the wave-2 merge `e741f56bd`. Frontend: Vite dev server on :5173 (HMR), on `develop` at `bb47f34ce`. That includes the two fixes this drive found (below).
**Evidence directory:** `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-284/` (network responses, snapshots, trace, timing scripts' output).

## Accounts and active-org proof

| Account | Chrome context | Proof |
|---|---|---|
| `scale284@example.com` (synthetic, 50k then 10k) | isolated context `scale284`, so the operator's own session in the default context was never signed out | `localStorage["active-org-id"]` = `567f87e8-d78b-5ea1-a89a-66fb11981a6b`, the seeded "Scale 284" org. The owner is org-admin there (`seed-scale-284.py --status` memberships). Every API request carried `x-org-id: 567f87e8-…`. |
| `fhdmrd@gmail.com` (dev account) | default context (already signed in), read-only | `GET /org/me` → `org_id 22f9c615-0eec-440a-8804-ed4784d6f57f`, role org-admin, **one** membership ("fhdmrd@gmail.com's Organization"). (The two-org account in project memory is `fhdmrd.dev@gmail.com`, a different user; this one is in one org, as measured.) |

## G-4 scenarios (CONTEXT D-27, plus F from the plan checker)

The verdict reads the rendered numbers and rows and the network log, never the presence of a block.

| Row | Scenario | Verdict | Evidence |
|---|---|---|---|
| **A @50k** | Open the Library | **PASS** (after 2 fixes) | A `MutationObserver` installed before the click saw **no** "0 documents", "No root documents yet." or "No documents" frame before data. "Counting…" plus a skeleton appeared at +197 ms after the click. Settled: header "Documents not assigned to a folder · 30,000 documents"; tree "Root 30,000 · Big 10,000"; pager "1–25 of 29,808" = DB `root_latest_unarchived` 29,808; "192 archived documents hidden" (30,000 − 29,808); CHUNKS "1,514,668 across 50,020 documents". Network: `GET /documents?offset=0&limit=25&folder_id=root&include_archived=false`, `GET /library/summary`, `GET /folders` (each twice: the React StrictMode dev double-mount). No unparameterised `GET /documents`. |
| **A @10k** | Open the Library | **PASS** | Same observer: no empty-state frame and no negative frame. "Counting…" at +250 ms. Header 6,000; tree "Root 6,000 · Big 3,000"; pager "1–25 of 5,816" = DB 5,816; "184 archived documents hidden"; CHUNKS "297,360 across 10,020 documents". |
| **B @50k** | Open `Big` (10,000) and page to the last page | **PASS** | Pager "1–25 of 9,948" = DB `big_latest_unarchived`; first row `scale284-49993.pdf` = DB first by `created_desc`; band "10,000 documents"; tree "Big 10,000"; "52 archived documents hidden". Paged with real Next clicks (397 page advances, 25 per page). The last page settled at "9,926–9,948 of 9,948", 23 rows, last row **`scale284-00017.pdf` = the DB's oldest unarchived latest document in Big** (created 2026-01-01 00:00:17). Next was disabled. Network: `GET /documents?offset=9925&limit=25&folder_id=ea595fbd-…&include_archived=false` [200]. |
| **C @50k** | Create link and Legal hold: type part of a seeded filename | **PASS** | **Create link** (detail panel → Add link): typed `scale284-12345`; the only option was `scale284-12345.txt`. Typing 14 characters produced 2 `POST /document-search` (debounced). Body: `{"name":"scale284-12345","version":"latest","sort":"added_desc","offset":0,"limit":20,"include_archived":true}`; response 1,125 bytes. **Legal hold** (Organization admin → Retention → Legal holds → + New hold; never submitted): typed `scale284-40404`, and `scale284-40404.docx` appeared. Body `limit: 20`; response 1,194 bytes. Opening and typing in either dialog issued **no** `GET /documents`. |
| **D @50k** | Upload one file on page 1 | **PASS** | Uploaded `g4-d-upload-284.txt` to Root through the Upload control. The row appeared on page 1 with no reload. About 1.7 s later the header went 30,000 → 30,001, tree Root 30,000 → 30,001, the pager "of 29,808" → "of 29,809", and the tile "across 50,020" → "across 50,021". |
| **E (dev)** | The dev account's Library is unchanged | **PASS** | Header "200 documents"; pager "1–25 of 200"; CHUNKS "8,042 across 286 documents". The same numbers through the view as that user (asyncpg, `role authenticated`, the user's JWT claims): latest 286 · Root 200 · chunks 8,042. Server answers: summary `total 286, root.count 200`, page `total 200, rows 25`. Note: the first two reads showed "…" and "0–0 of 0" while the tab opened in the BACKGROUND. The console showed 18 GoTrue `lock:sb-127-auth-token was not released within 5000ms` warnings, so the auth lock delayed the fetch (the known hidden-tab artefact). Brought to the front, it rendered the numbers above with no failure copy. |
| **F @50k** | A saved view over thousands of matches, paged to the end | **PASS**, scenario amended | **Amendment:** the plan named "a view whose matches include all of Big". A Folder condition cannot be saved as a view (FilterBar Pitfall 9 shows the reason instead of Save as view). The ad-hoc Find filter "Folder /Big + subfolders" read "1–25 of 9,948" (= DB), through `POST /document-search`. For the view path, a saved view "G4 F invoices" (Document type = invoice) was created and opened from the sidebar. Pager "1–25 of 8,289" = DB invoice latest unarchived; "45 archived documents hidden" (8,334 − 8,289); sidebar count 8,334 = DB latest including archived. Paged with real Next clicks to "8,276–8,289 of 8,289", 14 rows, last row **`scale284-2500-chunks.pdf` = the DB's oldest match**. Network: `GET /document-views/cf0a9a1d-…/resolve?offset=8275&limit=25&include_archived=false` [200]. |

## Defects the drive found, and what happened to each

| # | Found in | What the browser showed | Cause | Disposition |
|---|---|---|---|---|
| 1 | A @50k | Tree "30000" / "10000", Root header "30000 documents" | Five Library count sites passed a raw number to `AnimatedNumber` (UI-SPEC "Numbers": every count ≥ 1,000 is grouped via `n.toLocaleString()`) | **FIXED** `c96a0909e`: NavRow, FolderDetail (×2), Root header, IngestionTab tile, ViewCard totals. RED: the `FolderDetail284` case failed with the old lines (`expected '…10000 documents…' to contain '10,000 documents'`); restored md5-identical; pin 5 → 6. |
| 2 | A @50k | Root header painted **"-17,721 documents"**, then "9,879", on its way to 30,000 | `AnimatedNumber`'s rAF step used the frame timestamp, which can precede the `performance.now()` the effect took as `startTime` when the main thread is busy. A negative progress gives a negative cubic ease. This bug predates 284; the 50k main-thread load exposed it | **FIXED** `bb47f34ce`: `easedProgress` is clamped to [0, 1] and lives in its own module (react-refresh). RED: unclamped returned `-0.5879629629629632` (×30,000 ≈ the −17,721 seen); restored md5-identical; new suite pinned (3). |
| 3 | A / B / F | Mid-animation readings such as "9,900–9,922 of 9,948", and after data a single "0–0 of 0" / "0 documents" frame as the count-up starts | `AnimatedNumber` counts up from 0 on mount, and the pager animates start/end | **Recorded, not changed.** These are frames of the shipped count-up animation AFTER the rows rendered (the observer saw the row text already present), not an empty state. The settled values are the ones read above. |
| 4 | View paging (F) | Each page change issued a second `resolve?count_only=true&include_archived=true` | The view's archived-hidden count is re-read per page | **Recorded.** Correct but redundant: the count does not change with the offset. Not a criterion. |

## R-09 — production `max_rows` (read-only Supabase MCP, no write)

- `pg_roles` / `pg_db_role_setting`: no `pgrst.*` key anywhere. `authenticator`: `statement_timeout=8s`, `lock_timeout=8s`; `authenticated`: `statement_timeout=8s`; `anon`: `statement_timeout=3s`. `current_setting('pgrst.db_max_rows', true)` → NULL.
- **Verdict: not readable through SQL.** On hosted Supabase, "Max rows" is a dashboard API setting held in PostgREST's own configuration. **Not changed**: raising it is not a fix (R-09).
- **Finding:** production gives `authenticated` an **8 s statement timeout**. BEFORE, Find page 1 at 50k took 16.9 s, so at that size Find would have FAILED in production rather than been slow.
- `to_regclass('public.library_documents')` → NULL. **Migration 207 is not in production** (expected; it is OWED before the backend deploy). Production holds 178 documents; the largest single library is 178.

## AFTER measurement

See `284-MEASUREMENTS.md` → "AFTER — verdict per D-22 criterion". Summary:
- **MET:** totals equal `count(*)` at both sizes, on every surface; bytes are flat (1.00×); the summary is under 500 ms.
- **PARTIAL:** first-page time. Big and the summary are within 1.5×; **Root (2.54×) and Find (2.59×) are not**. The cause is an exact count plus a top-25 sort over every latest row the user owns, both linear in N. Planted as **SEED-357** with the likely index fix.
- **First page < 500 ms at 50k:** 470.7 ms on a quiet host; 622–680 ms while an unrelated process held a core.

## Teardown

`seed-scale-284.py --teardown --lock-held` → "dev account documents: before=294 after=294" (latest 286 plus older versions). Both synthetic users, their org, folders, documents and the F saved view (`document_views.user_id` cascades) are removed. `--status` → owner null, peer null. Local-DB lock released.

## Owed

- **Production, in this order:** apply migration **207** → migration **208** (VERIFY must read 16/16, run with its `SET search_path` line; on a lock timeout re-paste, never widen it) → `get_advisors(security)` → deploy the backend → deploy the frontend (284-03 must ship with the backend: the frontend reads the envelope, and the page clients keep the legacy-array tolerance for one release).
- The v4.6 public changelog entry for the `GET /documents` breaking change (R-06).
- Remove the legacy-array tolerance in `lib/api/documents.ts` one release after the production deploy.
- ~~**SEED-357** — operator decision~~ → the operator chose to add the index in this phase: **answered by 284-06 (migration 208)**.

## After migration 208 (orchestrator, 2026-10-16)

- **E re-checked under the 208 view** (default Chrome context, `fhdmrd@gmail.com`, active org `22f9c615-…`): header "200 documents", pager "1–25 of 200", CHUNKS "8,042 across 286 documents", 25 rows, no failure copy. These are the same numbers as before 208.
- **Local incident during 284-06 (recorded, no production impact):** the executor's first version of the 208 view broke PostgREST embeds (`PGRST200`), so the Library list on the operator's local :8000 returned 500 for about 3 minutes. It reverted to 207's view, fixed the cause (`id` read through `LEFT JOIN documents o`) and re-applied. The final view is row-for-row identical to 207 for all 43 local users (row count plus an md5 over every column). The 284 live suites pass (43).

## G-4 A and B re-driven on the 208 view (orchestrator, 2026-10-16)

See `284-VERIFICATION.md` → "Human item — resolved". A @50k, B @50k and A @10k all PASS on 208. Browser click → rows medians: 2,772 ms (50k) and 2,646 ms (10k), a ratio of 1.05x, against ~3.2-3.47 s at 50k before 208. B's last page again ends on `scale284-00017.pdf`. Teardown 294 → 294.
