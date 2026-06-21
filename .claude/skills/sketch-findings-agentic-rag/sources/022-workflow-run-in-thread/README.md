---
sketch: 022
name: workflow-run-in-thread
question: >-
  When a workflow runs in a thread, can you chat — and how is the run made
  meaningful + consistent with the app's panel/tool surface? The panel owns the
  live meaningful phase spine; the chat carries a thin run receipt; the composer
  is the genuinely-undecided call (locked-in-thread vs chat-alongside vs a
  dedicated run view).
winner: "A"
tags: [workflow-run, mode-of-a-thread, panel-owns-the-spine, meaningful-steps, composer, ask_user, status-strip, run-honesty, parallel-threads, net-new-wire, phase-103]
---

# Sketch 022 — Workflow Run in Thread (re-architected)

> **Re-architected per `103-grounding/022-RUN-SURFACE-AUDIT.md`** (verdict: PARTIAL-ALIGN → now ALIGN). The audit found the original 022 drew the full 6-phase timeline INSIDE the chat (the app owns it in the right-side **workspace panel**) and FAKED meaningful-step data the wire doesn't carry. This rebuild moves the spine to the panel, makes the chat a thin receipt, and marks every fabricated field as NET-NEW wire surface.

## Design Question

A workflow is a **mode of a thread**, never page-resident — a run is a bounded **episode** inside a normal Deep chat. The thread is conversational *before* and *after* the run, and instrumented *during* it. Two questions were tangled in the original sketch; the rebuild separates them:

1. **Where does the meaningful run live, and how is it consistent with the app's surfaces?** → **Settled, not a fresh design call.** The **panel owns the live meaningful 6-phase spine** (mirrors the real `WorkspacePanel` "Workflow" section + the 008-D `PhaseTimeline`/`PhaseCard` vocabulary). The **chat carries a thin run receipt** (a mode badge + the 015-C never-vanishes status strip) that **resolves into the deliverable receipt** — never a second embedded timeline. This honors the shipped 009-C / 007-C seam and kills the dual-surface bounce sketch 004 warns against.
2. **Can you chat while it runs?** → **The real, genuinely-undecided call** — and now the sketch's thesis. Three honest composer answers over the *shared* meaningful run surface: **A locked-in-thread (★ winner)**, **B chat-alongside (documented)**, **C dedicated run view (rejected)**.

Concrete example (continuing 018–021): run the published **Vendor-risk portfolio review** workflow in a thread. The panel spine streams `⚙ Load the vendor portfolio → 🤖 Gather evidence → ⛓ Score each vendor → ✎ Draft the brief → ☺ Confirm escalations → ◆ Fill the committee template`; a risk-committee `llm_human_input` pause asks which vendors to escalate; then the cited `committee_brief.docx` lands in FILES and the thread returns to chat ("summarize the top 3 risks", "tweak → a new version"). Domain-agnostic — vendor risk is example content, not a baked-in vertical.

## What a MEANINGFUL step shows (the panel spine)

Each phase row is **calm at rest, comprehensive on the active step** — a 3-second read by default, depth only where the live moment needs it:

```
[●]  🤖 Gather evidence from the vendor KB           [NET-NEW]   ● Running   ← LINE 1: human TITLE (phase.name) + status atom
     Phase 2 of 6 · AI agent step · research                     ← LINE 2: ordinal + PHASE_TYPE_LABEL + (demoted) slug
     ● Searching Procurement KB for "Q3 breach thresholds"       ← LINE 3: RUNNING-phase-ONLY honest activity line
     ⛨ freshness ≤ 90d                                           ← GATE chip: only when a PhaseSpec.validator exists
```

