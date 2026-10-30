---
phase: 304
slug: personal-mcp-keys-that-act-as-you
status: verified
threats_total: 47
threats_closed: 47
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-10-31
audited_at_head: d822f6607
independent_review: self
---

# Phase 304 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register is the union of the six `<threat_model>` blocks in `304-01-PLAN.md` … `304-06-PLAN.md`
> (T-304-01 … T-304-47). Each threat was checked against the code at HEAD `d822f6607`, and the tests
> named as evidence were RE-RUN for this audit (see the Audit Trail). A plan's or SUMMARY's word was
> never accepted as evidence on its own.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| API process → Postgres (acting connection) | The org a key acts in crosses as the transaction-local GUC `app.acting_org_id`. Only server code may state it. | org id (authorization-bearing) |
| authenticated / anon roles → public tables | PostgREST exposes column grants. New columns and functions must not widen exposure. | `api_keys` rows, `organizations.mcp_enabled`, SECURITY DEFINER EXECUTE |
| migration author → production | The cloud paste of 220/221 happens with 305, with approval for each action. | schema + ACLs |
| MCP client / integration → resolver | The presented secret is untrusted input. | `srl_mcp_` / `srl_live_` secret |
| resolver → Postgres (service-role pool) | Key rows, membership and switches are read live on every call. | key row, membership, switch booleans |
| 304 core → 305/306/307/308 | The liveness predicate and `McpPrincipal` are the only sanctioned contract. | principal (user, org, scope) |
| key principal → acting connection | The only visibility inputs are the principal's user and org. RLS decides the rows. | document/folder/view/workflow rows |
| acting reads → supabase-py | PostgREST never sees the GUC. Service role is used only to enrich ids or to propose ids that the RLS step then decides. | ids, filenames |
| browser (member JWT, X-Org-Id) → key routes | The create body, folder ids and tool names are untrusted. | key config |
| org admin → org switch route | The caller must hold `org:manage` in the ACTIVE org. | switch boolean |
| operator → `/admin/flags` | This is the existing operator-only path. | deployment switch |
| server response → screen → clipboard | Catalogue, folders, URL and switch state are rendered as sent, never retyped. Snippets leave the app without the secret. | snippet text |

---

## Threat Register

