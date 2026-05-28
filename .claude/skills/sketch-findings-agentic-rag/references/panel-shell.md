# Panel Shell & Navigation

The right-side workspace panel's outer frame: how it shares the screen with chat, how its four sections stack, how it collapses, and how it behaves on mobile. This is the container that sketches 005/006/007 fill.

## Design Decisions

### D1 — Push/split, not overlay (Winner B: Stacked accordion)
The panel **shrinks the chat** (CSS-grid column animation), it never floats over it. Three-column app grid: `52px` left nav · `1fr` chat · `30%` panel. Collapsing animates the panel column to `0`/rail width; the chat reclaims the space. No scrim, no z-index stacking over the conversation — the calm-instrument promise is "the panel is a room you make space for, not a thing that covers your work."

- **Won over A (Tabs):** tabs force one section at a time — you can't watch todos *and* a file write during a live run. The accordion shows everything in one scroll.
- **Won over C (Hybrid rail):** the always-on status strip was glanceable but added permanent chrome; the accordion's collapse-to-rail gives the same glance only when collapsed.

### D2 — Four collapsible sections, pending-Q pins top
Sections in fixed order: **Todos · Files · Pending question · Versions**. Each is a `.sec-head` (click to collapse, chevron rotates) + `.sec-body`. A pending `ask_user` renders as a sticky section pinned at the very top (`position: sticky; top: 0; z-index: 4`) regardless of section order — see `pending-question.md`.

### D3 — Empty is the common case → short-circuit
A plain Q&A chat has no workspace activity. Instead of surrendering 30% width to four empty sections, the whole panel body short-circuits to one calm `.panel-empty` centered state with a "collapse to rail" affordance. **Never render four empty section headers.**

### D4 — Collapse leaves a rail, not nothing
Desktop collapse → a thin `.rail` (vertical icon strip) with **count badges** per section (`Todos 2/3`, `Files 4`), and an amber badge if a question is pending. This is load-bearing: a pending `ask_user` must never go silent just because the panel is collapsed. Full-hide is only for mobile.

### D5 — Mobile (<768px) = bottom-sheet
At phone width the grid collapses to `1fr` and the panel becomes a bottom-sheet (`transform: translateY(100%)` when hidden, slides up when open, with a `.sheet-grip` handle). It must never occlude the composer and must be dismissable back to chat.

### D6 — Toggle = header button + `⌘.` / `Ctrl+.`
Keyboard-forward (Raycast instinct). The toggle control shows a pulsing dot when a question is pending and the panel is closed.

## CSS Patterns

