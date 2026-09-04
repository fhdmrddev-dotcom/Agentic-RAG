---
phase: 223-a-connection-leaves-a-record
plan: 01
subsystem: database
tags: [postgres, migrations, audit, pydantic]

requires:
  - phase: 222
    provides: MCP connector foundations
provides:
  - "Migration 152 updating audit_log_action_type_check and adding active_connector_ids jsonb to public.messages"
  - "VALID_ACTION_TYPES synchronized with DB CHECK constraint (21 types)"
  - "test_110_boot_guard.py asserting _ALL_21 action types"
  - "MessageResponse exposing active_connector_ids: list[UUID] | None"
affects: [223-02, 223-03, 223-04, 223-05]

tech-stack:
  added: []
  patterns: [lockstep schema & code guard synchronization]

key-files:
  created:
    - supabase/migrations/152_audit_log_connector_action_types_and_message_active_connectors.sql
  modified:
    - backend/app/services/audit_service.py
    - backend/tests/test_110_boot_guard.py
    - backend/app/models/message.py

key-decisions:
  - "D-223-01: Registered 'connector.call' and 'connector.grant' in audit_log_action_type_check and VALID_ACTION_TYPES in lockstep"
  - "D-223-02: Boot guard test updated to _ALL_21 literal list, passing 100%"
  - "D-223-06: Added active_connector_ids jsonb column to public.messages and MessageResponse model"

patterns-established:
  - "Lockstep schema and frozenset registration preventing silent exception swallowing in write_audit_entry"

requirements-completed:
  - BUG-260902-05
  - BUG-260902-03

duration: 12min
completed: 2026-09-02
---

# Phase 223 Plan 01 Summary

**Migration 152 and code synchronization landed in lockstep, registering connector action types in the live DB CHECK constraint and adding active_connector_ids jsonb to public.messages.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-02T17:35:00Z
- **Completed:** 2026-09-02T17:41:00Z
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Authored `supabase/migrations/152_audit_log_connector_action_types_and_message_active_connectors.sql` updating `audit_log_action_type_check` to 21 types and adding `active_connector_ids jsonb` to `public.messages`.
- Applied migration 152 to local database on `:54322`, verified constraint and column presence directly.
- Updated `VALID_ACTION_TYPES` in `backend/app/services/audit_service.py` to include `"connector.call"` and `"connector.grant"`.
- Updated `backend/tests/test_110_boot_guard.py` from `_ALL_19` to `_ALL_21`, with all 4 boot tests passing.
- Updated `MessageResponse` in `backend/app/models/message.py` to expose `active_connector_ids: list[UUID] | None = None`.

## Task Commits

1. **Task 1 & 2: Lockstep migration 152, VALID_ACTION_TYPES, boot guard _ALL_21, and MessageResponse** - `f195667ee` (feat)

## Threat Mitigation

- **T-223-01 (Tampering / Check Constraint Drift)**: Mitigated by locking `VALID_ACTION_TYPES` to the exact database CHECK constraint.
- **T-223-02 (DoS / Boot Crash)**: Mitigated by verifying `assert_action_types_synced` against live and stub constraints.
- **T-223-03 (Info Disclosure)**: `active_connector_ids` only stores connector UUID arrays, no secrets.
