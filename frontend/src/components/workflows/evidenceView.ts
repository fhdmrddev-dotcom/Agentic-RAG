/**
 * Phase 289-04 (VIS-03 / D-03 / D-04 / D-05 / R-01..R-04) — the ONE view-model of a finished
 * run's evidence report.
 *
 * `toEvidenceView(payload)` turns the `GET /workflow-runs/{id}/evidence` payload into every
 * string the report shows. `RunEvidenceReport.tsx` renders this view and nothing else, and
 * its D-03 test checks each section's DOM text against `sectionStrings(view)` — so the page,
 * its print (the page itself) and its JSON export (`exportPayload`, the fetched payload
 * unchanged) are one source by construction rather than by care.
 *
 * Pure: no React, no fetch, no clock reads beyond formatting the instants it is given. Every
 * word comes from `evidenceVocabulary.ts`; this module decides which word, never spells one.
 *
 * Privacy is enforced by the SERVER (plan 289-03 withholds the owner's email, the thread id,
 * the deliverable's file id, the human-input text and masked documents from a non-owner). This
 * module applies the same rule a second time on `run.viewer_is_owner`, so a field that leaked
 * on the wire still does not reach the page.
 */
import type {
  RunEvidence,
  RunEvidencePhase,
  RunEvidenceSource,
  RunEvidenceVerdict,
} from "@/lib/api/runEvidence"
import type { RunPhaseConfidence } from "@/lib/api/workflows"
import { own } from "@/components/workflows/ownProperty"
import { PHASE_TYPE_LABELS } from "@/components/workflows/phaseVocabulary"
import { declaredCount, phaseTiming, readInstant } from "@/components/workflows/phaseDuration"
import { countDeclared } from "@/components/workflows/receiptVocabulary"
import { fmtElapsed } from "@/lib/fmtElapsed"
import {
  CHANGED_HEAD,
  DELIVERABLE_FILE_GLYPH,
  DELIVERABLE_NONE,
  DELIVERABLE_TEXT,
  DELIVERABLE_UNNAMED_FILE,
  FACT_CHECKS,
  FACT_DELIVERABLE,
  FACT_RESULT,
  FACT_VERSION,
  MASKED_SOURCE,
  NOT_ANSWERED,
  NO_CHECKS_RAN,
  NO_SOURCES,
  NO_VERDICTS,
  PREDATES_BANNER,
  RESULT_CANCELLED,
  RESULT_COMPLETED,
  RESULT_FAILED,
  STEP_STATUS_UNKNOWN,
  STEP_STATUS_WORD,
  UNNAMED_SOURCE,
  UNTITLED_WORKFLOW,
  VERDICT_KIND_CHECK,
  VERDICT_KIND_RECORDED,
  VERDICT_RESULT_WORD,
  VERDICT_SENTENCE,
  VERDICT_UNKNOWN,
  VERSION_NOT_RECORDED,
  WAITED_ANSWERED,
  WAITED_NOT_ANSWERED,
  answeredBy,
  changedBody,
  checkedKinds,
  checksPassed,
  citedBy,
  definitionHeading,
  outcomeIn,
  passageList,
  quotedAnswer,
  startedByLine,
  stepRef,
  versionShort,
  whyItStopped,
} from "@/components/workflows/evidenceVocabulary"

export type FactTone = "success" | "danger" | "muted" | "plain"

export interface EvidenceFact {
  label: string
  value: string
  tone: FactTone
}

export interface EvidenceStepRow {
  n: number
  slug: string
  title: string
  typeLine: string
  output: string | null
  count: string | null
  /** The SAME wire object the live spine renders — passed through untouched (D-10). */
  confidence: RunPhaseConfidence | null
  /** Owner: question, quoted answer, "— who". Colleague: one "Waited for an answer" line. */
  humanInput: string[] | null
  failure: string | null
  status: string
  statusWord: string
  /** The duration reading; "" when the step never ran (the status word already says so). */
  time: string
}

export interface EvidenceVerdictRow {
  result: "passed" | "failed" | "recorded"
  sentence: string
  meta: string
  resultWord: string
}

export interface EvidenceSourceRow {
  masked: boolean
  title: string
  where: string | null
  citedBy: string | null
}

export interface EvidenceView {
  runId: string
  title: string
  outcome: string
  startedBy: string
  /** Owner only. */
  email: string | null
  org: string | null
  facts: EvidenceFact[]
  changedBanner: { head: string; body: string } | null
  predatesBanner: string | null
  definition: {
    heading: string
    steps: { title: string; type: string }[]
    fullJson: string | null
  }
  steps: EvidenceStepRow[]
  verdicts: EvidenceVerdictRow[]
  noVerdicts: string | null
  sources: EvidenceSourceRow[]
  noSources: string | null
  /** Owner only: the chat thread and the deliverable download. `null` for anyone else. */
  ownerLinks: {
    threadId: string | null
    deliverable: { fileId: string; name: string } | null
  } | null
}

