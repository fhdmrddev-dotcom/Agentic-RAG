/**
 * Phase 190-12 Task 1 (CONN-02 / D-23, UI-SPEC §6c + U-08) — the selected-phase slug seam.
 *
 * ── WHY A CONTEXT AND NOT A PROP ──
 * `patchConfig(slug, patch)` lives on the Builder store (`builderStore.ts:514`), but the
 * store does NOT hold the selected slug: `selectedSlug` is React state on the Builder page
 * (`WorkflowBuilderPage.tsx:582`). So a leaf under the form panel has the store and lacks
 * the slug. Handing the slug down as a prop would mean a fourth prop on
 * `ExternalActionSection`, hence a fourth argument out of `PhaseFormPanel.tsx` — whose
 * required `git diff --numstat` for this whole phase is `0 0` (D-23; the hot-file ledger
 * row says the next surface that needs the panel gets its own component and one gated
 * line, and 189-14 already spent that line). This module is the seam that keeps that
 * promise: the slug travels beside the store, over the same subtree, touching no panel.
 *
 * ── COPIED SHAPE, ON PURPOSE ──
 * `BuilderStoreProvider.tsx` is the in-tree analog and its whole shape is reproduced here:
 * a `createContext<T | null>(null)`, a children-only provider, and a NON-THROWING accessor
 * for leaves. Deliberately different in exactly one way, and the difference is stated
 * rather than left to be noticed: there is NO throwing accessor. `BuilderStore | null` has
 * a null that means "no provider"; `string | null` has a null that means "no phase is
 * selected", which is a real, legitimate, frequently-true value. A throwing accessor could
 * not tell the two apart, so it would either throw on a normal state or promise a
 * non-null it has no way to guarantee.
 *
 * ── THIS PROVIDER RENDERS CHILDREN ONLY, AND THAT PROPERTY IS LOAD-BEARING ──
 * It emits no DOM node. `BuilderStoreProvider`'s own docblock records why (`:17-19`):
 * wrapping the page in something that emits an element would move `graphChild` out of the
 * Builder grid's first-child position and break the D-183-03 flag-off contract
 * (`WorkflowBuilderPage.tsx:520-522`). A wrapper added four phases later inherits that
 * constraint in full, so it is written down here rather than re-derived from a broken test.
 */
import { createContext, useContext } from "react"
import type { ReactNode } from "react"

const SelectedPhaseSlugContext = createContext<string | null>(null)

export interface SelectedPhaseSlugProviderProps {
  /** The Builder page's own `selectedSlug` state — `null` when no step is selected. */
  slug: string | null
  children: ReactNode
}

/** Carry the selected step's slug to the panel subtree. Renders children only — no DOM. */
export function SelectedPhaseSlugProvider({ slug, children }: SelectedPhaseSlugProviderProps) {
  return (
    <SelectedPhaseSlugContext.Provider value={slug}>{children}</SelectedPhaseSlugContext.Provider>
  )
}

/**
 * Non-throwing accessor — `null` outside a provider AND `null` inside one when no step is
 * selected (the `useBuilderStoreOptional` idiom, `BuilderStoreProvider.tsx:45-47`). A leaf
 * that reads this must degrade on `null` rather than assume it away: the shipped
 * `ExternalActionSection.test.tsx` renders the section standalone, with no provider and no
 * store, and a leaf that threw there would turn a shipped suite red for a reason that has
 * nothing to do with what the leaf is for.
 */
export function useSelectedPhaseSlug(): string | null {
  return useContext(SelectedPhaseSlugContext)
}
