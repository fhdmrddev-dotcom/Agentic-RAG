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
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { generateWorkflow, createWorkflowDraft, updateWorkflowDraft, listFolders, listSkills } from "@/lib/api"
import { PhaseSpineGraph } from "@/components/workflows/PhaseSpineGraph"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { PhaseFormPanel, type PhaseConfigPatch, type IdNameMap } from "@/components/workflows/PhaseFormPanel"
import { useEffectiveFeaturesOptional } from "@/providers/EffectiveFeaturesProvider"
import { cn } from "@/lib/utils"

/** The read-only canvas, code-split behind the toggle (see the docblock). The module
 *  also exports a `default`, so the `.then(...)` shim below is belt-and-braces — it
 *  mirrors the app's ONE shipped code-split (`KnowledgeHealthPage.tsx:32`) so both
 *  lazy boundaries read the same way. */
const WorkflowCanvas = lazy(() => import("@/components/workflows/WorkflowCanvas").then((m) => ({ default: m.WorkflowCanvas })))

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

type BuilderState =
  | { phase: "empty" }
  | { phase: "composing" }
  | { phase: "drafted"; definition: BuilderDefinition }
  | { phase: "error"; message: string; detail?: string }

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
   *  call site (WorkflowsPage) just passes the supplied `def` through as `definition`. */
  renderPublish?: (def: BuilderDefinition, draftId: string | null) => React.ReactNode
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
}

export function WorkflowBuilderPage({ renderPublish, initial, initialDescribe, autoDraft }: WorkflowBuilderPageProps) {
  const [describe, setDescribe] = useState(initialDescribe ?? "")
  // OPEN/TWEAK: when `initial` is provided, boot straight into the drafted editing
  // view on the loaded definition (the describe/composing screen is skipped). A
  // fresh build (no `initial`) starts "empty" exactly as before.
  const [state, setState] = useState<BuilderState>(
    initial ? { phase: "drafted", definition: initial.definition } : { phase: "empty" },
  )
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
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canDraft = describe.trim().length > 0 && state.phase !== "composing"
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
  const clearSelection = useCallback(() => {
    setSelectedSlug(null)
  }, [])

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

  // The current working definition (drafted state only).
  const definition = state.phase === "drafted" ? state.definition : null

  const selectedPhase = useMemo<PhaseSpecJSON | null>(() => {
    if (!definition || selectedSlug === null) return null
    return definition.phases.find((p) => p.slug === selectedSlug) ?? null
  }, [definition, selectedSlug])

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
      (state.phase === "drafted" ? state.definition.project_folder_id : null) || projectFolderId || null
    return id ? (folderNames[id] ?? null) : null
  }, [state, projectFolderId, folderNames])

  const onDraft = useCallback(async () => {
    const text = describe.trim()
    if (text.length === 0) return
    setState({ phase: "composing" })
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
        // ONE setState. The graph renders whole, in one DOM batch (no timed reveal).
        // Stamp the chosen project_folder_id onto the definition if the generator
        // didn't already bind one (so the draft + later publish carry the binding).
        const def = result.definition as unknown as BuilderDefinition
        if (projectFolderId && !def.project_folder_id) def.project_folder_id = projectFolderId
        setState({ phase: "drafted", definition: def })
      } else {
        // ok:false is an HONEST failure — never a renderable broken draft.
        setState({ phase: "error", message: result.error, detail: result.detail })
      }
    } catch (e) {
      setState({
        phase: "error",
        message: "Couldn't generate the workflow.",
        detail: e instanceof Error ? e.message : undefined,
      })
    }
  }, [describe, projectFolderId])

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
      state.phase === "empty"
    ) {
      autoDraftFiredRef.current = true
      void onDraft()
    }
  }, [autoDraft, initialDescribe, state.phase, onDraft])

  // Merge a phase-form patch into the selected phase's config (immutable).
  const onPhaseChange = useCallback(
    (patch: PhaseConfigPatch) => {
      setState((prev) => {
        if (prev.phase !== "drafted" || selectedSlug === null) return prev
        const phases = prev.definition.phases.map((p) =>
          p.slug === selectedSlug ? { ...p, config: { ...p.config, ...patch } } : p,
        )
        return { phase: "drafted", definition: { ...prev.definition, phases } }
      })
    },
    [selectedSlug],
  )

  // Persist the working draft. First save → createWorkflowDraft (then keep the id);
  // subsequent saves → updateWorkflowDraft (PATCH). For Open/Tweak the ref is
  // pre-seeded so this ALWAYS PATCHes the loaded row (never a duplicate create).
  // Returns true on a confirmed write so the explicit Save button can show "Saved ✓"
  // (and false / throw so it can show an honest error). The implicit on-blur
  // autosave still calls this and ignores the result (belt-and-suspenders).
  const onPersist = useCallback(async (): Promise<boolean> => {
    if (state.phase !== "drafted") return false
    const def = state.definition as unknown as Record<string, unknown>
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
    return true
  }, [state])

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
    try {
      const ok = await onPersist()
      setSaveState(ok ? "saved" : "error")
    } catch {
      // A 409 (published/frozen) / 404 / network failure is surfaced honestly —
      // never silently swallowed as a success.
      setSaveState("error")
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2500)
  }, [onPersist])

  // Clean up the transient-confirmation timer on unmount.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  // ── EMPTY: just the describe box — a 3-second read, nothing else. ──
  if (state.phase === "empty" || state.phase === "composing" || state.phase === "error") {
    return (
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
            disabled={state.phase === "composing"}
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
                disabled={state.phase === "composing"}
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
              {state.phase === "composing" ? "Composing…" : "Draft the workflow"}
            </button>

            <p data-testid="describe-hint" className="text-center text-[13px] text-muted-foreground">
              You describe the goal — the AI <b className="font-medium text-foreground">drafts the phases</b>,{" "}
              <b className="font-medium text-foreground">sets the strictness</b>, and{" "}
              <b className="font-medium text-foreground">asks about anything it had to guess</b>.
            </p>
          </div>

          {/* HONEST FAILURE — never a renderable broken draft (T-103-04-01). */}
          {state.phase === "error" && (
            <div
              data-testid="generate-error"
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] text-foreground"
            >
              <p className="font-medium">Couldn't generate — {state.message}</p>
              {state.detail && <p className="mt-1 text-[12px] text-muted-foreground">{state.detail}</p>}
              <p className="mt-1 text-[12px] text-muted-foreground">
                Nothing was saved. Adjust your description and try again.
              </p>
            </div>
          )}
        </div>
      </div>
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
          phases={state.definition.phases}
          selectedSlug={selectedSlug}
          onSelectNode={handleSelectNode}
          onClearSelection={clearSelection}
        />
      </Suspense>
    ) : (
      <PhaseSpineGraph
        phases={state.definition.phases}
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
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">
            {state.definition.slug ?? "Untitled workflow"}
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
          {/* Phase 103-ux: explicit Save draft + transient confirmation. */}
          <div className="flex items-center gap-2">
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
                Saved ✓
              </span>
            )}
            {saveState === "error" && (
              <span data-testid="builder-save-error" role="alert" className="text-[13px] font-medium text-destructive">
                Couldn't save
              </span>
            )}
          </div>
          {renderPublish && <div>{renderPublish(state.definition, draftId)}</div>}
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
        />
      </div>
    </div>
  )
}

export default WorkflowBuilderPage
