---
id: BUG-261024-04
title: Every follow-up turn re-shows all files the agent ever made, and intermediate PNGs sit beside the final PDF/DOCX
reported: 2026-10-24
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/output-files, backend/agent-loop, workspace-panel]
folded_into: "296"
verified_closed_by: null
related_seeds: [SEED-054, SEED-148]
re_open_trigger: "CLOSE when 296-HUMAN-UAT G-4 scenario 8 reads PASS with evidence (set status closed, verified_closed_by \"296\", re_open_trigger null). A FAIL routes back to its owning 296 plan under G-7."
fixed_by_commit: "DEFECT half: 296-06 RED 847a00dcc, GREEN 0ad717a67 (lead 2 reproduced: the baseline re-seed never overwrites a hash this run recorded, tools/sandbox.py). Lead 1 DID NOT REPRODUCE (backend/tests/unit/test_296_chat_and_wire.py, green at base) and lead 3 DID NOT REPRODUCE (frontend/src/__tests__/providers/streamsProvider_296_followup_files.test.tsx, green at base). The INTERMEDIATES half (chart PNGs beside the document) is SEED-383 (D-10)"
reproduces_on:
  branch: production
  commit: 6db8cf40a
  date: 2026-10-24
---

# BUG-261024-04: Follow-up turns re-show every file, and intermediates crowd the deliverable

## What we observed (operator, 2026-10-24; seen before and not resolved)

1. Ask for a PDF (or DOCX / PPTX) that contains several charts. The agent renders each chart to a PNG with `execute_code`, then builds the document.
2. The answer shows **all the PNGs as output-file cards next to the PDF**, although the PDF is the only thing the person asked for.
3. On **every follow-up message** in the same thread, the files from earlier turns are shown **again**, so the list keeps growing and the newest deliverable is hard to find.

## Why it matters

The person cannot tell which file is the answer. It's confusing, and it hides the deliverable the turn was for.

## What exists already (to build on, not duplicate)

- Phase 095 sketched an output-files **hero / working split** (the deliverable as hero, everything else as "working files"). `agent_loop.py` reads an `is_hero` / `hero` flag (around `agent_loop.py:1162-1230`), but whether anything stamps it reliably is unverified.
- SEED-054 (output-file subtitle and SVG icon) and SEED-148 (workflow output files not surfaced) are adjacent.

## Expected (operator's intent)

- Show **the final requested output** prominently, one card per deliverable.
- Put the intermediate files (chart PNGs and the like) behind an optional "N working files" disclosure inside or under that card.
- A follow-up turn shows **only the files that turn produced or changed**, never re-listing earlier turns' files. Earlier files stay reachable in the Workspace panel's Files section.

## Questions to settle at discuss

- How a deliverable is identified: requested extension, last file written, or a model-declared hero, and with what fallback.
- Whether the fix lives in the agent loop (stamping), in the output-files render, or both.
- Measure first: reproduce with a "PDF with 3 charts" prompt and read which files each turn emits.
