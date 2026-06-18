---
phase: 112-metadata-enrichment-document-detail-panel-manual-edit
audited: 2026-06-18
asvs_level: 1
block_on: high
threats_total: 17
threats_closed: 16
threats_accepted: 1
threats_open: 0
status: SECURED
---

# Phase 112 Security Audit — Threat-Mitigation Verification

Verifies every threat in the Phase 112 register against the SHIPPED implementation
(register authored at plan time — no blind scan for new threats). 16 `mitigate`
threats verified present in code by file:line; 1 `accept` confirmed still holds.
**threats_open: 0.**

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-112-01-01 | Elevation/Tampering | mitigate | CLOSED | `backend/app/api/documents.py:1382-1384` (SELECT `.eq("user_id")` + `.eq("is_latest", True)`) and `:1437-1438` (UPDATE `.eq("user_id")`); 404 not 403 at `:1391`, `:1396`, `:1442` |
| T-112-01-02 | Info disclosure | mitigate | CLOSED | All owner misses → `HTTPException(404)` (`:1391`, `:1396`, `:1442`); no 403 path exists in the route — no existence leak |
| T-112-01-03 | Tampering | mitigate | CLOSED | Leading-`_` reject `:1401-1402`; allow-list `field not in _METADATA_BUILTINS and field not in enabled_custom` `:1409-1410`; `enabled_custom` from `read_enabled_field_defs` `:1403-1408`; `_METADATA_BUILTINS = set(DocumentMetadata.model_fields)` `:1355` |
| T-112-01-04 | Repudiation/Tampering | mitigate | CLOSED | Server stamp `meta.setdefault("_source", {})[field] = "user"` `:1427`; body model has NO `source` field `:74-86`; audit row `write_audit_entry(action_type="metadata.update", ...)` `:1446-1451` |
| T-112-01-05 | DoS | mitigate | CLOSED | Both route `.execute()` calls in `run_in_threadpool` — SELECT `:1379-1387`, UPDATE `:1434-1440`; `read_enabled_field_defs` also threadpool-wrapped `:1405-1407` |
| T-112-01-06 | Tampering | mitigate | CLOSED | `_source` written as nested `dict[str,str]` sibling of `_confidence` (`:1427`, `:1430-1431`); never a top-level scalar. Flat `@>` containment proven unaffected by `test_112_flat_filter_with_source.py` (live) |
| T-112-02-01 | Tampering/DoS-of-data | mitigate | CLOSED | Merge guard at the SINGLE write site (`ingest_document` `:1584-1624`, only metadata-value UPDATE at `:1733-1744`); reads `prior_meta["_source"]` `:1609-1610`, restores `_source='user'` fields `:1614-1621`; reads prior map, not a request field (no `body` in scope) |
| T-112-02-02 | DoS-of-data | mitigate | CLOSED | `metadata_dict = metadata_dict or {}` BEFORE the user-field loop `:1612` — a degrade (None) never wipes prior user edits |
| T-112-02-03 | Tampering | mitigate | CLOSED | `metadata_dict["_confidence"].pop(fld, None)` for each preserved user field `:1623-1624` — override carries no model score |
| T-112-02-04 | Tampering | mitigate | CLOSED | `_source`/`_confidence` remain nested sub-keys throughout the guard (`:1613`, `:1621`, `:1623`); top-level containment unaffected (`test_112_flat_filter_with_source.py` live GREEN) |
| T-112-03-01 | UX-integrity/Tampering | mitigate | CLOSED | `frontend/src/components/metadata/ConfidenceChip.tsx`: `source==="user"` → neutral "Edited", no score/no green `:72-79`; `score===undefined` → neutral "Extracted", never "High" `:84-91`. vitest-asserted (`ConfidenceChip.test.tsx`, 8/8) |
| T-112-03-02 | Repudiation/Tampering | mitigate | CLOSED | `frontend/src/lib/api.ts:1997-2003` — `updateDocumentMetadata` body is `JSON.stringify({ field, value })` only; no `source` key |
| T-112-03-03 | Info disclosure | **accept** | ACCEPT-OK | `frontend/src/lib/api.ts:2012-2016` — `listMetadataFields` is a thin GET consumer of the server-secured `/metadata-fields`; adds no client-side filter that bypasses server own-or-global scoping. Accept rationale holds (no new disclosure surface) |
| T-112-04-01 | Repudiation/UX-integrity | mitigate | CLOSED | `frontend/src/components/metadata/DocumentDetailPanel.tsx`: `setSavedField` only inside the `await updateDocumentMetadata(...)` try-success branch `:177-180`; error → `setErrorField` `:183-186`; receipt `role=status` `:325-334`, error `role=alert` `:337-341` |
| T-112-04-02 | Tampering/UX-integrity | mitigate | CLOSED | `DocumentDetailPanel.tsx:213-230` — only the Metadata `PanelSection` renders; no Relationships/Classification/Versions stubs anywhere in the file |
| T-112-04-03 | Info disclosure | mitigate | CLOSED | `DocumentDetailPanel.tsx:94-103` (`buildFieldRows`) — `BUILTIN_FIELDS ∪` custom defs filtered `enabled && !field_key.startsWith("_") && !builtin`; field set is never `Object.keys(metadata)` |
| T-112-04-04 | DoS/a11y | mitigate | CLOSED | Panel-scoped AA tokens (`DocumentDetailPanel.tsx:81`, `:205`, `:253`, `:329`, `:338`); focus close-button on open `:156-158`; APG accordion via `PanelSection`; InlineEdit Esc→trigger focus restore (`InlineEdit.tsx:178-183`), guarded blur (no keyboard trap) `:167-176`. vitest-axe `toHaveNoViolations` (`DocumentDetailPanel.a11y.test.tsx`, 7/7) |

