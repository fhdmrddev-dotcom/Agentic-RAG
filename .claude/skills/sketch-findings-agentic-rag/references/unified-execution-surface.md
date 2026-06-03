# Unified Execution Surface & Run Seam

The workspace panel becomes the **single live-execution surface for BOTH Deep AND Harness** — Deep's agent-loop steps + tool calls move OUT of the chat INTO the panel too, deliberately **reversing** [live-run-container.md](live-run-container.md)'s sketch-001 decision (which put Deep's run-card *in* the chat). Chat keeps only **prompt + final answer + a quiet pointer**; the panel holds the run record. This is D-094-UNIFY: *one execution surface, two drivers.* The load-bearing technical backbone is PANEL-06 — panel-driven execution legibility cannot pollute the chat transcript, because chat selectors read `bucketsBySurface` exclusively and never touch the panel-only `phasesByThread`.

## Design Decisions

### D1 — One surface, two drivers (Winner C) — D-094-UNIFY
The panel is the execution canvas for BOTH modes. A **Harness** run renders as the locked phase spine ([harness-phase-timeline.md](harness-phase-timeline.md), 008-D); a **Deep** run renders its agent loop + tool rows in the *same* panel. The chat receipt looks structurally identical for both. "Convince yourself one surface, two drivers reads true" is the acceptance bar — toggling `run = Harness | Deep` swaps the panel driver while the chat seam stays the same shape.

This deliberately **reverses sketch-001** (Deep's tool calls used to live as a Run-Card *inside* the chat). Now they live in the panel, and the chat stays pure conversation.

### D2 — Chat keeps ONLY prompt + final answer + a quiet pointer (Winner C over A, B)
The now-quiet chat holds three things: the user prompt bubble, the streamed final-answer prose, and one quiet seam element. Everything rich about *how* the answer was produced lives in the panel.

- **Won over A (Whisper pointer):** A appends a tiny inline `↳ ran in workspace · 3 phases · 48 sources · 18s ▸` to the answer body. Cleanest, almost pure conversation — but **too quiet**: you can't tell Harness from Deep at a glance, it loses the mode badge, and it's easy to miss on reload. A stays available as the ultra-minimal option if the chat must be absolutely pure.
- **Won over B (Receipt card, no live moment):** B is a durable, scannable receipt (mode badge, name, phase dots, counts, `Open in workspace ▸`) **above** the answer, but live it only shows a plain `working…` line — no proper live moment. C is *B's durable record + a real live treatment*.
- **C wins** because it is the full lifecycle: a live pointer while running, resolving to a receipt when done. It matches sketch-007's already-shipped "live-pointer / reload-resolved" seam model ([chat-panel-seam.md](chat-panel-seam.md)).

### D3 — While LIVE: a pointer status line, not a mirror (PANEL-06)
While a run is in flight, the chat shows ONE static status line: `● Running in workspace — Review (2 / 3) · panel is live · Open ▸` for Harness, `● Running in workspace — execute_code · panel is live · Open ▸` for Deep. This is a **pointer, not a mirror** — the live detail (phase spine, tool rows, sub-agents) lives only in the panel. Clicking it `onExpand`s the panel.

PANEL-06 is the technical contract: `phasesByThread` is panel-only and chat selectors NEVER read it, so a panel-Map mutation never changes a chat bucket ref → **panel updates never re-render the chat.** The live-status line is a static chat element seeded from `streamingThreads` + the latest `phase_started`, refetched on reconnect — never a token-by-token re-render.

### D4 — When DONE: resolve to final answer + compact receipt
On completion the chat resolves to: the final-answer prose, then (for C) a compact **receipt card** *under* it (answer-first). The receipt carries provenance: mode badge, run name, phase dots (one per phase, colored by status), honest counts, and `Open in workspace ▸`. The receipt is left-border color-coded — amber for Harness (`--color-warning`), indigo for Deep (`--color-primary`).

### D5 — No double-answer: prose in chat, record in panel
The chat shows the **final answer prose**; the panel shows the **run RECORD** (provenance) — never the same content twice. The receipt is metadata (badge/name/dots/counts), not a second copy of the answer. The final-answer body is the ONLY place the assistant's prose appears. This is why the receipt is structurally a *pointer-with-metadata*, not an answer card.

### D6 — The panel timeline IS 008-D; 009 governs only the seam
009 reproduces only 008-D's **shape + connector language** (spine + status-colored connectors + RunCards) for the Harness driver. The full 5-state behavior (queued/running/done/failed/retrying), the per-card caret/collapse interaction, and the complete legend are **owned by [harness-phase-timeline.md](harness-phase-timeline.md)** (008-D). 009 only governs the chat↔panel *seam*: what the quiet chat shows and how the same panel hosts both a Harness phase-run and a Deep tool-run. (This sketch shows only done/run/lock — not fail/retry — by design.)

### D7 — Open sub-choice: receipt ABOVE vs BELOW the answer
The remaining unsettled detail. **B** puts the receipt **above** the answer (chronological — "here's what ran, here's the answer"). **C** puts it **below** (answer-first — "here's the answer, here's the provenance"). The variant C winner renders below (`head + answer + receiptHTML(true)`). Decide at build time; both are legitimate.

## CSS Patterns

```css
/* ── D1: the unified shell — chat (1fr) + panel (clamped right column) ── */
/* The grid width animation lives on ChatLayout, not the panel (BRIEF §2.6). */
.shell { display: grid;
         grid-template-columns: 52px 1fr clamp(320px, 34%, 440px);
         height: calc(100vh - 52px); overflow: hidden; }
.panel { background: hsl(220 40% 8%);          /* --panel-surface */
         border-left: 1px solid hsl(220 25% 24%);  /* --panel-border */
         display: flex; flex-direction: column; overflow: hidden; }
.panel-head { display: flex; align-items: center; gap: var(--space-2);
              padding: var(--space-3) var(--space-4);
              border-bottom: 1px solid var(--color-border); }
.panel-head .pulse-dot { width: 7px; height: 7px; border-radius: 50%;
              background: var(--color-warning); animation: pulseGlow 1.6s infinite; }

/* ── D3: live status line — POINTER, not mirror ── */
/* Harness default = amber language; .deep variant flips to indigo. */
.livestatus { display: flex; align-items: center; gap: var(--space-3);
              padding: var(--space-3);
              border: 1px solid hsl(38 92% 60% / .35);   /* warning glow */
              background: var(--color-warning-dim);
              border-radius: var(--radius-md); max-width: 92%; cursor: pointer; }
.livestatus.deep { border-color: var(--color-primary-glow);
                   background: var(--color-primary-dim); }
.livestatus .ls-spark { width: 8px; height: 8px; border-radius: 50%;
              background: var(--color-warning); animation: dotBounce 1.2s infinite;
              flex-shrink: 0; }
.livestatus.deep .ls-spark { background: var(--color-primary); }
.livestatus .ls-text { flex: 1; font-size: var(--text-sm); color: var(--color-text); }
.livestatus .ls-text .mono { color: var(--color-text-muted); font-size: var(--text-xs); }
.livestatus .ls-open { font-size: var(--text-xs); color: var(--color-primary); }

/* ── D4: resolved receipt — mode-coded left border (amber=Harness, indigo=Deep) ── */
.receipt { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3);
           border: 1px solid var(--color-border); background: var(--color-surface);
           border-radius: var(--radius-md); cursor: pointer;
           transition: all var(--dur-fast) var(--ease-out); max-width: 92%; }
.receipt:hover { border-color: var(--color-primary-glow); background: var(--color-surface-hi); }
.receipt.harness { border-left: 3px solid var(--color-warning); }
.receipt.deep    { border-left: 3px solid var(--color-primary); }
.receipt .r-title { font-weight: 600; font-size: var(--text-sm);
                    display: flex; align-items: center; gap: var(--space-2); }
.receipt .r-meta  { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); }
.receipt .phase-dots { display: inline-flex; gap: 3px; }
.receipt .pd { width: 7px; height: 7px; border-radius: 50%; }  /* one per phase, colored by status */
.receipt .open-link { font-size: var(--text-xs); color: var(--color-primary); white-space: nowrap; }

/* ── D4: mode badge (shared by receipt + panel run-banner) ── */
.mode-badge { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600;
              text-transform: uppercase; letter-spacing: .06em;
              padding: 2px 7px; border-radius: var(--radius-full); }
.mb-harness { color: var(--color-warning); background: var(--color-warning-dim);
              border: 1px solid hsl(38 92% 60% / .35); }
.mb-deep    { color: var(--color-primary); background: var(--color-primary-dim);
              border: 1px solid var(--color-primary-glow); }

/* ── D6: Harness driver — spine cards (008-D shape/connector language ONLY) ── */
.tlD { list-style: none; margin: 0; padding: 0; }
.tlD > li { position: relative; padding-left: 32px; padding-bottom: 14px; }
.tlD > li::before { content: ''; position: absolute; left: 11px; transform: translateX(-1px);
                    top: 24px; bottom: -16px; width: 2px; z-index: 0; background: var(--color-border); }
.tlD > li:last-child::before { display: none; }
.tlD > li.s-done::before { background: var(--color-success); }                 /* connector colored by outcome */
.tlD > li.s-run::before  { background: linear-gradient(var(--color-warning) 35%, var(--color-border)); }
.tlD > li.s-lock::before { background: transparent; border-left: 2px dashed var(--color-text-dim); width: 0; }
.cardD.run    { border-color: hsl(38 92% 60% / .5); box-shadow: 0 0 22px hsl(38 92% 60% / .12); }
.cardD.locked { background: transparent; border: 1px dashed var(--color-border); opacity: .72; }

/* ── D1: Deep driver — RunCard relocated INTO the panel (was sketch-001 chat run-card) ── */
.deepcard { border-radius: var(--radius-lg); border: 1px solid var(--color-border);
            background: var(--color-surface); overflow: hidden; }
.deepcard.run { border-color: var(--color-primary-glow); box-shadow: var(--shadow-glow-primary); }
.toolrow { display: flex; align-items: center; gap: var(--space-2);
           padding: var(--space-2) var(--space-3); font-size: 12px;
           border-bottom: 1px solid var(--color-border-soft); }
.toolrow.run { background: var(--color-primary-dim); }       /* active tool = indigo glow */
.toolrow .tr-name { font-family: var(--font-mono); font-size: 11px; color: var(--color-text); }
.toolrow .tr-sum  { margin-left: auto; font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); }

/* ── shared status icon + count chips (both drivers) ── */
.st-ico  { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;
           font-size: 11px; font-weight: 700; font-family: var(--font-mono); }
.st-done { background: var(--color-success-dim); color: var(--color-success); border: 1.5px solid var(--color-success); }
.st-run  { background: var(--color-warning-dim); color: var(--color-warning); border: 1.5px solid var(--color-warning);
           animation: pulseGlow 1.4s infinite; }
.st-lock { background: transparent; color: var(--color-text-dim); border: 1.5px dashed var(--color-text-dim); }
.chip    { font-family: var(--font-mono); font-size: 10.5px; padding: 2px 7px; border-radius: var(--radius-full);
           background: var(--color-muted); color: var(--color-text-muted); border: 1px solid var(--color-border-soft); }
```

## HTML Structure

```html
<!-- ── The unified shell: chat (quiet) + panel (the one execution surface) ── -->
<div class="shell">
  <div class="nav-rail">…</div>
  <div class="chat" id="chatCol"><!-- prompt + final answer + quiet seam ONLY --></div>
  <div class="panel">
    <div class="panel-head">
      <span class="pulse-dot"></span>          <!-- shown only while live -->
      <span class="ph-title">Workspace</span>
      <span class="spacer"></span>
      <span class="head-tag">harness · live</span>  <!-- or "deep · live" / "… · done" -->
    </div>
    <div class="panel-body" id="panelBody"><!-- driver: Harness spine OR Deep RunCard --></div>
  </div>
</div>
<!-- a11y: one announcer per RunCard, present at load (BRIEF §6.1) -->
<div role="status" aria-live="polite" class="sr-only" id="announcer"></div>

<!-- ── D3: LIVE seam — quiet pointer, NOT a mirror (chat side) ── -->
<div class="chat-head">Thread · Literature review · DBA corpus</div>
<div class="bubble-user">Review the literature on leadership style, organizational culture…</div>
<div class="livestatus" onclick="flashPanel()">    <!-- .deep variant for Deep runs; in-app this is onExpand -->
  <span class="ls-spark"></span>
  <span class="ls-text">Running in workspace — <b>Review (2 / 3)</b>
    <span class="mono">· panel is live</span></span>
  <span class="ls-open">Open ▸</span>
</div>

<!-- ── D4/D5/D7: DONE seam — answer prose, then receipt BELOW (answer-first) ── -->
<div class="answer"><div class="bot"></div>
  <div class="body"><b>Integrated literature review.</b> … <span class="text-dim">(48 sources)</span></div>
</div>
<div class="receipt harness" onclick="flashPanel()">  <!-- .deep for Deep; dots null for Deep; in-app this is onExpand -->
  <div class="r-main">
    <div class="r-title"><span class="mode-badge mb-harness">Harness</span> Literature review
      <span class="phase-dots">
        <span class="pd" style="background:var(--color-success)"></span>
        <span class="pd" style="background:var(--color-success)"></span>
        <span class="pd" style="background:var(--color-success)"></span></span>
    </div>
    <div class="r-meta">3 phases  ·  4 agents  ·  48 sources  ·  18s</div>
  </div>
  <span class="open-link">Open in workspace ▸</span>
</div>

<!-- ── D6: panel HARNESS driver — 008-D spine shape (one <li> per phase) ── -->
<div class="run-banner">
  <div class="wf-row"><span class="mode-badge mb-harness">Harness</span><span class="wf-name">Literature review</span></div>
  <div class="wf-meta">DBA · Fahed Mrad Chapters 1-4</div>
  <div class="count-strip"><span class="chip">Phase 2/3</span><span class="chip">4 agents</span>…</div>
</div>
<ol class="tlD" aria-label="Phases">
  <li class="s-done"><span class="nodeD">✓</span><div class="cardD">…Split topic…</div></li>
  <li class="s-run"> <span class="nodeD">●</span><div class="cardD run">…Review (parallel agents)…</div></li>
  <li class="s-lock"><span class="nodeD">○</span><div class="cardD locked">…Merge (locked · queued)…</div></li>
</ol>

<!-- ── D1: panel DEEP driver — RunCard relocated from chat into the SAME panel ── -->
<div class="deepcard run">
  <div class="deepcard-head">●<span class="dc-name">Agent loop</span><span class="cb-sum">iteration 3</span></div>
  <div class="toolrow"><span class="st-ico st-done">✓</span><span class="tr-name">search_documents</span><span class="tr-sum">24 results</span></div>
  <div class="toolrow run"><span class="st-ico st-run">●</span><span class="tr-name">execute_code</span><span class="tr-sum">running…</span></div>
</div>
```

## Implementation Notes

- **Surface owner:** the panel is `frontend/src/components/panel/WorkspacePanel.tsx` (controlled + dumb; owner = `ChatLayout`, `PanelState = "open" | "rail"`). The grid width animation is on `ChatLayout`, NOT the panel (`gridTemplateColumns: "1fr " + (open ? "clamp(300px,30%,420px)" : "52px")`). The seam pointer's click uses `onExpand` (force-open), matching the existing seam-pointer affordance.
- **The new store slice:** a new `phasesByThread: Map<threadId, Phase[]>` lives in `frontend/src/stores/streamsStore.ts` right beside `workflowLockByThread`, mutated only by new `*PhasesForThread` actions + new `onPhase*` SSE handlers, with a new `usePhases(threadId)` hook mirroring `useTodos`. **PANEL-06: chat selectors (`useThreadMessages`) must NEVER read `phasesByThread`** — that isolation is what makes "panel updates never re-render chat" (D3) true.
- **The dropped events api.ts must learn (this is the enabling fix):** `frontend/src/lib/api.ts` (`subscribeToRun` switch, ~lines 485–667) has **NO branch** for `phase_started`, `phase_completed`, `phase_transition`, `gate_failed`, `run_completed`, `run_failed` — they are **wire-emitted but silently dropped today.** The switch jumps from `sub_agent_start` (511) past `sources`/`citations` (566–569) to `ask_user_prompt` (600). Add exactly these branches, each calling a new `onPhase*`/`onGateFailed`/`onRunFailed` callback. This is the SINGLE place a wire event becomes panel state.
- **Wire facts the seam binds to (BRIEF §1.2, DATA-CONTRACT §4.3):**
  - **Live-status pointer** = `streamingThreads.has(threadId)` + latest `phase_started{phase, phase_index, phase_type}` (Harness) or `tool_start`/`iteration_start` (Deep). It is a static snapshot refetched on reconnect, **not** a token-by-token mirror (PANEL-06).
  - **Receipt phase-dots** = one dot per phase, colored by per-phase `status` from `phase_started`/`phase_completed`/`run_failed` — MUST reflect real status incl. failure, NOT all-green. A **Deep** run has `dots: null` (it's tool-based, not phase-based — correct).
  - **Panel count-strip chips** are all client-derived aggregates (`phases.length`, `i/N`, sub-agent tally, `sources.length`, elapsed). The honest "Phase i / N" comes from reconcile `GET /threads/{id}/workflow` (`current_phase_index + 1` / `total_phases`, REAL — `thread.py:69-70`), advanced forward by live `phase_completed` (reconcile is the floor, live never moves it backward — D-v2.5-03).
  - **Deep panel tool rows** = `tool_start`/`tool_end` (api.ts:492/504), `execute_code` special-cased; same data source as today's chat RunCard, just relocated INTO the panel.
- **Mode truth (kills finding #5):** the Harness/Deep distinction is the server fact `mode` from `GET /threads/{id}/workflow.mode` (`threads.py:1659`) — `active_workflow_run_id IS NOT NULL && run non-terminal ? "harness" : "deep"`. Presence in `workflowLockByThread` ⇒ Harness. **Never** a client `workflowMode` useState (that drift is the bug 011 kills).
- **Zero backend change:** the engine already emits every event the seam needs; the only work is rendering (api.ts branches + the `phasesByThread` slice + the seam components). No new endpoint, no migration. The panel timeline component itself is 008-D (`harness-phase-timeline.md`).
- **Off the G-5 hot files where possible:** the seam is NEW rendering (new store slice, new api.ts branches, new seam component), not a re-touch of `MessageItem`/`ToolCallPanel`/`StreamsProvider` internals. The Deep RunCard/ToolCallPanel relocation (moving them from chat into the panel) does touch those — keep that scoped and additive.
- **Honest documented limits (do NOT promise these):**
  - Sub-agent internal `tool_start`/`tool_end` fire on the **SUB stream** (`run:{sub_run_id}`), NOT the harness producer stream — so per-phase "N tool calls / K sources" chips are **INVENTED** unless the sub-stream is threaded up (a separate fix). Suppress, don't fake.
  - `gate_passed` is **audit-only** (`harness_engine.py:499`, never `_emit`) — a passed gate is INFERRED from the phase advancing (`phase_transition` / next `phase_started`), never from a gate event.
  - **RC-4:** a failed run wrongly emits terminal `done`. The seam must key failure off `run_failed`/`gate_failed`, NOT the terminal sentinel — the receipt's dots/copy turn red from the failure events.
  - Generated files from `execute_code` fire on the sub-agent stream and never reach the harness producer today — the panel FILES tab reads the 087 workspace store, not the harness stream.
- **Provenance IDs:** D-094-UNIFY · PANEL-06 · D-v2.5-03 (reconcile-then-live) · RC-4 (failed-renders-as-done bug) · SEED-047 (kickoff_prompt seeding) · D-092-UX (launch-relocation companion). Feeds **Phase 094 (Workflow Legibility + Mode Clarity)**.

## What to Avoid

- **Double-answer** — the same prose appearing as both the chat answer AND a panel content block. Chat = final answer prose; panel = run record (provenance). The receipt is metadata, never a second copy of the answer (D5). This was the explicit "no double-answer" check.
- **A's whisper as the only treatment** — the inline `↳ ran in workspace · …` is too quiet: you can't tell Harness from Deep at a glance, it loses the mode badge, and it's easy to miss on reload. C's receipt is the right amount of "what happened" for an auditable transcript. (A stays as an opt-in ultra-minimal mode only.)
- **A live mirror in chat** — re-rendering the chat on every panel event (phase ticks, tool rows). That violates PANEL-06 and re-introduces the "30-step run buries the conversation" problem. The live-status line is a single static pointer (D3).
- **Reading `phasesByThread` from a chat selector** — the moment a chat selector subscribes to the panel slice, every phase event re-renders the transcript. Keep `phasesByThread` panel-only.
- **Putting Deep's tool calls back in the chat** — that is sketch-001, which D1 deliberately reverses. Deep and Harness both render in the panel; reversing this re-splits the surface into two.
- **Faking unavailable counts** — "6 searches / 16 tool calls" per phase look real but have NO producer-stream source (they're on the sub stream). Hardcoding "48 sources" or "4 agents" is INVENTED — derive from event tallies or suppress the chip (DATA-CONTRACT §8).
- **All-green phase dots / red-via-terminal-sentinel** — receipt dots must reflect real per-phase status including failure, and failure must key off `run_failed`/`gate_failed` (RC-4), never the wrongly-`done` terminal sentinel.
- **Breaking the locked color language** — amber strictly = Harness / pending / needs-you / cap_paused; indigo = normal/count/Deep; green = done; red = error. The receipt left-border and live-status background encode this; don't repaint them.

## Origin

Synthesized from sketch **009 (winner C — Live-status → resolves)**. Source: `sources/009-unified-surface/index.html`.

To re-feel it, open the source and drive the two toolbar toggles: **`run = Harness | Deep`** (proves the one panel hosts both drivers — watch the Deep RunCard render in the *same* panel the Harness spine used) and **`state = Live | Done`** (the live-pointer → resolved-receipt transition). The top tabs switch the chat-side seam treatment A (whisper) / B (receipt-above) / C (live-status→resolves, the winner). Clicking the chat seam element runs `flashPanel()` (a border flash in the mockup; in-app this becomes the `onExpand` force-open affordance).

Grounded by `sources/094-grounding/BRIEF.md` (§1 real event vocabulary, §2.1 WorkspacePanel shape, §2.3 PANEL-06, §4.5 mode truth) and `DATA-CONTRACT.md` (§3 source-of-truth, §4.1 cross-cutting, §4.3 009-specific payload matrix, §8 invented-data flags). The panel timeline component is owned by [harness-phase-timeline.md](harness-phase-timeline.md) (008-D); the panel-owned-tool seam this extends to whole runs is [chat-panel-seam.md](chat-panel-seam.md) (007). Feeds **Phase 094 — Workflow Legibility + Mode Clarity**.
