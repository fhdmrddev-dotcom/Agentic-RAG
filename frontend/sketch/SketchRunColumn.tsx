/**
 * ⚠ THROWAWAY — SKETCH 202. Delete `frontend/sketch/` at teardown.
 * `src/__tests__/no-sketch-surface.test.ts` turns RED once Phase 200.2 has an executed plan.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * SKETCH 202 — THE RUN COLUMN, RENDERED AGAINST THE STITCH REFERENCE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Reference: Aether Journey v2 (`7797685529205337277`) › screen `b08b92ce…`,
 * **"Workflow Run — Finished Result"**. Its shape, verbatim:
 *
 *   · a HERO SECTION headed "The answer", with a meta row (`⏱ Completed in 3m 42s` · a
 *     `17 sources` chip) and a filled `Open full text` button on the right; the answer body
 *     set behind a `border-l-2` rule.
 *   · a "Process trace" heading, then one CARD PER STEP: a status glyph, the step name, a
 *     one-line sentence beneath it, a count on the right, and a chevron.
 *   · expanded, a card shows a mono query block and a row of source cards with `Relevance`.
 *   · a 340px right panel, "Workflow progress": name · count · duration, and a total.
 *
 * ── ⚠ WHAT THE REFERENCE DRAWS THAT WE CANNOT BACK, AND WHAT THAT COSTS ───────────────
 *
 * This build ports the reference's SHAPE and refuses its unbacked CONTENT. The refusals are
 * not squeamishness — each is a measured absence:
 *
 *  R-1  THE QUERY BLOCK (`Query: … / Target: … / Status: … threshold > 0.85`).
 *       No substep/event/trace table exists; `reasoning_content` is 0 on every workflow-run
 *       message; the live substep stream is an ephemeral Redis buffer. For a FINISHED run
 *       this is fabrication. Not drawn. That is a backend persistence phase.
 *
 *  R-2  `Relevance: 0.94` BESIDE A FILENAME.
 *       ⚠ AND THIS ONE IS MORE INTERESTING THAN THE SEED SAYS. SEED-191 refuses it because
 *       "`similarity_scores` held 7 entries against 38 citations — they do not correspond".
 *       Measured 2026-08-23, that conflates two DIFFERENT keys on the same row:
 *         · `output.similarity_scores`      → 7 floats, correspond to nothing. Refusal correct.
 *         · `output.citations[i].similarity` → present on ALL 38, per entry, real.
 *       So the per-citation number IS backable. It is still OFF by default here, because a
 *       bare `0.579` is a figure nobody can act on — but that is a DESIGN choice now, not a
 *       honesty one, and the toggle in the chrome exists so the operator can judge it.
 *
 *  R-3  THE CARD'S SECOND LINE ("Gathered 15 sources from Q3-Financial-Dataset").
 *       Authored narration this product does not have. `RunTranscript` ships this refusal
 *       with a driven positive control. ⚠ STRIP IT AND THE REFERENCE'S CARD COLLAPSES TO A
 *       NAME AND A CHIP — which is the single most important thing this render shows, and
 *       why variants B and C differ only in what stands in for that line.
 *
 *  R-4  COLOUR ON DECORATION. Deep Midnight spends accent sparingly and Phase 185 already
 *       spent the budget. The reference's `primary` check glyphs are kept (status is the one
 *       thing colour is FOR); nothing else is tinted.
 *
 * ⚠ ONE MORE DEVIATION, INHERITED: sketch 201 declined the sheet's `#464651` outline —
 * 2.16:1 against the shared ground. This uses the app's own `border-border`.
 *
 * ── WHAT THE REFERENCE SETTLES THAT CONTEXT DID NOT ASK ───────────────────────────────
 *
 * ⚠ THE REFERENCE HAS NO CLOCK GUTTER IN THE CENTRE AT ALL. Times live only in the right
 * panel. SEED-191's finding #1 — that the left clock is the running sum of the right —
 * is solved by DELETION, and neither `200.2-CONTEXT.md` nor sketch 201 proposed that.
 *
 * ⚠ AND THE REFERENCE KEEPS THE COUNT IN BOTH COLUMNS — a chip on the card AND a sub-line
 * on the spine. `D-05` says move it to the log and take it off the spine. They disagree, and
 * the disagreement is visible here: the spine is the SHIPPED `RunSpine` in every variant.
 */
