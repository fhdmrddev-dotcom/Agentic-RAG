---
phase: 181-revert-foundation
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/api/canvas_canary.py
  - backend/app/api/features.py
  - backend/app/dependencies.py
  - backend/app/main.py
  - backend/app/models/user_settings.py
  - backend/tests/test_148_effective_features.py
  - backend/tests/test_181_flip_on.py
  - backend/tests/test_181_off_audience.py
  - backend/tests/test_revert_byte_identical.py
  - frontend/src/components/admin/ControlRoomPage.tsx
  - frontend/src/components/admin/FeatureVisibility.tsx
  - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx
  - frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx
  - frontend/src/components/admin/revertByteIdentical.test.tsx
  - frontend/src/lib/api.ts
  - scripts/check-181-scope-freeze.sh
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 181: Code Review Report

**Reviewed:** 2026-07-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the Phase 181 "Revert Foundation" diff: the new `visual_workflow_canvas` governed
flag (5th `_GOVERNED_FEATURES` key, cold-default `"off"`), the new `require_canvas()`
dependency factory in `backend/app/dependencies.py`, the throwaway `/canvas/ping` canary
route, the `GET /features` off-wins-over-operator change, the `PUT /admin/visibility`
write-allowlist extension, the Control Room `FeatureVisibility` Off|On control, and the new
test files proving the contract.

The unit-level logic for the three scrutiny properties in the task brief is correctly
implemented for AUTHENTICATED callers: `"off"` resolves before the operator short-circuit in
both `require_canvas` and `GET /features`, and the cold default/accepted-enum-tuple additions
are additive and don't perturb the 4 pre-existing keys' *default* resolution. However, live
`TestClient` probing (bypassing the test suite's blanket `get_current_user` override, which
structurally cannot exercise this path) proves that **`require_canvas` does not actually
deliver its central "404, never 403, byte-identical to an unbuilt route" promise for any
caller that isn't already fully authenticated** — this is a BLOCKER, since it's the exact
property the review brief called out for scrutiny and the exact property `require_canvas`'s
own docstring and the `canvas_canary`/`test_revert_byte_identical` docstrings claim to
deliver. A second, empirically-confirmed issue (WARNING) shows the new `"off"` enum value is
not scoped to `visual_workflow_canvas` in the write-allowlist, so it can be set on any of the
4 pre-existing governed features via a raw API call, producing an honest-looking `GET
/features` regression against the shipped Phase-148 "operator sees all four True" contract.

## Critical Issues

### CR-01: `require_canvas` leaks the gated route's existence via 403/401 for any caller who isn't already authenticated — violates the phase's core "404, never 403" contract

**File:** `backend/app/dependencies.py:558-589` (root cause: line 575, `Depends(get_current_user)`; `get_current_user` at `backend/app/dependencies.py:254-275`; `bearer_scheme = HTTPBearer()` at `backend/app/dependencies.py:20`)

**Issue:**

`require_canvas()`'s dependency chain is:

```python
async def _dep(current_user: dict = Depends(get_current_user), request: Request = None):
    from app.models.user_settings import feature_audience, resolve_feature_access
    audience = feature_audience("visual_workflow_canvas")
    if audience == "off":
        raise _NOT_FOUND  # 404 for ALL, incl. operators — resolved FIRST (D-181-01)
    ...
```

`current_user` is resolved via `Depends(get_current_user)`, which in turn depends on the
**shared, `auto_error=True`** `bearer_scheme = HTTPBearer()` (dependencies.py:20). FastAPI
resolves this sub-dependency chain **before** `_dep`'s own body ever runs — so for any caller
who does not present a valid, non-banned bearer token, the request never reaches the
`audience == "off"` check at all. Instead:

- No `Authorization` header at all → **403** `{"detail":"Not authenticated"}` (raised by
  `HTTPBearer.__call__`, never reaching `require_canvas`).
