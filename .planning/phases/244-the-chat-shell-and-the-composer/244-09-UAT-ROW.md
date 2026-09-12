# 244-09 UAT ROW — SHELL-01 / BUG-260828-08 re-drive (gap G-5)

⛔ **THIS FILE IS AUTHORED BY `244-09` AND DRIVEN AT `/gsd:verify-work`.** Plan `244-09` built the
fix and pinned it with a source fence; it does **not** claim this row. Every verdict below reads
`pending` and must stay `pending` until a real browser produces the number beside it.

⛔ **WHY THIS CANNOT BE A VITEST FENCE.** jsdom performs **no layout**. `ChatLayout.scrollFrame
.test.tsx` link 6 asserts that the class tokens cannot be deleted silently and proves **nothing**
about whether the page overflows. Per `D-244-19`, SHELL-01 closes on a **measured bound**, not on a
green fence and not on a screenshot. G-6 shipping behind a green fence is exactly the failure this
separation exists to prevent.

---

## What changed, and what the row must therefore distinguish

`NavPanel.tsx`'s rail root gained `min-h-0 overflow-y-auto` (one source line). Before it, the rail
could neither scroll nor clip: computed `overflow-y: visible`, `min-height: auto`, with its
auto-margin footer block measuring `bottom = 540px` past the rail's own box and every ancestor up to
`<html>` reading `overflow-y: visible`. The excess escaped to the page scrollbar.

⚠ **"The root no longer overflows" is NOT sufficient on its own.** Deleting content would achieve the
same reading. §4 below exists to distinguish *the rail scrolls* from *the rail lost its contents*.

---

## 1. Instrument — ⛔ the wrong one already produced a false finding

```js
const root = document.getElementById('root')
const rootScrollHeight = root.scrollHeight
const rootClientHeight = root.getBoundingClientRect().height   // cross-check: root.clientHeight
const bodyScrollHeight = document.body.scrollHeight            // must AGREE with rootScrollHeight
```

⛔ **NEVER `document.scrollingElement` / `document.documentElement`.** The automation extension
injects its own nodes into `<body>` (`claude-agent-glow-border`, `claude-phantom-cursor`, a
`scite-extension-marker`), and `documentElement.scrollHeight` measured **1522 at a viewport of 696** —
a number with nothing to do with the app. The UAT drive caught itself on exactly this after a reading
claimed an 826px overflow at a height that had just been clean. Repeating it would publish a defect
that does not exist.

⚠ **Read every rect with the document UNSCROLLED.** An earlier reading logged the composer gap as
`106.6px` at h=436 and called it "grown"; that was the rect read against an already-scrolled root,
not a product fact.

---

## 2. Samples — 8, and the four already-clean heights are load-bearing

Four viewport heights × panel **CLOSED** and **OPEN**. Set the height with a real viewport resize,
not a CSS transform.

| # | viewport h | panel | why this sample is here | `rootSh` | `rootCh` | overflow | composer gap | footer gap | verdict |
|---|---|---|---|---|---|---|---|---|---|
| R-1 | 436 | CLOSED | ⛔ measured **FAIL** pre-fix, `540 / 436` = **+104px** | | | | | | `pending` |
| R-2 | 436 | OPEN | ⛔ measured **FAIL** pre-fix, `540 / 436` = **+104px** | | | | | | `pending` |
| R-3 | 516 | CLOSED | ⛔ the bisected threshold — **+24px** pre-fix | | | | | | `pending` |
| R-4 | 516 | OPEN | ⛔ the bisected threshold — **+24px** pre-fix | | | | | | `pending` |
| R-5 | 576 | CLOSED | ✅ clean pre-fix — anti-regression | | | | | | `pending` |
| R-6 | 576 | OPEN | ✅ clean pre-fix — anti-regression | | | | | | `pending` |
| R-7 | 696 | CLOSED | ✅ clean pre-fix — anti-regression | | | | | | `pending` |
| R-8 | 696 | OPEN | ✅ clean pre-fix — anti-regression | | | | | | `pending` |

⚠ **The four clean heights are NOT padding.** The ROADMAP's named failure mode is *"fixed at one
window height and the dead space returns at another"*. A row that drove only the two broken heights
could not tell a fix from a trade.

⚠ **Panel state is carried even though it was byte-identical at every pre-fix height.** That
irrelevance is itself the diagnostic that pointed away from the panel and the message column; losing
it would lose the control.

---

## 3. Acceptance condition, per sample

All three must hold, on the unscrolled document:

| measure | required | note |
|---|---|---|
| `rootScrollHeight <= rootClientHeight` | **required** | the headline. `bodyScrollHeight` must agree. |
| composer gap | `37.0px ± 1px` | ⛔ a **CONTROL, never the failing measure** — it read 37.0 at all six pre-fix samples, including both failures. A drift here is a NEW finding, not this gap. |
| footer gap | `12.0px ± 1px` | same: stable at all six pre-fix samples. |