import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Clock, ExternalLink, FileText, CheckCircle2, XCircle, CircleDashed } from "lucide-react"

import { RunTranscript } from "@/components/workflows/RunTranscript"
import { RunSpine } from "@/components/workflows/RunSpine"
import { FileRow } from "@/components/files/FileRow"
import { baseName, formatBytes } from "@/components/files/fileRowUtils"
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer"
import {
  declaredCount,
  phaseRunFacts,
  runSpan,
  runClock,
} from "@/components/workflows/phaseDuration"
import { countDeclared, OUTCOME_FINISHED } from "@/components/workflows/receiptVocabulary"
import type { WorkflowRunPhase } from "@/lib/api"
import { cn } from "@/lib/utils"

import { ARM_LABEL, SKETCH_RUNS, type ArmKey, type SketchRun } from "./fixtures"

type VariantKey = "A" | "B" | "C"

const VARIANTS: { key: VariantKey; label: string; blurb: string }[] = [
  {
    key: "A",
    label: "A — Today",
    blurb:
      "The shipped surface, unchanged: RunTranscript + RunSpine, deliverable region at the foot. The control.",
  },
  {
    key: "B",
    label: "B — Reference shape, duration on line two",
    blurb:
      "The Stitch card stack, honestly. Where the reference put invented narration, this puts the step's own DURATION — backable, and it keeps the two-line rhythm the cards are built around.",
  },
  {
    key: "C",
    label: "C — Reference shape, strict single line",
    blurb:
      "The same cards with NOTHING where the narration was. What strict R-3 compliance actually costs — a card stack of one-line cards.",
  },
]

// ── The hero, ported from the reference's Deliverable Section ───────────────────────────

function heroFor(run: SketchRun, skipEmit: boolean) {
  // ⚠ The run's answer is the LAST server-ordered row with non-empty text that is NOT a gate
  // — the rule `WorkflowRunPage` already applies. A `confirm` step carries `text` too and it
  // is a QUESTION: measured, verbatim, "Does this draft answer your question? Add any
  // corrections." `api.ts`'s own docblock on `deliverable_text` records this.
  //
  // `skipEmit` is NOT part of the shipped rule — it is the second reading, so the finding
  // above can be seen rather than described. Off = exactly what ships today.
  let answer: string | null = null
  for (const row of run.phases) {
    if (isGateStep(row)) continue
    if (skipEmit && isEmitStatusStep(row)) continue
    if (row.deliverable_text) answer = row.deliverable_text
  }
  const [file = null, ...rest] = run.files
  return { file, rest, answer }
}

/**
 * ⚠ THE REAL SIGNAL, AND THE FIRST DRAFT OF THIS SKETCH GOT IT WRONG IN A WAY WORTH KEEPING.
 *
 * It used a slug regex (`/confirm|approve|review|gate/i`) and said in its own comment that
 * *"`phase_type` is null on every real fixture row, so NOTHING on the wire marks a gate"*.
 * That was FALSE, and it was false because the fixture GENERATOR was wrong: it read
 * `phase["phase_type"]` off the definition, which does not exist. The server reads
 * `phase["config"]["phase_type"]` (`api/workflow_runs.py:308`) and it is populated on every
 * real row — `llm_agent` · `llm_single` · `llm_emit` · `llm_human_input`.
 *
 * A wrong fixture produced a wrong CONCLUSION, and the conclusion had already been written
 * into `200.2-CONTEXT.md`'s D-06 discussion before the render caught it. There IS a clean
 * signal; the shipped `runAnswer` already keys on exactly this.
 */
