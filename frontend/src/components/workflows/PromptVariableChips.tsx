/**
 * Phase 205 (STATE-01 / D-08 / N-2) — PromptVariableChips.
 *
 * Isolated leaf component for quick-inserting stateful template variable tokens
 * ({{prior_run.output}}, {{prior_run.id}}, {{prior_run.created_at}}) into prompt fields.
 *
 * Siting / Zero-Hook Rule (N-2):
 * Extracted as a standalone leaf component so that PhaseFormPanel.tsx preserves its
 * absolute zero hook pin (useState/useMemo/useEffect at 0 in PhaseFormPanel.tsx source).
 */

export interface PromptVariableChipsProps {
  onInsert: (token: string) => void
  isStateful?: boolean
  className?: string
}

export const STATEFUL_VARIABLES = [
  {
    token: "{{prior_run.output}}",
    label: "Prior Output",
    description: "Inserts the deliverable output text from the previous completed run",
  },
  {
    token: "{{prior_run.id}}",
    label: "Prior Run ID",
    description: "Inserts the ID of the previous completed run",
  },
  {
    token: "{{prior_run.created_at}}",
    label: "Prior Timestamp",
    description: "Inserts the ISO creation timestamp of the previous completed run",
  },
] as const

export function PromptVariableChips({
  onInsert,
  isStateful = false,
  className = "",
}: PromptVariableChipsProps) {
  if (!isStateful) {
    return null
  }

  return (
    <div
      data-testid="prompt-variable-chips"
      className={`flex flex-wrap items-center gap-1.5 py-1 ${className}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Variables:
      </span>
      {STATEFUL_VARIABLES.map(({ token, label, description }) => (
        <button
          key={token}
          type="button"
          data-testid={`variable-chip-${token}`}
          title={`${token}: ${description}`}
          onClick={() => onInsert(token)}
          className="inline-flex items-center rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] text-primary transition-colors hover:border-primary hover:bg-primary/10 active:scale-95"
        >
          + {label}
        </button>
      ))}
    </div>
  )
}