---

## 4. ⛔ The new-behaviour half — without this the row cannot tell a fix from a deletion

At **h=436, panel CLOSED**, on the rail element itself (the `hidden md:flex flex-col` root):

```js
const rail = document.querySelector('div.md\\:flex.flex-col.h-full.min-h-0.overflow-y-auto')
// assert: rail.scrollHeight > rail.clientHeight
```

| assertion | required | verdict |
|---|---|---|
| `rail.scrollHeight > rail.clientHeight` | **required** | `pending` |
| the rail's computed `overflow-y` is `auto` (not `visible`) | **required** | `pending` |
| the rail's footer block is reachable by scrolling the rail | **required** | `pending` |
| ⛔ **ADDED BY `244-14` (review IN-01):** the rail's computed `overflow-x` is **`hidden`**, and `rail.scrollWidth <= rail.clientWidth` | **required** | `pending` |
| ⛔ **ADDED BY `244-14` (review IN-01):** toggle the rail collapsed ⇄ expanded (58px ⇄ 210px) and watch through the ~300ms transition — **no horizontal scrollbar appears at any point**, and the collapsed-state badge is NOT clipped (it ends 5px inside the 58px box) | **required** | `pending` |

⚠ **Why the two new rows exist.** Per CSS overflow, setting one axis to a non-`visible` value makes
the other compute to `auto` — so `overflow-y-auto` alone left this width-ANIMATING column
horizontally scrollable, and its children switch to their expanded layout on the same tick the
width starts moving. `overflow-x-hidden` makes the computed value `hidden auto`. ⛔ jsdom performs
no layout, so link 6's new token assertion proves the class is PRESENT and nothing more — the
scrollbar and the badge are this row's, not the fence's.

⛔ **The overflow must have moved INTO the rail, not vanished.** "No page overflow" is achievable by
losing content, and this is the only assertion that refuses that reading.

---

## 5. The rail-still-holds half — the L-1 property that already passed must keep passing

Drive at **h=436**, panel CLOSED, on the long-transcript fixture.

1. ⛔ **Use a REAL trusted scroll.** A synthetic `WheelEvent` moves the message list **0px** and is
   discarded by the browser — the pre-fix drive recorded this. Drive the wheel through the devtools
   input domain (a trusted event), not `dispatchEvent`.
2. ⛔ **Assert the list ACTUALLY MOVED before reading the rail.** A rail that did not move because
   nothing moved proves nothing.
3. ⚠ **`scrollTop` is NOT the reader's position.** Measure a **LEAF element's** bounding rect inside
   the rail, before and after.
4. Instrument `Element.prototype.scrollIntoView` for the whole run and count **app** calls.

| assertion | required | verdict |
|---|---|---|
| the message list moved by a non-zero amount | **required** (precondition) | `pending` |
| a leaf element inside the rail: `dTop === 0` and `dLeft === 0` | **required** | `pending` |
| app `scrollIntoView` calls during the run | **0** | `pending` |

✅ **Rail drift is NOT the defect and must not be "fixed".** Pre-fix, Δ `dTop`/`dLeft` was **0** and
`scrollIntoView` calls were **0** at every height *including* where the root overflowed, across four
real trusted scrolls. The rail does not move — it could not **fit**. This section is a regression
guard on a property that already held, never a re-investigation.

---

## 6. Fixture

| | |
|---|---|
| thread | `261d5f57-36fb-40ec-bb0b-1c72b7550350` — *"UAT 243 L-2 — long thread"*, 78 messages |
| why | the exact fixture L-1 used; still present in the local DB |
| surface | desktop rail (`hidden md:flex`). ⛔ **The mobile drawer is OUT OF SCOPE** — nothing has ever observed it, and a change nobody measured is not a fix. |

⚠ **A snapshot 503 can empty this thread silently.** `GET /threads/{id}/snapshot` returned 503 on 2 of
4 observed calls during the L-1 setup, and the transcript renders partially with **no banner at all**
(gap `G-3`, logged separately). **Before reading any number, confirm the transcript is actually
long** — a short transcript may not overflow the rail's sibling column and would make every sample
read clean for the wrong reason.

---

## 7. Verdict

| | |
|---|---|
| row verdict | `pending` |
| driver | ⛔ **not yet driven.** To be driven in Chrome at `/gsd:verify-work`. |
| closes | SHELL-01 (first criterion), BUG-260828-08, gap `G-5` |
| authored by | plan `244-09`, 2026-09-12 |

⚠ **Solo run (D-244-21 / OV-SOLO-01).** Gemini is unavailable; whoever drives this row also built the
fix. The result is a **self-verification**, and must be written down as one — never as a review.
