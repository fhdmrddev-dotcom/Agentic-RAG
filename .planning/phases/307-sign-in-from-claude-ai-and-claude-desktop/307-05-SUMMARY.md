---
phase: 307-sign-in-from-claude-ai-and-claude-desktop
plan: 05
subsystem: mcp-oauth
tags: [oauth, connected-apps, revoke, org-admin, control-room, allowlist, ledger]
requires:
  - "307-01: grants as api_keys rows with oauth_client_id; db/oauth.py; the one resolver"
  - "307-02: the authorization server; /oauth/token never reads the allowlist (D-51)"
  - "307-03: lib/api/oauth.ts, oauthCopy.ts, the consent route; api_key.create credential oauth"
  - "307-04: routing parity, the sign-in snippet tab, the switch sentences"
provides:
  - "GET /api-keys/connected-apps (every org), GET /org/api-keys/connected-apps, POST /org/api-keys/connected-apps/revoke-all"
  - "credential oauth audit detail on the EXISTING revoke routes (+ owner_name on the admin path); mcp.oauth on the key list"
  - "/admin/mcp-sign-in-hosts GET / add / remove (operator, audited, hidden from OpenAPI), validate_redirect_host"
  - "ConnectedAppsSection, ConnectedAppCard, DisconnectAppSheet, OrgConnectedApps, McpSignInHostsCard"
  - "oauthAuditLabel: one pure words helper both audit browsers read"
  - "Phase 307 ledger + CLAUDE.md FIRING rows; 13 first count-gate pins"
affects:
  - "/gsd:code-review 307, /gsd:secure-phase 307, /gsd:verify-work 307 (the three D-38 G-4 rows)"
tech-stack:
  added: []
  patterns:
    - "A grant is disconnected through the 293 revoke routes; the audit detail says credential oauth"
    - "A section that renders and reads nothing unless the server says sign-in is served (mcp.oauth)"
    - "One UPDATE per allowlist write whose WHERE re-checks the array under the row lock"
key-files:
  created:
    - backend/app/api/oauth_admin.py
    - backend/tests/unit/test_307_connected_apps_routes.py
    - backend/tests/unit/test_307_allowlist_admin.py
    - frontend/src/components/settings/apiKeys/ConnectedAppsSection.tsx
    - frontend/src/components/settings/apiKeys/ConnectedAppCard.tsx
    - frontend/src/components/settings/apiKeys/DisconnectAppSheet.tsx
    - frontend/src/components/org/OrgConnectedApps.tsx
    - frontend/src/components/admin/McpSignInHostsCard.tsx
    - frontend/src/components/settings/apiKeys/__tests__/ConnectedAppsSection.test.tsx
    - frontend/src/components/settings/apiKeys/__tests__/DisconnectAppSheet.test.tsx
    - frontend/src/components/org/__tests__/OrgConnectedApps.test.tsx
    - frontend/src/components/admin/__tests__/McpSignInHostsCard.test.tsx
    - frontend/src/components/admin/__tests__/AuditTab.oauthWords.test.tsx
    - frontend/src/components/org/__tests__/OrgAuditTab.oauthWords.test.tsx
  modified:
    - backend/app/api/api_keys.py
    - backend/app/models/api_key.py
    - backend/app/db/api_keys.py
    - backend/app/db/oauth.py
    - backend/app/mcp/__init__.py
    - backend/tests/integration/test_307_removal_live.py
    - backend/tests/fixtures/phase293/api_keys_contract.json
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/lib/api/oauth.ts
    - frontend/src/lib/api/apiKeys.ts
    - frontend/src/components/connect/oauthCopy.ts
    - frontend/src/components/connect/__tests__/oauthContract.test.ts
    - frontend/src/components/settings/apiKeys/ApiKeysTab.tsx
    - frontend/src/components/settings/apiKeys/__tests__/apiKeysContract.test.ts
    - frontend/src/components/org/OrgApiKeysTab.tsx
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/admin/AuditTab.tsx
    - frontend/src/components/org/OrgAuditTab.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "The connected-apps sections render AND read nothing unless mcp.oauth is true. The 'or the member holds a grant' clause of D-15 was collapsed: without a public base /mcp is not mounted, so no grant can act"
  - "OrgConnectedApps takes an oauthAvailable prop (mount still one line), so the 293/304 OrgApiKeysTab suites run unedited"
  - "Audit words read metadata.detail.credential (where every 307 writer actually puts it), with metadata.credential as a fallback"
  - "The admin revoke audit detail also carries owner_name, so the audit tables can say \"Disconnected {owner}'s app\""
  - "The redirect host of a grant is the host of its client's first registered redirect, the same derivation /oauth/revoke audits with"
  - "Expired grants and grants in an org the member has left are not listed (neither can act)"
