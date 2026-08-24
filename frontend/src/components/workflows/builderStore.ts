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
 * ── WHERE PERSISTENCE LIVES, AND WHY NOT HERE (D-184-05 → D-186-05) ───────────────
 *
 * Persistence. `draftIdRef` / `creatingRef` / the create-once-then-PATCH body and the
 * debounce that drives them are NOT here and must not move here.
 *
 * 184-05 phrased this as the page owning the write, which was true then and is not any
 * more: the same note promised that 186 would rewrite exactly that seam, and 186 did. The
 * write now lives in the `useDraftPersistence` hook (`frontend/src/hooks/useDraftPersistence.ts`,
 * D-186-05) — one home for the timer, the concurrency token, the hold conditions and the
 * honest refusal branches — and `WorkflowBuilderPage` composes it the way it already
 * composes `useLiveValidation`. Updated here rather than left standing, because a docblock
 * that describes a seam which has moved is the trap this codebase names elsewhere.
 *
 * THE RULE ITSELF IS UNCHANGED AND IS NOT NEGOTIABLE: this store owns the definition
 * STATE and nothing in this module may name the API client or open a request of any
 * kind. Which module holds the write is a detail; that it is never THIS one is the fence.
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
  setPhaseGovernance,
  slugForType,
  type PhaseGovernancePatch,
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

/**
 * THE LOCKED SAVE WORDING (184-CONTEXT `<specifics>`), and why it lives in this module
 * rather than in the page that first declared it.
 *
 * Plan 184-11 put it on `WorkflowBuilderPage`, which was the only surface that said
 * anything about a save. Plan 184-13 adds a SECOND — the canvas toolbar — and a leaf on
 * the code-split canvas chunk must not reach back into a page module to read a string
 * (that would pull the whole page into the canvas chunk and undo D-183-03). Re-typing the
 * literal in the toolbar was the other option, and *"two spellings of a locked string is
 * how a locked string stops being locked"* (184-11's own words). So it moves HERE — the
 * module both save surfaces already import — and the page RE-EXPORTS it under the same
 * name for every existing caller.
 *
 * ⚠ 186-04 UPDATE: this string is now the ONLY save-related symbol this module carries;
 * the untracked save slot it used to sit beside is retired (the block further down says
 * why). The string itself is unaffected — its reason for living here was never that slot,
 * it was that a leaf on the code-split canvas chunk must not reach back into a page
 * module to read a literal.
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

/**
 * Phase 193 (AUTH-03) — one entry of the definition's `assets[]`, as the template door mints
 * it (`backend/app/api/workflows.py`'s `TemplateAssetRef`, itself field-for-field
 * `app.models.harness.AssetRef`).
 *
 * ⚠ DECLARED HERE RATHER THAN IMPORTED FROM THE API CLIENT, and that is a fence obeyed, not
 * an oversight: this module may not name the API client in ANY import form —
 * `builderStore.test.ts` sweeps this source for that specifier, and a type-only import
 * matches its regex exactly like a value one.
 *
 * ⚠ AND THE FENCE IS STRICTER THAN IT LOOKS: the sweep reads the RAW source, so it fires on
 * PROSE too. An earlier draft of this very docblock quoted the import form it was explaining
 * and turned the fence RED — the same shape 192-05 hit with its `title=` sweep. Do not spell
 * the specifier here, in any comment, even to describe it.
 *
 * The two declarations are structurally identical, so a drift between them is a typecheck
 * error at the one call site that carries a value across (`WorkflowBuilderPage`'s
 * `onTemplateAttached`), not a silent divergence.
 */
export interface TemplateAssetDescriptor {
  kind: "template"
  asset_id: string
  filename: string
  mime: string
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

