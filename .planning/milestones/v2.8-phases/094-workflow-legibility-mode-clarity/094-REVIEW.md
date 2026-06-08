---
phase: 094-workflow-legibility-mode-clarity
reviewed: 2026-06-04T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - frontend/src/index.css
  - frontend/tailwind.config.js
  - frontend/src/lib/api.ts
  - frontend/src/stores/streamsStore.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/types/index.ts
  - frontend/src/components/panel/PhaseTimeline.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/panel/WorkspacePanel.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/panel/BatchResultList.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/MessageInput.tsx
  - frontend/src/test-fixtures/harness094.ts
  - frontend/src/vitest-axe.d.ts
  - backend/app/services/harness_engine.py
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 094: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

This is a high-quality, defensively-engineered phase. I traced the full SSE dispatch chain end to end (`api.ts` `subscribeToRun` parser → `StreamsProvider.makeStreamCallbacks` demux → `streamsStore.phasesByThread` slice → `usePhases` selector → `PhaseTimeline`/`PhaseCard` render) and the `harness_engine.py` failure-persist boundary, and adversarially checked all 8 load-bearing invariants. **All 8 hold in the real source** — I could not refute any of them:

1. **Additive-only SSE / Deep byte-identical** — CONFIRMED. The 6 new phase branches sit as `else-if` after `cap_paused`, before the cursor-advance block, carry no `return`, and touch zero existing Deep branch.
2. **PANEL-09 zero-chat-re-render isolation** — CONFIRMED. `phasesByThread` is keyed by the owning `threadId`; `useThreadMessages` reads `bucketsBySurface` exclusively; the phase mutators never recreate `bucketsBySurface`; the persist-trigger set adds only `todosByThread`/`tasksByThread` (not `phasesByThread`).
3. **RC-4 both failure sites + Deep boundary** — CONFIRMED. `_surface_failure_message` is called at BOTH the `fail_run` branch (`:781`) AND the `skip_to_phase` runtime guard (`:811`), owner-scoped via `ctx.current_user["id"]`/`ctx.thread_id`, persists the `reason_unknown` sentinel on empty reason, lives inside `harness_engine.py` (never `_shielded_finalize`), and swallows its own exceptions so it can never mask the original failure.
4. **Suppress-don't-fake counts** — CONFIRMED. No per-phase count derives from a phase event; the only counts are `phases.length`, `Phase i/N`, the `sub_agent_start` tally, and end-of-run `sources.length`.
5. **A11Y WCAG 2.1 AA** — CONFIRMED structurally (glyph+text+color, APG accordion roles, ONE polite announcer on edges only, separate `role=alert`, indeterminate `role=progressbar`, `aria-busy` flips). One contrast nuance flagged (WR-04).
6. **XSS — agent text as plain children** — CONFIRMED. Zero `dangerouslySetInnerHTML` in any panel component (all occurrences are comments/test-names asserting its absence).
7. **Dead/unmounted code** — CONFIRMED the gap (WR-01): `BatchResultList` is built but never mounted.
8. **Reconcile-then-live forward-only** — CONFIRMED. `counterFloorRef` clamps the displayed ordinal; UNKNOWN `phase_type` falls back to a generic "Step" row and never crashes. One cross-thread ref-leak flagged (WR-02).

The findings below are all secondary correctness/UX issues, not invariant violations. No criticals.

## Warnings

### WR-01: `BatchResultList` is built but never mounted — D-06 batch-sub-results surfacing is dead

**File:** `frontend/src/components/panel/BatchResultList.tsx:127`
**Issue:** `BatchResultList` (and its `BatchResultRow`) is exported but a project-wide search finds no `import`/JSX usage anywhere outside its own file. The D-06 "batch sub-results readable before merge" feature (sketch 010-C) is therefore fully implemented but invisible to the user — a functional gap. The component reads `useTasks(threadId)` and would render per-subtopic summaries, but nothing renders it. (`PhaseCard` renders sub-agent rows from `phase.subAgents`, which is a *different, always-empty* source — see WR-05.)
**Fix:** Mount it where a batch (`llm_batch_agents`) phase is shown. The natural seam is inside `PhaseCard`'s expanded panel for a batch phase, or as a sibling block in `PhaseTimeline`:
```tsx
// In PhaseCard's <div role="region"> body, for batch phases:
{phase.phaseType === "llm_batch_agents" && (
  <BatchResultList threadId={threadId} parentRunId={/* this phase's producer run id */} />
)}
```
Note this requires threading `threadId` (and a parent-run pointer) into `PhaseCard` — see WR-03. If the surfacing is intentionally deferred, delete the unmounted component or record it as a tracked deferral so it isn't mistaken for a wired feature.

