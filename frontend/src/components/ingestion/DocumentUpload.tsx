import { useRef, useState } from "react"
import { Lock, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { ACCEPTED_FORMATS, acceptAttribute, formatsSentence } from "./acceptedFormats"

interface Props {
  onUpload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  uploading: boolean
  uploadingCount?: number
  folderId?: string | null
  folderName?: string | null
  disabled?: boolean
}

interface BatchResult {
  uploaded: number
  duplicates: number
  errors: string[]
}

/**
 * Phase 217-07 Task 2 (LIB-02 / SC#2 / D-217-17 / D-217-18 / D-217-19) — the front door.
 *
 * ── ⚠ THIS FILE DELIBERATELY REVERSES ITS OWN PRIOR DECISION, AND ANSWERS ITS OBJECTION ──
 * The version this replaces carried a comment explaining why the full-width block had been
 * shrunk to a corner button: the old block *"pushed the file list below the fold"*. That
 * objection was real and it is NOT waved away here — it is answered by SIZE. The old block
 * was a `p-10` hero; this is a BAND:
 *
 *     py-5 (20 + 20)  +  headline row 20  +  mt-1 4  +  sub-line 16  +  2 borders
 *     ≈ 82px, against ≈ 42px for the corner button it replaces — a delta of ~40px.
 *
 * Forty pixels does not move a list below any fold, and the operator's finding was that the
 * door could not be FOUND — *"I did not see for example where I can upload documents."* A
 * full-width band on the landing tab is findable; a 42px button in a header's right corner
 * is not. The sketch draws exactly this shape (its tight `.dropzone`, padding 26px, headline
 * + one dim format line), not its taller `.dropbig` hero.
 *
 * ── ONE COMPONENT, MOUNTED ONCE (D-217-17) ────────────────────────────────────────────
 * The dropzone, its `accept` attribute and the formats it PRINTS are all this component's,
 * and all three read `./acceptedFormats`. There is no second dropzone to drift from it.
 *
 * ── ⛔ NO PERCENTAGE AND NO ETA (D-217-19) ────────────────────────────────────────────
 * MEASURED, not preferred: `uploadDocument` is a plain `fetch` with `FormData` and there is
 * no `onUploadProgress` and no `XMLHttpRequest` anywhere on this path — so bytes-sent is not
 * observable and any percentage would be invented. The honest status is the one that ships:
 * *"Uploading N files…"* while in flight, then the `Promise.allSettled` batch result
 * (`uploaded` / `already up to date` / one line per error). That batching and its reporting
 * are UNCHANGED by this plan.
 *
 * ⚠ D-217-22 scopes the ban: it covers this upload path and the ingestion strip. Tab 4's
 * `ReembedStatusCard` keeps its determinate bar, because re-embed HAS an honest denominator
 * (total chunks). That card is not edited by anyone here.
 *
 * ── THE TARGET FOLDER IS NAMED, NEVER BLANK ───────────────────────────────────────────
 * The band prints the folder the file will land in, from the `folderName` prop it already
 * received, falling back to the named root the page's own header uses. It resolves no folder
 * and looks nothing up (T-217-25) — the name arrives as a prop from a list fetched under RLS.
 */
export function DocumentUpload({ onUpload, uploading, uploadingCount = 0, folderId, folderName, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)

  async function handleFiles(files: File[]) {
    if (!files.length || disabled) return
    setResult(null)

    const outcomes = await Promise.allSettled(files.map((f) => onUpload(f, folderId)))

    const batch: BatchResult = { uploaded: 0, duplicates: 0, errors: [] }
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") {
        if (outcome.value.isDuplicate) batch.duplicates++
        else batch.uploaded++
      } else {
        batch.errors.push(outcome.reason instanceof Error ? outcome.reason.message : "Upload failed")
      }
    }
    setResult(batch)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(Array.from(e.target.files || []))
    e.target.value = ""
  }

  const statusLabel =
    uploadingCount > 1
      ? `Uploading ${uploadingCount} files…`
      : uploading
        ? "Uploading…"
        : null

  // The named root, never a blank — `LibraryPage` heads the unfiled surface "Root" and the
  // band must agree with it rather than trail off after "into ".
  const targetName = folderName ?? "Root"
  const targetLabel = `Upload to ${targetName}`

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && !disabled && inputRef.current?.click()}
        disabled={disabled || uploading}
        aria-label={disabled ? `Read-only folder ${targetName}` : targetLabel}
        title={
          disabled
            ? "Only the folder owner can upload files here"
            : `${targetLabel} · drop files here or click to browse`
        }
        className={cn(
          // A BAND, not a hero panel (see the docblock's height arithmetic). Full width so
          // it is the first thing the eye lands on, ~82px tall so the list below it does not
          // move — which is the objection the corner button was created to answer.
          "w-full rounded-xl border border-dashed px-6 py-5 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-muted-foreground/25 text-muted-foreground/60"
            : dragging
              ? "cursor-copy border-primary bg-primary/10"
              : "cursor-pointer border-border bg-card/40 hover:border-primary/50 hover:bg-accent/40",
          uploading && "cursor-default opacity-70",
        )}
      >
        {disabled ? (
          <>
            <span className="flex items-center justify-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Read-only folder</span>
            </span>
            <span className="mt-1 block text-xs">
              Only the folder owner can upload files to {targetName}.
            </span>
          </>
        ) : uploading ? (
          <>
            <span className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>{statusLabel ?? "Uploading…"}</span>
            </span>
            {/* ⛔ D-217-19 — no percentage, no ETA. There is no denominator to divide by. */}
            <span className="mt-1 block text-xs text-muted-foreground">
              Into {targetName}
            </span>
          </>
        ) : (
          <>
            <span className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Drop files here, or choose them</span>
            </span>
            {/* The formats are PRINTED from the same constant that feeds `accept` below —
                never a hand-written list (D-217-18). */}
            <span className="mt-1 block text-xs text-muted-foreground">
              {formatsSentence()} — into{" "}
              <span className="font-medium text-foreground">{targetName}</span>
            </span>
          </>
        )}
      </button>

      {result && !uploading && (
        <div className="text-center">
          {(result.uploaded > 0 || result.duplicates > 0) && (
            <p className="text-xs text-muted-foreground">
              {[
                result.uploaded > 0 && `${result.uploaded} uploaded`,
                result.duplicates > 0 && `${result.duplicates} already up to date`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {result.errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">{err}</p>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        // ⚠ COMPUTED, never transcribed. The literal that used to live here is what
        // `acceptedFormats.ts` exists to delete.
        accept={acceptAttribute()}
        data-accepted-count={ACCEPTED_FORMATS.extensions.length}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  )
}
