---
id: SEED-151
title: Projects — a first-class configuration container (files + instructions + its own chats), as a separate top-level page, carrying a GOVERNANCE posture no competitor's Projects feature has
status: planted
planted: 2026-08-12
planted_by: Operator direction, 2026-08-12 — "by projects I mean not necessarily linked to workflows but as a separate section", and "the same as we do in Claude AI or ChatGPT — files contained in that project, stored as the context, upload files temporarily to the chat, give instructions"
surface: Agentic-RAG
severity: n/a — capability seed, not a defect
category: product / configuration architecture / cross-surface
priority: high
scope: Large — a new top-level entity, a new page, and an inheritance rule that touches chat, workflows and (later) connections. NOT a v3.7 phase.
affected_areas: [chat, workflows, knowledge-base, settings, governance, navigation-ia]

supersedes_draft: >
  An external reviewer drafted this as "SEED-147" on 2026-08-12 without access to the working tree.
  ⚠ THAT NUMBER WAS ALREADY TAKEN — SEED-147 is `workflow-doors-not-legible`, planted by the operator
  2026-08-10. This seed is the measured rewrite. Where the draft guessed, the guess is either
  confirmed-by-measurement or corrected below, and every correction is named.

relates_to:
  - SEED-145 (connections are PLATFORM assets, not workflow assets) — THE PRECEDENT, and the seed's own
    strongest argument: 145 already ruled that ONE member of this bundle belongs to the org rather than
    to whichever surface needed it first. This seed asks whether that ruling stops at connections.
  - SEED-024 (settings architecture unification) — ⚠ THE COLLISION, and it is sharper than the draft knew:
    024 is `status: scheduled`, not merely planted. A Project is a THIRD configuration layer. Whichever
    of the two is scoped first must know the other is coming, or the second one is a rewrite.
  - SEED-004 (org multi-tenancy, `dormant`) — a Project sits between org and thread. Decide in the same
    breath whether it ENFORCES scope or merely DISPLAYS it (open question 4).
  - SEED-136 (workflows page information architecture) — its "group by what it does, not by lifecycle"
    question may have a better answer once Projects exist.
  - SEED-147 (the two authoring doors are not legible) + Phase 193 — ⚠ EXPLICITLY NOT THIS SEED. See
    "What this must not absorb".
  - SEED-084 (starter workflow library) — a starter that arrives pre-bound to a Project is a materially
    better onboarding artefact than a bare definition.
  - SEED-013 (public API + MCP server) — "ask a question against the Legal project" is a natural API
    shape and carries open question 4's blast radius.
  - SEED-080 / SEED-083 (entitlement gating, tier packaging) — Projects are countable, so they are a
    candidate pricing metric. Decide deliberately rather than discovering it.
  - SEED-085 (terminology) — the word "project" is already taken twice in this product (open question 2).

trigger_when:
  - Any user asks "how do I make the assistant always behave this way for this department / client / matter" — the answer today is "you cannot", per-thread or per-workflow only
  - SEED-024 is picked up — a settings unification blind to a Project layer will be redone
  - SEED-144 is scoped — decide whether connection bindings live on a Project BEFORE the table split, for the same reason SEED-145 gives
  - A second surface needs configuration a workflow already carries — that is this seed firing, whatever it is called at the time
  - Any B2B conversation about per-department or per-client policy separation
  - v3.7 closes — this is a leading candidate for the milestone after it
---

# SEED-151: Projects — the container the app half-built inside workflows

## What the operator asked for, in their words

> *"By projects I mean not necessarily linked to workflows but as a separate section."*
> *"The same as we do in Claude AI or ChatGPT — like we have some files that are contained in that
> project, and we can store those files as the context of this project, and at the same time we can
> upload files temporarily to the chat, chat within this project, give instructions, give additional
> things. And I think it should be separated from the workflow as a single page."*

So: **a separate top-level page**, not a workflow feature. Files that are the project's standing
context, plus temporary per-chat uploads, plus instructions, plus the chats that live inside it.

## Prior art — what the three named products actually do (researched 2026-08-12)

| | Claude Projects | ChatGPT Projects | Gemini Gems |
|---|---|---|---|
| Instructions | ✅ | ✅ | ✅ |
| Project files as standing context | ✅ most total material, auto-scaling retrieval | ✅ largest single file | ~10 files, but can link live Drive folders |
| Chats scoped to it | ✅ | ✅ | ✅ |
| Shareable | ✗ | ✗ (Custom GPTs are the separate sharing product) | ✗ |
| Locked to one model family | ✅ | ✅ | ✅ |
| **Any notion of what the assistant MAY REACH** | **✗** | **✗** | **✗** |
| **Any enforced citation / approval posture** | **✗** | **✗** | **✗** |

