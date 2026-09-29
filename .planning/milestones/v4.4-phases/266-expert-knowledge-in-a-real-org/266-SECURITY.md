---
phase: 266
slug: expert-knowledge-in-a-real-org
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-25
---

# Phase 266 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (`register_authored_at_plan_time: true`), 35 threats across the five
> `<threat_model>` blocks in `266-0{1..5}-PLAN.md`. Every mitigation was checked against the code at HEAD
> (`bd33e6bc4`, `develop`). SUMMARY claims were not accepted as evidence.
> `asvs_level` and `block_on` were unset in config, so the defaults apply: ASVS 1, block on open threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| PostgREST (anon/authenticated) → `public.expert_installs` | Untrusted clients could read or write install rows | Install rows (org id, folder id, status, error sentence) |
| Backend pool (BYPASSRLS) → `expert_installs` / `folders` / `documents` | The bound `org_id = $1` predicate is the only tenancy boundary | Tenant install and document metadata |
| `expert_bundles` row → resolver scope | The folder ids a bundle names decide what retrieval may read | Folder ids (retrieval scope) |
| Repo corpus dir → backend process | File paths are derived from a bundle slug and a manifest | Corpus bytes |
| Browser → `POST /experts/{id}/install` | The caller chooses the bundle id and the `X-Org-Id` header | Bundle id and org header (no body) |
| Backend (user-JWT client) → `folders` / `documents` | RLS WITH CHECK proves org membership and ownership | Tenant folder and document rows |
| Backend (service role) → storage and `ingestion_jobs` | Privileged writes keyed to the minted document id | Corpus bytes and job rows |
| Server install state → UI | The UI renders server-derived state and never decides readiness | `install.state`, `can_install`, `cause` |
| Planning artefacts → git | Evidence files are committed | Drive transcripts (tokens must be absent) |
| This phase → production | Must not cross without per-action approval | Migration 195, tier rows |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-266-01 | Information disclosure | `expert_installs` via PostgREST | mitigate | RLS enabled `supabase/migrations/195_…sql:69`. REVOKE ALL from PUBLIC, anon and authenticated at `:73-75`, then GRANT SELECT to authenticated at `:76`. One policy, FOR SELECT over `current_user_org_ids()`, at `:79-82`. The supplement mirrors the ACL at `scripts/full-schema-supplement.sql:504-509`. The dumped artefact carries RLS and the policy at `supabase/full-schema.sql:7482,7488`. Shape tests: `test_266_migration_195_shape.py::test_expert_installs_privileges_are_member_read_only`, `::test_exactly_one_policy_member_read_over_current_user_org_ids` and `::test_every_grant_and_revoke_is_mirrored_verbatim_in_the_supplement`. Post-paste measurements (anon SELECT false, authenticated INSERT false, authenticated SELECT true, 1 policy) are in `266-01-SUMMARY.md` "Task 3 — completed by the orchestrator". | closed |
| T-266-02 | Tampering | `expert_installs` via PostgREST | mitigate | No INSERT/UPDATE/DELETE grant and no write policy for a client role (`195:76-85`). Only `service_role` receives writes (`:77`). `test_expert_installs_privileges_are_member_read_only` fails on any client write grant. | closed |
| T-266-03 | Elevation / Info disclosure | `resolve_expert_bundle` folder admission | mitigate | The bypass is deleted and its old line is quoted as a comment (`backend/app/services/expert_service.py:500-507`). Admission is `f_org_id == caller_org_id and (owner or shared)` (`:509`). Fence: `test_266_system_folder_bypass_fence.py`, including a positive control. The integration plant `test_266_two_org_fence.py::test_plant_system_owned_folder_in_org_b_is_never_admitted` was driven RED against the base resolver (`266-05-SUMMARY.md` "Base-resolver RED"). **CR-01 follow-on verified:** `backend/app/services/run_producer.py:378-380` defines `ExpertScopeUnavailable(ValueError)`, and `:463-470` refuses a RESTRICTED Expert whose resolved folder list is empty. Both run builds go through `_resolve_thread_scoping`: Deep at `:706` and continuation at `:879`. Commits: RED `73cb9726a`, GREEN `2c4102070`. Tests: `test_266_restricted_empty_scope_refuses.py` (6 cases: first-party uninstalled, org Expert fully stripped, Expert kept on the thread, ValueError subclass, biased unchanged, restricted with a folder unchanged). | closed |
| T-266-04 | Information disclosure | Install-sourced folder ids | mitigate | `get_expert_install` binds `org_id` from the validated caller org (`expert_service.py:476-481` → `backend/app/db/experts.py:585-606`, `WHERE i.org_id = $1`). An install-sourced id still runs through the strict caller-org loop (`expert_service.py:486-524`). Tests: `test_266_resolver_reads_installs.py::test_d_install_sourced_folder_in_another_org_is_still_stripped` and integration `::test_plant_install_row_pointing_at_org_b_is_stripped`. The CR-01 refusal (above) covers the empty-result arm. | closed |
| T-266-05 | Tampering | Pool queries in `db/experts.py` | mitigate | Every install statement uses numbered binds (`db/experts.py:585-749`). The f-strings interpolate only the constant `_INSTALL_COLUMNS`. `test_266_install_queries.py::_no_interpolation` is asserted on all 7 query functions. | closed |
| T-266-06 | Denial of service | Index rebuild on `documents` | accept | Non-concurrent build inside one transaction. The reason is stated at `195:91-92`, and `test_completed_hash_index_is_org_scoped_and_not_concurrent` pins it. See the Accepted Risks Log. | closed |
| T-266-07 | Repudiation | Seed retirement | mitigate | The reason is in the header (`195:6-18`, SEED-177 / D-206-07). Deletes are by fixed id only (`:104-110`), and the folder delete is also predicated on the seed user. `test_kept_skill_is_never_deleted_or_updated` asserts no DELETE or UPDATE targets `skills`. Skill `…0264` was measured 1 → 1 across the paste (`266-01-SUMMARY.md` Task 3 table). | closed |
| T-266-08 | Tampering / Info disclosure | `expert_corpus.load_corpus` path handling | mitigate | `SLUG_RE`/`FILENAME_RE` use `fullmatch` before any filesystem access (`backend/app/services/expert_corpus.py:75-79,140-146`). There is a `..` refusal (`:143`). `resolve()` plus `is_relative_to` checks the root (`:82-87`), the manifest (`:113-115`) and each file, with a parent-equality check on files (`:153-155`). Tests: `test_266_corpus_verbatim.py::test_load_corpus_refuses_malformed_slugs` and `::test_load_corpus_refuses_manifest_paths_that_escape`. | closed |
| T-266-09 | Elevation (code execution) | Corpus directory | mitigate | The loader only reads bytes and parses JSON (`expert_corpus.py:120,159`). The tree holds only `manifest.json` and `.md` (measured with `find backend/app/experts -type f`). `test_corpus_directory_is_never_importable` asserts no `__init__.py` and no `*.py`. | closed |
| T-266-10 | Tampering | `mint_document_row` `is_latest` retirement | mitigate | `backend/app/services/ingest_splice.py:241-242` adds `.eq("org_id", org_id)` to the retirement update when an org is passed. Tests: `test_266_mint_org_scope.py::test_retirement_update_is_filtered_by_the_installing_org` and `::test_versioning_and_retirement_never_touch_another_orgs_row`. | closed |
| T-266-11 | Information disclosure | Dedup / link re-query | mitigate | Org arm on dedup (`ingest_splice.py:215-216`), on version lookup (`:235-236`) and on the link re-query (`:303-304`). Migration 195 widens `documents_completed_hash_unique_idx` to `(org_id, user_id, content_hash)` (`195:93-96`). Tests: `::test_dedup_hit_is_only_reachable_from_the_same_org` and `::test_link_requery_never_adopts_another_orgs_row`. The install service also refuses to adopt a dedup hit outside its folder or org (`expert_install_service.py` `ExpertInstallConflict` arm). | closed |
| T-266-12 | Tampering (regression) | `/upload` behaviour | mitigate | Every org arm is guarded by `if org_id:`. Tests: `test_upload_path_without_org_issues_the_base_queries_exactly` and `test_upload_path_insert_payload_carries_no_org_id`. | closed |
| T-266-13 | Integrity | Corpus hashing across OSes | mitigate | `normalise_bytes` converts CRLF to LF (`expert_corpus.py:70-72`) and is applied to the manifest and every file. `.gitattributes:2` sets `backend/app/experts/corpora/** text eol=lf`. Test: `test_corpus_version_is_identical_on_a_crlf_checkout`. | closed |
| T-266-14 | Elevation / Tampering | Install into an org the caller is not in | mitigate | The org comes only from `Depends(get_active_org_id)`. The route has no body parameter (`backend/app/api/experts.py:544-556`). Tests: `test_266_install_route_gates.py::test_the_org_comes_only_from_the_active_org_never_the_body` (a body `org_id` is ignored) and `::test_the_install_route_takes_no_body_and_its_guards_sit_in_positional_defaults` (AST check plus a BaseModel-annotation check). The user-JWT client gives a second, DB-level proof through RLS WITH CHECK (`experts.py:554`). | closed |
| T-266-15 | Elevation | Non-admin writes org-wide Library content | mitigate | `Depends(require_expert_manage)` (`experts.py:552`) checks `experts:manage` in the same active org (`:140-155`). Test: `::test_a_non_manager_is_refused_and_the_service_is_never_awaited` (`minst.assert_not_awaited()`). | closed |
| T-266-16 | Elevation | Standard-tier bypass | mitigate | The only tier check is the router-level `dependencies=[Depends(require_capability("experts"))]` (`experts.py:70-74`). `grep subscription_tier` over `api/experts.py` and `expert_install_service.py` returns nothing. The AST fence `test_259_expert_entitlement_gate.py::test_experts_api_single_home_ast_compliance` enforces this. The router-gate case is extended to both new routes (`test_259…:183-193`). | closed |
| T-266-17 | Tampering | Service-role write lands in the wrong org | mitigate | The service receives `get_user_supabase_client` (`experts.py:554,581`). The folder insert (`expert_install_service.py:430-442`, with an explicit `org_id`) and every mint (`:594-603`, `org_id=str(org_id)`) use that user client. The service role is reached only inside `_enqueue_or_splice` (`backend/app/services/sources/import_service.py:123,139-144`), which passes `org_id=UUID(active_org)` to `insert_ingestion_job`. The install service passes `active_org=str(org_id)` at `:498` and `:612`. | closed |
| T-266-18 | Info disclosure | 404 vs 409 oracle on granted or private bundles | mitigate | `get_expert_service(... caller_user_id, caller_roles)` runs before the install service. `None` returns a 404 (`experts.py:567-577`). Test: `::test_a_bundle_the_caller_cannot_see_is_404` (service not awaited). | closed |
| T-266-19 | Info disclosure | Error bodies | mitigate | The catch-all detail is the literal `"Could not install this Expert."` (`experts.py:608-613`), with `exc_info=True` logging only. Named refusals carry fixed sentences (`expert_install_service.py:203-217` constants, `experts.py:591-605`). Passed-through `HTTPException`s from `ingest_splice` are literals (`ingest_splice.py:164,168,320`). Tests: `::test_an_unexpected_failure_is_a_500_with_a_literal_detail` and `::test_named_refusals_are_structured_409s`. *Note:* the exception paths are clean. The 202 **success** body (`ExpertInstallResult.install.cause`) can still carry a document's raw `error_message`. See Warning W-1 (IN-05). | closed |
| T-266-20 | DoS / Integrity | Concurrent installs across WORKER_COUNT=2 | mitigate | The claim is a guarded CAS: `INSERT … ON CONFLICT (org_id, expert_bundle_id) DO UPDATE … WHERE status <> 'installing' OR updated_at < now() - interval '10 minutes' RETURNING *` (`db/experts.py:652-667`). A lost claim returns early with no writes (`expert_install_service.py:544-552`). Tests: `test_266_install_idempotency.py::test_i_a_lost_claim_mints_nothing_and_writes_nothing` and `test_266_install_queries.py::test_claim_expert_install_is_a_guarded_upsert_that_keeps_installed_by`. | closed |
| T-266-21 | Tampering | Re-install overwriting edited documents | mitigate | A present document that is not `failed` is skipped (`expert_install_service.py:576-577`). A failed document is re-driven only when `row.user_id == caller` (`:579`). Otherwise it is named with `REDRIVE_NOT_OWNER` and left untouched (`:589-590`). The reset UPDATE is filtered by id **and** `user_id` on the user-JWT client (`:483-488`). Child deletes run only after the owner check, through RLS. Tests: `::test_vii_an_edited_document_is_left_untouched`, `::test_iv_a_failed_document_owned_by_the_caller_is_re_driven_in_place` and `::test_v_a_failed_document_owned_by_someone_else_is_named_not_touched`. *WR-05 and WR-06 are durability and recoverability defects. They do not weaken the only-FAILED, only-by-owner property.* | closed |
| T-266-22 | Info disclosure | `GET /experts/installs` | accept | Own org only. `list_expert_installs_for_org` binds `WHERE i.org_id = $1` (`db/experts.py:626`). The org comes from `get_active_org_id` (`experts.py:492-505`). Tier-gated (`test_259…:191-193`). See the Accepted Risks Log. | closed |
| T-266-23 | Repudiation | Who installed | mitigate | `installed_by` is set on the claim insert (`db/experts.py:653-656`) and on folder repoint (`:686-691`). `updated_at` is set on every write. Minted documents carry `user_id=str(user_id)` (`expert_install_service.py:598`). No new audit action type. | closed |
| T-266-24 | Tampering | `installExpert` request | mitigate | `frontend/src/lib/api/experts.ts:234-241` sends `POST` with headers only and no body. `getAuthHeaders` adds `X-Org-Id` (`frontend/src/lib/api/_core.ts:278-280`), which the server validates. | closed |
| T-266-25 | Information disclosure | Failure-cause **rendering** | mitigate | UI half verified. The only renderer of `install.cause` is `ExpertDetailModal.tsx:379`. It reads `view.cause`, and that value comes only from `installCause()` (`expertCatalog.ts:155-162`). That function routes every non-`install` cause through `classifyIngestionError`. `grep` finds no other `install.cause` reader in `frontend/src` (the card and invite dialog render none). Tests: `expertCatalog.test.ts` case (14) and `ExpertDetailModal.test.tsx` case (13) assert that `DRIVER_DICT` never reaches the view or the DOM. *Note:* `classifyIngestionError` passes through raw text that `looksHumanWritten` accepts (10-300 chars, ending `.`/`?`, no machine tells). That is the Library's existing vocabulary contract, not a new path. **The WIRE does carry the raw `error_message`.** See W-1. | closed |
| T-266-26 | Elevation (UX) | Non-manager sees an Install control | mitigate | The control comes from the server's `can_install` (`expertCatalog.ts:164-187`). A forged click is still refused by `require_expert_manage` (T-266-15). | closed |
| T-266-27 | Information disclosure | Library provenance fetch | accept | `listExpertInstalls` returns own-org rows only (server `WHERE i.org_id = $1`). A 403 becomes `[]` (`lib/api/experts.ts:247-252`). See the Accepted Risks Log. | closed |
| T-266-28 | DoS | Install-state polling | mitigate | `INSTALL_POLL_MS = 4000` (`ExpertCatalogPage.tsx:62`). The effect is keyed on the boolean `anyInstalling`, returns early when it is false, and calls `clearInterval` on cleanup (`:164-183`). | closed |
| T-266-29 | Spoofing (XSS) | `expert_name` in the provenance label | mitigate | Rendered as a React text child: `{caption}` (`NavRow.tsx:218-219`), fed by `FolderNode.tsx:108`. No `dangerouslySetInnerHTML` or `innerHTML` in NavRow, FolderNode, FolderTree, LibraryPage, the catalog components or InviteExpertDialog (grep exit 1). | closed |
| T-266-30 | Information disclosure | Tokens, passwords or service-role key in evidence | mitigate | `grep -rn "eyJ"` over the phase dir finds only the two lines of `266-05-PLAN.md` that define the check (`:180`, `:259`). Evidence has **zero** hits. A secret-pattern grep (`sb_secret_`, `sb_publishable_`, `service_role_key`, `SUPABASE_SERVICE`, `sk-…`, `sk-ant-`, long `Bearer` tokens, `authorization=`, `password=`) finds only `Authorization: Bearer <redacted>` in `evidence/01` and `evidence/03`. A `passw\|secret\|api_key\|token=` grep finds only a prose line in `266-UAT-LOG.md:7` saying passwords stayed in the scratchpad. | closed |
| T-266-31 | Repudiation | A vacuous fence | mitigate | `test_266_two_org_fence.py::test_subjects_are_single_org` asserts `_memberships(s) == {org_a}`, and every leg re-asserts it (`:182,198,231`). Positive controls for org B are at `:193,225`. Two resolver plants were driven RED against the base resolver (`266-05-SUMMARY.md:91-106`). | closed |
| T-266-32 | Spoofing (evidence) | `audit_log.org_id` autofilled | mitigate | Every retrieval-evidence query joins `metadata->'document_ids'` to `documents.org_id` (`evidence/04:17,38`, `evidence/06:16,34,59`). `grep "a\.org_id\|audit_log\.org_id"` over the evidence finds only the rule statement in `266-UAT-LOG.md:15`. | closed |
| T-266-33 | Tampering | Local tier or membership changes left behind | mitigate | Prior tiers are recorded (`evidence/00:6` "prior tiers: u1=None u2=None", `evidence/09:4`). The temporary U1→B membership removal is quoted with a re-read showing only org A (`evidence/06:64-65`). The tier changes were left on throwaway local UAT orgs, with prior values recorded, as the plan allowed. | closed |
| T-266-34 | Elevation | Production writes | mitigate | `266-PROD-PARITY.md:3-7` says "CHECKLIST ONLY. NOTHING HAS BEEN APPLIED TO PRODUCTION" and requires per-action approval. Phase commits are on `develop` only: `git branch -a --contains 2c4102070` and `… 87d60eeb4` both return `develop` only. | closed |
| T-266-35 | Information disclosure | Out-of-scope question answered from invented content | mitigate | The SC#4 refusal row records the full assistant text, which refuses and names the one document in scope (`evidence/06:22-31`). Its retrieval ids are recorded as `n_ids: 0` for both vacation queries (`evidence/06:37-38`). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-266-01 | T-266-06 | `documents_completed_hash_unique_idx` is rebuilt without `CONCURRENTLY`. `CONCURRENTLY` cannot run inside the `BEGIN … COMMIT` that the SQL-editor paste uses, and `public.documents` is small enough for a brief build lock. The new key is strictly looser, so no existing row can fail the build. Stated at `195:87-96`. | Plan 266-01 threat register (plan-time disposition) | 2026-09-25 |
| AR-266-02 | T-266-22 | `GET /experts/installs` returns only the active org's installs. The org is bound in SQL (`db/experts.py:626`) from `get_active_org_id`, which validates membership. The names and folder ids it returns are already visible to members through the org-shared folder. | Plan 266-03 threat register (plan-time disposition) | 2026-09-25 |
| AR-266-03 | T-266-27 | The Library provenance fetch reads the same own-org endpoint. A 403 (tier refusal) becomes an empty map, so a standard-tier org sees no provenance note and no error. | Plan 266-04 threat register (plan-time disposition) | 2026-09-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Warnings (non-blocking)

