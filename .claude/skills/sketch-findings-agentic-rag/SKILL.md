---
name: sketch-findings-agentic-rag
description: Validated design decisions, CSS patterns, and visual direction for the agent's live-execution UX, the right-side workspace panel, the Phase 094 workflow-mode surfaces, AND the Phase 095 chat tool-card unification (run-card frame + tool-call panel + long-run composition; panel shell, file/diff viewer, ask_user interrupt, chat↔panel seam; harness phase timeline, unified Deep/Harness execution surface, run honesty, 2-pill composer + mode clarity, Workflows page, NL workflow builder; the unified Deep tool-card frame with a status-node rail, the never-vanishes run-status strip + follow-but-release scroll, the output-files hero/working split + per-extension file icons). Auto-loaded during UI implementation on the Agentic RAG project. Use when building or refactoring ToolCallPanel, RunCard, StreamsProvider, MessageItem, MessageList, OutputFileCard, useMessages, the workspace panel, the harness/workflow run UI, the composer, or any chat-surface component that touches the agent's mid-execution moment.
---

<context>
## Project: Agentic RAG

**Design direction:** Calm instrument with selective signal-density at the live moment. Aether Deep Midnight palette (mirrored from `frontend/src/index.css :.dark`). Restrained motion (brand-pulse on the working avatar, progress shimmer on the active run, status pills that fade in/out). The chrome stays out of the way until it has something to say — then it speaks clearly.

**Reference points** (north stars during ideation):
- **Claude.ai analysis tool** — inline tool-result-in-conversation pattern
- **Cursor / Windsurf agent mode** — multi-step agent loop with collapsible tool calls
- **Linear** — calm-but-expressive motion language
- **Raycast** — instrument feel; monospace touches, dense-but-quiet

**Acceptance bar:** the **long execution in progress** moment — 30+ seconds into a multi-tool run. Can the user instantly read what the agent did, what it's doing, and trust it's still on track? This directly addresses the documented lived-experience UAT-gap pattern (regressions hiding in slow streams).

**Sketch sessions wrapped:** 2026-05-24 (live-execution UX — sketches 001–003), 2026-05-29 (workspace panel — sketches 004–007), 2026-06-04 (workflow legibility + mode clarity — sketches 008–013, Phase 094), 2026-06-05 (chat tool-card unification — sketches 014–016, Phase 095)
</context>

<design_direction>
## Overall Direction

- **Palette:** Aether Deep Midnight — every token (`--color-bg`, `--color-surface`, `--color-primary`, etc.) mirrors the live `frontend/src/index.css :.dark` values. See `sources/themes/default.css`.
- **Typography:** Inter (body), Manrope (headlines), JetBrains Mono (code + status + identifiers).
- **Spacing:** 4px grid (`--space-1` through `--space-16`).
- **Shapes:** softer radii — `--radius-md: 10px` (matches app), `--radius-lg: 14px` for outer run-cards.
- **Motion:** purposeful — `brandPulse` (1.5s) on active bot avatar, `progressShimmer` (1.8s) on active run, `dotBounce` (1.4s) on status pills, `fadeSlideUp` (0.3s) on new content. No decorative spin.
- **Layout approach:** single-column conversation, no dedicated execution rail. Live runs occupy explicit bracketed Run-Card containers in the conversation flow.
- **Interaction patterns:** sticky run-card header, Focus Mode (past steps fold to result-summary, active step gets full editor), click-to-expand by default, explicit `Next: ...` footer, fold-to-summary on completion.

## Tool-Call Architecture

`execute_code` renders as a real editor pane (line gutter, syntax highlighting, lang chip) with labeled STDOUT/STDERR regions and file outputs as inline preview cards. Different tool types (`search_documents`, `read_file`, etc.) get their own inner content shape inside the **same outer frame**. The outer container is one component; the inner body is selected by tool name.

## Workspace Panel (Phase 087)

The right-side workspace panel makes the agent's work **visible and interactive** without breaking the calm-instrument promise:

