---
phase: 095-chat-tool-card-unification
plan: 05
subsystem: chat-ui
tags: [react, fastapi, vitest, pytest, output-files, hero-working, file-icon, sse-additive]

# Dependency graph
requires:
  - phase: 095-01
    provides: "fileIcon(filename, sizePx?) — the per-extension Lucide icon primitive OutputFileCard imports (no second icon system, G1)"
  - phase: 075.2
    provides: "OutputFileCard url-optional back-compat + Bearer-fetch download states (idle/ok/dead) + the final-outputs panel in MessageItem this plan extends"
  - phase: 075.4
    provides: "sandbox_service.harvest_output_files {filename,url,size,iteration} meta dict the hero heuristic re-ranks over; content-hash dedup"
provides:
  - "D-08 backend hero tag — additive is_hero on the final_output_files emit + persisted execute_code result; agent-declared else heuristic, never empty when files exist"
  - "_select_hero_filenames(files, user_message) — the pure hero selector (requested-ext match else largest/last-written; agent-declaration forward-compatible)"
  - "D-07 frontend hero/working split — OutputFileCard variant + MessageItem FinalOutputsPanel (hero block above a collapsible Working files group, re-rank never hide)"
  - "url-less dead-link affordance — a clearly-disabled Download-unavailable state instead of a silent plain filename (RESEARCH dead-link root #1)"
