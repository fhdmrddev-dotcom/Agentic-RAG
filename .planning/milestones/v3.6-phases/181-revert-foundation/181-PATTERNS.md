# Phase 181: Revert Foundation - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 11 (7 modified, 4 new) + 3 deferred-to-182/183 render seams
**Analogs found:** 11 / 11 (every seam verified against the live codebase)

> This is a ~95% verbatim-reuse phase. Every analog below was RE-VERIFIED against the
> shipped v3.3 Phase 148 feature-visibility code this session (line numbers current as of
> 2026-07-24). The planner should copy the excerpted shapes IN PLACE — the only net-new
> logic is (a) the `"off"` audience enum member and (b) the 404 `require_canvas` gate.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/models/user_settings.py` (M) | model / config | CRUD (JSONB cold-read + merge) | itself — the `_GOVERNED_FEATURES` + `feature_audience` block (:1081-1152) | exact (in-place extend) |
| `backend/app/dependencies.py` (M — NEW `require_canvas`) | middleware / dependency-gate | request-response | `require_operator` (:391-408, the 404 posture) + `require_visible` (:517-555, the factory shape) | hybrid: 404 body from `require_operator`, factory skeleton from `require_visible` |
| `backend/app/api/features.py` (M) | controller / route | request-response | the `GET /features` map comprehension it modifies (:58-70) | exact (in-place edit) |
| `backend/app/api/admin.py` (M — allowlists) | controller / route | validation | `_VISIBILITY_FEATURES` / `_VISIBILITY_AUDIENCES` allowlist sets (:97-108) + `set_visibility` validators (:999-1008) | exact (extend existing sets) |
| `backend/app/api/canvas_canary.py` (N — temporary) | route | request-response | `backend/app/api/features.py` small top-level router + the `dependencies=[Depends(require_visible(...))]` attach pattern (`workflows.py:237`) | role-match |
| `backend/tests/test_revert_byte_identical.py` (N) | test | transform | `backend/tests/test_148_visibility_cold_default.py` (monkeypatch `us.load_app_settings`) | exact |
| `backend/tests/test_181_*.py` (N) | test | request-response | `test_148_visibility_cold_default.py` + a TestClient 404 assert | role-match |
| `frontend/src/lib/api.ts` (M) | config / types | transform | `GovernedFeature` union (:65-69) + `EffectiveFeatures` (:73) | exact (extend union) |
| `frontend/src/components/admin/FeatureVisibility.tsx` (M) | component | event-driven | the 4 existing `FeatureDef` entries (:101-142) + `AudienceSegments` (:393-436) | exact (append 5th def + add `"off"` segment for this key) |
| `frontend/src/components/admin/ControlRoomPage.tsx` (M) | provider / store | event-driven | `DEFAULT_VISIBILITY` seed (:188-193) + `handleSetVisibility` (:537-551) | exact (add key to seed map) |
| `frontend/src/**/revertByteIdentical.test.tsx` (N) | test | transform | `frontend/src/lib/nav-items.test.ts` (nav-set byte-identity lock) + `FeatureVisibility.a11y.test.tsx` | role-match |

**Deferred render seams (D-181 discretion — may land as belt-and-suspenders now, else 182/183):**

| Deferred File | Role | Analog | Note |
|---------------|------|--------|------|
| `frontend/src/lib/nav-items.ts` (canvas nav entry) | config | `NAV_ITEMS` (:30-59) — a `{ view, icon, label, feature: "visual_workflow_canvas" }` row | The nav entry arrives WITH the view in 183; `visibleNavItems` (:71-73) already filters generically. |
| `frontend/src/App.tsx` (ActiveView + wiring) | store | `ActiveView` union (:87) + `useEffectiveFeatures`/`visibleNavItems` wiring (:149-150) | Wiring is already generic; only a new union member + render branch are added in 182/183. |
| `frontend/src/components/layout/ChatLayout.tsx` (render guard) | component | the `activeView === "…"` else-if chain (:541-648) — a canvas branch lands BEFORE the `KnowledgeHealthPage` else (:644) | The render guard (fallback for a canvas `activeView` when the map is false) is the D-181-06 vitest target. |

## Pattern Assignments

### `backend/app/models/user_settings.py` (model, CRUD) — the ONE cold-default home

**Analog:** itself. This is the ONE place cold-read polarity lives (D-181-05: the JSONB key's authoritative default).

**Cold-default map** (:1081-1086) — add ONE line (D-181-01):
```python
_GOVERNED_FEATURES: dict[str, str] = {
    "skill_studio": "operators",
    "model_management": "operators",
    "workflow_authoring": "everyone",
    "governance_health": "everyone",
    "visual_workflow_canvas": "off",   # NEW — default OFF for everyone incl. operators
}
```

**Audience enum resolver** (:1109-1122) — extend the accepted-enum tuple at :1120 with `"off"`:
```python
def feature_audience(feature: str) -> str:
    aud = _feature_record(feature).get("audience")
    if aud in ("everyone", "operators", "role"):   # ← add "off": ("everyone","operators","role","off")
        return aud
    return _GOVERNED_FEATURES.get(feature, "operators")
