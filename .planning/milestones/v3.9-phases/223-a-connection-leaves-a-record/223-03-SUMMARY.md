---
phase: 223-a-connection-leaves-a-record
plan: 03
subsystem: grants
tags: [audit, connectors, grants, security]

requires:
  - phase: 223-01
    provides: "Migration 152 and VALID_ACTION_TYPES containing connector.grant"
provides:
  - "Permanent grant receipt auditing on handle_tool_approval for chat card Always allow"
  - "Permanent grant receipt auditing on update_grants in connectors.py for Settings panel"
  - "Metadata capturing source (chat_card vs settings), tool names, posture, and explicit org_id"
  - "Clean test coverage in test_223_grant_audit.py"
affects: [223-05]

tech-stack:
  added: []
  patterns: [grant mutation audit receipts, non-blocking audit write pattern]

key-files:
  created:
    - backend/tests/test_223_grant_audit.py
  modified:
    - backend/app/api/threads.py
    - backend/app/api/connectors.py

key-decisions:
  - "D-223-01: Registered 'connector.grant' action type for permanent grant changes"
  - "D-223-05: Instrument both permanent grant mutation seams (chat card read-merge-write and settings whole-column replace)"

patterns-established:
  - "Permanent grant receipts attributing actor user and target connection in public.audit_log"

requirements-completed:
  - GRANT-05

duration: 12min
completed: 2026-09-02
---

# Phase 223 Plan 03 Summary

**Instrumented permanent grant mutations across both entry points (chat approval card 'Always allow' and Settings panel 'update_grants') with durable connector.grant audit receipts.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-02T17:44:00Z
- **Completed:** 2026-09-02T17:48:00Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Instrumented `handle_tool_approval` in `backend/app/api/threads.py` to write a `connector.grant` audit log when decision is `always` (after `grant_one_tool` succeeds), with `source="chat_card"`, connection ID, tool name, and posture `allow`.
- Instrumented `update_grants` in `backend/app/api/connectors.py` to write a `connector.grant` audit log when the Settings panel updates postures, with `source="settings"`, connection ID, tool count, and grant map.
- Protected both endpoints with defensive non-blocking exception logging so unexpected audit write errors never block approval release or grant updates.
- Authored unit test suite `backend/tests/test_223_grant_audit.py` with 100% pass rate across both grant mutation sites and single-allow non-audit guard.

## Task Commits

1. **Task 1 & 2: Audit permanent grant mutations from chat card and settings** - `d72eabfe1` (feat)

## Threat Mitigation

- **T-223-07 (Unauthorized or Unrecorded Grant Mutation)**: Every permanent grant mutation leaves an immutable record attributing the actor user, connection ID, and source.
