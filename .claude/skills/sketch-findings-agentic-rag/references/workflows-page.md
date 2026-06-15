# Workflows Page — Library & Launcher

Workflows get a **first-class nav page** (like Skills) where you browse the available automations, see each one's full locked phase chain at a glance, and **Run**. The load-bearing idea: the page *only launches* — Run creates a NEW chat thread, sets `active_workflow_run_id`, and **redirects you into that thread** with the workflow already streaming in the panel. Workflows are **a mode of a thread, never page-resident**, so execution reuses the existing run/stream/lock/resume plumbing instead of inventing a page-local runner. Build NOW renders existing `workflow_definitions` via `GET /workflows/published` — zero new backend.

## Design Decisions

### D1 — Workflows are a first-class nav page (build now, no new backend)
The composer's workflow-picker dropdown (011) **leaves**; workflows get their own page in the left nav between Chats and Documents (`.nav-item.active` = Workflows). The page is browse + launch only. It renders the existing `workflow_definitions` rows through `GET /workflows/published` — there is **no new backend** for this surface. The NL "Build new" authoring path is designed in 013 and built in v2.9; here it's only an entry-point card so the page is coherent.

### D2 — Card grid (Winner A) over master-detail and compact list
Every workflow is a **`.wf-card`** showing icon, name, source tag, one-line purpose, the **full phase chain inline** (`.chain` of `.ph` nodes with `→` arrows), the input it collects, and **View / Run** — plus a dashed **`.build-card`** ("Build a workflow", → 013). All phase chains are visible without a click.

- **Won over B (Master-detail):** a left list + right detail pane **hides the phase chain until you select** a workflow. That earns its keep only once the library is large; for a small library (4 seeds + a few authored) it adds a click and hides the most legible thing.
- **Won over C (Compact list):** full-width rows that expand inline (`.cl-row.open`) are dense and good for many workflows, but **less visual** — you scan text, not the shape of each automation.
- **Why A wins:** for a small library, seeing every workflow's phase chain at a glance is the most legible, and it matches the **Skills-page feel the operator asked for**. When the library grows, A **gains search/filter** (the `.wf-toolbar` is already in the winner) rather than switching layouts. The launch handoff — the part that matters most — is identical across all three, so the layout choice is purely about scannability.

