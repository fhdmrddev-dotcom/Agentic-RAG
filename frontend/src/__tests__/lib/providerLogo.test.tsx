/**
 * Phase 128 Plan 03 Task 1 (CTC-01) — unit tests for the D-05 shared
 * `providerLogo(provider)` helper in `src/lib/providerLogo.tsx`.
 *
 * The helper maps the EXACT `runs.provider` strings to an `@lobehub/icons`
 * mark (a React component) and returns `null` for any unmapped key so the
 * caller (RunCard / ToolCallPanel, Plan 04) renders its existing `Bot`
 * fallback. These are pure value assertions on the RETURNED component —
 * no rendering required (jsdom-free).
 *
 * Locked map contract (D-08, research §Pattern 1):
 *   - GLM is keyed "zhipu" (NOT "glm"); Kimi is keyed "moonshot" (NOT "kimi").
 *   - "openrouter" → the OpenRouter mark; it is NOT unwrapped to a routed brand.
 *   - lmstudio / unknown / undefined are deliberately ABSENT → null.
 */
import { describe, it, expect } from "vitest"
import { providerLogo } from "@/lib/providerLogo"

describe("providerLogo", () => {
  // Test 1 — mapped provider → a non-null mark (a React component).
  it("returns a non-null mark for each mapped native provider", () => {
    for (const p of ["openai", "anthropic", "google", "deepseek", "moonshot", "zhipu", "minimax", "ollama"]) {
      const Mark = providerLogo(p)
      expect(Mark, `expected a mark for "${p}"`).not.toBeNull()
      // @lobehub/icons marks are callable React components (function or memo object).
      expect(["function", "object"]).toContain(typeof Mark)
    }
  })

  // Test 2 — D-08 fallback → null (caller renders <Bot/>).
  it("returns null for lmstudio / unknown / undefined (Bot fallback)", () => {
    expect(providerLogo("lmstudio")).toBeNull()
    expect(providerLogo("unknown")).toBeNull()
    expect(providerLogo(undefined)).toBeNull()
  })

  // Test 3 — OpenRouter NOT unwrapped to a routed-model brand.
  it("maps openrouter to its own mark, distinct from the routed-model brand", () => {
    const OpenRouterMark = providerLogo("openrouter")
    expect(OpenRouterMark).not.toBeNull()
    // It must be the OpenRouter entry, NOT silently the openai (or any other) mark.
    expect(OpenRouterMark).not.toBe(providerLogo("openai"))
    expect(OpenRouterMark).not.toBe(providerLogo("anthropic"))
  })

  // Test 4 — GLM/Kimi key correctness: no "glm"/"kimi" keys; the marks live under
  // "zhipu"/"moonshot".
  it("has no glm/kimi keys — the real marks live under zhipu/moonshot", () => {
    expect(providerLogo("glm")).toBeNull()
    expect(providerLogo("kimi")).toBeNull()
    expect(providerLogo("zhipu")).not.toBeNull()
    expect(providerLogo("moonshot")).not.toBeNull()
  })
})
