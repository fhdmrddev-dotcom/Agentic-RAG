/**
 * Phase 103-04 Task 3 (REQ-5 / WFAUTH-01/02, sketch 018-A + 019-D) —
 * WorkflowBuilderPage: the describe-first authoring surface.
 *
 * The first screen is JUST the describe box — a 3-second read at rest: one
 * `<textarea>`, one hint line, one DISABLED submit button, and NOTHING else (no
 * grounding chip, strictness dial, folder picker, phase node, or left rail —
 * grounding is revealed BY the draft, post-draft, never faked up front).
 *
 * On submit the page transitions through a single state union:
 *   "empty" → "composing" → "drafted"   (ok:true)
 *   "empty" → "composing" → "error"     (ok:false OR a thrown error)
 *
 * SINGLE STATE TRANSITION (the falsifiable bar): on `ok:true` the full draft
 * definition AND the "drafted" state are committed in ONE React update, so the
 * whole graph renders in one DOM batch — no per-node enter animation, no timed
 * reveal, no incremental array push. The draft is built whole and rendered once
 * (one-shot emission is proven — spike-097).
 *
 * On `ok:false` (or a thrown/network error) the page renders an honest
 * "could not generate" surface and renders NO phase nodes — never a partial or
 * broken draft (the G-6 silent-invalid-draft guard at the UI seam, T-103-04-01).
 *
 * Refinement is FORM-LED on a READ-ONLY vertical spine (no drag-canvas, no
 * router): the read-only `PhaseSpineGraph` + the 400px push `PhaseFormPanel`,
 * wired exactly like the app's existing ChatLayout push grid
 * (`gridTemplateColumns: minmax(0,1fr) <44px|400px>`).
 *
 * ── Phase 183-07 (CANVAS-01, D-183-01 … D-183-05) — the Canvas door ─────────────
 *
 * THE CANVAS IS AN IN-BUILDER VIEW TOGGLE, NOT A PAGE (D-183-01). The app has no
 * router — navigation is a `useState<ActiveView>` switch — so a standalone canvas
 * "page" would be net-new state plumbing for no user benefit. A `[≣ Spine]
 * [⬡ Canvas]` strip sits on this page's existing graph column and swaps ONE child
 * of the unchanged push grid. Deliberately NO `NAV_ITEMS` entry is tagged
 * `visual_workflow_canvas`: D-183-01 formally released the promise Phase 181
 * deferred, and `revertByteIdentical.test.tsx`'s scope-freeze assertion depends on
 * that entry's continued absence.
 *
 * SPINE IS THE DEFAULT AND THE PREFERENCE IS SESSION-ONLY (D-183-02). The Builder
 * opens exactly as it does today; the toggle cold-starts on Spine on every mount and
 * is never written to browser storage, to a settings row, or to any server. Phase 184
 * owns the question of flipping the default.
 *
 * FLAG OFF ⇒ THE STRIP VANISHES (D-183-03). The gate is three-part and every part is
 * load-bearing: the OPTIONAL accessor (a null context reads exactly like the empty
 * map — fail-closed), a STRICT `true` comparison (an absent key hides, the
 * `visibleNavItems` VANISH contract), and `!loading` (so the strip cannot flash in
 * ~200 ms after load and shift the column). With the flag off this file renders the
 * graph column exactly as it shipped — same element, no wrapper, no reserved space —
 * for EVERYONE including operators (D-181-01).
 *
 * THE CANVAS IS CODE-SPLIT. `@xyflow/react` is ~59 KB gzip and the flag cold-defaults
 * to off for every user, so a static import would charge today's shipped users for a
 * subtree that never renders. The dynamic import also makes "the canvas subtree stays
 * out of the render path" a BUILD-level fact rather than a render-branch claim. (The
 * stylesheet still loads eagerly from `index.css` — the documented plan 183-01 trade.)
 *
 * ONE SELECTION CONTRACT, TWO VIEWS (D-183-05). Both views receive the identical
 * `onSelectNode` callback, so the shipped 400px `PhaseFormPanel` opens on the clicked
 * phase with zero net-new panel work and the toggle-off-on-reclick semantics stay
 * here, on the page, rather than being re-implemented inside either graph.
 *
 * NOT BUILT HERE (D-183-04): the published-workflow canvas door. Viewing a PUBLISHED
 * definition's canvas would require Tweak, whose draft-create call is an INSERT — so
 * merely LOOKING would mint a v(N+1) row. Opening the Canvas view fires no request
 * and writes nothing; no save path below is touched.
 *
 * (Both fences above are stated without naming the draft-create identifier or the
 * landmark element, because this file's own suite greps the source for them and a
 * guard that only passes by making a comment lie is a broken guard — the fifth
 * instance of that trap in this phase, logged as D-ITEM-183-02.)
 *
 * ── Phase 184-04 (D-184-01 / D-184-05) — where the definition lives now ────────
 *
 * THIS PAGE NO LONGER OWNS THE WORKING DEFINITION. It lived here, in a
 * `useState` union, from Phase 103 until Wave 0 of Phase 184. It now lives in ONE
 * per-mount `zustand` + `zundo` temporal store (`builderStore.ts`), created once
 * per Builder mount and carried to the subtree by `BuilderStoreProvider`. The
 * reason is undo: `PhaseFormPanel` is shared by BOTH views, so a config edit made
 * from the Spine flows through the same `onChange`, and a canvas-scoped store
 * would leave those edits outside the history. The undo/redo AFFORDANCES stay
 * canvas-only and flag-gated; the HISTORY is complete.
 *
 * WHAT DELIBERATELY DID NOT MOVE (D-184-05): persistence. `draftIdRef`,
 * `creatingRef`, `onPersist` and `onSaveDraft` are unchanged and stay on this
 * page, because Phase 186 rewrites exactly that seam for autosave — extracting it
 * now would be churn against a seam about to move. Selection (`selectedSlug`, the
 * Escape release) also stays here: it is the D-183-05 one-selection contract, not
 * definition state. This was a STATE-HOME refactor, gated on every shipped
 * assertion passing unmodified (D-184-08).
 *
 * ── Phase 184-11 (CANVAS-02 / CANVAS-03 · D-184-15 / D-184-16) — the session ────
 *
 * THIS PAGE IS THE COMPOSITION POINT, AND IT IS THE ONLY ONE. The live validation
 * loop, the governance rails, the cosmetic nudge and the verdict marks all arrive
 * here as hooks and leave as PROPS: `WorkflowCanvas` fetches nothing, and
 * `PhaseFormPanel` derives nothing. That is what keeps VALID-03 ("every verdict
 * comes from the server") and R11 ("no frontend tool whitelist") structural rather
 * than merely intended.
 *
 * NOTHING VALIDATES BEFORE THE AUTHOR'S FIRST EDIT (D-184-15). `hasEdited` starts
 * false and is flipped by the first real EDIT — not by mount, and not by a document
 * transition such as generate/open, which replace the whole definition without the
 * author having changed anything. A zero-step draft is therefore never greeted with
 * `ok:false` + a full problems tray; its Publish carries a plain INVITATION instead,
 * which is not a claimed verdict and therefore not client-side validation.
 *
 * THE THREE SESSION-EDGE DEBTS (D-184-16) ALL LAND HERE:
 *  1. The unsaved-work leave guard — a `canLeave()` callback registered with the
 *     host (there is no router; the breadcrumb lives in `WorkflowsPage`) plus a
 *     `beforeunload` listener mounted ONLY while the draft is dirty.
 *  2. WR-09-01 / WR-09-02 — every dismissal path converges on `clearSelection`,
 *     which COMMITS (the coalescing config run is flushed into the undo stack) and
 *     WRITES NOTHING. A dismissal must not PATCH a version.
 *  3. The 409 — a published row's conflict gets its own honest sentence instead of
 *     the generic "Couldn't save".
 *
 * WHAT IS STILL NOT AUTOSAVE. `onPersist` / `onSaveDraft` below are untouched in
 * their create-once-then-PATCH shape: a session issues exactly ONE create and then
 * PATCHes. Phase 186 owns autosave and this plan deliberately does not pre-empt it.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStore } from "zustand"
import { generateWorkflow, createWorkflowDraft, updateWorkflowDraft, listFolders, listSkills } from "@/lib/api"
import { PhaseSpineGraph } from "@/components/workflows/PhaseSpineGraph"
import {
  groundingFor,
  nodeTitle,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import {
  PhaseFormPanel,
  type PhaseConfigPatch,
  type IdNameMap,
  type PhaseFormRails,
  type PhaseGateRow,
} from "@/components/workflows/PhaseFormPanel"
import {
  createBuilderStore,
  selectDefinition,
  SAVED_STILL_A_DRAFT,
} from "@/components/workflows/builderStore"
import { BuilderStoreProvider } from "@/components/workflows/BuilderStoreProvider"
import { useEffectiveFeaturesOptional } from "@/providers/EffectiveFeaturesProvider"
import { cn } from "@/lib/utils"
// ── Phase 184-11: the composition seams. Every one of these is a HOOK or a PURE
//    module; none of them is reachable from the canvas or the panel themselves. ──
import { useLiveValidation } from "@/hooks/useLiveValidation"
import { useGroundingBundle } from "@/hooks/useGroundingBundle"
import { DEGRADED_SENTENCE, groupVerdicts } from "@/components/workflows/verdictModel"
import { readNudges, writeNudge } from "@/components/workflows/canvasNudge"
import { canRemovePhase, renumber, type PhaseTypeId } from "@/components/workflows/definitionOps"
import type { CanvasNode } from "@/components/workflows/canvasModel"
// TYPE-ONLY, and that is load-bearing: `WorkflowCanvas` is `React.lazy` so the chunk is
// never requested with the flag off, and a value import of anything from that module
// here would pull it into the main bundle and undo D-183-03's whole point.
import type { CanvasNotice } from "@/components/workflows/WorkflowCanvas"
import type { WorkflowDefinitionJSON } from "@/lib/api"

/** The read-only canvas, code-split behind the toggle (see the docblock). The module
 *  also exports a `default`, so the `.then(...)` shim below is belt-and-braces — it
 *  mirrors the app's ONE shipped code-split (`KnowledgeHealthPage.tsx:32`) so both
 *  lazy boundaries read the same way. */
