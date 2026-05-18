---
phase: 074-seed-009-seed-011-polish-bundle
plan: 01
subsystem: api
tags: [model-capabilities, max-tokens, anthropic, openai, openrouter, gemini, registry, clamp, polish, tdd]

# Dependency graph
requires:
  - phase: 066
    provides: ModelCapability TypedDict + llm_call_timeout_seconds field + MODEL_CAPABILITIES registry shape
  - phase: 067.5
    provides: cycle-5 UAT evidence of claude-haiku-4-5-20251001 400-ing on max_tokens=65536 (the SEED-009 bug case being closed here)
provides:
  - ModelCapability.max_output_tokens optional field (TypedDict extension)
  - 29 of 32 MODEL_CAPABILITIES entries populated with verified-2026-05-18 hard caps
  - _resolve_max_tokens refactored to single-return shape with bottom-of-function clamp gate
  - :exacto OpenRouter routing suffix strip pattern (.removesuffix() — not generic split)
  - identifier-only clamp log format mirroring Phase 073 T-073-04 precedent
  - 5 unit tests (7 cases) covering boundary + passthrough + suffix-handling
affects: [077, 078, 079, future-anthropic-snapshots, openrouter-quality-routing, sub-agent-paths]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-return clamp gate over priority-resolution function (covers all branches, no per-return inserts)"
    - "Targeted .removesuffix(':exacto') for routing-suffix strip (NOT generic split — preserves :free as model-card)"
    - "Identifier-only log format: 'event for model=%s: %d -> %d' (model_id from public registry + ints from vendor docs; zero token-content leak)"
    - "Optional TypedDict field via total=False — partial entries pass-through at lookup site"

key-files:
  created:
    - "backend/tests/unit/test_resolve_max_tokens.py — 5 tests / 7 parametrized cases for the clamp gate (RED→GREEN TDD)"
  modified:
    - "backend/app/config.py — ModelCapability TypedDict + 29 populated entries + comment block"
    - "backend/app/services/openai_service.py — _resolve_max_tokens single-return refactor + clamp gate + logger + MODEL_CAPABILITIES import"

key-decisions:
  - "D-074-06 enacted — max_output_tokens added as optional ModelCapability field"
  - "D-074-01 enacted — single-return refactor over per-return clamp inserts (covers Pitfall 1)"
  - "D-074-02 enacted — pass-through when registry entry missing OR max_output_tokens key absent (no log)"
  - "OQ2 resolution: .removesuffix(':exacto') NOT generic split — keeps :free model card working"
  - "Rule-1 deviation honored — claude-opus-4-7 / claude-opus-4-6 = 128000 (live docs 2026-05-18), NOT 32000 (SEED-009 older number)"
  - "3 entries intentionally OMIT max_output_tokens (gemini-3-flash-preview, gemini-3.1-pro-preview, minimax/minimax-01) per RESEARCH.md OQ1/A3/A5"

patterns-established:
  - "Clamp-gate pattern: refactor priority resolver to single-return + bottom-of-function ceiling check (reusable for context-budget clamp / timeout clamp / future per-model caps)"
  - "Routing-suffix strip pattern: model_id.removesuffix(':SUFFIX') if model_id.endswith(':SUFFIX') else model_id (preserves base IDs that legitimately contain colons)"
  - "Identifier-only log breadcrumb: '%s' for registry keys + '%d' for vendor-doc integers; zero content-leak by construction"

requirements-completed: [POLISH-SEED-009-01]

# Metrics
duration: ~15min (Tasks 1+2 code-complete; Task 3 awaiting Live UAT checkpoint)
completed: 2026-05-18
---

# Phase 074 Plan 01: SEED-009 Max-Tokens Clamp Summary

**Per-model max_output_tokens registry + single-chokepoint clamp gate in `_resolve_max_tokens` — `claude-haiku-4-5-20251001` 400 on `max_tokens > 64000` structurally eliminated; protection extends to every provider (Anthropic / OpenAI / Google / OpenRouter / Ollama) via the universal resolver, zero call-site changes.**

## Performance

