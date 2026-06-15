---
sketch: 014
name: unified-card-frame
question: "What does the unified chat tool card look like at rest (one-line essence) and expanded — and how does the multi-card stack compose mid-run under Focus Mode?"
winner: "Synthesis — C's calm numbered rail + active bloom, with B's status nodes"
tags: [chat, tool-card, focus-mode, dedup, phase-095, G-5]
---

> **Winner: Synthesis (tab S).** Borderless numbered rail that fills with status nodes
> (filled-green = done, pulsing-primary ring = active) + active-step bloom. Calmest at rest,
> one controlled spike at the live moment; the row numbering makes the honest step count (D-04)
> and the zero-duplicate invariant (D-05) structurally legible. A/B/C preserved for the record.

# Sketch 014: Unified Card Frame

## Design Question

Phase 095 makes every Deep-mode chat tool card render in **one consistent, calm frame** —
finished cards fold to a single essence line, the live step stays open, and the read/summarize
sub-agent never doubles. This sketch locks the **frame + the live composition**, building directly
on the locked direction (001-C run-frame · 002-C tool-card · 003-B Focus Mode). It does **not**
restart the design — it refines it for the 095 felt-experience fixes (D-01, D-02, D-05).

Grounded by `095-SKETCH-GROUNDING.md` (real SSE events, real essence strings, real bug mechanics).

## How to View

open .planning/sketches/014-unified-card-frame/index.html

Same **real run** renders in all three tabs (a Kimi "build me a deck" job: search → read →
analyze_document sub-agent → execute_code → live pptx build), so you compare the **frame**, not the
content. Controls:
- **▶ Play run** — watch steps appear, fold to essence as the next opens (the D-02 felt moment), timer tick, then collapse on done.
- **● Mid-run / ✓ Finished** — jump to the live Focus-Mode state or the collapsed terminal state.
- **Show today's double-render bug** — toggles the read/summarize sub-agent between today's 2-card bug and the fixed single card (D-05).
- Click any finished essence row to expand its full body in place (D-01: details re-ranked, never hidden).

## Variants

- **A: Flat essence rows** — lowest chrome; each step a calm line, active step opens in place with a thin accent. Closest to Claude.ai. Fast to read; weakest visual sequencing.
- **B: Bordered cards on a status spine** — most "instrument"; a filling spine (green→done, pulsing primary→active) makes the locked sequence *felt*, echoing the 008 phase-timeline at the tool level. Heaviest chrome.
- **C: Continuous rail + blooming active row** — a numbered rail gives sequence like B, but cards aren't individually bordered; the active step "blooms" (primary wash + left bar) while finished steps stay tight. The calm middle.

## What to Look For

- **Resting essence (D-01):** does the one-line `icon · tool → result` read as the *new information* the step produced, calm and scannable? (e.g. `🔍 search_documents → Found 14 chunks in "thesis.pdf" (avg 0.61)`)
- **Focus Mode (D-02):** mid-run, only the active step is open + live; everything before it is one line. Does that feel "I can see what's happening now" without scrolling?
- **Zero-duplicate (D-05):** flip the double-render toggle — the fixed single sub-agent card vs today's two. Which frame makes the single-card invariant most obvious?
- **Honest collapse (D-04 preview):** on Finished, the run folds to `Run · 6 steps · ✓ done · 3m48s` and the count == cards on screen.
- **Sequencing vs calm:** A is calmest, B is most oriented, C splits the difference. Which matches "calm instrument"?

The persistent **status strip** in the header (`⏱ 3m16s · Step 5 · Running code…`) is shown here but
its *placement + the Jump-to-live affordance* are the subject of **Sketch 015**; the output-file
hero/working split is **Sketch 016**.

---

## Build Handover — reuse vs net-new (for a 100% match)

Goal for the planner/executor: make the real `RunCard` + `ToolCallPanel` render exactly this
Synthesis frame. Split by what's **already in the code** (reuse) vs what's **net-new**. Line anchors
from `095-SKETCH-GROUNDING.md §3` — re-confirm at plan-phase (FILES are firm; lines are evidenced
but unverified). **G-5 note:** ToolCallPanel / MessageItem / StreamsProvider are hot files but
satisfied at 075.7; 095 is the first feature touch since the refactor → G-5 does not fire. All changes
must stay **additive** and must not regress the per-thread demux or PANEL-06 isolation.

