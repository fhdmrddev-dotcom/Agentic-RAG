---
seed_id: SEED-244
title: "An expert library — reusable specialist agents a person picks by name, evaluated against agency-agents (MIT, 230+ personas)"
created: 2026-09-04
planted_during: "v3.9 close intake — operator supplied https://github.com/msitarzewski/agency-agents"
status: planted
surface: Agentic-RAG
severity: medium
category: agent-behaviour / skills / library / product-surface
priority: medium
relates_to:
  - SEED-002                                    # skill studio milestone prep
  - SEED-084                                    # starter workflow library — the same "give them something to start from" problem
  - SEED-186                                    # community skill format (one predicate away)
  - SEED-187
  - SEED-188
  - backend/app/services/skill_service.py
  - .claude/skills/                              # our own skill format, for comparison
trigger_when: >
  Planning a milestone that touches skills, agent personas, or the empty-library problem (a new
  org opens the product and has nothing to run). Also fires if a customer asks for "an agent that
  does X" rather than "a skill that does X" — the two are being conflated today.
---

## What the operator asked

They pointed at **https://github.com/msitarzewski/agency-agents** and asked whether it is of use.

## What it actually is — fetched and summarised 2026-09-04

- **230+ agent personalities across 20+ divisions** (engineering, design, marketing, sales, product,
  security, testing…), each a single **Markdown file**.
- Definition shape: frontmatter (`name`, `color`, `emoji`) + *Identity & Memory* (personality,
  voice) + *Core Mission* + *Critical Rules* (domain guardrails) + *Technical Deliverables* with
  code examples + *Workflow Process* + **Success Metrics** (measurable outcomes).
  Example: an *Evidence Collector* that defaults to finding 3–5 issues per review and requires
  visual proof for every QA finding.
- **MIT licensed**, explicitly forkable, with install/convert scripts targeting Claude Code,
  Copilot, Cursor, Aider, Windsurf, Gemini CLI and others.
- Design stance: transparent, version-controlled, customisable — *not* a black box.

## Why it is worth a seed rather than a shrug

⭐ **The valuable part is not the 230 files — it is the SHAPE.** Their definition carries two things
our skills do not: a **voice/identity** and **success metrics stated as numbers**. A skill in this
product says what to do; these say what "done well" looks like, which is exactly what our
skill-eval surface (Phase 137) wants and mostly has to be written by hand today.

Three concrete reuses, in increasing cost:

1. **Steal the field shape.** Add *identity* and *success metrics* to our skill format. Cheap,
   immediately useful to the eval studio, no dependency on their repo at all.
2. **Seed the empty library.** A new org today opens the product with nothing to run — the same
   problem `SEED-084` records for workflows. A curated handful of imported experts is a first-run
   answer.
3. **Import as a source.** MIT means we can vendor them. ⚠ Cost is not the licence, it is
   CURATION: 230 personas is a catalogue nobody browses, and most are irrelevant to a knowledge-base
   product. Import ten, not two hundred.

## The questions to answer before planning it

- ⚠ **Is an "expert" a skill, an agent, or a workflow in our model?** We already have all three
  concepts and this seed sits across them. Answer that first or it becomes a fourth.
- Does a persona change *retrieval* behaviour or only *tone*? A "Legal Analyst" that does not change
  what gets retrieved is a costume, not an expert.
- How does an expert interact with per-tool grants? A persona that implies capabilities it has not
  been granted is a promise the approval model will refuse — the honesty rule this project keeps
  re-learning.
- ⚠ `SEED-186/187/188` already record that our skill format is *"one predicate away"* from the
  community format. Check that finding before designing an importer; the work may already be tiny.

## How we would know it worked

A person picks an expert by name, runs it against their own knowledge base, and the output is
measurably different from the default agent — measured on the skill-eval surface we already ship,
against the success metrics the definition itself states.
