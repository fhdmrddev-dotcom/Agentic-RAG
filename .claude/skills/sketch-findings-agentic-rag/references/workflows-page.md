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

---

## Phase 103 update — built Workflows page (sketch 021, winner A)

Sketch 021 (winner **A — Card grid + project filter rail**) is the **build target for Phase 103** and the document of record over 012. 012 designed the page as a flat published-only library that *launches*; 021 keeps that whole launch handoff verbatim and adds the four things 012 predates now that there's a *library you own*: a **project-folder filter rail**, a **Drafts & seeds shelf above Published**, a **per-card strictness-tier badge derived from the real gate set**, the **Tweak → NEW version** fork (never edit the frozen row), and an on-page **nav/redirect-map overlay** so the operator can *see* where every action lands. The load-bearing 012 truths hold unchanged: **workflows are a mode of a thread, never page-resident**, Run creates a new thread + redirects into it, and the only live backend is `GET /workflows/published` — so every draft-CRUD surface wears an honest **net-new** flag (MANIFEST decision 17; the v2.9 navigation contract is decision 19). Source: `.planning/sketches/021-workflows-page-and-nav-map/index.html`.

### Design Decisions (103 additions over 012)

#### D7 — A project-folder filter rail (the live `project_folder_id` filter)
The page is scoped by **project** via a left **`.proj-rail`** of `.proj-item` rows (`All projects` / each named project / `Unbound (no project)`), each with a live count. This is the actual `GET /workflows/published?project_folder_id=…` filter surfaced as UI, not a client-side veneer — picking a project re-queries. The rail is variant-A's home; **B and C deliver the same `project-filtered` clause through an inline `.proj-chips` strip** (same `setProject` binding) so no variant answers the project clause by inheriting A's rail. On A the rail sits in a `200px 1fr` inner grid beside the shelves; the page-level shell stays 012's `220px 1fr` (page) → `52px 1fr clamp(320px,32%,420px)` (thread).

