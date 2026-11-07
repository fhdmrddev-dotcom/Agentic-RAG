---
id: BUG-261107-02
title: The template fill step re-researches and drops values the approved field plan already gave it
reported: 2026-11-07
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/harness/llm_emit, backend/tools/render_template, workflow-authoring/drafter]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 58d6363a9
  date: 2026-11-07
---

# BUG-261107-02: The fill step drops values the approved plan already gave it

Tester report number: BUG-37 (Syrel-Testing-and-Bug-Report rev 5, seen during publish test WF-P4).

## What we observed

Run `63b4a82f-e209-44be-8c6e-f604ac1de9b9` (test org, workflow `5004ff14`, AFM-0431, deepseek-v4-flash,
completed 4m55s). Step 4 "Quality check" approved a 19-field plan that includes:
- `annual_leave`: "22 working days per calendar year for G1–G3, pro-rated … [H3 §2.1–2.2; H1 §4]"
  (HR-POL-003 v3.0, the current policy, cited by step 2);
- `first_90_days`: the four HVAC role-profile goals (Day 5, Day 30, Day 60, Week 11) [RP].

Step 5 "Render welcome pack" (`llm_emit`, emitter `render_template`, `folder_scope` Aldara-FM,
`citation_policy: strict`) produced a document where:
- annual leave is **blank** ("Your annual leave entitlement is .") and open items say "HR-POL-003 v3.0 not
  retrieved; the 2025 version is superseded";
- first 90 days is **blank** and open items say "the role profile's goals/milestones table is not present
  in the retrieved role-profile content";
- the step's `field_map` has 15 fields and `citations: []`.

So the emit step did its own retrieval, failed to find what step 2 found, and overrode the approved plan.
The golden case (spec WF-C1) expects 22 days and the four goals.

## Why it matters

The quality-check step is meaningless if the fill step ignores its output. Values silently go blank, and
the open items then say the source is missing when it is in the knowledge base. The fill step's answer
is wrong about the corpus.

## Hypothesized cause

`llm_emit` with `render_template` builds the field map from its own retrieval over `folder_scope`, and the
prior steps' text is either not given to it or is ranked below what it retrieves. Check how
`accumulated_outputs` reach the emitter's prompt, and whether a strict citation policy forces
re-retrieval (a value carried from the plan has no chunk id of its own, so strict mode may blank it).

## Surface classification

Agentic-RAG: the harness emitter and template render are this app's code.
