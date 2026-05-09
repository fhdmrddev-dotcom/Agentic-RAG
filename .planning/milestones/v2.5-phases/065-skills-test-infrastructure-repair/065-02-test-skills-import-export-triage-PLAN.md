---
phase: 065-skills-test-infrastructure-repair
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/tests/integration/test_skills_import_export.py
autonomous: true
requirements: [TEST-DEBT-059]
must_haves:
  truths:
    - "Pytest run of test_skills_import_export.py reports 0 errors and 0 unexpected failures"
    - "The 3 failing export tests (identified by running pytest first) are EITHER fixed (if the fault is purely test-side: stale mock setup, drifted assertion shape, missing helper) OR explicitly marked `@pytest.mark.skip(reason=\"...\")` with a written justification pointing to the production-code root cause"
    - "Production code in `app/api/skills.py`, `app/services/skill_service.py`, and the storage layer is NOT modified — this phase is test-only per ROADMAP risk note 369 and SEED-002 scope guard"
    - "Any skip-with-reason explicitly references the known MIME fidelity gap (`project_skills_mime_known_gap`) OR another concrete production bug that is in scope for the Skill Studio milestone, not this maintenance phase"
    - "058 + 059 binding gates remain green"
  artifacts:
    - path: backend/tests/integration/test_skills_import_export.py
      provides: "Test file with all 15 tests passing or documented as skipped"
      contains: "TestExportSkill"
      min_lines: 300
    - path: .planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md
      provides: "Triage record of which 3 tests failed, root cause per test, and disposition (fix vs skip)"
      contains: "## Failing Tests Triaged"
  key_links:
    - from: "Skip-with-reason annotations"
      to: ".planning/seeds/SEED-002-skill-studio-milestone-prep.md (item #2 — MIME fidelity)"
      via: "documented justification text"
      pattern: "MIME fidelity|skill_files_mime_known_gap|Skill Studio milestone"
---

<objective>
Triage and repair `backend/tests/integration/test_skills_import_export.py` so the file's pytest run is green. The ROADMAP says "3 currently-failing export tests" exist in this file (out of 15 total tests across `TestExportSkill`, `TestImportSkill`, and bulk-import classes). The exact failing-test names are not pre-identified — Task 1 of this plan IS the discovery step.

For each of the 3 failures, choose ONE disposition per ROADMAP risk note 369 and SEED-002 scope guard:
  - **Fix** if the fault is purely on the test side (stale mock setup, drifted assertion shape, missing helper, mismatched `mock_builder.execute.side_effect` ordering after a recent threads.py change, etc.). No production code touched.
  - **Skip-with-reason** (`@pytest.mark.skip(reason="...")`) if the root cause is in production code AND the production fix belongs to a future milestone (Skill Studio per SEED-002 — particularly the known MIME fidelity gap where `import_skill` stores all files as `application/octet-stream` regardless of source MIME).

What this plan EXPLICITLY does NOT do:
  - Fix the MIME fidelity gap in `app/api/skills.py` import path. That production change is in the Skill Studio milestone scope per SEED-002.
  - Redesign the Skills tab.
  - Extend eval-test infrastructure.
  - Fix bugs unrelated to the 3 failing tests (e.g., touching working tests "while we're here").

Purpose: Restore the green test foundation for the export/import surface so Skill Studio's eval-tests can extend the same pattern without inheriting a red baseline.

Output: Repaired test file (assertion/mock fixes for purely-test-side failures) + skip annotations (for production-rooted failures) + SUMMARY.md with the triage table + a single atomic commit.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/seeds/SEED-002-skill-studio-milestone-prep.md
@C:/Vibe Apps/Agentic RAG/CLAUDE.md
@C:/Vibe Apps/Agentic RAG/backend/tests/integration/test_skills_import_export.py

<interfaces>
<!-- Test file structure (already explored at planning time — do NOT re-explore). -->

The file has 15 test methods across 4 classes (340 lines):

**TestExportSkill** (5 tests, lines 82-170):
- test_export_returns_zip — line 83
- test_export_skill_md_content — line 96
- test_export_file_subdirs — line 126
- test_export_not_owner_returns_404 — line 149
- test_export_no_files — line 157

