---
title: Competitive UX Research — Long Code Generation Patterns
date: 2026-05-25
context: Cross-provider monitoring session surfaced 30s-267s "stuck" gaps during tool arg generation. Researched how Claude.ai, ChatGPT, Gemini, and Kimi handle this on their own platforms.
---

# Competitive UX Research: Long Code Generation

## Key Finding

**Streaming text IS the progress indicator.** No major platform uses elapsed timers, progress bars, or byte counters during code generation. They all stream code token-by-token into a visible panel, and the moving cursor is the sole "alive" signal.

## Per-Platform Patterns

| Platform | Code Display | During Generation | During Execution |
|----------|-------------|-------------------|-----------------|
| Claude.ai | Side panel (Artifacts) | Token-by-token streaming into panel | Collapsed "working" indicator |
| ChatGPT | Side panel (Canvas) | Token-by-token streaming | "Analyzing..." collapsed indicator |
| Gemini | Inline code blocks / Canvas | Token-by-token streaming | N/A (no sandbox) |
| Kimi.ai | Inline code blocks | Character-by-character streaming | N/A |

## Consistent Patterns

1. **Side panel for code** is now standard (Claude Artifacts, ChatGPT Canvas, Gemini Canvas) — code always visible regardless of chat scroll position
2. **No timers or progress bars** during generation — the streaming cursor IS the feedback
3. **Tool execution (sandbox) is the exception** — collapsed "working" indicator with atomic result reveal
4. **Inline diff highlighting** for edits (both Claude and ChatGPT highlight changed sections)
5. **No platform shows elapsed time or percentage** during text/code generation

## Reframing for Agentic RAG

Our app already has `tool_args_progress` SSE events streaming `argsCodeText` during `preparing` state. The Shiki-highlighted `ExecuteCodeEditorInset` renders during `preparing` at `ToolCallPanel.tsx:717-719`. Migration 049 set the emit boundary to 256 bytes (~one event per Python line).

**The problem isn't "the data isn't surfaced" — it's "the data is surfaced in the wrong place."** The code preview renders inside the run card body (tool panel), but the user's eyes are at the bottom of the screen where "Thinking... ●●●" sits. The tool panel with streaming code is above the viewport.

**Fix direction:** Make the already-streaming code visible where the user is looking — auto-scroll to the active tool panel on `tool_preparing`, or replace "Thinking..." with the code preview. Do NOT add more SSE events, timers, or badges (the reverted commit 0dce56a proved this makes things worse).

## Sources

- Claude Artifacts: token-by-token streaming into side panel (Albato guide, Claude Help Center)
- ChatGPT Canvas: real-time code rendering since Jan 2025 (OpenAI docs)
- Gemini: standard token streaming, Canvas mode with 2.5 Pro (release notes)
- Kimi: character-by-character streaming (platform docs)
