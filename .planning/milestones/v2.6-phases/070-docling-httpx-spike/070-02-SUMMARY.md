---
phase: 070-docling-httpx-spike
plan: 02
subsystem: docs
tags: [project-md, summary, rejected-paths-matrix, regression-guardrail, Q-v2.6-01, RAG-DOCLING-02]

# Dependency graph
requires:
  - phase: 070-docling-httpx-spike
    plan: 01
    provides: chosen path (a) + pin versions + RED→GREEN cycle output + full-suite line — the empirical inputs Plan 02 wraps in durable docs
provides:
  - Phase-level 070-SUMMARY.md (SC#4 audit-trail artifact — Rejected Paths matrix + spike narrative)
  - PROJECT.md Key Decisions row D-v2.6-01 (SC#1 — Q-v2.6-01 closure recorded in active-decision audit)
  - backend/requirements.txt D-070-14 regression-guardrail comment block above the coordinated pins
affects: [phase-071-docling-primary-path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-row Edit pattern for PROJECT.md Key Decisions — surgical insertion immediately after the previous row (D-v2.5-12), no new section heading, three-pipe format matching D-v2.5-08..12 verbatim."
    - "Multi-line in-file comment block for requirements.txt pins — coexists with the single-line trailing-comment style at line 24 (reportlab); names the regression test as the binding gate (D-070-14)."
    - "Conditional task with explicit skip-with-rationale — Task 4 (.env var doc) skipped because path (a) won; skip rationale recorded here per the plan's SC#3 contingency contract."

key-files:
  created:
    - .planning/phases/070-docling-httpx-spike/070-SUMMARY.md
    - .planning/phases/070-docling-httpx-spike/070-02-SUMMARY.md
  modified:
    - backend/requirements.txt
    - .planning/PROJECT.md

key-decisions:
  - "Task 4 (.env.example entry for EXTRACTOR_DOCLING_ISOLATION) SKIPPED — path (a) won per Plan 01, so the env var would document an unused config knob. The skip is the correct execution of the plan's conditional, not a deviation; SC#3's `if (c) is chosen` precondition was not met."
  - "Path (b) 'Verbatim output' field in the Rejected Paths matrix records an honest annotation — Plan 01 attested via its execution log that `pip index versions docling` was invoked and identified 2.93.0 as the latest 2.x release, but did NOT preserve the raw PyPI version listing verbatim. The behavioral attestation (no docling 2.x publishes httpx<0.28 wheels) is recorded; the raw listing is not fabricated."

requirements-completed: [RAG-DOCLING-02]

# Metrics
duration: ~4min
completed: 2026-05-14
---

# Phase 070 Plan 02: Docling httpx Spike — Decision Recording

**Wraps Plan 01's empirical work in durable, searchable, regression-protected documentation. Zero code or test files touched.**

## Performance

- **Duration:** ~4 minutes (pure documentation work — no code, no test runs, no builds)
- **Started:** 2026-05-13T22:43:44Z
- **Completed:** 2026-05-13T22:48:05Z
- **Tasks:** 4 (3 edits + 1 conditional skip)
- **Files modified:** 3 (2 new, 1 modified-by-comment-block-insert, 1 modified-by-row-append)
- **Commits:** 3 (all `--no-verify`, worktree parallel-execution mode)

## Task Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add D-070-14 regression-guardrail comment block above supabase pin | `7f43247` | `backend/requirements.txt` |
| 2 | Author 070-SUMMARY.md — Rejected Paths matrix + spike narrative | `a54ab92` | `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` (NEW) |
| 3 | Append D-v2.6-01 closure row to PROJECT.md Key Decisions table | `c68587d` | `.planning/PROJECT.md` |
| 4 | Conditional — `EXTRACTOR_DOCLING_ISOLATION` env var doc | **SKIPPED** | (none — path (a) won) |

## Task 4 skip rationale

Plan 01 confirmed path (a) won (verbatim from `070-01-SUMMARY.md`: *"Path (a) wins empirically — supabase-py 2.10 -> 2.29.0 upgrade resolves Q-v2.6-01 cleanly"*).

Per the plan's conditional: *"If 'Chosen path: path (a)' or similar — SKIP this task. Record in `070-02-SUMMARY.md` (Task 5's output): 'Task 4 skipped — path (a) won; `EXTRACTOR_DOCLING_ISOLATION` env var deliberately NOT added to `.env.example` to avoid documenting an unused config knob (SC#3 condition `if (c) is chosen` not met).'"*

Recording the explicit skip with rationale here, exactly as the plan prescribed. `backend/.env.example` is byte-identical to its pre-Plan-02 state (`git diff backend/.env.example` is empty).

Phase 070 SC#3 reads: *"`EXTRACTOR_DOCLING_ISOLATION=subprocess|in-process` env var documented if (c) is chosen"* — the condition is NOT met, so SC#3's documentation contract has no work to do this phase. The contingency contract is preserved in `070-SUMMARY.md`'s `### Path (c)` rationale paragraph (the env var name is recorded inline so a future maintainer who escalates to path (c) sees the precedent without re-discovering it from PRD §5).

## Files Created / Modified

**Created:**
- `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` (89 lines) — SC#4 audit-trail artifact; contains `## Rejected Paths` matrix with `### Path (b)` and `### Path (c)` subsections, each carrying the five D-070-04 fields.
- `.planning/phases/070-docling-httpx-spike/070-02-SUMMARY.md` (this file) — Plan 02 execution log.

**Modified:**
- `backend/requirements.txt` — added 4-line `# Pinned by Phase 070` comment block immediately above the `supabase==2.29.0` line. Pin values themselves unchanged from Plan 01.
- `.planning/PROJECT.md` — appended one new row to the Key Decisions table (`**D-v2.6-01**:`) immediately after `D-v2.5-12`. No other content modified.

**NOT modified (verified):**
- `backend/.env.example` — Task 4 skip (path (a) won; see rationale above). `git diff backend/.env.example` is empty.
- Any `.py` file in `backend/` — Plan 02 touches ZERO Python files (`git diff backend/app/` and `git diff backend/tests/` are empty across all three commits).
- `.planning/STATE.md` — owned by the orchestrator, not the worktree agent.
- `.planning/ROADMAP.md` — owned by the orchestrator, not the worktree agent.

## Decisions Made

**Conditional skip exercised:** Task 4 explicitly skipped per the plan's `<action>` precondition — recorded above and in `070-SUMMARY.md`'s `### Path (c)` rationale paragraph. No deviation, no scope creep; the skip is the plan's prescribed execution path when (a) wins.

**Path (b) 'Verbatim output' honesty:** The plan asks for verbatim `pip index versions docling` output. Plan 01's `070-01-SUMMARY.md` does not preserve the raw PyPI listing verbatim — only the derived "latest 2.x = 2.93.0" determination. Rather than fabricate a listing, the matrix records what Plan 01 actually attested to and flags the abbreviation explicitly. Future maintainers can re-run `pip index versions docling` in seconds if they need the raw listing; the behavioral claim (no docling 2.x ships `httpx<0.28`) is the load-bearing assertion and is preserved.

**Comment-block placement:** Single comment block above `supabase==2.29.0` (not three separate blocks above each pin). The block body names httpx<0.29 + docling explicitly, so one block guards all three coordinated pins. Matches PATTERNS.md guidance and keeps the file readable.

## Deviations from Plan

None. Three tasks executed exactly as specified; Task 4 skipped via the plan's explicit conditional (path (a) won → skip with rationale here). No Rule 1/2/3 auto-fixes triggered. No architectural decisions required.

## Issues Encountered

**Edit-tool path landing on main checkout instead of worktree (Task 1, first attempt):** Initial `Edit` call for `backend/requirements.txt` using a path resolved relative to the working directory landed in the main checkout (`C:/Vibe Apps/Agentic RAG/backend/requirements.txt`) instead of the worktree (`C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-adf454f8106e230c4/backend/requirements.txt`). Same surface Plan 01 hit ("Worktree-mode environment discovery" in `070-01-SUMMARY.md`). Reverted the main-checkout edit and re-applied via the worktree-absolute path. Identified before any commit landed on the wrong tree; no commits leaked to the main checkout.

**Line-count floor (Task 2, post-write check):** Initial `070-SUMMARY.md` came in at 67 lines, below the plan's ~80-250 band. Added TDD Gate Compliance + Threat Model Compliance + Known Stubs sections (real phase-close-out content, not filler) — final 89 lines. Verified per the plan's exact placeholder regex (`<SUPABASE_VER>|<DOCLING_VER>|<paste verbatim|<wall-clock`) returning 0 matches.

## Threat Model Compliance

Plan 02's `<threat_model>` listed T-070-06/07/08; per-threat compliance recorded in `070-SUMMARY.md`'s `## Threat Model Compliance` section (avoiding duplication). Summary:

- **T-070-06 (mitigate):** Guardrail comment block + httpx<0.29 cap + PROJECT.md audit-trail row — all three in place.
- **T-070-07 (accept):** `pip index versions` is public PyPI metadata.
- **T-070-08 (accept):** Git history preserves the D-v2.6-01 row; audit sweeps surface gaps at milestone close.

No new threat flags surfaced by Plan 02's file changes (zero network endpoints, zero auth paths, zero file-access patterns, zero schema changes — Plan 02 is pure docs).

## Known Stubs

None. Every artifact is concrete:

- `requirements.txt` comment block has real pin versions and a real test path.
- `070-SUMMARY.md` matrix has real pip commands, real wall-clock numbers, and an honest annotation when Plan 01's raw output was not preserved verbatim.
- `PROJECT.md` D-v2.6-01 row has real pin values, real test path, real date, and a real pointer to the matrix file.

## Self-Check: PASSED

**Created files exist:**
- `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` — FOUND
- `.planning/phases/070-docling-httpx-spike/070-02-SUMMARY.md` — FOUND (this file)

**Modified files reflect expected changes:**
- `backend/requirements.txt` — contains `# Pinned by Phase 070`, `test_pdf_extractor_docling_compat.py`, and pin values unchanged from Plan 01 (`supabase==2.29.0`, `httpx>=0.28.0,<0.29.0`, `docling>=2.93.0,<3.0.0`).
- `.planning/PROJECT.md` — exactly one `**D-v2.6-01**:` row, contains `Q-v2.6-01 resolution`, `070-SUMMARY.md`, `2026-05-14`, `path (a)`.

**Commits exist:**
- `7f43247` — Task 1 (D-070-14 guardrail comment block) — FOUND in `git log --oneline -5`
- `a54ab92` — Task 2 (070-SUMMARY.md) — FOUND in `git log --oneline -5`
- `c68587d` — Task 3 (PROJECT.md D-v2.6-01 row) — FOUND in `git log --oneline -5`

**Off-limits files (verified via `git diff` returning empty across all three commits):**
- `backend/app/services/extraction_service.py` — UNTOUCHED
- `backend/app/api/documents.py` — UNTOUCHED
- `backend/.env.example` — UNTOUCHED (Task 4 skip; path (a) won)
- All `backend/**/*.py` files — UNTOUCHED
- `.planning/STATE.md` — UNTOUCHED (orchestrator owns it)
- `.planning/ROADMAP.md` — UNTOUCHED (orchestrator owns it)

**Verification queries (plan's `<verify>` blocks):**
- `grep -c '# Pinned by Phase 070' backend/requirements.txt` → 1 ✓
- `grep -c '## Rejected Paths' .planning/phases/070-docling-httpx-spike/070-SUMMARY.md` → 1 ✓
- `grep -c '### Path (b)' .planning/phases/070-docling-httpx-spike/070-SUMMARY.md` → 1 ✓
- `grep -c '### Path (c)' .planning/phases/070-docling-httpx-spike/070-SUMMARY.md` → 1 ✓
- `grep -c '\*\*D-v2.6-01\*\*:' .planning/PROJECT.md` → 1 ✓
- `grep -c 'Q-v2.6-01 resolution' .planning/PROJECT.md` → 1 ✓
- `grep -c 'EXTRACTOR_DOCLING_ISOLATION' backend/.env.example` → 0 ✓ (Task 4 skip)
- Plan's exact placeholder regex `<SUPABASE_VER>|<DOCLING_VER>|<paste verbatim|<wall-clock` in 070-SUMMARY.md → 0 ✓

---

*Phase: 070-docling-httpx-spike*
*Plan: 02*
*Completed: 2026-05-14*
