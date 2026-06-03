# Harness Phase Timeline

The live view of a running harness workflow IN THE PANEL — the run's REAL phases, sub-agents, and counts, not a spinner. This is the operator's **#1 acceptance bar** for Phase 094: "Show the workflow's REAL steps and real tasks — transparency, not a spinner." It exists because every harness lifecycle event (`phase_started`, `phase_completed`, `phase_transition`, `gate_failed`, `run_completed`, `run_failed`) is emitted on the wire today but **silently dropped by `api.ts`** (BRIEF §1.2 — "wire-only"), so the chat currently shows "Setting up agent…" → a pulse → the full answer at once. This timeline is fundamentally about *rendering those dropped events* as an honest, accessible, escape-proof pipeline.

## Design Decisions

### D1 — Synthesis: collapsible RunCards threaded onto a vertical spine (Winner D)
Each phase is its own **RunCard** (B's frame, the same shape Deep already uses) threaded onto a single **vertical spine** (A's reading). One component, two drivers — directly serving the D-094-UNIFY goal (Deep and Harness share the RunCard). The card collapses to a one-line summary when done (`✓ Review · 4 agents · 48 src · 12.3s ▸`), auto-expands when active/failed/retrying, and carries rich in-phase tool detail.

- **Won over A (Span timeline):** A nailed the *pipeline feel* — vertical spine, outcome-colored bars, nested sub-rows — but it invented a bespoke node/bar component that doesn't reuse our shipped RunCard, so Deep and Harness would diverge into two timelines to maintain.
- **Won over B (RunCard-per-phase):** B reused the RunCard perfectly but a flat stack of cards lost the *ordered, locked pipeline* legibility — you couldn't feel that phase 3 was gated behind phase 2. The spine is what makes the lock visible.
- **Won over C (Stepper + event log):** C's compact top stepper + expandable raw-event log was great for drill-down/audit, but the at-a-glance stepper hid per-phase tool detail behind a toggle and read like CI logs, not a workspace. (Keep C's event-log idea as an optional "raw events" drawer — see What to Avoid.)

D = B's collapsible RunCards + A's vertical spine. Built explicitly after the A-vs-B trade-off discussion.

### D2 — The spine FILLS to encode state, so you FEEL the locked pipeline
The connector segment between nodes is drawn *behind* the node circles and colored by the phase's own status — this is the whole point of the synthesis:
- **green** solid through completed phases,
- **amber** (gradient amber→border) at the active phase,
- **dashed-dim** for locked-ahead phases,
- **red** for the failed phase, **purple** for a retrying phase.

The result: the operator *feels* the locked, ordered, escape-proof pipeline at a glance — the harness's defining promise (you can't skip a phase). The opaque node "stations" (`z-index: 2`) mask the line where it passes a glyph so the spine never crosses an icon.

### D3 — 5 REAL states, color is reinforcement NEVER the only signal (a11y / WCAG)
Not just done/pending. Five states, each with a **distinct glyph + label + pill + color** so color-blind and screen-reader users get the state without color:
| State | Glyph | Pill label | Color token | Spine |
|---|---|---|---|---|
| complete | `✓` | Complete | `--color-success` | green solid |
| running | `●` (pulse) | Running | `--color-warning` | amber gradient |
| locked-ahead | `○` | Locked | `--color-text-dim` (dashed) | dashed-dim |
| failed | `✕` | Failed | `--color-danger` | red |
| retrying | `↻` | Retrying | `--color-accent-violet` | purple |

The lock is *legible* — locked-ahead cards are dashed, dimmed (`opacity: .72`), non-interactive (`cursor: default`), and show `locked · queued`. A `role="status" aria-live="polite"` announcer fires the "doing now" sentence on transition edges only (written on transitions, not on every token).

