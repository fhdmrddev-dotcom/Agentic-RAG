# Phase 275: Retention & Legal Hold - Research

**Researched:** 2026-10-12
**Domain:** document lifecycle (retention policies, legal hold, scheduled disposition), Postgres triggers/RLS, retrieval predicates
**Confidence:** HIGH for the database and retrieval findings (measured on the local DB this session); MEDIUM for the evaluator and UI shape (designed from locked decisions and not built yet)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward from sketch 275 (operator, 2026-10-12, G-2 gate satisfied)
- **D-01:** Policy home is **Org admin → Retention**, unlocking the locked tab in `OrgAdminShell.tsx:104-109`. Sub-tabs with counts: **Policies · Legal holds · Waiting for you · History** (sketch 1B). The red count on "Waiting for you" is the only signal; no banner.
- **D-02:** Policy editor is a plain form. **Save is locked until Preview (the dry run) has run**; any edit after Preview marks it stale and re-locks Save (sketch 2B).
- **D-03:** Delete approval is **one batch per policy**: untick to keep, **type the count** to confirm. Every document is **re-checked at confirm**; a hold placed after the sweep drops that document and writes a "did not delete" receipt (sketch 3A).
- **D-04:** The Library shows retention: row chips (**On hold · Archived · Archives tonight · Delete pending · No date**, plus **Deleted at source** from D-17), a folder line naming the folder's policy/hold, and a **Retention section** in the document detail panel. Archived documents hidden by default with **"N archived hidden · Show"** and an **"Include archived"** control beside the version filter (sketch 4B).
- **D-05:** A legal hold is a **named matter** with a reason, covering documents and/or whole folders, **including anything added to those folders later**.
- **D-06:** Fail-closed states (all from the sketch, all binding): **no date → nothing happens**; **two policies that disagree on one document → nothing happens** until one changes, shown as a collision in Preview; **held → skipped by the sweep and refused by Delete**; **hold placed after the sweep → dropped at confirm**.
- **D-07:** Copy is **ported from the sketch** (`.planning/sketches/275-retention-legal-hold/index.html`), never re-typed. Visible text, never tooltip-only (OV-266-01).

#### Delete gate + SC#3 wording
- **D-08:** **No automatic delete exists anywhere.** The sweep **archives on its own**; delete-action documents are **queued** in "Waiting for you" and nothing is deleted until an org admin confirms the batch (D-03). Each confirmed delete writes one receipt. ⛔ No per-policy auto-delete toggle.
- **D-09:** **ROADMAP SC#3 is reworded** to match D-08 (original kept, struck through, in ROADMAP.md): *"A dry run reports exactly what a sweep would do before any real sweep has run. A scheduled sweep then archives exactly the archive set on its own and queues exactly the delete set; nothing is deleted until an org admin confirms the batch. Every action writes one audit record naming the document, the policy, the action, the approver (for deletes) and the time. An incomplete or ambiguous evaluation disposes nothing."*
- **D-10:** Action **review** puts the document in "Waiting for you" with **Keep / Archive / Delete** per document. Delete still goes through the type-the-count confirm.
- **D-11:** A **kept** document (unticked from a batch, or "Keep" on review) is **skipped until the policy is edited or the document changes**. Recorded as "kept by <admin>" in History. Not re-proposed nightly.
- **D-12:** A confirmed delete removes **everything**: the row, **all its versions**, chunks/tables/images (cascade), and the file bytes in storage. No soft-delete grace window. **The receipt outlives the document**: it keeps the document name, policy, action, approver and time.
- **D-13:** ⚠ Constraint derived from D-12 (scout finding): `audit_log.user_id` is `ON DELETE CASCADE` from `auth.users` (full-schema.sql:5938), so a receipt keyed only on the approver's `user_id` **disappears when that user is deleted**. Disposition receipts must not cascade away. Research decides the shape (a retention-owned receipts table, or `SET NULL` on the receipt's actor), but the property is locked.

#### Hold reach (every path)
- **D-14:** **The database refuses** deleting a held document, from **any** path: user JWT, service role, FK cascades (including `documents_user_id_fkey ON DELETE CASCADE` from `auth.users`), and future code. On top of that, **each app path checks first** so the user gets a readable reason. Accepted side effect: deleting a user who owns held documents fails until the hold is released. The six known paths that must each check and explain:
  1. `DELETE /documents/{id}` `scope=version` (`documents.py:1866`)
  2. `DELETE /documents/{id}` `scope=all` (`documents.py:1835`)
  3. folder delete (`folders.py:133-169`, recursive)
  4. watch delete with `?purge_documents=true` (`sources.py:324-334`)
  5. watch purge of missing/unauthorized items (`sources.py:466-473`)
  6. user deletion cascade (database only)

  Plus the disposition confirm itself (D-03 re-check).
- **D-15:** A **folder delete** that contains any held document (at any depth) is **refused whole**: "This folder has N documents on legal hold. Nothing was deleted." All-or-nothing.
- **D-16:** A hold **stops deletion only**. New versions, metadata edits and re-ingest still work. **The hold covers every version** of a held document, and versioning never deletes old versions (`ingest_splice.py:259-262`).
- **D-17 (hold visibility):** A member sees **"On legal hold. Ask an org admin."** with **no matter name or reason**. Org admins see the name and reason. Enforced server-side (the API does not return the matter name to members), not only hidden in the UI.

#### Archive + what "findable" means
- **D-18:** Archived documents are excluded from **every agent path**: `search_documents` (both vector and keyword arms), `query_documents`, `grep`, `read_document`, and Expert-scoped retrieval. The Library and Find **hide them by default** with "Include archived". **Open and download always work.** This closes the "archived exclusion applies to one retrieval arm only" failure. ⚠ D-272-22 accepted that grep/query_documents/read_document are not structurally locked by *filters*. This decision is different: the archived exclusion **must** reach them.
- **D-19:** **Org admins can un-archive.** The policy then skips that document until the policy or document changes (the D-11 rule). A receipt is written.
- **D-20:** A policy may have an **optional second stage**: "archive at X, then queue delete at Y". One policy, one rule, so a normal two-stage schedule never trips D-06's disagreement state.
- **D-21 (BUG-261004-01 folded):** Documents whose `source_state` is `missing_at_source`, `unauthorized_at_source` or `source_disconnected` are **excluded from agent retrieval the same way as archived**. They are still openable, and the Library shows a **"Deleted at source"** chip (wording for the other two states is ported or decided in UI-SPEC). **One home for the predicate** (the `retrieval_scope.py` seam plus the RPCs plus `expert_scope.py`), so the copies cannot drift again. One test per state asserts the chunk is or isn't returned.