const WorkflowCanvas = lazy(() => import("@/components/workflows/WorkflowCanvas").then((m) => ({ default: m.WorkflowCanvas })))

/**
 * The locked save wording (184-CONTEXT `<specifics>`): the surface says the draft is
 * SAVED and, in the same breath, that it is still a draft. No word in it may imply
 * published — publishing is a separate act behind the gauntlet, and a save that reads
 * like a release is the single most expensive lie this header can tell.
 *
 * ⚠ 184-13 MOVED THE DECLARATION, not the name or the value. Two surfaces now say it —
 * this header and the canvas toolbar — and the toolbar lives on the code-split canvas
 * chunk, so it cannot reach back into this page module to read a string without dragging
 * the whole page in with it. The literal therefore lives beside the `SaveState` type in
 * `builderStore.ts`, and this line re-exports it so every existing caller (and every
 * existing grep) still finds it here.
 */
export { SAVED_STILL_A_DRAFT }

/**
 * The 409 sentence (D-184-16 debt 3). `updateWorkflowDraft` already throws a typed
 * `WorkflowConflictError` when the row is published/frozen; until this plan the page
 * flattened it into the generic error. It is business-plain and it names the WAY OUT
 * (Tweak), because "couldn't save" on a published row sends a person back to press the
 * same button again.
 */
export const PUBLISHED_CONFLICT_MESSAGE =
  "This version is published and can't be edited — use Tweak to start a new draft"

/** The generic failure line, unchanged: a 404 / network failure is still never
 *  swallowed as a success and still reads as itself. */
export const GENERIC_SAVE_ERROR = "Couldn't save"

/**
 * The empty draft's publish reason (D-184-15). An INVITATION, not a claimed verdict:
 * the client is not validating anything here, it is saying what to do next on a
 * workflow that has no steps yet. D-182-06 stays intact precisely because no severity,
 * no code and no lint rule is being computed — a zero-length phases array is not a
 * finding, and the moment a step exists the server owns every verdict.
 */
export const EMPTY_DRAFT_INVITATION = "Add a step to get started"

/** The unsaved-work prompt (D-184-16 debt 1). Named, because a session can now be five
 *  structural edits deep with no autosave until Phase 186. */
export const UNSAVED_LEAVE_PROMPT =
  "This draft has unsaved changes. Leave without saving?"

/**
 * R1 / D-184-12 — HOW MANY STEPS ACTUALLY MOVED, said in words.
 *
 * The number is COUNTED, never assumed. "Everything downstream" is the intuitive answer
 * and it is wrong at both ends: deleting the last step moves nothing at all, and a
 * definition whose `phase_index` values arrived non-contiguous (the shipped `indexGap`
 * shape) can have a step move without being downstream of the edit. So the caller
 * compares the before and after render orders index by index and hands the count here.
 *
 * The zero case gets its own sentence rather than "0 steps renumbered": the message
 * exists to tell an author what the edit did to the rest of their flow, and "0 steps
 * renumbered" makes a person stop and parse a number to learn that nothing happened.
 */
function renumberedPhrase(moved: number): string {
  if (moved === 0) return "nothing else moved"
  return `${moved} step${moved === 1 ? "" : "s"} renumbered`
}

/** How many phases present in BOTH orders changed `phase_index`. Slugs that exist on
 *  only one side are the edit itself, not something the edit moved. */
function countMoved(
  before: readonly PhaseSpecJSON[],
  after: readonly PhaseSpecJSON[],
): number {
  const afterIndex = new Map(after.map((p) => [p.slug, p.phase_index]))
  let moved = 0
  for (const phase of before) {
    const now = afterIndex.get(phase.slug)
    if (now !== undefined && now !== phase.phase_index) moved += 1
  }
  return moved
}

