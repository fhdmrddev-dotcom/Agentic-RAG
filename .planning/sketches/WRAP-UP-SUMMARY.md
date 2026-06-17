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

---

# Session 5 — Workflow Studio: Authoring, Publish, Run Surface & Navigation (Phase 103)

**Date:** 2026-06-14
**Sketches processed:** 6 (018–023 — all included)
**Design areas:** Workflow Authoring · Publish Gauntlet · Workflows Page (updated) · Workflow Run Surface · App Information Architecture
**Skill output:** appended to `./.claude/skills/sketch-findings-agentic-rag/` (5 new reference files: `workflow-authoring.md`, `publish-gauntlet.md`, `workflows-page.md` [extended], `workflow-run-surface.md`, `app-information-architecture.md`)

## Included Sketches

| # | Name | Winner | Design Area / Reference |
|---|------|--------|-------------------------|
| 018 | requirement-first-authoring | A — Describe-box-first, form-led, post-draft grounding | Workflow Authoring → `references/workflow-authoring.md` |
| 019 | draft-refine-and-readonly-graph | D — Read-only vertical phase-spine + side-panel forms | Workflow Authoring → `references/workflow-authoring.md` |
| 020 | publish-gauntlet-honesty | B — Real 8-stage progress-spine, judge hard-wall, verbatim PublishVerdict | Publish Gauntlet → `references/publish-gauntlet.md` |
| 021 | workflows-page-and-nav-map | A — Project-folder rail + drafts shelf + derived strictness-tier badge | Workflows Page (updated) → `references/workflows-page.md` |
| 022 | workflow-run-in-thread | A — Panel owns the meaningful spine, chat thin receipt, composer locked-in-thread | Workflow Run Surface → `references/workflow-run-surface.md` |
| 023 | app-linkage-map | A — Three-homes no-router contract; publish-is-the-test | App Information Architecture → `references/app-information-architecture.md` |

## Excluded Sketches

| # | Name | Reason |
|---|------|--------|
| 017 | cross-thread-run-stop | Orphan — no README authored; not packaged into a reference. (The cross-thread "live somewhere else" / stop question routed forward from Session 1 remains open; not part of this Phase 103 batch.) |

## Grounding

Authored against `103-grounding/` (`BRIEF.md`, plus `022-RUN-SURFACE-AUDIT.md` and `APP-LINKAGE-MAP.md`) and the `MANIFEST.md` decision log — the real `WorkflowDefinition` / `PhaseSpec` schema, the real `PublishVerdict` field set + the 10 `blocked_stage` codes, the 8-stage publish gauntlet, and the existing endpoints. The honest real-vs-net-new boundary is carried into every reference file (only `GET /workflows/published` + `POST /workflows/{id}/publish` are live).

## Design Direction

**Calm instrument, now an authoring + governance surface — and the run made honest.** v2.9 Workflow Studio gives the workflow ENGINE a face: you describe a recurring task in plain language, the AI drafts the whole definition one-shot, you refine by form on a read-only graph, and a real publish gauntlet (golden run on your KB + an independent judge) is the ONLY trial run before it can ever run. The same restraint governs throughout — a 3-second read at rest, tiered guidance (inline ⓘ popovers · dismissible banners · a modal only for a must-decide grey area), real-enum strictness only (never invented labels), and load-bearing honesty (every net-new wire field flagged in-surface). The run surface keeps the seam clean: the workspace panel owns the meaningful phase spine, the chat carries only a thin run receipt.

## Key Decisions