function typeLabel(phaseType: string | null): string {
  if (phaseType === null) return ""
  return own(PHASE_TYPE_LABELS, phaseType) ?? phaseType
}

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

function formatWhen(iso: string | null): string | null {
  const ms = readInstant(iso)
  if (ms === null) return null
  try {
    return new Date(ms).toLocaleString("en-GB", WHEN_FORMAT)
  } catch {
    return null
  }
}

function runSpanText(started: string | null, completed: string | null): string | null {
  const s = readInstant(started)
  const c = readInstant(completed)
  if (s === null || c === null) return null
  return fmtElapsed(Math.max(0, c - s))
}

function resultFact(status: string): EvidenceFact {
  if (status === "completed") return { label: FACT_RESULT, value: RESULT_COMPLETED, tone: "success" }
  if (status === "failed") return { label: FACT_RESULT, value: RESULT_FAILED, tone: "danger" }
  return { label: FACT_RESULT, value: RESULT_CANCELLED, tone: "muted" }
}

function checksFact(verdicts: readonly RunEvidenceVerdict[]): EvidenceFact {
  const checks = verdicts.filter((v) => v.result === "passed" || v.result === "failed")
  if (checks.length === 0) return { label: FACT_CHECKS, value: NO_CHECKS_RAN, tone: "muted" }
  const passed = checks.filter((v) => v.result === "passed").length
  return {
    label: FACT_CHECKS,
    value: checksPassed(passed, checks.length),
    tone: passed === checks.length ? "success" : "danger",
  }
}

function deliverableFact(p: RunEvidence): EvidenceFact {
  const d = p.deliverable
  if (d.kind === "file") {
    return {
      label: FACT_DELIVERABLE,
      value: `${DELIVERABLE_FILE_GLYPH} ${d.name ?? DELIVERABLE_UNNAMED_FILE}`,
      tone: "plain",
    }
  }
  if (d.kind === "text") return { label: FACT_DELIVERABLE, value: DELIVERABLE_TEXT, tone: "plain" }
  return { label: FACT_DELIVERABLE, value: DELIVERABLE_NONE, tone: "muted" }
}

function humanInputLines(row: RunEvidencePhase, isOwner: boolean): string[] | null {
  const hi = row.human_input
  if (hi === null) return null
  if (!isOwner) return [hi.answered ? WAITED_ANSWERED : WAITED_NOT_ANSWERED]
  const lines: string[] = []
  if (hi.question) lines.push(hi.question)
  if (hi.answered && hi.answer !== null) {
    lines.push(quotedAnswer(hi.answer))
    if (hi.answered_by) lines.push(answeredBy(hi.answered_by))
  } else if (!hi.answered) {
    lines.push(NOT_ANSWERED)
  }
  return lines
}

const SILENT_TIMING = new Set(["not-started", "never-ran", "unknown"])

function stepRow(row: RunEvidencePhase, runStatus: string, isOwner: boolean): EvidenceStepRow {
  const humanInput = humanInputLines(row, isOwner)
  const count = declaredCount(row)
  const timing = phaseTiming(row, runStatus)
  const type = typeLabel(row.phase_type)
  return {
    n: row.n,
    slug: row.slug,
    title: row.name || row.slug,
    typeLine: type ? `${type} · ${row.slug}` : row.slug,
    // A human-input step's output IS its question; it is shown (owner) or withheld
    // (colleague, R-04) through the human-input lines, never twice and never by accident.
    output: humanInput !== null ? null : row.output_text,
    count: count === null ? null : countDeclared(count.count, count.noun),
    confidence: row.confidence,
    humanInput,
    failure: row.failure_reason ? whyItStopped(row.failure_reason) : null,
    status: row.status,
    statusWord: own(STEP_STATUS_WORD, row.status) ?? STEP_STATUS_UNKNOWN,
    time: SILENT_TIMING.has(timing.kind) ? "" : timing.reading,
  }
}

