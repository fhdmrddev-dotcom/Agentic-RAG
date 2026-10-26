---
id: BUG-261025-02
title: Evidence report header crushes the workflow title to one word per line when four buttons show
reported: 2026-10-25
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/workflows, run-evidence-report]
folded_into: "296"
verified_closed_by: null
related_seeds: []
re_open_trigger: "CLOSE when 296-HUMAN-UAT G-4 scenario 7 reads PASS with evidence (set status closed, verified_closed_by \"296\", re_open_trigger null). A FAIL routes back to its owning 296 plan under G-7."
fixed_by_commit: "296-04: GREEN 9c6b3403c (header wraps: title column no longer flex-1-crushed, actions wrap to their own row) — CSS row, D-19: checked live only"
reproduces_on:
  branch: develop
  commit: b8aed8884
  date: 2026-10-25
---

# BUG-261025-02: Evidence report header crushes the workflow title to one word per line when four buttons show

## What we observed

Phase 293 G-4 step 6 (Chrome, operator watching): the evidence report of run
`20f97ee5-8cbf-4719-9a66-60bff2e0eb61` ("Fill Vendor Intake Sheet") shows four action buttons, including
"Download the deliverable". The title column is squeezed so the title wraps one word per line:
"Fill / Vendor / Intake / Sheet".

## Why it matters

The title is the first thing a reader looks for on a printable report; a one-word-per-line title reads as
broken.

## Hypothesized cause

Pre-existing, not caused by 293. `git blame` puts the header layout in `97c87e86a` (feat(289-04): the
printable evidence report, 2026-10-19): a `flex flex-wrap items-start gap-4` row whose title column is
`min-w-0 flex-1` and whose button group does not wrap below it, so with four buttons the group takes the
width and `min-w-0` lets the title column shrink to one word. Phase 293 only added the origin line under
the sub line (293-03) and its column wrapper (293-05 D-5).

## Surface classification

`Agentic-RAG`: the app's run evidence report.

## Suggested routing

- **Fold into in-flight phase:** n/a (logged at the operator's direction during 293 G-4, not fixed)
- **Defer to future phase / milestone:** the next phase that touches the evidence report
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

A wider window, or print view.

## Reference / evidence links

- `.planning/phases/293-start-from-outside-and-close-out/293-VALIDATION.md` §"Logged bugs"
