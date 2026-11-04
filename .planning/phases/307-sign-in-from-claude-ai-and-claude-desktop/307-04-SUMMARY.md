---
phase: 307-sign-in-from-claude-ai-and-claude-desktop
plan: 04
subsystem: routing / deploy-parity / connect-snippets
tags: [routing, nginx, vercel, well-known, anti-framing, deploy-parity, mcp-snippets]
requires: []
provides:
  - "one-box nginx proxies root /.well-known/oauth-* to the backend unchanged; openid-configuration 404"
  - "consent route /app/connect/<id> served with frame-ancestors 'none' / X-Frame-Options DENY / Referrer-Policy no-referrer on Vite dev, Vercel and nginx"
  - "routing evaluator that sees proxy / return / add_header and models the try_files internal-redirect header loss (F-10)"
  - "Claude.ai and Desktop snippet tab by sign-in; Claude Code sign-in command; bridge retired"
  - "operator docs + deploy-parity rows for Claude sign-in (egress ranges, CIMD probe, migration 224 order, owed rows)"
affects: [307-02 (backend registers the literal .well-known paths), 307-03 (consent page lives at /app/connect/<id>), 307-05 (ledger rows for nginx.conf / mcpKeyCopy / mcpSnippets / McpConnectSnippets / CapabilityGrid)]
tech-stack:
  added: []
  patterns: ["three-layer routing parity with negative controls", "pure devHeadersFor beside rewriteDevUrl"]
key-files:
  created:
    - frontend/src/__tests__/routing/oauthRouting.test.ts
    - frontend/src/components/admin/__tests__/CapabilityGrid.oauthCopy.test.tsx
  modified:
    - frontend/src/__tests__/routing/routingLayers.testutil.ts
    - frontend/src/__tests__/routing/appRouteParity.test.ts
    - frontend/nginx.conf
    - frontend/vercel.json
    - frontend/devRouting.ts
    - frontend/vite.config.ts
    - docs/OPERATOR.md
    - docs/DEPLOYMENT-WORKFLOW.md
    - docs/DEPLOYMENT-LESSONS.md
    - frontend/src/components/settings/apiKeys/mcpSnippets.ts
    - frontend/src/components/settings/apiKeys/McpConnectSnippets.tsx
    - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
    - frontend/src/components/admin/CapabilityGrid.tsx
    - frontend/src/components/settings/apiKeys/__tests__/mcpSnippets.test.ts
    - frontend/src/components/settings/apiKeys/__tests__/McpConnectSnippets.test.tsx
    - frontend/src/components/admin/__tests__/CapabilityGrid.mcp.test.tsx
    - frontend/src/components/org/__tests__/OrgMcpSwitchCard.test.tsx
    - frontend/src/components/org/OrgApiKeysTab.test.tsx
    - frontend/src/components/settings/apiKeys/__tests__/McpOffNotice.test.tsx
decisions:
  - "resolveNginx keeps its string return (a projection of the new resolveNginxLocation) and Vercel headers come from a separate vercelHeadersFor, so every pre-307 toEqual assertion is unchanged"
  - "orgSwitchSub keeps 306's 'search, ask the agent and run workflows' and adds Claude.ai / Claude Desktop and 'with a personal key or by signing in' — the UI-SPEC's 'search and read' would have regressed 306 (a grant can carry the ask/run presets, D-13)"
  - "the desktop builder keeps the shared (mcpUrl, envVarName) signature and still refuses a non-variable name, but returns the URL only"
metrics:
  duration: "~1 h 45 min"
  completed: 2026-11-03
  tasks: 3
  files: 21
---

# Phase 307 Plan 04: OAuth discovery routing, consent anti-framing, operator parity and the sign-in snippet tab — Summary

