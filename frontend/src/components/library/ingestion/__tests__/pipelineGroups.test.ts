/**
 * Phase 217.1 plan 04 (LIB-03 / D-217.1-26) — the six-to-four fold fence.
 *
 * ⭐ THREE PROPERTIES, ONE SUITE — exhaustiveness, ordered correctness, monotonicity.
 * ⛔ ORDERED comparison, never sorted — `drive.cjs`'s `A5b` sorts, and cannot catch a reorder.
 */
import { describe, it, expect } from "vitest"
import { cardForStage, PIPELINE_CARDS, CARD_LABEL } from "../pipelineGroups"
import { INGESTION_STAGES } from "@/components/ingestion/ingestionStages"
import type { IngestionStageKey } from "@/components/ingestion/ingestionStages"

// ── THE SIX STAGES IN MEASURED WRITE ORDER ────────────────────────────────────────────────
// Pinned against `backend/app/api/documents.py:2069,2249,2277,2315,2326,2436` — do not re-derive.
const WRITE_ORDER: IngestionStageKey[] = [
  "extracting",
  "chunking",
  "embedding",
  "extracting_tables",
  "extracting_images",
  "metadata",
]

// ── THE FOLD PER D-217.1-26 ────────────────────────────────────────────────────────────────

describe("pipelineGroups — the six-to-four fold (D-217.1-26)", () => {
  it("cardForStage maps each of the six shipped stages to one of the four cards", () => {
    const expected: Record<IngestionStageKey, string> = {
      extracting: "reading",
      chunking: "splitting",
      embedding: "indexing",
      extracting_tables: "indexing",
      extracting_images: "indexing",
      metadata: "labelling",
    }
    for (const stage of WRITE_ORDER) {
      expect(cardForStage(stage), `stage "${stage}" must map to "${expected[stage]}"`).toBe(
        expected[stage],
      )
    }
  })

  it("every stage in INGESTION_STAGES has a defined card — no orphan", () => {
    for (const s of INGESTION_STAGES) {
      const card = cardForStage(s.key)
      expect(card, `stage "${s.key}" is orphaned — no card mapping`).toBeTruthy()
      expect(PIPELINE_CARDS.includes(card), `"${card}" is not a known card id`).toBe(true)
    }
  })

  it("PIPELINE_CARDS is the sketch's four cards in display order", () => {
    // ⛔ ORDERED comparison, never sorted.
    expect(PIPELINE_CARDS).toEqual(["reading", "splitting", "indexing", "labelling"])
  })

  it("the fold is monotonic over the measured write order", () => {
    // A document's card index never goes backwards as it progresses through the pipeline.
    let prevIndex = -1
    for (const stage of WRITE_ORDER) {
      const card = cardForStage(stage)
      const idx = PIPELINE_CARDS.indexOf(card)
      expect(idx, `monotonicity broken at stage "${stage}": card index ${idx} < previous ${prevIndex}`).toBeGreaterThanOrEqual(prevIndex)
      prevIndex = idx
    }
  })

  it("no two consecutive stages in the write order jump to a DIFFERENT card that is earlier in PIPELINE_CARDS", () => {
    for (let i = 1; i < WRITE_ORDER.length; i++) {
      const prev = cardForStage(WRITE_ORDER[i - 1])
      const curr = cardForStage(WRITE_ORDER[i])
      const prevIdx = PIPELINE_CARDS.indexOf(prev)
      const currIdx = PIPELINE_CARDS.indexOf(curr)
      // The card index must be >= the previous (same card or later card).
      expect(currIdx, `stage "${WRITE_ORDER[i]}" → "${curr}" (idx ${currIdx}) is BEFORE "${WRITE_ORDER[i - 1]}" → "${prev}" (idx ${prevIdx})`).toBeGreaterThanOrEqual(prevIdx)
    }
  })
})

// ── CARD LABELS ────────────────────────────────────────────────────────────────────────────

describe("pipelineGroups — card labels", () => {
  it("every card id has a CARD_LABEL entry", () => {
    for (const id of PIPELINE_CARDS) {
      expect(CARD_LABEL[id], `card "${id}" has no label`).toBeTruthy()
      expect(typeof CARD_LABEL[id]).toBe("string")
    }
  })

  it("CARD_LABEL has exactly four entries", () => {
    expect(Object.keys(CARD_LABEL).length).toBe(4)
  })
})