/**
 * The gates rail, DERIVED exactly as the shipped `groundingFor()` derives grounding
 * today — `citation_policy` plus the presence of a `citations_required` validator, and
 * nothing else. **Phase 184 invents no authored grounding field**; Phase 185 replaces
 * this derivation and plugs into the same `rails.gates` array (D-183-07 / the panel's
 * own rails docblock).
 *
 * Every row is LOCKED, and that is the honest reading rather than a shortcut: both
 * causes are structural from this panel's point of view. A `strict` / `flag` policy came
 * with the Sourcing-strictness dial rendered a few rows above — change it and the gate
 * goes, which is exactly what the rail's own footnote promises — and a `citations_required`
 * validator is a `validators` entry, which this form has no write seam for at all
 * (`onChange` patches `config`). Offering a Remove button that could not remove anything
 * would be the "a removable gate with no way to remove it" lie the row union exists to
 * make un-representable.
 */
function gatesFor(phase: PhaseSpecJSON | null): PhaseGateRow[] {
  if (phase === null) return []
  const grounding = groundingFor(phase)
  return grounding.mode === "open" ? [] : [{ label: grounding.words, locked: true }]
}

/** The Builder's working definition shape (a refinement of the opaque
 *  `WorkflowDefinitionJSON` the api layer returns). */
export interface BuilderDefinition {
  slug?: string
  version?: number
  status?: string
  business_requirement?: string
  project_folder_id?: string | null
  phases: PhaseSpecJSON[]
  [k: string]: unknown
}

/** The OPEN/TWEAK seam payload — an existing definition + its row id (every save
 *  PATCHes that row). Exported so WorkflowsPage builds + casts it at one place. */
export interface BuilderInitial {
  definition: BuilderDefinition
  draftId: string
}

export interface WorkflowBuilderPageProps {
  /** Optional Plan-05 publish-gauntlet seam — the page composes it when present
   *  (the gauntlet owns the publish-disabled-on-empty-golden_input rule). Left as
   *  a typed prop so Plan 05 can land independently without an import-before-exists
   *  break.
   *
   *  Phase 124-03 Task 2 (WUX-01, D-06): `def` is the WORKING definition forwarded
   *  to the gauntlet so its prepended pub-scale soul block reads the same authored
   *  purpose / tier / spine / needs / output. `BuilderDefinition` already carries
   *  the soul-readable fields (business_requirement / project_folder_id / phases),
   *  so this seam is additive — the describe/draft/publish flow is unchanged; the
   *  call site (WorkflowsPage) just passes the supplied `def` through as `definition`.
   *
   *  Phase 184-11 (R12): a THIRD argument carries the publish-blocking reason, or `null`
   *  when publish is not blocked. Optional and additive — a two-parameter implementation
   *  is still assignable and still behaves exactly as it did, which is what keeps the
   *  flag-off surface unchanged (this page passes `null` whenever the canvas flag is off).
   *  It rides the EXISTING seam on purpose: 141-B's operator correction is that publish
   *  stays in the header it already has, so the mount does not move and no band is added. */
  renderPublish?: (
    def: BuilderDefinition,
    draftId: string | null,
    blockedReason?: string | null,
  ) => React.ReactNode
  /** Phase 103-ux OPEN/TWEAK: when present, the Builder starts DIRECTLY in the
   *  "drafted" editing view on this existing definition — it SKIPS the
   *  describe/composing screen entirely. `draftId` seeds both state + the
   *  draftIdRef so every edit PATCHes the SAME row (never a duplicate create):
   *   - Open a draft → the draft's own id (edit-in-place).
   *   - Tweak a published workflow → the freshly-forked v(N+1) draft id (the
   *     frozen published row is never touched).
   *  Absent → the existing describe-first FRESH build, byte-identical. */
  initial?: BuilderInitial
  /** Phase 124 CR-01 fix: seed the describe textarea from an upstream "Describe &
   *  run" door so the loose-path text survives the hand-off into the Builder (it was
   *  otherwise silently dropped). Only meaningful for a FRESH build (no `initial`) —
   *  the drafted editing view ignores it. */
  initialDescribe?: string
  /** Phase 124 CR-01 fix: when true (the loose door's "Draft the workflow" CTA), run
   *  the EXISTING generate→draft flow ONCE on mount using the seeded `initialDescribe`,
   *  so the fast path actually drafts instead of dead-ending on an empty screen. */
  autoDraft?: boolean
  /**
   * Phase 184-11 (D-184-16 debt 1) — the unsaved-work leave guard's registration seam.
   *
   * THERE IS NO ROUTER. Navigation in this app is a `useState<ActiveView>` switch, so
   * there is no route-change hook and no router blocker to hang a guard off. The
   * `← Workflows` breadcrumb lives in `WorkflowsPage`, and the dirty state lives in this
   * page's store — so the Builder hands the host a predicate and the host consults it
   * before it switches view. `true` means "leaving is fine"; `false` means the user said
   * no and the host must stay put.
   *
   * OPTIONAL, and an ABSENT registration must leave the host behaving exactly as it does
   * today. Every other mount of this page (the tests, the door shell's fresh-build path
   * before a Builder exists) supplies nothing and is unaffected.
   */
  registerCanLeave?: (canLeave: (() => boolean) | null) => void
}

