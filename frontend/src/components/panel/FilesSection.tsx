/**
 * Phase 087 Plan 03 Task 3 — FilesSection (PANEL-03).
 *
 * The Files section body: a keyboard-operable list of the thread's workspace
 * files (icon + mono filename + `formatBytes · v{version}` meta), with a green
 * flash on a freshly-written file. Clicking (or Enter/Space on) a row
 * full-replaces the list with <FilePreview> (sketch 005 winner A / file-browser-
 * and-diff.md D1); the `‹ Files` back button (in FilePreview) returns to the
 * list AND focus is restored to the originating row.
 *
 * Data: useWorkspaceFiles(threadId) + useViewingThread() (Phase 086 reactive
 * hooks — `data` is never undefined, empty array is a stable ref). No refresh.
 *
 * A11Y (A11Y-02 / UI-SPEC): role=listbox + role=option rows, roving tabindex,
 * ArrowUp/Down navigation, Enter/Space opens, no mouse-only path. The flash
 * respects prefers-reduced-motion (handled in index.css .animate-fileFlash).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * PHASE 195 PLAN 05 — THE PRESENTATION MOVED OUT; THE BEHAVIOUR DID NOT.
 *
 * ⚠ CORRECTION 1, recorded BESIDE the sentence it corrects rather than over it
 *   (this project's standing rule — `fileIcon.tsx:24-59`, `phaseGlyph.tsx:107-119`).
 *   The paragraph above reads, verbatim: *"icon + mono filename + `formatBytes ·
 *   v{version}` meta"*. Two thirds of that is still exactly true and one third is
 *   now imprecise:
 *     · the mono filename is unchanged — it is still the FULL PATH, `font-mono`,
 *       `text-[13px]`, and it is deliberately NOT a basename (the run page shows
 *       the basename; the two densities differ ON PURPOSE);
 *     · the meta string is byte-identical — `376 B · v2` still renders as ONE
 *       element, now assembled from the shared row's `sizeBytes` + `metaSuffix`
 *       instead of from a byte formatter this file used to carry itself;
 *     · the ICON is the part that changed. See CORRECTION 2.
 *
 * ⚠ CORRECTION 2 — THE GLYPH DELTA IS REAL, MEASURED, AND DELIBERATE.
 *   This section used to carry its own mime-first ext→glyph map. It is gone, and
 *   the one shared icon module (`@/lib/fileIcon`, D-07) resolves every row now —
 *   that is the "exactly ONE icon path" half of Phase 195's SC#2. The shared
 *   module's glyphs differ from the deleted local map on four categories. Same
 *   category, different lucide glyph, VISIBLE to a user:
 *       tables    FileSpreadsheet → Table       (`lucide-table`)
 *       code      FileCode        → Code        (`lucide-code`)
 *       images    FileImage       → Image       (`lucide-image`)
 *       unknown   File            → FileText    (`lucide-file-text`)
 *   The docx/pptx/xlsx glyphs are UNCHANGED, which is why the four shipped
 *   template cases stayed green through the conversion. The xlsx delta is pinned
 *   by its own case in the suite so a future reader can tell a deliberate change
 *   from a regression.
 *
 *   ⚠ MIME-FIRST RESOLUTION SURVIVED, and it survives only because every row
 *   passes `mimeType={file.mime_type}`. A workspace file can arrive with a
 *   meaningful mime and NO usable extension; drop that prop and those rows fall
 *   silently to the extension default. That is what the two mime cases in the
 *   suite exist to catch.
 *
 * WHAT STAYED HERE, mechanically and on purpose (the F2 boundary): the viewed-
 * thread read and `useWorkspaceFiles`, the `role="listbox"` wrapper and the
 * `role="option"` rows, `rowRefs` + the roving `tabIndex` + the ArrowUp/Down/
 * Enter/Space handler, the click/keyboard PREVIEW ACTIVATION and its focus
 * restore, the fresh-write flash, `<TemplateUpload/>`, the empty state, and the
 * Template badge + expiry caption (now handed to the row as `trailingSlot`,
 * markup unchanged). The shared row is pure presentation: it never reads a hook,
 * never names the previewer and performs no activation of its own.
 *
 * ⚠ THE `ref` CALLBACK ON THE ROW CHILD IS LOAD-BEARING, NOT HOUSE STYLE. It
 *   feeds `rowRefs`, which drives arrow-key roving focus. A shared row that
 *   swallowed the ref would stop ArrowDown moving focus — silently, and only for
 *   keyboard users. Nothing in the tree tested that before Phase 195; the suite
 *   now does, and the case was proved able to fail.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { FileRow } from "@/components/files/FileRow"
import { fileAgeLabel } from "@/components/files/fileRowUtils"
import {
  useWorkspaceFiles,
  useViewingThread,
} from "@/providers/StreamsProvider"
import type { WorkspaceFile } from "@/types"
import { FilePreview } from "./FilePreview"
import { TemplateUpload } from "./TemplateUpload"

/**
 * ⚠ PHASE 199 PLAN 07 (sheet `c8-run-panel`) — THE HONESTY FIX, AND ITS THREE
 * READINGS. Sketch 178's whole one-line finding for this sheet is:
 *
 *     "The run panel keeps discipline at 380px, and an unknown file time
 *      SAYS SO instead of blanking."
 *
 * This function used to return `null` for an absent `expires_at`, and its comment
 * said that arm was *"agent file → no badge (D-11)"*. **MEASURED, THAT COMMENT
 * NAMES A CALLER THAT CANNOT REACH IT.** The caption is rendered only inside the
 * `isTemplate` branch below, and an agent file is not a template — it renders no
 * trailing slot at all. So the ONLY row that ever took the `null` arm was a
 * TEMPLATE whose `expires_at` the wire did not carry, and what it rendered was an
 * EMPTY `<span>` beside a "Template" badge: a blank where a time belongs.
 *
 * ⚠ THREE READINGS, NOT TWO — the same discipline the library card had to learn:
 *     ABSENT       the wire did not say  → `expiry unknown`   (this fix)
 *     KNOWN-PAST   it has run out        → `expired`
 *     KNOWN-FUTURE it runs out at T      → `expires in 3h` / `expires in 30m`
 *   plus a fourth, structural, reading OUTSIDE this function: a NON-TEMPLATE row
 *   renders no caption at all, because there is nothing to say about it.
 *
 * ⚠ THE WORD IS `expiry unknown`, NEVER `no expiry`. "No expiry" is a KNOWN-NONE —
 *   a claim that this template never expires — and it is a claim nobody made. The
 *   sheet draws `--:--`; that is a machine token, and this row is prose already
 *   ("expires in 3h"), so the sentence keeps the sentence's voice.
 *
 * ⚠ AND IT IS NOT AMBER. `isNearExpiry` stays FALSE for an absent value, so the
 *   unknown reading paints in the calm muted token: unknown is not urgent, and
 *   painting it amber would manufacture an alarm out of a missing field.
 *
 * The return type is now TOTAL (`string`, never `null`) — which is what makes the
 * blank unrepresentable rather than merely unlikely.
 */
