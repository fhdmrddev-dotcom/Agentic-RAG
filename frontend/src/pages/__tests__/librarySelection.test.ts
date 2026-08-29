/**
 * Phase 217-05 Task 2 (LIB-01 / SC#5 / D-217-12 / D-217-14) — the pure transition suite.
 *
 * ── NO DOM, NO DOUBLES, NO MOUNT ──────────────────────────────────────────────────────
 * `librarySelection.ts` is a strict leaf, so its suite is one too: it calls the reducer
 * and reads the result. Nothing is drawn, nothing is stubbed, nothing is awaited. A
 * failure here is a defect in the transition, never in a fixture or a query selector.
 *
 * ── ⚠ THE ENUMERATION CARRIES A NON-VACUITY CONTROL ──────────────────────────────────
 * The mutual-exclusion invariant is asserted as a PROPERTY over every reachable state, and
 * a loop over an empty set satisfies every property for free. The reachable set is
 * therefore asserted non-empty AND larger than one BEFORE any claim rests on it, and the
 * action list is asserted to cover all six action types.
 *
 * ── THE CONCRETE TYPES ARE THE SHIPPED ONES ───────────────────────────────────────────
 * The reducer is driven at `<ViewFilter, SavedView>` — the exact instantiation plan 09
 * wires — so this suite also proves the structural seam: a real `SavedView` satisfies
 * `LibraryViewLike<ViewFilter>` with no cast at the boundary.
 */
import { describe, it, expect } from "vitest"

import { EMPTY_FILTER, type SavedView, type ViewFilter } from "@/types"

import {
  activeFolderId,
  activeViewId,
  initialLibraryState,
  libraryReducer,
  type LibraryAction,
  type LibrarySelection,
  type LibraryState,
  type LibraryTab,
} from "../librarySelection"

// The module's own source, read for the "strict leaf" fences below.
import librarySelectionSource from "../librarySelection.ts?raw"

// ── FIXTURES ──────────────────────────────────────────────────────────────────────────

type State = LibraryState<ViewFilter, SavedView>
type Action = LibraryAction<ViewFilter, SavedView>

const filterOfV1: ViewFilter = {
  op: "and",
  conditions: [{ field: "title", op: "contains", value: "invoice" }],
}

const filterOfV2: ViewFilter = {
  op: "and",
  conditions: [{ field: "doc_type", op: "eq", value: "contract" }],
}

const adHocFilter: ViewFilter = {
  op: "and",
  conditions: [{ field: "owner", op: "is_empty" }],
}

const v1: SavedView = {
  id: "v1",
  name: "Invoices",
  filter_expr: filterOfV1,
  is_system_global: false,
}

const v2: SavedView = {
  id: "v2",
  name: "Contracts",
  filter_expr: filterOfV2,
  is_system_global: true,
}

const TABS: readonly LibraryTab[] = ["documents", "views", "ingestion", "indexing"]

/** Every action the reducer accepts, at more than one payload each where payload matters. */
const ACTIONS: readonly Action[] = [
  { type: "SELECT_FOLDER", folderId: "f9" },
  { type: "SELECT_FOLDER", folderId: null },
  { type: "SELECT_VIEW", view: v1 },
  { type: "SELECT_VIEW", view: v2 },
  { type: "EDIT_VIEW", view: v1 },
  { type: "CHANGE_FILTER", filter: adHocFilter },
  { type: "DELETE_VIEW", viewId: "v1" },
  { type: "DELETE_VIEW", viewId: "v-never-selected" },
  ...TABS.map((tab): Action => ({ type: "SELECT_TAB", tab })),
]

/** A concrete starting state on each of the four arms, with the memos already warm so the
 *  parked ids get a chance to leak into an accessor if the module ever lets them. */
