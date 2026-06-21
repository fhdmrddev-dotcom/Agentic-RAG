# Workflow Run Surface

How a published workflow RUNS inside a normal Deep thread — a bounded **episode**, never a page. The thread is conversational *before* and *after*, instrumented *during*. The whole sketch answers two questions the audit forced apart: **(1) where the meaningful run lives + how it stays consistent with the shipped surfaces — SETTLED** (the panel owns the live spine, the chat is a thin receipt), and **(2) can you chat while it runs — the genuinely-undecided design call** (locked-in-thread A wins). This re-architecture exists because the original sketch 022 drew the full 6-phase timeline INSIDE chat and FAKED per-phase meaning the wire never carries; the `022-RUN-SURFACE-AUDIT.md` graded it PARTIAL-ALIGN → REVISE, and this rebuild moves the spine home, makes the chat thin, and flags every fabricated field as NET-NEW wire. Concrete storyboard throughout: the published **Vendor-risk portfolio review** (`load → research → score → draft → confirm → emit`), domain-agnostic — vendor risk is example content.

## Design Decisions

### D1 — The PANEL owns the live meaningful phase spine; the chat is a thin run receipt (not a second timeline)
This is the single load-bearing decision and it is **settled, not a fresh call** — it honors the signed-off 008-D / 009-C seam ("panel = what's true now, chat = what happened"). The full 6-phase `<ol>` spine (008-D `PhaseTimeline` of `PhaseCard` rows) renders in the `WorkspacePanel` "Workflow" section, gated on `isHarness`, and **stays VISIBLE during the run**. The chat carries only a compact `.receipt-bracket`: a mode badge + the 015-C never-vanishes `.status-strip` that **points at the panel while live** ("Open spine in panel ▸") and **resolves into the deliverable receipt** at a true terminal.

- **Why it won the audit's verdict:** drawing the spine in chat creates a *third run-frame* on the hottest surface — alongside the chat `RunCard` rail and the panel `PhaseTimeline` — which is exactly the "eyes bounce, nothing is clearly the live thing" **dual-surface bounce** sketch 004 warns against. One live home for the eyes.
- The chat receipt is a **3-second read**: `▶ Vendor-risk portfolio review` + `Harness · Strict` badge + the one-line status strip + a footer pointing home. Never a 6-row spine.

