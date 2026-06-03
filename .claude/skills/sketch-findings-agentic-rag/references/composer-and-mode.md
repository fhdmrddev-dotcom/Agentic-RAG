# Composer & Mode Clarity

How the composer collapses to **2 stable pills**, how mode stops being ambiguous, and how a running workflow is shown once the Deep/Harness toggle + workflow picker LEAVE the composer. The load-bearing idea: **mode is server truth, never a composer pill** — so finding #5 (the toggle reading "Deep" mid-Harness-run) is killed *by construction*, because there is no pill left to mislabel. Closes the divergence documented in BRIEF §4.2 (a client `useState` in `ChatArea.tsx:68` that the mount-reconcile never feeds back to "harness").

## Design Decisions

### D1 — Collapse to a stable 2-pill composer (Winner A composer, D-092-UX)
The resting composer is exactly two pills: `[ openai/gpt-5.4 ▾ ]` + `[ General ▾ ]`, plus the textarea and Send. **Provider folds INTO Model** as one grouped dropdown (`MODEL_INFO` already supports grouping → **zero backend change**, BRIEF §4.4). This removes the old 4↔5-pill row jitter and the icon collision (`Layers` was used for both Provider and the picker).

### D2 — Launch LEAVES the composer; Deep is the resting default
The Deep/Harness toggle and the workflow picker are **removed from the composer entirely**. **Deep is the resting default** = `threads.active_workflow_run_id IS NULL` (the locked decision in BRIEF §4.1: "Deep Mode" is the umbrella over BOTH General AND Explorer). You start a workflow from the **Workflows page** (`workflows-page.md`, sketch 012), which hands off INTO a thread and sets `active_workflow_run_id` — putting *that thread* into Harness. Two payoffs, both structural:
- **finding #5 dies** — no Deep/Harness pill exists, so there is nothing to mislabel during a run.
- **the silent-Deep-send risk dies** — there's no orphan picker, so the `kickoffWorkflowId` send-gate (BRIEF §4.3, "Harness-with-no-workflow" → silent Deep turn) can't fire.

### D3 — The 2×2 made legible: two different axes, not "four modes"
The old composer put four adjacent identical pills in one row, inviting a "four mutually-exclusive modes" misread. They are **two orthogonal axes** (BRIEF §4.1):
- **How it thinks** — General / Explorer = `agent_mode` (`"default" | "explorer"`), a **per-message** intent (client `useState` in `ChatArea.tsx`, sent as `agentMode` at `useMessages.ts:108`). **Stays in the composer.**
- **Free chat vs locked workflow** — Deep / Harness = `active_workflow_run_id`, a **run-scoped** commitment. **Not a toggle** — Deep = no workflow running, Harness = you launched one. **Leaves the composer.**

The sketch renders this as two `.axis-card`s (indigo `.deepaxis` / amber `.workaxis`) shown inline in the empty/rest thread so the distinction is taught where it's first encountered.

### D4 — A running workflow shows as a slim status chip + Cancel (Winner: Variant A)
While a workflow runs, a slim line sits ABOVE the disabled composer: `⚙ Harness · Literature review · phase 2/3 · Review · ⏹ Cancel`. The textarea is `.disabled` (placeholder "Workflow running — Cancel to type a new message") and Send becomes a red Stop (`.send-btn.stop`). Minimal presence — the **full** timeline lives in the panel (sketches 008/009, `unified-execution-surface.md`); the chip is just "running + stop."

- **Won over B (Composer → run bar):** B transforms the composer into a full progress bar (`phase 2/3 · 4 agents · 26 sources · Cancel`). Unmissable, but it **duplicates** the panel's progress AND its Cancel — two surfaces racing to be "the live thing" (the same two-copies-drift trap `chat-panel-seam.md` D2 avoids).
- **Won over C (Panel-owned, composer quiets):** C disables the composer to a pointer ("Running in workspace — follow along in the panel ▸") and puts mode + Cancel ONLY in the panel. Purest UNIFY, but **Cancel is hidden if the panel is collapsed to the rail** — and Cancel/Stop must be reachable where the user's attention is. A is safer because it does **not** depend on the panel being open; C is only acceptable IF we guarantee the panel is always at least a visible rail during a run (`panel-shell.md` D4 makes the rail always-present, so C is viable later — but A is the resilient default now).

