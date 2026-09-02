# Phase 223: A Connection Leaves a Record - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 223 delivers durable, verifiable accountability and state honesty for external connection tools in chat:
1. **Audit Ledger Writes**: Every outbound connector call (success, policy denial, user rejection, approval timeout, execution failure) and every permanent grant modification (`Always allow` on the chat card and updates in Settings) is recorded in `public.audit_log` with service, tool, actor, and outcome.
2. **Privacy Guard**: Argument keys are recorded, but argument values are never logged verbatim into the ledger (respecting D-213-14, SEED-223, and G-6).
3. **Armed Connectors Durability**: Armed connectors survive page reloads and browser restarts by persisting `active_connector_ids` on `public.messages` (preserving the critical semantic distinction between absent `NULL` and explicitly cleared `[]`).
4. **Composer State Honesty**: Restoring armed connectors is strictly keyed on `activeConnectorsByThread.has(draftKey)` and anchored to the last USER message, guaranteeing that explicit "off" decisions made in-session or persisted as `[]` stay off.
5. **Truthful Timeout Guidance**: Replaces silent/neutral timeout and rejection payloads with accurate recovery vocabulary so the model never hallucinates nonexistent workspace panels or instructs the user to re-authorize healthy connections.

</domain>

<decisions>
## Implementation Decisions

### 1. Audit Action Types & Schema Lock (GRANT-05, SC#1, SC#1a, SC#5)
- **D-223-01:** Introduce two new distinct audit action types:
  - `connector.call` — records every outbound connector tool execution attempt and outcome in chat.
  - `connector.grant` — records every permanent grant creation or modification (`Always allow` on the chat card and Settings form updates).
- **D-223-02:** Migration `152_audit_log_connector_action_types_and_message_active_connectors.sql`:
  - Updates the `audit_log_action_type_check` CHECK constraint on `public.audit_log` to include `'connector.call'` and `'connector.grant'`.
  - In lockstep, register both in `VALID_ACTION_TYPES` in `backend/app/services/audit_service.py` and update `_ALL_19` → `_ALL_21` in `backend/tests/test_110_boot_guard.py` in the same commit to ensure `assert_action_types_synced` passes at startup.

### 2. Audit Payload Structure & Privacy Bounds (SC#1, SEED-223, G-6)
- **D-223-03:** `connector.call` metadata structure:
  ```json
  {
    "connection_id": "<uuid-string>",
    "service_id": "<slug>",
    "service_name": "<display-name>",
    "tool_name": "<action-name>",
    "outcome": "success | policy_denial | user_rejected | timeout | execution_failure",
    "arg_keys": ["param1", "param2"],
    "failure_reason": "<sanitized-reason-string-or-null>"
  }
  ```
  - **Privacy rule (G-6 / SEED-223):** Verbatim argument payloads (`args`) are NEVER stored in `metadata`. Only `arg_keys: list[str]` are recorded.
  - **Actor & Org:** `user_id=ctx.current_user["id"]` and explicit `org_id=str(org_id)` are always supplied to `write_audit_entry` so rows are correctly attributed across multi-org actors.
- **D-223-04:** Coverage of exit points in `_handle_connector_chat_tool` (`tool_dispatcher.py`):
  - Five action outcomes are audited in `audit_log`:
    - Exit line 4401 (`posture == "deny"`): Audit as `outcome="policy_denial"`.
    - Exit line 4445 (`decision != "allow"`): Audit as `outcome="user_rejected"`.
    - Exit line 4452 (`asyncio.TimeoutError`): Audit as `outcome="timeout"`.
    - Exit line 4585 (`failure is not None`): Audit as `outcome="execution_failure"`.
    - Exit line 4605 (Success): Audit as `outcome="success"`.
  - Four precondition exits are NOT audited as connector calls because they fail before any connector action is evaluated:
    - Exit line 4337 (No authenticated user): Genuinely un-auditable because `audit_log.user_id` is `NOT NULL`; logged to warning and refused without crashing.
    - Exit line 4351 (`scope.ok` False): Precondition failure resolving user org.
    - Exit line 4372 (`list_connections` DB failure): Infrastructure lookup error.
    - Exit line 4388 (`matched_conn` not found): Precondition failure (named service not in org).

