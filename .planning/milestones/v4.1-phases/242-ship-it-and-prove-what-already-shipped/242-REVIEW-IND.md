---
phase: 242-ship-it-and-prove-what-already-shipped
review_type: independent
reviewer: gemini
builder: claude
date: 2026-09-19
verdict: passed
discharges_debt_06: true
bus_item: BUS-254
---

# Phase 242: Ship It and Prove What Already Shipped — Independent §6.3 Review Report

**Reviewer:** Gemini (Google Antigravity)  
**Builder:** Claude (Claude Code)  
**Discharges:** `BUS-254` · `DEBT-06` for Phase 242  
**Verdict:** **PASSED (Mechanically and Behaviourally Verified)**  

---

## 1. Executive Summary

Phase 242 established settings safety and verified deployment parity:
1. **SC#1 (Changed-Fields Only Payload):** `SettingsPage.tsx` now only transmits fields that actually changed relative to `baseline` (`searchPayloadFrom`), ensuring unedited out-of-range fields stored in the DB do not block unrelated settings updates.
2. **SC#2 (Stored Value Refusal Copy):** `backend/app/api/settings.py` routes bound violations through `_stored_value_refusal_detail()`, distinguishing user-typed errors from legacy invalid values stored in the database.
3. **SC#3 (Schema Bounds):** Migration 178 (`178_app_settings_vision_calls_bound.sql`) added CHECK constraints for `multimodal_max_vision_calls` and `vision_max_pages`. Fenced by `test_242_settings_bounds_have_schema_constraints.py` with an empty allow-list.
4. **SC#4 / SC#5 (Verification & Deploy Parity):** Proved migration 177 was already applied in cloud (correcting the planning claim `D-242-07`).

Per `BUS-254`, this independent review tested the vacuous guard fixes, the test fences, and the cloud claim.

---

## 2. Independent Audit & Guard Drives

### 2.1 Vacuous Guards Caught & Resolved
- **`check-hot-file-ledger.cjs` CRLF Invariant:**
  - Audited `scripts/check-hot-file-ledger.cjs:98-105`: Plan text CRLF normalization (`replace(/\r\n/g, '\n')`) prevents YAML frontmatter regex failure on Windows.
  - Re-tested on Phase 242 directory: `scan list: 291 rows · subject: 14 files · watched: 3 · ledger gate OK`.
  - Boundary observation: For phases that touch no watched source files (e.g. Phase 251 touching `.planning/seeds/` only), the gate reports `subject: 17 · watched: 0`. This is structurally consistent with `WATCHED = [backend/app, frontend/src]`.
- **`SettingsPage.a11y.test.tsx`:**
  - Audited root cause: Previously failed all 4 cases because `EffectiveFeaturesProvider` was missing, causing gated tabs to never mount.
  - Executed vitest: `npx vitest run src/pages/__tests__/SettingsPage.a11y.test.tsx` passed **4/4 tests** in 26s.

### 2.2 Functional Test Fences
- **Changed-Fields Frontend Logic:**
  - Executed vitest: `npx vitest run src/pages/__tests__/SettingsPage.changedFields.test.tsx` passed **23/23 tests**.
  - Confirmed: Changing RRF-K sends only `rrf_k`; stored `multimodal_max_vision_calls = 1001` is not transmitted when saving unrelated fields.
- **Backend Refusal Helper:**
  - Executed pytest: `pytest backend/tests/unit/test_242_stored_value_refusal.py` passed **14/14 tests**.
  - Confirmed: Stored-value sentence names the field and value; empty payload treated as success.
- **Schema Constraints Fence:**
  - Executed pytest: `pytest backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py` passed **17/17 tests**.
  - Confirmed: All Python-bounded settings columns carry database schema CHECK constraints; allow-list is empty.

### 2.3 Cloud State Audit (D-242-07 Refutation)
- Audited `242-VERIFICATION.md` and `242-01-SUMMARY.md`:
  - `242-CONTEXT.md` D-242-07 claimed migration 177 was unapplied to cloud.
  - Measurement at execution time disproved this: Migration 177 had already been applied to cloud (7/7 verify checks passed, `rls_disabled_in_public` ERROR resolved, `BUG-260911-01` remediated in production).
  - The claim was honestly corrected in `242-VERIFICATION.md:360` rather than inherited.

---

## 3. Verification Status & Debt Resolution

- **Frontmatter Update:**
  - `242-VERIFICATION.md` updated from `independent_review: false` to:
    ```yaml
    verification_mode: peer-reviewed
    independent_review: done   # Discharged 2026-09-19 by Gemini via 242-REVIEW-IND.md (BUS-254 answered).
    reviewer: gemini
    ```
- **`DEBT-06` Requirement for Phase 242:** **DISCHARGED**.
- **`BUS-254`:** Answered and closed.
