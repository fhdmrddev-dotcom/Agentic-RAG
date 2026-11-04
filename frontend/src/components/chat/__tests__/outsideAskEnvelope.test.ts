/**
 * Phase 306-04 (D-32 / D-28; 306-UI-SPEC §Surface 6) — the ask's question, unwrapped for display.
 *
 * ⛔ ONE SHAPE, TWO LANGUAGES: `backend/tests/unit/test_306_ask_envelope.py` pins that the backend
 * writer (`inbound_inputs.wrap_untrusted_input(source="mcp", notice=ASK_NOTICE)`) produces the
 * fixture's `envelope` for its `question`; this suite reads the SAME file, so a wording change to
 * the notice or the tag on either side fails one of the two.
 *
 * The fixture's question carries its own `</external_input>` on purpose: the writer neutralises it
 * to `&lt;/external_input` on the way in, and the display shows that inner text VERBATIM (React
 * text, never un-escaped), so the displayed question is the stored inner text, not the raw input.
 */
import { describe, expect, it } from "vitest"
import fixtureRaw from "../../../../../backend/tests/fixtures/phase306/ask_envelope.json?raw"
import leafRaw from "../outsideAskEnvelope.ts?raw"
import { OUTSIDE_ASK_NOTE, outsideAskQuestion } from "../outsideAskEnvelope"

const fixture = JSON.parse(fixtureRaw) as { question: string; envelope: string }
/** What the writer stores inside the envelope: the question with its closing tag neutralised. */
const stored = fixture.question.replace(/<\/\s*external_input/gi, "&lt;/external_input")

describe("outsideAskQuestion (306-04)", () => {
  it("returns the stored question of the shared fixture's envelope", () => {
    expect(outsideAskQuestion(fixture.envelope)).toBe(stored)
    expect(stored).toContain("&lt;/external_input")
    expect(stored).not.toBe(fixture.question)
  })

  it("never un-escapes the neutralised closing tag", () => {
    expect(outsideAskQuestion(fixture.envelope)).not.toContain("</external_input")
  })

  it("a 293 api_key kickoff envelope is not an ask", () => {
    const kickoff = fixture.envelope.replace('source="mcp"', 'source="api_key"')
    expect(outsideAskQuestion(kickoff)).toBeNull()
  })

  it("a plain typed message is not an ask", () => {
    expect(outsideAskQuestion("What does our remote-work policy say about Fridays?")).toBeNull()
    expect(outsideAskQuestion("")).toBeNull()
  })

  it("text after the notice, or before the opening tag, is not an ask", () => {
    expect(outsideAskQuestion(fixture.envelope + "\nand then some")).toBeNull()
    expect(outsideAskQuestion(" " + fixture.envelope)).toBeNull()
    expect(outsideAskQuestion("Look: " + fixture.envelope)).toBeNull()
  })

  it("any notice text inside the brackets is accepted", () => {
    const other = fixture.envelope.replace(/\[SYSTEM NOTICE: [^\n]*\]$/, "[SYSTEM NOTICE: reworded.]")
    expect(outsideAskQuestion(other)).toBe(stored)
  })

  it("the note's words", () => {
    expect(OUTSIDE_ASK_NOTE).toBe(
      "Asked from an AI tool. In this chat the agent only searches and reads your documents.",
    )
  })

  it("is a zero-import leaf", () => {
    expect(leafRaw).not.toMatch(/^import /m)
  })
})