### D4 — Failed-as-failed (the RC-4 fix)
The run must show **which phase failed and why**, never an empty/done card. BRIEF §1.5 RC-4: the backend's terminal sentinel is *wrongly* `done` even on failure (`run_workflow` returns normally after `run_failed`), so the UI MUST key failure off `run_failed.reason` / terminal `gate_failed.error` — NOT the terminal sentinel. The failed phase card auto-expands, turns its border red, and renders a `.fail-reason` block with the verbatim reason (e.g. "Sub-agent 'Employee engagement' reached its 12-step cap without a final answer (max_steps)"). Empty `error` ⇒ explicit "Failure reason not captured" sentinel, never a blank card.

### D5 — Fan-out legibility (the ghost-avatar fix)
The `review` phase's parallel sub-agents render as **real child rows** with their own state glyph, name, and honest aggregate counts (`2s · 5t · 14src`) — not the stacked empty avatars that `api.ts:511` produces today. Each child carries its own status, so one failed sub-agent is visible without expanding everything. Counts are **client-aggregated** because the wire emits N `sub_agent_start` events with no aggregate count field (BRIEF §1.5).

### D6 — Gate rendering even though the 4 shipped seeds have no active gates
A gate-fail / retry sub-row must render even though all 4 shipped seeds have ZERO active gates post-065 — **authored workflows (sketch 013) can have them**. The `Gate retry` state renders a `.gate-row` (purple, dashed) showing `Gate <name>: attempt N failed → retry N+1/max`, driven by `gate_failed{phase, attempt, error}` which fires on EVERY attempt. `gate_passed` is **audit-only — never on the wire** — so a passed gate is *inferred from the phase advancing* (`phase_transition` / next `phase_started`), never from a gate event.

### D7 — Honest header counts, never a fake percent
The run banner carries a plain-language "doing now" line (`live-spark` dot bouncing) above the timeline, plus a `count-strip` of honest chips: `Phase 2/3 · 4 agents · 6 searches · 16 tool calls · 48 sources`. The phase ordinal (`i/N`) is the REAL phase count from reconcile (`current_phase_index`/`total_phases`, `thread.py:69-70`). Never a synthetic progress percentage.

## CSS Patterns

All snippets are the real winning-variant-D rules copied from `index.html`. Tokens (`--color-*`, `--space-*`, `--radius-*`, `--font-*`) come from `../themes/default.css` (Deep Midnight).

```css
/* D1/D2 — the spine: list with a connector drawn BEHIND each node, colored by status.
   The opaque node "stations" (z-index 2) mask the line ends so it never crosses a glyph. */
.tlD { list-style: none; margin: 0; padding: 0; }
.tlD > li { position: relative; padding-left: 32px; padding-bottom: 14px; }
.tlD > li:last-child { padding-bottom: 0; }

.tlD > li::before {                       /* the connector segment */
  content: ''; position: absolute; left: 11px; transform: translateX(-1px);
  top: 24px; bottom: -16px; width: 2px; z-index: 0;
  background: var(--color-border);
}
.tlD > li:last-child::before { display: none; }
.tlD > li.s-done::before  { background: var(--color-success); }                          /* green fill */
.tlD > li.s-fail::before  { background: var(--color-danger); }
.tlD > li.s-retry::before { background: var(--color-accent-violet); }
.tlD > li.s-run::before   { background: linear-gradient(var(--color-warning) 35%, var(--color-border)); } /* amber→dim at active */
.tlD > li.s-lock::before  { background: transparent; border-left: 2px dashed var(--color-text-dim); width: 0; } /* dashed-dim lock */

/* node "station": opaque circle that cleanly masks the spine where it passes (D2) */
.nodeD {
  position: absolute; left: 1px; top: 7px; width: 20px; height: 20px; z-index: 2;
  display: grid; place-items: center; border-radius: 50%;
  background: hsl(220 40% 8%);            /* MUST match the panel bg so the mask reads opaque */
}
```

