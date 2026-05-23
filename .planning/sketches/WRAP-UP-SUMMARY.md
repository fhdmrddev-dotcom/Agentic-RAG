# Sketch Wrap-Up Summary

**Date:** 2026-05-24
**Sketches processed:** 3 (all included)
**Design areas:** Live-Run Container, Tool-Call Panel
**Skill output:** `./.claude/skills/sketch-findings-agentic-rag/`

## Included Sketches

| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | stream-framing | C — Run-Card | Live-Run Container |
| 002 | tool-call-panel | C — Editor Inset | Tool-Call Panel |
| 003 | thinking-moment | B — Focus Mode | Live-Run Container |

## Excluded Sketches

_None — all three sketches included._

## Design Direction

**Calm instrument with selective signal-density at the live moment.** Aether Deep Midnight palette mirrored from the live `frontend/src/index.css :.dark` so sketches look and feel like the real product. Restrained motion (brand-pulse on the working avatar, progress shimmer on the active run, status pills that fade in/out). The chrome stays out of the way until it has something to say — then it speaks clearly.

**Reference points:** Claude.ai analysis tool · Cursor/Windsurf agent mode · Linear status & motion · Raycast command surfaces.

**Acceptance bar:** the long execution in progress moment — 30+ seconds into a multi-tool run.

## Key Decisions

1. **Live run = bracketed Run-Card** in conversation flow (not inline-folded, not in a dedicated rail). Pinned header carries timer + tool counter + bot avatar. Progress shimmer while active. Folds to one-line summary when done.

2. **Tool call = editor inset.** `execute_code` is a real editor pane (line gutter, syntax highlight, lang chip). STDOUT/STDERR in labeled regions. File outputs lift out as inline preview cards. Different tool types get their own inner content shape inside the same outer frame.

3. **Focus Mode under stress.** During a long run: past tool calls auto-collapse to compact rows showing their result-summary (`→ yoy_q3 = 30.87%`), only the active step keeps its full editor open, explicit "Next: ..." footer surfaces what's queued. Past work shrinks to essence, present work gets full attention.

4. **Motion language preserved** from the existing frontend: `fadeSlideUp`, `brandPulse`, `progressShimmer`, `dotBounce`, `toolSlideIn`, `checkPop`. Sketches use the same animation tokens the real app uses.

5. **Narration interleaves with tool calls** inside the run-card body, not outside it. Italic, dim — supporting the structured execution rather than competing with it. The *final assistant message* (the answer the user reads) lives outside the run-card in its own row — the run-card is the work, the message is the answer.

6. **Thinking blocks** are compact and dim by default — single `💭 Thought · ... · 2.1s` row; click to expand into the full reasoning text.

## Open Questions Routed Forward

- **Cross-thread "live somewhere else"** — Thread A streaming while user navigates to Thread B was explicitly out of scope. Sidebar pulse hints at it, but the full pattern needs a dedicated sketch before any plan touches `StreamsProvider.tsx`.
- **Provider-specific edge cases** — Gemini thought_signature, Anthropic 22-iteration loops, OpenRouter dup output. Focus Mode + pinned timer should make these visually obvious, but a stress-test sketch with a deliberately-borked run would confirm.
- **Mobile / narrow viewport** — sketches built at desktop scale (~780px content column). Run-card with editor inset needs a narrow-viewport pass before plan.
- **Per-tool inner shapes** — pattern is "outer Editor-Inset frame + per-tool inner content," but each new tool now needs an inner-body component design decision, not just a string template.

## Skill Output

The validated decisions are packaged at `./.claude/skills/sketch-findings-agentic-rag/` with two reference files (`live-run-container.md`, `tool-call-panel.md`), the winning theme file, and all three sketches' source HTML preserved. The skill auto-loads when any chat-surface component is being built or refactored.
