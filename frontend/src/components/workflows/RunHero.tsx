/**
 * Phase 200.2 (RUN-05 / SC1 / D-01 / D-02 / D-03 / D-04 / D-13 / D-14 / D-15 / D-16 / D-17 / A-07 / R-4)
 *
 * THE RUN DELIVERABLE HERO — Option C / Option B hero card leading the centre column.
 *
 * Re-presents the four deliverable arms (file / answer / both / neither) at the TOP of the
 * centre column above the process trace.
 *
 * ── INVARIANTS ──────────────────────────────────────────────────────────────────────────
 *  1. ZERO HERO WHILE LIVE (D-03) — live runs render nothing in this slot.
 *  2. D-16 TOTALITY — the empty-hero switch is total over every terminal run status.
 *  3. A-07 TYPED HEADINGS — headings are chosen by deliverable kind.
 *  4. R-4 NO ACCENT BACKGROUND — neutral card styling.
 *  5. D-15 NEWEST FILE IN HERO — with multiple files, the first leads and remainder lists below.
 *  6. ZERO GLYPH IMPORTS — zero lucide icons.
 */
import type { WorkspaceFile } from "@/types"
import type { WorkflowRunPhase, WorkflowRunRead } from "@/lib/api"
import { FileRow } from "@/components/files/FileRow"
import { baseName, fileAgeLabel, formatBytes } from "@/components/files/fileRowUtils"
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer"
import { fmtElapsed } from "@/lib/fmtElapsed"
import { runSpan } from "@/components/workflows/phaseDuration"
import { HEADER_SPAN_NOT_RECORDED, headerSpan } from "@/components/workflows/receiptVocabulary"
import {
  HERO_EMPTY_CANCELLED,
  HERO_EMPTY_COMPLETED,
  HERO_EMPTY_FAILED_GENERIC,
  HERO_EMPTY_UNKNOWN,
  HERO_HEADING_ANSWER,
  HERO_HEADING_BOTH,
  HERO_HEADING_FILE,
  HERO_HEADING_FILES,
  HERO_LANDMARK,
  heroEmptyFailedStep,
} from "@/components/workflows/runColumnVocabulary"

export interface RunHeroProps {
  run: WorkflowRunRead
  answer: string | null
  files: WorkspaceFile[]
  filesLoading: boolean
  isTerminal: boolean
  failedStepTitle: string | null
  onDownload: (file: WorkspaceFile) => void
  titleOf: (slug: string) => string
  now?: number
}

function resolveEmptySentence(
  status: string,
  failedStepTitle: string | null,
  phases: readonly WorkflowRunPhase[],
  titleOf: (slug: string) => string,
  metadata?: Record<string, any> | null,
): string {
  switch (status) {
    case "completed":
      return HERO_EMPTY_COMPLETED
    case "failed": {
      if (failedStepTitle) {
        return heroEmptyFailedStep(failedStepTitle)
      }
      const firstFailed = phases.find((p) => p.status === "failed")
      if (firstFailed) {
        return heroEmptyFailedStep(titleOf(firstFailed.slug))
      }
      return HERO_EMPTY_FAILED_GENERIC
    }
    case "cancelled": {
      const cb = metadata?.circuit_breaker
      if (cb && typeof cb === "object") {
        if (cb.reason === "token_budget_exceeded") {
          const used = Number(cb.cumulative_tokens ?? 0).toLocaleString()
          const max = Number(cb.max_tokens ?? 0).toLocaleString()
          return `Stopped: Token budget exceeded (used ${used} of ${max} tokens).`
        }
        if (cb.reason === "duration_budget_exceeded") {
          const elapsed = cb.elapsed_seconds ?? 0
          const maxDur = cb.max_duration_seconds ?? 0
          return `Stopped: Duration limit exceeded (${elapsed}s of ${maxDur}s).`
        }
      }
      return HERO_EMPTY_CANCELLED
    }
    case "timed_out":
      return HERO_EMPTY_FAILED_GENERIC
    default: {
      const _exhaustive: never = status as never
      void _exhaustive
      return HERO_EMPTY_UNKNOWN
    }
  }
}

