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
import { Upload, Check, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { entryInputKeys, type DefShape } from "@/components/workflows/soulData"
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
   *  D-06). May reject (e.g. a template 422) → the modal renders the message inline. */
  onRun: (extras: { templateFile: File | null; folderId: string | null }) => void | Promise<void>
}) {
  const def = wf.definition as DefShape | undefined
  const keys = entryInputKeys(def)
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
    try {
      await onRun({ templateFile, folderId })
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
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span aria-hidden="true">📄</span>
          <span className="text-[15px] font-semibold text-foreground">{wf.name}</span>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          {/* WFIN-02 (D-LOCK-01): the KB-scope <select> — native, byte-matching the
              ChatArea scope selector ("All documents / {folder}"). The author default
              is tagged "workflow default"; picking another = a per-run override. Hidden
              when there are no folders (matches ChatArea's folders.length guard). */}
          {folders.length > 0 && (
            <label data-testid="run-scope" className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-foreground">Knowledge base:</span>
              <select
                data-testid="run-scope-select"
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            </label>
          )}
          <label className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-1.5">
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
            {launchError && (
              <p data-testid="run-upload-error" role="alert" className="px-0.5 text-[11px] text-destructive">
                {launchError}
              </p>
            )}
            <p data-testid="run-provenance" className="px-0.5 text-[12px] text-muted-foreground">
              Stored untrusted — never run as code, never fed to the fill engine.
            </p>
          </div>
          {/* Declared input_keys → a HINT line only (never fake structured fields). */}
          <p data-testid="run-hint" className="text-[12px] text-muted-foreground">
            This workflow expects: <span className="font-mono text-foreground">{keys.join(", ")}</span>
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
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
          <span className="text-[12px] text-muted-foreground" data-testid="run-destination">
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            {/* D-103-1: Run stays ENABLED even on empty input; WR-05: disabled only
                while a launch is in flight (one click = one thread). */}
            <button
              type="button"
              data-testid="run-confirm"
              disabled={submitting}
              onClick={() => void handleRun()}
              className="rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Running…" : "▶ Run workflow"}
            </button>
          </div>
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
