/**
 * Phase 200 re-port — THE RUN SURFACE'S RIGHT-HAND SPINE, ported from `run-surface.html`.
 *
 * ⚠ THIS EXISTS BECAUSE THE RUN PAGE WAS SHOWING SCHEMA TOKENS TO A BUSINESS AUTHOR.
 *
 * A wiring pass mounted the DEVELOPER panel's `PhaseTimeline` in this slot, on the reasoning
 * that every part of the sheet's spine was "already built". Seen in a browser against the
 * sheet, it was not the same thing at all. It rendered:
 *
 *     gather-usage      ✓ Complete
 *     gather-support    ✓ Complete
 *     emit-qbr          ✓ Complete          Phase 5 / 5   ·   3 agents
 *
 * — raw `workflow_phases.slug` values, in a mono face, plus a phase counter and an agent
 * count. The sheet draws the same region as the step's HUMAN NAME with the result underneath:
 *
 *     ✓  Pull usage and support history
 *        Found 12 contracts
 *
 * That is the exact class Phase 187's node-vocabulary work exists to prevent — *"the STORED
 * SLUG, the PANEL WORD and the CANVAS SENTENCE are three deliberately different spellings"* —
 * and `PhaseTimeline`'s own module says which of the three it speaks: it is
 * `panel/phaseStatusMeta.ts`'s **developer** vocabulary. It is the right component in chat and
 * the wrong one here. Chat is untouched; this surface gets its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT SHOWS, AND THE ONE THING IT DELIBERATELY DOES NOT
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *  • the step's HUMAN NAME — the page's `titleOf`, the same `nodeTitle` the canvas paints, so
 *    the two views cannot spell one step two ways;
 *  • the DECLARED COUNT underneath it (`Found 12 contracts`) — `step_count` / `step_noun`,
 *    which have been on the wire since `200-02` and were reaching nothing on this surface;
 *  • a live elapsed on the RUNNING step only.
 *
 * ⚠ **A STEP THAT DECLARED NO COUNT GETS NO SUB-LINE AT ALL** — never `0`, never a dash, never
 * prose. The sheet puts the SENTENCE *"Summarized meeting notes"* in that slot for a step with
 * no number, and that sentence is authored narration this product does not have. Drawing
 * something there would be the fabricated-figure defect told in prose, which `199-05` called
 * the highest-consequence lie this work could ship. The slot stays empty and the row closes up.
 *
 * ⚠ **THE DURATION OF A FINISHED STEP IS NOT SHOWN HERE, AND THAT IS THE SHEET'S OWN CHOICE.**
 * Its spine prints a time on exactly one row — the step in progress. Durations belong to the
 * run log in the centre; repeating them here is how this page ended up stating one fact three
 * times before this re-port.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * TONE AND GLYPHS
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ `--panel-*` TOKENS ARE FORBIDDEN HERE. This renders on `--background`, outside the panel
 * shell; `panel/phaseStatusMeta.ts` states that boundary in as many words, and it is why that
 * module's table cannot simply be imported even though its WORDS are close.
 *
 * ⚠ **ZERO NET-NEW GLYPHS.** Every mark below is INHERITED verbatim from
 * `panel/phaseStatusMeta.ts`'s shipped table — the same characters for the same states, so
 * this surface introduces no new vocabulary and `icon-convention.md` owes no new row. What is
 * NOT inherited is the colour: those are `--panel-*` tokens, and the run-surface equivalents
 * are taken from the CANVAS's own reading→tone decision (`NodeRunOverlay.tsx`'s `RING_STROKE`,
 * which is private to that file's SVG) so that a step reads the same colour on the canvas and
 * on this spine.
 */
import { cn } from "@/lib/utils"
import { fmtElapsed } from "@/lib/fmtElapsed"
import { own } from "@/components/workflows/ownProperty"
import {
  declaredCount,
  readInstant,
  type PhaseTimingRow,
} from "@/components/workflows/phaseDuration"
import { countDeclared, timeRunning } from "@/components/workflows/receiptVocabulary"
import { SPINE_HEADING } from "@/components/workflows/transcriptVocabulary"

/**
 * The page's live reading for one step, structurally declared.
 *
 * ⚠ A READ SHAPE, NOT A SECOND HOME for `NodeRunState` — the `PhaseTimingRow` precedent. It
 * keeps this component free of any runtime import from the canvas vocabulary or `@/lib/api`,
 * so `196-08`'s mock-factory failure mode is unreachable from here by construction.
 */
export interface SpineLiveReading {
  reading: string
  label: string
}

/**
 * reading → { glyph, tone } for the ring.
 *
 * ⚠ THE GLYPHS ARE INHERITED, THE COLOURS ARE THE CANVAS'S. See the file docblock: same marks
 * as the developer panel (zero net-new vocabulary), same colours as the canvas (so one step
 * does not read green on one surface and grey on another).
 *
 * ⚠ READ THROUGH `own()`. A reading arrives as a plain `string` on a read shape, and a bare
 * index into an object literal returns an inherited member for a prototype key — the WR-04
 * sink this tree has measured at nine sites, one of them in the run log beside this file.
 */