- A malformed/expired/invalid token → **401** `{"detail":"Invalid or expired token"}` (raised
  inside `get_current_user`'s own `except` block).
- A valid token for a banned user → **403** `{"detail":"This account is disabled..."}`.

None of these is the 404 the whole feature is built to guarantee. This is not a theoretical
concern — I proved it live against the actual dependency (bypassing the test-suite's global
`app.dependency_overrides[get_current_user] = lambda: mock_user_data`, which is exactly why
none of `test_181_flip_on.py` / `test_181_off_audience.py` / `test_revert_byte_identical.py`
catch it):

```
NO AUTH HEADER  -> status: 403 body: {"detail":"Not authenticated"}
BOGUS TOKEN     -> status: 401 body: {"detail":"Invalid or expired token"}
```
(reproduced with a minimal FastAPI app mounting only `Depends(require_canvas()))` on
`GET /canvas/ping`, i.e. the exact production dependency chain, with no test overrides.)

This directly contradicts:
- The review brief's explicit scrutiny item: *"require_canvas must 404, never 403 or 200,
  when the flag is off."*
- `require_canvas`'s own docstring: *"it MIRRORS require_operator's byte-identical 404 (NOT
  require_visible's 403)... A 403 would leak that a canvas route exists-but-forbidden; a 404
  does not."*
- `canvas_canary.py`'s module docstring: *"while the flag is off it is indistinguishable from
  an unknown path (a byte-identical 404 — never a 403 that would leak its existence)."*
- `test_revert_byte_identical.py`'s stated contract: *"a `/canvas` route is a 404, byte-
  identical to a path that was never built... never a 403 that leaks its existence."*

The codebase already solved this exact class of problem for `/admin` (see
`dependencies.py:298-311`, WR-02): `require_operator` deliberately does **not** depend on the
shared `bearer_scheme`/`get_current_user`; it uses a dedicated
`_admin_bearer_scheme = HTTPBearer(auto_error=False)` plus `authenticate_operator_request`,
which folds every auth failure (absent header, invalid token, banned operator) into the same
byte-identical `_NOT_FOUND`. `require_canvas` does not apply the same fix, even though its
docstring explicitly claims to mirror `require_operator`'s posture. Since `require_canvas` is
the reusable primitive every future real canvas route (Phase 182/183+) will attach via
`dependencies=[Depends(require_canvas())]`, this bug will propagate to every one of them
unless fixed here.

**Fix:** Give `require_canvas` its own non-raising auth resolution (mirroring
`authenticate_operator_request`/`_admin_bearer_scheme`), so the `"off"` check runs before any
auth-derived status code can leak, and unauthenticated/invalid callers only see a distinct
status once the flag is confirmed live:

```python
_canvas_bearer_scheme = HTTPBearer(auto_error=False)

async def _resolve_canvas_caller(
    credentials: HTTPAuthorizationCredentials | None = Depends(_canvas_bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict | None:
    """Never raises. Absent/invalid/expired/banned -> None, so require_canvas can check
    the off-switch BEFORE any auth failure produces a non-404 status."""
    if credentials is None:
        return None
    try:
        response = supabase.auth.get_user(credentials.credentials)
        user = getattr(response, "user", None)
    except Exception:
        return None
    if user is None or await _is_banned(user.id):
        return None
    return {"id": user.id, "email": user.email}


def require_canvas():
    async def _dep(request: Request, caller: dict | None = Depends(_resolve_canvas_caller)):
        from app.models.user_settings import feature_audience, resolve_feature_access
        audience = feature_audience("visual_workflow_canvas")
        if audience == "off":
            raise _NOT_FOUND  # 404 for EVERY caller, authenticated or not — resolved FIRST
        if caller is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if await is_operator(caller["id"]):
            return
        if audience == "everyone":
            return
        if audience == "role":
            caller_role, caller_groups = await resolve_caller_role(request, caller)
            if resolve_feature_access("visual_workflow_canvas", caller_role, caller_groups):
                return
        raise _NOT_FOUND
    return _dep
```

Also add a test that hits `/canvas/ping` **without** relying on the conftest's blanket
`get_current_user` override (e.g. `app.dependency_overrides.pop(get_current_user, None)` for
the duration of the test, or a dedicated minimal-app fixture) so this class of regression is
caught in CI going forward — the current suite structurally cannot detect it.

## Warnings

### WR-01: the new `"off"` audience is not scoped to `visual_workflow_canvas` — settable on any of the 4 pre-existing governed features, regressing the `GET /features` "operator sees all True" contract

**File:** `backend/app/api/admin.py:110-112` (`_VISIBILITY_AUDIENCES`), `backend/app/models/user_settings.py:1126-1132` (`feature_audience`'s accepted-enum tuple)

**Issue:**

Phase 181 adds `"off"` to `_VISIBILITY_AUDIENCES` and to `feature_audience`'s accepted-enum
check **globally**, not scoped to `visual_workflow_canvas`, even though every comment
introducing the change describes it as being "for the canvas":

```python
# admin.py:110-112
# Phase 181 (T-181-03): "off" joins the write-allowlist so an operator can flip the canvas
# hidden; a crafted off-allowlist audience still 400s BEFORE any write (SQLi-safe).
_VISIBILITY_AUDIENCES = {"everyone", "operators", "role", "off"}
```

`PUT /admin/visibility`'s `set_visibility` handler (admin.py:990-1032) only checks
`body.feature in _VISIBILITY_FEATURES` and `body.audience in _VISIBILITY_AUDIENCES`
independently — there is no rule tying `"off"` to `visual_workflow_canvas` specifically. I
proved live that this is exploitable through the existing, unmodified write path:

```
PUT /admin/visibility {"feature": "skill_studio", "audience": "off"} -> 204 (accepted)
```

Once persisted, `GET /features` — which now applies the `"off"`-wins-over-operator rule to
**every** key in `_GOVERNED_FEATURES` (features.py:64), not just canvas — reports
`skill_studio: False` even to an operator:

```json
{"skill_studio": false, "model_management": true, "workflow_authoring": true,
 "governance_health": true, "visual_workflow_canvas": false}
```

But `require_visible("skill_studio")` — the actual server-side enforcement gate for that
feature — was **not** touched by Phase 181 and has no `"off"` awareness; it still checks
`is_operator` first and lets the operator through unconditionally (confirmed live: the
dependency returns `None`/allowed for the same operator). So the net effect is a governance
surface that now **lies to an operator about their own access** on the 4 pre-existing keys
(`GET /features` says hidden; the real gate still allows it) — a direct regression against
`test_148_effective_features.py`'s pinned contract ("operator -> every SHIPPED governed
feature True") that is reachable purely through code shipped in this phase, not the tested
cold-default paths. It requires operator-level API access to trigger (not a privilege
escalation for an end user), which is why this is a WARNING rather than a BLOCKER, but it is a
real, provable defect in a security-governance surface that explicitly prides itself on never
optimistically lying about state.

**Fix:** Scope the `"off"` audience to `visual_workflow_canvas` at the write boundary (the
cheapest, most explicit fix — keeps `_VISIBILITY_AUDIENCES` a flat set for every other
feature):

```python
if body.audience == "off" and body.feature != "visual_workflow_canvas":
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="The 'off' audience is only valid for visual_workflow_canvas.",
    )
```

(Placed in `set_visibility` right after the existing `_VISIBILITY_AUDIENCES` check,
admin.py:1009-1013.) Add a `test_181_off_audience.py` case asserting `PUT /admin/visibility
{"feature": "skill_studio", "audience": "off"}` is rejected 400, mirroring the existing bogus-
audience test.

## Info

### IN-01: redundant repeated `feature_audience(f)` lookups in the effective-features comprehension

**File:** `backend/app/api/features.py:64-72`

**Issue:** The Phase 181 change calls `feature_audience(f)` up to 3 times per governed
feature per request (`!= "off"`, `== "everyone"`, `== "role"`) inside a single dict-comp
expression:

```python
f: (
    feature_audience(f) != "off"
    and (
        op
        or feature_audience(f) == "everyone"
        or (
            feature_audience(f) == "role"
            and resolve_feature_access(f, caller_role, caller_groups)
        )
    )
)
for f in _GOVERNED_FEATURES
```

Not a correctness bug (the underlying read is TTL-cached), but it's a readability/maintenance
smell that got worse with this change (was 2 calls before 181, now 3).

**Fix:**

```python
def _visible(f: str) -> bool:
    aud = feature_audience(f)
    if aud == "off":
        return False
    return op or aud == "everyone" or (
        aud == "role" and resolve_feature_access(f, caller_role, caller_groups)
    )

return {"features": {f: _visible(f) for f in _GOVERNED_FEATURES}}
```

---

_Reviewed: 2026-07-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
