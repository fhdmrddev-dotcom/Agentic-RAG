---
phase: 087-panel-ui
plan: 05
subsystem: ui
tags: [react, typescript, vitest, panel, ask_user, seam, chat-panel, additive, a11y]

# Dependency graph
requires:
  - phase: 087-01
    provides: "answerAskUser(runId, AskUserAnswerBody) client fn; --warning/--warning-foreground/--muted-foreground-dim CSS tokens; mockPendingAskWithRunId/mockPendingAskNoRunId fixtures (A2 run_id gate); PendingAskCard.test.tsx + Seam.test.tsx Wave 0 skeletons"
  - phase: 086-streamsprovider-extension-panel-hooks
    provides: "useAskUserPrompt(threadId) → { data: PendingAsk[]; reconcile }; PendingAsk wire type (run_id GET-only); ask_user_response SSE clears the prompt from the store"
provides:
  - "PendingAskCard + PendingAskStack — pinned amber answer surface (PANEL-04): stacked newest-top sticky cards, run_id-gated submit (A2), resume-in-place, calm expiry"
  - "SeamPointer — live one-line chat pointer for the 3 panel-owned tools (write_todos/workspace_write/ask_user)"
  - "SeamCard — reloaded self-contained chat card (answered Q&A closes the ask_user reload gap; file chip; todo final-state note)"
  - "PausedRunCue — chat-side calm-loud paused cue + composer-lock hint"
  - "MessageItem additive seam mounts: live pointers/cue near RunCard, reloaded cards near finalOutputFiles (D-05 single source of truth)"
affects: [087-02 panel-shell (mounts PendingAskStack + wires onSeePanel/onOpenPanel), 088-a11y-e2e]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — pure React + existing tokens/hooks
  patterns:
    - "Mode-aware seam renderer: per-message runStatus === 'streaming' = live (pointer/cue), else = rehydrated history (card). No new global state."
    - "A2 run_id gate: reconcile-if-missing on mount (run_id is GET-only); submit stays disabled with a quiet 'Preparing…' affordance until run_id lands — never POST without it."
    - "Optimistic-then-reactive answer: optimistic green .answered on 200, then the ask_user_response SSE removes the prompt from the store → card unmounts, run un-pauses."
    - "All agent/user text rendered as plain React children — no dangerouslySetInnerHTML, no JSON.stringify of tool payloads (T-087-11/T-087-13)."

key-files:
  created:
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/SeamPointer.tsx
    - frontend/src/components/panel/SeamCard.tsx
    - frontend/src/components/panel/PausedRunCue.tsx
  modified:
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx
    - frontend/src/components/panel/__tests__/Seam.test.tsx

key-decisions:
  - "Seam open handlers (onSeePanel/onOpenPanel) are OPTIONAL props left unwired — WorkspacePanel.tsx (Plan 02, not yet merged) owns the panel-open action. The renderers degrade gracefully (no-op click) until the shell wires them; keeps Task 3 self-contained + additive."
  - "Mode signal reuses the existing per-message `isMessageStreaming = message.runStatus === 'streaming'` already in MessageItem scope — no new state, consistent with the Phase 075 sticky-label gating."
  - "ask_user SeamPointer uses amber + ⏸ (blocked-on-me) while write_todos/workspace_write use primary + → (live) — color language LOCKED."
  - "PendingAskCard free-text is a <textarea rows=2> (multi-line answers) rather than the sketch's single-line <input> — same calm chrome, better for prose answers; placeholder + label copy verbatim from UI-SPEC."

patterns-established:
  - "Panel-owned tool classification (seamKindFor) lives in MessageItem as a module helper; the 3 names are the single source for both live + reload branches."
  - "SeamCard payload is built from the resolved ToolCall (args + result) via seamCardPayloadFor — renders ONLY summarized known fields, never the raw payload."

requirements-completed: [PANEL-04]

# Metrics
duration: 7min
completed: 2026-05-29
---

# Phase 087 Plan 05: Pending-Ask Answer Surface + Chat↔Panel Seam Summary

**The PANEL-04 answer surface (stacked amber `PendingAskCard`s with run_id-gated submit + resume-in-place) plus the three additive chat↔panel seam renderers (live `SeamPointer`, reload `SeamCard` that closes the `ask_user` reload gap, and the `PausedRunCue`), mounted strictly additively into the G-5 `MessageItem` with single-source-of-truth (D-05) and zero raw-JSON leak.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-29T01:29:06Z
- **Completed:** 2026-05-29T01:35:38Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified) + 1 G-5 hot file (MessageItem.tsx, additive)

