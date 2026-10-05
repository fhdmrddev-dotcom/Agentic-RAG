---
phase: 274
slug: thread-scoped-attachments
status: verified
threats_open: 0
threats_open_blocking: 0
asvs_level: 1
block_on: high
created: 2026-10-05
audited_head: 627a05578
---

# Phase 274 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Every `mitigate` row below was checked in the code at `627a05578`, not taken from a SUMMARY.
> Suites re-run during this audit: the eight backend 274/244 suites gave **106 passed**, the parity
> suite (an in-memory fake, no DB) gave **6 passed**, and the 12 frontend attachment/chip/panel/API
> suites gave **150 passed**, run with `--maxWorkers=2`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `POST /threads/{id}/workspace/files?lifetime=` | The client picks the lifetime of its own upload. | file bytes (user content), a closed `Literal` |
| browser → `DELETE /threads/{id}` | A thread id from the client drives a storage removal. | thread id; the bucket paths it resolves to |
| API → `workspace-files` bucket | Objects are removed with the user-JWT client. | storage object paths under `<uid>/` |
| migration 203 → live schema | DDL on an RLS-governed table. | schema only (FK + text column) |
| browser → promote / preview / library-links | The client supplies `thread_id`, `file_id` and `folder_id`. | ids; attachment bytes are read server-side under RLS |
| API → `workspace_files` (asyncpg, user-JWT conn) | Attachment bytes are read under RLS. | user content |
| API → minter → `documents` / `documents` bucket | The Library write. The service role is used only inside `_enqueue_or_splice`, after the mint. | user content, org id, folder id |
| server sentence / folder names / filenames → DOM | User-authored and server strings are rendered. | untrusted text |
| composer → any Library-writing API | ATT-02 says this boundary must not exist. | none, by construction |
| board script → local API + local DB; Claude → Supabase MCP (PRODUCTION); Chrome MCP → app | Test harnesses. | planted tokens, local ids, screenshots |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified evidence) | Status |
|-----------|----------|-----------|-------------|--------------------------------|--------|
| T-274-01 | Tampering | `upload_template` `lifetime` param | accept | The parameter is `Literal["template","thread"]` (`workspace.py:275`). Anything that is not exactly `"thread"` fails closed to `template` (`workspace.py:314`). An out-of-set value returns 422 (`test_274_attachment_lifetime.py::test_an_out_of_set_lifetime_is_a_422`). Logged as AR-01 below. | closed |
| T-274-02 | Elevation | `delete_thread` → storage remove | mitigate | `delete_thread` takes `get_user_supabase_client` (`threads.py:1404`). Paths come from `collect_thread_workspace_paths`, which runs through RLS on that client (`thread_workspace_cleanup.py:48-91`). A path outside `<user_id>/` is dropped and logged (`:82-90`). There is no `get_supabase(`, `service_role` or `SUPABASE_SERVICE` in the seam (`test_274_delete_thread_cleanup.py::test_the_cleanup_seam_uses_no_service_role…`). The storage policy `workspace_storage_delete_own` is defined at `054_workspace_files.sql:99-100`. | closed |
| T-274-03 | DoS | `delete_thread` | mitigate | A collect failure is logged and returns `[]` (`thread_workspace_cleanup.py:73-80`). The remove never raises, and each chunk is wrapped (`:94-110`). Collect runs before the `threads` delete and remove runs after it (`threads.py:1444`, `:1452`). A failed delete removes no bytes (`test_a_failed_threads_delete_removes_no_bytes`). | closed |
| T-274-04 | Repudiation | removal failures | mitigate | **CLOSED after the audit (79c3f87b5):** `remove_workspace_paths(supabase, paths, thread_id=…)` — the remove-failure warning now carries the thread id (`thread_workspace_cleanup.py`), `delete_thread` passes it (`threads.py`), and `test_a_failed_chunk_is_logged_and_the_rest_still_run` asserts the thread id is in the message (RED `f0a83cb9e` → GREEN). The collect and foreign-prefix warnings already carried it. | closed |
| T-274-05 | Info disclosure | migration 203 | mitigate | The non-comment DDL has no `GRANT`, `anon`, `POLICY`, `ROW LEVEL` or `SECURITY DEFINER` (grep rc=1). `test_274_migration_203_shape.py::test_no_grant_no_anon_no_rls_change` passes. Grants and `relrowsecurity` were captured before and after the local apply and were identical (`274-BASELINES.md:152-155`). ⚠ The `get_advisors(security)` baseline and the post-apply run were **never taken**; they are operator-gated (OP-2). | closed (local) · OP-2 owed |
| T-274-06 | DoS | `library_document_id` FK | mitigate | `REFERENCES public.documents(id) ON DELETE SET NULL` (`203_…sql:38`). There is no pairing CHECK (`test_no_check_pairs_the_two_columns`). The rolled-back FK proof shows the document delete succeeded and the FK went NULL (`274-01-SUMMARY.md:96-98`, `274-BASELINES.md:146`). | closed |
| T-274-07 | Tampering | agent prompt note | accept | Only the literal changed (`agent_loop.py:1331-1332`, per `git diff 75cd73782`). `_one_line` and `_attachment_container_path` are untouched. Logged as AR-02. | closed |
| T-274-08 | Info disclosure | promote / preview by file_id (IDOR) | mitigate | `_verify_thread_ownership` runs first on all three routes (`workspace_promote.py:422`, `:540`, `:586`). `_reachable_attachment` reads on `get_user_pg_connection` (role swap + JWT claims, `dependencies.py`). A malformed id, missing row, other `thread_id`, `is_expired` or other `kind` all collapse to one `File not found` (`:292-311`). Tests: `test_every_unreachable_file_collapses_to_one_404_and_mints_nothing`, `test_the_preview_collapses_unreachable_files_to_404`. | closed |
| T-274-09 | Elevation | promote into another user's / org's folder | mitigate | The route never catches the minter's `404 Folder not found` or `403 …you do not own` (`ingest_splice.py:169-173`), and there is no `try` around `mint_or_link` (`workspace_promote.py:451-459`). Test: `test_the_minters_folder_refusals_reach_the_caller_verbatim`. **Amended by D-29 (CR-01):** the route reads exactly one folder, `select("id, org_id")`, on the user-JWT client. A visible folder in another org gets 403 before any byte is read (`:326-338`, called at `:424` and `:542`). The static fence pins that single read (`test_the_module_has_no_service_role_no_folders_read…`). | closed |
| T-274-10 | Elevation | service-role read keyed on a client id | mitigate | `workspace_promote.py` has no `get_supabase(` or `service_role` (grep rc=1, plus the static test). Bytes come from `_get_file_content(conn, supabase=user-JWT, row)` (`:314-323`). The service role is used only inside the imported `_enqueue_or_splice`, after the mint (`:463-473`). | closed |
| T-274-11 | Tampering | second ingest path | mitigate | The mint goes through `ingest_splice.async_mint_document_row` (`:215`) and the hand-off through the imported `_enqueue_or_splice` (`:86`). `test_274_minter_inventory.py` pins the set of six minters. The module has no `table("documents").insert(` and no `splice_document` (static test). | closed |
| T-274-12 | Tampering | silent version retirement in another folder | mitigate | `version_scope="folder"` (`workspace_promote.py:224`). `test_parity_same_name_other_folder_is_a_fresh_v1_and_retires_nothing` asserts the other folder's `is_latest is True` (re-run: 6 passed). | closed |
| T-274-13 | Spoofing | org context | mitigate | `active_org = Depends(get_active_org_id)` validates `X-Org-Id` against `org_members` on a user-JWT connection; a non-member gets 403 (`dependencies.py:904-923`). `PromoteRequest` has `extra="forbid"` and only `folder_id` (`models/workspace_promote.py:33-36`; `test_promote_request_refuses_any_other_key`). | closed |
| T-274-14 | Info disclosure | library-links leaking a foreign/deleted doc id | mitigate | `link` is built only from rows returned by the user-JWT `documents` select (`workspace_promote.py:598-603`, `:612-620`). `_existing_link` also re-reads the document under RLS (`:365-373`). Tests: `test_library_links_reports_only_documents_the_person_can_still_see`, `test_a_link_to_a_document_no_longer_visible_is_ignored…`. | closed |
| T-274-15 | Tampering | unsupported types | mitigate | `ALLOWED_MIME_TYPES` and `_EXT_MIME_OVERRIDES` are imported from `app.api.documents` (`:62`). `library_mime` applies the override first (`:126-132`). The route returns 422 before reading any bytes (`:433-435`). `test_the_module_imports_the_allow_list_and_never_redeclares_it` passes. | closed |
| T-274-16 | DoS | double-click / concurrent promote | mitigate | `on_conflict="link"` (`:223`). The `_existing_link` short-circuit runs before and again after the byte read (`:427`, `:444`). After CR-02, `find_existing_copy` links a non-failed latest copy rather than retiring it (`:150-187`). The `already` stamp is guarded by `or_(library_document_id.is.null, …neq.<doc>)` (`:486-487`). Tests: `test_a_concurrent_promote_…`, `test_a_same_bytes_copy_still_indexing_is_linked…`. | closed |
| T-274-17 | Repudiation | promote | mitigate | `write_audit_entry(action_type="document.upload", metadata={source:"thread_attachment", workspace_file_id, outcome, …}, org_id=active_org)` (`:498-513`). Test: `test_a_promote_is_audited_as_a_document_upload_from_a_thread`. (Note: the early return for an already-linked attachment writes no audit row, but it also writes nothing to the Library.) | closed |
| T-274-18 | Elevation | client-side folder choice | accept | The client only proposes a folder; the server refuses (minter 403/404 plus the D-29 org 403). The dialog does not pre-filter. Logged as AR-03. | closed |
| T-274-19 | Spoofing | org context on API calls | mitigate | `promoteAttachment`, `getPromotePreview` and `getLibraryLinks` all `await getAuthHeaders()` (`lib/api/attachments.ts`). The fixed cloud attach `attachConnectionFileToThread` uses `getAuthHeaders()` (`lib/api/documents.ts:110`). `listFolders` uses it too (`:352`). The server re-validates via `get_active_org_id`. | closed |
| T-274-20 | Tampering (XSS) | folder paths, filenames, server sentences | mitigate | `grep dangerouslySetInnerHTML` over `components/attachments/` finds nothing in source; the only `innerHTML` hits are test reads. The two hits in `ChatAttachmentChip.tsx:50` and `MessageItem.tsx:687` are comments that forbid it. | closed |
| T-274-21 | Info disclosure | silent root save | mitigate | `FolderPathListbox` value is `string \| null` with no sentinel or Root option (`FolderPathListbox.tsx:2,34-36`). Confirm is `disabled={!picked \|\| …}` (`SaveToLibraryDialog.tsx:300`). The body is `JSON.stringify({ folder_id })` only (`attachments.ts` `promoteAttachment`). The server model requires `folder_id: UUID` (`test_promote_request_requires_a_folder`). | closed |
| T-274-22 | DoS | stale preview racing a newer pick | mitigate | `reqRef` latest-wins: `const req = ++reqRef.current … if (req === reqRef.current) setPreview(p)` (`SaveToLibraryDialog.tsx:123-127`), reset on open (`:96`). The result screen renders `promoteAttachment`'s result (`:142-148`), never the preview. | closed |
| T-274-23 | Elevation | composer reaching a minter | mitigate | `composerNoLibraryDoor.test.ts` strips comments from seven `?raw` files (composer, connectors flyout, Invite Expert, Connections page/tab) and checks them for 8 minting tokens, `promoteAttachment` included. It has a non-vacuity case and a planted-fires case (`:23-66`). The pending chip has no `⋯` (`ChatAttachmentChip.states.test.tsx:98`). The chip only resolves a links thread when `effective === "sent"`. The backend half is the pinned minter set (T-274-11). | closed |
| T-274-24 | Tampering (XSS) | segment / menu / panel text | mitigate | Same evidence as T-274-20. | closed |
| T-274-25 | Info disclosure | links store | mitigate | The store holds only the `getLibraryLinks` and `listFolders` responses (`useLibraryLinks.ts:89-121`). `folderPathParts` returns `null` for a folder outside the visible list and invents no name (`folderDisplay.ts:28-42`). | closed |
| T-274-26 | DoS | poll loop | mitigate | `syncTimer` keeps an interval only while there are listeners and something is indexing, and clears it otherwise (`useLibraryLinks.ts:75-85`). It also runs on unsubscribe (`:135-138`). An in-flight load is deduplicated, so there is one request per tick per thread (`:89-90`). The fake-timer cases in `useLibraryLinks.test.tsx` pass. Residual: IN-02 (no ceiling for a stuck `pending`, still bounded by mount). | closed |
| T-274-27 | Repudiation | silent action | accept | The server audits the promote (T-274-17). Logged as AR-04. | closed |
| T-274-28 | Tampering | board writes | mitigate | `kit.assert_localhost_only()` and `b273._assert_local_db()` run before `connect_db()` (`scripts/run-274-board.py:572-574`). `_assert_local_db` refuses a non-127.0.0.1/localhost DB or Redis DSN (`run-273-board.py:158-164`). Model and provider are sent per request (`run-274-board.py:213`). | closed |
| T-274-29 | Elevation | production writes | mitigate | No production write was made (`274-05-SUMMARY.md:220`). The executors had no Supabase MCP at all (`274-01-SUMMARY.md:150`, `274-05-SUMMARY.md:228`). The production apply of 202 → 203 is explicitly OWED and operator-gated (`274-05-SUMMARY.md:227,262-263`; `274-VERIFICATION.md:65`). This audit ran no MCP call. | closed · OP-1 owed |
| T-274-30 | Info disclosure | evidence files | mitigate | A regex scan of `evidence/` for JWTs (`eyJ…`), `Bearer `, `sk-…` and `token=<20+>` found nothing (rc=1). The bearer is minted from env by `get_bearer_token()`, which "NEVER prints either value" (`conc_probe.py:245-257`). | closed |
| T-274-31 | Repudiation | bug closure | mitigate | `BUG-260905-01` reads `status: closed`, with `verified_closed_by` naming the driven rows in `274-VALIDATION.md §6.1/§6.3/§6.5` and operator sign-off in `§5` ("APPROVED by the operator, 2026-10-05"). The body states it is reverted if the operator rejects. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Open Threats

