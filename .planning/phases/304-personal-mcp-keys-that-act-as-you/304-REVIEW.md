---
phase: 304-personal-mcp-keys-that-act-as-you
reviewed: 2026-10-31T00:00:00Z
depth: standard
diff_base: 4bc4a872f
head: d822f6607
independent_review: self
files_reviewed: 46
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/api_keys.py
  - backend/app/api/settings.py
  - backend/app/db/api_keys.py
  - backend/app/dependencies.py
  - backend/app/models/api_key.py
  - backend/app/models/user_settings.py
  - backend/app/security/acting_member.py
  - backend/app/security/acting_org.py
  - backend/app/security/api_key_auth.py
  - backend/app/security/mcp_principal.py
  - backend/app/security/principal_liveness.py
  - backend/app/services/acting_member_reads.py
  - backend/app/services/key_scope.py
  - backend/app/services/mcp_tool_catalogue.py
  - frontend/src/components/admin/CapabilityGrid.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/org/OrgAdminShell.tsx
  - frontend/src/components/org/OrgApiKeysTab.tsx
  - frontend/src/components/org/OrgAuditTab.tsx
  - frontend/src/components/org/OrgMcpSwitchCard.tsx
  - frontend/src/components/org/OrgSettingsTab.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyCard.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyDraftCard.tsx
  - frontend/src/components/settings/apiKeys/ApiKeyKindChoice.tsx
  - frontend/src/components/settings/apiKeys/ApiKeySecretOnce.tsx
  - frontend/src/components/settings/apiKeys/ApiKeysTab.tsx
  - frontend/src/components/settings/apiKeys/KeyFoldersField.tsx
  - frontend/src/components/settings/apiKeys/McpConnectSnippets.tsx
  - frontend/src/components/settings/apiKeys/McpKeyFields.tsx
  - frontend/src/components/settings/apiKeys/McpOffNotice.tsx
  - frontend/src/components/settings/apiKeys/RevokeApiKeySheet.tsx
  - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
  - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
  - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
  - frontend/src/components/settings/apiKeys/mcpKeyFacts.ts
  - frontend/src/components/settings/apiKeys/mcpSnippets.ts
  - frontend/src/lib/api/admin.ts
  - frontend/src/lib/api/apiKeys.ts
  - frontend/src/lib/api/skills.ts
  - scripts/check-migration-220-live.py
  - scripts/check-migration-221-live.py
  - scripts/explain-acting-org.py
  - scripts/full-schema-supplement.sql
  - supabase/migrations/220_api_keys_kind_and_mcp_switches.sql
  - supabase/migrations/221_acting_org_narrowing.sql
findings:
  critical: 0
  warning: 4
  info: 9
  total: 13
status: issues_found
---

# Phase 304: Code Review Report

