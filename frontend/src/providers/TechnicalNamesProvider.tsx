/**
 * Phase 154 Plan 01 (LANG-01 / D-01, D-01a) — the app-wide reveal-state context.
 *
 * The SPINE of the plain-language layer: ONE shared boolean ("show technical
 * names") broadcast to every consumer — the Settings toggle, the admin Control
 * Room (D-01a), and every relabeled surface via `usePlainLabel`. Because the
 * value lives in ONE React context, flipping it anywhere flips it everywhere;
 * two toggles can never disagree (the cardinal G-6 "two toggles disagree"
 * failure this phase exists to prevent).
 *
 * This composes two shipped in-repo patterns:
 *   - SHARING — modeled on `frontend/src/lib/citationNav.tsx`:
 *     `createContext<T | null>(null)` + a throwing `useTechnicalNames()` (for
 *     writers) + a non-throwing `useTechnicalNamesOptional()` (for leaf reads).
 *     This is NOT a bare per-consumer hook — copying `useTheme.ts` verbatim
 *     would give each consumer its OWN useState and the toggles would drift.
 *   - PERSISTENCE — modeled on `frontend/src/hooks/useTheme.ts`: a `typeof
 *     window` guard + localStorage get/set. The `matchMedia` line is DROPPED —
 *     the default is a hard `false` (plain), not a system-derived value (D-01).
 *
 * D-05: this is a display-only UI preference. The stored boolean is not a
 * secret or a session token; technical field/enum names are not secret, so the
 * toggle is available to every user (no operator/VIS-01 gate).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"

/** localStorage key — a per-device UI preference. Chosen to not collide with
 *  `useTheme`'s "theme" key. */
const STORAGE_KEY = "technical-names"

export interface TechnicalNamesValue {
  /** True → show technical vocabulary; false → plain language (the default). */
  showTechnical: boolean
  /** Flip the shared value. */
  toggle: () => void
  /** Set the shared value directly. */
  setShowTechnical: (v: boolean) => void
}

/**
 * Read the initial reveal state from localStorage. Guards `typeof window` for
 * SSR/first-paint safety (useTheme model). Default OFF (plain) — anything other
 * than the literal "true" resolves to false, so an empty/absent key is plain.
 */
function getInitial(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) === "true"
}

const TechnicalNamesContext = createContext<TechnicalNamesValue | null>(null)

/**
 * App-level provider. Owns the single `showTechnical` state, persists it to
 * localStorage on every change, and memoizes the context value so consumers
 * only re-render when the boolean actually changes.
 */
export function TechnicalNamesProvider({ children }: { children: ReactNode }) {
  const [showTechnical, setShowTechnical] = useState<boolean>(getInitial)

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, showTechnical ? "true" : "false")
  }, [showTechnical])

  const toggle = useCallback(() => setShowTechnical((v) => !v), [])

  const value = useMemo<TechnicalNamesValue>(
    () => ({ showTechnical, toggle, setShowTechnical }),
    [showTechnical, toggle],
  )

  return (
    <TechnicalNamesContext.Provider value={value}>{children}</TechnicalNamesContext.Provider>
  )
}

/**
 * The reveal-state hook. Throws a clear error outside a `TechnicalNamesProvider`
 * — used by WRITERS (the Settings toggle, the Control Room) that must be mounted
 * inside the provider by construction (citationNav idiom).
 */
export function useTechnicalNames(): TechnicalNamesValue {
  const ctx = useContext(TechnicalNamesContext)
  if (ctx === null) {
    throw new Error("useTechnicalNames must be used within a TechnicalNamesProvider")
  }
  return ctx
}

/**
 * Non-throwing accessor — returns null outside a provider. Used by leaf relabels
 * (via `usePlainLabel`) so a component can still render in isolation (unit tests
 * / storybook) where the provider is not mounted; a null context falls back to
 * plain language.
 */
export function useTechnicalNamesOptional(): TechnicalNamesValue | null {
  return useContext(TechnicalNamesContext)
}