#### D8 — A Drafts & seeds shelf ABOVE the Published section (calm two-shelf split)
Drafts and seeds (work-in-progress you can still shape) get their **own shelf above** the **Published** section (frozen, live-backed). The drafts shelf is the only place the dashed **`.build-card`** ("Build a workflow" → describe screen, sketch 018) lives. A **`.shelf-toggle`** (`Both` / `Drafts` / `Published`) lets you collapse to one shelf; the **search + tier filter toolbar starts collapsed** behind a `🔎 Search & filter` button (calm-default — the page reads clean at rest, depth one tap away, decision 12's "3-second read"). A **dismissible `.honesty-banner`** explains the draft-vs-published split once and then gets out of the way. The Drafts shelf header wears a **net-new list** chip; the Published header wears a **`GET /workflows/published`** live chip.

#### D9 — Per-card ESSENCE: name + source tag + phase-chain glyphs + `input_keys` + strictness-tier badge
Every `.wf-card` shows, top-to-bottom: **icon + name + `vN`**, the **`.tier` strictness badge + `.scope-tag` source tag** (top-right), a one-line purpose, the **`.chain`** of phase nodes (glyphs + type labels, color-coded by phase type via left border), and an **`.wf-input-hint`** reading `entry needs <input_keys>` (the actual entry `input_keys` array — `kickoff_prompt`, optionally `contract_file`, etc.), then the per-source action foot. This is the card's "essence" — you read what a workflow *is* and *needs* without a click. Source-tag taxonomy is 012's (`seed`/`draft`/`published`/`shared`); drafts also get a **dashed card border** (`.wf-card.is-draft`).

#### D10 — The strictness-tier badge is DERIVED from the real gate set, never a free-text label
STRICT 🔒 / MIDDLE ◐ / LOOSE ○ — and the glyph+label+token make it **non-color-alone**. The badge is a **function of the workflow's actual gate signature + `citation_policy` enum**, not a stored label: `deriveTier()` re-classifies from the gate set (`TIERS` is the single source of truth) so the badge **can never drift from the gates the card/detail actually shows**. The mapping uses **real vocab only** — no invented "level 1/2/3", no "compliance-mode":
- **STRICT** → `citations_required (deterministic)` + `output_file_valid` + `freshness` + `llm_judge_rubric`, `citation_policy = strict` (an uncited value is an honest fail, not delivered).
- **MIDDLE** → `citations_required (presence)` + `structure_check (loose)` + `llm_judge_rubric`, `citation_policy = flag` (uncited values delivered, marked `[unverified]`).
- **LOOSE** → no per-phase citation gate, `citation_policy = draft` (prepends a DRAFT label). The **always-on publish judge (QUAL-01) still grades it** — loose ≠ ungraded.
ⓘ popovers carry the plain-language caption; the master-detail (B) renders the derived tier's full `.gate-list` with the always-on judge row pinned (`QUAL-01 · can't be removed`).

#### D11 — Run-into-a-thread handoff: workflows are a MODE of a thread (012's D3/D4, kept verbatim)
Unchanged from 012 and re-affirmed: **Run** opens the `.modal` launch dialog (kickoff prompt — the entry `input_keys` — + the **project folder, already bound** via `project_folder_id ✓ bound`), confirm creates a **NEW chat thread in workflow mode**, fires the `.redirect-toast`, and **redirects into that thread** with the workflow streaming in the panel. Nothing runs on the page. The landed thread (`3 · In thread`) renders the **already-chosen winners — 008-D timeline spine + 009-C chat seam + 011-A locked composer** — with a `.reuse-note` calling it out; 021 invents no new in-thread view. Per decision 19 the run handoff **reuses `POST /threads/{id}/messages`** (same path as the composer's Harness pick).

#### D12 — Tweak → a NEW version, never an in-place edit of the frozen published row
Opening a published workflow is **read-only** (the `.ro-banner` says so). **Tweak (⑂)** opens the `.tweak-flow` modal showing `frozen vN → new draft v(N+1)`: the published row stays **frozen and immutable** (a DB trigger blocks updates once `status='published'`; every prior run keeps pointing at it), and Tweak **forks a new draft version into the Builder** (sketch 019). You re-publish through the gauntlet (sketch 020) to make it live — per-version immutability, never an edit in place. Per decision 19, **a draft cannot be Run directly** (publish's golden-run + judge IS the trial); Run appears only once published. (021's mockup shows a `▶ Test run` ghost button on drafts to exercise the launch path; the shipped contract is publish-gates-the-test — honor decision 19 over the mockup's draft-Run affordance.)

#### D13 — An on-page nav/redirect-map overlay (the operator-requested "Where things go")
A **`🗺️ Where things go`** header button (and a `🗺️ Map` toolbar button) opens the **`.map-overlay`**: the whole journey rail (`Workflows page → 018 build → 019 refine → 020 publish gauntlet → Run → thread/022`) plus a **row-per-action `.map-table`** of exactly where each element lands (Build → describe screen; Open draft → builder; Tweak → forks a new draft version; Card/row → detail pane; Publish → 8-stage gauntlet that can honestly BLOCK; Run → new thread reusing run/stream/lock/resume; Landed thread → workflow streams in the panel). Each row carries a destination chip color-coded by class (`thread`/`builder`/`pub`/`page`). The foot restates the honest seams. `Esc` closes it.

#### D14 — Honest net-new flags on draft CRUD (only `GET /workflows/published` is live)
The honesty is **encoded as UI badges**, not buried in a doc. The Published section + its endpoint chip are **live-green** (`GET /workflows/published`, owner-scoped via RLS + optional `project_folder_id`); `POST /workflows/{id}/publish` is the other live endpoint. Everything else — draft **create / list / update / single-GET / delete / unpublish**, the **`.nn` net-new chip** on the Drafts shelf header and the danger-delete card button, **and the "Workflows" nav entry itself** (a `.netnew` "NEW" badge — there's no `ActiveView 'workflows'` today) — is flagged net-new (violet). Per decision 19 the nav entry ships by extending the `ActiveView` union + a shared `NAV_ITEMS` const, deleting the dead AppDock, with a distinct icon (NOT Settings' gear).

### CSS Patterns (103 additions — see 012 for `.wf-card` / `.chain` / `.modal` / `.redirect-toast` base)

```css
/* D7 — project filter rail (A) + the inline chip-strip B/C use (same setProject binding) */
.proj-rail { display:flex; flex-direction:column; gap:2px; }
.proj-item { display:flex; align-items:center; gap:var(--space-2); padding:7px var(--space-3);
             border-radius:var(--radius-md); cursor:pointer; font-size:12.5px; color:var(--color-text-muted);
             border:1px solid transparent; transition:all var(--dur-fast); }
.proj-item.on { background:var(--color-primary-dim); color:var(--color-primary); border-color:var(--color-primary-glow); }
.proj-item .pi-c { font-family:var(--font-mono); font-size:9.5px; color:var(--color-text-dim); }  /* live count */
.proj-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }  /* B/C inline equivalent */