**All three are flat containers: instructions + files + chats.** That is the whole feature. None of
them grades governance, because none of them has governance to grade.

## The argument: the bundle already exists here, bound to the wrong thing

Measured in `backend/app/models/harness.py` — a `WorkflowDefinition` already carries, in one place:

| Field | What it really is |
|---|---|
| `project_folder_id` (098 PROJ-01) | the knowledge scope |
| per-phase `folder_scope` (098 PROJ-02) | a narrowing of that scope |
| `skill_ref` + `skill_snapshot` (099 WFSKILL-01) | the taught behaviours in play |
| `assets: list[AssetRef]` (101) | templates and reference material |
| `business_requirement` (102 D-13) | the standing statement of intent |
| `citation_policy` / `integrity_policy` / `grounding_escalated` / `action_risk_armed` | the governance posture |

Knowledge scope + instructions + skills + reference material + policy. **That is a Project.** It is
merely scoped to one workflow definition and reachable from nowhere else.

`SEED-145` already named this pattern for one member of the bundle and ruled on it: **a connection
belongs to the org, not to a surface.** Nothing about a knowledge scope, a standing instruction, or a
governance posture is workflow-specific either. **This is therefore an extension of an accepted
principle, not a new one** — which changes how it should be reviewed. The question is not *"is this a
good idea"* but *"does SEED-145's reasoning stop at connections, and if so, why?"*

## ⭐ The differentiator — and it is the same one v3.6 already sells

`STATE.md` records the v3.6 differentiator as **graded per-node governance, enforced at run time so it
is not author-loosenable-away**, and notes the Beam / Glean / n8n crawl found none of them grade
strictness by grounding. The prior-art table above extends that finding: **Claude, ChatGPT and Gemini
do not grade it either.**

Today the grading is decided **per workflow phase**. The natural business sentence is not per-phase:

> *"Everything in our Legal project requires strict citations and human approval before anything leaves
> the building. Everything in our Marketing project is free to draft."*

A Project is the only sensible home for that sentence.

**A Project carrying files and instructions is table stakes — it is catching up with three products
that already ship it. A Project carrying a POLICY is something none of them sells.** If this is built,
that is the half to build first, and it is the half that makes it a B2B feature rather than a
convenience.

⚠ **It inherits `harness.py`'s hardest constraint.** That model is deliberate that policy must fail
closed and must not be loosenable by an author — `action_risk_armed` coerces rather than raises, and
the grounding causes are *derived, never stored*, precisely so a stale row cannot lie. A Project-level
default that a workflow could silently **widen** would undo all of it. **Project policy must narrow,
never widen.**

## Open questions — the decisions, not the answers

**1. Precedence, and which direction each layer may move.**
Three layers would exist: account (`user_settings`) → project → workflow/thread. The industry default
is additive: in Claude, account preferences load first and project instructions stack on top. **But
governance is not an instruction.** For policy the rule should almost certainly be *each layer may
narrow, never widen*. Two different precedence rules for two kinds of setting is defensible and must
be **stated rather than discovered**.

**2. ⚠ The word "project" is already taken — TWICE, and I drove both on screen.**
`project_folder_id` means a KB folder (098 PROJ-01), and the Workflows page ships a **`PROJECT`
select** in its toolbar filtering by exactly that (`[data-testid="library-project-select"]`, driven
live 2026-08-12; its options are *DBA, Hybrid Search, PM Demo Project, Private, Project Meridian —
Risks, SOPs, Test Wasim, Weekly reports, Unbound*). Ship a first-class Project and **two different
things are called "project" on the same screen.** Decide the vocabulary before the schema (SEED-085).

**3. Does a Project replace or wrap the existing bindings?**
Either `WorkflowDefinition` keeps its own scope/skill/asset fields and a Project supplies defaults
(additive, zero-migration — the shape this codebase uses everywhere), or those fields move and the
definition carries a `project_id` (cleaner, a migration, one home per fact).
⚠ **The draft claimed all `workflow_definitions` rows are test fixtures, making option 2 unusually
cheap. CONFIRMED by measurement (2026-08-12): 222 rows, all dev/test data.** That window closes the
moment a customer creates real content.

