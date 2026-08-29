/**
 * Phase 217 (LIB-03 / D-217-09 / D-217-24) — the ingestion pipeline's six stages, in the order
 * the BACKEND WRITES THEM, plus the one predicate that decides whether a conditional stage was
 * skipped.
 *
 * ── ⭐ WHY THE ORDER IS THE WHOLE POINT ────────────────────────────────────────────────
 * `backend/app/api/documents.py` writes `ingestion_step` at six sites, in this sequence:
 *
 *     "extracting"          the raw text extract          (inside the extract pass)
 *     "chunking"            split into searchable pieces
 *     "embedding"           build the vectors
 *     "extracting_tables"   \  BOTH inside the single `if raw and mime_type:` block —
 *     "extracting_images"   /  they run AFTER embedding, not before it
 *     "metadata"            title/author/date detection, immediately before the terminal write
 *
 * The sketch (`.planning/sketches/218-the-library-and-its-tabs`) originally drew Tables and
 * Images SECOND and THIRD. Rendered against the real sequence, a strip built on the drawn order
 * would light segment 5 and then segment 2 — it would visibly JUMP BACKWARDS. The sketch was
 * corrected to this order in the same plan; this file, not the sketch, is the source, and
 * `IngestionStrip.test.tsx` pins it against `documents.py`'s live source as an ORDERED array.
 *
 * ⛔ Do NOT sort this array anywhere. A sorted comparison is blind to precisely the defect
 * D-217-09 exists to fix (the sketch's own `A5b` fence sorted, and could not have caught it).
 *
 * ── THE TWO CONDITIONAL STAGES, AND WHY MIME ALONE IS NOT ENOUGH ───────────────────────
 * `tables_stage_applies` / `images_stage_applies` are SERVER-DERIVED from `mime_type`
 * (pydantic `@computed_field`s on `DocumentResponse`, plan 217-01). They answer "would the
 * pipeline's table/image pass run for this file type at all?".
 *
 * ⚠ They are NOT sufficient on their own. `multimodal_service`'s `extracted_doc` fast path can
 * supply tables or images for ANY mime, so a document whose flag reads `false` may still have a
 * non-zero count — and a stage that PRODUCED something was self-evidently reached. The skipped
 * predicate therefore requires BOTH the flag `false` AND the count `0`.
 *
 * ⚠ And `undefined` is not `false`. The derived pair does not ride the Supabase Realtime
 * `payload.new` (there are no such DB columns), and `useDocuments.ts`'s INSERT arm does no
 * spread-merge — so a document inserted in another tab arrives with both flags `undefined`.
 * `undefined` means UNKNOWN, and the honest rendering of unknown is PENDING, never skipped.
 * Striking out a stage we cannot prove was skipped is the same lie in the other direction.
 *
 * ⚠ `ingestion_step` is NEVER CLEARED (D-217-23). On a `completed` document it reads
 * `"metadata"` by RESIDUE. Nothing here clears it and nothing may ask the backend to —
 * `backend/app/services/text_sanitize.py:9` diagnoses BUG-260825-01 by reading the PAIR
 * `status=failed / ingestion_step=embedding`. Nulling the column would delete a diagnostic.
 *
 * Zero React imports by construction: this is a strict leaf, so a fence may read it without
 * mounting anything.
 */
import type { Document } from "@/types"

/** The six `ingestion_step` values, keyed exactly as the backend writes them. */
export type IngestionStageKey =
  | "extracting"
  | "chunking"
  | "embedding"
  | "extracting_tables"
  | "extracting_images"
  | "metadata"

export interface IngestionStage {
  /** The literal `ingestion_step` value. Also the `ingest.<key>` suffix in `TERM_MAP`. */
  key: IngestionStageKey
  /** True when the pipeline runs this stage only for some files. Exactly two are conditional. */
  conditional: boolean
  /** The server-derived applicability flag governing this stage — `null` for unconditional ones. */
  appliesField: "tables_stage_applies" | "images_stage_applies" | null
  /** The count that proves the stage produced something — `null` for unconditional ones. */
  countField: "table_count" | "image_count" | null
}

/**
 * ⭐ BACKEND WRITE ORDER. Not alphabetical, not the sketch's drawn order, not "logical" order.
 * Pinned against `backend/app/api/documents.py` by an ORDERED fence.
 */
export const INGESTION_STAGES: readonly IngestionStage[] = [
  { key: "extracting", conditional: false, appliesField: null, countField: null },
  { key: "chunking", conditional: false, appliesField: null, countField: null },
  { key: "embedding", conditional: false, appliesField: null, countField: null },
  {
    key: "extracting_tables",
    conditional: true,
    appliesField: "tables_stage_applies",
    countField: "table_count",
  },
  {
    key: "extracting_images",
    conditional: true,
    appliesField: "images_stage_applies",
    countField: "image_count",
  },
  { key: "metadata", conditional: false, appliesField: null, countField: null },
] as const

/** The `TERM_MAP` key for a stage. One vocabulary, never a seventh. */
export function stageTermKey(stage: IngestionStage): `ingest.${IngestionStageKey}` {
  return `ingest.${stage.key}`
}

/**
 * D-217-24 — was this stage skipped, i.e. would the pipeline never have run it for this file?
 *
 * TRUE only when all three hold:
 *   1. the stage is CONDITIONAL (an unconditional stage is never skipped),
 *   2. its applicability flag is EXPLICITLY `false` (`undefined` is unknown → not skipped),
 *   3. its count is `0` (a non-zero count proves the `extracted_doc` fast path produced rows,
 *      so the stage was reached regardless of what the mime-derived flag says).
 */
export function isStageSkipped(
  stage: IngestionStage,
  doc: Pick<
    Document,
    "tables_stage_applies" | "images_stage_applies" | "table_count" | "image_count"
  >,
): boolean {
  if (!stage.conditional || stage.appliesField === null || stage.countField === null) return false
  if (doc[stage.appliesField] !== false) return false
  return (doc[stage.countField] ?? 0) === 0
}

/**
 * The index of `step` within `INGESTION_STAGES`, or `-1` when it is null/unknown.
 *
 * ⚠ Callers must NOT pass a `completed` document's `ingestion_step` — it is residue there
 * (D-217-23), and `IngestionStrip` never reads it on that arm.
 */
export function stageIndex(step: string | null | undefined): number {
  if (!step) return -1
  return INGESTION_STAGES.findIndex((s) => s.key === step)
}