**TestImportSkill** (7 tests, lines 172-285):
- test_import_creates_skill — line 173
- test_import_with_files — line 192
- test_import_path_traversal_rejected — line 215
- test_import_absolute_path_rejected — line 230
- test_import_invalid_zip — line 251
- test_import_no_skill_md — line 260
- test_import_invalid_yaml — line 271

**TestBulkImport** (2 tests, lines 286-329):
- test_bulk_import_partial_failure — line 286
- test_bulk_import_all_success — line 309

**TestImportSizeLimit** (1 test, line 330):
- test_import_size_limit — line 330

ROADMAP says 3 failures. Most likely candidates given the known MIME fidelity gap (`~/.claude/projects/.../memory/project_skills_mime_known_gap.md`):
- Tests in `TestExportSkill` that assert specific MIME types on exported files (e.g. `text/x-python` for `helper.py`) would fail if export round-trips through storage that lost the original MIME.
- Tests in `TestImportSkill` that assert MIME on imported files would fail because `import_skill` stores everything as `application/octet-stream`.
- `test_export_skill_md_content` (line 96) parses YAML frontmatter — could be a YAML-format drift, not MIME.

Discover the actual 3 failures empirically — do not guess.

**Skill Studio scope guard (from SEED-002):**
The MIME fidelity gap is explicitly identified as Skill Studio milestone scope (item #2 in SEED-002). If a failing test asserts something that requires fixing the import-side MIME storage, the correct disposition is `@pytest.mark.skip(reason="...")` with a clear pointer to SEED-002.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Discover the 3 failing tests, root-cause each, and apply minimal fix-or-skip</name>
  <files>backend/tests/integration/test_skills_import_export.py</files>

  <read_first>
    1. Read `backend/tests/integration/test_skills_import_export.py` in full (340 lines — single Read call).
    2. Read `.planning/seeds/SEED-002-skill-studio-milestone-prep.md` if not already in context — specifically item #2 (MIME fidelity) which determines the skip-vs-fix disposition.
    3. Open `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_skills_mime_known_gap.md` if accessible (may live outside the project tree). If not accessible, the seed file's item #2 contains a sufficient summary.
  </read_first>

  <action>
    **Step 1 — Discovery run (do not modify code yet):**

    Run pytest on the file to identify exactly which 3 tests fail:
    ```bash
    cd backend && venv/Scripts/python -m pytest tests/integration/test_skills_import_export.py -v --tb=short 2>&1 | tee /tmp/065-02-discovery.log
    ```

    Parse the output to extract:
    - The 3 test names that FAIL (or ERROR — treat collection errors the same way).
    - For each failure: the assertion line number, the assertion text, and the actual vs. expected values.
    - For any unexpected pass count (e.g. only 2 fail, or 5 fail), recalibrate: the ROADMAP says "3 currently-failing" — if reality is different, trust pytest. Adjust the rest of this task to address the actual failure count.

    **Step 2 — Per-failure root cause analysis:**

    For each failing test, classify the root cause as either:
    - **(A) Test-side fault** — examples:
      - `mock_builder.execute.side_effect = [...]` order changed because production code added/removed a DB query.
      - Assertion checks a string format that has evolved (e.g., file-path encoding, header casing).
      - Missing fixture or import.
      - YAML format drift (`yaml.safe_dump` adds/removes a trailing newline, key order, etc.).
    - **(B) Production-side fault** — examples:
      - Test asserts `mime_type == "text/x-python"` on an imported file but production stores `"application/octet-stream"` per the known MIME gap.
      - Test asserts behavior that production-code-as-shipped doesn't actually deliver and won't until Skill Studio.

    **Step 3 — Apply disposition per failure:**

    For (A) test-side faults:
    - Fix the test in place (adjust mock setup, update assertion to match the current contract, add missing fixture). Keep the diff minimal — one fix per failing assertion. Do NOT refactor unrelated tests.
    - The fix MUST be on the test side only. If you find yourself wanting to edit `app/api/skills.py`, `app/services/skill_service.py`, or any production file — STOP. That means the root cause is actually (B), not (A). Re-classify.

    For (B) production-side faults:
    - Apply `@pytest.mark.skip(reason="...")` to the failing test method. The reason string MUST:
      1. Name the production root cause concretely (e.g., "import_skill stores all files as application/octet-stream regardless of source MIME").
      2. Point to where the fix lives (e.g., "deferred to Skill Studio milestone per SEED-002 item #2").
      3. Be self-contained — a future reader must be able to act on it without spelunking.

      Example skip annotation:
      ```python
      @pytest.mark.skip(reason="Asserts MIME-fidelity round-trip; import_skill currently stores all files as application/octet-stream (see ~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_skills_mime_known_gap.md). Production fix deferred to Skill Studio milestone per SEED-002 item #2. Re-enable when MIME-aware import lands.")
      def test_import_with_files(self, client, auth_headers, mock_builder):
          ...
      ```

    **Step 4 — Do NOT silently expand scope:**

    Per `<scope_reduction_prohibition>` and `<planner_authority_limits>`:
    - You MAY NOT mark a test as skipped because it's "complex" or "hard" or "the assertion looks weird." A skip is justified ONLY by a concrete, named production bug whose fix is out of this phase's scope.
    - You MAY NOT replace a substantive assertion with a weaker one to make the test pass. If the test asserts MIME fidelity and production doesn't deliver MIME fidelity, skip-with-reason — do not soften the assertion to `mime_type in ("text/x-python", "application/octet-stream")`.
    - You MAY NOT touch tests that pass. Hands off any test not in the discovered failing-3 list.

    **Step 5 — Re-run pytest to confirm green:**

    ```bash
    cd backend && venv/Scripts/python -m pytest tests/integration/test_skills_import_export.py -v 2>&1 | tail -20
    ```

    Expected output: every test either `PASSED` or `SKIPPED`. Zero `FAILED`. Zero `ERROR`.

    **Project rules to honor (CLAUDE.md):**
    - Backend uses `venv` at `backend/venv/`.
    - No production code modifications. If a test cannot be made green without touching production, skip it.
  </action>

  <acceptance_criteria>
    1. Discovery log captured at `/tmp/065-02-discovery.log` lists exactly which tests failed in the initial run (truth source for the rest of the plan).
    2. Every test in `test_skills_import_export.py` finishes with status `PASSED` or `SKIPPED` after the changes. Zero `FAILED`. Zero `ERROR`.
    3. Every `@pytest.mark.skip(reason="...")` annotation introduced by this plan has a `reason` string that names a concrete production bug and references SEED-002 (or another concrete future-milestone scope artifact).
    4. `git diff backend/tests/integration/test_skills_import_export.py` shows changes ONLY in the 3 failing tests' bodies (or the lines immediately above them where decorators land). No edits to passing tests.
    5. `git diff` shows ZERO changes outside `backend/tests/integration/test_skills_import_export.py`. No production-code edits.
  </acceptance_criteria>

  <verify>
    <automated>cd backend && venv/Scripts/python -m pytest tests/integration/test_skills_import_export.py -v 2>&1 | tee /tmp/065-02-final.log | tail -10 && echo "---" && grep -E "^(PASSED|FAILED|ERROR|SKIPPED|test_skills_import_export.*PASSED|test_skills_import_export.*FAILED|test_skills_import_export.*SKIPPED)" /tmp/065-02-final.log; echo "---FAIL_COUNT---"; grep -cE "FAILED|ERROR " /tmp/065-02-final.log || true</automated>
    <!-- Expected: tail shows "X passed, Y skipped" with X+Y == total tests, 0 failed, 0 errors. FAIL_COUNT must be 0. -->
    <!-- Counter-grep gate: every introduced skip must include a SEED-002 or memory-file reference. After commit, run: -->
    <!-- grep -B1 'pytest.mark.skip' backend/tests/integration/test_skills_import_export.py | grep -cE 'SEED-002|skill_studio|skills_mime_known_gap' should equal the count of new skips. If unequal, the skip lacks a concrete justification. -->
  </verify>

  <done>
    All tests in `test_skills_import_export.py` are PASSED or SKIPPED with documented reasons. The exact 3 failing tests are identified, each is dispositioned (fix or skip), and the file is in a green state. No production code touched.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Verify no regression, write triage SUMMARY, and commit atomically</name>
  <files>
    .planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md
    backend/tests/integration/test_skills_import_export.py
  </files>

  <read_first>
    1. `git status --short` — confirm Task 1 only modified `backend/tests/integration/test_skills_import_export.py`. If anything else is dirty (e.g. an accidental edit to a production file), STOP and undo before proceeding.
    2. Re-read `/tmp/065-02-discovery.log` from Task 1 — the failing-test names and assertion details feed directly into the SUMMARY's triage table.
  </read_first>

  <action>
    **Step 1 — No-regression check (ROADMAP SC #4):**

    ```bash
    cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py tests/integration/test_threads_skills.py tests/integration/test_skills_import_export.py -q
    ```

    All four targets must pass. If `test_threads_skills.py` is red, Plan 01 hasn't shipped yet — that is a Plan 01 problem; this plan does NOT block on it (Plan 01 and Plan 02 are wave-1 parallel-able). Run the import_export check independently:

    ```bash
    cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py tests/integration/test_skills_import_export.py -q
    ```

    058 + 059 + import_export must pass.

    **Step 2 — Write the triage SUMMARY:**

    Create `.planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md` with this structure:

    ```markdown
    # Phase 065 / Plan 02 — Summary

    **Plan:** Skills import/export test triage
    **Status:** Complete
    **Date:** {YYYY-MM-DD of execution}

    ## Failing Tests Triaged

    | # | Test (class.method) | Pre-existing failure | Disposition | Justification |
    |---|---------------------|----------------------|-------------|---------------|
    | 1 | TestX.test_y | {one-line assertion + actual-vs-expected} | fix | {what was wrong on test side: e.g., "mock_builder.execute.side_effect missing 4th query for new folder_id lookup added in Phase 045"} |
    | 2 | TestX.test_z | {assertion summary} | skip | {pointer to production root cause + SEED-002 reference + re-enable trigger} |
    | 3 | TestX.test_w | {assertion summary} | {fix|skip} | {justification} |

    ## Final Pytest Result

    `pytest tests/integration/test_skills_import_export.py -q` → `{N} passed, {M} skipped` (0 failed, 0 errors)

    ## No-Regression Verification

    - `test_058_concurrency.py::test_cross_tab_unblocked_during_sse` → PASSED
    - `test_059_disconnect.py` → PASSED ({N} tests)

    ## Files Modified

    - `backend/tests/integration/test_skills_import_export.py` ({+/-N lines})

    ## Files NOT Modified (scope guard satisfied)

    - `app/api/skills.py` — production code, MIME-fidelity fix is Skill Studio milestone scope (SEED-002 item #2)
    - `app/services/skill_service.py` — same
    - Any other production file

    ## Commit

    `{commit SHA}` — `test(065-02): triage 3 failing tests in test_skills_import_export.py (fix-or-skip)`

    ## Re-Enable Triggers (for skipped tests, copied here for milestone-planner discoverability)

    - Test {name}: re-enable when {production change ships}. Tracked in SEED-002 item #2.
    {repeat per skipped test}
    ```

    Fill in every {placeholder} with concrete data from the discovery log + the actual edits made.

    **Step 3 — Atomic commit:**

    ```bash
    git add backend/tests/integration/test_skills_import_export.py .planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md
    git commit -m "test(065-02): triage 3 failing tests in test_skills_import_export.py (fix-or-skip)

    Per ROADMAP Phase 065 SC #2 and risk note 369: scope to test-only fixes,
    skip-with-reason for production-rooted failures.

    Failing tests identified by initial pytest run (see 065-02-SUMMARY.md):
    - {Test 1} → {fix|skip} ({one-line reason})
    - {Test 2} → {fix|skip} ({one-line reason})
    - {Test 3} → {fix|skip} ({one-line reason})

    No production code touched. Skill Studio milestone (SEED-002) owns the MIME
    fidelity production fix; skipped tests re-enable when that lands.

    058 + 059 binding gates verified green pre-commit.

    Closes part of TEST-DEBT-059 surfaced during Phase 059-02 verification.
    Phase 065 / Plan 02."
    ```

    No `--no-verify`, no `--amend`, no scope creep into other files.
  </action>

  <acceptance_criteria>
    1. `.planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md` exists, has the triage table populated with the 3 actually-failing tests, and lists each disposition + justification.
    2. `cd backend && venv/Scripts/python -m pytest tests/integration/test_skills_import_export.py -q` exits 0 with output of the form `{N} passed, {M} skipped` (M may be 0 if all 3 were fixable; M=3 if all 3 were prod-rooted; mixed counts are fine).
    3. `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py -q` exits 0.
    4. `git log -1 --name-only` shows exactly 2 files (the test file + the SUMMARY).
    5. SUMMARY's `## Re-Enable Triggers` section is non-empty if any skips were applied; empty (or "None — all 3 were fixable test-side") if all 3 were fixed.
  </acceptance_criteria>

  <verify>
    <automated>cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py tests/integration/test_skills_import_export.py -q 2>&1 | tail -5 && echo "---SUMMARY---" && test -f "../.planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md" && head -30 "../.planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md" && echo "---COMMIT---" && git log -1 --name-only --format="%H%n%s"</automated>
    <!-- Expected: pytest tail shows X passed + Y skipped + 0 failed + 0 errors. SUMMARY file head shows the triage table. git log shows the new commit with subject "test(065-02): triage 3 failing tests...". -->
  </verify>

  <done>
    Atomic commit landed (test file + SUMMARY). 058 + 059 + import_export all green. ROADMAP success criterion #2 ("All tests in test_skills_import_export.py either PASS or are explicitly skipped with documented reason — the 3 currently-failing export tests are fixed or formally deferred") satisfied. ROADMAP SC #4 (no regression in 058/059 binding gates) satisfied for this plan's surface. SEED-002 scope guard honored: zero production-code edits in app/api/skills.py or app/services/skill_service.py.
  </done>
</task>

</tasks>

<verification>
**Phase-level checks for this plan:**

1. **No unexpected failures:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_skills_import_export.py -q 2>&1 | grep -cE "FAILED|ERROR "` returns 0.
2. **No-regression gate:** `cd backend && venv/Scripts/python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py -q` exits 0.
3. **Production-code scope guard:** `git diff HEAD~1 HEAD --stat | grep -E "^ backend/app/" | wc -l` returns 0 (no production files in this plan's commit).
4. **Skip annotations are concrete:** for every new `@pytest.mark.skip(...)` annotation, the reason string contains either `SEED-002`, `Skill Studio`, or `skills_mime_known_gap`. Verified via grep.
5. **SUMMARY exists and is populated:** `.planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md` exists, has a non-empty `## Failing Tests Triaged` table, and references the discovery log content.
</verification>

<success_criteria>
- All tests in `backend/tests/integration/test_skills_import_export.py` either PASS or are explicitly SKIPPED with documented reason citing SEED-002 / Skill Studio / known MIME gap.
- ROADMAP SC #2 satisfied for the export/import surface.
- ROADMAP SC #4 satisfied: 058 + 059 binding gates remain green.
- Single atomic commit on current branch with subject `test(065-02): triage 3 failing tests in test_skills_import_export.py (fix-or-skip)`, touching exactly 2 files (the test file + the SUMMARY).
- SEED-002 scope guard honored: zero production-code modifications.
- LOC budget: ~10-40 LOC diff in the test file (3 fixes ranging from a few mock-list edits to a `@pytest.mark.skip` decorator), plus ~50-80 LOC of SUMMARY markdown.
</success_criteria>

<output>
After completion, the SUMMARY at `.planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md` IS the deliverable record. It captures:
- The 3 failing tests by name with assertion details from the discovery log.
- Disposition for each (fix vs skip) with concrete justification.
- Final pytest result line.
- 058/059 no-regression confirmation.
- Files modified + files NOT modified (scope-guard receipt).
- Commit SHA.
- Re-enable triggers for any skipped tests (so the future Skill Studio milestone planner can rediscover this work without spelunking).
</output>
