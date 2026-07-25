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
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { generateWorkflow, createWorkflowDraft, updateWorkflowDraft, listFolders, listSkills } from "@/lib/api"
import { PhaseSpineGraph } from "@/components/workflows/PhaseSpineGraph"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { PhaseFormPanel, type PhaseConfigPatch, type IdNameMap } from "@/components/workflows/PhaseFormPanel"

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
        <PhaseSpineGraph
          phases={state.definition.phases}
          selectedSlug={selectedSlug}
          onSelectNode={(slug) => setSelectedSlug((cur) => (cur === slug ? null : slug))}
        />
        <PhaseFormPanel
          phase={selectedPhase}
          open={panelOpen}
          folderName={boundFolderName ?? undefined}
          folderNames={folderNames}
          skillNames={skillNames}
          onChange={onPhaseChange}
          onPersist={onPersist}
        />
      </div>
    </div>
  )
}

export default WorkflowBuilderPage