export function RunHero({
  run,
  answer,
  files,
  filesLoading,
  isTerminal,
  failedStepTitle,
  onDownload,
  titleOf,
  now = Date.now(),
}: RunHeroProps) {
  // D-03: While the run is LIVE, render nothing in the hero slot
  if (!isTerminal || filesLoading) {
    return null
  }

  const hasFiles = files.length > 0
  const hasAnswer = Boolean(answer && answer.trim().length > 0)
  const span = runSpan(run.phases)
  const durationText = span
    ? headerSpan(fmtElapsed(span.ms))
    : HEADER_SPAN_NOT_RECORDED

  // Arm 4: Neither (Empty terminal state)
  if (!hasFiles && !hasAnswer) {
    const emptySentence = resolveEmptySentence(
      run.status,
      failedStepTitle,
      run.phases,
      titleOf,
      run.metadata,
    )

    return (
      <section
        aria-label={HERO_LANDMARK}
        className="rounded-xl border border-border/50 bg-card/40 p-6 flex flex-col gap-2"
      >
        <div className="text-xs text-muted-foreground">{durationText}</div>
        <p className="text-sm text-muted-foreground/90">{emptySentence}</p>
      </section>
    )
  }

  // Determine typed heading per A-07
  let headingText: string
  if (hasFiles && hasAnswer) {
    headingText = HERO_HEADING_BOTH
  } else if (hasFiles) {
    headingText = files.length === 1 ? HERO_HEADING_FILE : HERO_HEADING_FILES
  } else {
    headingText = HERO_HEADING_ANSWER
  }

  const newestFile = files[0]
  const remainderFiles = files.slice(1)

  return (
    <section
      aria-label={HERO_LANDMARK}
      className="rounded-xl border border-border/50 bg-card/40 p-6 flex flex-col gap-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground">{durationText}</div>
        <h2 className="text-xl font-semibold text-foreground tracking-tight">{headingText}</h2>
      </div>

      {hasFiles && newestFile && (
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-border/40 bg-muted/20 p-2">
            {newestFile.id ? (
              <FileRow
                asChild
                density="run"
                name={baseName(newestFile.path)}
                mimeType={newestFile.mime_type}
                sizeBytes={newestFile.size_bytes}
                age={fileAgeLabel(newestFile.created_at, now)}
                trailing="download"
              >
                <button
                  type="button"
                  onClick={() => onDownload(newestFile)}
                  title={newestFile.path}
                  aria-label={`Download ${baseName(newestFile.path)} (${formatBytes(newestFile.size_bytes)})`}
                  className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </FileRow>
            ) : (
              <FileRow
                asChild
                density="run"
                name={baseName(newestFile.path)}
                mimeType={newestFile.mime_type}
                sizeBytes={newestFile.size_bytes}
                age={fileAgeLabel(newestFile.created_at, now)}
                trailing="dead"
              >
                <div
                  title={newestFile.path}
                  className="w-full rounded-md px-2 py-2 text-left"
                />
              </FileRow>
            )}
          </div>

          {remainderFiles.length > 0 && (
            <ul className="flex flex-col gap-1 pl-2">
              {remainderFiles.map((file) => {
                const name = baseName(file.path)
                const size = formatBytes(file.size_bytes)
                return (
                  <li key={file.id ?? file.path}>
                    {file.id ? (
                      <FileRow
                        asChild
                        density="run"
                        name={name}
                        mimeType={file.mime_type}
                        sizeBytes={file.size_bytes}
                        age={fileAgeLabel(file.created_at, now)}
                        trailing="download"
                      >
                        <button
                          type="button"
                          onClick={() => onDownload(file)}
                          title={file.path}
                          aria-label={`Download ${name} (${size})`}
                          className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </FileRow>
                    ) : (
                      <FileRow
                        asChild
                        density="run"
                        name={name}
                        mimeType={file.mime_type}
                        sizeBytes={file.size_bytes}
                        age={fileAgeLabel(file.created_at, now)}
                        trailing="dead"
                      >
                        <div title={file.path} className="w-full rounded-md px-2 py-2 text-left" />
                      </FileRow>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {hasAnswer && answer && (
        <div
          data-testid="run-deliverable-answer"
          className="border-l-2 border-border/60 pl-4 py-1 text-sm text-foreground/90 leading-relaxed"
        >
          <MarkdownRenderer content={answer} className="max-w-[72ch] break-words" />
        </div>
      )}
    </section>
  )
}
