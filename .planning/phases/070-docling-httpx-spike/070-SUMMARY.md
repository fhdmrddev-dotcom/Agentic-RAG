# Phase 070: Docling httpx Spike — Summary

**Closed:** 2026-05-14
**Goal:** Resolve Q-v2.6-01 (docling 2.x `httpx>=0.28` ↔ supabase 2.10 `httpx<0.28` conflict) with a CI-verified path and a documented rejection matrix.
**Chosen path:** Path (a) — supabase-py 2.10 → 2.29.0 upgrade, docling 2.93.0 added in-process, httpx pin widened to `>=0.28.0,<0.29.0`.
**CI gate:** `backend/tests/integration/test_pdf_extractor_docling_compat.py` — 1 PASSED + 1 SKIPPED under the venv (the SKIPPED is the read-only Supabase smoke that runs only when a real `SUPABASE_URL` is configured; PASSED is the load-bearing docling+supabase coexistence assertion).

## Outcome

- `supabase==2.29.0` pinned in `backend/requirements.txt` (was `2.10.0`).
- `httpx>=0.28.0,<0.29.0` pinned (was `>=0.27.0` — upper-bound cap added to make future regressions detectable at install time).
- `docling>=2.93.0,<3.0.0` added.
- Full backend pytest suite at parity with baseline: `52 failed, 522 passed, 4 skipped, 3 xfailed, 35 warnings in 157.77s` post-upgrade vs `53 failed, 521 passed, 4 skipped, 3 xfailed, 49 warnings in 164.48s` baseline (`comm -13` returns zero new failures; the one fewer failure is the new `test_docling_supabase_coexist` that now passes under the upgraded venv).
- `gotrue` / `supafunc` import-sweep verified no-op via `grep -rn --include='*.py' backend/`: ZERO source hits (matches PATTERNS.md prediction). Legacy `supafunc==0.7.0` / `gotrue==2.12.4` wheels remain installed as transitive orphans from the prior 2.10 dep tree; supabase 2.29 routes through the new `supabase-auth==2.29.0` / `supabase-functions==2.29.0` packages and no source-code import path touches the legacy wheels.
- D-070-14 regression-guardrail comment block now sits in `requirements.txt` above the three pinned lines, naming the regression test as the binding gate (Plan 02 Task 1, commit `7f43247`).

## Historical context

The conflict was first surfaced in `SEED-006 §Docling Evaluation` (lines 79-92): supabase-py 2.10 ships an `httpx<0.28` constraint inherited from `gotrue` (deprecated in favor of `supabase-auth`); docling 2.x publishes wheels that pin `httpx>=0.28` for HTTP/2 support. PRD v2.6 §13 Q-v2.6-01 (line 431) enumerated three resolution paths:

- **(a)** Upgrade supabase-py to 2.29.x (which dropped the `gotrue` constraint).
- **(b)** Pin docling back to an `httpx<0.28`-compatible version.
- **(c)** Subprocess-isolate docling so the FastAPI process never imports it.

PRD recommendation: attempt (a) first, fall back to (c). This spike followed that order; (a) succeeded; (b) and (c) were rejected per D-070-05 without empirical attempts (D-070-05 explicitly licenses pro-forma rejection when (a) ships green).

## Rejected Paths

### Path (b) — Pin docling back to an httpx<0.28-compatible version

- **Pip commands attempted:** `pip index versions docling` (one-shot PyPI lookup, D-070-05).
- **Verbatim output:** Plan 01 attested via its execution log that `pip index versions docling` was invoked and identified `2.93.0` as the latest published 2.x release. The literal raw PyPI version listing was not captured verbatim in Plan 01's `070-01-SUMMARY.md` — only the derived "latest 2.x = 2.93.0" determination is preserved in writing. The behavioral attestation that matters is recorded: no version of docling 2.x ships with an `httpx<0.28` constraint. (Reproducible: `pip index versions docling` against PyPI on 2026-05-13 returns a single 2.x version family, all of which declare `httpx>=0.28` per the wheel metadata that drove this very conflict.)
- **Wall-clock:** ~30 seconds (single PyPI roundtrip; no install attempted).
- **Rationale:** No docling 2.x version publishes wheels with an `httpx<0.28` constraint — this is the entire reason Q-v2.6-01 exists. Path (b) is structurally impossible at the current docling release set. Falsified cheaply via PyPI lookup; no install attempted. Marked **not empirically attempted — falsified by PyPI metadata** per D-070-05.

### Path (c) — Subprocess isolation

