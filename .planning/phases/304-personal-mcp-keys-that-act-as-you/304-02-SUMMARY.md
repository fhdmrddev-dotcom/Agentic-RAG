---
phase: 304-personal-mcp-keys-that-act-as-you
plan: 02
subsystem: auth
tags: [auth, api-keys, resolver, liveness, scope, tdd]
requires: []
provides:
  - authenticate_presented_key (one resolver core, both key kinds)
  - KeyRefused (typed refusal with reason + sentence)
  - principal_still_allowed / recheck_principal (the one liveness predicate)
  - McpPrincipal / resolve_mcp_principal
  - KeyScope / compose_key_scope / EXTERNAL_SQL / is_external
  - MCP_TOOLS / PRESETS / normalise_tool_selection / mcp_url / MCP_PATH
  - db/api_keys mcp_switches, set_org_mcp_enabled, get_key_row, folder_names
affects: [304-03, 304-04, 305, 306, 307, 308]
tech-stack:
  added: []
  patterns:
    - "pure-move extraction committed alone, then behaviour change"
    - "leaf liveness module calling dependencies by module attribute so existing monkeypatches drive it"
key-files:
  created:
    - backend/app/security/principal_liveness.py
    - backend/app/security/mcp_principal.py
    - backend/app/services/key_scope.py
    - backend/app/services/mcp_tool_catalogue.py
    - backend/tests/unit/test_304_resolver_kind.py
    - backend/tests/unit/test_304_principal_liveness.py
    - backend/tests/unit/test_304_api_keys_db.py
    - backend/tests/unit/test_304_key_scope.py
    - backend/tests/unit/test_304_tool_catalogue.py
  modified:
    - backend/app/security/api_key_auth.py
    - backend/app/db/api_keys.py
decisions:
  - "The core raises KeyRefused after _refuse has done its throttled audit; _refuse keeps its HTTPException return contract, so test_293_review_refusal_flood stays unedited."
  - "Unattributable refusals (wrong prefix, malformed, unknown key, digest mismatch) all carry reason 'unknown' and are never audited."
  - "get_key_row selects the client projection (_KEY_COLUMNS), not _AUTH_COLUMNS: nothing after authentication needs the digest."
  - "mcp_url() serves a loopback BACKEND_PUBLIC_URL as-is (no request to swap it for); pinned in test_304_tool_catalogue."
  - "A missing org row is refused as mcp_off_org; a NULL/missing app_settings switch as mcp_off_deployment (fail closed)."
metrics:
  duration: ~45 min
  completed: 2026-10-30
---

# Phase 304 Plan 02: The MCP credential core Summary

There is now one resolver core (`authenticate_presented_key`) for both workflow and MCP keys. A key used as the wrong kind is refused twice: once by its prefix and once by the `kind` column. The core raises a typed `KeyRefused`. One leaf, `principal_still_allowed`, checks every liveness fact live and in D-18 order, and it fails closed on the MCP switches. On top of that sit a frozen `McpPrincipal`, a pure `KeyScope` that keeps "not narrowed" (`None`) apart from "nothing" (`()`), and the eight-tool catalogue plus `mcp_url()`. All of it was built test-first with fakes only; nothing touched the database.

## Start state

- Worktree came up on `4bc4a872f` (master). Its merge-base differed from the requested base, so it was reset to `fc98a7d23b2bdc77ea4c71294bbb29de2871c4a3` (develop, "docs(304): create phase plan") before any work.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `461c4de56` | refactor(304-02): extract authenticate_presented_key, pure move (D-17) |
| 2 | `706837684` | test(304-02): add failing tests for the mcp key kind, liveness predicate and db reads (RED) |
| 3 | `c7e2bd743` | feat(304-02): one resolver core for both key kinds, the liveness predicate and McpPrincipal (GREEN) |
| 4 | `6be541559` | test(304-02): add failing tests for KeyScope and the MCP tool catalogue (RED) |
| 5 | `54e7693bb` | feat(304-02): pure KeyScope composition and the MCP tool catalogue + mcp_url (GREEN) |

**Pure-move evidence (commit 1, `461c4de56`):** `git diff --name-only 461c4de56~1 461c4de56` lists only `backend/app/security/api_key_auth.py` (+7 / -1). `resolve_api_key`'s parameter list is byte-identical. The only other change is that `call = _call_kind(request)` now runs before the lookup instead of after the compare, and it is a pure function of the request method. All 19 `test_293_*.py` suites passed unedited (285 passed) before the commit.

## What was built

- **`api_key_auth.py`** adds:
  - `MCP_KEY_PREFIX = "srl_mcp_"` and a per-kind prefix map.
  - `mint_key(kind)` and `digest_key(presented, *, kind)`. The defaults are unchanged: `srl_live_` with a 13-char prefix. An MCP key gets a 12-char prefix.
  - `KeyRefused(reason, sentence)`.
  - Four defaulted `ResolvedKey` fields: `kind`, `folder_ids`, `tools`, `include_external`.
  - `authenticate_presented_key(..., expected_kind)`, which runs: prefix check → lookup → constant-time compare → `kind` column (`wrong_kind`, audited) → `principal_still_allowed` (attributable, through the throttled `_refuse`) → `touch_last_used`.
  - `resolve_api_key`, which catches every `KeyRefused` and returns the one byte-identical 401.
  - `metadata.kind = "mcp"` in audit rows for MCP keys only. A workflow key's audit metadata is byte-identical to before.
  - The `deps` and `timezone` imports were unused after the move and are removed.
