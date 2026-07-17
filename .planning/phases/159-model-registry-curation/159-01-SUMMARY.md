---
phase: 159-model-registry-curation
plan: 01
subsystem: model-registry
tags: [python, regex, model-discovery, curation, dry, classification]

# Dependency graph
requires:
  - phase: 149-model-registry-discovery
    provides: model_discovery_service (async fan-out, compute_diff, _build_new_entry, the enabled=false / propose-only SC#3 contract)
  - phase: 096-eval-harness
    provides: scripts/curate_models.py (_MISSING_EXCLUDE — the proven exclude regex this plan lifts)
provides:
  - "UTILITY_MODEL_EXCLUDE — the ONE importable chat-filter regex (non-chat-utility core), tuned so valid chat models survive"
  - "is_utility_model(model_id) helper (null-safe, ReDoS-safe)"
  - "display-only `utility` bool on each discovered `new` entry (never gates the confirmable diff)"
  - "curate_models.py DRY'd to import the shared core (single source of truth; can't drift)"
affects: [159-06 ModelDiscoveryPanel filter toggle, 159-model-registry-curation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source classification constant shared across an app service and an offline script via a LOCAL import (keeps script --help fast)"
    - "Display-only metadata tag that rides only on `new` entries and never mutates the operator-confirmable diff (propose-not-mutate red line)"

key-files:
  created:
    - backend/tests/test_159_utility_filter.py
  modified:
    - backend/app/services/model_discovery_service.py
    - scripts/curate_models.py

key-decisions:
  - "Dropped the chat-legacy tokens (chatgpt|instruct|codex|davinci|babbage) from the shared UTILITY_MODEL_EXCLUDE so chatgpt-4o-latest and future chat families are never wrongly hidden (D-159-01)"
  - "Tag-not-drop: the `utility` flag is display metadata on `new` entries only; compute_diff's changed/vanished stay byte-identical (SC#3 red line held)"
  - "Shared home = model_discovery_service (co-located with the fan-out it filters); curate imports it LOCALLY inside diff_provider to preserve --help fastness"
  - "curate keeps _CHAT_LEGACY_EXCLUDE local for its own registry-gap flagging; only the non-chat-utility core is DRY'd (compose-locally)"

patterns-established:
  - "Shared regex constant + null-safe helper as the single source of truth; the offline curation script imports it rather than re-declaring"
  - "Display-only tag on discovery `new` entries — a downstream UI signal that leaves the confirmable diff untouched"

requirements-completed: [MODEL-03]

# Metrics
duration: 13min
completed: 2026-07-17
---

# Phase 159 Plan 01: Shared utility-model filter + display-only tag Summary

**Lifted the proven utility-exclude regex into ONE importable `UTILITY_MODEL_EXCLUDE` constant + `is_utility_model()` in the live discovery service (tuned so `chatgpt-4o-latest` survives), tagged each discovered `new` model with a display-only `utility` flag that never touches the confirmable diff, and DRY'd `curate_models.py` to the same source so the two can't drift.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-17T22:52:23Z
- **Completed:** 2026-07-17T23:05:40Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- **Shared, tuned filter (D-159-01):** `UTILITY_MODEL_EXCLUDE` + `is_utility_model()` live in `model_discovery_service`. The chat-legacy tokens that `curate_models._MISSING_EXCLUDE` carried (`chatgpt|instruct|codex|davinci|babbage`) are deliberately dropped from the chat-filter core, so valid chat models (`chatgpt-4o-latest`) are no longer hidden; the true non-chat-utility tokens (embed/whisper/tts/audio/realtime/image/dall-e/moderation/transcribe/rerank/search-preview/computer-use) are kept.
- **Display-only tag (SC#3):** each `new` diff entry now carries `"utility": is_utility_model(model_id)`. `compute_diff`'s `changed`/`vanished` builders are untouched — the diff the operator confirms is byte-identical to Phase 149 (proven by both the new invariant test and the still-green 149 discovery suite).
- **DRY'd curate (single source of truth):** `curate_models.py` imports the shared constant (locally, inside `diff_provider`, to keep `--help` fast) and composes it with a curate-local `_CHAT_LEGACY_EXCLUDE` for its own registry-gap flagging. Behavior preserved (functional proof) + a harmless `rerank` addition.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared UTILITY_MODEL_EXCLUDE + is_utility_model() + display-only `utility` tag** - `b15b2784` (feat)
2. **Task 2: DRY curate_models.py to the shared non-chat-utility core** - `26b137c0` (refactor)

**Plan metadata:** (this docs commit)

## Files Created/Modified
- `backend/app/services/model_discovery_service.py` - Added `import re`, the module-level `UTILITY_MODEL_EXCLUDE` regex + `is_utility_model()` helper (with a documented ReDoS-safety + chat-filter-tuning rationale), and the display-only `"utility"` key on `_build_new_entry`'s returned dict.
- `scripts/curate_models.py` - Replaced the local `_MISSING_EXCLUDE` literal with a curate-local `_CHAT_LEGACY_EXCLUDE` (chat-legacy tokens only) + a `_missing_excluded()` predicate in `diff_provider` that unions the LOCALLY-imported shared `UTILITY_MODEL_EXCLUDE` with the local set; both CURATE_MISSING/DEFAULT call sites re-pointed.
- `backend/tests/test_159_utility_filter.py` - New: classification assertions for the tuned True/False id sets, the `chatgpt-4o-latest` survives-the-filter proof, null-safety, the boolean `utility` tag on `_build_new_entry`, and the load-bearing invariant that `utility` rides only on `new` (never on `changed`/`vanished`).

## Decisions Made
- **Constant name = `UTILITY_MODEL_EXCLUDE`** (the plan's authoritative name), not the `CHAT_MODEL_EXCLUDE` placeholder used in 159-PATTERNS.md §1. The plan's `must_haves`, acceptance grep, and key-links all pin `UTILITY_MODEL_EXCLUDE`.
- **Compose-locally in curate:** only the non-chat-utility core is DRY'd; the chat-legacy tokens stay local because they serve curate's *registry-gap flagging* purpose, which is intentionally different from the chat-suitability filter (159-PATTERNS.md §3).
- **`rerank` now also excluded from curate's MISSING flagging** — a direct, intended consequence of the plan-prescribed union (the shared core adds `rerank`). This is more-correct behavior (rerank models were never valid CURATE_MISSING chat-family candidates); not a deviation.

## Deviations from Plan

None - plan executed exactly as written. (No Rule 1-4 deviations; no auto-fixes, missing-critical additions, blocking fixes, or architectural changes were required. The security posture matched the plan's stated invariant: pure display/read tag, no server write surface, ReDoS-safe regex.)

## Issues Encountered
- **Test-harness-only (not a code issue):** the initial ad-hoc behavior-preservation check called `curate_models.diff_provider` directly and failed on `Settings` validation, because importing the service triggers `app.config.settings` instantiation, which needs env vars. Root cause was my scratch harness bypassing `load_env()` — curate's real `main()` always calls `load_env()` before `diff_provider`, and `--help` exits before both (which is exactly why the local import keeps `--help` fast). Fixed the harness (added `load_env()`); the DRY code is correct. Confirmed: `gpt-5.9` → CURATE_MISSING; `gpt-4o-transcribe`/`gpt-4o-search-preview` (utility) + `gpt-4-instruct` (chat-legacy) all excluded.

## Verification

- `pytest tests/test_159_utility_filter.py tests/test_149_discovery.py` → **13 passed** (9 new + 4 existing 149 discovery — no regression; changed/vanished shape unchanged).
- `backend/venv/Scripts/python.exe scripts/curate_models.py --help` → **exit 0** (no provider keys / network needed; shared import never reached on the `--help` path).
- `grep -rn "UTILITY_MODEL_EXCLUDE = re.compile" backend scripts` → **exactly 1** definition (model_discovery_service.py:120).
- `grep "from app.services.model_discovery_service import" scripts/curate_models.py` → the shared import is present.

## User Setup Required
None - no external service configuration required. No migration, no env var, no schema change (pure display/read tag).

## Next Phase Readiness
- The `utility` tag is live on every discovery `new` entry — **Plan 06 (`ModelDiscoveryPanel`)** can now hide utility models by default and show an honest hidden-count, reading `m.utility` with zero backend changes. This is a correctly-scoped cross-plan handoff, not a stub: the read path (compute_diff → new entries) is fully wired; the UI consumer is Plan 06's scope.
- The shared `UTILITY_MODEL_EXCLUDE` is the single source of truth for any future surface that needs chat-suitability classification.
- No blockers.

## Self-Check: PASSED
- FOUND: `backend/tests/test_159_utility_filter.py`
- FOUND: `.planning/phases/159-model-registry-curation/159-01-SUMMARY.md`
- FOUND: commit `b15b2784` (Task 1, feat)
- FOUND: commit `26b137c0` (Task 2, refactor)

---
*Phase: 159-model-registry-curation*
*Completed: 2026-07-17*
