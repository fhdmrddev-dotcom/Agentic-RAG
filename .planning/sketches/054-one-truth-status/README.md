---
sketch: 054
name: one-truth-status
question: "How do publish gate + latest-run verdict + proposal state compose into ONE honest read that can't be misread as contradictory?"
winner: null
tags: [phase-137, panel-01, gate-01, status-hierarchy, honesty, version-bound, worded-verdict, contradiction-fix]
---

# Sketch 054: One-Truth Status

## Design Question

The operator's literal 136-UAT complaint: "Publish ready — eval passed 1/1" rendered
adjacent to "0/2 with-skill cases passed" — two different truth-tellers (the gate is
CURRENT-VERSION-bound; the verdict line belongs to the NEWEST run) with no hierarchy,
reading as a flat contradiction. How does the eval surface's status header compose the
three truths (PublishGate · latest EvalRun rollup · SkillProposal state) into one read?

The sketch renders the REAL "before" UI as a foil, and every variant is driven by a
**live gate-state switcher** covering all four server states (`never_evaled` /
`latest_failed` / `passed_on_older_version` / `passed`) plus the literal **⚡ UAT
collision** (gate met on an earlier passing run while the newest run failed) and an
optional force-publish override record.

## How to View

open .planning/sketches/054-one-truth-status/index.html

## Variants

- **A: Version-bound status hero** — ONE headline card derived from `PublishGate.state`,
  always naming its version; every metric beneath is a labeled evidence row carrying its
  own `run · version` binding. Disagreement becomes information, not contradiction.
- **B: Lifecycle stepper** — Cases → Eval → Gate → Published as a quiet 4-node journey;
  counts live ON their stage node; the current stage narrates itself in one message box.
  A skill-scale, calm cousin of the workflow publish gauntlet.
- **C: Worded verdict + raw-on-demand** — one plain-language sentence that performs the
  reconciliation in prose ("a passing eval exists on v7, but your newest run failed"),
  with the verbatim `PublishGate` fields behind a `Show raw gate` disclosure (051-A
  pattern at skill scale).

## What to Look For

- **Flip to ⚡ the UAT collision in each variant** — this is the acceptance test. Does
  the 1/1-vs-0/2 pair now read as two labeled facts instead of one contradiction?
- **`passed_on_older_version`** — the subtlest state. Which variant makes "the passing
  eval is stale, re-run on the current version" instantly actionable?
- **Panel fit:** all three render inside a 384px frame. B is the tallest — does the
  journey framing earn its height?
- **The Publish button mirrors the gate** in all variants — one source of truth.
- Toggle the force-publish record: it must never disappear or soften (owner-visible
  audit, D-01/D-02).

## Build Handover (reuse vs net-new)

- **Reuse:** `GET /skills/{id}/publish-gate` (all fields already served — met, state,
  passed/measured, passing_run_id, reason, last_override); `EvalRun.passed_count /
  measured_count / case_count` rollup; `SkillProposal.status` + `PromotionGate`.
- **Net-new:** the status header component itself; a "newest run vs gate run" reconciler
  (pure client-side labeling — the server already returns both; the design change is
  BINDING each number to its run/version, no new wire).
- **Honesty locks:** raw gate fields verbatim when disclosed; the override record always
  renders when present; the collision state never hides the failing newest run.
