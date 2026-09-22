---
phase: 263-an-expert-can-be-given-its-capabilities
verified: 2026-09-23
verification_mode: independent
status: human_needed
score: 4/4 success criteria verified in code and targeted tests (1 post-review live re-drive owed)
overrides_applied: 0
gaps: []
deferred:
  - truth: "SC#2 wording — a proposed skill is created 'through the existing skill-creator / save_skill path'"
    addressed_in: "Accepted deviation (operator decision), not a later phase"
    evidence: "263-DISCUSSION-LOG.md:18-24 — option table marks `POST /skills` — the UI path ✓; 'User's choice: POST /skills — the UI path.' Recorded as D-263-03 in 263-CONTEXT.md:59-68 ('a deliberate reading of that wording, recorded rather than glossed'). skill-creator is reused as DATA (D-263-13, operator-ratified amendments commit 4ab6502ab): skill_body_authoring.py reads row …0010's craft block at call time."
  - truth: "CR-01 — a born-for skill must be LOADABLE (not just resolvable) by non-author org members"
    addressed_in: "Phase 264"
    evidence: "ROADMAP Phase 264 'Origin: 263-REVIEW.md CR-01'; 264-VERIFICATION.md status: passed. test_264_*.py re-run here: included in the 191-passed backend run."
  - truth: "263-REVIEW Info items IN-01..IN-06 (unused summary field, refresh re-lock race, import placement, reset-hazard negative fence, member_skills unbounded count, unbounded brainstorm text) and deferred-items.md D-1 (logging_sink sk- over-redaction)"
    addressed_in: "Not scheduled — Info severity, not ROADMAP criteria"
    evidence: "263-REVIEW.md:691-768 (Info section); deferred-items.md D-1 'Candidate for /gsd:fast or a seed'"
human_verification:
  - test: "Post-review re-drive of the approval round trip: in the Expert studio draft an org-visibility Expert, click 'Create this skill ->' on one proposal, save the pre-filled SkillFormDialog, then Save Expert. Read public.skills.born_for_expert_bundle_id for the new row, then as a SECOND org member (not the author) start a thread with that Expert and have the agent load the skill."
    expected: "The newly created skill row is stamped with the bundle id; a skill that was merely ticked from the existing library is NOT stamped; the second member's run lists and loads the skill body."
    why_human: "263-UAT.md R-3/R-4/R-7 were driven 2026-09-21/22 BEFORE commit f04d9c406 (WR-08), which changed the stamp contract from member_skills to a client-sent born_skills list. The frontend's NON-EMPTY born_skills path (setBornSkills in handleSaveProposedSkill, ExpertAuthoringStudio.tsx:381) has no automated test — the two WR-08 vitest cases assert only born_skills == [] — and 264's live integration drive inserts born-for rows directly rather than through the studio. Code reading shows it is wired; no run has exercised it since the change."
---

# Phase 263: An Expert Can Be Given Its Capabilities — Verification Report

**Phase Goal:** An Expert's capabilities match its description, because authoring one can author the
skills it needs. The studio names the domain skills that do not exist yet, a human approves each, and
they are created through the existing skill-creator — so an Expert stops being a manifest over an empty shelf.
**Verified:** 2026-09-23 (independent verifier; did not build this phase)
**Status:** human_needed
**Re-verification:** No — no previous VERIFICATION.md existed for 263.
**Phase base commit:** `48976e11e` (read from 263-01-SUMMARY.md). HEAD: `c6e29b42e` (develop).

## Goal Achievement — ROADMAP Success Criteria

