# Pending Question (ask_user) & Resume

`ask_user` is the one tool that **blocks the entire agent loop** — it's literally waiting on the human. Two things to get right: (1) loudness — impossible to miss without being obnoxious on every run; (2) answer-and-resume — pick or type, submit, and watch the agent resume *inside the same panel view* (SC#4) with the chat run-card un-pausing and the composer unlocking.

## Design Decisions

### D1 — Dual-surface, calm-by-default (Winner C)
The real input lives in a **calm pinned card at the top of the panel** (choice chips + always-present free-text). A **pointer cue inside the chat run-card** ("⚠ the agent needs your input → Answer in panel") points to it. Whichever surface your eyes are on — chat or panel — you see it.

- **Won over A (Takeover):** auto-opening the panel and dimming Todos/Files behind a scrim is impossible to miss but heavy-handed; it fires on every trivial confirmation → annoyance fatigue, and blocks glancing at workspace state while you decide.
- **Won over B (Pinned-only/calm):** the pinned card alone is invisible if the panel is closed/collapsed or your eyes are on chat. C adds the chat cue to fix exactly that blind spot. The chat cue is a **pointer**, not a duplicate input.

### D2 — The block is never silent (structural loudness)
A pause is made unmissable by **structure**, not by hijacking the screen:
- the chat **run-card turns amber** (`.run-card.paused`), the bot avatar stops pulsing and goes amber, the timer holds, the last step reads `⏸ ask_user · awaiting your answer →`;
- the **composer locks** (`.composer.locked`, "Agent is paused") — the user can't type a new prompt into a paused loop;
- the panel **toggle shows a pulsing amber dot** when the panel is closed.

This trio guarantees "blocked-on-me" reads differently from "just slow."

### D3 — Always offer free-text; choices are optional
Some `ask_user` calls have no options. The card always renders a free-text field; choice chips render above it only when the call supplies options. Submit is disabled until the user picks a chip or types something. An `ask_user` with zero choices must never leave the user with no way to respond.

### D4 — Resume in place, no navigation
On Send: the card flips green (`.ask.answered`, "Answered · agent resumed"), records the user's answer inline, the run-card un-pauses, the composer unlocks. No page navigation, no refresh — the agent continues in the same view.

### D5 — Graceful timeout, never a silent hang or opaque crash
The backend supports a configurable timeout. On expiry the card goes to a calm `.ask.expired` state with a clear message ("No response within 5:00 — agent stopped"). Not a silent hang, and not an opaque error trace — a readable "I couldn't proceed without your answer."

## CSS Patterns