```
> Without `"off"` in this tuple, a stored `{"audience":"off"}` record would be IGNORED and fall through to the `_GOVERNED_FEATURES` default — which happens to also be `"off"` for the canvas key, but a future re-flip to off via the DB would silently no-op. Add `"off"` so the stored record is honored.

**Access decision** (:1125-1152) — `resolve_feature_access` already fails-closed for unknown audiences via its trailing `return False` (:1152), so `"off"` → `False` today. Add an EXPLICIT `if aud == "off": return False` branch (D-181-02 clarity; matches the `operators` short-circuit style at :1143-1144):
```python
    if aud == "everyone":
        return True
    if aud == "operators":
        return False
    # NEW — explicit off (belt-and-suspenders; the trailing return False already denies)
    if aud == "off":
        return False
    if aud == "role":
        ...
    return False
```

**Write path** (:1155-1181) — `set_feature_visibility` is UNCHANGED. The operator On flip calls it with `"everyone"`; Off with `"off"`. Its atomic `||` JSONB merge (:1174-1178) is exactly why NO migration is needed (D-181-05):
```python
await pool.execute(
    "UPDATE app_settings SET feature_visibility = "
    "coalesce(feature_visibility, '{}'::jsonb) || $1::jsonb, updated_at = now() "
    "WHERE id = 'global'",
    {feature: record},
)
```

---

### `backend/app/dependencies.py` (dependency-gate, request-response) — NEW `require_canvas`

**Analogs:** `require_operator` (:391-408) for the **404 body**; `require_visible` (:517-555) for the **factory skeleton**. `require_canvas` is a HYBRID — it must MIRROR `require_operator`'s 404, NOT `require_visible`'s 403 (D-181-02).

**The 404 constant to raise** (already defined at :302) — reuse it, do NOT hand-roll a new 404:
```python
_NOT_FOUND = HTTPException(status_code=404, detail="Not Found")
```

**`require_operator`'s 404 posture** (:405-408) — the refusal shape to copy:
```python
    if not await is_operator(current_user["id"]):
        raise _NOT_FOUND          # ← byte-identical 404, non-discoverable
    request.state.operator = current_user
    return current_user
```

**`require_visible`'s factory skeleton** (:540-555) — copy the CLOSURE shape, but note the CRITICAL difference: `require_visible` runs the operator no-op FIRST (:541), then checks audience. `require_canvas` MUST resolve `"off"` BEFORE the operator check (D-181-01) and raise `_NOT_FOUND` (404) instead of the 403:
```python
    async def _dep(current_user: dict = Depends(get_current_user), request: Request = None):
        if await is_operator(current_user["id"]):
            return  # operator -> no-op    ← require_visible SHORT-CIRCUITS operators here
        from app.models.user_settings import feature_audience, resolve_feature_access
        audience = feature_audience(feature)
        if audience == "everyone":
            return
        if audience == "role":
            caller_role, caller_groups = await resolve_caller_role(request, current_user)
            if resolve_feature_access(feature, caller_role, caller_groups):
                return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,   # ← require_canvas raises _NOT_FOUND (404) instead
            detail="This feature is available to administrators only.",
        )
    return _dep
