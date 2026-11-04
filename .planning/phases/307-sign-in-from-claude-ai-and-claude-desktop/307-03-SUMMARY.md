---
phase: 307-sign-in-from-claude-ai-and-claude-desktop
plan: 03
subsystem: mcp-oauth
tags: [oauth, consent, frontend, ui, narrowing]
requires:
  - "307-02: oauth_store (peek/take request, save_code), oauth_metadata.issuer, db/oauth.mark_client_granted, the code record contract"
  - "307-01: api_keys.oauth_client_id grants (create_api_key(oauth_client_id=...)), GRANT_TTL_DAYS"
  - "304: McpKeyFields, KeyFoldersField, mcpKeyFacts, MCP_KEY_COPY, GET /api-keys/folders"
  - "307-04: the /app/connect/ anti-framing headers (vite/vercel/nginx)"
provides:
  - "services/mcp_narrowing.py: validate_mcp_narrowing (switches -> tools -> folders), shared by key create and consent approve"
  - "api/oauth_consent.py: GET /oauth/requests/{id}, POST .../approve, POST .../deny on the member session"
  - "db/oauth.member_orgs: the consent page's org list"
  - "components/connect/*: ConsentPage, ConsentWhoIsAsking, ConsentOrgField, consentFacts, oauthCopy"
  - "lib/api/oauth.ts: getConsentRequest, approveConsent, denyConsent, listFoldersForOrg (explicit X-Org-Id)"
  - "/app/connect/<uuid>: one appRoutes arm, one returnTo kind, one App.tsx branch"
  - "McpKeyFields variant='consent'"
affects:
  - "307-05: ledger rows for api_keys.py, App.tsx, appRoutes.ts, returnTo.ts, McpKeyFields.tsx, useAppNavigation.ts, db/oauth.py, mcp/__init__.py and the new files"
  - "/gsd:secure-phase: the 'Only allow it if you just started connecting from {host}' copy decision"
  - "G-4 row 1 (Claude Code via loopback) is now drivable end to end"
tech-stack:
  added: []
  patterns:
    - "Validate, then take: a refused pick leaves the authorize request approvable; the single-use take happens only after every check passes"
    - "The page leaves Syrel only through location.replace after a host-match guard against the host it showed"
    - "A FastAPI router included from register_mcp only when the app has include_router (P-3)"
key-files:
  created:
    - backend/app/services/mcp_narrowing.py
    - backend/app/api/oauth_consent.py
    - backend/tests/unit/test_307_narrowing_move.py
    - backend/tests/unit/test_307_consent_routes.py
    - backend/tests/integration/test_307_consent_live.py
    - frontend/src/lib/api/oauth.ts
    - frontend/src/components/connect/oauthCopy.ts
    - frontend/src/components/connect/consentFacts.ts
    - frontend/src/components/connect/ConsentPage.tsx
    - frontend/src/components/connect/ConsentWhoIsAsking.tsx
    - frontend/src/components/connect/ConsentOrgField.tsx
    - frontend/src/components/connect/__tests__/consentFacts.test.ts
    - frontend/src/components/connect/__tests__/ConsentPage.test.tsx
    - frontend/src/components/connect/__tests__/ConsentWhoIsAsking.test.tsx
    - frontend/src/components/connect/__tests__/ConsentOrgField.test.tsx
    - frontend/src/components/connect/__tests__/oauthContract.test.ts
    - frontend/src/components/settings/apiKeys/__tests__/__snapshots__/McpKeyFields.test.tsx.snap
  modified:
    - backend/app/api/api_keys.py
    - backend/app/db/oauth.py
    - backend/app/mcp/__init__.py
    - frontend/src/components/settings/apiKeys/McpKeyFields.tsx
    - frontend/src/components/settings/apiKeys/__tests__/McpKeyFields.test.tsx
    - frontend/src/App.tsx
    - frontend/src/lib/appRoutes.ts
    - frontend/src/lib/returnTo.ts
    - frontend/src/hooks/useAppNavigation.ts
    - frontend/src/lib/__tests__/appRoutes.test.ts
    - frontend/src/lib/__tests__/returnTo.test.ts