| Threat ID | Severity | Gap | Files searched | Suggested action |
|-----------|----------|-----|----------------|------------------|
| T-274-04 | **low** (does not reach `block_on: high`) | The storage remove-failure warning (`thread_workspace_cleanup.py:104-110`) does not carry the thread id the mitigation promised. With two workers, an orphaned-bytes warning cannot be tied to a thread. The `thread.delete` audit row is written in the same request, but logs give no reliable way to join the two. | `backend/app/services/thread_workspace_cleanup.py`, `backend/app/api/threads.py:1440-1460`, `backend/tests/unit/test_274_delete_thread_cleanup.py:217-229` (asserts only the count `"100"`) | Either a `/gsd:fast` fix (add a `thread_id` argument to `remove_workspace_paths`, include it in the warning, and extend the test), or record it in the Accepted Risks Log as AR-05. |

---

## Deploy-gated items (OWED, operator-triggered — transferred to the deploy checklist)

| ID | Threat ref | Item | Why it is not run here |
|----|------------|------|------------------------|
| OP-1 | T-274-29, T-274-05 | **Production:** apply migration **202, then 203**, before the backend that reads `library_document_id` / `library_link` deploys. | The Supabase MCP points at PRODUCTION, and every write needs explicit per-action operator approval (CLAUDE.md). `library-links` and `_existing_link` degrade to "no links" without 203 (`workspace_promote.py:374-376`, `:590-592`), so an early backend deploy fails soft, not open. |
| OP-2 | T-274-05 | **Production `get_advisors(security)`**: the pre-apply baseline (which the plan asked for "now" and was never taken) and the post-apply run. | No executor had the MCP. This is a read and needs no approval, but it belongs with the deploy so the post-apply reading can be compared. |

