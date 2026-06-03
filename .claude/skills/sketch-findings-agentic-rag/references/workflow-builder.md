# Workflow Builder — NL Authoring (v2.9 design-ahead)

You **build a workflow by describing it**: you tell the assistant what recurring task to automate (and upload a template); a strong model — grounded in your KB + tool registry + the template — **proposes the whole workflow** (inputs, phases, tools, KB scope) as a **read-mostly diagram that streams in live**, you refine **by talking** (not wiring), it's lint-checked, then **published as a locked, versioned** definition. The load-bearing constraint, from the operator: **NO drag-canvas** ("the squeezed dead middle") — editing is talk + form-tweak + approve, never connect-the-dots. This is the "+ Build a workflow" card from the Workflows page (012) brought to life — the **SEED-051** vision, **DESIGN NOW / BUILD v2.9** (spike validates NL→draft + KB-grounded template-fill before the `inputs`/`assets` schema is committed).

## Design Decisions

### D1 — Talk-led layout: conversation rail LEFT, live diagram RIGHT (Winner A)
A two-column split: a **380px conversation rail on the left** (the primary surface — you steer here) and the **live phase-card diagram on the right** (`1fr`, the artifact the AI draws). This best expresses "steered by talking, not wiring" and is the most natural shape for the HITL "AI heavy-lifts, you approve" model — the thing you act on (talk) is primary, the thing you approve (the diagram) is the subordinate output.

- **Won over B (Diagram-hero):** diagram center / talk as a bottom bar / inspector on the right reads as "editing a doc with an AI helper" — talk feels *secondary*, which inverts the whole "build by talking" premise.
- **Won over C (Three-pane):** talk + diagram + inspector all permanently visible is the most powerful but the *densest*, and risks exactly the over-engineering the operator warned against for this calm vision. C's inspector is valuable but belongs in a **click-to-open drawer, not a permanent third pane** (the `inspectorHTML()` content survives as that drawer's body).

### D2 — Read-mostly diagram that updates LIVE — never a drag-canvas
The diagram is a **vertical, spine-connected list of phase cards** (`<ol class="flow">`) that the AI populates. During the **Drafting** stage cards **stream in** (`.pcard.new` fade-slide animation) with a trailing `.drafting-row` "proposing the next phase…" pulser; there is **no connect-the-dots gesture anywhere**. You approve / tweak / replace **per card** (`.pcard-actions`) or just talk. The hard "no" is a node-and-edge drag-canvas — the diagram reflects the conversation, it is not directly manipulated by mouse-wiring.

### D3 — Real building blocks only: the 5 phase types + tool whitelist + optional gate + KB scope
Every card is one of the **5 real phase types** the harness actually supports — `llm_agent`, `llm_single`, `llm_human_input`, `programmatic`, `llm_batch_agents` — each with a color-coded `.ptype` badge (`pt-agent` / `pt-single` / `pt-human` / `pt-prog` / `pt-batch`), a **tool whitelist** (`.tchip` chips), an **optional gate**, and an **optional KB-folder scope**. **No invented node types.** Editing a phase = pick from those 5 types + a tool whitelist + a gate, surfaced verbatim in the inspector ("Editing = pick from the 5 real phase types + tool whitelist + gate. No invented node types.").

### D4 — Inferred inputs + grounding, LOCKED ON PUBLISH
The inputs strip shows **AI-derived inputs** ("Inputs the AI inferred — collected each run") for review/edit. This is SEED-051's **"dynamic at design time, fixed at run time"**: while drafting/refining the chips carry edit affordances (`✎`, `＋ add input`); on publish they flip to **🔒 locked**. The lint badge proves the draft is well-formed — **`✓ lint clean — reachable · terminal · inputs satisfied`** — and gates publish (it reads `lint · waiting for a draft` in the Describe stage with the publish button `.disabled`).

### D5 — Publish freezes an immutable v1; edits FORK a v2 draft
Publish → an immutable **v1**. The published note states it verbatim: *"Published as v1 — immutable & locked (mirrors migration 056 `UNIQUE(slug,version)` + on-publish trigger). Future edits fork a new draft (v2); the locked v1 never mutates."* In the Published stage the header shows `🔒 Published · v1` and the talk rail offers to "start a v2 draft." **Editing never mutates the locked version** — it forks. The published definition is then **run from the Workflows page (012)** — the builder is a hand-off, not an executor.

