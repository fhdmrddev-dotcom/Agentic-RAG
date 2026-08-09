/**
 * Phase 183 Plan 03 Task 1 (CANVAS-01 / D-183-03; operator decision OP-2) —
 * the EffectiveFeaturesProvider contract.
 *
 * The provider exists so a page-level component (the Builder's Canvas toggle)
 * can read `visual_workflow_canvas` WITHOUT issuing a second `GET /features`
 * per session. That makes two things load-bearing, and both are pinned here:
 *
 *   1. THE ACCESSOR CONTRACT (the shipped `TechnicalNamesProvider` /
 *      `lib/citationNav.tsx` idiom): `useEffectiveFeaturesOptional()` returns
 *      null outside a provider (the leaf idiom), `useEffectiveFeaturesContext()`
 *      throws outside one (the writer idiom), and inside a provider BOTH hand
 *      back the exact object that was passed as `value` — reference equality,
 *      not a structural copy. Reference equality is the assertion that proves
 *      the nav and a page cannot be reading two independently-fetched maps.
 *
 *   2. THE NULL-CONTEXT FAIL-CLOSED RULE. A null context (no provider mounted)
 *      MUST be read by consumers exactly like the empty map `{}` — every
 *      governed feature hidden — never as "unknown, so show it". Plan 183-07's
 *      Builder gate depends on this, so the rule is asserted here as behaviour
 *      (a consumer reading a null context hides the feature) and not left to
 *      prose.
 *
 *   3. PURITY (the house `?raw` grep block): the module must not import the API
 *      client, must not name the effective-features fetch function, and must
 *      declare no local React state. It is plumbing, not a second fetcher — the
 *      whole point of the plan.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, renderHook, cleanup } from "@testing-library/react"
import type { ReactNode } from "react"

import providerSource from "./EffectiveFeaturesProvider?raw"
import {
  EffectiveFeaturesProvider,
  useEffectiveFeaturesContext,
  useEffectiveFeaturesOptional,
} from "./EffectiveFeaturesProvider"
import type { UseEffectiveFeatures } from "@/hooks/useEffectiveFeatures"

beforeEach(() => {
  cleanup()
})

/** The exact object identity the provider must broadcast unchanged. */
function makeValue(over: Partial<UseEffectiveFeatures> = {}): UseEffectiveFeatures {
  return {
    features: { visual_workflow_canvas: true },
    loading: false,
    refetch: vi.fn(),
    ...over,
  }
}

describe("EffectiveFeaturesProvider — accessor contract (citationNav idiom)", () => {
  it("useEffectiveFeaturesOptional() returns null outside a provider (does NOT throw)", () => {
    const { result } = renderHook(() => useEffectiveFeaturesOptional())
    expect(result.current).toBeNull()
  })

  it("useEffectiveFeaturesContext() throws a clear error outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useEffectiveFeaturesContext())).toThrow(
      /EffectiveFeaturesProvider/i,
    )
    spy.mockRestore()
  })
})

describe("EffectiveFeaturesProvider — one shared object (the anti-second-fetch invariant)", () => {
  it("useEffectiveFeaturesContext() returns the EXACT object passed as value", () => {
    const value = makeValue()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EffectiveFeaturesProvider value={value}>{children}</EffectiveFeaturesProvider>
    )
    const { result } = renderHook(() => useEffectiveFeaturesContext(), { wrapper })
    // Reference equality — not a copy, not a re-derived map.
    expect(result.current).toBe(value)
    expect(result.current.features).toBe(value.features)
    expect(result.current.refetch).toBe(value.refetch)
  })

  it("useEffectiveFeaturesOptional() returns that same object inside a provider", () => {
    const value = makeValue()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EffectiveFeaturesProvider value={value}>{children}</EffectiveFeaturesProvider>
    )
    const { result } = renderHook(() => useEffectiveFeaturesOptional(), { wrapper })
    expect(result.current).toBe(value)
  })

  it("two consumers under one provider observe the identical object", () => {
    const value = makeValue()
    const seen: (UseEffectiveFeatures | null)[] = []

    function ConsumerA() {
      seen.push(useEffectiveFeaturesContext())
      return null
    }
    function ConsumerB() {
      seen.push(useEffectiveFeaturesOptional())
      return null
    }

    render(
      <EffectiveFeaturesProvider value={value}>
        <ConsumerA />
        <ConsumerB />
      </EffectiveFeaturesProvider>,
    )

    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(value)
    expect(seen[1]).toBe(value)
    expect(seen[0]).toBe(seen[1])
  })
})

