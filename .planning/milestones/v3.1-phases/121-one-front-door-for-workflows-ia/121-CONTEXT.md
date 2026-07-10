# Phase 121: One Front Door for Workflows (IA) - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Simplify the chat composer to **exactly two mode pills (General / Explorer)** by removing
the Deep/Harness toggle ("Harness pill") and the in-chat published-workflow picker, so the
**Workflows page is the single, obvious front door** for launching workflows — while
preserving the existing per-thread Harness↔Deep lock / 409 / reconcile behavior *exactly*
(IA-01).

This is a **frontend removal/simplification**, not net-new construction. The target 2-pill
design is already sketched, operator-adopted (sketches **011-A / 021-A / 022-A**, 2026-06-14),
and packaged in `sketch-findings-agentic-rag`; Phase 121 *implements* that approved design —
the composer pill consolidation was designed in Phase 094 but never shipped (the live code
still renders all three mode controls).

**In scope:**
- Remove the Deep/Harness toggle (`data-testid="workflow-mode-selector"`) from the composer.
- Remove the in-chat published-workflow picker (`data-testid="workflow-picker"`).
- Remove the now-unused composer props/handlers (`workflowMode`/`onWorkflowModeChange`/
  `publishedWorkflows`/`selectedWorkflowId`/`onWorkflowSelect`/`displayedMode`) from
  `MessageInput` and their wiring in `ChatArea`.
- Keep the General/Explorer (`agent-mode-selector`) selector and the Model selector → 2 pills.
- Preserve `workflowLocked` per-thread reconcile, the 409 lock banner, the disabled-composer +
  "Workflow running — Cancel to switch back" placeholder, and the launch-into-Harness behavior.

**Out of scope (NOT this phase):**
- Removing the launch-in-context *capability* (REQUIREMENTS non-goal, line 74 — launch stays an
  explicit action, just relocated to the Workflows page).
- Any server-side change to the in-chat launch path (kept as harmless dead code — see D-02).
- Any change to `backend/app/api/threads.py` (G-5 firing — must not grow it).
- The Phase 124 Workflow Studio "soul" / strict↔loose re-skin (WUX-01/02).
- The run-surface honesty bugs (BUG-260610-01 et al.) — Phase 124 territory.

</domain>

<decisions>
## Implementation Decisions

### Mode legibility after pill removal
- **D-01:** The composer-level "this thread is workflow-locked" signal **reuses existing
  affordances only** — the already-shipped chat run receipt / status strip (sketch 015-C/022-A)
  + the disabled composer + the "Workflow running — Cancel to switch back" placeholder + the
  409 lock banner (`workflow-lock-error-banner`). **No new composer chrome.** Research must
  verify the **Cancel** affordance is reachable from the existing run receipt; if the
  never-vanishes run-status strip + Cancel from Phase 103/095 does not actually render for a
  locked thread, that gap surfaces in planning (do NOT add a duplicate composer chip — fix the
  receipt). Rationale: matches 022-A ("chat = thin run receipt"); minimal blast radius.

### Removal depth
- **D-02:** **UI-only removal.** Strip the Deep/Harness toggle + in-chat picker + their
  `MessageInput`/`ChatArea` props/handlers (frontend only). **Keep the server-side
  send-with-`workflow_definition_id` launch path intact** (becomes dead but harmless code).
  Lowest blast radius, fully reversible, **no `threads.py` growth (G-5)**, reconcile/409
  path untouched. Retiring the server path is explicitly deferred (would touch the
  G-5-firing `threads.py` + the kickoff seam).

### Launch-in-context semantics
- **D-03:** **Launch always creates a NEW thread.** Workflows-page launch = "create thread +
  set workflow mode + switch to Chat" (locked sketches 021-A/022-A). There is **no
  "launch into the current thread"** option — keeps the Phase 120 run↔chat context-isolation
  guarantee clean (a Deep thread never silently becomes a Harness thread in place).

### Front-door discoverability
- **D-04:** **The existing "Workflows" nav entry is the single front door** (Phase 103
  three-homes IA + shared `NAV_ITEMS`). No chat-side pointer / empty-state nudge in this
  phase. An empty-state nudge stays a **deferred follow-up** if SC#10 UAT surfaces real
  discoverability pain (see Deferred Ideas).

### Guardrails (recorded for audit)
- **D-05 (G-2):** G-2 (sketch-before-discuss) fired on this phase and was **honored by
  reference** — the operator confirmed the adopted sketches 011-A/021-A/022-A (packaged in
  `sketch-findings-agentic-rag`) ARE the acceptance-bar mockup for IA-01; no new sketch
  session was run. The composer-and-mode design has no unresolved visual decisions.
- **D-06 (G-5):** `backend/app/api/threads.py` is G-5-firing. IA-01 is frontend-only and the
  UI-only removal (D-02) means **`threads.py` is not touched** — keep it that way.

### Reported-bugs routing (discuss-phase mandate)
- **D-07:** Two open `surface: Agentic-RAG` reports overlap this surface; **both left open**,
  in the SC#10 blast radius (NOT folded):
  - `general-chat-intermittent-silent-send-drop` (`frontend/composer`) — send-path
    reliability (SEED-055 residual), different root cause. 121 UAT must **not regress the
    composer send path**.
  - `BUG-260610-01` (`harness/workflow-ui`) — workflow-run nav timer reset + dup avatar;
    belongs to the **Phase 124** run-surface work (sketch 022-A already routes it there).