```css
/* D1 — the per-phase RunCard (reuses the B frame; this is the shape Deep already renders) */
.cardD {
  border-radius: var(--radius-lg); border: 1px solid var(--color-border);
  background: var(--color-surface); overflow: hidden;
}
.cardD.run  { border-color: hsl(38 92% 60% / .5); box-shadow: 0 0 22px hsl(38 92% 60% / .12); } /* active glow */
.cardD.fail { border-color: hsl(0 72% 51% / .5); }
.cardD.locked { background: transparent; border: 1px dashed var(--color-border); opacity: .72; } /* D3 legible lock */
.cardD-head { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); cursor: pointer; }
.cardD.locked .cardD-head { cursor: default; padding: var(--space-2) var(--space-3); }            /* inert when locked */
.cardD-head:hover { background: var(--color-surface-hi); }
.cardD.locked .cardD-head:hover { background: transparent; }
.cardD-head .cb-name { font-weight: 600; font-size: var(--text-sm); flex: 1; }
.cardD-head .cb-name.dim { color: var(--color-text-dim); font-weight: 500; }                      /* locked name */
.cardD-head .cb-sum { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); }
.cardD-head .caret { color: var(--color-text-dim); transition: transform var(--dur-fast); }
.cardD.open .caret { transform: rotate(90deg); }
.cardD-body { padding: 0 var(--space-3) var(--space-3) var(--space-3); display: none; }
.cardD.open .cardD-body { display: block; animation: fadeSlideUp var(--dur-base) var(--ease-out); }
```

```css
/* D3 — status atoms: glyph circle + pill. Color is reinforcement; glyph + pill text carry the state. */
.st-ico {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; font-size: 11px; font-weight: 700; font-family: var(--font-mono);
}
.st-done  { background: var(--color-success-dim); color: var(--color-success); border: 1.5px solid var(--color-success); }
.st-run   { background: var(--color-warning-dim); color: var(--color-warning); border: 1.5px solid var(--color-warning); }
.st-lock  { background: transparent; color: var(--color-text-dim); border: 1.5px dashed var(--color-text-dim); }
.st-fail  { background: var(--color-danger-dim);  color: var(--color-danger);  border: 1.5px solid var(--color-danger); }
.st-retry { background: hsl(258 90% 66% / .15); color: var(--color-accent-violet); border: 1.5px solid var(--color-accent-violet); }
.st-run.spin { animation: pulseGlow 1.4s infinite; }     /* the amber "running" pulse */

.statuspill {
  font-size: 10px; font-weight: 600; font-family: var(--font-mono);
  text-transform: uppercase; letter-spacing: .04em;
  padding: 1px 6px; border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 4px;
}
.sp-done  { color: var(--color-success); background: var(--color-success-dim); }
.sp-run   { color: var(--color-warning); background: var(--color-warning-dim); }
.sp-lock  { color: var(--color-text-dim); background: var(--color-muted); }
.sp-fail  { color: var(--color-danger);  background: var(--color-danger-dim); }
.sp-retry { color: var(--color-accent-violet); background: hsl(258 90% 66% / .15); }
```

```css
/* D5 — fan-out: real child sub-agent rows (replaces today's ghost avatars) */
.subrows { margin-top: var(--space-2); display: flex; flex-direction: column; gap: 5px;
           padding-left: 2px; border-left: 1px solid var(--color-border-soft); }
.subrow {
  display: flex; align-items: center; gap: var(--space-2);
  padding: 5px var(--space-2); border-radius: var(--radius-sm);
  background: var(--color-surface); font-size: 11.5px;
}
.subrow .sa-name  { flex: 1; color: var(--color-text); }
.subrow .sa-stats { font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-dim); }
.subrow.run  { background: var(--color-warning-dim); }
.subrow.fail { background: var(--color-danger-dim); }

/* D6 — gate retry sub-row (renders for authored workflows even though shipped seeds have none) */
.gate-row {
  display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2);
  padding: 6px var(--space-2); border-radius: var(--radius-sm); font-size: 11px;
  background: hsl(258 90% 66% / .08); border: 1px dashed var(--color-accent-violet); color: var(--color-text-muted);
}

/* D4 — failed-as-failed reason block (RC-4 fix; verbatim reason, never an empty card) */
.fail-reason {
  margin-top: var(--space-2); padding: var(--space-2) var(--space-3);
  background: var(--color-danger-dim); border: 1px solid hsl(0 72% 51% / .4);
  border-radius: var(--radius-sm); font-size: 11.5px; color: hsl(0 80% 78%);
}
.fail-reason b { color: var(--color-danger); }
```