const SEEDS: readonly State[] = [
  initialLibraryState,
  {
    selection: { tab: "documents", folderId: "f1" },
    editingView: null,
    filter: null,
    folderSheetOpen: true,
    parkedFolderId: "f1",
    parkedViewId: null,
  },
  {
    selection: { tab: "views", viewId: "v1" },
    editingView: null,
    filter: filterOfV1,
    folderSheetOpen: false,
    parkedFolderId: null,
    parkedViewId: "v1",
  },
  {
    selection: { tab: "views", viewId: "v1" },
    editingView: v1,
    filter: filterOfV1,
    folderSheetOpen: false,
    parkedFolderId: null,
    parkedViewId: "v1",
  },
  {
    selection: { tab: "ingestion" },
    editingView: v1,
    filter: adHocFilter,
    folderSheetOpen: false,
    parkedFolderId: "f1",
    parkedViewId: "v1",
  },
  {
    selection: { tab: "indexing" },
    editingView: null,
    filter: null,
    folderSheetOpen: false,
    parkedFolderId: "f7",
    parkedViewId: "v2",
  },
]

const keyOf = (s: State): string => JSON.stringify(s)

/**
 * Every state reachable from the seeds by up to `depth` actions, de-duplicated. This is the
 * cross-product the property below quantifies over.
 */
function reachableStates(depth: number): State[] {
  const seen = new Map<string, State>()
  let frontier: State[] = [...SEEDS]
  for (const s of frontier) seen.set(keyOf(s), s)

  for (let i = 0; i < depth; i++) {
    const next: State[] = []
    for (const s of frontier) {
      for (const a of ACTIONS) {
        const out = libraryReducer<ViewFilter, SavedView>(s, a)
        const k = keyOf(out)
        if (!seen.has(k)) {
          seen.set(k, out)
          next.push(out)
        }
      }
    }
    frontier = next
    if (frontier.length === 0) break
  }
  return [...seen.values()]
}

// ── THE THREE NAMED CASES ─────────────────────────────────────────────────────────────

describe("librarySelection — the named success criteria", () => {
  it("D-217-14: SELECT_FOLDER from the views arm yields the documents arm", () => {
    const before: State = {
      selection: { tab: "views", viewId: "v1" },
      editingView: null,
      filter: filterOfV1,
      folderSheetOpen: false,
      parkedFolderId: null,
      parkedViewId: "v1",
    }

    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "SELECT_FOLDER",
      folderId: "f9",
    })

    // The tab FOLLOWED the selection — it did not stay on views while the list below it
    // showed a folder. This exact assertion goes red against a reducer that keeps the
    // previous tab, which is how it was driven (see the summary).
    expect(after.selection).toEqual({ tab: "documents", folderId: "f9" })
    expect(activeFolderId(after)).toBe("f9")
    expect(activeViewId(after)).toBeNull()
  })

  it("the invariant, as a property over every reachable state", () => {
    const states = reachableStates(3)

    // ⚠ NON-VACUITY CONTROL, asserted BEFORE the property it guards. An empty (or
    // one-element) enumeration would satisfy the loop below for free.
    expect(states.length).toBeGreaterThan(1)
    expect(states.length).toBeGreaterThan(10)

    // And a control on the driver itself: all six action types are actually exercised.
    expect(new Set(ACTIONS.map((a) => a.type)).size).toBe(6)

    for (const s of states) {
      expect(activeFolderId(s) === null || activeViewId(s) === null).toBe(true)
    }
  })

  it("CHANGE_FILTER leaves the views arm (IngestionPage.tsx:275)", () => {
    const before: State = {
      selection: { tab: "views", viewId: "v1" },
      editingView: null,
      filter: filterOfV1,
      folderSheetOpen: false,
      parkedFolderId: null,
      parkedViewId: "v1",
    }

    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "CHANGE_FILTER",
      filter: adHocFilter,
    })

    // The shipped `handleFilterChange` calls `setSelectedViewId(null)`: editing the bar
    // means you are composing ad-hoc, so the saved-view label drops. Under the union the
    // selection must leave the views arm entirely — a tab that stayed on `views` over an
    // ad-hoc filter is precisely the disagreement SC#5 forbids.
    expect(after.selection).toEqual({ tab: "documents", folderId: null })
    expect(after.filter).toBe(adHocFilter)
    expect(activeViewId(after)).toBeNull()
  })
})

// ── THE FULL CROSS-PRODUCT ────────────────────────────────────────────────────────────

