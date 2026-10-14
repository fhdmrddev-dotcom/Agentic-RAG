# Phase 280: In Once, Out Clean - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Repair only, no new user capability (v4.6 milestone rule). A document that comes in **arrives exactly
once and completely**, and one that goes out **leaves nothing behind**:

- **FIX-02**: same bytes uploaded while the first copy is `pending`/`processing` never retires it and never 409s.
- **FIX-03/04/05**: the Graph adapter pages, encodes and decodes honestly. Already fixed in code, so what is left is pins plus a live re-drive.
- **DEBT-10**: both watch purge doors remove stored bytes.
- **DEBT-11**: `DELETE /documents/{id}` answers 404, not 500, and so does every same-shape handler.
- **DEBT-08**: a recorded decision for `message_artifacts` when retention disposes the source document.

Success criteria are ROADMAP Phase 280 SC#1-5. "How we'd know this failed" is in ROADMAP too and is binding.

</domain>

<decisions>
## Implementation Decisions

### Measured at discuss (2026-10-14, develop after `525695de1`): the starting point
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

### Same-bytes upload (FIX-02)
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

### Charts after retention disposal (DEBT-08)
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

### 404 sweep (DEBT-11)
- **D-08:** Fix **all 21** sites with **one tiny shared helper**. Shape (the planner names it): take the `maybe_single()` result and return its row or `None` without touching `.data` on `None`, so each site's existing `404` branch is reached.
  - Each site changes by about one line, so `skills.py`, `folders.py` and `documents.py` are **honoured by construction** (G-5).
  - A grep/AST fence pins **zero** remaining `maybe_single()` → `.data` sites with no None guard, across `backend/app`. It is driven RED first against a planted site.
- **D-09:** `DELETE /documents/{id}` for another user's/org's row and for a nonexistent id answer the **identical** `404 {"detail": "Document not found"}` with CORS headers. This is not an existence oracle, and the existing `user_id` filter already makes both cases the same 0-row miss.
  - ⛔ The 275 D-32 fence pins **no new `if`** in the delete handler. The helper must reuse the existing `if not …: raise 404` branch, or the plan records the fence change explicitly with the reason.
- **D-10:** The dead patch at `backend/app/main.py:66-88`: the researcher measures whether it fires for **any** call, including `.single()`. If it is proven dead, delete it with the evidence in the commit. If it is still live for `.single()`, keep it and add a comment stating that it does not cover `maybe_single`.

### Purge bytes + `sources.py` extraction (DEBT-10, G-5). Claude's recommendation, accepted by the operator
- **D-11:** A **single shared delete helper** lives in a new service module (the planner names it), with the order **hold guard → delete rows → remove bytes** (275 D-38 / T-275-12, binding).
  - It selects `file_path` **before** the row delete and removes bytes **only after** the row delete succeeds.
  - A storage remove failure is logged, not raised, matching the Library delete.
  - A held document refuses and **keeps its bytes**.
  - The bytes step lifts `retention/disposition.py:621 _remove_bytes` (made shared), not a third copy.
- **D-12:** Both purge doors in `sources.py` move their purge bodies into that helper. **This is the "extraction FIRST" that `sources.py`'s ledger section requires**, done as the first task, behaviour-preserving apart from adding the bytes step, before any fix lands on that file.
  - The Library delete in `documents.py` **keeps its own inline code** (the D-32 fence). Moving it onto the helper is out of scope.
- **D-13:** SC#3 evidence is a storage listing that shows **no object left** for a purged document (both doors), plus a held-document drive that shows refusal and bytes still present. A source fence in the style of `test_275_delete_paths.py::test_every_storage_remove_in_delete_document_follows_its_row_delete` pins the order in the helper.

### OneDrive live re-drive (FIX-03/04/05 SC#2)
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

### Gates, security and guardrails (carried from ROADMAP / milestone rules)
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

