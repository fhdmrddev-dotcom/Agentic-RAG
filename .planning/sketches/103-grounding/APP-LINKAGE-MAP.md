# Phase 103 — App Linkage Map (v2.9 Workflow Studio)

**Purpose:** the single authoritative wiring diagram for how the new Workflow Studio surfaces (Workflows page, Builder, Publish gauntlet, Run-in-thread) attach to the *existing* Agentic-RAG app navigation. Synthesized from two investigations: (1) the real `frontend/src` navigation substrate, and (2) the cross-sketch IA across workflow sketches `012`/`013`/`018`/`019`/`020`/`021`/`022`. Companion to `BRIEF.md`.

**Sketch dir map (real paths, the brief's numbers):** `012-workflows-page` · `013-workflow-builder` · `018-requirement-first-authoring` · `019-draft-refine-and-readonly-graph` · `020-publish-gauntlet-honesty` · `021-workflows-page-and-nav-map` · `022-workflow-run-in-thread`.

**The one load-bearing sentence (stated identically in 012, 021, 022):** *A workflow is a **mode of a thread**, never page-resident — the page only LAUNCHES; the run streams in a normal Deep chat thread, reusing the existing run / stream / lock / resume plumbing.*

---

## 0. The substrate in one breath (honest, no react-router)

There is **no router, no URL, no `<Routes>`**. The whole app is a single `useState<ActiveView>` in `App.tsx:13`, threaded down as `onNavigate={setActiveView}` (`App.tsx:34`). `ActiveView` has exactly 5 members (`App.tsx:9`): `chat | documents | skills | settings | library-health`. Switching views = calling a setter. Selecting a thread = a *separate* two-layer state (`selectedThread` in `useThreads` + `viewedThreadId` in the Zustand `StreamsProvider` store, bridged by `ChatArea.tsx:235 setViewingThread`). "Workflow mode" is **not** a thread column — it is an ephemeral per-thread lock (`workflowLockByThread: Map`, `streamsStore.ts:139`) re-hydrated on every thread switch / reload from the authoritative `GET /threads/{id}/workflow` (`ChatArea.tsx:178-197`).

---

## 1. NODE LIST — every surface, tagged existing vs NET-NEW

| # | Node | Kind | existing / NET-NEW | Where it lives today / would live |
|---|------|------|--------------------|-----------------------------------|
| N1 | **Chat** view | app view (`ActiveView "chat"`) | existing | `ChatLayout.tsx:221` chat\|panel grid branch |
| N2 | **Documents** view | app view (`"documents"`) | existing | `IngestionPage`, ternary `ChatLayout.tsx:257` |
| N3 | **Skills** view | app view (`"skills"`) | existing | `SkillsPage` |
| N4 | **Settings** view | app view (`"settings"`) | existing | `SettingsPage` |
| N5 | **Library-Health** view | app view (`"library-health"`) | existing | `KnowledgeHealthPage` (trailing `else` fallback) |
| N6 | **Workflows page** | app view (`"workflows"`) | **NET-NEW** | new `WorkflowsPage` in non-chat `<main>`; sketches `012`+`021`. No `ActiveView "workflows"` exists. |
| N7 | **Builder · describe** | sub-surface of Workflows | **NET-NEW** | sketch `018` (requirement-first; AI drafts + sets dial; grey-area confirm) |
| N8 | **Builder · refine** | sub-surface of Workflows | **NET-NEW** | sketch `019` (refine-by-FORM + read-only graph). 018→019 = one builder, two stages. |
| N9 | **Publish gauntlet** | sub-surface (modal/drawer) | **NET-NEW** *(verdict ABI live)* | sketch `020`; 8-stage gate over `POST /workflows/{id}/publish` (the route is live; the UI is net-new). Renders `PublishVerdict`, never re-derives. |
| N10 | **Launch dialog** | modal off Workflows page | **NET-NEW** | collects kickoff prompt + KB folder scope; `012`/`021`. Creates the thread. |
| N11 | **Run-in-thread** (Chat in workflow mode) | **a MODE of N1**, not a new view | mode existing / surface NET-NEW | sketch `022`. Same Chat view + WorkspacePanel; the per-thread workflow lock flips it to Harness. Reuses 008-D timeline / 009-C seam / 011-A composer. |
| N12 | **Workspace panel** | right-side panel of N1 | existing | `WorkspacePanel.tsx`; binds to `useViewingThread()`. Harness sections (PhaseTimeline / Sub-results) mount when lock present. |
| N13 | **Workflow detail pane** | intra-page master-detail of N6 | **NET-NEW** | `021` variant B; "View" carries a card into the detail pane (no route change). |
| N14 | **NavPanel** (desktop sidebar) | nav chrome | existing | the *rendered* desktop nav; `ChatLayout.tsx:108`. Holds `NAV_ITEMS` array #1. |
| N15 | **ChatLayout mobile drawer** | nav chrome | existing | inline `<768px` drawer; holds `NAV_ITEMS_MOBILE` array #2. |
| N16 | **AppDock** | nav chrome | existing-but-**DEAD** | fully built, **never rendered** (no JSX call site); holds `NAV_ITEMS` array #3 + a stale `// From AppDock` comment in `NavPanel.tsx:28`. |

> Backend reality check (gates "net-new"): the **only** live workflow HTTP routes are `GET /workflows/published` (owner-scoped, optional `project_folder_id`) and `POST /workflows/{id}/publish`. All draft CRUD (create / list / single-GET / update / delete / unpublish) and NL-gen are **net-new**. So N7–N10, N13 are net-new in *both* UI and backend; N9's verdict ABI is the one part with a live endpoint.

---

## 2. EDGE LIST — every redirect as `from → [trigger] → to` (+ real mechanic)

### 2A. Existing nav edges (the substrate the new entry plugs into)

| from | trigger | to | real mechanic |
|------|---------|----|---------------|
| NavPanel nav button | click Chat/Documents/Library-Health/Skills/Settings | matching `ActiveView` | `NavPanel.tsx:298 onClick={() => onNavigate(view)}` → `App.tsx setActiveView` (**useState view switch**, no router) |
| ChatLayout mobile drawer | tap a nav icon (`<768px`) | matching `ActiveView` (+ closes drawer) | `ChatLayout.tsx:201 onNavigate(view); setDrawerOpen(false)` |
| AppDock (DEAD) | would fire on icon click | matching `ActiveView` | `AppDock.tsx:37` — **inert**, AppDock is never mounted |
| App / ChatLayout | `activeView` changes | matching view renders | `ChatLayout.tsx:221` top-level `chat ? <grid> : <main>`, then `:257` ternary chain to Ingestion/Skills/Settings/KnowledgeHealth |
| NavPanel thread row | click a thread | thread becomes `selectedThread` | `NavPanel.tsx:159 onSelectThread(thread)` → `useThreads.ts:32 setSelectedThread` |
| NavPanel "+ New Chat" | click | new thread created + selected | `NavPanel.tsx:345 onNewThread(folderId)` → `useThreads.ts:36 createThread + setSelectedThread` |
| ChatArea (thread-change effect) | `selectedThread.id` changes | viewing-thread set + SSE reconcile + **workflow-lock rehydrate** | `ChatArea.tsx:235 setViewingThread` → `StreamsProvider.tsx:1266` sets `viewedThreadId`, fires `reconcile` (re-reads `GET /threads/{id}/workflow`, `:1559-1588`, sets/clears lock), `enforceStreamPool` |
| SkillsPage | click "Try in chat" | Chat view, composer pre-filled | `ChatLayout.tsx:64 handleTryInChat → onSetPrefillMessage(...) + onNavigate("chat")`. **This is the precedent for the cross-view "Run" redirect.** |

### 2B. NEW workflow-studio edges (the IA the sketches define)

| from | trigger | to | real mechanic |
|------|---------|----|---------------|
| Existing nav (any view) | click new **"Workflows"** entry | N6 Workflows page | **NET-NEW** `ActiveView "workflows"` → `setActiveView("workflows")` (added like Skills; no route) |
| Workflows page | "+ Build a workflow" card / header btn | N7 Builder·describe (`018`) | `openBuilder('new')` → net-new draft-create endpoint |
| Workflows page | "Open ✎" on a draft/seed card | N7/N8 Builder (`018`→`019`) | `openBuilder(id)` → net-new single-GET draft endpoint |
| Workflows page | **"Run ▶"** on a published card | N10 Launch dialog → then N11 thread | `openLaunch(id)` → **modal** collects kickoff + KB scope → `doRun()` **creates new thread**, sets `active_workflow_run_id`, **redirects into the thread** (= `setSelectedThread` + ensure `setViewingThread` fires). Backend path UNDECIDED (see OD-9). |
| Workflows page | "Tweak ⑂" on a **published** workflow | tweak-confirm modal → N8 Builder with new draft v(n+1) | `openTweak(id)` → `doTweak()` forks v(n+1) into builder; frozen v(n) untouched (DB trigger `workflow_definitions_block_published_update`, per-version immutability) |
| Workflows page | click card / "View ▦" (variant A) | N13 detail pane (variant B) | `viewDetail(id) → setVariant('B')` — **intra-page** master-detail handoff (toast), no route change |
| Workflows page | select a project in the rail | Workflows page (filtered) | `setProject(id)` → `GET /workflows/published?project_folder_id=...` — **intra-page state** |
| Workflows page | "🗺️ Map / Where things go" | nav-map overlay (same page) | `toggleMap()` overlay, Esc closes — informational, no nav |
| N13 detail pane (draft) | "⬆ Publish…" | N9 Publish gauntlet (`020`) | `goPublish(id)` → 8-stage gauntlet via `POST /workflows/{id}/publish` (UI net-new) |
| Builder·describe (`018`) | draft grounded + all grey-area guesses cleared → "Continue to publish / refine by form" | Builder·refine (`019`) | post-draft flow `018 describe → 019 refine`. **Handoff trigger underspecified** (OD-2). |
| Builder·refine (`019`) | "Publish" (lint-clean, all bound) | N9 Publish gauntlet (`020`) | runs 8-stage gauntlet; on success **freezes version immutable + forks a new draft to edit** |
| Publish gauntlet (`020`) | gauntlet passes (golden run + judge pass) → published v(n) | Success verdict screen (`PublishVerdict`) | `PublishVerdict` rendered verbatim (5 server fields); offers "View the golden run" + "Tweak → new version". **Does NOT auto-return to Workflows page** (OD-1). |
| Publish gauntlet (`020`) | judge fail (HARD wall) / pre-run / lint / business_requirement block | Block verdict screen → "Fix & re-publish" | `setState('resting')`; **NO "publish anyway" / override**; each re-publish = fresh golden run + judge |
| Publish gauntlet (`020`) | "View the golden run" (only if `golden_run_id` non-null) | the golden-run thread | `runLinkClick` opens golden run thread; gated on `golden_run_id` (stage 3+ reached) |
| Publish gauntlet (`020`) success/block | "Tweak → new version" | resting publish form *(sketch-local)* — should be Builder `019` | `setState('resting')`; cross-sketch contract should standardize → Builder (OD-5) |
| **Run-landed thread (`022`) — the mode flip** | published workflow run kicked off (via launch or composer Harness pick) | thread becomes **Harness-locked** | composer passes `workflow_definition_id` (`ChatArea.tsx:331`); backend creates run; SSE/mount reconcile sets `WorkflowLock` keyed by thread id (`ChatArea.tsx:186` / `StreamsProvider.tsx:1564`) |
| Run-landed thread (`022`) running | click "New thread ▸" escape-hatch (variant A) | a NEW sibling chat thread (parallel) | `flashThread()` — parallel escape hatch (2nd thread, unread dot on nav rail); never truly blocked. **Variant-specific** (OD-8) |
| Run-landed thread (`022`) at `llm_human_input` pause | pick option / Proceed-Abort / type scoped answer | same thread — run resumes | pause is a transcript event (006-C ask card); composer narrows to scoped answer; resume existing run |
| Run-landed thread (`022`) resolve = completed | "Open in FILES ▸" on the deliverable | FILES section of WorkspacePanel | `flashPanel()`; cited `committee_brief.docx` → panel FILES (SEED-038 artifacts home) |
| Run-landed thread (`022`) running | "Cancel" on locked composer status chip | same thread — run cancelled | 3-way terminal: completed / failed-honestly / **cancelled**; neutral receipt, no deliverable |
| Run-landed thread (`022`) after resolve (conversational Deep) | user: "tweak this to add a mitigation column" | Builder (`019`) with NEW workflow version (v2) | forks a new version via the builder; v1 stays immutable in the Workflows page — **same destination as 021's Tweak** |

---

## 3. The THREE HOMES rule

The whole IA reduces to one home per concern — *every* edge above respects this split:

| Concern | Home | Surface | Why it lives here |
|---------|------|---------|-------------------|
| **Authoring** (create / draft / refine / publish a definition) | **the Builder** (`018`→`019`→`020`) | a sub-surface reached *from* the Workflows page | Hand-off, not execution: the builder authors the definition; it has **NO Run/execute affordance** (`013/README:46`). 018/019 expose only Publish/Continue. |
| **Library + Launch** (browse / filter / own / tweak / kick off) | **the Workflows page** (`012`/`021`) | a NET-NEW first-class `ActiveView` (peer of Skills) | The page is the catalog and the launchpad. It **only launches** — `Run` opens a thread; execution *never* happens on the page (`021:416`). |
| **Execution** (the bounded run, streaming, pause, deliverable) | **a Chat thread** (`022`) | the existing Chat view + WorkspacePanel, flipped to Harness mode | Reuses the proven run / stream / lock / resume plumbing. The deliverable lands in the panel FILES section (the single artifacts home, SEED-038). |

### "Workflows are a MODE OF A THREAD" — mechanically

A workflow is never a page-resident process. Running one = **a bounded episode inside a normal Deep chat thread**:

1. **Launch** (Workflows page) collects kickoff prompt + KB folder scope, **CREATES a new chat thread**, sets `active_workflow_run_id`, and **redirects you into that thread**.
2. The thread renders **already-chosen** designs (008-D timeline / 009-C seam / 011-A composer) — no new run designs are invented.
3. "Workflow mode" is server-truth as a **per-thread workflow lock** — *presence of the lock ⇒ Harness mode; absence ⇒ Deep*. It is NOT a `thread.active_workflow_run_id` field on the frontend Thread type; the frontend only **mirrors** the backend via an ephemeral `Map` (`workflowLockByThread`), re-derived on every thread switch / reload from `GET /threads/{id}/workflow` (`locked && !lock_is_stale && active_workflow_run_id` → set, else clear).
4. Lifecycle: **before(Deep) → launch → running/streaming → pause(`llm_human_input`) → resolve → after(Deep again)**. Resolve is a 3-way terminal (completed / failed-honestly / cancelled). After resolve the thread returns to conversational Deep with the run + deliverable as context.
5. The same thread can also enter Harness mode *without* the page — via the **composer Harness picker** (`ChatArea` local `workflowMode + selectedWorkflowId`, sends `workflow_definition_id`). So the page and the composer are two doors into the *same* per-thread lock.

**Integration rule for any new run surface:** it must respect BOTH notions of "current thread" — set `selectedThread` (drives NavPanel highlight + props) AND ensure `setViewingThread` fires (sole writer of `viewedThreadId`, drives the panel + the lock reconcile). Setting only one desyncs chat and panel.

---

## 4. How the "Workflows" nav entry integrates (honest, no react-router)

Adding the entry touches **5 places**, all hand-synced (there is no shared nav-items module). All edits are mechanical `useState`-union work — **no router, no URL**:

1. **Extend the union** — `App.tsx:9`:
   `export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows"`
2. **NavPanel array** (desktop, the *rendered* nav) — `NavPanel.tsx:44-50 NAV_ITEMS`: add `{ view: "workflows", icon: <Workflow/GitBranch lucide>, label: "Workflows" }`. **Use a distinct icon — not the gear** (OD-7: 021 collides ⚙ Workflows with ⚙ Settings).
3. **Mobile drawer array** — `ChatLayout.tsx:18-24 NAV_ITEMS_MOBILE`: same row (else the entry is desktop-only and unreachable on `<768px`).
4. **AppDock array** — `AppDock.tsx:12-18 NAV_ITEMS`: same row *for parity* — **even though AppDock is dead code** (never rendered). Omitting it diverges the 3 arrays further; the real fix is deleting AppDock first (OD-6).
5. **ChatLayout render branch** — `ChatLayout.tsx:255-267`: insert an **explicit guard** `activeView === "workflows" ? <WorkflowsPage/> :` into the ternary chain, placed **BEFORE the trailing `: <KnowledgeHealthPage/>` else**. The else is a *positional fallback* — `library-health` has no guard — so an unguarded new view silently renders KnowledgeHealthPage. `WorkflowsPage` renders inside the non-chat `<main>` (no workspace panel), exactly like Documents/Skills/Settings.

**Cleanup candidate (v2.9):** extract one source-of-truth `NAV_ITEMS` module so a view is added once, not three+ times. AppDock is the orphaned third copy — decide delete-vs-keep before adding the 4th array entry.

---

## 5. OPEN DECISIONS — ALL 11 ADOPTED (operator, 2026-06-14)

> **STATUS: all 11 adopted (operator, 2026-06-14) — this is the authoritative navigation contract for Phase 103.** Every OD below is resolved to its recommendation; the "Status" column records the adoption. No open navigation gaps remain. (Operator confirmed "publish is the test" — no draft-Run; see OD-10.)

| ID | The inconsistency / gap | Evidence | Recommended resolution | Status |
|----|-------------------------|----------|------------------------|--------|
| **OD-1** | **Where does Publish SUCCESS return to?** 021's journey strip implies publish flows onward to Run/Workflows page, but `020`'s success state offers NO "back to Workflows" and NO "Run" — only "View the golden run" + "Tweak → new version". The brief's expectation "020 → Workflows page" is unrealized. | `020/index.html` success state; `021` journey strip | **On success, auto-return to the Workflows page** with the just-published version on the published shelf, toast "Published v(n) ✓ · Run it", and a **Run** CTA on that card. Closes the author→first-Run dead-end (OD-3). Keep "View the golden run" as a secondary link in the toast/card. | **ADOPTED (operator, 2026-06-14)** |
| **OD-2** | **Is the Builder one route or two?** `013` = ONE 4-stage cycler; Phase 103 splits into `018` (describe) + `019` (refine). 021's map encodes it ambiguously (Build→018 only; Open draft→018·019). The 018→019 handoff trigger is never specified as a user action. | `013/README`; `021` MAP_ROWS | **One continuous builder route with two stages** (describe → refine), not two routes. The 018→019 transition fires automatically once the draft is grounded AND all grey-area confirms are cleared; a "Refine by form" / "Continue" button is the explicit user action. Both stages share one URL-less builder surface. | **ADOPTED (operator, 2026-06-14)** |
| **OD-3** | **How do you get BACK from the Builder to the Workflows page?** No sketch (013/018/019/020) defines back / cancel-draft / breadcrumb. The journey is only forward. | absence across 013/018/019/020 | **Auto-save-draft-and-exit**: a persistent "← Workflows" breadcrumb in the builder header that saves the draft (drafts are net-new CRUD anyway) and returns to the page. Add a "Discard draft" secondary in an overflow. Never trap the author in the builder. | **ADOPTED (operator, 2026-06-14)** |
| **OD-4** | **Is there a "Run" inside the Builder?** Deliberately NO (`013`/018/019 are hand-off only). Internally consistent, BUT combined with OD-3 it means a just-published author has no path to first Run. | `013/README:46`; no Run handler in 018/019 | **Keep the builder Run-free** (honors the three-homes rule), and close the gap via OD-1 (publish success returns to the page with a Run CTA). The Run home stays the Workflows page. | **ADOPTED (operator, 2026-06-14)** |
| **OD-5** | **"Tweak → new version" lands WHERE — builder or resting publish form?** 021 (L433) + 022 (L504) say Tweak forks into the **Builder (019)**. But `020`'s "Tweak → new version" button calls `setState('resting')` → the *publish form*. Mechanic disagrees across sketches. | `021:433`, `022:504` vs `020` button | **Standardize Tweak → Builder (019)** as the cross-sketch contract. `020`'s `resting` jump is sketch-local scaffolding; the real destination is the builder with a fresh draft v(n+1). | **ADOPTED (operator, 2026-06-14)** |
| **OD-6** | **AppDock is dead code** — fully built, never rendered; a 3rd stale nav array + a stale `// From AppDock` comment in `NavPanel.tsx:28`. Adding "workflows" forces a choice: sync the 4th array or delete first. | no `<AppDock` JSX call site anywhere | **Delete AppDock before adding the entry** (or in the same change), and extract a shared `NAV_ITEMS` constant consumed by NavPanel + the mobile drawer. Removes the divergence risk permanently. | **ADOPTED (operator, 2026-06-14)** |
| **OD-7** | **Nav icon/name collision** — 021 uses ⚙ for BOTH "Workflows" and "Settings". | `021/index.html` L921 vs L924 | **Distinct icon for Workflows** — lucide `Workflow` or `GitBranch`. Keep the gear for Settings only. Cosmetic but a real IA defect to fix at build. | **ADOPTED (operator, 2026-06-14)** |
| **OD-8** | **Escape-hatch parallel thread is variant-specific** — "open a new thread while it runs" exists only in `022` variant A. Variants B/C handle "chat while it runs" differently; `022`'s winner is **null** (undecided). The cross-thread navigation contract depends on this. | `022` variant A; winner undecided | **Pick variant A's escape hatch as the contract**: a locked running thread can always spawn a sibling Deep thread (unread dot on the nav rail) — "never truly blocked." It reuses existing thread-create plumbing and matches the "mode of a thread" model. Confirm at sketch review. | **ADOPTED (operator, 2026-06-14)** |
| **OD-9** | **Run handoff backend path is undecided** — `012` names two mechanics: reuse `POST /threads/{id}/messages` with `workflow_definition_id` (lowest cost; matches today's composer) vs a new thin `POST /workflows/{id}/run` (cleaner). 021 just says "reuses run/stream/lock/resume." | `012`; `021` Run row | **Reuse `POST /threads/{id}/messages` with `workflow_definition_id`** for v2.9 — it is exactly what the composer Harness path already does (`ChatArea.tsx:331`), so the page-launch and composer-launch share one code path. Promote to a dedicated `POST /workflows/{id}/run` only if launch grows page-specific semantics. | **ADOPTED (operator, 2026-06-14)** |
| **OD-10** | **Draft-vs-published Run parity** — 021 shows Run on BOTH published AND draft/seed cards ("Run-draft"), but `020` frames the publish gauntlet (golden run + judge) as the gate that *proves* runnability, and `022` runs a published workflow. Can an unpublished draft be Run, and with what guarantees? | `021` L619-625/L808-810 vs `020`/`022` | **A draft cannot be Run directly — publish IS the test.** No "Run-draft" on the page. A draft's golden run is the *publish gauntlet itself* (golden run + judge IS its trial run); that gauntlet is the only path that proves runnability. Drafts expose Open + Publish only; **Run appears ONLY once published.** This protects QUAL-01 — there is no unguarded execution path that bypasses the judge gate. (If a try-before-publish is wanted, route it through the gauntlet's golden-run preview, never a page Run button.) | **ADOPTED (operator, 2026-06-14) — "publish is the test"** |
| **OD-11** | **Where does the read-only graph live?** Open in the brief (§6.6): Workflows-page-only vs also replacing the run-time `PhaseTimeline`. G-5 warns against re-touching recent 094/101.1 `PhaseTimeline`/`PhaseCard`. | `BRIEF §6.6` | **Graph is a Builder/Workflows-page-only surface (019)**; do NOT replace the run-time vertical `PhaseTimeline` (G-5 hot-file). The run thread keeps its proven accordion; the graph is for authoring/inspection. | **ADOPTED (operator, 2026-06-14)** |

---

## 6. Canonical journey (one line)

`Workflows page (021) → Build/describe (018) → Refine draft (019) → Publish gauntlet (020) → [success → back to Workflows page, OD-1] → Run (launch dialog → NEW thread) → Thread in workflow mode (022) → resolve → Deep chat (tweak → 019 v+1)`.

Every hop is a `useState` view switch, an intra-page state change, a modal, or a create-thread-then-switch — **never a route change**.