1. **Requirement-first, form-led authoring (018-A, supersedes 013's talk-led).** First screen is JUST the describe box (3-second read). The AI drafts the whole `WorkflowDefinition` one-shot + sets a real-enum strictness dial (`citation_policy` strict\|flag\|partial\|draft, presets + advanced). Grounding (project-folder confirm + template upload/fill-contract + the two-layer guarantee) and the BATCHED no-silent-substitution grey-area confirm appear POST-DRAFT, revealed by the draft — never faked up front.

2. **Refine by FORM on a read-only VERTICAL phase-spine graph (019-D).** Linear i→i+1 spine + one dashed `skip_to_phase`; NO drag-canvas, no `depends_on` / parallel lanes, no horizontal-graph slider, no inline-expand. Each of the six `phase_type`-conditioned forms opens in a fixed-width 400px right-side push/split panel (`minmax(0,1fr)`; 44px resting rail; mobile bottom-sheet).

3. **Publish IS the test — the real 8-stage gauntlet, judge as a hard wall (020-B).** owner → definition-valid → business_requirement → lint → interactive-phase → REAL golden run on the project KB → structural gate → independent judge → flip, collapsed to a horizontal progress-spine so the long SYNCHRONOUS golden-run wait is the canvas hero. `PublishVerdict`'s 5 fields render VERBATIM from the server. Judge = NO override (the "publish anyway" rendered struck-through), per-criterion `{criterion, score, evidence}` rows + a one-paragraph server summary. "View the golden run" gates on `golden_run_id != null`; un-producible verdict fails closed; HTTP mapping distinguished using only the 10 real `blocked_stage` codes.

4. **Workflows page extends 012, doesn't replace it (021-A, D7–D14).** The Run-into-a-thread launch handoff stays byte-for-byte 012's; 021 adds a left project-folder filter rail (the live `GET /workflows/published?project_folder_id` query), a Drafts & seeds shelf above Published (calm collapsed search + dismissible honesty banner), per-card ESSENCE (icon+name+vN + source tag + 6-type phase-chain glyphs incl. `llm_emit` ◆ + entry `input_keys` + strictness-tier badge), a strictness-tier badge DERIVED via `deriveTier()` (`TIERS` = single source of truth, real vocab only), Run = a mode of a thread, and Tweak forks a NEW draft version (a draft CANNOT be Run directly — publish gauntlet IS the test).

5. **Run surface — panel owns the MEANINGFUL spine, chat is a thin receipt (022-A).** The workspace PANEL owns the single live meaningful phase spine (008-D PhaseTimeline/PhaseCard, stays visible during the run); the CHAT carries only a thin run receipt (015-C never-vanishes status strip + mode badge) that resolves into a three-way deliverable/failure/cancel terminal — never a second embedded 6-row timeline. A meaningful step = human title (NET-NEW `phase.name`) + "Phase i of N · type" + a RUNNING-phase-ONLY honest activity line + a gate chip only when a `PhaseSpec.validator` exists. Composer A (locked-in-thread, ★) makes the run own the composer (status chip + Cancel; only the scoped 006-C ask_user pause replies; unlocks to Deep on resolve; parallel-thread escape hatch).

6. **Three-homes navigation contract, NO router (023-A; all OD-1..11 ADOPTED).** THREE HOMES — Builder (authoring) / Workflows-page (library + launch) / Chat-thread (execution) — wired with NO router; every redirect is a `useState<ActiveView>` switch, intra-page state, a modal, or create-thread-then-switch. PUBLISH IS THE TEST: a draft cannot be Run directly; Run appears ONLY once published; publish success auto-returns to the Workflows page with the new version + a Run CTA; Run = create thread + set workflow mode + switch to Chat. One net-new "Workflows" nav entry (extend the `ActiveView` union + a shared `NAV_ITEMS`, delete the dead AppDock, distinct non-gear icon); Tweak forks a new-version draft into the Builder; the locked-run escape hatch is a sibling Deep thread.

## Downstream

The design substrate for **Phase 103 (Workflows page + NL authoring; G-2 sketch FIRES)** and the surrounding Workflow Studio build. All 11 open IA decisions (OD-1..11) are ADOPTED 2026-06-14 ("publish is the test") — this is the locked contract, not open questions. Honest real-vs-net-new boundary preserved in every reference (only `GET /workflows/published` + `POST /workflows/{id}/publish` are live). Five new reference files packaged; the skill now spans 18 reference files across five sessions. G-2 acceptance bar met; next on the 103 path is the UI design contract / plan-phase. The skill auto-loads during build for the workflow Builder/authoring, the publish gauntlet, the Workflows page, the workflow run surface, and the app navigation/IA.

---

# Session 6 — Document Detail Panel & Metadata Editing (Phase 112)

**Date:** 2026-06-17
**Sketches processed:** 2 (027–028 — both included)
**Design areas:** Document Detail Panel & Metadata Editing (one combined area — the shared detail shell + the confidence chip / inline edit)
**Skill output:** appended to `./.claude/skills/sketch-findings-agentic-rag/` (new: `references/document-detail-panel.md`)

## Included Sketches

| # | Name | Winner | Design Area / Reference |
|---|------|--------|-------------------------|
| 027 | document-detail-shell | A — right-side push/split panel (shared META+REL+CLASS shell) | Document Detail Panel & Metadata Editing → `references/document-detail-panel.md` |
| 028 | confidence-and-edit | A — trust-gutter + scored ConfidenceChip + honest inline edit | (same reference) |

## Still Unprocessed (flagged — NOT in this session)

| # | Name | Note |
|---|------|------|
| 024 | embedding-provider-picker | Phase 111.1 settings session — not yet wrapped into the skill |
| 025 | reembed-confirm-gate | Phase 111.1 — not yet wrapped |
| 026 | reembed-in-progress | Phase 111.1 — not yet wrapped |

_Run `/gsd:sketch-wrap-up` again to package the Phase 111.1 settings session (024–026)._

## Grounding

028 was authored from a grounded **3-lens design workflow** (calm-Linear / honesty-forward / dense-triage → judged 86 / 88 / 82 → synthesized) and the grounding was **independently re-verified against the codebase** — which overturned three wrong "doesn't exist" claims (per-field `documents.metadata._confidence`, the `metadata.update` audit action, and the `/metadata-fields` router all DO exist, from Phase 111). The corrected real-vs-net-new contract + the full build spec are preserved at `sources/028-confidence-and-edit/GROUNDING.md`.

## Design Direction

**Calm instrument, extended to the document-management surface — and made honest about what the model knew.** v3.0 needs a first-class place to SEE the metadata Phase 111 extracts (each field + its per-field confidence) and to CORRECT it. The detail surface is a right-side push/split panel (same push-not-overlay philosophy as the workspace panel) that keeps the list visible for the scan→fix→next correction loop, organized as stacked-accordion sections so it is a SHARED SHELL later DM phases plug into. Per-field confidence reads as a chip that is legible without colour (glyph + tier word + score); honesty is load-bearing — model-confidence vs human-override provenance is unmistakable, empty fields read as genuinely absent, and the audit write is surfaced.

## Key Decisions

1. **Detail surface = a right-side push/split panel (027-A), the SHARED shell.** `minmax(0,1fr) 430px`; list shrinks but stays visible (the scan→fix→next loop). Stacked-accordion sections (004-B): Metadata · Relationships (117) · Classification (118) · Versions. **117 and 118 add their sections to THIS panel — reuse, don't rebuild.** Mobile bottom-sheet. Rejected: full-page view (interrupts the loop), modal (breaks push-not-overlay + cramps), inline-expand (too tight).

2. **Per-field confidence = a `ConfidenceChip` (028-A): glyph + tier word + raw score, never colour-alone (WCAG 1.4.1).** Clone `StatusPill`, NOT the chat `ConfidenceBadge`. Trust-gutter spine for an at-a-glance read; low-confidence VALUES read tentative (italic + dim + ⚠). Tier thresholds settings-driven (the `0.54/0.38` are *retrieval* buckets — a different system).

3. **Honesty is load-bearing.** Manual edit → NEUTRAL "✎ Edited" (no score, no green — a human owns it); unscored value → "✦ Extracted" (never a fabricated "High"); `exclude_none` empties → "Not extracted — add" (editing one ADDS a value); "🛡 Saved · audit logged" receipt (`metadata.update`, already allow-listed).

4. **Inline edit = correction, not a form (FolderNode pattern).** Click value → in-place control; Enter saves, Esc cancels; "will become · Edited" preview. Triage = honesty banner + `PanelSection` warn-count + "Review low first" + "Jump to next". **Bulk-confirm deliberately CUT** (manufactures false provenance).

5. **Honest net-new wire for the build.** The metadata-PATCH endpoint does NOT exist today (metadata is written only at ingest) — inline edit needs it net-new (the Phase 101/104 false-green class); plus a per-field `source: user|extracted` marker (re-extraction must not overwrite edits) and custom-field edit persistence. Everything else (per-field `_confidence`, `exclude_none`, the audit action, `/metadata-fields`) is already real.

## Downstream — concrete next stages

**Build Phase 112 (this surface):** `/gsd:spec-phase 112` → `/gsd:discuss-phase 112` (cross-check open `surface: Agentic-RAG` bugs; lock the per-field `source` marker + tier thresholds + the metadata-PATCH contract as the gray areas) → `/gsd:plan-phase 112` → `/gsd:execute-phase 112`. **G-2 (sketch-before-plan) is satisfied** by 027 + 028. UX-01 (Deep Midnight / mobile / WCAG AA) + UX-02 are cross-cutting acceptance.

**Phases that INHERIT this shell (reuse, do not rebuild):** Phase 117 (relationship panel) and Phase 118 (classification suggestion) add accordion sections to THIS panel; Phase 119 (governance health) links its low-confidence-metadata signal back into the `ConfidenceChip`. The skill now spans 19 reference files across six sessions and auto-loads during build for the document detail panel, the `ConfidenceChip`, inline metadata editing, and the documents-page right-side panel.