---

## Unregistered Flags

Every SUMMARY `## Threat Flags` section reads "None", and each executor flag maps to a registered ID.
The code review found new surface **after** those SUMMARYs were written. Each item is listed here
with how it was verified.

| Flag | Source | Category | Mapping / state | Evidence |
|------|--------|----------|-----------------|----------|
| UF-01 | 274-REVIEW CR-01 | Info disclosure / Elevation: a cross-org folder exposed content to the wrong org | Not in the plan register. Folded into T-274-09 by D-29 (`274-CONTEXT.md:191`). **Verified mitigated.** | `_refuse_folder_outside_org` at `workspace_promote.py:326-338`, called by POST `:424` and preview `:542`. Tests: `test_a_folder_in_another_org_is_refused_403_and_nothing_is_read_or_minted`, `test_the_preview_refuses_a_folder_in_another_org_too`. ⚠ Residual, out of scope: `mint_document_row` still has no `folder.org_id == org_id` assertion, so other doors (import / watch / Expert install) do not get this guarantee. The review recommended it as the long-term fix. |
| UF-02 | 274-REVIEW CR-02 | Tampering / DoS: the minter retired an indexing copy | Not in the plan register. Extends T-274-16. **Verified mitigated at the promote boundary.** | `find_existing_copy` (`:150-187`) is shared by `mint_or_link` (`:205-214`) and `preview_promotion` (`:250`). Parity case `test_parity_same_bytes_first_copy_still_pending_is_linked_and_keeps_is_latest` passes. ⚠ Residual (stated in the review): two requests that both pass every read can mint into DIFFERENT folders, because `documents_dedup_idx` is per-folder. The minter-level race on `/documents/upload` is logged separately. |
| UF-03 | 274-REVIEW WR-01 | Tampering: a thread-life chat attachment was resolvable and permanently claimable as a workflow template | Not in the plan register. **Verified mitigated.** | `template_asset_service.py:218`, `:256`, `:279`: `(expires_at IS NOT NULL OR $3::text IS NULL OR $3::text = 'deep')` on all three Branch-2 reads. `test_274_template_resolver_thread_life.py` (2 cases) passes. Human verification is owed (a composer-attached `.docx` no longer serves a workflow fill). |
| UF-04 | 274-REVIEW IN-03 | **Info disclosure: an FK existence oracle.** `workspace_files_update_own` has no column restriction, so a direct PostgREST PATCH of the person's own `library_document_id` to any UUID returns a 23503 or success, which reveals whether that document id exists. | **WARNING: unregistered.** No threat ID, no accepted-risk entry. It is recorded only as an orchestrator deferral in the REVIEW frontmatter. It was introduced by migration 203 (this phase). Readers re-check visibility under RLS, so no content leaks, and the ids are UUIDv4. Project precedent (T-116-02-01) treats id-existence oracles as a threat to mitigate. | Either record it as an accepted risk (AR-06), or revoke `UPDATE (library_document_id, library_link)` from `authenticated` and stamp through a narrow path. The second option needs a migration, which in production is operator-gated. |
| UF-05 | 274-REVIEW IN-06 | DoS / hygiene: bytes written between the collect and the `threads` delete are orphaned | A residual of T-274-03 (best-effort is declared). Informational. | `thread_workspace_cleanup.py` docblock ("Best-effort, LOGGED"). Pre-274 threads' bytes also stay orphaned (`274-01-SUMMARY.md` OWED #4). |
| UF-06 | audit observation | Repudiation | Informational, maps to T-274-17. | The already-linked early return (`workspace_promote.py:427-430`, `:444-447`) writes no audit row. It makes no Library write, so T-274-17's scope ("the promote") is still met. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-274-01 | A client can opt its OWN upload in its OWN thread into thread-life. The 10 MB cap, `validate_upload` and per-user quota are unchanged, and the bytes are removed at thread delete. `Literal` plus the `==` fail-closed limits the value set. | Phase 274 plan (274-01 `<threat_model>`); recorded by the security audit | 2026-10-05 |
| AR-02 | T-274-07 | Only the persistence sentence of the agent note changed. Filename sanitisation is untouched. (IN-05 also notes the sentence is now inaccurate for 24 h TTL rows; that is a correctness issue, not a security one.) | Phase 274 plan (274-01) | 2026-10-05 |
| AR-03 | T-274-18 | The client folder choice is only a proposal. The server's minter 403/404 and the D-29 org 403 decide. | Phase 274 plan (274-03) | 2026-10-05 |
| AR-04 | T-274-27 | The client has no audit of its own because the server audits the promote (`document.upload`, `source=thread_attachment`). | Phase 274 plan (274-04) | 2026-10-05 |