### D3 — The launch handoff: Run → dialog → land-in-thread (identical in every variant)
This is the key flow and it does not vary by layout. **Run** opens a **`.modal`** launch dialog that collects exactly two things: the **kickoff input** (the workflow's own labelled field — `topics` / `your question` / `the task`, marked `<span class="req">*</span>`) and the **KB folder scope** (`.field-select` folder picker). Confirm → creates a **NEW chat thread**, sets `active_workflow_run_id`, fires the success **`.redirect-toast`** ("✓ Opened new thread — workflow running"), and **redirects into that thread** with the workflow already streaming in the panel. The modal foot says it plainly: *"Run opens a new chat thread and streams there."*

### D4 — Workflows are a mode of a thread, never page-resident
Execution **always lives in a thread** — the page never runs a workflow in place. This reuses the existing run/stream/lock/resume plumbing wholesale (Redis run buffer, SSE, composer lock, resume-on-reconnect). The **lowest-cost backend path** reuses `POST /threads/{id}/messages` with a `workflow_definition_id` attached; a thin `POST /workflows/{id}/run` is a cleaner future option but not required to ship. The shell literally re-grids on handoff — page mode is `220px 1fr`, thread mode is `52px 1fr clamp(320px,32%,420px)` (nav collapses to a rail, the workspace panel appears).

### D5 — The landed thread renders the ALREADY-CHOSEN designs, not a new one
012 contributes **only the page** (library + launch dialog). The thread you Run *into* is not a 012 invention — it renders the designs already settled in earlier sketches: **008-D** (phase-timeline spine + RunCards in the panel) · **009-C** (the quiet chat seam — user prompt + `.livestatus` "Running in workspace" pointer) · **011-A** (the composer locked to a `.t-runchip` status chip). The mockup's step-3 view is built from those real classes (`.spine`, `.sp-card`, `.livestatus`, `.tcomposer`) with a `.reuse-note` calling it out, so the handoff reads as visually continuous, not a throwaway mini-view.

### D6 — Real seed content + a source-tag taxonomy
Cards carry the **4 real seed workflows** with their actual phase types, tool whitelists, and the input each collects (see Implementation Notes for the table). Each card has a **`.scope-tag`** marking provenance: `seed` / `published` / `draft` / `shared` (and a `global` variant). Seeds and published are success-green, drafts amber, shared violet — so at a glance you can tell what's a built-in vs. your own work-in-progress vs. an org-shared workflow. Phase nodes are color-coded by **phase type** via a left border (`t-prog` / `t-single` / `t-agent` / `t-batch` / `t-human`), the same five harness phase types from Phase 091.

## CSS Patterns

```css
/* D4 — the shell re-grids on handoff: page mode → thread mode */
.shell { display: grid; grid-template-columns: 220px 1fr; height: calc(100vh - 52px); overflow: hidden; }
.shell.in-thread { grid-template-columns: 52px 1fr clamp(320px,32%,420px); } /* nav→rail + panel appears */

/* D2 — the card grid + the winning card */
.wf-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
.wf-card { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface);
           padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);
           transition: all var(--dur-fast) var(--ease-out); }
.wf-card:hover { border-color: var(--color-primary-glow); box-shadow: var(--shadow-md); }
.wf-icon { width: 36px; height: 36px; border-radius: var(--radius-md); display: grid; place-items: center;
           font-size: 16px; flex-shrink: 0; background: var(--color-primary-dim); color: var(--color-primary); }
.wf-foot { display: flex; align-items: center; gap: var(--space-3); margin-top: auto;
           padding-top: var(--space-2); border-top: 1px solid var(--color-border-soft); }

/* D2 — the dashed "Build a workflow" card → hands off to 013 (v2.9) */
.build-card { border: 1px dashed var(--color-border); border-radius: var(--radius-lg); background: transparent;
              padding: var(--space-4); display: flex; flex-direction: column; align-items: center;
              justify-content: center; gap: var(--space-2); text-align: center; min-height: 180px; }
.v29-pill { font-family: var(--font-mono); font-size: 9px; padding: 1px 6px; border-radius: var(--radius-full);
            background: var(--color-accent-violet); color: #fff; }

/* D6 — phase chain (mini), color-coded by the 5 harness phase types via left border */
.chain { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.chain .ph { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border-radius: var(--radius-sm);
             background: var(--color-muted); border: 1px solid var(--color-border-soft); font-size: 11px; }
.chain .ph .pt { font-family: var(--font-mono); font-size: 8.5px; color: var(--color-text-dim); text-transform: uppercase; }
.chain .arrow { color: var(--color-text-dim); font-size: 10px; }
.chain .ph.t-prog   { border-left: 2px solid var(--color-text-dim); }       /* programmatic */
.chain .ph.t-single { border-left: 2px solid var(--color-primary); }        /* llm_single   */
.chain .ph.t-agent  { border-left: 2px solid var(--color-success); }        /* llm_agent    */
.chain .ph.t-batch  { border-left: 2px solid var(--color-accent-violet); }  /* llm_batch_agents */
.chain .ph.t-human  { border-left: 2px solid var(--color-warning); }        /* llm_human_input  */
.tool-chip { font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);
             border: 1px solid var(--color-border-soft); padding: 1px 5px; border-radius: var(--radius-sm); }

/* D6 — source-tag taxonomy: provenance color coding */
.scope-tag { font-family: var(--font-mono); font-size: 9px; padding: 1px 6px; border-radius: var(--radius-full);
             border: 1px solid var(--color-border-soft); color: var(--color-text-dim); }
.scope-tag.seed,
.scope-tag.global    { color: var(--color-success); border-color: hsl(142 71% 45% / .4); }
.scope-tag.draft     { color: var(--color-warning); border-color: hsl(38 92% 60% / .4); }
.scope-tag.published { color: var(--color-primary); border-color: var(--color-primary-glow); }
.scope-tag.shared    { color: var(--color-accent-violet); border-color: hsl(258 90% 66% / .4); }

/* D2 — search/filter toolbar (already present in the winner; the "grow without switching layout" hedge) */
.wf-toolbar { display: flex; align-items: center; gap: var(--space-3); margin: var(--space-5) 0 var(--space-4); }
.wf-search  { flex: 1; max-width: 380px; display: flex; align-items: center; gap: var(--space-2);
              background: var(--color-surface); border: 1px solid var(--color-border);
              border-radius: var(--radius-md); padding: 8px var(--space-3); }
.wf-filter      { font-size: var(--text-xs); padding: 6px var(--space-3); border-radius: var(--radius-full);
                  border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);
                  cursor: pointer; transition: all var(--dur-fast); }
.wf-filter.on   { background: var(--color-primary-dim); color: var(--color-primary); border-color: var(--color-primary-glow); }

/* D3 — the run buttons: Run is warning-amber (the harness/run color), View is ghost */
.run-btn  { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); font-weight: 600;
            padding: 7px var(--space-4); border-radius: var(--radius-md);
            background: var(--color-warning); color: hsl(240 60% 8%); border: none; cursor: pointer; }
.run-btn:hover { filter: brightness(1.08); }
.view-btn { font-size: var(--text-sm); padding: 7px var(--space-3); border-radius: var(--radius-md);
            background: transparent; color: var(--color-text-muted); border: 1px solid var(--color-border); cursor: pointer; }

/* D3 — the launch dialog */
.modal-backdrop { position: fixed; inset: 0; z-index: 9000; background: rgba(3,5,12,.66); backdrop-filter: blur(3px);
                  display: none; place-items: center; padding: var(--space-6); }
.modal-backdrop.open { display: grid; animation: fadeSlideUp var(--dur-base) var(--ease-out); }
.modal { width: min(560px, 92%); background: var(--color-surface); border: 1px solid var(--color-border);
         border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden; }
.field-input { width: 100%; background: var(--color-bg); border: 1px solid var(--color-border);
               border-radius: var(--radius-md); padding: var(--space-3); color: var(--color-text);
               font-family: inherit; font-size: var(--text-sm); resize: vertical; }
.field-label .req { color: var(--color-warning); }   /* the required-input asterisk */

/* D3 — success toast on redirect into the new thread */
.redirect-toast { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 9500;
                  background: var(--color-success-dim); border: 1px solid hsl(142 71% 45% / .4);
                  color: var(--color-success); padding: 8px var(--space-4); border-radius: var(--radius-full);
                  box-shadow: var(--shadow-md); display: none; }
.redirect-toast.show { display: block; animation: fadeSlideUp var(--dur-base) var(--ease-out); }
```

## HTML Structure

```html
<!-- D2 — the page: head + toolbar + grid, A (winner) -->
<div class="page">
  <div class="page-head">
    <h1>Workflows</h1>
    <span class="sub">Repeatable, locked automations — pick one and Run.</span>
    <button class="build-new">＋ Build new</button>           <!-- → 013 NL builder (v2.9) -->
  </div>
  <div class="wf-toolbar">
    <div class="wf-search"><span>🔎</span><input placeholder="Search workflows…"></div>
    <div class="wf-filters">
      <button class="wf-filter on" data-f="all">All</button>
      <button class="wf-filter" data-f="seed">Seed</button>
      <button class="wf-filter" data-f="yours">Yours</button>
      <button class="wf-filter" data-f="shared">Shared</button>
    </div>
  </div>
  <div class="section-label">7 workflows</div>
  <div class="wf-grid">
    <!-- one .wf-card per workflow -->
    <div class="wf-card">
      <div class="wf-top">
        <div class="wf-icon">📚</div>
        <div style="flex:1"><div class="wf-name">Literature review</div></div>
        <div class="wf-tags"><span class="scope-tag seed">seed</span></div>
      </div>
      <div class="wf-purpose">Split a topic into subtopics, review each in parallel, merge into one integrated, cited review.</div>
      <div class="chain">
        <span class="ph t-prog"><span>Split</span><span class="pt">server</span></span>
        <span class="arrow">→</span>
        <span class="ph t-batch"><span>Review</span><span class="pt">parallel</span></span>
        <span class="arrow">→</span>
        <span class="ph t-single"><span>Merge</span><span class="pt">AI write</span></span>
      </div>
      <div class="wf-foot">
        <span class="wf-input-hint">needs <span class="mono">topics to review</span></span>
        <button class="view-btn" onclick="openLaunch('b3')">View</button>
        <button class="run-btn"  onclick="openLaunch('b3')">▶ Run</button>
      </div>
    </div>
    <!-- … other cards … -->
    <div class="build-card">                                   <!-- → 013, v2.9 -->
      <div class="bc-icon">＋</div>
      <div class="bc-title">Build a workflow</div>
      <div class="bc-sub">Describe it in plain English → AI drafts it</div>
      <span class="v29-pill">v2.9 · sketch 013</span>
    </div>
  </div>
</div>

<!-- D3 — the launch dialog: collects kickoff input + KB scope, redirects into a thread -->
<div class="modal-backdrop open">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head"><span class="wf-icon">📚</span><span class="mh-name">Literature review</span><span class="close">✕</span></div>
    <div class="modal-body">
      <div class="chain"><!-- full phase chain, big variant with tool chips --></div>
      <div>
        <label class="field-label">Topics to review <span class="req">*</span></label>
        <textarea class="field-input" rows="2">leadership style; organizational culture; employee engagement</textarea>
      </div>
      <div>
        <label class="field-label">Knowledge base scope</label>
        <div class="field-select">📁 DBA · Fahed Mrad Chapters 1-4 (843 chunks) ▾</div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="hint">Run opens a <b>new chat thread</b> and streams there.</span>
      <button class="view-btn">Cancel</button>
      <button class="run-btn">▶ Run workflow</button>
    </div>
  </div>
</div>
```

## Implementation Notes

- **Surface owner & zero-backend posture.** This is a NEW page component (a Workflows route alongside the Skills page), NOT a touch of any G-5 hot file — it stays off `threads.py`, `ToolCallPanel.tsx`, `MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`, `anthropic_service.py`. It renders `workflow_definitions` rows fetched via `GET /workflows/published` — **no new backend for the library**. The launch path reuses the **existing send endpoint** (`POST /threads/{id}/messages` with `workflow_definition_id` attached) per D4; the thin `POST /workflows/{id}/run` is a documented future cleanup, not required to ship.
- **The 4 real seed workflows** (BRIEF §3 / Phase 091 seeds) the cards must render verbatim — phase types + tool whitelists + the input each collects:

  | Workflow | Phase chain (type) | Tool whitelists | Collects at launch |
  |---|---|---|---|
  | **Literature review** | Split (`programmatic`) → Review (`llm_batch_agents`) → Merge (`llm_single`) | Review: `search_documents` | `topics` |
  | **Research → Summarize** | Research (`llm_agent`) → Summarize (`llm_single`) | Research: `search_documents`, `web_search` | `your question` |
  | **Plan → Execute → Verify** | Plan (`llm_single`) → Execute (`llm_agent`) → Verify (`llm_single`) | Execute: `search_documents`, `execute_code` | `the task` |
  | **Doc Q&A** | Draft (`llm_agent`) → Confirm (`llm_human_input`) → Finalize (`llm_single`) | Draft: `search_documents` | `your question` |

  (The mockup also shows non-seed examples — `Contract clause review` draft, `RFP response draft` published, `Onboarding packet` shared — only to exercise the `.scope-tag` taxonomy; the 4 seeds above are the real shipped content.)
- **The five phase types are the harness's** (Phase 091): `programmatic` / `llm_single` / `llm_agent` / `llm_batch_agents` / `llm_human_input`, mapped to `t-prog`/`t-single`/`t-agent`/`t-batch`/`t-human` left-border colors. Keep this mapping in sync with whatever the harness emits so a card's chain matches what the panel later shows.
- **Handoff honesty (documented limits).** The landed thread reuses the same run/stream plumbing, with its documented edges: a `llm_batch_agents` phase fans out to **sub-agents whose internal tool events fire on the SUB-AGENT stream, not the producer/workflow_run stream** — the panel's parallel RunCard shows per-agent progress, but don't expect sub-agent tool calls on the producer SSE. `gate_passed` events between phases are **audit-only** (they record a gate cleared; they are not a render trigger). The id the page sets is `active_workflow_run_id` on the thread — mind the Phase 092 F4 distinction between `producer_run_id` and the `workflow_run` id when wiring the redirect.
- **Consistency contract (D5).** The thread step renders **008-D + 009-C + 011-A** verbatim (see `references/composer-and-mode.md` for the 011-A composer-lock state). Do NOT invent a new in-thread workflow view here; 012's only new pixels are the page and the launch dialog.
- **Grow-by-search, not by-layout (D2).** The `.wf-toolbar` (search + `all`/`seed`/`yours`/`shared` filters + `.wf-count` + `.wf-empty`) is already in the winner, so the library can scale to dozens of authored workflows without switching to master-detail. The dashed `.build-card` only renders under the `all` / `yours` filters.
- Feeds **Phase 094** (workflow legibility / mode clarity) and the **v2.9** NL-authoring milestone (the "Build new" → 013 handoff). SEED-051 (NL→workflow authoring vision) is the downstream consumer of the builder card.

## What to Avoid

- **Running on the page.** Do NOT render a workflow's live execution inside the Workflows page. Workflows are a mode of a thread (D4) — a page-resident runner would duplicate the run/stream/lock/resume plumbing and create a second "live thing" the user has to reconcile with the real thread. The page only *launches*.
- **A new in-thread design (rejected).** The landed thread must render the already-chosen 008-D / 009-C / 011-A. Inventing a 012-specific thread view re-litigates settled sketches and makes the handoff feel like a different app. The `.reuse-note` exists to make this explicit.
- **Master-detail / compact-list as the default (rejected B / C).** B hides every phase chain behind a selection click; C reduces each workflow to a text row. For the small seed-sized library both lose the at-a-glance legibility that is the whole point — defer them to a "library got large" future, and even then prefer adding search/filter to A.
- **A bespoke `POST /workflows/{id}/run` before it's needed.** The lowest-cost path reuses the existing message-send endpoint. A dedicated run endpoint is cleaner *later* — adding it now is backend scope this surface explicitly doesn't need.
- **Phase-type / tool-whitelist drift.** Cards that show a phase chain or tool chips not matching what the harness actually runs will read as a lie the moment the thread streams. Source the chain + whitelists from the same `workflow_definitions` row the harness executes, never a hand-maintained copy.
- **Pretending sub-agent tool calls stream on the producer.** A `llm_batch_agents` card implies parallelism; don't promise per-sub-agent tool-call detail on the producer stream that the plumbing doesn't deliver (it lives on the sub-agent streams). Show phase-level / per-agent progress, not invented tool rows.

## Origin
Synthesized from sketch 012 (winner **A — Card grid**). Source: `sources/012-workflows-page/index.html`. Re-feel it with the **flow cycler** (bottom-right toolbar): `1 · Browse → 2 · Launch dialog → 3 · In thread`, or click any **Run** button to walk the real path; the **variant tabs** (top) switch page layout A/B/C while the launch handoff stays identical. The step-3 "In thread" view is built from the real 008-D/009-C/011-A classes so the handoff reads as continuous. Feeds **Phase 094** (workflow legibility) and the **v2.9** NL-authoring milestone via the "Build a workflow" card.

Cross-links:
- [`composer-and-mode.md`](composer-and-mode.md) — 011: the launch leaving the composer dropdown is *why* this page exists; the landed thread's composer lock is 011-A.
- [`workflow-builder.md`](workflow-builder.md) — 013: the "Build a workflow" card hands off here (NL authoring, v2.9).
