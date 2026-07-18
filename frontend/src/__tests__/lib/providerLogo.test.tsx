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
 *   - ollama + lmstudio are the two local-connector marks (one per local base-URL
 *     connector); only unknown / undefined are ABSENT → null.
 */
import { describe, it, expect } from "vitest"
import { providerLogo, modelLogo } from "@/lib/providerLogo"

describe("providerLogo", () => {
  // Test 1 — mapped provider → a non-null mark (a React component).
  it("returns a non-null mark for each mapped native provider", () => {
    for (const p of ["openai", "anthropic", "google", "deepseek", "moonshot", "zhipu", "minimax", "ollama", "lmstudio"]) {
      const Mark = providerLogo(p)
      expect(Mark, `expected a mark for "${p}"`).not.toBeNull()
      // @lobehub/icons marks are callable React components (function or memo object).
      expect(["function", "object"]).toContain(typeof Mark)
    }
  })

  // Test 2 — only truly-unknown providers fall back → null (caller renders <Bot/>).
  // Operator override (2026-06-27): lmstudio now maps to the LM Studio mark (a known
  // local connector, like ollama) — so ONLY unknown / undefined return null.
  it("returns null for unknown / undefined (Bot fallback)", () => {
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

/**
 * Model-icons pass — unit tests for the `modelLogo(modelId)` helper. It
 * maps a model id (not a provider id) to its OWN `@lobehub` model-family mark via
 * ordered substring match, or null so the caller falls back to providerLogo. Pure
 * value assertions on the RETURNED component (jsdom-free).
 */
describe("modelLogo", () => {
  // Representative real model ids from every native family + OpenRouter routing.
  const KNOWN: Array<[string, string]> = [
    ["claude-opus-4-7", "anthropic Claude"],
    ["gpt-5.5", "openai GPT"],
    ["gpt-4o", "openai GPT"],
    ["gemini-3.1-pro-preview", "google Gemini"],
    ["google/gemma-4-31b-it:free", "google Gemma"],
    ["deepseek/deepseek-r1", "deepseek"],
    ["deepseek-chat", "deepseek native"],
    ["moonshot-v1-8k", "moonshot → Kimi"],
    ["kimi-k2", "Kimi"],
    ["glm-4-plus", "zhipu → ChatGLM"],
    ["chatglm-6b", "ChatGLM"],
    ["minimax-m1", "MiniMax"],
    ["abab6.5s-chat", "MiniMax abab"],
    ["x-ai/grok-2", "Grok"],
    ["meta-llama/llama-3.3-70b-instruct", "Meta / Llama"],
    ["mistralai/mixtral-8x7b", "Mistral / Mixtral"],
    ["qwen/qwen-2.5-72b", "Qwen"],
  ]

  it("returns a non-null mark for every known model family", () => {
    for (const [id, label] of KNOWN) {
      const Mark = modelLogo(id)
      expect(Mark, `expected a model mark for "${id}" (${label})`).not.toBeNull()
      expect(["function", "object"]).toContain(typeof Mark)
    }
  })

  it("returns null for unknown ids / empty / undefined (caller falls back to providerLogo)", () => {
    expect(modelLogo("some-unlisted-model-9000")).toBeNull()
    expect(modelLogo("")).toBeNull()
    expect(modelLogo(undefined)).toBeNull()
  })

  it("is case-insensitive on the model id", () => {
    expect(modelLogo("CLAUDE-OPUS-4-7")).toBe(modelLogo("claude-opus-4-7"))
    expect(modelLogo("Gemini-2.5-Pro")).not.toBeNull()
  })

  // gpt-* has no distinct art → it resolves to the SAME OpenAI mark as the provider;
  // gemini resolves to the SAME Gemini mark the `google` provider uses. Locks the
  // "reuse the provider leaf, don't re-import" invariant.
  it("shares the provider leaf where the family has no distinct model art", () => {
    expect(modelLogo("gpt-4o")).toBe(providerLogo("openai"))
    expect(modelLogo("gemini-2.5-flash")).toBe(providerLogo("google"))
    expect(modelLogo("deepseek-chat")).toBe(providerLogo("deepseek"))
  })

  // Claude's sunburst / Kimi's mark are DISTINCT from the Anthropic / Moonshot
  // provider marks — the whole point of a model-specific mark.
  it("uses the model-family mark, distinct from the provider mark where one exists", () => {
    expect(modelLogo("claude-opus-4-7")).not.toBe(providerLogo("anthropic"))
    expect(modelLogo("kimi-k2")).not.toBe(providerLogo("moonshot"))
    expect(modelLogo("glm-4-plus")).not.toBe(providerLogo("zhipu"))
  })

  // OpenRouter routing keeps the ROUTED model's own brand — never the OpenRouter mark.
  it("keeps the routed model's own brand under OpenRouter ids", () => {
    const llama = modelLogo("meta-llama/llama-3.3-70b-instruct")
    expect(llama).not.toBeNull()
    expect(llama).not.toBe(providerLogo("openrouter"))
  })

  // gemma vs gemini must not collide (adjacent substrings, distinct families).
  it("distinguishes gemma from gemini", () => {
    expect(modelLogo("google/gemma-4-31b-it:free")).not.toBe(modelLogo("gemini-2.5-pro"))
  })
})
