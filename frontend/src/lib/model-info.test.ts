/**
 * Unit tests for MODEL_INFO static lookup — CTX-04.
 * Verifies key alignment with backend MODEL_CONTEXT_DEFAULTS and _MODEL_OUTPUT_DEFAULTS.
 */
import { describe, it, expect } from "vitest"
import { MODEL_INFO, type ModelInfo } from "./model-info"

describe("MODEL_INFO", () => {
  it("should export MODEL_INFO as a non-empty record", () => {
    expect(MODEL_INFO).toBeDefined()
    expect(typeof MODEL_INFO).toBe("object")
    expect(Object.keys(MODEL_INFO).length).toBeGreaterThan(0)
  })

  it("should have correct shape for each entry", () => {
    for (const [modelId, info] of Object.entries(MODEL_INFO)) {
      expect(typeof info.contextWindow, `${modelId}.contextWindow`).toBe("number")
      expect(typeof info.maxOutputTokens, `${modelId}.maxOutputTokens`).toBe("number")
      expect(typeof info.bestFor, `${modelId}.bestFor`).toBe("string")
      expect(info.contextWindow, `${modelId}.contextWindow`).toBeGreaterThan(0)
      expect(info.maxOutputTokens, `${modelId}.maxOutputTokens`).toBeGreaterThan(0)
      expect(info.bestFor.length, `${modelId}.bestFor`).toBeGreaterThan(0)
    }
  })

  it("should include OpenAI models that match backend config keys", () => {
    // Keys mirror MODEL_CONTEXT_DEFAULTS in backend/app/config.py
    expect(MODEL_INFO["gpt-4o"]).toBeDefined()
    expect(MODEL_INFO["gpt-4o-mini"]).toBeDefined()
    expect(MODEL_INFO["gpt-4.1"]).toBeDefined()
  })

  it("should include Anthropic models", () => {
    expect(MODEL_INFO["claude-sonnet-4-6"]).toBeDefined()
    expect(MODEL_INFO["claude-haiku-4-5-20251001"]).toBeDefined()
  })

  it("should include Google models", () => {
    expect(MODEL_INFO["gemini-2.5-pro"]).toBeDefined()
    expect(MODEL_INFO["gemini-2.5-flash"]).toBeDefined()
  })

  it("gpt-4o contextWindow should be 100000", () => {
    expect(MODEL_INFO["gpt-4o"]?.contextWindow).toBe(100_000)
  })

  it("gemini-2.5-pro contextWindow should be 600000", () => {
    expect(MODEL_INFO["gemini-2.5-pro"]?.contextWindow).toBe(600_000)
  })
})
