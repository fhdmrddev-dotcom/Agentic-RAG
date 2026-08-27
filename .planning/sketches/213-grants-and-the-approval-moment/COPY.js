/**
 * ⭐ THE COPY TABLE — Phase 213 sketch.
 *
 * ⚠ THE SKETCH RENDERS NOTHING THAT IS NOT DECLARED HERE, and that is the whole point.
 * `feedback_sketch_to_build_drift` records the mechanism four separate times: a sketch is
 * HTML/CSS and the build is React + Tailwind, so **nothing transfers automatically** and every
 * string gets re-typed by an executor reading prose. Prose does not typecheck.
 *
 * **THE BUILD PORTS THIS OBJECT AND IMPORTS IT** — it becomes `grantsVocabulary.ts` beside the
 * shipped `connectionsCopy.ts` / `connectionFormCopy.ts` — rather than hunting strings through JSX.
 * A drifted string then fails the drive script, instead of failing a person's eye six weeks later.
 *
 * Mirrors the shape of the shipped `libraryVocabulary.ts`.
 */

const COPY = {
  // ── The panel head ────────────────────────────────────────────────────────────────────
  // ⚠ REPLACES Stitch's "Manage agent permissions and posture for this integration."
  // That sentence described OUR SOFTWARE ("posture", "integration" are words from the code)
  // instead of helping the person. Operator, on being shown it: "I do not understand."
  // This one says what the reader came to find out, in their words, about their own account.
  PANEL_TITLE: "GitHub",
  PANEL_SUBTITLE: "Choose what GitHub can do on your behalf.",

  // ── The connection-level default (GRANT-02) ───────────────────────────────────────────
  DEFAULT_POSTURE_LABEL: "Default for every action",
  DEFAULT_POSTURE_HELP:
    "Each action follows this until you change that action yourself.",

  // ── The three postures. ONE closed set, used by the default control AND every row. ─────
  // ⚠ A CHECKBOX CANNOT EXPRESS THIS. Two states cannot say "ask", and "ask" is the state the
  // whole phase exists for. Three arms, never two — the house rule, met by the control itself.
  POSTURE_ALLOW: "Allow",
  POSTURE_ASK: "Ask first",
  POSTURE_DENY: "Deny",

  // ── The list ──────────────────────────────────────────────────────────────────────────
  // ⚠ `{n}` is the REAL count from `discovered_tools`, never a rounded or invented number.
  SEARCH_PLACEHOLDER: (n) => `Search ${n} actions`,
  LIST_EMPTY: "No action matches that.",

  // ⚠ THE OVERRIDE MARK IS A TOOLTIP-FREE, TEXT-BEARING LABEL. The shipped panel asserts ZERO
  // `[title]` attributes in its rendered output (§12 / the 184-07 lesson), so "hover to find out
  // what the edge means" is not available to us and should not be.
  OVERRIDDEN_LABEL: "You changed this",
  OVERRIDDEN_RESET: "Use the default",

  // ⚠ DIRECTION HAS THREE ARMS. `readOnlyHint` was MEASURED ABSENT on the one MCP server we can
  // reach, and per spec a hint from an untrusted server may never WIDEN a permission. So an
  // undeclared direction renders as "Unknown" — never silently as a read, never as a blank.
  DIRECTION_READS: "Reads",
  DIRECTION_CHANGES: "Changes things",
  DIRECTION_UNKNOWN: "Unknown",
  DIRECTION_UNKNOWN_HELP:
    "This server does not say whether this action only reads. Treated as if it changes things.",

  // ── The approval moment (GRANT-03) ────────────────────────────────────────────────────
  // ⚠ REPLACES Stitch's "PAUSED: AWAITING HUMAN CONSENT." — accurate, and the voice of a
  // compliance log rather than of a person. The second half of its sentence was already right
  // and is kept almost verbatim, because "nothing has been sent yet" is the fact that matters.
  ASK_HEADLINE: "Paused — waiting for you.",
  ASK_NOTHING_SENT: "Nothing has been sent yet.",
  ASK_WHICH_RUN: (workflow, step, total) => `${workflow} · step ${step} of ${total}`,
  ASK_ARGS_LABEL: "What it will send",
  ASK_ARGS_MORE: (n) => `Show ${n} more lines`,

  ASK_APPROVE: "Approve once",
  ASK_DENY: "Deny",
  // ⚠ IT SAYS IT CHANGES A STANDING SETTING. A person answering ONE question must not silently
  // arm every future one — the same reasoning the shipped Replace guard carries.
  ASK_ALWAYS: (tool) => `Always allow ${tool} on this connection`,
  ASK_ALWAYS_NOTE: "Changes the setting above, not just this run.",

  // ── The refusal (GRANT-04) ────────────────────────────────────────────────────────────
  // ⚠ IT NAMES THE GRANT THAT WOULD ALLOW IT. A refusal that only says "denied" sends the
  // reader hunting; this one is the next action.
  REFUSED_HEADLINE: (tool) => `${tool} was refused.`,
  REFUSED_BECAUSE_DENIED: (tool) => `${tool} is set to Deny on this connection.`,
  REFUSED_BECAUSE_UNGRANTED: (tool) =>
    `${tool} has never been allowed on this connection.`,
  REFUSED_NEXT: "Set it to Allow or Ask first to let this run continue.",
}

if (typeof module !== "undefined") module.exports = { COPY }
