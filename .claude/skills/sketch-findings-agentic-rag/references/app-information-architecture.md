# App Information Architecture — the v2.9 Workflow Studio Navigation Contract

The single authoritative wiring diagram for how the new Workflow Studio surfaces (Workflows page, Builder, Publish gauntlet, Run-in-thread) attach to the *existing* Agentic-RAG app navigation. The load-bearing truth: **there is no router and no URL** — the whole app is one flat `useState<ActiveView>` union in `App.tsx`. Every "redirect" is a `setActiveView` view-switch, an intra-page state change, a modal, or a **create-thread-then-switch**. A workflow is **a mode of a thread, never page-resident**. This file is the IA reference you consult when building ANY of 018–022; **all 11 open decisions (OD-1..OD-11) were ADOPTED by the operator on 2026-06-14** ("publish is the test"), so this is the locked contract, not a list of open questions.

## Design Decisions

### D1 — The THREE HOMES rule (one home per concern; every edge respects the split)
The whole IA reduces to three homes, and *every* redirect honors the split. This is the spine of the contract.

| Concern | Home | Surface | Why it lives here |
|---|---|---|---|
| **Authoring** (create / draft / refine / publish a definition) | **the Builder** (018→019→020) | a sub-surface reached *from* the Workflows page | Hand-off, not execution — the builder authors the definition and has **NO Run/execute affordance**. 018/019 expose only Publish / Continue. |
| **Library + Launch** (browse / filter / own / tweak / kick off) | **the Workflows page** (a NET-NEW `ActiveView`, peer of Skills) | a first-class non-chat `<main>` view | The catalog *and* the launchpad. It **only launches** — Run opens a thread; execution never happens on the page. |
| **Execution** (the bounded run, streaming, pause, deliverable) | **a Chat thread** (022) | the existing Chat view + WorkspacePanel, flipped to Harness mode | Reuses the proven run / stream / lock / resume plumbing. The deliverable lands in the panel FILES section (the single artifacts home, SEED-038). |

⚠ **CLARIFIED 2026-09-22 (Phase 262 / D-262-01 / BUS-303) — "THREE HOMES" IS A CONCERN TRIAD, NOT A COUNT OF NAV ENTRIES, and the table above is left exactly as written because it never said otherwise.** The rule is about the WORKFLOW concern — Authoring / Library+Launch / Execution — and it is unchanged by the rail growing. It has been read as a cap on top-level views, which it is not: `NAV_ITEMS` already carried **seven** entries before Phase 262, and the rail already rendered two further affordances (the probe-gated operator shield and the Spend entry) from outside the array. Phase 262 adds the **eighth `NAV_ITEMS` entry** — the Expert catalog — making it the **tenth rail affordance**. ⛔ *"three homes → four"* is neither of those numbers, and a register corrected with a wrong number is the rot repeating.

### D2 — Authoring = the Builder: ONE continuous route, two stages, with a ← Workflows breadcrumb + draft auto-save (OD-2, OD-3, OD-4)
The Builder is **one URL-less surface with two stages** (018 describe → 019 refine), NOT two routes. The 018→019 handoff fires automatically once the draft is grounded AND all grey-area confirms are cleared; an explicit "Continue / Refine by form" button is the user action (OD-2). A persistent **"← Workflows" breadcrumb** auto-saves the draft and returns to the page (drafts are net-new CRUD anyway), with "Discard draft" in an overflow — **never trap the author in the builder** (OD-3). The Builder stays deliberately **Run-free** (OD-4): a just-published author reaches their first Run only via the page, not from inside the builder.

### D3 — The AUTHOR → PUBLISH → RUN loop: PUBLISH IS THE TEST (OD-10, OD-1, the QUAL-01 protection)
The load-bearing flow decision. **A draft cannot be Run directly.** A draft's only trial run is the **publish gauntlet itself** — the 8-stage gate (lint → golden run → judge) *is* the test that proves runnability. There is no "Run-draft" button anywhere on the page; **Run appears ONLY once a workflow is published** (OD-10). This protects **QUAL-01**: no unguarded execution path bypasses the judge gate. On gauntlet success, the flow **auto-returns to the Workflows page** with the just-published version on the published shelf, a "Published v(n) ✓ · Run it" toast, and a **Run CTA** on that card (OD-1) — closing the author→first-Run dead-end. "View the golden run" survives as a secondary link.

