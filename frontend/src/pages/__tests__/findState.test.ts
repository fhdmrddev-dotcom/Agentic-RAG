/**
 * Phase 271-03 Task 1 (FIND-01 / FIND-03 / D-03 / D-06 / P-01) — the Find state leaf.
 *
 * ── NO DOM, NO DOUBLES, NO MOUNT ──────────────────────────────────────────────────────
 * `findState.ts` is a strict leaf (the `librarySelection.ts` shape), so this suite calls the
 * reducer and the derived accessors and reads the result. A failure here is a defect in a
 * transition or in the wire body, never in a fixture.
 *
 * ── THE WIRE BODY IS ASSERTED WHOLE ───────────────────────────────────────────────────
 * `toSearchRequest` is compared with `toEqual` against the full `POST /document-search` body
 * of 271-01's wire contract, so a dropped or renamed key reds here rather than as a 422 in
 * a live drive.
 */
import { describe, it, expect } from "vitest"

import { EMPTY_FILTER, type DocumentSearchRequest, type ViewFilter } from "@/types"

import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  canSaveAsView,
  findReducer,
  initialFindState,
  isSearchActive,
  sortDateColumn,
  toSearchRequest,
  type FindAction,
  type FindState,
} from "../findState"

// The module's own source, read for the strict-leaf fences below.
import findStateSource from "../findState.ts?raw"

const typeFilter: ViewFilter = {
  op: "and",
  conditions: [{ field: "document_type", op: "eq", value: "contract" }],
}

function run(...actions: FindAction[]): FindState {
  return actions.reduce<FindState>((s, a) => findReducer(s, a), initialFindState)
}

const paged: FindAction = { type: "SET_PAGE", offset: 50, limit: 25 }

// ── INITIAL STATE ─────────────────────────────────────────────────────────────────────

describe("initialFindState", () => {
  it("opens in Find mode with nothing set, latest versions, newest-added first, page 1 of 25", () => {
    expect(initialFindState).toEqual({
      mode: "find",
      name: "",
      askText: "",
      folder: null,
      addedBy: null,
      dates: [],
      relationship: null,
      version: "latest",
      sort: "added_desc",
      offset: 0,
      limit: 25,
    })
  })

  it("DEFAULT_SORT is added_desc (P-01 — not 'Modified (newest)')", () => {
    expect(DEFAULT_SORT).toBe("added_desc")
    expect(initialFindState.sort).toBe(DEFAULT_SORT)
  })
})

// ── THE REDUCER ───────────────────────────────────────────────────────────────────────