| # | Success criterion | Status | Evidence (current code) |
|---|---|---|---|
| 1 | Drafting returns, beside `member_skills`, the domain skills that do NOT exist — named, described, visibly distinguished (PACK-14) | ✓ VERIFIED | `backend/app/services/expert_authoring.py:26` `class SuggestedNewSkill`; `:78` `suggested_new_skills: list[SuggestedNewSkill] = Field(..., min_length=0, …)` (REQUIRED); prompt item 14 at `:144` ("NEVER put a name from this list into member_skills"); the old "or include 3-5 recommended domain skill names" hatch is absent (grep 0); fallback constructor `:315`. UI: `frontend/src/components/experts/ExpertAuthoringStudio.tsx:963` "In your library" group, `:1000-1016` "Proposed for this Expert" rendering `ProposedSkillCard`; `ProposedSkillCard.tsx:26` dashed token set, `:49` ⬡ glyph, `:83` "Create this skill →". Live: 263-UAT.md R-1, R-2 PASS. |
| 2 | A proposed skill becomes real only when a human approves it, one by one, via the existing path — no second authoring engine; closed core unchanged from base (PACK-15) | ✓ VERIFIED (write-path wording = accepted deviation, see Deferred) | Approval: `ExpertAuthoringStudio.tsx:325-359` drafts a body then opens the EXISTING `SkillFormDialog` pre-filled (`SkillFormDialog.tsx:292,323-325` `initialValues`, `isEdit = !!skill` unchanged at `:304`); `:364-366` the only write is `createSkill` = existing `POST /skills`. `backend/app/api/experts.py:317-383` `POST /experts/draft-skill-body` NEVER persists; 409 `self_improve_disabled` vs 503 `skill_body_unavailable`. Doctrine borrowed: `skill_body_authoring.py:65` reads row `…0010` at call time (`:195-202`). Closed core at HEAD measured: 7 phase types / 1 emitter (`render_template`) / 29 tools; `git diff --stat 48976e11e HEAD -- harness/phase_types.py harness/emitters.py` EMPTY; base test file asserted the same 7/1/29/10. Live: R-3, R-4 (skills 10→11 from exactly ONE approval), R-9 8/8 providers. |
| 3 | An Expert saved with a skill that does not exist says so BEFORE it is saved (PACK-16) | ✓ VERIFIED | Server fence: `experts.py:54-108` `_refuse_unknown_member_skills` → 422 `expert_member_skills_unknown` with `unknown_skills`; called ABOVE the `try` in `create_expert` (`:147`, try at `:156`) and in `update_expert` (`:505`, path `bundle_id`). Client fence: `ExpertAuthoringStudio.tsx:550-559` union of proposals + phantom member skills from BOTH entry points; Save `disabled={isSaving \|\| hasUnresolvedCapabilities}` `:1393`; banner `:1317-1328`; unread library no longer vouches (WR-05, `:1335-1344`). Live: R-5 PASS, R-6 direct POST → 422 (not 400). |
| 4 | A skill authored for one org is never visible or resolvable to another, driven against a cross-org caller (PACK-17) | ✓ VERIFIED | `expert_service.py:279` `filter_visible_skill_names` now delegates to `app/utils/skill_visibility.py:skill_row_visible` (Phase 264) where the born-for arm is inside the org fence and guarded by `expert_bundle_id is not None` (`skill_visibility.py:203-207`); query encoding `:142-152`. Stamp narrowed: `db/experts.py:410-449` `org_id = $3 AND user_id = $4 AND born_for_expert_bundle_id IS NULL`, claims only `born_skills` (`expert_service.py:63-70,245-259`). CR-02/03 fixed: `/experts/draft` folder and skill menus now org-gated AND (owner OR shared) (`experts.py:~262-285`). Migration `supabase/migrations/191_skill_expert_provenance.sql` present; `full-schema.sql` carries the column (grep 6, regenerated at `9c01c74e9`). Live: R-7 five arms, cross-org → `[]`. |

**Score:** 4/4 criteria verified.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PACK-14 | 263-02, 263-04 | Drafting names the domain skills it needs that do not exist yet, visibly distinguished | ✓ SATISFIED | SC#1 rows above; `test_263_expert_draft_suggested_skills.py`, `test_263_drafter_output_fits_its_consumers.py`, `ExpertAuthoringStudio.test.tsx` pass |
| PACK-15 | 263-02, 263-03, 263-04 | Created only on human approval, one at a time, via the existing path; closed core unchanged | ✓ SATISFIED (accepted deviation on the `save_skill` wording, D-263-03) | SC#2; `test_263_craft_block_is_read.py`, `test_263_draft_skill_body_route.py`, `test_259_closed_core_inventory.py`, live `test_263_craft_block_live_read.py` pass |
| PACK-16 | 263-01, 263-03, 263-04 | Saving with a nonexistent skill says so before it is saved | ✓ SATISFIED | SC#3; `test_263_expert_save_refuses_unknown_skills.py`, `test_263_create_expert_refusals_are_clean.py`, `test_263_expert_write_paths_agree.py` pass |
| PACK-17 | 263-01 (+ 264 for the load half) | Never visible or resolvable to another org, driven cross-org | ✓ SATISFIED | SC#4; `test_263_expert_born_skill_resolution.py`, `test_seed125_skill_visibility_filter.py`, `test_263_draft_assets_are_owner_gated.py`, `test_263_stamp_claims_only_this_session.py`, `test_264_*.py` pass |

No orphaned requirements: REQUIREMENTS.md maps exactly PACK-14..17 to Phase 263.
⚠ Bookkeeping (not a code gap): `.planning/REQUIREMENTS.md:137-148,271-274` still show PACK-14..17 as `[ ]` / `Pending`.

## Review-Fix Confirmation (263-REVIEW.md claims checked against code, not trusted)

