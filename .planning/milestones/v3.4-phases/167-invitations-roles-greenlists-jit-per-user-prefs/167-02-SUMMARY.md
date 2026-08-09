---
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
plan: 02
subsystem: org-admin
tags: [invitations, org-membership, rls, org-invite-gate, jit-provisioning, advisory-lock, audit, adoption-state, fastapi, asyncpg]

# Dependency graph
requires:
  - phase: 167-01
    provides: invitation_service (mint_invite_token/verify_token/hash_token/accept_invitation/derive_adoption_state) + email_provider (get_email_provider/compose_invite_link) + require_org_invite gate
  - phase: 166-org-shell
    provides: /org router + get_active_org_id (server-validated X-Org-Id) + get_user_pg_connection (user-JWT RLS) + get_org_members roster
  - phase: 161-org-schema (mig 104)
    provides: org_invitations table + org_invitations_insert/update RLS (org:invite WITH CHECK)
provides:
  - "POST/GET /org/invitations (send/list) + POST /org/invitations/{id}/resend + DELETE /org/invitations/{id} (revoke) — org:invite-gated on the user-JWT connection"
  - "POST /org/invitations/accept — token-gated JIT accept (get_current_user only), idempotent, join-additive"
  - "GET /org/members extended: server-derived adoption state (active) + pending_invitations (pending) via derive_adoption_state"
  - "write_audit_entry(org_id=…) — an optional explicit org_id (byte-identical when omitted); invitation writes attribute the CORRECT org (T-167-23)"
affects: [167-05 InvitationsTab + adoption chips, 167-06 /invite accept landing, 168 SSO JIT reuse of the accept seam]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "org:invite-gated writes on the CALLER'S user-JWT/RLS connection so the mig-104 org_invitations_insert/update WITH CHECK is the real wall (never client-supplied org_id)"
    - "Token-gated accept: get_current_user ONLY (no X-Org-Id) — the validated token is the authorization; the org comes from the invite row"
    - "Explicit-org audit: write_audit_entry(org_id=…) survives the mig-106 IF-NEW.org_id-IS-NOT-NULL no-op guard, so 2+-org callers' invitation rows land on the correct /org/audit tab"
    - "No-migration audit: invitation lifecycle rows reuse the valid 'settings.update' action_type + a metadata.event discriminator (the CHECK enum has no invitation type; a new one would silently 23514-drop)"

key-files:
  created:
    - backend/tests/test_167_invitations.py
    - backend/tests/integration/test_167_jit_race.py
  modified:
    - backend/app/services/audit_service.py
    - backend/app/api/org.py

key-decisions:
  - "T-167-23: write_audit_entry takes an OPTIONAL org_id (default None → byte-identical insert; existing callers + the mig-106 autofill unchanged). send/resend/revoke pass the active org; accept passes the INVITATION's org — never the ORDER-BY-less autofill guess."
  - "D-167-05/INV-02: accept is app-layer + token-gated (get_current_user only); it calls Plan-01 accept_invitation on the singleton pool. ZERO migration."
  - "D-167-03: an invite may grant ONLY member/org-admin (dept-admin greyed, super-admin refused) — 400 server-side."
  - "No-new-package (T-167-SC): stdlib email-shape validation via a pydantic field_validator instead of EmailStr (email-validator is not installed and this phase adds no dependency)."
  - "No-migration audit action_type: invitation rows reuse 'settings.update' with metadata.event ∈ {invitation.send/resend/revoke/accept}; the audit_log CHECK admits no invitation type and 167-CONTEXT forbids a migration."

patterns-established:
  - "Adoption state is a server-derived projection (membership presence × invite status via derive_adoption_state), returned on the roster — never a client flag"
  - "Link-first delivery: the raw token lives ONLY in the returned link; token_hash is never selected or returned (T-161-04)"

requirements-completed: [INV-01, INV-02]

# Metrics
duration: ~45min
completed: 2026-07-21
---

# Phase 167 Plan 02: Invitation Endpoints + Explicit-Org Audit Summary

**Five invitation endpoints on the shipped `/org` router — org:invite-gated send/list/resend/revoke on the user-JWT/RLS connection + a token-gated idempotent accept (INV-02 JIT seam) — plus server-derived roster adoption state and the T-167-23 fix: an optional explicit `org_id` on `write_audit_entry` so a 2+-org caller's invitation audit rows land on the CORRECT org's audit tab. ZERO migration.**

## Performance
- **Duration:** ~45 min
- **Completed:** 2026-07-21
- **Tasks:** 3 (Task 3 was TDD → RED + GREEN)
- **Files created:** 2 | **Files modified:** 2

