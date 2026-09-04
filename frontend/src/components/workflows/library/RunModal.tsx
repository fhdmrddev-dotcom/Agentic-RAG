/**
 * Phase 192-06 Task 1 (D-01) — RunModal.
 *
 * THE RUN LAUNCH MODAL: the KB-scope `<select>`, the staged-template upload, the kickoff
 * textarea, the honest destination line and the two footer buttons. Eight props in, two
 * module-level helpers reached (`entryInputKeys`, `useCanvasGate`), and it closes over
 * NOTHING from the page — no page state, no page-scoped const, no closure over a handler
 * defined in the page body. That is the property that made it liftable at all, and the
 * property the next author has to keep true. Its own state (`selectedFolderId`,
 * `templateFile`, `launchError`) was already local before the move.
 *
 * STATE OF THE EXTRACTION — read this literally, it is not a claim about the future:
 * `RunModal` was CUT out of `WorkflowsPage.tsx` (it was declared there at `:1054-1405` of a
 * measured 1407-line file, immediately above `export default WorkflowsPage`). It is a HARD
 * CUT: the page declares it nowhere any more and NO re-export shim was left behind; the page
 * imports the component from here and renders it at the byte-identical JSX site, keeping its
 * `key={runFor.id}` and all eight props. The body moved byte-for-byte with every inline
 * comment intact — nothing re-typed, nothing tidied, nothing re-ordered — so the diff reads
 * as a MOVE under `git diff --numstat` rather than as a rewrite a reviewer must re-derive.
 * The ONLY character added inside the moved range is the `export ` keyword on the function.
 *
 * ⚠ THE `:NNN` REFERENCES INSIDE THE MOVED COMMENTS POINT AT THE PRE-MOVE
 * `WorkflowsPage.tsx` (measured 1407 L at the wave-2 base `d5a601cd`), not at this file, and
 * not at the page as it stands after the cut. Kept exactly as shipped: rewriting them would
 * be an EDIT, and this has to read as a move.
 *
 * THIS FILE EXPORTS THE COMPONENT AND ITS PROPS TYPE AND NO RUNTIME VALUE OF ANY KIND.
 * `react-refresh/only-export-components` errors for exactly that, which is the rule
 * `PlaneEditingLayer.tsx:23-31` records after 188.1 measured it — a shared runtime value
 * belongs in a camelCase leaf (`libraryFilter.ts`, `libraryVocabulary.ts`), never here.
 * `RunModalProps` is DERIVED (`Parameters<typeof RunModal>[0]`, the house idiom already at
 * `RunModal.test.tsx:360`) rather than re-declared, so the exported type cannot drift from
 * the inline props object the move brought over untouched.
 *
 * A LAYERING NOTE, RECORDED RATHER THAN FIXED. `useCanvasGate` lives in a *page* module and
 * is imported here by a *component*; this module inherits that import from the page, which
 * has read the gate this way since 184.1-01. It is NOT a cycle — `WorkflowBuilderPage.tsx`
 * names `WorkflowsPage` only in prose comments — and Phase 192 did not introduce the smell.
 * Widening scope to fix it here would be scope creep; leaving it unremarked would let a
 * reviewer read it as introduced here. Neither, so: it is named, and it is left alone.
 *
 * These paragraphs are kept honest by machine, not by habit. `librarySubtree.fences.test.ts`
 * (192-05) named `./RunModal.tsx` in its explicit seven-path list BEFORE this file existed,
 * so the moment it landed four fences began reading it with no edit to the fence: F1 (no
 * `title` attribute — D-14, touch has no hover), F4 (this module may name no `WorkflowsPage`
 * specifier in any import form — a back-import typechecks clean, lints clean and fails only
 * at runtime), F5 (no user-visible string overstating the search) and T-192-04 (no raw-HTML
 * escape hatch — and note that fence is a RAW regex, not a parsed one, so it reds on prose
 * that merely SPELLS the React prop it forbids; this sentence deliberately does not).
 * And `RunModal.test.tsx` holds SIX whole-`innerHTML` captures
 * plus both sides of the canvas-gate destination branch, taken by 192-03 at `14b309b4` — a
 * commit at which this very path answered *"does not exist in 'HEAD'"*. Those literals are
 * CAPTURES, not expectations: a red one means this move was not verbatim, and re-capturing
 * to make it green deletes the only evidence the modal still renders what it rendered.
 */
