---
id: BUG-260921-01
title: An AI-drafted Expert gets docx/xlsx/pptx as its "capabilities" — the skills library is the ceiling, and nothing in the authoring flow creates a domain skill
reported: 2026-09-21
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [experts, skills, backend/authoring, frontend/admin]
folded_into: "263"
verified_closed_by: null
related_seeds: [SEED-303]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: c135e8029
  date: 2026-09-21
---

# BUG-260921-01: An authored Expert has no domain skills, because none exist to select

## What we observed

Driven live in Chrome against the running app (`localhost:5173` → Organization admin → Experts →
Author New Expert), with the brainstorm prompt:

> *"I want an expert specialised in PhD literature review: systematic search strategy, PRISMA
> screening, critical appraisal of methodology, thematic synthesis, gap analysis, and writing the
> review chapter with correct citations."*

**The draft that came back was, in most respects, good:**

| Field | Result |
|---|---|
| `name` | `PhD Literature Review Expert` |
| `when_to_use` | 397 chars, specific — PRISMA screening, appraisal, thematic synthesis, gap |
| blueprint (`description`) | **2163 chars, 3 paragraphs**, with a `Capabilities:` list |
| Action Tiles | 3, titled well, prompts **921 / 966 / 1053 chars** |
| Knowledge Folders | **3 selected** |
| External Connections | **3 selected** |
| `example_output` | **6 chars** — effectively empty |

**And the skills it selected were `docx`, `xlsx`, `pptx`.**

Measured by reading the selected-state class (`bg-primary/20 border border-primary/40`) on each
skill chip in the live DOM:

```
docx                        SELECTED
xlsx                        SELECTED
pptx                        SELECTED
skill-creator               not selected
financial_ratio_calculator  not selected
project-brief-summarizer    not selected
weekly-report-writer        not selected
meridian-executive-report   not selected
arabic-tender-document      not selected
risk-lens_099uat            not selected
```

**That is the entire skills library — 10 rows** (`SELECT count(*) FROM public.skills` = 10, of
which 2 are system: `financial_ratio_calculator`, `skill-creator`). For a doctoral literature
review, the only lexical matches available are three **output file formats**.

So the Expert ships with a 2163-character blueprint describing PRISMA methodology and a capability
set of **Word, Excel and PowerPoint**.

## Why it matters

This is the operator's complaint, stated precisely: *"experts should have intensive capabilities.
It's not a skill it is a set of skills. I don't know what is the purpose of this if it does not
fulfil the purpose."*

The complaint is correct, and the cause is **not** prompt quality. `_EXPERT_DRAFTER_SYSTEM_PROMPT`
already demands an exhaustive A-to-Z configuration and item 11 already says *"Select all matching
skill names from the provided available skills, or include 3-5 recommended domain skill names."*

The cause is structural: **an Expert is a manifest over assets that already exist, and Phases
259-261 built the manifest, the authoring UI, the AI drafting and the grants — but nothing in the
product creates the skills an Expert needs.** A manifest over an empty library is empty however
well it is written.

⚠ **And the prompt's own escape hatch makes it worse, silently.** When the model follows *"or
include 3-5 recommended domain skill names"* and invents `prisma-screening` or
`thematic-synthesis`, `resolve_expert_bundle`'s phase-2 member check (`PACK-04`,
`expert_service.py:207-217`) **strips** them at run time, because they do not exist in
`public.skills`. The admin sees skills in the draft; the Expert runs with none. No warning is
surfaced to the author.

⭐ **The missing piece already ships.** `skill-creator` is a system skill and `save_skill` is a
registered tool in `_TOOL_REGISTRY`. The authoring flow is the one place that knows exactly which
domain skills an Expert is missing, and it is the one place that does not offer to create them.

## Hypothesized cause

Not a defect in one function — a **gap between two subsystems that were each built correctly**.
Expert authoring consumes the skills library read-only (`api/experts.py:125-129`, a `SELECT` over
`public.skills`) and has no write path toward it.

