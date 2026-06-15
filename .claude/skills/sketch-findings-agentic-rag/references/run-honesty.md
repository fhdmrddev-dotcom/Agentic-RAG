# Run Honesty — Failures, Drafts, Batch, Provenance

The rule that a harness run must never lie about what it did. Three trust gaps from the 093 re-UAT (094 SC#6) share one root: the backend emits the truth on the wire, but `frontend/src/lib/api.ts` has no branch for it, so it's silently dropped. A `failed` run renders as an **empty `done` card** (RC-4 — `run_workflow` returns normally after `run_failed`, so the terminal sentinel is wrongly `done`); the draft you're asked to review is **never shown** (it's wire-only in `ask_user_prompt.draft`); and the 4 batch sub-results are invisible until the final merge. This file makes failures show as **failed-with-a-reason**, drafts **visible and labeled "not yet saved"**, intermediate results **individually readable**, and the harness answer **provenance-bearing** — all keyed off events the backend already emits.

## Design Decisions

### D1 — Placement: pin-while-active → fold (Winner C)
An attention-moment (a draft awaiting review, a failure) is **loud while it needs you** — a pinned card at the top of the panel, amber for a draft, red for a failure — then **folds back into the phase timeline as a record** once resolved. Same calm-loud lifecycle as sketch 006 (`ask_user` resolves in place) + 008-D (timeline as the durable record). The draft/failure *content is identical across all three variants* — only the placement differs.

- **Won over A (Inline in timeline):** rendering the draft/failure only inside its phase card on the spine is the one consistent place, nothing pinned — but on a long run the attention-moment can scroll out of view, and you miss the moment the run is blocked on you.
- **Won over B (Pinned at top, stays):** pinning loud and unmissable is right *while* it needs you, but a pin that never leaves accumulates **stale pinned cards** after they're resolved — the panel clutters with answered drafts and dead failures.

C takes B's loudness for the active moment and A's tidy record for the resolved moment. The fold is signalled in the pin itself: *"When you answer, this folds back into the 'Confirm' phase as a record (matches sketch 006 + 008)."*

### D2 — Failed-as-failed, with a reason and a taxonomy (RC-4)
A failure renders a **red `.fail-card`** that names *which* phase, *what* type, *why*, and *where* — never an empty success card. The type comes from a closed **failure taxonomy**, each with a reason string and a `where` provenance line:

| `fail-type` | Keyed off | Reason example | `where` |
|---|---|---|---|
| `max_steps` | sub-agent hit its step cap | "Sub-agent 'Employee engagement' reached its 12-step cap without a final answer." | `phase: review · sub-agent 3 · glm-4.6 · 12/12 steps` |
| `gate_failed` | terminal `gate_failed{attempt}`, `on_failure: fail_run` | "Validation gate 'output contains INTEGRATED' failed after 3 attempts; run halted." | `phase: review → gate · attempt 3/3` |
| `wall_clock_timeout` | phase wall-clock budget exceeded | "Phase exceeded its 180s wall-clock budget before completing." | `phase: review · 181s / 180s` |
| `reason_unknown` | `run_failed` with an **empty `error`** field | "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success." | `phase: review · error field was empty` |

The `reason_unknown` fallback is the load-bearing one: it **proves we never show an empty success again**. Even when the backend gives us nothing, we render an honest "reason not captured" failure rather than a blank `done` card.

- **Won over A/B placement, same as D1** — the *card* is identical; C pins it red while unresolved, then folds it into the failed phase row.

### D3 — Visible draft, labeled "not yet saved" (operator finding #2)
The drafted answer renders in a `.draft-block` **above** the question + chips, with a `.draft-label` reading `DRAFT · awaiting your review — not yet saved`. This is the exact finding-#2 fix: doc_qa pauses at "Does this draft answer your question?" but today the draft is wire-only — you're asked to review something you can't see. The "not yet saved" label means it can **never be mistaken for the final answer** (which lives in the full-width chat per sketch 009).

### D4 — Large drafts: preview in panel, opt-in `⤢` wide overlay (operator concern, 2026-06-04)
A 2,000-word draft does NOT belong crammed in a ~30% panel column. The split is by size:
- **Short draft** → renders fully inline in the panel (no friction).
- **Long draft** → the panel shows a **faded preview (CSS mask) + word count + `⤢ Review & edit full draft`**; clicking opens a **wide reading/editing overlay over the chat** (`min(760px, 88%)`, ~75 chars/line, `contenteditable`, Looks-good / Needs-changes footer). The review *action* stays anchored to the Confirm phase; only the *reading surface* widens.

This **reuses sketch 005's opt-in wide-overlay rule** (`file-browser-and-diff.md` D4) — *preview in panel, never auto-widen/cram*. It generalizes: the panel's job for any large content (draft, big sub-result, file) is **preview + open-wide**, not cram.

### D5 — Intermediate output: readable batch sub-results before merge
The 4 batch sub-agent results render as a `.batch-list` of click-to-expand rows (per-subtopic name · source count · summary), readable **before** the merge phase runs — the ghost-avatar fix taken further into real per-subtopic content. There is no aggregate count field on the wire, so the count and the list are **aggregated client-side** from the N `sub_agent_done.summary` values.

### D6 — Provenance answer card (parity with Deep tool-turns)
The completed harness answer gets a `.prov` RunCard — collapsed to `N phases · M tool calls · K sources · Ns`, expandable to the **phase timeline as the run record**. This gives the harness answer the same provenance treatment Deep tool-turns already get. In chat it surfaces only as a quiet pointer (`↳ ran in workspace · 3 phases · 16 tool calls · 48 sources · 18s ▸`), keeping the D-094-UNIFY contract: chat = prompt + final answer + quiet pointer; panel = execution legibility.

## CSS Patterns

```css
/* D3 — DRAFT block: the key fix. Labeled "not yet saved" so it
   can't be mistaken for the final answer. */
.draft-block  { border: 1px solid var(--color-border); border-radius: var(--radius-md);
                overflow: hidden; margin-bottom: var(--space-3); }
.draft-label  { display: flex; align-items: center; gap: 6px; font-size: 10px;
                text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-dim);
                padding: 6px var(--space-3); background: var(--color-muted);
                border-bottom: 1px solid var(--color-border-soft); }
.draft-label .tag { font-family: var(--font-mono); color: var(--color-warning); }  /* amber DRAFT tag */
.draft-text   { padding: var(--space-3); font-size: 12.5px; line-height: 1.6;
                color: var(--color-text); background: var(--color-bg);
                max-height: 180px; overflow-y: auto; }
.draft-text .cursor { color: var(--color-warning); }   /* streaming caret ▍ */

/* D4 — long-draft preview: faded mask + opt-in wide overlay (reuses sketch 005's rule) */
.draft-preview { position: relative; }
.draft-preview .draft-text { max-height: 132px; overflow: hidden;
                -webkit-mask-image: linear-gradient(180deg, #000 60%, transparent);
                        mask-image: linear-gradient(180deg, #000 60%, transparent); }
.draft-expand-row { display: flex; align-items: center; gap: var(--space-2);
                padding: var(--space-2) var(--space-3); border-top: 1px solid var(--color-border-soft);
                background: var(--color-muted); }
.draft-expand-row .wordcount { font-family: var(--font-mono); font-size: 10px;
                color: var(--color-text-dim); flex: 1; }
.expand-btn   { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs);
                padding: 5px var(--space-3); border-radius: var(--radius-sm);
                border: 1px solid var(--color-warning); color: var(--color-warning);
                background: var(--color-warning-dim); cursor: pointer; }
.expand-btn:hover { background: hsl(38 92% 60% / .22); }

/* D4 — wide reading/editing overlay (over the chat, NOT full screen; never auto-widens the panel) */
.overlay-backdrop { position: fixed; inset: 0; z-index: 9000; background: rgba(3,5,12,.66);
                backdrop-filter: blur(3px); display: none; place-items: center; padding: var(--space-6); }
.overlay-backdrop.open { display: grid; animation: fadeSlideUp var(--dur-base) var(--ease-out); }
.overlay-card { width: min(760px, 88%); max-height: 84vh; display: flex; flex-direction: column;
                background: var(--color-surface); border: 1px solid hsl(38 92% 60% / .4);
                border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden; }
.overlay-body { flex: 1; overflow-y: auto; padding: var(--space-6); font-size: 14.5px;
                line-height: 1.72; color: var(--color-text); outline: none; }   /* ~75 chars/line at 760px */
.overlay-body[contenteditable]:focus { box-shadow: inset 0 0 0 1px var(--color-primary-glow);
                border-radius: var(--radius-sm); }
.overlay-foot { border-top: 1px solid var(--color-border); padding: var(--space-3) var(--space-4);
                display: flex; align-items: center; gap: var(--space-3); background: var(--color-bg-elev1); }

/* D2 — failure card: red, names which/what/why/where. Never an empty card. */
.fail-card    { border: 1px solid hsl(0 72% 51% / .45); background: var(--color-danger-dim);
                border-radius: var(--radius-md); overflow: hidden; }
.fail-head    { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3);
                border-bottom: 1px solid hsl(0 72% 51% / .25); }
.fail-head .fh-title { font-weight: 600; font-size: var(--text-sm); color: hsl(0 80% 80%); flex: 1; }
.fail-type    { font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase;
                padding: 1px 6px; border-radius: var(--radius-sm); background: var(--color-danger); color: #fff; }
.fail-reason  { padding: var(--space-3); font-size: 12.5px; line-height: 1.6; color: hsl(0 80% 82%); }
.fail-reason .where { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-muted);
                display: block; margin-top: 6px; }   /* the provenance line */
.fail-taxonomy { display: flex; gap: 5px; flex-wrap: wrap; padding: var(--space-2) var(--space-3);
                border-top: 1px solid hsl(0 72% 51% / .2); }
.tax-chip     { font-family: var(--font-mono); font-size: 9px; padding: 1px 5px;
                border-radius: var(--radius-sm); border: 1px solid var(--color-border-soft);
                color: var(--color-text-dim); cursor: pointer; }
.tax-chip.on  { background: var(--color-danger-dim); color: hsl(0 80% 80%); border-color: hsl(0 72% 51% / .4); }

/* D5 — batch sub-results: click-to-expand, readable before merge */
.batch-list   { display: flex; flex-direction: column; gap: 6px; }
.batch-item   { border: 1px solid var(--color-border-soft); border-radius: var(--radius-sm); overflow: hidden; }
.batch-item-head { display: flex; align-items: center; gap: var(--space-2);
                padding: var(--space-2) var(--space-3); cursor: pointer; font-size: 12.5px; }
.batch-item-head .bi-name { flex: 1; font-weight: 500; }
.batch-item-head .bi-src  { font-family: var(--font-mono); font-size: 9.5px; color: var(--color-text-dim); }
.batch-item-body { display: none; padding: 0 var(--space-3) var(--space-3) 34px;
                font-size: 12px; color: var(--color-text-muted); line-height: 1.5; }
.batch-item.open .batch-item-body { display: block; }
.batch-item.open .caret { transform: rotate(90deg); }

/* D1 — pinned attention card (loud while active) + the fold note (signals it becomes a record) */
.pinned       { border-radius: var(--radius-md); margin-bottom: var(--space-4);
                overflow: hidden; box-shadow: var(--shadow-md); }
.pinned.amber { border: 1px solid hsl(38 92% 60% / .5); }   /* draft */
.pinned.red   { border: 1px solid hsl(0 72% 51% / .5); }    /* failure */
.pinned-head  { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3);
                font-size: 10px; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
.pinned.amber .pinned-head { background: var(--color-warning-dim); color: var(--color-warning); }
.pinned.red   .pinned-head { background: var(--color-danger-dim);  color: hsl(0 80% 80%); }
.pinned-head .pin-ico { animation: dotBounce 1.3s infinite; }
.pinned-body  { padding: var(--space-3); background: var(--color-surface); }
.fold-note    { font-size: 10px; color: var(--color-text-dim); padding: 6px var(--space-3);
                background: var(--color-muted); border-top: 1px dashed var(--color-border-soft); font-style: italic; }

/* D6 — provenance answer RunCard: collapsed counts, expandable to the timeline record */
.prov         { border-radius: var(--radius-lg); border: 1px solid var(--color-border);
                background: var(--color-surface); overflow: hidden; }
.prov-head    { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3); cursor: pointer; }
.prov-head .pv-sum { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-dim); }
.prov.open .caret { transform: rotate(90deg); }
.prov-body    { display: none; padding: var(--space-3); border-top: 1px solid var(--color-border-soft); }
.prov.open .prov-body { display: block; }

/* Chat-side honesty pointers (calm-loud cue → flashPanel) */
.chat-pointer.amber { color: var(--color-warning); background: var(--color-warning-dim);
                border: 1px solid hsl(38 92% 60% / .35); }
.chat-pointer.red   { color: hsl(0 80% 78%); background: var(--color-danger-dim);
                border: 1px solid hsl(0 72% 51% / .4); }
.chat-pointer .spark { width: 7px; height: 7px; border-radius: 50%; background: currentColor;
                animation: dotBounce 1.2s infinite; }
.composer-hint.locked { background: var(--color-warning-dim); border-color: hsl(38 92% 60% / .3);
                color: var(--color-warning); }   /* "🔒 Paused — answer in panel to continue" */
```

## HTML Structure

```html
<!-- D1+D3 — pinned draft (amber), loud while active, folds to record on answer -->
<div class="pinned amber">
  <div class="pinned-head"><span class="pin-ico">●</span> Needs you — draft review</div>
  <div class="pinned-body">
    <!-- D3: the draft, visible, ABOVE the question, labeled not-yet-saved -->
    <div class="draft-block">
      <div class="draft-label"><span class="tag">DRAFT</span> · awaiting your review — not yet saved</div>
      <div class="draft-text">Based on Chapters 1–4, the study sampled <b>200 participants</b>…
        <span class="cursor">▍</span></div>
    </div>
    <div class="ask-q">Does this draft answer your question? Add corrections before I finalize.</div>
    <div class="ask-chips"><span class="ask-chip primary">Looks good</span>
                           <span class="ask-chip">Needs changes</span></div>
    <textarea class="ask-free" rows="2" placeholder="Optional corrections…"></textarea>
  </div>
  <div class="fold-note">When you answer, this folds back into the "Confirm" phase as a record
    (matches sketch 006 + 008).</div>
</div>

<!-- D4 — LONG draft: faded preview in panel + opt-in wide overlay -->
<div class="draft-block draft-preview">
  <div class="draft-label"><span class="tag">DRAFT</span> · awaiting your review — not yet saved</div>
  <div class="draft-text"><p>…paragraph 1…</p><p>…paragraph 2…</p></div>
  <div class="draft-expand-row">
    <span class="wordcount">≈ 1,950 words · long draft</span>
    <span class="expand-btn" onclick="openDraftOverlay()">⤢ Review &amp; edit full draft</span>
  </div>
</div>

<div class="overlay-backdrop" id="draftOverlay">                <!-- over the chat, not full screen -->
  <div class="overlay-card" role="dialog" aria-modal="true" aria-label="Review draft">
    <div class="overlay-head"><span class="oh-tag">Draft · Confirm phase · not yet saved</span>
      <span class="oh-title">Review &amp; edit draft</span><span class="oh-close">✕</span></div>
    <div class="overlay-body" contenteditable="true" spellcheck="false">…full draft…</div>
    <div class="overlay-foot"><span class="of-q">Does this answer your question?</span>
      <span class="ask-chip primary">Looks good</span><span class="ask-chip">Needs changes</span></div>
  </div>
</div>

<!-- D2 — pinned failure (red): which / what / why / where + taxonomy -->
<div class="pinned red">
  <div class="pinned-head"><span class="pin-ico">▲</span> Run failed</div>
  <div class="pinned-body">
    <div class="fail-card">
      <div class="fail-head"><span class="st-ico st-fail">✕</span>
        <span class="fh-title">Run failed during Review</span>
        <span class="fail-type">max_steps</span></div>
      <div class="fail-reason">Sub-agent "Employee engagement" reached its 12-step cap without a final answer.
        <span class="where">phase: review · sub-agent 3 · glm-4.6 · 12/12 steps</span></div>
      <div class="fail-taxonomy">
        <span class="tax-chip on">max_steps</span><span class="tax-chip">gate_failed</span>
        <span class="tax-chip">wall_clock_timeout</span><span class="tax-chip">reason_unknown</span>
      </div>
    </div>
  </div>
</div>

<!-- D5 — batch sub-results, readable before merge -->
<div class="batch-list">
  <div class="batch-item">                                    <!-- toggle .open on click -->
    <div class="batch-item-head"><span class="st-ico st-done">✓</span>
      <span class="bi-name">Leadership style</span><span class="bi-src">14 src</span>
      <span class="caret">▸</span></div>
    <div class="batch-item-body">Transformational leadership is the most consistently reported correlate…</div>
  </div>
  <!-- × N sub-agents (count aggregated client-side; no aggregate field on the wire) -->
</div>

<!-- D6 — provenance answer card; expand to the phase timeline as the run record -->
<div class="prov open">
  <div class="prov-head"><span class="st-ico st-done">✓</span>
    <span class="pv-name">Literature review</span>
    <span class="pv-sum">3 phases · 16 tool calls · 48 sources · 18s</span>
    <span class="caret">▸</span></div>
  <div class="prov-body"><!-- the phase timeline (008-D) rendered as the durable record --></div>
</div>

<!-- Chat-side: quiet honesty pointers (D-094-UNIFY — chat stays calm) -->
<div class="chat-pointer amber"><span class="spark"></span> Needs your review in workspace ▸</div>
<div class="composer-hint locked">🔒 Paused — answer in the workspace panel to continue</div>
<div class="chat-pointer red">✕ Run failed · see reason in workspace ▸</div>
```

## Implementation Notes

- **Every honesty event is wire-only today.** The backend emits on the `run:{run_id}` Redis stream (producer `_emit` at `threads.py:144` / `harness_engine.py:105`); `frontend/src/lib/api.ts` (branches ~485–657) has **no branch** for them, so they're silently dropped. The fix is rendering, not backend — this is **zero backend change** for D2/D3/D5/D6.
- **RC-4 root cause:** `run_failed` (`harness_engine.py:708`) fires, but `run_workflow` returns *normally* afterward, so the outer producer-shell `_terminal_status` stays `"completed"` and emits a terminal `done` with empty content. **Key failure off `run_failed` / terminal `gate_failed`, NOT the `done` sentinel** (which is wrongly `done` on failure). When `run_failed.reason` (the `error` field) is empty → render the `reason_unknown` taxonomy chip, never an empty card.
- **Failure taxonomy sources (D2):** `gate_failed{phase, attempt: int, error: str}` is emitted on the wire **every attempt** (`engine:522`); the `error` is either the validator message or `"wall_clock_timeout after Ns"`. `gate_passed` is **audit-only — never on the wire** (`engine:497`); infer a passed gate from the phase advancing (`phase_transition` / next `phase_started`), not from a gate event.
- **Draft path (D3/D4):** the draft exists ONLY inside `ask_user_prompt.draft` (`phase_types:481`) and is persisted in `messages.tool_calls.draft` (`phase_types:457`) — there is no standalone draft output event. Render the visible draft from this field; on reload, source it from the persisted `tool_calls.draft` (mind STATE.md's Phase 086 note that snapshot/messages endpoints filter `role='system'` rows).
- **Batch aggregation (D5):** the 4 results come from N `sub_agent_done{sub_run_id, status, summary}` events on the **producer stream** (`task_service:876`). There is **no aggregate count field** — the "4 agents · 48 src" count is derived client-side by counting the `sub_agent_done` events. **Honest limit:** a sub-agent's internal `tool_start`/`tool_end` fire on the *sub-agent's own* stream `run:{sub_run_id}`, NOT the producer stream — the harness engine emits no tool events of its own. So a batch row can show the summary but not a live tool drill-down without subscribing to each sub-stream.
- **Provenance card (D6):** counts come from the phase lifecycle events the timeline already needs — `phase_started{phase, phase_index, phase_type}` (`engine:676`), `phase_completed`, `phase_transition` (`engine:773`). The expanded body reuses the 008-D timeline component (`harness-phase-timeline.md`).
- **Isolation contract (PANEL-06 / D-094-UNIFY):** chat selectors (`useThreadMessages`) read `bucketsBySurface` exclusively; a panel-Map mutation never changes a chat bucket ref, so **chat never re-renders on panel honesty events**. Render the draft/failure/batch/provenance into the panel; chat gets only the quiet `.chat-pointer` + locked `.composer-hint`.
- **Keep OFF the G-5 hot files where possible.** These are new panel renderers (draft block, fail card, batch list, prov card, wide overlay), not re-touches of `MessageItem`/`ToolCallPanel`/`StreamsProvider` internals. The shared work with 008 is the api.ts branch additions for the dropped wire events — coordinate so both sketches add the same branches once.
- **Generated-files limit (honest):** `execute_code` artifacts (`final_output_files`, `workspace_file_written`, `code_execution_complete`) fire on the sub-agent stream and are never threaded up to the harness producer stream, so workflow-produced files don't appear in the panel today — out of scope for this surface (SEED-037/SEED-038 territory).

## What to Avoid

- **Empty success on failure (RC-4)** — a failed run rendering as a blank `done` card because the renderer trusts the terminal sentinel. The whole reason D2 exists. Always key off `run_failed`/`gate_failed`; the `reason_unknown` fallback is mandatory so even a backend that gives us nothing never shows empty success.
- **Inviting review of an invisible draft (finding #2)** — "Does this draft answer your question?" with no draft on screen. The draft must render above the question, labeled "not yet saved."
- **Draft mistaken for the final answer** — a draft that looks like the saved answer. The `DRAFT · not yet saved` label + amber framing keep it distinct from the full-width chat answer (sketch 009).
- **Cramming a 2k-word draft into the 30% column** — the operator's explicit concern. Long drafts get a faded preview + opt-in `⤢` wide overlay; never auto-widen the panel (that reflows the chat and fights the calm-instrument promise — same rule as `file-browser-and-diff.md` D4).
- **Stale pinned cards (variant B)** — an attention pin that never leaves, so answered drafts and dead failures pile up at the top. C folds them into the timeline record once resolved.
- **Losing the moment on a long run (variant A)** — a draft/failure rendered only inline on the spine that scrolls out of view while the run is blocked on you. C pins it loud until resolved.
- **Faking a batch aggregate** — inventing a "4 of 4 agents" field that doesn't exist on the wire. Derive the count from the `sub_agent_done` events; don't claim a backend field we don't have.
- **Claiming live sub-agent tool detail on the producer stream** — sub-agent `tool_start`/`tool_end` are on the sub-stream, not the producer. Show the summary; don't fabricate a drill-down the producer stream can't supply.
- **Inferring a gate pass from a wire event** — `gate_passed` is audit-only and never on the wire. Infer "passed" from the phase advancing.

## Origin

Synthesized from sketch 010 (winner **C — Pin-while-active → fold (+ long-draft opt-in wide overlay)**). Source: `sources/010-honesty-and-drafts/index.html`. To re-feel it: the bottom-right **scenario cycler** toggles `Draft to review · Batch results · Failed run · Answer card`; in the Failed scenario click the **taxonomy chips** (`max_steps / gate_failed / wall_clock_timeout / reason_unknown`) to see each failure type including the "reason not captured" fallback; the **draft size** toggle (`Short | Long ~2k`) switches inline-render vs faded-preview + `⤢` wide overlay; the variant tabs (A/B/C) move where the attention-moment lives. Feeds **Phase 094 SC#6** (closes the three 093 re-UAT trust gaps: RC-4 failed-as-failed, finding-#2 visible draft, intermediate output). Cross-links:

- [pending-question.md](pending-question.md) — sketch 006 calm-loud `ask_user` lifecycle (the pin that resolves in place; this file adds the *content* shown inside it).
- [file-browser-and-diff.md](file-browser-and-diff.md) — sketch 005 opt-in `⤢` wide-overlay rule, reused here for long drafts (preview in panel, never auto-widen).
- [harness-phase-timeline.md](harness-phase-timeline.md) — sketch 008-D timeline; where resolved drafts/failures fold to record, and the body of the D6 provenance card.