metrics:
  duration: "~1h50m"
  completed: 2026-11-04
  tasks: 3
  files: 36
---

# Phase 307 Plan 05: Connected apps, the sign-in return-address allowlist, and the phase bookkeeping Summary

Members can now see every app acting as them, across every org, under Settings → API keys → Connected apps, and disconnect any one of them through the existing key revoke route. The next `/mcp` call from that app is refused. Org admins see the org's connected apps, each with its owner, and can disconnect one or all of them. Disconnect all asks for confirmation in a sheet that names the apps and members affected, revokes grants in that org only, never touches a key, and reports the count the server actually revoked. The operator edits the hosts a sign-in may return to under Control Room → Controls: adding a host takes one click, removing one asks for confirmation first, and every change is written to the operator audit log. Both audit browsers describe connected-app activity in plain words. The hot-file ledger and CLAUDE.md now reflect every file the phase touched.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | Grant lists, revoke metadata, revoke-all, mcp.oauth, the allowlist operator routes, two live removal cases, OpenAPI | `65d0010a4` | (a)+(b) `cc7f91a2a`, (c)+(d) `5e10bace3`, (e)+(f) `fb3bd0102`, OpenAPI `e1a220ff8` |
| 2 | Connected apps (member), Disconnect sheet, the org's apps + Disconnect all, two one-line mounts | `b4f6befec` | `8ce1a130e` |
| 3 | Control Room allowlist card + audit words; count-gate pins; ledger + CLAUDE.md | `23a0bd64d` | `370da86a4`, pins `d517ed3c0`, ledger `9b238e576` |

All three tasks committed their tests (RED) before the code (GREEN). Each RED run was checked to fail first:
- **Task 1:** 49 failed and 10 errored. Three tests passed at RED because they pin behaviour that already existed: a foreign revoke returns 404, a key revoke writes no oauth detail, and no new literal is introduced.
- **Task 2:** 3 suites failed to import, and the 3 new client-call cases failed. The model-contract cases passed, because they pin Task 1's backend models.
- **Task 3:** 4 failed, plus the McpSignInHostsCard import failure. The backend case for `owner_name` in the admin revoke detail was also red.

## What landed

### Backend
- **`db/api_keys.py`**
  - `list_grants_for_user`: filters on `k.user_id = $1` and returns live grants in every org, limited to orgs the member still belongs to, most recently used first.
  - `list_grants_for_org`: the same list for one org, plus each grant's owner name.
  - `revoke_all_grants_in_org`: a single `UPDATE … WHERE org_id = $1 AND oauth_client_id IS NOT NULL AND revoked_at IS NULL RETURNING id, user_id`.
  - `revoke_key`'s read-back now includes `oauth_client_id` and the client's `redirect_uris`.
  - I drove all four statements against the local database inside a rolled-back transaction.
- **`db/oauth.py`**: `add_redirect_host` / `remove_redirect_host`. Each is one UPDATE whose WHERE re-checks the array under the row lock. It returns the stored list, or None for a duplicate or a missing host.
- **`api/api_keys.py`**
  - `GET /api-keys/connected-apps` needs no org header.
  - `GET /org/api-keys/connected-apps` and `POST /org/api-keys/connected-apps/revoke-all` sit behind `require_org_manage`.
  - Revoke-all writes ONE `api_key.revoke` row, and only when N > 0. Its detail is `{credential: oauth, scope: org, count, members}`.
  - When the revoked row is a grant, the existing revoke routes add `credential`, `client_name` and `redirect_host` to the audit detail. The admin route also adds `owner_name`.
  - `mcp.oauth` is `mcp_public_base() is not None`.
  - A key revoke's audit row is byte-unchanged.
