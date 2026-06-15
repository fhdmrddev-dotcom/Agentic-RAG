---
id: BUG-260514-02
title: Anthropic-routed cycles end with tool-call narration instead of a synthesized final summary (OpenAI ends cleanly)
reported: 2026-05-14
surface: Agentic-RAG
severity: major
status: deferred
affected_areas: [backend/agent-loop, backend/system-prompts, frontend/chat-surface, provider/anthropic-native-sdk]
folded_into: null
related_seeds: []
re_open_trigger: "v2.7 Agent Workspace milestone planning OR a focused Anthropic-path system-prompt / agent-loop terminal-frame phase reaches design phase — at that point re-litigate root cause (system-prompt vs frontend block-ordering of mixed text+tool_use). Reviewed again during /gsd:plan-phase 075.6 (2026-05-23) — deferred again per D-075.6-D2: orthogonal to 075.6's SSE wire-format + frontend rendering-component surface; folding would ~3x phase size and cross into prompt engineering. Consistent with prior deferrals D-075-15 (2026-05-18) and D-074-10 (2026-05-17). RE-DEFERRED at /gsd:discuss-phase 093 (2026-06-01): Phase 093 rescoped to HARNESS cross-provider hardening (PARITY-02); PARITY-01 (Deep-mode polish) re-deferred — Deep is provider-robust on all 7 and this is NOT currently reproducing for the operator. Re-open via a focused Deep-mode terminal-frame UX phase OR if it re-reproduces."
reproduces_on:
  branch: v2.5-dev
  commit: f3349b7
  date: 2026-05-14
---

# BUG-260514-02: Anthropic-routed cycles end with tool-call narration instead of a synthesized final summary

## What we observed

Same prompt routed through OpenAI vs Anthropic produces very different end-of-cycle UX. Verbatim from a live 2026-05-14 session ("search for Fahed Mrad dissertation, make a professional pptx for defence session and include comprehensive charts and visuals"):

### OpenAI ending (clean final summary in flow)

The OpenAI-routed session ends with a complete, paragraph-form synthesis: *"I created Fahed_Mrad_Defense_Deck.pptx for the dissertation defense. It is based on Fahed Mrad Chapters 1 to 4.docx and includes: research problem and objectives, questions and hypotheses, methodology..."*, followed by a bullet list of what's in the deck and a "If you want, I can next create: ..." follow-up offer. The full conversation history (analysis brief, slide structure, etc.) is rendered cleanly above. The assistant turn reads as a coherent reply.

### Anthropic ending (action log, not synthesis)

The Anthropic-routed session ends with the tool-call narration block trailing into terminal:

> ```
> Output files
>   defence_part1.pptx 43.9 KB
>   Fahed_Mrad_DBA_Defence_Presentation.pptx 752.1 KB
>   age_dist.png 41.9 KB
>   ... (10 PNGs)
> Python
> Code executed
> Content QA - verifying slide content
> 1.0s
> Output (37 lines)
> === SLIDE 1 ===
>   DOCTORAL DISSERTATION DEFENCE ...
> ```

Then below all that, a SHORT final-text block reads: *"I'll start by searching for the Fahed Mrad dissertation content and loading the PPTX skill simultaneously. I found the dissertation. Let me now do a deep analysis... Now let me get the remaining hypothesis testing results... Now I have all the data needed. Let me create the comprehensive defence presentation."* — i.e., the model is narrating what it DID, in past tense, in a single run-on paragraph. No structured "here's what I built and what's in it" synthesis. No follow-up offer.

The user-facing impression: OpenAI-routed sessions feel like "an assistant gave me a finished answer"; Anthropic-routed sessions feel like "an agent ran some code and printed its log".

## Why it matters

- **Perceived polish gap.** Same backend pipeline, same skill, same deliverable — but the experience between providers is sharply different. Users (correctly) read this as the Anthropic path being underdeveloped.
- **Loss of follow-up affordance.** OpenAI's session offered "I can next create: a shorter 10-slide viva version / a more academic university-style version / a speaker-notes version" — a follow-up affordance the user can act on. Anthropic's session ends with no clear next step.
- **Cycle-2 risk.** Without a synthesis, the user often re-asks "so what's in the deck?" — burning a cycle on something the previous cycle already produced.
- **Multi-provider posture credibility.** The project sells "routed via MODEL_CAPABILITIES registry" as a strength. If one provider's end-of-cycle UX is materially worse, the parity claim weakens.