decisions:
  - "SECURITY COPY (for /gsd:secure-phase): 'Only allow it if you just started connecting from {host}.' ends EVERY web why-line, including DCR on the seeded claude.ai / claude.com host and CIMD. The UI-SPEC dcrSeeded row omitted it; the seeded host is the realistic consent-phishing case (T-307-07, D-35)."
  - "The narrowing validator takes an optional folder reader; the key route passes one built on its own module seams so the 304 suites (which patch api_keys.acting_member_connection / list_acting_folders) pass unedited."
  - "A client's name is sanitised server-side: whitespace collapsed, Unicode control and format characters (bidi overrides, zero-width) dropped, capped at 60, fallback 'Connected app' (T-307-23)."
  - "GET /oauth/requests/{id} reads the X-Org-Id header ONLY to mark which org row starts selected; approve trusts the body's org_id, re-validated by membership and the live switches."
  - "On the consent page the tools and folders rows keep the 304 labels 'Tools' and 'Folders' (one vocabulary for keys and apps, A-6); the UI-SPEC's 'What it can do' / 'Which documents' headings are not rendered, because the folders label lives in KeyFoldersField, outside this plan's mount budget."
metrics:
  duration: "~2h30m"
  completed: 2026-11-04
  tasks: 3
  files: 28
---

# Phase 307 Plan 03: The consent page Summary

A member who follows an AI tool's sign-in link now lands on Syrel's own consent page at `/app/connect/<id>`. If signed out, they sign in first and come back to the same request. The page shows the app's self-chosen name as a claim ("calls itself", "name not checked") and the host it will send them back to as the fact. It lets them pick the org, the tools and the folders with the same controls as the key screen. Allow creates a narrowed 90-day grant and a single-use 60-second code. The browser follows the returned URL only if it points at the host the page showed. The 307-02 spec round trip now runs through the real HTTP approve route with a real GoTrue member session.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | One MCP narrowing validator; consent routes (read / approve / deny); included via `register_mcp` | `eb1a3542f` | `d1098857f`, fix `657d3d0c6` |
| 2 | The consent page and its leaves; `McpKeyFields variant="consent"` | `2bcd0ca5e` | `827112934` |
| 3 | `/app/connect/<uuid>`: one App.tsx branch, one appRoutes arm, one returnTo kind | `d80acce62` | `86520ad6b` |

RED observations:
- Task 1: 5 failed and 42 errored. Two tests passed at RED, as intended: the bare-Starlette `register_mcp` case and the no-public-base 404 case pin behaviour that already existed.
- Task 2: every new connect suite failed to import. In `McpKeyFields`, 3 variant tests failed and the default-render snapshot was **written from the pre-change component**. That snapshot is what the GREEN byte-identity check compares against.
- Task 3: 7 failed: the route arms, the return kind, the SSO round trip, and both App-level cases.

## The move fence: key-create pass lists (D-13 / T-307-25)

The five suites that exercise key create were run before the move and after it: `test_293_api_keys_routes`, `test_304_api_keys_routes`, `test_304_mcp_switches_routes`, `test_305_audit` and `test_306_thread_origin_wire`.
- **Base: 141 passed. After: 141 passed.** A sorted diff of the two PASSED/FAILED lists is empty, and both are saved in the executor scratchpad.
- `test_307_narrowing_move` pins the rest of the move:
  - `api_keys.py` calls `validate_mcp_narrowing(` exactly once, inside `_create_mcp_key`, and no switch read or tool normalisation is left inline.
  - `_FOLDER_NOT_VISIBLE`, `MCP_STATE_UNKNOWN_SENTENCE` and `_mcp_off` are the same objects in both modules.
  - The order holds: switches, then tools, then folders.

## Security decision for /gsd:secure-phase: the "Only allow it…" clause

"Only allow it if you just started connecting from {host}." now ends **every** web why-line:
- DCR on the seeded `claude.ai` / `claude.com` host,
- DCR on any other host,
- CIMD. CIMD names both its publisher and the redirect host.

The UI-SPEC's `consent.why.dcrSeeded` row left this clause out. This plan departs from the UI-SPEC on purpose (T-307-07, D-35):
- Any client can self-register with claude.ai's redirect and a convincing name.
- A victim sent that authorize link would otherwise read only reassurance on the seeded host.

The decision is recorded in `oauthCopy.ts`'s docblock and pinned in `consentFacts.test.ts` and `ConsentWhoIsAsking.test.tsx`. **Residual risk accepted:** a member who did just start connecting from claude.ai cannot tell a look-alike DCR client from the real one by its name. The host, the "name not checked" tag and this sentence are the only signals they get.

