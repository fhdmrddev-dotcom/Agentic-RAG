---
id: SEED-148
title: A workflow that produces a file has nowhere to show it — the run surface, the canvas and the workflow panel render no output files, though the chat surface has had an OutputFileCard for three milestones
status: open   # PARTIALLY CLOSED -- the RUN-SURFACE half shipped in Phase 195; see the 2026-08-19
               # correction in the body. The CANVAS half, the WORKFLOW-PANEL half and the
               # PendingAskCard case remain genuinely open, which is why this stays open.
planted: 2026-08-10
planted_by: Operator, reviewing the workflow product after the v3.6 deploy (2026-08-10) — "if the workflow produces a file at the end, this output is not shown in the output of the workflow in the canvas, also even in the chat area and the workflow panel"
surface: Agentic-RAG
severity: warning
category: product / workflow run observability — the deliverable itself
priority: high
scope: Medium — a rendering + event-plumbing gap, not new capability. Components already exist.
affected_areas: [workflow-run-surface, workflow-canvas, workspace-panel, chat-run-receipt, harness-emit-phase]
related_seeds: [SEED-054, SEED-069, SEED-136]
re_open_trigger: >
  Re-open when ANY of these is true: (1) the next workflow milestone opens — this is the single most
  load-bearing gap on the run surface and should be a requirement, not a seed; (2) any user asks
  "where is my document?" after a run completes; (3) any phase touches `llm_emit` or the run
  surface's phase spine; (4) SEED-069 (living-document re-ingestion) is picked up — it cannot start
  from an output nobody can reach.
---

# SEED-148 — the workflow produces the deliverable and then hides it

## ⚠ CORRECTION 2026-08-19 (discuss-phase 200) — THE RUN-SURFACE HALF IS ALREADY CLOSED, AND THIS SEED HAD BEEN CARRYING A STALE CLAIM FOR A PHASE

**The re-open trigger FIRED at Phase 200**, on two of its own clauses at once — *(1) the next workflow
milestone opens* and *(3) any phase touches `llm_emit` or the run surface's phase spine.* Acting on it
produced a **correction rather than work**, and the correction is recorded here rather than overwriting
the original observation below.

**Measured 2026-08-19 against the shipped tree — Phase 195 (Show the Deliverable) already closed the
run-surface half:**

| Evidence | Where |
|---|---|
| `import { FileRow } from "@/components/files/FileRow"` | `frontend/src/pages/WorkflowRunPage.tsx:63` |
| `downloadWorkspaceFile(runThreadId, fileId, baseName(file.path))` | `WorkflowRunPage.tsx:625` |
| the rows rendered at `density="run"` | `WorkflowRunPage.tsx:1143-1177` |
| both honest empty states — *"No files yet — this run hasn't written anything."* / *"This run produced no files."* | `WorkflowRunPage.tsx:169-170`, each written exactly once and pinned |

So the 2026-08-10 measurement below — *a grep for `output_files` / `outputFiles` over
`WorkflowRunPage.tsx` returns nothing* — **was true when taken and is no longer true.** Under Phase 200's
acceptance rule this is a **green row: verify, do not rebuild.**

⚠ **AND THE PREVIEWER STAYING OUT IS A TESTED DECISION, NOT A REMAINING GAP.**
`WorkflowRunPage.test.tsx` carries an active fence — *"promises no preview: the previewer is neither
imported nor named"* — with its reason recorded verbatim:

> *"DOCX/PPTX/XLSX/PDF are download-only by decision and the template engine emits .docx, so the flagship
> deliverable is exactly the artefact that cannot be shown in place. Req 7 asks that it be listed and
> downloadable — not that it be rendered."*

`panel/FilePreview.tsx` is genuinely capable (markdown → `MarkdownRenderer`, code → `ShikiCode`, csv →
`CsvTablePreview`, text → `<pre>`, images → signed URL, plus a calm *"No preview available · Download"*
arm) — but it is reachable **only from chat**: one mount at `FilesSection.tsx:245`, inside
`WorkspacePanel`, which itself has **exactly one production mount, `ChatLayout.tsx:673`**. Mounting it on
the run surface would buy little, because the most common workflow output is the one format it cannot
render. **Phase 200 leaves the fence standing, deliberately.**

## What is still genuinely open

1. **The CANVAS half** — the canvas still renders no output files.
2. **The WORKFLOW-PANEL half** — `WorkspacePanel` has no mount in any workflow page at all.
3. ⚠ **A case this seed never covered: `PendingAskCard` has NO file affordance.** It previews a draft's
   **text** behind a faded mask (`PendingAskCard.tsx:56-94`), so an `llm_human_input` step asking a person
   to approve a **generated document** has nothing to open. Raised by the operator during
   `/gsd:discuss-phase 200` and deliberately not stacked onto that phase's three backend concerns — it
   needs the ask to carry its artefact on the wire. Related: [[SEED-161]] (in-app document **editing**,
   explicitly not this milestone), [[SEED-110]] (run-time template/file upload), [[SEED-169]] (RunCard's
   file badge reads 0 for a real deliverable), [[SEED-170]] (two shipped comments credit `OutputFileCard`
   for work it does not do).

**Re-open trigger for the remainder:** the follow-on phase to 200 being scoped (it carries the run-panel
sheet and the canvas), OR any phase whose `files_modified` names `WorkflowCanvas.tsx` or
`PendingAskCard.tsx`.

## The observation (operator, 2026-08-10)

