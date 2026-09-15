---
seed_id: SEED-192
title: The chat system prompt is a 12.4 KB monolith shared verbatim by all eight providers, and roughly two thirds of it is tool disambiguation that belongs in tool descriptions
created: 2026-08-23
planted_during: Operator note review, 2026-08-23 — "Review system prompt and evaluate if it is in a good shape or needs any update"
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - BUG-260823-03 — the follow-up/self-contained-query defect. ⚠ ITS STEP-1 FIX EDITS THIS EXACT
    STRING. Sequence them or they collide on one file; ideally the same phase does both.
  - SEED-035 — tool-count / toolbox budget. The same problem from the other end — every tool added
    grows this shared prefix for every request on every provider.
  - SEED-041 — conversation compaction. Both are context-budget concerns on the same hot path.
  - .planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md — the provider-docs-first
    rule this seed is an instance of.
  - backend/app/services/agent_loop.py:618 — SYSTEM_PROMPT; openai_service.py:1064 —
    EXPLORER_SYSTEM_PROMPT, the only variant that exists.
trigger_when: >
  ALREADY TRUE, and it grows with every tool. Concretely, re-open on whichever comes first:
  (a) BUG-260823-03 is planned — its fix edits this string, so do both at once;
  (b) any phase that ADDS a tool to the registry, since that is the moment the disambiguation
      prose grows again;
  (c) any cross-provider UAT round where a weaker-emission provider (Moonshot emit_tier — coerce,
      the local models) mis-routes between search_documents / query_documents / analyze_document.

  Mechanical check, from the repo root:
    sed -n '/^SYSTEM_PROMPT = ($/,/^)$/p' backend/app/services/agent_loop.py | wc -c   # 12374
    grep -c "SYSTEM_PROMPT" backend/app/services/agent_loop.py
trigger_paths:
  - "backend/app/services/agent_loop.py"
---

# One prompt, eight providers, and most of it is a routing table

## What is actually there

`SYSTEM_PROMPT` (`backend/app/services/agent_loop.py:618`) is **12,374 characters** of prose,
built as one concatenated string and sent as `{"role": "system"}` to every provider the app
supports. There is exactly one variant, `EXPLORER_SYSTEM_PROMPT`, selected at `:1281`; four
conditional notes are appended after it (folder scope `:1299`, catalog `:1420`, memory `:1441`,
disabled tools `:1461`) and a citation instruction is applied at `:1897`.

Read it and the shape is unmistakable: after a short preamble it is a **tool routing table**.
"Tool selection guide" enumerates twelve tools. Then a tiebreaker between two of them. Then a
hybrid-fallback rule for the same two. Then "Rules", most of which are also about which tool to
call and when to stop calling it.

## Why this is worth a phase and not a tweak

**1. It violates the project's own provider-docs-first rule.** Anthropic's guidance puts tool
selection guidance in *tool descriptions*, where it is attached to the thing it describes;
OpenAI tolerates prose routing; Moonshot's rows are the only native `emit_tier: coerce` rows in
`MODEL_CAPABILITIES` and have the weakest emission guarantee in the registry. One string cannot
be right for all three, and today one string is all there is. Conventions do not transfer 1:1
between providers — that rule is in CLAUDE.md, and this is the largest single artifact that
ignores it.

**2. Every tool taxes every request.** The prose lives in the shared prefix, so a tool a user
never touches still costs tokens on every message to every provider. SEED-035 is the same
tension counted in tool slots; this is it counted in characters.

**3. It cannot be evaluated.** There is no test that says "this prompt makes the model choose
`query_documents` over `search_documents` for a counting question." The eval runner exists and
could measure exactly that, per provider, but nothing points it at prompt behaviour today. So
the prompt has been grown by accretion — every past mis-route added a sentence, and no sentence
has ever been removed on evidence.

**4. The obvious gap is what is NOT in it.** Nothing about follow-up questions or self-contained
search queries (BUG-260823-03), and nothing about the thread's own history — in a 12.4 KB prompt
for a multi-turn knowledge assistant.

## The shape of the work, when it is taken

- **Move tool routing into tool descriptions.** Each tool already has a schema
  (`openai_service.py:16+`); the disambiguation belongs next to the tool, not in a shared table.
  This shrinks the prefix *and* puts the guidance where Anthropic-family models weight it most.
- **Keep a thin shared core** — identity, the two operating modes, citation and honesty rules.
- **Allow a per-provider delta at the service boundary**, never a fork of the whole prompt. The
  shared path must stay shared; that is the standing rule.
- **Measure before and after with the eval runner, across the full native roster.** Without that
  this becomes another accretion, just rearranged. The success criterion is per-provider tool-
  routing accuracy, not prompt length — length is the lever, not the goal.

⚠ Do not start by deleting sentences. Every one of them was almost certainly added because a
provider got something wrong; the register of *which* provider and *which* mistake was never
kept, which is the real debt here.
