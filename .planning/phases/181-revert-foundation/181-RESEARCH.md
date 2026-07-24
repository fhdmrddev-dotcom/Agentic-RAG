# Phase 181: Revert Foundation - Research

**Researched:** 2026-07-24
**Domain:** Feature-flag governance / tested revertibility (backend FastAPI dependency gate + React SPA view/nav gating + CI test gate). Reuse-heavy against the shipped v3.3 Phase 148 feature-visibility pattern.
**Confidence:** HIGH (this is a codebase-reuse phase against a known-good, shipped pattern; every seam was located and read directly in this session)

> **No CONTEXT.md yet** — `/gsd:discuss-phase 181` has not run (`has_context: false`). This is standalone/integrated research. The one genuine design decision (how "default off for everyone incl. operators" maps onto the audience model) is surfaced under Open Questions for discuss-phase to lock. Everything else is a verbatim replication of shipped code.

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from REQUIREMENTS.md) | Research Support |
|----|--------------------------------------------|------------------|
| REVERT-01 | An operator can turn the entire visual canvas layer on/off via a new governed feature key (`visual_workflow_canvas`, default off) — the nav entry and every canvas route are gated (the shipped v3.3 `skill_studio` / feature-visibility pattern); the two existing authoring doors and the engine are untouched when off. | The exact pattern is located: `_GOVERNED_FEATURES` + `feature_visibility` JSONB + `require_visible` gate + `GET /features` map + `useEffectiveFeatures`/`visibleNavItems` nav filter + the Control Room `FeatureVisibility` card. All seams documented below with file paths + symbols. |
| REVERT-02 | With the flag off, the product is provably byte-identical to today — a `test_revert_byte_identical` gate (CI + live milestone-close) asserts the existing "Describe & run" / "Author & govern" doors and the run surface are unchanged. Revertibility is a tested acceptance gate, not a prose claim (extends the standing D-14 red line). | The gate design (backend pytest + frontend vitest, auto-picked-up by existing CI workflows; a `git show --stat` scope-freeze on the door/run files) is specified in `## Architecture Patterns` → Pattern 4 and `## Validation Architecture`. The frozen-contract files are named. |
</phase_requirements>

## Summary

Phase 181 installs a governed on/off switch for the *entire* v3.6 visual canvas layer **before any canvas code exists**, plus a *tested* proof that flag-off is byte-identical to today. It is ~95% replication of the shipped v3.3 Phase 148 feature-visibility pattern (VIS-01) — the same pattern that already gates `skill_studio`, `model_management`, `workflow_authoring`, `governance_health`. The novel 5% is (a) reconciling "default **off** for everyone including operators" with an audience model whose default-deny is "operators-only", and (b) the `test_revert_byte_identical` gate.

The single most important planner takeaway: **reuse the Phase 148 substrate verbatim, but the canvas gate must return `404` (the `require_operator` byte-identical-404 posture), NOT `403` (the `require_visible` posture).** REVERT byte-identity requires the off state to be indistinguishable from "this feature was never built" — a 403 leaks the route's existence; a 404 does not. This is confirmed by the research PITFALLS.md Pitfall 2 ("New routes must 404/refuse when off — the `require_operator` byte-identical-404 pattern from Phase 146 is the model") `[CITED: .planning/research/PITFALLS.md:46]`.

The second-most-important takeaway: the app has **no React Router** — navigation is a `useState<ActiveView>` switch in `App.tsx` rendered by `ChatLayout.tsx` via an `activeView === "…"` chain. "Every canvas route" therefore means (1) a new `ActiveView` value + its render branch (arriving 182/183), gated by the effective-features map AND a render guard, and (2) the backend canvas API routes (arriving 182+) behind the new 404 gate. In Phase 181 no canvas surface exists yet — 181 ships the flag, the gate, the effective-map wiring, the operator card, and the test scaffold that every later phase inherits.

