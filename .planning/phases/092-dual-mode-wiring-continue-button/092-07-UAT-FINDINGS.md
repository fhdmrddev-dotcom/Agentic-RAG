---
status: gaps_found
phase: 092-dual-mode-wiring-continue-button
plan: 07
source: [092-07-PLAN.md Task 6, 092-VALIDATION.md Manual-Only, operator UAT 2026-05-31]
gate: lived-experience UAT (document-grounded, DBA folder)
verdict: F4 (all facets) + resume current_user bug VERIFIED FIXED live; NEW blocker F5 (harness ctx missing the supabase client + folder-scope + spawn + semaphore) blocks every document-grounded workflow
---

## What passed (live, this UAT)

- **F4 Facet A (sub-agent parent_run_id FK): FIXED.** Harness Research→Summarize on the DBA folder created a sub-agent (`sub_run_id=8803e47e`) with **no** `runs_parent_run_id_fkey` violation. The research phase executed and the sub-agent ran its loop.
- **F4 Facet B groundwork:** the run kicked off, message POST → 201, SSE stream opened on the producer run id.
- **Resume `current_user` bug (27b12c37): FIXED.** Backend restarts cleanly — no startup-sweep `UUID('asyncpg.UUID')` crash, no stranded runs (operator terminalized the pre-fix `active` run).
- **RAG path REACHED (answers the operator's core concern):** the harness research phase **actually invoked `search_documents`** against the DBA folder — proving Harness workflows ARE document-grounded and do hit the KB retrieval path. The product behaves as a RAG engine in workflow mode; the workflow did not answer generically, it tried to search the user's documents.

## NEW BLOCKER — F5: harness phase ToolContext is missing the supabase client (+ folder-scope/spawn/semaphore)

**Live crash (backend log):**
```
task_service.run_task_sub_agent → dispatch_tool('search_documents')
  → tool_dispatcher._handle_search_documents (:158, ctx.supabase)
  → retrieval_service.search_documents → _vector_search (:48)
  → aexec(supabase.rpc("match_document_chunks", params))
AttributeError: 'NoneType' object has no attribute 'rpc'
```

**Root cause (confirmed in code):**
- Every Supabase-RPC/table tool reads `ctx.supabase` (tool_dispatcher: `search_documents`, `hybrid` search, `ls/tree/grep/glob`, `fetch_document`, skills, code-execution logging — 20+ sites).
- `task_service.py:300` builds `sub_ctx = ToolContext(..., supabase=parent_ctx.supabase, ...)` — inherits from the phase ctx.
- `phase_types._build_phase_tool_context` (:142–153) ALREADY propagates `supabase`, `folder_subtree_ids`, `scoped_folder_path`, `spawn`, `per_run_task_semaphore` via `getattr(ctx, …)`.
- BUT the harness engine ctx (`wf_ctx`, threads.py:1158-1167) only sets: `run_id, producer_run_id, thread_id, current_user, user_settings, redis, pool, emit, retry_feedback`. It does **NOT** set `supabase`, `folder_subtree_ids`, `scoped_folder_path`, `spawn`, `per_run_task_semaphore`. So they all resolve to `None`.
- The Deep `RunContext` (threads.py:1183-1190) DOES set `supabase=supabase` (+ folder scope etc.) — which is why Deep RAG works and harness RAG doesn't.

**Why it surfaced only now:** the harness sub-agent tool-dispatch path was never reachable live until F4 fixed the parent_run_id FK. F4 let the sub-agent call a tool for the first time → the missing-ctx-field gap appeared on the very first `search_documents`.

## Fix shape (bounded — the wf_ctx build sites are the single chokepoint)

`_build_phase_tool_context` already forwards these fields; the fix is to SET them on the engine ctx at the 3 build sites:

| Field | Live (threads.py:1158, in agent_runner scope) | Resume (_build_resume_context :599 + resume_stranded_workflows :672 + main.py sweep; runs.py _harness_continuation) |
|---|---|---|
| `supabase` | the request `supabase` (Depends get_supabase) — same value Deep uses at :1190 | a **service-role** supabase client (no request on the startup sweep) |
| `folder_subtree_ids` + `scoped_folder_path` | the folder-scope locals already computed for the Deep ctx (this is what makes the DBA folder filter apply) | best-effort from the run's stored scope, else None (unscoped) |
| `spawn` | the `_spawn` ref Deep uses | the engine's spawn ref / None if N/A |
| `per_run_task_semaphore` | the per-run semaphore Deep uses | a fresh semaphore for the resumed run |

**Test (close the mock blind spot again):** a live-DB/integration assertion that a harness phase ctx carries a non-None `supabase` and a `search_documents` dispatch through the harness sub-agent path resolves (the mock-pool tests never exercised real `supabase.rpc`). Plus a guard/assertion that wf_ctx carries the 5 fields.

**Confidence this is the LAST major domino:** the ToolContext is the single chokepoint — once the harness ctx carries the same fields Deep's RunContext does, the sub-agent has everything Deep has (and Deep works end-to-end). After F5, the document-grounded workflows should run to completion.

## Disposition

- F4 + resume-current_user: VERIFIED CLOSED live.
- F5: blocks the binding RAG-grounding UAT rows (and every doc-grounded workflow). Route: fold into 092-07 as a deviation fix (same "Harness workflow runs end-to-end" goal + same UAT gate) OR a new gap plan 092-08. MODE-01/MODE-02/CONT-01 stay OPEN until a doc-grounded workflow completes end-to-end.