- **Push/split, never overlay.** A three-column CSS grid (`52px` nav · `1fr` chat · `30%` panel) shrinks the chat; the panel never floats over the conversation. Collapse animates the column to a thin rail (with count badges) or fully away. Mobile (<768px) = bottom-sheet. Toggle: header button + `⌘.`/`Ctrl+.`.
- **Stacked-accordion sections.** Four collapsible areas in one scroll — Todos · Files · Pending question · Versions — with a pending `ask_user` pinned at the very top. Empty (the common case) short-circuits to one calm empty state, never four empty headers.
- **Panel = now, chat = happened.** The single mental model that governs the seam: the panel reconciles to current state on reload (no history replay); the chat is the durable record. Panel-owned tools (`write_todos`/`workspace_write`/`ask_user`) render as quiet pointers in chat while live, and resolve to self-contained cards on reload.
- **Calm-loud interrupts.** `ask_user` blocks the whole agent loop, so the block is made unmissable *structurally* (paused amber run-card + locked composer + pulsing toggle dot) rather than by hijacking the screen.
- **Color language carries forward:** amber = needs-you / paused, green = done / answered / diff-added, red = diff-removed / base-version, primary = live / pointer. Same Aether Deep Midnight tokens throughout.

## Workflow Mode & Harness Legibility (Phase 094)

The v2.8 harness engine made the agent run *locked, ordered, multi-phase* workflows — but the chat showed only "Setting up agent…" → a pulse → the full answer, because every harness lifecycle event (`phase_started`/`phase_completed`/`phase_transition`/`gate_failed`/`run_completed`/`run_failed`) is emitted on the wire and **dropped by `api.ts`**. Phase 094 makes the run **legible** and the mode **unambiguous**, on the calm-instrument terms already established:

