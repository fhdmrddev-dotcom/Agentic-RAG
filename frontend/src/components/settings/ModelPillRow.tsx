import { cn } from "@/lib/utils"
import { providerLogo, modelLogo } from "@/lib/providerLogo"
import { NO_TOOLS_LABEL, UNVERIFIED, unverifiedDescription } from "@/lib/unverifiedModelCopy"

/**
 * ModelPillRow — Phase 075.3 D-075.3-10/11/12; Phase 149 D-149-17/D-149-05.
 *
 * Renders the comma-separated active-provider model list as clickable pill
 * buttons. Models not in the verified-registry get an inline amber "unverified"
 * chip with a tooltip explaining the inferred provider + safe defaults.
 *
 * Phase 149 (visual-only pass, NO redesign — D-149-17): the group is prefixed
 * with the active provider's single-source `@lobehub` logo (RDD 48 / Phase 127
 * ICON CONVENTION), the model name stays the primary text, and a model in
 * `deprecatedModels` gets a small informational `deprecated` badge (mirroring the
 * amber `unverified` chip) while STAYING selectable — badge only, no refusal
 * (D-149-05). All new props are optional + defensively defaulted so a caller that
 * hasn't wired them (or a backend payload without `deprecated_models`) renders
 * exactly as before.
 *
 * Model-icons pass: each pill also leads with the model's OWN `@lobehub`
 * family mark (`modelLogo(m)` — Claude / Gemini / Llama / …), falling back to the
 * active provider mark, then no icon. Same single-source seam the composer uses, so
 * a model shows the identical mark in the picker and in Settings (ICON CONVENTION).
 *
 * Extracted from SettingsPage.tsx (was the inline render at lines 765-778) so
 * the badge logic has a narrow vitest test surface (SettingsModelBadge.test.tsx
 * targets THIS component, not the full SettingsPage).
 */
export interface ModelPillRowProps {
  /** Pre-split + trimmed model list from the active provider */
  models: string[]
  /** Currently-selected model in the main LLM model field */
  llmModel: string
  /** Set of registry-known model_ids (from FullAppSettings.verified_models) */
  verifiedModels: Set<string>
  /** Map of model_id → inferred provider (from FullAppSettings.inferred_provider_for) */
  inferredProviderFor: Record<string, string>
  /** Callback when a pill is clicked */
  onSelect: (model: string) => void
  /** Phase 149 (D-149-05): model_ids flagged `deprecated` in the registry.
   *  Members render an informational `deprecated` badge but stay selectable.
   *  Optional — absent → empty set → no badge (defensive default). */
  deprecatedModels?: Set<string>
  /** Phase 149 (D-149-17): the active provider id, used to prefix the group with
   *  its single-source `@lobehub` logo. Optional — absent/unmapped → no logo. */
  providerId?: string
  /** ⭐ Phase 249 (MODEL-05): unverified ids whose inferred provider has NO native tool calling.
   *  Optional — absent → the benign description, i.e. today's wording. A consequence is only
   *  claimed when the server actually said so. */
  toolsLostModels?: ReadonlySet<string>
}

/** Minimal provider display labels for the logo-group header (title-cased for the
 *  local connectors that have no obvious brand-cased form). Falls back to the raw
 *  provider id so an unlisted provider still labels sensibly. */
const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  deepseek: "DeepSeek",
  moonshot: "Moonshot",
  minimax: "MiniMax",
  zhipu: "Zhipu",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  lmstudio: "LM Studio",
}

/*
 * ⚠ Phase 249 (MODEL-05): the local `_tooltipFor` is GONE. Its text now comes from
 * `@/lib/unverifiedModelCopy`, shared with the chat composer's dropdown — because the warning
 * belongs at PICK time and this surface is not where a model is picked. Two copies of one
 * warning drift; `SEED-172` is this phase's proof of what that costs.
 *
 * ⭐ AND THE OLD TEXT WAS WRONG. It said `timeout=90s`. The inferred default is
 * `_INFERRED_DEFAULT_TIMEOUT_S = 300` (revised 2026-05-24) — this tooltip had been telling
 * operators a false number, on the surface whose entire job is telling the truth about a model's
 * capabilities.
 */

/** Stable empty default — an omitted prop must not allocate a new Set per render. */
const EMPTY_MODEL_SET: ReadonlySet<string> = new Set<string>()

export function ModelPillRow({
  models,
  llmModel,
  verifiedModels,
  inferredProviderFor,
  onSelect,
  deprecatedModels,
  providerId,
  toolsLostModels,
}: ModelPillRowProps) {
  const ProviderMark = providerLogo(providerId)
  const providerLabel = providerId ? (PROVIDER_LABELS[providerId] ?? providerId) : null

  return (
    <div className="flex flex-col gap-1.5">
      {ProviderMark && providerLabel && (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          <ProviderMark size={13} />
          <span>{providerLabel}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {models.map((m) => {
          const isUnverified = !verifiedModels.has(m)
          // ⛔ CR-02: registry membership and tool calling are different questions. A model the
          // operator added is registered AND can still run with tools off.
          const isToolsLost = toolsLostModels?.has(m) ?? false
          const isDeprecated = deprecatedModels?.has(m) ?? false
          // Model-icons pass: the model's OWN @lobehub family mark per pill
          // (Claude / Gemini / Llama / …), falling back to the active provider's mark
          // — the same single-source seam the composer uses (ICON CONVENTION). Absent
          // both → no icon, so the pill renders exactly as before. gap-1.5 owns the
          // spacing now (the badges dropped their ml-1.5).
          const PillMark = modelLogo(m) ?? ProviderMark
          return (
            <button
              key={m}
              onClick={() => onSelect(m)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full ghost-border transition-all",
                llmModel === m
                  ? "bg-primary/10 text-primary border-primary/30 font-medium"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground",
              )}
            >
              {PillMark && <PillMark size={12} />}
              <span>{m}</span>
              {(isUnverified || isToolsLost) && (
                <span
                  className="text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border"
                  title={unverifiedDescription(
                    m,
                    inferredProviderFor,
                    toolsLostModels ?? EMPTY_MODEL_SET,
                    !isUnverified,
                  )}
                >
                  {isUnverified ? UNVERIFIED.LABEL : NO_TOOLS_LABEL}
                </span>
              )}
              {isDeprecated && (
                <span
                  className="text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border"
                  title="This model is deprecated. It still works, but consider moving to a newer model."
                >
                  deprecated
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
