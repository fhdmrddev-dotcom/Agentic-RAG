/**
 * Phase 184 Wave 0 (CANVAS-02 / CANVAS-03 · D-184-01 · D-184-02 · D-184-03) — builderStore.
 *
 * THE ONE HOME OF THE WORKING DEFINITION. Before this module the definition lived in
 * `WorkflowBuilderPage.tsx`'s `useState<BuilderState>`; plan 184-04 repoints the page
 * onto this store. D-184-01 puts it here rather than inside the canvas because
 * `PhaseFormPanel` is shared by BOTH authoring doors — a config edit made from the
 * shipped `≣ Spine` flows through the same `onChange`, and a canvas-scoped store would
 * leave those edits outside the history R4 says must contain them. The undo/redo
 * AFFORDANCES stay canvas-only and flag-gated; the HISTORY is complete.
 *
 * ── A FACTORY, NOT A SINGLETON (a deliberate divergence) ───────────────────────────
 *
 * `frontend/src/stores/streamsStore.ts` is the app's only other zustand store and it is
 * a MODULE SINGLETON — correct there, because one browser tab has one streaming session.
 * This one is a per-Builder-mount FACTORY. The reason is the undo stack: a module-level
 * store would carry one workflow's edit history into the next workflow the user opens in
 * the same tab, so `⌘Z` on workflow B could restore a step from workflow A. Verified
 * upstream (`zundo` `src/index.ts`): `store.temporal = createStore(...)` is assigned
 * INSIDE the config initializer, so every factory call gets its own independent temporal
 * store. Per-mount is a supported shape, not a workaround. Do not "fix" this into a
 * singleton.
 *
 * ── THE TRACKED / UNTRACKED SPLIT ─────────────────────────────────────────────────
 *
 * `partialize` narrows the undo stack to `TrackedSlice` and nothing else. That is
 * REQUIRED, and not as a nudge guard: EVERY `set()` on this store fires zundo's temporal
 * hook, so without it an arriving `POST /workflows/validate` response landing in
 * `verdicts` would push an undo entry and `⌘Z` would undo a SERVER VERDICT. VALID-03
 * says every verdict comes from the server; an undoable verdict is that contract broken.
 *
 * THE COSMETIC `dy` IS NOT A FIELD OF THIS STORE AT ALL (D-184-02). It is not filtered
 * out — it is absent. R4's "a nudge adds no history entry" is therefore true BY
 * CONSTRUCTION rather than by a filter that could be misconfigured; the browser-local
 * nudge lives in its own module (`canvasNudge.ts`, plan 184-07) and never reaches here.
 * `builderStore.test.ts` asserts the ABSENCE structurally, over the key set.
 *
 * ── UNDO NEVER WRITES TO THE SERVER (D-184-03) ────────────────────────────────────
 *
 * No action in this module calls the API client or the network — asserted by a `?raw`
 * source fence and by a whole-suite zero-call spy. Stepping back past a save point makes
 * the in-memory definition differ from what was PATCHed, so `dirty` re-arms honestly
 * (a `subscribe` on the `phases` reference does that, without any action knowing about
 * undo). An undo that auto-PATCHed is exactly the surprise a no-autosave phase exists to
 * prevent. `markSaved()` is the only thing that clears `dirty`.
 *
 * ── WHAT STAYS ON THE PAGE (D-184-05) ─────────────────────────────────────────────
 *
 * Persistence. `draftIdRef` / `creatingRef` / `onPersist` / `onSaveDraft` are NOT here
 * and must not move here: Phase 186 rewrites exactly that seam for autosave, and
 * extracting it now would be churn against a seam about to move. This store owns the
 * definition STATE; the page owns the WRITE.
 */
import { createStore, type StoreApi } from "zustand/vanilla"
import { temporal, type TemporalState } from "zundo"

import { fromCanvas, type CanvasNode } from "@/components/workflows/canvasModel"
import {
  addPhase,
  insertPhaseAt,
  minimalPhaseFor,
  movePhase,
  patchPhaseConfig,
  removePhase,
  renumber,
  slugForType,
  type PhaseTypeId,
} from "@/components/workflows/definitionOps"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import type { BuilderDefinition } from "@/pages/WorkflowBuilderPage"

