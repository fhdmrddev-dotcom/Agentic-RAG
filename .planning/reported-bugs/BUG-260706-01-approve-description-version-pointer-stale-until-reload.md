---
id: BUG-260706-01
title: After approving a description proposal, the Studio version pointer (header vN + Versions LIVE badge) reconciles only on page reload
reported: 2026-07-06
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/skills-studio, skills, self-improvement]
folded_into: "176"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 9f33b008
  date: 2026-07-06
---

# BUG-260706-01: Approve description → version pointer stale until reload

## What we observed

During Phase 139 live UAT (Test 1 / Test 5), driving the SI-02 description-proposal lifecycle in the Skill Studio Triggering tab:

1. Ran the Trigger Tuner on `risk-lens_099uat` (live description hand-edited to a weak "General helper.", which was skill version v7). A reworded candidate won held-out 1.00 vs baseline 0.94.
2. Clicked **Propose this description** → DescriptionProposalCard rendered correctly.
3. Clicked **Approve** → the card immediately flipped to "Promoted to the live skill — this description now drives triggering."

Observed on the SAME screen, without reloading:
- The card said "Promoted…", and the Triggering tab's "CURRENT · LIVE · DRIVES FIRING" description text DID update to the new description (WR-05 `loadSkills()` reconcile works for the description text).
- BUT the Studio header still read **`risk-lens_099uat v7 LIVE`**, and switching to the **Versions** tab showed the LIVE badge still on **v7** — even though v8 was present in the list.
- After a full page reload, the header correctly read **`v8 LIVE`** and the Versions LIVE badge sat on **v8**.

DB was correct throughout: `skills.description` = winner text, `skill_versions` 7→8 (exactly one new — the Pitfall 2 guard held), proposal `status=promoted` with `new_skill_version_id` set.

## Why it matters

Cosmetic / trust polish, not a data defect. On the moment of approval the Studio simultaneously claims "this description now drives triggering" while the header + Versions LIVE badge still point at the OLD version — a brief honesty seam that a careful operator notices. No data loss, no double-versioning; a reload fully reconciles. Severity: minor.

## Hypothesized cause

`handleApproveDescription` (`frontend/src/pages/SkillTunerPage.tsx:531`) calls `loadSkills()` after `approveDescriptionProposal(...)` (WR-05 — reconcile-via-fetch for the description text). It does NOT invalidate/refetch the `skill_versions` query that drives the header version number (`vN`) and the Versions-tab LIVE badge. So the version pointer stays on the pre-approve version until the next natural fetch (page load). Hypothesis, not yet confirmed by reading the versions-query hook.

## Surface classification

`Agentic-RAG` — this app's Skill Studio frontend. Cross-checked at the standard GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 139 already executed; this surfaced in its live UAT)
- **Defer to future phase / milestone:** yes — a small Studio-reconcile polish; fold into the next Skill-Studio-touching phase or a WR-05 follow-up.
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

- UI-side: reload the Skill Studio page after approving; the version pointer then reflects the new live version. The live description itself is already correct without reload.
- Code-side (likely fix): in `handleApproveDescription`, after `loadSkills()`, also refetch the versions list (invalidate the versions query) so the header `vN` + Versions LIVE badge reconcile in-place — mirroring what WR-05 did for the description text.

## Reference / evidence links

- Phase 139 UAT: `.planning/phases/139-self-improve-proposer-description-only-stretch/139-HUMAN-UAT.md` (Test 1 + Test 5 evidence)
- Code: `frontend/src/pages/SkillTunerPage.tsx:531` (`handleApproveDescription`), lines 101-103 (WR-05 `loadSkills` note)
- Component: `frontend/src/components/skills/studio/DescriptionProposalCard.tsx`