- **`security/principal_liveness.py`** is the leaf with `Refusal`, `principal_still_allowed`, `recheck_principal` (which re-reads the row by id and org; a vanished row counts as `revoked`) and the two switch sentences.
  - It never imports the key module and never reads the app-settings cache.
  - It calls `api_keys_db.is_org_member`, `deps._is_banned` and `api_keys_db.mcp_switches` by module attribute.
- **`security/mcp_principal.py`** holds the frozen `McpPrincipal` (with `credential_kind='key'`) and `resolve_mcp_principal`, which runs with `expected_kind="mcp"` and `call="read"`.
- **`db/api_keys.py`**:
  - `_KEY_COLUMN_NAMES` gains `kind, folder_ids, tools, include_external`.
  - `create_api_key` gains `kind / folder_ids / tools / include_external` keyword arguments, bound as plain lists. The 293 call shape is unchanged.
  - New reads: `get_key_row` (`id = $1 AND org_id = $2`), `mcp_switches` (one SELECT: `org_on`, `deploy_on` from `app_settings('global')`, `org_name`), `set_org_mcp_enabled` and `folder_names`.
- **`services/key_scope.py`** contains:
  - `KeyScope` and `compose_key_scope`, which resolves per-call visible subtrees with a visited set. A ticked folder that is no longer visible is dropped. If every ticked folder is dropped the scope is `()`, never `None`.
  - `EXTERNAL_COLUMN`, `EXTERNAL_SQL` and `is_external` (D-40).
- **`services/mcp_tool_catalogue.py`** contains:
  - `MCP_TOOLS`: the eight D-11 tools with their groups, labels and `travels_with`.
  - `MCP_TOOL_NAMES`.
  - `PRESETS` read / ask / run, with `DEFAULT_PRESET = "read"`.
  - `normalise_tool_selection`, which adds companions in catalogue order and refuses an empty selection, an unknown name or an orphaned companion with a plain sentence.
  - `MCP_PATH = "/mcp"` and `mcp_url()`.

## Verification

- `pytest tests/unit/test_304_*.py tests/unit/test_293_*.py -q`: **388 passed**. Also green: `test_296_kickoff_and_keys`, `test_298_foreign_binding` and `test_298_org_matrix` (69 passed).
- Acceptance greps:
  - core + wrapper definitions in `backend/app` = **2**.
  - `load_app_settings` / `api_key_auth` in `principal_liveness.py` = **0 / 0**.
  - `get_current_user` (non-comment) in `api_key_auth.py` = **0**.
  - json import in `db/api_keys.py` = **0**.
  - `app.` imports in `key_scope.py` = **0**.
  - `if .* else None|or None` in `key_scope.py` = **0**.
- **Backend baseline** (taken under the noclobber local-DB lock, which was released afterwards):

  `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).`

  Summary: `70 failed, 10847 passed, 1 skipped, 2 xfailed, 2 xpassed`.

  **Re-derived at base (D-43):** I restored the base versions of the two modified modules (`git checkout fc98a7d23 -- api_key_auth.py db/api_keys.py`), re-ran the 23 failing files, and got **70 failures with the identical test-name set**. The only diff line was a RuntimeWarning that stdout had glued onto one test name. Then I restored HEAD. **No new failure: every one of the 70 is inherited.**

## TDD Gate Compliance

- Task 2: RED `706837684` (2 collection errors plus 17 failures) → GREEN `c7e2bd743`.
- Task 3: RED `6be541559` (2 collection errors) → GREEN `54e7693bb`.
- No REFACTOR commits were needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two arithmetic / over-strict assertions in my own RED suites**
- **Found during:** Task 2 GREEN.
- **Issue 1:** `test_each_check_is_read_live_between_two_calls` expected 4 switch reads. The `not_member` call stops before the switches, so the correct count is 3.
- **Issue 2:** `test_there_is_no_json_import` banned the substring `json.dumps`, but the module docblock names that trap on purpose.
- **Fix:** the count is now 3 with the reason stated, and the fence now matches the call `json\.dumps\(`. Both corrections were committed in the GREEN commit and named in its message.
- **Commit:** `c7e2bd743`

**2. [Rule 2 - Security] `get_key_row` selects `_KEY_COLUMNS`, not `_AUTH_COLUMNS`**
- **Issue:** The plan text said `_AUTH_COLUMNS`, which carries `key_hash`. The liveness re-read never needs the digest.
- **Fix:** I used the client projection, which still carries every liveness fact. The test pins that the SQL has no `key_hash`.
- **Commit:** `c7e2bd743`

## Notes for downstream plans

- ⚠ **Deploy ordering.** `_KEY_COLUMN_NAMES` now names the four migration-220 columns, so every `api_keys` list, create and revoke statement requires mig 220 on the DB it runs against. `mcp_switches` requires mig 221's `organizations.mcp_enabled` and `app_settings.mcp_enabled` columns. 304-01 owns both migrations, and they must be applied locally before the backend serves key routes.
- `api_keys_contract.json`, `ApiKeyRead` and `_serialize_keys` are not touched here. `response_model` silently drops the extra columns until 304-04 moves the three-place lockstep.
- `folder_names` scopes by `org_id = $1`. A ticked global folder from another org would therefore not get a display name; 304-04 should decide whether that case matters.

## Known Stubs

None.

## Threat Flags

None. The new surface (the mcp kind, the switch reads and the switch UPDATE) is all inside the plan's threat register: T-304-12, 13, 14, 15, 16, 17, 18 and 19 are each mitigated and tested.

## Self-Check: PASSED

- All 4 created modules and 5 test suites exist.
- Commits `461c4de56`, `706837684`, `c7e2bd743`, `6be541559` and `54e7693bb` are present in `git log`.
- STATE.md and ROADMAP.md were not modified.