```css
/* Three-column push/split — the whole frame */
.app {
  display: grid;
  grid-template-columns: 52px 1fr var(--panel-w, 30%);
  height: 100vh;
  transition: grid-template-columns var(--dur-slow) var(--ease-out);
}
.app.panel-collapsed { grid-template-columns: 52px 1fr 0; }   /* fully hidden */
.app.panel-rail      { grid-template-columns: 52px 1fr 52px; } /* rail visible */
.app.mobile          { grid-template-columns: 1fr; position: relative; }

.panel { background: var(--color-bg-elev1); border-left: 1px solid var(--color-border);
         display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.app.panel-collapsed .panel { opacity: 0; pointer-events: none; }

/* Section primitive — shared by all four sections */
.sec-head { display: flex; align-items: center; gap: 8px; padding: var(--space-3) var(--space-4);
            font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.07em;
            color: var(--color-text-dim); cursor: pointer; user-select: none; }
.sec-head .chev { transition: transform var(--dur-fast) var(--ease-out); font-size: 10px; }
.sec-head.collapsed .chev { transform: rotate(-90deg); }
.sec-head .count { margin-left: auto; font-family: var(--font-mono); color: var(--color-text-muted); text-transform: none; }
.sec-head .count.warn { color: var(--color-warning); }   /* pending-Q count */
.sec-body { padding: 0 var(--space-3) var(--space-3); display: flex; flex-direction: column; gap: 6px; }
.sec-head.collapsed + .sec-body { display: none; }

/* Collapse-to-rail with count badges (D4) */
.rail { display: none; flex-direction: column; align-items: center; padding: var(--space-3) 0; gap: var(--space-3); }
.app.panel-rail .rail { display: flex; }
.app.panel-rail .panel-inner { display: none; }
.rail .rail-ico { position: relative; width: 30px; height: 30px; border-radius: var(--radius-sm);
                  display: grid; place-items: center; color: var(--color-text-dim); cursor: pointer; }
.rail .rail-ico .badge { position: absolute; top: -2px; right: -2px; min-width: 14px; height: 14px;
                         padding: 0 3px; border-radius: 7px; background: var(--color-primary);
                         color: #06061a; font-size: 9px; font-weight: 700; display: grid;
                         place-items: center; font-family: var(--font-mono); }
.rail .rail-ico .badge.warn { background: var(--color-warning); }   /* pending question */

/* Whole-panel empty short-circuit (D3) */
.panel-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
               gap: var(--space-3); padding: var(--space-6); text-align: center; color: var(--color-text-dim); }
.panel-empty .big { font-size: 26px; opacity: 0.5; }
.panel-empty .hint { font-size: var(--text-xs); line-height: 1.6; max-width: 220px; }

/* Mobile bottom-sheet (D5) */
.app.mobile .panel { position: absolute; left: 0; right: 0; bottom: 0; top: 30%;
                     border-left: none; border-top: 1px solid var(--color-border);
                     border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                     transition: transform var(--dur-slow) var(--ease-out); }
.app.mobile.panel-collapsed .panel, .app.mobile.panel-rail .panel { transform: translateY(100%); }
.app.mobile .sheet-grip { display: block; width: 36px; height: 4px; border-radius: 2px;
                          background: var(--color-text-dim); margin: 8px auto 0; }
```

## HTML Structure

```html
<div class="app panel-collapsed">       <!-- toggle classes: panel-collapsed | panel-rail | (none) -->
  <nav class="leftnav"> … </nav>          <!-- 52px existing -->
  <main class="chat"> … </main>           <!-- 1fr existing chat + run-cards -->
  <aside class="panel">
    <div class="panel-head">
      <span class="ptitle">Workspace</span>
      <button class="pclose">×</button>
    </div>
    <div class="panel-inner">             <!-- hidden in rail mode -->
      <!-- pending-Q pins here first when present -->
      <div class="sec-head"><span class="chev">▾</span> Todos <span class="count">2/3</span></div>
      <div class="sec-body"> … </div>
      <!-- Files, Pending, Versions repeat the sec-head/sec-body pair -->
    </div>
    <div class="rail">                     <!-- shown only in rail mode -->
      <div class="rail-ico">☑<span class="badge">2</span></div>
      <div class="rail-ico">⚠<span class="badge warn">1</span></div>
    </div>
  </aside>
</div>
```

## What to Avoid
- **Two-column overload** — both chat run-card and panel competing as "the live thing." Mitigation: panel-owned tools render as quiet pointers in chat (see `chat-panel-seam.md`), so there's one live canonical surface.
- **Empty-panel tax** — four empty section headers when there's no workspace activity. Always short-circuit to `.panel-empty`.
- **Lost signal on collapse** — a question goes pending while collapsed and nothing signals it. The rail badge (`.warn`) + toggle pulse-dot are mandatory.
- **Laptop squeeze (~1024px)** — at narrow widths the `30%` panel starves the chat run-card so tool output wraps illegibly. Consider clamping `--panel-w` to a `min()` so the chat keeps a readable floor.
- **Mobile occlusion** — the bottom-sheet covering the composer or trapping the user. `top: 30%` leaves chat + composer reachable; grip must dismiss.

## Origin
Synthesized from sketch 004 (winner B — Stacked accordion). Source: `sources/004-panel-shell/index.html` (all three variants — flip the State strip + viewport buttons to re-feel the Live composite acceptance bar). Maps to PANEL-01, PANEL-02 and Phase 087 SC#1.
