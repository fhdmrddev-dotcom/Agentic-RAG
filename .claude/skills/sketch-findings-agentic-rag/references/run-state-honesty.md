# Run-State & Lifecycle Honesty (Phase 174)

Every run's lifecycle — **preparing → streaming → stopped / cancelled / blocked / failed**, and navigating away-and-back — reflected honestly in chat, so a user is never left staring at an empty bubble, a lost stop indicator, a hidden model, or a glitched timer/avatar. The governing rule: **honesty is derived from durable state (persisted `runs.status` / the run's `started_at`), rendered in the calmest surface that can carry it, with loudness earned by severity.** A render layer over state + wire events the backend already emits — Deep byte-identical (D-14), no new persistence. G-5 hot files: `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` / `threads.py`.

## Design Decisions

### D1 — Terminal states = a tiered vocabulary keyed off persisted `runs.status` (129 winner C)
A run that ends in something other than a clean answer reads as one of three tiers, loudness earned by severity:

| Tier | State | Trigger | Treatment |
|---|---|---|---|
| **Dim** (quiet) | Stopped (with partial) · Cancelled — no output yet | user stopped it · `runs.status='cancelled'` | thin dim mono inline line / a quiet dashed body — the user did it on purpose, so it's calm |
| **Amber** | Blocked — disabled by the administrator | kill-switch 403, no run persisted | a framed amber notice — not an error, but important |
| **Red** | Failed — `<reason>` | `runs.status='failed'` + `error` | a framed red notice with reason + provenance — the loudest, because a genuine failure earned it |

The tier ladder **is** the operator's "quiet & calm, red for real failure" direction made literal. Every marker is derived from persisted state, so it **survives nav + reload** (STATE-02) — no live-only badge.

- **Won over A (all-quiet inline everywhere):** lightest, but a genuine failure doesn't read loud enough.
- **Won over B (all-framed notice everywhere):** consistent + scannable, but framing the common deliberate Stopped adds chrome to a calm transcript.

### D2 — "Cancelled — no output yet" replaces the empty bubble (129, STATE-01)
Cancel-before-first-token persists `content_len=0`. Instead of an empty avatar-only bubble (reads as broken), render a quiet dashed body: `⊘ Cancelled — no output yet` + a sub-line ("stopped at 7s, before the model's first visible token"). The empty bubble is the bug; the honest empty-state is the fix.

### D3 — The refusal bubble carries the honest reason (129, STATE-01)
A kill-switch 403 (no run persisted) renders an **amber framed notice** — "Blocked — workflows are disabled by the administrator. Nothing ran." — not a workflow title with a blank body. In `StreamsProvider.sendMessage`'s catch, replace the empty assistant placeholder with the `ApiError.message`.

### D4 — Pre-answer state shows real activity (130 winner C, STATE-03)
The dead "Setting up agent…" (which ignores `reasoning_delta` / `tool_args_progress`) is replaced by an **honest live sub-state** naming what the model is actually doing: `💭 Reasoning… · 4,182 reasoning tokens` → `⚙️ Writing execute_code… · composing the script` → `▲ Spinning up sandbox… · building container`. The fix is counting reasoning/args events as activity (the `toolMeta.ts:73` label), not new backend work.

### D5 — The run-card HEADER carries the sub-state + the anchored timer + one avatar (130 winner C, STATE-03+04 unified)
No separate banner — the shipped run-card header (live-run-container D2 + Sketch-015 never-vanishes strip) gains a live **activity pill** + a timer **anchored to `started_at`** + a single avatar. This fixes STATE-03 (activity) AND STATE-04 (nav-back timer-reset + duplicate avatar) in ONE instrument.

- **Won over A (standalone activity line):** the minimal in-place `toolMeta.ts` label fix — calmest, but doesn't also solve the timer/avatar.
- **Won over B (prep stepper Queued→Reasoning→Writing→Running):** shows the pipeline shape, but over-explains an often-2-second gap.

### D6 — Timer anchored to `started_at`, single avatar (130, STATE-04)
The elapsed timer seeds from the run row's `started_at`/`created_at`, **never component mount** — so a nav-back into a 5-minute run reads 5 minutes, not "28s" (the same fix Phase 095.1 applied to Deep run cards, extended to the workflow/harness strip). The duplicate empty avatar is resolved at the StreamsProvider/MessageList double-mount (mount + first-SSE race).

## CSS Patterns

