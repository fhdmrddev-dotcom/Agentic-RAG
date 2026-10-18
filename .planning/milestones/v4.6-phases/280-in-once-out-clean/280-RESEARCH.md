# Phase 280: In Once, Out Clean - Research

**Researched:** 2026-10-14 (develop @ `ae85f4737`)
**Domain:** document minting (dedup/versioning races), Microsoft Graph adapter hardening, storage-byte purge ordering, postgrest `maybe_single()` 0-row semantics, retention/artifact policy record
**Confidence:** HIGH for code facts (every one re-measured at HEAD with file:line), MEDIUM for the live OneDrive drive plan (depends on an operator credential and on Graph behaviour not driven here)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Measured at discuss (2026-10-14, develop after `525695de1`): the starting point
- **M-1 FIX-02 confirmed in code.**
  - The function is `mint_document_row` (`backend/app/services/ingest_splice.py:126`, async wrapper `:353`). It is several separate supabase-py calls with no transaction.
  - The dedup SELECT filters `status='completed'` (`:221-239`), while the unique index it races is `documents_dedup_idx … WHERE status <> 'failed'` (`supabase/migrations/196_documents_dedup_idx_org_scoped.sql:29-36`).
  - The retire UPDATE (`:262-269`) runs **before** the INSERT (`:307`).
  - On 23505, `on_conflict="raise"` returns a 409 (`:346-349`), and `"link"` can return the copy the function just retired (`:319-345`).
- **M-2 FIX-03/04/05 fixed in code and pinned** (`backend/app/services/sources/adapters/microsoft_graph.py`):
  - The cursor is refused with `ValueError` (`:203-222`).
  - The search term is OData-doubled, then `quote(safe="")` (`:320-321`).
  - Folder paths are `unquote`d, or `None` for a drive-internal id (`:125-138`).
  - Pins: `backend/tests/unit/services/sources/test_238_05_cursor_is_refused_not_guessed.py` and `test_238_06_search_url_and_folder_path.py`.
  - The comment at `:225-229` is stale: it says the term rides in `params`.
  - `_children_url` (`:168`) interpolates `folder_id` raw. The researcher judges whether that is reachable with hostile input; if it is, it falls under FIX-04.
  - Live M-9 (`238-VERIFICATION.md:223`) is still ⛔.