const EXPIRY_UNKNOWN = "expiry unknown"

// ── Ephemeral-template expiry helpers (D-02) — compute on render from
//    expires_at; NO per-second timer (Anti-Pattern). An agent file renders no
//    trailing slot at all, so it is byte-identical either way (D-11). ──
function expiryCaption(expiresAt?: string): string {
  if (!expiresAt) return EXPIRY_UNKNOWN  // the wire did not say — say THAT
  const at = new Date(expiresAt).getTime()
  // 199 CR WR-02 — an UNPARSEABLE date is a third case, and totality over `string` did not
  // make it go away. `NaN <= 0` is FALSE, so it fell past the expired arm, `Math.floor(NaN)`
  // stayed NaN, and the caption rendered "expires in NaNm" — painted calm-muted, because
  // isNearExpiry's comparison is false for NaN too. That is a WORSE lie than the blank this
  // function replaced: a blank says nothing, NaN asserts a countdown that does not exist.
  // An unreadable value is not-known, which is exactly what EXPIRY_UNKNOWN already says.
  if (Number.isNaN(at)) return EXPIRY_UNKNOWN
  const ms = at - Date.now()
  if (ms <= 0) return "expired"
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `expires in ${h}h`
  return `expires in ${Math.max(1, Math.floor(ms / 60_000))}m`
}