/* D8 — drafts shelf above published; calm shelf toggle + collapsed search */
.shelf-toggle { display:inline-flex; border:1px solid var(--color-border); border-radius:var(--radius-md); overflow:hidden; }
.shelf-toggle button.on { background:var(--color-primary-dim); color:var(--color-primary); }
.search-collapse { display:inline-flex; align-items:center; gap:6px; font-size:var(--text-xs);
                   padding:6px var(--space-3); border-radius:var(--radius-full);
                   border:1px solid var(--color-border); background:transparent; color:var(--color-text-muted); }
.wf-card.is-draft { border-style:dashed; }   /* drafts read as in-progress */
.honesty-banner { display:flex; align-items:flex-start; gap:var(--space-3); padding:var(--space-3) var(--space-4);
                  border-radius:var(--radius-md); background:hsl(258 90% 66% / .08);
                  border:1px solid hsl(258 90% 66% / .3); font-size:12px; color:var(--color-text-muted); }
.honesty-banner.hidden { display:none; }

/* D10 — strictness-tier badge: glyph + label + mono token = NON-color-alone (a11y), REAL vocab only */
.tier { display:inline-flex; align-items:center; gap:5px; font-size:9.5px; font-weight:600;
        font-family:var(--font-mono); text-transform:uppercase; letter-spacing:.05em;
        padding:2px 8px; border-radius:var(--radius-full); border:1px solid; cursor:help; }
.tier.strict { color:var(--color-warning); background:var(--color-warning-dim); border-color:hsl(38 92% 60% / .45); }
.tier.middle { color:var(--color-accent-violet); background:hsl(258 90% 66% / .12); border-color:hsl(258 90% 66% / .45); }
.tier.loose  { color:var(--color-text-muted); background:var(--color-muted); border-color:var(--color-border); }

/* D9 — the chain gains a 6th phase type: llm_emit ◆ (the deliverable phase, 101.1) */
.chain .ph.t-emit { border-left: 2px solid var(--color-primary); background:hsl(239 100% 82% / .07); }

/* D12 — tweak → new-version: frozen vN → new draft v(N+1), the published row stays immutable */
.tweak-diff .frozen-v .vbig { color:var(--color-success); }   /* frozen, published */
.tweak-diff .new-v    .vbig { color:var(--color-warning); }   /* the forked draft */
.tweak-note { font-size:12px; line-height:1.55; padding:var(--space-3); border-radius:var(--radius-md);
              background:var(--color-primary-dim); border:1px solid var(--color-primary-glow); }
.ro-banner { display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3);
             border-radius:var(--radius-md); background:var(--color-primary-dim);
             border:1px solid var(--color-primary-glow); }  /* "published, frozen — Tweak to change" */

/* D13 — nav/redirect-map overlay: journey rail + per-action destination table */
.map-journey { display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap; padding:var(--space-4);
               border-radius:var(--radius-lg); background:var(--color-bg-elev1); border:1px solid var(--color-border); }
