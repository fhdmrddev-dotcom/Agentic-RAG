# Phase 167: Invitations + Roles + Greenlists + JIT + Per-User Prefs - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 16 (7 modified, 9 net-new) across backend + frontend
**Analogs found:** 13 strong / 16 — 3 net-new seams are research/no-direct-analog (VIS-02 per-user read-write, `token_hash`, INV-02 JIT seam)

> **Read-first for the planner.** This phase is EXTENSION + resolver-generalization, not greenfield. Almost every "new" file has a shipped 166/148/150 twin to copy. The three exceptions are called out in **No Analog Found** and each carries a concrete "build it like X" instruction. Two HARD rules from CONTEXT the planner must not violate:
> 1. **`require_visible` is EXTENDED, never forked** (D-167-06) — it is the ONE swappable audience boundary. The binary `everyone|operators` becomes `everyone|operators|role`; the resolver `feature_audience()` grows the role/greenlist branch in place.
> 2. **The JIT seam (INV-02) is research-pending** (D-167-05) — trigger (`handle_new_user`) vs app-layer signup/callback handler vs both. This is the ONE place a migration MIGHT appear; otherwise this phase ships ZERO migrations.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/org.py` (MODIFY — invitation CRUD) | controller/router | CRUD + request-response | itself (`/org/members`, `/org/audit`) + `admin.py` writes | exact |
| `backend/app/dependencies.py` (MODIFY — `require_org_invite`) | middleware/dependency | request-response | `require_org_manage` (self:646-663) | exact |
| `backend/app/services/invitation_service.py` (NEW — token hash + CRUD helpers) | service/security-utility | transform + CRUD | `setup_store.py` (token_urlsafe+hmac) + `audit_service.py` | role-match |
| `backend/app/models/user_settings.py` (MODIFY — greenlist audience) | service/resolver | transform | `feature_audience`/`set_feature_visibility` (self:997-1038) | exact |
| `backend/app/dependencies.py` (MODIFY — `require_visible` role branch) | middleware | request-response | `require_visible` (self:450-476) | exact |
| `backend/app/api/features.py` (MODIFY — role greenlist in map) | controller | read | itself (`get_effective_features`) | exact |
| VIS-02 per-user prefs endpoint (`settings.py` add OR new `me_preferences.py`) | controller + service | CRUD (read-write) | `update_settings` + `set_feature_visibility` JSONB-merge | **no direct analog** |
| INV-02 JIT provisioning (signup/callback handler OR mig trigger) | service/handler OR migration | event-driven | `handle_new_user` (mig 105:83-114) | **research-pending** |
| `frontend/src/components/org/InvitationsTab.tsx` (NEW) | component (pure leaf) | CRUD + request-response | `OrgMembersTab.tsx` | exact |
| `frontend/src/components/org/InviteMemberDialog.tsx` (NEW — invite modal) | component/dialog | request-response | `CreateLinkDialog.tsx` | exact |
| `frontend/src/components/org/OrgAdminShell.tsx` (MODIFY — locked→live) | component/shell | orchestration | itself (body switch:269-287, `TABS`:73-101) | exact |
| `frontend/src/components/org/OrgMembersTab.tsx` (MODIFY — adoption chips) | component | read/render | itself (`roleBadge`:44-48, chip markup:146-158) | exact |
| `frontend/src/components/settings/ModelDefaultPreference.tsx` (NEW — VIS-02 UI) | component/picker | request-response | `JudgeModelPicker.tsx` + `ProviderPicker.tsx` (🔒 footer) | exact |
| `frontend/src/lib/api.ts` (MODIFY — invite + pref fns) | client/utility | request-response | `getOrgMembers`/`getOrgAudit` (self:4576-4625) | exact |
| `frontend/src/pages/AcceptInvitePage.tsx` (NEW — accept landing) | page | request-response | `AuthPage.tsx` + `App.tsx` `/setup` window.location route | role-match |
| Greenlist admin surface (NEW minimal — role/group audience editor) | component | request-response | feature-visibility toggle in `ControlRoomPage.tsx` (partial) | partial |

---

## Pattern Assignments

### `backend/app/api/org.py` (controller/router — invitation CRUD, gated on `org:invite`)

**Analog:** itself — the shipped `/org/members` + `/org/audit` endpoints (this is a MODIFY, add new routes to the same router). The `org_invitations` table is COMPLETE (mig 104:136-147); its RLS write policy already exists and keys on `org:invite` (mig 104:356-368). Invitation CRUD is pure app-code over it.

**Router + gate wiring** — every new invitation route inherits the router-level active-org context and adds the `org:invite` gate. The router is already declared (`org.py:49-52`, `prefix="/org"`). Copy the endpoint shape from `get_org_members` (`org.py:142-190`):

```python
@router.get("/invitations")
async def list_org_invitations(
    request: Request,
    _invite: dict = Depends(require_org_invite),   # NEW gate — see dependencies.py below
):
    active_org = deps._to_uuid(request.state.active_org)
    # read via get_user_pg_connection so the mig-104 org_invitations_select RLS applies,
    # OR service-role scoped to active_org (list_users_roster precedent). token_hash NEVER
    # selected/returned (T-161-04) — SELECT id,email,role,status,expires_at,invited_by,created_at.
