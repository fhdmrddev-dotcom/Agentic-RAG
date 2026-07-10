---
sketch: 049
name: chat-area-reclaim
question: "With the tool card now canonical, can we DELETE the redundant sticky composer timer — and does always-visible status survive on the header strip + floating 'Jump to live' chip alone? (CTC-03)"
winner: "A"
tags: [phase-128, chat-area-reclaim, ctc-03, sticky-timer, elapsed-surfaces, before-after, honesty]
---

# Sketch 049 — Chat-Area Reclaim (CTC-03)

## Design Question

There are **three** elapsed/status surfaces in the chat today, and one is dead weight:

1. **Header status strip** — `RunStatusStrip placement="header"`, riding the run-card header (`RunCard.tsx`). The canonical Phase 095 surface. **KEEP.**
2. **Floating "↓ Jump to live" chip** — `RunStatusStrip placement="header-bare"` inside the scroll-away pill (`MessageList.tsx`). The 095 hybrid home #2. **KEEP.**
3. **`StickyTimerBar`** — the OLD Phase 076.1 D-03 surface (`ChatArea.tsx:533`): a `Loader2` spinner + `{m:ss}` + `Step {N}` + `{N} files` + `{description}`, pinned above the composer **outside** the scroll area. It duplicates #1 + #2 and is the motivating bug ("shows for some providers, vanishes for others"). **REMOVE.**

Can we delete #3 cleanly, and does honest always-visible status survive on #1 (in view) + #2 (scrolled away) alone? And what does the chat area do with the reclaimed space?

## How to View

Open `index.html` (it links `../themes/default.css`). Two variant tabs share one before/after spine:

1. **Toggle `Before` / `After`** in the per-variant control bar — *Before* shows all three surfaces (with the sticky timer flagged `redundant`); *After* **collapses the sticky timer to zero height + fades it out** (the bar is genuinely deleted, not merely overlaid), reveals the reclaimed band, and the composer visibly rises into the reclaimed pixels. The surface-tally pips drop from 3 → 2.
2. **Click `Scroll up off live edge ↑`** (or scroll the chat column manually) — the load-bearing test: the run-header (home #1) scrolls off the top, you leave the live edge, and the floating chip (home #2) appears so status stays honest. (The viewport is now tall enough — ~520px of trailing content — that the header genuinely clears the top; `maxScroll` ≫ the run-header's offset.)
3. **Click `Jump to bottom (header off top) ⤓`** — the A-vs-B prover. It lands you at the live edge *with the run-header still off the top*. This is the one state that separates the variants: **A hides** the chip (you're pinned to the live edge — standard hybrid), **B keeps it shown** (promoted trigger: the header is off-screen, so status rides up regardless). Flip between the A and B tabs after clicking to feel the difference.
4. **Click the floating chip** to "Jump to live" — it re-pins to the live edge.
5. All three surfaces tick a **shared stable start-ts** (~3m12s) so they read identically — proving #3 carries nothing #1 + #2 don't already say.
6. Toolbar (bottom-right): viewport buttons Phone 400 / Tablet 720 / Desktop 860.

## Variants

- **A — Clean removal.** The AFTER is pure subtraction. Header strip + floating chip carry status; the composer reclaims the band. The floating chip follows the **standard hybrid** rule: it appears only when you scroll **up** off the live edge (never occludes the live stream while following). The most conservative read of "the card is canonical now."
- **B — Removal + promoted floating chip.** Same deletion, but the floating chip is promoted: it appears the **moment the run-header scrolls off the top** (not only on scroll-up) — a stronger always-on fallback for users who relied on the old always-visible strip. Trade-off: a status chip is on-screen almost the whole tall run (closer to the old always-visible feel, a touch busier).

## Winner — A (operator, 2026-06-27)

**A wins; B rejected.** In review the operator could not perceive a difference between A and
B ("I really do not see the difference"). That is itself the finding: the only thing B changes
is *when* the floating chip appears (the moment the header scrolls off vs. on scroll-up), and
if that delta is imperceptible in practice it does not justify B's **net-new trigger-rule** in
`useFollowScroll`. Ship the conservative **standard hybrid** (A): the existing
`showJumpToLive = !isPinned && isStreaming` predicate, zero net-new behavior. **Do not add the
promoted-chip trigger** — it buys a UX change no one can feel at the cost of new code on a
scroll path. (If, post-ship, users report losing always-visible status after the sticky-timer
removal, B's promoted trigger is the documented fallback to revisit.)

## What to Look For

- **The redundancy is visible before you read it** — in *Before*, three surfaces show the *same* `3m12s · Step 5 · {description}`. That sameness is the argument for deletion.
- **Honesty survives the scroll** — after deleting #3, scroll the header off and confirm the floating chip still tells you elapsed + step + that the run is live. If status ever goes dark on scroll-away, the removal failed.
- **The reclaim is real, not cosmetic** — the composer sits higher; the green dashed band marks the pixels the old timer ate.
- **A vs B is a chip-trigger decision, not a layout one** — both delete the same surface; they differ only in *when* the floating chip shows. Pick by how much "always-visible" the old strip's users actually need.
- **Acceptance moment:** 30+ seconds into a multi-tool run — can the user still read what's happening and trust the timer, with the sticky bar gone?

## Build Handover

**This is pure removal of an old (076.1) surface. No net-new wire field.** The win is reclaimed chat-area space + one honest status source instead of three.

| Surface | Real file / component | Change in Phase 128 |
|---|---|---|
| Sticky timer (#3 — DELETE) | `ChatArea.tsx` — `StickyTimerBar` (`:533-585`) + its mount (`:521-524`, the `{isStreaming && (() => …)}` block) | **Delete the component and its mount.** Drop the now-unused `Loader2` import if nothing else uses it. |
| Header strip (#1 — KEEP) | `RunCard.tsx` — `RunStatusStrip placement="header"` (`~:309`), under the avatar + `run-sub` (`{provider} · {model} · turn N`, `:246`) | Unchanged. Already the canonical 095 surface. |
| Floating chip (#2 — KEEP) | `MessageList.tsx` — the `showJumpToLive` pill (`:208-230`) hosting `RunStatusStrip placement="header-bare"` + `useFollowScroll` | **A:** unchanged (existing `showJumpToLive = !isPinned && isStreaming`). **B:** widen the trigger so the chip also shows when the run-header has scrolled off the top — a predicate tweak in `useFollowScroll`, *not* a new wire field. |
| Reclaimed space | `ChatArea.tsx` composer region (`inputBar`, `:525`) | Once `StickyTimerBar` is gone the composer naturally rises; no layout work beyond removing the bar. |

**Honesty flags:**

- **`gated` (warning).** CTC-03 is **gated on CTC-02 holding** — only remove the sticky timer once the tool card is verifiably the canonical, complete status surface across all 8 providers (`openai, anthropic, google, deepseek, moonshot, zhipu, minimax, openrouter`). Removing #3 before the card is uniformly honest could leave a provider with no visible status. Surfaced on the mockup as the `gated` chip on the gate-note bar.
- **`net-new` (violet) — Variant B only.** B's *promoted* chip trigger (show the chip the moment the header scrolls off the top, not only on scroll-up) is a **net-new trigger rule** in `useFollowScroll`. It reuses the existing 095 floating chip component and the existing wire data — only the *when-to-show* predicate is new. Variant A introduces **no** net-new behavior at all (it is the existing standard-hybrid trigger).

No new SQL, no new SSE event, no new wire field. The kept surfaces (#1, #2) and their data (`message.provider/model`, stable start-ts elapsed, `unifiedStepCount`) already ship today.