| ID | Kind | Finding | Evidence | Suggested routing |
|----|------|---------|----------|-------------------|
| W-1 | unregistered surface (wire) | **The raw `documents.error_message` crosses the API boundary as `install.cause`** when `cause_source == "document"`. It appears in `GET /experts`, `GET /experts/{id}`, the management list and the 202 body of `POST /experts/{id}/install`. No threat ID covers the wire: T-266-25's mitigation covers rendering and T-266-19's covers exception bodies, and both hold. For the normal case this exposes nothing new: the install folder is created `is_org_shared = true` (`expert_install_service.py:438`), and the documents SELECT policy already lets any org member read documents in an org-shared folder (`full-schema.sql:7006`). One edge case **is** new exposure. If the installer turns sharing off on the folder (the WR-05 scenario), members lose RLS read access to the row, but the pool-side overlay (BYPASSRLS, `db/experts.py:725-749`) still sends them its `error_message`. The pinned test `test_266_install_state.py:99-101` treats the raw pass-through as the contract. | `expert_install_service.py:206` | Fold into the IN-05 triage: classify on the server, or send a cause code so `install.cause` is a fixed sentence on the wire as it already is for `cause_source == "install"`. |
| W-2 | residual hazard (outside the register) | `retrieval_service` still treats `folder_ids == []` as "no filter" (`retrieval_service.py:121,153`, per REVIEW CR-01). The CR-01 fix closes this for **restricted** Experts at the run-producer seam. A **biased** Expert with no folders still searches without a folder filter, which the fix keeps on purpose (`test_biased_expert_with_no_folders_is_unchanged`, operator decision OV-266-02). Any future caller that hands retrieval an empty list meaning "nothing" would fail open. | `run_producer.py:463-470` | The reviewer suggested recording it as a seed. It is not a phase-266 blocker. |
| W-3 | open review findings (context) | REVIEW findings WR-01 to WR-08 and IN-01 to IN-05 are OPEN and awaiting operator triage. None of them removes a declared mitigation. WR-05/WR-06 affect recoverability and durability of the T-266-21 re-drive, but not its only-FAILED, only-by-owner property. WR-03/WR-04 are cross-folder versioning and dedup-index side effects that fall outside T-266-10/11 as those were declared (both are org-scoped as declared). | `266-REVIEW.md` | Operator triage, as already planned. |