Status legend: **closed** = mitigation found in code at the cited location and its test re-run green · **closed (accepted)** / **closed (transferred)** = disposition documented where quoted.

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-304-01 | EoP | `current_user_org_ids()` GUC | mitigate | `supabase/migrations/221_acting_org_narrowing.sql:54-64` adds `AND (… IS NULL OR org_id = NULLIF(current_setting('app.acting_org_id', true), '')::uuid)` to the `org_members` read, so the result can only narrow. Live: `test_304_acting_org_rls_live.py::test_acting_in_a_non_member_org_sees_nothing` (empty org set, every org-scoped table count 0). Counterfactual `test_counterfactual_every_routed_arm_fails_under_the_old_schema` drives the old body RED. | closed |
| T-304-02 | Info disclosure | membership readers that bypass the function | mitigate | `221:71-90` (`current_user_has_permission` gains `AND m.org_id IN (SELECT public.current_user_org_ids())`). `221:93-185` re-creates all six policies (`expert_bundles_read/write`, `expert_grants_read/write`, `model_rates_select/insert`), the FOR ALL ones included. Live: `test_current_user_has_permission_narrows`, `test_acting_in_x_hides_every_y_row_and_keeps_system_rows` (TABLES includes `expert_bundles`, `expert_grants`), `test_counterfactual_routing_only_the_function_still_leaks_experts` (R-05b). Static: `test_304_migrations_static.py::test_221_all_six_policies_route_through_the_function`. `scripts/check-migration-221-live.py` → `221 live`. | closed |
| T-304-03 | Spoofing | `app.acting_org_id` source | mitigate | The ContextVar lives at `backend/app/security/acting_org.py:25`. The only setter is `backend/app/security/acting_member.py:41-48` (`uuid.UUID` validation, then set, with reset in `finally`). Fence: `test_304_acting_reads_fence.py::test_only_the_two_security_modules_name_the_contextvar`, `test_the_acting_member_module_never_reads_a_request`, `test_a_malformed_org_is_refused_before_anything_is_set`. MCP path: the org comes from the key row (`mcp_principal.py:38-49` → `principal.org_id`). Note: the browser routes `GET /api-keys/folders` and the MCP create pass the active org from `get_active_org_id`. That value is validated against membership (403 for a non-member, `dependencies.py:909+`), and plan 304-04 Task 1 sanctions it. It still reaches the ContextVar only through `acting_member.py`, and the GUC can only narrow. | closed |
| T-304-04 | Info disclosure | GUC leaking across pool borrowers | mitigate | `backend/app/dependencies.py:163-165` uses `set_config('app.acting_org_id', $1, true)` (is_local) inside `conn.transaction()` (`:184-187`). Live: `test_the_guc_never_survives_the_transaction` reuses ONE physical connection for two transactions, and the second sees both orgs and an empty GUC. | closed |
| T-304-05 | Info disclosure | `api_keys.key_hash` + new columns | mitigate | `220:97-102`: REVOKE ALL from PUBLIC/anon/authenticated/service_role first, then a column GRANT that never names `key_hash`. Live: `test_privileges` (anon holds no column privilege; authenticated cannot read `key_hash` but can read the 4 new columns), `test_anon_reads_no_key_and_no_switch` (the authenticated `SELECT key_hash` raises InsufficientPrivilege). | closed |
| T-304-06 | EoP | SECURITY DEFINER EXECUTE via PUBLIC | mitigate | `221:65-68` and `221:87-90` issue REVOKE FROM PUBLIC, then anon, before each GRANT. Live catalog: `test_privileges` asserts `has_function_privilege('anon', …, 'EXECUTE') = false` for both functions. Static: `test_221_revoke_public_before_any_grant_after_each_function`. The role-level anon CALL is deliberately not made (BUG-261031-01, see Operator-owed). | closed |
| T-304-07 | Tampering | `organizations.mcp_enabled` via PostgREST | mitigate | `220:111` adds a dedicated column. Mig 194's column grant is `GRANT UPDATE (name, slug, settings, updated_at)` (`194_org_plan_columns_not_client_writable.sql:35`) after a table-level REVOKE (`:23-25`), and 220 adds no grant for the new column. Live: `test_privileges` asserts `has_column_privilege('authenticated','public.organizations','mcp_enabled','UPDATE') = false`. The only writer is `db/api_keys.py:268` behind `require_org_manage`. | closed |
| T-304-08 | Tampering / DoS | organizations DELETE/TRUNCATE (BUG-261030-03) | mitigate | `221:188-190` issues REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES from PUBLIC (first), anon and authenticated. Live: `test_privileges` asserts all four are false for anon and authenticated. Static: `test_221_organizations_revokes_public_first`. | closed |
| T-304-09 | DoS | plan-shape regression | mitigate | Function attributes are re-declared identically (`221:54-58`). Static `test_221_current_user_org_ids_keeps_every_attribute`. `scripts/explain-acting-org.py` → `evidence/explain-acting-org.txt` verdict: "A == B for all 12 statements: True; every current_user_org_ids() node loops=1 … GATE PASSED". Backend baseline 70 ≤ 71 (`304-VALIDATION.md` §4). | closed |
| T-304-10 | Tampering | malformed GUC value | accept | Backstop present: the `::uuid` cast raises, and live `test_a_malformed_guc_fails_closed` expects `InvalidTextRepresentationError`. Primary control: UUID validation in `acting_member.py:43` (`test_a_malformed_org_is_refused_before_anything_is_set`). Acceptance is documented in AR-01. | closed (accepted) |
| T-304-11 | Repudiation | cloud parity of 220/221 | transfer | Transferred to the operator: CONTEXT D-30/D-33, `304-01-SUMMARY.md:129` ("Cloud paste of 220/221 is owed with Phase 305 … then runs get_advisors(security)"), `304-VALIDATION.md` §5 item 3. Both migration headers carry the PRODUCTION apply note (`220:45-46`, `221:47-48`). | closed (transferred) |
| T-304-12 | Spoofing | cross-kind key use | mitigate | Refusal #1 is the prefix check in `backend/app/security/api_key_auth.py:128-142` (`digest_key(kind=…)`). Refusal #2 is the row `kind` check at `:368-370` (`wrong_kind`). Tests: `test_304_resolver_kind.py::test_digest_refuses_the_other_kinds_prefix_both_ways`, `test_an_mcp_row_reached_as_a_workflow_key_is_refused_by_the_kind_column`, `test_a_workflow_row_reached_as_an_mcp_key_raises_wrong_kind_and_is_audited_once`. Live `test_workflow_key_at_mcp_is_refused`. | closed |
| T-304-13 | EoP | stale access after revoke/leave/ban/switch-off | mitigate | `backend/app/security/principal_liveness.py:53-79` checks revoked → expired → `is_org_member` → `_is_banned` → org switch → deployment switch, read live with no cache and never through `load_app_settings`. `recheck_principal` (`:82`) re-reads by id+org. Tests: `test_304_principal_liveness.py::test_the_order_is_exactly_d18`, `test_nothing_is_cached_between_calls`, `test_recheck_sees_a_revoke_made_after_the_first_call`, `test_the_predicate_never_imports_the_key_module_or_the_settings_cache`. Live: `test_*_next_resolution_refused` (not_member, banned, revoked, expired). | closed |
| T-304-14 | Info disclosure | refusal oracle | mitigate | `api_key_auth.py:326-333`: every `KeyRefused` at `/inbound` becomes `_invalid()`, the one `INVALID_KEY_DETAIL` 401. A sentence is set only for the switch refusals (`principal_liveness.py:75-78`). Live `test_mcp_key_at_inbound_gets_the_unknown_key_body` compares status, detail and headers with an unknown key. Note for 305: the MCP transport must map `KeyRefused` the same way (one body, sentence only for `mcp_off_*`). | closed |
| T-304-15 | Repudiation | refusals not recorded | mitigate | `api_key_auth.py:336-339` → `_refuse` (`:304-313`, throttled `refusal_audit_slot`) → `api_key.refused` with `reason`, plus `metadata.kind='mcp'` (`:184`). Test `test_each_mcp_refusal_names_its_reason_and_is_audited_with_kind_mcp`. | closed |
| T-304-16 | EoP | empty folder set read as "everything" | mitigate | `backend/app/services/key_scope.py:85-94`: `None` only when `key_folder_ids is None`, otherwise a tuple that may be `()`. `api_key_auth.py:399-404` `_ids` keeps `[]` as `()`. Tests: `test_304_key_scope.py::test_all_ticked_folders_dropped_is_empty_never_none`, `test_an_empty_ticked_list_is_empty_never_none`, `test_the_module_never_turns_nothing_into_everything`. | closed |
| T-304-17 | Tampering | second resolver drift (W-1) | mitigate | `get_key_for_auth` is called only from `api_key_auth.py:356`. `resolve_api_key` (`:316-333`) and `resolve_mcp_principal` (`mcp_principal.py:38`) both call `authenticate_presented_key`. Test `test_304_resolver_kind.py::test_there_is_one_core_and_one_wrapper` (rglob over `app/`: exactly one core + one wrapper def). | closed |
| T-304-18 | DoS | switch read failure | mitigate | `principal_liveness.py:75-78` refuses on anything but `True` (a missing org row, or a NULL/missing `app_settings('global')` via the subselect at `db/api_keys.py:254-265`). Exceptions propagate. Tests: `test_a_missing_or_null_switch_refuses`, `test_a_switch_read_failure_admits_nothing`, `test_304_resolver_kind.py::test_a_missing_switch_row_refuses`. | closed |
| T-304-19 | Info disclosure | secret at rest | mitigate | `api_key_auth.py:116-125` `mint_key` stores the `sha256` hexdigest only. `ApiKeyCreated` is the only model with `secret` (`backend/app/models/api_key.py:216-218`). Test `test_304_api_keys_routes.py::test_no_mcp_key_response_carries_a_secret_or_digest`. | closed |
| T-304-20 | Info disclosure | cross-org leak through a read | mitigate | Every read in `backend/app/services/acting_member_reads.py` opens `acting_member_connection` (`:151`, `:269`, `:281`, `:353`, `:438`) or `acting_as` (`:261`, `:345`). Live headline suite `test_304_two_org_parity_live.py` (non-owner member of two orgs; folders, list, read, search, views, relationships, workflows parity). Re-run: 0 skipped. | closed |
| T-304-21 | Info disclosure | service-role read re-implementing visibility | mitigate | Fence `test_304_acting_reads_fence.py::test_the_reads_module_is_fenced_from_every_unnarrowed_path` (FORBIDDEN_IN_READS: `org_members`, `fetch_visible_folders`, `.rpc(`, `.table(`, `document_search_service`, `document_view_resolver`, `fetch_full_document`, `Request`, `.headers` …). Service role is used only at `acting_member_reads.py:263` (retrieval enrichment) and `:348` (step-1 proposal; step 2 decides on the RLS connection). | closed |
| T-304-22 | EoP | empty/vanished folder set widening | mitigate | `acting_member_reads.py:167-169` `_nothing()` returns empty with no SQL in every read (`:211`, `:224`, `:255`, `:336`, `:343`, `:370`). Live `test_304_narrowed_key_live.py::test_a_vanished_ticked_folder_returns_nothing_never_everything`. | closed |
| T-304-23 | Info disclosure | connector-fed content via search ranking | mitigate | Search post-filters (`acting_member_reads.py:266-274`, `NOT (d.source_connection_id IS NOT NULL)` on the acting connection). It passes no `document_ids` allow-list, and the fence bans `document_ids =`. Other reads use `_scope_clauses` (`:162-163`). Live `test_connector_fed_documents_need_include_external`, `test_search_parity`. | closed |
| T-304-24 | EoP | tool outside the key's subset | mitigate | `_require` (`acting_member_reads.py:103-106`) is the first statement of all 8 reads (`READ_TOOL` `:52-61`). Live: `test_a_read_only_key_cannot_list_workflows`, `test_a_key_without_read_document_cannot_read`, `test_a_key_without_search_cannot_search` (`ToolNotGranted`). | closed |
| T-304-25 | EoP | revoked/left/banned/switched-off key still working | mitigate | Same predicate as T-304-13, driven live: `test_not_member_next_resolution_refused`, `test_banned_…`, `test_revoked_…`, `test_expired_…`, `test_mcp_off_org_refuses_and_switching_back_restores`, `test_mcp_off_deployment_refuses_and_switching_back_restores`. | closed |
| T-304-26 | Spoofing | workflow key as MCP / MCP key at /inbound | mitigate | Live `test_workflow_key_at_mcp_is_refused`. `test_mcp_key_at_inbound_gets_the_unknown_key_body` shows the body, status and headers are identical to an unknown key. Unit `test_an_mcp_secret_at_the_inbound_door_is_the_one_401_and_never_reaches_the_db`. | closed |
| T-304-27 | Repudiation | parity suite silently skipping | mitigate | `evidence/parity-gate3.txt`: `-rs`, "50 passed … `-rs` printed no SKIPPED line; exit 0". Re-run for this audit with `-q -rs` over the three live suites: 43 passed, no SKIPPED line. | closed |
| T-304-28 | EoP | foreign / invisible folder ids | mitigate | `backend/app/api/api_keys.py:460-466` checks against `list_acting_folders` on `acting_member_connection(caller, active org)`, with one sentence `_FOLDER_NOT_VISIBLE` (`:107`). Tests: `test_a_foreign_and_an_unknown_folder_are_refused_identically`, `test_folders_are_validated_on_the_callers_acting_connection_for_the_active_org`, `test_a_deleted_folder_is_refused_with_the_same_sentence`. The new `GET /api-keys/folders` (`:348-375`) also reads on the acting connection (`test_pickable_folders_are_read_on_the_acting_connection`). | closed |
| T-304-29 | Tampering | unknown tools / orphan companions | mitigate | `api_keys.py:456-458` → `backend/app/services/mcp_tool_catalogue.py:89-113` `normalise_tool_selection` (empty, unknown and orphaned companions are each refused) → 422. Tests: `test_an_unknown_tool_is_refused_by_name`, `test_a_companion_without_its_lead_is_refused_naming_the_lead`, `test_304_tool_catalogue.py::test_an_orphaned_companion_is_refused_naming_its_lead`. | closed |
| T-304-30 | EoP | empty folder/tool set read as "all" | mitigate | Model: `models/api_key.py:188-195` raises `MCP_EMPTY_FOLDERS_SENTENCE` on `[]` → 422. Tools: `mcp_tool_catalogue.py:96-97`. DB backstop: `220:71-79` (`api_keys_folder_ids_check`, `api_keys_tools_check`). Tests: `test_an_empty_folder_list_is_refused_never_read_as_all`, `test_an_empty_tool_list_is_refused`, live `test_the_220_checks`. | closed |
| T-304-31 | Info disclosure | secret shown twice / logged | mitigate | The secret is returned only in `ApiKeyCreated` (`api_keys.py:495`). The list/serialize paths carry none (`test_no_mcp_key_response_carries_a_secret_or_digest`). The only `logger.` call in `api_keys.py` is the switch-read warning (`:151`, org id + exception type). The body is not logged. | closed |
| T-304-32 | EoP | non-admin flips the org switch | mitigate | `api_keys.py:674-709`: both GET and PUT `/org/api-keys/mcp-access` depend on `require_org_manage` (`dependencies.py:1082-1099`, `org:manage` in the active org). The column is not client-writable (T-304-07). Test `test_304_mcp_switches_routes.py::test_a_plain_member_gets_the_same_403_as_every_org_admin_route`. | closed |
| T-304-33 | Repudiation | unaudited switch flip | mitigate | Org: `api_keys.py:697-709` writes `settings.update` + `metadata={"event":"mcp_access","enabled":…}` with explicit `org_id`, only after the write returned. Operator: `backend/app/api/admin.py:89` puts `mcp_enabled` in `_FLAG_HUMAN_NAMES`, and PUT `/admin/flags` depends on `operator_audit_floor` (`:637`). Tests: `test_a_flip_writes_the_active_org_and_one_settings_update_audit_row`, `test_a_failed_write_is_an_error_and_writes_no_audit_row`, `test_put_admin_flags_routes_mcp_enabled_and_records_the_operator_row`. | closed |
| T-304-34 | EoP | minting while switched off | mitigate | `api_keys.py:449-454`: the switch read and 403 come before `mint_key` (`:468`). Tests: `test_an_org_switched_off_refuses_the_mint`, `test_a_deployment_switched_off_refuses_the_mint`, `test_the_deployment_sentence_wins_when_both_are_off`. | closed |
| T-304-35 | Info disclosure | key in a URL | mitigate | `mcp_tool_catalogue.py:119-132`: `mcp_url()` is `BACKEND_PUBLIC_URL + "/mcp"`, takes no parameters and never sees a secret. Tests `test_304_tool_catalogue.py::test_the_url_is_the_public_base_plus_the_path`, `test_an_unset_base_has_no_url`. | closed |
| T-304-36 | EoP | tier bypass (D-41) | accept | Code matches the decision: `api_keys.py:428-434` (`enforce_entitlement(..., "workflows")` for workflow keys only); test `test_an_mcp_key_needs_no_tier_capability`. Acceptance is documented in AR-02. Operator confirmation is owed before deploy. | closed (accepted) |
| T-304-37 | Info disclosure | secret shown twice / persisted in DOM | mitigate | `frontend/src/components/settings/apiKeys/ApiKeysTab.tsx:159` (`useState` only), `:172-174` (`setJustCreated(null)` on save). `McpConnectSnippets` takes only `{ mcpUrl }` (`McpConnectSnippets.tsx:95`). Tests: `ApiKeysTab.test.tsx` "after I've saved the secret, the secret is gone from the DOM…", "the secret does not survive an unmount"; `McpConnectSnippets.test.tsx` "takes no secret…", "a secret elsewhere on the page never appears in its output". | closed |
| T-304-38 | Info disclosure | key in URL / shell history | mitigate | `frontend/src/components/settings/apiKeys/mcpSnippets.ts:69-120`: every builder is `(mcpUrl, envVarName)`. `envName` (`:42-45`) refuses a non-env-name. `safeMcpUrl` (`:49-61`) refuses a query or fragment. The CLI form is single-quoted (`:74-83`). Tests `mcpSnippets.test.ts`, `McpConnectSnippets.test.tsx` "an address carrying a query string is treated as no address". | closed |
| T-304-39 | Spoofing / supply chain | `mcp-remote` in the Desktop snippet | mitigate | `mcpSnippets.ts:30-33` pins `MCP_REMOTE_VERSION = "0.15.2"`, and `:95-98` drops the pin when the value is null. Evidence: `304-05-SUMMARY.md:173-180` (`npm view mcp-remote`; maintainer punkpeye; `geelen/mcp-remote` → `punkpeye/mcp-remote`, repo id 951601187, `fork: false`, a transfer). | closed |
| T-304-40 | Info disclosure | personal key pasted into the Claude.ai org connector | mitigate | `McpConnectSnippets.tsx:167-169`: the `role="note"` warning sits outside the url/no-url branch, so it renders on every tab AND in the no-address state. Copy is at `mcpKeyCopy.ts:128`. Tests: "the Claude.ai warning is a note on every tab" and "no public address: the no-address line and the warning…". | closed |
| T-304-41 | EoP | client-side-only refusal of an empty folder set | accept | The real control is server-side and verified under T-304-30 (422 + DB CHECK). Acceptance is documented in AR-03. | closed (accepted) |
| T-304-42 | Tampering | retyped tool names drifting | mitigate | `McpKeyFields.tsx:96-109` renders from `catalogue` (`list.mcp.tools`). A grep of `settings/apiKeys/*.ts(x)`, `org/*.tsx` and `admin/*.tsx` for any quoted catalogue tool name found 0 hits. | closed |
| T-304-43 | Tampering | optimistic switch | mitigate | `frontend/src/components/org/OrgMcpSwitchCard.tsx:63-77`: `setEnabled` runs only from the server response, `busy` disables the switch (`:156`), and on failure `writeFailed` is set while `enabled` is left untouched. Tests `OrgMcpSwitchCard.test.tsx`: "a flip is disabled in flight, then shows the SERVER's answer…", "shows what the server stored, even when it differs from the click", "a failed write stays put, says so, and records nothing". | closed |
| T-304-44 | Info disclosure | guessed switch after a read failure | mitigate | `OrgMcpSwitchCard.tsx:104-106`: the switch renders only when `enabled !== null`. On a read failure the card shows words + Retry (`:111-118`). Test "a failed read shows the words and Retry, and NO switch (never a guessed value)". | closed |
| T-304-45 | Repudiation | flip without a visible record | mitigate | `OrgMcpSwitchCard.tsx:71` calls `onRecorded?.()` after a server success. `OrgAuditTab.tsx:92-94` maps `mcp_access` to plain words. Tests: `OrgAdminShell.test.tsx` "a successful flip pulses the band's marker", "a failed flip does not pulse the band"; `OrgAuditTab.test.tsx` "reads 'Switched AI tool access (MCP) off for the organisation'…". | closed |
| T-304-46 | EoP | non-admin reaching the org switch UI | accept | The server control is verified under T-304-32 (`require_org_manage` on both routes; plain member → 403). Acceptance is documented in AR-04. | closed (accepted) |
| T-304-47 | Info disclosure | fabricated impact count | mitigate | `frontend/src/components/admin/CapabilityGrid.tsx:105-111`: the `mcp_enabled` entry has no `countImpact`, only `fallbackImpact`. Test `CapabilityGrid.mcp.test.tsx` "OFF is armed … count-free impact line, even when counts are passed", "the entry carries no countImpact…". | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Totals:** 47 threats. 42 mitigate, 4 accept, 1 transfer. **47 closed, 0 open.**

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-304-10 | Where documented: `304-01-PLAN.md` threat register, verbatim: "the ::uuid cast raises and the statement fails closed; the contextvar validates before set; live arm pins the raise." Residual risk: a malformed GUC can only make a statement ERROR, never widen. Primary control: UUID validation in `acting_member.py`. | plan 304-01 (auto mode, operator "continue autonomously end to end", CONTEXT header) | 2026-10-30 |
| AR-02 | T-304-36 | Where documented: CONTEXT **D-41**, verbatim: "MCP key creation requires no tier capability … the org and deployment switches are the controls. ⚠ Tier gates are a pricing one-way door (TIER-02): this is recorded as owed in STATE.md and must be confirmed by the operator before 304+305 deploy". Also recorded in `304-VALIDATION.md` §5 item 2 and `STATE.md:77`. **Conditional:** the acceptance holds only until the operator confirms; flipping it is one condition at `api_keys.py:428-434`. | decision D-41 (auto mode). Operator confirmation is **OWED** | 2026-10-30 |
| AR-03 | T-304-41 | Where documented: `304-05-PLAN.md` threat register, verbatim: "the UI blocker is convenience; the server 422 + DB CHECK are the control (304-04, 304-01)". The server control is verified under T-304-30. | plan 304-05 | 2026-10-30 |
| AR-04 | T-304-46 | Where documented: `304-06-PLAN.md` threat register, verbatim: "the UI sits inside the org-admin shell; the server's require_org_manage is the control (304-04)". The server control is verified under T-304-32. | plan 304-06 | 2026-10-30 |