describe("librarySelection — every action against every arm", () => {
  it("is total: no action on any seed throws or yields an invalid arm", () => {
    expect(SEEDS.length).toBe(6)
    expect(ACTIONS.length).toBe(12)

    for (const s of SEEDS) {
      for (const a of ACTIONS) {
        const out = libraryReducer<ViewFilter, SavedView>(s, a)
        expect(TABS).toContain(out.selection.tab)
        expect(typeof out.folderSheetOpen).toBe("boolean")
      }
    }
  })

  it("no reachable state carries both a folderId and a viewId key", () => {
    const states = reachableStates(3)
    expect(states.length).toBeGreaterThan(1)

    for (const s of states) {
      const sel = s.selection as Record<string, unknown>
      const hasFolder = Object.prototype.hasOwnProperty.call(sel, "folderId")
      const hasView = Object.prototype.hasOwnProperty.call(sel, "viewId")
      expect(hasFolder && hasView).toBe(false)
    }
  })

  it("a parked id never leaks into either accessor", () => {
    const parked: State = {
      selection: { tab: "ingestion" },
      editingView: null,
      filter: null,
      folderSheetOpen: false,
      parkedFolderId: "f1",
      parkedViewId: "v1",
    }
    expect(activeFolderId(parked)).toBeNull()
    expect(activeViewId(parked)).toBeNull()
  })
})

// ── SELECT_FOLDER ─────────────────────────────────────────────────────────────────────

describe("SELECT_FOLDER", () => {
  it("clears edit mode, drops the filter and closes the folder sheet", () => {
    const before: State = {
      selection: { tab: "views", viewId: "v1" },
      editingView: v1,
      filter: filterOfV1,
      folderSheetOpen: true,
      parkedFolderId: null,
      parkedViewId: "v1",
    }
    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "SELECT_FOLDER",
      folderId: "f9",
    })
    expect(after.editingView).toBeNull()
    expect(after.filter).toBeNull()
    expect(after.folderSheetOpen).toBe(false)
  })

  it("abandons the parked view so a later tab switch cannot resurrect it", () => {
    const before: State = {
      selection: { tab: "views", viewId: "v1" },
      editingView: null,
      filter: filterOfV1,
      folderSheetOpen: false,
      parkedFolderId: null,
      parkedViewId: "v1",
    }
    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "SELECT_FOLDER",
      folderId: "f9",
    })
    expect(after.parkedViewId).toBeNull()
    expect(after.parkedFolderId).toBe("f9")

    const backToViews = libraryReducer<ViewFilter, SavedView>(after, {
      type: "SELECT_TAB",
      tab: "views",
    })
    expect(backToViews.selection).toEqual({ tab: "views", viewId: null })
  })

  it("accepts the root (null) folder without leaving the documents arm", () => {
    const after = libraryReducer<ViewFilter, SavedView>(initialLibraryState, {
      type: "SELECT_FOLDER",
      folderId: null,
    })
    expect(after.selection).toEqual({ tab: "documents", folderId: null })
    expect(activeFolderId(after)).toBeNull()
  })
})

// ── SELECT_VIEW / EDIT_VIEW ───────────────────────────────────────────────────────────

describe("SELECT_VIEW and EDIT_VIEW", () => {
  it("SELECT_VIEW loads the view's filter and does NOT enter edit mode", () => {
    const after = libraryReducer<ViewFilter, SavedView>(initialLibraryState, {
      type: "SELECT_VIEW",
      view: v1,
    })
    expect(after.selection).toEqual({ tab: "views", viewId: "v1" })
    expect(after.filter).toBe(filterOfV1)
    expect(after.editingView).toBeNull()
    expect(after.folderSheetOpen).toBe(false)
  })

  it("EDIT_VIEW enters edit mode on the same view", () => {
    const after = libraryReducer<ViewFilter, SavedView>(initialLibraryState, {
      type: "EDIT_VIEW",
      view: v2,
    })
    expect(after.selection).toEqual({ tab: "views", viewId: "v2" })
    expect(after.editingView).toBe(v2)
    expect(after.filter).toBe(filterOfV2)
  })

  it("both abandon a folder selection — the arms are mutually exclusive", () => {
    const withFolder: State = {
      selection: { tab: "documents", folderId: "f1" },
      editingView: null,
      filter: null,
      folderSheetOpen: false,
      parkedFolderId: "f1",
      parkedViewId: null,
    }
    for (const action of [
      { type: "SELECT_VIEW", view: v1 } as const,
      { type: "EDIT_VIEW", view: v1 } as const,
    ]) {
      const after = libraryReducer<ViewFilter, SavedView>(withFolder, action)
      expect(activeFolderId(after)).toBeNull()
      expect(activeViewId(after)).toBe("v1")
      expect(after.parkedFolderId).toBeNull()
    }
  })
})