## Verification

- **Backend unit tests:** `test_307_narrowing_move` 12 passed. `test_307_consent_routes` 38 passed, including the late name-sanitising case. The `-k "304 or 305 or 307"` sweep gave 1067 passed.
- **Live tests** (run under the local-DB lock with `-rs`, no SKIPPED line): `test_307_consent_live` and the 307-02 `test_307_oauth_roundtrip_live` gave **5 passed**. The round trip does register, authorize, read the request with the member JWT, approve with the org named explicitly and Read only, exchange the token, list tools (exactly the three read tools), call `list_documents`, check the `api_key.create` audit row with `credential: oauth`, then deny a second request (`access_denied`, no grant), and confirm a second approve returns 410. The stand-in `_307_live.approve_for_test` is kept, because the 307-02 suites still use it.
- **Backend baseline** (`pytest tests/unit -q --continue-on-collection-errors`, under the lock): **70 failed, 12232 passed, 1 skipped, 2 xfailed, 2 xpassed**. 307-02 measured 70 failed and 12182 passed. The +50 passes are exactly this plan's 12 + 38 new tests, and the failed count is unchanged.
  - The 70 failures are all outside this plan's area: retrieval, sql, explorer, multimodal, reembed, sandbox, lifespan, db_runs, and so on. None is under `api_keys`, `mcp`, `oauth` or `307`.
  - The list was not diffed id-by-id against base, because no base id list exists. The equal count plus the exact +50 is the evidence.
- **Frontend suites:**
  - `src/components/connect` + `src/components/settings/apiKeys`: 22 files, 322 tests passed.
  - `src/lib/__tests__/{appRoutes,returnTo}`, `src/__tests__/routing`, `src/components/connect`, `src/hooks` and `runDeepLink`: 27 files, 747 passed.
- **tsc** (`tsc -p tsconfig.app.json --noEmit`): **61 errors, the same set as before this plan's frontend edits** (a sorted diff is empty).
  - The first Task 3 run added one error, a TS2322 in `useAppNavigation.ts`. It is fixed (see deviation 2).
  - The comparison set was taken after Task 2. Its count equals the 61 recorded for base, and none of the 61 errors is in a file this plan touched.
- **vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`): verdict line `total 13780 · failed 1 · pinned total 12714`, exit 1. **There is no per-file decrease.** The one red is in `src/pages/WorkflowBuilderPage.canvas.test.tsx`, test "POSITIVE CONTROL — with the flag ON the very same read finds the key", with `AssertionError: expected 0 to be greater than 0`, read from the gate's persisted JSON report.
  - That suite is **provably unmodified** by this plan: `git diff --numstat 0a5e57c0c HEAD -- frontend/src/pages frontend/src/components/workflows` is empty, and it imports none of the changed modules.
  - It is a recorded SEED-171 set member, with this exact signature, in `docs/VITEST-COUNT-GATE.md` line 289.
  - Re-run alone it gives 164/164. It was **not** re-run at base, so treat this as the recorded flake signature, not a proof of innocence.
- **Hot-file ledger gate:** OK.
- **D-40:** `git diff 0a5e57c0c --stat` is empty for `frontend/src/main.tsx`, `frontend/src/lib/api.ts`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/lib/activeViewReachability.ts`, `backend/app/main.py`, `models/user_settings.py`, `api/admin.py`, `api/threads.py`, `services/agent_loop.py` and `provider_gateway/dispatcher.py`.
- **Grep gates:**
  - `validate_mcp_narrowing(` appears 1× in `api_keys.py` and 1× in `oauth_consent.py`. `mcp_narrowing.py` has no fastapi import.
  - `oauth_consent.py` has 0 `get_active_org_id` and 0 `revoke_key|revoke_grant|revoked_at`.
  - `include_router` in `mcp/__init__.py` is guarded by `hasattr`.
  - `oauthCopy.ts` has 0 imports. `ConsentPage.tsx` has 3 `location.replace` (the code plus 2 comments) and 0 `assign` or `href=`. The connect files have 0 `dangerouslySetInnerHTML`.
  - `window.top` appears in `ConsentPage.tsx`, and `"X-Org-Id"` appears in `oauth.ts`.
  - App.tsx gained 5 non-empty lines (≤ 6 allowed). `"connect"` appears 3× in `appRoutes.ts`, and the `ActiveView` union is untouched.
  - "the page that connects your app" appears exactly 1× in `returnTo.ts`.
