/**
 * Phase 217-05 (LIB-01 / SC#5 / D-217-12 / D-217-14) — the ONE source of selection truth
 * for the Library page.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────────────────
 * The folder/view mutual exclusion (UX-01 / D-114-1) ships today in TWO places:
 *   1. paired `setState` calls — `IngestionPage.tsx:241-242` and `:251-252` set one id and
 *      null the other, and are correct only for as long as the two lines stay adjacent;
 *   2. a render-time ternary — `IngestionPage.tsx:307`
 *      (`selectedViewId === null ? selectedFolderId : null`) re-decides the SAME question
 *      a second time, at draw time, from the same two variables.
 * One invariant, two encodings. A tab bar arriving on top of that would make three, and
 * SC#5 forbids the renderings disagreeing. A discriminated union makes the disagreement
 * UNREPRESENTABLE rather than merely avoided: a folder id and a view id cannot both be
 * held, because there is no value of `LibrarySelection` that carries both.
 *
 * ── A STRICT LEAF ─────────────────────────────────────────────────────────────────────
 * Zero imports of any kind — not a component, not a type, not a vocabulary. No React, no
 * component state, no effects, no network call, no browser storage — and the suite greps
 * this file for each of those, so the claim is checked rather than asserted.
 * `libraryReducer` is a pure,
 * TOTAL function of `(state, action)`: every action on every arm returns a valid state.
 * It never throws, never returns a partial state and contains no `as any`.
 *
 * The shapes it needs from `@/types` are expressed STRUCTURALLY (`LibraryFilterLike`,
 * `LibraryViewLike`) and reached through two type parameters, so the concrete `ViewFilter`
 * and `SavedView` flow through the reducer unchanged and come back out as themselves.
 * Plan 09 wires it as:
 *
 *     const [lib, dispatch] = useReducer(
 *       libraryReducer<ViewFilter, SavedView>,
 *       initialLibraryState,
 *     )
 *
 * ── ⚠ DERIVED DISPLAY VALUES, NEVER STORED ───────────────────────────────────────────
 * `activeFolderId(state)` and `activeViewId(state)` are the ONLY sanctioned way to ask
 * "which folder is selected / which view is loaded". They read the selection arm and
 * nothing else, and each returns `null` on every arm that does not carry that id. They
 * REPLACE the render-time ternary at `IngestionPage.tsx:307` — a consumer that re-derives
 * either one from the raw fields has re-created the second encoding this module deletes.
 *
 * `parkedFolderId` / `parkedViewId` are ARM MEMOS and are NOT the selection. They exist so
 * that a tab round-trip (`documents` -> `ingestion` -> `documents`) re-enters the arm the
 * user left rather than resetting it. ⚠ NOTHING may read a parked id to decide what the
 * list shows — `activeFolderId` and `activeViewId` deliberately ignore them, and the suite
 * asserts that a parked id never leaks into either accessor.
 *
 * ── ⛔ WHAT THIS MODULE CANNOT PRODUCE ────────────────────────────────────────────────
 * It holds NO async results and NO request bookkeeping. Three pieces of `IngestionPage`
 * state transition alongside the selection today and are deliberately EXCLUDED:
 *   - `filteredDocs` (`:103`) — the resolved document list. An ASYNC RESULT of a network
 *     round-trip, arriving after the state that requested it. Folding it in would make the
 *     reducer impure or make the selection wait on I/O.
 *   - `matchCount`  (`:107`) — the DISTINCT-deduped count from that same resolve. Same
 *     reason, same round-trip.
 *   - `filterReqId` (`:108`, a `useRef`) — the stale-resolve guard. It is a mutable
 *     concurrency token whose whole job is to be written outside the render cycle; a
 *     reducer that owned it would have to re-render to invalidate a request.
 * A later plan MUST NOT fold these in. They are not selection; they are what the selection
 * caused, and one source of truth is not helped by absorbing its own downstream effects.
 *
 * It also produces no route, no URL and no persisted value — the Library's navigation is
 * state-based (no react-router), exactly as Phase 114 shipped it.
 *
 * ── ⛔ THE EMPTY FILTER IS `null` HERE, ON PURPOSE ────────────────────────────────────
 * `filter: F | null`, where `null` means "no filter composed" — the state the shipped code
 * spells `EMPTY_FILTER` (`types/index.ts:331`, `{ op: "and", conditions: [] }`). A
 * zero-import module cannot import that constant, and DECLARING A SECOND ONE would be the
 * duplicate encoding this file exists to remove. The consumer renders
 * `lib.filter ?? EMPTY_FILTER`; `librarySelection.test.ts` fences the equivalence against
 * the real constant so it cannot drift.
 */

// ── THE STRUCTURAL SHAPES ─────────────────────────────────────────────────────────────
//
// The minimum this module needs to know about a filter and a saved view. `ViewFilter` and
// `SavedView` from `@/types` satisfy these structurally, so nothing is cast at the seam.

/** A filter, as this module needs it: an opaque payload it stores and hands back. */
export interface LibraryFilterLike {
  op: "and"
  conditions: readonly unknown[]
}