- **Duration:** ~15 min (Tasks 1+2 code path; Task 3 paused at checkpoint pending Live UAT)
- **Started:** 2026-05-18T14:05:55Z (per STATE.md)
- **Tasks 1+2 completed (static gates green):** 2026-05-18T~14:21Z
- **Task 3 status:** awaiting checkpoint:human-verify (Live UAT)
- **Tasks committed:** 3 of 3 code-complete commits (Tasks 1+2); Task 3 is UAT-only, no files
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **`ModelCapability` TypedDict extended** with optional `max_output_tokens: int` field (Phase 074 D-074-06). `total=False` posture preserved — partial entries still legal.
- **29 of 32 `MODEL_CAPABILITIES` entries populated** with hard API caps verified live against each provider's docs on 2026-05-18. Rule-1 deviation from SEED-009 captured: Opus 4.7 / 4.6 = 128000 (live docs), NOT 32000 (seed's older number).
- **3 entries intentionally OMIT `max_output_tokens`** per RESEARCH.md OQ1 / A3 / A5: `gemini-3-flash-preview`, `gemini-3.1-pro-preview` (no published vendor cap as of 2026-05-18), `minimax/minimax-01` (legacy/discontinued ID). Pass-through preferred over guessed placeholder.
- **`_resolve_max_tokens` refactored from 6-early-return to single-return shape** — every priority branch (explicit value, user override, env override, per-model env, per-model default, provider default, fallback) now flows through a single bottom-of-function clamp gate. Closes RESEARCH.md Pitfall 1 ("resolution returns mid-flow, skipping clamp").
- **`:exacto` OpenRouter quality-routing suffix stripped** via `.removesuffix(":exacto")` before registry lookup. `:free` is a legitimate upstream model card suffix (e.g., `minimax/minimax-m2.5:free` has its own registry entry at cap=16384) and is NOT stripped — a generic `split(":")[0]` would have silently lost protection for the `:free` tier.
- **Identifier-only clamp log line** `clamped max_tokens for model=%s: %d -> %d` emits exactly once when the clamp fires. Format mirrors Phase 073 T-073-04 precedent at `threads.py:2719-2722` (identifier `%s` + ints `%d`; zero token-content leak by construction per T-074-02).
- **7 unit-test cases (5 logical tests, 3 parametrized boundary cases) all GREEN** — RED gate confirmed pre-implementation, GREEN gate confirmed post-implementation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ModelCapability TypedDict + populate max_output_tokens on all entries** — `655953a` (feat)
2. **Task 2 (RED): Add failing test for _resolve_max_tokens clamp gate** — `9627cef` (test)
3. **Task 2 (GREEN): Clamp _resolve_max_tokens against per-model hard cap** — `a0cd985` (feat)
4. **Task 3: Live UAT — haiku-4-5 over-cap request reaches `runs.status='completed'`** — pending `checkpoint:human-verify` (no commit; UAT is runtime-only)

_TDD note: Task 2 ships as two commits (RED test + GREEN implementation) per the `tdd="true"` task contract._

## Files Created/Modified