- **Local-DB lock:** taken twice (live suites, baseline) and released both times.

## G-4 rows this plan makes drivable (D-38)

- **Row 1 (Claude Code through loopback, no key):** drivable end to end now. The consent page renders the `Laptop` mark, "calls itself" or "verified", the `localhost` chip with "this computer", the account, the org, Read only and the exact summary sentence, then "Taking you back to the app on this computer…".
- **Rows 2 and 3 (Disconnect, Disconnect all):** need the Connected apps surfaces, which belong to another plan.

## Deviations from Plan

1. **[Rule 3 - Blocking] `frontend/src/hooks/useAppNavigation.ts` edited by one condition** (`86520ad6b`). The new `connect` route type made `activeView: ActiveView = … : parsed.view` a TS2322 error. The fix adds `|| parsed.view === "connect"` to the existing chat fallback; nothing else changed. The file is not in `files_modified` and is a FIRING ledger file, so 307-05 should cover it in its ledger row.
2. **[Rule 3 - Blocking] `backend/app/db/oauth.py` gained `member_orgs`.** The consent page needs the member's orgs with their switch state, and SQL stays in the db layer. This is the same pattern 307-02 used for `deployment_mcp_on`.
3. **[Rule 1 - Bug, test seam] The validator takes an optional `visible_folders` reader.** A literal verbatim move would have broken the 304 suites unedited: they monkeypatch `api_keys.acting_member_connection` / `list_acting_folders`, and those names would no longer be read. So `_create_mcp_key` passes `_visible_folder_ids`, built on its own module seams. The consent approve uses the module default.
4. **[Rule 2 - Security] Client names are sanitised server-side** (`657d3d0c6`). Unicode control and format characters (bidi overrides such as U+202E, zero-width joiners) are dropped before the name is shown, stored as the grant label, or audited. Without this, a self-registered name could reorder its own letters to read as "Claude" (T-307-23). The fix is pinned by a unit test.
5. **[Rule 2 - Security] `GET /oauth/requests/{id}` re-reads the deployment switch live.** A request stored `ready` before the operator switched MCP off now reads `deployment_off`, so the page never offers Allow for a request that approve would refuse.
6. **[Rule 1] No-session answers are 401, not FastAPI's default 403.** FastAPI 0.115's `HTTPBearer()` answers 403 when no header is sent. A small `_require_session` dependency answers 401, as the plan requires.
7. **Labels on the consent page.** The tools and folders rows keep 304's "Tools" / "Folders" labels. The UI-SPEC's "What it can do" / "Which documents" headings are not rendered, because the folders label is owned by `KeyFoldersField`, which is outside the mount budget. The rows stack through one CSS override on the variant's container (`md:[&>div]:grid-cols-1`), so `KeyFoldersField` is untouched. To revisit if the operator wants the UI-SPEC words: a one-prop change to `KeyFoldersField`.
8. **A new snapshot file** (`__snapshots__/McpKeyFields.test.tsx.snap`). It is the byte-identity proof for the default variant and is not in `files_modified`.
9. **The App-level route tests live in `ConsentPage.test.tsx`**, because there is no `App.test.tsx`. They cover signed out (AuthPage with the return line) and signed in (ConsentPage, no navigation landmark). The third case, "signed in at /app/chat unchanged", was not added as an App mount: mounting the full ChatLayout in jsdom is out of proportion. It is covered by the route-table tests (no other address parses to `connect`) and by the unchanged routing suites.
10. **`deny` from a `deployment_off` request also goes through the host-match guard**, with kind unknown: https on the shown host, or http only on loopback. There are no exceptions to the guard.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The three consent routes are T-307-01/05/06/07/13/23/24/25. The name-sanitising fix tightens T-307-23.

## Self-Check: PASSED

- All 17 files under `key-files.created` exist. All 7 commits are on the worktree branch: `eb1a3542f`, `d1098857f`, `2bcd0ca5e`, `827112934`, `d80acce62`, `86520ad6b`, `657d3d0c6`.
- TDD gate order holds for each task: `test(...)` comes before its `feat(...)`.
- STATE.md and ROADMAP.md were not touched (the orchestrator owns them).