  /*
   * ── THE RETIRED SAVE SLOT (186-04 — the call 184-04 left open, now ANSWERED) ──────
   *
   * 184-04 reserved a `saveState` field here "for the canvas toolbar (141-B)"; 184-13
   * built that toolbar and did not use it; 184-13's own note then handed the keep-or-cut
   * decision to this phase. 186-04 CUT IT, for four reasons worth keeping written down so
   * nobody re-adds it:
   *
   *   1. Zero production readers. Its only call site in the whole repo was one assertion
   *      in `builderStore.test.ts` — a slot exercised solely by the test that guards it.
   *   2. Two enums, one concept. Its `"idle" | "saving" | "saved" | "error"` was strictly
   *      NARROWER than the union the app actually renders (the toolbar's own, in
   *      `CanvasToolbar.tsx`, which carries a fifth `"dirty"` reading) — the same failure
   *      mode the locked-save-wording docblock names one screen up: two spellings is how
   *      a locked thing stops being locked.
   *   3. The real persistence state is wider still. It has to represent HELD (for two
   *      distinct reasons) and CONFLICT, which no flat enum can carry and no boolean pair
   *      can carry honestly. `useDraftPersistence` models it as a discriminated union.
   *   4. This module may not name the API client (the fence above). State whose one
   *      writer is a network call therefore cannot live in the undo store.
   *
   * `dirty` above stays: it is a fact about the DEFINITION, not about a request, and
   * `markSaved()` — still the only thing that clears it — writes nothing.
   */

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
  /** Set one step's governance intent at PhaseSpec level (config — coalesces).
   *  Separate from `patchConfig` because these fields are siblings of `validators`,
   *  not members of the config union (D-185-10). */
  setGovernance: (slug: string, patch: PhaseGovernancePatch) => void

  setVerdicts: (verdicts: readonly ServerVerdict[]) => void
  setChecking: (checking: boolean) => void
  setDegraded: (cause: DegradedCause) => void
  /** Bind (or unbind, with `null`) the workflow's knowledge base. Untracked, and the one
   *  action that arms `dirty` itself — `setProjectFolder`'s docblock in the factory below
   *  says why a `meta`-only edit has to. */
  setProjectFolder: (id: string | null) => void
  /** Set the workflow's one-line business requirement — the publish-required purpose
   *  (BUG-260809-02). Untracked, and arms `dirty` itself for the same reason
   *  `setProjectFolder` does; see its implementation docblock in the factory below. */
  setBusinessRequirement: (text: string) => void
  /** Attach (or replace) the workflow's template in `meta.assets[]` — the definition-level
   *  write Phase 193's authoring door needs. Untracked, and arms `dirty` itself for the
   *  same reason its two `meta`-writing siblings do; see its implementation docblock. */
  setTemplateAsset: (asset: TemplateAssetDescriptor) => void
  /** Set the workflow's human-readable name (D-15) — the FOURTH `meta`-writing sibling.
   *  Untracked, and arms `dirty` itself for the same reason the three actions above it do;
   *  see its implementation docblock in the factory below. Writes exactly ONE `meta` key,
   *  and NEVER the key that identity, forks and versioning key off. */
  setName: (name: string) => void
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