function isGateStep(row: WorkflowRunPhase): boolean {
  return row.phase_type === "llm_human_input"
}

/**
 * ⚠ THE FINDING THIS SKETCH EXISTS TO HAVE FOUND, AND IT IS ABOUT THE SHIPPED PAGE, NOT
 * ABOUT ANY PROPOSAL HERE.
 *
 * `WorkflowRunPage.runAnswer` takes *the last server-ordered row with non-empty
 * `deliverable_text`, skipping `llm_human_input`*. On the QBR run — real, local, current —
 * the last such row is `emit-qbr`, an `llm_emit` step whose whole text is:
 *
 *     "Produced the filled deliverable: /Northwind-QBR-Template.docx"
 *
 * 61 characters of STATUS. One step earlier, `synthesize` holds **6,133 characters** of the
 * actual QBR narrative. So today's run page renders that status line under the heading
 * **"The answer this run wrote"** — the surface stating, in its own voice, that a filename
 * announcement is the deliverable. It is the same class of defect the `llm_human_input` skip
 * was added to fix (a step's `text` that is not an answer), one phase type over, and the
 * shipped skip does not cover it.
 *
 * ⚠ NOT PROPOSED AS A ONE-LINE FIX. `llm_emit`'s text may be the right answer on a workflow
 * whose emit step writes prose, and this is one run. What the sketch establishes is that the
 * rule is WRONG ON A REAL RUN TODAY; deciding the replacement is the phase's job. The toggle
 * in the chrome renders both readings so the difference is visible rather than argued.
 */
function isEmitStatusStep(row: WorkflowRunPhase): boolean {
  return row.phase_type === "llm_emit"
}

/**
 * ⚠ THE REFERENCE'S `17 sources` CHIP IS NOT DRAWN, AND THIS FUNCTION RECORDS WHY RATHER
 * THAN BEING DELETED — because the first render DID draw it, and seeing it was the argument.
 *
 * There is no run-level source count on the wire. The obvious derivation is to SUM the
 * per-step `_measure` counts, which on the QBR run gives `15 + 20 + 20 = 55` — and the chip
 * then reads **"55 sources"** beside a heading, which a person reads as *fifty-five distinct
 * documents*. Nothing supports that: the same document can satisfy three retrieval steps, so
 * the sum counts READS, not sources, and the two differ by an unknown amount.
 *
 * It is a plausible, un-declared figure — the same class as the reference's `Relevance: 0.94`
 * and its invented narration, and exactly what `199-05` called *"the highest-consequence lie
 * this phase could ship"*. The per-step chips already carry every count anyone declared.
 *
 * Re-open trigger: a run-level distinct-source count written by the retrieval path itself.
 */
function runLevelSourceTotalIsNotAvailable(): null {
  return null
}

