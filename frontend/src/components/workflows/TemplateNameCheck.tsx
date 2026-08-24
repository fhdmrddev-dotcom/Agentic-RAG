/**
 * Phase 193.1-09 (AUTH-03 / SC#3 — D-10 / D-11 / D-12 / D-20 / D-22) — TemplateNameCheck:
 * what this template asks for, next to what these steps name.
 *
 * ── IT OWNS ITS OWN FILE, BY STANDING ORDER (G-5 / D-22) ──────────────────────────────────
 * The step-rail panel this mounts inside measures 15 commits across 7 phases and 1136 lines,
 * so G-5 fires on it. The hot-file ledger closes that row with an INSTRUCTION rather than a
 * status: *"the next surface that needs the panel gets its own component and one gated line."*
 * Phase 185 honoured it with the governance section, Phase 193 honoured it again with the
 * attach section, and this is the third. **A name check written inline into that panel would
 * turn an honoured guardrail into a violated one**, and no override is recorded for this
 * phase. The panel's whole cost here is one optional prop and one gated line; every rule
 * below lives in this file.
 *
 * ⚠ THE PANEL'S FILENAME IS NOT SPELLED ANYWHERE IN THIS FILE, INCLUDING HERE, AND THAT IS A
 * CHECKED PROPERTY RATHER THAN A HABIT: the suite reads this file's own source and asserts the
 * name is absent in either direction, so the "imports no panel symbol" claim stays true under
 * a later edit. The check is a RAW sweep, so prose counts — a docblock naming the panel would
 * red it, which is the fence working rather than misfiring.
 *
 * ── IT IS A NAME CHECK. IT IS NOT A COVERAGE CHECK, AND IT MAY NEVER READ AS ONE ──────────
 * The disclaiming sentence renders on EVERY non-empty check, without exception, and that is
 * the single most important thing on this surface. At attach time the app has placeholder
 * names, phase slugs and declared run-input keys — a HEURISTIC. Only at RUN time does the real
 * coverage check run, over an emitted field map WITH VALUES, producing the covered-key set and
 * the covers-template flag — a VERDICT. This surface may say that nothing in the steps NAMES a
 * field. It may never say the document is uncovered.
 *
 * ── THREE BUCKETS, NEVER TWO (D-10's red line) ────────────────────────────────────────────
 * A field the run supplies is not a gap: nothing produces it and nothing should. A two-bucket
 * check lists those as problems, and an author told twice that a correct workflow is broken
 * stops reading the panel entirely. The run-input bucket is the false-alarm guard, and its
 * note renders beside it whenever it is non-empty.
 *
 * ── ⚠ AN EMPTY BUCKET RENDERS NOTHING (D-20, and 193's D-15 rule one surface later) ───────
 * Not a heading, not a zero, not a sentence. An empty *produced* bucket must never read as
 * "no step produces anything" — because measured, that is the COMMON case and it is not a
 * defect. The suite asserts both empty arms against ONE SHARED expected value, so an empty
 * produced bucket and an empty run-input bucket are indistinguishable BY CONSTRUCTION rather
 * than by promise: neither can drift into carrying a claim without the other moving too.
 *
 * ── ⚠ DESIGNED FOR THE DEGENERATE CASE FIRST, BECAUSE IT IS THE COMMON ONE ────────────────
 * Measured across all 74 template-binding definitions: phase slugs matching any of the eight
 * known placeholder names → **0**. Re-measured after the fix that made template-aware drafts
 * real: the definition-level input list stayed empty on 6 of 6 runs, slug reach 0–2 of 8. So
 * the realistic first render of this component is *eight fields, all named nowhere*, and NOT
 * ONE WORD ON IT MAY READ AS AN ALARM. The suite sweeps the whole degenerate render for
 * `gap|missing|uncovered|incomplete|broken|error|problem` and expects no match.
 *
 * ── D-12: IT STRUCTURALLY CANNOT WRITE ────────────────────────────────────────────────────
 * The props declare no callback that mutates anything, and that is the guarantee — not a
 * convention. A reconcile that wrote the definition JSONB would be a SECOND WRITER against the
 * `If-Match` token Phase 186's save loop exists to protect. The suite sweeps this file's own
 * source for every write-callback name in the codebase's vocabulary and expects none.
 *
 * ── D-11: CAPPED, AND EXPANDING IN PLACE. ONE HOME FOR ONE LIST ───────────────────────────
 * Three rows per bucket, then a control that expands the list WHERE IT STANDS. ⚠ D-20 measured
 * that this cap fires on essentially every real template, so it is a primary path and not an
 * edge. Two alternatives are REJECTED here rather than left unmentioned:
 *   • **a modal past a threshold** — two presentations of one list, which is the exact
 *     two-homes-drift argument that decided sketch 165, plus a threshold nobody can justify;
 *   • **an uncapped scrolling rail** — it puts the common SMALL case inside a scroll region.
 *
 * ── ⚠ WHAT THE APPROVED SKETCH DRAWS THAT THIS DELIBERATELY DOES NOT BUILD ────────────────
 * Measured against sketch 167's own generated DOM, three divergences, each stated rather than
 * smoothed:
 *   1. **No button.** The sketch's variant-C block ends in a control reading *"Ask the AI to
 *      reconcile"* — an escalation into variant **B**, which was REJECTED on size (a second
 *      model call and a diff surface is too much build for a safety net). Shipping it would
 *      ship a door onto rejected work. The `reconcile.action` string in the vocabulary module
 *      belongs to that same rejected variant's button (the sketch renders it only in B's
 *      stage), so it renders NOWHERE here. It is left exported and unrendered deliberately:
 *      deleting it would lower a pinned count for a string a later phase may want.
 *   2. **No count sentence.** The sketch leads with *"Nothing in the steps names 4 of the 8
 *      fields."* That sentence is in no string table, so shipping it would be inventing copy —
 *      which this phase's copy ruling forbids — and in the degenerate case it would read
 *      "8 of the 8", which is the alarm the whole design avoids.
 *   3. **Buckets are LABELLED, not encoded in a glyph.** The sketch draws one flat list where
 *      a ✓ / ○ / ◇ carries the bucket. That legend is unreadable in the case that actually
 *      ships — eight rows sharing one glyph — and the vocabulary module already ships three
 *      bucket LABEL strings, which is the built contract.
 *
 * A LEAF: no context, no store, no router, no network. It receives a classification and
 * renders it; it computes nothing.
 */
