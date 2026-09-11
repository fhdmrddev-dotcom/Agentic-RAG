/**
 * Phase 244 plan 05 (SHELL-04 / D-244-22 / D-244-23) — THE COMPOSER'S ATTACH COPY, PORTED.
 *
 * ⛔ THIS FILE IS A PORT OF
 * `.planning/sketches/236-the-file-that-belongs-to-this-chat/COPY.js`, NOT A RE-TYPING OF IT.
 * The sketch renders nothing that is not in that object, the operator approved the sketch, and
 * the `feedback-sketch-to-build-drift` rule exists because a re-typed string is a silently
 * different product. `__tests__/ChatAttachmentChip.states.test.tsx` Test 5 reads `COPY.js` with
 * `?raw` and asserts every pair below as `key: "value"` — so a value that drifts, or drifts onto
 * a different key, goes red rather than shipping.
 *
 * ⭐ WHAT IS PORTED AND WHAT IS NOT, and why the omission is a decision rather than an oversight:
 *   · `COPY.a`      — PORTED. Sketch 236's winner is **A — Scope on the chip** (operator,
 *                     2026-09-11): the `+` menu stays plain and the CHIP carries
 *                     `this chat only · 24h`.
 *   · `COPY.shared` — PORTED. Both variants share it.
 *   · `COPY.engine` — PORTED, minus one field. These are the server's REAL facts, not design
 *                     copy: `workspace.py`'s three 422 sentences, the 10 MB cap, the 24h TTL,
 *                     and the `+` trigger's already-shipped `data-testid`.
 *   · `COPY.b`      — ⛔ **NOT PORTED (D-244-23).** B's menu header, its footer
 *                     (*"Files here stay in this chat. The Library is for files you keep."*) and
 *                     its in-modal destination chip are RECORDED in the sketch, not dropped, and
 *                     they COMPOSE with A if UAT shows people still expect the Library. Porting
 *                     them here would make B's arm one careless edit from shipping, which is
 *                     exactly what `ComposerAttach.composition.test.tsx` Test 3 fences against.
 *   · `COPY.scenario` — NOT PORTED. It is the authored Meridian business case that makes the
 *                     wording question readable in the mockup. It is fixture data, not product.
 *
 * ⚠ `ALLOWED_EXT` IS NOT PORTED AS A LITERAL — it is RE-EXPORTED from
 * `@/lib/workspaceAllowedExt`. The sketch's own `COPY.js` carries a hand-typed copy (correct
 * today, and pinned to `workspace.py` by `backend/tests/unit/test_244_workspace_pdf.py`), but
 * 244-02 collapsed the frontend's three hand-typed copies into ONE constant with a `?raw`
 * set-equality fence against the server. Copying the list here would make it a fourth, and the
 * fence would not see it.
 *
 * ⛔ The confirm word is `Attach`, never `Import`. `Import` is the LIBRARY door's word, and the
 * ROADMAP names a quiet Library write as `SHELL-04`'s failure mode (D-244-23).
 */

import { WORKSPACE_ALLOWED_EXT } from "@/lib/workspaceAllowedExt"

/** The server's own refusal sentences and the engine facts around them (`COPY.engine`). */
const engine = {
  /**
   * ⭐ The ONE frontend list, re-exported rather than re-listed. See the docblock above:
   * the lockstep with `backend/app/api/workspace.py` is a MECHANISM (244-02), not a comment.
   */
  ALLOWED_EXT: WORKSPACE_ALLOWED_EXT,
  /** `workspace.py` `MAX_FILE_SIZE` — 10 MB, enforced three times server-side (WR-04). */
  MAX_MB: 10,
  /** `user_settings.template_ttl_hours` default. The TTL is a READ GATE, not a delete sweeper. */
  TTL_HOURS: 24,
  /** Already shipped at `MessageInput.tsx` — the sketch's hook is real, not invented. */
  PLUS_BTN_TESTID: "composer-plus-btn",
  /**
   * The server's verbatim 422s. ⛔ A build surfaces THESE (they arrive on `err.detail` through
   * `uploadWorkspaceTemplate`'s throw) — never a client paraphrase. The builders are kept as
   * builders so a test can reconstruct the exact sentence the server would send.
   */
  REFUSE_TYPE: (ext: string, allowed: string): string =>
    `Unsupported type ${ext || "(none)"}. Allowed: ${allowed}`,
  REFUSE_SIZE: "File too large. Maximum size is 10 MB.",
  REFUSE_EMPTY: "File is empty",
} as const

/** Variant A — scope lives on the CHIP; the menu stays plain. The winner. */
const a = {
  /** ⛔ Deliberately no header — plain menu (`COPY.a.menuTitle` is `null` in the sketch). */
  itemLocal: "Attach a file",
  itemCloud: "From cloud storage",
  itemConnectors: "Tools and connectors",
  chipScope: "this chat only",
  chipTtl: "24h",
  chipRemove: "Remove",
  cloudTitle: "Choose a file",
  /**
   * ⭐ PORTED BY SHAPE, not as a literal (`244-06`). The sketch writes
   * `cloudSub: "From Google Drive · Meridian Supply"` — a SCENARIO line: `Meridian Supply` is
   * the authored connection name in `COPY.scenario`, which is fixture data and not product.
   * The two nouns are therefore parameters, and `ConnectedFilePickerModal.thread.test.tsx`
   * Test 3b feeds the scenario's own values back in and asserts the sketch's literal
   * reappears verbatim — so the port is fenced against drift exactly as the strings are.
   */
  cloudSub: (provider: string, connection: string): string => `From ${provider} · ${connection}`,
  cloudConfirm: "Attach",
  cloudCancel: "Cancel",
  /** ⭐ The scope word in the TRANSCRIPT. D-244-22's build obligation lives on this one key. */
  sentNote: "this chat only",
} as const

/** Shared across both sketch variants. */
const shared = {
  composerPlaceholder: "Ask anything…",
  sendLabel: "Send",
  /** The agent's ONE-LINE pointer in the transcript — the run surface owns the heavy receipt. */
  agentReadLine: (name: string): string => `Read ${name}`,
  expiredChip: "No longer available",
  expiredWhy: "Files attached to a chat are kept for 24 hours.",
  refusalDismiss: "OK",
} as const

export const COPY = { engine, a, shared } as const
