# Phase 268: Expert Spend & Mid-Thread Scope — Research

**Researched:** 2026-09-28
**Domain:** run-row attribution (Postgres + FastAPI service-role writers), spend aggregation SQL, thread PATCH + transcript events, React composer/cockpit leaves
**Confidence:** HIGH on code-path facts (every one read at a file:line this session); MEDIUM on the three new defects below (source-measured, not live-driven: the local DB was down, `ConnectionRefusedError` on `127.0.0.1:54322`)

## Summary

Most of the 268 decisions sit on solid ground, and three have a real answer in the code.

1. **D-268-12a is CONFIRMED.** A scope PATCH during a stream cannot leak into that run:
   - `agent_loop.py` reads `threads.folder_id` exactly **once**, in the preamble of `run_agent_loop` (`:1386-1393`), before the `for iteration in range(max_iterations)` loop at `:2177`.
   - Every per-iteration `ToolContext` (`:2989`) and the resume `ToolContext` (`:2112`) reuse that captured `folder_subtree_ids`.
   - Sub-agents copy `parent_ctx.folder_subtree_ids` (`task_service.py:593`). They never re-read the thread.
   - `_resolve_thread_scoping` also runs once, before the loop (`run_producer.py:711`).
   - So the endpoint does **not** need to 409 while streaming, and UI-SPEC's streaming sub-line and pending note (§5.3/§5.4) **are built**.
2. **D-268-05 as literally written cannot be done without a code move.** The run row is inserted in `send_message` (`threads.py:1495`) **before** the producer resolves the Expert (`run_producer.py:711`). This research recommends moving that one resolution **up** into `send_message` and handing the same `ThreadScoping` object to the producer. That is the only arrangement where the row's `expert_id` and the run's scope come from one object, so it cannot mis-stamp.
3. **Three defects that no decision mentions will break the phase's own success criteria if unhandled** (§Common Pitfalls 1-3):
   - **Harness producer shells already contain their sub-agents' tokens.** The shells at `runs.py:1172`, `harness_engine.py:2795` and `publish_service.py:1623` write `run_usage_box`, which sums sub-agent usage via `phase_types._record_run_usage`. A naive D-268-09 roll-up would **double-count tokens**.
   - **A Deep Continue overwrites the paused segment's tokens.** It reuses the same `runs` row, and `finalize_run`'s unconditional `SET input_tokens = $6` writes only the continuation's totals. SC#1 names "paused/continued runs", and their totals are wrong today.
   - **D-268-07 applied to `runs` alone breaks Deep Continue for two-org users.** `continue_run` reads the cap-paused carrier message with `AND org_id = <run's org>` (`db/runs.py:153-166`, `runs.py:1402`). The carrier row is inserted in `agent_loop.py:390` with no `org_id`. Its org must move with the run's, which forces an `agent_loop.py` edit.

**Primary recommendation:**
- Plan 1 has four parts:
  - Resolve the Expert once in `send_message`.
  - Stamp `expert_id`, `expert_attributed=true` and the explicit org in `insert_run`, with an SQL copy-from-parent for sub-agents.
  - Stamp the same explicit org on every message the turn writes (user, assistant, system-warning, cap carrier).
  - Make the Deep continuation **accumulate** its tokens.
- Do the roll-up by **pricing each row at its own rate** and grouping by root. Add a box-shell exception for tokens.

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
#### Pre-discuss guardrail rulings (operator, 2026-09-28)
- **D-268-01 (G-2 HONOURED):** sketch 268 was run before discuss. The winners are **Chat A · composer chip**,
  **Under Restricted: Save & say** and **Spend A · Expert filter every card follows**. The file is
  `.planning/sketches/268-expert-spend-and-mid-thread-scope/` and it is the acceptance bar for G-4.
- **D-268-02 (267 dependency):** proceed on 267 while it is still `human_needed` (it owes an independent review and
  the operator's G-4 sign-off). 268 reuses only 267's event plumbing (`TRANSCRIPT_EVENT_KINDS`, the system-row
  storage, the history skip, the `MessageItem` early return), and that plumbing passed its live drive. This is
  carried as a risk: if 267's review changes that plumbing, 268's `scope_changed` kind must follow.
- **D-268-03 (G-5 on `retrieval_service.py`):** originally "extraction as plan 1". Re-decided on evidence by
  D-268-14.

#### Attribution: how a run records its Expert (METER-08)
- **D-268-04:** migration **197** adds `runs.expert_id uuid NULL` with **no cascading FK**, so deleting an Expert can
  never turn its runs into "No Expert". A missing join renders as "Deleted Expert". It also adds
  `runs.expert_attributed boolean NOT NULL DEFAULT false`. Rows inserted from 268 on set it `true`, and
  `expert_id NULL AND expert_attributed` means **No Expert**.
- **D-268-05:** the Expert is stamped **at the one run INSERT** (`db/runs.py:67`, via
  `run_lifecycle.register_run_start`). The value is the Expert access-checked for that turn
  (`ThreadScoping.born_for_bundle_id`, `run_producer.py:542-546`), never re-read at report time. Sub-agent rows
  (`task_service.py:553`) and Harness Continue / re-drive shells (`runs.py:1172`) **copy the parent's**
  `expert_id` + `expert_attributed`. A Deep Continue reuses the same row, so nothing changes there.
- **D-268-06:** runs from before 268 are **not backfilled**. They show as a separate **"Not recorded (before
  268)"** line, never as "No Expert" (SC#2). The thread's current Expert is no evidence of the Expert at the time,
  because 267 made swaps possible.
- **D-268-07 (SEED-314 FOLDED):** the same INSERT passes the **validated active org** explicitly (and so do the
  thread and message inserts on the send path), so `autofill_org_id_by_owner` no longer guesses. It is pinned by a
  two-org test that reads the rows back. Without this, a two-org user's Expert spend appears in the wrong org's
  cockpit.

#### `/admin/spend` by Expert (METER-08; sketch Spend A locked)
- **D-268-08:** one server-side filter param, `expert` (`<uuid>` | `none` | `unrecorded` | absent = all), on
  **both** `GET /summary` and `GET /runs`. KPIs, the 14-day chart, the donut and the ledger all follow it, and a
  test asserts all four move together (the 257 "two dialects" lesson). A line under the ribbon states the current
  filter.
- **D-268-09 (sub-agent roll-up):** spend today excludes `parent_run_id` rows (`db/rates.py:384`, `:628`). 268
  **rolls every descendant's tokens up into its root run** and attributes them to the root's Expert, so the org
  total rises. The change is called out in the phase summary and on the Blind Spots card ("sub-agent tokens now
  counted"), never slipped in silently.
- **D-268-10:** the per-Expert breakdown is an `expert_breakdown` array in `get_org_spend_summary`, costed with
  `cost_usd_sql()`, the **one** 257 token→USD home (`test_257_single_token_conversion_home.py` still passes).
  Attribution is a column, never a second formula. The "Spend by Expert" table lists every Expert with runs in the
  window, plus `No Expert` (always, even at $0) and `Not recorded (before 268)` (when non-zero). A reconciliation
  footer checks that the lines sum to the org total.
- **D-268-11:** the handoff-summary LLM call (`thread_handoff.py:28`, routed here) is **disclosed, not metered**.
  Blind Spots names it, and a seed is planted for metering non-run calls.

#### Changing scope mid-thread (CHAT-08; sketch Chat A + Save & say locked)
- **D-268-12:** extend the existing `PATCH /threads/{id}` (`ThreadUpdate`, `models/thread.py:18`) with
  `folder_id` + `clear_folder`, the same shape as 267's `active_expert_id` / `clear_active_expert`. It writes a new
  **`scope_changed`** kind in `TRANSCRIPT_EVENT_KINDS` in the **same transaction** as the UPDATE (the
  `_write_expert_change` pattern). The event row sets `org_id` from `threads.org_id` (D-267-34). The event is
  skipped by `_reconstruct_history`, so it never reaches the model.
- **D-268-12a (streaming):** a change while an answer streams is **allowed and applies from the next turn**. The
  folder is read at run start (`run_producer.py:430`). ⚠ **Research must prove** that `agent_loop.py:1387` also
  reads `threads.folder_id` only once per run. If it reads again mid-run, the endpoint returns 409 while streaming,
  as 267 does for Expert changes.
- **D-268-12b:** a thread with **no messages** is updated with **no event** (consistent with D-267-12).
- **D-268-12c (one payload):** the chip, the picker's ledger (*Next message searches / Stops searching*, or
  *Saved / Searching* under Restricted) and the transcript card all render from **one structured payload** built
  by `compose_expert_scope` (`expert_scope.py:85`). The frontend never re-derives the Expert rule (D-267-11).
  Under a **Restricted** Expert the change is **saved**. The chip is dashed and reads `· not searched`, and the card
  reads "Takes effect when <Expert> leaves" (sketch *Save & say*).
- **D-268-12d:** the composer chip goes into `MessageInput.tsx`'s existing chip row (`:508-541`), next to
  `ActiveExpertChip`. `showChipsRow` and the "Using:" condition widen to include it. The empty-state `<select>` in
  `ChatArea.tsx` (`if (!thread)`) stays for new threads. **One PATCH home** in `ChatArea.tsx`, beside
  `applyExpertChange`: a refusal reverts the chip, and a success reloads the transcript.

#### Proof, plan shape and G-5
- **D-268-13:** SC#3's "retrieved-chunk records" do not exist. The fix is additive: `run_id` + `thread_id` go into
  the existing `search.query` audit metadata (`tool_dispatcher.py:945-954`). Proof joins run → `document_ids` →
  `documents.folder_id` and checks it is ⊆ the new scope subtree. No new table.
- **D-268-14 (G-5, evidence-based):** scope already reaches `retrieval_service.search_documents(folder_ids=…)` as a
  parameter that is read fresh each turn. **If no plan's `files_modified` names `retrieval_service.py`, the
  extraction is NOT done.** The record then reads "G-5 not fired: file unmodified; SEED-224 extraction stays owed".
  If any plan does edit it, the SEED-224 extraction becomes plan 1 as a pure move before the feature.
- **D-268-15 (G-8):** **4 plans.**
  1. Migration 197, the stamp at insert, the parent copy, the SEED-314 explicit org, and the sub-agent roll-up SQL.
  2. The spend API filter + `expert_breakdown`, and the `AdminSpendPage` filter / table / reconciliation.
  3. The scope PATCH + `scope_changed` event + payload, the composer chip + picker + `ScopeEventCard`, and the audit
     `run_id`.
  4. Live proof: SC#1-4, the 8-row SC#10 board, G-4 ×3 in Chrome, and the registers.