### WR-02: `counterFloorRef` is not reset on thread switch — Phase i/N floor leaks across threads

**File:** `frontend/src/components/panel/PhaseTimeline.tsx:118-120`
**Issue:** `PhaseTimeline` is mounted as `<PhaseTimeline threadId={threadId} />` with no `key={threadId}` (`WorkspacePanel.tsx:151`), so the component instance — and its `counterFloorRef` — persists across thread switches. `displayedCurrent = Math.max(counterFloorRef.current, counterCurrent)` then carries the *previous* thread's high-water mark into the next thread. Switching from a Harness thread at "Phase 5 / 5" to a different Harness thread whose true position is "Phase 2 / 5" renders "Phase 5 / 5" (clamped to that thread's `total`) until live events catch up — a cross-thread state bleed, exactly the class PANEL-09 is meant to prevent. The slice itself (`phasesByThread`) is correctly per-thread keyed; only this render-local ref is not.
**Fix:** Reset the floor when `threadId` changes (mirror the `frame` reset effect already in the file):
```tsx
useEffect(() => {
  counterFloorRef.current = 0
}, [threadId])
```
Or, simpler and structurally safer, key the component by thread at the mount site so the ref is fresh per thread: `<PhaseTimeline key={threadId ?? "none"} threadId={threadId} />`.

### WR-03: `PhaseCard` cannot fetch its phase's children — `subAgents` is structurally unpopulated

**File:** `frontend/src/components/panel/PhaseCard.tsx:308-318` (render) and `frontend/src/providers/StreamsProvider.tsx:735-743` (demux)
**Issue:** `PhaseCard` renders sub-agent child rows from `phase.subAgents`, but **no code path ever populates `phase.subAgents`** — it is initialized to `[]` in `onPhaseStarted` (`StreamsProvider.tsx:741`), in the reconcile floor (`StreamsProvider.tsx:2205`), and in every test fixture, and no demux handler (`onTaskStart`/`onTaskDone`) ever appends a `TaskRunIndexItem` into a phase's array (those route to the separate `tasksByThread` slice). The `phase.subAgents.length > 0` block (lines 308-318) is therefore **dead** — it can never render. The honest sub-agent count surfaces only via `PhaseTimeline`'s run-level `agentTally = tasks.length` (`PhaseTimeline.tsx:128`), which is NOT scoped to any individual phase. So a multi-phase workflow with sub-agents in phase B shows the agents only as a run-level tally, never associated with the phase that spawned them.
**Fix:** Either (a) wire the demux to associate `sub_agent_*` events with the active phase (append to `phasesByThread[tid][activeIdx].subAgents`, keyed by `sub_run_id`), or (b) remove the dead `phase.subAgents` block from `PhaseCard` and surface children via the (to-be-mounted, WR-01) `BatchResultList`/a thread-scoped `useTasks` read instead. Pick one source of truth for per-phase children; today the render reads an array that is never filled. If (b), drop the now-unused `position`-adjacent `subAgents` rendering and the `SubAgentRow` component, or repoint it at `useTasks`.

### WR-04: `retrying` status text uses graphic-level violet (4.35:1), below the 4.5:1 AA text floor

