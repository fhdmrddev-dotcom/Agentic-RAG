---
seed_id: SEED-058
title: Chat-surface UX polish — per-provider official logos next to provider/model attribution, + New-chat/folder-scope controls always present (incl. collapsed rail)
status: planted
planted: 2026-06-06
planted_by: operator (post-095.1 discussion — two app-polish ideas raised alongside the workflows-page direction)
trigger_when: the v2.9 UX pass (workflows page + chat-surface cleanup), OR any phase that already touches RunCard/ToolCallPanel/MessageItem attribution or NavPanel/ChatLayout sidebar, OR a quick-win slot between milestones
priority: low
tags: [frontend, ux, branding, run-card, tool-panel, nav-panel, provider-logos, chat-organization]
related_seeds: [SEED-051]
surface: Agentic-RAG
---

# SEED-058: Chat-surface UX polish (provider logos + nav presence)

## Context (how it surfaced)

Operator raised two app-polish ideas during the post-095.1 next-step discussion (2026-06-06). Both are small, presentation-only, and fit a v2.9 UX cleanup pass — captured so they aren't lost.

## Idea 1 — Per-provider official logos in the run / tool panel

Today the assistant avatar is a single generic `Sparkles` icon (`frontend/src/components/chat/MessageItem.tsx:313-318`), and the run/tool-panel attribution renders `{provider} · {model} · turn N` as **plain text only** with no logo (`frontend/src/components/chat/RunCard.tsx:226-248` derive, `:300-307` render). There is **no per-provider icon/logo asset or mapping** in the codebase (only `PROVIDER_LABELS` text in `MessageInput.tsx:70-76`; no provider field in `model-info.ts`).

**Proposal:** show each used provider's OFFICIAL logo next to its name in the run/tool panel (and likely the provider picker) — openai / anthropic / google / deepseek / moonshot / zhipu(GLM) / minimax / openrouter.

**Effort: LOW–MID.** Build `providerLogos.ts` (provider → SVG/icon), render before the `provider · model` text in RunCard (and MessageInput selector). Main cost = sourcing the 8 official logos (license-clean SVGs) + keeping the assistant avatar coherent (optionally swap the generic Sparkles for the answering provider's mark, or keep Sparkles for the app and use provider logos only in attribution). Provider-agnostic, no backend change.

## Idea 2 — New-chat + folder-scope controls always present

`New chat` and the folder-scope control live in `frontend/src/components/layout/NavPanel.tsx:300-347` and ARE always visible when the sidebar is expanded — but on **desktop they fade out when the NavPanel collapses to the rail** (opacity gate on `!isCollapsed`, NavPanel.tsx:294-297). Mobile drawer always shows them (`ChatLayout.tsx:134-219`).

**Proposal:** keep `New chat` (and a compact folder-scope affordance) **present even in the collapsed rail** so the two most-used actions are always one click away — better chat-organization UX. Also worth a light pass on how chats are grouped/organized in the list.

**Effort: LOW.** Render the New-chat (icon) button + a folder icon in the collapsed rail state instead of fading the whole controls block; folder opens the existing dropdown.

## Why deferred (not done now)

Polish-tier, not on the v2.8 critical path (Phase 096 is the milestone finale: eval/verification/concurrency). Per CLAUDE.md guardrail G-2 (sketch-before-plan for UX) these should get a quick `/gsd:sketch` before building. Natural home: the v2.9 chat-surface/workflows UX pass (pairs with [[SEED-051]] the Workflows page).

## Re-open trigger

The v2.9 UX pass, OR any phase already editing RunCard/ToolCallPanel/MessageItem attribution or the NavPanel/ChatLayout sidebar, OR a between-milestone quick-win slot. Sketch first (G-2).