**Primary recommendation:** Add `visual_workflow_canvas` to the existing `_GOVERNED_FEATURES` map with a new **`"off"` cold-default audience** (an extension of the SEED-115 enum-not-boolean contract), ship a new `require_canvas` dependency that mirrors `require_operator`'s **404** refusal (and bypasses the operator no-op when audience is `"off"`), extend `GET /features` so the map returns `false` for everyone when off, thread the new `GovernedFeature` key through the frontend nav/render/Control-Room machinery, and author `test_revert_byte_identical` as a backend pytest + frontend vitest that ride the existing CI. **No migration** (the flag is a JSONB key, not a column). **No package install.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve canvas on/off (source of truth) | API / Backend (`app_settings.feature_visibility` JSONB via `user_settings.py`) | Database (Postgres `app_settings` singleton row) | The flag is server-authoritative config; per CLAUDE.md settings live in `app_settings`, not env. Reuses the 30s-TTL settings cache. |
| Enforce canvas API routes off (404) | API / Backend (`require_canvas` dependency in `dependencies.py`) | — | The backend runs on the service-role key with NO RLS backstop for these product features — the dependency gate is the sole enforcement authority (Phase 148/146 precedent). |
| Expose caller's effective on/off | API / Backend (`GET /features` in `features.py`) | Frontend Server — n/a (SPA) | One authed read the SPA calls to learn which nav to hide; derived from the SAME seams the gate uses so hide == refuse. |
| Hide canvas nav entry when off | Browser / Client (`useEffectiveFeatures` + `visibleNavItems`, `App.tsx`) | — | Render-only convenience; the backend gate is the security wall. Fail-closed to hidden. |
| Guard canvas view render when off | Browser / Client (`ChatLayout.tsx` `activeView` branch + effective-map guard) | — | Belt-and-suspenders so a stale/programmatic `activeView` can't paint the canvas when off ("gated at every layer"). |
| Operator flips on/off | Browser / Client (`FeatureVisibility.tsx` card in Control Room) → API (`PUT /admin/visibility`) | — | Reuses the shipped operator surface + `set_feature_visibility` atomic JSONB merge (no migration). |
| Prove flag-off byte-identical | CI (pytest `backend/tests/` + vitest `frontend/src/`) + live milestone-close UAT | — | `test_revert_byte_identical` rides the existing `backend-tests.yml` + `frontend-tests.yml`; no new CI job. |

## Standard Stack

**No new libraries.** This phase installs nothing (`@xyflow/react` arrives in Phase 183, `zundo` in 184). It reuses in-repo modules only.

### Core (existing modules reused verbatim)
| Module / Symbol | File | Purpose in this phase |
|-----------------|------|-----------------------|
| `_GOVERNED_FEATURES` (dict) | `backend/app/models/user_settings.py:1081` | The ONE place cold-default audience polarity lives. Add `"visual_workflow_canvas": "off"`. `[VERIFIED: codebase]` |
| `feature_audience()` / `_feature_record()` / `resolve_feature_access()` / `set_feature_visibility()` | `backend/app/models/user_settings.py:1089-1181` | Audience resolver + atomic JSONB writer. Extend the resolver to recognize the `"off"` audience. `[VERIFIED: codebase]` |
| `require_visible(feature)` (403 gate factory) | `backend/app/dependencies.py:517-555` | The template for the new `require_canvas` (404 variant). `[VERIFIED: codebase]` |
| `require_operator` (404 gate) | `backend/app/dependencies.py:391+` | The byte-identical-404 refusal posture the canvas gate must copy. `[VERIFIED: codebase]` |
| `GET /features` endpoint | `backend/app/api/features.py:38-70` | The authed effective-map read. Extend so `visual_workflow_canvas` returns `false` for everyone when off (bypass the operator short-circuit for `"off"`). `[VERIFIED: codebase]` |
| `PUT /admin/visibility` + `GET /admin/visibility` | `backend/app/api/admin.py:949-1026` | The operator write/read; validates feature+audience against code allowlists, records `visibility.set`. Add `visual_workflow_canvas` + the `off`/`on` values to the allowlist. `[VERIFIED: codebase]` |
| `useEffectiveFeatures(userId)` | `frontend/src/hooks/useEffectiveFeatures.ts` | Per-session fail-closed effective-map fetch. Generic — no change needed beyond the new key type. `[VERIFIED: codebase]` |
| `visibleNavItems()` / `NAV_ITEMS` | `frontend/src/lib/nav-items.ts` | Nav filter by feature key. The canvas nav entry (arrives with the view in 183) carries `feature: "visual_workflow_canvas"`. `[VERIFIED: codebase]` |
| `GovernedFeature` / `EffectiveFeatures` types + `getEffectiveFeatures()` + `setFeatureAudience()` | `frontend/src/lib/api.ts:65-73, 3845, 4172` | Add `"visual_workflow_canvas"` to the union; plumb the new audience value. `[VERIFIED: codebase]` |
| `FeatureVisibility` card + `FEATURES` array | `frontend/src/components/admin/FeatureVisibility.tsx:101` | The operator Off/On card. Add a 5th `FeatureDef`. `[VERIFIED: codebase]` |
| `ControlRoomPage` visibility state (`DEFAULT_VISIBILITY`, `handleSetVisibility`) | `frontend/src/components/admin/ControlRoomPage.tsx:188, 538, 801` | The shell that owns the map + server write. Add the key to the seed maps. `[VERIFIED: codebase]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Feature-visibility JSONB key (`_GOVERNED_FEATURES` + `feature_visibility`) | A FLAG-01-style boolean `app_settings` column (`visual_workflow_canvas_enabled`, like `workflows_enabled`/`document_management_enabled`) | Cleaner "off/on" semantics, but a **new column = a migration** — the ROADMAP explicitly forbids a migration this phase ("flag key in `_GOVERNED_FEATURES`; `app_settings.feature_visibility` already exists"). Rejected on the no-migration constraint. `[CITED: .planning/ROADMAP.md:93]` |
| `require_canvas` returns 404 | Reuse `require_visible` (403) as-is | A 403 reveals the canvas route exists → NOT byte-identical to "never built". REVERT demands 404. Rejected. `[CITED: .planning/research/PITFALLS.md:46]` |

**Installation:** none — no packages installed this phase.

## Package Legitimacy Audit

**Not applicable.** Phase 181 installs zero external packages (pure in-repo reuse; no `npm install` / `pip install`). The one net-new milestone dependency, `@xyflow/react` v12, lands in Phase 183 and will be slop-checked there. No registry verification needed this phase.

## Architecture Patterns

### System Architecture Diagram (flag resolution + gating, flag OFF)

```
                         app_settings.feature_visibility (JSONB)
                         { "visual_workflow_canvas": absent/"off" }
                                        │
                         ┌──────────────┴───────────────┐  (30s TTL settings cache)
                         ▼                                ▼
        feature_audience("visual_workflow_canvas")  ─── returns "off" (cold default
                         │                                from _GOVERNED_FEATURES)
        ┌────────────────┼─────────────────────────────────────────────┐
        ▼                ▼                                               ▼
  require_canvas    GET /features                                 PUT /admin/visibility
  (dependency)      (effective map)                               (operator flip: off→on)
        │                │                                               │
   audience=="off"?  visual_workflow_canvas:                     set_feature_visibility(
   → 404 for ALL       false  (operator                            "visual_workflow_canvas",
     (incl operator)   short-circuit BYPASSED                       "everyone")  ── atomic
        │              when "off")                                    JSONB || merge, no mig
        ▼                │                                               │
  canvas API routes    ▼                                               (cache invalidated →
  (arrive 182+)   useEffectiveFeatures (SPA, fail-closed {})            next read = on)
  all 404 when off      │
                        ▼
                 visibleNavItems() drops the canvas nav entry
                        │
                        ▼
                 ChatLayout activeView guard → renders fallback,
                 never the canvas (arrives 182/183)

  FROZEN (never in the phase diff): WorkflowDoorSwitch.tsx (Describe & run / Author &
  govern), WorkflowBuilderPage.tsx, WorkflowsPage.tsx + doRun run launcher,
  PhaseTimeline/PhaseCard run surface, harness engine.