| Finding | Claimed fix | Confirmed in code |
|---|---|---|
| CR-01 | Routed to Phase 264 | ✓ `skill_visibility.py` `expert_bundle_id` on both encodings; `expert_service.py` delegates; 264-VERIFICATION.md `status: passed`; test_264 suites pass here |
| CR-02 | `45e21fca6` | ✓ `experts.py` folders: `WHERE org_id = $1 AND (user_id = $2 OR public.folder_is_org_shared(id))` |
| CR-03 | `45e21fca6` | ✓ `experts.py` skills: `WHERE (is_system = true OR (org_id = $1 AND (user_id = $2 OR is_org_shared = true))) AND is_enabled = true` |
| WR-01/02/03/08 | `f04d9c406` | ✓ `models/expert.py` `born_skills` request-only fields `:73,:104`; stamp reads `born_skills` only |
| WR-04/05 | `f04d9c406` | ✓ studio grant-sync comment block `:478+`; unread-library banner `:1335-1344` |
| WR-06/07 | `24cccda7f` | ✓ `CapabilityGrid.tsx:86-93` now reads "The agent can't write or save skills; people still can, by hand." — the false "No new skills can be saved" string is gone from non-test source |
| WR-09 | `f04d9c406` | ✓ `experts.py` 409 `expert_slug_taken` arm before a literal "Could not create expert bundle." catch-all |

## Commands Run (literal result lines)

```
# backend/, targeted unit suites
backend/venv/Scripts/python.exe -m pytest tests/unit/test_259_closed_core_inventory.py tests/unit/test_259_expert_member_isolation.py \
  tests/unit/test_261_single_expert_authoring_gate.py tests/unit/test_263_*.py tests/unit/test_264_*.py \
  tests/unit/test_seed125_skill_visibility_filter.py -q
191 passed, 1 warning in 3.26s

# backend/, read-only live-DB fence (skill-creator craft block read from row …0010)
backend/venv/Scripts/python.exe -m pytest tests/integration/test_263_craft_block_live_read.py -q -rs
5 passed, 1 warning in 0.36s

# frontend/, GSD_VITEST_MAX_WORKERS=2
npx vitest run src/components/skills/SkillFormDialog.test.tsx src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx \
  src/components/experts/__tests__/OrgExpertsTab.test.tsx --maxWorkers=2
Test Files  3 passed (3)
     Tests  43 passed (43)

# closed core at HEAD (python import of the live registries)
7 ['external_action', 'llm_agent', 'llm_batch_agents', 'llm_emit', 'llm_human_input', 'llm_single', 'programmatic']
1 ['render_template']
29
# base-commit test file 48976e11e:test_259_closed_core_inventory.py asserts == 7, == 1, == 29, == 10
git diff --stat 48976e11e HEAD -- backend/app/services/harness/phase_types.py backend/app/services/harness/emitters.py
(empty)

grep -c born_for_expert_bundle_id supabase/full-schema.sql
6
```

Not run, deliberately: `tests/integration/test_263_skill_org_stamp_live.py` — it INSERTs/DELETEs
`public.skills` rows; a verifier does not mutate the operator's DB. Its property (the org trigger
stamps `org_id`) is covered by UAT R-7 and the unit cross-org cases above. No test failed, so no
inherited-failure comparison at the base commit was needed.

## Anti-Patterns

| File | Finding | Severity |
|---|---|---|
| `frontend/src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx:652-677` | WR-08's two cases pin only `born_skills == []`; the positive (a created skill is sent) arm has no fence | ⚠ Warning — see human verification |
| 263-REVIEW IN-01..IN-06 | Unaddressed Info items | ℹ Info |
| `backend/app/services/logging_sink.py:84` | deferred-items D-1, over-redaction of `*sk-xxxxxx` words | ℹ Info (pre-existing, out of scope) |

No TBD/FIXME/XXX debt markers found in the phase's source files.

## Human Verification Required

### 1. Post-WR-08 approval → stamp → second-member load, driven live

**Test:** Draft an org-visibility Expert, approve one proposal through "Create this skill →" and the
pre-filled dialog, Save Expert; check `born_for_expert_bundle_id` on the new row (and that a
library-ticked skill is NOT stamped); then as a second org member run the Expert and load the skill.
**Expected:** Only the session-created skill is stamped; the second member's agent loads its body.
**Why human:** The UAT (R-3/R-4/R-7) ran before `f04d9c406` changed the stamp to a client-sent
`born_skills` list, and no automated test covers the non-empty path end to end.

## Gaps Summary

No blocking gaps. All four ROADMAP criteria and PACK-14..17 are backed by current code, passing
targeted suites, and a 9/9 live UAT. The one open item is a live re-drive of the approval round trip
after the review's WR-08 change, which altered the exact path R-3/R-7 proved. The SC#2 `save_skill`
wording is an operator-chosen deviation (D-263-03), and CR-01's load-time half was delivered by
Phase 264.

---
_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier, independent)_
