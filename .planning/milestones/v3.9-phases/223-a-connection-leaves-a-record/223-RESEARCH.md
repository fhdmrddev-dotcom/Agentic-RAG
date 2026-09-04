# Phase 223: A Connection Leaves a Record - Research

**Researched:** 2026-09-02
**Domain:** Connector Execution Audit Ledger, Grant Receipts, Armed Connector Durability, Honest Timeout Copy
**Status:** Complete

---

## 1. Executive Summary & Findings

Phase 223 addresses four defects discovered during the 2026-09-02 live UAT drive where `GRANT-05` ("every outbound call made through a connection appears in the audit ledger") was provably unmet:
1. `tool_dispatcher.py` audited only internal tools (`search.query`, `skill.load`, `code.execute`, `memory.remember`, `memory.recall`). External calls to Google, Notion, GitHub, etc. left zero audit records (`BUG-260902-05`).
2. `public.messages` stored no `active_connector_ids`. The client maintained selection only in an in-memory module Map (`activeConnectorsByThread`), which vanished on reload (`BUG-260902-03`).
3. Tool approval timeouts returned a factually neutral string with no recovery advice, causing the LLM to invent nonexistent workspace panels and advise re-authorizing healthy connections (`BUG-260902-04` copy half).
4. Clicking "Always allow" on the chat approval card updated database grants but wrote zero audit receipts.

---

## 2. Deep Dive & Architectural Constraints

### 2.1 Audit Mechanism & Silent Failure Inversion (`SC#1`, `SC#5`)
- `write_audit_entry(user_id, action_type, metadata, supabase, org_id)` in `backend/app/services/audit_service.py` catches all exceptions and swallows them (`logger.error(...)`).
- A call with an `action_type` not allowed by Postgres CHECK constraint `audit_log_action_type_check` fails with Postgres error code `23514` (check_violation), which is swallowed silently.
- `assert_action_types_synced(pool)` (called at application startup in `main.py:395`) asserts that `VALID_ACTION_TYPES` in `audit_service.py` is a subset of the live database CHECK constraint.
- `backend/tests/test_110_boot_guard.py` enforces that `VALID_ACTION_TYPES` matches a hardcoded literal `_ALL_19`.
- **Lockstep Requirement**: Migration 152, `VALID_ACTION_TYPES` in `audit_service.py`, and `_ALL_19` → `_ALL_21` in `test_110_boot_guard.py` must land in the same commit to prevent boot crashes or silent swallows.

### 2.2 Dispatcher Execution & Exit Points (`tool_dispatcher.py`)
`_handle_connector_chat_tool(service_id, action_tool_name, args, ctx)` spans lines 4322–4605. It has 9 exit points:
- **Five Action Outcomes Audited**:
  1. Line 4401 (`posture == "deny"`): Audit `outcome="policy_denial"`, `failure_reason="Denied by tool posture policy"`.
  2. Line 4445 (`decision != "allow"`): Audit `outcome="user_rejected"`, `failure_reason="User rejected execution"`.
  3. Line 4452 (`asyncio.TimeoutError`): Audit `outcome="timeout"`, `failure_reason="Approval request timed out after 120s"`.
  4. Line 4585 (`failure is not None`): Audit `outcome="execution_failure"`, `failure_reason=failure`.
  5. Line 4605 (Success): Audit `outcome="success"`, `failure_reason=None`.
- **Four Precondition Exits Excluded**:
  - Line 4337 (No authenticated user): Genuinely un-auditable because `audit_log.user_id` is `NOT NULL`. Logged as warning.
  - Line 4351 (`scope.ok` False): Precondition failure resolving user org.
  - Line 4372 (`list_connections` failure): Internal database lookup error.
  - Line 4388 (`matched_conn` not found): Missing connection configuration.

### 2.3 Argument Privacy (G-6 / SEED-223)
- Verbatim tool arguments (`args`) often contain emails, search queries, contact bodies, or sensitive documents.
- In compliance with D-213-14 and SEED-223, `audit_log.metadata` must store only `arg_keys: list[str]` (e.g. `["query", "limit"]`), never argument values.

### 2.4 "Always allow" vs Settings Grant Primitives (`SC#1a`)
- Chat card "Always allow": Invokes `POST /threads/{id}/tool-approval` with `decision: "always"`. Handled in `api/threads.py:1528` calling `connector_service.grant_one_tool` (read-merge-write). Actor `current_user["id"]` and `scope.org_id` are in scope and must be passed to write an audit record with `action_type="connector.grant"`, `source="chat_card"`.
- Settings form: Invokes `PATCH /connectors/connections/{id}/grants`. Handled in `api/connectors.py:1333` calling `connector_service.update_connection_grants` (full-column replace). Actor `current_user.id` and `org_id` are in scope and must be passed to write an audit record with `action_type="connector.grant"`, `source="settings"`.

