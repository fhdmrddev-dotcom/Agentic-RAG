---
name: sketch-findings-agentic-rag
description: Validated design decisions, CSS patterns, and visual direction for the agent's live-execution UX, the right-side workspace panel, the Phase 094 workflow-mode surfaces, the Phase 095 chat tool-card unification, AND the Phase 103 Workflow Studio (run-card frame + tool-call panel + long-run composition; panel shell, file/diff viewer, ask_user interrupt, chat↔panel seam; harness phase timeline, unified Deep/Harness execution surface, run honesty, 2-pill composer + mode clarity, Workflows page, NL workflow builder; the unified Deep tool-card frame with a status-node rail, the never-vanishes run-status strip + follow-but-release scroll, the output-files hero/working split + per-extension file icons; the requirement-first workflow Builder authoring + read-only vertical phase-spine graph + side-panel forms, the 8-stage publish gauntlet with the judge hard-wall, the built Workflows page library+launch, the workflow run surface where the panel owns the meaningful phase spine + chat carries a thin run receipt, and the three-homes app navigation/IA contract; AND the Phase 112 Document-Management surfaces — the right-side push/split document-detail shell, the per-field ConfidenceChip, and honest inline metadata editing). Auto-loaded during UI implementation on the Agentic RAG project. Use when building or refactoring ToolCallPanel, RunCard, StreamsProvider, MessageItem, MessageList, OutputFileCard, useMessages, the workspace panel, the harness/workflow run UI, the workflow Builder/authoring, the publish gauntlet, the Workflows page, the workflow run surface, the app navigation/IA, the composer, the document detail panel, the ConfidenceChip, inline metadata editing, the documents-page right-side panel, or any chat-surface component that touches the agent's mid-execution moment.
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

**Sketch sessions wrapped:** 2026-05-24 (live-execution UX — sketches 001–003), 2026-05-29 (workspace panel — sketches 004–007), 2026-06-04 (workflow legibility + mode clarity — sketches 008–013, Phase 094), 2026-06-05 (chat tool-card unification — sketches 014–016, Phase 095), 2026-06-14 (Workflow Studio authoring, publish gauntlet, run surface + navigation IA — sketches 018-023, Phase 103), 2026-06-17 (document detail panel + honest metadata editing — sketches 027-028, Phase 112)
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

## Document Detail Panel & Metadata Editing (Phase 112)

v3.0 Document Management needs a first-class place to SEE the metadata Phase 111 now extracts (each field + its per-field confidence) and to CORRECT it. Sketches 027 + 028 establish that surface on the calm-instrument terms — and it is a SHARED SHELL later DM phases plug into.

- **The detail surface = a right-side push/split panel (027-A), NOT a full page or modal.** Opening a document slides a ~430px panel in from the right (`minmax(0,1fr) 430px`); the document list shrinks but stays visible so the **scan → fix → next** correction loop keeps its place. Organized as stacked-accordion sections (the 004-B pattern): Metadata (open) · Relationships (Phase 117) · Classification (Phase 118) · Versions. **Phase 117 and 118 add their sections to THIS panel — they do not build a new surface.** Mobile → bottom-sheet.
- **Per-field confidence = a `ConfidenceChip` (028-A): glyph + tier word + raw score, never colour alone (WCAG 1.4.1).** Clone `StatusPill` (NOT the chat-only `ConfidenceBadge`). High `✓`/green · Med `●`/amber · Low `⚠`/lightened-red. A 2px decorative trust-gutter spine gives an at-a-glance certainty read; a low-confidence VALUE itself reads tentative (italic + dimmed + ⚠) so flagged rows are pre-attentively visible. Tier thresholds are settings-driven (a 112 decision — the codebase `0.54/0.38` are *retrieval* buckets, a different system).
- **Honesty is load-bearing.** A manual edit flips the chip to a NEUTRAL "✎ Edited" with **no score and no green** (a human owns it; green/score would falsely imply model confidence). A stored value with no `_confidence` → neutral "✦ Extracted", NEVER a fabricated "High". Empty fields (`exclude_none`) show "Not extracted — add", never a fake blank (editing one ADDS a value). Saving surfaces a "🛡 Saved · audit logged" receipt (the `metadata.update` audit, already allow-listed).
- **Inline edit = correction, not a form (FolderNode pattern).** Click a value → in-place control; Enter saves, Esc cancels; "will become · Edited" preview. Triage = honesty banner + `PanelSection` warn-count + "Review low first" + "Jump to next". **Bulk-confirm deliberately CUT** (manufactures false provenance).
- **Honest net-new wire for the build:** the **metadata-PATCH endpoint does NOT exist today** (metadata is written only at ingest) — inline edit needs it net-new (the Phase 101/104 false-green class); plus a per-field `source: user|extracted` marker (so re-extraction never overwrites edits) and custom-field edit persistence. Per-field confidence (`documents.metadata._confidence`), `exclude_none`, the `metadata.update` audit action, and the `/metadata-fields` router ARE already real (Phase 111). Build spec: `sources/028-confidence-and-edit/GROUNDING.md`.

