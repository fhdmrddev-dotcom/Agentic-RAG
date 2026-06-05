# Sketch Wrap-Up Summary

**Date:** 2026-05-24
**Sketches processed:** 3 (all included)
**Design areas:** Live-Run Container, Tool-Call Panel
**Skill output:** `./.claude/skills/sketch-findings-agentic-rag/`

## Included Sketches

| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | stream-framing | C — Run-Card | Live-Run Container |
| 002 | tool-call-panel | C — Editor Inset | Tool-Call Panel |
| 003 | thinking-moment | B — Focus Mode | Live-Run Container |

## Excluded Sketches

_None — all three sketches included._

## Design Direction

**Calm instrument with selective signal-density at the live moment.** Aether Deep Midnight palette mirrored from the live `frontend/src/index.css :.dark` so sketches look and feel like the real product. Restrained motion (brand-pulse on the working avatar, progress shimmer on the active run, status pills that fade in/out). The chrome stays out of the way until it has something to say — then it speaks clearly.

**Reference points:** Claude.ai analysis tool · Cursor/Windsurf agent mode · Linear status & motion · Raycast command surfaces.

**Acceptance bar:** the long execution in progress moment — 30+ seconds into a multi-tool run.

## Key Decisions

1. **Live run = bracketed Run-Card** in conversation flow (not inline-folded, not in a dedicated rail). Pinned header carries timer + tool counter + bot avatar. Progress shimmer while active. Folds to one-line summary when done.

2. **Tool call = editor inset.** `execute_code` is a real editor pane (line gutter, syntax highlight, lang chip). STDOUT/STDERR in labeled regions. File outputs lift out as inline preview cards. Different tool types get their own inner content shape inside the same outer frame.

3. **Focus Mode under stress.** During a long run: past tool calls auto-collapse to compact rows showing their result-summary (`→ yoy_q3 = 30.87%`), only the active step keeps its full editor open, explicit "Next: ..." footer surfaces what's queued. Past work shrinks to essence, present work gets full attention.

4. **Motion language preserved** from the existing frontend: `fadeSlideUp`, `brandPulse`, `progressShimmer`, `dotBounce`, `toolSlideIn`, `checkPop`. Sketches use the same animation tokens the real app uses.

5. **Narration interleaves with tool calls** inside the run-card body, not outside it. Italic, dim — supporting the structured execution rather than competing with it. The *final assistant message* (the answer the user reads) lives outside the run-card in its own row — the run-card is the work, the message is the answer.

6. **Thinking blocks** are compact and dim by default — single `💭 Thought · ... · 2.1s` row; click to expand into the full reasoning text.

## Open Questions Routed Forward

- **Cross-thread "live somewhere else"** — Thread A streaming while user navigates to Thread B was explicitly out of scope. Sidebar pulse hints at it, but the full pattern needs a dedicated sketch before any plan touches `StreamsProvider.tsx`.
- **Provider-specific edge cases** — Gemini thought_signature, Anthropic 22-iteration loops, OpenRouter dup output. Focus Mode + pinned timer should make these visually obvious, but a stress-test sketch with a deliberately-borked run would confirm.
- **Mobile / narrow viewport** — sketches built at desktop scale (~780px content column). Run-card with editor inset needs a narrow-viewport pass before plan.
- **Per-tool inner shapes** — pattern is "outer Editor-Inset frame + per-tool inner content," but each new tool now needs an inner-body component design decision, not just a string template.

## Skill Output

The validated decisions are packaged at `./.claude/skills/sketch-findings-agentic-rag/` with two reference files (`live-run-container.md`, `tool-call-panel.md`), the winning theme file, and all three sketches' source HTML preserved. The skill auto-loads when any chat-surface component is being built or refactored.

---

# Session 2 — Workspace Panel (Phase 087)

**Date:** 2026-05-29
**Sketches processed:** 4 (004–007 — all included)
**Design areas:** Panel Shell & Navigation · File Browser & Diff Viewer · Pending Question (ask_user) · Chat ↔ Panel Seam
**Skill output:** appended to `./.claude/skills/sketch-findings-agentic-rag/` (now 6 reference files across both design areas)

## Included Sketches

| # | Name | Winner | Design Area / Reference |
|---|------|--------|-------------------------|
| 004 | panel-shell | B — Stacked accordion | Panel Shell & Navigation → `references/panel-shell.md` |
| 005 | file-and-diff | A — Full-replace drill-in + in-column unified diff (C folded in) | File Browser & Diff Viewer → `references/file-browser-and-diff.md` |
| 006 | pending-question | C — Dual-surface (calm pin + chat cue) | Pending Question → `references/pending-question.md` |
| 007 | chat-panel-seam | C — Live-pointer / reload-resolved | Chat ↔ Panel Seam → `references/chat-panel-seam.md` |