        /**
         * Phase 185 (D-185-10) — the governance write, mirroring `patchConfig` exactly:
         * the same two guards, delegation to the ONE pure op, the same `editSeq` bump.
         *
         * `lastEditKind` IS `"config"`, DECIDED RATHER THAN COPIED. Arming a checkpoint
         * or escalating grounding changes no run order, no node count and no
         * `phase_index` — nothing a `"structural"` entry exists to record. What it does
         * resemble is a run of inspector edits, so it takes the coalescing branch: a
         * person who flicks a switch twice, or sets both dials in one visit to a step,
         * should not have to press undo twice to get back where they were.
         */
        setGovernance: (slug, patch) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          if (!s.phases.some((p) => p.slug === slug)) return
          set({
            phases: setPhaseGovernance(s.phases, slug, patch),
            lastEditKind: "config",
            editSeq: s.editSeq + 1,
          })
        },

        // ── untracked setters: none of these may reach the undo stack ──
        setVerdicts: (verdicts) => set({ verdicts }),
        setChecking: (checking) => set({ checking }),
        setDegraded: (degraded) => set({ degraded }),

        /**
         * Phase 186-04 (D-186-15 · F14) — bind, re-bind or unbind the workflow's
         * knowledge base. A WORKFLOW-LEVEL definition edit, and the one repair path
         * `BUG-260731-03` needs: today the choice exists only on the pre-draft describe
         * screen, so two of the three creation paths never offer it at all.
         *
         * WHY IT SETS `dirty` EXPLICITLY, rather than relying on the subscription below.
         * That subscription arms `dirty` on a change to the **`phases`** reference and on
         * nothing else. `project_folder_id` lives on `meta`, so a binding would otherwise
         * be a genuine definition change that the leave guard never noticed: the page's
         * `definition` memo would take a new identity (its deps include `meta`, so a save
         * would even be scheduled) while `dirty` stayed false — no `beforeunload`, no
         * leave prompt, and a toolbar that reads clean. Writing and arming in ONE `set()`
         * is what makes that impossible to forget at a second call site.
         *
         * WHY IT IS UNTRACKED. `partialize` narrows the undo stack to `phases` plus the
         * two edit discriminators, so an undo restores STEPS, never the workflow's
         * identity — the rule the `meta` field's own docblock states. A re-bind is undone
         * by re-picking, not by `⌘Z`, and F14 pins the stack depth to prove it.
         *
         * WHY IT TOUCHES NEITHER `suppressDirty` NOR `temporalRef`. Those bracket a set
         * that replaces the DOCUMENT (`setDrafted` / `setComposing`), where "the phases
         * reference changed" must not read as "the user edited something" and the previous
         * document must not be reachable by undo. Binding a knowledge base is an EDIT to
         * the document in hand, not a transition to a different one.
         *
         * The `builderPhase !== "drafted"` bail is the shipped guard shape every
         * document-scoped action carries, and it keeps a binding out of the composing beat
         * where `meta` is deliberately empty.
         *
         * `hasEdited` is the page's half of the same question and is flipped at the chip's
         * call site (186-08), not by widening the subscription — that exclusion exists so
         * generate/open do not start the live-validation loop, and it stays.
         */
        setProjectFolder: (id) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          set({ meta: { ...s.meta, project_folder_id: id }, dirty: true })
        },

        /**
         * ── Phase 193.2-09 (D-06) — THE MARK DEMOTES ON EDIT, IN THIS SAME `set()` ───────
         *
         * `193.2-07` added `business_requirement_seeded_by_ai`, stamped server-side when the
         * generator PROPOSES the requirement, and `193.2-09` renders it as a visible mark on
         * the Builder header. The moment the author types, the value is no longer purely the
         * AI's — so the flag is cleared HERE, in the SAME `set()` that writes the text. Not a
         * second write, and not something the render decides.
         *
         * THE SHIPPED RULE THIS MIRRORS. `definitionOps.ts`'s `patchPhaseConfig` clears BOTH
         * `name` and `name_seeded_by_ai` together, because *"clearing only the name would
         * leave a provenance marker describing a name that no longer exists"*. Same sentence,
         * other direction: writing only the text would leave a marker describing text nobody
         * proposed. Value and marker travel together, or one of them lies.
         *
         * ⚠ CLEARED ON **ANY** EDIT — NO CLIENT-SIDE "IS THIS STILL THE AI's SENTENCE?".
         * Comparing the new text against the seeded value, diffing it, or debouncing the
         * decision would be exactly the second copy of a server predicate the paragraph below
         * forbids by name (D-182-06) — and a worse one than a trim would be, because the
         * server holds no such predicate at all to be a copy OF. Provenance is decided in ONE
         * place (`workflow_authoring.py`, after validation, ignoring the emitted payload in
         * both directions); this action only ever RETIRES it.
         *
         * WHY `false` RATHER THAN `delete`, and the two are NOT interchangeable here.
         * `patchPhaseConfig` deletes because `name` / `name_seeded_by_ai` are OPTIONAL keys
         * where absence is the only honest spelling of "no name", and an explicit `undefined`
         * would serialize into a backend union with `extra="forbid"`. This field differs in
         * the one way that matters: `WorkflowDefinition` DECLARES it, `bool = False`, with no
         * `| None` (`backend/app/models/harness.py`). So `false` is a declared, valid value
         * that `extra="forbid"` accepts and that means exactly what an absent key would mean
         * — there is no round-trip identity to protect. What `false` buys is EVIDENCE: the
         * demote is then directly observable in the PATCH body, whereas an absent key is
         * indistinguishable from a store that never wrote the field at all. `undefined` is
         * refused outright — that is the trap `definitionOps` avoided by deleting.
         *
         * WHITESPACE STILL GOES THROUGH, and the honest consequence is stated rather than
         * smoothed: editing a seeded value down to `"   "` clears the flag AND leaves a
         * whitespace value. Correct on both halves — the server's stamp would refuse to mark
         * such a value either (`193.2-07`'s empty rule), and the shipped
         * `REQUIREMENT_INVITATION` placeholder does not show for a whitespace value. That is
         * today's behaviour and this plan does not change it.
         *
         * ── everything below is the quick-260809-klo docblock, unedited ──────────────────
         *
         * Quick 260809-klo (BUG-260809-02) — write the workflow's one-line business
         * requirement. A WORKFLOW-LEVEL definition edit, and the store half of the one
         * hole that made a canvas-authored workflow UNPUBLISHABLE: the field is declared
         * on `BuilderDefinition`, round-tripped by `setDrafted`'s `{ phases, ...meta }`
         * destructure and already carried into the PATCH body by `selectDefinition` — but
         * until now nothing in the app ever WROTE it, while the publish gauntlet's stage 1
         * refuses without it (`backend/app/api/workflows.py:712-721`). The NL door works
         * because the model emits the field; the template door works because the seed row
         * carries it; the canvas door had no writer at all.
         *
         * A STRUCTURAL MIRROR OF `setProjectFolder` ABOVE, deliberately — the two
         * `meta`-writing siblings are the same field class with the same failure shape
         * (D-186-15 fixed BUG-260731-03 exactly this way), and a second, different answer
         * to one question is drift.
         *
         * WHY IT SETS `dirty` EXPLICITLY, rather than relying on the subscription below.
         * Identical to `setProjectFolder`'s reason: that subscription arms `dirty` on a
         * change to the **`phases`** reference and on nothing else. `business_requirement`
         * lives on `meta`, so a typed requirement would otherwise be a genuine definition
         * change the leave guard never noticed — a new `definition` memo identity on the
         * page (autosave even fires) while `dirty` stayed false, so no `beforeunload`, no
         * leave prompt, and a toolbar reading clean. Writing and arming in ONE `set()` is
         * what makes that impossible to forget at a second call site.
         *
         * WHY IT IS UNTRACKED. `partialize` (below) narrows the undo stack to `phases`
         * plus the two edit discriminators, and the `meta` field's own docblock states the
         * rule: an undo restores STEPS, never the workflow's identity. Typing a sentence
         * must not flood the undo stack — and nothing is lost, because native field-level
         * undo still works INSIDE the input: the page's `⌘Z` listener yields whenever the
         * event target is an `INPUT`/`TEXTAREA` (`WorkflowBuilderPage.tsx:742-744`).
         *
         * WHY THERE IS NO TRIM AND NO EMPTY-CHECK. Whitespace is written THROUGH. The
         * server owns the emptiness rule — `grounding.py:894` is literally
         * `not (definition.business_requirement or "").strip()` — and a client that
         * trimmed or nulled here would be a second copy of a server predicate, which
         * D-182-06 forbids. No client-side validation rule is added by this action.
         *
         * The `builderPhase !== "drafted"` bail is the shipped guard shape every
         * document-scoped action carries, keeping the write out of the composing beat
         * where `meta` is deliberately empty.
         */
        setBusinessRequirement: (text) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          set({
            meta: {
              ...s.meta,
              business_requirement: text,
              // ONE `set()`: the text and its provenance move together, so no ordering
              // between two writes can exist for a later reader to get wrong.
              business_requirement_seeded_by_ai: false,
            },
            dirty: true,
          })
        },

        /**
         * Phase 193 (AUTH-03, piece 2) — attach or REPLACE the workflow's template.
         *
         * A THIRD STRUCTURAL MIRROR of `setProjectFolder` / `setBusinessRequirement` above,
         * deliberately: same field class (`meta`), same failure shape, same three reasons —
         * it sets `dirty` in the SAME `set()` (the subscription below arms `dirty` on a
         * change to the **`phases`** reference and on nothing else, so a `meta`-only write
         * would otherwise be a real definition change the leave guard never noticed), it is
         * UNTRACKED (`partialize` narrows the undo stack to `phases`, so `⌘Z` restores steps
         * and never the workflow's identity — a template is undone by attaching another),
         * and it bails outside `drafted` where `meta` is deliberately empty.
         *
         * ⚠ IT REPLACES THE TEMPLATE ENTRY AND PRESERVES EVERY OTHER ASSET. `assets[]` is a
         * mixed list — the run engine's `AssetRef` also carries `reference` assets — and the
         * one thing this door mints is the single `kind === "template"` entry that
         * `resolve_template_source` Branch 1 and `WorkflowBuilderPage`'s `nameContext` both
         * read with `.find(…)`. Appending blindly would leave TWO template entries with
         * `.find` silently picking the older one, which is the defect shape where a person
         * attaches a new file and the surface keeps showing the old name.
         *
         * A NON-ARRAY OR ABSENT `assets` IS TREATED AS EMPTY, never spread: the field arrives
         * from server JSONB and the page already reads it defensively for the same reason.
         */
        setTemplateAsset: (asset) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          const prior = Array.isArray(s.meta.assets) ? (s.meta.assets as unknown[]) : []
          const others = prior.filter(
            (a) => !(typeof a === "object" && a !== null && (a as { kind?: unknown }).kind === "template"),
          )
          set({ meta: { ...s.meta, assets: [...others, asset] }, dirty: true })
        },

        /**
         * Phase 197 (AUTH-02 · D-15) — write the workflow's human-readable name.
         *
         * A FOURTH STRUCTURAL MIRROR of `setProjectFolder` / `setBusinessRequirement` /
         * `setTemplateAsset` above, deliberately: same field class (`meta`), same failure
         * shape, same reasons. It is the ONE write path for the name, and the guided
         * authoring surface routes through it rather than minting a second answer.
         *
         * ⚠ IT WRITES EXACTLY ONE `meta` KEY, AND THAT IS THE WHOLE OF D-15.
         * `selectDefinition` spreads `meta` STRAIGHT into the autosave PATCH body, so
         * anything this action puts on `meta` ships — and `WorkflowDefinition` is
         * `extra="forbid"`, so a stray key is a 422 that would destroy the write on the
         * first autosave. The key this action must never touch is the one identity, forks
         * and versioning all key off: it is minted once at generation, 193.2 deferred
         * naming precisely because a rename that moved it is the risk, and leaving it alone
         * removes that risk entirely. The accepted cost, recorded rather than hidden: the
         * name and that key may disagree, and LIB-05 already shipped the machinery for
         * telling same-named workflows apart.
         *
         * WHY IT SETS `dirty` EXPLICITLY, rather than relying on the subscription below.
         * Identical to its three siblings' reason: that subscription arms `dirty` on a
         * change to the **`phases`** reference and on nothing else. The name lives on
         * `meta`, so a rename would otherwise be a genuine definition change the leave
         * guard never noticed — a new `definition` memo identity on the page (autosave even
         * fires) while `dirty` stayed false, so no `beforeunload`, no leave prompt, and a
         * toolbar reading clean. Writing and arming in ONE `set()` is what makes that
         * impossible to forget at a second call site.
         *
         * WHY IT IS UNTRACKED. `partialize` (below) narrows the undo stack to `phases` plus
         * the two edit discriminators, and the `meta` field's own docblock states the rule:
         * an undo restores STEPS, never the workflow's identity. Typing a name must not
         * flood the undo stack — and nothing is lost, because native field-level undo still
         * works INSIDE the input: the page's `⌘Z` listener yields whenever the event target
         * is an `INPUT`/`TEXTAREA` (`WorkflowBuilderPage.tsx:742-744`).
         *
         * ⚠ NO CLIENT-SIDE COMPARISON, NO DIFF, NO DEBOUNCE — AND NO PROVENANCE KEY AT ALL.
         * `setBusinessRequirement` retires a mark because one EXISTS to retire, stamped
         * server-side. This field has none: `name_seeded_by_ai` is a **`PhaseSpec`** field
         * (`backend/app/models/harness.py`) — a STEP-name flag — and `WorkflowDefinition`
         * declares no definition-level equivalent. Adding one is a new additive-optional
         * field plus a server-side stamp plus a demote-on-edit, which is a wave rather than
         * a checkbox; Phase 197 declines it with the reason recorded (the row's own sentence
         * already says a model chose the name, and D-16 binds such a mark to mean *"a model
         * wrote this"* and never *"this is good"*). RE-OPEN TRIGGER: any phase that adds a
         * definition-level provenance field for another reason — the mark comes along free
         * at that point. Until then, comparing the new text against anything to decide
         * provenance would be exactly the second copy of a server predicate D-182-06 forbids
         * by name, and a worse one, because no such server predicate exists to be a copy OF.
         *
         * WHY THERE IS NO TRIMMING AND NO EMPTINESS RULE. Whitespace is written THROUGH and
         * an empty string is written as an empty string. The server owns emptiness
         * (`grounding.py`), and a client that trimmed, nulled or defaulted here would be a
         * second copy of a server predicate. No client-side validation rule is added by this
         * action — the store states what the author typed.
         *
         * The `builderPhase !== "drafted"` bail is the shipped guard shape every
         * document-scoped action carries, keeping the write out of the composing beat where
         * `meta` is deliberately empty.
         */
        setName: (name) => {
          const s = get()
          if (s.builderPhase !== "drafted") return
          set({ meta: { ...s.meta, name }, dirty: true })
        },

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
