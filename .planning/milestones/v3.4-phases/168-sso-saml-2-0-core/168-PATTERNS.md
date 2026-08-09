# Phase 168: SSO — SAML 2.0 (CORE) - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 15 (5 new, 10 modified)
**Analogs found:** 15 / 15 (every file has an in-repo analog — this phase is composition, not construction)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/sso_provider_service.py` | service | request-response (HTTP proxy) + transform | `backend/app/services/model_discovery_service.py` (httpx.AsyncClient — the CORRECT async idiom) + `secret_cipher.py` (token decrypt) | role-match |
| `backend/app/api/org.py` (EXTEND: `/org/sso/providers` CRUD, `/org/sso/route`, `/org/sso/provision`) | route/controller | request-response + CRUD | `backend/app/api/org.py` itself (`send_org_invitation`, `accept_org_invitation`) | exact (self) |
| `backend/app/services/invitation_service.py` (REUSE for JIT: add `provision_sso_membership`) | service | CRUD (idempotent membership insert) | `invitation_service.accept_invitation` (lines 100-193) | exact (self) |
| `backend/app/dependencies.py` (EXTEND: `require_sso_manage`) | middleware/guard | request-response (authz gate) | `dependencies.require_org_invite` (lines 745-769) | exact |
| `backend/app/security/secret_cipher.py` (EXTEND: `SECRET_COLUMNS` + mgmt token) | config/security | transform (encrypt-at-rest) | `secret_cipher.SECRET_COLUMNS` (lines 47-52) | exact (self) |
| `backend/app/config.py` (EXTEND: `supabase_project_ref` / self-hosted switch) | config | — | `config.py` `supabase_url` / `supabase_service_role_key` (lines 745-746) | exact (self) |
| `supabase/migrations/113_sso_configs_firming.sql` | migration | — | `104_org_dept_role_schema.sql` (`sso_configs` 150-163, RLS 370-388, `role_permissions` seed 416-426) | role-match |
| `frontend/src/hooks/useAuth.ts` (EXTEND: `signInWithSSO`) | hook | event-driven (auth state) | `useAuth.signIn` / `signUp` (lines 53-61) | exact (self) |
| `frontend/src/components/auth/SignInForm.tsx` (REWORK: identifier-first) | component | request-response (form) | `SignInForm.tsx` itself + `SignUpForm.tsx` | exact (self) |
| `frontend/src/components/org/SsoTab.tsx` (NEW leaf) | component | CRUD (tab surface) | `frontend/src/components/org/InvitationsTab.tsx` / `OrgSettingsTab.tsx` | role-match |
| `frontend/src/components/org/OrgAdminShell.tsx` (FLIP: SSO `LockedTab` → live) | component | event-driven (tab switch) | `OrgAdminShell.tsx` itself (the Phase-167 Invitations `LockedTab`→live flip) | exact (self) |
| `frontend/src/providers/OrgProvider.tsx` (EXTEND: `canManageSso` flag) | provider | event-driven (context) | `OrgProvider` `canManage` / `canAuditView` (lines 48-51, 99-100, 124-126) | exact (self) |
| `frontend/src/hooks/useOrgPermissionsProbe.ts` (EXTEND: `canManageSso`) | hook | request-response (probe) | `useOrgPermissionsProbe` `canManage` (lines 11, 25-31, 100-107) | exact (self) |
| `frontend/src/lib/api.ts` (EXTEND: SSO client fns + `OrgPermissions.can_manage_sso`) | utility | request-response (fetch) | `api.getOrgMembers` (lines 4707-4724) / `getOrgAudit` | exact (self) |
| Tests: `backend/tests/{unit/test_168_sso_provider_service,integration/test_168_sso_{authz,routing,jit}}.py`, `frontend/src/components/auth/*.test.tsx` | test | — | `backend/tests/integration/test_167_jit_race.py` + `test_v3_4_org_isolation.py`; `OrgAdminShell.test.tsx` | role-match |

---

## Pattern Assignments

### `backend/app/services/sso_provider_service.py` (service, request-response HTTP proxy)

**NEW file. Analogs:** `backend/app/services/model_discovery_service.py` (the CORRECT **async** httpx idiom — its docstring notes it was "converted from blocking `requests` to `httpx.AsyncClient`"), `secret_cipher.py` (decrypt the mgmt token at call time), and RESEARCH.md §"Pattern 1: One service, two transport adapters".

**Imports + httpx call pattern** — use `httpx.AsyncClient` inside `async def` functions (NOT the sync `httpx.Client` of `web_search_service.py` — a blocking call inside an async handler violates CLAUDE.md's "no blocking I/O in async handlers" rule; `model_discovery_service.py` is the repo's corrected precedent). `httpx` is already a dep — 4 services use it:
```python
import httpx
# ...
async with httpx.AsyncClient(timeout=10.0) as client:
    response = await client.post(PROVIDER_API_URL, json={...})
    response.raise_for_status()
    data = response.json()
```

**One-service-two-adapters transport switch** — the KEY structural pattern (RESEARCH Pattern 1; honors the Phase-160 no-code-fork contract). Build the request body ONCE, select `(base_url, headers)` by env:
```python
def _transport() -> tuple[str, dict[str, str]]:
    if settings.supabase_self_hosted:                      # self-hosted GoTrue
        key = settings.supabase_service_role_key           # already in config.py:746
        base = f"{settings.supabase_url}/auth/v1/admin/sso/providers"
        return base, {"Authorization": f"Bearer {key}", "apikey": key}   # BOTH headers
    base = f"https://api.supabase.com/v1/projects/{settings.supabase_project_ref}/config/auth/sso/providers"
    return base, {"Authorization": f"Bearer {get_mgmt_token()}"}         # sbp_ token
```
- Request body is IDENTICAL on both surfaces (`type:"saml"`, `metadata_url`, `domains:[...]`, `attribute_mapping:{keys:{...}}`, `name_id_format:"emailAddress"`) — RESEARCH.md lines 138-165.
- **Fail-closed on non-2xx:** any `status_code >= 400` → raise `HTTPException(422, ...)` and DO NOT write `sso_configs` (RESEARCH Code Examples lines 538-552, error table 199-209).
- `provider_id = resp.json()["id"]` is the value written back to `sso_configs.provider_id`.
- **Delete must call the API first** then delete the row (orphan-provider Pitfall 6, RESEARCH 514-517).

**Management-token decrypt-at-call** — mirror `secret_cipher.decrypt_secret` usage (lines 90-97). Decrypt only at call time; NEVER log the token value (log by column name only — secret_cipher discipline, lines 26-27, 150-154).

---

### `backend/app/api/org.py` (route, request-response + CRUD) — EXTEND

**Analog:** this file's own `send_org_invitation` (lines 341-429) and `accept_org_invitation` (lines 589-643). Three new endpoint families.

**(A) `/org/sso/providers` CRUD (create/list/update/delete) — gated on `sso:manage`.** Copy the `send_org_invitation` shape (lines 341-359): `Depends(require_sso_manage)`, server-pin `org_id` to `request.state.active_org` (NEVER client-supplied — line 359 `active_org = deps._to_uuid(request.state.active_org)`), audit with an EXPLICIT `org_id`:
```python
@router.post("/invitations")
async def send_org_invitation(
    request: Request, body: SendInvitationBody,
    current_user: dict = Depends(require_org_invite),          # ← swap to require_sso_manage
    audit_supabase: Client = Depends(get_user_supabase_client),
):
    active_org = deps._to_uuid(request.state.active_org)       # server-pinned, never client
```
- Write `sso_configs` on the CALLER's user-JWT connection (`get_user_pg_connection`) so the mig-104 `sso_configs_insert WITH CHECK (sso:manage AND org_id ∈ current_user_org_ids)` RLS is the real wall — mirror lines 371-391.
- Audit via `write_audit_entry(..., org_id=str(request.state.active_org))` (lines 405-416). NOTE the audit `action_type` landmine: the `audit_log` CHECK admits a fixed set; org.py REUSES `'settings.update'` and puts the real event in `metadata.event` (lines 56-62) — do the same for `sso.*` events.

**(B) `/org/sso/route?domain=x` (login-page routing lookup).** A lighter read — SELECT from `sso_configs WHERE lower(email_domain)=$1 AND status='active'`. Model on the `get_org_members` read shape (lines 192-225) but this one is called PRE-auth by the login page, so it must be callable without `X-Org-Id`/membership (see "No Analog" note — closest is the pattern of a scoped SELECT).

**(C) `/org/sso/provision` (the domain-gated JIT) — the sibling of `accept_org_invitation`.** Copy lines 589-643 EXACTLY, swapping token→provider resolution:
```python
@router.post("/invitations/accept")
async def accept_org_invitation(
    body: AcceptInvitationBody,
    current_user: dict = Depends(get_current_user),           # ← ONLY get_current_user; NO X-Org-Id, NO require_* gate
    audit_supabase: Client = Depends(get_user_supabase_client),
):
    token_hash = invitation_service.hash_token(body.token)
    pool = await deps.get_pg_pool()                           # singleton BYPASSRLS pool — the user isn't a member yet
    result = await invitation_service.accept_invitation(pool, token_hash, current_user["id"])
    # ... audit ONLY on a fresh join (result["claimable"]) with org_id=result["org_id"]
    return {"org_id": result["org_id"], "role": result["role"], "joined": result["joined"]}
```
- SSO variant: resolve `provider_id` from `auth.identities` (service-role read, `provider LIKE 'sso:%'`) → `sso_configs WHERE provider_id=$1 AND status='active'` → `org_id`; if no SSO identity → 200 no-op; if config not active → 403 (RESEARCH JIT endpoint spec, lines 255-269).
- Role is ALWAYS `'member'` — never derived from an attribute (D-168-03).

---

### `backend/app/services/invitation_service.py` (service, CRUD idempotent insert) — REUSE

**Analog:** `accept_invitation` (lines 100-193). Add a `provision_sso_membership(pool, provider_id/org_id, user_id)` that copies the idempotency SKELETON verbatim (do NOT fork the token crypto — that's invite-only):
```python
async with pool.acquire() as conn:
    async with conn.transaction():
        # (b) serialize racing first-logins on this exact (org, user)
        await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", str(org_id) + str(user_id))
        # (d) the hard convergence guarantee — at most one membership per (org, user)
        insert_tag = await conn.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) "
            "VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING",
            org_id, user_id, "member",          # ← role HARDCODED 'member' (D-168-03), never invite["role"]
        )
        joined = _rowcount(insert_tag) == 1
```
- Drop the invite-specific parts: no `token_hash` lookup, no `org_invitations` status flip (lines 118-133, 178-184). Org resolves from the authenticated `provider_id`, not a token.
- Keep `_rowcount` (lines 77-82) and the advisory-lock + `ON CONFLICT DO NOTHING` guarantee (module docstring lines 15-28 explains why).
- Duplicate-email tolerance is AUTOMATIC: the insert keys on `(org_id, new_user_id)`; a same-email password account is a different UUID (RESEARCH Pitfall 3, lines 496-500).

---

### `backend/app/dependencies.py` (guard, authz) — EXTEND: `require_sso_manage`

**Analog:** `require_org_invite` (lines 745-769) — itself "a verbatim mirror of `require_org_manage` with the permission key swapped." Copy it and swap `'org:invite'` → `'sso:manage'`:
```python
async def require_org_invite(
    request: Request,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),                 # STRICT resolver (spoof→403, absent+2org→400)
) -> dict:
    if not await _has_org_permission(request, current_user, active_org, "org:invite"):   # ← "sso:manage"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You do not have permission to invite members.")
    return current_user
```
- `_has_org_permission` runs mig-104's `current_user_has_permission` SECDEF helper AS THE CALLER. The `sso:manage` grant does not exist for org-admin until migration 113 lands (see below) — that grant is what flips this gate live.

---

### `backend/app/security/secret_cipher.py` (config/security) — EXTEND (only if the mgmt token is UI-editable)

**Analog:** the `SECRET_COLUMNS` frozenset itself (lines 47-52). Per RESEARCH Open-Question 3 + line 214, storing the Cloud `sbp_` token in the Phase-150 store requires adding a NEW `app_settings` column AND extending this allowlist:
```python
SECRET_COLUMNS: frozenset[str] = frozenset({
    "openai_api_key", "anthropic_api_key", "google_api_key",
    # ... existing 12 ...
    "tavily_api_key",
    "supabase_management_token",     # ← NEW (if operator-rotatable via Control Room)
})
```
- `main.py` sweeps `SECRET_COLUMNS` generically at boot (main.py:273-287 `sweep_row`), so adding the column here auto-encrypts it at rest — no bespoke crypto.
- **Env-var fallback is the low-effort alternative** (CLAUDE.md "env vars are for secrets and infra only"). Plan-time call: encrypted-column (rotatable) vs env-var (simpler). Self-hosted needs NO new secret — `service_role` is already in `config.py:746`.

---

### `backend/app/config.py` (config) — EXTEND

**Analog:** `supabase_url` / `supabase_service_role_key` (lines 745-746). Add the cloud-adapter needs: `supabase_project_ref` (config, not secret) and a `supabase_self_hosted` bool (the adapter switch). No local self-hosted flag exists today — grep confirms none — so this is a genuinely new (but trivial) settings field alongside the existing pair.

---

### `supabase/migrations/113_sso_configs_firming.sql` (migration)

**Migration head is `112`** (`112_skill_files_storage_org_scope.sql`) — **this phase's slot is `113`** (verified: `ls supabase/migrations/`). Filename digits-only (`113_...`); NO letter suffix (Supabase CLI skips `113b`).

**Analog:** mig 104 — its `role_permissions` seed (lines 416-426) and its `sso_configs` DDL + RLS (lines 150-163, 370-388).

**(1) LOAD-BEARING — the `sso:manage` grant** (RESEARCH 309-320; without it every org-admin write 403s — Pitfall 1). Copy the mig-104 seed idiom (lines 416-426, `ON CONFLICT DO NOTHING`):
```sql
INSERT INTO public.role_permissions (role, permission_key)
VALUES ('org-admin', 'sso:manage')
ON CONFLICT (role, permission_key) DO NOTHING;
```
The mig-104 comment at line 414 explicitly reserved this: "168 MAY later additively INSERT an org-admin → sso:manage grant." The `sso_configs` RLS (lines 375-388) ALREADY gates on `current_user_has_permission(org_id,'sso:manage')`, so this grant alone flips them live.

**(2-4) SHOULD include — approval gate + hygiene** (RESEARCH 322-338), all idempotent (`IF NOT EXISTS`):
```sql
ALTER TABLE public.sso_configs ADD COLUMN IF NOT EXISTS status text NOT NULL
  DEFAULT 'pending_approval'
  CHECK (status = ANY (ARRAY['pending_approval','active','disabled']));
CREATE UNIQUE INDEX IF NOT EXISTS sso_configs_email_domain_lower_unique
  ON public.sso_configs (lower(email_domain)) WHERE email_domain IS NOT NULL;
ALTER TABLE public.sso_configs ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.sso_configs ADD COLUMN IF NOT EXISTS approved_at timestamptz;
```
- `provider_id` STAYS `text` (holds the GoTrue UUID string) — NO type change, NO FK into `auth` (D-07 preserved, mig-104 comment line 163).
- **Apply discipline (CLAUDE.md):** paste into the LOCAL Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated `full-schema.sql` together. Cloud parity: 113 joins the pending 099→112 set for the next operator-gated push.
- **Deploy-artifact parity (Phase-158 D-16):** if the `sbp_` token becomes an env var the app reads, update `deploy/onebox.env.example` + `docs/OPERATOR.md` + `docker-compose.prod.yml` in the SAME commit (or register in `OMITTED_FROM_ONEBOX`).

---

### `frontend/src/hooks/useAuth.ts` (hook, event-driven) — EXTEND: `signInWithSSO`

**Analog:** this hook's own `signIn` / `signUp` (lines 53-61). Add a sibling that calls the built-in `supabase-js` method (NO new dep) and redirects manually:
```ts
const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}
// NEW sibling:
const signInWithSSO = async (domain: string) => {
  const { data, error } = await supabase.auth.signInWithSSO({ domain })
  if (error) throw error
  if (data?.url) window.location.href = data.url   // MUST redirect manually — it does not auto-navigate
}
```
- The existing `onAuthStateChange` (lines 37-40) already picks up `SIGNED_IN` after the callback — the JIT-provision call fires off that event (RESEARCH lines 227-230, 274).
- Keep `signInWithPassword` UNTOUCHED — password fallback is RETAINED (SC#3).

---

### `frontend/src/components/auth/SignInForm.tsx` (component, form) — REWORK: identifier-first

**Analog:** `SignInForm.tsx` itself (lines 1-68) + `SignUpForm.tsx` (the success-state two-render pattern, lines 32-43). The two-phase reveal mirrors SignUpForm's conditional render. RESEARCH Code Examples lines 522-535:
```ts
async function onEmailSubmit(email: string) {
  const domain = email.split("@")[1]?.toLowerCase()
  const { sso } = await api.getSsoRoute(domain)           // GET /org/sso/route
  if (sso) {
    await signInWithSSO(domain)                            // redirect to IdP
  } else {
    revealPasswordField()                                 // RETAINED password fallback (D-168-02)
  }
}
```
- Keep the existing `email`/`password`/`error`/`loading` state + `handleSubmit` try/catch/finally shape (lines 12-28). Add a `phase` (`"email"` | `"password"`) state to drive the reveal.
- Keep a small secondary "Sign in with SSO" escape-hatch link (`{ providerId }` fallback path, D-168-02).
- Uses the same shadcn `Button`/`Input`/`Label` imports (lines 2-4).

---

### `frontend/src/components/org/SsoTab.tsx` (component, CRUD tab leaf) — NEW

**Analog:** `frontend/src/components/org/InvitationsTab.tsx` (a live tab leaf that owns a list + create/mutation callbacks) and `OrgSettingsTab.tsx` (the simpler config-home leaf). Follow the "SHELL = OWNER OF FETCH, TABS = PURE LEAVES" split documented in `OrgAdminShell.tsx` lines 10-15: the shell owns the fetch + mutations, the tab is a pure leaf receiving rows + callbacks as props.
- SSO tab renders: metadata-URL input, connection status chip (`pending_approval`/`active`/`disabled`), the STATIC SP-metadata display for the admin to paste into their IdP (`{SUPABASE_URL}/auth/v1/sso/saml/metadata` + `/acs` — RESEARCH lines 187-197; read from config, NO API call), and a test-connection affordance (Claude's Discretion, CONTEXT line 54).
- Design system: reuse the Phase-166 indigo shell tokens (`OrgAdminShell.tsx` lines 3-8) — NOT the operator warning tint.

---

### `frontend/src/components/org/OrgAdminShell.tsx` (component) — FLIP: SSO `LockedTab` → live `<SsoTab/>`

**Analog:** this file's OWN Phase-167 flip of the Invitations tab (lines 83-85, 336-346). Repeat that exact move for SSO.

**The TABS entry to flip** (lines 86-91) — remove `locked: true` + `lockedDescription`:
```ts
{ id: "sso", label: "SSO", locked: true,
  lockedDescription: "Single sign-on setup is coming soon." },   // → { id: "sso", label: "SSO", locked: false }
```
**The body-switch branch to add** (mirror the Invitations branch, lines 336-346) — render `<SsoTab/>` when `activeTab === "sso"`, render-gated on the new `canManageSso` flag:
```tsx
) : activeTab === "invitations" ? (
  <InvitationsTab invitations={invitations} canInvite={canManage} .../>
) : /* ADD: */ activeTab === "sso" ? (
  <SsoTab ... canManageSso={canManageSso} />
) : (
  <LockedTab title={active.label} description={active.lockedDescription} />
)
```
- The shell already owns the lazy per-tab fetch effect (lines 198-203) — add `if (activeTab === "sso") void fetchSsoConfigs()` there, guarded by `canManageSso`.
- Pull `canManageSso` from `useOrg()` (line 114 destructures `canManage` today).

---

### `frontend/src/providers/OrgProvider.tsx` (provider, context) — EXTEND: `canManageSso`

**Analog:** the `canManage` / `canAuditView` flags — an EXACT template repeated 3x already. Add `canManageSso` in lockstep at every site:
- Interface (lines 48-51): add `canManageSso: boolean`.
- Probe destructure (lines 99-100): pull `canManageSso` from `useOrgPermissionsProbe`.
- `useMemo` value + deps (lines 124-126): add `canManageSso`.
- The SECURITY NOTE (lines 20-23) applies verbatim — this flag is RENDER-ONLY; `require_sso_manage` is the wall.

---

### `frontend/src/hooks/useOrgPermissionsProbe.ts` (hook, probe) — EXTEND: `canManageSso`

**Analog:** the `canManage` field — repeat at every site: interface (line 11), the `CLOSED` fail-closed default (lines 25-31, add `can_manage_sso: false`), and the return map (lines 100-107, add `canManageSso: perms.can_manage_sso`). Fail-closed polarity is load-bearing (lines 22-31): a probe blip must NEVER flash the SSO tab to a non-manager.

---

### `frontend/src/lib/api.ts` (utility, fetch) — EXTEND

**Analog:** `getOrgMembers` (lines 4707-4724) / `getOrgAudit` (lines 4740-4759). Add SSO client fns in the same shape: `getAuthHeaders()` (auto-injects `X-Org-Id`, lines 115), `ApiError` on non-OK, defensive `?? fallback` envelope unwrap:
```ts
export async function getOrgMembers(page = 1, pageSize = 50): Promise<OrgMembersPage> {
  const headers = await getAuthHeaders()          // auto-injects X-Org-Id (D-166-06)
  const res = await fetch(`${API_BASE}/org/members?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org members.", res.status)
  const body = (await res.json()) as Partial<OrgMembersPage>
  return { members: body.members ?? [], /* ... defensive unwrap ... */ }
}
```
- New fns: `getSsoRoute(domain)` (NOTE: called from the login page PRE-auth — may not have `X-Org-Id`; see "No Analog"), `listSsoConfigs`, `createSsoProvider`, `updateSsoProvider`, `deleteSsoProvider`, `provisionSso()`.
- Extend the `OrgPermissions` type (feeds `useOrgPermissionsProbe`) with `can_manage_sso: boolean`.

---

### Tests — `test_168_sso_*` (backend) + `auth/*.test.tsx` (frontend)

**Analogs:** `backend/tests/integration/test_167_jit_race.py` (the idempotent-membership + concurrent-converge + duplicate-email harness for the JIT), `test_v3_4_org_isolation.py` (the two-org RLS/authz fixture for `sso:manage` grant + cross-org denial), and `frontend/src/components/org/OrgAdminShell.test.tsx` (vitest + Testing Library tab/render-gate pattern for the identifier-first form).
- `test_168_sso_provider_service.py` (unit) — MOCK the httpx client; assert body shape + adapter selection + `provider_id` write-back + fail-closed on 4xx.
- `test_168_sso_jit.py` (integration) — model on `test_167_jit_race.py`: N concurrent provisions → exactly one row; second call `joined=False`; role always `member`; duplicate-email → two independent memberships (two UUIDs).
- Mock ALL network deps (memory `mock-completeness`): the provider-CRUD HTTP call + the SSO identity read.

---

## Shared Patterns

### Org-scoped write authorization (`sso:manage`)
**Source:** `backend/app/dependencies.py:745-769` (`require_org_invite`) + mig-104 RLS `sso_configs_insert/update/delete` (`104_org_dept_role_schema.sql:375-388`).
**Apply to:** every `/org/sso/providers` write endpoint in `org.py`.
Two walls, both required: the app-code `require_sso_manage` gate AND the mig-104 RLS `WITH CHECK (current_user_has_permission(org_id,'sso:manage') AND org_id ∈ current_user_org_ids())`. The RLS is the real boundary — write on the user-JWT connection (`get_user_pg_connection`), never the service-role pool, for the CRUD writes.

### Idempotent membership insert (advisory-lock + ON CONFLICT)
**Source:** `backend/app/services/invitation_service.py:139-176`.
**Apply to:** the `/org/sso/provision` JIT.
```python
await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", str(org_id) + str(user_id))
insert_tag = await conn.execute(
    "INSERT INTO public.org_members (org_id, user_id, role) "
    "VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING",
    org_id, user_id, "member")
```
Runs on the singleton BYPASSRLS pool (`deps.get_pg_pool()`, org.py:612) because the SSO user is not yet a member — the user-JWT RLS insert would be denied.

### Encrypted secret at rest (Phase-150 MultiFernet)
**Source:** `backend/app/security/secret_cipher.py` (`encrypt_secret`/`decrypt_secret` lines 84-97; `SECRET_COLUMNS` lines 47-52; `sweep_row` auto-encrypts at boot via `main.py:273-287`).
**Apply to:** the Cloud `sbp_` management token (if operator-rotatable). Decrypt ONLY at call time in `sso_provider_service`; log by column NAME only (never the value/token — lines 26-27).

### Render-only permission flag (fail-closed)
**Source:** `OrgProvider.tsx:20-23` (SECURITY NOTE), `useOrgPermissionsProbe.ts:22-31` (`CLOSED` default).
**Apply to:** `canManageSso` across `OrgProvider` / `useOrgPermissionsProbe` / `OrgAdminShell` / `SsoTab`. The flag decides RENDERING ONLY; `require_sso_manage` + RLS are the authority. A blip/forged flag reaches no data.

### Server-pinned org_id + explicit audit
**Source:** `org.py:359` (`active_org = deps._to_uuid(request.state.active_org)`) + `write_audit_entry(..., org_id=str(request.state.active_org))` (lines 405-416); the `action_type` landmine (lines 56-62 — reuse `'settings.update'`, real event in `metadata.event`).
**Apply to:** all SSO CRUD writes. `org_id` is NEVER client-supplied.

---

## No Analog Found

| File / seam | Role | Data Flow | Reason — planner should use RESEARCH.md instead |
|-------------|------|-----------|--------------------------------------------------|
| `GET /org/sso/route` (pre-auth domain lookup) in `org.py` | route | request-response | Every existing `/org/*` route sits behind `get_active_org_id` (a member gate). This route is hit by the LOGIN page before a session/`X-Org-Id` exists, so it needs a public-ish, un-gated read of `sso_configs` (filtered to `status='active'`, returning only a boolean "sso: true/false" — never provider internals). No in-repo pre-auth org read exists. RESEARCH §"Domain → provider routing" (line 24) + System Architecture (lines 376-381). Plan-time: decide the anti-enumeration shape (return only a boolean; consider rate-limiting). |
| `sso_provider_service._transport()` env switch (self-hosted vs cloud) | service | transform | `config.py` has NO self-hosted/`project_ref` flag today (grep-confirmed). The two-adapter switch (RESEARCH Pattern 1, lines 421-440) is a genuinely new shape — `secret_cipher`'s env-switch is the closest idiom but not a 1:1 analog. |
| SSO identity read `auth.identities WHERE provider LIKE 'sso:%'` | service | query | No existing code reads `auth.identities` for the SSO provider string. RESEARCH flags the exact format (`sso:<uuid>`) as UNVERIFIED (A2, lines 249, 581) — confirm on the ONE live round-trip before locking the parser. |

---

## Metadata

**Analog search scope:** `backend/app/{api,services,security}/`, `backend/app/config.py`, `backend/app/dependencies.py`, `frontend/src/{hooks,components/auth,components/org,providers,lib}/`, `supabase/migrations/`.
**Files scanned:** ~20 (10 read in full for excerpts; grep-confirmed httpx usage across 4 services, secret-cipher usage across 4 modules, migration head = 112).
**Migration slot confirmed:** next = **113** (head `112_skill_files_storage_org_scope.sql`).
**Key upstream landmine confirmed live:** mig 104 grants `sso:manage` to `super-admin` ONLY (line 421); org-admin is absent (line 422-425) — the migration-113 grant is LOAD-BEARING, not optional.
**Pattern extraction date:** 2026-07-22