import { useState } from "react"

import type { TemplateNameClassification } from "./templateNameBuckets"
import {
  BUCKET_NAMED_NOWHERE,
  BUCKET_PRODUCED,
  BUCKET_RUN_INPUT,
  NAME_CHECK_DISCLAIM,
  NAME_CHECK_HEADING,
  nameCheckRunInputNote,
  showAllLabel,
} from "./templateFirstVocabulary"

/** D-11's cap — rows shown per bucket before the expand control appears.
 *
 *  ⚠ THREE, AND IT WILL FIRE ON ESSENTIALLY EVERY REAL TEMPLATE (D-20's measurement: eight
 *  fields, all in one bucket, on the common case). Exported so the suite pins the number
 *  rather than re-deriving it, and so a future change to it is a visible one. */
export const NAME_CHECK_CAP = 3

/** The three buckets in render order, each bound to its shipped label. The id doubles as the
 *  testid suffix, so a bucket cannot acquire a second identity. */
const BUCKETS = [
  { id: "produced", label: BUCKET_PRODUCED, key: "produced" },
  { id: "run-input", label: BUCKET_RUN_INPUT, key: "runInput" },
  { id: "nowhere", label: BUCKET_NAMED_NOWHERE, key: "nowhere" },
] as const

const SECTION_CLASSES = "mt-3 rounded border border-border bg-muted/40 px-2.5 py-2"
const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"
const LABEL_CLASSES = "mt-2 text-[10.5px] font-medium leading-snug text-foreground"
const CONTROL_CLASSES = [
  "mt-1 text-[10.5px] leading-snug text-muted-foreground underline underline-offset-2",
  "hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary",
].join(" ")

