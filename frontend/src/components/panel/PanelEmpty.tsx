/**
 * Phase 087 Plan 02 Task 1 — PanelEmpty (PANEL-01, sketch 004 / panel-shell.md D3).
 *
 * The empty short-circuit. A plain Q&A chat has no workspace activity — the
 * common case. Rather than surrender ~30% width to four empty section headers,
 * WorkspacePanel renders this ONE calm centered state (panel-shell.md "What to
 * Avoid": never four empty headers). Fills the panel body; calm, never loud.
 *
 * Copy verbatim from UI-SPEC Copywriting Contract (Claude's-discretion default,
 * confirmed in CONTEXT): heading "No workspace activity yet" + the body hint.
 */
import { Inbox } from "lucide-react"

export function PanelEmpty({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center text-panel-muted-foreground-dim">
      <Inbox className="h-7 w-7 opacity-50" aria-hidden="true" />
      <h3 className="text-sm font-normal text-panel-muted-foreground">
        No workspace activity yet
      </h3>
      <p className="max-w-[220px] text-[0.72rem] leading-relaxed">
        When the agent writes files, tracks todos, or needs your input, it'll show
        up here.
      </p>
      {/* Phase 100 (D-01): the calm state may carry ONE quiet action (e.g. the
          template-upload affordance) — still one centered state, no headers. */}
      {children}
    </div>
  )
}

export default PanelEmpty
