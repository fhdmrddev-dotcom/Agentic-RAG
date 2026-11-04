---
phase: 307-sign-in-from-claude-ai-and-claude-desktop
plan: 02
subsystem: mcp-oauth
tags: [mcp, oauth, authorization-server, pkce, dcr, cimd, egress, rate-limit]
requires:
  - "307-01: migration 224, security/oauth_tokens.py, db/oauth.py, api_key_auth.grant_still_live_for_refresh"
  - "305: register_mcp, the pure-ASGI edge, the access-log filter, the maintenance MCP arm"
provides:
  - "app/mcp/oauth_clients.py: strict redirect parse + D-07 match, live-allowlist host check, DCR and CIMD rules, egress-only CIMD fetch"
  - "app/mcp/oauth_metadata.py: issuer, PRM URL, well-known paths, AS + PRM documents"
  - "app/mcp/oauth_store.py: Redis requests, codes, code-reuse marker, CIMD negative cache (atomic takes)"
  - "app/mcp/oauth_server.py: well-known, /oauth/register, /oauth/authorize, /oauth/token, /oauth/revoke"
  - "edge.configure_challenge: the one 401 carries resource_metadata"
  - "egress capability client_metadata; four OAuth limiter buckets; /oauth maintenance + access-log entries"
  - "db/oauth.deployment_mcp_on (live deployment-switch read)"
  - "tests/integration/_307_live.py: GrantWorld, approve_for_test, serve() with the local Supabase env"
affects:
  - "307-03: the consent API reads oauth:req:{uuid} records and must write the code record shape below"
  - "307-05: ledger rows/sections for egress.py, rate_limit.py, edge.py, mcp/__init__.py, maintenance.py, access_log.py"
tech-stack:
  added: []
  patterns:
    - "Hand-rolled Starlette routes; only mcp.shared.auth Pydantic models reused (D-44)"
    - "Every refused authorize stored as a request and sent to Syrel's consent route, never to the client"
    - "One MULTI GET+DEL for every single-use take"
key-files:
  created:
    - backend/app/mcp/oauth_clients.py
    - backend/app/mcp/oauth_metadata.py
    - backend/app/mcp/oauth_store.py
    - backend/app/mcp/oauth_server.py
    - backend/tests/unit/_oauth307_fakes.py
    - backend/tests/unit/test_307_redirect_match.py
    - backend/tests/unit/test_307_client_rules.py
    - backend/tests/unit/test_307_cimd_fetch.py
    - backend/tests/unit/test_307_oauth_limits.py
    - backend/tests/unit/test_307_metadata.py
    - backend/tests/unit/test_307_store.py
    - backend/tests/unit/test_307_register_authorize.py
    - backend/tests/unit/test_307_edge_oauth.py
    - backend/tests/unit/test_307_maintenance_and_log.py
    - backend/tests/unit/test_307_token_revoke.py
    - backend/tests/integration/_307_live.py
    - backend/tests/integration/test_307_oauth_roundtrip_live.py
    - backend/tests/integration/test_307_removal_live.py
    - backend/tests/integration/test_307_postgrest_refuses_token_live.py
    - .planning/phases/307-sign-in-from-claude-ai-and-claude-desktop/deferred-items.md
  modified:
    - backend/app/mcp/__init__.py
    - backend/app/mcp/edge.py
    - backend/app/mcp/access_log.py
    - backend/app/middleware/maintenance.py
    - backend/app/security/egress.py
    - backend/app/services/rate_limit.py
    - backend/app/db/oauth.py
    - backend/tests/unit/test_190_egress.py
    - backend/tests/unit/test_305_edge_refusals.py
    - backend/tests/integration/test_305_refusals_live.py
    - backend/tests/unit/test_305_package_fence.py
    - backend/tests/unit/test_307_one_resolver_fence.py
    - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
    - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
    - frontend/src/components/settings/apiKeys/__tests__/mcpCallWords.test.ts
decisions:
  - "A failed code exchange (binding mismatch on a taken code) revokes the grant the code was minted for: the code is spent, so the grant could never connect"
  - "Redirect HOST policy is applied to the redirect presented at authorize, not inside validate_cimd_document, so a refusal reads host_not_allowed rather than metadata_unreadable"
  - "cimd_url_ok refuses ANY explicit port (default port only, implicitly)"
  - "The live tool call is list_documents, not search_knowledge_base (no paid embedding call from a spawned server)"
  - "Code record contract for 307-03: {grant_id, org_id, client_id, client_row_id, redirect_uri, code_challenge, resource}"
metrics:
  duration: "~3h"
  completed: 2026-11-04
  tasks: 3
  files: 35
---

# Phase 307 Plan 02: The authorization server Summary

