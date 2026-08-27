/**
 * ⭐ THE COPY TABLE — Phase 213 (GRANT-01..GRANT-05 / D-213-00 / D-213-05..D-213-16).
 *
 * Exact vocabulary ported from `.planning/sketches/213-grants-and-the-approval-moment/COPY.js`.
 * Used across the ConnectionFormPanel grant list and the approval moment cards.
 */

export const GRANTS_COPY = {
  // ── The panel head ────────────────────────────────────────────────────────────────────
  PANEL_TITLE: "GitHub",
  PANEL_SUBTITLE: "Choose what GitHub can do on your behalf.",

  // ── The connection-level default (GRANT-02) ───────────────────────────────────────────
  DEFAULT_POSTURE_LABEL: "Default for every action",
  DEFAULT_POSTURE_HELP:
    "Each action follows this until you change that action yourself.",

  // ── The three postures. ONE closed set, used by the default control AND every row. ─────
  POSTURE_ALLOW: "Allow",
  POSTURE_ASK: "Ask first",
  POSTURE_DENY: "Deny",

  // ── The list ──────────────────────────────────────────────────────────────────────────
  SEARCH_PLACEHOLDER: (n: number) => `Search ${n} actions`,
  LIST_EMPTY: "No action matches that.",

  OVERRIDDEN_LABEL: "You changed this",
  OVERRIDDEN_RESET: "Use the default",

  DIRECTION_READS: "Reads",
  DIRECTION_CHANGES: "Changes things",
  DIRECTION_UNKNOWN: "Unknown",
  DIRECTION_UNKNOWN_HELP:
    "This server does not say whether this action only reads. Treated as if it changes things.",

  // ── The approval moment (GRANT-03) ────────────────────────────────────────────────────
  ASK_HEADLINE: "Paused — waiting for you.",
  ASK_NOTHING_SENT: "Nothing has been sent yet.",
  ASK_WHICH_RUN: (workflow: string, step: number, total: number) =>
    `${workflow} · step ${step} of ${total}`,
  ASK_ARGS_LABEL: "What it will send",
  ASK_ARGS_MORE: (n: number) => `Show ${n} more lines`,

  ASK_APPROVE: "Approve once",
  ASK_DENY: "Deny",
  ASK_ALWAYS: (tool: string) => `Always allow ${tool} on this connection`,
  ASK_ALWAYS_NOTE: "Changes the setting above, not just this run.",

  // ── The refusal (GRANT-04) ────────────────────────────────────────────────────────────
  REFUSED_HEADLINE: (tool: string) => `${tool} was refused.`,
  REFUSED_BECAUSE_DENIED: (tool: string) => `${tool} is set to Deny on this connection.`,
  REFUSED_BECAUSE_UNGRANTED: (tool: string) =>
    `${tool} has never been allowed on this connection.`,
  REFUSED_NEXT: "Set it to Allow or Ask first to let this run continue.",
} as const
