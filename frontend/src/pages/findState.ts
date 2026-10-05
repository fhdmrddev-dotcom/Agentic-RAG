/**
 * Phase 271-03 (FIND-01 / FIND-03 / D-03 / D-06 / P-01) — the ONE home of the Find state on
 * the Library's Documents tab.
 *
 * ── WHY THIS MODULE EXISTS ────────────────────────────────────────────────────────────
 * Find adds a search row and a strip of structure conditions (name, folder, added by, the
 * three file/added dates, relationship, version) plus a sort and a page on top of the
 * shipped metadata filter. Spread across loose component state, every one of them would
 * need its own "reset the page when this changes" line, and the one that forgot it would
 * show page 3 of a result set that now has one page. Here every condition change resets the
 * offset in ONE reducer, and "is a search running?" / "can this be stored as a view?" /
 * "what goes on the wire?" are each answered by ONE derived function.
 *
 * The metadata conditions (document type, Date in the document, custom fields) are NOT held
 * here: they stay in the Library reducer's `filter` (one source of truth, D-114-1) and are
 * passed IN to `isSearchActive` / `toSearchRequest`. This leaf owns only what the saved-view
 * filter cannot express.
 *
 * ── A STRICT LEAF ─────────────────────────────────────────────────────────────────────
 * Zero imports of any kind. No React, no component state, no effects, no network call, no
 * browser storage — the suite reads this file's source and checks each of those, so the
 * claim is measured rather than asserted (the `librarySelection.ts` shape, copied).
 * `findReducer` is a pure, TOTAL function of `(state, action)`: an unknown action returns
 * the same state object, and nothing throws.
 *
 * The `ViewFilter` it needs from `@/types` is expressed STRUCTURALLY (`FindFilterLike`), so
 * the concrete type flows through unchanged. The wire body `toSearchRequest` returns is
 * structurally identical to `DocumentSearchRequest` in `types/index.ts`; the suite compares
 * the two with `toEqual`, which is what keeps them from drifting apart.
 *
 * ── ⛔ WHAT THIS MODULE CANNOT PRODUCE ────────────────────────────────────────────────
 * It holds NO async results and NO request bookkeeping:
 *   - the result page (the rows of the last answered search) — an ASYNC RESULT of a network
 *     round-trip, arriving after the state that asked for it;
 *   - `total` and `older_matches` — the server's exact counts from that same answer;
 *   - the request id — the stale-response guard. A mutable concurrency token written
 *     outside the render cycle; a reducer that owned it would have to re-render to
 *     invalidate a request.
 * Those live in `hooks/useDocumentFind.ts`. A later plan MUST NOT fold them in: they are
 * what the state caused, not the state.
 *
 * It also produces no route, no URL and no persisted value. The mode resets to Find on
 * every page load (UI-SPEC S5).
 *
 * ── ⚠ P-01 — THE DEFAULT SORT IS A RECORDED DEVIATION ─────────────────────────────────
 * `DEFAULT_SORT` is `"added_desc"` (Added to Syrel, newest first), NOT the
 * "Modified (newest)" CONTEXT's specifics named. `source_modified_at` is null on every row
 * ingested before Phase 270, so a default on it would sink most of the library into one
 * unordered tail, and a bare "Modified" is ambiguous under 270's labelled dates. Flagged for
 * operator review. To override: change this constant AND the `sort` default in
 * `backend/app/models/document_search.py`; each is pinned by one test.
 */

// ── THE STRUCTURAL SHAPES ─────────────────────────────────────────────────────────────

/** A metadata filter, as this module needs it: an opaque payload it hands to the wire. */
export interface FindFilterLike {
  op: "and"
  conditions: readonly unknown[]
}

/** The two search modes (D-02). Ask never lists documents here; it hands off to chat. */
export type FindMode = "find" | "ask"

/** The six sorts the backend accepts (271-01 wire contract). */
export type FindSort =
  | "added_desc"
  | "added_asc"
  | "document_date_desc"
  | "source_modified_desc"
  | "source_created_desc"
  | "name_asc"

/** Version scope (D-06): latest rows only (default), latest rows WITH a history, or the
 *  older (superseded-by-a-newer-upload) rows themselves. */
export type FindVersion = "latest" | "has_earlier" | "older"

/** The 8 relationship verbs — both directions of the 4 stored types. Mirrors the backend
 *  `RelVerb` Literal; the frontend table is derived in `relationshipLabels.ts`. */
export type RelVerb =
  | "supersedes"
  | "superseded_by"
  | "amends"
  | "amended_by"
  | "references"
  | "referenced_by"
  | "attached_to"
  | "has_attachment"

/** Folder scope. `folderId: null` is "Not in a folder". Subfolders are on by default
 *  at the popover (SC#3); the state carries whatever was chosen. */
