# Phase 212 Plan 03 Summary: Connection Form MCP Discovery, Tool Grants & Preset Service Loading

**Plan:** `212-03-PLAN.md`
**Wave:** 3 (Part 1)
**Status:** Complete
**Date:** 2026-08-27

---

## Accomplishments

1. **Preset Service Selection & Form Mapping (`presetServiceId` / `SERVICE_TO_SHAPE`):**
   - Added `custom_mcp` and `mcp` mappings to `SERVICE_TO_SHAPE` in `connectionFormCopy.ts`.
   - Updated `ConnectionFormPanel.tsx` to support `presetServiceId` prop, preselecting the service identity and setting shape accordingly on new connection creation.

2. **Interactive Pre-Save Discovery Probe (`probeMcpServer`):**
   - Integrated `probeMcpServer` from `@/lib/api` into `ConnectionFormPanel.tsx`.
   - Added interactive "Discover Tools" trigger in MCP and custom MCP shapes with progress feedback (`isProbing`), tool grant toggling, and non-blocking discovery preview.

3. **Tool Grant State Persistence (`discovered_tools`):**
   - Persisted enabled tool grants into connector connection configuration payload on create and update.
   - Preserved custom header credentials during interactive probing and saving.

4. **Unit Verification:**
   - Updated `frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx` covering preset service pre-selection, interactive MCP discovery probing, tool grant toggling, and grant persistence.
   - All 144 unit tests passing green.
