/**
 * Phase 289-04 (VIS-03 / D-02 / D-03 / D-05 / D-10 / D-14a) — a FINISHED run's read-only
 * evidence record: sketch `289-run-evidence-page` variant B, "a report you can print".
 *
 * ── WHERE IT LIVES ──────────────────────────────────────────────────────────────────────
 * It is the finished state of `WorkflowRunPage`, reached by ONE early return there (D-02: one
 * page, one route, no second run page). An active or paused run never gets here (D-06).
 *
 * ── ONE SOURCE, THREE RENDERS (D-03) ────────────────────────────────────────────────────
 * The page renders `toEvidenceView(payload)`; Print is the page itself through the one
 * `@media print` block in `index.css` (keyed on the article's print-root attribute); Download JSON writes
 * `exportPayload(payload)`, which is the fetched payload unchanged. Its test asserts the
 * sections by CONTENT against the same view-model, so the export cannot drift from the page.
 *
 * ── READ-ONLY, FOR EVERY VIEWER (D-05) ──────────────────────────────────────────────────
 * No answer, cancel, retry or edit control is rendered for anyone. The owner additionally
 * gets "Open the chat thread" and the deliverable download; a colleague gets neither, and
 * never sees the owner's email or "(you)" — the server withholds those fields and the
 * view-model checks `viewer_is_owner` a second time.
 *
 * ── ONE REFUSAL SCREEN (D-05 / T-289-24) ────────────────────────────────────────────────
 * Every refusal is a 404 server-side, so "doesn't exist" and "not yours" render the same
 * words here. Any other failure is a worded retry, never the 404 words.
 *
 * Every word is in `evidenceVocabulary.ts`. No HTML is ever injected: every string from the
 * payload (names, filenames, outputs, the definition JSON) renders as React text.
 *
 * ⚠ It does not import the summary receipt component (that component's importer pin is exact,
 * and its needle is deliberately not spelled here — the 187-24 rule) and it imports its client
 * from its own specifier, never through `lib/api.ts`.
 */
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getRunEvidence, type RunEvidence } from "@/lib/api/runEvidence"
import { downloadWorkspaceFile } from "@/lib/api/documents"
import { clearRunDeepLink, writeRunDeepLink } from "@/lib/runDeepLink"
import { StepEvidenceLine } from "@/components/workflows/StepEvidenceLine"
import { exportPayload, toEvidenceView, type EvidenceView, type FactTone } from "@/components/workflows/evidenceView"
import {
  CHANGED_GLYPH,
  DOWNLOAD_DELIVERABLE,
  DOWNLOAD_DELIVERABLE_FAILED,
  DOWNLOAD_GLYPH,
  DOWNLOAD_JSON,
  FULL_DEFINITION_NOT_RECORDED,
  LOG_COL_N,
  LOG_COL_STATUS,
  LOG_COL_STEP,
  LOG_COL_TIME,
  NOT_AVAILABLE_BODY,
  NOT_AVAILABLE_HEAD,
  OPEN_THREAD,
  PRINT_GLYPH,
  PRINT_REPORT,
  READ_ONLY_GLYPH,
  READ_ONLY_MARK,
  REPORT_BACK,
  REPORT_BROKEN_BODY,
  REPORT_BROKEN_HEAD,
  REPORT_LOADING,
  REPORT_TRY_AGAIN,
  SECTION_CHECKS,
  SECTION_HAPPENED,
  SECTION_HAPPENED_LEDE,
  SECTION_RAN,
  SECTION_RAN_LEDE,
  SECTION_SOURCES,
  SECTION_SOURCES_LEDE,
  SHOW_FULL_DEFINITION,
  VERDICT_GLYPH,
  exportFileName,
} from "@/components/workflows/evidenceVocabulary"
import { own } from "@/components/workflows/ownProperty"

interface Props {
  /** The `workflow_runs.id` whose record to show. */
  runId: string
  /** Back to the Workflows library. */
  onBack: () => void
  /** Owner only, and only when the page can open a thread. Absent → no thread link. */
  onOpenThread?: (threadId: string) => void
}

type ReadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "broken" }
  | { kind: "ready"; payload: RunEvidence }

/** A local copy of the AuditTab blob-download idiom, for JSON. */
function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function statusOf(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "status" in err) {
    const s = (err as { status: unknown }).status
    return typeof s === "number" ? s : null
  }
  return null
}

const FACT_TONE: Record<FactTone, string> = {
  success: "text-[hsl(var(--success))]",
  danger: "text-[hsl(0_80%_80%)] print:text-[hsl(0_70%_40%)]",
  muted: "text-muted-foreground",
  plain: "text-foreground",
}

const STATUS_TONE: Record<string, string> = {
  completed: "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  failed: "border-destructive/40 bg-destructive/15 text-[hsl(0_80%_80%)] print:text-[hsl(0_70%_40%)]",
}
const STATUS_TONE_DEFAULT = "border-border text-muted-foreground"

const VERDICT_TONE: Record<string, string> = {
  passed: "text-[hsl(var(--success))]",
  failed: "text-[hsl(0_80%_80%)] print:text-[hsl(0_70%_40%)]",
  recorded: "text-muted-foreground",
}

const PILL = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px]"
const SECTION = "mt-7 break-inside-avoid-page"
const LEDE = "mb-2.5 text-xs text-muted-foreground"

function SectionHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-1 flex items-baseline gap-2 font-headline text-base font-semibold text-foreground">
      <span className="font-mono text-xs text-muted-foreground">{n}</span>
      {title}
    </h2>
  )
}