### D5 — cap_paused Continue stays a THREAD card, never a composer control
When a run hits its step budget, Continue renders as an amber `.continue-card` ABOVE the composer (`Continue (2 left)`), so it reads as a **thread event, not a setting**. This matches the real placement (BRIEF §4.3 + 3.x): the live app gates it in `MessageItem.tsx` (`message.role==="assistant" && isLastAssistant && workflowLock?.capPaused`), amber `border-amber-400/30 bg-amber-400/10`, `continueRun(workflowLock.runId)`. The composer itself stays `.disabled` with placeholder "Paused at the step cap — Continue above to resume."

### D6 — ask_user is answered in the panel; the composer points, never accepts
On an `ask_user` pause the composer stays `.disabled` ("Paused — answer the question in the workspace panel ▸"). The composer is **never** the answer surface — the panel interrupt card is (BRIEF §4.3; pending by `tool_call_id` at `panel.py:103`, answered via `POST /runs/{id}/ask_user_response` at `runs.py:496`). This keeps the one-surface-per-job rule: input for free chat = composer; input for a paused run = panel.

## CSS Patterns

```css
/* D4 — run-status chip (Variant A winner): slim amber line above the composer.
   Amber = Harness / needs-you, per the LOCKED color language (BRIEF §3.x). */
.runchip { display: flex; align-items: center; gap: var(--space-2);
           padding: var(--space-2) var(--space-3); margin-bottom: var(--space-2);
           border-radius: var(--radius-md); background: var(--color-warning-dim);
           border: 1px solid hsl(38 92% 60% / .35); font-size: var(--text-sm); }
.runchip .rc-ico   { color: var(--color-warning); }
.runchip .rc-name  { color: var(--color-text); font-weight: 500; }
.runchip .rc-phase { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); }
.runchip .spacer   { flex: 1; }
.runchip .cancel   { font-size: var(--text-xs); color: var(--color-danger); cursor: pointer;
                     padding: 3px 8px; border-radius: var(--radius-sm);
                     border: 1px solid hsl(0 72% 51% / .35); }   /* Cancel stays where the cursor is */

/* D1 — the 2-pill row. The Model pill carries the folded provider as a dim mono prefix (.grp). */
.pill-row { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }
.pill { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs);
        padding: 5px var(--space-3); border-radius: var(--radius-full);
        border: 1px solid var(--color-border); background: var(--color-bg-elev1);
        color: var(--color-text-muted); cursor: pointer; transition: all var(--dur-fast); }
.pill:hover       { border-color: var(--color-primary-glow); color: var(--color-text); }
.pill .ic         { font-family: var(--font-mono); opacity: .8; }
.pill .grp        { font-family: var(--font-mono); font-size: 9px; color: var(--color-text-dim); margin-right: 2px; }
.pill.disabled    { opacity: .45; cursor: not-allowed; }   /* greyed during a run */
.pill-row .spacer { flex: 1; }

/* D4 — Send becomes a red Stop while a run is in flight (composer disabled-but-stoppable). */
.send-btn { width: 34px; height: 34px; border-radius: var(--radius-md);
            background: var(--color-primary); color: hsl(240 60% 8%); border: none;
            display: grid; place-items: center; cursor: pointer; font-size: 15px; }
.send-btn.disabled { background: var(--color-muted); color: var(--color-text-dim); cursor: not-allowed; }
.send-btn.stop     { background: var(--color-danger); color: #fff; }

/* D4 — textarea wrapper: focus glow in idle-Deep; dimmed when locked by a run. */
.ta-wrap          { border: 1px solid var(--color-border); border-radius: var(--radius-lg);
                    background: var(--color-surface); padding: var(--space-3);
                    transition: border-color var(--dur-fast); }
.ta-wrap.focus    { border-color: var(--color-primary-glow); }
.ta-wrap.disabled { opacity: .62; }

/* D5 — cap_paused Continue card: a THREAD card (amber), never a composer control. */
.continue-card { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3);
                 margin-bottom: var(--space-3); border: 1px solid hsl(38 92% 60% / .35);
                 background: var(--color-warning-dim); border-radius: var(--radius-md); }
.continue-card .cc-text       { flex: 1; font-size: var(--text-sm); color: var(--color-text); }
.continue-card .cc-text .mono { font-family: var(--font-mono); font-size: 10px;
                                color: var(--color-text-dim); display: block; margin-top: 2px; }
.continue-btn { font-size: var(--text-sm); font-weight: 600; padding: 7px var(--space-4);
                border-radius: var(--radius-md); background: var(--color-warning);
                color: hsl(240 60% 8%); border: none; cursor: pointer; }

/* D3 — the 2×2 axis-clarity callout: indigo = how-it-thinks, amber = free-chat-vs-workflow. */
.axes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3); }
.axis-card { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-3); }
.axis-card .ac-h        { font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
                          font-family: var(--font-mono); margin-bottom: 6px; }
.axis-card.deepaxis .ac-h { color: var(--color-primary); }   /* General/Explorer — per-message */
.axis-card.workaxis .ac-h { color: var(--color-warning); }   /* Deep/Harness — run-scoped */
.axis-card .ac-opts  { display: flex; gap: 6px; margin-bottom: 6px; }
.axis-card .ac-opt   { font-size: 11px; padding: 3px 8px; border-radius: var(--radius-full);
                       background: var(--color-muted); color: var(--color-text-muted); }
.axis-card .ac-desc  { font-size: 11px; color: var(--color-text-dim); line-height: 1.45; }
.axis-where          { font-family: var(--font-mono); font-size: 9px; color: var(--color-text-dim); margin-top: 6px; }
```

