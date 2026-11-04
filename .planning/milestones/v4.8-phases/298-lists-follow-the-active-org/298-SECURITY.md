---
phase: 298
slug: lists-follow-the-active-org
status: verified
threats_open: 0
threats_total: 34
threats_closed: 34
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-10-28
audited_against: 9f7be04f4
residuals_awaiting_operator_ack: []
residuals_acknowledged: [AR-298-R1, AR-298-R2]  # 2026-10-30, under the operator's mandate to finish the phase autonomously — re-open on request
---

# Phase 298 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> Method. Each `mitigate` threat was checked against the code at HEAD `9f7be04f4` (post review-fix).
> Evidence is the control's own file:line, not a SUMMARY claim. `accept` threats are recorded in the
> Accepted Risks Log below. Unit suites were run by this auditor:
> `pytest tests/unit/test_298_*.py -q` = **188 passed**. The live suites under
> `backend/tests/integration/` mutate the local DB, so they were **cited and not run**. Their result
> (`65 passed`) comes from 298-REVIEW-FIX.md and was not re-derived here.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → list routes | `X-Org-Id` is client-supplied and untrusted | org id hint; list rows (own + org-shared) |
| browser → `/org-items/*` | ids, kind, target org and the active-org header are untrusted | folder/document/draft ids; org names; counts |
| route → Postgres (RLS conn) | counts and label reads run as `authenticated` with the caller's claims | per-org counts, org names |
| service → Postgres (pool, BYPASSRLS) | the move write; RLS does not guard it, so every check is app-level and inside one transaction | org_id re-stamps across folders/documents/child tables; audit_log row |
| browser → save routes / schedule tick / API key → launch | definition bindings are untrusted; unattended callers carry no header | workflow definition JSON (folder ids) |
| server sentence → DOM | refusal text names folders and orgs | folder/org names (must not reveal what the caller cannot see) |
| Realtime payload → list state | best-effort hint carrying raw rows of any org the caller can see | folder rows incl. `org_id` |
| operator → cloud DB | migration 217 is an approval-gated production schema change | audit CHECK literal |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-298-01 | Spoofing / Info disclosure | every narrowed list route | mitigate | Org read only via `resolve_active_org_or_none` (membership re-checked on the caller's RLS conn, non-member → None): `backend/app/dependencies.py:1044-1062`; single home `backend/app/services/org_lists.py:46-69`; callers `api/folders.py:35,52`, `api/documents.py:908,916`, `api/library.py:292` (SQL `:183` `$1::uuid IS NULL OR org_id = $1`), `api/threads.py:284-289`, `api/workflow_runs.py:741`, `api/workflows.py:443,1259` → `db/workflows.py:726-728,1212`. Tests: `test_298_list_narrowing.py:158` (non-member header resolves None through the real resolver), `:218` (gate never imported); live `test_298_two_org_lists_live.py:280` | closed |
| T-298-02 | Elevation | `org_lists.folder_kw` | mitigate | `return {"restrict_org_ids": {org}} if org else {}` — `org_lists.py:63-64`; no `restrict_org_ids=set()`/`None` in any 298 file (grep: only pre-existing 268 authorizer `api/threads.py:1210`, fail-closed polarity by design). Tests `test_298_list_narrowing.py:105,110,252,273`; `test_298_org_matrix.py:357,389` | closed |
| T-298-03 | Info disclosure | `GET /org-items/elsewhere` | mitigate | RLS conn `get_user_pg_connection` `api/org_items.py:209`; own-row + member-join predicates `ELSEWHERE_SQL` `:102-119`; no org → `[]` without a query `:206-208`; router-level 401 dep `_require_bearer` `:75-89`. Tests: `test_298_org_items_routes.py:83,105,240`; live anon read of counts SQL `test_298_two_org_lists_live.py:352-365`; live anon bearer on the routes `test_298_org_move_live.py:898` (cited, not run) | closed |
| T-298-04 | Info disclosure | `GET /org-items/folder-labels` | mitigate | Only ids in UNRESTRICTED visible set `api/org_items.py:234-235`; org names over RLS `:239-241`, unreadable omitted `:249`; strict UUID regex + ≤50 cap, whole-request 422 `:168-192`. Tests `test_298_org_items_routes.py:152,158,194,206,219` | closed |
| T-298-05 | Denial of service | folder-labels / elsewhere | accept | One bounded query each; `MAX_LABEL_IDS = 50` `api/org_items.py:92`. See AR-298-01 | closed |
| T-298-06 | Tampering | Root upload stamp | mitigate | `root_upload_org` returns None for a foldered upload (minter derives folder org) `org_lists.py:79-80`; Root → validated active org `:81-83`; review WR-09 hardening: unvalidatable header → 503, nothing minted `:87-108`; wired `api/documents.py:626`. Tests `test_298_list_narrowing.py:135,144,195,208,213,531-542`; single-minter fence `tests/unit/test_280_minter_sequence.py` | closed |
| T-298-07 | Repudiation | — | accept | No new audited action in plan 01 (reads + create keyword). See AR-298-02 | closed |
| T-298-08 | Tampering / Elevation | save + launch with a crafted foreign folder id | mitigate | `foreign_binding_refusal` `services/foreign_folder_refusal.py:169-245`, wired at: create `api/workflows.py:1223` (incl. header-less `owner_default=True`, WR-06, `foreign_folder_refusal.py:200-201`), update (added/changed ids) `api/workflows.py:1368` → `:258-282`, attended + chat-started kickoff `services/workflow_kickoff.py:311` (via `api/threads.py:1856`), scheduler `services/scheduler_service.py:138-151`, API key `api/inbound.py:371-376`. Tests per door `test_298_foreign_binding.py:368,382,439,448,563,650,748`; matrix `test_298_org_matrix.py:416,427`. Residual: AR-298-R1 (WR-06) | closed |
| T-298-09 | Spoofing | viewer header choosing the definition's org | mitigate | Update reads org from the owned row `_STORED_SQL` `foreign_folder_refusal.py:72-75,279`; scheduler/inbound pass `definition_id` → `_DEFINITION_ORG_SQL` `:64-66,198-199`; kickoff passes `_def_row.get("org_id")` `workflow_kickoff.py:311`; create uses the validated active org it stamps `api/workflows.py:1221-1227`. Test `test_298_foreign_binding.py:496,573` | closed |
| T-298-10 | Info disclosure | refusal sentence | mitigate | Invisible offender → "a folder you can't open", folder org never fetched or named `foreign_folder_refusal.py:222-238` (`name_ids` excludes it `:228`). Tests `test_298_foreign_binding.py:231,258` | closed |
| T-298-11 | Denial of service | header-less unattended launches | mitigate | No `get_active_org_id` in `scheduler_service.py` / `inbound.py` (grep: 0). Tests `test_298_foreign_binding.py:771`; `test_298_org_matrix.py:403,408` | closed |
| T-298-12 | Elevation | empty-set polarity | mitigate | Visible set read unrestricted `foreign_folder_refusal.py:223`; publish-parity confirm gets a one-element set `:164`; `org == None` returns without a restriction `:202-203`. Test `test_298_org_matrix.py:357,377,389` (recording seam over real `fetch_visible_folders`) | closed |
| T-298-13 | Info disclosure | existence oracle on PATCH | mitigate | Not-owned row → `None`, route's own 0-row UPDATE answers its 404 `foreign_folder_refusal.py:271-273`. Test `test_298_foreign_binding.py:467` | closed |
| T-298-14 | Repudiation | API-key refusals | mitigate | `_refused(..., reason="foreign_folder")` `api/inbound.py:373-376` → `api_key.refused` audit, rate-limited via `refusal_audit_slot` `:241-258`. Test `test_298_org_matrix.py:349` | closed |
| T-298-15 | Elevation / Tampering | move into an org the caller is not in | mitigate | Target membership first `services/org_move.py:990-991`; source org read from the row `:993-998`; both inside `con.transaction()` via `_prepare(lock=True)` `:1068-1070`. Review CR-01: every moving row must already be in the source org (`_mixed_org_refusals` `:690-719`). Tests `test_298_org_move_unit.py:232`; live `test_298_org_move_live.py:774,785,586,595,601` (cited) | closed |
| T-298-16 | Tampering | moving another user's rows inside a subtree | mitigate | Root collected by `id AND user_id` `org_move.py:445-447,503`; not-owned subfolders `:861-863`, not-owned documents `:600-603`; org-shared subtree folders `:817-819`; document family scoped `user_id = $1` `:466-469`; review WR-04 ancestor blockers `_ancestor_refusals` `:728-803` (watch arm refuted, documented `:738-741`). Live tests `test_298_org_move_live.py:362,451,457,617-671` (cited) | closed |
| T-298-17 | Tampering (TOCTOU) | preview → confirm gap | mitigate | `FOR UPDATE` on every collected row `org_move.py:476-479,500-531` incl. subtree stability re-read `:509-512`; every refusal re-run inside the txn and first one raised `:1068-1073`; draft UPDATE guarded `status='draft' AND NOT is_system_global`, 0 rows → 409 `:1104-1110`. Live `test_298_org_move_live.py:843` (hold placed after preview). Residual for unlocked binders: AR-298-R2 (WR-05), pinned in docstring `:34-42` and `test_298_org_move_unit.py:247`; live `:868,885` | closed |
| T-298-18 | Tampering | half-applied move | mitigate | One pool transaction `org_move.py:1066-1080`; folders, documents, every `DOCUMENT_CHILD_TABLES` entry and both-ended relationships updated on the same conn `:1101-1137`. Tests `test_298_org_move_unit.py:217`; live information_schema post-condition `test_298_org_move_live.py:276-283` (cited) | closed |
| T-298-19 | Repudiation | missing receipt | mitigate | `INSERT INTO public.audit_log` inside the txn, `org_id = items.source_org` `org_move.py:1075-1079` (never `write_audit_entry`); type `org.item.move` in `services/audit_service.py:38` and migration 217 CHECK. Tests `test_298_org_move_unit.py:206,226`; live `test_298_org_move_live.py:126,226,246` (cited) | closed |
| T-298-20 | Elevation | published-row immutability bypass | mitigate | Draft-only refusal `org_move.py:929-932`; `_apply` predicate `status = 'draft' AND NOT is_system_global` `:1105-1106`; migration 217 has no trigger change (0 `CREATE FUNCTION`; header `:14-16`). Tests `test_298_migration_217_shape.py:107`; live `test_298_org_move_live.py:720,725` | closed |
| T-298-21 | Info disclosure | existence oracle | mitigate | One `NOT_FOUND` sentence for missing and not-owned `org_move.py:125,505,519,527`; non-member target 403 before any item lookup `:989-991`; org names only for member orgs (`_member_orgs` before `_org_names` `:704-705,796-797,896-897,963-964`). Live `test_298_org_move_live.py:774,796` (cited) | closed |
| T-298-22 | Elevation | new SQL function exposed via PUBLIC | accept | Migration 217 adds no function (`grep -c "CREATE.*FUNCTION"` = 0); shape test `test_298_migration_217_shape.py:107`; `get_advisors(security)` after the cloud paste is in deploy notes `298-03-SUMMARY.md:155-166`. See AR-298-03 | closed |
| T-298-23 | Denial of service | boot guard vs missing 217 | mitigate | Deploy order written `298-03-SUMMARY.md:155-166` and in migration header `217_org_item_move_audit.sql:22-25`; `assert_action_types_synced` in lifespan `backend/app/main.py:290`; VERIFICATION item 10 carries it forward | closed |
| T-298-24 | Denial of service | very large subtree | accept | One owner-initiated item per request, set-based SQL (no bulk entry point, `test_298_org_move_unit.py:242`). See AR-298-04 | closed |
| T-298-25 | Info disclosure (UI) | list hooks after a switch | mitigate | Org-tagged held state, rows only when tag == active, late answers dropped by request id: `frontend/src/hooks/useFolders.ts:71-83,195-196`, `hooks/useThreads.ts:67-80,117-118` (WR-03 catch arm `:77`), `hooks/useLibraryDocuments.ts:299-316`, `components/workflows/library/useWorkflowLibraryFeeds.ts:153-244`, `components/workflows/history/RunLogPanel.tsx:119-162`; IN-05 `useLibraryOrgSwitch.ts:105` | closed |
| T-298-26 | Tampering | stale-row actions after a switch | mitigate | Rows derive `[]` under a foreign tag (above) so rows + menus unmount; server: folder create 404s a parent in another org `backend/app/api/folders.py:70-77`, draft create stamps validated active org `api/workflows.py:1221-1227`, Root upload `org_lists.py:72-84` | closed |
| T-298-27 | Info disclosure | Realtime folder rows | mitigate | `isForeign` `frontend/src/hooks/useFolders.ts:45-48`; foreign INSERT ignored `:122`; foreign UPDATE removes the row `:130-132` | closed |
| T-298-28 | Info disclosure | folder labels in pickers | accept | Labels only from the 298-01 route (T-298-04 controls). See AR-298-05 | closed |
| T-298-29 | Denial of service | label lookups | accept | Chunked at 50 `frontend/src/lib/api/orgItems.ts:31,41-49`. See AR-298-06 | closed |
| T-298-30 | Elevation | client-side eligibility | accept | Server re-does every check inside the move txn (T-298-15..21). See AR-298-07 | closed |
| T-298-31 | Tampering (XSS) | server sentences / org names | mitigate | `dangerouslySetInnerHTML` occurrences in `frontend/src/components/org/*.tsx` = 0 (re-grepped by auditor); literal-text test `components/org/__tests__/MoveToOrgSheet.test.tsx:161-163`. Note: the "grep gate" was a plan-time acceptance check (`298-05-PLAN.md:203`), not a standing CI fence | closed |
| T-298-32 | Spoofing (UI) | stale preview across a switch | mitigate | Host closes a sheet opened under another org: `stale = mine.openedIn !== activeOrgId` → `closeMoveSheet()` `frontend/src/components/org/MoveToOrgSheet.tsx:446-450`; server re-checks at confirm (T-298-17) | closed |
| T-298-33 | Info disclosure | elsewhere counts | accept | Store renders only what the RLS route returned (T-298-03 controls). See AR-298-08 | closed |
| T-298-34 | Repudiation | move receipt | mitigate | `moveOrgItem` throws on `!res.ok` `frontend/src/lib/api/orgItems.ts:111-120`; `setPhase("moved")` only in the resolve arm `MoveToOrgSheet.tsx:239-243`; "· recorded" copy `orgItemsCopy.ts:150`; receipt is the server audit row (T-298-19); ledger labels added (WR-07) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-298-01 | T-298-05 | One bounded query per call; ≤50 ids; measured prod scale 17 folders. | plan-time register (298-01) | 2026-10-28 |
| AR-298-02 | T-298-07 | Plan 01 adds read routes and a create keyword only; no new audited action. | plan-time register (298-01) | 2026-10-28 |
| AR-298-03 | T-298-22 | Migration 217 creates no function, so no PUBLIC EXECUTE grant. Shape test proves it. `get_advisors(security)` is an owed operator step after the cloud paste. | plan-time register (298-03) | 2026-10-28 |
| AR-298-04 | T-298-24 | One owner-initiated item per request; set-based SQL; prod 17 folders / 206 documents. | plan-time register (298-03) | 2026-10-28 |
| AR-298-05 | T-298-28 | Labels come only from `/org-items/folder-labels` (visible ids, member-org names). | plan-time register (298-04) | 2026-10-28 |
| AR-298-06 | T-298-29 | One batched read per resolve, chunked at 50. | plan-time register (298-04) | 2026-10-28 |
| AR-298-07 | T-298-30 | Client eligibility is a convenience; the server re-checks inside the move transaction. | plan-time register (298-05) | 2026-10-28 |
| AR-298-08 | T-298-33 | The count store renders only the RLS-scoped route's answer for member orgs. | plan-time register (298-05) | 2026-10-28 |
| AR-298-R1 | T-298-08 (review WR-06) | **Residual: header-less draft create.** The check reads the owner's org with the mig-106 trigger's own statement (`SELECT om.org_id FROM public.org_members om WHERE om.user_id = $1 LIMIT 1`; `foreign_folder_refusal.py:69-71`, matches `106_org_id_autofill_trigger.sql:98-101`). There is no `ORDER BY`, so for a header-less caller in two orgs the check and the stamp agree only because they run the same statement under the same plan, not by construction. Bounded: the ORG-05 refusal still fires at every launch door, keyed on the row's org. Cloud has 0 multi-org users (298-ORG-AUDIT); local has 5. Revisit before any multi-org cloud user exists. | **accepted** 2026-10-30 (recorded by Claude under the operator's "finish this phase" mandate; bounded as stated; revisit before any multi-org cloud user) | 2026-10-28 |
| AR-298-R2 | T-298-17 (review WR-05) | **Residual TOCTOU window for unlocked binders.** The move locks folder, document and draft rows and re-runs every refusal, but it does not serialize two writers. One is a concurrent draft save (`raise_if_foreign_change`, then the UPDATE as two pool calls). The other is a chat folder bind (`_authorize_thread_folder`, then a supabase-py write). If either ran its org check before the move committed, it can still write afterwards. Reproduced live (`test_298_org_move_live.py:868,885`), and named in the module docstring (`org_move.py:34-42`, pinned by `test_298_org_move_unit.py:247`). A shared advisory lock is not feasible because the chat write is not on the pool. Bounded: the workflow is refused at launch in words (ORG-05, every door). The chat still reads the folder, which is the caller's own, and is only listed under the other org. | **accepted** 2026-10-30 (recorded by Claude under the operator's "finish this phase" mandate; bounded at every launch door) | 2026-10-28 |

