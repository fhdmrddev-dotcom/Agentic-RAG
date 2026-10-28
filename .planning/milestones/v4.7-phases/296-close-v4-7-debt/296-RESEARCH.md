# Phase 296: Close v4.7 Debt - Research

**Researched:** 2026-10-26
**Domain:** Brownfield defect close-out across harness run lifecycle, tenancy, evidence privacy, provider boundary, workflow authoring and run surfaces (FastAPI + asyncpg + React/Zustand)
**Confidence:** HIGH for code-located root causes. MEDIUM for BUG-261021-04/-03 and 293-F-4, which need a RED drive. LOW for the Moonshot schema rule, which is not in Moonshot's official docs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Scope and dispositions
- **D-01:** The scope is `296-INVENTORY.md`, not the shorter audit summary. Every FIX and TEST row is delivered; every SEED row is planted or updated in `.planning/seeds/` (status + trigger) in this phase; every ACCEPT row keeps its written reason; every CLOSE row is flipped with the fixing commit. A row cannot leave the phase undisposed (ROADMAP SC#1).
- **D-02:** A FIX row whose defect does not reproduce on a RED drive is closed as **"did not reproduce"**, with the RED attempt as evidence. This applies especially to DEBT-3, 293-F-4, BUG-261025-02 and BUG-261025-03. It is never fixed blind.
- **D-03:** No gap round may add capability (G-7). A fix that turns out to need a new capability stops and becomes a seed.

### Rulings auto-picked in --auto (the operator may reverse any of them)
- **D-04 (BUG-261021-05):** The **engine enforces** the citations check on escalated steps (`grounding.effective_phase` covers `escalated` as well as `detected`). The seal stays. Reason: the seal is a governance promise, and since 295 an uncited step pauses and asks instead of failing, so enforcement is no longer harsh. The alternative was to change the seal copy.
- **D-05 (BUG-261020-02):** For a **non-owner** viewer of the evidence page, once an upstream step's output is withheld, every later step's output is withheld too, with the same worded reason. Owners are unchanged. Reason: the only reliable bound; per-step citation tracing cannot see substance restated without a citation.
- **D-06 (SEED-364):** **New** orgs get a neutral default name (no email). Existing org names are not renamed: no migration touches user data, and the owner can rename.
- **D-07 (295-IN-08):** The judge's "not sending is by design" note applies only when the step's send grant was present and recording was the designed path. A missing grant reads as a missing grant.
- **D-08 (291-S6-F7):** The golden run derives launch inputs from the author's test instruction and the field examples or defaults. It may use placeholders only for fields with neither, and the gauntlet says so in words.
- **D-09 (290-WR-02):** Include it, reversing the 2026-10-24 "accept until refactor". Lift `view` into the builder and gate undo/redo and the side panel while the Team view shows. One prop and one condition (G-5 one-touch); the full WorkflowCanvas refactor stays out.
- **D-10 (BUG-261024-04):** Split it. The **defect** (a follow-up turn re-shows every prior-turn file) is fixed in 296: a turn shows only files produced in that turn. The **policy** (intermediate PNGs beside the final document) becomes a seed.
- **D-11 (291 network_mode):** Seed it, as a security capability decision for v4.8, with the trigger "before any non-author or API caller can reach a workflow with `execute_code`". Not changed in 296, because changing sandbox egress breaks workflows that fetch at run time.
- **D-12 (287 SC#4 "one click"):** Accept the shipped menu + name dialog as "one action". Record it in the 287 verification note.
- **D-13 (SEED-365):** The per-user citation-check rate limit is in 296, reusing the 293 Redis limiter shape. The concurrency cap and spend ledger stay in the seed.

### How the work is cut (G-8)
- **D-14:** Plans follow the inventory's workstreams, in **4-5 plans**:
  - W1, tenancy/governance (backend, DB-touching tests)
  - W2, run lifecycle / inbound / providers / tracing (backend)
  - W3, describe-it authoring + builder (291/290/288, mixed)
  - W4, run surfaces / chat / settings (frontend)
  - W5, tests, gates, record flips, seeds, the live G-4 drive and ledger rows. W5 is last and serial.

  W2 or W3 may split if one context budget cannot hold it. Justify any split above 6 in the plan. Executors run TARGETED suites per task and FULL gates once per wave.
- **D-15:** **DB-mutating plans run serially** (CLAUDE.md worktree rule 4). W1 and W5 mutate the local DB. W2 does too where it drives runs.
- **D-16:** **G-5 one-touch:** many targets FIRE on the ledger (`harness_engine.py`, `api/runs.py`, `api/threads.py`, `StreamsProvider.tsx`, `WorkflowRunPage.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowCanvas.tsx`, `useTemplateFirstDraft.ts`, `PhaseFormPanel.tsx`, `publish_service.py`, `agent_loop.py`). Each fix is the smallest shape (one helper, prop, field, guard or branch), recorded in that file's `docs/HOT-FILE-LEDGER.md` section in the same commit. A fix that cannot be one-touch is recorded as a guardrail override in STATE.md, never hidden.
- **D-17:** **Migrations:** 293-IN-05 edits `215_*.sql` in place. It has run locally only, its backfill already ran here, and cloud has 0 `_schedule_id` rows. Any new schema need takes `216`, applied by the SQL editor, then `scripts/regenerate-full-schema.sh` (no reset).
- **D-18:** **Security review:** `/gsd:secure-phase 296` runs before close (W1 touches tenancy and the evidence privacy boundary).

### Verification
- **D-19:** Every FIX row has a test driven RED before the fix, except copy-only and CSS-only rows. Those are checked in the G-4 drive.
- **D-20:** The G-4 lived scenarios, written now (G-4 / G-6):
  1. A two-org user creates a folder and a workflow with the second org active, and both land in it.
  2. A colleague opens a run whose step 1 is withheld, and step 2 is withheld too, with words.
  3. A followed run shows its final answer and its Unsourced mark without a reopen.
  4. A waiting run shows one live ask card, not several expired ones.
  5. Schedule "Run now" says what happened.
  6. The Team view cannot be edited by undo/redo or the side panel.
  7. The evidence report title reads normally at 1536px with four buttons.
  8. Follow-up chat turns show only that turn's files.
- **D-21:** **Cross-provider (SC#10 rule):** W2's provider-touching fixes need the full native roster plus OpenRouter. These are BUG-261024-01, 292.1-IN-01/02, the 291-S6-F8 first-step turn and 293-F-4. Rows blocked by billing or account state are recorded ⛔ with the reason (OpenRouter 402; Moonshot suspended), never dropped.
- **D-22:** Gates at close: backend unit failures ≤ 71 (expect lower: 288-T-2, 289-T-1 and 292.1-test_075_4 are in the inherited set), vitest count gate OK with `GSD_VITEST_MAX_WORKERS=2`, `tsc -p tsconfig.app.json` set-diff no new errors, ledger / seeds / CLAUDE.md-size gates clear.

### Claude's Discretion
- Exact wording of every new user-visible sentence, following each surface's vocabulary file.
- Whether a given S row is folded into the plan whose files it shares.
- Ordering inside a plan.

### Deferred Ideas (OUT OF SCOPE)
All feature-shaped rows are in `296-INVENTORY.md` § SEED and are planted or updated in this phase:
- DEBT-1 / 293-F-2 (SEED-367)
- SEED-365 (spend ledger)
- kb_auto engine lookup
- sandbox network_mode
- `api/workflows.py` split
- starter-card wording
- deliverable size/path
- inbound `task` field
- F2 lock agreement
- schedule backoff
- intermediates policy

SEED-366 and 368-374 stay planted for v4.8.
</user_constraints>

<phase_requirements>
## Phase Requirements

The phase has no new requirement IDs. `296-INVENTORY.md` is the scope (SC#1). This research supports the rows whose cause or shape the inventory left open. The S rows already carry a fix shape there and are not re-researched. Their file:line references were spot-checked at `a94796965`, and every reference read in this session still holds.

| Inventory row | Research support (section) |
|---|---|
| BUG-261021-02 | §F1: the single insert site for each table, and the stamping shape |
| BUG-261021-05 | §F2: ⚠ D-04 is unsatisfiable as written. Operator re-rule needed |
| BUG-261020-02 | §F3: the cascade point in `compose_phase_log` |
| BUG-261021-04 / -03 | §F4: the follow-path terminal never re-reads messages |
| BUG-261025-03 + SEED-360 residue | §F5: root cause measured in the local DB (dead human-input branch in the boot sweep) |
| DEBT-3 | §F6: no writer of `workflow_runs.status='cap_paused'` exists, so it likely did not reproduce |
| 295-RES-a / RES-b | §F7 |
| SEED-362 / SEED-363 | §F8 / §F9 |
| BUG-261024-04 (defect half) | §F10: measure first. Three code-level leads |
| BUG-261024-01 | §F11: Moonshot boundary transform (provider docs are silent) |
| 293-F-4 | §F12: `phase_types.py:1656` provider precedence, plus the agent-step path |
| 291-S6-F7 / S6-F8 | §F13 / §F14 (⚠ `InputFieldSpec` has no example or default field) |
| SEED-364 | §F15: migration 216 plus the `full-schema-supplement.sql` same-commit copy |
| SEED-365 rate-limit half | §F16 |
| 287-T01 | §F17 |
| 293-IN-05 | §F18 |
</phase_requirements>

## Summary

Most of the inventory is mechanical, and its S rows hold at HEAD. The research changes the plan in four places.

1. **D-04 cannot be implemented as written.** A step's grounding cause is `escalated` only when the step has no knowledge-base tool (`grounding.py:1203-1209`). `retrieved_and_cited` fails at once when `output["citations"]` is empty, and only a KB tool fills that list (`validator_kinds.py:413-418`). An escalated step is also `is_locked`, so the 295 pause never offers "Continue without sources" (`engine_ask.py:787`). Enforcing the gate as D-04 says therefore makes every escalated step fail on every run, and every golden run fail at publish (`engine_ask._golden_reason`). The "since 295 enforcement is no longer harsh" reasoning does not hold for this cause. `GovernanceSection.tsx:56-62` records the same trap for `llm_single`. The local DB has **0** escalated steps in any definition, so no stored workflow is affected either way. The operator must re-rule before W1/W3 plan this row.
2. **BUG-261025-03 has a measured root cause.** The boot sweep's human-input branch is dead: `_active_tool_call_id` and `_is_llm_human_input` read the phase row's `output`/`config`, and a pending ask has neither. So every lifespan boot re-drives the run, and the re-drive mints a new prompt row. Those boots include uvicorn `--reload`, each worker, and every TestClient (SEED-363). The bug's own run `1e932094` has **3 unanswered prompt rows with 3 different tool_call_ids**. The second appeared 3 minutes after the first, well inside the 600 s timeout, and the third 2 s after a `claimed_at` stamp.
3. **BUG-261021-04 (and probably -03) is one missing re-read.** `subscribeProducerStream`'s `onTerminal` (`StreamsProvider.tsx:1888-1906`) refreshes the phase spine but never re-reads the chat bucket. The harness answer is a persisted message that the subscription has no placeholder for, so it only appears after a thread switch runs `actions.reconcile`.
4. **Three locked assumptions need correcting in the plan.**
   - DEBT-3 almost certainly does not reproduce: `engine_pause` writes `pause_run` from any non-terminal status first, and nothing writes `workflow_runs.status='cap_paused'`.
   - D-08 cites "field examples or defaults" that `InputFieldSpec` does not have.
   - D-22's expectation that 288-T-2 and 289-T-1 lower the 71 baseline is wrong. Both tests live in `backend/tests/`, outside the `tests/unit` gate, and only `test_075_4` is inside it (verified red this session).

**Primary recommendation:** Plan five plans in three waves: 296-01 W1 ‖ 296-04 W4, then 296-02 W2 ‖ 296-03 W3, then 296-05 W5. The file-ownership reassignments in §Plan Cut remove every same-wave file conflict. Put a `checkpoint:decision` on D-04 at the top of 296-01, and take the BUG-261025-03 fix as the mirror of the 295 engine-ask arm 2a (`pause_run` + `continue`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Org stamping on create (folders, workflow drafts) | API / Backend | Database (mig-106 trigger fallback) | The validated `X-Org-Id` is request state. The trigger only guesses with `LIMIT 1`. |
| Evidence withholding for non-owners | API / Backend (`run_evidence.py`) | Browser (renders sentence) | Privacy must be decided server-side. The client only renders what it is sent. |
| Citations gate on governed steps | Backend engine (`grounding.effective_phase`) | Browser (seal/gate row copy) | The engine decides what is enforced, and the UI must not claim more than that. |
| Boot-sweep resume of paused asks | Backend (`harness_engine.resume_stranded_workflows`) | Browser (ask card stack) | The duplicate prompts are written server-side. The card stack only shows them. |
| Followed-run final answer / Unsourced mark | Browser (`StreamsProvider`) | API (`GET /threads/{id}/messages`, `/workflow`) | The server already carries both facts. The client never re-reads them. |
| Moonshot tool-schema compatibility | Backend provider boundary (`provider_gateway`) | — | CLAUDE.md requires provider-specific handling at the service boundary, never in the shared schema. |
| Step provider routing for pinned models | Backend harness (`phase_types`, `task_service`) | — | Routing is decided per step at execution time. |
| Citation-check rate limit | API / Backend (Redis) | — | Shared across workers, which is why it uses the 293 Redis counter. |
| Neutral org default name | Database (`handle_new_user` trigger) | — | Orgs are created in a SECURITY DEFINER trigger at signup. |

## Project Constraints (from CLAUDE.md)

- Python backend runs in `backend/venv`. The canonical unit gate is `pytest tests/unit -q --continue-on-collection-errors`, with a ceiling of **71 failed and zero headroom**.
- No LangChain or LangGraph. Raw SDK calls only. Pydantic for structured outputs.
- Every table keeps RLS. Never bypass org scoping.
- No blocking I/O inside async handlers. Use `run_in_threadpool` (supabase-py) or asyncpg.
- **Migrations:** numbered `supabase/migrations/<digits>_name.sql`. Apply locally by SQL editor, or by asyncpg under the local-DB lock as 293 did with operator consent. **Never `supabase db push` or `db reset`.** Then run `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`.
- **Same-commit sync rules:**
  - `docs/HOT-FILE-LEDGER.md` row and section.
  - `scripts/full-schema-supplement.sql` copy of `handle_new_user` (relevant to SEED-364).
  - Deploy-drift artifacts for any new env var the app reads (`scripts/check-deploy-drift.sh`, `OMITTED_FROM_ONEBOX`).
- Settings live in `app_settings`/`user_settings`. Env vars are for secrets and infra only. The operator rule is "EVERYTHING in the UI except secrets".
- **Provider-docs-first** for any provider-touching fix, with live cross-provider UAT. The full native roster is 7 providers plus OpenRouter. Blocked rows are recorded ⛔, never omitted.
- **Worktrees:**
  - Bootstrap first: `bash scripts/bootstrap-worktree.sh "$(pwd)"`.
  - Set `GSD_VITEST_MAX_WORKERS=2`, and run **at most 2 test-running agents at once**.
  - Tear down only with `scripts/teardown-worktree.sh`, never `rm -rf`.
  - **DB-mutating plans run serially.**
- **Guardrails:** G-5 (ledger), G-7 (gap-round cap, run `node scripts/check-gap-closure-rounds.cjs 296`), G-8 (3-5 plans).
  - The hot-file gate `node scripts/check-hot-file-ledger.cjs` fails on any touched source file with no row.
  - The CLAUDE.md FIRING-table cell cap is **80 chars**, and the docs disposition cell cap is **200**.
- Supabase MCP reads are free and every write is approval-gated. This research read nothing in production. The 287-V-3 cloud check belongs to W5.
- Frontend typecheck must be `npx tsc -p tsconfig.app.json --noEmit` with a set diff. The plain `tsc --noEmit` checks zero files.
- Local-DB lock: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` (noclobber, 45-minute staleness) for the backend baseline and migration applies. Run only one vitest count gate per session.

## Standard Stack

No new libraries. Every fix uses code already in the repository.

| Need | Use (existing) | Location |
|---|---|---|
| Validated active org | `resolve_active_org_or_none(request, user)` | `backend/app/dependencies.py:1020` |
| Redis fixed-window limiter | `rate_limit.hit(redis, key_id=, kind=, limit=)` | `backend/app/services/rate_limit.py:36` |
| Cap-pause predicate | `app.db.runs.run_is_cap_paused` (reads **`runs`**, not `workflow_runs`) | `backend/app/db/runs.py:236` |
| Untrusted input envelope | `inbound_inputs.wrap_untrusted_input`, `UNTRUSTED_FLAG` | `backend/app/services/inbound_inputs.py:180` |
| Declared fields + required check | `inbound_inputs.declared_fields`, `validate_inbound_inputs` | `inbound_inputs.py:65,118` |
| Provider schema sanitiser precedent | `_sanitize_schema_for_google` (pure, recursive, returns new dict) | `backend/app/services/google_service.py:314` |
| Model → provider | `config._infer_provider_for`, `get_model_capability(model)["provider"]` | `backend/app/config.py:635` |
| Cross-provider key/base_url resolution | `forced_emit` 102-UAT-02 block | `backend/app/services/forced_emit.py:449-481` |
| Sanitised markdown | `MarkdownRenderer` (plain) / `CitedMarkdown` (citations) | `frontend/src/components/chat/` |
| Thread reconcile (messages + lock) | `useStreamsStore.getState().actions.reconcile(threadId)` | `StreamsProvider.tsx:2144` |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed in this phase, so slopcheck has nothing to check. ⚠ For BUG-261024-01, do **not** add `jsonref` or a similar dereference library. The inliner is about 25 lines of pure Python (Code Examples), on the `_sanitize_schema_for_google` precedent.

| Package | Registry | Disposition |
|---|---|---|
| (none) | — | — |

## Findings: Root Cause and Fix Shape for the Unproven M Rows

### F1. BUG-261021-02: folder and workflow create ignore `X-Org-Id` [VERIFIED: codebase]
- **Folders:** the only route insert is `api/folders.py:44-86` `create_folder`. It inserts `{user_id, name, parent_id, is_org_shared}` with no `org_id`, and it does not take `request: Request`. The other folder insert is `expert_install_service.py:431` (Expert install), which is out of scope.
- **Workflows:** the only `INSERT INTO workflow_definitions` in `backend/app` is `db/workflows.py:1049` (`create_workflow_definition`). Its only caller is `api/workflows.py:1213` (`create_draft`, `POST /workflows`), which has no `request` param. Starter forks (287) and the "Tweak fork" (REQ-7) both reach this route. Describe and generate do not persist: BUG-261024-02 shows the first save goes through `create_draft`.
- **Why the wrong org:** `supabase/migrations/106_org_id_autofill_trigger.sql:85-104` fills `org_id` only when NULL, using `SELECT org_id FROM org_members WHERE user_id=… LIMIT 1` with no ORDER BY. An explicit `org_id` is kept verbatim (`:86`).
- **Fix shape (copy `create_thread`, `threads.py:960-965`):** add `request: Request` to both routes. Call `_org = await resolve_active_org_or_none(request, current_user)`, and add `org_id` to the insert only when it is truthy. With no header or a non-member header, the call returns `None` and the insert stays byte-identical, which is also the foreign-org negative case. For workflows, add a keyword-only `org_id: UUID | None = None` to `create_workflow_definition`, as a conditional column (two SQL variants, or `COALESCE($6, NULL)` with the trigger still filling NULL). A NULL insert keeps the trigger path byte-identical.
- ⚠ **Parent folder in a different org:** a header naming org B with `parent_id` pointing at an org-A folder would create a cross-org child. Recommend refusing with the same 404 "Parent folder not found" when `_org` is set and the parent's `org_id != _org`. That stays honoured by construction and adds no new capability. (Raise it at the security review.)
- **Tests to model on:**
  - Unit: `tests/unit/test_268_send_path_stamp.py:263-330` (`test_create_thread_stamps_the_validated_active_org`, `…without_an_active_org_is_byte_identical`), which patch `resolve_active_org_or_none` with `AsyncMock`. Existing route tests: `tests/unit/test_103_draft_crud.py`, `tests/integration/test_folders.py`.
  - Real two-org Postgres: `tests/integration/test_268_two_org_rows.py`. Its fixture derives the trigger's `LIMIT 1` org (`TRIGGER_ORG_SQL`) and asserts A ≠ B before the org assertion. That non-vacuity control is required. **DB-mutating.**

### F2. BUG-261021-05 / D-04: enforcing the gate on `escalated` is unsatisfiable by construction [VERIFIED: codebase]
- `grounding_cause` (`grounding.py:1178-1209`) checks `detected` (the step has a KB tool) first. **So `escalated` always means a step with no KB tool.**
- The engine gate is `citations_required` with `mode: retrieved_and_cited` (`grounding.py:1444-1453`). Half (a) fails whenever `output["citations"]` is empty (`validator_kinds.py:413-418`). Only KB tools populate `citations`: `_exec_llm_agent` and `_exec_llm_batch_agents` fold them from the sub-agent, and the validator deliberately never reads `source_refs` (`validator_kinds.py:359-364`). `web_search` cannot satisfy it.
- `apply_tool_budget` with the step's whitelist (`openai_service.py:1537`) shows the model only whitelisted tools, so an escalated step cannot search the KB at all.
- `engine_ask.is_locked` (`:740`) is True for an escalated step, so `compose_engine_choices` drops "Continue without sources" (`:787`). The 295 "Search another folder" option only sets a scope override (`engine_ask.py:1302-1314`) and gives no tool. The pause therefore leads to Stop only, and `options == [STOP]` already maps to `fail_run` (`engine_ask.py:961-963`). A golden run fails at publish (`engine_ask.py:951-954`).
- `GovernanceSection.tsx:56-62` already records this trap for `llm_single` ("an escalated `llm_single` has no retrieval path at all, so the engine gate would fail it on every single run"). The same reasoning applies to every escalated agent step.
- **Measured locally (read-only):** 0 phases with `grounding_escalated: true` in any `workflow_definitions` row.
- **Options for the operator (`checkpoint:decision` before planning W1's grounding task):**
  - **(a) D-04 literal.** Widen `effective_phase` (`:1444`) and `is_engine_citation_gate` (`:1226`) to `in ("detected", "escalated")`. Result: every escalated step fails every run. To stay honest it also needs a blocking author-time refusal, which then makes escalation unusable. This is effectively removal, and it changes 185 behaviour pinned by `test_185_detection.py`, `test_185_engine_attachment.py` and `test_295_found_nothing_choices.py`.
  - **(b) Recommended.** Make the claim match the engine. For `escalated`, the seal and gate row stop claiming a check: `WorkflowBuilderPage.tsx:436-445` `gatesFor`, `canvasModel.ts:382-384` `isGrounded` → `=== "detected"`, `GovernanceSection.tsx:367` `governance-attached`, and `definitionOps.ts` copy. The escalated bit keeps the one effect it really has: if a KB tool is added later, Continue stays removed (`is_locked`). `teamModel.ts:253` already matches the engine. This adds no new capability and touches the frontend only (W3).
  - **(c) The capability version** ("escalation grants the step `search_documents`") is a new capability. Under D-03 it becomes a v4.8 seed.
- Whatever is chosen, these tests pin the current behaviour: backend `test_185_detection.py:235-282`, `test_185_engine_attachment.py:264`, `test_295_engine_ask_pause.py:249-348`, `test_295_found_nothing_choices.py:191-224`. Frontend: `GovernanceSection.test.tsx`, `canvasModel.test.ts:501-513`, `teamModel.test.ts`, `definitionOps.test.ts:629-657`, `WorkflowBuilderPage.canvas.test.tsx`, `SeedReceipt.test.tsx`.

### F3. BUG-261020-02 / D-05: withhold downstream steps for non-owners [VERIFIED: codebase]
- Withholding happens in **one place**, `run_evidence.compose_phase_log` (`run_evidence.py:212-289`). Rows are iterated in `phase_index` order (`_ordered_rows`). A step's `output_text` becomes `WITHHELD_OUTPUT_SENTENCE` when `not viewer_is_owner and readable_ids is not None and output_text is not None and any(citation not in readable_ids)` (`:263-269`). The caller is `api/workflow_run_evidence.py:340-352`, where `readable` comes from `_viewer_reads` over `cited_document_ids`.
- **Fix shape (one local + one condition):** add `withheld_upstream = False` before the loop. Change the condition to `… and output_text is not None and (withheld_upstream or any(...))`. After the assignment, set `withheld_upstream = True`. The owner path (`readable_ids is None`) is untouched by construction. The empty-set fail-closed case now withholds everything after the first citing step, which is correct.
- **Edge:** a human-input step already nulls `output_text` for non-owners (`:257-262`) and must not *trigger* the cascade, because that step saw no document. Trigger only on an actual citation withhold.
- **Not covered by D-05:** `deliverable.kind == "text"` (`compose_deliverable`) exposes no text, so it is fine. `inbound.py:569` `final_output_text` serves the **key owner's** API, not a colleague, so it is out of scope. Note it at the security review.
- **289-IN-04 (same file, `:365-372` and `workflow_run_evidence._viewer_reads`):** filter `cited_document_ids` to canonical UUIDs before the `uuid[]` cast.
- **Tests:** extend `backend/tests/unit/test_289_run_evidence.py`, a pure-function test with no DB.

### F4. BUG-261021-04 + BUG-261021-03: the followed run's terminal path [VERIFIED: codebase, MEDIUM on -03]
- **Path:** the 295-10 follow is `releaseSettledWorkflowLock` → live anchor → `subscribeProducerStreamRef.current(threadId, wf.latest_producer_run_id)` (`StreamsProvider.tsx:3935-3940`). `subscribeProducerStream` (`:1850-1918`) builds callbacks with `assistantId: producerRunId`, which matches no message. Its comment says *"the chat transcript is reconciled separately"*, and **nothing does it**. The `onTerminal` wrapper (`:1888-1906`) flushes deltas, removes the subscription, calls the original terminal and `refreshPhaseSpineAfterStop(threadId)` (phases only, `:4828`).
- **-04 cause (confirmed by reading):** the harness writes the final answer as a persisted `messages` row (`origin: harness`), not as deltas to a placeholder. No `getMessages` or `actions.reconcile` runs on this terminal. Compare the continuation path (`:2011-2018`) and the send path (`:2576-2600`), which do re-read. A thread switch runs `actions.reconcile` (`:2108-2111`), which is why "switch and back" shows it.
- **-03 cause (two candidates, discriminate in the RED test):**
  - **(i)** If `onTerminal` never fires for this subscription (for example, the segment ends without a sentinel), `refreshPhaseSpineAfterStop` never runs. The phases then come only from SSE `phase_*` events, which carry no `unsourced`.
  - **(ii)** The terminal read races the step-row write. The server read does carry the mark (`threads.py:2521-2544`, and both branches of `reconcilePhases` map `unsourced`, `:4966/:5017`).
- **Fix shape (one-touch, `StreamsProvider.tsx` FIRES 44 phases):** in that `onTerminal` wrapper, after `refreshPhaseSpineAfterStop(threadId)`, add `if (useStreamsStore.getState().viewedThreadId === threadId) void useStreamsStore.getState().actions.reconcile(threadId).catch(…)`. This is the same read a thread switch performs. If test (i) shows the terminal never fires, the hook is the `run_completed` / phase-terminal SSE instead. Decide by RED, not by guess.
- **Tests:** extend `frontend/src/__tests__/providers/streamsProvider_295_10_follow_after_answer.test.tsx`. Assert that after the follow's terminal, `getMessages` (or `reconcile`) is called and the bucket contains the persisted harness answer. Then assert that the phases for the step carry `unsourced`.

### F5. BUG-261025-03 (+ SEED-360 residue): several EXPIRED cards [VERIFIED: codebase + local DB]
- **Measured in the local DB (read-only) for the reported run `1e932094`:** the `approve` (llm_human_input) phase output object has **no `tool_call_id` key**. There are **three unanswered `ask_user_prompt` rows** for the run, at 11:59:57, 12:02:55 and 13:06:34, each with a different `tool_call_id`, and `claimed_at` = 13:06:32. The second re-ask came 3 minutes after the first, inside the 600 s timeout, so this is a re-drive and not a timeout.
- **Root cause:** `resume_stranded_workflows` (`harness_engine.py:2662+`):
  - `find_resumable_runs` returns runs with `status IN ('active','paused')`, the thread anchor, and an `active` phase.
  - The human-input branch (`:2715-2731`) requires `_is_llm_human_input(active)`. That reads `active["config"]`, which `get_active_phase` never selects (`db/workflows.py:1700`), or a `tool_call_id` in `output`, which the executor writes only on *return* (`human_input.py:357`).
  - `_active_tool_call_id` (`:2915`) reads the same missing key.
  - **So the branch is dead for every pending human ask.** The sweep falls through to `_resume_run`, `_exec_llm_human_input` mints a fresh `uuid4().hex` and inserts a new prompt row (`human_input.py:139,213-250`), and the old row stays unanswered.
  - The sweep runs on every lifespan: each uvicorn worker boot, each `--reload` restart in dev, and every TestClient lifespan (SEED-363). `/pending` (`api/panel.py:165-235`) returns **every** unanswered prompt row whose run is live, so the panel stacks them, and older ones flip to the clock-expired "agent stopped" copy (`PendingAskCard.tsx:633-636`). The run reads `active` because the re-drive is running.
- **Fix shape (one branch, mirror 295's arm 2a at `:2706-2714`):** after the definition load, classify the active phase by the **definition**, the same way `_is_armed_action_risk(active, definition)` does. If its type is `llm_human_input` and the run's latest prompt row (`get_pending_ask_user(pool, run_id)`) is unanswered, call `await pause_run(pool, run_id); continue`. Do not re-drive. The answer route `_redrive_paused_workflow_run` already consumes the durable answer with `resume_answered_tool_call_id` (`api/runs.py:781-782`, `human_input.py:173-210`), and `pause_run` releases the claim lease.
  - ⚠ This changes the 096-09 contract ("pending → re-subscribe + re-emit the SAME prompt"), whose code was unreachable anyway. Re-read the pinned tests first: `tests/test_harness_resume.py`, `tests/test_096_askuser_cleanup.py`, `tests/test_096_ci_workflow_regression.py`, `tests/test_200_human_gate_pause.py`, `tests/test_295_engine_ask_redrive.py`. Some fake rows may carry `config`/`tool_call_id` and pass today for that reason.
  - Mirror the shape of `_is_armed_action_risk`, never a second classifier.
- **Answered case:** today it also falls through and re-asks, because no `resume_answered_tool_call_id` is set on the sweep path. Same fix family: when the latest prompt *is* answered, set `ctx.resume_answered_tool_call_id = tcid` before `_resume_run`. Include it, or the "answered while the server was down" case still re-asks.
- **UI half (W4, optional defence):** after the backend fix, no new duplicates appear. Historical duplicates are on cancelled runs, which `/pending` already hides. Recommend **no** PendingAskCard change unless the G-4 drive still shows more than one card. If a guard is wanted, put it server-side (`/pending` returns only the newest unanswered harness prompt per `run_id`). ⚠ Do not apply it to Deep `ask_user` prompts, where a run can legitimately ask twice in parallel tool calls.
- **SEED-363 makes this worse in dev.** Fix both.

### F6. DEBT-3: the re-drive guard and `cap_paused` [VERIFIED: codebase + local DB]
- `_redrive_paused_workflow_run` selects `wr.status = 'paused'` (`api/runs.py:737-748`). Before that can matter, `engine_pause` calls `pause_run` **first** (`engine_ask.py:1006`, with a comment at `:687` saying exactly this). `pause_run` writes `paused` from any non-terminal status, `cap_paused` included (`db/workflows.py:2291`).
- `grep` finds **no backend writer** of `workflow_runs.status = 'cap_paused'`. All `cap_paused` writes are to `runs` (the producer table) from `run_producer.py`. Local DB: 0 `workflow_runs` rows are `cap_paused`.
- `run_is_cap_paused` (the inventory's suggested tool) reads **`runs`**, not `workflow_runs`. It is the wrong predicate for this guard and must not be bolted on.
- **Disposition per D-02:** write the RED test anyway: a run at `cap_paused`, engine ask, then answer, then assert a re-drive is spawned. Expect it to pass (the status is `paused` by then). Then close as "did not reproduce", with the test and the no-writer grep as evidence. If it does go red, the one-touch fix is widening the SELECT to `wr.status IN ('paused','cap_paused')` with `claim_run` still the CAS.

### F7. 295-RES-a / RES-b [VERIFIED: codebase]
- **RES-a:** the armed checkpoint in `_run_phase_with_gates` writes `action_risk_pending` and emits on **every** entry (`harness_engine.py:1015-1024`), including the answered re-drive, which then consumes the approval inside `_resolve_failure_with_ask_user`. 295-04-SUMMARY:164 recorded it unfixed because of the `If` ceiling. **One guard:** skip the audit and emit when `getattr(ctx, "resume_answered_tool_call_id", None)` is set. That is the answered re-drive, the only path that should not announce a new pending approval. Evidence lists `action_risk_pending` as a recorded decision (`run_evidence._RECORDED_KINDS`), so add a test asserting one row after approve plus re-drive. This is the one harness_engine touch the 295 ledger section deferred to "the phase that takes the armed-block seam". Record it as a one-touch, or as a guardrail override if the plan prefers the seam.
- **RES-b:** a Stop that reaches a live producer (`_cancel_run_internals` step 3a, `task.cancel()`) is finalised by the producer's own escape, which does not know who stopped it (295-04-SUMMARY:165). The re-open trigger names the shape: **carry the user id onto the cancel broadcast.** `broadcast_run_cancellation(redis, run_id, reason="cancelled")` (`run_lifecycle.py:103`) already SETs the level key `run_cancelled:{id}` (TTL 24h). Put `stopped_by` into that value or a sibling key. The F2 / resume-terminalize escape (`run_handoff.record_failed_end` / `resume_with_terminalize`) reads it and calls `record_stop(pool, run, stopped_by, policy="run_cancelled")`. `record_stop` only writes when it wins, which keeps the circuit breaker (which passes nothing) nameless. `run_lifecycle.py` and `run_producer.py` both FIRE, so this is one kwarg plus one read.

### F8. SEED-362: a resumed run finishes on the owner's default model [VERIFIED: codebase]
- `_build_resume_context` sets `model=resolve_workflow_ctx_model(_owner_settings)` (`harness_engine.py:~2564-2576`) and never reads `workflow_runs.model`. The column exists (`full-schema.sql` `workflow_runs.model text`), and `create_workflow_run` persists it. There is **no provider column**. `workflow_runs.metadata jsonb` exists, with a merge writer at `db/workflows.py:~2740`.
- **Fix shape:** select `wr.model` in both callers' row SELECTs (`find_resumable_runs` `db/workflows.py:1620+`, `_redrive_paused_workflow_run` `api/runs.py:737`). In `_build_resume_context`, prefer `run.get("model")` resolved through `resolve_sub_agent_model_safely(owner_settings, override_model=run_model)`, falling back to the owner default only when NULL. The resume shell `runs` row `model/provider` placeholders stay as they are.
- ⚠ **Provider:** a per-request provider such as OpenRouter for `z-ai/glm-5.2` is not recoverable from the id alone in every case. Recommend persisting `provider` into `workflow_runs.metadata` at kickoff through the existing merge writer (no migration), and reading it back on resume. This is an open question for the planner: do it, or record the gap.
- **Proof:** re-drive 289-VALIDATION row (d) (a paused run started on a non-default provider, then answered), with backend log lines showing the provider host. This is a D-21 roster row.

### F9. SEED-363: TestClient lifespan claims live runs [VERIFIED: codebase]
- `main.py:394-406` (`_resume_stranded` task) and `:411-430` (`_reconcile_orphans`) run on every lifespan unless `_setup_mode`. The `-p no_run_sweeps` plugin CONTEXT mentions **does not exist in the repo** (grep: 0 hits). It was a per-session scratch plugin in 289.
- **Fix shape (no env var, so no deploy-drift obligation):** a module-level `RUN_BOOT_SWEEPS = True` in `app/main.py`, checked beside `_setup_mode` for both tasks. `backend/tests/conftest.py` sets `app.main.RUN_BOOT_SWEEPS = False` in `pytest_configure`. Tests that exercise the sweeps call the functions directly (`test_run_reconciler.py`, `test_200_*`, `test_295_*`), so they are unaffected.
- ⚠ An env var or setting would trigger the deploy-artifact parity rule (`check-deploy-drift.sh`). Avoid it.
- **Test:** a TestClient lifespan test asserting neither sweep coroutine is awaited, with `resume_stranded_workflows` patched to record calls.

### F10. BUG-261024-04 (defect half): follow-up turns re-show prior files [cause UNPROVEN, measure first]
- The live `final_output_files` emit is already run-scoped. It filters `_previous_files_in_run` to `_new_file_hashes_in_run` (`agent_loop.py:3378-3383`). The per-cell harvest delta excludes a per-run baseline snapshot (`tools/sandbox.py:556-570`). On reload, `lib/api/threads.ts:155-179` rebuilds `finalOutputFiles` from **that message's** persisted `execute_code` results only.
- **Leads to measure, in order:**
  - **(1)** The model regenerates the whole set in the follow-up cell. The same filenames get new hashes (reportlab PDFs embed a CreationDate), so they are honestly "produced this turn". If so, D-10's "only files produced in that turn" already holds by hash, and the remaining ask is the intermediates policy (SEED).
  - **(2)** `ctx._output_baseline_seeded` lives on `ToolContext`, which is rebuilt every iteration (`tools/sandbox.py:599-616` says so). So the baseline re-seeds every iteration, and that can overwrite earlier-iteration metas with `iteration:-1, url:None`.
  - **(3)** A frontend merge (`StreamsProvider` `onFinalOutputFiles`, `:1082-1108`) stamping onto the wrong assistant message.
- **RED drive first** (D-02): "PDF with 3 charts", then the follow-up "change the title". Record each turn's persisted `execute_code.output_files` and live `final_output_files`. Fix only the measured cause. `agent_loop.py` FIRES (35 phases), so the fix is one-touch. Tests: `tests/test_095_final_output_tag.py`, `tests/unit/test_075_4_dedup_supersedes.py`.

### F11. BUG-261024-01: Moonshot rejects the emit schema [code VERIFIED; provider rule LOW]
- **Provider docs:** Moonshot/Kimi's official tool-calls guide (`platform.kimi.ai/docs/guide/use-kimi-api-to-complete-tool-calls`, fetched this session) says only "Tool definitions are written in JSON Schema format" with `type: object`. It documents **no** rule about `$ref`, `$defs`, recursion or `anyOf`. The error text ("not a valid moonshot flavored json schema … detected infinite recursion without termination condition" at `properties.phases.items`) is the only primary evidence. Third-party integrations claim more Moonshot rules (every property needs `type`; `type` goes on `anyOf` children, not the parent; no `{"type":"null"}` in `anyOf`), but these are **LOW / unverified** [ASSUMED].
- **Where the schema is built:** `WF_SCHEMA = WorkflowDefinition.model_json_schema()` (`workflow_authoring.py`) uses `$defs` refs. `phases.items` is `{"$ref": "#/$defs/PhaseSpec"}`, and PhaseSpec's `config` is a discriminated union of refs. The report found no real cycle.
- **Where to transform:** the OpenAI-compatible adapter, `provider_gateway/openai_compat.py:449-455` (`create_adaptive_streaming_chat(tools_override=request.tools, …)`). It is provider-gated already (`:276` uses `active_provider_name in ("moonshot", …)`). Recommend a **new pure leaf** `provider_gateway/schema_moonshot.py` with `inline_refs(schema)`, which resolves `#/$defs/*` and `#/definitions/*`, drops the defs and refuses true cycles. Add one conditional at the adapter: `tools_override=moonshot_tools(request.tools) if <endpoint provider> == "moonshot" else request.tools`. Key it on the **endpoint** provider (`request.retries_provider()` / `active_provider_name`; see 282-REVIEW CR-01), never the registry vendor. `openai_compat.py` FIRES (6 phases), so this is a one-line touch with logic in the leaf.
- **Byte-identity:** a tool schema with no `$ref` must come back identical. Deep chat tools pass through the same adapter. Prove it with an identity test over `get_tools()` output.
- **Verification:** the live Moonshot row is ⛔ (account suspended, D-21). The unit tests are the proof. (1) No `$ref`/`$defs` remain after transform. (2) `jsonschema` validation of sample valid and invalid definitions gives the same verdicts before and after inlining. (3) Recursion refusal on a synthetic cycle. Optionally add the `anyOf`-type rule behind its own test, marked [ASSUMED].

### F12. 293-F-4: a step pinned to another provider's model [MEDIUM; RED re-drive first]
- **Emit steps:** `phase_types.py:1653-1656` calls `forced_emit(…, provider=getattr(ctx, "provider", None) or _provider_for_model(model, ctx))`. **`ctx.provider` (the run's provider) outranks the model's own provider**, so a step pinned to `gpt-5.6-luna` is routed to the active provider (deepseek in the 293 drive), which gives exactly the observed 400. `forced_emit` already resolves the target provider's key and base_url when `provider != active` (`forced_emit.py:449-481`).
  - **One-touch fix:** when `phase.config.model` is set, prefer `_provider_for_model(model, ctx)`. Otherwise keep the current order.
- **Agent steps:** `task_service.run_task_sub_agent` always uses `provider = parent_ctx.user_settings.active_provider` (`task_service.py:~576-579`). Its model goes through `resolve_sub_agent_model_safely` (`sub_agent_models.py:146-200`), where `override_model` (the user's `sub_agent_model`) and `user_settings.llm_model` **outrank** `fallback_model` (the phase's model), and a confidently cross-provider candidate is silently swapped for the provider default. So an agent step's pinned model may be **silently ignored**, not 400'd.
  - The RED test should establish this. If confirmed, the honest no-capability fix is a worded run-time refusal or a fallback notice (the `model_fallback` sub-step plus `policy_applied` precedent in `_effective_model_checked`). Real cross-provider sub-agent routing is a **capability**, so it becomes a seed under D-03.
- **Files:** `phase_types.py` (FIRES), `task_service.py` (FIRES), `sub_agent_models.py` (**no ledger row**, so add one).

### F13. 291-S6-F7 / D-08: golden inputs [VERIFIED: codebase]
- `publish_service.py:1635-1656` fills every declared input with `"golden run placeholder for <key>"`, or an `@example.invalid` address for address-like keys.
- ⚠ **`InputFieldSpec` (`models/harness.py:653-666`) has no `example` or `default` field.** Its fields are `key, label, type ∈ {text, number, date, enum, file, kb_auto}, required, source, enum_options, folder_scope, origin, note, fills`. D-08's "field examples or defaults" do not exist, and adding them is a definition-schema change, which is capability.
- **No-capability shape:** `enum` takes the first `enum_options`; `date` takes a fixed real ISO date; `number` takes `"1"`; text keeps the worded placeholder. Address-like keys keep `.invalid`, which is load-bearing (RFC 2606, `:1630-1634`). Then make the gauntlet say in words that these fields were answered with stand-ins, with one gauntlet sentence from the publish vocabulary.
- "Derive from the author's test instruction" needs an LLM extraction, which is a **capability**. Seed it, or have the operator re-rule. Recommend raising it with D-04 at the plan-start checkpoint. 291 tests: `tests/unit/test_291_form_inputs_overlay.py`, `test_291_pdf_fill_driver.py`.

### F14. 291-S6-F8: the first LLM step cannot see launch answers [VERIFIED: codebase]
- `_first_phase_user_turn` (`phase_types.py:206-216`) returns the prior output, else `_kickoff_prompt(ctx)` (`ctx.inputs["kickoff_prompt"]`). Declared launch answers in `ctx.inputs` never reach an LLM step's user turn.
- **Fix shape (one helper):** when there is no prior output, append the declared inputs' answers (keys from `definition.inputs`, never the whole `ctx.inputs`) to the kickoff. Exclude the internal keys (`kickoff_prompt`, `_untrusted_inputs`, `_schedule_id`, folder override: see `_NON_ACTION_RUN_INPUTS` at `:2119`). Wrap each value with `wrap_untrusted_input` when `ctx.inputs[UNTRUSTED_FLAG]` is true, the TRUST-03 posture `:1021-1031` already uses.
- `launch_kickoff` (`inbound_inputs.py:234`) may already fold values into `kickoff_prompt` for **key** runs (293-05 D-3). Read it first so the answers do not appear twice.
- It touches every first LLM step's prompt, which makes it a cross-provider (D-21) row. Test: `tests/test_dual_mode_wiring.py` (the existing `_first_phase_user_turn` test).

### F15. SEED-364 / D-06: neutral default org name [VERIFIED: codebase]
- New orgs are created in `public.handle_new_user()` (SECURITY DEFINER trigger on `auth.users`): `create_org_with_default_dept(COALESCE(new.email, new.id::text) || '''s Organization', NULL, 'General')` (`105_personal_org_backfill.sql:103`, current definition in `full-schema.sql:553-571`).
- ⚠ **Second copy:** `scripts/full-schema-supplement.sql:205` carries the same body, with a note: *"If a future migration changes handle_new_user, update this copy in the SAME commit or greenfield deploys drift."* `full-schema-supplement.sql` FIRES (15 phases).
- **Migration 216** (`216_neutral_default_org_name.sql`): `CREATE OR REPLACE FUNCTION public.handle_new_user()`. Keep the body byte-identical except the name expression, for example `COALESCE(NULLIF(trim(new.raw_user_meta_data->>'display_name'), '') || '''s organization', 'My organization')`. The wording is Claude's discretion and must carry no email. Keep `SECURITY DEFINER`, the pinned `search_path` and the inner `EXCEPTION WHEN OTHERS` swallow. **No UPDATE of existing rows** (D-06).
- Re-check the grant posture after `CREATE OR REPLACE`. Migration 181 revoked PUBLIC EXECUTE on SECDEF functions, and `CREATE OR REPLACE` keeps the existing privileges, but verify with `check-schema-acl-parity.cjs`.
- Apply locally under the lock, run `regenerate-full-schema.sh`, then `check-schema-acl-parity.cjs` and `check-greenfield-privileges.py` (293's set). **DB-mutating.** Cloud apply belongs to the post-phase deploy (DEPLOY row: 214, 215, 216).

### F16. SEED-365 rate-limit half / D-13 [VERIFIED: codebase]
- `api/citation_checks.py:125-180` `post_citation_check` has an in-flight SET NX lock per message and **no per-user limit**.
- **Shape:** reuse `rate_limit.hit(redis, key_id=user_id, kind="citation", limit=N)` inside a new `enforce_user_citation_limit` beside `enforce_ip_limit`. It fails closed with 503 on Redis error and returns 429 with `Retry-After`, worded like the existing details. Call it once at the top of `post_citation_check`, before the in-flight claim.
- **Limit value:** a module constant, on the `IP_CALLS_PER_MINUTE` precedent. A Settings knob would need migration 216/217 plus a UI control (the operator rule "everything in the UI"), which is capability-ish. Record the constant as an [ASSUMED] choice for the operator.
- Tests: `tests/unit/test_293_rate_limit.py` (limiter fakes in `phase293_inbound_fakes.py`) and `tests/unit/test_294_citation_check_route.py`.

### F17. 287-T01: server-side required-input check at kickoff [VERIFIED: codebase]
- There are two kickoff sites: `api/threads.py:2085` and `services/workflow_kickoff.py:570`. Both call `launch_kickoff(body.content, definition, body.inputs)`. `inbound_inputs.validate_inbound_inputs` already implements "missing required values", with `required` true unless explicitly false (`:9,98,162-166`), but only for key calls.
- **Shape:** a pure `missing_required(definition, inputs) -> list[str]` in `inbound_inputs.py` (young, not firing), reusing `declared_fields`. One call per kickoff site, raising 422 with one worded sentence before any run or thread insert. `threads.py` (94 phases) and `workflow_kickoff.py` both FIRE, so each takes one guard line. Check the call order so the refusal precedes `create_workflow_run`.
- Mirror `soulData.missingRequiredFields` semantics: `file` fields have no browser value on this path, and `kb_auto` is engine-sourced. Check what the client predicate excludes and match it exactly, then pin the parity in a test.

### F18. 293-IN-05: migration 215 backfill regex [VERIFIED: codebase]
- `215_api_keys_and_run_origin.sql:131` uses `~* '^[0-9a-f-]{36}$'`. Replace it with `~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`.
- It was applied locally and its backfill already ran. A backfill `UPDATE` is not schema, so `full-schema.sql` is unaffected and no regeneration is needed for this edit alone. Cloud has not received 215.
- Add a shape test in the `tests/unit/test_294_migration_211_shape.py` style that reads the file and asserts the canonical regex.

## G-5 Map (files the fixes touch)

Triples are from `docs/HOT-FILE-LEDGER.md` scan list at HEAD. "FIRES" means ≥ 3 phases. Every touched file needs its ledger section updated in the same commit.

**⚠ Files with no ledger row: `check-hot-file-ledger.cjs` will fail the plan until rows are added (verified this session by running the gate):**
`backend/app/api/schedules.py`, `backend/app/services/tools/render_template.py`, `backend/app/services/sub_agent_models.py`, `frontend/src/components/workflows/definitionOps.ts`, `frontend/src/components/workflows/GovernanceSection.tsx`, `frontend/src/components/workflows/NodeCornerMarks.tsx`. Re-derive the triple with the recipe, and add the row plus its section in the first commit that touches the file.

| File | Triple | Fires | Fixes touching it | One-touch shape |
|---|---|---|---|---|
| `backend/app/services/harness_engine.py` | 68/26/2961 | ⚠ FIRES | RES-a, 289-F3, SEED-362, BUG-261025-03 | **Four touches in one plan.** Each is one guard or branch: RES-a 1 guard; F3 one kwarg at `:383`; SEED-362 one read in `_build_resume_context`; 261025-03 one sweep branch. Record each in the ledger section. If the plan cannot keep each to one statement, log a STATE.md guardrail override (D-16). |
| `backend/app/api/runs.py` | 52/22/2003 | ⚠ FIRES | DEBT-3 (likely none), 289-WR-06b, 289-IN-05, 295-IN-07, SEED-362 select | one return fix, one `wr.model` select, one worded audit sentence, one delayed-retry task (held reference) |
| `backend/app/api/threads.py` | 282/94/2744 | ⚠ FIRES | 287-T01 | one guard call |
| `backend/app/services/workflow_kickoff.py` | 12/9/597 | ⚠ FIRES | 287-T01 | one guard call |
| `backend/app/db/workflows.py` | 59/30/2827 | ⚠ FIRES | BUG-261021-02 (W1), 295-IN-03 (W2), SEED-362 (select) | keyword-only `org_id`; strip `_awaiting_answer` in the cancel UPDATE; one select column |
| `backend/app/api/workflows.py` | 47/25/1681 | ⚠ FIRES | BUG-261021-02 (W1), 293-DEL (W2) | `request` param + one stamp; one `except ForeignKeyViolationError → 409` |
| `backend/app/api/folders.py` | 14/9/277 | ⚠ FIRES | BUG-261021-02 | `request` param + one stamp (+ parent-org check) |
| `backend/app/services/harness/grounding.py` | 23/10/1437 | ⚠ FIRES | BUG-261021-05 only if (a) | widen 2 comparisons |
| `backend/app/services/run_evidence.py` | 5/3/525 | ⚠ FIRES | BUG-261020-02, 289-IN-04 | one local + one condition; one UUID filter |
| `backend/app/services/harness/phase_types.py` | 63/32/3081 | ⚠ FIRES | 291-S6-F8, 293-F-4, 291-IN-01 | one helper; one precedence expression; one guard |
| `backend/app/services/harness/publish_service.py` | 34/15/2010 | ⚠ FIRES | 291-S6-F7, 288-WR-02 | type-aware placeholder loop (same loop); one ceiling format |
| `backend/app/services/harness/validator_kinds.py` | 18/8/899 | ⚠ FIRES | 295-IN-08 | one condition on the note |
| `backend/app/services/run_lifecycle.py` / `run_producer.py` | 10/6/776 · 25/13/1212 | ⚠ FIRES | RES-b | one kwarg on broadcast; one read at the escape |
| `backend/app/services/run_reconciler.py` | 5/3/406 | ⚠ FIRES | 295-IN-02 | one condition |
| `backend/app/services/scheduler_service.py` | 11/6/308 | ⚠ FIRES | 295-IN-05 | one worded sentence |
| `backend/app/main.py` | 94/68/982 | ⚠ FIRES | 289-IN-08, SEED-363 | one flag + one condition |
| `backend/app/services/agent_loop.py` | 78/35/3776 | ⚠ FIRES | 292.1-IN-02, BUG-261024-04 (if cause there) | one log arg + one emit; TBD after measure |
| `backend/app/services/eval_runner_service.py` | 13/8/1040 | ⚠ FIRES | 292.1-IN-04 | one constant |
| `backend/app/services/provider_gateway/openai_compat.py` | 9/6/466 | ⚠ FIRES | BUG-261024-01 | one conditional; logic in a new leaf |
| `backend/app/services/task_service.py` | 28/15/1038 | ⚠ FIRES | 293-F-4 (agent path, if confirmed) | one notice / refusal |
| `backend/app/api/workflow_runs.py` · `workflow_wire.py` | 20/14/1444 · 3/3/517 | ⚠ FIRES | 289-IN-07, 288-IN-01 | type annotations (OpenAPI snapshot re-baseline: `tests/fixtures/phase286/workflows_openapi.json`) |
| `scripts/full-schema-supplement.sql` | 23/15/848 | ⚠ FIRES | SEED-364 | the `handle_new_user` copy, same commit as mig 216 |
| `frontend/src/providers/StreamsProvider.tsx` | 116/44/5210 | ⚠ FIRES | BUG-261021-04/-03 | one reconcile call in one terminal wrapper |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 62/26/2897 | FIRES | BUG-261024-02, 290-WR-02, 290-IN-03, (BUG-261021-05 b) | each one prop, one condition or one call |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 32/10/1744 | FIRES | 290-WR-02 | controlled `view` prop (`:1155`) + gate |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | 12/5/1155 | ⚠ FIRES | 291-WR-01/IN-08, 291-WR-02 | **M rows. Ledger says "extraction FIRST".** Expect a guardrail override, or extract the snapshot into a leaf |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 30/14/1566 | FIRES | 291-S3-F2/F3 | label lookup; accept list |
| `frontend/src/pages/WorkflowRunPage.tsx` | 34/14/1597 | FIRES | 291-S6-F9 | CSS class only |
| `frontend/src/components/workflows/RunEvidenceReport.tsx` | 4/3/472 | ⚠ FIRES | BUG-261025-02, 289-F-A/B/C | header flex fix; one alert; renderer swap; one sentence |
| `frontend/src/components/panel/PendingAskCard.tsx` | 24/11/1103 | ⚠ FIRES | BUG-261025-03 (only if still needed after backend) | none expected |
| `frontend/src/components/panel/PhaseCard.tsx` | 20/13/811 | ⚠ FIRES | 295-D-uat-02 | one status mapping |
| `frontend/src/components/workflows/WorkflowScheduleModal.tsx` | 3/3/601 | ⚠ FIRES | BUG-261025-01, 287-SCHED | pending state + result line; reuse `missingRequiredFields` |
| `frontend/src/components/workflows/library/RunModal.tsx` | 8/5/713 | ⚠ FIRES | 287-IN-01 | clear refusal on change |
| `frontend/src/stores/streamsStore.ts` | 27/18/660 | ⚠ FIRES | 287-TSC | one type fix |
| `frontend/src/components/workflows/soulData.ts` | 14/12/554 | ⚠ FIRES | 291-WR-06 UI, 287-IN-02 | one predicate; one label fallback |
| `frontend/src/components/workflows/phaseVocabulary.ts` / `canvasModel.ts` | 16/6/990 · 13/6/752 | FIRES | 290-FU-canvas, 290-OBS-vocab, (BUG-261021-05 b) | `own()` + guard; always-armed for `external_action` |
| `frontend/src/pages/WorkflowsPage.tsx` / `PublishGauntlet.tsx` | 46/19 · 21/11 | FIRES | 288-F-4 | carry one note to the toast |
| `frontend/src/components/workflows/library/libraryVocabulary.ts`, `decisionsVocabulary.ts`, `lib/api/knowledge.ts`, `WorkflowCard.tsx` | FIRES | — | 290-IN-02, 291-WR-02, 291-IN-05, 286-S04-2 | data / type / comment only |

Young or non-firing files the fixes touch: `engine_ask.py`, `run_handoff.py`, `inbound.py`, `inbound_inputs.py`, `unattended_launch.py`, `api_keys.py`, `citation_checks.py`, `rate_limit.py`, `rerank_engines/*`, `citation_claims.py`, `text_tool_calls.py`, `describe_files.py`, `describe_draft_guards.py`, `workflow_authoring_doors.py`, `form_inputs.py`, `evidenceVocabulary.ts`, `teamModel.ts`, `TeamPicture.tsx`, `declaredInputsVocabulary.ts`, `describeRefusalVocabulary.ts`, `DraftInputsFold.tsx`, `citationCheckStore.ts`, `CitationCheckAction.tsx`, `ChatLaunchForm.tsx`, `useStartWorkflowInThread.ts`, `ThreadWorkflowPicker.tsx`, `chat/artifacts/*`, `settings/apiKeys/curlExamples.ts`, `settings/rerankEngines.ts`. Rows exist for all of them. `workflow_authoring.py` FIRES (12 phases): 291-S2-F2/F3 are one condition and one sentence each.

## Plan Cut (D-14, G-8) and File Ownership

**Recommendation: 5 plans in 3 waves.** No two plans in one wave edit the same file. At most 2 test-running agents run at once (CLAUDE.md rule 2), and DB-mutating plans are serial (D-15).

| Wave | Plan | Workstream | DB-mutating? | Runs alongside |
|---|---|---|---|---|
| 1 | **296-01** | W1 tenancy / governance / privacy (backend) | **YES**: mig 216 apply + two-org integration tests | 296-04 |
| 1 | **296-04** | W4 run surfaces / chat / settings (frontend + rerank registry) | no | 296-01 |
| 2 | **296-02** | W2 run lifecycle + inbound + providers + tracing (backend) | **YES** where it drives runs (sweep, re-drive, RED drives) | 296-03 |
| 2 | **296-03** | W3 describe-it authoring + builder (mixed) | no (unit / stubbed publish tests; confirm in plan) | 296-02 |
| 3 | **296-05** | W5 tests / gates / records / seeds / G-4 / roster / ledger / secure-phase | **YES** (baseline under the lock; G-4 drive) | alone |

**If W2 cannot fit one context budget:** split it into 296-02a (run lifecycle: `runs.py`, `run_handoff`, `run_reconciler`, `db/workflows.py`, `schedules.py`, `scheduler_service`, `validator_kinds`, `harness_engine`, `run_lifecycle`, `run_producer`, `workflow_runs`, `workflow_wire`, `main.py`, `unattended_launch`; DB-mutating) and 296-02b (inbound / providers / tracing: `inbound.py`, `inbound_inputs.py`, `api_keys.py`, `api/workflows.py` DEL, mig 215 edit, `rerank_engines/local+tracing`, `citation_claims`, `text_tool_calls`, `agent_loop`, `eval_runner_service`, Moonshot leaf + `openai_compat`, `phase_types` (S6-F8, 293-F-4, 291-IN-01), `task_service`, `sub_agent_models`; not DB-mutating). That makes 6 plans: wave 2 runs 02a ‖ 03, wave 3 runs 02b alone, wave 4 runs W5. 6 is within G-8 without extra justification, but it adds one wave.

**Ownership reassignments from the inventory, to remove same-wave conflicts:**

| Row | Inventory says | Move to | Reason |
|---|---|---|---|
| 289-IN-06 (`evidenceVocabulary.ts`) | W1 | **W4 (296-04)** | W4 owns `evidenceVocabulary.ts` for 289-F-C. One owner per file. |
| 291-S6-F9 (`WorkflowRunPage.tsx` CSS) | W3 | **W4** | W4 owns the run page. |
| 286-S04-2 (`WorkflowCard.tsx:532` comment) | W4 | **W3** | Library family; W3 owns the library vocabulary. |
| 287-IN-02 (`soulData.ts:233`) | W4 | **W3** | W3 owns `soulData.ts` (291-WR-06 UI). The `RunModal`/`ChatLaunchForm` halves of 287-IN-01/04b stay in W4. |
| 291-IN-01 (`phase_types.py` + `form_inputs.py`) | W3 | **W2** | W2 owns `phase_types.py` (S6-F8 and 293-F-4 are D-21 W2 rows). |
| 288-WR-02 (`publish_service.py:1322`) | W2 | **W3** | W3 owns `publish_service.py` (S6-F7). |
| BUG-261025-03 backend half (`harness_engine` sweep) | W4 | **W2** | W2 owns `harness_engine.py`. The UI half only applies if the G-4 drive still shows duplicates. |
| BUG-261024-04 (defect) | W4 | **W2** | The likely cause is in `agent_loop.py`/`tools/sandbox.py`, which W2 owns (292.1-IN-02). Frontend reload mapping (`lib/api/threads.ts`) only if measured. |
| 294-LOCAL backend half (`rerank_engines/registry.py`) | W4 | stays **W4** | W2 owns `rerank_engines/local.py` and `tracing.py`, which are different files. |
| BUG-261021-05 | W1 | **(b): W3 frontend only.** (a): W1 `grounding.py` + W3 `teamModel.ts`/`GovernanceSection.tsx` | Depends on the D-04 re-rule. |

**Cross-wave edits to one file are allowed (the waves are serial). Record each touch in the ledger section:** `db/workflows.py` (W1 then W2), `api/workflows.py` (W1 then W2), `inbound_inputs.py` (W1's `missing_required` helper, then W2's 293-IN-03/IN-06).

**W5 (296-05) contents:**
- **TEST rows:** 286-IN-02, 286-S04-1, 287-WR-03, 288-T-2, 288-T-3 (under the lock), 289-T-1, 289-V-2, 291-R1-IN-01, 292.1-test_075_4, 293-IN-07, 294-IN-03, the 293-INH/295-TEST re-derive.
- **CLOSE flips with commits.**
- **Seeds:** plant the 9 new seeds from `SEED-375` up (`max(id)+1`; the highest today is 374). Update SEED-367, SEED-365, SEED-363 and SEED-362 (answered), SEED-360 (F-4), SEED-364 (answered).
- **G-4:** Chrome drive of D-20's eight scenarios.
- **D-21 roster:** 7 natives + OpenRouter, ⛔ rows recorded.
- **Gates (D-22):** ledger, seeds (`check-seeds-register.cjs --phase 296` re-run once `files_modified` exist), CLAUDE.md size.
- **Security:** `/gsd:secure-phase 296`.
- **287-V-3:** read-only cloud check (Supabase MCP read).
- 287 verification note for D-12.

## Common Pitfalls

### Pitfall 1: Implementing D-04 literally
**What goes wrong:** every escalated step fails every run, and publish fails on any workflow containing one.
**Why it happens:** `escalated` excludes KB tools, and `retrieved_and_cited` needs KB citations (F2).
**How to avoid:** put a `checkpoint:decision` at the top of 296-01 and carry the (a)/(b)/(c) options from F2.
**Warning signs:** a test that escalates an agent with only `web_search` and expects a pass.

### Pitfall 2: Expecting 288-T-2 / 289-T-1 to lower the 71 baseline
**What goes wrong:** the W5 gate arithmetic is off by two.
**Why:** `tests/test_182_extraction_parity.py` and `tests/test_200_human_gate_pause.py` sit outside `tests/unit`. Both were verified red this session. Only `tests/unit/test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers` is inside the gate (verified red).
**How to avoid:** expect a ceiling of **≤ 70** after 292.1-test_075_4, absent other changes. Re-derive at base, never quote.

### Pitfall 3: Using `run_is_cap_paused` for DEBT-3
**What goes wrong:** the guard reads the producer `runs` table for a `workflow_runs` question.
**How to avoid:** see F6. Close DEBT-3 as did-not-reproduce, with the RED test.

### Pitfall 4: The "dead" human-input sweep branch is pinned by fakes
**What goes wrong:** sweep tests that hand-build an `active` row with `config.phase_type` or `output.tool_call_id` pass today, so changing the branch breaks fakes that never matched reality.
**How to avoid:** first write the RED test from the **real** `get_active_phase` row shape (`id, slug, phase_index, status, output, started_at, completed_at`). Then reconcile the fakes in `test_harness_resume.py` and the `test_096_*` / `test_200_*` files deliberately, with the reason in the test body (the D-206-07 precedent).

### Pitfall 5: Adding an env var for SEED-363 or the rate limit
**What goes wrong:** `check-deploy-drift.sh` fails, because every new env var the app reads must reach `deploy/onebox.env.example`, `docs/OPERATOR.md` and `docker-compose.prod.yml` in the same commit.
**How to avoid:** use a module flag set in `tests/conftest.py`, and constants.

### Pitfall 6: Migration 216 without the supplement copy
**What goes wrong:** greenfield deploys keep the email-named org.
**How to avoid:** edit `scripts/full-schema-supplement.sql:205` in the same commit. Regenerate with no reset. Run the ACL-parity and greenfield-privilege gates.

### Pitfall 7: The Moonshot transform changes other providers' bytes
**How to avoid:** key it on the endpoint provider, and return the input object unchanged when it contains no `$ref` (identity test over `get_tools()`).

### Pitfall 8: The OpenAPI snapshot and public spec drift on wire-type rows
**What goes wrong:** 288-IN-01 (`auto_answered`), 289-IN-07 (`confidence`) and 291-IN-05 (`covered_by`) change response schemas.
**How to avoid:** re-baseline `backend/tests/fixtures/phase286/workflows_openapi.json` in the same commit. If the route is public, run `scripts/build-public-openapi.cjs` (FIRES).

### Pitfall 9: The D-05 cascade fires on human-input steps
**How to avoid:** set `withheld_upstream` only when a **citation-based** withhold happened. A colleague's nulled human-input question is not document substance.

### Pitfall 10: The parent folder in another org (BUG-261021-02)
**How to avoid:** when the active org is set, refuse a `parent_id` whose folder `org_id` differs (same 404). This needs a folder read with `org_id`; `fetch_visible_folders` may not select it, so check.

### Pitfall 11: Concurrent worktree test runs re-drive live runs
**What goes wrong:** this happened 3 times in 289 and 2 in 295, until SEED-363 lands.
**How to avoid:** land SEED-363 early in W2. Until then, keep no live paused or streaming run on the local stack during gate runs. The local DB has 1 paused engine-ask run (`27aed61b`), which the sweep re-pauses on every boot harmlessly.

## Code Examples

### Org stamping on create (BUG-261021-02), modelled on `threads.py:960-965`
```python
# api/folders.py create_folder — add `request: Request` to the signature
_active_org = await resolve_active_org_or_none(request, current_user)
row = {"user_id": current_user["id"], "name": body.name.strip(),
       "parent_id": str(body.parent_id) if body.parent_id else None,
       "is_org_shared": body.is_org_shared}
if _active_org:
    row["org_id"] = _active_org   # absent/non-member header → no key → mig-106 trigger, byte-identical
```

### D-05 cascade (`run_evidence.compose_phase_log`)
```python
withheld_upstream = False
for n, row in enumerate(_ordered_rows(rows), start=1):
    ...
    if (not viewer_is_owner and readable_ids is not None and output_text is not None
            and (withheld_upstream
                 or any(c["document_id"] not in readable_ids for c in _citations_of(row)))):
        output_text = WITHHELD_OUTPUT_SENTENCE
        withheld_upstream = True
```

### Boot sweep: a pending human ask stays paused (mirror of arm 2a, `harness_engine.py:2706-2714`)
```python
# after `definition = await _load_run_definition(pool, run_id)` and its None guard
if active is not None and _phase_type_in(definition, active.get("slug")) == "llm_human_input":
    pending = await get_pending_ask_user(pool, run_id)
    _tcid = (pending or {}).get("tool_call_id")
    if _tcid and not await ask_user_response_exists(pool, run_id, _tcid):
        await pause_run(pool, run_id)   # releases the lease; the answer route re-drives
        continue
    # answered while down → consume, never re-ask
    _human_answered_tcid = _tcid
```
(`_phase_type_in` is the definition lookup `_is_armed_action_risk` already does. Reuse its idiom rather than adding a second classifier.)

### Moonshot `$ref` inliner (new pure leaf, `_sanitize_schema_for_google` precedent)
```python
def inline_refs(schema: dict) -> dict:
    defs = {**(schema.get("$defs") or {}), **(schema.get("definitions") or {})}
    if not defs and "$ref" not in json.dumps(schema):
        return schema                       # identity: byte-identical for ref-free tools
    def walk(node, stack):
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.split("/")[-1] in defs:
                name = ref.split("/")[-1]
                if name in stack:
                    raise ValueError(f"recursive $ref {name}")
                rest = {k: v for k, v in node.items() if k != "$ref"}
                return {**walk(defs[name], stack | {name}), **walk(rest, stack)}
            return {k: walk(v, stack) for k, v in node.items() if k not in ("$defs", "definitions")}
        if isinstance(node, list):
            return [walk(x, stack) for x in node]
        return node
    return walk(schema, frozenset())
```

### Follow-path terminal reconcile (`StreamsProvider.tsx` `subscribeProducerStream.onTerminal`)
```ts
originalOnTerminal(kind, errorPayload)
refreshPhaseSpineAfterStop(threadId)
// BUG-261021-04: the harness answer is a persisted row this subscription never rendered.
if (useStreamsStore.getState().viewedThreadId === threadId) {
  void useStreamsStore.getState().actions.reconcile(threadId).catch((err) =>
    console.warn("[StreamsProvider] follow terminal reconcile failed", err))
}
```

### Per-user citation limit (`rate_limit.py`)
```python
CITATION_CHECKS_PER_MINUTE = 10   # [ASSUMED] value — operator confirms
async def enforce_user_citation_limit(redis, *, user_id: str) -> None:
    try:
        retry = await hit(redis, key_id=user_id, kind="citation", limit=CITATION_CHECKS_PER_MINUTE)  # type: ignore[arg-type]
    except Exception:  # noqa: BLE001 — fail closed (D-15 of 293)
        raise HTTPException(status_code=503, detail=UNAVAILABLE_DETAIL)
    if retry is not None:
        raise HTTPException(429, detail=f"Too many citation checks: at most {CITATION_CHECKS_PER_MINUTE} a minute. Try again in {retry} seconds.",
                            headers={"Retry-After": str(retry)})
```

## State of the Art

| Old approach | Current approach | When | Impact |
|---|---|---|---|
| Boot sweep re-subscribes the same human prompt (096-09) | Never reached. The phase row carries no type or tcid, so every boot re-asks | measured 2026-10-26 | 296 replaces it with pause-and-wait (F5) |
| `-p no_run_sweeps` scratch plugin | Not in the repo | 289 | SEED-363 lands a real guard |

**Deprecated / outdated statements found during research:**
- CONTEXT `<code_context>`: *"`-p no_run_sweeps` for TestClient tests (SEED-363 until its guard lands)"*. That plugin does not exist in the repo.
- CONTEXT D-22: the expectation that 288-T-2 and 289-T-1 lower the unit baseline. They are outside `tests/unit`.
- CONTEXT `<code_context>`: *"`app.db.runs.run_is_cap_paused`… DEBT-3 must use it"*. It reads the wrong table for DEBT-3 (F6).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Moonshot rejects `$ref`/`$defs` as "recursion", and inlining them fixes the 400 | F11 | The live row stays ⛔ (suspended). If the real rule is something else (for example `anyOf` + parent `type`), the fix is incomplete and BUG-261024-01 stays open with the unit evidence |
| A2 | Third-party Moonshot rules (type on every property, `type` inside `anyOf` children, no `null` type) | F11 | Low. Apply them only behind their own test, if at all |
| A3 | A citation-check limit of 10 per minute per user, as a constant | F16, Code Examples | The operator may want it configurable, which means a migration and a Settings control |
| A4 | D-08 "examples/defaults" mean enum first option, fixed date, `"1"` for number | F13 | The operator may want an LLM-derived fill, which is capability and goes to a seed |
| A5 | 293-F-4's agent-step path silently substitutes rather than 400s | F12 | The RED re-drive decides. The fix differs (refusal vs. notice) |
| A6 | BUG-261021-03 shares -04's cause (missing terminal re-read) | F4 | If it is the race (ii), add a second, delayed phase read |
| A7 | Persist `provider` in `workflow_runs.metadata` for SEED-362 | F8 | Without it, an OpenRouter-started run may resume on the native provider |
| A8 | W3's tests do not mutate the local DB | Plan Cut | If the publish golden-run tests hit Postgres, W3 must not run alongside W2 |

## Open Questions

1. **D-04 re-rule (blocking for BUG-261021-05).** We know enforcement on `escalated` is unsatisfiable (F2). The open question is whether the operator wants (b) honest copy plus a capability seed, or (a) with escalation effectively removed. **Recommendation: (b).**
2. **D-08 scope.** `InputFieldSpec` has no examples or defaults. **Recommendation:** typed stand-ins plus a worded gauntlet note now, and seed the "extract from the test instruction" capability.
3. **293-F-4 agent-step disposition.** Decide by the RED re-drive. Fix the emit-step precedence regardless, since that one is a confirmed defect by reading.
4. **SEED-362 provider persistence** (A7). It costs one metadata merge at kickoff. **Recommendation:** include it, or the roster row can lie.
5. **BUG-261024-04.** It is measure-first. If lead (1) holds (genuine regeneration), close the defect half as "did not reproduce: files were regenerated this turn", with evidence, and send the rest to the intermediates seed.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | vitest, gates, scripts | ✓ | v24.19.0 | — |
| Python venv | backend tests | ✓ | 3.12.6 | — |
| Local Postgres :54322 | W1/W2/W5 DB tests, mig 216 apply | ✓ (TCP open) | — | — |
| Redis :6379 | limiter tests (fakes exist) | ✓ | — | `phase293_inbound_fakes.py` |
| Backend :8000 | G-4 drive, live roster | ✓ (listening) | — | — |
| Chrome MCP | G-4 (D-20) | not probed | — | operator drive |
| Moonshot account | D-21 row | ✗ (suspended per CONTEXT) | — | ⛔ row with reason |
| OpenRouter credit | D-21 row | ✗ (402 per CONTEXT) | — | ⛔ row; OPERATOR top-up |
| slopcheck | package audit | ✓ installed | — | not needed (no packages) |

**Missing, no fallback:** none blocking. **Missing, with fallback:** Moonshot and OpenRouter roster rows are recorded ⛔.

## Validation Architecture

Skipped: `workflow.nyquist_validation` is `false` in `.planning/config.json`. The test map the orchestrator asked for follows, under its own heading.

### Test Infrastructure Map

| Framework | Quick command | Full gate |
|---|---|---|
| pytest (backend, venv) | `cd backend && venv/Scripts/python.exe -m pytest <file> -q` | `node scripts/check-backend-unit-baseline.cjs` (≤ 71, under the lock) |
| vitest (frontend) | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run <file>` | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root; one per session) |
| tsc | `npx tsc -p tsconfig.app.json --noEmit` + set diff vs base | same |

| Row | Extend this test file | DB? |
|---|---|---|
| BUG-261021-02 | `tests/unit/test_268_send_path_stamp.py` (pattern); new `tests/unit/test_296_create_org_stamp.py`; `tests/integration/test_268_two_org_rows.py` pattern for a real two-org folder and draft | integration = YES |
| BUG-261020-02, 289-IN-04 | `tests/unit/test_289_run_evidence.py` | no |
| BUG-261021-05 | backend `test_185_detection.py`, `test_185_engine_attachment.py`; frontend `GovernanceSection.test.tsx`, `canvasModel.test.ts`, `teamModel.test.ts`, `WorkflowBuilderPage.canvas.test.tsx` | no |
| SEED-364 | new migration shape test (`test_294_migration_211_shape.py` style) + an integration signup row check | YES |
| SEED-365 | `tests/unit/test_293_rate_limit.py`, `tests/unit/test_294_citation_check_route.py` | no |
| 287-T01 | `tests/integration/test_214_launch_inputs_wire.py` pattern + a new unit test for `missing_required` | mixed |
| BUG-261025-03 | `tests/test_harness_resume.py`, `tests/test_200_human_gate_pause.py`, `tests/test_295_engine_ask_redrive.py` | some YES |
| DEBT-3, 289-WR-06b, 289-IN-05 | `tests/unit/test_289_redrive_failure.py`, `tests/test_295_engine_ask_redrive.py` | some YES |
| RES-a | `tests/unit/test_185_engine_attachment.py` / `test_295_*` armed tests | no |
| RES-b | `tests/unit/test_295_truthful_run_ends.py` | no |
| 295-IN-02 | `tests/test_run_reconciler.py`, `tests/unit/test_295_truthful_run_ends.py` | no |
| SEED-362 | `tests/integration/test_268_shell_org.py`, `tests/test_093_surfacing.py` (`_build_resume_context`) | integration YES |
| SEED-363 | new `tests/unit/test_296_lifespan_no_sweeps.py` | no |
| BUG-261024-04 | `tests/test_095_final_output_tag.py`, `tests/unit/test_075_4_dedup_supersedes.py` | no |
| BUG-261024-01 | `tests/unit/test_151_cross_provider_schema.py` (pattern), new `test_296_moonshot_schema.py` | no |
| 291-S6-F8 | `tests/test_dual_mode_wiring.py` | no |
| 291-S6-F7 | `tests/unit/test_291_form_inputs_overlay.py`, `test_291_pdf_fill_driver.py` | no |
| BUG-261021-04/-03 | `frontend/src/__tests__/providers/streamsProvider_295_10_follow_after_answer.test.tsx` | no |
| BUG-261025-01, 287-SCHED | WorkflowScheduleModal tests (`components/layout/ChatLayout.launch.test.tsx` mounts it) + a new modal test | no |
| BUG-261025-02, 289-F-* | `components/workflows/RunEvidenceReport.test.tsx` | no |

**Inherited reds (W5), verified this session:**
- `tests/unit/test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers`: red, **inside the gate**.
- `tests/test_182_extraction_parity.py::test_nl_gen_regression_test_count_unchanged`: red, outside the gate.
- `tests/test_200_human_gate_pause.py::test_no_twenty_fifth_audit_kind_was_added`: red, outside the gate.

## Security Domain

`security_enforcement: true`. `/gsd:secure-phase 296` is owed (D-18).

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | — |
| V3 Session | no | — |
| V4 Access Control | **yes** | `resolve_active_org_or_none` (membership checked on the caller's RLS connection); RLS on `folders` / `workflow_definitions`; D-05 non-owner withhold; parent-folder org check |
| V5 Input Validation | **yes** | canonical UUID regex (mig 215, 289-IN-04); `Content-Length` cap (293-IN-03); server required-input check (287-T01); untrusted envelope for launch answers in prompts (F14) |
| V6 Cryptography | no | — |
| V7 Errors / logging | yes | worded refusals, never raw text (295-IN-05, 295-IN-07, 293-DEL); 294-IN-01 the trace never records objects |
| V11 Business logic / anti-automation | **yes** | per-user citation-check limit, fail-closed (F16); 293-IN-01 limit before GETDEL |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Two-org user's rows land in the wrong org | Information disclosure / Tampering | stamp the validated org; header never trusted without the membership check |
| Colleague reads a withheld document's substance via a later step | Information disclosure | D-05 cascade |
| Prompt injection via launch answers in the first step's turn | Tampering | `wrap_untrusted_input` when `_untrusted_inputs` |
| Founder email in the org name to every member | Information disclosure | mig 216 neutral name (new orgs only) |
| Citation-check spend flood | DoS / cost | Redis per-user limit, fail closed |
| A test process claims and re-drives a live run | Tampering / integrity | SEED-363 guard |

## Sources

### Primary (HIGH confidence, codebase read at `a94796965`)
- `backend/app/api/folders.py`, `api/workflows.py:1182-1225`, `db/workflows.py:1028-1058`, `dependencies.py:1020-1070`, `api/threads.py:940-975`
- `supabase/migrations/106_org_id_autofill_trigger.sql`, `105_personal_org_backfill.sql`, `215_api_keys_and_run_origin.sql:120-131`; `scripts/full-schema-supplement.sql:205`
- `backend/app/services/harness/grounding.py:1178-1230,1387-1456`, `engine_ask.py:340-380,740-800,930-975,1270-1360`, `validator_kinds.py:340-440`
- `backend/app/services/run_evidence.py`, `api/workflow_run_evidence.py:300-405`
- `backend/app/services/harness_engine.py:985-1085,1890-1960,2363-2800,2873-2920`, `harness/human_input.py`, `db/workflows.py:1620-1700,2244-2300`, `api/runs.py:640-800`, `api/panel.py:165-235`
- `frontend/src/providers/StreamsProvider.tsx:1850-2030,2100-2150,3870-3965,4800-5040`, `components/panel/PendingAskCard.tsx:600-640`
- `backend/app/services/agent_loop.py:2170-2200,3285-3430`, `tools/sandbox.py:550-620,900-990`, `frontend/src/lib/api/threads.ts:150-180`
- `backend/app/services/google_service.py:250-380`, `forced_emit.py:440-530`, `provider_gateway/openai_compat.py:430-466`, `harness/phase_types.py:194-216,567-600,1515-1660,2020-2030,2105-2120`, `task_service.py:50-110,555-590`, `sub_agent_models.py:85-200`
- `backend/app/services/rate_limit.py`, `api/citation_checks.py`, `api/inbound.py:225-245,590-640`, `services/inbound_inputs.py`
- `backend/app/main.py:380-440`; `backend/app/models/harness.py:128-140,650-710`
- `node scripts/check-hot-file-ledger.cjs --files …` (run this session); `docs/HOT-FILE-LEDGER.md` scan list
- Local DB, read-only via asyncpg (asserted `127.0.0.1`): run `1e932094` phases and prompt rows; 0 escalated phases; `workflow_runs` status histogram (no `cap_paused`)
- pytest runs this session: `test_075_4` (1 failed), `test_182`/`test_200` named tests (2 failed)

### Secondary (MEDIUM)
- Moonshot/Kimi tool-calls guide: https://platform.kimi.ai/docs/guide/use-kimi-api-to-complete-tool-calls (fetched; documents no `$ref` rules)

### Tertiary (LOW, unverified)
- Third-party Moonshot schema rules surfaced by web search (CAMEL-AI docs, an unofficial agent file at download.hermesedi.duckdns.org, unreachable): type-in-`anyOf`-children, no `null` type

## Metadata

**Confidence breakdown:**
- Root causes, code-located: HIGH (F1, F2, F3, F5, F6, F7, F9, F13, F14, F15, F16, F18)
- Root causes needing a RED drive: MEDIUM (F4 -03 half, F8 provider, F12 agent path), LOW-MEDIUM (F10)
- Provider rule: LOW (F11)
- Plan cut / G-5 map: HIGH (gate run this session; ledger triples read)

**Research date:** 2026-10-26
**Valid until:** 2026-11-02. These are fast-moving hot files, so re-derive line numbers at execution.
