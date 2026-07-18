---
sketch: 073
name: workflow-delete-cascade
question: >-
  How does deleting a published workflow — an action with downstream VICTIMS
  (versions, past runs, the chat threads runs created) — read as deliberate and
  honest, and how is the cascade disposition (delete vs preserve) made explicit
  so no orphaned runs/threads are left behind (WFIN-03)?
winner: "A"
tags: [phase-152, wfin-03, workflow-delete, cascade, victim-naming, confirm-sheet, archive-vs-delete, lifecycle, in-flight-run, audit-recorded, honesty]
---

# Sketch 073 — Workflow Delete &amp; Cascade

> Reuses the **operator "victim-naming confirm sheet"** vocabulary shipped in sketches
> 064 (Kill run) / 068 (disable user): an action with a victim states *exactly* what it
> touches, whether it's reversible, and that it's **recorded with your name**. WFIN-03's
> hard requirement — *"no orphaned runs or threads"* — makes the **cascade disposition the
> core content**, not decoration; this sketch puts it on screen for the discuss-phase to lock.

## Design Question

A published workflow has downstream ties: multiple **versions**, **past run records**, and
the **chat threads** those runs created (each run is a mode of a real thread). Deleting must
be safe and legible — the user has to see what disappears and what survives *before* they
commit. The genuinely-open call (flagged in the roadmap: *"disposition made explicit at
discuss"*): are past runs/versions **hard-deleted**, and are the **threads preserved** (become
normal chats) or removed? And should delete even be the primary verb, or should **archive**
be the safe default?

Concrete: delete **Vendor-risk portfolio review v4** — 2 versions, 5 past runs, 5 chat threads,
last run 2h ago. The `⚡ in-flight run` toolbar toggle exercises the edge case where one run
is streaming *right now*.

## How to View

open .planning/sketches/073-workflow-delete-cascade/index.html

*(The confirm sheet auto-opens so each variant is immediately visible; the ⋯-menu on the card
shows the real entry point.)*

## Variants

- **A: Victim-naming sheet** *(the 064/068 pattern)* — a calm confirm that names two explicit
  groups: **Permanently removed** (definition · 2 versions · 5 run records) and **Kept — not
  touched** (5 chat threads become normal chats; KB & folders untouched). One danger button,
  recorded-with-your-name footer. Lowest friction that's still honest.
- **B: Type-to-confirm** — same cascade list, but the danger button stays **disabled until you
  type the workflow name** (GitHub-style). Highest friction; best guard against an accidental
  delete of a heavily-used workflow.
- **C: Archive vs Delete two-door** — surfaces the disposition as a **choice**: **Archive**
  (reversible — hides it, stops new runs, keeps everything) as the safe default vs **Delete
  forever** (the full cascade). Reframes the primary action away from destruction.

## What to Look For

- **Cascade honesty:** does the removed/kept split read instantly? The **"5 chat threads
  become normal chats — transcripts & files stay"** line is the load-bearing reassurance
  (WFIN-03: no orphaned threads).
- **Disposition decision:** the sketch shows a *proposed* disposition (versions + runs deleted;
  threads detached-but-kept). Is that the right call, or should runs/threads also archive? → the
  discuss-phase lock.
- **In-flight edge:** toggle `⚡ in-flight run` — the amber banner ("cancel it first via the
  safe heal path, then delete") mirrors 064's `cancel_run`/zombie-heal honesty. Does delete
  need to block, or cancel-then-delete?
- **Right friction:** A (one click) vs B (type-to-confirm) vs C (archive default) — which
  matches the weight of losing a workflow + its run history?
- **Recorded:** the "✎ recorded with your name in the audit log" footer — consistent with every
  operator write.

## Honesty — REAL-NOW vs NET-NEW

| Element | Status | Note |
|---|---|---|
| ⋯-menu on the workflow card (Open / Tweak / Run) | **REAL today** | `WorkflowsPage.tsx` |
| Delete affordance + cascade + confirm | **NET-NEW** | WFIN-03 — new endpoint + cascade over definitions/versions/runs |
| Thread detach-but-keep on delete | **NET-NEW (proposed)** | disposition to lock at discuss; clears `active_workflow_run_id`, keeps the thread |
| Archive path (variant C) | **NET-NEW (optional)** | only if discuss picks soft-archive over hard-delete |
| Victim-naming sheet + audit-recorded pattern | **REAL pattern** | shipped in 064/068 operator surfaces — reused, not invented |
