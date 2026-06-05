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
