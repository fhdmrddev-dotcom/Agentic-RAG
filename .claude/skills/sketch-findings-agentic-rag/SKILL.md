---
name: sketch-findings-agentic-rag
description: Validated design decisions, CSS patterns, and visual direction for the agent's live-execution UX, the right-side workspace panel, the Phase 094 workflow-mode surfaces, the Phase 095 chat tool-card unification, AND the Phase 103 Workflow Studio (run-card frame + tool-call panel + long-run composition; panel shell, file/diff viewer, ask_user interrupt, chat↔panel seam; harness phase timeline, unified Deep/Harness execution surface, run honesty, 2-pill composer + mode clarity, Workflows page, NL workflow builder; the unified Deep tool-card frame with a status-node rail, the never-vanishes run-status strip + follow-but-release scroll, the output-files hero/working split + per-extension file icons; the requirement-first workflow Builder authoring + read-only vertical phase-spine graph + side-panel forms, the 8-stage publish gauntlet with the judge hard-wall, the built Workflows page library+launch, the workflow run surface where the panel owns the meaningful phase spine + chat carries a thin run receipt, and the three-homes app navigation/IA contract; AND the Phase 112 Document-Management surfaces — the right-side push/split document-detail shell, the per-field ConfidenceChip, and honest inline metadata editing; AND the Phase 114 Virtual-Folders surfaces — the inline no-DSL filter/view builder + relative-date control, the saved-Views sidebar group, the shared Folders+Views NavRow / folder-tree polish, and the Documents-page composition/layout; AND the Phase 117 Document-Relationships panel section — the chip-led grouped-by-direction relationships accordion added to the existing detail panel (outgoing/incoming inverse labels, the masked "no access" row, re-fetch-not-optimistic remove) and the type-first searchable-typeahead create-link picker on the MoveToFolderDialog shell); AND the Phase 127 energized Workflow Studio re-skin (the publish-gauntlet pip/energy-spine + worded verdict + raw-on-demand, the quiet-idle/alive-active live step-flow) PLUS the cross-cutting ICON CONVENTION (provider/model icons = single-source @lobehub/icons everywhere; phase-type icons = the shared 3D PHASE_GLYPHS map); AND the Phase 146–148 OPERATOR CONTROL ROOM — the operator band+tabs shell (honest locks, plain-language-first + "⌥ Technical names" reveal, non-discoverable 404), the always-on audit-ledger receipt vocabulary (✎ write mark; consequence ≠ receipt), the pinned-vitals Control Plane (dependency health + active-runs-with-Kill via the victim-naming confirm sheet + capability kill-switch grid + spatially-separated maintenance), the two-ledger audit browser (chip filters + paged table + recorded CSV export), the users roster (last-active honesty, victim-naming disable, lockout-proof self-rows, flagged operator grant), and the API-enforced feature-visibility audience map with the extensible-audience (never-boolean) forward-compat contract; AND the 2026-07-22 catch-up wrap of five earlier sessions plus the first v3.5 sketch — the Phase 149 MODEL REGISTRY (instrument-table capability editor with the enabled→picker two-layer coupling + propose-only discovery that never auto-enables an un-returned capability), the Phase 152 WORKFLOW RUN INPUTS (the inline-grow Run modal with a bounded per-run scope override + the victim-naming delete cascade where threads become normal chats), the Phase 153 INLINE CITATIONS (per-claim superscript marker attach-on-settle + absence-as-signal + the numbered [n] References footer + hover-peek click-through), the Phase 156 CHAT-HISTORY HOME (collapsed-rail New Chat+Search + the permanent 58px icon rail + a dedicated history column + ⌘K global finder), the Phase 166 ORG-ADMIN shell + identity (org-indigo band+tabs with 3 live + 4 honest locked tabs + RLS-honest audit, the merged identity/org-switcher menu + the org-admin rail Shield-mirror), and the Phase 174 RUN-STATE & LIFECYCLE HONESTY (the tiered dim/amber/red terminal-state vocabulary keyed off persisted runs.status so it survives reload + the run-card header carrying a live pre-answer sub-state + an anchored-from-started_at timer + a single avatar). Auto-loaded during UI implementation on the Agentic RAG project. Use when building or refactoring ToolCallPanel, RunCard, StreamsProvider, MessageItem, MessageList, OutputFileCard, useMessages, the workspace panel, the Model Registry tab, the workflow RunModal / delete-cascade confirm, inline citation markers / the References footer, the nav rail / chat-history column / ⌘K palette, the org-admin shell / org switcher / identity anchor, the honest terminal run-states (cancelled/stopped/blocked/failed) or the pre-answer preparing header, the harness/workflow run UI, the workflow Builder/authoring, the publish gauntlet (its energized pip/energy-spine + worded verdict), the live phase spine (PhaseCard / PhaseTimeline), provider/model logos anywhere, the Workflows page, the workflow run surface, the app navigation/IA, the composer, the document detail panel, the ConfidenceChip, inline metadata editing, the documents-page right-side panel, the metadata filter/view builder, the saved-Views sidebar + folder tree (FolderNode/FolderTree NavRow), the document relationships panel section / create-link typeahead picker, any `/admin` Control-Room surface (OperatorBand, ControlRoomPage, HealthSignals, ActiveRunsSection, CapabilityGrid, MaintenancePanel, AuditTab, RecentActionsCard, LockedTab, TechnicalNamesToggle, the users roster, the feature-visibility map), any operator confirm sheet / audit receipt / kill-switch, or any chat-surface component that touches the agent's mid-execution moment.
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

**Sketch sessions wrapped:** 2026-05-24 (live-execution UX — sketches 001–003), 2026-05-29 (workspace panel — sketches 004–007), 2026-06-04 (workflow legibility + mode clarity — sketches 008–013, Phase 094), 2026-06-05 (chat tool-card unification — sketches 014–016, Phase 095), 2026-06-14 (Workflow Studio authoring, publish gauntlet, run surface + navigation IA — sketches 018-023, Phase 103), 2026-06-17 (document detail panel + honest metadata editing — sketches 027-028, Phase 112), 2026-06-19 (virtual folders — filter/view builder, relative-date control, saved-Views sidebar + folder-tree NavRow, Documents-page composition — sketches 029-033, Phase 114), 2026-06-20 (document relationships — chip-led grouped-by-direction panel section + type-first typeahead create-link picker — sketches 034-035, Phase 117), 2026-06-27 (Workflow Studio energized re-skin — gauntlet pip/energy-spine + worded verdict + raw-on-demand, quiet-idle/alive-active living step-flow, + the cross-cutting icon convention — sketches 051-052, Phase 127), and the 2026-07-04 batch wrap of six further sessions — 2026-06-16 (Settings provider picker + re-embed lifecycle — sketches 024-026, Phase 111.1), 2026-06-21 (auto-classification — 036-037, Phase 118; governance health — 038-040, Phase 119), 2026-06-23/25 (Trigger Tuner — 041-045, Phases 123/123.1), 2026-06-26 (workflow soul + strict/loose two doors — 046-047, Phase 124), 2026-06-27 (cross-provider chat polish — 048-050, Phase 128), 2026-07-03 (Skill Studio — 053-057, Phase 137), 2026-07-04 (eval production-clean: matrix runs + determinate progress + engine health — 058-060, Phase 137.1), and 2026-07-11 (the Operator Control Room three-session wrap — shell + receipts 061-062 Phase 146; control-plane composition/active-runs-Kill/controls + the assembled linkage contract 063-066 Phase 147; governance audit-browser/users/feature-visibility 067-069 Phase 148), and the 2026-07-22 catch-up batch wrapping five previously-unwrapped sessions — 2026-07-12 (Model Registry capability editor + discovery propose-confirm — 070-071, Phase 149), 2026-07-14 (Workflow run inputs modal + delete cascade — 072-073, Phase 152), 2026-07-15 (inline citation marker + click-through — 074-075, Phase 153), 2026-07-16 (collapsed nav rail + chat-history home + ⌘K — 076-078, Phase 156), 2026-07-21 (identity anchor/org switcher + org-admin shell — 079-080, Phase 166) — plus 2026-07-22 (run-state & lifecycle honesty: tiered terminal states + live pre-answer honesty — 129-130, Phase 174, the first v3.5 sketch)
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

## Virtual Folders — Filter & View Builder, Saved Views, NavRow & Layout (Phase 114)

v3.0 makes metadata *queryable*: a no-DSL filter/view builder on the Documents page, saved "views" in the sidebar, and the folder-tree polish that lets Folders and Views read as peers. Sketches 029–033 (all winner A), revised after a 5-investigator integration audit (`wf_dc339594-8bb`).

