# Approval & Review — the stop sign, the review moment, the round trip

Synthesized from sketches **144** (the approval stop sign), **145** (the review moment, winner **A**) and
**146** (the round trip, winner **A**). Phase 185 GOVERN-03, with findings that belong to **188**, **186**
and **190**.

---

## ⚠ TWO ENGINE TRUTHS — read these before writing any approval code

Both found by reading shipped code while sketching. Both **falsified a claim an earlier sketch made**.
Both are **Phase-185 scope items**, not UAT details.

### 1. The approval gate expires into "yes"

`_exec_llm_human_input` (`backend/app/services/harness/phase_types.py`):

```python
timeout_seconds = min(phase.config.timeout_seconds,        # default 300
                      settings.ask_user_max_timeout_seconds)  # hard cap 1800
payload = await subscribe_for_response(redis, run_id, tool_call_id, float(timeout_seconds))
...
answer = ""                                    # ← on timeout, payload is None
return {"text": prompt, "answer": answer, "tool_call_id": tool_call_id}   # ← RETURNS NORMALLY
```

A normal return means **the workflow advances**. Five minutes of silence and the next step runs — in the
canonical example, that step sends the email.

**GOVERN-03 may reuse the `llm_human_input` SUBSTRATE** — the durable prompt row, the `tool_call_id`, the
boot-time resume sweep — **but must NOT inherit its timeout disposition.** An action-risk gate has to
**fail closed**: no answer means it never proceeds, however long that takes. Engine change; put it in the
plan.

### 2. The flagship deliverable is the one artefact that cannot be previewed

`FilePreview.tsx` routes by mime/ext:

| Output | Renders inline |
|---|---|
| Markdown | ✅ `MarkdownRenderer` |
| Plain text | ✅ `<pre>` |
| Code | ✅ `ShikiCode` |
| CSV | ✅ `CsvTablePreview` |
| Image / chart | ✅ `<img>` |
| **DOCX / PPTX / XLSX / PDF** | ❌ download-only fallback |

And `llm_emit` + the `render_template` emitter (docxtpl, Phase 101) — the "attach a Word template, the AI
fills it" path — produces **`.docx`**. So the most important artefact a workflow makes is the one a
reviewer **cannot see**.