```css
/* Pinned ask slot — sticks to the top of the panel scroll regardless of section order */
.ask-slot.pinned { position: sticky; top: 0; z-index: 4; }

/* The card — amber = needs you */
.ask { background: var(--color-warning-dim); border: 1px solid var(--color-warning);
       border-radius: var(--radius-md); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
.ask .qlbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--color-warning);
             font-family: var(--font-mono); display: flex; align-items: center; gap: 6px; }
.ask .qlbl .pip   { width: 7px; height: 7px; border-radius: 50%; background: var(--color-warning);
                    animation: dotBounce 1.4s ease-in-out infinite; }
.ask .qlbl .clock { margin-left: auto; color: var(--color-text-dim); }   /* countdown */
.ask .qtext { font-size: var(--text-base); color: var(--color-text); line-height: 1.5; }

/* Choice chips (optional) — stacked, full-width, selectable */
.ask .opts { display: flex; flex-direction: column; gap: 6px; }
.ask .opt  { text-align: left; background: var(--color-surface); border: 1px solid var(--color-border);
             border-radius: var(--radius-sm); padding: 9px 12px; font-size: var(--text-sm); color: var(--color-text); cursor: pointer; }
.ask .opt:hover { border-color: var(--color-warning); background: var(--color-warning-dim); }
.ask .opt.sel   { border-color: var(--color-warning); background: var(--color-warning); color: #06061a; font-weight: 600; }

/* Always-present free-text (D3) */
.ask .or   { font-size: 10px; text-align: center; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.ask .free { display: flex; gap: 6px; }
.ask .free input { flex: 1; background: var(--color-bg); border: 1px solid var(--color-border);
                   border-radius: var(--radius-sm); padding: 8px 10px; color: var(--color-text); font-size: var(--text-sm); }
.ask .free input:focus { outline: none; border-color: var(--color-warning); }
.ask .submit { background: var(--color-warning); color: #06061a; border: none; border-radius: var(--radius-sm);
               padding: 8px 14px; font-weight: 700; font-size: var(--text-sm); cursor: pointer; }
.ask .submit:disabled { opacity: 0.4; cursor: not-allowed; }   /* until pick/type */

/* Answered (D4) — green, records the answer */
.ask.answered { border-color: var(--color-success); background: var(--color-success-dim); }
.ask.answered .qlbl { color: var(--color-success); }
.ask.answered .qlbl .pip { background: var(--color-success); animation: none; }
.answered-row { font-size: var(--text-sm); color: var(--color-text); display: flex; align-items: center; gap: 8px; }
.answered-row .you { color: var(--color-success); font-weight: 600; }

/* Expired (D5) — calm grey, never a crash */
.ask.expired { border-color: var(--color-text-dim); background: var(--color-muted); opacity: 0.85; }
.ask.expired .qlbl { color: var(--color-text-dim); }
.ask.expired .qlbl .pip { background: var(--color-text-dim); animation: none; }

/* Chat-side: paused run-card + locked composer (D2) */
.run-card.paused { border-color: var(--color-warning); box-shadow: 0 0 24px var(--color-warning-dim); }
.run-card.paused .run-head .bot { animation: none; background: var(--color-warning); }
.run-card.paused .run-head .lbl { color: var(--color-warning); }
.composer.locked .box  { opacity: 0.5; }
.composer .hint { margin-left: auto; font-size: 10px; font-family: var(--font-mono); color: var(--color-warning); }
```

## HTML Structure

```html
<!-- Panel: pinned card -->
<div class="ask-slot pinned">
  <div class="ask">
    <div class="qlbl"><span class="pip"></span> Needs you <span class="clock">4:32</span></div>
    <div class="qtext">Which dataset should I use for the Q3 rollup?</div>
    <div class="opts">                       <!-- present only if options supplied -->
      <button class="opt">prod_sales_2026</button>
      <button class="opt">staging_sales</button>
    </div>
    <div class="or">or</div>
    <div class="free"><input placeholder="Type an answer…"><button class="submit" disabled>Send</button></div>
  </div>
</div>

<!-- Chat: pointer cue inside the paused run-card -->
<div class="run-card paused">
  <div class="run-head">…<span class="lbl">paused</span></div>
  <div class="run-step active">⏸ ask_user · awaiting your answer
    <span class="pointer"><span class="arrow">→</span><span class="to-panel">Answer in panel</span></span>
  </div>
</div>

<!-- Composer locked while paused -->
<div class="composer locked"><div class="box">…</div><span class="hint">Agent is paused</span></div>
```

## What to Avoid
- **Silent block** — the agent pauses but nothing visibly changes; the user waits indefinitely thinking it's still working. The amber run-card + locked composer + toggle pulse-dot exist precisely to kill this.
- **Annoyance fatigue** — a takeover firing for trivial confirmations until the user resents the panel. Calm-by-default; loudness is structural, not modal.
- **No-options trap** — an `ask_user` with zero choices and no free-text. Free-text is always present.
- **Dead-end after answer** — user submits and can't tell if it worked. The green answered-state + un-pausing run-card is the confirmation.
- **Timeout-as-crash** — expiry throwing an opaque error instead of the calm `.expired` message.
- **Lost on reload** — refresh mid-question and the prompt/answer is gone. That's the **seam** problem, owned by `chat-panel-seam.md` (the documented `ask_user` reload gap).

## Origin
Synthesized from sketch 006 (winner C — Dual-surface). Source: `sources/006-pending-question/index.html` (Flow strip: Pending → Answered → Timeout). Maps to PANEL-04, TOOL-03 and Phase 087 SC#4. Reload/history of answered Q&A is handled in `chat-panel-seam.md`.
