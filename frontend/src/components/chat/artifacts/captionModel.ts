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
 */
import type { ArtifactRecord, LineageOperation } from "./artifactSpec"
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
  captionSource,
  moreSuffix,
  operationPhrase,
  rowsPhrase,
} from "./artifactCopy"

export interface CaptionSegments {
  /** `file` when a data-bearing tool ran this turn; `info` when the agent provided the values. */
  icon: "file" | "info"
  parts: string[]
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

  if (record.component !== "metric") parts.push(rowsPhrase(caption.row_count))

  return { icon, parts }
}
