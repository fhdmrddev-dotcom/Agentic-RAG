---
sketch: 276-iris-avatar
name: iris-avatar
question: "How does the Iris mark behave as the chat assistant avatar: moving while the agent works, settling to the static mark when idle or done, honest about the waiting, error and cancelled states?"
winner: "pending operator review (recommended: B Orbit at 32px + the recommended layout; D Orbit + wave offered for larger marks)"
tags: [phase-276, D-24, iris, avatar, motion, run-state, g2-sketch-gate]
---

# Sketch 276: Iris assistant avatar

The G-2 sketch for D-24 (`276-CONTEXT.md`). The operator wants the chat assistant avatar to be the Iris
mark, animated in the manner of Claude.ai's assistant mark. It moves while the agent works, settles to the
static mark when idle or done, and stays static under `prefers-reduced-motion`. Input study:
`.planning/phases/276-public-docs-api-reference-video-library/276-LOGO-INVENTORY.md` §A.

## How to view

Run `python -m http.server 8276` from `.planning/sketches/`, then open
`http://127.0.0.1:8276/276-iris-avatar/index.html`. Opening the file directly also works.

Top bar: **Variant** (A / B / C / D) × **State** (7) · **▶ Play a turn** (thinking → tool → streaming → done) ·
**Layout** (Recommended / Today) · **Theme** · **Chip** · **Motion** (Full / Reduced).

The page has five parts. **Judge the motion at 32px in the transcript first.**

1. A realistic transcript: a finished assistant row, then a live row whose content follows the state. The readout on the right shows the derivation predicate.
2. The lab: sizes 96, 48, 32 and 20px, plus a board with every state side by side. Both follow the Variant control, so pick D to see D everywhere, including Play a turn. Below them, a fixed B vs D comparison.
3. Decision 1: one avatar or two.
4. Decision 5: before and after for the indicators.
5. Decision 4 (light theme), then Decisions 2 and 3.

## Variants (working states only; every variant settles to the same static mark)

| | Motion | Elements | Loop |
|---|---|---|---|
| **A · Breathe** | Petals open and close together (translate out 3 units + scaleY 1.08), the core swells, a soft glow breathes behind | `.pt`, `.core`, `.glow` | 1.6 s sine ease-in-out; keyframe 0% = rest |
| **B · Orbit** | The petal ring turns 120° per cycle, with the glow breathing | `.spin`, `.glow` | 1.6 s linear; 120° is the mark's own symmetry (gradients alternate A/B), so the loop is seamless |
| **C · Petal wave** | A light travels round the petals: each petal brightens and extends in turn, staggered by 1/6 cycle (the Claude spark-shimmer idea) | `.pt` (staggered), `.glow` | 1.6 s; the wave starts at the top petal, because the delays are positive and the keyframe's 0% equals rest |
| **D · Orbit + wave** (operator request) | B's ring rotation and C's travelling light running together. The ring (`.spin`) carries the petals, and each petal (`.pt`, inside the ring) runs the wave, so the two loops compose without interfering | `.spin`, `.pt` ×6 (staggered), `.glow` | 1.6 s for both loops; reuses `irisOrbit` + `irisWave` + `irisGlowSoft`, with no new keyframe |

**Animation count per avatar:** A 8 · **B 2** (`irisOrbit`, `irisGlow`) · C 7 (6 × `irisWave` + `irisGlowSoft`) ·
**D 8** (`irisOrbit` + 6 × `irisWave` + `irisGlowSoft`). In D, one `playbackRate` drives all eight, so tool
running speeds up the orbit and the wave together (×1.45) and streaming slows both (×0.8).

**D's settle:** the orbit coasts forward to the next 120°, as in B. At the same moment each petal fades from
its live opacity back to the rest value of 0.85, and the glow fades out. All eight settle animations start
together. In the browser check, the ring went from 95° to 120° while the six petals eased from 0.38–0.99
back to 0.85.

All three use transform and opacity only. Keyframes are new: `irisBreathe`, `irisCore`, `irisGlow`,
`irisGlowSoft`, `irisOrbit`, `irisWave`. The sketch never uses `brandPulse`.

**Transitions never snap:**
- **Spin-up:** entering a working state tweens `playbackRate` from 0.2 to the target over about 0.5 s.
- **Working state to working state** (thinking → tool → streaming) only changes speed: `playbackRate` is tweened, the animation keeps its position, and nothing restarts.
- **Settle** (to idle, waiting, error or cancelled): the code captures the live pose (computed `transform`/`opacity`), drops the loop, and runs a WAAPI animation from that pose to rest in 560 ms with `cubic-bezier(.2,0,0,1)`.
  - Orbit settles differently: it decelerates *forward* to the next 120° multiple. That pose looks identical to rest by symmetry, so it never rewinds. The starting slope matches the current spin speed.
- **Colour changes** (amber, red, dim) transition `stop-color` and `fill`, never an animated property. That way a tone change and a settle can run at the same time ("settles and turns amber").

