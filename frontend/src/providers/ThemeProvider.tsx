/**
 * Phase 200-06 (`BUG-260813-01`, `200-CHECKLIST.md` §3 `BC-MNR-03`) — ONE theme state.
 *
 * THE BUG, AND WHY THE OBVIOUS FIX IS THE WRONG ONE. `WorkflowCanvas.tsx` hardcoded
 * `colorMode="dark"`, so the canvas stayed dark while the rest of the app went light. The
 * one-line patch — `const { theme } = useTheme()` inside the canvas — is AVAILABLE and it
 * is WRONG, which is why this file exists instead:
 *
 *   `hooks/useTheme.ts` was a BARE PER-CONSUMER HOOK holding its own `useState`, with
 *   exactly ONE consumer in the whole tree (`ChatLayout.tsx:111`) and no provider anywhere.
 *   A second call site would have created a SECOND `useState`, each initialised from
 *   localStorage at its own mount time, each running an effect that WRITES localStorage and
 *   toggles the root class — and **neither re-rendering the other**. The canvas would have
 *   read the right value once and then ignored every toggle the person made. It would look
 *   fixed on first load and go stale on the exact gesture that exposed the defect.
 *
 * `TechnicalNamesProvider.tsx:15-16` says this outright about this very module: *"This is
 * NOT a bare per-consumer hook — copying `useTheme.ts` verbatim would give each consumer
 * its OWN useState and the toggles would drift."* This file is that sentence acted on.
 *
 * ⚠ `colorMode="system"` IS ALSO WRONG, and is recorded so it is not re-proposed: it reads
 * the OPERATING SYSTEM's preference, while this app's theme is a manual class toggle
 * persisted to localStorage. A person who picked light on a dark-preferring machine would
 * still get a dark canvas.
 *
 * ── THE SHAPE, COPIED FROM THE SHIPPED PRECEDENT ────────────────────────────────
 *
 * `providers/TechnicalNamesProvider.tsx` (which itself copies `lib/citationNav.tsx`):
 * `createContext<T | null>(null)`, a THROWING `useTheme()` for writers, and a NON-THROWING
 * `useThemeOptional()` for leaf reads.
 *
 * ⚠ **THE NON-THROWING ACCESSOR IS REQUIRED, NOT A CONVENIENCE.** `WorkflowCanvas`'s four
 * suites mount it with NO provider at all, as does every unit test of every leaf that will
 * ever want to know the theme. A throwing hook in the canvas would have reddened all four
 * the moment the fix landed, and the reflex fix for that is to wrap the tests — which
 * quietly makes the provider a test fixture rather than a production invariant.
 *
 * ── PERSISTENCE: MOVED VERBATIM, NOT REWRITTEN ──────────────────────────────────
 *
 * The initial read, the `dark` class toggle on `document.documentElement` and the
 * localStorage write are the SAME three behaviours `hooks/useTheme.ts` shipped, under the
 * SAME `"theme"` key, so a person's stored preference survives this change with no
 * migration. The `typeof window` guard is kept for the same first-paint reason.
 *
 * ⚠ **THE ROOT CLASS IS WHAT MAKES THE CANVAS FIX WORK, AND THE MECHANISM IS A
 * COINCIDENCE WORTH KNOWING.** React Flow puts its colour-mode class — the literal string
 * `"dark"` — on its own wrapper (`@xyflow/react/dist/esm/index.js:3736`, via
 * `useColorModeClass` `:334-349`), and `tailwind.config.js` is `darkMode: ["class"]`, which
 * Tailwind scopes by the NEAREST ANCESTOR carrying the class rather than by `<html>` alone.
 * So the one hardcoded prop wrapped the entire canvas subtree in a `.dark` ancestor and
 * darkened the plane, the dot grid, the controls, the attribution AND our own node cards —
 * which hardcode nothing and use theme tokens throughout. The single-prop fix is therefore
 * COMPLETE, but its completeness depends on two unrelated systems happening to agree on the
 * spelling `dark`, and nothing in this repository enforces that agreement. `200-06`'s fence
 * therefore asserts BOTH halves in light mode — the plane AND a node card — because a fence
 * that checked only the prop would pass green in exactly the scenario where they diverge.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

/** The two themes this app has. `"system"` is deliberately not one of them — see above. */
export type Theme = "light" | "dark"

/** The localStorage key, UNCHANGED from `hooks/useTheme.ts` so no preference is lost. */
const STORAGE_KEY = "theme"

export interface ThemeValue {
  /** The single shared theme. */
  theme: Theme
  /** Flip it. */
  toggleTheme: () => void
  /** Set it directly. */
  setTheme: (t: Theme) => void
}

/**
 * The initial read, moved verbatim: an explicit stored choice wins; absent one, the machine
 * preference decides the FIRST paint only. The `typeof window` guard keeps this total
 * outside a browser.
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null
  if (saved === "light" || saved === "dark") return saved
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

const ThemeContext = createContext<ThemeValue | null>(null)

/**
 * App-level provider — mounted at the root in `main.tsx`, ABOVE `<App />`.
 *
 * Above rather than inside, and that is deliberate: the theme is the outermost visual fact
 * in the product, and every surface that could ever want it (the chat shell, the workspace
 * panel, the workflow canvas on BOTH of its pages) is inside `<App />`. A provider mounted
 * beside its first consumer is a provider that a second consumer eventually renders outside.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    if (typeof window === "undefined") return
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  const value = useMemo<ThemeValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * The theme hook. THROWS outside a provider — used by WRITERS (`ChatLayout`'s toggle), which
 * are mounted inside the provider by construction. A throw is what makes a second forked
 * state a loud runtime error rather than a silent stale value, which is the whole failure
 * `BUG-260813-01` was.
 */
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return ctx
}

/**
 * Non-throwing accessor — `null` outside a provider. Used by LEAF READS such as
 * `WorkflowCanvas`, so a component still renders in isolation where no provider is mounted.
 * See the header for why this is required rather than convenient.
 */
export function useThemeOptional(): ThemeValue | null {
  return useContext(ThemeContext)
}
