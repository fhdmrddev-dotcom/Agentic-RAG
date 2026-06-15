---
phase: 094-workflow-legibility-mode-clarity
plan: 05
subsystem: ui
tags: [react, panel, composer, harness, mode-clarity, run-honesty, draft, batch, panel-09, d-02, d-06, xss-guard]

# Dependency graph
requires:
  - phase: 094-02-phase-demux
    provides: "the panel-only tasksByThread slice + useTasks(threadId) selector this plan's BatchResultList reads (PANEL-09 isolation); the workflowLockByThread server-truth lock the mode-label derives from"
  - phase: 094-03-timeline-render
    provides: "the ChatArea.tsx requestOpenPanel() panel-open seam this plan layers the displayedMode prop cleanly on top of; the PhaseCard SubAgentRow plain-text-children + summary-row precedent BatchResultList mirrors"
  - phase: 093-05-surfacing
    provides: "the PendingAsk.draft optional field on the wire (D-12) + the type (types/index.ts:311) this plan's DraftBlock finally RENDERS (093 only plumbed it)"
  - phase: 087-agent-workspace-panel
    provides: "the PendingAskCard a11y/plain-text-children chrome + the shadcn Dialog wide-overlay pattern (DiffExpandOverlay) the draft open-wide reuses"
provides:
  - "MessageInput displayedMode prop — the DISPLAYED Deep/Harness pill TEXT reads server truth (defaults to workflowMode for back-compat); the dropdown items + kickoff staging keep reading workflowMode (the launch-toggle intent)"
  - "ChatArea displayedMode={workflowLocked ? harness : deep} derivation — kills finding #5 (a running Harness workflow mislabeled Deep) by construction"
  - "PendingAskCard DraftBlock — renders ask.draft ABOVE the question with the verbatim 'DRAFT · awaiting your review — not yet saved' tag, faded-mask preview + word count + ⤢ wide Dialog overlay for long drafts, DRAFT-MISSING guard, plain-text children (XSS)"
  - "BatchResultList — per-subtopic sub_agent_done.summary rows from the panel-only useTasks store, progressive disclosure, suppressed counts, plain-text children (PANEL-09 — zero chat re-render)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Displayed-vs-launch split: the composer mode PILL TEXT reads a server-truth-derived `displayedMode` prop; the dropdown SELECTION + kickoff staging keep their own `workflowMode` useState. Read-derivation, not a state-shape change — the launch toggle is untouched."
    - "Run-honesty draft contract: agent-drafted text renders labelled 'not yet saved' so it is never read as the final answer; long content previews behind a faded mask + opens a WIDE overlay over the chat (reuses the 087 DiffExpandOverlay Dialog pattern), never auto-widens the panel."
    - "PANEL-09 panel-only read for batch results: BatchResultList reads useTasks (tasksByThread) EXCLUSIVELY, never a chat selector — a batch summary landing triggers zero chat re-renders. Mirrors the PhaseCard SubAgentRow plain-text-children shape."
    - "Client-derived counts: the draft word count is computed from draft.length at render (never a fixture number); BatchResultList suppresses per-item source/tool counts (sub-stream / INVENTED, DATA-CONTRACT §8)."

key-files:
  created:
    - frontend/src/components/panel/BatchResultList.tsx
    - frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx
  modified:
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx

key-decisions:
  - "The displayed mode label is a NEW `displayedMode` prop (defaulting to `workflowMode`) rather than a rewire of the existing pill state — the dropdown SELECTION + the :307 kickoff staging legitimately need the launch toggle (the user's intent for the NEXT kickoff). Only the badge TEXT moves to server truth. This is the minimal change that kills finding #5 without touching the Phase-092 composer shape (the 2-pill redesign stays deferred to v2.9 per D-02)."
  - "The draft open-wide overlay reuses the shipped shadcn Dialog (the same primitive behind the 087 DiffExpandOverlay) sized w-[88vw] max-w-[760px] to satisfy the UI-SPEC min(760px,88%) contract — focus-trap/Escape/restore for free, no new dependency, never auto-widens the panel."
  - "The long-draft threshold is a presentational 60-word cut (the contract is 'long ⇒ preview + open-wide', driven by draft length — generic, not workflow-specific). Short drafts render inline."
  - "BatchResultList is EXPORTED for reuse but not yet mounted — the plan's Task 3 action says 'Export it for reuse' and lists no mount-point file in files_modified. Documented as an intentional known stub (see Known Stubs); the consuming PhaseCard/panel-section wiring is a follow-on (the component + its panel-only data read are complete and correct)."