- **`backend/app/config.py`** (modified) — `ModelCapability` TypedDict gained optional `max_output_tokens: int`; comment block above `MODEL_CAPABILITIES` documents Phase 074 D-074-06 + verification protocol; 29 entries populated, 3 intentionally omitted. Diff: +52 / −32.
- **`backend/app/services/openai_service.py`** (modified) — added `import logging` + `logger = logging.getLogger(__name__)`; extended `from app.config import ...` with `MODEL_CAPABILITIES`; `_resolve_max_tokens` refactored to single-return shape with bottom-of-function clamp gate + `:exacto` strip. Diff: +67 / −27.
- **`backend/tests/unit/test_resolve_max_tokens.py`** (created — 117 lines) — 5 tests / 7 parametrized cases covering boundary (under / at / over haiku-4-5's 64k cap), unknown-model passthrough, known-model-missing-field passthrough, `:exacto` strip, and `:free` non-strip.

## Decisions Made

- **D-074-01 implementation shape:** Single-return refactor over per-return clamp inserts. Rationale: the resolver had 6 early returns; inserting clamp logic at each would have meant 6 duplicate gates and a high regression risk if any future branch was added without remembering to clamp. Single-return forces every code path through one chokepoint.
- **D-074-02 missing-field semantics:** Pass-through (not log, not clamp) when registry entry exists but `max_output_tokens` is absent. Rationale: the 3 omitted entries (gemini-3.x preview, minimax-01) have no published vendor cap — clamping to a guessed value would be more dangerous than passing the resolver's output unchanged.
- **OQ2 strip technique:** `.removesuffix(":exacto")` not generic `:` split. Rationale: `minimax/minimax-m2.5:free` is a real upstream model card whose `:free` suffix is part of the registry key — stripping it would route lookup to a nonexistent `minimax/minimax-m2.5` and silently lose clamp protection for the `:free` tier.
- **Logger added to `openai_service.py`:** No `logging` import existed pre-plan; clamp gate needs `logger.info`. Added `import logging` + module-scope `logger = logging.getLogger(__name__)` (Rule 3 — auto-fix blocking issue; clamp code would NameError at runtime without it).

## Deviations from Plan

Three minor deviations, all in scope and documented:

### Auto-fixed / Notes

**1. [Rule 3 - Blocking] Added `import logging` + module-scope `logger` to `openai_service.py`**
- **Found during:** Task 2 (clamp gate implementation)
- **Issue:** Plan's clamp gate calls `logger.info(...)` but `openai_service.py` had no `logger` symbol pre-edit (no `import logging` either). Clamp code would `NameError` at first execution.
- **Fix:** Added `import logging` at top of imports + `logger = logging.getLogger(__name__)` right after the `from app.config import ...` line (standard Python module pattern; mirrors `backend/app/config.py:7`).
- **Files modified:** `backend/app/services/openai_service.py` (part of the Task 2 commit `a0cd985`)
- **Verification:** All 7 tests pass; `caplog.records` correctly receives the INFO line under `logger="app.services.openai_service"`.

**2. [Note] Registry entry count discrepancy (plan text vs. file reality)**
- **Plan text said:** "26 entries" / "23 populated + 3 omitted"
- **File reality:** `MODEL_CAPABILITIES` had 32 entries pre-edit (the plan's literal Step 3 replacement actually lists 32 entries when counted line-by-line, including o1/o3/o4 + all the OpenAI 5.x models). Post-edit: 32 entries, 29 populated + 3 intentionally omitted.
- **Action:** Honored the plan's explicit Step 3 literal replacement (which IS 32 entries) rather than the descriptive "26 entries" text. Acceptance criterion `grep -c "max_output_tokens" >= 25` still passes (returns 41 — 1 TypedDict line + 1 comment block mention + 29 entry lines + ~10 explanatory comments).
- **Files:** `backend/app/config.py` (Task 1 commit `655953a`)
- **No behavior impact:** The 6 extra entries (o1, o3, o4 + 3 OpenAI 5.x extras) were always in the file; plan author appears to have counted from an older snapshot. Verified deliverables match the plan's literal Step 3 table verbatim.

**3. [Note] `removesuffix(":exacto")` grep count is 2, not the plan's expected 1**
- **Plan acceptance criterion said:** `grep -c 'removesuffix(":exacto")' ... returns 1`
- **Actual result:** Returns 2 — the literal appears once in the code (`lookup_key = model_id.removesuffix(...)` at L719) AND once in the explanatory comment block above it (the "Targeted `.removesuffix(":exacto")` keeps both paths working" sentence in the docstring/comment).
- **Action:** No code change — the comment is intentional documentation for maintainers explaining why this is NOT a generic split. Spirit of the acceptance criterion (defensive strip implemented) is satisfied; the literal count is off-by-one because the criterion did not anticipate the helpful comment.
- **Files:** `backend/app/services/openai_service.py` (Task 2 commit `a0cd985`)

---

**Total deviations:** 1 Rule-3 auto-fix (`logger` import) + 2 documentation-only notes
**Impact on plan:** All deviations preserve plan intent. The `logger` import is required for the clamp gate to function. The two count discrepancies are documentation drift, not behavior drift.

## Issues Encountered

None. RED→GREEN TDD cycle clean. Plan's interfaces block and Patterns A/B were accurate to the file state, which made the refactor low-friction.

## Live UAT (Task 3) — Awaiting Checkpoint

**Status:** `checkpoint:human-verify` — pending operator drive

**Pre-flight already complete:**
- All static gates green (5 logical tests / 7 parametrized cases pass via `cd backend && venv/Scripts/python -m pytest tests/unit/test_resolve_max_tokens.py -q` → `7 passed`)
- Sanity check confirms: `MODEL_CAPABILITIES['claude-haiku-4-5-20251001']['max_output_tokens'] == 64000`
- `MODEL_CAPABILITIES['claude-opus-4-7']['max_output_tokens'] == 128000` (Rule-1 deviation locked)
- `'max_output_tokens' not in MODEL_CAPABILITIES['gemini-3-flash-preview']` (intentional omission verified)

**UAT protocol** (full version in PLAN.md `<how-to-verify>`):
1. Stop running uvicorn; add `MODEL_OUTPUT_LIMITS=claude-haiku-4-5-20251001=65536` to `backend/.env`
2. Restart uvicorn (`cd backend && venv/Scripts/python -m uvicorn app.main:app --reload --workers 1`)
3. Drive a long-output prompt against `claude-haiku-4-5-20251001` in the chat UI at `http://localhost:5173/`
4. Expect: backend stdout emits `INFO ... clamped max_tokens for model=claude-haiku-4-5-20251001: 65536 -> 64000`
5. Expect: chat completes; Supabase `runs` row shows `status='completed'`, `error IS NULL`, `model='claude-haiku-4-5-20251001'`
6. Remove the env override; restart uvicorn; smoke-test nominal request

**Resume signal:** Operator types `approved` after confirming all 3 success markers (log line present + `runs.status='completed'` + no 400 errors in backend logs).

## Threat Model Compliance

Plan's `<threat_model>` requested mitigation for `T-074-01` (Tampering — operator-set env above vendor cap). **Mitigation in place:** `_resolve_max_tokens` returns `min(resolved, MODEL_CAPABILITIES[model]["max_output_tokens"])` regardless of env override; vendor cap wins. Tested at `test_clamp_haiku_4_5[65536-64000-True]`. `T-074-02..04` accepted (no code-level mitigation needed — already covered by identifier-only log format and out-of-band re-verification protocol documented in RESEARCH.md Pitfall 5).

## Next Phase Readiness

**Code-complete for Plan 074-01.** Sibling Plan 074-02 (SEED-011 test_059 fixture cleanup) executes in parallel on its own worktree. Both plans land independently before the orchestrator's `/gsd:verify-work` pass for Phase 074.

**Awaiting:**
- Task 3 Live UAT operator drive (orchestrator owns scheduling)

**No blockers** for downstream phases. The clamp gate is transparent to every existing call site — Anthropic dispatcher at `threads.py:1419` and `create_adaptive_streaming_chat` at `openai_service.py:801` are byte-identical post-edit (`git diff backend/app/api/threads.py | wc -l` → 0).

## Self-Check: PASSED

**Files verified to exist:**
- `backend/app/config.py` — FOUND (modified)
- `backend/app/services/openai_service.py` — FOUND (modified)
- `backend/tests/unit/test_resolve_max_tokens.py` — FOUND (created)

**Commits verified to exist:**
- `655953a` — FOUND (Task 1: config registry extension)
- `9627cef` — FOUND (Task 2 RED: failing test)
- `a0cd985` — FOUND (Task 2 GREEN: clamp implementation)

**Plan-level verification block:**
- pytest 7/7 GREEN
- Imports load cleanly (`from app.config import MODEL_CAPABILITIES; from app.services.openai_service import _resolve_max_tokens`)
- Sanity caps surface correctly (haiku=64000, opus-4-7=128000, preview-omitted=False)

---

*Phase: 074-seed-009-seed-011-polish-bundle*
*Plan: 01 (SEED-009 max-tokens clamp)*
*Completed: 2026-05-18 (Tasks 1+2 code-complete; Task 3 awaiting Live UAT checkpoint)*