// ── Tuning constants (Claude's discretion, per 184-CONTEXT) ────────────────────

/**
 * The undo depth cap. zundo evicts exactly ONE entry per push at a `>=` boundary
 * (verified in `zundo` `src/temporal.ts` `_handleSet`), so this is a hard cap, not a
 * sliding window that grows.
 */
export const HISTORY_LIMIT = 50

/**
 * The quiet period a run of config edits coalesces over (D-184-02), so one typed
 * sentence is ONE undo rather than forty. A field blur can commit the run early via
 * `flushHistory()`.
 */
export const CONFIG_COALESCE_MS = 500

// ── The tracked half ───────────────────────────────────────────────────────────

/** Which KIND of edit produced the current state — the discriminator `handleSet` reads. */
export type EditKind = "structural" | "config"

/**
 * The ONLY keys snapshotted into the undo stack. Everything else on the store is
 * untracked by construction of `partialize`.
 */
export interface TrackedSlice {
  /** The working definition's phases — the single thing an undo restores. */
  phases: PhaseSpecJSON[]
  /** Immediate-push (structural) vs coalesced (config). Read by `handleSet`. */
  lastEditKind: EditKind
  /** Monotonic, so two identical-looking config edits stay distinguishable. */
  editSeq: number
}

// ── The untracked half ─────────────────────────────────────────────────────────

/**
 * One server verdict, exactly as `POST /workflows/validate` sends it. The server owns
 * the whole vocabulary — `code` is a free string on the wire and the severity split is
 * D-182-03's. Declared here because this store is the first consumer; when the API
 * client gains its typed caller it imports this type rather than declaring a second
 * copy (D-182-06: there is one lint implementation and it is not on the client).
 */
export interface ServerVerdict {
  code: string
  /** The phase SLUG (== the canvas node id), or null for a workflow-wide verdict. */
  phase: string | null
  message: string
  severity: "error" | "incomplete"
}

/** Why the live check could not produce a verdict. `null` = the check is healthy. */
export type DegradedCause = { kind: "422" | "network" } | null

/** The page's four-state composition machine, moved off `useState<BuilderState>`. */
export type BuilderPhase = "empty" | "composing" | "drafted" | "error"

/** The explicit-save affordance's transient feedback state. */
export type SaveState = "idle" | "saving" | "saved" | "error"

/**
 * THE LOCKED SAVE WORDING (184-CONTEXT `<specifics>`), and why it lives in this module
 * rather than in the page that first declared it.
 *
 * Plan 184-11 put it on `WorkflowBuilderPage`, which was the only surface that said
 * anything about a save. Plan 184-13 adds a SECOND — the canvas toolbar — and a leaf on
 * the code-split canvas chunk must not reach back into a page module to read a string
 * (that would pull the whole page into the canvas chunk and undo D-183-03). Re-typing the
 * literal in the toolbar was the other option, and *"two spellings of a locked string is
 * how a locked string stops being locked"* (184-11's own words). So it moves HERE, next to
 * the `SaveState` type and the untracked `saveState` slot this store already reserves for
 * the toolbar, and the page RE-EXPORTS it under the same name for every existing caller.
 *
 * The sentence itself: the surface says the draft is SAVED and, in the same breath, that
 * it is still a draft. No word in it may imply published — publishing is a separate act
 * behind the gauntlet, and a save that reads like a release is a lie shown a hundred times
 * a session.
 */
export const SAVED_STILL_A_DRAFT = "Saved · still a draft"

/**
 * The working definition MINUS its phases.
 *
 * Spelled as a key-remapped mapped type rather than `Omit<BuilderDefinition, "phases">`:
 * `BuilderDefinition` carries an index signature, and `Omit` collapses such a type to
 * `{}` (its `Exclude<keyof T, "phases">` cannot subtract a literal from `string`), which
 * would silently lose `slug` / `project_folder_id` and every other declared field. The
 * remap subtracts the literal key while keeping both the declared fields and the index
 * signature, so the shape is DECLARED in exactly one place — `WorkflowBuilderPage`'s
 * `BuilderDefinition` — and a second hand-copied field list cannot drift from it.
 */
