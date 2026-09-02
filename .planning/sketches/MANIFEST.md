# Sketch Manifest

## Design Direction

**Calm instrument with selective signal-density at the live moment.** The agent feels like a confident specialist — restrained palette (Aether Deep Midnight), purposeful motion (no decorative spin), generous space at rest, and a controlled spike of status / counters / pulses only when work is actively in flight. The chrome stays out of the way until it has something to say.

The acceptance bar for every variant is the **long execution in progress** moment: 30+ seconds into a multi-tool run, can the user instantly read what the agent did, what it's doing, and trust it's still on track? This directly answers the documented UAT-gap pattern (regressions hiding in slow streams).

## Reference Points

| Reference | What we borrow |
|-----------|----------------|
| **Claude.ai analysis tool** | Inline tool-result-in-conversation pattern — the runner appears mid-message with status, output, and re-run controls. |
| **Cursor / Windsurf agent mode** | Multi-step agent loop — collapsible tool calls, status pills, streaming code output. Closest peer product. |
| **Linear (status & motion)** | Calm-but-expressive motion language. Status pills that pulse meaningfully; fades on state transitions. |
| **Raycast (command surfaces)** | Instrument feel — monospace touches, dense-but-quiet, keyboard-forward affordances. |

## Theme

`themes/default.css` — Aether Deep Midnight, sourced from the live `frontend/src/index.css :.dark` tokens so sketches feel like the real product.

## Running Design Decisions