## Hand-Verified High-Stakes Controls

The 3 highest-stakes controls were hand-verified by reading the actual shipped code
(not trusting the SUMMARY narratives):

1. **T-112-01-01 (RLS owner-scope)** — read `documents.py:1378-1442`. Confirmed
   `.eq("user_id", current_user["id"])` on BOTH the SELECT (`:1383`) and the UPDATE
   (`:1438`), plus the `is_latest=True` SELECT filter, the None-guard 404 (`:1395-1396`),
   and the post-UPDATE `if not result.data: 404` (`:1441-1442`). No 403 branch — no
   existence leak. CLOSED, not trusted blind.
2. **T-112-01-03 (field allow-list / `_`-key reject)** — read `documents.py:1398-1410`
   and `:1355`. Confirmed the leading-`_` reject fires BEFORE the allow-list check, and
   the allow-list is `_METADATA_BUILTINS` (derived from `DocumentMetadata.model_fields`)
   ∪ `read_enabled_field_defs` keys. A `_source`/`_confidence` write is double-blocked
   (underscore reject + not in builtins). CLOSED.
3. **T-112-01-04 (server-stamped provenance)** — read `documents.py:74-86` (body model)
   and `:1422-1451`. Confirmed `MetadataUpdateRequest` exposes only `field` + `value`
   (no `source`), the route hard-stamps `_source[field]='user'`, drops stale
   `_confidence[field]`, and writes the `metadata.update` audit row keyed to the doc +
   field + actor. A client cannot assert provenance. CLOSED.

## Unregistered Flags

None. Both backend SUMMARYs (`## Threat Model Compliance`) and both frontend SUMMARYs
(`## Threat surface`) declare no new security-relevant surface beyond the register.
The only deviations logged (None-guard on SELECT, defensive-copy WR-02, blur-guard
WR-04) are hardening that strengthens existing register threats, not new attack surface.

## Verdict

**SECURED** — 16/16 mitigations present in shipped code, 1/1 accept holds,
threats_open: 0. ASVS L1, block_on=high: no high-severity threat is open.
