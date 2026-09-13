---
id: BUG-260707-03
title: Final answer stays folded inside the streaming-narration collapsible after a Deep run ends (until reload)
reported: 2026-07-07
surface: Agentic-RAG
severity: minor                    # FIXED 2026-07-07 (same day) — scoped content reconcile at clean Deep terminal
status: folded                    # STAYS folded at 243-05 (2026-09-11) — the code half is measured; residual #1 (live verification) and #3 (SEED-094) are untouched
affected_areas: [frontend/chat-ui, frontend/streaming]
folded_into: "176, 243"   # residual #2 CLOSED 2026-09-11 by UAT row L-4   # residual #2 (the nav/mount path) routed to 243 / CHAT-05 at /gsd:plan-phase 243, 2026-09-11
verified_closed_by: null   # NOT closed: every fence here is synthetic. G-4 browser row owed — see the 243-05 section below.
related_seeds: [SEED-094]
re_open_trigger: "A live tool-bearing run whose answer is still not readable as body text on navigate-back — or any run where the run-end reconcile swaps in a stray interim line (residual #3 / SEED-094)."
resolution_applied: 2026-07-07
reproduces_on:
  branch: develop
  commit: cb9fef39
  date: 2026-07-07
---

# BUG-260707-03: Final answer stays folded under the "thinking" narration after a run ends

## What we observed

The StreamingNarration fold (the collapsible "thinking" gist added in Phase-3 of
the chat-UX work, commit `6df7f8a2`) collapses/expands correctly **during** a run.
But **after the run ends**, the final answer is still folded *inside* that
narration collapsible instead of rendering as a separate, normal answer. It only
"resolves" to a clean answer on a later page reload / thread navigation.

## Why it matters

Minor but felt: the user watches their final deliverable summary sit as a
one-line collapsed gist at run-end rather than reading as a clean answer. The
"resolve to answer" half of the original narration-fold design worked on reload
but never fired live.

## Root cause (confirmed in code)

`onDelta` may only APPEND to `message.content` (the StreamsProvider.tsx:358
invariant — required so Anthropic's interleaved text+tool_use isn't lost). So the
LIVE `message.content` is the WHOLE run's narration + final answer concatenated
into one growing blob. The backend, by contrast, persists only the **last
iteration's** content (the clean final answer — DB-verified: a 10-tool run saved
just the presentation summary).

`MessageItem.tsx:429` renders `StreamingNarration` while
`isMessageStreaming (= runStatus === "streaming")`. The final answer streams in as
the blob's tail *while runStatus is still "streaming"*, so it's folded with the
narration. At the clean terminal `runStatus` flips to "completed" → the render
switches to `MarkdownRenderer`, but it shows the accumulated blob (all narration +
answer), not the clean answer — and regular chat has **no run-completed content
reconcile** (`onRunCompleted` is harness-only, StreamsProvider.tsx:991). The clean
persisted answer only replaces the blob on the next `loadMessages` (reload / nav).

## Resolution applied (2026-07-07)

Scoped content reconcile in the send-path `onTerminal` (StreamsProvider.tsx): on a
clean Deep terminal (`done`/`reader_done`), fire-and-forget `getMessages(threadId)`,
find this run's persisted assistant message by `runId`, and swap **only** that
bucket message's `content` to the persisted answer. So the fold gives way to a
clean, separated answer **live** — no reload. Scoped to `content`, so it preserves
`tool_calls` / suggestions / output-files / `runStatus` (far lighter than a full
`loadMessages` replace, which would risk dropping streamed-only state). Best-effort
(the reload-time reconcile remains the floor, D-v2.5-03). Regression test:
`streamsProvider_bug_260707_03_final_answer_resolve.test.tsx` — streams a blob →
clean terminal → asserts content resolves to the persisted answer (fails pre-fix).

### Residuals (why status stays `open`)

1. **Not live-verified** — flip to `closed` after one live Deep run shows the
   answer resolving un-folded at run-end without a reload.
2. **Scoped to the send path** — the mount/reconcile-path terminal (a backgrounded
   run watched after navigation) still relies on reload; extend there if reported.
3. **Backend "wrong last-iteration content" edge** — for runs where the backend
   persisted a stray interim line instead of the real final answer (e.g. GLM run
   `c3bba996` saved "All checks pass. Let me finalize the task list."), the
   reconcile faithfully shows that stray line (consistent with reload). That is a
   separate backend final-answer-emit bug — see [[SEED-094]] (run-end honesty).

## Reference / evidence links

- Code: `StreamsProvider.tsx` (send-path onTerminal reconcile; :358 append invariant;
  :991 harness-only onRunCompleted); `MessageItem.tsx:429`; `StreamingNarration.tsx`.
- DB evidence: persisted assistant content = clean final answer for well-behaved
  runs (msg `d463ad62`), stray interim line for the GLM run (msg `c3bba996`).
- Introduced by: `6df7f8a2` (StreamingNarration fold). Related: SEED-094.

---

## Residual #2 routed to Phase 243 (CHAT-05) — 2026-09-11

Phase 176 shipped the **send-path** half of the reconcile. Residual #2 — *a run that finished while
the operator was on another page, watched after navigation* — **still relies on a reload**, and it is
now `CHAT-05` in Phase 243.