## Chat Tool-Card Unification (Phase 095)

094 D-01 kept Deep's tool-cards **in the chat** (not moved to the panel); 095 fixes-and-unifies them *in place*, refining the 001-C/002-C/003-B language. Three concerns, **one component set** (see `references/chat-tool-card-unification.md` + `sources/095-grounding/CONSISTENCY.md`):

- **Unified frame = a borderless, step-numbered status-node rail.** Nodes fill green→done / pulsing-primary-ring→active / dim→queued so the sequence is *felt* without per-card borders; finished steps fold to a one-line essence (`# icon · tool → result`, muted), the active step blooms (primary wash + left bar). Every finished card is **click-to-expand** to its full per-tool body (details re-ranked, never hidden — D-01). Row numbering makes the honest step count (D-04) and the zero-duplicate invariant (D-05) **structural**, not cosmetic.
- **Honest run-status strip + follow-but-release scroll.** `⏱ elapsed · Step N · activity` that **never vanishes** — elapsed derives from a **stable start-ts**, renders continuously (immune to dropped SSE / tab throttling / temp-id remounts), and freezes only on a TRUE terminal (closes the Kimi/Moonshot vanish bug; the never-vanishes fix is a *timer-derivation code change*, not a placement choice). Placement is **hybrid**: header strip while in view + a bottom chip with "↓ Jump to live" on scroll-away. Scroll follows the live edge, releases on scroll-up, re-arms at bottom.
- **Output files = hero the deliverable, keep working files quiet, always-downloadable.** A big "★ Your file" hero (the agent-flagged final output) + a visible-but-quiet "Working files (N)" group. Every link downloads in one click, even on a chat reopened tomorrow (re-sign on demand; investigate the dead-link root first). The agent flags the hero via a small backend tag on `final_output_files` (D-08). **Per-extension SVG file icons** (document + folded corner + type glyph + colored extension ribbon, Untitled-UI style).
- **The governing rule:** build the shared inventory ONCE — `RunFrame` · `StepRail/StepRow` · `ToolEssenceLine` · one `ToolBody` · one `RunStatusStrip` (two placement wrappers) · one `fileIcon` · one `OutputFileCard` · `SubAgentEssence` · `unifiedStepCount()` · `useFollowScroll`. `unifiedStepCount()` (one derivation feeding rail # + strip "Step N" + collapsed "N steps") IS the embodied D-04/D-05 honesty fix. Forbid re-forking `.file-out` / `detailHTML` / a second status-strip.

## Workflow Studio — Authoring, Run Surface & Navigation (Phase 103)

v2.9 gives the workflow ENGINE a face: you author a workflow in plain language, run it through a real publish gauntlet, and only then can it run. These are the LOCKED principles (all 11 open decisions OD-1..11 adopted 2026-06-14, "publish is the test"):

- **Requirement-first, form-led, progressive disclosure (sketch 018-A, supersedes 013's talk-led).** The first screen is JUST the describe box — a **3-second read at rest** — not a chat transcript. The AI drafts the whole `WorkflowDefinition` one-shot and sets a real strictness dial. Grounding (project-folder confirm + template upload / fill-contract + the two-layer guarantee) and the BATCHED **no-silent-substitution** grey-area confirm appear **POST-DRAFT**, revealed by the draft — never faked up front. Authoring is form-led, not talk-led.
- **Tiered guidance, calm by default.** Hierarchy of intrusiveness: inline ⓘ popovers for nice-to-know, dismissible banners for orientation/honesty notes, a modal ONLY for a must-decide grey area (the batched substitution confirm). Nothing shouts until it has to.
- **Strictness = real enums only.** The dial is `citation_policy` `strict | flag | partial | draft` (presets + advanced) — NEVER invented "level 1/2/3" or compliance-mode labels. The badge/tier is DERIVED from the real gate set (`deriveTier()`, `TIERS` = single source of truth, badge can't drift); STRICT 🔒 / MIDDLE ◐ / LOOSE ○ map to strict/flag/draft + the actual gates, with the judge always-on even on LOOSE.
- **Refine by FORM on a read-only VERTICAL phase-spine graph (sketch 019-D).** Linear i→i+1 spine + one dashed `skip_to_phase`, NO drag-canvas, no `depends_on` / parallel lanes, no horizontal-graph-needing-a-slider, no inline-expand. Each of the six `phase_type`-conditioned forms opens in a **fixed-width 400px right-side push/split panel** via `minmax(0,1fr)` (never overlay/slider; 44px resting rail; mobile bottom-sheet).
- **Publish IS the test — the 8-stage gauntlet, judge as a hard wall (sketch 020-B).** A draft cannot be Run directly; the gauntlet's REAL golden run on the project KB + the independent judge ARE its only trial run (protects QUAL-01). The 8 stages (owner → definition-valid → business_requirement → lint → interactive-phase → golden run → structural gate → judge → flip) render as a horizontal progress-spine so the long SYNCHRONOUS golden-run wait is the canvas hero. `PublishVerdict`'s 5 fields (published, version, golden_run_id, blocked_stage, named_failures) render VERBATIM from the server, never re-derived. The judge has NO override (the "publish anyway" is rendered struck-through) and shows per-criterion `{criterion, score, evidence}` rows + a one-paragraph server summary. "View the golden run" gates strictly on `golden_run_id != null`; pre-run blocks show an explicit no-run note; an un-producible verdict fails closed with the honest-failure line. HTTP mapping is distinguished (200-with-block, 400 business_requirement, 404 not_found, 409 already_published) using only the 10 real `blocked_stage` codes.
- **Run surface — panel owns the MEANINGFUL spine, chat is a thin receipt (sketch 022-A).** The workspace PANEL owns the single live meaningful phase spine (008-D PhaseTimeline/PhaseCard, stays visible during the run); the CHAT carries only a thin run receipt (015-C never-vanishes status strip + mode badge) that points at the panel while live and resolves into a three-way deliverable / failure / cancel terminal — NEVER a second embedded 6-row timeline (avoids the sketch-004 dual-surface bounce). A meaningful step = human title (NET-NEW `phase.name`) + "Phase i of N · type" + a **RUNNING-phase-ONLY** honest activity line (relaxes D-03 for the active phase only) + a gate chip only when a `PhaseSpec.validator` exists; idle/done phases stay quiet. Composer A (locked-in-thread) makes the run own the composer — status chip + Cancel, only the scoped 006-C ask_user pause replies, unlocking to Deep chat on resolve, with a parallel-thread escape hatch.
- **Three-homes navigation contract, NO router (sketches 021-A + 023-A).** THREE HOMES: Builder (authoring) / Workflows-page (library + launch) / Chat-thread (execution). Every redirect is a `useState<ActiveView>` switch, intra-page state, a modal, or create-thread-then-switch — no router. Run appears ONLY once published; publish success auto-returns to the Workflows page with the new version + a Run CTA; **Run = create thread + set workflow mode + switch to Chat** (workflows are a mode of a thread, never page-resident). One net-new "Workflows" nav entry (extend the `ActiveView` union + a shared `NAV_ITEMS`, delete the dead AppDock, distinct non-gear icon); Tweak forks a new-version draft into the Builder (frozen published row immutable via DB trigger); the locked-run escape hatch is a sibling Deep thread.
- **Honesty is load-bearing.** Every NET-NEW wire field (`phase.name`, persisted `phase_type`, the active-phase activity line, the `llm_emit` Deliverable label) is flagged in-surface; honest net-new violet flags mark all draft CRUD + the Workflows nav entry; only `GET /workflows/published` + `POST /workflows/{id}/publish` are live (green). Three routed render/persistence bugs (BUG-260609-04 phase-0 clobber, -02 Sub-task desc loss, -01 dup-avatar) make today's surface meaningful with no new UI.
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

**Workflow Studio — authoring, publish, run surface & IA (sketches 018–023, Phase 103):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Workflow Authoring | [references/workflow-authoring.md](references/workflow-authoring.md) | **Requirement-first, form-led (supersedes 013's talk-led).** First screen is JUST the describe box (3-second read); AI drafts the whole `WorkflowDefinition` one-shot + sets a real-enum strictness dial (`citation_policy` strict\|flag\|partial\|draft, presets + advanced); grounding (project-folder confirm + template upload/fill-contract + two-layer guarantee) and the BATCHED no-silent-substitution grey-area confirm appear POST-DRAFT, revealed by the draft. Refine by FORM on a read-only VERTICAL phase-spine graph (linear i→i+1 + one dashed `skip_to_phase`, NO drag-canvas / `depends_on` / parallel lanes) with each of the six `phase_type`-conditioned forms in a fixed-width 400px right-side push/split panel (`minmax(0,1fr)`; 44px rail; mobile bottom-sheet). Avoid: drag-canvas, talk-led-primary, faked grounding up front, horizontal-graph slider, inline-expand form, invented strictness labels, silent substitution. |
| Publish Gauntlet | [references/publish-gauntlet.md](references/publish-gauntlet.md) | **Winner B — the REAL 8-stage gauntlet** (owner → definition-valid → business_requirement → lint → interactive-phase → golden run on the project KB → structural gate → independent judge → flip), ladder collapsed to a horizontal progress-spine so the long SYNCHRONOUS golden-run wait is the canvas hero. `PublishVerdict`'s 5 fields (published, version, golden_run_id, blocked_stage, named_failures) render VERBATIM from the server, never re-derived. Judge = a HARD WALL with NO override (the absent "publish anyway" rendered struck-through), shown as per-criterion `{criterion, score, evidence}` rows + a one-paragraph server summary. "View the golden run" gates on `golden_run_id != null` (pre-run blocks show an explicit no-run note); un-producible verdict fails closed; HTTP mapping distinguished (200-with-block / 400 business_requirement / 404 not_found / 409 already_published) using only the 10 real `blocked_stage` codes. |
| Workflows Page (updated) | [references/workflows-page.md](references/workflows-page.md) | **Sketch 021-A EXTENDS 012, not replaces it** — the Run-into-a-thread launch handoff (008-D + 009-C + 011-A) stays byte-for-byte 012's; 021 adds the 4 things 012 predates now you own a library (D7–D14): D7 left project-folder filter rail = the live `GET /workflows/published?project_folder_id` query; D8 a Drafts & seeds shelf above Published (calm collapsed search + shelf-toggle + dismissible honesty banner, 3-second read at rest); D9 per-card ESSENCE = icon+name+vN + source tag + phase-chain glyphs (6 types now — `llm_emit` ◆ "deliverable") + entry `input_keys` + strictness-tier badge; D10 the strictness-tier badge DERIVED via `deriveTier()` (`TIERS` = single source of truth) using REAL vocab only — STRICT 🔒/MIDDLE ◐/LOOSE ○ → strict/flag/draft + actual gates, judge always-on even on LOOSE; D11 Run = a mode of a thread (reuses `POST /threads/{id}/messages`); D12 Tweak forks a NEW draft version (frozen published row immutable via DB trigger) and a draft CANNOT be Run directly (publish gauntlet IS the test — protects QUAL-01); D13 the on-page nav/redirect-map overlay; D14 honest net-new violet flags on all draft CRUD + the nav entry (only `GET /workflows/published` + `POST /workflows/{id}/publish` live/green). Build target = Phase 103. |
| Workflow Run Surface | [references/workflow-run-surface.md](references/workflow-run-surface.md) | **The workspace PANEL owns the single live meaningful phase spine** (008-D PhaseTimeline/PhaseCard, stays visible during the run); the CHAT carries only a thin run receipt (015-C never-vanishes status strip + mode badge) that points at the panel while live and resolves into a three-way deliverable/failure/cancel terminal — never a second embedded 6-row timeline (avoids the sketch-004 dual-surface bounce). A meaningful step = human title (NET-NEW `phase.name`) + "Phase i of N · type" + a RUNNING-phase-ONLY honest activity line (relaxes D-03 for the active phase) + a gate chip only when a `PhaseSpec.validator` exists; idle/done phases stay quiet. Composer A (locked-in-thread, ★) makes the run own the composer — status chip + Cancel, only the scoped 006-C ask_user pause replies, unlocking to Deep chat on resolve, with a parallel-thread escape hatch. Honesty load-bearing; routes 3 render/persistence bugs (BUG-260609-04/-02, BUG-260610-01). Rejected: full timeline in chat, faked wire data, variant C full-screen run view, variant B chat-alongside. |
| App Information Architecture | [references/app-information-architecture.md](references/app-information-architecture.md) | **The v2.9 navigation contract = THREE HOMES (Builder authoring / Workflows-page library+launch / Chat-thread execution), wired with NO router** — every redirect is a `useState<ActiveView>` switch, intra-page state, a modal, or create-thread-then-switch. PUBLISH IS THE TEST: a draft cannot be Run directly (the publish gauntlet's golden-run + judge IS its only trial run, protecting QUAL-01); Run appears ONLY once published; publish success auto-returns to the Workflows page with the new version + a Run CTA; Run = create thread + set workflow mode + switch to Chat (workflows are a mode of a thread, never page-resident). One net-new "Workflows" nav entry (extend the `ActiveView` union + a shared `NAV_ITEMS`, delete the dead AppDock, distinct non-gear icon); Tweak forks a new-version draft into the Builder; the read-only graph stays a Builder/page surface (not the run-time PhaseTimeline); the locked-run escape hatch is a sibling Deep thread. All 11 open decisions (OD-1..11) ADOPTED 2026-06-14 — this is the locked contract. |

**Document detail panel & metadata editing (sketches 027–028, Phase 112):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Document Detail Panel & Metadata Editing | [references/document-detail-panel.md](references/document-detail-panel.md) | **027-A: detail surface = right-side push/split panel** (`minmax(0,1fr) 430px`; list stays visible for the scan→fix→next correction loop) — a SHARED SHELL of stacked-accordion sections (004-B pattern) that **Phase 117 (relationships) + Phase 118 (classification) also inhabit — reuse, don't rebuild**; mobile bottom-sheet. **028-A: per-field `ConfidenceChip`** = glyph + tier word + raw score, never colour-alone (clone `StatusPill`, NOT the chat `ConfidenceBadge`); 2px trust-gutter spine; low-confidence VALUES read tentative (italic+dim+⚠). **Honesty load-bearing:** manual edit → NEUTRAL "Edited" (no score, no green); unscored value → "Extracted" (never a fabricated "High"); `exclude_none` empties → "Not extracted — add"; "🛡 Saved · audit logged" receipt; **bulk-confirm CUT**. Inline edit = `FolderNode` pattern (no panel-wide mode). Tier thresholds settings-driven (the `0.54/0.38` are *retrieval* buckets — a different system). **Net-new wire:** metadata-PATCH endpoint (none today), per-field `source:user\|extracted` marker, custom-field edit persistence → build spec in `sources/028-confidence-and-edit/GROUNDING.md`. |

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
- [sources/027-document-detail-shell/](sources/027-document-detail-shell/) — winner: A (right-side push/split panel; the shared META+REL+CLASS shell)
- [sources/028-confidence-and-edit/](sources/028-confidence-and-edit/) — winner: A (trust-gutter + scored ConfidenceChip + honest inline edit; incl. `GROUNDING.md` build spec)

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

**Document Detail Panel & Metadata Editing (sketches 027–028, Phase 112) — load when:**

- Building the net-new document detail panel (right-side push/split) on the documents/ingestion surface, or adding sections to it — `references/document-detail-panel.md` (the shared shell that Phase 117 relationships + Phase 118 classification also inhabit)
- Building the `ConfidenceChip` primitive, per-field confidence display, or the tentative / empty / manual-override / unscored field states
- Building inline metadata editing (the FolderNode-style edit-in-place, the model→human "Edited" provenance flip, the `metadata.update` audit receipt, the triage banner + warn-count + jump-to-next)
- Working on any phase tagged `document-management`, `metadata`, `confidence`, `detail-panel`, or on Phase 112 / 117 / 118 (the shared detail shell). **Read `sources/028-confidence-and-edit/GROUNDING.md` first** for the corrected real-vs-net-new contract + build spec.

Skip when:

- Working on non-chat, non-panel surfaces (settings, skill studio, auth)
- Working on the plain document-library table only — NOT the Phase 112 document detail panel, which this skill DOES cover
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

**Phase 103 — Workflow Studio Authoring + Run Surface + IA (2026-06-14):**

- 018-requirement-first-authoring (winner: A — describe-box-first, form-led, post-draft grounding)
- 019-draft-refine-and-readonly-graph (winner: D — read-only vertical phase-spine + side-panel forms)
- 020-publish-gauntlet-honesty (winner: B — real 8-stage progress-spine, judge hard-wall, verbatim PublishVerdict)
- 021-workflows-page-and-nav-map (winner: A — project-folder rail + drafts shelf + derived strictness-tier badge; extends 012)
- 022-workflow-run-in-thread (winner: A — panel owns the meaningful spine, chat thin receipt, composer locked-in-thread)
- 023-app-linkage-map (winner: A — three-homes no-router contract; publish-is-the-test)

**Phase 112 — Document Detail Panel & Metadata Editing (2026-06-17):**

- 027-document-detail-shell (winner: A — right-side push/split panel; the shared META+REL+CLASS shell)
- 028-confidence-and-edit (winner: A — trust-gutter + scored ConfidenceChip + honest inline edit)
</metadata>
