# Sketch Manifest

## Design Direction

**Calm instrument with selective signal-density at the live moment.** The agent feels like a confident specialist — restrained palette (Aether Deep Midnight), purposeful motion (no decorative spin), generous space at rest, and a controlled spike of status / counters / pulses only when work is actively in flight. The chrome stays out of the way until it has something to say.

The acceptance bar for every variant is the **long execution in progress** moment: 30+ seconds into a multi-tool run, can the user instantly read what the agent did, what it's doing, and trust it's still on track? This directly answers the documented UAT-gap pattern (regressions hiding in slow streams).

## Reference Points

| Reference | What we borrow |
|-----------|----------------|
| **Claude.ai analysis tool** | Inline tool-result-in-conversation pattern — the runner appears mid-message with status, output, and re-run controls. |
| **Cursor / Windsurf agent mode** | Multi-step agent loop — collapsible tool calls, status pills, streaming code output. Closest peer product. |
| **Linear (status & motion)** | Calm-but-expressive motion language. Status pills that pulse meaningfully; fades on state transitions. |
| **Raycast (command surfaces)** | Instrument feel — monospace touches, dense-but-quiet, keyboard-forward affordances. |

## Theme

`themes/default.css` — Aether Deep Midnight, sourced from the live `frontend/src/index.css :.dark` tokens so sketches feel like the real product.

## Running Design Decisions

| # | Decision | Source |
|---|----------|--------|
| 1 | **Live run = bracketed run-card** in conversation flow, with status header (timer + counter + bot avatar), progress shimmer while active, fold-to-summary on completion. | Sketch 001 winner C |
| 2 | **Tool call = editor inset.** `execute_code` renders as a real editor pane (gutter, syntax highlight, lang chip) with labeled STDOUT/STDERR regions and file outputs as inline preview cards (chart icon, click-to-open). Non-code tools (search, read_file) get their own inner shape inside the same outer frame. Different tools, same container; honest about each tool's native result type. | Sketch 002 winner C |
| 3 | **Focus Mode under stress.** During a long run: pinned run-card header (timer + counter), past tool calls auto-collapse to compact rows with their *result-summary* (`→ yoy_q3 = 30.87%`), only the active tool keeps its full editor open, explicit "Next: ..." footer surfaces what's queued. Past steps fold to essence, active step gets full attention — directly answers the lived-experience UAT-gap where regressions hid in fast streams. | Sketch 003 winner B |
| 4 | **Panel = push/split, stacked-accordion sections.** The right panel shrinks the chat (no overlay); its 4 areas (Todos / Files / Pending-Q / Versions) stack in one scroll, each collapsible, with a pending `ask_user` question pinned at the very top. When empty (the common case) the panel short-circuits to one calm empty-state and offers "collapse to rail." Collapsing leaves a thin rail with count badges so a pending question never goes silent. Mobile (<768px) = bottom-sheet. Toggle: header button + ⌘./Ctrl+. | Sketch 004 winner B |
| 5 | **File browse = full-replace drill-in; diff = in-column unified.** Tapping a file replaces the panel body with a full-height preview (md → MarkdownRenderer, code → syntax highlight, csv → table, image → framed) + a `‹ Files` back button. Versions compare as a **unified inline diff** (+/− coloring) that stays in-column by default; an opt-in `⤢ expand` button pops only the diff into a wide overlay over the chat for rare gnarly diffs — never auto-widen (would reflow chat). Every file type needs a graceful preview/too-large fallback (no raw byte dumps). | Sketch 005 winner A (C folded in) |
| 6 | **Pending `ask_user` = dual-surface, calm-loud.** Calm pinned card at the top of the panel (choice chips + always-present free-text) **plus** a pointer cue inside the chat run-card. The agent's block is made unmissable structurally — paused amber run-card, **locked composer** ("agent is paused"), pulsing toggle dot — not by hijacking the screen. Submit resumes in place (card → green, run-card un-pauses, composer unlocks). Configurable timeout expires gracefully with a clear message, never a silent hang. | Sketch 006 winner C |

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | stream-framing | What does the live run **occupy** in the conversation stream? | **C — Run-Card** ★ | layout, structure, chat |
| 002 | tool-call-panel | What is the **shape** of a single tool call as it runs and finishes? | **C — Editor Inset** ★ | panel, tool, G-5 |
| 003 | thinking-moment | When the agent is **30+ seconds deep**, how do panels + status + thinking + text compose? | **B — Focus Mode** ★ | synthesis, long-run |
| 004 | panel-shell | How are the 4 panel sections organized + collapse / mobile, without overloading the app? | **B — Stacked accordion** ★ | layout, panel, density |
| 005 | file-and-diff | In a narrow ~30% column, how does browse → preview → version-diff flow? | **A — Full-replace + in-column unified diff** ★ | files, diff, versions |
| 006 | pending-question | When `ask_user` pauses the agent, how loud is the panel + how does answering resume it? | **C — Dual-surface (calm pin + chat cue)** ★ | ask_user, interrupt, pause-resume |
