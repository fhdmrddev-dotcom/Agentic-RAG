/**
 * The field-guidance reading — its context, its hook, and the two words its control wears.
 *
 * ⚠ NAMED `fieldGuidanceContext.ts`, NOT `fieldGuidance.ts`. A leaf whose name differs from its
 * component sibling ONLY IN CASE is a hard TypeScript error on a case-insensitive filesystem
 * (TS1149/TS1261, measured on this Windows box: `tsc` went 33 → 38 on the first attempt). The
 * suffix is load-bearing, not decoration.
 *
 * WHY THESE ARE NOT IN `FieldGuidance.tsx`. A component file may not export a shared HOOK —
 * `react-refresh/only-export-components` says so in as many words, and Phase 199's code review
 * measured that error appearing NEW at `FieldGuidance.tsx:79`. The project's established answer
 * is a sibling leaf module (`phaseStatusMeta.ts`, `connectionFormCopy.ts`, `connectionsCopy.ts`
 * … 27 files carry this same header), never an `eslint-disable`: there are zero suppressions of
 * this rule in the tree.
 *
 * ⚠ This module is a TRUE LEAF and must stay one — it imports only from `react`. The switch's
 * own markup and its `useState` stay in `FieldGuidance.tsx`, which is the whole reason that file
 * exists: `PhaseFormPanel.test.tsx` pins the panel's `useState`/`useMemo`/`useEffect` count at an
 * ABSOLUTE ZERO over the panel's own source, so the disclosure switch's state had to live
 * somewhere that was not the panel. Moving state back into either file re-breaks that pin.
 */
import { createContext, useContext } from "react"

/**
 * ⚠ DEFAULT `true` — see `FieldGuidance.tsx`'s docblock. Outside a provider every consumer
 * renders its guidance, which is the pre-199-06 surface exactly.
 */
export const FieldGuidanceContext = createContext<boolean>(true)

/** The control's word while the explanations are hidden — an offer, not a mechanism. */
export const FIELD_GUIDANCE_SHOW = "Explain each field"

/** The control's word while they are shown. */
export const FIELD_GUIDANCE_HIDE = "Hide the explanations"

/**
 * Is the fully-open reading in effect?
 *
 * NON-THROWING, the `useSelectedPhaseSlug` idiom: there is no "no provider" error state to
 * report, because the absence of a provider has a correct answer (`true`) rather than an
 * undefined one.
 */
export function useFieldGuidance(): boolean {
  return useContext(FieldGuidanceContext)
}
