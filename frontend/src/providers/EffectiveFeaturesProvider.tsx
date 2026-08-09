/**
 * Phase 183 Plan 03 (CANVAS-01 / D-183-01, D-183-03; operator decision OP-2) —
 * the app-wide effective-features broadcast.
 *
 * ONE shared effective-feature→visible map, broadcast to every descendant, so
 * two consumers must never disagree about whether a governed feature is on. The
 * pattern map's finding F-2 is what this exists to answer: before this module
 * the effective map had exactly ONE call site (`App.tsx`) and exactly ONE
 * consumer (`visibleNavItems`) — it was never prop-drilled and never reached a
 * page. A page that wanted to gate on the map (the Builder's Canvas toggle)
 * would therefore have had to call the hook itself, issuing a SECOND
 * `GET /features` per session and creating a second, independently-resolving
 * map that could disagree with the nav's. Broadcasting the existing one through
 * a context keeps the fetch budget at exactly one per session and keeps the nav
 * and every page reading the identical object.
 *
 * This is deliberately a VALUE-PASSING provider — it does not call the hook
 * itself. The hook needs `user?.id`, which comes from `useAuth()` inside `App`,
 * and a React component cannot consume a context that it itself mounts. Keeping
 * the single `useEffectiveFeatures(user?.id ?? null)` call in `App` and passing
 * that same object down is additive plumbing that leaves every Phase-148
 * invariant untouched:
 *   - the fail-CLOSED `{}` before the first resolve and on any error
 *     (T-148-FAILCLOSED) — this module adds no default and no fallback value;
 *   - the WR-01 `userId`-keyed re-probe (re-fetch on SPA sign-in / same-tab user
 *     switch, cleared on sign-out);
 *   - the reachability of `refetch` from App's `FEATURE_FORBIDDEN_EVENT`
 *     handler — the D-04 graceful-bounce re-sync.
 *
 * NULL CONTEXT IS FAIL-CLOSED. When no provider is mounted (a unit test, an
 * isolated render), the optional accessor returns null, and every consumer MUST
 * read that null exactly the way it reads an empty map: every governed feature
 * HIDDEN. It must never be read as "unknown, so show it" — that would be the one
 * hole this plumbing could open in the Phase-148 vanish convention
 * (`lib/nav-items.ts` — strict `=== true`, never truthy, an absent key hides).
 *
 * RENDER-ONLY, exactly like the map it carries. The security wall is the backend:
 * `require_visible` (Phase 148-05) and `require_canvas`'s pre-auth 404 (Phase 181,
 * D-181-02). Hiding a control here only avoids a dead click; it grants nothing.
 *
 * Structure copied from the shipped `TechnicalNamesProvider` /
 * `lib/citationNav.tsx` idiom: `createContext<T | null>(null)`, a THROWING
 * accessor for writers that are inside the provider by construction, and a
 * NON-THROWING optional accessor for leaves that must still render in isolation.
 * This module holds no state of its own, caches nothing, retries nothing, and
 * fetches nothing.
 */
import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import type { UseEffectiveFeatures } from "@/hooks/useEffectiveFeatures"

const EffectiveFeaturesContext = createContext<UseEffectiveFeatures | null>(null)

/**
 * App-level provider. Pure broadcast: it provides the `value` it is handed and
 * nothing else — no state, no fetch, no default. `App` owns the one hook call
 * and memoizes the object it passes here.
 */
export function EffectiveFeaturesProvider({
  value,
  children,
}: {
  value: UseEffectiveFeatures
  children: ReactNode
}) {
  return (
    <EffectiveFeaturesContext.Provider value={value}>{children}</EffectiveFeaturesContext.Provider>
  )
}

/**
 * The effective-features hook. Throws a clear error outside an
 * `EffectiveFeaturesProvider` — for consumers that are mounted inside the
 * provider by construction (the `useTechnicalNames` / `useCitationNav` writer
 * idiom).
 */
export function useEffectiveFeaturesContext(): UseEffectiveFeatures {
  const ctx = useContext(EffectiveFeaturesContext)
  if (ctx === null) {
    throw new Error(
      "useEffectiveFeaturesContext must be used within an EffectiveFeaturesProvider",
    )
  }
  return ctx
}

/**
 * Non-throwing accessor — returns null outside a provider, so a page or leaf can
 * still render in isolation (unit tests / storybook). A null result is
 * FAIL-CLOSED: treat it exactly like an empty map `{}` and hide every governed
 * feature. Never treat null as "unknown, so show it".
 */
export function useEffectiveFeaturesOptional(): UseEffectiveFeatures | null {
  return useContext(EffectiveFeaturesContext)
}
