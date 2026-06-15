---
sketch: 023
name: app-linkage-map
question: >
  How do all the new Workflow Studio surfaces (Workflows page, Builder, Publish
  gauntlet, Run-in-thread) actually wire into the existing Agentic-RAG app
  navigation — every surface, every redirect, the real mechanic behind each hop,
  which surfaces are NET-NEW vs existing, and where the open IA decisions still sit?
winner: "A"
tags: [linkage-map, ia-reference, nav-map, redirect-graph, workflow-studio, net-new-vs-existing, open-decisions, mode-of-a-thread, reference-for-018-022]
---

# Sketch 023 — App Linkage Map

The single interactive wiring diagram for Phase 103 — the whole-app IA reference for
the **018–022** workflow-studio set. It renders `.planning/sketches/103-grounding/APP-LINKAGE-MAP.md`
verbatim: **16 nodes** (every surface), **26 edges** (every redirect, with the trigger and the
real mechanic), and **11 open decisions** that the sketches leave unresolved. Nothing is
invented — every node, trigger, mechanic, and OD is lifted from the map doc.

This is not a new product surface. It is the **map** that tells you, for any element in the
Workflow Studio, exactly where it lands and how (a `useState` view switch, an intra-page state
change, a modal, or a create-thread-then-switch) — so 018/019/020/021/022 can be reasoned about
as one connected app, not five isolated mockups.

## Design Question

When the new surfaces (Workflows page, Builder describe/refine, Publish gauntlet, Launch dialog,
Run-in-thread) plug into an app that has **no router and no URL** — just a flat
`useState<ActiveView>` union — how does *every* actionable element redirect, what is the honest
mechanic behind each hop, which surfaces are genuinely NET-NEW (no backend) vs existing, and
where do the unresolved IA decisions still live so we don't silently resolve them at build time?

## How to View

Open `index.html` in a browser. Three variants switch via the top tabs.

- **Hover the OD chips** in the legend strip (all 11, present in every variant) for each open
  decision's gap + recommended resolution.
- **Hover the `existing` / `NET-NEW` / `DEAD` / `mode of a thread` kind chips** for the honesty
  note behind each tag.
- In **A (graph)**, *click any node* to highlight its in/out edges and read the "from here you
  can go to…" side list; hover the `⚑ OD-n` markers riding the edges.
- `Esc` clears the current selection and closes any popover.

The whole thing reads in ~3 seconds at rest (calm legend + dashed/dotted node distinction);
detail appears only on node-click or hover (progressive disclosure).

## Variants

- **A · Linkage graph ★ (recommended)** — every surface is a node, every redirect a labelled
  directed edge with the trigger riding the line (plain HTML/CSS/SVG overlay, no graph library).
  Existing surfaces are solid; NET-NEW are dashed; the DEAD AppDock is dotted; the thread-mode
  surfaces are amber. Click a node → its in-edges (green) and out-edges (indigo) light up, the
  rest dim, and the side **inspector** lists where it lives today + every place you can go from
  there (and how you arrive). Three self-loops (project filter, map overlay, the `llm_human_input`
  pause) show intra-surface state that is *not* a route.
- **B · Journey flow** — the happy path as left-to-right lanes/stages:
  `Nav → Workflows page → Build (018) → Refine (019) → Publish gauntlet (020) → Run → Thread (022) → deliverable in FILES`.
  Branch-offs (tweak → new version, block → fix, the escape-hatch sibling thread, the pause)
  hang under the stage they fork from. Click a stage to inspect the surface behind it.
- **C · Layered IA** — the nav-level `ActiveView`s are the top layer; the workflow sub-surfaces
  nest beneath the Workflows page, each carrying its redirect annotation and its
  **three-homes** grouping (Authoring / Library+Launch / Execution). The dead-AppDock note and
  the mobile-drawer requirement sit at the bottom.

## What to Look For

- **The redirect mechanic, shown honestly** — there is no router. Each edge's mechanic line names
  the real move: `setActiveView` (useState view switch), `setProject` (intra-page state),
  `openLaunch` (modal), and the load-bearing one — **Run = create thread + set workflow mode +
  switch to Chat** (`doRun()` creates the thread, sets `active_workflow_run_id`, fires both
  `setSelectedThread` and `setViewingThread`).
- **NET-NEW vs existing, visually distinct** — the Workflows nav entry, Builder (describe/refine),
  draft-CRUD, Launch dialog, and detail pane are dashed/violet; the five existing app views and
  the Workspace panel are solid. The only live backend is `GET /workflows/published` +
  `POST /workflows/{id}/publish` — N9's verdict ABI is the one net-new surface with a live route.
- **The 11 open decisions, never silently resolved** — OD-1..OD-11 ride the relevant edges as
  `⚑` markers (and all 11 sit in the legend), each with its gap and recommended resolution on
  hover. The two unresolved seams on the happy-path spine: **OD-1** (where Publish success
  returns) and **OD-2** (the 018→019 handoff trigger).
- **The Workflows page (N6) is the hinge** — every authoring + launch edge fans out from it, and
  **Run (e11)** is the single edge that leaves a page for a thread.
- **The three-homes rule** — Authoring (the Builder, no Run affordance) hands off; Library+Launch
  (the Workflows page) only launches; Execution lives in a Chat thread. Every edge respects the split.

> **Reference, not a candidate.** `winner: null` — this sketch is the whole-app IA reference for
> the 018–022 set, not a competing UI option to choose from. It is the diagram you consult when
> building any of those surfaces, and the checklist for the open decisions that must be settled
> before they ship together.
