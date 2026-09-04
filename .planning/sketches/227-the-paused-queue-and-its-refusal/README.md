# Sketch 227 — The paused queue and its refusal

**Phase:** 230 (The Durable Ingestion Queue) · **Requirement:** `QUEUE-05` / SC#3
**Date:** 2026-09-05 · **Status:** awaiting operator decision · **Winner:** _not yet locked_
**Closes:** `BUG-260815-05` (a 429 surfacing as *"your documents returned nothing"*)

Open `index.html` (served over http — `file://` is blocked in the driven browser) and press
**▶ Run the outage**. The batch runs, OpenAI rate-limits at file 218, the queue pauses and names the
provider, a countdown ticks, and it resumes on its own and finishes.

## Why this sketch exists

Phase 230's G-2 gate fired: the paused state and the named refusal are user-visible, so they need an
operator-approved mockup before `230-05` is planned. Gemini requested it on `BUS-110`.

⭐ **Operator direction, 2026-09-05:** *"consider to add 3D animation and engaging content in line with
our theme — it should indicate visually more because our design currently is very static and boring."*
So this sketch follows the **Phase 127 precedent** — energized is the default, with a **calm anchor kept
as an in-sketch toggle** so we can feel exactly what the motion buys. Every variant works at
`--energy: 0`.

## The three variants

| | Variant | The idea | Cost |
|---|---|---|---|
| **A** | **The provider orb** | The provider is a physical object: a 3D-lit sphere that breathes while embedding, **holds its breath** (amber, slower, slightly contracted) when rate-limited, and settles green when done. The refusal grows out of it. | One more thing on screen; the orb must never imply a percentage it doesn't know. |
| **B** | **The batch lane** | Every ~10 files is a bar. You watch the wave move and see **exactly where it stopped** — the held amber column is the file the provider refused. | Reads as a chart; at 3,000 files the bars stop being individually meaningful. |
| **C** | **The quiet strip** | The calm anchor: one line while working, and the refusal is the only thing that ever raises its voice. | Honest but, at rest, it is a spinner with a number — the thing the operator called static. |

## Honesty rules the surface is built on

- The refusal **names the provider and the status** (`openai · 429 insufficient_quota`) and shows the
  provider's **own words verbatim** in a mono block.
- **The finished count is real and preserved** — *"218 of 340 files are already added and stay added.
  The remaining 122 are queued, not lost."* Nothing is re-embedded (SC#4's resume).
- The retry is a **countdown, never a fake percent**, and says **"nothing for you to do."**
- ⛔ Never *"your documents returned nothing"* — rendered in-sketch as a red "what this replaces" note
  so the old behaviour stays visible next to the new one.
- ⛔ **Never a silent swap to another provider.** D-2: `document_chunks.embedding` is `vector(N)` with
  one global `N`, and matching the dimension does not make vector **spaces** compatible.

## Motion inventory (all respect `prefers-reduced-motion`)

`orbFloat` 6s 3D drift · `orbHeld` 3.4s contracted breath (paused) · `ringPulse` 2.4s expanding rings ·
`comet` 1.7s energy sweep along the determinate bar (059-A lineage) · `laneRise` 1.1s active-column
rise · `dotBounce` 1.4s retry dots · `brandPulse` 1.5s live file dot · `fadeSlideUp` 0.34s refusal
entrance. The comet and rings are the only purely decorative motion, and both are gated on `--energy`.

## Verified before handoff

Driven in Chrome, not just written: the simulation runs, pauses at 218/340, renders the refusal with a
live countdown, resumes and completes. **Zero console errors.** (The `feedback_verify_sketch_js_before_handoff`
rule.)

## Open questions for the operator

1. **Which variant** — or A's orb on B's lane?
2. **Where does this live?** The sketch draws it as a card on the Library/ingestion surface. It could
   also be a slim always-visible strip. `SURF-03` (Phase 235) notes this product has **no in-app
   notification surface at all**, so a paused queue is currently only discoverable by opening the page.
3. **Is the orb honest at scale?** It carries no percentage of its own — the bar does. Confirm that
   separation is right before it is built.