```

### Recommended Project Structure (files this phase touches)
```
backend/app/models/user_settings.py     # + "visual_workflow_canvas":"off" in _GOVERNED_FEATURES; "off" handling in feature_audience
backend/app/dependencies.py             # + require_canvas(feature) — 404 variant of require_visible
backend/app/api/features.py             # extend GET /features: operator-bypass for "off"
backend/app/api/admin.py                # extend PUT/GET /admin/visibility allowlists with the new key + off/on values
backend/tests/test_revert_byte_identical.py   # NEW — the backend half of the gate
backend/tests/test_181_*.py             # unit tests for the "off" audience + require_canvas 404
frontend/src/lib/api.ts                 # + "visual_workflow_canvas" to GovernedFeature union
frontend/src/components/admin/FeatureVisibility.tsx        # + 5th FeatureDef (Off|On card)
frontend/src/components/admin/ControlRoomPage.tsx          # + key in DEFAULT_VISIBILITY / greenlist seeds
frontend/src/.../revertByteIdentical.test.tsx              # NEW — the frontend half of the gate
# (nav entry + ChatLayout render branch + render guard land WITH the canvas view in 182/183)
```

### Pattern 1: The governed-feature key (backend cold default)
**What:** Register the flag as a key in the existing polarity map. This is the ONLY place a cold-read default lives.
**When to use:** Always — the DB seed (migration) is belt-and-suspenders; the code default is authoritative. No migration needed because an unseeded key falls through to this default.
```python
# backend/app/models/user_settings.py  (extend the existing dict at :1081)
# Source: VERIFIED codebase — _GOVERNED_FEATURES currently holds the 4 shipped keys.
_GOVERNED_FEATURES: dict[str, str] = {
    "skill_studio": "operators",
    "model_management": "operators",
    "workflow_authoring": "everyone",
    "governance_health": "everyone",
    "visual_workflow_canvas": "off",   # NEW — default OFF for everyone incl. operators
}
```

### Pattern 2: The 404 canvas gate (mirror `require_operator`, not `require_visible`)
**What:** A dependency factory that 404s canvas routes when off. Bypasses the operator no-op for the `"off"` audience.
**When to use:** Attach to every canvas API route (they arrive 182+). In 181, prove it against a canary/test route.
```python
# backend/app/dependencies.py — a 404 sibling of require_visible (:517).
# Source: VERIFIED — require_operator (:391) returns byte-identical 404; require_visible (:540) returns 403.
def require_canvas():
    """404-when-off gate for the visual_workflow_canvas layer (REVERT-01).

    Unlike require_visible (403), refusal is a byte-identical 404 (the require_operator
    posture) so the off state is indistinguishable from 'route never built' (REVERT-02).
    Bypasses the operator no-op when audience is 'off' — a revert master switch must hide
    from operators too (byte-identical for ALL).
    """
    async def _dep(current_user: dict = Depends(get_current_user), request: Request = None):
        from app.models.user_settings import feature_audience, resolve_feature_access
        audience = feature_audience("visual_workflow_canvas")
        if audience == "off":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)  # hidden from ALL, incl. operators
        if await is_operator(current_user["id"]):
            return
        if audience == "everyone":
            return
        if audience == "role":
            caller_role, caller_groups = await resolve_caller_role(request, current_user)
            if resolve_feature_access("visual_workflow_canvas", caller_role, caller_groups):
                return
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)  # 404, not 403 — REVERT byte-identity
    return _dep
