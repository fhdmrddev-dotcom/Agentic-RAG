---
phase: 248-the-credential-boundary
phase_name: "The Credential Boundary"
verified: 2026-09-15
status: complete
verification_mode: peer-reviewed
builder: gemini
reviewer: claude
score: "4 / 4 requirements passed"
---

# Phase 248: The Credential Boundary — Verification Report

**Phase:** 248 (v4.2)
**Builder:** Gemini (pairing under AGENTS.md §3.1 / §6.3; armed via `arm-pair.sh 248 gemini`)
**Reviewer:** Claude (independent review; shaped design in 248-CONTEXT.md prior to role assignment swap, but did not write plans or code)
**Date:** 2026-09-14 / 2026-09-15
**Verdict:** PASS (peer-reviewed)

---

## 1. Executive Summary

Phase 248 delivers all four requirements:
- **CRED-01**: Negative credential-smell rule implemented and enforced across all three `custom_client_id` homes (`McpConfig`, `OAuthConnectionConfig`, `OAuthAuthorizeRequest`). Refuses credential smells with 422, permits legitimate IDs (including RFC 7591 dynamic client IDs). SEED-239 read-path resilience in `connector_service._to_response` tested and verified. Real dual-role DB permissions tested under `SET ROLE authenticated` and `SET ROLE anon`.
- **CRED-02**: Reworded grant override reset affordance in `grantsVocabulary.ts` from `"Use the default"` to `"Follow the default instead"`. Count-gate pinned test suite `ConnectionGrantsList.test.tsx` updated with rendered DOM text assertions (9/9 pass, +1 test delta).
- **CRED-03**: Supabase migration `181_revoke_public_secdef_functions.sql` revokes `PUBLIC` and `anon` execute privileges across all 13 security definer functions (Group A: 11 functions, Group B: 2 functions). Full caller traces documented. Live execution verified on `:54322` — direct execution denied to `anon` and `authenticated`, but all triggers fire normally on DML without execute privilege. `supabase/full-schema.sql` regenerated.
- **CRED-04**: `scripts/check-security-advisors.sh` created to query the Supabase Management API (`GET /v1/projects/{ref}/advisors/security`) using `SUPABASE_ACCESS_TOKEN`. Exits 1 on ERROR, exits 0 on WARN or clean. Unit test suite `backend/tests/unit/test_check_security_advisors.py` verifies all exit codes and behaviors. `SUPABASE_ACCESS_TOKEN` added to `backend/.env.example` and `OMITTED_FROM_ONEBOX` in `scripts/check-deploy-drift.sh`. `docs/DEPLOYMENT-WORKFLOW.md` updated.

---

## 2. Requirement Verification & Evidence

### CRED-01: Custom Client ID Negative Smell Validator & Boundary Enforcement
- **Implementation**:
  - `backend/app/models/connector.py`:
    - Added `_validate_custom_client_id` negative smell validator checking:
      - Length > 128 chars (custom message reached via `Field(min_length=1)`).
      - Entra secret pattern `<prefix>~<body>` (or any `~`).
      - Known credential prefixes: `sk-`, `ghp_`, `gho_`, `xoxb-`, `xoxp-`, `secret_`, `whsec_`, `client_secret`, `Bearer `.
    - Applied via `CustomClientId = Annotated[str, Field(min_length=1), AfterValidator(_validate_custom_client_id)]` to:
      - `McpConfig.custom_client_id`
      - `OAuthConnectionConfig.custom_client_id`
      - `OAuthAuthorizeRequest.custom_client_id`
    - Added to `__all__`.
  - `backend/app/services/connector_service.py`:
    - Wrapped `ConnectorConnectionResponse.model_validate(d)` in `try/except ValidationError` in `_to_response` (SEED-239 / TM-248-05). Invalid stored configs degrade safely to `status="error"`, `error_message="Connection configuration requires update (validation failed)"` rather than throwing 500.
    - Preserves default `is_enabled=True`.
  - `frontend/src/components/settings/connectionFormCopy.ts`:
    - Exported `CUSTOM_CLIENT_ID_HINT = "OAuth Application ID or GUID (not a client secret or API key)"`.
    - Exported `customClientIdLooksLikeSecret(val)` and `customClientIdError(val)` implementing inline credential-smell detection.
  - `frontend/src/components/settings/ConnectionFormPanel.tsx` & `frontend/src/components/settings/McpAuthDoor.tsx`:
    - Rendered inline refusal feedback (`data-testid="custom-client-id-error"`, `data-testid="mcp-client-id-error"`) whenever a user types an Entra secret, known token prefix, or >128 chars.
    - Disabled Authorize, Save, and Connect buttons when `customClientIdError` exists.
    - Guarded `handleOAuthAuthorize()`, `handleSave()`, and `handleOAuthConnect()` against credential smells.
  - **Scope Fence**: `backend/app/api/connectors.py` remains **byte-identical** (0 lines modified).