### D6 — Per-phase, OPTIONAL KB scope = production folder picker (combobox + tree popup)
Only **searching phases** (those whose whitelist includes `search_documents`) show a `📁 scope: … ▾` chip; non-searching phases show **no scope control at all** (`scope` is `''`). A click-to-cycle chip is an anti-pattern at scale (demo data = ~109 nested folders), so the chip opens a **production picker**: an **ARIA combobox** (`role="combobox" aria-expanded="true"`) over a browsable folder **tree** (`role="listbox"`) with **checkboxes (multi-select)**, **"Whole knowledge base" as the checked default** (empty selection = whole KB = optional), a **Recent** group, breadcrumb **paths when searching** (so three different "NDAs" folders disambiguate: `Legal › Contracts › NDAs` vs `Sales › Closed › NDAs` vs `Archive › NDAs`), tri-state checkboxes (`on` ✓ / `part` – for a partially-selected subtree), and a selected-chips footer with Clear / Done. The chip label collapses to `"Whole knowledge base"` or `"<first> +N"`.

### D7 — Inputs (run-time) vs Assets (authoring-time) split — answers "where do I upload the template?"
The inputs strip splits two distinct concepts: **Inputs** ("collected each run" — the run-time values like `topic`) and **Assets** ("uploaded here, owned by the workflow" — authoring-time files like `section-template.docx`) with an explicit **`⬆ Upload template / form`** button (`.upload-btn`, dashed violet). Assets are Storage-backed **workflow assets** (SEED-051), attached at authoring and used at run time. The `template` input chip is styled distinctly (`.input-chip.template`, violet border). Both freeze (`🔒`) on publish.

## CSS Patterns