describe("findReducer — every condition change resets the page", () => {
  const conditionActions: FindAction[] = [
    { type: "SET_NAME", name: "acme" },
    { type: "SET_FOLDER", folder: { folderId: "f1", includeSubfolders: true } },
    { type: "SET_ADDED_BY", addedBy: { kind: "me", connectionId: null, label: "You" } },
    {
      type: "SET_DATE",
      date: { which: "added", op: "after", value: "2024-01-01", value2: null, unit: null },
    },
    { type: "REMOVE_DATE", which: "added" },
    {
      type: "SET_RELATIONSHIP",
      relationship: { verb: "superseded_by", documentId: "d1", documentName: "Acme MSA" },
    },
    { type: "SET_VERSION", version: "older" },
    { type: "SET_SORT", sort: "name_asc" },
  ]

  it("covers all eight condition action types (non-vacuity)", () => {
    expect(new Set(conditionActions.map((a) => a.type)).size).toBe(8)
  })

  for (const action of conditionActions) {
    it(`${action.type} resets offset to 0 and keeps limit`, () => {
      const before = run(paged)
      expect(before.offset).toBe(50)
      const after = findReducer(before, action)
      expect(after.offset).toBe(0)
      expect(after.limit).toBe(25)
    })
  }

  it("SET_PAGE sets offset and limit only", () => {
    const s0 = run({ type: "SET_NAME", name: "acme" })
    const s1 = findReducer(s0, { type: "SET_PAGE", offset: 25, limit: 50 })
    expect(s1).toEqual({ ...s0, offset: 25, limit: 50 })
  })

  it("SET_MODE changes the mode only — each mode keeps its own text (S5)", () => {
    const s0 = run(
      { type: "SET_NAME", name: "acme" },
      { type: "SET_ASK_TEXT", text: "what changed?" },
      paged,
    )
    const s1 = findReducer(s0, { type: "SET_MODE", mode: "ask" })
    expect(s1).toEqual({ ...s0, mode: "ask" })
    const s2 = findReducer(s1, { type: "SET_MODE", mode: "find" })
    expect(s2).toEqual(s0)
  })

  it("SET_ASK_TEXT never touches the name (and never the page)", () => {
    const s0 = run({ type: "SET_NAME", name: "acme" }, paged)
    const s1 = findReducer(s0, { type: "SET_ASK_TEXT", text: "a question" })
    expect(s1).toEqual({ ...s0, askText: "a question" })
  })

  it("SET_DATE with a `which` already present REPLACES it (one per which)", () => {
    const s = run(
      {
        type: "SET_DATE",
        date: { which: "added", op: "after", value: "2024-01-01", value2: null, unit: null },
      },
      {
        type: "SET_DATE",
        date: { which: "source_modified", op: "older_than", value: 30, value2: null, unit: "days" },
      },
      {
        type: "SET_DATE",
        date: { which: "added", op: "before", value: "2025-01-01", value2: null, unit: null },
      },
    )
    expect(s.dates).toHaveLength(2)
    expect(s.dates.filter((d) => d.which === "added")).toEqual([
      { which: "added", op: "before", value: "2025-01-01", value2: null, unit: null },
    ])
  })

  it("REMOVE_DATE removes only that which", () => {
    const s = run(
      {
        type: "SET_DATE",
        date: { which: "added", op: "after", value: "2024-01-01", value2: null, unit: null },
      },
      {
        type: "SET_DATE",
        date: { which: "source_created", op: "after", value: "2020-01-01", value2: null, unit: null },
      },
      { type: "REMOVE_DATE", which: "added" },
    )
    expect(s.dates.map((d) => d.which)).toEqual(["source_created"])
  })

  it("CLEAR_SEARCH resets every condition and the version, keeps mode and sort", () => {
    const s0 = run(
      { type: "SET_MODE", mode: "ask" },
      { type: "SET_ASK_TEXT", text: "q" },
      { type: "SET_NAME", name: "acme" },
      { type: "SET_FOLDER", folder: { folderId: null, includeSubfolders: false } },
      { type: "SET_ADDED_BY", addedBy: { kind: "others", connectionId: null, label: "Anyone else" } },
      {
        type: "SET_DATE",
        date: { which: "added", op: "after", value: "2024-01-01", value2: null, unit: null },
      },
      {
        type: "SET_RELATIONSHIP",
        relationship: { verb: "amends", documentId: "d1", documentName: "X" },
      },
      { type: "SET_VERSION", version: "has_earlier" },
      { type: "SET_SORT", sort: "name_asc" },
      paged,
    )
    const s1 = findReducer(s0, { type: "CLEAR_SEARCH" })
    expect(s1.name).toBe("")
    expect(s1.folder).toBeNull()
    expect(s1.addedBy).toBeNull()
    expect(s1.dates).toEqual([])
    expect(s1.relationship).toBeNull()
    expect(s1.version).toBe("latest")
    expect(s1.offset).toBe(0)
    expect(s1.mode).toBe("ask")
    expect(s1.sort).toBe("name_asc")
    expect(s1.askText).toBe("q")
  })

  it("an unknown action returns the SAME state object (total reducer)", () => {
    const s0 = run({ type: "SET_NAME", name: "acme" })
    const s1 = findReducer(s0, { type: "NOPE" } as unknown as FindAction)
    expect(s1).toBe(s0)
  })
})

// ── DERIVED ACCESSORS ─────────────────────────────────────────────────────────────────