## Recommendation

**B · Orbit, with the recommended layout.** This is provisional: I verified the motion runs, but judging
motion feel is the operator's call and I could only check it through still screenshots.

- **It is the only variant that clearly reads at 32px.** A moves its petals about 1.2 screen px at 32px with the chip, so its signal is mostly the glow. C's contrast swing (0.38 → 1) is legible, but it is the busiest of the three in a column of text. The sketch-findings rule applies here: "if the operator can't feel the difference, don't ship the mechanism" (049-B).
- **It matches the brief.** Claude.ai's mark turns and twinkles while working; a rotating Iris is the direct translation. It also reuses the animated lockup's own vocabulary (`a_sp`, the spin).
- **The settle is the most satisfying.** The ring visibly slows to a stop, which reads as "done" by itself.
- **It costs the least.** It animates two elements (`.spin`, `.glow`), against eight for A and seven for C. That matters in a non-virtualised, `React.memo` message list.
- **The fallback is cheap.** If the operator finds B too spinner-like, A is the calm fallback and its settle is trivial (0% = rest).

### B vs D at 32px (an honest comparison)

Use **Lab · B vs D side by side** to compare them. Those tiles are locked to B or D, ignore the Variant
control, and show each pair at 32px and 48px in thinking, tool running and streaming.

