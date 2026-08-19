/**
 * Phase 200-06 (`BUG-260813-01`) — THIS MODULE NO LONGER HOLDS ANY STATE.
 *
 * It used to be a bare per-consumer hook: its own `useState`, plus an effect that wrote
 * localStorage and toggled the root `dark` class, with exactly ONE consumer in the tree
 * (`ChatLayout.tsx:111`) and no provider anywhere. That shape is what made
 * `BUG-260813-01` unfixable in one line — a second call site would have forked the state
 * into two `useState`s and two writers, neither re-rendering the other, so the workflow
 * canvas would have read the theme once at mount and then ignored every toggle.
 *
 * The state moved to `providers/ThemeProvider.tsx`, which is where the reasoning lives.
 * What is left here is a RE-EXPORT, and it is deliberate rather than laziness:
 *
 *  - **The import path is the seam three shipped suites mock.** `ChatLayout.launch.test.tsx`,
 *    `ChatLayout.orgRefetch.test.tsx` and `__tests__/ChatLayoutLaunch.test.tsx` each carry
 *    `vi.mock("@/hooks/useTheme", …)`. Moving `ChatLayout`'s import would make all three
 *    mocks INERT — silently, since a `vi.mock` of a module nobody imports does not fail —
 *    and the real throwing hook would then run with no provider in those trees. Keeping the
 *    path keeps the mocks pointed at what they were written to intercept.
 *  - **It is a re-export, not a shim with behaviour.** There is exactly one implementation
 *    and exactly one state; this file adds no second one and cannot drift from the first.
 *
 * ⚠ THE HOUSE RULE THIS BENDS, STATED RATHER THAN SLIPPED PAST: 188.2-06 left NO re-export
 * behind on its extraction, on the grounds that a re-export is *"a SECOND NAME for the same
 * type, free to be the one a later phase imports by accident"*. That objection is about
 * TYPES with two importable names. Here the risk it protects against — two theme states —
 * is structurally impossible: this file declares no state and re-exports the one hook that
 * throws unless the single provider is above it. A leaf wanting a non-throwing read imports
 * `useThemeOptional` from the provider directly, which this file deliberately does NOT
 * re-export, so there is exactly one door for exactly one purpose.
 */
export { useTheme } from "@/providers/ThemeProvider"
export type { Theme, ThemeValue } from "@/providers/ThemeProvider"
