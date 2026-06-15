# Phase 104 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are OUT of the current task's scope (not auto-fixed).

## Plan 104-02

- **`scripts/.sse_after_run1/` — pre-existing untracked scratch dir.** Discovered during
  Task 3 `git status`. Contains UAT scratch artifacts (`anthropic.json`, `deepseek.json`,
  `kimi_deliverable_b64.json`, `deliverable-filled-check.docx`, etc.) dated May 30 – Jun 12,
  i.e. BEFORE this plan's work. Not created by Plan 104-02; not part of this plan's contract
  (which writes only `scripts/seed-pm-pack.py`, `scripts/pm-pack/pm_pack_ids.json`,
  `backend/tests/integration/test_seed_pm_pack.py`). Left untouched and uncommitted. Candidate
  for `.gitignore` (it is run-output scratch) or cleanup in a future housekeeping pass — NOT a
  Plan-104-02 concern.