The one-box nginx now passes `/.well-known/oauth-authorization-server/api`, `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-protected-resource` to the backend with the path unchanged and answers `/.well-known/openid-configuration` with a 404. The consent route `/app/connect/<id>` carries `frame-ancestors 'none'`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` on Vite dev, Vercel and nginx. The Phase 297 routing evaluator can now see all of this, including nginx's header loss on an internal redirect (F-10), and every new row has a negative control. The operator docs record the egress ranges, the CIMD probe, the migration 224 order and the rows still owed. The key screen's fourth tab is now "Claude.ai and Desktop": add a connector and sign in, with no key and no bridge.

## Commits

| Task | Gate | Commit | What |
|---|---|---|---|
| 1 | RED | `38131f269` | evaluator helpers (`resolveNginxLocation`, `vercelHeadersFor`), `oauthRouting.test.ts` (13 failing rows), consent literal row in the parity suite |
| 1 | GREEN | `2de370cd9` | nginx `.well-known` proxy + openid 404 + `/app/connect/` headers; vercel.json `headers`; `devHeadersFor` + vite middleware |
| 2 | — | `1590da1bb` | OPERATOR.md sign-in section; DEPLOYMENT-WORKFLOW parity rows + probes + OWED block; DEPLOYMENT-LESSONS C1 |
| 3 | RED | `b6f70e344` | snippet / tab / switch-sentence tests (22 failing across 7 files) |
| 3 | GREEN | `9f81575b7` | `desktopConnectorAddress`, `claudeCodeSignInCommand`, new tab, copy strings, CapabilityGrid data |

## Verification

- Routing: `vitest run src/__tests__/routing` + `docsVercelRouting` + `devRouting`: **7 files, 144 passed** (RED was 13 failed, all in `oauthRouting.test.ts`; the existing parity and docs rows stayed green under the helper change).
- Task 3 suites: `vitest run src/components/settings/apiKeys src/components/admin src/components/org`: **752 passed, 0 failed** (RED: 22 failed in 7 files, all the expected rows).
- tsc (`npx tsc -p tsconfig.app.json --noEmit`) set diff against base `3ad306b63`: **61 errors before, 61 after, no new error, none removed**. `tsconfig.node.json` (covers `vite.config.ts`): clean.
- `bash scripts/check-deploy-drift.sh`: exit 0 after Task 1 and after Task 2. `git diff --stat` of `deploy/onebox.env.example docker-compose.prod.yml backend/.env.example` is empty (D-32: no env var).
- Acceptance greps (all as specified): one `location ^~ /.well-known/oauth-`, one `openid-configuration`, one `location ^~ /app/connect/`, no `rewrite` inside the `.well-known` block; vercel.json has 0 `well-known` and 1 `frame-ancestors`; `devHeadersFor` in vite.config.ts; 7 "negative" mentions in oauthRouting.test.ts; no `mcp-remote|MCP_REMOTE_VERSION|desktopBridgeSnippet` in `apiKeys/*.ts(x)`; `Customize, then Connectors` = 1; `claude mcp add --transport http` in mcpSnippets.ts = 1; mcpKeyCopy.ts has 0 imports; the CapabilityGrid diff touches only `sub:` / `fallbackImpact:`.
- `frontend/src/main.tsx`, `frontend/src/lib/api.ts` and `SettingsPage.tsx`: not edited (D-40).
- DB-free: no added test line matches `asyncpg|get_pg_pool|psycopg|supabase-js|createClient(`. No test in this plan opened a DB connection.
- **nginx `-t` container probe: OWED to the operator, not run.** Docker is denied in this shell. It is recorded as an owed item in `docs/DEPLOYMENT-WORKFLOW.md` §6.
- Wave count gate (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, run once, from the worktree root, at `9f81575b7`): **`count gate OK — 597/597 pinned files present, no per-file decrease, 0 failing.`** (total 13763, pinned total 12714). Pins are floors, so the touched suites grew without a pin edit: appRouteParity +4, mcpSnippets +2, McpConnectSnippets +3. ⚠ The new `oauthRouting.test.ts` and `CapabilityGrid.oauthCopy.test.tsx` are **not pinned yet**, and an unpinned suite is an unguarded one. They need pins in `scripts/vitest-count-gate.cjs`, which is not in this plan's `files_modified`; I suggest 307-05 adds them with the phase's other gate and ledger rows.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Four sibling suites pinned the old switch sentences**
- **Found during:** Task 3.
- **Issue:** `CapabilityGrid.mcp.test.tsx`, `OrgMcpSwitchCard.test.tsx`, `OrgApiKeysTab.test.tsx` and `McpOffNotice.test.tsx` assert the exact 304/306 words of `mcp_enabled.sub`, `fallbackImpact`, `orgSwitchSub`, `orgSwitchImpact` and `offAdmin`. Changing those strings (the plan's D-21 behaviour) reds them. None of the four is in the plan's `files_modified`.
- **Fix:** I updated each literal to the new words in the RED commit, with a `307-04 (D-21)` note on each. No assertion was removed or weakened.
- **Commit:** `b6f70e344`.

**2. [Rule 2 - Correctness] The evaluator models nginx's header loss on an internal redirect (F-10)**
- **Found during:** Task 1.
- **Issue:** The plan asked the evaluator to record `add_header` per block. If a `try_files $uri /app.html` fallback were attributed to the matched location, the consent row would pass even with the broken config F-10 warns about.
- **Fix:** When no candidate is a file and the last argument is a URI, `resolveNginxLocation` re-matches it from the top and drops the original location's headers. A fifth negative control proves it: swap `try_files /app.html =404` for `try_files $uri /app.html` and the headers are gone.
- **Commit:** `38131f269`.

**3. [Decision, auto-taken] Helper shapes kept backward-compatible**
- The plan says `resolveNginx(path)` returns `{kind, target, headers}` and `resolveVercel` "also returns the matched headers". Doing that literally would break the `toEqual` assertions in `appRouteParity.test.ts` and `docsVercelRouting.test.ts`, which the plan says must "pass unedited in meaning".
- I added `resolveNginxLocation` (the structured outcome) and `vercelHeadersFor` beside the existing functions. `resolveNginx` is now a string projection: the served file, `=<code>` or `proxy:<upstream>`. Every pre-307 caller asserts on a served file, which is unchanged.

**4. [Decision, auto-taken] `orgSwitchSub` keeps 306's capability words**
- The UI-SPEC's new sentence ("…search and read as them…, with a personal key or by signing in") would have reverted the 306-05 rewording ("search, ask the agent and run workflows"). A grant can carry the ask/run presets (CONTEXT D-13).
- Shipped: "Members can let Claude.ai, Claude Desktop, Claude Code, Cursor or VS Code search, ask the agent and run workflows as them in {org}, with a personal key or by signing in."

**5. [Decision, auto-taken] Desktop copy follows the plan and research F-6, not the UI-SPEC draft**
- I used "open Customize, then Connectors" (not "Settings"), "Click Add, then Connect. …" and the firmer owner note "an owner adds the connector … first, then you choose Connect." The plan's behaviour list and D-52 govern here.

**6. [Addition] `claudeCodeSignInCommand` single-quotes an address that has a shell metacharacter**
- `safeMcpUrl` allows characters such as `;` in a path. A plain address prints bare, as the plan specifies. Anything outside `[A-Za-z0-9:/._~%+@=,-]` is single-quoted, which is pinned by a test.

## Known Stubs

None. The consent page itself (`/app/connect/<id>`) is built by 307-03, and this plan only routes and guards it.

## Threat Flags

None beyond the plan's threat model. T-307-05, T-307-07, T-307-20 and T-307-22 are mitigated and pinned by `oauthRouting.test.ts`. T-307-21 is transferred to the operator through the docs. T-293-21 holds: the new blocks are built from the URL alone.

## Notes for the orchestrator

- The ledger rows and sections for `frontend/nginx.conf`, `mcpKeyCopy.ts`, `mcpSnippets.ts`, `McpConnectSnippets.tsx` and `CapabilityGrid.tsx` are left to 307-05 Task 3, as the plan directs.
- `graphify update .` was not run in the worktree, so it does not dirty `graphify-out/`. Run it once after the merge.
- STATE.md and ROADMAP.md were not touched.

## TDD Gate Compliance

Task 1: RED `38131f269` came before GREEN `2de370cd9`. Task 3: RED `b6f70e344` came before GREEN `9f81575b7`. Both RED runs were confirmed failing before their commits: 13 and 22 failures respectively, all of them the new rows.

## Self-Check: PASSED

- The five commits are present in `git log 3ad306b63..HEAD`: `38131f269`, `2de370cd9`, `1590da1bb`, `b6f70e344` and `9f81575b7`.
- The created files exist: `frontend/src/__tests__/routing/oauthRouting.test.ts` and `frontend/src/components/admin/__tests__/CapabilityGrid.oauthCopy.test.tsx`.
- `git diff 3ad306b63 HEAD -- .planning/STATE.md .planning/ROADMAP.md` is empty.