### D4 — Execution = a MODE OF A THREAD; Run = create thread + set workflow mode + switch to Chat (OD-9)
Running a workflow is a **bounded episode inside a normal Deep chat thread**, never a page-resident process. The launch dialog collects kickoff prompt + KB folder scope, then `doRun()` **creates a new chat thread**, sets `active_workflow_run_id`, and **redirects into that thread** (the single edge that leaves a page for a thread). "Workflow mode" is **server-truth as a per-thread lock** — presence of the lock ⇒ Harness mode, absence ⇒ Deep — mirrored on the frontend by an ephemeral `Map` (`workflowLockByThread`), re-hydrated on every thread switch / reload from `GET /threads/{id}/workflow`. The backend path is the **same one the composer Harness picker already uses**: reuse `POST /threads/{id}/messages` with `workflow_definition_id` (OD-9), so page-launch and composer-launch share one code path. The **integration rule for any new run surface**: set `selectedThread` (drives NavPanel highlight + props) AND ensure `setViewingThread` fires (sole writer of `viewedThreadId`, drives the panel + the lock reconcile). Setting only one desyncs chat and panel.

### D5 — Tweak forks a new-version draft into the Builder (OD-5, immutability)
"Tweak → new version" on a published workflow standardizes to **Builder (019) with a fresh draft v(n+1)**; the frozen v(n) is untouched (DB trigger `workflow_definitions_block_published_update`, per-version immutability). This is the cross-sketch contract: 020's `setState('resting')` "jump to publish form" is **sketch-local scaffolding**, not the real destination. The same destination applies whether Tweak is invoked from the page (021), from the run thread's resolve (022), or conversationally in Deep after resolve ("tweak this to add a column" forks v2 via the builder).

### D6 — ONE net-new "Workflows" nav entry: extend the union + shared NAV_ITEMS, delete the dead AppDock, distinct icon (OD-6, OD-7)
Adding the entry is mechanical `useState`-union work, no router. **Extend `ActiveView`** with `"workflows"` in `App.tsx`, add a `WorkflowsPage` render branch in the `ChatLayout` ternary **before the trailing `: <KnowledgeHealthPage/>` else** (that else is a positional fallback — an unguarded new view silently renders KnowledgeHealth). The nav row needs a **distinct icon — lucide `Workflow` or `GitBranch`, NOT the gear** (the gear is Settings only; 021 collided them — OD-7). Today the nav-items live in **three hand-synced arrays** (NavPanel `NAV_ITEMS`, ChatLayout `NAV_ITEMS_MOBILE`, and a **DEAD third copy in AppDock** that is fully built but never rendered). The contract: **delete AppDock first** (or in the same change) and **extract one shared `NAV_ITEMS` constant** consumed by NavPanel + the mobile drawer, so a view is added once, not 3–4 times (OD-6). The mobile drawer row is mandatory or Workflows is desktop-only.

