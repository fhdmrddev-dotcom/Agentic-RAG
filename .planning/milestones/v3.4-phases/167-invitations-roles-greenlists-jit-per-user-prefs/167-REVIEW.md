---
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
reviewed: 2026-07-22T00:00:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - backend/app/services/invitation_service.py
  - backend/app/services/email_provider.py
  - backend/app/services/audit_service.py
  - backend/app/services/run_model_resolution.py
  - backend/app/api/org.py
  - backend/app/api/me_preferences.py
  - backend/app/api/features.py
  - backend/app/api/admin.py
  - backend/app/api/threads.py
  - backend/app/dependencies.py
  - backend/app/models/user_settings.py
  - backend/app/config.py
  - backend/app/main.py
  - frontend/src/pages/AcceptInvitePage.tsx
  - frontend/src/App.tsx
  - frontend/src/lib/api.ts
  - frontend/src/components/org/InviteMemberDialog.tsx
  - frontend/src/components/org/InvitationsTab.tsx
  - frontend/src/components/org/OrgAdminShell.tsx
  - frontend/src/components/org/OrgAuditTab.tsx
  - frontend/src/components/admin/FeatureVisibility.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/settings/ModelDefaultPreference.tsx
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 167: Code Review Report

**Reviewed:** 2026-07-22
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 167 adds invitation token crypto + JIT accept, role greenlists (VIS-01),
per-user model defaults (VIS-02), and explicit-org audit rows. The token-security
and JIT-race surfaces are **strong**: `secrets.token_urlsafe(32)` with only the
`sha256` hash stored, lookup-by-hash (no timing side-channel), and a
`pg_advisory_xact_lock` + `INSERT … ON CONFLICT DO NOTHING` + guarded status-flip
that provably converges concurrent accepts to one membership (the integration test
proves it). The VIS-02 write/read path re-validates the allowed-set and lock
server-side and fails safe. Audit rows correctly carry an explicit `org_id`.

However, the **role greenlist (VIS-01) has a broken-access-control defect that
inverts operator intent**: because every user is `org-admin` of their own personal
org (mig 105), the greenlist role resolver grants any `org-admin`-greenlisted
feature to **every authenticated user**. This is a BLOCKER — it is the exact
"can a user see a feature their role isn't greenlisted for?" failure the phase set
out to prevent, and it is reachable through the new "By role" control this phase
ships. Five warnings (blocking I/O in async handlers, email HTML injection,
page-scoped adoption chips, a cross-provider default misroute, and stale
Control-Room audience display) and two info items follow.

## Critical Issues

### CR-01: Role greenlist grants org-admin features to every user (personal-org org-admin defeats the greenlist)

**File:** `backend/app/dependencies.py:456-487` (`_highest_role` / `resolve_caller_role`), consumed by `require_visible` (`:490-528`) and `app/api/features.py:44-70`
**Issue:**
The greenlist gate resolves the caller's effective role via `resolve_caller_role`.
When `request.state.org_role` is not set — which is the case for **every governed
endpoint that attaches `require_visible` but does not run `get_active_org_id`**
(`settings.py` model_management, `evals.py`, `skill_tuner.py`, `skill_test_cases.py`,
`workflows.py` authoring, `document_governance.py`) and for the `GET /features`
map (`features.py` never resolves an active org) — it falls back to
`_highest_role([...all of the caller's memberships...])`.

Every user is provisioned as **`org-admin` of their personal org** (mig 105 §A
backfill and the `handle_new_user` signup trigger both `INSERT INTO org_members
(…, role) VALUES (…, 'org-admin')` — confirmed in
`supabase/migrations/105_personal_org_backfill.sql:67-68,104-105`). Therefore
`_highest_role` returns **at least `org-admin` for every authenticated user**,
regardless of their role in any real org.

Consequences when an operator uses the new "By role" control:
- Setting a feature (e.g. `model_management`, `skill_studio`) to `role:["org-admin"]`
  grants it to **every user on the platform** — a plain `member` of Acme who is
  `org-admin` of their own personal org passes `resolve_feature_access("…",
  "org-admin", …)`. That user can then hit the model-management / re-embed / eval
  endpoints the operator believed were admin-only.
- `role:["member"]` or `role:["dept-admin"]` **denies everyone** (nobody's
  *highest* role is `member`/`dept-admin`; it is `org-admin`), the inverse surprise.