#### The policy clock
- **D-22:** **Each policy picks its clock date**: "document date" (`date_typed`, generated from `metadata->>'date'`) or "date added" (`created_at`). **No fallback.** A missing chosen date means "No date — nothing will happen" (D-06).
- **D-23:** A folder policy **covers all subfolders; the nearest folder's policy wins**. This is not counted as a disagreement.
- **D-24:** A document matched by **both a folder policy and a class policy that disagree → nothing happens** (the sketch's fail-closed rule, D-06), shown as a collision in Preview. ⛔ Not "longest keep wins".
- **D-25:** **Versions age together**, by the latest version's date. All versions archive and delete together (consistent with D-12).

#### Verification (G-4, agreed at scope time)
- **D-26:** Three Chrome-driven scenarios, operator-accepted:
  1. **HOLD:** put a folder on a named hold. Deleting a document in it **and** deleting the folder are both refused with a reason, and rows show "On hold".
  2. **LIFECYCLE:**
     - Create the policy "archive after 1 day, delete after 2" on a test folder.
     - Preview lists the exact documents.
     - The sweep archives them: they are gone from chat answers, found in Find with "Include archived", and downloadable.
     - Deletes wait in "Waiting for you".
     - A hold placed before confirm drops that document with a "did not delete" receipt.
  3. **MEMBER:** a member cannot create or edit a policy (**refused by the server**, not just hidden). They see "On legal hold. Ask an org admin." with no matter name.

#### Security, migrations, deploy (from ROADMAP flags, locked)
- **D-27:** Migration(s) start at **204**. They cover the policies, holds (matters + coverage), archive state, the receipts shape from D-13, the hold-refusal rule from D-14, and new `audit_log` action types extending migration 170's CHECK.
  - `VALID_ACTION_TYPES` in `audit_service.py` must stay a subset (boot asserts it). ⚠ It is already missing the three `connector.watch.*` types (scout); sync it in the same change.
  - **RLS on every new table.** Revoke function `EXECUTE` from **`PUBLIC`**, then grant back. Run `get_advisors(security)`.
  - Apply via the SQL editor, regenerate `full-schema.sql` (no reset).
- **D-28:** Policy and hold create/edit/release, delete confirm and un-archive require **`require_org_manage`** (`dependencies.py:1072`). A policy reaches **only its own org's documents**. Cross-org must be refused and tested.
- **D-29:** **Deploy parity:** migrations go to production before the backend. **The sweep ships disabled by default** (config flag), and is not enabled in production until the operator has read a dry run.
- **D-30:** `security_enforcement` and the code review are mandatory. ⛔ Never cut (G-8).

#### G-5 hot-file audit (recorded at discuss)
- **D-31:** `backend/app/services/scheduler_service.py` **FIRES**. Honour by construction: the sweep is a **new service plus a claim function** in the watch pattern (`db/watches.py:205-254`, SKIP LOCKED + lease + `next_run_at`), started in the lifespan behind a config flag. **`scheduler_service.py` is not edited.**
- **D-32:** `backend/app/api/documents.py` **FIRES** (91/35/2518). Honour by construction: the hold check is **one shared guard function** (new module) called once per delete path, backed by the database refusal (D-14). No new branching logic lives in `documents.py`. An extraction of `documents.py` is **not** taken this phase. Re-open trigger: the next phase adding logic (not a guard call) to `documents.py`.
- **D-33:** `backend/app/services/retrieval_service.py` is **not edited**. The archived and source-state exclusions ride the `retrieval_scope.py` seam / RPC predicates (D-13 of 272).
  - `document_governance.py` (FIRES): touch only if the Retention section needs it; justify in the plan.
  - New rows are owed for `folders.py`, `sources.py`, `OrgAdminShell.tsx` and every new module. Run `node scripts/check-hot-file-ledger.cjs 275` at planning.

### Claude's Discretion
- **Where the archived/source-state exclusion is enforced for chat search:**
  - Inside the RPCs (`enforced_in_rpc=True`, a migration redefining `match_document_chunks` / `keyword_search_chunks` that keeps `SET plan_cache_mode TO 'force_custom_plan'`), **or**
  - in the Python seam (`enforced_in_rpc=False`, which routes **every** unfiltered search through the two-step resolve).
  - Research must **measure** the cost before choosing. The RPC route is the likely winner, since it costs unfiltered search nothing.
  - Either way it is data in `DEFAULT_PREDICATES`, never a new branch, and it must also reach `query_documents` / `grep` / `read_document` / Find / `expert_scope.py` (D-18).
- **Archive state shape:** column(s) on `documents`, e.g. `archived_at` plus the policy that archived it. Hold coverage as a matter table plus a coverage table (document | folder).
- **Class matching:** a class policy matches on `document_type_norm` (lower-cased, free text). The editor picks from the org's live distribution (`top_document_types`, `retrieval_scope.py:451`) rather than free typing.
- **Who may confirm a delete batch:** any `org:manage` admin, including the policy's author. Four-eyes is deferred.
- **Sweep cadence:** nightly (the sketch's "Archives tonight" chip), plus on-demand Preview. One sweep per org per night via claim + lease; multi-worker safe.
- **Folder-delete audit row:** folder delete writes no audit row today. Adding one alongside the hold check is in bounds.
- **Plan count:** G-8 target is 3-5 plans.

### Folded registers
- **SEED-250** (retention is the one absent DMS capability): folded. This phase is that seed.
- **BUG-261004-01** (search serves documents deleted/unshared at source): folded as D-21.
- **SEED-345** (per-org retention + rate limits): **partially answered**. The documents half ships here; chat/message retention and per-org rate limits stay open.

### Deferred Ideas (OUT OF SCOPE)
- **Four-eyes delete approval** (a second admin must confirm a batch the first proposed). A candidate add-on for regulated buyers (SEED-249 module).
- **Soft-delete grace window** before purge. Rejected for this phase (D-12); revisit only on customer demand.
- **Chat/message retention and per-org rate limits**: the remainder of SEED-345.
- **Watch purge endpoints never remove storage bytes** (`sources.py:324-334`, `:466-473`, scout finding). They orphan files in the bucket. File as a reported bug if not fixed in passing.
- **Artifacts hold copied rows** (`message_artifacts`, mig 202) that a document disposition would not reach (an inference from 273 I-5). Note for a future data-protection review (SEED-072).
- **Storage cleanup on user deletion** is unconfirmed (no code found). It sits with the data-protection review.

#### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md`: matched only on generic keywords (run, real, milestone). Unrelated to retention.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RET-01 | Admin can set a retention policy per document class or folder (period and action). | §Pattern 6 (policy table, unique per folder/class, period value + unit so "1 day" works for D-26), §Pattern 7 (preview token enforces D-02 on the server), RLS write wall with `current_user_has_permission(org,'org:manage')` plus `require_org_manage` (§Security). |
| RET-02 | A legal hold blocks disposition. | §Pattern 3 (one SQL predicate `retention_held_documents`, BEFORE DELETE triggers on `documents` and `folders`, sticky coverage on move, TRUNCATE guard). Cascade behaviour **measured** (auth.users → documents fires the row trigger; folders.parent_id CASCADE fires it on child folders). §Pattern 4 (one guard called at the six paths, storage removed only after the row delete succeeds). |
| RET-03 | Disposition runs on a schedule and writes an audit record. | §Pattern 5 (the pure evaluator shared by Preview, dry run, sweep and confirm), §Pattern 8 (per-org claim, SKIP LOCKED, lease, `next_run_at`, env flag off), §Pattern 9 (the `retention_receipts` table outlives users, plus `audit_log` rows for admin commands). |
| RET-04 | Archived documents drop out of default retrieval but stay findable. | §Pattern 1 (generated `documents.retrievable` column: the one home for the predicate; RPC route **measured** at no extra cost once statistics exist), §Pattern 2 (GUC-keyed restrictive policies so model-written SQL in `query_documents`/`grep` cannot see archived rows; measured), agent document-read wall, Find `include_archived`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend uses the `venv`. Backend unit gate: `pytest tests/unit -q --continue-on-collection-errors` (or `node scripts/check-backend-unit-baseline.cjs`), ceiling **71 failed**, zero headroom.
- No LangChain or LangGraph. Pydantic for structured outputs.
- **RLS on every table.** Users only see their own data, except global folders and skills.
- Migrations live in `supabase/migrations/<digits>_name.sql`, starting at **204** for this phase. Apply them by **pasting into the Supabase SQL editor** (never `db push`/`db reset`). Then run `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`.
- **The PUBLIC EXECUTE trap:** revoke from `PUBLIC` (and `anon`), then grant back `authenticated`/`service_role` as needed. Run `get_advisors(security)` as part of the deploy parity checklist.
- Blocking I/O (supabase-py) inside async handlers must be wrapped (`run_in_threadpool` / `aexec`).
- Multi-worker uvicorn (`WORKER_COUNT=2`). A singleton loop must be safe across workers, which here means a database claim, never a leader.
- Settings live in `user_settings`/`app_settings`. Env vars are for secrets and infra only. Daemon on/off flags are env by precedent: `SCHEDULER_PROCESS_ENABLED`, `WATCH_PROCESS_ENABLED`.
- **Deployment-artifact parity (same commit):** a new env var updates `backend/.env.example`, `deploy/onebox.env.example`, `docs/OPERATOR.md` and `docker-compose.prod.yml`. `scripts/check-deploy-drift.sh` enforces this.
- Supabase Realtime is a hint, never the truth.
- The Supabase MCP points at **production**. Reads are free; **every write needs explicit per-action operator approval**.
- G-2 is satisfied by sketch 275. G-4: three Chrome scenarios (D-26). G-5: hot files are honoured by construction, and the ledger gate must pass. G-8: 3-5 plans, never cutting the verifier, TDD RED, security review or migration discipline. G-6: failure criteria exist in ROADMAP.
- Worktrees: bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`). `GSD_VITEST_MAX_WORKERS=2`. **Serialize plans whose tests mutate the local DB.** Never `rm -rf` a worktree.
- Frontend typecheck: `npx tsc -p tsconfig.app.json --noEmit`, measured as a **set diff** against base (66-67 errors at base). Plain `tsc --noEmit` checks zero files.
- The local-DB lock file `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock` is taken before a backend baseline or a migration apply (memory: reference_local_db_lock_between_sessions).

## Summary

Every substrate this phase needs already ships, and three measurements on the local database settle the main design questions.

1. **The retrieval exclusion belongs in the RPCs (the `enforced_in_rpc=True` route), expressed as a stored generated column.** Use `documents.retrievable` = `archived_at IS NULL AND (source_state IS NULL OR source_state = 'live')`. On `recall_bench` (100k chunks), the RPC route costs unfiltered search nothing once statistics exist: vector arm p50 2.0-4.7 ms vs a 25 ms baseline (noisy), and the keyword arm is unchanged. **But adding a plain `archived_at` column without `ANALYZE` made the inline predicate regress the vector arm to 943 ms per call.** The planner dropped HNSW for a sequential scan plus a sort of 93,139 rows. So the migration must `ANALYZE public.documents`, and the generated column was the more robust shape (4.3 ms with no statistics at all). The Python-seam route would add a PostgREST paging walk and an RLS re-read whose cost grows with the org's document count on every unfiltered search, so it is rejected.
2. **`query_documents` and `grep` run model-written SQL** through the INVOKER `query_user_documents` RPC, which only those two agent paths call. A SQL rewrite cannot exclude archived rows safely there. The robust home is **restrictive RLS policies keyed on a transaction-local GUC** that `query_user_documents` sets itself. Measured: about 10% overhead on Library reads with the GUC off, and the right rows hidden with it on (287 of 2,793 documents, 7,175 of 69,805 chunks).
3. **The database can refuse deletes on every path.** Measured in a rolled-back transaction: deleting an `auth.users` row fires a `documents` BEFORE DELETE row trigger through the FK cascade (depth 2). `folders.parent_id ON DELETE CASCADE` fires BEFORE DELETE on child folder rows. `documents.folder_id ON DELETE SET NULL` fires BEFORE **UPDATE** on documents, not DELETE. So the design is BEFORE DELETE triggers on `documents` and `folders`, a BEFORE TRUNCATE guard (`authenticated` and `service_role` both hold TRUNCATE today), and sticky coverage when a held item moves out of a held folder.

One ordering defect applies to every app delete path. **Storage bytes are removed before the row delete** (`documents.py:1853/1867`, `folders.py:158-166`). If the database refuses the row (hold), the bytes are already gone. Every path must call the guard first, delete rows second and remove bytes last.

**Primary recommendation:** Build the database first: migration 204 (retention schema, holds, triggers, receipts, audit CHECK) and migration 205 (the `retrievable` column, RPCs and GUC policies), with live-DB integration tests. Then run the backend seams and the retention engine in parallel. Then the UI. Then the merged-tree gates and the G-4 drives. Five plans.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hold refusal (every delete path, including cascades) | Database (triggers + SQL predicate) | API (guard explains the refusal) | D-14: future code and FK cascades never pass through Python. |
| Retrieval exclusion (archived + source state) | Database (generated column, RPC predicates, restrictive GUC policies) | API (Python constant + agent document-read wall) | Model-written SQL and both RPC arms run in Postgres. One definition lives in the column DDL. |
| Policy evaluation (due, collision, no date, kept) | API (pure Python function) | Database (inputs) | Testable with TDD, and shared by Preview, dry run, sweep, confirm and Library chips. |
| Scheduling / claim | Database (SKIP LOCKED claim on `retention_sweeps`) | API (lifespan service) | Multi-worker safe without a leader (the watch/scheduler precedent). |
| Disposition (delete batch confirm) | API (service role, explicit org predicate) | Database (trigger backstop, receipts in the same transaction) | The admin may not own the documents. RLS DELETE is owner-only. |
| Receipts / history | Database (`retention_receipts`, actor `SET NULL` + name snapshot) | API | D-13: a receipt must outlive the user. |
| Hold visibility for members | API (boolean only) | Database (RLS: holds readable by `org:manage` only) | D-17 is server-side. |
| Retention tab, Library chips, panel section | Browser | API (`/retention/*`) | UI only renders server truth. |
| "Include archived" in Find | API (`document_search_service`) | Browser (control) | Find is server-filtered. The Library list hides archived rows client-side. |

## Standard Stack

No new packages. Everything is already installed. [VERIFIED: local venv / package.json inspection]

### Core (existing)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 17.6 (local) | triggers, generated columns, RLS, SKIP LOCKED | [VERIFIED: `select version()` on :54322]. PG17 supports `ALTER TABLE … ALTER COLUMN … SET EXPRESSION` if the predicate ever changes [CITED: postgresql.org docs, ALTER TABLE]. |
| asyncpg | 0.31.0 | claim, sweep and confirm transactions; integration tests | [VERIFIED: venv] |
| supabase-py (PostgREST) | existing | user-JWT reads/writes, storage remove | project standard |
| FastAPI + Pydantic v2 | existing | `/retention` router, request models (`extra="forbid"`) | project standard |
| pytest 9.0.2 + pytest-asyncio 1.3.0 | existing | unit + live integration | [VERIFIED: venv] |
| React + Vite + Tailwind + shadcn/ui, vitest | existing | Retention tab, chips, panel section | project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| stdlib `calendar` / `datetime` | — | `add_period(date, value, unit)` with month-end clamp | Use this in the pure evaluator. `python-dateutil` 2.9.0 is installed only transitively (via croniter/pandas), so do not add a direct dependency for one helper. |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck was not run because there is nothing to audit.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — | — | — | — | — | — | No installs |

**Packages removed:** none. **Packages flagged:** none.

## Measurements (taken this session; every DDL/DML rolled back)

### M-1: RPC predicate cost (Claude's Discretion question 1)

Setup: `recall_bench` DB (3,850 docs / 100,000 chunks), caller `7fcfb80e…` (2,653 latest docs). Migration 200 bodies plus the 201 pin are in place. There were 12 sequential calls on **one session** (the 272 plan-cache method), each in a savepoint under `SET LOCAL ROLE authenticated` with both claim GUCs. The figure is p50 of calls 2-12. Scripts: scratchpad `measure.py`, `measure2.py` (patterned on `.planning/phases/272-close-means-wrong/evidence/plancache_diag_vector.py`). [VERIFIED: measured]

| Scenario | Vector p50 (max) | Vector rows | Keyword p50 (max) |
|---|---|---|---|
| A baseline (mig 200 + pin) | 25.3 ms (46.6) | 20 | 212 ms (286) |
| **B** + `archived_at` column, inline predicate, **no ANALYZE** | **942.8 ms (964)** ⛔ | 20 | 124 ms |
| B2 inline predicate **+ ANALYZE** | 4.7 ms (13.4) | 20 | 126 ms |
| C generated `retrievable`, `AND d.retrievable`, no ANALYZE | 4.3 ms (10.9) | 20 | 114 ms |
| C2 generated + ANALYZE | 2.0 ms (2.2) | 20 | 129 ms |
| D generated, 10% of caller docs archived, ANALYZE | 2.2 ms | 19-20 | 108 ms |
| E generated, **50% archived**, ANALYZE | 2.3 ms | **9-20** ⚠ | 75 ms |
| F Python-seam route (index branch, `p_document_ids` = all 2,653 docs) | 6.3 ms | 20 | 118 ms |
| S seam step 2 alone (RLS intersect of 2,653 ids) | 6.2 ms | — | — |

EXPLAIN of the body statement (B), without statistics vs with: `Seq Scan documents → Nested Loop → Bitmap Index Scan idx_document_chunks_document_id (3,657 loops) → top-N sort of 93,139 rows`, **415 ms**. With statistics: `Index Scan document_chunks_embedding_idx → Index Scan documents_pkey`, **0.65 ms**.

What the numbers show:
- The RPC route costs unfiltered search nothing, **provided statistics exist**. A new nullable column has no statistics, and Postgres's default selectivity for `IS NULL` on it made the planner abandon HNSW. ⛔ The migration must run `ANALYZE public.documents` after adding the columns (ANALYZE is allowed inside a transaction block). The generated boolean column was robust even without statistics. It is also the one home for the predicate, so it is the recommendation.
- The Python-seam route (F + S) adds a step-1 PostgREST walk of every org document id (pages of 1,000) plus the step-2 re-read to **every** search. That cost grows linearly with the org's document count. Rejected.
- E is a property of HNSW post-filtering, not of this design: at `hnsw.ef_search=40` with no iterative scan, a heavily archived corpus under-fills top-k. The same thing already happens for `is_latest = false` rows and visibility filters. Mitigation exists (`hnsw_iterative_scan` in user settings, Phase 241). Record it as a pitfall; do not fix it here.

### M-2: GUC-keyed restrictive policies (agent SQL paths)

Same DB, caller as `authenticated`, 6 calls each. Script: scratchpad `restrictive.py`. [VERIFIED: measured]

| Query | no policy | policy, GUC off (Library) | policy, GUC on (agent) |
|---|---|---|---|
| `count(*) documents` | 3.0 ms → 2,793 | 3.3 ms → 2,793 | 3.3 ms → **2,506** |
| `count(*) document_chunks` | 58.3 ms → 69,805 | 63.7 ms → 69,805 | 414 ms → **62,630** |
| chunk `ILIKE … LIMIT 20` | 0.6 ms | 0.7 ms | 1.0 ms |

The policy adds about 9% on a full chunk count for Library reads and hides exactly the archived rows for agent SQL. The 414 ms full count is the per-row helper. That cost falls only on model-written SQL, which is rare and already slow.

### M-3: Do FK cascades fire row triggers? (question 3)

Local `postgres` DB, one transaction, rolled back. Script: scratchpad `trig.py`. [VERIFIED: measured]

| # | Statement | Result |
|---|---|---|
| 1 | `DELETE FROM auth.users WHERE id = <owner>` with a raising BEFORE DELETE trigger on `documents` | **REFUSED**: the trigger fired at `pg_trigger_depth()=2` through `documents_user_id_fkey ON DELETE CASCADE` |
| 2 | `DELETE FROM folders WHERE id = <folder with docs>` (documents trigger only) | OK: no DELETE trigger fires on documents, because `documents_folder_id_fkey` is `ON DELETE SET NULL` |
| 3 | same, with a BEFORE UPDATE trigger on documents | OK, and the UPDATE trigger **fired** once per document (`folder_id → NULL`) |
| 4 | `DELETE FROM folders WHERE id = <parent>` with a raising BEFORE DELETE trigger on `folders` | REFUSED on the parent row (depth 1) |
| 5 | same trigger restricted to `pg_trigger_depth() > 0` | REFUSED on the **child** folder row (depth 2): `folders_parent_id_fkey ON DELETE CASCADE` fires the child's row trigger |
| — | `has_table_privilege(…, 'public.documents', 'TRUNCATE')` | **true** for both `authenticated` and `service_role`. TRUNCATE bypasses row triggers. |

Also confirmed: `service_role` and `postgres` are `BYPASSRLS`, `authenticated` is not. Row triggers fire regardless of RLS bypass.

### M-4: Local data facts
- The local dev DB already has **2 documents with `source_state='missing_at_source'`**, and today's RPCs serve them (BUG-261004-01 reproduces locally). These make good live fixtures. [VERIFIED: probe]
- `documents.source_state` CHECK allows `NULL, 'live', 'missing_at_source', 'unauthorized_at_source', 'source_disconnected'` (full-schema.sql:1625). [VERIFIED]
- `documents` has no `updated_at` trigger (only `documents_autofill_org_id`, full-schema.sql:5580), so `updated_at` cannot detect a change. [VERIFIED]

## Architecture Patterns

### System Architecture Diagram

```
                ┌───────────────────────── Org admin (org:manage) ─────────────────────────┐
 Browser        │ Retention tab: Policies · Legal holds · Waiting for you · History         │
                │   form ──Preview──► dry run ──token──► Save      batch ──type N──► Confirm  │
                └──────────────┬──────────────────────────────┬───────────────────────────┘
                               │ /retention/*                  │ Library: chips, folder line,
                               ▼                               │ Retention section, Include archived
 API          ┌──────────────────────────────┐  ┌─────────────▼──────────────┐
              │ retention router             │  │ document-states (batched)   │──member? → no matter names
              │ require_org_manage on writes │  └─────────────┬──────────────┘
              └───┬───────────┬──────────┬───┘                │
                  │           │          │                     ▼
                  │   ┌───────▼──────┐   │        ┌────────────────────────┐
                  │   │ load (fail-  │──►│──────► │ evaluate()  PURE        │ ◄── same fn for Preview,
                  │   │ closed reads)│   │        │ held/collision/no-date/ │     dry run, sweep, confirm
                  │   └──────────────┘   │        │ kept/not-due/archive/   │
                  │                      │        │ queue-delete/review     │
                  │   Sweep service ─────┘        └───────────┬────────────┘
                  │   (lifespan, RETENTION_SWEEP_ENABLED)     │ incomplete → dispose NOTHING
                  │   claim_due_retention_sweeps (SKIP LOCKED, lease, next_run_at)
                  ▼                                            ▼
              Confirm: per family TX ─ lock ─ retention_held_documents() ─ DELETE rows ─ receipt ─ COMMIT ─► storage.remove
                                                   │
 Database     ┌────────────────────────────────────▼──────────────────────────────────────────┐
              │ documents  (archived_at, archived_policy_id, retrievable GENERATED)            │
              │   BEFORE DELETE  → refuse if held (any path: JWT, service role, auth.users cascade)│
              │   BEFORE UPDATE OF folder_id → sticky hold coverage on move-out                │
              │   BEFORE UPDATE OF archived_at… → refuse for role authenticated               │
              │   BEFORE TRUNCATE → refuse while any active hold exists                       │
              │ folders    BEFORE DELETE (fires per cascaded child) / BEFORE UPDATE OF parent_id │
              │ retention_policies · legal_holds · legal_hold_documents · legal_hold_folders   │
              │ retention_queue · retention_skips · retention_receipts · retention_sweeps      │
              │ match_document_chunks / keyword_search_chunks: AND d.retrievable (pin kept)    │
              │ query_user_documents: set_config('app.agent_read','on',true) → RESTRICTIVE     │
              │   policies on documents/document_chunks/document_tables/document_images        │
              └───────────────────────────────────────────────────────────────────────────────┘
 Agent tools: search_documents (RPC) · query_documents/grep (GUC policies) · read_document/
              analyze_document/fetch_document_file/query_tables (Python wall on `retrievable`)
```

### Recommended Project Structure

```
supabase/migrations/
├── 204_retention_and_legal_hold.sql      # tables, archive columns, hold predicate fn, triggers, RLS, audit CHECK, ANALYZE
└── 205_retrievable_predicate.sql         # generated column, RPC redefinitions (pin kept), query_user_documents GUC, restrictive policies
backend/app/services/retention/
├── __init__.py
├── evaluate.py        # PURE: dataclasses in, Decision out. No I/O. (TDD core)
├── periods.py         # add_period(date, value, unit) with month-end clamp (pure)
├── load.py            # fail-closed loaders: _fetch_all-style paging, IncompleteEvaluation
├── hold_guard.py      # assert_none_held(ids, *, can_manage) → HoldRefusal(count, …); wraps the SQL fn
├── agent_wall.py      # unretrievable(supabase, ids) → set; the agent document-read refusal text
├── disposition.py     # confirm_batch / keep / review decide / unarchive (asyncpg TX per family)
└── sweep_service.py   # RetentionSweepService(start/stop/poll) — NOT scheduler_service.py
backend/app/db/retention.py               # claim_due_retention_sweeps / release (watch pattern)
backend/app/models/retention.py           # Pydantic request/response models (extra="forbid" on requests)
backend/app/api/retention.py              # /retention router
frontend/src/components/retention/        # OrgRetentionTab + sub-tabs, PolicyForm, HoldForm, DeleteBatch,
                                          # HistoryTab, RetentionSection, RetentionRowChips, retentionCopy.ts
frontend/src/lib/api/retention.ts
backend/tests/unit/test_275_*.py · backend/tests/integration/test_275_*.py
```

### Pattern 1: One home for the retrieval predicate is a generated column

**What:** add `documents.retrievable boolean GENERATED ALWAYS AS (archived_at IS NULL AND (source_state IS NULL OR source_state = 'live')) STORED`. Every consumer names the column and never restates the rule.
- **Positive form** (`= 'live'`), so any future `source_state` value is excluded by default. That is the fail-closed direction.
- `documents` already carries two generated columns (`document_type_norm`, `date_typed`, full-schema.sql:1612-1613). So no code that inserts or copies rows can be writing generated columns today. [VERIFIED]

**Consumers to switch from the hardcoded `source_disconnected` clause** (all measured, see Q2):

| Site | Today | After |
|---|---|---|
| `match_document_chunks` exact + index branches (mig 200:168, :191) | `AND (d.source_state IS NULL OR d.source_state != 'source_disconnected')` | `AND d.retrievable` |
| `keyword_search_chunks` (mig 200:238) | same | `AND d.retrievable` |
| `retrieval_scope._builder` step 1 (:323-325) | `.or_("source_state.is.null,source_state.neq.source_disconnected")` | `.eq("retrievable", True)` |
| `retrieval_scope._STORED_SPELLINGS_SQL` / `_TOP_TYPES_SQL` (:149-160) | inline clause | `WHERE is_latest AND retrievable …` |
| `retrieval_scope.DEFAULT_PREDICATES` (:72-83) | `RetrievalPredicate("not_source_disconnected", None, True)` | `RetrievalPredicate("retrievable", None, True)`: still `enforced_in_rpc=True`, so `requires_resolved_scope` stays False for unfiltered search (no branch added) |
| `expert_scope._count_kb_documents` (:162, :186) | `.or_(_NOT_SOURCE_DISCONNECTED)` | `.eq("retrievable", True)` |

Python keeps one constant: `RETRIEVABLE_COLUMN = "retrievable"` in `retrieval_scope.py`. `expert_scope.py` and `agent_wall.py` import it.

### Pattern 2: GUC-keyed RESTRICTIVE policies for model-written SQL

**What:** `query_user_documents` (INVOKER, SELECT-only; only `kb.grep_path:275` and `sql_service.query_documents:105` call it [VERIFIED: grep]) sets `PERFORM set_config('app.agent_read', 'on', true);` before its `EXECUTE`. RESTRICTIVE SELECT policies for `authenticated` on `documents`, `document_chunks`, `document_tables` and `document_images` then hide non-retrievable rows only while that GUC is on.
- No SQL rewriting, and no Python change in `grep_path` or `query_documents`.
- `is_local=true` scopes the GUC to the `get_user_pg_connection` transaction.
- SECURITY DEFINER RPCs (owner `postgres`, BYPASSRLS) are unaffected and carry `d.retrievable` themselves.
- The condition must be `IS DISTINCT FROM 'on'`: after a session has set the placeholder once, `current_setting(…, true)` returns `''`, not NULL.

**Why not a regex rewrite:** the model can query `document_chunks` directly (`SELECT content FROM document_chunks WHERE content ILIKE …`), which leaks archived content without ever naming `documents`.

### Pattern 3: Hold refusal in the database

**Tables** (migration 204):
- `legal_holds(id, org_id, name, reason, created_by → auth.users ON DELETE SET NULL, created_by_name, created_at, released_at, released_by SET NULL, released_by_name, release_note)`. Holds are **released, never deleted**.
- `legal_hold_documents(hold_id → legal_holds CASCADE, document_id → documents CASCADE, added_by SET NULL, added_at, PRIMARY KEY(hold_id, document_id))`.
- `legal_hold_folders(hold_id, folder_id → folders CASCADE, …)`.
- Both coverage CASCADEs can only fire after a release. While a hold is active, the triggers refuse the parent delete.

**One predicate, `SECURITY DEFINER STABLE`:** `public.retention_held_documents(p_document_ids uuid[]) RETURNS TABLE(document_id uuid, hold_id uuid, held_since timestamptz)`. A document is held when an **active** hold (`released_at IS NULL`) of the **same org** covers it by either route:
- (a) directly: any member of its **version family** is in `legal_hold_documents`. Family key = `(org_id, user_id, filename)`, the widest key the codebase uses, so coverage errs toward holding (D-16).
- (b) by folder: the document's folder, or any ancestor (recursive `parent_id` walk, cycle-bounded), is in `legal_hold_folders`. That covers "anything added later", because coverage is evaluated at check time and never materialised.

The trigger and the Python guard both call this function: one rule, two callers.
- **Fast path:** `IF NOT EXISTS (SELECT 1 FROM public.legal_holds WHERE org_id = OLD.org_id AND released_at IS NULL) THEN RETURN OLD;`, so orgs with no holds pay one index probe per deleted row.
- Grants: `EXECUTE` revoked from `PUBLIC` and `anon`, granted to `service_role` only. The trigger function is DEFINER and reads the function as owner.

**Triggers:**
1. `documents` **BEFORE DELETE FOR EACH ROW**: refuse when held, with `RAISE EXCEPTION … USING ERRCODE = 'PT409'`. PostgREST maps `PTxyz` to HTTP xyz [CITED: docs.postgrest.org/en/latest/references/errors.html]. ⛔ The message never contains the matter name: `'document % is on legal hold'`.
2. `folders` **BEFORE DELETE FOR EACH ROW**: refuse when the folder is covered (itself or an ancestor) or contains a held document. Measured: this fires on every cascaded child folder (M-3 #5), so checking "documents directly in this folder" per row covers the whole subtree. It also stops the `SET NULL` that would strip other owners' held documents out of a held folder.
3. `documents` **BEFORE UPDATE OF folder_id** and `folders` **BEFORE UPDATE OF parent_id**: **sticky coverage**. When a covered document or folder moves outside the subtree of the folder hold that covers it, insert a direct coverage row for each covering hold, so the move never loses the hold. This keeps D-16 ("stops deletion only") true: moves work, coverage follows. The fallback, if the planner prefers less trigger logic, is to refuse the move; that is still fail-closed.
4. `documents` **BEFORE TRUNCATE FOR EACH STATEMENT** (and the same on `folders`): refuse while any active hold exists. Also `REVOKE TRUNCATE ON public.documents, public.folders FROM authenticated, anon` (hygiene; measured that `authenticated` holds it).
5. `documents` **BEFORE UPDATE OF archived_at, archived_policy_id**: refuse when `current_user IN ('authenticated','anon')`. The owner UPDATE RLS policy (full-schema.sql:7273) would otherwise let any owner un-archive their own document through PostgREST. D-19 says only admins can, and only through the API (service role).

### Pattern 4: One guard, six paths. Rows before bytes.

`hold_guard.assert_none_held(document_ids, *, can_manage: bool)` raises `HoldRefusal` with the held count and (only when `can_manage`) the matter names. Every app path calls it once, **before any storage removal**, and maps it to HTTP 409 with the D-15/D-17 text. The DB trigger backstops a race; catch `PT409` (PostgREST `APIError.code` / asyncpg `sqlstate`) and map it to the same 409.

| # | Path (verified file:line) | How it deletes today | Change |
|---|---|---|---|
| 1 | `documents.py:1863-1871` scope=version | user JWT. **storage.remove at :1867, then row delete at :1871** | guard → row delete → storage.remove |
| 2 | `documents.py:1835-1861` scope=all | user JWT. **storage loop :1850-1855, then delete :1861** | guard(sibling ids) → delete → storage loop |
| 3 | `folders.py:132-169` | user JWT. BFS of subfolders; **storage loop :158-162, then docs delete :166**, then folder delete :169 (DB cascade for descendants) | guard(all doc ids in subtree, plus covered-folder check) → refuse whole (D-15) → docs delete → folder delete → storage; add a `folder.delete` audit row (discretion) |
| 4 | `sources.py:323-334` watch delete `purge_documents=true` | user JWT `.delete().in_("id", doc_ids)`; an exception is **swallowed** (`logger.warning`) and the watch is still deleted | guard → refuse whole with 409 before deleting the watch; never swallow PT409 |
| 5 | `sources.py:464-475` purge missing/unauthorized | user JWT; an exception is swallowed, yet `purged_count = len(doc_ids)` is reported and the watch items are deleted anyway | guard → refuse whole (consistent with D-15); report truthfully |
| 6 | user deletion (`auth.users`) | FK cascade | DB trigger only (measured fires) |
| + | disposition confirm | service role (new) | guard inside the per-family TX + trigger backstop |

D-32: `documents.py` gets guard calls and a **reorder** of existing statements, with no new branch. The guard function owns the decision. Paths 4 and 5 also never remove storage bytes (deferred bug). Leave that alone, but do not make it worse.

### Pattern 5: The evaluator is a pure function

`evaluate(family: FamilyFacts, ctx: EvalContext, now: datetime) -> Decision`, with no I/O. Preview, the org dry run, the sweep, the confirm re-check and the Library chips all call it.

Inputs:
- `FamilyFacts`: latest row id, every family row id + file_path, org_id, folder_id, `document_type_norm`, `date_typed`, `created_at`, `archived_at`, whether it is org-visible, a fingerprint.
- `EvalContext`: folder parent map, folder policies by folder, class policies by type, held family ids, skip markers, pending queue keys.

Decision order (first match wins):
1. Not org-visible → `NOT_COVERED(private)`. See Open Question 1.
2. Held → `SKIP(held)` (D-06: the sweep skips held documents entirely).
3. `folder_p` = the nearest ancestor-or-self of `latest.folder_id` with a folder policy (D-23). `class_p` = the class policy for `document_type_norm`.
4. Neither applies → `NONE(no_policy)`.
5. Both apply and `rule(folder_p) != rule(class_p)` → `UNDECIDABLE(collision)` (D-24). Here `rule` = (clock, stage1, stage1 action, stage2, stage2 action). Equal rules agree.
6. `p.revision != p.previewed_revision` → `SKIP(not_previewed)` (defence for D-02 / SC#3).
7. Clock date: `latest.date_typed` when `p.clock = 'document_date'`, else `latest.created_at` (UTC date). None → `UNDECIDABLE(no_date)` (D-22: no fallback).
8. A skip marker for `(family, p.id)` whose `(policy_revision, fingerprint)` equals the current pair → `SKIP(kept | unarchived)` (D-11/D-19).
9. `due1 = add_period(clock, p.stage1)`, `due2 = add_period(clock, p.stage2)` when set (D-20).
   - Stage 2 is set and `now ≥ due2` → `ARCHIVE` (if not archived) **and** `QUEUE_DELETE`.
   - Otherwise `now ≥ due1` → the stage-1 action: archive → `ARCHIVE` (or `ALREADY_ARCHIVED`); delete → `QUEUE_DELETE`; review → `QUEUE_REVIEW`.
   - Otherwise `NOT_DUE(next_due)`.
10. A pending queue item already exists → `PENDING` (idempotent sweep).

- **Fingerprint** = `(latest_id, clock_date, folder_id, document_type_norm)`. It detects "the document changed" without `updated_at`, which has no trigger (M-4). A new version, a moved file, or a metadata edit changing the date or type each re-opens the decision.
- **Incomplete evaluation:** the loader raises `IncompleteEvaluation` for any of:
  - a page fetch that fails,
  - an exact-count mismatch (copy `document_search_service._fetch_all`'s `SearchTruncatedError` discipline, :232-253),
  - a folder parent outside the loaded org set,
  - a cycle,
  - a policy whose folder is missing.

  The sweep then disposes **nothing** for that org and records `last_status='incomplete'` with the reason. Per-document ambiguity (no date, collision) affects only that document.
- **Versions (D-25):** evaluate the family by its latest row. Archive and delete apply to every row of the family. The disposition family uses the **existing delete key** `(user_id, filename, folder_id)` from `documents.py:1837-1846`, not the hold's wider key. A hold errs toward holding more; a delete must never reach a same-named file in another folder.

### Pattern 6: Policy shape

`retention_policies(id, org_id, name, scope_kind CHECK IN ('folder','class'), folder_id → folders ON DELETE CASCADE, document_type_norm text, clock CHECK IN ('document_date','date_added'), stage1_value int > 0, stage1_unit CHECK IN ('days','months','years'), stage1_action CHECK IN ('archive','delete','review'), stage2_value, stage2_unit, stage2_action CHECK IN ('delete'), revision int, previewed_revision int, created_by/updated_by SET NULL + name snapshots, timestamps)`.

- CHECK: stage 2 only when `stage1_action = 'archive'`.
- Partial unique indexes: one policy per `(org_id, folder_id)` and one per `(org_id, document_type_norm)`. A same-scope disagreement then cannot exist, and only folder-vs-class collisions remain (D-24).
- **Days** are required: D-26 drives "archive after 1 day, delete after 2". The sketch's years-only control is not enough.
- A folder policy's folder must be **org-shared**, and both it and a hold's folder must be in the same org. Enforce with RLS `WITH CHECK` plus a validation test.

### Pattern 7: Preview gates Save on the server (D-02)

`POST /retention/policies/preview` evaluates the submitted draft. It returns the per-document lists and a `preview_token` = HMAC(server secret, canonical JSON of the draft + org_id + issued_at). `POST/PUT /retention/policies` requires a token whose draft hash equals the submitted body and is ≤ 30 min old. Otherwise it returns 409 "Preview again before saving". Saving sets `previewed_revision = revision`. The UI's stale/re-lock (sketch 2B) is the friendly half; the server is the wall.

### Pattern 8: Sweep claim (watch pattern, `scheduler_service.py` untouched)

`retention_sweeps(org_id PK, next_run_at, leased_until, last_run_at, last_status, last_error, last_counts jsonb)`.
- `claim_due_retention_sweeps(pool, *, limit, lease_seconds)` is a copy of `db/watches.py:203-254`'s shape: `FOR UPDATE SKIP LOCKED`, advance `next_run_at` to the next 02:00 UTC **inside** the claim transaction, set the lease.
- Rows are seeded by policy create (`INSERT … ON CONFLICT DO NOTHING`).
- `RetentionSweepService` starts in the lifespan after the watch block (`main.py:581-602`) behind `settings.retention_sweep_enabled` (default **False**), parked on `app.state` and stopped in shutdown (`main.py:~671` pattern).
- Per org: load → evaluate → one asyncpg transaction that sets `archived_at`/`archived_policy_id` on every family row (`WHERE … AND archived_at IS NULL AND org_id = $org`), inserts queue rows `ON CONFLICT DO NOTHING`, and writes receipts. Then release.
- `POST /retention/sweep/run` (org:manage) claims the caller's org now. It is refused 409 when the flag is off. G-4 LIFECYCLE needs it, and it can never delete.
- **Env vs app_settings:** env, because it is a daemon on/off flag exactly like `WATCH_PROCESS_ENABLED` and `SCHEDULER_PROCESS_ENABLED` (config.py:1412, :1353-1360). D-29 says the operator flips it after reading a dry run. Ship **one** var, `RETENTION_SWEEP_ENABLED`. Keep the poll interval, lease and 02:00 hour as code constants: the 272 precedent ("a value that ships in code needs no Coolify twin to drift from", `retrieval_rpc.py:39-41`). Parity: `backend/.env.example`, `deploy/onebox.env.example` (beside `WATCH_PROCESS_ENABLED=false`, :274), `docs/OPERATOR.md` (beside :167), and `docker-compose.prod.yml` (beside :107), all in the same commit.

### Pattern 9: Receipts table plus audit_log for admin commands (D-13)

`retention_receipts(id, org_id, action CHECK IN ('archived','unarchived','queued_delete','queued_review','kept','deleted','did_not_delete','hold_placed','hold_released','policy_saved','policy_deleted','sweep_incomplete'), document_id uuid NULL (no FK, so it outlives the row), document_name text NOT NULL, policy_id → retention_policies ON DELETE SET NULL, policy_name text, hold_id SET NULL, hold_name text, actor_id → auth.users ON DELETE SET NULL, actor_name text, detail jsonb, created_at)`.
- The sweep writes `actor_id NULL, actor_name 'Nightly sweep'`.
- RLS: SELECT for `org:manage` only, because rows carry matter names. No INSERT/UPDATE/DELETE policy for `authenticated`; the backend writes with the service role.
- This is the SC#3 record ("one audit record per action naming the document, the policy, the action, the approver and the time").

`audit_log` also gets the **admin-command** types, extending the CHECK (latest rebuild: migration 170) and `VALID_ACTION_TYPES` in lockstep: `retention.policy.create/update/delete`, `retention.hold.create/update/release`, `retention.disposition.confirm`, `retention.document.unarchive`, `retention.document.keep`, `folder.delete`. Add the three missing `connector.watch.create/delete/sync` to `VALID_ACTION_TYPES` too. Verified: the CHECK has them and the frozenset does not (audit_service.py:13-28 vs full-schema.sql:923). `audit_log.user_id` is NOT NULL with CASCADE, so audit_log suits human commands only. System sweep actions live in receipts.

### Anti-Patterns to Avoid
- **`enforced_in_rpc=False` for the archive predicate.** Every unfiltered search would pay an O(org docs) resolve (M-1 F/S). Rejected.
- **Restating the predicate in a new file.** Name `retrievable` instead. BUG-261004-01 happened because three copies drifted.
- **Removing storage bytes before the row delete succeeds.** That is today's order on all three user paths.
- **`try/except: pass` around a delete that can raise PT409.** `sources.py:332-334` and `:473-474` do this today.
- **Putting the matter name in a trigger message or a member payload.** It is a D-17 leak.
- **Materialising folder-hold coverage at hold time.** It misses "added later" (D-05). Evaluate it at check time.
- **Editing `scheduler_service.py` or `retrieval_service.py`.** D-31 and D-33 forbid it.
- **A Library list endpoint branch in `documents.py` for "include archived".** `list_documents` already selects `*`. Hide archived rows client-side with "N archived hidden · Show".

## Questions Answered (orchestrator Q1-Q10)

**Q1. RPC vs Python seam.** RPC route via a generated `retrievable` column (M-1). Keep `SET search_path TO ''` and `SET plan_cache_mode TO 'force_custom_plan'` in **both** `CREATE OR REPLACE` headers. `test_272_review_fixes.py:619-638` scans every migration ≥ 200 and fails without them. Use the same signatures, so there is no overload and the ACL is preserved; still re-assert REVOKE PUBLIC/anon and GRANT authenticated/service_role. Run `ANALYZE public.documents` after the column add. `DEFAULT_PREDICATES` keeps three entries, all `enforced_in_rpc=True`, with `not_source_disconnected` renamed `retrievable`. That is a deliberate fence update in `test_272_scope_seam.py:33-34` (SEED-177: retire on purpose).

**Q2. Every agent retrieval consumer, where the exclusion lands, and whether a seam reaches it.**

| Consumer | Lands at | Seam? |
|---|---|---|
| `search_documents` vector + keyword, unfiltered and filtered | RPC bodies (mig 205) | yes, RPC |
| filtered step 1 + counts | `retrieval_scope.py:323-325`, `:149-160` | yes, the seam |
| Expert-scoped retrieval | rides `folder_subtree_ids` into the same RPCs; the count statement is at `expert_scope.py:162,186` | yes |
| `query_documents` | `sql_service.py:105` → `query_user_documents` | yes, GUC policies (no Python change) |
| `grep` | `kb.py:275` → `query_user_documents` | yes, GUC policies |
| `read_document` | `tool_dispatcher.py:355-368` → `kb.read_path` (shared with the Library `GET /documents/{id}/content`, documents.py:989/1026, which must keep working) | **no**. Add an agent wall call in the handler, beside `_doc_out_of_scope` |
| `analyze_document` | `tool_dispatcher.py:1073-1080` → `retrieval_documents.resolve_document_id` / `fetch_full_document` (agent-only, verified by grep) | add `.eq(RETRIEVABLE_COLUMN, True)` in `retrieval_documents.py:76-196`, or an agent wall call. Either way, retire the AST pins in `test_272_pure_move.py` `RETIRED` with a reason |
| `query_tables` | `multimodal_service.py:1020` → `retrieval_documents.resolve_document` | same edit covers it |
| `fetch_document_file` / `attach_skill_file` | `tool_dispatcher._fetch_owned_document_bytes:374-476` | add an agent wall call (one line, next to the folder wall at :397) |
| `ls` / `tree` / `glob` / `query_documents_by_view` / `get_related_documents` | list **names and metadata**, not content | recommended: filter `ls`/`tree`/`glob` in `kb.py` (agent-only in practice; `/kb/*` has no frontend caller, verified). Leave the view resolver (shared with the Library) as a recorded limit. |
| Find | `document_search_service._candidates.structure` (:438-446) | one `_apply_archived(q, req.include_archived)` line; `include_archived: bool = False` on `DocumentSearchRequest` (`extra="forbid"`, so the frontend must send it only after the backend ships) |

**The one home:** the SQL column definition. Python's home is the `RETRIEVABLE_COLUMN` constant plus `agent_wall.unretrievable()`. The dispatcher change is one import, a refusal helper, and three call lines. It is honoured by construction (tool_dispatcher FIRES 97/42/5057).

**Q3. Hold refusal design and cascade semantics.** See Pattern 3 and M-3.
- The `documents.folder_id SET NULL` fires BEFORE UPDATE, not DELETE. So a held folder would lose its other owners' documents only if the folder delete succeeded, and the folders trigger refuses it.
- Versions have **no chain column**. A family is `(user_id, filename)` plus `org_id` (ingest, `ingest_splice.py:241-271`), plus `folder_id` (the delete-all key and the folder-scoped Expert installs). Deleting one version row of a held family is refused, because the family key decides held-ness (D-16).

**Q4. Receipts.** A retention-owned `retention_receipts` table (Pattern 9), plus audit_log rows for admin commands. `VALID_ACTION_TYPES` is missing `connector.watch.create/delete/sync` (verified), so sync them in the same change.

**Q5. The six delete paths.** Re-verified. Paths 1-3 still match the CONTEXT line numbers (±1). Paths 4-5 sit at `sources.py:323-334` and `:464-475`. All run on the **user JWT**. Paths 1-3 remove storage **before** the row. Paths 4-5 never remove storage. Paths 4-5 swallow DB errors. See the table in Pattern 4.

**Q6. Sweep machinery.** See Pattern 8. Use an env flag, by precedent and D-29. Deploy-drift requires four artifacts in one commit.

**Q7. Policy evaluation.** See Pattern 5. A pure function with the decision order and fingerprint rule above. Incomplete reads dispose nothing.

**Q8. Frontend surfaces and the ledger.** Run against the candidate list (`node scripts/check-hot-file-ledger.cjs --files …`):
- **No row (G-5 cannot fire):** `backend/app/api/folders.py` (**11/9/233, FIRES**), `backend/app/api/kb.py` (**13/9/504, FIRES**), `backend/app/services/audit_service.py` (**7/7/89, FIRES**), `backend/app/services/sql_service.py` (**9/4/133, FIRES**). Re-derive the triples and add the rows plus their sections in the same commit.
- `sources.py` (8/2/693) and `OrgAdminShell.tsx` (3/5/442) **already have rows**. The CONTEXT note that they are owed is stale; update the rows.
- FIRING rows touched (honour by construction):
  - `documents.py` (guard calls + reorder)
  - `tool_dispatcher.py` (wall calls)
  - `DocumentRow.tsx` (one chip slot)
  - `DocumentDetailPanel.tsx` (one `<PanelSection title="Retention">`)
  - `LibraryPage.tsx` / `DocumentList.tsx` (hidden-count line)
  - `FolderNode.tsx` (folder line via NavRow `caption`)
  - `LibraryHeaderBar.tsx`, `types/index.ts`, `lib/api/documents.ts`, `models/document.py` (optional `archived_at`, `archived_policy_id`, `source_state` fields; defaulted, per the 217 precedent)
  - `main.py` (one lifespan block + one `include_router`)
  - `config.py` (one flag)
  - `db/watches.py` / `watch_service.py` are **not** edited.
- `OrgAdminShell.tsx`: flip `retention.locked` (:104-109) and add one branch rendering a self-fetching `<OrgRetentionTab />`. Precedent: `<OrgExpertsTab />` at :399.
- `src/components/org` is **not** in the vitest `TARGETS`. Create `src/components/retention/` and add it as a directory entry (the `src/components/attachments` precedent, vitest-count-gate.cjs:6122), then pin each suite in `BASELINE`.

**Q9. Member hold visibility.**
- `list_documents` (`documents.py:739-816`) and `list_document_versions` (`:819-846`) return `select("*")` from `documents`. Holds live in separate tables, so no existing payload can carry a matter name.
- The **only** hold-bearing payloads are the new `/retention/document-states` and the Retention tab. `document-states` RLS-reads the requested ids first (user JWT), computes with the service role for that readable subset, and includes `hold_names` only when `_has_org_permission(org, 'org:manage')` (`dependencies.py:878`).
- RLS on `legal_holds` / coverage tables / receipts: SELECT only when `current_user_has_permission(org_id, 'org:manage')`. A member's direct PostgREST read returns nothing.
- Guard refusals to members: "On legal hold. Ask an org admin."

**Q10. Test infrastructure.**
- Backend unit tests live in `backend/tests/unit` (mocked supabase builders).
- Live-DB integration tests live in `backend/tests/integration`:
  - `_rls_harness.requires_pg` skip-guard on :54322
  - `pg_pool` and `two_orgs_two_users` fixtures (conftest.py:74-199)
  - GoTrue helpers `_271_gotrue_users`
  - pattern files: `test_272_scope_rls.py` (seed, then clean up in `finally`, with a positive control) and `test_272_rpc_document_scope.py` (it **holds `EXACT_BRANCH_SQL` verbatim** at :54-66 and asserts it inside the live body at :286, so update it with migration 205).
  - Triggers are tested live: apply 204/205 to the local DB, then exercise each path.
- Frontend: vitest under `src/**/__tests__`, plus the two count-gate knobs (TARGETS decides what runs; BASELINE decides what is guarded).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-worker nightly job | a leader election or an in-process timer | `FOR UPDATE SKIP LOCKED` claim + lease + in-TX `next_run_at` advance (`db/watches.py:203-254`) | proven exactly-once semantics; no leader whose death means nothing fires |
| "Excluded from agent SQL" | regex-rewriting model SQL | GUC-keyed RESTRICTIVE RLS (Pattern 2) | the model can reach chunks without naming `documents` |
| Hold enforcement | a Python check per path | trigger + one SQL predicate; Python only explains | cascades and future code bypass Python (M-3) |
| Complete reads | `.execute()` and trust the page | `_fetch_all`-style exact count + `SearchTruncatedError` (`document_search_service.py:232-253`) | a truncated read must dispose nothing |
| Org permission | role-string checks | `require_org_manage` / `current_user_has_permission` | the one swappable seam (D-166-09) |
| Custom HTTP status from SQL | parsing error text | `ERRCODE = 'PT409'` | PostgREST maps PTxyz to HTTP xyz [CITED] |
| Version family | a new chain column | the existing keys (Pattern 5) | no migration of history; consistent with the delete-all path |

**Key insight:** the dangerous part of this phase is not the evaluator. It is the paths that **bypass** it: cascades, owner UPDATE/DELETE policies, TRUNCATE, model-written SQL, storage-first ordering. Each one is closed in the database, with Python adding only explanations.

## Runtime State Inventory

Not a rename phase, but the phase changes runtime behaviour of stored data, so the categories are answered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Local: 2 docs `missing_at_source` (will leave agent retrieval at mig 205, as intended). Prod (2026-10-04 read): 78 docs, all `source_state NULL`. | None. Verify with a prod read (free) before deploy. |
| Live service config | Production Supabase needs migrations 204 + 205 applied **before** the backend (D-29). | Operator-approved SQL-editor paste; `get_advisors(security)` read after. |
| OS-registered state | None. The sweep is in-process, not a Task Scheduler or cron entry. | None |
| Secrets/env vars | New `RETENTION_SWEEP_ENABLED` (default false). The preview-token HMAC should reuse an existing server secret. | 4 artifacts, same commit. Confirm which existing secret at planning (A4). |
| Build artifacts | None (no package changes). | None |

## Common Pitfalls

### Pitfall 1: New column without statistics flips the vector plan
**What goes wrong:** the vector arm goes from about 3 ms to 943 ms per call (M-1 B).
**Why:** the planner's default selectivity for an unanalysed column predicate makes the btree-join plan look cheaper than HNSW.
**How to avoid:** `ANALYZE public.documents` in migration 204/205 after the column adds. Prefer the generated `retrievable` column (robust even without statistics).
**Warning signs:** an EXPLAIN of the body statement showing `Seq Scan on documents` + `Sort` instead of `Index Scan using document_chunks_embedding_idx`.

### Pitfall 2: CREATE OR REPLACE drops the plan pin
**What goes wrong:** copying the mig-200 bodies without `SET plan_cache_mode TO 'force_custom_plan'` brings back the 0.45-31 s generic-plan regression.
**How to avoid:** both clauses in both headers. `test_272_review_fixes.py::test_wr04_…` auto-scans 205.

### Pitfall 3: Bytes deleted, row refused
**What goes wrong:** the hold refuses the row but storage was removed first, so a held document loses its file.
**How to avoid:** guard → row delete → storage (Pattern 4). A test asserts storage `.remove` is **not** called when the guard or trigger refuses.

### Pitfall 4: Swallowed refusals report success
`sources.py` purge paths catch everything and still delete watch items / report `purged_count`. Map PT409 to 409 and never continue.

### Pitfall 5: Matter name leaks through an error string
A trigger `RAISE` that interpolates the hold name reaches members through PostgREST error JSON. The message names only the document id. Names are added by the API only when `can_manage`.

### Pitfall 6: Owners can un-archive through PostgREST
The owner UPDATE policy (full-schema.sql:7273) allows any column. Without Pattern 3 trigger 5, D-19 is decorative.

### Pitfall 7: Fences that must be retired on purpose (SEED-177)
These pin the old predicate or the AST:
- `test_272_scope_seam.py:33-34` (predicate names)
- `test_272_scope_resolver.py:146` (the `.or_` args)
- `test_267_scope_preview.py:69` (`RETRIEVAL_OR`)
- `test_272_pure_move.py` `MOVE_MAP` for `resolve_document_id` / `fetch_full_document` (if `retrieval_documents.py` is edited)
- `tests/integration/test_272_rpc_document_scope.py:54-66` `EXACT_BRANCH_SQL`

Update each in the same plan, with a written reason, or the backend ceiling (71) is breached.

### Pitfall 8: HNSW under-fill with mass archival
50% archived gave 9-20 rows instead of 20 (M-1 E). This is not a regression of this phase (the same mechanism already exists for `is_latest=false`). Record it. The remedy is the existing `hnsw_iterative_scan` setting.

### Pitfall 9: Disposition reaches the wrong family
The hold family key (wide) and the delete family key (narrow, `+folder_id`) are different on purpose. Swapping them either under-holds (unsafe) or over-deletes (unsafe).

### Pitfall 10: Dedup returns an archived document
`documents_dedup_idx` is org-scoped on `(org, user, content_hash, folder)`. Re-uploading an archived file returns the archived row as a duplicate (`ingest_splice.py:224-239`). The user sees nothing new in chat. Show "Already in the Library (archived)" or record it as a known limit.

### Pitfall 11: Watched sources can bring a disposed file back
Disposition sets `connector_watch_items.document_id` NULL (FK SET NULL). A later source change may re-mint the file. Record it under SEED-210. Out of scope.

### Pitfall 12: Count-gate blind spot
`src/components/org` is not in TARGETS. Put new suites under `src/components/retention/`, add the directory to TARGETS, and pin each in BASELINE.

### Pitfall 13: A Find request with `include_archived` 422s on an old backend
`DocumentSearchRequest` is `extra="forbid"`. Deploy the backend before the frontend, or in the same release.

### Pitfall 14: Preview/sweep drift
If Preview and the sweep call different code, SC#3's "exactly" fails. One `evaluate()`. A test runs Preview, then the sweep, on the same fixture and asserts identical sets.

## Code Examples

### Migration 205 core (sketch: the executor writes the real file)
```sql
-- 205_retrievable_predicate.sql — STEP ORDER MATTERS
BEGIN;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS retrievable boolean
  GENERATED ALWAYS AS (archived_at IS NULL AND (source_state IS NULL OR source_state = 'live')) STORED;
ANALYZE public.documents;   -- ⛔ measured: without stats the vector arm went 3 ms → 943 ms (M-1 B)

CREATE OR REPLACE FUNCTION public.match_document_chunks( /* mig 200 signature, unchanged */ )
 RETURNS TABLE(id uuid, document_id uuid, content text, chunk_index integer, similarity double precision)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
 SET plan_cache_mode TO 'force_custom_plan'      -- ⛔ test_272_review_fixes WR-04
AS $function$ /* mig 200 body, both branches: replace the source_state clause with */ /* AND d.retrievable */ $function$;
-- keyword_search_chunks: same

CREATE OR REPLACE FUNCTION public.query_user_documents(sql_query text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; clean_query text;
BEGIN
  clean_query := trim(sql_query);
  IF lower(clean_query) NOT LIKE 'select%' THEN RAISE EXCEPTION 'Only SELECT queries are permitted'; END IF;
  IF position(';' IN clean_query) > 0 THEN RAISE EXCEPTION 'Query must be a single statement (no semicolons)'; END IF;
  PERFORM set_config('app.agent_read', 'on', true);          -- Phase 275: agent SQL never sees unretrievable rows
  EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', clean_query) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END; $$;

CREATE POLICY documents_agent_read_retrievable ON public.documents AS RESTRICTIVE FOR SELECT TO authenticated
  USING (current_setting('app.agent_read', true) IS DISTINCT FROM 'on' OR retrievable);
-- document_chunks / document_tables / document_images: same shape through a STABLE SECURITY DEFINER
-- public.document_is_retrievable(document_id) helper (EXECUTE: revoke PUBLIC/anon, grant authenticated)
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text, uuid[], integer) FROM PUBLIC, anon;
-- … grant authenticated, service_role (both RPCs); query_user_documents: grant authenticated only
COMMIT;
```

### The hold trigger
```sql
CREATE FUNCTION public.documents_refuse_held_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.legal_holds h WHERE h.org_id = OLD.org_id AND h.released_at IS NULL) THEN
    RETURN OLD;                                   -- fast path: no active hold in this org
  END IF;
  IF EXISTS (SELECT 1 FROM public.retention_held_documents(ARRAY[OLD.id])) THEN
    RAISE EXCEPTION 'document % is on legal hold', OLD.id USING ERRCODE = 'PT409';  -- ⛔ never the matter name
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER documents_refuse_held_delete BEFORE DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_refuse_held_delete();
```

### Guard call order (documents.py scope=version, D-32)
```python
await assert_none_held([document_id], can_manage=False, supabase=service_supabase)   # 409 with a reason, before anything is removed
supabase.table("documents").delete().eq("id", document_id).eq("user_id", current_user["id"]).execute()
try:
    supabase.storage.from_("documents").remove([target["file_path"]])               # bytes LAST
except Exception:
    pass
```

### Pure evaluator signature
```python
@dataclass(frozen=True)
class Decision:
    kind: Literal["archive", "queue_delete", "queue_review", "archive_and_queue_delete", "already_archived",
                  "not_due", "pending", "held", "kept", "unarchived", "collision", "no_date", "no_policy",
                  "private", "not_previewed"]
    policy_ids: tuple[str, ...]
    due_at: date | None

def evaluate(family: FamilyFacts, ctx: EvalContext, now: datetime) -> Decision: ...   # no I/O, ever
```

## Recommended Plan Breakdown (G-8: 5 plans, 4 waves)

| Plan | Wave | Owns (files) | Content |
|---|---|---|---|
| **275-01 Database: holds, retention schema, retrievable predicate** | 1 (alone; mutates the local DB) | `supabase/migrations/204_retention_and_legal_hold.sql`, `205_retrievable_predicate.sql`, `supabase/full-schema.sql` (regenerated), `backend/app/services/retention/hold_guard.py`, `backend/app/services/audit_service.py` (VALID_ACTION_TYPES), `backend/tests/integration/test_275_*` (triggers per path including the `auth.users` cascade, folder cascade, sticky move, TRUNCATE, owner un-archive refused, member RLS refusal, cross-org WITH CHECK, RPC exclusion **one test per source_state + archived on both arms**, GUC policies on query_documents/grep including a chunk-table leak attempt, the `EXACT_BRANCH_SQL` update), ledger row for `audit_service.py` | TDD: RED integration tests first, then migrations. Apply by pasting into the SQL editor, with the DB lock held. |
| **275-02 Backend seams: delete paths + agent wall + Find** | 2 (∥ 03) | `api/documents.py`, `api/folders.py`, `api/sources.py`, `services/retrieval_scope.py`, `services/expert_scope.py`, `services/retrieval_documents.py` (or the wall), `services/tool_dispatcher.py` (wall calls), `api/kb.py` (ls/tree/glob filter, optional), `services/retention/agent_wall.py`, `services/document_search_service.py`, `models/document_search.py`, `models/document.py`; fence retirements (Pitfall 7); ledger rows for `folders.py`, `kb.py` | Guard → rows → bytes on all paths, PT409 → 409, no swallowed refusals, folder.delete audit. |
| **275-03 Retention engine + API** | 2 (∥ 02) | `services/retention/{evaluate,periods,load,disposition,sweep_service}.py`, `db/retention.py`, `models/retention.py`, `api/retention.py`, `main.py` (lifespan + router), `config.py` (`retention_sweep_enabled`), `backend/.env.example`, `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` | TDD on the pure evaluator first (Halden & Co. 24-doc fixture ported from the sketch: no date, collision, held, late hold, two-stage, kept/unarchived fingerprint); preview token; confirm re-check; receipts; run-now; cross-org refusal; member 403 on every write. |
| **275-04 Frontend** | 3 | `src/components/retention/*` (new), `src/lib/api/retention.ts`, `OrgAdminShell.tsx` (flag + one branch), `DocumentRow.tsx` (chip slot), `DocumentDetailPanel.tsx` (one section), `LibraryPage.tsx`/`DocumentList.tsx` (hidden line), `FolderNode.tsx` (caption), `findState.ts` + `StructurePopovers.tsx`/`DocumentsFindBody.tsx` (Include archived), `types/index.ts`, `scripts/vitest-count-gate.cjs` (TARGETS dir + BASELINE pins) | Copy ported from the sketch into `retentionCopy.ts`, `?raw`-fenced. Member render has no matter name. Type-the-count. |
| **275-05 Merged-tree gates + G-4 + close** | 4 | VERIFICATION evidence, ledger updates, `docs/` user page, reported-bug/seed frontmatter (BUG-261004-01 → closed only if it no longer reproduces; SEED-250 answered; SEED-345 partially-answered) | Backend ceiling 71, vitest gate, `tsc -p tsconfig.app.json` set diff, deploy drift script, the three Chrome scenarios (D-26), the code review subagent, the security audit. Prod migration apply + `get_advisors(security)` are **operator-approved, owed**, not executed. |

Why 5: plan 01 must be alone, because both migrations and every live test mutate the local DB (worktree rule 4). Plans 02 and 03 share no files. Plan 04 needs the API. The gates and G-4 are one unit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Predicate copied in 3 places (`source_disconnected` only) | Generated column + constant | this phase | BUG-261004-01 class closed structurally |
| `DEFAULT_PREDICATES` planned `not_archived` with `enforced_in_rpc=False` (272-RESEARCH:334) | `retrievable` with `enforced_in_rpc=True` | this phase (measured) | unfiltered search pays nothing |
| Hold as a `documents.legal_hold boolean` (SEED-250 sketch) | named matters + coverage evaluated at check time | D-05 | "added later" works; matter names stay private |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Policies reach only **org-visible** documents (in an org-shared folder, or connection docs with org visibility). Members' private documents are never evaluated; Preview counts them as "N private documents not covered". | Pattern 5 step 1, Open Q1 | Medium. If the operator expects org-wide reach, admins would see and delete names they cannot otherwise read (a visibility widening). The recommended rule fails closed (deletes less). |
| A2 | The hold family key is `(org_id, user_id, filename)`; the disposition family key is `(user_id, filename, folder_id)`. | Patterns 3/5 | Low. The wide hold key over-holds, which is safe. |
| A3 | Sticky coverage on move-out (vs refusing moves). | Pattern 3 trigger 3 | Low. Either is fail-closed. |
| A4 | The preview token HMAC reuses an existing server secret (e.g. the cipher key used by `secret_cipher.py`) rather than a new env var. | Pattern 7 | Low. A new secret would add a deploy-parity item. |
| A5 | Sweep hour 02:00 UTC as a code constant. | Pattern 8 | Low. "Archives tonight" is computed from `next_run_at`, so the chip stays truthful. |
| A6 | Holds can be added to but coverage rows are not removed individually; ending a hold is a whole-hold release. | Pattern 3 | Low. A UX limit, not a safety issue. |
| A7 | The listing-only agent tools (`query_documents_by_view`, `get_related_documents`) may still name an archived document; every content read refuses it. Recorded as a limit. | Q2 | Medium. Operator reading of "every agent path" may include listings; `ls`/`tree`/`glob` are filtered to narrow the gap. |

## Open Questions

1. **Do policies reach members' private documents?**
   - What we know: admins cannot read other members' private docs under RLS (full-schema.sql:7403). The sketch's examples are all shared folders.
   - What's unclear: whether "a class policy" should dispose documents only their owner can see.
   - Recommendation: no (A1). Fail closed, and say so in Preview. Revisit with SEED-345's remainder.
2. **Should legal holds reach private documents?**
   - What we know: an admin can only pick what they can see, so private documents cannot be held this phase.
   - Recommendation: record it as a limit in VERIFICATION and the docs page. A future "org-wide matter by custodian" is a seed, not this phase.
3. **The UI-SPEC step.** `ui_phase: true` in config. The sketch already fixed the layout, so run `/gsd:ui-phase 275` only if the planner needs the wording for the two other source states ("Unshared at source", "Source disconnected"). D-21 allows the UI-SPEC to decide.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres :54322 | migrations, integration tests, measurements | ✓ | PG 17.6 | — |
| `recall_bench` DB | re-measuring M-1 at verification | ✓ | 100k chunks | — |
| Python venv | backend | ✓ | 3.12.6, pytest 9.0.2, pytest-asyncio 1.3.0, asyncpg 0.31.0 | — |
| Node | vitest, gates | ✓ | 24.19.0 | — |
| `psql` CLI | ad-hoc SQL | ✗ | — | asyncpg scripts (used this session) |
| Supabase MCP (prod) | `get_advisors(security)`, prod parity reads | ✓ (reads free, writes approval-gated) | — | — |
| Chrome MCP | G-4 drives | assumed ✓ (used by 274) | — | — |

**Missing with no fallback:** none. **Missing with fallback:** `psql`, replaced by asyncpg.

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`. This section is included because the orchestrator asked for it. It is kept compact.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 (+ pytest-asyncio 1.3.0); vitest (frontend) |
| Config file | `backend/tests/conftest.py`, `backend/tests/integration/conftest.py`; `scripts/vitest-count-gate.cjs` |
| Quick run command | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_275_*.py -q` |
| Full suite command | `node scripts/check-backend-unit-baseline.cjs` (ceiling 71) · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RET-01 | member POST/PUT/DELETE policy → 403; admin with a stale/absent preview token → 409; cross-org folder → refused | unit + integration | `pytest tests/unit/test_275_retention_api.py tests/integration/test_275_policy_rls.py -q` | ❌ Wave 0 |
| RET-02 | each of the 6 paths + confirm refuses a held doc; bytes not removed; `auth.users` delete refused; folder delete refused whole; sticky move; TRUNCATE refused | integration (live) + unit | `pytest tests/integration/test_275_hold_triggers.py tests/unit/test_275_delete_paths.py -q` | ❌ Wave 0 |
| RET-03 | Preview set == sweep set (same fixture); incomplete load → zero writes; one receipt per action; late hold → `did_not_delete`; kept skip until fingerprint/revision change | unit (pure) + integration | `pytest tests/unit/test_275_evaluate.py tests/unit/test_275_sweep.py tests/integration/test_275_disposition.py -q` | ❌ Wave 0 |
| RET-04 | archived + each source_state excluded from both RPC arms (one test per state, with a positive control); `query_documents` / `grep` cannot see archived rows or their chunks; `read_document` / `analyze_document` / `fetch_document_file` refuse; Find default hides, `include_archived` finds; download still works | integration + unit | `pytest tests/integration/test_275_retrievable.py tests/unit/test_275_agent_wall.py -q` | ❌ Wave 0 |
| UI | tab lock lifted; Save disabled until Preview, re-locked on edit; type-the-count; member sees "On legal hold. Ask an org admin." with no matter name; N archived hidden · Show | vitest | `npx vitest run src/components/retention` | ❌ Wave 0 |

### Sampling Rate
- Per task: targeted test files above (G-8: targeted per task).
- Per wave merge: backend ceiling + vitest gate + `tsc -p tsconfig.app.json` set diff.
- Phase gate: all of the above plus the three D-26 Chrome drives, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_275_hold_triggers.py`, `test_275_retrievable.py`, `test_275_policy_rls.py`, `test_275_disposition.py`
- [ ] `backend/tests/unit/test_275_evaluate.py` (Halden & Co. fixture), `test_275_periods.py`, `test_275_delete_paths.py`, `test_275_agent_wall.py`, `test_275_retention_api.py`, `test_275_sweep.py`
- [ ] `frontend/src/components/retention/__tests__/*` and the TARGETS/BASELINE entries

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Supabase JWT via `get_current_user` |
| V3 Session Management | no (no new session state) | — |
| V4 Access Control | **yes, central** | `require_org_manage` on every write/confirm/unarchive/run-now; RLS `current_user_has_permission(org_id,'org:manage')` on holds/receipts; explicit `org_id = active_org` on every service-role statement; DB triggers for holds |
| V5 Input Validation | yes | Pydantic `extra="forbid"`; CHECK constraints on enums/periods; `typed_count == len(ids)` server-side; the preview token binds the draft |
| V6 Cryptography | yes (small) | HMAC (stdlib `hmac`, `hashlib.sha256`) for the preview token, never hand-rolled hashing; reuse an existing secret |
| V7 Error Handling / Logging | yes | PT409 mapped to 409 with a fixed message; no matter names in DB errors; receipts plus audit_log |
| V8 Data Protection | **yes** | archived docs leave agent context; disposition removes rows, versions, chunks and bytes; receipts keep only names |

### Known Threat Patterns (STRIDE sketch)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Member creates or edits a policy that deletes others' docs | Elevation | `require_org_manage` + RLS write policy (two walls); D-26 MEMBER drive |
| Admin of org A disposes org B's docs | Elevation / Tampering | every service-role query carries `org_id = $active_org`; RLS `WITH CHECK` on coverage and policy folder org; cross-org integration test |
| Held doc deleted via a cascade, service role, TRUNCATE or future code | Tampering | BEFORE DELETE / TRUNCATE triggers + one SQL predicate (M-3) |
| Held doc moved out of a held folder, then deleted | Tampering | sticky coverage trigger (or refuse the move) |
| Owner un-archives through PostgREST to bring content back into chat | Tampering | trigger 5 refuses `archived_at` changes by `authenticated` |
| Archived content read by the agent through model-written SQL on chunks | Information disclosure | restrictive GUC policies on documents/chunks/tables/images |
| Matter name revealed to a member (error text, payload, PostgREST read) | Information disclosure | names only in manage-gated payloads; RLS SELECT manage-only; trigger messages name ids only |
| Preview bypassed (save without a dry run, or a forged token) | Tampering / Repudiation | server-side HMAC token bound to the draft; `previewed_revision` checked by the sweep |
| Batch confirm replays stale ids, deleting a doc that became held or changed | Tampering | per-family TX: row lock, hold re-check, fingerprint/revision re-check, then delete |
| Receipt lost when the approver is deleted | Repudiation | `retention_receipts.actor_id ON DELETE SET NULL` + `actor_name` snapshot |
| Sweep runs twice across workers | DoS / Tampering | SKIP LOCKED claim + lease + in-TX `next_run_at` |
| Mass archival starves retrieval (top-k under-fill) | DoS (quality) | record it; existing `hnsw_iterative_scan` knob |
| New SECURITY DEFINER functions executable by `anon` | Elevation | REVOKE from PUBLIC and anon, grant explicitly; `get_advisors(security)` |

## Sources

### Primary (HIGH confidence)
- Local measurements this session: M-1 (`measure.py`, `measure2.py`), M-2 (`restrictive.py`), M-3 (`trig.py`), M-4 (`probe.py`). The scripts are in the session scratchpad. All DDL/DML was rolled back. The DB lock was taken and released.
- Codebase (read this session):
  - `backend/app/services/retrieval_scope.py` (full)
  - `supabase/migrations/200_*.sql`, `201_*.sql`
  - `backend/app/api/documents.py:739-846, 1809-1905`
  - `backend/app/api/folders.py:132-169`
  - `backend/app/api/sources.py:303-485`
  - `backend/app/api/kb.py:54-470`
  - `backend/app/services/sql_service.py`
  - `backend/app/services/tool_dispatcher.py:240-500, 797-1110, 2699-2705, 4543-4580`
  - `backend/app/services/retrieval_documents.py`
  - `backend/app/services/expert_scope.py:30-60, 150-200`
  - `backend/app/services/audit_service.py`
  - `backend/app/dependencies.py:878-1100`
  - `backend/app/db/watches.py:195-254`
  - `backend/app/main.py:520-604`
  - `backend/app/config.py:1350-1425`
  - `backend/app/services/document_search_service.py:190-470`
  - `backend/app/services/ingest_splice.py:224-300`
  - `supabase/full-schema.sql` (documents DDL, FKs, policies, helper functions)
  - `frontend/src/components/org/OrgAdminShell.tsx`
  - `scripts/check-hot-file-ledger.cjs` (run)
  - `scripts/vitest-count-gate.cjs`
  - `scripts/check-deploy-drift.sh`
  - `backend/tests/unit/test_272_*.py`, `backend/tests/integration/test_272_*.py`, `_rls_harness.py`

### Secondary (MEDIUM confidence)
- [PostgREST errors reference: PTxyz → HTTP xyz; P0001 → 400](https://docs.postgrest.org/en/latest/references/errors.html) (via search result summary; the page fetch was rate-limited)
- [Supabase troubleshooting: custom error codes in RPC functions (avoid 40001)](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)
- [PostgreSQL PL/pgSQL errors and messages](https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html)

### Tertiary (LOW confidence)
- None relied upon.

## Metadata

**Confidence breakdown:**
- Retrieval predicate route: HIGH. Measured on 100k chunks, both arms, with and without statistics.
- Hold triggers / cascades: HIGH. Measured on the real schema.
- Delete paths: HIGH. Re-read at HEAD.
- Evaluator / sweep / API shape: MEDIUM. Designed from locked decisions and precedent, not built.
- UI integration points: MEDIUM. Insertion points verified, layout from the sketch.

**Research date:** 2026-10-12
**Valid until:** 2026-11-11 (stable internals; re-derive ledger triples and line numbers at planning)
