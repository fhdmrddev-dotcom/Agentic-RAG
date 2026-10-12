# Phase 274: Thread-Scoped Attachments - Research

**Researched:** 2026-10-05
**Domain:** chat attachment lifetime (`workspace_files`), promote-to-Library through the shipped minter, thread-delete storage cleanup, a negative ATT-02 audit
**Confidence:** HIGH for backend mechanics (every claim is a file:line read at HEAD `0ace2d2a4`). MEDIUM for the frontend composition (code read, never driven). Local Supabase and uvicorn were **down** at research time, so nothing here was driven live.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**'Ingested' meaning (ATT-01)**
- **D-01:** **Inline-only. D-244-03 stands.** A chat attachment is read by the agent (`workspace_read`, or `pypdf` in the sandbox for PDFs) and is **never chunked or embedded**. Retrieval gains no scope term, and the four Phase 231 RLS sites and 272's filter seam are untouched. "Ingested" in ATT-01 means *the agent can use it in that thread*, not *it has vectors*.
- **D-02:** **Keep the 10 MB cap** (`MAX_FILE_SIZE`, shared with the agent workspace). An oversize file gets the server's verbatim 422, as today. No separate attachment cap.
- **D-03:** **SC#1 is proven on the FULL native roster plus OpenRouter (8 rows)**, derived from `MODEL_CAPABILITIES` (one registry-backed, newest model per provider), never re-typed. Each row attaches a file with a **planted fact** that appears nowhere else, asks about it, and reads the answer. A row with no key or a known defect is recorded ⛔ with its reason, never dropped. This is the guard against the ROADMAP's named failure: *"ATT-01 passes only because the agent could never read the attachment."* Use the per-request `model` + `provider` method on `POST /threads/{id}/messages` (no global setting mutated).
- **D-04:** **The negative half of SC#1 is driven too:** the same planted fact, asked in a **second thread**, must not be answered from the attachment, and a document search for it returns nothing.

**Attachment lifetime (ATT-01, SC#4)**
- **D-05:** **A chat attachment lives for the life of its thread.** No 24h cliff. It stays usable until the thread is deleted. Promotion does not end it (D-11).
- **D-06:** **Workflow template inputs keep their 24h TTL.** Chat attachments and workflow template inputs are currently the same `kind='template_input'` through the same upload route, so the phase must make them distinguishable. *How* (a new `kind` value, an upload-route parameter, or a per-row `expires_at = NULL`) is Claude's discretion (see below). ⚠ Whatever is chosen must keep the `agent_loop._ATTACHMENT_KIND` allow-list and `ChatAttachmentChip.attachmentsForMessage` agreeing. They test the same string on both sides, and a split there means the agent stops being told about the file.
- **D-07:** **The chip copy drops "· 24h".** It says `this chat only` (sketch 236 / D-244-22's scope word stays; the duration goes). The expired-chip state (D-244-25) still exists for rows that genuinely expired before this phase, plus workflow template inputs.
- **D-08:** **Thread delete removes the attachment rows AND their bucket bytes.** `delete_thread` gains a best-effort removal of the thread's `workspace-files` objects, the same shape as the existing `sandbox-outputs` cleanup at `threads.py:1413-1441`. "Removed" means the bytes are gone, not just unreachable. ⛔ RLS read first (the user's own thread), then the removal. Never a service-role sweep keyed on a client-supplied id.

**Promote flow (ATT-03)**
- **D-09:** **One "Save to Library" action, two entry points:** the attachment chip on the sent message, and the file's row in the workspace panel's Files section. Both open **one shared dialog** (build once, mount twice, per the Phase 095 inventory rule). Only `template_input`/chat-attachment rows get it. Agent-written workspace files do not (out of scope; see Deferred).
- **D-10:** **The folder choice reuses `MoveToFolderDialog`** (`frontend/src/components/health/MoveToFolderDialog.tsx`). A folder is **required**: unset means refuse, never silently root (same rule as D-244-06). The confirm word is **`Save to Library`**. ⛔ Never `Attach` (the composer's word) and never `Import` (the cloud door's word).
  ⚠ **AMENDED 2026-10-05 by sketch 274 (the original above is kept, not deleted).** `MoveToFolderDialog` **cannot be reused as-is**: it is a flat `Select` that calls `moveDocument` itself and offers **"Root (no folder)"**, and `UploadFolderPicker` has the same Root sentinel. The binding rule is now: **a folder picker with NO Root option that returns a folder id and leaves the commit to the caller**, drawn as the sketch-274-A **searchable list of full paths** (D-15). Reuse `listFolders()`; do not reuse either shipped picker's Root branch.
- **D-11:** **Promotion COPIES.** The Library gets its own `documents` row through the shipped minter (`async_mint_document_row` → the normal splice/extraction/embedding pipeline). ⛔ No second ingest path, no hand-rolled insert. The thread attachment **stays** in the thread unchanged, and its chip gains an **`In Library · <folder>`** mark that links to the document. SC#4's *"promoted documents untouched by thread delete"* is then true by construction: the copy has no FK to the thread. The plan must still drive it (G-4 #4).
- **D-12:** **Rights are the Library upload door's rights.** Whoever can upload to that folder through the Library can promote into it. The folder-ownership/org check inside `async_mint_document_row` (its 403) is the authority. No new permission concept. ⛔ The promote route reads the attachment through the **user-JWT / RLS path** (the person's own thread) before minting, never service role first (the `BUG-260903-02` shape).

**Duplicate rule (ATT-03)**
- **D-13:** **Same bytes already in the org's Library → link, don't copy, and say where.** Same as the Library upload door (`documents.py:623`, `mint_result.is_duplicate` → 200 + existing doc). The dialog result and the chip both say **`Already in Library · <folder>`** and link to the existing document, **even when that folder differs from the one picked**. That difference is stated, never hidden. No dedup bypass. Mig 195/196's org-scoped indexes stand.
- **D-14:** **Same filename, different bytes, in the chosen folder → a new version, said up front.** This rides the shipped versioning (`is_latest` retirement). Before confirming, the dialog warns: *"This will become version N of `<name>` in `<folder>`."* There is no "keep both" (mint has no rename path).

**Guardrails**
- **D-15:** **G-2 FIRES → sketch BEFORE plan-phase (operator, 2026-10-05).** `/gsd:sketch` covers: (a) the chip's `Save to Library` action, (b) the dialog: folder tree, the D-13 *already in Library* result, the D-14 version warning, and the refusal states, and (c) the chip's `In Library · <folder>` and `Already in Library · <folder>` states. It **extends sketch 236** (`.planning/sketches/236-the-file-that-belongs-to-this-chat/`) rather than starting fresh, and ports its `COPY.js`. The operator-approved mockup is the acceptance bar. Per D-244-27, a text-only contract is not sufficient: the sketch's ordered composition is what the build reproduces.
  ✅ **RESOLVED 2026-10-05: sketch `274-save-to-library`, winner A (Menu on the chip).** The acceptance bar is `.planning/sketches/274-save-to-library/index.html`, its README's *Build Contract* and *WINNER* sections, and `COPY.js` (**ported, not re-typed**). Binding atoms: an always-visible `⋯` in the chip (touch-reachable) → *Save to Library… / Open in panel*. The dialog is a searchable full-path listbox with no Root, and confirm is disabled until a folder is picked. The chip gains a segment (`✓ In Library · <leaf>` / `Already in Library · <leaf>`) carrying `· indexing…` until the document is searchable. The same `⋯` sits on the panel Files row, and agent-written files get none. The chip drops `24h` (D-07). ⚠ The listbox needs real listbox a11y (`role=option`, `aria-selected`, keyboard), the 035-A obligation.
- **D-16:** **G-4: all four operator scenarios are driven in Chrome at verification**, not just asserted:
  1. **Library pollution:** attach a PDF in chat → it is NOT in the Library and NOT found by document search.
  2. **Agent can't see it:** attach a file, ask about it → the agent answers from it (the planted fact), never "I have no file" or an invention.
  3. **Promote lands wrong:** Save to Library → pick folder X → the document is in X (not root, not elsewhere) and the chip says `In Library · X`.
  4. **Delete eats the keeper:** promote, then delete the thread → the Library copy still opens and downloads, and the attachment's bucket bytes are gone.
