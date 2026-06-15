---
phase: 095-chat-tool-card-unification
plan: 09
subsystem: api
tags: [agent-loop, sandbox, output-files, hero-selection, sse, cross-provider, gap-closure]

# Dependency graph
requires:
  - phase: 095-chat-tool-card-unification (Plan 05)
    provides: "_select_hero_filenames helper + the final_output_files emit + per-cell execute_code persist of is_hero (D-08 backend hero tag)"
provides:
  - "Single-hero invariant: _select_hero_filenames returns EXACTLY ONE filename on every branch (declared / requested-ext / fallback)"
  - "One canonical _hero_set computed once over the COMPLETE run file set, shared by the live emit AND the post-loop re-stamp of persisted execute_code rows → live == reload"
  - "Token-based requested-ext detection (re.findall whole-token match) replacing the raw-substring match (defense-in-depth)"
affects: [095-verification, chat-output-files-render, OutputFileCard, FinalOutputsPanel, api.ts-reload-reconstruction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single source of truth for hero selection: compute the hero set ONCE over the complete set at loop end, then re-stamp persisted rows in place (no per-cell partial computation)"
    - "Shared _hero_pick tie-break (max size, then iteration) applied identically across every selection branch so the hero is deterministic wherever it is computed"

key-files:
  created: []
  modified:
    - backend/app/services/agent_loop.py
    - backend/tests/test_095_final_output_tag.py

key-decisions:
  - "Per-cell execute_code persist stamps is_hero=False as a placeholder (NOT a partial per-cell hero set), then the loop-end re-stamps all persisted rows against the canonical complete-set _hero_set — guarantees live == reload on multi-cell runs"
  - "Every branch of _select_hero_filenames collapses to exactly one hero via the shared _hero_pick tie-break (closes GAP-095-02 / WR-02)"
  - "Token match (re.findall '[a-z0-9]+') for requested-ext detection is forward hardening, not the symptom cause — the symptom cause was the multi-hero return fixed in Task 1"

patterns-established:
  - "Loop-end re-stamp: mutate persisted_tool_calls result JSON in place against the canonical set, guarded against truncated/non-JSON fallback results"

requirements-completed: [CHAT-04]

# Metrics
duration: 6min
completed: 2026-06-06
---

# Phase 095 Plan 09: Single-Hero Backend Fix (GAP-095-02 / WR-02) Summary

**`_select_hero_filenames` now returns exactly ONE hero on every branch, and the live `final_output_files` emit + the persisted `execute_code` rows share one canonical `_hero_set` computed over the complete run set — so a multi-cell run heroes the same single file live and on next-day reload.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-06T07:37:15Z
- **Completed:** 2026-06-06T07:43:32Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- **GAP-095-02 / WR-02 closed (over-selection):** the requested-extension branch picked EVERY file of a requested ext as a hero (a multi-element set). It now collects the matching metas and picks the single largest (tie-break highest iteration) via the shared `_hero_pick`. The declared branch likewise collapses any multi-declaration to one. Every branch returns a set of length exactly 1 when files exist.
- **WR-02 closed (live vs reload divergence):** the per-cell `execute_code` persist used to compute the hero over a PARTIAL cumulative file list at each cell, while the loop-end emit computed over the COMPLETE set — so a multi-cell run heroed a different file on reload. Now the per-cell persist stamps an `is_hero=False` placeholder and the loop-end re-stamps every persisted `execute_code` row against the one canonical `_hero_set`. Live emit and persisted reload now agree byte-for-byte.
- **Defense-in-depth hardening:** requested-ext detection switched from a raw substring match (`ext in msg`) to a whole-token match (`re.findall(r"[a-z0-9]+", msg)`), so a substring embedded in a longer word can no longer spuriously flag a requested ext. `.pptx` still tokenizes to `pptx`.
- **Presentation-only / cross-provider safe:** the `final_output_files` event name is unchanged (`grep -c == 1`); `sandbox_outputs.py` (the owner-fenced re-sign download path) is byte-identical (git diff empty); the `is_hero` flag never feeds the download path; the change is a pure provider-free helper at two shared sites. No schema, no migration.

## Task Commits

Each task was committed atomically (sequential, normal commits WITH hooks):

1. **Task 1: Single-hero requested-ext branch + update the multi-hero test** - `70271dab` (fix, TDD RED→GREEN)
2. **Task 2: One canonical hero set for emit + persist (live == reload)** - `a2979082` (fix)
3. **Task 3: Tokenize ext-detection (defense-in-depth hardening)** - `91167254` (fix)

## Files Created/Modified
- `backend/app/services/agent_loop.py` — added `_hero_pick` shared tie-break; rewrote `_select_hero_filenames` so all 3 branches return exactly one hero; removed the per-cell PARTIAL hero computation (stamps `is_hero=False` placeholder); added the loop-end re-stamp of persisted `execute_code` rows against the canonical `_hero_set`; tokenized requested-ext detection; added `import re`.
- `backend/tests/test_095_final_output_tag.py` — retargeted the multi-hero test to a single hero (`{"b.docx"}`); added size-tie/iteration-tie, multi-declared-collapse, multi-cell live==reload consistency, graceful-skip-non-json, substring-no-trigger, and trailing-punctuation cases; added `len(...) == 1` assertions on the requested/declared/fallback paths; added `import json`.

## Decisions Made
- **Placeholder-then-restamp over a deferred shape:** the per-cell persist keeps the same row shape (so api.ts reload reconstruction is unaffected) but stamps `is_hero=False`; the single re-stamp at loop end is the only place the real decision lands. This is the preferred backend single-source-of-truth path from the plan (no frontend re-derivation, `api.ts` untouched).
- **Mutate `persisted_tool_calls` in place:** the re-stamp mutates the same dict objects that `_persist_assistant_message` later reads (call-time read at line ~1174), so the persisted message row carries the canonical `is_hero` with no extra plumbing. Verified the re-stamp runs (~line 2165) before `_persist_assistant_message` is invoked (~line 2332/2440).
- **`_hero_pick` extracted as a named helper** so the tie-break (max size, then iteration) is literally identical across the declared, requested-ext, and fallback branches — a future edit to one branch cannot silently fork the tie-break.

## Deviations from Plan

None - plan executed exactly as written. (Task 1 followed the TDD RED→GREEN flow: the 3 new single-hero assertions failed against the old multi-hero helper, then passed after the helper rewrite.)

## Issues Encountered
- The `&&`-chained grep verification stopped early once because `grep -c` returns a non-zero exit code on a zero count (expected for the "old multi-hero assertion" grep). Re-ran the affected greps separately — all success-criteria greps pass.

## User Setup Required
None - no external service configuration required. No schema change, no migration. The backend is not started by this executor; verification is via pytest only.

## Next Phase Readiness
- This is the LAST plan of Phase 095. The gap-closure work (095-06..09) is structurally complete.
- `test_095_final_output_tag.py`: **19/19 GREEN**. All 5 agent_loop-importing test files (095-final-output / 089-seam / 075.5-google-native / 075.4-registry-sweep / continue): **61/61 GREEN** — zero net-new failures.
- All success-criteria greps pass: `final_output_files` == 1; `sandbox_outputs.py` diff empty; single-hero `_hero_pick(matched_metas)` == 1; `_hero_set` == 5 (computed once, shared by re-stamp + emit); old multi-hero assertion == 0; token match `re.findall` == 3.
- **NEXT:** `/gsd:verify-work 095` — owns the live Chrome-MCP lived-experience UAT (the operator's single-hero / live==reload acceptance: ask for a .docx → exactly one hero, one-click download, reopen next-day → still the same single hero).

## Known Stubs
None. (No hardcoded empty values, no placeholder text, no unwired data source. The `is_hero=False` per-cell value is a documented intentional placeholder that is overwritten by the loop-end re-stamp before persistence, not a stub.)

## Threat Flags
None — no new network endpoint, auth path, file-access pattern, or schema change introduced. The two trust boundaries in the plan's threat model (hero-flag→download-path, hostile-filename→ext-detection) are mitigated: `sandbox_outputs.py` is byte-identical (`is_hero` never feeds the re-sign download path), and the token match bounds what counts as a requested ext.

## Self-Check: PASSED

- FOUND: `backend/app/services/agent_loop.py`
- FOUND: `backend/tests/test_095_final_output_tag.py`
- FOUND: `.planning/phases/095-chat-tool-card-unification/095-09-SUMMARY.md`
- FOUND commit: `70271dab` (Task 1)
- FOUND commit: `a2979082` (Task 2)
- FOUND commit: `91167254` (Task 3)

---
*Phase: 095-chat-tool-card-unification*
*Completed: 2026-06-06*
