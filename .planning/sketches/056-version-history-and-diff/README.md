---
sketch: 056
name: version-history-and-diff
question: "How do immutable versions read — which is LIVE, diff between versions, provenance (manual / proposal-promoted / forced-override), per-version eval binding — and where does the 135 proposal card terminally rest?"
winner: "B"
tags: [phase-137, panel-01, ver-01, si-01, version-history, diff, provenance, promotion-gate]
---

# Sketch 056: Version History & Diff

## Design Question

PANEL-01's fifth subsurface: version history, diff-viewable. Versions are immutable
(VER-01) and each has a story — created, edited by you, promoted from an approved
improvement (with its `PromotionGate` counts), or force-promoted despite a failed gate
(`override_forced=true`, the honesty mark that must never soften — D-13). Each version
also has an eval binding: what was measured ON that version (feeding the 054 gate's
version-bound logic). How does this history read, and how do you view what changed?

The sample history is the real 135-UAT shape: v7 LIVE promoted-from-proposal (gate
passed, +1 newly passing), v6 hand-edited, v5 force-promoted with a REGRESSED gate
preserved verbatim, older versions with honest "never evaled" bindings. The v6→v7 diff
content is the real Phase-101 carry-forward (worded ratings → numeric mapping) plus the
off-topic guard — the same story the 055 run detail tells.

## How to View

open .planning/sketches/056-version-history-and-diff/index.html

## Variants

- **A: Timeline rail + inline unified diff** — vertical timeline, newest top, LIVE
  badged; provenance chip + eval binding per row; click unfolds the diff vs the previous
  version in-column (005-A). The skill's story, one change at a time.
- **B: Table + compare picker** — scan-first table + explicit any-to-any Compare
  v[x] ↔ v[y]; the diff is a pointed tool, not a scrolled story. Densest.
- **C: Provenance story cards** — each version led by its narrative; the
  `PromotionGate` counts rest permanently on the version they created (the 135
  proposal's terminal home); diff on-demand per card. Richest, tallest.

## What to Look For

- **v5 in every variant** — the force-promoted version. The failed-gate evidence must
  stay visible and un-softened (amber chip in A/B; full failing counts in C).
- **C's gate boxes on v7 vs v5:** does carrying the promotion verdict on the version
  feel like the right terminal home for the proposal loop, or is it noise once promoted?
- **B's v4 ↔ v7 compare** — three versions of accumulated change in one diff. Is
  any-to-any comparison worth the extra control, or is A's adjacent-only story enough?
- **Eval bindings** (`3/3 passed · claude-haiku` vs `never evaled`): these are what make
  054's `passed_on_older_version` state legible — do they read at a glance?
- Diff legibility at panel width: A/C diffs are in-column; would they survive 384px
  (shell 053-B) or do they need the studio (053-A/C)?

## Build Handover (reuse vs net-new)

- **Reuse:** `GET /skills/{id}/versions` (SkillVersion rows incl. `source` +
  `version_number`); the 135 `lineDiff` util (the same diff the proposal card renders);
  `SkillProposal.gate` (PromotionGate counts) + `override_forced`; eval-run →
  `skill_version_id` binding (already on every EvalRun row).
- **Net-new:** a version-list read that joins each version's eval rollups (one query or
  client-side join over existing endpoints); the provenance chip mapping from
  `SkillVersion.source` (verify the real enum values at plan time — the sketch assumes
  created / manual edit / proposal / forced can be distinguished); any-to-any compare
  (B) needs nothing new server-side (both bodies already served).
- **Flagged design proposition (NOT in current wire):** a "restore as new version"
  affordance was deliberately left OUT — restore semantics don't exist; if wanted it
  must create a NEW version (immutability), never rewrite history.