Net: the greenlist is effectively "contains `org-admin` → everyone; else →
super-admins only", which is not what the UI's "Visible to these roles" chips
communicate. The Phase-167 greenlist unit tests do **not** catch this because they
all `monkeypatch resolve_caller_role` to a fixed role (`test_167_greenlist.py:126,
142,160,182,199`) — the real highest-role-across-memberships fallback is never
exercised.

**Fix:**
Resolve the greenlist role against the caller's role in a **specific, validated org
context**, and never silently substitute the personal-org `org-admin`. Options:
- Make `require_visible` and `GET /features` resolve the active org
  (`get_active_org_id`) and evaluate the greenlist against `request.state.org_role`
  only — remove the "highest role across all memberships" fallback (it is the
  load-bearing bug), OR
- Exclude personal orgs from the role scan (requires a personal-org marker — mig 104
  deliberately has none, so this needs schema support), OR
- Gate the greenlist on the **real org** membership set, excluding any org where the
  caller is the sole member/owner.

Minimum viable hardening (no schema change): drop the highest-role fallback and
fail closed when `request.state.org_role` is absent —
```python
async def resolve_caller_role(request, current_user):
    role = getattr(getattr(request, "state", None), "org_role", None)
    if role:
        return role, set()
    # No server-validated active-org role → fail closed. Do NOT scan all
    # memberships: every user is org-admin of their personal org, so a highest-role
    # scan grants org-admin-greenlisted features to everyone (CR-01).
    return None, set()
```
and ensure the governed endpoints + `GET /features` resolve `org_role` (via
`get_active_org_id`) before the gate runs, so a real org role is available.

## Warnings

### WR-01: Blocking `resend.Emails.send()` runs inside async handlers (no `run_in_threadpool`)

