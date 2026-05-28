---
sketch: 007
name: chat-panel-seam
question: "When a panel-owned tool (write_todos / workspace_write / ask_user) fires, what belongs in the chat transcript vs the panel — live and on reload?"
winner: "C"
tags: [seam, redundancy, reload, transcript, ask_user-history]

# Decision: C (live-pointer / reload-resolved). Mental model: PANEL = what's
# true now (reconciles to current state on reload, never replays history);
# CHAT = what happened. Live: panel-owned tools (write_todos/workspace_write/
# ask_user) render as quiet one-line pointers in chat (no noisy duplication
# while the panel is the live canonical view). Reload: the transcript RESOLVES
# to compact self-contained cards — answered Q&A renders (closes the documented
# ask_user reload gap), files become clickable chips, todos collapse to a
# final-state note. Reinforced by operator feedback that the existing chat tool
# cards are already over-dense — C keeps the chat scannable instead of piling on.
---

# Sketch 007: Chat ↔ Panel Seam

## Design Question

Verified in the codebase: `write_todos`, `workspace_write`, and `ask_user` have **no chat tool-body renderer** (chat has 13 renderers; none for these three). Today they'd fall through to the generic raw-JSON tool row. Meanwhile the panel (sketches 004–006) renders them richly. So two things must be decided so the panel and chat don't fight:

1. **Live:** how much should the chat *echo* a panel-owned tool, so the transcript reads naturally without noisily duplicating the panel?
2. **Reload:** the panel reconciles to **current** state (final todos, current files, only *still-pending* questions). It does **not** replay history. So if the chat doesn't carry it, the answered question + "what happened" **disappear on reload** — exactly the gap documented in STATE.md (no renderer for `tool_calls[].kind='ask_user_*'`).

## How to View

```
open .planning/sketches/007-chat-panel-seam/index.html
```

Toggle **● Live (mid-run)** vs **↻ Reloaded thread** and compare the 4 tabs. Start at **✕ Today** to see the broken baseline (raw JSON rows; answered question gone on reload).

## Variants

- **✕ Today (generic):** the current fallback — raw `write_todos {...}` JSON rows. On reload the `ask_user` answer is simply gone. This is the problem, shown for contrast.
- **A: Quiet pointer** — chat shows minimal one-liners (`→ updated todos · see panel`). Panel is fully canonical. Cleanest live; but the transcript isn't self-contained — on reload you must open the panel to learn anything.
- **B: Rich in chat too** — chat renders compact cards (mini todo list, file chip, Q&A) for every event. Fully self-contained transcript. But it duplicates the panel (two copies to keep in sync) and gets tall on big runs.
- **C: Live-pointer / reload-resolved** — live: quiet pointers (panel is the live canonical view, no noise); on reload: the transcript **resolves** to compact self-contained summaries — answered Q&A renders, files become clickable chips, todos collapse to a final-state note. Panel still owns "current state."

## What to Look For

1. **Live noise:** with the panel open and updating, do B's in-chat cards feel redundant? Does A/C's quiet pointer read better while watching?
2. **Reload completeness:** flip to Reloaded. Does the transcript still tell the whole story — especially *what you answered*? (✕ and A fail this; B and C pass.)
3. **Single source of truth:** the panel header says *canonical · live state*. Confirm the mental model holds: **panel = what's true now; chat = what happened.** C leans on this cleanly; B blurs it (history in both places).
4. **Clickable continuity:** in C-reload, a file chip and "open panel ↗" let you jump from transcript back into the live panel.

## How we'd know this failed (G-6)

- **Raw JSON leak:** a panel-owned tool shows `{"path":"summary.md","content":"..."}` in chat (today's bug).
- **Vanishing history:** user reloads and can't see the question they answered or that a file was written — the conversation has holes.
- **Double-render confusion:** the same todo update appears twice (chat card + panel) and the user wonders if the agent did it twice.
- **Sync drift:** chat's copy of a todo/file disagrees with the panel's (B's risk if they're independently rendered).
- **Tall-transcript fatigue:** a 30-step run buries the actual conversation under stacked tool cards.