| # | Decision | Source |
|---|----------|--------|
| 1 | **Live run = bracketed run-card** in conversation flow, with status header (timer + counter + bot avatar), progress shimmer while active, fold-to-summary on completion. | Sketch 001 winner C |
| 2 | **Tool call = editor inset.** `execute_code` renders as a real editor pane (gutter, syntax highlight, lang chip) with labeled STDOUT/STDERR regions and file outputs as inline preview cards (chart icon, click-to-open). Non-code tools (search, read_file) get their own inner shape inside the same outer frame. Different tools, same container; honest about each tool's native result type. | Sketch 002 winner C |
| 3 | **Focus Mode under stress.** During a long run: pinned run-card header (timer + counter), past tool calls auto-collapse to compact rows with their *result-summary* (`→ yoy_q3 = 30.87%`), only the active tool keeps its full editor open, explicit "Next: ..." footer surfaces what's queued. Past steps fold to essence, active step gets full attention — directly answers the lived-experience UAT-gap where regressions hid in fast streams. | Sketch 003 winner B |
| 4 | **Panel = push/split, stacked-accordion sections.** The right panel shrinks the chat (no overlay); its 4 areas (Todos / Files / Pending-Q / Versions) stack in one scroll, each collapsible, with a pending `ask_user` question pinned at the very top. When empty (the common case) the panel short-circuits to one calm empty-state and offers "collapse to rail." Collapsing leaves a thin rail with count badges so a pending question never goes silent. Mobile (<768px) = bottom-sheet. Toggle: header button + ⌘./Ctrl+. | Sketch 004 winner B |
| 5 | **File browse = full-replace drill-in; diff = in-column unified.** Tapping a file replaces the panel body with a full-height preview (md → MarkdownRenderer, code → syntax highlight, csv → table, image → framed) + a `‹ Files` back button. Versions compare as a **unified inline diff** (+/− coloring) that stays in-column by default; an opt-in `⤢ expand` button pops only the diff into a wide overlay over the chat for rare gnarly diffs — never auto-widen (would reflow chat). Every file type needs a graceful preview/too-large fallback (no raw byte dumps). | Sketch 005 winner A (C folded in) |
| 6 | **Pending `ask_user` = dual-surface, calm-loud.** Calm pinned card at the top of the panel (choice chips + always-present free-text) **plus** a pointer cue inside the chat run-card. The agent's block is made unmissable structurally — paused amber run-card, **locked composer** ("agent is paused"), pulsing toggle dot — not by hijacking the screen. Submit resumes in place (card → green, run-card un-pauses, composer unlocks). Configurable timeout expires gracefully with a clear message, never a silent hang. | Sketch 006 winner C |
| 7 | **Chat↔panel seam = live-pointer / reload-resolved.** Mental model: **panel = what's true now** (reconciles to current state on reload, never replays history); **chat = what happened.** Live: the 3 panel-owned tools (`write_todos`/`workspace_write`/`ask_user`) render as quiet one-line pointers in chat (no noisy duplication). Reload: the transcript resolves to compact self-contained cards — answered Q&A renders (closes the documented `ask_user` reload gap), files → clickable chips, todos → final-state note. Keeps the chat scannable rather than piling onto an already-dense surface. | Sketch 007 winner C |
| 8 | **Unified chat tool-card = borderless numbered rail + status nodes + active bloom.** Every Deep tool card lives on one frame: a step-numbered rail whose nodes fill (green=done, pulsing-primary ring=active, dim=queued) so the sequence is *felt* without per-card borders; finished steps fold to a one-line essence (`icon · tool → result`), only the active step is open + live and "blooms" (primary wash). Every finished step is **click-to-expand** to its full detail (D-01 details-on-demand). Row numbering makes the honest step count (strip == cards, D-04) and the zero-duplicate invariant (a dup = two same-numbered rows, D-05) structurally legible. Refines decisions 1–3 for Phase 095's fix-and-unify-in-place scope — not a new frame. | Sketch 014 winner Synthesis (C rail + B nodes) |
| 9 | **Run status = honest persistent strip + hybrid placement + follow-but-release scroll.** A single `⏱·Step·activity` strip that NEVER vanishes — elapsed derives from a stable start-ts and renders continuously, immune to transient stream-ends (the Kimi/Moonshot vanish bug), freezing only on a TRUE terminal. Placement is **hybrid**: the strip rides the run-card header while the run is in view; the moment the user scrolls away a bottom chip appears at the live edge carrying the full status + "↓ Jump to live". Scroll follows the live edge while at bottom, releases on scroll-up, re-arms at bottom. *(The never-vanishes fix is a timer-derivation code change; placement is the UI layer.)* | Sketch 015 winner C (Hybrid) |
| 10 | **Output files = hero the deliverable + working files visible-but-quiet + always-downloadable.** The agent-flagged final output(s) render as a big "★ Your file" hero card with a prominent Download; intermediates show as a quieter "Working files (N)" group (visible by default — "show all files"). Every link downloads in one click, even on a chat reopened tomorrow (re-sign on demand; investigate the dead-link root first). File-type icons are **proper SVG file icons** (document + folded corner + type glyph + colored extension ribbon, Untitled-UI / "40 file type" style — `.PPTX` orange, `.PNG` violet, `.MD` grey, `.PDF` red, `.DOCX` blue, `.CSV` green…) via one shared `fileIcon()` reused across the 014/015 chat file cards too. The agent flags the hero via a small backend tag on the `final_output_files` payload (D-08 contained touch). | Sketch 016 winner A (Hero block) |
| 11 | **Requirement-first authoring = describe-box-only first screen.** You type a *business requirement* in plain terms (not a phase list); the AI drafts the whole workflow in one shot and sets a strictness dial proportional to the stakes. **Grounding (the template + the project folder), the strictness dial, and the grey-area confirms all appear POST-DRAFT, revealed by the draft** — never collected up front. Grounding is a *refinement, not a precondition*. The empty screen is a single calm column: just the required `business_requirement` describe box + one hint line. | Sketch 018 winner A |
| 12 | **Progressive disclosure / calm default = comprehensiveness in DEPTH, not breadth.** Every panel that isn't needed right-now is collapsed / popover / post-draft (the dial collapses to one line while guesses are open; the fill-contract + folder picker live in popovers). The acceptance test is the **"3-second read at rest"** — the first screen must read in 3 seconds with no clutter; depth is always one tap away. | Sketch 018 winner A |
| 13 | **Tiered guidance = match surface to stakes.** **ⓘ popovers** (non-blocking, hidden behind the dot until hover/tap) carry passive explainers for key terms; **dismissible inline banners** (relevance-gated, never on the empty screen) carry contextual nudges; **modal windows are reserved for must-decide moments only** (e.g., a publish block) — never used for passive teaching. First-time teaching on a calm/empty screen uses an inline ⓘ affordance next to the existing hint, never a space-occupying banner. | Sketch 018 winner A |
| 14 | **Template upload = post-draft, on the deliverable phase, two-layer guarantee.** The template attach affordance is a prominent, clearly-labeled button on the `llm_emit` phase (".docx / .pptx / .xlsx") surfaced by the draft (template-absent ⇒ analysis/prose mode; attach ⇒ fill mode), backed by a **two-layer guarantee**: upload-time inspection (the fill contract — catches malformed / empty / Word run-split tags early) is layer 1; the run-time `output_file_valid` integrity gate (re-opens the produced file, residual unfilled tags fail closed) is layer 2 — so an unfillable template can never publish. | Sketch 018 winner A |
| 15 | **Refine surface = READ-ONLY vertical phase-spine graph + fixed-width right-side form panel.** The workflow refine surface is a **read-only vertical phase-spine graph** — no drag-canvas; only linear `i→i+1` edges plus dashed `skip_to_phase` failure branches (**no `depends_on`, no parallel lanes**) — with each phase's form opening in a **fixed-width right-side push/split inspector panel** (mirrors the app's workspace panel; the graph column shrinks via `minmax(0,1fr)`, never a horizontal slider). Shows all six real phase types. | Sketch 019 winner D |
| 16 | **Publish = the REAL 8-stage gauntlet rendered as a first-class honesty surface.** The publish surface renders the real 8 ordered stages (owner / valid / business_requirement / lint / interactive / golden-run / structural-gate / judge / flip) with the **synchronous golden-run-on-your-KB wait as the hero state**. The `PublishVerdict` (5 fields) + judge `named_failures` (per-criterion failed rows + summary) are **RENDERED verbatim, never re-derived**. A **judge fail is a HARD WALL** — no "publish anyway" override (only fix & re-publish). The "view golden run" link **gates on `golden_run_id != null`**. | Sketch 020 winner B |
| 17 | **Workflows page = card grid with a project-folder filter rail.** A left project-folder filter rail, a **Drafts & seeds** shelf above a **Published** section; per-card ESSENCE = name + source tag + phase-chain glyphs + `input_keys` + a **strictness-tier badge DERIVED from the real gate set** (STRICT/MIDDLE/LOOSE → `citation_policy` + gates, never invented levels). **Run hands off INTO a new thread** in workflow mode (never page-resident); **Tweak forks a NEW version** (the frozen published row is never edited in place). Plus an on-page **nav/redirect-map overlay** (the journey + a per-action destination table). Net-new draft-CRUD is flagged honestly — only `GET /workflows/published` is live. | Sketch 021 winner A |
| 18 | **Workflow RUN surface = the workspace panel owns the live MEANINGFUL phase spine** (panel not chat — avoids the dual-surface bounce); the chat carries a **thin run receipt** (015-C never-vanishes status strip → resolves into the deliverable receipt; 009-C live-status→resolves + 007-C live-pointer/reload-resolved seam). A **meaningful step** = human title (**NET-NEW `phase.name`**) + type·ordinal + a **RUNNING-phase-only honest activity line** (relaxes D-03 for the active phase only, from real tool args / sub_agent description) + a **gate-chip-when-a-validator-exists**; idle/done phases stay quiet (simplicity guard — title+type+status default). **Composer A (locked-in-thread)** is the winner — the run owns the composer (status chip + Cancel), only the scoped `ask_user`/`llm_human_input` pause replies, conversational after resolve, with a parallel-thread escape hatch; **B chat-alongside is documented** (tangle/silent-send-drop caveat); **C dedicated-run-view is REJECTED** (hides the panel, loses follow-up, duplicates plumbing). Route **BUG-260609-04 / -02** + persist **`phase_type` / `phase.name`** as wire fixes that make the current surface meaningful with no new UI. | Sketch 022 winner A |
| 16.1 | **Embedding/extraction picker = preset `<select>` + an ALWAYS-ON 🔒 endpoint footer.** Generalize the existing rerank `<select>` (least net-new) into ONE reusable provider-picker used for BOTH the embedding model and the extraction model. Selecting a preset auto-fills base_url + a strong default model + dims + retrieval threshold and surfaces a **persistent footer** (endpoint · dims · threshold · cloud/local tag) that is visible WITHOUT opening Advanced. The always-visible endpoint is the legible cure for BUG-260616-01 (slashed `org/model` id → silent OpenRouter-cloud mis-route): you can never pick a model without seeing where it runs. Local presets (Ollama `:11434`, LM Studio `:1234`) relax the key to a dummy. | Sketch 024 winner Synthesis (A + C footer) |
| 17.1 | **Re-embed confirm gate = weight, NOT friction (D-03).** Changing the embedding model + Save fires a serious, attention-demanding modal — danger rail, alert icon, a 4-fact grid (chunks · ETA · target model · runs-in-background), and a consequence list naming the recall dip + resumable/non-destructive + reversible-only-by-switching-back — then a single deliberate two-step Confirm. **No type-to-confirm** (that's for genuinely irreversible destruction; the re-embed is rare/reversible/resumable/non-destructive, so typing is severity-theatre that trains the gate as a chore). Honors the "modals reserved for must-decide moments" rule (#13). The acknowledge-checklist is the documented fallback if C reads as too click-through in build. | Sketch 025 winner Synthesis (C frame + A facts) |
| 18.1 | **Re-embed progress = ONE rich home + a whisper where search happens (D-04/D-05 graceful-dip honesty).** A rich status card in Settings is the trustworthy home for the background job — per-batch grid, re-embedded/total/ETA, an explicit "search at reduced recall · nothing is lost · resumable" note, and running/partial-failed/complete states with a **"Re-embed now"** re-kick + "Switch back". The recall dip is also told where it's felt: a single slim "search is catching up" pointer on the Documents page that deep-links into the card and auto-hides on completion — avoiding a full app-wide banner nagging every page. | Sketch 026 winner Synthesis (C home + search pointer) |
| 21 | **Per-field confidence + inline edit = scored ConfidenceChip + trust-gutter + honest manual-override (operator pick 028-A, 2026-06-17).** Net-new `ConfidenceChip` (clone `StatusPill` anatomy, NOT chat `ConfidenceBadge`) = **glyph + tier WORD + raw score**, never colour-alone (WCAG 1.4.1); High `✓`/green, Med `●`/amber, Low `⚠`/lightened-red. A 2px **decorative trust-gutter spine** per field row gives an at-a-glance certainty read; **Low values themselves read tentative** (italic + dimmed + leading ⚠), so flagged rows are pre-attentively visible. **Honesty is load-bearing:** a manual edit flips the chip to a NEUTRAL **"✎ Edited"** with **no score** (a human owns it — green/score would falsely imply model confidence); a stored value with no `_confidence` → neutral **"✦ Extracted"**, NEVER a fabricated "High"; empty fields (`exclude_none`) show **"Not extracted — add"**, never a fake blank; editing surfaces a **"🛡 Saved · audit logged"** receipt + `metadata.update` audit (already allow-listed). Inline edit = `FolderNode` pattern (click value → in-place input, Enter save / Esc cancel, "will become · Edited" preview), no panel-wide edit mode. Triage = honesty banner + `PanelSection` warn-count + "Review low first" + "Jump to next"; **bulk-confirm deliberately CUT** (manufactures false provenance). **Net-new wire (112):** the metadata-PATCH endpoint (none exists today), a per-field `source: user\|extracted` marker (re-extract must not overwrite edits), custom-field edit persistence. Built from a grounded 3-lens design workflow (judge: honesty-forward 88 / calm-Linear 86 / dense-triage 82 → synthesis). | Sketch 028 + operator 2026-06-17 |
| 20 | **Document detail surface = right-side push/split panel (operator pick 027-A, 2026-06-17).** Opening a document slides a ~430px detail panel in from the right (`minmax(0,1fr) 430px`); the document list shrinks but stays visible so the **scan → fix → next** metadata-correction loop never loses its place (the deciding factor over a full-page view, which interrupts it, and a modal, which breaks "push, never overlay" and cramps once REL/CLASS pile in). The panel is the **shared shell** that Phase 112 (metadata + per-field confidence + inline edit), Phase 117 (relationships), and Phase 118 (classification suggestions) all inhabit, organized as **stacked-accordion sections** (reuses the workspace-panel 004-B pattern: Metadata open by default, Relationships/Classification/Versions collapsed). Collapses to a mobile bottom-sheet. | Sketch 027 + operator 2026-06-17 |
| 19 | **v2.9 Workflow Studio NAVIGATION CONTRACT — all 11 open decisions (OD-1..OD-11) ADOPTED by the operator 2026-06-14.** **THREE HOMES:** **authoring = the Builder** (one continuous route, describe→refine; a persistent "← Workflows" breadcrumb with draft auto-save; NO Run affordance); **library + launch = the Workflows page** (the catalog + the only launchpad); **execution = a Chat thread** (workflows are a MODE of a thread, never page-resident). **AUTHOR→PUBLISH→RUN loop — PUBLISH IS THE TEST:** a **draft cannot be Run directly** (the publish gauntlet's golden-run + judge IS the trial run; **Run appears ONLY once published**; no "Run-draft"; protects QUAL-01). Publish **success returns to the Workflows page** with the new version on the published shelf + a **Run CTA**; **Tweak forks a new-version draft into the Builder** (the frozen published row is never edited in place). **Nav:** ONE net-new "Workflows" entry — extend the `ActiveView` union + a shared `NAV_ITEMS` const, **delete the dead AppDock**, distinct icon (NOT Settings' gear). **Run handoff reuses `POST /threads/{id}/messages`** (same path as the composer Harness pick). The **read-only graph stays a Builder / Workflows-page surface** (NOT the run-time `PhaseTimeline` — G-5 hot-file). A locked running thread can **spawn a sibling Deep thread** as the escape hatch ("never truly blocked"). | Sketch 023 + operator 2026-06-14 |
| 22 | **Inline filter = one calm chip strip.** `Where [chip] [chip] ＋condition … N match · Save as view` above the list — ad-hoc filtering and saved views are the SAME surface; condition edits open in a small popover; the live count turns amber at zero; **operators render in plain sans, never code-style mono**; no on-screen "AND"/type jargon. Ad-hoc filtering is a free byproduct of the builder. | Sketch 029 winner A (revised post-audit) |
| 23 | **Relative-date control = the date operator dropdown itself carries the vocabulary** (within next… / older than… / before / after / between); choosing a relative entry reveals a `[N] [unit]` stepper with a **live resolved-window readout** (`→ Jun 19 – Sep 17, 2026`), a plain-language honesty line ("Updates automatically — the dates shift forward"; "Already-overdue items aren't included"), and a today→window timeline. **No on-screen type/operator lecture** — the control adapts to the field (the developer type-matrix was deleted). | Sketch 030 winner A (revised post-audit) |
| 24 | **Views = a "Views" group below Folders built from the shared `NavRow`** — funnel icon (vs amber folder), per-view count badge (lazy/cached, via an additive count-only resolve), tooltip-labeled `G` pill, Edit/Rename/Delete menu. Terminology is **"saved filters," never "query."** The honest Views-vs-Folders differentiator is **icon + count + absence of a "new subfolder" action** — NOT drop rejection (no file drag-drop exists on the Documents page; D-114-14 strikes that line + adds a "Move to folder" doc-row action reusing `MoveToFolderDialog`). | Sketch 031 winner A + operator 2026-06-19 |
| 25 | **4-column crunch (sidebar + filter bar + list + 430px detail panel) resolves by collapsing the Folders+Views sidebar to a ~50px icon rail when the detail panel opens** — default-on first open, **user-pinnable + session-persisted** (workspace-panel collapse-to-rail precedent #4); the filter bar collapses to a summary chip. This is a **SHARED-SHELL layout decision inherited by Phases 117/118** (same panel) — must degrade gracefully for relationship/classification content. `DocumentList` column-shedding is net-new (static 7-col table today). | Sketch 032 winner A + operator 2026-06-19 |
| 26 | **Folder tree polished via ONE shared `NavRow`** used by BOTH Folders and Views so they read as peers — counts on every row (folders too, not just Views), Views rendered flat (no nesting), a single soft indent guide + ~3-level cap (lean on the breadcrumb beyond), a tooltip-labeled `G` pill ("Global — shared with everyone"), and keyboard/touch-reachable actions. **Build Views from the fixed row, never a clone of the flawed `FolderNode`.** Inlined into Phase 114 (not a separate phase). | Sketch 033 winner A + operator 2026-06-19 |
| 27 | **Relationships section = a chip-led, grouped-by-direction accordion in the EXISTING `DocumentDetailPanel`** (extend the shell, never a new surface). Two labeled subgroups **Outgoing** (`A → X`, verbatim rel-type chip) then **Incoming** (`Y → A`, **inverse label** mirrored 1:1 from backend `_INVERSE_LABEL` — never invented), each row = per-type-dot chip + filename + a remove (✕). **Create is outgoing-only** (`+ Add link` at the section foot); **remove works either direction** (deliberate asymmetry, lock against "fix to symmetry"). Honest state set (empty ≠ error ≠ loading); the masked **"linked document (no access)"** row (verbatim `_NO_ACCESS_MASK`, no id/title leak) is present by default; mutation is **re-fetch, not optimistic** (no undo). **A11y is load-bearing (audit-locked):** remove must be keyboard/touch-reachable (not hover-only), icon buttons carry `aria-label`, the masked string + all meaningful copy use the panel-scoped AA token (≥4.5:1, never the global 3.59–3.64:1 dim), `updating`=`role=status`/error=`role=alert`. | Sketch 034 winner A + operator 2026-06-20 + fidelity audit `wf_1ec2afac-687` |
| 28 | **Create-link picker = the `MoveToFolderDialog` dialog shell with its `Select` swapped for a searchable typeahead** (D-117-3 — a Select dies past ~30 docs; a KB holds thousands). Dialog · type-first: rel-type chips on top, then the typeahead, with a live *"this document references → X"* preview and a disabled-until-valid confirm. Candidates exclude **self + already-linked-PER-TYPE** (D-117-4 — switching the type changes the candidate set; idempotent create is the backstop). Keeps the shell's error line + (inherited) submitting/disabled beat; success → re-fetch. **Net-new a11y:** the typeahead is a combobox — wire `role=combobox/listbox/option` + `aria-activedescendant`; focus-trap/restore inherited from the shadcn `Dialog`. Inline-in-section (no modal) was shown as a foil and **rejected** (deviates from D-117-3, competes with the dense panel). | Sketch 035 winner A + operator 2026-06-20 + fidelity audit `wf_1ec2afac-687` |
| 29 | **Governance Health = its OWN top-level surface (a card-grid of `HealthPanel`-per-signal), NOT a tab of Library Health.** Phase 119's read-only view gets its own `NAV_ITEMS`/`ActiveView` route (shield glyph, peer to Library Health), three signal cards (broken relationships / unclassified / low-confidence metadata) over a 3-tile KPI strip, riding the shipped `HealthPanel`/`HealthDocumentRow`/`HealthEmptyState` anatomy 1:1 (lowest net-new). This is the only form that satisfies SC#1 ("its OWN surface — NOT bolted onto the knowledge-health dashboard") unambiguously — the "Retrieval\|Governance tab of Library Health" form is **rejected** as the exact bolted-on shape SC#1 forbids. **Graft:** adopt a posture-hero + collapse-to-clear FORM for the all-healthy state (neutralizes the card-grid's cluttered six-block all-clear); any health-score number must be honestly computable or it's cut. The Documents rail stays a pure finding instrument (Folders+Views+Automation); governance is **never** an in-rail entry (would force the inconsistent IA + a standing false-alarm). | Sketch 038 + 040 winner A + operator + judge panel `wf_a961f729-247` 2026-06-21 |
| 30 | **Governance signal row = inline per-signal verb buttons** (`Open links` / `Classify` / `Re-extract` + quiet `Open doc`) — the verb IS the diagnosis (fastest lived triage). **Ship the composite: inline verb-rows + an expand-for-provenance caret, where the expand text inherits the 117 no-access/missing mask** (the un-gated provenance line that names a target title is **rejected** — latent leak). Honesty is load-bearing: low-confidence metadata renders the **Phase-112 `ConfidenceChip`** (`Low · 0.31` per-field extraction score, italic+dim+⚠), NEVER a retrieval-similarity %; **Classify never silently moves** (CLASS-02, opens the accept flow); the governance page **writes nothing** (SC#3 — fix-links navigate to the canonical 112/117/118 edit surfaces; verbs delegate, never reimplement three drift-prone mutation paths). **The governance count MUST re-fetch as rows resolve** ("no list-level mutations" ≠ "no list-level re-fetch", else the count silently lies). Documented strong alternative: route-everything-to-the-shared-detail-panel (wins honesty + build-cost; pick it if maintenance-durability outweighs fix-speed — confirm the panel exposes "open scrolled to section X" first). | Sketch 039 winner A + operator + judge panel `wf_a961f729-247` 2026-06-21 |
| 32 | **Trigger Tuner = a focused full-surface reached from the skill, NOT crammed into the 384px panel (041-A).** A tuning run is cases × N models × 3 repeats of live LLM calls with a case editor + per-provider scoreboard + candidate list — too big for the right detail pane. The Tuner takes the whole working area (rail stays; list + detail hidden) via an `ActiveView`/no-router switch, `‹ Skills` returns — mirroring the Workflow-Studio publish-gauntlet "focused surface" precedent. Two-column body: description + benchmark + run config on the left, scoreboard + candidates on the right. Rejected: wide push/split panel (B — tall single-column scroll) and in-panel accordion (C — everything cramped in 384px). | Sketch 041 winner A + operator 2026-06-23 |
| 33 | **One tuning iteration = candidate cards each carrying a per-provider held-out grid (042-A), pick winner by held-out, author-confirm → PATCH.** Each candidate is a card with its held-out score + a per-provider grid where **every cell shows BOTH sub-scores — fires (should-trigger recall) AND no-false (should-NOT precision)**, so the false-fire rail for the new description-driven policy (D-01) is always visible, never a hidden aggregate. The author picks by **held-out** (the 40% never used to select), then an explicit **diff confirm** writes the live description via `PATCH /skills/{id}` + re-lints — **never auto-applied**. **Provider-set adaptivity (load-bearing):** the grid is **N-column = the org's configured targets, never a fixed four** — a provider the org doesn't run never renders (fabricated measurement = dishonest); **single-provider is the clean baseline** (one column, "tune for Claude"), self-hosted runs one column on own infra (builder model self-hostable → air-gapped loop); **OpenRouter is one gateway, native DeepSeek/GLM/Kimi/MiniMax are first-class distinct targets** (serving path ≠ model name). The SC#10 4-axis recipe is the **dev/QA gate**, never a runtime imposition. Rejected: leaderboard (B — hides the fires/no-false split to hover), delta-vs-current (C — strong alt, fold its per-provider Δ into A). | Sketch 042 winner A + operator 2026-06-23 |
| 34 | **Benchmark cases = two-column should-fire / should-NOT lists with auto-seed provenance + a 60/40 split bar + a background-run live card (043-A).** The Tuner auto-seeds a starter benchmark (should-fire = description paraphrases; should-NOT = sibling catalog skills + generic off-topic prompts — leak-safe owner-scoped) tagged `seeded`/`sibling`/`held`/`you`; the author edits/approves/adds. The should-NOT column reads visually as the **false-fire rail**. The **60/40 train/held-out split** is honest + visible (held-out 40% picks the winner). The multi-minute run is a **background job** (reuse Phase-061+ run-buffer `run:{run_id}` + SSE) with a per-provider live-progress card (never a fake percent for a queued provider; stable-start-ts elapsed timer — the 095 never-vanishes lesson) + "you can leave; it reconciles on return." Lanes/count/splitbar scale to N targets (N=1 baseline). Rejected: unified tagged table (B), chip strip (C — truncates verbose prompts). | Sketch 043 winner A + operator 2026-06-23 |
| 35 | **Save-time lint = inline-under-Description, warn-never-block, with a one-click "Tune this" handoff + a provider-agnostic builder-model knob (044-A).** TRIG-03 flags a weak trigger description the moment you save — **never blocks** (D-09; hard-failing the agent's own `save_skill` mid-task would be worse), names the **specific reason** (deterministic heuristic: name-echo / no trigger verb / too short / generic / duplicate — also covers STD-01's ≤1024 hint free), and offers a one-click **"Tune this →"** into the Trigger Tuner (D-12 → TRIG-03→TRIG-01 one flow). Lives in the **shared service layer** so it covers BOTH the human Skills form AND the agent `save_skill` path (D-10) — the agent path surfaces the same warning in-chat without blocking the tool. The **builder-model knob (D-08)** reuses the `resolve_authoring_model()` pattern (`config.py:1004`) + the 111.1 provider-picker footer: strong default (`claude-haiku-4-5`), selectable across the **full provider list incl. local** (Ollama / LM Studio / OpenAI-compat / DeepSeek-on-own-infra), always-on cloud/local tag, **no paid-provider SPOF**, **decoupled from the benchmark targets** (builder *writes*, targets *measure*). Rejected: dismissible banner (B — farther from the field, dismiss loses the cue), label chip + popover (C — quietest but easiest to miss; "never silent" can't lean on noticing a chip). | Sketch 044 winner A + operator 2026-06-23 |
| 31 | **Documents rail composition holds with Folders + Views + Automation as three peer `NavRow` groups; governance lives top-level, the rail adds NOTHING.** Re-check of sketch 032 (which predated the Automation group) confirms the static-stacked rail composes + collapses-to-icon-rail (032 precedent) without crowding. The placement axis (governance top-level) and the density axis (static vs collapsible group headers) are **separable**: the static rail is the default (lowest net-new); **collapsible group headers are the documented FALLBACK — promote when real folder-tree depth (the only group that grows) becomes the dominant pain** (stays IA-coherent with the top-level home). Forbidden combo: a top-level governance home with an in-rail governance entry (reachable two contradictory ways). | Sketch 040 winner A + operator + judge panel `wf_a961f729-247` 2026-06-21 |
| 36 | **Workflow "soul" = a 5-atom essence, PURPOSE-LED, rendered the same across 3 sizes (046-A).** The soul = purpose (`business_requirement` — surfaced NOWHERE in the product today) · needs (kickoff `inputs`) · a **glyph-dot phase spine** (the ⚙✎🤖⛓☺◆ type glyphs ONLY — type ribbons + phase-index numbers STRIPPED; phase names are quiet labels / `title=`) · ONE tier chip from `deriveTier()` (glyph + WORD, never colour-alone) · an output/deliverable line. **Purpose leads** — the `business_requirement` is the hero at every size; spine/tier/needs/output sit quietly beneath. The SAME shared, scale-keyed soul atoms feed the **library card → run header → publish summary** so a user recognizes the workflow by the same essence in all three (WUX-01 SC#1+2). A draft workflow's run strip honestly reads `draft · test run` (no fake `Phase n/N`). **Net-new:** the horizontal glyph-dot `PhaseSpine`, the soul header on the run surface, the soul block atop the publish summary, the headline `business_requirement`. **Reuse seams:** `deriveTier`/`TIERS`, the glyph map, `panel/PhaseTimeline.tsx`+`PhaseCard.tsx` (G-5 — additive sibling header, do NOT thread soul into PhaseCard internals), the `PublishGauntlet.tsx` ladder. | Sketch 046 winner A + operator 2026-06-26 |
| 37 | **Strict↔loose = an EXPLICIT two-door fork (047-A).** Two big door cards side by side — **"Describe & run"** (loose: a describe box + the soul preview + one CTA) vs **"Author & govern"** (strict: opens the full Builder — read-only vertical phase-spine graph + 400px right-side form panel + ALL advanced controls). Pick a door → it opens inline; a persistent **"‹ both doors"** returns; the describe door carries a visible **"switch to Author & govern ›"** strip so **nothing is lost by picking fast** (advanced is exactly one click away, never removed). Keyed off `deriveTier`: the govern-door advanced controls (`citation_policy` picker · gate chips · per-phase `folder_scope` · per-phase model) **recompute the tier live**, and `llm_judge_rubric` is **LOCKED always-on** so a STRICT workflow can never be silently downgraded (WUX-02 SC#3+4). Shares the 046 soul header (all 5 parts) across both **Authoring and Running** contexts (toolbar context toggle). **Reuse:** `deriveTier`/`TIERS`, the gate set + locked judge (`PublishGauntlet.tsx`), the read-only spine (019-D `PhaseSpineGraph.tsx`), the 400px form-panel shell. **Net-new:** the two-door disclosure shell + the describe box (descends from 018-A). **Documented alternatives (rejected here):** B loose-default + one-click expander · C tier-adaptive (deriveTier foregrounds the door). | Sketch 047 winner A + operator 2026-06-26 |
| 38 | **Unified cross-provider tool card = provider-logo avatar + preparing-description-before-`tool_start` + one byte-identical layout on all 8 providers (048-A).** The header avatar (today a generic gradient brand-pulse `Bot` dot, identical for every provider, `RunCard.tsx:280`) becomes the provider's REAL official logo per-provider (`@lobehub/icons`: OpenAI / Claude / Gemini / DeepSeek / Kimi / Zhipu / MiniMax / OpenRouter — brand-colour marks on a faint per-provider tinted backing; the `brandPulse` ring stays while streaming). The agent's `tc.args.description` ("about to…") surfaces DURING the `preparing` window, before `tool_start` (TDP-02). The card reads byte-identically across all 8 providers (CTC-02) — proven by a calm STATIC 8-provider uniformity matrix; only the logo differs. **Real/already-wired (no flag):** `message.provider`/`message.model` (the `{provider} · {model} · turn N` sub), `tc.args.description`, the `RunStatusStrip`. **Net-new (flagged):** the provider-logo ART — add `@lobehub/icons` React components (or bundle the static SVGs stored at `048/logos/<provider>-color\|mono.svg`); `message.provider → logo` is the one-line map. Rejected: B unified monochrome glyph (calmest but loses brand recognition), C logo + wordmark chip (named but busiest). G-5 hot files `RunCard.tsx`/`ToolCallPanel.tsx`; this is the canonical surface CTC-03 depends on. | Sketch 048 winner A + operator 2026-06-27 |
| 39 | **Chat-area reclaim = DELETE the redundant sticky composer timer; keep the header strip + floating chip as the ONLY status homes (049-A).** Three elapsed surfaces exist today; `StickyTimerBar` (`ChatArea.tsx:533-585`, the OLD 076.1 D-03 bar above the composer — `Loader2` + time + Step + files + description) duplicates the canonical `RunStatusStrip` header placement (in view) + the `MessageList` floating "↓ Jump to live" chip (scroll-away) and is the motivating bug ("shows for some providers, vanishes for others"). Remove it + its mount; the composer reclaims the space. **GATED on CTC-02 holding** (only remove once 048's card is verifiably canonical). **A (clean removal, standard hybrid) wins; B (promoted floating-chip trigger) REJECTED** — the operator could not perceive the A/B difference (only *when* the chip pops), so B's net-new `useFollowScroll` trigger rule isn't worth a delta no one can feel; ship the existing `showJumpToLive = !isPinned && isStreaming`. Pure subtraction, NO net-new wire (B's promoted trigger is the documented FALLBACK only if users report lost always-visible status post-ship). | Sketch 049 winner A + operator 2026-06-27 |
| 40 | **Long USER prompt = clamp to a preview + fade + inline "Read more" (050-A).** A long pasted prompt (today full-height, `MessageItem.tsx:205-217`, right-aligned `gradient-primary` bubble) collapses to a `-webkit-line-clamp:7` preview with a fade **matched to the violet end of the bubble's 135° gradient** (not the page bg) + an inline "Read more"/"Show less" chip; SHORT prompts render UNCHANGED; right-alignment, the `rounded-br-md` tail, `max-w-[70%]`, `pre-wrap`+`break-words`, and the `User` avatar all preserved. **Scope = USER prompts ONLY** (assistant answers keep their own preview path — do NOT clamp the assistant branch). **Net-new: NONE** — pure client-side clamp state over `message.content`; no wire/asset, no honesty flag. Threshold (line-count vs char-count vs overflow-detect) is a build choice; cheapest honest impl = always-render the clamp container, reveal the fade + Read-more only when `scrollHeight > clientHeight`. Rejected: B centered overlapping pill (more discoverable but lives outside the bubble), C clamp + word-count hint (fold into A if "how much is hidden" matters). | Sketch 050 winner A + operator 2026-06-27 |
| 41 | **Gauntlet = energized pip/energy-spine + worded verdict + raw-on-demand (051-A).** The 8 wrapping stage boxes (`PublishGauntlet.tsx` `GauntletSpine`) become a compact horizontal energy-spine (a 3D icon per stage, passed→green, the golden run pulses with energy flowing in); the resolved state LEADS with a plain-worded verdict (🎉 Published / ⚖️ Blocked by the grader because…) and DEMOTES the raw 5-field `PublishVerdict` grid behind a "Show raw verdict" `<details>`. Sits UNDER the shipped 124 `<WorkflowSoul scale="pub">` block. Honesty preserved (must NOT soften): verbatim verdict (the `▦ rendered verbatim` cap stays in the disclosure), judge = HARD WALL no override, 4 DISTINCT HTTP outcomes, run-link gates on `golden_run_id`, the judge per-criterion `{criterion,score,evidence}` rows stay first-class on a block. Energized intensity operator-loved (calm anchor via in-sketch toggle). | Sketch 051 winner A + operator 2026-06-27 |
| 42 | **Live run = quiet-idle / alive-active step-flow (052-A).** The shipped `PhaseCard`/`PhaseTimeline` (G-5, shared with the live harness) re-skinned to "calm at rest, comprehensive on the active step" (the 008-D/022-A target): idle steps = one dim still line (NO type-lecture/`oneLiner`, NO placeholder, NO animation — SC#2); the ACTIVE step blooms (amber wash + glowing node + a vertical energy comet flowing in + the running-ONLY activity line + the AI-engine chip); done steps fold to a one-line essence; failed renders the closed-taxonomy reason (failed-as-failed). Sits UNDER the shipped 124 `<WorkflowSoul scale="run">` header (`WorkspacePanel`). Preserved: status = glyph+word+colour, gate-chip-only-when-a-validator-exists, APG accordion / `role=alert` / indeterminate progressbar a11y; `phase.name` human title flagged NET-NEW. ⚠ G-5: re-run harness replay tests. | Sketch 052 winner A + operator 2026-06-27 |
| 44 | **Skill Studio = ONE focused full-surface, persistent-header + 3 tabs (053-A + 057-A + the operator Tuner⟷Evals lock, 2026-07-03).** The eval experience LEAVES the 384px edit panel — the detail panel slims to form + ONE gate line + "Open studio" + counts (the "messy UI" cure: the panel stops hosting five subsurfaces). The Studio (041-A `ActiveView` form; `‹ Skills` returns with the selected skill + panel state preserved) owns **Evals · Triggering · Versions** as tabs under a persistent header (skill name + vN + LIVE + a compact gate strip visible on EVERY tab); landing tab = Evals. **The shipped Trigger Tuner is ABSORBED as the Triggering tab** — internals untouched (a re-homing, not a rebuild; 041/042/043/045 winners intact; the old `skill-tuner` ActiveView value redirects, no orphan surface). Nav contract (the 057 MAP is the build reference): the 044-A lint "Tune this →" re-points to Studio·Triggering; the 136 `PublishGateDialog` gains ONE net-new "Review evals →" link on the unmet branch (closes "gate only discoverable in the dialog"); tabs are deep-linkable (gate line → Evals, lint → Triggering, version row → Versions); chat→Studio links declared OUT of 137's scope. | Sketch 053+057 winner A + operator 2026-07-03 |
| 45 | **Skill publish status = the lifecycle stepper (054-B).** The status surface renders **Cases → Eval → Gate → Published** as a quiet 4-node journey; each count lives ON its stage node (case count · latest-run verdict · gate passed/measured · published state) so every number is spatially bound to what it measures — the 136-UAT "Publish ready 1/1 beside 0/2 cases" contradiction dissolves into sequential stages. ONLY the current stage narrates itself in one message box (052-A quiet-idle discipline); `passed_on_older_version` reads as "the passing eval is stale — it measured vN-1, the live skill is vN"; the ⚡ collision case (gate met on an earlier passing run + newest run failed) renders as a met Gate node WITH the Eval node carrying the newest run's honest count. The Publish button mirrors the gate (one source of truth); the force-publish override record ALWAYS renders (amber receipt, never softens). **Composition with #44:** the stepper is the DESIGNED status home (top of the Evals tab + the detail panel's status section); the Studio header's one-line gate strip is a CONDENSATION of the same server `PublishGate` — never a second truth-teller. A skill-scale, calm cousin of the workflow gauntlet (020/051) — stage language rhymes, no energy effects. | Sketch 054 winner B + operator 2026-07-03 |
| 46 | **Eval run history = expandable rows (055-B).** Run rows (provider logo [048 map] + model + version binding + honest rollup) **expand IN PLACE** to the per-case detail — no navigation state, scanning runs is one scroll; other runs stay visible above/below. Detail = side-by-side WITH/WITHOUT arms (at Studio width, #44), judge verdict chip + score + reason, token counts, and "your rating" thumbs **labeled DISTINCT from the judge's verdict** (two truths, never blended — EVAL-04). The honest state set is load-bearing: `not_measured` reads as *excluded, never failed* (rollup appends "· N not measured"); `judge_error` is neither pass nor fail; an interrupted run gets a banner + re-run affordance (never a silent failure — the 134/135 lesson); a running run shows live per-arm progress with NO mid-run verdicts (verdicts land only at finalize). | Sketch 055 winner B + operator 2026-07-03 |
| 47 | **Version history = table + compare picker (056-B), living in the Studio's Versions tab (#44).** A scan-first table — version · origin chip · eval-on-this-version binding · date, LIVE badged — plus an explicit **any-to-any Compare v[x] ↔ v[y]** picker rendering ONE unified diff (reuses the 135 `lineDiff`). Provenance chips derive from `SkillVersion.source` (⊕ created / ✎ edited / ✨ promoted-from-proposal / ⚡ force-promoted); the force-promoted version's failed `PromotionGate` evidence stays visible un-softened (D-13); the promoted version carries its gate counts (the 135 proposal's terminal home). Per-version eval bindings are what make #45's `passed_on_older_version` stage legible. "Restore" is deliberately ABSENT — versions are immutable (VER-01); any future restore must mint a NEW version, never rewrite history. | Sketch 056 winner B + operator 2026-07-03 |
| 48 | **Matrix run = ONE grouped card in RunHistory (058-A).** One click fans the skill's eval across all configured providers; the group renders as a single collapsible matrix card whose N sub-rows ARE 055-B rows (provider logo + model + ver + honest rollup, expand-in-place — the row grammar is extended, never replaced), so the resting history never floods (a collapsed matrix = one row). Exactly ONE sub-row carries the "▣ feeds gate" chip (D-05 — designated at launch, default = the active provider) and the card header states the semantics ONCE ("gate reads X only — other arms are analysis-only and never flip the publish gate"). Launcher = one-click "⧉ Run matrix (N configured)" + an inline gate-feeder select beside the UNCHANGED single-run RunBar (all-configured default beat checkboxes; B's cost-line popover + C's logo-chip toggles are the documented alternatives). Aggregation lives in the card FOOTER: per-config mean±stddev from accumulated run HISTORY (D-07 — ×1 run per config per click; stddev only at ≥2 runs, "first run — no spread yet" honesty), Δ = with−without mean judge score, + the D-08 deterministic analyst notes as TAGGED fixed-phrasing rules (non-discriminating / flaky-variance / time-score) — never an LLM paragraph. Live: per-config determinate unit bars, NO mid-run verdicts, aggregation lands only at finalize; RunBar disables with the one-claim-per-skill note (D-06). A `not_measured` arm shows the VERBATIM provider error — excluded, never failed. | Sketch 058 winner A + operator 2026-07-04 |
| 49 | **Running eval row = thin determinate unit bar + inline advisory case feedback (059-A).** Units = cases × 2 arms + 1 judge step (judge = ONE unit); the running 055-B row carries a thin gradient unit bar + `case i/N · arm · u/U · %` (scales to ANY case count — B's segmented pips rejected: structure-legible but stop scaling past ~5 cases); the expanded live body is a per-arm checklist (✓ / ● / queued) where each arm's wall-clock duration (EVAL-05e net-new capture) appears AS IT LANDS; finished arm cards show ⏱ beside tokens (duration = metadata, never verdict). The judge's `case_feedback` (EVAL-05d) renders INLINE under the flagged case header as a violet dashed-left "◇ Judge on this case" block — ADVISORY vocabulary (violet/info, never amber/red, never in rollup math), captioned "feedback only — never blocks the run", visually distinct from PASS/FAIL chips. No mid-run verdicts; elapsed derives from a stable start-ts (the 095 never-vanishes lesson). Applies identically to every arm of a 058 matrix. | Sketch 059 winner A + operator 2026-07-04 |
| 50 | **Engine health = a Settings tile board + the shared judge knob (060-A).** Answers the operator's verbatim trust bar ("how do I know it reflects reality for each model without hand-running all 8"): 8 compact logo tiles (one per CONFIGURED provider) each ✓/✗ + representative model — the whole posture in one saccade; a failing tile tints red with the VERBATIM provider error demoted below the grid (never an engine-shaped error); every tile links to its smoke run in the Studio (the sweep IS a matrix run over a hidden built-in smoke case, D-01/D-02). The header carries "N/8 engines healthy" + staleness ALWAYS shown (amber when old → green "just now" post-sweep; D-04 on-demand only, no scheduler, no nudge) + "Run sweep"; the subtitle carries the load-bearing semantics: ENGINE health ≠ model quality — a model may honestly fail the case and still be a healthy row; ≈24 LLM calls, no user data. The judge-model knob (D-11/D-12) sits beneath as its own card: the 024-A picker pattern offering ONLY registry-known models, with an always-on 🔒 footer showing the EFFECTIVE judge (`claude-opus-4-8` when unset — never a blank implying "configured") + its double duty (eval verdicts + publish-gauntlet judge). UI-only — the setting exists end-to-end, no migration. | Sketch 060 winner A + operator 2026-07-04 |
| 51 | **Operator Control Room = a full-surface operator band + tabs, plain-language-first (061-B).** The `/admin` shell (Phase 146, ADMIN-01) is a DISTINCT control-room zone entered via an **operator-only amber shield entry** at the bottom of the 52px app rail (probe-gated — a non-operator's nav is byte-identical to today; guessing the URL or calling any `/admin` endpoint returns a plain 404, non-discoverable by construction). Same Deep Midnight theme; the zone is marked by a **full-width amber-warmed operator band** (shield + "Control Room" + OPERATOR chip + identity + "every action recorded" marker + ‹ Back to app) over **horizontal section tabs** — deliberately NOT a second left nav rail beside the app's 52px rail (operator-rejected: two adjacent rails). Day-one = **full map, honest locks**: Overview + Audit log live; System Controls (147) / Users & Access (148) / AI Models (149) / API Keys (150) render as locked tabs with a calm "Not built yet — coming soon" refusal — **phase numbers never appear in shipped copy**. Landing = System health (the four REAL `/admin/backpressure` signals under plain labels + one-line subtexts: Server capacity · Agents working · Database connections · Work spread) + the recent-operator-actions feed; ↻ Refresh visibly prepends "Viewed system health" (your own action, recorded — the honesty beat). **ALL copy is plain-first with a "⌥ Technical names" toggle** revealing the raw field/action/endpoint names (`anyio_threadpool_depth`, `operator.login`, `require_operator`) — the LANG-01 (Phase 154) two-audience pattern, born plain at 146, not retrofitted. The audit browser's search/filters/CSV are honestly deferred in-surface ("coming soon" = 148). | Sketch 061 winner B + operator 2026-07-10 |
| 52 | **Audit receipt = the always-on ledger (062-A).** The receipt for an operator action is the action itself landing at the top of the always-visible "Recent operator actions" card on the Control Room Overview (the row slides in; the band's recording marker flashes gently) — **no toasts, no counters: the ledger IS the receipt.** Write actions carry a leading **✎ mark**, so "what did I change" vs "what did I look at" scans instantly; the full history lives in the Audit tab (count-pill on the tab). **Consequence ≠ receipt:** a write that stays in effect (maintenance mode) keeps its own persistent amber banner ("users currently see the platform read-only") — the feed row says *recorded*, the banner says *still true*; two truths, two homes. Receipts are plain sentences ("Turned ON maintenance mode"), never action codes (the 061-B plain-first rule). This vocabulary is inherited by every later admin write: Kill run / kill-switches / maintenance (147), user disable/enable (148), model capability edits (149), key saves (150). Rejected: B receipt toasts (cleanest Overview, but the proof evaporates — trust decays under repeated writes), C counting marker (ambient, zero shift, but proves *something* was recorded, not *what*). | Sketch 062 winner A + operator 2026-07-10 |
| 53 | **Operator Control Plane composition = pinned health header + sectioned scroll (063-B).** Phase 147 (ADMIN-02) unlocks the 061-B Control Plane tab as the operator's live surface: a compact always-pinned VITALS strip (Redis / Database / Code-sandbox status dots + Agents-working + Server-capacity) that never scrolls away — a monitoring posture — over a single scroll of Health detail (3 dependency cards + the four REAL `/admin/backpressure` signals under plain labels) → Active runs (064-B) → Controls (065-A) → Activity (062-A ledger). Dependency HEALTH (reachability + latency) is net-new on the additive-only D-078-08 backpressure JSON; the four capacity signals are the REAL Phase-078 payload. The honest degrade state is load-bearing — the pinned vitals go amber/red even while scrolled into Controls (the 'One slow / One down' preview proves it; a monitor you can't see isn't a monitor). Rejected: A one-scroll (health scrolls away), C sub-tabbed (over-structured for current volume; the documented scale-up if the runs table + audit browser outgrow a preview). | Sketch 063 winner B + operator 2026-07-11 |
| 54 | **Active runs + Kill = confirm-sheet run cards that name the victim (064-B).** The cross-provider live run list (SC#10) renders each in-flight run as a calm card — real `@lobehub` provider mark [048 map] + model + user/workflow + live-ticking elapsed + what it's DOING now (current tool/step) — so a healthy run reads distinct from a runaway (a >8-min run tags 'long-running'; a stalled one tags 'not responding', red). Kill opens a small **confirm sheet that names the victim** ('End maria's run on GPT-5, 2m 14s in — cancels immediately, recorded with your name') — chosen live OVER the pre-review arm-to-confirm lead (inline arm felt too easy to fire for an action with a victim). Kill delegates to the existing `cancel_run` zombie-heal (`runs.py:1097`, D-062-11): the killed card shows an HONEST two-state Cancelling… → Cancelled·recorded, and a stuck run reads 'recovered a stuck run' not 'killed'. Empty state ('No runs in flight') is calm, not broken. The confirm-that-names-the-target is the linkage rule for every target-specific destructive action. Rejected: A arm-to-confirm inline, C press-and-hold (tactile but unconventional for an admin table). | Sketch 064 winner B + operator 2026-07-11 |
| 55 | **System controls = capability card grid + a spatially-separated maintenance panel (065-A).** The four fail-closed kill-switches (Web search / Code sandbox / Self-improvement / Workflows — riding the existing `app_settings` TTL cache; `web_search_enabled`+`sandbox_enabled` already exist, the rest net-new keys, NO new flag infra per SC#4) render as a 2×2 card grid; turning one OFF tints its card red, adds an 'off for everyone' tag, and reveals the CONCRETE impact ('2 runs using code will error on their next call') — OFF looks armed, not a neutral preference. Maintenance/read-only mode is set APART in its own amber-framed 'Platform state' panel — the distinction between 'one capability off' and 'the whole platform read-only' is carried by WHERE it lives. Graded guard: capability switches flip DIRECTLY (fast for an emergency); maintenance uses arm-to-confirm (the platform-wide guard, shared shape with 064's Kill) + the persistent 062-A consequence banner. Rejected: B weighted-list (weaker maintenance distinction than a separate zone), C two-tier (strongest split but heavier framing than needed). | Sketch 065 winner A + operator 2026-07-11 |
| 56 | **Control Plane navigation & linkage contract (066 — reference).** Built on the operator's explicit ask to wire the surface as a WHOLE, not three sketches that drift at implementation. The three winners compose into ONE surface (063-B frame · 064-B run cards · 065-A controls · 062-A ledger). The contract (mirrored in 066's README + the sketch itself): **Band tabs** — Control Plane (live 147, the landing) · Users&Access (🔒148) · Model Registry (🔒149) · Secrets (🔒150) · Audit log (live 146); locked tabs refuse honestly naming the phase. **Every button→destination** (15 numbered): the recording marker + 'View all ›' → Audit log; Back-to-app exits the room; Refresh/⌥-tech are display/read; Kill (write `run.kill`) → sheet → `cancel_run`; capability switches (write `flag.*`) flip direct; maintenance (write `maintenance.set`) arm-to-confirm; run cards are READ-ONLY (no drilling into another user's thread — monitoring, not surveillance; impersonation = a 148 named-trigger). **7 consistency guards**: one 062-A receipt vocabulary; graded action-guards by SHAPE (target-specific→naming sheet, global→arm, reversible-per-user→direct); consequence≠receipt; plain-language default + ⌥ technical reveal (LANG-01/154); honest locks; non-discoverable/404 (146 red line); read-only monitoring. **Open decision D-147-IA** (→ discuss-phase): PROMOTE the 146 'Overview' tab to become the live 'Control Plane' (one landing, no duplicated health) rather than a parallel thin Overview — recommended + designed that way; ratify at discuss. | Sketch 066 reference + operator 2026-07-11 |
| 57 | **Audit browser = ONE browser, BOTH ledgers, chip-filter grammar over a paged table (067-A).** The Audit tab grows a source switch — **Operator actions** (`operator_audit_log`) \| **Platform activity** (`audit_log`, the REAL 19-action CHECK vocabulary migs 030+071) — over the 029-A chip grammar ("Show [action] [when] [user / ✎ changes-only]"), a live match count, a paged instrument table, and CSV export. Honesty beats are load-bearing: the Export button always **names its row count**, exports the FILTERED set, and the export itself lands in the ledger (`audit.export`); **switching to Platform activity records `audit.view_platform`** — looking at user activity is itself visible, never silent (the SC#4 cross-user-read threat made legible); plain-first action labels with the raw `action_type` codes behind ⌥ Technical names (LANG-01); amber zero-count + "Clear all filters" empty state. Platform `audit_log` has NO operator read path today — the whole browse API is net-new 148. Rejected: B day-grouped feed (narrative scan, weaker precise slicing), C query-rail explorer (most power, most chrome). | Sketch 067 winner A + operator 2026-07-11 |
| 58 | **Users & Access = instrument-table roster + graded guards + honest lockout story (068-A).** One dense table: identity (+ joined · docs · chats), **last-active from `last_sign_in_at`** (recent=green, stale=dim, `never signed in` italic — never fabricated), status, role, per-row actions. **Disable = a target-specific action WITH a victim → the 064-B victim-naming confirm sheet** ("maria@acme.co loses access immediately — sign-in refused, API refused, in-flight run cancelled; their data stays, untouched; reversible; recorded with your name"); **Enable = restorative → flips direct** (deliberate asymmetry); **self-rows cannot disable/demote themselves** (lockout-proof guard). Disable rides the GoTrue ban mechanism + an app-layer check so "cannot access the app" is API-enforced, not UI-hidden. **Grant/revoke operator ships in the sketch FLAGGED "possible scope — ratify at discuss"** (mig 095's `granted_by` anticipated it): an amber sheet naming the blast radius ("they can see every user's activity, kill anyone's runs…"). Every write = ✎ receipt on the row + the band marker flash (062-A). Rejected: B expandable rows (investigation-first — its recent-activity expansion is a documented graft via the 067 browser's user filter), C roster+detail panel (a second layout pattern inside one Control Room). | Sketch 068 winner A + operator 2026-07-11 |
| 59 | **Feature visibility = audience rows on Users & Access + the EXTENSIBLE-AUDIENCE forward-compat contract (069-A + operator directive).** Per-feature cards with a two-position audience control (*Everyone* \| *⛨ Operators only*), a concrete consequence line on hide ("end users no longer see X — and their API calls are refused server-side"), and an expandable "what exactly this controls" (UI surface · refused API · who decides; route prefixes behind ⌥). **Placement = Users & Access** (visibility governs WHO — the 065-A location-carries-meaning rule; the in-Controls foil is REJECTED: "OFF for everyone" and "Operators only" as styling-only neighbors). Enforcement = a **require-visible router dependency** on the same `app_settings` TTL substrate as the 147 kill-switches (no new flag infra); default-deny posture like `require_operator` (403-vs-404 = discuss decision); every flip = ✎ `visibility.set`, direct with receipt (reversible, no victim — 066 graded-guard rule). Day-one map: Skill Studio (ONE flag covers "eval studio" + "trigger tuner" — the tuner is a Studio tab per 057-A), model management, workflow authoring/publishing (additive scope, Run stays for everyone), governance health. **The forward-compat contract (operator, 2026-07-11, Glean-grounded — research FEATURES.md 1c):** Glean's reference model = IdP/directory groups (departments) → **group-based feature greenlists** → permission-aware per-request doc checks. Our two-position control is the degenerate two-audience case of a greenlist, so: (1) the stored audience value is an **extensible enum-shaped record, NEVER a boolean** (v3.4 adds roles/groups without re-meaning stored values); (2) the segmented control is designed to grow into an audience picker; (3) `require_visible` resolves audience via one swappable function ("is operator" → "is in group" at one boundary); (4) the roster's role column renders as a chip-set (operator/member today; roles/departments later); (5) doc-level ACL mirroring is explicitly v3.4+ (SEED-115). B's live end-user preview = documented enhancement (a later "view as user" affordance). | Sketch 069 winner A + operator 2026-07-11 |
| 43 | **3D icon vocabulary adopted as the SHARED `PHASE_GLYPHS` upgrade (127 cross-cutting; operator "everywhere").** The flat phase-type glyphs ⚙✎🤖⛓☺◆ (`soulData.ts` `PHASE_GLYPHS`, the single shared map) upgrade to a 3D icon set; ONE additive map swap propagates to the workflows-page card + run soul header + publish soul + the 127 gauntlet stages + step cards — so 127's 3D screens never sit under a flat-glyph soul (consistency, not contradiction). Provider/model logos source = the installed `@lobehub/icons` (all 8); the sketch placeholders for Kimi/GLM/MiniMax are NOT shipped art. Build MUST verify every chosen 3D slug resolves (the 051 Goal stage hit `fluent-emoji:direct-hit` = empty → fixed to `bullseye`) or bundle the SVGs. | Phase 127 + operator 2026-06-27 |
| 60 | **Model capability editor = provider-grouped instrument table with inline-edit cells (070-A).** The Control Room "Model Registry" tab body (Phase 149, MODEL-01) renders the registry as provider-grouped collapsible sections over the REAL `model_capabilities_overrides` columns (`context_window_tokens · max_output_tokens · native_tools · llm_call_timeout_seconds · enabled`); numeric cells are **click-to-edit inline** (112/FolderNode pattern), changes effective on the next request (existing TTL cache, no restart). The **two-layer SEED-116 pattern is MADE VISIBLE**: `enabled` drives a derived "✓ in picker / ✕ hidden" coupling chip (what users see) + a per-model **🔓/🔒 LOCK** (operator pins org default / disallows user override). **Override-vs-inherited honesty**: `OVR` (stored edit) reads distinct from `DEF` (inherited from the built-in `MODEL_CAPABILITIES`, dim+italic) with a Reset. Rides 061-B band + 062-A **✎ `model.capability.set`** receipts + plain-first labels with **⌥ Technical names** revealing raw field names; provider logos = @lobehub (RDD 48). "deprecated" is shown as a flag but marked a **SCHEMA QUESTION** (no `deprecated` column today — discuss/research). Rejected: B list+detail panel (comfortable but slow for a 40+-model registry — documented alt), C card grid (visual, weak cross-model comparison). | Sketch 070 winner A + operator 2026-07-12 |
| 61 | **Model discovery = grouped propose→confirm diff list; propose-only is the visual hero (071-A).** Phase 149 MODEL-02: "Run discovery" queries each provider's `/models` as **per-provider live run cards** (stable-start-ts timer; a rate-limited provider shows its VERBATIM error, excluded-not-failed — the 058/060 lesson; a "capabilities ✓" vs "IDs only" badge per provider). Results render as **✚New / ±Changed / ⊘Vanished** groups. **SC#3 IS THE HERO**: capabilities auto-fill ONLY where the provider returned them (Google + OpenRouter return full metadata; OpenAI/Anthropic/OpenAI-compat return IDs only), and un-returned fields render as explicit amber **"unknown — you set it"** inputs, NEVER a guess — a new model with unknown capabilities can never be auto-enabled (reproducing the silent no-tools bug is barred). **Vanished models are FLAGGED** (mark deprecated / disable / keep), never auto-deleted (a model can vanish because a provider paused an endpoint). A sticky confirm bar names the count; the run logs ✎ `model.discover`, each confirmed change ✎ `model.capability.set` (062-A). Rejected: B compare-table (denser for big diffs but the "you set it" beat is subtler in a cell — documented alt), C stepper (over-structured for a usually-small diff, the 067-C lesson). | Sketch 071 winner A + operator 2026-07-12 |
| 62 | **Run-inputs modal = extend the LIVE 560px `RunModal` IN PLACE (072-A).** Phase 152 WFIN-01+02: the read-only bound-folder chip (`WorkflowsPage.tsx:794`) becomes an **inline `<select>`** mirroring chat's "All documents / {folder}" scope selector (`ChatArea.tsx:407`), with the workflow's author-time folder tagged **"workflow default"** and the per-run pick an **override** (server-enforced via the Phase-098 resolver — the model can't widen scope, SC#10 identical cross-provider). The **template upload** = a quiet `TemplateUpload`-style button (reuses Phase-100 `upload_template` → `kind='template_input'`) landing into `create_workflow_run.inputs`; on success a file card (name · size · ✓ validated · `kind=template_input` · remove), on a bad file the 422 renders inline. A one-line **provenance note** ("stored untrusted — read by the agent, never run as code or fed to the fill engine") makes the WFIN-01 threat boundary honest. The kickoff box + `input_keys` hint stay verbatim. **Scope-shape decision (SEED-112) resolved: the inline dropdown, NOT the Perplexity segmented 3-way toggle** — the toggle (B) is the documented FALLBACK if "whole-KB vs bound vs override" proves illegible in a dropdown; the two-step/panel (C) is rejected (adds a step/surface a one-glance launch doesn't need). **Net-new:** editable scope + the run-input upload channel (both violet-flagged). | Sketch 072 winner A + operator 2026-07-14 |
| 63 | **Workflow delete = a victim-naming confirm sheet, audit-recorded (073-A).** Phase 152 WFIN-03: reached from the card's ⋯-menu, the confirm names two explicit groups — **Permanently removed** (the definition · N versions · N past run records) vs **Kept — not touched** (the N chat threads those runs created **become normal chats; transcripts & files stay**; KB & folders untouched) — so the cascade is legible before commit and **no orphaned runs/threads are left** (the WFIN-03 hard requirement). Reuses the shipped **064/068 victim-naming pattern** (honest consequence sub-line + "✎ recorded with your name in the audit log"). The **in-flight-run edge** is honest: if a run is streaming, delete **cancels it first via the same safe heal path** (064's `cancel_run`/zombie-heal), then removes — shown as an amber banner. **Disposition locked at A: hard-delete definition+versions+runs; threads detached-but-kept** (clears `active_workflow_run_id`). Rejected here but documented: B type-the-name-to-confirm (promote if accidental deletes of heavy workflows surface), C archive-vs-delete two-door (promote if operators want a reversible hide). | Sketch 073 winner A + operator 2026-07-14 |

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | stream-framing | What does the live run **occupy** in the conversation stream? | **C — Run-Card** ★ | layout, structure, chat |
| 002 | tool-call-panel | What is the **shape** of a single tool call as it runs and finishes? | **C — Editor Inset** ★ | panel, tool, G-5 |
| 003 | thinking-moment | When the agent is **30+ seconds deep**, how do panels + status + thinking + text compose? | **B — Focus Mode** ★ | synthesis, long-run |
| 004 | panel-shell | How are the 4 panel sections organized + collapse / mobile, without overloading the app? | **B — Stacked accordion** ★ | layout, panel, density |
| 005 | file-and-diff | In a narrow ~30% column, how does browse → preview → version-diff flow? | **A — Full-replace + in-column unified diff** ★ | files, diff, versions |
| 006 | pending-question | When `ask_user` pauses the agent, how loud is the panel + how does answering resume it? | **C — Dual-surface (calm pin + chat cue)** ★ | ask_user, interrupt, pause-resume |
| 007 | chat-panel-seam | When a panel-owned tool fires, what shows in chat vs panel (live & on reload)? | **C — Live-pointer / reload-resolved** ★ | seam, reload, transcript |

### Phase 094 session — Workflow Legibility + Mode Clarity (2026-06-04)

Grounded by `094-grounding/BRIEF.md` (real harness SSE events, real seed-workflow content, competitive viz patterns, WCAG 2.1 AA spec). Sessions: 008–013.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 008 | phase-timeline | What does a live harness run look like IN THE PANEL — real steps/tasks, not a spinner? (operator's #1 bar) | **D — Synthesis: RunCards on a spine** ★ | panel, harness, timeline, a11y |
| 009 | unified-surface | D-094-UNIFY: how do Deep AND Harness both live in the panel; what's left in chat? | **C — Live-status → resolves** ★ | panel, unify, seam, deep |
| 010 | honesty-and-drafts | Failed-as-failed-with-a-reason; visible draft-before-ask_user; batch results; provenance answer card | **C — Pin-while-active → fold** ★ (+ long-draft wide overlay) | honesty, draft, rc-4 |
| 011 | mode-and-composer | General/Explorer × Deep/Harness clarity; simplified composer; no "Deep" label mid-Harness-run | **A — Status chip + Cancel** ★ | composer, mode, d-092-ux |
| 012 | workflows-page | Library + launcher (build now); renders existing workflow_definitions; Run → opens a thread | **A — Card grid** ★ (landed thread reuses 008-D/009-C/011-A) | page, launcher, nav |
| 013 | workflow-builder | NL authoring vision (design now, build v2.9); read-mostly live diagram, describe→refine→publish | **A — Talk-led** ★ | builder, nl, v2.9, design-ahead |

### Phase 095 session — Chat Tool-Card Unification (2026-06-05)

Grounded by `.planning/phases/095-chat-tool-card-unification/095-SKETCH-GROUNDING.md` (real SSE events, real essence strings, real bug mechanics, reuse-vs-net-new). Refines the locked 001-C/002-C/003-B chat frame for 095's fix-and-unify-in-place scope. Each sketch README carries a **Build Handover** (reuse vs net-new) section.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 014 | unified-card-frame | At rest (one-line essence) and expanded — what's the unified tool-card frame + the live Focus-Mode stack? | **Synthesis — C rail + B nodes** ★ | chat, tool-card, focus-mode, dedup, G-5 |
| 015 | status-strip-and-scroll | Where does the persistent run-status strip live so it never vanishes — and what's the follow-but-release scroll + Jump-to-live? | **C — Hybrid (header + chip on scroll)** ★ | chat, status-strip, timer, scroll, jump-to-live |
| 016 | output-files-hero | At run end, how does the output area hero the deliverable vs working files, with every link always downloadable? | **A — Hero block + working group** ★ | chat, output-files, hero, download, per-ext-icons |

### Phase 103 session — Workflows Page + NL Authoring

Grounded by `103-grounding/BRIEF.md` (real `WorkflowDefinition` vocabulary, the strictness-policy mapping `citation_policy strict|flag|partial|draft`, the per-phase gate set, `project_folder_id` vs per-phase `folder_scope`, the reuse-vs-net-new map). Requirement-first authoring: the first screen is JUST the describe box; grounding + the strictness dial + grey-area confirms appear POST-DRAFT, revealed by the draft.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 018 | requirement-first-authoring | You describe a business requirement and the AI drafts the whole workflow + sets a strictness dial — how does it confirm its grey-area guesses (ambiguous folder ref, vague scope, unmapped template placeholder) instead of silently inventing them? | **A — describe-then-confirm** ★ | phase-103, net-new, authoring, grey-area-confirm, strictness-dial, no-silent-substitution, citation-policy, llm-emit, template-fill |
| 019 | draft-refine-and-readonly-graph | How do you refine a draft by form (talk available) and see it as a read-only graph (linear phase-order spine + dashed skip branches, no drag-canvas)? | **D — vertical spine + side-panel form (synthesis)** ★ | builder, refine, read-only-graph, form, side-panel, phase-103 |
| 020 | publish-gauntlet-honesty | How does the publish moment render the real 8-stage gauntlet (lint -> golden run -> judge) as a first-class honesty surface where a judge fail is a hard wall? | **B — progress-spine + golden-run long-wait** ★ | publish, gauntlet, judge, honesty, golden-run, phase-103 |
| 021 | workflows-page-and-nav-map | What is the Workflows page — a project-filtered library of drafts + published with CRUD, strictness badges, Run-into-thread, tweak->new-version, + a nav/redirect map? | **A — card grid + project rail** ★ | page, library, nav-map, project-filter, strictness-badge, phase-103 |
| 022 | workflow-run-in-thread | When a workflow runs in a thread, can you chat — and how is the run made meaningful + consistent with the app's panel/tool surface? | **A — locked-in-thread; panel owns the meaningful spine** ★ | run, thread, panel, meaningful-steps, composer, phase-103 |
| 023 | app-linkage-map | The whole-app navigation graph — every surface + redirect; how 018-022 align with the real app nav | **A — linkage graph (reference)** ★ | ia, nav-map, linkage, redirect, reference, phase-103 |

### Phase 111.1 session — Configurable / Multi-Provider Embeddings (2026-06-16)

G-2 fired on the D-03 "serious, attention-demanding" re-embed confirmation (operator emphasis). Settings-surface sketches on `SettingsPage.tsx` (embedding settings `:934`, rerank `<select>` pattern `:959`). Inherits the locked Aether Deep Midnight theme; the picker is the structural cure for BUG-260616-01 (slashed-id → OpenRouter cloud mis-route), reused for both embedding + extraction (D-09).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 024 | embedding-provider-picker | How does the picker make you pin WHERE a model runs so a local model can't silently mis-route to cloud — reused for both embedding + extraction? | **Synthesis — A preset + C's always-on 🔒 endpoint footer** ★ | phase-111.1, settings, provider-picker, embeddings, extraction, local-routing, bug-260616-01 |
| 025 | reembed-confirm-gate | When you change the embedding model and hit Save, how does the confirmation command attention about the consequences without being a casual toast? (D-03 hard contract) | **Synthesis — C weight-frame + A's 4-fact grid** ★ (B = documented fallback) | phase-111.1, settings, re-embed, confirm-gate, d-03, must-decide-modal |
| 026 | reembed-in-progress | While the background re-embed job runs, how does the UI honestly show "search is catching up at reduced recall", progress + a re-kick for a failed/partial run? | **Synthesis — C status card (home) + slim search pointer** ★ | phase-111.1, settings, re-embed, graceful-dip, honesty, d-04, d-05, resumable |

### Phase 112 session — Document Detail Panel + Manual Edit (2026-06-17)

G-2 fired on the net-new document detail panel (the shared shell for META display/edit + REL panel (117) + CLASS suggestion (118)). The "before": metadata is a read-only inline expand-row in `DocumentList.tsx → MetadataPanel` — flat, no confidence, no edit. Confidence is stored per-field under `metadata._confidence` (0–1), bucketed High/Med/Low via settings thresholds (Phase 111.1 D-12); empty fields are genuinely absent (`exclude_none`). Inherits the locked Aether Deep Midnight theme + the workspace-panel push/split + accordion patterns.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 027 | document-detail-shell | What FORM does the net-new document-detail surface take — the shared shell that 112 (metadata), 117 (relationships), and 118 (classification) all inhabit? | **A — right-side push/split panel** ★ (B full-page = strong alt; C modal = foil) | phase-112, document-management, detail-panel, shell, shared-shell, push-split |
| 028 | confidence-and-edit | How does per-field confidence read (ConfidenceChip — tier word + glyph + score, never colour-alone) and how does inline edit / manual-override feel (the audit-write, the model→human provenance flip, empty/tentative states)? | **A — trust-gutter + scored chips** ★ (B decrescendo + C dense-triage documented) | phase-112, confidence-chip, inline-edit, manual-override, honesty, wcag, a11y |

### Phase 114 session — Virtual Folders: Range/Date Filters + View Builder + Sidebar (2026-06-19)

G-2 fired on the net-new no-DSL view/filter builder + the sidebar "Views" group (114-CONTEXT.md; Claude's-Discretion items explicitly routed "resolved by the G-2 sketch"). Grounded in the locked Aether Deep Midnight theme + the 027/028 Documents-page language (doc table, `ConfidenceChip`, right-side push/split panel, accordion sections, the Project Meridian corpus) and the real `FolderNode`/`FolderTree` shapes (amber folder icon, `G` pill at `FolderNode.tsx:183`, hover `MoreHorizontal` menu, selected state). Backend base = Phase 113 closed-registry filter compiler (`eq`/AND); 114 adds `gte/lte/one_of/contains/is_empty` + relative-date operators (D-114-4/5) and case-INSENSITIVE text matching (D-114-10). Winners TBD (sketches awaiting operator review).

**Revised 2026-06-19 after a 5-investigator integration audit (workflow `wf_dc339594-8bb`)** triggered by operator feedback (already-extracted-metadata impact; integration/contradiction with existing + future work; end-user language / sketch-030 wrap; "the folder tree is not good"). Findings: (1) **zero re-extraction** — typed columns are a `GENERATED…STORED` derivation from existing `documents.metadata`, auto-backfilled, with an error-tolerant ISO-regex date cast; (2) the case fix is mostly **query-value lowercasing** (`document_type`/`language` already stored lowercase) — not a stored-data backfill; (3) R-114-A compiler-output widening (`@>` → bound WHERE-fragments) is the one deliberate, tested contract evolution; (4) the folder tree needs a **light NavRow polish (new sketch 033)** before Views clone it. All four original sketches were revised to strip developer jargon (deleted 030's type matrix → fixes the wrap; removed phase numbers / "chunks" / "query" / decision-IDs from shippable copy; fixed 032's ConfidenceChip to the locked order). Full report: the workflow result + `decisions_needed` surfaced to the operator.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 029 | filter-builder-bar | What does the inline no-DSL condition builder occupy on the Documents page — ANDed field→op→value rows, the live "N match" count, and the "Save as view" moment — without breaking push/split? | **A — chip strip** ★ | phase-114, virtual-folders, filter-builder, live-count, save-as-view, no-dsl |
| 030 | operator-and-relative-date-control | How does the type-aware operator+value control read per field type — and specifically the relative-date control (within next N / older than N / before / after / between), honest that it recomputes live and excludes overdue? | **A — operator-encodes-direction** ★ | phase-114, relative-date, operator-menu, type-aware, honesty, no-dsl |
| 031 | views-sidebar-group | How do saved views render in the sidebar as honest saved-filters (not droppable folders) — funnel icon, count badge, reused G pill, hover Edit/Rename/Delete, empty state, active selection? (drag-drop demo is illustrative — none exists on the Documents page today) | **A — NavRow parity** ★ | phase-114, sidebar, foldernode-parity, honesty, count-badge |
| 032 | documents-page-full-composition | Does the 4-column Documents page hold when sidebar (Folders + Views) + filter bar + filtered list + an open Phase-112 detail panel are all present — and how is the width crunch (D-1) resolved at desktop + mobile? Layout choice is inherited by Phases 117/118 on the same shell. | **A — sidebar→rail (pinnable)** ★ | phase-114, consistency, layout, push-split, detail-panel, mobile, d-1 |
| 033 | foldertree-navrow-polish | The existing folder tree is "not good" — before adding a Views group, what light polish makes Folders + Views read as peers built from one shared NavRow (counts everywhere, flat Views, softened guides, labeled G, reachable actions, capped nesting)? | **A — unified NavRow** ★ | phase-114, folder-tree, navrow, parity, refactor |

### Phase 117 session — Document Relationships: Panel UI (2026-06-20)

G-2 fired on the net-new **Relationships accordion section** added to the existing Phase 112
`DocumentDetailPanel` (REL-02 / SC#1–3). This **extends the shell, does NOT build a new
surface** (the 028 panel reserves the `Relationships` slot). Grounded in `117-CONTEXT.md` (all
11 D-117 decisions), the locked Aether Deep Midnight theme + the 027/028 panel anatomy, the
Phase 116 backend contract (4 rel types, `_INVERSE_LABEL` inverse vocabulary, `_NO_ACCESS_MASK`,
follow-to-latest, idempotent create), and the `MoveToFolderDialog` picker shell. Backend base =
Phase 116 (POST/DELETE only — **no REST read**); 117 carries the net-new shared `GET` read seam
(D-117-7, share-don't-fork). Both winners = **A** (operator, 2026-06-20), then hardened by a
3-lens adversarial fidelity audit (workflow `wf_1ec2afac-687`): all 7 backend build-note claims
verified TRUE against source; 2 HIGH a11y defects fixed before lock (hover-only remove → keyboard/
touch reachable; masked "no access" row → AA contrast token) + the remove "Undo" removed to honor
re-fetch-not-optimistic (D-117-9).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 034 | relationship-section | How do outgoing + incoming typed links read in the detail-panel accordion at a 3-sec scan — rel-type chip vs sentence, the masked "no access" row, the remove control, where "+ Add link" sits — within locked grouped-by-direction + inverse labels? | **A — chip-led grouped** ★ | phase-117, document-relationships, detail-panel, accordion, grouped-by-direction, inverse-labels, no-access-masking, honest-states |
| 035 | link-target-picker | How does creating an outgoing link compose — rel-type chooser + searchable typeahead (MoveToFolderDialog shell), self + already-linked-per-type excluded, the error line, and a "this supersedes → X" preview? | **A — dialog · type-first** ★ | phase-117, document-relationships, create-link, typeahead, move-to-folder-dialog, outgoing-only, exclusion, honest-error |

### Phase 118 session — Auto-Classification: suggestion surface + rule builder (2026-06-21)

G-2 fired for **Phase 118 (Auto-Classification, CLASS-01/02/03)** — the G-2 sketch before
discuss-phase. Grounded in the locked Aether Deep Midnight theme, the shared 027/028
`DocumentDetailPanel` shell (which **reserves the `Classification` slot** these sketches fill —
extend the shell, don't rebuild), the 029-A chip-strip condition builder, the 031 NavRow/`G`-pill
+ live-count patterns, and the 028/034 honest-provenance language. **Intake decision:** sketch
BOTH surfaces; classification **rules live on a dedicated "Classification rules" surface reached
from Documents** (sidebar "Automation" group, peer to Folders + Views). Load-bearing honesty: a
rule match is **deterministic** → show matched rule + condition, never a fake confidence %;
**"suggested" ≠ "moved"** (never a silent auto-move, CLASS-02); accept → move + `classification.apply`
audit, **reversible** (CLASS-03).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 036 | classification-suggestion | How does an upload-time suggestion read + accept/dismiss — honest "suggested, not moved", matched-rule provenance (no fake %), reversible, audit receipt — in the detail-panel Classification section AND on the document row? | **A — on the doc** ★ | phase-118, auto-classification, suggestion, detail-panel, document-row, honesty, accept-dismiss, audit, reversible |
| 037 | rule-builder-and-list | How does the dedicated Classification-rules surface compose — the rules list (status/scope/condition→action at a glance) + the builder (chip-strip condition → suggested folder/tag → scope) + a live "would match N" preview — reusing 029 chip-strip + 031 NavRow/G? | **A — list + side-panel builder** ★ | phase-118, auto-classification, rule-builder, rules-list, chip-strip, enable-disable, owner-global, live-count, dedicated-surface |

### Phase 119 session — Document Governance Health (2026-06-21)

Frontier-mode proposal for **Phase 119 (Document Governance Health, DGOV-01/02)** — the
LAST v3.0 phase, a **pure consumer** of 110–118. SC#1 demands a **separate, light,
read-only** surface (explicitly *NOT* cards bolted onto the existing Library Health
dashboard) that surfaces three signal classes — **broken/dangling relationships** (116/117),
**unclassified documents** (118), **low-confidence metadata** (111/112) — and links each to
its fix (open / classify / re-extract). Grounded in the real `HealthPanel` /
`HealthDocumentRow` / `HealthEmptyState` anatomy, the Phase-112 `ConfidenceChip` (per-field
extraction score — kept DISTINCT from Library Health's retrieval-similarity "Low Confidence"
tab), the `NAV_ITEMS` / `ActiveView` nav contract, and the shared `NavRow` sidebar groups
(Folders 033 + Views 031 + Automation 037). Two honesty locks: read-only aggregation (the
page writes nothing — fix-links navigate to the real edit surfaces) and Classify never
silently moves (CLASS-02). Winners TBD (awaiting operator review). **The 038 + 040 winners
must agree on IA placement** (top-level home vs. Library-Health lens vs. in-Documents).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 038 | governance-health-surface | What form does the read-only governance view take, and where does it live in nav relative to Library Health — three HealthPanel cards (own home), one prioritized worklist (Library-Health tab), or a posture-hero + collapsible sections (in Documents)? | **A — card-grid, own top-level home** ★ | phase-119, governance-health, dgov, surface, ia, nav, read-only, health-panel, honesty |
| 039 | signal-row-and-fix-action | How does one governance signal row read + how does its "fix" link behave per signal type (open relationships / classify / re-extract), how does the row resolve after a fix (re-fetch-not-optimistic), and the honest empty + ConfidenceChip-not-similarity states? | **A — inline verb buttons** ★ (+ C's mask-gated expand graft; B = strong honesty alt) | phase-119, governance-health, dgov, signal-row, fix-action, detail-panel, honesty, re-fetch, confidence-chip |
| 040 | documents-sidebar-composition | Does the Documents left rail hold with Folders + Views + Automation all present (consistency vs sketch 032, pre-Automation) — and where is governance health reached from? | **A — governance top-level, rail stays pure** ★ (C = density fallback) | phase-119, consistency, layout, sidebar, navrow, folders, views, automation, governance, push-split, mobile |

### Phase 123 session — Skill Triggering Quality: Trigger Tuner + Lint (2026-06-23)

G-2 fired on the net-new **Skill Trigger Tuner UI** (TRIG-01 / D-07) — the G-2 sketch before plan-phase.
Grounded in `123-CONTEXT.md` (14 decisions D-01..14), the locked Aether Deep Midnight theme, the **real
3-pane `SkillsPage`** (16px rail · skill list · 384px `SkillDetailPanel`) + the real `SkillForm` fields
(Name / Description / Instructions), and the **real production model-ids per SC#10 axis** from
`scripts/eval_cross_provider.py` (`gpt-5.4-mini` · `claude-haiku-4-5` · `gemini-3.5-flash` · `z-ai/glm-5.1`).
Reuses `forced_emit` (candidate gen + per-case classification), the cross-provider scoreboard rig, the
Phase-061+ run-buffer + SSE (background job), `PATCH /skills` (author-confirm write), and the
`resolve_authoring_model()` knob pattern (D-08 builder model). The load-bearing runtime change (D-01:
descriptions drive `load_skill` firing) makes the should-NOT-fire benchmark axis the false-fire safety rail —
**SC#10 cross-provider UAT is MANDATORY**. CTX-03 (pin loaded-skill out of the trim window) is backend-only →
no UI surface, not sketched. Winners TBD (awaiting operator review).

**Provider-set adaptivity (operator-raised 2026-06-23 — load-bearing):** the per-provider scoreboard is
**N-column, driven by the org's configured/enabled targets — NOT a fixed four.** A provider the org doesn't run
**never renders** (a score you can't act on is a fabricated measurement). **Single-provider is the clean
baseline, not a degraded mode** (Anthropic-only → "tune for Claude," one column; self-hosted DeepSeek → one
column + builder model can be self-hosted → the whole loop runs **air-gapped**). **OpenRouter is one gateway** —
native DeepSeek / GLM (zhipu/z-ai) / Kimi (moonshot) / MiniMax are first-class targets distinct from
OpenRouter-routed copies (serving path ≠ model name; cf. Phase 115 Gemini schema, Phase 122 `emit_tier`).
Targets default to "the models you actually use"; the **SC#10 4-axis recipe is the dev/QA gate for building the
feature, never a runtime requirement on the org.** Sketch 042 carries a provider-set adaptivity band
demonstrating all three org shapes; 042/043 READMEs hold the build contract for plan-phase.

**Winners locked = all A (operator, 2026-06-23):** 041-A focused full-surface · 042-A candidate cards +
per-provider grid · 043-A two-column should/should-NOT lists · 044-A inline-under-Description lint. See
Running Design Decisions 32–35 below.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 041 | tuner-surface-shell | What FORM does the Trigger Tuner take, and where does it live vs the 3-pane SkillsPage given it's far bigger than the 384px detail panel — focused full-surface, wide push/split panel, or in-panel accordion? | **A — focused full-surface** ★ | phase-123, trigger-tuner, surface, shell, ia, skills-page, trig-01 |
| 042 | scoreboard-and-candidates | How does one tuning iteration read — per-provider held-out score, the ≤N candidate rewrites each auto-scored, picking the winner by held-out score, the author-confirm → PATCH, with the false-fire axis always visible? | **A — candidate cards + per-provider grid** ★ | phase-123, trigger-tuner, scoreboard, candidates, held-out, honesty, author-confirm, trig-01 |
| 043 | case-editor-and-live-run | How do the hybrid auto-seeded should-fire / should-NOT cases read + edit, how does the 60/40 train/held-out split show, and how does the multi-minute background run render live per-provider progress? | **A — two-column should/should-NOT lists** ★ | phase-123, trigger-tuner, case-editor, benchmark, held-out-split, background-run, sse, trig-01 |
| 044 | lint-warning-and-handoff | How does the never-block weak-description warning read in the Skills form (D-09), the one-click "Tune this" handoff (D-12), and where does the provider-agnostic builder-model knob (D-08) sit? | **A — inline under Description** ★ | phase-123, trig-03, lint, weak-description, tune-this-handoff, builder-model, d-08, honesty |
| 045 | tuner-prerun-editor-at-scale | How does the pre-run case editor read + edit at the org's REAL scale (one seeded case per sibling skill → dozens), and where does it live so it has room — fixing the 123.1 live-UAT wall (illegible 9–11px cases jammed in a 360px rail while the results column sits empty)? | **B — full-width stack** ★ | phase-123.1, trigger-tuner, case-editor, density-at-scale, layout, gap-closure, bug-260624-01 |

### Phase 124 session — Workflow Studio UX: Soul + Strict↔Loose (2026-06-26)

G-2 fired on the Workflow Studio re-skin (CORE Phase 124 — WUX-01 soul object + WUX-02 strict↔loose; `/gsd:sketch` before discuss/plan). Grounded in the locked Aether Deep Midnight theme + the REAL Workflow Studio surfaces being re-skinned (021 library card · 022 run-in-thread · 020 publish gauntlet · 018/019 builder) and the REAL data shapes (`business_requirement` [shown nowhere today], the ⚙✎🤖⛓☺◆ phase-type glyphs, `deriveTier()` → 🔒 STRICT / ◐ MIDDLE / ○ LOOSE with `llm_judge_rubric` always-on, the `llm_emit` deliverable). G-5 hot files in scope: `panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx` (the soul header is an additive sibling, not a timeline-internals edit). Built via a build → adversarial design-fidelity critique → refine workflow (`wf_638fc39a-c58`, 6 agents); both refined sketches render headlessly clean (046: all 27 compositions error-free; 047: live `deriveTier` recompute STRICT→MIDDLE→LOOSE + locked judge verified). **Winners = both A (operator, 2026-06-26).** See Running Design Decisions 36–37.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 046 | workflow-soul-object | What IS the soul of a workflow, and does the same essence survive across the library card / run header / publish summary? | **A — Purpose-led** ★ | phase-124, wux-01, soul-object, glyph-dot-spine, deriveTier, business-requirement, consistency |
| 047 | strict-loose-two-doors | How do "Describe & run" and "Author & govern" present as two doors (keyed off deriveTier) so a loose user moves fast, a power user loses nothing, and a strict workflow keeps its governance? | **A — Explicit fork** ★ | phase-124, wux-02, strict-loose, two-doors, describe-and-run, author-and-govern, deriveTier, judge-always-on |

### Phase 128 session — Chat Tool-Card Unification + Chat-Area Reclaim (2026-06-27)

G-2 fired on the reframed Phase 128 (STRETCH) — the narrow "Live Description Before `tool_start`" (TDP-02) bundled with four operator-raised chat-surface improvements (CTC-01..04) that share the same surface + G-5 hot files (`ToolCallPanel.tsx` / `RunCard.tsx` / `MessageItem.tsx` / `ChatArea.tsx`). REFINES the LOCKED 014/015/016 chat tool-card frame (the step rail + the never-vanishes status strip + the hero file block) — NOT a new frame. Grounded in `128-grounding/GROUNDING.md` + the REAL "before" code (the brand-pulse avatar `RunCard.tsx:280`, the redundant `StickyTimerBar` `ChatArea.tsx:533`, the 3 elapsed surfaces, the full-height user bubble `MessageItem.tsx:205`, the 8-provider `MODEL_CAPABILITIES` set, `message.provider`/`message.model` already threaded). Built via a build → adversarial design-fidelity critique → refine workflow (`wf_def489d0-8e2`, 9 agents); all three render headlessly clean (`node --check` + tag-balance + DOM-shim boot). **CTC-01 logos replaced post-review with the REAL official `@lobehub/icons` marks** (operator feedback — approximations → real; stored as assets at `048/logos/`, no cross-provider gradient-ID collisions). **Winners = all A (operator, 2026-06-27);** 049 B rejected as imperceptible (the A/B delta = floating-chip pop timing only). See Running Design Decisions 38–40.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 048 | cross-provider-tool-card | What does the unified tool-card header look like across all 8 providers — provider logo (replacing the brand-pulse dot) + the live "about to…" description before `tool_start` + one canonical layout every provider fills identically? | **A — Real brand marks** ★ | phase-128, tool-card, header, provider-logo, ctc-01, ctc-02, tdp-02, cross-provider, G-5 |
| 049 | chat-area-reclaim | With the card now canonical, can we delete the redundant sticky composer timer — and does always-visible status survive on the header strip + floating chip alone? | **A — Clean removal** ★ | phase-128, chat-area-reclaim, ctc-03, sticky-timer, elapsed-surfaces, before-after, honesty |
| 050 | long-prompt-readmore | How does a long user prompt collapse to a clamped preview + "Read more" — clamp height, fade, expander placement — without breaking the right-aligned bubble? | **A — Fade + inline Read more** ★ | phase-128, long-prompt, read-more, ctc-04, message-item, user-bubble, clamp |

### Phase 127 session — Gauntlet Pip-Strip + Quiet Idle Cards (2026-06-27)

G-2 fired on Phase 127 (STRETCH, WUX-03) — the G-2 sketch before discuss/plan. A **density re-skin
of two already-shipped surfaces** (the publish gauntlet `PublishGauntlet.tsx`, winner 020-B; the live
phase spine `PhaseCard.tsx`/`PhaseTimeline.tsx`, winner 008-D/022-A), riding on the Phase 124 soul
work. **Operator creative direction (2026-06-27):** make it *visually engaging / innovative* — imported
**3D icons** (Iconify `fluent-emoji`), an **Asian-tech energy language** (gradient/glow, energy flowing
along the spine, the live step "building"), and **which AI engine** powers each step (hand-built
provider marks featuring the Asian-tech natives DeepSeek/Kimi/GLM/MiniMax + Claude/Gemini). Grounded
in the REAL shipped code: the gauntlet's `GauntletSpine`/`VerdictFields` and the verbatim-verdict /
judge-hard-wall / 4-HTTP-outcome contracts; the `PhaseCard` status-atom / failure-taxonomy /
gate-chip / APG-accordion a11y contracts; **and Phase 124's shipped soul** (`<WorkflowSoul scale="pub">`
above the gauntlet; `scale="run"` above the live spine in `WorkspacePanel.tsx`; `scale="card"` on the
workflows page). Both sketches render the 124 soul header for context so 127 reads as a **complement,
not a contradiction**.

**The one cross-sketch consistency DECISION (surfaced to operator):** the shipped soul uses **flat
glyphs** ⚙✎🤖⛓☺◆ (`PHASE_GLYPHS` in `soulData.ts`, the single shared map). 051+052 introduce **3D
icons**; to stay consistent the 3D set should become the shared `PHASE_GLYPHS` vocabulary — one
additive map swap propagates to the workflows-page card + run soul header + publish soul + the new
127 cards at once. Confirm breadth at plan time. ⚠ G-5: `PhaseCard.tsx`/`PhaseTimeline.tsx` are shared
with the live harness run — re-run replay tests.

**Winners = both A (operator, 2026-06-27).** Energized intensity locked (operator-loved; calm anchor kept as the in-sketch toggle). **3D icons adopted everywhere** (the shared `PHASE_GLYPHS` upgrade — see Running Design Decision 43). Icon fixes applied post-review: the Goal stage's `fluent-emoji:direct-hit` was empty (not in the set) → `bullseye`; the engine chips now use the REAL Iconify `logos:` marks where available (DeepSeek/Claude/Gemini), with the build sourcing all 8 from the installed `@lobehub/icons`. See Running Design Decisions 41–43.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 051 | gauntlet-pip-strip | How does the publish gauntlet read at a glance — an energized pip/energy-spine + plain-worded pass/block + raw-on-demand — without softening the verbatim-verdict / judge-hard-wall / 4-HTTP-outcome contracts (sitting under the 124 soul block)? | **A — Recipe-literal** ★ | phase-127, wux-03, publish-gauntlet, pip-strip, worded-verdict, raw-on-demand, energized, 3d-icons, provider-engine, honesty |
| 052 | living-step-flow | How does an idle step stay quiet (no type-lecture, no placeholder, no animation) while the active step glows + flows + names its AI engine + "builds," done steps fold to essence — under the 124 soul header, within the shared G-5 harness+workflow card + a11y? | **A — Density-by-status** ★ | phase-127, wux-03, quiet-idle, phase-card, run-surface, living-flow, energized, 3d-icons, provider-engine, g5-hot-file, a11y |

### Phase 137 session — Skill Evals Panel (PANEL-01) (2026-07-03)

G-2 fired on Phase 137 (PANEL-01) — the sketch-gated consolidation of the whole v3.2 eval
experience. **The brief is the operator's own 136-UAT feedback** (`136-HUMAN-UAT.md` Gaps):
gate status discoverable only inside the confirm dialog + buried in a dense edit panel;
"Publish ready — eval passed 1/1" adjacent to "0/2 with-skill cases passed" (different
metrics — gate is CURRENT-VERSION-bound, verdict line is LATEST-RUN — no hierarchy) reads
contradictory; verbatim *"messy UI, too much information."* The "before": everything (form +
`SkillTestCasesSection` + the 924-line `SkillEvalSection` stack) lives inside the skill EDIT
dialog in the ~384px resizable detail panel. PANEL-01 contract: test-case editor · run history
· run detail (per-case side-by-side + pass/fail) · inline ratings · version history
(diff-viewable); **additive — no Skills-tab redesign**. Grounded in the REAL wire shapes
(`TestCase` / `EvalRun` rollup / `EvalResult` verdict_state incl. honest `not_measured` +
`judge_error` / `PublishGate` 4-state + `last_override` / `SkillProposal` + `PromotionGate`
counts) and the precedent stack: 041-A focused-full-surface (the Tuner hit the SAME 384px
wall) + 045-B density lesson · 004-B/027-A stacked accordion · 005-A full-replace drill-in +
in-column unified diff · 051-A worded-verdict + raw-on-demand · 048 provider marks (logo
assets reused from `048/logos/`).

**Winners locked (operator, 2026-07-03):** 053-A focused full-surface · 054-B lifecycle stepper ·
055-B expandable rows · 056-B table + compare picker · 057-A persistent-header + 3 tabs. See
Running Design Decisions 44–47.

**Operator verification question (2026-07-03) → LOCK + sketch 057.** Reviewing the session plan the
operator asked whether (a) the full button-by-button navigation (every entry point → destination)
and (b) where the shipped Trigger Tuner lives relative to the new Evals surface had been considered
— both honest gaps (041-A was used as a *pattern*, not resolved as an *IA neighbor*; no 023-style
linkage map existed). **Operator LOCKED: Tuner ⟷ Evals = tabs of ONE unified Skill Studio.** This
effectively selects the focused-full-surface FORM for 053's shell (the Studio); sketch 057 refines
the tab composition (A header+3-tabs / B Overview-landing / C two-tabs) and carries the complete
every-button→destination MAP as a reference view: the SkillTunerPage is ABSORBED as the Triggering
tab (internals untouched — a re-homing, not a rebuild), the 044-A lint "Tune this →" handoff
re-points to Studio · Triggering, and the 136 PublishGateDialog gains ONE net-new "Review evals →"
link on the unmet branch (closing the "gate only discoverable in the dialog" complaint).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 053 | eval-studio-shell | Where does the Skill Evals panel LIVE — focused full-surface (041-A mirror), in-panel stacked accordion + drill-ins (004-B/027-A), or panel-resident expand-to-wide (032-A rail-collapse) — given five subsurfaces and a side-by-side run detail that needs width? | **A — Focused full-surface** ★ | phase-137, panel-01, shell, ia, skills-page, full-surface, accordion, push-split |
| 054 | one-truth-status | How do publish gate + latest-run verdict + proposal state compose into ONE honest read that can't be misread as contradictory — version-bound status hero, lifecycle stepper, or worded verdict + raw-on-demand? | **B — Lifecycle stepper** ★ | phase-137, panel-01, gate-01, status-hierarchy, honesty, version-bound, worded-verdict, contradiction-fix |
| 055 | run-history-and-detail | How does the eval run history read, and how does drilling into per-case side-by-side WITH/WITHOUT outputs + honest verdicts (graded / not_measured / judge_error) + inline thumbs ratings feel? | **B — Expandable rows** ★ | phase-137, panel-01, eval-03, eval-04, run-history, side-by-side, ratings, honest-verdicts, drill-in |
| 056 | version-history-and-diff | How do immutable versions read — which is LIVE, diff between versions, provenance (manual / proposal-promoted / forced-override), per-version eval binding — and where does the 135 proposal card terminally rest? | **B — Table + compare picker** ★ | phase-137, panel-01, ver-01, si-01, version-history, diff, provenance, promotion-gate |
| 057 | skill-studio-linkage | With Tuner ⟷ Evals LOCKED as unified Skill Studio tabs, how do the tabs compose (persistent-header+3-tabs / Overview-landing / two-tabs) — and what is the complete every-button→destination navigation contract (incl. Tuner absorption + the PublishGateDialog seam)? | **A — Header + 3 tabs** ★ | phase-137, panel-01, skill-studio, tabs, ia, nav-map, linkage, tuner-absorption, reference |

### Phase 137.1 session — Skill Eval Production-Clean (2026-07-04)

G-2 fired on Phase 137.1 (EVAL-05 / SEED-100 promoted) — the three net-new UI surfaces:
matrix-run rows, determinate run progress, and the Settings Engine-health card. The
sketches EXTEND the 053–057 Studio language (055-B expandable-row grammar is the locked
base — the matrix is a group OF those rows, never a new surface; the shipped
`RunBar`/`RunHistory`/`RunCaseDetail` are the homes). Grounded in `137.1-CONTEXT.md`
(D-01..D-14): D-05 explicit gate-feeder (ONE config feeds the publish gate, default =
the active provider, others analysis-only), D-07 aggregation = mean±stddev/delta per
config across accumulated run HISTORY (stddev only at ≥2 runs — ×1 run per provider per
click, no repeat knob), D-08 deterministic analyst notes with fixed phrasing (never an
LLM paragraph), D-01/D-02 the smoke sweep IS a matrix run over a hidden built-in smoke
case asserting ENGINE health (✗ = a VERBATIM provider error, never engine-shaped; a
model may honestly fail the case and still be a healthy row), D-03/D-04 Settings board
with staleness-always-shown + on-demand only, D-11/D-12 the shared `harness_judge_model`
knob (UI-only — the setting exists end-to-end; registry-validated picker; effective
default `claude-opus-4-8` shown when unset). Honest-state vocabulary carries from
134/137: `not_measured` excluded-never-failed with the verbatim provider error, no
mid-run verdicts, one-truth gate. Unit math = cases × 2 arms + 1 judge step (judge as
ONE unit — confirm at plan). Per-arm wall-clock duration renders live (checklist) and
at rest (arm cards, next to tokens). The judge `case_feedback` is ADVISORY — violet
info vocabulary, never blended with verdict chips. Provider marks in the sketches are
placeholders — the build uses the single-source `@lobehub/icons` 048 map. Each sketch
carries a live sim (launch a matrix / a run / a sweep and watch it) for the G-4
lived-experience bar.

**Winners = all A (operator, 2026-07-04):** 058-A grouped matrix card · 059-A thin
unit bar + inline feedback · 060-A tile board. See Running Design Decisions 48–50.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 058 | matrix-launch-and-rows | How does ONE click fan a skill's eval across N providers as N parallel run rows — launcher + D-05 gate-feeder designation (the all-configured-vs-checkboxes discretion is the variant axis), the matrix group inside the 055-B run history, and the D-07 history-derived mean±stddev/Δ aggregation + D-08 deterministic analyst notes? | **A — Grouped matrix card** ★ | phase-137.1, eval-05, matrix-runs, run-history, gate-feeder, aggregation, analyst-notes, 055-b-extension |
| 059 | determinate-progress-and-case-feedback | How does a RUNNING eval row read with determinate progress (units = cases × 2 arms + judge), per-arm wall-clock duration live + at rest, and where does the judge's never-blocking case_feedback land — inline block, weak-case tag, or run-level digest? | **A — Thin bar + inline feedback** ★ | phase-137.1, eval-05, determinate-progress, per-arm-duration, case-feedback, run-row, 055-b-extension |
| 060 | engine-health-card | How does the Settings Engine-health board answer "how do I know the engine works for all 8 without hand-running them" — tile board / row list / posture strip, staleness always shown, verbatim provider errors, links to smoke runs — plus the shared judge-model knob (D-11/D-12)? | **A — Tile board** ★ | phase-137.1, eval-05a, smoke-sweep, engine-health, settings, staleness, judge-model-knob |

### Phase 146 session — Operator Foundation: Control-Room Shell (2026-07-10)

G-2 fired on Phase 146 (ADMIN-01) — the first phase of v3.3 Operator UX. Intake decisions
(operator, 2026-07-10): **distinct control room** (not just-another-surface, not a separate
world) · **operator-only shield nav entry** (probe-gated; a non-operator's UI is byte-identical
to today) · **full map, honest locks** (all future sections visible from day one, dimmed with a
calm refusal). Grounded in the REAL `/admin/backpressure` payload (Phase 078:
`anyio_threadpool_depth` / `redis_active_runs` / `postgres_pool_in_use` /
`per_worker_run_count`), the net-new `operator_users` + `operator_audit_log` (who/what/when),
the `require_operator` default-deny 404 gate, and the no-router `useState<ActiveView>`
full-surface precedent (Skill Studio / Tuner). **Winner B, revised plain-language-first on
operator feedback** (technical parameter names → user-known words; the "⌥ Technical names"
toggle prototypes the LANG-01 / Phase 154 two-audience reveal at 146). A (a second left admin
rail) **rejected** — two adjacent nav rails; C (tile board) = documented alternative. The
"Viewing as → Regular user" toggle demonstrates the zero-trace/404 contract in-sketch. See
Running Design Decision 51.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 061 | control-room-shell | What shape is the operator control room — how do the admin sections, the zone identity, and the honest day-one landing compose, given non-discoverability and only backpressure + audit being real at 146? | **B — Operator band + tabs, plain-language-first** ★ | phase-146, admin-01, admin-shell, operator, control-room, tabs, zone-identity, honest-locks, plain-language, non-discoverable |
| 062 | gate-honesty-and-receipts | After an operator acts, how does the UI prove it was recorded and where does the history live — always-on ledger, receipt toasts, or a counting marker? (The vocabulary every 147–150 admin write inherits.) | **A — Always-on ledger** ★ | phase-146, admin-01, audit-receipt, recording, ledger, honesty, write-mark, consequence-banner |

### Phase 147 session — Operator Control Plane: health · active-runs + Kill · controls (2026-07-11)

G-2 fired on Phase 147 (ADMIN-02 + FLAG-01) — the operator's live control surface, inhabiting the LOCKED **061-B** shell (operator band + tabs, plain-language-first) and the LOCKED **062-A** receipt vocabulary (always-on ledger + ✎ write mark + consequence banner). 147 makes REAL what 062 previewed as flagged placeholders (maintenance toggle, web-search kill-switch, consequence banner). Grounded in the REAL data shapes: the four `/admin/backpressure` signals (Phase 078, additive-only D-078-08) + net-new dependency health (Redis / Supabase / sandbox reachability + latency on the same JSON); the `runs:active` sorted set + `cancel_run` zombie-heal (`runs.py:1097`, D-062-11); the `app_settings` TTL cache (`main.py:103` — `web_search_enabled` + `sandbox_enabled` already live, self-improve / workflows / maintenance net-new keys, no new flag infra); `operator_audit_log` (net-new 146); and the `@lobehub` provider marks (048 map) for the cross-provider run list (SC#10). Three surfaces decomposed highest-risk-first (composition/health · active-runs+Kill · controls); **winners 063-B · 064-B · 065-A (operator, 2026-07-11)** — 064 chosen LIVE over its pre-review arm-to-confirm lean once the victim-naming sheet proved worth the surface for an action with a victim. **Sketch 066 (reference)** assembles the three winners into the single real surface + the whole-product **navigation/linkage contract** (band-tab IA + 15 button→destination rows + 7 consistency guards + the open **D-147-IA** Overview→Control-Plane promotion decision) — created on the operator's explicit ask to wire the menu as a whole, not per-surface. See Running Design Decisions 53–56.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 063 | control-plane-composition-and-health | How does the Control Plane tab compose the live signals (dependency health + capacity + active runs + controls) for the 3-second "healthy? + what's happening?" read — one scroll, pinned header, or sub-nav? | **B — Pinned health header** ★ | phase-147, admin-02, control-plane, system-health, dependency-health, backpressure, composition, layout |
| 064 | active-runs-and-kill | How does the live cross-provider run list read, and how does "Kill" — an action with a victim — feel deliberate + honest (delegates to zombie-heal) without a scary red-button wall? | **B — Cards + confirm sheet** ★ | phase-147, admin-02, active-runs, kill-run, cancel-run, zombie-heal, cross-provider, sc10, provider-logos, honest-states |
| 065 | system-controls-and-maintenance | How do the 4 fail-closed kill-switches + platform-wide maintenance mode read with the right weight ("off for everyone" ≠ preference) and a clear "one capability off" vs "whole platform read-only" distinction? | **A — Card grid + separated maintenance** ★ | phase-147, flag-01, kill-switches, feature-flags, fail-closed, maintenance-mode, weight, distinction |
| 066 | control-plane-assembled-and-linkage | Do the three winners compose into one coherent surface, and where does every button/link go — the whole-product navigation contract so implementation builds one spec, not three? | **Reference — assembled + linkage contract** | phase-147, control-plane, assembled, navigation-contract, linkage, ia, button-destination, reference, consistency, d-147-ia |

### Phase 148 session — Governance: Audit Browser · Users & Access · Feature Visibility (2026-07-11)

G-2 fired on Phase 148 (ADMIN-03 + VIS-01) — the governance surfaces, inhabiting the LOCKED
**061-B** shell (operator band + five 147-recomposed tabs) + the **062-A** receipt vocabulary +
the **066** graded-guard rule (target-specific → victim-naming sheet · global → arm ·
reversible-no-victim → direct). **Intake decisions (operator, 2026-07-11):** (1) the audit
browser covers **BOTH ledgers in ONE browser** — an "Operator actions | Platform activity"
source switch on the Audit tab, filters/pagination/CSV working on both; (2) **the VIS-01
visibility map lives on the Users & Access tab** (visibility governs *who*, per the 065-A
location-carries-meaning precedent) with the in-Controls placement rendered only as a foil;
(3) **grant/revoke-operator IS sketched, flagged "possible scope — ratify at discuss"**
(mig 095's `granted_by` anticipated it). Grounded in the REAL shapes: the 19-action platform
`audit_log` CHECK vocabulary (migs 030+071), the shipped 146/147 `operator_audit_log` actions
+ the 148 arrivals (`user.disable/enable`, `visibility.set`, `audit.export`,
`audit.view_platform`), `auth.users` last-active (`last_sign_in_at`) + the GoTrue ban
mechanism, the `app_settings` TTL-flag substrate (147, no new flag infra), and the real
feature surfaces for the map (Skill Studio 053/057 — one flag covers "eval studio" AND
"trigger tuner"; Settings model management; workflow authoring; governance health). Threat
framing renders in-surface: cross-user reads on the service-role client are explicitly
filtered AND visible (viewing platform activity is itself a recorded action).

**Winners = all A (operator, 2026-07-11).** With the picks the operator added a
**forward-compat access-control directive**: Users & Access must anticipate the v3.4
org-RBAC one-way door (user types / roles, departments / org groups) the way the
Glean reference model does it (IdP/directory groups → group-based **feature greenlists** →
permission-aware per-request doc checks — `.planning/research/FEATURES.md` Part 1c).
148 ships the degenerate two-audience case with extensible shapes, never booleans →
captured as the D-148 contract in Running Design Decision 59 + SEED-115. See Running
Design Decisions 57–59.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 067 | audit-browser | How does the operator investigate the audit trail — action-type + date filters, pagination, CSV export — across BOTH ledgers (operator actions + platform user activity) in one browser? | **A — Filter strip + table** ★ | phase-148, admin-03, audit-browser, filters, pagination, csv-export, two-ledgers, honesty |
| 068 | users-and-access | How does the operator manage user access — roster with last-active, immediate-but-reversible disable/enable with the right weight (victim-naming sheet), and the scope-flagged grant/revoke-operator? | **A — Instrument table** ★ | phase-148, admin-03, users, disable-enable, last-active, operator-grant, confirm-sheet, honesty |
| 069 | feature-visibility | How does the per-feature visibility map read — hide advanced surfaces from end users, API-enforced not UI-only — and does the Users & Access placement beat the in-Controls foil? | **A — Audience rows** ★ | phase-148, vis-01, feature-visibility, audience, api-enforced, users-and-access, preview, honesty |

### Phase 149 session — Model Registry: Capability Editor · Discovery Propose-Confirm (2026-07-12)

Grounded by the SEED-116 boundary decision + the evidence-based dynamic-control inventory (`.planning/notes/dynamic-control-inventory.md`). The Control Room shell + locked "Model Registry" tab (RDD 51/56) are static context — these two sketches are only the tab BODY. Sessions: 070–071.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 070 | model-capability-editor | How does an operator read + edit the registry, and how does `enabled` legibly couple to what users can pick (the SEED-116 two-layer pattern)? | **A — Instrument table + inline edit** ★ | phase-149, model-01, model-registry, instrument-table, inline-edit, two-layer, enabled-picker-coupling, lock, override-vs-inherited, honesty |
| 071 | model-discovery-propose-confirm | How does discovery run → show new/changed/vanished → confirm, with propose-only (never auto-enable an un-returned capability, SC#3) as the visual hero? | **A — Grouped diff list** ★ | phase-149, model-02, discovery, propose-confirm, sc3-propose-only, unknown-you-set-it, vanished-not-deleted, per-provider-run-cards, honesty |

### Phase 152 session — Workflow Run Inputs: Run-Inputs Modal · Delete & Cascade (2026-07-14)

G-2 sketch, BEFORE discuss-phase. Grounded in the LIVE `RunModal` (`WorkflowsPage.tsx:719` — read-only folder chip + kickoff today), the Phase-100 `template_input` upload (`upload_template`), the SEED-112 scope-shape question (Perplexity 3-way toggle / Glean-Beam), and the 064/068 victim-naming confirm pattern. These two sketches settle the milestone's two open UI calls: the scope-control shape (072) and the delete cascade disposition (073). Sessions: 072–073.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 072 | run-inputs-modal | How do a template file-upload (WFIN-01) + an editable KB-folder scope (WFIN-02) fold into the calm 560px Run modal without breaking the 3-second read — and what SHAPE is the scope control (SEED-112)? | **A — Inline-grows (chip→`<select>` + quiet upload button)** ★ | phase-152, wfin-01, wfin-02, run-modal, run-inputs, template-upload, kb-scope, seed-112, scope-shape, provenance, net-new-wire |
| 073 | workflow-delete-cascade | How does deleting a published workflow — an action with downstream victims (versions/runs/threads) — read as deliberate + honest, with the cascade disposition made explicit (WFIN-03)? | **A — Victim-naming sheet (removed vs kept · threads → normal chats)** ★ | phase-152, wfin-03, workflow-delete, cascade, victim-naming, confirm-sheet, in-flight-run, audit-recorded, honesty |

### Phase 153 session — Inline Citations (CITE-01) (2026-07-15)

G-2 sketch, **mandatory** (live UI, "feels like", G-5 hot files `MessageItem.tsx` / `StreamsProvider.tsx`). Phase 153 adds **per-claim inline citation markers keyed to the run's ACTUAL retrieval set** (set-membership, never a post-hoc LLM re-ask — Pitfall 14), click-through to the passage, and **absence-as-signal** (an unmarked claim reads as general knowledge). Grounded in the REAL "before": `agent_loop.py` accumulates `retrieved_citations` → dedupes into `unique_citations` → emits the `citations` SSE event + stores `source_refs`; today that set renders **only** at the bottom of the message as an unnumbered collapsible "N sources" list (`CitationList.tsx` → `CitationCard.tsx`) with no per-claim attribution. The answer body is `MarkdownRenderer` (`MessageItem.tsx:451`). Real `Citation` shape: `{document_id, filename, chunk_index, passage, similarity, is_full_doc, version_number}`. **The honesty crux:** marker `n` = `citations[n]` by construction (the model emits `[n]` against the numbered set it was handed — search results are already ordered), so set-membership is structurally guaranteed with no re-ask; unmarked = no `[n]` = general knowledge.

**Intake decisions (operator, 2026-07-15):** (1) marker **density = per-claim, sparing** (only load-bearing facts carry a marker; framing prose flows unmarked, so absence reads cleanly); (2) the bottom "N sources" list is **restructured into a numbered `[n]` References footer keyed 1:1 to the markers** (one coherent works-cited), not kept-both or inline-only; (3) **two sketches** (marker + click-through), absence-as-signal folded into 074 as an ⓘ affordance per the tiered-guidance rule (never a banner).

**Winners = both A (operator, 2026-07-15).** 074-A superscript-numeral chip (lightest touch on the calm body; markers **attach on settle**, never speculative mid-token — the streaming-honesty behavior). 075-A hover-peek → click-to-pin popover as the quick path, with the numbered References footer as the durable home ("Open document" reuses the real document-detail route); B (scroll+flash) documented as the lowest-risk one-home alternative, C (workspace panel) as real-inspection-power-but-overkill for the common 1–4-source answer. Both sketches render headlessly clean (`node` JS-parse + tag-balance). SC#10: the marker is a pure render layer over the provider-uniform `citations` set — identical across providers. G-5: marker injection touches `MessageItem.tsx` — re-run replay/render tests, do not regress the shared render path. Feeds Phase 155 a11y (keyboard-reachable markers/rows + popover focus mgmt). Sessions: 074–075.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 074 | inline-citation-marker | Does a per-claim inline marker read cleanly in a streamed answer AND make absence-as-signal legible, without adding chrome-noise to the calm-instrument body? | **A — Superscript numeral chip (attach-on-settle)** ★ | phase-153, cite-01, inline-citations, marker, absence-as-signal, streaming, set-membership, messageitem, g5-hot-file |
| 075 | citation-clickthrough | When you click an inline marker, what surfaces the source passage — and what does today's bottom "N sources" list become once markers exist? | **A — Hover-peek → click-to-pin + numbered References footer** ★ | phase-153, cite-01, inline-citations, click-through, references-footer, hover-popover, workspace-panel, citationlist, g5-hot-file |

### Phase 156 session — Everyday UX Polish (STRETCH): Collapsed Nav Rail + Thread-List Organization (2026-07-16)

G-2 sketch, BEFORE discuss-phase (POLISH-01 is visual — nav-collapse behavior, search UI, group rendering). The two confirmed SEED-045 anchors. Grounded in the LIVE `NavPanel.tsx`: the panel renders at `w-64` and is *masked* to `w-16` when collapsed (`:297` "no layout recalculation, eliminating layout jumps"), so the whole Chats region — **New Chat included** — is `opacity-0 pointer-events-none` (`:368`); you must expand to start a chat (Anchor 1). Top nav items already collapse correctly (icon-only + tooltip-right, `:330`) — the fix is to give New Chat/Search that same treatment (the 087-08 "collapse-to-rail, key action stays reachable" precedent). The thread list is a flat `threads.map` (`:131`) with no search/grouping across the operator's 280+ threads (Anchor 2). Real shapes are on our side: `Thread { title, folder_id, updated_at, created_at }` + `Folder { id, name }` already exist, so date/folder grouping is pure-frontend. Sessions: 076–077.

**Intake decisions (operator, 2026-07-16):** scoped to POLISH-01's 3 criteria (collapsed New Chat reachable · search · date/folder grouping); pinning left as umbrella-only. Two sketches, 2–3 variants each, each rendering a full nav panel in context (Deep Midnight, real threads + folders) with a per-frame "Proposed rail ⇄ Today (broken)" before/after toggle that reproduces the real bug for contrast.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 076 | collapsed-nav-rail | When the nav collapses to the 64px rail, what stays reachable — and how does it feel? | **B — New Chat + Search rail (icon+tooltip; click Search → expand + focus)** ★ | phase-156, polish-01, seed-045, nav, collapse, rail, new-chat, search, icon-tooltip, 087-08-precedent |
| 077 | thread-list-organization | How do 280+ threads get searched + grouped in the expanded panel? (date sections / folder groups / search+toggle) | _reframed → 078_ — the search + date/folder grouping mechanics are reused **inside** 078's history column; no winner marked | phase-156, polish-01, seed-045, thread-list, search, grouping, date-sections, folders |
| 078 | chat-history-home | **Pivot (operator):** organizing inside the cramped sidebar can't fix a growing nav starving history — WHERE should chat history live? (two-tier rail / history page / ⌘K palette) | **D — Synthesis: A's permanent icon rail + C's ⌘K global finder** ★ | phase-156, polish-01, seed-045, ia, two-tier-rail, command-palette, history-page, space-competition, chat-history |

**Pivot note (2026-07-16):** 076 (collapsed-rail) landed clean (winner B). 077 (organize-the-list) drew an operator course-correction: **the thread list and a *growing* nav compete for one vertical column, and grouping adds chrome to an already-starved region — you'd still see 2–3 chats, and it worsens as we ship surfaces.** 078 reframed the question from "how to organize" to "where should history live so nav growth can't starve it," explored three structural directions (two-tier rail / dedicated Chats page / ⌘K palette), and the operator chose the **A + C synthesis**: nav → permanent 58px icon rail (growth decoupled from history), history → full-height column with inline filter (077's mechanics), **+ ⌘K** global finder for instant jump. B's full "Chats page" is retained as a future deep-history destination. Feeds `/gsd:discuss-phase 156`. **Design decision: chat history gets a dedicated home (icon-rail two-tier + ⌘K); the nav rail must stay icon+tooltip and never re-absorb the history list.**

### Phase 166 session — Org-Admin Shell + Org Switcher + Profile-Menu Anchor (2026-07-21)

G-2 sketch, BEFORE plan-phase (D-166-05 leaves the visual composition to the sketch as the acceptance bar). Ships the human-facing surface of the now-real tenancy model (163 crux + 164 isolation + 165 `is_global` retirement all shipped). Grounded in the LIVE shell: `NavPanel.tsx` is a left vertical rail (58px collapsed / ~210px expanded) whose footer today holds only theme-toggle · the probe-gated **amber operator shield** (`OperatorBand`/`useOperatorProbe` precedent) · a bare "Sign out" — there is **no rich profile anchor yet** and **no top bar**, so SEED-113's "top-right anchor" lands as a rail-footer element. Reuses the Operator Control-Room shell (061-B band+tabs, `LockedTab`, plain-first + ⌥ Technical-names) as composition, the 068-A instrument-table roster for Members, and a lighter cut of the 067-A audit browser for Audit. Two sketches. Sessions: 079–080.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 079 | identity-anchor-and-org-switcher | How does the profile identity anchor compose with the org switcher (only at 2+ orgs) + the org-scoped role badge in the rail footer — merged / separate / hybrid — and where does the org-admin entry point live? | **C — Hybrid: merged identity+switcher menu + org-admin as a rail Shield-mirror parallel to the operator shield** ★ | phase-166, admin-02, admin-03, org-switcher, profile-menu, role-badge, identity-anchor, nav-rail, seed-113, tenancy, g2-sketch-gate |
| 080 | org-admin-shell | How does the 7-tab org-admin shell compose from the Control-Room band+tabs — band warmth (org-indigo / operator-amber / lighter header) + how the 3 live (Members · Audit · Settings) + 4 locked tabs read? | **A — Org-indigo band+tabs (amber reserved for operator); 3 live + 4 honest "coming soon" locked tabs; audit RLS-honest** ★ | phase-166, admin-01, admin-04, admin-05, org-admin-shell, control-room-reuse, band-tabs, locked-tab, members-roster, org-audit, settings-ia, g2-sketch-gate |

**Session decision (2026-07-21):** Both sketches ship the tenancy human-surface on **Control-Room reuse** terms. **079-C** puts identity + org-scoped role badge (`◆ Org-admin` / `Member`) + the org switcher (renders only at 2+ orgs; solo = quiet name button, D-166-02) in ONE merged rail-footer profile menu, and pulls the **org-admin entry out to a rail Shield-mirror sitting parallel to the operator amber shield** — the SEED-113 "user-side mirror" made spatial, in **indigo** (distinct from operator amber). **080-A** carries that indigo into the shell band (amber stays operator-only), reuses the 061-B band+tabs + 068-A roster + a lighter 067-A audit cut, ships **3 live + 4 honest locked** tabs (no roadmap numbers in copy), and makes the `org:audit_view` degrade **RLS-honest** (explicit "you see only your own", never a silent empty). The org-switch teardown (079) preserves subscription-teardown → thread-bucket-clear → refetch (D-166-08). Feeds `/gsd:plan-phase 166`. Sessions: 079–080.

### Phase 174 session — Run-State & Lifecycle Honesty (STATE-01..04) (2026-07-22)

G-2 sketch, BEFORE spec/discuss-phase. First sketch of **v3.5 UX Consolidation & Chat Polish**. Phase 174 makes every run's lifecycle honest in chat — no empty/orphaned bubbles on cancel/kill (STATE-01), a stop indicator that survives nav-away-and-back AND reload (STATE-02, read from authoritative `runs.status` — FND-01/145, no new persistence), a "Setting up agent…" state that shows live model activity instead of hiding it (STATE-03), and workflow-run timers/avatars that stay accurate on nav — anchored elapsed, single avatar (STATE-04). Folds 5 parked `surface: Agentic-RAG` reports: `cancelled-run-empty-bubble-early-cancel`, `killed-workflow-empty-chat-card`, `cancelled-run-stop-indicator-lost-on-navigation`, `setting-up-agent-hides-model-activity`, `BUG-260610-01`. Grounded in the shipped run-honesty language (live-run-container run-card + `run-honesty.md` fail-taxonomy + Sketch-015 never-vanishes status strip) — the sketches refine WITHIN the Deep-Midnight house style, not reinvent it. G-5 hot files: `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` / `threads.py` (run-lifecycle). Red line D-14: Deep byte-identical; the honest states are a render layer over persisted `runs.status` + wire events the backend already emits. Sessions: 129–130.

**Intake decisions (operator, 2026-07-22):** (1) **two focused sketches** — 129 terminal/interrupted message states (STATE-01/02), 130 live pre-answer honesty (STATE-03/04) — each answers one question in isolation. (2) **Feel = quiet & calm, red for real failure** — honesty as a muted inline signal matching the calm-instrument language; loud (amber/red) only for administrative blocks + genuine failures. The variants refine within that direction.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 129 | terminal-run-states | How does a stopped / cancelled-no-output / blocked / failed run read as an honest, PERSISTENT chat state that survives reload — without noising the calm transcript? | **C — Tiered: dim (user-stopped) → amber (admin-blocked) → red framed (genuine failure); every marker derived from persisted `runs.status`** ★ | phase-174, state-01, state-02, terminal-states, run-honesty, stopped, cancelled, blocked, failed, persistent-badge, runs-status, messageitem, g2-sketch-gate |
| 130 | live-preparing-honesty | Before the first token, and on nav-back into a long run, what shows the model is actually working — with a timer anchored to `started_at` + a single avatar? | **C — Run-header carries the live sub-state (activity pill + anchored timer + one avatar); fixes STATE-03 (activity) AND STATE-04 (timer/avatar) in the shipped run-card header** ★ | phase-174, state-03, state-04, preparing-state, reasoning-activity, setting-up-agent, anchored-timer, single-avatar, run-honesty, streamsprovider, g2-sketch-gate |

**Session decision (2026-07-22):** Both winners are **C**, a consistent house rule for run-state honesty: **honesty is derived from durable state (persisted `runs.status` / the run's `started_at`), rendered in the calmest surface that can carry it, with loudness earned by severity.** 129-C = the terminal vocabulary (dim user-stop → amber admin-block → red genuine-failure), each marker keyed off `runs.status` so it survives reload (STATE-01/02). 130-C = the pre-answer vocabulary (honest live sub-state Reasoning/Writing/Sandbox in the run-card header, timer anchored to `started_at`, single avatar — STATE-03/04). Together they cover the whole lifecycle: **preparing → streaming → stopped/cancelled/blocked/failed**, all honest at rest and on reload. Feeds `/gsd:spec-phase 174` / `/gsd:discuss-phase 174` (acceptance bar = these mockups). G-5 hot files confirmed at the render layer (`MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts`); Deep byte-identical (D-14). Sessions: 129–130.

### Phase 177 session — v3.4 Org-Surface Polish (ORGUX-01 / ORGUX-02) (2026-07-23)

G-2 sketch, BEFORE spec/discuss-phase. Second sketch batch of **v3.5 UX Consolidation & Chat Polish**. Phase 177 is a **polish pass over surfaces that already shipped and work** (Phases 166/167/168) — not greenfield. ORGUX-01 = the org-admin shell + org switcher + profile-menu identity anchor, *polished and honest across states* (member vs org-admin, 1-org vs multi-org) — already sketched as **079-C** (hybrid identity/switcher menu + rail Shield-mirror) + **080-A** (org-indigo 7-tab shell), now refined for state completeness. ORGUX-02 = the invitations + SSO surfaces (invite dialog, invitations tab, `/invite` landing, SSO tab, identifier-first sign-in), *polished and error-honest* — these 5 surfaces shipped in 167/168 **without any sketch**, so this is fresh territory. Grounded in the LIVE shipped components (`InviteMemberDialog.tsx`, `InvitationsTab.tsx`, `SsoTab.tsx`, `AcceptInvitePage.tsx`, `SignInForm.tsx`) — real copy, real role/status vocab, real error messages. G-5 light: `StreamsProvider` (`<OrgContext>` OUTSIDE the stream path, 067.5 Branch-D3 guard). No SC#10 (not streamed state); no threat model (polish over already-secured 166–168). Sessions: 131–133.

**Intake decisions (operator, 2026-07-23):** (1) **all three sketches** — 131 ORGUX-01 state matrix, 132 ORGUX-02 pre-auth entry/failure, 133 ORGUX-02 in-app management. (2) **Primary lens = family cohesion** — the 5 surfaces each invented their own spacing/type rhythm + duplicated chip vocab (`SsoTab` even documents *intentional* off-grid deviation); make them read as one built-together system. Failure/edge honesty carried as the secondary edge-state bar.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 131 | org-state-matrix | Do the identity anchor + org switcher + org-admin shell entry read honestly + polished across all 4 cells (member/org-admin × solo/multi-org) as one set? | **C — Unified org-identity primitive + per-org role honesty** ★ | phase-177, orgux-01, org-admin-shell, org-switcher, identity-anchor, role-badge, state-matrix, honest-absent, family-cohesion, g2-sketch-gate |
| 132 | org-entry-failure-honesty | Identifier-first sign-in (fail-open) + the `/invite` landing's 6 outcome states — does "coming into an org" feel calm + every failure honest? | **B — Unified card + one honest-notice vocabulary** ★ | phase-177, orgux-02, sign-in, identifier-first, sso-fail-open, accept-invite, invite-landing, failure-honesty, family-cohesion, g2-sketch-gate |
| 133 | org-management-surfaces | Invite dialog + invitations tab + SSO tab as ONE polished family — shared chip vocab, spacing rhythm, honest-absent, link-first, victim-naming remove? | **B — One management language (shared chip · row · 4px grid)** ★ | phase-177, orgux-02, invite-dialog, invitations-tab, sso-tab, status-chips, honest-absent, victim-naming, family-cohesion, g2-sketch-gate |

**Session decision (2026-07-23, operator-delegated autonomous pick):** Operator set the primary lens to **family cohesion** then delegated the winner calls. The through-line across all three: **one org-identity primitive + one status-chip component + one honest-absent rule, reused everywhere; org-indigo for the tenancy zone, amber reserved for operator.** **131-C** = the unified identity block (avatar · org name · org-scoped role badge, identical in anchor/menu/band/rows) PLUS per-org role honesty (role follows the active org; the indigo shield appears/vanishes on switch) — the only variant that satisfies ORGUX-01's "honest across states" literally; B is the calm floor if per-org switching is heavier than polish scope warrants. **132-B** = sign-in + `/invite` share ONE card and every outcome routes through one severity-keyed notice vocabulary (calm-muted for recoverable dead-ends, weight only for genuine errors); C's fail-open depth folds in as the sign-in behavior (a route outage degrades to password, never a lockout). **133-B** = the invite dialog + invitations tab + SSO tab collapse to one row anatomy + one chip set + one 4px grid, retiring SsoTab's off-grid UPPERCASE fork; honest-absent + link-first + victim-naming all preserved; C's admin-vs-member split is B's read-only behavior demonstrated. Feeds `/gsd:discuss-phase 177` (acceptance bar = these mockups). No SC#10 (not streamed state); no threat model (polish over already-secured 166–168); no migration. Sessions: 131–133.

### Phase 183 session — v3.6 Read-Only Canvas (CANVAS-01) (2026-07-25)

G-2 sketch, BEFORE spec/discuss-phase. First sketch batch of **v3.6 Visual / No-Code Workflow Studio**. Phase 183 is the first surface where a real graph library (`@xyflow/react` v12, MIT, React-19) enters the app, and it sets the node/edge visual language that Phases **184** (editable canvas), **185** (graded governance dials), **187** (business vocabulary) and **188** (run-viz) all inherit. Scope is a **pure read-only projection** of an existing `WorkflowDefinition` — `canvasModel.toCanvas`, layout computed deterministically at render and **never persisted into the definition JSONB** (research Pitfall 3), `node.id === phase.slug`, nodes not draggable. Red line D-14 (projection, never a runtime); no SC#10; no threat model; no migration. G-5 ledger: `WorkflowCanvas.tsx` / `canvasModel.ts` / `PhaseNode.tsx` mirror `PhaseSpineGraph.tsx`'s glyph/parse logic — 1st touch, extract a shared module proactively before the 3rd consumer. The shipped `PhaseSpineGraph` is **kept** as the keyboard/screen-reader fallback, never deleted. Sessions: 134–136.

**Intake decisions (operator, 2026-07-25):** (1) Operator declined the pre-set canvas-feel options and asked for a **recommendation** instead — recorded recommendation was the **quiet-until-touched hybrid**, because "simplicity to the user" and "full customization" are the two halves that option pairs (a permanently-on grid/minimap/handles charges every user for power they may not use; a fully bare plane hides it). (2) Operator set the **spectrum constraint**: the node vocabulary must be able to carry KB-retrieval that *must not invent information*, agent steps *flexible enough for every business case*, **templates**, **connectors / multiple integrations**, and **document / final-output generation** — so 183 builds the container once and 185 / 187 / 189 plug into it rather than forcing a re-skin. (3) All three proposed sketches approved as scoped.

**Live-DB grounding (read 2026-07-25 — 95 `workflow_definitions`, 119 phases).** These facts shaped every variant:

| Finding | Design consequence |
|---|---|
| `skip_to_phase` used **0 times**; `on_failure` is only `fail_run` (×45) + `ask_user` (×2) | SC#1's branch edge has **never rendered against real data** — Phase 183 needs a fixture (sketch 136 proposes one, marked SYNTHETIC) |
| `phase.name` on only **10 of 119** phases (8%) | The *fallback* node title is the dominant case — design for it, not the happy path |
| **40 of 95** definitions have **zero** phases | The empty projection is the most common canvas state — it needs an honest empty state, not a blank plane |
| Phase count max **5**, modal **2** | Graphs are tiny — no virtualization, no minimap need; but a 2-node graph must not look lost on a big plane |
| `available_tools` runs **1 → 10** | The node must survive both a 1-tool chip and a 10-tool overflow |
| Gate vocab: `citations_required` ×19, `output_file_valid` ×18, `llm_judge_rubric` ×8, `freshness` ×2 | Real gate chips, not invented |
| `llm_emit` already carries `citation_policy: strict\|flag` + `integrity_policy` + `emitter` | The **grounding slot is readable from today's data** — the 185 dial is a graded layer over a distinction that already exists |

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 134 | canvas-frame-and-read-only | What does the canvas plane feel like at rest vs. under touch, where does it enter the app, and how does "view only" read as deliberate rather than broken? | *pending* | phase-183, canvas-01, xyflow, read-only, canvas-frame, entry-door, chrome-reveal, empty-state, g2-sketch-gate |
| 135 | phase-node-anatomy | What IS a canvas node — simple at a glance, yet carrying grounding state, tools, gates and templates, with room for connectors later? | *pending* | phase-183, canvas-01, phasenode, node-anatomy, grounding-slot, technical-names, forward-slots, g5-hot-file, g2-sketch-gate |
| 136 | flow-shape-and-branches | How does the whole graph read — layout direction, `skip_to_phase` branches, gates, terminal ends, batch fan-out — with no dropped phase and no phantom edge? | **B — horizontal left→right** ★ (operator, 2026-07-25) | phase-183, canvas-01, canvasmodel, layout, skip-to-phase, branch-edge, fan-out, terminal, sc4-faithfulness, g2-sketch-gate |

**Operator review of 134–136 (2026-07-25) — course correction.** Operator verdict: variants **A and C read as near-identical** in 134 and 135 (the differences were opacity/motion nuances, not different worlds — a failed first-round variant set, which is meant to be dramatically different); **136-B (horizontal left→right) is the chosen flow shape** ("similar to any [other builder]"); and the whole batch was **too technical, too messy, and visually basic — "no 3D effects or innovative design… does not look very agentic."** Root cause on the visual half: **the sketches violated the project's own ICON CONVENTION** — they drew the flat unicode glyphs `⚙ ✎ 🤖 ⛓ ☺ ◆` that Phase 127 explicitly *retired*, instead of the shared 3D `PHASE_GLYPHS` marks bundled by `frontend/src/lib/phaseGlyph.tsx`. Operator direction going forward: **calm, user-friendly, less technical, less messy — but modern, 3D-iconed, visually attractive and agentic-feeling**, and the connectors (Phases 189–190) must use those same icons. Sketch **137** is the redo: horizontal flow locked from 136-B, three genuinely different visual worlds, real 3D icons, plain language by default. 134/135 remain on file as the structural reference (frame options, node-content inventory, the SC#4 faithfulness harness) — their *findings* stand, their *look* is superseded by 137.

**New reusable asset:** `themes/phase-icons-3d.js` — the 6 shared phase-type marks plus connector candidates, extracted **verbatim** from the installed `@iconify-json/fluent-emoji` package (the same source `phaseGlyph.tsx` bundles), with per-instance id namespacing so repeated marks don't break each other's gradients. Every slug verified present (icon-convention §3 — the Phase 127 empty-icon trap). **All future sketches touching phase types must use this instead of text glyphs.**

**Measured icon finding (2026-07-25).** Average luminance of each shared mark on the Deep Midnight background: `gear` 173.7 · `memo` 166.3 · `robot` 134.9 · `raised-hand` 184.9 · `package` 147.3 · **`busts-in-silhouette` 34.5**. The `llm_batch_agents` mark is ~4× dimmer than the rest and visually disappears. Two fixes, deliberately kept separate: **(a) in scope for 183** — lighten the icon well (canvas-local, touches nothing shipped; applied in all 137 variants); **(b) cross-cutting** — swap the shared slug to `handshake` (luminance 182.6), which is one clean additive `PHASE_GLYPHS` map swap **but changes five already-shipped surfaces** (workflows-page card, run + publish soul headers, gauntlet stages, live step cards), so it is its own decision. Both are toggleable live in sketch 137.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 137 | agentic-canvas-look | What should the canvas actually LOOK like — modern, 3D, alive and agentic, while staying calm and non-technical? | **B — Glass Depth** ★ (operator changed D → B, 2026-07-26; D remains on file as the documented alternative) | phase-183, canvas-01, visual-direction, 3d-icons, icon-convention, energy-language, plain-language, connectors-preview, g2-sketch-gate |

**⚠ 137's winner CHANGED D → B (operator, 2026-07-26).** The locked card is now **137-B — Glass Depth**:
the 3D mark floats ABOVE a narrower centre-aligned frosted panel with its own contact shadow, and there
is **no per-step-type colour anywhere** (verified — variant B has no `data-type` rule at all). This is
not a reversal of D's reasoning but the complete form of it: D was chosen to protect the colour budget
for Phase 188 run status, and B protects **all** of it rather than most. Three consequences carried
forward:

1. **Step type is now carried by the 3D mark ALONE**, which promotes the two pending cross-cutting icon
   swaps from optional to **required before Phase 184 builds**: `llm_batch_agents`
   `busts-in-silhouette` (luminance 34.5, ~4× dimmer than the other five — it disappears on Deep
   Midnight) → `handshake` (182.6), and `llm_agent` `robot` → `compass` (157.4). Still one additive
   `PHASE_GLYPHS` map swap across five shipped surfaces — a small dedicated task, never a side effect.
2. **The card's top edge belongs to the floating icon**, so the Phase-184 editing chrome had to be
   re-homed: per-node actions to the bottom edge, the verdict mark to the right edge, the step number
   inside the card. Done in `themes/canvas-184.css` (`body.card-b`) and verified.
3. **B is tighter than D** — 248px cards + 66px connectors vs 300 + 96, so the 5-step flow is ~250px
   narrower. That headroom matters once the 400px inspector shares the width.

Sketches 138–141 carry a live **Card** toggle so B and D remain comparable.

**Session decision (2026-07-25) — the v3.6 canvas visual language is LOCKED.**

**136-B + 137-D.** The canvas is a **horizontal left→right flow** of **frosted-glass step cards** with a **3D
`fluent-emoji` mark floating at the left edge**, casting its own contact shadow. Titles are **plain business
language** ("Search the knowledge base"), one supporting line, at most two word-badges ("Must cite its sources",
"Waits for you"); the real `phase_type` / slug lives behind the **⌥ Technical names** reveal (the shipped v3.3
two-audience pattern). Motion is **Alive by default** — the backdrop drifts, the running step breathes, and light
travels the edge into it — with a **Calm** setting that holds everything completely still.

**The load-bearing rule this locks: the colour budget.** Per-step-type colour is a *tint behind the icon only*,
never a whole coloured tile — because **Phase 188 needs the strong colours for run status** (running / done /
waiting-for-you / failed). Variant C was rejected on exactly this: it spends its colour on step type, so an
`llm_human_input` tile is amber whether or not it is actually waiting for you. **Any later phase that wants to
colour a node by *type* must justify it against this rule.**

**Two build rules that came out of the review:**
1. **Motion keys off RUN STATE, never off selection.** The first build attached motion to the selected node, so the
   Calm/Alive toggle silently did nothing whenever nothing was selected (operator-reported). A running step must
   look running whether or not anyone clicked it — which is also the honest behaviour (research Pitfall 4).
2. **Phase icons come from `themes/phase-icons-3d.js`, never text glyphs.** The 134–136 batch drew the flat unicode
   set Phase 127 retired, and that single miss is most of why the operator read the work as "very basic … does not
   look very agentic."

**Competitor evidence backing the constrained-spine bet** (`.planning/research/deep-dive/`, crawled at milestone
kickoff; surfaced to the operator 2026-07-25 in answer to "how do Beam / Glean do this?"): **Glean** — the strongest
enterprise competitor — scopes drag-and-drop to **reordering steps**, not free wiring ("closer to a reorderable,
branchable spine than an open graph"). **Beam** redesigned its builder in **July 2026** *toward* sidebar config +
per-field completeness status, and its own docs rate the blank-canvas path "intermediate-to-advanced." **n8n**’s free
DAG has a documented complexity cliff — 20–30 nodes before non-technical teammates lose the thread, 200 nodes
"impossible to maintain, debug, or explain to anyone." All three ship describe→draft→refine AI authoring, so the
AI-seed is table stakes; our differentiator is that the generator’s response schema **is** the `extra="forbid"`
discriminated union, so it structurally cannot emit an invalid draft — plus graded grounding governance, which
**none of the three has**.

**Feeds `/gsd:spec-phase 183` / `/gsd:discuss-phase 183`** — acceptance bar = 137-D. Sketches 134–135 remain the
structural reference (frame options, node-content inventory, live-data findings); 136 is the topology + SC#4
faithfulness harness. Sessions: 134–137.

**Icon decisions (2026-07-25).** `llm_agent` → **🧭 `compass`** (luminance 157.4), replacing `robot` — operator: the robot
"seems like it used everywhere in any other application". Compass is semantically exact (an agent works out *how* to
get there rather than following a fixed script — the thing that separates `llm_agent` from `llm_single`) and it is an
object, consistent with gear / memo / package. `sparkles` was deliberately excluded as the industry's most overused AI
icon; `bullseye` is already taken by the Phase 127 gauntlet Goal stage. `llm_batch_agents` → the too-dark
`busts-in-silhouette` (luminance 34.5) gets the **in-scope fix** (lighter icon well) in 183; the **cross-cutting**
swap to `handshake` (182.6) stays open.

⚠ **Both icon swaps are cross-cutting, NOT Phase 183's to ship quietly.** `PHASE_GLYPHS` is deliberately shared —
the same mark also renders on the workflows-page card, the run + publish soul headers, the gauntlet stages and the
live step cards. One clean additive map swap, five shipped surfaces. **Carry as a small dedicated task, not a
side effect of the canvas phase.**

**Two live-data findings that MUST reach the Phase 183 plan** (both from the 2026-07-25 Supabase read):
1. **`skip_to_phase` is used ZERO times** across all 95 definitions / 119 phases — so SC#1's branch edge cannot be
   demonstrated from the existing corpus. **The phase needs a fixture** (sketch 136 proposes the shape).
2. **40 of 95 definitions have zero phases** — the empty projection is the single most common canvas state and needs
   an honest empty state, not a blank plane.

### Phase 184 session — v3.6 Editable Canvas + Live Structural Validation (2026-07-26)

G-2 sketch, BEFORE spec/discuss-phase. Phase 184 is the milestone's **CORE deliverable** — CANVAS-02
(add / move / connect / delete, lossless round-trip through the EXISTING draft CRUD, layout OUT of the
immutable definition JSONB), CANVAS-03 (side-panel config over the `PhaseConfig` discriminated union,
Pydantic authoritative), CANVAS-04 (governance as visible rails), VALID-02 (author-time STRUCTURAL
validation — "you cannot draw an invalid workflow") and VALID-03 (per-node status from the SERVER
verdict, never a client guess). Red line D-14; no SC#10 (authoring, no run stream); **migration
SKETCH-CONDITIONAL** — slot 114 reserved ONLY IF `workflow_layouts` is confirmed here (OPEN-05), else
ZERO. Sessions: 138–141.

**Intake decisions (operator, 2026-07-26):** (1) **Core action = "grow a flow step-by-step"** — so the
*add* affordance is the hero and the empty canvas (40 of 95 real definitions) is a first-class screen,
not an edge case. (2) **Explore BOTH spine and free-wire** — the constrained spine must *win an
argument* rather than be assumed, which is what makes migration 114 a real decision instead of a
foregone one.

**Inherited and NOT re-opened:** the 137-D visual language is locked (horizontal left→right frosted step
cards, floating 3D `fluent-emoji` mark, plain title + one line + ≤2 word-badges, ⌥ Technical names,
motion keys off RUN STATE not selection, and the **colour budget** — per-type colour is a tint behind
the icon only, because Phase 188 needs the strong colours for run status). Extracted into a new shared
asset so the four sketches cannot drift from it or from each other.

**New reusable asset:** `themes/canvas-184.css` — the 137-D node atoms plus the net-new Phase-184
editing chrome (insert affordance, per-node actions, verdict marks, the mono round-trip readout, the
400px inspector rail). It exists for the same reason `PhaseNode.tsx` does: **there is one node.** A
sketch that needs a different card is making a design argument, not a copy-paste.

**Live grounding read for this batch (schema, 2026-07-26).** `workflow_definitions` carries no layout
column (`id · slug · version · name · description · status · definition · created_by · is_system_global ·
org_id · created_at · updated_at · skill_snapshots`) and `WorkflowDefinition` is `extra="forbid"` at the
Pydantic layer — so node positions genuinely cannot ride along in the JSONB, and any free-placement
variant is honestly costed at a **new table**, not a free field. Every verdict rendered in 139 is a real
code from its owning module (`reachability.LINT_CODES` · `grounding.GROUNDING_VERDICT_CODES` · the two
`/validate` mints itself · `grounding_unavailable`) with the VERBATIM server message behind ⌥. Every
tool chip in 140 is the real registry (`get_tools`, `openai_service.py`) as served by
`GET /workflows/grounding-bundle`.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 138 | growing-the-flow | How do you add, move and delete a step — and how much wiring freedom is right for a canvas the linear harness engine has to run? | **C — Hybrid spine + free nudge, in its "C-local" form** ★ | phase-184, canvas-02, editing-model, insert-between, reorder, free-wire, workflow-layouts, migration-114, open-05, d-14, g2-sketch-gate |
| 139 | validation-while-building | How do server verdicts read on the canvas while the flow is half-built — so "you cannot draw an invalid workflow" holds without punishing someone for not being finished? | **A — Mark + problems tray** ★ | phase-184, valid-02, valid-03, severity-split, incomplete-vs-error, problems-tray, prevent-at-source, grounding-unavailable, g2-sketch-gate |
| 140 | step-inspector-and-rails | How do you configure a selected step, and where does governance become visible as rails you can see but cannot wire around? | **A — Extend the shipped 400px panel** ★ | phase-184, canvas-03, canvas-04, phaseformpanel, node-config, governance-rails, tool-whitelist, grounding-bundle, locked-gates, phase-185-graded, g2-sketch-gate |
| 141 | the-authoring-session | Do 138 + 139 + 140 compose into a session a person can sit inside — empty draft → first step → a mistake → undo → autosave → publish? | **B — Canvas toolbar + page header** ★ | phase-184, composition, consistency, undo-redo, zundo, autosave-honesty, saved-not-published, publish-handoff, empty-state, viewport, g2-sketch-gate |

**The load-bearing rule the batch is built around (all four sketches make it visible).** The shipped
projection draws a sequential edge to the phase whose `phase_index` is **exactly +1, found by LOOKUP**
(`canvasModel.ts:258`, mirroring `reachability.py:164` line for line). Two consequences: a gap draws NO
bridging edge and the phase after it is honestly orphaned; and therefore **"insert a step" is never
cosmetic** — on a spine it renumbers, which is precisely why a hole cannot be hand-authored there.

**Three decisions these sketches are staged to settle at discuss-phase:**

1. **OPEN-05 / migration 114** — 138-A stores nothing (positions recomputed from `phase_index`, the
   shipped `toCanvas` behaviour) → ZERO migration. 138-B and 138-C both require `workflow_layouts`. The
   sketch's own tell: **"Auto-arrange" in B** — if a machine can always lay the graph out, the stored
   positions were never load-bearing.
2. **Whether "you cannot draw an invalid workflow" means prevented or reported.** 139-C shows prevention
   at its strongest and then admits its ceiling in-surface: prevention can decide anything about the
   *shape* of the flow, but an unavailable tool, an out-of-scope folder or a missing description can only
   be **reported**. So C is not a third alternative — it is **A or B plus a gate**, and the question is
   whether the gate earns its cost.
3. **The `incomplete` ≠ `error` split is a product decision, not a colour choice.** Both severities set
   `ok: false` and both block publish, but `incomplete` is the state a canvas spends most of its life in.
   Any variant that reads as alarming on the "Mid-build" scenario is wrong.

**Two seams deliberately left to their owning phases.** The gate rail in 140 is where **Phase 185's
graded governance** plugs in (today's lock is *derived* from `citation_policy` + a `citations_required`
validator via the shipped `groundingFor()`; 185 replaces the derivation with an authored per-node
grounding mode — Grounded keeps the lock, Open does not get one). 184 must **not** invent that field.
And 141's autosave vocabulary ("Saved · still a draft" — never mints a version, never re-arms the
gauntlet) is chosen here but **mechanised by Phase 186 / CONCUR-01**; the two-editor case is explicitly
out of scope and said so in-surface.

**Feeds `/gsd:spec-phase 184` / `/gsd:discuss-phase 184`.**

**Session decision (2026-07-26) — the Phase 184 authoring surface is LOCKED.**

**137-B card · 138-C-local · 139-A · 140-A · 141-B.** Operator selections, with one advisory refinement
accepted (138) and one build correction recorded (141).

| # | Winner | The reason that decided it |
|---|---|---|
| 138 | **C-local** — spine + free nudge, browser-persisted | **OPEN-05 resolves to ZERO migration; slot 114 stays RESERVED, not spent.** Order is the spine and cannot be rewired; the nudge is a **per-user view preference**, never sent to the server. A's data model + C's interaction + no migration. |
| 139 | **A** — mark on the node + problems tray | The **only** variant with a home for a workflow-wide verdict (`business_requirement` belongs to no node — B loses it from the canvas entirely), and its two-word count ("1 problem · 2 things to finish") is what stops `incomplete` reading as failure. |
| 140 | **A** — extend the shipped `PhaseFormPanel` | Lowest net-new, and the only option that does not create a second form surface to keep in step with the Builder's. The canvas becomes a third way IN to one form. |
| 141 | **B** — canvas toolbar + page header | Editing controls where editing happens, the way out where leaving happens. **Correction:** the sketch drew publish as a bottom bar; the intent is the **page header**, and the Builder already has one (the `← Workflows` breadcrumb) — reuse it rather than add a band. |

**The 138 refinement, recorded because the reasoning generalises.** C was picked for forward flexibility.
The advisory finding: at the live scale (**2 steps modal, 5 max, across all 95 definitions**) a vertical
nudge disambiguates nothing, while a `workflow_layouts` row costs a migration, a second store that can go
stale against the definition, an unanswered "does my colleague see my nudge?" on org-shared workflows,
and — the decisive one — it **manufactures the exact case Phase 186 / CONCUR-01 must defend against**
("a cosmetic drag never mints a version or re-arms the gauntlet"). Under a computed layout that
requirement is true by construction; under a persisted one it becomes a live code path. **C-local keeps
the interaction and moves the storage.** The door stays provably open via a written promotion trigger:
promote `dy` into `workflow_layouts` (nullable, cosmetic-only, keyed by `phase_slug`, slot 114) when
*either* a nudge must survive across devices *or* a layout is deliberately shared. Neither is true today.

**139-C is folded in, not discarded.** Its finding is a build rule: prevention covers anything decidable
from the *shape* of the flow (do not offer a step that would strand the deliverable; refuse a delete that
would orphan its successor); an unavailable tool, an out-of-scope folder or a missing description can
only be **reported**. So the build is **A plus C's gate where the gate is cheap** — and the gate must
never become the thing that stops someone building.

**Three composition risks the five picks create together** (no single sketch shows these):

1. **Two bottom bands** — 139-A's tray and 141-B's bar. Fold the tray's summary line into the bar and
   expand the tray upward from it: one region, two rows max.
2. **Width budget** — a 400px panel beside 248px cards leaves ~2 steps visible at 900px. The shipped
   panel already collapses to a 44px rail and to a bottom sheet under 768px; **keep both, do not rebuild**.
3. **Four chrome regions** (header/publish · floating canvas bar · right panel · bottom tray). Fine at
   1440, crowded below — name the composition in the spec so it cannot drift during build.

**Four extensibility seams to write into the spec now** (the operator's explicit "do not stop here" ask):

1. **A node-slots contract.** `PhaseNode` takes data-driven slots (icon · title · subtitle · badges ≤2 ·
   status · verdict) so Phase 185 (grounding mode + action-risk), 188 (run state) and 189 (connectors)
   add **data, not layout**. The neutral 137-B card has the room a coloured one would not.
2. **The badge budget will be contested — settle it now.** 137 allows ≤2 word-badges on the face; 185
   wants two more and 188 wants status. Rule: **the face keeps 2, everything else moves to selection or
   the panel**, or 185 spends its first week fighting the card.
3. **Connector nodes cost nothing extra under 137-B** — no new colour slot is needed, and the `e-mail` /
   `ticket` / `electric-plug` / `link` marks are already extracted and luminance-verified in
   `themes/phase-icons-3d.js`. The 189/190 door is genuinely open.
4. **The validate seam is the extension point, not the canvas.** New governance ships as new verdict
   codes in the owning module; the canvas renders whatever comes back, keyed by `verdict.phase`. That is
   why VALID-03's "never a client guess" is a **flexibility** rule as much as a correctness one — future
   rules need no canvas change at all.

**Carried into the plan as a pre-req:** the two cross-cutting `PHASE_GLYPHS` swaps (`handshake`,
`compass`) are now REQUIRED before 184 builds, because 137-B makes the icon the sole carrier of step type.

**Feeds `/gsd:spec-phase 184` / `/gsd:discuss-phase 184`** — acceptance bar = these four winners as marked.

---

## Phase 185 — Graded Governance (`/gsd:sketch 185`, 2026-07-28)

Four sketches for the milestone's **headline differentiator**: per-node grounding mode + the orthogonal
action-risk dial (GOVERN-01/02/03). They inherit the whole 184 language unchanged — **137-B** Glass Depth
cards, **139-A** mark + problems tray, **140-A** the shipped 400px `PhaseFormPanel`, **141-B** canvas
toolbar + page header — and add data to it, never layout.

**Three model decisions taken by the operator at intake (2026-07-28), BEFORE any variant was drawn:**

1. **Grounding is DETECTED and ONE-WAY.** A step that reads the knowledge base switches itself to
   Grounded and locks; an open step can be escalated by hand; a grounded step can never be loosened.
   This is the literal reading of "structurally enforced and NOT author-loosenable-away", and the only
   option that closes the 36-step gap without waiting for a human to notice it.
2. **Governance gets a dedicated NON-COLOUR, NON-BADGE channel on the canvas.** The face's two-badge
   budget is fully spent (grounding + "Waits for you") and 137-B banked 100% of the colour budget for
   Phase 188's run status. Governance may spend neither.
3. **The action-risk checkpoint is a gate ON the risky step**, not an extra step in the flow. Step count
   and step numbering stay true; whether it materialises as an `llm_human_input` phase underneath is an
   engine detail the canvas hides.

**The corpus is NOT a constraint (operator, 2026-07-28).** Every workflow row in the database is
engineering test data, so there is no migration or grandfathering problem to design around — detection
simply applies. This also reverses the usual "nothing invented" rule for THIS phase's sketches: the
shipped rows are fixtures named `eval_coverage` / `split` / `fanout`, and grounding a business-wording
question in them made the sketches LESS readable, not more. **Phase-185 sketches draw realistic business
workflows and say so**, while keeping the engine facts real (phase types, the `get_tools` registry, the
`{kind: "citations_required", config: {mode: "deterministic"}}` gate shape).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 142 | grounding-dial-and-lock | A step that reads your documents is held to citing them, and that cannot be switched off. How does that read as a safety rail rather than as a broken setting? | **B — a switch that refuses** ★ | phase-185, govern-01, grounding-mode, detected-lock, one-way, escalate-only, phaseformpanel, plain-language, g2-sketch-gate |
| 143 | proven-on-the-canvas | How do you mark a proven step on the canvas when colour and badges are both already spent? | **A — a sealed edge** ★ | phase-185, govern-02, canvas-mark, non-colour-channel, badge-budget, colour-budget, phase-188-collision, greyscale-proof, g2-sketch-gate |
| 144 | the-approval-stop-sign | Where does "this step waits for your OK" live, so you can see it before a run and feel it during one — without adding a step to the flow? | *pending* | phase-185, govern-03, action-risk, approval-checkpoint, connectors, phase-189, phase-190, armed-default, g2-sketch-gate |
| 145 | the-review-moment | The run has stopped and is asking you to approve sending a document. What do you actually see before you say yes — and where are you standing when you see it? | *pending* | phase-185, govern-03, review-moment, artefact-preview, check-coverage, run-surface, workflow-vs-chat, phase-188-input, approve-blind-honesty, g2-sketch-gate |
| 146 | the-round-trip | How do you get from the canvas into a human review and back out again — for every kind of output, and when things go wrong? | **A — one place** ★ | phase-185, govern-03, round-trip, canvas-to-review, output-types, docx-not-previewable, ask-user-timeout, failure-modes, phase-188-input, g2-sketch-gate |

**Two findings 142 produces that outlive whichever variant wins:**

1. **"Not author-loosenable-away" resolves to one precise rule — _you can only undo a lock you created._**
   A detected lock (a KB tool is on) and a policy lock (`citation_policy: strict`) are owned by their
   cause and have no switch at all; an author-escalated lock is undoable because it was a choice. If
   detection later applies to an escalated step, detection wins and the undo disappears.
2. **The requirement's "confidence gate" has no field behind it.** `grep -rn confidence` over
   `backend/app/services/harness/` and `backend/app/models/harness.py` returns nothing; the shipped
   `citations_required` validator is deterministic coverage, not a threshold. Phase 185 either adds a
   real confidence number (new field, new scope) or the word leaves the requirement. **Decide at spec
   time, not build time.**

**Decision carried into 143 and beyond (operator, 2026-07-28):** grounding takes **no exceptions** — a
step that reads your documents must prove it, full stop. The exploratory-reading case ("skim the board
decks and suggest themes") is handled by *splitting the step in two* — a proven retrieval step feeding a
free-to-think judgement step — not by a third state. Rejected alternative: an "reads, but exploring"
mode, which would put a named escape hatch inside the one rail that is the milestone's differentiator.

**A finding 143 hands forward to Phase 188.** Both governance channels survive a colour-blind read
because neither is made of colour. Run status, as currently imagined, does **not** — switch colour off
mid-run and it vanishes entirely. **188 needs a shape of its own, not just four colours.**

**The build rule 143-A creates.** The corner seal is the **load-bearing** mark and the edge is
reinforcement: run status overwrites the border, so mid-run the seal is the only carrier left. Verified
live at all four run states — the seal stays legible on every one. Therefore (1) the seal may never be
conditional on run state, and (2) top-right of the 137-B card is now **claimed** — Phases 188/189 may not
take it. B (a rail outside the border) is the documented fallback if the seal proves too quiet in use.

**Connectors are designed for now, not bolted on later (operator, 2026-07-28).** Sketch 144 draws an
email-out and a file-to-shared-drive step as a labelled preview of Phases **189** (governed
external-action node, no live egress) and **190** (2-3 live connectors + SSRF / credential /
cross-tenant security). Reason: only **9 of 170** steps in the corpus do anything outbound today, which
makes the action-risk gate look optional — and 189 SC#2 already commits that the external-action node
"carries the Phase-185 action-risk approval checkpoint **by default**." The connector marks used are the
already-verified `connector_email` / `connector_link` entries in `themes/phase-icons-3d.js`.

**The finding 144 produces regardless of which variant wins:** an outbound step with no checkpoint is
harmless today and is *the whole risk* the moment 190 ships. **The default must be armed-on** — a new
external-action step arrives with its checkpoint set, and turning it off is the deliberate act.

**Sketch 145 carries a proposal that belongs to PHASE 188, not 185.** Two operator questions on
2026-07-28 turned out to be one: *"how does the user view the artefact before approving?"* and
*"workflows run and appear in the chat — we need to isolate them."* Verified in code: `WorkflowsPage.tsx`
launches a workflow by creating a thread and **redirecting into Chat**. You cannot draw "what do I see
before I approve" without deciding where you are standing, so **both 145 variants are drawn on a
dedicated workflow run surface — own header, own compact spine, no message list, no composer.** Phase 188
("a business view distinct from the developer timeline, painted from the same run stream") should start
from that rather than re-derive it.

**Two honesty cases 145 settles for any approval surface, whichever variant wins:**

1. **Approving blind must look different from reviewing.** When the artefact cannot be previewed, the
   surface says so in as many words, offers the download first, and records the approval as *without a
   preview*. An approve-blind that renders identically to a real review is the failure mode.
2. **A long deliverable gets a reviewer's summary, not 40 unread pages** — total coverage, which sections
   are the AI's own assessment rather than quotation, and what changed since the last approved version.
   And *Not yet* HOLDS: the run waits for a person, it never quietly times out and sends.

## ⚠ Two engine truths sketch 146 found — both are PHASE-185 SCOPE, both falsify sketch 145

Found by reading shipped code while drawing 146, not assumed. 145's README carries corrections in place.

**1. The approval gate expires into "yes".** `_exec_llm_human_input` (`phase_types.py`) blocks on
`subscribe_for_response(..., timeout_seconds)` — default **300s**, cap 1800
(`settings.ask_user_max_timeout_seconds`). On timeout it returns `None`, `answer` becomes `""`, and the
phase **returns normally**, so the workflow ADVANCES — and in the drawn flow the next step is the email.
GOVERN-03 may reuse the `llm_human_input` SUBSTRATE (durable prompt row, `tool_call_id`, resume sweep)
but **must not inherit its timeout disposition**. An action-risk gate has to **fail closed**. Engine
change; belongs in the phase scope.

**2. The flagship deliverable cannot be previewed.** `FilePreview.tsx` renders markdown, plain text,
code, CSV and images; **DOCX / PPTX / XLSX / PDF fall through to download-only**. And `llm_emit` +
`render_template` (docxtpl) produces **`.docx`**. So the most important artefact a workflow makes is the
one a reviewer cannot see. Either the review moment gains a docx→viewable conversion, or every template
deliverable is approved blind — which guts GOVERN-03. **Spec must take this fork deliberately.**

**Three more failure modes 146 names, with owners:** the durable prompt survives a closed tab but the
clock does not stop; a second approver on an org-shared run must be told *who* decided (the run-time twin
of Phase 186's co-editing guard — name it there); and a failure AFTER approval must never make the
approval look undone, nor let a retry re-send.

## Cross-sketch alignment audit (2026-07-28, operator-requested)

Ran across 142-146 before the wrap-up. **Three real misalignments found and fixed**, not waved through:

1. **The running example had drifted into three different workflows.** 142 drew 4 steps, 143 drew a
   different 5, and 144/145/146 drew a third. Now **one canonical flow everywhere**, and it is the flow
   the skill teaches:

   | # | Step | Governance | Why it is in the example |
   |---|---|---|---|
   | 1 | Find the risks in our supplier files | **must prove it** (detected — reads the KB) | the auto-locked case |
   | 2 | Work out which suppliers look shaky | free to think | judgement — the case that earns "free" |
   | 3 | Write the risk report | **must prove it** (authored policy) | the deliverable + the citation gate |
   | 4 | Email it to procurement | nothing to prove · **approval armed** | connector (189/190) + the action-risk gate |
   | 5 | File it in the shared drive | nothing to prove · **not armed** | the contrast that argues armed-on by default |

2. **A vocabulary overclaim.** 143 called a step **"Proven"** on a canvas that has never run. Nothing is
   proven until a run's citation gate passes. **Settled rule: the seal reads "must prove it" everywhere
   on the canvas; the word "traceable" appears only at the review moment (145), where the check has
   actually run.** Calling an unrun step "proven" is the exact overclaim this milestone exists to prevent.

3. **A state conflation in 146.** The executing step and the waiting-for-a-person step shared one chip
   ("Waiting for you"). Split — "Running now" vs "Waiting for you". Pitfall 4 in miniature.

**Deferred with a trigger:** inline rendering of `.docx` / `.pptx` / `.pdf` is **not decided** (operator,
2026-07-28 — *"we will decide later"*). The finding stands. **Re-open at `/gsd:spec-phase 185`, and
unconditionally at Phase 190**, when live connectors make an unread-but-approved document something that
really leaves the company. The *behaviour* is not deferred: until it is decided the surface says so out
loud and records **approved without a preview**.

**Resolved at `/gsd:spec-phase 185` (2026-07-28, commit `4d7ea818`):** the `.docx` preview gets **its own
insert phase immediately after 185** — not Phase 190, and not folded into 185. Its consumer
(`FilesSection` → `FilePreview`, `frontend/src/components/panel/`) already ships and is independent of
governance; it maps to no GOVERN requirement and needs a net-new frontend dependency. The 190 re-open
trigger is satisfied early rather than dropped.

### Phase 185 session (cont.) — the one shape 142–146 left open (2026-07-28)

`185-SPEC.md` locked 9 requirements and recorded exactly one unsettled design question: **the at-rest
canvas mark for an armed action-risk checkpoint.** Sketch 144 drew two shapes and locked no winner —
145/146 overtook it — and neither survived as drawn once the shipped CSS was read: 144-A's collar wants
the same bottom edge as `.runchip` (`bottom: -13px`) and `.acts` (`bottom: -12px`), and 144-B's connector
badge was 30px of mark in a **66px** gap where the eye skips. Requirement 8 locks *that* an armed step
must be marked and locks the budget (no colour, no word-badge, top-right seal untouched, still 5 steps);
147 picks the shape. **Intake decisions:** the mark **interrupts the flow** rather than sitting quietly on
a card, and an **unarmed risky step is marked too** — same shape, unlatched — because otherwise a step
that emails a report with nobody watching looks identical to a step that reads a file, and 144's surviving
finding (*the default must be ARMED-ON*) has nothing to argue against on screen.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 147 | the-armed-mark | Who owns the canvas card — which shape is real (137-D shipped vs 137-B locked), where do the governance seal and the armed action-risk mark fit, and what collides once 185/188/189 have all landed? | **B — 137-B · verdict left · the detour** ★ | phase-185, govern-03, action-risk, armed-checkpoint, armed-default, unguarded-risk, canvas-mark, shape-only, phase-188, phase-189, g2-sketch-gate |

**The build cost, established while drawing:** `WorkflowCanvas.tsx:279` already registers an `edgeTypes`
entry named `flow` and `canvasModel.ts:88` gives every edge a `data.kind` — so a connector-based mark
(A / C) rides a shipped seam rather than needing net-new infrastructure. B is still cheapest by a
distance (one pseudo-element on `PhaseNodeCard`, no edge work, scales with the card at fit-zoom), but it
puts a **second lock-shaped mark** on a card that already carries the governance seal, and the two dials
are orthogonal — reading them as one channel is the specific risk to judge.

**Round 1 rejected (`f7fad019`), and the reason is reusable.** The first pass drew three different
PICTURES — a level-crossing boom, a padlock latch, a hazard-hatched band. Operator verdict: *the ideas
hold, the treatment does not.* Two faults, the second worth remembering: they were **pictograms in a
system made of structure** (edges, seals, rails, borders), and the padlock **collided with the seal** —
the 143-A governance mark is a shield, so two ORTHOGONAL dials ended up wearing two security pictures,
and *must prove it* vs *stops and asks you* blurred into one "governed" impression. **Nothing on this
card may look like the seal, not just nothing may occupy its corner.**

**Round 2 — one mark, three placements.** The mark is a **gate bar**, identical in every variant:
*armed* = the bar is whole and the flow visibly cannot pass; *not armed* = the SAME bar splits in the
middle and stands open. Because the mark no longer varies, the only thing under test is **where it
belongs** — in the gap (truthful: the run really does pause BETWEEN steps), on the card's leading edge
(cheapest, scales with the card), or across the whole canvas (unmissable, claims full height).

**Round 2 rejected, and round 3 changed what the sketch IS.** Round 2 drew one gate bar in three
placements — structural rather than pictogram, but still a **barrier**, which says *blocked* and has no
person in it. The operator then named the real fault: *"you are not being comprehensive and not aligning
on what we already built and what we will build collectively."* True — **rounds 1 and 2 were both drawn
against `canvas-184.css` `body.card-b`, a sketch-era card, while the shipped `PhaseNodeCard.tsx` renders
a different one.** Round 3 is therefore an **occupancy audit**, not a shape hunt.

### ⚠ TWO STRUCTURAL FINDINGS — both affect phases beyond 185

**1 · The card decision and the card code disagree.** `canvas-184.css:170-171` records *"the operator
moved the locked card from 137-D to 137-B on 2026-07-26"* (icon floats on TOP, 248px, centred). But
`PhaseNodeCard.tsx:311-313` renders the mark at `absolute left-0 top-1/2`, 56px, card inset `ml-6` /
padded `pl-10`, 260×96 — **137-D, icon on the LEFT** — and nothing in `frontend/src` applies a `card-b`
class. Stray 137-B reasoning is already embedded in shipped docblocks (`PhaseNodeCard.tsx:287`,
`WorkflowCanvas.tsx:502-504`) justifying real placements on a premise the file does not render.

**2 · `185-SPEC.md` Requirement 6 rests on an occupied corner.** Sketch 143-A put the governance seal at
top-right and the SPEC locked that corner as CLAIMED — but the shipped **VALID-03 verdict mark is
already there** (`PhaseNodeCard.tsx:298`, `-right-2 top-1.5`). They overlap **3×17px on BOTH card
shapes**; sketch 147 computes it live rather than asserting it. A third collision (`stepNumber` × icon,
22×8px) appears only on 137-D and is very likely why that slot renders nothing today.

### Constraints that now bind every later canvas phase

| Constraint | Source |
|---|---|
| A **third badge is a typecheck error** (`BadgeSlot2Tuple`) | `PhaseNodeCard.tsx:117-118` |
| **No focusable control may live in the card** — one tab stop per node, asserted in `WorkflowCanvas.test.tsx:231-238`; this is *why* ✕ and ＋ sit on the LANE | `PhaseNodeCard.tsx:37-48` |
| The **＋ owns the gap centre** — 26px at `INSERT_Y = 28`, in a `GAP = PITCH_X − NODE_WIDTH = 60`px span | `WorkflowCanvas.tsx:314-327, 575` |
| `status` (188), `stepNumber`, `technicalLine` are **declared, unrendered slots** — future claimants | `PhaseNodeCard.tsx:141-149, 164-167, 181-184` |

**Consequence for GOVERN-03:** if the armed mark is clickable it **cannot live on the card at all** —
it is either a non-interactive mark (with arming done in the side panel, where 142-B already puts the
grounding dial) or it lives on the lane like ✕ and ＋.

### ★ RESOLVED 2026-07-29 — sketch 147

**Winner B: 137-B is the card.** Three decisions, all now binding on 185 / 188 / 189:

1. **137-B is the target shape** (icon floats above a 248px centred card). `frontend/src` still renders
   137-D, so the code owes a card-geometry change that moves the icon, the verdict mark and the step
   number together — **its own task**, recorded out-of-scope in `185-SPEC.md`. The two shipped docblocks
   that reason from 137-B on a 137-D component (`PhaseNodeCard.tsx:287`, `WorkflowCanvas.tsx:502-504`)
   are corrected in the same task.
2. **The verdict mark moves to `-left-2 top-1.5`; the 143-A governance seal keeps top-right.** The rule
   this establishes is reusable: **a PERMANENT mark keeps a verified corner; a TRANSIENT one moves.** The
   seal is a property of the step and was verified at all four run states; a verdict exists only when the
   server returned a problem. `185-SPEC.md` Requirement 6 amended accordingly.
3. **Icon clearance widened** — `padding-top` 34 → **42**, `NODE_MIN_HEIGHT` 96 → **104**, so the visible
   52px mark clears the title by **11px** instead of 3. `NODE_MIN_HEIGHT` is a floor the card grows down
   from, so raising it is additive.

Result: **zero collisions between rendered marks on 137-B.** The one residual is the moved verdict
grazing the `stepNumber` slot by 2×16px — a slot that renders nothing (D-183-07). If it is ever brought
to the face, move it to `left:16` and it clears; the sketch reports that separately from real collisions
rather than inflating the red count.

4. **Arming happens in the SIDE PANEL; the canvas mark is READ-ONLY.** Forced as much as chosen —
   `PhaseNodeCard.tsx:37-48` forbids any focusable control inside the card (one tab stop per node), which
   is why the ✕ and ＋ live on the lane. The operator chose the panel over a third lane affordance so
   **both governance dials sit together**, beside 142-B's grounding dial. **The panel is where you SET,
   the canvas is where you SEE.** `185-SPEC.md` Requirement 8 refined with a machine-checkable acceptance
   criterion (no `role`, no `tabIndex`, no handler on the mark; exactly one tab stop per node).

5. **THE ARMED MARK IS THE DETOUR** — the connector *into* the risky step leaves the flow and comes
   back through a point representing the person. The only finalist that says what the engine DOES (stop,
   hand out to a human, resume) rather than *blocked*, which is what both rejected rounds of barrier
   shapes said. **Armed:** the solid arc IS the path, with no straight line running past it. **Not
   armed:** the arc stays as a faint dashed ghost with a line through it — present and open, never
   absent, which is what keeps the armed-on-by-default rule legible.

   *Verified, computed not asserted:* the arc clears the ＋ by **8.2px** and never enters its box; and
   because it lives in the GAP it is clear of the ✕, which is card-centred straddling the card's bottom
   edge (`WorkflowCanvas.tsx:618-627`, y = H−12 … H+12) — **exactly where the rejected `countersign`
   would have landed**, and within ~5px of the rejected `waiting card`. *Build note:* a CUSTOM EDGE, not
   a node change — rides the `edgeTypes.flow` entry `WorkflowCanvas.tsx:279` already registers.

**Sketch 147 is CLOSED.** Nothing structural remains — card, corners, control home and mark are all
settled. `/gsd:discuss-phase 185` picks it up from here.

| 60 | **Node face = the LAYERED ladder — author name → config-derived → type sentence (148-C), with AI-authored names folded in as a SEEDING behaviour rather than a display strategy.** Phase 187 VOCAB-01's plain-language vocabulary ALREADY SHIPPED in 183 (`phaseVocabulary.ts:127` `PHASE_TYPE_SENTENCES` + the 3-tier `nodeTitle`); what had not shipped is *specificity*. Measured, not assumed: only **10 of 119** live phases carry a real `phase.name`, and the NL generator authors a **definition-level** name only (`workflow_authoring.py:88`), never a per-step one — so **every AI-seeded workflow renders the same six type sentences**, and in the sketch's procurement scenario steps 2 and 3 are letter-for-letter identical. That is SC#5's "toy demo" failure landing on VOCAB-02's own headline feature; the seed problem and the vocabulary problem are ONE problem. Three criteria decided it, each computed from a visible cell, never asserted: ① every step reads distinctly ② the face survives a config edit ③ a hand-written name is kept. **A (AI-authored, stored)** fails ② — re-binding step 3's skill leaves the stored name promising a pricing-policy check while the step runs `contract-risk-flags`; **B (config-derived only)** fails ③ — it discards the author's "Board-ready renewal pack" for the template filename, i.e. config-only *removes* the one tier already shipped; **C passes all three** and is additive (ONE tier inserted into the shipped ladder — a pure function, no schema change, no migration). **A and C are not rivals and must not be planned as an either/or:** A governs what the generator WRITES, C governs what the card SHOWS when nothing was written, so A fills C's top tier and the derived tier is the safety net underneath. Bounded residual for discuss-phase: **a stored name that predates a config edit — stays on the face, or gets marked?** Build constraint surfaced: the title `truncate`s at 14px in the 248px 137-B card, and derived titles built from a folder or filename already wrap ("Fill Renewal Summary.pptx"). **Method lesson (recorded because it generalises):** the first review reported "no difference between the variants" — the variants were correct, the SKETCH was wrong twice: the deciding card (step 5, the only place B and C disagree) sat off-screen behind a horizontal scroll, and tab-switching outsourced the comparison to memory. **Variants that differ SEMANTICALLY IN THE SAME POSITION need a co-present side-by-side view, not tabs.** | Sketch 148 winner C + operator 2026-08-01 |
| 61 | **Technical-names on the canvas = SWAP THE SUBTITLE, never the title (149-C).** Audit first, because it shrinks the phase: the reveal is **already fully shipped on the canvas** - the app-wide `TechnicalNamesProvider` (Phase 154 / LANG-01, ONE boolean so two toggles can never disagree), the toolbar toggle (`WorkflowCanvas.tsx:1285`), the `technical` merge onto node data (`:945`), the title swap (`PhaseNode.tsx:144`) and the SAME swap on the vertical spine (`PhaseSpineGraph.tsx:125`). Both graph views already agree - **VOCAB-01 owes no wiring.** What is open is that the shipped reveal is a *swap* that DESTROYS the plain title - cheap when that title was the generic "Work out how to do it", expensive the moment **60/148-C** makes it specific ("Search Supplier Contracts"). Three treatments compared co-present at both toggle states: **A (swap the title, shipped)** loses the business meaning AND - measured, not predicted - **truncates**, rendering `AI agent step / find-renewal-t...` because the title is `truncate` at 14px in the 248px card, so *the slug clips*: the one genuinely technical token, and the entire reason to turn the reveal on. **B (add a third line)** gives the best comprehension but SPENDS `technicalLine`, a slot rendered by the card (`PhaseNodeCard.tsx:325`) yet deliberately never passed - `PhaseNode.tsx:183` reserves it for **Phase 188** alongside `status` and `stepNumber`, so picking B is a 188 scope decision, not a 187 one. **C wins:** the plain title stays as the title and the technical detail replaces the SUBTITLE, which 148-C already made near-redundant - meaning kept, detail gained, **no slot spent, card height unchanged**. Open: confirm the subtitle is near-redundant across all six phase types, not just `llm_agent`. | Sketch 149 winner C + operator 2026-08-01 |
| 62 | **AI-seeded canvas arrival = ALL AT ONCE + A SEED RECEIPT that names what was locked and why (150-B).** The honesty constraint that killed the obvious answer: generation is **SINGLE-SHOT, not streamed** - `generate_workflow_definition` (`workflow_authoring.py:217`) makes exactly one provider call on a valid first emit (two only on a first-pass `ValidationError`, never three) and returns the whole definition or an honest error, never a partial; the builder is `empty -> composing -> drafted`. So **a node-by-node reveal is PACING, NOT PROGRESS** - the work is finished before the first node lands - and variant A carries that admission printed on its own canvas rather than implying an event it never received. The three variants answer **DIFFERENT** questions and none answers all three (*where do I start reading / why is that step locked / what have I reviewed*): A answers 1, B and C each answer 2, but not the same 2. **B wins because it is the ONLY variant that discharges SC#3.** Safe-by-construction is invisible by construction - two steps arrive carrying a seal the user never asked for, and today nothing anywhere explains it; the receipt ("Here is what I built - 5 steps. Two of them read your documents, so I set them to **must prove it**. You cannot turn that off - but you can see exactly where it applies") is that explanation, per-step, with its cause. Same discipline as #16's publish gauntlet: render the real reason, never re-derive it. **C (AI-drafted-until-touched) is NOT rejected, it is deferred as a separate question** - it tracks review state, which B does not, but as drawn its mark occupies the verdict slot's coordinates (`-left-2 top-1.5`) and its glyphs are **net-new**, not existing vocabulary; it also owes an answer on whether an unreviewed node blocks publish. | Sketch 150 winner B + operator 2026-08-01 |
| 63 | **Start-from-a-template = the template SEEDS THE DESCRIBE BOX; the gallery stays on the Workflows page (151-C).** Measured: there are exactly **THREE** curated starters (`list_starter_workflows`, `db/workflows.py:291`, reading `definition->>'category'='starter'`; mig 094 seeds Risk Register / Weekly Status Report / Compliance Gap Report), so a gallery is over-built - and "fork a starter" is ALREADY one of the four routes into the Builder (`WorkflowBuilderPage.tsx:459`); what was missing is only a door on the FIRST screen. The axis that decided it is not clutter but **path count**: A (quiet link) and B (inline chips) both create a **SECOND forward path** - template to canvas, skipping generation entirely - a second way a workflow comes into existence, with its own code and failure modes, bypassing the describe-to-draft flow everything else is built around. **C collapses it back to one path:** picking a template fills the describe box with its plain-language sentence, which you can still edit before anything is generated. Preserves #11's describe-box-only screen and #12's 3-second read (one extra line, same as A). **C's cost is real and recorded:** it discards the starter's *curated definition* - a workflow a human shaped - and re-derives one from a sentence, which may come back different; that is why **#19's three-homes contract keeps the direct curated fork on the Workflows page**, where a library belongs, giving both behaviours a home without either crowding the calm screen. | Sketch 151 winner C + operator 2026-08-01 |
| 64 | **ICON CONVENTION reaffirmed + the canvas glyph vocabulary written down (operator directive, 2026-08-01).** Enforcing #43 during the 148-151 review caught FOUR drifts *the assistant had introduced*, every one an invention where a shipped value existed - recorded because the failure mode generalises: **a sketch that invents a glyph teaches the wrong vocabulary to whoever builds from it.** The shipped canvas vocabulary, read from source: **U+26E8** governance / "Must prove it" seal (`PhaseNodeCard.tsx:440` - the SAME shield as the Control Room's operator-only mark; one authority mark, two surfaces) - **lock glyph** locked / one-way (`GovernanceSection.tsx:280`, `WorkflowDoorSwitch.tsx:159`) - **U+2933** the on-fail branch (`PhaseNode.tsx:238`, `PhaseSpineGraph.tsx:201`) - **fullwidth + / x** add / remove, on the lane never the card (`WorkflowCanvas.tsx:637/680`) - **undo/redo arrows** - **diamond** a gauntlet stage - and phase-type marks from the ONE shared 3D map via `icon3d()` / `PHASE_GLYPHS`. The drifts: a **diamond-with-dot** drawn for the seal (should be the shield), a **raised-hand emoji + amber tone** on the "Waits for you" badge (the shipped `waitsForYou` BadgeSlot has **NO glyph** and tone `primary` - the card's own docblock says *the WORD carries the meaning*), a 20x20 seal (21x21), and - worst - **ONE phase-type glyph used as a category icon** for each starter in 151, which misuses the shared map (`icon3d('llm_agent')` means "this STEP is an agent step", not "this WORKFLOW is about risk"). **There is no category-icon vocabulary in this system and none may be invented**: #36 already settled that a whole workflow is identified by its **glyph-dot PHASE SPINE**, so starters now carry their spine at both sizes (honest side effect - the chips wrap to two lines, which *strengthens* B's density cost rather than hiding it). Post-fix audit: the shield is the only glyph literal across all four sketches; 150-C's drafted/reviewed marks are retained but flagged in-README as **net-new proposals**, never passed off as existing vocabulary. | Operator directive + sketches 148-151 2026-08-01 |

---

## Session 2026-08-04 — Phase 188: Non-Technical Run Observability (sketches 152-154)

**G-2 sketch gate for Phase 188.** The ROADMAP guardrail block lists 188 for G-2 ("live run 'feels
like'"), and no 188-owned sketch existed: the two sketches tagged `phase-188-input` (145, 146) were
authored *for Phase 185*, and **145's winner is still `*pending*`**. Sketch 143 additionally handed
188 an explicitly unanswered question. These three close that gate.

**The running example across all three** is one realistic business workflow — *Supplier renewal risk
pack*, 5 steps — drawn with REAL phase types (`PHASE_GLYPHS`), the REAL plain-language sentences
(`PHASE_TYPE_SENTENCES`) and the shipped grounding rule (a KB-reading step is detected-and-locked, so
it carries the `⛨` seal). Engine facts stay real; the scenario is business-readable.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 152 | the-runs-own-room | You click Run. Where do you stand — and tomorrow, how do you find that run again and get the file it made? | **B — the run has its own room** ★ | phase-188, runviz-03, run-surface, workflow-vs-chat, launch-redirect, run-history, deliverable-reach, three-homes, d-14, g2-sketch-gate |
| 153 | run-state-without-colour | What carries a step's run state on the canvas, when colour alone is not allowed to carry it? | **A — the well becomes the dial** ★ | phase-188, runviz-01, canvas-mark, run-status, colour-budget, badge-budget, greyscale-proof, shape-not-colour, waits-for-you-collision, step-number-slot, g2-sketch-gate |
| 154 | the-run-that-tells-the-truth | How does the canvas read when it cannot just say done — failed, reloaded, cancelled, capped, or in a state it does not recognise? | **A — every node states its own truth** ★ | phase-188, runviz-02, run-honesty, total-function, reconcile-on-fetch, fail-open, closed-taxonomy, cap-paused, retrying-not-durable, tier-ladder, g2-sketch-gate |

### Six measured facts these sketches establish before any variant is chosen

Every one was read from the tree on 2026-08-04 rather than inherited — the standing rule after four of
four executors in Phase 186 found an inherited claim false.

1. **`Phase["status"]` has no `waiting-for-you` value.** The union is
   `pending｜running｜done｜failed｜retrying｜skipped` (`types/index.ts:1013`). SC#1's sixth state can
   only derive from `pendingAsk != null`, which is already on `Phase`. **Two sources, one vocabulary.**
2. **`retrying` cannot survive a reload.** It exists in the client union and NOT in
   `workflow_phases_status_check` (`pending｜active｜completed｜failed｜skipped`,
   `full-schema.sql:1932`), so reconcile can only restore it as *running*. **SC#4 lands directly on
   this** — it is a real loss of information at every reconnect, not a rendering detail.
3. **The fail-open is one line and it is chosen wrong.** `DB_PHASE_STATUS[r.status] ?? "done"`
   (`StreamsProvider.tsx:3337`) maps an unrecognised status to **success** — precisely the reading SC#3
   forbids. Unreachable today (all five DB values are mapped), and the same shape as the
   `findIndex → -1` fail-open that painted an unknown `blocked_stage` as 8/8 green.
   **The fix is one word: fall back to an explicit unknown.**
4. **There is no run read endpoint.** `runs.py` exposes `/{run_id}/stream`, `/ask_user_response`,
   `/continue` and a `DELETE` — **no `GET /runs`, no `GET /runs/{id}`**. Any list-of-runs surface is
   net-new wire. A finished run's spine *is* already re-readable, but only thread-scoped
   (`threads.py:1189-1197`), and since `doRun` mints a new thread per run, **run history today IS chat
   history**.
5. **`workflow_runs` has no `started_at` / `completed_at`** — only `created_at`, `updated_at`,
   `claimed_at` (`full-schema.sql:1947-1962`). Sketch 130-C's "anchor the timer to `started_at`, never
   to mount" is **right in spirit and wrong in field** here; every clock in 152/154 is labelled with
   its real anchor, because an unlabelled clock silently meaning "since queued" is a lie the moment a
   run waits in a queue.
6. **`cap_paused` is a shipped state with no vocabulary.** `workflow_runs.status` =
   `active｜paused｜cap_paused｜completed｜failed｜cancelled` (`:1962`) and `POST /runs/{id}/continue`
   is a real route, but nothing in the product tells a user what a capped run is. *Adjacent:*
   `PhaseTimeline`'s `TERMINAL_RUN_STATUSES` contains `timed_out`, which is **not** a valid status and
   can never occur — dead code.

### The collision sketch 153 surfaces (not previously written down anywhere)

**`Waits for you` already ships, and it means something else.** Badge slot 2 (`PhaseNode.tsx:174-180`,
word-only, no glyph, `llm_human_input` only) is a **design-time** fact — this step *will* pause, true
whether or not anything has ever run. SC#1 asks for a **run-time** state — this step is paused *right
now* and nothing moves until you act. Sketch 146's alignment pass already ruled that *"running" and
"waiting for you" may never share a word*; this is the same defect one turn inward, and every 153
variant draws the waiting step with **both marks visible at once** so the operator can judge whether
they read as two facts or as one thing said twice.

### The card occupancy position going in (audited, not assumed)

`⛨` seal top-right — **CLAIMED**, never conditional on run state (pinned twice: a `?raw` props fence
and a four-run-state render assertion) · verdict mark on the left edge — transient · badge slot 2 —
`Waits for you` · **FREE:** badge slot 1 (a third badge is a *typecheck error*), `stepNumber`,
`technicalLine`, and the 62×62 icon well · **ANTICIPATED:** the card **border**, which the card's own
docblock already gives to 188. Two invariants no variant may break: no third badge, and **no focusable
control inside the card** (one tab stop per node).

### The seventh fact, found on the SECOND audit pass (2026-08-05)

**The status vocabulary already exists, and it is not on the canvas.** `PhaseCard.tsx:67-79` ships
`STATUS_META` — every one of the six phase statuses already carries a **glyph + real text + an
AA-contrast colour token**, built explicitly as non-colour-alone for WCAG 1.4.1. That is the
*developer* timeline: the exact view 188's canvas is meant to be the business twin of, painted from
the same stream.

This was found **after** sketch 153's first draft had already invented a parallel set of lane glyphs —
i.e. the precise failure §4 exists to catch (*"a sketch that invents a glyph teaches the wrong
vocabulary to whoever builds from it"*). Recorded rather than quietly fixed, because it is the second
time in five days the same failure mode has been caught by the same rule.

| Status | Shipped | Word | Canvas can inherit? |
|---|---|---|---|
| `running` | `●` | Running | yes, verbatim |
| `done` | `✓` | Complete | yes, verbatim |
| `failed` | `✕` | Failed | yes — agrees with `VERDICT_MARK.error`; same mark, same news |
| `retrying` | `↻` | Attempt *N* | the mark yes; **the state cannot survive a reload** (fact 2) |
| `pending` | `○` | **Locked** | the mark yes, **the word no** — "Locked" is a harness word for "the engine has not unlocked this step"; beside a governance rail that also says *locked*, it reads as a permission |
| `skipped` | `⤳` | Skipped | **NO** — `⤳` is already the on-fail `skip_to_phase` **branch edge** on the canvas (`PhaseNode.tsx:257`, `PhaseSpineGraph.tsx:250`). One surface, one glyph, two meanings |
| *waiting for you* | — | — | nothing to inherit — no such status exists |

**And the same split in words.** `PhaseCard` labels an `llm_human_input` step **"Needs you"** (`:48`);
the canvas badge says **"Waits for you"** (`PhaseNode.tsx:177`). Two views of one run, two words for
one concept — neither wrong, each decided independently, and **Phase 188 is the first phase obliged to
make them agree**, because it is the first to show both views of the same run. Together with the
design-time/run-time collision above, *"waits for you"* is now carrying **three** distinct jobs.

*Noted while auditing, not 188's to fix:* `PhaseCard`'s `PHASE_TYPE_LABEL` still carries the flat
`⚙ ✎ 🤖 ⛓ ☺` glyphs Phase 127 retired in favour of the shared 3D map, and lists only five types — so
`llm_emit` falls through to `•` "Step".

### Glyph audit (icon-convention §4)

**The first pass of this audit was itself wrong, and the correction is the point.** Three drifts were
caught on the 2026-08-05 re-check and fixed:

| Drift | Why it was wrong | Fix |
|---|---|---|
| 153-C invented eight lane-notch glyphs | `STATUS_META` already ships six of them | inherits `● ✓ ✕ ↻ ○` verbatim; the two it cannot inherit render with a **visible violet `net-new` tag on the page**, so a proposal can never be mistaken for shipped vocabulary |
| 153-B put `✕` on the card for "failed" | §4 reserves `＋`/`✕` for add/remove **on the lane, never the card** | B now always shows the step **number** — truer to B's own proposition and drift-free |
| 153 + 154 drew `!` and `▲` for a problem | `VERDICT_MARK.error` and `STATUS_META.failed` both ship `✕` | `✕` |

**Inherited:** `⛨` (`PhaseNodeCard.tsx:440`) · `● ✓ ✕ ↻ ○` (`STATUS_META`) · `?`
(`VERDICT_MARK.unknown`) · `⊘` (sketch 129-C's stopped/cancelled marker).
**Net-new, flagged in-README and on-page:** `‖` waiting-for-you / `cap_paused`, and `⋯` skipped-on-canvas
— exactly the two readings with nothing to inherit.
**153-A uses no glyph at all**, which is an argument in its favour under the same rule that gives the
shipped `Waits for you` badge none: *the word carries the meaning; tone is decoration.*
No phase-type glyph is used as a category icon.


### Winners (operator, 2026-08-05) — and the one bill they add up to

| # | Winner | Why it won |
|---|---|---|
| 152 | **B — the run has its own room** | A run becomes a thing with an address: own header, own spine, **no message list, no composer**, plus a `Runs` home across every workflow. The shape 145 and 146 were both already drawn on. A's `Runs` tab could only answer *"how has this workflow behaved?"*, never *"what ran last night?"* — the question an operator actually asks; C is free but leaves tomorrow's run in chat history. |
| 153 | **A — the well becomes the dial** | The only variant that **spends nothing** — badge slot 1, `stepNumber` and `technicalLine` all stay free for Phase 189 — and the only one that **uses no glyph at all**, so it cannot drift under a convention that has caught two glyph drifts in five days. B collides with the verdict mark by a measured 2×16px and clearing it reopens a coordinate 185 chose deliberately; C puts state in the gap between cards, where 144-B found *the eye skips*. |
| 154 | **A — every node states its own truth** | The reason lives on the step it belongs to. A run-level banner is one sentence about a five-step spine — it says *something* failed and makes you hunt for *which*. Same principle 145-A settled for the review moment: **decision and evidence are one object.** |

**The bill, stated once so planning cannot be surprised by it.** 152-B is the largest ask in this phase:

1. **Two net-new reads** — `GET /runs` and `GET /runs/{id}`. Neither exists.
2. **A fourth home in a three-homes contract** (#23-A), which is wired with **no router** — the
   `ActiveView` union extends; a router must not be smuggled in behind it.
3. **The launch redirect goes** — `doRun`'s closing `selectThread(); onNavigate("chat")`
   (`ChatLayout.tsx:264-266`) is exactly what SC#5 deletes.
4. **Durations stay approximations** until `workflow_runs` gains a column — every elapsed figure is
   `updated_at − claimed_at`, so either the column lands or **the UI must not present the number as a
   runtime.**

**The interaction between 153-A and 154-A, recorded now rather than discovered in build.** They compose
well — *the ring says which state, the card says why* — but 154-A is **the first thing to actually spend
the card's free vertical space**, and that column now holds the subtitle (which Phase 187 gave to the ⌥
technical reveal), the reason block, and a still-notionally-free `technicalLine`. **Plan the card body as
one budget, not three independent slots.**

**Picking 153-A does NOT settle the vocabulary.** Three questions go to discuss-phase intact:
`pending`'s shipped word is **"Locked"**; `skipped` **cannot** inherit `⤳` on the canvas because it is
already the branch edge; and **"waits for you" is now carrying three jobs** — the design-time badge, the
run-time state, and the developer view's "Needs you".

### A build note that outlived its variant

**Place an arc's gap with `stroke-dashoffset`, never with a rotation.** Setting the SVG `transform`
attribute *and* CSS `transform-box`/`transform-origin` composes them and pivots about a doubled offset.
That bug shipped in two consecutive drafts of 153-A and was only caught by an operator screenshot — the
amber gap sat in the lower-left while the pause chip sat at the top, detached from the gap it was
supposed to occupy. The offsets are now computed from `offset = (D + G/2) − p` and verified numerically
in-source. **A sketch's geometry is as reviewable as its code, and a screenshot is the review.**

---

## Session 2026-08-08 — Phase 190: Live Connector Slice (sketches 155-156)

**G-2 sketch gate for Phase 190.** `190-CONTEXT.md` D-27 records the guardrail firing and being
honoured rather than skipped, and scopes the sketch to **the Settings → Connections page only**,
capped at ~3 on-screen actions. The author-side picker is deliberately NOT sketched — it reuses
`ExternalActionSection`'s shipped shape — but sketch 155 draws a small seam strip proving the row's
identity line is what that picker renders, so no second vocabulary is invented at the seam.

**Two measured facts shaped the decomposition before any variant was drawn:**

1. **The shipped Settings tab shape fights this surface.** `SettingsPage.tsx:875-884` ships five
   tabs and every one is a *single-value form saved en masse* — Integrations ends in one
   **Save Integrations** button (`:1354-1365`). `connector_connections` is per-org, **per-row**,
   with a write-only secret. Row CRUD inside a whole-tab-Save contract puts two save models on one
   screen. Sketch 155-B exists to make that visible; it is a foil, built to be rejected.
2. **The surface must survive connection #4 through #40.** SEED-013's broad catalog and the MCP
   client both land on this exact page. So 155 ships a **scale control (empty · 3 · 24)** — the
   045 real-scale rule, and the BUG-260624-01 lesson where a fixed grid crammed illegibly at the
   real roster.

**Two operator decisions taken at intake, recorded here so they are not re-litigated:**

- **The connection form gets a credential check that DELIVERS NOTHING**, run **after save** on the
  stored connection — Slack `auth.test` / Jira `/myself` / SMTP connect-auth-quit. Rationale: a
  pre-save check would put a plaintext token on the wire for a non-storage purpose, in the one
  phase whose whole gate is `threats_open: 0`; a post-save check instead exercises the same
  org-scoped resolver **D-14** protects. It is not the D-16 shape, because the line that matters is
  *"did an external side effect occur"*, not *"did a packet leave"* — nobody's inbox, board or
  channel changes. **Flexibility argument:** it grows `ConnectorAdapter` to `{describe, check, send}`,
  which is the *more* MCP-shaped protocol — a real MCP server has a handshake, and `check()` is
  where that lands when SEED-013 arrives. A test-*send* has no MCP analog and would be deleted later.
- **Kill-switch honesty follows a rule, not a placement preference:** the **banner owns
  platform-wide truth** (`live_connectors` off — not a fact about any one connection), the **row
  owns only what is true of that row** (disabled, credential failed). Every future per-connection
  state has a home; every future platform state has a different one. 155 ships a
  `banner ⇄ rows ⇄ both` toggle so the rule can be felt before it is committed — at 24 rows,
  "both" is 24 identical amber lines.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 155 | connections-at-rest | Where does a per-row, per-org CRUD surface live in a whole-tab-Save Settings — and what is a connection's 3-second identity, at 3 connections and at 24? | **C — own tab, instrument table** ★ | phase-190, conn-02, settings, placement, scale, instrument-table, kill-switch, seam-proof, g2-sketch-gate |
| 156 | adding-a-connection | How does the create form make "where this sends" and "what we hold" honest — and how do the two refusals land? | **A — push/split panel** ★ | phase-190, conn-03, secrets, write-only, egress-refusal, fail-closed, d-11, d-07, d-26, credential-check, g2-sketch-gate |

### The finding sketch 156 produced before a winner was picked

**A refusal you CAN fix leaves the door open; a refusal you CANNOT fix closes it.** Driven in-page
across all ten moments:

| | moment 8 · egress refused | moment 9 · no encryption key |
|---|---|---|
| Cause | the host typed resolves to `10.4.2.19` | no `SECRETS_ENCRYPTION_KEY` configured |
| Fixable by the person here? | **yes** — correct the host | **no** — nothing they type helps |
| So Save | stays **enabled** + *"Correct the host and try again"* | goes **disabled** + `aria-describedby` at the reason |

Both follow the 142-B rule: name the cause, name what the refusal **costs**, put the reason in real
DOM text and never in a `title`. Moment 9 is where **D-11's deliberate fail-CLOSED inversion** of
`get_cipher()`'s shipped fail-open polarity (D-150-01) becomes visible to a person — it is a
decision, so it has to read as one.

**156's three containers are content-identical by construction** (verified in-page:
`aEqualsB: true, aEqualsC: true`), so the container comparison cannot be won by one variant
happening to tell more truth than another.

### Claims these sketches make that the backend does not yet honour

Recorded now so plan-phase either builds them or deletes the sentence — never ships the copy
against absent behaviour:

- *"no step will be allowed to use it until this passes"* (156 moment 6) — needs a real gate at
  bind or publish time, or the sentence goes.
- **`Used by N steps`** (155's table column) — needs a count over `workflow_definitions.definition`
  JSONB across published versions. Net-new, and it is what names the victims in a 073-A delete confirm.
- **A persisted check verdict + timestamp** on `connector_connections` — 155's `Credential` column
  reads `checked 2 days ago`, which is a column decision for **migration 116**.
- **Capability glyphs `✉ ▣ ＃` are placeholders**, not shipped art. They are not canvas
  `PHASE_GLYPHS` and must not become a fourth icon vocabulary — settle the source before build.

### Winners (operator, 2026-08-08)

| # | Winner | Why it won |
|---|---|---|
| 155 | **C — own tab, instrument table** | The only variant that survives its own future. A's three capability shelves are a projection of *today's* closed set of three (D-04); a fourth capability or SEED-013's catalog needs a fourth shelf, where C needs one more chip in a filter bar it already has. The 24-row drive made it concrete — A becomes three unfilterable lists (Messages alone is 13), C reads `13 of 24` on one scan line. **B did its job by being rejected:** two save models on one screen is not taste, it is one `app_settings` form behind one Save button (`SettingsPage.tsx:1354-1365`) sharing a screen with rows that each own a transaction and a write-only secret. **So Connections is a SIXTH TAB**, and that placement is now a decision with a reason. C is also a re-use, not a new pattern — the 068-A roster shape already carries users and the model registry. |
| 156 | **A — push/split panel** | Path of least resistance and already shipped three times (`PhaseFormPanel` 140-A, the 037-A rules builder, the 027-A detail shell). Decisive beat: **it is the only container that does not trap you at moment 6** — when a check fails the honest next action is to look at the list (which connection is unusable, is anything else), and B's dialog scrims the list away. Same *scan → fix → next* argument that decided 027-A. C loses on growth, the same axis as 155: the notice blocks are the tallest thing in the form, so at moments 8/9 the inline row grows past ~400px and stops being a row — and inside 155-C's table it would push every row below it. |

**Obligations the winners inherit** — carry these into `/gsd:plan-phase 190` rather than rediscovering them:

- **155-C:** the filter bar + live count are load-bearing at scale, not decoration. The `Credential`
  column commits **migration 116** to a persisted check verdict + timestamp. `Used by` commits a
  net-new count over `workflow_definitions.definition` JSONB.
- **156-A:** must survive **375px** (mobile → bottom sheet, per the shipped shell rule). Unlike the
  rejected B, the panel gets **no free focus trap or focus restore** from `Dialog` — both are net-new,
  and the a11y 035-A got for free here has to be built. Name it in the plan, not in review.

---

### Phase 192 session — Workflow Library IA (LIB-01…04) (2026-08-10)

G-2 sketch, BEFORE discuss/spec-phase. First sketch batch of **v3.7 Workflow Product Completion**.
Grounded by **auditing the shipped `WorkflowsPage.tsx` at HEAD** (1407 L) rather than reasoning from
the 012/021 sketch-era CSS — SEED-136's read still holds exactly: header has **no create button, no
search, no sort, no view toggle** (`:479-486`); the body is **one scroll container** (`:518`); shelves
run Starters → Published → Drafts (`:544`/`:568`/`:604`); the dashed build-card is the **first cell of
the third grid** (`:613`); and the only two `placeholder` hits in the file are the RunModal kickoff
textarea and a comment.

**Two operator answers set the whole frame** (intake, 2026-08-10): the page has **two first-class jobs**
(find-and-run, with authoring a close second), and it must read well at **org scale, 50-200+ workflows**.
That combination kills the flat 2-column card grid regardless of card quality, and it moves the create
affordance out of the third grid. Every sketch ships a **12 / 54 / 200 scale selector** so density is
felt at the real number, not at demo scale (the 045 lesson).

**Three findings the audit produced that no planning document named:**

- **Seven action verbs across three card types** — `Use this →` · `⑂ Tweak` · `▶ Run` ·
  `⋯ Delete workflow…` · `✎ Open` · `Publish…`. LIB-03 is not one confusing button; it is three card
  types teaching three vocabularies. **Two of them are the same action in different words** —
  `onTweak` (`:220`) and `onUseStarter` (`:259`) both fork a draft into the Builder, and the shipped
  comment at `:250` calls the latter *"a sibling of onTweak"*. **And a draft card's two buttons call the
  same handler** — `✎ Open` (`:723`) and `Publish…` (`:731`) are both `onClick={onOpen}`.
- **The explanations that would stop the surprise are `title=` tooltips** (`:857` for Tweak, `:155`
  region for Use this). **Touch has no hover**, and Phase 185's own graded-governance rule already says
  a reason must be real DOM text via `aria-describedby`, *never* a `title`. The page breaks a rule the
  codebase holds elsewhere. Measured across sketch 159: variants A/B/C carry **0** action-level `title=`;
  the shipped reference tab carries **4**. ⚠ Inherited and unfixed in all four: the phase-type word is
  still hover-only on every chain glyph.
- **G-5 FIRES and had been invisible.** `WorkflowsPage.tsx` measures **21 commits across 10 phases**
  (103/124/143/152/155/165/184/184.1/186/188) at **1407 lines**, and was **absent from the CLAUDE.md
  hot-file ledger** — so ten phases touched it and not one produced the refactor recommendation G-5
  requires, because the audit step scans against that table and a file missing from it is invisible to
  its own guardrail. The row was added 2026-08-10. **Discuss-phase 192 must put the refactor question
  first**, since 192 is a structural rewrite of this file's library view, not a mount point.

**Vocabulary correction carried into the sketches:** the shipped `PHASE_GLYPHS` (`soulData.ts`) is
`gear · memo · compass · handshake · raised-hand · package · outbox-tray` (7 types incl. Phase 189's
`external_action`) — **not** the flat `⚙✎🤖⛓☺◆` set this MANIFEST's older prose still describes.
Tiers are `STRICT 🔒 / MIDDLE ◐ / LOOSE ○` (`deriveTier.ts`), derived, never stored.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 157 | the-library-at-scale | What organizes 50-200 workflows, and where do *find* and *create* live in the frame? | **B — one list, shelves are filters** ★ | phase-192, lib-01, lib-04, workflows-page, information-architecture, scale, shelves, taxonomy, g2-sketch-gate |
| 158 | finding-and-narrowing | What is the find instrument, and does it live on the page, in ⌘K, or both? | **A — always-on page search** ★ (B deferred, trigger recorded) | phase-192, lib-01, lib-02, search, filter, command-palette, g2-sketch-gate |
| 159 | what-a-card-promises | At scale, what does a card show — and what do its actions promise before you click? | **C — one verb, consequence inline** ★ | phase-192, lib-02, lib-03, card, actions, tweak, consequence, a11y, g2-sketch-gate |

**Couplings to decide at pick-time, not after:**

- **159-B implies 157-C.** Both spend the purpose sentence to buy density. Picking the dense row in one
  and the rich card in the other is not a coherent page.
- **158-A and 158-B may not be rivals at all.** Phase 156 already settled this split for chat
  (sketch 078-D: *the column filters what you see; ⌘K jumps anywhere*). If that precedent holds the
  answer is **both**, and the only real question is whether 192 pays for the global-palette change now.
  ⌘K reuse is **not free**: `ThreadCommandPalette.tsx` indexes threads only and is hand-rolled on Radix
  Dialog, **not `cmdk`** — teaching it workflows changes a global component and its shared engine.
- **Search scope is a decision, not a default.** 158-A matches name **+ purpose sentence** and highlights
  the hit, so `clause` / `assessments` / `sign-off` find workflows whose titles lack those words. But it
  is substring matching, **not meaning** — the paraphrase *"the thing that checks vendors"* returns **0**,
  and the sketch says so on screen. SC#1's literal bar is only *"part of its name"*.

### Winners (operator, 2026-08-10)

| # | Winner | Why it won |
|---|---|---|
| 157 | **B — one list, shelves are filters** | SEED-136's complaint is not that the shelves are ugly, it is that *the page's own commissioner cannot say what the three categories are for*. **A renames that question; B removes it.** A's ownership axis (Yours / Team / Starters) is the conservative fix and only wins if "is this mine?" is genuinely the question a person arrives with — at org scale, arriving to *run a known thing* is more common, and ownership is then just a third wall to scroll past. B makes every shelf a **filter with an honest live count**, which is the same move 155-C won on three months earlier: a category that is a chip survives a fourth category; a category that is a place needs a fourth shelf. It also fixes SC#4 **structurally** rather than by promotion — create leads the toolbar because authoring is the close-second job, so it can never drift back down a grid. C was not wrong, it was **premature**: it spends the purpose sentence for density, and 159-C keeps the card, so C here would have contradicted the card decision. |
| 158 | **A — always-on page search** | Decided on a use-count argument, not taste: at 200 workflows the field is opened **every visit**, so C's calm-at-rest saving is imaginary and its tap is pure recurring cost — *a control you always open should always be open*. A is also the path of least resistance for the stack (`ui/input.tsx` exists, no new dependency, page-local blast radius) and it discharges **both** SC#1 and SC#2 by itself. **B is deferred, not rejected**, with a three-condition re-open trigger in the sketch README — the Phase-156 precedent (078-D) says a page filter and a global jump box are different instruments and both can be true; 192 simply does not pay for a global-component change to get there. |
| 159 | **C — one verb, consequence inline** | A and C agree on the thing that actually matters — **the consequence is real DOM text, never a `title=`** — and differ only on how much of it to print. A repeats a two-line block on every card; at 200 cards that is the same clutter LIB-02 is trying to cure. C keeps A's *rule* and spends it once, on the only action whose result is not obvious from its name. B lost for a reason worth recording: it buys density by clipping the purpose sentence, which is exactly the atom the 046-A soul makes the hero — **and picking B would have forced 157-C**, so the card decision and the frame decision stay coherent by construction. |

**Obligations the winners inherit** — carry these into `/gsd:discuss-phase 192` and `/gsd:plan-phase 192` rather than rediscovering them:

- **G-5 FIRST, before the feature.** `WorkflowsPage.tsx` is now on the hot-file ledger at **21 commits /
  10 phases / 1407 L**, and 157-B is a structural rewrite of its library view. Per G-5 the discuss-phase
  **must produce a refactor recommendation as the first option**. The named seam: three card components
  → `components/workflows/library/`, `RunModal` and the WFIN-03 delete Sheet → their own modules,
  leaving the page as composition — the shape the 188.2 card cut used.
- **157-B commits the chips to being the RIGHT chips.** A flat list is only navigable if the filter set
  is. The sketch ships six (*Ready to run · Yours · Still building · Starters · Makes a file · 🔒 Strict*)
  and every one recounts against the live search so a chip can never promise results it cannot deliver.
  Which six ship is a **decision owed at plan time**, not a detail.
- **157-B deletes a place, so the three shelf names must be re-homed, not just dropped.** "Starters" is
  provenance, "Published" is state, "Drafts & seeds" is two things — each becomes a chip with a
  *plain-language* label (the 146 LANG-01 pattern), and the `GET /workflows/published` chip that
  currently renders a literal endpoint string to end users goes with it.
- **158-A must decide its search SCOPE deliberately.** Name-only is SC#1's literal bar; name + purpose
  is what the sketch demonstrates and is measurably more useful (`clause` / `assessments` / `sign-off`
  each find workflows whose titles lack the word). Whichever ships, it is **substring matching, not
  meaning** — do not let copy, placeholder text or a later summary imply semantic search.
- **159-C's consequence line is an a11y contract, not a caption.** It is real DOM text wired with
  `aria-describedby` — the Phase-185 rule — because **touch has no hover**. The two shipped `title=`
  explanations (`:857` Tweak, `:155` region Use this) are removed *by being replaced*, never by being
  deleted and left unexplained.
- **159-C inherits the naming collapse.** `⑂ Tweak` and `Use this →` are the same action in different
  words (`onTweak` `:220`, `onUseStarter` `:259`, and the shipped comment at `:250` says so); a draft
  card's `✎ Open` and `Publish…` call **one handler** (`:723` / `:731`). Seven verbs should not survive
  this phase intact — but note that collapsing them touches behaviour, so it is a **scope call for
  discuss-phase**, not a silent rename during execution.
- **⚠ Carried, unfixed, inherited by all four tabs:** the phase-type word is still a `title` on every
  chain glyph — the shipped glyph vocabulary's own hover-only problem. Not introduced by these sketches
  and not in LIB-01…04's scope; record it rather than let a later reviewer discover it and assume 192
  added it.

---

### Phase 192.1 session — Workflow Identity (LIB-05) (2026-08-12)

G-2 sketch, BEFORE plan-phase. **Phase 192 shipped the library; 192.1 gives its rows an identity.**
Nine of eleven G-4 UAT rows passed on live evidence and the operator still could not tell the rows
apart, because **43 of their 104 workflows are named "Compliance Gap Report."**

Grounded by **re-auditing the shipped `library/` subtree at HEAD**, not by reasoning from 157/159's
sketch-era CSS — and the audit produced four facts no planning document named:

- **The ordering is complicit, and it is nobody's card design.** Both feeds are `ORDER BY name`
  (`db/workflows.py:303` published, `:517` drafts) and `LibraryToolbar.tsx` has **no sort control at
  all** — zero `sort` occurrences. So 43 identical names render as **43 *adjacent* identical rows**.
  No atom-level treatment touches that.
- **Duplicate names are a COPY, not a bug.** Both fork handlers spread `...def` and leave `name`
  untouched — `onTweak` mints the same slug at v(N+1) (`WorkflowsPage.tsx:600-608`), `onUseStarter`
  mints `<parent>-[a-z0-9]{6}` at v1 (`:656-661`). A customer reaches 43 identical names **by using
  the product correctly.**
- **Lineage is DERIVABLE and costs nothing on the wire.** A version fork shares its parent's slug; a
  copy fork is a `-[a-z0-9]{6}` suffix on it. Measured over the generated fixture: **lineage resolves
  for 100 % of the 80 forks, 0 unresolved.** The page already builds `draftBySlug`.
- **The card renders 13 atoms and not one of them is an identity** (`WorkflowCard.tsx:366-565`).

**Two operator decisions set the frame** (intake, 2026-08-12): sketch the write-path question rather
than assume it (162 exists because the ROADMAP calls it *"the first scope question, not an
assumption"*), and **confirm `updated_at` as real net-new wire** — so 192.1 is **not frontend-only**,
the same surprise D-04 sprang on Phase 192.

**The wire cost, graded — two of three SC axes are free:**

| Axis | Cost |
|---|---|
| Lineage (SC#2) | **Zero.** Derived from the slug rules. |
| Recency (SC#3) | **Cheap, net-new.** Additive `updated_at` projection on two queries + two TS types — exactly the `is_mine` shape (D-04). No migration, no predicate change. |
| Owner *by name* | **Expensive, and nobody asked for it.** The wire has `is_mine` (a boolean, only since 192) and `created_by` (a uuid, never serialized). A human-readable owner needs a users join. **All variants render Yours / Shared and stop there.** |

⚠ **The timestamp is already on the wire and you must not read it.** The drafts feed ships
`updated_at` disguised as `token` — literally `to_char(updated_at AT TIME ZONE 'UTC', …)`
(`db/workflows.py:93-95`). `api.ts:3338` forbids parsing it: Postgres keeps microseconds, a JS date
keeps milliseconds, and a parsed-and-re-rendered token matches **zero rows**, so every later save
refuses as stale (probed against the live DB 2026-08-01). **Project a separate field; never repurpose
the token.**

**The fixture is GENERATED, not typed** — `themes/library-fixture-192-1.js` applies the real
`copyFork`/`versionFork` rules to a set of sources, so the duplicate names *fall out of the product's
own behaviour*. It reproduces the operator's measured library: **43/41, 10/9, 8/5, 8/4 — all four
families exact** — 14 duplicated names, 107 rows, 40 % under one name (measured 41 %).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 160 | telling-43-apart | When 43 rows carry one name, what makes a row identifiable at a glance? | **B — disambiguate-on-collision** ★ | phase-192.1, lib-05, identity, lineage, recency, scale, shape, g2-sketch-gate |
| 161 | where-identity-lives | Where does identity go on a card whose one sentence is already spent? | **A — a second line** ★ | phase-192.1, lib-05, card, atom-budget, sentence-slot, a11y, g2-sketch-gate |
| 162 | naming-at-the-fork | Does the fork name the copy, or does the library derive it? | **B — the fork asks** ★ (reopens D-15) | phase-192.1, lib-05, fork, naming, scope, d-15, write-path, g2-sketch-gate |

**Couplings and reopenings to decide at pick-time, not after:**

- **162-A and 160/161 are NOT rivals.** A governs what the fork *writes*; 160/161 govern what the
  library *shows*. **SC#1 is a statement about rows that already exist**, so picking A does not remove
  the need for a read-side treatment. Reading A as "so we can skip the library work" is a misread.
- **162-B reopens D-15.** The fork is a **direct flip** and the reason is recorded in shipped code
  (`WorkflowCard.tsx:84-87`): a confirm on a non-destructive reversible action *spends the guard
  vocabulary the delete relies on*. 159-C's confirm was deliberately not shipped. B is viable only
  with an answer to **what makes a name prompt different from a confirm** — one candidate: *a prompt
  that collects something the system cannot know is an input, not a guard.*
- **161-C's viability turns on one distinction.** C spends the single sentence slot on identity, so a
  forked row stops stating the fork consequence. **C is only safe if the selector keys on "can this be
  forked into something new", not on "is this a fork"** — a design decision with a correctness
  consequence, to settle now rather than in planning.
- **161-B grows a region the house style treats as scarce.** Phase 185's corner seal claims top-right
  on the **canvas node card** with a max-2 badge tuple. That rule is *scoped to the canvas*, not to
  this library card — stated precisely so it is not mis-cited as a blocker, and stated at all so it is
  not discovered in review.
- **Every draft has an EMPTY sentence slot today** (`WorkflowCard.tsx:484` — it renders only when
  `runnable`). Whatever wins, that slot is already paid for.

**⚠ The lesson this session exists to bank — flip 160's `shape` switch.** Set it to *distinct names*
and every tab, including *Today (shipped)*, becomes perfectly readable. **That is the fixture every
automated check in Phase 192 ran against.** The phase tested at 12 rows *and* at 107 rows, but never
at 107 rows carrying 14 duplicated names. **Volume was real; shape was not.** `LIB-02`'s bar — *"a
card shows what the workflow is for, at a glance"* — is true of one card in isolation and false of the
list. Standing question for any list-rendering phase: **is the fixture's SHAPE realistic, not just its
SIZE?**

**⚠ A retraction carried into 162 rather than quietly dropped.** The "two names" propagation defect
claimed for this phase on 2026-08-12 is **RETRACTED** — generalised from **n=1** before the population
was measured. `definition->>'name'` returns NULL on a **string scalar**; 83 rows are double-encoded,
so "85 divergent" was 83 encoding artifacts plus **2 genuine conflicts**, both test fixtures. It is
*rendered on 162's Today tab* because promoting one observation to a mechanism is the same failure
this phase exists to correct.

**⚠ Also inherited: a verification lesson about this project's own work.** Phase 192's post-fix
re-drive located rows by `getElementById` on a known UUID — which proves the code and **cannot prove
the row was findable**, because the driver never had to find it. The operator, who did, could not.
**Any UAT row in 192.1 must be driven the way a person drives it: by looking.**

**Verification, driven not asserted:** `node --check` on every extracted inline script plus headless
JSDOM drives — **160: 40/40 · 161+162: 68/68 (108 total)**. Both `[title]`-attribute fences and the
script-error channel carry **positive controls** proving they can actually fire; jsdom's own
unimplemented `window.scrollTo` is excluded **by name**, never by silencing the channel.

#### Winners — operator, 2026-08-12

**160-B · 161-A · 162-B**, plus sketch **163** built afterwards to assemble them.

| # | Winner | Why it won |
|---|---|---|
| 160 | **B — disambiguate-on-collision** | Says something *different* on every one of the 43, where A says nearly the same thing 43 times and C leaves row 40 in an undifferentiated block. Accepted cost: the strip is a property of the SET, so a row's wording can shift when an unrelated row is deleted. |
| 161 | **A — a second line under the name** | Consistent placement and the only variant with room for owner + lineage + when at once. Accepted cost: **a 14th atom on every card** — affordable now that the *"13 atoms is too dense"* diagnosis (`U5-b`) is retracted. |
| 162 | **B — the fork asks** | The write path IS in scope, and the operator chose the surface that produces the best names. **This REOPENS D-15** — see the decision owed below. |

**⚠ 160-B and 161-A disagree at one edge, and 163 resolves it visibly rather than in prose.** B's
argument was restraint (the 13 unique-name rows get no strip); A puts a line on every card. **163
ships it as *quiet*:** a unique-name row keeps the line (A's consistent placement) but carries **no
discriminator segments** (B's spend-where-it-buys rule). A toolbar toggle shows the strict-B
alternative. **This is the last open question in the batch** and is owed a recorded decision.

**⚠ A DECISION IS OWED AT PLAN-PHASE: 162-B reopens D-15.** The fork was a **direct flip** because a
confirm on a non-destructive reversible action *spends the guard vocabulary the delete relies on*
(`WorkflowCard.tsx:84-87`); 159-C's confirm was deliberately not shipped. The working rationale for
why a name prompt is not that guard: **it collects something the system cannot know, so it is an
input, not a guard.** The design carries that claim *mechanically* — it asks for a **name** not a
confirmation, wears **no destructive styling**, and its primary button is **"Create my copy"**, never
"Confirm" (asserted in the drive). **Record it as a decision and amend D-15 in the same commit** —
never leave it silently contradicted.

**The delta this phase makes, in full:** atoms per card **13 → 14**; identity lines **0 → 107**;
sentence nodes **1 → 1, same text**; soul atoms **5 → 5, consumed unchanged**; net-new test hooks
**1** (`row-identity`); net-new wire **`updated_at`**. **One line, and a prompt on one verb.**

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 163 | the-assembled-card | What exactly ships — and what keeps the build from drifting from it? | **the assembled card** ★ (one toggle open) | phase-192.1, lib-05, acceptance-bar, build-contract, anti-drift, g2-sketch-gate |

---

### ⚠ THE ANTI-DRIFT MECHANISM (operator note, 2026-08-12) — applies to EVERY future sketch session

The operator's standing observation: **"I always see a difference between the sketch we do and the
actual implementation — the final shape after we finish."** That is true, and the cause is
**mechanical rather than carelessness**:

1. The sketch is **HTML/CSS**; the build is **React + Tailwind + shadcn**. Nothing transfers
   automatically, so every string, DOM order and spacing is **re-typed by an executor reading prose**.
2. **Prose does not typecheck.** This codebase has banked that lesson repeatedly — a wrong
   `PHASE_GLYPHS` pointer survived every gate in Phase 189 for exactly this reason.
3. Plans are written from RESEARCH and CONTEXT, **not from the sketch**, so the mockup becomes a
   reference nobody ever diffs against.

**Three artifacts close it, and 163 is the first session to ship all three:**

- **`BUILD-CONTRACT.generated.md`** — emitted **from the running sketch** by `drive.cjs --emit`, never
  transcribed: every exact string, every composed string with a worked example, the rendered output
  for each distinct row shape, and the measured invariants. It cannot go stale by being forgotten.
- **`drive.cjs`, version-controlled beside the sketch** — its assertions ARE the contract in
  executable form, and the README maps each one to the React equivalent the phase's own suite must
  reproduce. (160 and 161/162 now carry their drives too.)
- **One `COPY` table per sketch** — the sketch renders nothing not declared in it, mirroring the
  shipped `libraryVocabulary.ts` shape, so **the build ports the object and imports it** rather than
  hunting strings through JSX. 163 reads `FORK_VERB` and `FORK_CONSEQUENCE` from the *shipped*
  constants rather than re-typing them, which is the mechanism proving itself: a drifted copy of
  either would have failed the drive.

**What this still cannot catch, said plainly:** pixel spacing, Tailwind class choices, and
hover/focus states. Those stay a human comparison at UAT — **and the G-4 rows must name the sketch
file as the reference**, driven the way a person drives it (**by looking**, never by
`getElementById` on a known UUID — the verification lesson Phase 192 banked about its own re-drive).

---

## Session: Phase 193 — Authoring Doors + Template Placement (2026-08-13)

G-2 sketch, BEFORE plan-phase. **Phase 192 shipped the library and 192.1 gave its rows an
identity; 193 is about the two doors you reach from it, and where a template goes.**
Requirements **AUTH-01** (SEED-147) and **AUTH-03** (SEED-110, closed — placement only).

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 164 | telling-the-doors-apart | Which wording lets someone who has never seen the Builder predict what each door does — before clicking? | **D — the mix** (2026-08-13): B's door NAMES (`Draft it for me` / `Build it myself`) + C's two TIER labels (`you write one paragraph` / `you decide every setting`), **derived from B and C in `build.cjs`, never re-typed** — audit 18 matched / 0 missed. A·B·C remain on the page as the comparison that produced it, not as live options. **The header-strip restack is IN SCOPE for 193** (structural, no mockup — 193 owes it a CONTEXT.md decision). | phase-193, auth-01, auth-03, doors, naming, copy, template-placement, acceptance-bar, build-contract, anti-drift, g2-sketch-gate |

### ⚠ 164 CLOSES THE HOLE 163 STILL HAD — the arrow of generation is reversed

163 shipped all three anti-drift artifacts and **U8 still failed**, because
`BUILD-CONTRACT.generated.md` was emitted *from the running sketch*. The sketch stayed the
source of truth, so it could still draw an atom the card structurally cannot render (SEED-155).

**164 generates FROM THE BUILD.** `emit.test.tsx.src` renders the *real* `WorkflowDoorSwitch`
and the *real* `library/RunModal` under jsdom; `dom.generated.json` is that actual DOM; the
variants are the same DOM with **nothing changed but text nodes** from the COPY table; and the
CSS is built by the project's own `tailwind.config.js`. **Layout drift is impossible for the
doors panel, because the sketch's layout IS the build's layout.**

Its substitution audit exits non-zero on any string that fails to match the real DOM — i.e. a
COPY table that has drifted from the component fails the build. **It caught its own bug on run
1** (37 false "misses" from per-dump rather than aggregated matching); corrected, it reports
**37 matched / 0 missed**. A green audit is evidence, not decoration.

**What is still ordinary sketch risk, stated rather than implied:** the AUTH-03 template panel
is a **proposal** (it adds nodes no component has yet, so there was nothing to render), and the
header-strip *stacking* problem is structural — copy cannot restack a strip, so that stays an
open CONTEXT.md decision instead of riding along inside a chosen variant.

### ⚠ THREE MEASURED CORRECTIONS TO SEED-147 — the seed said "none yet measured", and nobody had

| Suspect | Verdict |
|---|---|
| #1 "Author & govern" is two verbs, one of them jargon | **STANDS** — unchanged since Phase 124. What B and C attack. |
| #2 the return control reads as a peer of the two doors | **STANDS, and it is STRUCTURAL** — in the govern door the strip is `‹ both doors` + the door label + `🔒 judge always-on`: three visual peers. That is the *"other one"* the operator could not name. |
| #3 "nothing states the consequence of the choice" | **FALSE as written** — each door card already carries an icon, a tier label, a consequence sentence and an italic footnote, under a heading that says *"nothing is locked, you can switch anytime"*. |

**And the chooser is REACHABLE**, which nothing had verified: `onCreate={openBuilderFresh}` →
`builderInitial=null` → `initialDoor="both"`. The operator *did* see a chooser. ⇒ The phase is
therefore **not** "add a consequence line" — it is that the consequence is stated as a
**feature list in the product's own vocabulary**. Variant C attacks precisely that by naming
what *you* must supply (one paragraph vs every setting).

### AUTH-03 — the finding that makes it more than copy

**The signal is derivable.** A fill phase admits `render_template` in its phase tool whitelist
(`backend/app/services/harness/phase_types.py:388`), so *"does this workflow want a template?"*
is a question the app can honestly answer. Today it never asks: the `Upload template` control
renders on **every** workflow, quiet and unlabelled — noise on the ~100 rows that will never
use it, and silent on the ones that need it. Operator pick (2026-08-13): **mark it on the card,
name it in the Run modal, render nothing for workflows that do not fill one.**

---

## Session: Phase 193.1 — Template-First Authoring (2026-08-14)

G-2 sketch, BEFORE discuss-phase. **AUTH-03's RE-OPENED half.** `REQUIREMENTS.md` records the
requirement as *"ANSWERED WRONGLY, not delivered"*: Phase 193 shipped the **draft-then-attach**
path (and quick task `260814-q5r` added the placeholder read on top of it), but a user who
describes a workflow still gets a draft built **blind to the template it will have to fill**
(`SEED-157`). A coverage tick here must mean *the workflow knows its template at draft time* —
not *the user can find where to supply one*.

**Measured before drawing anything:** `POST /workflows/generate` has accepted
`template_placeholders` since **Phase 103**; the frontend has **never sent it**
(`WorkflowBuilderPage.tsx` sends `{describe, project_folder_id?}` only). Its sibling
`template_asset_id` is typed `UUID` while asset ids are Storage **paths** — a measured 422, so
that channel is unwirable as typed and only `template_placeholders: list[str]` actually works.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 165 | the-template-lands-first | Where does "I have a template" live on the pre-draft screen, and how do its fields become a spec the author can see the draft aimed at — without slowing the person who has no template? | **C — the spec block** (2026-08-14). B rejected on a MEASUREMENT: it renders the fields at **10.5 px under a 14 px picker**, contradicting the intake decision that the fields ARE the visible spec. A and B stay as evidence. | phase-193.1, auth-03, template-first, describe-door, pre-draft, generated-from-build, g2-sketch-gate, seed-157 |
| 166 | when-there-are-no-eight-fields | The read came back and it wasn't a list. Does the screen still let the author believe their draft is built to their template — and where should the truth live? | **B — the footing line** (2026-08-14). A rejected: silence is SEED-157 recurring WITH a control on screen. C rejected on COST — it reopens the CTA settled as 164's variant D. A and C stay as evidence. | phase-193.1, auth-03, honesty, seed-157, seed-158, seed-159 |
| 167 | the-template-arrives-late | A template is attached to an already-drafted workflow. What does the app say about the mismatch — and what is it actually entitled to claim? | **C — name check, no claim** (2026-08-14). ⚠ B was NOT rejected for being wrong — it is the stronger idea, rejected on SIZE. NO seed planted (offered and declined); the re-open condition is recorded instead. | phase-193.1, auth-03, sc3, reconcile, honesty, seed-159 |

### Two operator decisions taken at intake (2026-08-14), before any variant was drawn

1. **Entry shape → an optional affordance on the describe screen**, under the KB picker — *not*
   a second pre-draft chooser and *not* a third top-level door. **Why:** SC#4 (the fast door
   stays fast) is then satisfied *by construction* — ignore the row and today's behaviour is
   byte-identical — and it adds no third door to a chooser `SEED-156` says cannot tell its first
   two apart. **The cost, on record:** template-first never becomes the *default* `SEED-157`
   proposes.
2. **Fields shown → the fields ARE the visible spec**, not a quiet "8 fields found" receipt.
   **Why:** SC#2 becomes visible to the author rather than merely true in the payload. **The
   cost, on record:** it breaks MANIFEST decision #12's *"3-second read at rest"* on this one
   screen.

### ⚠ 165–167 GO ONE STEP FURTHER THAN 164 — the central surface is no longer a proposal

164's arrow (generate the sketch **from** the build) is inherited unchanged. What changed is what
that arrow can now reach:

**164's template panel was a pure PROPOSAL** — it drew nodes no component had, and said so.
**165–167's central surface is not.** `TemplateAttachSection.tsx` **shipped** in Phase 193 and
grew its *"What this template asks for"* list in quick task `260814-q5r`. So the fields region on
these three pages is that component **mounted**, with its four honest arms, its exported
sentences and the **real eight keys of `pm-weekly-status-report.docx`** — and the keys are
**parsed out of the dump by `build.cjs`**, never re-typed, so no page can display a field the
shipped component did not render.

That is the `SEED-155` discipline in its strongest available form: *if a sketch depicts a surface
consuming an existing component, it must RENDER it, not redraw it.*

| region | source | drift risk |
|---|---|---|
| the describe door; the attach section, its fields, its four failure sentences | real rendered DOM | **none — it *is* the build** |
| the attach control on the pre-draft screen (165) | proposed `NEW` | ordinary |
| variant C's re-scaled type (165); the reconcile blocks (167) | proposed `NEW`/`CHANGE` | ordinary |
| the stateless-read route every filled state assumes | **does not exist** | a scope decision — 165's warning tab |

### Each build asserts before it draws — and 166's fence was driven RED

A splice into an anchor that is not there fails **silently** and yields a variant that quietly
equals the baseline: a green-looking sketch showing nothing. So each `build.cjs` asserts its
anchors present **and unique**, asserts the eight keys were parsed rather than typed, and asserts
**every stage actually differs from the shipped DOM** — exiting non-zero otherwise.
**165: 12 assertions · 166: 22 · 167: 8 — all passing.**

**166's pairwise fence was proved rather than asserted.** It checks that each of the five reading
arms renders its own node and **none of the other four** — the mechanised form of the shipped
docblock's rule that *"these two sentences may never merge"*. Planting
`template-fields-unavailable` inside the `none` dump produced `ASSERTION FAILURE ... found 1`,
`EXIT=1`, and the dump was restored to green. *A fence nobody has seen fire is a fence nobody
knows is connected* (the 192.1 lesson: three fences held with nothing defending them).

### ⚠ THE MEASUREMENT THAT CONSTRAINS SC#3 — no variant may claim coverage

**Nothing in the app can compute a coverage verdict at attach time.** `check_coverage`
(`template_render_service.py:416-460`) is the real computation and runs at **run** time over an
actual emitted field map; at attach time there are no values. All that exists is a comparison of
**names** — a heuristic, never a guarantee.

167 is built so that is visible rather than buried: its fixture makes the heuristic **cry wolf on
purpose**. Two of the eight fields (`project_name`, `reporting_period`) are legitimately supplied
as **run inputs** — nothing produces them and nothing should — so a naive two-bucket "nothing
produces this" check flags two perfectly correct fields. Hence **three buckets, never two**, and
hence `reconcile.disclaim` is load-bearing rather than decorative.

### Three open questions these sketches deliberately do NOT settle

They belong in `193.1-CONTEXT.md` as decisions, never smuggled inside a chosen variant:

1. **The chicken-and-egg route shape.** The shipped upload route requires a saved workflow, and at
   describe time none exists — so `TemplateAttachSection` mounted there renders its amber
   `TEMPLATE_UNSAVED_REFUSAL` and **no file input at all**. That dead end is drawn on 165's
   **wall** tab rather than argued in prose. Every filled state on 165/166 assumes the
   **stateless read** (the ROADMAP's recommendation); if planning picks *create an empty draft up
   front* instead, those states change.
2. **The `loading` race** (166). Nothing stops the author pressing Draft while the read is in
   flight — producing the blind draft this phase exists to prevent, on a screen that just told
   them a template was attached. Disable while reading / let the draft wait / let it through and
   reconcile after: none is drawn.
3. **Where a LARGE reconcile lives** (167). Every stage puts it on the 320 px rail because that is
   where the template arrives, but the changes are about the *canvas*. Four rows fit; fifteen do
   not.

### ⚠ G-5 fires on two files and is a DISCUSS-PHASE obligation, not a sketch one

`frontend/src/pages/WorkflowBuilderPage.tsx` (33 commits / **10 phases** / 2055 L) and
`backend/app/api/workflows.py` (32 commits / **16 phases** / 1813 L) were both added to the
hot-file ledger on 2026-08-14 and both are certain to be touched here.
**`/gsd:discuss-phase 193.1` owes a refactor recommendation as its FIRST option, before the
planned feature.** Sketching first is correct — it is the G-2 gate — but the refactor call comes
before planning, not after.

### ✅ WINNERS (operator, 2026-08-14) — and the one shape they add up to

| # | Winner | Why, in one line |
|---|---|---|
| **165** | **C — the spec block** | B was rejected on a **measurement**, not a taste: at intake the decision was *"the fields ARE the visible spec"*, and B renders them at **10.5 px under a 14 px picker** — the most consequential thing on the screen would also be the quietest. C costs a `scale` prop on a component that shipped three weeks ago. |
| **166** | **B — the footing line** | **A** was rejected because silence is `SEED-157` recurring **with a control on screen** — worse than no control. **C** was rejected on **cost, not clarity**: it reopens `Write the first draft`, settled three weeks ago as variant D of sketch 164, and makes a button's width depend on a number read out of an uploaded document. |
| **167** | **C — name check, no claim** | ⚠ **B was not rejected for being wrong.** It is the stronger idea and matches the phase's thesis — but a second model call, a diff surface, an accept/reject path and a new failure mode is a substantial build for what is here a **safety net**, not the headline feature. |

**In every case the losing variants stay on their page.** They are the comparison that
produced the pick — **evidence, not live options** — and 165's B in particular is the
standing record of what *"just mount the shipped component"* actually costs.

### The one shape the three winners add up to

The pre-draft describe screen gains **one optional row** under the knowledge-base picker.
Ignore it and today's behaviour is byte-identical (SC#4 by construction). Use it and the
template's fields render **at the screen's own scale, as the spec the draft is aimed at**
(165-C) — with **one line underneath that always says what the draft will be built from**,
taking a different value on each of the five reading arms and never merging *"we looked and
it has none"* with *"we never looked"* (166-B). On an already-drafted workflow the rail
gains a **three-bucket name check that explicitly disclaims being a coverage check**
(167-C).

### ⚠ THREE THINGS THE PICKS DO NOT SETTLE — carry them into `193.1-CONTEXT.md` as decisions

Recorded here because a decision that lives only inside a chosen variant is a decision
nobody made:

1. **The chicken-and-egg route shape.** 165-C's filled states assume the **stateless read**.
   If planning picks *create an empty draft up front*, those states change. 165's **wall**
   tab renders the shipped `TEMPLATE_UNSAVED_REFUSAL` — *"Save this draft first"* — with
   **no file input at all**, which is the dead end that route exists to remove.
2. **The `loading` race** (166). Nothing stops the author pressing Draft mid-read, which
   sends a generate call with no `template_placeholders` — the blind draft this phase exists
   to prevent, on a screen that just told them a template was attached.
3. **Where a LARGE reconcile lives** (167). Four rows fit on a 320 px rail; fifteen do not.

### ⚠ 167-B — NO SEED WAS PLANTED, and the re-open condition is recorded instead

The *"C now, B as a later phase (plant a seed)"* option was offered **explicitly** and
**declined**, so writing B up as deferred work would invent a commitment nobody made. What
is recorded instead is the **condition that would reopen it**, so a later reader can
recognise the evidence when they see it:

> **If C's false-alarm rate proves annoying in lived use** — an author dismissing the
> reconcile panel because it keeps flagging correct workflows — that is the evidence C's
> name heuristic is not enough, and B is the answer. B's full mockup, its `KEEP`-the-run-
> inputs judgement and its cost breakdown stay on sketch 167's page so nobody has to
> re-derive them.

`SEED-158` (authoring placeholders into a plain template) and `SEED-159` (a null field
rendering as a blank cell that lies) are **untouched and remain open** — both were named on
the sketch pages precisely so nobody solves them inside this phase by accident.

---

## Session: Phase 194.1 — Make the Stop Visible (2026-08-16)

G-2 sketch, BEFORE spec/discuss. **RUN-01's re-opened, user-facing half.** Phase 194 landed the
durable half and **verified it on seven live runs** (`workflow_runs` + the interrupted
`workflow_phases` row + the thread anchor + the producer `runs` row). Its own UAT then found
that **a person cannot perceive any of it**. Same shape as 192 → 192.1 and 193 → 193.1: the
parent shipped, a real gap was found in lived experience, and the gap gets its own phase rather
than a third gap-closure round (**G-7**).

**Measured before drawing anything**, at `045a83dc`:

- `grep -c "stopThread\|cancelRun\|Stop" frontend/src/pages/WorkflowRunPage.tsx` → **0**. The
  surface **▶ Run workflow** sends you to cannot stop the run it is displaying.
- `grep -ri "stopping" frontend/src` → **0** in production source. A pending-state vocabulary
  does not exist and is net-new copy, not a re-use.
- The panel Stop's gate is `showTimeline = isHarness || phases.length > 0` — **phase rows
  outlive the run**, so a finished run renders a live-looking Stop that produces no request,
  no screen change (`diffLen: 0`) and one console line whose stated cause is **false**.
- `runs.message_id` is **NULL on 587 of 607** rows whose thread owns a `workflow_run`
  (**96.7 %**, all 25 most recent) — so the chat surface has no run key for a harness run.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 168 | the-press-that-says-it-heard-you | What does Stop look like between the press and the run actually ending — and what stands where it stood once there is nothing left to stop? | **B — the control yields** (2026-08-16, operator). Chosen because `⊘` is already shipped tier-1 vocabulary (174 D1/D2) so no net-new glyph is introduced, and a double-press becomes impossible **by construction**. A and C stay as evidence. | phase-194.1, run-01, stop, pressed-state, bug-260816-01, bug-260709-01 |
| 169 | a-stop-on-the-runs-own-surface | Where does Stop live on a surface that says `👁 View only` — and does pressing it need a guard? | **A — in the title row** (2026-08-16, operator), over the sketch's own lean toward B. Guard: **direct flip**. C rejected on canvas-vocabulary grounds. All variants stay as evidence. | phase-194.1, run-01, stop, workflow-run-page, canvas, action-guards, bug-260816-01 |
| 170 | the-thread-that-remembers-the-stop | What does a stopped workflow thread show on return — and what happens to the approval card that was on screen when you stopped? | **B — the durable receipt** (2026-08-16). Decided on a MEASUREMENT, not appearance: the stop clears `threads.active_workflow_run_id`, so the anchor cannot be the source and a `workflow_runs`-by-thread read is the only construction that survives. A rejected — its mark is a MESSAGE property while the thing that stopped is a RUN. C rejected against the actual complaint. A and C stay as evidence. | phase-194.1, run-01, run-honesty, zombie-approval, bug-260816-02, bug-260710-01 |
| 171 | one-run-one-slot | What does the kickoff moment render, such that two assistant nodes cannot be drawn — **without** first knowing which of the three candidate mechanisms is live? | **C — AMENDED** (2026-08-16). ⚠ C **as drawn was REFUTED by measurement after the page was built** — there is no never-vanishes strip at kickoff. The amendment: C must BUILD the run-anchored line, which is the SAME element 170-B needs. A rejected (its dedup key does not exist for harness). B rejected on SCOPE not correctness — re-open if the amended C proves insufficient. | phase-194.1, bug-260610-01, duplicate-avatar, kickoff, unmeasured-mechanism |

### ⚠ 170 × 171 CONVERGE ON ONE COMPONENT — the single most consequential outcome of this session

Recorded at the top of this block because it is easy to lose inside two separate sketch READMEs,
and *a decision that lives only inside a chosen variant is a decision nobody made.*

**170-B** needs a thread-level reading derived from `workflow_runs` that survives the return.
**171-C**, once amended, needs a run-anchored line at list level that exists before any assistant
message does. **These are the same element in two states, not two features:**

> live &nbsp;→&nbsp; `◆ Starting workflow… · Step 2 of 3 · 2m 18s`
> stopped &nbsp;→&nbsp; `⊘ Stopped by you · 2 of 3 steps · 2m 18s · Open the run ›`
>
> …and the assistant message renders **only when it has content**.

One component answers **SC#3** and removes the kickoff double-avatar surface, frontend-only, with
no dependence on the unmeasured duplicate-avatar mechanism.

### ⚠ 171-C AS DRAWN WAS REFUTED BY MEASUREMENT, AFTER the page was built

Recorded rather than quietly repaired — a sketch that silently fixes its own losing argument
teaches nobody anything, and this project has the standing habit of recording the loser beside
the winner.

C's claim is that removing the kickoff placeholder is safe *because the never-vanishes run status
strip carries the run instead*. **There is no such strip at kickoff.** Measured at `045a83dc`:

```
MessageList.tsx:217   <RunStatusStrip … placement="header-bare" />
MessageList.tsx:193   showJumpToLive = !isPinned && isStreaming        ← the gate
```

The list-level strip is the **↓ Jump to live** chip and appears **only when you have scrolled
away**. The one always-present `RunStatusStrip` is `RunCard.tsx:336`, in the run-card header —
**inside the very assistant message C proposes not to render.** C as drawn would produce dead air
for the whole first-token latency. The sketch's own instruction (*"if that gap feels dead rather
than calm, C is wrong"*) is answered, and the answer is that it would have been.

**The amendment is what makes C the pick anyway:** the cost C was hiding is a cost 170-B was
already paying.

### The measurement that decided 170, and it is not a visual one

Phase 194 verified on seven live runs that a stop sets **`threads.active_workflow_run_id = NULL`**
— *the thread anchor is cleared by the very event the thread now has to remember.* `RunSoul` and
`RunSeam` both resolve their run **from that anchor**, so neither can carry a returning reading
either. ⇒ a mark that survives the return **must** come from a `workflow_runs`-by-thread read.
A and C are reading from places the stop has already emptied, or that can be absent.

### ⚠ Operator feedback on 170/171: "they all look similar to me" — and it is CORRECT

Both sketches render three variants that differ by a short line of text. The difference between
them is **where the reading comes from and whether it can be absent** — architecture wearing a
sketch's clothes.

**The lesson for the next G-2 call, worth more than either pick:** the guardrail fired here
expecting screen judgement and the judgement turned out to be non-visual. When the separating
condition is a *failure state* (here: a stopped run with no assistant content; a kickoff with no
strip), a sketch must **lead with the failure state** rather than offer it as one setting among
six. 168 and 169 did not have this problem — their variants differ on screen.

### ⚠ A claim inside sketch 170 is CORRECTED rather than defended

Variant A's note reads *"there is no assistant message to hang this on — 587 of 607 harness runs
leave `runs.message_id` NULL."* **That is stronger than what was measured.** A NULL `message_id`
means the run cannot be joined to a message *from the run side*; it does **not** prove no
assistant row exists. A's real weakness stands on its own — its mark is a **message** property
while the thing that stopped is a **run** — and the figure should not be quoted as though A
rested on it.

### ⚠ What the two picks GUARANTEE, and what they do not

The picks were requested as *"the best ones that guarantee perfect results."* Precisely:

| | |
|---|---|
| **Guaranteed** | At the workflow kickoff there is **no assistant node**, so the duplicate artefact **cannot be drawn** — regardless of which of the three candidate mechanisms is live. A structural property, not a repair. And the stopped reading **cannot be lost on return**, because it is not attached to anything the stop empties. |
| **NOT guaranteed** | The double-mount **race is not fixed** — the surface it rendered on at kickoff is removed. If the same race later affects the **content-bearing** message, the artefact returns. |
| **NOT covered** | **Plain chat.** The operator reported the duplicate *"not only [in] the workflow, it is in the chat area."* Deep renders `Setting up agent…` too, and changing it breaks the *Deep byte-identical* constraint held since Phase 174. **This closes the workflow half only** — the Deep half is a scoping decision for `194.1-CONTEXT.md`, not something to do silently. |
| **Still owed** | `194-MEASUREMENTS.md`'s trigger is **not discharged**. A qualifying store dump still tells us which mechanism is live — the difference between *"cannot render twice here"* and *"cannot render twice."* |

### ⚠ 170-B is a NARROW AMENDMENT to Phase 194 D-14, and must be recorded as one

D-14 examined `RunCard.tsx` on 2026-08-16 and **declined** to thicken the receipt, on two grounds:
*the panel owns the meaningful phase spine and chat carries a thin run receipt* (the 094/103
split), and *nothing here needs a new source of truth*.

B keeps the first (one line, no spine — the receipt stays thin) and **reverses the second** (it
adds a `workflow_runs`-by-thread read). That reversal is forced by the anchor-clearing
measurement above, and it is the decision to record — not a repudiation of D-14.

### ⚠ NEW G-5 FINDING — `MessageList.tsx` is ABSENT from the hot-file ledger

Where the converged run-anchored line would mount. Measured 2026-08-16: **18 commits**, at least
**6 phases** (`063 068.5 076.1 083 092 095`, plus untagged buckets), **234 lines**. G-5's
threshold is 3.

Identical invisibility failure to `WorkflowsPage.tsx` (ten phases), `WorkflowDoorSwitch.tsx`
(six) and `db/workflows.py` (seventeen) — *a guardrail cannot see what is absent from its list.*
**Add it to the `CLAUDE.md` ledger at discuss-phase**, at which point the phase owes a refactor
recommendation on it as its first option — alongside the two already owed on `WorkspacePanel.tsx`
(`14 / 9 / 580`) and `RunCard.tsx` (`21 / 9 / 608`).

### ⚠ The 168-B × 169-A collision, and its resolution

**Recorded here because it is a consequence of the two picks that neither sketch asked about.**
168-B replaces the control with a *reading*. 169-A puts the control in the *title row*. Combined,
B-on-terminal wants to render a terminal reading one line above the state row that already **is**
the terminal reading.

That is precisely the defect the operator reported on **2026-08-06** — `✓ Complete · Ran for
2m 18s` rendered directly beneath `✓ Complete   Ran for 2m 18s — from when it was queued to its
last update` — and the fix for it (making `run-band` `sr-only`) is still commented in
`WorkflowRunPage.tsx`.

> **Resolution: in the title-row mount, B yields to NOTHING.** The slot empties. The state row
> below *is* the terminal reading and it already ships (`⊘ Cancelled` + `Ran for …`). B's
> "the slot holds a reading" rule applies in the panel and the tray, where no such row exists.

### Three decisions taken at pick time (2026-08-16), to carry into `194.1-CONTEXT.md`

1. **The sketch's own "B's gate comes free" argument for 169 is CORRECTED, not defended.**
   `isTerminal` is a component-level const already in scope for **both** rows, so A's liveness
   gate is one clause reading the same variable — not a new derivation. What genuinely favours A
   is that the state row is `flex-wrap` and grows a long `claimed_at … → created_at … →
   updated_at …` string under the ⌥ reveal, so a control there wraps exactly when the row is most
   crowded. *Measured beside it:* `WorkflowRunPage.test.tsx:676` ships a fence asserting the band
   *"states the fact and offers NO control"* — ⚠ scoped to the **`sr-only`** `run-band` node, so B
   would **not** have failed it, but the recorded intent leans A's way.
2. **Two things now ride on 168-B and are correctness requirements, not polish.** (a) The
   composer's slot width — a 32 px icon button and a text line differ, and forking B to icon-only
   there **kills 168's whole premise** of one vocabulary across four mounts. (b) B's losing arm is
   **load-bearing**: B *removes* the control while stopping, so the timeout is the only route back
   to a pressable Stop. In A the control merely disables.
3. **Geometry, not a guard, answers the new misclick risk 169-A creates.** Stop now sits beside
   *Open the chat thread*, a routinely-clicked link. Recommendation: **Stop at the extreme right,
   the seam link inboard, with real separation** — a guard would tax the one thing this phase buys
   (speed of stopping). *Measured, so the move is unblocked:* the seam link is asserted **by text**
   (`getByText("Open the chat thread")`, two call sites) with **no order, position or byte pin** on
   that header.

### ⚠ Sketch 171 asks a DIFFERENT question than it appears to, on purpose

`194-MEASUREMENTS.md` opens *"VERDICT: ⏸ NOT MEASURED — DEFERRED with a trigger"* and states
*"The word 'probably' appears nowhere in this file, and neither does a verdict."* Three
mechanisms remain consistent with the evidence and are separated **only** by a live store dump
taken while a harness run streams — which does not exist.

So 171 does **not** ask *"how do we dedupe?"* (unanswerable today, and Phase 174 D6 already
decided the *outcome*). It asks **"is there one owned slot per run at all?"** — because **B and C
make the mechanism moot while A requires knowing it.** That asymmetry is available now.

⚠ **B implies persisting `message_id` for harness runs — a backend change**, in a phase whose
ROADMAP entry says it *"adds no new runtime path."* Most correct, most likely out of scope. That
is worth knowing **before** planning.

### Method note — these four are HAND-COMPOSED, not generated

Sketches 165–167 used the generated-DOM mechanism (render the real component, splice one block)
because of `SEED-155`. **These four are hand-composed against class strings and copy constants
read verbatim from source**, and every page carries a **PROVENANCE** table naming which regions
are shipped-verbatim and which are proposals. The reason is stated rather than assumed: most of
what is drawn here **does not exist yet** — there is no stopping state, no canvas Stop, no
durable stopped mark — so there is no component to render for the new parts.

⚠ **Two limits a build must honour rather than trust this page for:** 169's canvas nodes are a
**stand-in**, not `PhaseNodeCard` (which has a two-badge ceiling enforced by an
`@ts-expect-error` control and forbids focusable children — so **this page cannot prove variant
C's mount fits**); and 170's approval-card wording is **observed from the Phase 194 UAT report,
not read from source** — a build must read the real `PendingAskCard`.

### Reported bugs these four claim — all still `status: open` by design

`BUG-260816-01` · `BUG-260816-02` · `BUG-260709-01` (re-opened on its own trigger) ·
`BUG-260610-01` (frontmatter corrected 2026-08-16 — it read `folded` for two months while its own
body said the avatar half *"Stays OPEN"*). **The fold happens at `/gsd:discuss-phase`**, because
`status:` **is** the index a routing scan reads, and prose claiming a fold the frontmatter does
not record is worse than no claim at all.

⚠ **`BUG-260710-01` is the Deep-chat sibling of `BUG-260816-02` and must be looked at in the same
breath.** Different renderer, different source of truth (`runs` vs `workflow_runs` +
`workflow_phases`) — a fix to one does **not** automatically fix the other. If 194.1 closes only
the workflow half, the other's frontmatter must say so.

---

## Session: Phase 197 — Guided Authoring (2026-08-18)

G-2 sketch, **AFTER discuss-phase and BEFORE plan-phase**. `ROADMAP.md:677` flags G-2 on this
phase; `197-CONTEXT.md` records the guardrail as surfaced and **not overridden**, and the
discussion deliberately ran first so the sketch had a shape to draw — the project's own precedent
(*"G-2 sketch, BEFORE plan-phase"*, this file at the 193.1 session).

**The phase's own framing:** a freshly AI-generated draft arrives with the decisions the AI made
**visible and answerable in place**. D-07 fixes five rows — KB scope, template, business
requirement, name, deliverable — always all five, always the same order. D-02 says a **new sibling**
card beside `SeedReceipt`, never a widened receipt, and names the composition problem it expects
the sketch to solve: *"Two receipts stacked on one screen is a composition problem, and it is the
sketch's problem."*

### ⚠ RENDERING THE REAL SCREEN SHOWED THE PROBLEM IS A DIFFERENT AND LARGER ONE

**Three of D-07's five rows already have a control on the drafted view.** Measured by rendering
`WorkflowBuilderPage` with `visual_workflow_canvas` ON — not read about:

| D-07 row | Home on the drafted view **today** | Scale |
|---|---|---|
| 1 · KB scope | `project-folder-picker` select in the header identity strip (D-186-15) | **11 px chip** |
| 2 · Template | `TemplateAttachSection`, inside `PhaseFormPanel` (the per-step side panel) | rail scale |
| 3 · Requirement | `business-requirement-input` + the shipped `AI-proposed` mark (193.2-09) | **11 px chip** |
| 4 · Name | **nothing — and no display either** | — |
| 5 · Deliverable | **derived, not stored** — `soulDeliverable()` reads a terminal `llm_emit` | — |

So the real problem is **a second home for two shipped controls**, on a page whose own source
states the rule verbatim — `kbAffordance`'s docblock: *"A second, different answer to one question
is drift."*

⚠ **Row 4 is sharper than "static text".** The emitter handed the page a definition whose `name` is
`Vendor-risk review` and whose `slug` is `vendor-risk-review`. **The header renders the slug**, so
the workflow's *name* appears nowhere on the drafted view at all (asserted in `172/build.cjs`).
D-15 keeps the slug untouched — so after this phase the header would still show the slug while a
row edits the name: **two strings, one of them invisible.**

⚠ **Row 5 has no field at all.** "Answering" it means editing a step, which D-03's write path
(`builderStore`, one `set()`) does not express as a row edit. **Price this before planning rather
than discovering it inside planning.**

### ⚠ THE MEASUREMENT THAT PRICES D-02's LITERAL READING

The graph column ships as `grid-rows-[auto_auto_minmax(0,1fr)]` with the graph pinned by
`[&>*:last-child]:row-start-3`. Two findings, and the second is the one that decides:

1. **A fourth child STRANDS the graph.** The card auto-places into an implicit fourth row, the
   `minmax(0,1fr)` row has nothing left to distribute, and the graph — nailed to row 3 —
   **collapses to 0 px**. `requirementAffordance`'s own docblock predicted *"a control in
   `graphColumn` would … permanently shorten the flow."* Measured, it does not shorten it: it
   removes it.
2. **Adding the fourth row fixes the stranding and NOT the height.** Chrome above the graph
   measures **662 px** (48 toggle + 243 receipt + 370 card). Swept live on the page:

   | column height | graph gets | |
   |---|---|---|
   | 620 px | 25 px | unusable |
   | 700 px | 25 px | unusable |
   | 760 px | 46 px | a sliver |
   | 820 px | 106 px | a sliver |
   | 900 px | 186 px | workable |

   **At laptop size a stacked second card does not shrink the canvas — it removes it until you
   scroll**, on the screen whose whole job is showing the workflow that was just built.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 172 | where-the-five-decisions-live | Should the decisions surface OWN controls for the five decisions, or POINT at the ones that already ship — given that three of the five already have a control on the drafted view? | *(open)* | phase-197, auth-02, guided-authoring, decisions-surface, seed-163, generated-from-build, g2-sketch-gate, d-02, d-07 |
| 173 | one-row-five-ways | What does ONE row look like — ask-first, quiet-when-answered, or answer-first — across all five D-07 rows and every state each can actually be in? | *(open)* | phase-197, auth-02, row-anatomy, d-07, d-09, d-16, g2-sketch-gate, drawing-not-render |

### Sketch 174 was PROPOSED and FOLDED, deliberately

*"What dismissal costs"* — D-04 makes the card dismissible; if it is the only home for a row,
dismissal deletes the control. It is a real question and it is **downstream of 172**: on variant C
the card owns no control, so dismissal costs nothing and the question dissolves. It survives as a
**named cost of variants A and B** on 172's page rather than as its own sketch. **Re-open trigger:**
172 lands on A or B.

### Method note — 172 RENDERS, 173 DRAWS, and the difference is stated on both pages

172 keeps the 164–167 inverted arrow (`SEED-155`: *if it depicts a surface consuming an existing
component, it must RENDER it, not redraw it*). Its header, receipt and grid classes are the **real
rendered DOM**; only the decisions card is hand-composed, and every one of its nodes carries
`data-s172="NEW"`. **173 is a drawing** — the card exists in no component — and says so at the top;
what keeps it honest is that every sentence the product owns is parsed out of 172's dump and row 3
wears the **shipped** `AI-proposed` markup lifted whole.

Builds assert **41** (172) and **25** (173) structural properties and exit non-zero otherwise.

⚠ **Two silent build bugs were caught by those assertions rather than shipping**, both recorded
because both were the invisible kind: a regex extractor stopped one nesting level early on
`builder-business-requirement` (three nested spans) and matched the wrong close tag on
`builder-view-toggle` (which closes on a button, not a div). A splice into a missing anchor fails
silently and yields a variant that quietly equals the baseline — the exact green-looking-nothing
failure the audit exists to prevent.

⚠ **And a THIRD: 172's emitter first wrote its dump OUTSIDE the repository.** It lives in
`frontend/src/pages/`, three levels below the root; 165's lived one directory deeper, and its
`../../../../` was copied verbatim. The vitest run passed and reported success either way — a
green test that wrote nothing where anyone would look for it.

### ⚠ A CORRECTION THIS SESSION CARRIES UPSTREAM

`197-CONTEXT.md`'s deferred section lists **BUG-260809-02** as *"(blocking) — a canvas-built
workflow can never be published … NOT closed by this phase."* Its frontmatter reads
`status: closed`, `folded_into: quick-260809-klo`,
`verified_closed_by: live-uat-2026-08-10-local-chrome-devtools-mcp`. **That quick task is what
shipped the very requirement input these sketches render** — so D-06's recorded consequence does
not exist, and the control it shipped is half of why variant A installs a second home. Absorbed
here at the operator's direction rather than re-opening discuss-phase.

### ⚠ What these two pages deliberately do NOT settle

1. **The server-derived readiness verdict (D-13).** No row shows a per-row verdict, because the
   field does not exist yet and inventing its rendering would be the client-side derivation D-13
   explicitly refuses.
2. **Whether row 4 gets a home.** 172-C is only complete if this phase also gives the name one.
   That is a scope decision, not something a chosen variant may smuggle in.
3. **Whether row 5 becomes answerable at all.** Larger than the other four; all three 173 variants
   give it a stated fact instead of a control.
4. **Hover, focus rings, pixel spacing** — a human comparison at UAT, driven by looking.

### ⚠ SKETCH 174 ADDED THE SAME DAY — and the operator's critique that caused it

172 and 173 are **analysis pages**: tables, provenance contracts, measurement readouts, three
stages per tab. The operator's response was that they *"included a lot of information"* and did
not *"represent what the thing looks like"* — a request for **the user-friendly version, with the
control that does not break the workflow.**

That is a fair read and it is recorded rather than argued with. **A sketch whose job is to let
someone judge a screen has failed if the screen is the smallest thing on the page.** 172/173 keep
their job — they are where the reasoning is checkable — and **174 is the picture**: three tabs, one
caption each, no tables, and a real 780 px screen.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 174 | the-line-that-opens | What does the decisions surface actually LOOK like — and which shape leaves the workflow visible? | *(open — the recommendation)* | phase-197, auth-02, decisions-surface, recommendation, user-facing-mockup, g2-sketch-gate |

### Post-197 — the workflow journey (SEED-182 / 183 / 184)

The operator's review after Phase 197 shipped. Three seeds, ONE journey — sketched together so the composing
state and the persistent decisions panel are drawn in a settled density language instead of being redrawn after
it settles. Build order chosen by the operator: **density first**.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 175 | what-the-eye-lands-on | What is the density language for the workflow library — what does a card lead with, what defers behind a click, and what does colour carry? | **B — the colourful card.** CALM is the direction; **A REJECTED as too dense**. ⚠ Colour SEMANTICS re-opened: the operator wants lifecycle + belonging, not governance tier → 176 | seed-184, density, progressive-disclosure, library, workflow-card, colour, icons, g2-sketch-gate, measured-refutation |
| 176 | the-workflows-home | What does the Workflows home page look like when it is CALM — and what should colour actually encode, when the operator cannot tell built from draft from starter from someone else's? (folds BUG-260815-08: header alignment, the uncoloured create button, the search box that does not read as one) | *(open — awaiting operator)* | seed-184, seed-155, bug-260815-08, workflows-home, colour-semantics, lifecycle, calm, header-alignment, g2-sketch-gate |
| 177 | stitch-regeneration | What does the whole workflow surface look like when a generative design tool (Google Stitch) is given our tokens, our direction, and the three measurements that have already killed ideas? | *(direction only — NOT an acceptance bar; operator ADOPTED the language)* | stitch, mcp, direction-only, calm, seed-155, seed-182, seed-183, seed-184 |
| 178 | stitch-component-map | If the Stitch mindset is the house style, what does EVERY component look like in it — the atoms, not the pages, including the canvas? | *(direction only — 11 sheets; canvas + builder chrome re-run with business language)* | stitch, component-map, canvas, connections, business-language, adopted-mindset |
| 179 | what-the-eye-lands-on-honestly | With 41 distinct workflows sharing ONE name, and only the fields the library actually carries, what should the card lead with? ⚠ **RENDERS the real WorkflowCard** — step 3 of the Stitch→sketch loop | **C — the triage board.** Outcome to a 3px gutter, name KEEPS the lead (partially refuting 177/178's "state first"), run+state on one quiet line, ~7 of 9 information rows CUT. ⚠ Needs one owed field (`last_run`, a join not a migration); G-5 on WorkflowCard still undischarged | library-card, renders-real-components, seed-155, g5-refactor-owed, business-vocabulary, last-run, measured-refutation |

**The recommended shape:** the draft lands as it does today; under the receipt sits **one line** —
*"I made 5 decisions for you"* — that opens on demand, and each row hands you to the control already
on screen. Closed on arrival, so the D-05 fast door is untouched; owns no control, so nothing drifts;
**and the workflow stays visible.**

Measured on 174's own page, in a 780 px screen:

| state | decisions element | graph gets |
|---|---|---|
| just landed (one line) | **41 px** | **363 px** |
| opened | 237 px | 167 px |
| a full always-open card | 276 px | **128 px** |

⚠ **This is also the answer to 172's own measurement.** All three of 172's variants stack a ~370 px
card above the graph, so **all three pay the 25 px-at-700 px cost** — the shape that does not is the
one that is closed until asked. 174 is therefore not a fourth peer of A/B/C; it is **172-C plus
collapsed-by-default**, and if 172-C wins, this is what it should be built as.

Everything on 174 except the decisions line is the **real rendered DOM** — header, receipt, view
toggle and the whole 5-step spine graph — so it looks like the product rather than like a drawing.
14 assertions, 0 failing.

### ⚠ 174 WAS REBUILT THE SAME HOUR — the operator caught the real defect

The first cut of 174 drew **two cards**: the shipped receipt (*"Here's what I built — 5 steps"*)
and a new one (*"I made 5 decisions for you"*), with the second collapsed to one line. The
operator's response, recorded verbatim because it is the correct reading and the sketch had missed
it:

> *"you produce two cards … this means the spine [gets] a limited area … the area is very tight,
> with exception of the one version where I can collapse … we always have to think about not
> over-complicating the information … information should not be dense but be enough for the user to
> know what is happening."*

**Both cards say the same kind of thing — here is what the AI just did.** Splitting one thought
across two frames spends the graph's space on chrome, and collapsing the second one only hides that.
Collapsing was treating a symptom.

**The shape is now ONE card**: the receipt's own heading, two openable lines, the receipt's own
closing sentence.

```
Here's what I built — 5 steps                                    ✕
  ▸ 3 steps must prove their sources                          why
  ▸ 5 decisions I made for you                             review
Everything else is yours to change. Nothing is saved or published yet.
```

Measured on 174's own page, in a 780 px screen:

| | arrival chrome | the workflow gets |
|---|---|---|
| **one card, just landed** | **149 px** | **507 px — 65%** |
| one card, decisions opened | 334 px | 321 px — 41% |
| two cards, just landed | 284 px | 363 px — 47% |
| two cards, opened | 478 px | 169 px — **22%** |

**Merging halves the arrival chrome and hands the workflow 65% of the screen instead of 47%.**

### ⚠ ONE CARD IS A COMPOSITION CHANGE, NOT A CHARTER CHANGE — D-02 SURVIVES INTACT

This is the distinction a plan must not blur. `197-CONTEXT.md` D-02 refuses to widen `SeedReceipt`,
and correctly — its docblock is fenced (*"authors no sentence of its own"*, *"declares no predicate
of its own"*, *"imports nothing from the API client"*), and widening its charter costs exactly the
guarantees that make it checkable.

**Nothing in this shape widens it.** `SeedReceipt` stays the leaf it is; a **PARENT** composes its
output and the decisions list into one visual card. **One card in the UI, two components
underneath** — which is what D-02 asked for and what the operator asked for, at the same time.

### The standing principle this session added

> *"Information should not be dense, but enough for the user to know what is happening and how to
> think."*

Applied here as: **the collapsed state still states both facts** (`3 steps must prove their
sources`, `5 decisions I made for you`) rather than hiding behind a bare *"details"* — a count and a
fact per line, never a wall, and never a mystery either. Carry it into 197's copy review.

⚠ **A method note for future sketches.** 172 and 173 are correct and are where the reasoning is
checkable — but **a sketch whose job is to let someone judge a screen has failed if the screen is
the smallest thing on the page.** 174 exists because that was true of both. Keep the analysis page,
but ship a picture beside it.

### ⚠ ALL THREE PAGES RENDERED IN LIGHT MODE, AND EVERY MEASUREMENT PASSED ANYWAY

Found 2026-08-18 by taking a screenshot, after the operator said the states *"look the same"*. Two
defects, neither visible to a geometry assertion, both now fixed and both asserted:

1. **The Deep Midnight theme was purged.** The tokens live in a base-layer `.dark` rule, and
   Tailwind drops it unless the literal string `dark` appears in a **scanned** file. The only
   scanned file is `body.generated.html`; the `class="dark"` on `<html>`/`<body>` lives in
   `assemble.cjs`, which Tailwind never reads. **So every sketch page in this session was showing a
   white mockup of a dark product** — which is very plausibly the whole of *"they look the same"*,
   since a washed-out page flattens every distinction the variants were drawn to show.
   **Fix:** the token now sits on the page root in all three builds, commented as load-bearing.
   ⚠ **Check this on the next sketch** — it looks exactly like decoration and will be deleted by
   someone tidying up.
2. **The header contradicted the card.** React sets a `<select>`'s value as a DOM **property**, so
   serialising the real header loses the selection: the picker re-rendered as *"No knowledge base ·
   searches everything"* while the card beside it read *"Vendor contracts"*. One screen, two
   answers to one question — on the sketches whose entire subject is that a decision has exactly
   one answer. **Fix:** the bound option is marked `selected`, asserted in both directions.

**The method lesson, and it is the one worth keeping.** 172 and 173 shipped with 41 and 25 green
structural assertions, and 174 measured pixel heights on four screens. **Not one of them could see
that the pages did not look like the product.** Geometry proves composition; only looking proves
appearance. Take a screenshot before handing a sketch to an operator — this session's own record is
that the operator's eye caught, in one sentence, what three instrumented builds could not.

### ⚠ AND THE FIXED SCREENS SURFACED A FACT ABOUT THE SHIPPED RECEIPT

With the theme correct, 174's tab 3 makes it plain: **today's `SeedReceipt` is always fully open.**
It renders both grounding paragraphs and every sealed-step row unconditionally, on every draft.

So the one-card shape is not merely a merge — **it makes that content foldable, which it is not
today**, and tab 3 versus tab 1 is an honest before/after of the CURRENT screen rather than a
comparison of two proposals. Carry into planning: the fold improves the arrival moment even setting
the five decisions aside.

### Phase 200.1 session — the run surface's centre column (2026-08-21)

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 201 | what-the-run-column-says | The centre column duplicates the right panel character-for-character. If it stops being a second list, what is it instead — and what fills its top slot when the run produced nothing? | **hero+ledger — the adaptive hero (A/B/D are its states); C ruled out** ★ | run-surface, seed-191, stitch-derived, empty-state |
| 202 | the-run-column-rendered | The Stitch reference draws a hero + a card-stack "process trace". How much of it survives contact with the data we actually hold — and does the centre column stop reading as a second copy of the right panel? | **C — strict single line** ★ — ⚠ **C makes D-05 load-bearing: with the count still on the spine the centre is a strict subset of it.** Plus 4 findings, incl. the shipped answer rule picking a 61-char status line over a 6,133-char narrative | run-surface, renders-real-components, stitch-derived, seed-155, seed-191, acceptance-bar, phase-200.2 |

⚠ **A LANGUAGE sketch, not the acceptance bar** — it does not render `RunTranscript` /
`WorkflowRunPage`. A rendered sketch is owed before planning (`SEED-155`).

⚠ **The operator's question reshaped the decision and is recorded in the README:** *"if I selected B,
what happens if the workflow does not produce the file?"* — **A and B are not rival designs**, they
are ONE hero slot filled by whatever the run made, and the four arms already ship (`200.1-02`). The
real choice is **hero + ledger** vs **C, one spine**, and tab **D** (the *neither* arm) is the
tie-breaker: a hero slot that looks wrong when empty argues for C, which has no slot to leave empty.

✅ **DECIDED 2026-08-21.** The operator declined to pick A or B: *"I want the render to be based on the
workflow type and the workflow scenario."* That IS the hero+ledger family — one slot the RUN fills by
deliverable type (file / answer / both / neither). **C is ruled out**: it has no hero slot, so nothing
for the type to change. ⚠ The hero fixes what the column LEADS WITH; it does not by itself end the
step-name duplication — the per-step **yields** are the proposal for that, and the rendered sketch
must settle whether they earn it.

### Phase 214 session — a step names its service and its action (2026-08-28)

**Step 4 of the ratified method.** Step 1 (direction) is
`214-stitch-step-names-service-and-action/` — eleven Stitch screens, four surfaces, base + two
variants each. ⚠ **The two are never collapsed** (`SEED-155`): Stitch renders zero shipped
components, and these four re-express the chosen direction against real ones. The stitch README's
*"What the sketch must now settle"* list IS this decomposition.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 214 | argument-form-and-its-source | How does a step's argument declare where its value comes from — and does the shipped 400px panel survive a field-per-argument form? | *pending* — A 400px rail · B wide + source gutter · C wide + inline source | phase-214, step-01, step-02, arguments, panel-width, acceptance-bar |
| 215 | publish-refuses-by-name | When publish refuses a step nothing can supply, what does it say — and what must it never say? | *pending* — A considered review · B refused on the canvas | phase-214, step-03, publish, refusal, gauntlet, acceptance-bar |
| 216 | the-mark-and-the-action-everywhere | Does one shared step-identity element survive five run surfaces at four sizes — and does the approval pause show what actually leaves? | *pending* — A rich · B spare (⚠ B fails SC#4 by construction; it is the counter-example) | phase-214, step-04, step-05, seed-206, approval-pause, acceptance-bar |
| 217 | the-door-that-knows-your-services | How does the describe door refuse a service the author named but never connected — and does the refusal point at the words that caused it? | *pending* — A picker first · B picker first + the anchor | phase-214, step-06, seed-208, describe-door, acceptance-bar |

**All four are executable acceptance bars**, on the 213 pattern: `COPY.js` (the vocabulary that
ports) + `index.html` + `drive.cjs` (the contract, executable) + a generated
`BUILD-CONTRACT.generated.md`. **587 assertions across the four (141 · 129 · 138 · 179), 0 failing.**

⭐ **What the sketches found that Stitch structurally could not.** Stitch drew `Cc` and `Reply to`
rows for `send_email`. `smtp_adapter.INPUT_SCHEMA` declares **exactly three** properties under
`additionalProperties: False`, and the adapter **raises on any undeclared key** — so a `cc` field
would specify a form the backend refuses on every submission, while typechecking, rendering and
passing every frontend test. That is the whole argument for step 4 existing.

⚠ **One fork is deliberately left open for the operator: the panel track.** Sketch 214 §4 draws
`400px` (shipped, `WorkflowBuilderPage.tsx:2817`) and `clamp(480px, 38%, 640px)` (Settings' track
since 213) over byte-identical content. **The consequence is conditional** — 400px drops the source
gutter and makes variant C the shape; the clamp ships variant B and changes a pinned assertion in
the same commit.

### SEED-224 session — the document space becomes the Library (2026-08-28)

**Step 1 (direction)** is `STITCH-BRIEF-218-the-document-space.md` + the durable pixels under
`218-the-library-and-its-tabs/stitch/`. **Step 3 (the bar)** is sketch 218. ⚠ Never collapsed.

Operator direction, in two parts: follow the reference redesign closely — *"I like the journey, the
charts, the simplicity, not many text pollution"* — but **"abide to our theme: not the colors, the
content, the types of charts, the journey, the functionality."** So the reference supplies the
journey and the chart vocabulary; every colour, radius and spacing value is a shipped token.

Two operator decisions were taken mid-pass and are recorded in the brief: **Library Health MERGES
into this surface (D-1)** and **the surface is renamed `Library` (D-2, front-end only)**.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 218 | the-library-and-its-tabs | What is the Library's tab set, and which of the reference's surfaces can this app draw honestly? | **A · five tabs** (operator, 2026-08-28) | seed-224, bus-026, library-health, charts, acceptance-bar |

**124 assertions, 0 failing — and 31+ of them read the LIVE SOURCE TREE**, not the sketch. Three were
driven RED against planted defects and the file restored md5-identical.

⭐ **What the sketch found that the Stitch pass structurally could not.** The shipped `Tabs` primitive
puts the active trigger on `bg-background` over a `bg-muted` track — which is **lighter in light mode
and DARKER on Deep Midnight (11% L → 4% L)**. Every reference image drew a lighter raised chip: a
shape the shipped component cannot produce. Its only second cue is `shadow-sm`, invisible at 4%
lightness. Second finding: the ingestion pipeline writes **six** stages, not the three the seed
assumes, and two are conditional — so a fixed 3-segment bar draws a shape the pipeline never has.

⚠ **And one finding in the drive script itself:** its SURFACE stripper consumed one closing tag too
many and silently ate the second tab-bar arm — the remedy the sketch exists to propose — while still
reading 70/70 green. **A stripper bug looks exactly like a passing suite.**

**Second pass, same day — two operator observations, both measured true.** *"I did not see where I
can upload documents"*: upload is a small button in a folder header's top-right corner, so the sketch
gained an **upload** tab drawing it as the front door, with the reference's screen-07 stage-card row
(an honest aggregate) above the queue. *"We have a lot of things that we can show but it is hidden
and buried"*: **six columns are written for every document and reach no screen** — the parsed
markdown of every file has ZERO non-test frontend references, and extracted tables and image
descriptions are stored in full but rendered as a count. **None of it needs a migration.**

⚠ **A third finding is in the drive script itself, again.** The fence proving the buried-column claim
first shelled out to `grep -rl`, which failed on this box and returned an empty list — so it **passed
vacuously, manufacturing the finding it was meant to verify**. It now walks the tree in JS behind two
positive controls. Final: **124 assertions, 0 failing**, five driven RED against planted defects with
the file restored md5-identical each time.

### Phase 224 session — where a panel-owned step belongs (2026-09-02)

Phase 224's structural question, drawn with the strings that ship today. The measured `Today` view is
the sketch's spine: the run header counts **3 steps** while the rail enumerates **2**, the third being
a card *outside* the frame; that card's title is the raw tool name uppercased by CSS; and the status
sentence wears a `<Square>` that reads as an unticked box **because `☑` sits directly above it**.

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 223 | the-step-inside-the-run | A `write_todos` card is panel-owned, so it renders as a sibling beneath the run that counts it. Does it belong inside the run frame — and if so, as what? | **D · delete it** (operator, 2026-09-02) | phase-224, seed-240, seed-128, bug-260902-07, chat-surface, seam-card, acceptance-bar |

⭐ **The composition fault is a guardrail's residue.** `MessageItem.tsx:841` says in writing: *"ADDITIVE
ONLY — a new sibling renderer in MessageItem, never a touch of RunCard internals (G-5)."* The orphan
below the run was placed there deliberately, to protect a hot file.

⭐ **D is deletion, and the premise for keeping the card is measurably FALSE.** `SeamCard.tsx:3-8`
justifies itself with *"the panel reconciles to current state and does NOT replay history, so the
transcript must be self-contained."* But `StreamsProvider.tsx:106` says `useDerivedPanel` is *"a PURE
read over the viewing thread's persisted chat `tool_calls`"* and `workspacePanel.ts:204` takes the
latest `write_todos` snapshot from exactly those — **both surfaces read the same durable rows.** The
card is a second render of one source, not a backup for a source that disappears.
**`workspace_write` is redundant by a stronger argument still:** `FilesSection.tsx:158` *fetches from
the server*. ⚠ **`ask_user` must survive the delete** — `You answered X` is the only record a human
decided anything, and the panel shows a *pending* question, never an answered one.

The operator was finishing a job this repo started: `MessageItem.tsx:536` deleted the **live** pointers
at SEED-098 for the identical reason. Only the reload card survived, because nobody re-checked its
premise.

⭐ **A Stitch pass contributed two ideas the sketch missed, and then settled the field.** Project
`10591382119939539231`; screenshot kept beside the sketch. It put the status line **inside** the run
frame rather than beneath it, and gave each step's result its **own right-aligned column**. Folding
both in revealed the decider: **variant C can adopt NEITHER**, because both live inside `RunCard`,
which C exists to leave alone. *The variant that avoided the G-5 obligation is the one that cannot have
the better design.* ⚠ Stitch's own palette drifted (olive checks, indigo nearly absent) and its
References pill still has the affordance problem `BUG-260902-07` exists to fix — the recorded rule that
**rules belong in `designMd`, not the prompts** was skipped here, and it showed exactly where it said it
would.

⚠ **Two `generate_screen_from_text` calls timed out at the tool boundary.** The first produced nothing
across five polls over seven minutes; the second completed server-side ~2 min after timing out. **A
timeout here means *unknown*, not *failed*.**

**New bug filed from this session — `BUG-260902-07`.** The References footer opens by default whenever
an answer carries inline markers (`MessageItem.tsx:619`), which for a grounded answer is *every time*,
so the collapsed state is only ever seen on the degraded path; and its trigger (`CitationList.tsx:32-44`)
is `text-xs text-muted-foreground` with a 12px chevron — no border, no surface, no separation from body
copy. ⚠ **The two halves ship together or not at all:** while it is open by default the weak trigger is
invisible, because nobody hunts for a control they never need. ⚠ This **reverses Phase 153's
D-06/D-07 open-by-default contract** — recorded as a conscious reversal so a later phase does not
"restore" it believing it was an oversight.

Fenced per variant rather than per file: `a`/`b`/`d` carry the in-frame status, `c` keeps the external
one, `today` is byte-identical to the measured original, the inline-arrow override covers exactly
`today`+`c`, every `onclick` resolves to a defined function, every `getElementById` target exists, 16
grounded source strings are present — with a negative control proving the fence can fail.
