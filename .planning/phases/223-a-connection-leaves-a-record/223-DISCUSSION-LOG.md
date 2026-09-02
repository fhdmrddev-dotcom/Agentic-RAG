# Phase 223: A Connection Leaves a Record - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 223-A Connection Leaves a Record
**Areas discussed:** Audit Action Types & Payload, Armed Connectors Durability & Restore Policy, Audit Scope Boundary, Timeout & Rejection Recovery Copy

---

## 1. Audit Action Types & Metadata Payload Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single `connector.call` for calls & grants | Overload one type for both execution and permanent grant modifications | |
| Distinct `connector.call` and `connector.grant` | Clear separation between per-call invocation audit and permanent grant modification | ✓ |
| Full `args` payload recorded | Store entire arguments dictionary verbatim in `audit_log.metadata` | |
| Sanitized `arg_keys` only | Store argument keys only, preventing query/content/credential leaks into the ledger (SEED-223 / G-6) | ✓ |

**User's choice:** Distinct action types (`connector.call` and `connector.grant`) with `arg_keys` only in metadata.
**Notes:** `args` can carry emails, search queries, file contents, and personal data. Service, tool, actor, outcome, and argument keys provide complete auditability without violating data privacy.

---

## 2. Armed Connectors Durability & Restore Policy

| Option | Description | Selected |
|--------|-------------|----------|
| `localStorage` only | Quick client-only store; fails across devices/tabs and provides no server record | |
| Thread-level column | Add `active_connector_ids` to `threads` table | |
| Message-level column (`public.messages.active_connector_ids jsonb`) | Stores armed set per turn; provides historic auditability of what was armed | ✓ |
| Falsy / length check on restore | `activeConnectorsByThread.get(id) || fallback` — re-arms connectors user turned off | |
| `Map.has()` check on restore + last USER message anchor | Check `activeConnectorsByThread.has(draftKey)`; seed ONLY if absent from the last `role === 'user'` message | ✓ |

**User's choice:** Operator explicitly directed:
1. Key the restore on `Map.has()`, never on truthiness of the value (`get()` returns `undefined` for absent and `[]` for explicitly cleared).
2. Seed from the last **USER** message (assistant rows carry no armed set and would cause silent disarming).
3. Distinguish `[]` from absent `None` throughout the wire and database (`'[]'::jsonb` vs SQL `NULL`).

---

## 3. Audit Scope Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Widen to entire `api/connectors.py` | Audit connection create/delete/update operations | |
| Strictly scope to tool execution & tool grants | Instrument `_handle_connector_chat_tool`, `grant_one_tool`, and `update_connection_grants` | ✓ |

**User's choice:** Keep Phase 223 focused strictly on connector tool calls and grant modifications.

---

## 4. Timeout & Rejection Recovery Copy

| Option | Description | Selected |
|--------|-------------|----------|
| Retain neutral string | Keep `"timed out waiting for approval"` without guidance | |
| Provide actionable recovery instructions | State what is known: nobody answered in time (saying nothing either way about connection health), and instruct the model not to hallucinate workspace panels or re-authorization | ✓ |

**User's choice:** Provide truthful recovery text in `tool_dispatcher.py` stating what is known (nobody answered in time) without asserting unverified connection health claims, eliminating recovery hallucinations.
**Notes:** The timeout path knows only that no human answered within 120s; it has not probed the connection. Saying it is healthy would trade an invented recovery for an invented reassurance.

---

## Deferred Ideas
- Phase 224: 120s timeout countdown UI and below-the-fold positioning (`BUG-260902-04` duration/visibility halves, `SEED-240`).
- Workflow run connector call auditing into `harness_audit`.