- **M-3 CR-01 confirmed in code, not yet driven.** The folder check selects `id, user_id` and compares only `user_id` (`ingest_splice.py:170`). `/upload` passes `folder_id` straight through (`backend/app/api/documents.py:614-621`).
- **M-4 DEBT-11 is 21 sites, not 1.**
  - Installed postgrest 2.29.0 returns `None` from `maybe_single().execute()` on 0 rows. The sites:
    - `documents.py`: `:833`, `:1230`, `:1293`, `:1667`, `:1829`, `:1935`, `:1948`
    - `folders.py`: `:103`, `:229`
    - `skills.py`: `:517`, `:563`, `:686`, `:730`, `:785`, `:815`
    - `takeoff.py`: `:44`, `:75`, `:112`, `:172`, `:195`
    - `ingest_splice.py`: `:165` (the minter's folder check)
  - The patch at `backend/app/main.py:66-88` targets `SyncSingleRequestBuilder` and does not cover `maybe_single`.
- **M-5 DEBT-10 confirmed.**
  - Both doors run hold guard → `documents.delete().in_(…)` and select no `file_path`:
    - `DELETE /watches/{id}?purge_documents=true`: `backend/app/api/sources.py:306-349`
    - `POST /watches/{id}/purge`: `:438-498`
  - There is no shared bytes helper. `documents.py:1846-1882` removes bytes inline, and `retention/disposition.py:621 _remove_bytes` is private.
- **M-6 DEBT-08 facts.**
  - `message_artifacts` (`supabase/migrations/202_message_artifacts.sql:60-77`) has **no FK to documents**. Its source is `caption` jsonb `{tool, document: <filename string>, page}` (`backend/app/services/show_artifact_tool.py:257-284`). Its data is `spec.rows` (ART-03).
  - The table is immutable via a trigger.
  - Disposition deletes `documents` rows (cascades chunks/tables/images), then bytes, and never touches `message_artifacts`.
  - The frontend caption is plain text (`frontend/src/components/chat/artifacts/captionModel.ts:59-64`), not a link.
- **M-7 No migration needed by any decision below.** The latest is `206_retention_hold_hardening.sql`. If research finds one is needed after all, it takes `207` after running `ls supabase/migrations` again.

#### Same-bytes upload (FIX-02)
- **D-01:** A second upload of the same bytes while a non-`failed` copy exists returns **200 with the existing (in-flight) document and `already_in_library: true`**. There is no 409 and nothing is retired. This matches Phase 274's Save-to-Library behaviour (`274-REVIEW.md` fix log). The response field is additive. The frontend may show an "already in your Library" note using existing copy and toast patterns; that is optional and adds no new surface.
- **D-02:** The dedup check's status filter must match the unique index it races: it sees every non-`failed` row, scoped exactly as `documents_dedup_idx` is (org, user, hash, folder). A 23505 from a concurrent insert resolves to the winning row and returns that row with the D-01 flag, never a 409 and never a retired row.
- **D-03:** **Insert first, then retire.** A real new version (same filename, different bytes) retires the previous latest **only after** the new row's INSERT succeeds, and the retire excludes the new row's id. A failed insert retires nothing. A brief window in which two rows read `is_latest = true` is accepted. There is **no migration** and no RPC.
- **D-04:** The fix lives **inside the shared minter**, so all 7 callers get it:
  - `api/documents.py:614` (upload)
  - `services/watch_service.py:344`, `:422`
  - `services/sources/import_service.py:237`
  - `api/workspace_promote.py:215` (via `mint_or_link`)
  - `services/expert_install_service.py:603`
  - `services/email_attachments.py:357` (sync)

  Callers that pass `on_conflict="raise"` (upload, source import) get the existing copy for a **same-bytes** collision. A RED-first test drives two concurrent uploads against the live local stack (SC#1), and a second test proves a watch-path caller goes through the same fixed path.
- **D-05:** **CR-01: drive it once, then file it and fix it here.**
  - Drive it with a two-org user doing `POST /documents/upload` with a `folder_id` from the other org (reference: dev account is in two orgs).
  - If it reproduces, **file a new `BUG-2610xx` report first** (its own record, never folded silently), then fix it in this phase: the minter's folder check also requires the folder's `org_id` to equal the minting org.
  - The fix answers 404 with the same body as "no such folder", so it is not an existence oracle.
  - If it does not reproduce, record the drive as evidence and file nothing.

#### Charts after retention disposal (DEBT-08)
- **D-06: KEEP. Retention disposal does not remove `message_artifacts` rows.** Recorded reasons:
  1. An artifact is a **conversation record**, governed by thread deletion (it cascades on `threads` and `auth.users`). This is the same rule that already applies to the assistant's reply text quoting that document, which retention also leaves in place.
  2. There is no reliable link to enforce anything else. The only reference is a filename string in `caption`, so matching by filename is ambiguous across folders and versions, and no `document_id` exists on old rows.
  3. Artifacts are immutable by trigger (ART-03 keeps the rows so a follow-up can re-encode the chart).
  4. The caption renders plain text, never a link, so nothing renders as a broken reference.

  **No code change and no migration.** Satisfying SC#5's "if the decision requires enforcement" arm is not applicable.
- **D-07:** The decision is written in **two places, in the same commit**:
  - one plain paragraph in `docs/public/administer/org/retention.md`, under a "What retention does not remove" heading or similar, covering chat history including charts and quoted replies, which go away when the thread is deleted;
  - an internal decision record in `docs/`. The planner picks the file: an existing retention/ART doc if one fits, else a short new `docs/` note.

  ⛔ The SC#5 failure mode "says keep and the artifact then renders a broken reference with no explanation" must be checked by **rendering a chart whose source was disposed** (local drive, or a component test asserting the rendered caption content).

#### 404 sweep (DEBT-11)
- **D-08:** Fix **all 21** sites with **one tiny shared helper**. Shape (the planner names it): take the `maybe_single()` result and return its row or `None` without touching `.data` on `None`, so each site's existing `404` branch is reached.
  - Each site changes by about one line, so `skills.py`, `folders.py` and `documents.py` are **honoured by construction** (G-5).
  - A grep/AST fence pins **zero** remaining `maybe_single()` → `.data` sites with no None guard, across `backend/app`. It is driven RED first against a planted site.
- **D-09:** `DELETE /documents/{id}` for another user's/org's row and for a nonexistent id answer the **identical** `404 {"detail": "Document not found"}` with CORS headers. This is not an existence oracle, and the existing `user_id` filter already makes both cases the same 0-row miss.
  - ⛔ The 275 D-32 fence pins **no new `if`** in the delete handler. The helper must reuse the existing `if not …: raise 404` branch, or the plan records the fence change explicitly with the reason.
- **D-10:** The dead patch at `backend/app/main.py:66-88`: the researcher measures whether it fires for **any** call, including `.single()`. If it is proven dead, delete it with the evidence in the commit. If it is still live for `.single()`, keep it and add a comment stating that it does not cover `maybe_single`.

#### Purge bytes + `sources.py` extraction (DEBT-10, G-5). Claude's recommendation, accepted by the operator
- **D-11:** A **single shared delete helper** lives in a new service module (the planner names it), with the order **hold guard → delete rows → remove bytes** (275 D-38 / T-275-12, binding).
  - It selects `file_path` **before** the row delete and removes bytes **only after** the row delete succeeds.
  - A storage remove failure is logged, not raised, matching the Library delete.
  - A held document refuses and **keeps its bytes**.
  - The bytes step lifts `retention/disposition.py:621 _remove_bytes` (made shared), not a third copy.
- **D-12:** Both purge doors in `sources.py` move their purge bodies into that helper. **This is the "extraction FIRST" that `sources.py`'s ledger section requires**, done as the first task, behaviour-preserving apart from adding the bytes step, before any fix lands on that file.
  - The Library delete in `documents.py` **keeps its own inline code** (the D-32 fence). Moving it onto the helper is out of scope.
- **D-13:** SC#3 evidence is a storage listing that shows **no object left** for a purged document (both doors), plus a held-document drive that shows refusal and bytes still present. A source fence in the style of `test_275_delete_paths.py::test_every_storage_remove_in_delete_document_follows_its_row_delete` pins the order in the helper.

#### OneDrive live re-drive (FIX-03/04/05 SC#2)
- **D-14:** The test folder runs the **shipped config untouched**: the watch listing uses `page_size=100` (`microsoft_graph.py:272`). Claude generates a local folder **`Team Docs`** in the scratchpad with **105 tiny files**, including a subfolder **`Q3 Plans`** and a filename with a space. The operator drags it into OneDrive once. There is **no page-size override and no test-only knob**.
- **D-15:** **Claude drives, and the operator approves** the drive before it runs: connect or point a watch at `/Team Docs`, run the import, then read the DB.
  - Pass requires **all** of the following:
    - all 105 files are imported (count, not "some");
    - stored paths read `/Team Docs/…` and `/Team Docs/Q3 Plans/…`, decoded;
    - a `path contains '/Team Docs/'` classification rule matches;
    - the run reports success and the listing is `complete`.
  - The local Microsoft connection exists (`connector_connections service_id='microsoft'`, last ok 2026-09-07), but the token may need a refresh. If the credential cannot be made to work, the row is recorded ⛔ with the reason and is **never omitted** (SC#2). Passing on test doubles alone is a listed failure mode.
- **D-16:** After a pass, flip `onedrive-adapter-silently-truncates-and-mismatches-folder-paths.md` (BUG-260910-04) to `closed` with `verified_closed_by`, and update `238-VERIFICATION.md` M-9's status line.
- **D-17:** Stale comment fix-ups ride along: `microsoft_graph.py:225-229`, and the `_children_url` judgment from M-2.

#### Gates, security and guardrails (carried from ROADMAP / milestone rules)
- **D-18:** **security_enforcement** is on: purge, delete and the CR-01 folder check are data-protection paths. The threat model covers T-275-12 ordering, the existence-oracle rule (D-05, D-09), and hold refusal keeping bytes.
- **D-19:** **G-5 at discuss.**
  - Triples measured 2026-10-14:
    - `api/documents.py` 93/36/2531: FIRES, honoured by construction (D-08 one-liners only; delete fence respected)
    - `ingest_splice.py` 19/7/930: FIRES, honoured by construction (the minter edits are confined to `mint_document_row`'s dedup, retire and folder steps; its named seam is the queue step list, which is untouched)
    - `api/sources.py` 9/3/706: FIRES, so **extraction FIRST**, discharged by D-12
    - `microsoft_graph.py` 7/4/460: now FIRES, with comment-only edits plus possibly `_children_url`
    - `retention/disposition.py` 3/1/845: young; `_remove_bytes` is lifted
    - `skills.py`, `folders.py`, `takeoff.py`: D-08 one-liners
  - The ledger rows for `microsoft_graph.py` (reads 3/2/376) and `disposition.py` (reads 1/1/722) are **stale**. Re-derive and update them in `docs/HOT-FILE-LEDGER.md` and the CLAUDE.md FIRING table, using the same-commit sync rule.
  - Run `node scripts/check-hot-file-ledger.cjs` once plans exist.
- **D-20:** The closed core is recounted against base: 7 phase types / 1 emitter / 30 tools. **No phase adds a tool, a phase type, an emitter or a validator kind.**
- **D-21:** Baseline gates: backend ≤ 71 failed with the failing SET equal to base; vitest count gate OK; `tsc -p tsconfig.app.json` set diff against base; `check-claude-md-size.cjs` with no warning.
- **D-22:** Deploy parity: no migration is expected. `WATCH_PROCESS_ENABLED` and `RETENTION_SWEEP_ENABLED` stay as they are in production.
- **D-23:** Plans target **4** (G-8): same-bytes minter + CR-01 · Graph adapter pins + live re-drive · purge helper extraction + bytes + 404 sweep · DEBT-08 record + docs + close.

### Claude's Discretion
- The helper names and module paths (D-08, D-11), the internal docs file for D-07, and whether the 404 helper lives next to the existing supabase utilities.
- Whether the frontend shows a note for `already_in_library` (D-01), using existing toast/copy patterns only.
- The exact mechanism for the "concurrent uploads" RED test (asyncio gather against the live local stack vs two HTTP clients), provided it hits the real DB unique index.

### Deferred Ideas (OUT OF SCOPE)
- Moving the Library delete (`documents.py`) onto the shared delete helper: blocked by the 275 D-32 fence. Re-open when a phase is allowed to change that handler's structure.
- A `document_id` on `message_artifacts` (which would make future enforcement possible): a new capability, not needed by D-06. Re-open if a customer or data-subject request (SEED-072) needs artifacts erased with their source.
- Seeds sweep: `node scripts/check-seeds-register.cjs --phase 280` matched **0** at discuss, because no PLAN.md existed yet (the gate states that this is a fact about the phase, not a clean sweep). **Re-run it after planning**, against the real `files_modified`.
- Reviewed Todos (not folded): `spike-nl-workflow-authoring.md` — unrelated, a new capability; the v4.6 repair-only rule forbids it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-02 | Same bytes uploaded while the first copy is still indexing never retires it and never 409s; exactly one copy visible in Library and search | §Pattern 1 (minter sequence), §Pitfalls 1-4, the **three CONTEXT corrections** in Summary (cross-folder scope, mutual-retire race, `DocumentResponse` strips the flag), live-test harness in §Validation |
| FIX-03 | A OneDrive folder larger than one page imports every page or fails loudly | Pins present and green (17 passed); ⚠ the watch lists at `page_size=30`, NOT 100, and is NON-recursive — the D-14/D-15 drive plan must change (§Pattern 4) |
| FIX-04 | A OneDrive search query cannot alter the Graph request path | Search pinned; ⚠ `_children_url` AND `read_file` interpolate user-supplied ids raw and httpx collapses `../` — measured reachable (§Pattern 5) |
| FIX-05 | Folder paths use one encoding so a rule written against the displayed path matches | `_folder_path` unquotes (pinned); live check reads `documents.metadata->'source'->>'path'` + `metadata->'_classification'` (§Pattern 4) |
| DEBT-08 | Recorded decision for `message_artifacts` on disposal | Facts re-verified (no FK, caption plain text, `artifact-caption` testid); public doc already has a "Known limits" line to extend; `docs/history/v4.5-find-it-show-it.md` is the internal home candidate (§Pattern 7) |
| DEBT-10 | Both watch purge paths remove stored bytes | Doors re-read; `_remove_bytes` is at `disposition.py:507` (not `:621`); DELETE returns `representation` by default so paths can come from the rows actually deleted (§Pattern 6) |
| DEBT-11 | `DELETE /documents/{id}` → 404 not 500 | AST audit of all **117** `maybe_single()` sites: **22** unguarded (CONTEXT's 21 + `ingest_splice.py:422`); main.py patch proven dead (§Pattern 3) |
</phase_requirements>

## Summary

Every CONTEXT "M-" fact was re-measured against HEAD `ae85f4737`. Most hold. Several do not, and three of them change what the planner must write.

**The critical question — does any other unique index make "insert first" fail? No.** The live local database (`pg_indexes`, read 2026-10-14) has exactly three unique indexes on `public.documents`: `documents_pkey (id)`, `documents_completed_hash_unique_idx (org_id, user_id, content_hash) WHERE content_hash IS NOT NULL AND status='completed'`, and `documents_dedup_idx (org_id, user_id, content_hash, COALESCE(folder_id, 0…0)) WHERE status <> 'failed'`. `documents_latest_idx (user_id, filename, is_latest) WHERE is_latest` is **not unique** (`full-schema.sql:5183`). So a new version can be inserted while the old one still reads `is_latest = true`. **D-03 stands; no migration 207 is needed.** [VERIFIED: live pg_indexes + full-schema.sql]

**But D-02 and D-03 as literally written leave FIX-02 open, and a fifth measured fact changes D-14/D-15:**

1. **D-02's folder scope is too narrow (contradiction).** The dedup check that already exists for `completed` copies is folder-agnostic, because `documents_completed_hash_unique_idx` has no folder column. If the new in-flight check is folder-scoped (as D-02 says, "exactly as `documents_dedup_idx`"), then the same bytes uploaded to a **different folder** while the first copy is pending still breaks things. The insert succeeds, because `documents_dedup_idx` is keyed per folder. Versioning is by filename at user scope, so the in-flight first copy is **retired**. When both rows complete, the second completion 23505s on the completed-hash index and that row goes `failed`. The result is the same FIX-02 failure: the first copy retired, the second failed. **Recommendation:** make the in-flight leg the same as the already-shipped `workspace_promote.find_existing_copy` live leg: `(user, hash, org if passed, status <> 'failed', is_latest = true)`, with **any folder**. That is the union of what both indexes eventually enforce. Scope the 23505 re-query exactly as the index that fired (folder-scoped).
2. **D-03's "retire excludes the new row's id" allows mutual retirement.** Two concurrent new versions (different bytes, same filename) both read `max(version)=1` and both insert v2. If each one retires "same filename, id ≠ mine", A retires B and B retires A, which leaves **zero** latest rows. **Recommendation:** retire `is_latest=true AND version_number < next_version` (keep `id ≠ new_id` as a belt). Scope the retire by the **inserted row's actual `org_id`** (`result.data[0]["org_id"]`, which the trigger stamps). This also closes a latent cross-org retire on `/upload`, which passes `org_id=None` today, so its retire currently touches same-named files in every org the user belongs to.
3. **The `already_in_library` flag would be silently stripped.** `/upload` is declared `response_model=DocumentResponse` (`documents.py:556`), and `DocumentResponse` (`models/document.py:30`) has no such field and no `extra="allow"`. FastAPI filters unknown keys. The plan needs one optional field `already_in_library: bool | None = None` (`models/document.py` FIRES at 9 phases; one defaulted field is the 217/275 precedent). **The frontend needs nothing:** `uploadDocument` already maps HTTP 200 to `isDuplicate` (`frontend/src/lib/api/documents.ts:52`), and `DocumentUpload.tsx:219,325` already renders "already in your Library".
4. **The watch does not list the way D-14/D-15 assume.** `watch_service.py:269` calls `adapter.list_files(conn, folder_id=…, recursive=False, page_token=…)` with **no `page_size`**, so it runs at the adapter default of **30** (`microsoft_graph.py:297`). `:272`'s `page_size=100` is `browse()`, the folder picker. The adapter **ignores `recursive`** (`preview_service.py:305-307` records this), so a watch on `/Team Docs` **never imports `/Team Docs/Q3 Plans/*`**. Recursion exists only in the manual import walk (`preview_service.walk_source_files`, `page_size=200`, which would fit 105 files on ONE page and so would not exercise pagination). D-15's pass criteria cannot all be met by one watch on `/Team Docs`. See §Pattern 4 for a drive that meets every criterion with the shipped config untouched.
5. **FIX-04 has a live sibling.** `_children_url` (`:168`) and `read_file` (`:391`, `items/{file_id}`) interpolate ids that arrive from the client: the browse query param, `WatchCreateRequest.source_folder_id: str`, and import file ids. **httpx 0.28.1 collapses dot segments**, measured: `x/../../drives/D1/root` became `/v1.0/me/drive/drives/D1/root/children`. A `?` turns the `children` call into an item-metadata call. The token is the connection's, so an org-visible connection lends its owner's token to the path. This is reachable, so it falls under FIX-04 (D-17).

Smaller corrections: `_remove_bytes` is at `disposition.py:507` (its caller is `:480`); `_confirm_delete` is at `:592`. There are **22** unguarded `maybe_single` sites, not 21: `ingest_splice.py:422` in `splice_document` is the extra one, functionally masked by a broad `except`. The CR-01 drive **cannot reproduce through the dev account's UI** as-is. Folders are also org-stamped by the same `LIMIT 1` trigger, and `fhdmrd.dev` owns 0 folders. It needs a seeded folder in the non-default org (§Pattern 2).

**Primary recommendation:** Land the 404 helper and the purge extraction first (wave 1, alongside the stubbed Graph-adapter hardening). Then rewrite the minter (wave 2, alone, because its live tests mutate the DB). Close with the live OneDrive drive and the DEBT-08 record (wave 3). No migration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Same-bytes dedup / versioning (FIX-02) | API / Backend (`ingest_splice.mint_document_row`) | Database (`documents_dedup_idx`, `documents_completed_hash_unique_idx` are the real arbiters) | One shared minter serves all 7 call sites; the DB index is the only atomic guarantee, so app code must resolve its 23505 rather than pre-empt it |
| CR-01 folder/org consistency | API / Backend (minter folder check) | Database (`documents` INSERT RLS requires `org_id ∈ current_user_org_ids()`) | The app must 404 before RLS turns a mismatch into a raw 42501/500 |
| Graph request shaping (FIX-03/04/05) | API / Backend (adapter) | External (Graph) | Encoding/refusal happens before `send_pinned_http`; egress pins host only (`egress.py:304`) |
| Purge bytes (DEBT-10) | API / Backend (new purge service) | Storage (`storage.objects` DELETE policy refuses a path that still backs a row, mig 206) | Order guard → rows → bytes is app-enforced; storage RLS is defence-in-depth |
| 404 on 0 rows (DEBT-11) | API / Backend (`app/utils/db.py` helper) | — | Library behaviour (postgrest 2.29 returns `None`) |
| Artifact rows on disposal (DEBT-08) | Database (no FK, immutable rows) | Browser (caption renders plain text) | Decision is "keep"; the only surface that could break is the caption render |

## Standard Stack

No new packages. Everything below is already installed and was version-checked in `backend/venv`.

| Library | Version (measured) | Purpose | Note |
|---------|---------|---------|------|
| postgrest (py) | 2.29.0 | PostgREST builder | `SyncMaybeSingleRequestBuilder.execute` returns **`None`** on 0 rows (`_sync/request_builder.py:150-156`); it is a separate class from `SyncSingleRequestBuilder` (`:89`) [VERIFIED: installed source] |
| supabase (py) | 2.29.0 | client | `.delete()` defaults `returning=ReturnMethod.representation` (`request_builder.py:434-438`), so deleted rows come back [VERIFIED: installed source] |
| storage3 | 2.29.0 | storage client | `remove(paths)` → `DELETE /object/{bucket}` with `{"prefixes": paths}`, returns the JSON list (`_sync/file_api.py:360-374`) [VERIFIED: installed source] |
| httpx | 0.28.1 | transport | normalises dot segments in an absolute URL path (measured in venv) [VERIFIED: local run] |

## Package Legitimacy Audit

Not applicable: this phase installs **no** external packages (backend or frontend). slopcheck was not run because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
 IN (FIX-02 / CR-01)
 POST /documents/upload ─┐
 watch_service (×2) ─────┤
 import_service ─────────┤      mint_document_row (ingest_splice.py)
 workspace_promote ──────┼──►  1 folder check  (select id,user_id,org_id; 404 / 403 / org-mismatch 404)
 expert_install ─────────┤     2 hash
 email_attachments ──────┘     3a completed dup (org,user,hash, any folder) ──hit──► MintResult(dup)
                               3b in-flight dup (org,user,hash,non-failed,is_latest, any folder) ──hit──► MintResult(dup)
                               4 next_version = max(version)+1 (read only, no write)
                               5 INSERT pending ──23505──► re-query (org,user,hash,folder,non-failed) ─► MintResult(dup)
                                     │ ok                                   └─ nothing found ─► 409 (fallback only)
                                     ▼
                               6 RETIRE is_latest=false WHERE scope AND id<>new AND version<new AND org=new.org
                                     ▼
                     /upload: dup → 200 {…doc, already_in_library:true} · new → storage upload → enqueue → 201

 OUT (DEBT-10)
 DELETE /sources/watches/{id}?purge ─┐                              ┌─► hold_guard.assert_none_held  (409, nothing removed)
 POST   /sources/watches/{id}/purge ─┴─► purge_documents(helper) ──┼─► map_hold_refusal: documents.delete().in_(ids) → deleted rows
                                                                    └─► remove_document_bytes(deleted rows' file_path) (log, never raise)
 retention.confirm_batch ─► _confirm_delete (asyncpg tx) ─► remove_document_bytes (lifted, same semantics)

 404 (DEBT-11)
 handler ─► aexec(...maybe_single()) ─► None | resp ─► maybe_row(resp) ─► row | None ─► existing `if not …: 404`
```

### Recommended file layout (new files only)
```
backend/app/utils/db.py                       # + maybe_row(resp) beside aexec/coerce_uid (existing module)
backend/app/services/document_purge.py        # purge_documents(...) + remove_document_bytes(...)
backend/tests/unit/test_280_maybe_row_fence.py       # AST fence + planted-site RED (runs over a --root copy)
backend/tests/unit/test_280_delete_404.py            # None-returning fake → 404 + CORS (TestClient)
backend/tests/unit/test_280_purge_bytes.py           # order/hold/storage-failure cases + helper source fence
backend/tests/unit/test_280_minter_sequence.py       # stubbed: insert-before-retire, in-flight dup, 23505→winner
backend/tests/integration/test_280_same_bytes_live.py # live: sequential RED + gather race + 7 caller signatures
backend/tests/integration/test_280_cr01_two_org_live.py # live: the CR-01 drive (seeded two-org user)
backend/tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py
```

### Pattern 1: The minter sequence (FIX-02, D-01..D-04)

**Current flow (HEAD, `ingest_splice.py`):**

| Step | Lines |
|---|---|
| folder check `maybe_single` | `:160-174` (unguarded `.data` at `:168`) |
| hash | `:177` |
| completed-only dedup | `:221-239` |
| version lookup | `:241-257` |
| **retire before insert** | `:258-268` |
| insert | `:306-314` |
| 23505: `link` re-query | `:319-345` (folder-scoped, can return the just-retired row) |
| 23505: else 409 | `:346-349` |

**Caller matrix (measured):**

| Caller | file:line | client | org_id | on_conflict | version_scope | consumes `is_duplicate` |
|---|---|---|---|---|---|---|
| upload | `api/documents.py:614` | user-JWT | **None** | raise (default) | user | `:624-626` → 200 `doc` |
| watch new | `services/watch_service.py:344` | service | org | link | user | links watch item, no bytes/enqueue |
| watch modified | `watch_service.py:422` | service | org | link | user | skips bytes/enqueue |
| source import | `services/sources/import_service.py:237` | user-JWT | active org | raise (default) | user | `doc["_already_here"]=True` |
| promote | `api/workspace_promote.py:215` (pre-checked by `find_existing_copy` `:150-187`) | user-JWT | active org | link | folder | 200 `already` |
| expert install | `services/expert_install_service.py:603` | service | org | link | folder | raises `ExpertInstallConflict` if the dup is in another folder/org (`:631-636`) |
| email attachment | `services/email_attachments.py:357` (sync) | service | org | link | user | manifest `linked` |

**The only caller change needed is `/upload`:** in its existing `if mint_result.is_duplicate:` branch, return `{**doc, "already_in_library": True}` (no new `if`), plus the optional field on `DocumentResponse`. `import_service` already signals `_already_here`. The behavioural side-effect on `expert_install` is that an **in-flight** copy in another folder now raises `ExpertInstallConflict`, exactly as a completed one already does. That is consistent, but a planner should say so.

**Recommended sequence** (no migration, no RPC):
1. Folder check: `select("id, user_id, org_id")` through `maybe_row`. `None` → 404; `user_id` mismatch → 403 (unchanged); org mismatch → 404 with the identical "Folder not found" body (CR-01, §Pattern 2).
2. Completed dedup: unchanged (`test_266_*` pins its shape).
3. **New in-flight leg:** `.eq(user).eq(content_hash).neq("status","failed").eq("is_latest", True)` + `.eq(org)` when passed, any folder, `order created_at desc limit 1`. A hit returns `MintResult(is_duplicate=True)`. This is `workspace_promote.find_existing_copy`'s live leg, kept in ONE home in the minter. `find_existing_copy` can stay as-is (redundant but harmless; moving it is out of scope).
4. Version lookup: unchanged read.
5. INSERT. On a `"23505"` string match, re-query `(user, hash, non-failed, folder-or-null, org if passed)` → return the winner as a duplicate for **both** `raise` and `link`. Keep the 409 only as the "re-query found nothing" fallback, which `test_266_mint_org_scope.py::test_link_requery_never_adopts_another_orgs_row` still pins.
6. **After a successful insert only:** the retire UPDATE with the existing scope (user, filename, org, folder when `version_scope="folder"`) **plus** `.neq("id", new_id).lt("version_number", next_version)`, and org from the inserted row (`doc["org_id"]`) when `org_id` was not passed. A retire failure must not lose the inserted row: log it, since the row is already minted.

**Accepted residual (record it, do not build around it):** two *truly concurrent* same-bytes uploads into **different** folders both pass every pre-check and both insert (no index conflicts at insert). The one that completes second fails at completion on `documents_completed_hash_unique_idx`. Closing it needs a DB-level constraint, which is a migration and a semantic change, and is out of scope. SC#1's double-click/two-tab case is same-folder, which the index resolves.

### Pattern 2: CR-01, the drive and the fix (D-05)

**Measured facts:**
- `autofill_org_id_by_owner` (`full-schema.sql:54-84`) stamps `org_id` with `SELECT org_id FROM org_members WHERE user_id = … LIMIT 1` and **no ORDER BY**. **Folders use the same trigger** (`full-schema.sql:6492`), and `create_folder` passes no org (`folders.py:76-84`). So for a two-org user, a folder made through the API and a document uploaded through `/upload` both land in the *same* `LIMIT 1` org. **The plain UI path cannot produce a mismatch.**
- The dev account `fhdmrd.dev` (`e6dc45ca`) has memberships in heap order `c1f18150` (org-admin), then `22f9c615` (member). The trigger picks `c1f18150`, and the account **owns 0 folders** [VERIFIED: local DB read].
- A mismatch arises only when the uploader owns a folder whose `org_id` was stamped explicitly. Examples: an Expert install folder (`expert_install_service._ensure_folder`, explicit org, `:405-453`), or a folder in an org the user has since left.
- Local data has **0** documents whose folder is in another org and **0** watches whose library folder is in another org. 4 users are in 2+ orgs.

**Drive (reproducible, no dev-data mutation):** write a live integration test using `tests/integration/_271_gotrue_users.py`:
- create a GoTrue user with membership A;
- add membership B;
- read the trigger's pick (`SELECT org_id FROM org_members WHERE user_id=$1 LIMIT 1`);
- seed via asyncpg a folder owned by the user with `org_id` = the **other** org;
- call `async_mint_document_row` with `user_client(token)`, `folder_id=<that folder>`, `org_id=None` (the `/upload` shape), and read the minted row's `org_id`.

`org_id ≠ folder.org_id` means it reproduces. In that case the plan files `BUG-2610xx` first, then fixes. A curl drive on the running backend is optional evidence; it needs the same seeded folder.

**Fix shape (needs a ruling; Open Question 1):** D-05 says "folder org must equal the minting org". For callers that pass `org_id` (watch, import, promote, expert, email), that is `folder.org_id == org_id`, else 404. For `/upload` (`org_id=None`) the minting org is *undefined in Python*, because the trigger decides it non-deterministically. **Recommended:** when `org_id is None` and a folder is given, verify the caller is a member of `folder.org_id`, then mint with `org_id = folder.org_id` explicitly (the trigger then no-ops). A non-member gets 404 "Folder not found". Without the pre-check, the documents INSERT RLS (`full-schema.sql:8255`, `org_id IN current_user_org_ids()`) would surface a raw 42501 as a 500. `test_266_mint_org_scope.py::test_upload_path_insert_payload_carries_no_org_id` has no folder, so it stays green.

### Pattern 3: The 404 helper and the fence (DEBT-11, D-08..D-10)

**AST audit of `backend/app` (117 `maybe_single()` calls):** 70 guarded, 7 never read `.data` directly (use `getattr`), 1 factory (`harness/skill_snapshot.py:70` returns the builder; its callers guard `resp.data if resp is not None`), and **22 unguarded**:

| File | Unguarded site (call line → first `.data` read) | Handler |
|---|---|---|
| `api/documents.py` | 829→836 | `list_document_versions` GET `/{id}/versions` |
| | 1226→1233 | `restore_document_version` POST `/{id}/restore` |
| | 1288→1296 | `reingest_document` POST `/{id}/reingest` |
| | 1651→1667 | `reextract_document` POST `/{id}/reextract` (the `try` covers the call, not the `.data` read) |
| | **1825→1831** | **`delete_document` DELETE `/{id}`** (the BUG-261012-02 site) |
| | 1931→1938 | `move_document` PATCH `/{id}/move` |
| | 1944→1951 | `move_document` PATCH `/{id}/move` |
| `api/folders.py` | 99→106 | `rename_folder` |
| | 225→232 | `toggle_global` |
| `api/skills.py` | 513→520 | `toggle_enabled` |
| | 559→566 | `toggle_global` |
| | 682→689 | `list_skill_files` |
| | 726→733 | `upload_skill_file` |
| | 781→788 | `delete_skill_file` |
| | 811→818 | `export_skill` |
| `api/takeoff.py` | 40→47 | `get_document_takeoff` |
| | 71→78 | `match_document_takeoff` |
| | 108→115 | `match_document_takeoff` |
| | 168→175 | `resolve_document_takeoff_item` |
| | 191→198 | `resolve_document_takeoff_item` |
| `services/ingest_splice.py` | 162→168 | minter folder check |
| | **422→423** | `splice_document` (NEW vs CONTEXT; inside `try/except Exception`, so it degrades to a warning, not a 500; fix it anyway so the fence has no exemption) |

Re-run with the scratch classifier pattern (AST: find the `Assign` wrapping `.maybe_single()`, then check whether the first `NAME.data` is preceded by a None-guard on `NAME`). The fence should be a real AST implementation of that rule.

**Helper (recommended):** `app/utils/db.py::maybe_row(resp) -> dict | None`, which returns `resp.data if resp is not None else None`. Each site becomes, e.g.:
```python
doc = maybe_row(await aexec(supabase.table("documents")...maybe_single()))
if not doc:
    raise HTTPException(status_code=404, detail="Document not found")
target = doc
```
or keeps the variable name and just replaces `doc_resp.data` reads with the helper's result.

⚠ **D-32 fence (`tests/unit/test_275_delete_paths.py:603-615`)** counts `ast.If` nodes in `delete_document` against `PHASE_BASE b41d51d6…` (base 8 Ifs now). The helper call adds no `If`, and an `IfExp` is not `ast.If`. `test_every_storage_remove_in_delete_document_follows_its_row_delete` counts `.delete`/`.remove` calls (2/2), so it is unaffected. The fakes in that file return `_Resp(None)` and never `None`, so they **cannot** see this bug. The DEBT-11 RED test needs a fake whose `.execute()` returns `None`, mirroring postgrest 2.29.

**Fence design:**
- An AST scan over `backend/app` taking a `--root`-style path argument (the `check-docs-coverage.cjs --root` precedent), so the RED drive plants a site in a **temp copy** and never edits app code.
- Rule: every `.maybe_single()` result bound to a name is either wrapped in `maybe_row(...)` or has its first `.data` read dominated by a None-guard on that name (`X.data if X`, `X and X.data`, `not X or`, `X is None`/`is not None`, `getattr(X, "data"`).
- A **non-vacuity floor** (≥ 100 sites found).
- A **named allowlist** with reasons for the factory form (`skill_snapshot._resolve_skill_query`).
- Assert the unguarded set is **empty**.

**main.py:66-88 patch is provably dead (D-10 → delete it):**
1. It wraps `SyncSingleRequestBuilder.execute` only. `maybe_single()` returns `SyncMaybeSingleRequestBuilder`, a separate class.
2. It converts only `APIError` with `code == "204"`, and `grep -rn '"204"\|204' postgrest/` in the venv returns **nothing**. `.single()` on 0 rows yields PostgREST's HTTP 406 / `PGRST116` [CITED: postgrest-py source; PostgREST error code PGRST116 per PostgREST docs], so the wrapper always re-raises unchanged.
3. Nothing in `app/` or `tests/` references the patch, except the docstring at `app/utils/db.py:6-9`, which must be updated in the same commit.

Behaviour with and without it is identical, so the deletion is behaviour-neutral. `main.py` FIRES (89/64/1002); a pure deletion is honoured by construction.

**CORS on 404:** the 500 lacks CORS headers because an unhandled exception is turned into a response by Starlette's `ServerErrorMiddleware`, which sits outside every `add_middleware` layer (CORS is added outermost of the user stack at `main.py:868`). An `HTTPException` 404 is produced inside `ExceptionMiddleware`, so it passes back out through `CORSMiddleware` [ASSUMED: Starlette middleware ordering, standard behaviour; prove it in the test]. Test it: `TestClient(app, raise_server_exceptions=False)`, `Origin` set to an allowed origin, then assert `404` + `{"detail":"Document not found"}` + `access-control-allow-origin` present, for both "foreign row" and "nonexistent id" (D-09 identical bodies).

### Pattern 4: The live OneDrive re-drive (SC#2, D-14..D-16), corrected to the shipped behaviour

**Measured:**
- The watch lists at `page_size=30` (default, `microsoft_graph.py:297`).
- It is non-recursive (`watch_service.py:269-274`) and `max_pages=200`.
- `listing.complete = True` only when `next_page_token` is falsy (`:283-285`).
- Folder paths are stored at `documents.metadata.source.path` (`watch_service.py:330-341`).
- Rule facts come from `metadata.source.path` → `eval_facts["path"]` (`ingest_enrich.py:568-570`). Rules are evaluated during ingest and the suggestion is written to `metadata._classification`, so **the ingest worker must run**.
- The `/sources/watches/{id}/sync` route only sets `next_run_at`. The read needs `WATCH_PROCESS_ENABLED=true` and a running backend (`main.py:584`), or a driver script calling `WatchService.sync_watch(watch_row)` directly (`watch_service.py:178`).
- The local connection: `connector_connections` id `34e44621…`, `service_id='microsoft'`, `status='active'`, `updated_at 2026-09-08`. The token refresh path is `oauth_refresh_service` → `login.microsoftonline.com/common/oauth2/v2.0/token` (`oauth_service.py:105-106`). A Microsoft refresh token idle for ~37 days is *probably* still valid [ASSUMED].
- The account is **personal** OneDrive (`238-VERIFICATION.md` S-1: `drive_type: personal`).

**A drive that meets every D-15 criterion with no knob:**
- `Team Docs/` holds **≥ 61 top-level files** (3+ pages at 30; e.g. 95 top-level files including one with a space, `Q3 report draft.txt`), plus `Team Docs/Q3 Plans/` holding 10 files. 105 total, as D-14 says.
- **Watch A** on `/Team Docs` proves FIX-03 (all top-level files, multiple pages, `listing_complete=True`, run `success`) and FIX-05 at depth 1 (`/Team Docs/<name>`).
- **Watch B** on `/Team Docs/Q3 Plans` proves FIX-05 at depth 2 (`/Team Docs/Q3 Plans/<name>`, decoded, the space-in-folder case). Alternatively, use the manual Library import of `/Team Docs` (recursive walk). It fits on one page at 200, so it does not prove paging, but it does prove the nested path.
- Count: top-level count + Q3 count = 105 rows with `source_connection_id = 34e44621…`.
- A rule `path contains '/Team Docs/'`, created **before** the run, appears in `metadata->'_classification'` on every row.

⛔ Record the deviation from D-14's "one watch, page_size=100" premise in the plan; it was a mis-read of `:272`.

**DB reads for evidence:**
```sql
SELECT count(*), bool_and(metadata->'source'->>'path' LIKE '/Team Docs/%') FROM documents WHERE source_connection_id = '<conn>' AND created_at > '<drive start>';
SELECT DISTINCT metadata->'source'->>'path' ~ '%[0-9A-F]{2}' AS still_encoded FROM documents WHERE …;  -- must be all false
SELECT count(*) FILTER (WHERE metadata ? '_classification') FROM documents WHERE …;
SELECT status, listing_complete, count_new, count_errors FROM connector_sync_runs WHERE watch_id = '<w>' ORDER BY started_at DESC LIMIT 1;
```
(Column names in `connector_sync_runs` need confirming at execution, from `full-schema.sql`.)

### Pattern 5: Ids cannot shape the Graph path (FIX-04 extension, D-17)

**Measured in venv (httpx 0.28.1)**, URL built as `GRAPH/me/drive/items/{id}/children`:

| `id` | Resulting URL |
|---|---|
| `x/../../drives/D1/root` | `…/v1.0/me/drive/drives/D1/root/children` (dot segments collapsed) |
| `x?$expand=children&a=` | `…/me/drive/items/x?%24top=100` (the `children` call became an item-metadata call; params replaced) |
| `a#frag` | the fragment swallowed `/children` |

Ids reach the adapter from the client:
- `GET /connectors/connections/{id}/browse?folder_id=` (`connectors.py:2099-2135`)
- `WatchCreateRequest.source_folder_id: str` (`models/source.py:11`)
- the import file ids → `read_file` → `f"{GRAPH}/me/drive/items/{file_id}"` (`microsoft_graph.py:391`)

Exposure is bounded, because responses are filtered to driveItem-shaped `value[]`. But it reaches other drives and endpoints under the connection owner's token, which is the same class WR-01 fixed for search.

**Fix:** one private `_item_segment(item_id) -> str` that refuses `None`/empty/`"."`/`".."` (ValueError) and returns `quote(item_id, safe="!")`. Keep `!` literal: personal OneDrive ids look like `ABC123!105`; `!` is a sub-delim, not path syntax. Encoding it to `%21` is *probably* equivalent, but that is unverified live [ASSUMED]. Use it in `_children_url` and `read_file`. Pin it with a parametrized test mirroring `test_238_06`'s hostile-term table, asserting the issued URL **after** `httpx.URL(...)` normalisation. Also fix the stale comment at `:225-229`.

⚠ Do **not** tighten the cursor-prefix check to `/me/drive/`. Graph's `@odata.nextLink` for `/me/drive/...` may come back as `/drives/{id}/items/...` [ASSUMED], and that would break the paging this phase must prove. Record the user-supplied `page_token` (browse) as a bounded residual instead.

### Pattern 6: Purge helper (DEBT-10, D-11..D-13)

**Recommended module:** `backend/app/services/document_purge.py`
```python
async def purge_documents(request, current_user, doc_ids, *, kind, supabase, service_supabase) -> list[dict]:
    # 1. hold_guard.assert_none_held(request, current_user, doc_ids, kind=kind, service_supabase=...)
    # 2. with hold_guard.map_hold_refusal(kind=kind):
    #        deleted = (await run_in_threadpool(lambda: supabase.table("documents")
    #                     .delete().in_("id", doc_ids).execute())).data or []
    # 3. await remove_document_bytes(supabase, [r["file_path"] for r in deleted if r.get("file_path")], removed, not_removed)
    # return deleted

async def remove_document_bytes(client, paths, removed, not_removed) -> None:   # lifted verbatim from disposition._remove_bytes
```

- **Paths from the DELETE's own representation** (default `return=representation`) rather than a separate pre-SELECT. Only rows that were actually deleted lose bytes, and there is no TOCTOU. This satisfies D-11's intent ("bytes only after the row delete succeeds") more tightly than "select `file_path` before". If the planner keeps a pre-SELECT, intersect it with the returned ids.
- Call `hold_guard.assert_none_held` / `hold_guard.map_hold_refusal` **through the module attribute**. `test_275_delete_paths.py` monkeypatches `hold_guard.assert_none_held`, so a `from … import assert_none_held` would make every guard test vacuous.
- Use the **user-JWT** client for the storage remove, as the Library delete does. Migration 206's `storage.objects` DELETE policy (`full-schema.sql:9943-9947`) then refuses removing any path that still backs a `documents` row: defence-in-depth for T-275-12.
- `disposition.py`: replace the body of `_remove_bytes` with an import (`from app.services.document_purge import remove_document_bytes as _remove_bytes`) or update the one call at `:480`. Keep `STORAGE_BUCKET` (`:65`). The regression net is `tests/integration/test_275_disposition.py:286-306` and `test_275_review_confirm.py:89-100`, which pass a `_Storage` fake with `.storage.from_(b).remove(paths)`. The lifted function must keep that exact call shape.
- `sources.py` doors keep `purged_count` semantics. Prefer `len(deleted)` (honest) over `len(doc_ids)`, and note it.
- **Existing pins that WILL change and must be amended deliberately in the same commit, with the reason in the test:**
  - `test_275_delete_paths.py::test_watch_delete_with_purge_unheld_deletes_documents_then_the_watch` (asserts `["guard","documents.delete","watch"]`)
  - `::test_purge_missing_unheld_counts_only_after_the_delete_succeeded` (asserts `["guard","documents.delete","pool"]`)

  Both gain `storage.remove`. Their fakes answer `("documents","delete")` with `[]` by default, so give them rows carrying `file_path`. `test_sources_no_longer_log_and_continue_around_a_document_delete` (no `except` in the two route functions) stays green after extraction. Add the equivalent rule for the helper, which may catch only around the storage remove.
- **Source fence for the helper:** in `purge_documents`, every `.remove(` call line > the `.delete(` call line, and the `assert_none_held` line < both.

**SC#3 evidence:** local storage already holds **35 orphaned objects** (249 total, read 2026-10-14). The evidence must therefore be **per document**: before and after `SELECT name FROM storage.objects WHERE bucket_id='documents' AND name = ANY($paths)`, never a global orphan count.
- **Door 1:** create a watch, import 2 files, then `DELETE /sources/watches/{id}?purge_documents=true` → rows 0, objects 0.
- **Door 2:** mark items `missing`, then `POST /sources/watches/{id}/purge`.
- **Held:** place a hold, try both → 409, row present, object present.

### Pattern 7: DEBT-08 record (D-06, D-07)

Re-verified:
- `message_artifacts` FKs are only `threads`, `auth.users`, `runs`, and self (`202_message_artifacts.sql:62-67`).
- The caption is `{row_count, sources:[{tool, document, page}], source_count, lineage}` (`show_artifact_tool.py:257-284`). CONTEXT's `{tool, document, page}` is one *source* entry.
- `ArtifactFrame.tsx:49-56` renders a `<figcaption data-testid="artifact-caption">` with an icon and React text, no anchor.

Homes:
- **Public:** `docs/public/administer/org/retention.md` (109 lines). It already ends "Known limits" with *"Retention covers Library documents only. Chat messages, attachments and files made in chat are not covered."* Add the D-07 "What retention does not remove" paragraph beside it. Afterwards run `node scripts/check-docs-coverage.cjs` (currently OK: 112 keys · 261 IDs · 119 pages). The page frontmatter carries `updated:`/`reviewed:`.
- **Internal:** no `docs/` file covers retention design. `docs/history/v4.5-find-it-show-it.md:38` describes artifacts (273). Recommend a short dated section appended there ("Decision 280 / DEBT-08"), or a new `docs/RETENTION-AND-ARTIFACTS.md` if the planner wants a findable title.
- **Test:** extend `frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx` with a record whose `caption.sources[0].document` names a file that no longer exists. Assert the `artifact-caption` text contains `contract.pdf` and that `figure.querySelector("a")` is null. Assert the rendered CONTENT, not presence (the 235 lesson).

### Anti-Patterns to Avoid
- **Swallowing the 23505 but leaving the retire before the insert.** That is ROADMAP's first listed failure mode.
- **Fixing `/upload` at the route** (the 274 promote-style boundary pre-check) instead of in the minter. The watch path stays racy; that is failure mode 2.
- **`from app.services.retention.hold_guard import assert_none_held`** in the helper. The tests' monkeypatch then misses, and every guard test passes vacuously.
- **Proving SC#3 with a global orphan count.** 35 pre-existing orphans make it meaningless.
- **Editing app code to plant the DEBT-11 RED site.** Plant into a temp copy via the fence's root argument.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic dedup | app-level locks / advisory locks / a new RPC | the existing unique indexes + resolve the 23505 to the winner | the index is the only atomic arbiter across 2 workers; D-03 forbids an RPC |
| "Which rows were deleted" | a pre-SELECT then delete | PostgREST `return=representation` on the DELETE | exact set, no TOCTOU |
| Byte removal | a third inline copy | lifted `remove_document_bytes` | D-11 |
| 0-row handling | per-site `if x is None or not x.data` | `maybe_row()` | D-08, and adds no `ast.If` (D-32) |
| URL encoding for Graph ids | regex sanitising | `urllib.parse.quote(..., safe="!")` + dot-segment refusal | matches the shipped WR-01 fix |

## Runtime State Inventory

Not a rename/refactor phase, but two items of runtime state matter:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Local `storage.objects` (bucket `documents`) holds 35 orphans out of 249 objects, pre-existing | Evidence must be per-path. Optional orphan cleanup is NOT in scope (no capability). |
| Live service config | Microsoft connection `34e44621` (local) may need a token refresh | Operator-approved drive; ⛔ row if it fails |
| OS-registered state | None, verified (no scheduler/task involved) | — |
| Secrets/env vars | `WATCH_PROCESS_ENABLED` (local `.env`; could not be read; operator-owned) | Either enable it locally for the drive, or drive `WatchService.sync_watch` from a script. Production value unchanged (D-22) |
| Build artifacts | None | — |

## Common Pitfalls

### Pitfall 1: The `_BASE_SEQUENCE` pin goes red, by design
`tests/unit/test_266_mint_org_scope.py:214-254` pins the **exact** query sequence the minter issues for `/upload` (completed dedup → version → **update** → insert → link re-query). FIX-02 intentionally changes it (a new in-flight select, the update moves after the insert, the retire gains `neq`/`lt`, the raise arm re-queries). Amend it **in the same commit as the minter change**, with the reason written in the test, and re-pin the new sequence. `test_ingest_splice.py:228-244` (409 on `raise`) also needs review: its mock select returns `[]`, so the fallback 409 still fires. Keep it, re-labelled as the "winner not found" fallback.

### Pitfall 2: Mutual retirement under insert-first
See Summary item 2. Use `lt("version_number", next_version)`.

### Pitfall 3: The trigger's `LIMIT 1` without ORDER BY
For `/upload` (no org), the new row's org is whatever `org_members` heap order returns. Never predict it in Python; read it back from the INSERT result.

### Pitfall 4: Thread-shared supabase clients in the race test
`asyncio.gather` over two `async_mint_document_row` calls runs them in two threadpool threads. Give each call its **own** client (two `user_client(token)` instances) so the test measures the DB race, not httpx client sharing [ASSUMED: httpx.Client thread-safety is not something to rely on in a test].

### Pitfall 5: A storage remove that RLS refuses is silent
storage3 `remove()` returns the JSON list of deleted objects. A policy-filtered path is just absent from it, not an error [ASSUMED: Supabase Storage bulk-delete semantics]. `_remove_bytes` (`disposition.py:507-515`) reports every path as removed if no exception occurs. Lift it **byte-identical** (D-11 says lift, not change). The live storage listing is the real evidence.

### Pitfall 6: The test conftest points the app at a placeholder Supabase
`tests/conftest.py:10-11` sets `SUPABASE_URL=https://test.supabase.co`, so `get_supabase()` inside a TestClient app never reaches the local stack. Live tests must build clients from `backend/.env` via `_271_gotrue_users._local_env()` and override dependencies, or call the minter directly.

### Pitfall 7: G-5 rows missing for new files
`node scripts/check-hot-file-ledger.cjs --files …` (run 2026-10-14) returns `[no-row]` for `backend/app/api/takeoff.py`, `backend/app/utils/db.py` and `backend/app/services/document_purge.py`. Rows (scan list + section) must be added **in the plan commit** that first names each file (the 271 precedent), or the PostToolUse hook fails the PLAN.md write.

## Code Examples

### `maybe_row` (helper)
```python
# backend/app/utils/db.py — beside aexec / coerce_uid
def maybe_row(resp):
    """The row a `.maybe_single()` query found, or None.

    postgrest 2.29 returns None (not a response with data=None) when 0 rows match
    (`SyncMaybeSingleRequestBuilder.execute`), so `resp.data` on a miss raises AttributeError → 500.
    """
    return resp.data if resp is not None else None
```

### The in-flight leg and the 23505 resolution (shape)
```python
live_q = (supabase.table("documents").select("*")
          .eq("user_id", user_id).eq("content_hash", content_hash)
          .neq("status", "failed").eq("is_latest", True))
if org_id:
    live_q = live_q.eq("org_id", org_id)
live = live_q.order("created_at", desc=True).limit(1).execute()
if live.data:
    return MintResult(document=live.data[0], is_duplicate=True, ...)
...
retire_q = (supabase.table("documents").update({"is_latest": False})
            .eq("user_id", user_id).eq("filename", filename)
            .eq("org_id", org_id or doc["org_id"])
            .neq("id", doc["id"]).lt("version_number", next_version))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| postgrest-py `maybe_single()` raised `APIError(code="204")` on 0 rows | returns `None` | postgrest-py 0.x → 2.x (exact version not measured here) | `main.py`'s patch was written for the old behaviour and is now inert |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A 500 lacks CORS headers because Starlette's ServerErrorMiddleware sits outside CORSMiddleware | Pattern 3 | Low. The DEBT-11 test asserts the header directly either way |
| A2 | Graph accepts `!` unencoded in item ids, and `%21` would probably also work | Pattern 5 | Medium. Live drive M-5/M-6 traffic confirms; keep `safe="!"` |
| A3 | Graph `@odata.nextLink` may not start with `/me/drive/` | Pattern 5 | Low. Only matters if someone tightens the cursor check |
| A4 | The Microsoft refresh token (idle since 2026-09-08) is still valid | Pattern 4 | Medium. If not, the operator reconnects (OAuth UI) or the row is ⛔ (D-15) |
| A5 | A storage bulk delete silently omits RLS-refused paths | Pitfall 5 | Low. Evidence is the per-path storage listing |
| A6 | httpx.Client sharing across threads is unsafe to rely on in a test | Pitfall 4 | Low. Separate clients cost nothing |

## Open Questions

1. **CR-01 for `/upload` (org_id None): refuse or re-home?**
   - **Known:** D-05 says "require folder org == minting org"; for `/upload` the minting org is chosen by a non-deterministic trigger.
   - **Unclear:** whether the operator wants a mismatched folder refused (404), or the document minted into the folder's org when the caller is a member.
   - **Recommendation:** mint into `folder.org_id` after a membership check, and 404 a non-member. That is the only reading under which "equal" is well-defined, and it never 500s on RLS. Confirm in plan-check.
2. **D-02's literal folder scope vs the cross-folder FIX-02 hole** (Summary item 1).
   - **Recommendation:** folder-agnostic in-flight leg (the `find_existing_copy` shape). This is a CONTEXT refinement; record it as such in the plan.
3. **D-14/D-15 drive shape.**
   - **Recommendation:** two watches (or watch + manual import) with ≥ 61 top-level files. Operator to approve the revised folder layout before generating it.
4. **`connector_sync_runs` evidence column names** (`listing_complete`, `count_new`): confirm from `full-schema.sql` at execution time.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres :54322 | live minter / CR-01 / purge tests | ✓ (asyncpg read 2026-10-14) | — | none (tests skip, and a skip is not a pass) |
| Local Supabase API :54321 (GoTrue/PostgREST/Storage) | `_271_gotrue_users`, storage evidence | ✓ (assumed with DB; `require_gotrue()` skips otherwise) | — | — |
| backend venv | all backend tests | ✓ | postgrest/supabase/storage3 2.29.0, httpx 0.28.1 | — |
| Microsoft connection (local) | SC#2 live drive | ✓ row exists, `status=active`, last update 2026-09-08 | — | ⛔ row with reason (D-15) |
| `WATCH_PROCESS_ENABLED` | watch reader | unknown (`.env` not readable by this agent) | — | drive `WatchService.sync_watch` from a script |
| Ingest worker (backend running) | `_classification` written at ingest | operator starts the backend (memory: user starts backend) | — | none for the rule check |
| Node | gates | ✓ | — | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), vitest (frontend) |
| Config file | `backend/pytest.ini`/conftest; `frontend/vitest.config.*` |
| Quick run (backend, targeted) | `cd backend && venv/Scripts/python -m pytest <files> -q` |
| Full backend gate | `node scripts/check-backend-unit-baseline.cjs` (take the local-DB lock first) |
| Frontend | `cd frontend && npx vitest run src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx`; count gate `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Type | Command | File Exists? |
|--------|----------|------|---------|-------------|
| FIX-02 | second same-bytes mint while first pending → dup, nothing retired (RED first) | integration (live) | `pytest tests/integration/test_280_same_bytes_live.py -q` | ❌ Wave 0 |
| FIX-02 | `asyncio.gather` race ×N → one non-failed row, both results same id, is_latest true, no exception | integration (live) | same file | ❌ |
| FIX-02 | each of the 7 caller parameter sets hits the fixed path | integration (live, parametrized) | same file | ❌ |
| FIX-02 | insert-before-retire, `lt`/`neq` retire, 23505→winner for raise+link | unit (stub) | `pytest tests/unit/test_280_minter_sequence.py tests/unit/test_266_mint_org_scope.py tests/unit/test_ingest_splice.py -q` | ❌ / amend |
| FIX-02 | `/upload` 200 + `already_in_library: true` | unit (TestClient, stub) | `pytest tests/unit/test_280_minter_sequence.py -q` | ❌ |
| FIX-02 | two concurrent HTTP uploads | manual live (curl ×2 & against the running backend) | recorded in VALIDATION | manual |
| CR-01 | mismatch reproduces → BUG filed → 404 after fix | integration (live) | `pytest tests/integration/test_280_cr01_two_org_live.py -q` | ❌ |
| FIX-03/05 | cursor refused; paths decoded | unit | `pytest tests/unit/services/sources/test_238_05_cursor_is_refused_not_guessed.py tests/unit/services/sources/test_238_06_search_url_and_folder_path.py -q` (17 passed today) | ✅ |
| FIX-04 | hostile ids cannot shape the URL (`children`, `read_file`) | unit | `pytest tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py -q` | ❌ |
| FIX-03/04/05 | live OneDrive drive | manual live (operator-approved) | DB reads in §Pattern 4 | manual |
| DEBT-10 | order guard→delete→remove; held → nothing removed; storage failure logged | unit | `pytest tests/unit/test_280_purge_bytes.py tests/unit/test_275_delete_paths.py -q` | ❌ / amend |
| DEBT-10 | disposition still removes bytes after the lift | integration (live) | `pytest tests/integration/test_275_disposition.py tests/integration/test_275_review_confirm.py -q` | ✅ |
| DEBT-10 | per-path storage listing, both doors + held | manual live | SQL on `storage.objects` | manual |
| DEBT-11 | DELETE foreign/nonexistent → identical 404 + CORS | unit (TestClient, None-returning fake) | `pytest tests/unit/test_280_delete_404.py -q` | ❌ |
| DEBT-11 | 0 unguarded sites; planted site goes RED | unit (AST) | `pytest tests/unit/test_280_maybe_row_fence.py -q` | ❌ |
| DEBT-11 | D-32 fence still green | unit | `pytest tests/unit/test_275_delete_paths.py -q` | ✅ |
| DEBT-08 | caption of a disposed source renders plain text, no link | frontend component | `npx vitest run src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx` | ✅ (extend) |
| D-20 | closed core 7/1/30 | unit | `pytest tests/unit/test_259_closed_core_inventory.py -q` | ✅ |

### Sampling Rate
- **Per task:** the targeted files above.
- **Per wave:** `node scripts/check-backend-unit-baseline.cjs` (lock first); the frontend count gate once (plan 4 only touches one test).
- **Phase gate:** backend failing SET equal to base, `check-claude-md-size.cjs`, `check-hot-file-ledger.cjs 280`, `check-docs-coverage.cjs`, `check-seeds-register.cjs --phase 280`.

### Wave 0 Gaps
- All `test_280_*` files above.
- A shared live fixture: a GoTrue user + org(s) + cleanup that deletes `documents` rows and their `storage.objects`. Reuse `GoTrueUsers.drop_all`; a user delete cascades documents through the FK (`documents_user_id_fkey ON DELETE CASCADE`), but storage objects must be removed explicitly.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | — |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS (`documents` INSERT/DELETE/SELECT policies, storage mig 206), `hold_guard`, the minter folder/org check |
| V5 Input Validation | **yes** | Graph id encoding (`quote` + dot-segment refusal); Pydantic `WatchCreateRequest` |
| V6 Cryptography | no | — |

### Threat notes

| Threat | STRIDE | Mitigation (binding) |
|---|---|---|
| **T-275-12:** bytes removed before a hold-refused row delete | Tampering / Repudiation | Helper order guard → rows (in `map_hold_refusal`) → bytes from the DELETE's returned rows only; source fence. Storage policy mig 206 refuses removing a path that still backs a row (defence-in-depth). A held refusal raises before any delete, so **bytes stay**; prove it live. |
| Purge of a row the caller cannot delete | Tampering | User-JWT DELETE is RLS-scoped (`auth.uid() = user_id`); bytes only for returned (deleted) rows |
| **Existence oracle on DELETE (D-09)** | Information disclosure | Owner-filtered `maybe_single` → `None` for both foreign and nonexistent → identical `404 {"detail":"Document not found"}`; test asserts body equality |
| **Existence oracle on CR-01 (D-05)** | Information disclosure | Org mismatch answers the identical `404 "Folder not found"`. The pre-existing 403 for a *visible* not-owned folder reveals nothing new, since RLS already shows it to the caller |
| CR-01 cross-org misfiling | Tampering / Elevation | Minter org check before INSERT; never let RLS 42501 surface as a 500 |
| Graph path injection via ids (FIX-04 extension) | Tampering / Information disclosure | `_item_segment` encode + refuse; host pin unchanged |
| Dedup returning another org's copy (`/upload`, org None) | Information disclosure | Pre-existing, accepted under D-266-18/SEED-313; the in-flight leg inherits the same scope (user-owned rows only) |
| Race leaving zero latest rows | Denial of service (data invisibility) | `lt(version_number)` retire scope |

## Plan split (D-23, G-8) with files_modified and waves

Two plans touching the same file cannot run in parallel worktrees, and live-DB plans must be serialized (worktree rule 4).

| Plan | Wave | Requirements | files_modified (expected) | Depends on |
|---|---|---|---|---|
| **A: purge helper + bytes + 404 sweep** | 1 | DEBT-10, DEBT-11 | NEW `backend/app/services/document_purge.py`; `backend/app/api/sources.py` (extraction FIRST, task 1); `backend/app/services/retention/disposition.py`; `backend/app/utils/db.py`; `backend/app/api/documents.py` (7 sites); `backend/app/api/folders.py`; `backend/app/api/skills.py`; `backend/app/api/takeoff.py`; `backend/app/services/ingest_splice.py` (**only** `:162` and `:422` site lines); `backend/app/main.py` (delete patch); `backend/tests/unit/test_275_delete_paths.py` (amend 2 order pins); NEW `test_280_purge_bytes.py`, `test_280_delete_404.py`, `test_280_maybe_row_fence.py` | — |
| **B: Graph adapter** | 1 | FIX-03, FIX-04, FIX-05 (code + pins) | `backend/app/services/sources/adapters/microsoft_graph.py`; NEW `tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py`; scratchpad `Team Docs` generator (not in tree) | — (disjoint from A; stubbed tests only, so safe beside A) |
| **C: same-bytes minter + CR-01** | 2 | FIX-02 (+CR-01) | `backend/app/services/ingest_splice.py` (`mint_document_row` only); `backend/app/api/documents.py` (`/upload` dup branch, one expression); `backend/app/models/document.py` (+1 optional field); `tests/unit/test_266_mint_org_scope.py` + `tests/unit/test_ingest_splice.py` (deliberate amendments); NEW `tests/unit/test_280_minter_sequence.py`, `tests/integration/test_280_same_bytes_live.py`, `tests/integration/test_280_cr01_two_org_live.py`; NEW `.planning/reported-bugs/BUG-2610xx-*.md` (if it reproduces) | **A** (shares `documents.py` + `ingest_splice.py`; reuses `maybe_row` in the folder check) |
| **D: live drives + DEBT-08 + close** | 3 | FIX-03/04/05 (live), DEBT-08, DEBT-10 SC#3 live evidence (if not done in A) | `docs/public/administer/org/retention.md`; internal doc (`docs/history/v4.5-find-it-show-it.md` or a NEW `docs/RETENTION-AND-ARTIFACTS.md`); `frontend/src/components/chat/artifacts/__tests__/ArtifactBlock.test.tsx`; `docs/HOT-FILE-LEDGER.md` + `CLAUDE.md` FIRING table (re-derive all touched triples once; add the `microsoft_graph.py` row at 4 phases; disposition row); bug reports (BUG-261005-01, BUG-260910-04, BUG-261012-01/02 → closed with `verified_closed_by`); `238-VERIFICATION.md` M-9 line; ROADMAP/REQUIREMENTS/STATE | A, B, C. ⛔ operator checkpoint before the OneDrive drive |

**Overlap flags:**
- `documents.py` and `ingest_splice.py` are touched by A and C. A goes first; C must not run in parallel.
- `test_275_delete_paths.py` is touched by A only.
- `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md` are touched by D only. Per the 271 precedent, ledger rows for files that have none (`takeoff.py`, `utils/db.py`, `document_purge.py`) go into the **planning commit**, not into parallel worktrees.

**Live-DB serialization:**
- A's and B's unit tests are stubbed, so they are safe in parallel.
- C's live tests and D's drives mutate the local DB, so they are single-flight, and they take the local-DB lock (`C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock`).
- If A also runs the SC#3 live purge drive, do it at A's end, outside wave 1's concurrent window, or move it to D.

## Baselines

- **Closed core:** recount with `cd backend && venv/Scripts/python -m pytest tests/unit/test_259_closed_core_inventory.py -q`. It asserts 7 phase types (`:35`), 1 emitter (`:45`), 30 tools (`:56`). No plan adds any of them.
- **Backend unit gate (measured 2026-10-14 at `ae85f4737`):** **`71 failed, 7293 passed, 1 skipped, 2 xfailed, 2 xpassed` — 0 errors, `[GATE PASSED]` (71 ≤ 71, zero headroom), 403 s.** Run under the local-DB lock. The 71-test failing SET was captured to the researcher's scratchpad only (`base_failed_ae85f4737.txt`), so the executor must re-capture the set at its own plan base (`grep '^FAILED'` on the gate output, then `sort -u`) and diff SETS, never counts. None of the files this phase amends (`test_266_mint_org_scope`, `test_ingest_splice`, `test_275_delete_paths`, `test_238_*`) is in the failing set today, so any red there is NEW. ⚠ The passed count is 7293, not the 3497 quoted in CLAUDE.md; only the failed ceiling binds.
- **Graph pins:** `test_238_05` + `test_238_06` → **17 passed** (2026-10-14).
- **CLAUDE.md:** 90,755 chars (60.5%), OK.
- **Docs coverage:** OK (112 keys · 261 IDs · 119 pages).
- **Seeds:** run `node scripts/check-seeds-register.cjs --phase 280` after the PLAN.md files exist. It matched 0 at discuss because no `files_modified` existed yet.

## Sources

### Primary (HIGH confidence)
- Installed library source in `backend/venv`: `postgrest/_sync/request_builder.py` (`:89-172`, `:196-207`, `:434-455`), `postgrest/base_request_builder.py:205-214`, `storage3/_sync/file_api.py:360-374`
- Live local DB reads (asyncpg, read-only, 2026-10-14): `pg_indexes` on `documents`, `org_members` for `e6dc45ca`, the folder/org mismatch counts, `storage.objects` counts, `connector_connections` (microsoft)
- `supabase/full-schema.sql` (indexes `:5155-5211`, triggers `:6415-6457`, functions `:54-84`, `:346-371`, `:1127-1132`, RLS `:8122-8511`, storage policies `:9935-9947`)
- Code at HEAD `ae85f4737` (every file:line cited above)
- Test runs: `test_238_05`/`test_238_06` (17 passed); `check-hot-file-ledger.cjs --files …`; `check-docs-coverage.cjs`; `check-claude-md-size.cjs`

### Secondary (MEDIUM confidence)
- httpx 0.28.1 dot-segment normalisation, measured locally (behaviour, not docs)

### Tertiary (LOW confidence)
- A1-A6 in the Assumptions Log

## Metadata

**Confidence breakdown:**
- Minter / indexes / caller matrix: HIGH (live DB + code)
- 404 sweep + dead patch: HIGH (AST audit + installed library source)
- Purge helper: HIGH (code + installed library defaults); storage-RLS silence is ASSUMED
- OneDrive live drive: MEDIUM (credential + Graph behaviour not driven)

**Research date:** 2026-10-14
**Valid until:** 2026-10-28 (fast-moving repo; re-measure line numbers at plan time)