- **`api/oauth_admin.py`**: operator-only routes (`require_operator` on the router, `include_in_schema=False`). `validate_redirect_host` refuses each bad input with its own sentence and never rewrites the input. Each add or remove writes one operator audit-log row, as `settings.mcp_sign_in_hosts.add` / `.remove` with a label naming the host. A refused write records nothing.
- **`mcp/__init__.py`**: includes `oauth_admin.router` BEFORE the refuse-mount guard, so the allowlist is editable before `BACKEND_PUBLIC_URL` is set. `main.py` and `admin.py` are untouched.

### Frontend
- **Member list:** `ConnectedAppsSection` is mounted as the first child of `ApiKeysTab`'s grid.
- **Admin list:** `OrgConnectedApps` is mounted between the header card and the key list in `OrgApiKeysTab`.
- **Card and sheet:** `ConnectedAppCard` and `DisconnectAppSheet` follow the existing key card and revoke sheet. `RevokeApiKeySheet` itself is unchanged.
- **Allowlist card:** `McpSignInHostsCard` is mounted between `CapabilityGrid` and `MaintenancePanel`, with `onRecorded={pulseRecording}`.
- **Audit words:** `oauthAuditLabel` lives in the import-free `oauthCopy.ts`. AuditTab and OrgAuditTab each read it in one place. The `api_key.*` label maps are unchanged.
- **Operator labels:** AuditTab gains two operator labels for the allowlist actions.
- **Copy:** every new string comes from `oauthCopy.ts`. The verb for an app is "Disconnect"; "Revoke" stays the verb for keys (A-23).

### OpenAPI groups
- `/api-keys/connected-apps`, `/org/api-keys/connected-apps` and `/org/api-keys/connected-apps/revoke-all` are in the **api-keys** tag, under "Account & org".
- `/admin/mcp-sign-in-hosts` is absent: it is `include_in_schema=False` and also under the hidden `/admin/` prefix. `/oauth/*` and `/.well-known/*` are absent too.
- `node scripts/build-public-openapi.cjs --check` passes, and so does `test_276_openapi_snapshot_fresh`.

## Verification (full gates, run once, at the final wave)

- **Backend unit baseline** (`pytest tests/unit -q --continue-on-collection-errors`, under the local-DB lock): **70 failed, 12296 passed, 1 skipped, 2 xfailed, 2 xpassed**. That is under the ceiling of 71.
  - **Failing-set diff:** every one of the 70 ids appears in 307-01's list of 71 failures. `test_workflow_scheduler::test_c_…`, a known whole-suite-only failure, passes this time. **No new failing id.**
  - One line looked new at first. It is the same `test_published_workflow_ownership` id with a RuntimeWarning glued onto the line.
- **Targeted backend tests:**
  - `test_307_connected_apps_routes`: 19 passed. `test_307_allowlist_admin`: 43 passed.
  - The `-k "api_key or 304 or 305 or 307"` sweep: 1226 passed.
  - `test_307_removal_live`: **9 passed with `-rs` and no SKIPPED line.** That includes the two new cases:
    - A member revokes through `POST /api-keys/{id}/revoke`, and the next `/mcp` call returns 401. Exactly one audit row is written, with credential oauth and redirect_host claude.ai.
    - An org admin runs revoke-all and gets `{revoked: 2, members: 2}`. Both grants then return 401 while a key in the same org still returns 200. Exactly one audit row is written, with `{credential: oauth, scope: org, count: 2, members: 2}`.
