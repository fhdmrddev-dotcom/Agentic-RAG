// Phase 272-05 (F-3, operator ruling 2026-10-03 "fast fix now") — the search card's resting
// summary must say WHICH non-passage result it is.
//
// Measured in the G-4 drive (G4-2): a D-09 lock refusal rendered `Searching documents → 0 results`,
// the same words as a real empty search, because `summarize` mapped EVERY non-array result to
// "0 results". The handler already returns a distinct payload per kind
// (`backend/app/services/search_documents_tool.py`: `_refused_retry`, `_invalid_filter`,
// `_no_documents`, `_provider_error`); the card now reads it.
import { describe, expect, it } from "vitest"
import type { ToolCall } from "@/types"
import { summarize } from "./SearchDocumentsBody"
import handlerSource from "../../../../../backend/app/services/search_documents_tool.py?raw"

function tc(result: unknown): ToolCall {
  return {
    id: "t1",
    name: "search_documents",
    arguments: {},
    result: typeof result === "string" ? result : JSON.stringify(result),
    status: "complete",
  } as unknown as ToolCall
}

const REFUSED = {
  error: "refused_retry",
  locked_fields: ["date"],
  message: "A filtered search on date already matched no documents in this turn, …",
}
const INVALID = {
  error: "invalid_filter",
  field: "legal_entity",
  allowed: ["Acme GmbH", "Beta Ltd"],
  message: "…",
}
const NO_DOCS = {
  status: "no_documents_matched",
  reason: "zero_documents",
  filter: "legal entity = Acme GmbH · document date 1–31 Jul 2026",
  matched_documents: 0,
  message: "No documents matched …",
}
const NOT_SEARCHABLE = {
  status: "no_documents_matched",
  reason: "not_searchable_yet",
  filter: "legal entity = Acme GmbH",
  matched_documents: 2,
  message: "2 documents matched …, but none of them has searchable passages yet",
}
const UNAVAILABLE = { error: "retrieval_unavailable", provider: "openai", detail: "…" }

describe("SearchDocumentsBody.summarize — F-3: each non-passage result says what it is", () => {
  it("passages keep the shipped top-match summary", () => {
    expect(summarize(tc([{ filename: "a.md", similarity: 0.91, content: "x" }]))).toBe(
      "top match: a.md (91%)",
    )
  })

  it("an empty array is still 0 results", () => {
    expect(summarize(tc([]))).toBe("0 results")
  })

  it("a D-09 lock refusal says it was refused, never 0 results", () => {
    const s = summarize(tc(REFUSED))
    expect(s).toMatch(/refused/i)
    expect(s).not.toMatch(/0 results/)
  })

  it("an invalid filter (kind 3) names itself and the field", () => {
    const s = summarize(tc(INVALID))
    expect(s).toMatch(/invalid filter/i)
    expect(s).toContain("legal_entity")
  })

  it("a true empty match (kind 2) says no documents matched", () => {
    expect(summarize(tc(NO_DOCS))).toMatch(/no documents matched/i)
  })

  it("matched but not searchable yet (D-25) carries the matched count", () => {
    const s = summarize(tc(NOT_SEARCHABLE))
    expect(s).toMatch(/not searchable yet/i)
    expect(s).toContain("2 matched")
    expect(s).not.toMatch(/no documents matched/i)
  })

  it("a search that could not run says unavailable, never 0 results", () => {
    const s = summarize(tc(UNAVAILABLE))
    expect(s).toMatch(/unavailable/i)
    expect(s).not.toMatch(/0 results/)
  })

  it("the five outcomes read five different ways", () => {
    const all = [REFUSED, INVALID, NO_DOCS, NOT_SEARCHABLE, UNAVAILABLE].map((r) => summarize(tc(r)))
    expect(new Set(all).size).toBe(5)
    expect(all).not.toContain("0 results")
  })

  it("the keys this card reads are the keys the handler writes (two registers, one contract)", () => {
    expect(handlerSource).toContain('"error": "refused_retry"')
    expect(handlerSource).toContain('"error": "invalid_filter"')
    expect(handlerSource).toContain('"status": "no_documents_matched"')
    expect(handlerSource).toContain('"not_searchable_yet"')
    expect(handlerSource).toContain('"matched_documents": matched')
    expect(handlerSource).toContain('"error": "retrieval_unavailable"')
  })
})