import { useState, useEffect, useMemo, useRef } from "react"
import { Upload, Check, X, ChevronDown, Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { launchInputFields, templateAdmission, type DefShape } from "@/components/workflows/soulData"
// 214-12 (STEP-02): the ONE declared-input field renderer, shared with the chat launch form.
// The two-arm label rule and the launchInputFields-not-entryInputFields warning live with it.
import { LaunchInputFields } from "@/components/workflows/LaunchInputFields"
import { RUN_TEMPLATE_LABEL } from "./libraryVocabulary"
import { useCanvasGate } from "@/pages/WorkflowBuilderPage"
import type { PublishedWorkflow } from "@/lib/api"
import type { Folder } from "@/types"

export function RunModal({
  wf,
  folders,
  authorDefaultFolderId,
  kickoff,
  submitting,
  onKickoffChange,
  onCancel,
  onRun,
}: {
  wf: PublishedWorkflow
  /** The owner's project folders — the scope <select>'s option source (D-LOCK-01). */
  folders: Folder[]
  /** The workflow's author-time retrieval default (definition.project_folder_id).
   *  null = an unbound workflow (whole-KB default). */
  authorDefaultFolderId: string | null
  kickoff: string
  submitting: boolean
  onKickoffChange: (v: string) => void
  onCancel: () => void
  /** 152 (WFIN-01/02): launch carries the two run inputs — a staged template `File`
   *  and a per-run folder override `folderId` (null = stay on the workflow default,
   *  D-06). May reject (e.g. a template 422) → the modal renders the message inline.
   *
   *  Phase 214-09 (STEP-02 / D-214-04) adds a THIRD: `inputs`, the values collected for
   *  the definition's declared entry inputs, keyed by their declared key.
   *
   *  ⚠ `inputs` IS ALWAYS PRESENT — `{}` when the definition declares none. An absent key
   *  and an empty object are different facts, and a caller must not have to tell them apart
   *  by `undefined`. That is also what makes the "every invocation carries it" assertion in
   *  `RunModal.test.tsx` a real fence rather than a coincidence of the fixtures. */
  onRun: (extras: {
    templateFile: File | null
    folderId: string | null
    inputs: Record<string, string>
  }) => void | Promise<void>
}) {
  const def = wf.definition as DefShape | undefined
  // 200-WIRE: the entry inputs WITH their authored labels. `entryInputFields` is the same
  // resolver `entryInputKeys` is now derived from, so the key list and its order are
  // unchanged — see the hint line below for why the unlabelled arm stays character-identical.
  //
  // ⚠ 214-09 REPLACED `entryInputFields` HERE WITH `launchInputFields`, AND THE THREE LOCALS
  // THE HINT LINE NEEDED (`inputFields` / `keys` / `anyAuthoredLabel`) ARE GONE WITH IT.
  // `tsconfig.app.json` sets `noUnusedLocals`, so they could not be kept as documentation.
  // `launchInputFields` IS `entryInputFields` minus the reserved run-scaffolding keys — same
  // resolver, same precedence, same two-arm label rule — so the ORDER and the LABELS below
  // are the hint line's, unchanged. See the docblock further down for what changed and why.
  const launchFields = launchInputFields(def)
  // The collected values, keyed by the DECLARED key. Never seeded from anything: a field a
  // person did not fill is an empty string, and an empty string is a real answer here (the
  // executor's own schema validation is the arbiter — this launcher validates nothing).
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  // ── Phase 193-07 (AUTH-03 / D-17 / D-20): does this workflow get the template control? ──
  //
  // HIDE ONLY ON A POSITIVE NO. `templateAdmission` is THREE-state and this comparison is
  // `!==` against `"does-not-admit"` on purpose: `"unknown"` renders the control EXACTLY as
  // it renders today.
  //
  // ⚠ THIS IS THE OPPOSITE FALLBACK FROM THE CARD'S (`WorkflowCard`, D-15:
  // `templateAdmission(row.def) === "admits"`), AND THE ASYMMETRY IS A DECISION, NOT AN
  // OVERSIGHT — do not "fix" the two into consistency. On the card a missing mark costs
  // nothing: the row is simply quiet. Here, hiding on `unknown` would REMOVE A SHIPPED
  // CAPABILITY (WFIN-01) from a person who may genuinely need it, with no way left to
  // discover it ever existed. And `unknown` is not an edge case: measured over the live
  // library it is 110 of 145 published rows against 1 `admits` / 34 `does-not-admit`. A backend
  // hiccup, or a frontend deployed ahead of its backend, must not silently strip the feature
  // from three-quarters of the library.
  // ⚠ CORRECTED (193 REVIEW WR-07): this comment used to attribute all 110 to `phases: []`
  // ("a stub nobody authored"). That cause was never measured. `definition` is a jsonb STRING
  // SCALAR on 194 of 223 rows and reaches this predicate unparsed, so most of the 110 likely
  // answer `unknown` at the shape guard rather than at the empty-phases step. The COUNT is
  // measured; the CAUSE is not, and is no longer asserted here.
  const showTemplate = templateAdmission(def) !== "does-not-admit"
  // F4: read the SAME gate `doRun` reads, so the destination line cannot drift from the
  // destination. Called here rather than threaded as a prop — one reader, no new surface.
  const canvasEnabled = useCanvasGate()

  // ── WFIN-02 (D-LOCK-01) + WR-05: the KB-scope <select>. The "" option is ALWAYS the
  //    resting selection and truthfully labels the server-applied scope: for a BOUND
  //    workflow it reads "Workflow default" (the override channel is narrow-only, D-06 —
  //    "" resolves to the author default server-side, never whole-KB), and ONLY an
  //    UNBOUND workflow (no project_folder_id) reads "All documents" (where folderId:null
  //    genuinely means whole-KB). A real folder DIFFERENT from the author default is the
  //    only per-run override.
  const authorDefaultExists =
    !!authorDefaultFolderId && folders.some((f) => f.id === authorDefaultFolderId)
  // Initial selection is "" in every case — for a bound workflow "" now truthfully IS
  // the workflow default (WR-05); it never mislabels an author-scoped run as whole-KB.
  const [selectedFolderId, setSelectedFolderId] = useState<string>("")
  // ── WFIN-01 (D-LOCK-02): the staged template File. No thread exists yet — doRun
  //    uploads it to the launched thread (Landmine 8); this only stages it.
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  // The inline launch/upload error (the server's validate_upload 422 verbatim — it
  // surfaces at launch because the upload targets the launched thread, not on stage).
  const [launchError, setLaunchError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // A4 composition guard (WR-03 — the client mirror of backend scope.py
  // resolve_run_scope_root, 152-06): a workflow that declares any per-phase folder_scope
  // must NOT offer an override whose OWN subtree misses a declared phase's folder_scope —
  // that would silently empty the phase's ∩ at retrieval (phase_types.py:326). Membership
  // in the author subtree is necessary but NOT sufficient (a child A of project P empties
  // a phase scoped to sibling B), so we intersect against each CANDIDATE's own subtree.
  const hasPhaseFolderScope = (def?.phases ?? []).some((p) => {
    const fs = (p.config as { folder_scope?: unknown } | undefined)?.folder_scope
    return Array.isArray(fs) && fs.length > 0
  })
  // Each declared phase's non-empty folder_scope id list. A phase with no folder_scope
  // imposes no constraint — dropped here, exactly like the backend's `if scope and …`.
  const phaseFolderScopes = useMemo<string[][]>(() => {
    return (def?.phases ?? [])
      .map((p) => {
        const fs = (p.config as { folder_scope?: unknown } | undefined)?.folder_scope
        return Array.isArray(fs) ? fs.filter((x): x is string => typeof x === "string") : []
      })
      .filter((fs) => fs.length > 0)
  }, [def])
  const authorDefaultName = authorDefaultExists
    ? folders.find((f) => f.id === authorDefaultFolderId)?.name ?? null
    : null
  // Override options = every OTHER owner-reachable folder. For a workflow that declares
  // per-phase folder_scope, mirror the CORRECTED backend A4 rule (scope.py, 152-08): the
  // override must satisfy BOTH the NECESSARY author-subtree membership AND the SUFFICIENT
  // per-phase intersection. No-scope workflows are unchanged.
  const overrideOptions = useMemo(() => {
    const candidates = folders.filter((f) => f.id !== authorDefaultFolderId)
    if (!hasPhaseFolderScope) return candidates
    const subtreeOf = (rootId: string): Set<string> => {
      const ids = new Set<string>()
      const visit = (rid: string) => {
        if (ids.has(rid)) return
        ids.add(rid)
        for (const f of folders) if (f.parent_id === rid) visit(f.id)
      }
      visit(rootId)
      return ids
    }
    // NECESSARY (author-subtree containment — mirrors scope.py's restored A4 check, 152-08):
    // for a BOUND folder_scope workflow, a candidate must be a MEMBER of the author's OWN
    // project subtree. A strict ANCESTOR/SIBLING of the bound project would WIDEN the run's
    // retrieval to unrelated sibling projects, so it must NEVER be offered. When there is no
    // author default (the UNBOUND + folder_scope shape) there is no declared boundary to
    // contain against — skip this filter and apply only the per-phase intersection (the
    // unbound path stays as shipped).
    const contained =
      authorDefaultFolderId != null
        ? candidates.filter((cand) => subtreeOf(authorDefaultFolderId).has(cand.id))
        : candidates
    // SUFFICIENT (per-phase intersection): keep a candidate ONLY when EVERY declared phase
    // folder_scope still intersects the CANDIDATE's OWN subtree — otherwise offering it steers
    // the run into empty retrieval (phase_types.py:326).
    return contained.filter((cand) => {
      const sub = subtreeOf(cand.id)
      return phaseFolderScopes.every((scope) => scope.some((id) => sub.has(id)))
    })
  }, [folders, hasPhaseFolderScope, phaseFolderScopes, authorDefaultFolderId])

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = "" // reset so re-selecting the same file fires change again
    if (!f) return
    setTemplateFile(f)
    setLaunchError(null)
  }

  const handleRun = async () => {
    setLaunchError(null)
    // Only a real folder that DIFFERS from the author default is a per-run override.
    // The "" option (labelled "Workflow default" for a bound wf, "All documents" for an
    // unbound one — WR-05) passes NO override (D-06). NOTE: the Plan-01 override channel
    // narrows only — a bound workflow cannot widen to whole-KB via this path (override
    // falls through to the author default), which is exactly why the "" label reads
    // "Workflow default" (not "All documents") on a bound workflow. Narrowing works.
    const normalized = selectedFolderId || null
    const folderId = normalized && normalized !== authorDefaultFolderId ? normalized : null
    // 214-09 (STEP-02 / D-214-04): the declared-input values, projected onto the DECLARED
    // keys and nothing else. Built from `launchFields` rather than handed `inputValues`
    // straight, so a key that stopped being declared between two renders cannot ride along,
    // and so the dict is `{}` — never `undefined` — when the definition declares none.
    const inputs: Record<string, string> = {}
    for (const f of launchFields) inputs[f.key] = inputValues[f.key] ?? ""
    try {
      await onRun({ templateFile, folderId, inputs })
    } catch (e) {
      // Surface the server's validate_upload message VERBATIM (never a friendlier lie).
      setLaunchError(e instanceof Error ? e.message : "Run failed")
    }
  }
  // WR-06 (a11y): a lightweight focus contract for the aria-modal dialog —
  // Escape-to-close, initial focus on the textarea, and Tab containment within the
  // dialog (a minimal trap, no heavy dep / no shadcn Dialog rewrite).
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Initial focus lands inside the dialog (the kickoff textarea).
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        if (!submitting) onCancel()
        return
      }
      if (e.key !== "Tab") return
      // Simple focus containment: keep Tab/Shift+Tab inside the dialog.
      const root = dialogRef.current
      if (!root) return
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onCancel, submitting])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Run ${wf.name}`}
      data-testid="run-modal"
      className="fixed inset-0 z-[9000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
    >
      <div className="w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        {/* ⚠ 199-10 (DES-01) — THE HEADER SPENDS NO MARK. It carried an `aria-hidden`
            page glyph beside the name; it is removed, and the removal is the whole of this
            plan's change to this file.

            Three reasons, none of them taste. (1) It reached NOBODY using a screen reader,
            by its own attribute, so it was decoration by construction. (2) It said "document"
            about a WORKFLOW — this product has no category-glyph vocabulary and inventing one
            is the drift `icon-convention.md` §4 forbids by name; a workflow's identity is
            already carried by its phase spine. (3) Sheet c6 draws this dialog's header as
            plain text and spends no mark on it either.

            ⚠ THE WRAPPER'S `className` IS DELIBERATELY UNTOUCHED, INCLUDING THE NOW-INERT
            `gap-2`. The six whole-`innerHTML` captures below this file's tests are DERIVED
            from their predecessors by deleting exactly one specified substring — the glyph
            span and nothing else — so keeping every other byte identical is what makes that
            derivation checkable rather than a re-capture in disguise. Tidying the class here
            would put a second, unrelated delta into the same six strings.

            ⚠ The sheet's own header WORD is refused separately: it reads *"Execute {name}"*,
            and this product's verb for this action is Run. */}
        {/* ── PORTED FROM SKETCH 200 `run-dialog.html` (2026-08-20) ────────────────────
            The sheet's header is `px-lg py-md · justify-between`, a 17px truncating title
            and a dismiss control on the right. Two deltas from the shipped header, both
            deliberate:

            · THE TITLE IS 17px AND TRUNCATES. A workflow name is author-typed and long
              ("Quarterly Business Review — Northwind Logistics" is the sheet's own); at
              15px with no truncate it wrapped the header to two lines.
            · THE ✕ IS NEW, AND IT MOVES THE FOCUS CYCLE. Escape and Cancel were the only
              two ways out; the sheet draws a third and a dialog with no visible dismiss is
              a real gap on touch, where there is no Escape key. ⚠ It becomes the FIRST
              focusable in the trap, so `RunModal.a11y.test.tsx`'s two cycle pins move from
              `run-scope-select` to `run-modal-close` — re-baselined there with this reason
              written beside them, never silently.

            ⚠ The 199-10 rule still stands and is NOT reopened: the header spends no
            CATEGORY glyph. A dismiss control is an affordance, not a category mark. */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
          <span className="min-w-0 truncate text-[17px] font-semibold text-foreground">{wf.name}</span>
          <button
            type="button"
            data-testid="run-modal-close"
            aria-label="Close"
            disabled={submitting}
            onClick={onCancel}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {/* The sheet's body: `p-lg` with a `gap-lg` stack of field groups, each group a
            `gap-xs` label/control pair. The shipped body was `gap-3 px-4 py-4` with
            `gap-1.5` groups — the same composition drawn tighter than the sheet draws it. */}
        <div className="flex flex-col gap-6 px-6 py-6">
          {/* WFIN-02 (D-LOCK-01): the KB-scope <select> — native, byte-matching the
              ChatArea scope selector ("All documents / {folder}"). The author default
              is tagged "workflow default"; picking another = a per-run override. Hidden
              when there are no folders (matches ChatArea's folders.length guard). */}
          {folders.length > 0 && (
            <label data-testid="run-scope" className="flex flex-col gap-1">
              {/* The sheet labels this field `Knowledge base` with no colon — its two field
                  labels are sentences, not form-builder keys. The accessible name still
                  matches `/knowledge base/i`, which is what the a11y suite needles. */}
              <span className="text-[13px] font-medium text-foreground">Knowledge base</span>
              {/* The sheet draws a FULL-WIDTH `h-10` control with its own chevron rather
                  than the platform's — `appearance-none` plus an absolutely-positioned,
                  pointer-events-none glyph. It is still a native `<select>`, so role,
                  keyboard behaviour and the option list are untouched. */}
              <div className="relative w-full">
              <select
                data-testid="run-scope-select"
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-border bg-card pl-3 pr-9 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {/* WR-05: the "" option truthfully labels the server-applied scope.
                    Bound → "Workflow default" (with the folder name when the author
                    folder is visible, bare otherwise — never a whole-KB lie); unbound →
                    "All documents" (folderId:null genuinely means whole-KB). */}
                <option value="">
                  {authorDefaultFolderId
                    ? authorDefaultName
                      ? `Workflow default — 📁 ${authorDefaultName}`
                      : "Workflow default"
                    : "All documents"}
                </option>
                {overrideOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              </div>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-foreground">What should this run work on?</span>
            <textarea
              ref={textareaRef}
              data-testid="run-kickoff"
              value={kickoff}
              onChange={(e) => onKickoffChange(e.target.value)}
              rows={3}
              placeholder="Describe the task for this run…"
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          {/* WFIN-01 (D-LOCK-02): a quiet, self-start template upload. The button STAGES
              the picked File in modal state (no thread exists yet — doRun uploads it to
              the launched thread, Landmine 8). Idle → validated-file card ({name} ✓ ✕)
              OR the inline 422 error (server message verbatim, role="alert"). Beneath it,
              the honest provenance note. */}
          {/* Phase 193-07 (AUTH-03 / D-17 / D-18 / D-19 / D-20) — WHO SEES THIS BLOCK, AND WHY
              THE ERROR NODE IS NOT GATED WITH IT.

              ⚠ `launchError` IS NOT TEMPLATE-ONLY. `handleRun`'s catch (`:198`) sets it on ANY
              `onRun` rejection — a scope failure, a network failure, a thread-creation failure —
              and the comment beside its state declaration describes the upload 422 only because
              that is its COMMONEST cause. Reading that comment as the whole story is the trap.
              Leaving `run-upload-error` inside the wrapper D-17 removes would make LAUNCH
              FAILURES SILENT on every non-template workflow: the run simply would not start and
              the modal would say nothing. That is the WR-03 class of defect Phase 192's gap round
              already had to repair on this same surface, and it is recorded in 193-CONTEXT.md as
              one of two inherited claims research measured FALSE.

              So the cut goes AROUND the error node, not through it: `showTemplate` gates the
              label, the hidden input, the staged-file card / upload button and the provenance
              line — and NOTHING else. The error `<p>` is gated by `launchError` ALONE. The outer
              disjunction only decides whether this wrapper has a reason to exist at all (an
              always-rendered empty `<div>` would still cost a `gap-3` row of whitespace on a row
              whose control is supposed to be ABSENT); it can only ever ADD the error node's home,
              never take it away, because `launchError` alone is sufficient for it. `193-01`
              captured the non-admitting launch-failure case BEFORE this cut existed, precisely so
              a naive wrapping would red a test that predates it.

              ⚠ THE INDENTATION INSIDE THESE GATES IS DELIBERATELY LEFT AT ITS PRE-193 DEPTH.
              Re-indenting would put D-19's security sentence into this commit's diff, and the
              claim "the provenance line was not touched" is worth being able to CHECK
              mechanically — grep this file's own `git diff -U0` for the provenance sentence's
              opening words and expect zero hits — rather than eyeball. That check is a RAW
              substring match, so prose that merely SPELLS the sentence trips it; this paragraph
              deliberately does not (the same discipline `librarySubtree.fences.test.ts`'s
              T-192-04 note keeps about the prop IT forbids). Please do not tidy the indentation. */}
          {(showTemplate || launchError) && (
          <div className="flex flex-col gap-1.5">
            {showTemplate && (
            <>
            {/* D-18: the naming half of AUTH-03. A TEXT NODE, never a `<label htmlFor>` — the
                input below is `className="hidden" tabIndex={-1}`, and a label bound to a control
                that cannot be focused is a promise the DOM does not keep (RESEARCH §C.3). The
                string is imported from ./libraryVocabulary, never spelled here. */}
            <p
              data-testid="run-template-label"
              className="px-0.5 text-[13px] font-medium text-foreground"
            >
              {RUN_TEMPLATE_LABEL}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp"
              aria-label="Upload template file"
              tabIndex={-1}
              className="hidden"
              onChange={onFilePicked}
            />
            {templateFile ? (
              <div
                data-testid="run-template-file"
                className="flex items-center gap-2 self-start rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[12px]"
              >
                <span className="text-foreground">{templateFile.name}</span>
                <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <button
                  type="button"
                  aria-label="Remove template"
                  disabled={submitting}
                  onClick={() => {
                    setTemplateFile(null)
                    setLaunchError(null)
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="run-template-upload"
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5",
                  "text-[12px] font-medium text-foreground/80 transition-colors",
                  "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {submitting ? "Uploading…" : "Upload template"}
              </button>
            )}
            </>
            )}
            {launchError && (
              <p data-testid="run-upload-error" role="alert" className="px-0.5 text-[11px] text-destructive">
                {launchError}
              </p>
            )}
            {/* D-19: BYTE-EXACT, and moved not one character. This is Phase 152's threat-modelled
                SSTI honesty — a `template_input` file is NEVER routed to the Jinja engine — and
                rewording it to read better under D-18's new label was OFFERED AND REJECTED:
                rewording a security claim to improve its cadence is how such claims quietly
                weaken. It travels WITH the control (where there is no upload there is nothing to
                describe), which is why it sits inside the same gate. */}
            {showTemplate && (
            <p data-testid="run-provenance" className="px-0.5 text-[12px] text-muted-foreground">
              Stored untrusted — never run as code, never fed to the fill engine.
            </p>
            )}
          </div>
          )}
          {/* ── THE SHEET'S INFO GROUP — TWO ⓘ LINES, AT THE FOOT OF THE BODY ──────────
              The sheet gathers everything the dialog says ABOUT the run (as opposed to
              everything it ASKS) into one `gap-sm` stack of `info`-glyph lines, below the
              fields and ABOVE the footer. The shipped surface had one of them here and the
              other stranded inside the footer bar beside the buttons, which is why the
              footer read as two unrelated things sharing a row.

              ⚠ THE DESTINATION SENTENCE MOVED HOUSE AND NOTHING ELSE. Its `data-testid`,
              its gate (`canvasEnabled` — the SAME gate `doRun` reads, F4) and both of its
              two verbatim arms travel unchanged; `RUN_DESTINATION_BASELINE` in
              `RunModal.test.tsx` reads its `innerHTML` and is untouched by this port,
              which is the mechanical proof that only the container changed.

              ⚠ THE REFUSAL BELOW WAS BUILT ON A PREMISE THAT IS MEASURABLY FALSE, AND THE
              ORIGINAL IS KEPT VERBATIM RATHER THAN DELETED — a refusal that turns out to be
              wrong is evidence about how this surface was reasoned about, and quietly
              removing it would erase the only record that the gap was ever mis-stated.

              ── AS SHIPPED (200-WIRE corrects the second sentence, not the verdict) ──
              > ⚠ AND THE SHEET'S OWN WORDING FOR THE FIRST LINE IS REFUSED, ON PURPOSE.
              > It draws *"This workflow needs a starting instruction."* — a humanised
              > reading of the declared entry keys. There is no authored per-key label
              > anywhere on the wire (`entryInputKeys` returns the raw JSONB key strings), so
              > rendering that sentence would mean INVENTING the label for every key that is
              > not `kickoff_prompt`. The keys render as the facts they are.

              ⚠ *"There is no authored per-key label anywhere on the wire"* IS WRONG.
              `InputFieldSpec.label` is a REQUIRED `str` on the backend model
              (`backend/app/models/harness.py:504`) and it travels to this client inside
              `WorkflowDefinition.inputs` (`:532`). What was actually true is narrower and
              lived one file away: the FRONTEND READ-SHAPE threw the label away —
              `soulData.ts` declared `inputs?: Array<{ key?: string }>`, with no `label`
              member — so `entryInputKeys` never had one to return and the sentence above
              generalised a frontend omission into a claim about the wire.

              ── THE REAL, NARROWER GAP ──
              A definition that authors `inputs[]` HAS a label and this line now renders it.
              A definition that declares only the bare `PhaseSpecJSON.input_keys`
              (`backend/app/models/harness.py:73` — a plain `list[str]`) with no `inputs[]`
              carries NO label anywhere, on the wire or off it. That subset stays unlabelled
              and is OUT OF SCOPE: the key is the only true thing there is to print for it,
              and a friendly sentence would be an invented author's word.

              ⚠ THE SHEET'S EXACT SENTENCE IS STILL NOT RENDERED, for what is left of the
              original reason. *"This workflow needs a starting instruction."* is a claim
              about ONE specific key; the honest general form is the authored label the
              author actually wrote. The unlabelled arm below is CHARACTER-IDENTICAL to what
              shipped, which is what keeps `RunModal.test.tsx`'s six whole-`innerHTML`
              captures green without re-capturing them. */}
          {/* ── 214-09 (STEP-02 / D-214-04) — THE HINT LINE IS GONE, AND WHAT IT REFUSED IS
              NOW BUILT. The original stands ABOVE, verbatim, because a refusal whose
              CONDITION later came true is evidence about how this surface was reasoned
              about — the same rule the block above applies to its own predecessor.

              ── THE REFUSAL, AS SHIPPED (`:557-558`, deleted by this plan) ──
              > Declared input_keys → a HINT line only (never fake structured fields).
              > a `<p>` under the testid `run-hint`, reading "This workflow expects: …"
              (Its comment delimiters are dropped in the quote for the obvious reason, and the
              testid is named rather than SPELLED as an attribute — a `grep -c` fence on that
              attribute would otherwise count this paragraph and read the node as still shipping.
              Every word of the refusal sentence itself is verbatim.)

              Its reason was CONDITIONAL and its condition is now met. The condition was
              that **nothing guaranteed the value would be used**: a text box whose contents
              reached no adapter argument is a control that lies about what it does, and one
              hint line is more honest than six fields that go nowhere.

              **D-214-04 supplies the guarantee.** `MessageCreate.inputs` carries the dict
              (`214-16`), both kickoff merge sites spread it into `create_workflow_run.inputs`
              and into the live `ctx.inputs` mirror, and `_external_action_inputs`
              (`phase_types.py:1861`) is what an `ask`-sourced argument resolves out of by key
              (`214-01`). So the value is used, by name, and the refusal has run out.

              ⛔ WHERE THIS FILE'S CHAIN STOPS, STATED PLAINLY AND NOT CLAIMED AWAY. At THIS
              commit the values reach `onRun` → `WorkflowsPage`'s consumer → `onLaunch`'s
              third argument, and no further: `doRun` (`ChatLayout.tsx:711`) gains its
              `inputs` parameter in plan `214-12`. `postMessage`'s `inputs` option and the
              server merge already exist (`214-16`), so ONE hop is owed, and it is owed —
              not broken. Nothing here asserts that a run receives these values.

              ⚠ THE POINTER, 214-12. The FIELD MARKUP AND ITS TWO-ARM RULE HAVE MOVED to
              `@/components/workflows/LaunchInputFields`. Plan `214-09` named that seam and
              deliberately left it — *an extraction with one consumer is not an extraction* —
              and named THIS plan as its re-open trigger; chat became the second consumer, so
              the extraction was taken. The two-arm rule, the *"absence renders the KEY"*
              sentence and the *"must be `launchInputFields`, never `entryInputFields`"*
              warning all travelled WITH the code, because a rule separated from what it
              governs is a rule nobody applies. Read them there, not here.

              ⚠ NO REQUIRED-NESS IS VALIDATED HERE, deliberately. The publish gate (`214-05`)
              already refuses a workflow whose `ask` key is undeclared; a launcher that
              blocked on an empty optional field would refuse a run the system can perform.
              An empty field sends an empty string and the executor's schema is the arbiter.

              ⚠ IT SITS WITH THE FIELDS, NOT IN THE INFO GROUP BELOW. That group is what the
              dialog SAYS about the run; this is what it ASKS. Putting a text box among the
              ⓘ lines would break the one composition rule this body has. THAT placement is
              this file's decision and stays here; only the markup left. */}
          <LaunchInputFields
            fields={launchFields}
            values={inputValues}
            onChange={(key, value) => setInputValues((prev) => ({ ...prev, [key]: value }))}
          />
          <div className="flex flex-col gap-2">
            {/* F4 (UAT 2026-08-05) — this line promised a destination the launch had stopped
                going to. 188-09 retargeted `doRun` to the run surface, and the modal still
                said "Run opens a new chat thread and streams there" right above the button.
                It is the LAST thing a person reads before committing, so it is the one place
                the surface cannot be vague about where they are about to land.

                It is NOT a flat string swap, because there are genuinely two destinations:
                CR-05 gated the retarget on the canvas flag, and with the flag OFF `doRun`
                still falls through to the shipped `selectThread` + chat path. So the copy
                reads the SAME gate the launch reads — one source, and it cannot drift from
                the behaviour by construction. */}
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <span data-testid="run-destination">
                {canvasEnabled ? (
                  <>
                    Run opens this workflow&apos;s <b className="text-foreground">run surface</b>. The
                    chat thread is still created, and stays reachable from there.
                  </>
                ) : (
                  <>
                    Run opens a <b className="text-foreground">new chat thread</b> and streams there.
                  </>
                )}
              </span>
            </p>
          </div>
        </div>
        {/* The sheet's footer: a raised bar, `justify-end`, `gap-md`, two `h-10` controls
            and nothing else on the row. */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-10 rounded-md border border-border px-4 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          {/* D-103-1: Run stays ENABLED even on empty input; WR-05: disabled only
              while a launch is in flight (one click = one thread).

              ⚠ THE ▶ STAYS, THOUGH THE SHEET DRAWS THE LABEL BARE. It is the run VERB's
              mark, not a category glyph — the distinction 199-10 drew when it removed the
              header's `document` mark from this same file — and dropping it would be a
              subtraction the sheet does not ask for anywhere else in the journey. */}
          <button
            type="button"
            data-testid="run-confirm"
            disabled={submitting}
            onClick={() => void handleRun()}
            className="h-10 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Running…" : "▶ Run workflow"}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The props, DERIVED rather than re-declared.
 *
 * The move brought the inline props object over untouched, so writing a second, hand-typed
 * `RunModalProps` interface next to it would create exactly the drift an extraction is meant
 * to remove: two declarations of one contract, one of which nothing checks. `Parameters<…>[0]`
 * reads the surviving declaration, so the exported type is the component's real signature by
 * construction. Same idiom the shipped suites already use (`RunModal.test.tsx:360`).
 *
 * It is a TYPE export. Types are erased, so this does not put a runtime value in a component
 * module — see the docblock's `react-refresh/only-export-components` paragraph.
 */
export type RunModalProps = Parameters<typeof RunModal>[0]