```css
/* D7 — run banner: mode badge + doing-now line + honest count chips (never a percent) */
.run-banner { display: flex; flex-direction: column; gap: 4px;
  padding: var(--space-3) var(--space-3) var(--space-4); margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-soft); }
.mode-badge { font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .06em; padding: 2px 7px; border-radius: var(--radius-full);
  color: var(--color-warning); background: var(--color-warning-dim); border: 1px solid hsl(38 92% 60% / .35); }
.doing-now { display: flex; align-items: center; gap: var(--space-2);
  font-size: var(--text-sm); color: var(--color-text); margin-top: var(--space-2); }
.doing-now .live-spark { width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-primary); animation: dotBounce 1.2s infinite; }
.doing-now.is-failed { color: var(--color-danger); }
.doing-now.is-done   { color: var(--color-success); }
.count-strip { display: flex; flex-wrap: wrap; gap: 5px; margin-top: var(--space-2); }
.chip { font-family: var(--font-mono); font-size: 10.5px; padding: 2px 7px; border-radius: var(--radius-full);
  background: var(--color-muted); color: var(--color-text-muted); border: 1px solid var(--color-border-soft); }
.chip.primary { color: var(--color-primary); background: var(--color-primary-dim); border-color: var(--color-primary-glow); }

/* a11y: screen-reader-only announcer target */
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden;
           clip:rect(0,0,0,0); white-space:nowrap; border:0; }
```

## HTML Structure

The component skeleton a builder ports to JSX. One `<li class="s-{status}">` per phase, each holding a `.nodeD` station + a `.cardD`. The spine renders purely from the `s-{status}` class on the `<li>`.

```html
<!-- a11y announcer: present at load, written on transition edges only -->
<div role="status" aria-live="polite" class="sr-only" id="announcer"></div>

<!-- run banner (D7) -->
<div class="run-banner">
  <div class="wf-row"><span class="mode-badge">Harness</span><span class="wf-name">Literature review</span></div>
  <div class="wf-meta">DBA · Fahed Mrad Chapters 1-4 (843 chunks)</div>
  <div class="doing-now"><span class="live-spark"></span>
    <span>Reviewing 4 subtopics in parallel — 2 of 4 agents still searching the DBA corpus…</span></div>
  <div class="count-strip">
    <span class="chip primary">Phase 2/3</span>
    <span class="chip">4 agents</span><span class="chip">3 searches</span>
    <span class="chip">9 tool calls</span><span class="chip">26 sources</span>
  </div>
</div>

<!-- the spine: ol.tlD, one li per phase -->
<ol class="tlD" aria-label="Phases">

  <!-- DONE phase — collapsed to summary row -->
  <li class="s-done">
    <span class="nodeD"><span class="st-ico st-done" aria-hidden="true">✓</span></span>
    <div class="cardD">
      <div class="cardD-head">
        <span class="cb-name">Split topic</span>
        <span class="type-tag">server step</span>
        <span class="cb-sum">4 subtopics · 0.1s</span>
        <span class="caret">▸</span>
      </div>
      <div class="cardD-body"><!-- split_topic → 4 subtopics from kickoff_prompt --></div>
    </div>
  </li>

  <!-- RUNNING phase — auto-expanded, glow border, sub-agent child rows (D5) -->
  <li class="s-run">
    <span class="nodeD"><span class="st-ico st-run spin" aria-hidden="true">●</span></span>
    <div class="cardD open run">
      <div class="cardD-head">
        <span class="cb-name">Review</span>
        <span class="type-tag">parallel agents</span>
        <span class="cb-sum">running…</span>
        <span class="caret">▸</span>
      </div>
      <div class="progress-bar tool-progress" style="height:2px"></div>
      <div class="cardD-body">
        <div class="subrows" role="group" aria-label="Sub-agents">
          <div class="subrow"><span class="st-ico st-done">✓</span><span class="sa-name">Leadership style</span><span class="sa-stats">2s · 5t · 14src</span></div>
          <div class="subrow run"><span class="st-ico st-run spin">●</span><span class="sa-name">Organizational culture</span><span class="sa-stats">2s · 4t · 12src</span></div>
          <div class="subrow run"><span class="st-ico st-run spin">●</span><span class="sa-name">Employee engagement</span><span class="sa-stats">1s · 4t · 13src</span></div>
          <div class="subrow"><span class="st-ico st-lock">○</span><span class="sa-name">Style × culture interplay</span><span class="sa-stats">1s · 3t · 9src</span></div>
        </div>
        <!-- D6 gate retry sub-row renders here when gate_failed fires (authored workflows) -->
        <!-- D4 fail-reason block renders here on terminal failure -->
      </div>
    </div>
  </li>

  <!-- LOCKED-AHEAD phase — dashed, dimmed, inert, no caret (last li drops the spine) -->
  <li class="s-lock">
    <span class="nodeD"><span class="st-ico st-lock" aria-hidden="true">○</span></span>
    <div class="cardD locked">
      <div class="cardD-head">
        <span class="cb-name dim">Merge</span>
        <span class="type-tag">AI write</span>
        <span class="cb-sum">locked · queued</span>
      </div>
    </div>
  </li>

</ol>
```

