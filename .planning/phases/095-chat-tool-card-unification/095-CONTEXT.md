# Phase 095: Chat Tool-Card Unification - Context

**Gathered:** 2026-06-05
**Status:** Ready for sketch (G-2), then planning

> **Scope was already de-collided upstream.** Phase 094's **D-01** narrowed the earlier
> "move Deep's tool-cards into the panel" idea (D-094-UNIFY) — operator quote 2026-06-04:
> *"why do we need to move the tool card out of the chat area? it should be only unification
> and cleaning."* So Deep's `RunCard`/`ToolCallPanel` **stay in the chat**, and 094 deliberately
> left the three chat-card bugs to **Phase 095**. This discussion does NOT re-open that — 095 is
> the literal CHAT-04 framing: **fix-and-unify the chat tool-cards in place.**

<domain>
## Phase Boundary

Make the chat tool-call surface (Deep mode) render in **one consistent, calm frame** with
details-on-demand, follow-the-work auto-scroll, no duplicate cards, a timer/step count that stays
honest on long runs, and a generated-file area that always downloads and heroes the file the user
asked for — closing the felt-experience defects rooted in `RunCard` / `ToolCallPanel` /
`MessageItem` / `StreamsProvider`.

**In scope:**
- One shared visual frame + behavior for EVERY chat tool card (search, read, execute_code,
  sub-agents like read/summarize, web_search) — resting state folds to a one-line essence, expands
  on demand (D-01).
- **Focus Mode** during live runs — active step open/live, finished steps auto-fold (D-02).
- **Smart auto-scroll** — follow the live edge, release on manual scroll-up, re-arm at bottom,
  "Jump to live" affordance (D-03).
- **Step semantic unified** — one visible action = one step; identical number in the timer strip
  and the panel (D-04).
- **Zero-duplicate root fix** — one stable card identity from first frame; cross-provider; covers
  the read/summarize sub-agent path (D-05).
- **Persistent run-status strip** — time + step + activity, survives long runs / dropped events /
  background-tab throttling / remounts until terminal (D-06).
- **Output files: re-rank, don't hide + hero the intended output** — show all generated files, all
  reliably downloadable, the agent-flagged final deliverable is the hero, intermediates are
  secondary (D-07). Carries the **one small, contained backend touch** this implies (D-08).

**Out of scope (see `<deferred>`):** relocating Deep tool-cards into the panel (dropped at 094
D-01); the Harness phase-timeline (shipped in 094); per-phase tool/search COUNT chips threaded from
the sub-agent stream (SEED-053); generated-files-rendered-in-the-PANEL (SEED-037/038 — 095 is the
CHAT side only); the composer 2-pill redesign + Workflows page (v2.9 / SEED-051); the orphaned
ask_user 404 bug (HITL/panel/backend — routed OUT, see `<deferred>`).
</domain>

<decisions>
## Implementation Decisions

### Tool-card frame & behavior
- **D-01 — Resting state = one-line essence, one consistent frame.** A finished tool card folds to
  a single calm line (icon + tool + key result, e.g. `🔍 Searched "2024 sales" → 8 results`,
  `🐍 Ran code → chart.png`), expand-on-click for full detail. The SAME outer frame + inner-body
  pattern applies to every tool type — no per-tool ad-hoc layouts. Direction = the
  `sketch-findings-agentic-rag` **Focus Mode** ("past steps fold to essence"); Claude.ai /
  Cursor feel. Details are **re-ranked, never hidden** — the user can always expand to full
  output/args/source.
- **D-02 — Focus Mode during a live run.** Only the step running RIGHT NOW is expanded and shows
  live output; as each step finishes it auto-folds to its D-01 summary and the next step opens. The
  user always sees "what's happening now" without scrolling past completed work.
- **D-03 — Smart auto-scroll (follow-but-release).** While the user is at/near the bottom, the chat
  sticks to the newest content during streaming. The moment they scroll UP, auto-follow stops and
  leaves them in place; it re-arms when they return to the bottom. A "↓ Jump to live" affordance
  appears whenever they've scrolled away. (Standard ChatGPT/Claude.ai scroll discipline.) This is
  BUG-260529-02 item #1.

