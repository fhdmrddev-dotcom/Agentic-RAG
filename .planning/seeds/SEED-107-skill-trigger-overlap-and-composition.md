---
id: SEED-107
status: planted
planted: 2026-07-08
planted_during: v3.2 STRETCH (thread 5a86a9fd investigation — operator asked how a skill that internally generates a PDF interacts with a SEPARATE dedicated PDF-generation skill's triggering)
trigger_when: Operator report of the wrong skill firing / two skills firing for one request / a skill not firing because a broader one shadowed it — OR a skills-quality milestone that scopes multi-skill reliability — OR any phase that re-touches skill_catalog_filter.py / skill_lint.py / the Trigger Tuner
scope: Medium
related: [[SEED-106]] (sandbox capability parity — the "what's installed" half; this seed is the "which skill fires + how skills compose" half), [[SEED-043]] (sandbox package SSOT), Trigger Tuner (Phase 123/123.1 — sharpens ONE description against held-out examples), skill_catalog_filter.py (the ## Available Skills builder), skill_lint.py (LOAD_SKILL_POLICY + description lint), skill_embedding_service.py / match_skills (already embeds skill descriptions — reusable for overlap detection)
re_open_trigger: Next skills-focused milestone OR any operator report of skill mis-triggering with ≥2 skills whose descriptions overlap
---

# SEED-107: Skill trigger-overlap detection + explicit skill composition

> **Operator question (2026-07-08):** "If I have a skill for generating a report that
> *includes* a PDF-generation part, and separately I have a skill that IS a
> PDF-generation skill — how does that affect triggering? How does the model handle
> overlapping skills, and can one skill trigger another?"

## Current behavior (verified 2026-07-08 — the baseline this seed improves on)

- Skills are surfaced to the model as a flat `## Available Skills` list — each entry is
  just `- **{name}**: {description}` (`skill_catalog_filter.py` `_block`), budget-capped
  by `skill_catalog_max_tokens` (Phase 140).
- The policy (`skill_lint.LOAD_SKILL_POLICY`) tells the model: *"Call
  `load_skill(skill_name)` when the user's request clearly matches one of these skill
  descriptions. Match on intent, not just exact names. Do not load a skill for an
  unrelated request."*
- So **triggering is model judgment over descriptions, driven by the USER's request.**
  There is **no automatic nesting**: a loaded skill's instructions mentioning "PDF"
  does NOT auto-load a separate PDF skill. `load_skill` loads any enabled skill by name
  and can be called more than once, but nothing chains skills implicitly.

**The real failure mode is overlapping descriptions at the request level:** two skills
whose descriptions cover similar intent → the model may load the wrong one, or both,
or a broad skill may shadow a specific one. Today the only mitigations are (1) authoring
specific, distinct descriptions by hand and (2) the Trigger Tuner — which sharpens ONE
skill's description against held-out examples but does NOT reason about OTHER skills'
trigger space. There is no cross-skill overlap awareness, and no first-class way to
compose skills deliberately.

## Two capabilities this seed proposes

### (a) Trigger-overlap detection / lint (defensive)
When a skill is created or edited (skill-creator + Skill Studio), detect whether its
description overlaps another enabled skill's trigger space and warn the author before
save/publish. **We already have the machinery:** `skill_embedding_service` /
`match_skills` embeds skill descriptions for the catalog pre-filter (Phase 140) — the
same vectors give a cheap pairwise-similarity overlap score. Surface it as a
non-blocking lint ("this description is 0.87 similar to `pdf-generator` — they may
both fire; make one more specific") in the Studio, alongside the existing Trigger
Tuner. This turns the "keep descriptions distinct" best-practice into a checked signal.

### (b) Explicit skill composition (constructive)
Give a skill a first-class way to declare that it *depends on / delegates to* another
skill, instead of the ad-hoc "tell the model to `load_skill('x')` in prose" or hoping
it does the right thing. Options to weigh when scoped:
- A declared `composes: [skill_name]` field the runtime resolves (auto-loads the
  dependency's instructions when the parent loads), OR
- A sanctioned in-instruction convention the agent-loop recognizes and follows
  deterministically.
This lets "Meridian report" reuse a shared "pdf-generator" skill on purpose, with the
dependency visible and testable, rather than duplicating PDF instructions in every
report skill (the duplication that led to the fpdf2 incident in the first place).

## Why it matters

As the skill library grows (skill-creator makes this easy), description overlap becomes
likely and mis-triggering gets more expensive — the wrong skill's instructions steer a
whole turn. Overlap detection keeps a growing library honest; explicit composition
stops the copy-paste of shared steps (PDF, chart, table styling) across many skills,
which is both a maintenance win and the structural fix for "every report skill
re-invents its PDF step slightly differently."

## Breadcrumbs

- `backend/app/services/skill_catalog_filter.py` — `## Available Skills` builder +
  `build_skill_catalog_block` (per-skill line = name + description only).
- `backend/app/services/skill_lint.py` — `LOAD_SKILL_POLICY` (the trigger rule) + the
  existing per-description lint; the natural home for an overlap lint.
- `backend/app/services/skill_embedding_service.py` / `match_skills` — description
  vectors already computed; reuse for pairwise overlap scoring (no new infra).
- Trigger Tuner (Phase 123/123.1) — single-description sharpening; overlap detection is
  the multi-skill complement, not a replacement.
- `tool_dispatcher.py` `_handle_load_skill` — loads any enabled skill by name
  (catalog-independent); where an explicit-composition resolver would hook in.