- **LINE 1 (always):** the human phase **title** (`phase.name`) + the status atom (glyph + pill + color, never color alone — reuses `PhaseCard`'s six type labels/glyphs + statuses).
- **LINE 2 (always):** `Phase i of N · {PHASE_TYPE_LABEL}` with the slug demoted to mono secondary.
- **LINE 3 (RUNNING phase ONLY):** one honest activity line from real tool args — `Searching <folder> for "<query>"` / `Filling <template>.docx` / `<N> agents scoring vendors` / `Waiting for your answer`. Idle/done phases stay quiet — no activity line, no fabricated counts.
- **GATE chip:** only when the phase carries a `PhaseSpec.validator` (`freshness ≤90d`, `cited · structure`) — honest authored data, never a fabricated count.
- **Simplicity guard:** default row = title + type + status. Activity only on the running phase; gate chip only when a validator exists; sub-agent depth lives in a `Sub-results` expander (not inlined into the spine).

## Honesty — REAL-NOW vs NET-NEW wire

The sketch is an honest **target-state** with its deltas marked, never a fake. The panel's collapsible **Honesty** legend (and inline `NET-NEW` flags on the spine) draw the line:

| Field | Status | Note |
|---|---|---|
| phase `slug`, per-phase `status` | **REAL today** | already on the wire / DB |
| `phase_type` (live) | **REAL today** | carried on `phase_started` |
| `llm_human_input` ask pause | **REAL today** | the 006-C scoped pause |
| `PhaseSpec.validators` (gate chips) | **REAL today** | authored constraint, rendered as a chip |
| **`phase.name`** (human title) | **NET-NEW wire** | a natural Phase-103 NL-authoring output; `PhaseSpec → workflow_phases → WorkflowPhaseState → Phase` |
| **persisted `phase_type`** | **NET-NEW wire** | land it durably so a reload doesn't collapse every row to "Step" |
| **running-phase activity line** | **NET-NEW wire** | relaxes D-03 for the ACTIVE phase only (operator-approved); built from REAL `tool_call` args / `sub_agent_start.description` |

**Plus 3 sketch-independent bug/wire fixes** that make the *current* surface meaningful with **no new UI**: `BUG-260609-04` (phase-0 reconcile overwrite — real slug clobbered by `phase-${i}`), `BUG-260609-02` (Sub-task description loss on nav — reconcile `tasksByThread` durably), `BUG-260610-01` (dup-avatar / timer-reset — separate render-only workstream, seed the timer from the run row's `started_at`).

## How to View

Open `index.html` in a browser (it links `../themes/default.css`). The **panel owns the meaningful spine for all three variants** — the variant tabs change **only the composer-during-a-run behavior** (lifecycle stages 2–4). Switch the three composer answers with the **variant tabs** (top). Step the run with the **lifecycle cycler** in the toolbar (1 Before → 2 Launch → 3 Running → 4 Pause → 5 Resolve → 6 After), and flip the **resolve-as** toggle (✓ completed / ✕ failed-honestly / ⏹ cancelled). `⌘.` / `Ctrl+.` collapses the panel to its 52px rail (the count badge keeps the live phase visible). At the pause, click an option / Proceed-Abort / type a scoped answer to resume.

## Variants (composer-during-a-run only)

- **A · Locked-in-thread ★ Selected** *(operator-decided winner)* — during the run the composer locks to a live status chip (⏱ phase X/N + activity) + Cancel; the **only** mid-run input is the scoped `ask_user`/`llm_human_input` pause reply (006-C dual-surface); on resolve it unlocks to normal Deep chat (follow-ups, tweak → new version, re-run). A "you're not blocked — open another thread" escape-hatch hint (+ a second-thread dot on the nav rail) makes clear the run owns *this* composer, not *you*.
- **B · Chat-alongside** *(documented alternative)* — the composer stays **live** next to the stream for free chat, **with the honest tangle / silent-send-drop caveat** surfaced right in the composer (two streams writing one thread = the documented parallel-stream race).
- **C · Dedicated run view (rejected)** *(REJECTED exploration)* — the workflow executes on a separate full-screen, CI-style surface; kept and clearly marked REJECTED with its trade-off card: it **hides the panel**, **loses conversational follow-up**, **duplicates the run/stream/lock/resume plumbing**, and re-creates the **dual-surface bounce** sketch 004 warns against.

## What to Look For

- **The panel is the single home for the live spine.** The 6-phase timeline + each step's meaning lives in the workspace panel for every variant; the chat never re-draws it.
- **The chat receipt is thin and resolves.** A mode badge + the never-vanishes 015-C status strip points at the panel while live, then resolves into the deliverable (or the honest failure / cancel) receipt — a 3-second read, no embedded 6-row timeline.
- **Meaning is honest.** Title (NET-NEW) + type·ordinal + a RUNNING-phase-only activity line + a gate chip only when a validator exists. Done/idle phases stay quiet. Every fabricated field is flagged `NET-NEW`.
- **The composer is the answer.** A locks (chip + Cancel, scoped-only reply at the pause, parallel-thread escape hatch); B stays live (with the caveat); C removes the composer from the run entirely and pays for it.
- **Run honesty.** The resolve toggle proves the three-way terminal: completed → cited `.docx`; failed-honestly → no deliverable + verbatim gate reason (RC-4); cancelled → neutral, no deliverable.

## Build Handover — reuse vs net-new

Each 022 element maps to a real component (reuse, don't re-skin) or a flagged net-new bit. The build phase inherits this contract.

### Reuse (bind to these, do not re-implement)

| 022 element | Real component / surface | Notes |
|---|---|---|
| Thin chat run receipt + live pointer | `RunStatusStrip` (015-C never-vanishes strip) + the 007-C `SeamPointer`/`SeamCard` | strip rides the receipt header; resolves to the deliverable card. Elapsed from a stable start-ts; freezes only on a true terminal. |
| Panel "Workflow" spine | `PhaseTimeline` (`<ol>` of `PhaseCard`) mounted in `WorkspacePanel`, gated on `isHarness` | the 008-D cards-on-a-status-colored-spine; node stations mask the connector. |
| Per-phase row (title / type / status / gate / sub-results) | `PhaseCard` (`PHASE_TYPE_LABEL` glyphs+labels, 6 statuses, fan-out child rows) | reuse byte-for-byte; add the title line + activity line (net-new, below). |
| The scoped pause | `PendingAskCard` / `PendingAskStack` (006-C) + `_exec_llm_human_input` executor | pinned in the panel; the composer narrows to the scoped reply (A) — no new pause surface. |
| Shell geometry (rail / chat / clamped panel) | `ChatLayout` grid + `WorkspacePanel` (push/split, collapse-to-rail w/ pending dot, mobile bottom-sheet) | grid width animates on `ChatLayout`, not the panel. |
| Locked composer = status chip + Cancel | the 011-A composer + `active_workflow_run_id` server truth | mode is a server fact, never a client `workflowMode` useState. |
| Files / deliverable drill-in | `FilesSection` / `OutputFileCard` (005-A / 016-A) | the cited `.docx` lands in the panel FILES section. |

### Net-new wire surface (flag honestly; load-bearing for "meaningful")

- **`phase.name`** — the human title threaded `PhaseSpec → workflow_phases → WorkflowPhaseState → Phase` TS type, emitted on `phase_started`. The single change that makes every "meaningful step" real.
- **persisted `phase_type`** — add it to the durable `WorkflowPhaseState` (`{slug, phase_index, status}` today) and stop hardcoding `phaseType:"unknown"` in `reconcilePhases`, so reload doesn't collapse to "Step".
- **the running-phase activity line** — un-suppress a single curated `verb + object` for the **active phase only** (relaxes D-03), sourced from live `tool_call` args / `sub_agent_start.description`. No fabricated counts on idle/done phases.

### Routed bug/wire fixes (do these as wire fixes, NOT inside the sketch)

- **`BUG-260609-04`** — use real `wf.phases` slugs for the LIVE skeleton (not just terminal); refuse to overwrite a real slug with `phase-${i}` (`StreamsProvider.tsx` `reconcilePhases`).
- **`BUG-260609-02`** — reconcile `tasksByThread` from a durable source so the sub-agent description survives nav (`BatchResultList.cleanDescription`).
- **`BUG-260610-01`** — keep dup-avatar / timer-reset a SEPARATE render-only workstream; seed the timer from the run row's `started_at`.

## Origin

Re-architected from the original sketch 022 per the audit. Preserves the variant-tab scaffold, the lifecycle-state cycler, and the sketch toolbar; rewrites the run surface so the **panel owns the meaningful spine** and the **chat carries a thin receipt**. Reuses the 008-D phase timeline, the 015-C status strip, the 006-C ask_user dual-surface pause, the 011-A locked composer, and the 009-C / 007-C chat↔panel seam — workflows compose the shipped harness; Deep stays byte-identical.
