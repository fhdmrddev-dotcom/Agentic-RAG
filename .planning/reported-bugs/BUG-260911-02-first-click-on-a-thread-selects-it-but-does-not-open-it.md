---
id: BUG-260911-02
title: The first click on a chat in the list highlights it but does not open it — a second click is required
reported: 2026-09-11
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/chat, frontend/navigation, frontend/chat-list, UX/legibility]
folded_into: 244
verified_closed_by: null
related_seeds: []
re_open_trigger: "ONE live browser visit on /app, activeView=chat, settles BOTH discriminators. (i) TARGET — hover a chat row and click its RIGHT-HAND THIRD (over the ⋯ scrim) ONCE; if it fails there but succeeds on the row's LEFT (title) region, trace §4 (the opacity-0 actions overlay with no pointer-events-none) is CONFIRMED; if it fails on the LEFT region too, §4 is REFUTED and C-6 candidate (a) — activeView/drawer path — is the live one. (ii) APPEARANCE — on the failed click, read WHICH PANE renders: the WELCOME state ('How can I help you?' PLUS the two starter-prompt chips '📁 Search connected files' / '💬 Draft a team update', all three of which occur exactly once in ChatArea.tsx and ONLY inside `if (!thread)`) means the click did not select at all (§4/(a)); the THREAD FRAME with a header and an EMPTY transcript means it DID select and the snapshot-503 path (trace §6, UAT G-3) is the live cause. ⚠ NEW OBSERVABLE that did not exist when this report was filed (2026-09-11): since Phase 244-11 the snapshot-503 arm renders a VISIBLE amber banner with Retry, and the §4 arm never does — so the banner's presence decides (ii) at a glance. Its ABSENCE in the original report is therefore NOT evidence about the cause. Trace: .planning/phases/244-the-chat-shell-and-the-composer/244-01-BUG-260911-02-TRACE.md §6"
reproduces_on:
  branch: develop
  commit: 993139f39
  date: 2026-09-11
---

# BUG-260911-02: the first click selects the thread, the second one opens it

## What we observed

Found **while driving Phase 243's G-4 UAT** — not by a test, and not by anyone looking for it. It
was hit **four separate times** before it was recognised as a defect rather than as the driver
mis-clicking.

**Steps:**

1. Load `/app` fresh (or navigate back to Chat after the thread list has re-rendered).
2. Click a chat in the left-hand list, **once**.
3. The row **highlights** — it gets the selected treatment and the `⋯` affordance appears.
4. **The conversation does not open.** The content pane keeps showing the empty
   *"How can I help you?"* state, with the model pickers and the suggestion chips.
5. Click the **same row again**. The conversation loads immediately and completely.

## Measured, not eyeballed

At the same coordinate, in one session:

```
click 1 → document.querySelectorAll('[data-testid="thinking-trigger"]').length === 0   (empty state)
click 2 → document.querySelectorAll('[data-testid="thinking-trigger"]').length === 8   (loaded)
```

The row was already visually selected after click 1. **Selection state and load state are
disagreeing**, and only the selection half is drawn.

⚠ **Clicking via the element reference (`ref`) rather than a raw coordinate has the same effect**,
so it is not a hit-test or pointer-target problem.

## Why it matters

**The screen tells the user the thread is open when it is not.** The row is highlighted, so there is
no affordance suggesting a second click; the natural reading is *"this conversation is empty"*. On
the empty state the user is also shown a composer — so the most likely next action is to **start
typing into what they believe is their existing thread.**

⚠ **That is the sharp edge, and it was hit in this very session:** two UAT prompts were typed and
submitted into what looked like a loaded thread and went nowhere — verified at the database, no user
message was written and no stray thread was created. **A person would have assumed the app lost
their message.**

## Not Phase 243's

Phase 243 touched the thinking block, the delta cadence, the follow-scroll seam and the answer's
render branch. **Thread selection is none of those**, and the defect reproduces on messages that
predate the phase. It is filed rather than fixed so it is not absorbed into an unrelated phase's
diff.

⛔ **Not yet established:** whether this is new, and whether it reproduces on `master` /
`production`. **Nobody has checked** — the reproduction above is on `develop` at `993139f39` only.
That check is the first thing whoever picks this up should do, before assuming a cause.

## Candidate area, stated as a hypothesis and NOT as a finding

