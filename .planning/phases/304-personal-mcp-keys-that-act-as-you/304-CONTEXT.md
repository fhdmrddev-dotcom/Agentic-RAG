# Phase 304: Personal MCP Keys That Act as You - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning
**Mode:** `--auto` (operator: "continue autonomously end to end"). Every gray area below was resolved by taking the recommendation recorded in `.planning/research/SUMMARY.md` or the safest option consistent with it. Each auto choice is logged in `304-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

A member can mint a personal MCP key that acts exactly as them inside one org, narrow it to folders and tools, see its last use and revoke it. An org admin can list and revoke every MCP key in the org and switch MCP off for the org; the operator can switch it off for the whole deployment. All of it is proven at the credential and data layer — **no MCP transport ships in this phase** (that is 305).

Delivers: migrations 220/221, the extracted key resolver core, the one liveness predicate, the acting-member org narrowing, the key-scope composition plus the narrowed data-layer reads the 305 tools will wrap, the key screen inside the existing API keys tab, the admin list, both kill switches, and the two-org parity test.

Requirements: KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, KEY-06. Not here: KEY-07 (per-call audit + per-key limits, 305), any `/mcp` route, any tool wrapper, OAuth.

</domain>

<decisions>
## Implementation Decisions

### Where the key screen lives (KEY-01, KEY-06)
- **D-01:** MCP keys live in the **existing Settings → API keys tab** (Phase 293, `ApiKeysTab.tsx`) as a second kind of key, not a new Settings tab. Making a key starts with one choice: "For an AI tool (MCP)" or "For a workflow integration". MCP keys and workflow keys list in one place with a kind chip. Reuse `ApiKeyCard`, `ApiKeySecretOnce`, `RevokeApiKeySheet`, `ApiKeyActivity`. **`SettingsPage.tsx` gets no new mount** (G-5: it is FIRING; the tab is already mounted at line ~1687).
- **D-02:** The org admin list is the **existing `OrgApiKeysTab`** showing both kinds with the kind chip and the same revoke. **No new `OrgAdminShell` tab.** The org MCP switch lives in the org admin **Settings** tab.
- **D-03:** The operator switch is an `app_settings` column `mcp_enabled boolean NOT NULL DEFAULT true`, shown in the Control Room kill-switch grid beside `workflows_enabled` (same pattern, Phase 147). The org switch defaults **on** (intake: any member can mint; an admin can switch it off), stored in `organizations.settings` (the documented per-org home, `settings` not `add_ons`) unless research finds an existing per-org boolean pattern that is safer to read on every resolution.

### Key data model (migration 220)
- **D-04:** **Extend `api_keys`** (research D10), do not add a sibling table. New columns: `kind text NOT NULL DEFAULT 'workflow' CHECK (kind IN ('workflow','mcp'))`, `folder_ids jsonb NULL` (NULL = not narrowed by folder), `tools jsonb NULL` (MCP only), `include_external boolean NOT NULL DEFAULT false`. Existing rows read `kind='workflow'` and behave byte-identically.
- **D-05:** Mig 215's `workflows >= 1` CHECK is relaxed to apply only when `kind='workflow'`. An MCP key stores `workflows = '[]'`.
- **D-06:** MCP keys use the prefix **`srl_mcp_`**; workflow keys keep `srl_live_`. Cross-use is refused twice: by prefix in `digest_key` and by the `kind` column after lookup. A workflow key never authenticates as MCP; an MCP key never authenticates `/inbound` (SC5).
- **D-07:** **An MCP key must have an expiry.** Presets 30 / 90 (default) / 365 days; no "never" option for MCP keys in v1 (a CHECK: `kind <> 'mcp' OR expires_at IS NOT NULL`). Workflow keys keep today's optional expiry. Reason: a standing personal read credential is the thing that outlives access.
- **D-08:** `folder_ids = []` is **refused at save** (API 422 with a plain sentence, plus a DB CHECK). It never means "no filter". `tools = []` is refused the same way.
- **D-09:** `key_hash` stays outside every client grant (mig 215's column-level grant pattern extends to the new columns: `authenticated` may SELECT `kind`, `folder_ids`, `tools`, `include_external`; never `key_hash`). The secret is shown once and stored only as its SHA-256 digest.
- **D-10:** `'mcp'` is added to the `origin_kind` CHECK on `workflow_runs`, and to the thread/run origin columns Phase 293 introduced, wherever those CHECKs exist (research lists them), so 306 needs no migration for origin.

### Tool catalogue and presets (KEY-03, KEY-04)
- **D-11:** The MCP tool names are a **code constant** (one home, backend, mirrored to the frontend through the API — never retyped): `search_knowledge_base`, `list_documents`, `read_document` (read), `ask_agent`, `get_answer` (ask), `list_workflows`, `run_workflow`, `get_workflow_run` (run). Unknown names are refused at save. The constant is static and code-authored (no user text in tool names or descriptions).
- **D-12:** Presets on the key screen: **Read only** (default, pre-selected), **Read and ask**, **Read, ask and run workflows**, and a custom tool list. Ask and run are unticked by default (KEY-04). `get_answer` travels with `ask_agent`; `list_workflows` / `get_workflow_run` travel with `run_workflow`.

### Acting-member org narrowing (KEY-02; research D4)
- **D-13:** Take the **transaction-local GUC** `app.acting_org_id`. `current_user_org_ids()` intersects membership with it when set: `... WHERE user_id = auth.uid() AND (NULLIF(current_setting('app.acting_org_id', true), '') IS NULL OR org_id = NULLIF(current_setting('app.acting_org_id', true), '')::uuid)`. It can only narrow, never widen. **Unset must be byte-identical to today** (in-app behaviour unchanged — Q18: in-app chat search stays all-orgs).
- **D-14:** The GUC is set with `set_config(..., true)` (is_local) inside `_apply_rls_user_context` **only when an acting-org contextvar is set** — the single sanctioned ~6-line edit to `backend/app/dependencies.py` (G-5). The contextvar is set only by the server-side principal path (`security/acting_member.py`), **never from a client header or request value**.
- **D-15:** Three gates owned by this phase, all recorded as evidence: (1) `EXPLAIN` on representative policies/RPCs (documents, folders, chunk search, views, relationships, workflows) shows the `current_user_org_ids()` initPlan shape survives; (2) the backend baseline gate stays at **71 failed** (zero headroom); (3) the two-org parity test. **Fallback if EXPLAIN fails:** explicit org predicates at each narrowed read plus the same parity test — decided in research, recorded as a `D-NN` in RESEARCH.md.
- **D-16:** **Research must enumerate every RLS policy and SECURITY DEFINER function that reads `org_members` (or org membership) without going through `current_user_org_ids()`** — each one escapes the GUC and is a cross-org leak path. Each is either routed through the function in mig 221 or covered by an explicit predicate. Any SECURITY DEFINER function touched has `EXECUTE` revoked from **`PUBLIC`** (then granted back), not only `anon`.

### One resolver, one liveness predicate (KEY-05, KEY-06)
- **D-17:** **Extract `authenticate_presented_key`** from `backend/app/security/api_key_auth.py` as a pure-move first (behaviour-neutral, proven by the existing `test_293_*` key suites passing unchanged). `resolve_api_key` (the `/inbound` dependency) becomes a thin wrapper calling it with `expected_kind='workflow'`. The MCP path calls the same core with `expected_kind='mcp'`. **A second resolver anywhere is the W-1 drift class and fails review.**
- **D-18:** **One liveness predicate**, `principal_still_allowed`, checked on every resolution with **no cache**: not revoked → not expired → still a member of the key's org → not banned → org MCP switch on → deployment MCP switch on. Exported for 306 (run continuation), 307 (OAuth grants) and 308 (webhook delivery). Ban stays after membership (its fail-open note in `api_key_auth.py` holds).
- **D-19:** Credential failures (unknown, malformed, revoked, expired, left the org, banned, wrong kind) all return **one byte-identical refusal**, with the attributable ones audited through the existing throttled `api_key.refused` path (reason in metadata). A **switched-off** org or deployment returns its own plain sentence ("MCP access is switched off for this organisation by an admin" / "...for this deployment") — it is not a secret and it tells the member what to do. The resolver returns a typed reason; 305 maps it onto the transport.
- **D-20:** The principal is a frozen `McpPrincipal` (key id, user id, org id, folder ids, tools, include_external, credential kind `'key'`) so 307 swaps only the credential resolver behind it.

### Narrowing semantics (KEY-03, KEY-04; research Q2, Q8)
- **D-21:** One **pure `KeyScope` composition** (mirroring `expert_scope.compose_expert_scope`: plain data in, frozen value out, no I/O, never raises), intersection only. Folder subtrees are resolved **per call** from the member's visible folders, so a subfolder created later is included.
- **D-22:** An **un-narrowed** key sees everything the member sees in that org (including global folders) minus connector-fed content unless `include_external`. A **narrowed** key sees only its ticked folders' subtrees; **global folders are excluded unless ticked**.
- **D-23:** Connector-fed content (mailbox virtual root, watched/synced sources) is excluded unless ticked, **whether identified by folder or by document provenance**; the predicate has one home. Research enumerates how connector-fed folders and documents are marked today.
- **D-24:** 304 ships the **narrowed data-layer reads** that 305's tools will wrap: search, list documents, read a document, views, relationships, and the workflows list — each running on the acting-member RLS connection (`get_user_pg_connection`-shaped, never the service role) with the org GUC and the `KeyScope` applied. They **reuse the existing services** (retrieval scope, document search, view resolver, relationship service) with their folder filters; they never re-implement visibility. ⛔ No edit to `threads.py`, `agent_loop.py`, `dispatcher.py`, `lib/api.ts`.

### API (backend)
- **D-25:** Mint/list/revoke for MCP keys extend the **existing Phase 293 key routes** with a `kind` field, rather than a parallel route family. Org-admin list/revoke likewise. New: org switch read/write (org admin only) and the operator switch through the existing app settings path. Every write audited: key create/revoke reuse `api_key.create` / `api_key.revoke` with `metadata.kind`; the org switch writes one new lockstep literal (e.g. `org.mcp_switch`) unless an existing org-settings literal already covers it (research checks `audit_service.py`).
- **D-26:** `last_used_at` is touched on successful resolution (existing `touch_last_used`), shown on the key card. In 304 nothing but the parity/resolution tests resolves an MCP key, so the card shows "Not used yet" until 305 ships.

### Snippets and warnings (KEY-01)
- **D-27:** Copy-ready snippets for **Claude Code, Cursor and VS Code** that read the key from an environment variable (`SYREL_MCP_KEY`), and a **Claude Desktop bridge snippet** (`mcp-remote`) labelled as a developer workaround until sign-in (OAuth) ships. Exact syntax is verified against each client's **own current documentation** in research (provider-docs-first); no snippet puts the key in a URL.
- **D-28:** The MCP URL in snippets comes from **one function** built on `BACKEND_PUBLIC_URL` plus one path constant; 305 confirms the canonical path per topology (Q19) and edits only that constant.
- **D-29:** The screen warns plainly: do not paste a personal key into Claude.ai's organisation-wide connector headers (everyone in that Claude org would act as you). Claude.ai and Claude Desktop arrive with sign-in.
- **D-30:** **304 is not deployed to production on its own.** It deploys with 305, so nobody mints a key with nothing to connect to. If 304 must ship first, the MCP choice on the key screen stays hidden behind the deployment switch.

### Verification
- **D-31:** **Headline must-have: the two-org parity integration test**, run as a **non-owner member** of two orgs through the acting-member RLS connection, against local Supabase. For each read in D-24 it compares the key's result with what the app returns for that member with that org active (the Phase 298 active-org lists, `X-Org-Id`), and asserts nothing from the other org. Negative arms: membership removed → next resolution refused; banned; revoked; expired; org switch off; deployment switch off; workflow key at the MCP resolver; MCP key at `/inbound`. A version that passes only for the org owner fails the phase.
- **D-32:** One driven test per read path for a **narrowed** key (search, document read, list, views, relationships) proving nothing outside its folders is reached, plus global-folder and connector-fed exclusion arms.
- **D-33:** An **anon-role test** proves the new columns and any new function are not readable/executable by `anon` or another user; `key_hash` is never selectable by `authenticated`. `get_advisors(security)` runs after the cloud paste (per-action approval).
- **D-34:** Worktree rule 4: the parity and RLS suites mutate the local DB, so their plans serialize.

### Revisions after research (2026-10-30, auto mode; evidence in `304-RESEARCH.md`)
These supersede the decisions they name. The superseded text above is kept so the change is auditable.
- **D-35 (supersedes D-03's storage clause; R-02):** the org switch is a dedicated column `organizations.mcp_enabled boolean NOT NULL DEFAULT true`, **not** `organizations.settings`. `settings` is UPDATE-granted to `authenticated` (mig 194), so an org admin could flip it through PostgREST with no audit row; a new column is outside that grant automatically. D-03's own "unless safer" clause.
- **D-36 (supersedes D-25's audit-literal clause; R-03):** **no new audit literal.** The org switch writes `settings.update` with `metadata.event = 'mcp_access'` (the `api/org.py` invite/SSO precedent); key lifecycle and refusals reuse `api_key.*` with `metadata.kind` and reasons `wrong_kind`, `mcp_off_org`, `mcp_off_deployment`; the operator switch goes through `PUT /admin/flags` + `_FLAG_HUMAN_NAMES`. `audit_service.py` and the audit CHECK are **not touched**.
- **D-37 (supersedes D-10; R-04):** mig 220 widens only `workflow_runs_origin_kind_check` to add `'mcp'`. `threads` and `runs` have no origin columns today; **306 owns** adding them. No dead schema in 304.
- **D-38 (supersedes D-24's "reuse the existing services"; R-06):** the narrowed reads live in one new module (`backend/app/services/acting_member_reads.py`), each running inside `acting_member_connection(principal)` (the GUC + `get_user_pg_connection`). Reuse only what is GUC-reachable: `retrieval_service.search_documents`, `retrieval_scope.resolve_document_scope` (step 2 decides on the RLS connection), `db/workflows.list_published_workflows` (given the acting connection). Everything else is one SQL statement on the acting connection so RLS stays the only visibility rule. The supabase-py services (documents/folders routes, Find, view resolver, relationship service, `fetch_full_document`) are **not** used on this path; the relationship read imports `_NO_ACCESS_MASK` / `_INVERSE_LABEL`, never copies them. A static test fences the module from naming `org_members` or the service role for visibility.
- **D-39 (refines D-16; R-05/R-05b):** mig 221 routes **`current_user_has_permission`** and **all six** direct-`org_members` policies (`expert_bundles_read/write`, `expert_grants_read/write`, `model_rates_select/insert`) through `current_user_org_ids()` — the `FOR ALL` write policies too, because permissive policies are OR'ed for SELECT. The new `current_user_org_ids()` keeps **exactly** its declared attributes (sql, STABLE, SECURITY DEFINER, `SET search_path`, ROWS 1000); mig 181's REVOKE/GRANT lines are re-issued verbatim. Gate 1 (D-15) is checked as **"plan unchanged + loops=1"**, not by grepping for "InitPlan" (the measured shape is a hashed SubPlan). The EXPLAIN script is committed under `scripts/` so the evidence re-runs.
- **D-40 (refines D-23; R-07):** connector-fed = **`documents.source_connection_id IS NOT NULL`**, one SQL fragment + one Python predicate in the KeyScope module. `connector_watches.library_folder_id` is a UI hint only. Search applies it as a **post-filter** (never as a `document_ids` allow-list, which changes ranking); parity is `key_result == [r for r in app_result if not external(r)]`.
- **D-41 (answers research Open Question 1, pending operator confirmation before deploy):** MCP key creation requires **no tier capability**; the `workflows` capability check moves inside the handler for `kind='workflow'` only. Reason: the intake decision "any member can mint a key"; the org and deployment switches are the controls. ⚠ Tier gates are a pricing one-way door (TIER-02): this is recorded as owed in `STATE.md` and must be confirmed by the operator **before 304+305 deploy**; flipping it is one condition.
- **D-42 (folds BUG-261030-03):** mig 221 also revokes `DELETE, TRUNCATE, TRIGGER, REFERENCES` on `public.organizations` from `PUBLIC`, `anon` and `authenticated` (confirmed present in production by a read-only query 2026-10-30), with a live verify and an anon-role test.
- **D-43 (baseline):** the measured backend baseline today is **70 failed** (gate ceiling 71). The ceiling is unchanged; a phase that adds a failure is still within the gate but must say so, and must not add two.
- **D-44 (ledger):** `frontend/src/components/admin/ControlRoomPage.tsx` and the org Settings leaf (`OrgSettingsTab.tsx`) have **no hot-file ledger row**; the plan that names either adds the row and its `docs/HOT-FILE-LEDGER.md` section in the same commit.
- **D-45 (snippets; research A2):** the Claude Desktop bridge snippet uses `mcp-remote` only after its npm ownership and current version are verified at execution; if unverifiable, the bridge tab says so instead of pinning a package.
- **D-46 (2026-10-31, from 304-REVIEW WR-01; supersedes D-31's Library parity for archived and source-gone documents on the MCP path only):** every acting-member document read applies mig 205's agent rule, **`documents.retrievable`** (`archived_at IS NULL` and source state live), the same rule search's RPCs already apply. `read_document` and the `related_documents` subject add `d.retrievable`; `_page` (`list_documents` and `view_documents`) uses `d.retrievable` in place of `archived_at IS NULL`; the `related_documents` endpoint LATERAL adds `e.retrievable`, so a non-retrievable endpoint renders as the no-access mask. Reason: the MCP reader is an agent, and mig 205 makes `retrievable` the one home of "may an agent read this document". Pinned by `test_archived_and_source_gone_documents_leave_every_acting_read`.
- **D-47 (2026-10-31, from 304-REVIEW WR-04; refines D-22 for saved views):** for a **narrowed** key (`scope.folder_ids is not None`), `list_views` returns only views whose own `folder_scope` lies inside the key's subtrees (`scope.folder_ids` is already the expanded subtree set `list_folders` uses). A view with **no** folder scope is **hidden** from a narrowed key, fail closed: a narrowed key "sees only its ticked folders' subtrees" (D-22), and view names and filters are member-authored free text. All-folders keys are unchanged. Pinned by `test_a_narrowed_key_lists_only_the_views_inside_its_subtree`.

### Claude's Discretion
- Plan split (target 3-5, G-8). Research recommends 4 plans / 3 waves (`304-RESEARCH.md` §"Recommended plan split"). A natural cut: (1) migrations 220/221 + the GUC edit + EXPLAIN/baseline evidence; (2) resolver extraction + `McpPrincipal` + liveness predicate + `KeyScope` + narrowed reads + parity/narrowing tests; (3) API (kind on key routes, switches, audit); (4) key screen, snippets, admin list, switch UIs.
- Exact column names for the switches, file names for new modules (`security/acting_member.py` per research), copy wording within the decisions above.
- Whether views/relationships reads need their own adapter or are covered by the documents read.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (decisions D1-D10, Q1-Q20)
- `.planning/research/SUMMARY.md` — D4 (GUC narrowing, gated), D5 (one resolver), D10 (extend `api_keys`), Q2/Q7/Q8/Q16/Q18 recommendations taken here
- `.planning/research/ARCHITECTURE.md` — `McpPrincipal`, `security/acting_member.py`, the mig 220/221 shape, hot-file discipline
- `.planning/research/PITFALLS.md` — pitfalls 1, 2, 10, 20, 25, 27 (service-role reads, empty folder set, liveness, etc.)
- `.planning/research/FEATURES.md` — key screen table stakes (show-once, presets, snippets, last used, expiry)
- `.planning/research/STACK.md` — client snippet conventions, no new infra
- `.planning/REQUIREMENTS.md` — KEY-01..06 text and the intake decisions
- `.planning/ROADMAP.md` §"Phase 304" — success criteria, "How we'd know this failed", flags

### Phase 293 (the key system this extends)
- `.planning/milestones/v4.7-phases/293-start-from-outside-and-close-out/` — CONTEXT/RESEARCH/PLANs for API keys, D-05 (live re-check order), D-06 (one 401), D-12 (credential-started runs), D-16 (audit literals), D-17 (activity window), D-19 (show once)
- `supabase/migrations/215_api_keys_and_run_origin.sql` — the table, column grants, origin columns, audit CHECK, app_settings knobs this phase extends

### Scope composition precedent
- `backend/app/services/expert_scope.py` — the pure intersection composition `KeyScope` mirrors
- `.planning/milestones/` phase 266/267/279 records — "empty restricted scope = search EVERYTHING" was a shipped defect; D-08 exists because of it

### Project rules
- `CLAUDE.md` §"Supabase MCP" — the `PUBLIC` EXECUTE trap; reads free, writes approval-gated
- `CLAUDE.md` §Rules — backend baseline gate (71 failed, zero headroom), migrations via SQL editor, regenerate `full-schema.sql`
- `docs/HOT-FILE-LEDGER.md` — sections for `backend/app/dependencies.py`, `backend/app/services/audit_service.py`, `backend/app/models/user_settings.py`, `backend/app/api/settings.py`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/components/org/OrgAdminShell.tsx`, `frontend/src/components/settings/apiKeys/apiKeysCopy.ts`, `frontend/src/components/settings/apiKeys/apiKeyFacts.ts`
- `docs/DEPLOYMENT-WORKFLOW.md` — cloud migration parity (220/221 pasted before code deploys)
- `docs/EXTENSION-CONTRACT.md` — MCP tools are services, `_TOOL_REGISTRY` stays at 30

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/security/api_key_auth.py` (328 lines): `mint_key`, `digest_key`, `resolve_api_key` (live re-check order: revoked → expired → member → banned), throttled refusal audit (`refusal_audit_slot`, `_refuse`), `audit_key_call(_now)`. The extraction source for `authenticate_presented_key`.
- `backend/app/db/api_keys.py`: `get_key_for_auth`, `is_org_member`, `touch_last_used`.
- `backend/app/dependencies.py:126` `_apply_rls_user_context` (role swap + both GUC forms, `is_local=true`) and `:159` `get_user_pg_connection` — the acting-member connection; the GUC line goes here.
- `public.current_user_org_ids()` (SECURITY DEFINER, `SELECT org_id FROM org_members WHERE user_id = auth.uid()`; EXECUTE revoked from PUBLIC/anon in mig 181) — the single function mig 221 narrows.
- `backend/app/services/expert_scope.py` — pure subtree + intersection composition to mirror.
- Frontend `frontend/src/components/settings/apiKeys/*` (ApiKeysTab, ApiKeyCard, ApiKeyDraftCard, ApiKeySecretOnce, RevokeApiKeySheet, ApiKeyActivity, apiKeysCopy, apiKeyFacts, curlExamples) and `frontend/src/components/org/OrgApiKeysTab.tsx` — the screens this phase extends.
- `app_settings.workflows_enabled` + the Control Room kill-switch grid — the operator switch pattern.

### Established Patterns
- Column-level grants that never name `key_hash`; REVOKE from PUBLIC first (mig 215).
- One byte-identical 401 for every credential failure; attributable refusals audited at most once per key/reason/minute.
- Audit literals are lockstep: migration CHECK + `audit_service.py` + frontend audit vocab maps.
- Active-org lists (Phase 298) send `X-Org-Id`; that is the "app with that org active" baseline for parity.
- `organizations.settings` jsonb is the documented per-org config home (`add_ons` is entitlements).

### Integration Points
- `dependencies.py` (one ~6-line edit), mig 220/221, `api_key_auth.py` (extract first), the Phase 293 key API routes, `ApiKeysTab` / `OrgApiKeysTab`, org admin Settings tab, Control Room kill-switch grid.
- Consumers next: 305 (tools wrap the D-24 reads; transport maps D-19 reasons), 306 (liveness on run continuation), 307 (OAuth resolver behind `McpPrincipal`), 308 (liveness at webhook send).

</code_context>

<specifics>
## Specific Ideas

- The key screen should read like Phase 293's: show-once secret, plain sentences, the activity view. The new parts are the kind choice, presets, folder/tool narrowing with an "include mail and synced sources" tick, snippets per client, and the Claude.ai warning.
- Guardrails firing at this discuss step (recorded in `STATE.md → Guardrail overrides`): **G-2** (key screen is UI) — the operator chose autonomous end-to-end, so the acceptance bar is the UI-SPEC from `/gsd:ui-phase` plus Claude-driven G-4 rows, not an operator-approved sketch; **G-5** on the hot files listed in the roadmap flags, honoured by construction (one edit each, extract `api_key_auth.py` first).
- G-4 rows to drive at verification (operator-style "I'd recognise failure"): (1) mint an MCP key, see the secret once, reload, it is gone; (2) narrow to one folder, try to save with none ticked — refused in words; (3) an org admin switches MCP off and the member's key card says so.

</specifics>

<deferred>
## Deferred Ideas

- "Test this key" button — needs the transport; 305.
- Per-key rate limits and per-call audit (KEY-07) — 305.
- Active-org scoping of in-app chat search (Q18) — out of scope; already listed in REQUIREMENTS "Future".
- Non-expiring MCP keys — revisit only on operator request after v4.9.
- Org-shared MCP keys — out of scope (REQUIREMENTS).

### Reviewed reported bugs (not folded)
- `BUG-260923-01` (settings surfaces crowd the nav rail) — touches `frontend/settings`; not folded. This phase adds no nav entry or tab (D-01, D-02), so it does not worsen it.

### Seeds
- `SEED-195` — folded (the folder-scope / tool-subset credential it still asked for).
- `SEED-013` — folded in part (keys); the rest lands in 305-309.
- The register sweep matched 0 seeds by path before planning. **Re-run after planning (2026-10-30): 23 seeds matched**, all through broad `trigger_paths` globs (`supabase/migrations/**`, `frontend/src/**`, `backend/app/api/**`, `scripts/vitest-count-gate.cjs`), not through scope overlap. Reviewed, none folded, seed files left unchanged (several are already `shipped` / `answered`; rewriting a settled status because a glob matched would corrupt the index):
  - `SEED-177` (MCP both ways): its remaining arms land in 305; already routed at intake.
  - `SEED-306` (server-owned columns writable by `authenticated`, incl. `tier_capabilities` TRUNCATE): same class as BUG-261030-03 but different tables; 304 fixes only `organizations` (D-42), the table it already alters. Left open.
  - `SEED-266` (full-schema ACLs), `SEED-370` (settings in UI), `SEED-380` (typed-task API key): adjacent, out of scope.
  - The rest (`SEED-027`, `185`, `188`, `198`, `249`, `271`, `280`, `284`, `287`, `289`, `290`, `313`, `326`, `341`, `350`, `359`, `364`, `374`): unrelated to keys or org narrowing; matched only by glob.

### G-8 justification (6 plans, one above the 3-5 target)
- 304-03 / 304-04 is the split research proposed (narrowed reads + parity suite mutate the local DB; API + switches are unit-only).
- The frontend is split (304-05 member screen, 13+ source files; 304-06 admin surfaces) because the shared bookkeeping files (`docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`, `scripts/vitest-count-gate.cjs`) cannot be edited by two plans in one wave — so 304-06 owns them alone in wave 4. Merging 05 and 06 would put 20+ source files in one worktree with the full gates.

</deferred>

---

*Phase: 304-personal-mcp-keys-that-act-as-you*
*Context gathered: 2026-10-30*