## HTML Structure

```html
<!-- idle-Deep (resting default): clean 2-pill composer, no mode toggle, no picker -->
<div class="ta-wrap focus">
  <textarea class="ta" rows="1" placeholder="Message…  (Deep is the resting default — just type)"></textarea>
  <div class="pill-row">
    <span class="pill" title="Provider folded into Model">
      <span class="ic">⌘</span><span class="grp">openai/</span>gpt-5.4 ▾</span>
    <span class="pill" title="How the agent thinks — a per-message axis">
      <span class="ic">⊙</span>General ▾</span>
    <span class="spacer"></span>
    <button class="send-btn">↑</button>
  </div>
</div>

<!-- running (Variant A): status chip above a disabled composer; Send → red Stop -->
<div class="runchip">
  <span class="rc-ico">⚙</span>
  <span class="rc-name">Harness · Literature review</span>
  <span class="rc-phase">phase 2/3 · Review</span>
  <span class="spacer"></span>
  <span class="cancel">⏹ Cancel</span>
</div>
<div class="ta-wrap disabled">
  <textarea class="ta" rows="1" placeholder="Workflow running — Cancel to type a new message" disabled></textarea>
  <div class="pill-row">
    <span class="pill disabled">…</span><span class="pill disabled">…</span>
    <span class="spacer"></span>
    <button class="send-btn stop" title="Cancel run">■</button>
  </div>
</div>

<!-- cap_paused: Continue is a THREAD card ABOVE the composer (D5), composer stays disabled -->
<div class="continue-card">
  <div class="cc-text">Reached the step-budget cap before finishing.
    <span class="mono">harness · literature_review · merge phase · cap_paused</span></div>
  <button class="continue-btn">Continue (2 left)</button>
</div>

<!-- D3: the 2×2 taught inline in the empty/rest thread -->
<div class="axes">
  <div class="axis-card deepaxis">
    <div class="ac-h">how it thinks</div>
    <div class="ac-opts"><span class="ac-opt">General</span><span class="ac-opt">Explorer</span></div>
    <div class="ac-desc">A per-message choice. Stays in the composer.</div>
    <div class="axis-where">agent_mode · sent per message</div>
  </div>
  <div class="axis-card workaxis">
    <div class="ac-h">free chat vs locked workflow</div>
    <div class="ac-opts"><span class="ac-opt">Deep</span><span class="ac-opt">Harness</span></div>
    <div class="ac-desc">Not a toggle. Deep = no workflow running. Harness = you launched one (Workflows page).</div>
    <div class="axis-where">active_workflow_run_id · run-scoped</div>
  </div>
</div>
```

## Implementation Notes