Hypothesis, not finding: the fix is a third step in the studio — *draft → **author missing
skills** → save* — where the drafter returns a `suggested_new_skills` list alongside
`member_skills`, and each suggestion routes to the existing `skill-creator` rather than to a new
engine. That keeps the Extension Contract intact (a skill is DATA) and adds no executor.

## Secondary findings from the same drive

**(a) Draft richness is wildly nondeterministic, because the schema requires nothing.** Only
`name` and `slug` are required on `ExpertDraftOutput`; **every** substantive field carries a
Pydantic default (`description: str = Field(default="")`), and `forced_emit` is called with
`strict=False` (`expert_authoring.py`). A model that returns one thin sentence validates
perfectly. Measured on the *same* prompt, same code, same model (`settings.llm_model = gpt-4o`):

| Run | `description` | `example_output` | tile prompts |
|---|---|---|---|
| direct service call | **293 chars**, 1 para | 164 chars | 66 / 76 / 79 chars |
| HTTP `POST /experts/draft` | — | — | `when_to_use` **600+ chars** (the prompt caps it at 140) |
| through the UI | **2163 chars**, 3 paras | **6 chars** | 921 / 966 / 1053 chars |

The prompt asks for richness; the **schema** is the contract, and the contract asks for nothing.
Add `min_length` on `description`, require the substantive fields, and either enforce or drop the
140-char `when_to_use` cap that is currently advisory and ignored.

**(b) `prompt_suggestions` can be persisted as a jsonb STRING, not an array.** Measured:

```
financial-analyzer   jsonb_typeof(prompt_suggestions) = array
phd-lr               jsonb_typeof(prompt_suggestions) = string
```

Same bug class as the `workflow_definition` jsonb-string-scalar trap already recorded in this
project. The tiles on that row are unreadable as an array.

**(c) The row the operator judged the feature by came from NEITHER current path.** `phd-lr` carries
`description = 'I want PhD literature review expert'` (the raw prompt, 35 chars) and
`when_to_use = 'Consult when working with i want phd literature questions.'` — a string that
**exists nowhere in the current source**, neither in the LLM path nor in
`_generate_fallback_draft`. It is stale mid-development data. ⚠ **Re-test before judging the
feature**; the flow as it stands today produces the 2163-char draft above.

## Surface classification

`Agentic-RAG` — shipped code on `develop` at `c135e8029`, driven live in Chrome and confirmed
against the local database.

## Suggested routing

- **Fold into in-flight phase:** **261** for (a) and (b) — schema constraints and the jsonb write
  are small and belong with the authoring code.
- **ROUTED — its own phase, ratified by the operator 2026-09-21: `Phase 263 — An Expert Can Be
  Given Its Capabilities` (`PACK-14`..`PACK-17`).** The two secondary findings (a) and (b) were
  fixed in 261 at `757bb9e25`. The main finding below is what 263 exists for.
- **Its own phase / milestone candidate:** the **main finding**. "Author the skills an Expert
  needs" is a capability, not a gap-closure item — G-7 forbids smuggling a new capability into a
  closure round.
- **Plant as seed:** `SEED-303` gains it as a ninth scenario (S9 — *an Expert is only as capable
  as the library it draws from*).
- **External — note only:** no

## Workarounds

- Author the domain skills **first**, in the Skills surface, then draft the Expert — the drafter
  selects them correctly once they exist.
- After drafting, check the selected skills by hand. If the draft lists a skill that is not in the
  library, it will be silently stripped at run time.

## Reference / evidence links

- Live drive 2026-09-21: Organization admin → Experts → Author New Expert, `localhost:5173`
- `backend/app/services/expert_authoring.py` — `ExpertDraftOutput` (defaults), `_EXPERT_DRAFTER_SYSTEM_PROMPT` item 11, `forced_emit(strict=False)`, `_generate_fallback_draft`
- `backend/app/api/experts.py:125-129` — the read-only `public.skills` SELECT
- `backend/app/services/expert_service.py:207-217` — the member check that strips invented skills
- `backend/app/services/tool_dispatcher.py` — `save_skill` is registered; `skill-creator` is a system skill row
- `SEED-303`, `BUG-260920-01`, `261-REVIEW.md`
