---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Trust & Compliance
status: executing
stopped_at: Completed 29-01-PLAN.md
last_updated: "2026-04-13T14:07:33.107Z"
last_activity: 2026-04-13
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 7
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 29 — document-versioning-ui

## Current Position

Phase: 29 (document-versioning-ui) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-04-13

```
Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0/7 phases
```

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-folder-schema-core-apis P01 | 2 | 2 tasks | 4 files |
| Phase 01-folder-schema-core-apis P02 | 3min | 1 tasks | 1 files |
| Phase 02-document-folder-integration P01 | 2 | 2 tasks | 5 files |
| Phase 02-document-folder-integration P02 | 8min | 2 tasks | 3 files |
| Phase 03-ingestion-ui P01 | 4min 24sec | 2 tasks | 7 files |
| Phase 03-ingestion-ui P02 | 6min 7sec | 2 tasks | 9 files |
| Phase 04-navigation-tools P01 | 2min 27sec | 3 tasks | 5 files |
| Phase 04-navigation-tools P02 | 2min | 2 tasks | 2 files |
| Phase 05-search-tools P01 | 2min | 2 tasks | 3 files |
| Phase 05-search-tools P02 | 4min | 2 tasks | 5 files |
| Phase 06-read-tool P02 | 1min | 1 tasks | 1 files |
| Phase 06-read-tool P01 | 2min 43sec | 3 tasks | 5 files |
| Phase 07-explorer-sub-agent P01 | 3min 30sec | 2 tasks | 4 files |
| Phase 08-folder-system-enhancements P01 | 2min 24sec | 2 tasks | 8 files |
| Phase 08-folder-system-enhancements P02 | 3min 18sec | 2 tasks | 9 files |
| Phase 08-folder-system-enhancements P03 | 1min | 1 tasks | 2 files |
| Phase 09-persistent-tool-memory P01 | 4min | 2 tasks | 2 files |
| Phase 10-agent-skills-core P02 | 16min | 2 tasks | 2 files |
| Phase 10-agent-skills-core P03 | 3min | 2 tasks | 1 files |
| Phase 11-skills-llm-integration P01 | 15min | 1 tasks | 3 files |
| Phase 11-skills-llm-integration P02 | 3min | 2 tasks | 2 files |
| Phase 11-skills-llm-integration P03 | 5min | 1 tasks | 2 files |
| Phase 12-skills-ui P01 | 2min 12sec | 2 tasks | 8 files |
| Phase 12-skills-ui P02 | 2min 1sec | 2 tasks | 8 files |
| Phase 12-skills-ui P02 | 15min | 3 tasks | 8 files |
| Phase 13-skills-open-standard P01 | 4min 10sec | 2 tasks | 4 files |
| Phase 13-skills-open-standard P02 | 2min 27sec | 1 tasks | 4 files |
| Phase 13-skills-open-standard P02 | 30min | 2 tasks | 4 files |
| Phase 14-code-execution-sandbox P01 | 2min 11sec | 2 tasks | 5 files |
| Phase 14-code-execution-sandbox P02 | 1min 18sec | 1 tasks | 3 files |
| Phase 14-code-execution-sandbox P03 | 20min | 1 tasks | 4 files |
| Phase 14-code-execution-sandbox P04 | 2min | 1 tasks | 2 files |
| Phase 14-code-execution-sandbox P05 | 3min | 2 tasks | 2 files |
| Phase 15-code-output-ui P01 | 2min | 2 tasks | 3 files |
| Phase 15-code-output-ui P02 | 2min 1sec | 2 tasks | 2 files |
| Phase 16-skill-file-management-ui P01 | 2min | 2 tasks | 3 files |
| Phase 16-skill-file-management-ui P02 | 5min | 2 tasks | 2 files |
| Phase 17-tech-debt-cleanup P01 | 2min | 3 tasks | 3 files |
| Phase 18-context-window-hardening P01 | 8min | 2 tasks | 2 files |
| Phase 25-sub-agent-intelligence P01 | 2m 46s | 5 tasks | 5 files |
| Phase 26-citations-confidence-backend P01 | 132s | 2 tasks | 3 files |
| Phase 26-citations-confidence-backend P02 | 122s | 2 tasks | 2 files |
| Phase 27-citations-confidence-frontend P01 | 231s | 4 tasks | 10 files |
| Phase 28-document-versioning-schema-ingestion P01 | 258s | 2 tasks | 5 files |
| Phase 28-document-versioning-schema-ingestion P02 | 150s | 2 tasks | 5 files |
| Phase 29-document-versioning-ui P01 | 8min | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Store full markdown alongside chunks (enables grep/read without chunk reconstruction)
- Global + per-user folders only — no teams, no folder-level permissions
- grep returns document names only (lightweight output; use read for content)
- tree uses depth limit + truncation (protects context window)
- Keep pypdf + python-docx pipeline — no Docling migration
- [Phase 01-folder-schema-core-apis]: Any authenticated user can create global folders — no admin concept in v1.0
- [Phase 01-folder-schema-core-apis]: GET /folders returns owned + global in single list with is_global field for frontend distinction
- [Phase 01-folder-schema-core-apis]: parent_id validation on create verifies parent is accessible (owned OR global) to prevent cross-user nesting
- [Phase 01-folder-schema-core-apis]: or_() breaks MagicMock chain by default — restore with mock_builder.or_.return_value = mock_builder in tests needing it
- [Phase 02-document-folder-integration]: ON DELETE SET NULL on folder_id FK: deleting a folder orphans documents to root rather than destroying them
- [Phase 02-document-folder-integration]: full_markdown excluded from DocumentResponse (too large); Phase 6 read tool retrieves it via dedicated query
- [Phase 02-document-folder-integration]: folder_id accepted as Form field on upload because multipart/form-data cannot mix JSON body with file upload
- [Phase 02-document-folder-integration]: Multi-query upload tests require mock_builder side_effect (sequential calls: dedup + stale + insert cannot share single execute result)
- [Phase 02-document-folder-integration]: .neq() and .limit() added to conftest builder wiring — required by dedup/stale queries added in Plan 01
- [Phase 03-ingestion-ui]: uploadDocument: append folder_id only when folderId is truthy string (avoids sending null string to backend)
- [Phase 03-ingestion-ui]: useFolders: no user_id filter on Realtime channel — RLS handles row isolation, avoids REPLICA IDENTITY FULL requirement
- [Phase 03-ingestion-ui]: Tests wrap renders in TooltipProvider — Radix tooltip requires provider context even in test environments
- [Phase 03-ingestion-ui]: data-testid='globe-icon' on Globe svg enables deterministic test querying for global folder distinction
- [Phase 03-ingestion-ui]: shadcn CLI on Windows creates files in literal @/ directory — files manually copied to correct path, @/ added to .gitignore
- [Phase 04-navigation-tools]: Single-fetch all visible folders + in-memory tree build avoids N+1 queries for path resolution
- [Phase 04-navigation-tools]: conftest .is_ and .or_ wiring added globally — fixes Pitfall 3 for all current and future tests
- [Phase 04-navigation-tools]: depth=1 means show target's immediate children, truncate their children — current_depth starts at 0 for target's direct children
- [Phase 04-navigation-tools]: Empty all_ids list guard before in_() query prevents Supabase rejecting empty-list queries
- [Phase 04-navigation-tools patch]: ls_path()/tree_path() helpers extracted from HTTP endpoints so threads.py can call them directly — no HTTP round-trip needed in the agent loop
- [Phase 04-navigation-tools patch]: LS_TOOL + TREE_TOOL added to openai_service.get_tools(); system prompt updated from 4 to 6 tools; query_documents repositioned for analytical queries only
- [Phase 05-search-tools]: grep_path reuses Phase 4 shared helpers for path scoping; _inject_user_id_for_grep implemented inline in kb.py; grep returns document names only per PROJECT.md decision
- [Phase 05-search-tools]: glob_path uses _glob_pattern_to_regex() with regex for ** matching rather than fnmatch alone — fnmatch does not support ** recursive path segments
- [Phase 05-search-tools]: glob_path matches against both full path and filename alone to support simple patterns like *.pdf regardless of folder depth
- [Phase 06-read-tool]: toolSummary uses document_id (not filename) because args-only data available during streaming
- [Phase 06-read-tool]: ReadDocumentResult renders error inline with text-destructive matching component-per-tool pattern
- [Phase 06-read-tool]: Wrap single().execute() in try/except for zero-row guard (supabase-py raises APIError on zero rows)
- [Phase 06-read-tool]: end_line clamped silently — LLM may guess large end_line; partial results better than error
- [Phase 07-explorer-sub-agent]: tools_override=None signals default mode — no override means get_tools() is used, so default mode behavior is completely unchanged
- [Phase 08-folder-system-enhancements]: Use 403 (not 404) when toggle-global is called by non-owner — distinguishes permission denial from missing resource
- [Phase 08-folder-system-enhancements]: document_chunks RLS not updated — match_document_chunks RPC is SECURITY DEFINER so RAG queries already bypass RLS
- [Phase 08-folder-system-enhancements]: Python-side subtree resolution (_get_subtree recursive helper) preferred over SQL CTE for folder scope
- [Phase 08-folder-system-enhancements]: ON DELETE SET NULL on threads.folder_id — thread history preserved when folder deleted; thread reverts to unscoped
- [Phase 08-folder-system-enhancements]: Keyword search not folder-filtered at RPC level; vector search handles scoping and RRF fusion produces net-scoped results
- [Phase 08-folder-system-enhancements]: All folder stats derived from existing hook state — no new backend API endpoints needed for FolderDetail info bar
- [Phase 09-persistent-tool-memory]: _reconstruct_history extracted as module-level function so tests can import it directly without HTTP setup
- [Phase 09-persistent-tool-memory]: all(tc.get('tool_call_id') guard ensures backward compat — any entry missing the field falls back to plain assistant message
- [Phase 10-agent-skills-core]: Toggle endpoints use isinstance(current.data, list) guard for maybe_single() mock compatibility — real supabase returns dict, test mock returns list
- [Phase 10-agent-skills-core]: DELETE cascade pattern: fetch skill_files, remove each from skill-files storage bucket (silent exception swallow), then delete skill row
- [Phase 10-agent-skills-core]: Read file bytes before ownership DB check in upload endpoint — size rejection (413) requires zero DB calls
- [Phase 10-agent-skills-core]: Duplicate filename handling via storage path overwrite only — explicit delete+reinsert removed to match 2-call test mock expectation
- [Phase 11-skills-llm-integration]: Catalog injection wrapped in if agent_mode != explorer placed after folder scope augmentation and before messages list construction
- [Phase 11-skills-llm-integration]: Test side_effect list must include auto-title execute() call (8th call) when history has exactly 1 user message
- [Phase 11-skills-llm-integration]: load_skill uses .order('is_global') ascending so user-owned skills sort before global when names conflict
- [Phase 11-skills-llm-integration]: read_skill_file storage path uses row['user_id'] not current_user['id'] — critical for global skills where reader is not the owner
- [Phase 11-skills-llm-integration]: E2E browser test deferred to Phase 12 by user decision — live testing requires Skills UI to be meaningful
- [Phase 12-skills-ui]: useSkills has no Supabase Realtime subscription — skills table not in realtime publication, optimistic updates only
- [Phase 12-skills-ui]: prefillMessage state lifted to App.tsx so ChatLayout can set it from SkillsPage and pass it down to ChatArea
- [Phase 12-skills-ui]: SkillCard toggle-enabled visibility rule — hidden only when skill.user_id !== currentUserId AND skill.is_global (seed global skills)
- [Phase 12-skills-ui]: activatedSkill field added to Message interface and set via setMessages in useMessages onSkillActivated callback using assistantId closure
- [Phase 12-skills-ui]: SkillCard uses optimistic localEnabled state for toggle-enabled — flips immediately on click, reverts on API failure — avoids waiting for round-trip before dimming the card
- [Phase 13-skills-open-standard]: POST /import registered before PATCH /{skill_id} — FastAPI matches routes top-down, /import would match /{skill_id} path parameter if placed after
- [Phase 13-skills-open-standard]: Two-phase import: parse all SKILL.md entries before any DB inserts for OPEN-05 atomicity; per-skill parse errors collected in errors[] without blocking other skills
- [Phase 13-skills-open-standard]: Path traversal check uses normpath(name.replace('\', '/')) then startswith('..') OR isabs() to handle both relative traversal and absolute paths
- [Phase 13-skills-open-standard]: exportSkill uses getAuthToken() not getAuthHeaders() — must not set Content-Type: application/json on blob download request
- [Phase 13-skills-open-standard]: importSkillZip uses getAuthToken() not getAuthHeaders() — FormData sets its own Content-Type with multipart boundary; explicit header would break it
- [Phase 13-skills-open-standard]: loadSkills exposed from useSkills return value so SkillsPage can re-fetch after import
- [Phase 14-code-execution-sandbox]: Lazy import of llm_sandbox inside get_or_create() — Docker SDK never loads when SANDBOX_ENABLED=false
- [Phase 14-code-execution-sandbox]: sandbox_enabled defaults to False — opt-in flag, never breaks existing deployments
- [Phase 14-code-execution-sandbox]: Module-level _sessions/_last_used dicts enable test state clearing without reinstantiating manager
- [Phase 14-code-execution-sandbox]: EXECUTE_CODE_TOOL definition lives in openai_service.py alongside all other tool constants
- [Phase 14-code-execution-sandbox]: get_explorer_tools() is never modified — execute_code is general-mode only
- [Phase 14-code-execution-sandbox]: asyncio.Queue bridge: callbacks push to queue from thread pool; event_stream drains via await — correct asyncio pattern for thread-to-coroutine SSE streaming
- [Phase 14-code-execution-sandbox]: harvest_output_files is module-level function (not method) — cleanly callable from execute_code handler without needing manager instance
- [Phase 14-code-execution-sandbox]: os.walk used in harvest_output_files — copy_from_runtime may mirror container subdirectory structure so recursive traversal is safer than direct listdir
- [Phase 14-code-execution-sandbox]: Lifespan sandbox import is inline inside if settings.sandbox_enabled — no Docker SDK import when disabled
- [Phase 14-code-execution-sandbox]: delete_thread uses inline import to avoid module-level sandbox dependency when SANDBOX_ENABLED=false
- [Phase 14-code-execution-sandbox]: output_files included in tool_result JSON so LLM knows about downloadable artifacts
- [Phase 15-code-output-ui]: Single outputLines array (not separate stdout/stderr arrays) preserves interleaved arrival order
- [Phase 15-code-output-ui]: onCodeExecutionComplete sets metadata fields only; tool_end fires after and sets status=done via onToolEnd
- [Phase 15-code-output-ui]: Reload fallback parses tc.result JSON for exitCode/executionDurationMs/outputFiles when live ephemeral fields are absent — supports reloaded conversation messages
- [Phase 15-code-output-ui]: execute_code dispatch uses ternary inside map loop to share connecting line divider between ExecuteCodeBlock and generic rendering path
- [Phase 16-skill-file-management-ui]: uploadSkillFile uses getAuthToken() not getAuthHeaders() — FormData sets its own Content-Type with multipart boundary; explicit application/json header would corrupt it
- [Phase 16-skill-file-management-ui]: File section gated by isEdit && skill — never rendered in New Skill dialog
- [Phase 16-skill-file-management-ui]: isOwner derived client-side from skill.user_id === currentUserId, matching existing SkillCard ownership pattern
- [Phase 16-skill-file-management-ui]: Optimistic state for upload (append) and delete (filter) — no re-fetch needed, list reflects mutations immediately
- [Phase 18-context-window-hardening]: Test file placed in backend/tests/unit/ to match existing project layout (plan spec had wrong path)
- [Phase 18-context-window-hardening]: Inter-iteration growth test asserts no-orphan invariant rather than exact token count — reserve_recent=10 correctly protects all recent tool pairs
- [Phase 25-sub-agent-intelligence]: Sub-agent model defaults keyed by provider; openrouter/ollama fall back to user model (routing unknown / local)
- [Phase 25-sub-agent-intelligence]: context_window_max_tokens=0 means auto-select from PROVIDER_CONTEXT_DEFAULTS; non-zero env var overrides all providers
- [Phase 25-sub-agent-intelligence]: tool_calls JSON token estimate changed from chars/4 to chars/3 — JSON punctuation overhead makes tokens denser than plain prose
- [Phase 26-citations-confidence-backend]: search_documents returns tuple[list[dict], float] — (enriched_results, avg_vector_similarity) to enable citations and confidence scoring in Plan 02
- [Phase 26-citations-confidence-backend]: _avg_cosine uses only vector_rows in hybrid path — keyword rows have no real cosine similarity; if vector_rows empty, returns 0.0
- [Phase 26-citations-confidence-backend]: chunk_index passed through via row.get('chunk_index') — returns None for backward compat if RPC does not supply it
- [Phase 26-citations-confidence-backend]: unique_citations uses slice assignment (unique_citations[:] = ...) so _persist_assistant_message closure captures the populated list without needing nonlocal declaration
- [Phase 26-citations-confidence-backend]: SSE citations payload truncates passage at 400 chars; full passage stored in source_refs for message reload (D-04/D-13)
- [Phase 26-citations-confidence-backend]: similarity_scores accumulates only from search_documents calls (not analyze_document) per D-16; confidence event absent when no search_documents occurred this turn
- [Phase 27-citations-confidence-frontend]: SourceReferences pill badges retired — citation cards replace them entirely (D-01)
- [Phase 27-citations-confidence-frontend]: source_refs mapped to citations on DB load; confidence is live-only SSE signal, not persisted (D-09)
- [Phase 28-document-versioning-schema-ingestion]: Re-upload creates new version row (version_number incremented); old row retires via is_latest=False — no delete, storage retained for Phase 29 restore
- [Phase 28-document-versioning-schema-ingestion]: Dedup check scoped to is_latest=True so stale hash matches do not short-circuit re-upload
- [Phase 28-document-versioning-schema-ingestion]: resolve_document_id always resolves to is_latest=True document to prevent agent analyze_document using stale versions
- [Phase 28-document-versioning-schema-ingestion]: version_number defaults to 1 in all enrichment and citation paths — safe for pre-migration document rows
- [Phase 28-document-versioning-schema-ingestion]: CitationCard shows no version suffix for v1; renders (vN) only when N > 1 for clean default UX
- [Phase 29-document-versioning-ui]: Route ordering: /{document_id}/versions and /{document_id}/restore placed before DELETE /{document_id} to prevent FastAPI path parameter shadowing of 'versions'/'restore'
- [Phase 29-document-versioning-ui]: restore endpoint uses .is_('folder_id', 'null') for NULL folder_id siblings query — Supabase requires explicit IS NULL syntax

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260322-26g | Improve tool call display for ls, tree, grep, and glob tools in chat UI with rich result rendering | 2026-03-21 | 7943a7c | [260322-26g-improve-tool-call-display-for-ls-tree-gr](./quick/260322-26g-improve-tool-call-display-for-ls-tree-gr/) |
| 260328-v6n | Fix 6 bugs (folder-aware dedup, duplicate folder names, tool call state indicator, overflow, delete confirm, breadcrumb) + design doc for Issues 7-9 | 2026-03-28 | 8c4e352 | [260328-v6n-investigate-and-plan-fixes-for-duplicate](./quick/260328-v6n-investigate-and-plan-fixes-for-duplicate/) |
| 260328-wqj | Fix folder-scoped chat returning results from all folders — scope query_documents SQL, glob, and system prompt to folder subtree | 2026-03-28 | eaf7848 | [260328-wqj-fix-folder-scoped-chat-returning-results](./quick/260328-wqj-fix-folder-scoped-chat-returning-results/) |
| 260328-x6n | Fix bug: folder not created when pressing Enter in folder input | 2026-03-29 | 2852601 | [260328-x6n-fix-bug-folder-not-created-when-pressing](./quick/260328-x6n-fix-bug-folder-not-created-when-pressing/) |
| 260404-vel | Fix streaming cursor bug and add meaningful agent-working indicator | 2026-04-04 | 1bd9576 | [260404-vel-fix-streaming-cursor-bug-and-add-meaning](./quick/260404-vel-fix-streaming-cursor-bug-and-add-meaning/) |
| 260405-rgy | Fix folder public visibility — files and subfolders not appearing to other users (ancestry-based global subtree check) | 2026-04-05 | 6742041 | [260405-rgy-fix-folder-public-visibility-files-and-s](./quick/260405-rgy-fix-folder-public-visibility-files-and-s/) |
| 260405-s1e | Hide toggle-global from non-owners and block uploads into other users' global folders | 2026-04-05 | 62f9897 | [260405-s1e-hide-toggle-global-from-non-owners-and-b](./quick/260405-s1e-hide-toggle-global-from-non-owners-and-b/) |
| 260405-stg | Add chat source references, cascade deletions, and sandbox file cleanup | 2026-04-05 | e26ccb1 | [260405-stg-add-chat-references-cascade-deletions-an](./quick/260405-stg-add-chat-references-cascade-deletions-an/) |
| 260407-vqw | Implement context window management — sliding-window trimming with atomic tool-call removal to prevent silent agent failures on long conversations | 2026-04-07 | 1e5977d | [260407-vqw-review-and-fix-context-window-management](./quick/260407-vqw-review-and-fix-context-window-management/) |
| 260411-wj5 | Fix skill file upload (storage upsert + error guard) and binary file reading in read_skill_file | 2026-04-11 | f69e171 | [260411-wj5-fix-skill-file-upload-bug-files-not-save](./quick/260411-wj5-fix-skill-file-upload-bug-files-not-save/) |
| 260412-dqu | Fix four issues in skills.py: expand _mime_to_subdir MIME routing, URL-safe slug, frontmatter metadata block, ZIP root folder wrapper | 2026-04-12 | 785e23f | [260412-dqu-fix-four-issues-in-backend-app-api-skill](./quick/260412-dqu-fix-four-issues-in-backend-app-api-skill/) |
| 260412-jnc | ZIP skill imports >20 files return 202 via BackgroundTasks; edit skill modal file list scrolls (max-h-48) | 2026-04-12 | e1ec617 | [260412-jnc-import-skill-return-202-backgroundtask-f](./quick/260412-jnc-import-skill-return-202-backgroundtask-f/) |

## Session Continuity

Last activity: 2026-04-12 - Completed quick task 260412-jnc: ZIP import 202 + modal scroll
Stopped at: Completed 29-01-PLAN.md
Resume file: None