- **D-17:** **Close `BUG-260905-01` on these driven rows.** Its `verified_closed_by` has been empty since 244 because no live row was driven. G-4 #1 and #3, plus a composer-door audit (D-18), are its reproduction. Flip `status: closed` only if they pass.
- **D-18:** **The ATT-02 audit is a NEGATIVE proof, not a visual one.** The ROADMAP's named failure is *"ATT-02 is met by hiding a button while an API path still writes Library rows from chat."* So the plan enumerates every `documents` minter (`async_mint_document_row` callers: `documents.py`, `import_service.py`, `watch_service.py`, `email_attachments.py`, `expert_install_service.py`, and the new promote route) and proves that none is reachable from a composer action **except** the explicit promote. The composer's `ConnectorsFlyout` "manage connections" link opens agent-tool connections and creates no watch. Confirm this; do not assume it.
- **D-19:** **G-5 audit at plan time.** Hot files this phase is likely to touch: `backend/app/api/threads.py` (FIRES, 88 phases), `backend/app/api/workspace.py` (FIRES), `backend/app/services/agent_loop.py` (FIRES, only if D-06 changes the allow-list), `frontend/src/components/chat/MessageItem.tsx`/`ChatArea.tsx` (FIRE, only if the chip mount changes), `frontend/src/components/panel/FilesSection.tsx` (FIRES), `frontend/src/components/chat/ChatAttachmentChip.tsx`, `backend/app/api/documents.py` (FIRES, if the promote route lives there), `backend/app/services/ingest_splice.py` (FIRES, read-only expected). Run `node scripts/check-hot-file-ledger.cjs` on the plan dir. Each touch on a FIRING file must be "honoured by construction" (additive, named seam) or propose the extraction first. The promote route goes in its **own small module**, not as another branch in `threads.py`.
- **D-20:** **G-8: target 3-5 plans.** Natural seams: (1) backend: promote route + lifetime split + delete cleanup; (2) frontend: the shared dialog + the two mounts + chip states; (3) live proof: the 8-row roster + G-4 drives + negative ATT-02 audit + bug close.

### Claude's Discretion
- **The mechanism that separates chat attachments from workflow template inputs** (D-06): a new `kind`, a route parameter, or `expires_at = NULL`. Pick the one that keeps the agent allow-list and the chip helper on one shared constant, and needs no migration if possible. If a `kind` CHECK constraint exists, a migration is unavoidable. Then: next free number, SQL-editor apply, regenerate `full-schema.sql`, `get_advisors(security)`.
- **Existing rows:** forward-only by default. Attachments that already expired under the 24h TTL are not resurrected, because a blanket `expires_at` reset would also revive workflow template inputs. Say so in the plan.
- **Where the promote route lives** (a new module is preferred over growing `threads.py`/`documents.py`), and whether promote copies bytes server-side from the workspace bucket/inline content into `documents` storage (expected: server-side, never a client re-upload).
- **What the `In Library` mark persists on** (a column on `workspace_files`, a `metadata.promoted_to`, or a lookup by `content_hash`). It must survive reload. Pick the cheapest honest option.

