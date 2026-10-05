/**
 * Phase 273-02 (D-12 · sketch 4B · UI-SPEC §ArtifactNotice) — "This artifact can't be shown".
 *
 * The dashed note that takes an artifact's slot when it cannot render. It is also the fallback of
 * every per-artifact error boundary. The reason line comes ONLY from `noticeText` (the closed
 * catalogue) — ⛔ never JSON, markup, a spec key, a validation path, an exception message or a
 * stack trace (SC#2). It is neutral and dashed, never red: nothing destructive happened.
 */
import { Ban } from "lucide-react"
import { NOTICE_FOOTNOTE, NOTICE_TITLE, noticeText } from "./artifactCopy"
import type { NoticeContext, NoticeReason } from "./artifactSpec"

export interface ArtifactNoticeProps {
  reason: NoticeReason
  ctx?: NoticeContext
}

export function ArtifactNotice({ reason, ctx }: ArtifactNoticeProps) {
  return (
    <div
      role="note"
      data-testid="artifact-notice"
      data-reason={reason}
      className="rounded-xl border border-dashed border-muted-foreground/40 bg-card/60 px-4 py-3"
    >
      <div className="flex items-center gap-2 font-headline text-sm font-semibold leading-[1.4] text-foreground">
        <Ban className="size-4 text-muted-foreground" aria-hidden="true" />
        {NOTICE_TITLE}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{noticeText(reason, ctx)}</p>
      <p className="mt-2 text-xs leading-[1.4] text-muted-foreground">{NOTICE_FOOTNOTE}</p>
    </div>
  )
}
