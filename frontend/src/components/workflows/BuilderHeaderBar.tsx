/**
 * Phase 184.1-01 (D-184.1-01 … D-184.1-03) — THE MERGED HEADER ROW.
 *
 * Operator-reported in the Phase 184 UAT: *"the canvas space is very narrow because the
 * header above is taking too much space… especially with the smaller screens."* Measured
 * on a 639 px window: 275 px of chrome above a 288 px canvas — the flow got 45 % of the
 * screen, and 146 px of that was three stacked bands doing one band's job.
 *
 * IT OWNS LAYOUT AND NOTHING ELSE (D-184.1-02). `lead` and `trail` arrive as opaque nodes
 * from the two ANCESTOR band owners; every control in them keeps its original owner, its
 * original handler and its original state. `← Workflows` still closes over `WorkflowsPage`'s
 * `backToLibrary`, `‹ both doors` still closes over `WorkflowDoorSwitch`'s `goBoth`. This is
 * a re-flow of where things are drawn, not a move of what owns them — which is also why
 * nothing here needs to know what it is rendering.
 *
 * NOTHING IS REMOVED. Every control, badge and label from all three bands survives and keeps
 * its accessible name, including the `🔧 Author & govern` label that the plan's illustrative
 * row sketch omitted.
 *
 * IT WRAPS RATHER THAN TRUNCATES. `flex-wrap` lets the trailing group fall to a second line
 * on a narrow window instead of overflowing or eliding a control — two rows is still one
 * band better than the three this replaces, which is the point at ~900 px where the
 * operator's complaint actually lives.
 *
 * ── 186-07 MOVED THE FILE, NOTHING ELSE (G-5) ────────────────────────────────────
 *
 * It was declared inside `WorkflowBuilderPage.tsx` until 186-07, which had to compose
 * autosave into that hot file without growing it. This component is pure layout with no
 * state, no handler and no knowledge of its children, so the move is byte-neutral at the
 * DOM — which is what lets `WorkflowBuilderPage.header.test.tsx`'s literal markup pin pass
 * unedited on both sides of it. Not one class, element or attribute changed.
 */
export function BuilderHeaderBar({
  lead,
  trail,
  identity,
  actions,
}: {
  lead?: React.ReactNode
  trail?: React.ReactNode
  identity?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <header
      data-testid="builder-header-bar"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {lead}
        {identity}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {trail}
        {actions}
      </div>
    </header>
  )
}
