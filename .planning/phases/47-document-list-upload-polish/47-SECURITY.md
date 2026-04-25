---
phase: 47
slug: document-list-upload-polish
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-25
---

# Phase 47 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client→API (Plan 01) | Root document count badge — purely presentational, no new API calls | None — count derived from already-loaded `documents` prop |
| Client→API (Plan 02) | File upload endpoint receives untrusted binary data | Raw file bytes (untrusted size) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-47-01 | Information Disclosure | Root document count badge (`FolderTree.tsx`) | accept | Count is derived from the `documents` prop already present on the client — no new data fetched, no new leakage surface | closed |
| T-47-02 | Denial of Service | Upload endpoint (`documents.py`) | mitigate | 50 MB hard limit at `documents.py:155–160` — `MAX_FILE_SIZE = 50 * 1024 * 1024`; raises HTTP 422 before storage or processing is attempted | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-47-01 | T-47-01 | Root document count is already available on the client in the `documents` prop — rendering it as a badge exposes no additional data. Zero incremental leakage risk. | Developer | 2026-04-25 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-25 | 2 | 2 | 0 | gsd-secure-phase (orchestrator) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-25