⚠ **CORRECTED 2026-09-22 (Phase 262 / RESEARCH R-1) — THE SENTENCE ABOVE IS KEPT RATHER THAN OVERWRITTEN, BECAUSE THE CLAIM THAT ROTTED IS THE FINDING.** *"before the trailing `: <KnowledgeHealthPage/>` else … an unguarded new view silently renders KnowledgeHealth"* has been false since Phase **217.1-14**: that arm is now `<UnknownViewFallback view={activeView as never} />`, and a branchless member renders **"This view has no screen: `<name>`"**. ⭐ **The DISCIPLINE is untouched and still mandatory** — the branch must still precede the trailing else, because it is a POSITIONAL fallback rather than a `default:` that throws. Only the CONSEQUENCE was wrong, which is why the wrong consequence survived in **three registers at once** (this one, `App.tsx`'s union comment, and `262-CONTEXT.md`), all three corrected in the same commit.

⛔ **AND THE DISCIPLINE WAS GUARDED BY NOTHING UNTIL 2026-09-22.** `as never` is always a legal assertion so `tsc` never narrowed; `ChatLayout.fallback.test.tsx` is four source-text assertions that mount nothing; `renameFence.test.ts` asserts only a member-count FLOOR. A branchless member therefore compiled and shipped green — the Phase-118 built-but-unreachable lesson with no executable half. **`frontend/src/lib/activeViewReachability.ts` (Phase 262 plan 01) is that half**: it parses both files with `ts.createSourceFile` — never a grep, because prose repeating a member name would satisfy a grep — reports every member with no `activeView === "…"` branch, asserts the fallback is still last, and THROWS rather than reporting over a file it failed to parse. **The nav/rail entry is the one leg it cannot see**; pin that with a rendered click over the shipped `NAV_ITEMS` (`NavPanel.test.tsx`, `nav-items.test.ts`), not with a comment.

### D7 — The read-only graph stays a Builder/page surface; the run thread keeps its proven PhaseTimeline (OD-11)
The read-only workflow graph (019's vertical phase-order spine + dashed skip branches) is a **Builder / Workflows-page-only surface**. It does **NOT** replace the run-time vertical `PhaseTimeline` — G-5 warns against re-touching the recent 094 / 101.1 `PhaseTimeline` / `PhaseCard` hot files. The run thread keeps its proven accordion; the graph is for authoring/inspection only.

### D8 — The locked-run escape hatch = a sibling Deep thread; you are never truly blocked (OD-8)
A locked, running workflow thread can **always spawn a sibling Deep thread** (unread dot on the nav rail) via the "New thread ▸" escape hatch. It reuses existing thread-create plumbing and matches the "mode of a thread" model — the running thread is locked, but the *app* never is. (At a `llm_human_input` pause, the same thread stays put: pick / Proceed-Abort / type a scoped answer resumes the existing run — that is an in-place transcript event, not a navigation.)

### Visual / kind taxonomy (from the winning variant A — the linkage graph)
The map encodes node "kind" as a **non-color-alone** visual system (border style + glyph chip + amber/violet hue), drawn over a Deep-Midnight stage. Five kinds, each with a distinct border treatment so the graph reads in ~3 seconds at rest:

- **existing** — solid border, `--color-surface` fill, muted chip. The 5 current `ActiveView`s + the WorkspacePanel.
- **netnew** — **dashed** violet border (`hsl(258 90% 66% / .45)`), violet-tinted fill (`/ .06`), violet chip. The Workflows page, Builder describe/refine, Launch dialog, detail pane.
- **mixed** — amber border (`hsl(38 92% 60% / .4)`). The ONE surface with a live route under net-new UI: the Publish gauntlet (`POST /workflows/{id}/publish` is live; the 8-stage UI is net-new).
- **thread** — amber border + `--color-warning-dim` fill. The Run-in-thread mode + its edges.
- **dead** — **dotted** dim border, `opacity:.55`. The AppDock (built, never rendered).

Key tokens from the winner: stage `--radius-lg` + `--color-bg-elev1`; nodes 148px wide, `--radius-md`, `--shadow-sm`, hover `scale(1.03)` to `--color-primary-glow`, selected `scale(1.05)` with a 2px `--color-primary` ring; edges are SVG quadratic curves (`stroke-width:1.6`, hot=`--color-primary` out / `--color-success` in at `2.4`); edge-trigger labels ride the curve midpoint in `--font-mono` at 8.5px; OD markers render as small amber `⚑ OD-n — adopted` chips, never silently resolved.

## Surface & Redirect Map

The 16 surfaces (nodes) and the edges between them, as `from → [trigger] → to (mechanic)`. Every edge is a `useState` view-switch, an intra-page state change, a modal, or a create-thread-then-switch — **never a route change**. OD = the adopted decision riding that edge.

### Nodes (16 surfaces)

| ID | Surface | Kind | Where it lives (today / would) |
|---|---|---|---|
| **N1** | Chat view | existing | `ChatLayout.tsx` chat\|panel grid branch — **the Execution home** |
| **N2** | Documents view | existing | `IngestionPage` (ternary) |
| **N3** | Skills view | existing | `SkillsPage` — holds the "Try in chat" cross-view redirect precedent |
| **N4** | Settings view | existing | `SettingsPage` |
| **N5** | Library-Health view | existing | ~~`KnowledgeHealthPage` — the trailing `else` fallback (no guard)~~ ⚠ **RETIRED at 217.1-14** (page deleted; Health is a Library TAB). The trailing `else` is `UnknownViewFallback`, still unguarded by `tsc` — see the D6 correction |
| **N6** | **Workflows page** | **netnew** | new `WorkflowsPage` in non-chat `<main>` — the **Library + Launch home** and the IA hinge |
| **N7** | Builder · describe | netnew | sketch 018 (requirement-first; AI drafts + sets the dial) |
| **N8** | Builder · refine | netnew | sketch 019 (refine-by-form + read-only graph). 018→019 = one builder, two stages |
| **N9** | Publish gauntlet | **mixed** | sketch 020; 8-stage gate over `POST /workflows/{id}/publish` (route live, UI net-new); renders `PublishVerdict`, never re-derives |
| **N10** | Launch dialog | netnew | modal off N6 — collects kickoff + KB scope; **CREATES the thread** |
| **N11** | Run-in-thread | thread | sketch 022 — a **MODE of N1**, not a new view; the per-thread lock flips it to Harness |
| **N12** | Workspace panel | existing | `WorkspacePanel.tsx`; binds `useViewingThread()`; deliverable lands in FILES (SEED-038) |
| **N13** | Detail pane | netnew | 021-B master-detail of N6 — "View" carries a card into the pane, no route change |
| **N14** | NavPanel | existing | desktop sidebar (rendered) — holds NAV_ITEMS array #1 |
| **N15** | Mobile drawer | existing | `<768px` nav chrome — holds NAV_ITEMS array #2 |
| **N16** | AppDock | **dead** | built, NEVER rendered (no JSX call site) — holds NAV_ITEMS array #3 + stale `// From AppDock` comment (OD-6) |

### Edges (every redirect)

**Existing substrate (the new entry plugs into these):**
- N14 → [click a nav button] → N1 : `NavPanel onClick → setActiveView` (useState view switch, no router) — the hub
- N15 → [tap a nav icon `<768px`] → N1 : `onNavigate(view); setDrawerOpen(false)`
- N16 → [would fire on icon click] → N1 : **INERT** — AppDock is never mounted (OD-6, dead)
- N3 → [click "Try in chat"] → N1 : `onSetPrefillMessage + onNavigate("chat")` — **the precedent for the Run redirect**
- N1 → [thread set / panel open] → N12 : `setViewingThread → viewedThreadId`; panel binds via `useViewingThread()`

**New Workflow-Studio edges:**
- N14 → [click new "Workflows" entry] → N6 : NET-NEW `ActiveView "workflows"` → `setActiveView("workflows")` (added like Skills; **distinct icon, not the gear** — OD-7) — the hub
- N15 → [tap "Workflows" `<768px`] → N6 : same row in `NAV_ITEMS_MOBILE` (else desktop-only)
- N6 → [`+ Build a workflow`] → N7 : `openBuilder("new")` → net-new draft-create endpoint
- N6 → [`Open ✎` on a draft/seed] → N7 : `openBuilder(id)` → net-new single-GET draft (018→019) — OD-2
- N6 → [`Run ▶` on a **published** card] → N10 : `openLaunch(id)` → modal collects kickoff + KB scope — OD-10 (**no Run on drafts**)
- N10 → [`doRun()` — confirm launch] → N11 : **CREATES new thread**, sets `active_workflow_run_id`, `setSelectedThread` + ensure `setViewingThread` fires — OD-9 (**the key edge: the only one that leaves a page for a thread**)
- N6 → [`Tweak ⑂` on a **published** wf] → N8 : `openTweak(id)` → forks v(n+1) into Builder; frozen v(n) untouched — OD-5
- N6 → [click card / `View ▦`] → N13 : `viewDetail(id) → setDetail(id)` intra-page master-detail (no route)
- N13 → [`⬆ Publish…` from a draft] → N9 : `goPublish(id)` → 8-stage gauntlet via `POST /workflows/{id}/publish`
- N7 → [draft grounded + grey-areas cleared → "Continue"] → N8 : 018 describe → 019 refine — OD-2
- N8 → [`Publish` (lint-clean, all bound)] → N9 : runs the 8-stage gauntlet; on success freezes version immutable + forks a new draft
- N9 → [**gauntlet PASSES** (golden run + judge)] → N6 : **auto-return to Workflows page** w/ the new version + "Published ✓ · Run it" toast + **Run CTA** — OD-1 (**key edge**)
- N9 → [`Tweak → new version`] → N8 : standardize → Builder 019, fresh draft v(n+1) — OD-5 (020's "resting" jump is sketch-local)
- N9 → [`View the golden run` (golden_run_id set)] → N11 : opens the golden-run thread; gated on stage 3+
- N11 → [run kicked off → mode flip] → N12 : composer passes `workflow_definition_id`; SSE/mount reconcile sets the WorkflowLock keyed by thread id — key
- N11 → [`New thread ▸` escape-hatch (running)] → N1 : `flashThread()` spawns a **NEW sibling Deep thread** (unread dot); never truly blocked — OD-8
- N11 → [`Open in FILES ▸` on deliverable (completed)] → N12 : cited `.docx` → panel FILES (single artifacts home, SEED-038)
- N11 → [after resolve: "tweak this to add a column"] → N8 : conversational Deep forks a NEW version via builder; v1 stays immutable — OD-5

**Self-loops (intra-surface state, NEVER a route):**
- N6 ↻ [select a project in the rail] : `setProject(id) → GET /workflows/published?project_folder_id=…`
- N6 ↻ [`🗺️ Map / Where things go`] : `toggleMap()` overlay, Esc closes — informational
- N11 ↻ [at `llm_human_input` pause: pick / Proceed-Abort / type] : pause is a transcript event (006-C ask card); composer narrows; resume the existing run

### The canonical journey (one line)
`Workflows page → Build/describe (018) → Refine (019) → Publish gauntlet (020) → [PASS → auto-return to Workflows page w/ Run CTA, OD-1] → Run (launch dialog → NEW thread) → Thread in workflow mode (022) → resolve → Deep chat (tweak → 019 v+1)`. Every hop is a view-switch, an intra-page state change, a modal, or a create-thread-then-switch — never a route.

## HTML Structures

The winning variant renders the IA as data, not hand-authored markup — these are the structural patterns to mirror when building the real surfaces.

```html
<!-- The hinge: N6 is the only NET-NEW first-class view; every authoring + launch
     edge fans out from it. NET-NEW surfaces are visually distinct (dashed/violet);
     dead code is dotted; thread-mode is amber. -->
<div class="gnode netnew" id="gn-N6">      <!-- Workflows page — the hinge -->
  <div class="gn-top"><span class="gn-id">N6</span><span class="kind netnew">NET-NEW</span></div>
  <div class="gn-name">Workflows page</div>
  <div class="gn-sub">ActiveView "workflows"  NET-NEW</div>
</div>
<div class="gnode dead" id="gn-N16">        <!-- AppDock — dotted, never rendered -->
  <div class="gn-top"><span class="gn-id">N16</span><span class="kind dead">DEAD code</span></div>
  <div class="gn-name">AppDock</div>
</div>

<!-- The three-homes grouping, rendered as a per-edge tag in the inspector.
     The execution edge (Run) is the ONE that LEAVES the page for a thread. -->
<div class="ia-sub thread">                 <!-- N11 lives in the Execution home -->
  <div class="is-top">
    <span class="is-name">Run-in-thread</span>
    <span class="kind thread">mode of a thread</span>
    <span class="is-home execution">Execution</span>
  </div>
  <div class="is-redir">↳ ⇥ LEAVES the page → doRun() creates a thread + workflow mode + switches to Chat.
     NOT a sub-surface of N6 — it is a DESTINATION in the Execution home.</div>
</div>

<!-- OD markers ride the edges, rendered ADOPTED (never silently resolved) -->
<span class="ie-od" title="decision OD-10 — ADOPTED (operator, 2026-06-14)">⚑ OD-10 — adopted</span>
```

The honesty banner is the load-bearing copy to keep verbatim at the top of any IA surface:

```html
<div class="honesty-banner">
  <span class="hb-g">⬡</span>
  <span>There is <b>no router, no URL</b>. Every redirect here is a <b>useState&lt;ActiveView&gt;</b>
    switch, an intra-page state change, a modal, or a <b>create-thread-then-switch</b>. A workflow is
    a <b>mode of a thread</b>, never page-resident — <b>Run = create thread + set workflow mode +
    switch to Chat</b>. Net-new surfaces are dashed; the one live backend is
    <code>GET /workflows/published</code> + <code>POST /workflows/{id}/publish</code>.</span>
</div>
```

## What to Avoid

- **Page-resident execution.** Do NOT render a workflow's live run inside the Workflows page. Execution is a mode of a thread (D1/D4) — a page-resident runner duplicates the run/stream/lock/resume plumbing and creates a second "live thing" to reconcile with the real thread. The page only *launches*.
- **A Run-draft path.** Do NOT put a "Run" affordance on draft/seed cards or inside the Builder. **Publish IS the test** (D3, OD-10): a draft's only trial run is the publish gauntlet (golden run + judge). Any page Run button on an unpublished draft bypasses the judge gate and breaks QUAL-01. Run appears ONLY once published. If a try-before-publish is wanted, route it through the gauntlet's golden-run preview, never a page Run button.
- **Assuming react-router / URLs.** There is no `<Routes>`, no `useNavigate`, no path. The whole app is one `useState<ActiveView>`. Wiring "Workflows" as a route, or expecting a URL to deep-link a draft/run, contradicts the substrate — use `setActiveView`, intra-page state, a modal, or create-thread-then-switch.
- **The gear-icon collision.** Do NOT reuse the ⚙ gear for Workflows (021's defect, OD-7). The gear is Settings only; Workflows needs a distinct lucide icon (`Workflow` or `GitBranch`).
- **The dead AppDock array (and array divergence).** Do NOT add the "Workflows" row to AppDock's `NAV_ITEMS` "for parity" and leave it — AppDock is dead code (never rendered). Adding a 4th hand-synced array deepens the divergence trap. **Delete AppDock first** and extract one shared `NAV_ITEMS` constant (D6, OD-6).
- **Replacing the run-time PhaseTimeline with the read-only graph.** The 019 read-only graph is a Builder/page surface only (D7, OD-11). Do NOT re-touch the 094 / 101.1 `PhaseTimeline` / `PhaseCard` hot files (G-5) — the run thread keeps its proven accordion.
- **Setting only one notion of "current thread."** A new run surface MUST set `selectedThread` AND ensure `setViewingThread` fires. Setting only one desyncs the chat (NavPanel highlight/props) from the panel (`viewedThreadId` + lock reconcile).
- **Treating "Tweak → resting publish form" as the contract.** 020's `setState('resting')` jump is sketch-local scaffolding. Tweak's real destination is the Builder (019) with a fresh draft v(n+1) (D5, OD-5).

## Origin
Synthesized from sketches: **023** (winner **A — the linkage graph**, the whole-app IA reference for the 018–022 workflow-studio set), grounded by `.planning/sketches/103-grounding/APP-LINKAGE-MAP.md` (§1 node list, §2 edge list, §3 three-homes rule, §4 nav-entry integration, §5 the 11 open decisions) and MANIFEST sketch row 023. Source files in `sources/023-app-linkage-map/` (and the grounding doc `sources/103-grounding/`). The 16 nodes / 23 redirects + 3 self-loops / 11 decisions are lifted verbatim from the grounding doc, not invented; real enums (`ActiveView`, the per-thread `workflowLockByThread` lock, `GET /workflows/published` + `POST /workflows/{id}/publish` as the only live routes) and the net-new flags are honored. **All 11 open decisions (OD-1..OD-11) were ADOPTED by the operator on 2026-06-14** ("publish is the test") — this file renders them as the locked navigation contract for Phase 103.

Cross-links:
- [`workflows-page.md`](workflows-page.md) — 012/021: the Library + Launch home (N6) and the launch dialog (N10) detailed.
- [`workflow-builder.md`](workflow-builder.md) — 013/018/019: the Authoring home (N7/N8) detailed.
- [`unified-execution-surface.md`](unified-execution-surface.md) — 022: the Execution home (N11) — workflow-mode in a thread.
- [`composer-and-mode.md`](composer-and-mode.md) — 011: the composer Harness picker (the second door into the per-thread lock).
