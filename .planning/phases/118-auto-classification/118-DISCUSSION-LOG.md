# Phase 118: Auto-Classification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 118-auto-classification
**Areas discussed:** Action type (folder vs tag), Existing docs / backfill, Multi-match behavior, Review tray scope

---

## Action type — folder vs tag

| Option | Description | Selected |
|--------|-------------|----------|
| Folder-only v1 (defer tags) | Suggest a folder move only — matches existing schema (`suggest_folder_id`), zero new infra; drop tag radio; defer tags. | ✓ |
| Add tags now | Build a net-new document-tags concept (column/table + UI) so rules can suggest a tag — much larger scope. | |
| Tag = a metadata field write | Model "tag" as writing a value into an existing metadata field — blurs tag vs metadata semantics. | |

**User's choice:** Folder-only v1 (defer tags)
**Notes:** Confirmed by scout — `grep -i tags supabase/full-schema.sql` returns 0 matches; the app has no tags concept and the `classification_rules` table only has `suggest_folder_id`. Tags become a deferred idea (own future phase). → D-118-1.

---

## Existing documents / backfill

| Option | Description | Selected |
|--------|-------------|----------|
| Preview-only + honest line | "Would match N" preview counts existing docs but does NOT retroactively suggest; inline honesty "rules suggest on new uploads only." | ✓ |
| Opt-in backfill pass | Add a "run this rule across existing docs now" button writing suggestions to existing matches — net-new backfill job + UI. | |
| Leave entirely to re-ingest | No preview backfill affordance at all. | |

**User's choice:** Preview-only + honest line
**Notes:** Resolves the open question flagged in sketch 037. Mirrors the Phase 114 no-backfill precedent. Backfill sweep → deferred idea. → D-118-2.

---

## Multiple matching rules

| Option | Description | Selected |
|--------|-------------|----------|
| First-match wins (single suggestion) | Deterministic order, stop at first match → one suggestion object in `metadata._classification`. | ✓ |
| All matches (multiple suggestions) | Every matching rule as a separate suggestion (array) — multiplies UI + accept-all ambiguity. | |
| Highest-priority rule | Add an explicit priority/order field + ordering UI; single winner. | |

**User's choice:** First-match wins (single suggestion)
**Notes:** Drives `metadata._classification` = single object (not array). Eval order locked to owner-private-before-global, oldest `created_at` first (D-118-4). No rule-priority UI in v1; deferred. → D-118-3.

---

## Review tray scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 119 (Governance Health) | Ship 118 with on-doc row chip + panel card only; Phase 119 is the natural home for batch triage. | ✓ |
| Build the tray launcher now | Add the "N suggestions to review" doc-by-doc launcher in 118 — widens scope. | |

**User's choice:** Defer to Phase 119 (Governance Health)
**Notes:** Keeps the 036-B graft note: any future tray walks doc-by-doc through the SAME panel card, no "Accept all" (every accept is individual w/ own audit row). → D-118-7.

---

## Claude's Discretion

- Exact `metadata._classification` key names + the `ORDER BY` tiebreak (within D-118-4/5 intent).
- Whether `match_expr` reuses the Phase 113 compiler verbatim or via a thin classification-eval wrapper (researcher confirms operator parity).
- Precise rule-eval call-site placement between metadata-build and persist in `ingest_document`.

## Deferred Ideas

- Document tags / 🏷 tag suggestion action (needs net-new tags feature).
- Opt-in backfill sweep over existing corpus (no auto-move).
- "N suggestions to review" triage tray → Phase 119.
- Rule priority/ordering UI (only if first-match-wins proves too blunt).
