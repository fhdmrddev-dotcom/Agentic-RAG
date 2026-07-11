---
sketch: 067
name: audit-browser
question: "How does the operator investigate the audit trail — action-type + date filters, pagination, CSV export — across BOTH ledgers (operator actions + platform user activity) in one browser?"
winner: "A"
tags: [phase-148, admin-03, audit-browser, filters, pagination, csv-export, two-ledgers, operator, honesty]
---

# Sketch 067: Audit Browser — filters · pagination · CSV

## Design Question

ADMIN-03's first slice: the shipped Audit tab is deliberately minimal (a plain list, no
search / filters / CSV — its own footer promises them "coming soon"). Phase 148 delivers
that promise. How does the investigation browser read?

**Intake decision (operator, 2026-07-11): ONE browser, BOTH ledgers.** The Audit tab grows
a source switch — **Operator actions** (`operator_audit_log`, the 062-A ledger) |
**Platform activity** (`audit_log`, the 19-action user vocabulary from migs 030+071) —
with the same filter/pagination/CSV grammar working on both. Requirement text
(ROADMAP SC#1): action-type + date-range filters, pagination, CSV export of the filtered set.

## How to View

open .planning/sketches/067-audit-browser/index.html

## Variants

- **A: Filter strip + table** — the 029-A chip grammar ("Show [action] [when] [user]") over
  a paged instrument table. Live match count, page ‹ › controls, Export names its row count.
  Least net-new — the shipped minimal tab grows in place.
- **B: Investigation feed** — same filters, but rows group under sticky day headers
  (Today / Yesterday / …) with time-only stamps and "Show 30 more" instead of pages.
  Optimized for "what happened yesterday?" narrative scanning.
- **C: Query rail + results** — a log-explorer: persistent left rail with every action type
  (live counts within the window), date presets, user filter — the whole query visible at
  once. Most investigative power, most chrome.

## What to Look For

1. **The source switch** — do "Operator actions | Platform activity" read as two views of
   one instrument, or two bolted-together pages? Switching to Platform records
   "Viewed platform activity" in the operator ledger (watch the band marker flash) — the
   honesty beat that looking at user activity is itself recorded.
2. **The filter grammar** — action-type picker (plain labels; ⌥ Technical names reveals
   `search.query` / `run.kill` codes), date presets + custom range with the resolved-window
   readout (030-A heritage), the ✎ changes-only chip (operator source) / user chip (platform
   source).
3. **CSV export honesty** — the button always names how many rows leave ("Export CSV · 87
   rows"), really downloads the filtered set, and the export itself lands in the ledger as
   a recorded action.
4. **Pagination shape** — A's page controls vs B's load-more vs C's pages: which matches how
   you'd actually dig through weeks of history?
5. **Empty state** — over-filter until 0 matches: the count goes amber, the empty state
   offers "Clear all filters," never a broken table.

## Grounding (real, not invented)

- **Platform vocabulary = the REAL 19-action CHECK constraint** (migs 030 + 071):
  `document.upload/delete`, `search.query`, `code.execute`, `skill.load`,
  `thread.create/delete`, `settings.update`, `memory.remember/recall`, `feedback.submit`,
  `view.create/delete`, `relationship.create/delete`, `classification.apply`,
  `classification.rule.create`, `metadata.update`, `metadata.field.create` — grouped
  Documents / Chat & agent / Organizing / Other, shown plain-first (LANG-01) with codes
  behind ⌥.
- **Operator vocabulary = the shipped 146/147 ledger** (`control_plane.visit/refresh`,
  `run.kill`, `flag.set`, `maintenance.set`) + the 148 arrivals (`user.disable/enable`,
  `visibility.set`, `audit.export`, `audit.view_platform`) — ✎ write mark per 062-A.
- **Shell = the LOCKED 061-B band + the 147-recomposed five tabs** (Control Plane ·
  Users & Access · Model Registry 🔒 · Secrets 🔒 · Audit log); this sketch unlocks
  Users & Access since 148 ships it.
- **Threat framing** (ROADMAP SC#4): reads span all users on the service-role client — the
  foot-note states reads are explicitly filtered; the platform-view banner +
  `audit.view_platform` receipt make cross-user reading visible, not silent.
- `audit_log` today has **no operator-facing read path at all** — the whole browse API is
  net-new 148 surface (flagged in the frame's foot-note).
