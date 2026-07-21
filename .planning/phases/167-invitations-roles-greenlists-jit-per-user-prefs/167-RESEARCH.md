# Phase 167: Invitations + Roles + Greenlists + JIT + Per-User Prefs - Research

**Researched:** 2026-07-21
**Domain:** Multi-tenant onboarding (invitation token lifecycle + JIT membership provisioning), RBAC feature-greenlists, two-layer per-user preferences, env-switched email delivery
**Confidence:** HIGH (all four capabilities extend already-shipped, in-repo substrate verified by direct read; the one genuinely open question — the INV-02 JIT seam — is resolved below with a migration/no-migration recommendation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-167-01 — Join additively, keep both.** A user who already has a personal org and accepts an invite KEEPS their personal org AND joins the inviting org → 2+ orgs; the shipped 166 org switcher flips between them. Non-destructive. (Rejected: absorbing/hiding their personal org.)
- **D-167-02 — Link-first + log/copy, email via env-switch.** Generate a secure invite link (hashed token in `org_invitations.token_hash`, raw token NEVER stored — T-161-04); the app surfaces/logs the link to copy. No email service / API keys required by default (self-hosted / offline works). Real email (`resend`/SES) turns on via the env-switched provider. The `none`-log provider is the DEFAULT.
- **D-167-03 — Member default + optional Org-admin.** Inviter picks role at send: Member (default) or Org-admin. Dept-admin is greyed-out until Phase 169 (the CHECK permits it schema-side; the UI does not offer it this phase). Writes `org_invitations.role`; gated by `org:invite`.
- **D-167-04 — Default model within the allowed set** is the concrete first VIS-02 preference. User picks their own default AI model from the operator/org-permitted set; operator can LOCK it (SEED-116 two-layer). Revives `user_settings.preferences` (dead since mig 011). (Rejected: a broader preferences bundle now.)
- **D-167-05 (JIT seam — RESEARCH FLAG):** INV-02 idempotent membership creation = `INSERT … ON CONFLICT DO NOTHING` + a Postgres advisory lock. **Whether it lives in a DB trigger (extending mig 105's `handle_new_user`), the app-layer signup/callback handler, or both is a research decision.** If a trigger change is chosen, that is the ONE possible migration (slot 112); otherwise ZERO migrations. The signup path must honor a pending invitation (join THAT org) instead of always auto-creating a personal org — the invited-vs-fresh fork. **→ RESOLVED below (§ Architecture Pattern 2): app-layer, token-gated, ZERO migration primary.**
- **D-167-06 (VIS-01 zero-migration):** the `feature_visibility` JSONB `app_settings` column (mig 098) extends from `{audience: operators|everyone}` to `{audience: role, roles:[...]}` (+ group grants) with ZERO migration. Generalize the shape + the `require_visible` resolver ONLY — no new table. Precedence-merge: highest role wins primary tier, union for secondary grants (Glean model).
- **D-167-07 (invitations home = the 166 org shell):** the org-admin manages invitations from the 166 org shell's "Invitations & Roles" tab (currently LockedTab → this phase makes it LIVE) + adoption-state chips on the 166 Members roster. The operator Phase-148 roster is NOT the invitation home. "Phase-148 roster" phrasing = reuse the roster PATTERN, rendered in the org shell.
- **D-167-08 (security — carry forward from 166/161):** `org:invite` gates invitation writes (mig 104 policy exists); `token_hash` never leaves `org_invitations`; every org-scoped route reuses the 166 `get_active_org_id` server-validated `X-Org-Id` + `require_org_manage`/`org:invite` gates; tokens need expiry + single-use enforcement (threat-model item — token/expiry + JIT advisory-lock race).
- **D-167-09 (SC#10):** VIS-02 model-default = provider routing → cross-provider mandate applies (must route across OpenAI/Anthropic/Google/OpenRouter). Greenlist changes = UI state. Deep Mode stays byte-identical (D-14).

### Claude's Discretion

The exact invite-modal layout, adoption-state chip copy/colors (reuse 166's chip vocabulary), the greenlist admin surface shape, resend/revoke affordances, and the precise `user_settings.preferences` JSON key for the model default — implementation latitude within the locked scope.

### Deferred Ideas (OUT OF SCOPE)

- SSO (SAML 2.0) → Phase 168 (INV-02's JIT seam is the shared onboarding path SSO reuses).
- Departments / dept-admin role → Phase 169 (dept-admin invite role stays greyed).
- Full group-management UI (create/edit groups for greenlists) — this phase ships the role/group greenlist RESOLVER + a minimal admin surface; rich group management is later.
- Entitlements / subscription tiers gating → STRETCH Phase 170.
- Broader per-user preferences bundle (theme + others) → future config pass (SEED-117); ship the model-default instance only.
- Email template polish / branded invitations — link-first ships now; rich templating is a later hardening pass.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **INV-01** | Org-admin sends email + link-based invitations (`org_invitations`, hashed token, expiry, `resend`/SES/`none`-log env-switched provider); recipients accept via sign-in or sign-up; adoption states (not-yet-invited / pending / active) render on the roster. | § Standard Stack (resend SDK + stdlib token crypto), § Pattern 1 (invitation lifecycle + adoption-state derivation), § Pattern 5 (email provider abstraction), § Don't Hand-Roll (token hashing). New invitation endpoints extend `backend/app/api/org.py`; the "Invitations & Roles" LockedTab in `OrgAdminShell.tsx` goes LIVE; adoption chips extend `OrgMembersTab.tsx`. |
| **INV-02** | JIT provisioning creates the `org_members` row idempotently (`INSERT … ON CONFLICT DO NOTHING` + advisory lock so concurrent first-logins converge to one membership) on signup / SSO-callback. | § Pattern 2 (THE JIT seam — resolved: app-layer token-gated accept, ZERO migration; the mig-105 trigger stays the personal-org default; the invited fork is a separate token-capability endpoint). Idempotency backstop = `org_members` UNIQUE(org_id,user_id) + `ON CONFLICT DO NOTHING`; advisory lock serializes the status-flip+insert. |
| **VIS-01** | Feature visibility generalizes binary "Everyone / Operators-only" into per-feature role/group greenlists via the SAME `require_visible` function, with a Glean precedence-merge (highest role wins primary tier, union secondary). | § Pattern 3 (greenlist resolver generalization — ZERO migration; the `feature_visibility` JSONB shape + `feature_audience()`/`require_visible` extension). The caller's org role reads from `request.state.org_role` / `get_active_org_id` (already resolved by 166). |
| **VIS-02** | Per-user preference layer revives `user_settings.preferences` under the SEED-116 two-layer pattern — user picks a default (model) WITHIN the operator/org-allowed set, honoring operator lock flags. | § Pattern 4 (two-layer prefs — the EXACT read seam is `load_user_settings(user_id)` at `user_settings.py:861`, which today IGNORES `user_id` and returns the GLOBAL row; VIS-02 overlays the per-user default there, as a no-op when unset → Deep byte-identical). |
</phase_requirements>

## Summary

This phase is **UI + backend app-code over an already-built substrate** — not schema work. Every table it touches exists and was authored forward-compatibly: `org_invitations` is COMPLETE (mig 104: `token_hash`, `status` enum, `expires_at`, `role` CHECK, `invited_by`, plus the `org:invite` RLS write policy and the `role_permissions` seed granting org-admin `org:invite`); the `feature_visibility` JSONB map (mig 098) was deliberately shaped `{audience: ...}` to extend to roles with zero migration; `user_settings.preferences jsonb` (mig 011) is dead-but-present. The 166 seam is likewise live: `OrgAdminShell.tsx` has the "Invitations & Roles" LockedTab, `OrgMembersTab.tsx` is a read-only roster explicitly awaiting invite affordances, `OrgProvider.tsx` + the switcher already make a 2-org user work, and `backend/app/api/org.py` + `dependencies.py` give you `get_active_org_id` (server-validated `X-Org-Id`), `require_org_manage`, and `_has_org_permission(...,'org:invite')` for free.

The one genuinely open question — **the INV-02 JIT seam (D-167-05)** — resolves cleanly. Signup in this app is **pure client→GoTrue** (`supabase.auth.signUp()` in `useAuth.ts`); there is NO backend signup handler, and the mig-105 `handle_new_user` trigger already idempotently gives every new user a personal org (with an `EXCEPTION WHEN OTHERS` swallow so it can never abort signup — matching Supabase's own documented trigger caveat). Because the invite's **security capability is the raw token in the link** (email-match alone must never auto-join, or anyone could claim an invite by signing up with the invitee's email), the invited fork **cannot** live in the trigger (which sees `new.email` but not the token). It belongs in a **token-gated app-layer accept endpoint** (`POST /org/invitations/accept`) that runs AFTER auth for BOTH sign-in (existing user) and sign-up (new user → trigger makes the personal org → accept additively joins the inviting org, exactly satisfying D-167-01). This needs **ZERO migration**: the membership INSERT runs through the existing hardened `get_service_role_supabase(org_id)` (or the asyncpg pool) authorized by the validated token, with a `pg_advisory_xact_lock` + `ON CONFLICT DO NOTHING` for the concurrency race.

VIS-01 and VIS-02 are surgical resolver extensions with no new dependencies. The only external package is `resend` (optional, off by default) for the real-email provider; the default `none`-log provider and the link-copy path are pure stdlib.

**Primary recommendation:** Build five app-layer invitation endpoints in `org.py` (send/list/resend/revoke/accept), a token-gated accept endpoint that does the idempotent JIT membership insert with `pg_advisory_xact_lock` + `ON CONFLICT DO NOTHING` (ZERO migration), generalize `feature_audience()`/`require_visible` to read `{audience:'role', roles:[...]}` with a highest-role-wins + union precedence merge, and overlay a per-user `user_settings.preferences.default_model` at the `load_user_settings` seam gated by an operator lock flag. Tokens use stdlib `secrets.token_urlsafe` + `hashlib.sha256` + `hmac.compare_digest` — NOT the Phase-150 reversible MultiFernet cipher.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Invitation create / list / resend / revoke | API / Backend (`org.py`) | Database (`org_invitations` RLS `org:invite`) | Writes are `org:invite`-gated; `token_hash` computed server-side and never returned; the raw token exists only in the returned link. |
| Invite token generation + hashing | API / Backend | — | High-entropy token minted server-side (`secrets`), one-way hashed (`hashlib`); never a client or DB responsibility. |
| Invitation delivery (link-copy / email) | API / Backend (provider abstraction) | External (Resend/SES when enabled) | Env-switched; default `none`-log logs the link. The link URL is composed server-side from an app-base-URL env var. |
| Accept invitation (token → membership) | API / Backend (token-gated endpoint) | Database (service-role/SECDEF INSERT + advisory lock) | The invitee is NOT yet a member, so the user-JWT RLS `org_members_insert` (needs `org:manage`) cannot be the path — a token-authorized service-role/SECDEF insert is required. |
| JIT idempotency (concurrent first-logins) | Database (UNIQUE + `ON CONFLICT` + `pg_advisory_xact_lock`) | API orchestration | The UNIQUE(org_id,user_id) constraint is the hard convergence guarantee; the advisory lock serializes the status-flip+insert transaction. |
| Personal-org default on fresh signup | Database (mig-105 `handle_new_user` trigger) | — | Already shipped + correct; STAYS as the fresh-signup default (D-167-01 keep-both). Do NOT move it to app-code. |
| Feature greenlist resolution (VIS-01) | API / Backend (`require_visible` / `feature_audience`) | Database (`app_settings.feature_visibility` JSONB) | The ONE swappable audience boundary; resolves the caller's org role (already on `request.state.org_role`) against the stored role/group audience. |
| Per-user model default (VIS-02) | API / Backend (`load_user_settings` overlay) | Database (`user_settings.preferences`, `app_settings` allowed-set + lock) | The model default enters the send path at ONE sync seam; overlay is a no-op when unset (Deep byte-identical, D-14). |
| Invite / adoption-state / greenlist / prefs UI | Frontend Server (React SPA) | — | Extends 166's shipped `OrgAdminShell` tab + `OrgMembersTab` roster; render-only, never the security boundary. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib `secrets` | 3.12 (in-tree) | Mint the single-use invite token (`secrets.token_urlsafe(32)` → ~43-char URL-safe) `[CITED: docs.python.org/3/library/secrets]` | The stdlib CSPRNG explicitly designed for "account authentication, tokens" — no dependency, no slopsquat surface. |
| Python stdlib `hashlib` + `hmac` | 3.12 (in-tree) | Store ONLY `sha256(token)`; verify with `hmac.compare_digest` (constant-time) `[CITED: docs.python.org/3/library/hashlib]` | The token is HIGH-entropy → a fast one-way hash is correct (bcrypt/argon2 are for LOW-entropy passwords). Reversible ciphers are the wrong tool (§ Don't Hand-Roll). |
| `supabase-py` (already in tree) | in-tree | Service-role membership INSERT on accept via `get_service_role_supabase(org_id)`; user-JWT reads via `get_user_supabase_client` | Reuses the exact 163/166 DB-context factories in `dependencies.py`; blocking calls stay wrapped in `run_in_threadpool` (D-v2.5-01). |
| `asyncpg` (already in tree) | in-tree | The `pg_advisory_xact_lock` + `INSERT … ON CONFLICT DO NOTHING` accept transaction on the singleton pool | Native advisory-lock support; the pool is already the app's raw-SQL path. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `resend` | 2.34.0 `[VERIFIED: PyPI — slopcheck OK, resendlabs/resend-python]` | The real-email provider implementation (`EMAIL_PROVIDER=resend`) | OPTIONAL — installed only when an operator turns on real email. Default `none`-log needs NO install. Resend is the modern link-first transactional-email choice with a tiny SDK (`requests` + `typing_extensions` deps only). |
| `boto3` (SES) | `[ASSUMED]` | The SES provider implementation (`EMAIL_PROVIDER=ses`) | OPTIONAL alternative to resend for AWS shops. Do NOT add unless a deploy target needs SES; link-first + none-log + resend covers the milestone. Verify on PyPI + slopcheck before adding. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib `secrets`/`hashlib` token | Phase-150 `secret_cipher.py` MultiFernet | WRONG tool — MultiFernet is REVERSIBLE (for API keys you read back); an invite token is a one-way capability you only ever compare. Using reversible crypto stores a decryptable token (weaker) and misuses the secrets cipher. Use one-way hashing. |
| App-layer token-gated accept (recommended) | Extend mig-105 trigger to email-match invitations | INSECURE — the trigger has `new.email` but not the token; joining on email alone lets anyone claim an invite by signing up with the invitee's address. The token is the capability; it must be presented post-auth. |
| Resend SDK | Raw SMTP via stdlib `smtplib` | SMTP works offline-ish but needs relay creds + is fiddly with modern deliverability (SPF/DKIM). Link-first is the default anyway; resend is the "real email" path when wanted. `smtplib` is a possible fourth provider if a self-hoster insists (note only). |
| New SECDEF `accept_org_invitation()` (migration slot 112) | App-code service-role accept (recommended, no migration) | The SECDEF function gives single-round-trip atomicity but ADDS the one migration this phase is trying to avoid. Choose it ONLY if the planner wants the check-lock-insert-flip in one DB function; otherwise app-code + advisory lock is equivalent and zero-migration. |

**Installation:**
```bash
# Default path: NOTHING to install — link-first + none-log is pure stdlib.
# Real email (operator opt-in only):
pip install resend==2.34.0   # into the backend venv; add to requirements ONLY if enabled by default (it is not)
```

**Version verification:** `resend` confirmed on PyPI at 2.34.0 (60 releases, `requires_python>=3.7`, homepage `github.com/resendlabs/resend-python`, summary "Resend Python SDK") via `python -m slopcheck install resend` → `[OK]` and a direct PyPI JSON metadata read. `secrets`/`hashlib`/`hmac` are stdlib (no version pin).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `resend` | PyPI | ~2+ yrs (60 releases; latest 2.34.0) | high (official transactional-email SDK) | github.com/resendlabs/resend-python | `[OK]` (pypi) | Approved — OPTIONAL, off by default |
| `secrets` / `hashlib` / `hmac` | stdlib | — | — | CPython | n/a (stdlib) | Approved |
| `boto3` (SES alt) | PyPI | mature | very high | github.com/boto/boto3 | not run | `[ASSUMED]` — only if SES is added; verify before install |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

`slopcheck` (v0.6.1) ran successfully and rated `resend` `[OK]` against PyPI. `resend` is only pulled in when an operator enables `EMAIL_PROVIDER=resend`; the planner should gate that install behind the operator-opt-in path (it is NOT a default requirement, keeping the offline/self-hosted default dependency-free per D-167-02). No postinstall scripts (Python wheel).

## Architecture Patterns

### System Architecture Diagram

```
INVITE (send) ─ org-admin in 166 org shell "Invitations & Roles" tab
   │  POST /org/invitations  {email, role}         [require_org_manage + org:invite]
   ▼
 org.py: mint token = secrets.token_urlsafe(32)
   │      token_hash = sha256(token)               ── raw token NEVER stored (T-161-04)
   │      INSERT org_invitations(org_id, email, role, token_hash, status='pending',
   │             expires_at = now()+7d, invited_by)  [user-JWT RLS, org:invite WITH CHECK]
   │      link = f"{APP_BASE_URL}/invite?token={token}"      ── raw token only here
   ▼
 EmailProvider(env EMAIL_PROVIDER) ── none-log (default): logs link ─┐
   │                                   resend: Resend SDK send      │
   │                                   ses: boto3 send              │
   └── returns {link} to the inviter (copy/share)  ◄────────────────┘

ACCEPT ─ invitee opens link → /invite?token=… landing page
   │  (a) existing user → sign IN     (b) new user → sign UP
   │       supabase.auth.signInWith…       supabase.auth.signUp()
   │                                         └─► mig-105 trigger: personal org (KEEP, D-167-01)
   │  both paths land authenticated, then the SAME call:
   ▼
   POST /org/invitations/accept {token}     [get_current_user — any authed user]
   │
 org.py accept:  token_hash = sha256(token)
   │   SELECT … FROM org_invitations WHERE token_hash=$1
   │            AND status='pending' AND expires_at > now()   ── single-use + expiry gate
   │   BEGIN
   │     pg_advisory_xact_lock(hashtext(org_id||caller_id))   ── serialize the race
   │     INSERT org_members(org_id, caller_id, role)
   │            ON CONFLICT (org_id,user_id) DO NOTHING        ── idempotent JIT (INV-02)
   │     UPDATE org_invitations SET status='accepted' WHERE id=…  (guard: was 'pending')
   │   COMMIT
   ▼
 caller now 2+ orgs → 166 OrgProvider re-probes → switcher shows both (D-167-01)

VIS-01  require_visible(feature) ─► feature_audience(feature) reads app_settings.feature_visibility
   {audience:'role', roles:[...]} ─► compare caller org role (request.state.org_role) + group grants
   ─► precedence merge (highest role wins primary; union secondary)  ── ZERO migration

VIS-02  chat send ─► load_user_settings(user_id)  ── overlay user_settings.preferences.default_model
   IF unset OR operator lock ON ─► global default (Deep byte-identical, D-14)
   ELSE ─► per-user default (must be in operator/org allowed enabled set)
```

### Recommended Project Structure
```
backend/app/
├── api/org.py                    # + 5 invitation endpoints (send/list/resend/revoke/accept)
├── services/
│   ├── invitation_service.py     # NEW — token mint/hash/verify, accept transaction (advisory lock)
│   └── email_provider.py         # NEW — EmailProvider protocol + none-log / resend / (ses) impls
├── dependencies.py               # + require_org_invite gate (mirror require_org_manage on 'org:invite')
│                                 # + generalize require_visible to role/group audiences
└── models/user_settings.py       # feature_audience() → role/group resolver; per-user prefs overlay seam

frontend/src/
├── components/org/
│   ├── OrgAdminShell.tsx         # LockedTab "Invitations & Roles" → LIVE InvitationsTab
│   ├── InvitationsTab.tsx        # NEW — invite modal (email + role picker), pending list, resend/revoke, copy-link
│   └── OrgMembersTab.tsx         # + adoption-state chips (not-invited / pending / active)
├── components/settings/          # + per-user default-model picker (respects operator lock)
└── lib/api.ts                    # + sendInvitation/listInvitations/resend/revoke/acceptInvitation
```

### Pattern 1: Invitation lifecycle + adoption-state derivation (INV-01)
**What:** Server mints the token, stores only its hash, returns the link; adoption state is DERIVED, never a stored column.
**When to use:** All invitation CRUD.
**Adoption-state derivation** (per D-167 specifics, from `org_invitations.status` × `org_members` presence):
- **active** — an `org_members` row exists for that email's user_id in this org.
- **pending** — an `org_invitations` row with `status='pending'` (and not expired) exists, no membership yet.
- **not-yet-invited** — no invite row.
Render this by LEFT-JOINing the roster read (already in `org.py::get_org_members`) against `org_invitations`, or by a second `GET /org/invitations` the InvitationsTab consumes. Keep it a server-computed field; never trust a client flag.
**Example:**
```python
# Source: backend/app/api/org.py pattern (extends the existing require_org_manage reads) + Python docs
import secrets, hashlib, hmac
from datetime import datetime, timedelta, timezone

def mint_invite_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)                       # ~43 chars, URL-safe — only in the link
    token_hash = hashlib.sha256(raw.encode()).hexdigest() # only THIS is stored (T-161-04)
    return raw, token_hash

def verify_token(raw: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hashlib.sha256(raw.encode()).hexdigest(), stored_hash)  # constant-time

# INSERT on the user-JWT/RLS connection so the org_invitations_insert WITH CHECK
# (org:invite + org_id ∈ current_user_org_ids) enforces the write (mig 104:355-358).
```

### Pattern 2: THE JIT seam (INV-02 / D-167-05) — RESOLVED
**What:** Keep the mig-105 trigger as the fresh-signup personal-org default; make the *invited* fork a **token-gated app-layer accept endpoint** that does the idempotent JIT membership insert. **ZERO migration** (primary).
**Why NOT the trigger:** (1) the trigger fires inside the `auth.users` INSERT and has `new.email` but NOT the raw token — email-match auto-join is a security hole (the token is the capability); (2) signup in this app is pure client→GoTrue (`useAuth.ts` → `supabase.auth.signUp()`), so there is no backend signup handler to fork in; (3) Supabase's own docs recommend the DB trigger for profile/related-row creation but warn "if the trigger fails it could block signups" — the mig-105 swallow already handles that, and you do NOT want token logic inside that fragile path.
**Why app-layer accept works for BOTH user types (D-167-01 keep-both):**
- Existing user → signs IN → `POST /org/invitations/accept` → additively joins the inviting org (still has their personal org).
- New user → signs UP → mig-105 trigger creates their personal org → `POST /org/invitations/accept` → additively joins the inviting org. Both end at 2+ orgs; the 166 switcher handles it.
**The idempotent insert** (the invitee is not yet a member, so the user-JWT `org_members_insert` policy — which needs `org:manage` — cannot be used; go through a token-authorized service-role/asyncpg path):
```sql
-- Source: PostgreSQL advisory-lock docs + mig 104 org_members UNIQUE(org_id,user_id)
BEGIN;
  -- serialize concurrent first-logins on the SAME (org,user) so the status flip + insert are atomic
  SELECT pg_advisory_xact_lock(hashtext($org_id::text || $user_id::text));
  -- validate the invite is still claimable INSIDE the lock
  --   (status='pending' AND expires_at > now() AND token_hash matches)
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES ($org_id, $user_id, $role)
  ON CONFLICT (org_id, user_id) DO NOTHING;      -- the hard convergence guarantee (INV-02)
  UPDATE public.org_invitations
     SET status='accepted', updated_at=now()
   WHERE id=$invite_id AND status='pending';     -- single-use: only flips the first time
COMMIT;
```
The `UNIQUE(org_id,user_id)` + `ON CONFLICT DO NOTHING` is the load-bearing idempotency; the advisory lock (`pg_advisory_xact_lock`, transaction-scoped, auto-released at COMMIT) prevents a lost-update / double-accept on concurrent tabs. `hashtext(text)` maps the composite key to the `bigint` the single-arg advisory-lock takes.
**Migration decision — STATED EXPLICITLY:** **ZERO migration required.** The membership INSERT runs from app-code through the existing `get_service_role_supabase(org_id)` (or the asyncpg pool) authorized by the validated token. The ONLY scenario that needs migration slot 112 is if the planner prefers a `SECURITY DEFINER accept_org_invitation(p_token_hash)` function (single-round-trip atomicity) — an equivalent, optional alternative, not a requirement. **Do NOT extend the mig-105 trigger.**

### Pattern 3: VIS-01 greenlist resolver generalization (ZERO migration)
**What:** Extend `feature_audience(feature)` (currently returns `'everyone'|'operators'`) and `require_visible` to read `{audience:'role', roles:[...]}` (and optional group grants) and resolve the caller's org role(s), with the Glean precedence-merge.
**Zero-migration confirmation:** `app_settings.feature_visibility` is already `jsonb NOT NULL DEFAULT '{}'` (mig 098) and stores enum-shaped records; adding a third audience shape is a value change, no DDL. The `set_feature_visibility()` writer already does a JSONB `||` merge — extend the validated record it serializes.
**Reading the caller's role:** 166 already resolves + validates it — `get_active_org_id` stashes `request.state.org_role` (the caller's role in the active org), and `_has_org_permission` runs `current_user_has_permission` AS THE CALLER. For greenlists, resolve the caller's role for the active org and compare against the audience `roles[]`. The precedence merge (highest role wins for the primary tier; union for secondary grants) is a pure in-memory reduction over the caller's role + any group memberships — no new query beyond the role already on `request.state`.
**Critical carve-out (do NOT regress):** `require_visible` is a no-op for operators AND for `everyone` audiences; the `GET /features` map + the Deep/chat carve-outs stay byte-identical. Generalize the ONE resolver — never fork it (D-167-06, mirrors the SEED-115 "one swappable boundary" comment already in `dependencies.py:463`).
**Example:**
```python
# Source: backend/app/models/user_settings.py::feature_audience (extend, don't fork)
def resolve_feature_access(feature: str, caller_role: str, caller_groups: set[str]) -> bool:
    rec = _feature_record(feature)          # {"audience": "everyone"|"operators"|"role", "roles":[...], "groups":[...]}
    aud = rec.get("audience")
    if aud == "everyone": return True
    if aud == "operators": return False     # operator gate handled upstream (is_operator no-op)
    if aud == "role":
        # highest-role-wins primary + union secondary (Glean): visible if the caller's role is
        # granted OR any of the caller's groups is granted.
        return caller_role in set(rec.get("roles", [])) or bool(caller_groups & set(rec.get("groups", [])))
    return False                            # unknown shape → safe-deny (matches current cold-default)
```

### Pattern 4: VIS-02 two-layer per-user model default
**What:** Overlay `user_settings.preferences.default_model` onto the effective settings, gated by the operator/org allowed-set + a lock flag.
**THE read seam (verified):** the model default enters the send path at `load_user_settings(current_user["id"])` (called at `threads.py:837`). Today `load_user_settings` (user_settings.py:861) **ignores `user_id` and returns the GLOBAL `load_app_settings()`** — so the "default model" is currently global. VIS-02 makes this the two-layer point:
1. Operator governs the allowed-set: a model is offerable only if it is enabled in `model_capabilities_overrides` (the 149 registry `enabled` flag = shows-in-picker — the SEED-116 natural coupling).
2. User picks within it: `user_settings.preferences.default_model` (discretion on the exact JSON key, D-167-04).
3. Operator LOCK: a policy flag (e.g. `app_settings` or `organizations.settings`) pins the org default and turns off the user override.
4. Overlay is applied ONLY when the preference is set, valid (∈ enabled allowed-set), and not locked → otherwise the global default flows unchanged.
**D-14 red line:** the overlay must be a **no-op when no preference is set**, so `resolve_run_model` and the shared Deep/workflow path stay byte-identical. The frontend chat composer already sends `body.model` when the user picks in-composer (`selectedModel || undefined` in `ChatArea.tsx`), and falls back to `user_settings.llm_model` when absent — the per-user default sets both the picker's initial value AND the server-side fallback.
**Cross-provider (D-167-09 / SC#10):** the chosen default routes through the SAME `resolve_run_model` → `get_model_capability_async` provider resolution that already handles OpenAI/Anthropic/Google/OpenRouter; VIS-02 changes WHICH model id is the default, not the routing — the provider is re-derived from the model id, so a per-user Anthropic default routes to Anthropic with no per-provider fork.
**Blocking-I/O note:** `load_user_settings` is currently SYNC (reads the 30s cache). Reading `user_settings.preferences` per-user is a DB read — the planner must either (a) fetch the per-user preference on an async seam and pass it in, or (b) cache it. Do NOT add a blocking supabase-py call inside an async handler without `run_in_threadpool` (D-v2.5-01). The cleanest seam is to resolve the per-user default alongside the existing async settings load and overlay before `resolve_run_model` reads `user_settings.llm_model`.

### Pattern 5: Env-switched email provider abstraction (D-167-02)
**What:** A thin `EmailProvider` protocol with three implementations selected by an env var (`EMAIL_PROVIDER`, default `none`).
```python
# Source: repo env-switch precedent (SANDBOX_IMAGE / provider routing) + Resend SDK docs
class EmailProvider(Protocol):
    def send_invite(self, to: str, link: str, org_name: str) -> None: ...

class NoneLogProvider:                       # DEFAULT — offline/self-hosted, no creds
    def send_invite(self, to, link, org_name):
        logger.info("invite link for %s (%s): %s", to, org_name, link)   # never logs the token elsewhere

class ResendProvider:                        # EMAIL_PROVIDER=resend
    def send_invite(self, to, link, org_name):
        import resend; resend.api_key = settings.resend_api_key
        resend.Emails.send({"from": settings.invite_from, "to": to,
                            "subject": f"You're invited to {org_name}",
                            "html": f'<a href="{link}">Join {org_name}</a>'})
```
The link is always returned to the inviter for copy/share regardless of provider (link-first). `APP_BASE_URL` (or reuse the `/public-config` base) composes the link; the provider secret (`RESEND_API_KEY`) is env-only (CLAUDE.md: secrets in env) — and if the app grows a secrets table, route it through the Phase-150 `enc:v1:` envelope.

### Anti-Patterns to Avoid
- **Email-match auto-join in the mig-105 trigger** — the token is the capability; email match alone is a takeover vector.
- **Storing the raw token** (or logging it) — only `token_hash` persists; only the link carries the raw token.
- **Reversible crypto (Phase-150 MultiFernet) for the token** — wrong tool; use one-way `sha256` + `hmac.compare_digest`.
- **Forking `require_visible`** for greenlists — generalize the one resolver (D-167-06).
- **A per-user model overlay that changes the shared path when unset** — must be a strict no-op (D-14).
- **A blocking supabase-py preference read inside an async handler** — wrap with `run_in_threadpool` (D-v2.5-01).
- **Absorbing the invitee's personal org** — additive only (D-167-01).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation | Custom RNG / uuid-as-secret | `secrets.token_urlsafe(32)` | Purpose-built CSPRNG; uuid4 is not a secret-grade token. |
| Token storage/verify | Reversible encryption / plaintext / bcrypt | `hashlib.sha256` + `hmac.compare_digest` | High-entropy token → fast one-way hash + constant-time compare; bcrypt is for low-entropy passwords, reversible crypto leaks the token. |
| Concurrent-first-login idempotency | App-side "check then insert" | `UNIQUE(org_id,user_id)` + `ON CONFLICT DO NOTHING` (+ `pg_advisory_xact_lock`) | The DB constraint is the only race-free guarantee; app-side checks have a TOCTOU window. |
| Active-org validation / role gate | New auth code | `get_active_org_id` + `require_org_manage` + `_has_org_permission(...,'org:invite')` (166, dependencies.py) | Server-validated `X-Org-Id`, spoof→403, runs AS THE CALLER — already hardened + tested. |
| Feature audience map | A new roles table / new column | `app_settings.feature_visibility` JSONB + `feature_audience()` extension | Shipped forward-compatibly (mig 098); zero migration (D-167-06). |
| Per-user prefs store | A new prefs table | `user_settings.preferences jsonb` (mig 011) | Already present (dead); revive it (D-167-04). |
| Email delivery | Raw SMTP handshakes | `resend` SDK (opt-in) / none-log default | Deliverability (SPF/DKIM) + retries are solved; link-first means email is optional. |
| Personal-org-on-signup | New signup hook | mig-105 `handle_new_user` trigger (unchanged) | Already idempotent + swallow-guarded; keep as the fresh-signup default. |

**Key insight:** Almost every "hard" part of this phase was pre-solved by 161–166. The net-new surface is small: token mint/hash/verify (stdlib), one token-gated accept transaction (advisory lock + ON CONFLICT), two resolver extensions (greenlist + prefs overlay), one email abstraction (3 tiny impls), and the UI that fills the shipped LockedTab.

## Common Pitfalls

### Pitfall 1: Trigger-based invited fork (the seductive wrong answer)
**What goes wrong:** Extending mig-105's `handle_new_user` to auto-join on `new.email` matching a pending invite.
**Why it happens:** The trigger already has `new.email` and already provisions orgs — it looks like the natural place.
**How to avoid:** Keep the trigger as personal-org-only; do the invited fork in a token-gated accept endpoint post-auth. The token — not the email — is the authorization.
**Warning signs:** Any SQL in a trigger that reads `org_invitations` by email; a plan task that adds a migration to the trigger for INV-02.

### Pitfall 2: Accept insert blocked by RLS
**What goes wrong:** Trying to INSERT `org_members` on the invitee's user-JWT connection — the `org_members_insert` policy requires `current_user_has_permission(org_id,'org:manage')`, which the invitee does NOT have (they're not a member yet) → the insert is silently RLS-denied (0 rows) or errors.
**Why it happens:** 166 correctly moved most reads to user-JWT/RLS; the accept is the one write that legitimately precedes membership.
**How to avoid:** Do the accept insert through `get_service_role_supabase(org_id)` (or the asyncpg pool), authorized by the validated `token_hash`, scoped to the org from the invite row. This mirrors how mig-105 §A / `create_org_with_default_dept` are service-role/SECDEF paths.
**Warning signs:** Accept "succeeds" but no membership appears; a 403/empty on the insert.

### Pitfall 3: Double-accept / expired-but-claimed race
**What goes wrong:** Two concurrent tabs (or a retry) both accept, or an expired invite still gets claimed.
**How to avoid:** `pg_advisory_xact_lock` around the check+insert+flip; validate `status='pending' AND expires_at > now()` INSIDE the lock; guard the status UPDATE with `WHERE status='pending'` so only the first flips.
**Warning signs:** Duplicate membership attempts; an accepted invite whose status stayed `pending`.

### Pitfall 4: VIS-02 overlay leaks into Deep Mode
**What goes wrong:** The per-user default overlay mutates the shared settings even when no preference is set → Deep byte-identity breaks (D-14 red line, SC#10 axis).
**How to avoid:** Overlay ONLY when `preferences.default_model` is set, valid (∈ enabled allowed-set), and unlocked; otherwise return the global settings object unchanged (identity-preserving).
**Warning signs:** A differential test of the send path shows a changed `body.model` for a user with no preference.

### Pitfall 5: JSONB double-serialization on greenlist read
**What goes wrong:** `feature_visibility` may be stored as a JSON string literal in JSONB (the migration-runner `json.dumps` before the codec) — `_build_settings_from_row` already guards this for `feature_visibility` and `provider_model_lists`.
**How to avoid:** Reuse the existing dict-or-str guard when reading the generalized record; don't add a second parse path.
**Warning signs:** A greenlist audience that reads as a string, not a dict.

### Pitfall 6: Cross-org invite / greenlist scope confusion
**What goes wrong:** An invite or greenlist write lands on the wrong org, or `org:invite` is checked against the wrong org.
**How to avoid:** Every write pins `org_id` to `get_active_org_id` (server-validated) and gates on `org:invite` (mirror `require_org_manage`). The `org_invitations_insert` WITH CHECK already enforces `org_id ∈ current_user_org_ids` — keep the write on the user-JWT connection so RLS is the backstop.
**Warning signs:** An invite row whose `org_id` differs from the caller's active org.

## Code Examples

### Mirror `require_org_manage` for the `org:invite` gate
```python
# Source: backend/app/dependencies.py::require_org_manage (adapt permission key)
async def require_org_invite(
    request: Request,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),
) -> dict:
    if not await _has_org_permission(request, current_user, active_org, "org:invite"):
        raise HTTPException(status_code=403, detail="You do not have permission to invite to this organization.")
    return current_user
```

### JSONB `||` merge writer for a greenlist audience (extend the shipped writer)
```python
# Source: backend/app/models/user_settings.py::set_feature_visibility (validated record only)
await pool.execute(
    "UPDATE app_settings SET feature_visibility = "
    "coalesce(feature_visibility, '{}'::jsonb) || $1::jsonb, updated_at = now() "
    "WHERE id = 'global'",
    {feature: {"audience": "role", "roles": validated_roles}},  # asyncpg JSONB codec serializes
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Binary `{audience: everyone|operators}` visibility | `{audience: role, roles:[...]}` + group grants, one resolver | This phase (VIS-01) | The SEED-115 forward-compat shape (mig 098) is finally exercised — no migration. |
| Global default model (`load_user_settings` ignores user_id) | Per-user `user_settings.preferences.default_model` overlay, operator-locked | This phase (VIS-02) | First concrete instance of the SEED-116 two-layer pattern. |
| Read-only 166 roster, LockedTab invitations | Live invite/accept + adoption chips | This phase (INV-01/02) | Fills the shipped 166 seam. |
| `xmlsec1`/`python3-saml` hand-rolled SAML (rejected milestone-wide) | Supabase Auth owns SAML (Phase 168) | v3.4 | INV-02's accept endpoint is the shared JIT path SSO reuses. |

**Deprecated/outdated:**
- Do NOT reach for `python-jose`/JWT-as-invite-token — the invite is an opaque single-use capability, not a claims token.
- Do NOT reuse Phase-150 `secret_cipher` for the invite token (reversible; wrong tool).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Invite expiry default = 7 days | Pattern 1 / § Security | Low — `expires_at` is a per-invite value; discuss-phase can pick 24h/7d/30d. Needs user confirmation (retention/security policy). |
| A2 | Supabase local uses default GoTrue signup (autoconfirm on / no email-confirm gate) so `signUp()` → immediate authed session → accept can run right after | Pattern 2 | Medium — if email-confirmation is ON, a new user isn't authed until they confirm, so the accept must happen AFTER first successful sign-in (the token must survive in the link/landing state across the confirm round-trip). No `supabase/config.toml` was found in-repo to confirm the setting; verify against the live GoTrue config at plan time. |
| A3 | `boto3`/SES is the SES provider impl | Standard Stack | Low — SES is optional/deferred; resend + none-log covers the milestone. Verify on PyPI + slopcheck only if SES is actually added. |
| A4 | Group grants for greenlists resolve from a caller "groups" set | Pattern 3 | Medium — full group management is deferred (CONTEXT); this phase ships the RESOLVER + minimal surface. The exact group source (org role tiers vs a future groups table) needs the planner to scope the "minimal admin surface." |
| A5 | The operator LOCK for the model default is a policy flag in `app_settings`/`organizations.settings` | Pattern 4 | Low — exact home is discretion (D-167-04); `organizations.settings` JSONB (mig 104) is the natural per-org home. |
| A6 | `resend` (real email) is NOT added to default `requirements` — installed only on operator opt-in | Standard Stack | Low — keeps the offline default dependency-free (D-167-02); if the planner adds it to requirements it must update the Phase-157/158 deploy artifacts (same-commit rule) + `slopcheck` gate. |

**If this table is empty:** it is not — A1/A2/A4 in particular should be confirmed at discuss/plan time.

## Open Questions

1. **Email-confirmation on signup (A2)?**
   - What we know: signup is pure client→GoTrue; mig-105 trigger provisions the personal org on `auth.users` INSERT regardless of confirmation.
   - What's unclear: whether local/cloud GoTrue requires email confirmation before the session is live (affects WHEN the accept endpoint can run for a brand-new user).
   - Recommendation: design the accept to be idempotent + re-runnable and have the `/invite?token=…` landing page persist the token and call accept on the FIRST authenticated session (works whether confirmation is on or off). Verify the live GoTrue setting at plan time.

2. **Group source for greenlists (A4)?**
   - What we know: the resolver must handle `roles:[...]` and "group grants" with union precedence; full group CRUD is deferred.
   - What's unclear: whether "groups" this phase = the 4 role tiers only, or a thin group concept.
   - Recommendation: ship the resolver against role tiers (+ an empty/extensible groups set) and a minimal admin surface that sets role audiences; leave the groups table for a later phase (matches CONTEXT deferral).

3. **Invite link base URL source?**
   - What we know: `/public-config` already serves runtime config to the SPA; the SPA has no dedicated `/invite` route yet.
   - Recommendation: add an `APP_BASE_URL` env (or reuse the public-config origin) to compose the link server-side; add a lightweight `/invite?token=…` landing route in the SPA.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Supabase local) | all (org_invitations, advisory lock) | ✓ | 15.x | — |
| Python stdlib `secrets`/`hashlib`/`hmac` | token crypto | ✓ | 3.12 | — |
| `asyncpg` (advisory lock path) | INV-02 accept | ✓ (in tree) | in-tree | supabase-py service-role insert |
| `supabase-py` service-role factory | accept insert | ✓ (`get_service_role_supabase`) | in-tree | — |
| `resend` | real email (opt-in) | ✗ (not installed; not needed by default) | 2.34.0 avail | `none`-log provider (default) — logs the link |
| SMTP relay | (not used) | — | — | link-first / resend |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `resend` — the default `none`-log provider requires no install; real email is operator opt-in.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: `pytest` (in-tree, `backend/tests/`); Frontend: `vitest` + Testing Library (`frontend/src/**/__tests__`) |
| Config file | Backend: `backend/pytest.ini`/`pyproject` (existing); Frontend: `frontend/vitest.config.*` (existing) |
| Quick run command | Backend: `cd backend && python -m pytest tests/test_167_*.py -x -q`; Frontend: `cd frontend && npx vitest run src/components/org` |
| Full suite command | Backend: `cd backend && python -m pytest -q`; Frontend: `cd frontend && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | Send requires `org:invite` (default-deny 403) | unit | `pytest tests/test_167_invitations.py::test_send_requires_org_invite -x` | ❌ Wave 0 |
| INV-01 | Token stored ONLY as hash; raw token only in returned link | unit | `pytest tests/test_167_invitations.py::test_token_hash_never_returned_or_stored -x` | ❌ Wave 0 |
| INV-01 | Adoption state derives not-invited/pending/active correctly | unit | `pytest tests/test_167_invitations.py::test_adoption_state_derivation -x` | ❌ Wave 0 |
| INV-01 | Expired / revoked invite cannot be accepted | unit | `pytest tests/test_167_invitations.py::test_expired_and_revoked_rejected -x` | ❌ Wave 0 |
| INV-02 | Accept creates exactly one membership (ON CONFLICT idempotent) | unit | `pytest tests/test_167_invitations.py::test_accept_idempotent_single_membership -x` | ❌ Wave 0 |
| INV-02 | Concurrent accept converges to one membership (advisory lock) | integration | `pytest tests/integration/test_167_jit_race.py -x` | ❌ Wave 0 |
| INV-02 | Existing user keeps personal org + joins (D-167-01) | unit | `pytest tests/test_167_invitations.py::test_join_additive_keeps_both -x` | ❌ Wave 0 |
| VIS-01 | `require_visible` allows granted role, denies ungranted; operator + everyone stay no-op | unit | `pytest tests/test_167_greenlist.py -x` | ❌ Wave 0 (extends test_148_require_visible.py) |
| VIS-01 | Precedence merge: highest role wins primary, union secondary | unit | `pytest tests/test_167_greenlist.py::test_precedence_merge -x` | ❌ Wave 0 |
| VIS-02 | Per-user default overlays only when set + valid + unlocked | unit | `pytest tests/test_167_prefs.py::test_two_layer_overlay -x` | ❌ Wave 0 |
| VIS-02 | Unset preference → send path byte-identical (D-14) | unit | `pytest tests/test_167_prefs.py::test_deep_byte_identical_when_unset -x` | ❌ Wave 0 |
| VIS-02 | Operator lock pins org default, ignores user override | unit | `pytest tests/test_167_prefs.py::test_operator_lock_wins -x` | ❌ Wave 0 |
| INV-01/UI | InvitationsTab renders, invite modal role picker (Dept-admin greyed) | component | `npx vitest run src/components/org/InvitationsTab.test.tsx` | ❌ Wave 0 |
| INV-01/UI | Adoption chips on roster (pending/active) | component | `npx vitest run src/components/org/OrgMembersTab.test.tsx` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_167_*.py -x -q` (+ targeted vitest for touched components)
- **Per wave merge:** backend `pytest -q` on `tests/test_167_*` + `test_166_org_gate.py` + `test_148_*` (no-regression on the shared org gate + visibility resolver); frontend `vitest run src/components/org src/providers`
- **Phase gate:** full backend + frontend suites green + the org-isolation exit-gate (`test_v3_4_org_isolation.py`) re-run (per ROADMAP: re-run AFTER 167 lands) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/test_167_invitations.py` — INV-01/INV-02 (send gate, token hash, adoption state, expiry/revoke, accept idempotency, join-additive). Reuse `test_166_org_gate.py` seams (conftest `get_current_user` override, `mock_asyncpg_pool`, `_install_perms` for `org:invite`).
- [ ] `backend/tests/integration/test_167_jit_race.py` — concurrent-accept advisory-lock convergence (needs a live DB or a 2-connection asyncpg harness; the `tests/integration/_rls_harness` precedent).
- [ ] `backend/tests/test_167_greenlist.py` — VIS-01 role/group resolution + precedence merge (extends `test_148_require_visible.py` / `test_148_visibility_cold_default.py`).
- [ ] `backend/tests/test_167_prefs.py` — VIS-02 two-layer overlay, unset-no-op, lock.
- [ ] `frontend/src/components/org/InvitationsTab.test.tsx` — invite modal + pending list + resend/revoke + copy-link.
- [ ] SC#10 cross-provider live UAT (VIS-02 model-default routing across OpenAI/Anthropic/Google/OpenRouter) — authored under `167-VALIDATION.md`, NOT PLAN tasks (per CLAUDE.md UAT recipe).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Single-use invite token = a bearer capability; high-entropy `secrets.token_urlsafe(32)`, one-way `sha256` at rest, `hmac.compare_digest` verify, expiry + single-use status transition. |
| V3 Session Management | partial | Accept runs on the caller's already-validated GoTrue session (`get_current_user`); no new session state. |
| V4 Access Control | yes | `org:invite` gate on writes (mirror `require_org_manage`); server-validated `X-Org-Id` (spoof→403); RLS `org_invitations` WITH CHECK on `org_id ∈ current_user_org_ids`; greenlist audience decisions are API-enforced, client render-only. Membership INSERT is a token-authorized service-role path (invitee lacks `org:manage`). |
| V5 Input Validation | yes | Validate email (`EmailStr`/pydantic), role ∈ {member, org-admin} (Dept-admin refused this phase), audience roles ∈ the 4-tier set, model id ∈ enabled allowed-set. Parameterized `$1` binds everywhere (never f-string SQL). |
| V6 Cryptography | yes | stdlib one-way hash for the token (NOT the Phase-150 reversible cipher); `secrets` CSPRNG; constant-time compare. Provider secrets (`RESEND_API_KEY`) env-only. |

### Known Threat Patterns for {invitation + org onboarding}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invite takeover by email-match auto-join in a signup trigger | Spoofing / Elevation | Token-gated accept post-auth; NEVER email-match in the trigger. |
| Raw token stored/logged/leaked | Information Disclosure | Store only `sha256(token)`; raw token only in the link; the none-log provider logs the link, never a bare token elsewhere. |
| Concurrent first-login / double-accept race | Tampering | `pg_advisory_xact_lock` + `UNIQUE(org_id,user_id)` + `ON CONFLICT DO NOTHING`; status flip guarded `WHERE status='pending'`. |
| Expired / revoked invite replay | Tampering | `status='pending' AND expires_at > now()` validated inside the lock; single-use flip. |
| Cross-org invite / role escalation via forged `X-Org-Id` or role | Elevation | `get_active_org_id` server-validation; `org:invite` gate; RLS WITH CHECK pins `org_id`; role CHECK refuses `super-admin` (mig 104 CR-02) — invitations may set only member/org-admin (dept-admin greyed). |
| Greenlist / lock bypass via forged client flag | Elevation | `require_visible`/`require_org_*` are the sole authority; the client `canManage`/audience flags are render-only (166 T-166-07 precedent). |
| Adjacent live leak: skills cross-org (SEED-125) | Information Disclosure | OUT OF SCOPE here but flagged — memory notes SEED-125 (`load_skill`/`execute_code` `.or_(is_org_shared)` on service-role, no org gate) should close before/around 166/167; surface to discuss-phase, do not silently fold. |

## Sources

### Primary (HIGH confidence)
- In-repo verified reads (direct, this session): `supabase/migrations/104_org_dept_role_schema.sql` (org_invitations table, `org:invite` policy, role_permissions seed, `current_user_has_permission`), `105_personal_org_backfill.sql` (`handle_new_user` trigger — the JIT fork point), `098_feature_visibility.sql` (JSONB audience shape), `011_cleanup_user_settings.sql` (`preferences` column), `backend/app/dependencies.py` (`get_active_org_id`/`require_org_manage`/`_has_org_permission`/`require_visible`/service-role factory), `backend/app/api/org.py` (166 router pattern), `backend/app/models/user_settings.py` (`feature_audience`/`load_user_settings`/`set_feature_visibility`), `backend/app/services/run_model_resolution.py` (VIS-02 send seam), `frontend/src/hooks/useAuth.ts` + `AuthPage.tsx` (pure client→GoTrue signup), `OrgProvider.tsx`/`OrgAdminShell.tsx`/`OrgMembersTab.tsx` (166 UI seam), `backend/tests/test_166_org_gate.py` (test pattern). Migration head verified = 111 → next free slot 112.
- `docs.python.org/3/library/secrets` — `token_urlsafe` for auth tokens `[CITED]`.
- `docs.python.org/3/library/hashlib` + `hmac.compare_digest` — one-way token hashing + constant-time compare `[CITED]`.
- PostgreSQL advisory-lock semantics (`pg_advisory_xact_lock`, transaction-scoped) `[CITED: postgresql.org/docs — Advisory Locks]`.

### Secondary (MEDIUM confidence)
- Supabase Auth "Managing user data" — recommends DB triggers (`SECURITY DEFINER`) for post-signup related-row creation; warns a failing trigger can block signups `[CITED: supabase.com/docs/guides/auth/managing-user-data]` (corroborates keeping token logic OUT of the trigger).
- PyPI metadata + `slopcheck` v0.6.1 — `resend` 2.34.0 `[OK]`, `resendlabs/resend-python`, 60 releases.

### Tertiary (LOW confidence)
- Supabase Auth Hooks (before-user-created / custom-access-token) exist as a newer server-side mechanism `[ASSUMED — training]` but are for JWT-claim customization / gating (Pro+ / self-hosted config), not the right seam for a token-gated accept; the app-layer accept endpoint is correct regardless.
- SES via `boto3` as the third email provider `[ASSUMED]` — verify before adding.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — token crypto is stdlib; `resend` verified via slopcheck + PyPI; every reused seam read directly.
- Architecture (JIT seam, greenlist, prefs): HIGH — the seams (`load_user_settings`, `feature_audience`, `require_org_manage`, mig-105 trigger, `org_invitations` policy) are all confirmed in-tree; the migration/no-migration call is decisively answered (ZERO migration primary).
- Pitfalls: HIGH — derived from the actual RLS policies (org_members_insert needs org:manage) and the D-14/SC#10 constraints.
- Email + expiry policy: MEDIUM — provider abstraction is clear; the expiry-duration and email-confirmation-timing (A1/A2) need discuss-phase confirmation.

**Research date:** 2026-07-21
**Valid until:** ~2026-08-20 (stable — mostly in-repo substrate; `resend` version may bump, re-verify at install)
