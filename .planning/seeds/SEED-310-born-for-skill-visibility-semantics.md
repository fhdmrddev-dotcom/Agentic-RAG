---
seed_id: SEED-310
title: Born-for skill visibility — load path wider than resolve path, same-name ties, and colleagues silently lose the author's private member skills
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator rules on UAT-265-263-R7 (the BUS item cited in 265-TRIAGE.md), OR any phase touches skill_visibility.py, expert_service.py member_skills handling, tool_dispatcher.py load_skill / read_skill_file, or the Expert studio's capability groups. Phase 267 (PACK-21 additive tools) fires on it.
trigger_paths: ["backend/app/utils/skill_visibility.py", "backend/app/services/expert_service.py", "**/tool_dispatcher.py", "backend/app/services/run_producer.py", "frontend/src/components/experts/ExpertAuthoringStudio.tsx"]
trigger_surfaces: [skills, chat]
migration_note:
relates_to: ["263", "264", "267", SEED-303, R265-264-02, R265-264-03, R265-264-04, R265-264-05, UAT-265-263-R7]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-310: Born-for skill visibility semantics

## The finding

- **UAT-265-263-R7 (FAIL, live).** A non-author member ran Expert `a3cbcb0c`. `load_skill` loaded the born-for skill, `docx` and `financial_ratio_calculator`. `search-strategy-builder` and `xlsx` returned "not found or not enabled". Both are the author's PRIVATE skills, born for a DIFFERENT Expert. The studio had told the author "3 skills this Expert can actually use", yet colleagues silently lose 2 of the 5.
- **R265-264-02 (major).** The born-for arm admits every skill stamped for the bundle. It never checks that the skill is still in `member_skills`, and no code clears a stamp.
- **R265-264-03 / R265-264-04.** A colleague's private born-for row can have the same name as the caller's own private skill, because `public.skills` has no unique name. The `.maybe_single()` sites could then return 406 (PLAUSIBLE).
- **R265-264-05.** T-264-01 (carry `resolved.bundle_id`) is enforced only by a grep.

## Why it matters

An Expert shared with an org should work the same for everyone it is granted to. If it cannot, the studio must say so. Today it does neither.

## When to surface

See `trigger_when`. The R-7 semantics are an operator decision: fail at save, widen the load, or warn in the studio.

## Scope estimate

Medium. It needs a visibility-rule decision, one query change with dual-encoding fences, and studio copy.

## Breadcrumbs

263-UAT.md § Re-drive post-WR-08 (R-7) · 265-UAT-LOG.md § 263 approval round trip · 265-REVIEW-264.md.
