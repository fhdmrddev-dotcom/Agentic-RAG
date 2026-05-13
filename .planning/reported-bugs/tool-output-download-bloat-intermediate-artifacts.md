---
id: BUG-260514-01
title: Tool-output download list shows every intermediate artifact, not just the final intended output
reported: 2026-05-14
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/tool-card-display, frontend/code-execution-output, frontend/chat-surface, UX/cognitive-load]
folded_into: null
related_seeds: [SEED-008]
re_open_trigger: null
reproduces_on:
  branch: v2.5-dev
  commit: f3349b7
  date: 2026-05-14
---

# BUG-260514-01: Tool-output download list shows every intermediate artifact, not just the final intended output

## What we observed

During a single agent cycle that produced a `.pptx` deck (live observation 2026-05-14), the chat surface listed **every output file the sandbox wrote during the run**, not just the final intended deliverable. Concrete repro from the dissertation-defense pptx generation:

The final `Fahed_Mrad_DBA_Defence_Presentation.pptx` was the only artifact the user requested. But the chat showed (each as a downloadable link):

- `defence_part1.pptx` (43.9 KB — intermediate WIP, half-built deck)
- `Fahed_Mrad_DBA_Defence_Presentation.pptx` (752.1 KB — the actual deliverable)
- `age_dist.png`, `construct_means.png`, `cronbach_alpha.png`, `efa_variance.png`,
  `gender_donut.png`, `hypothesis_results.png`, `industry_dist.png`, `org_size.png`,
  `rpa_platform.png`, `success_radar.png` (10 chart PNGs — intermediate inputs that
  were already embedded into the final pptx)

So the user sees **12 download links** when they only need **1**. The intermediate `defence_part1.pptx` is structurally incomplete (slides 1-8 only); the PNGs are already inside the final deck.

**Provider-specific severity:** Anthropic-routed sessions re-display the full download list on EVERY iteration where the sandbox produces files (so the user sees the same growing list repeated multiple times before the cycle ends), then once more at terminal. OpenAI-routed sessions seem to coalesce more (one final list at terminal), so the impact is smaller there. Other providers (OpenRouter, Google) likely fall in between — not yet enumerated.

## Why it matters

- **Cognitive overhead.** The user has to scan a 12-item list to find the 1 file they actually want. The download affordance becomes a decoy.
- **Wrong-file-clicked risk.** The half-built `defence_part1.pptx` is structurally similar to the final — a hurried click downloads a broken deck.
- **Bandwidth + storage waste.** Each PNG is 40-170 KB and is already baked into the pptx. Clicking through to "see what's in it" downloads duplicate content.
- **Polish gap vs Claude.ai.** Claude.ai's tool-output UX hides intermediate artifacts behind a collapsible — only the final terminal output is in-flow. We're upstream of that polish.

## Hypothesized cause

The frontend (`MessageItem` / `MessageList` tool-card rendering) currently surfaces every `output_files` entry from the sandbox's per-cell SSE events as a top-level download chip. The agent loop doesn't distinguish "intermediate scratch artifact" from "final deliverable" — the sandbox emits both as plain `output_files`. The Anthropic-specific re-display-per-iteration symptom probably reflects how the SDK's `tool_result` blocks accumulate in the assistant turn — each tool call's output is rendered fresh at the top of the turn rather than coalesced.

Two interventions that would address this:

1. **Frontend coalescing** — at terminal, deduplicate `output_files` by filename and show the final list once at the bottom of the assistant turn, with intermediate iterations collapsed by default.
2. **Backend / agent-loop signal** — extend the sandbox SSE envelope with an `artifact_role: "intermediate" | "final"` hint, derived from whether a later iteration overwrote / superseded the file. The frontend then only auto-shows `final` artifacts; `intermediate` go behind a "Show all artifacts" disclosure.

## Surface classification

`Agentic-RAG` — this is our chat-surface display choice, not a provider behavior. Provider SDKs return tool_results; how we render the per-iteration output_files list is ours to design.

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 070 Docling httpx Spike is scoped to backend extraction; this is frontend tool-card UX).
- **Defer to future phase / milestone:** v2.6 has Phase 075 "SEED-008 + tool_args_progress Polish Bundle" — natural home. Alternatively v2.7 Agent Workspace milestone (per `.planning/PRDs/v2.7.md` Theme).
- **Plant as seed:** Already covered by SEED-008's scope (streaming UX polish). Append as Gap 3.
- **External — note only:** no.

## Workarounds (today)

- User scrolls past the chip list to find the largest pptx file in the list.
- Treat all PNGs / `_part1`-named files as ignore-by-default.

## Reference / evidence links

- Live repro 2026-05-14 (user-pasted transcript inline in conversation): Anthropic-routed pptx-generation session producing 12 output files where 1 was the intended deliverable.
- Comparison: OpenAI-routed identical prompt produced cleaner final-only download UX.
- Related: Phase 067.4 closing UAT tool-call iteration boundary surfacing (SC#6 substantive 5/5).