**File:** `frontend/src/components/panel/PhaseCard.tsx:73`
**Issue:** The `retrying` status atom renders **real text** ("Attempt N") with `textClass: "text-accent-violet"`. The CSS token comment for dark mode (`index.css:136-138`) explicitly states `--accent-violet` = `258 90% 66%` is **4.35:1 graphic on dark** (meets the ≥3:1 graphic floor) and that the **pill LABEL text should use the lightened `258 95% 84%` (#c5b0fd) → 9.83:1**. PhaseCard uses the base graphic-level token for the text, so the "Attempt N" label measures ~4.35:1 on the dark panel surface — below the WCAG 2.1 AA 1.4.3 ≥4.5:1 floor for normal-size meaningful text. (The light-theme value `258 80% 40%` = 8.52:1 is fine; only dark mode fails.) The `failed`, `done`, and `pending` status texts correctly use lightened/panel-scoped tokens that clear 4.5:1.
**Fix:** Use a lightened violet for the retrying status TEXT (matching the CSS comment's intent), e.g. add a panel-scoped `--accent-violet-text: 258 95% 84%` token and reference it:
```ts
retrying: { glyph: "↻", text: "Attempt", textClass: "text-[hsl(258_95%_84%)]" },
```
Keep `text-accent-violet`/`border-accent-violet` for the glyph and borders (graphic-level 3:1 is correct there). The vitest-axe gate will not catch this — axe does not compute `hsl()`-token contrast against an `hsl()` background — so it must be fixed by inspection.

### WR-05: completed/failed harness run loses its timeline on revisit (reconcile floor returns `[]` for terminal runs)

**File:** `frontend/src/providers/StreamsProvider.tsx:2191-2208` (`reconcilePhases`)
**Issue:** `reconcilePhases` returns `[]` when `wf.mode !== "harness"` (and `phasesByThread` is ephemeral — never persisted, `replace`d on every thread switch via `usePanelReconcile`). Because `mode` is "harness" iff `active_workflow_run_id IS NOT NULL`, a *completed* or *failed* run — whose anchor `finish_run` clears — reconciles to `mode: "deep"` → `reconcilePhases` returns `[]` → the Workflow section in `WorkspacePanel` disappears (`showTimeline = isHarness || phases.length > 0`, both false). So after the run ends and the user switches threads and comes back, the entire phase timeline (including the final failed-with-reason card the whole RC-4 effort persists in chat) vanishes from the panel. The persisted assistant message still shows in chat, but the panel legibility surface is gone. This is a real reduction of the "show the workflow's real steps" acceptance bar for any terminal run.
**Fix:** If the intent is for the timeline to survive a terminal run on revisit, have `reconcilePhases` also reconstruct a skeleton when the *latest* run for the thread is terminal-harness (e.g. read `run_status` even when `mode==="deep"` but a workflow run existed), or persist the last terminal timeline. If the timeline is intentionally live-only, document it (the `WorkspacePanel.tsx:97` comment "phases exist (DATA-CONTRACT §6)" implies persistence that does not hold post-terminal) so it isn't mistaken for a bug later.

## Info

### IN-01: `onRunFailed` empty-string slug sentinel can mis-target when the failed phase isn't the last non-terminal row

**File:** `frontend/src/providers/StreamsProvider.tsx:1919-1948`
**Issue:** `onRunFailed` calls `setPhaseStatusForThread(threadId, "", "failed", ...)`. The `slug === ""` branch scans backward for the last `running`/`retrying`/`pending` row and falls back to `prev.length - 1`. In a `skip_to_phase` workflow where a later phase is `pending` but an *earlier* phase actually failed, the backward scan flips the last pending row (not the truly-failed phase). The reconcile floor's positional `pending` rows make this reachable. Low impact (the chat message carries the real reason via RC-4), but the panel could attribute the failure to the wrong phase row.
**Fix:** If the wire can carry the failing phase slug on `run_failed`, prefer it; otherwise scope the backward scan to `running`/`retrying` only (the genuinely-active states) before falling back, so a trailing `pending` skeleton row isn't preferentially marked failed.

### IN-02: `reconcilePhases` skeleton emits duplicate placeholder slugs that can collide with live append idempotency

**File:** `frontend/src/providers/StreamsProvider.tsx:2200-2207`
**Issue:** The reconcile floor seeds non-current rows with positional slugs `phase-${i}` and the current row with `current_phase_slug ?? phase-${i}`. When live `phase_started` events then arrive carrying the *real* slug (e.g. `"research"`), `appendPhaseForThread` no-ops only if `prev.some((p) => p.slug === phase.slug)` (`StreamsProvider.tsx:1915`). Since the real slug `"research"` differs from the placeholder `"phase-1"`, the live phase is **appended as a new row** rather than replacing the placeholder — the timeline can show both `phase-1` (pending skeleton) and `research` (running) for the same index. The render `key` is `${phase.phaseIndex}-${phase.slug}` (`PhaseTimeline.tsx:190`), so they don't React-key-collide, but the user sees a phantom extra row. The `counterFloorRef` masks the count symptom but not the duplicate row.
**Fix:** On live `phase_started`, reconcile by `phaseIndex` (replace the placeholder at that index) rather than appending when the slug differs but the index matches a placeholder. Alternatively, have the reconcile floor only seed the *count* (status) and let live events own slugs, replacing positional rows by index.

### IN-03: `getThreadWorkflow` is fetched twice on the same harness thread (ChatArea + PhaseTimeline)

**File:** `frontend/src/components/panel/PhaseTimeline.tsx:87-106` and `frontend/src/components/chat/ChatArea.tsx:154-180`
**Issue:** Both `PhaseTimeline` (for the run frame) and `ChatArea` (for the lock reconcile) independently call `getThreadWorkflow(threadId)` on mount/thread-switch, and `usePhases` → `usePanelReconcile` → `reconcilePhases` calls it a *third* time. That is up to 3 GETs of the same authoritative state per thread switch for a harness thread. Not a correctness bug (the endpoint is a pure read), but redundant network + a minor inconsistency window if the three resolve against different DB snapshots.
**Fix:** Consider a single shared `useThreadWorkflow(threadId)` hook (cached/deduped) that both the composer lock and the timeline frame read, instead of three independent fetches.

### IN-04: `DraftBlock` long-draft mask uses `--muted-foreground-dim` for the "≈ N words" meta text

**File:** `frontend/src/components/panel/PendingAskCard.tsx:92`
**Issue:** The word-count meta line uses `text-[hsl(var(--muted-foreground-dim))]`. In dark mode this token is `220 16% 45%` (#606d85), which the panel's own A11Y notes (`index.css:118`) measure at **3.59:1 on the dark panel surface — below 4.5:1**. The panel-scoped `--panel-muted-foreground-dim` (8.42:1) exists precisely for meaningful panel text. The word count is informational ("long draft") so impact is low, but it's the same contrast class the panel tokens were introduced to fix.
**Fix:** Use `text-panel-muted-foreground-dim` (the panel-scoped token) for in-panel meta text instead of the global `--muted-foreground-dim`.

### IN-05: `PendingAsk` answered/expired `aria-live` regions can announce twice (nested live regions)

**File:** `frontend/src/components/panel/PendingAskCard.tsx:225-238` and `:244-257`
**Issue:** The expired card root is `role="status"` (a live region) and *contains* a child `<p aria-live="polite">` (`:236`); the answered card has a child `<p aria-live="polite">` (`:254`) inside a div with no role (fine), but the pending card has `<span aria-live="assertive">Needs you</span>` (`:274`) sibling to other content inside a `role="group"`. Nesting a polite live region inside a `role="status"` (itself polite) can cause some screen readers to announce the inner text twice. The invariant calls for ONE announcer per surface; the PendingAsk surface has overlapping ones.
**Fix:** Drop the redundant `aria-live` on the inner `<p>` when the card root is already a live region (`role="status"`), or move the announce to a single dedicated visually-hidden region per card. Verify with a screen reader since the duplication is AT-dependent.

### IN-06: `BatchResultList.cleanDescription` regex `/sub[-\s]?question\s*[:\-]\s*(.+)/is` is greedy across newlines

**File:** `frontend/src/components/panel/BatchResultList.tsx:44`
**Issue:** The `s` (dotAll) flag plus `(.+)` makes the capture greedy across the whole remaining string including newlines, so a description like `"Sub-question: A\nOverall topic: B"` captures `"A\nOverall topic: B"` rather than just `"A"`. Minor (this is presentational trimming of an engine-stamped prefix), and the component is currently unmounted (WR-01), but worth fixing before it's wired.
**Fix:** Capture only the first line: `/sub[-\s]?question\s*[:\-]\s*(.+)/i` (drop `s`), or `(.+?)(?:\n|$)`.

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