> "if the workflow produces a file at the end, this output is not shown in the output of the
> workflow in the canvas, also even in the chat area and the workflow panel."

## The current state, measured 2026-08-10

`grep` over `WorkflowRunPage.tsx` and `components/workflows/*.tsx` for `output_files` / `outputFiles`
returns **nothing**. The components that DO render produced files all live on the chat and panel
side of the app:

```
frontend/src/components/chat/OutputFileCard.tsx
frontend/src/components/chat/MessageItem.tsx
frontend/src/components/chat/RunCard.tsx
frontend/src/components/panel/FilesSection.tsx
frontend/src/components/panel/SeamCard.tsx
frontend/src/lib/fileIcon.tsx        (per-extension icons — already built)
```

So the **workflow run surface half of the report is confirmed by measurement**: nothing there renders
an output file, and the card that would do it already exists one folder away.

⚠ **The chat half is NOT yet measured and must not be inherited as fact.** `MessageItem` and
`RunCard` do render output files for *agent* runs; whether a *workflow* run emits the same event
shape into chat is an open question. Answer it before designing anything — the fix is completely
different depending on whether the event is missing (backend) or merely unrendered (frontend).

## Why this is the most damaging gap on the surface

Everything else on the run surface is *about* the work — phases, status rings, elapsed time,
verdicts. This is **the work itself**. A workflow whose entire purpose is "produce a cited compliance
gap report" finishes, shows a green spine, and does not show the report. The user's own words for the
canvas seal, the phase spine and the run receipt were all about honesty; a surface that reports
success while withholding the deliverable is the least honest thing in the product.

It also blocks the obvious next thing: **SEED-069** (living-document workflow output re-ingestion)
starts from an output the user can see and act on. It cannot begin here.

## ⚠ ANSWERED BY MEASUREMENT 2026-08-17 (`/gsd:discuss-phase 195`) — read this before the sections below

The three questions below were answered at Phase 195's discuss-phase. **The measurements above, from
2026-08-10, are LEFT STANDING rather than overwritten — the drift is the point.**

1. **"Does a workflow run emit output files onto the wire at all?" — YES, and this is NOT a backend
   gap.** `llm_emit` → `_handle_render_template` persists a real workspace file (`ws_write_file`,
   thread-scoped) and emits `workspace_file_written` on the **producer** stream
   (`tool_dispatcher.py:3550-3578`). `harness/phase_types.py:1161-1192` (`_ProducerStreamCtx`) exists
   solely to re-point that stream id so the card appears mid-run. Live local DB: 86 `workspace_files`
   rows, real 37-40 KB `.docx` deliverables on workflow-run threads through 2026-08-16.

2. **⚠ THE `grep` ABOVE WAS TRUE AND MISLEADING — IT SEARCHED FOR THE WRONG NOUN.** `grep output_files`
   over `WorkflowRunPage.tsx` returns nothing because the run surface reads **workspace files**, not
   sandbox `output_files`. **The run surface HAS listed and downloaded a run's files since Phase
   188-10** (`783daab5`, 2026-08 — i.e. it already existed when this seed was planted two days
   later): `useWorkspaceFiles(run.thread_id)` at `:432`, rendered at `:1015-1090`. Measured: **60 of
   61 file-bearing workflow-run threads would show their deliverable exactly.**

3. **The real gap is the one this seed's own §"What already exists and must not be rebuilt" predicted
   — RUN-03, not RUN-02.** There are **four** file presentations: `lib/fileIcon.tsx` (the declared
   single source, consumed by `OutputFileCard` only), `FilesSection`'s own inline map + a copied
   `formatBytes`, `WorkflowRunPage`'s own hand-rolled `iconFor()` + rows, and `lib/fileIcons.tsx` on
   the documents side. **The run surface's own shipped region is one of the duplicates.**

4. **"One file or many?" — and ⚠ the hero/working split this seed points at was RETIRED.** Phase
   095.1 (D-095.1-06) reversed it: `OutputFileCard.variant` is inert, `is_hero` is written-but-unread.
   60 of 61 runs produce exactly one file. Phase 195 ships one uniform quiet list and corrects both
   stale records (ROADMAP SC#3 and the sketch-findings reference, which still names hero as the winner).

Full working: `.planning/phases/195-show-the-deliverable/195-CONTEXT.md`.

## Three questions to answer before building

1. **Does a workflow run emit output files onto the wire at all?** The `llm_emit` phase produces the
   file; check whether the run's event stream carries it, and in what shape. This decides
   backend-vs-frontend.
2. **Where does it belong — and it is probably not the canvas.** The recorded division of labour is
   that the *panel* owns the meaningful phase spine and *chat* carries a thin run receipt. The
   nodes on the canvas are the recipe, not the result. A file card bolted onto a node would fight
   that; the panel's `FilesSection` is the likelier home, with the chat receipt linking to it.
3. **One file or many?** An emit phase per step means a run can produce several. The chat surface
   already solved this with the hero/working split — reuse that judgement rather than re-deriving it.

## What already exists and must not be rebuilt

`OutputFileCard`, `FilesSection`, the per-extension `fileIcon` map, and the hero/working split are
all shipped and design-reviewed. This seed is about **reaching** them from a workflow run, not about
authoring a new file UI. Any plan that proposes a new card component should be challenged.

## Suggested routing

Requirement in the next workflow milestone, near the top. Pair with **SEED-136** — the workflows page
IA and the run surface are the two halves of "what happened and what did I get".