**4. Is a Project a tenancy scope or a label?**
It sits naturally between org and thread. **Enforced**, it could help the service-role org-scoping
problem. **Displayed**, it becomes a fourth place to get scoping wrong. Answer in the same breath as
`SEED-004`, not after.
⚠ **Correction to the draft:** it cited `SEED-124 / 125 / 129 / 091` as "four instances of one
recurring defect". Measured — **`SEED-125` is `closed`** (2026-07-22, six sites org-gated via one
shared helper + mig 112, proven with live two-org tests) and **`SEED-124` is `folded` into Phase 165**.
Only `SEED-129` is open, and **`SEED-091` is a different defect entirely** (owner-identity UUID
disclosure on globally-shared resources, not a cross-org read). The argument survives; its evidence is
one open instance, not four.

**5. Does chat inherit automatically, or by opt-in?**
A thread started inside a Project inheriting its scope and instructions is the whole point.
⚠ **The draft flagged "chat threads carry folder scope" as an unverified inference. CONFIRMED:**
`backend/app/models/thread.py` carries `folder_id: UUID | None` (two occurrences). So the knowledge-scope
half of inheritance has somewhere to land already. What does **not** exist is any notion of an
inherited system prompt beyond account settings — and `SEED-145` warns that workflow-side governance
constructs do not transfer to chat for free. That warning applies here in full.

**6. What does a Project mean for the public API and MCP server (`SEED-013`)?**
"Ask a question against the Legal project" is a natural and probably desirable API shape, and carries
open question 4's blast radius.

**7. Is a Project a tier boundary?**
`SEED-080` / `SEED-083` both need something countable. Projects are countable. Decide deliberately
rather than discovering that the number of Projects became the pricing metric by accident.

**8. Temporary chat uploads vs project files.**
The operator asked for both: files that ARE the project's context, and files uploaded to one chat
"temporarily". Those are two different lifetimes and only the first belongs to the Project. The
ingestion path today is manual upload into the KB (a `CLAUDE.md` rule); a per-chat ephemeral file is
a genuinely new lifetime and should be scoped explicitly rather than assumed.

## What this must NOT absorb

The operator raised the Projects idea alongside a complaint about authoring. **They are different
problems with different fixes, and bundling them produces a Projects feature that leaves the second
unsolved.**

| Concern | Cause | Where it belongs |
|---|---|---|
| "No persistent configuration; I want Projects" | there is no container above a workflow or a thread | **this seed** |
| "The two drafting doors look the same" | authoring IA + naming | **`SEED-147` + Phase 193** — already planted 2026-08-10 and already scheduled |
| "The AI drafts it and I can't change it enough" | no review-after-draft moment; model is a free-text box | **Phase 196** (registry-backed picker) + **Phase 197** (guided authoring) |
| "Restricted, linear, not open" | success-path branching does not exist — jumps are `on_failure` only | **Phase 198** research → its own milestone |

A Project helps the authoring complaint only at the margin: a generator running inside a configured
Project starts from a real scope instead of guessing one. **It does nothing about whether the author
can edit what was generated.**

## Confidence — what is measured here vs guessed

**Measured against the working tree on 2026-08-12** (this is the difference between this seed and the
draft it replaces): the `WorkflowDefinition` field inventory; `thread.py` carrying `folder_id`; the
live `PROJECT` select and its options driven in the browser; 222 `workflow_definitions` rows all being
test data; the true statuses of SEED-004/013/024/124/125/129/091/136/141/142/144/145/146; that
`SEED-147` was already taken; and that `on_failure: skip_to_phase:<slug>` is the ONLY jump the harness
supports (`harness.py:337,354`).

**Still unverified and load-bearing:**
- whether `user_settings` already contains an account-level instruction mechanism a Project would
  duplicate (the draft guessed not; not checked)
- whether `business_requirement` is genuinely instruction-shaped rather than a one-line label — it is
  `str | None` (`harness.py:538`) and the publish gauntlet requires it, but its authored length and
  actual use in prompting are unexamined
- what a Project would mean for the **ingestion** surface, which this seed does not touch at all

## Related

[[SEED-145]] (the precedent this generalizes) · [[SEED-024]] (the settings collision — `scheduled`) ·
[[SEED-004]] (tenancy) · [[SEED-136]] (library IA) · [[SEED-147]] (the doors — deliberately excluded) ·
[[SEED-084]] (starters pre-bound) · [[SEED-080]] / [[SEED-083]] (tiering) · [[SEED-013]] (API scoping) ·
[[SEED-085]] (terminology)