Failed and retrying variants swap the `<li>` class to `s-fail` / `s-retry` and append `.fail-reason` / `.gate-row` into the active card's `.cardD-body`.

## Implementation Notes

- **Surface owner:** the panel — `frontend/src/components/panel/*` and the SSE consumer `frontend/src/lib/api.ts` (branches ~lines 485–657). This timeline is **new rendering of already-emitted events**, not a re-touch of the G-5 hot files (`MessageItem.tsx`, `ToolCallPanel.tsx`, `StreamsProvider.tsx`, `useMessages.ts`). Keep it OFF those files.
- **Zero backend change.** Every event this needs is *already on the wire* — the work is adding the missing `api.ts` branches. Wire-only events api.ts currently drops (BRIEF §1.2 table): `phase_started` (`harness_engine.py:676`, payload `{phase, phase_index, phase_type}`), `phase_completed` (`{phase, phase_index}`), `phase_transition` (`:773`; skip variant adds `via:"skip_to_phase"` at `:718`), `gate_failed` (`:522`, `{phase, attempt, error}` — fires EVERY attempt), `run_completed` (`:823`, `{status:"completed"}`), `run_failed` (`:708`, `{reason}`).
- **State mapping (DATA-CONTRACT §RECONCILE):** `running` on `phase_started`; `done` on `phase_completed`; `failed` on `run_failed`/terminal `gate_failed`; `retrying` on non-terminal `gate_failed`; `skipped` on `phase_transition.via==="skip_to_phase"`; `pending` (locked-ahead) for not-yet-started phases derived from `total_phases`.
- **The phase-type discriminator is the wire field, not inferred prose.** Render one of 5 canonical card shapes keyed on `phase_started.phase_type` (`harness_engine.py:680`) — `programmatic` · `llm_single` · `llm_agent` · `llm_batch_agents` · `llm_human_input`. UNKNOWN type ⇒ fall back to a generic "Step" row, never crash.
- **Honest counter from reconcile, not live.** `GET /threads/{id}/workflow` → `ThreadWorkflowState` (`thread.py:48-85`, `threads.py:1659`) seeds the authoritative `current_phase_index`/`total_phases` ("Phase 3 / 5" REAL at `thread.py:69-70`). **Reconcile is the floor; live advances it forward, never backward** — the single rule preventing inconsistency on reconnect. `latest_producer_run_id` re-attaches the live stream with no page action.
- **RC-4 (BUG):** key failure off `run_failed.reason` / terminal `gate_failed.error`, **NOT** the terminal sentinel — `run_workflow` returns normally after `run_failed`, so the outer producer-shell emits `done` with empty content. Empty `error` ⇒ "Failure reason not captured" sentinel.
- **`gate_passed` is audit-only** (`write_audit` at `:497`, never on the wire) — infer "passed" from the phase advancing. The shipped 4 seeds have ZERO active gates post-065; gate rows only appear for authored workflows (sketch 013).
- **Documented limits (do NOT over-promise):** sub-agent *internal* `tool_start`/`tool_end` fire on the **sub-agent's own stream** `run:{sub_run_id}`, not the harness producer stream (BRIEF §1.5) — the harness engine emits no tool events. So per-agent counts shown are **aggregate, client-derived** (batch fan-out emits N `sub_agent_start` with no aggregate count field); live per-tool drill-down inside a phase would need 093/094 to thread those events up. Same for `execute_code` artifacts (`final_output_files`/`workspace_file_written`) — they fire on the sub stream and aren't threaded up today, so workflow-produced files don't appear in the panel yet.
- **Node-station bg must equal panel bg.** `.nodeD { background: hsl(220 40% 8%); }` is hardcoded to the panel background so the station opaquely masks the spine. If the panel bg token changes, this must change with it (or be wired to the same var).