- **Owner surface:** the composer is `frontend/src/components/chat/MessageInput.tsx` driven by `ChatArea.tsx`. The finding #5 root is precise (BRIEF §4.2): `ChatArea.tsx:115-122` runs `setWorkflowMode("deep")` unconditionally on every thread switch, and the mount reconcile (`:153-179`) reads true server state but only calls `setWorkflowLockForThread/clearWorkflowLockForThread` — it **never** sets `workflowMode` back to `"harness"`. The build delta (BRIEF §4.4(b)/(c)) is to **delete** `workflowMode`/`onWorkflowModeChange`/picker props from `MessageInput` and decouple `kickoffWorkflowId`-on-send into a page/panel-driven launch. The General/Explorer pill stays — it's a real per-message Deep axis (`agentMode`).
- **Zero backend change for D1/D2:** Provider→Model grouping uses existing `MODEL_INFO` grouping. Mode is already server-derived: `GET /threads/{id}/workflow` (`threads.py:1592`, handler `:1659`) returns `mode`, `locked` (`:1660`), and `lock_is_stale` (`:1666`, anchor set but run terminal → self-heal). The composer should consume `workflowLocked = workflowLock !== null` (`ChatArea.tsx:83-84`, from `useWorkflowLockForThread` at `StreamsProvider.tsx:2132`) and STOP holding any client mode of its own.
- **The chip's data:** the run-status chip points at the same run state the panel renders (`unified-execution-surface.md`). Be honest about what's on the wire (BRIEF §3): `phase_started` (`engine:676`) carries `{phase, phase_index, phase_type}` but is **wire-only — dropped by api.ts** (no branch in `frontend/src/lib/api.ts`, ~lines 485–657). So is `gate_failed{phase, attempt, error}` (`:522`), `run_failed{reason}` (`:708`), and `phase_transition`. The chip's `phase 2/3` text must be fed by rendering those currently-dropped events — the same spinner-killer work sketch 008 owns. **`gate_passed` is audit-only** (`:497`, never on the wire) — infer "passed" from the phase advancing, never from a gate event.
- **RC-4 honesty:** a failed run currently emits a terminal `done` sentinel with empty content (`run_workflow` returns normally after `run_failed`). Key the chip's failure state off `run_failed`/`gate_failed`, **NOT** the terminal sentinel. Empty `error` → explicit "Failure reason not captured", never an empty chip.
- **Launch path (BRIEF §4.5):** today the only launch primitive is send-with-kickoff in `POST /threads/{id}/messages` (`threads.py:766`) → `create_workflow_run(...)` (`:988`) atomically sets `active_workflow_run_id` and seeds `inputs.kickoff_prompt` (SEED-047). The Workflows page (012) hands off INTO a thread (create/open + redirect) — workflows are **a mode of a thread, not a separate route** (locked constraint). `continue_run` (`runs.py:667`) is resume-only, NOT a launch path.
- **G-5 hot files:** `MessageItem.tsx` is on the G-5 hot-file ledger — the cap_paused Continue card already lives there and is NOT re-touched by this work (it stays as-is). The composer simplification is a **deletion** of props from `MessageInput.tsx` plus removing client mode state from `ChatArea.tsx`, not new rendering on a hot file. Sub-agent internal tool events fire on the **sub-agent stream**, not the producer stream (`task_service:574` emits `sub_agent_start` on the producer; api.ts renders ghost avatars, no live drill-down) — the chip must not promise per-sub-agent detail.

## What to Avoid

- **Any Deep/Harness pill in the composer** — the entire finding #5 class returns the moment a client-held mode label can disagree with server truth. Mode = server-derived (`active_workflow_run_id`), shown in the panel chip, never a composer toggle.
- **A picker that can orphan-launch** — the "Harness-with-no-workflow → silent Deep send" trap (BRIEF §4.3). Removing the picker removes the trap; do not re-add a "pick workflow" composer affordance whose absence silently downgrades a send to a Deep turn.
- **Variant B's duplicated progress** — turning the composer into a full progress bar (`4 agents · 26 sources`) duplicates the panel's progress AND Cancel, creating two live surfaces that drift. The chip is a pointer + Stop, not a second timeline.
- **Variant C's hidden Cancel** — putting Cancel only in the panel means it vanishes when the panel is railed. Cancel/Stop must be reachable at the composer where attention is. (C becomes acceptable only if the rail is guaranteed always-present per `panel-shell.md` D4 — but A is the resilient default.)
- **cap_paused / ask_user as composer controls** — Continue is a thread card; ask_user is answered in the panel. The composer points to these, never hosts them — otherwise a run-resume reads as a "setting" and the input-surface-per-job rule breaks.
- **Inferring a passed gate from a wire event** — `gate_passed` is audit-only. Showing "✓ gate passed" from a non-existent wire event is a fake signal; advance the chip's phase from `phase_transition`/next `phase_started` instead.

## Origin

Synthesized from sketch **011 (winner A — Status chip + Cancel)**. Source: `sources/011-mode-and-composer/index.html`. Re-feel it with the **state cycler** (top-right): `Rest · Deep` → `Harness running` → `cap_paused` → `ask_user`; toggle **"show OLD composer"** to see the before — 5 pills + the finding-#5 bug (`Deep ▾ ← says "Deep" while a workflow runs`) and the orphan-launch picker — under the new 2-pill composer; flip the variant tabs (A/B/C) to compare the chip vs run-bar vs panel-quiet handling of a running workflow. Feeds **Phase 094** (mode legibility + composer simplification, D-092-UX) and rides the same dropped-wire-events fix as sketch 008/`unified-execution-surface.md`. Cross-links: `workflows-page.md` (012 — where launch moves to, putting the thread into Harness) and `unified-execution-surface.md` (the full run state the chip points at).