*Accepted risks do not resurface in future audit runs.*

**Informational (not a threat-register item):** review WR-08 is deferred (deferred-items #5). The Builder's "lives in <org>" hint is keyed on the viewer's active org instead of the definition's org. The hint is wrong, but nothing is written wrong: the server refusal is keyed on the row's org (T-298-09).

---

## Threat Flags (from SUMMARY.md) and review findings

- All five SUMMARY `## Threat Flags` sections say "None beyond the plan's register". **Unregistered flags: none.**
- These security-relevant review findings were fixed after the summaries were written, and each maps to an existing threat:
  - CR-01 maps to T-298-15, T-298-16 and T-298-19 (receipt names the true source org).
  - WR-04 maps to T-298-16.
  - WR-05 maps to T-298-17 (residual AR-298-R2).
  - WR-06 maps to T-298-08 (residual AR-298-R1).
  - WR-09 maps to T-298-06.
- None of these fixes adds new attack surface. The new paths are a refusal code (`mixed_orgs`), one read of the ancestor walk, one pool read for `owner_default`, and a 503 refusal on the Root upload.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-28 | 34 | 34 | 0 | gsd-security-auditor (Claude), at HEAD `9f7be04f4`; `pytest tests/unit/test_298_*.py` 188 passed; live suites cited, not run |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [ ] Operator acknowledgement of residuals AR-298-R1 (WR-06) and AR-298-R2 (WR-05)
- [ ] Operator deploy steps (T-298-22 / T-298-23): paste 217 into cloud, `get_advisors(security)`, then deploy backend

**Approval:** verified 2026-10-28 (auditor). Residual acknowledgement pending operator.
