/**
 * Phase 273-02 (D-04 · sketch 3A · UI-D-05) — the provenance caption, derived from SERVER FACTS ONLY.
 *
 * The caption is the audit line under every artifact: which tool produced the numbers, from which
 * document, and — for a by-reference follow-up — which rows survived, of how many. It is composed
 * ONLY from `record.caption` (the server's structured facts, built from the turn's tool calls) and
 * phrased ONLY by `artifactCopy.ts`. ⛔ Nothing here reads the title, a cell or any other model text,
 * so the model cannot write its own provenance.
 *
 * Grammar (UI-SPEC §Caption): `[lineage segments…] [source segment] [N rows]`, joined with ` · `.
 * A metric omits the trailing row count.
 *
 * 292-02 (D-15 · UI-D-292-20): the trailing count segment is phrased PER COMPONENT from the VALIDATED
 * spec arrays (lengths the guard already checked against row_count, never model text):
 * `8 steps · 9 links`, `3 options × 7 terms`, `9 events`. Comparison alone adds an optional `note`
 * (the second caption line), chosen by one fact: whether any cell carries a source. ⛔ No count here
 * may depend on the viewer's clock — the caption must stay byte-identical on reload (D-18).
 */
import { isResolvedSource, type ArtifactRecord, type LineageOperation } from "./artifactSpec"
import {
  CAPTION_DATA_PREFIX,
  CAPTION_MAX_SOURCES,
  CAPTION_NO_SOURCE,
  CAPTION_NO_SOURCE_DOC,
  CAPTION_SOURCE_JOIN,
  OPERATION_ORDER,
  captionLineageFrom,
  captionLineageSame,
  captionOfRows,
  COMPARISON_NOTE,
  COMPARISON_NOTE_SOURCED,
  CAPTION_SEGMENT_JOIN,
  captionSource,
  eventsPhrase,
  linksPhrase,
  moreSuffix,
  operationPhrase,
  optionsTermsPhrase,
  rowsPhrase,
  stepsPhrase,
} from "./artifactCopy"

export interface CaptionSegments {
  /** `file` when a data-bearing tool ran this turn; `info` when the agent provided the values. */
  icon: "file" | "info"
  parts: string[]
  /** 292: the comparison's second caption line; absent for every other component. */
  note?: string
}

function orderedOperations(ops: LineageOperation[]): LineageOperation[] {
  return ops
    .map((op, i) => ({ op, i }))
    .sort((a, b) => OPERATION_ORDER[a.op.op] - OPERATION_ORDER[b.op.op] || a.i - b.i)
    .map(({ op }) => op)
}

export function captionSegments(record: ArtifactRecord): CaptionSegments {
  const { caption } = record
  const parts: string[] = []

  const lineage = caption.lineage
  if (lineage) {
    if (lineage.same_rows) {
      parts.push(...captionLineageSame(lineage.parent_label, lineage.parent_row_count))
    } else {
      parts.push(captionLineageFrom(lineage.parent_label))
      parts.push(...orderedOperations(lineage.operations).map(operationPhrase))
      parts.push(captionOfRows(caption.row_count, lineage.parent_row_count))
    }
  }

  let icon: CaptionSegments["icon"] = "info"
  if (caption.sources.length > 0) {
    icon = "file"
    const named = caption.sources.slice(0, CAPTION_MAX_SOURCES)
    const total = Math.max(caption.source_count, caption.sources.length)
    const rest = total - named.length
    const list = named.map((s) => captionSource(s.tool, s.document, s.page)).join(CAPTION_SOURCE_JOIN)
    parts.push(`${CAPTION_DATA_PREFIX}${list}${rest > 0 ? ` ${moreSuffix(rest)}` : ""}`)
  } else {
    parts.push(CAPTION_NO_SOURCE, CAPTION_NO_SOURCE_DOC)
  }

  const { diagram, comparison, timeline } = record.spec
  if (diagram) {
    parts.push(`${stepsPhrase(diagram.nodes.length)}${CAPTION_SEGMENT_JOIN}${linksPhrase(diagram.edges.length)}`)
  } else if (comparison) {
    parts.push(optionsTermsPhrase(comparison.options.length, comparison.terms.length))
    const sourced = comparison.terms.some((t) => t.cells.some((c) => isResolvedSource(c.source)))
    return { icon, parts, note: sourced ? COMPARISON_NOTE_SOURCED : COMPARISON_NOTE }
  } else if (timeline) {
    parts.push(eventsPhrase(timeline.events.length))
  } else if (record.component !== "metric") {
    parts.push(rowsPhrase(caption.row_count))
  }

  return { icon, parts }
}
