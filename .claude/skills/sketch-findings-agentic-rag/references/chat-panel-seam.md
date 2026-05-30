# Chat ↔ Panel Seam

The boundary rule for the three **panel-owned tools** — `write_todos`, `workspace_write`, `ask_user`. Verified in the codebase: chat has 13 tool-body renderers and **none** for these three, so today they fall through to a generic raw-JSON tool row, and an answered `ask_user` vanishes on reload. This is the load-bearing seam that keeps the panel and chat from fighting (and closes a documented bug).

## Design Decisions

### D1 — Mental model: panel = now, chat = happened (Winner C)
- **Panel = what's true now.** On reload it **reconciles to current state** (final todos, current files, only *still-pending* questions). It does **not** replay history.
- **Chat = what happened.** The transcript is the durable record of the run.

This split is the whole design. Every other decision falls out of it.

### D2 — Live: quiet one-line pointers in chat
While a run is in flight and the panel is the live canonical view, the three panel-owned tools render in chat as **quiet one-line pointers** (`→ updated todos · see panel`, `→ wrote summary.md · see panel`) — not full cards. The panel is already showing the rich live state; duplicating it in chat is noise. Reinforced by operator feedback that the existing chat tool cards are already over-dense.

- **Won over A (Quiet pointer everywhere):** pointers alone are cleanest live, but on reload the transcript isn't self-contained — you'd have to open the panel to learn anything, and the panel no longer holds history.
- **Won over B (Rich cards in chat too):** full cards in chat duplicate the panel (two copies to keep in sync → drift risk) and make a 30-step run's transcript tower over the actual conversation.

### D3 — Reload: transcript resolves to self-contained cards
On thread reload the same three tools **resolve** in chat to compact, self-contained summaries (because the panel won't replay them):
- `ask_user` → an answered **Q&A card** (`.qa`: the question + *what you answered*). **This closes the documented reload gap** — the `tool_calls[].kind='ask_user_*'` renderer that STATE.md flagged as missing.
- `workspace_write` → a clickable **file chip** (jumps back into the live panel preview).
- `write_todos` → a collapsed **final-state note** (e.g. "3 todos · all done").

So the conversation has no holes after refresh, while the panel stays lean (current-state only).

### D4 — Single source of truth, clickable continuity
The panel header reads *canonical · live state*. On a resolved card, a file chip and "open panel ↗" let the user jump from transcript back into the live panel. The transcript records; the panel reflects.

## CSS Patterns

```css
/* Live: quiet pointer in chat (D2) */
.pointer { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-mono);
           font-size: var(--text-xs); color: var(--color-text-muted); padding: 5px 0; }
.pointer .arrow    { color: var(--color-primary); }
.pointer .to-panel { color: var(--color-primary); cursor: pointer; border-bottom: 1px dashed var(--color-primary-glow); }
.pointer .to-panel:hover { color: var(--color-text); }

/* Reload: self-contained resolved card (D3) */
.seam-card { border: 1px solid var(--color-border); background: var(--color-surface);
             border-radius: var(--radius-md); overflow: hidden; }
.seam-card .sc-head { display: flex; align-items: center; gap: 7px; padding: 7px 11px; font-family: var(--font-mono);
                      font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-dim);
                      border-bottom: 1px solid var(--color-border-soft); }
.seam-card .sc-head .see  { margin-left: auto; color: var(--color-primary); cursor: pointer; text-transform: none; }
.seam-card .sc-body { padding: 8px 11px; display: flex; flex-direction: column; gap: 4px; }

/* Resolved ask_user Q&A — closes the reload gap (D3) */
.qa { font-size: var(--text-sm); }
.qa .q { color: var(--color-text-muted); margin-bottom: 3px; }
.qa .a { color: var(--color-success); }
.qa .a b { font-weight: 600; }
```

## HTML Structure

```html
<!-- LIVE (mid-run): quiet pointer, panel is canonical -->
<div class="pointer"><span class="arrow">→</span> updated todos
  <span class="to-panel">see panel</span></div>
<div class="pointer"><span class="arrow">→</span> wrote summary.md
  <span class="to-panel">see panel</span></div>

<!-- RELOADED: self-contained resolved cards -->
<div class="seam-card">
  <div class="sc-head">ask_user <span class="see">open panel ↗</span></div>
  <div class="sc-body">
    <div class="qa"><div class="q">Which dataset for the Q3 rollup?</div>
                    <div class="a">You answered <b>prod_sales_2026</b></div></div>
  </div>
</div>
<div class="seam-card">
  <div class="sc-head">workspace_write <span class="see">open panel ↗</span></div>
  <div class="sc-body"><span class="filechip">📄 summary.md · v3</span></div>
</div>
<div class="seam-card">
  <div class="sc-head">write_todos</div>
  <div class="sc-body"><span>☑ 3 todos · all done</span></div>
</div>
```

## Implementation Notes
- These three tools need a **mode-aware renderer**: `live` → `.pointer`, `reloaded` → `.seam-card`. The mode is "is this event from the currently-streaming run, or rehydrated from history?"
- The wire model likely needs widening so `tool_calls[].kind` carries enough to render the resolved card (the answered value for `ask_user`, the path/version for `workspace_write`, final counts for `write_todos`). STATE.md's Phase 086 note flags that the snapshot/messages endpoints filter `role='system'` rows — the resolved-history path must source the answered Q&A without re-introducing the 500 those filters prevent.
- Keep this OFF the G-5 hot files where possible — the seam is new rendering, not a re-touch of `MessageItem`/`ToolCallPanel` internals. Per BUG-260529-02 routing, the broader chat-tool-card unification is a *separate* phase; here only add the three missing renderers.

## What to Avoid
- **Raw JSON leak** — `{"path":"summary.md","content":"…"}` showing in chat (today's fallback bug). Any panel-owned tool must hit a real renderer.
- **Vanishing history** — reload and the answered question / written file is simply gone. The resolved cards (D3) are the fix; the panel deliberately won't cover this.
- **Double-render confusion** — the same todo update appearing as a full chat card *and* in the panel, so the user wonders if it ran twice. Live = pointer only.
- **Sync drift** — chat's copy of a todo/file disagreeing with the panel's (variant B's risk). Single source of truth: live state lives in the panel, history in the transcript — never the same data rendered richly in both at once.
- **Tall-transcript fatigue** — a 30-step run burying the conversation under stacked cards. Pointers stay one line; resolved cards are compact.

## Origin
Synthesized from sketch 007 (winner C — Live-pointer / reload-resolved). Source: `sources/007-chat-panel-seam/index.html` (toggle Live vs Reloaded across the 4 tabs; start at "✕ Today" to see the broken raw-JSON baseline). Closes the `ask_user` reload gap documented in STATE.md. Load-bearing for Phase 087 and the Phase 088 E2E reload flow.