## Excluded Sketches

_None — all four panel sketches included in full._

## Design Direction

**Calm instrument, extended to a second column.** The workspace panel makes the agent's work visible and interactive without breaking the restraint of the live-execution surface. It pushes/splits the chat rather than overlaying it; it stays quiet and empty in the common case; it gets structurally loud only when the agent is actually blocked on the human. Same Aether Deep Midnight tokens, same motion vocabulary, same color language (amber = needs-you/paused, green = done/answered/added, red = removed/base, primary = live/pointer).

## Key Decisions

1. **Panel shell = push/split, stacked accordion.** Three-column CSS grid (`52px` nav · `1fr` chat · `30%` panel), animated; never an overlay. Four collapsible sections (Todos · Files · Pending-Q · Versions) in one scroll; pending `ask_user` pins sticky at top. Empty panel short-circuits to one calm state (no empty-section tax). Collapse → rail with count badges, or fully away; mobile (<768px) → bottom-sheet. Toggle `⌘.`/`Ctrl+.`. *(Sketch 004 winner B)*

2. **Files & diff = full-replace drill-in + in-column unified diff.** Tap a file → full-height preview (reuse MarkdownRenderer + syntax highlight; mandatory graceful too-large/no-preview fallback); `‹ Files` back. Versions → in-column unified `+/−` diff; opt-in `⤢` wide overlay for gnarly diffs, never auto-widen. Red-base / green-target version picker. *(Sketch 005 winner A, C folded in)*

3. **ask_user = dual-surface, calm-loud.** Calm pinned card in the panel (choice chips + always-present free-text) + a pointer cue in the chat run-card. The block is made unmissable structurally — paused amber run-card, locked composer, pulsing toggle dot — not by hijacking the screen. Submit resumes in place; graceful timeout, never a silent hang. *(Sketch 006 winner C)*

4. **Chat↔panel seam = panel-now / chat-happened.** Panel reconciles to current state on reload (no history replay); chat is the durable record. Live → quiet one-line pointers for the 3 panel-owned tools; reload → transcript resolves to self-contained cards — **answered Q&A renders, closing the documented `ask_user` reload gap** — files→chips, todos→final note. Single source of truth. *(Sketch 007 winner C)*

## Downstream

These findings are the design substrate for **Phase 087 (Panel UI)** — the G-2 sketch acceptance bar is met. Next on the 087 path: `/gsd:ui-phase 087` (turns these into the UI-SPEC design contract), then `/gsd:discuss-phase 087`, then `/gsd:plan-phase 087`. The skill now auto-loads during build for panel and chat-surface work.

---

# Session 3 — Workflow Legibility & Mode Clarity (Phase 094)

**Date:** 2026-06-04
**Sketches processed:** 6 (008–013 — all included)
**Design areas:** Harness Phase Timeline · Unified Execution Surface & Run Seam · Run Honesty · Composer & Mode Clarity · Workflows Page · Workflow Builder (v2.9 design-ahead)
**Skill output:** appended to `./.claude/skills/sketch-findings-agentic-rag/` (now 12 reference files across three sessions)

## Included Sketches

| # | Name | Winner | Design Area / Reference |
|---|------|--------|-------------------------|
| 008 | phase-timeline | D — RunCards on a spine | Harness Phase Timeline → `references/harness-phase-timeline.md` |
| 009 | unified-surface | C — Live-status → resolves | Unified Execution Surface & Run Seam → `references/unified-execution-surface.md` |
| 010 | honesty-and-drafts | C — Pin-while-active → fold (+ long-draft wide overlay) | Run Honesty → `references/run-honesty.md` |
| 011 | mode-and-composer | A — Status chip + Cancel | Composer & Mode Clarity → `references/composer-and-mode.md` |
| 012 | workflows-page | A — Card grid | Workflows Page → `references/workflows-page.md` |
| 013 | workflow-builder | A — Talk-led | Workflow Builder (v2.9 design-ahead) → `references/workflow-builder.md` |

## Excluded Sketches

_None — all six workflow-legibility sketches included in full._

## Grounding

