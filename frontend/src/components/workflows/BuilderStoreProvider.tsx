/**
 * Phase 184 Wave 0 (D-184-01) — the per-mount Builder store context.
 *
 * `builderStore.ts` is a FACTORY, so the instance has to travel to the canvas leaves
 * somehow. This is that seam, and it is deliberately shaped like the shipped
 * `TechnicalNamesProvider`: a throwing accessor for writers that must be inside the
 * provider by construction, and an OPTIONAL accessor for leaves.
 *
 * WHY THE OPTIONAL ACCESSOR MATTERS. `WorkflowCanvas.tsx:181-183` already reads the
 * app-wide reveal through `useTechnicalNamesOptional()` precisely so a leaf still renders
 * in a provider-less unit test, and `PhaseNodeCard` (plan 184-03) is provably renderable
 * with a plain `render()`. Making this store a REQUIRED context for leaves would throw
 * that away — a card would start needing a Builder session to be rendered at all, and
 * Phase 188's reuse of the same card outside the Builder would break. Leaves read
 * `useBuilderStoreOptional()` and fall back honestly when it is null.
 *
 * This provider renders CHILDREN ONLY. It emits no DOM element, so wrapping the page in
 * it cannot move `graphChild` out of the grid's first-child position — the D-183-03
 * flag-off contract (`WorkflowBuilderPage.tsx:520-522`) survives untouched.
 */
import { createContext, useContext } from "react"
import type { ReactNode } from "react"
import { useStore } from "zustand"
import type { TemporalState } from "zundo"

import type { BuilderStore, TrackedSlice } from "@/components/workflows/builderStore"

const BuilderStoreContext = createContext<BuilderStore | null>(null)

export interface BuilderStoreProviderProps {
  /** The per-mount store, created ONCE by the Builder page. Never a module singleton. */
  store: BuilderStore
  children: ReactNode
}

/** Carry one Builder mount's store to its subtree. Renders children only — no DOM. */
export function BuilderStoreProvider({ store, children }: BuilderStoreProviderProps) {
  return <BuilderStoreContext.Provider value={store}>{children}</BuilderStoreContext.Provider>
}

/**
 * Non-throwing accessor — `null` outside a provider (the `useTechnicalNamesOptional`
 * idiom). Leaves use this so an isolated render still works.
 */
export function useBuilderStoreOptional(): BuilderStore | null {
  return useContext(BuilderStoreContext)
}

/**
 * Throwing accessor, for consumers that genuinely require the store (the page itself,
 * the canvas toolbar). A named error beats a null-deref three frames down.
 */
export function useBuilderStore(): BuilderStore {
  const store = useContext(BuilderStoreContext)
  if (store === null) {
    throw new Error("useBuilderStore must be used within a BuilderStoreProvider")
  }
  return store
}

/**
 * Read the UNDO HISTORY reactively.
 *
 * THE REACT-19 RULE, and the whole reason this hook exists: `store.temporal.getState()`
 * inside a component is a SNAPSHOT, not a subscription. zundo upstream issue #207
 * ("React 19 Compiler issue", closed as working-as-intended) records the maintainer's
 * answer verbatim — changes to `pastStates` / `futureStates` never force a re-render
 * when read that way, so an undo/redo button's disabled state would simply never update.
 * Any RENDERED value must come through this selector:
 *
 *   const canUndo = useBuilderTemporal((t) => t.pastStates.length > 0)
 *
 * SIDE-EFFECT calls may still use `getState()` — `store.temporal.getState().undo()` in a
 * click handler is not a rendered value and is correct. Note also that `undo(n)`/`redo(n)`
 * splice `pastStates` IN PLACE before calling `set`, so a `.length` selector fires but a
 * selector returning the ARRAY itself may not; prefer length/boolean selectors.
 */
export function useBuilderTemporal<T>(selector: (state: TemporalState<TrackedSlice>) => T): T {
  const store = useBuilderStore()
  return useStore(store.temporal, selector)
}