## Accomplishments
- **`write_audit_entry` explicit org_id (T-167-23):** added an OPTIONAL `org_id: str | None = None` param. When omitted the insert dict is byte-identical to the historical 3-column write (existing callers + the mig-106 `autofill_org_id_by_owner` trigger unchanged). When passed, the value is added to the insert dict — and because the trigger's first statement is `IF NEW.org_id IS NOT NULL THEN RETURN NEW`, the trigger no-ops and the explicit value is written verbatim. This is the ONLY way a 2+-org caller's row lands on the correct org (the trigger's `org_members … LIMIT 1` lookup has no ORDER BY and would misattribute it).
- **Send + list (INV-01):** `POST /org/invitations` mints a one-way-hashed token (Plan-01 `mint_invite_token`), INSERTs the pending invite on the caller's user-JWT connection (so the mig-104 `org_invitations_insert WITH CHECK (org:invite AND org_id ∈ current_user_org_ids)` policy is the real wall — org_id is server-pinned, never client-supplied), best-effort emails the link (env-switched provider, default none-log), and returns the copy/share link. `GET /org/invitations` lists invites and NEVER selects token_hash (T-161-04). Role validated to member/org-admin (400 otherwise).
- **Resend + revoke (INV-01):** `POST /org/invitations/{id}/resend` re-mints a fresh token+expiry; `DELETE /org/invitations/{id}` flips `status='revoked'` (soft — keeps the audit trail). Both are org:invite-gated on the user-JWT connection, pinned to `id AND org_id=active_org AND status='pending'` (a non-pending / cross-org id → 404), and write EXPLICIT `org_id=active_org` audit rows.
- **Adoption state (INV-01):** `get_org_members` now returns a server-computed `state` on every member (`active`) plus a `pending_invitations` list (`pending`), both via `derive_adoption_state` — never a client flag; a pending invite whose email is already a member is filtered out (shows as active).
- **Token-gated accept (INV-02):** `POST /org/invitations/accept` depends on `get_current_user` ONLY (no org:invite, no X-Org-Id) — the org comes from the validated token. It calls Plan-01 `accept_invitation` (advisory-lock + `ON CONFLICT DO NOTHING` + guarded flip) on the singleton pool. Status mapping: unknown → 404, expired/revoked → 409, valid or idempotent already-accepted → 200. The accept audit carries the INVITATION's org_id (the org joined), and is written ONLY on the first successful join.
- **Live race proof:** `tests/integration/test_167_jit_race.py` runs two concurrent `accept_invitation` calls on the same token against the local DB → exactly ONE `org_members` row, exactly one `joined=True`, single-use flip to `accepted`, and join-additive (invitee keeps their personal org + gains the inviting org). Passes live.

## Task Commits
1. **Task 1: write_audit_entry optional org_id + send/list** — `f1723035` (feat)
2. **Task 2: resend + revoke + roster adoption state** — `242707b9` (feat)
3. **Task 3 (TDD): invitation endpoint suite + token-gated accept + JIT race**
   - RED: `8ac28bc2` (test — accept failing)
   - GREEN: `06326373` (feat — accept endpoint)
   - Integration: `668348d6` (test — live JIT race)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `backend/app/services/audit_service.py` — `write_audit_entry` gains an optional `org_id` (byte-identical when omitted).
- `backend/app/api/org.py` — 5 invitation endpoints (send/list/resend/revoke/accept) + `get_org_members` adoption-state extension + the `SendInvitationBody`/`AcceptInvitationBody` models + the `_INVITE_ROLES`/`_INVITE_AUDIT_ACTION`/`_EMAIL_RE` constants.
- `backend/tests/test_167_invitations.py` (new) — 11 endpoint tests: send-gate 403, token secrecy (send + list), role allowlist 400, explicit-active-org send audit, roster adoption state, accept (invitation-org audit / idempotent no-op / expired 409 / revoked 409 / not-found 404).
- `backend/tests/integration/test_167_jit_race.py` (new) — the live concurrent-accept convergence proof.

## Verification
- `pytest tests/test_167_invitations.py -x -q` → **11 passed**.
- `pytest tests/integration/test_167_jit_race.py -q` → **1 passed** (live local DB — single-membership convergence + join-additive).
- `pytest tests/test_167_invitations.py tests/test_167_invitation_service.py tests/test_166_org_gate.py -q` → **30 passed** (no regression on the shared org gate).
- `pytest tests/unit/test_audit_service.py tests/unit/test_142_repeat_guard.py tests/unit/test_112_patch_metadata.py tests/unit/test_memory_tools.py tests/api/test_150_settings_error.py -q` → **32 passed** (every existing `write_audit_entry` caller unaffected by the optional param).
- Acceptance greps confirmed: `inspect.signature(write_audit_entry)` includes `org_id`; `require_org_invite` gates send + list; token_hash appears only in the INSERT column list / mint (never a SELECT return); explicit-active-org audit writes = 3 (send/resend/revoke); `derive_adoption_state` on the roster; the accept route declares `get_current_user` and NOT require_org_invite/get_active_org_id; the accept audit passes `org_id=result["org_id"]`.

## Decisions Made
- **Audit action_type reuse (no-migration).** The `audit_log` action_type CHECK (mig 071/live) admits only 19 values, none invitation-related, and 167-CONTEXT is emphatic that NO migration is expected. A new `invitation.*` type would silently drop (23514 is swallowed by `write_audit_entry`), and adding it to `VALID_ACTION_TYPES` without a migration would hard-fail boot (`assert_action_types_synced`). So invitation lifecycle rows reuse the existing valid `'settings.update'` action_type (org administration) with the specific event in `metadata.event` (`invitation.send`/`resend`/`revoke`/`accept`). The rows persist and land on the correct org's `/org/audit` tab (the T-167-23 goal); Plan 05's audit tab renders `metadata.event`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `EmailStr` → stdlib email validation**
- **Found during:** Task 1
- **Issue:** The plan specified `email: EmailStr`, but pydantic's `EmailStr` requires the `email-validator` package, which is NOT installed — using it hard-failed model construction at import time (boot break). The phase adds NO new package (threat T-167-SC / offline-safe default), and a package install is excluded from auto-fix by the deviation rules.
- **Fix:** `SendInvitationBody.email` is a plain `str` with a pydantic `field_validator` running a `^[^@\s]+@[^@\s]+\.[^@\s]+$` shape check (invalid → 422). A single-@ / dotted-domain check is sufficient at this trust boundary — the invite is a bearer capability, not an identity assertion.
- **Files modified:** backend/app/api/org.py
- **Committed in:** f1723035 (Task 1)

**2. [Rule 1 - Correctness] Invitation audit action_type = `settings.update` (see Decisions)**
- **Found during:** Task 1
- **Issue:** A naive `invitation.*` action_type would silently drop (the CHECK enum has no invitation type), defeating T-167-23 (rows never persist).
- **Fix:** Reuse the valid `'settings.update'` type + `metadata.event` discriminator — no migration, rows persist on the correct org tab.
- **Files modified:** backend/app/api/org.py

### Minor note (not a functional deviation)
- The audit `org_id` is passed as `str(request.state.active_org)` (send/resend/revoke) rather than the raw `active_org` `uuid.UUID` — a `uuid.UUID` is not JSON-serializable for the supabase-py audit insert and would silently drop. This is the SAME explicit active-org value the acceptance grep `org_id=active_org` intends; the count of explicit-active-org audit writes is 3.

**Total deviations:** 2 auto-fixed (1 blocking, 1 correctness). **Impact:** No scope change — same five endpoints, same org_id fix, ZERO new dependency, ZERO migration.

## Known Stubs
None. Every endpoint is wired to the real `org_invitations` table / Plan-01 service; adoption state derives from live membership × invite status. No placeholder data.

## Threat Flags
None. All new surface (the five invitation endpoints + the explicit-org audit) is covered by the plan's threat register (T-167-06/07/01/08/03/09/23). No new endpoints, auth paths, or schema at trust boundaries beyond it.

## Next Phase Readiness
- **NO migration authored** — `org_invitations` (mig 104) + `org_members` UNIQUE + the RLS policies are complete; the accept is app-layer (D-167-05). Migration head unchanged.
- Plan 05 (`InvitationsTab` + adoption chips) consumes `POST/GET/DELETE /org/invitations`, `POST /org/invitations/{id}/resend`, and the roster `state` / `pending_invitations` fields; it should render `metadata.event` for invitation audit rows (they carry `action_type='settings.update'`).
- Plan 06 (`/invite` accept landing) calls `POST /org/invitations/accept` — idempotent + re-runnable on the first authenticated session (RESEARCH OQ1 satisfied).
- Phase 168 (SSO) reuses the token-gated accept as the shared JIT onboarding seam.

## Self-Check: PASSED
_(appended after verification below)_

---
*Phase: 167-invitations-roles-greenlists-jit-per-user-prefs*
*Completed: 2026-07-21*
