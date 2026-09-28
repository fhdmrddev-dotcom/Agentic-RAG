# Phase 268: Expert Spend & Mid-Thread Scope - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning
**Mode:** `/gsd:autonomous --only 268` smart discuss. The operator accepted every area as proposed, and the G-2
sketch came first.

<domain>
## Phase Boundary

An operator can see what each Expert **costs**: `/admin/spend` groups and filters by Expert, `No Expert` is always its
own line, and the per-Expert totals reconcile with the runs' persisted usage, sub-agent and continued runs included
(**METER-08**). A user can **change a thread's folder scope after it starts**: the change is a transcript event that
survives reload, the **next** turn's retrieval draws only from the new scope, and the UI states what an active
Restricted or Biased Expert does to that change (**CHAT-08**, SEED-286).

Not in scope: metering the handoff-summary LLM call (D-268-08, disclosed instead), a new retrieval-records table
(D-268-13), and S8 clone-on-customise (SEED-303).

</domain>

<decisions>
## Implementation Decisions

### Pre-discuss guardrail rulings (operator, 2026-09-28)
- **D-268-01 (G-2 HONOURED):** sketch 268 was run before discuss. The winners are **Chat A · composer chip**,
  **Under Restricted: Save & say** and **Spend A · Expert filter every card follows**. The file is
  `.planning/sketches/268-expert-spend-and-mid-thread-scope/` and it is the acceptance bar for G-4.
- **D-268-02 (267 dependency):** proceed on 267 while it is still `human_needed` (it owes an independent review and
  the operator's G-4 sign-off). 268 reuses only 267's event plumbing (`TRANSCRIPT_EVENT_KINDS`, the system-row
  storage, the history skip, the `MessageItem` early return), and that plumbing passed its live drive. This is
  carried as a risk: if 267's review changes that plumbing, 268's `scope_changed` kind must follow.
- **D-268-03 (G-5 on `retrieval_service.py`):** originally "extraction as plan 1". Re-decided on evidence by
  D-268-14.

### Attribution: how a run records its Expert (METER-08)
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

### `/admin/spend` by Expert (METER-08; sketch Spend A locked)
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

### Changing scope mid-thread (CHAT-08; sketch Chat A + Save & say locked)
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

### Proof, plan shape and G-5
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/expert_scope.py`: `compose_expert_scope` (:85, pure) and `build_expert_changed_event`
  (:346). The scope payload builds on these.
- `threads.py:891-1041`: 267's event writer (`_expert_changed_event`, `_write_expert_change`, 409-while-streaming at
  :1003, ≥1-message rule at :1013). `_visible_transcript_rows` (:535) is the snapshot filter.
- `models/message.py:46` `TRANSCRIPT_EVENT_KINDS`. `agent_loop._reconstruct_history` (:1024-1033) skips events.
- `ExpertEventCard.tsx:195` and its `MessageItem.tsx:331-341` early return. The new card renders from that same
  return.
- `pricing_service.py`: `cost_usd_sql` (:27) and `compute_token_cost_usd` (:81), the one USD home.
- `db/rates.py`: `get_org_spend_summary` (:341), `get_spend_runs` (:561). `api/admin_spend.py` (:84, :123).
  `frontend/src/lib/api/spend.ts`.

### Established Patterns
- Events are `messages` rows with `role='system'` and the payload in the `tool_calls` jsonb, written in the same
  transaction as the thread UPDATE.
- The folder scope is read from `threads` at every run start (`run_producer._resolve_thread_scoping` :430), and
  again in `agent_loop` (:1387). An empty `folder_ids` means "no filter" in retrieval.
- Chat run rows live in `runs`. `workflow_runs` carries harness totals and is not the spend source.

### Integration Points
- Run INSERT: `threads.py:1495` → `run_lifecycle.py:285` → `db/runs.py:67`.
- Finalize sites (tokens unchanged by 268; listed for the roll-up audit): `run_producer.py:237/:250`,
  `runs.py:693/:1365`, `task_service.py:902`, `run_lifecycle.py:386/:607`, `run_reconciler.py:236`,
  `eval_runner_service.py:1020`, `scheduler_service.py:326`, `harness_engine.py:3199`, `publish_service.py:1718`.
- Composer chip row: `MessageInput.tsx:508-541`. Scope state: `ChatArea.tsx:120` (create-only today).

### G-5 files (ledger rows exist; honoured by construction unless noted)
`run_producer.py`, `threads.py`, `db/runs.py` (check its row), `run_lifecycle.py`, `task_service.py`, `runs.py`,
`agent_loop.py` (read-only unless D-268-12a forces an edit), `tool_dispatcher.py` (one additive metadata key; its
seam stays owed), `ChatArea.tsx`, `MessageInput.tsx`, `MessageItem.tsx`, `models/thread.py`, `models/message.py`,
`AdminSpendPage.tsx`, `db/rates.py`. Run `node scripts/check-hot-file-ledger.cjs` on the phase after planning.

</code_context>

<specifics>
## Specific Ideas

- The sketch at `.planning/sketches/268-expert-spend-and-mid-thread-scope/index.html` is the visual acceptance bar.
  The event card is 267-B's shape with an indigo scope accent, `Now / Dropped` (or `Saved / Searching`) lines and
  a "From your next message" line.
- Realistic data for the proof: the `/Client ACME` → `/Client ACME/Q3 Contracts` change, Financial Analyzer
  (Biased), and HR Advisor (Restricted).

## How we'd know this failed (G-6, from ROADMAP)
- `expert_id` is stamped at the insert but a parent-copy site is missed (the 5-site lesson from 257), so sub-agent or
  continuation spend lands in "No Expert".
- Spend per Expert does not reconcile with the run totals, or the footer's sum ≠ the org total.
- The scope change applies to the in-flight turn, or only after a reload.
- The transcript event exists but retrieval still reads the old subtree (proven by the audit join, not by reading
  the answer).
- The Restricted chip says nothing, or says something the payload did not produce.

</specifics>

<deferred>
## Deferred Ideas

- Metering the handoff-summary call and other non-run LLM calls (D-268-11). Plant a seed.
- A dedicated `run_retrievals` table (D-268-13 uses the audit metadata instead).
- The SEED-224 `retrieval_service.py` extraction, unless a plan edits that file (D-268-14).
- SEED-303 S8 (clone-on-customise) and the dispatch-side whitelist: still open, not 268.

</deferred>
