---
id: BUG-260823-03
title: A follow-up question can search the knowledge base with a pronoun — nothing anywhere requires the search query to be self-contained, and a bad query returns plausible wrong chunks silently
reported: 2026-08-23
surface: Agentic-RAG
severity: major
status: deferred
affected_areas: [RAG/retrieval, backend/agent-loop, prompting, cross-provider]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-020, SEED-041]
re_open_trigger: "Trigger: Evaluated during canvas graph node interactions in Phase 231"
reproduces_on:
  branch — develop
  commit — f17f9581
  date — 2026-08-23
---

# BUG-260823-03: Nothing requires a follow-up's KB search query to be self-contained

## What we observed

> Operator, 2026-08-23: *"We should check and make sure that inside the thread, the context
> history is taken into consideration — if I asked a follow up question, it should search the KB
> but in relevance to the thread history."*

⚠ **Be precise about what is measured and what is predicted, because they are different.**

**MEASURED — the code absence is confirmed:**

| Claim | How it was checked | Result |
|---|---|---|
| The model *does* see the thread history | `agent_loop.py:1265-1277` loads the full history ordered by `created_at`; `:1469-1470` rebuilds it into `messages`; `:1498` trims to the context window | ✅ history IS sent — this half is fine |
| Something rewrites a follow-up into a standalone query | `grep -rn "query_rewrit\|contextualiz\|standalone question\|rewrite_query" backend/app` | **0 hits** |
| The system prompt tells the model to resolve references before searching | `grep -in "follow-up\|self-contained\|standalone\|previous turn\|conversation history" backend/app/services/agent_loop.py` | **1 hit, and it is a comment about trimming** (`:1498`) |
| The tool schema constrains `query` | `openai_service.py:35-37` — `"The semantic search query to find relevant document chunks."` | no self-containment requirement |

**PREDICTED, NOT YET REPRODUCED:** on *"what about the second one?"* or *"and its revenue?"*,
nothing stops the model passing that fragment through as `query`. `retrieval_service.py:290`
embeds the string it is given, verbatim — a pronoun-laden fragment has no subject to embed, so
vector recall collapses to noise and the keyword arm matches stopwords.

**The repro to run before fixing anything** (it is cheap and it decides the fix):
ask a specific document question, then ask a bare follow-up, then read the actual `query`
argument off the tool call in LangSmith or the tool card. Do it on at least Anthropic, OpenAI
and Google — the strong models very likely resolve the reference unprompted, and the weak ones
(Moonshot at `emit_tier: coerce`, and the local models) very likely do not. **That spread is
the finding**, and it is what decides between a prompt fix and a code fix.

## Why it matters

This is the core loop of the product, and the failure is **silent and plausible**: a degraded
query returns *chunks*, not an error, so the agent answers confidently from the wrong passages.
Nothing in the UI distinguishes "these are the right chunks" from "these are the chunks a
pronoun retrieved." Multi-turn is the dominant usage pattern for a knowledge assistant, so if
this reproduces it is not an edge case — it is most conversations after the first question.

It also compounds with context trimming: once `:1498` drops early turns, the referent the model
would have resolved from is gone, and the query gets *worse* the longer the thread runs.

## Suggested fix shape — cheapest first, and measure between steps

1. **Prompt + schema rule (hours).** One rule in `SYSTEM_PROMPT` and one sentence on the `query`
   parameter description: *the query must stand alone — resolve pronouns and carry the subject
   forward from earlier turns; never pass a fragment that depends on the previous message.*
   The schema half matters as much as the prompt half: per the provider-docs-first rule,
   Anthropic weights tool descriptions heavily, so a prompt-only fix will not land evenly across
   the roster.
2. **Measure it.** Add eval cases to the existing eval runner: a two-turn thread whose second
   turn is a bare follow-up, asserting the emitted `query` contains the subject noun. Run the
   full native roster — this is exactly the cross-provider axis the UAT scoreboard recipe exists
   for, and the whole point is that step 1 will hold on some providers and not others.
3. **Only if (2) shows providers failing:** a deterministic contextualizer — rewrite the query
   server-side from the last N turns before embedding. This is the standard history-aware
   retriever. Keep it at the service boundary and make it observable (log the original and the
   rewritten query), because a silent rewrite is a new way to be silently wrong.

Do not start at (3). A rewriter that fires on every search adds a call to the hot path and can
degrade queries that were already good.

## Surface classification

`Agentic-RAG`. Backend prompting + retrieval; affects every provider, so it is cross-provider
work by construction.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** this wants its **own phase in v3.7** — it is a
  correctness defect in the core RAG loop, not an idea. Natural pairing with SEED-192 (the
  system-prompt monolith), since step 1 edits that same prompt and the two would otherwise
  collide on one file.
- **Plant as seed:** no — filed here deliberately, because `.planning/reported-bugs/` is swept at
  four GSD touchpoints and the seeds register is swept by nothing (see
  `reference_seeds_register_swept_by_nothing`).
- **External — note only:** no

## Workarounds

Ask self-contained questions: repeat the subject in every follow-up ("what was **the Q3 report's**
revenue?" rather than "and its revenue?"). That is a real workaround and also a demonstration of
the defect.

## Reference / evidence links

- `backend/app/services/agent_loop.py:618` — `SYSTEM_PROMPT` (12,374 chars); no follow-up rule anywhere in it
- `backend/app/services/agent_loop.py:1265-1277`, `:1469-1470`, `:1498` — history load, rebuild, trim
- `backend/app/services/openai_service.py:16-51` — `SEARCH_DOCUMENTS_TOOL`, the `query` description
- `backend/app/services/retrieval_service.py:290` — `search_documents`, embeds the given string verbatim
