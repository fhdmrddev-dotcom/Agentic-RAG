# Phase 32: Suggested Follow-Up Questions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 32-suggested-follow-up-questions
**Areas discussed:** Backend architecture, Conversation context depth, Pill appearance & loading state, Pill placement & layout, UI redesign scope

---

## Backend Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Extended SSE stream | Backend emits `done` then keeps stream alive briefly, emits `suggestions` event, then closes. Matches existing `citations`/`confidence` pattern. | ✓ |
| Separate frontend-triggered call | Frontend receives `done`, then fires a separate POST /threads/{id}/suggest. Extra round-trip, second loading state. | |

**User's choice:** Extended SSE stream
**Notes:** Consistent with the existing `onCitations`/`onConfidence` SSE callback pattern already in `api.ts`.

---

## Conversation Context Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Last Q&A pair only | Just the user's last question + completed assistant response. ~500–1000 tokens. | ✓ |
| Last 3 turns | Current Q&A plus 2 prior exchanges. Better continuity, ~2000–3000 tokens. | |

**User's choice:** Last Q&A pair only
**Notes:** Keeps token cost minimal; suggestions stay contextually tight to what was just discussed.

---

## Pill Appearance & Loading State

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing, then fade-in | No skeleton. Pills appear with gentle opacity fade-in once ready. | ✓ |
| Skeleton placeholders | 3 gray pill-shaped skeletons immediately after `done`, swap to real pills. | |

**User's choice:** Nothing, then fade-in
**Notes:** `transition-opacity duration-300` on pill container. Clean, non-distracting within the 2s window.

---

## Pill Placement & Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Below citations, subtle glass style | Bottom of message block, below citations accordion. `bg-card/60 backdrop-blur-sm` glassmorphic style. | ✓ |
| Below message text, above citations | After response text, before confidence/citations. Breaks established reading flow from Phase 27. | |

**User's choice:** Below citations, glass style
**Notes:** Preserves the answer → reliability → sources reading flow established in Phase 27. Glassmorphic style aligns with upcoming Deep Midnight redesign vocabulary.

---

## UI Redesign Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to dedicated UI Polish phase | Phase 33: Deep Midnight UI Overhaul. Phase 32 gets glassmorphic pill style only. | ✓ |
| Fold into Phase 32 | Apply all four redesign areas (ToolCallPanel, CitationCard, Layout, Mobile) alongside pills. | |

**User's choice:** Defer to Phase 33
**Notes:** User added important constraint — Skill Studio plan (discussed separately later) must be aligned with Phase 33 before redesign work touches the skills surface. Phase 33 planning depends on Skill Studio discussion outcome.

---

## Claude's Discretion

- SSE `stream_end` event design
- System prompt wording for cheap model
- Whether to add a dedicated `SUGGEST_MODEL` env override
- Exact Tailwind classes for pill border radius and spacing

## Deferred Ideas

- Phase 33: Full "Ethereal Intelligence / Deep Midnight" UI redesign (ToolCallPanel, CitationCard glass style, Layout shell AppDock, Mobile frosted drawer)
- Skill Studio plan (separate discussion, must align with Phase 33 before Phase 33 planning begins)
