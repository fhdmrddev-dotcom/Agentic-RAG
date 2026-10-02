/**
 * Phase 270 (270-03) — the document download control: one component, two densities
 * (panel | row), five states, every state in VISIBLE words.
 *
 * D-06: a document with no stored file renders a dashed disabled control plus its reason (dashed, not faded).
 * D-07: the label and the request come from `@/lib/documentDownload` — never derived here.
 * D-08: weight is 600 (panel) / 400 (row); never 500. OV-266-01: no word is carried only by a title attribute.
 *
 * ⚠ No href anywhere: the signed URL is a bearer token and must never sit in the DOM. The panel mounts this
 * with `key={doc.id}`, so a document change resets the state machine (a persisted error cannot leak across docs).
 */
import { useEffect, useId, useRef, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { downloadErrorCopy, downloadLabel, startDocumentDownload } from "@/lib/documentDownload"
import type { Document } from "@/types"

type Phase = "idle" | "preparing" | "started" | "error"

const RECEIPT_MS = 4000
const ROW_ERROR_MS = 6000

export function DocumentDownloadButton({
  doc,
  density,
}: {
  doc: Document
  density: "panel" | "row"
}) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorText, setErrorText] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reasonId = useId()

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const isPanel = density === "panel"
  const label = downloadLabel(doc)
  const notStored = !doc.file_path

  const base = isPanel
    ? "h-8 px-3 text-xs font-semibold border-[hsl(var(--panel-border))] bg-transparent text-foreground hover:border-primary/60 hover:text-primary focus-visible:ring-1 focus-visible:ring-ring [&_svg]:size-3.5"
    : "h-7 px-2 text-xs font-normal text-muted-foreground hover:text-primary [&_svg]:size-3.5"
  const coarse = "[@media(pointer:coarse)]:min-h-11"

  if (notStored) {
    const where = doc.source_connection_name
      ? doc.source_connection_name
      : "a connected source"
    const reason = `File lives in ${where}, not stored here.`
    return (
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant={isPanel ? "outline" : "ghost"}
          disabled
          aria-describedby={isPanel ? reasonId : undefined}
          className={cn(
            base,
            coarse,
            "border-dashed disabled:opacity-100 cursor-not-allowed",
            isPanel ? "text-panel-muted-foreground" : "text-muted-foreground",
          )}
        >
          <Download aria-hidden="true" />
          {isPanel ? label : "Not stored here"}
        </Button>
        {isPanel && (
          <span id={reasonId} className="text-xs text-panel-muted-foreground">
            {reason}
          </span>
        )}
      </div>
    )
  }

  const onClick = () => {
    if (timer.current) clearTimeout(timer.current)
    setErrorText(null)
    setPhase("preparing")
    startDocumentDownload(doc).then(
      () => {
        if (isPanel) {
          setPhase("started")
          timer.current = setTimeout(() => setPhase("idle"), RECEIPT_MS)
        } else {
          setPhase("idle")
        }
      },
      (err: unknown) => {
        setErrorText(downloadErrorCopy(err))
        setPhase("error")
        // Panel errors persist until the next click; row errors fade.
        if (!isPanel) {
          timer.current = setTimeout(() => {
            setErrorText(null)
            setPhase("idle")
          }, ROW_ERROR_MS)
        }
      },
    )
  }

  const preparing = phase === "preparing"

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={isPanel ? "outline" : "ghost"}
        disabled={preparing}
        aria-busy={preparing ? "true" : undefined}
        aria-label={!isPanel && !preparing ? `${label} — ${doc.filename}` : undefined}
        onClick={onClick}
        className={cn(base, coarse)}
      >
        {preparing ? (
          <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {preparing ? (isPanel ? "Preparing download…" : "Preparing…") : label}
      </Button>
      {phase === "started" && (
        <span
          role="status"
          aria-live="polite"
          className="text-xs text-[hsl(var(--panel-status-done))] motion-safe:animate-fadeSlideUp"
        >
          Download started
        </span>
      )}
      {phase === "error" && errorText && (
        <span
          role="alert"
          className={cn("text-xs", isPanel ? "text-[hsl(0_80%_80%)]" : "text-destructive")}
        >
          {errorText}
        </span>
      )}
    </div>
  )
}
