---
phase: 163
slug: rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
status: verified
threats_open: 0
asvs_level: 2
created: 2026-07-19
---

# Phase 163 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The single load-bearing security transition of the v3.4 multi-tenancy milestone —
> membership-based Row-Level Security becomes the enforced gate on every request path.

**Audit stance:** FORCE / adversarial. Each declared mitigation was assumed ABSENT
until a grep/read/diff match proved it exists in the cited location. SUMMARY.md
self-reports were NOT accepted as evidence — every threat below cites the
implementation (factory code / migration SQL / grep-gate / test / git diff).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| FastAPI request handler ↔ user-JWT Postgres client | The validated user JWT is turned into an RLS-enforced DB identity. asyncpg: `get_user_pg_connection` opens a txn, issues `SET LOCAL ROLE authenticated` FIRST, then both GUC-claim forms (`is_local=true`). supabase-py: `get_user_supabase` builds a per-request anon-key + `Bearer` client (never mutates the service-role singleton). | User identity (auth.uid()), every user-owned row across 37 tables |
| User-JWT client ↔ RLS-gated tables | The membership predicate `org_id IN (SELECT public.current_user_org_ids()) AND (<owner> [OR <global branch>])` on all 37 target tables IS the isolation wall once the role is `authenticated`. | Cross-tenant reads/writes (documents, threads, skills, workflows, evals, DM, identity/audit) |
| Service-role writer ↔ org-scoped BYPASSRLS client | Fully-async writers with no `auth.uid()` (agent loop, eval runner, harness engine, golden-run publish, re-embed, skill-vector) construct via `get_service_role_supabase(org_id)`, which REFUSES a missing org, and widen `.eq("user_id")` reads/writes with an `org_id` predicate. | Background writes to org-scoped rows (runs, chunks, embeddings, workflow_runs) |
| pgvector chunk/skill org_id substrate | `document_chunks.org_id` + `skill_embeddings.org_id` denormalized (NOT NULL, btree, parent-FK-backfilled, autofill-triggered) so RLS filters the column directly — never a per-row join to `documents` over the pgvector scan. | Retrieval-adjacent tenancy scoping (substrate only; SECDEF RPC isolation is Phase 164) |
| Pooled asyncpg connection ↔ next borrower | Every `SET LOCAL` (role + claims) is `is_local=true`, so it auto-reverts at COMMIT — claims can never leak to the next pool borrower. | Cross-request identity bleed (blocked by construction) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-163-01 | Elevation of Privilege | `get_user_pg_connection` role-swap no-op | mitigate | `SET LOCAL ROLE authenticated` issued FIRST in `_apply_rls_user_context` (`dependencies.py:146`) inside the per-request txn (`:173-174`). Role-swap-noop detector `test_163_role_swap.py::test_role_swap_is_the_load_bearing_diff` (:36-76) asserts WITHOUT swap `current_user=='postgres'` + sees A's row (`==1`), WITH swap `==0` — the 1→0 diff. GREEN post-apply (95/95). | closed |
| T-163-02 | Information Disclosure | RLS predicate incompleteness / dropped global OR-branch / cross-user leak | mitigate | `108_rls_membership_rewrite.sql` rewrites all 37 tables in ONE `BEGIN…COMMIT`-atomic, inert-first migration (97 CREATE POLICY == 97 DROP POLICY; 0 `= ANY(`; 0 `CREATE OR REPLACE POLICY`). Every global OR-branch preserved verbatim (see T-163-07b/08b). Two-user both-path isolation `test_163_leak_asyncpg.py` (:125/:133 bidirectional, :142 write) + `test_163_leak_supabase.py` (:79/:87). | closed |
| T-163-02b | Information Disclosure | wrong owner column (created_by vs id vs user_id) | mitigate | `108:487-500` workflow_definitions owner = `created_by`; `108:604-612` profiles owner = `id` (owner-only — see Observations); parent-thread subqueries preserved for todos/workspace_files/workspace_file_versions/workflow_runs/workflow_phases. Structural qual assert `test_163_rls_*::test_policy_enforces_membership`. | closed |
| T-163-03 | Spoofing | GUC-variant false-pass (`request.jwt.claim.sub` vs `request.jwt.claims`) | mitigate | BOTH GUC forms set, parameterized, `is_local=true` (`dependencies.py:147-153`). Fail-loud `assert_auth_uid` preflight (`_rls_harness.py:125-141`, raises on NULL uid). Live-variant probe `probe_auth_uid_variant` (`_rls_harness.py:146-162`); GUC arbitration `test_163_leak_asyncpg.py:197`. | closed |
| T-163-04 | Information Disclosure | `get_service_role_supabase` constructed without an org | mitigate | `dependencies.py:226-227` — `if not org_id: raise ValueError(...)` before any BYPASSRLS client is built. Smoke `test_163_factories.py` (pytest.raises on `""`/`None`). | closed |
| T-163-05 | Info Disclosure / Tampering | async writer under-scoped / future-chunk INSERT autofill gap / cross-org writer | mitigate | `107` §5 BEFORE-INSERT `autofill_org_id_from_parent` triggers on document_chunks/skill_embeddings (`:171-177`); `db/runs.py:126-159` `load_cap_paused_tool_calls` adds optional `AND org_id = $2` (belt-and-suspenders); insert_run/insert_assistant_message omit org_id → trigger-filled; writers via `get_service_role_supabase(org_id)` (D-14 `.eq("user_id")` retained). | closed |
| T-163-05b | Elevation of Privilege | bare service-role singleton on a writer/publish path | mitigate | All 5 writer files construct via `get_service_role_supabase(org_id)`: eval_runner_service.py:805, harness_engine.py:1532, harness/publish_service.py:511, reembed_service.py:328, skill_embedding_service.py:202. Adversarial sweep for bare `get_supabase()` in these files → NONE; publish_service.py has no plain `get_supabase` reference (former fallback removed). | closed |
| T-163-06a | Information Disclosure | a chat handler left on service-role | mitigate | threads.py/runs.py retain ONLY the named `service_supabase` D-05 producer carve-out (threads.py:750 coexists with primary `Depends(get_user_supabase_client)` at :742, commented :743-749); panel.py/feedback.py/sandbox_outputs.py/workspace.py = 0 remaining `Depends(get_supabase)`. | closed |
| T-163-06b | Information Disclosure | connectionless `pool.*` stays BYPASSRLS (Pitfall 6) | mitigate | Request-scoped `pool.*` on the chat path converted to `get_user_pg_connection`; the workflow_kickoff preflight (T-163-06c) fixed; the one residual `get_pg_pool()` in workflow_kickoff.py:289 (`pin_templates_for_run`) is a CLASSIFIED, upstream-RLS-ownership-gated deferred exception (:279-294). | closed |
| T-163-06c | Information Disclosure | `preflight_workflow_kickoff` raw `get_pg_pool` read of workflow_runs (THE BLOCKER) | mitigate | `workflow_kickoff.py:157-160` — `async with get_user_pg_connection(request, current_user) as _conn:` reads `SELECT status FROM workflow_runs WHERE id=$1` under RLS; blocker documented :150-157. `request` threaded from send_message (threads.py:740). | closed |
| T-163-06d | Information Disclosure | thread_title silent-inherit on the wrong client | mitigate | `thread_title.py:221-226` — EXPLICIT "REQUEST-SCOPED, inherits send_message's swapped `get_user_supabase_client`, NOT silent inheritance" classification; reads (:233)/writes (:253) run under the caller's RLS. | closed |
| T-163-07a | Information Disclosure | a doc/folder handler left on service-role | mitigate | documents.py (4 BackgroundTask `service_supabase` carve-outs: pdf_extraction_runs has no authenticated INSERT policy), document_governance.py:363 (cross-user existence probe, commented :356-362), knowledge_health.py ×8 (audit_log no authenticated SELECT, commented). folders/document_views/document_relationships/classification_rules/metadata_fields/kb = 0 remaining. | closed |
| T-163-07b | Availability | global-folder OR-branch regression | mitigate | `108:117` documents `folder_is_globally_visible(folder_id)`, `108:135` folders `folder_is_globally_visible(id)` preserved verbatim. `test_163_rls_documents.py` global-branch preservation + non-owner co-member visibility. | closed |
| T-163-07c | Information Disclosure | accidentally "org-isolating" retrieval in 163 | mitigate | `git diff 5a0e3cc8..HEAD -- documents.py kb.py` shows NO `match_document_chunks`/`keyword_search_chunks` edit; `107` header explicitly scopes SECDEF RPC org-isolation to Phase 164. | closed |
| T-163-08a | Information Disclosure | a router left on service-role | mitigate | skills.py/skill_test_cases.py fully swapped; evals.py ×14, settings.py ×3, audit.py ×2, workflows.py ×2 (:505 destructive cascade + :645 authoring delegate — both commented, `require_visible`-gated), skill_tuner.py ×1 detached-writer carve-out — ALL carry `# service-role:` classification comments. | closed |
| T-163-08b | Availability | is_global/is_system skill regression | mitigate | `108:421` skills `is_global = true`, `108:435-437` skill_files EXISTS-on-skills, `108:577-579` tuner_runs EXISTS-on-skills preserved. `test_163_rls_skills.py::test_is_global_branch_preserved` + co-member visibility (:127). | closed |
| T-163-08c | Information Disclosure | forcing a request context on a background call | mitigate | db/workflows.py kept service-role BY DESIGN (shared by request + harness; acquire-based helpers non-duck-typable); `/published`+`/starters` Run-carve-out feeds retained on service-role (a user-JWT read would HIDE cross-org starters). Documented in workflows.py + db/workflows.py headers. | closed |
| T-163-09 | Tampering | provider/gateway shared-path fork breaks Deep Mode | mitigate | `git diff 5a0e3cc8..HEAD` on `agent_loop.py`, `run_producer.py`, `provider_gateway/` is EMPTY (77 files changed phase-wide; none of these). Deep red line HELD. CONCUR-01 0.41s; live native-4 cross-provider round-trip PASS (163-10). | closed |
| T-163-10 | Information Disclosure | NULL org_id audit/operator rows | mitigate | `108:617-618` audit_log WITH CHECK carries explicit `(org_id IS NULL) OR (org_id IN (SELECT current_user_org_ids()))` branch (D-10). Operator/system catalogs (operator_users, operator_audit_log, app_settings, roles, role_permissions, model_capabilities_overrides + 8 org tables) EXCLUDED from the rewrite (grep = 0). | closed |
| T-163-IB | Information Disclosure | identity bleed (singleton `.postgrest.auth()` mutation) | mitigate | `dependencies.py:207-214` `get_user_supabase` builds a fresh per-request `create_client`, never mutates the singleton; `is_local=true` SET LOCAL auto-reverts at COMMIT (:147-153). `test_163_leak_supabase.py::test_per_request_client_does_not_mutate_singleton` (:96-115) asserts `singleton_before is singleton_after`. | closed |
| T-163-SPOOF | Spoofing | non-member sub reaches an org's rows | mitigate | `test_163_role_swap.py::test_spoof_random_non_member_sub_sees_zero` (:106) — random honored sub → 0 rows; `::test_spoof_other_org_member_sees_zero` (:124) — valid Org-Y member B → 0 of A's Org-X rows. Membership, not a well-formed claim, is the gate. | closed |
| T-163-42P17 | Denial of Service | org_members RLS infinite recursion | mitigate | `108` — every rewritten predicate calls the SECDEF `public.current_user_org_ids()` helper (106 occurrences); NO inline `org_members` subquery in any policy. Header :26-29 documents the 42P17 recursion break. | closed |
| T-163-BF | Information Disclosure | bad backfill ships an org-less chunk | mitigate | `107` §2 backfill resolves org_id STRICTLY from parent FK (document_chunks←documents via document_id :105-109; skill_embeddings←skills via skill_id :112-116); §3 self-guarded flips RAISE on any residual NULL (:133-145). `test_163_ten04_backfill.py::test_org_id_column_is_not_null` + `::test_zero_null_org_id`. | closed |
| T-163-PERF | Denial of Service | join cliff / SET-LOCAL RTT regresses CONCUR-01 | mitigate | `107` §4 denormalized `org_id` + `btree(org_id)` on both tables (:155-156); HNSW (`document_chunks_embedding_idx`) + GIN untouched (no DROP INDEX, no hnsw DDL); no per-row join to documents. CONCUR-01 `test_058_concurrency.py` = 0.41s < 1.0s with the swap live (163-10). | closed |
| T-163-APPLY | Repudiation | file-exists ≠ applied | mitigate | 163-05 applied state proven by LIVE psycopg2 @ :54322 (not file presence): 36/37 target tables reference `current_user_org_ids` (profiles owner-only by design), document_chunks/skill_embeddings org_id NOT NULL + btree, HNSW/GIN intact, pre-flip NULL census 0/0; full `test_163_*` 95/95 GREEN. `full-schema.sql` regenerated (5780 lines). | closed |
| T-163-ORDER | Tampering | 108-before-107 misorder | mitigate | `107` header :14-20 + `108` header :18-22 LOCK "107 BEFORE 108"; integer-filename order. 163-05 applied 107 then 108; 108's document_chunks predicate would error on a missing org_id column (apply-time fail-loud). | closed |
| T-163-SC | Tampering | dependency installs (slopsquat / supply-chain) | accept | No dependency manifest (requirements*.txt / pyproject / poetry.lock / package.json) changed in `git diff 5a0e3cc8..HEAD`; all 10 SUMMARY `tech-stack.added: []`. Recorded in Accepted Risks Log. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Coverage:** 26/26 threats resolved — 25 `mitigate` CLOSED (control found in code/SQL/test), 1 `accept` CLOSED (recorded below). `threats_open: 0`.