.map-row { display:grid; grid-template-columns: 200px 24px 1fr 120px; align-items:center; gap:var(--space-3);
           padding:var(--space-3) var(--space-4); border-radius:var(--radius-md);
           background:var(--color-bg); border:1px solid var(--color-border-soft); }
.mr-sketch.thread  { color:var(--color-warning);       background:var(--color-warning-dim); }
.mr-sketch.builder { color:var(--color-accent-violet); background:hsl(258 90% 66% / .12); }
.mr-sketch.pub     { color:var(--color-primary);       background:var(--color-primary-dim); }

/* D14 — net-new (violet) vs live (green) endpoint flags — honesty as UI badges */
.nn { font-family:var(--font-mono); font-size:8px; font-weight:600; padding:1px 5px; border-radius:var(--radius-full);
      background:hsl(258 90% 66% / .15); color:var(--color-accent-violet); border:1px solid hsl(258 90% 66% / .35); cursor:help; }
.live-badge { font-family:var(--font-mono); font-size:8px; font-weight:600; padding:1px 5px; border-radius:var(--radius-full);
              background:var(--color-success-dim); color:var(--color-success); border:1px solid hsl(142 71% 45% / .35); cursor:help; }
.nav-item .netnew { /* the "Workflows" nav entry itself is net-new — no ActiveView 'workflows' today */
      font-family:var(--font-mono); font-size:7.5px; color:var(--color-accent-violet);
      background:hsl(258 90% 66% / .18); border:1px solid hsl(258 90% 66% / .4); padding:1px 5px; border-radius:var(--radius-full); }
```

### HTML Structures (103 additions)

```html
<!-- D7/D8 — variant A: project rail beside the two shelves, calm collapsed toolbar -->
<div class="page">
  <div class="page-head">
    <h1>Workflows</h1>
    <span class="sub">Repeatable, locked automations — author, publish, and Run into a thread.</span>
    <button class="mapbtn" onclick="toggleMap()">🗺️ Where things go</button>      <!-- D13 -->
    <button class="build-new" onclick="openBuilder('new')">＋ Build a workflow</button>  <!-- → 018 -->
  </div>
  <div class="honesty-banner">…drafts + published; published = live GET /workflows/published; draft CRUD is net-new…</div>
  <div style="display:grid;grid-template-columns:200px 1fr;gap:var(--space-6)">
    <div class="proj-rail"><p class="pr-label">Project</p>
      <div class="proj-item on"><span class="pi-ico">▦</span><span class="pi-n">All projects</span><span class="pi-c">6</span></div>
      <!-- … one .proj-item per project folder … -->
    </div>
    <div>
      <div class="wf-toolbar">
        <button class="search-collapse">🔎 Search &amp; filter</button>
        <div class="shelf-toggle"><button class="on">Both</button><button>Drafts</button><button>Published</button></div>
      </div>
      <div class="section-label">Drafts &amp; seeds · 2 <span class="nn">net-new list</span></div>
      <div class="wf-grid"><!-- draft .wf-card.is-draft … --><div class="build-card">…→ 018…</div></div>
      <div class="section-label">Published · 4 <span class="live-badge">GET /workflows/published</span></div>
      <div class="wf-grid"><!-- published .wf-card … --></div>
    </div>
  </div>
</div>

