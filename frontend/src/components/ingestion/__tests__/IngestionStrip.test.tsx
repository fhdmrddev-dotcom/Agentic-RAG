/**
 * Phase 217 plan 08 task 3 — the ORDERED source fence over the backend's live pipeline, plus the
 * strip's four status renderings.
 *
 * ── ⭐ WHY THE COMPARISON IS ORDERED, AND WHY THAT IS THE WHOLE POINT ──────────────────
 * The sketch's own `A5b` fence compares the backend's six steps to the drawn six by SORTING both
 * sides first. A sorted comparison is exactly blind to a REORDER — which is the single defect
 * D-217-09 exists to fix. This suite therefore asserts an ORDERED array equality, and the RED
 * was driven: reordering `INGESTION_STAGES` fails this file.
 *
 * ── EVERY EXTRACTION CARRIES A NON-VACUITY CONTROL, ASSERTED FIRST ─────────────────────
 * A regex that matches nothing yields an empty array, and an empty array satisfies "these are in
 * order" for free. Three guards, all before any claim rests on the extraction:
 *   1. a LENGTH floor on the `?raw` import (a stripped/empty module is silent otherwise — see
 *      217-06, where `index.css?raw` resolved to `""` under vitest and nine cases went green
 *      over nothing before the length guard turned it into a red),
 *   2. an IDENTITY symbol only `documents.py` contains,
 *   3. a COUNT control asserting exactly six steps were extracted.
 *
 * ⚠ CRLF: source files check out with Windows line endings on this box. Every pattern here uses
 * `[\s\S]` / `\r?\n` rather than a bare `\n`.
 *
 * ⚠ THE ONE LEGITIMATE NULL IS EXCLUDED BY CONSTRUCTION, not by an allow-list.
 * `documents.py` also writes `"ingestion_step": None` (the reingest reset). The pattern requires
 * a QUOTED value, so the null write can never enter the extraction — and a case below proves the
 * null write really is present in the source, so the exclusion is doing work rather than
 * describing an absence.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { IngestionStrip, segmentState } from "../IngestionStrip"
import { INGESTION_STAGES, isStageSkipped, stageIndex } from "../ingestionStages"
import type { Document } from "@/types"

// The live source this suite is BOUND to. `?raw` over a backend `.py` is the shipped
// cross-language idiom in this repo (`argumentModel.test.ts:30-32`).
import documentsPySource from "../../../../../backend/app/api/documents.py?raw"

// ── EXTRACTION ────────────────────────────────────────────────────────────────────────

/** Every `"ingestion_step": "<name>"` write, in SOURCE ORDER, deduped PRESERVING ORDER. */
function backendStepsInWriteOrder(): string[] {
  const all = [...documentsPySource.matchAll(/"ingestion_step":\s*"([a-z_]+)"/g)].map((m) => m[1])
  return [...new Set(all)]
}

const STAGE_KEYS = INGESTION_STAGES.map((s) => s.key)

// ── FIXTURES ──────────────────────────────────────────────────────────────────────────

const base: Document = {
  id: "doc-1",
  user_id: "user-1",
  folder_id: null,
  filename: "report.pdf",
  file_path: "user-1/doc-1/report.pdf",
  file_size: 1024,
  mime_type: "application/pdf",
  status: "processing",
  error_message: null,
  ingestion_step: null,
  chunk_count: null,
  content_hash: null,
  metadata: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tables_stage_applies: true,
  images_stage_applies: true,
  table_count: 0,
  image_count: 0,
}

const doc = (over: Partial<Document>): Document => ({ ...base, ...over })

/** The rendered segments, in DOM order, as `[stageKey, state]` pairs. */
function segments(): Array<[string, string]> {
  const strip = screen.getByTestId("ingestion-strip")
  return [...strip.querySelectorAll("[data-stage]")].map((el) => [
    el.getAttribute("data-stage") ?? "",
    el.getAttribute("data-state") ?? "",
  ])
}