const READING_FACE: Record<string, { glyph: string; tone: string; dim?: boolean }> = {
  done: { glyph: "✓", tone: "text-[hsl(var(--success))]" },
  failed: { glyph: "✕", tone: "text-[hsl(0_80%_80%)]" },
  running: { glyph: "●", tone: "text-primary" },
  "waiting-for-you": { glyph: "!", tone: "text-accent-violet-text" },
  "not-started": { glyph: "○", tone: "text-muted-foreground", dim: true },
  skipped: { glyph: "⤳", tone: "text-muted-foreground", dim: true },
  "recorded-not-sent": { glyph: "↛", tone: "text-muted-foreground" },
  cancelled: { glyph: "⏹", tone: "text-muted-foreground" },
  unknown: { glyph: "?", tone: "text-muted-foreground" },
}

const FALLBACK_FACE = { glyph: "?", tone: "text-muted-foreground", dim: false }

export interface RunSpineProps {
  /** The run's durable phase rows, IN THE ORDER THE SERVER GAVE THEM. */
  phases: readonly PhaseTimingRow[]
  /** The step's human name — the page's, never re-derived here. */
  titleOf: (slug: string) => string
  /** The page's already-worded live reading per step. */
  liveOf?: (slug: string) => SpineLiveReading | undefined
  /**
   * Rendered INSIDE the spine, at the step it belongs to. ⚠ The sheet puts the answer control
   * in the row rather than above the list, which is what makes it obvious WHICH step is
   * waiting; a stack floating above a spine says only that something is.
   */
  renderAsk?: (slug: string) => React.ReactNode
  /** The instant to tick the running step against — hoist ONE per render (P-1). */
  now?: number
}

export function RunSpine({ phases, titleOf, liveOf, renderAsk, now = Date.now() }: RunSpineProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[52px] shrink-0 items-center border-b border-border/10 px-5">
        <h2 className="text-[13px] font-semibold text-foreground">{SPINE_HEADING}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/* ⚠ THE CONNECTING LINE IS WHAT MAKES THIS READ AS A SPINE rather than a list, and it
            is the sheet's own device (`absolute left-3.5 top-4 bottom-4 w-px`). It sits BEHIND
            the rings — hence the z-ordering — so each ring punches through it. */}
        <div className="relative">
          <div
            aria-hidden="true"
            data-testid="spine-rail"
            className="absolute bottom-4 left-[13px] top-4 z-0 w-px bg-border/60"
          />
          <ol className="relative z-10 flex flex-col gap-5">
            {phases.map((row) => {
              const live = liveOf?.(row.slug)
              const face = (live ? own(READING_FACE, live.reading) : undefined) ?? FALLBACK_FACE
              const isRunning = live?.reading === "running"
              const waiting = live?.reading === "waiting-for-you"
              const count = declaredCount(row)
              const startedAt = readInstant(row.started_at)
              const ask = renderAsk?.(row.slug)

              return (
                <li
                  key={row.slug}
                  data-testid={`spine-step-${row.slug}`}
                  data-reading={live?.reading}
                  className="flex gap-4"
                >
                  <span
                    aria-hidden="true"
                    data-testid="spine-mark"
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-background text-[13px] leading-none",
                      waiting ? "border-accent-violet" : "border-border/40",
                      face.tone,
                      isRunning && "animate-pulse",
                    )}
                  >
                    {face.glyph}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        data-testid="spine-title"
                        className={cn(
                          "min-w-0 truncate text-[13px] font-medium",
                          face.dim ? "text-muted-foreground" : "text-foreground",
                          waiting && "text-accent-violet-text",
                        )}
                      >
                        {titleOf(row.slug)}
                      </span>
                      {/* ⚠ A TIME ON THE RUNNING STEP ONLY — the sheet prints one, and only on
                          the row in progress. Durations of finished steps live in the run log;
                          repeating them here is the duplication this re-port removes. */}
                      {/* ⚠ `timeRunning`, NOT A BARE FIGURE, AND A FENCE CAUGHT THE DIFFERENCE.
                          The sheet prints `00:15` and lets the pulsing node disclose that the
                          step is unfinished; this tree states it in WORDS instead, because a
                          bare duration beside a step reads as a FINAL one and the surface's own
                          rule is that a status is never signalled by treatment alone. It is the
                          shipped vocabulary's phrase, so the live tick is worded the same here
                          as everywhere else it appears. */}
                      {isRunning && startedAt !== null && (
                        <span
                          data-testid="spine-elapsed"
                          className="shrink-0 font-mono text-[11px] tabular-nums text-primary"
                        >
                          {timeRunning(fmtElapsed(Math.max(0, now - startedAt)))}
                        </span>
                      )}
                    </span>
                    {/* ⚠ THE DECLARED COUNT, OR NOTHING AT ALL. See the file docblock: the
                        sheet's prose sub-line is narration this product does not hold. */}
                    {count && (
                      <span
                        data-testid="spine-count"
                        className="truncate text-[11px] text-muted-foreground"
                      >
                        {countDeclared(count.count, count.noun)}
                      </span>
                    )}
                    {ask ? (
                      <span data-testid="spine-ask" className="mt-1 block">
                        {ask}
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

export default RunSpine