export function WorkflowBuilderPage({
  renderPublish,
  initial,
  initialDescribe,
  autoDraft,
  registerCanLeave,
}: WorkflowBuilderPageProps) {
  const [describe, setDescribe] = useState(initialDescribe ?? "")
  // Phase 184-04 (D-184-01): the definition's home. Created LAZILY so the factory
  // runs exactly once per mount, and never at module scope — a singleton would carry
  // one workflow's undo history into the next workflow opened in the same tab.
  // OPEN/TWEAK: when `initial` is provided the store boots straight into the drafted
  // editing view on the loaded definition (the describe/composing screen is skipped);
  // a fresh build (no `initial`) starts "empty" exactly as before.
  const [store] = useState(() => createBuilderStore(initial ? initial.definition : null))
  // Read through SELECTORS, never `getState()` in a rendered value — the shipped
  // `usePanelReconcile.ts:58-60` discipline. Side-effect reads inside callbacks may
  // use `getState()`, because those are not rendered values.
  const builderPhase = useStore(store, (s) => s.builderPhase)
  const phases = useStore(store, (s) => s.phases)
  const meta = useStore(store, (s) => s.meta)
  const errorMessage = useStore(store, (s) => s.errorMessage)
  const errorDetail = useStore(store, (s) => s.errorDetail)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  // Phase 183-07 (D-183-02): which graph the column shows. SESSION state only — it
  // cold-starts on "spine" on every mount and is persisted nowhere.
  const [graphView, setGraphView] = useState<"spine" | "canvas">("spine")
  // Phase 103-ux: the project (knowledge base) the generated workflow binds to.
  // Chosen at the describe step (ONE calm dropdown), passed to generate, and shown
  // by name in the draft header afterwards. When opening an existing definition,
  // seed it from that definition's own binding so the header shows the bound KB.
  const [projectFolderId, setProjectFolderId] = useState<string>(
    typeof initial?.definition.project_folder_id === "string" ? initial.definition.project_folder_id : "",
  )
  // Phase 103-ux: id→name maps so the form panel renders folder + skill NAMES (never
  // UUIDs). Fetched once on mount; failures degrade to showing the raw id.
  const [folderNames, setFolderNames] = useState<IdNameMap>({})
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; name: string }>>([])
  const [skillNames, setSkillNames] = useState<IdNameMap>({})
  // The persisted draft id (null until the first save for a fresh build; pre-seeded
  // from `initial.draftId` for Open/Tweak). A generated draft is persisted via
  // createWorkflowDraft on the FIRST edit/save, then PATCHed.
  const [draftId, setDraftId] = useState<string | null>(initial?.draftId ?? null)
  // Synchronous mirrors of the persist state. setDraftId is async, so several
  // onPersist calls can fire while draftId is still null and each would re-run
  // createWorkflowDraft → a UniqueViolation storm on (slug, version). The refs
  // collapse the first save to EXACTLY ONE create (UAT-103 save-loop fix). For
  // Open/Tweak the ref is pre-seeded → every save PATCHes the existing row.
  const draftIdRef = useRef<string | null>(initial?.draftId ?? null)
  const creatingRef = useRef(false)
  // Phase 103-ux SAVE button: transient feedback for the explicit "Save draft"
  // affordance ("idle" → "saving" → "saved" | "error"). Belt-and-suspenders over
  // the implicit on-blur autosave (onPersist) — the user gets a visible "Saved ✓".
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  // Phase 184-11 (D-184-16 debt 3): WHICH failure the error state is reporting. `null`
  // keeps today's generic line; a 409 replaces it with the published-row sentence.
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canDraft = describe.trim().length > 0 && builderPhase !== "composing"
  const panelOpen = selectedSlug !== null

  // Phase 183-07 (D-183-03) — the three-part fail-closed gate. The OPTIONAL accessor
  // (a null context is read exactly like `{}`), `!loading` (no flash-in, no reserved
  // space), and a strict comparison (an absent key hides).
  const featuresCtx = useEffectiveFeaturesOptional()
  const canvasEnabled =
    featuresCtx !== null &&
    !featuresCtx.loading &&
    featuresCtx.features.visual_workflow_canvas === true
  // The flag out-ranks stale session state: if the map is tightened mid-session while
  // the user is on Canvas, the column falls back to the Spine rather than stranding
  // them on a surface that just vanished.
  const activeGraphView = canvasEnabled ? graphView : "spine"

  // D-183-05 — ONE selection contract, shared by BOTH views, owned by the page. Click
  // a node to anchor the 400px form panel; click the same node again to close it.
  const handleSelectNode = useCallback((slug: string) => {
    setSelectedSlug((cur) => (cur === slug ? null : slug))
  }, [])

  // The view-agnostic DISMISSAL half of that same contract: `handleSelectNode`
  // anchors the panel, `clearSelection` releases it. Both live on the page because
  // both views share ONE panel — a canvas-only close would leave the shipped Spine
  // surface, where this defect was actually reported, still unable to be left.
  //
  // ── WR-09-01 / WR-09-02 (D-184-16 debt 2) — ALL THREE dismissal paths end HERE ──
  //
  // The ✕ (`PhaseFormPanel`'s header button), Escape (the gated window listener below)
  // and a click on the empty canvas pane (`WorkflowCanvas`'s `onPaneClick`) all call
  // this one callback, so the three cannot drift apart. What a dismissal does is now
  // stated in one place, and it is exactly two things:
  //
  //  1. COMMIT. `flushHistory()` ends the coalescing config run immediately, so the
  //     sentence the author just typed is ONE undo entry that exists at dismissal time
  //     rather than one that lands up to `CONFIG_COALESCE_MS` later. The VALUE itself is
  //     already in the definition — every panel field is CONTROLLED and its `onChange`
  //     reaches `store.patchConfig` on the keystroke, never on the blur — so what a
  //     dismissal used to drop was the history entry, not the text.
  //  2. RELEASE the selection. That is all.
  //
  // WHAT IT DELIBERATELY DOES NOT DO IS WRITE. The 183 review's recommended fix was to
  // BLUR the focused field before unmount so the three paths converged on the ✕'s
  // incidental PATCH. Phase 184 converges them the other way, because this phase has an
  // explicit-save contract (R6) and, from this plan on, a dirty-state leave guard plus a
  // dirty indicator that close the loss window that made a silent PATCH look attractive.
  // A dismissal that mints a version is exactly the surprise a no-autosave phase exists
  // to prevent — so the panel's ✕ also suppresses the focus transfer that used to cause
  // one (see its `onMouseDown`), and the assertion "a dismissal must not PATCH a version"
  // is now true on all three paths in a real browser, not only under a test driver that
  // never moves focus.
  const clearSelection = useCallback(() => {
    store.getState().flushHistory()
    setSelectedSlug(null)
  }, [store])

  // Escape releases the panel, in BOTH views. GATED on `panelOpen`: no listener
  // exists while the panel is closed, so this costs nothing at rest and cannot
  // accumulate across renders. One accepted interaction, recorded rather than
  // engineered around: if a modal sits above the Builder, Escape dismisses the modal
  // AND releases the selection. That is harmless — deselection is non-destructive and
  // persistence happens on field blur, not on selection — and it is preferable to a
  // fragile is-a-modal-open probe.
  useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [panelOpen, clearSelection])

  // The current working definition (drafted state only). `selectDefinition` is the ONE
  // place the store's two halves recombine into a definition — fed here from the two
  // SELECTOR values, never from `getState()`, because this one IS a rendered value.
  const definition = useMemo<BuilderDefinition | null>(
    () => (builderPhase === "drafted" ? selectDefinition({ meta, phases }) : null),
    [builderPhase, meta, phases],
  )

  const selectedPhase = useMemo<PhaseSpecJSON | null>(() => {
    if (builderPhase !== "drafted" || selectedSlug === null) return null
    return phases.find((p) => p.slug === selectedSlug) ?? null
  }, [builderPhase, phases, selectedSlug])

  // ── Phase 184-11: the live loop, the rails, the marks and the nudge ─────────────

  /**
   * D-184-15 — has the AUTHOR edited in this session? False until the first real edit,
   * and false FOREVER on a draft nobody touches, which is what keeps `/validate` silent
   * on mount.
   *
   * It is driven by the STORE rather than by the page's own callbacks on purpose: a
   * structural edit can originate at the canvas, at the panel, or (in 184-12) at a `＋`
   * that dispatches straight to a store action, and a flag wired per call site would
   * miss whichever one is added last. The subscription reads the ONE thing every edit
   * has in common — a new `phases` reference — and excludes DOCUMENT transitions, which
   * always replace `meta` (a fresh object) and usually `builderPhase` too. Generating or
   * opening a workflow is not something the author edited, so it must not start the loop.
   *
   * Deliberately NOT reused: the store's `dirty`, which `markSaved()` clears — a save
   * would then switch validation back off.
   */
  const [hasEdited, setHasEdited] = useState(false)
  useEffect(
    () =>
      store.subscribe((state, prev) => {
        if (state.phases === prev.phases) return
        if (state.builderPhase !== prev.builderPhase || state.meta !== prev.meta) return
        setHasEdited(true)
      }),
    [store],
  )

  /**
   * The loop itself. `definition` is a `useMemo` over the store's two halves, so its
   * identity changes once per EDIT and not once per render — which is the caller
   * contract `useLiveValidation`'s docblock states, and the difference between a
   * debounced request per edit and one per keystroke of React re-render.
   */
  const validation = useLiveValidation(definition as WorkflowDefinitionJSON | null, hasEdited)

  /**
   * Mirror the loop's answer into the store's UNTRACKED half, so the marks (canvas) and
   * the tray (184-13) read ONE source instead of two subscriptions that can disagree.
   * `partialize` keeps all three keys out of the undo stack, so an arriving response can
   * never push a history entry and `⌘Z` can never undo a server verdict (VALID-03).
   */
  useEffect(() => {
    const actions = store.getState()
    switch (validation.kind) {
      case "idle":
        actions.setChecking(false)
        break
      case "checking":
        actions.setChecking(true)
        break
      case "verdicts":
        actions.setVerdicts(validation.verdicts)
        actions.setChecking(validation.checking)
        actions.setDegraded(null)
        break
      case "degraded":
        // Held stale, dimmed — never cleared, or every mark flickers on every keystroke.
        actions.setVerdicts(validation.verdicts)
        actions.setChecking(validation.checking)
        actions.setDegraded({ kind: validation.cause === "unreadable" ? "422" : "network" })
        break
    }
  }, [validation, store])

  const verdicts = useStore(store, (s) => s.verdicts)
  const verdictGroups = useMemo(() => groupVerdicts(verdicts), [verdicts])
  /** The per-node mark, handed to the canvas as DATA. The canvas fetches nothing and
   *  derives no severity — `verdictModel` groups and counts, and classifies nothing. */
  const marks = useMemo(() => (slug: string) => verdictGroups.markFor(slug), [verdictGroups])

  /**
   * The CANVAS-04 palette. Fetched once, when the canvas is enabled, and read ONLY here —
   * the panel is handed the answer.
   *
   * Anything that is not a complete `ready` read resolves to the literal `"degraded"`,
   * which is the fail-closed side of the only choice available. An empty array would say
   * "this workspace offers no tools" (a claim we cannot make while the read is in flight
   * or has failed), and omitting the rail entirely would put the shipped free-text box
   * back on screen — and a box a user can type any string into is not a whitelist, which
   * is precisely what R11 forbids.
   */
  const bundle = useGroundingBundle(canvasEnabled)
  const toolOptions: string[] | "degraded" = bundle.kind === "ready" ? bundle.tools : "degraded"

  /** The three governance rails for the SELECTED step. Every value is derived or
   *  server-sourced HERE; the panel computes none of it. */
  const rails = useMemo<PhaseFormRails>(() => {
    const order = renumber(phases).map((p) => p.slug)
    const at = selectedSlug === null ? -1 : order.indexOf(selectedSlug)
    return {
      order: { index: at + 1, total: order.length },
      toolOptions,
      gates: gatesFor(selectedPhase),
    }
  }, [phases, selectedSlug, selectedPhase, toolOptions])

  /**
   * The cosmetic vertical nudge. `canvasNudge.ts` owns every read and every write —
   * this page names no browser-storage API at all, which its own shipped source guard
   * enforces. Re-read through a version counter rather than an effect, so a write and
   * the render that shows it stay in one pass and no `setState`-in-effect cascade is
   * introduced.
   */
  const [nudgeVersion, setNudgeVersion] = useState(0)
  // `nudgeVersion` is an INVALIDATION KEY, not a value this read consumes: the write goes
  // to `canvasNudge.ts` (the one storage home) and the counter is how the page asks for a
  // re-read. The rule cannot see that a bumped counter means the storage behind
  // `readNudges` changed; keeping the map in page state instead would put a SECOND copy of
  // it here, which is the thing the module boundary exists to prevent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nudges = useMemo(() => readNudges(draftId), [draftId, nudgeVersion])
  const onNudge = useCallback(
    (slug: string, dy: number) => {
      // `dy` is the RESULTING offset, not this drag's delta — the canvas composes it, so
      // this handler stays a plain write (`WorkflowCanvasProps.onNudge`).
      writeNudge(draftId, slug, dy)
      setNudgeVersion((v) => v + 1)
    },
    [draftId],
  )

  /** A canvas-originated reorder. Both gesture paths (drag along the lane, `⌥←`/`⌥→`)
   *  arrive here and end in the ONE store op — no second reorder rule exists. */
  const onCommitNodes = useCallback(
    (nodes: readonly CanvasNode[]) => {
      store.getState().commitCanvasNodes(nodes)
    },
    [store],
  )

  // ── Phase 184-12: growing the flow, and the two refusals ───────────────────────

  /**
   * What the canvas says about the last structural act. Replaced by the next act, and
   * cleared by an Undo — a message about an edit that has been taken back is a message
   * that has started lying.
   */
  const [canvasNotice, setCanvasNotice] = useState<CanvasNotice | null>(null)

  /**
   * D-184-11 — a `＋` on the line, a type chosen there, a step that exists immediately.
   *
   * The new slug is READ BACK from the store rather than re-derived here. `slugForType`
   * is pure, so calling it a second time on the same phases would give the same answer
   * today — and would be a second copy of the slug rule, which is exactly how the two
   * silently disagree the first time either side grows a condition. The store owns slug
   * generation; this reads which phase appeared.
   *
   * Then three things, in this order and for stated reasons:
   *  1. the phase is SELECTED and the panel opens on it — the type is chosen at add time
   *     because `PhaseFormPanel` conditions on `phase.config.phase_type` and offers no
   *     control that writes it, so the very next thing an author needs is the inspector;
   *  2. the surface says how many steps moved, in the same vocabulary the delete message
   *     uses, because an insert is never cosmetic: the projection draws its sequential
   *     edge by a `phase_index + 1` LOOKUP, so a step landing in the middle renumbers
   *     every step after it;
   *  3. nothing is written to the server. R6's explicit-save contract is untouched.
   */
  const onInsertAt = useCallback(
    (index: number, type: PhaseTypeId) => {
      const actions = store.getState()
      const before = renumber(actions.phases)
      const known = new Set(before.map((p) => p.slug))

      actions.insertPhaseOfTypeAt(index, type)

      const after = renumber(store.getState().phases)
      const added = after.find((p) => !known.has(p.slug))
      // The store declines an insert outside the drafted view; saying nothing happened
      // is honest, and inventing a message about a phase that was not created is not.
      if (added === undefined) return

      setSelectedSlug(added.slug)
      setCanvasNotice({
        kind: "action",
        lead: "Added",
        subject: nodeTitle(added),
        detail: renumberedPhrase(countMoved(before, after)),
      })
    },
    [store],
  )

  /**
   * D-184-12 — the `✕`. IMMEDIATE, with Undo, and no confirm dialog anywhere.
   *
   * R10a IS CHECKED FIRST, AND ITS ANSWER IS A REFUSAL RATHER THAN A CONFIRM. A step
   * another step's `on_failure` still points at cannot simply go: the surviving
   * `skip_to_phase` would name a slug no phase provides, which is the backend's
   * `unsatisfiable_skip`. So the edit is DECLINED with `canRemovePhase`'s own sentence
   * — no "delete anyway", because offering one would trade a broken definition for a
   * click. The predicate is a SHAPE rule read off the phases in hand; nothing here asks
   * the server anything, and a client refusal must never be mistakable for a verdict.
   *
   * WHEN IT IS ALLOWED, IT HAPPENS AT ONCE. `removePhaseBySlug` removes and renumbers,
   * so the spine re-stitches to `[0..n-1]` in the same tick, and the message carries the
   * inline Undo that makes that affordable — one temporal step back restores the exact
   * previous `phases` array and writes nothing (D-184-03).
   *
   * SELECTION MOVES TO THE FOLLOWING STEP, or to the preceding one when the deleted step
   * was last, so the author's place in the flow survives the edit. Deleting the only
   * step clears the selection and the canvas falls to its named invitation.
   */
  const onRequestRemove = useCallback(
    (slug: string) => {
      const actions = store.getState()
      const before = renumber(actions.phases)
      const at = before.findIndex((p) => p.slug === slug)
      if (at === -1) return

      const outcome = canRemovePhase(before, slug)
      if (!outcome.ok) {
        setCanvasNotice({ kind: "refusal", text: outcome.reason })
        return
      }

      const subject = nodeTitle(before[at])
      actions.removePhaseBySlug(slug)
      const after = renumber(store.getState().phases)

      setSelectedSlug(before[at + 1]?.slug ?? before[at - 1]?.slug ?? null)
      setCanvasNotice({
        kind: "action",
        lead: "Removed",
        subject,
        detail: renumberedPhrase(countMoved(before, after)),
        onUndo: () => {
          // The temporal store is reached through `getState()` on purpose: this is a
          // side-effect call inside a callback, not a rendered value.
          store.temporal.getState().undo()
          setCanvasNotice(null)
          setSelectedSlug(slug)
        },
      })
    },
    [store],
  )

  /**
   * R12 / D-184-15 — WHY publish is blocked, in the author's words, or `null` when it is
   * not blocked at all.
   *
   * GATED ON THE FLAG, and that is load-bearing (D-14 / D-181-01): with
   * `visual_workflow_canvas` off the publish trigger must be the control that shipped,
   * for everyone including operators. A flag-off empty draft therefore still gets today's
   * enabled `◆ Publish…`, exactly as before this plan.
   *
   * The reason is chosen honestly, and only one of the four branches is authored here:
   *  - EMPTY DRAFT → the INVITATION. Not a verdict, not a lint code, not a severity —
   *    just what to do next. The server is never asked about a workflow with no steps.
   *  - DEGRADED → the loop's own sentence for that cause. A check that did NOT RUN must
   *    never unblock a publish (D-184-14, fail-closed).
   *  - `ok: false` → the FIRST verdict's `message`, VERBATIM, with `error` findings
   *    ordered ahead of `incomplete` ones so the thing that needs attention now is the
   *    thing that gets named. The message is never rewritten and never mapped.
   *  - anything else (`ok: true`, or nothing asked yet) → `null`, and publish behaves
   *    exactly as it does today.
   */
  const blockedReason = useMemo<string | null>(() => {
    if (!canvasEnabled || builderPhase !== "drafted") return null
    if (phases.length === 0) return EMPTY_DRAFT_INVITATION
    if (validation.kind === "degraded") return DEGRADED_SENTENCE[validation.cause]
    if (validation.kind !== "verdicts" || validation.ok) return null
    const first =
      validation.verdicts.find((v) => v.severity !== "incomplete") ?? validation.verdicts[0]
    return first?.message ?? null
  }, [canvasEnabled, builderPhase, phases, validation])

  // Phase 103-ux: fetch folders + skills ONCE on mount → id→name maps for the form
  // panel + the project picker. Best-effort; a failure leaves the maps empty (the
  // panel then falls back to showing the raw id, never a crash).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const folders = await listFolders()
        if (cancelled) return
        const map: IdNameMap = {}
        for (const f of folders) map[f.id] = f.name
        setFolderNames(map)
        setFolderOptions(folders.map((f) => ({ id: f.id, name: f.name })))
      } catch {
        /* non-fatal — the panel falls back to the raw id */
      }
      try {
        const skills = await listSkills()
        if (cancelled) return
        const map: IdNameMap = {}
        for (const s of skills) map[s.id] = s.name
        setSkillNames(map)
      } catch {
        /* non-fatal */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // The bound project-folder NAME for the draft header (from the chosen picker id,
  // or the definition's own project_folder_id if the AI bound one).
  const boundFolderName = useMemo<string | null>(() => {
    const id =
      (builderPhase === "drafted" ? meta.project_folder_id : null) || projectFolderId || null
    return id ? (folderNames[id] ?? null) : null
  }, [builderPhase, meta, projectFolderId, folderNames])

  const onDraft = useCallback(async () => {
    const text = describe.trim()
    if (text.length === 0) return
    store.getState().setComposing()
    setSelectedSlug(null)
    setDraftId(null)
    draftIdRef.current = null
    creatingRef.current = false
    try {
      const result = await generateWorkflow({
        describe: text,
        // Phase 103-ux: bind the generated workflow to the chosen project (KB). The
        // backend GenerateRequest accepts project_folder_id; omit when none picked.
        ...(projectFolderId ? { project_folder_id: projectFolderId } : {}),
      })
      if (result.ok) {
        // SINGLE STATE TRANSITION: commit the complete definition + "drafted" in
        // ONE store set. The graph renders whole, in one DOM batch (no timed reveal).
        // Stamp the chosen project_folder_id onto the definition if the generator
        // didn't already bind one (so the draft + later publish carry the binding).
        const def = result.definition as unknown as BuilderDefinition
        if (projectFolderId && !def.project_folder_id) def.project_folder_id = projectFolderId
        store.getState().setDrafted(def)
      } else {
        // ok:false is an HONEST failure — never a renderable broken draft.
        store.getState().setErrorState(result.error, result.detail)
      }
    } catch (e) {
      store.getState().setErrorState(
        "Couldn't generate the workflow.",
        e instanceof Error ? e.message : undefined,
      )
    }
  }, [describe, projectFolderId, store])

  // Phase 124 CR-01 fix: when handed off from the loose "Describe & run" door's
  // "Draft the workflow" CTA (autoDraft), run the EXISTING generate→draft flow ONCE
  // with the seeded text — so the fast path actually drafts instead of dead-ending on
  // an empty describe screen. Guarded to fire exactly once, fresh-build ("empty") only.
  const autoDraftFiredRef = useRef(false)
  useEffect(() => {
    if (
      autoDraft &&
      !autoDraftFiredRef.current &&
      (initialDescribe ?? "").trim().length > 0 &&
      builderPhase === "empty"
    ) {
      autoDraftFiredRef.current = true
      void onDraft()
    }
  }, [autoDraft, initialDescribe, builderPhase, onDraft])

  // Merge a phase-form patch into the selected phase's config. The immutable merge
  // itself now lives in `definitionOps.patchPhaseConfig`, reached through the store's
  // `patchConfig` action — D-184-05 leaves exactly ONE mutation home, shared by both
  // views, so this page no longer declares its own copy of it.
  const onPhaseChange = useCallback(
    (patch: PhaseConfigPatch) => {
      if (selectedSlug === null) return
      store.getState().patchConfig(selectedSlug, patch)
    },
    [selectedSlug, store],
  )

  // Persist the working draft. First save → createWorkflowDraft (then keep the id);
  // subsequent saves → updateWorkflowDraft (PATCH). For Open/Tweak the ref is
  // pre-seeded so this ALWAYS PATCHes the loaded row (never a duplicate create).
  // Returns true on a confirmed write so the explicit Save button can show "Saved ✓"
  // (and false / throw so it can show an honest error). The implicit on-blur
  // autosave still calls this and ignores the result (belt-and-suspenders).
  //
  // Phase 184-04 (D-184-05): the create-once-then-PATCH guard below is UNCHANGED.
  // The only edit is where the definition comes from — a side-effect `getState()`
  // read of the store instead of a closure over component state, which is what
  // keeps this callback referentially stable across every edit.
  const onPersist = useCallback(async (): Promise<boolean> => {
    const snapshot = store.getState()
    if (snapshot.builderPhase !== "drafted") return false
    const def = selectDefinition(snapshot) as unknown as Record<string, unknown>
    if (draftIdRef.current === null) {
      // First save: create EXACTLY ONCE. If a create is already in flight,
      // skip — re-running it would collide on UNIQUE(slug, version) → 500.
      if (creatingRef.current) return false
      creatingRef.current = true
      try {
        const created = await createWorkflowDraft(def)
        draftIdRef.current = created.id // synchronous: subsequent calls PATCH
        setDraftId(created.id)
      } finally {
        creatingRef.current = false
      }
    } else {
      await updateWorkflowDraft(draftIdRef.current, def)
    }
    // Phase 184-11: a CONFIRMED write is the only thing that clears `dirty` — the store's
    // `markSaved()` is its one setter and it writes nothing itself. Without this the
    // leave guard would prompt after every successful save, which is how a guard teaches
    // a person to click through it. Undo re-arms `dirty` immediately afterwards
    // (D-184-03), because stepping back past a save point really does make the in-memory
    // definition differ from what was PATCHed.
    store.getState().markSaved()
    return true
  }, [store])

  // Phase 103-ux SAVE button: an EXPLICIT, obvious save with visible feedback.
  // Drives the persist path (create-once-then-PATCH) and surfaces "Saved ✓" on
  // success or an honest error state on failure (409/404/network). The implicit
  // on-blur autosave (onPersist) stays; this is the user-facing affordance.
  const onSaveDraft = useCallback(async () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
    setSaveState("saving")
    setSaveErrorMessage(null)
    try {
      const ok = await onPersist()
      setSaveState(ok ? "saved" : "error")
    } catch (err) {
      // A 409 (published/frozen) / 404 / network failure is surfaced honestly —
      // never silently swallowed as a success.
      //
      // Phase 184-11 (D-184-16 debt 3): the 409 gets its OWN sentence. The branch reads
      // the error's NAME rather than using `instanceof WorkflowConflictError`, which is
      // the idiom `useLiveValidation.causeOf` already shipped and states its reason for:
      // a rejection that crossed a module or realm boundary still classifies, and the
      // page needs no value import from the API client to recognise it. Everything else
      // keeps today's generic state — a 404 or a network failure is a different thing
      // and must not be told the workflow is published.
      const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : ""
      setSaveErrorMessage(name === "WorkflowConflictError" ? PUBLISHED_CONFLICT_MESSAGE : null)
      setSaveState("error")
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2500)
  }, [onPersist])

  // ── D-184-16 debt 1 — the unsaved-work leave guard, both halves ────────────────

  const dirty = useStore(store, (s) => s.dirty)

  /**
   * The in-app half. `WorkflowsPage` owns the `← Workflows` breadcrumb and this page
   * owns the dirty state, and there is no router between them — so the Builder hands the
   * host a predicate and the host asks before it switches view. Re-registered whenever
   * `dirty` changes so the closure is never stale, and UNREGISTERED on unmount so a
   * Builder that is gone cannot keep refusing to be left.
   */
  useEffect(() => {
    if (!registerCanLeave) return
    registerCanLeave(() => (dirty ? window.confirm(UNSAVED_LEAVE_PROMPT) : true))
    return () => registerCanLeave(null)
  }, [registerCanLeave, dirty])

  /**
   * The tab-close half. GATED on `dirty` in the shipped Escape-listener shape: no
   * listener exists while the draft is clean, so it costs nothing at rest and a saved
   * session never gets the browser's "leave site?" dialog. `preventDefault()` plus the
   * legacy `returnValue` assignment is what every engine still requires to show it.
   */
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  // Clean up the transient-confirmation timer on unmount.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // ── EMPTY: just the describe box — a 3-second read, nothing else. ──
  if (builderPhase === "empty" || builderPhase === "composing" || builderPhase === "error") {
    return (
      <BuilderStoreProvider store={store}>
      <div className="flex h-full flex-col items-center justify-center bg-background px-6 py-8">
        <div className="flex w-full max-w-[640px] flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span aria-hidden="true" className="text-3xl">
              ✎
            </span>
            <h1 className="font-semibold text-foreground" style={{ fontSize: "1.5rem" }}>
              What recurring work should this automate?
            </h1>
          </div>

          <textarea
            aria-label="business requirement"
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            placeholder="Describe the goal in plain language…"
            rows={5}
            disabled={builderPhase === "composing"}
            className="w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {/* Phase 103-ux: ONE calm project picker — binds the generated workflow to
              a knowledge base. Only shown once folders have loaded (keeps the empty
              screen calm when there are none). NOT the sketch's full infer+confirm loop. */}
          {folderOptions.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-muted-foreground">Which knowledge base should this use?</span>
              <select
                data-testid="project-folder-picker"
                aria-label="Which knowledge base should this use?"
                value={projectFolderId}
                onChange={(e) => setProjectFolderId(e.target.value)}
                disabled={builderPhase === "composing"}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No specific knowledge base</option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={!canDraft}
              onClick={onDraft}
              className="rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {builderPhase === "composing" ? "Composing…" : "Draft the workflow"}
            </button>

            <p data-testid="describe-hint" className="text-center text-[13px] text-muted-foreground">
              You describe the goal — the AI <b className="font-medium text-foreground">drafts the phases</b>,{" "}
              <b className="font-medium text-foreground">sets the strictness</b>, and{" "}
              <b className="font-medium text-foreground">asks about anything it had to guess</b>.
            </p>
          </div>

          {/* HONEST FAILURE — never a renderable broken draft (T-103-04-01). */}
          {builderPhase === "error" && (
            <div
              data-testid="generate-error"
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] text-foreground"
            >
              <p className="font-medium">Couldn't generate — {errorMessage}</p>
              {errorDetail && <p className="mt-1 text-[12px] text-muted-foreground">{errorDetail}</p>}
              <p className="mt-1 text-[12px] text-muted-foreground">
                Nothing was saved. Adjust your description and try again.
              </p>
            </div>
          )}
        </div>
      </div>
      </BuilderStoreProvider>
    )
  }

  // ── DRAFTED: the read-only spine graph (left) + the 400px push form panel (right). ──
  // The push grid mirrors the app's existing ChatLayout 2-state track exactly.

  // The graph column's CHILD — one view or the other, never both, both fed the same
  // three props so the canvas is a drop-in peer of the spine. `activeGraphView` is
  // pinned to "spine" whenever the flag is off, so the lazy chunk is never requested.
  const graphChild =
    activeGraphView === "canvas" ? (
      <Suspense
        fallback={
          <div
            data-testid="builder-canvas-loading"
            className="flex h-full min-w-0 items-center justify-center bg-background text-[12px] text-muted-foreground"
          >
            Opening the canvas…
          </div>
        }
      >
        <WorkflowCanvas
          phases={phases}
          selectedSlug={selectedSlug}
          onSelectNode={handleSelectNode}
          onClearSelection={clearSelection}
          // Phase 184-11 — the editing half, composed HERE and nowhere else. This branch
          // is unreachable unless `canvasEnabled` is true (`activeGraphView` pins to
          // "spine" otherwise), so the flag is passed explicitly rather than assumed.
          editable={canvasEnabled}
          marks={marks}
          nudges={nudges}
          onNudge={onNudge}
          onCommitNodes={onCommitNodes}
          // Phase 184-12 — the grow-the-flow half. Both refusals are decided HERE, from
          // `definitionOps`' shape predicates, and the canvas renders what it is told.
          onInsertAt={onInsertAt}
          onRequestRemove={onRequestRemove}
          notice={canvasNotice}
        />
      </Suspense>
    ) : (
      <PhaseSpineGraph
        phases={phases}
        selectedSlug={selectedSlug}
        onSelectNode={handleSelectNode}
      />
    )

  // D-183-03 — the strip renders ONLY when the flag resolves strictly on. With the
  // flag off `graphChild` IS the grid's first child, exactly as it ships today: no
  // wrapper element, no strip, no reserved space, nothing of the canvas in the DOM.
  const graphColumn = canvasEnabled ? (
    <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      {/* The house segmented control (`SkillStudioPage.tsx:191-212`). A plain div
          host, never a nav landmark — the Phase 155 A11Y-01 rule (an interactive
          "tablist" role must not override a landmark). Tablist semantics only. */}
      <div
        data-testid="builder-view-toggle"
        role="tablist"
        aria-label="Graph view"
        className="flex items-center gap-1 border-b border-border/60 px-4 py-2"
      >
        <button
          type="button"
          role="tab"
          data-testid="builder-view-spine"
          aria-selected={activeGraphView === "spine"}
          onClick={() => setGraphView("spine")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] transition-colors",
            activeGraphView === "spine"
              ? "bg-primary/10 font-semibold text-primary"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
          )}
        >
          <span aria-hidden="true" className="mr-1.5">
            ≣
          </span>
          Spine
        </button>
        <button
          type="button"
          role="tab"
          data-testid="builder-view-canvas"
          aria-selected={activeGraphView === "canvas"}
          onClick={() => setGraphView("canvas")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] transition-colors",
            activeGraphView === "canvas"
              ? "bg-primary/10 font-semibold text-primary"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
          )}
        >
          <span aria-hidden="true" className="mr-1.5">
            ⬡
          </span>
          Canvas
        </button>
      </div>
      {graphChild}
    </div>
  ) : (
    graphChild
  )

  return (
    <BuilderStoreProvider store={store}>
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">
            {meta.slug ?? "Untitled workflow"}
          </span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            draft
          </span>
          {/* Phase 103-ux: the bound project (knowledge base) NAME, not a UUID. */}
          {boundFolderName && (
            <span
              data-testid="builder-bound-folder"
              className="shrink-0 truncate rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              📁 {boundFolderName}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Phase 103-ux: explicit Save draft + transient confirmation.
              Phase 184-11 (R6): this region is the ONLY place the page says anything
              about the save, and what it says is `Saved · still a draft`. */}
          <div data-testid="builder-save-state" className="flex items-center gap-2">
            <button
              type="button"
              data-testid="builder-save-draft"
              onClick={() => void onSaveDraft()}
              disabled={saveState === "saving"}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-opacity hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveState === "saving" ? (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
                  />
                  Saving…
                </>
              ) : (
                "Save draft"
              )}
            </button>
            {saveState === "saved" && (
              <span data-testid="builder-save-confirm" role="status" className="text-[13px] font-medium text-success">
                {SAVED_STILL_A_DRAFT}
              </span>
            )}
            {saveState === "error" && (
              <span data-testid="builder-save-error" role="alert" className="text-[13px] font-medium text-destructive">
                {saveErrorMessage ?? GENERIC_SAVE_ERROR}
              </span>
            )}
          </div>
          {/* R12 — publish lives in the header that ALREADY EXISTS (sketch 141-B, the
              operator's correction). No net-new band: the reason travels through the
              shipped `renderPublish` seam as a third argument so the mount does not move. */}
          {renderPublish && definition && <div>{renderPublish(definition, draftId, blockedReason)}</div>}
        </div>
      </header>

      <div
        data-testid="builder-grid"
        className="grid min-h-0 min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
        style={{ gridTemplateColumns: "minmax(0,1fr) " + (panelOpen ? "400px" : "44px") }}
      >
        {graphColumn}
        <PhaseFormPanel
          phase={selectedPhase}
          open={panelOpen}
          folderName={boundFolderName ?? undefined}
          folderNames={folderNames}
          skillNames={skillNames}
          onChange={onPhaseChange}
          onPersist={onPersist}
          onClose={clearSelection}
          // D-14 — SPREAD-CONDITIONAL, never `rails={canvasEnabled ? rails : undefined}`.
          // With the flag off the prop must be genuinely ABSENT from the element, not
          // present-and-undefined: this panel is ONE instance serving both the shipped
          // Spine view and the flagged Canvas view, and "absent renders today's panel" is
          // the mechanism that keeps a flag-off surface byte-identical for everyone
          // including operators.
          {...(canvasEnabled ? { rails } : {})}
        />
      </div>
    </div>
    </BuilderStoreProvider>
  )
}

export default WorkflowBuilderPage
