/**
 * Phase 159 (MODEL-03 / D-159-03) — familyDefaults() family-default resolution.
 *
 * Locks the D-159-03 contract the add-by-ID form (Plan 05) + discovery hand-fill
 * (Plan 06) consume: a substring→family table (first-match-wins, mirroring
 * MODEL_MARKS) that returns REVIEWED pre-fills — non-null sensible-modern defaults
 * for the native-7 families, all-null (blank) for openrouter / unknown ids so the UI
 * shows an empty "operator sets it" input (SC#3 — never a guessed authoritative value).
 */
import { describe, it, expect } from "vitest"
import { familyDefaults } from "./model-defaults"

describe("familyDefaults — family resolution from model ids", () => {
  it("resolves the Kimi family (kimi-k3) to non-null caps + tools", () => {
    const d = familyDefaults("kimi-k3")
    expect(d.context).not.toBeNull()
    expect(d.maxOutput).not.toBeNull()
    expect(d.tools).toBe(true)
    // Spot-check the mirrored values (256k / 65536).
    expect(d.context).toBe(256_000)
    expect(d.maxOutput).toBe(65_536)
  })

  it("resolves the Claude family with tools=true and a positive context", () => {
    const d = familyDefaults("claude-opus-4-8")
    expect(d.tools).toBe(true)
    expect(typeof d.context).toBe("number")
    expect(d.context as number).toBeGreaterThan(0)
  })

  it("resolves the GPT family (gpt-5.4) to a positive context", () => {
    const d = familyDefaults("gpt-5.4")
    expect(d.context as number).toBeGreaterThan(0)
    expect(d.context).toBe(400_000)
    expect(d.tools).toBe(true)
  })

  it("resolves gemini + gemma to the Google family (600k)", () => {
    expect(familyDefaults("gemini-3.1-pro-preview").context).toBe(600_000)
    // An OpenRouter-hosted Gemma keeps its OWN family's defaults (like modelLogo).
    expect(familyDefaults("google/gemma-4-31b-it:free").context).toBe(600_000)
  })

  it("resolves the MiniMax + DeepSeek + GLM families to native (tools=true)", () => {
    expect(familyDefaults("minimax-m3").tools).toBe(true)
    expect(familyDefaults("minimax-m3").context).toBe(200_000)
    expect(familyDefaults("deepseek-v4").tools).toBe(true)
    expect(familyDefaults("deepseek-v4").maxOutput).toBe(16_384)
    expect(familyDefaults("glm-4.6").context).toBe(128_000)
    expect(familyDefaults("chatglm-turbo").context).toBe(128_000)
  })
})

describe("familyDefaults — bare provider fallback", () => {
  it("resolves a bare provider name that lacks its family substring", () => {
    // "google" contains no "gemini"/"gemma" substring → provider-map fallback.
    expect(familyDefaults("google").context).toBe(600_000)
    // "openai" contains no "gpt"; "zhipu" contains no "glm"; "anthropic" no "claude".
    expect(familyDefaults("openai").context).toBe(400_000)
    expect(familyDefaults("zhipu").context).toBe(128_000)
    expect(familyDefaults("anthropic").context).toBe(200_000)
  })
})

describe("familyDefaults — null for unknown (blank inputs)", () => {
  it("returns all-null for an opaque vendor/model id", () => {
    expect(familyDefaults("somevendor/opaque-xyz")).toEqual({
      context: null,
      maxOutput: null,
      tools: null,
    })
  })

  it("returns all-null for bare openrouter (heterogeneous — operator sets it)", () => {
    expect(familyDefaults("openrouter")).toEqual({ context: null, maxOutput: null, tools: null })
  })

  it("returns all-null for an empty / whitespace input", () => {
    expect(familyDefaults("")).toEqual({ context: null, maxOutput: null, tools: null })
    expect(familyDefaults("   ")).toEqual({ context: null, maxOutput: null, tools: null })
  })
})

describe("familyDefaults — first-match-wins ordering (mirrors MODEL_MARKS)", () => {
  it("returns the EARLIER-listed family when an id matches two needles", () => {
    // "deepseek" (index 3) is listed before "gpt" (index 10). An id containing BOTH must
    // resolve DeepSeek (128k / 16384), NOT OpenAI (400k) — proving iteration stops at the
    // first match in MODEL_MARKS order.
    const d = familyDefaults("deepseek-gpt-hybrid")
    expect(d.context).toBe(128_000)
    expect(d.maxOutput).toBe(16_384)
  })
})

describe("familyDefaults — hygiene", () => {
  it("is case-insensitive", () => {
    expect(familyDefaults("CLAUDE-OPUS-4-8").context).toBe(200_000)
    expect(familyDefaults("GPT-5.4").context).toBe(400_000)
  })

  it("returns a FRESH object each call (safe to mutate as draft state)", () => {
    const a = familyDefaults("claude-opus-4-8")
    const b = familyDefaults("claude-opus-4-8")
    expect(a).not.toBe(b)
    a.context = 1 // mutating one must not affect the other or the shared const
    expect(familyDefaults("claude-opus-4-8").context).toBe(200_000)
  })
})
