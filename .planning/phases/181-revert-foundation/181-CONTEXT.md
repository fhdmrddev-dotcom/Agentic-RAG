# Phase 181: Revert Foundation - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning
**Source:** plan-phase inline decisions (discuss-phase skipped; 3 research Open Questions resolved by operator during plan-phase)

<domain>
## Phase Boundary

Phase 181 installs a governed, provably-tested on/off switch for the ENTIRE v3.6 visual
canvas layer **before any canvas code exists** — operator HARD gate #1 (preserve-v1/revert).
It is ~95% verbatim reuse of the shipped v3.3 Phase 148 feature-visibility pattern
(`_GOVERNED_FEATURES` + `app_settings.feature_visibility` JSONB + a route gate + `GET /features`
effective map + `useEffectiveFeatures`/`visibleNavItems` nav filter + the Control Room
`FeatureVisibility` card). The novel 5% is (a) a "off-for-everyone" audience and (b) the
`test_revert_byte_identical` acceptance gate.

**In scope (181):** the `visual_workflow_canvas` flag (default off), the `require_canvas`
404 gate, the effective-map wiring, the operator Off|On card, a temporary canary route to
prove the 404 end-to-end, and the `test_revert_byte_identical` test scaffold every later
phase inherits.

**Out of scope (181):** the real canvas nav entry, `ActiveView` render branch, and real
canvas API routes — those arrive in 182/183 and inherit this gate. No migration. No new package.
No threat model (tested-revert gate, not a trust boundary — full threat model lands with the
connector phase 190).
</domain>

<decisions>
## Implementation Decisions

### D-181-01 — Flag-off is byte-identical for EVERYONE, including operators
The canvas is hidden from operators too (not just end-users) until an operator explicitly
flips it on. Implement via a new **`"off"` audience** value in the feature-visibility model
(an extension of the SEED-115 enum-not-boolean contract). Both the `require_canvas` gate and
the `GET /features` effective-map comprehension MUST resolve `"off"` → hidden **BEFORE** the
existing operator short-circuit (`op or …`) — otherwise operators see a phantom canvas nav by
default and flag-off is not byte-identical for them. `feature_audience()` accepts `"off"`;
`resolve_feature_access("...","off",...)` → `False`. Strictest reading of REVERT-02
"provably byte-identical to today" / HARD gate #1. (Resolves research Open Q1 / Assumption A1.)

