# Phase 304: Personal MCP Keys That Act as You - Research

**Researched:** 2026-10-30
**Domain:** credential layer (API keys) + Postgres RLS org narrowing + settings switches + a Settings key screen. No MCP transport.
**Confidence:** HIGH for the GUC narrowing (measured on local Postgres 17.6), the schema facts and the reuse map. MEDIUM for the client snippets (each client's own docs read today; not driven live, since there is no `/mcp` route until 305).

## Summary

The org-narrowing gate (D-13/D-15) **passes.** I ran `EXPLAIN` and `EXPLAIN ANALYZE` on 12 representative statements as a non-owner member of two orgs, before and after a rolled-back `CREATE OR REPLACE` of `current_user_org_ids()`. Every plan is **byte-identical** between today's function and the new one with the GUC unset. Every row count is identical too. With the GUC set, the plan shape stays the same and only the org set shrinks. The function runs **once per statement** (`loops=1` on all 30 invocations measured). It is never inlined: it is `SECURITY DEFINER` with a `SET search_path`, so the planner cannot see its body, and the plan cannot depend on the body. A GUC naming an org the member does not belong to yields **zero orgs**: the GUC can only narrow. No fallback is needed (recorded as **R-01**).

The biggest planning finding is about **D-24**. Most of the "existing services" that CONTEXT names cannot run on the acting-member connection. `document_search_service`, `document_view_resolver`, `document_relationship_service`, `folder_utils.fetch_visible_folders` and the documents/folders list routes all read through **supabase-py (PostgREST)**, either with the user JWT or with the service role. A transaction-local GUC set on an asyncpg connection never reaches PostgREST. An MCP key also has no user JWT. Only three reuse paths are GUC-narrowable as they stand:
- `retrieval_service.search_documents`, whose RPCs run on `get_user_pg_connection` via `_call_as_user`;
- `retrieval_scope.resolve_document_scope`, whose step 2 is an RLS intersect on that same connection;
- `db/workflows.list_published_workflows`, which takes a `pool` and calls only `.fetch`, so the RLS connection can be passed in its place.

Every other narrowed read must be one SQL statement on the acting-member connection. RLS stays the only visibility rule; the statement adds only the projection, paging and `KeyScope` predicates (**R-06**). This does not re-implement visibility. It is the opposite of the forbidden "service role + Python predicates" pattern.

The baseline gate measured today: **70 failed / 10744 passed / 0 errors**, gate passed. The remaining surprises are smaller and mostly simplify the plan:
1. **Origin.** Only `workflow_runs` has an `origin_kind` CHECK. `threads` and `runs` have no origin columns at all. A thread's origin is derived from its workflow runs (**R-04**).
2. **Audit literals.** No new audit literal is needed (**R-03**). The org switch can reuse `settings.update` with a `metadata.event` discriminator, the pattern already used for org invites and SSO.
3. **Org switch storage.** `organizations.settings` is **client-writable** by any `org:manage` member: mig 194 granted `UPDATE (name, slug, settings, updated_at)` to `authenticated`. Storing the switch in that jsonb would allow an unaudited PostgREST write. A dedicated `organizations.mcp_enabled` column falls outside that grant automatically (**R-02**, the mig 194 precedent).
4. **Leak paths.** The membership readers that bypass `current_user_org_ids()` are `current_user_has_permission` and 6 policies on `expert_bundles`, `expert_grants` and `model_rates` (**R-05**).

**Primary recommendation:** ship mig 221's `current_user_org_ids()` body exactly as below, with the one `dependencies.py` edit. Route `current_user_has_permission` and the 6 direct-`org_members` policies through it. Implement every narrowed read as SQL on `get_user_pg_connection(None, {"id": uid})`, under an `acting_as(principal)` context manager. Keep the resolver core inside `api_key_auth.py` so all 293 monkeypatch targets keep working.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Where the key screen lives (KEY-01, KEY-06)
- **D-01:** MCP keys live in the **existing Settings → API keys tab** (Phase 293, `ApiKeysTab.tsx`) as a second kind of key, not a new Settings tab. Making a key starts with one choice: "For an AI tool (MCP)" or "For a workflow integration". MCP keys and workflow keys list in one place with a kind chip. Reuse `ApiKeyCard`, `ApiKeySecretOnce`, `RevokeApiKeySheet`, `ApiKeyActivity`. **`SettingsPage.tsx` gets no new mount** (G-5: it is FIRING; the tab is already mounted at line ~1687).
- **D-02:** The org admin list is the **existing `OrgApiKeysTab`** showing both kinds with the kind chip and the same revoke. **No new `OrgAdminShell` tab.** The org MCP switch lives in the org admin **Settings** tab.
- **D-03:** The operator switch is an `app_settings` column `mcp_enabled boolean NOT NULL DEFAULT true`, shown in the Control Room kill-switch grid beside `workflows_enabled` (same pattern, Phase 147). The org switch defaults **on** (intake: any member can mint; an admin can switch it off), stored in `organizations.settings` (the documented per-org home, `settings` not `add_ons`) unless research finds an existing per-org boolean pattern that is safer to read on every resolution.

#### Key data model (migration 220)
- **D-04:** **Extend `api_keys`** (research D10), do not add a sibling table. New columns: `kind text NOT NULL DEFAULT 'workflow' CHECK (kind IN ('workflow','mcp'))`, `folder_ids jsonb NULL` (NULL = not narrowed by folder), `tools jsonb NULL` (MCP only), `include_external boolean NOT NULL DEFAULT false`. Existing rows read `kind='workflow'` and behave byte-identically.
- **D-05:** Mig 215's `workflows >= 1` CHECK is relaxed to apply only when `kind='workflow'`. An MCP key stores `workflows = '[]'`.
- **D-06:** MCP keys use the prefix **`srl_mcp_`**; workflow keys keep `srl_live_`. Cross-use is refused twice: by prefix in `digest_key` and by the `kind` column after lookup. A workflow key never authenticates as MCP; an MCP key never authenticates `/inbound` (SC5).
- **D-07:** **An MCP key must have an expiry.** Presets 30 / 90 (default) / 365 days; no "never" option for MCP keys in v1 (a CHECK: `kind <> 'mcp' OR expires_at IS NOT NULL`). Workflow keys keep today's optional expiry. Reason: a standing personal read credential is the thing that outlives access.
- **D-08:** `folder_ids = []` is **refused at save** (API 422 with a plain sentence, plus a DB CHECK). It never means "no filter". `tools = []` is refused the same way.
- **D-09:** `key_hash` stays outside every client grant (mig 215's column-level grant pattern extends to the new columns: `authenticated` may SELECT `kind`, `folder_ids`, `tools`, `include_external`; never `key_hash`). The secret is shown once and stored only as its SHA-256 digest.
- **D-10:** `'mcp'` is added to the `origin_kind` CHECK on `workflow_runs`, and to the thread/run origin columns Phase 293 introduced, wherever those CHECKs exist (research lists them), so 306 needs no migration for origin.

#### Tool catalogue and presets (KEY-03, KEY-04)
- **D-11:** The MCP tool names are a **code constant** (one home, backend, mirrored to the frontend through the API — never retyped): `search_knowledge_base`, `list_documents`, `read_document` (read), `ask_agent`, `get_answer` (ask), `list_workflows`, `run_workflow`, `get_workflow_run` (run). Unknown names are refused at save. The constant is static and code-authored (no user text in tool names or descriptions).
- **D-12:** Presets on the key screen: **Read only** (default, pre-selected), **Read and ask**, **Read, ask and run workflows**, and a custom tool list. Ask and run are unticked by default (KEY-04). `get_answer` travels with `ask_agent`; `list_workflows` / `get_workflow_run` travel with `run_workflow`.

#### Acting-member org narrowing (KEY-02; research D4)
- **D-13:** Take the **transaction-local GUC** `app.acting_org_id`. `current_user_org_ids()` intersects membership with it when set: `... WHERE user_id = auth.uid() AND (NULLIF(current_setting('app.acting_org_id', true), '') IS NULL OR org_id = NULLIF(current_setting('app.acting_org_id', true), '')::uuid)`. It can only narrow, never widen. **Unset must be byte-identical to today** (in-app behaviour unchanged — Q18: in-app chat search stays all-orgs).
- **D-14:** The GUC is set with `set_config(..., true)` (is_local) inside `_apply_rls_user_context` **only when an acting-org contextvar is set** — the single sanctioned ~6-line edit to `backend/app/dependencies.py` (G-5). The contextvar is set only by the server-side principal path (`security/acting_member.py`), **never from a client header or request value**.
- **D-15:** Three gates owned by this phase, all recorded as evidence: (1) `EXPLAIN` on representative policies/RPCs (documents, folders, chunk search, views, relationships, workflows) shows the `current_user_org_ids()` initPlan shape survives; (2) the backend baseline gate stays at **71 failed** (zero headroom); (3) the two-org parity test. **Fallback if EXPLAIN fails:** explicit org predicates at each narrowed read plus the same parity test — decided in research, recorded as a `D-NN` in RESEARCH.md.
- **D-16:** **Research must enumerate every RLS policy and SECURITY DEFINER function that reads `org_members` (or org membership) without going through `current_user_org_ids()`** — each one escapes the GUC and is a cross-org leak path. Each is either routed through the function in mig 221 or covered by an explicit predicate. Any SECURITY DEFINER function touched has `EXECUTE` revoked from **`PUBLIC`** (then granted back), not only `anon`.

#### One resolver, one liveness predicate (KEY-05, KEY-06)
- **D-17:** **Extract `authenticate_presented_key`** from `backend/app/security/api_key_auth.py` as a pure-move first (behaviour-neutral, proven by the existing `test_293_*` key suites passing unchanged). `resolve_api_key` (the `/inbound` dependency) becomes a thin wrapper calling it with `expected_kind='workflow'`. The MCP path calls the same core with `expected_kind='mcp'`. **A second resolver anywhere is the W-1 drift class and fails review.**
- **D-18:** **One liveness predicate**, `principal_still_allowed`, checked on every resolution with **no cache**: not revoked → not expired → still a member of the key's org → not banned → org MCP switch on → deployment MCP switch on. Exported for 306 (run continuation), 307 (OAuth grants) and 308 (webhook delivery). Ban stays after membership (its fail-open note in `api_key_auth.py` holds).
- **D-19:** Credential failures (unknown, malformed, revoked, expired, left the org, banned, wrong kind) all return **one byte-identical refusal**, with the attributable ones audited through the existing throttled `api_key.refused` path (reason in metadata). A **switched-off** org or deployment returns its own plain sentence ("MCP access is switched off for this organisation by an admin" / "...for this deployment") — it is not a secret and it tells the member what to do. The resolver returns a typed reason; 305 maps it onto the transport.
- **D-20:** The principal is a frozen `McpPrincipal` (key id, user id, org id, folder ids, tools, include_external, credential kind `'key'`) so 307 swaps only the credential resolver behind it.

#### Narrowing semantics (KEY-03, KEY-04; research Q2, Q8)
- **D-21:** One **pure `KeyScope` composition** (mirroring `expert_scope.compose_expert_scope`: plain data in, frozen value out, no I/O, never raises), intersection only. Folder subtrees are resolved **per call** from the member's visible folders, so a subfolder created later is included.
- **D-22:** An **un-narrowed** key sees everything the member sees in that org (including global folders) minus connector-fed content unless `include_external`. A **narrowed** key sees only its ticked folders' subtrees; **global folders are excluded unless ticked**.
- **D-23:** Connector-fed content (mailbox virtual root, watched/synced sources) is excluded unless ticked, **whether identified by folder or by document provenance**; the predicate has one home. Research enumerates how connector-fed folders and documents are marked today.
- **D-24:** 304 ships the **narrowed data-layer reads** that 305's tools will wrap: search, list documents, read a document, views, relationships, and the workflows list — each running on the acting-member RLS connection (`get_user_pg_connection`-shaped, never the service role) with the org GUC and the `KeyScope` applied. They **reuse the existing services** (retrieval scope, document search, view resolver, relationship service) with their folder filters; they never re-implement visibility. ⛔ No edit to `threads.py`, `agent_loop.py`, `dispatcher.py`, `lib/api.ts`.

#### API (backend)
- **D-25:** Mint/list/revoke for MCP keys extend the **existing Phase 293 key routes** with a `kind` field, rather than a parallel route family. Org-admin list/revoke likewise. New: org switch read/write (org admin only) and the operator switch through the existing app settings path. Every write audited: key create/revoke reuse `api_key.create` / `api_key.revoke` with `metadata.kind`; the org switch writes one new lockstep literal (e.g. `org.mcp_switch`) unless an existing org-settings literal already covers it (research checks `audit_service.py`).
- **D-26:** `last_used_at` is touched on successful resolution (existing `touch_last_used`), shown on the key card. In 304 nothing but the parity/resolution tests resolves an MCP key, so the card shows "Not used yet" until 305 ships.

#### Snippets and warnings (KEY-01)
- **D-27:** Copy-ready snippets for **Claude Code, Cursor and VS Code** that read the key from an environment variable (`SYREL_MCP_KEY`), and a **Claude Desktop bridge snippet** (`mcp-remote`) labelled as a developer workaround until sign-in (OAuth) ships. Exact syntax is verified against each client's **own current documentation** in research (provider-docs-first); no snippet puts the key in a URL.
- **D-28:** The MCP URL in snippets comes from **one function** built on `BACKEND_PUBLIC_URL` plus one path constant; 305 confirms the canonical path per topology (Q19) and edits only that constant.
- **D-29:** The screen warns plainly: do not paste a personal key into Claude.ai's organisation-wide connector headers (everyone in that Claude org would act as you). Claude.ai and Claude Desktop arrive with sign-in.
- **D-30:** **304 is not deployed to production on its own.** It deploys with 305, so nobody mints a key with nothing to connect to. If 304 must ship first, the MCP choice on the key screen stays hidden behind the deployment switch.

#### Verification
- **D-31:** **Headline must-have: the two-org parity integration test**, run as a **non-owner member** of two orgs through the acting-member RLS connection, against local Supabase. For each read in D-24 it compares the key's result with what the app returns for that member with that org active (the Phase 298 active-org lists, `X-Org-Id`), and asserts nothing from the other org. Negative arms: membership removed → next resolution refused; banned; revoked; expired; org switch off; deployment switch off; workflow key at the MCP resolver; MCP key at `/inbound`. A version that passes only for the org owner fails the phase.
- **D-32:** One driven test per read path for a **narrowed** key (search, document read, list, views, relationships) proving nothing outside its folders is reached, plus global-folder and connector-fed exclusion arms.
- **D-33:** An **anon-role test** proves the new columns and any new function are not readable/executable by `anon` or another user; `key_hash` is never selectable by `authenticated`. `get_advisors(security)` runs after the cloud paste (per-action approval).
- **D-34:** Worktree rule 4: the parity and RLS suites mutate the local DB, so their plans serialize.

### Claude's Discretion
- Plan split (target 3-5, G-8). A natural cut: (1) migrations 220/221 + the GUC edit + EXPLAIN/baseline evidence; (2) resolver extraction + `McpPrincipal` + liveness predicate + `KeyScope` + narrowed reads + parity/narrowing tests; (3) API (kind on key routes, switches, audit); (4) key screen, snippets, admin list, switch UIs.
- Exact column names for the switches, file names for new modules (`security/acting_member.py` per research), copy wording within the decisions above.
- Whether views/relationships reads need their own adapter or are covered by the documents read.

### Deferred Ideas (OUT OF SCOPE)
- "Test this key" button — needs the transport; 305.
- Per-key rate limits and per-call audit (KEY-07) — 305.
- Active-org scoping of in-app chat search (Q18) — out of scope; already listed in REQUIREMENTS "Future".
- Non-expiring MCP keys — revisit only on operator request after v4.9.
- Org-shared MCP keys — out of scope (REQUIREMENTS).

#### Reviewed reported bugs (not folded)
- `BUG-260923-01` (settings surfaces crowd the nav rail) — touches `frontend/settings`; not folded. This phase adds no nav entry or tab (D-01, D-02), so it does not worsen it.

#### Seeds
- `SEED-195` — folded (the folder-scope / tool-subset credential it still asked for).
- `SEED-013` — folded in part (keys); the rest lands in 305-309.
- The register sweep matched 0 seeds by path (the phase has no plans yet, so no `files_modified`); re-run `node scripts/check-seeds-register.cjs --phase 304` after planning.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KEY-01 | Create an MCP key in Settings, secret once, env-var snippets for Claude Code / Cursor / VS Code, Claude.ai warning, Desktop bridge | §Client snippets (each client's docs read today); §Frontend reuse map; `mcp_url` served from the API (D-28) |
| KEY-02 | Key acts as the member in one org; parity test | R-01 EXPLAIN evidence; R-06 read homes; §Parity test design; R-08 parity references |
| KEY-03 | Narrow to folders (subtree) + tool subset; empty set refused; holds on every tool | §KeyScope; R-07 connector predicate; mig 220 CHECKs; `_vector_search`/`_keyword_search` already refuse `[]` (WR-07) |
| KEY-04 | Read-only default + expiry; ask/run opt-in; connector-fed unticked | D-12 presets; mig 220 `kind <> 'mcp' OR expires_at IS NOT NULL`; `include_external DEFAULT false` |
| KEY-05 | Last use + revoke; revoked/expired/left/banned refused next call | §Resolver extraction; `principal_still_allowed` order; existing `touch_last_used` |
| KEY-06 | Org admin list/revoke + org switch; operator switch; next call | R-02 org column; operator flag wiring map; liveness reads both switches live (R-09) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Backend in `venv`. **Backend unit baseline: ≤ 71 failed, 0 collection errors, zero headroom.** Command: `node scripts/check-backend-unit-baseline.cjs` (or `pytest tests/unit -q --continue-on-collection-errors` in `backend/`).
- No LangChain/LangGraph; Pydantic models; **RLS on every table** (users see only their own; global folders/skills are the only shared scope).
- Never block the event loop: no supabase-py inside async handlers without `run_in_threadpool` (D-v2.5-01). The new code should be asyncpg-only.
- **Migrations:** `supabase/migrations/<digits>_name.sql` (next free: **220**, **221**). Apply to the LOCAL DB through the SQL editor or psql, never `supabase db push`/`db reset`. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`.
- ⛔ **`pg_dump --no-privileges`:** every GRANT/REVOKE a migration makes must be **mirrored in `scripts/full-schema-supplement.sql`** in the same commit. `node scripts/check-schema-acl-parity.cjs` and `backend/venv/Scripts/python scripts/check-greenfield-privileges.py` enforce it. `full-schema-supplement.sql` is G-5-FIRING (`27 / 19 / 891`), so the edit is a copy of the migration's lines only.
- **The PUBLIC EXECUTE trap:** revoke from `PUBLIC` first, then grant back. `CREATE OR REPLACE FUNCTION` **keeps** the existing ACL (measured: `current_user_org_ids` grants survived the rolled-back replace). Still re-issue mig 181's four lines for every function touched (D-16), copied verbatim.
- **Supabase MCP is PRODUCTION:** reads only, every write needs per-action operator approval. Cloud paste of 220/221 happens at deploy with 305 (D-30). `get_advisors(security)` follows it.
- Settings live in `app_settings` / `organizations` + the UI; env vars are for secrets and infra only (`BACKEND_PUBLIC_URL` is infra, so it is correct for the MCP URL).
- Multi-worker (`WORKER_COUNT=2`). No process-local state may decide access (the liveness predicate reads the DB every call).
- **G-5** hot files: see the §Hot-file map. The ledger gate (`node scripts/check-hot-file-ledger.cjs <phase-dir>`) FAILS a plan naming a source file with no row. **`frontend/src/components/admin/ControlRoomPage.tsx` and `frontend/src/components/org/OrgSettingsTab.tsx` have NO ledger row.** Add rows in the plan that first names them.
- **G-8:** 3-5 plans. **Worktree rule 4:** DB-mutating suites serialize. **Worktree rule 1:** `bash scripts/bootstrap-worktree.sh "$(pwd)"` first.
- **Cross-provider UAT:** not required. 304 touches no agent loop, provider routing or streaming.
- **Provider-docs-first:** applied to the four MCP clients (see §Client snippets).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Org narrowing (`app.acting_org_id`) | Database (`current_user_org_ids()`) | API (contextvar → `set_config` in `_apply_rls_user_context`) | One function every policy already calls; the API only states the org, never decides visibility |
| Key mint / hash / prefix / kind check | API (`security/api_key_auth.py`) | Database (CHECKs, column grants) | Secret never reaches the DB; CHECKs are the backstop |
| Liveness (revoked→expired→member→banned→org→deployment) | API (`principal_still_allowed`) | Database (one live read, no cache) | Must run per call on every worker |
| KeyScope (folders, tools, external) | API (pure composition) | Database (RLS decides base visibility) | Intersection only; RLS stays the visibility rule |
| Narrowed reads | Database (RLS + GUC on asyncpg) | API (projection, paging, KeyScope predicates) | Never service-role visibility |
| Org switch | Database (`organizations.mcp_enabled`) | API (org-admin route, audited) | Not client-writable (R-02) |
| Operator switch | Database (`app_settings.mcp_enabled`) | API (`PUT /admin/flags`) + Browser (CapabilityGrid) | Existing Phase 147 path |
| Key screen, snippets, warnings | Browser | API (serves `mcp_url` + tool catalogue) | Constants have one backend home (D-11, D-28) |

## R-01 — The EXPLAIN gate (D-15 gate 1): PASSED, no fallback

**Method** (script kept at the scratchpad, reproducible; recommend committing it as `scripts/explain-acting-org.py` in plan 01 so the phase evidence is re-runnable):
- Subject: user `e6dc45ca…`, **member** (role `member`, not owner) of `22f9c615…` and org-admin of `c1f18150…`.
- `SET LOCAL ROLE authenticated` + both claim GUCs, exactly as `_apply_rls_user_context`.
- RPC bodies were EXPLAINed as their owner (`postgres`) with the claims set, which is the context a DEFINER body runs in. `postgres` is not superuser here, so auto_explain was not available.
- Five variants: **A** today; **B** new function, GUC unset; **C** GUC = member org; **D** GUC = the other org; **E** GUC = an org the user is not in. Every variant ran inside a transaction that was **rolled back**. After the run, `pg_get_functiondef` was confirmed unchanged.

**Results** [VERIFIED: local Postgres 17.6, 2026-10-30]:

| Statement | A == B plan (unset identical) | A ~ C shape | `current_user_org_ids()` executions |
|---|---|---|---|
| `keyword_search_chunks` body (DEFINER) | identical | identical (Hash Join on `current_user_org_ids()` via HashAggregate) | loops=1 |
| `match_document_chunks` INDEX branch body | identical | identical | loops=1 |
| `documents` (policy + RESTRICTIVE agent-read) | identical | identical (`hashed SubPlan`) | loops=1 |
| `library_documents` (security_invoker view, list-route shape) | identical | identical (4 hashed SubPlans + InitPlans) | loops=1 each |
| `folders` | identical | identical | loops=1 |
| `document_chunks` | identical | identical | loops=1 |
| `document_views` | identical | identical | loops=1 |
| `document_relationships` | identical | identical | loops=1 |
| `workflow_definitions` (published) | identical | identical | loops=1 |
| `workflow_runs` (+ `threads` subplan) | identical | identical (only the runtime sort method differs: top-N vs quicksort on fewer rows) | loops=1 |
| `api_keys` | identical | identical | loops=1 |
| `keyword_search_chunks(...)` outer RPC call | identical | identical | — |

Row counts, A vs B: `documents 21, folders 13, document_chunks 2225, workflow_definitions 113, workflow_runs 47, library_documents 21`, identical. Under C: folders 13→11, workflow_definitions 113→109 (the 107 system globals stay visible), workflow_runs 47→16. Under E (a non-member org): **every org-scoped table returns 0, and only `is_system_global` rows remain.** The org set seen by the function: A/B = both orgs, C = `[22f9c615]`, D = `[c1f18150]`, E = `[]`.

**Plan shape note.** The research files call it the "initPlan shape". Measured, it is a **`hashed SubPlan`** (`ANY (org_id = (hashed SubPlan N).col1)` over `ProjectSet → Result`) in the policies, and a `HashAggregate` hash join inside the DEFINER bodies. Both evaluate the function exactly once per statement. That is the property that matters. Verification text should say "hashed SubPlan / once per statement", not "InitPlan", or a checker will grep for the wrong word.

**Why this is structural, not luck.** `current_user_org_ids()` is `LANGUAGE sql STABLE SECURITY DEFINER SET search_path`, `ROWS 1000`, `COST 100`. PostgreSQL never inlines a SECURITY DEFINER function, or one with a `SET` clause. So the planner sees only the declared ROWS/COST/volatility, and those do not change. ⛔ **The evidence is void if mig 221 changes any of those attributes:** volatility, SECURITY DEFINER, the `SET search_path`, ROWS, COST or language. The migration must re-declare them exactly.

**Mig 221 body (recommended, exactly as measured):**
```sql
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT org_id FROM public.org_members
   WHERE user_id = auth.uid()
     AND (NULLIF(current_setting('app.acting_org_id', true), '') IS NULL
          OR org_id = NULLIF(current_setting('app.acting_org_id', true), '')::uuid);
$function$;
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_org_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO service_role;
```
The last four lines already exist verbatim in `full-schema-supplement.sql:691-694` (mig 181), so the parity gate sees identical tuples.

A malformed GUC value makes the `::uuid` cast raise. The statement then errors, which fails closed. The contextvar must hold `str(UUID(...))`, validated when it is set.

## D-15 gate 2 — backend baseline (measured today, pre-change)

`node scripts/check-backend-unit-baseline.cjs` on `develop` @ `4e0a39cfe`, run under the shared local-DB lock: **`70 failed, 10744 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 errors` in 561 s, GATE PASSED (≤ 71).**
- The suite does not mutate the local DB in a way that blocks a parallel read: the lock was still taken (memory rule).
- ⚠ The ceiling is 71, so **one** new failure of headroom exists today. It is **not** the "zero headroom at 71" number written in CLAUDE.md. Re-derive at the plan's base, and never quote 70.
- Plan 01 re-runs it **after** applying 220/221 and the `dependencies.py` edit. Any rise is the phase's.

## R-05 — D-16 enumeration: membership readers that bypass `current_user_org_ids()`

Measured on the local DB: `pg_policies` has 183 policies in `public`. **145** go through `current_user_org_ids()`. **6** read `org_members` directly. **32** use neither: they are `user_id = auth.uid()`, `true`, or `current_user_has_permission(...)`. `pg_proc` was filtered on DEFINER functions with `org_members`, `current_user_org_ids` or `auth.uid` in the body.

| # | Object | Kind | How it reads membership | Leak path under narrowing? | Recommendation |
|---|---|---|---|---|---|
| 1 | `current_user_has_permission(p_org_id, perm)` | DEFINER fn, used by ~15 policies (org_members DELETE, connector_connections DELETE, legal_hold*, retention_* SELECT, sso_configs DELETE, organizations UPDATE …) | `org_members m WHERE m.org_id = p_org_id AND m.user_id = auth.uid()` | **Yes.** An org-admin of B acting in A could still read B's retention/legal-hold rows on the acting connection. No D-24 read touches these tables today, but 305/306 tools might | **Route through.** Add `AND m.org_id IN (SELECT public.current_user_org_ids())` in mig 221 (one home of the GUC read). Re-issue its mig 181 REVOKE/GRANT lines verbatim. EXPLAIN result: see R-05b |
| 2-3 | `expert_bundles_read_policy` / `expert_bundles_write_policy` (**FOR ALL**: also applies to SELECT) | policy | `org_id IN (SELECT m.org_id FROM org_members m WHERE m.user_id = auth.uid())` | **Yes**, if 306's `ask_agent` reads Experts on the acting connection | **Route both through:** replace the subquery with `(SELECT public.current_user_org_ids())`. Identical set when unset (R-05b) |
| 4-5 | `expert_grants_read_policy` / `expert_grants_write_policy` | policy | `JOIN org_members m ON m.org_id = eb.org_id WHERE m.user_id = auth.uid()` | Yes (same) | Route through: `expert_id IN (SELECT eb.id FROM expert_bundles eb WHERE eb.org_id IN (SELECT public.current_user_org_ids()))` |
| 6-7 | `model_rates_select_policy` / `model_rates_insert_policy` | policy | direct `org_members` subquery (insert also checks role admin/owner) | Low (rates, not content) | Route through for consistency. The insert arm keeps its role predicate: `org_id IN (SELECT m.org_id FROM org_members m WHERE m.user_id = auth.uid() AND m.role IN ('admin','owner') AND m.org_id IN (SELECT public.current_user_org_ids()))` |
| 8 | `org_members_self_select` (`user_id = auth.uid()`) | policy | the membership rows themselves | **No content leak.** The member's own membership rows in both orgs stay readable. No D-24 read selects `org_members` on the acting connection | Leave. Fence it instead: the reads module never names `org_members` (static test) |
| 9 | `autofill_org_id_by_owner` | DEFINER trigger | `LIMIT 1` org pick on INSERT | Write path only; 304 has no MCP writes | Leave; note for 306 (bind `org_id` explicitly, the 293 precedent) |
| 10 | `handle_new_user`, `capture_skill_version` | DEFINER triggers | signup / skill versioning | No | Leave |
| 11 | `match_document_chunks`, `keyword_search_chunks`, `match_skills` | DEFINER RPCs | through `current_user_org_ids()` | **Narrowed** (measured, R-01) | Nothing |
| 12 | `folder_is_org_shared`, `connection_doc_is_visible`, `document_is_retrievable` | DEFINER helpers | no membership read; always ANDed with `org_id IN current_user_org_ids()` in the policies | No | Nothing |
| 13 | storage.objects policies | policy | through `current_user_org_ids()` | Narrowed | Nothing (MCP reads `full_markdown`, not Storage) |

### R-05b — route-through measured (rolled back, 2026-10-30)

`explain304b.py` installed, in one rolled-back transaction, the new `current_user_org_ids()`, the routed `current_user_has_permission`, and routed `expert_bundles_read_policy` / `model_rates_select_policy`:

| Table | Rows today / new-unset / new-acting | Plan |
|---|---|---|
| `model_rates` | 59 / 59 / 59 | **simpler**: the nested `Seq Scan on org_members` subplan becomes one hashed `ProjectSet` SubPlan, the same shape as the 145 policies already on the function |
| `expert_bundles` | 11 / 11 / 11 | the routed READ arm becomes the hashed SubPlan; ⚠ **the `org_members` subplan is still there**, because `expert_bundles_write_policy` is **`FOR ALL`** and permissive policies are **OR'ed for SELECT** |
| `retention_policies` (via `current_user_has_permission`) | 0 / 0 / 0 | identical (scalar DEFINER call, not inlinable) |
| `organizations` | 2 / 2 / **1** | identical; narrows |

**Two findings that change the migration:**
1. **Every `FOR ALL` policy must be routed too.** Routing only `expert_bundles_read_policy` leaves `expert_bundles_write_policy` (ALL) re-admitting the same rows on SELECT, and the same holds for `expert_grants_write_policy`. So all **6** policies are rewritten, not 3.
2. **Why the direct subquery cannot be narrowed in place.** `SELECT m.org_id FROM org_members m WHERE m.user_id = auth.uid()` runs under `org_members`' own RLS. `org_members_self_select` (`user_id = auth.uid()`) admits the member's rows in **both** orgs, whatever the GUC says (visible in the plan as `user_id = … OR org_id = ANY(hashed SubPlan)`). The only way to narrow is to stop reading `org_members` directly, which is what the route-through does.

The local fixture has too few expert/rate rows to show narrowing on those two tables (11 and 59 are system/NULL-org rows). Plan 01's RLS suite must seed an org-scoped expert bundle in each org and assert that acting-in-A hides B's.

**Python-side membership readers.** None of these sees the GUC, because they read through supabase-py:
- `folder_utils._resolve_caller_org_ids` returns the member's full org set. It is used by `fetch_visible_folders` and `get_globally_visible_folder_ids`, and by `retrieval_scope.resolve_document_scope` step 1.
- In `resolve_document_scope`, step 1 only **proposes**. Step 2 (`_rls_intersect`, on `get_user_pg_connection`) decides, and **is** narrowed. That reuse is safe.
- `fetch_visible_folders` must not be used on the MCP path, or it must be given `restrict_org_ids={principal.org_id}` (the 298 seam). Recommend not using it at all (R-06).

**Plus one GUC the members can't set through the API.** `query_user_documents` (INVOKER, the agent's SQL tool) refuses any text containing `set_config|current_setting` (mig 205 W-1). An authenticated SQL caller resetting `app.acting_org_id` would only restore that member's own full rights, so it is not an escalation in any case.

## R-06 — Where each D-24 read lives (reuse map)

⚠ **The contradiction to resolve in planning:** D-24 says the reads "reuse the existing services (retrieval scope, document search, view resolver, relationship service)" on the acting-member connection. Measured:

| Existing home | Data path | GUC-narrowable? |
|---|---|---|
| `retrieval_service.search_documents` → `retrieval_rpc._call_as_user` | asyncpg `get_user_pg_connection(None, {"id": uid})` | **Yes**, used as is |
| `retrieval_scope.resolve_document_scope` | step 1 supabase (proposal) → step 2 `_rls_intersect` on `get_user_pg_connection` | **Yes** (step 2 decides) |
| `db/workflows.list_published_workflows(pool, …)` | asyncpg, one `pool.fetch` (line 811) | **Yes**, if the acting connection is passed as `pool` |
| `api/documents.list_documents` / `api/folders.list_folders` | supabase-py with the **user JWT** (`get_user_supabase_client`) | No: needs a JWT; the GUC never reaches PostgREST |
| `document_search_service.search_documents` (Find) | supabase-py builder | No |
| `document_view_resolver.resolve_filter` | supabase-py builder (`via_view=True` user JWT / `False` service role) | No |
| `document_relationship_service.get_related_documents` | supabase-py, **service role** + Python readability checks | No, and it is the forbidden pattern for MCP |
| `retrieval_documents.fetch_full_document` | supabase-py, owner-scoped `.eq("user_id")` | No, and it hides org-shared docs (ARCHITECTURE §4) |

**Recommendation.** Put the narrowed reads in one new module, e.g. `backend/app/services/acting_member_reads.py`. Every read runs inside `acting_member_connection(principal)`, which is `acting_as(principal)` + `get_user_pg_connection(None, {"id": principal.user_id})`:

| Read | Implementation | What is reused |
|---|---|---|
| folders (for subtree resolution and listing) | `SELECT id, name, parent_id, is_org_shared, org_id, user_id FROM public.folders` | RLS policy = the visibility rule; `_null_foreign_global_owner` for owner masking |
| search | `retrieval_service.search_documents(query, uid, get_service_role_supabase(org), user_settings=…, folder_ids=scope.folder_ids)` **inside `acting_as`** | the whole retrieval stack. The service-role client is used only by `_enrich_with_filenames` for ids already returned |
| list documents | `SELECT <LIST_SELECT cols> FROM public.library_documents WHERE is_latest AND archived_at IS NULL [AND folder_id = ANY($subtree)] [AND source_connection_id IS NULL] ORDER BY created_at DESC, id DESC LIMIT $n OFFSET $o` + exact `count(*)` | the 207 view (security_invoker); the route's ordering and page contract |
| read document | `SELECT … full_markdown … FROM public.documents WHERE id = $1 AND is_latest` + KeyScope check (folder in subtree / external) | RLS; one "Not found." for unreadable, foreign and out-of-scope alike |
| views | list: `SELECT … FROM public.document_views` (RLS: own + `is_system_global`). Resolve: `retrieval_scope.resolve_document_scope(user_id, conditions=view.filter_expr.conditions, folder_ids=<view scope ∩ key subtree, or None>, supabase=get_service_role_supabase(org))` inside `acting_as`, then list those ids through the list-documents read | the 271 compiler + Find dates + RLS-decided step 2 (`ViewFilter` is flat AND only, `op: Literal["and"]`, so the condition list maps 1:1) |
| relationships | `SELECT … FROM public.document_relationships WHERE source_doc_id = ANY($versions) OR target_doc_id = ANY($versions)` (RLS: own edges in org), then the endpoint readability check as one `SELECT id, filename FROM documents WHERE id = ANY(...)` on the same connection, plus the KeyScope check | **import** `_NO_ACCESS_MASK`, `_INVERSE_LABEL` from `document_relationship_service` (never copy) |
| workflows list | `db.workflows.list_published_workflows(conn, user_id=uid, org_id=UUID(principal.org_id))` | the app's own feed, now with RLS + GUC too |

That leaves CONTEXT's discretion item (do views and relationships need their own adapter?). Views: no new resolver, since `resolve_document_scope` + the list read covers them. Relationships: a small read on the acting connection that imports the service's mask and labels.

## R-07 — Connector-fed content: one predicate home (D-23)

Measured:
- **Documents carry provenance:** `documents.source_connection_id uuid` (FK → `connector_connections`, ON DELETE SET NULL). It is stamped by every connector path: `watch_service.py:483/575` (watched sync), `sources/import_service.py:246` (one-off "Import from cloud"), `sources/preview_service.py:646`, `ingest_splice.py:588`, and `email_attachments.py:315/366`. Attachments **inherit** the parent mail document's `source_connection_id`. Local: 180 of 331 documents carry it.
- **Folders carry no marker.** The "mailbox virtual root" is a *source-side* picker id (`sources/mail/mailbox.MAIL_ROOT_ID = "mailbox_root"`), not a Library folder. A watched source lands in an ordinary Library folder, named by `connector_watches.library_folder_id`, and that folder may also hold manual uploads.
- `documents.ingest_visibility` ('private' | 'org' | 'dept') plus `connection_doc_is_visible()` make org-visible connector docs readable by co-members. Those docs are connector-fed by definition.

**Recommendation.** The one home is the document predicate **`source_connection_id IS NOT NULL` = connector-fed**. It lives in the KeyScope module as one SQL fragment constant and one Python predicate over the same column name. `connector_watches.library_folder_id` is a **UI hint only**: on the key screen, ticking a watch-target folder shows the "include mail and synced sources" tick beside it. It is never a second server-side rule.

- list / read / views / relationships apply it as a SQL predicate.
- **Search applies it as a post-filter** on the returned rows' document ids: one `SELECT id FROM documents WHERE id = ANY($ids) AND source_connection_id IS NOT NULL` on the acting connection, with those rows dropped. Passing an allow-list as `document_ids` would switch retrieval into **filtered mode** (`FILTERED_MATCH_FLOOR`, `_cover_matched_documents`) and change ranking against the app. The cost is under-return: fewer than `top_k` results when external rows ranked high. That is safe and parity-testable: `key_result == [r for r in app_result if not external(r)]`. Over-fetching (`top_k * 2`) is an optional refinement for 305.

## R-02 — Org switch storage: a dedicated column, not `organizations.settings`

- `organizations.settings` is **UPDATE-granted to `authenticated`** (mig 194: `GRANT UPDATE (name, slug, settings, updated_at)`), and `organizations_update` allows any `org:manage` member. Storing the switch there lets an org admin flip MCP through PostgREST **with no audit row**, bypassing D-25. Nothing reads or writes `organizations.settings` in app code today (grep: no hits). `OrgSettingsTab.tsx` is a 63-line presentational leaf.
- **Mig 194 is the precedent:** per-org columns the client must not write live outside the column grant. A new `organizations.mcp_enabled boolean NOT NULL DEFAULT true` is **automatically excluded** from that grant. Writes go only through the backend pool (audited). It is typed, NOT NULL, and cheap to read in the liveness statement.
- This uses D-03's own escape clause ("unless research finds … safer"). The plan should state it as a decision with this evidence.
- Members can still **read** it (table-level SELECT + `organizations_select` policy), which is fine: D-19 says the switch is not a secret.

## R-03 — Audit: no new literal needed

| Write | Action type | Evidence |
|---|---|---|
| MCP key create / revoke | `api_key.create` / `api_key.revoke` + `metadata.kind = 'mcp'` | existing literals (mig 215) |
| MCP key refusal | `api_key.refused` + reason (`revoked`, `expired`, `not_member`, `banned`, `wrong_kind`, `mcp_off_org`, `mcp_off_deployment`) | existing throttled `_refuse` path |
| Org switch | **`settings.update`** + `metadata.event = 'mcp_access'` (+ `enabled`) | `api/org.py:98` `_INVITE_AUDIT_ACTION = "settings.update"` and `:712` `_SSO_AUDIT_ACTION`, same pattern. `OrgAuditTab.tsx` renders it as "Changed settings" (an optional one-entry label map edit, FIRES) |
| Operator switch | `PUT /admin/flags` → `operator_audit_floor` (the operator ledger) | `admin.py:_FLAG_HUMAN_NAMES`, one entry `"mcp_enabled": "MCP access"` |

So mig 220 needs **no `audit_log_action_type_check` change**, and `audit_service.py` (FIRES), `AuditTab.tsx` (FIRES) and the `assert_action_types_synced` boot lockstep are **not touched**. Removing one deploy-ordering hazard is a real gain. The live CHECK today has 40 literals, ending with `org.item.move` (mig 217).

## R-04 — Origin CHECKs (D-10): only one exists

Measured:
- `workflow_runs_origin_kind_check` (`origin_kind IN ('app','schedule','key')`) is the **only** origin CHECK.
- `threads` and `runs` have **no origin columns**.
- A thread's origin on the wire (`models/thread.py:517`, `api/threads.py:412, 2267, 2413`) is **derived from its workflow runs**.
- `messages.origin` ('deep' | 'harness') is unrelated.

**Recommendation.** Mig 220 changes `workflow_runs_origin_kind_check` to `('app','schedule','key','mcp')` and nothing else. ⚠ D-10's stated intent ("so 306 needs no migration for origin") **cannot be fully met** without inventing thread/chat-run origin columns in 304. Those would be dead schema here, with an immutable trigger and no writer. Recommend leaving them to 306 and recording that 306 owns them.

The CHECK literal alone is safe: no writer can produce `'mcp'` yet. `db/workflows._RUN_ORIGIN_KINDS` (line 397) refuses it, and `run_read_wire.ORIGIN_KINDS` (line 41) does not render it. **306's lockstep list:**
- `db/workflows._RUN_ORIGIN_KINDS`
- `harness/run_read_wire.ORIGIN_KINDS` + its `Literal`
- `api/notifications.py:69`
- `frontend/src/types/index.ts:184`
- `lib/api/notifications.ts:32`
- `layout/attentionConditions.ts:230`
- `workflows/runOriginVocabulary.ts`

304 touches none of them.

## Migration 220 / 221 shape

**220 — `api_keys` kind + origin literal** (BEGIN/COMMIT, idempotent, VERIFY block; ship `scripts/check-migration-220-live.py` on the 215 pattern):
```sql
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'workflow';
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS folder_ids jsonb NULL;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS tools jsonb NULL;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS include_external boolean NOT NULL DEFAULT false;
-- kind
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_kind_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_kind_check CHECK (kind IN ('workflow','mcp'));
-- D-05: mig 215's inline CHECK is named api_keys_workflows_check (measured)
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_workflows_check;
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_workflows_check CHECK (
  jsonb_typeof(workflows) = 'array'
  AND (kind <> 'workflow' OR jsonb_array_length(workflows) >= 1));
-- D-07
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_mcp_expiry_check CHECK (kind <> 'mcp' OR expires_at IS NOT NULL);
-- D-08 (empty is refused; NULL = not narrowed) + tools only on MCP keys
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_folder_ids_check CHECK (
  folder_ids IS NULL OR (jsonb_typeof(folder_ids) = 'array' AND jsonb_array_length(folder_ids) >= 1));
ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_tools_check CHECK (
  (kind = 'mcp' AND tools IS NOT NULL AND jsonb_typeof(tools) = 'array' AND jsonb_array_length(tools) >= 1)
  OR (kind = 'workflow' AND tools IS NULL));
-- (folder_ids / include_external on a workflow key: recommend CHECK kind='mcp' OR (folder_ids IS NULL AND include_external = false))
-- D-09: re-issue the column grant with the four new columns, never key_hash (REVOKE first — the 215 block)
REVOKE ALL ON TABLE public.api_keys FROM PUBLIC; REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM authenticated; REVOKE ALL ON TABLE public.api_keys FROM service_role;
GRANT SELECT (id, org_id, user_id, label, key_prefix, workflows, expires_at, revoked_at, revoked_by,
              last_used_at, created_at, kind, folder_ids, tools, include_external) ON TABLE public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_keys TO service_role;
-- D-10 (R-04): the only origin CHECK
ALTER TABLE public.workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_origin_kind_check;
ALTER TABLE public.workflow_runs ADD CONSTRAINT workflow_runs_origin_kind_check
  CHECK (origin_kind IS NULL OR origin_kind IN ('app','schedule','key','mcp'));
```
⚠ The key-prefix comment on `key_prefix` says "srl_live_ + 4". Update it to "the prefix + 4 characters". An MCP prefix is 12 characters (`srl_mcp_` + 4), against 13 for a workflow key. ⚠ Mirror the new GRANT line in `full-schema-supplement.sql:865` (same commit).

**221 — org narrowing + switches:** the `current_user_org_ids()` body (R-01); the `current_user_has_permission` + 6-policy route-through (R-05); `ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS mcp_enabled boolean NOT NULL DEFAULT true;` (R-02); `ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS mcp_enabled boolean NOT NULL DEFAULT true;`, with a COMMENT on each. Not a seed: defaults carry it (the 214/215 reasoning), so there is no `docs/OPERATOR.md` Step-3 entry and no env var. `check-deploy-drift.sh` is unaffected. **221 must be applied before the 304 backend boots, and 220 before the key routes write `kind`.** Both go to cloud with 305 (D-30).

Optional: split 220/221 the other way (keys + switches in 220, narrowing alone in 221) so the narrowing migration is reviewable in isolation. Recommended: keep `current_user_org_ids` + `current_user_has_permission` + the 6 policies **alone** in 221, and move both switch columns into 220.

## Resolver extraction (D-17) — the exact pure move

**Pinned by** `tests/unit/test_293_key_auth.py` (15 tests), `test_293_review_refusal_flood.py` (6), `test_293_api_keys_routes.py`, and `phase293_inbound_fakes.py` (`app.dependency_overrides[resolve_api_key]`). Their monkeypatch targets:
- `auth.api_keys_db.get_key_for_auth` / `.is_org_member` / `.touch_last_used` (module attribute on `app.db.api_keys`);
- `deps._is_banned`;
- **`auth.write_audit_entry`** and **`auth.get_service_role_supabase`**: names looked up in **`api_key_auth`'s own globals**.

Constraints this places on the move:
1. **Keep the core inside `api_key_auth.py`.** Moving it to another module would bypass the `auth.write_audit_entry` patch, because `_refuse → audit_key_call_now` must resolve it from this module, and the refusal-audit tests would go red.
2. `resolve_api_key` keeps its **name, signature and `Depends` identity**, since it is used as a `dependency_overrides` key. The body becomes: header check (`NO_KEY_DETAIL` stays here) → `await authenticate_presented_key(presented, pool=pool, redis=redis, call=_call_kind(request), expected_kind="workflow")`.
3. **Commit 1 = the pure move.** Make no other change, then run the four suites unchanged and green. **Commit 2** adds `expected_kind`, the `srl_mcp_` prefix, the switch checks and the typed refusal.
4. `test_the_resolver_never_depends_on_the_jwt_user` scans the **whole file** for the token `get_current_user` and for a `secret_cipher` import. New code in this file must not mention either (comments are stripped first).
5. `mint_key()` must keep defaulting to `srl_live_` with a **13-character** prefix (`test_mint_returns_a_prefixed_secret_its_digest_and_a_13_char_prefix`). Add `mint_key(kind="workflow")` and derive `key_prefix = secret[:len(prefix) + 4]`.

**Shape (recommended):**
```python
class KeyRefused(Exception):            # typed; 305 maps reason -> transport (D-19)
    def __init__(self, reason: str): self.reason = reason   # 'malformed'|'unknown'|'revoked'|...|'mcp_off_org'|'mcp_off_deployment'

async def authenticate_presented_key(presented: str, *, pool, redis, call: str,
                                     expected_kind: Literal["workflow", "mcp"]) -> ResolvedKey:
    digest = digest_key(presented, kind=expected_kind)          # prefix check, refusal #1 (D-06)
    ...lookup, compare_digest...
    if row.get("kind", "workflow") != expected_kind: raise await _refuse(row, call=call, reason="wrong_kind", redis=redis)  # refusal #2
    await principal_still_allowed(...)                           # revoked→expired→member→banned→(mcp) org→deployment
    ...touch_last_used, return ResolvedKey(+ kind, folder_ids, tools, include_external)
```
Keep the public `ResolvedKey` field order and add the new fields **with defaults** (the inbound fakes construct it positionally or by keyword; check `phase293_inbound_fakes.py:162`). `_refuse` today returns the 401 `HTTPException`. Two options: keep that for the workflow wrapper and have the core raise `KeyRefused`, or change `_refuse` to return the reason and let the wrapper map it. Either way **the 401 body stays byte-identical** (`test_every_bad_key_answers_with_one_byte_identical_401`).

**`principal_still_allowed` (D-18).** Keep the two existing calls (`api_keys_db.is_org_member`, `deps._is_banned`) so the 293 monkeypatches still drive workflow keys. Add **one** new db read used only for `kind='mcp'`:
```sql
SELECT o.mcp_enabled AS org_on, (SELECT a.mcp_enabled FROM public.app_settings a WHERE a.id = 'global') AS deploy_on
  FROM public.organizations o WHERE o.id = $1
```
This is a live read on the pool, **not** `load_app_settings()` (R-09). That cache is a 30 s per-worker TTL (`user_settings.py:391`), which would break "takes effect on the next call". Polarity: a failed read **refuses** (fail closed). That is the opposite of `workflows_enabled()`'s default-ON, and it is deliberate, because this is an access gate, not a capability toggle. The ban check stays after membership and keeps its documented fail-open note.

**`McpPrincipal`** (frozen dataclass, `security/mcp_principal.py`): `key_id, user_id, org_id, folder_ids: tuple[str, ...] | None, tools: tuple[str, ...], include_external: bool, credential_kind: Literal['key']`. Built from `ResolvedKey` by the MCP resolution function, never from request data.

## The `dependencies.py` edit (D-14) and the contextvar

- Put the ContextVar in a **leaf module with no `app.` imports**, e.g. `backend/app/security/acting_org.py`. A leaf avoids the cycle: `acting_member.py` needs `get_user_pg_connection` from `dependencies`, and `dependencies` needs the var.
  ```python
  _acting_org: ContextVar[str | None] = ContextVar("acting_org_id", default=None)
  def current_acting_org() -> str | None: return _acting_org.get()
  ```
  Setting it is `acting_member.py`'s job only: `acting_as(principal)` validates `str(UUID(principal.org_id))`, sets the var, `yield`s, and **resets the token in `finally`**.
- The edit inside `_apply_rls_user_context`, after the two claim GUCs, is 3-4 lines:
  ```python
  org = current_acting_org()
  if org is not None:
      await conn.execute("SELECT set_config('app.acting_org_id', $1, true)", org)
  ```
  The value is bound as `$1` and never interpolated. `is_local=true` reverts it at COMMIT, so it cannot leak to the next pool borrower. Signature unchanged, so `tests/integration/_rls_harness.py` (which imports this function) picks it up for free.
- ⚠ **Contextvar propagation:** `asyncio.create_task` / `gather` **copy** the context at creation. Anything spawned inside `acting_as` inherits the org. That is wanted for retrieval's internal fan-out, and it is a hazard if anything long-lived is spawned there. 304 spawns nothing. 306's `ask_agent` must decide this deliberately.
- ⚠ **The GUC narrows only the asyncpg acting connection.** Any supabase-py call inside an MCP read is unnarrowed. Fence it with a static test: the reads module does not call `.table(` or `.rpc(` except through `resolve_document_scope` (proposal) and `_enrich_with_filenames` (ids already narrowed).

## KeyScope (D-21) — the pure composition

`backend/app/services/key_scope.py`, mirroring `expert_scope.compose_expert_scope` (pure, frozen, never raises, no `app.` imports):
```python
@dataclass(frozen=True)
class KeyScope:
    folder_ids: tuple[str, ...] | None    # None = not narrowed by folder; () = nothing (never coerced to None)
    exclude_external: bool
    tools: frozenset[str]

def compose_key_scope(*, key_folder_ids: list[str] | None, include_external: bool,
                      tools: list[str], visible_folders: list[dict]) -> KeyScope:
    # narrowed: subtree(ticked ∩ visible) computed from visible_folders (so later subfolders count);
    #           a ticked folder no longer visible is dropped; all dropped -> () (matches nothing)
    # un-narrowed: None (RLS + GUC give "everything in the org", global folders included)
```
- `visible_folders` comes from the acting-connection folders read (R-06), never from `fetch_visible_folders`.
- D-22 "global folders excluded unless ticked" falls out of the subtree rule: only ticked roots and their visible descendants are included. Root documents (`folder_id IS NULL`) are excluded for narrowed keys.
- `()` reaching `_vector_search` / `_keyword_search` already returns `[]` with no DB call (WR-07). The list/read SQL must short-circuit too, since `= ANY('{}')` returns nothing in SQL anyway.
- `EXTERNAL_COLUMN = "source_connection_id"` plus its SQL fragment and Python predicate live here (R-07).
- The tool catalogue constant (D-11), its families and the presets (D-12) can live here or in a sibling pure module. Recommend `services/mcp_tool_catalogue.py` (pure data), served to the frontend through `GET /api-keys`.

## API surface (D-25) — minimal-touch map

| Change | File | Ledger | Notes |
|---|---|---|---|
| `kind` + MCP fields on create; capability gate per kind | `api/api_keys.py` | young (3/2/421) | ⚠ `create_key` has `dependencies=[Depends(require_capability("workflows"))]` at **route level**. The `workflows` capability is **enterprise-only** in `tier_capabilities` (measured), so pro/standard members could not mint MCP keys. Move the check inside the handler for `kind='workflow'` only. Gating MCP keys behind a tier is an operator decision (Open Q1) |
| `ApiKeyCreateBody` as a discriminated union on `kind`; `ApiKeyRead` + `kind`, `folder_ids`, `tools`, `include_external`; `ApiKeyList` + `mcp: {org_enabled, deployment_enabled, url, tools catalogue}` | `models/api_key.py` | young (2/2/117) | three-place lockstep with `_KEY_COLUMNS` and `_serialize_keys` |
| `_KEY_COLUMN_NAMES` + the four columns; `create_api_key(kind, folder_ids, tools, include_external)`; `mcp_switches(pool, org_id)` | `db/api_keys.py` | young (5/2/307) | bind jsonb as a **plain list** (mig 123 string-scalar trap) |
| Org switch `GET/PUT /org/api-keys/mcp-access` on the existing `org_router` (`require_org_manage`) | `api/api_keys.py` | young | **no `main.py` mount** (org_router is already mounted, `main.py:964`); avoids `api/org.py` (FIRES) |
| Operator flag | `api/admin.py` `_FLAG_HUMAN_NAMES` | FIRES (44/17) | one entry; honoured by construction |
| GET /settings readback `mcp_enabled` | `api/settings.py` (FIRES 48/26) + `models/user_settings.py` (FIRES 62/38) | FIRES | 2 lines each (field + `_val_bool(row, "mcp_enabled", None, True)`), the `workflows_enabled` idiom |
| `mcp_url()` = `settings.backend_public_url.rstrip('/') + MCP_PATH` (`MCP_PATH = "/mcp"`) | new module | — | D-28; 305 edits only `MCP_PATH` |

Folder validation at save: every ticked id must appear in the acting-connection folders read for the key's org (the active org). Otherwise return 422 with one sentence that does not confirm whether the folder exists. `tools` must be ⊆ the catalogue, else 422. An empty list for either is 422 with a plain sentence (D-08).

## Frontend reuse map (KEY-01, KEY-06)

| File | Ledger | Change |
|---|---|---|
| `components/settings/apiKeys/ApiKeysTab.tsx` | young (1/1/248) | kind choice before drafting; render `McpKeyDraftCard` for MCP |
| **new** `McpKeyDraftCard.tsx`, `mcpKeyCopy.ts`, `mcpSnippets.ts` (pure builders), `McpSnippets.tsx` | — | **keep MCP words out of `apiKeysCopy.ts` / `apiKeyFacts.ts` (both FIRE, 3 phases)**; a new leaf copy module mirrors the `connectionFormCopy.ts` seam pattern |
| `ApiKeyCard.tsx`, `ApiKeySecretOnce.tsx`, `RevokeApiKeySheet.tsx`, `ApiKeyActivity.tsx` | young | kind chip; MCP card shows tools/folders/"Not used yet"; SecretOnce shows snippets instead of curl for MCP |
| `lib/api/apiKeys.ts` | young (2/2/174) | `kind` + MCP fields + org-switch calls (do **not** grow `lib/api.ts`) |
| `components/org/OrgApiKeysTab.tsx` | young | kind chip (same list, same revoke) |
| `components/org/OrgSettingsTab.tsx` | **NO ROW**, add one | MCP switch (direct flip: reversible, no individual victim, per the sketch-findings graded-guards rule); needs the org admin route |
| `components/admin/CapabilityGrid.tsx` | FIRES (3/3/264) | one capability entry "MCP access" (`CapabilityKey` union + card); "off for everyone" tag; impact count only if honestly derivable |
| `components/admin/ControlRoomPage.tsx` | **NO ROW**, add one | `capabilityFlags.mcp_enabled = settings?.mcp_enabled ?? true` (line ~674 idiom) |
| `lib/api/admin.ts` | FIRES (10/5) | `FlagKey` union + `"mcp_enabled"` |
| settings response type (where `workflows_enabled` is typed in `lib/api/skills.ts`) | FIRES (10/7) | one field |
| folder checklist | reuse the `LegalHoldDialog` indented-checkbox pattern (`flattenFolders`) | folders from `GET /folders` under the active org (298 narrowing) |

`SettingsPage.tsx` (FIRES) and `OrgAdminShell.tsx` (FIRES) get **no edit** (D-01, D-02).

## Client snippets (D-27) — provider-docs-first

All four were read from each client's own docs on 2026-10-30. The URL is `{mcp_url}` from the API. The key never appears in a URL.

**Claude Code** [CITED: code.claude.com/docs/en/mcp]. A project `.mcp.json`, which supports `${VAR}` / `${VAR:-default}` in `url` and `headers`:
```json
{ "mcpServers": { "syrel": { "type": "http", "url": "{mcp_url}",
    "headers": { "Authorization": "Bearer ${SYREL_MCP_KEY}" } } } }
```
- The docs' CLI form is `claude mcp add --transport http <name> <url> --header "Authorization: Bearer …"`. A double-quoted `$SYREL_MCP_KEY` is expanded by the **shell** and stored literally in `~/.claude.json`, so it is **not** an env-var reference.
- Offer `claude mcp add-json syrel '{"type":"http","url":"{mcp_url}","headers":{"Authorization":"Bearer ${SYREL_MCP_KEY}"}}'` (single quotes) as the CLI alternative.
- ⚠ The docs present `${VAR}` expansion under the `.mcp.json` heading. Whether it applies to local/user-scope entries in `~/.claude.json` is **not stated**, so verify in 305's live UAT.
- `SYREL_MCP_KEY` is not one of Claude Code's covered credential names, so it expands (the docs list `ANTHROPIC_API_KEY` and others that read as empty).

**Cursor** [CITED: cursor.com/docs/context/mcp]. `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global). Interpolation `${env:NAME}` works in `url` and `headers`:
```json
{ "mcpServers": { "syrel": { "url": "{mcp_url}",
    "headers": { "Authorization": "Bearer ${env:SYREL_MCP_KEY}" } } } }
```

**VS Code** [CITED: code.visualstudio.com/docs/agents/reference/mcp-configuration]. `.vscode/mcp.json` uses a top-level `servers` with `"type": "http"`. "HTTP servers can use [env vars] in header values" in the `${env:NAME}` form. The VS Code-native alternative is an `inputs` `promptString` with `password: true`, referenced as `${input:id}`. Recommend the env form (D-27):
```json
{ "servers": { "syrel": { "type": "http", "url": "{mcp_url}",
    "headers": { "Authorization": "Bearer ${env:SYREL_MCP_KEY}" } } } }
```

**Claude Desktop bridge (labelled workaround)** [CITED: github.com/geelen/mcp-remote README]. Use the README's Windows-safe form (no space inside args):
```json
{ "mcpServers": { "syrel": { "command": "npx",
    "args": ["-y", "mcp-remote@0.15.2", "{mcp_url}", "--header", "Authorization:${AUTH_HEADER}"],
    "env": { "AUTH_HEADER": "Bearer <paste your key here>" } } } }
```
- ⚠ Claude Desktop's config does **not** interpolate the host environment, so this snippet necessarily holds the key in a local file (`claude_desktop_config.json`, never in a URL). The label must say so, and it is the reason the bridge is a workaround until 307. Node ≥ 18.
- **Pin the version.** `npm view mcp-remote`: latest `0.15.2` (2026-10-20), about 824k downloads a week, `author: Glen Maddern`, but `repository`/`homepage` now point at `github.com/punkpeye/mcp-remote` with maintainer `punkpeye` (glama.ai). That is an apparent repo/maintainer transfer from `geelen`. [ASSUMED-legit, flagged: verify the transfer before shipping a pinned version in product copy.]

**Claude.ai warning (D-29):** carry the milestone research finding forward without re-deriving it. Hosted Claude accepts a static header only as a beta, owner-entered, **org-shared** credential, so everyone in that Claude org would act as the key's owner. [CITED: .planning/research/FEATURES.md / PITFALLS.md, from Claude connector docs.]

## Parity test design (D-31, D-32) — the headline must-have

Reuse `tests/integration/test_298_two_org_lists_live.py`'s fixture shape and its helpers: `GoTrueUsers.create_signed_in_user(org, role="member")`, `create_org`, `memberships`, `user_client(tok)`, and `_request(org)` with `X-Org-Id`. The route handlers are called directly. Seed:
- **U**: role `member` (never owner) in X and Y.
- **V_X / V_Y**: co-members who own an `is_org_shared` folder with a document in each org, so org-shared visibility is exercised.
- U's own folder, subfolder and Root document in each org; a published workflow in each.
- A **connector-fed** document in X. This needs a `connector_connections` row because of the FK, so reuse 231's seeding.
- Chunks with a distinctive token per org (the `test_272_rpc_document_scope` INSERT pattern, a 1536-d vector). Stub `embed_texts` to the fixture vector.

| Read | Key side (acting connection, GUC = X) | App reference (R-08) |
|---|---|---|
| folders | acting read | `folders_api.list_folders(request=_request(X), supabase=user_client(tok))` (298) |
| list documents | acting read (un-narrowed, `include_external=True` for parity) | `documents_api.list_documents(..., request=_request(X))`: ids + total |
| read document | each X id readable; each Y id → identical "Not found." | the X list |
| search | `retrieval_service.search_documents` under `acting_as` | the **unnarrowed** app search (in-app search is all-orgs, Q18) **filtered to rows whose document org = X**, on a token present only in X; plus a Y-only token → `[]` |
| views | `resolve_document_scope` + list | app `resolve_view` (user JWT) **restricted to org X rows**. Views are not org-narrowed in the app today |
| relationships | acting read | app `GET` relationships route restricted to org X endpoints |
| workflows | `list_published_workflows(conn, …, org_id=X)` | `workflows_api.get_published_workflows(request=_request(X))` (298) |

- **Non-vacuity first:** with no acting org, the same reads return both orgs' rows. This is the "unset = today" arm of D-13.
- **Negative arms** (each "next resolution refused", same byte-identical refusal): delete U's X membership; set `banned_until`; revoke; expire (`expires_at` in the past through the pool); `organizations.mcp_enabled=false` (own sentence); `app_settings.mcp_enabled=false` (own sentence); a `srl_live_` key at `expected_kind='mcp'`; a `srl_mcp_` key at `resolve_api_key`.
- **Narrowed arms (D-32):** one per read path; global (V_X's shared) folder excluded unless ticked; connector-fed excluded with `include_external=false`.
- **Anon arm (D-33):** `has_column_privilege('anon', 'public.api_keys', c, 'SELECT')` is false for every column; `key_hash` is not selectable by `authenticated`; `organizations.mcp_enabled` is not UPDATE-able by `authenticated` (`has_column_privilege`); `current_user_org_ids()` is not executable by `anon` (`test_181_secdef_privileges.py` pattern).
- **This suite mutates the local DB, so serialize it (rule 4).**

## Common Pitfalls

1. **Calling the plan shape "InitPlan".** The measured shape is a hashed SubPlan, evaluated once. Verify by `loops=1` and "plan text unchanged", never by grepping "InitPlan".
2. **Re-declaring `current_user_org_ids()` with different attributes** (VOLATILE, no `SET search_path`, plpgsql, a ROWS change). Any of these voids R-01. Copy the measured header.
3. **A supabase-py read on the MCP path.** It is not narrowed by the GUC; this is the silent cross-org leak. Fence it with a static test.
4. **`x if x else None` on folder ids** turns "nothing" into "everything" (the 266 CR-01 / 272 D-18 class). `()` must survive to the RPC wrappers, which already refuse it.
5. **jsonb bound via `json.dumps`** stores a string scalar (mig 123). Bind plain lists (`db/api_keys.py` docblock).
6. **The label unique index spans kinds** (`api_keys_owner_label_active_uq` on org, user, lower(label) for active keys). An MCP key and a workflow key cannot share a label. Word the 409 for both kinds.
7. **Moving the resolver core out of `api_key_auth.py`** breaks the `auth.write_audit_entry` monkeypatch, so the refusal-audit tests go red. This would be blamed on the extraction, when the cause is the patch target.
8. **Reading the deployment switch through `load_app_settings()`** adds 30 s of per-worker staleness and fails KEY-06's "next call".
9. **`_call_from_audit` maps `call` to start/read only.** Give MCP resolutions `call="read"` in 304, or an MCP refusal renders as a "start" in the activity strip.
10. **An org-only parity fixture.** If U is the owner, owner-only rows mask the org-shared arms. U must be `role='member'` and the shared content must belong to someone else (D-31).
11. **Applying 220/221 locally while another session runs a baseline.** Take the shared lock `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` (noclobber; delete when done; stale after 45 min) before applying a migration or running the baseline.

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---|---|---|
| Org visibility | Python org/owner predicates on the service role | RLS + the GUC on `get_user_pg_connection` |
| Search | a new retrieval query | `retrieval_service.search_documents` under `acting_as` |
| View → document set | a new filter compiler | `retrieval_scope.resolve_document_scope` (271 compiler + RLS step 2) |
| Workflows list | a new SELECT | `db/workflows.list_published_workflows(conn, …)` |
| Key auth | a second resolver | `authenticate_presented_key` (D-17) |
| Refusal-audit flood control | a new throttle | `refusal_audit_slot` / `_refuse` |
| Subtree resolution semantics | an ad-hoc walk | mirror `compose_expert_scope`'s `_get_subtree` in the pure `KeyScope` |
| Relationship masking | new mask strings | import `_NO_ACCESS_MASK`, `_INVERSE_LABEL` |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Local Postgres :54322 | migrations, EXPLAIN, parity/RLS suites | ✓ | PostgreSQL 17.6 | — |
| GoTrue :54321 | parity fixture (`require_gotrue`) | assumed ✓ (298 suite uses it) | — | suites skip, and **a skip is not a pass** |
| backend venv | baseline, tests | ✓ | Python 3.12 | — |
| Node | gates, vitest | ✓ | — | — |
| npm `mcp-remote` | snippet text only (not installed by the app) | registry ✓ | 0.15.2 | — |

## Validation Architecture (nyquist disabled, kept brief)

- **Backend unit:** `pytest tests/unit -q --continue-on-collection-errors` in `backend/` (baseline ≤ 71). New pure tests: `test_304_key_scope.py`, `test_304_resolver_kind.py`, `test_304_principal_liveness.py` (fakes; no DB). The 293 suites run **unchanged** after the extraction commit.
- **Integration (local DB, serialized):** `test_304_acting_org_rls_live.py` (unset = today; GUC narrows; non-member org = nothing; anon/privilege arms), `test_304_two_org_parity_live.py` (D-31 + negatives), `test_304_narrowed_key_live.py` (D-32).
- **Gates:** `node scripts/check-schema-acl-parity.cjs`, `backend/venv/Scripts/python scripts/check-greenfield-privileges.py`, `scripts/check-migration-220-live.py` / `-221-live.py`, `node scripts/check-hot-file-ledger.cjs <phase-dir>`, `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, `npx tsc -p tsconfig.app.json --noEmit` (set diff against base).

## Recommended plan split (G-8: 4 plans, 3 waves)

| Plan | Wave | Content | Mutates local DB? |
|---|---|---|---|
| **304-01** Migrations + org narrowing | 1 | mig 220 + 221; supplement mirror; `regenerate-full-schema.sh`; `check-migration-22x-live.py`; `security/acting_org.py` + the `dependencies.py` edit; `security/acting_member.py` (`acting_as`, `acting_member_connection`); commit the EXPLAIN script and its output as evidence; `test_304_acting_org_rls_live.py`; baseline gate | **Yes** (applies migrations), so it runs first and alone among DB plans |
| **304-02** Resolver + liveness + scope (pure) | 1 (parallel with 01: unit-only, disjoint files) | pure-move commit, then `expected_kind` / `srl_mcp_` / `KeyRefused` / `principal_still_allowed` / `McpPrincipal` / `key_scope.py` / tool catalogue / `mcp_url()`; unit tests with fakes | No |
| **304-03** Narrowed reads + API + switches | 2 | `acting_member_reads.py`; `db/api_keys.py` + `models/api_key.py` + `api/api_keys.py` (kind, org switch on `org_router`); operator flag (`admin.py`, `settings.py`, `user_settings.py`); parity + narrowed + negative integration suites | **Yes**, so it serializes after 01 |
| **304-04** Key screen + admin list + switch UIs | 3 | the frontend map above; vitest; G-4 rows | No |

Plan 03 is the heaviest. If it must split, cut it into "reads + parity" and "API + switches". The second is unit-only with fakes, so it can run beside the first, giving 5 plans.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Claude Code expands `${VAR}` in local/user-scope (`~/.claude.json`) entries as it does in `.mcp.json` | Client snippets | the CLI `add-json` alternative stores a literal `${SYREL_MCP_KEY}`; keep `.mcp.json` as the primary snippet |
| A2 | `mcp-remote` npm ownership moved from geelen to punkpeye legitimately | Client snippets | supply-chain risk in a copy-paste snippet; verify before pinning |
| A3 | GoTrue :54321 is up for the parity suite | Environment | suites skip, and a skip must not be read as a pass |
| A4 | Pro/standard tiers should be able to mint MCP keys (no tier capability) | API surface | a pricing one-way door (TIER-02); operator decision |

## Open Questions

1. **Tier gate for MCP keys.** `workflows` is enterprise-only. Should MCP keys need a capability (new `mcp` row in `tier_capabilities`, or `basic_rag`), or none? Recommendation: none in 304 (the intake says "any member can mint"), with the org switch as the control. Confirm with the operator, because tier gates are a pricing door.
2. **Thread/chat-run origin columns (D-10 intent).** Recommendation: 306 owns them (R-04).
3. **Org switch storage (R-02).** Recommendation: the column. This uses D-03's escape clause and should be recorded as a phase decision.

## Out-of-scope finding (report, do not fold)

`organizations` grants **`anon` table-level `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`** locally. `authenticated` has the same plus `SELECT`. Mig 194 revoked only INSERT/UPDATE. `TRUNCATE` is not subject to RLS. It is not reachable through PostgREST, and `query_user_documents` refuses non-SELECT, so there is no known exploit path. It is still a defense-in-depth gap of the BUG-260911-01 class. Recommend a reported-bug entry and a production read-only check (`has_table_privilege('anon','public.organizations','TRUNCATE')`).

## Sources

### Primary (HIGH)
- Local Postgres 17.6 at 127.0.0.1:54322, measured 2026-10-30: `pg_get_functiondef`, `pg_policies` (183), `pg_proc`, `pg_constraint`, `information_schema` grants, EXPLAIN/ANALYZE (scripts `explain304.py`, `explain304b.py`, all rolled back)
- Code read at `4e0a39cfe`: `security/api_key_auth.py`, `db/api_keys.py`, `api/api_keys.py`, `models/api_key.py`, `dependencies.py:127-180`, `services/retrieval_service.py`, `retrieval_rpc.py`, `retrieval_scope.py`, `document_view_resolver.py`, `document_relationship_service.py`, `document_search_service.py`, `org_lists.py`, `utils/folder_utils.py`, `db/workflows.py:588-812`, `api/admin.py:60-140`, `api/org.py`, `models/user_settings.py`, `services/expert_scope.py`; migrations 194, 205, 215; `scripts/full-schema-supplement.sql`; tests `test_293_key_auth.py`, `_rls_harness.py`, `test_298_two_org_lists_live.py`, `test_272_rpc_document_scope.py`, `test_181_secdef_privileges.py`
- code.claude.com/docs/en/mcp; cursor.com/docs/context/mcp; code.visualstudio.com/docs/agents/reference/mcp-configuration; github.com/geelen/mcp-remote (README)

### Secondary (MEDIUM)
- npm registry (`npm view mcp-remote`, downloads API)
- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md` (milestone research)

## Metadata

**Confidence breakdown:** narrowing mechanism HIGH (measured); schema and reuse map HIGH (measured and read); snippets MEDIUM (docs read, not driven; no transport yet); plan split MEDIUM (judgement).
**Research date:** 2026-10-30 · **Valid until:** 2026-11-29 (client docs move fast; re-check snippets in 305).
