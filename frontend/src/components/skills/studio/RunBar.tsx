// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 03 Task 3 (PANEL-01 / D-12) — RunBar.
// Phase 137.1 Plan 08 Task 1 (EVAL-05 / 058-A) — + matrix launcher.
//
// The compact launch surface for the Evals tab: a one-row provider `<select>` +
// model `<select>` + Run button. It is a PURE controlled component — EvalsTab
// (Plan 05) owns the provider/model state so the selection is preserved across
// skills (D-12). RunBar holds NO fetch/launch logic of its own; pressing Run just
// calls the `onRun` prop (the container owns the eval-run launch API call). While a run streams the
// controls disable and the button shows a spinner; the live run appears as the top
// expandable row in RunHistory (D-12).
//
// 137.1 (058-A): a SECOND, additive launcher rides beside the UNCHANGED single-run
// bar — a one-click "⧉ Run matrix (N configured)" button + an inline gate-feeder
// `<select>` (which provider's rows feed the publish gate; D-05). Still pure and
// controlled: the container owns `startMatrixRun` + the gate-feeder state. The matrix
// affordance renders ONLY when `onRunMatrix` is supplied, so the single-run contract
// (and its tests) is byte-unchanged. `running` disables BOTH launchers — one claim
// per skill (D-06), a live run holds it until it finishes.
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
  // ── 137.1 (058-A) matrix launcher — all OPTIONAL so the single-run path is
  //    unchanged (absent → no matrix UI renders; existing consumers/tests untouched). ──
  /** The configured providers the matrix fans across (also the gate-feeder options)
   *  — the launch label reads "Run matrix (N configured)" off its length. */
  configuredProviders?: ProviderOption[]
  /** The designated gate-feeder provider id (controlled; the container defaults it to
   *  the active provider). Its arm's rows feed the publish gate (D-05). */
  gateProvider?: string
  onGateProviderChange?: (provider: string) => void
  /** Launch the matrix run across all configured providers (container owns the call).
   *  Absent → the matrix launcher is not rendered. */
  onRunMatrix?: () => void
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
  configuredProviders,
  gateProvider,
  onGateProviderChange,
  onRunMatrix,
}: Props) {
  const disabled = running || !provider || !model
  // 058-A: the matrix launcher is additive — only when the container wires it.
  const matrixCount = configuredProviders?.length ?? 0
  const matrixDisabled = running || matrixCount === 0

  return (
    <div data-testid="run-bar" className="flex flex-col gap-2">
      {/* ── Single-run bar (UNCHANGED — the D-12 controlled picker + Run). ── */}
      <div className="flex flex-wrap items-center gap-2">
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

      {/* ── 058-A matrix launcher (additive; beside the single-run bar). ── */}
      {onRunMatrix && (
        <div
          data-testid="matrix-launch"
          className="flex flex-wrap items-center gap-2 border-t border-border/20 pt-2"
        >
          <label
            htmlFor="matrix-gate-feeder"
            className="text-[11px] font-medium text-muted-foreground"
          >
            feeds gate:
          </label>
          <select
            id="matrix-gate-feeder"
            aria-label="Gate feeder"
            className="rounded border border-border/30 bg-background px-2 py-1 text-xs"
            value={gateProvider ?? ""}
            disabled={running}
            onChange={(e) => onGateProviderChange?.(e.target.value)}
          >
            {matrixCount === 0 && <option value="">No providers</option>}
            {(configuredProviders ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 text-xs"
            onClick={onRunMatrix}
            disabled={matrixDisabled}
            data-testid="run-matrix"
          >
            <span aria-hidden>⧉</span>
            Run matrix ({matrixCount} configured)
          </Button>

          <span className="text-[11px] text-muted-foreground/70">
            One run per skill — a live run holds the claim until it finishes.
          </span>
        </div>
      )}
    </div>
  )
}