## Hypothesized cause

Two non-exclusive hypotheses:

**(a) System-prompt / agent-loop tail.** The Anthropic native SDK path may not be sending the equivalent of OpenAI's "now produce a final assistant response that summarizes what you built" final-turn injection. The agent loop ends as soon as no more tool_use blocks are emitted, and whatever short tail text Anthropic emitted in that terminal turn IS the final answer — but the model treated the prior tool_use narration as the answer body, so the tail is only a brief tying-off.

**(b) Frontend rendering of mixed text + tool_use blocks.** In a single assistant turn, Anthropic emits interleaved `text` and `tool_use` blocks. Our frontend may be rendering each block in the order received, which means the tool-call narration physically sits BETWEEN the model's intro text and its (short) terminal text — so visually it looks like the tool log is the body. OpenAI's response shape happens to put narrative text after tool_calls more often, so the order looks more natural by accident.

The two hypotheses are testable:

- For (a): look at the system prompt + final-turn injection for the Anthropic path in `backend/app/services/llm_router.py` (or wherever the provider dispatch lives). Compare to OpenAI's path. Phase 067.1's system-prompt redesign for multi-step pipelines is the closest precedent.
- For (b): inspect the SSE event ordering for an Anthropic session. If `text_block_start` events for the closing narration arrive AFTER `tool_use` events, the renderer is doing what it's told.

The Phase 067.1 system-prompt redesign work targeted exactly this class of issue (per Plan 02 SUMMARY: "context-aware in-flight copy, system-prompt redesign for multi-step pipelines, skill-load tool card copy clarity"). This bug is the same family, just specifically for the cycle-terminal frame.

## Surface classification

`Agentic-RAG` — the system prompt, agent loop, and frontend rendering are all ours. The Anthropic SDK is upstream, but the behavior gap is OUR system-prompt / tail-injection choice, not Anthropic's API.

## Suggested routing

- **Fold into in-flight phase:** n/a (Phase 070 backend extraction unrelated).
- **Defer to future phase / milestone:** strong candidate for a v2.6 polish phase OR v2.7 Agent Workspace milestone. Could fold into Phase 075 (SEED-008 + tool_args_progress polish bundle) if the planner adds an "end-of-cycle synthesis tail" task. Otherwise its own decimal phase (e.g., 075.1).
- **Plant as seed:** worth a SEED-015+ if it doesn't get folded into v2.6.
- **External — note only:** no.

## Workarounds (today)

- User prompts include "end with a clean summary of what you built and offer follow-up actions" — works ~70% of the time but adds prompt weight.
- Switch to OpenAI for cycle-terminal-polish-sensitive sessions.

## Reference / evidence links

- Verbatim transcripts from 2026-05-14 conversation (OpenAI + Anthropic side-by-side on identical prompt). User-pasted inline.
- Phase 067.1 Plan 02 SUMMARY — system-prompt redesign for multi-step pipelines (`.planning/milestones/v2.5-phases/067.1-agent-streaming-and-behavior-polish/`).
- `backend/app/services/llm_router.py` (or equivalent) — Anthropic native SDK dispatch entry point.
- Phase 053 (Cross-Provider Tool Calling Reliability) — closest prior phase on provider parity.

## Defer history

- 2026-05-23 / Phase 075.6 Plan 03 (D-075.6-D2) — deferred again per consistent precedent (D-075-15, D-074-10). Root cause is Anthropic system-prompt / agent-loop terminal-frame OR frontend block-ordering of mixed text+tool_use — orthogonal to 075.6's SSE-event + frontend-rendering-component surface. Folding into 075.6 would ~3x phase size and cross into prompt engineering. `re_open_trigger` refreshed to point at v2.7 Agent Workspace milestone planning OR a focused Anthropic-path system-prompt / agent-loop terminal-frame phase.
