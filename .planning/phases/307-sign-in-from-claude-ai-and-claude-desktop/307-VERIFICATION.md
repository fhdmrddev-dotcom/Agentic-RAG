---
phase: 307-sign-in-from-claude-ai-and-claude-desktop
verified: 2026-11-04T08:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - never "reviewed"
status: human_needed
score: 4/4 roadmap success criteria verified in code (locally); cloud / real-client / G-4 rows owed
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "Real Claude.ai connect, refresh (>= 1 h later) and revoke on CLOUD"
    expected: "Add Syrel as a custom connector, consent page names the client and redirect host, tools list and run, refresh works, revoke makes the next call refused"
    why_human: "Claude.ai brokers through Anthropic servers and cannot reach localhost; needs the 304-307 bundle deployed (D-39). Roadmap forbids claiming this without a real connect."
  - test: "Real Claude Desktop connect, refresh and revoke on CLOUD"
    expected: "Same as Claude.ai"
    why_human: "Same reason (D-39)"
  - test: "One-box connect (docker-compose.prod topology): .well-known answers JSON, connect, tools run"
    expected: "nginx location ^~ /.well-known/oauth- proxies to the backend, JSON not the SPA"
    why_human: "Config proven by the routing suite only; no one-box deployment available here"
  - test: "Apply migration 224 to cloud Supabase, then get_advisors(security)"
    expected: "No new ERROR; oauth_clients / oauth_tokens have no anon/authenticated grants"
    why_human: "Cloud write needs explicit per-action operator approval (CLAUDE.md Supabase MCP rule). Locally verified live (check-migration-224-live.py prints '224 live')."
  - test: "G-4 row 1 (D-38): Claude Code signs in through the loopback redirect, no key, in Chrome"
    expected: "Consent page names the client and 'localhost', org + Read only pickable, Claude Code lists read tools and runs a search"
    why_human: "Lived-experience browser drive; not performed by this verifier"
  - test: "G-4 row 2 (D-38): member disconnects the app in Connected apps"
    expected: "Claude Code's next call is refused"
    why_human: "Browser drive"
  - test: "G-4 row 3 (D-38): org admin 'Disconnect all' names the count and disconnects a second grant"
    expected: "Count named in the sheet; both grants refused afterwards; keys keep working"
    why_human: "Browser drive"
  - test: "Add any Claude callback host beyond the two seeded to the redirect allowlist (Control Room) if the docs name more"
    expected: "Connect from that host succeeds; unlisted host refused"
    why_human: "Operator action (D-39)"
---

# Phase 307: Sign In From Claude.ai and Claude Desktop - Verification Report

**Phase Goal:** A member adds Syrel as a custom connector in Claude.ai/Claude Desktop, signs in on a consent page naming the client, picks org and narrowing, and uses the same tools under the same limits and kill switches as a key, on cloud and the one-box.
**Status:** human_needed (nothing automatable failed; real-client, cloud, one-box and G-4 rows are owed)
**Re-verification:** No

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Consent page names client + redirect host, org + narrowing pick; loopback any port (OAUTH-04) | VERIFIED locally / real Claude.ai+Desktop HUMAN | `ConsentPage.tsx` (525 lines), `ConsentWhoIsAsking.tsx` builds the mark from the server-proved `redirect_kind`/`redirect_host`; `ConsentOrgField.tsx`; `oauth_consent.py` read/approve/deny; `redirect_matches` in `mcp/oauth_clients.py` lets loopback http match any port, path+query exact, host raw; `test_307_redirect_match.py` passes. Vitest connect folder: 754 passed. |
| 2 | MCP spec: 401 with resource_metadata, S256 required / plain refused, DCR and CIMD advertised, tokens bound, .well-known JSON on all topologies (OAUTH-05) | VERIFIED (local + config); cloud/one-box HUMAN | `mcp/edge.py` challenge `Bearer resource_metadata=...`; `oauth_server.py:333-338` refuses missing/plain/duplicate method; `oauth_metadata.py` advertises `registration_endpoint`, `code_challenge_methods_supported=["S256"]`, `client_id_metadata_document_supported=True`; `canonical_resource` binds token resource, compared in `authenticate_presented_access_token`; nginx `location ^~ /.well-known/oauth-` proxy + 404 for openid-configuration; vercel.json and devRouting.ts carry parity; consent anti-framing (CSP frame-ancestors + X-Frame-Options) in nginx.conf and vercel.json. CIMD fetch goes through `egress.send_pinned_http("client_metadata", ...)` (new closed capability in `egress.py`). |
| 3 | Grant obeys narrowing, liveness, kill switches; token refused by DB API; refresh rotates, reuse refused (OAUTH-06) | VERIFIED locally | ONE admission tail `_admit` shared by key and oauth (`api_key_auth.py`), single `_liveness` -> `principal_still_allowed` call site pinned by `test_307_one_resolver_fence`; no second resolver. Tokens opaque `srl_oat_`/`srl_ort_`, SHA-256 hashed (not a JWT). `rotate_refresh` locks grant then refresh row, 60 s bounded grace, any other reuse -> `_revoke_family`. Live suites present: `test_307_removal_live.py` (membership, ban, org off, deployment off, expired, revoked, refresh reuse + member disconnect + admin revoke-all), `test_307_postgrest_refuses_token_live.py`, `test_307_oauth_roundtrip_live.py`. |
| 4 | Member sees connected apps and revokes; admin revokes all; next call refused (OAUTH-07) | VERIFIED locally | `ConnectedAppsSection/Card/DisconnectAppSheet.tsx`, `OrgConnectedApps.tsx`, `api/oauth_admin.py`; `test_member_disconnects_through_the_route` and `test_org_admin_disconnects_all_and_keys_keep_working`. |

