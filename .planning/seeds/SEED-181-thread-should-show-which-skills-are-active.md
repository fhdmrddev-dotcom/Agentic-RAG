---
seed_id: SEED-181
title: A thread does not show which skills are active — multiple skills CAN load in one thread, and nothing says which
created: 2026-08-18
planted_during: Operator live testing during the Phase 197 sketch session
status: planted
priority: medium
relates_to:
  - SEED-102 — owner/global skill name collisions; the reason pins are id-keyed rather than name-keyed.
  - `backend/app/services/skill_catalog_filter.py` — `_recently_loaded_skill_names`, the pin set.
  - `backend/app/services/agent_loop.py:1332` — where the pin set is applied per turn.
  - The Skill Studio surfaces (Phase 137) — where a skill's own lifecycle is already legible.
trigger_when: >
  Plan it when someone next touches the chat surface's status/affordance area (the run strip, the
  composer, or the tool-call panel), or the skill catalog path. Raise to a requirement on a second
  report of a user unsure which skill answered them.

  The seed is discharged when a user can see, from inside a thread, which skills are currently
  loaded for it.
surface: Agentic-RAG
---

# SEED-181 — you cannot see which skills a thread is using

## The operator's words

> *"we should know how we are going in the chat — for example, can you use more than one skill in
> the same thread?"*

Two things are being asked at once: **a question about capability**, and **a request for
visibility**. They resolve differently.

## The capability question — ANSWERED, and the answer is yes

Measured 2026-08-18. Multiple skills can be active in one thread, and previously-loaded ones persist
across turns:

- `_recently_loaded_skill_names(history_rows)` (`backend/app/services/skill_catalog_filter.py:65`)
  scans the thread's history for **every** `load_skill` tool call and returns a **set** of names —
  *"the always-keep pin set (D-02)"*. Plural by construction.
- `agent_loop.py:1332` applies that set per turn, so a skill loaded at turn 2 is still pinned at
  turn 20 even when the catalog is trimmed to fit budget.
- The agent is instructed to load skills on demand: *"**load_skill** → activate a skill; call
  silently and then follow the skill's instructions exactly"* (`agent_loop.py:662`).
- The names map to ids against the enabled set, deliberately, to avoid the owner/global name
  collision (`SEED-102`).

**So: yes — a thread can use several skills, and they accumulate.** This part needs no work; it
needs to be *knowable*.

## The visibility gap — the actual seed

Nothing in the chat tells the user which skills are loaded. The agent is told to call `load_skill`
**silently**. The tool call appears in the tool-call panel if the user goes looking, but there is no
per-thread answer to *"what is this conversation currently equipped with?"*

Why that matters:

1. **It is the product's headline claim.** The core value is *an AI colleague that can be taught new
   behaviours that persist*. A user who cannot see a skill being used cannot see the feature they
   were sold — the same failure shape as `SeedReceipt`'s own reason for existing: *"safety nobody
   can see is indistinguishable from magic, and magic is not trust."*
2. **It makes wrong answers unattributable.** If a skill's instructions shaped a reply, and the user
   thinks no skill was involved, they will blame the model — and file the wrong bug.
3. **Silent loading is deliberate and should stay.** The fix is not to make the agent narrate; it is
   to make the *state* visible. Those are different changes, and conflating them would regress the
   quiet execution surface this project has spent several phases getting right.

## What a design must decide

- **Where it lives.** A thread-scoped indicator (near the run strip or the composer) versus a panel
  section. ⚠ **G-2 fires** — this is a live chat-surface affordance, so it wants a sketch before a
  plan, and `Skill("sketch-findings-agentic-rag")` already carries the chat-surface vocabulary.
- **Loaded ≠ used.** A skill pinned at turn 2 may not have influenced turn 20. Claiming "active"
  when the honest word is "loaded" would be an overclaim of exactly the kind this project's
  vocabulary rules forbid. **Pick the honest word first, then draw it.**
- **Global vs owned skills** read differently to a user and the id-keyed pins already know the
  difference (`SEED-102`).
- **Zero state.** Most threads load no skill at all; the indicator must cost nothing when there is
  nothing to say.