patterns-established:
  - "Mode = server truth (D-02): the displayed Deep/Harness badge derives from workflowLocked (reconciled from active_workflow_run_id), never the stale client launch toggle — the structural kill of finding #5."
  - "Draft 'not yet saved' contract (D-06): every agent-drafted review surface carries the verbatim non-negotiable label so a draft is never mistaken for the saved answer."

requirements-completed: [PANEL-09]

# Metrics
duration: 7min
completed: 2026-06-04
---

# Phase 094 Plan 05: Mode-Label Server Truth + Draft Render + Batch Summaries Summary

**Three pure-frontend renders over data already on the wire, closing the last of Phase 094's legibility gaps: (D-02) the DISPLAYED Deep/Harness mode pill now derives from server truth (`workflowLocked` ← `active_workflow_run_id`) via a new `displayedMode` prop — killing finding #5 (a running Harness workflow mislabeled "Deep") by construction while the Phase-092 launch toggle stays AS-IS; (D-06) `PendingAskCard` finally RENDERS `ask.draft` ABOVE the question with the verbatim "not yet saved" tag + a faded-mask preview + a ⤢ WIDE Dialog overlay for long drafts; and a new `BatchResultList` surfaces per-subtopic `sub_agent_done.summary` rows from the panel-only `useTasks` store (PANEL-09 — zero chat re-render). ChatAreaMode + PendingAskCard tests GREEN; zero backend touch; tsc baseline 37 (zero net-new); vite build clean.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-04T19:31:21Z
- **Completed:** 2026-06-04T19:37:39Z
- **Tasks:** 3
- **Files modified:** 6 (2 created + 4 modified)

## Accomplishments

