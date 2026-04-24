/**
 * Static model metadata lookup — used by MessageInput for model info subtitles.
 * Keys mirror MODEL_CONTEXT_DEFAULTS in backend/app/config.py and
 * _MODEL_OUTPUT_DEFAULTS in backend/app/services/openai_service.py.
 *
 * For unknown model IDs: no entry in MODEL_INFO → no info subtitle shown (D-12).
 * Update this file when new models are added to config.py.
 */

export interface ModelInfo {
  /** Context window in tokens; from MODEL_CONTEXT_DEFAULTS in config.py */
  contextWindow: number
  /** Max output tokens; from _MODEL_OUTPUT_DEFAULTS in openai_service.py */
  maxOutputTokens: number
  /** Relative cost tier: 'low' ($), 'mid' ($$), 'high' ($$$) */
  costTier: 'low' | 'mid' | 'high'
  /** Short human-readable best-use label */
  bestFor: string
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  "gpt-4o":          { contextWindow: 100_000, maxOutputTokens: 16384, costTier: 'high', bestFor: "General purpose, vision" },
  "gpt-4.1":         { contextWindow: 400_000, maxOutputTokens: 32768, costTier: 'high', bestFor: "Long context, coding" },
  "gpt-4.1-mini":    { contextWindow: 400_000, maxOutputTokens: 32768, costTier: 'mid',  bestFor: "Fast long context" },
  "gpt-5":           { contextWindow: 200_000, maxOutputTokens: 32768, costTier: 'high', bestFor: "Flagship, complex tasks" },
  "gpt-5.4-mini":    { contextWindow: 200_000, maxOutputTokens: 32768, costTier: 'mid',  bestFor: "Fast GPT-5" },

  // ── Anthropic ────────────────────────────────────────────────────────────────
  "claude-opus-4-6":           { contextWindow: 150_000, maxOutputTokens: 16384, costTier: 'high', bestFor: "Complex tasks, analysis" },
  "claude-sonnet-4-6":         { contextWindow: 150_000, maxOutputTokens: 32768, costTier: 'high', bestFor: "Reasoning, long docs" },
  "claude-haiku-4-5-20251001": { contextWindow: 150_000, maxOutputTokens: 8192,  costTier: 'low',  bestFor: "Fast analysis, summaries" },

  // ── Google ───────────────────────────────────────────────────────────────────
  "gemini-2.5-pro":          { contextWindow: 600_000, maxOutputTokens: 32768, costTier: 'high', bestFor: "Very long context, research" },
  "gemini-2.5-flash":        { contextWindow: 600_000, maxOutputTokens: 32768, costTier: 'mid',  bestFor: "Fast, multimodal" },
  "gemini-3-flash-preview":  { contextWindow: 600_000, maxOutputTokens: 32768, costTier: 'mid',  bestFor: "Next-gen flash, multimodal" },

  // ── OpenRouter ───────────────────────────────────────────────────────────────
  "deepseek/deepseek-r1":                 { contextWindow: 100_000, maxOutputTokens: 16384, costTier: 'mid', bestFor: "Advanced reasoning" },
  "meta-llama/llama-3.3-70b-instruct":    { contextWindow: 100_000, maxOutputTokens: 16384, costTier: 'mid', bestFor: "Open source, balanced" },
  "google/gemma-4-31b-it:free":           { contextWindow: 200_000, maxOutputTokens: 32768, costTier: 'low', bestFor: "Free tier, dev use" },
}
