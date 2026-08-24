---
phase: 183-read-only-canvas
plan: 03
subsystem: frontend
tags: [react-context, feature-flags, effective-features, provider, fail-closed, canvas]

# Dependency graph
requires:
  - phase: 148-feature-visibility
    provides: "`useEffectiveFeatures` — the fail-closed per-session `GET /features` map (T-148-FAILCLOSED, WR-01 keying, the D-04 refetch bounce) this plan broadcasts without touching"
  - phase: 181-revert-foundation
    provides: "the `visual_workflow_canvas` flag + `revertByteIdentical.test.tsx`'s scope-freeze gate this plan must leave green AND unmodified"
  - phase: 154-plain-language
    provides: "`TechnicalNamesProvider` — the throwing-writer / non-throwing-leaf accessor idiom copied file-for-file"
  - phase: 183-read-only-canvas
    plan: 01
    provides: "the recorded 33-signature `tsc -b` baseline this plan's tsc gate is read against (D-ITEM-183-01)"
provides:
  - "`frontend/src/providers/EffectiveFeaturesProvider.tsx` — ONE context broadcasting the existing effective-features map to any descendant of `ChatLayout`"
  - "`useEffectiveFeaturesOptional()` — the non-throwing leaf accessor plan 183-07's Builder gate reads"
  - "`useEffectiveFeaturesContext()` — the throwing writer accessor"
  - "the NULL-context-is-fail-closed rule, stated in the docblock AND asserted as behaviour (4 tests)"
  - "the mount in `App.tsx`, inside `TechnicalNamesProvider` and outside `CitationNavProvider`"