export type DefinitionMeta = {
  [K in keyof BuilderDefinition as K extends "phases" ? never : K]: BuilderDefinition[K]
}

export interface BuilderStoreState extends TrackedSlice {
  /**
   * The working definition MINUS `phases` — slug, version, business_requirement,
   * project_folder_id and whatever else the row carries. Untracked: an undo restores
   * steps, never the workflow's identity.
   */
  meta: DefinitionMeta
  /** empty → composing → drafted | error. Untracked (a document transition, not an edit). */
  builderPhase: BuilderPhase
  /** The honest generate-failure message. Untracked. */
  errorMessage: string | null
  /** The optional detail line under it. Untracked. */
  errorDetail: string | null
  /** Server verdicts. UNTRACKED — see the `partialize` comment; an undoable verdict
   *  would be VALID-03 broken. */
  verdicts: readonly ServerVerdict[]
  /** A live check is in flight. Untracked. */
  checking: boolean
  /** The check could not be performed. Untracked. */
  degraded: DegradedCause
  /** The in-memory definition differs from what was last PATCHed. Untracked, and
   *  re-armed by an undo (D-184-03) via the subscription in the factory below. */
  dirty: boolean
  /** Transient save feedback for the canvas toolbar (141-B). Untracked.
   *  NOT wired in plan 184-04 — the page keeps its own shipped `saveState` for the
   *  header's Save-draft button, because D-184-05 leaves persistence untouched here.
   *  This slot is the toolbar's home and is deliberately unread today. */
  saveState: SaveState

  // ── Actions. Every one is immutable and every structural one delegates to a pure
  //    `definitionOps` op — this store owns NO mutation logic of its own. ──

  /** Load a definition and enter the drafted editing view. Replaces the DOCUMENT, so it
   *  clears the undo history and does not mark the draft dirty. */
  setDrafted: (definition: BuilderDefinition) => void
  /** Enter the composing beat: no document, no history. */
  setComposing: () => void
  /** Enter the honest generate-failure surface. */
  setErrorState: (message: string, detail?: string) => void

  /** Append a new minimal step of `type` (structural). */
  addPhaseOfType: (type: PhaseTypeId) => void
  /** Insert a new minimal step of `type` at render position `index` (structural). */
  insertPhaseOfTypeAt: (index: number, type: PhaseTypeId) => void
  /** Move the step carrying `slug` to render position `toIndex` (structural). */
  reorderPhase: (slug: string, toIndex: number) => void
  /** Commit an order that ORIGINATED in canvas node space (structural). Reads the new
   *  order through `fromCanvas` and ends in `reorderPhase` — see the implementation's
   *  docblock for why the two modules are not redundant. */
  commitCanvasNodes: (nodes: readonly CanvasNode[]) => void
  /** Remove the step carrying `slug` (structural). */
  removePhaseBySlug: (slug: string) => void
  /** Merge a phase-form patch into one step's config (config — coalesces). */
  patchConfig: (slug: string, patch: Readonly<Record<string, unknown>>) => void

  setVerdicts: (verdicts: readonly ServerVerdict[]) => void
  setChecking: (checking: boolean) => void
  setDegraded: (cause: DegradedCause) => void
  setSaveState: (saveState: SaveState) => void
  /** The ONLY thing that clears `dirty`. Never writes anything. */
  markSaved: () => void
  /** Commit a coalescing run of config edits NOW (a field blur, a view change). */
  flushHistory: () => void
}

/** The store instance a `BuilderStoreProvider` carries. */
export type BuilderStore = StoreApi<BuilderStoreState> & {
  temporal: StoreApi<TemporalState<TrackedSlice>>
}

/**
 * The ONE place the two halves recombine into a definition — for the publish seam and
 * for the page's persistence read.
 *
 * The outgoing JSON key ORDER may differ from the loaded row's (spread order, not
 * insertion order). That is deliberate and not observable: the backend is Pydantic and
 * order-insensitive, and R3's guard asserts on the key SET, never on key order.
 *
 * The parameter is narrowed to the two halves it actually reads rather than the whole
 * state, so a React caller can hand it exactly the two selector values it already has
 * (`selectDefinition({ meta, phases })`) instead of reaching for `getState()` in a
 * rendered value — while a full `BuilderStoreState` still satisfies it structurally for
 * the side-effect callers.
 */