```

**Target shape for `require_canvas`** (the RESEARCH Pattern 2, reconciled with the live `_NOT_FOUND` constant + `resolve_caller_role` signature at :462):
```python
def require_canvas():
    """404-when-off gate for the visual_workflow_canvas layer (REVERT-01 / D-181-02).

    Mirrors require_operator's byte-identical 404 (NOT require_visible's 403) so the
    off state is indistinguishable from 'route never built'. Resolves "off" BEFORE the
    operator no-op so the master switch hides from operators too (byte-identical for ALL,
    D-181-01). Fail-closed: any cold-cache/DB-blip resolves to "off" -> 404.
    """
    async def _dep(current_user: dict = Depends(get_current_user), request: Request = None):
        from app.models.user_settings import feature_audience, resolve_feature_access
        audience = feature_audience("visual_workflow_canvas")
        if audience == "off":
            raise _NOT_FOUND                       # 404 for ALL, incl. operators — resolved FIRST
        if await is_operator(current_user["id"]):
            return
        if audience == "everyone":
            return
        if audience == "role":
            caller_role, caller_groups = await resolve_caller_role(request, current_user)
            if resolve_feature_access("visual_workflow_canvas", caller_role, caller_groups):
                return
        raise _NOT_FOUND                           # 404, never 403 — REVERT byte-identity
    return _dep
```
> `require_canvas()` is called (no args) to produce `_dep`, mirroring how `require_visible("workflow_authoring")` is called at attach sites. Attach on canvas routes via `dependencies=[Depends(require_canvas())]`.

---

### `backend/app/api/features.py` (route, request-response) — effective-map operator-bypass for "off"

**Analog:** the map comprehension it modifies (:58-70). Add a `feature_audience(f) != "off"` guard BEFORE the `op or …` short-circuit (D-181-01 / Pattern 3) so `"off"` hides from operators too.

**Current comprehension** (:59-69):
```python
    return {
        "features": {
            f: (
                op
                or feature_audience(f) == "everyone"
                or (
                    feature_audience(f) == "role"
                    and resolve_feature_access(f, caller_role, caller_groups)
                )
            )
            for f in _GOVERNED_FEATURES
        }
    }
```

**Modified** — the `"off"` guard wins over the operator short-circuit:
```python
            f: (
                feature_audience(f) != "off"      # NEW — "off" hides from operators too
                and (
                    op
                    or feature_audience(f) == "everyone"
                    or (feature_audience(f) == "role"
                        and resolve_feature_access(f, caller_role, caller_groups))
                )
            )
```
> Because `visual_workflow_canvas` is now in `_GOVERNED_FEATURES`, it automatically joins this map — the frontend `GET /features` already surfaces it once the key exists. No new route. The router mount (`main.py:683`) is unchanged.

---

### `backend/app/api/admin.py` (route, validation) — extend the write allowlists

**Analog:** the code allowlist sets (:97-108) + the `set_visibility` validators (:999-1008). A crafted `PUT /admin/visibility` body must not set an arbitrary audience (Security V5). Add the new key + values.

**Allowlist sets** (:97-107):
```python
_VISIBILITY_FEATURES = {
    "skill_studio",
    "model_management",
    "workflow_authoring",
    "governance_health",
    # ADD: "visual_workflow_canvas",
}
_VISIBILITY_AUDIENCES = {"everyone", "operators", "role"}   # ADD: "off"
```

**Validators already reject anything off-allowlist** (:999-1008) — NO handler change needed beyond the set membership:
```python
    if body.feature not in _VISIBILITY_FEATURES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown feature: {body.feature}")
    if body.audience not in _VISIBILITY_AUDIENCES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown audience: {body.audience}")
