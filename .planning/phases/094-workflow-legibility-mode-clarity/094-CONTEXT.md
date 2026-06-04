# Phase 094: Workflow Legibility + Mode Clarity - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

> **This phase is unusual:** the sketch step (008–013) and the **094-UI-SPEC.md** design contract
> are already DONE and approved (6/6 dimensions, 2026-06-04). This discussion did NOT re-open the
> visual/interaction/copy/a11y contract — it resolved the **scope, sequencing, and build-decision**
> gray areas the UI-SPEC left open, grounded in a live code investigation (`wf_11628da0-038`).
> **Where a decision below narrows the UI-SPEC, this CONTEXT wins** and the planner follows it.

<domain>
## Phase Boundary

Make a Harness workflow run **legible and honest** in the v2.7 workspace panel, and make mode
**unambiguous** — additively, with zero chat re-renders and (per the operator's narrowing of
D-094-UNIFY) **no relocation of Deep's chat tool-cards**.

In scope:
- A live, accessible **Harness phase-timeline** in the workspace panel (current/locked/completed
  glyphs, gate pass/fail, transition log; reconciled via `GET /threads/{id}/workflow` on mount;
  rides the `run:{run_id}` stream into a panel-only `phasesByThread` store; WCAG 2.1 AA).
- **Intermediate output** rendering: the draft before `ask_user`, and batch sub-agent summaries
  (progressive disclosure) — **pure frontend** (data already on the wire post-093-05).
- **Failure honesty:** a failed/gate-failed run renders as *failed-with-a-reason*, never an empty
  `done` — including the minimal **backend RC-4 source fix**.
- **Mode honesty:** the displayed mode label derives from **server truth**
  (`active_workflow_run_id`), killing the "reads Deep during a running Harness run" bug.
- The **`--accent-violet` token migration** (UI-SPEC Build Prerequisite A).

Out of scope (see `<deferred>`): Deep tool-card relocation, the 3 chat-card bugs (→ Phase 095),
the composer 2-pill redesign + Workflows page + `GET /workflows/{id}` (→ v2.9), per-phase
tool/search counts (→ SEED-053), interactive todo execution (→ SEED-052), generated-files-in-panel
(→ SEED-037/038).
</domain>

<decisions>
## Implementation Decisions

### D-01 — D-094-UNIFY NARROWED: Deep tool-cards stay in chat (supersedes the 2026-06-02 unify sign-off)
**Do NOT relocate Deep's tool-cards out of chat.** The workspace panel shows **mode-appropriate**
content: **Harness → the new live phase-timeline**; **Deep → its existing v2.7 workspace sections**
(todos / files / pending / versions). Deep's `RunCard`/`ToolCallPanel` stay in the chat message
list.
- **Why:** none of the operator's 6 acceptance-bar findings require moving Deep out of chat; the
  empty-pulse / "ghost avatar" is a **Harness-only** problem already solved by the panel timeline +
  the quiet "running in workspace ▸" seam; dropping the relocation removes ALL G-5 hot-file risk
  (`ToolCallPanel`/`MessageItem`/`StreamsProvider` untouched) and **dissolves the 094↔095
  collision**.
- **Consequence:** the three chat-card quality bugs — `chat-tool-cards-scroll-collapse-duplicate`
  (BUG-260529-02), `timer-disappears-long-runs` (BUG-260528-01), `step-count-mismatch-timer-vs-panel`
  (BUG-260528-02) — **all stay in Phase 095** (they're rooted in `RunCard`, which 094 no longer
  touches). 094 does NOT fold any of them in.
- **UI-SPEC impact:** the "Deep RunCard relocated into the panel" and "Deep chat-seam" rows of the
  UI-SPEC become **unused** (a subtraction, not new work). The panel timeline design is untouched.