### Refinements after research (2026-10-14): Claude's autonomous rulings; the operator was away and may overrule
`280-RESEARCH.md` measured four places where the decisions above rest on a wrong fact. Each ruling
takes the researcher's recommendation and stays inside the decision's intent. **None adds a user
capability or a migration.**
- **D-24 (refines D-02):** the **in-flight** dedup check is **folder-agnostic**: user + hash +
  `status <> 'failed'` + `is_latest` (+ org when passed). This is the shape of the live leg of
  `workspace_promote.find_existing_copy`. Why: under D-02's literal folder scope, same bytes uploaded
  to a different folder while the first copy is pending still retire it, and the second copy then
  fails at completion on `documents_completed_hash_unique_idx` (which has no folder column). That is
  exactly SC#1's failure mode.
  - The 23505 re-query stays scoped exactly as the index that fired.
  - **Accepted residual, recorded rather than built around:** two *truly concurrent* inserts into
    different folders both pass. The one that completes second fails at completion. Closing that
    needs a constraint, which means a migration.
  - **Side effect to state in the plan:** `expert_install` now raises `ExpertInstallConflict` for an
    in-flight copy in another folder, as it already does for a completed one.
- **D-25 (refines D-03):** the retire runs only after the INSERT succeeds and is scoped
  `.neq("id", new_id).lt("version_number", next_version)`, with the org taken from the inserted row
  when `org_id` was not passed. Why: excluding only the new id lets two concurrent new versions retire
  each other, leaving zero latest rows. Taking the org from the inserted row also closes a latent
  cross-org retire on `/upload`.
  - A retire failure is logged and never loses the inserted row.
  - `documents_latest_idx` is measured **non-unique**, so insert-first is safe with no migration.
- **D-26 (resolves D-05 for `/upload`):** when `org_id is None` and a folder is given, the minter
  checks that the caller is a member of `folder.org_id` and then mints with
  `org_id = folder.org_id` explicitly.
  - A non-member, or a folder org that differs from an explicitly passed `org_id`, gets the
    identical `404 "Folder not found"`.
  - Why: `/upload`'s "minting org" is otherwise picked by a `LIMIT 1` trigger with no `ORDER BY`, so
    "equal to the minting org" is undefined.
  - The drive is a live integration test with a seeded two-org GoTrue user, because the dev account
    owns 0 folders and the UI path cannot produce the mismatch.
  - D-05's "file the bug first if it reproduces" stands.
- **D-27 (corrects D-14/D-15's drive shape):** the watch lists at `page_size=30`, not 100 (`:272` is
  the folder picker), and it is **non-recursive**. The drive therefore uses:
  - `Team Docs/` holding **95** top-level files (4 pages at 30), one of them with a space in its name;
  - `Team Docs/Q3 Plans/` holding **10** files (105 total, as in D-14);
  - **watch A** on `/Team Docs` (proves paging, `listing_complete`, and depth-1 paths);
  - **watch B** on `/Team Docs/Q3 Plans` (proves the decoded depth-2 path with a space).

  Still **no knob and the shipped config untouched**. The operator approves before the drive. If the
  operator is unavailable, the row is recorded as **owed**, never as passed.
- **D-28 (adds to FIX-04):** the Graph item ids that reach `_children_url` and `read_file`
  (client-supplied through browse, `WatchCreateRequest.source_folder_id` and import file ids) go
  through one `_item_segment(id)` helper. It refuses empty, `.` and `..`, and returns
  `quote(id, safe="!")`.
  - Measured: httpx collapses `../` and a `?` changes which endpoint is called. This is the class
    WR-01 fixed for search.
  - The cursor-prefix check is **not** tightened (A3).
- **D-29 (refines D-08):** **22** unguarded sites, not 21. `ingest_splice.py:422` is the extra one; a
  broad `except` masks it. It is fixed too, so the fence needs no exemption.
