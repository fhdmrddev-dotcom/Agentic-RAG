/**
 * Phase 187-13 Task 1 (VOCAB-02 / Req 5, sketch 150-B winner, D-187-08/09/10/14) —
 * SeedReceipt.
 *
 * THE SAFETY THE AI SILENTLY APPLIED, MADE LEGIBLE. A seeded draft arrives with steps
 * already wearing a ⛨ seal the author never asked for, and nothing on the canvas says
 * why. Safety nobody can see is indistinguishable from magic, and magic is not trust.
 * This card names the step count, then every auto-grounded step WITH ITS REASON, states
 * the one-way rule plainly rather than letting it be discovered by being refused, and
 * closes by saying nothing has been committed. It is SC#3's surface.
 *
 * ── THIS COMPONENT AUTHORS NO SENTENCE OF ITS OWN, AND CONSULTS NO SERVER ──
 * Every user-visible string is an identifier imported from `definitionOps` — the same
 * `GovernanceSection` / `StepTypePicker` / `STRANDING_REASON` idiom, for the same
 * reason: a sentence that lives inside a component is a sentence nobody can test for
 * drift (T-187-10-05). Its suite asserts character-identity against those imported
 * names. This module imports nothing from the API client, names no route and opens no
 * request; a `?raw` fence in `SeedReceipt.test.tsx` proves it, with a positive control.
 *
 * ── IT RENDERS A REASON, IT NEVER DECIDES ONE (D-187-08 / T-187-13-02) ──
 * The cause per step comes from `groundingCauseOf`, declared in `phaseVocabulary.ts` as
 * THE ONE CLIENT GROUNDING DERIVATION, read over the `kbTools` list the SERVER supplies
 * (`api/workflows.py:745` → `useGroundingBundle` → the page). This file writes no KB
 * tool name and classifies nothing, so a sixth KB tool added server-side is picked up
 * here for free and there is no second derivation to drift. `POST /generate` returns no
 * grounding verdict at all (`workflows.py:1323` — `{ok, definition}`), which is why
 * SPEC Req 5's "rendered from the server's own verdict" is read per D-187-08 as
 * "never INVENT a reason string client-side". The safety-DEFINING input is still the
 * server's; the client only intersects and renders.
 *
 * The named tool in a `detected` row is taken from the REAL intersection
 * (`config.available_tools ∩ kbTools`), never a hardcoded tool id — no KB tool name is
 * written anywhere in this file, so a source grep for one returns zero. A step
 * whose intersection cannot be read falls through to `seedReceiptStepReason`'s
 * unqualified sentence — never fabricate, the same floor `derivedFace` holds.
 *
 * ── ONE HONEST SENTENCE PER CAUSE (187-16, review CR-01) ──
 * A card wears the ⛨ seal for ALL THREE causes — `canvasModel.isGrounded` is
 * `groundingCauseOf(...) !== null` — so EVERY sealed step is still listed here. That is
 * the sketch's rule: "never let the seal arrive unexplained. That is the whole of SC#3."
 *
 * What was wrong was not the list, it was the LEAD. `seedReceiptGroundingLead` ends "so
 * I set them to must prove it" — an authorship claim true of `detected` steps and of
 * nothing else — and it shipped taking the SEALED count. Since `/generate` emits the
 * `citation_policy` default, the ordinary draft's `llm_emit` arrives `already-set`, so
 * on the TYPICAL draft the receipt claimed the AI had applied a gate it never touched.
 * The counts are now split at the point of use: the detected paragraph counts
 * `cause === "detected"`, the carried sentence counts the rest and claims nothing.
 *
 * `SEED_RECEIPT_ONE_WAY_RULE` moves with the DETECTED paragraph, because it IS the
 * detected lock (D-185-07). A carried step is undone by whatever set it; "you can't turn
 * that off" over one of those is the same false claim in a different sentence.
 *
 * ── ONE ARRIVAL BEHAVIOUR, ZERO SEALED STEPS INCLUDED (D-187-10) ──
 * With no sealed steps the receipt STILL appears: the orientation half ("here is what I
 * built") and the nothing-committed half are useful regardless. Only the two grounding
 * paragraphs and the step list are conditional, and each conditional is a copy formatter
 * returning the empty string at zero — the same shape for both, so the component asks
 * the question once per paragraph rather than branching on a rule of its own. An empty
 * or fabricated grounded list is what Req 5 forbids; no list at all is the honest shape.
 *
 * ── NOTHING IS STAGED, BECAUSE NOTHING WAS STREAMED (T-187-13-03) ──
 * `generate_workflow_definition` (`workflow_authoring.py:217`) makes EXACTLY ONE
 * provider call on a valid first emit and never yields a partial — the whole definition
 * lands in one DOM batch. So a node-by-node or row-by-row reveal would be PACING DRESSED
 * AS PROGRESS: it would read as the AI still deciding, which is a lie about an event
 * this surface never received. No scheduler call, no frame callback, no per-row stagger
 * and no index-derived timing offset appears anywhere in this file — none of those names
 * is even written here, and the suite forbids the word for the offset outright, so its
 * negative fence cannot be satisfied by its own subject. That fence is a SOURCE property,
 * which is a far cheaper and far stronger proof than observing a negative about timing.
 *
 * Two entrances are spent, both one-shot and both `motion-reduce`-disabled: the shipped
 * panel-entrance idiom (`StepTypePicker.tsx:145`) on the card, and the seal's single
 * arrival pulse — sketch 150-B's "one moment of attention", marking the one thing the
 * user did not ask for. Every seal animates on the same frame; none waits its turn.
 *
 * ── GLYPHS (icon-convention §4) ──
 * `⛨` is the governance seal — the SAME mark `PhaseNodeCard.tsx:440` puts on the card's
 * top-right corner, rendered `aria-hidden` beside the shipped `GOVERNANCE_SEAL_LABEL`
 * so a screen reader hears the words once and not the glyph. `✕` is the plain dismiss,
 * imported as `SEED_RECEIPT_DISMISS_GLYPH` and likewise `aria-hidden`, with the
 * announcement carried by `SEED_RECEIPT_DISMISS_LABEL` (the 185-09 pairing). Sketch
 * 150-C's two review-state marks are UNSHIPPED PROPOSALS and appear nowhere here — they
 * are named by description rather than written out, so a grep for them over this file
 * stays at zero and the suite's glyph fence cannot be satisfied by its own subject.
 *
 * ── NO TECHNICAL TOKEN OF ITS OWN, THEREFORE NO REVEAL ACCESSOR ──
 * The receipt renders each step's business face (`nodeTitle`, the same call the canvas
 * makes, so a row and the card it describes can never name one step two ways) and no
 * slug, code or raw phase type. The tool id inside a `detected` reason is not this
 * component's token to gate: it is inside `seedReceiptStepReason`'s locked sentence, and
 * that formatter reserves its unqualified form for "the tool is not known" — suppressing
 * a tool we DO know would make the copy claim something false. So
 * `useTechnicalNamesOptional` is deliberately not read here; reading a boolean nothing
 * branches on would be dead weight pretending to be a contract.
 *
 * ── A LEAF, and dismissal is the CALLER'S state (D-187-09) ──
 * Presentational and caller-driven: it fetches nothing, holds no store reference and
 * reads no context. `open` is owned by the caller — like `ProblemsTray`, this component
 * never opens or closes itself, it only asks. Dismissal is in-memory per draft, so a
 * reload re-showing the receipt is CORRECT: the grounding it describes is still true and
 * nothing was persisted. `open === false` renders `null` — no hidden DOM and no stale
 * focus trap (T-187-13-06).
 *
 * XSS (T-187-13-04 / the T-184-08-01 rule): every server- or model-authored string —
 * the generated step name, the tool id — renders as a plain React text child. React
 * escapes text children; the raw-HTML prop is never used here.
 */