Unlike the first two sessions, this batch was authored against a real-evidence brief: `094-grounding/BRIEF.md` (the harness SSE event stream, the "wire-only / dropped by `api.ts`" analysis, competitive viz patterns, WCAG 2.1 AA) and `094-grounding/DATA-CONTRACT.md` (the event/wire data contract + the real-vs-invented field boundary). Both are preserved in the skill at `sources/094-grounding/` so the build phase wires real event names and real fields, not guesses. The synthesis was adversarially verified against the source mockups — three claims that drifted from ground truth (a fabricated mockup handler, a missing CSS rule, and one "zero backend change" over-promise that contradicted the DATA-CONTRACT) were caught and corrected.

## Design Direction

**Calm instrument, now driving a locked pipeline — made legible.** The v2.8 harness runs ordered multi-phase workflows, but today the chat shows a spinner then a wall of answer because every harness lifecycle event is dropped by `api.ts`. This session makes the run honest and the mode unambiguous, on the same restraint: one panel hosts BOTH Deep and Harness (the panel becomes the single live-execution surface — deliberately reversing sketch-001), the chat quiets to prompt + answer + a pointer, failures/drafts/batch-results all surface truthfully, and the Deep/Harness toggle leaves the composer for a first-class Workflows page so the mode can never mislabel. Same Deep Midnight tokens; color language extended (amber = active/needs-you/paused, green = done, red = failed, purple = retrying, primary = live pointer).

## Key Decisions

