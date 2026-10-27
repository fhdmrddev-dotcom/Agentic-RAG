---
seed_id: SEED-388
title: The boot sweep's human-input arm consumes the run's LATEST prompt, which can belong to an earlier step
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names harness_engine.py's resume_stranded_workflows, or a stranded run whose new human step resumes with an earlier step's answer.
trigger_paths: ["backend/app/services/harness_engine.py", "backend/app/services/harness/human_input.py"]
trigger_surfaces: ["workflow"]
migration_note:
relates_to: ["296-REVIEW BE-WR-01", "296-02 BUG-261025-03 boot human arm"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-388: The boot sweep's human-input arm consumes the run's LATEST prompt, which can belong to an earlier step

## The finding

296 review BE-WR-01: `harness_engine.py` ~2766-2772 reads the run's newest ask prompt. If the new step's prompt row was never inserted (a crash between the step going active and the best-effort insert, or that insert failing) and an EARLIER step asked the same question, the sweep treats the earlier answer as this step's. Not seen live; traced in code.

## Why it matters

A human step silently proceeding on an answer given to a different question is a correctness hole in the one place a person is meant to decide.

## What to do

Key the consumed prompt by step slug (or tool_call_id recorded on the step's `_awaiting_answer`) instead of 'latest for the run'. Deferred from 296 (G-7: closure rounds do not take new design); size it with a RED test that inserts no prompt for step 2 and an answered prompt for step 1.