| AR-06 | UF-04 (274-REVIEW IN-03) | **Accepted, not revoked — and the revoke is not available, not merely deferred.** The Save-to-Library route stamps `library_document_id` / `library_link` through the person's OWN user-JWT client (D-12: never service role first), so revoking `UPDATE` on those columns from `authenticated` would break the stamp. What the oracle yields: whether a guessed UUIDv4 document id exists — no content, no title, no org (every reader re-checks visibility under RLS). Re-open: a narrow SECURITY DEFINER stamp path is introduced for any other reason, at which point the column revoke becomes free. | Orchestrator, 274 close (operator approved the phase 2026-10-05) | 2026-10-05 |

*AR-05 not needed: T-274-04 was fixed rather than accepted.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-05 | 31 | 30 | 1 (low, non-blocking under `block_on: high`) | gsd-security-auditor (Claude), HEAD `627a05578` |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (AR-01..AR-04, AR-06)
- [x] `threats_open: 0` confirmed: T-274-04 fixed after the audit (79c3f87b5)
- [x] `status: verified` set in frontmatter (T-274-04 fixed; UF-04 accepted as AR-06)
- [ ] OP-1 / OP-2 (production 202 → 203 apply, `get_advisors(security)`): operator-gated, at deploy

**Approval:** pending

## Security Audit 2026-10-05 (close-out, orchestrator)
| Metric | Count |
|--------|-------|
| Threats found | 31 |
| Closed | 31 (27 mitigated, 4 accepted) |
| Open | 0 |

T-274-04 closed by fix `79c3f87b5` after the auditor's run; UF-04 accepted as AR-06 with the reason a revoke is unavailable.
Deploy-gated items OP-1 (apply migrations 202 → 203 to production before the backend deploy) and OP-2 (production
`get_advisors(security)`, before and after) remain OWED and operator-triggered.
