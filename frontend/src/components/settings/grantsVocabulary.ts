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

  // ── ⚠ NOISE AUDIT 2026-08-31 (operator, item C1) ──────────────────────────
  // `OVERRIDDEN_LABEL` was the words "You changed this", printed on every overridden
  // row — beside `OVERRIDDEN_RESET` ("Use the default"), which ONLY EXISTS on an
  // overridden row and therefore already says it. On a 44-action GitHub grant list that
  // is two controls where one carries the meaning, repeated down the column.
  //
  // ⚠ THE FACT IS NOT LOST, ONLY THE SENTENCE. The reset affordance is still rendered
  // and still only when overridden, so its mere presence carries exactly what the tag
  // spelled out. A tooltip was tried and REJECTED: `ConnectionGrantsList`'s Invariant 8
  // forbids `title` attributes outright, because a tooltip is unreachable by touch and
  // by keyboard — parking meaning there removes it for some readers entirely.
  OVERRIDDEN_LABEL: "",
  OVERRIDDEN_RESET: "Use the default",

  // ── Phase 221 · the application axis (D-221-01 / D-221-02) ────────────────────────────
  APPLICATION_COUNT: (n: number) => `${n} ${n === 1 ? "action" : "actions"}`,
  APPLICATION_POSTURE_LABEL: (app: string) => `Default for every ${app} action`,
  // ⚠ The sentence that makes the three-rung ladder legible without a diagram.
  APPLICATION_INHERITS: "Applications inherit this. An action inherits its application.",

  // ── Phase 221 · the direction band (D-221-03) ─────────────────────────────────────────
  // ⚠ These are HEADINGS on a band that carries no control — see `DirectionBand.tsx`. They
  // read as a statement about the group, not as a thing to press. The per-row chips below
  // (`DIRECTION_*`) stay as they are: same fact, different grain.
  BAND_READS: "Only reads",
  BAND_CHANGES: "Changes something",

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
