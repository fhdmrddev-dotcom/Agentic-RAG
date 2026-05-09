---
phase: 065-skills-test-infrastructure-repair
plan: 02
subsystem: testing/skills
tags: [test-debt, skills, import-export, agentskills.io]
dependency_graph:
  requires:
    - "Phase 13: Skills Open Standard (production endpoints)"
    - "tests/conftest.py: _supabase, _builder, client, auth_headers, mock_builder"
  provides:
    - "Green test foundation for /skills export+import surface (15/15 PASSED, 0 SKIPPED)"
  affects:
    - "Skill Studio milestone entry gate (SEED-002 item #2 — eval-test pattern can extend a green baseline)"
tech_stack:
  added: []
  patterns:
    - "Test asserts the actual production-shipped ZIP layout (slug-prefixed agentskills.io bundle), not the originally-imagined flat layout"
key_files:
  created:
    - ".planning/phases/065-skills-test-infrastructure-repair/065-02-SUMMARY.md"
  modified:
    - "backend/tests/integration/test_skills_import_export.py"
decisions:
  - "All 3 failures classified as Type A (test-side fault) — not Type B (production fault). No skips applied. No production code modified."
metrics:
  duration: "~12min"
  completed_date: "2026-05-09"
---

# Phase 065 / Plan 02 — Summary

**Plan:** Skills import/export test triage
**Status:** Complete
**Date:** 2026-05-09

## Failing Tests Triaged

| # | Test (class.method) | Pre-existing failure | Disposition | Justification |
|---|---------------------|----------------------|-------------|---------------|
| 1 | `TestExportSkill.test_export_skill_md_content` | `assert "SKILL.md" in zf.namelist()` failed because actual `namelist()` returned `['sql-writer/SKILL.md']` (slug-prefixed bundle layout). Test also pinned `fm["name"] == "SQL Writer"` (display name) and `fm["compatibility"] == "1.0"`, but production sets `fm["name"]` to the slug (`"sql-writer"`) and `fm["compatibility"]` to a free-form runtime-requirement sentence. | **fix** | Test was written assuming a flat ZIP layout; production correctly emits the agentskills.io slug-prefixed bundle (intentional — `app/api/skills.py:525,549,555` derive a slug from the skill name and prepend it to every entry). The import side already handles both flat and prefixed layouts via `_find_skill_entries` (`app/api/skills.py:64-78`), so round-trip works. Fix: (a) discover SKILL.md by `endswith("SKILL.md")` rather than exact match; (b) assert `fm["name"] == "sql-writer"` (the slug, which is what import will round-trip); (c) assert `compatibility` key is present rather than pinning value. |
| 2 | `TestExportSkill.test_export_file_subdirs` | `assert any(n.startswith("scripts/") for n in names)` failed because actual names are `['sql-writer/SKILL.md', 'sql-writer/scripts/script.py', 'sql-writer/assets/logo.png', 'sql-writer/references/data.csv']`. | **fix** | Same root cause as #1 — slug-prefixed bundle. The MIME→subdir routing is correct (`_mime_to_subdir` in `app/api/skills.py:26-35` correctly buckets `text/x-python` → `scripts/`, `image/png` → `assets/`, `text/csv` → `references/`); the assertion was just over-restrictive on prefix shape. Fix: change `n.startswith("scripts/")` → `"/scripts/" in n` so the assertion matches the bucket regardless of which top-level slug production chose. |
| 3 | `TestExportSkill.test_export_no_files` | `assert zf.namelist() == ["SKILL.md"]` failed — actual was `['sql-writer/SKILL.md']`. | **fix** | Same root cause as #1 — slug-prefixed bundle. The "no attached files → ZIP contains exactly one entry" contract is intact; only the entry's path shape differs. Fix: assert `len(names) == 1` AND `names[0].endswith("SKILL.md")` rather than exact-match against `["SKILL.md"]`. |

**No skips applied.** All 3 failures were pure test-side drift (assertions assumed a flat ZIP layout, but production correctly ships the agentskills.io slug-prefixed bundle layout). The MIME-fidelity gap flagged in SEED-002 item #2 is not in play here — these tests don't assert MIME on round-tripped content.

## Final Pytest Result

```
pytest tests/integration/test_skills_import_export.py -v
... 15 passed, 1 warning in 0.31s
```

**0 failed, 0 errors, 0 skipped.** All 15 tests PASSED.

## No-Regression Verification

The plan's no-regression gate calls for running `test_058_concurrency.py::test_cross_tab_unblocked_during_sse` and `test_059_disconnect.py`. Those test files are NOT present in this parallel-execution worktree's tree (worktree base is `fa1e327d`, which predates the 058/059 phase commits). The orchestrator will run the full no-regression suite on the merged tree post-wave.

By construction, this plan's diff is limited to `backend/tests/integration/test_skills_import_export.py`; no other test files (let alone production code) are modified, so 058/059 cannot have regressed via this commit. ROADMAP SC #4 is honored at the file-isolation level pre-merge; the orchestrator confirms it at the suite level post-merge.

## Files Modified

- `backend/tests/integration/test_skills_import_export.py` (+44 / -12 LOC)

## Files NOT Modified (scope guard satisfied per SEED-002 + ROADMAP risk note 369)

- `backend/app/api/skills.py` — production export endpoint (`export_skill` at line 506) and helpers (`_mime_to_subdir`, `_find_skill_entries`, `_sanitize_zip_name`, `_parse_skill_md`) all left untouched.
- `backend/app/services/` — no production-service files touched.
- `backend/supabase/migrations/` — no schema changes.
- Any other production file.

## Commit

`{commit SHA filled by post-commit step}` — `test(065-02): triage 3 failing tests in test_skills_import_export.py (fix-or-skip)`

## Re-Enable Triggers (for skipped tests)

**None — all 3 failures were fixable test-side.** No `@pytest.mark.skip` annotations were introduced by this plan, so there are no re-enable triggers to track. The MIME-fidelity gap flagged in SEED-002 item #2 remains a known production-side issue but is not blocking any test in this file (no test in `TestImportSkill` asserts round-trip MIME equality on uploaded skill files; the suite asserts request-handling shape and uses `mock_builder.execute.side_effect` to stub the DB return rather than inspecting the storage upload payload).

## Self-Check

Verification artifacts:

1. **Test result:** 15 passed / 0 failed / 0 errors / 0 skipped — captured in `/tmp/065-02-final.log`.
2. **Diff scope:** `git diff --stat backend/tests/integration/test_skills_import_export.py` shows `1 file changed, 44 insertions(+), 12 deletions(-)`. No production files in the staged set.
3. **Skip-annotation grep:** N/A — zero new skip annotations introduced (all 3 dispositions were fix, not skip).
4. **Production-code scope guard:** `git diff` shows zero changes outside the test file.