- **D-30 (resolves D-10):** the `main.py:66-88` patch is **proven dead**: wrong class, the "204"
  code appears nowhere in postgrest 2.29.0, and `.single()` on 0 rows raises PGRST116. Delete it in a
  behaviour-neutral commit with that evidence, and update the docstring at `app/utils/db.py:6-9` in
  the same commit.
- **D-31 (refines D-11):** the purge helper takes `file_path`s from the **DELETE's own returned
  rows**, so only rows actually deleted lose bytes (no TOCTOU).
  - It calls `hold_guard.assert_none_held` / `map_hold_refusal` **through the module attribute**,
    because a direct import makes the monkeypatched guard tests vacuous.
  - The two `test_275_delete_paths.py` order pins gain `storage.remove`, amended deliberately with
    the reason written in the test.
  - SC#3 evidence is **per path** (local storage already holds 35 orphans), never a global count.
- **D-32 (corrects D-03/D-25, after code review, 2026-10-14):** D-03's "a brief window in which two rows read
  `is_latest = true` is accepted" was **measured false** (280-REVIEW WR-02): two concurrent new versions
  left **two latest rows permanently**. The review fix (`8aeab2e0b`) settles concurrent same-name versions to
  exactly one latest row ("later upload wins") with no migration. The two rows can still share a
  `version_number`; only a constraint would close that. WR-01 (`4ed20aee4`): when the only match is a
  retired same-name row, the minter **restores** it, as the existing Restore action does; a different-name
  retired match answers 409. ⚠ Both are rulings Claude made without the operator and need confirming. WR-01's
  auto-restore is the more capability-shaped of the two under the v4.6 repair-only rule.
- **UI gate:** the ROADMAP text matches the UI keyword regex only through "page"/"pages" (pagination).
  This phase adds no UI surface, so UI-SPEC is skipped (`--skip-ui` equivalent). DEBT-08's frontend
  work is one assertion in an existing test.