`setViewingThread` appears to set the selected id and rely on a follow-up effect (the
snapshot/reconcile path) to populate the bucket; a first click may land before that path is armed,
leaving the id set and the bucket empty. ⚠ **This was NOT traced in the code** — it is where to look
first, not what is wrong. Drive it before reporting it.

---

## Traced 2026-09-11 (Phase 244 plan 01 Task 2) — ⛔ STILL `folded`, NOT `closed`

Full trace: `.planning/phases/244-the-chat-shell-and-the-composer/244-01-BUG-260911-02-TRACE.md`.
Driven suite: `frontend/src/components/layout/__tests__/ChatHistoryColumn.clickPath.test.tsx`.

⛔ **NEITHER CHECK THIS REPORT ASKED FOR WAS RUN.** Production: `could not check — no
browser-driving tool available to that executor`. `develop`: same. **The report's opening
instruction is still owed**, and the `re_open_trigger` above names the exact click to make.

**What the trace DID establish, driven against the real components:**

- ⛔ **There is no two-step handler.** One click → one `onSelectThread` call; `useThreads.selectThread`
  is exactly `setSelectedThread(thread)`. The `setViewingThread` hypothesis above is about the
  *message bucket*, not about selection, and selection is where the symptom was attributed.
- ⛔ **"Highlighted AND showing the welcome pane" is self-inconsistent as selection state.** Both read
  the SAME value (`ChatArea.tsx:472` `if (!thread)` vs the row's `selectedThread?.id === thread.id`).
  ⭐ **The highlight was almost certainly HOVER** — an un-selected row carries `hover:bg-accent/40`
  and the `⋯` is revealed by `group-hover`. **The symptom is therefore "the click did not select at
  all", not "selected but not opened".**
- ⭐ **Leading candidate, named with file:line:** `ChatHistoryColumn.tsx`'s always-rendered
  `opacity-0` actions container is `absolute inset-y-0 right-0` with a `pl-10` scrim, painted after
  the row `<button>` — **an invisible click sink over the right-hand strip of every row.** Its
  documented sibling (the SEED-064 run dot) carries `pointer-events-none`; this one did not. **The
  asymmetry is the evidence.**
- ✅ **Fixed anyway, as a defect in its own right** (`pointer-events-none` on the container,
  `pointer-events-auto` on both controls), driven RED first. ⛔ **This is NOT claimed to close this
  report** — jsdom cannot hit-test, so the browser confirmation is what the re-open trigger asks for.

⚠ **One inference in this report does not hold.** *"Clicking via the element reference (`ref`) …
so it is not a hit-test or pointer-target problem"* — a synthetic click on a WRAPPER never reaches a
handler bound to a CHILD (driven). A failing ref click is therefore consistent with a target problem
rather than evidence against one.

---

## Re-checked 2026-09-12 (Phase 244 plan 11, G-4) — ⭐ **SECOND CAUSE**. ⛔ STILL `folded`.

Full ruling: `.planning/phases/244-the-chat-shell-and-the-composer/244-01-BUG-260911-02-TRACE.md`
**§6** (appended beside §§1-5, which are unchanged). Claude, solo — a **self-verification, not a
review**, and **no browser was driven**.

Phase 244's UAT found a mechanism that was not in the candidate set when §§1-5 were written:
`GET /threads/{id}/snapshot` returned **503 on 2 of 4 observed calls** and
`StreamsProvider.reconcile` swallowed it in one clause, so a selected thread rendered its header
and composer around a **silently empty transcript** — *"a 78-message thread opening completely
EMPTY; a second click on the same row loaded it."* **That is this report's complaint, and its
measured evidence** (`thinking-trigger` 0 after click 1, 8 after click 2) **is reproduced by it
exactly.**

⚠ **It is a SECOND cause, not the same defect, and the two are distinguishable ON SCREEN.** Taken
literally this report describes the WELCOME pane, and the 503 path **provably cannot produce
that**: `How can I help you?` and the two starter-prompt chips each occur exactly once in
`ChatArea.tsx` and all sit inside `if (!thread)`, so a SELECTED thread cannot render any of them.
⚠ But §3(c) already refuted one half of the described appearance (the "highlight" was almost
certainly HOVER), so the description is not a reliable single target — which is why this lands on
SECOND CAUSE rather than UNRELATED.

⛔ **Not closed, and not closable from a chair.** Nothing here reproduced anything in a browser.
The `re_open_trigger` above now carries **both** discriminators in one visit, and names the amber
banner that Phase 244-11 added as a **new observable that did not exist when this report was
filed** — do not read its absence in the original observation as evidence either way.
