import { useRef, useState } from "react"
import { Lock, Upload, Cloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { ACCEPTED_FORMATS, acceptAttribute, formatsSentence } from "./acceptedFormats"

interface Props {
  onUpload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  uploading: boolean
  uploadingCount?: number
  folderId?: string | null
  folderName?: string | null
  disabled?: boolean
  /** The dropzone shape. "band" is the tight full-width strip (~82px); "hero" is the .dropbig panel. */
  variant?: "band" | "hero"
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
 * (`uploaded` / `already in your Library` / one line per error). That batching and its reporting
 * are UNCHANGED by this plan.
 *
 * ── Phase 217.1 plan 03 (D-217.1-05) — the hero variant ───────────────────────────────
 * `variant="hero"` renders the sketch's `.dropbig` shape: a cloud icon, `Drop files here`,
 * `or`, a `Choose files` button, and the accepted-formats line. The `accept` attribute and
 * the formats sentence are COMPUTED from `acceptedFormats.ts` in BOTH variants — never a
 * second transcription (T-217.1-08a). The hero mounts under the Ingestion tab's `Add files`
 * sub-tab, not on the Documents tab.
 */
export function DocumentUpload({
  onUpload,
  uploading,
  uploadingCount = 0,
  folderId,
  folderName,
  disabled = false,
  variant = "band",
}: Props) {
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

  const targetName = folderName ?? "Root"
  const targetLabel = `Upload to ${targetName}`

  // ── HERO VARIANT — the sketch's .dropbig shape ──────────────────────────────────
  if (variant === "hero") {
    return (
      <div className="flex w-full flex-col gap-2" data-testid="hero-dropzone">
        <button
          type="button"
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && !disabled && inputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label={disabled ? `Read-only folder ${targetName}` : "Choose files"}
          title={
            disabled
              ? "Only the folder owner can upload files here"
              : `${targetLabel} · drop files here or click to browse`
          }
          className={cn(
            // ⭐ SKETCH 231-A — ONE LINE, NOT A BAND. This was `px-8 py-10` with a stacked
            //    column inside, which spent a full screen band on one action and pushed the
            //    connected-source panel below the fold. The operator named it twice: "this drop
            //    file section is very big while it should… allow other functional parts to be
            //    more usable". Same affordances, one row.
            "w-full rounded-xl border border-dashed px-4 py-2.5 text-left transition-all duration-200",
            disabled
              ? "cursor-not-allowed border-muted-foreground/25 text-muted-foreground/60"
              : dragging
                ? "cursor-copy border-primary bg-primary/10 shadow-[0_0_30px_rgba(99,102,241,0.15)] ring-2 ring-primary/20 scale-[1.01]"
                : "cursor-pointer border-border/70 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm hover:border-primary/50 hover:bg-card/90 hover:shadow-md",
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
              <span className="mt-1 block text-xs text-muted-foreground">
                Into {targetName}
              </span>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Cloud className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">Drop files here</span>
              <span className="text-xs text-muted-foreground">or</span>
              <span
                className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
                data-testid="choose-files-button"
              >
                Choose files
              </span>
              {/* The formats are PRINTED from the same constant that feeds `accept` below —
                  never a hand-written list (D-217-18). ⚠ Pushed right rather than dropped: the
                  sentence is a contract with `acceptedFormats.ts`, not decoration. */}
              <span className="ml-auto truncate text-[11px] text-muted-foreground">
                {formatsSentence()}
              </span>
            </div>
          )}
        </button>

        {result && !uploading && (
          <div className="text-center">
            {(result.uploaded > 0 || result.duplicates > 0) && (
              <p
                className={
                  result.uploaded === 0
                    ? "text-xs font-medium text-foreground"
                    : "text-xs text-muted-foreground"
                }
              >
                {[
                  result.uploaded > 0 && `${result.uploaded} uploaded`,
                  result.duplicates > 0 &&
                    `${result.duplicates} already in your Library — nothing to upload`,
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
          accept={acceptAttribute()}
          data-accepted-count={ACCEPTED_FORMATS.extensions.length}
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    )
  }

  // ── BAND VARIANT — the tight full-width strip ───────────────────────────────────
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
          "w-full rounded-xl border border-dashed px-6 py-5 text-center transition-all duration-200 shadow-sm",
          disabled
            ? "cursor-not-allowed border-muted-foreground/25 text-muted-foreground/60"
            : dragging
              ? "cursor-copy border-primary bg-primary/10 shadow-[0_0_24px_rgba(99,102,241,0.15)] ring-2 ring-primary/20"
              : "cursor-pointer border-border/70 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm hover:border-primary/50 hover:bg-card/90 hover:shadow-md",
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
              <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <Upload className="h-3 w-3 shrink-0" aria-hidden="true" />
              </div>
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
            <p
              className={
                result.uploaded === 0
                  ? "text-xs font-medium text-foreground"
                  : "text-xs text-muted-foreground"
              }
            >
              {[
                result.uploaded > 0 && `${result.uploaded} uploaded`,
                result.duplicates > 0 &&
                  `${result.duplicates} already in your Library — nothing to upload`,
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