- **vitest count gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, run once, from the worktree root): **`count gate OK — 610/610 pinned files present, no per-file decrease, 0 failing.`**, with `total 13907 · failed 0 · pinned total 12845`. The SEED-171 `WorkflowBuilderPage.canvas` POSITIVE CONTROL that went red in 307-03's run was green in this one, so there was no red set to trace.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): **61 errors**. A set diff, with line and column stripped, against the phase-base set at `3ad306b63` that 307-04 saved (`tsc-base-307-04.txt`) is **empty**. One new error appeared during Task 2: TS18046 in `oauthContract.test.ts`, an untyped `catch`. It was fixed before the commit.
- **Frontend suites:** `src/components/{admin,org,connect,settings/apiKeys}`: 73 files, 865 passed.
- **Ledger gate:** `node scripts/check-hot-file-ledger.cjs .planning/phases/307-…` reports **ledger gate OK** (837 rows, 45 watched files).
- **CLAUDE.md size gate:** `node scripts/check-claude-md-size.cjs` reports **OK** at 109,896 chars (73.3% of the limit).
- **Seeds register** (`check-seeds-register.cjs --phase 307`): **gate OK**, 404/404 parsed. These seeds' triggers fire on this phase's paths:
  - SEED-003, SEED-177, SEED-185, SEED-188, SEED-198, SEED-257, SEED-266, SEED-284, SEED-290, SEED-296, SEED-306, SEED-312, SEED-326, SEED-341, SEED-348, SEED-359, SEED-364, SEED-380, SEED-397.
  - Most match only on the broad `frontend/src/components/**` or `supabase/migrations/**` globs.
  - The specific matches are SEED-380 (`api_keys.py`), which stays planted and is not in scope, and SEED-397 (`rate_limit.py` and `edge.py`), which 307-02 already routed as deferred.
  - None was re-routed here. Routing seeds is the discuss-phase's job.
- **D-40 neutrality:** `git diff --stat 3ad306b63` is empty for:
  - `frontend/src/lib/api/admin.ts`, `frontend/src/lib/api.ts`, `SettingsPage.tsx`, `main.tsx`;
  - `threads.py`, `agent_loop.py`, `dispatcher.py`, `main.py`, `user_settings.py`, `admin.py`, `audit_service.py`.
- **Acceptance greps:**
  - `oauth_client_id IS NOT NULL` appears 3 times in `db/api_keys.py`. The revoke-all WHERE pattern appears once.
  - `include_in_schema=False` appears in `oauth_admin.py`. `mcp-sign-in-hosts` appears 0 times in the public OpenAPI.
  - `ApiKeysTab.tsx` and `OrgApiKeysTab.tsx` each gained 2 lines.
  - Lines containing "Revoke", outside identifiers, number 0 in the new app files. `dangerouslySetInnerHTML` appears 0 times.
  - `<McpSignInHostsCard` appears once in ControlRoomPage. "Apps already connected keep working" appears once in `oauthCopy.ts`.
  - The diff of the AuditTab and OrgAuditTab literal maps is empty.
- **Local-DB lock:** taken for the live suite and again for the baseline, released each time, and absent now.

## Ledger and CLAUDE.md (D-42)

- **Triples:** every non-test source file changed in the phase (`git diff 3ad306b63`) was re-derived with the CLAUDE.md recipe at HEAD.
- **Rows updated:** 53 scan-list rows and 20 CLAUDE.md FIRING rows. Each replaced cell was moved verbatim into a dated section, `### <file> — 307-05 refresh`, under `## Phase 307 refresh` in `docs/HOT-FILE-LEDGER.md`.
- **Files that crossed G-5 at 307** gained FIRING rows: `middleware/maintenance.py`, `security/mcp_principal.py`, `org/OrgApiKeysTab.tsx` and `settings/apiKeys/McpKeyFields.tsx`.
- **Rows that were missing:** three routing files 307-04 touched had no scan-list row. They have one now: `frontend/vite.config.ts` (4 phases, FIRES), `frontend/vercel.json` (5 phases, FIRES) and `frontend/devRouting.ts`. The two that fire also gained FIRING rows.
- **Seam owed:** `backend/app/api/api_keys.py` (11 / 5 / 884) now holds keys, connected apps and two org switches. The next phase that touches it should move connected apps into `api/connected_apps.py` first.
- **No row, as before** (the 304 precedent): the migration, `full-schema.sql`, `check-migration-224-live.py` and the three docs files.

## Deviations from Plan