```

**Write path — RLS-enforced create** (send invite). Writes MUST run on the caller's user-JWT connection so the mig-104 `org_invitations_insert` `WITH CHECK (current_user_has_permission(org_id,'org:invite'))` policy is the real wall (mirror `_has_org_permission`'s `get_user_pg_connection` usage, dependencies.py:516-521):

```python
async with get_user_pg_connection(request, current_user) as conn:
    await conn.execute(
        "INSERT INTO public.org_invitations (org_id, email, role, token_hash, status, expires_at, invited_by) "
        "VALUES ($1,$2,$3,$4,'pending',$5, auth.uid())",
        active_org_uuid, email, role, token_hash, expires_at,   # $1..$5 binds — never f-string
    )
```

**Refusal polarity** (org.py inherits this): a permission failure is **403**, a legitimate product feature — NOT the `/admin` byte-identical 404 (mirrors `require_visible:472-474` and the org.py docstring rationale at line 98).

**Blocking-call rule:** any supabase-py `.execute()` (if you use the service-role client for the roster join like `/org/audit` does) MUST be wrapped in `run_in_threadpool` — see `get_org_audit` (org.py:224, 236) and the D-v2.5-01 rule. asyncpg reads/writes are already async (no wrap).

**Adoption-state join** (feeds the Members roster chips): adoption state = `org_invitations.status` LEFT-JOINed against `org_members` presence — **not-yet-invited** (no invite row), **pending** (`status='pending'`), **active** (`org_members` row exists). Compute server-side and return on `/org/members` (extend the existing roster query, org.py:165-175) OR on `/org/invitations`.

---

### `backend/app/dependencies.py` (middleware — `require_org_invite` gate)

**Analog:** `require_org_manage` (self:646-663) — copy it verbatim, swap the permission key `'org:manage'` → `'org:invite'`. This is the exact one-line-different sibling.

```python
async def require_org_invite(
    request: Request,
    current_user: dict = Depends(get_current_user),
    active_org: str = Depends(get_active_org_id),   # strict gate: spoof→403, absent+2org→400
) -> dict:
    """org:invite gate for the invitation write/list routes (mirrors require_org_manage)."""
    if not await _has_org_permission(request, current_user, active_org, "org:invite"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You do not have permission to invite members.")
    return current_user
```

`_has_org_permission` (self:504-522) runs mig-104's `current_user_has_permission($1,$2)` SECDEF helper **AS THE CALLER** on a user-JWT connection (never the BYPASSRLS pool — T-166-04). `org-admin` and `super-admin` hold `org:invite` per the seed (mig 104:420, 424); `member` does not.

---

### `backend/app/services/invitation_service.py` (security-utility — token generation + hashing)

**Analog:** `backend/app/services/setup_store.py` — the ONLY existing one-way-token pattern. **Do NOT use `secret_cipher.py`** (that is reversible Fernet encryption — wrong for `token_hash`, which must be a one-way digest so the raw token never lives in the DB, T-161-04).

**Token generation** (setup_store.py:136 — the raw token goes in the link ONLY):
```python
import secrets
raw_token = secrets.token_urlsafe(32)   # the link carries this; NEVER stored
```

**Hashing** — the stored `token_hash`. Two shipped idioms to choose from:
- Deterministic sha256 (skill_embedding_service.py:138): `hashlib.sha256(raw_token.encode()).hexdigest()` — simplest, matches the "fingerprint" use.
- Constant-time verify on accept (setup_store.py:158-163): `hmac.compare_digest(candidate_hash, stored_hash)` — defeats a timing side-channel on the accept lookup (T-158-08 precedent).

**Accept-path invariants** (from CONTEXT specifics + D-167-08): hash the incoming raw token, look it up, enforce `expires_at` (single-use) and flip `status`→`accepted` (single-use), then thread into the JIT membership create. The accept flow is the invited-vs-fresh fork (see JIT seam below).

**Audit the write:** invitation send/revoke/accept should record to `audit_log` via `write_audit_entry` (audit_service.py:57-74) — BUT that helper does NOT set `org_id` today (it inserts only `user_id/action_type/metadata`). The org audit read filters `.eq("org_id", active_org)` (org.py:74), so invitation audit rows MUST carry `org_id` to be visible on the org Audit tab — extend the insert dict with `org_id` (a 1-line addition) or pass it through metadata + the column.

---

### `backend/app/models/user_settings.py` + `backend/app/dependencies.py` (VIS-01 greenlist — EXTEND, do NOT fork)

**Analog:** the shipped VIS-01 resolver trio, extended in place (D-167-06, zero migration — the `feature_visibility` JSONB was shaped for exactly this at mig 098:6-7).

**1. Audience resolver** — `feature_audience()` (user_settings.py:997-1015). Today returns `'everyone'|'operators'`. Extend the recognized-enum branch to also accept `'role'` and surface the `roles:[...]` list (and group grants). Keep the fail-closed fallback to `_GOVERNED_FEATURES` (:989-994, unknown → safe-deny `'operators'`) and the no-raise posture:
```python
aud = rec.get("audience") if isinstance(rec, dict) else None
if aud in ("everyone", "operators", "role"):   # + "role" (was binary)
    return aud
# NEW: when aud == "role", the caller also reads rec.get("roles", []) for the greenlist
```

**2. Gate** — `require_visible(feature)` (dependencies.py:450-476). It is a dependency FACTORY and the **ONE swappable boundary** (its own docstring names SEED-115: "later flips it to 'is in group X' with zero change here" — THIS is that phase). Extend the closure's decision from `is_operator OR audience=='everyone'` to also allow when the caller holds one of the feature's greenlisted roles. The `is_operator(current_user["id"])` no-op stays first (operators always pass). Apply the **Glean precedence-merge** (D-167-06): highest role wins for the primary tier, union for secondary grants.

**3. JSONB writer** — `set_feature_visibility(feature, audience)` (user_settings.py:1018-1038). The atomic `||`-merge writer (avoids the lost-update a whole-column `SET` causes — Pitfall 4). Extend its serialized record from `{feature: {"audience": audience}}` to also persist `{"audience":"role","roles":[...]}`. The `$1::jsonb` bind + JSONB codec stays SQLi-safe; the caller validates feature/role against code allowlists BEFORE calling.

**4. Effective-features map** — `features.py::get_effective_features` (:34-48). Extend the per-feature bool derivation from `(op or audience=='everyone')` to also resolve the caller's role-greenlist membership so the UI-hide and the API-refusal can never disagree (the file's own contract, features.py:14-15).

---

### VIS-02 per-user preferences (model default) — backend read/write

**Analog:** the JSONB-`||`-merge writer `set_feature_visibility` (user_settings.py:1018-1038) is the SHAPE to copy — but scoped **per-user** to `user_settings.preferences` instead of the global `app_settings`. See **No Analog Found** — there is no existing per-user settings read/write; `user_settings.preferences` has been dead since mig 011:27-28.

**Two-layer composition (SEED-116 / D-167-04):** operator/org governs the allowed-set + lock (the existing `app_settings` provider/model surface, `_build_providers` at user_settings.py:528-620 + `_resolve_llm`:623-644); the user picks a default WITHIN that set. The effective chat model resolves as: user-preference (if set AND still in allowed-set AND not operator-locked) → else the operator default `llm_model`. The model default must route correctly cross-provider (D-167-09 / SC#10).

**Write connection:** per-user `preferences` is RLS-scoped, so the write MUST use `get_user_pg_connection` (dependencies.py:158) with a JSONB `||` merge keyed on `auth.uid()` — NOT the service-role pool (unlike the global settings writers, which the user_settings.py header at :8-18 explicitly documents stay service-role BECAUSE they have no per-user scope). This is the inverse case.

**Endpoint shape:** copy the map-fields-to-`updates`-dict flow from `settings.py::update_settings` (:335-440), but write ONE JSONB key (the CONTEXT leaves the exact `preferences` key name to Claude's discretion, D-167-04).

---

### INV-02 JIT provisioning — RESEARCH-PENDING seam (D-167-05)

**Analog:** `handle_new_user` trigger (mig 105:83-114) — the CURRENT signup path that auto-creates a personal org. INV-02 must fork it:
- **Fresh signup** → keep the mig-105 default (auto-create personal org).
- **Invited signup/accept** → join THAT org idempotently INSTEAD of (or in addition to — D-167-01 keeps both) auto-creating a personal org.

The idempotency primitive already exists in mig 105: `INSERT INTO org_members ... ON CONFLICT (org_id, user_id) DO NOTHING` (:104-106), wrapped in the SECDEF + pinned-search_path + swallow-on-failure envelope (:86-88, 100-110). D-167-05 adds a Postgres **advisory lock** so concurrent first-logins converge to exactly one membership.

**The research decision (do NOT pre-decide):** whether this lives in (a) an extension of the `handle_new_user` DB trigger [the ONE possible migration this phase], (b) the app-layer signup/SSO-callback handler, or (c) both. If a trigger change is chosen, it is re-paste-safe and MUST keep SECURITY DEFINER + `SET search_path TO 'public'` (T-162-06 — never drop either) and the swallow-on-failure so it can never abort the `auth.users` INSERT (D-03/T-162-05).

---

### `frontend/src/components/org/InvitationsTab.tsx` (NEW — pure presentational leaf)

**Analog:** `OrgMembersTab.tsx` (whole file, 161 lines) — the shipped read-only roster leaf. Copy its posture EXACTLY:
- **Pure props-in/DOM-out** (OrgMembersTab.tsx:14-15): the shell (OrgAdminShell) owns the fetch + state; this leaf renders and reports intent via callbacks.
- Section wrapper + header + client-side search over the loaded page (OrgMembersTab.tsx:59-79).
- `members == null` loading placeholder + empty state (OrgMembersTab.tsx:89-106).
- Row = identity block + status/role chip (OrgMembersTab.tsx:121-160).

New responsibilities vs the roster: a "Send invite" affordance (opens the InviteMemberDialog), a pending/accepted/expired/revoked invitation list, and resend/revoke row actions (Claude's discretion on affordance shape, D-167 discretion). The org-indigo `primary` token is the accent — the operator amber tint is reserved (OrgMembersTab uses `text-primary`/`bg-primary/10`, never amber).

---

### `frontend/src/components/org/InviteMemberDialog.tsx` (NEW — the invite modal)

**Analog:** `CreateLinkDialog.tsx` (whole file, 317 lines) — the shipped shadcn Dialog with a role-picker + confirm. Copy its SHELL exactly:
- Dialog primitive imports (CreateLinkDialog.tsx:26-33): `Dialog / DialogContent / DialogHeader / DialogTitle / DialogFooter` from `@/components/ui/dialog` + `Button`. **No new package** (166 Plan 05 established: `@radix-ui/react-popover` is NOT installed; use the shipped shadcn dialog/dropdown).
- **Reset-on-open** effect (CreateLinkDialog.tsx:71-82): clear form state + errors when `open` flips true.
- **Segmented chips** for the role picker (CreateLinkDialog.tsx:180-203) — reuse this for **Member (default) / Org-admin**, with **Dept-admin greyed/disabled** until Phase 169 (D-167-03).
- **Confirm handler** with 422-vs-transient error discrimination (CreateLinkDialog.tsx:134-157) + loading state on the footer button (:303-310).
- `onCreated` callback → parent re-fetches (CreateLinkDialog.tsx:50-51, the re-fetch-not-optimistic rule).

The delivery is link-first (D-167-02): on success, surface/copy the generated invite link (raw token in the URL) — no email service required by default.

---

### `frontend/src/components/org/OrgAdminShell.tsx` (MODIFY — flip locked tab → live)

**Analog:** itself — the LockedTab→live pattern is a 2-edit change in the shipped shell:
1. **`TABS` array** (OrgAdminShell.tsx:73-101): flip the `invitations` entry from `locked: true` (:77-82) to `locked: false` (like `members`/`audit`/`settings` at :74-76). Drop its `lockedDescription`.
2. **Body switch** (OrgAdminShell.tsx:265-287): add an `activeTab === "invitations"` branch BEFORE the final `<LockedTab/>` fallthrough (:285-286), mounting `<InvitationsTab .../>`. Mirror the lazy-fetch wiring the shell already does for Members/Audit (`fetchMembers`/`fetchAudit` at :138-160, the `alive.current` guard at :134, the honest-degrade `.catch` at :142-143, and the per-tab fetch effect at :174-178).

The shell already carries the `canManage` client guard (:202-220) and the shell-owns-fetch split — the invitations fetch slots into the existing machinery. NOTE: the shell currently has "no recordingPulse" because it was read-only (166 Plan 04 decision); invitations ADD writes, so the planner may wire `OrgBand.recordingPulse` on a successful invite (OrgBand accepts it optional).

---

### `frontend/src/components/org/OrgMembersTab.tsx` (MODIFY — adoption-state chips)

**Analog:** itself — the `roleBadge` helper + chip markup is the exact vocabulary to extend:
- `roleBadge(role)` (OrgMembersTab.tsx:44-48) returns `{label, admin}`; add an adoption-state variant `{not-yet-invited | pending | active}` mapped from `org_invitations.status` + `org_members` presence (CONTEXT specifics).
- Chip markup (OrgMembersTab.tsx:146-158): the admin chip (`◆` + indigo `border-primary/30 bg-primary/10 text-primary`) vs the muted chip (`border-border bg-muted/40 text-muted-foreground`). Reuse these two shapes for the adoption states (Claude's discretion on chip copy/colors, D-167 discretion — reuse this 166 vocabulary).
- The read-only banner (OrgMembersTab.tsx:81-87) that points at the "Invitations & Roles tab" becomes stale once invites are live — update/remove it, and add the invite affordances the banner promised.

---

### `frontend/src/components/settings/ModelDefaultPreference.tsx` (NEW — VIS-02 UI)

**Analog:** `JudgeModelPicker.tsx` (whole file, 119 lines) — the 024-A picker idiom, near-1:1:
- **Registry-only `<select>`** (JudgeModelPicker.tsx:89-104) — the user picks WITHIN the operator/org allowed-set (VIS-02's two-layer). Dedupe+sort options (:73), keep an unknown persisted value selectable as "(current)" so a round-trip never drops it (:74, 97-98).
- **Save-on-select** (JudgeModelPicker.tsx:54-69): `onChange` → persist → re-read from the server so the knob stays server-derived, never a separate optimistic store.
- **Load effect** with `cancelled` guard (JudgeModelPicker.tsx:37-52).
- **ALWAYS-ON 🔒 footer** (JudgeModelPicker.tsx:108-114) — shows the EFFECTIVE model, never blank. For VIS-02 this footer is where the **operator lock** surfaces: when locked, the select is disabled and the footer names the governed default (SEED-116). See also `ProviderPicker.tsx:202-210` for the same always-on 🔒 footer with a local/cloud tint.

---

### `frontend/src/lib/api.ts` (MODIFY — invitation + preference client fns)

**Analog:** `getOrgMembers` / `getOrgAudit` + their types (self:4484-4625) — the exact org-client shape:
- Typed `export interface` for each payload (OrgMember/OrgMembersPage at :4506-4520 shape).
- `getAuthHeaders()` (self:108-116) auto-injects `X-Org-Id` — every new invitation/pref fn gets the active-org header for free (D-166-06, zero call-site churn).
- `ApiError` on non-OK (self:4583) + **defensive envelope unwrap** with `?? fallback` (self:4585-4590).
- Write fns (send/resend/revoke/accept, set-preference) follow the same `fetch` + `headers` + `res.ok` guard; POST/PUT bodies serialized as JSON.

---

### `frontend/src/pages/AcceptInvitePage.tsx` (NEW — the accept-invite landing)

**Analog:** `AuthPage.tsx` (whole file, 45 lines) for the shell + `App.tsx` for the routing:
- **Card shell** (AuthPage.tsx:15-43): the centered `Card`/`CardHeader`/`CardContent` with the gradient orbs + brand mark — reuse verbatim for the "You've been invited to {org}" framing.
- **SignIn/SignUp toggle** (AuthPage.tsx:12-13, 36-40): the accept flow reuses the SAME `SignInForm`/`SignUpForm` — an invitee accepts by signing in (existing account → additive 2nd org, D-167-01) or signing up (fresh → joins THAT org via the JIT fork).
- **Routing without a router** (App.tsx:198-209): the app has NO url router — it uses `window.location.pathname === "/setup"` checks (:200). Mirror this for the invite landing (`/invite` path or an `?invite_token=` query read via `URLSearchParams`). The raw token from the link is captured here and threaded into the accept API call.

An accepted invitee lands as a 2-org user — the shipped 166 `OrgProvider` + org switcher (renders at 2+ orgs, ProfileMenu.tsx switcher section) already handles this; no new switcher work (D-167-01, 166 Plan 05 "Next Phase Readiness").

---

### Greenlist admin surface (NEW — minimal role/group audience editor)

**Analog (partial):** the feature-visibility toggle already lives in the operator `ControlRoomPage.tsx` surface (the read side is `features.py`; the write is `set_feature_visibility`). This phase ships the RESOLVER + a MINIMAL admin surface only — rich group-management UI is explicitly deferred (CONTEXT deferred: "Full group management UI ... is later"). Copy whatever audience-toggle control the Control Room already renders for the binary map and extend it to select role greenlists. **This is the weakest analog** — if the existing surface is thin, lean on RESEARCH.md for the greenlist admin shape.

---

## Shared Patterns

### Org authz gate (the ONE swappable boundary)
**Source:** `backend/app/dependencies.py::_has_org_permission` (:504-522) → `require_org_manage` (:646-663)
**Apply to:** every invitation write/list route (as `require_org_invite`, `org:invite` key)
Runs mig-104's `current_user_has_permission($1,$2)` SECDEF helper AS THE CALLER on `get_user_pg_connection` — never the BYPASSRLS pool (T-166-04). Parameterized binds, never f-string SQL.

### Server-validated X-Org-Id (never trust the client)
**Source:** `backend/app/dependencies.py::get_active_org_id` (:525-577)
**Apply to:** already inherited by every `/org/*` route via the `require_org_*` chain. A spoofed/non-member/malformed `X-Org-Id` is a **403** (`_to_uuid` at :491-501 turns a bad header into a clean non-member 403, never a 500).

### RLS user-JWT writes (the mig-104 policy is the real wall)
**Source:** `get_user_pg_connection` (dependencies.py:158) + the `_has_org_permission` usage (:516-521)
**Apply to:** all `org_invitations` INSERT/UPDATE and the `user_settings.preferences` write. Running on the caller's JWT means the mig-104 `org_invitations_insert/update` RLS `WITH CHECK` (mig 104:356-364) and per-user RLS enforce even if app-code authz is bypassed. Contrast: the global `app_settings` writers (user_settings.py:8-18) stay service-role BECAUSE they have no per-user scope — do not copy that for per-user data.

### JSONB `||` atomic merge (zero-migration config extension)
**Source:** `set_feature_visibility` (user_settings.py:1018-1038)
**Apply to:** VIS-01 greenlist writes + VIS-02 per-user preferences write
`coalesce(col,'{}'::jsonb) || $1::jsonb` avoids the lost-update a whole-column `SET` causes (Pitfall 4). `$1` bind + JSONB codec is SQLi-safe. Caller validates keys against code allowlists first.

### Fail-closed / no-raise resolver defaults
**Source:** `feature_audience` (user_settings.py:997-1015) + `_GOVERNED_FEATURES` (:989-994)
**Apply to:** the greenlist resolver + the effective-model resolver. A cold cache / DB blip / unknown feature falls back to the hardcoded safe-deny default; the resolver NEVER raises into the request.

### Refusal polarity — 403, not 404
**Source:** `require_visible` (:472-474) + org.py docstring (:98)
**Apply to:** all invitation + greenlist gates. A governed org feature is a deliberate 403 an end user can understand — the byte-identical 404 is reserved for `/admin`.

### Blocking supabase-py in async → `run_in_threadpool`
**Source:** `get_org_audit` (org.py:224, 236) + D-v2.5-01
**Apply to:** any invitation route that uses the service-role supabase-py client (`.execute()`). asyncpg is already async — no wrap.

### Frontend shell-owns-fetch / pure-leaf split
**Source:** `OrgAdminShell.tsx` (:134 `alive.current`, :138-160 guarded fetchers, :174-178 lazy per-tab effect)
**Apply to:** InvitationsTab mounts as a pure leaf; the shell owns its fetch + the honest-degrade `.catch` (keeps last-known values, never blanks the surface).

### Frontend api-client shape
**Source:** `getOrgMembers`/`getOrgAudit` (api.ts:4576-4625) + `getAuthHeaders` (:108-116)
**Apply to:** all new invitation/preference fns — `getAuthHeaders()` auto-carries `X-Org-Id`; `ApiError` on non-OK; defensive `?? fallback` envelope unwrap.

### Dialog shell + reset-on-open
**Source:** `CreateLinkDialog.tsx` (:26-33 imports, :71-82 reset-on-open, :134-157 confirm + 422 discrimination)
**Apply to:** InviteMemberDialog. No new package — shipped shadcn Dialog.

### 166 chip vocabulary
**Source:** `OrgMembersTab.tsx::roleBadge` + chip markup (:44-48, :146-158)
**Apply to:** adoption-state chips + invitation-status chips — indigo `◆` admin chip vs muted chip; org-indigo `primary` token, amber reserved.

### Model-picker idiom (registry-only + always-on 🔒 footer)
**Source:** `JudgeModelPicker.tsx` (:89-104 select, :54-69 save-on-select, :108-114 🔒 footer) + `ProviderPicker.tsx` (:202-210)
**Apply to:** ModelDefaultPreference — the 🔒 footer is where the operator lock surfaces (SEED-116).

---

## No Analog Found

Files/seams with no close match — the planner leans on RESEARCH.md + the "build it like X" note above, not a direct copy:

| File / Seam | Role | Data Flow | Reason | Nearest guidance |
|-------------|------|-----------|--------|------------------|
| VIS-02 per-user preferences read/write | controller + service | CRUD | **No per-user settings read/write exists.** `user_settings.preferences` has been DEAD since mig 011:27-28 — grep confirms zero reads in api/models/services. All shipped settings I/O is GLOBAL `app_settings` (service-role, no per-user scope). | Copy the `set_feature_visibility` JSONB-`||`-merge SHAPE but scope it per-user with `get_user_pg_connection` (RLS `auth.uid()`); compose the effective model with the operator allowed-set + lock (SEED-116). |
| `token_hash` generation/verify | security-utility | transform | `secret_cipher.py` (Phase 150) is REVERSIBLE Fernet encryption — WRONG for a one-way invite-token hash. | `setup_store.py` (`secrets.token_urlsafe(32)` :136 + `hmac.compare_digest` :163) OR `skill_embedding_service.py` sha256 (:138). Raw token in the link only; hash in the DB (T-161-04). |
| INV-02 JIT provisioning | service/handler OR migration | event-driven | The trigger-vs-app-layer boundary is an OPEN research decision (D-167-05); the shape depends on that call. | `handle_new_user` (mig 105:83-114) is the fork point + the `ON CONFLICT DO NOTHING` idempotency primitive; add the advisory lock + the invited-vs-fresh fork. RESEARCH-PENDING — do not pre-decide. |
| Greenlist admin surface | component | request-response | Only a binary feature-visibility toggle exists in `ControlRoomPage`; a role/group audience editor is net-new (and rich group management is deferred). | Extend the existing Control Room audience toggle; minimal surface only this phase. |

---

## Metadata

**Analog search scope:** `backend/app/api/` (org, settings, features, audit), `backend/app/dependencies.py`, `backend/app/models/user_settings.py`, `backend/app/services/` (setup_store, audit_service, skill_embedding_service, secret_cipher), `supabase/migrations/` (104, 105, 098, 011), `frontend/src/components/org/` (all 166 leaves + shell), `frontend/src/components/admin/LockedTab`, `frontend/src/components/settings/` (JudgeModelPicker, ProviderPicker), `frontend/src/components/relationships/CreateLinkDialog`, `frontend/src/lib/api.ts`, `frontend/src/pages/AuthPage.tsx`, `frontend/src/App.tsx`
**Files scanned:** ~24 (backend + frontend + migrations + 166 SUMMARY set)
**Pattern extraction date:** 2026-07-21
