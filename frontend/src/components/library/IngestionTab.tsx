/**
 * Phase 217 (LIB-03 / D-217-17 / D-217-19) — the Ingestion tab body.
 *
 * ⭐ THIS IS THE MOUNT SITE FOR `IngestionStrip`. Plan 08 built the six-segment strip, its
 * stage constant and a 25-case suite, and shipped them with NO CONSUMER — a component that
 * exists, typechecks and is tested, and that no user can reach. D-217-17 puts the strips
 * HERE, one per in-flight document, which is what makes plan 08's work reachable.
 *
 * ⛔ NO PROGRESS ARITHMETIC OF ANY KIND (D-217-19). Two of the six stages are decided WHILE
 * THE FILE RUNS, so the pipeline's length is unknown when a row first renders and there is
 * no honest denominator to divide by. The queue shows STAGES REACHED. The file is fenced
 * bluntly against the literal tokens a progress bar would need, so even this docblock avoids
 * spelling them.
 *
 * ⛔ IT FETCHES NOTHING. Every document it renders is one the page already holds
 * (`useDocuments`), so opening this tab costs zero round trips. The stage aggregate is
 * derived from the step each document already carries — the sketch's own annotation calls
 * that "a real aggregate we can produce today", as against screen 07's invented token pie.
 *
 * ⛔ NO SECOND STATUS VOCABULARY. Every stage word comes from `TERM_MAP`'s six `ingest.*`
 * entries via `usePlainLabel`, so the ⌥ Technical-names reveal works here for free.
 */
import { IngestionStrip } from "@/components/ingestion/IngestionStrip"
import {
  INGESTION_STAGES,
  stageTermKey,
  type IngestionStage,
} from "@/components/ingestion/ingestionStages"
import { usePlainLabel, type TermKey } from "@/lib/termMap"
import type { Document } from "@/types"

/** One aggregate card: how many documents are at this stage RIGHT NOW. */
function StageCount({ stage, count }: { stage: IngestionStage; count: number }) {
  const label = usePlainLabel(stageTermKey(stage) as TermKey)
  return (
    <div
      data-stage-card={stage.key}
      className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl bg-card/50 ghost-border px-3 py-2.5"
    >
      <span className="truncate text-xs font-medium text-foreground" title={label}>
        {label}
      </span>
      <span className="font-mono text-lg font-bold text-foreground">{count}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {count === 1 ? "file here now" : "files here now"}
      </span>
    </div>
  )
}

export function IngestionTab({ documents }: { documents: Document[] }) {
  // In flight == not finished and not failed. `pending` files are in the queue too: they
  // have not started, and a queue that hides them would make the wait look like nothing.
  const inFlight = documents.filter((d) => d.status === "pending" || d.status === "processing")
  const failed = documents.filter((d) => d.status === "failed")

  return (
    <section data-testid="ingestion-tab" className="flex flex-col gap-6 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold leading-tight">Where every file is right now</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          A count of the files sitting at each stage of the pipeline.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INGESTION_STAGES.map((stage) => (
            <StageCount
              key={stage.key}
              stage={stage}
              count={
                documents.filter(
                  (d) => d.status === "processing" && d.ingestion_step === stage.key,
                ).length
              }
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold leading-tight">The queue</h2>
        {inFlight.length === 0 ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Nothing is being read right now.
          </p>
        ) : (
          <ul role="list" className="mt-3 flex flex-col gap-2">
            {inFlight.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2 rounded-xl bg-card/50 ghost-border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={doc.filename}>
                  {doc.filename}
                </span>
                <div className="w-full sm:max-w-[420px] sm:flex-1">
                  <IngestionStrip document={doc} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold leading-tight">Needs attention</h2>
        {failed.length === 0 ? (
          // ⚠ Silence is not success — the empty arm says the thing it means.
          <p className="mt-0.5 text-sm text-muted-foreground">Nothing needs attention.</p>
        ) : (
          <ul role="list" className="mt-3 flex flex-col gap-2">
            {failed.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-col gap-2 rounded-xl bg-destructive/5 border border-destructive/30 px-3 py-2.5"
              >
                <span className="truncate text-sm text-foreground" title={doc.filename}>
                  {doc.filename}
                </span>
                {/* The reason, not just the colour. `DocumentList` owns the retry action —
                    one verb, one place — so this row reports and does not duplicate it. */}
                <span className="text-xs text-muted-foreground">
                  {doc.error_message ?? "It stopped, and no reason was recorded."}
                </span>
                <IngestionStrip document={doc} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
