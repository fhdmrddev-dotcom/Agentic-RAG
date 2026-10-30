---
phase: 304-personal-mcp-keys-that-act-as-you
plan: 04
subsystem: api
tags: [api, api-keys, settings, kill-switch, wire-contract, tdd]
requires:
  - 304-01 (acting_member_connection, list_acting_folders, migrations 220/221)
  - 304-02 (mint_key(kind), create_api_key kind kwargs, mcp_switches, set_org_mcp_enabled, folder_names, mcp_tool_catalogue, principal_liveness sentences)
provides:
  - "POST /api-keys with a kind-tagged body (no kind = the 293 workflow key)"
  - "ApiKeyList.mcp {available, off, url, tools} on GET /api-keys and GET /org/api-keys"
  - "ApiKeyRead MCP fields: kind, tools, folders, include_external, org_name, mcp_off"
  - "GET /api-keys/folders (pickable folders on the member's own acting visibility)"
  - "GET/PUT /org/api-keys/mcp-access (org switch, audited settings.update + event mcp_access)"
  - "mcp_enabled operator flag (PUT /admin/flags) + GET /settings readback"
  - "frontend: TS mirrors + listPickableFolders, getOrgMcpAccess, setOrgMcpAccess; FlagKey mcp_enabled"
affects: [304-05, 304-06, 305]
tech-stack:
  added: []
  patterns:
    - "callable Discriminator union body: a missing tag defaults to the legacy model, so old bodies stay byte-identical"
    - "display-only switch read fails closed (hidden), the create path reads it unguarded (an error, never a mint)"
key-files:
  created:
    - backend/tests/unit/test_304_api_keys_routes.py
    - backend/tests/unit/test_304_mcp_switches_routes.py
  modified:
    - backend/app/models/api_key.py
    - backend/app/api/api_keys.py
    - backend/app/api/admin.py
    - backend/app/api/settings.py
    - backend/app/models/user_settings.py
    - backend/tests/fixtures/phase293/api_keys_contract.json
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/lib/api/apiKeys.ts
    - frontend/src/lib/api/admin.ts
    - frontend/src/lib/api/skills.ts
    - frontend/src/components/settings/apiKeys/__tests__/apiKeysContract.test.ts
    - frontend/src/components/settings/apiKeys/__tests__/fixtures.ts
    - frontend/src/components/settings/apiKeys/__tests__/apiKeyFacts.test.ts
decisions:
  - "D-41 owed: operator confirms no tier gate on MCP keys before 304+305 deploy (TIER-02, a pricing one-way door). The workflows capability check now runs inside create_key for kind='workflow' only."
  - "The create body is a tagged union (callable Discriminator). A body with no kind is the 293 workflow model, so every 293 422 sentence is unchanged; kind='workflow' may also be sent explicitly."
  - "The 409 label sentence was already kind-neutral ('an active key called X'), so it is kept byte-identical and shared by both kinds."
  - "On a list, a failed switch read reads as off (available=false, off='deployment', fail closed) and the keys still list. The create path reads the switches unguarded, so a failed read there is a 500, never a mint."
  - "The contract fixture and the TS mirrors moved into Task 1's GREEN commit (not Task 2), because Task 1's own response fields made test_293's contract pin red. That keeps checker W-3's rule (fixture and mirrors in ONE commit) and Task 1's verify green."
  - "ApiKeyList.mcp and FullAppSettings.mcp_enabled are optional in TS only. The server always sends both. Pre-304 test literals (OrgApiKeysTab.test.tsx, three SettingsPage tests) build those types without them, and those files are outside this plan."
metrics:
  duration: ~1h 50m
  completed: 2026-10-31
  tasks: 2
  files: 16
---

# Phase 304 Plan 04: MCP keys on the 293 routes, both switches over HTTP Summary

MCP keys now use the 293 key routes. Mint, list and revoke all carry a `kind`. Every MCP refusal happens on the server and is written in plain words: an expiry is required, at least one tool must be ticked, an empty folder list is refused, an unknown or orphaned tool is refused, and a folder the member cannot see in the active org is refused. Folders are judged on the member's own acting connection, never the service role.

The key list serves the tool catalogue, the MCP URL and the state of both switches, so the client never retypes them. An org admin can flip the org switch, which writes a `settings.update` audit row with `event: mcp_access`. The operator flag `mcp_enabled` is also live. The wire contract is pinned on both sides.

## Start state

