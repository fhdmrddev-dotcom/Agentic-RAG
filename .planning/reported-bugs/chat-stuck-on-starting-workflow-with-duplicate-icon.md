---
id: BUG-260815-04
title: While a workflow runs, the chat area keeps a duplicate assistant icon and stays stuck on "Starting workflow…"
reported: 2026-08-15
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/chat, frontend/streaming, workflow/run-surface]
folded_into: 194
verified_closed_by: null
related_seeds: []
re_open_trigger: "⚠ FOLDED AT /gsd:discuss-phase 194 (2026-08-16) — STATE.md had recorded the routing since 2026-08-15 but this frontmatter still read folded_into: null, which is why the routing was invisible to every audit that reads frontmatter. It blocks SC#1 directly: if the chat surface never leaves its pre-tools state a user cannot tell a run is running, let alone reach a Stop — and it may be what defeats stopThread's `runStatus === \"streaming\"` scan (StreamsProvider.tsx:2400-2416), which is how three of the four Stop mounts find their run id. ⚠⚠ THE STRING IS DELIBERATE AND BYTE-PINNED — DO NOT REWORD IT (toolMeta.ts:92, pinned by toolMeta.test.ts:30 as a D-14 decision). The defect is that the surface never ADVANCES out of the pre-tools condition while workflow_phases rows are being written throughout. The duplicate-assistant-icon symptom is kept SEPARATE and may have a different cause. Re-open if 194 closes only the banner-advance half. ⚠ THAT LAST CLAUSE HAS NOW FIRED, AND IT IS RECORDED HERE BESIDE THE ORIGINAL RATHER THAN OVER IT (plan 194-05, 2026-08-16). Phase 194 closes the BANNER-ADVANCE half ONLY — plan 194-07 Tasks 1-2 give outerBannerLabel an additive-default progress input and consume it in MessageItem, crossing PANEL-09 with the cost stated per D-18. THE DUPLICATE-ASSISTANT-ICON HALF IS DEFERRED, and it is deferred on a MEASUREMENT-NOT-TAKEN rather than on a judgement: 194-MEASUREMENTS.md's verdict is verbatim '⏸ NOT MEASURED — DEFERRED with a trigger'. The live store dump that alone separates the three mechanical verdicts (a 174-04 mount/first-SSE race = two temp- rows; the BUG-260609-03 class = one temp- + one persisted; non-reproduction = exactly one row) was never obtained — no browser was reachable (list_connected_browsers returned []) and both operator samples were the SAME thread, disqualified twice over (it has NO workflow_runs row, so it was an ordinary Deep chat and not a harness run, and it read runStatus 'completed' while the symptom is a streaming-time condition). NO VERDICT WAS INVENTED. Deferred under G-3's sizing rule: the two live candidates have materially different fixes (a mount/first-SSE ordering fix vs persisting message_id for harness runs), so a fix cannot be sized without knowing which mechanism is live. ITS RE-OPEN TRIGGER, QUOTED VERBATIM FROM 194-MEASUREMENTS.md: 'Re-open when a harness run can be observed mid-stream — i.e. when the Claude-in-Chrome extension is connected (so the app can be driven without operator hand-holding), or when the operator next has a workflow run streaming and can paste the store dump. The snippet is in 194-01-DEVIATION.md. ⚠ The plan's own console expression does not work as written — it says useStreamsStore.getState() as though it were a global; it is not exposed on window and throws. The dev-server form is `const { useStreamsStore } = await import(\"/src/stores/streamsStore.ts\");`. The sample must satisfy BOTH conditions the samples above failed: the thread must have a workflow_runs row, and at least one assistant row must read runStatus: \"streaming\".' BOTH TRIGGERS NOW STAND — the original 'Re-open if 194 closes only the banner-advance half' is NOT discharged by this note; it is the trigger that fired, and the deferral above is its resolution."
reproduces_on:
  branch: develop
  commit: 1dc4d509
  date: 2026-08-15
---

# BUG-260815-04: Chat stays on "Starting workflow…" with a duplicate assistant icon for the whole run

## What the operator saw

> "when I opened the workflow while it is running, in chat area the duplicate assistant icon is
> still there and it's always just showing 'starting workflow' in the chat area."

Observed during the Phase 193.1 end-to-end run.

## Two symptoms, probably two causes — kept separate on purpose

**1. The banner never advances past "Starting workflow…".**

The string is real and located: `outerBannerLabel` in `frontend/src/lib/toolMeta.ts:92` returns
`"Starting workflow…"` when the thread is **harness-locked and pre-tools**
(`isHarness ? "Starting workflow…" : "Setting up agent…"`). It is pinned byte-exact by
`toolMeta.test.ts:30` as a D-14 decision, so **the string is correct and deliberate** — the defect
is that the surface **stays in the pre-tools state for the whole run** instead of advancing as
phases complete.

⚠ **CORRECTED (Phase 194, plan 194-05) — the test pointer, beside the original above.** The file
is `frontend/src/lib/__tests__/toolMeta.test.ts` (not a bare `toolMeta.test.ts` beside the source),
and `:30` is the `it("D-14 byte-identical: …")` **title line**; the byte-exact assertion itself is
one line lower at **`:31`** — `expect(outerBannerLabel(null, false, false, true, false)).toBe("Starting workflow…")`.
**`toolMeta.ts:92` is exact and unchanged.** The correction is small and it matters for one reason:
a plan told to "check the pin at `:30`" reads a test *name* and can conclude the pin is prose.

