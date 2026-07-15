import { cn } from "@/lib/utils"
import { providerLogo } from "@/lib/providerLogo"

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

/**
 * Builds the locked tooltip text per D-075.3-12 — substitutes the inferred
 * provider + provider-specific max_tokens safe default (D-075.3-07: 4096 for
 * openrouter, 8192 for the big-3 + ollama).
 */
function _tooltipFor(model: string, inferredProviderFor: Record<string, string>): string {
  const provider = inferredProviderFor[model] ?? "ollama"
  const maxTokens = provider === "openrouter" ? 4096 : 8192
  return `This model isn't in our verified registry. Using inferred provider: ${provider}. Safe defaults applied (max_tokens=${maxTokens}, timeout=90s).`
}

export function ModelPillRow({
  models,
  llmModel,
  verifiedModels,
  inferredProviderFor,
  onSelect,
  deprecatedModels,
  providerId,
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
          const isDeprecated = deprecatedModels?.has(m) ?? false
          return (
            <button
              key={m}
              onClick={() => onSelect(m)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full ghost-border transition-all",
                llmModel === m
                  ? "bg-primary/10 text-primary border-primary/30 font-medium"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
              {isUnverified && (
                <span
                  className="ml-1.5 text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border"
                  title={_tooltipFor(m, inferredProviderFor)}
                >
                  unverified
                </span>
              )}
              {isDeprecated && (
                <span
                  className="ml-1.5 text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border"
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