export function selectDefinition(state: Pick<BuilderStoreState, "meta" | "phases">): BuilderDefinition {
  return { ...state.meta, phases: state.phases }
}

/**
 * The real 4-argument shape of the function zundo hands to `handleSet`.
 *
 * `ZundoOptions.handleSet` types its ARGUMENT as `StoreApi<TState>['setState']` while
 * typing its RETURN with the real 4-arg signature (`zundo/dist/index.d.ts`) — but at the
 * call site (`zundo` `src/index.ts`, the `curriedHandleSet(pastState, undefined,
 * currentState, deltaState)` invocation) what is actually passed in is the temporal
 * store's `_handleSet`, which takes those four. That asymmetry makes exactly one narrow
 * cast unavoidable. It is contained in this file and never leaks past the module
 * boundary.
 */
type HistoryPush = (
  pastState: Parameters<StoreApi<BuilderStoreState>["setState"]>[0],
  replace: Parameters<StoreApi<BuilderStoreState>["setState"]>[1],
  currentState: TrackedSlice,
  deltaState?: Partial<TrackedSlice> | null,
) => void

/**
 * Build a Builder store for ONE mount.
 *
 * @param initial the definition to open on, or `null` for a fresh describe-first build.
 */
export function createBuilderStore(initial: BuilderDefinition | null): BuilderStore {
  // Set while a DOCUMENT-replacing action runs, so the dirty subscription below does not
  // read "the phases reference changed" as "the user edited something".
  let suppressDirty = false
  // Assigned by `handleSet` at creation time (zundo curries it inside the config
  // initializer, before any action can run), so `flushHistory()` can commit a
  // coalescing run early.
  let flushCoalesced: () => void = () => {}
  // The temporal half, captured after creation so document-replacing actions can clear
  // the history. Typed structurally rather than as `BuilderStore` to avoid a circular
  // inference on this function's own return type.
  let temporalRef: { temporal: StoreApi<TemporalState<TrackedSlice>> } | null = null

  const { phases: initialPhases, ...initialMeta } = initial ?? { phases: [] as PhaseSpecJSON[] }

  const store = createStore<BuilderStoreState>()(
    temporal(
      (set, get) => ({
        // ── tracked ──
        phases: initialPhases,
        lastEditKind: "structural" as EditKind,
        editSeq: 0,

        // ── untracked ──
        meta: initialMeta as DefinitionMeta,
        builderPhase: (initial ? "drafted" : "empty") as BuilderPhase,
        errorMessage: null,
        errorDetail: null,
        verdicts: [] as readonly ServerVerdict[],
        checking: false,
        degraded: null as DegradedCause,
        dirty: false,
        saveState: "idle" as SaveState,

        // ── document transitions ──
        setDrafted: (definition) => {
          const { phases, ...meta } = definition
          suppressDirty = true
          set({
            phases,
            meta: meta as DefinitionMeta,
            builderPhase: "drafted",
            errorMessage: null,
            errorDetail: null,
            lastEditKind: "structural",
            editSeq: get().editSeq + 1,
            dirty: false,
          })
          suppressDirty = false
          // A generated/opened document is a NEW document: undoing into the previous
          // one would wipe a workflow the user just asked for.
          temporalRef?.temporal.getState().clear()
        },

        setComposing: () => {
          suppressDirty = true
          set({
            phases: [],
            meta: {},
            builderPhase: "composing",
            errorMessage: null,
            errorDetail: null,
            verdicts: [],
            checking: false,
            degraded: null,
            dirty: false,
            lastEditKind: "structural",
            editSeq: get().editSeq + 1,
          })
          suppressDirty = false
          temporalRef?.temporal.getState().clear()
        },

        setErrorState: (message, detail) => {
          set({
            builderPhase: "error",
            errorMessage: message,
            errorDetail: detail ?? null,
          })
        },

        // ── structural edits: each is ONE atomic act and ONE undo ──
        addPhaseOfType: (type) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          const slug = slugForType(s.phases, type)
          const spec = minimalPhaseFor(type, slug, s.phases.length)
          set({
            phases: addPhase(s.phases, spec),
            lastEditKind: "structural",
            editSeq: s.editSeq + 1,
          })
        },

        insertPhaseOfTypeAt: (index, type) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          const slug = slugForType(s.phases, type)
          const spec = minimalPhaseFor(type, slug, index)
          set({
            phases: insertPhaseAt(s.phases, index, spec),
            lastEditKind: "structural",
            editSeq: s.editSeq + 1,
          })
        },

        reorderPhase: (slug, toIndex) => {
          const s = get()
          // An unknown slug is a no-op in `movePhase` too, but it still returns a NEW
          // array — bailing here keeps a phantom entry out of the undo stack.
          if (!s.phases.some((p) => p.slug === slug)) return
          set({
            phases: movePhase(s.phases, slug, toIndex),
            lastEditKind: "structural",
            editSeq: s.editSeq + 1,
          })
        },

        /**
         * Plan 184-10 Task 1 (R2 · D-184-09 · D-184-10) — the CANVAS-ORIGINATED order
         * commit. Both gesture paths end here, and this ends in `reorderPhase`.
         *
         * WHY THIS IS NOT A THIRD COPY OF THE REORDER RULE. Two modules own two halves
         * and neither may grow the other's: `canvasModel.fromCanvas` is the sole
         * CANVAS→DEFINITION serializer, and `definitionOps` is the sole
         * DEFINITION→DEFINITION mutation home. This action is the seam where a commit
         * ORIGINATES in canvas node space, so it reads the new order through
         * `fromCanvas(nodes, phases)` — which never renumbers, deliberately — derives the
         * moved slug and its target render index from that order, and then DELEGATES to
         * `reorderPhase`, i.e. `renumber(movePhase(...))`. That is what keeps D-184-09's
         * "one op behind both paths" literally true rather than merely intended: the
         * pointer drag and the `⌥←` / `⌥→` press both land on `reorderPhase`, and there
         * is exactly one place in the app where a phase array is spliced.
         *
         * IT IS A NO-OP UNLESS SOMETHING ACTUALLY MOVED. Four bail-outs, each of which
         * must leave `pastStates` and `dirty` untouched:
         *  1. DUPLICATE SLUGS — `fromCanvas`'s fail-safe hands the source back untouched
         *     (losing a step on save is the worst failure available), so its output
         *     carries no order information at all. The predicate below is that same
         *     condition, read off the source, so the two agree by definition.
         *  2. A NODE ARRAY THAT DOES NOT COVER EVERY PHASE — a partial array cannot be a
         *     reorder, only a loss.
         *  3. THE ORDER IS UNCHANGED — a drag that lands back in its own lane, and every
         *     purely vertical drag by construction (D-184-10).
         *  4. AN ORDER NO SINGLE MOVE EXPLAINS — unreachable from either shipped gesture
         *     (each moves exactly one card), and refusing is the honest answer rather
         *     than picking an arbitrary op that was never performed.
         *
         * `lastEditKind` is `"structural"` (inherited from `reorderPhase`), so the entry
         * pushes IMMEDIATELY rather than coalescing — a reorder is one atomic act
         * (D-184-02). And this action performs NO network call of any kind: the
         * definition moves, the server is told nothing until the page saves (D-184-03).
         *
         * The current render order is read as `renumber(phases).map(…slug)` rather than
         * by re-sorting here, so the load-bearing `(phase_index, slug)` comparator stays
         * in the one module that owns it.
         */
        commitCanvasNodes: (nodes) => {
          const s = get()

          const current = renumber(s.phases).map((p) => p.slug)
          // (1) The `fromCanvas` fail-safe condition, read off the source itself.
          if (new Set(current).size !== current.length) return

          const next = fromCanvas(nodes, s.phases).map((p) => p.slug)
          // (2) Every phase must be accounted for, or this is not a reorder.
          if (next.length !== current.length) return
          // (3) Nothing moved.
          if (next.every((slug, i) => slug === current[i])) return

          // (4) Which ONE card moved? The slug whose removal makes the two orders
          // identical is exactly the slug `movePhase` would splice out and re-insert,
          // so the derivation and the op agree by construction rather than by arithmetic
          // that could drift from it.
          const moved = current.find((slug) => {
            const withoutCurrent = current.filter((other) => other !== slug)
            const withoutNext = next.filter((other) => other !== slug)
            return withoutCurrent.every((other, i) => other === withoutNext[i])
          })
          if (moved === undefined) return

          get().reorderPhase(moved, next.indexOf(moved))
        },

        removePhaseBySlug: (slug) => {
          const s = get()
          if (!s.phases.some((p) => p.slug === slug)) return
          set({
            phases: removePhase(s.phases, slug),
            lastEditKind: "structural",
            editSeq: s.editSeq + 1,
          })
        },

        // ── config edits: a run of them coalesces into ONE undo ──
        patchConfig: (slug, patch) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          if (!s.phases.some((p) => p.slug === slug)) return
          set({
            phases: patchPhaseConfig(s.phases, slug, patch),
            lastEditKind: "config",
            editSeq: s.editSeq + 1,
          })
        },

        // ── untracked setters: none of these may reach the undo stack ──
        setVerdicts: (verdicts) => set({ verdicts }),
        setChecking: (checking) => set({ checking }),
        setDegraded: (degraded) => set({ degraded }),
        setSaveState: (saveState) => set({ saveState }),
        markSaved: () => set({ dirty: false }),
        flushHistory: () => flushCoalesced(),
      }),
      {
        /**
         * REQUIRED, and not as a nudge guard (the cosmetic `dy` is not a field of this
         * store at all). Every `set()` fires the temporal hook, so without this an
         * arriving `/validate` response landing in `verdicts` would push an undo entry
         * and `⌘Z` would undo a server verdict.
         */
        partialize: (s): TrackedSlice => ({
          phases: s.phases,
          lastEditKind: s.lastEditKind,
          editSeq: s.editSeq,
        }),
        limit: HISTORY_LIMIT,
        // Cheap identity early-out: an identical phases reference is nothing to record.
        // This is the belt to `partialize`'s braces — an untracked setter never even
        // reaches `handleSet`.
        equality: (past, next) => past.phases === next.phases,
        handleSet: (rawPush) => {
          const push = rawPush as unknown as HistoryPush
          let timer: ReturnType<typeof setTimeout> | null = null
          let pending: Parameters<HistoryPush> | null = null

          const flush = () => {
            if (timer !== null) {
              clearTimeout(timer)
              timer = null
            }
            if (pending !== null) {
              const args = pending
              pending = null
              push(...args)
            }
          }
          flushCoalesced = flush

          return (pastState, replace, currentState, deltaState) => {
            const args: Parameters<HistoryPush> = [pastState, replace, currentState, deltaState]

            if (currentState.lastEditKind === "structural") {
              // Commit any coalescing run FIRST, so no config edit is swallowed by the
              // atomic act that interrupted it, then record this act immediately.
              flush()
              push(...args)
              return
            }

            // A config edit. The FIRST pending args of a run are the ones kept: the
            // entry an undo restores must be the state BEFORE the run began, or "one
            // typed sentence is one undo" would step back a single keystroke instead.
            if (pending === null) pending = args
            if (timer !== null) clearTimeout(timer)
            timer = setTimeout(flush, CONFIG_COALESCE_MS)
          }
        },
      },
    ),
  )

  temporalRef = store

  /**
   * D-184-03 — the honest dirty re-arm. Whenever the `phases` reference changes and the
   * draft is currently clean, it becomes dirty. Because zundo's `undo()` writes through
   * the store's raw `set`, an undo across the save boundary lands here too and the
   * surface honestly reads `dirty` again — without any action knowing that undo exists,
   * and without anything writing to the server.
   */
  store.subscribe((state, prev) => {
    if (suppressDirty) return
    if (state.phases !== prev.phases && state.dirty === false) {
      store.setState({ dirty: true })
    }
  })

  return store
}
