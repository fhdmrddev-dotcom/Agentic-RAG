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
 */
import { Button } from "@/components/ui/button"

/** S1's words (297-UI-SPEC Copywriting Contract). One home: tests assert these rendered. */
// eslint-disable-next-line react-refresh/only-export-components -- the copy lives beside the one component that renders it, so its suite asserts the same words the screen shows (the ArtifactTooltip.tsx precedent)
export const ADDRESS_NOT_FOUND_COPY = {
  heading: "This address doesn't open anything",
  body: "It may be mistyped or out of date.",
  cta: "Go to Chat",
} as const

/** S2's admin sentence: neutral by design, so it names nothing a non-operator could learn. */
export const ADMIN_HOLD_COPY = "Opening…"

export function AddressNotFound({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 gap-3 text-center">
      <h1 className="text-base font-medium text-foreground">{ADDRESS_NOT_FOUND_COPY.heading}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{ADDRESS_NOT_FOUND_COPY.body}</p>
      <Button variant="outline" size="sm" onClick={onGoHome}>
        {ADDRESS_NOT_FOUND_COPY.cta}
      </Button>
    </div>
  )
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
