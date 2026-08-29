/**
 * Phase 217.1 plan 04 (LIB-03 / D-217.1-26) — the four-card fold over the six
 * backend ingestion stages.
 *
 * The pipeline row shows four cards — Reading · Splitting · Indexing · Labelling —
 * replacing the shipped six. D-217.1-26 folds `extracting_tables` and `extracting_images`
 * into Indexing (not Reading), because both stages run AFTER embedding in the measured
 * write order (`documents.py:2277, 2315, 2326`), and folding them into card 1 would make
 * an in-flight file visibly jump backwards.
 *
 * The monotonic mapping:
 *   extracting        → Reading
 *   chunking          → Splitting
 *   embedding         → Indexing
 *   extracting_tables → Indexing
 *   extracting_images → Indexing
 *   metadata          → Labelling
 *
 * Imports stage identity from `ingestionStages.ts` rather than re-declaring the
 * six stage strings.
 */
import { INGESTION_STAGES, type IngestionStageKey } from "@/components/ingestion/ingestionStages"

export type PipelineCard = "reading" | "splitting" | "indexing" | "labelling"

/** The four pipeline cards, in render order. */
export const PIPELINE_CARDS: readonly PipelineCard[] = [
  "reading",
  "splitting",
  "indexing",
  "labelling",
] as const

/** Human-readable labels for each card. */
export const CARD_LABEL: Record<PipelineCard, string> = {
  reading: "Reading",
  splitting: "Splitting",
  indexing: "Indexing",
  labelling: "Labelling",
}

/**
 * Map a backend stage key to its pipeline card.
 *
 * D-217.1-26: `extracting_tables` and `extracting_images` fold into Indexing,
 * not Reading, preserving monotonicity over the measured write order.
 */
export function cardForStage(stage: IngestionStageKey): PipelineCard {
  switch (stage) {
    case "extracting":
      return "reading"
    case "chunking":
      return "splitting"
    case "embedding":
      return "indexing"
    case "extracting_tables":
      return "indexing"
    case "extracting_images":
      return "indexing"
    case "metadata":
      return "labelling"
  }
}

/**
 * Assert exhaustiveness at build time: every shipped stage has a card.
 * This is a compile-time assertion; if INGESTION_STAGES gains a seventh stage,
 * this line will fail because not all keys are covered by cardForStage.
 */
const _exhaustiveCheck: Record<IngestionStageKey, PipelineCard> = {
  extracting: "reading",
  chunking: "splitting",
  embedding: "indexing",
  extracting_tables: "indexing",
  extracting_images: "indexing",
  metadata: "labelling",
}
void _exhaustiveCheck // consumed only for type-checking