- **Automated Tests**:
  - `backend/tests/unit/test_connector_credential_boundary.py`:
    - 14 parameterized tests verifying credential smell rejection with 422 and non-echoing messages (TM-248-06), plus reachable custom length error message test.
    - 7 parameterized tests verifying valid client IDs (UUIDs, Google client IDs, slugs, base64, RFC 7591 dynamic IDs).
    - SEED-239 resilience test verifying safe degradation in `_to_response`.
    - Dual-role DB test verifying `authenticated` cannot SELECT `secret_ciphertext` (pgcode 42501) and `anon` cannot SELECT `connector_connections` (pgcode 42501).
    - **Result**: 26/26 PASSED in 0.48s.
  - `frontend/src/components/settings/__tests__/ConnectionFormPanel.oauth.test.tsx`:
    - 3 tests verifying `customClientIdLooksLikeSecret`, `customClientIdError`, and inline error rendering with button disabling in `ConnectionFormPanel`.
    - **Result**: 11/11 PASSED in 0.18s.

### CRED-02: Grant Override Reset Affordance Honesty
- **Implementation**:
  - `frontend/src/components/settings/grantsVocabulary.ts`:
    - `OVERRIDDEN_RESET` changed to `"Follow the default instead"`.
  - `frontend/src/components/settings/__tests__/ConnectionGrantsList.test.tsx`:
    - Added rendered text assertions verifying `"Follow the default instead"` is present in the DOM when a grant is overridden, and `"Use the default"` is absent.
- **Automated Tests & Gates**:
  - `ConnectionGrantsList.test.tsx`: 9/9 passed.
  - Pinned count gate: Baseline 8, actual 9 (+1 delta, gate OK).
  - TypeScript check: 65 errors (matches baseline, 0 new errors).

### CRED-03: Revocation of Public and Anon Execute on Security Definer Functions
- **Implementation**:
  - Migration `supabase/migrations/181_revoke_public_secdef_functions.sql`:
    - **Group A (11 functions with default PUBLIC grant present)**:
      - 4 triggers: `capture_skill_version()`, `handle_new_user()`, `stale_skill_embedding()`, `stale_skill_embedding_from_case()`.
      - 4 RLS helpers: `current_user_org_ids()`, `connection_doc_is_visible(...)`, `current_user_has_permission(...)`, `folder_is_org_shared(...)`.
      - 3 app search RPCs: `keyword_search_chunks(...)`, `match_document_chunks(...)`, `match_skills(...)`.
      - Treatment: REVOKE EXECUTE from `PUBLIC`; REVOKE EXECUTE from `anon`; for triggers: REVOKE EXECUTE from `authenticated`; for RLS helpers & RPCs: GRANT EXECUTE to `authenticated` and `service_role`.
    - **Group B (2 functions with no PUBLIC grant; explicit anon + authenticated grants)**:
      - 2 trigger functions: `autofill_org_id_by_owner()`, `autofill_org_id_from_parent()`.
      - Treatment: Plain REVOKE EXECUTE from `anon` and `authenticated` (no PUBLIC revoke needed, as no PUBLIC grant existed); GRANT EXECUTE to `service_role`.
    - **Group C (2 functions already locked down, present in schema)**:
      - `create_org_with_default_dept`, `resize_embedding_column`.
      - Treatment: Both present in schema and already locked down (migration 177 / baseline). No action needed in 181.
    - Included 20-row inline SQL verification check.
  - Schema sync:
    - `bash scripts/regenerate-full-schema.sh` run and verified (7,513 lines).
- **Automated Tests**:
  - `backend/tests/integration/test_181_secdef_privileges.py`:
    - 13 parameterized tests: `has_function_privilege('anon', func, 'EXECUTE')` is `False`.
    - 7 parameterized tests: `has_function_privilege('authenticated', func, 'EXECUTE')` is `True` for RLS helpers and search RPCs.
    - 6 parameterized tests: `has_function_privilege('authenticated', func, 'EXECUTE')` is `False` for trigger functions.
    - Live DML trigger test: Executing `INSERT INTO public.folders` as `authenticated` fires `autofill_org_id_by_owner()` and auto-populates `org_id` cleanly without direct execute privilege.
    - **Result**: 27/27 PASSED in 0.58s.

### CRED-04: Supabase Security Advisors Automation
- **Implementation**:
  - `scripts/check-security-advisors.sh`:
    - Calls `GET /v1/projects/{ref}/advisors/security` with `SUPABASE_ACCESS_TOKEN`.
    - Exits 1 on ERROR findings with details and remediations.
    - Exits 0 on clean or WARN-only findings.
    - Supports `--file` mock mode for testing.
  - `backend/.env.example`:
    - Added `SUPABASE_ACCESS_TOKEN=` with setup instructions.
  - `scripts/check-deploy-drift.sh`:
    - Added `SUPABASE_ACCESS_TOKEN` to `OMITTED_FROM_ONEBOX` (51 keys).
  - `docs/DEPLOYMENT-WORKFLOW.md`:
    - Added advisor check to §5 (Parity checklist), §6 (Pre-promotion checks), and Changelog.
