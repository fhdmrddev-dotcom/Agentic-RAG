# Live-Run Container

The conversation-level frame that wraps every agent execution turn. Synthesized from sketches **001 (stream-framing)** + **003 (thinking-moment)**.

## Design Decisions

### D1 — Live runs occupy the conversation as a bracketed Run-Card

A multi-tool agent turn is wrapped in a single bordered container that lives inline in the conversation stream — not in a dedicated rail, not folded into the assistant message body.

**Why it won (vs. Inline-Folded / Dedicated Rail):**
- Inline-folded mixed live execution with final answer text in one column → conversation became a wall of tool cards on long sessions
- Dedicated rail required two-column page architecture → wrong for chat-primary product
- Run-card preserves the conversation reading flow AND gives the live run an explicit container with identifiable structure

**Key visual properties:**
- Width: matches conversation column (max-width ~780px)
- Background: `linear-gradient(180deg, hsl(220 30% 7% / 0.6), hsl(220 30% 7% / 0.3))` — slightly translucent against page bg
- Border: 1px solid `var(--color-border)` (`hsl(220 20% 16%)`)
- Border-radius: `var(--radius-lg)` (14px) — softer than tool cards inside it
- Active state: border becomes `var(--color-primary-glow)` + `box-shadow: 0 0 24px hsl(239 100% 82% / 0.18)` (the `--shadow-glow-primary` token)

### D2 — Sticky run header carries whole-run trust

A persistent header pins to the top of the run-card with: bot avatar (pulsing while streaming), title, gpt model + turn number subtitle, tool counter chip, and timer. While the run is active, a 2px progress shimmer bar lives directly under the header.

**Why it matters:** At 30+ seconds deep with multiple tool cards on screen, the timer + counter + active avatar are the trust signals. They must be visible without scrolling to the top of the run-card. Sticky positioning solves this — the header rides along.

**Implementation note for React:** position the header `sticky; top: 0` within the run-card scroll container, or use `IntersectionObserver` to clone-and-pin when the original scrolls off.

### D3 — Focus Mode during long runs: past steps fold to result-summary

While a run is in flight, completed tool calls auto-collapse to a one-line summary showing **their result, not their args**:

- `🔍 search_documents · 4 results · 1.2s` → `→ top match: Q3-2026-financials.pdf (0.91)`
- `▶ execute_code · done · 8.4s` → `→ yoy_q3 = 30.87%, yoy_q2 = 21.71%`
- `📄 read_file · done · 0.9s` → `→ monthly breakdown loaded · 3 months`

Only the **active** step keeps its full editor/output open. The full body of completed steps remains accessible via click-to-expand.

**Why it won (vs. Agenda Strip / Minimap Rail):**
- Agenda strip showed all 6 steps as chips, but added 36px of vertical chrome and felt closer to the rejected "newsroom" mood
- Minimap rail (40px vertical rail with status nodes) was elegant but hid information behind hover tooltips
- Focus Mode directly answers the lived-experience UAT-gap: regressions hid in fast streams *because the result wasn't visible* — Focus Mode surfaces every result as the step completes

### D4 — Explicit "Next: ..." footer surfaces forward-look

The run-card body ends with a dashed-border row: `Next: write summary  queued`. This is the only place the user sees what's *about to* happen.

**Why this matters:** combined with D3 (past = summary), D2 (now = timer in header), the Next-footer completes the past/present/future triad. The user can always answer "what just happened, what's happening, what's coming" with three glances.

### D5 — On completion, the run-card folds to a single summary row

Once `status === 'done'`, the run-card collapses to one row: `[bot icon] Run · N tool calls · ✓ done · 14.2s  ▸`. Click to expand the full execution history. Long conversations stay readable; deep audit-trail stays one click away.

### D6 — Narration interleaves with tool calls inside the body

Assistant text between tool invocations (e.g., "Found 4 sources. Let me compute the YoY now.") lives **inside** the run-card body, between the tool cards. Style: italic, color `var(--color-text-muted)`. It supports the structured execution rather than competing with it.

The **final assistant message** (the actual answer the user reads at the end) lives **outside** the run-card, in its own row — same shape as today's assistant message bubble. The run-card is the *work*; the message is the *answer*.

### D7 — Thinking blocks are compact and dim by default

Reasoning/extended-thinking content appears as a single dim italic row at the top of the run-card body:

```
💭  Thinking · planned 6-step approach: search → read sources → compute YoY → chart → summarize     2.1s
```

Click to expand into full thought content. Never auto-expanded.

## CSS Patterns

### Run-card frame

