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
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PHASE 199 PLAN 07 (sheet `c8-run-panel`) — THE SUBTRACTION, AND ONLY THAT.
 *
 * The decorative `Inbox` glyph is REMOVED. Both of sheet c8's empty states — the
 * files-empty box and the empty panel itself — spend ZERO marks: a dashed frame
 * and one sentence. The glyph carried no meaning a reader could use; it was a
 * mark spent on nothing, in the one place the panel's whole job is to be quiet.
 *
 * ⚠ WHAT DID **NOT** GO, and why, so a later reader does not "finish the job":
 *   · the HEADING stays — it is the state, and it is asserted in four places.
 *   · the HINT stays — it is the atom sheet c8 AGREES with. The sheet's own empty
 *     panel is exactly one forward-looking sentence ("Workflow results will appear
 *     here during execution"), so cutting the hint would remove the very thing the
 *     sheet keeps and leave only the thing it drops. "Text is noise — cut it, BUT
 *     THE PURPOSE MUST SURVIVE THE CUT."
 *   · the sheet's own wording is NOT adopted: it names a workflow, and this shell
 *     is mounted by `ChatLayout` on every Deep thread. A person doing plain Q&A
 *     would be told to wait for an execution that is never coming.
 *
 * ⚠ AND THE BLAST RADIUS IS **CHAT**, not the workflow surface. This component is
 *   reachable only through `WorkspacePanel`, whose one mount is `ChatLayout`.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function PanelEmpty({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center text-panel-muted-foreground-dim">
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