<!-- D9/D10 — a card's essence: name + tier badge + source tag + chain + input_keys -->
<div class="wf-card">
  <div class="wf-top"><div class="wf-icon">📄</div>
    <div style="flex:1"><div class="wf-name">Vendor-risk portfolio review <span class="wf-ver">v2</span></div></div>
    <div class="wf-tags">
      <span class="tier strict"><span class="tg">🔒</span>Strict</span>   <!-- DERIVED from the gate set -->
      <span class="scope-tag published">published</span>
    </div>
  </div>
  <div class="wf-purpose">Pull the latest vendor assessments, analyze each vendor, render the cited report.</div>
  <div class="chain">
    <span class="ph t-prog"><span class="pg">⚙</span><span>Pull assessments</span><span class="pt">server</span></span>
    <span class="arrow">→</span>
    <span class="ph t-agent"><span class="pg">🤖</span><span>Search folder</span><span class="pt">agent</span></span>
    <span class="arrow">→</span>
    <span class="ph t-batch"><span class="pg">⛓</span><span>Analyze each vendor</span><span class="pt">parallel</span></span>
    <span class="arrow">→</span>
    <span class="ph t-emit"><span class="pg">◆</span><span>Render report</span><span class="pt">deliverable</span></span>   <!-- 6th type -->
  </div>
  <span class="wf-input-hint">entry needs <span class="mono">kickoff_prompt</span></span>   <!-- the real input_keys -->
  <div class="wf-foot">
    <button class="icon-btn" onclick="openTweak('vrp')">⑂</button>   <!-- D12 Tweak → new version -->
    <button class="view-btn" onclick="viewDetail('vrp')">View</button>
    <button class="run-btn" onclick="openLaunch('vrp')">▶ Run</button>   <!-- D11 Run → thread -->
  </div>
</div>

<!-- D12 — Tweak modal: frozen vN → new draft v(N+1); the published row is never edited -->
<div class="modal tweak-flow">
  <div class="tweak-diff">
    <div class="tv frozen-v"><div class="vlabel">Frozen · published</div><div class="vbig">v2</div></div>
    <div class="tarrow">→</div>
    <div class="tv new-v"><div class="vlabel">New draft</div><div class="vbig">v3</div></div>
  </div>
  <div class="tweak-note">Published <b>v2</b> stays <b>frozen and immutable</b> — every prior run keeps pointing at it.
    This forks a <b>new draft v3</b> into the builder; re-publish through the gauntlet to make it live.</div>