## Accomplishments

- **PendingAskCard + PendingAskStack (PANEL-04, D-03):** consumes `useAskUserPrompt(threadId)`, renders the FULL `PendingAsk[]` newest-pinned-top, each `position: sticky; top: 0; z-index: 4`, no cap. Amber "Needs you" chrome + `m:ss` countdown (`dotBounce` pip), optional `role="radio"` choice chips in a `radiogroup`, an always-present free-text `<textarea>` (D3 no-options trap).
- **A2 / Pitfall 1 gate (the concrete resolution of Research Open Question #2):** `Send Answer` is `aria-disabled` until (a choice is picked OR text typed) AND `run_id != null`. A pure-SSE prompt (no `run_id`) triggers ONE `reconcile()` on mount-if-missing and shows a quiet "Preparing…" affordance — the card NEVER POSTs without a real `run_id` (would 404).
- **Resume-in-place (D4):** submit → `answerAskUser(run_id, {tool_call_id, response_text, choice_index})` → optimistic green `.answered` ("Answered · agent resumed" + "You answered <value>") with `aria-live="polite"`; the `ask_user_response` SSE then removes the prompt from the store, reactively unmounting the card and un-pausing the run.
- **Calm expiry (D5):** on 0-countdown the card renders the grey `.expired` state ("No response within m:ss — agent stopped") — never a crash/hang.
- **Seam renderers (D-05):** `SeamPointer` (live one-liner, primary link / amber for ask_user), `SeamCard` (reloaded self-contained card — answered Q&A closes the documented reload gap, file chip with `· v{n}`, "☑ N todos · all done" + "open panel ↗"), `PausedRunCue` (calm-loud amber cue + "Agent is paused"). Only summarized known fields rendered as plain text — no raw JSON.
- **Additive MessageItem mounts (G-5):** live pointers/cue as a NEW sibling next to `RunCard`; reloaded cards as a NEW sibling near `finalOutputFiles`. 102 insertions / 0 deletions; `RunCard` call shape preserved verbatim.
- **Tests:** both Wave 0 `it.todo` skeletons flipped to live — PendingAskCard 10 GREEN, Seam 7 GREEN.

## Task Commits

1. **Task 1: PendingAskCard — stacked amber card, run_id-gated submit + resume (A2)** — `fc213974` (feat)
2. **Task 2: Seam renderers — SeamPointer / SeamCard / PausedRunCue** — `4044bcf6` (feat)
3. **Task 3: Mount seam renderers into MessageItem — ADDITIVE only (G-5)** — `6c269521` (feat)

## Files Created/Modified

- `frontend/src/components/panel/PendingAskCard.tsx` — NEW. PendingAskStack (hook consumer) + PendingAskCard (per-prompt: amber/answered/expired states, A2 gate, submit → answerAskUser).
- `frontend/src/components/panel/SeamPointer.tsx` — NEW. Live one-line pointer; `SeamKind` exported type.
- `frontend/src/components/panel/SeamCard.tsx` — NEW. Reloaded self-contained card; `SeamCardPayload` exported type.
- `frontend/src/components/panel/PausedRunCue.tsx` — NEW. Chat-side paused cue + composer-lock hint.
- `frontend/src/components/chat/MessageItem.tsx` — MODIFIED (additive). Imports + `seamKindFor`/`hasPendingAsk`/`seamCardPayloadFor` helpers + two additive mount blocks.
- `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx` — MODIFIED. 10 live tests (was Wave 0 it.todo skeleton).
- `frontend/src/components/panel/__tests__/Seam.test.tsx` — MODIFIED. 7 live tests (was Wave 0 it.todo skeleton).

## Decisions Made

- **Seam open handlers left unwired (optional props).** `WorkspacePanel.tsx` (Plan 02 panel shell) is not yet merged and owns the panel-open action; `onSeePanel`/`onOpenPanel` are optional and no-op until the shell wires them. This keeps Plan 05 self-contained and the MessageItem change purely additive. Plan 02 will pass the open handler through.
- **Mode signal reuses `message.runStatus === "streaming"`** (the existing `isMessageStreaming` already in MessageItem scope) — no new global state, consistent with the Phase 075 sticky-label gating. Live = pointer/cue; terminal/rehydrated = card.
- **Free-text is a multi-line `<textarea rows=2>`** rather than the sketch's single-line `<input>` — same calm amber chrome, better for prose answers. Placeholder ("Type an answer…") + all other copy verbatim from UI-SPEC.
- **ask_user pointer uses amber + ⏸; write_todos/workspace_write use primary + →** — color language LOCKED (amber = needs-you/paused, primary = live/pointer).

## Deviations from Plan

None — plan executed exactly as written.

The only judgement call (free-text `<textarea>` vs the sketch's `<input>`) is within the plan's latitude: the plan says "always-present free-text" and the sketch CSS used `<input>`; a `<textarea>` is the same surface with multi-line affordance, copy unchanged. Not a behavior deviation.

## Issues Encountered

- **`dangerouslySetInnerHTML` / `JSON.stringify` grep false-positives:** the acceptance criteria require `grep -c` to return 0 for these in the seam + ask components. My initial doc-comments literally contained the banned phrases ("no dangerouslySetInnerHTML", "no JSON.stringify"), tripping the grep. Reworded the comments so the grep is clean (0) while the threat-model intent (T-087-11/T-087-13) is documented. No functional code ever used either pattern.
- **MessageItem.test.tsx baseline:** `MessageItem.test.tsx > shows thinking indicator when streaming with empty content` fails 1/18 — verified via `git stash` that it fails identically on the pre-change tree. It is part of the known ~17-failure baseline (RESEARCH §"Note on baseline"), NOT caused by my additive change.

## TDD Gate Compliance

Plan tasks were `tdd="true"` per-task (not a plan-level `type: tdd`). The Wave 0 (Plan 01) `it.todo` skeletons served as the RED contract for both files; Plan 05 flipped them to GREEN with the components landing in the same commit (Tasks 1 + 2 each ship component + live tests together, the standard pattern for "flip the Wave 0 skeleton" tasks). All tests GREEN on first full run.

## Threat Surface

No new threat surface beyond the plan's `<threat_model>`:
- **T-087-11 (XSS via prompt/answer):** prompt, options, and answered value render as plain React text children; free-text sent as JSON. `grep -c dangerouslySetInnerHTML` = 0 across PendingAskCard/SeamCard. Mitigated.
- **T-087-12 (spoofing another user's run):** `run_id` is sourced ONLY from the GET-reconciled PendingAsk (own-thread, RLS-scoped); the A2 gate ensures we POST a reconciled run_id, never a guessed one; backend scopes `runs` by user_id (404 on foreign run). Mitigated.
- **T-087-13 (raw-JSON leak in seam):** SeamPointer/SeamCard render only summarized known fields; `grep -c JSON.stringify` = 0 in both. Single-source-of-truth (D-05) prevents duplicate rich rendering. Mitigated.
- **T-087-14 (G-5 regression):** MessageItem diff is 102 insertions / 0 deletions; RunCard call shape preserved (grep + diff verified); BUG-260529-02 surface untouched. Mitigated.

## Known Stubs

None that block the plan goal. The seam open handlers (`onSeePanel`/`onOpenPanel`) are intentionally unwired optional props — Plan 02 (panel shell) wires them when it mounts. This is documented above (Decisions Made), not a silent stub: the renderers are fully functional; only the panel-reveal click is deferred to the shell that owns it.

## User Setup Required

None — no external service configuration, zero new dependencies.

## Next Phase Readiness

- **087-02 (panel shell):** mounts `PendingAskStack` at the very top of the panel body (pinned regardless of section order); passes a panel-open handler down to the seam renderers via `onSeePanel`/`onOpenPanel`.
- **088 (a11y/E2E):** the ask_user form contract (label + radiogroup + aria-disabled submit + aria-live announce) and the seam reload-resolved cards are baked in for the A11Y + reload-flow E2E gates.
- Lived-experience + cross-provider resume UAT live in `087-VALIDATION.md` (Chrome MCP, all 6 native providers) — to be exercised once the shell mounts a real consumer.
- No blockers. tsc clean; panel suite GREEN; full suite at the known 17-failure baseline.

## Self-Check: PASSED

All 4 created files + 2 modified test files verified present; all 3 task commit hashes verified in git log (`fc213974`, `4044bcf6`, `6c269521`). PendingAskCard 10/10 + Seam 7/7 GREEN; tsc --noEmit exits 0; full suite at 17-failure baseline (unchanged by this plan).

---
*Phase: 087-panel-ui*
*Completed: 2026-05-29*