1. **Harness run = RunCards on a status-filled spine.** Each phase is a reusable RunCard threaded onto a vertical spine that fills green→done, amber=active, dashed-dim=locked-ahead, red=failed, purple=retrying — so the locked, escape-proof pipeline is *felt*. 5 real states, each glyph+pill+color (never color alone, WCAG). Failed-as-failed off `run_failed`/`gate_failed` (RC-4), never the terminal sentinel (wrongly `done` on failure). Sub-agent fan-out renders as real child rows (kills today's ghost avatars). *(Sketch 008 winner D)*

2. **One execution surface, two drivers (D-094-UNIFY).** The workspace panel is the single live surface for BOTH Deep AND Harness — Deep's loop moves out of the chat into the panel (reversing 001). Chat keeps prompt + final answer + one quiet seam element: a live pointer while running, resolving to a compact receipt card below the answer. `phasesByThread` stays panel-only (PANEL-06) so panel events never re-render chat. *(Sketch 009 winner C)*

3. **Honest by construction.** Attention-moments are loud while they need you (pinned amber=draft / red=failure), then fold into the timeline as a record. Failures carry a reason + closed taxonomy (max_steps / gate_failed / wall_clock_timeout / `reason_unknown` fallback). The draft you're asked to review is visible and labeled "not yet saved". Batch sub-results are readable before merge; the answer gets a provenance card. Large content = panel preview + opt-in `⤢` wide overlay, never crammed, never a fake percent. *(Sketch 010 winner C)*

4. **Composer simplifies; mode = server truth.** Resting composer collapses to 2 pills (`[Model ▾]` with Provider folded in, `[General/Explorer ▾]`). The Deep/Harness toggle + workflow picker leave the composer entirely — finding #5 (toggle stuck on "Deep" mid-run) is killed by construction (no pill to mislabel). A running workflow shows as a slim amber status chip + Cancel above a disabled composer; Cancel stays where the cursor is. *(Sketch 011 winner A)*

5. **Workflows get a first-class page; execution stays a thread mode.** A nav page (browse + launch only) renders existing `workflow_definitions` via `GET /workflows/published`; the card grid shows each workflow's locked phase chain inline. Run → new thread + `active_workflow_run_id` + redirect-into-thread, where the run streams using 008-D/009-C/011-A. Workflows are never page-resident — execution always lives in a thread (reusing run/stream/lock/resume). *(Sketch 012 winner A)*

6. **NL authoring is talk-led, read-mostly, locked-on-publish.** You describe a recurring task (and upload a template); the AI drafts a read-mostly, live-streaming phase-card diagram from the 5 real phase types — no drag-canvas. Refine by talking; lint gates publish; publish freezes an immutable, versioned definition (migration 056), edits fork a draft. Per-phase optional KB scope via a searchable folder-tree picker. **Design-ahead — build v2.9 (SEED-051).** *(Sketch 013 winner A)*

## Downstream

These findings are the design substrate for **Phase 094 (Workflow Legibility + Mode Clarity)**. Build-now: 008-D · 009-C · 010-C · 011-A · 012-A — these mostly render harness lifecycle events already on the wire plus a published-workflows list endpoint (low/no new backend; the few net-new bindings, e.g. `folder_ids` on a phase config, are flagged honestly in the references). Design-ahead: 013 (NL builder, v2.9, SEED-051 spike-first). The G-2 sketch acceptance bar is met; next on the 094 path is the UI design contract / discuss-phase. The skill auto-loads during build for harness/workflow-run, composer, and chat-surface work.

---

# Session 4 — Chat Tool-Card Unification (Phase 095)

**Date:** 2026-06-05
**Sketches processed:** 3 (014–016 — all included)
**Design areas:** Chat Tool-Card Unification (one combined area: unified frame · status strip + scroll · output files)
**Skill output:** appended to `./.claude/skills/sketch-findings-agentic-rag/` (now 13 reference files across four sessions; new: `references/chat-tool-card-unification.md`)

## Included Sketches

| # | Name | Winner | Design Area / Reference |
|---|------|--------|-------------------------|
| 014 | unified-card-frame | Synthesis — rail + status nodes + active bloom | Chat Tool-Card Unification → `references/chat-tool-card-unification.md` |
| 015 | status-strip-and-scroll | C — Hybrid (header strip + bottom Jump-to-live chip) | (same reference) |
| 016 | output-files-hero | A — Hero block + working group; per-extension SVG icons | (same reference) |

## Excluded Sketches

_None — all three included; packaged as ONE design area (they are one component set, not three)._

## Grounding

Authored against `095-SKETCH-GROUNDING.md` (real Deep SSE event vocabulary, the 24-tool set with literal resting-essence strings, the current-render "before", the three bug clusters + root mechanisms) — preserved in the skill at `sources/095-grounding/GROUNDING.md`. After all three were built, an independent cross-sketch audit (`095-SKETCH-CONSISTENCY.md`, also preserved) caught that the standalone HTML files had drifted into 13 near-duplicate copies of the same primitives; that audit became the **build-once component inventory** that the reference file leads with.

## Design Direction

**Calm instrument, the Deep tool-cards fixed-and-unified in place.** 094 D-01 kept Deep's cards in the chat (not the panel); 095 makes them one consistent calm frame: a borderless step-numbered status-node rail (the locked sequence *felt* without per-card borders), finished steps fold to a muted one-line essence, the active step blooms, every card click-expands to its detail. A run-status strip that NEVER vanishes (stable-start-ts, freezes only on a true terminal) lives in a hybrid header/floating placement with follow-but-release scroll. Output files hero the deliverable, keep intermediates present-but-quiet, and always download — with proper per-extension SVG file icons. Same Aether Deep Midnight tokens; same motion vocabulary.

## Key Decisions

1. **Unified frame = borderless status-node rail + active bloom (014 Synthesis).** Rail nodes fill green→done / pulsing-primary→active / dim→queued; one-line essence at rest (muted), active blooms (primary wash + left bar), click-to-expand details (D-01). Row-numbering makes the honest step count (D-04) and zero-duplicate (D-05) **structural**.
2. **Honest run-status strip + follow-but-release scroll (015 Hybrid).** `⏱·Step·activity` derived from a stable start-ts, rendered continuously, frozen only on a true terminal (closes the Kimi/Moonshot vanish bug — a *timer-derivation* fix, not a placement choice). Header strip while in view + bottom Jump-to-live chip on scroll-away; follow the live edge, release on scroll-up, re-arm at bottom (D-03/D-06).
3. **Output files hero/working + always-downloadable (016 Hero block).** "★ Your file" hero (agent-flagged) + visible-but-quiet working group; every link downloads even on a chat reopened tomorrow (re-sign on demand; investigate the dead-link root first — D-07/D-08).
4. **Per-extension SVG file icons.** Document + folded corner + type glyph + colored extension ribbon (Untitled-UI / "40 file type" style). One shared `fileIcon()` across all three.
5. **The governing build rule.** These three are ONE component set. Build the inventory once (`RunFrame` · `StepRail/StepRow` · `ToolEssenceLine` · one `ToolBody` · one `RunStatusStrip` · one `fileIcon` · one `OutputFileCard` · `SubAgentEssence` · `unifiedStepCount()` · `useFollowScroll`). `unifiedStepCount()` (feeds rail # + strip "Step N" + collapsed "N steps") IS the embodied D-04/D-05 fix. Forbid re-forking `.file-out` / `detailHTML` / a 2nd status-strip.

## Downstream

The design substrate for **Phase 095 (Chat Tool-Card Unification)**. Each sketch README carries a reuse-vs-net-new Build Handover; `references/chat-tool-card-unification.md` consolidates the decisions + the build-once inventory. G-2 acceptance bar met; next on the 095 path is `/gsd:plan-phase 095` (or `/gsd:ui-phase 095` for a UI-SPEC). The skill auto-loads during build for the chat tool-card frame, the run-status strip, scroll, and the output-files area.