function Report({
  view,
  payload,
  onOpenThread,
}: {
  view: EvidenceView
  payload: RunEvidence
  onOpenThread?: (threadId: string) => void
}) {
  const [downloadFailed, setDownloadFailed] = useState(false)
  const links = view.ownerLinks
  const threadId = links?.threadId ?? null
  const deliverable = links?.deliverable ?? null

  const onDownloadDeliverable = () => {
    if (!deliverable || !threadId) return
    setDownloadFailed(false)
    downloadWorkspaceFile(threadId, deliverable.fileId, deliverable.name).catch(() => setDownloadFailed(true))
  }

  return (
    <article
      data-print-root
      data-testid="run-evidence-report"
      className="mx-auto w-full max-w-[860px] px-8 pb-12 pt-7 text-foreground"
    >
      {/* Title block: the read-only mark, the name, the sub line, the actions. */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <span className={cn(PILL, "border-border text-muted-foreground")}>
            <span aria-hidden="true">{READ_ONLY_GLYPH}</span>
            {READ_ONLY_MARK}
          </span>
          <h1 className="mt-2 break-words font-headline text-2xl font-semibold text-foreground">{view.title}</h1>
          <p data-testid="evidence-sub" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {view.outcome}
            {" · "}
            {view.startedBy}
            {view.email !== null ? (
              <>
                {" · "}
                <span className="font-mono text-[11px]">{view.email}</span>
              </>
            ) : null}
            {view.org !== null ? ` · ${view.org}` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadJson(exportFileName(view.runId), exportPayload(payload))}
          >
            <span aria-hidden="true">{DOWNLOAD_GLYPH}</span>
            {DOWNLOAD_JSON}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <span aria-hidden="true">{PRINT_GLYPH}</span>
            {PRINT_REPORT}
          </Button>
          {threadId !== null && onOpenThread ? (
            <Button variant="ghost" size="sm" onClick={() => onOpenThread(threadId)}>
              {OPEN_THREAD}
            </Button>
          ) : null}
          {deliverable !== null ? (
            <Button variant="ghost" size="sm" onClick={onDownloadDeliverable}>
              {DOWNLOAD_DELIVERABLE}
            </Button>
          ) : null}
        </div>
      </div>
      {downloadFailed ? (
        <p role="alert" className="mt-2 text-xs text-[hsl(0_80%_80%)] print:hidden">
          {DOWNLOAD_DELIVERABLE_FAILED}
        </p>
      ) : null}

      {/* Facts strip. */}
      <dl
        data-testid="evidence-facts"
        className="my-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border/60 bg-border/60 sm:grid-cols-4"
      >
        {view.facts.map((f) => (
          <div key={f.label} data-evidence-fact className="bg-card px-3 py-2.5">
            <dt data-fact-label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {f.label}
            </dt>
            <dd data-fact-value className={cn("mt-0.5 text-sm", FACT_TONE[f.tone])}>
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {view.changedBanner !== null ? (
        <div
          data-testid="evidence-changed"
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.12)] px-3 py-2.5 text-sm"
        >
          <span aria-hidden="true" className="text-[hsl(var(--warning))]">
            {CHANGED_GLYPH}
          </span>
          <p>
            <b className="text-[hsl(var(--warning))]">{view.changedBanner.head}</b> {view.changedBanner.body}
          </p>
        </div>
      ) : null}
      {view.predatesBanner !== null ? (
        <p
          data-testid="evidence-predates"
          role="note"
          className="mt-2 rounded-md border border-border/60 px-3 py-2.5 text-sm text-muted-foreground"
        >
          {view.predatesBanner}
        </p>
      ) : null}

      {/* 1 — What it ran. */}
      <section data-evidence-section="1" className={SECTION}>
        <SectionHeading n={1} title={SECTION_RAN} />
        <p className={LEDE}>{SECTION_RAN_LEDE}</p>
        <div className="rounded-md border border-border/60 px-3 py-2.5 text-sm">
          <p>{view.definition.heading}</p>
          <ol className="mt-1.5 list-decimal pl-5 text-sm leading-7 text-muted-foreground">
            {view.definition.steps.map((s, i) => (
              <li key={i} data-evidence-row>
                {s.title}
                {s.type ? <span className="ml-1.5 font-mono text-[10px]">{s.type}</span> : null}
              </li>
            ))}
          </ol>
          {view.definition.fullJson !== null ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-primary print:hidden">{SHOW_FULL_DEFINITION}</summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground print:max-h-none">
                {view.definition.fullJson}
              </pre>
            </details>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{FULL_DEFINITION_NOT_RECORDED}</p>
          )}
        </div>
      </section>

      {/* 2 — What happened, step by step. */}
      <section data-evidence-section="2" className={SECTION}>
        <SectionHeading n={2} title={SECTION_HAPPENED} />
        <p className={LEDE}>{SECTION_HAPPENED_LEDE}</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-2 py-1.5 font-medium">{LOG_COL_N}</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{LOG_COL_STEP}</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{LOG_COL_STATUS}</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{LOG_COL_TIME}</th>
            </tr>
          </thead>
          <tbody>
            {view.steps.map((r) => (
              <tr key={`${r.n}-${r.slug}`} data-evidence-row className="break-inside-avoid border-b border-border/50 align-top">
                <td className="px-2 py-2.5 font-mono text-muted-foreground">{r.n}</td>
                <td className="px-2 py-2.5">
                  <div className="font-semibold text-foreground">{r.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{r.typeLine}</div>
                  {r.output !== null ? (
                    <div className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">{r.output}</div>
                  ) : null}
                  {r.count !== null ? <div className="mt-0.5 text-xs text-muted-foreground">{r.count}</div> : null}
                  <StepEvidenceLine confidence={r.confidence} />
                  {r.humanInput !== null ? (
                    <div className="mt-1.5 border-l-2 border-border pl-2.5 text-sm">
                      {r.humanInput.map((line, i) => (
                        <div key={i} className={i === 0 ? undefined : "mt-0.5"}>
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {r.failure !== null ? (
                    <div className="mt-1 text-xs text-[hsl(0_80%_80%)] print:text-[hsl(0_70%_40%)]">{r.failure}</div>
                  ) : null}
                </td>
                <td className="px-2 py-2.5">
                  <span className={cn(PILL, own(STATUS_TONE, r.status) ?? STATUS_TONE_DEFAULT)}>{r.statusWord}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 font-mono text-[11px] text-muted-foreground">{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3 — Checks and verdicts. */}
      <section data-evidence-section="3" className={SECTION}>
        <SectionHeading n={3} title={SECTION_CHECKS} />
        {view.noVerdicts !== null ? (
          <p className="text-sm text-muted-foreground">{view.noVerdicts}</p>
        ) : (
          view.verdicts.map((v, i) => (
            <div
              key={i}
              data-evidence-row
              className="flex break-inside-avoid items-start gap-2.5 border-b border-border/50 py-2 text-sm"
            >
              <span aria-hidden="true" className={cn("w-3 font-bold", own(VERDICT_TONE, v.result))}>
                {own(VERDICT_GLYPH, v.result) ?? ""}
              </span>
              <div className="min-w-0 flex-1">
                {v.sentence}
                <div className="font-mono text-[10px] text-muted-foreground">{v.meta}</div>
              </div>
              <span className={cn(PILL, "border-current", own(VERDICT_TONE, v.result))}>{v.resultWord}</span>
            </div>
          ))
        )}
      </section>

      {/* 4 — Sources it used. */}
      <section data-evidence-section="4" className={SECTION}>
        <SectionHeading n={4} title={SECTION_SOURCES} />
        <p className={LEDE}>{SECTION_SOURCES_LEDE}</p>
        {view.noSources !== null ? (
          <p className="text-sm text-muted-foreground">{view.noSources}</p>
        ) : (
          view.sources.map((s, i) => (
            <div
              key={i}
              data-evidence-row
              className="flex break-inside-avoid items-baseline gap-2 border-b border-border/50 py-1.5 text-sm"
            >
              <div className={cn("min-w-0 flex-1 break-words", s.masked && "italic text-muted-foreground")}>
                {s.title}
                {s.where !== null ? <div className="font-mono text-[10px] text-muted-foreground">{s.where}</div> : null}
              </div>
              {s.citedBy !== null ? (
                <span className="ml-auto whitespace-nowrap font-mono text-[10px] text-muted-foreground">{s.citedBy}</span>
              ) : null}
            </div>
          ))
        )}
      </section>
    </article>
  )
}

export function RunEvidenceReport({ runId, onBack, onOpenThread }: Props) {
  const [state, setState] = useState<ReadState>({ kind: "loading" })
  const [attempt, setAttempt] = useState(0)

  // The read: owned here, aborted on unmount or when the run / attempt changes.
  useEffect(() => {
    const ctl = new AbortController()
    setState({ kind: "loading" })
    getRunEvidence(runId, ctl.signal)
      .then((payload) => {
        if (!ctl.signal.aborted) setState({ kind: "ready", payload })
      })
      .catch((err: unknown) => {
        if (ctl.signal.aborted) return
        setState({ kind: statusOf(err) === 404 ? "missing" : "broken" })
      })
    return () => ctl.abort()
  }, [runId, attempt])

  // The shareable address (SC#3): `?run=<id>` while this record is on screen.
  useEffect(() => {
    writeRunDeepLink(runId)
    return () => clearRunDeepLink()
  }, [runId])

  const view = useMemo(() => (state.kind === "ready" ? toEvidenceView(state.payload) : null), [state])

  if (state.kind === "loading") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">{REPORT_LOADING}</p>
      </div>
    )
  }

  if (state.kind === "missing" || state.kind === "broken") {
    const missing = state.kind === "missing"
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="font-headline text-xl font-semibold text-foreground">
          {missing ? NOT_AVAILABLE_HEAD : REPORT_BROKEN_HEAD}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">{missing ? NOT_AVAILABLE_BODY : REPORT_BROKEN_BODY}</p>
        <div className="flex items-center gap-2">
          {missing ? null : (
            <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
              {REPORT_TRY_AGAIN}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onBack}>
            {REPORT_BACK}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 pt-4 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {REPORT_BACK}
        </button>
      </div>
      {view !== null ? <Report view={view} payload={state.payload} onOpenThread={onOpenThread} /> : null}
    </div>
  )
}
