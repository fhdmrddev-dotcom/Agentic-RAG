---
id: SEED-128
status: dormant
planted: 2026-07-22
planted_during: v3.5 (UX Consolidation & Chat Polish — operator-raised during Phase 175 execution)
trigger_when: Phase 174 (Run-State & Lifecycle Honesty) enters /gsd:sketch or /gsd:discuss-phase — this is the design input for how the live run reads; also relevant to Phase 178 (Chat UI/UX Polish)
scope: Medium
needs_scope_confirm: true
---

# SEED-128: Claude.ai-style collapsible run/reasoning timeline

## Why This Matters

Operator ask (raised during Phase 175 execution, 2026-07-22): display the agent's live execution — **reasoning / thinking and tool steps — in a collapsible timeline like Claude.ai**, where each step folds and unfolds. The intent is that a long agent run reads as a legible, foldable timeline of what happened, rather than a flat wall of streamed text.

This is a **design/UX input**, not a bug. It's especially timely because reasoning-first models (Phase 175) now stay in reasoning mode, so there's genuine thinking content to present well.

## ⚠️ Scope to confirm at surface time

The operator said "similar to cloud AI in a timeline with folding/unfolding capability" but did NOT pin the exact target. Confirm at Phase 174 sketch/discuss which of these it is (or all):
- **Reasoning / thinking blocks** — collapsible "thinking" sections per turn (the closest literal analog to Claude.ai's thinking UI).
- **Tool-call steps** — each tool call as a foldable timeline node (builds on the existing status-node rail / ToolCallPanel).
- **The whole run** — a unified vertical run timeline (phases + tools + reasoning) that folds per step.

Best-guess interpretation on record: reasoning/thinking blocks + tool steps as a unified collapsible run timeline. **Do not build to this guess — confirm first.**

## When to Surface

Present at **`/gsd:sketch 174`** (Phase 174 is G-2 sketch-gated for exactly the "how the live run feels" question) and again at Phase 178 (Chat UI/UX Polish). The `sketch-findings-agentic-rag` skill already owns the run-card frame, the status-node rail, MessageItem/StreamsProvider, and the harness phase timeline — this seed is a new surface within that system.

## Breadcrumbs

- Roadmap: Phase 174 (Run-State & Lifecycle Honesty — G-2 sketch, SC#10, touches `MessageItem`/`StreamsProvider`/`useMessages`/`threads.py`); Phase 178 (Chat UI/UX Polish Pass).
- Design skill: `sketch-findings-agentic-rag` (run-card frame, unified status-node rail, never-vanishes run-status strip, follow-but-release scroll).
- Existing surfaces to extend, not replace: `frontend/src/components/chat/ToolCallPanel.tsx`, `MessageItem.tsx`, the harness `PhaseTimeline`/`PhaseCard`.
- Reasoning content today: reasoning-first models keep thinking on (Phase 175 XPROV-01); check how reasoning deltas currently render before designing the fold.
- Related: [[SEED-045]] (ui-ux-polish umbrella, the next UX track).
