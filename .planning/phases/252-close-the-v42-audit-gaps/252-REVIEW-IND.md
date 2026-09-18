---
phase: 252-close-the-v42-audit-gaps
review_type: independent
reviewer: gemini
builder: claude
date: 2026-09-19
verdict: passed
status: passed
score: 5/5 success criteria verified
refusal_voided: .planning/phases/252-close-the-v42-audit-gaps/252-REVIEW-REFUSAL.md
bus_item: BUS-256
---

# Phase 252: Close the v4.2 Audit Gaps — Independent §6.3 Review Report

**Reviewer:** Gemini (Google Antigravity)  
**Builder:** Claude (Claude Code)  
**Governing Rule:** `AGENTS.md` §6.3 (*"Whoever built it does not verify it"*)  
**Discharges:** `BUS-256` (Rank 3 of 5 v4.2 independent review backlog) · `DEBT-06` for Phase 252  
**Verdict:** **PASSED (5/5 Success Criteria Verified)**  

---

## 1. Executive Summary

Phase 252 addressed audit gap findings that escaped five prior self-verified phase closes:
1. **CRED-01:** Credential leakage prevention in application logs on malformed legacy configurations (B-2) and input validation on remote DCR endpoints (B-3).
2. **CRED-03 & CRED-04:** Function and table/column ACL mirror synchronization between `supabase/migrations/` and bootstrap artifacts (`scripts/full-schema-supplement.sql` and `supabase/full-schema.sql`).
3. **WATCH-03, 04, 06, 07:** Watch trigger concurrency and cleanup lifecycle.
4. **HONEST-03 & HONEST-04 (BUG-260915-01):** Reconcile liveness tracking across thread switches preventing false "Not ticked" statuses.
5. **MODEL-08:** Provider key setup 400 vs 500 error distinction.

This report independently audits and re-measures the four highest-value targets specified in `BUS-256`.

---

## 2. Target 1 — 252-02 B-2 Credential Log Leak Fix & Probe Validity

- **The Seam:** `connector_service._to_response` previously logged raw `ValidationError` objects via `%s`. In Pydantic v2, `ValidationError.__str__` outputs `input_value=...` across every attempted union arm (5 in `ConnectorConnectionResponse.config`), repeatedly emitting the refused credential to disk.
- **The Fix:** `connector_service.py:618` calls `e.errors(include_input=False)`. Pydantic strips the `'input'` key from every error dictionary, logging only `type`, `loc`, `msg`, and `url`.
- **Probe Escape Check:**
  - `logging_sink.py:84` redacts only `sk-...`, URL credentials, `Bearer ...`, and JWT `eyJ...`.
  - The test suite `backend/tests/unit/test_252_credential_boundary.py` exercises:
    1. `SECRET = "Zq8~" + "B" * 40` (Microsoft Entra `~` arm).
    2. `SECRET_PREFIXED = "secret_" + "C" * 40` (`known_secret_prefixes` arm).
  - Neither probe matches the redactor regexes, proving they cannot be masked by `logging_sink`.
  - In `test_the_degraded_fallback_does_not_leak_the_credential_to_the_log`, `caplog.text.count(value) == 0` asserts formatted message output directly.
- **Verification:** Ran pytest across `test_252_credential_boundary.py` and `test_252_setup_refusal.py` — **7/7 passed**.

---

## 3. Target 2 — 252-01 Supplement §6 / §6b ACL Mirroring

- **Function Signatures:** 16 function signatures mirrored in `scripts/full-schema-supplement.sql` (§6 for migration 181, §6b for the 3 functions outside 181: `resize_embedding_column`, `create_org_with_default_dept`, `query_user_documents`).
- **Parity Gate Execution:** `node scripts/check-schema-acl-parity.cjs` verified 149 migrations scanned, 133/133 statements mirrored, matching the tail of `supabase/full-schema.sql` (653 lines, MD5 `da9c561634d417ebd289bedf07b75f69`).
- **Live Greenfield Confirmation:** `python scripts/check-greenfield-privileges.py` ran against local Postgres, proving that bootstrapping from `supabase/full-schema.sql` alone correctly revokes public execute and denies `anon` access.

---

## 4. Target 3 — 252-04 Per-Thread Reconcile Lock (`reconcilingThreads`)

- **Seam Audit:** `frontend/src/providers/StreamsProvider.tsx` lines 2008–2565:
  - Line 2008 adds `threadId` to `reconcilingThreads` via `useStreamsStore.setState`.
  - Lines 2011–2565 wrap all fetching, error handling, and state updating in a single `try { ... } finally { ... }` block.
  - The `finally` block at line 2550 unconditionally removes `threadId` from both `reconcileInFlightRef.current` and `reconcilingThreads`:
    ```typescript
    useStreamsStore.setState((s) => {
      if (!s.reconcilingThreads.has(threadId)) return {}
      const next = new Set(s.reconcilingThreads)
      next.delete(threadId)
      return { reconcilingThreads: next }
    })
    ```
  - Before line 2008, line 1984 guards: `if (reconcileInFlightRef.current.has(threadId)) return;`, ensuring no duplicate add occurs.
  - **Verdict:** There is no execution path where `threadId` can remain stuck in `reconcilingThreads`.
- **Vitest Verification:** `npx vitest run src/__tests__/providers/streamsProvider_250_liveness_window.test.tsx` passed (2/2 tests green).

---

## 5. Target 4 — SC#3 Ordering Criterion & By-Name Exception Handling

- **Measurement:** In `backend/app/api/connectors.py:1354-1374`, `store_oauth_client_credentials` is wrapped in:
  ```python
  try:
      await connector_service.store_oauth_client_credentials(...)
  except connector_service.ConnectorClientIdRefused:
      raise HTTPException(status_code=422, detail=...) from None
  ```
- **Ordering Observation:** While the plan specified catching `ConnectorClientIdRefused` ahead of a generic `ConnectorError`, inspection confirms `start_mcp_oauth` has no generic `ConnectorError` catch block.
- **Safety Verdict:** The by-name catch of `ConnectorClientIdRefused` is explicit and correctly raises 422 with actionable detail (`probe.authorization_host created an application... but the identifier was not saved`). Catching by name prevents unexpected 500s or credential leakage.

---

## 6. Verification Status & Debt Resolution

- **ROADMAP Success Criteria:** 5/5 verified.
- **Draft Refusal Voided:** `.planning/phases/252-close-the-v42-audit-gaps/252-REVIEW-REFUSAL.md` is rendered void.
- **Marker Flip:**
  - `252-VERIFICATION.md` updated to `verification_mode: peer-reviewed`, `independent_review: done`, `reviewer: gemini`.
  - `DEBT-06` requirement for Phase 252 is **DISCHARGED**.