**Status: DEFERRED with a trigger** (operator, 2026-07-28 — *"we will decide later if we will render
directly"*). Decide at `/gsd:spec-phase 185`; **re-open unconditionally at Phase 190**, when live
connectors make an unread-but-approved document something that really leaves the company.
**The behaviour is NOT deferred** — until it is decided the surface says so out loud and records
*approved without a preview*.

---

## 144 — the stop sign is a gate ON the risky step

Settled before drawing (operator): **never an extra step in the flow.** Step count and numbering stay
true — "step 4 of 5" keeps meaning what it says. Whether it materialises as an `llm_human_input` phase
underneath is an engine detail the canvas hides.

Two shapes drawn, **no winner locked** — 145/146 overtook it:

- **A: a collar** on the step's bottom edge. Impossible to miss or mis-assign; but the collar, the run
  chip and the editing actions now all want that edge.
- **B: a checkpoint on the incoming connector.** Nothing added to the card, and the pause reads as what
  it is — the run stopping *before* the action. But the mark is 30px in the gap between steps (where the
  eye skips) and its label is wider than the 66px connector it sits on.

### The finding that outlives the shape

The canonical example deliberately arms the email step and **leaves the shared-drive step unarmed**, on
screen at all times. Harmless today; **the entire risk the moment Phase 190 ships.**

> **The default must be ARMED-ON.** A new external-action step arrives with its checkpoint set. Turning
> it off is the deliberate act.

Consistent with Phase 189 SC#2, which already commits that the external-action node "carries the
Phase-185 action-risk approval checkpoint **by default**".

---

## 145-A — the review moment: the document IS the surface

**Winner: A over B.** The thing you are being asked about fills the screen and the approve bar is docked
to it, so **decision and evidence are one object — you cannot press Send without the report in front of
you.** B (steps left, deliverable in the shipped preview panel right) stays on file; it reuses more built
components but splits the decision from the evidence.

### Where the earlier sketches cash in

The marks go **inside the document**: every risk row carries the source it came from, and the severity
column is marked **"AI judgement"** — a severity rating is an assessment, not a quotation, and pretending
otherwise is the exact dishonesty the milestone opposes.

The coverage line is the shipped `check_coverage` output shape, not a slogan:

> ⛨ **18 of 18** values traceable to a source · **0** invented sources · the severity ratings are the
> AI's judgement, not a document

(`citations_required` deterministic mode returns `uncited_value_count`, `invented_citation_count`,
`uncited_leaves`.)

### Three honesty cases any approval surface must handle

1. **Cannot preview it.** Say so in as many words, offer the download first, and when the user approves
   anyway **record it as *approved without a preview***. An approve-blind that renders identically to a
   real review is the failure mode.
2. **A 40-page deliverable.** Nobody reads it at 5pm. Lead with what a reviewer needs: total coverage,
   **which sections are the AI's own assessment rather than quotation**, and what changed since the last
   approved version.
3. **No artefact at all.** The step updated a record and moved on. An empty frame would be worse than a
   sentence saying there is nothing to read — *you are approving the action, not a deliverable.*

---

## 146-A — the round trip: one place

**Winner: A over B.** The canvas you built on is the canvas you watch. Launching takes you nowhere; a
pause **grows the document over the canvas**, which stays visible behind it; approving closes it and you
are already where the run continues. **No hand-off, no "where did it go", no return destination to
decide.**

The cost the build inherits: **the canvas carries two jobs** (design-time editing, run-time watching) —
which is exactly the "one run stream, two views" shape Phase 188 already commits to. B (build here, run
there) stays on file if the canvas proves too loaded once 188 and 189 both land on it.

### The run surface is NOT the chat stream

Operator, 2026-07-28: *"we click the workflow, it runs, then I see it suddenly in the chat."* Verified —
`WorkflowsPage.tsx` launches by creating a thread and **redirecting into Chat**. The Phase-103 decision
(panel owns the spine, chat carries a thin receipt) is implemented, but the user is still standing in
chat.

**Both 145 and 146 are drawn on a dedicated workflow run surface — its own header, its own compact spine,
no message list and no composer.** That is a **proposal to Phase 188**, not a commitment inside 185.
Start there rather than re-deriving it.

### The journey ribbon

`Building it › Running › Needs you › Reading it › Running on › Done`, with a persistent
**"You are on …"** line. If a user cannot answer *where am I and how do I get back* at any point, the
transition is wrong.

### "Executing" and "waiting for a person" must never share a word

```js
// Pitfall 4 in miniature — caught in 146's alignment pass
if (st === 'now') return state === 'running' ? 'Running now' : 'Waiting for you'
```

---

## The other failure modes, with owners

| What went wrong | Required behaviour | Owner |
|---|---|---|
| **Nobody answered** | Must NOT proceed. Fail closed | **Phase 185** (engine change) |
| **You closed the tab** | The durable prompt row survives and the resume sweep re-subscribes — **but the clock keeps running.** "Survives a refresh" and "waits for you" are different promises; only the first is true today | Phase 185 |
| **Someone else approved it** | Buttons disappear and name **who** decided and when — never a silent failure on the second click. Workflows are org-shareable | **Phase 186's run-time twin** — name it there |
| **Next step failed after you approved** | The approval is **not undone** and must never look like it was — step 4 approved/green, step 5 failed/red. **Retrying step 5 must not silently re-run step 4 and send a second email** | Phase 185 / 188 |

---

## CSS patterns

### The document page (a deliverable rendered in a dark app)

```css
/* a real document reads as paper, not as another dark panel */
.page {
  background: #f7f7f4; color: #1c1c1a; border-radius: 4px; padding: 34px 40px 40px;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,.8);
  font-family: "Georgia", serif; font-size: 13px; line-height: 1.7;
}
/* backed by a document */
.cite { display: inline-block; font-family: var(--font-sans); font-size: 9.5px; color: #2d6a4f;
        background: #dff0e6; border: 1px solid #a9d5bd; border-radius: 4px; padding: 0 4px; }
/* the AI's own assessment — a different colour AND a different word */
.opin { display: inline-block; font-family: var(--font-sans); font-size: 9.5px; color: #7a5a11;
        background: #f6ecd2; border: 1px solid #e0cb96; border-radius: 4px; padding: 0 4px; }
```

### The docked approve bar (145-A)

```css
.dock {
  flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 13px 20px;
  border-top: 1px solid hsl(38 92% 62% / .45); background: hsl(38 30% 10% / .96);
}
```

### The review grows over the canvas (146-A)

```css
.reviewLayer {
  position: absolute; inset: 0; z-index: 20; display: none; flex-direction: column;
  background: hsl(220 32% 5% / .93); backdrop-filter: blur(6px);   /* canvas stays visible behind */
}
body.reviewing .reviewLayer { display: flex; }
/* B — a different place, so the canvas is not behind it at all */
body.vb .reviewLayer { background: var(--color-bg); backdrop-filter: none; }
body.vb.reviewing .canvasLayer { display: none; }
```

### The "we cannot show you this" block

```css
.cannot {
  padding: 26px 24px; border-radius: 14px; text-align: center;
  background: hsl(0 55% 14% / .5); border: 1px dashed hsl(0 72% 55% / .55); color: hsl(0 85% 84%);
}
```

---

## What to avoid

- **An approve bar with nothing to look at.** 144's first draft said *"the report is ready · Send it /
  Not yet"*. A checkpoint you cannot see through is a rubber stamp.
- **Letting approve-blind look identical to a real review.**
- **Claiming the run waits** unless the fail-closed change has actually shipped.
- **Rendering a Word deliverable as if it previews** — it does not, today.
- **Making an outbound step armed-off by default.**
- **Conflating "running" with "waiting for you".**
- **An empty preview frame** when there is no artefact — say there is nothing to read.
- **A helper/note card sitting on the approve control.** Reserve a bottom band; verified 0 overlaps
  across every state combination in 144/145/146.

---

## Origin

Synthesized from sketches: **144**, **145**, **146**.
Source files: `sources/144-the-approval-stop-sign/`, `sources/145-the-review-moment/`,
`sources/146-the-round-trip/`.