### Counters & reliability
- **D-04 — One visible action = one step.** "Step N" = the number of tool cards on screen. The
  timer strip and the panel header read the SAME source so they can never disagree (closes
  BUG-260528-02). Note for the planner: today the RunCard counts `iteration_start` events while the
  panel counts tool starts — unify both onto the action/tool-card count.
- **D-05 — Zero duplicates, ever (root fix, cross-provider).** Each card gets ONE stable identity
  from its first streamed event — no transient double-render, no "self-heals in 10–15s" reliance.
  Must hold across all 6 native providers and specifically fix the read/summarize sub-agent
  double-render (BUG-260529-02 item #3), which may be a distinct root from the 075.2 transient
  id-instability flicker (BUG-260521-01) — research confirms whether it's the same `tool_call_id`
  instability on the sub-agent path or a separate double-render.
- **D-06 — Persistent run-status strip = time + step + activity.** A single honest strip
  (`⏱ 3m12s · Step 5 · Running code…`) that stays visible from kickoff until the run TRULY ends.
  Make elapsed derive from a stable start timestamp and render continuously — immune to dropped SSE
  events, background-tab `setInterval` throttling, and temp-id→DB-id remounts. Cross-provider
  (closes BUG-260528-01; do not regress the 083 temp-id-remount fix that closed BUG-260526-04).

### Output files
- **D-07 — Re-rank, don't hide + hero the intended output.** Operator framing (verbatim intent):
  *"show all files that all agents generated… if the user asked for docx, show clearly the final
  completed output the user asked for; if multiple files, show those. Nothing wrong with showing
  all files and making them always work, but the focus should be on the final intended output to
  make it easier for the user."* So:
  - Show ALL generated files; every one is reliably downloadable (no dead links).
  - The **final intended output(s)** are the hero ("Your file" / clearly emphasized); intermediate/
    working files are present but secondary ("Working files", quieter).
  - **The agent marks which file(s) are the final deliverable** (it knows the request intent) — a
    small backend signal flags the final output so the frontend can hero it. (Supersedes the old
    "download list is a pile of intermediates" complaint, BUG-260514-01, with re-rank instead of
    hide.)
- **D-08 — 095 carries one small, contained backend touch (narrows the original SC#4).** Because of
  D-07, 095 is NOT strictly frontend-only. Permitted backend work: (a) the agent tagging its final
  output file(s) in the final-outputs event/payload; (b) refreshing/re-signing a download link IF
  research proves the dead-link root is server-side signed-URL expiry. **Constraint:** the touch
  must stay contained and MUST NOT regress the panel's PANEL-06 isolation or the StreamsProvider
  per-thread demux. **Investigate-first:** confirm the exact dead-link root cause (live app +
  backend logs + the signed-URL TTL) before changing backend code — do not assume.

### Claude's Discretion
- Component file layout, hook shape, the exact stable-key scheme for D-05, the precise elapsed-time
  derivation for D-06, and how the "hero vs working files" split renders are the
  researcher/planner/executor's call within these decisions.
- The icon/copy per tool type for the D-01 essence line (reuse existing tool icons/labels).
</decisions>

<uat>
## Lived-Experience UAT — must pass before "done" (G-4 + SC#10 4-axis)

Operator-defined at scope time (all four selected). These cover SC#10's bandwidth
(cross-provider × multi-tool × parallel-thread × long-run/long-message):

1. **Long run stays honest** — a long multi-step job (e.g. a Kimi/Moonshot ~11-step PPTX build):
   the timer NEVER disappears, the step count matches the cards on screen, the read/summarize cards
   never double. *(long-run + D-06 + D-04 + D-05)*
2. **Multi-tool stays calm** — a prompt that triggers `search_documents` AND `execute_code` in one
   run: every card shares the one frame, finished steps fold to one line, the active step is open
   and followed by auto-scroll, the chat stays readable. *(multi-tool + D-01/D-02/D-03)*
3. **Hero file downloads** — ask for a specific deliverable (e.g. `.docx`): on completion the
   finished doc is clearly the hero and downloads in one click; reopen that same chat the next day
   and the download STILL works. *(D-07/D-08)*
4. **Two threads at once + cross-provider parity** — Thread A mid-run streaming while Thread B
   accepts a new prompt; A keeps its timer/cards correct, B works normally, no cross-bleed; AND the
   unified frame behaves identically across all 6 native providers. *(parallel-thread + cross-provider)*

Chrome-DevTools MCP drives all four live (G-4: wire format + screenshot are insufficient). Long-run
(#1) is exercised per representative provider; #4 covers the cross-provider sweep.
</uat>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before sketching, planning, or implementing.**

### Scope & upstream decisions (read FIRST)
- `.planning/phases/094-workflow-legibility-mode-clarity/094-CONTEXT.md` §D-01 — the upstream
  decision that keeps Deep tool-cards in the chat and hands these three bugs to 095. **Binding.**
- `.planning/ROADMAP.md` (Phase 095 block, ~L195–206) — Goal, CHAT-04, the 4 Success Criteria
  (note SC#4 "frontend-only" is **narrowed by D-08**), G-2 sketch-first note, hot-file confirm note.
- `CLAUDE.md` → "UAT scoreboard recipe (MANDATORY)" (SC#10 4-axis) + "Workflow guardrails" (G-2
  fires; G-5 hot-file ledger — ToolCallPanel/MessageItem/StreamsProvider show **satisfied at 075.7**,
  re-confirmed: 094 did not touch them, so 095 is the first feature touch since the refactor → G-5
  does not fire).

### Design direction (read before `/gsd:sketch 095`)
- `Skill("sketch-findings-agentic-rag")` — **Focus Mode** (past steps fold to essence; one outer
  frame, per-tool inner body), run-card frame, tool-call panel shape, chat↔panel seam. 095's frame
  must reuse this direction, not start from scratch.

### Bugs this phase owns / relates to
- `.planning/reported-bugs/chat-tool-cards-scroll-collapse-duplicate.md` (BUG-260529-02, **major**)
  — the core bug: auto-scroll (#1, D-03), expanded-by-default (#2, D-01/D-02), read/summarize
  duplication (#3, D-05). **Folded → 095.**
- `.planning/reported-bugs/timer-disappears-long-runs.md` (BUG-260528-01) — D-06. **Folded → 095.**
- `.planning/reported-bugs/step-count-mismatch-timer-vs-panel.md` (BUG-260528-02) — D-04.
  **Folded → 095.**
- `.planning/reported-bugs/toolcallpanel-dedup-duplicates-tool-card.md` (BUG-260521-01, folded
  075.2) — transient dedup precedent; D-05 must subsume it (no regression, and reach the
  persistent-feeling read/summarize case).
- `.planning/reported-bugs/tool-output-download-bloat-intermediate-artifacts.md` (BUG-260514-01,
  folded 075.1) — superseded by D-07 (re-rank instead of hide). Confirm no regression.

### Code anchors (FILES confirmed; line numbers UNVERIFIED — researcher must confirm exact sites)
> A scouting pass produced candidate line numbers but via an unverified path — treat the FILES as
> the surface, re-derive line anchors during research.
- `frontend/src/components/chat/ToolCallPanel.tsx` — the per-tool card render; collapse/expand
  state; dedup keying (D-01, D-02, D-05). **G-5 hot file.**
- `frontend/src/components/chat/MessageItem.tsx` — mounts the run/tool panel + the final-outputs
  area (D-01, D-07). **G-5 hot file.**
- `frontend/src/providers/StreamsProvider.tsx` — SSE→state reducer; stable card identity / dedup
  root; iteration vs tool-start counting; finalOutputFiles stamping (D-04, D-05, D-06, D-07).
  **G-5 hot file.**
- `frontend/src/components/chat/RunCard.tsx` — run header timer + step label (D-04, D-06).
- `frontend/src/components/chat/MessageList.tsx` — chat scroll container (D-03).
- `frontend/src/components/chat/OutputFileCard.tsx` — generated-file render + download URL
  resolution (D-07, D-08).
- `frontend/src/lib/api.ts` — SSE event dispatch (`tool_preparing`/`tool_args_progress`/
  `tool_start`/`tool_end`/`iteration_start`/`sub_agent_*`/`final_output_files`/`done`) — the event
  vocabulary the unification rides on.
- **Backend (D-08, only if research confirms):** the final-output-files event emit + file-signing
  site (candidates: `backend/app/services/sandbox_service.py`, `backend/app/api/threads.py`,
  `backend/app/services/agent_loop.py`) — for the agent-marks-final-output tag and/or link refresh.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets / current state (from scouting — verify in research)
- Tool cards currently render ONLY in the chat (via `ToolCallPanel` inside `MessageItem`/`RunCard`);
  094 added the Harness `PhaseTimeline` to the panel but did NOT move or touch the chat cards — so
  095 works on a clean, untouched surface (the G-5 reason 094 deferred it).
- A dedup keying scheme already exists in `ToolCallPanel` (clientKey ?? id ?? composite fallback);
  D-05 hardens it at the StreamsProvider source rather than patching the fallback.
- A per-tool/run timer already exists (`RunCard` + an interval-based elapsed timer); D-06 makes its
  lifetime/derivation robust rather than rebuilding it.
- `OutputFileCard` already resolves a download URL (relative → `API_BASE`); D-07/D-08 add the
  hero/working split + the always-works guarantee.

### Established patterns to honor
- **Cross-provider uniform UX** — one shared SSE event vocabulary; UI stays provider-agnostic; any
  provider-specific handling stays at the service boundary, never on the shared chat render path
  (CLAUDE.md provider-uniform-ux; feedback memory).
- **Additive / no shared-path regressions** — D-05/D-06 changes in StreamsProvider must not break
  the Deep tool path for working providers; verify the parallel-thread per-thread demux + PANEL-06
  isolation hold.

### Integration points
- StreamsProvider reducer (stable keys, counters, finalOutputFiles); ToolCallPanel + a shared frame
  component; MessageList scroll controller; RunCard status strip; OutputFileCard hero/working split;
  api.ts dispatch; one contained backend final-output tag (D-08).
</code_context>

<specifics>
## Specific Ideas
- Resting essence-line examples the operator will recognize: `🔍 Searched "X" → 8 results`,
  `📄 Read thesis.pdf → 3 sections`, `🐍 Ran code → chart.png`.
- Status strip exemplar: `⏱ 3m12s · Step 5 · Running code…` (Step uses the D-04 action count).
- Output-file framing exemplar: a "Your file" hero block (the agent-flagged `.docx`/`.pptx` the user
  asked for) above a collapsed "Working files (N)" list — all downloadable.
- Operator's reliability stance (memory): silent failures / dead links are first-class value bugs;
  "zero duplicates ever" is a standing bar (set at 075.2). Build to those bars.
</specifics>

<deferred>
## Deferred Ideas
- **Orphaned ask_user prompt 404s silently** (`orphaned-askuser-prompt-failed-run-404-silent.md`,
  BUG-260605-01, **major, OPEN**) — a recent note tagged it "route 095", but its surface is the
  side-panel pending-ask_user + backend harness-failure-cleanup + HITL round-trip, NOT the chat
  tool-card surface. **Reviewed at 095 discuss (2026-06-05) → routed OUT of 095** (operator did not
  object). Better fit: the ask_user/failure-honesty line (Phase 096 owns ask_user-restart UAT) or a
  dedicated HITL-cleanup fix. Left OPEN.
- **Per-phase tool/search COUNT chips** ("6 searches / 16 tool calls") threaded from the sub-agent
  stream → **SEED-053** (deferred at 094 D-03). 095's D-04 step count is the chat action count, a
  different thing.
- **Generated files rendered IN THE PANEL** (workflow `execute_code` artifacts) → **SEED-037/038**.
  095's D-07 is the CHAT-side output-file surface only; confirm the boundary at planning.
- **Composer 2-pill redesign + Workflows page** → v2.9 / SEED-051 (094 D-02).

### Reviewed bugs (not folded)
- BUG-260605-01 — routed out (above).
</deferred>

---

*Phase: 095-chat-tool-card-unification*
*Context gathered: 2026-06-05*