function stateOf(key: string): string {
  const found = segments().find(([k]) => k === key)
  return found ? found[1] : "(absent)"
}

// ── THE FENCE HALF ────────────────────────────────────────────────────────────────────

describe("the ORDERED fence over documents.py's live source", () => {
  it("non-vacuity 1/3 — the ?raw import really carries the backend module", () => {
    // 217-06 measured a `?raw` import silently resolving to "" under vitest. A length floor is
    // the only thing that turns that into a red instead of a lie.
    expect(documentsPySource.length).toBeGreaterThan(20000)
  })

  it("non-vacuity 2/3 — an identity symbol only documents.py contains", () => {
    expect(documentsPySource).toContain("ingestion_step")
    expect(documentsPySource).toMatch(/table\("documents"\)/)
  })

  it("non-vacuity 3/3 — EXACTLY six distinct ingestion_step writes were extracted", () => {
    // Asserted BEFORE the ordered comparison below, so that comparison can never pass vacuously.
    expect(backendStepsInWriteOrder()).toHaveLength(6)
  })

  it("⭐ the six stages are in the backend's WRITE ORDER — an ORDERED comparison, never sorted", () => {
    // ⛔ Do not soften this to a set/sorted comparison. The sketch's A5b did exactly that and was
    // structurally blind to the reorder this assertion exists to catch.
    expect(STAGE_KEYS).toEqual(backendStepsInWriteOrder())
  })

  it("the reingest reset's legitimate null write is excluded BY CONSTRUCTION, not by an allow-list", () => {
    // The null write is really there (positive control) …
    expect(documentsPySource).toMatch(/"ingestion_step":\s*None/)
    // … and the quoted-value pattern cannot admit it.
    expect(backendStepsInWriteOrder()).not.toContain("None")
    expect(backendStepsInWriteOrder().every((s) => /^[a-z_]+$/.test(s))).toBe(true)
  })

  it("the two conditional stages are the two the backend writes inside `if raw and mime_type:`", () => {
    const conditional = INGESTION_STAGES.filter((s) => s.conditional).map((s) => s.key)
    expect(conditional).toEqual(["extracting_tables", "extracting_images"])
    // Both live after `embedding` in the real sequence — the fact the sketch drew wrongly.
    const order = backendStepsInWriteOrder()
    expect(order.indexOf("extracting_tables")).toBeGreaterThan(order.indexOf("embedding"))
    expect(order.indexOf("extracting_images")).toBeGreaterThan(order.indexOf("embedding"))
  })
})

// ── THE PREDICATE HALF (D-217-24) ─────────────────────────────────────────────────────

describe("isStageSkipped — three conditions, and undefined is not false", () => {
  const tables = INGESTION_STAGES.find((s) => s.key === "extracting_tables")!
  const chunking = INGESTION_STAGES.find((s) => s.key === "chunking")!

  it("false when the applicability flag is UNDEFINED — unknown is not skipped", () => {
    expect(
      isStageSkipped(tables, {
        tables_stage_applies: undefined,
        images_stage_applies: undefined,
        table_count: 0,
        image_count: 0,
      }),
    ).toBe(false)
  })

  it("false when the flag is false but the count is > 0 — the extracted_doc fast path", () => {
    expect(
      isStageSkipped(tables, {
        tables_stage_applies: false,
        images_stage_applies: false,
        table_count: 3,
        image_count: 0,
      }),
    ).toBe(false)
  })

  it("true ONLY when the flag is false AND the count is 0", () => {
    expect(
      isStageSkipped(tables, {
        tables_stage_applies: false,
        images_stage_applies: false,
        table_count: 0,
        image_count: 0,
      }),
    ).toBe(true)
  })

  it("false for an unconditional stage, whatever the flags say", () => {
    expect(
      isStageSkipped(chunking, {
        tables_stage_applies: false,
        images_stage_applies: false,
        table_count: 0,
        image_count: 0,
      }),
    ).toBe(false)
  })

  it("an unknown or absent ingestion_step yields index -1 rather than throwing", () => {
    expect(stageIndex(null)).toBe(-1)
    expect(stageIndex(undefined)).toBe(-1)
    expect(stageIndex("not_a_real_step")).toBe(-1)
    expect(stageIndex("embedding")).toBe(2)
  })
})

