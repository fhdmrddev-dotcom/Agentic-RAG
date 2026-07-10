# Cross-Provider Capability UAT — the core-objective gate

**Purpose:** verify the app delivers its core objective — *a RAG application that is
cross-provider, multimodal, and multi-tool* — **before** shipping more features. This is a
standing gate, not a one-phase test. Run it when foundational surfaces change or before a
milestone closes.

**Created:** 2026-07-09 (after the docx-conversion UAT surfaced BUG-260709-01 + SEED-108).

## How to run it (the reliable loop)

Model-behavior + long file-gen runs (6+ min) make browser auto-driving slow and hang-prone
(Chrome MCP can freeze). The proven loop is:

1. **Operator** starts a fresh chat, picks the provider/model, pastes the prompt, watches.
2. **Claude verifies each row with hard evidence** — psycopg2 on `:54322` (messages,
   `runs.status/provider/model`, tool_calls), Redis (`runs:active`, `run:{id}` streams),
   Supabase Storage (download + inspect generated files). This is what caught the real story
   in the docx UAT (grounding %, output bytes, gap detection, run-state).
3. Chrome MCP is reserved for the **fast UI-state checks** (run-state/stop button C8,
   parallel threads C9) where a 10-second glance beats a 6-minute stream.

Tick a cell only when the evidence — not the chat's cheerful summary — confirms it.

## Providers (one representative model each)

OpenAI · Anthropic · Google (Gemini) · DeepSeek · MiniMax · OpenRouter
*(Extend to the full native roster + Zhipu/Moonshot per `feedback_cross_provider_full_native_roster` when time allows.)*

## Capability rows

> Legend for outcomes: **grounded** (real KB content) · **honest-refuse** (says it can't,
> no fake) · **fabricated** (made up — FAIL) · **fake-success** (claims done, nothing real — FAIL).

| # | Capability | Prompt (paste as-is) | PASS = | Verify via |
|---|---|---|---|---|
| C1 | Plain chat + run-state | `Hi — in one sentence, what can you do?` | Streams a reply; run finalizes; no phantom "running" | messages; `runs.status=completed`; Redis `runs:active` empties |
| C2 | **RAG grounding** | `Using my knowledge base, what are the escalated risks in Project Meridian and who owns them?` | Answer cites **real** Meridian risks (M-01 Priya Nair, M-02 Tom Becker…) — grounded, not fabricated | `search_documents`/`grep` called; answer matches `documents.full_markdown` |
| C3 | RAG honesty on empty KB | `Summarize my Q3 2026 sales figures from the knowledge base.` | Says it found no such data (KB has none) — **does NOT fabricate numbers** | tool calls return nothing relevant; no invented figures in reply |
| C4 | **Multimodal recall** | `Find the figure/table about RPA adoption or the duplicate-rate metric in my documents and tell me the exact numbers.` | Returns the real numbers from a table/figure (e.g. ~6% duplicates, USD 22.79B) | matches `full_markdown`; note if multimodal content is missed (SEED-006) |
| C5 | **Multi-tool, one turn** | `Search my docs for the Meridian duplicate rate, then run code to chart it as a bar chart PNG.` | Both `search_documents` **and** `execute_code` fire in one turn; chart PNG is real + downloadable | tool_calls has both; output PNG exists in Storage |
| C6 | **File generation** | `Create a 1-page PDF status summary of Project Meridian using my KB data.` | Real PDF downloads; content **grounded** in KB (not fabricated) | download PDF from Storage; word-overlap vs `full_markdown` |
| C7 | Skill trigger + capability honesty (Phase 142) | `Use the docx skill to convert "Defence_Guide_Chapter1.docx" to PDF and render each page.` | Honest about the layout limit **or** grounded reconstruction clearly labeled; ≤1 dead-binary hit; no loop | tool_calls (gap flags); downloaded output grounding %; no retry loop |
| C8 | **Run-state / stop honesty** | (any long run, e.g. C6) then click **Stop** mid-run | Running badge shows; **Stop actually cancels**; on completion the badge clears (no phantom) | Redis `runs:active` membership matches UI; `runs.status` after stop → this is BUG-260709-01 |
| C9 | **Parallel threads** | Start C6 in Thread A; while streaming, send C2 in Thread B | Both stream independently; no content/run bleed between threads | two `run:{id}` streams; no cross-thread message leakage |
| C10 | Long context | Paste a ~5 KB prompt (or a 50+ message thread) then ask a grounded question | Handled without truncation errors; answer still grounded | run completes; no context error; grounded reply |

## Scoring template (fill per run)

| Cap | OpenAI | Anthropic | Google | DeepSeek | MiniMax | OpenRouter |
|-----|--------|-----------|--------|----------|---------|------------|
| C1  |   |   |   |   |   |   |
| C2  |   |   |   |   |   |   |
| C3  |   |   |   |   |   |   |
| C4  |   |   |   |   |   |   |
| C5  |   |   |   |   |   |   |
| C6  |   |   |   |   |   |   |
| C7  |   |   |   |   |   |   |
| C8  |   |   |   |   |   |   |
| C9  |   |   |   |   |   |   |
| C10 |   |   |   |   |   |   |

## Known findings this gate is watching (from 2026-07-08/09)

- **BUG-260709-01** — run-state/stop desync (drives C8).
- **SEED-108** — no RAG↔sandbox file bridge; "operate on my KB doc" is reconstruction, not
  faithful conversion (drives C7; softens C6 for existing files).
- **Cross-model policy variance** — same prompt → refuse-and-ask (OpenAI/Anthropic) vs
  reconstruct-and-present (DeepSeek/MiniMax), with mild overclaim. Watch C6/C7 wording.
- **Prereq**: C2–C6 need the embedding provider (OpenAI) funded — a 429 there blocks RAG search.

## Corrective-measures policy

Any FAIL (fabricated / fake-success / lost run-state / cross-thread bleed) is a **foundation
blocker** — fix or file it before the next feature phase. `honest-refuse` and documented
`reconstruction` are acceptable-for-now (tracked in SEED-108), not blockers.
