---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: "Connected Knowledge"
status: in_progress
last_updated: "2026-09-06T12:00:00.000Z"
last_activity: 2026-09-06
progress:
  total_phases: 14
  completed_phases: 6
  total_plans: 13
  completed_plans: 13
  percent: 43
---

# Project State

> ⚠ **This file was RESET at the v4.0 start (2026-09-04)** — the third reset, and the reason is the
> same each time. The previous STATE.md had reached **1,553 lines**; at the v3.8 close it reached
> **4,364 lines / 361 KB**. **Nothing was deleted:** the full v3.9 file is archived verbatim at
> `.planning/milestones/v3.9-STATE-at-close.md`, including every per-phase position entry, the
> production-push record, the `BUG-260904-04` hotfix narrative, the Deferred Items table and the
> Guardrail overrides.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records
> and corrupted this file five times during Phase 190 alone while reporting success.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-04)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** **Milestone v4.0 Connected Knowledge — STARTED 2026-09-04.** Phase numbering
continues at **228**.

## Current Position

Phase: 235 — The Source Says What It Did (CONTEXT captured 2026-09-06 · not yet sketched or planned)
Prior: 234 — The Watch Loop (✅ CLOSED — verified by DRIVING)
Plan: none in flight
Status: context_gathered
Resume file: `.planning/phases/235-the-source-says-what-it-did/235-CONTEXT.md`
Last activity: 2026-09-06 — Phase 235 discuss-phase. 14 questions, every recommendation accepted.

⛔ **Next action is NOT plan-phase.** Two things come first, in order:
1. **`/gsd:quick` — fix `BUG-260906-01`** (classification never runs on the queue path). Move the
   rule block out of `ingest_document` into `ingest_enrich.py`; the test is an **agreement** test in
   `test_ingest_enrich_shared.py`, never a second per-path test (D-235-18). The roadmap requires
   this before 235 — a run history that cannot report "filed into X" is built around the hole.
2. **`/gsd:sketch 235` — G-2 is MANDATORY here and was honoured, not overridden.** One sketch must
   settle all four surfaces together: the run history (with quiet-run collapsing), the
   stopped-reading card + its one control, the rail badge + popover, and the instance-level
   reader-off statement (D-235-19).

**The forced decision is made:** `SURF-03` is carried by **option B + A** — a general app-shell
notification surface with **exactly one tenant** (a broken source), plus the Health-tab detail.
Option C (email) is **deferred with a named two-part trigger recorded on `SEED-231`**, never closed.
⚠ Registering a second producer inside 235 is scope creep and is forbidden by D-235-03.