// ── THE RENDER HALF ───────────────────────────────────────────────────────────────────

describe("IngestionStrip — one honest rendering per status", () => {
  it("renders the six segments in INGESTION_STAGES order", () => {
    render(<IngestionStrip document={doc({ status: "pending" })} />)
    expect(segments().map(([k]) => k)).toEqual(STAGE_KEYS)
  })

  it("pending — nothing done and nothing active", () => {
    render(<IngestionStrip document={doc({ status: "pending" })} />)
    const states = segments().map(([, s]) => s)
    expect(states).not.toContain("done")
    expect(states).not.toContain("active")
    expect(states).not.toContain("not-reached")
  })

  it("processing — up to the step done, that one active, later pending", () => {
    render(<IngestionStrip document={doc({ status: "processing", ingestion_step: "embedding" })} />)
    expect(stateOf("extracting")).toBe("done")
    expect(stateOf("chunking")).toBe("done")
    expect(stateOf("embedding")).toBe("active")
    expect(stateOf("extracting_tables")).toBe("pending")
    expect(stateOf("extracting_images")).toBe("pending")
    expect(stateOf("metadata")).toBe("pending")
  })

  it("⭐ completed — every applicable segment is done EVEN WHEN ingestion_step reads 'embedding'", () => {
    // The residue case (D-217-23). Asserted BY RENDERING, not by inspecting the source: the
    // component must read `status` first and never branch on the residue column here.
    render(<IngestionStrip document={doc({ status: "completed", ingestion_step: "embedding" })} />)
    expect(segments().map(([, s]) => s)).toEqual(["done", "done", "done", "done", "done", "done"])
  })

  it("failed — later segments are NOT-REACHED, distinct from both pending and skipped", () => {
    render(<IngestionStrip document={doc({ status: "failed", ingestion_step: "embedding" })} />)
    expect(stateOf("extracting")).toBe("done")
    expect(stateOf("chunking")).toBe("done")
    expect(stateOf("embedding")).toBe("not-reached")
    expect(stateOf("metadata")).toBe("not-reached")

    const states = new Set(segments().map(([, s]) => s))
    expect(states.has("not-reached")).toBe(true)
    // The third non-done state is its own thing — never pending, never skipped.
    expect(states.has("pending")).toBe(false)
    expect(states.has("skipped")).toBe(false)
  })

  it("failed — the failure POINT stays identifiable without inventing a sixth state", () => {
    render(<IngestionStrip document={doc({ status: "failed", ingestion_step: "embedding" })} />)
    const marked = [...screen.getByTestId("ingestion-strip").querySelectorAll("[data-failure-point]")]
    expect(marked).toHaveLength(1)
    expect(marked[0].getAttribute("data-stage")).toBe("embedding")
  })

  it("the not-reached rendering's class is DISTINCT from pending's and from skipped's", () => {
    const { unmount } = render(
      <IngestionStrip
        document={doc({ status: "failed", ingestion_step: "chunking", filename: "x.txt" })}
      />,
    )
    const notReached = screen
      .getByTestId("ingestion-strip")
      .querySelector('[data-state="not-reached"]')!.className
    unmount()

    render(<IngestionStrip document={doc({ status: "pending" })} />)
    const strip = screen.getByTestId("ingestion-strip")
    const pending = strip.querySelector('[data-state="pending"]')!.className
    expect(notReached).not.toEqual(pending)

    // and against skipped, on a document whose conditionals provably never run
    const { container } = render(
      <IngestionStrip
        document={doc({
          status: "pending",
          mime_type: "text/plain",
          tables_stage_applies: false,
          images_stage_applies: false,
          table_count: 0,
          image_count: 0,
        })}
      />,
    )
    const skipped = container.querySelector('[data-state="skipped"]')!.className
    expect(notReached).not.toEqual(skipped)
    expect(skipped).not.toEqual(pending)
    expect(skipped).toMatch(/line-through/)
  })

  it("a .txt — both conditionals are STRUCK THROUGH, never left looking pending", () => {
    render(
      <IngestionStrip
        document={doc({
          status: "processing",
          ingestion_step: "chunking",
          mime_type: "text/plain",
          filename: "notes.txt",
          tables_stage_applies: false,
          images_stage_applies: false,
          table_count: 0,
          image_count: 0,
        })}
      />,
    )
    expect(stateOf("extracting_tables")).toBe("skipped")
    expect(stateOf("extracting_images")).toBe("skipped")
  })

  it("⭐ the extracted_doc fast path — flag false but table_count > 0 renders REACHED, not skipped", () => {
    render(
      <IngestionStrip
        document={doc({
          status: "completed",
          tables_stage_applies: false,
          images_stage_applies: false,
          table_count: 4,
          image_count: 0,
        })}
      />,
    )
    expect(stateOf("extracting_tables")).toBe("done")
    // the image half, with a genuinely zero count, is still honestly skipped
    expect(stateOf("extracting_images")).toBe("skipped")
  })

  it("undefined applicability (the Realtime INSERT arm) renders the conditionals PENDING", () => {
    render(
      <IngestionStrip
        document={doc({
          status: "processing",
          ingestion_step: "extracting",
          tables_stage_applies: undefined,
          images_stage_applies: undefined,
          table_count: undefined,
          image_count: undefined,
        })}
      />,
    )
    expect(stateOf("extracting_tables")).toBe("pending")
    expect(stateOf("extracting_images")).toBe("pending")
  })

  it("an unknown ingestion_step degrades to all-pending rather than guessing", () => {
    render(
      <IngestionStrip document={doc({ status: "processing", ingestion_step: "who_knows" })} />,
    )
    expect(segments().map(([, s]) => s)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ])
    // ⚠ T-217-27: the raw server value is never rendered — it is only a KEY into TERM_MAP.
    expect(screen.getByTestId("ingestion-strip").textContent).not.toContain("who_knows")
  })

  it("the labels come from TERM_MAP, so the six words are the SAME six the badge says", () => {
    render(<IngestionStrip document={doc({ status: "pending" })} />)
    expect(screen.getAllByLabelText("Reading the file").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Splitting into sections").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Making it searchable").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Reading tables").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Reading images").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Reading document details").length).toBeGreaterThan(0)
  })

  it("⛔ the rendered output carries no percentage and no finish-time guess", () => {
    render(<IngestionStrip document={doc({ status: "processing", ingestion_step: "chunking" })} />)
    const text = screen.getByTestId("ingestion-strip").textContent ?? ""
    expect(text).not.toMatch(/%/)
    // ⚠ `/ETA/i` was the first spelling and it went RED against the shipped copy: the plain label
    // "Reading document d-ETA-ils" contains the substring. A case-insensitive substring is the
    // wrong shape of assertion here — the thing forbidden is the ACRONYM, so it is anchored.
    expect(text).not.toMatch(/\bETA\b/)
    expect(text).not.toMatch(/\bremaining\b/i)
    expect(text).not.toMatch(/\d+\s*(of|\/)\s*6/)
  })

  it("segmentState is pure and agrees with what was rendered", () => {
    const d = doc({ status: "processing", ingestion_step: "chunking" })
    render(<IngestionStrip document={d} />)
    INGESTION_STAGES.forEach((stage, i) => {
      expect(stateOf(stage.key)).toBe(segmentState(stage, i, d))
    })
  })
})