```
> `GET /admin/visibility` (:949-971) iterates `_GOVERNED_FEATURES`, so the new key auto-appears in the operator read once registered in `user_settings.py`.

---

### `backend/app/api/canvas_canary.py` (route, request-response) — NEW temporary 404-proof (D-181-04)

**Analog:** `backend/app/api/features.py` — a tiny top-level router (a `router = APIRouter(...)` + one small handler), mounted in `main.py` like `app.include_router(features.router)` (`main.py:683`). Attach the gate via the `dependencies=[Depends(...)]` pattern used across the codebase (e.g. `workflows.py:237`).

**Route-attach pattern to copy** (`backend/app/api/workflows.py:237`):
```python
@router.post(
    "/...",
    dependencies=[Depends(require_visible("workflow_authoring"))],   # ← canary uses Depends(require_canvas())
)
```

**Target canary shape** (one throwaway GET, gated, so `test_revert_byte_identical` can assert the 404 end-to-end NOW):
```python
# backend/app/api/canvas_canary.py — TEMPORARY (removed/repurposed when the first real
# canvas route lands in 182/183). Proves require_canvas's 404-when-off via TestClient.
from fastapi import APIRouter, Depends
from app.dependencies import require_canvas

router = APIRouter(tags=["canvas-canary"])

@router.get("/canvas/ping", dependencies=[Depends(require_canvas())])
async def canvas_ping() -> dict:
    return {"ok": True}   # unreachable while flag is off (404 before the handler runs)
```
> Mount in `main.py` alongside the other routers. Because `require_canvas()` 404s when `"off"`, this route is indistinguishable from an unknown path while the flag is off.

---

### `backend/tests/test_revert_byte_identical.py` (test) — the acceptance gate (D-181-06)

**Analog:** `backend/tests/test_148_visibility_cold_default.py` — monkeypatch the settings read to drive the cold default, then assert the resolver. The KEY technique: `monkeypatch.setattr(us, "load_app_settings", …)` to simulate flag-off (cold) vs flipped-on.

**Monkeypatch pattern to copy** (`test_148_visibility_cold_default.py:21-33`):
```python
def test_cold_read_falls_to_per_feature_default(monkeypatch):
    from app.models import user_settings as us
    def _boom():
        raise RuntimeError("settings DB unreachable (cold cache)")
    monkeypatch.setattr(us, "load_app_settings", _boom)
    assert us.feature_audience("skill_studio") == "operators"
    ...
```

**Stored-record override pattern** (`:44-50`) — to test the flipped-ON state:
```python
def test_stored_enum_record_is_honored(monkeypatch):
    from app.models import user_settings as us
    stored = SimpleNamespace(feature_visibility={"skill_studio": {"audience": "everyone"}})
    monkeypatch.setattr(us, "load_app_settings", lambda: stored)
    assert us.feature_audience("skill_studio") == "everyone"
```

**The three asserts this file adds** (RESEARCH Pattern 4):
1. `test_features_map_hides_canvas_from_everyone_when_off` — `get_effective_features` returns `visual_workflow_canvas: False` for operator AND user (drive `is_operator` + cold `load_app_settings`).
2. `test_require_canvas_404s_when_off` — a TestClient GET on the canary route returns **404, never 403** (integration; the D-181-02 posture).
3. `test_existing_governed_features_unchanged` — the 4 shipped keys resolve exactly as `test_148_visibility_cold_default` asserts (no Phase-148 regression).

> `test_181_*.py` (flip-on: `set_feature_visibility("visual_workflow_canvas","everyone")` → map True + gate no-op; the `"off"` audience unit tests) follow the same monkeypatch pattern.

---

### `frontend/src/lib/api.ts` (types) — extend the governed-feature union

**Analog:** the `GovernedFeature` union (:65-69) + `EffectiveFeatures` (:73). Add the key; `EffectiveFeatures = Partial<Record<GovernedFeature, boolean>>` picks it up automatically.
```typescript
export type GovernedFeature =
  | "skill_studio"
  | "model_management"
  | "workflow_authoring"
  | "governance_health"
  | "visual_workflow_canvas"   // NEW