- **What D adds:** at 48px and above, D reads richer than B. The ring turns *and* a highlight runs round it, which is closer to Claude's twinkle. At 32px with the chip, the mark is about 27px across and the petals are about 5–6px wide. The wave's brightness swing (0.38 → 1) is still visible there, but it is fighting the rotation for the eye.
- **Two motions, one meaning:** the wave runs at 1/6-cycle stagger while the ring turns 120° per cycle. So the highlight moves round the ring *relative to petals that are themselves moving*, and its apparent speed is the sum of the two. That makes D feel noticeably faster and busier than B at the same `playbackRate`. Tool running (×1.45) pushes it closest to "busy spinner".
- **Cost:** D runs 8 animations per avatar against B's 2. That only matters for the live row (finished rows are static), but it is 4× the compositor work for the same meaning.
- **Settle:** both settle cleanly. B's is a single motion coming to rest; D's is two things stopping at once (coast plus fade). D's settle reads slightly less like "done" than B's.
- **Verdict:** **B stays the recommendation for the 32px chat avatar.** If the operator likes D's richness, the strongest place for it is the larger, one-off marks where the inventory already wants the Iris animated: the empty-chat hero (64px) and the boot splash. There, D's extra layer reads clearly and nothing competes with it. Another option is D with the orbit slowed (e.g. ×0.6 of B's speed), so the wave leads and the rotation becomes ambient. That is a one-line change worth trying if D is preferred.

## State → motion

| State | Derivation (from `message` alone) | Avatar |
|---|---|---|
| idle / done | `runStatus === "completed"` or `undefined` (historic rows) | static mark, full colour |
| thinking | `runStatus === "streaming"`, no `content`, no `tool_calls` (or `isPlanning`, or reasoning only) | working motion ×1.0 (1.6 s) |
| tool running | streaming and a `tool_calls[].status` is `running` or `preparing` | working motion ×1.45 (≈1.1 s) |
| streaming text | streaming, has `content`, no running tool, not planning | working motion ×0.8 (≈2 s); calmer because the text is moving |
| waiting on user | `hasPendingAsk(message)` or `toolApproval` without `decision`, or `lock?.capPaused` (the lock is already read at `MessageItem.tsx:283`) | settle → **amber**, still (`pending-question.md` D2) |
| error | `runStatus` `failed` / `timed_out` | settle → grey petals, **red core**; the red framed notice carries the reason |
| cancelled | `runStatus` `cancelled` / `stopped` | settle → grey, 50% opacity (the dim tier, `run-state-honesty.md` D1) |
| reduced motion | any working state | no movement; a **steady lit core** (glow 0.5) marks "working"; the colour states are unchanged |

Precedence when several match: error > cancelled > waiting > tool > thinking > streaming > idle. Waiting
must beat tool, because `ask_user` *is* a tool whose status is `running`.

## Open decisions (inventory §"Decisions for the avatar sketch"), with recommended answers

1. **One avatar or two on tool turns → one live avatar.** The Iris in the MessageItem gutter animates. The RunCard header keeps the provider logo (sketch 048), **static**: its `animate-brandPulse` is removed. "Iris in both places" is rejected because it loses model attribution.
2. **RunCard `Bot` fallback (`:350`, `:450`) → keep `Bot`.** The RunCard avatar answers "which model?" and the Iris answers "who is talking?". An Iris in the unknown-provider slot would read as "Syrel" where it means "unknown model". The collapsed-run `Bot` (`:450`) stays too, because the gutter Iris already sits beside it.
3. **Keyframe → new `iris*` names.** Delete the dead `brandPulse` at `index.css:501` (the later one at :973 wins today, so the live avatar currently *shrinks and dims*; the sketch shows both side by side). Keep :973 for its remaining users, the "every action recorded" dots in `OrgBand.tsx:93` and `OperatorBand.tsx:70`, where shrink-and-dim suits a dot.
4. **Light theme → a dark backing chip (`#0A0E18`, 1px ring), in both themes.**
   - On white, the bare mark loses its `#F2F4FE` core and its petals wash out (shown in the sketch).
   - The chip means no second artwork to maintain. It matches how the favicon and PWA icons are planned (mark on `#06090F`), and the avatar becomes the same object in both themes. In dark mode the chip is nearly invisible.
   - The mark sits at 84% of the chip, so petal tips clear the edge even at Breathe's maximum stretch.
   - Fallback option: a darker light-theme variant (also shown), but it is new brand art.
5. **Indicators to remove:**
   - the pre-first-token `Loader2` and the three `dotBounce` dots (`MessageItem.tsx:891-921`);
   - the `✦ Working` badge (`WorkingBadge.tsx`; its planning-gap window is exactly the avatar's *thinking* state);
   - the RunCard header `Loader2` (`RunCard.tsx:433-435`);
   - the RunCard avatar's pulse.

   **Keep:**
   - the activity words (`outerBannerLabel`, Phase 174 STATE-03);
   - the timer anchored to `started_at`;
   - the `.tool-progress-bar` shimmer, newly gated by reduced motion;
   - the streaming caret;
   - the `Loader2` + tool label at `:971-983`.

   ⚠ Why the RunCard keeps its liveness: on a long turn the gutter avatar scrolls out of view while the RunCard header stays sticky. The header still has a ticking timer and the shimmer bar, so the run never looks dead with the header `Loader2` gone.

## Mapping to an implementation

A pure presentational component, fed from the `message` prop that `MessageItem` already holds. **No new
store subscriptions**: no `usePhases`, `useAskUserPrompt` or `useWorkspaceFiles` (cost constraint,
`MessageItem.tsx:215-224`).

```tsx
// src/components/chat/irisState.ts — pure, unit-testable, the ONE home of the precedence order
export type IrisState = "idle" | "thinking" | "tool" | "streaming" | "waiting" | "error" | "cancelled"
export function irisStateFor(m: Message, capPaused?: boolean): IrisState {
  if (m.runStatus === "failed" || m.runStatus === "timed_out") return "error"
  if (m.runStatus === "cancelled" || m.runStatus === "stopped") return "cancelled"
  if (hasPendingAsk(m) || (m.toolApproval && !m.toolApproval.decision) || capPaused) return "waiting"
  if (m.runStatus !== "streaming") return "idle"
  if (m.tool_calls?.some(t => t.status === "running" || t.status === "preparing")) return "tool"
  if (!m.content || m.isPlanning) return "thinking"
  return "streaming"
}

// src/components/brand/IrisAvatar.tsx
export const IrisAvatar = React.memo(function IrisAvatar({ state, size = 32 }: { state: IrisState; size?: number }) {
  const uid = React.useId().replace(/:/g, "")   // unique gradient ids per instance (brand SVGs share g/h)
  const ref = React.useRef<HTMLSpanElement>(null)
  // useLayoutEffect on [state]: (1) tween playbackRate between working states, (2) on leaving a working
  // state, capture the live pose and run the WAAPI settle (the sketch's Iris.settle, ~30 lines),
  // (3) skip all of it when matchMedia("(prefers-reduced-motion: reduce)") matches.
  return <span ref={ref} className="iris chip" data-state={state} data-motion={…} aria-hidden="true">…svg…</span>
})

// MessageItem.tsx:476-481 — replace the gradient + Sparkles div, KEEP data-testid="assistant-bot-icon"
<div data-testid="assistant-bot-icon" data-iris-state={irisState} className="flex-shrink-0 mt-0.5">
  <IrisAvatar state={irisStateFor(message, workflowLock?.capPaused)} />
</div>
```

- **CSS:** the `.iris` block and `@keyframes iris*` go in `index.css`, with a `@media (prefers-reduced-motion: reduce)` reset. Keep them out of `tailwind.config.js` `extend.keyframes`: the selectors are attribute-driven, not utility classes.
- **The tests move with the code.** `MessageItem.test.tsx:141-217` pins the test id and `animate-brandPulse` iff streaming. That becomes `data-iris-state` assertions plus a pure `irisStateFor` table test. `RunCard.logo.test.tsx` and `RunCard.test.tsx` lose the pulse-on-avatar expectation.
- **G-5:** `MessageItem.tsx` (35 phases) and `RunCard.tsx` are firing hot files. The change is one import plus one element swap in each, and the state logic lives in the new pure module.
- **Accessibility:** the avatar is `aria-hidden`, because the activity words carry the state for screen readers.
- **Out of scope here:** the other D-24 placements (empty-chat hero, boot splash, SetupWizard) can reuse `<IrisAvatar state="idle">` or `"thinking"` later.
