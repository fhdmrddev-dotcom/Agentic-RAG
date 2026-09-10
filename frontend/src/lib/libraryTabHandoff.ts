/**
 * Phase 235 plan 15 (SURF-03 · gap-closure round 1 · verification G5) —
 * THE LIBRARY TAB HAND-OFF IS AN INTENT THAT IS CONSUMED ONCE, NEVER A MODE.
 *
 * ── ⛔ THE MEASURED DEFECT THIS CLOSES ────────────────────────────────────────────────
 *
 * `App.tsx` set `libraryTab = "health"` in `handleOpenLibraryHealth` and NEVER cleared it —
 * `grep setLibraryTab frontend/src/App.tsx` returned exactly ONE write. `ChatLayout` renders
 * `<LibraryPage>` inside a ternary, so the page UNMOUNTS on navigation away and re-seeds its
 * reducer from `initialTab` at every mount. **After ONE click on the attention popover, every
 * subsequent entry into the Library opened on Health** — contradicting `App.tsx`'s own comment
 * (*"`undefined` means 'the page decides', so the Library keeps its own default on every other
 * entry into it"*). One click silently redefined where a whole surface opens, forever.
 *
 * ── THE RULE, AND WHY IT IS SHAPED THIS WAY ───────────────────────────────────────────
 *
 * A hand-off is cleared by the NAVIGATOR, not by a second writer:
 *
 *   • navigating INTO the Library KEEPS it — clearing on the way in would clear the intent
 *     before the page that consumes it had mounted, and the badge route would do nothing.
 *   • navigating anywhere ELSE clears it — the page it was meant for has unmounted, so the
 *     intent has either been honoured or abandoned. Either way it is spent.
 *   • an absent hand-off stays absent — idempotent, never resurrected.
 *
 * ⚠ There is no URL in any of this. This app has no router (`SEED-185`), so navigation is a
 * `useState<ActiveView>` switch in `App.tsx` and a hand-off is plain component state. That is
 * exactly why it needed an explicit clearing rule: a URL would have been discarded by the next
 * navigation for free, and state is not.
 *
 * ⛔ THIS MODULE IS A STRICT LEAF. No React, no runtime imports, nothing to mock. It is a
 * function of two values, so the rule can be tested without mounting anything — the shipped
 * "seeds, never pins" case could not see this defect precisely because it lived between mounts
 * rather than inside one, and a rule that can only be exercised through a mount inherits that
 * blind spot.
 */

/**
 * The `ActiveView` member the Library renders on.
 *
 * ⚠ Kept as a local literal rather than imported from `App.tsx`: this leaf must stay free of
 * the app-shell import graph (the `citationNav.tsx` precedent, which keeps its own
 * `CitationTargetView` for the same reason — no import cycle through the root component).
 */
export const LIBRARY_VIEW = "documents"

/**
 * What the pending Library-tab hand-off becomes after a navigation to `nextView`.
 *
 * Generic in the tab type so this leaf never imports `LibraryTab` — the caller owns the
 * vocabulary, this owns the lifetime.
 *
 * @param pending  the hand-off currently held above the page, if any
 * @param nextView the `ActiveView` being navigated to
 * @returns the hand-off to keep holding, or `undefined` once it is spent
 */
export function libraryTabAfterNavigate<T>(pending: T | undefined, nextView: string): T | undefined {
  if (pending === undefined) return undefined
  return nextView === LIBRARY_VIEW ? pending : undefined
}