```
> **Design note (surface to discuss-phase):** `feature_audience()` at `:1109` currently returns `"everyone"|"operators"|"role"`. Extend its accepted enum with `"off"` (one line: add `"off"` to the `if aud in (...)` tuple at `:1120`). `resolve_feature_access` (`:1125`) should treat `"off"` → `False`.

### Pattern 3: Effective-map operator-bypass for "off"
**What:** `GET /features` returns `visual_workflow_canvas: false` for everyone (incl. operators) when off, so the nav hides for operators too.
```python
# backend/app/api/features.py — the map comprehension at :58 does `op or feature_audience(f)=="everyone" or ...`.
# Source: VERIFIED codebase. The operator short-circuit (`op or`) MUST be gated so "off" wins over operator.
f: (
    feature_audience(f) != "off"          # NEW guard — "off" hides from operators too
    and (op or feature_audience(f) == "everyone"
         or (feature_audience(f) == "role"
             and resolve_feature_access(f, caller_role, caller_groups)))
)
```

### Pattern 4: `test_revert_byte_identical` — the tested acceptance gate
**What:** Two automated tests (no new CI job — they ride `backend-tests.yml` `pytest tests -q` + `frontend-tests.yml` `npm test`) plus a `git`-scope freeze and a live-close operator UAT row.
**When to use:** Ships in 181; every later phase extends it (each new canvas route adds a "404 when off" assertion).

Operational definition of "byte-identical" (IMPORTANT — a React SPA bundle hash is NOT byte-identical once canvas code lands; define it observably):
> With the flag off, the **observable product** — the nav-item set, the reachable-route set + their responses, the `GET /features` map, and the existing "Describe & run" / "Author & govern" doors + run surface — is identical to the pre-canvas baseline. NOT a bundle-hash comparison.

Backend `backend/tests/test_revert_byte_identical.py` (the primary, cheapest, deterministic half):
```python
# Source: pattern from backend/tests/test_148_visibility_cold_default.py (monkeypatch the settings read).
def test_features_map_hides_canvas_from_everyone_when_off(monkeypatch):
    # flag off (cold default) -> map is False for BOTH an operator and an end user
    ...  # assert get_effective_features(...)["visual_workflow_canvas"] is False for op AND user
def test_require_canvas_404s_when_off(client, monkeypatch):
    # every canvas-gated route (canary in 181; real routes 182+) returns 404 when off
    ...  # assert 404 (byte-identical to an unknown path), NEVER 403
def test_existing_governed_features_unchanged(monkeypatch):
    # the 4 shipped keys resolve exactly as before (no regression to the Phase 148 contract)
    ...