- **Filter/view builder = one calm chip strip on the Documents page (029-A).** `Where [chip] [chip] ＋condition … N match · Save as view` — ad-hoc filtering and saved views are the SAME surface; Save-as-view persists what you're already looking at; the live count (an additive count-only resolve) turns amber at zero. Operators render in plain sans; **no on-screen type/operator matrix** (deleted — it leaked the type system and wrapped badly). `references/virtual-folder-filter-builder.md`.
- **Relative-date control = the operator carries the direction (030-A).** `within next… / older than… / before / after / between`; a `[N][unit]` stepper reveals a live resolved-window readout + a plain "updates automatically" line + an "overdue not included" note for `within next…`. "Today" is derived **server-side at resolve time** (drifts with the calendar; gives Phase 115's agent-tool live-recompute for free).
- **Saved Views = honest saved-filters from the shared NavRow (031-A).** A "Views" group below Folders; funnel icon (vs amber folder) + count badge (lazy/count-only) + tooltip-labeled `G` + Edit/Rename/Delete. Terminology is **"saved filters," never "query."** Differentiator = icon + count + no "new subfolder" action (NOT drop rejection — no drag-drop exists; a **"Move to folder"** row action reusing `MoveToFolderDialog` is added instead). `references/saved-views-and-left-nav.md`.
- **Folder-tree polish = ONE shared NavRow (033-A).** Extract a single row from `FolderNode`; build Folders AND Views from it (counts everywhere, flat Views, one soft indent guide + ~3-level cap, labeled `G`, keyboard/touch-reachable actions). Inlined into 114; **build Views from the fixed row, never a clone**.
- **Documents-page composition (032-A).** The 4-column crunch (sidebar + filter bar + list + 430px Phase-112 detail panel) resolves by collapsing the sidebar to a ~50px icon rail when the panel opens — **user-pinnable + session-persisted**; the filter bar collapses to a summary chip; `DocumentList` column-shedding is net-new. This is a **SHARED-SHELL layout inherited by Phases 117/118** (same panel). `references/documents-page-composition.md`.
- **Integration truths (audit-verified, load-bearing):** NO re-extraction and NO stored-data backfill — typed `date`/`document_type` columns are `GENERATED…STORED` derivations from existing `documents.metadata` (ISO-regex-guarded date cast). Case-insensitivity is mostly **query-value lowercasing** (`document_type`/`language` already stored lowercase; free-text uses `ILIKE`). The Phase 113 compiler output widens `@>` → bound WHERE-fragments (tested; the SC#4 injection test stays green); the AST grows optional `value2`/`values`/`unit` additively.

## Document Relationships — Panel Section & Link Picker (Phase 117)

v3.0 makes the document's typed relationships visible and editable — as ONE accordion section added
to the EXISTING Phase 112/028 `DocumentDetailPanel` (the shared shell reserves the `Relationships`
slot). **This extends the shell; it does NOT build a new surface.** Sketches 034 + 035 (both winner
A), hardened by the 3-lens fidelity audit `wf_1ec2afac-687`. Full reference:
`references/document-relationships-panel.md`.

- **Relationships section = chip-led, grouped-by-direction accordion (034-A).** Two labeled subgroups
  in fixed order — **Outgoing** (`A → X`) then **Incoming** (`Y → A`) — each row a rel-type pill chip
  (verb word + per-type dot) + filename + a remove ✕, with `+ Add link` at the section foot. Chip-led
  beat sentence-led (B) and compact/dense (C) on the 3-second direction read.
- **Incoming rows use INVERSE labels mirrored 1:1 from the backend (D-117-6).** "Supersedes" outgoing
  → "Superseded by" incoming — **from the backend `_INVERSE_LABEL` map, never invented in the client.**
- **Create = outgoing-only; remove = either-direction (D-117-1/2 — deliberate asymmetry, locked
  against review drift).** To author "X supersedes this," open X's panel. You own (and can remove) an
  edge from either end.
- **The masked "no access" row is load-bearing honesty, present by default (D-117-8, SC#2).** Renders
  the verbatim `_NO_ACCESS_MASK` string — never leaks id/title, never reads as error/empty, still
  removable. The read seam is leak-safe by construction (Phase 116 `is_latest`-gate + folder re-check).
- **Mutation = re-fetch, NOT optimistic → NO undo (D-117-9).** The audit pass *removed* an early
  "Undo" (it implies reversibility the backend lacks). The honest beat is a brief `↻ updating` flash
  (`role="status"`), then the fresh list. Honest 4-state set: populated ≠ empty ≠ loading ≠ error.
- **Create-link picker = the `MoveToFolderDialog` shell, `Select` → searchable typeahead (035-A,
  D-117-3).** A `Select` dies past ~30 docs; a KB holds thousands. Type-first: rel-type segmented
  chips on top, then the typeahead, a live "this document references → X" preview, confirm disabled
  until valid. Inline-in-accordion create (C) was the rejected foil. **Candidate exclusion is PER
  TYPE (D-117-4)** — self + already-linked-with-the-selected-type drop out; switching type re-opens
  candidates; an honest "N already … — hidden" note updates.
- **A11y is load-bearing (audit-locked, ships as truth).** Remove ✕ must be keyboard/touch-reachable
  (hover-only was a HIGH fail — touch has no hover); icon buttons carry `aria-label`; the typeahead is
  a **net-new combobox** (`role=combobox/listbox/option` + `aria-activedescendant`; the `Select` swap
  loses the APG roles shadcn gave for free; focus-trap/restore stay free from the reused `Dialog`);
  the masked string + all meaningful copy use the panel-scoped AA token (≥4.5:1, never the global
  3.59–3.64:1 dim); `updating`=`role=status`, error=`role=alert`.
- **Honest net-new wire (117):** Phase 116 shipped POST/DELETE but **NO REST read** — 117 adds a `GET`
  read endpoint whose leak-safe traversal is **extracted into a shared `document_relationship_service`
  and shared with the agent tool, never forked** (D-117-7, share-don't-fork); plus the typeahead
  candidate source + per-type exclusion, the `api.ts` client fns, and the `Relationships` section.

## Workflow Studio Energized Re-skin (Phase 127)

v3.1 WUX-03 re-skins two ALREADY-SHIPPED workflow surfaces for density + visual energy,
riding UNDER the Phase-124 soul (which stays). Winners 051-A + 052-A (operator 2026-06-27).
Full detail: `references/workflow-energized-reskin.md`.

- **Publish gauntlet (051-A)** — the 8 stages become a compact horizontal **energy-spine**
  (a 3D icon per stage; a comet of energy flows into the live stage), the resolved state
  **leads with a plain-worded verdict** and **demotes the raw 5-field `PublishVerdict` grid
  behind "Show raw verdict"** (the verbatim render + the `▦ rendered verbatim` cap stay
  inside the disclosure). Honesty preserved: verbatim verdict, judge HARD WALL (no override),
  4 distinct HTTP outcomes, run-link gated on `golden_run_id`, judge per-criterion rows
  first-class on a block. Sits under `<WorkflowSoul scale="pub">`.
- **Live step-flow (052-A)** — "calm at rest, comprehensive on the active step" (the 022-A
  target the shipped 094 card never reached): **idle steps stay quiet/still/no-animation**
  (SC#2); the **active step blooms** (glow + a vertical energy comet flowing in + the
  running-ONLY activity line + the AI-engine chip); done folds to a one-line essence; failed
  = the closed-taxonomy reason. Sits under `<WorkflowSoul scale="run">`. ⚠ G-5 — `PhaseCard`/
  `PhaseTimeline` are shared with the live harness run; re-run replay tests.
- **Energized intensity** is the operator-loved default; a calm anchor is kept as an
  in-sketch toggle (the build can dial the exact glow/motion).

## Icon Convention (cross-cutting, Phase 127)

One rule: **an icon for the same concept is byte-identical everywhere.** Full detail:
`references/icon-convention.md`.

- **Provider/model icons = ONE source: `@lobehub/icons`** (Phase 128 `providerLogo.tsx`) —
  all native-7 + OpenRouter, identical in chat / workflow-run engine chips / scoreboards /
  (future) Settings. Never hand-drawn, never per-surface (sketch placeholders for Kimi/GLM/
  MiniMax are NOT shipped art).
- **Phase-type icons = ONE source: the shared `PHASE_GLYPHS` map** (`soulData.ts`); Phase 127
  upgrades flat ⚙✎🤖⛓☺◆ → a 3D set in ONE additive swap that propagates to the soul
  card/run/pub + the 127 gauntlet stages + step cards.
- **Decorative/status icons** (`fluent-emoji`): VERIFY each slug resolves or bundle the SVG
  (the empty `fluent-emoji:direct-hit` → `bullseye` trap). Future Settings home for
  provider/model management + this convention: SEED-095.

## Settings: Provider Picker & Re-embed Lifecycle (Phase 111.1)

Full detail: `references/settings-provider-picker-and-reembed.md`.

- **Model knob = preset `<select>` + an ALWAYS-ON 🔒 endpoint footer** (endpoint · dims ·
  threshold · cloud/local tag, never behind Advanced) — you can never pick a model without
  seeing where it runs (the BUG-260616-01 cure). ONE component (`ProviderPicker.tsx`)
  reused for embedding, extraction, and any future model knob (the 060 judge knob).
- **Serious confirm = weight, NOT friction** — danger rail + 4-fact grid + consequence
  list + a two-step Confirm; NO type-to-confirm on reversible/resumable operations.
- **Background-job honesty = one rich home (Settings status card) + a whisper where
  it's felt** (a slim Documents-page pointer that deep-links + auto-hides) — never an
  app-wide banner.

## Auto-Classification (Phase 118)

Full detail: `references/auto-classification.md`.

- **"Suggested" ≠ "moved"** — never a silent auto-move; a deterministic rule match shows
  the matched rule + condition, NEVER a fake confidence %; accept → move + audit receipt,
  reversible; suggestion reads in BOTH the detail-panel Classification section AND on
  the document row (036-A).
- **Rules live on a dedicated surface** reached from the Documents rail's Automation
  group (037-A: list + side-panel builder), reusing the 029 chip-strip condition grammar
  + the 031 `G`-pill scope + a live "would match N" preview.

## Governance Health (Phase 119)

Full detail: `references/governance-health.md`.

- **Its OWN top-level read-only surface** (never a Library-Health tab, never an in-rail
  entry): three `HealthPanel` signal cards + a KPI strip; all-healthy = a posture hero.
- **The verb IS the diagnosis** (039-A inline `Open links`/`Classify`/`Re-extract` rows);
  the page **writes nothing** — verbs navigate to the canonical 112/117/118 edit
  surfaces; counts re-fetch as rows resolve; metadata confidence renders the Phase-112
  `ConfidenceChip`, never a retrieval-similarity %.

## Skill Trigger Tuner (Phases 123 + 123.1)

Full detail: `references/trigger-tuner.md`.

- **Focused full-surface** (041-A — too big for the 384px panel), later ABSORBED as the
  Skill Studio's Triggering tab (057).
- **Provider scoreboards are N-column = the org's configured targets, never a fixed
  four** — fixed grids crammed illegibly at the real 7-8 roster (BUG-260624-01; 042's ★
  moved to the as-built vertical-rows variant D). Fires + no-false sub-scores always
  visible; pick by HELD-OUT; author-confirm → PATCH, never auto-applied.
- **Lint = warn-never-block** in the shared service layer (covers human form + agent
  `save_skill`), with a one-click "Tune this →" handoff (now → Studio·Triggering).
- **Sketch density surfaces at the org's REAL scale** (the 045 lesson — auto-seed
  produces dozens of cases; pre-run, the editor gets the full width, no empty-results
  rail).

## Workflow Soul & Strict↔Loose Two Doors (Phase 124)

Full detail: `references/workflow-soul-and-two-doors.md`.

- **The soul = 5 atoms, PURPOSE-LED** (`business_requirement` hero · needs · glyph-dot
  phase spine · ONE derived tier chip · deliverable line), ONE scale-keyed component
  (`<WorkflowSoul scale="card|run|pub">`) so the same essence reads on the library card,
  run header, and publish summary.
- **Strict↔loose = an explicit two-door fork** ("Describe & run" vs "Author & govern");
  nothing lost by picking fast; govern controls recompute the tier LIVE; the judge is
  LOCKED always-on — a STRICT workflow can never silently downgrade.

## Cross-Provider Chat Polish (Phase 128)

Full detail: `references/cross-provider-chat-polish.md`.

- **Tool-card header = the provider's REAL logo** (single-source `@lobehub/icons` map) +
  the agent's "about to…" description during the `preparing` window; ONE byte-identical
  card layout on all 8 providers.
- **Exactly TWO elapsed-status homes** (header strip in view + floating Jump-to-live
  chip) — the redundant sticky composer timer was DELETED (pure subtraction; the
  imperceptible-delta variant was rejected: if the operator can't feel it in a sketch,
  don't ship the mechanism).
- **Long USER prompts clamp** to a 7-line preview + gradient-matched fade + inline
  "Read more"; user bubbles only, assistant answers untouched.

## Skill Studio (Phase 137)

Full detail: `references/skill-studio.md`.

- **ONE focused full-surface Studio** (053-A + 057-A): persistent header (name + vN +
  LIVE + gate strip on EVERY tab) over **Evals · Triggering · Versions** tabs; the
  Trigger Tuner absorbed as Triggering (re-homing, not rebuild); the detail panel slims
  to form + gate line + "Open studio"; tabs deep-linkable.
- **Status = the lifecycle stepper** (054-B): Cases → Eval → Gate → Published, each
  count ON its stage node; only the current stage narrates; `passed_on_older_version`
  reads as staleness; the gate strip is a CONDENSATION of the same server `PublishGate`
  — never a second truth-teller.
- **Run history = expandable rows** (055-B, shipped as `RunHistory`/`RunCaseDetail`):
  provider logo + model + version + honest rollup; side-by-side WITH/WITHOUT arms;
  `not_measured` = excluded-never-failed; `judge_error` = neither; interrupted = banner
  + re-run; human ratings labeled DISTINCT from judge verdicts.
- **Versions = table + any-to-any compare** (056-B): provenance chips from
  `SkillVersion.source`; force-promote evidence never softens; NO "Restore" (immutable
  — restore mints a NEW version).

## Eval Production-Clean: Matrix, Progress, Engine Health (Phase 137.1)

Full detail: `references/eval-production-clean.md`.

- **Matrix run = ONE grouped card in RunHistory** (058-A) whose sub-rows ARE 055-B rows;
  exactly ONE "▣ feeds gate" chip; aggregation footer = per-config mean±stddev from run
  HISTORY (stddev only at ≥2 runs) + Δ skill lift + deterministic tagged analyst notes
  (never LLM prose); launcher = one-click all-configured + gate-feeder select.
- **Running row = a thin determinate unit bar** (059-A; units = cases × 2 arms + judge;
  scales to any case count) + a live per-arm checklist with durations as arms land;
  judge `case_feedback` renders inline as a violet "◇" advisory block — never a verdict.
- **Engine health = a Settings tile board** (060-A): 8 logo tiles ✓/✗, staleness always
  shown, ✗ carries the VERBATIM provider error; ENGINE health ≠ model quality; the
  judge-model knob beneath = the 024-A picker with a registry-only list + an effective-
  default 🔒 footer.

## Operator Control Room (Phases 146–148)

The gated `/admin` zone. Full detail: `references/control-room-shell-and-receipts.md`,
`references/control-plane-live-surface.md`, `references/governance-audit-users-visibility.md`.

- **Shell = an amber-warmed operator band + horizontal tabs** (061-B) — never a second left
  rail. Tabs: Control Plane (landing) · Users & Access · Model Registry 🔒 · Secrets 🔒 ·
  Audit log; locked tabs refuse honestly, **no roadmap numbers in copy**. Non-operators:
  byte-identical nav + plain 404 (non-discoverable). ALL copy plain-first with the
  "⌥ Technical names" reveal (the LANG-01 pattern born at 146).
- **The ledger IS the receipt** (062-A): an action's proof = its row landing atop the
  always-visible Recent-actions card + a gentle band-marker flash — no toasts, no counters.
  ✎ marks writes; plain sentences, never codes; a still-in-effect write keeps its own
  persistent consequence banner (consequence ≠ receipt). Silent auto-polls never touch the
  ledger; the manual ↻ Refresh is the recorded deliberate read.
- **Control Plane = pinned vitals + one sectioned scroll** (063-B): Health → Active runs →
  Controls → Activity; the pinned strip can go amber/red mid-scroll (a monitor you can't
  see isn't a monitor); read failures keep last-known values.
- **Kill names its victim** (064-B): run cards (real @lobehub mark + live elapsed from a
  stable start-ts + what it's DOING); Kill opens a confirm sheet naming user/model/elapsed;
  honest Cancelling… → ✎ Cancelled·recorded; stuck runs read *recovered*, never killed.
  **The graded-guard rule (066):** target-specific destructive → victim-naming sheet;
  global toggle → arm-to-confirm; reversible-no-victim → direct flip.
- **Controls** (065-A): 2×2 capability kill-switch grid on the `app_settings` TTL substrate
  (OFF looks armed — red tint + "off for everyone" + honestly-derivable impact only);
  maintenance mode lives APART in its own amber panel (location carries the "one capability
  off" vs "platform read-only" distinction).
- **Audit browser = one browser, both ledgers** (067-A): source switch (operator | platform
  19-action vocabulary) over 029-A chip filters + a paged table; CSV export names its row
  count and is itself recorded; viewing platform activity records `audit.view_platform` —
  cross-user reading is visible, never silent.
- **Users & Access = instrument-table roster** (068-A): last-active honesty (never
  fabricated), Disable via the victim-naming sheet (GoTrue ban + app-layer refusal — data
  kept, reversible), Enable direct, self-rows lockout-proof, operator grant/revoke amber-
  sheeted + scope-flagged.
- **Feature visibility = audience rows on Users & Access** (069-A): *Everyone | ⛨ Operators
  only* per feature, consequence line + refused-API detail, `require_visible` router
  dependency (same TTL substrate). **The extensible-audience contract:** stored audience
  values are enum-shaped records NEVER booleans; audience resolution behind ONE swappable
  function; the control grows into an audience picker when v3.4 org-RBAC adds
  roles/departments (Glean greenlist model; SEED-115).
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

**Virtual folders — filter/view builder, saved Views, NavRow & layout (sketches 029–033, Phase 114):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Filter & View Builder | [references/virtual-folder-filter-builder.md](references/virtual-folder-filter-builder.md) | **029-A + 030-A.** Inline chip-strip builder on the Documents page (ad-hoc filtering IS the builder; Save-as-view persists it; live count via an additive count-only resolve, amber at zero). Type-aware operator menu with **NO on-screen type matrix** (deleted — leaked the type system + wrapped badly). Relative-date control where the operator carries the direction (within next…/older than…/before/after/between) + `[N][unit]` stepper + live resolved-window readout + plain "updates automatically"/"overdue not included" honesty; **today derived server-side**. Case-insensitive via query-value lowercasing + `ILIKE` for free-text. Backend: compiler widens `@>`→ bound WHERE-fragments (SC#4 test stays green); AST grows `value2`/`values`/`unit`; `GENERATED…STORED` typed columns, **no re-extraction**. |
| Saved Views & Left Nav (NavRow) | [references/saved-views-and-left-nav.md](references/saved-views-and-left-nav.md) | **031-A + 033-A.** Extract ONE shared `NavRow`; build Folders AND Views from it (counts everywhere, flat Views, one soft indent guide + ~3-level cap, tooltip-labeled `G`, keyboard/touch-reachable actions) — **never clone the flawed `FolderNode`**. Views = a group below Folders: funnel icon, lazy count badge, Edit/Rename/Delete; "saved filters" never "query". Differentiator = icon + count + no new-subfolder action (no drag-drop exists → criterion struck; add a **"Move to folder"** row action reusing `MoveToFolderDialog`). Inlined into Phase 114. |
| Documents-Page Composition | [references/documents-page-composition.md](references/documents-page-composition.md) | **032-A.** The 4-column crunch (sidebar + filter bar + list + 430px detail panel) resolves by collapsing the sidebar to a ~50px icon rail when the panel opens — **user-pinnable + session-persisted**; filter bar → summary chip; `DocumentList` column-shedding is net-new; overlay-drawer is the rejected foil. **SHARED-SHELL layout inherited by Phases 117/118.** Mobile: nav drawer + detail bottom-sheet + filter summary chip. |

**Document relationships — panel section & link picker (sketches 034–035, Phase 117):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Document Relationships Panel | [references/document-relationships-panel.md](references/document-relationships-panel.md) | **034-A + 035-A.** ONE accordion section added to the EXISTING Phase 112/028 `DocumentDetailPanel` (extend the shell, **not a new surface**). Chip-led, **grouped-by-direction** (Outgoing then Incoming), each row a rel-type pill chip + filename + a keyboard/touch-reachable remove ✕; **incoming uses INVERSE labels mirrored 1:1 from the backend `_INVERSE_LABEL`** (never invented). **Create = outgoing-only, remove = either-direction** (deliberate asymmetry, locked vs review drift). The masked **"linked document (no access)"** row (verbatim `_NO_ACCESS_MASK`, no id/title leak) is present by default — honesty, not error/empty. **Mutation = re-fetch, NOT optimistic → NO undo** (D-117-9; the audit killed an early Undo). Create-link picker = the **`MoveToFolderDialog` shell with `Select` → searchable typeahead** (D-117-3 — a Select dies past ~30 docs); type-first (rel-type chips → typeahead → "references → X" preview); **per-type exclusion** of self + already-linked (D-117-4). **A11y load-bearing (audit-locked):** the typeahead is a **net-new combobox** (`role=combobox/listbox/option` + `aria-activedescendant` — the Select swap loses APG roles), remove reachable on keyboard/touch, panel-scoped AA token for the masked string + all copy, `updating`=`role=status`/error=`role=alert`. **Net-new wire:** a `GET` read endpoint (116 shipped POST/DELETE only) whose leak-safe traversal is **extracted into a shared `document_relationship_service`, never forked** (D-117-7). |

**Workflow Studio energized re-skin + icon convention (sketches 051–052, Phase 127):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Workflow Energized Re-skin | [references/workflow-energized-reskin.md](references/workflow-energized-reskin.md) | **051-A** publish gauntlet = energy-spine of the 8 stages + a plain-worded verdict + the raw 5-field `PublishVerdict` behind "Show raw verdict" (honesty kept: verbatim · judge hard-wall · 4 HTTP outcomes · run-link gated · criteria first-class on block); under the 124 pub soul. **052-A** live step-flow = quiet/still idle steps (SC#2) + a bloomed active step (glow + energy comet + running-only activity + AI-engine chip) + folded-essence done; under the 124 run soul; ⚠ G-5 `PhaseCard`/`PhaseTimeline`. Energized default + calm toggle. |
| Icon Convention (cross-cutting) | [references/icon-convention.md](references/icon-convention.md) | An icon for the same concept is byte-identical everywhere. Provider/model icons = single-source `@lobehub/icons` (Phase 128 `providerLogo.tsx`); phase-type icons = the shared 3D `PHASE_GLYPHS` map (one additive swap propagates to soul card/run/pub + 127 surfaces); decorative `fluent-emoji` slugs must be verified-or-bundled (the empty `direct-hit`→`bullseye` trap). Future Settings home: SEED-095. |

**Settings: provider picker & re-embed lifecycle (sketches 024–026, Phase 111.1):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Provider Picker & Re-embed | [references/settings-provider-picker-and-reembed.md](references/settings-provider-picker-and-reembed.md) | **024** ONE reusable preset picker + an ALWAYS-ON 🔒 endpoint footer (endpoint · dims · threshold · cloud/local) — never pick a model without seeing where it runs (BUG-260616-01 cure); local presets relax the key. **025** re-embed confirm = weight-not-friction modal (danger rail + 4-fact grid + two-step Confirm; NO type-to-confirm on reversible ops). **026** background re-embed = one rich Settings status card + a slim auto-hiding Documents-page pointer — never an app-wide banner. |

**Auto-classification (sketches 036–037, Phase 118):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Classification Suggestion & Rules | [references/auto-classification.md](references/auto-classification.md) | **036-A** "suggested ≠ moved" (never silent auto-move); deterministic rule match shows the rule, never a fake %; accept → move + audit, reversible; reads in the panel Classification section AND on the doc row. **037-A** rules on a dedicated surface (Documents rail → Automation): list + side-panel builder reusing the 029 chip strip + 031 `G` pill + a live "would match N" preview. |

**Governance health (sketches 038–040, Phase 119):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Governance Health Surface | [references/governance-health.md](references/governance-health.md) | **038/040-A** its OWN top-level read-only home (never a Library-Health tab, never in-rail): 3 `HealthPanel` signal cards + KPI strip; all-healthy = posture hero; the Documents rail stays pure. **039-A** inline verb rows (`Open links`/`Classify`/`Re-extract`) — the verb IS the diagnosis; the page writes NOTHING (verbs navigate to the canonical edit surfaces); counts re-fetch as rows resolve; `ConfidenceChip`, never retrieval-similarity. |

**Skill Trigger Tuner (sketches 041–045, Phases 123 + 123.1):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Trigger Tuner | [references/trigger-tuner.md](references/trigger-tuner.md) | **041-A** focused full-surface (384px panel too small) — later absorbed as Studio·Triggering (057). **042** pick by HELD-OUT, fires/no-false always visible, author-confirm → PATCH never auto-applied; ★ = the as-built D (N vertical rows — the fixed 4-up grid crammed at the real 7-8 roster, BUG-260624-01); scoreboards are N-column = configured targets, never fixed-four. **043-A** two-column should/should-NOT lists + 60/40 split + background run w/ honest per-provider progress. **044-A** warn-never-block lint in the shared service layer + "Tune this →" handoff + the builder-model knob (decoupled from targets). **045-B** pre-run editor = full-width stack; sketch density at REAL scale. |

**Workflow soul & two doors (sketches 046–047, Phase 124):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Soul Object & Strict↔Loose | [references/workflow-soul-and-two-doors.md](references/workflow-soul-and-two-doors.md) | **046-A** the soul = 5 purpose-led atoms (`business_requirement` hero · needs · glyph-dot spine · derived tier chip · deliverable), ONE scale-keyed `<WorkflowSoul>` across card/run/pub. **047-A** explicit two-door fork (Describe & run vs Author & govern); tier recomputes LIVE; judge LOCKED always-on; nothing lost by picking the fast door. |

**Cross-provider chat polish (sketches 048–050, Phase 128):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Cross-Provider Chat Polish | [references/cross-provider-chat-polish.md](references/cross-provider-chat-polish.md) | **048-A** provider-logo card header (single-source `@lobehub/icons`) + the "about to…" preparing description + ONE byte-identical layout on all 8 providers. **049-A** delete the redundant sticky composer timer — exactly TWO status homes (header strip + floating chip); imperceptible variant deltas don't ship. **050-A** long USER prompts clamp to 7 lines + gradient-matched fade + inline Read more; user bubbles only. |

**Skill Studio (sketches 053–057, Phase 137):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Skill Studio | [references/skill-studio.md](references/skill-studio.md) | **053-A + 057-A** ONE focused Studio: persistent header (name+vN+LIVE+gate strip on every tab) over Evals · Triggering · Versions; Tuner absorbed as Triggering; detail panel slims to form + gate line + "Open studio"; tabs deep-linkable. **054-B** lifecycle stepper (Cases→Eval→Gate→Published, counts ON nodes, only the current stage narrates; gate strip = a condensation of the same server `PublishGate`). **055-B** expandable run rows (side-by-side arms; `not_measured` excluded-never-failed; ratings distinct from verdicts) — the base grammar 137.1's matrix extends. **056-B** version table + any-to-any compare; provenance chips; NO Restore (immutable). |

**Operator Control Room — shell, receipts & linkage (sketches 061, 062, 066, Phases 146–147):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Control-Room Shell & Receipts | [references/control-room-shell-and-receipts.md](references/control-room-shell-and-receipts.md) | **061-B** amber operator band + horizontal tabs (never a second rail), honest locks without roadmap numbers, plain-first + ⌥ Technical names, non-discoverable 404. **062-A** the always-on ledger IS the receipt (✎ write mark, plain sentences, consequence ≠ receipt, no toasts). **066** the linkage contract: band-tab IA, 15 button→destinations, 7 consistency guards, graded action-guards by shape. |

**Control Plane — health, active runs & controls (sketches 063–065, Phase 147):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Control Plane Live Surface | [references/control-plane-live-surface.md](references/control-plane-live-surface.md) | **063-B** pinned vitals (can go amber/red mid-scroll) + Health→Runs→Controls→Activity scroll; honest degrade keeps last-known values. **064-B** run cards + the victim-naming Kill confirm sheet; Cancelling…→✎ Cancelled·recorded; stuck = *recovered*. **065-A** 2×2 kill-switch grid (OFF looks armed; honest impact counts only) + spatially-separated amber maintenance panel with arm-to-confirm. |

**Governance — audit browser, users & feature visibility (sketches 067–069, Phase 148):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Governance Surfaces | [references/governance-audit-users-visibility.md](references/governance-audit-users-visibility.md) | **067-A** one audit browser, BOTH ledgers (source switch), chip filters + paged table, CSV names its count + is itself recorded, `audit.view_platform` makes cross-user reads visible. **068-A** instrument-table roster: last-active honesty, victim-naming Disable / direct Enable, lockout-proof self-rows, flagged operator grant. **069-A** audience rows on Users & Access (*Everyone \| ⛨ Operators only*), API-enforced via `require_visible`, extensible-audience (never-boolean) contract → v3.4 roles/departments (SEED-115). |

**Eval production-clean (sketches 058–060, Phase 137.1):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Matrix, Progress & Engine Health | [references/eval-production-clean.md](references/eval-production-clean.md) | **058-A** matrix = ONE grouped card of 055-B sub-rows (history never floods); one "▣ feeds gate" chip; footer = history-derived mean±stddev (≥2 runs) + Δ lift + deterministic tagged analyst notes; one-click all-configured launcher. **059-A** thin determinate unit bar (cases × 2 + judge; scales to any case count) + per-arm durations as they land + inline violet "◇" advisory `case_feedback` (never a verdict). **060-A** Settings engine-health tile board (✓/✗ per provider, staleness always shown, ✗ = verbatim provider error; ENGINE ≠ model quality) + the judge knob on the 024-A picker with a registry-only list + effective-default 🔒 footer. |

**Model Registry & Discovery (sketches 070–071, Phase 149):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Model Registry & Discovery | [references/model-registry-and-discovery.md](references/model-registry-and-discovery.md) | **070-A** registry editor = provider-grouped instrument table + inline-edit over the REAL mig-053 columns (068-A roster lineage); the `enabled`→`✓ in picker / ✕ hidden` coupling chip + 🔓/🔒 lock (the SEED-116 two-layer pattern's operator half); OVR-vs-DEF honesty + Reset; schema gaps flagged (`?`), never faked. **071-A** discovery = per-provider live cards (stable-ts, verbatim-error-excluded-not-failed) → ✚New/±Changed/⊘Vanished groups; **propose-only is the hero (SC#3)** — IDs-only providers yield amber "unknown — you set it" inputs, a new model is NEVER auto-enabled; vanished ≠ deleted; every write → 062-A ledger (`model.capability.set` / `model.discover`). |

**Workflow Run Inputs & Safe Delete (sketches 072–073, Phase 152):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Workflow Run Inputs & Safe Delete | [references/workflow-run-inputs-and-delete.md](references/workflow-run-inputs-and-delete.md) | **072-A** run inputs fold into the LIVE 560px `RunModal` inline-grows (read-only chip → inline `<select>` + quiet `TemplateUpload` button) — the SEED-112 scope shape = a per-run OVERRIDE over the author default, **narrow-only + server-enforced (Phase-098), model can't widen**; `template_input` provenance = honest "stored untrusted / never Jinja-fed" note. **073-A** delete = victim-naming confirm sheet (the 064/068 pattern): **Permanently removed** (definition · versions · run records) vs **Kept — not touched** (chat threads become normal chats — the WFIN-03 no-orphans reassurance); in-flight = cancel-then-delete via the heal path; ✎ recorded. |

**Inline Citations (sketches 074–075, Phase 153):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Inline Citations | [references/inline-citations.md](references/inline-citations.md) | **074-A** marker = superscript numeral chip, **per-claim sparing** (framing prose flows unmarked → absence-as-signal); **attach-on-settle**, never speculative mid-token; absence taught by an ⓘ, never a banner. **075-A** click-through = hover-peek → click-to-pin popover (Perplexity/Claude.ai-cited feel) as the quick path; today's unnumbered `CitationList` restructured into a **numbered `[n]` References footer keyed 1:1 to the markers**, open-by-default, bidirectional. The binding is **set-membership-safe** (marker `n` = `citations[n]` by construction — no re-ask, read-only). G-5 `MessageItem.tsx`; provider-uniform (SC#10). |

**Chat History & Nav Rail (sketches 076–078, Phase 156):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Chat History & Nav Rail | [references/chat-history-and-nav.md](references/chat-history-and-nav.md) | **076-B** the collapsed 64px rail keeps New Chat (+) **and** Search (⌕) reachable (icon+tooltip; Search click → expand + focus) — the Anchor-1 fix. **078-D (pivot synthesis)** organizing the list inside a growing sidebar can't win — nav + history compete for one column — so **nav → a permanent 58px icon rail** (growth decoupled forever), **history → a full-height column** with an inline filter (077's search + Today/Yesterday/7d/30d/Older grouping, pure-frontend from `Thread.updated_at`/`folder_id`), **+ ⌘K global finder** (the column filters what you see; ⌘K jumps anywhere). The rail must never re-absorb the history list. |

**Org-Admin Shell & Identity (sketches 079–080, Phase 166):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Org-Admin Shell & Identity | [references/org-admin-and-identity.md](references/org-admin-and-identity.md) | **079-C** hybrid: identity + org-scoped role badge (`◆ Org-admin` / `Member`) + the org switcher (renders **only at 2+ orgs**, solo = quiet name button) in ONE merged rail-footer menu, **but org-admin is a rail Shield-mirror parallel to the operator amber shield** (SEED-113's user-side mirror, in indigo); admin entry **honestly vanishes** for a member; switch teardown preserves the 067.5 clear-guard. **080-A** the 7-tab shell = **org-indigo** 061-B band+tabs (**amber stays operator-only**), 3 live (Members read-only · Audit · Settings) + 4 honest locked "coming soon" tabs (no roadmap numbers); audit degrades **RLS-honest** ("you see only your own"), never silent-empty. |

**Run-State & Lifecycle Honesty (sketches 129–130, Phase 174):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Run-State & Lifecycle Honesty | [references/run-state-honesty.md](references/run-state-honesty.md) | **129-C** the terminal vocabulary = a tier ladder keyed off persisted `runs.status`, loudness earned by severity: **dim** for user-chosen (Stopped · "Cancelled — no output yet" replacing the empty bubble) → **amber** for an admin block (kill-switch refusal reason) → **red framed** only for a genuine failure; every marker derived from durable state so it **survives reload** (STATE-01/02). **130-C** the shipped run-card **header** carries a live pre-answer sub-state (Reasoning / Writing execute_code / Spinning up sandbox — counting `reasoning_delta`/`tool_args_progress` as activity, replacing the dead "Setting up agent…"), a timer **anchored to `started_at`** (not mount), and a **single avatar** — fixing STATE-03 + STATE-04 in one instrument. Render layer over state + already-emitted wire events; Deep byte-identical (D-14). G-5: `MessageItem`/`StreamsProvider`/`useMessages`. |

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
- [sources/029-filter-builder-bar/](sources/029-filter-builder-bar/) — winner: A (inline chip-strip filter/view builder; live count; Save-as-view)
- [sources/030-operator-and-relative-date-control/](sources/030-operator-and-relative-date-control/) — winner: A (operator-encodes-direction relative-date control; live resolved-window)
- [sources/031-views-sidebar-group/](sources/031-views-sidebar-group/) — winner: A (Views group; shared NavRow parity; honest saved-filters)
- [sources/032-documents-page-full-composition/](sources/032-documents-page-full-composition/) — winner: A (sidebar→rail user-pinnable; shared-shell layout; mobile)
- [sources/033-foldertree-navrow-polish/](sources/033-foldertree-navrow-polish/) — winner: A (unified Folders+Views NavRow; Before/After of today's tree)
- [sources/034-relationship-section/](sources/034-relationship-section/) — winner: A (chip-led grouped-by-direction relationships accordion; masked no-access row; State strip cycles populated/empty/loading/error)
- [sources/035-link-target-picker/](sources/035-link-target-picker/) — winner: A (dialog · type-first create-link picker; MoveToFolderDialog shell + searchable typeahead; per-type exclusion; simulate-failure error line)
- [sources/051-gauntlet-pip-strip/](sources/051-gauntlet-pip-strip/) — winner: A (energized gauntlet energy-spine + worded verdict + raw-on-demand; under the 124 pub soul; lifecycle + Calm⇄Energized cyclers)
- [sources/052-living-step-flow/](sources/052-living-step-flow/) — winner: A (quiet-idle / alive-active living step-flow; vertical energy comet into the active step; AI-engine chip; under the 124 run soul)
- [sources/024-embedding-provider-picker/](sources/024-embedding-provider-picker/) — winner: Synthesis (A preset select + C's always-on 🔒 endpoint footer)
- [sources/025-reembed-confirm-gate/](sources/025-reembed-confirm-gate/) — winner: Synthesis (C weight-frame + A's 4-fact grid; B checklist = documented fallback)
- [sources/026-reembed-in-progress/](sources/026-reembed-in-progress/) — winner: Synthesis (C status card home + slim search pointer)
- [sources/036-classification-suggestion/](sources/036-classification-suggestion/) — winner: A (suggested-not-moved on the doc row + panel section; rule provenance, no fake %)
- [sources/037-rule-builder-and-list/](sources/037-rule-builder-and-list/) — winner: A (rules list + side-panel builder; chip-strip conditions; live would-match count)
- [sources/038-governance-health-surface/](sources/038-governance-health-surface/) — winner: A (card-grid, own top-level home; posture-hero graft)
- [sources/039-signal-row-and-fix-action/](sources/039-signal-row-and-fix-action/) — winner: A (inline verb buttons + mask-gated expand graft; B route-to-panel = strong alt)
- [sources/040-documents-sidebar-composition/](sources/040-documents-sidebar-composition/) — winner: A (governance top-level, rail stays pure; collapsible headers = density fallback)
- [sources/041-tuner-surface-shell/](sources/041-tuner-surface-shell/) — winner: A (focused full-surface; later absorbed as Studio·Triggering)
- [sources/042-scoreboard-and-candidates/](sources/042-scoreboard-and-candidates/) — winner: D (as-built vertical rows; A = original data-model record, superseded at 123.1)
- [sources/043-case-editor-and-live-run/](sources/043-case-editor-and-live-run/) — winner: A (two-column should/should-NOT + 60/40 split bar + background-run live card)
- [sources/044-lint-warning-and-handoff/](sources/044-lint-warning-and-handoff/) — winner: A (inline-under-Description never-block lint + "Tune this →" + builder-model knob)
- [sources/045-tuner-prerun-editor-at-scale/](sources/045-tuner-prerun-editor-at-scale/) — winner: B (full-width stack pre-run; scale/cap toolbar demonstrates the real-scale lesson)
- [sources/046-workflow-soul-object/](sources/046-workflow-soul-object/) — winner: A (purpose-led 5-atom soul at 3 scales)
- [sources/047-strict-loose-two-doors/](sources/047-strict-loose-two-doors/) — winner: A (explicit two-door fork; live deriveTier recompute; locked judge)
- [sources/048-cross-provider-tool-card/](sources/048-cross-provider-tool-card/) — winner: A (real brand marks + preparing description; incl. logos/ assets)
- [sources/049-chat-area-reclaim/](sources/049-chat-area-reclaim/) — winner: A (clean removal of the sticky composer timer; B rejected as imperceptible)
- [sources/050-long-prompt-readmore/](sources/050-long-prompt-readmore/) — winner: A (7-line clamp + gradient-matched fade + inline Read more)
- [sources/053-eval-studio-shell/](sources/053-eval-studio-shell/) — winner: A (focused full-surface Studio shell)
- [sources/054-one-truth-status/](sources/054-one-truth-status/) — winner: B (lifecycle stepper Cases→Eval→Gate→Published)
- [sources/055-run-history-and-detail/](sources/055-run-history-and-detail/) — winner: B (expandable run rows; the base grammar 137.1's matrix extends)
- [sources/056-version-history-and-diff/](sources/056-version-history-and-diff/) — winner: B (version table + any-to-any compare picker)
- [sources/057-skill-studio-linkage/](sources/057-skill-studio-linkage/) — winner: A (persistent header + 3 tabs; the every-button→destination nav map)
- [sources/058-matrix-launch-and-rows/](sources/058-matrix-launch-and-rows/) — winner: A (grouped matrix card; gate-feeder chip; history aggregation + analyst notes; live sim)
- [sources/059-determinate-progress-and-case-feedback/](sources/059-determinate-progress-and-case-feedback/) — winner: A (thin determinate unit bar + per-arm durations + inline violet case feedback; live sim)
- [sources/060-engine-health-card/](sources/060-engine-health-card/) — winner: A (engine-health tile board + judge-model knob; sweep sim)
- [sources/061-control-room-shell/](sources/061-control-room-shell/) — winner: B (operator band + tabs, plain-language-first; "Viewing as → Regular user" demonstrates the 404 contract)
- [sources/062-gate-honesty-and-receipts/](sources/062-gate-honesty-and-receipts/) — winner: A (always-on ledger receipt; ✎ write mark; consequence banner)
- [sources/063-control-plane-composition-and-health/](sources/063-control-plane-composition-and-health/) — winner: B (pinned vitals + sectioned scroll; 'One slow / One down' degrade preview)
- [sources/064-active-runs-and-kill/](sources/064-active-runs-and-kill/) — winner: B (run cards + victim-naming confirm sheet; incl. provider logo SVGs; A arm-inline / C press-and-hold preserved)
- [sources/065-system-controls-and-maintenance/](sources/065-system-controls-and-maintenance/) — winner: A (capability card grid + separated amber maintenance panel)
- [sources/066-control-plane-assembled-and-linkage/](sources/066-control-plane-assembled-and-linkage/) — reference (assembled surface + link-map toggle + the 15-row button→destination contract)
- [sources/067-audit-browser/](sources/067-audit-browser/) — winner: A (chip filters + paged table; both-ledger source switch; recorded CSV export; B feed / C query-rail preserved)
- [sources/068-users-and-access/](sources/068-users-and-access/) — winner: A (instrument-table roster; victim-naming disable; flagged operator grant; B expandable / C detail-panel preserved)
- [sources/069-feature-visibility/](sources/069-feature-visibility/) — winner: A (audience rows; B live end-user preview = documented enhancement; C in-Controls foil = the rejected placement)
- [sources/070-model-capability-editor/](sources/070-model-capability-editor/) — winner: A (instrument table + inline edit; enabled→picker coupling chip + lock; OVR-vs-DEF honesty)
- [sources/071-model-discovery-propose-confirm/](sources/071-model-discovery-propose-confirm/) — winner: A (grouped new/changed/vanished diff; propose-only "unknown — you set it" hero; verbatim provider error)
- [sources/072-run-inputs-modal/](sources/072-run-inputs-modal/) — winner: A (inline-grows chip→select + quiet upload; bounded per-run scope override; B 3-way toggle = SEED-112 alt)
- [sources/073-workflow-delete-cascade/](sources/073-workflow-delete-cascade/) — winner: A (victim-naming sheet: removed vs kept · threads→normal chats; B type-to-confirm / C archive preserved)
- [sources/074-inline-citation-marker/](sources/074-inline-citation-marker/) — winner: A (superscript numeral chip, attach-on-settle; absence-as-signal; ▶ replay-the-stream demo)
- [sources/075-citation-clickthrough/](sources/075-citation-clickthrough/) — winner: A (hover-peek → click-to-pin + numbered References footer; B scroll+flash / C panel preserved)
- [sources/076-collapsed-nav-rail/](sources/076-collapsed-nav-rail/) — winner: B (New Chat + Search rail; per-frame Proposed⇄Today-broken toggle)
- [sources/077-thread-list-organization/](sources/077-thread-list-organization/) — reframed by 078 (no winner; its search + date/folder grouping = 078's column content)
- [sources/078-chat-history-home/](sources/078-chat-history-home/) — winner: D (synthesis: permanent 58px icon rail + history column + ⌘K; renders the whole app frame)
- [sources/079-identity-anchor-and-org-switcher/](sources/079-identity-anchor-and-org-switcher/) — winner: C (hybrid merged menu + org-admin rail Shield-mirror; Solo⇄Multi + Member⇄Org-admin controls)
- [sources/080-org-admin-shell/](sources/080-org-admin-shell/) — winner: A (org-indigo band+tabs, 3 live + 4 locked; RLS-honest audit degrade; Plain⇄⌥Technical toggle)
- [sources/129-terminal-run-states/](sources/129-terminal-run-states/) — winner: C (tiered dim/amber/red terminal vocabulary off runs.status; Today-broken + Reload sims)
- [sources/130-live-preparing-honesty/](sources/130-live-preparing-honesty/) — winner: C (run-header live sub-state + anchored timer + single avatar; live clock, Nav-away-and-back sim)

**Phase 094 grounding** — [sources/094-grounding/](sources/094-grounding/) holds `BRIEF.md` (real harness SSE events + the "wire-only / dropped by `api.ts`" analysis) and `DATA-CONTRACT.md` (the event/wire data contract + the real-vs-invented field boundary). Read these for exact event names and which fields actually exist before wiring any 008–013 surface.

**Phase 095 grounding** — [sources/095-grounding/](sources/095-grounding/) holds `GROUNDING.md` (the real Deep SSE event vocabulary, the 24-tool set with literal resting-essence strings, the current-render "before", and the three bug clusters with their root mechanisms) and `CONSISTENCY.md` (the build-once component inventory + the 13-drift cross-sketch audit). Read both before wiring real event names or building any of the 014–016 surfaces.

**Phase 185 — Graded Governance (sketches 142–146, 2026-07-28):**

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Graded Governance | [references/graded-governance.md](references/graded-governance.md) | Grounding is **DETECTED and ONE-WAY** — a step that reads the KB locks itself to *must prove it*; an open step can be escalated; a locked step can never be loosened, **no exceptions** (the exploratory-read case splits into two steps, never a third state). The precise rule: **you can only undo a lock you created** (detected / already-set = no switch exists; escalated = yours to undo, until detection takes over). Detection is a NAMED tool list, never a judgement call. **142-B** the dial is a real switch whose loose side is struck through and prints its reason as real DOM text (`aria-describedby`, never a `title`); absent — not disabled — where it could never do anything. The tool list IS the dial. **143-A** the canvas mark is a **sealed edge + corner seal**, made of SHAPE not colour (137-B banked all colour for 188; both badge slots are committed) — and **the corner seal is LOAD-BEARING**: run status overwrites the border, so the seal is the only carrier left mid-run, may never be conditional on run state, and **claims top-right of the card**. Vocabulary is binding: **"must prove it"** on the canvas (never *proven* — nothing is proven until a gate passes), *free to think*, *nothing to prove here*. |
| Canvas Frame & Node Anatomy | [references/canvas-frame-and-node-anatomy.md](references/canvas-frame-and-node-anatomy.md) | **137-B “Glass Depth” IS the canvas visual language** (operator changed D→B 2026-07-26): the 3D mark floats above a narrower centre-aligned frosted panel, and there is **no per-step-type colour at all** — type colour is a tint behind the ICON ONLY, because Phase 188 needs the strong colours for run status. Sketches 134/135 have `winner: null` deliberately (look superseded by 137; their *structural* inventories stand). **The shipped card is 137-B — `themes/canvas-184.css` is the older 137-D and would draw a card that no longer exists; always read the SOURCE, and note that since Phase 188.2 the source is a SIX-FILE SUBTREE, not one file.** ⚠ Re-measured 2026-08-07: this row used to say *always read `PhaseNodeCard.tsx`*, and **all four of the geometry facts it introduces have left that file** — 188.2 cut the card 797 → 274 L into five sibling modules. Per-fact pointers, each grepped rather than recalled: **260×104 node box** → `canvasModel.ts:65` `NODE_WIDTH: 260` and `:70` `NODE_MIN_HEIGHT: 104` (unchanged); **248px card / radius 22 / padding 42-20-20** → still in the card, `PhaseNodeCard.tsx:176` `"mx-auto block w-[248px] rounded-[22px] border pb-5 pt-[42px] px-5 text-center"`; **mark 62×62 at `top:-26px`** → `NodeIconWell.tsx:145` `"pointer-events-none absolute left-1/2 top-[-26px] grid h-[62px] w-[62px] -translate-x-1/2 place-items-center"`; **seal `top 11 right 17`** → `NodeCornerMarks.tsx:261` `"pointer-events-none absolute right-[17px] top-[11px] z-[6] grid h-[21px] w-[21px]"`; **verdict `-left-2 top-1.5`** → `NodeCornerMarks.tsx:204` `"pointer-events-none absolute -left-2 top-1.5 z-[8] grid h-[22px] w-[22px]"`. The **no-clipping** rule is a whole-subtree constraint and is stated once, at `NodeIconWell.tsx:142` — *"the node wrapper around it — may ever take `overflow-hidden`"* — where a `?raw` count fence pins it at exactly one mention across the subtree, so do not re-word, paraphrase or duplicate that sentence. Flow is **horizontal left→right (136-B)**, linear `i→i+1` + dashed `skip_to_phase` only — **no `depends_on`, no parallel lanes**; the canvas is a projection of a LINEAR spine, not a free DAG. Badge budget: max-2 TUPLE (a third is a typecheck error), slot 1 empty and reserved for 188/189, slot 2 `Waits for you` word-only. **No focusable control inside the card** — one tab stop per node. |
| Canvas Editing & Authoring | [references/canvas-editing-and-authoring.md](references/canvas-editing-and-authoring.md) | **Order is the SPINE and cannot be rewired** (138 C-local); the free nudge is a per-user BROWSER preference — browser-persisted, **zero migration** — so cosmetic movement never writes the definition. Validation = **mark on the node + problems tray** (139-A) with the **INCOMPLETE ≠ ERROR** severity split: half-built is not wrong. *Any verdict surface must fail CLOSED — an unrecognised state is not a pass* (the `findIndex → -1` fail-open that painted an unknown blocked stage 8/8 green). The step inspector **EXTENDS the shipped 400px `PhaseFormPanel`** (140-A), never a new surface, and governance renders as rails you can see but cannot wire around — **the panel is where you SET, the canvas is where you SEE**; the next surface that needs the panel gets its OWN component and one gated line. Chrome = **canvas toolbar + page header** (141-B) with `zundo` undo/redo and **autosave honesty: “saved” ≠ “published”** — autosave writes in place and must never mint a version or re-arm the gauntlet. Traps: xyflow controlled-nodes blink (echo `dimensions` back); the live ESM cycle (`WorkflowCanvas` imports `FlowEdge`'s value at module scope). |
| Node Vocabulary & the ⌥ Reveal | [references/node-vocabulary-and-reveal.md](references/node-vocabulary-and-reveal.md) | **Audit first — most of VOCAB-01 already shipped:** the plain-language sentences (Phase 183, `phaseVocabulary.ts:127`) AND the Technical-names reveal (Phase 154 `TechnicalNamesProvider`, already wired to the canvas toolbar `WorkflowCanvas.tsx:1285` and to BOTH graph views). What was missing is **specificity**: only **10 of 119** phases carry a `phase.name` and the NL generator authors a definition-level name ONLY (`workflow_authoring.py:88`), so **every AI-seeded workflow renders the same six type sentences** — SC#5's “toy demo” failure landing on VOCAB-02's headline feature. **148-C: the node face is a LAYERED ladder** — author name → config-derived → type sentence, computed at render, never stored. Decided on three criteria: A (stored AI names) fails *survives a config edit*; B (config-only) fails *keeps author names* — it removes the tier already shipped; C passes all three and is additive. **A and C are NOT rivals** — A governs what the generator WRITES, C what the card SHOWS; A fills C's top tier. **149-C: the reveal swaps the SUBTITLE, not the title** — the shipped title swap destroys the now-meaningful plain title AND **truncates, clipping the slug** (the one token the reveal exists to show); B would spend `technicalLine`, which `PhaseNode.tsx:183` reserves for **Phase 188**. |
| AI Seed & Templates | [references/ai-seed-and-templates.md](references/ai-seed-and-templates.md) | **Generation is SINGLE-SHOT, not streamed** (`workflow_authoring.py:217` — exactly one provider call, never a partial), so **a node-by-node reveal is PACING, NOT PROGRESS** and must never read as the AI still deciding. **150-B: the canvas arrives all at once + a SEED RECEIPT** naming what was locked and why — the ONLY variant that discharges SC#3, because safe-by-construction is invisible by construction: steps arrive carrying a ⛨ seal the user never asked for and nothing else ever explains it. The receipt is per-step with its cause, states the one-way rule plainly, is dismissible, and ends by saying nothing is saved or published. The three variants answer DIFFERENT questions (*where do I start · why is it locked · what have I reviewed*) and none answers all three — **150-C is DEFERRED, not rejected**: it owes a placement (its ✦ sits on the verdict mark's coordinates) and a meaning at publish, and its ✦/✓ are **net-new glyphs**. **151-C: the template SEEDS THE DESCRIBE BOX** — there are exactly THREE curated starters (mig 094) so a gallery is over-built, and the deciding axis is **path count, not clutter**: A and B both create a SECOND forward path (template→canvas, skipping generation) while C keeps one (always describe→draft). C's cost — it discards the curated definition and re-derives from a sentence — is why the direct fork stays on the **Workflows page** per the three-homes contract (#19). |
| Approval & Review | [references/approval-and-review.md](references/approval-and-review.md) | **⚠ Two engine truths first:** (1) `_exec_llm_human_input` **times out at 300s (cap 1800) and returns normally**, so the run ADVANCES — an action-risk gate must reuse the substrate but **fail closed**; (2) `FilePreview` renders md/text/code/csv/images but **DOCX/PPTX/XLSX/PDF are download-only**, and `render_template` produces **.docx** — so the flagship deliverable is the one artefact a reviewer cannot see (**deferred with a trigger**: decide at spec-phase 185, re-open unconditionally at 190). **144** the stop sign is a gate ON the risky step, never an extra step; the unarmed outbound step on screen argues **armed-on by default** (= 189 SC#2). **145-A** the document IS the surface — approve bar docked to it, so decision and evidence are one object; marks go INSIDE the document (source chips + an explicit **"AI judgement"** on assessments); `check_coverage` coverage line; approve-blind must LOOK different and be **recorded as "approved without a preview"**. **146-A** **one place** — the canvas you built on is the canvas you watch, a pause grows the document over it, approving returns you to the running flow. Both are drawn on a **dedicated run surface (no message list, no composer)** — a proposal to **Phase 188**, since `WorkflowsPage` today launches by redirecting into Chat. Failure modes owned: closed tab (durable, but the clock does not stop), second approver (**Phase 186's run-time twin**), failure-after-approval (approval never looks undone; a retry must not re-send). |

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

**Virtual Folders — filter/view builder, saved Views, NavRow & layout (sketches 029–033, Phase 114) — load when:**

- Building the inline metadata filter/view builder on the Documents page — the chip strip, the type-aware operator menu, the relative-date control, the live count, Save-as-view (`references/virtual-folder-filter-builder.md`)
- Building or refactoring the saved-Views sidebar group, or polishing the folder tree — the shared `NavRow` for `FolderNode.tsx`/`FolderTree.tsx`, per-folder/view count badges, the labeled `G` pill, the "Move to folder" row action (`references/saved-views-and-left-nav.md`)
- Composing the Documents page with the filter bar + sidebar + the Phase-112 detail panel open — the sidebar→rail collapse, the shared-shell layout inherited by 117/118, mobile (`references/documents-page-composition.md`)
- Touching the Phase 113/114 view-filter compiler or resolve route from the UI side — the count-only mode, the case-insensitive query-value lowercasing, the WHERE-fragment output contract
- Working on any phase tagged `document-management`, `virtual-folders`, `metadata-filter`, `views`, `sidebar`, `folder-tree`, or on Phase 114 (and the shared-shell layout for 117/118)

**Document Relationships — panel section & link picker (sketches 034–035, Phase 117) — load when:**

- Adding the `Relationships` accordion section to the existing `DocumentDetailPanel` — the chip-led grouped-by-direction list, the inverse-labeled incoming rows, the masked "no access" row, the keyboard/touch-reachable remove, where `+ Add link` sits (`references/document-relationships-panel.md`)
- Building the create-link target picker — the `MoveToFolderDialog` shell with its `Select` swapped for a searchable typeahead, the rel-type chips, the per-type self/already-linked exclusion, the live "references → X" preview, the honest error line, and the **net-new combobox a11y** (`role=combobox/listbox/option` + `aria-activedescendant`)
- Wiring the net-new `GET` relationships read seam — **extract the leak-safe traversal into a shared `document_relationship_service` and share it with the agent tool, never fork** (D-117-7); the `api.ts` read/create/delete client fns; re-fetch-not-optimistic mutation (no undo)
- Touching the `_INVERSE_LABEL` / `_NO_ACCESS_MASK` vocabulary from the UI side — mirror the backend maps verbatim, never invent wording
- Working on any phase tagged `document-relationships`, `detail-panel`, `accordion`, `typeahead`, `move-to-folder-dialog`, or on Phase 117 (the relationships section on the shared 112/118 detail shell)

**Settings model knobs & background jobs (sketches 024–026, Phase 111.1) — load when:**

- Building or extending ANY Settings model picker — embedding, extraction, judge, builder — reuse `ProviderPicker.tsx` + the always-on 🔒 endpoint footer, never a bare select (`references/settings-provider-picker-and-reembed.md`)
- Designing a serious confirm for a costly-but-reversible operation (the weight-not-friction modal), or the status surface for a long background job (rich home + whisper-where-felt)

**Auto-classification (sketches 036–037, Phase 118) — load when:**

- Building the Classification section of the detail panel, the doc-row suggestion chip, or the Classification-rules surface + builder (`references/auto-classification.md`)
- Touching CLASS-02 semantics (suggested ≠ moved) or rule-match provenance display

**Governance health (sketches 038–040, Phase 119) — load when:**

- Building or extending the Governance Health page, its signal cards, or the verb-button fix rows (`references/governance-health.md`)
- Tempted to add an in-rail governance entry or a Library-Health governance tab (both rejected forms), or to mutate from an aggregation page

**Trigger Tuner (sketches 041–045, Phases 123/123.1) — load when:**

- Working on the Studio Triggering tab (`SkillTunerPage` internals), the provider scoreboard, the benchmark case editor, or the save-time lint + "Tune this →" handoff (`references/trigger-tuner.md`)
- Building ANY per-provider score/health grid — the N-column = configured-targets rule and the fixed-grid cram lesson (BUG-260624-01) apply beyond the Tuner
- Sketching or building any list surface whose real-world item count is org-scale (the 045 real-scale lesson)

**Workflow soul & two doors (sketches 046–047, Phase 124) — load when:**

- Touching `<WorkflowSoul>`, `deriveTier`/`TIERS`, `PHASE_GLYPHS`, or the Builder's strict/loose entry fork (`references/workflow-soul-and-two-doors.md`)
- Adding any surface that names a workflow — it should render the soul atoms, not invent a new summary

**Cross-provider chat polish (sketches 048–050, Phase 128) — load when:**

- Touching the tool-card header/avatar, `providerLogo.tsx`, the preparing-window description, elapsed-status placement, or the user-bubble clamp (`references/cross-provider-chat-polish.md`)
- Adding ANY new provider mark or elapsed-time display anywhere in the app (two-homes rule; single-source logos)

**Skill Studio (sketches 053–057, Phase 137) — load when:**

- Building or refactoring the Studio shell/tabs (`EvalsTab`/`TriggeringTab`/`VersionsTab`), the `LifecycleStepper`, `RunBar`, `RunHistory`, `RunCaseDetail`, `VersionsTab` compare, or the `PublishGateDialog` seam (`references/skill-studio.md`)
- Touching publish-gate display anywhere (one-truth-teller: every gate surface condenses the same server `PublishGate`)
- Working on any phase tagged `skill-studio`, `evals`, `panel-01`, `gate-01`, `ver-01`, or extending the 055-B run-row grammar

**Eval production-clean (sketches 058–060, Phase 137.1) — load when:**

- Building matrix runs (launcher, group card, gate-feeder, aggregation, analyst notes), determinate run progress, per-arm durations, judge `case_feedback` rendering, the Settings engine-health card, or the judge-model knob (`references/eval-production-clean.md`)
- Working on any phase tagged `eval-05`, `matrix-runs`, `smoke-sweep`, or `engine-health`

**Operator Control Room (sketches 061–069, Phases 146–148) — load when:**

- Touching ANY `/admin` surface — the shell (`OperatorBand`, `ControlRoomPage`, band tabs, `LockedTab`, `TechnicalNamesToggle`), receipts (`RecentActionsCard`, the ledger, the recording marker), or adding a new admin tab/section (`references/control-room-shell-and-receipts.md` — includes the 066 linkage contract + the 7 consistency guards)
- Building or extending the Control Plane — `HealthSignals`, the pinned vitals, `ActiveRunsSection` + Kill, `CapabilityGrid`, `MaintenancePanel` (`references/control-plane-live-surface.md`)
- Building the Phase 148 governance surfaces — the audit browser (filters/pagination/CSV, both ledgers), the users roster (disable/enable, operator grant), the feature-visibility map + `require_visible` enforcement (`references/governance-audit-users-visibility.md` — the 148 build contract)
- Designing ANY destructive/administrative action ANYWHERE in the app — apply the graded-guard rule: target-specific-with-a-victim → victim-naming confirm sheet; global toggle → arm-to-confirm; reversible-no-victim → direct flip with a ✎ receipt
- Adding an operator audit action or receipt — inherit the 062-A vocabulary (plain sentence + ✎ write mark; the ledger is the receipt; polls never logged)
- Touching feature visibility or access-control storage — the extensible-audience contract (never booleans; one swappable resolver; SEED-115 / v3.4 org-RBAC)
- Working on any phase tagged `admin`, `operator`, `control-room`, `control-plane`, `kill-switches`, `audit`, `users`, `feature-visibility`, or on Phases 146/147/148 follow-ups (149 Model Registry / 150 Secrets inhabit the same shell)

**Graded Governance (sketches 142–143, Phase 185) — load when:**

- Adding or rendering a per-node **grounding mode** anywhere — the panel dial, the canvas mark, the auto-attached `citations_required` gate, or any "which steps must prove it" read (`references/graded-governance.md`)
- Touching `PhaseNode.tsx`'s face, the `PHASE_GLYPHS`/badge budget, or anything that wants **colour** or a **third badge** on a step card — both budgets are committed (137-B / Phase 188), and top-right is claimed by the governance seal
- Writing ANY refusal, lock or "you cannot change this" copy in the app — name the CAUSE, name what removing it COSTS, and put the reason in real DOM text (`aria-describedby`), never a `title`
- Writing governance vocabulary — **"must prove it"** on the canvas (never *proven*), *free to think*, *nothing to prove here*
- Working on any phase tagged `govern-01`, `govern-02`, `grounding-mode`, `detected-lock`, or `graded-governance`

**Approval & Review (sketches 144–146, Phase 185; feeds 186/188/190) — load when:**

- Building the **action-risk / approval checkpoint** (GOVERN-03) — read the fail-closed finding FIRST: `_exec_llm_human_input` times out at 300s and advances the run (`references/approval-and-review.md`)
- Building ANY surface where a person approves, confirms or releases something a workflow produced — the artefact must be visible, approve-blind must LOOK different and be recorded as such
- Rendering a workflow **deliverable** anywhere — know the preview matrix (md/text/code/csv/images render; **DOCX/PPTX/XLSX/PDF are download-only**, and `render_template` produces `.docx`)
- Building the **workflow run surface** or touching how a run relates to chat — Phase 188 should start from the dedicated-run-surface proposal (no message list, no composer); `WorkflowsPage` today launches by redirecting into Chat
- Building an external-action / connector node (Phases 189/190) — it arrives **armed-on** by default
- Any run-state wording — "running" and "waiting for you" may never share a word
- Working on any phase tagged `govern-03`, `action-risk`, `review-moment`, `run-surface`, `runviz-01`, `connectors`, or on Phases 186/188/189/190

**Model Registry & Discovery (sketches 070–071, Phase 149) — load when:**

- Building the Control Room Model Registry tab body — the instrument-table capability editor over `model_capabilities_overrides`, the `enabled`→picker coupling chip + lock, OVR-vs-DEF display, or the discovery propose-confirm flow (`references/model-registry-and-discovery.md`)
- Building ANY propose-only surface (never auto-apply a value the source didn't return — the SC#3 pattern) or a per-provider discovery/health run with verbatim-error-excluded-not-failed
- Working on any phase tagged `model-registry`, `discovery`, `model-01`, `model-02`, `two-layer`, or on Phase 149 (150 Secrets inhabits the same shell)

**Workflow Run Inputs & Safe Delete (sketches 072–073, Phase 152) — load when:**

- Extending the `RunModal` (`WorkflowsPage.tsx`) with run inputs — a template file upload or an editable KB-folder scope; the scope is a bounded per-run override, server-enforced, never a widen (`references/workflow-run-inputs-and-delete.md`)
- Building a delete/destructive-cascade confirm for a workflow (or anything with downstream victims) — the victim-naming removed-vs-kept sheet, threads-become-normal-chats, cancel-then-delete for in-flight
- Working on any phase tagged `run-inputs`, `wfin-01`/`02`/`03`, `template-upload`, `kb-scope`, `workflow-delete`, `cascade`, or on Phase 152

**Inline Citations (sketches 074–075, Phase 153) — load when:**

- Building per-claim inline citation markers, the streamed attach-on-settle behavior, absence-as-signal, the click-through popover, or the numbered `[n]` References footer (`references/inline-citations.md`)
- Touching the citation render in `MessageItem.tsx` / `MarkdownRenderer` (G-5) or `CitationList.tsx` — the marker `n` = `citations[n]` set-membership rule (never a post-hoc re-ask)
- Working on any phase tagged `inline-citations`, `cite-01`, `citation-footer`, `absence-as-signal`, or on Phase 153 (and SEED-119 cited-vs-retrieved superset footer → v3.5 Phase 178)

**Chat History & Nav Rail (sketches 076–078, Phase 156) — load when:**

- Building or refactoring the collapsed nav rail (New Chat + Search reachability), the permanent 58px icon rail, the dedicated chat-history column + its inline filter/date-grouping, or the ⌘K global finder (`references/chat-history-and-nav.md`)
- Tempted to organize the thread list inside a growing sidebar (the reframed dead-end) — decouple nav growth from history instead
- Working on any phase tagged `nav`, `chat-history`, `thread-list`, `command-palette`, `rail`, `polish-01`, `seed-045`, or on Phase 156 / the v3.5 Phase 178 chat-polish umbrella

**Org-Admin Shell & Identity (sketches 079–080, Phase 166) — load when:**

- Building the profile identity anchor / org switcher / role badge in the `NavPanel` rail footer, or the org-admin console (band+tabs, Members roster, org audit, Settings, locked tabs) — reuse the 061-B shell in **org-indigo**, amber stays operator-only (`references/org-admin-and-identity.md`)
- Applying tenancy-surface honesty: switcher only at 2+ orgs, admin entry vanishes for a member, audit degrades RLS-honest not silent-empty, `<OrgContext>` stays OUTSIDE the stream path (067.5 clear-guard)
- Working on any phase tagged `org-admin`, `org-switcher`, `tenancy`, `identity-anchor`, `admin-01`..`05`, `seed-113`, or on Phase 166 / the v3.5 Phase 177 org-surface polish (ORGUX-01/02)

**Run-State & Lifecycle Honesty (sketches 129–130, Phase 174) — load when:**

- Building the honest terminal-state vocabulary (Stopped / Cancelled-no-output / Blocked / Failed) keyed off persisted `runs.status`, the pre-answer live sub-state (replacing "Setting up agent…"), the anchored-from-`started_at` timer, or the single-avatar fix (`references/run-state-honesty.md`)
- Touching `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` / `threads.py` run-lifecycle to render a cancel/kill/failed state, an empty-bubble suppression, or a nav-back timer/avatar reconcile — a render layer over state, Deep byte-identical (D-14)
- Working on any phase tagged `run-state`, `lifecycle`, `state-01`..`04`, `cancelled`, `stopped`, `preparing`, `anchored-timer`, or on Phase 174 (the v3.5 run-state honesty foundation the later chat phases render on)

Skip when:

- Working on auth or other surfaces not listed above — note the skill now DOES cover Settings (model pickers, engine health, re-embed lifecycle) and the whole Skill Studio (evals, triggering, versions)
- Working on the plain document-library table ONLY — but note this skill DOES cover the Phase 112 detail panel (incl. the Phase 117 relationships section + create-link picker) AND the Phase 114 filter/view builder + saved-Views sidebar + folder-tree NavRow that now live on that surface
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

**Phase 114 — Virtual Folders: Filter/View Builder, Saved Views, NavRow & Layout (2026-06-19):**

- 029-filter-builder-bar (winner: A — inline chip-strip builder; live count; Save-as-view)
- 030-operator-and-relative-date-control (winner: A — operator-encodes-direction relative-date control)
- 031-views-sidebar-group (winner: A — Views group; shared NavRow parity)
- 032-documents-page-full-composition (winner: A — sidebar→rail user-pinnable; shared-shell layout)
- 033-foldertree-navrow-polish (winner: A — unified Folders+Views NavRow)

**Phase 117 — Document Relationships: Panel Section & Link Picker (2026-06-20):**

- 034-relationship-section (winner: A — chip-led grouped-by-direction relationships accordion; inverse incoming labels; masked no-access row; re-fetch-not-optimistic)
- 035-link-target-picker (winner: A — dialog · type-first create-link picker; MoveToFolderDialog shell + searchable typeahead; per-type exclusion; net-new combobox a11y)

**Phase 127 — Workflow Studio Energized Re-skin + Icon Convention (2026-06-27):**

- 051-gauntlet-pip-strip (winner: A — energized energy-spine + worded verdict + raw-on-demand; under the 124 pub soul)
- 052-living-step-flow (winner: A — quiet-idle / alive-active living step-flow; under the 124 run soul)

**Phase 111.1 — Settings Provider Picker & Re-embed Lifecycle (2026-06-16):**

- 024-embedding-provider-picker (winner: Synthesis — preset select + always-on 🔒 endpoint footer)
- 025-reembed-confirm-gate (winner: Synthesis — weight-frame + 4-fact grid)
- 026-reembed-in-progress (winner: Synthesis — status card home + slim search pointer)

**Phase 118 — Auto-Classification (2026-06-21):**

- 036-classification-suggestion (winner: A — suggested-not-moved, rule provenance, reversible accept)
- 037-rule-builder-and-list (winner: A — dedicated rules surface; list + side-panel builder)

**Phase 119 — Governance Health (2026-06-21):**

- 038-governance-health-surface (winner: A — card-grid, own top-level home)
- 039-signal-row-and-fix-action (winner: A — inline verb buttons + mask-gated expand)
- 040-documents-sidebar-composition (winner: A — governance top-level, rail stays pure)

**Phases 123 + 123.1 — Skill Trigger Tuner (2026-06-23/25):**

- 041-tuner-surface-shell (winner: A — focused full-surface; absorbed as Studio·Triggering at 057)
- 042-scoreboard-and-candidates (winner: D — as-built vertical rows; A superseded at 123.1)
- 043-case-editor-and-live-run (winner: A — two-column lists + split bar + background run)
- 044-lint-warning-and-handoff (winner: A — inline never-block lint + Tune-this handoff + builder knob)
- 045-tuner-prerun-editor-at-scale (winner: B — full-width stack; real-scale lesson)

**Phase 124 — Workflow Soul & Strict↔Loose (2026-06-26):**

- 046-workflow-soul-object (winner: A — purpose-led 5-atom soul at 3 scales)
- 047-strict-loose-two-doors (winner: A — explicit two-door fork; live tier recompute; locked judge)

**Phase 128 — Cross-Provider Chat Polish (2026-06-27):**

- 048-cross-provider-tool-card (winner: A — real brand marks + preparing description)
- 049-chat-area-reclaim (winner: A — clean removal of the sticky composer timer)
- 050-long-prompt-readmore (winner: A — 7-line clamp + fade + inline Read more)

**Phase 137 — Skill Studio (2026-07-03):**

- 053-eval-studio-shell (winner: A — focused full-surface Studio)
- 054-one-truth-status (winner: B — lifecycle stepper)
- 055-run-history-and-detail (winner: B — expandable rows)
- 056-version-history-and-diff (winner: B — table + compare picker)
- 057-skill-studio-linkage (winner: A — persistent header + 3 tabs; nav map)

**Phase 137.1 — Eval Production-Clean (2026-07-04):**

- 058-matrix-launch-and-rows (winner: A — grouped matrix card)
- 059-determinate-progress-and-case-feedback (winner: A — thin unit bar + inline feedback)
- 060-engine-health-card (winner: A — tile board + judge knob)

**Phase 146 — Operator Foundation (2026-07-10):**

- 061-control-room-shell (winner: B — operator band + tabs, plain-language-first)
- 062-gate-honesty-and-receipts (winner: A — always-on ledger)

**Phase 147 — Operator Control Plane (2026-07-11):**

- 063-control-plane-composition-and-health (winner: B — pinned health header)
- 064-active-runs-and-kill (winner: B — cards + victim-naming confirm sheet)
- 065-system-controls-and-maintenance (winner: A — card grid + separated maintenance)
- 066-control-plane-assembled-and-linkage (reference — assembled + linkage contract)

**Phase 148 — Governance (2026-07-11):**

- 067-audit-browser (winner: A — filter strip + paged table, both ledgers)
- 068-users-and-access (winner: A — instrument table + graded guards)
- 069-feature-visibility (winner: A — audience rows + extensible-audience contract)

**Phase 149 — Model Registry & Discovery (2026-07-12):**

- 070-model-capability-editor (winner: A — instrument table + inline edit; the enabled→picker two-layer coupling + lock)
- 071-model-discovery-propose-confirm (winner: A — grouped new/changed/vanished diff; propose-only "you set it" hero, never auto-enable)

**Phase 152 — Workflow Run Inputs & Safe Delete (2026-07-14):**

- 072-run-inputs-modal (winner: A — inline-grows: chip→`<select>` + quiet upload; bounded per-run scope override)
- 073-workflow-delete-cascade (winner: A — victim-naming confirm sheet; threads become normal chats)

**Phase 153 — Inline Citations (2026-07-15):**

- 074-inline-citation-marker (winner: A — superscript numeral chip, attach-on-settle; absence-as-signal)
- 075-citation-clickthrough (winner: A — hover-peek → click-to-pin + numbered References footer)

**Phase 156 — Chat History & Nav Rail (2026-07-16):**

- 076-collapsed-nav-rail (winner: B — New Chat + Search rail, icon+tooltip)
- 077-thread-list-organization (reframed by 078, no winner — its search/date/folder grouping is 078's column content)
- 078-chat-history-home (winner: D — synthesis: permanent 58px icon rail + full-height history column + ⌘K)

**Phase 166 — Org-Admin Shell & Identity (2026-07-21):**

- 079-identity-anchor-and-org-switcher (winner: C — hybrid merged identity+switcher menu + org-admin rail Shield-mirror)
- 080-org-admin-shell (winner: A — org-indigo band+tabs; 3 live + 4 honest locked; RLS-honest audit)

**Phase 174 — Run-State & Lifecycle Honesty (2026-07-22):**

- 129-terminal-run-states (winner: C — tiered dim/amber/red terminal vocabulary keyed off persisted `runs.status`)
- 130-live-preparing-honesty (winner: C — run-header carries the live sub-state + anchored timer + single avatar)

**Phase 185 — Graded Governance (2026-07-28):**

- 142-grounding-dial-and-lock (winner: B — a switch that visibly refuses; the rule = you can only undo a lock you created)
- 143-proven-on-the-canvas (winner: A — sealed edge + corner seal; the corner seal is load-bearing, top-right is claimed)
- 144-the-approval-stop-sign (no winner locked — superseded by 145/146; its armed-on-by-default finding stands)
- 145-the-review-moment (winner: A — the document is the surface, approve bar docked to it)
- 146-the-round-trip (winner: A — one place; the canvas you built on is the canvas you watch)

- 134-canvas-frame-and-read-only (no winner locked — look superseded by 137; structural frame inventory stands)
- 135-phase-node-anatomy (no winner locked — look superseded by 137; node contents inventory stands)
- 136-flow-shape-and-branches (winner: B — horizontal left→right; topology findings stand)
- 137-agentic-canvas-look (winner: B — Glass Depth; operator changed D→B 2026-07-26)
- 138-growing-the-flow (winner: C-local — spine + browser-persisted nudge, zero migration)
- 139-validation-while-building (winner: A — mark on the node + problems tray)
- 140-step-inspector-and-rails (winner: A — extend the shipped 400px PhaseFormPanel)
- 141-the-authoring-session (winner: B — canvas toolbar + page header)
- 147-the-armed-mark (winner: B — the detour edge; + the card occupancy audit)
- 148-the-step-that-says-what-it-does (winner: C — the layered node-face ladder)
- 149-what-the-reveal-costs (winner: C — the reveal swaps the subtitle, not the title)
- 150-the-seeded-canvas-arrives (winner: B — all at once + the seed receipt)
- 151-a-door-beside-the-describe-box (winner: C — the template seeds the describe box)

Excluded: 017-cross-thread-run-stop and 098-tool-card-live-essence (orphans — no README, no locked
winner). NOT sketches, never candidates: 094-grounding, 103-grounding, 128-grounding (grounding /
brief folders — BRIEF.md, DATA-CONTRACT.md; no variants). Deferred: 131-133 (v3.4 org surfaces —
shipped and unrelated to the canvas; wrap when org work next moves).
</metadata>