export interface FindFolderCondition {
  folderId: string | null
  includeSubfolders: boolean
}

/** Who added the document. `label` is display-only and never travels to the server. */
export interface FindAddedByCondition {
  kind: "me" | "connection" | "others"
  connectionId: string | null
  label: string
}

/** One of the three dates the metadata filter cannot express. "Date in the document" is
 *  NOT here — it is the metadata field `date` and lives in the filter. */
export interface FindDateCondition {
  which: "added" | "source_created" | "source_modified"
  op: "before" | "after" | "between" | "within_next" | "older_than"
  value: string | number | null
  value2: string | null
  unit: "days" | "weeks" | "months" | null
}

/** A relationship condition. `documentName` is display-only (the set-chip text). */
export interface FindRelationshipCondition {
  verb: RelVerb
  documentId: string
  documentName: string
}

// ── THE STATE ─────────────────────────────────────────────────────────────────────────

export interface FindState {
  readonly mode: FindMode
  /** The Find input — a file-name filter. Never shared with `askText` (S5). */
  readonly name: string
  /** The Ask input — a question handed to chat. Never shared with `name` (S5). */
  readonly askText: string
  readonly folder: FindFolderCondition | null
  readonly addedBy: FindAddedByCondition | null
  /** At most one per `which` (SET_DATE replaces). */
  readonly dates: readonly FindDateCondition[]
  readonly relationship: FindRelationshipCondition | null
  readonly version: FindVersion
  readonly sort: FindSort
  readonly offset: number
  readonly limit: number
}

export const DEFAULT_SORT: FindSort = "added_desc"

const DEFAULT_LIMIT = 25

export const initialFindState: FindState = {
  mode: "find",
  name: "",
  askText: "",
  folder: null,
  addedBy: null,
  dates: [],
  relationship: null,
  version: "latest",
  sort: DEFAULT_SORT,
  offset: 0,
  limit: DEFAULT_LIMIT,
}

// ── THE ACTIONS ───────────────────────────────────────────────────────────────────────

export type FindAction =
  | { type: "SET_MODE"; mode: FindMode }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_ASK_TEXT"; text: string }
  | { type: "SET_FOLDER"; folder: FindFolderCondition | null }
  | { type: "SET_ADDED_BY"; addedBy: FindAddedByCondition | null }
  | { type: "SET_DATE"; date: FindDateCondition }
  | { type: "REMOVE_DATE"; which: FindDateCondition["which"] }
  | { type: "SET_RELATIONSHIP"; relationship: FindRelationshipCondition | null }
  | { type: "SET_VERSION"; version: FindVersion }
  | { type: "SET_SORT"; sort: FindSort }
  | { type: "SET_PAGE"; offset: number; limit: number }
  | { type: "CLEAR_SEARCH" }

// ── THE REDUCER ───────────────────────────────────────────────────────────────────────

/**
 * Total over every action. Every CONDITION change (anything that changes which rows match,
 * or their order) returns to the first page; `SET_PAGE` is the only action that moves it.
 */
export function findReducer(state: FindState, action: FindAction): FindState {
  switch (action.type) {
    // Mode and the Ask text change nothing about the result set, so the page stays put.
    case "SET_MODE":
      return { ...state, mode: action.mode }
    case "SET_ASK_TEXT":
      return { ...state, askText: action.text }

    case "SET_NAME":
      return { ...state, name: action.name, offset: 0 }
    case "SET_FOLDER":
      return { ...state, folder: action.folder, offset: 0 }
    case "SET_ADDED_BY":
      return { ...state, addedBy: action.addedBy, offset: 0 }
    case "SET_DATE":
      // One per `which`: a second date on the same fact REPLACES the first, in place.
      return {
        ...state,
        dates: state.dates.some((d) => d.which === action.date.which)
          ? state.dates.map((d) => (d.which === action.date.which ? action.date : d))
          : [...state.dates, action.date],
        offset: 0,
      }
    case "REMOVE_DATE":
      return { ...state, dates: state.dates.filter((d) => d.which !== action.which), offset: 0 }
    case "SET_RELATIONSHIP":
      return { ...state, relationship: action.relationship, offset: 0 }
    case "SET_VERSION":
      return { ...state, version: action.version, offset: 0 }
    case "SET_SORT":
      return { ...state, sort: action.sort, offset: 0 }

    case "SET_PAGE":
      return { ...state, offset: action.offset, limit: action.limit }

    // Clear search resets every CONDITION and the version (D-06: back to Latest), and keeps
    // the person's mode, sort and Ask text — those are preferences, not conditions.
    case "CLEAR_SEARCH":
      return {
        ...state,
        name: "",
        folder: null,
        addedBy: null,
        dates: [],
        relationship: null,
        version: "latest",
        offset: 0,
      }

    default:
      // Unreachable while `FindAction` is exhaustive; returning the state keeps the
      // reducer total rather than throwing at a user.
      return state
  }
}