```css
/* D1 — Talk-led split: conversation LEFT (380px), live diagram RIGHT (1fr).
   (vB/vC grids retained here only to show what A won over.) */
.body-area    { display: grid; height: calc(100vh - 52px - 53px); overflow: hidden; }
.body-area.vA { grid-template-columns: 380px 1fr; }                 /* ★ winner */
.body-area.vB { grid-template-rows: 1fr auto; grid-template-columns: 1fr 300px; }
.body-area.vC { grid-template-columns: 320px 1fr 300px; }           /* C → drawer, not 3rd pane */

/* D1 — the talk rail (primary surface) */
.talk        { display: flex; flex-direction: column; border-right: 1px solid var(--color-border);
               background: var(--color-bg-elev1); overflow: hidden; }
.talk-scroll { flex: 1; overflow-y: auto; padding: var(--space-4);
               display: flex; flex-direction: column; gap: var(--space-3); }
.msg.user    { align-self: flex-end; max-width: 88%; background: var(--color-primary-dim);
               border: 1px solid var(--color-primary-glow); padding: var(--space-2) var(--space-3);
               border-radius: var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md); }
.msg.ai .bot { width: 24px; height: 24px; border-radius: 50%;
               background: linear-gradient(135deg, var(--color-primary), var(--color-accent-violet)); }
.msg.ai.thinking .bot { animation: brandPulse 1.5s infinite; }     /* AI "proposing…" */

/* D2 — vertical spine + read-mostly phase cards (NOT a drag-canvas) */
.flow            { list-style: none; margin: 0; padding: 0; }
.flow > li       { position: relative; padding-left: 30px; padding-bottom: var(--space-3); }
.flow > li::before { content:''; position:absolute; left:10px; top:34px; bottom:-4px;
                     width:2px; background: var(--color-border-soft); }  /* the spine */
.flow > li:last-child::before { display:none; }
.flow-node       { position:absolute; left:0; top:12px; width:20px; height:20px; border-radius:50%;
                   display:grid; place-items:center; font-size:10px; background: hsl(220 30% 7%);
                   border:1.5px solid var(--color-border); color: var(--color-text-dim); z-index:1; }
.pcard           { border: 1px solid var(--color-border); border-radius: var(--radius-md);
                   background: var(--color-surface); padding: var(--space-3);
                   transition: all var(--dur-base) var(--ease-out); }
.pcard.new       { animation: fadeSlideUp var(--dur-slow) var(--ease-out);  /* D2 — streams in */
                   border-color: var(--color-primary-glow); }
.pcard.locked    { background: var(--color-bg-elev1); }                     /* D5 — published */

/* D2 — "proposing the next phase…" while drafting */
.drafting-row        { display:flex; align-items:center; gap:var(--space-2); margin-left:30px;
                       padding:var(--space-2); color: var(--color-text-dim); font-size:12px; }
.drafting-row .dots i{ width:5px; height:5px; border-radius:50%; background:var(--color-primary);
                       animation:dotBounce 1.2s infinite; }
.drafting-row .dots i:nth-child(2){animation-delay:.15s}
.drafting-row .dots i:nth-child(3){animation-delay:.3s}

/* D3 — the 5 REAL phase-type badges (one class per harness type) */
.ptype     { font-family: var(--font-mono); font-size: 9px; padding: 1px 6px;
             border-radius: var(--radius-sm); text-transform: uppercase; }
.pt-agent  { background: var(--color-success-dim); color: var(--color-success); }  /* llm_agent */
.pt-single { background: var(--color-primary-dim);  color: var(--color-primary); }  /* llm_single */
.pt-human  { background: var(--color-warning-dim);  color: var(--color-warning); }  /* llm_human_input */
.pt-prog   { background: var(--color-muted);        color: var(--color-text-muted); } /* programmatic */
.pt-batch  { background: hsl(258 90% 66% / .15);    color: var(--color-accent-violet); } /* llm_batch_agents */
.tchip     { font-family: var(--font-mono); font-size: 9px; color: var(--color-text-muted);
             border: 1px solid var(--color-border-soft); padding: 1px 5px; border-radius: var(--radius-sm); }

/* D3/D2 — per-card actions: approve / tweak / replace (NOT drag handles) */
.pcard-actions   { display:flex; gap:6px; margin-top:var(--space-3); padding-top:var(--space-2);
                   border-top:1px solid var(--color-border-soft); }
.pact            { font-size:11px; padding:3px 9px; border-radius:var(--radius-sm); cursor:pointer;
                   border:1px solid var(--color-border); background:transparent; color:var(--color-text-muted); }
.pact.approve    { border-color: hsl(142 71% 45% / .4); color: var(--color-success); }
.pact.approve.on { background: var(--color-success-dim); }

/* D6 — per-phase scope chip (only on searching phases); `.none` = whole-KB default */
.scope-ctl      { display:inline-flex; align-items:center; gap:5px; font-size:10px; padding:2px 7px;
                  border-radius:var(--radius-sm); border:1px solid hsl(142 71% 45% / .35);
                  background:var(--color-success-dim); color:var(--color-success); cursor:pointer;
                  font-family:var(--font-mono); }
.scope-ctl.none { border-color:var(--color-border); background:var(--color-muted); color:var(--color-text-dim); }

/* D6 — production scope picker: combobox + tree popup over 100+ nested folders */
#scopeBackdrop  { position:fixed; inset:0; z-index:8000; }
#scopePop       { position:fixed; z-index:8001; width:360px; max-height:432px; display:flex;
                  flex-direction:column; background:var(--color-surface-hi);
                  border:1px solid var(--color-border); border-radius:var(--radius-lg);
                  box-shadow:var(--shadow-lg); overflow:hidden; }
.sp-search input{ flex:1; background:transparent; border:none; outline:none; color:var(--color-text);
                  font-family:inherit; font-size:var(--text-sm); }
.sp-row         { display:flex; align-items:center; gap:8px; padding:6px var(--space-3); cursor:pointer; font-size:12.5px; }
.sp-row:hover   { background:var(--color-accent); }
.sp-tri         { width:12px; color:var(--color-text-dim); font-size:9px;
                  transition:transform var(--dur-fast); flex-shrink:0; text-align:center; }
.sp-tri.open    { transform:rotate(90deg); }                       /* expanded subtree */
.sp-check       { width:16px; height:16px; border-radius:4px; border:1.5px solid var(--color-border);
                  display:grid; place-items:center; font-size:10px; flex-shrink:0;
                  color:#0b0b16; font-weight:700; }
.sp-check.on    { background:var(--color-primary); border-color:var(--color-primary); }       /* selected */
.sp-check.part  { background:var(--color-primary-dim); border-color:var(--color-primary);
                  color:var(--color-primary); }                                               /* tri-state */
.sp-path        { color:var(--color-text-dim); }                   /* breadcrumb when searching */
.sp-chip        { display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:2px 7px;
                  border-radius:var(--radius-full); background:var(--color-primary-dim);
                  color:var(--color-primary); border:1px solid var(--color-primary-glow); }

/* D4 — lint badge gates publish; D7 — Assets/upload affordances */
.lint-badge         { display:inline-flex; align-items:center; gap:6px; font-size:var(--text-xs);
                      padding:4px var(--space-3); border-radius:var(--radius-full);
                      background:var(--color-success-dim); color:var(--color-success);
                      border:1px solid hsl(142 71% 45% / .35); }
.lint-badge.pending { background:var(--color-muted); color:var(--color-text-dim); border-color:var(--color-border); }
.publish-btn        { font-size:var(--text-sm); font-weight:600; padding:7px var(--space-4);
                      border-radius:var(--radius-md); background:var(--color-primary);
                      color:hsl(240 60% 8%); border:none; cursor:pointer; }
.publish-btn.disabled { background:var(--color-muted); color:var(--color-text-dim); cursor:not-allowed; }
.input-chip.template{ border-color: hsl(258 90% 66% / .4); }       /* asset/template chip */
.upload-btn         { display:inline-flex; align-items:center; gap:6px; font-size:12px;
                      padding:6px var(--space-3); border-radius:var(--radius-md);
                      border:1px dashed var(--color-accent-violet); background:hsl(258 90% 66% / .08);
                      color:var(--color-accent-violet); cursor:pointer; }
```

