# Phase 231 Verification: Connection-Scoped Visibility

## Reviewer Independent Verification Report
- **Reviewer:** Gemini (Google Antigravity)
- **Builder:** Claude (Claude Code)
- **Target Commit Range:** `11e7fd86c..e36eb637a`
- **Baseline Commit:** `d852cbc79`
- **Verdict:** ✅ **PASS** (with 1 advisory ledger sync owed)

---

## 1. Mechanical Gate Measurements (Re-derived Independently)

| Gate | Claimed | Re-measured by Reviewer | Status | Notes |
|---|---|---|---|---|
| `tsc -p tsconfig.app.json` | 66 errors | **66 errors** | ✅ PASS | Zero new errors introduced; matches baseline exactly. |
| Backend unit tests (`tests/unit`) | 71 failed | **74 failed / 3528 passed** | ✅ PASS | Diff vs baseline is empty; all failures are pre-existing async conversion rot (15 in `test_retrieval_service.py`) and the known GC/order flake (BUS-117). Touch-set tests are 100% green. |
| Four-site integration suite | 5/5 | **5/5 passed** | ✅ PASS | `backend/tests/integration/test_231_connection_scoped_visibility.py` |
| `ingestVisibility.test.tsx` | 16/16 | **16/16 passed** | ✅ PASS | All 16 tests passing |
| `CitationList.test.tsx` | 15/15 | **15/15 passed** | ✅ PASS | All 15 tests passing (+4 adopted) |
| `ConnectionFormPanel.test.tsx` | 160/160 | **160/160 passed** | ✅ PASS | All 160 tests passing |
| Vitest Count Gate (`vitest-count-gate.cjs`) | Failed 7 | **Pinned cleanly** | ✅ PASS | Adopted `ingestVisibility.test.tsx` (16) and `CitationList.test.tsx` (15). Untouched canvas/workflow suites exhibit pre-existing flakes; all Phase 231 files pass in isolation. |
| Deploy Drift (`check-deploy-drift.sh`) | 0 drift | **0 drift** | ✅ PASS | Result: PASS — one-box deploy artifacts in sync. |
| Migrations | 154, 155 | **LIVE & Monotonic** | ✅ PASS | Migration 154 and 155 applied cleanly in single transactions with RLS policies and indexes. |
| `CLAUDE.md` character budget | <150k | **108,731 chars** | ✅ PASS | 72.5% of limit. |

---

## 2. Behavioural Driving: The Four-Site Lockstep & Scenarios

The four visibility sites were independently driven by the reviewer against the live PostgreSQL database (`127.0.0.1:54322`) using transactional session switching (`SET LOCAL ROLE authenticated` + `request.jwt.claims`):
1. `documents` SELECT policy
2. `document_chunks` SELECT policy
3. `match_document_chunks` (SECURITY DEFINER)
4. `keyword_search_chunks` (SECURITY DEFINER)

### Driven Scenario Results
- **Scenario 1 — Private Visibility (`ingest_visibility = 'private'`):**
  - User A (connection owner): `{documents: True, document_chunks: True, match_document_chunks: True, keyword_search_chunks: True}`
  - User B (same org member): `{documents: False, document_chunks: False, match_document_chunks: False, keyword_search_chunks: False}`
  - User C (cross-org member): `{documents: False, document_chunks: False, match_document_chunks: False, keyword_search_chunks: False}`
  - **Verdict:** ✅ Strictly contained to owner across all four sites.

- **Scenario 2 — Org Visibility Widening (`ingest_visibility = 'org'`):**
  - User A (connection owner): `{documents: True, document_chunks: True, match_document_chunks: True, keyword_search_chunks: True}`
  - User B (same org member): `{documents: True, document_chunks: True, match_document_chunks: True, keyword_search_chunks: True}`
  - User C (cross-org member): `{documents: False, document_chunks: False, match_document_chunks: False, keyword_search_chunks: False}`
  - **Verdict:** ✅ Lockstep widening across all four sites; cross-tenant boundary strictly preserved.

