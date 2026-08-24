---
sketch: 171
name: one-run-one-slot
question: "What does the kickoff moment render, such that two assistant nodes cannot be drawn — without first knowing which of the three candidate mechanisms is live?"
winner: "C — AMENDED (2026-08-16). ⚠ C AS DRAWN WAS REFUTED BY MEASUREMENT AFTER THE PAGE WAS BUILT, and the refutation is recorded rather than the page quietly corrected: C claims 'the never-vanishes strip covers the gap', and there is NO such strip at kickoff. The list-level `RunStatusStrip` (`MessageList.tsx:217`) is gated on `showJumpToLive = !isPinned && isStreaming` — it appears ONLY when you have scrolled away — and the only always-present strip is INSIDE `RunCard`, i.e. inside the very assistant message C proposes not to render. C as drawn produces dead air for the whole first-token latency. THE AMENDMENT: C requires BUILDING a run-anchored line at list level — which is the SAME element 170-B needs, so the two converge into one component with a live state and a terminal state. A rejected: its dedup key does not exist for harness runs (`runs.message_id` NULL on 587/607). B rejected on SCOPE, not correctness — it implies persisting `message_id`, a backend change, in a phase whose ROADMAP entry says it adds no new runtime path; re-open B if the amended C proves insufficient."
tags: [phase-194.1, bug-260610-01, duplicate-avatar, kickoff, run-honesty, unmeasured-mechanism, g-2]
---

# Sketch 171: One run, one slot

> Fourth of four for Phase 194.1, and the one that was **added on request** rather than
> derived from a success criterion. It is included because there is a real design question
> here — but **not the one it looks like.**

## How to view

```
start .planning/sketches/171-one-run-one-slot/index.html
```

Five tabs: **Today (the artefact)** · **A · Dedupe harder** · **B · One owned slot** ·
**C · No placeholder at all** · **Why nobody knows the cause**.

Press **▶ Play the kickoff** on any tab — it steps through *optimistic mount → first SSE
event → first content*. Two driver axes: provider first-token latency (fast / slow) and
surface (workflow run / plain chat, because the operator reports it on both).

## ⚠ Read this before the variants — the question was deliberately reframed

The obvious question is *"how do we stop the duplicate avatar?"* **This sketch does not ask
that, and it must not**, because Phase 194 tried to establish the mechanism and recorded that
it failed. `194-MEASUREMENTS.md` opens:

> **VERDICT: ⏸ NOT MEASURED — DEFERRED with a trigger** … *"The word 'probably' appears
> nowhere in this file, and neither does a verdict."*

Three mechanisms remain consistent with the evidence:

| Candidate | What the client store would show | Fix |
|---|---|---|
| 174-04 mount / first-SSE race | two `temp-` rows | ordering fix in the render path |
| `BUG-260609-03` class | one `temp-` + one persisted | persist `message_id` for harness runs — **backend** |
| Does not reproduce | exactly one row | nothing |

They are separated **only** by a live store dump taken while a harness run is streaming, and
that dump does not exist. Both operator samples were disqualified — one was not a workflow run
at all (no `workflow_runs` row), and one was already `completed`, and the symptom is a
**streaming-time** condition, so a post-completion snapshot *structurally cannot* observe it.

**So the question this sketch asks instead is:** *is there one owned slot per run at all?*
That one is answerable today — and **B and C make the mechanism moot, while A requires knowing
it.** That asymmetry is the finding.

Phase 174 **D6** already decided the *outcome* ("one avatar"). This does not re-litigate it;
it asks what shape makes the outcome structural rather than defended.

## The variants

