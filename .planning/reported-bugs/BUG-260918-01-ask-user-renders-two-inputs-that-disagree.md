---
id: BUG-260918-01
title: An ask_user pause renders TWO full answer cards whose drafts disagree, plus a dead "Answer in panel" button and colour-only option selection
reported: 2026-09-18
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat, frontend/workspace-panel, PausedRunCue.tsx, PendingAskCard.tsx, MessageList.tsx, a11y]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 65f7e8f30
  date: 2026-09-18
---

# BUG-260918-01: An `ask_user` pause renders two full answer cards whose drafts disagree

> ⭐ **DRIVEN, NOT SCREENSHOTTED.** Every figure below was measured in the live production DOM at
> `app.superrag.cloud` on 2026-09-18, on a pause raised for this purpose and answered afterwards so
> nothing was left stranded. A screenshot started this report; it is not what the report rests on.

## What we observed

Raised one `ask_user` pause in a Deep chat thread (*"Mock PNG generation request"*, `deepseek-v4-flash`),
panel open. **Three** things rendered for one decision:

| # | Component | Home | What it is |
|---|---|---|---|
| 1 | `PausedRunCue` | chat, per row (`MessageItem.tsx:624`) | a marker strip — `⏸ ask_user · awaiting your answer` + an `Answer in panel →` button |
| 2 | `PendingAskStack` | chat, list level (`MessageList.tsx:320`) | a **full input** — question, options, REASON textarea, Send Answer |
| 3 | `PendingAskStack` | workspace panel (`WorkspacePanel.tsx:438`) | a **full input**, identical |

⚠ **2 and 3 are the SAME component mounted twice, in two columns** — both are a bare
`<PendingAskStack />`, which resolves its own thread via `useViewingThread()` and renders one
`PendingAskCard` per pending ask. Neither mount is told about the other.

Measured on the live page:

```
sendAnswerButtons: 2
needsYouBadges:    2
pausedCue:         1
```

### Finding A — the `Answer in panel →` button is DEAD, not merely mislabelled

```
found: true · tag: BUTTON · text: "Answer in panel →"
reactPropsKey: "__reactProps$6raq00kvcld"
onClickType:  "undefined"
onClickValue: "undefined"
inlineOnclick: "null"
```

`PausedRunCue` declares `onSeePanel?: () => void`, but its sole production mount renders
`<PausedRunCue />` with **no prop**, so `onClick` resolves to `undefined`. It is a dashed-underline
control that looks interactive and does nothing. Its copy is false on top of that: it points at the
panel while a full input sits ~40px below it **in the same column**.

### Finding B — ⛔ THE TWO CARDS DISAGREE. This is the serious half.

Clicked option **`A` in the PANEL**, then measured both `Send Answer` buttons:

| Card | viewport `left` | `disabled` | `aria-disabled` |
|---|---|---|---|
| chat column | 1034 | **`true`** | `"true"` |
| workspace panel | 1398 | **`false`** | `"false"` |

One decision, two inputs, **visibly different states** while the user is deciding. The chat card shows
nothing selected and its button stays inert; the panel's is armed.

⚠ **Resolution IS shared — only the DRAFT is not.** Sending from the panel cleared all three
renderings at once (`sendAnswerButtons: 0 · needsYouBadges: 0 · pausedCue: 0`). So D-244-11's claim
that both homes read the same `pendingAsksByThread` slice is **true for which asks are pending** and
**false for the in-progress selection**, which is local component state per card.

### Finding C — option selection is conveyed by COLOUR ONLY

All four option buttons (2 per card):

```
ariaPressed: null · ariaSelected: null
```

The selected option is amber-filled and nothing else. A screen-reader user cannot tell which option
is chosen, in either card.

## Why it matters

**Major, not minor.** Finding B is the failure mode this project has already named in its own source.
`MessageList.tsx` justifies its single chat-column mount with:

> ⛔ EXACTLY ONE CHAT-COLUMN MOUNT. […] Two homes for one decision in one column is **"actionable
> twice and agreed in neither"** — the ROADMAP's own named failure mode.

244-12 avoided it **within** the chat column and reproduced it **across** columns. A user who selects
in one card and then looks at the other sees a control that appears not to have registered their
choice — the "it looked right and did nothing" complaint of `BUG-260828-07`, one surface over.

It also contradicts the **approved design**. Sketch 006's chosen option C
(`.claude/skills/sketch-findings-agentic-rag/sources/006-pending-question/README.md:35`):

