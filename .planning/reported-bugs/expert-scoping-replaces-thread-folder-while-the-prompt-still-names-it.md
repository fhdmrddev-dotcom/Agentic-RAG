---
id: BUG-260920-01
title: An invited Expert replaces the thread's folder scope while the system prompt still names the old folder — and scope_mode is inert
reported: 2026-09-20
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/agent-loop, experts, RAG/retrieval, frontend/chat]
folded_into: "261"
verified_closed_by: null
related_seeds: [SEED-303]  # arms ratified as D-v4.3-01 / D-v4.3-02 on 2026-09-20
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: d87d208c2
  date: 2026-09-20
---

# BUG-260920-01: An invited Expert replaces the thread's folder scope while the system prompt still names the old folder

## What we observed

Three separate findings, all from one line shipped in Phase 260.

**1. Retrieval and the system prompt disagree inside a single turn.**

`backend/app/services/agent_loop.py:1376-1378`:

```python
# Phase 260 (PACK-02 / D-260-05) — explicit scoping data from RunContext overrides folder subtree
if ctx.effective_folder_ids is not None:
    folder_subtree_ids = list(ctx.effective_folder_ids)
```

The override replaces `folder_subtree_ids` (what `search_documents` / `query_documents` read)
and **nothing else**. `scoped_folder_path` is still built from the thread's own folder at
`:1360-1374`, and is injected into the system prompt verbatim at `:1405-1409`:

> `**IMPORTANT: This chat is scoped to the folder '<thread folder>'. ... When using ls, tree, or grep, default the path to '<thread folder>'.`

So in a folder-scoped thread with an Expert invited, vector retrieval reads the **Expert's**
folders while the model is instructed to browse the **thread's** folder. Two registers
disagreeing in one turn, and the model is told the wrong one.

**2. `scope_mode` is inert.** `restricted | biased` is declared in
`backend/app/models/expert.py:21`, persisted (`db/experts.py:43,84,201`), returned by
`expert_service.py:269` — and read by **nothing**. Zero matches in `agent_loop.py`,
`run_producer.py`, `tool_dispatcher.py`. Every Expert therefore behaves as a hard override
regardless of what its row says. Phase 259's operator decision #3 ("does an Expert RESTRICT or
merely BIAS?") was answered with a column and never enforced.

**3. Inviting an Expert silently removes ~~21 of 31~~ 19 of 29 tools.** ⚠ *Corrected 2026-09-20 at the 261 review: `_TOOL_REGISTRY` measures **29**, AST-counted at base and HEAD and confirmed by 261's own fence pinning `== 29`. The 31 came from counting grep output lines, which included comments. The finding is unchanged in kind — the four stripped tools are the same.* `run_producer.py:430-432` derives
`effective_tools` from `EXPERT_CORE_TOOLS` (10 tools) plus the bundle's connections, and
`agent_loop.py:1674-1680` filters `active_tools` down to that set. Measured against
`_TOOL_REGISTRY` (**29** entries, `tool_dispatcher.py:4544`), an Expert-scoped thread loses:

`execute_code` · `workspace_write` / `_read` / `_list` / `_delete` / `_diff` ·
`render_template` · `ask_user` · `write_todos` · `task` · `web_search` · `remember` / `recall` ·
`query_tables` · `query_documents_by_view` · `get_related_documents` · `fetch_document_file` ·
`attach_skill_file` · `save_skill` · `glob` is kept, `analyze_document` is kept.

Consequences a user meets immediately: the Expert **cannot produce a file**, **cannot compute**,
and **cannot ask a clarifying question**.

## Why it matters

The operator hit finding 1 by reasoning about it before it was measured: *"if I linked this
expert to a folder and I injected this expert into a chat in a different folder this will make a
contradiction."* It is not a future contradiction — it ships today.

The commercially worse half is finding 3. An Expert is the product's SKU. As built, inviting one
is a **capability downgrade**: the user had 29 tools a second earlier and now has 10. The
"Financial Analyst" cannot render a chart, fill a template, or write a deliverable — the three
things a buyer pictures when they hear the word *analyst*. Every competitor in this class
(Custom GPTs, Claude Projects, Copilot Studio agents) produces artifacts.

Finding 2 means the one field that could have declared the intended behaviour is decorative, so
the current behaviour is not a choice anyone made — it is the absence of one.

## Hypothesized cause

Not a coding error — a **semantic gap**. Phase 260 had to make scoping *legible* (PACK-02) and
the cheapest legible thing is replacement: one Expert, one scope, nothing ambiguous. `scope_mode`
was carried forward from 259 as the place the nuance would land, and 260 shipped before it did.
The `scoped_folder_path` desync is the mechanical tell that replacement was bolted onto a
single-scope assumption rather than designed across it.

Hypothesis, not finding: a `biased` (union) default plus an additive tool floor removes all three
findings without touching the closed-core contract, because both are data handed **to** the loop,
not branches inside it.

## Surface classification

`Agentic-RAG` — this app, shipped code on `develop` at `d87d208c2`. Routing candidate at
`/gsd:discuss-phase 261`.

## Suggested routing

- **Fold into in-flight phase:** **261** — authoring is where an author chooses the binding and
  the mode, so the semantics must be settled before the form is drawn. Findings 1 and 2 are
  ~15 lines; finding 3 is a decision plus a constant.
- **Defer to future phase / milestone:** n/a
- **Plant as seed:** `SEED-303` carries the cross-phase product model (additive-by-default,
  clone-on-customize, per-Expert attribution).
- **External — note only:** no

## Workarounds

- Prefer Experts whose `knowledge_folder_ids` match the folder the thread already sits in, or
  invite them in an **unscoped** thread (no thread folder → no contradiction, and the prompt
  injects no folder line).
- For anything needing a file, a computation or a chart: dismiss the Expert first. The chip's
  dismiss flow restores the full tool set on the next run.

## Reference / evidence links

- `backend/app/services/agent_loop.py:1376-1378` (the override), `:1360-1374` (`scoped_folder_path`), `:1405-1409` (the prompt injection), `:1674-1680` (tool filter)
- `backend/app/services/run_producer.py:378-441` (`_resolve_thread_scoping`), `:430-432` (`EXPERT_CORE_TOOLS` derivation)
- `backend/app/services/tool_dispatcher.py:4544` (`_TOOL_REGISTRY`, 31 entries), `:4585` (`EXPERT_CORE_TOOLS`, 10)
- `backend/app/models/expert.py:21` (`scope_mode`), `backend/app/services/expert_service.py:269`
- Phase 260 close: `.planning/phases/260-the-expert-you-can-actually-use/`
- `SEED-303`, `BUS-291`
