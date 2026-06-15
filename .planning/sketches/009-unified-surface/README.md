---
sketch: 009
name: unified-surface
question: "How do BOTH Deep and Harness live in the one panel, and what's left in the chat?"
winner: "C"
tags: [panel, unify, seam, deep, harness, d-094-unify, phase-094]
---

# Sketch 009: Unified Surface (D-094-UNIFY)

## Design Question
Your signed-off decision: the workspace panel becomes the **single live-execution surface for
BOTH Deep AND Harness**. Deep's agent-loop steps + tool calls move OUT of the chat into the panel
too — deliberately **reversing sketch-001** (which put Deep's run-card *in* the chat). The chat
keeps only **prompt + final answer + a quiet pointer**. So: *one execution surface, two drivers.*

This sketch answers the seam question: **what does the now-quiet chat show, and how does the same
panel host both a Harness phase-run and a Deep tool-run?**

## How to View
open .planning/sketches/009-unified-surface/index.html

Two toolbar toggles drive it: **run = Harness | Deep** (proves the panel hosts both) and
**state = Live | Done** (the live→settled transition). Switch variants with the top tabs.

## Variants (all differ on the CHAT-side seam treatment; the panel is settled by 008-D)
- **A: Whisper pointer** — the lightest. Chat = prompt + final answer, with a tiny inline
  `↳ ran in workspace · 3 phases · 48 sources · 18s ▸` appended to the answer. Chat is almost
  pure conversation. Risk: too quiet — loses the mode badge / is easy to miss on reload.
- **B: Receipt card** — a compact, self-contained "run receipt" in the transcript (mode badge,
  name, phase dots, counts, `Open in workspace ▸`) above the answer. Durable, scannable, carries
  provenance (good for auditability). Plain `working…` line while live.
- **C: Live-status → resolves ★** — the lifecycle treatment. **While live:** a pointer status
  line (`● Running in workspace — Review (2/3) · panel is live · Open ▸`) — a pointer, *not* a
  mirror. **When done:** resolves to the final answer + a receipt card. This is B's durable record
  + a proper live moment, and it matches sketch-007's "live-pointer / reload-resolved" winner.

## What to Look For
- **The reversal:** toggle to **Deep** — its tool calls (`search_documents`, `execute_code`) now
  render in the *same* panel as Harness's phases, and the chat receipt looks structurally identical
  to the Harness one. Convince yourself "one surface, two drivers" reads true.
- **Quiet vs. record tension:** is A's whisper *too* quiet (you can't tell Harness from Deep at a
  glance), or is B/C's receipt the right amount of "what happened" for an auditable transcript?
- **No double-answer:** the chat shows the **final answer prose**; the panel shows the **run
  record** (provenance) — never the same content twice.
- **Live pointer ≠ mirror (PANEL-06):** the chat live-status line is a static pointer; the live
  detail lives only in the panel, so panel updates never re-render the chat.

## Fidelity note
The panel timeline embedded here reproduces **008-D's shape + connector language only** (spine +
status-colored connectors + RunCards). 008-D owns the full behavior — the per-card caret/collapse
interaction and the complete **5-state** legend (this sketch shows only done/run/lock, not fail/retry).
When building, the panel timeline component is **008-D**; 009 only governs the chat↔panel *seam*.

## Recommendation
**C** — it's effectively B + the right live moment, and it mirrors the already-shipped sketch-007
seam model. A stays available as the ultra-minimal option if you want the chat absolutely pure.
Open sub-choice: receipt **above** the answer (B, chronological) vs **below** it (C, answer-first).