### D2 — A MEANINGFUL step = human title + ordinal·type + a RUNNING-phase-only honest activity line + a gate chip when a validator exists
The `PhaseCard` is **calm at rest, comprehensive on the active step** — depth only where the live moment needs it. Four honest layers, each from a REAL field:
- **LINE 1 (always):** the human **title** (`phase.name`, NET-NEW) + the status atom (glyph + pill + color — never color alone; reuses `PhaseCard`'s six type glyphs/labels + 5 statuses).
- **LINE 2 (always):** `Phase i of N · {PHASE_TYPE_LABEL}` with the `slug` demoted to mono secondary (real-now field, calm).
- **LINE 3 (RUNNING phase ONLY):** ONE honest activity line — `Searching <b>Procurement KB</b> for "Q3 breach thresholds"` / `Filling <b>committee_brief.docx</b>` / `<b>14 agents</b> scoring vendors` / `Waiting for your answer`. Idle/done phases stay **quiet** — no activity line, no fabricated counts.
- **GATE chip:** only when the phase carries a `PhaseSpec.validator` (`⛨ freshness ≤ 90d`, `⛨ cited · structure`) — honest authored data, never a fabricated count.
- **Simplicity guard:** default row = title + type + status. Fan-out depth lives in a `Sub-results` expander (`3 of 14 scored`), NOT inlined into the spine — the opposite of the rejected "every phase shows a count" density that fights the calm bar.

### D3 — The chat receipt is a three-way terminal (run honesty), resolving the live strip
The `.receipt-bracket` resolves to one of three honest terminals (driven by the resolve toggle in the sketch):
- **completed** → a `.deliverable` card: `◆ committee_brief.docx · 14 vendors · every figure cited · saved to FILES` + `Open in FILES ▸`; green left-border (`is-done`).
- **failed-honestly** → NO deliverable + the verbatim gate reason (`the cited-output gate found uncited figures → the .docx was NOT written. Nothing partial saved.`); red left-border (`is-failed`). The panel adds an RC-4 `.fail-reason` block with the fix path (add the SOC-2 source or set `citation_policy` to `flag`, then re-run).
- **cancelled** → neutral `⏹ Run cancelled — no deliverable produced · partial work discarded`; amber left-border (`is-cancelled`).

The elapsed timer in the strip is seeded from a **stable start-ts and freezes only on a true terminal** (015-C) — never resets on nav (that reset is the separate `BUG-260610-01` render bug).

### D4 — Composer A (locked-in-thread) wins; the run owns the composer, not you
This is the genuinely-undecided call the sketch centers on. **A · Locked-in-thread ★** is the operator-decided winner: during the run the composer locks to a status `.runchip` (`◆ Vendor-risk portfolio review · phase 3/6 · spine is live in the panel →` + `⏹ Cancel`); the **only** mid-run input is the scoped `ask_user`/`llm_human_input` pause reply (006-C dual-surface). On resolve it **unlocks to normal Deep chat** (follow-ups, "summarize the top 3 risks", "tweak → new version" which forks a new immutable workflow version). Composer mode is a **server fact** (`active_workflow_run_id`), never a client `workflowMode` useState.

- The scoped-reply composer at a pause narrows to `Scoped reply — this answers the run's question, not a new chat`: a free-text input (`escalate both`) + Proceed/Abort mini-buttons. The 006-C question card itself lives in the panel spine; the chat receipt + composer point home.
- **The parallel-thread escape hatch** keeps "locked" from feeling trapped: an `escape-hint` (`You're not blocked — open a new thread to chat freely while this runs`) + a second-thread dot on the nav rail (`running-mark` pulse on the running thread). The run owns *this* composer, not *you*.

### D5 — Honesty: every NET-NEW wire field is flagged in-surface; a collapsible legend draws the real-now line
The sketch is an honest **target-state with its deltas marked**, never a fake. Inline `NET-NEW` pills (`.nn`, focusable for keyboard/touch, not hover-only) mark each fabricated field where it appears, and an always-available collapsible **Honesty** legend in the panel draws the line:

| Field | Status | Note |
|---|---|---|
| phase `slug`, per-phase `status` | **REAL today** | already on the wire / DB |
| `phase_type` (live) | **REAL today** | carried on `phase_started` |
| `llm_human_input` ask pause | **REAL today** | the 006-C scoped pause |
| `PhaseSpec.validators` (gate chips) | **REAL today** | authored constraint, rendered as a chip |
| **`phase.name`** (human title) | **NET-NEW wire** | a natural Phase-103 NL-authoring output; threaded `PhaseSpec → workflow_phases → WorkflowPhaseState → Phase` TS type, emitted on `phase_started` |
| **persisted `phase_type`** | **NET-NEW wire** | land it durably on `WorkflowPhaseState` so a reload doesn't collapse every row to "Step" |
| **running-phase activity line** | **NET-NEW wire** | relaxes D-03 for the ACTIVE phase only (operator-approved); built from REAL `tool_call` args / `sub_agent_start.description` |
| **`llm_emit` TYPE-LABEL** (`Deliverable`/◆) | **NET-NEW frontend** | the enum IS real (`harness.py LlmEmitPhaseConfig`, the 6th discriminated member) but it has NO entry in the shipped `PHASE_TYPE_LABEL` (5 keys) → renders as `Step`/• today. `Deliverable`/◆ is a PROPOSED 6th map entry, not a byte-for-byte reuse |

### D6 — Three routed render/persistence bugs make TODAY'S surface meaningful with NO new UI
Separate from the sketch's net-new wire, three sketch-independent bug/wire fixes recover meaning the app already emits but drops. Do these as wire fixes, **NOT inside the sketch**:
- **`BUG-260609-04`** (phase-0 clobber) — `reconcilePhases` seeds the live skeleton with synthetic `slug: phase-${i}` + `phaseType:"unknown"`; if reconcile fires *after* `phase_started` it overwrites the real-slug row → "Step phase-0" sticks while the DB slug is e.g. `readonly_probe`. Fix: use real `wf.phases` slugs for the LIVE skeleton; refuse to overwrite a real slug with `phase-${i}` (`StreamsProvider.tsx`).
- **`BUG-260609-02`** (Sub-task desc loss on nav) — live `sub_agent_start` carries a rich task description, but `tasksByThread` isn't reconciled from a durable source so `BatchResultList.cleanDescription()` falls back to the literal `"Sub-task"` on nav. Fix: reconcile `tasksByThread` durably.
- **`BUG-260610-01`** (dup-avatar / timer-reset) — keep this a SEPARATE render-only workstream; seed the timer from the run row's `started_at`. NOT a phase-label defect — do not conflate with the label fix.

The diagnosis: meaningful steps are ~90% RENDER + one real DATA-PERSISTENCE hole (durable `phase_type`), NOT "the meaning doesn't exist." Authored slugs (`research / summarize / draft / confirm / finalize`) are already meaningful verbs, and live `phase_started` + `sub_agent_start` carry the real signal — three defects drop or generic-ize it.

### Key visual properties (from the winning variant A)
- **Shell:** `grid-template-columns: 52px 1fr clamp(330px, 34%, 440px)` (nav rail | chat | clamped panel) — mirrors `ChatLayout`. Panel collapses to a 52px `.panel-rail` stub via `⌘.`/`Ctrl+.`, keeping a live `2/6` count badge.
- **Panel bg:** `hsl(220 40% 8%)` — node "stations" hardcode this same value so they opaquely mask the spine connector.
- **Spine fill encodes state:** connector drawn *behind* nodes — green solid (`done`), amber→border gradient (`run`), dashed-dim (`lock`), red (`fail`), amber (`pause`).
- **Mode color:** Harness = warning/amber (`--color-warning`, badge `hsl(38 92% 60% / .18)` bg + `.35` border); Deep = primary/violet. Done resolves to success/green.
- **Receipt left-border:** `3px solid` success/danger/warning at terminal; `--radius-md` card, `--space-3` padding.
- **NET-NEW pill:** `8.5px` mono, warning ink on `hsl(38 92% 60% / .14)`, `tabindex="0"` + visible focus ring (the "why" tier is reachable without hover).
- **Typography:** titles `--font-headline` 600; ordinal/type/slug `--font-mono` (10px / 9px); activity line `--text-xs`.

## CSS Patterns

All snippets are the real winning-variant-A rules from `index.html`. Tokens come from `../themes/default.css` (Deep Midnight). The 008-D spine + status-atom CSS is shared with [harness-phase-timeline.md](harness-phase-timeline.md) — see there for `.tlD`/`.nodeD`/`.st-*`; below are the rules UNIQUE to the run-surface (the thin chat receipt, the meaningful PhaseCard layers, the locked/scoped composer).

```css
/* D1/D3 — THE THIN CHAT RECEIPT: a bracket, not a timeline. Mode badge + 015-C status
   strip pointing at the panel while live; resolves to a deliverable/failure/cancel card. */
.receipt-bracket { border-radius: var(--radius-md); border: 1px solid var(--color-warning);
  background: var(--color-warning-dim); padding: var(--space-3); display: flex; flex-direction: column;
  gap: var(--space-2); max-width: 94%; cursor: pointer; }
.receipt-bracket.is-done      { border-color: hsl(142 71% 45% / .55); background: var(--color-surface); border-left: 3px solid var(--color-success); }
.receipt-bracket.is-failed    { border-color: hsl(0 72% 51% / .5);   background: var(--color-surface); border-left: 3px solid var(--color-danger); }
.receipt-bracket.is-cancelled { border-color: hsl(38 92% 60% / .5);  background: var(--color-surface); border-left: 3px solid var(--color-warning); }
.receipt-bracket.is-paused    { border-color: var(--color-warning); }
.rb-name { font-family: var(--font-headline); font-weight: 600; font-size: var(--text-sm); color: var(--color-text); }
.rb-open { margin-left: auto; font-size: var(--text-xs); color: var(--color-primary); white-space: nowrap; }

/* the NEVER-VANISHES status strip (015-C) — ONE honest line, elapsed from a stable start-ts,
   freezes only on a true terminal. Carries ⏱ time · status · phase i/N · <activity>. */
.status-strip { display: inline-flex; align-items: center; font-family: var(--font-mono);
  font-size: var(--text-xs); background: hsl(220 30% 11% / .85); border: 1px solid var(--color-border);
  border-radius: var(--radius-full); padding: 4px; color: var(--color-text-muted); white-space: nowrap;
  max-width: 100%; overflow: hidden; }
.status-strip .seg.time { color: var(--color-text); flex: none; } .status-strip .seg.time::before { content: '⏱'; }
.status-strip .seg.act { color: var(--color-warning); overflow: hidden; text-overflow: ellipsis; }
.status-strip .seg.act .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor;
  animation: dotBounce 1.4s ease-in-out infinite; flex: none; }
.status-strip.done     { color: var(--color-success); border-color: hsl(142 71% 45% / .35); }
.status-strip.failed   { color: var(--color-danger);  border-color: hsl(0 72% 51% / .35); }
.status-strip.cancelled,.status-strip.paused { color: var(--color-warning); border-color: hsl(38 92% 60% / .4); }
.status-strip.done .seg.act .dot, .status-strip.paused .seg.act .dot { animation: none; } /* frozen at terminal/pause */
```

```css
/* D2 — the MEANINGFUL PhaseCard: calm at rest, comprehensive on the active step.
   LINE 1 title+status / LINE 2 ordinal·type·slug / LINE 3 running-only activity / gate chip when present. */
.pcard { border-radius: var(--radius-md); border: 1px solid transparent; padding: 6px 9px; transition: all var(--dur-fast); }
.pcard.run   { background: var(--color-warning-dim); border-color: hsl(38 92% 60% / .35); }
.pcard.pause { background: var(--color-warning-dim); border: 1px solid var(--color-warning); }
.pcard.fail  { background: var(--color-danger-dim);  border-color: hsl(0 72% 51% / .4); }
.pcard.lock  { opacity: .72; }                                   /* idle/locked stays quiet */
.pc-l1 { display: flex; align-items: center; gap: var(--space-2); }        /* LINE 1 — human title */
.pc-title { font-weight: 600; font-size: var(--text-sm); color: var(--color-text); }
.pcard.lock .pc-title { color: var(--color-text-dim); font-weight: 500; }
.pc-l2 { display: flex; align-items: center; gap: 6px; margin-top: 3px; padding-left: 24px;          /* LINE 2 */
  font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); }
.pc-l3 { display: flex; align-items: center; gap: 6px; margin-top: 5px; padding-left: 24px;          /* LINE 3 — RUNNING ONLY */
  font-size: var(--text-xs); color: var(--color-warning); }
.pc-l3 .act-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--color-warning);
  animation: dotBounce 1.4s infinite; flex: none; }
.pc-l3 .act-text b { color: var(--color-warning); font-weight: 600; }     /* the <b>folder</b>/<b>file</b> object */
.pc-slug { font-family: var(--font-mono); font-size: 9px; color: var(--color-text-dim); }  /* slug DEMOTED */
/* GATE chip — only when the phase carries a PhaseSpec.validator (honest authored data) */
.gate-chip { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; margin-left: 24px;
  font-family: var(--font-mono); font-size: 9px; color: var(--color-accent-violet);
  border: 1px solid hsl(258 90% 66% / .4); padding: 1px 6px; border-radius: var(--radius-sm);
  background: hsl(258 90% 66% / .08); }
```

```css
/* D5 — the NET-NEW flag pill: marks a fabricated/proposed-wire field everywhere it appears.
   focusable (NOT hover-only) so the "why" reason is reachable by keyboard/touch with a visible ring. */
.nn { font-family: var(--font-mono); font-size: 8.5px; font-weight: 700; color: var(--color-warning);
  background: hsl(38 92% 60% / .14); border: 1px solid hsl(38 92% 60% / .3); border-radius: var(--radius-sm);
  padding: 0 4px; vertical-align: 1px; cursor: help; }
.nn:focus-visible, .gate-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; border-radius: var(--radius-sm); }
```

```css
/* D4 — the LOCKED composer (variant A): a status chip + Cancel; the textarea is disabled mid-run. */
.runchip { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-2); border-radius: var(--radius-md); background: var(--color-warning-dim);
  border: 1px solid hsl(38 92% 60% / .35); font-size: var(--text-sm); }
.runchip .rc-ico { color: var(--color-warning); animation: brandPulse 1.5s infinite; }
.runchip .cancel { font-size: var(--text-xs); color: var(--color-danger); cursor: pointer; padding: 4px 9px;
  border-radius: var(--radius-sm); border: 1px solid hsl(0 72% 51% / .35); }
.ta-wrap.disabled { opacity: .55; }

/* the SCOPED-reply composer (at a pause) — accepts ONLY the answer to the run's question (006-C). */
.scoped-wrap { border: 1px solid var(--color-warning); border-radius: var(--radius-lg); background: var(--color-surface); padding: var(--space-3); }
.scoped-wrap .scope-label { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase;
  letter-spacing: .05em; color: var(--color-warning); margin-bottom: 6px; }
.scoped-wrap .scope-row .send { background: var(--color-warning); color: var(--on-bright-ink); border: none;
  border-radius: var(--radius-sm); padding: 8px 14px; font-weight: 700; }
.scoped-wrap .scope-mini button.proceed { color: var(--color-success); border-color: hsl(142 71% 45% / .4); }
.scoped-wrap .scope-mini button.abort   { color: var(--color-danger);  border-color: hsl(0 72% 51% / .4); }

/* the parallel-thread escape hatch (variant A) — "you're not blocked" */
.escape-hint { display: flex; align-items: center; gap: 7px; font-size: var(--text-xs); color: var(--color-text-dim); margin-top: var(--space-2); padding: 6px var(--space-2); }
.escape-hint .eh-link { color: var(--color-primary); cursor: pointer; text-decoration: underline; text-decoration-style: dotted; }
```

## HTML Structures

```html
<!-- D1/D3 — THE THIN CHAT RECEIPT (live): mode badge + name + status strip + a panel pointer.
     This is ALL the chat shows of the run while live — never an embedded 6-row spine. -->
<div class="receipt-bracket" onclick="flashPanel()">
  <div class="rb-line">
    <span class="mode-badge">Harness · Strict</span>
    <span class="rb-name">▶ Vendor-risk portfolio review</span>
    <span class="rb-open" onclick="flashPanel()">Open spine in panel ▸</span>
  </div>
  <span class="status-strip">
    <span class="seg time">01:18</span><span class="divider"></span>
    <span class="seg act"><span class="dot"></span>phase 3/6 · 14 agents scoring vendors</span>
  </span>
  <div style="font-size:11px;color:var(--color-text-dim)">The live 6-phase spine + each step's
    meaning lives in the <b style="color:var(--color-primary)">Workspace panel →</b> — this chat keeps
    a thin receipt so your eyes have one live home.</div>
</div>

<!-- D3 — the receipt RESOLVED to a completed deliverable (terminal) -->
<div class="receipt-bracket is-done">
  <div class="rb-line"><span class="mode-badge">Harness · done</span>
    <span class="rb-name">Vendor-risk portfolio review</span>
    <span class="rb-open">Full spine in panel ▸</span></div>
  <span class="status-strip done"><span class="seg time">03:58</span><span class="divider"></span>
    <span class="seg act">✓ completed · 6/6 phases</span></span>
  <div class="deliverable">
    <span class="file-ic">◆</span>
    <div class="d-main"><div class="d-name">committee_brief.docx</div>
      <div class="d-meta">14 vendors · every figure cited · saved to FILES</div></div>
    <button class="d-open" onclick="flashPanel()">Open in FILES ▸</button>
  </div>
</div>
```

```html
<!-- D2 — the MEANINGFUL PhaseCard in the PANEL spine, on a 008-D <li>.
     The RUNNING phase shows all four layers; idle/done phases drop LINE 3 + stay quiet. -->
<li class="s-run">
  <span class="nodeD"><span class="st-ico st-run" aria-hidden="true">●</span></span>
  <div class="pcard run">
    <div class="pc-l1">                                        <!-- LINE 1 — human title (NET-NEW) + status -->
      <span class="pc-glyph">⛓</span>
      <span class="pc-title">Score each vendor on risk</span>
      <span class="nn" tabindex="0" title="phase.name — the human title. Not on the wire today; a natural Phase-103 NL-authoring output.">NET-NEW</span>
      <span class="statuspill sp-run">Running</span>
    </div>
    <div class="pc-l2">                                        <!-- LINE 2 — ordinal · PHASE_TYPE_LABEL · slug -->
      <span class="ord">Phase 3 of 6</span> ·
      <span tabindex="0" title="phase_type — REAL live on phase_started; NET-NEW only for reload persistence.">Parallel agents</span> ·
      <span class="pc-slug">score_vendors</span>
    </div>
    <div class="pc-l3"><span class="act-dot"></span>            <!-- LINE 3 — RUNNING phase ONLY, one honest verb+object -->
      <span class="act-text"><b>14 agents</b> scoring vendors in parallel</span></div>
    <span class="nn" tabindex="0" title="running-phase activity line — relaxes D-03 for the ACTIVE phase only; from REAL tool_call args / sub_agent_start.description.">NET-NEW</span>
    <!-- GATE chip renders here ONLY when the phase carries a PhaseSpec.validator -->
    <!-- Sub-results <details> expander renders here for llm_batch_agents (fan-out depth, NOT inlined) -->
  </div>
</li>
```

```html
<!-- D4 — the LOCKED composer (variant A) during the run: status chip + Cancel + escape hatch. -->
<div class="runchip">
  <span class="rc-ico">◆</span>
  <span class="rc-name">Vendor-risk portfolio review</span>
  <span class="rc-phase">phase 3/6 · Score each vendor · spine is live in the panel →</span>
  <span class="spacer"></span>
  <span class="cancel" onclick="cancelRun()">⏹ Cancel</span>
</div>
<div class="ta-wrap disabled"><textarea class="ta" rows="1"
  placeholder="Workflow running — the composer is locked. Cancel to type, or chat in another thread." disabled></textarea></div>
<div class="escape-hint"><span class="eh-ic">⎇</span>
  <span>You're not blocked — <b>open a new thread</b> to chat freely while this runs.
  <span class="eh-link" onclick="flashThread()">New thread ▸</span></span></div>

<!-- D4 — at a pause, the locked composer becomes a SCOPED reply (006-C); the question card is in the panel. -->
<div class="scoped-wrap">
  <div class="scope-label"><span>⏸</span> Scoped reply — this answers the run's question, not a new chat</div>
  <div class="scope-row">
    <input placeholder="Type your answer (e.g. 'escalate both')…">
    <button class="send" onclick="sendScoped()">Send</button></div>
  <div class="scope-mini">
    <button class="proceed">⚑ Escalate both</button>
    <button>▴ Only Helix Cloud</button>
    <button class="abort">✕ Abort</button></div>
</div>
```

## What to Avoid

- **The full timeline embedded in chat (dual-surface bounce).** The audit's #1 contradiction: the original 022 drew the 6-phase `<ol>` spine inside the transcript, creating a *third run-frame* next to the panel `PhaseTimeline` and the chat `RunCard` — the "eyes bounce, nothing is clearly the live thing" failure sketch 004 names. The panel is the single home for the live spine; the chat gets only a thin receipt that points at it and resolves.
- **FAKING meaningful per-phase data the wire doesn't carry.** The original 022 hardcoded a per-phase `name`, `gate` chip, and PH_SUM activity summaries (`31 sources · 9 calls`) — NONE on the real wire (`PhaseSpec` carries `{slug, phase_index, config, validators}` only; `WorkflowPhaseState` stores `{slug, phase_index, status}`; per-phase counts are D-03-suppressed). Show TODAY's real data OR flag every fabricated field as NET-NEW with the backend change it needs. No silent assumption of data the app doesn't emit.
- **The dedicated full-screen run view (variant C — REJECTED).** Executing the workflow on a separate CI-style surface **hides the panel** (the app's one execution home — Files/Versions/the spine), **loses conversational follow-up** ("summarize the top 3", "tweak → new version"), **duplicates the run/stream/lock/resume plumbing** the harness already ships, and re-creates the dual-surface bounce. Kept in the sketch only as a labeled losing branch with its trade-off card.
- **Chat-alongside as the default (variant B — documented, not chosen).** Keeping the composer live next to the stream lets two streams write one thread → the documented **tangle / silent-send-drop** parallel-stream race. Worse at a pause: a free-chat send is ambiguous with the scoped pause answer. B surfaces the caveat honestly rather than hiding it, but A (locked + parallel-thread escape hatch) is the winner because the run owning the composer removes the ambiguity by construction.
- **A density-everywhere spine.** Activity lines/counts on idle or done phases fight the calm + 3-second-read bar. LINE 3 appears only on the running phase; the gate chip only when a validator exists; fan-out depth goes in a `Sub-results` expander, never inlined.
- **Color-only state.** Reuse `PhaseCard`'s glyph + pill label + color together (WCAG / color-blind) — never color alone.
- **Conflating the dup-avatar/timer-reset bug with the label fix.** `BUG-260610-01` is a SEPARATE render-only workstream (seed the timer from `started_at`); do not fold it into the phase-meaning fixes (`BUG-260609-04`, `-02`).
- **Client `workflowMode` useState for the locked composer.** Run-mode is a server fact (`active_workflow_run_id`); a client toggle drifts from the truth on reconnect.

## Origin

Synthesized from sketch 022 (winner **A — locked-in-thread; panel owns the meaningful spine**), the re-architecture per `103-grounding/022-RUN-SURFACE-AUDIT.md` (verdict PARTIAL-ALIGN → ALIGN), and MANIFEST decision 18 (progressive disclosure / "3-second read at rest"). Source files in `sources/022-workflow-run-in-thread/` (`index.html`, `README.md`) and `sources/103-grounding/022-RUN-SURFACE-AUDIT.md`.

To re-feel it: open `sources/022-workflow-run-in-thread/index.html` (variant A is the default tab). The **panel owns the meaningful spine for all three variants** — the variant tabs (A/B/C) change ONLY the composer-during-a-run behavior. Step the run with the lifecycle cycler (`1 Before → 2 Launch → 3 Running → 4 Pause → 5 Resolve → 6 After`) and flip the resolve-as toggle (`✓ completed / ✕ failed-honestly / ⏹ cancelled`) to prove the three-way terminal. `⌘.`/`Ctrl+.` collapses the panel to its 52px rail (the count badge keeps the live phase visible). The storyboard is the published **Vendor-risk portfolio review** (`load → research → score → draft → confirm → emit`).

Feeds **Phase 103** (Workflows page + NL authoring — G-2 sketch fires). Reuse-vs-net-new build contract lives in the source README's Build Handover. Cross-links: [harness-phase-timeline.md](harness-phase-timeline.md) (the 008-D spine + status atoms this panel reuses), [unified-execution-surface.md](unified-execution-surface.md) (the seam that hosts the spine), [panel-shell.md](panel-shell.md) (the panel + collapse-to-rail), [pending-question.md](pending-question.md) (the 006-C scoped pause), [chat-panel-seam.md](chat-panel-seam.md) (the 009-C/007-C live-status→resolves seam the receipt rides), [composer-and-mode.md](composer-and-mode.md) (the 011-A locked composer), [run-honesty.md](run-honesty.md) (the three-way terminal), [workflows-page.md](workflows-page.md) (where the run is launched from).