affects: [OutputFileCard, MessageItem, StreamsProvider, agent_loop, api.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive SSE field: a new key on an existing event payload (final_output_files gains is_hero) — event name + existing fields unchanged, no new return, older frontends ignore it (094 byte-identical-additive)"
    - "Presentation-only tag never feeds the trust boundary: is_hero re-ranks the render only; the download click still hits the owner-fenced re-sign endpoint (UNTOUCHED) — IDOR fence intact (T-095-05-01)"
    - "Re-rank, never hide: ALL generated files stay present + downloadable; the deliverable is heroed, intermediates are a collapsible group (D-07, supersedes BUG-260514-01 hiding)"
    - "Reload-survival via persisted flag: the hero flag is stamped onto the persisted execute_code result so api.ts reload reconstruction re-heroes next-day"

key-files:
  created:
    - "backend/tests/test_095_final_output_tag.py — 13 pytest cases for _select_hero_filenames + emit/persist projection shapes"
  modified:
    - "backend/app/services/agent_loop.py — _select_hero_filenames helper + is_hero on the final_output_files emit + url guard + is_hero on the persisted execute_code output_files"
    - "frontend/src/types/index.ts — additive is_hero? on OutputFile + finalOutputFiles inline type"
    - "frontend/src/lib/api.ts — is_hero flows through onFinalOutputFiles dispatch + carried in _mapMessageResponse reload reconstruction"
    - "frontend/src/providers/StreamsProvider.tsx — onFinalOutputFiles reducer signature widened (additive)"
    - "frontend/src/components/chat/OutputFileCard.tsx — variant hero|working + fileIcon (Plan 01) + clearly-disabled url-less dead state"
    - "frontend/src/components/chat/MessageItem.tsx — FinalOutputsPanel hero/working grouping replacing the flat map"
    - "frontend/src/__tests__/components/MessageItem.finalOutputs.test.tsx — +5 D-07 hero/working/dead/graceful cases"
    - "frontend/src/__tests__/components/Plan04.frontend.test.tsx — 2 stale label assertions retargeted (Rule 1)"

key-decisions:
  - "Field name = is_hero (bool per file), not a hero_filenames companion — keeps the emit projection a single comprehension and the persisted output_files entry self-describing for reload"
  - "Heuristic is the SOLE live hero source today; the agent-declaration branch (honoring is_hero/hero already on a meta dict) is built additive + forward-compatible so a future tool-arg/system-prompt declaration honors WITHOUT further wiring — documented + unit-tested"
  - "Hero set computed at persist time over the cumulative _previous_files_in_run (sandbox harvest already ran before persist) so the last execute_code cell's persisted result reflects the most-complete hero set for reload"
  - "url-less files render a clearly-disabled Download-unavailable affordance (dead state) rather than the old silent plain filename — closes the no-download-affordance dead-link root"
  - "Panel header relabeled Final outputs → Generated files (sketch §Output files area); data-testid=final-outputs-panel + the empty-state guard preserved"

patterns-established:
  - "A new additive field on a shared SSE event is byte-identical-safe when: event name unchanged, no field removed, no new return, frontend defaults missing→graceful"
  - "Presentation re-ranking flags must be provably divorced from the trust boundary (the re-sign endpoint diff is asserted empty)"

requirements-completed: [CHAT-04]

# Metrics
duration: 11min
completed: 2026-06-05
---

# Phase 095 Plan 05: Output-files hero/working split + D-08 hero tag Summary

**The file axis of the chat tool-card unification — one small additive backend tag (`is_hero` on `final_output_files` + the persisted `execute_code` result, agent-declared else a never-empty heuristic) and the frontend hero/working render (the deliverable heroed above a collapsible "Working files (N)" group, ALL files present + downloadable, url-less files now clearly disabled instead of silently dead) — the re-sign endpoint and the owner fence untouched.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-05T20:01:32Z
- **Completed:** 2026-06-05T20:12:18Z
- **Tasks:** 2 (Task 1 `type=auto tdd=true`; Task 2 `type=auto`)
- **Files created:** 1 (backend pytest)
- **Files modified:** 8

## Accomplishments

- **D-08 backend hero tag (Task 1).** Added a pure `_select_hero_filenames(files, user_message)` helper to `agent_loop.py`: the agent's declaration (an `is_hero`/`hero` flag already on a per-run meta dict) wins; ELSE the requested-extension match from `body.content` (docx/pptx/pdf/xlsx/csv/png/md); ELSE the single largest-size file (tie-break: highest `iteration` = last-written). NEVER empty when ≥1 file exists. Wired it into BOTH the `final_output_files` emit projection (additive `is_hero` + `url` guard `meta.get("url") or ""`) AND the persisted `execute_code` result's `output_files` entries (so api.ts reload reconstruction re-heroes next-day). The event name + the existing `filename`/`url`/`size` fields are unchanged; no new `return`; the re-sign endpoint (`sandbox_outputs.py`) is byte-for-byte untouched — the tag is presentation-only and never feeds the owner-fenced download path.
- **D-07 frontend hero/working split (Task 2).** `OutputFileCard` gained a `variant?: "hero" | "working"` prop (default `"working"` — every existing call site unchanged). Hero = the emphasized "★ Your file" block (primary glow border, gradient wash, larger `fileIcon`, prominent Download button); working = the quieter ghost-border row. BOTH use the SAME `fileIcon(filename)` (Plan 01 — one icon system). A new `FinalOutputsPanel` sub-component in `MessageItem` splits `finalOutputFiles` into `heroes` (the `is_hero` files, an emphasized block) ABOVE a collapsible "Working files (N)" group (visible by default). ALL files are present and downloadable — re-rank, never hide.
- **Dead-link affordance honesty.** A url-less file now renders a CLEARLY-DISABLED "Download unavailable" affordance (the sketch's `dl-btn.dead` state) instead of the old silent plain filename — closing RESEARCH dead-link root #1 (no silent dead anchor).
- **Graceful additive contract.** An older stream / a run with no hero → no file carries `is_hero` → ALL files render as working (no hero block, no crash). The `is_hero` field flows through `api.ts` (live dispatch + reload reconstruction) and `StreamsProvider` untouched as an extra key.
- **20 automated cases green** (13 backend pytest + 7 frontend finalOutputs); tsc=37 (documented baseline, zero net-new); vite build exit 0.

## Task Commits

1. **Task 1: D-08 backend hero tag — agent-marks + backend-fallback, url guard, persist** — `6814248c` (feat, TDD RED→GREEN)
2. **Task 2: D-07 frontend hero/working split + fileIcon + dead-state** — `d1e72436` (feat)

**Plan metadata:** (final commit — docs: complete plan)

## Files Created/Modified

- `backend/tests/test_095_final_output_tag.py` (NEW) — 13 cases: requested-ext match incl. leading-dot/uppercase + multi-file (a); largest fallback + size-tie→iteration + requested-but-no-match→largest (b); empty/None/"" no-crash (c); emit projection every-file-has-url (d); persist projection carries is_hero (e); agent-declared honored over heuristic incl. over a requested-ext match (f); never-zero-heroes-when-files-exist.
- `backend/app/services/agent_loop.py` — `_select_hero_filenames` helper (module-level, importable); `is_hero` + url guard on the `final_output_files` emit; `is_hero` on each persisted `execute_code` `output_files` entry.
- `frontend/src/types/index.ts` — additive `is_hero?` on `OutputFile` + the `finalOutputFiles` inline type.
- `frontend/src/lib/api.ts` — `is_hero` flows through `onFinalOutputFiles` dispatch (extra key, no dispatch change) + carried in `_mapMessageResponse` reload reconstruction (with `size`).
- `frontend/src/providers/StreamsProvider.tsx` — `onFinalOutputFiles` reducer signature widened (additive; never mutates `m.content`).
- `frontend/src/components/chat/OutputFileCard.tsx` — `variant` prop; `fileIcon` import + render; hero glow/gradient layout; url-less dead-state affordance; plain-text children (no `dangerouslySetInnerHTML`).
- `frontend/src/components/chat/MessageItem.tsx` — `FinalOutputsPanel` sub-component (hero/working grouping, collapsible working group, graceful no-hero); flat map removed; `data-testid` + empty-state guard preserved; panel relabeled "Generated files".
- `frontend/src/__tests__/components/MessageItem.finalOutputs.test.tsx` — +5 D-07 cases; the two empty-state cases switched to `queryByTestId` (more robust than the old label string).
- `frontend/src/__tests__/components/Plan04.frontend.test.tsx` — two stale "Final outputs" label assertions retargeted to "Generated files" / the testid (Rule 1).

## Decisions Made

- **`is_hero` (per-file bool), not a `hero_filenames` companion** — keeps the emit a single comprehension and makes each persisted `output_files` entry self-describing for reload.
- **Heuristic is the sole LIVE hero source; agent-declaration is forward-compatible.** The agent loop does not today record an explicit per-file "final deliverable" intent (sandbox harvest projects only `{filename,url,size,iteration}`), so the heuristic is live. The agent-declaration branch is built additive and unit-tested so the moment a future change stamps `is_hero`/`hero` onto a harvested meta dict, the helper honors it with zero further wiring. Documented inline.
- **Hero set computed at persist time over the cumulative `_previous_files_in_run`** (harvest runs inside `dispatch_tool` before persist) so the last `execute_code` cell's persisted result carries the most-complete hero set for next-day reload.
- **url-less → clearly-disabled dead affordance**, not the old silent plain filename — closes the primary dead-link root (no download affordance).
- **Panel relabel "Final outputs" → "Generated files"** per the sketch's `.outputs-label`; the `data-testid` and empty-state guard are preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retargeted two stale Plan04 label assertions**
- **Found during:** Task 2 (broader-test run)
- **Issue:** `Plan04.frontend.test.tsx` asserted `getByText("Final outputs")` and `queryByText("Final outputs")` — both broke when the panel header was relabeled to "Generated files" (a plan-mandated render change via the sketch).
- **Fix:** Updated the positive assertion to "Generated files"; switched the empty-state assertion to `queryByTestId("final-outputs-panel")` (more robust). Behavioral intent unchanged.
- **Files modified:** `frontend/src/__tests__/components/Plan04.frontend.test.tsx`
- **Commit:** `d1e72436`

### Implementation deviation (non-behavioral)

**DI-095-05-test-path [Rule 3]** — The plan's `files_modified` lists `frontend/__tests__/components/MessageItem.finalOutputs.test.tsx`, but that path does not exist; the real file lives at `frontend/src/__tests__/components/MessageItem.finalOutputs.test.tsx` (the same real-layout deviation documented in Plans 03 and 04). Extended the existing real file. No behavioral impact.

## Issues Encountered

- One full-suite failure surfaced in `Plan04.frontend.test.tsx` — the "Atom C — stdout/stderr terminal-output styling" case. **Proven pre-existing** by stashing this plan's 7 files and re-running in isolation (the same single case fails identically on the clean baseline; 1 failed / 7 skipped). It is unrelated to the output-files surface (it asserts ExecuteCodeBody terminal-line `emerald-400`/`red-400` styling). Logged to `deferred-items.md` as **DI-095-05-01**; not fixed (scope boundary). This plan's own two Plan04 final-outputs cases PASS.

## Deferred Issues

- **DI-095-05-01** (pre-existing Plan04 "Atom C" terminal-styling failure) — deferred to `deferred-items.md`. Part of the documented pre-existing ~17-failure full-suite cluster; not a regression.

## Known Stubs

- **None that block the plan goal.** The `_select_hero_filenames` agent-declaration branch (honoring an `is_hero`/`hero` flag already on a meta dict) has no live producer today — by design the heuristic is the live hero source, and the agent-declaration branch is an additive, unit-tested, forward-compatible hook (operator-resolved mechanism = "agent marks + backend fallback"; the fallback is wired and never empty, the marks hook is ready for a future declaration upgrade). This is documented inline in `agent_loop.py`, not a placeholder that blocks the deliverable.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change was introduced. The download path is unchanged (the re-sign endpoint diff is empty); the hero tag is presentation-only and never crosses the owner fence (T-095-05-01 mitigated by construction).

## Cross-provider / Byte-identical Verification

- **094 byte-identical Deep:** `grep -c "'final_output_files'" backend/app/services/agent_loop.py` == 1 (baseline — event NOT renamed, still emitted once at the post-loop site); the change is purely additive at the emit projection + the `execute_code` persist (no terminal-path / cursor-advance change). The tag is provider-agnostic (read off `body.content` + file sizes, no per-provider branch) → holds across all 6 native providers.
- **Re-sign endpoint untouched:** `git diff HEAD~2 HEAD --stat backend/app/api/sandbox_outputs.py` is empty across both commits (T-095-05-01).
- **PANEL-06 isolation:** `MessageItem` + `OutputFileCard` diffs add zero panel-store reads (no `todosByThread`/`tasksByThread`/`phasesByThread`/`workspaceFilesByThread`/`pendingAsksByThread`/`useTasks`/`usePhases`/`useTodos`) — the hero tag is read by the chat render only (T-095-05-05).
- **XSS:** `grep -c dangerouslySetInnerHTML` == 0 in both `OutputFileCard` and `MessageItem` — filenames render as React text children + via `fileIcon` (text-only) (T-095-05-03).

## Next Phase Readiness

- **Phase 095 implementation COMPLETE** — this was the LAST of the 5 plans (Waves 1–3 all shipped). All of D-01..D-08 are now wired across Plans 01 (primitives) / 02 (RunStatusStrip + timer + count) / 03 (sub-agent zero-dup + StepRail + Round-N) / 04 (follow-but-release scroll + JumpToLive) / 05 (this — hero/working files + hero tag).
- **NEXT: `/gsd:verify-work 095`** — owns the live Chrome-MCP lived-experience UAT (G-4 / SC#10 4-axis): the 4 operator scenarios incl. UAT #3 (ask for a .docx → it's the hero, one-click download, reopen next-day → still downloads) and UAT #1/#4 (long-run honesty + two-threads × 6-provider parity).

## Self-Check: PASSED

- Files: `backend/tests/test_095_final_output_tag.py` + the 8 modified files + this SUMMARY FOUND on disk.
- Commits: `6814248c` (Task 1) + `d1e72436` (Task 2) FOUND in git log.
- Tests: 13/13 backend pytest + 7/7 frontend finalOutputs green; tsc=37 baseline (0 net-new); vite build exit 0.
- Guards: `'final_output_files'`==1, sandbox_outputs.py diff empty, PANEL-06 held, dangerouslySetInnerHTML==0.

---
*Phase: 095-chat-tool-card-unification*
*Completed: 2026-06-05*
