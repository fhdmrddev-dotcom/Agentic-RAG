# Phase 138: Run-End Honesty (STRETCH) - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A run ends honestly — two independent, additive, backend-only fixes so a run never LOOKS worse (or more "stuck") than it actually was:

1. **RUN-01a:** Baseline/leftover sandbox files seeded at run start (or left over from a prior run in a reused sandbox session) no longer appear as dead "Download unavailable" cards — or as re-surfaced real prior-run files — in the run's `final_output_files` emit.
2. **RUN-01b:** When a run ends CLEANLY (not cancelled/error/timed-out) with non-terminal (pending/in_progress) todos still on the list, a run-end reconciler marks them as not completed instead of leaving the Workspace TODOS panel looking permanently stuck.

Both fixes reuse existing emit/SSE vocabulary (D-14 red line intact — no Deep/Harness/provider-path fork; Deep Mode stays byte-identical). Closes SEED-094 (BUG-260626-02 + BUG-260626-03), both deferred from Phase 123's SC#10 Axis-2 live UAT.

**Explicitly out of scope for this phase** (confirmed in discussion):
- Any new frontend component/file — the todos fix rides entirely on the existing `content` text field; `TodosSection.tsx` is untouched.
- Backfilling/fixing already-existing "stuck" threads from before this phase ships (forward-only).
- Fixing `harvest_output_files`'s redundant re-upload/re-insert of unchanged files on a reused sandbox session (a related but distinct efficiency concern — display-only fix chosen).
- Todo WRITING quality (how descriptive/specific the model's todo content is) — a separate concern from run-end honesty.

</domain>

<decisions>
## Implementation Decisions

### RUN-01b — "Ended with open todos" honesty signal
- **D-01:** Surface the honesty signal as a plain text marker appended to each still-open todo's own `content` field — NOT a new frontend component, NOT a new DB status enum value. Reason: `supabase/migrations/055_todos_table.sql:11` CHECK-constrains `status` to exactly `pending | in_progress | completed` (a 4th value would need a migration + `todos_service.py`'s `_ALLOWED_STATUS` + frontend `normalizeStatus()` — all three would need touching); `TodosSection.tsx` renders `todo.content` verbatim already, so a text-field append needs zero frontend changes. This is also what keeps the phase inside its ROADMAP-flagged "backend-only, small" lane (no G-2 sketch-gate trigger).
- **D-02:** Use the SAME wording for both `pending` and `in_progress` items — do not distinguish "never started" from "was actively in progress." One code path, one string.
- **D-03:** Marker format: a plain parenthetical suffix, e.g. `"Update docs"` → `"Update docs (run ended — not completed)"`. No symbol/icon prefix.
- **D-04:** The marker must NOT stack/repeat. If an item already carries the "(run ended — not completed)" suffix and a LATER run on the same thread also ends cleanly without the model touching that item again, leave it as one note — the reconciler must detect an already-marked item and skip it (exact detection mechanism is Claude's discretion, see below).
- **D-05:** The reconciler fires ONLY on a genuinely clean, complete run end. It must NOT fire on `cancelled`, `failed`, `timed_out`, or (critically — a correctness trap found during codebase scouting, see `code_context` below) the Harness `cap_paused` disposition, since a cap-paused run hasn't actually ended — it's deliberately paused mid-workflow awaiting Continue.
- **D-06 (scope, not a backfill):** Forward-only. The reconciler only affects runs that complete AFTER this phase ships. Do NOT write a backfill script/migration for pre-existing stuck threads.

### RUN-01a — Baseline/leftover file leak in `final_output_files`
- **D-07:** Fix the LIVE EMIT only (what reaches `final_output_files` over SSE) — do not change `harvest_output_files`'s upload-to-Storage / `sandbox_files`-row-insert behavior. It currently re-uploads and re-inserts a DB row for EVERY file present in `/sandbox/output/` on every `execute_code` call within a run (not just newly-created ones) — this is the actual mechanism behind the leak (see `code_context`), but fixing the display does not require fixing the upload/insert side.
- **D-08 (scope):** The redundant re-upload/re-insert itself is deliberately NOT fixed in this phase — logged as a deferred seed candidate instead (see `<deferred>`).

### Claude's Discretion
- Exact mechanism for "already-marked, don't stack" detection (D-04) — e.g. suffix string check vs. a lookup against what was previously replaced.
- Exact mechanism for tracking "this run's genuinely new files" for the RUN-01a emit filter (e.g., a separate per-run accumulator populated from each `harvest_output_files` call's `delta_files` return, rather than filtering `_previous_files_in_run` directly) — see `code_context` for the root-cause finding this should be checked against.
- Where the new todo-reconciler function should live (see `code_context` — `threads.py` and `agent_loop.py` are both G-5-flagged; avoid growing `threads.py`'s inline logic further, prefer a small dedicated function called from `_shielded_finalize` with one new call site).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope / roadmap
- `.planning/ROADMAP.md` — Phase 138 section (~line 301-312): goal, 3 success criteria, depends-on
- `.planning/REQUIREMENTS.md` — RUN-01 (STRETCH requirement text + traceability row)

### Root-cause investigation (SEED + bug reports — treat their "Proposed fix" sections as the locked baseline; this discussion only resolved what they left open)
- `.planning/seeds/SEED-094-run-end-honesty-baseline-emit-leak-and-todo-finalizer.md` — why these two bugs are bundled into one phase; both re-open triggers already fired (this phase)
- `.planning/reported-bugs/BUG-260626-02-phase120-baseline-leak-final-emit.md` — RUN-01a root cause + live re-test finding that the naive "filter iteration==-1" fix is INSUFFICIENT (see code_context)
- `.planning/reported-bugs/BUG-260626-03-todos-stuck-no-run-end-finalizer.md` — RUN-01b root cause + explicit honesty guardrail (never silently auto-complete) + explicit "do not touch frontend / `_handle_write_todos` / `replace_todos` / `todo_updated` shape" constraint

### Schema / service layer
- `supabase/migrations/055_todos_table.sql` — `todos` table, `status` CHECK constraint (`pending`/`in_progress`/`completed` only — no 4th value without a migration)
- `backend/app/services/todos_service.py` — `replace_todos()`: the reusable full-state-replace function (pool/thread_id/todos signature, no ToolContext dependency — the reconciler should be able to call this directly)

### Code sites this phase touches
- `backend/app/services/agent_loop.py:~2442-2496` — `final_output_files` emit (`_emit_metas = list(_previous_files_in_run.values())`, unfiltered — RUN-01a fix site)
- `backend/app/services/sandbox_service.py:~201-361` — `harvest_output_files()` (per-cell delta computation, correctly hash-dedups; also the re-upload-everything mechanism — read but do NOT modify per D-07)
- `backend/app/services/sandbox_service.py:~364-428` — `snapshot_output_baseline()` (seeds `_previous_files_in_run` with `iteration:-1, url:None` at run start)
- `backend/app/services/tool_dispatcher.py:~909-929` — where the baseline snapshot merges into `_previous_files_in_run`; `~1203-1208` where per-iteration harvest deltas merge in; `~2455-2521` — `_handle_write_todos()` (existing full-state-replace + re-select + `todo_updated` emit pattern to mirror for the reconciler)
- `backend/app/api/threads.py:~1580-1762` — `_shielded_finalize()` (the natural hook point — `_terminal_status` is known here BEFORE `finalize_run`'s DB UPDATE; values seen: `completed`/`cancelled`/`timed_out`/`failed`/`cap_paused`)
- `frontend/src/components/panel/TodosSection.tsx` — confirms `content` renders verbatim with zero changes needed for D-01/D-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `todos_service.replace_todos(pool, thread_id, todos)` — already generic (no ToolContext coupling), directly callable from a new reconciler.
- The re-select-then-emit pattern inside `tool_dispatcher._handle_write_todos` (~2505-2516: re-SELECT canonical list ordered by `order_index, created_at`, then `ctx.emit(..., 'todo_updated', todos=todos_payload)`) — the reconciler should reproduce this same shape so the frontend receives a wire payload identical in shape to any other `todo_updated` event.

### Established Patterns
- Full-state-replace is the ONLY way todos are ever mutated (DELETE-all + INSERT-all in one transaction) — the reconciler must go through this same path, not a partial UPDATE.
- `_terminal_status` classification already exists and is computed BEFORE `_shielded_finalize`'s DB write — this is the correct, minimal hook point for gating "did this run end cleanly."
- SHA-256 content-hash is the authoritative dedup key across the sandbox harvest/baseline system (per in-code `PATTERNS.md §S5` reference) — any RUN-01a fix should stay consistent with hash-based identity, not filename.

### Root-cause finding (RUN-01a) — important correctness note for planner/researcher
The original bug report's own proposed fix ("filter `iteration == -1` out of the emit") is confirmed INSUFFICIENT by BUG-260626-02's own live re-test: a REAL prior-run file with a valid, downloadable URL leaked into a later run's final emit — not just the `url:None` baseline seeds. Root cause traced during this discussion: `harvest_output_files()` walks the ENTIRE `/sandbox/output/` directory and re-uploads + re-stamps a fresh `iteration=N, url=<real>` meta entry for EVERY file present, including ones that already existed before this run and were only seeded as `iteration:-1` baseline. The moment the model calls `execute_code` even once in the new run, that walk overwrites the baseline's `iteration:-1/url:None` entry in `_previous_files_in_run` with a fresh real URL — because the file gets re-uploaded to a NEW `execution_id` storage path every time, regardless of whether its bytes are new. A **correct** fix needs to track "genuinely new to THIS run" independently of `_previous_files_in_run`'s mutated state — e.g. accumulate the union of each iteration's `delta_files` return value (which already correctly excludes hash-duplicates) in a separate run-scoped set, and filter the final emit against that, rather than trusting `_previous_files_in_run`'s `iteration` field after the fact. This also naturally matches the existing per-cell delta panel's behavior (a byte-identical regeneration is already treated as "not new" there) — the final aggregate should be consistent with what the per-cell panels already showed during the run, not a separate/different semantic.

### Root-cause finding (RUN-01b) — hook point
The actual `_terminal_status` vs. cancel/error/timeout/cap_paused branch point lives in `backend/app/api/threads.py`'s `_shielded_finalize()` (NOT in `agent_loop.py`, despite the ROADMAP's G-5 flag naming `agent_loop.py` — `agent_loop.py`'s `run_agent_loop()` returns an `AgentLoopResult` and its own terminal classification was moved OUT to `threads.py` per a Phase 089 Plan 03 comment at `agent_loop.py:~2709-2719`). `threads.py` is ITSELF a G-5-firing hot file per the CLAUDE.md ledger ("extraction STILL due — do NOT grow it"). The reconciler's actual logic should live in a small dedicated function (e.g. alongside `replace_todos` in `todos_service.py`, or a new sibling module) and `_shielded_finalize` should only gain a single new call site (`if _terminal_status == "completed": await <reconciler>(...)`), consistent with the "net-new function, not grown inline logic" precedent already used for EVAL-02/SI-01 in this same milestone.

### Integration Points
- New reconciler call site: inside `_shielded_finalize()` in `threads.py`, positioned after step 1 (persist) — `_terminal_status` is already known by this point, before step 2's `finalize_run` DB write.
- New emit filter site: `agent_loop.py`'s existing `if _previous_files_in_run:` block (~2442) — add a run-scoped "new this run" accumulator alongside the existing `_previous_files_in_run` dict, populated wherever `_previous_files_in_run.update(...)` currently happens (`tool_dispatcher.py:~1208`).

</code_context>

<specifics>
## Specific Ideas

- Exact todo marker text locked: `"(run ended — not completed)"` as a parenthetical suffix on the todo's existing content, same wording regardless of prior status (pending or in_progress).
- Confirmed via live query against the local dev DB (2026-07-05): 14 of 51 threads with any todos currently have at least one non-completed item on a run whose status is already `completed` in Postgres — including the exact repro thread `13ae9bfe-318d-41ea-b99e-b56bb3699650` from BUG-260626-03. This is left untouched (forward-only, D-06) but is real, current evidence of the bug's blast radius.

</specifics>

<deferred>
## Deferred Ideas

- **One-time backfill for pre-Phase-138 stuck todos** — 14 threads observed live 2026-07-05 (incl. repro thread `13ae9bfe-318d-41ea-b99e-b56bb3699650`) have non-completed todos on already-completed runs. Explicitly deferred (D-06) — candidate for a future cleanup pass if ever wanted; no re-open trigger beyond "user asks for it."
- **`harvest_output_files` redundant re-upload/re-insert efficiency** — on a reused (not-yet-evicted) sandbox session, every `execute_code` call re-uploads to Storage and re-inserts a `sandbox_files` row for EVERY file in `/sandbox/output/`, not just new ones. Same mechanism behind the RUN-01a display bug, but explicitly NOT fixed here (D-07/D-08) — candidate for a future efficiency-focused seed if storage/DB growth on chatty multi-turn sandbox threads ever becomes noticeable. Suggest planting as a new SEED-NNN at the next `/gsd:new-milestone` or backlog review.
- **Todo content writing quality** (raised by user mid-discussion) — todos sometimes carry generic/vague content (e.g. "search document") instead of a descriptive task name. This is a distinct concern from run-end honesty (whether status gets updated) — it's about how well the model writes todo content in the first place. Not in scope for RUN-01/Phase 138. Candidate for a future prompt-tuning or todo-quality investigation.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring` (NL→workflow authoring spike) — surfaced by `todo.match-phase` (score 0.6) but the match was a generic keyword overlap ("run", "start") with no real thematic relevance to run-end honesty. Reviewed, not folded — no action needed for Phase 138.

</deferred>

---

*Phase: 138-run-end-honesty-stretch*
*Context gathered: 2026-07-05*