// ── THE DERIVED ACCESSORS ─────────────────────────────────────────────────────────────

/** True when any structure condition is held (not counting the name or the version). */
function hasStructureCondition(state: FindState): boolean {
  return (
    state.folder !== null ||
    state.addedBy !== null ||
    state.dates.length > 0 ||
    state.relationship !== null
  )
}

/**
 * UI-SPEC S4: a search is active when the name is non-empty, OR at least one condition is
 * set (structure here, or metadata in the filter), OR the version is not "latest".
 * A sort change alone is not a search.
 */
export function isSearchActive(state: FindState, metadataConditionCount: number): boolean {
  return (
    state.name.trim() !== "" ||
    metadataConditionCount > 0 ||
    hasStructureCondition(state) ||
    state.version !== "latest"
  )
}

/**
 * Pitfall 9: a saved view stores ONLY the metadata filter. A name, folder, added-by, file
 * date, relationship or non-latest version cannot be stored, so offering Save-as-view while
 * any of them is set would save a DIFFERENT search than the one on screen.
 */
export function canSaveAsView(state: FindState): boolean {
  return state.name.trim() === "" && !hasStructureCondition(state) && state.version === "latest"
}

/** The wire body, structurally identical to `DocumentSearchRequest` (types/index.ts). */
export interface FindSearchRequest<F extends FindFilterLike = FindFilterLike> {
  filter_expr: F
  name: string | null
  folder: { folder_id: string | null; include_subfolders: boolean } | null
  added_by: { kind: "me" | "connection" | "others"; connection_id: string | null } | null
  dates: Array<{
    which: FindDateCondition["which"]
    op: FindDateCondition["op"]
    value: string | number | null
    value2: string | null
    unit: "days" | "weeks" | "months" | null
  }>
  relationship: { verb: RelVerb; document_id: string } | null
  version: FindVersion
  sort: FindSort
  offset: number
  limit: number
}

/**
 * The exact `POST /document-search` body (271-01 wire contract), or `null` when no search
 * is active — the hook issues ZERO requests for `null`, which is what keeps the resting
 * Documents tab byte-identical to browse.
 */
export function toSearchRequest<F extends FindFilterLike>(
  state: FindState,
  filter: F,
): FindSearchRequest<F> | null {
  if (!isSearchActive(state, filter.conditions.length)) return null
  const name = state.name.trim()
  return {
    filter_expr: filter,
    name: name === "" ? null : name,
    folder: state.folder
      ? { folder_id: state.folder.folderId, include_subfolders: state.folder.includeSubfolders }
      : null,
    added_by: state.addedBy
      ? { kind: state.addedBy.kind, connection_id: state.addedBy.connectionId }
      : null,
    dates: state.dates.map((d) => ({
      which: d.which,
      op: d.op,
      value: d.value,
      value2: d.value2,
      unit: d.unit,
    })),
    relationship: state.relationship
      ? { verb: state.relationship.verb, document_id: state.relationship.documentId }
      : null,
    version: state.version,
    sort: state.sort,
    offset: state.offset,
    limit: state.limit,
  }
}

// ── SORT VOCABULARY ───────────────────────────────────────────────────────────────────

/** UI-SPEC §Copywriting, in order, default first. Every date says WHOSE date (270 rule). */
export const SORT_OPTIONS: ReadonlyArray<{ value: FindSort; label: string }> = [
  { value: "added_desc", label: "Added to Syrel (newest)" },
  { value: "added_asc", label: "Added to Syrel (oldest)" },
  { value: "document_date_desc", label: "Date in the document (newest)" },
  { value: "source_modified_desc", label: "Last modified in the file (newest)" },
  { value: "source_created_desc", label: "Created in the file (newest)" },
  { value: "name_asc", label: "Name (A to Z)" },
]

/** The row field the Find Date column reads. `document_date` is `metadata.date`. */
export type FindDateField = "created_at" | "source_created_at" | "source_modified_at" | "document_date"

/**
 * The Date column names the fact the active sort uses (UI-SPEC S4). A name sort has no
 * date of its own, so it shows "Added".
 */
export function sortDateColumn(sort: FindSort): { label: string; field: FindDateField } {
  switch (sort) {
    case "document_date_desc":
      return { label: "Date in the document", field: "document_date" }
    case "source_modified_desc":
      return { label: "Modified in the file", field: "source_modified_at" }
    case "source_created_desc":
      return { label: "Created in the file", field: "source_created_at" }
    case "added_desc":
    case "added_asc":
    case "name_asc":
    default:
      return { label: "Added", field: "created_at" }
  }
}
