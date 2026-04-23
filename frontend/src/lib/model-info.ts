/**
 * Static model metadata lookup — used by MessageInput for model info tooltips.
 * Keys mirror MODEL_CONTEXT_DEFAULTS in backend/app/config.py and
 * _MODEL_OUTPUT_DEFAULTS in backend/app/services/openai_service.py.
 *
 * For unknown model IDs: no entry in MODEL_INFO → no info icon shown (D-12).
 * OpenRouter models are omitted — too many to maintain and IDs are unstable.
 *
 * Update this file when new first-party models are added to config.py.
 */

export interface ModelInfo {
  /** Context window in tokens; from MODEL_CONTEXT_DEFAULTS in config.py */
  contextWindow: number
  /** Max output tokens; from _MODEL_OUTPUT_DEFAULTS in openai_service.py */
  maxOutputTokens: number
  /** Short human-readable best-use label */
  bestFor: string
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  "gpt-4o":          { contextWindow: 100_000,  maxOutputTokens: 16384,  bestFor: "General purpose, vision" },
  "gpt-4o-mini":     { contextWindow: 100_000,  maxOutputTokens: 16384,  bestFor: "Fast, cost-efficient" },
  "gpt-4.1":         { contextWindow: 400_000,  maxOutputTokens: 32768,  bestFor: "Long context, coding" },
  "gpt-4.1-mini":    { contextWindow: 400_000,  maxOutputTokens: 32768,  bestFor: "Fast long context" },
  "gpt-4.1-nano":    { contextWindow: 400_000,  maxOutputTokens: 16384,  bestFor: "Ultra-fast, low cost" },

  // ── Anthropic ────────────────────────────────────────────────────────────────
  "claude-sonnet-4-6":         { contextWindow: 150_000, maxOutputTokens: 32768, bestFor: "Reasoning, long docs" },
  "claude-opus-4-6":           { contextWindow: 150_000, maxOutputTokens: 16384, bestFor: "Complex tasks, analysis" },
  "claude-haiku-4-5-20251001": { contextWindow: 150_000, maxOutputTokens: 8192,  bestFor: "Fast analysis, summaries" },

  // ── Google ───────────────────────────────────────────────────────────────────
  "gemini-2.5-pro":            { contextWindow: 600_000, maxOutputTokens: 32768, bestFor: "Very long context, research" },
  "gemini-2.5-flash":          { contextWindow: 600_000, maxOutputTokens: 32768, bestFor: "Fast, multimodal" },
  "gemini-2.5-flash-lite":     { contextWindow: 600_000, maxOutputTokens: 16384, bestFor: "Ultra-fast, high volume" },

  // OpenRouter models intentionally omitted — graceful degradation per D-12
  // (no icon shown for unknown model IDs)
}
