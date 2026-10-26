---
seed_id: SEED-363
title: Any TestClient test that enters the real app lifespan runs the boot resume sweep against the shared local DB and can claim a live or stranded run
created: 2026-10-19
surface: Agentic-RAG
status: answered
partial: false
status_note: "ANSWERED by Phase 296 (296-02, 2026-10-26): app.main.RUN_BOOT_SWEEPS gates the boot resume sweep AND the periodic reconciler; tests/conftest.py sets it False for every test lifespan. RED test_296_lifespan_no_sweeps.py (4 red) then GREEN 6d51f603b. Earlier note, kept: Measured twice more in Phase 295 (295-07, 2026-10-21). (1) The two historical stuck runs 51924c91 / a77ed2c0 were ended cancelled at 2026-10-20 23:22:22Z, before the 295-04 merge, with the signature of 295-04's new reconciler sweep and no line in the :8000 log: a test process in the 295-04 worktree booted the lifespan against the local DB. (2) 295-07's own tests/unit gate, started ~00:38:40Z, re-drove a live run (6ec2f298) at 00:40:08Z: a second phase_started and a model=unknown resume shell. Any worktree run of tests/unit while live runs exist can terminalize or re-drive them. 295-VALIDATION.md S7."
trigger_when: "The next phase touching backend/app/main.py's lifespan, the resume sweep (resume_stranded_workflows) or the run reconciler; or the next time a live drive and a backend test suite share the local DB."
trigger_paths: ["backend/app/main.py", "backend/tests/conftest.py", "backend/app/services/run_reconciler.py"]
trigger_surfaces: ["harness", "workflow"]
migration_note:
relates_to: [".planning/phases/289-the-run-page-and-its-evidence/289-01-SUMMARY.md", ".planning/phases/289-the-run-page-and-its-evidence/289-03-SUMMARY.md", ".planning/phases/289-the-run-page-and-its-evidence/289-VALIDATION.md (Shared-DB hazard)"]
folded_into: "296"
renumbered_from: null
renumbered_because: null
---

# SEED-363: a backend test can steal a live run

## Measured three times in Phase 289

1. **289-01 (D-11 attempt 1):** a parallel worktree's `TestClient` test booted the real lifespan, whose
   `resume_stranded_workflows` sweep claimed a LIVE run owned by the `:8000` backend and tried to
   re-drive it inside the test process (`llm_human_input: prompt row insert failed run=56a21b60-…`).
   The `:8000` answer then logged `re-drive skipped, run … already claimed`.
2. **289-03:** a read-only probe found 2 resumable runs the sweep would claim; the suites were run
   with a process-local pytest plugin that no-ops `resume_stranded_workflows` and
   `reconcile_orphaned_runs`.
3. **289-05:** one run of `tests/test_288_waiting_on.py` without that plugin claimed the two stranded
   runs `a77ed2c0-…` and `51924c91-…` (`claimed_at` moved), died with `InterfaceError: pool is closing`
   at test shutdown, and wrote two `system` messages on an unrelated old thread.

## Why it matters

The `client` fixture is used across `backend/tests/` (test_188, test_288, test_182, …). Any developer
running those suites while a run is paused or streaming on the local stack can have that run claimed
by a process that is about to exit. CI is unaffected (no shared live runs), which is why it stays hidden.

## What would close it

Make the test lifespan skip the run-claiming sweeps (a settings flag the conftest sets, or the
fixture patching them), so it is not left to a per-session plugin. The plugin used in 289 (two
`async def _noop` assignments in `pytest_configure`) is the whole change in miniature.
