/**
 * Phase 273-02 (sketch 1B · UI-SPEC §ArtifactFrame) — the framed card, and the ONLY place the frame
 * markup lives. Header (title + kind chip), body slot, caption footer (label chip + icon + the
 * server-derived caption).
 *
 * No shadow, no gradient, no hover, no entrance animation (UI-D-09): live and reload must be
 * pixel-identical for G4-2's screenshot comparison. Title, chips and caption render as React TEXT —
 * never through a markdown renderer — because the title and caption values may come from retrieved
 * documents (T-273-09).
 */
import type { ReactNode } from "react"
import { FileText, Info } from "lucide-react"
import { CAPTION_SEGMENT_JOIN, kindChipLabelOf } from "./artifactCopy"
import type { ArtifactRecord } from "./artifactSpec"
import { captionSegments } from "./captionModel"

const CHIP =
  "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-muted px-2 text-xs leading-[1.4] text-muted-foreground"

export interface ArtifactFrameProps {
  record: ArtifactRecord
  children: ReactNode
}

export function ArtifactFrame({ record, children }: ArtifactFrameProps) {
  const titleId = `${record.id}-title`
  const caption = captionSegments(record)
  const Icon = caption.icon === "file" ? FileText : Info
  return (
    <figure
      data-testid="artifact-block"
      data-artifact-id={record.id}
      data-component={record.component}
      aria-labelledby={titleId}
      className="m-0 w-full overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex min-h-10 items-center gap-2 border-b border-border/55 px-4 py-2">
        <div
          id={titleId}
          className="line-clamp-2 min-w-0 flex-1 font-headline text-sm font-semibold leading-[1.4] text-foreground"
        >
          {record.spec.title}
        </div>
        <span data-testid="artifact-kind-chip" className={CHIP}>
          {kindChipLabelOf(record)}
        </span>
      </div>
      <div className="px-4 pb-2 pt-3">{children}</div>
      <figcaption
        data-testid="artifact-caption"
        className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-border/55 px-4 py-2 text-xs leading-[1.4] text-muted-foreground"
      >
        <span data-testid="artifact-label-chip" className={CHIP}>
          {record.label}
        </span>
        <Icon className="size-3 shrink-0" aria-hidden="true" data-icon={caption.icon} />
        <span>{caption.parts.join(CAPTION_SEGMENT_JOIN)}</span>
      </figcaption>
    </figure>
  )
}

/** The Suspense fallback body: the same 240px plot height, busy, with no shimmer and no text. */
export function ArtifactBusyBody() {
  return <div aria-busy="true" className="h-[240px]" />
}
