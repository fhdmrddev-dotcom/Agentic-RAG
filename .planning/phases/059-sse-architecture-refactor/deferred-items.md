# Phase 059 — Deferred Items (out-of-scope discoveries during plan 02 execution)

## Pre-existing test failures unrelated to plan 02

**Discovered:** during plan 02 verification (post-Task 2)
**Status:** PRE-EXISTING — not caused by plan 02. Same failures occur on the
plan-02 base commit (`5fbced9`) before any refactor work.

### Tests that fail by patching a non-existent function

The following integration tests patch `app.api.threads.create_streaming_chat`,
but `threads.py` only exports / uses `create_adaptive_streaming_chat`. The
shorter name has never existed in the current threads.py codebase (verified
by `git show 5fbced9:backend/app/api/threads.py | grep -c "def create_streaming_chat"` — 0).

```
tests/integration/test_threads.py::TestSendMessage::test_sse_stream_contains_delta_events
tests/integration/test_threads.py::TestSendMessage::test_sse_stream_delta_events_are_valid_json
tests/integration/test_threads_skills.py::TestCatalogInjection::test_catalog_appended_when_skills_exist
tests/integration/test_threads_skills.py::TestCatalogInjection::test_catalog_empty_when_no_skills
tests/integration/test_threads_skills.py::TestExplorerModeNoSkills::test_explorer_mode_uses_explorer_tools
tests/integration/test_threads_skills.py::TestLoadSkill::test_load_skill_returns_instructions_and_files
tests/integration/test_threads_skills.py::TestLoadSkill::test_load_skill_not_found
tests/integration/test_threads_skills.py::TestSaveSkill::test_save_skill_creates_new
tests/integration/test_threads_skills.py::TestSaveSkill::test_save_skill_updates_existing
tests/integration/test_threads_skills.py::TestReadSkillFile::test_read_skill_file_returns_content
tests/integration/test_threads_skills.py::TestReadSkillFile::test_read_skill_file_not_found
tests/integration/test_threads_skills.py::TestSkillActivatedEvent::test_skill_activated_event_emitted
tests/integration/test_threads_skills.py::TestLoadSkillFiles::test_load_skill_includes_filenames
```

Each fails with:
```
AttributeError: <module 'app.api.threads' from '.../app/api/threads.py'>
does not have the attribute 'create_streaming_chat'
```

### Other pre-existing failures

```
tests/integration/test_documents.py::TestUploadDocument::test_upload_with_valid_folder_id_returns_201
tests/integration/test_documents.py::TestFullMarkdown::test_ingest_stores_full_markdown
tests/integration/test_skills_import_export.py::TestExportSkill::test_export_skill_md_content
tests/integration/test_skills_import_export.py::TestExportSkill::test_export_file_subdirs
tests/integration/test_skills_import_export.py::TestExportSkill::test_export_no_files
```

These unrelated failures exist on the plan-02 base commit and are out of scope
for the plan-02 refactor (Rule: scope boundary — only auto-fix issues directly
caused by the current task's changes).

## Suggested follow-up

A small test-maintenance plan in v2.5 (or a future docs-update wave) should
update these tests to either patch `create_adaptive_streaming_chat` or refactor
to a different mocking strategy. **Not in scope for phase 059.**

## Plan 058's regression guard (D-059-07) — INTACT

```
tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse PASSED
```

The cross-tab benchmark is not regressed by plan 02 — verified before and after Task 1 + Task 2.
