/**
 * Phase 217 Plan 11 Task 2 — DocumentImagesSection (LIB-04 / D-217-01 / D-217-04).
 *
 * ⛔ THERE IS NO PICTURE HERE AND THERE NEVER CAN BE. `document_images` stores
 * `id, document_id, user_id, page, image_index, description, created_at, bbox, org_id`
 * and NO BYTES — the encoded PNG is handed to the vision model and discarded. So the
 * written description IS the image on this surface. This file draws no picture element,
 * no remote source, no scaled-down preview and no placeholder box implying one is coming:
 * every such affordance is a promise about a thing that does not exist. SC#4 asks for
 * image descriptions, and image descriptions are exactly what can ship.
 * ⚠ The three literals a fence looks for here are deliberately NOT spelled in this prose —
 * the fence greps the whole file and cannot tell a use from a mention (measured 217-10,
 * and hit again by this very paragraph's first draft).
 *
 * ⛔ Lazy by construction: the mount in `DocumentDetailPanel` is closed by default and
 * `PanelSection.tsx:94` renders children only when open, so the bare `useEffect` fetch
 * below costs nothing until the accordion is clicked.
 *
 * ⚠ Same owner-only RLS asymmetry as the tables section — migration `108:180-189` left
 * `document_images` owner-scoped while `110:215-223` widened `document_chunks`. A
 * document reached through someone else's globally-visible folder returns an empty list
 * here, and that is CORRECT: the `image_count` badge on that row is computed through the
 * same user-JWT client and already reads `0`. The copy says "No images", never
 * "You cannot see these".
 *
 * ⚠ UNTRUSTED, MODEL-AUTHORED TEXT. A description is what a vision model wrote about a
 * picture inside a file somebody uploaded (T-217-46). It renders as a React text child,
 * which escapes; the raw-HTML injection prop appears nowhere in this file and none may be
 * added. ⚠ Its name is deliberately not spelled here — a source fence greps this file for
 * the literal and cannot tell a use from a mention.
 */
import { useCallback, useEffect, useState } from "react"
import { listDocumentImages } from "@/lib/api"
import type { Document, DocumentImageRow } from "@/types"

export interface DocumentImagesSectionProps {
  /** The open document — the subject of the read. */
  docId: string
  /** The document row the panel already holds; only the applicability flag and the count
   *  are read, and only to choose WHICH empty sentence is true. */
  doc?: Pick<Document, "images_stage_applies" | "image_count">
  /** Lift the image count so the parent `PanelSection` can badge it. */
  onTotalChange?: (total: number) => void
}

type LoadState = "loading" | "ready" | "error"

/** Three empty claims, mirroring the tables section — three different facts, three
 *  sentences. */
export const IMAGES_EMPTY_NOT_APPLICABLE = "This file type has no images"
export const IMAGES_EMPTY_NONE_FOUND = "No images were described"
export const IMAGES_EMPTY_UNKNOWN = "No images"

/** An ABSENT flag is UNKNOWN, never `false` — it is server-derived and does not ride the
 *  Realtime payload, so a document inserted in another tab arrives without it. */
export function imagesEmptyMessage(doc?: Pick<Document, "images_stage_applies" | "image_count">): string {
  if (doc?.images_stage_applies === false && (doc.image_count ?? 0) === 0) {
    return IMAGES_EMPTY_NOT_APPLICABLE
  }
  if (doc?.images_stage_applies === true) return IMAGES_EMPTY_NONE_FOUND
  return IMAGES_EMPTY_UNKNOWN
}

export function DocumentImagesSection({ docId, doc, onTotalChange }: DocumentImagesSectionProps) {
  const [rows, setRows] = useState<DocumentImageRow[]>([])
  const [state, setState] = useState<LoadState>("loading")

  const load = useCallback(async () => {
    setState("loading")
    setRows([])
    try {
      const res = await listDocumentImages(docId)
      setRows(res)
      setState("ready")
      onTotalChange?.(res.length)
    } catch {
      setState("error")
    }
  }, [docId, onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-3 px-4 pt-1">
      {state === "loading" && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2 py-1">
          <span className="sr-only">Loading image descriptions</span>
          <div aria-hidden="true" className="h-10 w-full animate-pulse rounded-md bg-border/30" />
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2 py-1">
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            Couldn&rsquo;t load this document&rsquo;s image descriptions
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="self-start rounded-md text-xs text-panel-muted-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && rows.length === 0 && (
        <p className="py-1 text-sm text-panel-muted-foreground">{imagesEmptyMessage(doc)}</p>
      )}

      {state === "ready" && rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 rounded-md border border-border/40 bg-background/40 p-2"
            >
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.07em] text-panel-muted-foreground-dim">
                Figure {row.image_index + 1}
                {row.page != null && ` · page ${row.page}`}
              </div>
              {/* The description IS the image on this surface. A React text child. */}
              <p className="whitespace-pre-wrap break-words text-[0.78rem] leading-relaxed text-foreground">
                {row.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default DocumentImagesSection
