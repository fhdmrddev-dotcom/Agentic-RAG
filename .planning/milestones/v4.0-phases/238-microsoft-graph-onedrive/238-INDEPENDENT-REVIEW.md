---
phase: 238-microsoft-graph-onedrive
reviewed: 2026-09-14
review_type: independent
reviewer: Gemini (independent reviewer under AGENTS.md §6.3)
builder: Claude
range: 409af705f^..db7a083a2
status: passed
findings:
  critical: 0
  blocker: 0
  warning: 3
  info: 2
  resolved_in_phase: 4
---

# Phase 238: Independent Code Review (AGENTS.md §6.3)

**Reviewed by:** Gemini (did NOT build, plan, or shape Phase 238)  
**Builder:** Claude  
**Date:** 2026-09-14  
**Scope:** Full phase range `409af705f^..db7a083a2` (including 238-01..03, live UAT drive, and review-response plans 238-04..06).

---

## 1. Executive Summary

Phase 238 implements the Microsoft Graph source adapter (OneDrive/SharePoint personal & business) against the Phase 232 `SourceAdapter` contract. Because Phase 238 represents a **credential and egress boundary**, it is subject to independent review under AGENTS.md §6.3.

The central architectural claim of Phase 238 holds:
1. `backend/app/services/sources/base.py` required **zero contract modifications** to support Microsoft Graph.
2. The 302 redirect dance required by Graph `/content` is completely sealed inside `microsoft_graph.py` via Microsoft's documented two-step download (`graph_read` for item metadata, `graph_download` for content), never leaking redirect handling to `SourceAdapter`.
3. Egress security strictly enforces TLS, host suffix pinning, DNS address re-verification (preventing loopback/RFC1918/cloud metadata SSRF), no redirect following (`follow_redirects=False`), and bounded memory expansion (protecting against gzip bombs).
4. All initial blocking and critical review findings (CR-01 stored path fabrication, WR-01 search URL path injection, WR-02 cursor restart bug, WR-03 path encoding discrepancy) were fixed in-phase across plans 238-04, 238-05, and 238-06 with dedicated regression tests.

All 85 Phase 238 unit tests pass at current develop HEAD.

---

## 2. In-Depth Target Verification

### 2.1 The Rewritten Boundary Fence (`backend/tests/unit/services/sources/test_boundary_fence.py`)
- **Independent RED Verification:** Planted `if "onedrive" in "test": pass` on line 17 of `backend/app/services/sources/base.py`. Running pytest failed immediately with:
  `AssertionError: app/services/sources/base.py branches on a provider identity above services/sources/adapters/: line 17: 'onedrive' (matches 'onedrive')`
  Restored `base.py` byte-identically; all 21 fence tests pass.
- **AST Inspector Coverage:** The fence does not merely grep strings; it inspects `ast.Compare`, `ast.Subscript`, `ast.MatchValue`, and `ast.Call` on `_DECIDING_METHODS` (`get`, `startswith`, `endswith`, `removeprefix`, `removesuffix`), expanding container operands (`_flatten`).
- **Exemptions Guard:** `test_provider_half_and_leaf_modules_are_guarded` mechanically verifies that all exempted files exist on disk, provider-half modules reside strictly within provider subdirectories, and leaf modules contain zero adapter imports.

### 2.2 Two-Step Graph Download & Egress Boundary (`microsoft_graph.py` & `egress.py`)
- **Step 1 (`graph_read`):** `GET {GRAPH_API_BASE}/me/drive/items/{file_id}` with Bearer token. Validated by `send_pinned_http("graph_read", ...)` which strictly pins to `graph.microsoft.com`.
  - *Reality Fidelity:* Noticeably, `$select` was removed after live testing proved that any projection silently suppresses `@microsoft.graph.downloadUrl` in Graph v1.0 responses.
- **Step 2 (`graph_download`):** `GET <download_url>` with `Accept: */*` and explicitly **no `Authorization` header**.
  - *Egress Pinning:* Pinned to `ALLOWED_HOST_SUFFIXES["graph_download"] = ("1drv.com", "sharepoint.com", "microsoftpersonalcontent.com")`. Label-boundary matching (`host == suffix or host.endswith("." + suffix)`) ensures `evil1drv.com` or `evilsharepoint.com` are refused with `host_not_allowed`.
  - *No Token Leakage:* Because Step 2 carries no Authorization header, any unexpected redirect cannot leak OAuth credentials even before the transport refuses it.
  - *Transport Caps:* Bounded by `clamp_read_cap(max_bytes)` and decompressed with `_decode_bounded`, preventing decompression bombs and bounding residency.

### 2.3 Provenance & Stored Path Honesty (CR-01 / Plan 238-04)
- Fixed the vulnerability where `confirm_preview` persisted `item.path` (which fell back to `f"/{f.name}"` or was seeded from caller-supplied `folder_name`) into `metadata.source.path`.
- Separated `PreviewItem.path` (display-only breadcrumb) from `PreviewItem.source_path` (honest source provenance, or `None` if unknown).
- Guarded by `test_238_04_stored_path_is_never_fabricated.py` (7/7 pass).

### 2.4 Query Sanitization & Path Encoding (WR-01, WR-03 / Plan 238-06)
- In `list_files(query=...)`: `safe = quote(query.replace("'", "''"), safe="")`. Completely percent-encodes `?`, `#`, `&`, `/`, `(`, `)` after doubling apostrophes for OData, preventing path breakout and URL manipulation.
- In `_folder_path`: Uses `unquote(stripped).rstrip("/")` and returns `None` if no `/drive/root:` or `/drives/{id}/root:` prefix exists, preventing internal opaque IDs from becoming folder paths.
- Guarded by `test_238_06_search_url_and_folder_path.py` (11/11 pass).

### 2.5 Paging Cursor Validation (WR-02 / Plan 238-05)
- In `_get_page`: Validates that `page_token` begins with `GRAPH_API_BASE` (case-insensitive) rather than silently falling back to page 1.
- Guarded by `test_238_05_cursor_is_refused_not_guessed.py` (6/6 pass).

---

## 3. Residual Findings (Documented Debt)

1. **WR-04 (Info / Minor Debt):** Suffix-matching tests for `graph_download` are exercised in `test_190_egress.py` table membership and mock adapter tests; dedicated unit tests with stub DNS resolvers for near-miss domain attacks (`evil1drv.com`) remain recommended as part of egress test suite maintenance.
2. **WR-05 (Minor Debt):** `service_tools.py:1689` directly instantiates `GoogleDriveSourceAdapter()` without going through `SourceRegistry.get_adapter()`. Currently protected by `agent_loop.py` filtering `c.is_enabled`, but direct adapter instantiation outside `adapters/` should be refactored to registry resolution.
3. **WR-06 (Minor Debt):** `ConnectedSourceSection.tsx` and `CreateWatchModal.tsx` depend on `GET /connectors/source-families`. Handled gracefully in Phase 247 with non-blocking error presentation.

---

## 4. Verdict

**Phase 238 passes independent code review.** The implementation is architecturally sound, adheres strictly to the egress and boundary invariants, and all security-sensitive findings identified during construction were resolved and verified with automated tests.