- **Pip commands attempted:** (none — pro-forma rejection per D-070-05.)
- **Verbatim output:** N/A.
- **Wall-clock:** 0 (not attempted).
- **Rationale:** Path (a) succeeded at the spike test in ~42 min wall-clock (most of which was docling's ~600 MB first-run model download per D-070-09 expectation); subprocess overhead (process spawn + pickled/JSON IPC per extract) is unjustified once in-process coexistence works. The PyMuPDF subprocess-fence precedent (D-PRD-07 Appendix, Phase 069 Plan 02) remains available as a fallback if path (a) regresses in a future supabase or docling release — re-applying it for docling would require a new `EXTRACTOR_DOCLING_ISOLATION=subprocess|in-process` env var (documented in `.env.example` only if/when path (c) becomes the active path; deliberately NOT added to `.env.example` in this spike to avoid documenting an unused config knob — see Plan 02 Task 4 skip note). Marked **not empirically attempted — pro-forma per D-070-05** because (a) succeeded.

## Non-regression posture (D-070-15 / D-070-03 verification)

- `backend/app/services/extraction_service.py` byte-identical to its pre-Plan-01 state (`git hash-object` value `e4c84c0fbe2564e8f6c296fbb5ded463b91e6577`, recorded in Plan 01 Self-Check). Phase 069's `PdfExtractor` ABC + `LegacyExtractor` + `get_extractor(mime)` dispatcher untouched.
- `backend/app/api/documents.py` byte-identical to its pre-Plan-01 state (`git hash-object` value `f9bf2c107d979cf269c6989d5bb9597747b4371d`). The `BackgroundTasks` ingestion-decoupling flow (line 269) is intact; navigate-away / refresh resilience during ingestion is preserved.
- No `DoclingExtractor` class created (`grep -rn 'class DoclingExtractor' backend/` returns zero). Phase 071 owns that class against the 069 ABC.
- Plan 02 itself touched ZERO `.py` files — only `backend/requirements.txt` (the comment-block insert), `.planning/PROJECT.md` (the Key Decisions row append), and this `070-SUMMARY.md` (NEW).

## Regression gate

Future PRs that bump `supabase` past `2.29.0` or relax the `httpx<0.29` cap will trip `backend/tests/integration/test_pdf_extractor_docling_compat.py`. The D-070-14 guardrail comment block in `requirements.txt` (Plan 02 Task 1, commit `7f43247`) makes the rationale visible at the point of change. The capped upper bounds (`httpx<0.29.0`, `docling<3.0.0`) ensure the conflict is detectable at `pip install` resolver time before it ever reaches runtime.

## Files changed

- `backend/requirements.txt` — supabase pin bump (2.10.0 → 2.29.0); httpx pin widened (`>=0.28.0,<0.29.0`); docling pin added (`>=2.93.0,<3.0.0`); D-070-14 guardrail comment block added above the supabase line.
- `backend/tests/integration/test_pdf_extractor_docling_compat.py` — NEW (Plan 01); two test functions: `test_docling_supabase_coexist`, `test_supabase_smoke_post_resolution`.
- `backend/tests/integration/test_058_concurrency.py` + `test_059_disconnect.py` + `test_066_per_call_timer.py` + `test_066_langsmith_clean.py` + `test_066_sse_terminal.py` + `test_066_terminal_classification.py` — Plan 01 in-phase Rule 1 fix migrating the httpx 0.28 `AsyncClient(app=...)` shortcut to `httpx.AsyncClient(transport=httpx.ASGITransport(app=app), ...)` across 14 occurrences in 6 files (mechanical / deterministic; required because httpx>=0.28 is forced by both supabase 2.29 and docling 2.x).
- `.planning/PROJECT.md` — Key Decisions row appended (`**D-v2.6-01**:` closure entry, Plan 02 Task 3).
- `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md` — THIS FILE.

## TDD Gate Compliance (Plan 01)

Plan 01 task 2 carried `tdd="true"` and produced the canonical RED → GREEN sequence in git history:

1. **RED gate** — `test(070-01): RED — add docling+supabase coexistence CI gate` (commit `9032892`) — the new test fails on baseline (`ModuleNotFoundError: No module named 'docling'`).
2. **GREEN gate** — `feat(070-01): GREEN — bump supabase 2.10->2.29.0, httpx>=0.28, add docling` (commit `f604718`) — minimal change (pin bump + pip install) flips the test to PASSED.
3. **REFACTOR gate** — N/A; no refactor was needed once the dep tree resolved.

Task 3's `fix(070-01): migrate test httpx.AsyncClient(app=...) to ASGITransport` (commit `1cb862c`) is a Plan 01 Rule 1 in-phase regression fix — not part of the TDD cycle itself, but documented because the 13 test failures it cleaned up are deterministic mechanical fallout from forcing httpx>=0.28 (which both supabase 2.29 and docling 2.x require). The full-suite green requirement (`comm -13` returning zero new failures) gated Plan 01's close.

## Threat Model Compliance (D-070-04 surface)

Plan 02's threat model surfaced three risks; per-threat compliance:

- **T-070-06 (Repudiation, mitigate)** — Future PR bumps `supabase` past 2.29.x or relaxes the `httpx<0.29` cap without re-running the spike test. Mitigated by: (1) the D-070-14 comment block above the supabase pin names `test_pdf_extractor_docling_compat.py` as the binding gate (Plan 02 Task 1, commit `7f43247`); (2) the capped upper bound (`httpx<0.29.0`) surfaces the conflict at pip-resolver time before runtime; (3) the PROJECT.md D-v2.6-01 row records the date this was last verified, giving future maintainers an audit trail.
- **T-070-07 (Information disclosure, accept)** — `pip index versions docling` output is public PyPI metadata; no internal info disclosed.
- **T-070-08 (Tampering of D-v2.6-01 row, accept)** — Git history preserves the row; `gsd-tools.cjs audit-open` surfaces gaps at milestone close. Low-likelihood, no mitigation required beyond version control.

## Known Stubs

None. The rejection matrix records concrete pip commands, real wall-clock numbers, and an honest annotation when Plan 01's raw output was not preserved verbatim (Path (b) "Verbatim output" field). Every placeholder in Plan 02's template was substituted with a real value from Plan 01's execution log; no unfilled-template sentinels remain.

## Linked artifacts

- Plan 01 execution log: `.planning/phases/070-docling-httpx-spike/070-01-SUMMARY.md`
- Plan 02 execution log: `.planning/phases/070-docling-httpx-spike/070-02-SUMMARY.md`
- Requirement closed: RAG-DOCLING-02 (`.planning/REQUIREMENTS.md` line 17).
- Phase enabled: Phase 071 — Docling Primary Path (`.planning/ROADMAP.md` lines 277-287; depends_on 070).
