---
sketch: 130
name: live-preparing-honesty
question: "Before the first visible token, and on nav-back into a long run, what tells the user the model is actually working — with an honest timer anchored to started_at and a single avatar?"
winner: "C"
tags: [phase-174, state-03, state-04, preparing-state, reasoning-activity, setting-up-agent, anchored-timer, single-avatar, run-honesty, streamsprovider, g2-sketch-gate]
---

# Sketch 130: Live Pre-Answer Honesty

## Design Question

Phase 174 STATE-03 + STATE-04. In the gap before the first visible token — and when you navigate back into a long streaming run — chat today lies about whether the model is working:

- **"Setting up agent…" hides real activity** (`setting-up-agent-hides-model-activity`): the outer banner (`toolMeta.ts:73`) returns "Setting up agent…" whenever there are no tools yet — `reasoning_delta` and `tool_args_progress` **don't count as activity**. Kimi streamed ~4,000 reasoning tokens while the banner said nothing was happening. The exact "is it stuck?" anxiety that triggers manual restarts.
- **Timer resets + duplicate avatar on nav** (`BUG-260610-01`): navigating away and back into a workflow run reseeds the elapsed timer **from component mount** instead of `started_at` (a 5-minute run reads "28s"), and a **duplicate empty avatar** renders from the mount/first-SSE double-mount race.

The question: what does the pre-answer state look like so the model's real work (reasoning · writing tool args · sandbox cold-start) is honestly visible, with a timer anchored to `started_at` and exactly one avatar?

## How to View

```
open .planning/sketches/130-live-preparing-honesty/index.html
```

The timer and the activity sub-state are **genuinely live** — the run is seeded 41s deep (the anxiety moment) and the sub-state cycles Reasoning → Writing execute_code → Spinning up sandbox.

**Toolbar (bottom-right):**
- **Nav away & back ⤢** — the STATE-04 proof. In *Proposed* the timer keeps climbing from `started_at` and stays one avatar; flip to *Today (broken)* and it resets to ~0s + spawns a duplicate empty avatar.
- **Today (broken)** — swaps in the dead `Setting up agent…` banner (STATE-03 bug) while the model is visibly reasoning.

## Variants

- **A · Activity line** — fix the banner label in place: one honest line (`💭 Reasoning… · 4,182 reasoning tokens · 41s`) + a dim thought-peek. Minimal, calm; directly replaces the `toolMeta.ts:73` dead label.
- **B · Prep stepper** — a compact `Queued → Reasoning → Writing tools → Running` sequence with the live node lit + elapsed + detail. Shows the *shape* of the prep gap. Risk: over-explains a often-2-second gap.
- **C · Run-header sub-state** — no separate banner; the shipped run-card header carries a live activity pill + the anchored timer + one avatar. Fixes STATE-03 **and** STATE-04 in a single instrument (matches live-run-container D2 + Sketch-015 never-vanishes strip).

## What to Look For

- **Does the pre-answer state read as "working," not "stuck"?** Compare each proposed variant against the broken `Setting up agent…`.
- **Is the honest activity legible without being noisy?** A calm one-liner (A) vs. a pipeline (B) vs. an instrument header (C).
- **STATE-04:** hit **Nav away & back** in both modes — the timer must survive and the avatar must stay single.
- **Which surface should own the sub-state** — a standalone line, a stepper, or the run-card header?

## Grounding (real behavior)

- Real sub-states come from events the backend already emits on `run:{run_id}`: `reasoning_delta`, `tool_args_progress` / `tool_preparing`, then `tool_start`. The fix is counting them as activity, not new backend work (STATE-03 is a frontend-legibility fix; title-gen-serial + sandbox-cold-start are separate latency causes, honest-label only).
- STATE-04 timer: seed elapsed from the run row's `started_at`/`created_at`, not mount — the same fix Phase 095.1 applied to Deep run cards, extended to the workflow/harness run strip. Single avatar = resolve the StreamsProvider/MessageList double-mount.
- Real timings that motivate the honesty (from the bug's Redis timelines): kimi `reasoning_delta` +1.4s then ~4,000 events; gpt-5.5 ~26s streaming script into tool args; sandbox cold-start 15–22s per new thread.
- G-5 hot files: `StreamsProvider.tsx` / `useMessages.ts` (timer anchor + dedupe the avatar), `MessageItem.tsx` (the activity render). Red line D-14: Deep byte-identical; render layer only.