function Hero({ run, skipEmit }: { run: SketchRun; skipEmit: boolean }) {
  const { file, rest, answer } = heroFor(run, skipEmit)
  const span = runSpan(run.phases)
  const sources = runLevelSourceTotalIsNotAvailable()
  const badRow = run.phases.find((p) => p.status === "failed" || p.status === "cancelled")

  // D-16 — total over every terminal status, and an unknown one never reads as success.
  const emptySentence = (() => {
    const at = badRow ? `“${run.names[badRow.slug] ?? badRow.slug}”` : null
    switch (run.status) {
      case "completed":
        return "This run finished without writing a file or an answer."
      case "failed":
        return at
          ? `This run stopped on an error at ${at}. Nothing was produced.`
          : "This run stopped on an error. Nothing was produced."
      case "cancelled":
        return at
          ? `This run was stopped at ${at}. Nothing was produced.`
          : "This run was stopped. Nothing was produced."
      default:
        return "This run's outcome was not recorded, and nothing was produced."
    }
  })()

  // ⚠ THE REFERENCE'S HERO HAS A HEADING ("The answer") AND `D-14` SAYS IT SHOULD NOT.
  // The heading is kept here, because the reference is the thing being judged — but it is
  // TYPED by what the run produced, so it never claims authorship of a thread-scoped file.
  const heading = answer
    ? "The answer"
    : file
      ? "The file this run produced"
      : "Nothing was produced"

  return (
    <section className="rounded-xl border border-border bg-card/40 p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-headline text-2xl font-semibold leading-tight text-foreground">
            {heading}
          </h2>
          {/* The reference's meta row: a clock reading, a dot, a sources chip. Every atom
              here is measured — the span from the phase rows, the count from `_measure`. */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {span ? `Completed in ${runClock(span.ms)}` : "Runtime not recorded"}
            </span>
            {sources !== null ? (
              <>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border" />
                <span className="inline-flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-primary">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {countDeclared(sources, "sources")}
                </span>
              </>
            ) : null}
          </div>
        </div>
        {answer ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open full text
          </button>
        ) : null}
      </div>

      {answer ? (
        // The reference sets the answer behind a left rule. `MarkdownRenderer` is the shipped
        // path (`8da83fe9`), capped at a 72ch measure — SEED-191 §2 is already closed.
        <div className="border-l-2 border-border pl-4">
          <MarkdownRenderer content={answer} className="max-w-[72ch] break-words" />
        </div>
      ) : null}

      {file ? (
        <div className={cn("rounded-lg border border-border bg-background/40 p-2", answer && "mt-5")}>
          <FileRow
            asChild
            density="run"
            name={baseName(file.path)}
            mimeType={file.mime_type ?? undefined}
            sizeBytes={file.size_bytes ?? undefined}
            trailing="download"
          >
            <button
              type="button"
              title={file.path}
              aria-label={`Download ${baseName(file.path)} (${formatBytes(file.size_bytes ?? 0)})`}
              className="w-full rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent"
            />
          </FileRow>
        </div>
      ) : null}

      {/* D-15 — the REST of the thread-scoped list stays visible, so the 1-in-61 case where
          the newest file is not the run's own degrades to "the wrong file is prominent"
          rather than "the only file shown is wrong". */}
      {rest.length > 0 ? (
        <ul role="list" className="mt-1 flex flex-col gap-0.5">
          {rest.map((f) => (
            <li key={f.id}>
              <FileRow
                asChild
                density="run"
                name={baseName(f.path)}
                mimeType={f.mime_type ?? undefined}
                sizeBytes={f.size_bytes ?? undefined}
                trailing="download"
              >
                <button type="button" title={f.path} className="w-full rounded-md px-2 py-2 text-left hover:bg-accent" />
              </FileRow>
            </li>
          ))}
        </ul>
      ) : null}

      {!answer && !file ? (
        <p className="text-sm text-muted-foreground">{emptySentence}</p>
      ) : null}
    </section>
  )
}

/**
 * ⚠ THE SPINE'S PER-STEP READING — AND ITS ABSENCE WAS A REAL DEFECT IN THIS SKETCH'S FIRST
 * RENDER, CAUGHT ONLY BY LOOKING AT IT.
 *
 * `RunSpine` keys its ring face on the LIVE reading (`READING_FACE`), and falls back to
 * `FALLBACK_FACE` — glyph `"?"`, muted, no ring colour — for a slug it holds no reading for.
 * Passing no `liveOf` at all is therefore not "neutral": it renders **five question marks** on
 * a run where every step completed. The first screenshot showed exactly that, and no test
 * would ever have said so.
 *
 * On the real page the reading comes from `runStateBySlug` — a derivation over the live phase
 * slice, the pending asks and the run row, which a static fixture does not have. This is the
 * DURABLE stand-in: terminal status → the reading its face is keyed on. It is honest for these
 * four fixtures because every one of them is terminal.
 *
 * ⚠ IT IS A SKETCH AFFORDANCE, NOT A PROPOSAL. The page owns the join, the reading and the
 * words — that is the house rule `RunSpineProps` states in its own docblock — and nothing here
 * suggests moving that derivation into the component.
 *
 * ⚠ `pending` DELIBERATELY GETS NO READING. A step the run never reached has no live fact, so
 * the fallback `?` is the honest face for it — and on the failed and cancelled arms, four of
 * five rows are exactly that. Handing them a `done` or a `skipped` face would be the
 * fabrication this whole sketch is trying not to commit.
 */