function verdictRow(v: RunEvidenceVerdict): EvidenceVerdictRow {
  const sentence = own(VERDICT_SENTENCE, v.kind) ?? VERDICT_UNKNOWN
  const resultWord = own(VERDICT_RESULT_WORD, v.result) ?? VERDICT_RESULT_WORD.recorded
  const parts: string[] = [v.result === "recorded" ? VERDICT_KIND_RECORDED : VERDICT_KIND_CHECK]
  if (typeof v.step_n === "number") parts.push(stepRef(v.step_n))
  if (v.checked.length > 0) parts.push(checkedKinds(v.checked))
  return { result: v.result, sentence, meta: parts.join(" · "), resultWord }
}

function sourceRow(s: RunEvidenceSource): EvidenceSourceRow {
  const cited = s.cited_by.length > 0 ? citedBy(s.cited_by) : null
  if (s.masked) return { masked: true, title: MASKED_SOURCE, where: null, citedBy: cited }
  return {
    masked: false,
    title: s.filename ?? UNNAMED_SOURCE,
    where: s.locations.length > 0 ? passageList(s.locations) : null,
    citedBy: cited,
  }
}

export function toEvidenceView(p: RunEvidence): EvidenceView {
  const isOwner = p.run.viewer_is_owner === true
  const changed = p.definition_changed.changed
  const deliverable =
    isOwner && p.deliverable.kind === "file" && p.deliverable.file_id && p.run.thread_id
      ? { fileId: p.deliverable.file_id, name: p.deliverable.name ?? DELIVERABLE_UNNAMED_FILE }
      : null

  return {
    runId: p.run.id,
    title: p.run.workflow_name || UNTITLED_WORKFLOW,
    outcome: outcomeIn(p.run.status, runSpanText(p.run.started_at, p.run.completed_at)),
    startedBy: startedByLine(
      formatWhen(p.run.started_at),
      p.run.started_by.name,
      isOwner && p.run.started_by.is_you,
    ),
    email: isOwner ? p.run.started_by.email : null,
    org: p.run.org_name,
    facts: [
      resultFact(p.run.status),
      {
        label: FACT_VERSION,
        value: p.definition.version === null ? VERSION_NOT_RECORDED : versionShort(p.definition.version),
        tone: "plain",
      },
      checksFact(p.verdicts),
      deliverableFact(p),
    ],
    changedBanner: changed
      ? { head: CHANGED_HEAD, body: changedBody(p.definition.version, p.definition_changed.current_version) }
      : null,
    predatesBanner: p.definition.recorded ? null : PREDATES_BANNER,
    definition: {
      heading: definitionHeading(p.definition.version, p.definition.phases.length),
      steps: p.definition.phases.map((ph) => ({ title: ph.name || ph.slug, type: typeLabel(ph.phase_type) })),
      fullJson: p.definition.full === null ? null : JSON.stringify(p.definition.full, null, 2),
    },
    steps: p.phase_log.map((row) => stepRow(row, p.run.status, isOwner)),
    verdicts: p.verdicts.map(verdictRow),
    noVerdicts: p.verdicts.length === 0 ? NO_VERDICTS : null,
    sources: p.sources.map(sourceRow),
    noSources: p.sources.length === 0 ? NO_SOURCES : null,
    ownerLinks: isOwner ? { threadId: p.run.thread_id, deliverable } : null,
  }
}

function nonEmpty(xs: readonly (string | null | undefined)[]): string[] {
  return xs.filter((x): x is string => typeof x === "string" && x.length > 0)
}

/**
 * Per section 1-4, the exact strings the report's DOM must contain. The D-03 test asserts
 * each is present in that section's text, so the page cannot drift from the view-model the
 * export is measured against.
 */
export function sectionStrings(v: EvidenceView): Record<1 | 2 | 3 | 4, string[]> {
  return {
    1: nonEmpty([
      v.definition.heading,
      ...v.definition.steps.flatMap((s) => [s.title, s.type]),
      v.definition.fullJson,
    ]),
    2: nonEmpty(
      v.steps.flatMap((r) => [
        r.title,
        r.typeLine,
        r.output,
        r.count,
        ...(r.humanInput ?? []),
        r.failure,
        r.statusWord,
        r.time,
        r.confidence?.kb_label,
      ]),
    ),
    3: v.noVerdicts !== null ? [v.noVerdicts] : nonEmpty(v.verdicts.flatMap((r) => [r.sentence, r.meta, r.resultWord])),
    4: v.noSources !== null ? [v.noSources] : nonEmpty(v.sources.flatMap((r) => [r.title, r.where, r.citedBy])),
  }
}

/**
 * What the JSON download writes: the fetched payload ITSELF, never a reshaped copy (D-03).
 * The page renders `toEvidenceView` of this same object, so the export's sections are the
 * page's sections by construction.
 */
export function exportPayload(p: RunEvidence): RunEvidence {
  return p
}