### Deferred Ideas (OUT OF SCOPE)
- **Chunk + embed a large attachment under a thread-scoped retrieval term** (`SEED-247` Q2/Q5/Q6). Out per D-01. **Re-open:** someone needs to *search* inside an attachment rather than have the agent read it.
- **A higher size cap for chat attachments** than the shared 10 MB. Out per D-02. **Re-open:** a refused upload is reported as a real need.
- **Promote an AGENT-written workspace file** (a generated report) to the Library. That is `SEED-038`'s generated-files/artifacts unification and Phase 273's territory, not a person's attachment. Out per D-09.
- **"Keep both" on a same-name promote** (rename instead of version). Needs a rename path mint doesn't have.
- **Removing a single attachment from a thread** (without deleting the thread). Not asked for by any criterion.
- Reviewed todo `spike-nl-workflow-authoring.md` — not folded.
- **`SEED-247` FOLDED** (Q4 = ATT-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATT-01 | A chat attachment is ingested and scoped to its thread, not the Library. | Already built (244); lifetime split via `expires_at = NULL` (§D-06 mechanism, no migration for this half); delete cleanup via `get_storage_paths_for_file`-shaped RLS read + `workspace-files` remove (§D-08); 8-row roster script modelled on `scripts/run-273-board.py` (§Live proof). |
| ATT-02 | Cloud connection and Library ingestion happen only from the Documents section. | Measured minter inventory (6 call sites incl. the new one) and composer import graph (§D-18 audit): no composer file imports any minting client. Pinned-set fence recommended. |
| ATT-03 | User can explicitly promote a thread attachment into the Library. | New `backend/app/api/workspace_promote.py`: RLS byte read (the `/raw` route's path) → `async_mint_document_row(version_scope="folder", org_id=active_org)` → `import_service._enqueue_or_splice`; mark persisted on migration **203** columns; D-14 preview endpoint (§Promote route). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend runs in `backend/venv`. No LangChain/LangGraph. Pydantic for structured shapes.
- Every table has RLS; users see only their own data.
- **Blocking supabase-py calls inside async handlers go through `aexec` / `run_in_threadpool`** (D-v2.5-01). The minter is already threadpooled (`async_mint_document_row`, `ingest_splice.py:348-381`).
- Migrations: `supabase/migrations/<digits>_name.sql`, **applied by pasting into the Supabase SQL editor, never `supabase db push`/`db reset`**, then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`.
- Supabase MCP points at **production**: reads free, **every write needs per-action operator approval**. Run `get_advisors(security)` in the deploy parity checklist.
- Realtime is a hint, never truth: reconcile by fetch (D-v2.5-03).
- **Backend unit baseline gate:** `pytest tests/unit -q --continue-on-collection-errors` (or `node scripts/check-backend-unit-baseline.cjs`), ceiling **71 failed, zero headroom**.
- **Frontend gates:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root (contract: no per-file decrease, 0 failing). Typecheck with `npx tsc -p tsconfig.app.json --noEmit` and **diff the error set** (67 errors at an older base; bare `npx tsc --noEmit` checks zero files).
- **G-5:** `node scripts/check-hot-file-ledger.cjs <phase>` must pass; every new source file gets a ledger row AT CREATION (row + its section in `docs/HOT-FILE-LEDGER.md`, same commit, cell ≤ 200 chars).
- **G-8:** 3-5 plans. Never cut the verifier, TDD RED drives, security review or migration discipline.
- **Cross-provider UAT roster rule:** 8 rows (7 native + OpenRouter), derived from the registry, blocked rows recorded ⛔ never dropped.
- **Deployment-artifact parity:** a seed-bearing migration or a new env var updates `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` in the same commit (`scripts/check-deploy-drift.sh`). This phase adds **no env var** (see §Don't hand-roll).
- **Worktrees:** bootstrap with `bash scripts/bootstrap-worktree.sh "$(pwd)"`; tear down only with `scripts/teardown-worktree.sh`; never `rm -rf`.
- **Provider-docs-first** applies only if the agent prompt text changes (see Pitfall 7). The note is the shared path; no provider-specific handling.
- Coordination (orchestrator): another session owns `frontend/src/components/chat/**` (ChatAttachmentChip/composerCopy unconfirmed), `ChatArea.tsx`, `MessageItem.tsx` until its merge. See §Coordination.

## Summary

Most of ATT-01/02 is built (Phase 244). The phase has four real build items. **(1) The lifetime split needs no migration.** A `workspace_files.kind` CHECK constraint exists (`kind IS NULL OR kind IN ('template_input','agent')`, mig 068, `full-schema.sql:3645`), so a new `kind` would need a migration. It would also have to be added to every `template_input` predicate: `agent_loop._ATTACHMENT_KIND`, the chip, `FilesSection`, `template_asset_service.py` (3 SQL sites that keep Deep-mode `render_template` working on chat attachments) and `pin_templates_for_run`. The cheaper and correct mechanism is to **keep `kind='template_input'` and write `expires_at = NULL`** for chat attachments. Every read gate already admits NULL (`expires_at IS NULL OR expires_at > now()`, 7 sites, all measured). The sweeper skips NULL (`template_service.py:56-59`), and the run-pin skips NULL by design (`:105`). The composer opts in with a query parameter on the existing upload route. The cloud attach route is composer-only, so it always writes thread-life.

**(2) The promote route** belongs in a new module, `backend/app/api/workspace_promote.py`. It **must not** live in `workspace.py`, whose source fence (`test_244_cloud_attach_is_thread_scoped.py::test_the_chat_attach_module_has_no_reach_to_the_library_minter`) forbids `ingest_splice` / `mint_document_row` / `table("documents")` there. The shipped pieces line up: read bytes exactly as `GET …/files/{id}/raw` does (user-JWT pg connection + `get_file_by_id` + `_get_file_content`, `workspace.py:631-686`), mint with `async_mint_document_row`, then hand off to `import_service._enqueue_or_splice`, which already has two callers. Three measured facts shape it:
- the minter versions by filename across **all** of the user's folders unless `version_scope="folder"` is passed. D-14's *"in the chosen folder"* is only true with `"folder"`.
- 4 of the 16 attachment extensions (`.json .py .js .sh`) are **not** accepted by the Library door.
- the stored workspace filename carries an 8-hex uuid prefix (`/{hex8}-{name}`, `workspace.py:336`), which must be stripped before it becomes a Library filename.

**(3) The `In Library` mark needs migration 203.** `workspace_files` has no jsonb column. `documents.metadata` cannot carry it because a duplicate mints nothing. A content-hash lookup can't tell "saved" from "already". So add `library_document_id uuid REFERENCES documents(id) ON DELETE SET NULL` plus `library_link text`. **(4) Delete cleanup** reads paths through RLS: `workspace_files` + `workspace_file_versions` both have `*_select_own` policies, and the storage bucket has `workspace_storage_delete_own` for `{uid}/…`. It then calls `storage.remove(paths)` with the user-JWT client. Only files over 256 KB live in the bucket (`DEFAULT_INLINE_THRESHOLD`, `workspace_service.py:35`), so the G-4 #4 file **must be > 256 KB**, or the drive proves nothing.

**Primary recommendation:** Four plans. A backend lifetime split + delete cleanup + migration 203. A backend promote module (promote / preview / library-links) with a pinned-minter-set fence. Frontend last, because of the coordination lock. Live proof last of all (8-row board script, G-4 Chrome drives, D-18 audit, bug close).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Attachment lifetime (thread-life vs 24h TTL) | API / Backend (`_persist_workspace_upload`) | Database (`expires_at` NULL semantics, existing read gates) | The ONE writer decides; every reader already treats NULL as "never expires". The client only states which door it is. |
| Promote (copy into Library) | API / Backend (new `workspace_promote.py`) | Database/Storage (minter → `documents` row; `documents` bucket; `ingestion_jobs`) | Bytes are copied server-side from the thread's own storage. A client re-upload would bypass the RLS read and the type gate. |
| Folder-ownership / dedup / versioning authority | API / Backend (minter, `ingest_splice.py:126-345`) | Database (`documents_dedup_idx`, `documents_completed_hash_unique_idx`) | D-12/D-13: the minter is the authority. The route must not pre-empt it with its own check. |
| Version / duplicate preview (D-14) | API / Backend (read-only preview route) | — | Must use the minter's own predicates. Advisory only; the post-confirm result is the minter's actual `MintResult`. |
| `In Library` mark persistence | Database (`workspace_files` mig 203 columns) | API (library-links read) | Must survive reload and cover the duplicate case, where no new document exists. |
| Delete cleanup of attachment bytes | API / Backend (`delete_thread` → helper) | Storage (`workspace-files` bucket, RLS delete-own policy) | D-08: RLS read, then remove, with the user-JWT client. |
| Chip `⋯` menu, dialog, folder listbox, segment | Browser / Client | API (promote/preview/library-links) | Pure presentation + one commit call. Folder paths derived with the shipped `folderPathOf`. |
| ATT-02 negative audit | Test / static (source + import fences) | Live (Chrome network + DB counts) | A hidden button proves nothing. Reachability is a code-graph property. |

## Standard Stack

**No new packages.** Every capability uses code already in the repo.

### Core (existing, reused)
| Asset | Location | Purpose | Why |
|---------|---------|---------|-----|
| `async_mint_document_row` / `MintResult` | `backend/app/services/ingest_splice.py:57-62, 126-381` | dedup, versioning, folder check, row insert | D-11: the ONE minter [VERIFIED: codebase read] |
| `_enqueue_or_splice` | `backend/app/services/sources/import_service.py:64-168` | bytes → `documents` bucket (service role), then `ingestion_jobs`; never-strand fallback | Already shared by `import_service` + `expert_install_service.py:56,492,616` [VERIFIED: codebase] |
| `get_file_by_id` + `_get_file_content` | `backend/app/db/workspace.py`, `workspace_service.py:176-185` | byte-exact read: inline (asyncpg `bytes`) or bucket | The `/raw` route's RLS read (`workspace.py:631-686`) [VERIFIED] |
| `_verify_thread_ownership` | `workspace.py:55-76` | 404 on non-owner (existence-leak rule) | Reuse by import, don't duplicate |
| `get_storage_paths_for_file` (shape) | `backend/app/db/workspace.py:283-295` | file + all-version storage paths | The sweeper's own path walk. The delete helper mirrors its UNION via the user-JWT client |
| `ALLOWED_MIME_TYPES`, `_EXT_MIME_OVERRIDES` | `backend/app/api/documents.py:117-182` | the Library door's type gate | D-12 parity: same types the Library accepts |
| `useCitationNav().openDocument(id)` | `frontend/src/lib/citationNav.tsx` | cross-view "open this document in the Library" (owner-scoped) | The chip's `In Library` link. No URL router exists |
| `requestOpenPanel()` | `frontend/src/components/panel/panelOpenSignal.ts` | reveal the workspace panel | "Open in panel" menu item (reveal only; see Open Q3) |
| `folderPathOf(id, folders)` | `frontend/src/components/chat/scopeCopy.ts:94-108` | full folder path, cycle-safe | Already used by `DocumentRow`, `FindQuickAdd` |
| `LinkTargetCombobox` (pattern, not mount) | `frontend/src/components/relationships/LinkTargetCombobox.tsx` | hand-wired APG combobox/listbox (no cmdk dep) | The a11y template the folder listbox copies (see Don't hand-roll) |
| `stripComments.testutil.ts` | `frontend/src/lib/stripComments.testutil.ts` | comment-stripped `?raw` fences | For the D-18 composer source fence |
| `scripts/run-273-board.py` `derive_roster` | `scripts/run-273-board.py:181-283` | effective roster (seed ∪ `model_capabilities_overrides`), newest per provider | D-03. Reuse, never re-type |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck not run (nothing to check).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | No new dependencies |

**Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
 COMPOSER (chat)                                      LIBRARY (Documents section)
 ─────────────────                                     ───────────────────────────
 + Attach a file ──POST /threads/{t}/workspace/files?lifetime=thread──┐
 + From cloud ─────POST /threads/{t}/workspace/files/from-connection──┤ (always thread-life)
                                                                      ▼
                                       _persist_workspace_upload  (ONE writer, workspace.py:303)
                                       kind='template_input', expires_at = NULL | now+TTL
                                                                      │
                                                    workspace_files row (+ bucket bytes if >256KB)
                     ┌────────────────────────────────┬───────────────┴──────────────┐
                     ▼                                ▼                              ▼
     agent note + sandbox hydration       transcript chip (sent)          panel Files row
     (list_files_in_thread gate)          ⋯ → Save to Library… / Open in panel   ⋯ → Save to Library…
                                                     │                              │
                                                     └────── SaveToLibraryDialog ───┘
                                                              │  listFolders() → full-path listbox (no Root)
                                                              │  GET …/files/{f}/promote-preview?folder_id=  (latest wins)
                                                              ▼
                     POST /threads/{t}/workspace/files/{f}/promote  {folder_id}   [workspace_promote.py]
                       1 _verify_thread_ownership (user-JWT)   2 get_file_by_id + _get_file_content (user-JWT pg)
                       3 type gate (Library door's set)        4 async_mint_document_row(version_scope="folder", org_id=active)
                       5 is_duplicate? ── yes ──► stamp link 'already' ─► 200 {document, outcome:'already'}
                                       └─ no ──► _enqueue_or_splice (documents bucket + ingestion_jobs)
                                                  ─► stamp link 'saved' ─► 201 {document, outcome:'saved'}
                                                              │
                     GET /threads/{t}/workspace/library-links ◄┘ (chip segment: leaf folder, status → "indexing…")

 THREAD DELETE  DELETE /threads/{t}  (threads.py:1399)
   RLS read workspace_files + workspace_file_versions storage paths ─► threads row delete (cascade rows)
   ─► storage.from_("workspace-files").remove(paths)  (user-JWT; best-effort, logged)
   documents rows: no FK to the thread → untouched; workspace_files.library_document_id goes with the row
```

### Recommended Project Structure (new files)
```
backend/app/api/workspace_promote.py        # promote / promote-preview / library-links routes (router prefix /threads/{thread_id}/workspace)
backend/app/models/workspace_promote.py     # PromoteRequest (folder_id: UUID, required, extra="forbid") + response models — or add to models/workspace.py (no ledger row: add one)
backend/app/services/thread_workspace_cleanup.py   # remove_thread_workspace_bytes(supabase, thread_id) — delete_thread calls ONE line
supabase/migrations/203_workspace_files_library_link.sql
backend/tests/unit/test_274_*.py
frontend/src/components/attachments/saveToLibraryCopy.ts       # PORT of sketch 274 COPY.js (?raw-fenced)
frontend/src/components/attachments/FolderPathListbox.tsx       # searchable full-path listbox, no Root, APG a11y
frontend/src/components/attachments/SaveToLibraryDialog.tsx     # the ONE dialog, mounted twice
frontend/src/components/attachments/AttachmentActionsMenu.tsx   # the ⋯ (chip + panel row)
frontend/src/components/attachments/useLibraryLinks.ts          # one fetch per thread, bounded poll while indexing
frontend/src/lib/attachmentLifetime.ts                           # isThreadLifeAttachment(file) + attachmentDisplayName prefix strip — ONE rule, many readers
frontend/src/lib/api/attachments.ts                              # promote / preview / library-links clients (+ re-export via lib/api.ts barrel if the barrel test requires)
```
Putting the new frontend code in `components/attachments/` (not `components/chat/`) keeps it out of the coordination lock. Only `ChatAttachmentChip.tsx`, its test, and possibly `useComposerAttachments.ts` remain in the locked directory.

### Pattern 1: Lifetime split = per-row `expires_at = NULL` chosen by the door (D-06)
**What:** `_persist_workspace_upload(..., lifetime: Literal["template","thread"])`. `"thread"` → `expires_at=None`; `"template"` → `now + template_ttl_hours` (byte-identical to today). `upload_template` gains `lifetime: Literal["template","thread"] = Query("template")`. `attach_connection_file` passes `"thread"` unconditionally, because it is composer-only (its sole frontend caller is `useComposerAttachments.ts:125`).
**Why this, not a new kind:** zero migration for this half. `_ATTACHMENT_KIND` (`agent_loop.py:1278`) and `attachmentsForMessage` (`ChatAttachmentChip.tsx:178`) **stay on the one string `"template_input"`, untouched**. That is exactly D-06's agreement requirement. All read gates already admit NULL:
`workspace.py:530,558,707,747` · `db/workspace.py:155-156,177-178,207,219` · `template_asset_service.py:212,249` · `get_file_by_id` `is_expired = expires_at IS NOT NULL AND expires_at <= now()`. The sweeper selects only `expires_at IS NOT NULL AND expires_at <= now()` (`template_service.py:56-59`), and the run pin only `expires_at IS NOT NULL` (`:105`) [VERIFIED: codebase].
**Response honesty:** `_persist_workspace_upload` must return `result["expires_at"] = None` (JSON `null`) for thread-life, never omit the key. The client distinguishes `null` (server says: lives with the thread) from absent/undefined (the wire did not say → `expiry unknown`). Precedent for `null` = "no deadline": `PendingAsk` (Phase 185, `types/index.ts`).
**Fence to keep green:** `test_244_cloud_attach_is_thread_scoped.py:191` pins `body.count("template_ttl_hours") == 1`, so keep the single read inside the `"template"` branch.
**Client side:** the composer opts in. Recommended: add `lifetime` to `uploadWorkspaceTemplate` with the server default (`"template"`), and change the one composer call (`useComposerAttachments.ts:94`) to pass `"thread"`. `TemplateUpload.tsx:40` (panel) and `ChatLayout.tsx:420` (workflow launch) stay byte-unchanged and keep TTL. See Open Q1 for the panel door.

### Pattern 2: Promote route — RLS read → minter → shared enqueue (D-11/D-12/D-13/D-14)
```python
# backend/app/api/workspace_promote.py — shape only; every call below exists at HEAD
@router.post("/files/{file_id}/promote")
async def promote_attachment(thread_id: str, file_id: str, body: PromoteRequest, request: Request,
                             background_tasks: BackgroundTasks, response: Response,
                             active_org: str = Depends(get_active_org_id),
                             current_user: dict = Depends(get_current_user),
                             supabase: Client = Depends(get_user_supabase_client)):
    await _verify_thread_ownership(thread_id, current_user, supabase)          # workspace.py:55 — 404
    fid = _uuid_or_404(file_id)
    async with get_user_pg_connection(request, current_user) as conn:          # D-12: user-JWT FIRST
        row = await get_file_by_id(conn, fid)
        if not row or str(row["thread_id"]) != thread_id or row.get("is_expired"):
            raise HTTPException(404, "File not found")
        if row.get("kind") != "template_input":                               # D-09: agent files get none
            raise HTTPException(404, "File not found")
        raw = bytes(await _get_file_content(conn, supabase, row))             # inline OR bucket, byte-exact
    # idempotency: row already linked to a live document → return that link, mint nothing
    filename = library_filename(row["path"])                                  # strip ^/[0-9a-f]{8}- (Pitfall 3)
    mime = library_mime(filename, row["mime_type"])                           # _EXT_MIME_OVERRIDES first (Pitfall 4)
    if mime not in ALLOWED_MIME_TYPES: raise HTTPException(422, <the Library door's own sentence>)
    mint = await async_mint_document_row(raw=raw, filename=filename, mime_type=mime,
              user_id=current_user["id"], supabase=supabase, folder_id=str(body.folder_id),
              org_id=str(active_org), on_conflict="link", version_scope="folder")   # 403/404 propagate verbatim
    if not mint.is_duplicate:
        await _enqueue_or_splice(doc=dict(mint.document), raw=raw, mime_type=mime, filename=filename,
              user_id=current_user["id"], active_org=str(active_org),
              storage_path=mint.storage_path, background_tasks=background_tasks)
    # stamp workspace_files.library_document_id / library_link via the user-JWT client (update_own policy)
    # audit: write_audit_entry(action_type="document.upload", metadata={..., "source": "thread_attachment"})
```
- **`version_scope="folder"`** (`ingest_splice.py:236-253`): with the default `"user"`, a same-named file in **any** folder is versioned and its `is_latest` retired. Retrieval requires `is_latest`, so this would silently pull the other folder's copy out of search (WR-03, 266). It would also contradict D-14's *"in the chosen folder"* warning. `"folder"` makes the warning literally true.
- **`org_id=active_org`**: dedup and versioning become org-scoped, matching mig 195/196 and D-13's *"the org's Library"*. Same as `import_service.py:244` and the Expert installer. ⚠ `/upload` passes **no** org_id (SEED-313, accepted), so the promote door is deliberately the org-scoped variant. State that in the plan.
- **`on_conflict="link"`** collapses a double-click or concurrent same-folder race (23505 on `documents_dedup_idx`) into `is_duplicate=True` instead of a 409.
- **Minter refusals propagate verbatim:** `404 "Folder not found"` (`ingest_splice.py:169`) and `403 "Cannot upload to a folder you do not own"` (`:171-174`). Org-shared folders are visible to RLS (`"Users can view own and global folders"`, `full-schema.sql:7294`), so the 403 is genuinely reachable from the picker, as sketch 274 draws it (`f8 locked`).
- **Response:** `201 {document, outcome: "saved", folder_id}` / `200 {document, outcome: "already", folder_id: <existing doc's folder>}`. The dialog's D-13 screen needs the **existing** document's folder, which can differ from the picked one.

### Pattern 3: D-14 preview — read-only, per selection, latest wins
`GET /threads/{t}/workspace/files/{f}/promote-preview?folder_id=X` → `{duplicate_of: {document_id, folder_id} | null, next_version: int | null, promotable: bool, refusal: str | null}`.
- `duplicate_of` uses the minter's predicate (`user_id, content_hash, status='completed', org_id`, `ingest_splice.py:212-231`). It needs the bytes hashed once per dialog open, since the hash does not depend on the folder.
- `next_version` uses the minter's folder-scoped version lookup (`user_id, filename, org_id, folder_id`, `:236-253`). Show the D-14 warning only when `duplicate_of is null and next_version > 1`. A duplicate pre-empts versioning inside the minter (dedup returns before step 4).
- **Precedent for the UI shape:** `ScopePicker.tsx` previews every draft via `GET /threads/{id}/scope-effect`, one request per selection, latest wins (Phase 268).
- **Drift guard (don't touch the minter):** the preview mirrors two predicates, so pin them with a **parity test**. Run preview then `mint_document_row` against the same fake-supabase fixture and assert `preview.duplicate_of ⇔ mint.is_duplicate` and `preview.next_version == mint.version_number`, for the four cases (fresh / same-name-same-folder / same-name-other-folder / same-bytes-other-folder). The preview is advisory. The result screen always renders the actual `MintResult`, so a stale preview cannot misstate the outcome.

### Pattern 4: Delete cleanup — RLS-derived paths, explicit removal (D-08)
```python
# backend/app/services/thread_workspace_cleanup.py
async def collect_thread_workspace_paths(supabase, thread_id) -> list[str]:
    files = await aexec(supabase.table("workspace_files").select("id, content_storage_path").eq("thread_id", thread_id))
    ids = [r["id"] for r in files.data or []]
    vers = await aexec(supabase.table("workspace_file_versions").select("content_storage_path").in_("workspace_file_id", ids)) if ids else None
    return sorted({p for p in [r.get("content_storage_path") for r in (files.data or [])] +
                   [r.get("content_storage_path") for r in ((vers.data if vers else None) or [])] if p})

async def remove_workspace_paths(supabase, paths) -> None:   # best-effort, LOGGED (not a bare `pass`)
    for chunk in chunks(paths, 100):
        await run_in_threadpool(supabase.storage.from_("workspace-files").remove, chunk)
```
`delete_thread` gains: collect (before the delete, because the cascade drops the rows) → existing `threads` delete → remove. **Order recommendation:** remove bytes **after** the row delete succeeds. That deviates slightly from the sandbox block, which removes first. If the thread delete fails, removing first would leave live rows pointing at missing bytes. Supabase Storage has **no prefix delete**, and `list()` is one level deep, non-recursive, and paginated (`{uid}/{thread}/{file_id}/v{n}` would need a 2-level walk). The DB-derived path set is complete for every row-backed object, including agent-written bucket files, which D-08 also covers since all `workspace_files` rows cascade. RLS: `workspace_files_select_own`, `workspace_versions_select_own`, and storage `workspace_storage_delete_own` (`(storage.foldername(name))[1] = auth.uid()`, `full-schema.sql:8678-8679`), so the user-JWT client can do the whole job [VERIFIED: schema].

### Pattern 5: The mark — migration 203
```sql
-- supabase/migrations/203_workspace_files_library_link.sql
ALTER TABLE public.workspace_files
  ADD COLUMN IF NOT EXISTS library_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS library_link text CHECK (library_link IS NULL OR library_link IN ('saved','already'));
CREATE INDEX IF NOT EXISTS idx_workspace_files_library_document_id
  ON public.workspace_files (library_document_id) WHERE library_document_id IS NOT NULL;
COMMENT ON COLUMN ... -- Phase 274 (ATT-03): the Library document this attachment was promoted to / linked with.
```
- **`ON DELETE SET NULL` is mandatory.** `DELETE /documents/{id}` hard-deletes (`documents.py:1861,1871`). A plain FK (NO ACTION) would make every promoted document **undeletable** (23503).
- ⛔ **Do NOT add a pairing CHECK** like `(library_document_id IS NULL) = (library_link IS NULL)`. `SET NULL` nulls only the FK column, so the check would then reject the document delete. Readers treat `library_link` as meaningful only when `library_document_id` is non-null.
- Table-level default grants cover new columns. `workspace_files` has no column-level GRANTs (unlike `connector_connections`, whose column grants are a known trap), and `workspace_files_update_own` lets the user-JWT client stamp the link.
- The next free number at HEAD is **203** (`ls supabase/migrations/` → max `202_message_artifacts.sql`). Re-check at execute time. No phase directory 275 exists yet, but other sessions are active. **Cloud order:** prod still needs 202 first (memory: Phase 273), then 203. The code must not ship before 203 is applied, because the promote route's stamp and the library-links read select the columns. Make the stamp best-effort (log) so a missing column cannot fail a promote **after** the mint.

### Pattern 6: Chip + panel composition (sketch 274 A)
- **The chip owns its menu and dialog.** `MessageItem.tsx:359` mounts `<ChatAttachmentChip key file state="sent" />`. The chip reads the thread with `useViewingThread()` (as `FilesSection` does), so **`MessageItem.tsx` (FIRES, coordination-locked) is not touched at all**.
- The `⋯` renders **only in `sent`**. The composer's pending chip (`MessageInput.tsx:540`) gets no Save action, which keeps the D-18 composer fence true.
- Segment: `✓ In Library · <leaf>` (saved) or `Already in Library · <leaf>` (already). The full path goes in `title` **and** in the panel row (the tooltip must not be the only home). Show `· indexing…` while the document's `status ∈ {pending, processing}`. `documents.status` CHECK = `pending|processing|completed|failed` (`full-schema.sql:1626`); the frontend type adds `paused` (`types/index.ts:609`). The link calls `useCitationNav().openDocument(document_id)`.
- Panel row (`FilesSection.tsx:309-335` trailing slot): a thread-life attachment shows `size · this chat only` + the `⋯` / after-mark **instead of** the `Template` badge + countdown. TTL rows keep the badge and countdown, and agent rows render byte-identically. Extract the trailing-slot content into one new component rather than growing `FilesSection`'s body (G-5).
- ⚠ **a11y nesting:** the panel row is a `role="option"` inside `role="listbox"` (`FilesSection.tsx:279, 337-341`). An interactive `⋯` button inside an option breaks the APG listbox pattern. Either place the menu trigger outside the option element (sibling in the row container) or give it `tabIndex={-1}` and reach it with a row-level key (e.g. `Shift+F10`/`ContextMenu`). Decide in the UI plan and test with the keyboard.

### Anti-Patterns to Avoid
- **Putting the promote route in `workspace.py`.** Its fence fails on `ingest_splice` / `mint_document_row` / `table("documents")`, and the structural guarantee *"the chat door cannot reach the minter"* is the whole point of that module (ledger §workspace.py, 244-06 invariant).
- **Using `/content`'s `_decode_inline_content` to read bytes.** It decodes to **UTF-8 text** (`workspace.py:79-123`) and corrupts every binary (docx/xlsx/pdf/png). Use `_get_file_content` over the user-JWT asyncpg connection (asyncpg returns `bytea` as `bytes`).
- **A client re-upload** of the attachment to `/documents/upload`. It skips the RLS read, doubles the transfer, and is a second ingest door.
- **Re-deriving the expiry readings.** One predicate module (`attachmentLifetime.ts`) imported by the chip and `FilesSection`, per the 244 "one rule, two readers" discipline (`ChatAttachmentChip.tsx` docblock).
- **A new audit `action_type`.** `assert_action_types_synced` hard-fails uvicorn boot when `VALID_ACTION_TYPES` holds a value missing from the live `audit_log` CHECK (`audit_service.py:31-56`). Reuse `"document.upload"` with `metadata.source = "thread_attachment"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Document creation | an `INSERT INTO documents` | `async_mint_document_row` | dedup/version/folder-403/storage-key sanitising (`_storage_safe`) and 23505 handling are all inside |
| Post-mint ingest | `background_tasks.add_task(splice_document)` | `import_service._enqueue_or_splice` | BUG-260905-04: a direct splice skips retries, lease recovery, concurrency cap and enriched metadata |
| Byte read | `supabase-py` select of `content_inline` | `get_file_by_id` + `_get_file_content` on `get_user_pg_connection` | supabase-py returns hex-bytea strings; asyncpg returns `bytes` (the `/raw` route's reason to exist) |
| Folder path strings | a new path builder | `folderPathOf` (`scopeCopy.ts:94`) | cycle-safe, already used in two places |
| Listbox a11y | a fresh combobox | copy `LinkTargetCombobox`'s APG wiring (combobox + `aria-activedescendant` + `role=option` + `aria-selected`); render leaf bold / parent dim | Don't fork the shared component (Find + CreateLink mount it). Don't add `cmdk` |
| Open a Library document from chat | a new nav bus | `useCitationNav().openDocument` | owner-scoped, already wired for citations |
| Roster derivation | a hand-typed model list | `derive_roster` in `scripts/run-273-board.py` | seed ∪ overlay, newest-per-provider, blocked rows ⛔ |
| Storage path set for a thread | a storage `list()` walk | the DB UNION (`get_storage_paths_for_file` shape) | no prefix delete. `list()` is one-level and paginated |

**Key insight:** every step of the promote flow already exists in a shipped door. The phase's risk is in the **parameters** (`version_scope`, `org_id`, `on_conflict`, filename/mime derivation) and the **placement** (module boundaries the fences rely on), not in new machinery.

## Runtime State Inventory

(This phase changes lifetime semantics on existing data, so this is included.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workspace_files` rows with `kind='template_input'` and a non-null `expires_at` (all pre-274 chat attachments + workflow inputs) | **None, forward-only** (CONTEXT discretion). Rows uploaded < 24h before deploy still expire on their old clock, and expired rows are not resurrected. State this in the plan. Migration 203 adds nullable columns, no backfill |
| Live service config | none. `app_settings.template_ttl_hours` keeps governing workflow inputs | none |
| OS-registered state | none. The in-process sweeper (`main.py:461-474`) keeps running and skips NULL-expiry rows by its own predicate | none (verify the sweep's SELECT is unchanged) |
| Secrets/env vars | none. No new env var | none (deploy-drift script unaffected) |
| Build artifacts | none | none |
| **Storage (pre-existing orphans)** | Bucket bytes of threads deleted **before** this phase are already orphaned under `workspace-files/{uid}/{thread}/…` with no rows | **Out of scope by default.** D-08 is forward. A one-off orphan sweep would be a service-role job and must be its own operator-approved decision. Record as an observation |

## Common Pitfalls

### Pitfall 1: A 244 test asserts the opposite of D-05
**What goes wrong:** `test_244_cloud_attach_is_thread_scoped.py:108-115` asserts `stubbed["expires_at"] is not None, "a chat attachment without a TTL is a Library row"`. D-05 makes that false on purpose.
**How to avoid:** retire it **deliberately** (the SEED-177 / D-206-07 precedent). Rewrite the assertion to the new invariant (`expires_at is None` AND `kind == "template_input"` AND no `documents` reach) and write the reason into the test body. Same for `test_244_attachment_prompt_line.py:119-121` (`"expire" in note`) if the prompt text changes (Pitfall 7), and `ChatAttachmentChip.states.test.tsx` cases 1, 4 and 4b (`chipTtl` / `expiry unknown` on the chip).
**Warning signs:** a red test "fixed" by restoring the TTL.

### Pitfall 2: `version_scope` default silently retires another folder's document
**What goes wrong:** with `version_scope="user"`, promoting `report.pdf` into folder X when `report.pdf` lives in folder Y makes X's copy v2 and flips Y's `is_latest=false` (`ingest_splice.py:241-253`). Y's document disappears from retrieval (retrieval requires `is_latest`).
**How to avoid:** pass `version_scope="folder"`. Make the preview's version lookup folder-scoped to match, and test "same name, other folder → v1, other folder's is_latest untouched".

### Pitfall 3: The workspace filename carries a uuid prefix
**What goes wrong:** uploads are stored at `/{uuid4().hex[:8]}-{safe_name}` (`workspace.py:336`). Minting that name makes the Library document `1a2b3c4d-Meridian.xlsx`. Versioning never matches, because every promote has a different prefix, so D-14 can never fire. The same is likely already visible on the shipped chip (`attachmentDisplayName` = last path segment, `ChatAttachmentChip.tsx:77-80`). This was measured in code, not live.
**How to avoid:** one rule, `^[0-9a-f]{8}-` stripped from the basename. Server side: `library_filename()` in the promote module. Client side: in `attachmentDisplayName` (sketch 274/236 draw the clean name). Pin both to one regex with a lockstep test. ⚠ The safe-name sanitiser has already replaced non-`[A-Za-z0-9._\- ]` characters (`workspace.py:333-335`), so `Q3 Report (final).docx` is minted as `Q3 Report _final_.docx`, and it will not version against a Library document uploaded under its original name. The original filename is not stored. Accept this and say so.

### Pitfall 4: MIME from the workspace row is platform-dependent
**What goes wrong:** `workspace_service.guess_mime_type` uses `mimetypes`, which reads the Windows registry here. Measured on this box: `.csv → application/vnd.ms-excel`, `.webp → None → octet-stream`, `.py → text/x-python`. A `.csv` promoted as `application/vnd.ms-excel` passes the gate but is routed as Excel at extraction.
**How to avoid:** `mime = _EXT_MIME_OVERRIDES.get(ext) or row.mime_type`, then gate on `ALLOWED_MIME_TYPES`. Measured verdict across the 16 attachment extensions: **12 promotable** (`.docx .pptx .xlsx .md .csv .txt .png .jpg .jpeg .gif .webp .pdf`) and **4 refused** (`.json .py .js .sh`). Sketch 274 draws no state for a type refusal → **Open Q2**.

### Pitfall 5: Dangling FK blocks document deletion
See Pattern 5. A plain `REFERENCES documents(id)` turns every promoted document into one `DELETE /documents/{id}` cannot remove. `ON DELETE SET NULL`, no pairing CHECK.

### Pitfall 6: G-4 #4 passes vacuously with a small file
**What goes wrong:** files ≤ 256 KB are stored inline (`DEFAULT_INLINE_THRESHOLD = 256 * 1024`, `workspace_service.py:35`) and cascade with the row. Only bucket files can orphan. A 40 KB test PDF makes "bytes are gone" true before the fix too.
**How to avoid:** the drive uses a file **> 256 KB and < 10 MB**. Prove presence before delete and absence after with `SELECT count(*) FROM storage.objects WHERE bucket_id='workspace-files' AND name LIKE '<uid>/<thread_id>/%'` (local DB read). **Drive it RED first:** run the drive on the base code and watch the count stay > 0. ⚠ `storage.remove` reports success for objects RLS silently skipped, so assert on `storage.objects`, never on the remove() return value.

### Pitfall 7: The agent note still says "They expire"
**What goes wrong:** `_build_attachment_note` (`agent_loop.py:1327-1335`) tells every model *"They expire, so use them in this conversation rather than assuming they persist."* After D-05 that is false for chat attachments, and this note's own stated invariant is that the prompt says exactly what the data model says.
**How to avoid (recommended, needs planner acceptance because D-19 scoped agent_loop to allow-list changes only):** a one-literal edit dropping the expiry claim, e.g. *"They stay with this conversation; use them here rather than assuming they exist anywhere else."* No branch, no allow-list change; honoured by construction on a FIRING file. It is the shared prompt path, so the 8-row roster (D-03) covers it. Retire `test_the_note_says_the_files_expire` deliberately. If declined, record it as a known inaccuracy.

### Pitfall 8: The expired chip's "why" copy becomes half-true
`COPY.shared.expiredWhy = "Files attached to a chat are kept for 24 hours."` (sketch 236, `composerCopy.ts`). After 274 only pre-274 chat rows and workflow inputs expire. Sketch 274's `COPY.js` does not redefine it, and the 236 `?raw` fence (`ChatAttachmentChip.states.test.tsx` case 5) pins the value to the 236 sketch. **Open Q4:** keep it (true for every row that can still show it, except workflow inputs) or amend the 236 sketch COPY and the port together.

### Pitfall 9: Hydration cap reached sooner
`_ATTACHMENT_HYDRATION_MAX_FILES = 50` (`tool_dispatcher.py:1765`). Thread-life attachments accumulate instead of ageing out, so a long thread can now hit the cap. The truncation is already named in a note to the model (244-10). This is an observation, with no action in scope.

### Pitfall 10: The detach registry window widens
`ChatAttachmentChip.tsx:85-101`: after a reload, a file detached in the composer re-associates with the next message *"within the TTL"*. With no TTL that window no longer closes, but it is still bounded to the next user message by the association rule. This is a documented limit and does not get worse in kind. Mention it in the plan, don't fix it (single-attachment removal is Deferred).

### Pitfall 11: Org context
The dev account is in **two** orgs (memory). `listFolders()` returns folders across all orgs the user belongs to (`folders.py:11-20`, no org filter). The minter checks folder **ownership**, not folder org. A folder in org A promoted with `org_id=active_org` = B mints a B-org document into an A-org folder. **Recommendation:** the live drive asserts a single active org first (`run-273-board.py:_single_org` pattern). Record the cross-org-folder case as an observation, not a fix: it is the Library door's existing behaviour, and D-12 forbids a new permission concept.

## Code Examples

### Byte-exact RLS read (reuse, `workspace.py:666-679`)
```python
async with get_user_pg_connection(request, current_user) as conn:
    row = await get_file_by_id(conn, fid)
    if not row or str(row.get("thread_id")) != thread_id or row.get("is_expired"):
        raise HTTPException(status_code=404, detail="File not found")
    content_bytes = await _get_file_content(conn, supabase, row)
```

### The minter's refusals (verbatim, `ingest_splice.py:168-174`)
```python
if not folder_check.data:
    raise HTTPException(status_code=404, detail="Folder not found")
if folder_check.data["user_id"] != user_id:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot upload to a folder you do not own")
```
Sketch 274's `COPY.engine.REFUSE_NOT_OWNER` / `REFUSE_NO_FOLDER` are these two strings. The port's `?raw` fence should also read `ingest_splice.py` and assert both appear, which makes the engine facts a mechanism.

### The sandbox cleanup the delete helper mirrors (`threads.py:1413-1441`)
```python
exec_resp = await aexec(supabase.table("code_executions").select("id").eq("thread_id", thread_id).eq("user_id", current_user["id"]))
...
await run_in_threadpool(supabase.storage.from_("sandbox-outputs").remove, paths)
```

### Roster + per-request send (`scripts/run-273-board.py:197-283, 373-379`)
```python
requests.post(f"{base}/threads/{thread_id}/messages", headers=h, timeout=60,
              json={"content": content, "model": model, "provider": provider})
```

## D-18 negative audit: measured inventory

**Backend minters** (`grep -rn "mint_document_row" backend/app`, excluding the definition):

| Caller | Reached from | Composer-reachable? |
|---|---|---|
| `api/documents.py:613` `POST /documents/upload` | Library `DocumentUpload.tsx`, `useDocuments.ts` (`uploadDocument`) | No |
| `services/sources/import_service.py:237` ← `api/connectors.py:1837` `POST /connectors/connections/{id}/files/{fid}/import` | `LibraryCloudImport.tsx` (`importCloudFile`) | No (D-244-05 moved the composer off it) |
| `services/watch_service.py:344,422` (background `_poll_loop`) ← watches created by `POST /sources/watches` | `CreateWatchModal.tsx` (mounted in `IngestionTab.tsx` / `LibraryPage.tsx`) | No |
| `services/email_attachments.py:357` ← `ingest_splice.py:850` / `documents.py:2398` (inside the ingest of an **already-minted** email doc) | downstream of any door | Only via a Library door |
| `services/expert_install_service.py:603` ← `api/experts.py:611` `POST /experts/{id}/install` | `ExpertCatalogPage.tsx` (`installExpert`) | No (`InviteExpertDialog` in the composer does not import `installExpert`, measured) |
| **NEW** `api/workspace_promote.py` | the sent chip + panel row only | **By design, and only from a SENT chip, never the pending composer chip** |

No other `documents` insert exists (`grep -rniE "insert into (public\.)?documents|table\(\"documents\"\)\.insert"` → only `ingest_splice.py:308`).

**Composer import graph** (measured): `MessageInput.tsx`, `useComposerAttachments.ts`, `ConnectedFilePickerModal.tsx`, `ConnectorsFlyout.tsx` and `InviteExpertDialog.tsx` reference `uploadDocument|importCloudFile|createWatch|installExpert` **only in comments** (`ConnectedFilePickerModal.tsx:15`, `useComposerAttachments.ts:104`). `ConnectorsFlyout` imports only `listConnectorConnections` (`ConnectorsFlyout.tsx:12`), and its link navigates to `onNavigate("connections")` (`ChatLayout.tsx:872`) → `ConnectionsPage`, which imports no minting client. Watch creation lives only under the Library (`IngestionTab`/`LibraryPage`).

**Recommended fences:**
1. **Backend pinned-minter-set test:** AST/grep over `backend/app/**/*.py`. The set of modules calling `mint_document_row|async_mint_document_row` equals exactly `{api/documents.py, services/sources/import_service.py, services/watch_service.py, services/email_attachments.py, services/expert_install_service.py, api/workspace_promote.py}`. A new minter fails it. Drive RED with a planted call.
2. **Frontend composer source fence** (comment-stripped `?raw` of the five composer files): none of `uploadDocument`, `importCloudFile`, `createWatch`, `installExpert`, `/documents/upload`, `/sources/watches`, `/install`, `promoteAttachment`.
3. **Render test:** the pending chip renders no `⋯`; the sent chip does.
4. **Live:** Chrome network log during a composer attach shows only `/workspace/files*` calls, and `SELECT count(*) FROM documents WHERE user_id=…` is unchanged.

## Coordination & G-5

**Hot-file gate measured** (`node scripts/check-hot-file-ledger.cjs --files …`, 2026-10-05): rows exist for `workspace.py` (FIRES), `threads.py` (FIRES, row `264/89/2456`), `documents.py` (FIRES), `ingest_splice.py` (FIRES), `agent_loop.py` (FIRES), `main.py` (FIRES), `FilesSection.tsx` (FIRES, row stale at `10/6/363`, measured `11` commits), `ChatAttachmentChip.tsx` (row stale at `1/1/144`, measured `3` commits / `256` lines), `composerCopy.ts`, `useComposerAttachments.ts`, `lib/api/documents.ts` (FIRES), `lib/api.ts` (FIRES), `types/index.ts` (FIRES), `MessageItem.tsx` (FIRES), `WorkspacePanel.tsx` (FIRES). **No row (the gate fails if named):** `backend/app/db/workspace.py`, `backend/app/models/workspace.py`, `backend/app/services/template_service.py`, `backend/app/services/workspace_service.py`. Avoid modifying them, or add rows. Every **new** file gets its row at creation.

**How each FIRING touch is honoured by construction:**
| File | Touch | Invariant that binds |
|---|---|---|
| `workspace.py` | `lifetime` query param on `upload_template`; `lifetime` kwarg on `_persist_workspace_upload`; cloud route passes `"thread"` | ONE writer (244-06); `template_ttl_hours` count stays 1; **no minter import** |
| `threads.py` | ONE call each to collect/remove in `delete_thread` (helper module) | "0 new send-path branches" (273-04 cell); thin call-through like `template_service` |
| `main.py` | ONE `include_router(workspace_promote.router)` | 276-01 precedent |
| `agent_loop.py` | (optional, Pitfall 7) one literal | `_ATTACHMENT_KIND` unchanged; prompt-assembly seam still OWED |
| `ingest_splice.py` | **read-only** | 0 edits; parity test instead of a preview helper |
| `documents.py` | **read-only** (import `ALLOWED_MIME_TYPES`, `_EXT_MIME_OVERRIDES`) | 0 edits |
| `FilesSection.tsx` | trailing-slot branch delegated to one new component | expiryCaption's three readings unchanged for non-attachment rows |
| `lib/api/documents.ts` | `lifetime` param on `uploadWorkspaceTemplate` | default = today's behaviour |
| `types/index.ts` | `expires_at?: string \| null`; optional `library_*` fields | additive |
| `MessageItem.tsx`, `ChatArea.tsx` | **none** (chip self-contained) | — |

**Frontend files in the coordination-locked set (`frontend/src/components/chat/**`):** `ChatAttachmentChip.tsx`, `__tests__/ChatAttachmentChip.states.test.tsx`, `useComposerAttachments.ts` (one argument), and `composerCopy.ts` only if the 236 port changes (Open Q4). **Sequence the frontend plan last.** Everything else lives in `components/attachments/`, `lib/`, `components/panel/` or `types/`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Composer cloud door → Library import (root) | Composer → `workspace_files` (thread) | Phase 244 (D-244-05) | ATT-02 largely already true; this phase proves it |
| Chat attachment = 24h template TTL | Thread-life (`expires_at NULL`) | Phase 274 | Chip drops `24h`; delete cleanup becomes the only end of life |
| Minter versioning user-wide by filename | `version_scope="folder"` available | Phase 266 WR-03 | Promote must opt in |

**Deprecated/outdated:** `MoveToFolderDialog` / `UploadFolderPicker` for this flow (Root sentinel; D-10 amended).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | supabase-py `storage.remove` succeeds silently for paths RLS does not permit (so assertions must read `storage.objects`) | Pitfall 6 | Low. The recommended assertion is DB-based anyway [ASSUMED] |
| A2 | Supabase Storage `list()` is non-recursive with a default limit of 100 | Pattern 4 | Low. The design does not use `list()` [ASSUMED] |
| A3 | The shipped chip visibly shows the `hex8-` prefix in the transcript | Pitfall 3 | Low. Code says yes; confirm in the first Chrome drive [ASSUMED from code read] |
| A4 | Linux prod `mimetypes` maps `.csv → text/csv` | Pitfall 4 | None if `_EXT_MIME_OVERRIDES` is applied first [ASSUMED] |
| A5 | No other in-flight session is claiming migration 203 | Pattern 5 | Medium. Re-`ls` at execute time |

## Open Questions

1. **Does the panel's `TemplateUpload` (Files section upload) get thread-life too?**
   - Known: it posts to the same route (`TemplateUpload.tsx:40`). Its rows wear the chat chip in the transcript (`attachmentsForMessage` matches any `template_input`) and are announced to the agent as *"The user attached these files"*. It is badged `Template` with a countdown in the panel.
   - Unclear: D-06 says "workflow template inputs keep 24h", but this door lives in a chat thread's panel.
   - Recommendation: **keep TTL (no change)** for minimal blast radius and literal D-06 compliance. Flag to the operator. If the answer is "thread-life", it is one argument in `TemplateUpload.tsx`.
2. **Type refusal state for `.json/.py/.js/.sh`.** Sketch 274 does not draw it. Recommendation: the preview returns `promotable:false` + the Library door's own 422 sentence. The dialog shows it in the refusal slot under a lead **distinct** from `refuseLead` ("You can't save into this folder." would be false), with confirm disabled. Needs one copy line added to the 274 sketch `COPY.js` (sketch-first rule), or an operator ruling.
3. **"Open in panel" depth.** `requestOpenPanel()` only reveals the panel; selecting the specific file would need a payload on `panelOpenSignal` + `WorkspacePanel` (FIRES). Recommendation: reveal-only, since the Files section lists the row. Confirm against the sketch's intent.
4. **`expiredWhy` copy** (Pitfall 8): keep, or amend sketch 236 COPY + port together.
5. **Failed ingest on the segment.** If the promoted document ends `failed`, the sketch has no state. Recommendation: the segment drops `indexing…` and shows the document's own failure through the link target (Library detail panel). Planner/UI to decide whether a `· failed` word is added (needs sketch copy).
6. **Agent-note wording** (Pitfall 7): accept the one-literal edit on `agent_loop.py`, or record the inaccuracy.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | frontend gates, hot-file/seeds gates | ✓ | v24.19.0 | — |
| Python venv | backend tests, board script | ✓ | 3.12.6 (`backend/venv`) | — |
| Local Supabase (54321/54322) | migration apply, live drives, storage proof | ✗ at research time (HTTP 000) | — | `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`. Check the Windows port-reservation trap first |
| uvicorn backend (:8000) | board + Chrome drives | ✗ at research time | — | **operator starts it** (memory: user starts backend) |
| Provider keys (8 roster rows) | D-03 | unknown | — | ⛔ rows recorded with reason; derive with `--roster` first |
| A live Google Drive connection | BUG-260905-01 `re_open_trigger` names *"a real Google Drive connection"* for the cloud half | unknown | — | If absent, the cloud-attach half of G-4 #1 is recorded ⛔ and the bug stays `folded` (D-17: close only on driven rows) |
| Chrome MCP | G-4 drives | assumed available (prior phases) | — | — |

**Blocking without fallback:** none for planning. Execution needs the local stack up (operator).

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`. Included anyway because the orchestrator asked for it explicitly.

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest (venv), `backend/tests/unit/` |
| Frontend | vitest via `scripts/vitest-count-gate.cjs` (TARGETS + BASELINE knobs) |
| Quick run (backend) | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_274_*.py tests/unit/test_244_cloud_attach_is_thread_scoped.py tests/unit/test_244_attachment_prompt_line.py tests/unit/test_244_08_expired_attachment_is_a_tombstone.py -q` |
| Quick run (frontend) | `cd frontend && npx vitest run src/components/chat/__tests__/ChatAttachmentChip.states.test.tsx src/components/panel/__tests__/FilesSection.test.tsx src/components/attachments` |
| Full suite | `node scripts/check-backend-unit-baseline.cjs` (≤ 71 failed) · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command / file | Exists? |
|-----|----------|------|----------------|---------|
| ATT-01 | composer local upload with `lifetime=thread` writes `expires_at=None`, `kind=template_input`; default stays TTL | unit | `test_274_attachment_lifetime.py` | ❌ Wave 0 |
| ATT-01 | cloud attach writes thread-life (retire 244 case 1 deliberately) | unit | `test_244_cloud_attach_is_thread_scoped.py` | ✅ (edit) |
| ATT-01 | sweeper + run-pin ignore NULL-expiry rows | unit | `test_274_attachment_lifetime.py` (SQL-string pins on `template_service.py:56-59,105`) | ❌ |
| ATT-01/SC#4 | `delete_thread` collects RLS paths (files + versions) and removes them; failure logged, delete proceeds; no service role | unit | `test_274_delete_thread_cleanup.py` | ❌ (**no existing delete_thread unit test**) |
| ATT-02 | pinned minter set; workspace.py no-minter fence still green | unit/static | `test_274_minter_inventory.py`; existing 244 fence | ❌ / ✅ |
| ATT-02 | composer files carry no minting client; pending chip has no `⋯` | vitest | `components/attachments/__tests__/composerNoLibraryDoor.test.ts`, chip states test | ❌ |
| ATT-03 | promote: 404 non-owner thread / agent file / expired; 422 unpromotable type; minter 403/404 verbatim; `version_scope="folder"`, `org_id`, `on_conflict="link"` passed; duplicate → 200 + `already` + no enqueue; fresh → 201 + enqueue; idempotent re-promote; stamp written | unit | `test_274_promote_route.py` | ❌ |
| ATT-03 | preview ⇔ mint parity (4 cases) | unit | `test_274_promote_preview_parity.py` | ❌ |
| ATT-03 | filename prefix strip + mime derivation (12 promotable / 4 refused) | unit | `test_274_promote_route.py` | ❌ |
| ATT-03 | copy port fence vs sketch 274 `COPY.js` (`?raw`) + engine facts vs `ingest_splice.py` | vitest | `saveToLibraryCopy.test.ts` | ❌ |
| ATT-03 | listbox: no Root, search filters full paths, keyboard + `aria-selected`, confirm disabled until pick | vitest | `FolderPathListbox.test.tsx`, `SaveToLibraryDialog.test.tsx` | ❌ |
| ATT-03 | chip segment states (saved / already / indexing), link calls `openDocument` | vitest | chip states test (extend) | ✅ (edit) |
| SC#1/D-03 | 8-row roster planted-fact answer + second-thread negative + no search hit | live script | `scripts/run-274-board.py --roster/--run` | ❌ |
| G-4 #1-4 | Chrome drives | manual-live | VALIDATION.md rows | ❌ |

### Sampling Rate
- **Per task:** the targeted files above.
- **Per wave:** backend baseline gate + vitest count gate (cap 2). Capture failing filenames from the gate's JSON before any re-run (SEED-171 triage).
- **Phase gate:** both full gates + `node scripts/check-hot-file-ledger.cjs 274` + `npx tsc -p tsconfig.app.json --noEmit` set-diff.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_274_attachment_lifetime.py`, `test_274_delete_thread_cleanup.py`, `test_274_promote_route.py`, `test_274_promote_preview_parity.py`, `test_274_minter_inventory.py`
- [ ] New frontend suites must be added to **both** `TARGETS` and `BASELINE` in `scripts/vitest-count-gate.cjs`. Existing pins: `FilesSection.test.tsx: 22` (:1544), `ChatAttachmentChip.states.test.tsx: 10` (:3957), `ComposerAttach.composition.test.tsx: 19` (:3993), `ConnectedFilePickerModal.thread.test.tsx: 9` (:4016). Editing a pinned suite may not decrease its count.
- [ ] `scripts/run-274-board.py` (reuse `derive_roster`, `_single_org`, `_send`, `_wait_run` from `run-273-board.py`; import via `importlib` because of the hyphenated filename, or factor into a shared module)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (every route) | `get_current_user` + `get_user_supabase_client` / `get_user_pg_connection` |
| V3 Session Management | no | — |
| V4 Access Control | **yes, central** | thread ownership 404 (`_verify_thread_ownership`); RLS on `workspace_files`/versions/storage; minter folder-owner 403; `get_active_org_id` re-validated against membership |
| V5 Input Validation | yes | Pydantic `PromoteRequest(folder_id: UUID)` `extra="forbid"`; `lifetime: Literal[...]`; file_id UUID → 404; Library MIME gate; 10 MB cap already enforced at upload |
| V6 Cryptography | no | sha256 inside the minter (shipped) |
| V12 Files | yes | storage keys sanitised by `_storage_safe` (minter); download filename by `_safe_download_filename` |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| IDOR: promote another user's attachment by file_id | Information disclosure | user-JWT pg read under RLS + `thread_id` match + 404 collapse (existence-leak rule D-062-12) |
| Promote into someone else's folder | Elevation | minter 403 (authority, D-12). No route-side bypass |
| Service-role read keyed on a client id (BUG-260903-02 shape) | Elevation | service role only inside `_enqueue_or_splice` for the `documents` bucket PUT **after** the RLS read + mint |
| Client opts a workflow template into thread-life | Tampering (low) | Accepted: own thread, own quota, same cap, bytes now removed at thread delete. Record as accept |
| Delete cleanup over-removal | Tampering | Paths come only from RLS-visible rows of the thread being deleted; storage delete policy limits to `{auth.uid()}/…` |
| Prompt injection via filename in the agent note | Tampering | unchanged (`_one_line`, `_attachment_container_path`) |
| Mark column leaks a document id across users | Information disclosure | `workspace_files` RLS select_own; library-links reads documents through RLS (a deleted/foreign doc returns nothing → plain chip) |
| Advisor drift (BUG-260911-01 class) | — | `get_advisors(security)` after migration 203 (read-only MCP call; free) |

## Sources

### Primary (HIGH confidence, codebase at HEAD `0ace2d2a4`)
- `backend/app/api/workspace.py:55-76, 79-123, 126-144, 269-359, 362-451, 460-535, 537-616, 631-686, 707, 747`
- `backend/app/services/ingest_splice.py:57-62, 126-345, 348-381, 466-544`
- `backend/app/api/documents.py:117-190, 555-736, 1809-1871`
- `backend/app/services/sources/import_service.py:64-168, 237-266`
- `backend/app/services/template_service.py:34-112` · `backend/app/main.py:452-474`
- `backend/app/db/workspace.py:27-76, 185-221, 283-295` · `backend/app/services/workspace_service.py:35, 41, 99-102, 176-185, 251-360`
- `backend/app/services/agent_loop.py:1252-1340` · `backend/app/services/tool_dispatcher.py:1759-1765, 1856-1882, 1885-2020`
- `backend/app/services/template_asset_service.py:204-290` · `backend/app/services/audit_service.py:14, 31-56`
- `backend/app/api/threads.py:1399-1456` · `backend/app/api/folders.py:11-20`
- `supabase/full-schema.sql:1626, 3630-3676, 4387, 4394, 7294, 8445-8491, 8670-8679` · `supabase/migrations/068_workspace_template_ephemeral.sql:16-19` · `ls supabase/migrations/` (max 202)
- `frontend/src/components/chat/ChatAttachmentChip.tsx` (full) · `composerCopy.ts` (full) · `useComposerAttachments.ts:88-125` · `MessageItem.tsx:305-359` · `MessageInput.tsx:540, 661-675`
- `frontend/src/components/panel/FilesSection.tsx:127-147, 255-363` · `TemplateUpload.tsx` · `panelOpenSignal.ts` · `frontend/src/lib/citationNav.tsx` · `scopeCopy.ts:86-108` · `LinkTargetCombobox.tsx` · `MoveToFolderDialog.tsx:29-81` · `frontend/src/lib/api/documents.ts:35-121, 342-347` · `types/index.ts:589-635, 1208-1225`
- `scripts/run-273-board.py:1-120, 181-283, 373-415` · `scripts/vitest-count-gate.cjs:1544, 3957, 3993, 4016, 5172, 5854, 5864, 5875` · `scripts/check-hot-file-ledger.cjs` (run) · `docs/HOT-FILE-LEDGER.md` §workspace.py and scan list
- Tests: `test_244_cloud_attach_is_thread_scoped.py:108-191` · `test_244_attachment_prompt_line.py:119-121` · `ChatAttachmentChip.states.test.tsx` cases 1-6
- Measured in venv: `mimetypes` / Library-gate verdict for the 16 attachment extensions

### Secondary / Tertiary
- Supabase Storage `remove`/`list` semantics: training knowledge, tagged A1/A2 and not load-bearing for the recommended design.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Every reused asset was read at HEAD, and no packages are added.
- Architecture: HIGH (backend), MEDIUM (frontend composition: the a11y nesting in the panel row and the chip-owns-dialog shape still need the UI plan's keyboard test).
- Pitfalls: HIGH. Each was measured (line refs, mimetypes run, schema reads), except A1-A5.

**Research date:** 2026-10-05
**Valid until:** ~2026-10-12. Hot files rot fast here (`ChatAttachmentChip` row already stale). Re-derive line numbers and the migration number at plan/execute time.