// ── CHANGE_FILTER ─────────────────────────────────────────────────────────────────────

describe("CHANGE_FILTER", () => {
  it("keeps the folder selection when already on the documents arm", () => {
    const before: State = {
      selection: { tab: "documents", folderId: "f1" },
      editingView: null,
      filter: null,
      folderSheetOpen: false,
      parkedFolderId: "f1",
      parkedViewId: null,
    }
    // The shipped handler never cleared `selectedFolderId` — only the view id.
    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "CHANGE_FILTER",
      filter: adHocFilter,
    })
    expect(after.selection).toEqual({ tab: "documents", folderId: "f1" })
    expect(after.filter).toBe(adHocFilter)
  })

  it("does NOT exit edit mode (D-114-3: an explicit Edit still saves back)", () => {
    const before: State = {
      selection: { tab: "views", viewId: "v1" },
      editingView: v1,
      filter: filterOfV1,
      folderSheetOpen: false,
      parkedFolderId: null,
      parkedViewId: "v1",
    }
    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "CHANGE_FILTER",
      filter: adHocFilter,
    })
    expect(after.editingView).toBe(v1)
  })
})

// ── DELETE_VIEW ───────────────────────────────────────────────────────────────────────

describe("DELETE_VIEW", () => {
  it("falls back to the documents arm when the deleted view was selected", () => {
    const before: State = {
      selection: { tab: "views", viewId: "v1" },
      editingView: v1,
      filter: filterOfV1,
      folderSheetOpen: false,
      parkedFolderId: null,
      parkedViewId: "v1",
    }
    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "DELETE_VIEW",
      viewId: "v1",
    })
    expect(after.selection).toEqual({ tab: "documents", folderId: null })
    expect(after.editingView).toBeNull()
    expect(after.filter).toBeNull()
    expect(after.parkedViewId).toBeNull()
  })

  it("THE NEGATIVE ARM: deleting a non-selected view leaves the selection untouched", () => {
    const before: State = {
      selection: { tab: "views", viewId: "v1" },
      editingView: v1,
      filter: filterOfV1,
      folderSheetOpen: false,
      parkedFolderId: null,
      parkedViewId: "v1",
    }
    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "DELETE_VIEW",
      viewId: "v2",
    })
    expect(after.selection).toEqual(before.selection)
    expect(after.editingView).toBe(v1)
    expect(after.filter).toBe(filterOfV1)
    expect(after.parkedViewId).toBe("v1")
  })

  it("clears a parked memo for the deleted view even when another arm is active", () => {
    const before: State = {
      selection: { tab: "ingestion" },
      editingView: null,
      filter: null,
      folderSheetOpen: false,
      parkedFolderId: "f1",
      parkedViewId: "v1",
    }
    const after = libraryReducer<ViewFilter, SavedView>(before, {
      type: "DELETE_VIEW",
      viewId: "v1",
    })
    expect(after.selection).toEqual({ tab: "ingestion" })
    expect(after.parkedViewId).toBeNull()
    expect(after.parkedFolderId).toBe("f1")
  })
})

// ── SELECT_TAB ────────────────────────────────────────────────────────────────────────

