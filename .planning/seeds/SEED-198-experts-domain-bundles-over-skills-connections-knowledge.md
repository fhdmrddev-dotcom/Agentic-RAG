---
seed_id: SEED-198
title: "Experts — a domain bundle over skills + connections + KNOWLEDGE SCOPE, not a new agent type. The idea the operator could not make mature; the maturing move is that it composes four subsystems we already shipped and adds no runtime."
created: 2026-08-24
planted_during: Operator direction, 2026-08-24 — "including experts that are expert in some domain, maybe financial analyzer, maybe a strategy writer… the idea is not mature enough in my head"
status: folded
folded_into: 259
status_note: |
  ── 2026-09-16 · reviewed at `/gsd:discuss-phase 252`, LEFT PLANTED (REG-02 sweep).
  Fired on `backend/app/**` breadth only. Experts is a capability; 252 is scoped to the v4.2
  milestone audit §8 and adds no requirement id.

  ── 2026-09-18 · RE-READ against operator direction, STILL PLANTED — but its STANDING CHANGED.
  ⭐ THIS SEED IS THE SKU. Operator direction the same day ("an ecosystem that has plugins …
  that could be sold to clients on a commercial basis") makes an Expert the unit of sale, not
  just a capability. An outside architecture read independently proposed a "vertical pack
  format" as "the SKU everything else hangs from" — that is this seed, planted 25 days earlier.
  Two seeds now sit around it: SEED-291 (the extension contract — WHY a pack is allowed to be
  data and never engine code) is its PREREQUISITE DECISION, and SEED-294 (go-to-market) is the
  commercial umbrella that names what still blocks a sale. ⛔ An Expert is not sellable until
  SEED-080 / SEED-083 exist — without entitlement a pack is a folder anyone can copy.

  ── 2026-09-19 · FOLDED at `/gsd:discuss-phase 259` (D-259-01..08).
  Manifest schema, RLS, member isolation, and entitlement gating in Phase 259;
  chat thread selection, Try Asking onboarding affordance, and Financial Analyzer proof slice in Phase 260.
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-146 / SEED-144 / SEED-145 — connections. An Expert DECLARES the connections it needs; it does not own them.
  - SEED-013 — MCP. An Expert may bundle an MCP server URL the same way it bundles a skill.
  - SEED-193 — artifacts. What an Expert PRODUCES is the artifact rail; different seed, do not fold.
  - SEED-101 — skill-creator native builtin. The authoring precedent: a first-party bundle that ships with the product.
  - SEED-125 — skill cross-org leak. ⚠ THE SECURITY PRECEDENT. A shared/global Expert crosses the org boundary exactly the way a shared skill does, and that leak was real once.
  - Phase 137 / 137.1 — Skill Studio (evals, versions, triggers, lifecycle). The subsystem an Expert bundles.
  - Phase 185 — graded governance (strict-when-KB-grounded). The mechanism that makes OUR Experts different from a prompt pack.
  - v3.6 D-14 red line — "the canvas never became a second runtime". ⚠ The single most important constraint on this seed.
trigger_when: >
  Re-open at the /gsd:new-milestone AFTER the Connections milestone opens — an Expert that cannot
  reach the systems its domain lives in is a prompt pack, and the connection model is its
  prerequisite. Earlier ONLY if a user asks for a named domain persona in a real session; log the
  request here when it happens.

  Mechanical check that the gap is still real, from the repo root:
    grep -rn "skill_bundle\|skill_pack\|skill_collection" backend/app/   # -> nothing today
trigger_paths:
  - "backend/app/**"
---

# Experts — the shape the idea was missing

## The operator's words

> *"I have an idea of including experts that are expert in some domain — maybe financial analyzer,
> maybe a strategy writer. I don't know how this will be introduced… the idea is not mature enough
> in my head, but with what we have in the application and the capabilities and the potential, this
> might be a good feature."*

## Why it felt immature, and the one move that matures it

The idea resists definition because "an expert" sounds like **a new kind of agent** — a second
runtime with its own loop, its own prompt, its own tools. That framing is both a large build and a
direct violation of the constraint v3.6 held across all 13 phases (**D-14: the canvas never became a
second runtime**). Every time the idea is imagined that way it correctly feels too big and too vague.

**An Expert is not an executor. It is a BUNDLE — a manifest over things that already exist.**

Read that way, the feature has no new runtime at all. Nothing executes an Expert; the existing agent
loop executes, and the Expert only decides what is *in scope* for it.

## What an Expert bundles — all four already shipped

| Ingredient | Already in the product |
|---|---|
| **Skills** | `skills`, `skill_versions`, `skill_test_cases`, `skill_embeddings`, evals, triggers, publish gate — the whole Skill Studio (Phase 137 / 137.1) |
| **Connections** | connector connections (thin today; the Connections milestone widens them) |
| **Knowledge scope** | folders, virtual folders / saved views, document relationships, classification (v3.0) |
| **Prompt suggestions** | none yet — the one genuinely new, and genuinely small, piece |

So a **Financial Analyzer** is: the finance skills + the accounting/ERP connection + grounded on the
Finance folder + four starter questions. A **Strategy Writer** is: the research and drafting skills +
whatever it reads from + grounded on the strategy folder + its own starter questions.

## ⭐ THE DIFFERENTIATOR — and it is the knowledge half, not the skills half

Claude's own Plugins directory (screenshots, 2026-08-24) ships role bundles — Productivity, Design,
Marketing, Engineering, **Data**, **Finance**, Product Management — each a set of skills plus *"Try
asking…"* prompts. That is the same idea, and it validates the shape.

**What it structurally cannot do is scope an expert to a body of knowledge, because it has no
knowledge base.** We do. An Expert here can be *"the finance expert **that reads OUR finance
folder**"* — and under Phase 185's graded governance it can be **strict when KB-grounded**, so it
answers from the documents or refuses rather than improvising.

⚠ **That is the whole differentiator, and it is the reason not to build this as a prompt pack.** A
bundle of skills and starter prompts is a commodity that a competitor ships today. A bundle of
skills + connections + *governed knowledge scope* is not.

## The constraints, so a future plan does not discover them the hard way

1. ⚠ **An Expert MUST NOT become a second runtime.** No expert-specific agent loop, no expert-only
   tool dispatcher, no parallel executor. It is a manifest the existing loop reads. The moment an
   Expert has its own execution path, this seed has failed — that is D-14 verbatim, one subsystem over.
2. ⚠ **Sharing an Expert crosses the org boundary — SEED-125 was a REAL leak, not a hypothetical.**
   A global/shared Expert referencing skills, connections and folders multiplies the surface: a
   bundle can leak a *folder reference* even when every skill in it is clean. RLS applies to the
   bundle AND to every member, and the member check cannot be skipped because the bundle passed.
3. **Connections are a prerequisite, not a co-delivery.** An Expert that cannot reach the systems
   its domain lives in is a prompt pack. Sequence after the Connections milestone.
4. **It must work in BOTH surfaces or it is half a feature.** An Expert should be selectable in a
   chat thread *and* usable as a workflow node. The panel/chat seam is where this lands first
   (`ChatLayout.tsx` is the sole mount of the workspace panel).
5. **First-party Experts ship with the product; users author their own.** The precedent already
   exists — `skill-creator` is a native built-in (SEED-101). An Expert authored by a user is the
   same lifecycle: draft → eval → publish → version.

## The cheapest honest first slice

One Expert, first-party, end to end — **Financial Analyzer**, because finance is the domain where
"answer from the documents or refuse" is most obviously correct and most obviously valuable.

- a `skill_bundles`-shaped table (name, description, member skills, required connections, KB scope,
  prompt suggestions, org/global visibility with the SEED-125 rules applied)
- a picker in chat that scopes the thread to the Expert
- the four *"Try asking…"* prompts as the onboarding affordance
- **no new executor**

If that slice does not feel valuable with one Expert, the feature is wrong and the directory of
twelve will not save it.

## Open questions (genuinely open — do not answer them here)

1. Does selecting an Expert **restrict** the agent to that scope, or merely **bias** it? Restriction
   is more honest and more useful in finance; bias is friendlier in general chat. This may be the
   strict/loose door again (Phase 124), in which case the answer is *both, declared*.
2. Can two Experts be active at once? (Suspect no — and that "no" is a feature, not a limitation.)
3. Is an Expert a *thing you install* (directory, like the screenshots) or *a thing you author*
   (Studio, like our skills)? Probably both, but which one ships first decides the whole UI.
