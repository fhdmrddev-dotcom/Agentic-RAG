import { cn } from "@/lib/utils"

/**
 * ModelPillRow — Phase 075.3 D-075.3-10/11/12
 *
 * Renders the comma-separated active-provider model list as clickable pill
 * buttons. Models not in the verified-registry get an inline amber "unverified"
 * chip with a tooltip explaining the inferred provider + safe defaults.
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
}: ModelPillRowProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {models.map((m) => {
        const isUnverified = !verifiedModels.has(m)
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
          </button>
        )
      })}
    </div>
  )
}