import { useId, useMemo } from "react"

import {
  GOVERNANCE_SEAL_LABEL,
  SEED_RECEIPT_DISMISS_GLYPH,
  SEED_RECEIPT_DISMISS_LABEL,
  SEED_RECEIPT_NOTHING_COMMITTED,
  SEED_RECEIPT_ONE_WAY_RULE,
  seedReceiptCarriedLead,
  seedReceiptGroundingLead,
  seedReceiptHeading,
  seedReceiptStepReason,
} from "@/components/workflows/definitionOps"
import {
  groundingCauseOf,
  nodeTitle,
  type GroundingCause,
  type NameContext,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import { cn } from "@/lib/utils"

export interface SeedReceiptProps {
  /** The drafted definition's phases, in order. */
  phases: readonly PhaseSpecJSON[]
  /** The SERVER's KB-reading tool list (D-185-09 / D-187-08), passed in by the caller
   *  off `useGroundingBundle`. EMPTY marks nothing — an unread palette must not invent a
   *  grounded step, and the run-time gate is unconditional and server-side regardless.
   *  This component declares no tool-name table of its own. */
  kbTools: readonly string[]
  /** Phase 187 (D-187-05) — the page-owned id→name maps, the SAME object the canvas
   *  hands `toCanvas`, so the receipt and the node it points at agree letter for letter.
   *  Omitted falls through to `nodeTitle`'s frozen empty default: the derived tier misses
   *  and the plain type sentence renders, never a fabricated or id-shaped name. */
  nameContext?: NameContext
  /** Owned by the caller. This component never opens or closes itself. */
  open: boolean
  /** The dismiss control was activated. */
  onDismiss: () => void
}

/** One listed step: which node, what it is called, why it is held — and WHICH CAUSE
 *  holds it, because the two sentences above the list count different causes and a row
 *  that could not say which one it belonged to is a row nothing can check. */
interface GroundedRow {
  slug: string
  face: string
  reason: string
  cause: Exclude<GroundingCause, null>
}

/**
 * The KB tool this step actually reaches for, read off the LOOSE definition-JSONB shape.
 *
 * `available_tools` is author-supplied and hand-editable, so every read is guarded — a
 * projection must not crash on a malformed row (CANVAS-01 totality). The step's own
 * ordering decides which tool is named when several intersect: it is the list the author
 * sees in the panel, so the receipt names what they would name. A miss returns `null`
 * and the reason falls through to its unqualified form rather than guessing.
 */
function intersectingKbTool(
  phase: PhaseSpecJSON,
  kbTools: readonly string[],
): string | null {
  const raw = phase.config?.available_tools
  if (!Array.isArray(raw)) return null
  for (const tool of raw) {
    if (typeof tool === "string" && kbTools.includes(tool)) return tool
  }
  return null
}

export function SeedReceipt({
  phases,
  kbTools,
  nameContext,
  open,
  onDismiss,
}: SeedReceiptProps) {
  const headingId = useId()

  // The grounded list is DERIVED at render from the shipped one-home rule. Nothing here
  // decides a cause; `groundingCauseOf` does, over the server's list.
  const rows = useMemo<GroundedRow[]>(() => {
    const found: GroundedRow[] = []
    for (const phase of phases) {
      const cause: GroundingCause = groundingCauseOf(phase, kbTools)
      if (cause === null) continue
      found.push({
        slug: phase.slug,
        face: nodeTitle(phase, nameContext),
        reason: seedReceiptStepReason(cause, intersectingKbTool(phase, kbTools)),
        cause,
      })
    }
    return found
  }, [phases, kbTools, nameContext])

  const heading = seedReceiptHeading(phases.length)
  // TWO COUNTS, BECAUSE THERE ARE TWO FACTS (CR-01). `rows.length` is what the canvas
  // marks; `detectedCount` is what this generation actually did. Only the second may sit
  // under a sentence that begins "so I set".
  const detectedCount = rows.filter((row) => row.cause === "detected").length
  const carriedCount = rows.length - detectedCount
  // D-187-10 — one conditional shape per paragraph. Each formatter returns "" at zero, so
  // each half is asked about exactly once and the receipt keeps one arrival behaviour.
  const groundingLead = seedReceiptGroundingLead(detectedCount)
  const carriedLead = seedReceiptCarriedLead(carriedCount)

  if (!open) return null

  return (
    <section
      data-testid="seed-receipt"
      // The SEALED total — exactly the number of ⛨ marks the canvas draws for this draft.
      data-grounded-count={rows.length}
      // …and the subset the generation itself grounded. Two numbers, two facts.
      data-detected-count={detectedCount}
      // …and the third fact: the seals this generation did NOT apply, exposed the same
      // way its two siblings are, so the carried paragraph's number is checkable too.
      data-carried-count={carriedCount}
      aria-labelledby={headingId}
      className={cn(
        "w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-lg",
        // The ONE entrance this card earns — the shipped panel idiom, one-shot, and off
        // entirely under `prefers-reduced-motion`. Nothing is staggered and nothing waits
        // its turn: the draft arrived in a single batch and the surface says so.
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-100 motion-reduce:animate-none",
      )}
    >
      <div className="flex items-start gap-3">
        <h2
          id={headingId}
          data-testid="seed-receipt-heading"
          className="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground"
        >
          {heading}
        </h2>

        {/* The glyph is hidden from the a11y tree so the announcement is the label,
            not "✕" — the shipped `PhaseFormPanel.tsx:766` treatment. */}
        <button
          type="button"
          data-testid="seed-receipt-dismiss"
          aria-label={SEED_RECEIPT_DISMISS_LABEL}
          onClick={onDismiss}
          className={cn(
            "inline-grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-muted-foreground",
            "hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
          )}
        >
          <span aria-hidden="true">{SEED_RECEIPT_DISMISS_GLYPH}</span>
        </button>
      </div>

      {groundingLead ? (
        <p
          data-testid="seed-receipt-grounding"
          className="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground"
        >
          <span data-testid="seed-receipt-lead">{groundingLead}</span>{" "}
          {/* The one-way rule is the DETECTED lock, so it lives inside this paragraph and
              never travels to the carried one. */}
          <span data-testid="seed-receipt-one-way">{SEED_RECEIPT_ONE_WAY_RULE}</span>
        </p>
      ) : null}

      {carriedLead ? (
        <p
          data-testid="seed-receipt-carried"
          className="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground"
        >
          {carriedLead}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul
          data-testid="seed-receipt-grounded-list"
          className="mt-3 flex flex-col gap-[7px]"
        >
          {rows.map((row) => (
            <li
              key={row.slug}
              data-testid={`seed-receipt-step-${row.slug}`}
              data-slug={row.slug}
              // WHICH SENTENCE THIS ROW BELONGS TO, read straight off the one derivation.
              // Not decorative: it is what makes "the lead counts only these" checkable.
              data-cause={row.cause}
              className="flex items-start gap-2 text-[12.5px] text-foreground"
            >
              {/* The seal's ONE moment of attention (sketch 150-B) — it marks the one
                  thing the user did not ask for, fires once on arrival and then rests
                  forever. Same disc as the card's corner mark. Every row pulses on the
                  same frame, because they all arrived on the same one. */}
              <span
                aria-hidden="true"
                data-testid="seed-receipt-step-seal"
                className={cn(
                  "mt-[1px] grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full",
                  "text-[11px] leading-none",
                  "border border-[hsl(220_30%_100%/0.34)] bg-[hsl(220_30%_100%/0.1)] text-foreground",
                  "animate-in zoom-in-50 duration-300 motion-reduce:animate-none",
                )}
              >
                ⛨
              </span>
              <span className="sr-only">{GOVERNANCE_SEAL_LABEL}</span>
              <span className="min-w-0 flex-1">
                <strong data-testid="seed-receipt-step-face" className="font-semibold">
                  {row.face}
                </strong>{" "}
                —{" "}
                <span
                  data-testid="seed-receipt-step-reason"
                  className="text-muted-foreground"
                >
                  {row.reason}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p
        data-testid="seed-receipt-close"
        className="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground"
      >
        {SEED_RECEIPT_NOTHING_COMMITTED}
      </p>
    </section>
  )
}
