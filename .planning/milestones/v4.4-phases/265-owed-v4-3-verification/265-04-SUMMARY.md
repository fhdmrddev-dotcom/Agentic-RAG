---
phase: 265-owed-v4-3-verification
plan: 04
subsystem: verification
tags: [VERIFY-04, live-uat, cross-provider]
requirements: [VERIFY-04]
key-files:
  modified:
    - .planning/milestones/v4.3-phases/263-an-expert-can-be-given-its-capabilities/263-UAT.md
    - .planning/milestones/v4.3-phases/263-an-expert-can-be-given-its-capabilities/263-VERIFICATION.md
    - .planning/reported-bugs/expert-description-cap-1000-blocks-save-and-skill-body-draft.md
    - .planning/phases/265-owed-v4-3-verification/265-UAT-LOG.md
    - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
completed: 2026-09-24
---

# 265-04 Summary — 263 re-driven post-WR-08 (VERIFY-04)

**Results: R-1..R-6 PASS · R-7 FAIL · R-8 PASS · R-9 PASS (8/8, DeepSeek needed a retry) · approval round trip PASS
(operator) · BUG-260921-02 closed on evidence.**

| id | result | one line |
|---|---|---|
| UAT-265-263-R1..R6, R8 | ✅ | the draft names domain skills; proposals read as an opportunity (0 error words); one approval via SkillFormDialog; skills +1 exactly; Save held with 0 writes from both doors; phantom → 422 `unknown_skills`; FLAG-01 gates generation only |
| **UAT-265-263-R7** | ❌ FAIL | a colleague's live run loads 3 of the Expert's 5 skills. `search-strategy-builder` and `xlsx` are the author's PRIVATE skills born for another Expert; the studio told the author "3 skills this Expert can actually use", and colleagues silently lose them |
| UAT-265-263-R9 | ✅ | 8/8 valid `AuthoredSkillBody` via the real `author_skill_body`; obs `-OBS`: DB-registry ids resolve `inferred` with no `emit_tier` (the R265-262-01 class) |
| UAT-265-263-APPROVAL | ✅ (operator "pass") | Save request `born_skills = [prisma-2020-protocol-builder]`; the created skill is stamped with bundle `a3cbcb0c`; the ticked skill stays NULL; the non-author member's run loaded the created skill's body |
| UAT-265-BUG-260921-02 | ✅ closed | 4432-char description saved; draft-skill-body 200 |

## Extra fix (operator-reported during this plan)

The Expert catalog page could not scroll: `<main>` is `overflow-hidden` and the page had no scroll container. It is now
wrapped in `h-full min-h-0 overflow-y-auto`, the WorkflowsPage shape (`2acd8d656`). Verified live (scrolls to the
bottom); catalog suites 35/35. G-3-sized (1 file, 3 lines).

## Deviations

- R-9 was driven through a backend script calling the real `author_skill_body` with `skill_builder_model` set
  in-process, the same way the original board ran, not through the UI. There was no settings write.
- R-2 and R-5 evidence is rendered text plus the network capture; no screenshots (the tab was hidden).
- R-7's second-member drive used `uat265-outside`, a non-author (created_by `d8a54002` ≠ `d9e4f4e7`).

## Triage inputs for plan 05

`UAT-265-263-R7` (major) · `UAT-265-263-R9-OBS` (DB-registry capability not read on the sync path).

## Self-Check: PASSED