### Transferred

| Ref | Threat | Transferred to | Documentation |
|-----|--------|----------------|---------------|
| TR-01 | T-304-11 | Operator: cloud paste of 220 + 221 with per-action approval, then `get_advisors(security)` | CONTEXT D-30, D-33; `304-01-SUMMARY.md:129`; `304-VALIDATION.md` §5 item 3; migration headers `220:45-46`, `221:47-48` |

### Operator-owed before 304 + 305 deploy (not implementation gaps)

| # | Item | Related threat ids | Source |
|---|------|--------------------|--------|
| O-1 | Paste migrations 220 and 221 into cloud Supabase, with approval for each action. 221 goes before the 304 backend boots, and 220 before the key routes write `kind`. Then read `get_advisors(security)`. Deploys with 305 (D-30). | T-304-11 (and, by parity, T-304-01/02/05/06/07/08 in production) | VALIDATION §5.3 |
| O-2 | Confirm D-41: MCP keys carry no tier gate (TIER-02). | T-304-36 | VALIDATION §5.2, STATE.md:77 |
| O-3 | Reproduce BUG-261031-01 on a DISPOSABLE Postgres. An anon-role call to `current_user_org_ids()` crashed the local backend twice. It is not established whether 221 is involved. If the anon PostgREST RPC path reproduces it, the result is an unauthenticated DB crash (DoS). ⛔ Never drive it against the shared stack or production. | T-304-06 (EXECUTE is pinned false by catalog; the crash path is the permission-denied branch); see also UF-1 | `deferred-items.md` F-1, VALIDATION §5.4, STATE.md:76 |
| O-4 | G-4 rows 1-3 (lived experience). Not a security gate, but G4-1 (secret gone after reload) and G4-3 (switch off → refusal) are the lived proofs of T-304-37 and T-304-13/32. | T-304-37, T-304-13, T-304-32 | VALIDATION §2 |