Syrel now runs a working OAuth authorization server for AI tools, tested end to end on local. A client that gets the `/mcp` 401 can follow it to the discovery documents, register (DCR) or publish its metadata (CIMD), and sign in with S256 PKCE. It then gets a 1-hour access token and a rotating refresh token, calls tools, refreshes, and can be revoked. Reusing a refresh token outside the grace window ends the whole grant. Every removal case refuses the next `/mcp` call. Local PostgREST and GoTrue both reject the token. The consent page itself is 307-03; here a test helper does the approve step through the same store and database functions.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | Client rules, `client_metadata` egress capability, four door limits | `6a2f1104d` | `cf356ac0f` |
| 2 | Discovery, the 401 challenge, Redis store, register + authorize, maintenance + access log | `7d1bca8b8` | `4b0bb6dd9` (a), `b44c16738` (b), `cb18c728b` (d), `e5f857914` (c)+(e), `c7d724027` (f)+(g), fence fix `72e4f3d23` |
| 3 | `/oauth/token`, `/oauth/revoke`, live round trip, removal suite, PostgREST refusal | `e94f4f744` | `6c1266955`, timings `f6c34ec6b` |

Every task has its RED commit before GREEN. Task 2 held the five-commit cadence in the planned order (a), (b), (d), (c)+(e), (f)+(g).

RED observations:
- Task 1: 4 collection errors.
- Task 2: 1 collection error, plus 28 failed and 36 errored.
- Task 3: 41 of 41 unit tests failed. In the live suites, the 5 cases that need refresh or code exchange failed. The 6 access-token removal cases and the PostgREST case already passed, because 307-01's resolver already enforces them. That is expected: those cases pin 01's work end to end.

## Measured per-endpoint timings (live, spawned uvicorn, max of the round trip)

| Endpoint | Seconds |
|---|---|
| POST /mcp (401) | 0.022 |
| GET PRM | 0.023 |
| GET AS metadata | 0.019 |
| POST /oauth/register | 0.078 |
| GET /oauth/authorize | 0.126 |
| POST /oauth/token (code) | 0.047 |
| POST /oauth/token (refresh) | 0.025 |
| POST /oauth/revoke | 0.419 (includes the synchronous audit write) |

The live test asserts that each endpoint answers in under 10 s (D-05). The unit tests assert under 1 s with stubbed I/O. The CIMD fetch is refused in under 5.5 s against a resolver that sleeps for 10 s. Before relying on `asyncio.wait_for` I checked that it does bound `run_in_threadpool`: it returned at 1.0 s against a 4 s sleep.

## The 305 pin updates (D-22 / D-53)

`test_305_edge_refusals.py:126` and `test_305_refusals_live.py:79` now expect `Bearer resource_metadata="<PRM URL>"`. Each update carries a "D-22/D-53: resource_metadata added in 307-02" comment. The 401 body bytes did not change. Both suites are green, and the live one ran under the lock.

## Ban mechanism used by the removal suite

The suite uses a real ban: `UPDATE auth.users SET banned_until = now() + interval '1 day'`, restored in `finally`. This is what `deps._is_banned` reads, and the spawned server sees it. A monkeypatch cannot cross into that process. The deployment-switch case flips `app_settings('global').mcp_enabled` and restores the previous value in `finally`, all under the local-DB lock.

## Backend baseline

`pytest tests/unit -q --continue-on-collection-errors` gave **70 failed, 12182 passed, 1 skipped, 2 xfailed, 2 xpassed**, which is under the ceiling of 71.
- Only one failing id is anywhere near the touched areas: `test_190_review_fix_data_layer::test_CR01_the_projection_names_every_safe_column…`. It is a connector projection drift (`account_email` / `account_name`).
- None of that test's subject files changed since base: `git diff --stat 056d76362` over the connector model, service, API and that test is empty. The only change under `app/db` is the 9 added lines in `db/oauth.py`. So it is inherited, not new.
- The 305 + 307 + 190_egress unit sweep: 893 passed.

## Deviations from Plan

1. **[Rule 1 - Bug] Two fences contradicted the plan's own required edits** (`72e4f3d23`).
   - `test_307_one_resolver_fence` (307-01) pinned `edge.py` as byte-unchanged since the phase base, but this plan has to add `configure_challenge` (D-22). The clause now checks that `edge.py` with `configure_challenge` removed is AST-identical to the phase base. I drove it RED with a one-character change elsewhere in `edge.py` and then restored the file (`git status` clean).
   - The one-resolver clauses and the `principal_liveness.py` byte pin are unchanged.
   - **This knowingly breaks the acceptance line "test_307_one_resolver_fence.py was NOT edited by this plan".** The plan's D-22 edge change and that line cannot both hold. The clause the line exists to protect (no `principal_still_allowed` / `is_org_member` in `app/mcp`) is untouched and still green.
   - `test_305_package_fence` banned the substring `anon`, which also matched `canonical_resource`. It now matches `anon` only where it starts an identifier or literal, and a positive control (`"anon"`, `supabase_anon_key`) pins that.