describe("isSearchActive (UI-SPEC S4)", () => {
  it("is false at rest", () => {
    expect(isSearchActive(initialFindState, 0)).toBe(false)
  })

  it("is false for a whitespace-only name", () => {
    expect(isSearchActive(run({ type: "SET_NAME", name: "   " }), 0)).toBe(false)
  })

  const activators: Array<[string, FindState, number]> = [
    ["a name", run({ type: "SET_NAME", name: "a" }), 0],
    ["a folder", run({ type: "SET_FOLDER", folder: { folderId: "f", includeSubfolders: true } }), 0],
    ["a 'not in a folder' folder", run({ type: "SET_FOLDER", folder: { folderId: null, includeSubfolders: false } }), 0],
    ["added by", run({ type: "SET_ADDED_BY", addedBy: { kind: "me", connectionId: null, label: "You" } }), 0],
    [
      "a file date",
      run({
        type: "SET_DATE",
        date: { which: "source_created", op: "within_next", value: 7, value2: null, unit: "days" },
      }),
      0,
    ],
    [
      "a relationship",
      run({ type: "SET_RELATIONSHIP", relationship: { verb: "references", documentId: "d", documentName: "D" } }),
      0,
    ],
    ["version older", run({ type: "SET_VERSION", version: "older" }), 0],
    ["version has_earlier", run({ type: "SET_VERSION", version: "has_earlier" }), 0],
    ["one metadata condition", initialFindState, 1],
  ]
  for (const [label, state, count] of activators) {
    it(`is true for ${label}`, () => {
      expect(isSearchActive(state, count)).toBe(true)
    })
  }

  it("a sort change alone does not start a search", () => {
    expect(isSearchActive(run({ type: "SET_SORT", sort: "name_asc" }), 0)).toBe(false)
  })
})

describe("canSaveAsView (Pitfall 9)", () => {
  it("is true at rest", () => {
    expect(canSaveAsView(initialFindState)).toBe(true)
  })

  it("stays true for a sort or page change (not stored conditions)", () => {
    expect(canSaveAsView(run({ type: "SET_SORT", sort: "name_asc" }, paged))).toBe(true)
  })

  const blockers: Array<[string, FindState]> = [
    ["a name", run({ type: "SET_NAME", name: "acme" })],
    ["a folder", run({ type: "SET_FOLDER", folder: { folderId: "f", includeSubfolders: true } })],
    ["added by", run({ type: "SET_ADDED_BY", addedBy: { kind: "me", connectionId: null, label: "You" } })],
    [
      "a file date",
      run({
        type: "SET_DATE",
        date: { which: "added", op: "after", value: "2024-01-01", value2: null, unit: null },
      }),
    ],
    [
      "a relationship",
      run({ type: "SET_RELATIONSHIP", relationship: { verb: "amends", documentId: "d", documentName: "D" } }),
    ],
    ["version older", run({ type: "SET_VERSION", version: "older" })],
    ["version has_earlier", run({ type: "SET_VERSION", version: "has_earlier" })],
  ]
  for (const [label, state] of blockers) {
    it(`is false with ${label}`, () => {
      expect(canSaveAsView(state)).toBe(false)
    })
  }
})

// ── THE WIRE BODY ─────────────────────────────────────────────────────────────────────