**Reviewed:** 2026-10-31
**Depth:** standard (304's hunks, `git diff 4bc4a872f..HEAD`, plus the code they call)
**Files Reviewed:** 46
**Status:** issues_found

## Summary

I reviewed the key kind, the resolver extraction, the liveness predicate, the acting-org GUC, the narrowed reads, the routes, both switches, the key screen, the admin surfaces and migrations 220/221.

The authorization core holds up when traced end to end:

- **One resolver.** `authenticate_presented_key` is the only resolver. The kind is refused by prefix before any database read and again by the row's `kind` column. `resolve_api_key` maps every `KeyRefused` to the one 401.
- **Liveness reads live and fails closed.** `principal_still_allowed` runs on every resolution with no cache. A missing org row, a missing `app_settings('global')` row or a NULL switch all refuse, and a raised membership read propagates. The ban check fails open, but it sits after membership, as documented.
- **The GUC can only narrow.** It is bound as a parameter with `is_local=true`, only when the ContextVar is set, and the setter validates the value as a UUID first.
- **Every read the key path touches is narrowed.** I checked each RLS policy on `documents`, `folders`, `document_views`, `document_relationships`, `document_chunks` and `workflow_definitions` in `supabase/full-schema.sql`. Every SELECT arm goes through `current_user_org_ids()`, apart from the deliberate `is_system_global` arms. The retrieval RPCs (`match_document_chunks` and `keyword_search_chunks`, mig 205) gate on `current_user_org_ids()` and run on `_call_as_user`. That is `get_user_pg_connection`, so the ContextVar reaches them. `resolve_document_scope` step 2 also runs on `get_user_pg_connection`.
- **Mig 221 routes every direct `org_members` reader that matters.** The only remaining direct readers in the schema are `org_members_self_select`, the `model_rates_insert` role arm (now intersected) and the `autofill_org_id_by_owner` trigger, which runs on writes only and 304 makes no writes.
- **Grants are correct.** Mig 220 and 221 revoke from `PUBLIC` first, `key_hash` stays outside the column grant, and `organizations.mcp_enabled` stays outside the mig 194 UPDATE grant: table-level UPDATE was already revoked, as `full-schema.sql:11314-11316` shows.
- **The secret is shown once.** It lives only in `ApiKeysTab` state, and the snippet builders cannot take it as an argument.
- **The org switch never shows a guess.** `OrgMcpSwitchCard` waits for the server's answer before showing a value and shows no switch at all when the read fails.

Tests driven: `pytest tests/unit -q -k 304` gave **203 passed**. `npx vitest run --maxWorkers=2` over `settings/apiKeys`, `OrgMcpSwitchCard` and `CapabilityGrid.mcp` gave **17 files, 221 passed**. I did not run the live integration suites (`test_304_*_live.py`): they write to the local DB (worktree rule 4).

There are no blockers. There are four warnings:

1. Some reads ignore the `retrievable` rule that search honours.
2. A failed switch read is shown as "the operator switched it off".
3. The screen and the resolver disagree on which switch to name when both are off.
4. A narrowed key's `list_views` is not narrowed at all.

## Warnings

### WR-01: `read_document`, `related_documents` and `list_documents` ignore `documents.retrievable`, and are inconsistent with each other

**File:** `backend/app/services/acting_member_reads.py:175`, `:227`, `:373`, `:398-404`

**Issue:** Mig 205 makes `documents.retrievable` (`archived_at IS NULL AND source_state is live`) "the ONE home of 'may an agent read this document'". The rule is that archived and source-gone documents "leave EVERY agent read".

On the MCP path, an external AI tool is the agent:

- `search()` honours the rule, because the RPCs carry `AND d.retrievable`.
- `read_document` filters only `d.is_latest`. It returns the `full_markdown` of an archived document (removed by a retention policy) or of an `unauthorized_at_source` / `missing_at_source` document.
- `_page` (list and view documents) filters `archived_at IS NULL` but not `source_state`.
- `related_documents` filters neither, for the subject or for the endpoints.

So one key can list a document set that excludes archived documents and still read an archived document by id. Governance archive and "access revoked at the source" are bypassed for the AI-tool reader. Library parity (D-31) explains why `_page` matches the Library. It does not explain `read_document` disagreeing with both `_page` and search.

**Fix:** Pick one rule and apply it to all four reads. Recommended: the agent rule, which matches what search already does.

```python
# read_document / related_documents subject:
where = ["d.id = $1::uuid", "d.is_latest", "d.retrievable"] + _scope_clauses(scope, args)
# _page:
where = ["d.is_latest", "d.retrievable"]
# related_documents endpoint lateral: add "AND e.retrievable" inside the LATERAL
```

If Library parity is intended for `read_document`, record it as a D-NN and at least add `d.archived_at IS NULL`, so list and read agree. Pin either choice with an archived-document arm in `test_304_narrowed_key_live.py`.

### WR-02: A failed switch read is shown as "switched off for this deployment by the operator"

**File:** `backend/app/api/api_keys.py:133-160`, `:299`; `frontend/src/components/settings/apiKeys/apiKeyFacts.ts:163`

**Issue:** `_read_switches` swallows any exception and returns `None`. `_mcp_off(None)` then returns `"deployment"`. Every MCP key in the list is serialised with `mcp_off="deployment"`, and `_mcp_block` reports `off="deployment"`.

The card then renders `⏸ switched off` with `M.mcp.offDeployment` ("MCP access is switched off for this deployment by the operator…"). The kind tile is hidden. The member is told the operator did something, when what actually happened was a transient database error or a backend that booted before mig 220 reached its database.

Hiding the MCP choice is the right fail-closed behaviour. Asserting a fact the server never read is not. This is exactly the "UI shows a state the server did not confirm" class.

**Fix:** Keep the fail-closed availability, but carry "unknown" separately from "off".

```python
McpOff = Literal["org", "deployment", "unknown"]

def _mcp_off(switches):
    if switches is None:
        return "unknown"
    if switches.get("deploy_on") is not True:
        return "deployment"
    ...

def _mcp_block(switches):
    off = _mcp_off(switches)
    return McpAvailability(available=off not in ("deployment", "unknown"), off=off, ...)
```

On the frontend, map `"unknown"` to a sentence like "Couldn't check whether AI tool access is on. Reload to try again." instead of the operator sentence. Add a route test where `mcp_switches` raises, asserting `mcp_off == "unknown"`.

### WR-03: When both switches are off, the screen names the deployment and a refused call names the org

**File:** `backend/app/security/principal_liveness.py:74-78` vs `backend/app/api/api_keys.py:133-140`; claim at `frontend/src/components/settings/apiKeys/McpOffNotice.tsx:6-8`

**Issue:**

- `principal_still_allowed` checks the org switch first, so a refused call says "switched off for this organisation by an admin".
- `_mcp_off`, which drives every card, tile and header, checks the deployment first ("the deployment's wins").
- `McpOffNotice`'s docblock states that the screen and a refused tool call "say the same thing".

With both switches off, they say different things. The member sees "the operator switched it off" on the card, while their AI tool reports "an admin switched it off". The audit reason is `mcp_off_org`. Both messages are true, but they contradict the stated invariant and send the member to the wrong person.

**Fix:** Use one order. D-30 says the deployment wins for display, so check the deployment first in the predicate as well, and pin it with a both-off test.

```python
if switches is None or switches.get("deploy_on") is not True:   # deployment first
    return Refusal("mcp_off_deployment", MCP_OFF_DEPLOYMENT_SENTENCE)
if switches.get("org_on") is not True:
    return Refusal("mcp_off_org", MCP_OFF_ORG_SENTENCE)
```

A missing org row would then report the deployment sentence. Keep `switches is None` refusing first, under whichever reason you choose. Otherwise, if D-18's org-first order is binding, change `_mcp_off` to match it and correct the D-30 comment.

### WR-04: `list_views` is not narrowed by the key's folder scope

**File:** `backend/app/services/acting_member_reads.py:277-294`

**Issue:** Every other read composes `KeyScope`, but `list_views` does not. A key narrowed to one folder still lists every saved view the member owns in the org, with each view's `name`, full `filter_expr` and `folder_scope`. That includes folder ids outside the key's subtree, which the same key's `list_folders` deliberately hides (`:199-202`).

View names and filter expressions are free text the member wrote, for example `name = "Layoffs 2027"` or `filter_expr` conditions on a sensitive tag. D-22 says a narrowed key "sees only its ticked folders' subtrees". The documents behind each view are narrowed correctly by `view_documents`, but the view metadata is not.

**Fix:** For a narrowed key, list only views whose `folder_scope` falls in the key's subtree. A view with no folder scope is a judgment call; at minimum, mask `folder_scope` when it is outside the scope.

```python
async with _acting(principal) as (conn, scope, _folders):
    records = await conn.fetch(...)
...
if scope.folder_ids is not None:
    keep = set(scope.folder_ids)
    out = [v for v in out if v.get("folder_scope") is None or str(v["folder_scope"]) in keep]
```

Record the decision for unscoped views, and add a narrowed-key arm to `test_304_narrowed_key_live.py`.

## Info

### IN-01: The org admin sees the names of a member's private folders on MCP key cards

**File:** `backend/app/api/api_keys.py:244-249`, `backend/app/db/api_keys.py` (`folder_names`)

**Issue:** `folder_names` reads `folders` on the service pool, filtered only by `org_id`. `list_org_keys` therefore names every ticked folder, including folders private to the member, which the admin cannot otherwise see through RLS. This is small, but it is a visibility widening that D-02 does not state.

**Fix:** For the admin list, either name only folders the admin can see (read on the admin's own acting connection), or show "N folders". Otherwise, record it as intended.

### IN-02: The `wrong_kind` refusal is effectively unreachable, so a cross-kind attempt leaves no trace

**File:** `backend/app/security/api_key_auth.py:353`, `:369`

**Issue:** An `srl_mcp_` key at `/inbound` (or a `srl_live_` key at the MCP resolver) fails `digest_key`'s prefix check. That raises `KeyRefused("unknown")` before any lookup, so no audit row is written. The `kind`-column refusal at `:369`, which is the only audited `wrong_kind` path, can only fire on a row whose prefix and kind disagree. So the frontend copy `M.calls.wrongKind` and D-19's "attributable ones audited" never apply to the realistic case of a member pasting the wrong key into the wrong client.

**Fix:** Accept and document this, or, when the prefix belongs to the OTHER kind, digest and look the key up anyway so the refusal can be attributed. Never return a different 401 body.

### IN-03: Service-role clients are built on the event loop, one per call, in the narrowed reads

**File:** `backend/app/services/acting_member_reads.py:263`, `:348`

**Issue:** `get_service_role_supabase()` calls `create_client(...)` with no shared transport, inline in an async function. `set_org_mcp_access` (`api_keys.py:701`) treats the same construction as blocking and threadpools it. That is inconsistent with D-v2.5-01, and it creates a fresh httpx client per MCP search or view call.

**Fix:** `client = await run_in_threadpool(get_service_role_supabase, principal.org_id)`, or reuse one client per call path.

### IN-04: The Control Room's MCP readback can be stale, or guessed ON

**File:** `frontend/src/components/admin/ControlRoomPage.tsx:675`, `backend/app/api/settings.py:507`

**Issue:** Enforcement reads `app_settings.mcp_enabled` live. The grid's readback comes through `load_app_settings` (a 30 s per-worker cache; `save_app_settings` refreshes only the writing worker), and `?? true` shows ON when settings have not loaded. With `WORKER_COUNT=2`, a GET right after a flip can land on the other worker and show the old state. This is the same pre-existing pattern as the sibling flags, but for an access gate it is the most consequential one.

**Fix:** Out of scope for 304. Consider reading the switch live in `/settings`, or re-fetching from the worker that wrote it.

### IN-05: The `view_documents` step-1 proposal spans every org the member is in

**File:** `backend/app/services/acting_member_reads.py:345-350`; `backend/app/services/retrieval_scope.py` (`_resolve_caller_org_ids`)

**Issue:** Step 1 bounds candidates with `_resolve_caller_org_ids` on the service role, which ignores the acting-org GUC. Step 2 does decide on the narrowed connection, so nothing leaks. But other orgs' documents count toward `SearchTruncatedError` and can make an acting-org view fail. `ResolveError` and `SearchTruncatedError` also propagate uncaught out of `view_documents` to 305.

**Fix:** Pass the acting org into step 1 as an explicit bound (it can only narrow), and document the exceptions 305 must map.

### IN-06: A narrowed key whose ticked folders were all deleted shows no folder chip

**File:** `backend/app/api/api_keys.py:288-295`; `frontend/src/components/settings/apiKeys/apiKeyFacts.ts:137-142`

**Issue:** `folders` becomes `[]`, so `mcpScopeChips` returns `all: false` and no chips. The card shows only the tools chip, and nothing says this key can now reach nothing. The revoke sheet is honest ("0 folders"), but the card is not.

**Fix:** When `folders` is an empty list, render a chip such as "No folders left: this key reaches nothing".

### IN-07: The org switch audit is awaited inline and can drop silently

**File:** `backend/app/api/api_keys.py:701-708`

**Issue:** `write_audit_entry` swallows every failure. Its module docstring also says "never await directly in a request handler". So a flip can persist and return 200 with no `settings.update` row, an unaudited change to an access gate. Repeat writes of the same value each add a row.

**Fix:** Same posture as `api/org.py`, so this is not a regression. Consider recording a failure line, or writing the audit row inside the same asyncpg transaction as the UPDATE.

### IN-08: A synced subfolder under a ticked parent reads "included" while its connector-fed documents stay excluded

**File:** `frontend/src/components/settings/apiKeys/KeyFoldersField.tsx:149-151`

**Issue:** `r.included` takes precedence over `needsExternal`. A mail or synced child of a ticked folder therefore renders checked + "included" even with "Include mail and synced sources" off. The server correctly excludes it by document provenance, so the UI overstates the scope. This is copy only, not access.

**Fix:** When `f.source !== null && !external`, show the needs-external reason even if the row is included.

### IN-09: D-41 removes the tier gate for MCP key creation, and operator confirmation is still owed

**File:** `backend/app/api/api_keys.py:431-438`

**Issue:** This is a recorded decision, not a defect. TIER-02 is a pricing one-way door, and this must be confirmed before 304+305 deploy, as `STATE.md` records. I note it so it is not lost at deploy time.

**Fix:** Get operator confirmation. If the answer is no, the gate is one `enforce_entitlement` call inside `_create_mcp_key`.

---

_Reviewed: 2026-10-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
