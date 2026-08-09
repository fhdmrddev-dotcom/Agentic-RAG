---
sketch: 129
name: terminal-run-states
question: "How does a stopped / cancelled-no-output / blocked / failed run read as an honest, persistent chat message state that survives reload — without adding noise to the calm transcript?"
winner: "C"
tags: [phase-174, state-01, state-02, run-honesty, terminal-states, stopped, cancelled, blocked, failed, persistent-badge, runs-status, messageitem, g2-sketch-gate]
---

# Sketch 129: Terminal Run States

## Design Question

Phase 174 STATE-01 + STATE-02. When a run ends in something other than a clean answer — the user **stopped** it, it was **cancelled before any output**, an admin **blocked** it (workflows kill-switch 403), or it genuinely **failed** — the chat surface today lies:

- Cancel-before-first-token → an **empty avatar-only bubble** that reads as broken (`cancelled-run-empty-bubble-early-cancel`).
- Kill-switch refusal → the **workflow title with a blank body** (`killed-workflow-empty-chat-card`).
- The "Response stopped" indicator is **live-only** → it **vanishes on reload** because it lives on `runs.status`, not the message (`cancelled-run-stop-indicator-lost-on-navigation`).

The question: what's the honest terminal-state **vocabulary**, and how loud should each state be — given the operator's "quiet & calm, red for real failure" direction? Every marker must derive from persisted `runs.status` so it survives navigation + reload (STATE-02).

## How to View

```
open .planning/sketches/129-terminal-run-states/index.html
```

**Toolbar (bottom-right):**
- **Reload ⟳** — re-mounts the transcript from persisted state. In *Proposed* the markers persist ✓; flip to *Today (broken)* first and reload to watch them vanish (the STATE-02 bug).
- **Today (broken)** — toggles the real "before": empty bubbles, blank blocked/failed bodies, and a stopped answer that looks complete.

## Variants

- **A · Quiet inline** — every terminal state is a thin dim mono line (`⊘ Response stopped · 1,606 chars · 12s`). Lightest touch on the calm transcript; blocked/failed are just colored inline lines. Risk: a genuine failure may not read loud enough.
- **B · Framed notice** — every interrupted state gets a left-accent framed band + a state pill, scannable at a glance. Consistent and unmissable. Risk: framing the common, deliberate *Stopped* adds chrome to a calm surface.
- **C · Tiered (synthesis)** — the house rule made literal: **dim/quiet** for user-chosen states (Stopped · Cancelled = A's inline line), **amber** for an administrative block (not an error), **red framed** only for a genuine failure (B's notice band). The louder the frame, the more it's earned.

## What to Look For

- **Does the quiet tier read as intentional, not broken?** A stopped answer with a dim footer vs. an empty bubble.
- **Is "Cancelled — no output yet" clearly not-an-error** vs. the blocked (amber) and failed (red) tiers?
- **Does the tier ladder (dim → amber → red) match "quiet & calm, red for real failure"?** Compare C against the all-quiet A and all-framed B.
- **STATE-02 proof:** hover a marker to see the `runs.status` it's keyed off; hit Reload in both modes.

## Grounding (real behavior)

- `runs.status` is authoritative (FND-01 / Phase 145) — no new persistence needed. `cancelled` → dim; a 403 kill-switch refusal → amber (no run persisted); `failed` + `error` → red.
- DB ground truth from the bugs: DeepSeek early-cancel persisted `content_len=0` (the empty bubble); OpenAI stop persisted 1,606 chars (the stopped-with-content case).
- G-5 hot files: the marker render sits in `MessageItem.tsx`; the derive-from-`runs.status` read reconciles on reload (`useMessages.ts` / `StreamsProvider.tsx`). Do not fork the shared render path (D-14).
