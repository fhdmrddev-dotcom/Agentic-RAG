---
phase: 260-the-expert-you-can-actually-use
plan: 01
subsystem: backend / database
tags: [postgres, asyncpg, rls, threads, expert_scoping, financial_analyzer, run_context]

# Dependency graph
requires: [PACK-01]
provides:
  - "public.threads.active_expert_id column with partial index idx_threads_active_expert"
  - "System financial knowledge folder 'Financial Reports & Filings' with 10-K fixture seeded in migration 188"
  - "backend/app/models/thread.py with active_expert_id on Thread, ThreadCreate, ThreadUpdate, ThreadResponse, ThreadSnapshotResponse"
  - "backend/app/api/threads.py with GET /threads/{id} and active_expert_id persistence and clearing in PATCH"
  - "backend/app/services/expert_service.py system-shared folder resolution"
  - "backend/app/services/run_producer.py pre-loop scoping resolution via resolve_expert_bundle"
  - "backend/app/services/agent_loop.py data-driven folder and tool scoping on RunContext (zero 'if expert:' branches)"
  - "backend/tests/unit/test_260_expert_chat_scoping.py passing 6/6 tests including AST closed-core invariant"
affects: [260-02, 260-03, chat, composer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-core invariant (PACK-01 / EXT-01): scoping resolved as pure data (effective_folder_ids, effective_tools) before entering agent_loop"
    - "Zero 'if expert:' branches in agent_loop.py verified via AST node inspection"
    - "Thread-bound scoping persistence (D-260-04) retaining history while restricting retrieval"

key-files:
  created:
    - "supabase/migrations/188_expert_chat_scoping.sql"
    - "backend/tests/unit/test_260_expert_chat_scoping.py"
  modified:
    - "supabase/full-schema.sql"
    - "backend/app/models/thread.py"
    - "backend/app/api/threads.py"
    - "backend/app/services/expert_service.py"
    - "backend/app/services/agent_loop.py"
    - "backend/app/services/run_producer.py"

key-decisions:
  - "Migration 188 adds active_expert_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL to public.threads with partial index (D-260-04)."
  - "Migration 188 seeds system financial knowledge folder ('Financial Reports & Filings') and sample 10-K document chunks for financial-analyzer (D-260-08, PACK-05)."
  - "RunContext in agent_loop.py receives additive effective_folder_ids and effective_tools data fields; run_producer.py resolves them via resolve_expert_bundle before loop execution (D-260-05)."
  - "agent_loop.py remains closed-core: exactly zero occurrences of 'expert' in AST Name/Attribute nodes; folders and active_tools are filtered purely from context fields."

patterns-established:
  - "Pure data scoping: agent_loop.py knows only effective_folder_ids and effective_tools, not bundles or expert concepts."
  - "System shared folders: folders with user_id == SYSTEM_USER_ID and is_org_shared = true are accessible across tenant bundles."

requirements-completed: [PACK-02, PACK-05]

# Metrics
duration: 15min
completed: 2026-09-20
---

# Phase 260 Plan 01 Summary: Thread Active Expert Scoping & Closed-Core Retrieval Boundary

**Delivered the backend foundation for thread-scoped Expert bundles: Migration 188 (threads.active_expert_id + financial reports knowledge seed), thread model/API updates, pre-loop scoping resolution in `run_producer.py`, and closed-core data injection into `agent_loop.py` with zero AST expert branches.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-20T03:40:00Z
- **Completed:** 2026-09-20T03:55:00Z
- **Tasks:** 4 completed
- **Files created/modified:** 8

## Accomplishments

1. **Migration 188 Applied Locally & Seeded (D-260-04, D-260-08, PACK-05)**:
   - Added `threads.active_expert_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL` with partial index `idx_threads_active_expert`.
   - Seeded system folder `Financial Reports & Filings` (`00000000-0000-0000-0000-000000000260`) with sample 10-K document fixture and tsvector chunks.
   - Seeded system skill `financial_ratio_calculator` (`00000000-0000-0000-0000-000000000264`).
   - Attached knowledge folder and skill to `financial-analyzer` expert bundle.
   - Applied migration to local Postgres (port 54322) and updated `supabase/full-schema.sql`.

2. **Thread Models and API (D-260-01, D-260-04)**:
   - Updated `backend/app/models/thread.py` to include `active_expert_id` on `Thread`, `ThreadCreate`, `ThreadUpdate`, `ThreadResponse`, and `ThreadSnapshotResponse`.
   - Updated `backend/app/api/threads.py`:
     - Added `GET /threads/{id}` endpoint returning `ThreadResponse`.
     - `get_snapshot` and `create_thread` handle `active_expert_id`.
     - `rename_thread` (`PATCH /threads/{id}`) verifies capability entitlement when setting an expert, and clears to `None` on dismissal.

3. **Closed-Core Seam & Pre-Loop Resolution (D-260-05, PACK-01 Closed-Core Invariant)**:
   - `RunContext` in `backend/app/services/agent_loop.py` carries additive `effective_folder_ids: tuple[str, ...] | None` and `effective_tools: tuple[str, ...] | None`.
   - `run_agent_loop` scopes `folder_subtree_ids` and restricts `active_tools` purely based on these context fields.
   - `run_producer.py` queries `threads.active_expert_id`, invokes `resolve_expert_bundle`, and populates `RunContext` prior to invoking the loop.
   - Zero occurrences of the word `"expert"` inside `agent_loop.py`.

4. **Testing and Verification**:
   - Created `backend/tests/unit/test_260_expert_chat_scoping.py` covering thread CRUD, pre-loop scoping resolution, agent loop tool/folder restricting, and AST inspection confirming 0 expert AST nodes in `agent_loop.py`. 6/6 tests passed.

## Self-Check & Verification

- `pytest backend/tests/unit/test_260_expert_chat_scoping.py`: 6 passed
- `node scripts/check-hot-file-ledger.cjs 260`: ledger gate OK
