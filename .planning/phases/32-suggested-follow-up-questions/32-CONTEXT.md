# Phase 32: Suggested Follow-Up Questions - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate and display 2–3 contextually relevant follow-up question pills below each assistant response in General mode. Non-blocking: main response is never affected by suggestion generation success or failure. Absent in Explorer mode.

Three deliverables:
1. Backend: post-`done` suggestion generation using cheapest-model-per-provider, emitted as a `suggestions` SSE event
2. Frontend SSE wiring: `onSuggestions` callback in `api.ts`, same pattern as `onCitations`/`onConfidence`
3. Frontend UI: glassmorphic pill buttons below the citations section, fade-in on arrival, clicking submits immediately

</domain>

<decisions>
## Implementation Decisions

### Backend — D-01: Extended SSE stream delivery
Suggestions are delivered via the **same SSE stream**, not a separate HTTP endpoint. After the main response emits `done`, the backend keeps the stream open, runs suggestion generation (cheap model, non-blocking), emits a `suggestions` event, then closes with `stream_end`.

```
Stream timeline:
  delta... delta... done
       └── suggestions: ["...", "...", "..."]
       └── stream_end
```

If suggestion generation fails, emit `stream_end` without a `suggestions` event — frontend never shows pills. Main response is unaffected.

### Backend — D-02: Model selection
Use existing `_SUB_AGENT_MODEL_DEFAULTS` in `sub_agent_service.py` (same per-provider cheapest model pattern):
- `anthropic` → `claude-haiku-4-5-20251001`
- `openai` → `gpt-5.4-nano`
- `google` → `gemini-2.5-flash`
- `openrouter` → fallback to user's selected model
- `ollama` → fallback to user's selected model

Respects `SUB_AGENT_MODEL` env override if set.

### Backend — D-03: Conversation context passed to cheap model
**Last Q&A pair only** — the user's final message + the just-completed assistant response. No prior history.

Token cost: ~500–1000 tokens. Suggestions stay contextually tight to what was just discussed.

### Backend — D-04: Suggestion count
Request exactly 3 follow-up questions from the model. Frontend renders whatever is returned (clamped to 3 max). If model returns 2, show 2. If generation fails entirely, show nothing.

### Frontend SSE — D-05: `onSuggestions` callback
Add to `streamChat` function signature in `api.ts`:
```ts
onSuggestions?: (questions: string[]) => void
```
Handle `parsed.type === "suggestions"` in the SSE parsing loop, alongside existing `citations`/`confidence` handlers.

### Frontend UI — D-06: Pill placement
Pills appear **below the citations accordion** — at the bottom of the message block. Reading flow preserved:
```
[Message text]
[● High confidence]
[N sources ▾  (collapsed accordion)]

Follow-up:
┌───────────────────┐ ┌──────────────────┐
│ What is precision? │ │ How does RRF...  │
└───────────────────┘ └──────────────────┘
```

### Frontend UI — D-07: Pill visual style
Glassmorphic pill buttons using Aether Intelligence design language:
- `bg-card/60 backdrop-blur-sm` background
- Border accent (existing `border border-border/50` pattern)
- Hover: subtle glow (existing `hover:bg-primary/10` pattern)
- Font: `text-xs` or `text-sm`, normal weight
- "Follow-up:" label above the pill row in `text-xs text-muted-foreground`

### Frontend UI — D-08: Loading state
**No skeleton during generation.** Pills appear with a **gentle opacity fade-in** (`transition-opacity duration-300`) once the `suggestions` event arrives. If they don't arrive (timeout or failure), nothing appears. Clean, non-distracting.

### Frontend UI — D-09: Click behavior
Clicking a pill:
1. Populates the chat input with the question text
2. Immediately submits (SUG-02)

Use existing `onSendMessage` prop already available in the message context.

### Frontend UI — D-10: Explorer mode gate
Pills are **not rendered** when `agentMode === "explorer"` (existing `ChatArea.tsx` state). No backend change needed — frontend simply skips rendering the suggestion section when in Explorer mode.

