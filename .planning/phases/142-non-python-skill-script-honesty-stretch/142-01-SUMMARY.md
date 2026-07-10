---
phase: 142-non-python-skill-script-honesty-stretch
plan: 01
subsystem: api
tags: [sandbox, tool-dispatcher, skills, honesty, classifier, pure-function]

# Dependency graph
requires:
  - phase: 120-collision-fix-context-isolation
    provides: off the COLL-01 injection seam (honesty-only, no shared-path fork)
provides:
  - "_classify_runtime_gap(code, stdout, stderr, exit_code) -> hit | None — the pure runtime-gap classifier covering G-A/G-B/G-C"
  - "module-level fixed allowlists: KNOWN_MISSING_BINARIES, KNOWN_MISSING_MODULES, NOT_FOUND_PHRASES, JS_TOKENS, SCRIPT_EXTS"
  - "authored GAP_MESSAGES + GAP_MESSAGES_JS + GAP_MESSAGES_MISSING_FILE (permanent-framed honest wording)"
  - "test_142_runtime_gap.py — G-A/G-B/G-C hit coverage + the mandatory T-142-01 pass-through negative"
affects: [142-02 (reactive reshape + repeat-guard consumes classifier), 142-03 (SCRIPT_EXTS decode + load_skill flag), 142-05 (SCRIPT_EXTS import note)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure bounded string-matcher with a FIXED allowlist + safe-default-on-non-match (mirrors _safe_out_filename)"
    - "Single-source module-level constants imported by sibling plans (no duplication of allowlists/wording)"

key-files:
  created:
    - backend/tests/unit/test_142_runtime_gap.py
  modified:
    - backend/app/services/tool_dispatcher.py

key-decisions:
  - "Binary-token search is location-aware: a not-found-phrase hit requires the token in OUTPUT (stdout/stderr); the 124/127-exit hit also scans `code` (a hung/killed binary leaves its name only in the executed code). Tightens threat T-142-01 beyond the literal spec without changing any test outcome."
  - "G-A only fires on a RELATIVE subdir path (contains '/', not starting '/'); any absolute path — including /sandbox/output/*.csv — passes through, protecting genuine missing-user-file errors."
  - "G-B token is the matched JS marker (e.g. 'const '); message is the class-level GAP_MESSAGES_JS."

patterns-established:
  - "Pattern: isolate the single correctness-critical piece (the classifier) into one pure, exhaustively-tested helper BEFORE any control-flow change (Plan 02) consumes it."

requirements-completed: [SRH-01]

# Metrics
duration: 4min
completed: 2026-07-08
---

# Phase 142 Plan 01: Runtime-Gap Detection Substrate Summary

**Pure `_classify_runtime_gap` helper + fixed KNOWN_MISSING allowlists + authored permanent-framed GAP_MESSAGES in tool_dispatcher.py — decides WHETHER a sandbox failure is a G-A/G-B/G-C runtime gap and WHICH honest message to surface, while never suppressing a real error (T-142-01).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-08T00:29:17Z
- **Completed:** 2026-07-08T00:33:45Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Added the single correctness-critical piece of Phase 142 — a bounded, pure classifier that returns a `{class, token, message}` hit for the three known runtime gaps (missing bundled file / non-Python script / missing binary or module) or `None` for everything else.
- Encoded the phase's design law (threat T-142-01) directly in code + tests: a hit ALWAYS requires a fixed-allowlist token (or a JS-token+SyntaxError combination, or a relative-subdir missing path) — never error-type or exit-code alone. The mandatory `test_non_gap_passthrough` proves a genuine ValueError, a missing `/sandbox/output/*.csv`, a real Python SyntaxError, and a bare non-zero exit all pass through unchanged.
- Single-sourced the allowlists (`KNOWN_MISSING_BINARIES/_MODULES`, `NOT_FOUND_PHRASES`, `JS_TOKENS`, `SCRIPT_EXTS`) and the authored `GAP_MESSAGES` wording at module scope so Plans 02/03/05 import them (no duplication, bounded key-space → threat T-142-04).
- Zero runtime behavior change: nothing calls the classifier yet (Plan 02 wires it in), and no capability file was touched (D-02 — `sandbox_service.py` / `Dockerfile.sandbox` byte-identical).

## Task Commits

Each task was committed atomically (Task 2 is TDD: RED test → GREEN feat):

1. **Task 1: Classifier test scaffold (RED)** - `44f46d26` (test)
2. **Task 2: Constants + GAP_MESSAGES + _classify_runtime_gap (GREEN)** - `56f73fcc` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP/REQUIREMENTS) — see final docs commit.

