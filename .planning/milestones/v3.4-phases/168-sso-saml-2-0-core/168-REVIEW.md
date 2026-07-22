---
phase: 168-sso-saml-2-0-core
reviewed: 2026-07-22T09:32:29Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/app/api/org.py
  - backend/app/api/admin.py
  - backend/app/config.py
  - backend/app/dependencies.py
  - backend/app/security/secret_cipher.py
  - backend/app/services/invitation_service.py
  - backend/app/services/sso_domain_blocklist.py
  - backend/app/services/sso_provider_service.py
  - backend/tests/integration/test_168_sso_authz.py
  - backend/tests/integration/test_168_sso_jit.py
  - backend/tests/integration/test_168_sso_routing.py
  - backend/tests/unit/test_168_sso_provider_service.py
  - frontend/src/components/auth/SignInForm.tsx
  - frontend/src/components/org/OrgAdminShell.tsx
  - frontend/src/components/org/SsoTab.tsx
  - frontend/src/hooks/useAuth.ts
  - frontend/src/hooks/useOrgPermissionsProbe.ts
  - frontend/src/lib/api.ts
  - frontend/src/providers/OrgProvider.tsx
  - supabase/migrations/113_sso_configs_firming.sql
findings:
  critical: 0
  blocker: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 168: Code Review Report

**Reviewed:** 2026-07-22T09:32:29Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 168 adds SAML SSO by proxying Supabase's provider-CRUD API: org-admin
provider CRUD (`/org/sso/providers`), a public identifier-first route lookup
(`/org/sso/route`), a domain-gated JIT membership (`/org/sso/provision`), an
operator approval gate (`/admin/sso/configs/{id}/approve`), the transport
service, blocklist, and the React SSO tab + identifier-first login.

The **core security spine is sound and I could not break it**:

- Every org-scoped `sso_configs` write (create/list/update/delete) runs on the
  caller's user-JWT connection (`get_user_pg_connection`), so mig-104 RLS is the
  real wall; the service-role pool is used only where it is intentional and
  correct (the public route lookup, the not-yet-a-member JIT, the operator
  approve). No org-data write leaks onto a BYPASSRLS connection.
- The JIT role is hardcoded `'member'` inside `provision_sso_membership`, which
  has **no `role` parameter** — a SAML/client attribute can never elevate
  (D-168-03 holds; the unit test asserts the signature).
- `/org/sso/route` is fully public and boolean-only; the `sbp_` management token
  is decrypted only at call time and never logged or serialized to the client.
- The login form fails **open** to the password field on any route-lookup error.

No BLOCKER/Critical defects were found. The findings below are three robustness /
correctness WARNINGs and six lower-severity items. The most material is the
**non-atomic coupling between the GoTrue provider and the `sso_configs` row**
(WR-01), which can orphan an upstream provider or leave `/org/sso/route`
advertising SSO for a domain that no longer has a live provider.

## Warnings

### WR-01: Non-atomic provider↔row coupling can orphan a GoTrue provider or leave a phantom-active route

**File:** `backend/app/api/org.py:728-748` (create), `857-915` (delete)

**Issue:** `create_sso_provider` creates the GoTrue provider **first**, then
INSERTs the `sso_configs` row on a separate connection with no compensating
rollback:

```python
provider_id = await sso_provider_service.create_provider(body.metadata_url, [email_domain])
# ... no try/except around the INSERT ...
async with get_user_pg_connection(request, current_user) as conn:
    row = await conn.fetchrow("INSERT INTO public.sso_configs ...", active_org, email_domain, provider_id)
```

If that INSERT raises, the already-created GoTrue provider is **orphaned** and
the caller gets an opaque 500. This is reachable:
- The global partial unique index `sso_configs_email_domain_lower_unique`
  (mig 113 §3) raises `UniqueViolationError` whenever the local row set has
  drifted from GoTrue (e.g. after the delete-drift case below), and that error
  is uncaught. The endpoint's own 422 copy ("make sure the domain isn't already
  configured for another provider") implies the author expected the provider-CRUD
  call to be the only dedup gate, but the DB index is a *second*, uncaught gate.
- Any transient DB error (pool timeout / reset) between the two steps orphans the
  provider identically.

The delete path has the inverse hazard: `delete_provider` (GoTrue) runs first,
then the row DELETE. If the row DELETE fails after GoTrue succeeds, GoTrue is
gone but `sso_configs.status` stays `'active'`, so `/org/sso/route` reports
`{"sso": true}` for a domain with **no live provider** — routing users into a
broken SSO flow.

