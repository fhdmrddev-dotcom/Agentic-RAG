---
sketch: 006
name: pending-question
question: "When ask_user pauses the agent mid-run, how loud should the panel be — and how does answering resume the agent without leaving the panel?"
winner: "C"
tags: [ask_user, interrupt, pause-resume, PANEL-04, TOOL-03]

# Decision: C (dual-surface). Calm pinned card in the panel (the 004 baseline)
# PLUS a pointer cue inside the chat run-card ("agent needs you → Answer in
# panel"). Fixes B's blind spot (pin invisible if panel closed / eyes on chat)
# without A's annoyance (takeover dims workspace on every trivial Q). The chat
# cue is a POINTER; the panel holds the real input (choice chips + free-text).
# Resume happens in place. Loudness is calm-by-default, but the locked composer
# + paused amber run-card + toggle dot guarantee a block is never silent.
---

# Sketch 006: Pending Question

## Design Question

`ask_user` is the one tool that **blocks the entire agent loop** — it's literally waiting on the human. So the panel can't treat it like just another section. Two things to get right: (1) the *loudness* — make a pending question impossible to miss without being obnoxious on every run; (2) the *answer-and-resume* flow — pick a choice or type a custom answer, submit, and watch the agent resume **inside the same panel view** (SC#4), with the chat run-card un-pausing and the composer unlocking.

## How to View

```
open .planning/sketches/006-pending-question/index.html
```

It's the split layout (chat left, panel right). Use the **Flow** strip: `1 · Pending` → pick/type an answer and **Send** → `2 · Answered → resume`. Also try `3 · Timeout`. Switch variants to compare loudness.

## Variants

- **A: Takeover** — when a question lands, the panel auto-opens and the question card takes focus while Todos/Files dim behind a scrim. Impossible to miss. Trade-off: heavy-handed; blocks glancing at workspace state while you decide.
- **B: Pinned (calm)** — the question pins at the top of the stacked panel (the 004 baseline), sections stay fully usable below, an amber clock counts down. Calm and respectful. Trade-off: if the panel is closed/collapsed, relies entirely on the toggle's pulsing dot.
- **C: Dual-surface** — the calm pinned card in the panel **plus** an inline cue in the chat run-card itself ("⚠ the agent needs your input → Answer in panel"). Whichever surface your eyes are on (chat *or* panel), you see it. Trade-off: shows the prompt in two places (mitigated — chat cue is a pointer, panel is the real input).

## What to Look For

1. **The paused run-card:** in chat, the run-card turns amber, the timer holds, the last step reads `⏸ ask_user · awaiting your answer →`, and **the composer locks** ("Agent is paused"). Does it read clearly as *blocked-on-me* vs just *slow*?
2. **Answer affordances:** choice buttons **and** a free-text field (some `ask_user` calls have no options). Submit is disabled until you pick/type. Is the choice-or-custom split clear?
3. **Resume in place:** after Send, the card flips green ("Answered · agent resumed"), records your answer, the run-card un-pauses, composer unlocks — no navigation, no page refresh.
4. **Timeout:** the graceful-expiry state — a clear "no response within 5:00, agent stopped" rather than a silent hang. (Backend already supports a configurable timeout.)
5. **Loudness gut-check:** is A too aggressive for a routine question? Is B too quiet if you're not looking at the panel? Does C's chat-cue solve B's blind spot without feeling redundant?

## How we'd know this failed (G-6)

- **Silent block:** the agent pauses but nothing visibly changes — user thinks it's still working and waits indefinitely (the worst case; ties to the toggle dot + composer lock).
- **Lost on reload:** user refreshes mid-question; the pending prompt doesn't come back, so the run is stuck with no way to answer. (The reload/answered-history path is the seam — sketch 007.)
- **Annoyance fatigue:** the takeover fires for trivial confirmations so often the user resents the panel.
- **Dead-end after answer:** user submits but the agent doesn't visibly resume, so they can't tell if it worked.
- **No-options trap:** an `ask_user` with zero choice buttons leaves the user with no obvious way to respond (free-text must always be present).
- **Timeout-as-crash:** the question expires and the agent errors out opaquely instead of reporting "I couldn't proceed without your answer."