---

## Unregistered Flags

Every SUMMARY's `## Threat Flags` reports "None outside the register". Two findings recorded elsewhere in the phase have no T-304 id. Both are WARNINGs, not blockers.

| Flag | Source | Mapping | Note |
|------|--------|---------|------|
| UF-1 | `304-01-SUMMARY` F-1 / `deferred-items.md` (BUG-261031-01) | none: closest is T-304-06, but no register entry covers "DB crash via an anon call to a public SECURITY DEFINER function" | A potential DoS on a `public`-schema function. The 304-01 SUMMARY calls it a pre-existing surface. Owed as O-3. Should get a threat id in 305 (which exposes the MCP surface) or in whichever phase reproduces it. |
| UF-2 | `deferred-items.md` F-2 | informational, near T-304-02 | `model_rates_insert_policy`'s role arm (`'admin','owner'`) names roles that `org_members_role_check` never allows, so no authenticated insert can pass. Fail-closed, not a leak. Kept unchanged by 221 (`221:172-185`), as D-39 requires. |

Also noted (informational; it is how the register's mitigations hold today, not a new surface):
- `GET /api-keys/folders` is new surface. 304-04 SUMMARY maps it to T-304-28, and this audit verified that mapping (acting connection, no service role).
- **Contract for 305:** the MCP transport must map `KeyRefused` onto ONE body for every credential reason, with words only for `mcp_off_org` / `mcp_off_deployment` (T-304-14). It must take the acting org only from `McpPrincipal.org_id` (T-304-03). Neither can be verified until 305 exists.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-31 | 47 | 47 | 0 | gsd-security-auditor (Claude, fresh context), HEAD `d822f6607` |

Commands run for this audit (all read-only on implementation files):
- `backend/venv/Scripts/python -m pytest tests/unit -q -k test_304` → **202 passed**, 10819 deselected.
- Under the noclobber local-DB lock (absent at start; created, then removed): `pytest tests/integration/test_304_acting_org_rls_live.py tests/integration/test_304_two_org_parity_live.py tests/integration/test_304_narrowed_key_live.py -q -rs` → **43 passed**, no SKIPPED line, 175 s. No role-anon call to `current_user_org_ids()` was made; the suite pins that arm by catalog only.
- `scripts/check-migration-220-live.py` → `220 live`. `scripts/check-migration-221-live.py` → `221 live`. Both are SELECT-only catalog checks with no anon-role call.
- `npx vitest run --maxWorkers=2` over `src/components/settings/apiKeys`, `org/__tests__/OrgMcpSwitchCard.test.tsx`, `admin/__tests__/CapabilityGrid.mcp.test.tsx` → **17 files, 221 passed**. Then `org/OrgAdminShell.test.tsx`, `org/OrgApiKeysTab.test.tsx`, `org/OrgAuditTab.test.tsx` → **3 files, 52 passed**.
- Production Supabase MCP: **not used**. Cloud is owed (O-1).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in the Accepted Risks Log, quoting where each acceptance is recorded
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-31 (code-level). The deploy gate is still open on O-1 … O-3, which the operator owes; these are not implementation gaps.