| | Approach | Adds | Risks |
|---|---|---|---|
| **A** | **Dedupe harder.** Keep both renderers, make the collapse smarter. Not really a proposal — **the status quo drawn honestly**; `dedupMessages.ts` already carries a runId-dedup exemption for harness rows (`:20-26`) and a narrow 174-04 collapse (`:31-45`). | Nothing new. | **The key does not exist.** `runs.message_id` is NULL on **587 of 607** rows whose thread owns a `workflow_run` (96.7 %, all 25 most recent), so `dbRunIds` cannot hold the run id. A Deep run sets it and it points exactly at the row that rendered. A asks a missing key to do the work. |
| **B** | **One owned slot per run.** The thread renders exactly one assistant node for the active run, keyed on the run; the optimistic row, the first SSE event and the persisted row all *fill* it. | Two mounts collapse **structurally** — the mechanism stops mattering. | **A run-keyed slot needs a run key**, i.e. the 96.7 % NULL above. B implies persisting `message_id` for harness runs — a backend change, in a phase whose ROADMAP entry says it *"adds no new runtime path."* Most correct, most likely out of scope. |
| **C** | **No placeholder at all until there is something to say.** No avatar, no shell. The run's presence is carried by the **status strip that never vanishes** (sketch 015), anchored to the run rather than to a message. | Zero backend. **Two of nothing is nothing.** | A gap on slow providers where the transcript shows a prompt and no reply. Drive the *slow* setting — that is where C is tested. |

## What to look for

1. **Play the Today tab on *fast*, then on *slow*.** On fast it reconciles in about a second —
   which is exactly why point-in-time screenshots kept catching only one avatar and the
   operator's eye caught two. `BUG-260610-01`'s Phase 121 update says this in as many words:
   *use video or rapid frames, not single snapshots.*
2. **Play C on *slow*.** Several seconds of transcript with no reply in it. The claim is that
   the strip covers the gap — *the run is visibly running, it just has not spoken.* **If that
   gap feels dead rather than calm, C is wrong and the phase needs B.** That is the judgement
   this sketch exists for.
3. **Switch the surface to *plain chat*.** The operator's 2026-08-16 note is that it happens
   *"not only [in] the workflow, it is in the chat area."* Whatever wins must be judged on the
   Deep path too — and 174's D-14 holds Deep byte-identical, so a workflow-only fix is a
   scoping decision, not a default.
4. **On B, watch the dashed slot outline at the first-SSE step.** The event *fills* the node
   instead of mounting beside it. That is the entire mechanism.

## ⚠ C AS DRAWN WAS REFUTED — after the page was built, by measurement

**Recorded here rather than quietly corrected on the page, because a sketch that silently
repairs its own losing argument teaches nobody anything.**

C's whole claim is that removing the kickoff placeholder is safe *because the never-vanishes run
status strip carries the run's presence instead*. **There is no such strip at kickoff.** Measured
at `045a83dc`:

```
MessageList.tsx:217   <RunStatusStrip … placement="header-bare" />
MessageList.tsx:193   showJumpToLive = !isPinned && isStreaming      ← the gate
```

The list-level strip renders **only when you have scrolled away** — it is the `↓ Jump to live`
chip. The only always-present `RunStatusStrip` is at `RunCard.tsx:336`, in the run-card
**header** — i.e. **inside the very assistant message C proposes not to render.**

⇒ C as drawn produces **dead air**: the prompt, then nothing, for the whole first-token latency,
with no instrument saying a run is underway. On the *slow* setting that is several seconds. The
page's own instruction — *"if that gap feels dead rather than calm, C is wrong"* — is answered,
and the answer is that it would have been dead.

### The amendment, and it is what makes C the pick anyway

**C requires BUILDING the run-anchored line at list level** rather than assuming one. And that
line is **the same element `170-B` independently needs** — a thread-level reading derived from
`workflow_runs` that does not live inside a message.

> **One component, two states.**
> live: `◆ Starting workflow… · Step 2 of 3 · 2m 18s`
> stopped: `⊘ Stopped by you · 2 of 3 steps · 2m 18s · Open the run ›`
>
> The assistant message then renders **only when it has content**, so at kickoff there is no
> assistant node for a double-mount to duplicate — and on return the line is still there.

That convergence is the reason C survives its own refutation: the cost it was hiding turns out to
be a cost `170-B` was already paying.

## ⚠ What this does and does NOT guarantee

Asked for *"the best ones that guarantee perfect results"* — so, precisely:

