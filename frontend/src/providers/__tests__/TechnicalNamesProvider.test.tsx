/**
 * Phase 154 Plan 01 Task 1 (TDD) — the app-wide reveal-state context.
 *
 * `TechnicalNamesProvider` is the SPINE of the plain-language layer (LANG-01 /
 * D-01). It holds ONE boolean ("show technical names") shared across every
 * consumer — the Settings toggle, the admin Control Room, and every relabeled
 * surface — so the two-audience reveal is a single app-wide switch that can
 * never disagree with itself (the G-6 "two toggles disagree" failure).
 *
 * It is modeled on TWO shipped in-repo patterns:
 *   - the SHARING structure of `frontend/src/lib/citationNav.tsx`
 *     (`createContext<T | null>(null)` + a throwing hook + a non-throwing
 *     optional accessor) — so all consumers read ONE value, not per-hook state;
 *   - the PERSISTENCE of `frontend/src/hooks/useTheme.ts` (`typeof window`
 *     guard + localStorage get/set) — WITHOUT its `matchMedia` line, because the
 *     default is a hard `false` (plain), not a system-derived value (D-01).
 *
 * The five behaviors below are the Wave-0 contract:
 *   1. default OFF (plain) on a fresh mount with empty storage;
 *   2. `toggle()` flips the SHARED value (two consumers under one provider agree);
 *   3. the preference persists to localStorage["technical-names"] across remount;
 *   4. `useTechnicalNames()` THROWS outside a provider (writer idiom);
 *   5. `useTechnicalNamesOptional()` returns null outside a provider (leaf idiom).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, renderHook, act, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"
import {
  TechnicalNamesProvider,
  useTechnicalNames,
  useTechnicalNamesOptional,
} from "../TechnicalNamesProvider"

const STORAGE_KEY = "technical-names"

beforeEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("TechnicalNamesProvider — default state (D-01)", () => {
  it("defaults to plain (showTechnical === false) on a fresh mount with empty storage", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TechnicalNamesProvider>{children}</TechnicalNamesProvider>
    )
    const { result } = renderHook(() => useTechnicalNames(), { wrapper })
    expect(result.current.showTechnical).toBe(false)
  })
})

describe("TechnicalNamesProvider — one shared value (D-01a, the anti-drift invariant)", () => {
  it("toggle() flips the SAME value observed by two consumers under one provider", () => {
    function TwoConsumers() {
      const a = useTechnicalNames()
      const b = useTechnicalNames()
      return (
        <div>
          <span data-testid="a">{String(a.showTechnical)}</span>
          <span data-testid="b">{String(b.showTechnical)}</span>
          <button type="button" onClick={a.toggle}>
            flip
          </button>
        </div>
      )
    }

    render(
      <TechnicalNamesProvider>
        <TwoConsumers />
      </TechnicalNamesProvider>,
    )

    expect(screen.getByTestId("a").textContent).toBe("false")
    expect(screen.getByTestId("b").textContent).toBe("false")

    act(() => {
      screen.getByRole("button", { name: "flip" }).click()
    })

    // BOTH consumers observe the flip — a single shared context value, not two
    // independent per-hook useState instances.
    expect(screen.getByTestId("a").textContent).toBe("true")
    expect(screen.getByTestId("b").textContent).toBe("true")
  })

  it("setShowTechnical(v) sets the shared value directly", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TechnicalNamesProvider>{children}</TechnicalNamesProvider>
    )
    const { result } = renderHook(() => useTechnicalNames(), { wrapper })

    act(() => {
      result.current.setShowTechnical(true)
    })
    expect(result.current.showTechnical).toBe(true)
  })
})

describe("TechnicalNamesProvider — persistence (localStorage, useTheme model)", () => {
  it("writes localStorage['technical-names'] === 'true' after a toggle, and a fresh provider re-initializes to true", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TechnicalNamesProvider>{children}</TechnicalNamesProvider>
    )
    const first = renderHook(() => useTechnicalNames(), { wrapper })

    act(() => {
      first.result.current.toggle()
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true")

    // A brand-new provider instance reading storage initializes to the persisted
    // value (survives a "reload").
    first.unmount()
    const second = renderHook(() => useTechnicalNames(), { wrapper })
    expect(second.result.current.showTechnical).toBe(true)
  })
})

describe("TechnicalNamesProvider — accessor contract (citationNav idiom)", () => {
  it("useTechnicalNames() throws a clear error outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useTechnicalNames())).toThrow(/TechnicalNamesProvider/i)
    spy.mockRestore()
  })

  it("useTechnicalNamesOptional() returns null outside a provider (does NOT throw)", () => {
    const { result } = renderHook(() => useTechnicalNamesOptional())
    expect(result.current).toBeNull()
  })
})