- **One execution surface, two drivers (D-094-UNIFY).** The workspace panel hosts BOTH a Harness phase-run AND a Deep tool-run — deliberately reversing sketch-001 (Deep's loop moves *out* of the chat into the panel). The chat keeps only prompt + final answer + one quiet seam element. The panel timeline is RunCards threaded on a status-colored **spine** so you *feel* the locked, escape-proof pipeline.
- **5 real states, color as reinforcement.** complete · running · locked-ahead · failed · retrying — each a glyph + pill + color, never color alone (WCAG). The lock is legible (dashed, dimmed, non-interactive).
- **Honest by construction.** Failures render failed-with-a-reason (closed taxonomy + `reason_unknown` fallback), never an empty "done" card (RC-4 — today's terminal sentinel is wrongly `done` on failure). The draft you're asked to review is visible and labeled "not yet saved". Batch sub-results are readable before merge. Big content previews in the panel and opens wide on demand — never crammed, never a fake percent.
- **Mode = server truth.** The Deep/Harness toggle and workflow picker leave the composer entirely (resting state = 2 pills `[Model ▾][General/Explorer ▾]`, Provider folded into Model); you launch from a first-class **Workflows page**, which puts the thread into Harness. The misleading client-held "Deep" label (finding #5) is killed by construction — no pill exists to mislabel; a running workflow shows as a slim amber status chip + Cancel above a disabled composer.
- **Authoring is talk-led (v2.9 design-ahead).** You build a workflow by *describing* it; the AI drafts a read-mostly, live-streaming phase-card diagram from the 5 real phase types — no drag-canvas. Publish locks an immutable, versioned definition (SEED-051).

Color language extends the existing vocabulary: amber = active / needs-you / paused, green = done, red = failed, purple = retrying, primary = live pointer.

## Chat Tool-Card Unification (Phase 095)

094 D-01 kept Deep's tool-cards **in the chat** (not moved to the panel); 095 fixes-and-unifies them *in place*, refining the 001-C/002-C/003-B language. Three concerns, **one component set** (see `references/chat-tool-card-unification.md` + `sources/095-grounding/CONSISTENCY.md`):

- **Unified frame = a borderless, step-numbered status-node rail.** Nodes fill green→done / pulsing-primary-ring→active / dim→queued so the sequence is *felt* without per-card borders; finished steps fold to a one-line essence (`# icon · tool → result`, muted), the active step blooms (primary wash + left bar). Every finished card is **click-to-expand** to its full per-tool body (details re-ranked, never hidden — D-01). Row numbering makes the honest step count (D-04) and the zero-duplicate invariant (D-05) **structural**, not cosmetic.
- **Honest run-status strip + follow-but-release scroll.** `⏱ elapsed · Step N · activity` that **never vanishes** — elapsed derives from a **stable start-ts**, renders continuously (immune to dropped SSE / tab throttling / temp-id remounts), and freezes only on a TRUE terminal (closes the Kimi/Moonshot vanish bug; the never-vanishes fix is a *timer-derivation code change*, not a placement choice). Placement is **hybrid**: header strip while in view + a bottom chip with "↓ Jump to live" on scroll-away. Scroll follows the live edge, releases on scroll-up, re-arms at bottom.
- **Output files = hero the deliverable, keep working files quiet, always-downloadable.** A big "★ Your file" hero (the agent-flagged final output) + a visible-but-quiet "Working files (N)" group. Every link downloads in one click, even on a chat reopened tomorrow (re-sign on demand; investigate the dead-link root first). The agent flags the hero via a small backend tag on `final_output_files` (D-08). **Per-extension SVG file icons** (document + folded corner + type glyph + colored extension ribbon, Untitled-UI style).
- **The governing rule:** build the shared inventory ONCE — `RunFrame` · `StepRail/StepRow` · `ToolEssenceLine` · one `ToolBody` · one `RunStatusStrip` (two placement wrappers) · one `fileIcon` · one `OutputFileCard` · `SubAgentEssence` · `unifiedStepCount()` · `useFollowScroll`. `unifiedStepCount()` (one derivation feeding rail # + strip "Step N" + collapsed "N steps") IS the embodied D-04/D-05 honesty fix. Forbid re-forking `.file-out` / `detailHTML` / a second status-strip.
</design_direction>

<findings_index>
## Design Areas

**Live-execution UX (sketches 001–003):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Live-Run Container | [references/live-run-container.md](references/live-run-container.md) | Bracketed Run-Card in conversation flow, sticky header (timer + counter), Focus Mode collapses past steps to result-summary, explicit Next-up footer, folds to one-line summary on completion |
| Tool-Call Panel | [references/tool-call-panel.md](references/tool-call-panel.md) | Editor-inset shape for `execute_code` (gutter + syntax + lang chip), labeled STDOUT/STDERR regions, file outputs lift to preview cards, **different inner shapes per tool inside the same outer frame** |

**Workspace panel UX (sketches 004–007, Phase 087):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Panel Shell & Navigation | [references/panel-shell.md](references/panel-shell.md) | Push/split three-column grid (no overlay), stacked-accordion sections, collapse-to-rail with count badges, empty-state short-circuit, mobile bottom-sheet, `⌘.` toggle |
| File Browser & Diff Viewer | [references/file-browser-and-diff.md](references/file-browser-and-diff.md) | Full-replace drill-in preview (reuse MarkdownRenderer + syntax highlight + graceful fallback), in-column unified `+/−` diff, opt-in `⤢` wide overlay (never auto-widen), red-base/green-target version picker |
| Pending Question (ask_user) | [references/pending-question.md](references/pending-question.md) | Dual-surface (calm pinned panel card + chat pointer cue), structural loudness (paused amber run-card + locked composer + toggle dot), always-present free-text, resume-in-place, graceful timeout |
| Chat ↔ Panel Seam | [references/chat-panel-seam.md](references/chat-panel-seam.md) | Panel=now / chat=happened; live quiet-pointers for the 3 panel-owned tools, reload-resolved self-contained cards (closes the `ask_user` reload gap), single source of truth |

**Workflow mode & harness legibility (sketches 008–013, Phase 094):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Harness Phase Timeline | [references/harness-phase-timeline.md](references/harness-phase-timeline.md) | RunCards threaded on a status-filled vertical spine (green→done, amber=active, dashed=locked-ahead, red=failed, purple=retrying); 5 real states carry glyph+pill+color (a11y, never color alone); failed-as-failed off `run_failed`/`gate_failed` (RC-4); fan-out sub-agents as real child rows; renders the harness lifecycle events `api.ts` drops today |
| Unified Execution Surface & Seam | [references/unified-execution-surface.md](references/unified-execution-surface.md) | D-094-UNIFY: one panel hosts BOTH Deep and Harness (reverses 001's in-chat run-card); chat keeps prompt + answer + one quiet seam element (live pointer → resolved receipt card below the answer); PANEL-06 keeps `phasesByThread` panel-only so panel events never re-render chat |
| Run Honesty | [references/run-honesty.md](references/run-honesty.md) | Pin-while-active→fold lifecycle; failures render with a reason + closed taxonomy (max_steps/gate_failed/wall_clock_timeout/`reason_unknown` fallback) — never an empty done card; visible draft labeled "not yet saved"; batch sub-results readable before merge; provenance answer card; long content = preview + opt-in `⤢` wide overlay |
| Composer & Mode Clarity | [references/composer-and-mode.md](references/composer-and-mode.md) | Mode = server truth (`active_workflow_run_id`), never a composer pill → finding-#5 killed by construction; resting composer = 2 pills (Model w/ folded Provider + General/Explorer); launch leaves the composer; running workflow = slim amber status chip + Cancel above a disabled composer (winner A) |
| Workflows Page | [references/workflows-page.md](references/workflows-page.md) | First-class nav page (browse + launch only) from `GET /workflows/published`; card grid shows each workflow's locked phase chain inline; Run → new thread + `active_workflow_run_id` + redirect-into-thread (execution is always a thread mode, never page-resident); build NOW, no new backend |
| Workflow Builder (v2.9) | [references/workflow-builder.md](references/workflow-builder.md) | NL authoring: describe → AI drafts a read-mostly live-streaming phase-card diagram (5 real phase types + tool whitelist + gate + KB scope); refine by talking (no drag-canvas); lint gates publish; publish freezes immutable v1 / edits fork v2; per-phase KB folder picker. **Design-ahead — build v2.9 (SEED-051)** |

**Chat tool-card unification (sketches 014–016, Phase 095):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Chat Tool-Card Unification | [references/chat-tool-card-unification.md](references/chat-tool-card-unification.md) | **One component set, three concerns.** (1) Unified frame = a borderless step-numbered status-node rail (green→done / pulsing-primary→active / dim→queued); finished steps fold to a muted one-line essence, active blooms, click-to-expand details; row-numbering makes D-04 count + D-05 zero-dup structural. (2) Honest run-status strip that never vanishes (stable-start-ts, freezes only on true terminal) + hybrid placement (header + bottom Jump-to-live chip) + follow-but-release scroll. (3) Output files hero/working split + always-downloadable + per-extension SVG file icons. **Build `unifiedStepCount()` once = the embodied honesty fix; forbid re-forking `.file-out`/`detailHTML`/a 2nd strip.** See `sources/095-grounding/CONSISTENCY.md`. |

## Theme

The winning theme file is at [sources/themes/default.css](sources/themes/default.css). Tokens are direct mirrors of `frontend/src/index.css :.dark` — so transitioning sketches to React code should be a straight port, not a rebuild.

## Source Files

Original sketch HTML files are preserved in `sources/` for complete reference. Each contains all variants (winners + alternatives) so you can re-feel the rejected paths if a question reopens.

- [sources/001-stream-framing/](sources/001-stream-framing/) — winner: C (Run-Card)
- [sources/002-tool-call-panel/](sources/002-tool-call-panel/) — winner: C (Editor Inset)
- [sources/003-thinking-moment/](sources/003-thinking-moment/) — winner: B (Focus Mode)
- [sources/004-panel-shell/](sources/004-panel-shell/) — winner: B (Stacked accordion)
- [sources/005-file-and-diff/](sources/005-file-and-diff/) — winner: A (Full-replace drill-in + in-column unified diff)
- [sources/006-pending-question/](sources/006-pending-question/) — winner: C (Dual-surface calm-pin + chat cue)
- [sources/007-chat-panel-seam/](sources/007-chat-panel-seam/) — winner: C (Live-pointer / reload-resolved)
- [sources/008-phase-timeline/](sources/008-phase-timeline/) — winner: D (RunCards on a spine)
- [sources/009-unified-surface/](sources/009-unified-surface/) — winner: C (Live-status → resolves)
- [sources/010-honesty-and-drafts/](sources/010-honesty-and-drafts/) — winner: C (Pin-while-active → fold)
- [sources/011-mode-and-composer/](sources/011-mode-and-composer/) — winner: A (Status chip + Cancel)
- [sources/012-workflows-page/](sources/012-workflows-page/) — winner: A (Card grid)
- [sources/013-workflow-builder/](sources/013-workflow-builder/) — winner: A (Talk-led; v2.9 design-ahead)

- [sources/014-unified-card-frame/](sources/014-unified-card-frame/) — winner: Synthesis (rail + status nodes + active bloom)
- [sources/015-status-strip-and-scroll/](sources/015-status-strip-and-scroll/) — winner: C (Hybrid — header strip + bottom Jump-to-live chip)
- [sources/016-output-files-hero/](sources/016-output-files-hero/) — winner: A (Hero block + working group; per-extension SVG icons)

**Phase 094 grounding** — [sources/094-grounding/](sources/094-grounding/) holds `BRIEF.md` (real harness SSE events + the "wire-only / dropped by `api.ts`" analysis) and `DATA-CONTRACT.md` (the event/wire data contract + the real-vs-invented field boundary). Read these for exact event names and which fields actually exist before wiring any 008–013 surface.

**Phase 095 grounding** — [sources/095-grounding/](sources/095-grounding/) holds `GROUNDING.md` (the real Deep SSE event vocabulary, the 24-tool set with literal resting-essence strings, the current-render "before", and the three bug clusters with their root mechanisms) and `CONSISTENCY.md` (the build-once component inventory + the 13-drift cross-sketch audit). Read both before wiring real event names or building any of the 014–016 surfaces.
</findings_index>

<when_to_load>
## When to Apply These Findings

Load and apply this skill when:

- Building or refactoring `frontend/src/components/chat/ToolCallPanel.tsx` (G-5 hot file — 5+ historical touches)
- Building or refactoring `frontend/src/providers/StreamsProvider.tsx` (G-5 hot file)
- Building or refactoring `frontend/src/components/chat/MessageItem.tsx` or `frontend/src/hooks/useMessages.ts`
- Adding a new tool to the agent (you'll need a new per-tool inner body component — see `references/tool-call-panel.md` D2)
- Designing the UI for any phase tagged `chat`, `streaming`, `agent-loop`, `tool-call`, `live-execution`, or `provider-ux`
- Reviewing UI work against the "lived-experience UAT-gap" rule (CLAUDE.md guardrail G-4)

**Workspace panel (Phase 087) — load when:**

- Building the right-side workspace panel shell, its collapse/rail/mobile behavior, or the section accordion (`references/panel-shell.md`)
- Building the file browser, file preview, or version-diff viewer in the panel (`references/file-browser-and-diff.md`)
- Building the `ask_user` pending-question UI, the paused/locked-composer treatment, or answer-and-resume (`references/pending-question.md`)
- Adding chat renderers for `write_todos` / `workspace_write` / `ask_user`, or anything touching the live-vs-reload transcript boundary (`references/chat-panel-seam.md`)
- Working on any phase tagged `panel`, `workspace`, `ask_user`, `diff`, `files`, or `seam`

**Workflow mode & harness legibility (sketches 008–013, Phase 094) — load when:**

- Wiring the dropped harness lifecycle events (`phase_started`/`phase_completed`/`phase_transition`/`gate_failed`/`run_completed`/`run_failed`) into the panel, or building the harness phase-timeline (`references/harness-phase-timeline.md`)
- Building the unified panel that hosts BOTH Deep and Harness runs, or the chat↔panel run seam (live pointer → resolved receipt card) (`references/unified-execution-surface.md`)
- Rendering failed-as-failed runs, visible drafts, batch sub-results, or the provenance answer card (`references/run-honesty.md`)
- Refactoring the composer (pill consolidation, Provider-into-Model), fixing the finding-#5 mode label, or building the running-workflow status chip + Cancel (`references/composer-and-mode.md`)
- Building the Workflows nav page or the Run→land-in-thread launch handoff (`references/workflows-page.md`)
- Building the v2.9 NL workflow builder / authoring surface or the per-phase KB folder picker (`references/workflow-builder.md`)
- Working on any phase tagged `harness`, `workflow`, `timeline`, `unify`, `composer`, `mode`, `honesty`, `launcher`, or `nl-authoring`, or on Phase 094 (Workflow Legibility + Mode Clarity)

**Chat tool-card unification (sketches 014–016, Phase 095) — load when:**

- Building or refactoring the Deep tool-card frame in `RunCard.tsx` / `ToolCallPanel.tsx` — the status-node rail, the one-line essence + click-to-expand, Focus-Mode fold/bloom, or the zero-duplicate sub-agent card (`references/chat-tool-card-unification.md`)
- Building the persistent run-status strip (the never-vanishes timer derivation), its hybrid header/floating placement, the "Jump to live" chip, or the follow-but-release scroll in `MessageList.tsx`
- Building the output-files area in `MessageItem.tsx` / `OutputFileCard.tsx` — the hero/working split, the agent-flagged final output, the always-downloadable guarantee, or the per-extension `fileIcon`
- Implementing `unifiedStepCount()` or the `clientKey`/`makeToolKey` sub-agent-path dedup (the embodied D-04/D-05 honesty fixes) — **read `sources/095-grounding/CONSISTENCY.md` first to build the shared inventory once, not three forks**
- Working on any phase tagged `tool-card`, `unify`, `status-strip`, `timer`, `auto-scroll`, `output-files`, `download`, or on Phase 095 (Chat Tool-Card Unification)

Skip when:

- Working on non-chat, non-panel surfaces (settings, document library, skill studio, auth)
- Working on backend-only changes (no UI touch)
</when_to_load>

<metadata>
## Processed Sketches

- 001-stream-framing (winner: C — Run-Card)
- 002-tool-call-panel (winner: C — Editor Inset)
- 003-thinking-moment (winner: B — Focus Mode)
- 004-panel-shell (winner: B — Stacked accordion)
- 005-file-and-diff (winner: A — Full-replace drill-in + in-column unified diff)
- 006-pending-question (winner: C — Dual-surface calm-pin + chat cue)
- 007-chat-panel-seam (winner: C — Live-pointer / reload-resolved)

**Phase 094 — Workflow Legibility + Mode Clarity (2026-06-04):**

- 008-phase-timeline (winner: D — RunCards on a spine)
- 009-unified-surface (winner: C — Live-status → resolves)
- 010-honesty-and-drafts (winner: C — Pin-while-active → fold)
- 011-mode-and-composer (winner: A — Status chip + Cancel)
- 012-workflows-page (winner: A — Card grid)
- 013-workflow-builder (winner: A — Talk-led; v2.9 design-ahead)

**Phase 095 — Chat Tool-Card Unification (2026-06-05):**

- 014-unified-card-frame (winner: Synthesis — rail + status nodes + active bloom)
- 015-status-strip-and-scroll (winner: C — Hybrid: header strip + bottom Jump-to-live chip)
- 016-output-files-hero (winner: A — Hero block + working group; per-extension SVG icons)
</metadata>