describe("toSearchRequest (271-01 wire contract)", () => {
  it("returns null when no search is active", () => {
    expect(toSearchRequest(initialFindState, EMPTY_FILTER)).toBeNull()
    expect(toSearchRequest(run({ type: "SET_SORT", sort: "name_asc" }), EMPTY_FILTER)).toBeNull()
  })

  it("a metadata condition alone is enough, with every other key at its resting value", () => {
    const body = toSearchRequest(initialFindState, typeFilter)
    const expected: DocumentSearchRequest = {
      filter_expr: typeFilter,
      name: null,
      folder: null,
      added_by: null,
      dates: [],
      relationship: null,
      version: "latest",
      sort: "added_desc",
      offset: 0,
      limit: 25,
    }
    expect(body).toEqual(expected)
  })

  it("maps every condition to its exact wire key", () => {
    const s = run(
      { type: "SET_NAME", name: "  acme  " },
      { type: "SET_FOLDER", folder: { folderId: "f1", includeSubfolders: false } },
      { type: "SET_ADDED_BY", addedBy: { kind: "connection", connectionId: "c1", label: "Drive Finance" } },
      {
        type: "SET_DATE",
        date: { which: "added", op: "between", value: "2019-01-01", value2: "2019-12-31", unit: null },
      },
      {
        type: "SET_DATE",
        date: { which: "source_modified", op: "older_than", value: 3, value2: null, unit: "months" },
      },
      {
        type: "SET_RELATIONSHIP",
        relationship: { verb: "superseded_by", documentId: "d9", documentName: "Acme MSA 2019" },
      },
      { type: "SET_VERSION", version: "has_earlier" },
      { type: "SET_SORT", sort: "source_modified_desc" },
      { type: "SET_PAGE", offset: 25, limit: 25 },
    )
    expect(toSearchRequest(s, typeFilter)).toEqual({
      filter_expr: typeFilter,
      name: "acme",
      folder: { folder_id: "f1", include_subfolders: false },
      added_by: { kind: "connection", connection_id: "c1" },
      dates: [
        { which: "added", op: "between", value: "2019-01-01", value2: "2019-12-31", unit: null },
        { which: "source_modified", op: "older_than", value: 3, value2: null, unit: "months" },
      ],
      relationship: { verb: "superseded_by", document_id: "d9" },
      version: "has_earlier",
      sort: "source_modified_desc",
      offset: 25,
      limit: 25,
    })
  })

  it("'Not in a folder' travels as folder_id null; 'me' carries connection_id null", () => {
    const s = run(
      { type: "SET_FOLDER", folder: { folderId: null, includeSubfolders: false } },
      { type: "SET_ADDED_BY", addedBy: { kind: "me", connectionId: null, label: "You" } },
    )
    const body = toSearchRequest(s, EMPTY_FILTER)
    expect(body?.folder).toEqual({ folder_id: null, include_subfolders: false })
    expect(body?.added_by).toEqual({ kind: "me", connection_id: null })
    expect(body?.name).toBeNull()
  })

  it("version 'older' alone is a search and is sent", () => {
    const body = toSearchRequest(run({ type: "SET_VERSION", version: "older" }), EMPTY_FILTER)
    expect(body?.version).toBe("older")
    expect(body?.filter_expr).toEqual(EMPTY_FILTER)
  })
})

// ── SORT OPTIONS ──────────────────────────────────────────────────────────────────────

describe("SORT_OPTIONS and sortDateColumn", () => {
  it("lists the six sorts in the UI-SPEC order, default first", () => {
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual([
      "Added to Agentic RAG (newest)",
      "Added to Agentic RAG (oldest)",
      "Date in the document (newest)",
      "Last modified in the file (newest)",
      "Created in the file (newest)",
      "Name (A to Z)",
    ])
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual([
      "added_desc",
      "added_asc",
      "document_date_desc",
      "source_modified_desc",
      "source_created_desc",
      "name_asc",
    ])
    expect(SORT_OPTIONS[0].value).toBe(DEFAULT_SORT)
  })

  it("names the date column after the fact the sort uses; name sorts show Added", () => {
    expect(sortDateColumn("added_desc")).toEqual({ label: "Added", field: "created_at" })
    expect(sortDateColumn("added_asc")).toEqual({ label: "Added", field: "created_at" })
    expect(sortDateColumn("document_date_desc")).toEqual({
      label: "Date in the document",
      field: "document_date",
    })
    expect(sortDateColumn("source_modified_desc")).toEqual({
      label: "Modified in the file",
      field: "source_modified_at",
    })
    expect(sortDateColumn("source_created_desc")).toEqual({
      label: "Created in the file",
      field: "source_created_at",
    })
    expect(sortDateColumn("name_asc")).toEqual({ label: "Added", field: "created_at" })
  })
})

// ── THE STRICT-LEAF FENCES ────────────────────────────────────────────────────────────

describe("findState.ts is a strict leaf", () => {
  it("has zero import statements", () => {
    // Non-vacuity: the source was actually read.
    expect(findStateSource.length).toBeGreaterThan(2000)
    expect(findStateSource).toContain("export function findReducer")

    const importLines = findStateSource.split(/\r?\n/).filter((line) => /^import\b/.test(line))
    expect(importLines).toEqual([])
  })

  it("performs no I/O and holds no component state", () => {
    for (const token of ["useState", "useEffect", "useRef(", "fetch(", "localStorage"]) {
      expect(findStateSource).not.toContain(token)
    }
  })

  it("names the async results it excludes in its docblock", () => {
    for (const excluded of ["result", "total", "older_matches", "request id"]) {
      expect(findStateSource).toContain(excluded)
    }
  })
})