## What to Avoid

- **Fake spinner / "Setting up agent…"** — the defect this whole timeline kills. Never render a generic pulse in place of real phase rows; the events to drive them already exist on the wire.
- **Fake percentage progress** — there is no real total-work estimate; show honest counts (`Phase 2/3 · 16 tool calls · 48 sources`), never a synthetic %.
- **Color-only state** (Variant-A trap if glyphs dropped) — fails WCAG and color-blind users. Every state needs glyph + pill label + color together (D3).
- **Ghost avatars** — today's `api.ts:511` stacks empty sub-agent avatars with no state or counts. Replace with real `.subrow` child rows (D5).
- **Empty/done card on failure (RC-4)** — keying off the terminal sentinel makes a failed run look completed. Always surface which phase failed and the verbatim reason.
- **Flat card stack (Variant B alone)** — loses the ordered/locked pipeline feel. The spine fill is load-bearing; don't drop it for a plain list.
- **Bespoke node/bar components (Variant A alone)** — diverges Deep and Harness into two timelines. Reuse the RunCard frame (D-094-UNIFY).
- **Raw event log as the primary view (Variant C)** — reads like CI logs, hides per-phase tool detail. Fine as an *optional* "raw events" drawer (C's faithfully-named event stream: `phase_started`/`gate_failed`/`run_completed`…), never the default.
- **Inferring phase type from slug/prose** — always key the 5 card shapes off `phase_started.phase_type`; fall back to a generic row on UNKNOWN.
- **Live counter moving backward on reconnect** — reconcile is the floor; live only advances it.

## Origin

Synthesized from sketch 008 (winner **D — Synthesis: collapsible RunCards threaded on a vertical spine**). Source: `sources/008-phase-timeline/index.html`.

To re-feel it: open the source, the winning variant D is the default tab. Use the **state cycler** in the bottom-right toolbar — `Running · Gate retry · Failed · Done` — to walk all 5 states; the content is the REAL `literature_review`-on-DBA storyboard (BRIEF §3.5): split → 4 subtopics, review → 4 agents / 6 searches / 16 tool calls / 48 sources, merge → integrated review. The top tabs (A/B/C) show the rejected variants for comparison.

Feeds **Phase 094** (mode legibility / workspace panel timeline — the operator's #1 acceptance bar). Grounding: `sources/094-grounding/BRIEF.md` (§1.2 wire-only events, §1.5 gap findings, §3.5 storyboard) and `DATA-CONTRACT.md` (event→state→UI binding, RECONCILE floor rule). Cross-links: [live-run-container.md](live-run-container.md) (the RunCard frame this reuses), [unified-execution-surface.md](unified-execution-surface.md) (the seam that hosts this timeline), [panel-shell.md](panel-shell.md) (the panel that holds it).