```css
.run-frame {
  background: linear-gradient(180deg, hsl(220 30% 7% / 0.6), hsl(220 30% 7% / 0.3));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);     /* 14px */
  overflow: hidden;
  position: relative;
}
.run-frame.active {
  border-color: var(--color-primary-glow);
  box-shadow: var(--shadow-glow-primary);  /* 0 0 24px hsl(239 100% 82% / 0.18) */
}
```

### Sticky run header

```css
.run-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--color-border);
  background: hsl(220 30% 8% / 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
}
```

### Progress shimmer (active-only)

```css
.run-progress {
  height: 2px;
  background: var(--color-primary-dim);
  position: relative;
  overflow: hidden;
}
.run-progress::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    transparent,
    var(--color-primary-glow),
    hsl(258 90% 66% / 0.5),
    transparent);
  animation: progressShimmer 1.8s ease-in-out infinite;
}

@keyframes progressShimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### Result-summary row (Focus Mode)

```css
.tc-collapsed-summary {
  display: none;
  padding: 6px 12px;
  background: hsl(220 30% 8% / 0.5);
  border-top: 1px solid var(--color-border-soft);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
.tc.done .tc-collapsed-summary { display: block; }
```

### Next-up footer

```css
.next-up {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
.next-up .label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

### Brand pulse (active bot avatar)

```css
@keyframes brandPulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50%      { transform: scale(1.05); opacity: 1; }
}
.avatar.bot.streaming { animation: brandPulse 1.5s ease-in-out infinite; }
```

## HTML Structure

### Active run-card skeleton (Focus Mode composition)

```html
<div class="run-card">
  <div class="run-frame active">

    <!-- Sticky header — pinned during scroll -->
    <div class="run-header">
      <div class="avatar bot streaming">A</div>
      <div>
        <div class="title">Q3 financial review</div>
        <div class="sub">gpt-5.4 · turn 1 · step 5 of 6</div>
      </div>
      <span class="counter">charting Q3 vs Q2</span>
      <span class="timer">33.4s</span>
    </div>
    <div class="run-progress"></div>

    <div class="run-body">

      <!-- Thinking block (dim, collapsed) -->
      <div class="thought">
        <span class="icon-thought">💭</span>
        <span>Thought · planned 6-step approach</span>
        <span class="meta">2.1s</span>
      </div>

      <!-- Past tool — folded to result-summary -->
      <div class="tc done">
        <div class="tc-head"><!-- icon · name · args · pill-done --></div>
        <div class="tc-collapsed-summary">→ yoy_q3 = 30.87%, yoy_q2 = 21.71%</div>
      </div>

      <!-- Inline narration between tools -->
      <div class="narration">Charting Q3 vs Q2 with YoY overlay…</div>

      <!-- Active tool — full editor open -->
      <div class="tc active open">
        <!-- See tool-call-panel.md for inner shape -->
      </div>

      <!-- Explicit next-up -->
      <div class="next-up">
        <span class="label">Next</span>
        <span>write summary</span>
        <span style="margin-left:auto;">queued</span>
      </div>

    </div>
  </div>
</div>
```

### Collapsed run-card (after completion)

```html
<div class="run-card">
  <div class="run-frame">
    <div class="run-collapsed-summary" onclick="...toggle expand...">
      <div class="avatar bot">A</div>
      <span>Run · 4 tool calls · </span>
      <span class="pill done"><span class="dot"></span>done · 14.2s</span>
      <span class="chev">▸</span>
    </div>
  </div>
</div>
```

## What to Avoid

- ❌ **Inline-Folded layout (001-A)** — tool cards interleaved directly inside the assistant turn make long sessions a wall of nested cards. The Run-Card frame is the layer that bears scroll cost.
- ❌ **Dedicated execution rail (001-B)** — adds a right-side column to page architecture. Wrong for chat-primary product and conflicts with existing single-column layout.
- ❌ **Agenda strip (003-A)** — pinned horizontal chip-row of every tool. Felt closest to the rejected "newsroom" mood; adds 36px of always-visible chrome under the header.
- ❌ **Minimap rail (003-C)** — thin vertical step rail inside the run-card. Elegant but hides tool names behind hover tooltips → no orientation without interaction.
- ❌ **Args in the result-summary** — when a tool completes, the summary shows the *result*, not the *args*. (Args are still in the collapsed head row; the summary is for the new information the tool produced.)
- ❌ **Auto-expanded thinking blocks** — they're dim and italic by design; default-collapsed. Expansion is opt-in only.
- ❌ **Final answer inside the run-card** — the run-card holds the *work*; the assistant message bubble holds the *answer*. Don't merge them.

## Origin

Synthesized from sketches:
- `001-stream-framing` (winner: **C — Run-Card**)
- `003-thinking-moment` (winner: **B — Focus Mode**)

Source files: `sources/001-stream-framing/`, `sources/003-thinking-moment/`
