---
sketch: 015
name: status-strip-and-scroll
question: "Where does the persistent run-status strip live so it never vanishes on a long run — and what's the follow-but-release scroll + Jump-to-live affordance?"
winner: "C — Hybrid (header strip while in view + bottom chip with Jump-to-live on scroll-away)"
tags: [chat, status-strip, timer, auto-scroll, jump-to-live, phase-095]
---

> **Winner: C — Hybrid.** Status lives in the run-card header while the run is in view (no chip
> occluding the live stream); the moment you scroll away, a bottom chip appears at the live edge with
> the full `⏱·Step·activity` + "↓ Jump to live". The timer can never vanish from either end.
> **Sketch-presentation note:** the chat scroll region is seamless (no bordered box) with a thin
> subtle slider — the run-card must never look "trapped in a box" (operator note, 2026-06-05).

# Sketch 015: Honest Status Strip + Jump-to-live

## Design Question

Two felt-experience trust fixes, both inside the 014 winning frame:
- **D-06** — a persistent run-status strip (`⏱ 3m12s · Step 5 · Running code…`) that stays visible
  from kickoff until the run TRULY ends. It must survive long runs, dropped SSE, background-tab
  throttling, and temp-id→DB-id remounts — and freeze at the correct duration only on a true terminal.
  (Closes BUG-260528-01, where a transient stream-end on Kimi/Moonshot flips `isStreamingNow` false
  mid-run and the whole timer disappears.)
- **D-03** — follow the live edge while you're at the bottom, **release** the moment you scroll up,
  re-arm at the bottom, and surface a **↓ Jump to live** affordance whenever you've scrolled away.

This sketch answers **where the strip lives** and **what Jump-to-live looks like** — not the timer
derivation itself (that's a code fix; see handover).

Grounded by `095-SKETCH-GROUNDING.md` (Cluster B mechanism + D-03).

## How to View

open .planning/sketches/015-status-strip-and-scroll/index.html

- **▶ Stream** — the run streams; the timer ticks continuously and the active step's STDOUT grows.
- **Scroll the chat up ↑** — follow releases, and the Jump-to-live affordance appears; scroll back down (or click it) to re-arm.
- **⚠ Fire a transient stream-end** — the side-by-side contrast: *Today* (gated by `isStreamingNow || elapsedMs>0`) **vanishes**; *095* (stable-start-ts, continuous) **keeps ticking**.
- **✓ True terminal** — only now does 095 freeze at the final duration.
- **Click any finished step** — it expands in place to its full detail (search results + confidence, sub-agent summary, code + output + file, the todo list, read previews). D-01: details are re-ranked, never hidden.

## Variants (strip placement)

- **A: Header strip** — status rides the run-card header (sticky to the viewport top while the run is on screen). Rich identity, one home; but on a tall run the strip is at the top while the live action is at the bottom — the eye splits. Jump-to-live is a bare pill.
- **B: Bottom live-chip** — the status readout floats at the live edge, always visible, and *is* the scroll anchor (morphs to add "↓ Jump to live" when scrolled up). Status sits exactly where the action is; trade-off is slight occlusion of the bottom line + less identity at the top.
- **C: Hybrid (recommended candidate)** — header strip carries identity/status while the run is in view; the moment you scroll away a bottom chip appears at the live edge with the full status + Jump-to-live. No occlusion while following; honest from both ends — you can never lose the timer or the live edge.

## What to Look For

- **Never vanishes:** fire the transient stream-end — does the 095 readout keep ticking while *Today* blinks out? That's the whole point of D-06.
- **Freeze honesty:** the timer should freeze at the final duration only on **True terminal**, not on the transient.
- **Follow-but-release (D-03):** stream, scroll up → does follow stop and leave you in place? Does the Jump-to-live affordance appear? Does returning to the bottom re-arm follow?
- **Occlusion vs identity:** B floats over the live content; C keeps the live edge clear while following and only shows the chip when you've scrolled away. Which feels calmer?

---

## Build Handover — reuse vs net-new (for a 100% match)

**Key framing:** the "never vanishes" honesty is mostly a **timer-derivation code fix**, not a
placement choice. Placement (winner C) is a small UI addition on top. Line anchors from
`095-SKETCH-GROUNDING.md §3` — re-confirm at plan-phase.

### ✅ Already in the code — reuse

| Asset | Where (verify) | How C uses it |
|---|---|---|
| Elapsed timer (`performance.now()` baseline + 250ms interval) | `RunCard.tsx:83–96` | reuse the ticking mechanism — but re-base on a STABLE start-ts + drop the visibility gate |
| Run-card sticky header | `RunCard.tsx` | the home for C's header strip (top half) |
| `isNearBottom` tracking (<120px) | `MessageList.tsx:45–99` | the seed of follow-release — extend to stream-time |
| Status pill / activity verb | `ToolCallPanel` | the activity segment of the strip |
| Unified action/step count | from **Sketch 014** (D-04) | the strip's "Step N" reads this single source |
| Per-thread demux | `StreamsProvider` | unchanged — each thread's timer stays independent |

### 🔨 Net-new for 100% match

| Need | D | What's missing today | Where it lands |
|---|---|---|---|
| **Stable-start-ts elapsed, rendered continuously, immune to transient stream-ends** | D-06 | timer gated by `isStreamingNow \|\| elapsedMs>0` (`RunCard.tsx:192–199`) → vanishes when a transient terminal (`_isTransientStreamEnd`, `StreamsProvider:166–208`) flips `isStreamingNow` false mid-run | derive elapsed from a persisted/stable run start-ts; render always; freeze only on a TRUE terminal |
| **Persistent status-strip component** (`⏱·Step·activity`) | D-06 | timer + step are separate today and can each vanish | one component reading stable elapsed + unified count + activity verb |
| **Header-strip mount** (C top) | D-06 | header carries identity only | mount the strip in the existing sticky header |
| **Bottom live-chip on scroll-away** (C) | D-03/D-06 | none | a floating chip anchored to the message-list viewport bottom; shows when not following; morphs to add Jump-to-live |
| **Smart follow-scroll** (follow live edge while streaming, release on scroll-up, re-arm at bottom) | D-03 | `MessageList` auto-scrolls only on new MESSAGES, not streaming deltas | follow on stream tick when near-bottom; detect user scroll-up to release; re-arm at bottom |
| **Jump-to-live affordance** | D-03 | none | the chip's morph (C) |

### ↪ Out of scope
- The card frame + per-tool essence + click-to-expand → **Sketch 014** (the strip's "Step N" depends on 014's unified count).
- Output-file hero/working split → **Sketch 016**.
