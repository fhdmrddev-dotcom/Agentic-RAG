---
id: BUG-260908-01
title: The Chunks section renders every chunk with no height bound, so expanding it buries every section below it — a 1,000-chunk document makes the rest of the detail panel unreachable
reported: 2026-09-08
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/metadata, frontend/document-detail-panel, DocumentChunksSection.tsx, DocumentDetailPanel.tsx, UX/navigation]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: dc021defc
  date: 2026-09-08
---

# BUG-260908-01: the Chunks section has no height bound, and it buries everything under it

## What we observed

Open any document in the Library and click it to open the right-side detail panel. Expand the
**Chunks** section. **Every chunk is rendered, inline, with no cap and no bounded scroll area.**

The sections below Chunks are still there — they are simply pushed down by the full height of the
chunk list. On a document with ~1,000 chunks, reaching the next section means scrolling past ~1,000
cards. The operator's words: *"suppose that I have 1000 chunks I have to scroll down 1000 times to
reach to the next menu."*

**Measured in the code, not inferred** (`frontend/src/components/metadata/DocumentChunksSection.tsx`,
147 lines, at `dc021defc`):

- **line 102** — `{rows.map((row) => (` … renders the full `rows` array. There is no `slice`, no
  cap, no windowing, and no `max-h` on the list container.
- **line 140** — `className="max-h-32 overflow-auto …"` bounds each **chunk body**. So the
  *individual* chunk is already capped — it is only the **list** that is unbounded. The pattern the
  fix needs is therefore already present in the same file, one level down.
- **line 57** — `onTotalChange?.(res.length)`; the total is already known and already lifted to the
  parent, so a count is available with no new plumbing.

## Why it matters

**An accordion's promise is that expanding one section does not cost you access to the others.** This
section breaks that promise, and it breaks it in proportion to how much content a document has — so
the failure gets worse exactly as a document gets more valuable. It is not a rendering artefact; it
makes shipped surfaces (the sections below Chunks) effectively unreachable on large documents.

Two consequences worth separating, because a fix can close the first and leave the second:

1. **Navigation** — the sections below Chunks cannot be reached in reasonable time. This is the bug.
2. **Finding a chunk** — even inside a bounded box, scanning 1,000 items by eye is not a workflow.
   That is a missing capability, not this defect, and should not be smuggled into the fix.

Severity `major` rather than `blocking`: nothing is lost or corrupted, and small documents are
unaffected. It degrades with corpus size, which is the direction this product is moving (v4.0
Connected Knowledge ingests watched folders continuously, so chunk counts grow without anyone
choosing it).

## Hypothesized cause

**Hypothesis, not finding.** The section was authored against documents with a handful of chunks,
where an unbounded list is indistinguishable from a correct one. The per-chunk `max-h-32` at line 140
suggests height bounding was considered at the item level and simply not carried up to the list.
Nothing suggests a deliberate decision to render unbounded.

## Suggested fix direction (NOT a design decision — the operator's call)

Recorded so the routing conversation starts from something concrete. **Not ranked as a verdict.**

- **Bound the list, scroll inside it.** A `max-h-*` + `overflow-y-auto` container around the
  `rows.map`, so the section occupies a fixed slice of the panel at any chunk count. Smallest change
  that actually closes the navigation failure; the same pattern already exists at line 140.
- **A filter box and an "N of M" counter**, for the *finding* problem above. `onTotalChange` already
  carries the total.
- **Virtualise the list** if it feels slow after the height cap — ⚠ **measure first.** 1,000 chunk
  cards is a lot of DOM, but adding windowing machinery on an assumption is how a simple fix becomes
  a phase.
- ⛔ **A "Show first 20 / Show all" button is NOT a fix.** It looks like one and relocates the
  problem to the moment someone presses it.

⚠ **G-2 applies** — this is live UI, so a sketch should precede a plan.

## Surface classification

`Agentic-RAG` — this app's own document detail panel. A routing candidate at the GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** **n/a — and deliberately so.** Phase 239 (Any MCP Server With Files)
  is in gap-closure at the time of filing. Folding a new user-facing capability into a closure round
  is precisely the pattern **G-7** exists to stop — *"a closure round may NEVER introduce a new
  user-facing capability: that is a phase, not a gap."*
- **Defer to future phase / milestone:** a Library/document-detail phase. ⚠ Note `DocumentDetailPanel.tsx`
  measured `9 / 6 / 496` at the last ledger derivation and **fires G-5**, so whichever phase takes
  this reads that file's section in `docs/HOT-FILE-LEDGER.md` before planning.
- **Plant as seed:** n/a — this is an observed defect with a live repro, not a deferred idea.