⭐ **Sketch 234 found its cause while drawing something else, and it is not the reconcile.** The
answer *is* already streaming: `StreamsProvider.tsx:415` appends `content: m.content + delta` per
token. But on a tool-bearing run `MessageItem.tsx:425` routes that content into `StreamingNarration`
— the folded italic gist — so it is written **inside the fold** and only surfaces when the run-end
reconcile swaps in the persisted text. **That makes `CHAT-01` and `CHAT-05` one defect, not two.**

⚠ Phase 243 must verify the **mount / navigation** path specifically, not only a live send — the
send path is exactly the half that already shipped, so a live-send check would pass while the
residual stands.


---

## Verdict at Phase 243 plan `243-05` (2026-09-11) — residual #2 closed in CODE, the report stays `folded`

**Residual #2 was TWO things, and only one of them was still owed. That is this plan's main finding
and it corrects the routing note above rather than confirming it.**

| Half of residual #2 | Status measured 2026-09-11 | Evidence |
|---|---|---|
| the **reconcile** half — a backgrounded run's clean terminal must swap the blob for the persisted answer without a reload | ⭐ **ALREADY SHIPPED at Phase 176 (RENDER-02 / D-07)**, and it was shipped with a fence | `StreamsProvider.tsx` mount-path `onTerminal` carries the mirrored content-reconcile; `streamsProvider_bug_260707_03_final_answer_resolve.test.tsx`'s second `describe` drives it. `243-05`'s own §6a and §6b were driven independently and were **GREEN on the first run** |
| the **render branch** half — WHERE the answer is drawn while the run is live | ⛔ **STILL BROKEN, and this is what `243-05` fixed** | `MessageItem.tsx`'s `StreamingNarration` arm routed `message.content` into the one-line italic gist on every tool-bearing streaming turn, so the answer was written INSIDE a fold. Driven RED in 4 cases, then made green |

⇒ The routing note above says residual #2 *"still relies on a reload"*. **Measured, it did not — the
reload dependency had been removed thirteen months' worth of phases earlier and nobody re-measured
it.** What remained was the branch, which no reload-related wording would ever have named.

### What changed

`MessageItem.tsx` lost the `StreamingNarration` arm of its content ternary (`-9 / +37`, the
additions being the docblock that records the trade). A live tool-bearing turn now routes
`message.content` through the **same two shipped renderers as the settled answer** —
`CitedMarkdown` when citations are present, `MarkdownRenderer` otherwise — below the settled
thinking line, with the streaming caret at the live edge. `StreamingNarration.tsx` is
**byte-identical** and was not deleted; this was its last production caller, and its retirement is
recorded as owed rather than taken.

### ⛔ Why the status is NOT `closed`

**Every fence behind the claim above is synthetic**, and this report's own history is the reason
that matters: residual #1 — *"Not live-verified"* — was written on 2026-07-07 and **is still open
today**, twenty-six months of project time later, while the code half was called done twice. A
third code-half claim closed on synthetic evidence would repeat that exactly.

Specifically owed, by name:

1. **Residual #1, untouched.** No live Deep run has been watched resolving un-folded. Owed as a
   **G-4 browser row**: start a tool-bearing run, navigate to `/library`, let it finish, navigate
   back **without reloading**, and read whether the answer is body text under the thinking line.
2. **The narration trade is a JUDGEMENT call, not a measurement** (D-243-12, solo running). The
   interim narration is no longer folded to a gist, so a long agentic run's process prose now
   renders in the transcript until the run-end reconcile replaces it with the persisted answer.
   Sketch 234 V1 — the operator-approved acceptance bar — draws exactly this, and `dedupParagraphs`
   still applies; but nobody has *watched* a ten-tool run under it.
3. **Residual #3 (`SEED-094`) is untouched and out of scope**, as it was at 176.

---

## ✅ RESIDUAL #2 CLOSED 2026-09-11 — driven on the navigation path, not the send path

**UAT row L-4.** A three-step `execute_code` run was started, the operator **navigated away to
Library mid-stream**, the run finished **off-screen** (confirmed at the database: `tools = 3 ·
content = 5,604 chars · reasoning = 265 chars`), and the operator **navigated back**.

| | |
|---|---|
| thinking triggers on return | 9 |
| `StreamingNarration` nodes anywhere | **0** |
| final answer rendered | ✅ |
| `performance.getEntriesByType('navigation')[0].type` | **`"navigate"`** |

⭐ **That last row is what makes it a closure rather than an anecdote** — a reload reports
`"reload"`. It reports `"navigate"`, the original page load. The answer resolved purely by leaving
and returning, with no F5.

⭐ **And the structural half: `narrationNodes = 0`.** 243-05 deleted the arm, so there is no longer a
fold for the answer to be trapped inside. **The defect cannot recur by the mechanism that caused
it** — that is a stronger closure than "we fixed the timing".

⚠ **The premise in this file's own second sentence was measured FALSE** before the fix: the mount-path
reconcile shipped at Phase 176 and had a fence. What actually remained was **where the answer was
drawn**. See `CHAT-05` in REQUIREMENTS.md.

⚠ **Residual #1 — *"not live-verified"* — is a separate line and is NOT closed by this.**

⚠ **Observed while driving, not a failure of this report:** on return the transcript restores
**scrolled to the middle** of the thread rather than to the answer. CHAT-05 says nothing about scroll
restoration. **Routed to Phase 244**, which owns the chat shell.
