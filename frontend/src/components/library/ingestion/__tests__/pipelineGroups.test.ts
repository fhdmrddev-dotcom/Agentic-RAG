/**
 * Phase 217.1 plan 04 (LIB-03 / D-217.1-26) — the four-card fold fence.
 *
 * Asserts that `pipelineGroups.ts` maps all six shipped stages to exactly four
 * pipeline cards, that every stage is covered (no orphan), and that the mapping
 * is provably monotonic over the measured backend write order.
 *
 * ⚠ Ordered comparison, NOT sorted-before-compare (the `A5b` warning).
 */
import { describe, it, expect } from "vitest"
import {
  cardForStage,
  PIPELINE_CARDS,
  CARD_LABEL,
  type PipelineCard,
} from "../pipelineGroups"
import { INGESTION_STAGES, stageTermKey, type IngestionStage } from "@/components/ingestion/ingestionStages"

// ── The measured backend write order (documents.py:2069,2249,2277,2315,2326,2436) ──
const MEASURED_WRITE_ORDER: IngestionStage["key"][] = [
  "extracting",
  "chunking",
  "embedding",
  "extracting_tables",
  "extracting_images",
  "metadata",
]

describe("PIPELINE_CARDS — ordered four-card array", () => {
  it("has exactly four cards", () => {
    expect(PIPELINE_CARDS).toHaveLength(4)
  })

  it("the cards are in the correct order: reading → splitting → indexing → labelling", () => {
    expect(PIPELINE_CARDS).toEqual(["reading", "splitting", "indexing", "labelling"])
  })

  it("does NOT contain the six raw stage keys", () => {
    for (const stage of INGESTION_STAGES) {
      expect(PIPELINE_CARDS).not.toContain(stage.key)
    }
  })
})

describe("CARD_LABEL — human-readable card labels", () => {
  it("has a label for every pipeline card", () => {
    for (const card of PIPELINE_CARDS) {
      expect(CARD_LABEL[card as PipelineCard]).toBeTruthy()
    }
  })

  it("Reading maps to 'Reading'", () => {
    expect(CARD_LABEL.reading).toBe("Reading")
  })

  it("Splitting maps to 'Splitting'", () => {
    expect(CARD_LABEL.splitting).toBe("Splitting")
  })

  it("Indexing maps to 'Indexing'", () => {
    expect(CARD_LABEL.indexing).toBe("Indexing")
  })

  it("Labelling maps to 'Labelling'", () => {
    expect(CARD_LABEL.labelling).toBe("Labelling")
  })
})

describe("cardForStage — the fold mapping (D-217.1-26)", () => {
  it("maps extracting → reading", () => {
    expect(cardForStage("extracting")).toBe("reading")
  })

  it("maps chunking → splitting", () => {
    expect(cardForStage("chunking")).toBe("splitting")
  })

  it("maps embedding → indexing", () => {
    expect(cardForStage("embedding")).toBe("indexing")
  })

  it("maps extracting_tables → indexing (D-217.1-26, NOT reading)", () => {
    expect(cardForStage("extracting_tables")).toBe("indexing")
  })

  it("maps extracting_images → indexing (D-217.1-26, NOT reading)", () => {
    expect(cardForStage("extracting_images")).toBe("indexing")
  })

  it("maps metadata → labelling", () => {
    expect(cardForStage("metadata")).toBe("labelling")
  })
})

describe("cardForStage — exhaustiveness (no orphan)", () => {
  it("every value in INGESTION_STAGES has a defined card", () => {
    for (const stage of INGESTION_STAGES) {
      const card = cardForStage(stage.key)
      expect(card).toBeDefined()
      expect(PIPELINE_CARDS).toContain(card)
    }
  })

  it("the number of covered stages equals the number of shipped stages", () => {
    const covered = INGESTION_STAGES.filter(
      (s) => PIPELINE_CARDS.includes(cardForStage(s.key)),
    )
    expect(covered).toHaveLength(INGESTION_STAGES.length)
  })
})

describe("cardForStage — monotonicity over the measured write order", () => {
  it("card index never decreases as a document progresses through the pipeline", () => {
    let lastIndex = -1
    for (const stageKey of MEASURED_WRITE_ORDER) {
      const card = cardForStage(stageKey)
      const cardIndex = PIPELINE_CARDS.indexOf(card)
      expect(cardIndex).toBeGreaterThanOrEqual(lastIndex)
      lastIndex = cardIndex
    }
  })

  it("the monotonic sequence is: reading → splitting → indexing → indexing → indexing → labelling", () => {
    const cards = MEASURED_WRITE_ORDER.map(cardForStage)
    expect(cards).toEqual([
      "reading",
      "splitting",
      "indexing",
      "indexing",
      "indexing",
      "labelling",
    ])
  })

  it("no document would ever appear to jump backwards as it progresses", () => {
    const indices = MEASURED_WRITE_ORDER.map(
      (k) => PIPELINE_CARDS.indexOf(cardForStage(k)),
    )
    // Verify non-decreasing
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1])
    }
  })
})
