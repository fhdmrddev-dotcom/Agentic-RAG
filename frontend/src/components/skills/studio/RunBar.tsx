// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 03 Task 3 (PANEL-01 / D-12) — RunBar.
//
// The compact launch surface for the Evals tab: a one-row provider `<select>` +
// model `<select>` + Run button. It is a PURE controlled component — EvalsTab
// (Plan 05) owns the provider/model state so the selection is preserved across
// skills (D-12). RunBar holds NO fetch/launch logic of its own; pressing Run just
// calls the `onRun` prop (the container owns the eval-run launch API call). While a run streams the
// controls disable and the button shows a spinner; the live run appears as the top
// expandable row in RunHistory (D-12).
// ─────────────────────────────────────────────────────────────────────────────
import { Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProviderOption {
  id: string
  name: string
  models: string[]
}

interface Props {
  /** The full provider list (each carries its own models) — used both to populate
   *  the provider select and to derive the new provider's first model on change. */
  providers: ProviderOption[]
  /** The selected provider id (controlled by the container). */
  provider: string
  /** The selected model id (controlled by the container). */
  model: string
  /** The models for the currently-selected provider (populates the model select). */
  models: string[]
  onProviderChange: (provider: string) => void
  onModelChange: (model: string) => void
  /** True while an eval run streams — disables the controls + spins the button. */
  running: boolean
  onRun: () => void
}

export function RunBar({
  providers,
  provider,
  model,
  models,
  onProviderChange,
  onModelChange,
  running,
  onRun,
}: Props) {
  const disabled = running || !provider || !model

  return (
    <div data-testid="run-bar" className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Provider"
        className="rounded border border-border/30 bg-background px-2 py-1 text-xs"
        value={provider}
        disabled={running}
        onChange={(e) => {
          const next = e.target.value
          onProviderChange(next)
          // Changing the provider resets the model to the new provider's first
          // model (mirrors SkillEvalSection :574-579).
          const np = providers.find((p) => p.id === next)
          onModelChange(np?.models?.[0] ?? "")
        }}
      >
        {providers.length === 0 && <option value="">No providers</option>}
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Model"
        className="rounded border border-border/30 bg-background px-2 py-1 text-xs"
        value={model}
        disabled={running}
        onChange={(e) => onModelChange(e.target.value)}
      >
        {models.length === 0 && <option value="">No models</option>}
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <Button
        type="button"
        size="sm"
        className="gap-1 text-xs"
        onClick={onRun}
        disabled={disabled}
      >
        {running ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        Run eval
      </Button>
    </div>
  )
}