affects: [183-07, 184-editable-canvas, 185-graded-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "value-passing provider: App owns the one hook call and passes the memoized result down, because a component cannot consume a context it mounts"
    - "a null context is a FAIL-CLOSED read, never an 'unknown so show it' read — asserted, not documented"
    - "`?raw` purity greps must be anchored on the CALL (`\\buseEffect\\(`), not the bare name, when the module legitimately mentions a longer identifier with the same prefix"

key-files:
  created:
    - frontend/src/providers/EffectiveFeaturesProvider.tsx
    - frontend/src/providers/EffectiveFeaturesProvider.test.tsx
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "The provider holds NO state, fetches nothing, caches nothing and supplies no default — it is pure plumbing, so the Phase-148 fail-closed policy is preserved by construction rather than re-implemented"
  - "`loading` had to be aliased to `featuresLoading` in the App destructure — `useAuth()` already owns the identifier `loading` at App scope"
  - "The mount sits INSIDE TechnicalNamesProvider / OUTSIDE CitationNavProvider so both app-wide UI contexts share one home and ChatLayout's whole view switch is inside both"
  - "No `NAV_ITEMS` entry tagged `visual_workflow_canvas` was added (D-183-01); the 181 scope-freeze gate passes unmodified"

patterns-established:
  - "provider unit suites live beside the provider (`src/providers/X.test.tsx`) when the plan names that path, even though `src/providers/__tests__/` also exists"
  - "reference equality (`toBe(value)`) is the assertion that proves two consumers cannot be reading two independently-fetched maps"

requirements-completed: [CANVAS-01]

# Metrics
duration: 22min
completed: 2026-07-25
---

# Phase 183 Plan 03: EffectiveFeaturesProvider Summary

**The existing per-session effective-features map is now broadcast through one context so any page
can gate on `visual_workflow_canvas` without a second `GET /features` — value-passing plumbing that
holds no state, and whose one net-new code path (a null context) is specified and asserted as
fail-closed.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-25T20:15:28Z
- **Completed:** 2026-07-25T20:37:45Z
- **Tasks:** 2 of 2
- **Files modified:** 3 (2 created, 1 modified)

## The accessor contract (verbatim — plan 183-07's Builder gate depends on this)

From `frontend/src/providers/EffectiveFeaturesProvider.tsx`, exactly three exports:

| Symbol | Kind | Signature |
|---|---|---|
| `EffectiveFeaturesProvider` | component | `({ value, children }: { value: UseEffectiveFeatures; children: ReactNode })` |
| `useEffectiveFeaturesContext` | hook | `(): UseEffectiveFeatures` — **throws** `"useEffectiveFeaturesContext must be used within an EffectiveFeaturesProvider"` when the context is null |
| `useEffectiveFeaturesOptional` | hook | `(): UseEffectiveFeatures \| null` — returns `useContext(...)` unchanged |

**THE NULL-CONTEXT RULE (183-07 must implement exactly this):** when no provider is mounted the
optional accessor returns `null`, and a consumer MUST read that null exactly like the empty map `{}`
— every governed feature **hidden**. Never "unknown, so show it". The canonical consumer shape,
copied verbatim from the suite's own fixture:

```tsx
const ctx = useEffectiveFeaturesOptional()
const features = ctx?.features ?? {}
if (features.visual_workflow_canvas === true) { /* render the toggle */ }
```

Strict `=== true`, never truthy — the `lib/nav-items.ts` VANISH semantics. All four states are
pinned by tests: **no provider → hidden**, **`{}` (pre-resolve / error) → hidden**, **explicit
`false` → hidden**, **strict `true` → shown**.

## Accomplishments

- **The fetch budget stays at one per session.** `grep -c "useEffectiveFeatures("
  frontend/src/App.tsx` is **1** — still the only call site in the whole tree. The pattern map's F-2
  problem (a page-level consumer would have issued a second `GET /features`) is closed without
  adding a request.
- **Every Phase-148 invariant is preserved by construction, not by re-implementation.**
  `frontend/src/hooks/useEffectiveFeatures.ts` ends the plan **byte-unchanged** (`git diff --stat`
  empty), so T-148-FAILCLOSED, the WR-01 `userId` re-probe and the D-04 `refetch` bounce are
  literally the same code.
- **The one new code path this plan creates is closed.** A null context was the only way the
  plumbing could open a hole in the vanish convention; it is specified in the docblock and asserted
  four ways.
- **The 181 acceptance gate is green and untouched.** `revertByteIdentical.test.tsx` was not edited
  (`git diff --name-only` empty) and its `no NAV_ITEMS entry is tagged visual_workflow_canvas`
  scope-freeze test passes — D-183-01 released the nav-entry promise, so none was added.
- **`visibleNavItems` still receives the identical map object.** The `:150` line is byte-unchanged
  and reads `effectiveFeatures` directly, not a re-derived copy.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | Create `EffectiveFeaturesProvider` and its accessors | `2b786a76` | feat |
| 2 | Mount the provider in `App.tsx` without perturbing the 148 invariants | `a0496a7a` | feat |

## Files Created/Modified

- `frontend/src/providers/EffectiveFeaturesProvider.tsx` — **~100 lines**, net-new. Docblock
  (F-2 rationale, the value-passing justification, the three preserved 148 invariants, the
  null-context fail-closed rule, the render-only caveat), `createContext<UseEffectiveFeatures |
  null>(null)`, the provider, the throwing accessor, the optional accessor. No local state, no
  effect, no ref, no cache, no default.
- `frontend/src/providers/EffectiveFeaturesProvider.test.tsx` — **14 tests** in 4 describe blocks:
  accessor contract (2), one-shared-object / reference equality (3), the null-context fail-closed
  matrix (4), and the `?raw` purity block (5).
- `frontend/src/App.tsx` — **+25 / −2**. Exactly four things: `useMemo` added to the React import,
  the provider import, `loading: featuresLoading` added to the `:149` destructure plus one
  `useMemo`, and the two JSX provider lines. The `FEATURE_FORBIDDEN_EVENT` effect body — including
  its `detail?.status !== 403 || detail?.message !== VISIBILITY_REFUSAL` guard and its
  `refetchFeatures()` call — is byte-unchanged.

## Decisions Made

- **Value-passing, not self-fetching.** The hook needs `user?.id` from `useAuth()`, which is called
  inside `App`, and a component cannot consume a context it mounts. Passing the existing object down
  is the only shape that keeps the fetch budget at one *and* guarantees the nav and a page read the
  same object. Recorded in the docblock so a future reader does not "improve" it into a
  self-fetching provider.
- **Mount placement.** Immediately inside `<TechnicalNamesProvider>`, outside `<CitationNavProvider>`
  — both app-wide UI contexts now share one home, and ChatLayout's view switch (where
  `activeView === "workflows"` renders the Builder) is inside both.
- **Memoized on the three fields.** `useMemo(() => ({ features, loading, refetch }), [...])`, the
  `TechnicalNamesProvider.tsx:75-78` idiom, so descendants do not re-render on every App render.
