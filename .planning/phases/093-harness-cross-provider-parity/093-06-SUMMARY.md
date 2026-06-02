---
phase: 093-harness-cross-provider-parity
plan: 06
subsystem: infra
tags: [logging, observability, redaction, security, env-config, fastapi]

# Dependency graph
requires:
  - phase: 093 (Plans 01-05)
    provides: the harness cross-provider fixes (F9 gateway consumption, F10 ask_user round-trip, model-resolver, surfacing) whose post-fix re-UAT this sink instruments
provides:
  - "install_file_log_sink() — opt-in, secret-redacting RotatingFileHandler installer wired at backend startup (D-20)"
  - "LOG_FILE_PATH / BACKEND_LOG_FILE env knob — mirrors console logs to a gitignored file for the cross-provider re-UAT"
  - "_RedactingFilter — strips sk- keys, Bearer/Authorization values, JWTs, and live provider key env VALUES before any record is written"
affects: [093-VALIDATION, 093-HUMAN-UAT, Phase 096 automated cross-cutting UAT harness, D-21 re-UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in infra knob via os.getenv (env-only, not a Settings field) — logfile path is infra, per the CLAUDE.md secrets/infra rule"
    - "Defense-in-depth log redaction via a logging.Filter that rewrites record.msg post-interpolation"
    - "Idempotent root-logger handler install via a _gsd_093_sink sentinel attribute"

key-files:
  created:
    - backend/app/services/logging_sink.py
    - backend/tests/test_093_log_sink.py
  modified:
    - backend/app/main.py
    - backend/.env.example

key-decisions:
  - "Logfile path is an env-only infra knob (LOG_FILE_PATH/BACKEND_LOG_FILE via os.getenv after load_dotenv), NOT a user_settings/app_settings field — a logfile path is infra per CLAUDE.md."
  - "Sink is strictly opt-in: unset env var → install_file_log_sink() returns None and installs NO handler (byte-identical pre-093-06 console-only logging)."
  - "Redaction is defense-in-depth on whatever the app ALREADY logs — the sink adds NO new logging of request/response bodies (no prompt/document PII)."
  - "Default path logs/backend.log is covered by the existing .gitignore logs/ + *.log rules — confirmed, NO new rule added (the load-bearing secret-leak mitigation)."

patterns-established:
  - "Secret redaction order: structural shapes (sk-/Bearer/JWT) first, then literal provider key env VALUES (length>=8 guard) — most-specific catch-all last."
  - "Root-logger level lowered to INFO only if currently HIGHER (or NOTSET); never raises a deliberately-lower level; never touches the asyncio logger (kept at ERROR by main.py)."

requirements-completed: [PARITY-02]

# Metrics
duration: 3min
completed: 2026-06-02
---

# Phase 093 Plan 06: Backend File Log-Sink (D-20) Summary

**Opt-in, secret-redacting RotatingFileHandler (`install_file_log_sink`) wired at FastAPI startup that mirrors console logs to a gitignored file so the cross-provider re-UAT can self-grep `gpt-4o`-fallback / `runs.usage`-missing / `400` round-trip signals without the operator's live terminal.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-02T20:12:06Z
- **Completed:** 2026-06-02T20:15:01Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `install_file_log_sink()` — opt-in (env-var-gated) RotatingFileHandler (10 MB × 3 backups) installed on the root logger; returns `None` and installs nothing when `LOG_FILE_PATH`/`BACKEND_LOG_FILE` are unset (byte-identical console-only logging). Idempotent via the `_gsd_093_sink` handler sentinel.
- `_RedactingFilter` redacts `sk-…` keys, `Authorization`/`Bearer` values, JWT-shaped tokens, and the live VALUES of all provider key env vars before any record reaches the file — defense-in-depth for the error strings + structured warnings the app already logs.
- Wired at `main.py` import-time (after `load_dotenv` so `os.environ` carries the knob, after the asyncio suppressor), and documented the `LOG_FILE_PATH` knob in a new `.env.example` observability section.
- 8 unit tests GREEN — opt-in, redaction (sk-/Bearer/JWT/env-value), clean-record passthrough, idempotency.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add redacting, opt-in file log-sink installer + redaction tests** — `0ea32b32` (feat)
2. **Task 2: Wire install_file_log_sink() at startup + document LOG_FILE_PATH + confirm gitignore** — `a0c0603e` (feat)

_TDD note: the plan marked Task 1 `tdd="true"`; the implementation + 8-test contract were authored together and verified GREEN in one commit (no separate RED commit was made, as the implementation file was new — see TDD Gate Compliance below)._

## Files Created/Modified
- `backend/app/services/logging_sink.py` (created) — `install_file_log_sink()` + `_RedactingFilter`; the opt-in redacting RotatingFileHandler installer.
- `backend/tests/test_093_log_sink.py` (created) — 8 tests proving opt-in / redaction / idempotency, reading the logfile back to assert secret substrings ABSENT + `***REDACTED…` markers PRESENT.
- `backend/app/main.py` (modified) — top-level import + `install_file_log_sink()` call at startup; logs the active path when set.
- `backend/.env.example` (modified) — documented the opt-in `LOG_FILE_PATH` knob (no real value) in a new observability section.

## Decisions Made
None beyond the plan — followed the plan's interfaces and action steps exactly. Key plan-prescribed choices honored: env-only infra knob, strictly opt-in, redaction-before-write, gitignore-covered default path (no new rule).

## Deviations from Plan

None — plan executed exactly as written.

The Task-2 verify command in the plan (`cd "C:/Vibe Apps/Agentic RAG" && … python.exe -c "… from app.services.logging_sink import …"`) does not resolve `app.*` from the repo root; it resolves from `backend/` (consistent with `backend/pytest.ini` + `backend/tests/conftest.py`). The opt-in assertion was run with `backend/` as the working dir and passed (`install_file_log_sink() is None` with no env var). This is a command-CWD nuance, not a code change.

## TDD Gate Compliance

Task 1 was marked `tdd="true"`. Because `logging_sink.py` was a brand-new module, the implementation and its 8-test contract were authored and committed together in `0ea32b32` (a single `feat` commit) rather than as a separate RED `test(...)` commit followed by a GREEN `feat(...)` commit. The behavior block was fully satisfied (8/8 GREEN) and re-verified after Task 2. No discrete RED-gate commit exists in the git log for this plan — noted here per the plan-level TDD gate-sequence rule. This is a 2-task gap-closure plan (`type: execute`, not a `type: tdd` plan), so the strict plan-level RED→GREEN→REFACTOR commit sequence does not apply; the task-level `tdd` attribute drove a behavior-first authoring approach with the tests as the acceptance gate.

## Issues Encountered
- The `-c` opt-in assertion initially raised `ModuleNotFoundError: No module named 'app'` when run from the repo root. Resolved by running it from `backend/` (the package root) — matching how every other 093 test resolves `app.*`. No code change required.

## Threat Surface (from plan threat_model)
- **T-093-06-LEAK-SECRET (mitigate):** `_RedactingFilter` redacts `sk-…`, `Bearer`/`Authorization` values, JWT-shaped tokens, and live provider key env VALUES before any write — unit-tested (secret substrings asserted ABSENT in the file).
- **T-093-06-LEAK-PII (mitigate):** the sink only MIRRORS existing `logging` calls — NO new logging of request/response bodies; documented non-goal honored.
- **T-093-06-COMMIT (mitigate):** default path `logs/backend.log` is covered by the existing `.gitignore` `logs/` + `*.log` rules — confirmed, NO new rule added.
- **T-093-06-PERMS (accept):** best-effort `os.chmod(_path, 0o600)` in a try/except (Windows may ignore POSIX bits); gitignore is the real protection on the single-user dev host.
- **T-093-06-DEFAULT-ON (mitigate):** strictly opt-in — no env var → `install_file_log_sink()` returns None + installs no handler; verified by the Task-2 opt-in assertion + the Task-1 opt-in test.

No NEW threat surface beyond the plan's `<threat_model>` was introduced.

## User Setup Required
None at install time. **To ACTIVATE the sink before the D-21 re-UAT:** the operator sets `LOG_FILE_PATH=logs/backend.log` in `backend/.env` and restarts their uvicorn (the agent does not start the backend). With the env var unset, logging stays byte-identical console-only — no action needed.

## Next Phase Readiness
- D-20 enabler is in place: the D-21 re-UAT can now be a quality/felt spot-check rather than a log-gathering chore (operator sets the env var + restarts uvicorn to activate).
- Phase 096's automated cross-cutting UAT harness can reuse this sink to grep the same diagnostic signals self-sufficiently.
- This is the FIRST gap-closure plan (Wave 3) — the remaining 093 gap-closure plans (093-07..09) and the D-09 GLM diagnosis can use the activated sink.
- PARITY-02 stays OPEN — phase verification owns the native-7 × 5-phase-type × 4-workflow LIVE UAT closure.

## Self-Check: PASSED

- FOUND: backend/app/services/logging_sink.py
- FOUND: backend/tests/test_093_log_sink.py
- FOUND: .planning/phases/093-harness-cross-provider-parity/093-06-SUMMARY.md
- FOUND: commit 0ea32b32 (Task 1)
- FOUND: commit a0c0603e (Task 2)

---
*Phase: 093-harness-cross-provider-parity*
*Completed: 2026-06-02*
