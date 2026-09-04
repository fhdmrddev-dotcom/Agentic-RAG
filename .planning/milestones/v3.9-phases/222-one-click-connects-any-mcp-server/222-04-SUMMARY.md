# Phase 222 Plan 04 Summary: McpAuthDoor Component & Panel Integration

**Execution Date:** 2026-09-01  
**Plan Reference:** `.planning/phases/222-one-click-connects-any-mcp-server/222-04-PLAN.md`  
**Status:** Complete  

## Overview
Mounted the unified `McpAuthDoor` component into `ConnectionFormPanel.tsx` for `draft.capability === "mcp"`. The door implements the 5 canonical authentication states conforming to the RFC 9728 / RFC 8414 wire contract (`POST /connectors/mcp/probe-auth` and `POST /connectors/mcp/oauth/authorize-url`), handling inline probing, DCR 1-click connect, BYO client credentials form, static token authentication, and policy refusal (HTTP 422) alerts.

## Changes Completed

1. **Child Component Extraction (`frontend/src/components/settings/McpAuthDoor.tsx`)**:
   - Built standalone `McpAuthDoor` component encapsulating all 5 auth states to preserve G-5 hot-file limits on `ConnectionFormPanel.tsx`.
   - **State 1 (Probing)**: Animated pulse indicator (`MCP_PROBING_STATUS`).
   - **State 2 (kind === 'open')**: Emerald direct-connection card with zero credential requirement explanation (`MCP_AUTH_OPEN_DESC`).
   - **State 3 (kind === 'oauth' with DCR)**: Single-click Sign In with dynamic host badge (`mcpAuthActionLabel`).
   - **State 4 (kind === 'oauth' with BYO)**: Renders client ID and client secret inputs (`customClientId`, `customClientSecret`).
   - **State 5a (kind === 'token')**: Renders server-provided detail message (`MCP_AUTH_TOKEN_DESC`) with token input.
   - **State 5b (Refusals & Errors)**: Distinct banners for 422 Egress Policy Refusal (`MCP_REFUSAL_POLICY_HEADING` + `mcpPolicyRefusalMessage`), 502 Oversize Response (`MCP_TOO_LARGE_HEADING`), and Unreachable MCP endpoints (`MCP_UNREACHABLE_HEADING`).
   - **Popup Safety (`BUS-049`)**: Calls `window.open("about:blank", "_blank")` synchronously within the user gesture handler before executing asynchronous connection creation/update and auth URL generation.

2. **Form Panel Mount (`frontend/src/components/settings/ConnectionFormPanel.tsx`)**:
   - Replaced legacy text control with `<McpAuthDoor />` inside `{capability === "mcp" && (...)`.
   - Wired draft mutation handler `setShapedBy` and tool discovery handler `handleDiscoverTools`.
   - Maintained all existing connection panel safety properties (focus restore, read-only gating, kill-switch behavior).

3. **Verification**:
   - Authored 7 comprehensive unit tests in `frontend/src/components/settings/McpAuthDoor.test.tsx` (all 7 passing).
   - Validated existing `ConnectionFormPanel.test.tsx` (160/160 passing) and `ConnectionFormPanel.oauth.test.tsx` (8/8 passing).
   - Validated full Phase 222 frontend test suite (189/189 tests passing).
   - Verified TypeScript compilation: 66 errors (0 new errors against baseline).

## Commits
- `4fb87c0db`: feat(222-04): mount McpAuthDoor in ConnectionFormPanel with 5 door states