- **The test file lives beside the provider**, at the path the plan's artifact contract names
  (`src/providers/EffectiveFeaturesProvider.test.tsx`), even though `src/providers/__tests__/` also
  exists. Both shapes are already in the tree (`OrgProvider.test.tsx` and `StreamsProvider.test.tsx`
  sit beside their providers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `loading` collides with `useAuth()`'s `loading` at App scope**

- **Found during:** Task 2
- **Issue:** The plan says *"add `loading` to that same destructure. Pass `value={{ features:
  effectiveFeatures, loading, refetch: refetchFeatures }}`"*. `App.tsx:90` already destructures
  `loading` from `useAuth()`, and that identifier is load-bearing — it drives the bootstrap spinner
  at `:188` (`if (loading || setupStatus === null)`). A bare `loading` would have been a redeclaration
  (a hard TS/ESLint error), and shadowing it would have been far worse: the auth spinner would have
  started keying off the features fetch.
- **Fix:** aliased in the same destructure — `loading: featuresLoading` — and passed as
  `loading: featuresLoading` in the memoized value. The broadcast contract is unchanged; the
  consumer still reads `.loading`.
- **Files modified:** `frontend/src/App.tsx`
- **Verification:** `npx tsc -b` adds no signature; `SetupWizard.test.tsx` (the only suite that
  renders `<App />`) is green, which exercises the bootstrap-spinner branch.
- **Committed in:** `a0496a7a` (Task 2 commit)

**2. [Rule 1 - Bug] The purity grep `/useEffect/` matched the module's own subject matter**

- **Found during:** Task 1 (first run — 13 passed / 1 failed)
- **Issue:** The "declares no effect" guard was written as a bare `not.toMatch(/useEffect/)`, which
  matches the **prefix** of `useEffectiveFeatures` — a name the module legitimately carries (the type
  import and the docblock's description of the App call site). A guard that can only pass by making
  the docblock lie is a broken guard. This is the same class of collision plan 183-02 hit with
  `grounding_mode`, arriving from the opposite direction.
- **Fix:** anchored the guard on the CALL — `not.toMatch(/\buseEffect\(/)` — plus a matching
  `/\buseRef\(/`, with a comment naming the collision so it is not "simplified" back.
- **Files modified:** `frontend/src/providers/EffectiveFeaturesProvider.test.tsx`
- **Verification:** `npx vitest run src/providers/EffectiveFeaturesProvider.test.tsx` → **exit 0**,
  14 passed. The guard still fires: the module contains no `useEffect(`, no `useRef(`, no `useState`.
- **Committed in:** `2b786a76` (Task 1 commit)

### Acceptance criteria executed with a stated adjustment

**`npx tsc -b` exits 0 → executed as the plan-01 differential.** Both tasks name `tsc -b` exiting 0.
Per **D-ITEM-183-01** that is unachievable at baseline (`develop` is red with 33 pre-existing
signatures across ~20 unrelated files, and `npm run build` is `tsc -b && vite build`). Executed as
the inherited differential: after both tasks the signature count is **still exactly 33**, and
`grep -cE "src/App\.tsx|EffectiveFeaturesProvider"` over the full `tsc -b` output is **0** — this
plan added zero type errors. `npx vite build` remains a hard gate and **exits 0**.

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 1 — both inside this plan's own files) +
1 acceptance criterion executed with a stated, evidenced adjustment. No file outside the plan's
`files_modified` list was touched.

## Issues Encountered

- **An identifier collision the plan could not have seen from the excerpt.** The plan quoted
  `App.tsx:149-150` in isolation, where `loading` looks free. Reading the whole component first is
  what caught it before it became a shadowed-spinner bug rather than a compile error.
- **A `?raw` purity guard can shadow its own module's vocabulary.** Second occurrence in this phase
  (183-02's `grounding_mode` was the first). Standing rule for 183-04/05/06: anchor purity greps on
  a *call* or a *declaration*, not on a bare identifier that is a prefix of something legitimate.
- **The full-suite failure count is noisy under load.** `npm test` reported 39 failed / 1894 passed
  of 1933 in a 305-second run. Every failing name lives in a suite that neither imports `App` nor
  references the effective-features map (see Verification Results); `PublishGauntlet.test.tsx`'s 12
  failures are **all green when the suite runs in isolation**, i.e. parallel-load flake, and
  `ChatHistoryColumn` / `StreamsProvider` / `useMessages` / `soulData` are the documented rot
  (SEED-056 + the Phase-127 glyph RED that 183-04 fixes).

## Verification Results

| Gate | Result |
|---|---|
| `npx vitest run src/providers/EffectiveFeaturesProvider.test.tsx` | **exit 0**, 14 passed ✅ |
| `npx vitest run src/components/admin/revertByteIdentical.test.tsx src/providers/EffectiveFeaturesProvider.test.tsx` | **exit 0**, 21 passed ✅ (incl. the scope-freeze test) |
| `npx vite build` | **exit 0** ✅ |
| `npx tsc -b` | exit 2, **33 signatures — identical to the plan-01 baseline, 0 new, 0 from our files** ⚠️ D-ITEM-183-01 |
| `grep -c "getEffectiveFeatures" …/EffectiveFeaturesProvider.tsx` | **0** ✅ |
| `grep -c "useState" …/EffectiveFeaturesProvider.tsx` | **0** ✅ |
| `grep -c "@/lib/api" …/EffectiveFeaturesProvider.tsx` | **0** ✅ |
| `grep -c "useEffectiveFeatures(" frontend/src/App.tsx` | **1** ✅ (exactly one call site) |
| `grep -c "visibleNavItems(effectiveFeatures)" frontend/src/App.tsx` | **1** ✅ |
| `grep -c "EffectiveFeaturesProvider" frontend/src/App.tsx` | **3** ✅ (import + open + close) |
| `grep -c "visual_workflow_canvas" frontend/src/lib/nav-items.ts` | **0** ✅ (D-183-01) |
| `git diff --stat frontend/src/hooks/useEffectiveFeatures.ts` | **empty** ✅ byte-unchanged |
| `git diff --name-only …/revertByteIdentical.test.tsx` | **empty** ✅ untouched (183-07 corrects its stale prose) |
| `git diff --name-only frontend/src/lib/nav-items.ts` | **empty** ✅ |
| `git diff frontend/src/App.tsx` scope | import block + the `:149` destructure + one `useMemo` + the two JSX provider lines only; the `FEATURE_FORBIDDEN_EVENT` effect body unchanged ✅ |
| `npm test` (full suite) | 39 failed / 1894 passed of **1933** — **no failing name in any suite that imports `App` or the features map**; count grew from the 1877 plan-01 baseline (+56 from plans 01-03) ✅ |
| `SetupWizard.test.tsx` (the ONLY suite that renders `<App />`) | **green in isolation** ✅ — the direct proof the App edit did not perturb the render path |
| `NavPanel.test.tsx` + `PublishGauntlet.test.tsx` in isolation | **green** ✅ (PublishGauntlet's full-suite failures are parallel-load flake) |

## Threat Model Compliance

- **T-183-02 (EoP — reading the client map as a security boundary):** accepted as planned and
  unchanged. This plan adds no route, no gated data path and no authz decision. The docblock
  re-states that the hide is RENDER-ONLY and that `require_visible` (148-05) plus `require_canvas`'s
  pre-auth 404 (181, D-181-02) are the authority.
- **T-183-03 (Info disclosure — a governed feature flashing pre-resolve or on a blip):** mitigated as
  planned. The hook is byte-unchanged so the fail-closed `{}` policy is literally the same code, the
  provider adds no default, and the ONE new path (a null context) is specified as fail-closed and
  pinned by 4 assertions.
- **T-183-04 (Spoofing — a stale prior user's map across a same-tab switch):** accepted (inherited)
  and evidenced. `useEffectiveFeatures.ts` ends byte-unchanged, so the WR-01 `userId` keying and the
  sign-out clear are untouched.
- **ASVS conclusion INTACT.** `git status --porcelain backend/` is empty for this plan — frontend
  only. The "if any task grows a backend touch, this conclusion is VOID" condition did **not**
  trigger.

## Known Stubs

None. Every export is implemented and exercised by a green assertion. The provider currently has no
page-level consumer **by design** — plan 183-07 is the plan that lands the Builder's Canvas toggle
and reads `useEffectiveFeaturesOptional()`. The nav path continues to read `effectiveFeatures`
directly, exactly as before.

## User Setup Required

None — no dependency, no env var, no migration, no cloud parity owed.

## Next Phase Readiness

**Ready.** Hand-offs, explicitly:

- **183-07 (the Builder toggle)** — import `useEffectiveFeaturesOptional` from
  `@/providers/EffectiveFeaturesProvider`. Read it as `ctx?.features ?? {}` and require strict
  `=== true`. **Do NOT** call `useEffectiveFeatures()` in the page — that reintroduces the second
  `GET /features` this plan exists to prevent, and the `grep -c "useEffectiveFeatures("
  frontend/src/App.tsx == 1` check should be extended to the whole `frontend/src` tree as the
  tripwire. `revertByteIdentical.test.tsx`'s stale prose at `:9` and `:58` ("lands WITH the view in
  183") is still uncorrected and is 183-07's to fix — its `expect(...)` lines must stay untouched.
- **184 / 185** — the same context is the seam for any further governed-feature gate; add consumers,
  never a second hook call.
- **All 183 plans** — `tsc -b` remains a differential against 33 (D-ITEM-183-01); `vite build`
  remains a hard exit-0 gate. Anchor `?raw` purity greps on a call/declaration, not a bare
  identifier.

No blockers.

## Self-Check: PASSED

Files verified present on disk:

- FOUND: `frontend/src/providers/EffectiveFeaturesProvider.tsx`
- FOUND: `frontend/src/providers/EffectiveFeaturesProvider.test.tsx`
- FOUND: `frontend/src/App.tsx` (contains `EffectiveFeaturesProvider` ×3)

Commits verified in `git log`:

- FOUND: `2b786a76` — feat(183-03): add EffectiveFeaturesProvider — one broadcast, no second fetch
- FOUND: `a0496a7a` — feat(183-03): mount EffectiveFeaturesProvider around the authed subtree

---
*Phase: 183-read-only-canvas*
*Completed: 2026-07-25*