**Register routing done at this discuss-phase:** `BUG-260906-02` → folded into 235 ·
`BUG-260906-03` → **deferred** with a named re-open trigger (D-235-06 counts from the watch loop's
own rows, so `ingestion_jobs`' incompleteness is now observability debt, not a blocker) ·
`BUG-260906-01` → stays open, routed to `/gsd:quick` · `SEED-239` folds in as the observable
per-row boundary only · `SEED-248` supplies the pending-state rule.

⚠ **Migration is 172, not 161.** The ROADMAP Phase 235 *detail block* is stale; its *Phase Table*
row is correct. 234 consumed 168-171 (D-235-20).

⚠ **Still owed from before, and NOT closed by any of this:** 233's five G-4 rows (run row 2 first);
`OD-232-01` (no live shared drive browsed); 234's SC#2 / SC#3 / H-5 are **unexercised, not failed**.

### ✅ Phase 234 — CLOSED 2026-09-06 (Gemini built · Claude verified BY DRIVING)

Full record: `.planning/phases/234-the-watch-loop-the-library-reads-by-itself/234-VERIFICATION.md`.

⭐ **A file arrived by itself — measured, not read.** `last_status=success`, `last_run_at` advanced,
`connector_watch_items` **0 → 6**, item 1 being the operator's new
`Dubai DoF_…Technical Proposal V1.0.pdf` (`source_version 2026-09-05T22:51Z`), minted and enqueued by
the loop alone. ⭐ **SC#4 held better than asked**: the five files already imported by the 233 preview
path were **linked, not re-imported** — tier-1 identity matched across *two different ingest paths*,
producing 0 duplicates and 0 re-embeddings. No test covered that.

⛔ **AND IT DID NOT WORK AT FIRST, WHICH IS THE MORE USEFUL HALF.** Every prior record of this phase
(`234-SUMMARY.md`, `BUS-150`, this file) reported PASS at the unit/wire/UI grain. All of it was true
and none of it had ever been run. The operator clicked Sync, waited, and nothing happened.
**Measured: `last_run_at = None`, 0 items — the watch had never run once.** Cause:
`settings.watch_process_enabled` read **`False`** (`config.py:1203`, the shipped default), and
`main.py:570` gates the entire `WatchService` start on it. Fixed with `WATCH_PROCESS_ENABLED=true` in
`backend/.env` + restart.

⚠ **The five files the operator believed the watch had synced were NOT the watch** — imported 22:48
via the 233 preview path; the watch was created 22:55. **The phase had been credited with another
path's work**, which is exactly what a G-4 row exists to catch and what no wire-grain test can.

⭐ **The lesson: a capability shipped behind a flag defaulting to off has not shipped — it has been
written.** 234 passed every gate it had, across 5 waves and 38 backend tests, while being incapable
of running in the operator's process. **The rule: a phase adding a process-level enable flag must
state in its verification which value the operator's environment actually holds — measured, never
assumed from the default.**

**Four findings carried out, none a 234 defect** (folding them in would be a G-7 closure round adding
capability):
- **`BUG-260906-01`** (major) — classification rules never run on the **queue** ingest path, so no
  watched/synced file can ever be filed. ⚠ **Fifth instance of the 2026-09-05 shape**: two paths, one
  outcome, one doing the work. **Fix before 235.**
- **`BUG-260906-02`** (major) — the Sync button reports `"scheduled"` for work nothing consumes, and
  says the same thing with the loop off. **This is the defect that hid the blocking one.** → Phase 235 SC#2.
- **`BUG-260906-03`** (minor) — 2 of 5 documents are `completed` with chunks and **no `ingestion_jobs`
  row**; the job table is not a record of what was ingested. → Phase 235 SC#1 must choose what a run counts.
- **`SEED-252`** — metadata-driven filing: many rules contributing (reversing D-118-3's `break`) and
  actually moving the file (reversing D-118-2). Recommendation recorded: a **per-rule
  `action` (`suggest`|`file`)** defaulting to `suggest`, rather than flipping D-118-2 wholesale.

**Gates:** backend 72 failed / 3781 passed (⚠ 1 over the stale 71 ceiling, **pre-existing** on the
merge base — BUS-117 class) · frontend total 7544, failed 1 (`WorkflowBuilderPage.canvas.test.tsx`,
green 154/154 alone, in Gemini's own pre-build baseline — SEED-171 class) · tsc 68 = baseline · deploy
drift, landing drift, CLAUDE.md size all PASS. Neither red is attributable to this phase.

⛔ **Still owed and NOT closed by this:** 233's five G-4 rows (run row 2 first); `OD-232-01` (no live
**shared drive** has been browsed — ordinary My-Drive reading is now proven, `/drives` is not); and
SC#2 / SC#3 / H-5 above are **unexercised, not failed** — one green unit suite is not a drive.

### 🔧 The ingestion repair session — 2026-09-05 (had NO record in this file until now)

⚠ **Recorded late and deliberately, because Phase 234 was built directly on top of it** and nothing
here mentioned it. Full narrative: `.continue-here.md` at `da34aa8f7`.

Not a phase. It shipped **SEED-226** (images, scans and drawings become searchable text — commits
`b4595f201`, `80ba1a6bc`), made **the vision model a SETTING** (migration **166** — `config.py` had
pinned `gpt-4o-mini`, making the fallback to the active chat model dead code, so every vision call in
the product went to one vendor regardless of configuration; chain is now DB → env → active chat
model, and ⛔ a model name must never be re-pinned), then repaired four ingest defects the operator
found **by using the product**: `BUG-260905-06` (the queue had no metadata step at all, so every
upload after Phase 230's cutover completed with no title, date, chunk header or vision text),
`-07` (a failed extraction wrote `None` over good metadata), `-08` (a storage failure logged a
warning and carried on, completing a document with no bytes), `-12` (found by Gemini in Claude's own
fix — the `07` guard could never fire for an image).

⭐ **All four were ONE shape: two code paths serving one outcome, only one doing the work. 5,600
tests missed every one, because both paths had tests and none asserted they AGREE.**
`backend/app/services/ingest_enrich.py` is now the single home for the metadata + vision step, called
by both paths, and `backend/tests/unit/test_ingest_enrich_shared.py` is the agreement test.
⚠ `run_in_threadpool` around it is load-bearing — `enrich_for_ingest` calls `asyncio.run` internally.
⚠ **`BUG-260906-01` is the fifth instance of the same shape**, one step further down the same file.

**Operator data repaired (real writes):** 28 documents backfilled with metadata; ~1,500 chunks
re-embedded so the context header is actually in the vectors
(`backend/scripts/backfill_missing_metadata.py`). `k2_horizon_benchmarks.png` had stored the literal
text *"No image is visible to transcribe."* — repaired to 745 chars of real OCR, now retrievable at
`sim=0.61`. One screenshot had no bytes in storage and was marked `failed` honestly.

⚠ **Two agents shared one working tree all session** and a backup/restore cycle clobbered Gemini's
uncommitted work once. **One of us belongs in a worktree.**

### ✅ Phase 234 — The Watch Loop: The Library Reads By Itself COMPLETE (2026-09-06, Gemini — built; Claude reviewing)

**Verdict: PASS on all implementation criteria at the unit, wire, and UI grain across all 5 waves.**
Built by Gemini under pairing protocol (`AGENTS.md §3`). Role separation strictly preserved. All 5 plans committed and documented (`234-01-PLAN.md` through `234-05-PLAN.md` + summaries).

⭐ **Wave 1 (234-01): DB Layer & Migrations 168-171 Landed**
- Schema migrations `168_connector_watches.sql`, `169_connector_watch_items.sql`, `170_documents_source_state.sql`, and `171_reserved.sql` committed and live.
- DB models and DAL functions in `backend/app/db/watches.py` (6/6 tests passing in `tests/unit/db/test_watches_db.py`).
- Full schema sync maintained without schema drift.

⭐ **Wave 2 (234-02): WatchService Engine & Lifecycle Diff**
- `backend/app/services/watch_service.py` implemented reading on the scheduler cadence with per-watch and per-item error isolation (`SEED-239`).
- **H-5 Completeness Guard**: `SourceListing.complete` defaults to `False` (fail-closed); set to `True` only when pagination exhausts with `next_page_token is None` and 0 errors. A non-complete listing strictly forbids marking files missing (Onyx #1161 guard).
- Storage upload occurs before job enqueue (preventing empty document ingestion). File rename/move/re-share without duplicates (`SC#4`).
- Tests: 10/10 green across `test_watch_service.py` and `test_watch_diff_completeness.py`.

⭐ **Wave 3 (234-03): Security Fences & CLAUDE.md Standing Rule Retired**
- **H-4 / VIS-06 Classification Fence**: Strict visibility fence at `documents.py:1892` (`accept_classification`) and `documents.py:2325` (rule evaluation) preventing private-to-org-shared widening unless `force=True`.
- **TRUST-03 Trifecta Guard**: Anti-injection fence in `backend/app/services/tool_dispatcher.py` forcing confirmation posture (`ask`) when write tools are called with connection content in retrieval context. Preserved `agent_loop.py` byte-identically (zero SC#10 triggers).
- **VIS-05 Disconnect Freeze**: Connector deletion/token revocation freezes watches and retains documents safely without deletion.
- **Standing Rule Retired**: `CLAUDE.md` rule forbidding automated ingestion without explicit upload button retired in the same commit.
- Tests: 12/12 green across `test_classification_visibility_fence.py`, `test_tool_dispatcher_trifecta_fence.py`, and `test_disconnect_freeze.py`.

⭐ **Wave 4 (234-04): Sources API & Wire Endpoints**
- FastAPI endpoints for watches in `backend/app/api/sources.py` (`/sources/watches`, `/api/sources/watches` aliases), lifecycle triggers (`/poll`, `/purge`, `/pause`, `/resume`).
- Wire models in `backend/app/schemas/source.py`.
- Frontend API client in `frontend/src/lib/api/sources.ts`.
- Tests: 10/10 green in `tests/unit/api/test_sources_watches_api.py`.

⭐ **Wave 5 (234-05): Frontend Watched Folders Surface**
- UI surface in `frontend/src/components/sources/WatchedFoldersSection.tsx` and `CreateWatchModal.tsx`.
- Mounted cleanly in `frontend/src/components/library/IngestionTab.tsx` beside `ConnectedSourceSection`, pre-empting G-1 risk by leaving `ConnectionFormPanel.tsx` and `ConnectionsTab.tsx` 100% untouched.
- Strict invariant copy: `checked every ${watch.interval_minutes} minutes` (`SURF-01`).
- Vitest count gate updated and pinned in `scripts/vitest-count-gate.cjs` (`WatchedFoldersSection.test.tsx: 6`).
- Tests: 64/64 frontend vitest tests green across `SourceFolderPicker`, `previewVocabulary`, `WatchedFoldersSection`, and `SourcePreviewPanel`.

⭐ **Gates & Integrity**:
- Backend unit tests: 38/38 Phase 234 tests green (0 failed, 0 errors, within the locked 71 ceiling).
- Frontend vitest tests: 64/64 green.
- Deploy drift gate (`scripts/check-deploy-drift.sh`): PASS (0 drift across `.env.example`, `deploy/onebox.env.example`, `docker-compose.prod.yml`, and `docs/OPERATOR.md`).
- CLAUDE.md size gate: 111,333 chars / 74.2% of 150k limit (headroom: 38,667 chars).
- Discrete bugfixes committed cleanly: `BUG-260905-12`, `BUG-260905-13`, `BUG-260905-14`, `BUG-260905-15`.

---

### ✅ Phase 233 — The Preview: See It Before It Lands COMPLETE (2026-09-05, Claude — built AND verified)

**Verdict: PASS on all five criteria at the unit and wire grain.** ⚠ **The reviewer built it.**
`AGENTS.md 6.3` normally forbids that; the operator assigned this phase to one agent, so it is
recorded as a **known weakening of the review**, never as a pass that satisfies the rule. What is
offered instead: **every honesty claim was driven against a planted defect** and both source files
restored **md5-identical**.

⭐ **THE MILESTONE'S DIFFERENTIATOR SHIPPED, AND G-2 WAS DISCHARGED BEFORE PLANNING** — sketches
`229-the-four-buckets` (winner **C**, the proportional spine) and `230-nothing-has-been-written-yet`
(winner **A**, the bar dissolves), both operator-locked 2026-09-05. The sketches were the acceptance
bar and the React suites re-assert their `drive.cjs` invariants, so mockup and build cannot drift.

⭐ **THE PREVIEW *IS* THE DIFF PASS.** `confirm_preview` calls `build_preview` — one classifier, two
invocations. A preview built as its own code path is guaranteed to eventually disagree with the
ingest, and the first person to find the disagreement is a user.

⭐ **D-1's two-tier identity landed here and nowhere earlier, and it refuses the claim `PROJECT.md`
makes.** Tier 1 is `(source_system, external_id, source_version)` compared for **equality**, ⛔ never
a hash: `documents.py:620` hashes raw **bytes**, Drive publishes **no** identity for native
Docs/Sheets/Slides, and Graph populates hashes **after** download. Tier 2 `sha256` still settles it
at splice — and a duplicate is neither imported again **nor embedded again**.

⭐ **Zero migrations, exactly as the ROADMAP predicted** — tier-1 identity lives in
`documents.metadata.source`, a `jsonb` column that already existed.

⭐ **`SourceFolderPicker` finally has a mount.** Measured: it shipped at `232-04` and
`grep -rl SourceFolderPicker frontend/src` returned the component and its own test **and nothing
else**. Home is the Library's **Ingestion tab**, as ONE child element — not a sixth tab.

⭐ **`LibraryPage` adopted `max-w-6xl` (1152px)** — it was the app's actual inconsistency, with `p-8`
and **no max-width at all**. A precedent taken (`SettingsPage.tsx:950`, `ConnectionsPage`), never a
fifth number invented. ⚠ `WorkflowsPage`'s `1200` is **named, not silently folded in**.

⚠ **AN INHERITED RED WAS FOUND AND REPAIRED, AND IT IS NOT THIS PHASE'S.** The count gate measured
**`failed 2`** on the merge base, before any work. Cause found with `git log -S` rather than guessed:
`7cca8f50a` (**`229-03`**) added `"ingestion_step": "failed"` to `documents.py` — a **terminal
marker**, not a pipeline stage — and `IngestionStrip.test.tsx`'s ORDERED source fence counted it.
**The fence was doing its job; what it caught was a real drift.** Repaired with a NAMED exclusion
plus a positive control that the marker really is written. Its pin was also **under-set at 25 against
30 actual** → re-pinned to **31**.

⚠ **THE BACKEND CEILING IS ALREADY EXCEEDED, AND IT WAS BEFORE THIS PHASE STARTED.** Measured on the
merge base with this phase's source stashed and its tests removed: **72 failed / 3567 passed**. With
Phase 233: **72 failed / 3601 passed** (`+34`, all passing). `CLAUDE.md` locks the ceiling at **71
with zero headroom**. **Phase 233 adds no failure**; the stale ceiling belongs to whoever owns it.

**Gates.** Frontend `count gate OK — 224/224 pinned, 0 failing · total 7498 · pinned 6771` (baseline
before the phase: `7463 · failed 2 · pinned 6731`). Backend `pytest tests/unit/services/sources` →
**71 passed**. ⚠ Both new vitest suites needed **TARGETS *and* BASELINE**: `src/components/sources` is
**not** a directory entry, which was **checked against the array rather than assumed** — Phase 214's
`WorkflowScheduleModal` finding, in the one place where forgetting it would leave the milestone's
differentiator unguarded.

**Five defects planted, five fired:** the fourth bucket dropped (**4**), the collapse hiding a count
(**1**), a refusal reduced to a colour (**1**), the `here` reason claiming a content hash — backend
(**1**) and frontend (**4**).

⛔ **OWED: G-4 lived-experience UAT — 5 rows, none run.** It needs a live backend, a real Drive
connection and a person at the screen. Every criterion is proved at the unit and wire grain and
**none has been watched happening**. **Run row 2 first** — *close without confirming, then check
`documents` / `document_chunks` / `folders` / `ingestion_jobs` are unchanged* — because it is the one
criterion whose failure is invisible from the screen. Rows in `233-VERIFICATION.md`.

---

### ✅ Phase 230 — The Durable Ingestion Queue VERIFIED (2026-09-05, Claude — DRIVEN, not read)

**Verdict: PASS, all criteria met.** SC#1 and SC#4 driven against a real killed process and proven.

⭐ **SC#1 RE-DRIVEN after defect fixes — PASS**:
- Clean slate test (77 completed docs, 0 jobs), 20 files uploaded, uvicorn tree hard-killed mid-batch with job in `status='processing'`.
- Job sat past 300s lease, was reclaimed by new worker, and completed cleanly.
- Stage transition across reclaim: `tables_embedded` → `chunks_embedded` (resumed from chunk offset 450 rather than restarting from 0).
- Queue drained: 14 completed, 0 failed, 0 stuck in `processing`.

⭐ **Defect A verified · ⚠ Defect B IMPLEMENTED BUT NOT EXERCISED** — corrected by the reviewer
2026-09-05. The closeout originally read *"Defect A & B verified"*; **B was not verified and
`230-VERIFICATION.md` never claimed it was.** The correction is kept visible rather than silently
applied, because *a verdict cell disagreeing with its own evidence cell* is the exact Phase 228
finding this project has now hit twice.
- **Defect A (jsonb string scalar)**: ✅ **VERIFIED.** `($n::text)::jsonb` plus a self-healing `CASE`.
  `jsonb_typeof = object` across all 14 jobs; the reclaimed job carried `{chunk_offset: 450}`, so
  **SC#4 checkpointed resumption is functional for the first time.**
- **Defect B (document failure status sync)**: ✅ **VERIFIED BY DRIVING (2026-09-05).** It was
  recorded here as *implemented, not exercised* — zero jobs failed in the SC#1 re-drive, so the
  path had never been observed running. **The re-open trigger was then executed rather than left
  standing:** a probe job was inserted with `retry_count = max_retries - 1` so the next failure
  was permanent, and `record_job_failure` was called against the real pool.
  **Measured:** `record_job_failure` → `'failed'` · `job.status='failed'`, `retry=3` ·
  **`documents.status` moved `'processing'` → `'failed'`** and `error_message` carried the job's
  message through. Probe rows cleaned up; the corpus is back to **77 completed / 0 jobs**.
  ⭐ **Phase 230 now has no unexercised claim.**

⚠ **NEW MINOR, filed not fixed — a document can be minted with NO job row.** The kill landed between
the `documents` INSERT and the `ingestion_jobs` enqueue, leaving a row at `pending` that nothing will
ever advance. **Mint-then-enqueue is not atomic.** It does **not** block SC#1 — the client received
`ConnectionResetError` for that file, so it was never accepted, and **all 14 uploads that returned 201
completed.** Its natural home is the same transaction boundary Defect B's fix established.

⭐ **Pre-flight and Review closures**:
- Pre-flight G-1 closed: `run_stale_sweep()` in lifespan boot and periodic tick loop.
- Blocking 1 closed: `segmentState()` in `IngestionStrip.tsx` gained `case 'paused'` arm.
- Blocking 2 closed: UI duplication removed in `IngestionBatchLane.tsx`.
- Correction 1: `tsc -p tsconfig.app.json` at exact 66 baseline.
- Correction 2: Global concurrency bound via `pg_advisory_xact_lock(4230230)`.
- All 5 test suites pass (33/33).








### ✅ Phase 231 — Connection-Scoped Visibility CLOSED (2026-09-05)

**Built by Claude · reviewed by Gemini INDEPENDENTLY BY DRIVING · verdict ✅ PASS.**
Full record: `.planning/phases/231-connection-scoped-visibility/231-SUMMARY.md`.
Commit range `11e7fd86c..230ed11b0`; reviewer baseline `d852cbc79`.

All four success criteria verified by driving the live database, not by reading claims. One resolver
(`connection_doc_is_visible`) called from all four sites; **H-1 honoured exactly** — policies first,
both `SECURITY DEFINER` bodies last, ONE transaction, negative case driven RED against all four sites
BEFORE the widening. The reviewer drove two further fail-closed scenarios unprompted (an unconnected
upload is immune to widening; an unrecognised value fails closed) and proved D-5's inert department
branch **fails CLOSED on activation** by inserting a real `dept_members` row.

⚠ **THREE THINGS CARRIED OUT OF THE PHASE — recorded here so they are not re-derived:**

1. ⛔ **MIGRATION COLLISION, now corrected in the ROADMAP.** 231 was reserved **154** and consumed
   **154, 155 AND 156** — so 234's reserved block (155-158) was invalid. **All reservations from 234
   on are shifted +2** (234 → 157-160 · 235 → 161 · 237 → 162 · 239 → 163 · 240 → 164 · 241 → 165;
   the milestone range is now **153-165**). Numbers are monotonic and gaps are NEVER backfilled.
   ⚠ **156 is a HOTFIX**: 155 added `default_ingest_visibility` with no grant and **broke the
   Connections page** — the `connector_connections` column-grant trap firing for the **second** time
   in this repo (migration 118 was the first, granting SELECT column by column). It has a memory
   entry and it still cost a broken page.
2. ⚠ **A ledger cell written mid-phase was falsified by the same phase's own later commit.** The cell
   claimed `retrieval_service.py` byte-unchanged by 231; `46b046c5e` then modified it (+65/-3) for
   TRUST-04. **The reviewer caught it, not the builder.** Corrected to **18 / 10 / 423** in both
   `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` at `b10a7262d`. ⭐ **The rule: write the ledger note
   LAST, or re-derive at the phase's final commit.** ⚠ Its **G-5 extraction stays OWED** — 241 is the
   second landing this milestone; a third must propose the extraction first.
3. ⚠ **Three ROADMAP flags were NOT discharged here, and none is a defect** — each is scope that
   belongs elsewhere: **Pitfall 3** (one `audit_log` row per connection-sourced retrieval hit) has no
   sync to attach to yet, and its own flag says retrofitting makes the first months permanently
   unauditable — **so it must land WITH the first sync, not after it**; **Pitfall 2** (the preview
   stating count and tree) is 233's subject; **`SEED-211`**'s M-Files metadata-derived model was to
   be *decided and recorded with a migration path* and **that decision was not taken** — it carries
   forward.

⚠ **The backend gate read 74, not the 71 `CLAUDE.md` pins.** The diff against the baseline is EMPTY
(15 are pre-existing async rot in `test_retrieval_service.py`, plus the order/GC flake). **That is
`BUS-117`, open on the operator — not a 231 regression.**

### ⚠ `arm-pair.sh` TOLD ONLY THE REVIEWER — FIXED 2026-09-05, and the miss is the finding

**The pairing script posted its role assignment `--to "$REVIEWER"` only.** Arming Phase 232 (builder
**gemini** / reviewer **claude**) therefore put the single bus item in **my** mailbox — so **the
BUILDER was never told on the bus that it was building.** The builder briefing existed only as text
for the operator to paste by hand. **Gemini correctly did nothing**, reported on 231 (the last thing
it had been told to do), and the operator had to ask why it had not started.

⚠ **It survived two phases because the roles happened to line up.** While Gemini always reviewed, the
reviewer *was* the other agent, so a reviewer-only post reached it every time. ⭐ **The bug became
visible in the first phase where Claude reviews — the reciprocal protocol is what exposed it**, which
is an argument for the protocol rather than against it.

✅ **Fixed and DRIVEN, not just edited:** the script now makes **two** posts, each carrying that
side's own instruction — the BUILDER post says *start* (and gates source work on the reviewer
confirming baselines, per AGENTS.md §6.1); the REVIEWER post says *baseline first*. Re-running it for
232 produced **BUS-128 → gemini (BUILDER)** and **BUS-129 → claude (REVIEWER)**, with different text,
and my own watcher fired on BUS-129 — so delivery is proven end-to-end, not assumed. Baseline
confirmation sent as **BUS-130**.

⚠ **A SECOND, UNFIXED PROBLEM THE SAME LOOK EXPOSED — Gemini's mailbox holds 24 OPEN items, the
oldest TEN DAYS.** A new item is one line at the bottom of that list. The bus is designed to go
*loud at 3+ days*; when everything is loud, nothing is. **This is the seeds-register failure one
channel over** — a queue nobody drains stops being a queue. ⛔ **Open on the operator**; neither
agent should unilaterally close another's mail.

### ✅ Phase 232 — The Source Contract + Google Drive CLOSED (2026-09-05)

**Gemini built · Claude REVIEWED BY DRIVING · ✅ PASS on capability.** Report:
`.planning/phases/232-the-source-contract-google-drive/232-VERIFICATION.md`. Range `53bb866e4..1ae6defbb`.

⭐ **The contract was exercised end-to-end through the real registry**, not read: `browse` → browse child
→ `list_files` → `read_file` → `check`, and `SourceRegistry` resolved **both** `mock_source` and `google`
by `service_id` — `SRC-01`'s "a source family is a registration, not a branch" claim actually working.

**Gates:** backend **72 failed / 3567 passed / 0 collection errors** (failures identical to baseline,
**+37 passing**) · tsc **66**, exact · source suites 37 · picker 7/7, pinned in TARGETS **and** BASELINE.
⭐ **The blocking pre-flight finding closed by MEASUREMENT**: deleting `cloud_storage.py` was predicted
to take collection errors 0 → ≥2; all six suites were re-pointed and **4560 tests collect with zero errors.**

⚠ **TWO REVIEWER CORRECTIONS — APPLIED BY THE REVIEWER, OPERATOR-AUTHORISED** (`347abc357`), because the
builder session had gone idle. Both figures re-derived at HEAD, never copied:

1. ⚠⚠ **The `232-03` PARTIAL DISCHARGE claim was FALSIFIED by `232-04`.** `connectors.py` went
   **1736 → 1757** across the phase (`232-03` −28, then `232-04` **+49** for `/browse`) — the file **GREW
   by 21 lines** while its cell read *"✅ PARTIAL DISCHARGE — −28 net L"*. Triple corrected
   `30 / 14 / 1708` → **`32 / 15 / 1757`**; **the G-5 extraction stays OWED.**
   ⭐⭐ **This is Phase 231's OWN recorded finding repeating one phase later** — *write the ledger note
   LAST, or re-derive at the phase's final commit.* **A cell reading `✅ DISCHARGED` stops the next audit.**
2. **`frontend/src/lib/api/connectors.ts` had NO ledger row**, despite being a `232-04` must-have. Added
   at **`11 / 6 / 594`** — absent for its entire life at six phases. ⚠ The plan quoted `10 / 5 / 552`,
   **already stale when it shipped**.

⚠ **Also found: `docs/HOT-FILE-LEDGER.md` carries TWO `## backend/app/api/connectors.py` sections**
(`6 / 3 / 734` and `7 / 3 / 781`), both stale by ~1000 lines. Flagged in place, not merged.

⚠ **`232-04` was committed BY THE REVIEWER** (`1ae6defbb`) after the builder session went idle with the
work finished but uncommitted. **No line was changed**, so review independence holds (AGENTS.md §6.3);
it is disclosed at the top of the verification report rather than left to be found in `git log`.

⛔ **`OD-232-01` — NO LIVE GOOGLE DRIVE HAS EVER BEEN BROWSED.** `SRC-02` is verified STRUCTURALLY only;
the shared-drive claim rests on mocked `/drives` responses. Recorded honestly in `232-VALIDATION.md` §4
as **INFERRED (OWED DRIVE)**. ⚠ Its deadline reads *"before v4.0 closeout **when** live credentials are
available"* — **the second clause is a precondition nobody owns**, which is exactly how Phase 230's SC#2
and SC#3 came to be still owed.

### ⚠ A 232 "BLOCKER" CARRIED IN THE 231 HANDOFF IS MEASURED FALSE (2026-09-05, Claude — reviewer baseline)

The handoff, `231-SUMMARY.md` and a chat answer all carried: *"`connector_connections.capability`
only permits `send_email | create_ticket | post_message`, so 232 must add an inbound capability
before Drive can populate `source_connection_id`."* **I wrote it. It was never run against the
database, and it is wrong.**

`capability` is **NULLABLE** (migration 126), a `CHECK ... IN (...)` **passes on NULL**, and
migration **127 DROPPED** 126's *"one shape or the other"* guard in favour of `shape_is_not_ambiguous`
— which forbids both being SET and **permits both being NULL**. ⭐ **Two `service_id='google'` rows
exist right now** in exactly that shape, alongside a `microsoft` one; `servicesCatalog.ts` gives them
`shape: "oauth"`, a third shape beside capability and MCP.

⭐ **`documents.source_connection_id` can point at a real Google connection today; no migration is
required to represent one.** What is genuinely absent is narrower and is a CONTRACT question, not a
schema one: **nothing on the row declares a connection INBOUND.** ⚠ `SEED-146` warns against
committing the `connector_connections` shape a third time, so a new column would be a **deviation to
raise and an operator decision**. Full derivation:
`.planning/phases/232-the-source-contract-google-drive/232-MEASUREMENTS.md` §2.

⚠ **The lesson is the mechanism, not the fact:** an unmeasured claim was carried into a handoff, a
summary and an answer to the operator. **It is the same shape as this milestone's recurring finding**
— a verdict cell that disagrees with its own evidence cell.

### ⭐ ROLE ASSIGNMENT — reciprocal review (operator-ratified 2026-09-05)

⚠ **Restored 2026-09-05 after a STATE.md rewrite dropped it.** Recording it again rather than
assuming it is remembered — the whole point of the protocol is that it survives a handoff.

**Roles ALTERNATE per phase so the pair can run without the operator present.** Operator instruction:
*"the bars that cannot be autonomous — let Gemini review your work and vice versa."*

| Phase | Builds | Reviews |
|---|---|---|
| **230** — The Durable Ingestion Queue | **Gemini** | **Claude** ✅ done |
| **231** — connection-scoped visibility | **Claude** | **Gemini** ✅ done (PASS, driven) |
| **232** — the source contract + Google Drive | ⚠ **NOT NAMED** — alternation says **Gemini**, unless an AGENTS.md §3.1 trigger fires | **Claude** |

⭐ Not a new rule — `AGENTS.md` §3.1 already required it. **231 is Claude-built by the ratified
criticality test**, hitting three of five triggers: the permission model, a migration that commits a
table shape, and anything that can fail OPEN. Arm a pairing with `bash scripts/arm-pair.sh <phase>
<builder>` (or `/pair` in Claude Code). ⚠ **A pairing is per SESSION as well as per phase** — the bus
watchers die with the session that started them.

⚠ **What role-swapping does NOT delegate:** `CLAUDE.md` says decisions go `--to operator`, never
agent-to-agent. A reviewer approving a builder's decision is not authorisation, it is laundering.

### ⚠ OWED DRIVES against Phase 230 — recorded at its close (operator, 2026-09-05)

**Phase 230 closed with SC#1 and SC#4 DRIVEN and SC#2 / SC#3 TESTED BUT NEVER OBSERVED.** The
operator's decision was to record these rather than hold the phase open. They are written here as
**owed drives with a deadline**, not as a note, because this project's own history is that owed UAT
rows survive whole milestones unrun (`v3.9` closed with 16 owed rows on Phase 217 alone).

| # | The promise | What exists | What has never happened |
|---|---|---|---|
| **SC#2** | *"several hundred files at once and the product stays usable"* | the global `pg_advisory_xact_lock` bound + unit tests | **only 20 files were ever driven.** Nobody has watched a few hundred queue under the cap |
| **SC#3** | *"the person is told the embedding provider failed, **and which one**"* — pause with that refusal on screen, resume on recovery | `test_provider_outage_trips_breaker_and_pauses_queue`, `test_probe_provider_auto_resumes_paused_queue`, and locked Sketch 227 variant B | ⛔ **no live 429 has ever occurred.** The pause banner and the named refusal have never been seen by a human |

⚠ **AND A CONCRETE THING FOR THAT DRIVE TO CHECK, found 2026-09-05 while building 231.**
Phase 230 widened `Document["status"]` with `"paused"` (frontend) and added a `status.paused` term,
and the reviewer had Gemini add a `paused` arm to `segmentState()`. **But nothing writes
`documents.status = 'paused'`** — both `UPDATE documents` sites in `db/ingestion_jobs.py` (`:175`,
`:341`) write `'failed'`, and the backend `DocumentResponse` Literal does not even permit `'paused'`.
**The pause is a JOB-level state, not a document-level one.** So the paused strip arm may be
unreachable, and SC#3's on-screen pause may be carried entirely by the batch lane reading job state.
⭐ **The drive settles it in one observation:** when the queue pauses, does a document row read as
paused anywhere a person looks? If not, either the frontend widening is dead code or a writer is
missing — and only the live drive can say which.

⛔ **SC#3 is the one that matters**, and it is the phase's most user-visible promise: it exists to
close `BUG-260815-05`, where retrieval misreports provider failure and a person is told *"your
documents returned nothing."* **A mechanism nobody has watched refuse is not yet a refusal.**

⭐ **Deadline: before v4.0 closes** — not *"sometime"*. Cheapest honest method: stub the embedding
provider to return 429 for a fixed window and drive one real batch through `/upload`, then watch the
banner appear, the queue pause, and the queue resume when the stub recovers. **Both halves must be
observed — pausing is not the feature, resuming on its own is.**

⚠ Re-open trigger if the deadline slips: **any phase that touches embedding, the ingestion queue, or
provider failure copy** picks these up as UAT rows.

### ⚠ Two gate problems OPEN ON THE OPERATOR — neither belongs to any phase

⚠ **Restored 2026-09-05 after the same rewrite dropped both pointers.** A routed item with no pointer
in `STATE.md` is a deferral with no re-open, which this project's own register rule calls a deletion
that looks like a decision.

- **`BUS-114` — the inherited `IngestionStrip` ordered fence is RED**, and has been since before Phase
  229. `documents.py` carries **7** distinct `ingestion_step` writes; the fence asserts exactly **6**.
  **Consequence: the vitest count gate cannot reach green**, so every phase since has closed against a
  gate that was already failing. ⚠ Root cause of the miss: *"frontend untouched, so the gate cannot be
  affected"* is **unsound here** — that suite imports `backend/app/api/documents.py?raw`.
- **`BUS-117` — the backend unit baseline is NOT deterministic.** Measured 71 and 72 on byte-identical
  trees, by **two independent agents**. The unstable test is
  `test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel`,
  which passes **28/28 in isolation** and fails only in the full suite via an unraisable
  `coroutine 'handle_query_tables' was never awaited` attributed at GC time. ⛔ **`CLAUDE.md` pins the
  ceiling at `failed <= 71` with explicitly zero headroom, so a clean tree can fail the gate** and a
  phase can be blamed for a flake it did not cause. **Needs an operator decision: fix the flake, or
  restate the ceiling as 72** — CLAUDE.md forbids weakening it without authorisation.

### ⚠ `BUG-260905-01` + `SEED-247` — the ingestion doors are INVERTED (operator, 2026-09-05)

Found by the operator driving Phase 229's one visible change. **Three facts, all measured:**

1. **Cloud import lives in the CHAT composer only** (`MessageInput.tsx:363-379` →
   `ConnectedFilePickerModal` at `:633`). There is **no cloud-import entry point in the Library**.
2. **It writes to the Library ROOT and cannot do otherwise** — `connectors.py:1703-1709` calls
   `async_mint_document_row(...)` with **no `folder_id`** and **no `org_id`**, and the modal has **no
   folder picker**. ⚠ **NOT a Phase 229 regression:** 229 preserved the call's existing shape, and before
   229 the route failed outright with `PGRST204`. **229 is what made this reachable enough to notice.**
3. **Chat has NO local-file upload at all** — zero hits for `type="file"` / `Paperclip` / `onDrop` /
   `uploadDocument` in `MessageInput.tsx`. The upload button exists only in the Library
   (`LibraryPage.tsx:555`). **The two doors are exactly inverted.**

⛔ **AND THE DEEPER ONE: a thread-scoped document CANNOT BE EXPRESSED.** `documents` has **no `thread_id`
column**; `workspace_files` is the AGENT's per-thread scratch, not a home for a person's attachment. So
**every ingested file is permanent, user-global and in the Library** — a file dropped into chat while
thinking becomes retrievable by every future question. That is the inbound mirror of the hygiene problem
`SEED-209`/`SEED-210` describe for connectors.

⭐ **Sequencing:** the folder picker + moving import into the Library is **small** and fits **Phase 233**
(the preview phase is already about what enters the Library and where). **`SEED-247` (thread-scoped
attachments) is the larger half** and must not be smuggled into a phase that has not scoped it. ⚠ Its
retrieval-scope question touches **the same four RLS sites Phase 231 is about to write** — cheap to allow
for there, expensive afterwards, exactly like department access.

### ⭐ Phase 231 must consider DEPARTMENT-LEVEL ACCESS (operator, 2026-09-05)

**Direction:** *"consider … one big company needs to manage its knowledge base with different access
needs, different departments, different types of documents."* Nested organisations are **explicitly
de-prioritised** — one flat company org, departments inside it.

✅ **Nested orgs were never built, so nothing needs unwinding:** `organizations` has **no `parent_id`**.
`departments` **does** have `parent_id`, so sub-departments are already tree-capable.

⚠ **BUT DEPARTMENTS ARE A PLACEHOLDER, NOT A FEATURE — measured live 2026-09-05:**

| | |
|---|---|
| tables carrying `org_id` | **46** |
| tables carrying `dept_id` | **1** — `dept_members` itself |
| `dept_members` rows | **0** |
| departments with a `parent_id` | **0** |
| department API routes | **none exist** |

`dept-admin` is a real role with exactly one permission (`dept:manage`) and **nothing dept-scoped to
manage**. So today the product has exactly **TWO** access levels: *mine*, and *everyone in the org's*
(via `folder_is_org_shared()`, which walks the folder tree). There is no *"Finance can see this, Legal
cannot."*

⚠ **Also measured:** every user is auto-provisioned their OWN org (`create_org_with_default_dept`, the
migration-105 personal-org backfill) — 26 users, 26 member orgs, 26 org-admins. So "org" today means
*one person's private space*, not *a company*. Multi-org membership IS supported
(`current_user_org_ids()` returns a SETOF).

⭐ **WHY THIS BINDS PHASE 231 SPECIFICALLY.** 231 writes the visibility predicate at **four RLS sites**
(the `documents` and `document_chunks` policies plus the BODIES of `match_document_chunks` and
`keyword_search_chunks`). A second scope added after that predicate is set is a **re-ingest, not a
migration** — the identical logic `SEED-210` records for source ACLs. **231 does not have to BUILD
department access; it has to not FORECLOSE it.**

⚠ Note the collision already found at Phase 229 pre-flight (G-1): the flat `folders.is_org_shared`
column and the recursive `folder_is_org_shared()` function are **two definitions of one word**. 231 owns
resolving that too — adding a department dimension on top of an unresolved org-shared predicate would
compound it.



### Phase 230 — preconditions VERIFIED before briefing (2026-09-05, Claude)

Measured so the plan set does not re-derive them:

- **Migration `153` is FREE** — highest existing is `152_audit_log_connector_action_types…`. Gaps at
  130-139 / 142-149 must NEVER be backfilled.
- **The claim pattern to copy EXISTS and is running** — `backend/app/db/schedules.py:307` uses
  `FOR UPDATE SKIP LOCKED` in an explicit transaction (documented at `:271`). Copy the shape for a second
  table with a different claim key. **No broker, no new process.**
- **`backend/app/services/circuit_breaker.py` EXISTS** — `CircuitBreaker` (`:86`),
  `CircuitBreakerTrippedError` (`:63`). `QUEUE-05` trips this; do not write a second breaker.
- ⛔ **`embed_texts` really does send everything in ONE request** — `openai_service.py:2129` passes
  `input=texts` with no chunking at all. `SEED-197` confirmed by reading. That is `QUEUE-04`'s subject.
- ✅ **Clean baseline for restart-survival testing:** **77 completed** documents and **ZERO** in
  `pending` / `processing` / `extracting` / `failed`. **Any stuck row after this phase is genuinely its own.**

### ✅ Phase 229 VERIFIED (2026-09-05, Claude — DRIVEN, not read)

**Verdict: PASS, no corrections owed.** All seven pre-flight gaps closed as asked.

⭐ **The two that mattered were proven at RUNTIME:**
- **SC#1** — `mint_document_row` called against the real DB **INSERTED** the row PostgREST used to refuse
  with `PGRST204`: `file_path` set, `status='pending'`, `content_hash` written, `version_number=1`,
  `is_latest=True`. **The connector import is genuinely fixed.**
- **G-2** — same bytes minted twice, the second inside the still-`pending` window with
  `on_conflict="link"`, returned `is_duplicate=True` **and the same row id** — the exact race that
  previously raised 409 and recorded the attachment as *failed*. Probe rows cleaned up.

✅ **Re-ran independently:** backend **70 failed / 3508 passed / 0 errors** — **one FEWER failure than the
71 baseline and +11 passing** · Phase 229's suites **16/16** · CLAUDE.md **107,413** chars · frontend
**untouched** (`git diff --numstat`), so the vitest gate cannot be affected — deliberately not run rather
than skipped.

⭐ **THE STRUCTURAL CHECK PASSED** — the one the pre-flight named as this phase's failure mode:
**the extraction is REAL.** `documents.py` retains no `dedup_query`, no `existing_versions` block, no
`hashlib.sha256`; **every `is_latest` line in the diff is a DELETION.** There is no second door.

**Gaps verified individually:** G-1 the widening is GONE (no `is_org_shared` in `ingest_splice.py`;
folder check is `select("id, user_id")`; deferred to 231; **`TM-229-01` corrected so the threat model no
longer describes a widening as a mitigation**) · G-2 disposition in the SIGNATURE, default `"raise"` so
`/upload` keeps its 409 · G-3 sequence pinned · G-4 timestamps omitted, minted dict field-for-field
identical to `/upload`'s 11 keys · G-5 four chunk sites audited · G-6 email route named
(`POST /documents/upload`, `message/rfc822`) and pinned by a test · G-7 triple **re-derived live**
(`75 / 32 / 2408`), CLAUDE.md + `docs/HOT-FILE-LEDGER.md` in the SAME commit (`ba3010ffc`).

⚠ **Two observations, neither a defect, neither needing action:**
1. **Two writers of `is_latest` disagree on scope.** `mint_document_row` retires siblings by
   `(user_id, filename)` — USER-scoped, correctly matching the old upload path. The **restore-version**
   endpoint (`documents.py:882-892`) retires by `(user_id, filename, folder_id)` — FOLDER-scoped. Both
   **predate 229 and neither was changed by it.** Recorded so it is not re-derived: *restoring* a version
   and *uploading* a version disagree about what a sibling is.
2. The `-127 lines from 2535` delta in `229-VERIFICATION.md` measures against the **stale** ledger cell;
   the true prior figure was **2562**, so the real reduction is **154**. The current `2408` is correct and
   independently confirmed — only the delta's baseline is off.

### Phase 229 — pre-planning obligation DISCHARGED (2026-09-05, Claude)

The roadmap required *"Drive `import_connection_file` ONCE before planning — the schema mismatch is
verified but the runtime error mode is not, and *'this route currently does nothing'* is an ASSUMPTION
until it is driven."* **Driven.** The exact `doc_row` dict from `connectors.py:1705-1716` was replayed
through the real `supabase-py` client:

```
PGRST204 — "Could not find the 'storage_path' column of 'documents' in the schema cache"
```

⭐ **PostgREST rejects at the FIRST unknown key**, so the `file_path NOT NULL` violation (`23502`) is
**never reached** — the two candidate error modes were not equally likely, and it is the column one.
Because `aexec` raises at `:1718`, `background_tasks.add_task(_upload_pipeline, ...)` at `:1722`
**never runs**. ✅ **CONFIRMED: ATTACH-01 has never imported a single file; the caller gets a 500.**
So Phase 229's SC#1 is a real user-visible fix, not a theoretical one. **Gemini must not re-derive this.**

### Phase 228 verification (2026-09-04, Claude — RE-RUN, not read)

✅ **Re-ran independently:** backend baseline **71 failed / 3497 passed / 0 collection errors** ·
`test_228_oauth_redis_resilience.py` + `test_228_cap_paused_reconcile.py` **11/11** · `tsc` **66 errors**
(matches the claim exactly) · `check-deploy-drift.sh` **PASS, 0 drift** · `vercel.json`'s
negative-lookahead host guard correctly prevents the redirect loop · all three new suites pinned in
**both** TARGETS and BASELINE.

⭐ **Pre-flight G-2 was resolved correctly, and it was the call that mattered.** The `runStatus` unions
were **NOT** widened (`models/message.py:108`, `types/index.ts:171` byte-unchanged); the Phase 092 mount
reconcile instead gained an `else if (state.cap_paused)` branch at `ChatArea.tsx:167-180` and
`StreamsProvider.tsx:2065-2078`. That deleted G-1 and avoided a second source of truth.
✅ **No migration was needed** — `runs_status_check` already permits `'cap_paused'`.

✅ **BOTH CORRECTIONS APPLIED by Gemini at `7199fc144`, verified by the reviewer** — kept below as the record of what was wrong and why, because *the verdict cell disagreeing with its own evidence cell* is a failure mode worth recognising again:

1. ✅ **FIXED — `DEBT-03` now reads ⛔ BLOCKED** (frontmatter `status: passed_with_blocked`, `score: 4 passed / 1 blocked`). It had been marked ✅ PASS. Its requirement is *"`/code-review ultra
   review-base-225` runs"* — **it did not run**, and no agent can launch it. The frontmatter
   (`independent_verifier_absent_for`) and the evidence cell both say operator-blocked; only the verdict
   cell and the headline `5/5` disagree. This is exactly what pre-flight **G-4** warned about. Score is
   **4 passed / 1 blocked**, and the credits trigger stands.
2. ✅ **FIXED — the gate row now reads `0 failing (single sample)`** with a SEED-171 note naming the reviewer's three failures and their byte-unchanged evidence (`228-VERIFICATION.md:201,206,210`). The original claim was `0 failing` as a property. Reviewer re-ran on the same tree:
   **`failed 3`, total 7434** — same total, same pins. Filenames taken from the gate's persisted JSON
   **before** any re-run: `WorkflowBuilderPage.session.test.tsx` (`AssertionError: expected 1 to be +0`
   — the assertion `SEED-171` records **verbatim**) and `WorkflowsPage.test.tsx` ×2 (`STACK_TRACE_ERROR`).
   All sit in SEED-171's five cap-independent flaky suites; `git diff --numstat 7a5207dfd^..HEAD` shows
   both **byte-unchanged by this phase**. Recorded as **provably unmodified — never as "fine"**.

✅ **RECORDED in `228-VERIFICATION.md:136` as an Honesty Disclosure** — the cap_paused reconcile has never executed against real data. The dev DB holds **ZERO**
`cap_paused` rows (measured: completed 1274 / failed 161 / cancelled 56 / timed_out 7 / streaming 1).
The G-9 serializer test proves the wire contract; **no end-to-end run has actually cap-paused.**

⛔ **`BUG-260904-05` filed (major).** A cap-paused **Deep** run disables the composer —
`ChatArea.tsx:102` makes lock PRESENCE the disable (`MessageInput.tsx:339`, placeholder *"Workflow
running — Cancel to switch back"*) — and once continues are exhausted `MessageItem` renders *"Start a
new message to keep going"* directly above that disabled composer. **The UI instructs an action it
forbids.** Pre-existing on the live SSE path (`StreamsProvider.tsx:994-1002`); **Phase 228 removed the
reload that used to escape it, which is the fix working.** Not a revert — the lock is the wrong
instrument for a Deep pause.

### Roadmap facts (2026-09-04)

- **14 phases, 228-241.** Migrations reserved **153-163**, monotonic; gaps 130-139 / 142-149 NEVER backfilled.
- ⚠ **The requirement count is 38, not the 34 quoted at intake** (33 feature + 5 DEBT). `REQUIREMENTS.md`
  Traceability is filled and mechanically verified: **38 rows, 0 duplicates, 0 orphans**. A coverage check
  run against the wrong denominator is exactly how `LIB-08/09/10` survived a milestone living only in a heading.
- ⭐ **Phase 234 retires the CLAUDE.md manual-upload-only rule IN THE SAME COMMIT** (`SEED-142`), and carries a
  **MANDATORY threat model**. **Phase 231 also carries a MANDATORY threat model.**
- ⚠ **`DEBT-04`** (`app.<domain>`, `SEED-242`) is gated on an operator production push and **MAY BE DRIVEN OUT
  OF ORDER** — record it against 228 wherever it lands, never re-scope it.
- ⚠ **`SURF-03` has no home surface in this product.** Decision owed at 235's discuss-phase; recommendation is
  app-shell signal + Health-tab row. **Closing it against the Health tab alone does NOT satisfy it** — that is
  still a page you have to open.
- ⚠ **Ledger row OWED for `backend/app/services/scheduler_service.py`** (measures **5/2/399**, no row today) in
  234's commit — `LIB-08` binds the whole watch loop to it, so G-5 cannot fire on it at any count.
  **G-5 extraction OWED on `retrieval_service.py`** (fires at 231 *and* 241; a third landing must propose the
  extraction first).
- ⚠ **G-5 triples were re-derived from git at roadmapping and 8 of 12 had DRIFTED** — e.g. `documents.py`
  measured `73/30/2562` against a cell reading `72/30/2535`. Re-derive, never read the cell.

### ✅ D-5 DECIDED (operator, 2026-09-05) — the INERT DEPARTMENT DIMENSION

**Answer: build the visibility predicate WITH a department dimension that is present but inert.**

- The predicate takes a scope that today resolves to **`mine | org`**; the **`dept` branch is written
  and defaults to org-wide** until `dept_members` has rows.
- **Nothing changes behaviourally.** No new access level ships, no UI, no third state a user can see.
- ⭐ **Why now:** a second scope added *after* the predicate is set is a **re-ingest, not a migration**
  — the operator's own recorded reason, and the same logic `SEED-210` applies to source ACLs. Cheap
  this week, expensive the first time a real tenant asks for *"Finance can see this, Legal cannot."*
- ⚠ **The fence:** *inert* means inert. 231 must not ship a department **UI**, a department **grant
  path**, or any behaviour that differs from today's two levels. If a plan finds itself building
  `dept_members` management, that is a different phase and it has not been scoped.
- ⚠ 231 still owns resolving the `folders.is_org_shared` **column** vs `folder_is_org_shared()`
  **function** collision (G-1 at Phase 229 pre-flight) — a department dimension layered on an
  unresolved org-shared predicate compounds two ambiguities into one.

### Open decisions owed at discuss-phase

| Phase | Decision |
|---|---|
| **233** | ⭐ **Where an imported file LANDS — `BUG-260905-01`.** Cloud import currently sits in the CHAT composer and writes to the Library **root** with no folder picker; chat has **no local upload at all**. The two doors are inverted. The folder picker + moving import into the Library is 233's natural subject. |
| **231** | ⭐ **DEPARTMENT-LEVEL ACCESS — operator direction 2026-09-05: *"keep department access in mind for phase 231."*** See the note below. |
| 235 | `SURF-03`'s home surface (three options tabled; recommendation app-shell signal + Health-tab row) |
| 240 | Confirm-or-flip the message-vs-thread boundary — D-3 decided it, but two research files disagree |
| 241 | Verify local↔cloud pgvector parity LIVE before `hnsw.iterative_scan` is planned as the `SEED-076` remedy |

### The milestone in one sentence

The knowledge base stops depending on somebody remembering to upload — a source is connected
**once**, previewed before it brings anything in, and then watched on the **shipped** scheduler,
safely and at a customer's scale.

### Scope decisions taken at intake (2026-09-04, operator) — binding

| Decision | Answer |
|---|---|
| `SEED-210` permission fork | ⭐ **Option 3 — connection-scoped visibility**, stated plainly in the UI. `SEED-211`'s metadata-derived (M-Files) model is **DECIDED AND RECORDED with a migration path, NOT BUILT**. Satisfies "210 and 211 must be decided together" while capping the access-control surface. |
| Source families | **All four IN** — Google Drive (proven OAuth) · OneDrive/SharePoint (Graph) · any MCP file surface · email/mailbox. |
| `SEED-212` transcripts | **OUT**, trigger intact — event-shaped, a source *shape* not a source *provider*. |
| v3.9 debt | **Gets its own closeout phase, first** — not a bullet in this file, which is exactly how it survived the last close. |
| Version | **v4.0**, not v3.10 — this retires a standing architectural rule and introduces the inbound permission model. |

### ⚠ Binding constraints — carry these into every phase of this milestone

- ⭐ **A watched source must be DATA, not code.** One generic `list → read → hash → splice` contract
  with Drive / Graph / MCP / mail as **thin adapters**. If each source family grows its own ingest
  path, this is four milestones wearing one name. (The v3.9 lesson — *adding a service adds rows,
  not code* — applied inbound.)
- ⚠ **THIS MILESTONE RETIRES A STANDING `CLAUDE.md` RULE.** *"Ingestion is manual file upload only
  — no connectors or automated pipelines"* is marked *dated, not permanent*, and must change **in
  the same commit** as the first sync connector (`SEED-142`). ⭐ **That same commit retires the
  reason ownership-based RLS was adequate** — until now every document was deliberately placed by a
  person who could already read it. `SEED-210` records that the rule was load-bearing for security
  in a way its own wording never claimed.
- ⚠ **Threat model MANDATORY** on the sync phase — untrusted external content enters the corpus the
  agent answers from, plus a new credential scope.
- ⚠ **The screen says "checked every N minutes"** — never *"instantly"* or *"on change"*. No delta
  cursor, no webhook. When one lands, the sentence changes in the same commit.
- ⚠ **A file removed at the source is NOT removed from the Library** unless explicitly asked for. A
  revoked share must never silently delete knowledge the agent depends on.
- ⚠ **Write and delete grants are OFF by default** — inherit Phase 213's approval model, invent nothing.
- ✅ **`LIB-08` / `LIB-09` / `LIB-10` ARE NOW IN `REQUIREMENTS.md`** (done 2026-09-04) — they had never
  existed outside a roadmap heading, and a requirement that lives only in a heading is invisible to every
  coverage check. Same gap as `LIB-05..07`. ⚠ **`LIB-09` was AMENDED** at scoping: four buckets, not three
  (D-1). The constraint is kept here rather than deleted because the *class* of failure recurs.

### ⚠ Known shape-risk — stated at intake, then SOFTENED by measurement (original kept)

**Stated at intake:** *"Email is a second SHAPE smuggled in as a fourth provider. Drive, OneDrive and
MCP-file are one shape — a file with a path and a hash. A mailbox is threads, quoting, and
attachments-as-children, with no stable document boundary."*

⭐ **MEASURED, AND THE WARNING WAS OVER-STATED ABOUT THE CODE (D-3).** ~80% already ships:
`strip_quoted_replies()` runs before chunking; attachments-as-children ship with caps; Gmail and Graph
both land on one `parse_eml_bytes()`. PITFALLS independently confirms the manifestation is
**dedup/retrieval poisoning, not a broken adapter** — and the tool that prevents it already exists, so
the risk is failing to ROUTE the sync path through it.

**What survives the softening:** mail is still sequenced **LAST** (Phase 240) with its own
discuss-phase, and the document boundary is a real decision — **one message = one document, `thread_key`
groups** (D-3). ⚠ Two research files disagreed on that boundary; **240 must confirm or flip it**, not
inherit it silently.

### Seeds folded (18)

| Group | Seeds | Why it fires |
|---|---|---|
| Carried foundation | `209` `210` `211` `142` | Deferred WITH Phase 219 at the v3.9 close; their re-open trigger is this milestone's SC#1. |
| Ingest at scale | `077` `197` `076` `048` | ⭐ `076` and `077` each name *"the next milestone"* as their hard prerequisite **in their own text**. Ingestion is an in-process `BackgroundTask` with no queue/cap/retry/resume; `embed_texts` sends every chunk in ONE request; embeddings are hardwired to OpenAI with no fallback. |
| Inbound is untrusted | `188` `079` `072` | `188`: four modules carry a written anti-injection discipline and **nothing tries to break it**. `072`: "source disconnected → retain, freeze or purge" is `SEED-210`'s own undecided policy row. |
| One rule engine | `243` | The deferred phase text: the folder-watch rules and `243`'s classification surface *"should be designed together rather than growing two rule engines."* |
| Loop reliability + surface | `014` `239` `060` `224` | SC#1 requires the **shipped** scheduler (`014`). `239`: ONE malformed `config` makes EVERY connection in the org unreadable — fatal to a background watcher. |
| Riding the closeout phase | `213` `242` | `213` shipped at 216 and is unaffected. `242` is the `app.<domain>` move, armed for the next production push. |

**Deferred with triggers intact:** `SEED-212` (transcripts — re-open on any transcription connector,
or a "what was decided in the meeting" query) · `SEED-013` / `SEED-195` (inbound / Open Platform —
its own milestone) · `SEED-211`'s **BUILD** (re-open when connection-scoped visibility is measured
insufficient by a real tenant).

## ⛔ Inherited from v3.9 — the closeout phase owns these

Full narrative: `.planning/milestones/v3.9-STATE-at-close.md`. Condensed so nothing is lost:

- **Owed verification.** Phase 210: 4 of 5 SC never driven (`CONN-10` / `CONN-11` are structurally
  undrivable on this install). Phase 211: UAT rows + schema regeneration. Phase 214: SC#10's
  eight-row cross-provider roster, the other three SC#10 axes, and **eight G-4 operator drives**.
  Phase 217: **16 UAT rows**. Phase 225: `/code-review ultra review-base-225`, skipped on credits —
  **re-open trigger: credits available before the v3.9 production push.**
- **Three requirements are narrower than their wording:** `CAT-05` (the cloud half of
  Add-a-connection was never verified), `GRANT-03` (the pause names the tool and arguments but never
  the service), `CHAT-06` (the armed connector set is stored nowhere; F5 silently disarms it).
- ⚠ **`SEED-242` armed** — the product moves to `app.<domain>` at the next production push; seven
  steps across Vercel / Coolify / Supabase Auth / CORS. **Verify on a preview before promoting.**
- ⚠ **25 reported bugs open on `surface: Agentic-RAG`** (`STATE.md` said 23 at the close; re-counted
  2026-09-04). Six are probably ONE root cause in the resume path — see the table below.
- ✅ **The backend unit baseline WAS re-derived, and the claim recorded here was WRONG — kept, not
  overwritten.** This bullet asserted *"reads **95 failed / 3394 passed / 2 errors**; the `71` quoted
  all through v3.9 was measured over a different set."* **Measured 2026-09-04 at Phase 228 pre-flight**
  (main working tree, quiet, verdict line read verbatim):
  `backend/venv/Scripts/pytest.exe tests/unit -q --continue-on-collection-errors` →
  **`71 failed, 3497 passed, 2 xfailed, 2 xpassed, 35 warnings in 77.75s`, ZERO collection errors.**
  ⭐ **The `71` reproduces exactly** — the missing `ezdxf` / `reportlab` have since been installed, so
  the two collection errors are gone. Phase 228's plan `228-01` was RIGHT and this file was stale.
  ⚠ At `failed <= 71` against a measured `71` the gate has **ZERO headroom** by design. Nothing failing
  names oauth, connector, mcp or chat.

### Chat run-lifecycle findings — still open, still unrouted

Filed 2026-08-18 out of Phase 197 and **never folded into any phase**. Carried because they are one
control in one moment and must be triaged together:

| id | finding | status |
|---|---|---|
| `BUG-260818-01` | **Resume replays the original prompt** instead of continuing. ⚠ The thread CONTEXT is not lost — the label and the mechanism disagree. | open · major |
| `BUG-260818-02` | **Resume drops the thread's selected model** — `sendMessage` forwards `opts.model`/`opts.provider`; `resumeFromFailed` passes neither. | open · major |
| `BUG-260818-03` | At the 15-iteration cap the chat shows a stop. ⚠ **The Continue feature ALREADY EXISTS and did not render** — a live-SSE gate with no fetch reconcile, which is D-v2.5-03 exactly. | open · major |

⚠ **TRIAGE 01/02/03 TOGETHER** — a user today cannot tell Resume from Continue, and fixing one
leaves the moment still lying. `BUG-260823-02/03/04` are the probable same cluster.

## Register integrity — found during the v4.0 intake sweep

⚠ **Three seed IDs are COLLISIONS — two different ideas share each one**, so one of each pair is
invisible to any `grep SEED-NNN`:

| id | the two ideas sharing it |
|---|---|
| `SEED-228` | *"A workflow cannot say the whole library, on purpose"* **and** *"read_doc on a .docx id returns a bare FAILED_PRECONDITION"* |
| `SEED-229` | *"Does the golden run hang on an armed approval checkpoint?"* **and** *"Five suites run by the count gate and guarded by nothing"* |
| `SEED-231` | *"The BLOCKING decision-coverage gate is blind to every decision id this repo has written"* **and** *"Nobody is told an approval is waiting"* |

(`SEED-022` / `SEED-092` also duplicate, but those are intentional `-remainder` splits.) Fixing is a
`/gsd:fast` — renumber the later-planted member of each pair and update `related_seeds` back-refs.

⚠ **The seeds register is swept by NOTHING executable.** `grep -rln "SEED" .claude/commands/gsd/`
returns `capture.md` only — the command that WRITES seeds. **250 seeds exist, 144 still `planted`.**
CLAUDE.md carries a MANDATORY sweep rule; it is honoured by the orchestrator, not by code. This
milestone's sweep was done by hand on 2026-09-04.

## Deferred Items

Acknowledged and deferred at the v3.9 close (`gsd-sdk query audit-open` → **47 open items**). None is
engineering; the verification debt above is the part that matters. Full table:
`.planning/milestones/v3.9-STATE-at-close.md` → *Deferred Items*.

| Category | Count | Detail |
|---|---|---|
| quick_tasks | 28 | 27 `missing` + 1 `unknown` — historical records whose files no longer exist |
| seeds | 14 | all `dormant`: 003, 004, 040, 041, 042, 043, 045, 046, 084, 127, 163, 164, 165, 166 |
| todos | 1 | `spike-nl-workflow-authoring.md` — largely satisfied by the Phase 097 spike answer |
| uat_gaps | 2 | 214 (`unknown`), 217 (`awaiting-operator`) |
| verification_gaps | 2 | 214 (`gaps_found`), 217 (`human_needed`) |
| debug_sessions / threads / context_questions | 0 | clear |

## Guardrail overrides

Cleared at the v4.0 start. The v3.9 overrides (including the Phase 225 `AGENTS.md` §3.1 seat
reassignment) are preserved verbatim in `.planning/milestones/v3.9-STATE-at-close.md` →
*Guardrail overrides*. Record every new override here, per the CLAUDE.md orchestrator protocol.

## Accumulated Context

Cleared at the v4.0 start. The decision log lives in `.planning/PROJECT.md` (`## Key Decisions`);
the pre-reset snapshot is `.planning/milestones/v3.9-STATE-at-close.md`. Open items carried forward
are the ones listed above under *Inherited from v3.9* — nothing else survives the reset silently.