## Files Created/Modified
- `backend/tests/unit/test_142_runtime_gap.py` - G-A/G-B/G-C hit tests (each asserting class + token + the exact `GAP_MESSAGES[...]` string), allowlist single-source sanity, and the mandatory `test_non_gap_passthrough` (T-142-01) negative.
- `backend/app/services/tool_dispatcher.py` - Added module-level `KNOWN_MISSING_BINARIES/_MODULES`, `NOT_FOUND_PHRASES`, `JS_TOKENS`, `SCRIPT_EXTS`, authored `GAP_MESSAGES` / `GAP_MESSAGES_JS` / `GAP_MESSAGES_MISSING_FILE`, two precompiled extractor regexes, and the pure `_classify_runtime_gap` helper — co-located with `_safe_out_filename` (~:1909) whose "distrust a string, match a fixed set, safe default" posture it mirrors.

## Decisions Made
- **Location-aware binary matching (tightens, never loosens, the spec):** the not-found-phrase branch requires the binary token in OUTPUT (stdout/stderr), while the 124/127-exit branch additionally scans `code`. Rationale: a genuine Python error carrying a coincidental binary name as a *variable* in `code` (e.g. `node`) plus an unrelated `FileNotFoundError` will NOT false-hit, because exit-1 Python failures never carry 124/127 and the token isn't in the output. Exit 124 (our wall-clock abort) and 127 (shell command-not-found) only arise from a shell/timeout path, so scanning `code` there is safe. All plan tests pass unchanged.
- **G-A is relative-subdir-only:** a hit requires `'/' in path and not path.startswith('/')`. This is stricter than the literal spec ("not starting `/sandbox/output/`") and guarantees any absolute path — including a genuine missing user output file — passes through. Safest interpretation that satisfies every listed pass-through case.

## Deviations from Plan

None - plan executed exactly as written. The two decisions above are implementation-level precision choices within the plan's stated `<behavior>` and design law; they change no test outcome and add no scope.

## Issues Encountered
None. The Windows venv (`venv/Scripts/python`) ran the suite cleanly; the only warning is the pre-existing unrelated `urllib3`/`chardet` version-mismatch `RequestsDependencyWarning`.

## User Setup Required
None - no external service configuration required (no migration, no Docker rebuild, no new dependency — honesty-only, D-02).

## Next Phase Readiness
- Plan 02 can wire `_classify_runtime_gap` into the completed-run result builder (`tool_dispatcher.py:~1249-1267`) and the per-run repeat-guard (`dead_gap_tokens_in_run` set threaded from `agent_loop.py`) — all constants and the classifier are importable and independently covered.
- Plans 03/05 can import `SCRIPT_EXTS` (decode whitelist + load_skill flag / import note) from the single source added here.
- No blockers. Byte-identical runtime confirmed (classifier is dead code until Plan 02); existing `test_tool_dispatcher.py` stays green (15/15).

## Self-Check: PASSED
- `backend/tests/unit/test_142_runtime_gap.py` — FOUND
- Commit `44f46d26` (test) — FOUND
- Commit `56f73fcc` (feat) — FOUND
- `def _classify_runtime_gap` in `tool_dispatcher.py` — FOUND
- Verification: `test_142_runtime_gap.py` 8/8 GREEN; `test_tool_dispatcher.py` 15/15 GREEN; `git diff --stat` shows `sandbox_service.py` / `Dockerfile.sandbox` untouched (D-02).

---
*Phase: 142-non-python-skill-script-honesty-stretch*
*Completed: 2026-07-08*