| | |
|---|---|
| **Guaranteed** | At the workflow kickoff there is **no assistant node**, so the artefact cannot be drawn twice — **regardless of which of the three candidate mechanisms is live.** That is a structural property, not a fix. |
| **NOT guaranteed** | The double-mount **race is not repaired.** The surface it rendered on at kickoff is removed. If the same race later affects the **content-bearing** message, the artefact returns — and nothing here would have prevented it. |
| **NOT covered** | **Plain chat.** The operator reported the duplicate *"not only [in] the workflow, it is in the chat area."* Deep also renders `Setting up agent…`, and changing it breaks the *Deep byte-identical* constraint held since Phase 174 (D-14). **This closes the workflow half only** — the Deep half is a scoping decision for `194.1-CONTEXT.md`, not something to do silently. |
| **Still owed** | The measurement trigger in `194-MEASUREMENTS.md` is **not discharged**. A qualifying store dump would still tell us which mechanism is live — worth taking if one appears, because it is the difference between "cannot render twice here" and "cannot render twice." |

## ⚠ A G-5 finding this pick surfaces

`frontend/src/components/chat/MessageList.tsx` — where the run-anchored line would mount — is
**absent from the `CLAUDE.md` hot-file ledger**. Measured: **18 commits**, at least **6 phases**
(`063 068.5 076.1 083 092 095`, plus untagged buckets), **234 lines**. G-5's threshold is 3.

That is the identical invisibility failure `WorkflowsPage.tsx` suffered for ten phases,
`WorkflowDoorSwitch.tsx` for six and `db/workflows.py` for seventeen — *a guardrail cannot see
what is absent from its list.* **It should be added to the ledger at discuss-phase**, and the
phase then owes a refactor recommendation on it as a first option.

## C does not contradict Phase 174 — it relocates it

D4 replaced the dead *"Setting up agent…"* with an honest live sub-state naming what the model
is doing; `toolMeta.ts:182` already picks *"Starting workflow…"* for a harness thread. D5 put
the activity pill, the anchored timer and the single avatar in the run-card **header**. C keeps
that sentence and moves it into the strip, where it belongs to the run rather than to a
message — D5 followed to its conclusion.

## ⚠ Two things this sketch does not do

1. **It does not claim a cause.** `BUG-260610-01`'s own update records the 2026-08-16 sighting
   as *"an operator observation, not a measurement"* that *"needs a DOM-level repro before
   anyone claims a cause."* The artefact drawn on the Today tab is **reconstructed from the
   reports and screenshots**, not from a DOM capture.
2. **It does not discharge the measurement trigger.** A qualifying sample still needs a thread
   with a `workflow_runs` row and an assistant row reading `runStatus: "streaming"`.
   ⚠ The plan's own console snippet **does not work as written** — `useStreamsStore.getState()`
   is not exposed on `window`. The dev-server form is
   `const { useStreamsStore } = await import('/src/stores/streamsStore.ts');`

## The other reason this sketch is worth having

`BUG-260610-01` spent **two months invisible to every `/gsd:discuss-phase` sweep.** Its
frontmatter read `status: folded` while its own `re_open_trigger` ended *"The duplicate-avatar
symptom … is **NOT folded** … Stays OPEN."* The routing scan reads the frontmatter, not the
prose — the same class of failure as a hot file missing from the G-5 ledger: **a guardrail
cannot see what is absent from its list.** Corrected to `status: open` on 2026-08-16.

## PROVENANCE

| Region | Status |
|---|---|
| *"Starting workflow…"* / *"Setting up agent…"*, chosen by `isHarness` | **shipped verbatim** — `toolMeta.ts:182` |
| The never-vanishes run status strip | **shipped design** — sketch 015 / Phase 174 D5 |
| The 96.7 % NULL figure, the three candidate mechanisms, the disqualified samples | **measured** — `194-MEASUREMENTS.md`, live DB 2026-08-16 |
| **The owned slot (B) and the empty kickoff (C)** | **PROPOSAL** |
| The duplicate artefact as drawn | ⚠ **RECONSTRUCTED** from reports and screenshots — not a DOM capture |
