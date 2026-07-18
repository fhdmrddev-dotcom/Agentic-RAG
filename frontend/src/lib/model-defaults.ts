/**
 * Per-provider-family capability DEFAULT table (Phase 159 / MODEL-03 / D-159-03).
 *
 * REVIEWED pre-fills, never authoritative — mirrors config.py family defaults
 * (`_INFERRED_DEFAULT_MAX_TOKENS` / `_NATIVE_TOOL_PROVIDERS` / `PROVIDER_CONTEXT_DEFAULTS`)
 * + model-info.ts flagship values; keep in sync when families are added.
 *
 * Both the add-by-ID form (Plan 05) and the discovery hand-fill (Plan 06) read
 * `familyDefaults(id | provider)` to PRE-FILL a model's capability inputs from its
 * family. The values are a starting point the operator REVIEWS and can overwrite —
 * a pre-filled model still lands `enabled=false` and requires an explicit enable
 * (149 SC#3 honesty / D-159-03). A `null` for any capability means "no sensible
 * family default" → the UI shows a blank "operator sets it" input rather than a guess.
 *
 * The lookup mirrors `providerLogo.tsx:MODEL_MARKS`/`modelLogo`: an ordered
 * substring→family array, first-match-wins, most-specific-first — so a model keeps its
 * OWN family's defaults regardless of who serves it (an OpenRouter-hosted Gemma resolves
 * the Google family). A bare provider name (no family substring) falls back to the
 * provider map; anything unrecognized (opaque OpenRouter ids) returns all-null (blank).
 */

/** The reviewed pre-fill a family resolves to. `null` = no sensible default (blank input). */
export interface FamilyDefaults {
  /** Context-window tokens, or null (operator sets it). */
  context: number | null
  /** Max output tokens, or null (operator sets it). */
  maxOutput: number | null
  /** Native tool-calling support (native-7 families → true; openrouter/unknown → null). */
  tools: boolean | null
}

// ── Family default values ─────────────────────────────────────────────────────
// Sensible-modern flagship defaults seeded from model-info.ts + the backend
// constants. `tools` follows `_NATIVE_TOOL_PROVIDERS` — every native-7 family is
// tool-capable (true); openrouter/ollama/unknown stay null (operator decides).
const CLAUDE: FamilyDefaults = { context: 200_000, maxOutput: 32_768, tools: true }
const GOOGLE: FamilyDefaults = { context: 600_000, maxOutput: 32_768, tools: true }
const OPENAI: FamilyDefaults = { context: 400_000, maxOutput: 32_768, tools: true }
const KIMI: FamilyDefaults = { context: 256_000, maxOutput: 65_536, tools: true }
const GLM: FamilyDefaults = { context: 128_000, maxOutput: 32_768, tools: true }
const MINIMAX: FamilyDefaults = { context: 200_000, maxOutput: 32_768, tools: true }
const DEEPSEEK: FamilyDefaults = { context: 128_000, maxOutput: 16_384, tools: true }
/** No sensible family default — the operator fills every field (openrouter / unknown). */
const BLANK: FamilyDefaults = { context: null, maxOutput: null, tools: null }

/**
 * The ordered substring→family-default array — mirrors `MODEL_MARKS` (first-match-wins,
 * most-specific-first). Keys are model-FAMILY names (not provider ids): `kimi`/`moonshot`
 * → Kimi, `glm`/`chatglm` → GLM, `minimax`/`abab` → MiniMax, `gpt` → OpenAI. Order matches
 * MODEL_MARKS so a model resolves the SAME family its logo does. Families with no native
 * capability default (grok / mistral / qwen / llama — served via OpenRouter) are omitted;
 * they fall through to the blank all-null result (operator sets it).
 */
const FAMILY_DEFAULTS: ReadonlyArray<readonly [string, FamilyDefaults]> = [
  ["claude", CLAUDE],
  ["gemma", GOOGLE],
  ["gemini", GOOGLE],
  ["deepseek", DEEPSEEK],
  ["kimi", KIMI],
  ["moonshot", KIMI],
  ["chatglm", GLM],
  ["glm", GLM],
  ["minimax", MINIMAX],
  ["abab", MINIMAX],
  ["gpt", OPENAI],
]

/**
 * Bare-provider fallback — used when the input is a plain provider name that does NOT
 * contain its family substring (`google` has no "gemini", `openai` has no "gpt", `zhipu`
 * has no "glm", `anthropic` has no "claude"). openrouter/ollama → blank (heterogeneous /
 * local — no sensible default). The native-7 families that ARE also substrings
 * (deepseek/minimax/moonshot) are caught by the substring pass first; listing them here
 * too is harmless and keeps the roster explicit.
 */
const PROVIDER_DEFAULTS: Readonly<Record<string, FamilyDefaults>> = {
  anthropic: CLAUDE,
  google: GOOGLE,
  openai: OPENAI,
  moonshot: KIMI,
  zhipu: GLM,
  minimax: MINIMAX,
  deepseek: DEEPSEEK,
  openrouter: BLANK,
  ollama: BLANK,
}

/**
 * Resolve a model id OR a bare provider name to its family capability pre-fills.
 *
 * @param idOrProvider a model id (e.g. "claude-opus-4-8", "google/gemma-4-31b-it:free")
 *   or a bare provider name (e.g. "google", "openai").
 * @returns a fresh `{ context, maxOutput, tools }` — each field a reviewed pre-fill or
 *   `null` where no sensible family default exists (the UI then shows a blank input).
 *   ALWAYS a new object (never a shared reference) so a caller can mutate its draft state.
 */
export function familyDefaults(idOrProvider: string): FamilyDefaults {
  const key = (idOrProvider ?? "").toLowerCase().trim()
  if (!key) return { ...BLANK }
  // 1. substring → family (first-match-wins, most-specific-first — mirrors MODEL_MARKS)
  for (const [needle, def] of FAMILY_DEFAULTS) {
    if (key.includes(needle)) return { ...def }
  }
  // 2. bare provider name → family
  const byProvider = PROVIDER_DEFAULTS[key]
  if (byProvider) return { ...byProvider }
  // 3. unrecognized (opaque OpenRouter ids, unknown vendors) → blank; the operator sets it
  return { ...BLANK }
}