```css
/* D1 · tier 1 — DIM inline marker (user stopped on purpose) */
.term-inline { display:inline-flex; align-items:center; gap:8px; margin-top:10px;
  font-family:var(--font-mono); font-size:var(--text-xs); color:var(--color-text-dim); }
.term-inline .gl { color:var(--color-text-muted); font-size:13px; }   /* ⊘ glyph */

/* D2 · the "cancelled — no output yet" body (replaces the empty bubble) */
.term-body { display:flex; flex-direction:column; gap:3px; padding:10px 12px;
  border-radius:var(--radius-md); background:hsl(220 30% 9% / 0.5);
  border:1px dashed var(--color-border); font-family:var(--font-mono);
  font-size:var(--text-sm); color:var(--color-text-muted); }

/* D1/D3 · tier 2/3 — framed notice, amber (blocked) / red (failed) */
.term-notice { display:flex; gap:10px; padding:11px 13px; border-radius:var(--radius-md);
  border:1px solid; align-items:flex-start; }
.term-notice.amber { background:var(--color-warning-dim); border-color:hsl(38 92% 60% / .4); }
.term-notice.red   { background:var(--color-danger-dim);  border-color:hsl(0 72% 51% / .42); }
.term-notice .nt-where { display:block; margin-top:5px; font-family:var(--font-mono);
  font-size:10.5px; color:var(--color-text-dim); }   /* the provenance line */

/* D5 · run-header live activity pill (STATE-03 in the header) */
.hdr-activity { margin-left:auto; display:flex; align-items:center; gap:8px; padding:4px 10px;
  border-radius:var(--radius-full); background:var(--color-primary-dim);
  border:1px solid var(--color-primary-glow); }
.timer.anchored { color:var(--color-primary); font-family:var(--font-mono); }
```

```js
// D6 · the anchored run clock — elapsed derives from started_at, NEVER mount
const startedAt = runRow.started_at;                 // authoritative, survives nav
el.textContent = fmtElapsed(Date.now() - startedAt); // not (now - mountTime)
// the bug being fixed: a remount on nav seeds elapsed from mountTime → timer resets
```

## HTML Structure

```html
<!-- D1/D2 · dim tier — stopped-with-content (marker) + cancelled-no-output (body) -->
<div class="term-inline" title="runs.status = 'cancelled'">
  <span class="gl">⊘</span> Response stopped <span class="meta">· 1,606 chars · 12s</span></div>

<div class="term-body" title="runs.status='cancelled' · content_len=0">
  <span class="lead"><span class="gl">⊘</span> Cancelled — no output yet</span>
  <span class="sub">stopped at 7s, before the model's first visible token</span></div>

<!-- D3 · amber refusal · D1 · red failure -->
<div class="term-notice amber"><span class="ico">⊘</span><div class="nt-body">
  <div class="nt-title">Blocked — workflows are disabled by the administrator</div>
  <div class="nt-reason">Nothing ran. <span class="nt-where">403 · workflows kill-switch</span></div>
</div></div>

<!-- D5 · run-header carries the live sub-state + anchored timer + ONE avatar -->
<div class="run-header">
  <div class="avatar bot streaming">◆</div>
  <div class="rh-meta"><div class="rh-title">Sorting-algorithm benchmark</div>
    <div class="rh-sub">kimi-k2.6 · turn 1</div></div>
  <span class="hdr-activity"><span class="pulse-dot"></span>💭
    <span class="act-label">Reasoning…</span>
    <span class="act-detail">· 4,182 reasoning tokens</span></span>
  <span class="timer anchored">41s</span>   <!-- from started_at, not mount -->
</div>
```

## What to Avoid

- **An empty avatar-only bubble on early cancel** — render "Cancelled — no output yet" (D2). The empty bubble is the bug.
- **A workflow title with a blank body on refusal** — render the honest kill-switch reason bubble (D3).
- **A live-only "stopped" badge** — derive it from persisted `runs.status` so it survives reload (D1, STATE-02).
- **"Setting up agent…" while the model streams reasoning** — count `reasoning_delta`/`tool_args_progress` as activity (D4).
- **Seeding the elapsed timer from component mount** — anchor to `started_at`, or nav-back resets a long run to seconds (D6).
- **A duplicate empty avatar** — resolve the mount + first-SSE double-mount; one avatar (D6).
- **Framing the quiet deliverate Stopped as loud as a failure** — dim → amber → red, loudness earned by severity (D1).
- **Forking the shared Deep/agent-loop path** — these are render-layer reads over state + wire events already emitted; Deep byte-identical (D-14).

## Origin

Synthesized from sketches **129-terminal-run-states** (winner C — tiered dim/amber/red keyed off `runs.status`) and **130-live-preparing-honesty** (winner C — run-header carries the live sub-state + anchored timer + single avatar). Source files: `sources/129-terminal-run-states/`, `sources/130-live-preparing-honesty/`. Session 2026-07-22 (Phase 174, STATE-01..04 — first sketch of v3.5). Folds 5 reported bugs: `cancelled-run-empty-bubble-early-cancel`, `killed-workflow-empty-chat-card`, `cancelled-run-stop-indicator-lost-on-navigation`, `setting-up-agent-hides-model-activity`, `BUG-260610-01`. Builds on `references/live-run-container.md` (run-card + sticky header), `references/run-honesty.md` (fail-taxonomy + quiet chat pointers), and `references/chat-tool-card-unification.md` (Sketch-015 never-vanishes status strip). Real behavior: `runs.status` authoritative (FND-01 / Phase 145); the pre-answer sub-states come from `reasoning_delta` / `tool_args_progress` / `tool_start` on `run:{run_id}` (the fix counts them as activity). Both sketches carried a "Today (broken)" toggle reproducing the real bug + a Reload/Nav sim proving the persisted-state fix.
