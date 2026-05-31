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

## UPDATE 2 (after F5 fix a7be6423) — F4+F5 CONFIRMED WORKING; NEW final gap F6

Re-ran Harness Research→Summarize on the DBA folder. The `harness_audit` trail is COMPLETE and clean (no traceback):
`phase_started(research) → phase_completed(research) → phase_transition → phase_started(summarize) → phase_completed(summarize) → run_completed`.
- **F4 + F5 VERIFIED WORKING:** both phases executed, `search_documents` ran over the DBA docs with NO `None.rpc` crash, the run completed in ~7s, the anchor cleared to NULL (SC#2 natural-completion ✓).
- The product DOES behave as a RAG engine in workflow mode: the workflow searched the user's documents end-to-end.

### NEW BLOCKER — F6: harness workflow output is never surfaced/persisted as the assistant reply

**Symptom:** after a successful run, `GET /threads/{id}/messages` returns ONLY the user message (count=1) — there is NO assistant message. The chat stays empty; a reload shows just the question. The workflow does the work and the answer is dropped. (This is the operator's exact concern: "how is the answer reflected to the user?" — currently it isn't.)

**Root cause (confirmed in code):**
- Design intent D-10 (harness_engine.py:32-34, 555-559): "the FINAL phase's text becomes the assistant message verbatim; the engine sets `ctx.final_output`; the existing message-insert path persists it." `run_workflow` DOES set `ctx.final_output = last_output` (:559).
- BUT the producer-shell finalizer `_shielded_finalize` (threads.py:1342+) persists the assistant message from `_result_sink.get("persist")` (:1359) — and `_result_sink` is populated ONLY by `run_agent_loop` (the Deep path, :1275). In the harness branch `run_agent_loop` never runs (run_workflow runs instead), so `_result_sink` is empty → `_persist` is None → NO assistant message persisted, and nothing emitted as assistant content.
- The "existing message-insert path persists ctx.final_output" hand-off (D-10) was never actually wired: no code reads `wf_ctx.final_output` and routes it into the persist/emit path.

**Fix shape (focused):** after `run_workflow` returns successfully in the harness branch (threads.py ~1168), populate `_result_sink["persist"]` from `wf_ctx.final_output` (the `{"text": ...}` summarize payload) so the existing `_shielded_finalize` persist+emit path writes the assistant message + emits the content on the producer stream — reusing the proven Deep persist path (D-10's intent), keeping rendering identical. Also confirm the content streams/emits so it renders without a reload (Facet B completeness for assistant content, not just phase events).

**This is very likely the LAST domino:** with F4 (runs), F5 (tools/ctx), F6 (output surfaced), the full loop closes — ask → search the user's docs → grounded answer rendered as the assistant reply. The harness path simply was never exercised live before, so each fix peeled one layer (F1→F2→F4→F5→F6); F6 is the surface layer (the user-visible answer). Note: only LIVE UAT caught these — the mock-pool tests + structural-skeleton SSE proof passed through all of them.

## Disposition

- F4 + resume-current_user: VERIFIED CLOSED live.
- F5: blocks the binding RAG-grounding UAT rows (and every doc-grounded workflow). Route: fold into 092-07 as a deviation fix (same "Harness workflow runs end-to-end" goal + same UAT gate) OR a new gap plan 092-08. MODE-01/MODE-02/CONT-01 stay OPEN until a doc-grounded workflow completes end-to-end.