</div>
```

### Implementation Notes (103)

- **Surface owner & G-5 posture (unchanged from 012).** Still a NEW page component (a Workflows route beside Skills), OFF every G-5 hot file (`threads.py`, `ToolCallPanel.tsx`, `MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`, `anthropic_service.py`). Published renders `workflow_definitions` via the live `GET /workflows/published`; per decision 19 the Run handoff reuses `POST /threads/{id}/messages` (the composer's Harness path) — no bespoke `POST /workflows/{id}/run` needed to ship.
- **The strictness tier is a pure derivation, keep it that way.** `deriveTier(w)` classifies STRICT/MIDDLE/LOOSE from `(citation_policy, gate signature)` with `TIERS` as the single source of truth, so a card / detail / compact-row can never show a tier that disagrees with its own gate list. Do NOT add a stored `strictness` column the badge reads from — the moment it diverges from the actual gates the badge is a lie. Vocab is locked to the real enum: STRICT/MIDDLE/LOOSE + `citation_policy` strict/flag/draft, mirroring SEED-082's emit-gate policy. No level 1/2/3, no "compliance-mode".
- **Six phase types now (not five).** 012 shipped five harness phase types; 021 adds **`llm_emit` ◆ "deliverable"** (`t-emit`, the 101/101.1 template-fill / emission phase) as the 6th. Chain glyphs are borrowed **verbatim from `PhaseCard.tsx`** for the original five; keep this mapping in sync with whatever the harness emits.
- **`input_keys` is the entry contract, rendered.** The card foot reads `entry needs <input_keys>` from the workflow's actual entry `input_keys` array (e.g. `kickoff_prompt`, optionally `contract_file`). This is what the launch modal then collects — don't hand-maintain a separate "Collects at launch" copy; source both from the same row.
- **Project filter is the real query, in every variant.** A's `.proj-rail` and B/C's `.proj-chips` both bind `setProject` → `GET /workflows/published?project_folder_id=…`. Don't let B/C answer the "project-filtered" clause by silently inheriting A's rail — they carry the inline chip-strip so the clause is visible and live wherever you are.
- **Honesty is encoded as badges (decision 17/19).** Live = green (`GET /workflows/published`, `POST /workflows/{id}/publish`); net-new = violet on the Drafts shelf header, delete-draft button, and the **Workflows nav entry** ("NEW" — no `ActiveView 'workflows'` yet). Per decision 19, ship the nav entry by extending the `ActiveView` union + a shared `NAV_ITEMS` const, deleting the dead AppDock, with a distinct (non-gear) icon. Surface SEED-082 at discuss-phase for the tier→gate policy.
- **Run-draft caveat — honor the contract, not the mockup.** The 021 mockup shows a `▶ Test run` ghost on drafts to exercise the launch path, but **decision 19 supersedes it: a draft cannot be Run directly** — the publish gauntlet's golden-run + judge IS the trial run, and Run appears only once published (protects QUAL-01). Build the contract: drafts get **Open ✎ (→ builder)** and **Publish… (→ gauntlet)**, not a Run.
- **Consistency contract (unchanged from 012's D5).** The landed thread renders **008-D + 009-C + 011-A** verbatim with the `.reuse-note`; 021 invents no in-thread view. See [`composer-and-mode.md`](composer-and-mode.md) for the 011-A composer-lock state.

### What to Avoid (103 additions — 012's avoids still apply)

- **A stored strictness label.** Never let the tier badge read a free-text/stored field — derive it from the gate set + `citation_policy` so it can't drift. A badge that disagrees with the gates below it is the worst kind of dishonest UI.
- **Invented strictness vocab.** No "level 1/2/3", no "compliance-mode", no star ratings. Only STRICT/MIDDLE/LOOSE mapped to the real gate set + the `citation_policy` strict/flag/draft enum.
- **Editing a published workflow in place.** Published rows are frozen + immutable (DB trigger). "Edit" is always **Tweak → fork a new version**; the frozen row is never touched so old runs keep resolving against the version they ran.
- **Running a draft directly (decision 19).** Don't wire a real Run on drafts — publish is the test. A draft-Run would bypass the golden-run + judge gauntlet and undermine QUAL-01.
- **Hiding the net-new seams.** Don't render draft CRUD or the Workflows nav entry as if they're live. The violet net-new badges are load-bearing honesty — only `GET /workflows/published` + `POST /workflows/{id}/publish` exist today.
- **B/C inheriting A's project rail silently.** The project filter must be visible and live in every variant (inline chip-strip in B/C), never an A-only affordance the other layouts quietly borrow.
- **Cluttering the calm default.** Search + tier filter start collapsed; the honesty banner is dismissible; shelves can collapse to one. Hold the "3-second read at rest" bar (decision 12) — depth one tap away, never up-front clutter.

### Origin (103)
Synthesized from sketch 021 (winner **A — Card grid + project filter rail**; MANIFEST decision 17, navigation contract decision 19). Source: `.planning/sketches/021-workflows-page-and-nav-map/index.html` + `README.md`. Re-feel it with the **flow toggle** (bottom-right): `0 · Load → 1 · Browse → 2 · Run dialog → 3 · In thread → ∅ · Empty`; the **variant tabs** switch A (rail + shelves) / B (master-detail with gate-list + version history) / C (compact rows) while the Run handoff and tier derivation stay identical; **🗺️ Map** opens the nav/redirect overlay; hover the tier badges + `net-new`/`GET /workflows/published` chips + ⓘ dots for the tiered-guidance popovers. **021 EXTENDS 012** — it does not replace the launch handoff, which is byte-for-byte 012's D3/D4 (008-D + 009-C + 011-A in-thread). Build target = **Phase 103** (Workflows page + NL authoring; G-2 sketch fired and is satisfied by this family 018→023). Sits in the 018→019→020→022→023 sketch journey: 018 describe, 019 refine, 020 publish gauntlet, 022 run surface, 023 navigation contract.

Cross-links (103):
- [`workflow-builder.md`](workflow-builder.md) — 018/019: "Build a workflow" + "Open draft" + "Tweak → new version" all land in the builder.
- 020 publish gauntlet — "Publish…" lands here; the gauntlet can honestly BLOCK (judge = hard wall).
- 022 run surface + 023 navigation contract — the landed thread (workflow = a mode of a thread) + the three-homes / publish-is-the-test loop that supersedes the mockup's draft-Run affordance.