### ✅ Already in the code — reuse as-is (or lightly)

| Asset | Where (verify lines) | How the Synthesis frame uses it |
|---|---|---|
| Run-frame + sticky header + active glow | `RunCard.tsx` | the outer container — keep verbatim |
| Collapsed terminal summary row (`Run · N tools · ✓ done · 1.2s ▸`) | `RunCard.tsx:222–248` | the Finished state — keep; relabel "N tools" → "N steps" for D-04 |
| Expanded gate (`isStreamingNow \|\| !hasTools \|\| userExpanded`) | `RunCard.tsx:73` | keep; running = open |
| Per-tool inner bodies (editor inset, STDOUT/STDERR regions, search rows, file preview cards) | `ToolCallPanel.tsx` `ExecuteCodeBody` / `SearchDocumentsBody` / … | reuse **verbatim** as the expand-on-click body |
| Result-summary row (`→ {summary}`) | `ToolCallPanel.tsx:209` | the seed of the essence line — **extend to every tool** (see net-new) |
| Status pill (running / done / err) | `ToolCallPanel` | reuse |
| `clientKey` stable-identity stamp + dedup `Set` | `StreamsProvider` `onToolPreparing`/`onToolStart`; `toolKey.ts:36–45`; `ToolCallPanel.tsx:322–334` | reuse for regular tools; **extend to the sub-agent path** (D-05) |
| Elapsed timer (`performance.now()` baseline + 250ms interval) | `RunCard.tsx:83–96` | reuse to feed the strip — but D-06 hardening is **Sketch 015** |
| Motion tokens (`fadeSlideUp`/`brandPulse`/`toolSlideIn`/`dotBounce`/`pulseGlow`) | `index.css` (UI-SPEC §5.2 R-7) | reuse; **no new keyframes** |
| Per-tool Lucide icons | tool→icon map | reuse |
| Per-thread demux (`streamingThreads`, etc.) | `StreamsProvider` | unchanged — preserve isolation |

### 🔨 Net-new for 100% match — the work this sketch defines

| Need | D | What's missing today | Where it lands |
|---|---|---|---|
| **Numbered status rail** (node + connecting line + step-number gutter) | D-04 | no rail exists on the chat tool surface (the 008 spine is panel/Harness-only) | new presentational wrapper in the run-body; **pure UI** — data = card index + status, already derivable from the existing `tool_calls` array |
| **Node states** (filled-green done / pulsing-primary-ring active / dim queued) + green→primary fill | D-04 | none | new CSS using existing tokens only |
| **Active "bloom"** (primary wash + inset left bar) on the live step | D-02 | active card today = glow border only | new CSS |
| **Uniform resting essence** — every finished tool folds to ONE line, from step 1 | D-01/D-02 | focus-fold today triggers only at **3+ completed** (`ToolCallPanel.tsx:~410, 466–483`); not all tools fold | un-gate the fold so active = open / all finished = essence regardless of count |
| **Per-tool essence formatter** (`toolEssence(tool)` → calm `→ result` copy) | D-01 | partial — a generic summary row exists, but copy isn't standardized per tool | new formatter covering all 24 tools (literal strings in `095-SKETCH-GROUNDING.md §2`) |
| **Zero-duplicate sub-agent / read-summarize card** | D-05 | the sub-agent path (`StreamsProvider onSubAgentStart/Done ~491–514`) has **NO `clientKey` stamp** → dual-render with `tc.sub_agent ?? subAgent` (`ToolCallPanel.tsx:530`) | extend the `makeToolKey`/`clientKey` stamp to the sub-agent path — the core D-05 root fix |
| **One source of truth for the step count** (strip == cards on screen) | D-04 | two counters disagree: `RunCard` counts `iteration_start` (`:132–135`), panel counts `tool_start` (`deduplicatedToolCalls.length`) | unify both onto the action / tool-card count (the rail's numbering) |

### ↪ Explicitly out of this sketch (owned downstream)
- Status-strip **placement** + **Jump-to-live** + smart follow-scroll (D-03 / D-06 hardening) → **Sketch 015**.
- Output-file **hero/working split** + always-downloadable + the agent's final-output **tag** (D-07 / D-08, incl. the one contained backend touch) → **Sketch 016**.