export interface TemplateNameCheckProps {
  /**
   * The already-computed classification. ⚠ THE ONLY PROP, AND IT CARRIES NO CALLBACK — that
   * is D-12 by construction rather than by discipline: with no mutating callback in this
   * interface, no future edit of this component can become a second writer on the definition
   * JSONB without first changing the shape a caller passes.
   */
  classification: TemplateNameClassification
}

export function TemplateNameCheck({ classification }: TemplateNameCheckProps) {
  // Expansion is LOCAL and PER BUCKET — one home for one list (D-11). Nothing is persisted:
  // a check re-read on the next panel open is the same check.
  const [expanded, setExpanded] = useState<readonly string[]>([])

  const rows = BUCKETS.map((bucket) => ({
    ...bucket,
    names: classification[bucket.key],
  })).filter((bucket) => bucket.names.length > 0)

  // Nothing to compare ⇒ nothing on screen. An empty check must not announce itself, for the
  // same reason an empty BUCKET must not: absence is not a finding.
  if (rows.length === 0) return null

  return (
    <section data-testid="name-check" className={SECTION_CLASSES}>
      <h3 data-testid="name-check-heading" className="text-[11px] font-medium text-foreground">
        {NAME_CHECK_HEADING}
      </h3>

      {rows.map((bucket) => {
        const open = expanded.includes(bucket.id)
        const shown = open ? bucket.names : bucket.names.slice(0, NAME_CHECK_CAP)
        return (
          <div key={bucket.id} data-testid={`name-check-bucket-${bucket.id}`}>
            <p className={LABEL_CLASSES}>{bucket.label}</p>
            {/* Names are ordinary React text children — escaped by construction. They
                originate in a user-uploaded document, and nothing in this file reaches for
                the raw-markup escape hatch React makes a caller opt into by name (the suite
                sweeps this source for it, prose included, and finds it zero times). Rendered
                in the order the document asked, not re-sorted: the order is part of the
                answer. */}
            <ul className={`${NOTE_CLASSES} list-disc pl-4`}>
              {shown.map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  data-testid={`name-check-row-${bucket.id}`}
                  className="break-all font-mono"
                >
                  {name}
                </li>
              ))}
            </ul>

            {/* THE FALSE-ALARM GUARD, beside the bucket it guards — never as a global note,
                because a sentence about run inputs floating beside a bucket of something else
                is the two-homes drift in miniature. */}
            {bucket.id === "run-input" && (
              <p data-testid="name-check-run-input-note" className={NOTE_CLASSES}>
                {nameCheckRunInputNote(bucket.names.length)}
              </p>
            )}

            {/* D-11 — expands IN PLACE, inside this same node. No dialog, no navigation. The
                control names the FULL count, so what it promises to reveal is what it reveals. */}
            {!open && bucket.names.length > NAME_CHECK_CAP && (
              <button
                type="button"
                data-testid={`name-check-show-all-${bucket.id}`}
                className={CONTROL_CLASSES}
                onClick={() => setExpanded((prev) => [...prev, bucket.id])}
              >
                {showAllLabel(bucket.names.length)}
              </button>
            )}
          </div>
        )
      })}

      {/* ⚠ THE LOAD-BEARING SENTENCE. It renders on EVERY non-empty check, unconditionally —
          there is no arm of this component that shows buckets without it. Without it the
          panel asserts a coverage verdict it cannot compute. */}
      <p
        data-testid="name-check-disclaim"
        className="mt-2 border-t border-border/60 pt-1.5 text-[10.5px] leading-snug text-muted-foreground"
      >
        {NAME_CHECK_DISCLAIM}
      </p>
    </section>
  )
}

export default TemplateNameCheck