```
> `getEffectiveFeatures()` (:3845), `setFeatureAudience()` (:4172), `getFeatureVisibility()` (:4156) are all GENERIC over `GovernedFeature` — no change beyond the union. The Off|On flip reuses the existing binary `setFeatureVisibility` writer (called by `handleSetVisibility` at `ControlRoomPage.tsx:542`) with `"off"` | `"everyone"`.

---

### `frontend/src/components/admin/FeatureVisibility.tsx` (component, event-driven) — 5th card + Off|On control

**Analog:** the 4 existing `FeatureDef` entries (:101-142) + `AudienceSegments` (:393-436). Append a 5th def; for THIS key present **Off | On** (D-181-03), NOT the Everyone|Operators|By-role triad.

**Append to `FEATURES`** (after :141) — copy the `FeatureDef` shape:
```typescript
{
  key: "visual_workflow_canvas",
  name: "Visual workflow canvas",
  desc: "The drag-and-drop visual authoring + live-run canvas. Off = today's product exactly.",
  livesOn: "Workflows",
  glyph: Workflow,   // already imported (:37)
  uiSurface: "The visual canvas authoring door and its run view.",
  refusedApi: "Canvas view + validate/save/canvas routes (existing Describe & run / Author & govern stay open).",
  routePrefixes: "/canvas routes (flag-gated 404)",
}
```

**The segmented control** (`AudienceSegments`, :393-436) currently renders three `SegButton`s (Everyone / Operators only / By role). For the canvas key, the plan needs a TWO-position **Off | On** variant (On writes `"everyone"`, Off writes `"off"`). The `SegButton` primitive (:441+) and the `onFlip` plumbing are reused verbatim; only the button SET differs for this key:
```typescript
      <SegButton selected={audience === "everyone"} busy={busy} tone="everyone" onClick={() => onFlip("everyone")}>
        Everyone
      </SegButton>
      <SegButton selected={audience === "operators"} ...>Operators only</SegButton>
      <SegButton selected={audience === "role"} ...>By role</SegButton>