- **D-268-16 (G-4 scenarios, fixed at scope time):**
  - **G4-1:** swap Expert mid-thread. The thread's cost splits correctly across two Expert lines on `/admin/spend`,
    and each line equals the sum of its runs' persisted tokens.
  - **G4-2:** change scope mid-thread. The next answer cites only the new folder, the audit join proves it, and the
    card survives a reload.
  - **G4-3:** with HR Advisor (Restricted) active, change scope. The chip reads "not searched", the card reads
    "Takes effect when HR Advisor leaves", and the answer still comes from HR Policies.
- **D-268-17 (SC#10):** the CHAT-08 per-turn retrieval scope is scored on the full native roster + OpenRouter, 8
  rows derived from `MODEL_CAPABILITIES`. Rows may be blocked but never omitted, and each row is driven with a
  per-request `model` + `provider`.
- **D-268-18:** the migration is applied through the SQL editor, `full-schema.sql` is regenerated, and the
  migration is added to the production deploy checklist with `get_advisors(security)`. `runs` keeps its RLS, and the
  new columns need no new policy. This is verified, not assumed.

### Claude's Discretion
- Exact component names (`ScopeChip`, `ScopeEventCard`), copy strings (ported from the sketch and fenced), and the
  exact SQL shape of the recursive roll-up. It must reuse `cost_usd_sql()`.

### Deferred Ideas (OUT OF SCOPE)
- Metering the handoff-summary call and other non-run LLM calls (D-268-11). Plant a seed.
- A dedicated `run_retrievals` table (D-268-13 uses the audit metadata instead).
- The SEED-224 `retrieval_service.py` extraction, unless a plan edits that file (D-268-14).
- SEED-303 S8 (clone-on-customise) and the dispatch-side whitelist: still open, not 268.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| METER-08 | Token usage and USD cost are attributable per Expert; `/admin/spend` can group or filter by Expert. | §Q2 (insert-site inventory + stamp mechanism), §Q3 (explicit org), §Q4 (roll-up SQL + double-count rule), §Q5 (API/wire shape), Pitfalls 1-3, 5-7 |
| CHAT-08 | A user can change a thread's folder scope after the thread starts; the change appears in the transcript and retrieval uses the new scope from the next turn (SEED-286). | §Q1 (single read proven), §Q6 (PATCH + event + ScopeEffect), §Q7 (audit run_id), §Q8 (no retrieval_service edit), Pitfalls 4, 8-11 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Backend:**
  - Python `venv`.
  - Raw SDK calls only: no LangChain/LangGraph.
  - Pydantic for structured payloads.
  - `run_in_threadpool`/`aexec` for blocking `supabase-py` I/O inside async handlers (D-v2.5-01).
- **Backend unit gate:** `node scripts/check-backend-unit-baseline.cjs`, ceiling **71 failed, zero headroom**. Diff the failed **set** against a base captured before the first edit. A new red is a gate break.
  - `tests/unit/test_db_runs.py::test_insert_run_passes_args_positionally` and the two `insert_assistant_message` shape tests are **already in the inherited 71** (267-BASELINES.md:46-48).
  - Touching `insert_run` / `insert_assistant_message` must not add new failures. It may flip these to green, which lowers the count and is allowed.
- **RLS on every table.** New columns on `runs` inherit `runs_select_own` (SELECT only, `full-schema.sql:7726`). No INSERT/UPDATE policy exists: every `runs` writer is the service-role asyncpg pool.
- **Migrations:**
  - The next file is `supabase/migrations/197_<name>.sql` (the last is `196_documents_dedup_idx_org_scoped.sql`, verified by `ls`).
  - Apply by pasting into the SQL editor. **Never** `supabase db push`/`db reset`.
  - Then run `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`.
  - Production: add it to the deploy checklist with `get_advisors(security)`. Supabase MCP **writes need per-action operator approval**.
- **SSE / stateless chat:** transcript events must never reach a model (`_reconstruct_history` skip).
- **Realtime is a hint.** The frontend reconciles by fetch (the UI-SPEC refetch-after-PATCH rule honours this).
- **Frontend gates:**
  - `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root. Every new suite joins **both** `TARGETS` and `BASELINE`.
  - Typecheck with `npx tsc -p tsconfig.app.json --noEmit` as a **set diff** against the base (70 errors at 267's close). `npx tsc --noEmit` checks zero files.
- **G-5:** `node scripts/check-hot-file-ledger.cjs 268` must pass after planning. **`backend/app/db/runs.py` has NO ledger row and FIRES** (see §Q10).
- **G-8:** 3-5 plans (D-268-15 = 4). Run TARGETED suites per task and FULL gates once per wave.
- **G-4:** Chrome drives all three G4 scenarios on both themes.
- **SC#10:** 8 rows derived from `MODEL_CAPABILITIES`. A row may be blocked but is never omitted.
- **Provider-docs-first:** not triggered. 268 adds no provider-specific prompting, streaming or tool-call behaviour. The board only proves that scope is honoured per turn across providers.
- **Worktrees:** bootstrap each one with `bash scripts/bootstrap-worktree.sh "$(pwd)"` and tear it down with `scripts/teardown-worktree.sh`, never `rm -rf`. **Serialize any plan whose tests mutate the local DB** (plan 1's integration two-org test and plan 4's live drive).
- **`graphify update .`** after code changes, run on the main tree after merge.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide which Expert a turn runs with | API / Backend (`send_message` → `_resolve_thread_scoping`) | — | Access-checked server-side (`resolve_expert_bundle`); the client never names it |
| Stamp `expert_id` / `expert_attributed` / `org_id` on a run | Database write layer (`db/runs.insert_run`, service-role pool) | API (`send_message` passes the values) | One INSERT home; the parent copy is done in SQL, so it cannot drift |
| Roll sub-agent spend into the root; price per row | Database (SQL in `db/rates.py` using `pricing_service.cost_usd_sql`) | — | 257 single token→USD home; aggregation must happen in Postgres |
| Expert filter + `expert_breakdown` | API (`admin_spend.py`, operator-gated) | Browser (pills, table, recon footer) | The server filters; the client only renders and re-sums independently for the footer |
| Change a thread's folder + write `scope_changed` | API (`rename_thread` PATCH, user-JWT txn) | Database (RLS-as-caller `get_user_pg_connection`) | Same transaction as the UPDATE (the `_write_expert_change` precedent) |
| What the next message will search (`ScopeEffect`) | API (`expert_scope.describe_expert_scope` + pure builders) | Browser renders only | D-267-11: the frontend never re-derives the Expert rule |
| Per-turn retrieval scope | API (`agent_loop` preamble / `_resolve_thread_scoping`) | — | Read once per run (proven §Q1); `retrieval_service` untouched |
| Retrieval evidence for SC#3 | API (`tool_dispatcher` `search.query` audit metadata) | Database (`audit_log`) | Additive keys; the join is done in SQL at proof time |

## Research answers (the 12 questions, with file:line evidence)

### Q1 — D-268-12a: does anything re-read `threads.folder_id` mid-run? **No. Verdict: a streaming PATCH cannot leak into the in-flight run, so there is no 409.**

| Reader | Where | When | Evidence |
|---|---|---|---|
| `agent_loop.run_agent_loop` | `agent_loop.py:1386-1393` (`.select("folder_id")…single()`) | Once, in the preamble, before the loop | The loop starts at `:2177` (`for iteration in range(max_iterations)`). `folder_subtree_ids`/`scoped_folder_path` are locals set at `:1396-1429` [VERIFIED: codebase read] |
| Per-iteration `ToolContext` | `agent_loop.py:2989-2998` | Every tool round | Passes the **captured locals** `folder_subtree_ids=folder_subtree_ids` and does not read the DB [VERIFIED] |
| Resume `ToolContext` (dropped-call re-drive) | `agent_loop.py:2112-2121` | Once, before the loop | Same captured locals [VERIFIED] |
| `run_producer._resolve_thread_scoping` | `run_producer.py:429-434` | Once per producer invocation (`:711` Deep, `:887` continuation) | Called before `RunContext` is built [VERIFIED] |
| Sub-agents | `task_service.py:593` `folder_subtree_ids=parent_ctx.folder_subtree_ids` | At spawn | Copied from the parent; no DB read [VERIFIED] |
| `search_documents` / `query_documents` | `tool_dispatcher.py:787` / `_handle_query_documents` | Per call | Read `ctx.folder_subtree_ids` [VERIFIED] |
| Harness | `workflow_kickoff.py:380` | Once at kickoff (a thread-folder fallback for unbound workflows) | Not the Deep path. Harness resume/Continue may re-read it as a fallback on the NEXT segment only |

Two boundaries the planner must state honestly (Pitfall 8):
- **Deep Continue is a new loop invocation on the same run row.** `spawn_continuation_run` re-calls `_resolve_thread_scoping` (`run_producer.py:887`) and `run_agent_loop` re-reads the folder. A scope change made while a run is `cap_paused` therefore **applies to the continued segment**. That run is paused, not streaming, and 267's `_thread_has_active_run` is `status='streaming'` only (`threads.py:876-888`).
- **A sub-second race exists at the start of a run.** The run row is inserted as `streaming` before the producer reads the folder, so a PATCH landing between `POST /messages` and the producer preamble is applied to that run while the card would say "the answer in progress keeps {from}". This is a low-severity window. It can be closed only if the send path pins the folder too (see Q2's Option A note).

### Q2 — D-268-05: getting the access-checked Expert to the INSERT, and every INSERT site

**The ordering problem:**
- `send_message` inserts the run at `threads.py:1495` (`register_run_start` → `run_lifecycle.py:285` → `db/runs.py:67`).
- The Expert is resolved only later, inside the detached producer (`run_producer.py:711`).
- `send_message`'s thread read selects only `id, active_workflow_run_id` (`threads.py:1368-1374`).
- The Harness-vs-Deep branch **is** known before the insert: `_kickoff_definition is not None` means Harness. `preflight_workflow_kickoff` 409s a send on an anchored thread.

| Option | Mechanism | Can it mis-stamp? |
|---|---|---|
| **A (RECOMMENDED)** — resolve once, up front | In `send_message`, when `_kickoff_definition is None`, call `_resolve_thread_scoping(supabase=service_supabase, …)` **before** `register_run_start`. Stamp `expert_id=_scoping.born_for_bundle_id`, then pass the **same object** to `run_producer(…, scoping=_scoping)`. The producer's Deep branch uses it and falls back to resolving only when `scoping is None` (keeps every existing test's call shape). On exception, keep the exception, stamp `expert_id=None`, and pass `scoping_error=exc`; the producer's Deep branch re-raises it **inside its existing try**. The run then fails exactly as today (`failed: ExpertScopeUnavailable: …` in `runs.error`, same SSE terminal). | **No.** One object stamps the row and scopes the run. A failed resolution means no Expert was applied, and the run carries 0 tokens |
| B — UPDATE after resolve | Insert `(NULL, true)`, then `UPDATE runs SET expert_id=$2` after `_resolve_thread_scoping` in the producer | Yes: if the UPDATE fails, that Expert's tokens land in "No Expert". It also contradicts D-268-05's "at the one run INSERT" |
| C — resolve twice | Read `active_expert_id` + access-check in `send_message`, and the producer resolves again | Yes: a PATCH between the two reads stamps one Expert and scopes another. **Reject** |

⚠ **Option A constraints the planner must carry:**
- The resolution adds its DB round trips (thread read, role, bundle, folders) to the POST latency. These already happen in the producer; total time is unchanged.
- `_resolve_thread_scoping` has a **side effect**: it clears a stale `active_expert_id` (`run_producer.py:462-470`). Moving the call keeps that behaviour.
- `test_264_born_for_carrier.py:154-165` pins **exactly 2** `born_for_bundle_id=` keyword args in `run_producer.py`. Passing `scoping=` and reading `.born_for_bundle_id` as an attribute keeps it green. **Do not add a third `born_for_bundle_id=` keyword** anywhere in `run_producer.py`.
- The continuation build (`run_producer.py:887-914`) keeps its own resolution, because its row was already stamped. That matches D-268-05's "Deep Continue: nothing changes". The one hazard is an Expert changed while `cap_paused`, see Pitfall 8.

**The copy-from-parent mechanism (recommended):** do it **in SQL inside `insert_run`**, not by plumbing through the ctx:

```sql
-- db/runs.py insert_run (sketch — $N placeholders only, T-073-02)
INSERT INTO runs (run_id, thread_id, user_id, status, model, provider,
                  spawned_by_worker, parent_run_id, org_id, expert_id, expert_attributed)
SELECT $1, $2, $3, $4, $5, $6, $7, $8,
       COALESCE(p.org_id, $9::uuid),                 -- sub-agent: parent's org (SEED-314 class, Pitfall 3)
       CASE WHEN $8::uuid IS NULL THEN $10::uuid ELSE p.expert_id END,
       CASE WHEN $8::uuid IS NULL THEN true ELSE COALESCE(p.expert_attributed, true) END
FROM (SELECT 1) one
LEFT JOIN public.runs p ON p.run_id = $8::uuid
```
When `$9` is NULL and there is no parent, the mig-106 trigger still fills `org_id`, which is byte-identical for single-org users.

**Every `runs` INSERT path** [VERIFIED: `grep -rn "insert_run(" app/`, 9 sites + 1 test route]:

| # | Site | Row | `expert_id` / `expert_attributed` | `org_id` | Edit needed? |
|---|---|---|---|---|---|
| 1 | `threads.py:1495` → `run_lifecycle.register_run_start` (`:285`) | Deep chat producer | `scoping.born_for_bundle_id` / `true` | validated active org (`resolve_active_org_or_none`, already computed at `threads.py:1364`) | **yes** (`threads.py`, `run_lifecycle.py`, `db/runs.py`) |
| 1b | same insert, `_kickoff_definition` set | Harness live-kickoff producer | `NULL` / `true`: the harness branch never resolves an Expert (`run_producer.py:645-705`) | active org | yes (same call) |
| 2 | `task_service.py:553` | sub-agent (Deep or harness) | **copied from the parent row in SQL** | parent's org in SQL | **no edit** (the SQL does it) |
| 3 | `runs.py:1172` | Harness Continue shell (`model='unknown'`) | `NULL` / `true` (harness = No Expert) | trigger (unchanged) | no |
| 4 | `harness_engine.py:2795` (`_build_resume_context`) | resume shell (boot sweep, ask_user re-drive `runs.py:~650`, scheduler `scheduler_service.py:~270`) | `NULL` / `true` | trigger | no |
| 5 | `publish_service.py:1623` | publish golden-run shell | `NULL` / `true` | trigger | no |
| 6-8 | `evals.py:331`, `:1932`, `:2643` | eval run companions | `NULL` / `true` (evals have no Expert; `test_264_born_for_carrier.py:282-297` pins that eval/harness pass no born-for id) | trigger | no |
| 9 | `test_fixtures.py:115` (supabase `.insert`) | test-only route | DB default → `expert_attributed=false` ("Not recorded") | trigger | no (test surface) |
| — | Deep Continue (`runs.py:1405` → `spawn_continuation_run`) | **same row, no INSERT** | unchanged | unchanged | **the token overwrite, Pitfall 2** |

**Justification for (NULL, true) on workflow/eval/scheduled rows:**
- `expert_attributed=true` means "attribution was recorded". These runs are recorded, and they ran with no Expert (the harness and eval builders never compute one; `born_for_bundle_id` is None there by the 264 fence). "No Expert" is the true statement.
- "Not recorded (before 268)" must mean only "pre-268".

**Make the defaults do the safe thing, and fence the sites:**
- `insert_run(..., org_id: UUID | None = None, expert_id: UUID | None = None)`. The SQL always writes `expert_attributed = true`, with the parent copy for sub-agents.
- A new AST fence, `test_268_insert_run_sites.py` (modelled on `test_256_judge_usage_counted.py`'s `_EXPECTED_FORCED_EMIT_SITES`), enumerates every `insert_run(` call in `app/` with its disposition: `STAMP` | `COPY-PARENT(SQL)` | `NO-EXPERT(harness/eval/golden)`.
- A new call site fails the fence until someone decides it. That is the 257 "5-site lesson" made executable, without touching the six hot files the no-edit rows live in.

### Q3 — D-268-07 / SEED-314: which inserts omit `org_id`, and the minimal change

All three chat tables carry `BEFORE INSERT … autofill_org_id_by_owner('user_id')`. The function short-circuits when `NEW.org_id IS NOT NULL`; otherwise it runs `SELECT org_id FROM org_members WHERE user_id=… LIMIT 1` with no `ORDER BY` (`106_org_id_autofill_trigger.sql:86-101`, triggers `:208-218`, `:250-252`) [VERIFIED].

The validated org is `resolve_active_org_or_none(request, current_user)` (`dependencies.py:1020`):
- It returns `None` when there is no `X-Org-Id` header, or when the header names a non-member org.
- `send_message` stamps it onto a **copy** of `current_user` (`threads.py:1364-1366`).
- `get_current_user` itself returns only `{id, email}` (`dependencies.py:493/738`), so `current_user.get("org_id")` is None exactly when there is no validated header. Passing it explicitly is therefore **byte-identical for single-org / no-header callers**, because the trigger still decides.

| Insert on the turn's path | Today | Change |
|---|---|---|
| thread — `create_thread` `threads.py:761-773` | `org_id` only when an Expert is given (`:770`) | add `insert_data["org_id"] = await resolve_active_org_or_none(...)` when non-None |
| user message — `threads.py:1411-1426` (user-JWT supabase) | omitted | `_user_msg_row["org_id"] = active_org_id` when set |
| run — `db/runs.py:67` via `register_run_start` | omitted | `org_id` kwarg (Q2 SQL) |
| sub-agent run — `task_service.py:553` | omitted | parent's org in SQL (no call-site edit) |
| assistant message — `agent_loop.py:1959` → `db/runs.insert_assistant_message` (`:205-226`) | omitted | `org_id` kwarg; `agent_loop` passes `current_user.get("org_id")` |
| **cap-paused carrier** — `agent_loop.py:390` (`persist_cap_paused`) | omitted | `"org_id"` when set. ⛔ **Mandatory, see Pitfall 3** |
| system-warning rows — `agent_loop.py:2002` | omitted | `"org_id"` when set (same class) |

⚠ **This forces an `agent_loop.py` edit** (CONTEXT expected it "read-only unless D-268-12a forces an edit"; it is D-268-07 that forces it):
- The edit is three insert dicts and one kwarg.
- The file is AST-fenced against any name containing `expert`. `org_id` is safe.
- Record it as "honoured by construction: 4 org stamps, 0 branches".

**Two-org test design** (extend the proven `test_267_transcript_rows_rls.py` fixture shape):
- Subject U is a member of A (the trigger's `LIMIT 1` pick, derived and never assumed) and of B.
- The fixture asserts the trigger's pick ≠ B (a precondition, as in `test_subject_is_two_org_and_the_trigger_picks_the_wrong_org`).
- Drive the real writers (`insert_run` via `register_run_start`, `insert_assistant_message`, `persist_cap_paused`'s insert, the user-message insert) with active org B.
- Read the rows back. Assert thread, user message, run, sub-agent run, assistant message and cap carrier are all B.
- Add a **Continue-lookup case**: `load_cap_paused_tool_calls(pool, thread, org_id=<run's org>)` returns the carrier.
- Include a no-org control that still lands in A. Plant RED by removing one explicit org.
- It needs a live local DB, so the plan is **serialized** (worktree rule 4).

⚠ **The thread-org ≠ active-org case is real and unresolved** (Open Question 1). `list_threads` is not org-scoped (`threads.py:255-272`), so a two-org user can send in an org-A thread with `X-Org-Id: B`.

### Q4 — D-268-09: the roll-up SQL, the double-count risk, and performance

**Is any sub-agent's usage already inside its parent's row?**

| Root kind | Root row's tokens come from | Includes sub-agent tokens? | Evidence |
|---|---|---|---|
| Deep chat producer | `result_sink` (`agent_loop.py:1889`, `:2318-2322`, only the loop's own provider usage) | **No** | `task_service` keeps its own `_sub_usage` (`task_service.py:743`, `:863`) and finalizes the sub row only (`:902`) |
| Harness live-kickoff producer (row from `send_message`) | `_finalize_producer_run` reads `_result_sink`; the harness branch installs nothing (`run_producer.py:686-697`) | **No**: the row's tokens are NULL | the box goes to `workflow_runs` via `persist_run_usage` |
| **Harness shells** — Continue `runs.py:1354-1373`, ask_user `runs.py:681-702`, resume `harness_engine.py:3187-3207`, scheduler `scheduler_service.py:315-335`, golden `publish_service.py:~1707` | `ctx.run_usage_box` | **YES**: `phase_types._record_run_usage` (`phase_types.py:768-790`, called at `:917`, `:1028`, `:1586`, `validator_kinds.py:629`) sums every completed sub-agent into the box. Sub-agent rows point to that shell (`phase_types.py:604-617`, `producer_run_id`) | [VERIFIED] |

So a plain "root + descendants" token sum **double-counts tokens under harness shells**. USD does not double-count today, only by accident: shells are inserted with `model='unknown', provider='unknown'`, have no rate, and so `cost_usd_sql` yields NULL for them.

**Nesting depth is 1:**
- `_handle_task` refuses inside a sub-agent (`tool_dispatcher.py:4304-4308`, D-085-12).
- So `root_run_id = COALESCE(parent_run_id, run_id)` is exact and no recursive CTE is needed.
- A recursive CTE is acceptable if the planner wants depth-independence. It adds cost and no current value.

**Recommended SQL shape** (one CTE feeds totals, daily, model and the Expert breakdown, so they cannot disagree):

```sql
WITH roots AS (
  SELECT r.run_id, r.org_id, r.started_at, r.model, r.provider,
         r.expert_id, r.expert_attributed,
         (r.model = 'unknown' AND r.provider = 'unknown') AS is_box_shell   -- see note
  FROM public.runs r
  WHERE r.org_id = $1
    AND r.parent_run_id IS NULL
    AND ($2::timestamptz IS NULL OR r.started_at >= $2)
    AND ($3::timestamptz IS NULL OR r.started_at <= $3)
    -- expert filter, bound params only:
    AND ($4::text IS NULL
         OR ($4 = 'unrecorded' AND NOT r.expert_attributed)
         OR ($4 = 'none'       AND r.expert_attributed AND r.expert_id IS NULL)
         OR ($4 NOT IN ('none','unrecorded') AND r.expert_attributed AND r.expert_id = $4::uuid))
),
members AS (           -- the root itself + its direct sub-agents (depth-1 cap)
  SELECT ro.run_id AS root_run_id, ro.org_id AS root_org_id, ro.is_box_shell,
         m.run_id, (m.run_id = ro.run_id) AS is_root,
         m.model, m.provider, m.started_at, m.input_tokens, m.output_tokens
  FROM roots ro
  JOIN public.runs m ON m.run_id = ro.run_id OR m.parent_run_id = ro.run_id
  -- ⛔ NO predicate on m.org_id: a pre-268 sub-agent row may carry the trigger's org (Pitfall 3)
),
priced AS (
  SELECT m.*, rate.input_cost_per_million, rate.output_cost_per_million,
         <cost_usd_sql("m", "rate")> AS cost_usd          -- each row at ITS OWN model/provider/date
  FROM members m
  LEFT JOIN LATERAL ( … the existing 257 lookup, but mr.org_id = m.root_org_id … ) rate ON true
),
per_root AS (
  SELECT root_run_id,
         SUM(cost_usd) AS cost_usd,                                      -- NULLs skipped
         SUM(input_tokens)  FILTER (WHERE is_root OR NOT is_box_shell) AS input_tokens,
         SUM(output_tokens) FILTER (WHERE is_root OR NOT is_box_shell) AS output_tokens,
         COUNT(*) FILTER (WHERE NOT is_root) AS subagent_count,
         BOOL_OR(is_root AND input_cost_per_million IS NOT NULL) AS root_rated,
         COUNT(*) FILTER (WHERE NOT is_root AND input_cost_per_million IS NULL) AS unpriced_subagents
  FROM priced GROUP BY root_run_id
)
…
```

- **Price each member at its own rate, never re-price at the root's model.**
  - Sub-agents resolve their own model: `_resolve_sub_agent_effective_model` may pick the provider's FAST default (`task_service.py:541-544`).
  - `cost_usd_sql(runs_alias, rate_alias)` already takes aliases (`pricing_service.py:27`), so this reuses the one home. `test_257_single_token_conversion_home.py:187-194` greps for `_cost_per_million / <digit>` outside `pricing_service.py`, and this shape writes none.
- **Box-shell token rule.** A box-shell root counts its own tokens only, because they already include its sub-agents. Its **USD** still sums the sub-agents' priced rows, because the shell itself is unpriced. The marker used here is the placeholder literal pair, written by exactly three sites (`runs.py:1180`, `harness_engine.py:2805`, `publish_service.py:1629-1630`). Two options:
  - **(a)** keep the literal predicate and add a fence test pinning that exactly those three sites write `model="unknown"`; or
  - **(b)** add `runs.tokens_include_subagents boolean NOT NULL DEFAULT false` in migration 197 and set it at the three sites (three more hot-file edits).
  - Recommend **(a)**. It is Claude's discretion (the "exact SQL shape" area).
  - ⚠ If an operator ever registers a rate for model `unknown`, shell USD would double-count. Name this in the fence.
- **"Runs" stays the root count.** 257's CR-06 `rated`/`unrated`/`unmeasured` keep their root meaning. Add `unpriced_subagents` as a new honest counter so a rated root with an unrated sub-agent is not silently under-priced (Open Question 3).
- **Daily chart:** bucket by the **root's** `started_at`.
- **Donut (model share):** group `priced` by **member** model, so sub-agent spend lands under the model that incurred it (UI-SPEC D5 keeps it "Model Spend Share").
- **Ledger (`get_spend_runs`):** return roots with `per_root` totals plus `subagent_count`, `expert_id`, `expert_attributed` and the Expert name. The **count query must carry the same root + Expert predicates** (the 257 LATERAL lesson at `rates.py:600-612`).
- **Performance:**
  - `idx_runs_parent` (partial, `full-schema.sql:4740`) serves the member join.
  - `idx_runs_org_id` (`:4733`) serves the roots scan.
  - At the measured dev scale (1,595 runs in the busiest org, `rates.py:602-604`) no new index is needed.
  - Optional for migration 197: `CREATE INDEX … ON runs (org_id, started_at) WHERE parent_run_id IS NULL`. It is not required.
  - `ADD COLUMN … DEFAULT false` is metadata-only on PG ≥ 11 [ASSUMED: standard Postgres behaviour].

### Q5 — D-268-08 / D-268-10: endpoint shapes and the minimal additive change

**Today:**
- `GET /admin/spend/summary` takes `org_id`, `start_time`, `end_time` (`admin_spend.py:84-121`).
- `GET /admin/spend/runs` takes `org_id`, `limit`, `offset`, `filter_status`, `time_range` (`:123-147`).
- The frontend's `loadAll` builds both (`AdminSpendPage.tsx:126-137`). `goToLedgerOffset` builds the runs call a second time (`:203-235`).

**Change:**
- **Backend params:** `expert: str | None = Query(None)` on both routes, validated as `^(none|unrecorded|[0-9a-f-]{36})$`, else 422. Always bind it as `$N`, **never** f-string it (the existing `time_clause` f-string is static text; the Expert value is user input).
- **`get_org_spend_summary(..., expert=None)`** returns everything it returns today (filtered), plus:
  - `expert_breakdown: [{key, expert_id, name, deleted, scope_mode, run_count, input_tokens, output_tokens, spend_usd, unrated_count}]`. It is **always computed WITHOUT the Expert filter**: the table is the navigator (UI-SPEC §5.6 ⛔).
  - `window_total_usd` and `window_run_count`, **unfiltered**. The Org-total row and recon footer compare against these. When filtered, `total_spend_usd` is the filtered figure, so the footer needs its own.
- **Name join:**
  - `LEFT JOIN public.expert_bundles eb ON eb.id = ro.expert_id AND (eb.is_system OR eb.org_id = ro.org_id)`.
  - No join → `deleted: true`, rendered "Deleted Expert {id8}".
  - The org predicate is defence-in-depth, so a cross-org id can never leak another org's Expert name into this cockpit. `expert_bundles` is `org_id` NULL for system rows (`CHECK check_org_or_system`, `full-schema.sql:1757`).
  - Hard deletes exist (`db/experts.py:470`), which is why there is no FK (D-268-04).
- **Always emit the `none` line** (even `0 · 0 · 0.0000`). Emit `unrecorded` only when non-zero.
- **`get_spend_runs` items gain:** `expert_id`, `expert_name`, `expert_deleted`, `expert_attributed`, `subagent_count`. The `SpendRunItem`/`SpendSummaryData` types in `frontend/src/types/spend.ts` and the mappers in `frontend/src/lib/api/spend.ts` gain the camelCase twins. **`goToLedgerOffset` must pass `expert` too** (UI-SPEC §5.6 ⛔).
- **The "continued" ledger tag (UI-SPEC §5.8) has no data source.** The Continue, resume, scheduler and golden shells all look identical in `runs` (`model='unknown'`). Either drop the tag or add a column. Recommend dropping it (Open Question 4).

### Q6 — D-268-12: the PATCH, the event, `ScopeEffect`, and the folder authorization

- **`ThreadUpdate`** (`models/thread.py:18-21`): add `folder_id: UUID | None = None`, `clear_folder: bool = False`. Mirror the 267 clear idiom (`threads.py:968-969` uses `model_fields_set`). **Reject a body that changes both the Expert and the folder** (422). One PATCH writes one event, and the UI never sends both.
- **`rename_thread` flow** (`threads.py:955-1067`), a new arm beside the Expert arm, same shape:
  1. Read the thread (`folder_id, active_expert_id, org_id`) under the user JWT; 404 if missing.
  2. **Authorize the new folder.** It must be in `fetch_visible_folders(supabase, user_id, restrict_org_ids={thread.org_id})` (`folder_utils.py:222-267`, the one SEED-124 visibility home) **and** that folder row's `org_id == thread.org_id`. Otherwise 404/403 with a literal detail.
     - Today `create_thread` accepts any `folder_id` unchecked (`threads.py:762-763`), and `agent_loop._get_subtree` includes the root id even when it is invisible (`agent_loop.py:1401-1408`). Do not copy the create path.
  3. If the value is unchanged → no-op.
  4. No `_thread_has_active_run` 409 (Q1).
  5. If the thread has ≥ 1 user/assistant message (`_thread_has_messages`, `:860-873`), compute both statements **before** the transaction and write the UPDATE + event in one user-JWT txn (`get_user_pg_connection`, `_write_expert_change`'s shape at `:927-952`) with `org_id = thread.org_id` (D-267-34). Else use the plain update (D-268-12b).
- **`TRANSCRIPT_EVENT_KINDS`** (`models/message.py:46`) → `{"expert_changed", "expert_handoff", "scope_changed"}`. The frontend mirror is `expertEventCopy.ts:36-39`, cross-pinned by the `?raw` test (`expertEventCopy.test.ts:14`). `_reconstruct_history` (`agent_loop.py:1001`) and `_visible_transcript_rows` (`threads.py:535`) both read the set, so nothing else changes.
- **One payload (D-268-12c).** Build it from **two `describe_expert_scope` statements** (`expert_scope.py:~245`), each with the thread's active Expert and the before or after folder:
  - `next = after.used()`.
  - `stops =` the `dropped` computation `build_expert_changed_event` already does (`expert_scope.py:~345-356`). Extract that into a private pure helper both builders call, so the 267 builder's output stays byte-identical. `test_267_expert_changed_event.py:189-190` asserts `fixture == ev.model_dump(mode="json")` and is the guard.
  - `held = after.expert is not None and after.expert.scope_mode == "restricted"`, decided on the server.
  - `saved = after.thread_folder if held else None`.
  - The folder **path** comes from the pure `compose_expert_scope(scope_mode="biased", thread_folder_id=X, expert_folder_ids=[], visible)` → `.scoped_folder_path` (`expert_scope.py:139-143`). That is a reuse, not a second derivation.
- **New models** (in `models/message.py`), for example `ScopeChangedEvent{kind:"scope_changed", at, from_folder, to_folder, expert, held, now, dropped, saved, during_run}` and a wire twin `ScopeEffect{held, expert, next, stops, saved}`.
  - `during_run` = `_thread_has_active_run(...)` at write time. It drives the UI-SPEC "written while streaming" footer.
  - ⚠ **Do not add `path` to `TranscriptFolderRef` with a plain default.** `model_dump` would then emit `"path": null` on 267's events and break the byte-equality fixture test above: a new backend red at zero headroom. Either use a subclass for scope refs, or a wrap-serializer that omits `path` when None. Drive the 267 fixture test green as proof.
- **Endpoints:**
  - `GET /threads/{thread_id}/scope-effect?folder_id=<uuid>|&clear=true` (at rest and per draft). It lives under `/{thread_id}/…`, so the "declare above `/{thread_id}`" ordering trap (`threads.py:786-789`) does not apply.
  - The PATCH's response stays `ThreadResponse`. The client re-reads `ScopeEffect` after success.
  - ⚠ **Resolve with the same org source the next run will use**: `resolve_active_org_or_none(request, current_user)` (the run's `current_user["org_id"]`) plus `_caller_roles` (`threads.py:711`). Otherwise the preview and the run can disagree (Pitfall 9).
- **Frontend wire:**
  - `lib/api/threads.ts` gains `setThreadFolder(tid, folderId|null)` (the `setThreadActiveExpert` shape, `threads.ts:212-224`, with `throwThreadRefusal`), `getScopeEffect`, and `ScopeChangedEvent`/`ScopeEffect` types.
  - The `transcriptEventOf` union widens (`expertEventCopy.ts:76`).
  - `ExpertEventCard`'s `Shell` tone widens (`ExpertEventCard.tsx:38-70`).
  - **`MessageItem.tsx` needs no edit** (its one early return at `:331-341` routes every allowlisted kind). UI-SPEC R3 is confirmed.

### Q7 — D-268-13: the audit metadata

`ToolContext` has `run_id: UUID` and `thread_id: str` as required fields (`tool_dispatcher.py:~106-110`) and `parent_run_id` (`:145`). The `search.query` write is at `tool_dispatcher.py:945-954`. The additive change:

```python
metadata={
    "query_text": args["query"],
    "document_ids": _audit_doc_ids,
    "similarities": _sims,
    "run_id": str(ctx.run_id),
    "thread_id": str(ctx.thread_id),
    # recommended additions (discretion): a sub-agent's search joins to its ROOT run,
    # and the scope actually passed to retrieval is evidence independent of the result set
    "parent_run_id": str(ctx.parent_run_id) if ctx.parent_run_id else None,
    "folder_ids": list(ctx.folder_subtree_ids or []),
},
```

- Readers of `search.query` (`api/audit.py:65-69`, `knowledge_health.py` ×5, `document_queries.py:76`) only `.get()` known keys, so adding keys is safe [VERIFIED].
- The row is written through `ctx.spawn` (fire-and-forget), so proof queries must run after the run completes.
- ⚠ **Biased Expert + scope change:** the correct subset check is `document folder ∈ ScopeEffect.next` (new subtree ∪ Expert folders), not "⊆ new subtree". Under Restricted it is the Expert's folders (Pitfall 10).

### Q8 — D-268-14: does any 268 change need `retrieval_service.py`? **No.**

- Scope reaches it only as the `folder_ids=` argument (`tool_dispatcher.py:787`, `retrieval_service.py:384-425`). Every 268 change sits upstream (where `folder_subtree_ids` is computed) or downstream (the audit).
- If no plan's `files_modified` names it, record "G-5 not fired: file unmodified; SEED-224 extraction stays owed."

### Q9 — RLS on `runs` and the spend join

- `runs`: `ENABLE ROW LEVEL SECURITY` (`full-schema.sql:7720`), one policy `runs_select_own` (SELECT, `org_id IN current_user_org_ids() AND auth.uid() = user_id`, `:7726`).
  - There are no INSERT/UPDATE policies and no explicit or column-level GRANTs on `runs` in `full-schema.sql` or `full-schema-supplement.sql` [VERIFIED: grep].
  - New columns are covered by the existing row policy. Owners can read their own `expert_id`, which is harmless. **No new policy is needed.** D-268-18 is verified at the source level and still owes `get_advisors(security)` after apply.
- The spend SQL runs on the service-role pool behind `require_operator` (`admin_spend.py:1-4`, `_resolve_operator_org_id` `:45-81`). The org scoping is the `WHERE r.org_id = $1` predicate on **roots**, plus the org-constrained `expert_bundles` join (Q5).
- ⚠ **Side finding (not 268's to fix; verify live):** `continue_run`'s Deep branch updates `runs.continues_used` and `status` through the **user-JWT** client (`runs.py:~1108-1112`). With no UPDATE policy, that silently matches 0 rows. Consequences:
  - `continues_used` may never increase for Deep runs.
  - A Deep continuation streams while its row still reads `cap_paused`, so `_thread_has_active_run` is false during it.
  - Source-measured only (no local DB this session). If confirmed, plant a seed.

### Q10 — Hot-file ledger for the likely `files_modified`

Re-derived now with the CLAUDE.md recipe (`commits / phases / lines`). `node scripts/check-hot-file-ledger.cjs --files …` was run on the candidate list.

| File | Now | Ledger row | G-5 | Constraint if touched ("honoured by construction") |
|---|---|---|---|---|
| **`backend/app/db/runs.py`** | **8 / 7 / 226** | **⛔ NO ROW** (gate: `[no-row]`) | **FIRES** | Add the scan-list row **and** its section in the same commit. `insert_run` gains 2 kwargs + one SQL; `insert_assistant_message` gains `org_id`; `finalize_run` untouched (SEED-297 trigger a) |
| `backend/app/api/threads.py` | 259 / 89 / 2211 | stale (`255/87/2156`) | FIRES | ONE new PATCH arm + ONE scope-effect route + org stamps on 2 inserts + the up-front scoping call. ⛔ no new branch in the send path beyond `if _kickoff_definition is None` |
| `backend/app/services/run_producer.py` | 16 / 8 / 967 | current | FIRES | ONE optional `scoping`/`scoping_error` param pair; the Deep branch uses it; the continuation gets token accumulation (Pitfall 2). ⛔ exactly 2 `born_for_bundle_id=` kwargs stay |
| `backend/app/services/run_lifecycle.py` | 8 / 4 / 748 | stale (`6/3/459`) | FIRES | `register_run_start` forwards 2 kwargs; nothing else |
| `backend/app/services/agent_loop.py` | 55 / 27 / 3561 | stale (`54/27/3557`) | FIRES | 4 org stamps (Q3); 0 branches; AST no-`expert` fence stays green. ⛔ prompt-assembly seam still OWED |
| `backend/app/services/tool_dispatcher.py` | 92 / 41 / 5221 | stale phases (`/39`) | FIRES | 2-4 additive metadata keys. ⛔ registry/handler split OWED |
| `backend/app/models/thread.py` | 20 / 13 / 510 | current | FIRES | 2 additive fields on `ThreadUpdate` (+ optional preview model) |
| `backend/app/models/message.py` | 20 / 13 / 236 | stale phases (`/12`) | FIRES | 1 kind + additive models; ⛔ 267 dumps byte-identical |
| `backend/app/services/expert_scope.py` | 2 / 1 / 420 | current | young | pure builders beside the 267 ones; ONE shared `dropped` helper |
| `backend/app/db/rates.py` | **8 / 1 / 688** | stale (`2/1/507`) | no (1 phase) | CTE rewrite of 4 queries |
| `backend/app/api/admin_spend.py` | 3 / 1 / 212 | stale (`1/1/202`) | no | 1 param × 2 routes + response keys |
| `frontend/src/pages/admin/AdminSpendPage.tsx` | **8 / 2 / 864** | stale (`2/1/567`) | ⚠ **FIRES AFTER 268** (3rd phase) | mounts + 1 param + 1 column (UI-SPEC R4). The next phase proposes extraction first |
| `frontend/src/components/admin/spend/BlindSpotsCard.tsx` | 4 / 1 / 268 | stale | no | grid class + mount point only |
| `frontend/src/lib/api/spend.ts` / `frontend/src/types/spend.ts` | 2/1/185 · 2/1/78 | stale | no | additive params/fields |
| `frontend/src/components/chat/ChatArea.tsx` | 86 / 40 / 994 | stale (`79/40/970`) | FIRES | +1 callback (`applyScopeChange` beside `applyExpertChange`), +ScopeEffect state, header pill REMOVED (UI-SPEC D6), pass a slot to the composer |
| `frontend/src/components/chat/MessageInput.tsx` | 40 / 19 / 993 | stale (`38/19/977`) | FIRES | recommend ONE optional `scopeSlot?: ReactNode` prop; `showChipsRow`/"Using:" widen by `scopeSlot != null`; hooks unchanged (7/5/23) |
| `frontend/src/components/chat/ExpertEventCard.tsx` | 3 / 1 / 198 | current | young | third branch + `Shell` tone widen |
| `frontend/src/components/chat/expertEventCopy.ts` | 2 / 1 / 241 | current | young | kind + `SCOPE_EVENT_COPY` |
| `frontend/src/components/chat/ActiveExpertChip.tsx` | 1 / 1 / 50 | `0/0/0` | young | class strings only (UI-SPEC R2) |
| `frontend/src/components/experts/ScopeLedger.tsx` | 3 / 1 / 115 | current | young | one `held` tone (UI-SPEC §5.3) |
| `frontend/src/lib/api/threads.ts` | 15 / 9 / 1859 | current | FIRES | 2 functions + wire types |
| `backend/app/services/retrieval_service.py` | 19 / 11 / 456 | current | FIRES | **must stay unmodified** (D-268-14) |
| New leaves (`ScopeChip.tsx`, `ScopePicker.tsx`, `scopeCopy.ts`, `components/admin/spend/{ExpertFilterPills,ExpertSpendCard,AttributionDisclosures}.tsx`, `expertSpendCopy.ts`) | — | none | new | rows added **at creation** (the gate fails `[no-row]` otherwise) |

The planner must write rows for `db/runs.py` and every new leaf, and refresh the stale triples, in the **same commit** as the matching `docs/HOT-FILE-LEDGER.md` section (disposition cell ≤ 200 chars). If `CLAUDE.md` table cells are edited, run `node scripts/check-claude-md-size.cjs`.

### Q11 — Existing tests to extend, and the vitest knobs

**Backend (`backend/tests/unit`):**

| Suite | Why it matters to 268 |
|---|---|
| `test_267_expert_changed_event.py` | the `rename_thread` `aexec` call sequence (`[before-read, message count, update, select]`) and the fixture byte-equality; the new arm must not change the Expert arm's sequence |
| `test_267_binding_gate.py`, `test_260_expert_chat_scoping.py` | PATCH semantics and the clear idiom |
| `test_267_transcript_kinds.py`, `test_267_expert_scope.py` | the kind allowlist and the pure-composition parity copy |
| `test_264_born_for_carrier.py` | pins 2 `born_for_bundle_id=` kwargs in `run_producer.py`, the continuation build, `_resolve_thread_scoping`'s no-Expert tuple |
| `test_chat_active_org.py` | active-org stamping order in `send_message` (`:120-135`) |
| `test_257_admin_spend_api.py`, `test_257_rates_db.py`, `test_257_pricing_service.py`, `test_257_single_token_conversion_home.py` | spend shapes and the one USD home |
| `test_256_producer_shells.py`, `test_256_producer_shell_site3.py`, `test_085_task_service.py`, `test_db_runs.py` | `insert_run`/`finalize_run` call shapes (3 of `test_db_runs` are inherited reds) |
| `test_256_judge_usage_counted.py` | the precedent for a call-site disposition fence |

Integration (needs the local DB; skip = SKIP, never PASS, run with `-rs`): `tests/integration/test_267_transcript_rows_rls.py` (the two-org fixture to copy) and `test_266_two_org_fence.py`.

**Frontend:** the suites in scope and their pins in `scripts/vitest-count-gate.cjs` BASELINE:
- `ExpertEventCard.test.tsx` 10
- `expertEventCopy.test.ts` 19
- `expertThemeContrast.test.tsx` 6
- `MessageItem.transcriptEvent.test.tsx` 8
- `ChatArea.expertThread.test.tsx` 18
- `ComposerExpert.test.tsx` 12
- `ScopeLedger.test.tsx` 9
- `AdminSpendPage.test.tsx` 26
- `MessageInput.connectors.test.tsx` 5

`MessageInput.a11y.test.tsx` is in **neither** knob.

**TARGETS are file-level entries** (`vitest-count-gate.cjs:4420…`), so every new suite needs a `TARGETS` line **and** a `BASELINE` pin, or it is never executed or never guarded. New suites to expect: `ScopeChip`, `ScopePicker`, `scopeCopy`, `ExpertSpendCard`, `ExpertFilterPills`, `expertSpendCopy`, `AttributionDisclosures`, and a `ChatArea.scopeChange` suite.

### Q12 — SC#10 board recipe (reuse of 267-05)

267-05 drove every row as a real run through the HTTP API with **per-request `model` + `provider`** on `POST /threads/{id}/messages`, as fresh `uat267-*@example.test` users in a fresh org, with `X-Org-Id` on every request, and re-derived every column from SQL (`267-UAT-LOG.md:66-100`, `evidence/04-sc10-board.txt`). Its helper scripts lived only in the session scratchpad; no board script is committed. Tokens and passwords stayed out of the repo.

**The 268 row recipe (per provider, roster derived from `MODEL_CAPABILITIES`):**
1. `POST /threads {"folder_id": "<Client ACME>"}`, then turn 1 (per-request `model`/`provider`) with a question answerable from both folders.
2. `PATCH /threads/{id} {"folder_id": "<Client ACME/Q3 Contracts>"}` → expect a `scope_changed` row (SQL: `messages` `role='system'` with `tool_calls->0->>'kind'='scope_changed'`, `org_id = threads.org_id`).
3. Turn 2, the same question.
4. **Proof query per turn:**
   ```sql
   SELECT a.metadata->>'run_id' AS run_id, d.id, d.folder_id
   FROM audit_log a
   CROSS JOIN LATERAL jsonb_array_elements_text(a.metadata->'document_ids') did(id)
   JOIN documents d ON d.id = did.id::uuid
   WHERE a.action_type = 'search.query' AND a.metadata->>'run_id' = '<run>';
   ```
   Pass bar: turn 2's documents are all in the new subtree **and** `metadata->'folder_ids'` equals the new subtree. Turn 1 may include root-folder documents.
5. If a model does not call `search_documents` on turn 2, the row is not a pass. Add a positive control (the 267 T-267-55 precedent) or record it ⛔ with the reason.
6. Record the model/provider match on the `runs` row and `expert_attributed = true`.

The four axes: MT-1 (the board prompt uses two tools), PT-1 (pairs in parallel), LM-1 (a ≥ 5 KB prompt), cross-provider (8 rows). Author them in `268-VALIDATION.md` **before** the drive.

## Standard Stack

No new libraries. Every capability uses the shipped stack. UI-SPEC §1 also says "New dependencies: none".

| Library | Version | Purpose | Why |
|---|---|---|---|
| asyncpg (existing pool) | as pinned | `insert_run` / spend SQL | the service-role writer substrate (Phase 073 / 163) |
| FastAPI + Pydantic (existing) | as pinned | PATCH / query params / event models | project rule |
| React + Radix `DropdownMenu` (shipped shadcn wrapper) | as pinned | the picker | UI-SPEC §9-D1: no popover package |
| lucide-react (existing) | as pinned | the new glyphs | UI-SPEC §1 |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase, so the slopcheck gate was not run.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| — (none) | — | — | — | — | — | — |

**Packages removed:** none · **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
                      ┌──────────────────── CHAT-08 ─────────────────────┐
 ScopeChip ──open──▶ ScopePicker ──draft──▶ GET /threads/{id}/scope-effect ──▶ describe_expert_scope ×2
     ▲                    │ Apply                                              (before / after folder,
     │                    ▼                                                     same active Expert, same
     │           ChatArea.applyScopeChange ──▶ PATCH /threads/{id} {folder_id}  org source as the run)
     │                    │                        │ authorize folder (fetch_visible_folders, thread org)
     │                    │                        │ ≥1 msg? ─no─▶ plain UPDATE (no event)
     │                    │                        └─yes─▶ ONE user-JWT txn: UPDATE threads + INSERT
     │                    │                                 messages(role=system, kind=scope_changed,
     │                    │                                 org_id=thread.org_id)
     │   refetch transcript (not while streaming) ◀────────┘
     │                                       MessageItem early return ─▶ ExpertEventCard(scope branch)
 next POST /threads/{id}/messages
     │ resolve active org ─▶ _resolve_thread_scoping (ONCE) ─▶ insert_run(org, expert_id, attributed)
     │                                                          │ (sub-agent: SQL copy of parent's)
     ▼                                                          ▼
 run_producer(scoping=…) ─▶ run_agent_loop preamble reads folder ONCE ─▶ tools ─▶ search_documents
                                                                            │ audit search.query
                                                                            ▼ {run_id, thread_id,…}
                      ┌──────────────────── METER-08 ────────────────────┐
 AdminSpendPage.loadAll(expert) ─▶ GET /summary?expert= & GET /runs?expert=
                                        │
                                        ▼ roots (org, window, expert) ─▶ members (root + depth-1 subs)
                                          ─▶ priced (cost_usd_sql per row, own model/date)
                                          ─▶ per_root (box-shell token rule) ─▶ totals / daily / model /
                                             expert_breakdown (unfiltered) / ledger page
```

### Recommended file structure (new leaves only)

```
backend/app/services/expert_scope.py        # + build_scope_effect / build_scope_changed_event (pure)
backend/tests/unit/test_268_*.py           # insert-site fence, roll-up SQL, PATCH arm, event, audit keys
backend/tests/integration/test_268_two_org_rows.py
frontend/src/components/chat/{ScopeChip,ScopePicker}.tsx, scopeCopy.ts
frontend/src/components/admin/spend/{ExpertFilterPills,ExpertSpendCard,AttributionDisclosures}.tsx, expertSpendCopy.ts
supabase/migrations/197_runs_expert_attribution.sql
```

### Pattern 1: compute first, then write the state change and its record in one user-JWT transaction
**Source:** `threads.py:927-952` (`_write_expert_change`), 267-02 SUMMARY "patterns".
Statements are computed outside the transaction. The UPDATE and the event INSERT share `get_user_pg_connection`, with an explicit `org_id` from the thread row and `tool_calls` passed as a plain list (the pool's jsonb codec encodes it; a pre-dumped string double-encodes).

### Pattern 2: a call-site disposition fence instead of editing every site
**Source:** `test_256_judge_usage_counted.py` (`_EXPECTED_FORCED_EMIT_SITES`).
An AST walk over `app/` for `insert_run(` compared with a pinned `{file: disposition}` map. A new site fails the fence until it is classified.

### Pattern 3: one loader, two consumers (the 257.1 lesson)
**Source:** `AdminSpendPage.tsx:108-137`.
The `expert` value enters **only** through `loadAll`'s dependency list and `goToLedgerOffset`. A test drives filter → asserts both fetch mocks received `expert=`, and that KPI, chart, donut and ledger values all changed.

### Anti-Patterns to Avoid
- **Re-pricing sub-agent tokens at the root's model.** Price every row at its own rate, then sum.
- **Filtering descendants by their own `org_id`.** Filter roots only.
- **Stamping `expert_id` from `threads.active_expert_id` at report time, or at a second resolution** (Option C).
- **The frontend deciding "held" from `scope_mode`.** It comes from the payload (UI-SPEC §5.1 fence: `?raw` grep for `scope_mode` in the three leaves = 0).
- **A plain default on `TranscriptFolderRef.path`** (Pitfall 11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Token → USD in SQL | new `* rate / 1e6` arithmetic | `pricing_service.cost_usd_sql(alias, rate_alias)` | 257 single home, AST-fenced |
| Folder visibility / subtree | a new tree walk or permission check | `folder_utils.fetch_visible_folders(..., restrict_org_ids=)` + `compose_expert_scope` | SEED-124 lesson: the one visibility home |
| What an Expert does to scope | a frontend `if restricted` | `describe_expert_scope` + pure builders | D-267-11 / D-268-12c |
| The org of a turn | a new org lookup | `resolve_active_org_or_none` (already called at `threads.py:1364`) | validated membership, soft failure |
| The event writer | a new transaction helper | `_write_expert_change`'s shape (generalize or mirror) | proven under real RLS by `test_267_transcript_rows_rls.py` |
| The two-org test fixture | a new harness | `test_267_transcript_rows_rls.py`'s subject fixture | derives the trigger's pick, never assumes it |

## Runtime State Inventory

Not a rename/refactor phase. The one migration adds columns. Stated for completeness:

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | Existing `runs` rows get `expert_attributed=false` (by the column default) and are **not** backfilled (D-268-06). Existing mis-stamped two-org rows (SEED-314) stay mis-stamped | none (by decision); name it in the phase summary |
| Live service config | Production DB needs migration 197 via the approved MCP write or the SQL editor | deploy checklist + `get_advisors(security)` |
| OS-registered state | None: verified, no scheduler/task names involved | none |
| Secrets/env vars | None: no env var added (deploy-drift check stays clean) | none |
| Build artifacts | `supabase/full-schema.sql` must be regenerated | `bash scripts/regenerate-full-schema.sh` |

## Common Pitfalls

### Pitfall 1: roll-up double-counts harness tokens
**What goes wrong:** the org token total and the "No Expert" tokens are inflated by every harness shell's sub-agents.
**Why:** shell rows persist `run_usage_box`, which already sums sub-agents (`phase_types.py:768-790`). Sub-agent rows point at the shell (`phase_types.py:604-617`).
**Avoid:** the box-shell token rule in Q4, plus a unit test with a shell root (`model='unknown'`, tokens 100) and one sub-agent (tokens 60) → tokens 100, USD = the sub-agent's cost.
**Warning sign:** org tokens jump by more than the sum of `parent_run_id` rows under non-shell roots.

### Pitfall 2: a Deep Continue erases the paused segment's tokens (NEW, unregistered)
**What goes wrong:** a `cap_paused` run finalizes its real totals (`run_producer.py:249-258`). Continue reuses the same `run_id` (`runs.py:1405` → `spawn_continuation_run`). The loop's accumulators restart at `None` (`agent_loop.py:1889-1890`), and the continuation's finalize SETs only its own totals (`db/runs.py:104-122`, unconditional SET).
**Why it matters here:** SC#1 names "paused/continued runs". Per-Expert spend would silently under-count every continued run.
**Avoid:** in `spawn_continuation_run`, read the row's prior `input_tokens`/`output_tokens` before the loop and add them to the sink totals before `_finalize_producer_run`. NULL+NULL stays NULL; otherwise None counts as 0 (D-256-06 semantics). Leave `finalize_run`'s SQL alone: editing it trips SEED-297 trigger (a). Drive RED first with a two-segment unit test.
**Also:** SEED-297 trigger (d) ("makes a cap_paused run's token total load-bearing for money") **fires on this phase**. Route it in discuss/plan (fold or defer with a reason).

### Pitfall 3: explicit org on runs alone breaks Deep Continue for two-org users
**What goes wrong:** `continue_run` loads the carrier with `org_id = <run's org>` (`runs.py:1395-1404`, `db/runs.py:153-166`). The carrier message is inserted without `org_id` (`agent_loop.py:390-399`), so it takes the trigger's `LIMIT 1` org. Once the run takes the active org, the two differ for a two-org user, `load_cap_paused_tool_calls` returns `[]`, and Continue consumes nothing.
**Avoid:** stamp the same `current_user.get("org_id")` on the carrier, the assistant message and system-warning inserts. Test the Continue lookup in the two-org integration test.
**Warning sign:** Continue on a two-org thread re-asks the model instead of running the dropped tools.

### Pitfall 4: the event sits above the answer it did not affect
**What goes wrong:** the event row's `created_at` is the PATCH time. The assistant row is inserted at run end (`agent_loop.py:1910-1975`, default `now()`). A mid-stream change therefore renders **above** the in-progress answer. This is why 267 refused Expert changes while streaming (`threads.py:1000-1010`, WR-04).
**Avoid:** keep D-268-12a (allowed), but make `during_run` part of the snapshot so the card's footer reads "…The answer in progress keeps {from}" (UI-SPEC §5.5). Show the pending note while streaming. A test must assert the footer variant on a `during_run` payload.

### Pitfall 5: the Expert filter reaches one of two calls (257 "two dialects")
**Avoid:** pass `expert` through `loadAll` **and** `goToLedgerOffset`. One test asserts both fetches, plus the four regions moving.

### Pitfall 6: the breakdown and the total come from different queries
**Avoid:** compute `expert_breakdown`, `window_total_usd` and `window_run_count` from the **same** `per_root` CTE with the Expert filter off. Keep the client-side recon footer as the independent check. Add a backend test on a fixture with a deleted Expert, a pre-268 row, a sub-agent and a shell, asserting Σ lines = window total (USD in ten-thousandths, and runs).

### Pitfall 7: a sub-agent row carries the wrong org
**What goes wrong:** today's sub-agent rows take the trigger org. The 257 queries filter `r.org_id = $1` on every row, so a naive roll-up that filters members by org drops them.
**Avoid:** filter roots only, and copy the parent's org in `insert_run` going forward.

### Pitfall 8: `cap_paused` is not `streaming`
**What goes wrong:**
- A scope or Expert change made while a run is paused applies to the Deep continuation (which re-resolves), while the row keeps the original `expert_id`.
- 267's Expert 409 does not cover `cap_paused` (`threads.py:876-888`).
- If the Q9 side finding holds, a running Deep continuation also reads `cap_paused`.
**Avoid:** decide explicitly (Open Question 2). Minimum: the rule-line copy and the phase summary state it.

### Pitfall 9: the preview and the run resolve with different inputs
**What goes wrong:** `ScopeEffect` built with the thread's org while the run resolves with the active org (`current_user["org_id"]`) can disagree for two-org users or when there is no header.
**Avoid:** resolve `ScopeEffect` with `resolve_active_org_or_none(request, current_user)` and `_caller_roles`, exactly the producer's inputs (`run_producer.py:437-452`).

### Pitfall 10: the wrong subset for the SC#3 proof under a Biased Expert
A Biased Expert unions its folders with the thread subtree (`expert_scope.py:139-143`). Check documents ⊆ `ScopeEffect.next`'s folders, not ⊆ the new subtree. Under Restricted (G4-3), the proof is "only HR Policies".

### Pitfall 11: a new optional field changes 267's wire dump
`test_267_expert_changed_event.py:189-190` byte-compares `model_dump(mode="json")` with the fixture JSON, which is also `?raw`-imported by `expertEventCopy.test.ts:16`. Any new defaulted field on a shared ref model adds a key. That is a new backend red at zero headroom **and** a frontend fixture drift.

### Pitfall 12: the folder id is not authorized
`create_thread` never validated `folder_id` (`threads.py:762-763`), and `agent_loop._get_subtree` trusts the root id. The PATCH must check visibility **within the thread's org** before writing (Q6), or a user could scope a thread to a folder id they cannot see.

## Code Examples

### The Expert filter clause (bound, never interpolated)
```python
# db/rates.py — the one predicate, shared by summary, daily, model, ledger, count
_EXPERT_FILTER_SQL = """
  AND ($4::text IS NULL
       OR ($4 = 'unrecorded' AND NOT r.expert_attributed)
       OR ($4 = 'none' AND r.expert_attributed AND r.expert_id IS NULL)
       OR ($4 NOT IN ('none','unrecorded') AND r.expert_attributed AND r.expert_id::text = $4))
"""
```
(Comparing `expert_id::text = $4` avoids a cast error when `$4` is `'none'` inside a non-short-circuited `$4::uuid`. Postgres does not guarantee `OR` evaluation order [ASSUMED: standard Postgres semantics], so do not rely on it.)

### Migration 197 (shape)
```sql
-- 197_runs_expert_attribution.sql  (paste into the SQL editor; idempotent)
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS expert_id uuid;              -- no FK (D-268-04)
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS expert_attributed boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.runs.expert_id IS 'Phase 268: access-checked Expert at run start; NULL+attributed = No Expert; no FK so deletes read "Deleted Expert".';
COMMENT ON COLUMN public.runs.expert_attributed IS 'Phase 268: true for rows written from 268 on; false = Not recorded (before 268). Never backfilled (D-268-06).';
-- verify block: SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='runs' AND column_name IN ('expert_id','expert_attributed');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Spend = root runs only (`parent_run_id IS NULL`) | root + depth-1 descendants, priced per row | 268 (D-268-09) | the org total rises; disclosed on Blind Spots |
| Chat rows take the trigger's `LIMIT 1` org | explicit validated active org | 268 (D-268-07) | two-org spend lands in the right cockpit |
| Folder scope fixed at thread creation | PATCH + `scope_changed` event | 268 (CHAT-08) | SEED-286 closed |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `ALTER TABLE … ADD COLUMN … DEFAULT false NOT NULL` is metadata-only (PG ≥ 11) | Q4 | a brief lock on large prod `runs`; low risk at the current scale |
| A2 | Postgres does not guarantee short-circuit `OR` order, so the text-compare form is needed | Code Examples | a runtime cast error on `expert=none` |
| A3 | `continue_run`'s user-JWT `runs` UPDATE matches 0 rows under RLS (no UPDATE policy) | Q9, Pitfall 8 | if wrong, Deep continuations DO read `streaming`, and Pitfall 8's second half disappears |
| A4 | The local DB was down, so no live row counts (shell roots, sub-agents under shells, org mismatches) were taken | Q4 | the double-count magnitude is unknown. Wave 0 of plan 1 should measure it (SQL in Validation §Wave 0) |

## Open Questions (RESOLVED)

1. **The thread-org ≠ active-org send (two-org user, old thread).** → RESOLVED by D-268-22 (active org).
   - What we know: threads are not org-filtered in the list (`threads.py:255-272`). `send_message` never compares `thread.org_id` with the active org. Retrieval and the Expert already use the active org. 267's event rows use the thread's org.
   - Unclear: should the run and messages follow the active org (D-268-07 literally) or the thread's org?
   - Recommendation: follow D-268-07 (active org) for the run **and** every message the turn writes (keeps the Continue lookup coherent, Pitfall 3), and record the split transcript as a known edge. Or, if the operator prefers, refuse with 267 WR-03's sentence *"Switch to this chat's organization"*. Ask at plan-check.
2. **Expert or scope changes while `cap_paused`.** → RESOLVED by D-268-23 (allow both, say so). Recommendation: allow the scope change (the Continue is "your next message" in effect, footer "From your next message."). For the Expert, either extend 267's 409 to `cap_paused` or accept "a run counts toward the Expert active when it started" and say so. Decide; do not leave it implicit.
3. **Unpriced sub-agents under a rated root.** → RESOLVED by D-268-25. Recommendation: expose `unpriced_subagents` and fold it into the existing "unrated" disclosure copy rather than inventing a new KPI.
4. **The "continued" ledger tag** → RESOLVED by D-268-24 (dropped). has no data source (all shells look alike). Recommendation: drop it from 268 (UI-SPEC wrote "when the API marks it"), or add a kind column in 197 if the operator wants it.
5. **The box-shell marker:** → RESOLVED by D-268-21 (option a). the literal predicate plus a fence (a), or a column (b)? Recommendation: (a).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | vitest gate, ledger/size gates | ✓ | v24.19.0 | — |
| Backend venv Python | pytest gates | ✓ | 3.12.6 (`backend/venv/Scripts/python.exe`) | — |
| Supabase CLI | local stack, schema regen | ✓ | 2.98.2 | — |
| Local Postgres :54322 | integration two-org test, live proof, Wave 0 measurement | ✗ at research time (connection refused) | — | `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`. If `bind: … forbidden`, see the CLAUDE.md port-reservation trap |
| Backend :8000 | live proof / SC#10 | ✗ at research time | — | the operator starts it (memory: the user starts the backend) |
| Docker (sandbox) | SC#10 MT-1 row (`execute_code` optional) | not probed (docker is denied to this shell) | — | the board prompt can use `web_search` + `workspace_write`, as in 267 |
| Provider keys ×8 | SC#10 | present at 267-05 (names only) | — | a row may be ⛔ with a reason, never omitted |

**Missing with no fallback:** none. The DB and backend only need starting.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend venv) + vitest (frontend) |
| Config file | `backend/pytest.ini` / `frontend/vitest.config.*` (existing) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_268_*.py -q` · `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/chat/__tests__/ScopeChip.test.tsx` |
| Full suite command | `node scripts/check-backend-unit-baseline.cjs` (≤ 71, failed-SET diff) · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) · `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (set diff vs 70) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| METER-08 | every `insert_run(` site classified | unit (AST fence) | `pytest tests/unit/test_268_insert_run_sites.py -q` | ❌ Wave 0 |
| METER-08 | `insert_run` writes org, expert, attributed; sub-agent copies the parent in SQL | unit (mock pool SQL shape) + integration | `pytest tests/unit/test_268_insert_run_stamp.py -q`; `pytest tests/integration/test_268_two_org_rows.py -rs -q` | ❌ |
| METER-08 | Option A: the row's `expert_id` == `RunContext.born_for_bundle_id`; resolution failure → NULL + the same `runs.error` | unit | `pytest tests/unit/test_268_send_path_stamp.py -q` | ❌ |
| METER-08 | Deep continue accumulates tokens | unit (two-segment) | `pytest tests/unit/test_268_continuation_tokens.py -q` | ❌ |
| METER-08 | roll-up: per-row pricing, box-shell rule, deleted Expert, pre-268 line, Σ lines = window total | unit on SQL shape + integration on real PG | `pytest tests/unit/test_268_spend_rollup.py -q`; `pytest tests/integration/test_268_spend_rollup_pg.py -rs -q` | ❌ |
| METER-08 | `expert` param on both routes; 422 on garbage; bound, never interpolated | unit | `pytest tests/unit/test_268_admin_spend_expert.py -q` | ❌ (extend `test_257_admin_spend_api.py`) |
| METER-08 | filter moves KPI + chart + donut + ledger together; recon footer ✓/✗ | vitest | `npx vitest run src/pages/admin/AdminSpendPage.test.tsx src/components/admin/spend` | partial |
| CHAT-08 | PATCH folder: authorize, event only with ≥ 1 msg, same txn, thread org, 267 Expert arm sequence unchanged | unit | `pytest tests/unit/test_268_scope_patch.py tests/unit/test_267_expert_changed_event.py -q` | ❌ / ✅ |
| CHAT-08 | `scope_changed` in the kinds; history skip; snapshot allowlist | unit + vitest `?raw` cross-pin | `pytest tests/unit/test_267_transcript_kinds.py -q`; `npx vitest run src/components/chat/__tests__/expertEventCopy.test.ts` | ✅ extend |
| CHAT-08 | ScopeEffect held/next/stops for none / Biased / Restricted | unit (pure builders) | `pytest tests/unit/test_268_scope_effect.py -q` | ❌ |
| CHAT-08 | audit metadata carries run_id/thread_id | unit | `pytest tests/unit/test_268_search_audit_keys.py -q` | ❌ |
| CHAT-08 | chip S1-S5, picker P1-P4, card normal/held/during-run, light-theme pairs | vitest | `npx vitest run src/components/chat/__tests__/Scope*.test.tsx src/components/chat/__tests__/expertThemeContrast.test.tsx` | ❌ / ✅ extend |
| SC#3/SC#4/SC#10/G-4 | next-turn retrieval ⊆ new scope, 8 providers, Chrome ×3 | manual-live (plan 4) | the SQL in Q12 | `268-VALIDATION.md` ❌ |

### Sampling Rate
- **Per task commit:** the targeted suites above, typically < 30 s.
- **Per wave merge:** the full backend baseline gate + the vitest count gate + the tsc set diff + `check-hot-file-ledger.cjs 268` + `check-seeds-register.cjs --phase 268`.
- **Phase gate:** all of the above green (backend ≤ 71 with an unchanged failed SET) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Capture baselines before the first edit: the backend failed-SET, the vitest verdict line, the tsc error set (`268-BASELINES.md`).
- [ ] Measure the live magnitude of Pitfalls 1/2/7 on the local DB (read-only):
  `SELECT count(*) FROM runs WHERE parent_run_id IS NULL AND model='unknown';`
  `SELECT count(*) FROM runs s JOIN runs p ON p.run_id=s.parent_run_id WHERE p.model='unknown' AND s.input_tokens IS NOT NULL;`
  `SELECT count(*) FROM runs s JOIN runs p ON p.run_id=s.parent_run_id WHERE s.org_id<>p.org_id;`
  `SELECT count(*) FROM runs WHERE continues_used>0;`
- [ ] `backend/tests/integration/test_268_two_org_rows.py`, copying the `test_267_transcript_rows_rls.py` fixture.
- [ ] Ledger rows for `backend/app/db/runs.py` and every new leaf (the gate fails otherwise).
- [ ] New vitest suites added to **TARGETS and BASELINE**.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (existing `get_current_user`) | — |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | the folder PATCH must authorize via `fetch_visible_folders(..., restrict_org_ids={thread.org_id})`; thread ownership (`.eq("user_id")`, 404 before any other read, T-267-13 shape); `/admin/spend` stays behind `require_operator`; the `expert_bundles` join is org-constrained |
| V5 Input Validation | **yes** | Pydantic `UUID` for `folder_id`; a regex/UUID check on the `expert` query param (422); every value `$N`-bound (T-073-02) |
| V6 Cryptography | no | — |
| V7 Error handling / logging | yes | literal `detail` strings only (T-267-20); no `detail=str(e)` |
| V8 Data protection | yes | explicit org stamps (SEED-314) so a two-org user's data and spend never land in another org's views |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `expert` / filter params | Tampering | bound params; no f-string of user values in `rates.py` |
| Scoping a thread to someone else's folder (IDOR) | Elevation / Info disclosure | visibility + same-org check at the PATCH |
| Cross-org Expert-name leak in the operator cockpit | Info disclosure | `(eb.is_system OR eb.org_id = ro.org_id)` join predicate |
| Rows attributed to the wrong org (billing/audit) | Repudiation / Info disclosure | explicit org at every turn insert + the two-org integration fence |
| Transcript event reaching a model (prompt injection via folder names) | Tampering | `TRANSCRIPT_EVENT_KINDS` skip in `_reconstruct_history`; names snapshotted as data |
| Mis-attributed spend through an unclassified new insert site | Repudiation | the AST disposition fence (Pattern 2) |

## Sources

### Primary (HIGH confidence — read this session)
- `backend/app/services/agent_loop.py:240-330, 364-400, 1001, 1304-1470, 1880-2012, 2112-2121, 2177, 2989-2998`
- `backend/app/services/run_producer.py:63-262, 380-560, 580-820, 841-993`
- `backend/app/api/threads.py:255-272, 535, 711-773, 860-1067, 1322-1690`
- `backend/app/db/runs.py:1-226` · `backend/app/services/run_lifecycle.py:258-420`
- `backend/app/services/task_service.py:520-680, 870-940` · `backend/app/services/harness/phase_types.py:600-620, 752-790`
- `backend/app/services/harness_engine.py:1860-1925, 2770-2815, 3150-3215` · `backend/app/api/runs.py:580-735, 983-1420` · `scheduler_service.py:270-335` · `publish_service.py:1605-1640`
- `backend/app/db/rates.py:341-688` · `backend/app/api/admin_spend.py` · `backend/app/services/pricing_service.py:1-130`
- `backend/app/models/{thread,message}.py` · `backend/app/services/expert_scope.py` · `backend/app/services/tool_dispatcher.py:780-960`
- `supabase/migrations/106_org_id_autofill_trigger.sql`, `035/055/063`, `supabase/full-schema.sql` (runs table, policies, indexes, expert_bundles)
- `frontend/src/pages/admin/AdminSpendPage.tsx:40-240`, `src/lib/api/spend.ts`, `src/types/spend.ts`, `src/components/chat/{ChatArea,MessageInput,ExpertEventCard,expertEventCopy,MessageItem}.tsx|ts`
- `scripts/check-hot-file-ledger.cjs` (run), `scripts/vitest-count-gate.cjs` (BASELINE/TARGETS), `docs/HOT-FILE-LEDGER.md` (scan list + 267 sections)
- `.planning/phases/267-*/267-02-SUMMARY.md`, `267-05-SUMMARY.md`, `267-UAT-LOG.md`, `evidence/04-sc10-board.txt`, `267-BASELINES.md`
- `.planning/seeds/SEED-314-*`, `SEED-286-*`, `SEED-297-*`

### Secondary / Tertiary
- None. No web sources were needed: every claim is about this codebase.

## Metadata

**Confidence breakdown:**
- D-268-12a verdict: HIGH (single read site proven; per-iteration contexts reuse the locals).
- Insert-site inventory and stamp mechanism: HIGH (grep-complete, 9 sites + 1 test route).
- Double-count / continuation-overwrite / carrier-org defects: MEDIUM-HIGH (each chain read end to end; not live-reproduced because the DB was down).
- Roll-up SQL: MEDIUM (shape recommended, not executed against PG).
- UI integration points: HIGH (line-level reads match UI-SPEC's references).

**Research date:** 2026-09-28
**Valid until:** 2026-10-05 (hot files move daily; re-derive the ledger triples at plan time)
