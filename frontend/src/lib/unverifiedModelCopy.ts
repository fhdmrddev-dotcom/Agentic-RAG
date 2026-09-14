/**
 * Phase 249 Plan 02 (MODEL-05 / SEED-135) — THE one home for the unverified-model chip.
 *
 * ── WHY A MODULE FOR THREE STRINGS ──────────────────────────────────────────────────
 *
 * Two surfaces render this chip: Settings' `ModelPillRow` and the chat composer's model
 * dropdown. A second copy of a shared string is exactly the class of defect this phase exists
 * to close — `SEED-172` was two hardcoded provider rosters that drifted apart, and the drift
 * made a whole family of models unusable. Three strings in one module is cheaper than finding
 * out later that the two surfaces disagree about what a warning means.
 *
 * ── THE WORDING IS NOT A STYLE CHOICE ───────────────────────────────────────────────
 *
 * `describeToolsLost` is lifted, in substance, from `backend/app/config.py`'s
 * `_build_inferred_defaults` log line. That line reads the way it does because of a measured
 * failure: it used to end `safe_defaults_applied=True`, **which READS AS BENIGN — and that is
 * exactly how a total tool-calling failure stayed invisible for a day on 2026-08-18.** The model
 * was put in STRUCTURED mode, the `tools` param was never sent, the model narrated its tool calls
 * as prose the parser could not read, and the agent loop broke after one iteration with no error
 * anywhere.
 *
 * So: say the CONSEQUENCE and the REMEDY, never just that a default was applied. A chip that says
 * only "unverified" repeats the 2026-08-18 mistake one surface up.
 *
 * ⛔ THIS IS A WARNING, NOT A REFUSAL. `D-122-05` makes a registry miss degrade to `coerce` BY
 * DESIGN, and that default is correct — `SEED-135` says so in its own words: *"That default is
 * CORRECT and must not change; what is missing is that the degradation is invisible to the person
 * who caused it."* The pick still works. It just stops being silent.
 */

/**
 * The inferred-default timeout, in seconds, for a model with no registry row.
 *
 * ⚠ MEASURED, NOT COPIED. `backend/app/config.py::_INFERRED_DEFAULT_TIMEOUT_S` is **300**. The
 * shipped Settings tooltip said `timeout=90s` and had been telling operators a false number —
 * the value was revised on 2026-05-24 and the tooltip was never updated. A surface built to tell
 * the truth about a model's capabilities must not itself be wrong about one.
 */
const INFERRED_TIMEOUT_SECONDS = 300

/** The inferred `max_output_tokens` per provider bucket (`_INFERRED_DEFAULT_MAX_TOKENS`). */
function inferredMaxTokens(provider: string): number {
  return provider === "openrouter" ? 4096 : 8192
}

export const UNVERIFIED = {
  /** The chip text itself. */
  LABEL: "unverified",

  /**
   * The benign case: no registry row, but the inferred provider DOES support native tool calling,
   * so the model will still call tools. Safe defaults apply and nothing silently stops working.
   */
  describe(model: string, inferredProviderFor: Record<string, string>): string {
    const provider = inferredProviderFor[model] ?? "ollama"
    return (
      `${model} isn't in the verified registry. Treating it as a ${provider} model with safe ` +
      `defaults (max_tokens=${inferredMaxTokens(provider)}, timeout=${INFERRED_TIMEOUT_SECONDS}s). ` +
      `Add a row for it in the Model Registry to set its real limits.`
    )
  },

  /**
   * ⭐ THE CONSEQUENCE CASE. The inferred provider is outside the backend's
   * `_NATIVE_TOOL_PROVIDERS`, so this model will run with tool calling OFF and will not say so
   * anywhere else.
   */
  describeToolsLost(model: string, inferredProviderFor: Record<string, string>): string {
    const provider = inferredProviderFor[model] ?? "ollama"
    return (
      `${model} isn't in the verified registry, and tool calling is DISABLED for it. ` +
      `It will run as a ${provider} model in structured mode — search, code execution and every ` +
      `other tool are unavailable, and any tool call it tries will arrive as unreadable text. ` +
      `Add a row for it in the Model Registry (native tools + its real context window) to fix it.`
    )
  },
} as const

/** Pick the right description for one model. The two surfaces must not each write this `if`. */
export function unverifiedDescription(
  model: string,
  inferredProviderFor: Record<string, string>,
  toolsLostModels: ReadonlySet<string>,
): string {
  return toolsLostModels.has(model)
    ? UNVERIFIED.describeToolsLost(model, inferredProviderFor)
    : UNVERIFIED.describe(model, inferredProviderFor)
}
