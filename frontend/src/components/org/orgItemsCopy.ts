/**
 * Phase 298 (298-UI-SPEC.md) — the one home of the phase's new words.
 *
 * ⛔ A STRICT LEAF: no imports, no React, nothing but strings and string functions. Every surface
 * that shows one of these sentences imports it from here, so a wording change is one edit and a
 * test can assert the rendered words against the same constant.
 */

/** UI-D8 — the Library folder tree while the active org's folders are not answered yet. */
export const LOADING_FOLDERS = "Loading folders…"

/** UI-D8 / D-11 — the chat history column during an org-switch refetch (never "No recent chats"). */
export const LOADING_CHATS = "Loading your chats…"

/** UI-D11 — where an out-of-org folder lives. Exactly `lives in {Org}`, lower-case "lives". */
export function LIVES_IN(org: string): string {
  return `lives in ${org}`
}