### 2.5 Armed Connectors Durability & State Honesty (`SC#2`)
- **Database Storage**: Migration 152 adds `active_connector_ids jsonb` to `public.messages`.
- **Semantic Distinction**:
  - `NULL`: Absent / legacy message.
  - `'[]'::jsonb`: Explicitly turned off / empty.
  - `'["uuid", ...]'::jsonb`: Active connector IDs.
- **Client Restoration Contract (Operator Ratified)**:
  - Restore check MUST use `activeConnectorsByThread.has(draftKey)`.
  - A value check or falsy check (`activeConnectorsByThread.get(draftKey) || fallback`) treats `[]` as absent, re-arming connectors the user deliberately turned off.
  - When `!has(draftKey)` (initial page load / reload):
    - Query or inspect the thread's messages for the **last USER message** (`role === 'user'`). Assistant messages carry no armed set and must not be used as the anchor.
    - If last user message has `activeConnectorIds` (whether `[]` or `["id1", ...]`), set `activeConnectorsByThread.set(draftKey, ids)` and `setActiveConnectorIds(ids)`.
    - If last user message has `null`/`undefined` (legacy message), default to `[]`.

### 2.6 Truthful Timeout Vocabulary (`SC#3`)
- The timeout path knows only that no human answered within 120s. It has not probed the connection.
- Removing hallucination-inducing omission without introducing unverified health reassurance:
  - **Timeout payload**: `"Tool execution '{action_tool_name}' on {matched_conn.name} timed out waiting for human approval in the chat. Nobody answered in time. Do not advise the user to check a workspace panel or re-authenticate; if the user still wants this action, ask them in this chat if they would like to try again."`
  - **Rejection payload**: `"User rejected execution of tool '{action_tool_name}' on {matched_conn.name}. Do not retry this action unless explicitly requested by the user."`

---

## 3. Hot-Files & Blast Radius (G-5)

| File | Commits | Phases | Lines | Role |
|------|---------|--------|-------|------|
| `backend/app/services/tool_dispatcher.py` | 76 | 31 | 4,643 | G-5 Hot File — Audit instrumentation at 5 exit points, timeout/rejection payloads |
| `backend/app/api/threads.py` | 238 | 78 | 1,408 | G-5 Hot File — Persist `active_connector_ids` in `send_message`, audit `grant_one_tool` |
| `backend/app/services/audit_service.py` | 14 | 8 | 88 | Add `connector.call` and `connector.grant` to `VALID_ACTION_TYPES` |
| `backend/tests/test_110_boot_guard.py` | 12 | 6 | 65 | Update `_ALL_19` → `_ALL_21` |
| `frontend/src/components/chat/MessageInput.tsx` | 38 | 15 | 577 | Restore armed connectors from last user message using `Map.has()` |
| `frontend/src/lib/api/threads.ts` | 42 | 19 | 1,679 | Map `active_connector_ids` in `_mapMessageResponse` |

---

## 4. Validation Architecture

### 4.1 Automated Test Strategy
1. **Boot Guard & Check Constraint Test**:
   - `backend/tests/test_110_boot_guard.py`: Run `pytest backend/tests/test_110_boot_guard.py`. Must pass with 21 valid action types.
2. **Live DB Ledger Writes Test (`SC#4`)**:
   - `backend/tests/integration/test_116_audit_live.py`: Run with live DB (`:54322`). Test MUST NOT skip; must verify that `connector.call` (all 5 outcomes) and `connector.grant` (both sources) write real rows to `public.audit_log`.
3. **Database Schema & Distinctions Test**:
   - Verify `messages.active_connector_ids` stores `'[]'::jsonb` when `[]` is passed and `NULL` when `None` is passed.
4. **Frontend Unit Tests (`vitest`)**:
   - `frontend/src/components/chat/__tests__/MessageInput.connectors.test.tsx`:
     - Test that `activeConnectorsByThread.has(draftKey)` prevents re-arming when `[]` was explicitly chosen.
     - Test that mounting an unvisited thread hydrates from the latest `role === 'user'` message.
     - Test that an assistant message with no connectors does not overwrite or disarm the user's armed connectors.
   - `frontend/src/__tests__/lib/api.test.ts`:
     - Test `_mapMessageResponse` preserves `[]` as `[]` and `null` as `undefined`.
5. **Recovery Text Assertion**:
   - Test verifying that `tool_dispatcher.py` emits the truthful timeout and rejection messages without invented reassurance.

### 4.2 Gate Commands & Baselines
- `tsc -p tsconfig.app.json`: Must not exceed 66 baseline errors.
- `node scripts/vitest-count-gate.cjs`: Must pass 188/188 files, 7,155+ tests passed, 0 failures.
- `pytest backend/tests/test_110_boot_guard.py`: Must pass 100%.