```

Frontend `frontend/src/.../revertByteIdentical.test.tsx`:
```typescript
// Source: pattern from frontend nav-items + FeatureVisibility tests.
test("nav set with canvas OFF equals the pre-canvas nav set", () => {
  // visibleNavItems({..., visual_workflow_canvas: false}) contains NO canvas entry
})
test("ChatLayout render guard returns fallback for a canvas activeView when OFF", () => {
  // a stale/programmatic activeView cannot paint the canvas when the map is false
})
```

Scope-freeze (a `git show --stat` / `files_modified` verification the plan encodes): the phase diff MUST NOT contain `WorkflowDoorSwitch.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, or the harness engine. This is the strongest cheap proof the doors + run surface are unchanged (the project's standard D-14 "confirmed absent from the phase diff" technique).

Live milestone-close: re-run the same pytest+vitest against the live/prod config (flag off) + an operator UAT row confirming the nav + both doors + run surface match today.

### Anti-Patterns to Avoid
- **Using `require_visible` (403) for canvas routes.** A 403 leaks route existence → not byte-identical. Use the 404 `require_canvas`.
- **Leaving the operator short-circuit intact for `"off"`.** Operators would see a phantom canvas nav entry by default → not byte-identical for operators. Gate `"off"` before `op or …`.
- **A boolean column / any migration.** Forbidden this phase; use the JSONB key.
- **Touching the two doors / run surface / `PhaseTimeline` "while you're in there."** The exact residue Pitfall 2 warns about — freeze them.
- **Claiming "byte-identical bundle."** Impossible once canvas code ships; assert observable parity, not a hash.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-authoritative on/off flag | A new bespoke flag table / env var / config file | `_GOVERNED_FEATURES` + `app_settings.feature_visibility` JSONB (Phase 148) | Shipped, cached (30s TTL), atomic-merge writer, operator-editable — CLAUDE.md forbids env for non-secrets. |
| Per-endpoint route gate | An `if flag: raise` sprinkled in each handler | `require_canvas` dependency factory (mirror `require_visible`/`require_operator`) | One dependency a future canvas route cannot forget; consistent 404. |
| Caller learns its own visibility | A bespoke `/canvas/enabled` endpoint | Extend `GET /features` (the effective map) | Derived from the SAME seams the gate uses, so hide == refuse; one round-trip. |
| Nav hide + fail-closed | Ad-hoc `user.isOperator ? …` in the nav | `useEffectiveFeatures` + `visibleNavItems` | Fail-closed `{}`, per-session keyed, already generic over feature keys. |
| Operator on/off UI | A new admin panel | Add a `FeatureDef` to the `FeatureVisibility` card | The Control Room feature-visibility map (Phase 146-148, in the `sketch-findings-agentic-rag` skill) already renders these rows with receipts. |

**Key insight:** Every custom solution here re-implements a shipped, tested, security-reviewed seam. The phase's whole thesis is *repeat the known-good pattern* — the only net-new logic is the `"off"` audience + the 404 refusal.

## Common Pitfalls

### Pitfall 1: The flag-off state is not byte-identical (the revert gate is a lie) — HARD GATE #1
**What goes wrong:** Flag hides the UI but leaves non-revertible residue: a NOT-NULL/altered-column migration, a new required `WorkflowDefinition` field that fails old rows' `model_validate`, an always-mounted route, or an accidental edit to the two doors / `PhaseTimeline` / run surface. "Flag off" becomes a *different* system than v3.5.
**Why it happens:** Flags treated as UI-visibility toggles, not system-state contracts. Shared files ("small improvement while I'm here") silently move the baseline.
**How to avoid:** Additive-nullable-only schema (no migration this phase at all); 404-gate at every layer; make revert a real test; freeze the doors + run surface as contracts (scope-check the diff). `[CITED: .planning/research/PITFALLS.md:36-56]`
**Warning signs:** any migration that isn't `ADD COLUMN … NULL` / a new table; the revert story is prose with no test; a PR touches `PhaseTimeline.tsx`/run surface without a flag guard; old published workflows 500/422 on load.

### Pitfall 2: 403-vs-404 confusion
**What goes wrong:** Copy `require_visible` verbatim → canvas routes 403 when off → the route's existence leaks → not byte-identical to "never built".
**How to avoid:** Return 404 (the `require_operator` posture). Phase 182's SC#3 explicitly demands "byte-identical 404 when the flag is off". `[CITED: .planning/ROADMAP.md:104]`

### Pitfall 3: Operator sees a phantom canvas when off
**What goes wrong:** `require_visible` and `GET /features` both short-circuit `True` for operators. If reused as-is, operators get the canvas nav/routes by default → not byte-identical for operators.
**How to avoid:** Resolve the `"off"` audience BEFORE the operator short-circuit in both `require_canvas` and the `/features` map comprehension.

### Pitfall 4: "byte-identical" over-claimed as a bundle hash
**What goes wrong:** A test asserts the built JS bundle is byte-for-byte identical — impossible once any canvas code lands (bundle hash changes) → the gate is unmaintainable / disabled.
**How to avoid:** Define byte-identity **observably** (nav set + route set + responses + doors/run surface), not as a bundle hash. See Pattern 4.

## Code Examples

### Adding the operator Off|On card (frontend)
```typescript
// frontend/src/components/admin/FeatureVisibility.tsx — append to the FEATURES array (:101).
// Source: VERIFIED codebase (the 4 existing FeatureDef entries).
{
  key: "visual_workflow_canvas",
  name: "Visual workflow canvas",
  desc: "The drag-and-drop visual authoring + live-run canvas. Off = today's product exactly.",
  livesOn: "Workflows",
  glyph: Workflow,
  uiSurface: "The visual canvas authoring door and its run view.",
  refusedApi: "Canvas view + validate/save/canvas routes (existing Describe & run / Author & govern stay open).",
  routePrefixes: "/workflows/validate · canvas routes (flag-gated 404)",
}
```
> **UX note:** for this key present the control as **Off | On** (On ⇒ audience `"everyone"`) rather than the Everyone|Operators|By-role triad — "operator turns the layer on/off" is the requirement. The card frame reuses `FeatureVisibility` verbatim; the segmented control needs an `"off"` position for this key. This is a small "UI hint" surface (ROADMAP: `UI hint: yes`), NOT a G-2 sketch surface (181 does not fire G-2).

### The write path (already exists — no change to the writer)
```python
# backend/app/models/user_settings.py:1155 — set_feature_visibility does an atomic JSONB || merge.
# Operator On flip = set_feature_visibility("visual_workflow_canvas", "everyone"); Off = "off".
# NO migration: the key is merged into the existing feature_visibility column. Source: VERIFIED.
```

## State of the Art

Not applicable — this is an internal-pattern-reuse phase, not a fast-moving external-library domain. The "state of the art" is the project's own shipped Phase 148 (2026-07-18) feature-visibility pattern, which is current and load-bearing (extended, not replaced, by Phase 167's role greenlists). No deprecated approaches in play.

