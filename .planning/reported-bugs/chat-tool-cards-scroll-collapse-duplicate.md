---
id: BUG-260529-02
title: Chat tool-call cards — no auto-scroll to bottom, expanded-by-default, and read/summarize sub-agent cards duplicate & stream the full body
reported: 2026-05-29
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat-surface, frontend/components/chat/ToolCallPanel, frontend/components/chat/MessageItem, frontend/components/chat/tool-bodies, frontend/streaming]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "Reviewed at Phase 087 discuss-phase (2026-05-29) — kept SEPARATE (own future phase). Phase 087 adds only additive seam renderers (SeamPointer/SeamCard/PausedRunCue) and MUST NOT worsen these cards. Re-open as a dedicated chat-tool-card unification phase. Re-reviewed at Phase 088 discuss (2026-05-29): confirmed OUT of 088 scope (chat-surface, not the workspace panel); 088 verifies it does not block the workspace E2E flow but does not fix it — candidate for a v2.8 chat-tool-card unification phase."
reproduces_on:
  branch: v2.5-dev
  commit: dd21212
  date: 2026-05-29
---

# BUG-260529-02: Chat tool-call cards — no auto-scroll, expanded-by-default, read/summarize cards duplicate & stream full body

## What we observed

Operator-observed during normal use (2026-05-29), surfaced while reviewing the Phase 087 panel sketches. **Not yet reproduced via Chrome MCP** — these are operator reports pending live verification. Three related lived-experience defects on the chat tool-call surface:

1. **No auto-scroll to bottom during streaming.** As the agent streams tool output / text, the chat view does not follow to the bottom — the user has to scroll manually to keep watching the live work. (Possible relation to `streaming-indicator-top-bottom-desync.md`, but that is about the indicator, not the scroll-follow behavior.)

2. **Tool cards expanded by default.** Tool-call cards render uncollapsed, so a long-running / verbose tool (notably the read and summarize sub-agents) dumps its entire body into the conversation and the view keeps growing/scrolling. There is no collapsed-by-default resting state for these, so the actual conversation gets buried under streaming tool internals. (Tension with the established sketch-findings direction: past steps should fold to essence — see `sketch-findings-agentic-rag` Focus Mode.)

3. **Duplication of the read + summarize sub-agent cards specifically.** Operator reports these two particular agent/cards appear duplicated. This is reported as **distinct** from the known transient streaming-dedup flicker (`toolcallpanel-dedup-duplicates-tool-card.md` / BUG-260521-01, folded into 075.2, which self-heals in ~10–15s) — the read/summarize duplication is called out as a separate, persistent-feeling symptom on those specific sub-agents. Needs verification to confirm whether it is the same root (id-instability in the streaming reducer) manifesting on the sub-agent path, or a genuinely separate render.

The operator noted: "not sure if I reported before" — this report consolidates the parts that were NOT previously captured (#1, #2) and flags #3 as possibly-distinct-from-260521-01.

## Why it matters

**Severity = major** — affects every multi-tool run and the read/summarize sub-agent paths, which are common. This is exactly the "lived-experience UAT gap" class the project keeps getting burned by (CLAUDE.md guardrail G-4): structurally the run completes correctly, but the felt experience is messy — the user loses their place, can't find the actual answer under streamed tool internals, and second-guesses whether work ran twice. It also directly raises the stakes for the Phase 087 panel: if the chat surface is already over-dense and won't auto-follow, adding a second column makes the composite worse unless the chat side is disciplined (reinforces sketch 007 winner C — keep panel-owned tools as quiet pointers in chat, rich content in the collapsible panel).

## Hypothesized cause

Hypotheses, not findings — to be confirmed:

1. **Auto-scroll:** the chat scroll container likely lacks a "stick to bottom while at/near bottom during streaming" effect, or an existing one is gated incorrectly (e.g., disabled once the user scrolls, but never re-armed when they return to bottom). Check `MessageList.tsx` / `ChatArea.tsx` scroll handling and any `useLayoutEffect` scroll-to-bottom on new chunks.
2. **Expanded-by-default:** tool-body components (`tool-bodies/*`, esp. the read/summarize/analyze paths) and `ToolCallPanel` default to an open/expanded state with no collapse-on-complete. Likely a missing `defaultCollapsed` / fold-to-summary on terminal, inconsistent with the Focus-Mode direction.
3. **Read/summarize duplication:** could be the same `tool_call_id`-instability described in BUG-260521-01 surfacing on the sub-agent (`task` / analyze_document) SSE path, OR a separate double-render where both the sub-agent bookend events and the inner tool events render a card. Trace `sub_agent_*` SSE events through StreamsProvider → MessageItem for the read/summarize sub-agents specifically.

## Design goal for the fix (operator intent, 2026-05-29)

The fix is not just bug-squashing — the operator wants a **design unification of the chat tool-call surface**:

- **Consistency:** every tool card (search, read, execute_code, sub-agents like read/summarize, web_search, etc.) shares ONE consistent visual frame and behavior — no per-tool ad-hoc layouts that look and act differently.
- **Details on demand:** the user must still be able to drill into full details (output, source, args) — collapsed/summarized by default, expandable when wanted. Do not hide information; re-rank it.
- **Friendly + professional:** the resting state reads calm and polished (closer to the Claude.ai analysis-tool / Cursor agent feel), not a raw streamed dump.

This is a G-2 (sketch-before-plan) candidate when scoped — it's a UX redesign of a hot surface. It should reuse the established `sketch-findings-agentic-rag` direction (Focus Mode: past steps fold to result-summary; one consistent outer frame, per-tool inner body) rather than start from scratch. **Acceptance bar:** during a long multi-tool run, the conversation stays readable, every tool card looks like it belongs to the same system, and the user can expand any card for full detail without the chat scrolling away from them.

## Surface classification

`Agentic-RAG` — frontend chat-surface render/scroll bugs in this app. Routing candidate for the GSD bug cross-check at discuss-phase / new-milestone.

## Suggested routing

- **Fold into in-flight phase:** **NOT** Phase 087 (panel) — keep that phase focused on the right-side workspace panel; folding chat-tool-body refactors in would re-touch G-5 hot files (`ToolCallPanel`, `MessageItem`) the guardrails marked "satisfied (075.7)" and balloon the phase.
- **Defer to future phase:** strong candidate for a small dedicated **chat-surface polish / scroll-discipline phase** (e.g., an 087.x insert or early v2.8 slice). The auto-scroll fix (#1) is cheap and high-impact and could stand alone.
- **Plant as seed:** n/a (concrete bug, not a cross-milestone concern).
- **External — note only:** no.
- **Cross-reference:** confirm relationship to BUG-260521-01 (transient dedup) before scoping #3.

## Workarounds (UI-side)

- Manually scroll to bottom to follow streaming.
- Manually collapse verbose tool cards (if a collapse affordance exists).

## Reference / evidence links

- Related: `.planning/reported-bugs/toolcallpanel-dedup-duplicates-tool-card.md` (BUG-260521-01) — transient streaming dedup, possibly-related root for #3.
- Related: `.planning/reported-bugs/anthropic-end-of-cycle-shows-actions-not-summary.md` — summary *content* (different concern).
- Related: `.planning/reported-bugs/streaming-indicator-top-bottom-desync.md` — streaming indicator (different from scroll-follow).
- Design direction: `Skill("sketch-findings-agentic-rag")` Focus Mode — past steps fold to essence; resting tool cards should be collapsed.
- TODO: Chrome-MCP reproduction with a read/summarize sub-agent run to confirm #1–#3 and split #3 from BUG-260521-01.
