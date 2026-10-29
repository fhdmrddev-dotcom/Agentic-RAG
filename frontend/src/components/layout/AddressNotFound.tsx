/**
 * Phase 297-02 (LINK-01 / D-14, D-19, D-34, D-35, D-36) — the two address states.
 *
 * S1 `AddressNotFound`: the address names nothing the app opens, or names an admin page for a
 * person who is not an operator once the probe has answered. Both say the SAME words, so the
 * state cannot be used to learn which admin addresses exist (T-297-07). It renders inside the
 * layout, as the first arm of `AppViewSwitch`'s non-chat side, with the rail still usable.
 *
 * S2 `AddressHolding`: a cold deep link is waiting on the gate that decides it (the canvas
 * feature for a run, the operator probe for the admin pages). It holds INSIDE the switch, never
 * at App level, because an App-level hold would unmount the streams provider (D-34).
 *
 * ⛔ No path prop, no icon. The requested address is never echoed back (content spoofing,
 * T-297-09); the copy below is the only text either state shows, and this module is its home.
 * ⛔ Not the trailing fallback, and never renders it: that element keeps exactly one home, as the
 * switch's last arm, because two fences measure its position.
 *
 * ⚠ Phase 299-03 (D-14), beside the paragraphs above rather than through them: S1 is now the
 * unparseable variant of `CantBeOpened` (the one in-place card), and its copy lives there. This
 * module keeps `AddressNotFound`, `ADMIN_HOLD_COPY` and `AddressHolding` under the same names.
 */
import { CantBeOpened } from "./CantBeOpened"

// Phase 299-03 (D-14 / UI-D4): S1's words moved VERBATIM into the one card's module and are
// re-exported here under the same name, so the admin refusal arms and every 297 suite keep importing
// them from this file. The import direction is one way (this module → CantBeOpened), so no cycle.
export { ADDRESS_NOT_FOUND_COPY } from "./CantBeOpened"

/** S2's admin sentence: neutral by design, so it names nothing a non-operator could learn. */
export const ADMIN_HOLD_COPY = "Opening…"

export function AddressNotFound({ onGoHome }: { onGoHome: () => void }) {
  // Phase 299-03 (D-14): the unparseable variant of the one card — same words, no address line,
  // no Copy address. Below md it sits over the main region alone.
  return <CantBeOpened kind={null} route={null} onGo={onGoHome} />
}

/** S2 — the markup of `WorkflowRunPage`'s own loading state, plus `role="status"`, so the hand-off
 *  from this hold to the page's loading state is invisible (one sentence, one position). */
export function AddressHolding({ sentence }: { sentence: string }) {
  return (
    <div role="status" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">{sentence}</p>
    </div>
  )
}
