/**
 * Phase 271 plan 02 (D-02 / P-08) — the ONE ordered handoff from the Library's Ask mode into chat.
 *
 * Ask is answered in chat, never in the Library: the Library renders no answer, no passage and no
 * list for a question. This helper is the exit, and its ORDER is the requirement.
 *
 * 1. **A NEW thread first.** The person must land in a fresh conversation, not in whatever thread
 *    happened to be selected before they opened the Library. The shipped `handleTryInChat`
 *    (`ChatLayout.tsx`) only prefills and navigates — it creates no thread — so copying it would put
 *    the question into an unrelated conversation (G-4 scenario 4's failure). That is why this is a
 *    separate, tested helper rather than another inline callback.
 * 2. **Then the prefill.** The question is placed in the composer, trimmed, and NOT sent: the person
 *    presses Send, so they keep control of the model and provider. There is deliberately no `send`
 *    dependency here — nothing reachable from this function can send a message.
 * 3. **Then the navigation.** The chat surface mounts with the new thread selected and the one-shot
 *    prefill pending.
 *
 * ⛔ A FAILED CREATE STOPS EVERYTHING. If the thread cannot be created, no prefill is set and nothing
 * navigates — a prefill without its thread would land the question in the old conversation, which is
 * exactly what step 1 exists to prevent. The failure is logged and reported as `false`; it is never
 * thrown into the card that called it.
 *
 * ⚠ THE CLEARING RULE IS THE NAVIGATOR'S, not this helper's (the rule recorded in
 * `experts/catalog/startScopedChat.ts`): the composer consumes the one-shot prefill and clears it
 * through its own `onClearPrefill`, so this function never clears what it set.
 *
 * Every seam is injected, so the order is testable without mounting the chat shell.
 */

export interface AskInChatDeps {
  /** Creates (and selects) the NEW thread the question will be asked in. */
  createThread: () => Promise<unknown>
  /** Sets the composer's one-shot prefill. Never sends. */
  setPrefill: (text: string) => void
  /** Moves the app to the chat surface. */
  navigate: () => void
}

export async function askInChat(deps: AskInChatDeps, question: string): Promise<boolean> {
  const text = question.trim()
  if (text === "") return false

  try {
    await deps.createThread()
  } catch (err) {
    console.error("Ask: could not open a new chat for the question", err)
    return false
  }

  deps.setPrefill(text)
  deps.navigate()
  return true
}