### Unregistered Flags

None. All 10 plan SUMMARY `## Threat Flags` sections report "None" — no new network endpoint, auth path, or trust-boundary schema surface appeared during implementation beyond the plan-time register. No `unregistered_flag` logged.

### Observations (not gaps)

- **profiles owner-only deviation (documented, strictly-more-restrictive).** `profiles` has no `org_id` column live, so its 3 policies (`108:602-612`) keep the OWNER branch only (`auth.uid() = id`) rather than the membership macro. This is *more* isolated than membership (self-only), not less — no cross-tenant exposure. It is why the live-DB check reads 36/37 (not 37/37) tables referencing `current_user_org_ids`. Org-wide roster visibility is deferred to Phase 166 (which adds `profiles.org_id` first). Disclosed in the 108 header (:57-62), 163-03-SUMMARY, and 163-05-SUMMARY. Does not open a threat.
- **Classified service-role carve-outs are honest, not gaps.** Every residual `Depends(get_supabase)` / `service_supabase` site carries a schema-driven reason (no authenticated write/SELECT policy on the target table, a deliberate cross-user probe, a detached BackgroundTask/producer that outlives the request token, or an operator/app-level path). Owner-scoping on these stays the app-code `.eq("user_id")` gate (D-14). admin.py + test_fixtures.py are out-of-scope by design (platform-operator tier / env-gated dev harness).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| ARL-163-01 | T-163-SC | Phase 163 installs NO new package — the entire crux (per-request RLS factories, 2 SQL migrations, 15 leak/cluster tests, 4 Wave-4 client-swap waves) is built on libraries already in the venv (httpx / asyncpg / supabase / ClientOptions). Verified: no dependency manifest changed in the phase diff (`5a0e3cc8..HEAD`); all 10 SUMMARY `tech-stack.added: []`. No slopsquat/supply-chain install surface exists this phase. | gsd-security-auditor | 2026-07-19 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-19 | 26 | 26 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-19