/** A saved view, as this module needs it: an id and the filter it loads. */
export interface LibraryViewLike<F extends LibraryFilterLike = LibraryFilterLike> {
  id: string
  filter_expr: F
}

// ── THE UNION (D-217-12) ──────────────────────────────────────────────────────────────

/** The five Library tabs. The tab is part of the selection, never a variable beside it. */
export type LibraryTab = "documents" | "views" | "ingestion" | "indexing" | "health"

/**
 * The selection, as ONE value.
 *
 * ⚠ THE `?: never` MEMBERS ARE LOAD-BEARING, NOT DECORATION. TypeScript's excess-property
 * check against a union accepts any property declared by ANY constituent, so without them
 * `{ tab: "ingestion", folderId: "f1" }` would typecheck as a `LibrarySelection`. With
 * them it does not, and neither does `{ tab: "documents", folderId: "f1", viewId: "v1" }`
 * — which is the mutual exclusion, enforced by the compiler rather than by a convention.
 */
export type LibrarySelection =
  | { tab: "documents"; folderId: string | null; viewId?: never }
  | { tab: "views"; viewId: string | null; folderId?: never }
  | { tab: "ingestion"; folderId?: never; viewId?: never }
  | { tab: "indexing"; folderId?: never; viewId?: never }
  | { tab: "health"; folderId?: never; viewId?: never }

// ── THE STATE ─────────────────────────────────────────────────────────────────────────

/**
 * Everything that transitions in LOCKSTEP with the selection and is NOT an async result.
 * Four live fields plus the two inert arm memos.
 */
export interface LibraryState<
  F extends LibraryFilterLike = LibraryFilterLike,
  V extends LibraryViewLike<F> = LibraryViewLike<F>,
> {
  /** The single source of selection truth. */
  readonly selection: LibrarySelection
  /** The view being EDITED (D-114-3): a Save PATCHes this view instead of POSTing a new
   *  one. Cleared by every context switch and by the deletion of that same view. */
  readonly editingView: V | null
  /** The controlled filter the bar shows. `null` == the empty filter (see the docblock). */
  readonly filter: F | null
  /** Mobile only: the folder tree's bottom-sheet. Closed by a folder or view selection. */
  readonly folderSheetOpen: boolean
  /** ⚠ ARM MEMO — NOT the selection. Read only by `SELECT_TAB` re-entry. */
  readonly parkedFolderId: string | null
  /** ⚠ ARM MEMO — NOT the selection. Read only by `SELECT_TAB` re-entry. */
  readonly parkedViewId: string | null
}

/**
 * The opening state: the Documents tab, no folder, no view, no filter.
 *
 * Typed at `LibraryState<never, never>` so it is assignable to EVERY instantiation — all
 * of its nullable fields are `null`, so it carries no filter or view type of its own.
 */
export const initialLibraryState: LibraryState<never, never> = {
  selection: { tab: "documents", folderId: null },
  editingView: null,
  filter: null,
  folderSheetOpen: false,
  parkedFolderId: null,
  parkedViewId: null,
}

// ── THE ACTIONS ───────────────────────────────────────────────────────────────────────
//
// Named after the five shipped handlers, so the mapping to `IngestionPage.tsx` is obvious:
//   SELECT_FOLDER -> handleSelectFolder (:240)   SELECT_VIEW   -> handleSelectView  (:249)
//   EDIT_VIEW     -> handleEditView     (:259)   CHANGE_FILTER -> handleFilterChange(:273)
//   DELETE_VIEW   -> handleDeletedView  (:290)   SELECT_TAB    -> new in Phase 217

export type LibraryAction<
  F extends LibraryFilterLike = LibraryFilterLike,
  V extends LibraryViewLike<F> = LibraryViewLike<F>,
> =
  | { type: "SELECT_FOLDER"; folderId: string | null }
  | { type: "SELECT_VIEW"; view: V }
  | { type: "EDIT_VIEW"; view: V }
  | { type: "CHANGE_FILTER"; filter: F }
  | { type: "DELETE_VIEW"; viewId: string }
  | { type: "SELECT_TAB"; tab: LibraryTab }

/** The reducer's signature, exported so a consumer can name it at a concrete instantiation
 *  without repeating the parameter list. */
export type LibraryReducer<
  F extends LibraryFilterLike = LibraryFilterLike,
  V extends LibraryViewLike<F> = LibraryViewLike<F>,
> = (state: LibraryState<F, V>, action: LibraryAction<F, V>) => LibraryState<F, V>

// ── THE REDUCER ───────────────────────────────────────────────────────────────────────

/**
 * Total over the cross-product: every action against every arm returns a valid state.
 */
export function libraryReducer<
  F extends LibraryFilterLike = LibraryFilterLike,
  V extends LibraryViewLike<F> = LibraryViewLike<F>,