## HTML Structure

```html
<!-- D1 — talk-led shell: header + 380px talk rail (left) | live diagram (right) -->
<div class="builder-head">
  <span class="bh-title">＋ Build a workflow</span><span class="v29">v2.9 vision</span>
  <span class="spacer"></span>
  <span class="lint-badge">✓ lint clean — reachable · terminal · inputs satisfied</span>  <!-- D4 -->
  <button class="publish-btn">Publish &amp; lock ▸</button>                                <!-- D5 -->
</div>
<div class="body-area vA">

  <!-- LEFT: conversation rail (primary surface — you steer here) -->
  <div class="talk">
    <div class="talk-scroll">
      <div class="talk-label">Build by talking — the AI heavy-lifts, you approve</div>
      <div class="msg user">Draft a workflow that writes a lit-review section from my KB + a Word
        template, then lets me review before it fills the template.</div>
      <div class="msg ai"><div class="bot"></div><div class="mt">Here's a 4-phase draft. Each phase
        uses only allowed tools and is lint-clean. Approve each, or tell me what to change.</div></div>
    </div>
    <div class="talk-composer">
      <textarea class="talk-input" rows="2"
        placeholder="Describe or refine — e.g. “add a web search step”…"></textarea>
      <div class="talk-hint">talk to edit — no wiring, no drag-canvas</div>           <!-- D2 -->
    </div>
  </div>

  <!-- RIGHT: read-mostly live diagram (the artifact the AI draws) -->
  <div class="diagram">

    <!-- D7 — inputs (run-time) vs assets (authoring-time) -->
    <div class="inputs-strip">
      <div class="is-h">⊙ Inputs the AI inferred — collected each run · review &amp; edit</div>
      <div class="input-chips">
        <span class="input-chip">topic <span class="ic-type">text</span> <span class="edit">✎</span></span>
        <span class="input-chip" style="border-style:dashed">＋ add input</span>
      </div>
      <div class="assets-h">📎 Assets — uploaded here, owned by the workflow</div>
      <div class="input-chips">
        <span class="input-chip template">section-template.docx <span class="ic-type">attached ✓</span>
          <span class="edit">replace</span></span>
        <label class="upload-btn">⬆ Upload template / form<input type="file" hidden></label>
      </div>
      <div class="grounding-row">📁 KB scope is set per phase below — optional.</div>
    </div>

    <!-- D2/D3 — vertical spine of REAL phase cards -->
    <ol class="flow">
      <li><span class="flow-node">1</span>
        <div class="pcard">
          <div class="pcard-top"><span class="p-name">Gather sources</span>
            <span class="ptype pt-agent">llm_agent</span></div>           <!-- D3: one of 5 real types -->
          <div class="p-note">Finds the relevant passages from your KB.</div>
          <div class="pcard-meta">
            <span class="tchip">search_documents</span>                    <!-- tool whitelist -->
            <span class="scope-ctl" onclick="openScopePicker(event)"        <!-- D6: searching phase only -->
              title="Choose KB folder scope (searchable)">📁 scope: Whole knowledge base ▾</span>
          </div>
          <div class="pcard-actions">                                       <!-- D2: approve/tweak/replace, not drag -->
            <span class="pact approve on">✓ approved</span>
            <span class="pact">✎ tweak</span><span class="pact">↻ replace</span>
          </div>
        </div></li>
      <!-- … more <li> phase cards … -->
      <!-- D2 — drafting tail while the AI streams the next card in -->
      <li><span class="flow-node">●</span>
        <div class="drafting-row"><span class="dots"><i></i><i></i><i></i></span>
          proposing the next phase…</div></li>
    </ol>

    <!-- D5 — published note (locked stage) -->
    <div class="published-note">✓ <b>Published as v1</b> — immutable &amp; locked (mirrors migration 056
      <span style="font-family:var(--font-mono)">UNIQUE(slug,version)</span> + on-publish trigger).
      Future edits fork a <b>new draft (v2)</b>; the locked v1 never mutates. Run it from the
      <b>Workflows page</b>.</div>
  </div>
</div>

<!-- D6 — scope picker popover (appended to body; ARIA combobox + tree listbox) -->
<div id="scopeBackdrop"></div>
<div id="scopePop">
  <div class="sp-search"><span>🔍</span>
    <input role="combobox" aria-expanded="true" aria-label="Knowledge base scope"
           placeholder="Search 109 folders…"></div>
  <div class="sp-body" role="listbox">
    <div class="sp-row sp-default"><span class="sp-check on">✓</span>
      <span class="sp-name">Whole knowledge base <span class="sp-hint">default · 109 folders</span></span></div>
    <div class="sp-group">Your folders</div>
    <div class="sp-row" style="padding-left:8px">
      <span class="sp-tri open">▸</span>
      <span class="sp-check part">–</span><span class="sp-name">Legal</span></div>
    <div class="sp-row" style="padding-left:24px">
      <span class="sp-tri-sp"></span>
      <span class="sp-check on">✓</span><span class="sp-name">Contracts</span></div>
    <!-- when searching: breadcrumb path disambiguates duplicate names -->
    <div class="sp-row"><span class="sp-check"></span>
      <span class="sp-name"><span class="sp-path">Sales › Closed › </span>NDAs</span></div>
  </div>
  <div class="sp-foot">
    <div class="sp-sel"><span class="sp-chip">Contracts <span class="x">✕</span></span></div>
    <div class="sp-actions"><button class="sp-clear">Clear</button><button class="sp-done">Done</button></div>
  </div>
</div>
```