### Claude's Discretion
- Exact removal mechanics (delete props vs. stop passing them), test refactors for
  `ChatAreaMode.test.tsx` / `__tests__`, and any internal `workflowMode`/`setWorkflowMode`
  state cleanup in `ChatArea` — planner/executor decide, constrained by D-01..D-06.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` (Phase 121 block) — goal + Success Criteria #1–4 (2-pill composer,
  launch-still-works, 409/lock unchanged, cross-provider/parallel-thread no-regression).
- `.planning/REQUIREMENTS.md` — IA-01 (line 17) + the explicit non-goal "Removing
  'launch-in-context' entirely" (line 74); red-line/D-14 + guardrail notes (line 7).
- `.planning/STATE.md` — v3.1 roadmap shape, G-2/G-5 audit notes, open-reports routing.

### Locked design (G-2 acceptance bar)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — composer/mode + IA findings index.
- `.claude/skills/sketch-findings-agentic-rag/references/composer-and-mode.md` — **011-A**:
  resting composer = 2 pills (Model + General/Explorer), mode = server truth (no pill to
  mislabel), launch leaves the composer, running workflow = status chip + Cancel above a
  disabled composer.
- `.claude/skills/sketch-findings-agentic-rag/references/workflows-page.md` — **012/021-A**:
  Workflows page = browse + launch; Run = new thread + `active_workflow_run_id` + redirect.
- `.claude/skills/sketch-findings-agentic-rag/references/workflow-run-surface.md` — **022-A**:
  chat = thin run receipt (never-vanishes status strip + mode badge), composer locked-in-thread.
- `.claude/skills/sketch-findings-agentic-rag/references/app-information-architecture.md` —
  three-homes IA contract, one net-new "Workflows" nav entry, no router.

### Live code to edit / preserve
- `frontend/src/components/chat/MessageInput.tsx` — the composer; the 3 mode controls live at
  ~L326 (agent-mode, KEEP), ~L374 (Deep/Harness toggle, REMOVE), ~L427 (workflow picker,
  REMOVE); props at L43–72; `workflowLocked` gating at L161/178/210.
- `frontend/src/components/chat/ChatArea.tsx` — composer wiring (L382–422), per-thread lock
  reconcile from `active_workflow_run_id` (L161-167 / L185), 409 lock banner (L519-556),
  `workflowLocked`/`displayedMode` derivation (L96/L417).
- `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx` + `RunCard.timer.test.tsx` —
  mode/composer tests to update.

### Adjacent locked behavior (do not break)
- `.planning/phases/120-collision-fix-context-isolation/120-CONTEXT.md` — Phase 120 run↔chat
  context isolation (origin tagging, asymmetric replay filter); D-03 here keeps that clean.

### Reported bugs (left open, blast radius)
- `.planning/reported-bugs/general-chat-intermittent-silent-send-drop.md`
- `.planning/reported-bugs/BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **General/Explorer selector** (`MessageInput.tsx` `agent-mode-selector`, ~L326) — kept
  as-is; one of the two surviving pills.
- **Per-thread workflow lock** — `workflowLocked` (ChatArea L96), reconciled from
  `active_workflow_run_id` at L161-167/L185; disables the composer + swaps the placeholder.
  Already per-thread (a `Map`/selector), never global (SC#3 / Phase 075.4 lesson) — preserved.
- **409 lock banner** — `workflow-lock-error-banner` (ChatArea L519-556) renders the
  server 409 copy verbatim; the SC#3 "illegal switch → 409" signal. Preserved.
- **Workflows-page launch** (Phase 103) — already does create-thread + set workflow mode +
  switch-to-chat; D-03's "always new thread" is its current behavior.
- **Chat run receipt / status strip** (sketch 015-C/022-A, Phase 103/095) — the intended
  locked-thread mode signal under D-01 (verify it renders Cancel for a locked thread).

### Established Patterns
- **Mode = server truth.** `displayedMode` derives from `workflowLocked` (reconciled), never a
  stale launch toggle — this is what kills "finding #5" (mislabeled mode). Removing the pill
  removes the only place that label was shown at the composer, so the run receipt becomes the
  sole mode signal (D-01).
- **Three-homes IA, no router** — Builder / Workflows-page / Chat-thread; nav via shared
  `NAV_ITEMS` + `ActiveView`. The single front door (D-04) is this existing nav entry.
- **Minimal-blast-radius / red line** — never fork the shared path; keep server seams intact
  (D-02). Deep Mode stays byte-identical.

### Integration Points
- `MessageInput` ⇄ `ChatArea` prop seam — the removal point (D-02, frontend only).
- Workflows page → thread creation → `active_workflow_run_id` → ChatArea reconcile → composer
  lock — the launch flow that must still work end-to-end (SC#2).

</code_context>

<specifics>
## Specific Ideas

- The acceptance bar for the composer is **literally sketch 011-A** (status chip + Cancel
  above a disabled composer; 2 resting pills). Treat its mockup as the visual contract.
- SC#10 4-axis UAT applies: cross-provider × multi-tool × parallel-thread × long-message —
  the launch-into-Harness flow + Deep no-regression must hold across providers and with a
  Thread A streaming while Thread B accepts a new prompt.

</specifics>

<deferred>
## Deferred Ideas

- **Chat-side workflows discoverability nudge** (empty-state pointer / hint that deep-links to
  the Workflows page) — only if SC#10 UAT shows real discoverability pain after the in-chat
  picker is gone (D-04). Not this phase.
- **Server-side in-chat launch path retirement** (remove send-with-`workflow_definition_id` +
  its kickoff seam) — deferred; would touch the G-5-firing `threads.py` (D-02). Candidate for
  the eventual `threads.py` extraction phase.
- **BUG-260610-01** (workflow-run nav timer reset + dup avatar) — route to Phase 124's
  run-surface work.

</deferred>

---

*Phase: 121-one-front-door-for-workflows-ia*
*Context gathered: 2026-06-22*