### Claude's Discretion
- The helper names and module paths (D-08, D-11), the internal docs file for D-07, and whether the 404 helper lives next to the existing supabase utilities.
- Whether the frontend shows a note for `already_in_library` (D-01), using existing toast/copy patterns only.
- The exact mechanism for the "concurrent uploads" RED test (asyncio gather against the live local stack vs two HTTP clients), provided it hits the real DB unique index.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` § "Phase 280: In Once, Out Clean": goal, SC#1-5, the failure modes, flags
- `.planning/REQUIREMENTS.md`: FIX-02, FIX-03, FIX-04, FIX-05, DEBT-08, DEBT-10, DEBT-11

### Bug reports (folded into 280)
- `.planning/reported-bugs/BUG-261005-01-minter-retires-pending-same-bytes-copy.md`: FIX-02 and the CR-01 note
- `.planning/reported-bugs/onedrive-adapter-silently-truncates-and-mismatches-folder-paths.md` (BUG-260910-04): FIX-03/04/05
- `.planning/reported-bugs/BUG-261012-01-watch-purge-never-removes-storage-bytes.md`: DEBT-10, with the fix shape
- `.planning/reported-bugs/BUG-261012-02-delete-document-500-on-a-row-the-caller-does-not-own.md`: DEBT-11

### Prior-phase decisions that bind
- `.planning/milestones/v4.5-phases/275-retention-legal-hold/275-CONTEXT.md`: D-32 (delete-handler AST fence), D-38 (guard → rows → bytes)
- `.planning/milestones/v4.5-phases/275-retention-legal-hold/275-G4-EVIDENCE.md` §5.3 MEMBER-7, §5.4 OBS-1: the DEBT-11 repro
- `.planning/milestones/v4.5-phases/274-thread-scoped-attachments/274-REVIEW.md`: CR-01, CR-02, and the Save-to-Library link-in-flight fix (the D-01 precedent)
- `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-REVIEW.md` WR-01/02/03 and `238-VERIFICATION.md:223` M-9
- `.planning/milestones/v4.5-MILESTONE-AUDIT.md:28` (W-2, DEBT-08) and `:35` (W-5)
- `.planning/milestones/v4.5-REQUIREMENTS.md:33`: ART-03 (rows stay attached)

### Rules and ledgers
- `docs/HOT-FILE-LEDGER.md`: sections for `documents.py`, `ingest_splice.py`, `sources.py` (the 275-close "extraction FIRST" note), `microsoft_graph.py`, `disposition.py`
- `docs/EXTENSION-CONTRACT.md`: the closed-core red line
- `docs/public/administer/org/retention.md`: the D-07 public paragraph goes here

### Code anchors
- `backend/app/services/ingest_splice.py:126-353`: the minter
- `supabase/migrations/196_documents_dedup_idx_org_scoped.sql`, `195_*.sql:94-96`: the unique indexes
- `backend/app/api/sources.py:306-349`, `:438-498`: the purge doors
- `backend/app/api/documents.py:1810-1882`: the Library delete (reference ordering)
- `backend/app/services/retention/disposition.py:592-640`, `:621`: `_confirm_delete`, `_remove_bytes`
- `backend/app/services/sources/adapters/microsoft_graph.py`: the adapter
- `supabase/migrations/202_message_artifacts.sql`, `backend/app/services/show_artifact_tool.py:257-284`, `frontend/src/components/chat/artifacts/captionModel.ts:59-64`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `retention/disposition.py:_remove_bytes(storage, paths, removed, not_removed)`: lift and share it for D-11.
- `hold_guard.assert_none_held` plus `map_hold_refusal`: already called by both purge doors; the helper keeps the same calls.
- `api/workspace_promote.py:160-187 find_existing_copy`: it already sees live non-failed rows, so it is the reference query shape for D-02.
- `disposition.preview_draft` (`:155`) / `dry_run_org` (`:267`): not needed (D-06 keeps the rows), but noted.

### Established Patterns
- Byte removal always comes **after** the row delete and logs on failure (275-02, T-275-12).
- Source/AST fences pin structural ordering (`test_275_delete_paths.py`).
- `documents_autofill_org_id` (`106_*.sql:181`) stamps `org_id` when `/upload` passes none. D-02 scoping must match what the index sees after that trigger.
- The Graph adapter tests live under `backend/tests/unit/services/sources/test_238_*`.

### Integration Points
- All 7 minter callers (D-04).
- The two purge doors, through the new helper (D-11, D-12).
- The 21 `maybe_single` sites, through the new helper (D-08).

</code_context>

<specifics>
## Specific Ideas

- The live OneDrive folder is literally named `Team Docs`, with subfolder `Q3 Plans`, 105 files, generated by Claude, uploaded by the operator (D-14).
- The second-upload response carries `already_in_library: true`, mirroring the Save-to-Library link behaviour.
- The public retention docs gain a plain "what retention does not remove" paragraph (D-07).

</specifics>

<deferred>
## Deferred Ideas

- Moving the Library delete (`documents.py`) onto the shared delete helper: blocked by the 275 D-32 fence. Re-open when a phase is allowed to change that handler's structure.
- A `document_id` on `message_artifacts` (which would make future enforcement possible): a new capability, not needed by D-06. Re-open if a customer or data-subject request (SEED-072) needs artifacts erased with their source.
- Seeds sweep: `node scripts/check-seeds-register.cjs --phase 280` matched **0** at discuss, because no PLAN.md existed yet (the gate states that this is a fact about the phase, not a clean sweep). **Re-run it after planning**, against the real `files_modified`.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (keyword score 0.6, matched on "upload/phases/run"): unrelated, and a new capability. The v4.6 repair-only rule forbids it.

</deferred>

---

*Phase: 280-in-once-out-clean*
*Context gathered: 2026-10-14*
