---
phase: 223-a-connection-leaves-a-record
plan: 02
subsystem: dispatch
tags: [audit, connectors, tool-dispatcher, security]

requires:
  - phase: 223-01
    provides: "Migration 152 and VALID_ACTION_TYPES containing connector.call"
provides:
  - "Outbound connector audit instrumentation in tool_dispatcher._handle_connector_chat_tool"
  - "Auditing across all 5 evaluated outcomes (policy_denial, user_rejected, timeout, execution_failure, success)"
  - "Privacy protection enforcing arg_keys only in audit metadata (G-6 / SEED-223)"
  - "Truthful recovery string on timeout stating nobody answered in time without health speculation"
  - "Clean test coverage in test_223_dispatcher_audit.py"
affects: [223-05]

tech-stack:
  added: []
  patterns: [privacy-safe audit metadata, truthful failure copy]

key-files:
  created:
    - backend/tests/test_223_dispatcher_audit.py
  modified:
    - backend/app/services/tool_dispatcher.py

key-decisions:
  - "D-223-03: arg_keys: list[str] persisted instead of raw args dictionary (privacy invariant)"
  - "D-223-04: Truthful recovery text on timeout explicitly stating nobody answered in time, omitting unverified health claim, and instructing LLM not to advise workspace panels"
  - "D-223-05: Instrument all 5 evaluated action exits with outcome and failure_reason"

patterns-established:
  - "Outbound connector audit with actor attribution and explicit org_id"

requirements-completed:
  - GRANT-05
  - BUG-260902-04

duration: 15min
completed: 2026-09-02
---

# Phase 223 Plan 02 Summary

**Instrumented outbound connector tool dispatching with durable audit logs across 5 evaluated outcomes, privacy-safe argument keys, and truthful recovery copy without speculative health assertions.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-02T17:41:00Z
- **Completed:** 2026-09-02T17:44:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- Instrumented `_handle_connector_chat_tool` in `backend/app/services/tool_dispatcher.py` to write `connector.call` audit rows at all 5 evaluated action exits:
  1. `policy_denial` when posture is deny
  2. `user_rejected` when human clicks deny
  3. `timeout` when human approval times out after 120s
  4. `execution_failure` when tool execution fails
  5. `success` when tool execution succeeds
- Enforced privacy invariant: metadata records `arg_keys: list[str]` only, never leaking verbatim argument values.
- Replaced ambiguous timeout copy with truthful recovery instructions stating nobody answered in time, removing unverified "connection remains connected and healthy" claims, and instructing the model not to hallucinate workspace panels.
- Authored and verified unit test suite `backend/tests/test_223_dispatcher_audit.py` with all 6 tests passing.

## Task Commits

1. **Task 1 & 2: Audit outbound connector calls across 5 outcomes and truthful recovery copy** - `7d44e389f` (feat)

## Threat Mitigation

- **T-223-04 (Info Disclosure in Audit Logs)**: Verified that raw argument dicts and secret payloads are not stored in audit metadata.
- **T-223-05 (Repudiation)**: Every outbound attempt, refusal, or execution outcome is permanently logged to `public.audit_log`.
- **T-223-06 (Model Misdirection / Hallucination)**: Truthful recovery text prevents the LLM from misleading users into re-authenticating or looking for nonexistent workspace panels.