### D-02 — Mode/launch (Areas ②+⑤): fix the label in 094, defer the redesign to v2.9
- **In 094 (small, surgical):** derive the displayed mode label from **server truth**
  (`threads.active_workflow_run_id`), NOT the `ChatArea` `useState<"deep"|"harness">` that goes
  stale before the mount-time `getThreadWorkflow` reconcile. **Kills finding #5** (mode reads "Deep"
  during a running Harness workflow). Zero-risk; the Phase-092 composer (Deep/Harness toggle +
  workflow picker) stays **AS-IS**.
- **Deferred to v2.9 (coupled redesign — can't half-build):** the **2-pill composer**
  simplification + "launch leaves the composer" + the **Workflows PAGE** + the new
  `GET /workflows/{id}` endpoint (Build-Prereq C, only needed by that page). This whole
  launch/authoring surface rides with **SEED-051** (NL→workflow authoring) — same surface family.

### D-03 — Legibility (Area ③): ship the producer-honest subset, suppress (don't fake) the rest
The panel timeline renders ONLY **producer-stream-honest** signals:
- ✅ agent count (client tally of `sub_agent_start`), phase transitions (split→review→merge), merge
  narration, **per-subtopic summaries** (`sub_agent_done.summary`), the draft before `ask_user`,
  and failure-with-reason.
- ❌ **SUPPRESS** per-phase tool/search counts ("6 searches", "16 tool calls") — they fire on the
  sub-agent stream (`run:{sub_run_id}`), invisible to the producer; faking them is forbidden. The
  render guard keeps count-chips hidden until a real producer source exists.
- **Build-Prereq B** (thread sub-stream tool events up to the producer for per-phase counts +
  drill-down) is **DEFERRED → SEED-053** (biggest backend add; hot sub-agent path). The honest
  subset meets the operator's *spirit* ("real steps, not a spinner") in 094; the literal counts
  come later.

### D-04 — Failure honesty (Area ④): the RC-4 backend source fix LANDS in 094 (required)
094 includes the minimal **backend** RC-4 fix: the harness failure path
(`harness_engine.py` ~699–709) currently emits `run_failed` and **returns without persisting any
message** (the success path at ~822 calls `_surface_final_answer`; the failure path does not) → a
later reconcile reads a terminal run with empty content → renders as a silent `done`. Fix: persist
a **real failure message before returning** (mirror the success surfacing).
- **UI-only is INSUFFICIENT** — if nothing persists, the reconcile has nothing to key off.
- **Harness-only branch; Deep stays byte-identical** — keep the fix inside `run_workflow` before
  return, NOT in the shared `_shielded_finalize`. The UI renders failed-with-reason keyed off
  `run_failed`/`gate_failed` (closed taxonomy from the UI-SPEC). This is the **one backend touch**
  094 carries.

### D-05 — `--accent-violet` token migration (UI-SPEC Build-Prereq A) — REQUIRED, first
Add `--accent-violet` to **both** theme blocks in `frontend/src/index.css` (HSL channels, no
`hsl()` wrapper, with the verification comment) AND register it in `frontend/tailwind.config.js`,
**before** any purple surface (`retrying` state / `llm_batch_agents` marker) renders. Contrast
targets per UI-SPEC §Build Prerequisites A. (Frontend CSS change, not a SQL migration.)

### D-06 — Intermediate output (Area F) is PURE FRONTEND rendering
The **draft** before `ask_user` is already on the wire (`ask_user_prompt.draft`) + the `/pending`
durable row (post-093-05); `PendingAskCard` already receives `ask.draft` but doesn't render it.
Batch **sub-agent summaries** (`sub_agent_done.summary`) are already on the producer wire + stored
in `tasksByThread`. So 094 adds: a **draft preview (+ open-wide overlay)** in `PendingAskCard`, and
a **per-subtopic summary display**. **Zero backend changes**, additive.

### D-07 — Additive-only constraint (binding, from UI-SPEC)
All new `phase_*` / `gate_failed` / `run_failed` SSE handlers are **additive `else-if` branches
AFTER** the Deep dispatch in `frontend/src/lib/api.ts` (~485–667). The existing
`delta`/`sources`/`citations`/`confidence`/tool dispatch Deep depends on stays **BYTE-IDENTICAL**.
New state lives in a panel-only **`phasesByThread`** store slice (PANEL-06); chat selectors never
read it → a panel mutation triggers ZERO chat re-renders.

### Claude's Discretion
None flagged — the UI-SPEC + locked sketches define the visual/interaction contract; these
decisions are scope/sequencing. Standard implementation choices (component file layout, hook
shape) are the planner/executor's.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract (read FIRST)
- `.planning/phases/094-workflow-legibility-mode-clarity/094-UI-SPEC.md` — approved visual /
  interaction / copy / a11y / real-vs-invented contract. **CONTEXT D-01 and D-02 narrow it**
  (drop Deep relocation; defer composer-2-pill + Workflows page) — follow CONTEXT where they differ.
- `.planning/sketches/094-grounding/DATA-CONTRACT.md` — real-vs-invented field mapping (producer
  stream vs sub-agent stream); the authority for what may be rendered vs suppressed.
- `Skill("sketch-findings-agentic-rag")` — locked sketch winners 008–013 (panel-shell, chat↔panel
  seam, harness phase-timeline, run honesty, composer/mode, workflows-page design-ahead).

### Operator intent / rationale
- `.planning/phases/093-harness-cross-provider-parity/094-UI-FINDINGS-FROM-093-REUAT.md` — the 7
  acceptance-bar findings (#1 live steps, #2 draft-before-ask_user, #3 failed-renders-empty,
  #5 mode mislabel, #6 opaque between-phase). The 094 bar is judged against these.
- `.planning/phases/093-harness-cross-provider-parity/093-CROSS-PROVIDER-UAT-FINDINGS-AND-NEXT.md` §6
  — original D-094-UNIFY rationale (now **narrowed** by D-01).

### Deferred capture (this phase's deferrals)
- `.planning/seeds/SEED-051-generalized-nl-workflow-authoring.md` — v2.9 launch/authoring surface
  (D-02 defers the composer-2-pill + Workflows page here).
- `.planning/seeds/SEED-052-interactive-todo-driven-execution-hitl.md` — interactive todo execution
  (out of 094; see `<deferred>`).
- `.planning/seeds/SEED-053-sub-stream-tool-counts-to-producer-timeline.md` — Build-Prereq B
  (deferred per D-03).

### Code anchors (from the live investigation)
- `backend/app/services/harness_engine.py` — RC-4 fix site (fail path ~699–709 vs success
  surfacing ~822, `_surface_final_answer`); already emits all `phase_*`/`gate_failed`/`run_*`
  producer events for the honest subset (no new emit sites needed).
- `frontend/src/lib/api.ts` ~485–667 — the Deep SSE dispatch switch (**do NOT edit**; add
  additive branches after it).
- `frontend/src/providers/StreamsProvider.tsx` — SSE→state bridge; add a panel-only
  `phasesByThread` mutation path (do not touch the chat-bucket tool path).
- `frontend/src/components/panel/WorkspacePanel.tsx` + `PanelEmpty.tsx` — panel host (add a
  `PhaseTimeline` section mounting when `mode==='harness'` OR phases exist).
- `frontend/src/components/chat/ChatArea.tsx` — mode label: replace the local `workflowMode`
  `useState` reads with a value derived from `active_workflow_run_id` (D-02).
- `frontend/src/components/panel/PendingAskCard.tsx` — render `ask.draft` (D-06).
- `frontend/src/index.css` + `frontend/tailwind.config.js` — `--accent-violet` token (D-05).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Panel is architecturally ready** — `WorkspacePanel` already hosts PANEL-06-isolated sections
  via per-thread hooks; add a 5th `PhaseTimeline` section. `PanelEmpty` is the empty state to swap.
- **`harness_engine` already emits the full producer event vocabulary** (`phase_started`/
  `phase_completed`/`phase_transition`/`gate_failed`/`run_failed`/`run_completed`/`sub_agent_*`) —
  the honest subset (D-03) needs **no new backend emits**, only frontend handlers.
- **Draft + summaries already on the wire** (D-06) — `ask_user_prompt.draft`, `/pending.draft`,
  `sub_agent_done.summary`, `tasksByThread` — `PendingAskCard` already receives `ask.draft`.
- **Mode reconcile already exists** — `ChatArea` calls `getThreadWorkflow()` on mount and reads
  `active_workflow_run_id`; D-02 is "derive the label from that, not the local useState."

### Established patterns
- Additive SSE dispatch (else-if after the Deep switch) + panel-only store slice = the PANEL-06
  isolation pattern (chat selectors read `bucketsBySurface` only).
- Harness-only backend branches stay off the shared Deep path (`_shielded_finalize` runs for both —
  keep the RC-4 fix inside `run_workflow` before return).

### Integration points
- New SSE branches in `api.ts`; new `phasesByThread` slice in the streams store; new `PhaseTimeline`
  + `PhaseCard` + draft-preview/batch-summary components in `components/panel/`; one mode-label
  derivation change in `ChatArea`; one CSS/Tailwind token; one ~30-line backend RC-4 fix.
</code_context>

<specifics>
## Specific Ideas

- Operator's #1 acceptance bar (verbatim): **"show the workflow's REAL steps and real tasks —
  transparency, not a spinner."** 094 meets the *spirit* with the honest subset; the literal
  "6 searches / 16 tool calls" counts are deferred (SEED-053), not faked.
- Operator narrowed D-094-UNIFY in-discussion (2026-06-04): *"why do we need to move the tool card
  out of the chat area? it should be only unification and cleaning… I was just asking about the
  workspace panel and what to show inside it with different modes."* → D-01.
- Cross-provider: the panel timeline + mode + RC-4 fix must hold across all native providers
  (no provider-specific rendering); honest signals are provider-agnostic by construction.
</specifics>

<deferred>
## Deferred Ideas

- **Interactive todo-driven execution with proactive HITL** (the "ask me per step, loop through the
  todos, mark each complete, advance, produce the artifact" capability) — surfaced from a live
  `deepseek-v4-flash` "plan a trip to Paris" thread during this discussion. Root cause: the
  `agent_loop.py` system prompt biases toward autonomy + there's no ask→mark→advance loop. **NOT
  094/095/096** (it's agent behavior, not rendering). → **SEED-052** + **BUG-260604-01**
  (`agent-ignores-step-by-step-request-no-todo-loop.md`, deferred, re-opens at v2.9). Optional
  near-term **prompt nudge** noted in both. 094 only helps the *visibility* of the `ask_user`
  prompt/draft (D-06), not the loop.
- **Composer 2-pill simplification + "launch leaves composer" + Workflows PAGE + `GET /workflows/{id}`
  (Build-Prereq C)** → **v2.9** with SEED-051 (D-02). 094 keeps the Phase-092 composer as-is.
- **Build-Prereq B — sub-stream tool/search counts threaded to the producer** (per-phase
  "N searches / N tool calls" + live tool drill-down) → **SEED-053** (D-03).
- **Deep tool-card relocation into the panel** — dropped (D-01); the panel stays Harness-timeline +
  existing Deep workspace sections.
- **Chat tool-card bugs** (scroll/collapse/duplicate, timer-disappears, step-count-mismatch) → stay
  in **Phase 095** (D-01).
- **Generated-files-in-panel** (workflow `execute_code` artifacts not threaded to the producer) →
  **SEED-037/038**; confirm coverage at planning, do not promise in 094 (UI-SPEC §Out-of-Scope).
- **Ops graceful-shutdown drain** (093 finding #7) — backend/ops, not a 094 render concern.
</deferred>

---

*Phase: 094-workflow-legibility-mode-clarity*
*Context gathered: 2026-06-04*