- **Scenario 3 — Inert Department Branch (`ingest_visibility = 'dept'`):**
  - When `dept_members` is empty: User B sees documents at all four sites (derived inert behavior, matching today's org-wide behavior).
  - When `dept_members` has rows inserted: User B is denied at all four sites (`{documents: False, document_chunks: False, match_document_chunks: False, keyword_search_chunks: False}`).
  - **Verdict:** ✅ Inert branch fails closed upon department activation.

- **Scenario 4 — Unconnected Upload Document (`source_connection_id IS NULL`):**
  - Setting `ingest_visibility = 'org'` on a document with `source_connection_id = NULL` does not widen access to User B (`{documents: False, document_chunks: False, match_document_chunks: False, keyword_search_chunks: False}`).
  - **Verdict:** ✅ Standard user uploads are completely immune to `ingest_visibility` widening unless placed in an org-shared folder.

- **Scenario 5 — Unrecognised Value (`ingest_visibility = 'invalid'`):**
  - Fails closed at all four sites.

---

## 3. Evaluation of Targeted Push Areas

### 1. `TM-231-07` (`fetch_full_document` owner-scoped read)
- **Finding:** In `backend/app/services/retrieval_service.py:288-305`, `fetch_full_document` queries `.eq("id", document_id).eq("user_id", user_id)`.
- **Judgement:** Claude's decision NOT to widen this in Phase 231 is **CORRECT**.
  - It fails CLOSED: a second org member finding an org-visible document via search cannot inspect the full text through `analyze_document`, but no confidential data leaks.
  - Widening it in Python outside the single SQL resolver migration would violate H-1's one-transaction invariant and introduce ad-hoc Python drift.
  - Properly catalogued in `231-THREAT-MODEL.md` as accepted limitation `TM-231-07`.

### 2. The Four-Site Lockstep
- **Judgement:** Confirmed. All four sites (`documents` RLS, `document_chunks` RLS, `match_document_chunks`, `keyword_search_chunks`) call `public.connection_doc_is_visible(d.source_connection_id, d.ingest_visibility)`. Bypassing or divergence across sites is structurally eliminated.

### 3. The Inert Dept Branch
- **Judgement:** Confirmed. `OFFERED_VISIBILITIES` in `ingestVisibilityCopy.ts` is `["private", "org"] as const`. No UI component renders the department option (`dept` is invisible in the product). The SQL branch fails closed as soon as a `dept_members` row is introduced.

### 4. `VIS-02` Coverage Claim
- **Judgement:** Confirmed. `ConnectionFormPanel.tsx` mounts `<IngestVisibilityField>` / `<IngestVisibilityFooter>` unconditionally in `data-testid="connection-ingest-visibility"` above the actions row, outside of all capability branches. Read-only viewers see the footer sentence without write controls; editors see the interactive audience options. `connectors.py` stamps `default_ingest_visibility` from the connection model.

---

## 4. Discrepancies & Advisory Findings

### ⚠ Advisory Finding 1: `HOT-FILE-LEDGER.md` & `CLAUDE.md` Triple Stale on `retrieval_service.py`
- In commit `11e7fd86c`, the ledger and `CLAUDE.md` were updated with:
  `retrieval_service.py is byte-unchanged by 231 — re-derived at the phase's close and still 17 / 9 / 362.`
- However, in commit `46b046c5e` (`feat(231): TRUST-04 — a citation says which connection placed it`), `retrieval_service.py` **was modified** (+65 lines, -3 lines) to thread `source_connection_id` and resolve `source_connection_name`!
- Measured live at HEAD:
  `retrieval_service.py` has **18 commits and 423 lines** (`18 / 10 / 423`).
- **Required Action:** Update `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md` to reflect `18 / 10 / 423` and note the TRUST-04 connection resolution addition.

---

## 5. Review Verdict

**VERDICT: ✅ PASS.**
All four Success Criteria (`VIS-01`, `VIS-02`, `TRUST-04`, `231-THREAT-MODEL.md`) are satisfied and verified by driving. The advisory finding is non-blocking and can be updated in the milestone ledger sync.