## Unregistered Flags (from SUMMARY `## Threat Flags`)

None. All five SUMMARYs report "None", and each named surface maps to a registered threat: 266-01 → T-266-01..07, 266-02 → T-266-08/09, 266-03 → T-266-14..23, 266-04 → T-266-24..29, 266-05 → none (one argument's type changed on an existing internal call, plus one optional presentational prop). W-1 above was found by this audit, not flagged by an executor.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-25 | 35 | 35 (32 mitigate verified in code/tests, 3 accept logged) | 0 | gsd-security-auditor (Claude) |

**Verification runs at HEAD `bd33e6bc4`:**
- Backend: `pytest tests/unit/test_266_*.py tests/unit/test_259_expert_entitlement_gate.py -q` → **127 passed**. This includes the 6 CR-01 cases in `test_266_restricted_empty_scope_refuses.py`.
- Frontend: `vitest run src/components/experts/catalog/__tests__ src/__tests__/components/FolderNode.test.tsx src/components/chat/__tests__/ComposerExpert.test.tsx --maxWorkers=2` → **6 files, 96 passed**.
- `backend/tests/integration/test_266_two_org_fence.py` needs the live local DB and was **not re-run by this audit**. Its non-vacuity structure (single-org subject asserts, positive controls, plants) was verified by reading the source. The RED-against-base run is recorded in `266-05-SUMMARY.md:91-106`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-25 (threat register). W-1 to W-3 are recorded as non-blocking warnings for operator triage.
