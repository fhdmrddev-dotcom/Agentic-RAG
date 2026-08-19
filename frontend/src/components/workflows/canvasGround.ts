/**
 * The canvas plane's ground, in its own module.
 *
 * WHY IT IS NOT IN `WorkflowCanvas.tsx`. A component file may not export a shared object
 * constant — `react-refresh/only-export-components` says so in as many words, and Phase 199's
 * code review measured this exact error appearing NEW at `WorkflowCanvas.tsx:401` when 199-05
 * added the table there. The project's established answer to that rule is a sibling leaf module
 * (`phaseStatusMeta.ts`, `connectionFormCopy.ts`, `connectionsCopy.ts` … 27 files carry this same
 * header), never an `eslint-disable`: there are zero suppressions of this rule in the tree.
 *
 * ⚠ The rule permits a bare STRING constant beside a component, which is why
 * `BRANCH_CONNECTOR_WORD` may stay in `WorkflowCanvas.tsx` while this object may not. That
 * asymmetry is the rule's, not a preference — do not "tidy" the two into one place on the
 * assumption that they are alike.
 *
 * 199-05 — the plane's ground, stated rather than inherited. See the `<Background>` use site in
 * `WorkflowCanvas.tsx` for why the colour is deliberately absent from this table.
 *
 * Every number was MEASURED off the shipped rendering before it was written down: the library
 * was drawing a 20px dot lattice with a 1px dot, and it still is.
 */
import { BackgroundVariant } from "@xyflow/react"

export const BACKGROUND_GROUND = {
  /**
   * Dots, never lines or crosses — the sheet's commitment and already the shipped one.
   *
   * ⚠ 199-05 — the ENUM, never the string `"dots"`. A typo in a string literal falls back to
   * the library's own default and draws a ground that merely looks committed.
   */
  variant: BackgroundVariant.Dots,
  /** The lattice pitch, in canvas pixels. */
  gap: 20,
  /** One dot, one pixel. The quietest mark this plane draws. */
  size: 1,
} as const
