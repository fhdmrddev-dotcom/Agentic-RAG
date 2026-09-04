# Phase 222 Plan 05 Summary: Cross-Seam Integration & Mechanical Gates

**Execution Date:** 2026-09-01  
**Plan Reference:** `.planning/phases/222-one-click-connects-any-mcp-server/222-05-PLAN.md`  
**Status:** Complete  

## Overview
Delivered the unmocked cross-seam integration test suite required by `AGENTS.md` §3.1 for split phases (preventing the Phase 204 failure pattern), integrated all new test suites into the mechanical vitest count gate, resolved in-phase review findings on `McpAuthDoor` (`BUS-053`), and verified all repository gates.

## Changes Completed

1. **Unmocked Seam Integration Test (`backend/tests/integration/test_222_mcp_oauth_seam.py`)**:
   - Implemented 5 unmocked wire integration tests covering:
     - Open server probe-auth -> `kind="open"`, `authorization_host=None`, `registration_required=False`.
     - RFC 9728/8414 OAuth server with Dynamic Client Registration -> `kind="oauth"`, `authorization_host="auth.notion.com"`, `registration_required=False`, `code_challenge_methods=["S256"]`.
     - Static token fallback -> `kind="token"`, `authorization_host=None`, server-provided detail text.
     - Policy refusal (HTTP 422) -> Structured `{"detail": {"reason_code": ..., "message": ...}}` object response (`BUS-052`).
     - OAuth callback error handling -> Redirects with `error` query parameter.
   - All 5 integration tests pass cleanly against real router endpoints.

2. **Vitest Count Gate Update (`scripts/vitest-count-gate.cjs`)**:
   - Pinned 3 new frontend test suites:
     - `connectors.mcp_auth.test.ts`: 8 tests
     - `connectionFormCopy.mcp.test.ts`: 6 tests
     - `McpAuthDoor.test.tsx`: 9 tests
   - Added paths to `TARGETS` array.
   - Count gate verified: **186/186 pinned files present, 0 failing, 7,148 total tests run**.

3. **In-Phase Review Hardening (`BUS-053`)**:
   - Fixed `handleOAuthConnect` in `McpAuthDoor.tsx` to omit `config` on edit mode unless `custom_app` is explicitly selected (spreading existing config), preserving `custom_client_id` and preventing vendor re-registration.
   - Added early trapping for null `popup` (e.g. from popup blockers), rendering a friendly warning alert without minting orphaned pending handles or executing unnecessary connection updates.
   - Added 2 new tests verifying config preservation and popup blocker error handling (total 9 tests in `McpAuthDoor.test.tsx`).

4. **Repository Gates & Baselines**:
   - `tsc` error check: **66 errors** (0 new TypeScript errors against baseline).
   - `check-claude-md-size.cjs`: **106,048 chars / 70.7% of limit (OK)**.
   - Full Phase 222 frontend tests: **191/191 tests passing**.
   - Full Phase 222 backend tests: **15/15 tests passing**.

## Commits
- `7d2a53db6`: feat(222): implement unmocked cross-seam integration test and pin count gate