### 3. Grant Receipt Instrumentation (SC#1a)
- **D-223-05:** Audit permanent grant changes across BOTH primitives:
  - **Chat card `Always allow`**: `api/threads.py:1528` calls `connector_service.grant_one_tool(...)`. Thread actor `current_user["id"]` and `scope.org_id` into `grant_one_tool` (or write audit entry immediately upon persistence), recording `action_type="connector.grant"`, `metadata={"connection_id": ..., "service_name": ..., "tool_name": ..., "posture": "allow", "source": "chat_card"}`.
  - **Settings panel update**: `api/connectors.py:1333` (`update_grants`) passes `current_user.id` and `org_id` to audit full-column replaces: `action_type="connector.grant"`, `metadata={"connection_id": ..., "tool_grants": sanitized_grants, "source": "settings"}`.

### 4. Armed Connectors Durability & Storage (BUG-260902-03, SC#2)
- **D-223-06:** Add column `active_connector_ids jsonb` to `public.messages` in migration 152.
  - In `backend/app/api/threads.py:820` (`send_message`), when persisting the user message:
    - If `body.active_connector_ids is not None`: store `[str(cid) for cid in body.active_connector_ids]` (preserving `[]` as `'[]'::jsonb`).
    - If `body.active_connector_ids is None`: store SQL `NULL`.
  - In `backend/app/models/message.py`:
    - Add `active_connector_ids: list[UUID] | None = None` to `MessageResponse`.
  - In `frontend/src/types/index.ts` & `frontend/src/lib/api/threads.ts`:
    - Add `activeConnectorIds?: string[]` to `Message`.
    - `_mapMessageResponse` maps `active_connector_ids` to `activeConnectorIds` (preserving `[]` as `[]`, and `null`/absent as `undefined`).

### 5. Composer State Restore & "Off Means Off" (Operator Ruling, SC#2)
- **D-223-07:** Restore is strictly keyed on `activeConnectorsByThread.has(draftKey)`:
  - `activeConnectorsByThread.get(draftKey)` returns `undefined` for ABSENT (unhydrated thread) and `[]` for EXPLICITLY CLEARED. A falsy or `.length` check MUST NOT be used.
  - If `activeConnectorsByThread.has(draftKey)` is `true`: use the in-session selection without touching DB history (explicit off stays off).
  - If `activeConnectorsByThread.has(draftKey)` is `false` (fresh load / reload): hydrate from the **last USER message** in the thread (`role === 'user'`). Assistant messages carry no armed set and are skipped.
  - If the last user message has `activeConnectorIds` as an array (even `[]`), adopt that exact array and set `activeConnectorsByThread.set(draftKey, lastUserMsg.activeConnectorIds)`.
  - If the last user message has no `activeConnectorIds` (legacy message), default to `[]`.

### 6. Truthful Recovery Vocabulary (BUG-260902-04 copy half, SC#3)
- **D-223-08:** `tool_dispatcher.py` timeout and rejection tool results return actionable, truthful text:
  - **Timeout payload (line 4455)**:
    `"Tool execution '{action_tool_name}' on {matched_conn.name} timed out waiting for human approval in the chat. Nobody answered in time. Do not advise the user to check a workspace panel or re-authenticate; if the user still wants this action, ask them in this chat if they would like to try again."`
  - **Rejection payload (line 4446)**:
    `"User rejected execution of tool '{action_tool_name}' on {matched_conn.name}. Do not retry this action unless explicitly requested by the user."`
  - Eliminates model hallucinations directing users to empty workspace panels or advising re-authentication of healthy connections, while making no unverified claims about connection health.

### 7. Scope Boundary
- **D-223-09:** Connection CRUD operations (create, delete, toggle enabled) in `api/connectors.py` remain outside Phase 223 scope. This phase strictly covers connector tool execution and grant modifications.
- **D-223-10:** Approval duration (120s fuse) and below-the-fold visibility are deferred to Phase 224 under `SEED-240` / `BUG-260902-04` (duration+visibility halves).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoping & Preflight
- `.planning/phases/223-a-connection-leaves-a-record/223-PROPOSAL.md` — Original scope, failure inversion discovery, and rationale.
- `.planning/phases/223-a-connection-leaves-a-record/223-PREFLIGHT.md` — Measured pre-flight findings, corrections to proposal, and exit-point roster.
- `.agent-bus/OPEN.md` (BUS-056 & BUS-057) — Builder brief and reviewer preflight measurements.