**Fix:** Wrap the `sso_configs` write in a `try/except` that, on failure,
best-effort calls `sso_provider_service.delete_provider(provider_id)` to undo the
GoTrue create, and map a `UniqueViolationError` to a clean 409/422 ("that domain
is already configured"). For delete, treat "GoTrue deleted but row remains" as a
recoverable state (e.g. re-attempt the row delete / mark the row `disabled`) so
the route can never advertise a dead provider:

```python
try:
    async with get_user_pg_connection(request, current_user) as conn:
        row = await conn.fetchrow("INSERT INTO public.sso_configs ...", active_org, email_domain, provider_id)
except asyncpg.UniqueViolationError:
    await _safe_delete_provider(provider_id)  # undo the GoTrue create
    raise HTTPException(status_code=409, detail="That domain is already configured for SSO.")
except Exception:
    await _safe_delete_provider(provider_id)
    raise
```

### WR-02: `metadata_url` is server-fetched by GoTrue with no scheme/host validation (SSRF, self-hosted)

**File:** `backend/app/api/org.py:672-678`, `backend/app/services/sso_provider_service.py:117-147`

**Issue:** The `metadata_url` validator only checks non-emptiness:

```python
@field_validator("metadata_url")
def _validate_metadata_url(cls, v: str) -> str:
    v = (v or "").strip()
    if not v:
        raise ValueError("An identity-provider metadata URL is required.")
    return v
```

The value is passed verbatim into `build_body(...)["metadata_url"]` and handed to
GoTrue, which **fetches the URL server-side** to load the SAML metadata. On a
self-hosted deployment (`supabase_self_hosted=True`) GoTrue runs in the
operator's own network, so an authenticated `sso:manage` holder (org-admin) can
make the operator's GoTrue issue requests to arbitrary internal targets
(`http://169.254.169.254/...`, `http://localhost:.../`, `file://...`) — an
authenticated SSRF primitive. The frontend `type="url"` input is client-side only
and does not constrain the API. The whole phase delegates SAML/metadata handling
to Supabase, so this is a defense-in-depth gap rather than an unauthenticated RCE,
but the trust-boundary validation is absent.

**Fix:** Validate the URL at the boundary before any provider call — require
`https://` scheme, reject credentials-in-URL, and (at least on self-hosted)
reject loopback / link-local / RFC-1918 hosts:

```python
from urllib.parse import urlparse
u = urlparse(v)
if u.scheme != "https" or not u.hostname:
    raise ValueError("The metadata URL must be an https:// URL.")
# optionally: resolve + reject private/loopback ranges on self-hosted
```

### WR-03: A failed SSO-connection removal is silent — unhandled rejection, no error surfaced

**File:** `frontend/src/components/org/OrgAdminShell.tsx:285-294`, `frontend/src/components/org/SsoTab.tsx:273-282`

**Issue:** `handleSsoRemove` uses `try/finally` with **no catch**, so
`deleteSsoProvider` errors (e.g. the documented 502 when the upstream provider
delete fails) propagate out:

```typescript
const handleSsoRemove = useCallback(async (id) => {
  try { await deleteSsoProvider(id) }
  finally { await fetchSsoConfigs() }   // re-throws the original error
}, [fetchSsoConfigs])
```

In `SsoConnectionRow.handleRemove` this rejected promise is again inside a
`try/finally` with no catch, and `handleRemove` is invoked from an un-awaited
`onClick` — so a delete failure becomes an **unhandled promise rejection** and
the user sees the confirm sheet close with the row still present and **no error
message**. The SsoTab header comment claims "remove swallows + re-fetches," but
the code re-throws; documented and actual behavior disagree, and a destructive
action fails silently.

**Fix:** Catch the delete error in `SsoConnectionRow.handleRemove` (or return it
from `handleSsoRemove`) and surface a message, mirroring the create form's
`setError` path:

```typescript
const handleRemove = async () => {
  setRemoving(true)
  try { await onRemove(config.id) }
  catch (err) { setRemoveError(err instanceof Error ? err.message : "Couldn't remove the connection.") }
  finally { setRemoving(false); setConfirming(false) }
}
```

## Info

### IN-01: `updateSsoProvider` is an unused export with a partial-vs-required contract mismatch

**File:** `frontend/src/lib/api.ts:4856-4870`

**Issue:** `updateSsoProvider` is exported but referenced nowhere (SsoTab has no
edit flow — only create + remove). Its signature accepts a partial
`patch: { metadata_url?; email_domain? }`, but the backend `PUT` handler binds
`SsoProviderBody`, which requires **both** `metadata_url` and `email_domain`
(both fields non-optional with validators) — so if this were ever wired with a
partial patch it would 422. The backing `update_sso_provider` endpoint
(`org.py:786-854`) also carries the same non-atomic provider↔row coupling as
WR-01 but is unreachable from the UI today.

**Fix:** Either delete the unused `updateSsoProvider` export + endpoint, or make
the endpoint body optional-per-field and re-run the provider update only when the
relevant field changed. Remove dead code to keep the surface honest.

### IN-02: Public-domain blocklist misses many large free providers (mitigated by operator approval)

**File:** `backend/app/services/sso_domain_blocklist.py:18-41`

**Issue:** The ~30-entry set omits several major global consumer providers —
e.g. `mail.ru`, `web.de`, `gmx.de`, `gmx.at`, `naver.com`, `seznam.cz`,
`laposte.net`, `t-online.de`. An org-admin could register one of these for SSO.
This is largely mitigated by Control 2 (an operator must flip
`pending_approval → active` before any domain routes), so it is defense-in-depth,
not an open hijack — but the module comment ("~25 entries cover >99% of real
cases") understates the miss rate for non-US domains.

**Fix:** Extend the set with the common EU/RU/KR/CN consumer providers, and note
that the operator-approval gate is the load-bearing anti-hijack control, not the
blocklist.

### IN-03: Latent perpetual "Loading…" for an `org:manage`-without-`sso:manage` user (currently unreachable)

**File:** `frontend/src/components/org/OrgAdminShell.tsx:215-232`, `frontend/src/components/org/SsoTab.tsx:106-141`

**Issue:** The SSO fetch is gated `if (activeTab === "sso" && canManageSso)`, but
`ssoConfigs` starts `null` and SsoTab renders the "Loading SSO connections…"
spinner whenever `configs == null`. A user who can open the shell (`org:manage`)
but lacks `sso:manage` would therefore never fetch and would be **stranded on a
permanent loading spinner** — and SsoTab's non-manager empty-state copy ("Your
organization hasn't set up single sign-on yet") would be dead. Today this is
unreachable because the mig-104/113 seed grants `sso:manage` to exactly the roles
that hold `org:manage` (super-admin + org-admin), so `canManage ⟹ canManageSso`.
It becomes a live bug the moment those permissions diverge (a future custom
grant, or revoking org-admin's `sso:manage`).

**Fix:** When `canManageSso` is false, pass `configs={[]}` (or short-circuit
`SsoTab` to its non-manager empty state) so the tab renders the intended
read-only message instead of an eternal spinner.

### IN-04: Login domain extraction picks the wrong segment for multi-`@` input

**File:** `frontend/src/components/auth/SignInForm.tsx:32,84`

**Issue:** `const domain = email.split("@")[1]?.toLowerCase()` returns the second
segment. For an address with a quoted/multiple `@` (`"a@b"@corp.com`), `[1]` is
`b`, not the real domain `corp.com`, so the SSO route lookup runs on the wrong
token. Low-impact (HTML `type="email"` filters most such inputs) but incorrect.

**Fix:** Use the last segment: `const domain = email.split("@").pop()?.toLowerCase()`.

### IN-05: `signInWithSSO` silently no-ops when GoTrue returns no redirect `url`

**File:** `frontend/src/hooks/useAuth.ts:74-78`

**Issue:** `if (data?.url) window.location.href = data.url` — when GoTrue returns
neither an error nor a `url`, the function resolves without redirecting and
without throwing. In `SignInForm.handleContinue` the `sso === true` branch then
completes with no password reveal and no error, dead-ending the "Continue" button
with no feedback. An edge case (GoTrue normally returns a URL), but it degrades to
a confusing no-op rather than the intended password fallback.

**Fix:** Treat a missing `url` as a failure so the caller can fall back:
`if (!data?.url) throw new Error("SSO did not return a redirect URL"); window.location.href = data.url`.

### IN-06: `spMetadataBase` reads a private supabase-js field via an `unknown` cast

**File:** `frontend/src/components/org/SsoTab.tsx:80-84`

**Issue:** `(supabase as unknown as { supabaseUrl?: string }).supabaseUrl` reaches
into a supabase-js internal. If the client renames/removes that field in an
upgrade, the SP-metadata well silently falls back to the baked
`VITE_SUPABASE_URL`, which is wrong on the D-07 no-rebuild overlay path (the very
case the live-read was added for), and the admin would paste stale Entity ID /
ACS URLs into their IdP.

**Fix:** Source the resolved Supabase URL from the app's own runtime-config value
(the same value used to build the client) rather than a private client property.

---

_Reviewed: 2026-07-22T09:32:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