describe("EffectiveFeaturesProvider — a NULL context is FAIL-CLOSED (T-183-03)", () => {
  /**
   * The canonical consumer shape plan 183-07 uses: read the OPTIONAL accessor,
   * treat null exactly like `{}`, and require a strict `=== true` — the
   * `lib/nav-items.ts` vanish semantics. Absent map, absent provider and an
   * explicit false must all resolve to HIDDEN.
   */
  function CanvasGate() {
    const ctx = useEffectiveFeaturesOptional()
    const features = ctx?.features ?? {}
    return features.visual_workflow_canvas === true ? (
      <span data-testid="gate">canvas toggle</span>
    ) : null
  }

  it("hides the governed feature when NO provider is mounted (null read as {})", () => {
    render(<CanvasGate />)
    expect(screen.queryByTestId("gate")).toBeNull()
  })

  it("hides the governed feature when the map is the pre-resolve/error {} (T-148-FAILCLOSED)", () => {
    render(
      <EffectiveFeaturesProvider value={makeValue({ features: {}, loading: true })}>
        <CanvasGate />
      </EffectiveFeaturesProvider>,
    )
    expect(screen.queryByTestId("gate")).toBeNull()
  })

  it("hides the governed feature when the key is explicitly false", () => {
    render(
      <EffectiveFeaturesProvider
        value={makeValue({ features: { visual_workflow_canvas: false } })}
      >
        <CanvasGate />
      </EffectiveFeaturesProvider>,
    )
    expect(screen.queryByTestId("gate")).toBeNull()
  })

  it("shows the governed feature ONLY on a strict true", () => {
    render(
      <EffectiveFeaturesProvider value={makeValue()}>
        <CanvasGate />
      </EffectiveFeaturesProvider>,
    )
    expect(screen.getByTestId("gate")).toBeInTheDocument()
  })
})

describe("EffectiveFeaturesProvider — purity (it is plumbing, not a second fetcher)", () => {
  it("imports nothing from the API client", () => {
    expect(providerSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(providerSource).not.toMatch(/@\/lib\/api/)
  })

  it("never names the effective-features fetch function — it issues no request", () => {
    expect(providerSource).not.toMatch(/getEffectiveFeatures/)
  })

  it("declares no local React state, cache or effect", () => {
    expect(providerSource).not.toMatch(/useState/)
    // Anchored on the CALL, not the bare name: the module legitimately mentions
    // `useEffectiveFeatures` (the hook whose value it carries), and a bare
    // /useEffect/ would match that prefix — the plan-02 `grounding_mode` lesson.
    expect(providerSource).not.toMatch(/\buseEffect\(/)
    expect(providerSource).not.toMatch(/\buseRef\(/)
  })

  it("states the null-context fail-closed rule in its docblock", () => {
    expect(providerSource).toMatch(/FAIL-CLOSED/i)
    expect(providerSource).toMatch(/never treat null as/i)
  })

  it("exports exactly the three contracted names", () => {
    const exports = (providerSource.match(/export function (\w+)/g) ?? []).map((m) =>
      m.replace("export function ", ""),
    )
    expect(exports.sort()).toEqual([
      "EffectiveFeaturesProvider",
      "useEffectiveFeaturesContext",
      "useEffectiveFeaturesOptional",
    ])
  })
})