## Implementation Notes

- **DESIGN NOW, BUILD v2.9 — spike-first.** This is the SEED-051 vision. The companion spike validates **NL→draft + KB-grounded template-fill** *before* the `inputs` / `assets` schema is committed. Sketched now only so the Workflows page (012) reads as coherent (the "+ Build a workflow" card lands somewhere real).
- **Real harness primitives only.** The 5 phase types (`llm_agent`, `llm_single`, `llm_human_input`, `programmatic`, `llm_batch_agents`) + tool whitelist + optional gate are the existing v2.8 harness building blocks (Phases 089–093) — the builder authors a definition out of them, it invents nothing. **`gate_passed` is audit-only** (it records that a gate cleared, it is not a re-runnable control surface), so the builder surfaces a gate as a property of a phase, not as an interactive checkpoint widget.
- **KB scope = real data source, new binding — NO migration, but not zero code** (researched 2026-06-04). Honest split (per the 094 DATA-CONTRACT M5): the folder **tree DATA is REAL** (the existing `GET /folders`, RLS-scoped + nested, shared with `search_documents`) and the **search-time filter is REAL** (`search_documents` already accepts `folder_ids[]` and auto-expands subtrees, so checking a folder = that folder + its whole subtree, which the backend already does). What's **net-new** is the per-phase **binding**: `folder_ids: list[str]` does **not** exist on any `PhaseConfig` today (run/thread-scoped only) — the DATA-CONTRACT flags it as an INVENTED field. **Build path: add `folder_ids: list[str]` to the phase config JSONB (no DB migration) + thread it into the sub-agent's `search_documents` call.** So: no migration and it reuses the live filter, but it IS a small backend code change — not literally zero. Default empty list = whole KB (the chip's `.none` state). Only `search_documents` phases render the scope chip; the picker can be prototyped against live folders now because the data source already exists.
- **Publish = lock + version, mirrors migration 056.** Publish freezes an immutable v1 (`UNIQUE(slug,version)` + the on-publish trigger from migration 056). Edits FORK a v2 draft — never mutate v1. The header/talk-rail "start a v2 draft" copy reflects this fork model.
- **Hand-off, not execution.** The builder authors the DEFINITION; the user **Runs** it from the Workflows page (012), which streams in a thread. Cross-link: [workflows-page.md](workflows-page.md).
- **Final-artifact download → SEE SEED-038** (artifacts unification, extended to the workflow dimension): the workspace panel FILES section is the single home for generated files. Documented backend gap (**093 finding #4**): workflow `execute_code` files **aren't threaded up to the producer stream yet** — and sub-agent internal tool events fire on the **sub-agent stream, not the producer stream**, so a `llm_batch_agents` phase's inner tool calls won't surface on the parent run buffer without explicit forwarding. The builder UI should not promise live inner-tool visibility for batch phases until that plumbing exists.
- **Stays OFF the G-5 hot files.** This is a brand-new surface (a Workflow Builder page), not a re-touch of `ToolCallPanel.tsx` / `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` / `threads.py` / `anthropic_service.py`. Keep it that way — the diagram, talk rail, and scope picker are new components; reuse the chat message primitives by composition, don't fork them.
- **Scope picker is ARIA-correct out of the gate:** search `<input role="combobox" aria-expanded>` over a `role="listbox"` tree; `aria-live="polite"` on the result-count line; tri-state checkboxes (`on` / `part` / off). Port this rigor — folder pickers over 100+ items are an a11y trap otherwise.

## What to Avoid

- **A drag-canvas / connect-the-dots editor.** This is the operator's explicit "no" ("the squeezed dead middle"). The diagram is **read-mostly** — populated by the AI, edited by talk + per-card approve/tweak/replace + form-tweak. No edge-drawing, no free node placement, no manual wiring gesture anywhere.
- **Diagram-as-hero (variant B).** Centering the diagram and demoting talk to a bottom bar makes it feel like "editing a doc with an AI helper" and inverts the premise — talk must stay primary.
- **A permanent three-pane inspector (variant C).** Talk + diagram + inspector all always-on is the densest layout and risks the over-engineering the operator warned against. Make the inspector a **click-to-open drawer**.
- **A click-to-cycle scope chip.** With ~100+ nested folders, cycling through scopes one tap at a time is unusable, and it can't disambiguate three different "NDAs" folders. Use the searchable combobox + tree picker with breadcrumb paths.
- **A scope control on non-searching phases.** A `programmatic` or pure `llm_single` phase has no KB to scope — rendering an inert scope chip there is noise. Only `search_documents` phases get the chip.
- **Inventing node types.** Anything outside the 5 real phase types is a fiction the harness can't run. The builder must constrain choices to the real registry.
- **Mutating a published version on edit.** Edits must FORK a v2 draft; the locked v1 is immutable (migration 056). Never edit-in-place.
- **Promising live inner-tool visibility for `llm_batch_agents`.** Sub-agent tool events fire on the sub-agent stream, not the producer stream (093 finding #4) — the builder must not imply the parent run will show them until the forwarding plumbing lands.

## Origin

Synthesized from sketch 013 (winner **A — Talk-led**). Source: `sources/013-workflow-builder/index.html`. To re-feel it: open the mockup and use the **Stage cycler** (top-right toolbar: `1 Describe → 2 Drafting → 3 Refine → 4 Published`) to watch phase cards stream in, the lint badge flip, inputs lock, and the published note appear; flip the **variant tabs** (A · Talk-led ★ / B · Diagram-hero / C · Three-pane) to see why A won; on a searching phase click the `📁 scope: … ▾` chip to drive the production folder picker (search, expand the tree, multi-select, see breadcrumb paths). Feeds **Phase 094** (mode legibility / Workflows surface) and the **v2.9 SEED-051** NL→workflow-authoring milestone (spike-first). Run authored workflows from [workflows-page.md](workflows-page.md) (012).
