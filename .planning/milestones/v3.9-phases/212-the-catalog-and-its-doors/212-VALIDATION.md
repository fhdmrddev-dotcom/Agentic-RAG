# Phase 212: The Catalog and Its Doors — Validation Strategy

**Date:** 2026-08-27
**Phase:** 212 (The Catalog and Its Doors)
**Status:** Locked
**Baseline Commit:** `43c95968`

---

## 1. Automated Verification Matrix

| Requirement | Test File | Test Cases | Gate / Command |
|---|---|---|---|
| **CAT-01** (Searchable Catalog) | `frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx` | `test_renders_searchable_services_directory`, `test_query_filters_by_name_and_description` | `vitest run ConnectionsTab.test.tsx` |
| **CAT-02** (Popular Row) | `frontend/src/components/settings/__tests__/servicesCatalog.test.ts` | `test_popular_services_preset_registry`, `test_fallback_for_unknown_service_id` | `vitest run servicesCatalog.test.ts` |
| **CAT-03** (State Filters) | `frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx` | `test_state_filter_chips_all_connected_not_connected`, `test_zero_verb_chips_rendered` | `vitest run ConnectionsTab.test.tsx` |
| **CAT-05** (Cloud Parity / `BUG-260810-01`) | `frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx` | `test_cloud_live_connectors_off_shows_control_room_banner`, `test_admin_navigates_to_control_room` | `vitest run ConnectionsTab.test.tsx` |
| **CONN-06** (MCP Discovery) | `backend/tests/unit/test_mcp_egress_hardening.py`<br>`backend/tests/unit/test_connectors_api.py`<br>`frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx` | `test_threadpooled_dns_resolution_off_event_loop`<br>`test_pinned_ip_rewrite_prevents_dns_rebinding_toctou`<br>`test_discover_tools_endpoint_returns_sanitized_schemas`<br>`test_interactive_discover_button_previews_tools` | `pytest tests/unit/test_mcp_egress_hardening.py`<br>`vitest run ConnectionFormPanel.test.tsx` |
| **CONN-07** (Grant Preservation & Deletion) | `frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx` | `test_preserves_existing_tool_grants_on_update`, `test_impact_aware_deletion_sheet_with_usage_counts` | `vitest run ConnectionFormPanel.test.tsx` |
| **D-v2.5-01** (Async Threadpooling) | `backend/tests/unit/test_mcp_egress_hardening.py` | `test_validate_mcp_destination_runs_in_threadpool`, `test_bounded_jsonrpc_body_decoding` | `pytest tests/unit/test_mcp_egress_hardening.py` |
| **D-207-06** (Barrel Completeness) | `frontend/src/lib/__tests__/apiBarrel.test.ts` | `test_connectors_api_symbols_reexported_in_lib_api` | `vitest run apiBarrel.test.ts` |

---

## 2. Gate Verification Requirements

### 2.1 Frontend TypeScript Typecheck
- **Command:** `npx tsc --noEmit -p tsconfig.app.json` (from `frontend/`)
- **Success Criteria:** Exactly **34 errors** (exact pre-phase baseline). No new TypeScript errors introduced in any touched or added file.

### 2.2 Vitest Count Gate
- **Command:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (from repo root)
- **Success Criteria:**
  - Status: **OK**
  - Pinned files: **>= 116/116**
  - Failed tests: **0**
  - Total test count: **>= 5829** (strictly no per-file test count decreases)

### 2.3 Backend Unit Test Suite & Rot Set Stability
- **Command:** `./venv/Scripts/python.exe -m pytest tests/unit -q` (from `backend/`)
- **Success Criteria:**
  - Failed tests: **<= 68** (exact baseline rot set)
  - Zero failures in any connector/egress test file (`test_mcp_connector_client.py`, `test_mcp_egress_hardening.py`, `test_connectors_api.py`, `test_190_*.py`, `test_211_*.py`).

---

## 3. Human / Lived-Experience Verification Checks

1. **Popular Service Quick-Connect:** Click "Connect" on Slack/Jira card in Popular row → verify form opens with tailored fields, help text, and starter prompts.
2. **Custom MCP Server Paste-a-URL:** Paste `https://mcp.deepwiki.com/sse` → click "Discover Tools" → verify tool count, titles, descriptions, and input schemas preview clearly.
3. **Grant Preservation across Edits:** Modify connection name/endpoint on an active connection → verify existing granted/denied tools retain their exact settings.
4. **Cloud Parity Banner:** View Connections tab with `live_connectors` off → verify clear informative banner with working Control Room link for admins.