## Runtime State Inventory

Not a rename/refactor/migration phase — greenfield flag scaffold. One near-category worth an explicit note:
- **Stored data:** `app_settings.feature_visibility` (JSONB, singleton `global` row) gains one optional key `visual_workflow_canvas` **only when an operator first flips it**. Until then the key is absent and the code cold-default (`"off"`) governs. No data migration, no backfill. **Nothing else** — no per-user rows, no OS state, no secrets/env vars, no build artifacts affected (verified: no new package, no new column, no env var).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Default off for everyone incl. operators" is the intended semantics (an operator sees NO canvas nav until they flip it on) — i.e., byte-identity must hold for operators too, not just end users. | Summary / Pattern 2-3 / Open Q1 | If the operator is *meant* to preview the canvas by default (audience "operators" as the default), the `"off"` audience + operator-bypass work is unnecessary and a plain `_GOVERNED_FEATURES["visual_workflow_canvas"]="operators"` suffices. This flips the core design — MUST be confirmed at discuss-phase. |
| A2 | The `"off"` audience value (a 4th enum member) is the accepted way to express a global-off within `feature_visibility`, vs. a boolean column. | Pattern 1-2 | If the operator prefers a true boolean master-switch, that reintroduces a migration (contradicts ROADMAP's no-migration line) — a trade the operator must accept explicitly. |
| A3 | The operator control for this key is a simple Off\|On (On ⇒ everyone), not the full Everyone\|Operators\|By-role triad. | Code Examples (UX note) | If per-audience canvas visibility is wanted at launch, the card needs the triad + the "off" position (4 states) — a slightly larger UI change. |
| A4 | The `test_revert_byte_identical` gate rides the existing `backend-tests.yml` + `frontend-tests.yml` (no new CI workflow), and "live milestone-close" = re-run + operator UAT (no separate mechanism). | Pattern 4 / Validation Architecture | If a dedicated repo-root guard script + its own workflow (à la `check-deploy-drift.sh`) is expected, that's more scaffolding — but a `test_*` name signals pytest, so the test-suite home is the natural fit. |

**If any of A1-A4 is wrong, it changes the phase's core mechanism — resolve at `/gsd:discuss-phase 181` before planning.**

## Open Questions

1. **How does "default off" map onto the audience model?** (THE central design decision.)
   - What we know: ROADMAP mandates reuse of `_GOVERNED_FEATURES` + `feature_visibility` (no migration) AND "default off". The audience model's native default-deny is "operators-only" (operators always pass; `require_visible`/`GET /features` short-circuit True for operators).
   - What's unclear: "off" for *everyone incl. operators* (byte-identical for all) vs "off for end-users, operators can preview" (default audience "operators").
   - Recommendation: introduce the `"off"` audience + operator-bypass (Pattern 2-3) so flag-off is byte-identical for ALL — this is the strictest reading of REVERT-02 "provably byte-identical to today" and HARD gate #1. Confirm at discuss-phase.

2. **Operator card UX for this key:** Off|On two-state (recommended) vs the full audience triad. Small surface, `UI hint` not a G-2 sketch. Resolve at discuss-phase.

3. **What actually ships in 181 vs 182/183 for the *route/view* half?** No canvas `ActiveView`/render branch/API route exists until 182/183. Recommendation: 181 ships the flag + `require_canvas` gate (proven against a canary/temporary test route or by unit-testing the dependency) + the effective-map wiring + the operator card + the byte-identical test scaffold; the nav entry + render branch + first real canvas route inherit the gate in 182/183. Confirm the planner scopes the "canary route" seam so the 404 behavior is testable in 181.

## Environment Availability

Skip — no external runtime dependencies. The `test_revert_byte_identical` gate is pure pytest + vitest (no Redis/Supabase/Docker needed for these tests; the existing CI already provisions Redis for the broader suites). CI toolchain confirmed present: `backend-tests.yml` (Python 3.12 + `pytest tests -q`), `frontend-tests.yml` (Node 20 + `npm test`), `deploy-artifacts.yml`. `[VERIFIED: codebase]`

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest (Python 3.12) — `backend/tests/` |
| Frontend framework | vitest — `frontend/src/**/*.test.tsx` |
| Backend config | `backend/tests/conftest.py` (existing) |
| Quick run (backend) | `cd backend && source venv/bin/activate && pytest tests/test_revert_byte_identical.py tests/test_181_*.py -q` |
| Quick run (frontend) | `cd frontend && npm test -- revertByteIdentical` |
| Full suite (CI) | `backend-tests.yml` (`pytest tests -q`) + `frontend-tests.yml` (`npm test`) — the gate auto-runs, no new workflow |

### Phase Requirements → Test Map
| Req ID | Behavior (observable proof the off-switch works) | Test Type | Automated Command | File Exists? |
|--------|--------------------------------------------------|-----------|-------------------|-------------|
| REVERT-01 | With flag off, `GET /features` returns `visual_workflow_canvas: false` for an operator AND an end-user (nav hides for both) | unit (pytest, monkeypatch) | `pytest backend/tests/test_revert_byte_identical.py::test_features_map_hides_canvas_from_everyone_when_off -x` | ❌ Wave 0 |
| REVERT-01 | With flag off, a canvas-gated route returns **404** (never 403) for all callers | integration (pytest + TestClient) | `pytest backend/tests/test_revert_byte_identical.py::test_require_canvas_404s_when_off -x` | ❌ Wave 0 |
| REVERT-01 | Operator flip on (`set_feature_visibility("visual_workflow_canvas","everyone")`) → map True + gate no-op | integration (pytest) | `pytest backend/tests/test_181_flip_on.py -x` | ❌ Wave 0 |
| REVERT-01 | `visibleNavItems({...,visual_workflow_canvas:false})` contains no canvas entry; `=true` reveals it | unit (vitest) | `npm test -- revertByteIdentical` | ❌ Wave 0 |
| REVERT-02 | The 4 shipped governed features resolve unchanged (no regression to the Phase 148 contract) | unit (pytest) | `pytest backend/tests/test_revert_byte_identical.py::test_existing_governed_features_unchanged -x` | ❌ Wave 0 |
| REVERT-02 | ChatLayout render guard returns the fallback (never the canvas) for a canvas `activeView` when off | component (vitest) | `npm test -- revertByteIdentical` | ❌ Wave 0 |
| REVERT-02 | The two doors + run surface are untouched — scope-freeze on the phase diff | manual/CI script | `git show --stat` MUST NOT include `WorkflowDoorSwitch.tsx`/`WorkflowBuilderPage.tsx`/`WorkflowsPage.tsx`/`PhaseTimeline.tsx`/`PhaseCard.tsx` | ❌ Wave 0 (verification step) |
| REVERT-02 | Live milestone-close: same tests green against live config + operator UAT (nav/doors/run surface match today) | manual UAT | milestone-close checklist row | ❌ documented at plan |

### Sampling Rate
- **Per task commit:** the quick backend + frontend commands above (< 30s).
- **Per wave merge:** full `pytest tests -q` + `npm test`.
- **Phase gate:** full suites green before `/gsd:verify-work`; the scope-freeze diff check passes.

### Wave 0 Gaps
- [ ] `backend/tests/test_revert_byte_identical.py` — the map/404/regression asserts (REVERT-01/02). Model after `backend/tests/test_148_visibility_cold_default.py` (monkeypatch `load_app_settings`).
- [ ] `backend/tests/test_181_*.py` — `"off"` audience resolution + `require_canvas` 404 + flip-on.
- [ ] `frontend/src/.../revertByteIdentical.test.tsx` — nav-set parity + ChatLayout render-guard.
- [ ] A canary/test seam so `require_canvas`'s 404 is testable in 181 before real canvas routes exist (Open Q3).
- Framework install: none — pytest + vitest already present.

## Security Domain

> ROADMAP marks Phase 181 **"no threat model (tested-revert gate, not a trust boundary)"**. The full threat model lands with the connector phase (190). This section is intentionally light.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | reuses the shipped auth path (unchanged) |
| V3 Session Management | no | unchanged |
| V4 Access Control | **yes (adjacent)** | The `require_canvas` gate IS a server-side access-control seam — the backend has NO RLS backstop for product features, so the dependency is the sole authority (mirror `require_operator`/`require_visible`). Fail-closed: cold-cache/DB-blip resolves to `"off"` → 404 (never accidentally reveals the canvas). |
| V5 Input Validation | yes (minor) | `PUT /admin/visibility` already validates feature+audience against code allowlists (`admin.py:93`, T-148-03); add `visual_workflow_canvas` + `off`/`on` to that allowlist so a crafted body can't set an arbitrary audience. |
| V6 Cryptography | no | none |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fail-open flag resolution (blip reveals canvas) | Information Disclosure | Cold default `"off"` in `_GOVERNED_FEATURES`; `feature_audience`/`require_canvas` never raise, resolve to `"off"` on error. |
| Operator-bypass leaks canvas to operators when off | Elevation-adjacent / Info Disclosure | Resolve `"off"` BEFORE the operator short-circuit in the gate AND the `/features` map. |
| Arbitrary audience via crafted `PUT /admin/visibility` | Tampering | Extend the existing code allowlist validation (operator-only route, already `require_operator`-gated → 404 to non-operators). |

## Sources

### Primary (HIGH confidence — read directly this session)
- `backend/app/models/user_settings.py` — `_GOVERNED_FEATURES` (:1081), `feature_audience`/`_feature_record`/`resolve_feature_access`/`set_feature_visibility` (:1089-1181), the settings cache + `_build_settings_from_row`.
- `backend/app/dependencies.py` — `require_visible` (:517-555, the 403 template), `require_operator` (:391+, the 404 template).
- `backend/app/api/features.py` — `GET /features` effective-map (:38-70).
- `backend/app/api/admin.py` — `PUT/GET /admin/visibility` + allowlists (:93, :949-1026).
- `frontend/src/lib/nav-items.ts` — `NAV_ITEMS` + `visibleNavItems` (feature-tagged nav filter).
- `frontend/src/hooks/useEffectiveFeatures.ts` — fail-closed per-session map fetch.
- `frontend/src/lib/api.ts` — `GovernedFeature`/`EffectiveFeatures` (:65-73), `getEffectiveFeatures` (:3845), `setFeatureAudience`/`getFeatureVisibility` (:4152-4183).
- `frontend/src/components/admin/FeatureVisibility.tsx` — the operator card + `FEATURES` array (:101).
- `frontend/src/components/admin/ControlRoomPage.tsx` — `DEFAULT_VISIBILITY` (:188) + `handleSetVisibility` (:538) + `<FeatureVisibility>` mount (:801).
- `frontend/src/components/layout/ChatLayout.tsx` — the `activeView === "…"` render chain (:541-648) where a canvas view branch will land.
- `frontend/src/App.tsx` — `ActiveView` union (:87) + `useEffectiveFeatures`/`visibleNavItems` wiring (:149-150).
- `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` + `frontend/src/pages/WorkflowsPage.tsx` / `WorkflowBuilderPage.tsx` — the two doors + run surface (the FROZEN contracts).
- `supabase/migrations/098_feature_visibility.sql` — the JSONB column + idempotent seed (the no-new-migration precedent).
- `backend/tests/test_148_visibility_cold_default.py` — the test pattern to model the byte-identical gate after.
- `.github/workflows/{backend-tests,frontend-tests,deploy-artifacts}.yml` + `scripts/check-deploy-drift.sh` — the CI + drift-guard precedents.
- `.planning/research/PITFALLS.md:36-56` — Pitfall 2 (the load-bearing revert pitfall; confirms the 404 model + additive-nullable + tested-gate design).
- `.planning/ROADMAP.md:79-93` (Phase 181 detail) + `.planning/REQUIREMENTS.md:14-17` (REVERT-01/02).

### Secondary
- `.planning/PROJECT.md` (v3.6 milestone, D-14 red line), `.planning/STATE.md`, `.planning/notes/settings-control-room-boundary.md` (the two-layer operator-allowed-set→user-pref→gated-visibility pattern).

### Tertiary
- None — no WebSearch needed (codebase-reuse phase; `brave_search`/`exa`/`firecrawl` all false; Context7 not required for internal patterns).

## Metadata

**Confidence breakdown:**
- Standard stack (which modules to reuse + exact seams): **HIGH** — every symbol/line read directly this session.
- Architecture (404 gate + effective-map bypass + test design): **HIGH** on the mechanism; **MEDIUM** on the exact "off"-audience shape pending the discuss-phase decision (Open Q1/A1).
- Pitfalls: **HIGH** — corroborated by PITFALLS.md Pitfall 2 verbatim.
- Validation Architecture: **HIGH** — CI + test patterns verified in-repo.

**Graph context:** GSD graph (`.planning/graphs/graph.json`) not queried — direct codebase reads are more authoritative than semantic edges for this precise reuse phase; all seams were located by grep/read.

**Research date:** 2026-07-24
**Valid until:** ~2026-08-23 (30 days — internal patterns are stable; the only volatility is the discuss-phase resolution of the "off"-audience decision).