1. **[Rule 1 - Bug] The audit words read `metadata.detail.credential`, not `metadata.credential`.** Every 307 writer passes `credential` through `audit_key_call(detail=...)`, so it lands under `metadata.detail`. The plan's `metadata.credential === "oauth"` would have matched no row. `oauthAuditLabel` reads `detail` first and falls back to the top level.
2. **[Rule 2] `owner_name` is added to the admin revoke audit detail.** The UI-SPEC sentence "Disconnected {owner}'s app" needs the owner's name, and the row otherwise carries only `owner_id`. The backend test was updated in the Task 3 RED commit.
3. **[Rule 3] `OrgConnectedApps` takes an `oauthAvailable` prop.** Without it, the existing `OrgApiKeysTab.test.tsx` failed 3 tests: the new list fetched for real and its error alert collided with the tab's own. The mount is still one line, now `oauthAvailable={list?.mcp?.oauth ?? false}`.
4. **[Decision] D-15's "or the member holds a grant" clause was collapsed.** Both sections render and read nothing unless `mcp.oauth` is true. Without a public base, `/mcp` is not mounted, so no grant can act. This also keeps the 293/304 suites unedited.
5. **[Rule 3] Contract fixture and frontend type moved in Task 1's (c)+(d) commit.** Adding `mcp.oauth` breaks `test_293`'s path-compare against `api_keys_contract.json`. The fixture, `lib/api/apiKeys.ts` (`oauth?: boolean`) and `apiKeysContract.test.ts` changed together, rather than splitting the type change into Task 2.
6. **[Decision] Allowlist non-operator answer is 404, not 403.** The plan's text says "member -> 403". The existing router gate `require_operator` answers a byte-identical 404, which is the 148 non-discoverability rule. The test asserts 404, and admin.py stays untouched.
7. **[Decision] Allowlist remove lowercases its input before matching.** Add never rewrites input, as the plan requires. Remove matches case-insensitively, because removal names an existing entry and a case slip should not leave a host on the list.
8. **[Rule 2] Expired grants and grants in an org the member has left are excluded from both lists.** Neither can act, and showing them invites "disconnect" on something already dead.
9. **[Rule 1] One `api_keys.py` route-level sort.** `_by_recent_use` keeps the wire order a property of the route as well as the SQL. The unit test drove it.
10. **Count-gate pins.** There are 13 first pins. They cover 307-03's five connect suites, 307-04's `oauthRouting` and `CapabilityGrid.oauthCopy`, and this plan's six suites, with both knobs FILE-LEVEL. `McpKeyFields.test.tsx` was raised from 8 to 12 to cover 307-03's consent variant and snapshot. Nothing was lowered.
11. **A line-ending-only snapshot rewrite was restored.** The count gate rewrote `McpKeyFields.test.tsx.snap` with LF endings and no content change. I restored that single path with `git checkout --`.

## Deferred

- From `deferred-items.md`, unchanged: `test_305_refusals_live`'s audit assertion still passes over zero rows, because placeholder Supabase settings reach the spawned server in `_305_live.serve`. This plan does not edit `_305_live.py`. Route it to the next plan that touches that file, or to the 307 code review.

## OWED (never claimed here)

- **Cloud migrations:** paste migration 224 into cloud Supabase after 220 → 221 → 222 → 223, each with its own per-action operator approval, then run `get_advisors(security)`.
- **D-39, the real Claude.ai / Claude Desktop path on cloud:** connect, a refresh at least 1 hour after connect, and a revoke.
- **One-box:** a one-box connect.
- **nginx probe:** the `nginx -t` container probe for the new `.well-known` and `/app/connect/` blocks. It is owed by 307-04; Docker is denied in the agent shell.
- **Verification:** the three D-38 G-4 rows are now drivable and run at `/gsd:verify-work 307`:
  - Claude Code signs in through loopback.
  - The member disconnects it.
  - The org admin runs Disconnect all.
- **8-provider scoreboard:** N/A. No LLM path was touched (D-40).
- **Next steps:** `/gsd:code-review 307` (fresh context, `independent_review: self`), then `/gsd:secure-phase 307`. The secure-phase run should cover 307-03's "Only allow it…" copy deviation and T-307-07's residual risk.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The new routes are T-307-26/27/28/29/30. The new audit detail field (`owner_name`) is a display name already shown to the same admin audience.

## Self-Check: PASSED

- All 14 files under `key-files.created` exist.
- All 11 task commits are on the worktree branch (`git log 540b6b6e3..HEAD`): `65d0010a4`, `cc7f91a2a`, `5e10bace3`, `fb3bd0102`, `e1a220ff8`, `b4f6befec`, `8ce1a130e`, `23a0bd64d`, `370da86a4`, `d517ed3c0` and `9b238e576`.
- TDD order holds for each task: `test(...)` comes before `feat(...)`.
- STATE.md and ROADMAP.md were not touched.