- The worktree came up on `4bc4a872f` (master). Its merge-base was not the requested base, so after the HEAD-namespace assertion it was reset to `dadc7008ab3528c54c55c88abe6c289c6ade2cd1` (develop, wave 1 merged) before any work.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `34bc28fb8` | test(304-04): add failing tests for kind on the 293 key routes (RED) |
| 2 | `3b1cc27a1` | feat(304-04): kind on the 293 key routes, MCP refusals server-side, wire contract + TS mirrors (GREEN) |
| 3 | `dbafe37d3` | test(304-04): add failing tests for both MCP switches over HTTP and the three client calls (RED) |
| 4 | `18796b830` | feat(304-04): both MCP switches over HTTP, the three client calls, OpenAPI snapshot (GREEN) |
| 5 | `189bc51e2` | fix(304-04): mcp_enabled readback tolerates settings stubs that predate the field |

## What was built

### Task 1: `kind` on the 293 routes

- **`models/api_key.py`**
  - `ApiKeyCreateRequest` is a callable-`Discriminator` union. A body with no `kind` is tagged `workflow`. An unknown kind, or a non-string kind, is a 422.
  - `ApiKeyCreateBody` gains `kind: Literal["workflow"] = "workflow"` and is otherwise byte-identical.
  - `McpKeyCreateBody` uses `extra="forbid"`, so `workflow_ids` is refused. It has bounded `tools` and `folder_ids`, and two model-level sentences: the D-07 expiry sentence (via a before-validator, so `null` gets the sentence rather than Pydantic's message) and the D-08 empty-folders sentence.
  - New models: `McpToolRef`, `McpAvailability`, `ApiKeyFolderRef`, `PickableFolder(List)`, `OrgMcpAccess(Update)`.
  - `ApiKeyRead` gains six defaulted fields. `ApiKeyList` gains `mcp`.
- **`api/api_keys.py`**
  - The route-level `require_capability` is gone. `create_key` calls `enforce_entitlement(pool, active_org, "workflows")` only for workflow keys (D-41), so a non-entitled org still gets the same 403 for a workflow key.
  - The MCP path runs in this order:
    1. Read `mcp_switches` live. If the deployment is off, return a 403 with the deployment sentence (it wins over the org sentence). If the org is off, return a 403 with the org sentence.
    2. Run `normalise_tool_selection`. A refusal returns a 422 with its sentence.
    3. If folders were picked, validate them with `acting_member_connection(user_id=caller, org_id=active_org)` and `list_acting_folders`. A foreign, deleted or unknown folder all get the same 422: "One of the picked folders can't be found, or you can't see it."
    4. Mint with `mint_key(kind="mcp")` and store with `create_api_key(kind="mcp", workflows=[], tools=normalised, folder_ids=[str] | None, ...)`.
    5. Write the `api_key.create` audit row with `metadata.kind = "mcp"`.
  - `_serialize_keys` adds the MCP fields. It makes one `mcp_switches` read per list call, and folder names come from a single `folder_names` read. A ticked folder that has since been deleted drops off the card.
  - Revoke audits (member and admin) carry `kind`, so MCP rows say `mcp`. Workflow audit metadata is byte-identical to 293.
  - `GET /api-keys` and `GET /org/api-keys` both serve the `mcp` block.
  - New `GET /api-keys/folders` reads on the acting connection. `shared` means org-shared or not owned. `source` is the D-40 hint, built from one SQL statement on the same connection:
    - `synced`: a `connector_watches.library_folder_id`, or a folder holding a document matching `EXTERNAL_SQL`.
    - `mail`: a watch on the mailbox root or a `mailbox:` label, or a connector-fed `message/rfc822` document.

### Task 2: both switches, the client mirrors, OpenAPI

- **Org switch:** `GET/PUT /org/api-keys/mcp-access` on the existing `org_router`, behind `require_org_manage` and the active org.
  - PUT calls `set_org_mcp_enabled`. After that write returns, it writes exactly one `write_audit_entry(action_type="settings.update", metadata={"event": "mcp_access", "enabled": v}, org_id=<active org>)`. The service-role client for it is built in `run_in_threadpool`.
  - A failed write is a 500 with no audit row. A missing org is a 404 with no audit row. An extra body field is a 422.
  - No new audit literal; `audit_service.py` is untouched.
- **Operator switch:**
  - `admin.py`: one dict entry, `"mcp_enabled": "MCP access"`.
  - `user_settings.py`: the field plus its `_val_bool` readback, defaulting to true (2 lines).
  - `settings.py`: the response field plus its readback (2 lines).
  - Not a seed and not an env var; `check-deploy-drift.sh` is untouched.
- **Frontend:**
  - `lib/api/apiKeys.ts` adds `listPickableFolders(signal)`, `getOrgMcpAccess(signal)` and `setOrgMcpAccess(enabled)`, all in the `listOrgApiKeys` shape and throwing `ApiError(readApiKeyFailure(res), status)`.
  - `FlagKey` gains `"mcp_enabled"`.
  - `FullAppSettings` gains `mcp_enabled`.
  - `lib/api.ts` is untouched.
- **OpenAPI:** regenerated with `scripts/export-openapi.py` followed by `node scripts/build-public-openapi.cjs` (272 paths). Both new paths fall under the already-public `api-keys` tag, and the script asked for no flagging.

## Verification

- `pytest tests/unit/test_304_api_keys_routes.py tests/unit/test_304_mcp_switches_routes.py tests/unit/test_293_api_keys_routes.py tests/unit/test_276_openapi_snapshot_fresh.py`: **88 passed**. Adding `test_settings.py` and `test_294_settings_engine_allowlist.py` after the fix brings the total to 126 passed.
- Every `test_293_*` and `test_304_*` unit suite: **469 passed** after Task 1, with no 293 test file edited.
- Neighbouring suites also pass:
  - 258 tier-gate audit, 296 keys, 298 org matrix/foreign binding, 299 links: 146 passed, 1 skipped.
  - 147 and 159 flag tests, plus 293 rate-limit, 241 and 292.1 settings readbacks: 117 passed.
- `vitest run src/components/settings/apiKeys src/components/org/OrgApiKeysTab.test.tsx src/docs/__tests__/publicOpenapi.test.ts` (`GSD_VITEST_MAX_WORKERS=2`): 116 passed, 1 failed. The failure is inherited (see below). `apiKeysContract.test.ts` passes 8/8.
- `npx tsc -p tsconfig.app.json --noEmit` set diff against the base: **empty**. There are 53 errors before and 53 after. The one line that differs textually is the inherited `SettingsPage.test.tsx` TS2322, whose message counts properties ("62 more" became "63 more"). It is the same error at the same location.
- `node scripts/check-hot-file-ledger.cjs` for this phase: **OK**.
- **Live read-only probe** (local DB, SELECT only): the pickable-folders read plus the hint SQL on a real acting connection returned 32 visible folders and 6 hint rows (1 mail). Every hint folder is inside the visible set, and execution took 0.48 ms.
- Acceptance greps:
  - `require_capability` route dependency count: 0.
  - `enforce_entitlement(`: 1.
  - `fetch_visible_folders`: 0.
  - `list_acting_folders(`: 2.
  - The D-08 sentence: 1, in `models/api_key.py`.
  - `"mcp_enabled": "MCP access"`: 1.
  - numstat for `admin.py`, `settings.py` and `user_settings.py`: 1, 2 and 2 added lines.
  - `audit_service.py`, `api/org.py`, `main.py` and `lib/api.ts` are not in the diff.

### Backend baseline (checker W-2)

This was run under the shared noclobber local-DB lock, which was taken after 304-03 released it and was released afterwards.

**First run: `[GATE FAILED]` 74 failed.**
- Four of the failures were this plan's: `test_settings.py` ×3 and `test_294_settings_engine_allowlist::test_get_settings_body_never_carries_a_key`.
- They were driven at base: I restored the base versions of the five modified backend modules and re-ran the suspect files. Those four passed, and the other 12 failures in those files failed identically. HEAD was then restored.
- **Cause:** those suites hand `_build_response` a `SimpleNamespace` settings stub with no `mcp_enabled` attribute.
- **Fix:** `getattr(s, "mcp_enabled", True)`, the `harness_authoring_model` idiom on the line beside it (commit `189bc51e2`). `settings.py` is still +2 lines.

**Second run, verbatim:**
```
Summary:        70 failed, 10940 passed, 1 skipped, 2 xfailed, 2 xpassed, 63 warnings in 548.36s (0:09:08)
[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).
```
That is **70, equal to the pre-wave-2 base (D-43)**, with no new failure. The failure set is the first run's set minus exactly those four, with nothing added.

## TDD Gate Compliance

- Task 1: RED `34bc28fb8` (1 failed, 43 errors) → GREEN `3b1cc27a1`.
- Task 2: RED `dbafe37d3` (backend: 5 failed, 9 errors; vitest: 4 failed) → GREEN `18796b830`.
- No REFACTOR commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The contract fixture and the TS mirrors landed in Task 1, not Task 2**
- **Found during:** Task 1 GREEN.
- **Issue:** The plan's W-3 resolution assumed Task 1 would not change the contract. But Task 1 adds response fields, so `test_293_api_keys_routes`'s path-set pin (`test_create_returns...`, `test_list_matches...`) went red, and Task 1's verify could not pass.
- **Fix:** The fixture, `apiKeys.ts` types, `apiKeysContract.test.ts` and `fixtures.ts` were committed together in Task 1's GREEN commit. That is still ONE commit for fixture and mirrors, as W-3 requires. Task 2 added the three calls and the client test.
- **Commit:** `3b1cc27a1`

**2. [Rule 3 - Blocking] `apiKeyFacts.test.ts` builder gained the six MCP fields**
- **Issue:** This test's local `key()` builder returns a full `ApiKeyRead` literal, so the required new fields caused a new tsc error.
- **Fix:** Added six lines. The file is in 304-05's list, but 304-05 is wave 3 and runs after this merge, so there is no parallel conflict.
- **Commit:** `3b1cc27a1`

**3. [Rule 3 - Blocking] Two TS fields are optional**
- `ApiKeyList.mcp?` would otherwise break `OrgApiKeysTab.test.tsx`, which 304-06 owns.
- `FullAppSettings.mcp_enabled?` would otherwise break three SettingsPage test literals.
- The server always sends both. Each is commented with "read it as `?? true`", which matches 304-06's planned `settings?.mcp_enabled ?? true`.

**4. [Rule 2 - Security] Bounded MCP body sizes**
- `tools` is capped at 32 items of 64 characters each, and `folder_ids` at 500. Without the cap, an unbounded tool name would be echoed back in the unknown-tool sentence.

**5. [Rule 1 - Bug] The `mcp_enabled` settings readback broke four existing suites**
- Found by the full baseline (74 failed) and driven at base.
- Fix: `getattr(s, "mcp_enabled", True)`, in commit `189bc51e2`. The second baseline run measured 70.

**6. [Rule 2 - Correctness] The list's switch read fails closed instead of erroring**
- A failed `mcp_switches` read on a list now hides MCP (`available: false`) and the keys still list. One real case is a backend that boots before migration 221 reaches its database.
- The read is logged at warning level. The create path stays unguarded.

## Inherited (not this plan's)

- **`apiKeyFacts.test.ts > every refusal reason the backend audits has words, never the raw code`** fails with `wrong_kind: '✕ refused: wrong_kind'`.
  - The test scans `backend/app/security/api_key_auth.py?raw` for reasons, and 304-02 added `wrong_kind`, `mcp_off_org` and `mcp_off_deployment`.
  - Its inputs (`api_key_auth.py`, `apiKeyFacts.ts`) are byte-unchanged by this plan (`git diff --stat dadc7008 --` on them is empty), so it is red at base.
  - **Owner: 304-05**, which edits `apiKeyFacts.ts` and needs to give those three reasons words.

## Owed

- **D-41 owed: the operator confirms there is no tier gate on MCP keys before the 304+305 deploy** (TIER-02, a pricing one-way door). Reversing it is one condition in `create_key`. Carry this into STATE.md.
- `graphify update .` was not run inside the worktree. It would rewrite tracked graph files beside a parallel agent, so it should run once in main after the merge.

## Known Stubs

None. Every new field is wired from a live read: switches, folder names, the catalogue and `mcp_url()`.

## Threat Flags

None outside the register. T-304-28 through T-304-35 are mitigated and tested, and T-304-36 (D-41) is accepted and owed. `GET /api-keys/folders` is new surface. It is covered by T-304-28: it reads the member's own visibility on the acting connection and nothing else.

## Self-Check: PASSED

- Both created suites and all 14 modified files appear in `git diff --name-only dadc7008..HEAD`, which lists 16 files.
- Commits `34bc28fb8`, `3b1cc27a1`, `dbafe37d3`, `18796b830` and `189bc51e2` are present in `git log`.
- STATE.md and ROADMAP.md are not modified. The local-DB lock was released after the baseline.
