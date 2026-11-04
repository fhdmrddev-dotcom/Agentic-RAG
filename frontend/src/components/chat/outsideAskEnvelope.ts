/**
 * Phase 306-04 (D-32 / D-28; 306-UI-SPEC §Surface 6) — an ask from an AI tool, unwrapped for display.
 *
 * An MCP ask's user message is STORED inside the TRUST-03 envelope, because the model must see the
 * envelope on every later turn. In the app the member sees their QUESTION instead. This leaf finds
 * it, and only when the whole message is exactly one MCP ask envelope:
 *
 *   <external_input source="mcp" field="question">\n{question}\n</external_input>\n[SYSTEM NOTICE: …]
 *
 * with the opening tag at the very start and nothing after the notice. Anything else — 293's
 * `source="api_key"` kickoff envelopes, any message a member typed — is `null`, and the bubble
 * renders exactly as before. The question's own closing tags were neutralised by the backend writer
 * (`&lt;/external_input`), so the first real closing tag is the end; the inner text is returned
 * VERBATIM (it is rendered as React text, never un-escaped).
 *
 * ⛔ One shape, two languages: the backend writer and this match are pinned by one shared fixture
 * (`backend/tests/fixtures/phase306/ask_envelope.json`).
 *
 * A zero-import leaf (the `waitingVocabulary.ts` shape).
 */

/** True for the whole thread, Continue included (D-28). */
export const OUTSIDE_ASK_NOTE =
  "Asked from an AI tool. In this chat the agent only searches and reads your documents."

const ASK_ENVELOPE =
  /^<external_input source="mcp" field="question">\n([\s\S]*?)\n<\/external_input>\n\[SYSTEM NOTICE: [^\n]*\]$/

export function outsideAskQuestion(content: string): string | null {
  if (typeof content !== "string") return null
  const m = ASK_ENVELOPE.exec(content)
  return m ? m[1] : null
}
