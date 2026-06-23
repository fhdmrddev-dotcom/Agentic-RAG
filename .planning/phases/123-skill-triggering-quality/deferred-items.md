# Phase 123 — Deferred / Out-of-Scope Items

Items discovered during execution that are OUT OF SCOPE for the current plan
(pre-existing failures in unrelated test infrastructure, not caused by this plan's changes).

## 123-01 — pre-existing test_threads_skills.py failures

**Discovered:** Plan 123-01, Task 2 regression check (2026-06-23).

11 tests in `backend/tests/integration/test_threads_skills.py` fail. **Verified
pre-existing** by stashing all 123-01 source changes (agent_loop.py / skills.py /
tool_dispatcher.py / skill.py) and re-running — the same 11 fail identically on the
base. They are NOT caused by the D-01 catalog-note relaxation or the lint wiring.

Failing tests:
- `TestCatalogInjection::test_catalog_appended_when_skills_exist`
- `TestCatalogInjection::test_catalog_empty_when_no_skills`
- `TestExplorerModeNoSkills::test_explorer_mode_uses_explorer_tools`
- `TestLoadSkill::test_load_skill_returns_instructions_and_files`
- `TestLoadSkill::test_load_skill_not_found`
- `TestSaveSkill::test_save_skill_creates_new`
- `TestSaveSkill::test_save_skill_updates_existing`
- `TestReadSkillFile::test_read_skill_file_returns_content`
- `TestReadSkillFile::test_read_skill_file_not_found`
- `TestSkillActivatedEvent::test_skill_activated_event_emitted`
- `TestLoadSkillFiles::test_load_skill_includes_filenames`

These are the SSE-on-POST→GET-stream harness tests (Phase 063/065 pattern) — a known
fragile class, unrelated to skill-description linting. NOTE: the two
`TestCatalogInjection` tests assert only on the `## Available Skills` header presence
(not the relaxed body wording), so the D-01 change does not affect their pass/fail —
they fail for the same harness reason on base.

**Disposition:** Not fixed here (scope boundary — only auto-fix issues caused by this
task's changes). The 123-01 lint + catalog-note story is fully covered by the green
`test_skill_lint.py` / `test_skill_catalog_note.py` / `test_skills_lint.py` suites and
the `test_skills.py` create/update regression (10 passed).