describe("SELECT_TAB", () => {
  it("round-trips: documents -> ingestion -> documents preserves the folderId", () => {
    const withFolder = libraryReducer<ViewFilter, SavedView>(initialLibraryState, {
      type: "SELECT_FOLDER",
      folderId: "f9",
    })
    const away = libraryReducer<ViewFilter, SavedView>(withFolder, {
      type: "SELECT_TAB",
      tab: "ingestion",
    })
    expect(away.selection).toEqual({ tab: "ingestion" })
    expect(activeFolderId(away)).toBeNull()

    const back = libraryReducer<ViewFilter, SavedView>(away, {
      type: "SELECT_TAB",
      tab: "documents",
    })
    expect(back.selection).toEqual({ tab: "documents", folderId: "f9" })
    expect(activeFolderId(back)).toBe("f9")
  })

  it("round-trips: views -> indexing -> views preserves the viewId", () => {
    const withView = libraryReducer<ViewFilter, SavedView>(initialLibraryState, {
      type: "SELECT_VIEW",
      view: v2,
    })
    const away = libraryReducer<ViewFilter, SavedView>(withView, {
      type: "SELECT_TAB",
      tab: "indexing",
    })
    const back = libraryReducer<ViewFilter, SavedView>(away, {
      type: "SELECT_TAB",
      tab: "views",
    })
    expect(back.selection).toEqual({ tab: "views", viewId: "v2" })
    expect(activeViewId(back)).toBe("v2")
  })

  it("lands on the empty arm when nothing was ever parked", () => {
    for (const tab of TABS) {
      const after = libraryReducer<ViewFilter, SavedView>(initialLibraryState, {
        type: "SELECT_TAB",
        tab,
      })
      expect(after.selection.tab).toBe(tab)
      expect(activeFolderId(after)).toBeNull()
      expect(activeViewId(after)).toBeNull()
    }
  })
})

// ── THE COMPILER FENCES ───────────────────────────────────────────────────────────────

describe("the union is exclusive at the type level", () => {
  it("refuses a folder id on an arm that carries none, and refuses both at once", () => {
    // @ts-expect-error — the ingestion arm carries no folderId
    const bothA: LibrarySelection = { tab: "ingestion", folderId: "f1" }
    // @ts-expect-error — no arm of the union carries both ids
    const bothB: LibrarySelection = { tab: "documents", folderId: "f1", viewId: "v1" }
    // @ts-expect-error — the documents arm carries no viewId
    const bothC: LibrarySelection = { tab: "documents", viewId: "v1" }

    // ⚠ THE ASSERTIONS ABOVE ARE THE COMPILER'S, NOT vitest's: `tsc -p tsconfig.app.json`
    // fails if any of the three lines STOPS being an error. The runtime reads below only
    // keep the bindings live under `noUnusedLocals`.
    expect(bothA.tab).toBe("ingestion")
    expect(bothB.tab).toBe("documents")
    expect(bothC.tab).toBe("documents")
  })
})

// ── THE STRICT-LEAF FENCES ────────────────────────────────────────────────────────────

describe("librarySelection.ts is a strict leaf", () => {
  it("has zero import statements", () => {
    // Non-vacuity: the source was actually read.
    expect(librarySelectionSource.length).toBeGreaterThan(2000)
    expect(librarySelectionSource).toContain("export function libraryReducer")

    const importLines = librarySelectionSource
      .split(/\r?\n/)
      .filter((line) => /^import\b/.test(line))
    expect(importLines).toEqual([])
  })

  it("performs no I/O and holds no component state", () => {
    for (const token of ["useState", "useEffect", "useRef(", "fetch(", "localStorage"]) {
      expect(librarySelectionSource).not.toContain(token)
    }
  })

  it("names the three excluded async fields in its docblock", () => {
    for (const excluded of ["filteredDocs", "matchCount", "filterReqId"]) {
      expect(librarySelectionSource).toContain(excluded)
    }
  })
})

// ── THE EMPTY-FILTER EQUIVALENCE FENCE ────────────────────────────────────────────────

describe("filter: null is the empty filter", () => {
  it("EMPTY_FILTER is still the no-narrowing filter the reducer's null stands for", () => {
    // The reducer cannot import `EMPTY_FILTER` (zero imports) and must not declare a second
    // one, so it spells "no filter composed" as `null` and the consumer resolves
    // `state.filter ?? EMPTY_FILTER`. That equivalence only holds while EMPTY_FILTER really
    // is empty — this case is what stops it drifting silently.
    expect(EMPTY_FILTER.op).toBe("and")
    expect(EMPTY_FILTER.conditions).toHaveLength(0)

    const cleared = libraryReducer<ViewFilter, SavedView>(
      {
        selection: { tab: "views", viewId: "v1" },
        editingView: null,
        filter: filterOfV1,
        folderSheetOpen: false,
        parkedFolderId: null,
        parkedViewId: "v1",
      },
      { type: "SELECT_FOLDER", folderId: "f9" },
    )
    expect(cleared.filter ?? EMPTY_FILTER).toEqual(EMPTY_FILTER)
  })
})
