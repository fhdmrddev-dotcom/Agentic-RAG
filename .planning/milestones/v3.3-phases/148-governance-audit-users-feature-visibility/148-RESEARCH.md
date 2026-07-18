# Phase 148: Governance — Audit, Users & Feature Visibility - Research

**Researched:** 2026-07-11
**Domain:** Operator governance surfaces — cross-user audit browse, GoTrue user disable/enable, API-layer feature-visibility enforcement — on the shipped `/admin` shell (146+147)
**Confidence:** HIGH (all mechanics verified against live codebase + installed packages; GoTrue ban behavior verified against official Supabase docs/discussions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 Ship grant + revoke in 148, from the roster.** Closes the 146 deferral; env-seed (`OPERATOR_EMAILS`) stays bootstrap-only, roster is the runtime management path. Migration 095's `granted_by` gets populated. Grant = AMBER sheet naming the blast radius; revoke = target-specific-with-a-victim sheet; revoke keeps the person's normal account; past operator actions stay in the trail forever; self-revoke/self-disable blocked with tooltip (lockout-proof).
- **D-02 Impersonation deferred** — STRETCH; re-open trigger = first real support case an operator cannot resolve from audit browser + active-runs + roster alone. 069-B "view as user" preview is a documented enhancement, not day-one.
- **D-03 `require_visible` returns 403** with a plain-language body ("This feature is available to administrators only."). NOT 404 — `/admin` keeps its byte-identical 404; these are governed product features end users may have legitimately seen before a flip.
- **D-04 Frontend learns the map via an authenticated effective-features fetch** piggybacking the existing app-bootstrap/settings load; hidden features don't render in nav/pages. Mid-session flip = graceful bounce (next data fetch 403 → plain refusal, route home). Propagation within the ~30s `app_settings` TTL window. No push/instant eviction.
- **D-05 Mixed day-one audience defaults:** Skill Studio (ONE flag covering eval studio + trigger tuner) and model management → **Operators only** at deploy (SC#3 TRUE verbatim, no manual flip). Workflow authoring & publishing and governance health → **Everyone** (shipped v2.9/v3.0 capabilities keep working; operator can tighten). **Run stays for everyone regardless.**
- **D-06 Cold-read polarity = per-feature hardcoded default** (147 D-Q4 pattern): last-known-good TTL cache absorbs blips; a genuine cold-read failure resolves each feature to its D-05 day-one default — **deny** for Skill Studio/model management, **allow** for workflow authoring/governance health.

### Claude's Discretion
- Audience-record storage shape on the `app_settings` TTL substrate (enum-shaped record — NEVER a boolean; single swappable audience-resolver inside `require_visible`)
- `require_visible` wiring per feature router (evals.py / skill_tuner.py / skill_test_cases.py cluster under ONE Skill Studio flag; settings.py model-management sections; workflows.py authoring/publish with the Run carve-out; governance-health endpoints)
- The effective-features endpoint shape + how it folds into the existing bootstrap fetch; the graceful-bounce UX
- Disable enforcement mechanics: GoTrue `banned_until` duration, where the app-layer check lives, in-flight-run cancellation on disable (reuse 147 kill internals), JWT-expiry latency handling
- Platform `audit_log` browse API shape (filters → parameterized queries, page size, CSV streaming/size cap; explicit user-scoping — no unfiltered tenant dump)
- Audit action vocabulary for the new writes (`user.disable`, `user.enable`, `operator.grant`, `operator.revoke`, `visibility.set`, `audit.export`, `audit.view_platform`)
- Plain-first grouping of the 19 platform `action_type` codes (Documents / Chat & agent / Organizing / Other) with raw codes behind ⌥
- Migration numbering (next free = **098**) + full-schema regen + cloud-parity notes for new `app_settings` rows

### Deferred Ideas (OUT OF SCOPE)
- Impersonation ("Sign in as user") — STRETCH with named re-open trigger
- 069-B live end-user preview (mini-app + 200→404 API probe)
- 067-B day-grouped feed headers — possible later graft onto 067-A's table
- Audience picker beyond two positions (groups/departments) — v3.4 org-RBAC / SEED-115; 148 only preserves the extensible contract
- Sub-tabbed Control Plane (063-C) — documented scale-up
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ADMIN-03** | Operator can browse the `audit_log` table (action-type / date-range filters, pagination, CSV export of the filtered set) and manage users (list with last-active, disable/enable) — read paths explicitly filtered (no RLS backstop); impersonation only if scoped cheaply, else deferred | Platform browse API shape (§Architecture Pattern 3) via asyncpg on `audit_log` with explicit optional user-scoping + pagination + capped CSV (reuses the `/audit-logs` StreamingResponse precedent); roster via asyncpg on `auth.users` + GoTrue admin `update_user_by_id(ban_duration)` for disable/enable (§Pattern 2); grant/revoke via `operator_users` INSERT/DELETE populating `granted_by`. Impersonation deferred (D-02). |
| **VIS-01** | Advanced/technical features (eval studio, model management, trigger tuner) hidden from end users, visible only to operators — enforced at the API layer (not UI-only), visibility map per feature | `require_visible(feature)` dependency factory (§Pattern 1) on each governed router; enum-shaped audience record on a new `app_settings.feature_visibility` JSONB column (§Pattern 4); `GET /features` effective-map endpoint folds into the session-probe pattern (§Pattern 5); per-feature cold-read default (D-06). |
</phase_requirements>

## Summary

This phase is **almost entirely additive plumbing on infrastructure that already exists** — there are **no new external packages** and **one metadata-only migration** (098). Every mechanic has a live precedent in the 146/147 code you are extending: the operator router + audit floor (`admin.py`), the `app_settings` 30s TTL substrate (`user_settings.py`), the shared cancel/zombie-heal internals (`run_lifecycle._cancel_run_internals`), the owner-scoped audit CSV export (`audit.py`), and the one-shot session probe (`useOperatorProbe.ts`). The research work was confirming exact shapes, not discovering new tools.

Three surfaces, three enforcement stories:
1. **Audit browse (ADMIN-03):** a NET-NEW operator read path over the platform `audit_log` table (19 `action_type` codes, migs 030+071). The operator ledger already has a read path (`GET /admin/audit`), so the "source switch" is operator-read (exists) + platform-read (new). Every platform-source read records `audit.view_platform`; the CSV export records `audit.export` naming its exact count. The no-RLS-backstop threat means every query is parameterized, explicitly user-scoped-or-all, paginated, and the export is count-capped (refuse-if-exceeded, never a silent truncation).
2. **Users roster (ADMIN-03):** read `auth.users` directly via asyncpg (join docs/chats counts + `operator_users`) for the roster; **write** disable/enable through the GoTrue admin API `update_user_by_id(uid, {"ban_duration": ...})`. GoTrue's `ban_duration` is a Go duration string whose largest unit is hours, so an "indefinite" ban = a ~100-year value (`"876600h"`); enable = `"none"`. **The JWT-validity window is real and must be closed in app code:** a banned user's existing access token stays valid until `exp` (default ~1h), so an app-layer check reading `auth.users.banned_until` on the shared auth path is mandatory. Disable also cancels in-flight runs via the 147 kill internals.
3. **Feature visibility (VIS-01):** a `require_visible(feature)` FastAPI dependency factory — a literal no-op for operators and for Everyone-audience features (the 091/147 whitelist-gate pattern), 403 for a non-operator on an Operators-only feature. Audience is stored as an **enum-shaped record** in a single new `app_settings.feature_visibility` JSONB column (NEVER a boolean — SEED-115 forward-compat), resolved through ONE swappable function with a per-feature cold-read default (D-06).

**Primary recommendation:** Add exactly one migration (098: `feature_visibility jsonb` on `app_settings`, seeded with the D-05 day-one map + the `org_id`-free 095 provenance stays), a `require_visible` factory + `feature_audience` resolver in `user_settings.py`, an app-layer ban check inside `get_current_user`, and ~7 new operator endpoints on the existing `admin.py` router. Reuse `_cancel_run_internals`, the `/audit-logs` CSV pattern, and the `useOperatorProbe` session-fetch shape verbatim. Touch no shared streaming/agent path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-user audit browse + filters + pagination | API / Backend (`admin.py` + asyncpg) | — | Service-role read with NO RLS backstop; must be gated + explicitly scoped server-side |
| CSV export of filtered audit set | API / Backend (StreamingResponse) | — | Count-capped stream; export event itself recorded — a governance action, not a client concern |
| User roster read (identity + last-active + counts + role) | API / Backend (asyncpg on `auth.users` + joins) | — | Needs a cross-table join GoTrue's `list_users` cannot do; efficient single SQL |
| Disable / enable a user | API / Backend (GoTrue admin API write) | Auth service (GoTrue) | `banned_until` is GoTrue-owned state; the sanctioned write path is the admin API |
| App-layer ban enforcement (close JWT window) | API / Backend (shared `get_current_user`) | — | Stateless JWT stays valid post-ban; only a per-request server check can lock out a live token |
| Grant / revoke operator | API / Backend (`operator_users` INSERT/DELETE) | — | Membership table is the runtime source of truth (146 D-01); populates `granted_by` |
| Feature-visibility enforcement | API / Backend (`require_visible` dependency) | — | VIS-01 explicitly demands API-layer enforcement, not UI-only gating |
| Audience storage + resolution | Database / Storage (`app_settings` JSONB) + API cache | — | Rides the existing per-worker 30s TTL substrate; enum record forward-compat to roles |
| Nav visibility + graceful 403 bounce | Frontend (React `ActiveView` switch) | API (effective-features map) | Rendering only — the API is the security authority (Pitfall 13); frontend hides + bounces |

## Standard Stack

### Core (all already installed — no new dependencies)
| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| `supabase` (python) | 2.29.0 | GoTrue admin API for disable/enable (`auth.admin.update_user_by_id`) | Already the app's auth client; `get_supabase()` returns the service-role client |
| `supabase_auth` (gotrue) | 2.29.0 (pkg dir also carries legacy `gotrue` 2.12.4) | `AdminUserAttributes.ban_duration`, `User.banned_until`, `User.last_sign_in_at`, `list_users` | The installed GoTrue admin surface; signatures verified in `venv/Lib/site-packages/supabase_auth/_sync/gotrue_admin_api.py` |
| `asyncpg` | >=0.29 | All cross-user reads (audit browse, roster, ban check) via the singleton pool | 146/147 precedent — `admin.py` reads `auth.users`/`runs` via `deps._pg_pool`; JSONB codec registered per-connection |
| `fastapi` | 0.115.6 | Dependency-factory `require_visible`, `StreamingResponse` CSV | Framework in use; dependency composition is the enforcement seam |
| `csv` + `io` (stdlib) | — | CSV export writer | Exactly the `/audit-logs` export precedent (`app/api/audit.py:95-112`) |

### Supporting (reused code assets, not libraries)
| Asset | Location | Purpose | When to Use |
|-------|----------|---------|-------------|
| `_cancel_run_internals` | `run_lifecycle.py:158` | Cancel a victim's in-flight run on disable | Disable of a user with active chat/workflow runs |
| `save_app_settings` / TTL cache | `user_settings.py:259` / `:224` | Audience read via the 30s cache; flag-write precedent | Reading audience; but audience WRITE uses a dedicated JSONB-merge (see Pattern 4) |
| `operator_audit_floor` | `dependencies.py:221` | Per-endpoint append-only ledger row | Attach to every new write endpoint + the platform-view + export reads |
| `/audit-logs` export | `audit.py:80-112` | CSV `StreamingResponse` + `csv`/`io` shape | Template for the operator platform CSV export (drop the `.eq(user_id)`, add cap + record) |
| `useOperatorProbe(userId)` | `frontend hooks/useOperatorProbe.ts` | One-shot session probe → render gating | Template for `useEffectiveFeatures(userId)` |
| `ApiError{status}` | `frontend lib/api.ts:20` | Status-carrying error | Catch `err.status === 403` for the graceful bounce |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncpg direct reads for roster | GoTrue admin `list_users(page, per_page)` | `list_users` gives email/created_at/last_sign_in_at/banned_until but CANNOT join docs/chats counts or `operator_users` role → N+1 per row. asyncpg does it in one query. **Use asyncpg for READ, GoTrue admin API for the disable/enable WRITE only.** |
| New JSONB `feature_visibility` column | Per-feature boolean columns (like the 097 flags) | Boolean columns violate the never-boolean contract (SEED-115) and can't grow to roles. JSONB enum record is the locked contract. |
| App-layer ban check in `get_current_user` | A middleware; or trusting `supabase.auth.get_user` to reject bans | GoTrue's `/user` endpoint does NOT re-check ban on a live token (that's why the community rolls its own). Middleware duplicates auth. `get_current_user` is the by-construction correct single seam. |
| Read-modify-write the whole audience map | JSONB `||` merge per key | RMW risks a lost-update clobber under two concurrent operator toggles. `||` merge is atomic per-key. |

**Installation:** None. `pip` unchanged. (Verified: `supabase==2.29.0`, `supabase_auth==2.29.0`, `asyncpg>=0.29`, `fastapi==0.115.6` all present in `backend/venv`.)

## Package Legitimacy Audit

> This phase installs **zero** external packages — all mechanics use already-installed, already-audited dependencies (`supabase`, `supabase_auth`/gotrue, `asyncpg`, `fastapi`) and the Python stdlib (`csv`, `io`). No slopcheck / registry verification is required because no new install occurs.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | No new packages this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────── FRONTEND (React, ActiveView switch, no router) ──────────────────────────┐
   session start ───────► │  useOperatorProbe(userId) ──► GET /admin/me (200 op / 404 non-op)                                    │
                          │  useEffectiveFeatures(userId) ─► GET /features ──► { skill_studio:bool, model_management:bool, ... } │
                          │        │                                                                                             │
                          │        ▼ filters NAV_ITEMS + gates <ActiveView> render                                              │
                          │  any governed page's data fetch ──► 403 (mid-session flip) ──► catch ApiError.status===403 ──►      │
                          │        plain refusal + setActiveView("chat")   (graceful bounce, D-04)                              │
                          └───────────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                                                       │ Bearer JWT
   ┌───────────────────────────────────────────────────────────────── ▼ ─────────────────────────────────────────────────────┐
   │  get_current_user (SHARED auth seam)                                                                                       │
   │    └─► supabase.auth.get_user(token)  ──►  [NEW] asyncpg: SELECT banned_until FROM auth.users WHERE id=$1                  │
   │              (valid token)                     banned_until > now()? ──► 403 "This account is disabled" (closes JWT window)│
   └───────────┬───────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┘
               │ governed feature routers                               │ /admin router (require_operator, byte-identical 404)
   ┌───────────▼───────────────────────────────┐          ┌─────────────▼────────────────────────────────────────────────────┐
   │ evals.py · skill_tuner.py · skill_test_    │          │ AUDIT BROWSE                                                      │
   │ cases.py            → require_visible(      │          │  GET /admin/audit          (operator ledger — EXISTS, 146)        │
   │                        "skill_studio")     │          │  GET /admin/platform-audit (NEW cross-user; records view_platform)│
   │ settings.py GET/PUT/reembot → require_      │          │  GET /admin/platform-audit/export (NEW capped CSV; records export)│
   │   visible("model_management")              │          │      → asyncpg audit_log  WHERE (user_id filter?) AND action_type  │
   │   [CARVE-OUT: GET /settings/providers stays │          │        = ANY(...) AND created_at BETWEEN ... ORDER BY DESC LIMIT/OFF│
   │    everyone — chat model picker]           │          │ USERS ROSTER                                                      │
   │ workflows.py create/patch/delete/publish/  │          │  GET  /admin/users         (asyncpg auth.users + counts + role)   │
   │   generate → require_visible("workflow_    │          │  POST /admin/users/{id}/disable  → GoTrue ban + kill in-flight runs│
   │   authoring")                              │          │  POST /admin/users/{id}/enable   → GoTrue ban_duration="none"     │
   │   [CARVE-OUT: GET /published, /starters +  │          │  POST /admin/users/{id}/operator  → operator_users INSERT (grant)  │
   │    threads.py workflow LAUNCH stay everyone]│          │  DELETE /admin/users/{id}/operator → operator_users DELETE (revoke)│
   │ document_governance.py → require_visible(   │          │ VISIBILITY                                                        │
   │   "governance_health")                     │          │  PUT /admin/visibility  → JSONB ‖-merge on app_settings.feature_   │
   │        │ resolves via ONE swappable fn      │          │      visibility ; records visibility.set                          │
   │        ▼                                    │          └──────────────┬────────────────────────────────────────────────────┘
   │ feature_audience(feature) ──► load_app_     │◄────── same 30s TTL cache ─────────┘
   │ settings().feature_visibility[feature]      │
   │   .audience  (cold-read → per-feature       │   every write endpoint ── operator_audit_floor ──► operator_audit_log (append-only)
   │    hardcoded default, D-06)                 │
   └────────────────────────────────────────────┘
```

### Recommended Structure (files touched)
```
backend/app/
├── api/admin.py                 # +7 endpoints (platform-audit, platform-audit/export, users,
│                                #   users/{id}/disable|enable|operator, visibility)
├── services/
│   ├── operator_service.py      # + grant_operator / revoke_operator / list_users_roster helpers
│   └── governance_service.py    # NEW: platform audit query builder + CSV generator + roster query
├── models/user_settings.py      # + feature_visibility field, feature_audience() resolver,
│                                #   set_feature_visibility() JSONB-merge writer, _GOVERNED_FEATURES map
├── dependencies.py              # + require_visible(feature) factory; ban check inside get_current_user
├── api/features.py              # NEW tiny router: GET /features (authenticated, per-user effective map)
└── api/{evals,skill_tuner,skill_test_cases,settings,workflows,document_governance}.py
                                 # + Depends(require_visible("...")) on the governed endpoints only

supabase/migrations/098_feature_visibility.sql   # app_settings.feature_visibility jsonb + day-one seed

frontend/src/
├── hooks/useEffectiveFeatures.ts   # NEW: mirrors useOperatorProbe(userId) — GET /features once/session
├── lib/api.ts                       # + getEffectiveFeatures(), platform-audit/users/visibility calls
├── App.tsx                          # gate NAV filtering + <ActiveView> render + 403 bounce
└── components/admin/{AuditTab,UsersAndAccess,FeatureVisibility}.tsx  # per the locked 067/068/069 sketches
```

### Pattern 1: `require_visible(feature)` dependency factory (VIS-01 enforcement)
**What:** A closure-returning FastAPI dependency added per governed endpoint. No-op for operators + Everyone features; 403 otherwise.
**When to use:** On every governed endpoint EXCEPT the Run/chat carve-outs.
```python
# dependencies.py — Source pattern: 091/147 whitelist-gate no-op + require_operator (verified live)
def require_visible(feature: str):
    """VIS-01 API-layer gate. Literal no-op for operators AND Everyone-audience
    features (Deep Mode / carve-outs stay byte-identical). 403 (D-03) for a
    non-operator hitting an Operators-only feature. `is_operator` is the ONE
    swappable boundary — SEED-115 later flips it to "is in group X"."""
    async def _dep(current_user: dict = Depends(get_current_user)):
        if await is_operator(current_user["id"]):
            return                                   # operator → no-op
        from app.models.user_settings import feature_audience
        if feature_audience(feature) == "everyone":  # Everyone → no-op
            return
        raise HTTPException(                         # Operators-only + non-op → 403 (NOT 404)
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature is available to administrators only.",
        )
    return _dep
```

**Exact wiring map (governed endpoints — verified against each router):**

| Feature key | Router(s) | Gate these endpoints | CARVE-OUT (stays Everyone) |
|-------------|-----------|----------------------|----------------------------|
| `skill_studio` | `evals.py` (`router` `/skills/{id}/evals/*`, `router_evals` `/evals/*`), `skill_tuner.py` (`/skills/{id}/tuner/*`), `skill_test_cases.py` | all endpoints | — |
| `model_management` | `settings.py` | `GET ""`, `PUT ""`, `GET /reembed-progress`, `POST /reembed` | **`GET /settings/providers`** (feeds the chat model picker — `ChatArea.tsx:135` `getProviders()`; end users need it) |
| `workflow_authoring` | `workflows.py` | `POST ""` (create draft), `GET /drafts`, `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/publish`, `POST /generate` | **`GET /published`, `GET /starters`** (Run picker feeds) + **the workflow LAUNCH in `threads.py:937`** (Run stays for everyone — D-05) |
| `governance_health` | `document_governance.py` (`/document-governance/*`) | all endpoints | — (`knowledge_health.py` "Library Health" is a sibling read-only surface NOT named in VIS-01's day-one map → leave ungated/Everyone) |

**Anti-pattern:** Do NOT add `require_visible` at the router level of `settings.py` or `workflows.py` — it would gate the chat model picker / workflow Run carve-outs. Attach per-endpoint on the authoring/management endpoints only.

### Pattern 2: GoTrue disable/enable + the app-layer ban check
**What:** Write ban via the admin API; enforce it via a per-request DB check.
```python
# Disable (services/operator_service.py) — VERIFIED signature: update_user_by_id(uid, AdminUserAttributes)
#   AdminUserAttributes.ban_duration: NotRequired[Union[str, Literal["none"]]]  (gotrue types.py:257)
_INDEFINITE_BAN = "876600h"   # ~100y — Go time.ParseDuration max unit is HOURS (no d/w/y). [CITED: supabase discussion #9239]
await run_in_threadpool(
    lambda: get_supabase().auth.admin.update_user_by_id(user_id, {"ban_duration": _INDEFINITE_BAN})
)   # supabase-py is BLOCKING httpx → run_in_threadpool (D-v2.5-01)
# Enable:  {"ban_duration": "none"}   → GoTrue sets auth.users.banned_until = NULL

# App-layer check INSIDE get_current_user (dependencies.py) — closes the ~1h JWT window.
# banned_until is a real auth.users column [CITED: discussion #9239]. FAIL-OPEN on read error
# (a DB blip must never lock out every user — the maintenance_mode "no self-inflicted outage" polarity).
async def _is_banned(user_id: str) -> bool:
    try:
        pool = await get_pg_pool()
        row = await pool.fetchrow(
            "SELECT banned_until FROM auth.users WHERE id = $1", user_id)
        bu = row and row["banned_until"]
        return bu is not None and bu > datetime.now(timezone.utc)
    except Exception:
        return False        # fail-open — re-enforced on next successful read
# ...after supabase.auth.get_user validates the token, before returning the identity:
#   if await _is_banned(user["id"]): raise HTTPException(403, "This account is disabled — contact your administrator.")
```
**In-flight cancellation on disable:** after the ban write, look up the victim's `runs:active` entries (the `/admin/runs` enrichment already shows how) and call `_cancel_run_internals(...)` per killable run — reuse, never re-implement (matches the 147 kill path exactly). The sketch copy promises "in-flight run cancelled"; this delivers it.

### Pattern 3: Platform audit browse — parameterized, explicitly-scoped, capped (no-RLS-backstop threat)
```python
# services/governance_service.py — asyncpg (consistent with admin.py cross-user reads).
# NULL user_id param = "all users" (operator's deliberate cross-user read); a value = single-user filter
# (the "click a user in a platform row" affordance). action_type filter is an array ANY; date range is a
# half-open window. ALWAYS paginated (page_size le=100). NEVER an unbounded SELECT *.
SELECT id, user_id, action_type, metadata, created_at
FROM audit_log
WHERE ($1::uuid  IS NULL OR user_id = $1)
  AND ($2::text[] IS NULL OR action_type = ANY($2))
  AND ($3::timestamptz IS NULL OR created_at >= $3)
  AND ($4::timestamptz IS NULL OR created_at <  $4)
ORDER BY created_at DESC
LIMIT $5 OFFSET $6;
```
**CSV export = exactly the filtered set, capped:** COUNT first with the same WHERE; if count > `_CSV_MAX_ROWS` (e.g. 50 000) → **refuse** (413/422 "Too many rows ({count}) — narrow the filter") rather than silently truncate (the sketch's "exports exactly the FILTERED set" contract). Otherwise stream with the `audit.py` `csv`/`io`/`StreamingResponse` shape. The export endpoint records `audit.export` with the exact count + a filter summary in the label; the browse-with-platform-source records `audit.view_platform`. Both are floor-attached deliberate rows.

### Pattern 4: Audience storage — enum record on a JSONB column (never boolean)
```sql
-- migration 098 — mirrors the existing app_settings.provider_model_lists JSONB column
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS feature_visibility jsonb NOT NULL DEFAULT '{}'::jsonb;
INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
-- D-05 day-one seed (belt-and-suspenders with the D-06 code cold-default):
UPDATE public.app_settings SET feature_visibility = jsonb_build_object(
  'skill_studio',       jsonb_build_object('audience','operators'),
  'model_management',   jsonb_build_object('audience','operators'),
  'workflow_authoring', jsonb_build_object('audience','everyone'),
  'governance_health',  jsonb_build_object('audience','everyone')
) WHERE id = 'global';
```
```python
# user_settings.py — resolver + race-safe writer
_GOVERNED_FEATURES = {                 # feature → D-06 cold-read default (the ONLY place polarity lives)
    "skill_studio": "operators", "model_management": "operators",
    "workflow_authoring": "everyone", "governance_health": "everyone",
}
def feature_audience(feature: str) -> str:
    """Resolve the stored enum record → 'everyone'|'operators'. Cold cache / DB blip /
    missing key → the per-feature hardcoded default (D-06). NEVER reads a boolean."""
    try:
        fv = load_app_settings().feature_visibility or {}   # add field to UserEffectiveSettings + builder
        rec = fv.get(feature) or {}
        aud = rec.get("audience")
        if aud in ("everyone", "operators"):
            return aud
    except Exception:
        pass
    return _GOVERNED_FEATURES.get(feature, "operators")      # unknown feature → safe-deny

async def set_feature_visibility(feature: str, audience: str) -> bool:
    """Atomic per-key JSONB merge (no lost-update clobber). feature/audience are
    validated against code allowlists by the caller — never free text (SQLi-safe,
    mirrors set_flag's _FLAG_KEYS guard)."""
    pool = await get_pg_pool()
    await pool.execute(
        "UPDATE app_settings SET feature_visibility = "
        "coalesce(feature_visibility,'{}'::jsonb) || $1::jsonb, updated_at = now() "
        "WHERE id = 'global'",
        {feature: {"audience": audience}},   # JSONB codec serializes the dict
    )
    invalidate_settings_cache()
    return True
```
The enum record shape `{"audience": "operators"}` is extensible to `{"audience": "role", "roles": [...]}` later (SEED-115) with zero migration — the resolver's ONE `if aud in (...)` branch is the swap point.

### Pattern 5: Effective-features endpoint + session fetch + graceful bounce (D-04)
```python
# api/features.py — authenticated, NOT operator-gated. Per-user map.
@router.get("/features")
async def get_effective_features(current_user: dict = Depends(get_current_user)):
    op = await is_operator(current_user["id"])
    return {"features": {
        f: (op or feature_audience(f) == "everyone") for f in _GOVERNED_FEATURES
    }}   # operator → all True; end user → True only for Everyone features
```
```ts
// useEffectiveFeatures.ts — mirrors useOperatorProbe(userId): one fetch per session, keyed to userId,
// fail-closed to {} (hide governed features) on error. App.tsx filters NAV_ITEMS + gates render.
// Graceful bounce: any governed page's data fetch that returns 403 → catch (err.status===403) →
// show the plain refusal + setActiveView("chat"); optionally refetch the map. Propagation ≤ 30s TTL.
```

### Anti-Patterns to Avoid
- **Gating the chat model picker or workflow Run** — `GET /settings/providers`, `GET /workflows/published|starters`, and the `threads.py:937` workflow launch are Run carve-outs; gating them breaks end-user chat/run (D-05 "Run stays for everyone").
- **Boolean audience storage** — kills the v3.4 roles path (the locked contract).
- **Trusting `get_user` to reject bans** — it does not on a live token; the app-layer check is mandatory.
- **Fail-CLOSED on the ban-check read error** — a DB blip would 500/lock out every user (self-inflicted outage). Fail-open; the JWT window is already bounded.
- **Unbounded audit SELECT / uncapped CSV** — the no-RLS-backstop threat; always paginate + cap.
- **`require_operator` on `GET /features` or `require_visible`** — non-operators MUST reach `/features` (to learn their map) and the governed carve-outs.
- **A second platform-activity page** — one browser, a source switch (sketch "What to Avoid").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disable a user | A custom `disabled` boolean table + dual-write | GoTrue `ban_duration` → `auth.users.banned_until` | Single source of truth; GoTrue already blocks new sign-ins; no consistency problem |
| Cancel a victim's in-flight run | Re-implement cancel/zombie-heal | `run_lifecycle._cancel_run_internals` | The D-062 discipline (sentinel ordering, idempotent-terminal, Redis best-effort) must not drift |
| CSV export | Manual string concatenation | stdlib `csv.writer` + `io.StringIO` + `StreamingResponse` (audit.py precedent) | Quoting/escaping/encoding edge cases; the pattern already exists |
| Audience cache | A new flag store / Redis pub-sub cross-worker bust | The `app_settings` 30s TTL cache | 147 explicitly chose per-worker TTL over pub-sub; ≤30s skew is honest ("takes effect on their next call") |
| Operator ledger writes | A new audit write path | `operator_audit_floor` + `write_operator_audit` | By-construction auditing; free-text action (no CHECK on `operator_audit_log.action`) |
| Roster last-active | Fabricate / infer activity | `auth.users.last_sign_in_at` | Sketch demands honesty ("never fabricated"); GoTrue maintains it |

**Key insight:** Every "hard" part of this phase already has a battle-tested home in the 146/147/031 code. The failure mode here is *re-implementing* rather than *composing* — every new line should be a thin operator-gated endpoint delegating to an existing helper.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this is additive feature work (new endpoints + one metadata-only column). No strings are being renamed and no stored keys/collections change. The only runtime *state writes* this phase performs are intentional feature behavior (GoTrue `banned_until`, `operator_users` rows, `app_settings.feature_visibility`), not stale cached state left by a rename. **Verified:** grep of the phase scope finds no rebrand/replace target; CONTEXT.md declares additive governance surfaces.

**One deploy-time state note (not a rename):** the new `app_settings.feature_visibility` column + its day-one seed row is *live service config that must be applied to the CLOUD Supabase* at promotion (paste migration 098 into the cloud SQL editor — the standing v3.3 parity rule). Local and cloud each carry their own `app_settings.global` row; the seed must run in both.

## Common Pitfalls

### Pitfall 1: The JWT-validity window silently defeats "disable"
**What goes wrong:** You set `banned_until`, the roster flips to Disabled, but the user keeps using the app for up to ~1 hour because their access token is still valid.
**Why it happens:** JWT auth is stateless; GoTrue only blocks *new* sign-ins / refreshes, not existing tokens. [CITED: supabase discussion #33791, #9239]
**How to avoid:** The app-layer `banned_until` check inside `get_current_user` (Pattern 2). Do NOT rely on `supabase.auth.get_user` rejecting the ban.
**Warning signs:** A UAT where a disabled user (kept logged in) can still hit `/threads` — if that succeeds, the app-layer check is missing or fail-opened incorrectly.

### Pitfall 2: `ban_duration` rejects day/year units
**What goes wrong:** `{"ban_duration": "100y"}` or `"36500d"` throws — Go's `time.ParseDuration` largest unit is **hours**.
**How to avoid:** Use `"876600h"` (~100y) for indefinite; `"none"` to lift. [CITED: gotrue types.py + discussion #9239]
**Warning signs:** A 400/422 from the admin API on disable.

### Pitfall 3: Gating a Run carve-out breaks end users
**What goes wrong:** Adding `require_visible("model_management")` at the `settings.py` router level 403s the chat model picker (`GET /settings/providers`); router-gating `workflows.py` 403s the Run picker.
**How to avoid:** Per-endpoint gating on authoring/management endpoints only; leave `GET /settings/providers`, `GET /workflows/published|starters`, and the `threads.py` launch ungated (Pattern 1 table).
**Warning signs:** A non-operator's chat model dropdown goes empty, or "Run workflow" 403s.

### Pitfall 4: Lost-update clobber on concurrent visibility toggles
**What goes wrong:** Two operators toggle two different features; a read-modify-write of the whole map makes the later write clobber the earlier.
**How to avoid:** JSONB `||` merge per key (Pattern 4 `set_feature_visibility`), not `save_app_settings` (which does `SET col = $N`).
**Warning signs:** A toggle "un-does" another feature's recent change.

### Pitfall 5: Full-tenant leak through the audit browse
**What goes wrong:** An unbounded `SELECT * FROM audit_log` or an uncapped CSV dumps every user's activity — the exact SC#4 threat (service-role, no RLS backstop).
**How to avoid:** Always paginate (`page_size` le=100), always parameterize, cap the CSV with refuse-if-exceeded (Pattern 3). Record `audit.view_platform` so the cross-user read is never silent.
**Warning signs:** A browse response larger than one page; a CSV with no row cap.

### Pitfall 6: Cold-read polarity wrong (fail-open on a tightened feature)
**What goes wrong:** On a fresh worker with a cold cache, `feature_audience` returns a default that *shows* Skill Studio to everyone (fails open on a feature that should be operators-only).
**How to avoid:** The `_GOVERNED_FEATURES` per-feature default map (D-06): deny for skill_studio/model_management, allow for workflow_authoring/governance_health. Seed the DB too (belt-and-suspenders).
**Warning signs:** A restart briefly exposes an operators-only feature.

### Pitfall 7: Self-lockout
**What goes wrong:** An operator disables or self-revokes and loses all access.
**How to avoid:** Server-side guard on `/users/{id}/disable` and `DELETE /users/{id}/operator` — refuse when `id == current_operator.id` (plus the frontend tooltip, which is courtesy only).
**Warning signs:** The only operator can't reach `/admin`.

## Code Examples

### Roster read (one query, honest last-active + counts + role)
```sql
-- services/governance_service.py (asyncpg). Cross-user read behind require_operator (no RLS backstop).
SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
       (o.user_id IS NOT NULL)                      AS is_operator,
       coalesce(d.cnt, 0)                           AS doc_count,
       coalesce(t.cnt, 0)                           AS chat_count
FROM auth.users u
LEFT JOIN operator_users o ON o.user_id = u.id
LEFT JOIN (SELECT user_id, count(*) cnt FROM documents GROUP BY user_id) d ON d.user_id = u.id
LEFT JOIN (SELECT user_id, count(*) cnt FROM threads   GROUP BY user_id) t ON t.user_id = u.id
ORDER BY u.last_sign_in_at DESC NULLS LAST
LIMIT $1 OFFSET $2;
-- last_sign_in_at NULL → "never signed in" (italic, never fabricated); banned_until>now() → Disabled chip
```

### Grant / revoke operator (populates 095 `granted_by`; lockout-proof)
```python
# grant  — the target must exist in auth.users; INSERT ON CONFLICT keeps it idempotent
await pool.execute(
    "INSERT INTO operator_users (user_id, granted_by, note) VALUES ($1, $2, 'granted via roster') "
    "ON CONFLICT (user_id) DO UPDATE SET granted_by = EXCLUDED.granted_by",
    target_id, current_operator_id)                     # granted_by = the acting operator (D-01)
# revoke — refuse self-revoke BEFORE the delete (lockout-proof)
if target_id == current_operator_id:
    raise HTTPException(409, "You cannot remove your own operator access.")
await pool.execute("DELETE FROM operator_users WHERE user_id = $1", target_id)
# past operator actions stay in operator_audit_log forever (operator_user_id is a PLAIN uuid, no FK — mig 095)
```

### Audit action vocabulary (free-text `action`, plain-sentence `label` — 146 D-03)
```python
_ACTIONS = {
  "user.disable":        lambda e:   (f"Disabled {e}'s account", True),
  "user.enable":         lambda e:   (f"Re-enabled {e}'s account", True),
  "operator.grant":      lambda e:   (f"Granted operator access to {e}", True),
  "operator.revoke":     lambda e:   (f"Revoked {e}'s operator access", True),
  "visibility.set":      lambda f,a: (f"Made {f} visible to {a}", True),
  "audit.export":        lambda n,s: (f"Exported {n} audit entries ({s})", False),  # a read/receipt
  "audit.view_platform": lambda:     ("Viewed platform activity", False),
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pgsodium for secrets/at-rest | app-layer `cryptography` (SEC-01, Phase 150) | Supabase deprecation cycle | Not this phase, but confirms "no pgsodium" |
| `is_admin` boolean / JWT role claim | `operator_users` table (org-agnostic principal) | Phase 146 | Feature visibility resolves via `is_operator`, the SAME swappable boundary — never a JWT claim (poisons v3.4 one-way door) |
| Feature-flag SaaS (LaunchDarkly/Unleash) | `app_settings` TTL substrate | v3.3 (FLAG-01) | Audience map rides the same substrate; no new flag infra |
| GoTrue `gotrue` package name | `supabase_auth` (2.29.0) | supabase-py 2.x rename | Both dirs present in venv; import via `supabase.auth.admin.*`, not a direct gotrue import |

**Deprecated/outdated:** none material to this phase. The `banned_until` field "wasn't originally documented" (discussion #9239) but is stable and live in the installed GoTrue.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `documents` and `threads` tables both carry a `user_id` column usable for the roster count joins | Roster query | Low — both are RLS user-scoped tables (mig 030/071 show `user_id NOT NULL`); if a table name differs the join needs adjustment. Verify column names at planning. |
| A2 | `"876600h"` (~100y) is accepted by the installed GoTrue's `ban_duration` parser | Pattern 2 | Low — Go `time.ParseDuration` supports arbitrary hours; if rejected, fall back to a shorter far-future value. [ASSUMED exact upper bound not tested live] |
| A3 | Adding the ban check to `get_current_user` does not measurably regress request latency | Pattern 2 | Low — one asyncpg `fetchrow` (~1ms) added to a path that already does a GoTrue network round-trip. Confirm no hot non-auth path bypasses it. |
| A4 | `governance_health` maps to `document_governance.py` (Phase 119 "Governance" nav), not `knowledge_health.py` ("Library Health") | Pattern 1 table | Low-Med — CONTEXT says "confirm exact router at planning". If the operator intends Library Health too, add `require_visible` there as well (still Everyone default, so no behavior change day-one). |
| A5 | Gating the whole Settings page (minus `/providers`) as `model_management` is acceptable — end users lose the Settings page day-one | Pattern 1 table | Med — matches the "admin panel governs every dynamic setting" direction, but end users also lose retrieval/web-search tuning. **Confirm at planning** (see Open Q1). |

## Open Questions (RESOLVED)

1. **Does `model_management` = the entire Settings page, or only the AI-model/embedding/engine-health sections?**
   - What we know: `GET/PUT /settings` return ONE payload covering all sections; endpoint-level gating can't split within it. `GET /settings/providers` (chat picker) must stay Everyone.
   - What's unclear: whether end users should retain access to non-model settings (retrieval, web search) — today they'd lose the whole page.
   - Recommendation: gate `GET/PUT /settings` + `/reembed*` as `model_management`, carve out `/settings/providers`. This matches D-05 + the admin-panel direction. If end-user retrieval tuning must survive, that's a section-split refactor — flag as out-of-scope for 148.
   - **RESOLVED (planning):** `model_management` = the whole Settings page (`GET/PUT /settings` + `/reembed*`) MINUS the `GET /settings/providers` chat-picker carve-out — wired in **148-05 Task 2**. End-user retrieval/web-search tuning moving under the operator matches the admin-panel direction; a per-section split is explicitly out of scope for 148.

2. **Should the effective-features fetch be a standalone `GET /features` or folded into an existing bootstrap call?**
   - What we know: there is no single app-config bootstrap endpoint; `useOperatorProbe` already does a one-shot session GET to `/admin/me`.
   - Recommendation: a standalone `GET /features` (authenticated, per-user) fetched via a `useEffectiveFeatures(userId)` hook that mirrors `useOperatorProbe`. Cleanest seam, no coupling to `/admin`.
   - **RESOLVED (planning):** standalone authenticated `GET /features` (**148-05 Task 1**) consumed by a `useEffectiveFeatures(userId)` hook mirroring `useOperatorProbe` (**148-07 Task 1**).

3. **CSV cap value + refuse-vs-truncate.**
   - What we know: "exports exactly the filtered set" + "size cap" are both locked; they conflict above the cap.
   - Recommendation: cap at ~50 000 rows, COUNT first, refuse (413) above cap with "narrow the filter". Preserves "exactly" and prevents a full dump. Confirm the cap number at planning.
   - **RESOLVED (planning):** cap = **50,000 rows, refuse-if-exceeded** (413/422 "narrow the filter"), never truncate; a refused export writes no `audit.export` row — service-level cap in **148-04 Task 1**, controller receipt in **148-06 Task 1**.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (GoTrue) local | disable/enable via admin API | ✓ (Supabase CLI, auto-start) | supabase_auth 2.29.0 | — |
| asyncpg pool → local Postgres :54322 | all cross-user reads + ban check | ✓ | asyncpg>=0.29 | — |
| `supabase` python client (service-role) | GoTrue admin API | ✓ | 2.29.0 | — |
| Redis (runs:active) | in-flight-run cancel on disable | ✓ (docker-compose.dev.yml) | redis>=5.2 | best-effort (147 discipline: cancel still records via Postgres) |
| pytest + asyncio_mode=auto | Validation | ✓ | pytest>=8 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Redis in-flight cancel degrades to best-effort (Postgres `runs.status` is the durable record) — already the 147 posture.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode = auto`) |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/test_148_*.py -x` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest -q` |
| Key fixtures (conftest) | `operator_override` (overrides `require_operator`), `mock_asyncpg_pool` (drives `is_operator`/reads), `_supabase` mock via `get_supabase` override, `authenticate_operator_request` override, `client`, `auth_headers` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| VIS-01 | Non-operator → 403 (not 404) on an Operators-only governed endpoint | unit | `pytest tests/test_148_require_visible.py::test_non_operator_403 -x` | ❌ Wave 0 |
| VIS-01 | Operator → no-op pass-through on any governed endpoint | unit | `pytest tests/test_148_require_visible.py::test_operator_noop -x` | ❌ Wave 0 |
| VIS-01 | Everyone-audience feature → no-op for non-operator (carve-out byte-identical) | unit | `pytest tests/test_148_require_visible.py::test_everyone_noop -x` | ❌ Wave 0 |
| VIS-01 | Cold-read default per feature (deny skill_studio/model_management, allow workflow/governance) | unit | `pytest tests/test_148_visibility_cold_default.py -x` | ❌ Wave 0 |
| VIS-01 | Run carve-outs (`GET /settings/providers`, `GET /workflows/published`, workflow launch) NOT gated | unit | `pytest tests/test_148_carveouts.py -x` | ❌ Wave 0 |
| VIS-01 | `GET /features` returns per-user map (operator all-true; end user only Everyone) | unit | `pytest tests/test_148_effective_features.py -x` | ❌ Wave 0 |
| ADMIN-03 | Platform browse filters → SQL (action_type IN, date range) return only matching rows | unit | `pytest tests/test_148_platform_audit_filters.py -x` | ❌ Wave 0 |
| ADMIN-03 | No full-tenant leak: browse is paginated (page_size cap) + user-scoped param honored | unit | `pytest tests/test_148_platform_audit_scope.py -x` | ❌ Wave 0 |
| ADMIN-03 | CSV exports EXACTLY the filtered set; over-cap → refuse; `audit.export` recorded with count | unit | `pytest tests/test_148_csv_export.py -x` | ❌ Wave 0 |
| ADMIN-03 | Switching to Platform source records `audit.view_platform` | unit | `pytest tests/test_148_view_platform_recorded.py -x` | ❌ Wave 0 |
| ADMIN-03 | Roster last-active honest: `never signed in` when `last_sign_in_at` NULL | unit | `pytest tests/test_148_roster.py::test_last_active_honesty -x` | ❌ Wave 0 |
| ADMIN-03 | Disable → GoTrue `ban_duration` set + in-flight run cancelled via `_cancel_run_internals` | unit | `pytest tests/test_148_disable.py -x` | ❌ Wave 0 |
| ADMIN-03 | App-layer ban check: disabled user with a live token → 403 on any authed route | unit | `pytest tests/test_148_ban_enforcement.py -x` | ❌ Wave 0 |
| ADMIN-03 | Ban check fails OPEN on DB read error (no lockout of everyone) | unit | `pytest tests/test_148_ban_fail_open.py -x` | ❌ Wave 0 |
| ADMIN-03 | Enable → `ban_duration="none"` | unit | `pytest tests/test_148_enable.py -x` | ❌ Wave 0 |
| ADMIN-03/D-01 | Grant populates `granted_by`; self-revoke + self-disable refused | unit | `pytest tests/test_148_operator_grant.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_148_*.py -x`
- **Per wave merge:** `pytest -q` (full backend suite — must stay green; 146/147 tests are the regression backstop)
- **Phase gate:** full suite green + the G-4 live UAT below before `/gsd:verify-work`

### G-4 lived-experience UAT (Chrome MCP / operator-clicks — wire format insufficient)
- **The disabled user is really out:** operator disables user B (kept logged-in in a second browser); B's next action (send a chat, open Documents) shows "This account is disabled — contact your administrator" within one request — not after a token expiry wait. B's in-flight run shows Stopped.
- **The map is honest + the API is the wall:** a non-operator sees no Skill Studio / Settings nav; hand-hitting `POST /skills/{id}/evals/runs` or `PUT /settings` returns 403 (not 404); flipping workflow authoring to Operators-only mid-session → the Builder page's next fetch 403s → plain refusal + routed to Chat; Run still works.
- **The export is exactly the filter:** filter to one action type + 7d, note the live match count, export CSV → row count matches the shown count, and a `✎ Exported N audit entries` receipt appears in the ledger.

### Wave 0 Gaps
- [ ] `tests/test_148_require_visible.py`, `..._effective_features.py`, `..._visibility_cold_default.py`, `..._carveouts.py` — VIS-01
- [ ] `tests/test_148_platform_audit_filters.py`, `..._scope.py`, `..._csv_export.py`, `..._view_platform_recorded.py` — audit browse
- [ ] `tests/test_148_roster.py`, `..._disable.py`, `..._ban_enforcement.py`, `..._ban_fail_open.py`, `..._enable.py`, `..._operator_grant.py` — users
- [ ] Shared fixtures: extend conftest with a `banned_user` asyncpg-pool fixture + a `feature_visibility` app_settings-row fixture (reuse `mock_asyncpg_pool` + `_supabase` GoTrue-admin mock)

*(SC#10 cross-provider UAT is NOT required here — this phase does not touch streaming/agent-loop/provider-routing paths beyond reusing the already-covered `_cancel_run_internals`. The disable in-flight cancel rides the 147 kill path, which carries its own SC#10 coverage.)*

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Single router-level `require_operator` gate + per-endpoint `require_visible`; no-RLS-backstop acknowledged, all reads explicitly scoped |
| V2 Authentication | yes | GoTrue ban (`banned_until`) + app-layer per-request enforcement to close the JWT window |
| V3 Session Management | yes | Stateless-JWT window is the known gap; app-layer check is the mitigation (short of a blacklist) |
| V4 Access Control | yes | Default-deny operator gate; per-feature audience default-deny cold-read for tightened features; lockout-proof self-guards; IDOR-safe (operator paths are deliberately unscoped ONLY behind the gate) |
| V5 Input Validation | yes | Feature key + audience validated against code allowlists (never free text → SQLi-safe); action_type/date filters parameterized; column names are code constants |
| V6 Cryptography | no | No new secrets/crypto this phase (SEC-01 is Phase 150) |
| V7 Error Handling & Logging | yes | Append-only `operator_audit_log`; cross-user reads recorded (`audit.view_platform`); export recorded with count; floor swallows-and-logs, never raises into the request |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Full-tenant audit leak (service-role, no RLS) | Information Disclosure | Parameterized + explicitly-scoped + paginated queries; capped CSV; recorded cross-user reads |
| Banned user rides a live JWT | Elevation / Spoofing | App-layer `banned_until` check on the shared auth path (Pattern 2) |
| SQL injection via feature key / audience / filter | Tampering | Code-constant allowlists (`_GOVERNED_FEATURES`, `{everyone,operators}`); asyncpg `$N` params; JSONB codec |
| Operator self-lockout | Denial of Service | Server-side self-guard on disable + revoke (not just the UI tooltip) |
| Fail-open on a tightened feature at cold read | Elevation | Per-feature cold-read default = deny for operators-only features (D-06) |
| Lost-update clobber of the audience map | Tampering / Integrity | Atomic JSONB `||` merge per key |
| Visibility 403 leaking feature existence | Information Disclosure (accepted) | Deliberate 403-not-404 (D-03): these ARE known product features; `/admin` keeps its 404 |

## Sources

### Primary (HIGH confidence)
- Live codebase (verified this session): `backend/app/api/admin.py`, `dependencies.py`, `models/user_settings.py`, `services/operator_service.py`, `services/run_lifecycle.py:158`, `api/audit.py:80-146`, `api/{evals,skill_tuner,skill_test_cases,settings,workflows,knowledge_health,document_governance}.py`, `api/threads.py:900-969`, `main.py:98-111 + 518-541`, `frontend/src/{App.tsx, lib/api.ts, hooks/useOperatorProbe.ts, lib/nav-items.ts, components/chat/ChatArea.tsx}`
- Installed packages (verified in `backend/venv`): `supabase_auth/_sync/gotrue_admin_api.py` (`update_user_by_id`, `list_users`, `get_user_by_id`, `delete_user` signatures), `supabase_auth/types.py:241,257` (`User.banned_until`, `AdminUserAttributes.ban_duration`)
- Migrations: `030_missing_tables.sql`, `071_dm_foundations.sql` (the 19 `action_type` codes), `095_operator_foundation.sql` (`granted_by`, `operator_audit_log`), `097_operator_flags.sql` (app_settings flag precedent); `backend/app/services/audit_service.py:13-26` (VALID_ACTION_TYPES)
- Phase docs: 146-CONTEXT.md, 147-CONTEXT.md, 148-CONTEXT.md, the locked sketch contract `references/governance-audit-users-visibility.md`

### Secondary (MEDIUM confidence)
- [Supabase discussion #9239 — how to disable/deactivate a user](https://github.com/orgs/supabase/discussions/9239) (ban_duration, `banned_until` column, ~100y for indefinite, server-side enforcement recommended)
- [Supabase discussion #33791 — revoking access tokens / JWT blacklist](https://github.com/orgs/supabase/discussions/33791) (stateless JWT stays valid until exp; lower expiry / server-side check)
- WebSearch synthesis (verified against the two discussions): ban_duration units ns/us/ms/s/m/h, `'none'` lifts

### Tertiary (LOW confidence)
- None relied upon; the two Assumptions (A2 exact ban-duration upper bound, A5 Settings-page scope) are flagged for planning confirmation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every asset verified in the live tree/venv; zero new packages
- Architecture: HIGH — all five patterns compose verified precedents (146/147/031)
- GoTrue ban mechanics: HIGH — signatures from the installed package + behavior from official Supabase discussions
- Pitfalls: HIGH — each maps to a concrete live seam or a cited GoTrue behavior
- Open scoping questions (model_management granularity, CSV cap) are planning decisions, not knowledge gaps

**Research date:** 2026-07-11
**Valid until:** ~2026-08-10 (stable; the only fast-moving element is the GoTrue package — pin behavior on `supabase_auth 2.29.0` as installed)

## RESEARCH COMPLETE

**Phase:** 148 - Governance — Audit, Users & Feature Visibility
**Confidence:** HIGH

### Key Findings
- **Zero new packages; one metadata-only migration (098).** Every mechanic composes an existing 146/147/031 asset — the phase's failure mode is re-implementing rather than composing.
- **Disable is a two-part mechanic:** GoTrue `ban_duration="876600h"` (max unit hours → ~100y for indefinite; `"none"` to lift) writes `auth.users.banned_until`, BUT a live JWT survives ~1h — so an **app-layer ban check inside `get_current_user`** (fail-open on DB error) is mandatory to actually lock the user out. In-flight runs cancel via `_cancel_run_internals`.
- **`require_visible(feature)`** is a per-endpoint dependency factory: no-op for operators + Everyone features, 403 (not 404) otherwise, resolving audience through ONE swappable function with a per-feature cold-read default (D-06). Wiring map verified per router — with hard Run carve-outs: `GET /settings/providers` (chat picker), `GET /workflows/published|starters` + `threads.py` workflow launch.
- **Audience storage = a new `app_settings.feature_visibility` JSONB column** holding enum records `{"audience":"operators|everyone"}` (never boolean; extensible to roles — SEED-115), written via an atomic JSONB `||` merge and read through the existing 30s TTL cache.
- **Platform audit browse is net-new + no-RLS-backstop-sensitive:** parameterized, explicitly user-scoped-or-all, paginated asyncpg query; CSV export capped (refuse-if-exceeded) and self-recording (`audit.export` with exact count); the platform source switch records `audit.view_platform`. The operator ledger read path already exists (`GET /admin/audit`); the owner-scoped `/audit-logs` CSV is the export template.

### File Created
`.planning/phases/148-governance-audit-users-feature-visibility/148-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Verified in live venv/tree; no installs |
| Architecture | HIGH | Patterns compose verified 146/147/031 precedents |
| Pitfalls | HIGH | Each maps to a live seam or cited GoTrue behavior |

### Open Questions (RESOLVED for planning)
1. `model_management` = whole Settings page (minus `/providers`) vs. only model sections (endpoint can't split one payload) — recommend whole-page gate, confirm. — **RESOLVED:** whole Settings page minus `/providers` (148-05 Task 2).
2. `governance_health` router = `document_governance.py` (recommended) — confirm whether Library Health is also intended. — **RESOLVED:** `governance_health` = `document_governance.py` (148-05 Task 3); `knowledge_health.py` (Library Health) stays ungated/Everyone.
3. CSV cap value + refuse-vs-truncate — recommend ~50k refuse-if-exceeded. — **RESOLVED:** 50,000 rows, refuse-if-exceeded (148-04 Task 1).

### Ready for Planning
Research complete. Planner can create PLAN.md files: 1 migration wave (098 + full-schema regen + cloud-parity note), a backend wave (require_visible + ban check + governance_service + 7 admin endpoints + GET /features), a frontend wave (useEffectiveFeatures + AuditTab source-switch/filters/CSV + UsersAndAccess roster + FeatureVisibility cards per the locked 067/068/069 sketches), and a Wave-0 test scaffold.