> **C: Dual-surface** — the calm pinned card in the panel **plus** an inline cue in the chat run-card.
> Trade-off: shows the prompt in two places (**mitigated — chat cue is a POINTER, panel is the real
> input**).

And `references/pending-question.md:8`: *"The real input lives in a calm pinned card at the top of the
panel. A **pointer cue** inside the chat run-card points to it."* What shipped is a pointer **and** a
second full input. This is sketch→build drift.

Finding C is an independent WCAG issue (4.1.2 name/role/value) affecting both cards.

## Hypothesized cause

**Hypothesis, not finding.** Phase 244-12 mounted `PendingAskStack` at chat-list level to close
`BUG-260828-07`, where a **workflow** pause rendered no controls in the chat column at all — the
harness's carrier row is `role="system"` and `threads.py:427-438` / `:682-691` filter system rows off
the wire, so there was no message to anchor to and, with the panel closed, no reachable control.

That fix was correct for reachability and was **not** a design decision to add a second input — but it
silently overrode the approved one-input contract and nobody revisited the panel card, the cue's copy,
or draft-state sharing. The disagreement in Finding B follows from each `PendingAskCard` owning its own
selection state, which was invisible while only one card existed.

## Surface classification

`Agentic-RAG` — this app's own frontend, observed in its own production deployment. Routing candidate.

## Suggested routing

- **Fold into in-flight phase:** n/a. Phase 256 is backend token metering and touches none of these files.
- **Defer to future phase / milestone:** ⭐ **a UI phase, by operator decision on 2026-09-18.**
  **G-2 FIRES** — this is live UI, a panel render and a visual contract, so `/gsd:sketch` precedes
  `/gsd:spec-phase`, and the operator-approved mockup is the acceptance bar.
  **G-4** applies: lived-experience UAT, driven in Chrome.
- **Plant as seed:** not needed — this report carries the trigger itself.
- **External — note only:** no.

### ⛔ Constraints any fix MUST respect

1. **Do NOT narrow `PendingAskStack`'s mount condition.** `MessageList.tsx` records that *"a narrowing
   mount condition is precisely what made SHELL-03 unreachable twice over."* A third time is the
   predictable outcome. Vary the **presentation**, never the mount.
2. **A workflow pause has no message to anchor to.** Any design assuming a per-row anchor is
   unreachable for the harness path — see the `role="system"` filter above.
3. **Do not delete the panel card either.** Panel-only is the state that shipped `BUG-260828-07`.
4. **Sharing the draft is the minimum bar.** Whatever the visual answer, the two homes must not be
   able to disagree about what the user has selected.

### Partially addressed already

`c2ffdaad7` on `develop` (2026-09-18) removes the dead button — **Finding A only**. Its replacement
fence asserts the *absence* of any button via `queryAllByRole`, deliberately not name-scoped, and was
**driven RED against a planted button carrying different copy**, which a name-scoped check would have
missed. ⛔ **Not deployed** — production still serves the button (see evidence below). Findings **B**
and **C** are untouched.

## Workarounds (prompt-side, code-side, or UI-side)

- **Answer in one card and ignore the other.** Sending from either home settles both correctly; only
  the pre-send draft disagrees.
- **Collapse the workspace panel** while answering, leaving the chat card as the only input. ⚠ Works
  for a **Deep** pause; for a **workflow** pause the panel is where the phase spine lives, so this
  trades one problem for another.

## Reference / evidence links

- Production at the time of observation: `65f7e8f30`, bundle `app-D_FAE38V.js` — confirmed to still
  contain the string `"Answer in panel"`, which is how we established production is pre-fix.
- `frontend/src/components/panel/PausedRunCue.tsx` — the cue (Finding A)
- `frontend/src/components/panel/PendingAskCard.tsx` — the card rendered in both homes (Findings B, C)
- `frontend/src/components/chat/MessageList.tsx:270-320` — the 244-12 mount and its rationale
- `frontend/src/components/chat/MessageItem.tsx:605-624` — why the cue stays inline (D-244-12)
- `.claude/skills/sketch-findings-agentic-rag/references/pending-question.md` — the approved design
- `.claude/skills/sketch-findings-agentic-rag/sources/006-pending-question/README.md:35` — option C
- `.planning/reported-bugs/BUG-260828-07-approval-buttons-absent-in-chat-thread.md` — the reachability bug 244-12 closed, whose fix caused this
- `c2ffdaad7` — the Finding-A fix on `develop`, undeployed
- Original operator screenshot: `screenshots/Screenshot 2026-09-18 205410.png`