### Claude's Discretion
- SSE `stream_end` event design (whether this is a new event type or reuse of existing stream close pattern)
- System prompt wording for the cheap model (should produce concise, actionable questions)
- Whether to add a `SUGGEST_MODEL` env override (follow existing `SUB_AGENT_MODEL` pattern or keep shared)
- Exact Tailwind classes for pill border radius and spacing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SSE wiring patterns
- `frontend/src/lib/api.ts` — existing `onCitations`, `onConfidence` callback pattern to replicate for `onSuggestions`

### Cheap model selection
- `backend/app/services/sub_agent_service.py` — `_SUB_AGENT_MODEL_DEFAULTS` dict and resolution logic
- `backend/app/config.py` — `sub_agent_model` setting, `SUB_AGENT_MODEL` env var

### Existing message UI structure
- `frontend/src/components/chat/MessageItem.tsx` — insertion point for suggestion pills (after citations section)
- `frontend/src/components/chat/CitationList.tsx` — existing citation accordion for placement reference
- `frontend/src/components/chat/ConfidenceBadge.tsx` — existing badge component for placement reference

### Requirements
- `.planning/REQUIREMENTS.md` — SUG-01, SUG-02, SUG-03, SUG-04

### UI design reference
- `ui_redesign_prototypes.md` — "Deep Midnight" glassmorphism aesthetic (pill glass style informed by this; full redesign deferred to Phase 33)

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sub_agent_service.py` `_SUB_AGENT_MODEL_DEFAULTS`: cheapest-model-per-provider already implemented — reuse directly for suggestion generation
- `api.ts` SSE parsing loop: `onCitations`/`onConfidence` callbacks (lines ~116–200) — `onSuggestions` follows identical pattern
- `ChatArea.tsx` `agentMode` state: `"default" | "explorer"` already in place — gate on `agentMode !== "explorer"`
- Existing chip style: `bg-primary/10 text-primary` (used in audit log filter pills) — informs pill hover state

### Established Patterns
- SSE event types: `delta`, `done`, `citations`, `confidence`, `sources`, `tool_start`, `tool_end` — `suggestions` follows same shape: `{ type: "suggestions", questions: string[] }`
- Glassmorphism: `bg-card/80 backdrop-blur-sm` used in `ToolCallPanel.tsx` — same aesthetic for suggestion pills
- Error isolation: existing SSE handlers all use optional callbacks (`onCitations?`) — `onSuggestions?` follows the same nullable pattern

### Integration Points
- `backend/app/routers/threads.py` — SSE stream generator, insertion point for post-`done` suggestion generation
- `frontend/src/components/chat/MessageItem.tsx` — render suggestion pills after `CitationList`
- `frontend/src/hooks/useMessages.ts` — may need to store `suggestions` alongside `citations`/`confidence` on the `Message` type

</code_context>

<specifics>
## Specific Ideas

- Pills use the same glassmorphism vocabulary as the "Deep Midnight" redesign doc (`bg-card/60 backdrop-blur-sm`) — consistent with the upcoming Phase 33 redesign so they won't need to be restyled
- "Follow-up:" label above the pill row (not inline) keeps the section scannable
- Pills wrap naturally if all three are long — no horizontal scroll

</specifics>

<deferred>
## Deferred Ideas

### Phase 33: Deep Midnight UI Overhaul
The full "Ethereal Intelligence / Deep Midnight" redesign from `ui_redesign_prototypes.md` is deferred to a dedicated UI Polish phase:
- **ToolCallPanel** — glassmorphic flex stepper with execution timing header, color-coded tool icons, nested frosted sub-cards
- **CitationCard** — ambient gradient glass cards (translucent, side-by-side or stacked) replacing current left-border style
- **Layout shell** — `AppDock` independent from `Sidebar.tsx`, tonal depth separation instead of borders
- **Mobile** — frosted overlay drawer (`backdrop-blur-md`) for thread history

**Important constraint:** The Skill Studio plan (discussed separately) must be aligned with Phase 33 before any redesign work touches the skills surface. Phase 33 planning must wait for the Skill Studio phase discussion to establish shared design language.

</deferred>

---

*Phase: 32-suggested-follow-up-questions*
*Context gathered: 2026-04-15*