2. **[Rule 3] `db/oauth.deployment_mcp_on` added** (not in `files_modified`). Authorize has no org yet, so it needs the deployment half of `mcp_switches` on its own. It is read live and fails closed. SQL stays in the db layer.
3. **[Rule 3] The `configure_challenge` call in `register_mcp` landed in commit (d), not (e).** (d)'s targeted suites need it, and the plan itself says (d) comes before (e) because `register_mcp` calls it.
4. **[Rule 2] `refresh_reuse` has activity words.** It is a new audited refusal reason, so I added `mcpKeyCopy.calls.refreshReuse` and an `apiKeyFacts` case, pinned in `mcpCallWords.test.ts`. The `apiKeys` vitest suites pass: 17 files, 254 tests.
5. **[Rule 1] The live harness had to pass the local Supabase env to the spawned server** (`_307_live.serve`). `tests/conftest.py`'s placeholder `SUPABASE_URL` was copied into the spawned uvicorn, so every supabase-py audit write there failed silently. I found this because the `refresh_reuse` row never appeared. The same flaw makes `test_305_refusals_live`'s audit assertion vacuous. That is logged in `deferred-items.md`, not fixed, because `_305_live.py` is outside this plan's files.
6. **The live tool call is `list_documents`** (the 305 two-worker precedent), not `search_knowledge_base`. Search would embed the query through a paid provider from a spawned process that has no stub seam.
7. **The live CIMD variant seeds a cached CIMD client row** (unique `https://claude.ai/oauth/test-307-<hex>`) instead of using a stub transport. The spawned server cannot take an in-process seam. The fetch itself, through egress, is covered by `test_307_cimd_fetch`, which uses the real binder with `MockTransport` and stub resolvers.
8. **`validate_cimd_document(url, doc)` takes no allowlist.** Host policy is applied to the redirect actually presented at authorize, so a refusal reads `host_not_allowed`.
9. **A failed exchange of a taken code revokes that code's grant.** The code is spent, so the grant could never connect, and the member should not see a dead "connected app".

## SEED-397 routing

Its trigger fires here, because this plan touches `rate_limit.py` and the edge. I left it **deferred**: proper per-caller addresses need proxy-aware client IPs, which is a uvicorn/proxy change outside 307. The four buckets are documented as door-wide ceilings (Pitfall 4).

## Contract for 307-03

- **Pending request (`oauth:req:{uuid}`, 600 s):**
  - A ready request has `status` (`ready` or `deployment_off`), `client_row_id`, `client_id`, `client_kind`, `client_name`, `client_uri`, `name_source`, `published_host`, `redirect_uri` (exactly as sent), `redirect_host`, `redirect_kind`, `state`, `code_challenge`, `resource` and `created_at`.
  - A refused request is `{status: "refused", reason, host}`, where `reason` is one of `unknown_client`, `not_registered`, `host_not_allowed` or `metadata_unreadable`.
- **Code (`oauth_store.save_code`, 60 s):** `{grant_id, org_id, client_id, client_row_id, redirect_uri, code_challenge, resource}`. `/oauth/token` reads exactly this shape. `_307_live.approve_for_test` is the reference writer.

## Verification

- All new unit and live suites pass. The live suites ran with `-rs` and reported no SKIPPED line.
- The Task 3 verify set (token/revoke unit tests, one-resolver fence, three 307 live suites, and the 305 live pin) gave 63 passed.
- Grep gates:
  - `"client_metadata"` appears 3 times in `egress.py`.
  - There is no httpx client, `requests.` or `urllib.request` use in `app/mcp/oauth_*`, and no `AnyUrl`.
  - The only removed line in `rate_limit.py` is the old `Kind`.
  - `include_in_schema=False` appears 8 times in `mcp/__init__.py`.
  - There is no `request.url`, Host or forwarded-header use in `oauth_server` or `oauth_metadata`, and no `openid-configuration`, `create_auth_routes` or `OAuthAuthorizationServerProvider`.
  - `oauth_server.py` has `cache-control` 3 times, `no-store` 2, the `api_key.refused`/`api_key.revoke` literals 2, `mcp_off` 2, `principal_still_allowed` 0 and `grant_still_live_for_refresh(` 2.
  - The removal suite has 7 tests.
- D-40 neutrality: `git diff 056d76362 --stat` is empty for `threads.py`, `agent_loop.py`, `dispatcher.py`, `main.py`, `user_settings.py`, `admin.py`, `principal_liveness.py`, `audit_service.py` and `frontend/src/lib/api.ts`.
- `check-hot-file-ledger.cjs` reports "ledger gate OK". The local DB is clean after every live run: 0 clients, 0 tokens, 0 grants, `mcp_enabled` restored. The one `phase-271-280-sb` org and user present are from 2026-10-26 and are not this plan's.
- The local-DB lock was released after every use.

## Threat Flags

None beyond the plan's register. Every new route and the outbound CIMD fetch are covered by T-307-01/02/03/04/08/09/10/11/12/14/16/19.

## Known Stubs

None. The approve step is a test helper by design. 307-03 ships the real route.

## Self-Check: PASSED

- All 19 files listed under `key-files.created` exist (the tasks' 18 plus this plan's `deferred-items.md`). All 12 commits listed above are on the worktree branch (`git log 056d76362..HEAD`).