**Score:** 4/4 verified in code locally. Roadmap states the milestone does not claim Claude.ai/Desktop working until the real cloud connect (D-39); that remains owed.

## Independent checks run by the verifier

| Check | Result |
|-------|--------|
| `pytest tests/unit -k 307` | 534 passed |
| `scripts/check-migration-224-live.py` (read-only) | "224 live" |
| Frontend vitest `src/components/connect` + `src/lib/__tests__` | 36 files, 754 passed |
| Migration file `supabase/migrations/224_mcp_oauth_grants.sql` | exists (164 lines), in full-schema.sql and full-schema-supplement.sql |
| New env vars | none (config.py untouched), so no deploy-drift entries needed |

Live integration suites were not re-run (they mutate the local DB and need the lock); relying on the orchestrator's and summaries' reports for those.

## Roadmap "How we'd know this failed" conditions

| Condition | Result |
|-----------|--------|
| Access token is a Supabase JWT PostgREST accepts | Not the case: opaque prefixed token; live PostgREST refusal test exists |
| Redirect accepts unregistered host / rejects loopback new port | Not the case (redirect_matches, host allowlist, unit tests) |
| .well-known returns SPA on Vercel/nginx | Not the case in config (nginx/vercel rules, 297 routing suite); real deployed probe owed |
| Client-metadata fetch bypasses egress.py | Not the case (`client_metadata` capability) |
| Second principal resolver | Not the case (AST fence test) |
| Consent page omits client / redirect host | Not the case |
| Refresh reuse undetected | Not the case (family revoke) |
| Works locally, fails on cloud/one-box | UNVERIFIED here (human rows) |
| "Claude.ai works" claimed without real connect | Not claimed by this report |
| Endpoint > 10 s | Reported < 10 s by live suites; not re-measured |

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| OAUTH-04 | 307-02, 03, 04, 05 | SATISFIED in code; real-client confirmation HUMAN | Truth 1 |
| OAUTH-05 | 307-01, 02, 04 | SATISFIED in code; cloud/one-box HUMAN | Truth 2 |
| OAUTH-06 | 307-01, 02, 05 | SATISFIED | Truth 3 |
| OAUTH-07 | 307-05 | SATISFIED | Truth 4 |

No orphaned IDs (REQUIREMENTS.md maps exactly OAUTH-04..07 to Phase 307, all claimed by plans). Bookkeeping: REQUIREMENTS.md still shows these as unchecked/Pending; flip after the human rows are signed.

## Anti-Patterns / Warnings

| Item | Severity | Note |
|------|----------|------|
| Review WR-05 deferred (SEED-397): OAuth limits are door-wide ceilings until per-caller addressing | Warning | Operator risk acceptance 2026-10-31 stands; not a ROADMAP SC |
| Review IN-02 open: "verified" badge on CIMD-supplied name may read as vouching for the name | Warning | Copy/design question routed to /gsd:secure-phase |
| deferred-items.md #1: `test_305_refusals_live.py` audit assertion vacuous over an empty set | Warning | Pre-existing 305 test weakness, outside 307 files; 307 uses its own pass-through |
| Debt-marker scan (TBD/FIXME/XXX) | Not run in depth | No blocker found in files read |

## Gaps Summary

No code gaps found against the four success criteria. The phase cannot be closed as `passed` because the roadmap explicitly requires a real Claude.ai / Claude Desktop connect, refresh and revoke on cloud, the one-box connect, cloud migration 224 (operator-approved), and the three G-4 browser rows. Run the Claude Code loopback row first.

---
_Verified: 2026-11-04_
_Verifier: Claude (gsd-verifier)_