function spineReadingOf(run: SketchRun): (slug: string) => { reading: string; label: string } | undefined {
  const map: Record<string, { reading: string; label: string }> = {}
  for (const row of run.phases) {
    const facts = phaseRunFacts(row, run.status)
    switch (row.status) {
      case "completed":
        map[row.slug] = { reading: "done", label: facts.outcome }
        break
      case "failed":
        map[row.slug] = { reading: "failed", label: facts.outcome }
        break
      case "cancelled":
        map[row.slug] = { reading: "cancelled", label: facts.outcome }
        break
      case "skipped":
        map[row.slug] = { reading: "skipped", label: facts.outcome }
        break
      default:
        // `pending` / `active` — no durable reading. See the docblock.
        break
    }
  }
  // ⚠ `own()`-shaped read. A slug is an unconstrained string and a bare index into an object
  // literal returns an inherited member for a prototype key — the WR-04 sink measured at nine
  // sites in this tree, one of them in the run log.
  return (slug: string) =>
    Object.prototype.hasOwnProperty.call(map, slug) ? map[slug] : undefined
}

// ── The process trace, ported from the reference's Process Blocks ───────────────────────

function StepCard({
  run,
  row,
  showSecondLine,
  showRelevance,
}: {
  run: SketchRun
  row: WorkflowRunPhase
  showSecondLine: boolean
  showRelevance: boolean
}) {
  const [open, setOpen] = useState(false)
  const facts = phaseRunFacts(row, run.status)
  const count = declaredCount(row)
  const cits = run.citations[row.slug] ?? []
  const total = run.citationTotals[row.slug]
  const expandable = cits.length > 0

  const done = row.status === "completed"
  const bad = row.status === "failed" || row.status === "cancelled"

  // The right-hand atom. `0` is a real measurement, so `typeof`, never `??`.
  const chip = count ? countDeclared(count.count, count.noun) : null
  // D-07 — the count REPLACES `finished` and only that word; every other outcome keeps its
  // word, because those steps produced nothing for a count to describe.
  const word = facts.outcome === OUTCOME_FINISHED && chip ? null : facts.outcome

  const Head = expandable ? "button" : "div"

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/30">
      <Head
        {...(expandable
          ? { type: "button" as const, onClick: () => setOpen(!open), "aria-expanded": open }
          : {})}
        className={cn(
          "flex w-full items-center justify-between gap-4 p-4 text-left",
          expandable && "transition-colors hover:bg-accent/40",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="shrink-0">
            {done ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : bad ? (
              <XCircle className="h-5 w-5 text-[hsl(0_80%_75%)]" />
            ) : (
              <CircleDashed className="h-5 w-5 text-muted-foreground/50" />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">
              {run.names[row.slug] ?? row.slug}
            </span>
            {/* ⚠ THE REFERENCE'S SECOND LINE IS INVENTED NARRATION (R-3). Variant B puts the
                step's own DURATION here — the one backable fact that fits the slot and is not
                already on the right. Variant C leaves it empty, which is what strict
                compliance looks like. */}
            {showSecondLine ? (
              <span className="truncate text-xs text-muted-foreground">
                {facts.timing.reading}
              </span>
            ) : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          {chip ? <span>{chip}</span> : null}
          {word ? <span>{word}</span> : null}
          {expandable ? (
            open ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )
          ) : null}
        </span>
      </Head>

      {open && expandable ? (
        <div className="border-t border-border bg-background/60 p-4">
          {/* ⚠ THE REFERENCE'S MONO QUERY BLOCK IS NOT DRAWN (R-1). Nothing durably records
              what a step asked; a block here would be invented. Its absence is the honest
              render, and it is the biggest single difference between this and the drawing. */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {cits.map((c, i) => (
              <div
                key={`${c.document_id}-${c.chunk_index ?? "full"}-${i}`}
                className="flex w-64 shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-card/60 p-3"
              >
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="truncate text-xs font-medium text-foreground" title={c.filename}>
                  {c.filename}
                </span>
                {/* ⚠ THE REAL PASSAGE, which is what we have INSTEAD of the reference's
                    `Relevance: 0.94`. It is the substance SEED-191 said the column was
                    missing, and it traces to a stored field. */}
                <p className="line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">
                  {c.passage}
                </p>
                {showRelevance && c.similarity != null ? (
                  <span className="text-[11px] text-muted-foreground/70">
                    Relevance: {c.similarity.toFixed(2)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          {/* ⚠ D-11 — the expansion states NO TOTAL. The chip above already carries the one
              count this surface prints. This line is SKETCH CHROME, saying what the fixture
              truncated; it is not part of the proposal. */}
          {typeof total === "number" && total > cits.length ? (
            <p className="mt-3 text-[11px] text-muted-foreground/50">
              sketch fixture shows {cits.length} of {total} — the real row carries all {total}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── The page ────────────────────────────────────────────────────────────────────────────

export function SketchRunColumn() {
  const [variant, setVariant] = useState<VariantKey>("B")
  const [arm, setArm] = useState<ArmKey>("both")
  const [showRelevance, setShowRelevance] = useState(false)
  const [skipEmit, setSkipEmit] = useState(false)

  const run = SKETCH_RUNS[arm]
  // ONE hoisted instant, and a FIXED one so the sketch does not drift between screenshots.
  const now = useMemo(
    () => Date.parse(run.updated_at) || Date.parse("2026-08-23T00:00:00Z"),
    [run],
  )
  const titleOf = useMemo(() => {
    const names = run.names
    return (slug: string) =>
      Object.prototype.hasOwnProperty.call(names, slug) ? names[slug] : slug
  }, [run])

  const span = runSpan(run.phases)
  const { file, rest, answer } = heroFor(run, skipEmit)

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* ── SKETCH CHROME — not part of any proposal ──────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-card/30 px-6 py-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Sketch 202 · the run column, rendered against Stitch “Workflow Run — Finished
          Result” · SEED-191 / SEED-155
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {VARIANTS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVariant(v.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                variant === v.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
          <span aria-hidden="true" className="mx-2 h-5 w-px bg-border" />
          {(Object.keys(SKETCH_RUNS) as ArmKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setArm(k)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                arm === k ? "bg-accent text-foreground" : "bg-card/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {ARM_LABEL[k]}
            </button>
          ))}
          {variant !== "A" ? (
            <>
              <span aria-hidden="true" className="mx-2 h-5 w-px bg-border" />
              <button
                type="button"
                onClick={() => setShowRelevance(!showRelevance)}
                className="rounded-md bg-card/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                relevance score: {showRelevance ? "shown ⚠" : "refused (R-2)"}
              </button>
              <button
                type="button"
                onClick={() => setSkipEmit(!skipEmit)}
                className="rounded-md bg-card/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                answer rule: {skipEmit ? "also skip llm_emit" : "as shipped ⚠"}
              </button>
            </>
          ) : null}
        </div>
        <p className="mt-2 max-w-5xl text-xs text-muted-foreground">
          {VARIANTS.find((v) => v.key === variant)?.blurb}
        </p>
      </div>

      {/* ── THE PAGE HEADER BAND — two flex cells, as the shipped page builds it, so the
             divider runs from the very top and the two headings sit level. ────────────── */}
      <header className="flex shrink-0 border-b border-border/10">
        <div className="flex min-w-0 flex-1 flex-col gap-2 px-6 py-4">
          <span className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground">
            <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
            Workflows
          </span>
          <div className="flex items-center gap-3">
            <h1 className="font-headline text-xl font-semibold leading-tight text-foreground">
              {run.workflowName}
            </h1>
            <span className="font-mono text-xs text-muted-foreground">
              {run.status} · {run.id.slice(0, 8)}
            </span>
          </div>
        </div>
        <div className="hidden w-[380px] shrink-0 items-end border-l border-border px-4 py-4 lg:flex">
          <h2 className="text-xs font-semibold text-foreground">Workflow progress</h2>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {variant === "A" ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto px-6 pt-4">
                <RunTranscript
                  phases={run.phases}
                  titleOf={titleOf}
                  runStatus={run.status}
                  now={now}
                />
              </div>
              {/* Today's deliverable region: at the FOOT, capped, plain. The thing being
                  argued with. */}
              <section className="shrink-0 overflow-auto border-t border-border/10 px-6 py-4 md:max-h-[220px]">
                {answer === null ? (
                  <>
                    <h2 className="text-xs font-semibold text-foreground">
                      Files in this run&apos;s workspace
                    </h2>
                    {!file ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        This run produced no file and no written answer.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {file ? (
                  <ul role="list" className="mt-2 flex flex-col gap-0.5">
                    {[file, ...rest].map((f) => (
                      <li key={f.id}>
                        <FileRow
                          asChild
                          density="run"
                          name={baseName(f.path)}
                          mimeType={f.mime_type ?? undefined}
                          sizeBytes={f.size_bytes ?? undefined}
                          trailing="download"
                        >
                          <button type="button" title={f.path} className="w-full rounded-md px-2 py-2 text-left hover:bg-accent" />
                        </FileRow>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {answer !== null ? (
                  <div>
                    <h2 className={cn("text-xs font-semibold text-foreground", file && "mt-4")}>
                      The answer this run wrote
                    </h2>
                    <MarkdownRenderer content={answer} className="mt-2 max-w-[72ch] break-words" />
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            // The reference's main column: one scroll, a generous max width, `gap-xl`.
            <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
              <div className="mx-auto flex max-w-4xl flex-col gap-8">
                <Hero run={run} skipEmit={skipEmit} />
                <div className="flex flex-col gap-2">
                  <h2 className="mb-1 text-sm font-semibold text-foreground">Process trace</h2>
                  {/* ⚠ NO CLOCK GUTTER. The reference has none, and its absence is the whole
                      answer to SEED-191's finding #1 — the centre's clock was the running sum
                      of the panel's durations. Times live in the panel only. */}
                  {run.phases.map((row) => (
                    <StepCard
                      key={row.slug}
                      run={run}
                      row={row}
                      showSecondLine={variant === "B"}
                      showRelevance={showRelevance}
                    />
                  ))}
                </div>
                {span ? (
                  <p className="text-xs text-muted-foreground">
                    Total runtime {runClock(span.ms)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Runtime not recorded</p>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="hidden w-[380px] shrink-0 flex-col overflow-hidden border-l border-border bg-card/40 lg:flex">
          {/* ⚠ THE SHIPPED SPINE, IN EVERY VARIANT — including its count sub-line. That is
              what makes the duplication judgeable: the reference keeps the count in BOTH
              columns, `D-05` says take it off the spine, and the only way to decide is to
              look at them together. */}
          <RunSpine
            phases={run.phases}
            titleOf={titleOf}
            liveOf={spineReadingOf(run)}
            runStatus={run.status}
            now={now}
          />
        </aside>
      </div>
    </div>
  )
}

export default SketchRunColumn