⚠ **So this is not a copy bug and must not be "fixed" by rewording the banner.** The question is
why the harness run's progress never moves the chat surface out of its pre-tools condition, when
`workflow_phases` rows are being written throughout.

**2. A duplicate assistant icon persists.**

Not root-caused. ⚠ There is prior art worth checking first rather than re-deriving:
`toolcallpanel-dedup-duplicates-tool-card.md` is an existing report about duplication on the
tool-card surface. **Check whether this is the same dedup path before opening a new investigation.**

### ⚠ CORRECTED (Phase 194, plan 194-05, 2026-08-16) — that prior art is the WRONG one

**The pointer above is the ORIGINAL and is left in place; this is the correction beside it, not
over it.** `toolcallpanel-dedup-duplicates-tool-card.md` (`BUG-260521-01`) is a **transient
(~10-15 s) duplicate TOOL CARD**, minor, folded into Phase 075.2. Different symptom, different
surface, different lifetime. Following it sends the next investigator to the wrong dedup path.

**The correct prior art, measured by `194-RESEARCH.md`:**

| Pointer | What it is |
|---|---|
| `dedupMessages.ts:20-26` | the runId-dedup **exemption for harness rows** — the reason a harness row is not deduped by run id |
| `StreamsProvider.tsx:2490-2500` | **BUG-260609-03** — a harness run leaves `runs.message_id` NULL, so the fetched answer comes back with `runId=undefined` and `dbRunIds` cannot hold the run id |
| `dedupMessages.ts:31-45` | **BUG-260610-01** — the 174-04 narrow collapse (the mount / first-SSE race) |

### ⚠ ROUTING (Phase 194): the two halves split, and this one is DEFERRED without a verdict

**The banner-advance half (symptom 1) is closed by Phase 194** — plan `194-07` Tasks 1-2. **This
half (symptom 2) is DEFERRED, and it is deferred because the measurement was NOT OBTAINED, not
because a fix was judged unnecessary.** `194-MEASUREMENTS.md`'s verdict, verbatim:

> **⏸ NOT MEASURED — DEFERRED with a trigger**

Plan `194-01` Task 2 was a `checkpoint:human-verify` whose whole job was to separate three
mechanical verdicts by counting assistant rows in the live store mid-stream. **That dump was never
obtained** (no browser was reachable — `list_connected_browsers` → `[]`; both operator samples were
the same thread, disqualified twice over: it had **no `workflow_runs` row**, so it was an ordinary
Deep chat rather than a harness run, and it read `runStatus: "completed"` while the symptom is a
**streaming-time** condition that is reconciled away after completion). **No verdict was invented,
and the word "probably" appears nowhere in that file.**

**⚠ What WAS established — real evidence, and explicitly NOT the verdict.** Measured against the
live local DB: on threads owning a `workflow_runs` row, `runs.message_id` is **NULL for 587 of 607
rows (96.7 %)**, including all 25 most recent, while the sampled ordinary Deep run **sets it and it
points exactly at the row that rendered**. So the **`BUG-260609-03` precondition is live at HEAD**.
That is a mechanism observed in the **database**, not the symptom observed in the **store**, and it
is consistent with **all three** candidate verdicts — a 174-04 race, the BUG-260609-03 class, and
non-reproduction alike. **It may be cited as evidence; it may never be cited as the verdict.**

**Why deferred rather than fast-fixed:** under G-3's sizing rule, the two live candidates have
materially different fixes — a mount/first-SSE **ordering** fix versus **persisting `message_id`
for harness runs**. Guessing between them ships a fix for a mechanism nobody observed.

**Re-open trigger, quoted verbatim from `194-MEASUREMENTS.md`:**

> **Re-open when a harness run can be observed mid-stream** — i.e. when the Claude-in-Chrome
> extension is connected (so the app can be driven without operator hand-holding), or when the
> operator next has a workflow run streaming and can paste the store dump. The snippet is in
> `194-01-DEVIATION.md`.
>
> ⚠ **The plan's own console expression does not work as written** — it says
> `useStreamsStore.getState()` as though it were a global; it is not exposed on `window` and
> throws. The dev-server form is
> `const { useStreamsStore } = await import('/src/stores/streamsStore.ts');`.
>
> The sample must satisfy BOTH conditions the samples above failed: the thread must have a
> `workflow_runs` row, and at least one assistant row must read `runStatus: "streaming"`.

**⚠ BOTH TRIGGERS STAND.** This report's own pre-existing trigger — *"Re-open if 194 closes only
the banner-advance half"* — is **NOT discharged**. It is the trigger that **fired**, and the
deferral above is its resolution, not its cancellation.

## Why it matters

The run took minutes and produced a real document. For that entire time the chat surface said
*"Starting workflow…"* — i.e. **the product was working correctly and reporting that it had not
started.** An author with no other window open cannot distinguish that from a hang, and the
honest-progress principle this project applies elsewhere (never-vanishes run-status strip, run
honesty) is exactly what is missing here.

## Investigation starting points

- `frontend/src/lib/toolMeta.ts:75-92` — the pre-tools banner condition; what clears `isHarness`
  pre-tools state.
- Whether harness phase progress reaches the chat surface at all, or only the panel. Phase 094/103
  split the surfaces deliberately (**panel owns the phase spine, chat carries a thin receipt**) —
  the receipt may simply never update.
- `workflow_phases` rows are written per phase, so **the progress data exists**; this is likely a
  propagation/subscription gap, not missing state. **Verify rather than assume.**

## Related

- `BUG-260815-03` — the run surface's other gap, from the same session: history reachable from
  chat but not canvas. **Both are about the run surface not telling the whole truth over time.**