### D-181-02 — Canvas routes refuse with 404, never 403
`require_canvas` mirrors `require_operator`'s **byte-identical 404** posture, NOT
`require_visible`'s 403. A 403 leaks that the canvas route exists → not indistinguishable from
"never built". Fail-closed: any cold-cache / DB-blip resolves to `"off"` → 404 (never
accidentally reveals the canvas). (Research Pattern 2 / Pitfall 2, `[CITED:
.planning/research/PITFALLS.md:46]`; Phase 182 SC#3 also demands the 404.)

### D-181-03 — Operator control is a simple Off | On toggle
For the `visual_workflow_canvas` key the operator card presents **Off | On** (On ⇒ audience
`"everyone"`), NOT the full Everyone|Operators|By-role triad. Reuses the `FeatureVisibility`
card frame verbatim with an added `"off"` position for this key. (Resolves research Open Q2 /
Assumption A3. UI hint surface, NOT a G-2 sketch — 181 does not fire G-2.)

### D-181-04 — Prove the 404 gate in 181 with a temporary canary route
Because no real canvas route exists until 182/183, mount ONE throwaway canvas-gated route
(e.g. `GET /canvas/ping`) behind `require_canvas` so `test_revert_byte_identical` can assert
the 404-when-off behavior end-to-end via TestClient NOW. The canary is removed or repurposed
when the first real canvas route lands in 182/183. (Resolves research Open Q3.)

### D-181-05 — No migration; JSONB key + code cold-default only
The flag is a key in `_GOVERNED_FEATURES` (`"visual_workflow_canvas": "off"`), authoritative
as the cold-read default; `app_settings.feature_visibility` (JSONB, from mig 098) already
exists and gains the key only when an operator first flips it (atomic `||` merge via
`set_feature_visibility`). **No new column, no migration, no backfill this phase.** Any schema
LATER phases add must be additive-nullable-only, and every new route flag/404-gated at every
layer, so the off-switch can never leave a non-revertible remnant. (ROADMAP SC#4 / Pitfall 1.)

### D-181-06 — `test_revert_byte_identical` is a real, CI-run acceptance gate
A backend pytest (`backend/tests/test_revert_byte_identical.py`) + frontend vitest
(`revertByteIdentical.test.tsx`) that ride the EXISTING `backend-tests.yml` + `frontend-tests.yml`
CI (no new workflow), asserting flag-off observable parity: `GET /features` returns
`visual_workflow_canvas: false` for operator AND user; a canvas-gated route 404s (never 403);
the 4 shipped governed features resolve unchanged (no Phase-148 regression); `visibleNavItems`
with the flag false contains no canvas entry; the ChatLayout render guard returns the fallback
for a canvas `activeView` when off. Re-run at live milestone-close + an operator UAT row.
(Research Pattern 4 / Validation Architecture.)

### D-181-07 — "Byte-identical" is defined OBSERVABLY, not as a bundle hash
Byte-identity = the nav-item set + the reachable-route set and their responses + the
`GET /features` map + the existing "Describe & run" / "Author & govern" doors + run surface are
identical to today. NOT a built-JS-bundle hash comparison (impossible once any canvas code
ships). (Research Pitfall 4.)

### D-181-08 — Scope-freeze the doors and run surface (diff contract)
The phase diff MUST NOT touch `WorkflowDoorSwitch.tsx` (the two authoring doors),
`WorkflowBuilderPage.tsx`, `WorkflowsPage.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, or the
harness engine. A `git show --stat` scope-check that these files are absent from the phase diff
is the strongest cheap proof the doors + run surface are unchanged (the project's standard D-14
"confirmed absent from the phase diff" technique).

### Claude's Discretion
- Exact test file split (one `test_revert_byte_identical.py` vs additional `test_181_*.py`
  unit files) and test-helper structure.
- Exact canary route path/shape and where it is registered (must be behind `require_canvas`).
- Frontend `FeatureDef` copy (name/desc/glyph) for the new card row.
- Wave/plan decomposition (backend gate vs frontend wiring vs test scaffold).
- Whether the render-guard belt-and-suspenders lands as a small helper now or with the first
  real `ActiveView` in 182 (the gate + effective-map + card + canary + tests are the 181 floor).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The pattern to replicate (backend)
- `backend/app/models/user_settings.py` — `_GOVERNED_FEATURES` (:1081), `feature_audience` /
  `resolve_feature_access` / `set_feature_visibility` (:1089-1181). The ONE place cold-default
  polarity lives; extend the audience enum with `"off"`.
- `backend/app/dependencies.py` — `require_visible` (:517-555, the 403 template) and
  `require_operator` (:391+, the 404 template `require_canvas` must mirror).
- `backend/app/api/features.py` — `GET /features` effective map (:38-70); gate `"off"` before
  the operator short-circuit.
- `backend/app/api/admin.py` — `PUT/GET /admin/visibility` + allowlists (:93, :949-1026); add
  the new key + `off`/`on` values to the code allowlist.
- `backend/tests/test_148_visibility_cold_default.py` — the test pattern to model
  `test_revert_byte_identical` after (monkeypatch the settings read).

### The pattern to replicate (frontend)
- `frontend/src/lib/nav-items.ts` — `NAV_ITEMS` + `visibleNavItems` (feature-tagged nav filter).
- `frontend/src/hooks/useEffectiveFeatures.ts` — fail-closed per-session effective-map fetch.
- `frontend/src/lib/api.ts` — `GovernedFeature` / `EffectiveFeatures` types (:65-73),
  `getEffectiveFeatures` (:3845), `setFeatureAudience` / `getFeatureVisibility` (:4152-4183).
- `frontend/src/components/admin/FeatureVisibility.tsx` — the operator card + `FEATURES` array (:101).
- `frontend/src/components/admin/ControlRoomPage.tsx` — `DEFAULT_VISIBILITY` (:188),
  `handleSetVisibility` (:538), `<FeatureVisibility>` mount (:801).
- `frontend/src/components/layout/ChatLayout.tsx` — the `activeView === "…"` render chain
  (:541-648) where a canvas branch will land in 182/183 (render-guard target).
- `frontend/src/App.tsx` — `ActiveView` union (:87) + `useEffectiveFeatures`/`visibleNavItems`
  wiring (:149-150).

### FROZEN contracts (must be ABSENT from the phase diff — D-181-08)
- `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (the two authoring doors),
  `frontend/src/pages/WorkflowBuilderPage.tsx`, `frontend/src/pages/WorkflowsPage.tsx`,
  `frontend/src/.../PhaseTimeline.tsx`, `.../PhaseCard.tsx`, the harness engine.

### CI / no-migration precedents
- `supabase/migrations/098_feature_visibility.sql` — the JSONB column + idempotent seed (the
  no-new-migration precedent).
- `.github/workflows/{backend-tests,frontend-tests}.yml` — the CI the gate rides (no new job).
- `.planning/research/PITFALLS.md:36-56` — Pitfall 2 (the load-bearing revert pitfall).
- `.planning/ROADMAP.md` (Phase 181 section) + `.planning/REQUIREMENTS.md` (REVERT-01/02).
</canonical_refs>

<specifics>
## Specific Ideas

- Register `"visual_workflow_canvas": "off"` in `_GOVERNED_FEATURES` — the authoritative
  cold-default; an unseeded key falls through to it, which is why no migration is needed.
- `require_canvas` bypasses the operator no-op for `"off"` (D-181-01) and 404s (D-181-02).
- `GET /features` comprehension: add `feature_audience(f) != "off"` guard BEFORE `op or …`.
- Operator On flip ⇒ `set_feature_visibility("visual_workflow_canvas", "everyone")`; Off ⇒ `"off"`.
- Canary route (D-181-04): a temporary `require_canvas`-gated endpoint so the 404 is testable now.
</specifics>

<deferred>
## Deferred Ideas

- Real canvas nav entry + `ActiveView` render branch + first real canvas API route → Phase 182/183
  (inherit this gate; the canary route is removed/repurposed then).
- Per-audience (Everyone|Operators|By-role) canvas visibility at launch — deferred; 181 ships
  Off|On only (D-181-02).
- Full connector threat model → Phase 190.
</deferred>

---

*Phase: 181-revert-foundation*
*Context gathered: 2026-07-24 via plan-phase inline decisions (research Open Q1-Q3 resolved)*
