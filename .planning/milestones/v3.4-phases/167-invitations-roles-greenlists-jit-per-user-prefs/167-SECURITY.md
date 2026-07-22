---
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
audit_type: retroactive-mitigation-verification
asvs_level: 2
threats_total: 26
threats_closed: 24
threats_accepted: 2
threats_open: 0
standing_open_items: 1   # SEED-125 (skills cross-org leak) — OUT OF SCOPE for 167, must route before 168
verdict: SECURED
audited: 2026-07-22
implementation_files_modified: false
---

# Phase 167 — Security Audit (Invitations + Roles + Greenlists + JIT + Per-User Prefs)

Retroactive verification of every declared threat in the seven 167-0x-PLAN `<threat_model>`
blocks against the shipped code. Each `mitigate` threat was verified by locating the actual
enforcement call in the cited file (not by documentation or intent); each `accept` threat was
verified against its justification. Implementation files were NOT modified.

**Result: 24/24 `mitigate` threats CLOSED, 2 `accept` threats justified, 0 OPEN.** One
adjacent standing risk (SEED-125) is surfaced for routing — it was explicitly scoped OUT of
167 by RESEARCH and is not a 167 mitigation gap.

---

## Threat Verification — mitigate (CLOSED)

| Threat ID | Category | Evidence (file:line) |
|-----------|----------|----------------------|
| T-167-01 | Information Disclosure — invite token at rest + API response | Only `sha256` stored: `invitation_service.py:49-63` (`hash_token`/`mint_invite_token`). No response leaks token_hash: `org.py:393-404` (send returns `link` + safe fields only), `org.py:421-447` (list SELECT excludes token_hash), `email_provider.py:51` (none-log logs the LINK). Test-lock: `test_167_invitations.py:121,142,244` (`assert "token_hash" not in res.text`). |
| T-167-02 | Spoofing — token verification | `invitation_service.py:66-72` — `hmac.compare_digest(hash_token(raw), stored_hash)` (constant-time); `:62` `secrets.token_urlsafe(32)`; NO `secret_cipher` import (reversible Fernet deliberately avoided). |
| T-167-03 | Tampering — concurrent first-login / double-accept | `invitation_service.py:139-142` `pg_advisory_xact_lock`, `:169-171` `INSERT … org_members … ON CONFLICT (org_id,user_id) DO NOTHING`, `:179-182` status flip `WHERE status='pending'`. Live proof: `tests/integration/test_167_jit_race.py:87` (`assert n == 1`), `:91` (`joined_true == 1`). |
| T-167-04 | Tampering — expired / revoked replay | `invitation_service.py:146-158` — status + `expires_at > now()` RE-READ authoritatively INSIDE the advisory lock before any insert; not-claimable path returns with no membership (`:158-166`). |
| T-167-05 | Elevation — accept INSERT with wrong role/org | `invitation_service.py:134-135` role+org read from the invite row, `:170-175` written verbatim to org_members; runs on the singleton pool (token-authorized), never client-supplied role/org. |
| T-167-06 | Elevation — invitation write without org:invite | Gate: `dependencies.py:718-742` `require_org_invite` (mirrors require_org_manage, key `org:invite`, strict `get_active_org_id`, 403 default-deny). Applied: `org.py:335` (send), `:411` (list), `:454` (resend), `:522` (revoke). RLS backstop: all four run on `get_user_pg_connection` (user-JWT) so mig-104 `org_invitations` WITH CHECK is the real wall (`org.py:361,425,473,537`). |
| T-167-07 | Elevation — role escalation via invite role | `org.py:53` `_INVITE_ROLES = {member, org-admin}`, `:352-356` server rejects anything else with 400 (dept-admin/super-admin refused). |
| T-167-08 | Elevation — cross-org invite (wrong org_id) | `org.py:349,367` org_id pinned to `request.state.active_org` (server-validated X-Org-Id), never client-supplied; user-JWT INSERT enforces `org_invitations_insert WITH CHECK`. Resend/revoke pinned `org_id=active_org AND status='pending'` (`:477,540`). |
| T-167-09 | Spoofing — accept without proof of invite | `org.py:584` hashes the supplied token, `:586-588` delegates to `accept_invitation` which requires a pending non-expired token_hash match; no email-match join path exists. |
| T-167-10 | Elevation — greenlist bypass via forged client flag | `dependencies.py:490-528` `require_visible` is the sole authority; caller role comes from `request.state.org_role` (server-set) / `resolve_caller_role:462-487` (user-JWT read), never a client flag. Render map shares the SAME resolver: `features.py:56-68` (`feature_audience` + `resolve_feature_access`) so hide==refuse. |
| T-167-10b | Elevation — operator sets invalid role greenlist | `admin.py:986-991` roles ⊆ 4-tier `_VISIBILITY_ROLES` → 400 before any write; `ControlRoomPage.tsx:508-516` routes through `setFeatureAudience` (render-only client). |
| T-167-11 | Elevation — resolver widens (fail-open) | `user_settings.py:1125-1152` `resolve_feature_access` fail-closed (everyone→True, operators→False, role→greenlist match, ELSE `return False`; malformed list caught → False `:1150-1151`). `feature_audience:1109-1122` unknown→`_GOVERNED_FEATURES` safe-deny; `_feature_record:1099-1106` cold-cache/blip→`{}`. |
| T-167-12 | Tampering — SQLi via role/feature in the visibility write | `admin.py:974-991` feature ∈ `_VISIBILITY_FEATURES`, audience ∈ `_VISIBILITY_AUDIENCES`, roles ⊆ `_VISIBILITY_ROLES` → 400 BEFORE the write. Writer: `user_settings.py:1174-1178` atomic `coalesce(feature_visibility,'{}'::jsonb) || $1::jsonb` — `$1` bind + JSONB codec, no interpolation. |
| T-167-13 | Elevation — user picks model outside operator/org set | `me_preferences.py:87-96` PUT validates `desired ∈ enabled_model_allowed_set` → 400; read-time defense-in-depth `user_settings.py:952` (`compose` returns pref only if `in enabled_models`). |
| T-167-13b | Elevation — picker offers disallowed model | `ModelDefaultPreference.tsx:69,99-103` select options = `allowed_models` only; unknown persisted value kept as "(current)" `:96-98`; server re-validates on PUT. |
| T-167-14 | Tampering — override bypasses the operator lock | `user_settings.py:950-951` `compose_effective_model_default` returns operator default when `locked`; `operator_model_default_locked:914-932` reads `llm_model_locked` and FAILS CLOSED (True) on read error. |
| T-167-14b | Tampering — user edits a locked default via client | `ModelDefaultPreference.tsx:90` `disabled={saving || locked}`, `:122-124` footer names the governed default; server honors the lock regardless (disable is courtesy). |
| T-167-15 | Tampering — overlay mutates the shared/Deep path when unset | `run_model_resolution.py:197-209` `apply_user_model_default` returns the SAME `user_settings` object when unset / composed==current, `model_copy` only when it differs; fail-open `:210-214`. Send seam is a single additive line: `threads.py:846`. Test-lock: `test_167_prefs.py`. |
| T-167-16 | DoS — blocking supabase-py read in the async send handler | `user_settings.py:876-896` `load_user_model_default` uses the asyncpg pool (`fetchval`, already async) + fail-open None; `me_preferences.py:57-60` all reads via async seams. |
| T-167-17 | Elevation — client renders invite affordances without permission | `InviteMemberDialog.tsx:21-23` render-courtesy only; every write is server-gated on `org:invite` (see T-167-06). Client is not the boundary. |
| T-167-18 | Information Disclosure — raw token displayed/persisted beyond the link | `InviteMemberDialog.tsx:105,162` surfaces only the server-returned `link`; token never stored/logged separately. |
| T-167-19 | Spoofing — Dept-admin selectable before departments ship | `InviteMemberDialog.tsx:63-68` `enabled:false`, `:225` `disabled`, `:229` onClick guarded; server also refuses (`org.py:53`). |
| T-167-20 | Spoofing — join without a valid invite | `AcceptInvitePage.tsx:54,92` token from URL passed to server accept; the server-side pending+non-expired match (T-167-09) is the wall. |
| T-167-21 | Tampering — double-accept from a re-render / confirm round-trip | `AcceptInvitePage.tsx:84,87-89` `firedRef` fires accept at most once per authed session; server accept is idempotent (T-167-03). |
| T-167-23 | Repudiation — invitation audit row misattributed to the wrong org | `audit_service.py:57-85` `write_audit_entry` optional `org_id` (added to insert dict only when provided; existing callers byte-identical). Explicit org passed: `org.py:390,509,557` (send/resend/revoke = active_org), `:609` (accept = invitation's org). Test-lock: `test_167_invitations.py:189` (send=ACTIVE_ORG), `:246` (accept=INVITE_ORG). |

## Threat Verification — accept (justified)

| Threat ID | Category | Disposition | Evidence / Justification |
|-----------|----------|-------------|--------------------------|
| T-167-22 | Information Disclosure — token lingering in client storage/logs | accept | `AcceptInvitePage.tsx:47,57` token held in URL + transient same-origin `sessionStorage` only; `:95` removed after accept. Single-use capability consumed server-side on accept; the client is not the trust boundary. Residual risk low — justification matches implementation. |
| T-167-SC | Tampering — pip/npm supply-chain (`resend`, email-validator, frontend deps) | accept | No new dependency shipped by 167: `requirements.txt` contains no `resend` / `email-validator` (verified); `resend` is lazy-imported inside `email_provider.py:60` only when `EMAIL_PROVIDER=resend`; the offline `none` default installs nothing. `org.py:64-68` uses a stdlib regex instead of pydantic `EmailStr` to avoid pulling email-validator. Git history shows no 167 commit touching `requirements.txt` or `frontend/package.json`. |

---

## Standing Open Item (route — NOT a 167 mitigation gap)

**SEED-125 — skills cross-org leak (Information Disclosure).** RESEARCH explicitly marked this
OUT OF SCOPE for Phase 167 (`167-RESEARCH.md:493`, "OUT OF SCOPE here but flagged"). It is a
pre-existing live leak, sibling to the 164→165 SEED-124 folder leak: `load_skill` /
`read_skill_file` / `execute_code` reach skills via `.or_(is_org_shared.eq.true)` on the
service-role client with **no org gate** (6 call sites) plus a permissive storage policy. Because
it was scoped out, it is not counted in `threats_open` for 167 — but per instruction it is NOT
silently folded or dropped.

- **Action required:** route before Phase 168. Phase 168 (SSO) reuses the INV-02 JIT onboarding
  path, which lands new cross-org members — an unclosed skills cross-org leak widens with every
  new multi-org member. Recommend closing SEED-125 in a dedicated hardening slice (mirror the
  SEED-124 fix: org-gate the service-role skill reads) before or alongside 168.

## Unregistered Flags (new attack surface without a threat mapping)

None. Every net-new surface introduced by 167 maps to a declared threat:
- invitation token mint/verify → T-167-01/02
- token-gated JIT accept (pool/BYPASSRLS path) → T-167-03/04/05/09
- `org:invite` gate + 5 invitation endpoints → T-167-06/07/08/23
- role-audience greenlist resolver + write → T-167-10/10b/11/12
- per-user model preference (revived `user_settings.preferences`) + send-path overlay → T-167-13/13b/14/14b/15/16
- `/invite` accept landing → T-167-20/21/22
- new env vars (`EMAIL_PROVIDER`/`RESEND_API_KEY`/`INVITE_FROM_EMAIL`) → T-167-SC + deploy-drift (D-16)

---

## Cross-Cutting Tenancy Posture (verified, not assumed)

The three highest-value tenancy claims were verified against the actual enforcement, not the
prose:

1. **The accept path is a deliberate service-role/pool INSERT, and that is correct.** `org.py:562-588`
   — the accept endpoint declares `get_current_user` ONLY (no `require_org_invite`, no
   `get_active_org_id`); the org/role come from the validated token (`invitation_service.py:134-135`),
   never the client. The invitee is not yet a member, so the user-JWT RLS `org_members_insert`
   policy would correctly DENY — the token IS the authorization. This is the ONE justified
   RLS-bypass in the phase and it is token-gated + idempotent.

2. **Every invitation write on the user-JWT path keeps the RLS wall.** send/list/resend/revoke all
   run on `get_user_pg_connection` (`org.py:361,425,473,537`) so the mig-104 `org:invite` WITH CHECK
   policy backstops the app-layer `require_org_invite` gate — defense in depth, not app-code alone.

3. **The per-user model overlay is a strict no-op on the shared Deep path.** `run_model_resolution.py:197-209`
   returns the identical settings object when no preference is set, and `threads.py:846` is a single
   additive line — the D-14 red line (Deep byte-identical) holds by construction, test-locked in
   `test_167_prefs.py`.

---

## Audit Method Notes

- ASVS L2 verification: each mitigation traced to a concrete enforcement call at every entry point
  (all four invitation write routes, both preference read/write paths, both greenlist resolve
  paths). No CLOSED verdict rests on code structure or a single grep match.
- Test-locks corroborate (not substitute for) the code evidence for T-167-01, T-167-03, T-167-15,
  T-167-23; all five `test_167_*` files and `tests/integration/test_167_jit_race.py` are present.
- Implementation files are READ-ONLY and were not modified. This audit created only this file.
