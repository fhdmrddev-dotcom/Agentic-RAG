---
phase: 084-workspace-filesystem-backend
plan: 03
type: execute
status: complete
completed: 2026-05-28
---

## Phase 084 Plan 03: Tool Handlers + LLM Schemas Summary

**5 workspace tools wired into the agent loop -- handlers in tool_dispatcher.py + LLM schemas in openai_service.get_tools(); write and delete emit SSE events for the Phase 086/087 panel UI.**

## Dependency Graph

requires: [084-02]
provides:
  - "tool_dispatcher.py: _handle_workspace_{write,read,list,delete,diff} + 5 registry entries"
  - "openai_service.py: WORKSPACE_{WRITE,READ,LIST,DELETE,DIFF}_TOOL + appended to get_tools()"
  - "SSE event vocab: workspace_file_written, workspace_file_deleted"
affects: [084-04, 086, 087]

## Tech Tracking

tech-stack:
  added: []
  patterns:
    - "Tool handler pattern: async _handle_<name>(args, ctx) -> ToolResult; catches WorkspaceError to return structured error JSON"
    - "SSE event vocabulary: workspace_file_written (path, version, size_bytes, mime_type) and workspace_file_deleted (path)"
    - "Cross-provider strict-mode schemas: nullable optionals declared as type ['T', 'null'] with all keys present in required"

key-files:
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/openai_service.py

key-decisions:
  - "Workspace tools always available -- no feature flag gating (D-14). They join the static base list in get_tools() rather than being conditionally appended."
  - "workspace_read truncation notice appended to text content rather than separate field -- matches LLM-readable string output of the other read-class tools."
  - "workspace_delete returns structured 'deleted' JSON rather than emitting the SSE before the DB delete -- emit fires after delete succeeds (no event for failed deletes)."
  - "Path-validation lives in workspace_service, NOT in handlers -- handlers stay thin and trust the service's trust boundary."

requirements-completed: [WS-01, WS-02, WS-03, WS-04, WS-07]

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-28
- **Completed:** 2026-05-28

## Accomplishments

- Added workspace_service import block (5 aliased function imports + WorkspaceError) to tool_dispatcher.py
- Added 5 async handler functions (~150 LOC) implementing the tool surface
- Added 5 entries to _TOOL_REGISTRY -- total tool count now 21 (was 16)
- Added 5 tool schema constants (~130 LOC) in openai_service.py, all using strict-mode nullable-optional pattern for cross-provider compatibility
- Extended get_tools() base list to include all 5 workspace tools
- Verified both import paths: `_TOOL_REGISTRY` has 21 entries with the 5 workspace tools present; `get_tools()` returns 21 schemas including all 5 workspace tools

## Task Commits

1. **Task 1: Add 5 workspace tool handlers to tool_dispatcher.py** -- `6765dfd` (feat)
2. **Task 2: Add 5 workspace tool schemas to openai_service.py** -- `84eaa2a` (feat)

## Files Modified

- `backend/app/services/tool_dispatcher.py` - Added workspace_service import block, 5 handler functions, 5 registry entries (+153 lines)
- `backend/app/services/openai_service.py` - Added 5 tool schema constants and extended get_tools() base list (+145 lines)

## Decisions Made

- **No feature flag:** Workspace tools are always available per D-14. Reasons: (1) the workspace is a first-class agent capability, not optional; (2) gating would complicate the panel UI (Phase 087) which assumes the tools exist.
- **Truncation notice in content string:** workspace_read appends `[Truncated at N chars...]` to the body rather than returning a structured `is_truncated` flag in JSON. This matches how `read_document` formats its output and lets the LLM see the truncation naturally without parsing.
- **SSE emit AFTER persistence:** workspace_write emits `workspace_file_written` after the DB write succeeds, and workspace_delete emits `workspace_file_deleted` after the DB delete succeeds. No event fires on errors -- the WorkspaceError catch returns the error in the ToolResult without emitting.

## Deviations from Plan

None on substance. One refactor: moved the `from uuid import UUID as _UUID` import out of each handler (it was duplicated in all 5) and used the existing top-of-file `from uuid import UUID` import directly. Identical behavior, cleaner code.

## Auto-Fixed Issues

None.

## Issues Encountered

None.

## User Setup Required

None. Tools are live as soon as the backend reloads.

## Next Phase Readiness

- Plan 04 (REST API) is independent of this plan -- both can run in parallel within Wave 3 (no file overlap).
- Phase 086 (StreamsProvider extension) needs to add the two new SSE event types (workspace_file_written, workspace_file_deleted) to its event handler.
- Phase 087 (Panel UI) consumes both the SSE events for live updates and the Plan 04 REST endpoints for cold loads.
- Verifier should confirm that all 4 providers (OpenAI, Anthropic, Google, OpenRouter) accept the strict-mode null-typed optional schemas without 4xx errors -- a manual cross-provider UAT row will catch any provider-specific schema rejection.
