---
seed_id: SEED-254
title: Phase 212's four remaining owed rows are in NO register — DEBT-01 enumerates 210, 211, 214 and 217 and does not name 212, and 212's file is already archived
created: 2026-09-06
planted_during: BUS-171 operator-queue triage (claude, REVIEWER)
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - BUS-169 — the sweep finding this seed makes durable
  - Phase 228 / DEBT-01 — the sweep that already exists and could absorb all four for one line
  - BUG-260810-01 — holds owed row 1 (does NOT need this seed)
trigger_when: >
  IMMEDIATELY — the trigger is already true. Concretely, ANY of: (a) Phase 228 is planned or
  executed (the one-line fix belongs there and 228 has NOT shipped yet — `- [ ]` at ROADMAP:253);
  (b) Phase 228 ships WITHOUT covering these four, at which point they need a home of their own;
  (c) any milestone close or `/gsd:new-milestone` sweep.
---

**Measured 2026-09-06 against the live tree, not taken from the claim.**

`ROADMAP:277` (Phase 228, DEBT-01, SC#1) enumerates the owed v3.9 rows by phase:

> *"Phase 210's four undriven SC, Phase 211's UAT plus schema regeneration, Phase 214's eight-row
> cross-provider roster and eight G-4 operator drives, Phase 217's sixteen UAT rows."*

**Phase 212 is absent.** But `212-VERIFICATION.md` closes `verdict: CLOSED … with owed rows named`
and its §7 lists **six**. Two have homes — row 1 is held by `BUG-260810-01` (which the reported-bugs
sweep does read) and row 6 is 211's five per-shape UAT rows (which DEBT-01 covers).

## The four with no register entry at all

Verified absent: grepping `McpProbeResponse`, `review-210-211-base` and `become grantable` across
`.planning/seeds/` and `.planning/reported-bugs/` returns **nothing**.

1. ⛔ **`/code-review ultra` on `ac159cc7` — reviewer-authored, NO INDEPENDENT VERIFIER, on the
   EGRESS BOUNDARY.** Also still owed for 210/211 as `review-210-211-base`. **This is the
   highest-consequence item in the queue** — a security boundary that has never had a second pair
   of eyes. `ac159cc7` appears only inside 212's own archived files and
   `.planning/milestones/v3.9-STATE-at-close.md`; there is no evidence any review ever ran.
2. **SC#4 end to end through the UI** — the probe rendering a tool list, and *"become grantable"*.
   ⭐ **Its blocker is GONE and nobody knows:** §7 says *"blocked in part on 213, which builds the
   grant surface"*, and **Phase 213 has shipped** (archived at
   `.planning/milestones/v3.9-phases/213-per-tool-grants-and-the-approval-moment`). A row that
   un-blocks silently is worse than one that stays blocked, because nothing re-reads it.
3. **The panel's `"Failed to fetch"` error string** (212-VERIFICATION §4).
4. **S-3's frontend half of the seam** (§6) — `McpProbeResponse` is a hand-written frontend type
   checked against nothing on the backend, so a backend rename **typechecks and fails at runtime**.

## Why this is urgent rather than tidy

This is the project's own recorded failure mode: **a deferral written into a file nobody sweeps is
a deletion that looks like a decision.** It is one phase from being invisible — `212-VERIFICATION.md`
is *already* archived out of `.planning/phases/` into `.planning/milestones/v3.9-phases/`, so no
phase-directory scan will ever reach it again.

## Recommended fix (one line, and the window is still open)

**Add Phase 212 to DEBT-01's enumeration at `ROADMAP:277`.** Phase 228 has **not shipped** — it is
`- [ ]` at `ROADMAP:253` — so the four rows drop straight into a sweep that already exists, with no
new mechanism. Give **row 1 (the unreviewed egress boundary) the first slot.**

If Phase 228 ships without them, this seed is the only thing left holding them.