function isNearExpiry(expiresAt?: string): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() - Date.now() < 3_600_000  // < 1h
}

/** Stable identity for a file row (id when present, else path). */
function fileKey(f: WorkspaceFile): string {
  return f.id ?? f.path
}

export interface FilesSectionProps {
  /** Phase 087-02: lift the opened file to WorkspacePanel so the Versions
   *  section can compare its versions (the file is never orphaned). Optional —
   *  FilesSection works standalone (its own drill-in preview) without it. */
  onSelectFile?: (file: WorkspaceFile) => void
}

export function FilesSection({ onSelectFile }: FilesSectionProps = {}) {
  const threadId = useViewingThread()
  const { data: files } = useWorkspaceFiles(threadId)

  const [selected, setSelected] = useState<WorkspaceFile | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  // The row to restore focus to after returning from a preview (D1 / A11Y).
  const lastOpenedKey = useRef<string | null>(null)

  // ── Fresh-write flash: remember which file key most recently changed
  //    (new key OR bumped version) so its row gets the green fileFlash. ──
  const prevVersions = useRef<Map<string, number>>(new Map())
  const [flashKey, setFlashKey] = useState<string | null>(null)

  useEffect(() => {
    let freshKey: string | null = null
    for (const f of files) {
      const key = fileKey(f)
      const ver = f.version ?? 0
      const prev = prevVersions.current.get(key)
      if (prev === undefined || ver > prev) {
        // a brand-new file or a version bump → candidate for the flash
        if (prevVersions.current.size > 0 || prev !== undefined) freshKey = key
      }
    }
    // sync the version map for the next diff
    const next = new Map<string, number>()
    for (const f of files) next.set(fileKey(f), f.version ?? 0)
    prevVersions.current = next

    if (freshKey) {
      setFlashKey(freshKey)
      const t = setTimeout(() => setFlashKey(null), 1500)
      return () => clearTimeout(t)
    }
  }, [files])

  // Clamp the roving active index when the list shrinks.
  useEffect(() => {
    if (activeIndex > files.length - 1) {
      setActiveIndex(Math.max(0, files.length - 1))
    }
  }, [files.length, activeIndex])

  const openFile = (file: WorkspaceFile) => {
    lastOpenedKey.current = fileKey(file)
    setSelected(file)
    // Lift the opened file so the Versions section can compare it (087-02).
    onSelectFile?.(file)
  }

  const handleBack = () => {
    const key = lastOpenedKey.current
    setSelected(null)
    // restore focus to the originating row after the list re-mounts
    requestAnimationFrame(() => {
      if (key) rowRefs.current.get(key)?.focus()
    })
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number, file: WorkspaceFile) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault()
        openFile(file)
        break
      case "ArrowDown": {
        e.preventDefault()
        const next = Math.min(index + 1, files.length - 1)
        setActiveIndex(next)
        rowRefs.current.get(fileKey(files[next]))?.focus()
        break
      }
      case "ArrowUp": {
        e.preventDefault()
        const prev = Math.max(index - 1, 0)
        setActiveIndex(prev)
        rowRefs.current.get(fileKey(files[prev]))?.focus()
        break
      }
      default:
        break
    }
  }

  // ── Drill-in: full-replace the list with the preview (D1). ──
  if (selected && threadId) {
    return <FilePreview threadId={threadId} file={selected} onBack={handleBack} />
  }

  const rows = files
  // ONE instant for the whole list — see the `age` prop below and `fileAgeLabel`'s @param.
  // Deliberately not memoised: it must be re-read on every render.
  const rowsNow = Date.now()

  // ── Upload affordance (D-01): extracted to <TemplateUpload/> so the panel's
  //    no-activity empty state (WorkspacePanel) can render it too. Rendered in
  //    BOTH the empty state and the populated list. ──
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1 p-1">
        <TemplateUpload />
        <p className="px-2 py-3 text-[13px] text-panel-muted-foreground">No files yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 p-1">
      <TemplateUpload />
      <div role="listbox" aria-label="Workspace files" className="flex flex-col gap-0.5">
        {rows.map((file, index) => {
          const key = fileKey(file)
          const isActive = index === activeIndex
          const isTemplate = file.kind === "template_input"
          return (
            // Phase 195-05: the PRESENTATION is the shared row; the a11y root,
            // the activation and the skin stay here. `asChild` means the <div
            // role="option"> below IS the rendered element — the shared row does
            // not wrap it, so the listbox/option contract is untouched.
            // ⚠ The shared row's `panel` density carries LAYOUT ONLY
            // (`flex items-center gap-2`) because Radix `mergeProps` JOINS
            // `className` rather than twMerging it. Every class below is padding,
            // border, background, ring or animation — none competes with it.
            <FileRow
              key={key}
              asChild
              density="panel"
              name={file.path}
              // ⚠ Load-bearing: without it the mime-first branches disappear and
              // an extensionless file falls to the default glyph.
              mimeType={file.mime_type}
              sizeBytes={file.size_bytes}
              metaSuffix={file.version != null ? ` · v${file.version}` : undefined}
              // ⚠ Phase 200 — the row's age, from the list's ONE hoisted instant. An absent
              // `created_at` renders `time unknown` DIMMED rather than nothing, which is the
              // same honesty shape this file already keeps one field along for expiry: the
              // word is `expiry unknown`, never `no expiry`. And it is exactly the row that
              // needs it — a live SSE deliverable arrives with no instant at all, and
              // `byNewestFirst` sorts precisely that row to the TOP.
              age={fileAgeLabel(file.created_at, rowsNow)}
              trailing="none"
              trailingSlot={
                /* Ephemeral-template cue (D-02): "Template" badge + a live expiry
                   countdown caption (amber needs-attention when < 1h). Only for
                   kind='template_input' — an agent file renders byte-identically
                   (D-11). The caption recomputes on each natural panel re-render;
                   NO per-second timer (Anti-Pattern). Handed to the shared row as
                   its trailing slot, which renders BEFORE the size cell — the same
                   DOM order this markup shipped in. */
                isTemplate ? (
                  <span className="flex flex-shrink-0 items-center gap-1.5">
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent-foreground">
                      Template
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[10px]",
                        isNearExpiry(file.expires_at)
                          ? "text-amber-500"                       // needs-attention color (D-02)
                          : "text-panel-muted-foreground",
                      )}
                    >
                      {expiryCaption(file.expires_at)}
                    </span>
                  </span>
                ) : undefined
              }
            >
              <div
                ref={(el) => {
                  rowRefs.current.set(key, el)
                }}
                role="option"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => openFile(file)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(e) => onKeyDown(e, index, file)}
                className={cn(
                  "cursor-pointer rounded-md border border-transparent px-2.5 py-2 transition-colors",
                  "hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isActive && "ring-1 ring-ring",
                  flashKey === key && "animate-fileFlash",
                )}
              />
            </FileRow>
          )
        })}
      </div>
    </div>
  )
}

export default FilesSection
