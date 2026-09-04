/**
 * Phase 217.1 plan 04 (LIB-03 / D-217.1-07 / D-217.1-26) — the six-stage to four-card fold.
 *
 * ⭐ THE FOLD — the shipped six `IngestionStage` values collapse into exactly four cards
 * per D-217.1-26 (operator-ruled, overriding the literal ledger mapping):
 *
 *   | Backend stage       | Card       |
 *   |---------------------|------------|
 *   | `extracting`        | Reading    |
 *   | `chunking`          | Splitting  |
 *   | `embedding`         | Indexing   |
 *   | `extracting_tables` | Indexing   |
 *   | `extracting_images` | Indexing   |
 *   | `metadata`          | Labelling  |
 *
 * ⚠ THE ORDER IS MONOTONIC (D-217.1-26). A document's `ingestion_step` progresses through the
 * backend write-order sequence `extracting → chunking → embedding → extracting_tables →
 * extracting_images → metadata`, and `PIPELINE_CARDS.indexOf(cardForStage(stage))` is
 * non-decreasing across that sequence — a document never appears to jump backwards.
 *
 * ⛔ DO NOT SORT. `drive.cjs`'s `A5b` assertion sorts before comparing, so it cannot catch a
 * mis-ordering. The fold's own test compares ORDERED arrays.
 *
 * Zero React imports by construction: this is a pure leaf, consumable by a fence without
 * mounting anything.
 */
import type { IngestionStageKey } from "@/components/ingestion/ingestionStages"

/** The four card ids, in display order. */
export type PipelineCardId = "reading" | "splitting" | "indexing" | "labelling"

/** The four cards, left-to-right, exactly as the sketch draws them. */
export const PIPELINE_CARDS: readonly PipelineCardId[] = [
  "reading",
  "splitting",
  "indexing",
  "labelling",
] as const

/** The ONE human name per card. Never a seventh vocabulary. */
export const CARD_LABEL: Record<PipelineCardId, string> = {
  reading: "Reading",
  splitting: "Splitting",
  indexing: "Indexing",
  labelling: "Labelling",
}

/**
 * The six-to-four fold per D-217.1-26.
 *
 * `extracting_tables` and `extracting_images` fold into Indexing because both stages run AFTER
 * `embedding` in the measured write order (`documents.py:2277, 2315, 2326`). Folding them into
 * Reading would make an in-flight file visibly jump backwards — the exact defect
 * `ingestionStages.ts` was written to fix.
 */
export function cardForStage(stage: IngestionStageKey): PipelineCardId {
  switch (stage) {
    case "extracting":
      return "reading"
    case "chunking":
      return "splitting"
    case "embedding":
    case "extracting_tables":
    case "extracting_images":
      return "indexing"
    case "metadata":
      return "labelling"
  }
}