- **D-02 mode label from SERVER TRUTH (finding #5 killed).** `MessageInput` gained a `displayedMode?: "deep" | "harness"` prop that drives ONLY the Deep/Harness pill TEXT (`displayedMode === "harness" ? "Harness" : "Deep"`), defaulting to `workflowMode` for back-compat. `ChatArea` passes `displayedMode={workflowLocked ? "harness" : "deep"}`, derived from the already-present server-truth lock (`workflowLocked` at :85, reconciled from `active_workflow_run_id` at :161-167). The dropdown menu items, the `active`/amber markers, and the `:307` kickoff staging all keep reading `workflowMode` (the user's launch-toggle intent for the NEXT kickoff) — a read-derivation change, not a state-shape change. A running Harness workflow now shows "Harness" regardless of the stale local toggle. The Phase-092 composer (Deep/Harness toggle + workflow picker) is untouched — the v2.9 2-pill redesign stays deferred.
- **D-06 draft render (run honesty).** `PendingAskCard` now reads `ask.draft` (already on the wire + the type since 093-05) via a new `DraftBlock`, rendered ABOVE the question in the pending branch. It carries the VERBATIM amber mono tag `DRAFT · awaiting your review — not yet saved` (the "not yet saved" half is the non-negotiable contract that prevents the draft being read as the final answer). A long draft (≥60 words) shows a faded-mask preview + `≈ {wordcount} words · long draft` (word count computed from `draft` length at render, never a fixture) + a `⤢ Review & edit full draft` control that opens a WIDE overlay OVER the chat (`w-[88vw] max-w-[760px]` — the UI-SPEC `min(760px,88%)`), reusing the shipped shadcn Dialog (focus-trap/Escape/restore for free; mirrors the 087 `DiffExpandOverlay`) — never auto-widening the panel. **DRAFT-MISSING guard:** `draft` undefined/empty → no DRAFT block, question + chips only (never an empty DRAFT box). Plain React text children throughout — no `dangerouslySetInnerHTML` (T-094-05-02 XSS guard).
- **D-06 batch summaries (PANEL-09).** New `BatchResultList` reads `useTasks(threadId)` — the panel-only `tasksByThread` slice the demux routes `sub_agent` rows into (094-02/03) — EXCLUSIVELY, never a chat selector, so a batch summary landing triggers ZERO chat re-renders (T-094-05-04). It renders per-subtopic rows: the clean sub-question `description` (the "Overall topic… / Sub-question…" prefix trimmed presentationally) → the real `sub_agent_done.summary` on done, with progressive disclosure (collapsed by default, expand to read the summary). Per-item source/tool/search counts are SUPPRESSED (sub-stream / INVENTED, DATA-CONTRACT §8). Empty (no children) → renders nothing. An optional `parentRunId` scopes to one batch phase's children. Plain-text children (XSS guard).
- **Tests GREEN, build clean.** `ChatAreaMode.test.tsx` (3/3 — locked→Harness regardless of the local toggle, unlocked→Deep, absent `displayedMode`→falls back to `workflowMode`); `PendingAskCard.test.tsx` (18/18 incl. 5 new draft cases + axe-with-draft zero violations + the DRAFT-MISSING guard); the full panel suite 111/111 (no regression). `tsc -b` = 37 (the documented post-094-03 baseline, ZERO net-new — zero errors reference any of this plan's files); `npx vite build` clean.

## Task Commits

Each task was committed atomically (sequential on `v2.5-dev`, normal commits WITH hooks):

1. **Task 1: displayed mode label reads server truth (D-02, finding #5) + ChatAreaMode.test.tsx GREEN** — `7cb443f2` (feat) [tdd]
2. **Task 2: render ask.draft above the question in PendingAskCard (D-06 draft + open-wide) + PendingAskCard.test.tsx GREEN** — `492695c2` (feat) [tdd]
3. **Task 3: BatchResultList — per-subtopic summaries, panel-only (PANEL-09)** — `941c4f17` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

_Note: Tasks 1/2 are `tdd="true"`. Per the `type: execute` convention, each authored its test cases RED (confirmed failing before the impl) and flipped them GREEN in the same task commit — no discrete `test(...)` RED commit; the suite is run at the end of each task._

## Files Created/Modified

- `frontend/src/components/chat/MessageInput.tsx` (MODIFIED) — the `displayedMode?: "deep" | "harness"` prop + the `labelMode = displayedMode ?? workflowMode` derivation; the pill TEXT at the Deep/Harness toggle reads `labelMode` (the dropdown items + kickoff styling keep `workflowMode`).
- `frontend/src/components/chat/ChatArea.tsx` (MODIFIED) — `displayedMode={workflowLocked ? "harness" : "deep"}` passed to MessageInput (server truth from `workflowLocked` :85); Plan 03's `requestOpenPanel()` + the `setWorkflowMode`/`:307` kickoff staging intact.
- `frontend/src/components/chat/__tests__/ChatAreaMode.test.tsx` (CREATED) — 3 unit tests over the MessageInput pill: server-truth-harness wins over a stale "deep" toggle, deep when unlocked, fallback to `workflowMode` when `displayedMode` is absent.
- `frontend/src/components/panel/PendingAskCard.tsx` (MODIFIED) — the `DraftBlock` (verbatim tag + faded-mask preview + word count + ⤢ wide Dialog overlay) + the `draft` destructure + the `{draft && <DraftBlock />}` DRAFT-MISSING-guarded mount ABOVE the prompt.
- `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx` (MODIFIED) — 5 new draft cases (tag+body above prompt, DRAFT-MISSING guard, long-draft word count + open-wide control, wide overlay opens with the full draft + "not yet saved", axe-with-draft) + `within` import + draft fixtures.
- `frontend/src/components/panel/BatchResultList.tsx` (CREATED) — the panel-only per-subtopic summary list: `useTasks` read, `cleanDescription` prefix trim, `BatchResultRow` (progressive disclosure, suppressed counts, plain-text children), empty→null, optional `parentRunId` scope.

## Decisions Made

- **Displayed mode = a new prop, not a rewire of the pill state.** The dropdown SELECTION + the kickoff staging legitimately need `workflowMode` (the user's intent for the next kickoff); only the badge TEXT moves to server truth via `displayedMode`. Minimal change, kills finding #5, leaves the Phase-092 composer shape untouched (v2.9 2-pill deferred per D-02).
- **The draft open-wide reuses the shipped Dialog (DiffExpandOverlay pattern)** sized `w-[88vw] max-w-[760px]` — the UI-SPEC `min(760px,88%)` — for focus-trap/Escape/restore at zero dependency cost; it overlays the chat, never auto-widens the ~30% panel (sketch 010-C D4).
- **BatchResultList is built complete + correct but exported-not-yet-mounted** — the plan's Task 3 action is "Export it for reuse" and lists no mount-point in `files_modified`; honoring that file scope, the consuming PhaseCard/panel-section wiring is a documented follow-on (see Known Stubs).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1–4 triggers. The `LONG_DRAFT_WORD_THRESHOLD` (60 words) and the `cleanDescription` prefix-trim are not deviations: the plan's Task-2 action explicitly named "long draft → preview + open-wide" (driven by length) and Task-3 named "its description … trimmed of the 'Overall topic… / Sub-question…' prefix presentationally"; both are the faithful realization of those instructions. `w-[88vw] max-w-[760px]` is the literal Tailwind expression of the spec's `min(760px,88%)`.

## Issues Encountered

- **`tsc -b` does not exit 0 — the documented post-094-03 baseline of 37, ZERO net-new.** Confirmed: zero `error TS` lines reference any of this plan's 6 files (ChatArea/MessageInput/PendingAskCard/BatchResultList + the 2 tests); the 37 are the pre-existing unrelated-file baseline (SkillFormDialog, SettingsPage, StreamsProvider `getActiveRuns` unused, streamsStore zustand generic). `npx vite build` is clean (only the pre-existing chunk-size + dynamic-import warnings). Per the SCOPE BOUNDARY rule the baseline errors in unrelated files were NOT touched.
- **`PendingAskCard.test.tsx` emits jsdom `HTMLCanvasElement.getContext()` "Not implemented" warnings** — pre-existing jsdom noise from an unrelated rendered child, not from the draft code; all 18 tests pass cleanly.

## Known Stubs

- **`BatchResultList` is exported but not yet mounted into a panel section / consumed by a batch `PhaseCard`.** This is INTENTIONAL and in-contract: the plan's Task 3 action specifies "Export it for reuse … OR it mounts as a sibling panel block" and lists NO mount-point file in `files_modified` (PhaseTimeline.tsx / WorkspacePanel.tsx are not in scope). The component + its panel-only `useTasks` data read are complete, correct, and PANEL-09-isolated; wiring it into the live timeline (consuming it from a batch PhaseCard, or mounting it as a WorkspacePanel sub-block) is a follow-on render-composition step. It does NOT block the plan's goal — the three D-06/D-02 renders the plan required (mode label, draft, batch summary component) are all landed; the batch summaries are reachable the moment a consuming surface imports the exported component. Per-phase sub-agent→phase association (so a batch PhaseCard knows its children) is the same Plan-03-documented future enhancement (the demux threads sub_agent rows onto `tasksByThread`, not onto `phase.subAgents`).

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. Zero backend files touched. All three threat-register mitigations are implemented and grep-proven: T-094-05-01 (mode label derives from server-truth `workflowLocked`, not a stale toggle), T-094-05-02 (draft + summary render as plain React text children — no `dangerouslySetInnerHTML` JSX usage in either file), T-094-05-03 (the verbatim "not yet saved" draft label), T-094-05-04 (BatchResultList reads `useTasks` panel-only — never `bucketsBySurface`).

## Next Phase Readiness

- **Phase 094 implementation is COMPLETE — this was the FINAL plan (Wave 4).** All 5 plans shipped: 094-01 (token + RED scaffolds), 094-02 (phase demux → panel state), 094-03 (live phase-timeline render), 094-04 (RC-4 backend failure-honesty), 094-05 (mode label + draft + batch summaries).
- **NEXT: `/gsd:verify-work 094`** — the phase verification owns the live Chrome-MCP lived-experience UAT (G-4): the mode label reading "Harness" during a real running workflow (finding #5), the draft visible+labelled before answering an `ask_user`, the batch summaries readable, both themes a11y, and the SC#10 4-axis cross-provider scoreboard. The BatchResultList mount-point is the one render-composition item the verifier should confirm/route (wire it, or carry it as a documented deferral).
- No blockers.

---

## Self-Check: PASSED

All 2 created files + 4 modified files + the SUMMARY verified present on disk; all 3 task commits (`7cb443f2`, `492695c2`, `941c4f17`) verified in git history.

---
*Phase: 094-workflow-legibility-mode-clarity*
*Completed: 2026-06-04*
