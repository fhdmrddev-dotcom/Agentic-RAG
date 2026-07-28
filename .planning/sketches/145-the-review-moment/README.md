---
sketch: 145
name: the-review-moment
question: "The run has stopped and is asking you to approve sending a document. What do you actually see before you say yes — and where are you standing when you see it?"
winner: null
tags: [phase-185, govern-03, review-moment, artefact-preview, check-coverage, run-surface, workflow-vs-chat, phase-188-input, approve-blind-honesty, g2-sketch-gate]
---

# Sketch 145: The review moment

## Two operator questions that turned out to be one

**(1) "When we reach a step that needs human review — the report could be a Word or PDF artefact — how
does the user view it before deciding to proceed with the email?"**

Sketch 144 did not answer this. Its approve bar said *"the report is ready · Send it / Not yet"* and gave
you nowhere to look. **A human checkpoint you cannot see through is a rubber stamp, not a control.**

**(2) "Workflows currently run and appear in the chat. We need to isolate or distinguish a workflow from
normal chat."**

Verified in code rather than taken on trust: `WorkflowsPage.tsx` launches a workflow by **creating a
thread and redirecting into Chat**. The panel does own the phase spine and chat carries only a thin
receipt (the Phase 103 decision) — but you are still standing in the chat surface while a workflow runs.

**You cannot draw "what do I see before I approve" without deciding where you are standing when you see
it.** So both variants are drawn on a **dedicated workflow run surface** — its own header, its own spine,
**no message list and no composer.**

That shared move is this sketch's real proposal, and it is **evidence for Phase 188** (Non-Technical Run
Observability — *"a business view distinct from the developer timeline, painted from the same run
stream"*), not a commitment inside Phase 185.

## How to View

```
open .planning/sketches/145-the-review-moment/index.html
```

## The two variants

- **A: The document is the surface.** The thing you are being asked about fills the screen; the approve
  bar is docked to it. Decision and evidence are one object — **you cannot press Send without the report
  in front of you.** The five steps compress to dots in the header.
- **B: Steps on the left, document on the right.** The run reads as a list of steps, and the deliverable
  opens in the panel that already ships for previewing files (`FilePreview` / `CsvTablePreview` /
  `FilesSection`). Approve buttons sit on the paused step. Familiar and reuses built components — but the
  decision and the evidence are two objects side by side.

## Where the earlier sketches cash in

This is the screen that makes the whole phase worth building:

| Sketch | Decided | Pays off here as |
|---|---|---|
| 142 | which steps must back up what they say | — |
| 143 | how a proven step is marked on the canvas | the ⛨ on steps 1 and 3 in the spine |
| 144 | the run stops before the email | the pause you are standing in |
| **145** | — | **the marks inside the document itself** |

Every risk in the table carries the source it came from. The **severity column carries "AI judgement"**,
because a severity rating is an assessment, not a quotation — and pretending otherwise would be the exact
dishonesty this milestone exists to prevent. Toggle **Backing marks → Plain document** to see how much
that is doing.

## Real, not decorative

- **The coverage line is the shipped `check_coverage` output.** The `citations_required` validator in
  `validator_kinds.py` runs in deterministic mode and returns `uncited_value_count`,
  `invented_citation_count` and `uncited_leaves`. *"18 of 18 values traceable · 0 invented sources"* is
  that function's actual shape, not a slogan.
- **The document is produced by `llm_emit` with the `render_template` emitter** (docxtpl, Phase 101) —
  the shipped "attach a Word template, the AI fills it" path.
- **B's panel is the shipped preview stack**, not a second one invented for this sketch.

## The two honest cases, which matter more than the layout

**"Something we cannot show."** A PDF the preview stack cannot render. The screen says so in as many
words — *"approving now means approving something you have not read. That is allowed. It is not
hidden."* — offers to download it first, and when you approve anyway the record says **approved without
a preview**. An approve-blind that looks identical to a real review is the failure mode; this makes the
two visibly different.

**"A 40-page report."** Nobody reads 40 pages at an approval moment and pretending otherwise helps
nobody. So the surface leads with what a reviewer actually needs: total coverage, **which sections are
the AI's own assessment rather than quotation**, and what changed since the last approved version.

**And in both: pressing *Not yet* holds.** The run waits until a person decides — it does not quietly
time out and send.

## What to Look For

1. **Before approving — which numbers came from a document, and which are the AI's opinion?** Then turn
   the marks off and ask how confident you would be.
2. **Switch to *Something we cannot show*.** Does it stop you, or does approving look the same as before?
3. **Switch to *A 40-page report*.** What do you get instead of 40 pages?
4. **Which variant would you rather be in at 5pm on a Friday** — the document filling the screen with the
   decision attached to it, or the step list with the document beside it?

## Verification

Driven in Chrome DevTools at 1440×900 across both variants × all three artefact states × both marking
modes: the citation and judgement marks (4 of each) and their disappearance under *Plain document*, the
coverage strip, the un-previewable block with its download path and its *approved without a preview*
record, the 40-page summary, both approve outcomes in both variants, and B's paused-step actions. 0
overlaps between the helper card and the approve bar, the document, the step rows or the file panel
across all six state combinations. No console errors; inline JS passes `node --check`; zero inline `on*`
handlers.