>(state: LibraryState<F, V>, action: LibraryAction<F, V>): LibraryState<F, V> {
  switch (action.type) {
    // ⭐ D-217-14 — THE TAB FOLLOWS THE SELECTION. Picking a folder while a view is loaded
    // yields the `documents` arm, ALWAYS. There is no reachable result in which the tab
    // stayed on `views` while the list beneath it showed a folder.
    case "SELECT_FOLDER":
      return {
        selection: { tab: "documents", folderId: action.folderId },
        editingView: null, // leaving the view surface exits edit mode (D-114-3)
        filter: null, // == EMPTY_FILTER at the consumer boundary
        folderSheetOpen: false,
        parkedFolderId: action.folderId,
        parkedViewId: null, // the view was abandoned; re-entry must not resurrect it
      }

    // The mirror image: picking a view yields the `views` arm and loads its filter back
    // INTO the same bar (D-114-1). Viewing, not editing — a Save here is a NEW view.
    case "SELECT_VIEW":
      return {
        selection: { tab: "views", viewId: action.view.id },
        editingView: null,
        filter: action.view.filter_expr,
        folderSheetOpen: false,
        parkedFolderId: null,
        parkedViewId: action.view.id,
      }

    // Edit reopens the bar pre-filled AND enters edit mode (D-114-3/9). `folderSheetOpen`
    // is left as it was — the shipped `handleEditView` (:259) does not touch it.
    case "EDIT_VIEW":
      return {
        selection: { tab: "views", viewId: action.view.id },
        editingView: action.view,
        filter: action.view.filter_expr,
        folderSheetOpen: state.folderSheetOpen,
        parkedFolderId: null,
        parkedViewId: action.view.id,
      }

    // ⚠ EDITING THE BAR LEAVES THE VIEWS ARM. The shipped handler (:275) calls
    // `setSelectedViewId(null)` — you are composing ad-hoc now, so the saved-view label
    // drops. Under the union that means the SELECTION leaves the views arm entirely: a tab
    // that stayed on `views` while the list showed an ad-hoc filter is exactly the lie SC#5
    // forbids. It does NOT exit edit mode — an explicit "Edit view" still saves back to
    // that view (:270-272) — and on the `documents` arm the folder selection is untouched,
    // because `handleFilterChange` never cleared `selectedFolderId`.
    case "CHANGE_FILTER":
      return {
        selection:
          state.selection.tab === "views"
            ? { tab: "documents", folderId: null }
            : state.selection,
        editingView: state.editingView,
        filter: action.filter,
        folderSheetOpen: state.folderSheetOpen,
        parkedFolderId: state.selection.tab === "views" ? null : state.parkedFolderId,
        parkedViewId: state.selection.tab === "views" ? null : state.parkedViewId,
      }

    // A deleted view can be neither edited nor re-entered. The SELECTION only moves when
    // the deleted view is the selected one (:293) — deleting any other view is inert.
    case "DELETE_VIEW": {
      const wasSelected =
        state.selection.tab === "views" && state.selection.viewId === action.viewId
      return {
        selection: wasSelected ? { tab: "documents", folderId: null } : state.selection,
        editingView: state.editingView?.id === action.viewId ? null : state.editingView,
        filter: wasSelected ? null : state.filter,
        folderSheetOpen: state.folderSheetOpen,
        parkedFolderId: state.parkedFolderId,
        // the memo is cleared whether or not the view was selected — re-entry into the
        // views arm must never land on a row that no longer exists
        parkedViewId: state.parkedViewId === action.viewId ? null : state.parkedViewId,
      }
    }

    // Re-entering an arm restores that arm's own payload from its memo; the other three
    // fields survive a tab round-trip untouched.
    case "SELECT_TAB":
      return {
        selection: selectionForTab(action.tab, state),
        editingView: state.editingView,
        filter: state.filter,
        folderSheetOpen: state.folderSheetOpen,
        parkedFolderId: state.parkedFolderId,
        parkedViewId: state.parkedViewId,
      }

    default:
      // Unreachable while `LibraryAction` is exhaustive; returning the state keeps the
      // reducer total rather than throwing at a user.
      return state
  }
}

/** The arm a tab switch lands on, re-hydrated from that arm's memo. */
function selectionForTab(
  tab: LibraryTab,
  state: { parkedFolderId: string | null; parkedViewId: string | null },
): LibrarySelection {
  switch (tab) {
    case "documents":
      return { tab: "documents", folderId: state.parkedFolderId }
    case "views":
      return { tab: "views", viewId: state.parkedViewId }
    case "ingestion":
      return { tab: "ingestion" }
    case "indexing":
      return { tab: "indexing" }
    case "health":
      return { tab: "health" }
  }
}

// ── THE DERIVED ACCESSORS ─────────────────────────────────────────────────────────────
//
// ⚠ These are the replacement for `IngestionPage.tsx:307`'s ternary. They read the
// SELECTION and nothing else — never a parked memo, never `editingView`.

/** The folder the list is scoped to, or `null` on every arm that carries no folder. */
export function activeFolderId(state: { selection: LibrarySelection }): string | null {
  return state.selection.tab === "documents" ? state.selection.folderId : null
}

/** The saved view currently loaded, or `null` on every arm that carries no view. */
export function activeViewId(state: { selection: LibrarySelection }): string | null {
  return state.selection.tab === "views" ? state.selection.viewId : null
}