### Requirements & Roadmap
- `.planning/ROADMAP.md` line 153, line 690 (`#### Phase 223:`), line 753 — Phase goals and success criteria.
- `BUG-260902-05.md` — Outbound connector calls leaving no audit log (`GRANT-05` unmet).
- `BUG-260902-03.md` — Armed connectors non-durable and lost on reload.
- `BUG-260902-04.md` — Approval timeout copy and recovery hallucinations.
- `SEED-223.md` — Governance receipts and avoiding raw argument text exposure.
- `SEED-236.md` — Chat card "Always allow" mechanics and application-rung write cap.

### Core Source Files
- `backend/app/services/tool_dispatcher.py:4322-4605` — `_handle_connector_chat_tool` exit points and execution logic.
- `backend/app/services/audit_service.py` — `VALID_ACTION_TYPES`, `assert_action_types_synced`, `write_audit_entry`.
- `backend/app/api/threads.py:1515-1546` — Tool approval endpoint, Always allow handling, and `send_message` user message insert (:820).
- `backend/app/services/connector_service.py:1256` — `grant_one_tool` and `update_connection_grants`.
- `frontend/src/components/chat/MessageInput.tsx:75-175` — `activeConnectorsByThread` map, thread switch effect, and composer connectors state.
- `frontend/src/lib/api/threads.ts:35-115, :517-525` — Message mapping DTO and wire serialization of `active_connector_ids`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `write_audit_entry(user_id, action_type, metadata, supabase, org_id)`: Async fire-and-forget helper in `audit_service.py`. Passes explicit `org_id` to bypass trigger misattribution.
- `backend/tests/integration/test_116_audit_live.py`: Integration test reading live `public.audit_log` rows directly without mocking, ensuring writes actually land.
- `activeConnectorsByThread`: Module-scoped `Map<string, string[]>` in `MessageInput.tsx`.

### Established Patterns
- **Exception Swallowing in Audit**: `write_audit_entry` catches and logs all exceptions. Action types not present in DB CHECK constraint fail silently. Testing MUST read back from `public.audit_log`.
- **Boot Guard Synchronization**: `test_110_boot_guard.py` verifies that `VALID_ACTION_TYPES` in code is a strict subset of the database CHECK constraint.
- **Strict Distinction between `[]` and `NULL`**: In Postgres JSONB, `'[]'::jsonb` represents an explicitly empty list, whereas `NULL` represents absence.

### Integration Points
- `backend/app/services/tool_dispatcher.py`: Instrument early refusals/rejections/timeouts and success exits with `ctx.spawn(write_audit_entry(...))`.
- `backend/app/api/threads.py`: Thread actor and org into `grant_one_tool` and write `connector.grant` audit entries; persist `active_connector_ids` in `messages.insert`.
- `frontend/src/components/chat/MessageInput.tsx`: Hydrate active connectors from `messages` on initial mount / switch using `!activeConnectorsByThread.has(draftKey)` and filtering for the latest `role === 'user'` message.

</code_context>

<specifics>
## Specific Ideas

- **Operator Ruling on Decision 2**:
  - Key the restore strictly on `activeConnectorsByThread.has(draftKey)`, NEVER on truthiness of the value.
  - Always seed from the latest **USER** message in the thread (`role === 'user'`), because the latest row in the thread is almost always an assistant row with no armed set.
  - Preserve `[]` vs `None` across the entire pipeline: frontend wire sends `[]` -> FastAPI receives `[]` -> DB inserts `'[]'::jsonb` -> GET messages returns `[]` -> frontend receives `[]`.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 224 (`SEED-240` / `SEED-128`)**: Approval card countdown timer, configurable duration beyond 120s, and card positioning above the fold.
- **Workflow Connector Auditing**: Instrumenting connector calls initiated from workflow runs into `harness_audit`.
- **Admin Connection CRUD Auditing**: Adding audit log writes for creating and deleting connections in `api/connectors.py`.

</deferred>

---

*Phase: 223-A Connection Leaves a Record*
*Context gathered: 2026-09-02*