**File:** `backend/app/api/org.py:376` and `:495` (`get_email_provider().send_invite(...)`); impl `backend/app/services/email_provider.py:57-73`
**Issue:**
`send_org_invitation` and `resend_org_invitation` are `async def`, and they call
`get_email_provider().send_invite(...)` directly. For `EMAIL_PROVIDER=resend`,
`ResendProvider.send_invite` performs a **synchronous, blocking HTTP call**
(`resend.Emails.send({...})`) on the event loop, stalling every other request on
the worker until the Resend API responds. This violates the project rule (CLAUDE.md
D-v2.5-01: "Do not run blocking I/O directly inside async handlers — wrap with
`run_in_threadpool`"). The default `none` provider only logs, so this is latent
until real email is enabled.
**Fix:**
```python
from starlette.concurrency import run_in_threadpool
try:
    await run_in_threadpool(get_email_provider().send_invite, email, link, org_name)
except Exception as exc:
    logger.error("invite email delivery failed for %s: %s", email, exc)
```

### WR-02: Email HTML injection via unescaped `org_name` (and `link`) in the Resend template

**File:** `backend/app/services/email_provider.py:63-73`
**Issue:**
`ResendProvider.send_invite` builds the email `html` with f-string interpolation of
`org_name` and `link` with **no HTML escaping**. `org_name` comes from
`organizations.name` (`org.py:370-371,483-484`), which is user/tenant-controlled.
An org named `</a><script>…` or containing `"`/`<` breaks out of the intended
markup, enabling HTML/content injection into outbound invitation emails (phishing
payloads, broken links). Opt-in (`resend`) path only, but it is a real injection at
a trust boundary.
**Fix:** HTML-escape interpolated values before templating:
```python
import html
safe_org = html.escape(org_name)
safe_link = html.escape(link, quote=True)
"html": f'<p>You have been invited to join <strong>{safe_org}</strong>.</p>'
        f'<p><a href="{safe_link}">Accept your invitation</a></p>',
```

### WR-03: Roster adoption chips computed against only the current member page → false "pending"

**File:** `backend/app/api/org.py:242-265`
**Issue:**
`member_emails` is built from `members`, which is a **paginated page**
(`LIMIT page_size OFFSET offset`, `:215-225`). `pending_invitations` is fetched for
the **whole org, unpaginated** (`:243-249`) and filtered with
`if r["email"] not in member_emails`. So a still-`pending` invite whose email
already belongs to a member on a *different* page (e.g. a re-invite of an existing
member, or any member beyond `page_size`) is **not** filtered out and renders as a
`pending` adoption chip even though the person is `active`. On page 2+ the same full
pending list is re-emitted against a different page's emails, so the chip state is
page-dependent and inconsistent.
**Fix:** Compute the member-email set for the dedupe from an org-scoped query
independent of pagination (e.g. `SELECT email FROM org_members m JOIN auth.users u …
WHERE m.org_id = $1`), or filter pending invites in SQL with a `NOT EXISTS` against
`org_members` for the same org, rather than against the current page's emails.

### WR-04: Per-user default of a DB-override cross-provider model may route to the wrong provider

**File:** `backend/app/services/run_model_resolution.py:249-274` (main provider block) vs `apply_user_model_default` overlay (`:167-214`); allowed-set at `backend/app/models/user_settings.py:899-911`
**Issue:**
`enabled_model_allowed_set()` returns only model ids that have a
`model_capabilities_overrides` row (enabled) — i.e. DB-override models. When a user
sets one as their per-user default, `apply_user_model_default` overlays
`user_settings.llm_model` with it, but a new chat sends no explicit `body.provider`.
In `resolve_run_model`, the provider is only re-derived from the model when
`capability_source == "registry"` (`:265`); a `db_override`-sourced capability falls
through to `else: resolved_provider = user_settings.active_provider` (`:273-274`).
So a per-user default that is a **DB-override model belonging to a different provider
than the org's `active_provider`** resolves the model id to the *wrong* provider's
SDK → a provider 400/404 (the class of the UAT Test-7 wart). VIS-02's stated promise
is "cross-provider by construction" (D-167-09), but this path does not honor it for
non-registry capability sources. (The resolution block is verbatim-extracted from
pre-167 code, but VIS-02 newly makes it reachable without an explicit `body.provider`.)
**Fix:** Accept `db_override` alongside `registry` in the main provider re-resolution
(mirroring `_reresolve_fallback_provider:114`), or have `apply_user_model_default`
re-resolve+align the provider for the composed model the same way the fallback path
does. Confirm whether new-thread sends omit `body.provider`.

### WR-05: Control Room seeds visibility + greenlist from client defaults, not server state

**File:** `frontend/src/components/admin/ControlRoomPage.tsx:214-229` (+ `greenlist` state)
**Issue:**
The `visibility` map is seeded from `DEFAULT_VISIBILITY` and `greenlist` from empty
arrays, with no read endpoint ("no read endpoint yet, mirrors the seeded-shell-state
visibility map"). After any reload, the operator UI shows the **default** audience,
not the actual persisted one. An operator who previously set a feature to
`role:[…]` (or `everyone`) sees it rendered as `operators` (or vice-versa), and the
greenlist chips show empty. Combined with CR-01, this makes it easy to
mis-administer visibility: the operator cannot see that a feature is currently
greenlisted (and over-granted). This is display dishonesty on a security-governance
surface.
**Fix:** Add a read of the current audience/greenlist map (extend `GET /features`
or a new operator read) and seed both `visibility` and `greenlist` from server truth
on mount, rather than from client defaults.

## Info

### IN-01: `enabled_model_allowed_set` excludes registry-only models → picker can be empty

**File:** `backend/app/models/user_settings.py:899-911`
**Issue:** The VIS-02 allowed-set includes only models that have a
`model_capabilities_overrides` row. On installs where operators rely on the static
`MODEL_CAPABILITIES` registry without adding override rows, `allowed_models` is
empty and the per-user picker offers only "Auto" — the user can never set a personal
default, and cannot pick common registry models (e.g. `gpt-4o`) even though they are
usable in-chat. Fail-safe, but likely a surprising UX dead-end.
**Fix:** Confirm the intended allowed-set is DB-override-only; if not, union in the
enabled static-registry models the picker already surfaces in `_build_providers`.

### IN-02: Duplicate pending invitations to the same email are allowed

**File:** `backend/app/api/org.py:331-404`
**Issue:** `send_org_invitation` mints a new invite unconditionally; nothing
dedupes an existing `pending` invite for the same `(org_id, email)`. Repeated sends
create multiple live tokens (all acceptable, harmless due to `ON CONFLICT`) and
multiple `pending` roster rows for one person.
**Fix:** Optionally upsert/refuse when a live pending invite for the email already
exists, or dedupe pending rows by email in the roster projection.

---

_Reviewed: 2026-07-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