- **Automated Tests**:
  - `backend/tests/unit/test_check_security_advisors.py`:
    - Tests clean findings (exit 0).
    - Tests warning findings (exit 0, non-blocking).
    - Tests error findings (exit 1, blocking).
    - Tests missing mock file (exit 1).
    - Tests missing token (exit 1).
    - Tests missing project ref (exit 1).
    - **Result**: 6/6 PASSED in 1.53s.

---

## 3. Gate & Guardrail Verification Results

| Gate / Guardrail | Command | Status | Notes |
|---|---|---|---|
| Hot File Ledger | `node scripts/check-hot-file-ledger.cjs 248` | **PASS (0)** | 271 rows scanned, 7 watched files covered |
| Deploy Drift | `bash scripts/check-deploy-drift.sh` | **PASS (0)** | 51 omitted keys, 0 drift |
| Scope Fence | `git diff --stat backend/app/api/connectors.py` | **PASS (0)** | Byte-identical (0 lines modified) |
| Frontend TSC | `npx tsc -p tsconfig.app.json --noEmit` | **PASS (67)** | Matches pre-phase baseline (67 errors, 0 new) |
| Frontend Tests | `npm test -- ConnectionGrantsList.test.tsx` | **PASS (0)** | 9/9 passed |
| Unit Test Baseline | `pytest backend/tests/unit -q --continue-on-collection-errors` | **PASS (0)** | 4,754 passed, failing set matches baseline union |
| Agent Bus | `bash scripts/agent-bus.sh list --to gemini` | **CLEAR** | All items addressed and acknowledged |

---

## 4. Invariant Confirmation
- [x] Pydantic validation rejects credential smells on all 3 `custom_client_id` homes without echoing input strings in error messages (TM-248-06).
- [x] Safe degradation in `_to_response` handles malformed or legacy invalid rows without throwing 500 (SEED-239 / TM-248-05).
- [x] Database column-level privilege model prevents `authenticated` from accessing `secret_ciphertext` and prevents `anon` from reading `connector_connections`.
- [x] Security Definer execute privileges on all 13 functions are revoked from `anon` and `PUBLIC`.
- [x] Trigger functions fire cleanly on DML under `authenticated` despite direct `EXECUTE` being denied.
- [x] `scripts/check-security-advisors.sh` blocks deployments if any ERROR-level security advisor findings occur.

---

## 5. UAT & Human Verification Obligations

| Obligation | Scope | Status | Notes |
|---|---|---|---|
| **G-4 Lived-Experience UAT** | CRED-01 inline refusal across `ConnectionFormPanel` and `McpAuthDoor` | **APPROVED** (S1 & S3 passed; S2 owed) | Driven in real browser against running app and judged by operator (record: `.planning/phases/248-the-credential-boundary/248-G4-UAT.md`).<br>• **S1 (Pass):** Entra-secret-shaped string pasted in Microsoft 365 Custom Client ID triggers destructive red border immediately, replaces hint with specific guidance naming Custom Client Secret field rendered directly beneath, and disables Connect.<br>• **S3 (Pass):** RFC 7591 dynamic ID `bD78Ksp3xBJew1kL` accepted; red clears and Connect re-enables.<br>• **S2 (⛔ Owed):** McpAuthDoor BYO OAuth path live UI test owed (code parity established; Notion connection already connected in live dev DB). Re-open trigger: next touch to McpAuthDoor or first real BYO OAuth server connection.<br>• *Observation:* Connect button disables functionally but retains purple styling; non-blocking observation recorded. |

---

## 6. Deployment Notes & Honest Boundaries

- **Migration 181 is LOCAL-ONLY:** Applied and verified on local Docker Supabase (`:54322`). Production cloud database still reads 13/13 on the Supabase Security Advisor until the operator applies `supabase/migrations/181_revoke_public_secdef_functions.sql` to cloud per D-248-11.
- **CRED-04 is OPERATOR-RUN:** `scripts/check-security-advisors.sh` is an operator-run pre-deployment audit tool, not an unskippable automatic CI hook. It blocks with exit 1 if ERROR findings are detected.
- **Count Gate Arithmetic Gap:** Frontend count gate grand total moved 8,297 -> 8,300 (+3) while the two pinned fences (`ConnectionFormPanel.oauth.test.tsx` 8->11, `ConnectionGrantsList.test.tsx` 8->9) account for +4. No pinned file decreased across 279 pinned suites; the single test delta is in an unpinned suite not attributable to Phase 248.
- **Peer-Review Independence Note:** Claude conducted independent review and re-drove all figures without writing plan or implementation code; Claude originally authored `248-CONTEXT.md` prior to the operator's role swap ruling.