```
> Discretion (D-181-03 / Claude's Discretion): either branch `AudienceSegments` on `def.key === "visual_workflow_canvas"` to render Off|On, or add a sibling two-position control. Keep the `AudienceValue` type extended with `"off"` (it currently unions `FeatureAudience | "role"` at :47 — add `"off"`). The amber/receipt/consequence frame (:244-350) is reused verbatim.

---

### `frontend/src/components/admin/ControlRoomPage.tsx` (store, event-driven) — seed the map

**Analog:** `DEFAULT_VISIBILITY` (:188-193) + `handleSetVisibility` (:537-551). Add the key to the seed; the write handler is already generic.

**Seed map** (:188-193):
```typescript
const DEFAULT_VISIBILITY: Record<GovernedFeature, FeatureAudience> = {
  skill_studio: "operators",
  model_management: "operators",
  workflow_authoring: "everyone",
  governance_health: "everyone",
  // ADD: visual_workflow_canvas: "off",
}
```
> `FeatureAudience` must gain `"off"` (its `@/lib/api` definition) for this to type-check. `handleSetVisibility` (:537) already routes non-`role` audiences through `setFeatureVisibility(feature, audience)` (:542) — `"off"`/`"everyone"` flow through unchanged. The `<FeatureVisibility>` mount (:801-806) is unchanged.

---

### `frontend/src/**/revertByteIdentical.test.tsx` (test) — nav-parity + render-guard

**Analog:** `frontend/src/lib/nav-items.test.ts` (the NAV_ITEMS byte-identity lock) + `frontend/src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx`.

**Byte-identity lock pattern to copy** (`nav-items.test.ts:17-25`):
```typescript
describe("NAV_ITEMS — D-07 non-discoverability contract", () => {
  it("carries no control-room view entry", () => {
    expect(NAV_ITEMS.some((item) => item.view === "control-room")).toBe(false)
  })
})
```

**The two asserts this file adds** (RESEARCH Pattern 4):
1. `visibleNavItems({ ...map, visual_workflow_canvas: false })` contains NO canvas entry; `= true` reveals it (uses `visibleNavItems` from `nav-items.ts:71`).
2. The ChatLayout render guard returns the fallback (never the canvas) for a canvas `activeView` when the map is false (the D-181-06 belt-and-suspenders; may defer with the render branch to 182/183 per discretion).

## Shared Patterns

### The "off" audience contract (SEED-115 enum-not-boolean)
**Source:** `backend/app/models/user_settings.py:1109-1152`
**Apply to:** `feature_audience` (enum tuple), `resolve_feature_access` (explicit deny), `admin.py` `_VISIBILITY_AUDIENCES`, `api.ts` `FeatureAudience`, `AudienceValue` in `FeatureVisibility.tsx:47`.
The audience is ALWAYS an enum string, NEVER a boolean. `"off"` is a 4th (now 5th with `"role"`) enum member, threaded through every layer that pattern-matches on the audience. Every layer that lists accepted audiences must add `"off"`.

### 404-not-403 refusal (byte-identical non-discoverability)
**Source:** `backend/app/dependencies.py:302` (`_NOT_FOUND`) + `:405-408` (`require_operator`)
**Apply to:** `require_canvas` and every future canvas route. Reuse the module `_NOT_FOUND` constant; NEVER raise a 403 for a canvas route (D-181-02). A 403 leaks the route's existence.

### Resolve "off" BEFORE the operator short-circuit
**Source:** the Pitfall-3 anti-pattern in RESEARCH.md
**Apply to:** `require_canvas` (`dependencies.py`) AND the `GET /features` comprehension (`features.py:59-69`). Both currently pass operators through FIRST (`op or …` / `is_operator → return`). For `"off"`, the deny must win over the operator bypass, else operators see a phantom canvas by default (not byte-identical for them).

### Fail-closed settings read (never raises)
**Source:** `_feature_record` (`user_settings.py:1089-1106`) + `useEffectiveFeatures` (`useEffectiveFeatures.ts:71-75`)
**Apply to:** the whole gate chain. A cold cache / DB blip resolves to `{}` → cold default `"off"` → 404 / hidden nav. The frontend hook fails to `{}` (hide everything). No new fail-closed logic — reuse the existing no-raise posture.

### Route-attach convention
**Source:** `backend/app/api/workflows.py:237` — `dependencies=[Depends(require_visible("workflow_authoring"))]`
**Apply to:** the canary route and every real canvas route: `dependencies=[Depends(require_canvas())]`. One dependency a future canvas route cannot forget.

### FROZEN contracts (D-181-08 — MUST be absent from the phase diff)
**Verify via** `git show --stat` (the standing D-14 "confirmed absent from the phase diff" technique):
`frontend/src/components/workflows/WorkflowDoorSwitch.tsx`, `frontend/src/pages/WorkflowBuilderPage.tsx`, `frontend/src/pages/WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, the harness engine. NONE may appear in the 181 diff.

## No Analog Found

None. Every file this phase touches has a direct in-repo analog (this is a reuse-by-design phase). The only genuinely net-new artifacts are (a) the `require_canvas` closure — but its 404 body and factory skeleton are both copied from existing gates — and (b) the temporary canary route, modeled on the `features.py` micro-router + the standard `Depends(...)` attach convention.

## Metadata

**Analog search scope:** `backend/app/models/`, `backend/app/api/`, `backend/app/dependencies.py`, `backend/tests/`, `frontend/src/lib/`, `frontend/src/hooks/`, `frontend/src/components/admin/`, `frontend/src/components/layout/`, `frontend/src/App.tsx`, `backend/app/main.py`
**Files scanned:** 15 (all read directly this session; line numbers verified current 2026-07-24)
**Pattern extraction date:** 2026-07-24
