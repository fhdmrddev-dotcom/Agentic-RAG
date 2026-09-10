# Phase 235: The Source Says What It Did - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A watched source becomes **legible**. Three things become true that are not true today:

1. Every run a source has made is visible on the source itself — when it ran, how many files were
   added / skipped / failed, and the reason for each failure in words a person can act on (`SURF-02`).
2. A source that has stopped reading **says so**, says when it last succeeded, and offers **one**
   control that fixes *that* cause. It is never silently quiet (`LIB-10`).
3. That fact reaches a person who is **not** on the sources screen (`SURF-03`), and does not cry wolf
   for a healthy source or a single transient blip the next check recovered from.

**Requirements:** `LIB-10`, `SURF-02`, `SURF-03`.

**In scope:** the `connector_sync_runs` table and its writer; the run-history surface on the watch
card; the stopped-reading state + its per-cause control; an app-shell signal and the server verdict
behind it; a Sources section in the Library Health tab listing only what needs attention; the
instance-level "the reader is switched off" statement; the three-part honesty fix for the Sync
button (`BUG-260906-02`); a per-row projection boundary so one bad connection degrades one source
(`SEED-239`).

**Out of scope:** email/system mailer (option C — deferred, trigger recorded below); wiring any
second notification producer such as pending approvals (`SEED-231`); changing the watch loop's
reading behaviour; the rules engine (Phase 237); retention policy beyond this table's own bound
(`SEED-250`).

</domain>

<decisions>
## Implementation Decisions

### SURF-03's home — the forced scoping decision

- **D-235-01:** `SURF-03` is carried by **option B + option A**: a persistent app-shell signal
  visible on any page, **plus** the detail in the Library Health tab. Option A alone was explicitly
  rejected — the Health tab is still a page a person must open, so closing `SURF-03` against it
  would close it against its own sentence.
- **D-235-02:** **Option C (email on permanent failure) is DEFERRED, not dropped.** Named re-open
  trigger: **either** a customer reports learning about a dead watch from a stale answer, **or** the
  product gains an app-owned mailer for any other reason (`SEED-231`'s approval notifications being
  the likeliest). Two independent triggers so it cannot be orphaned by whichever arrives first.
  This trigger is recorded on `SEED-231`, which is already the register for every "the user should
  be told X".
- **D-235-03:** The shell signal is built as a **general-purpose surface with exactly one tenant**.
  It renders a list of actionable app-level conditions; Phase 235 registers **one** producer (a
  broken source). ⚠ Registering a second producer in this phase is scope creep and is forbidden —
  the seam exists so `SEED-231` can plug in later **without a second surface**. Building a
  watch-only badge was rejected because the next notification need would then grow a sibling
  surface, which is the two-paths-one-outcome shape this codebase has shipped five times.
- **D-235-04:** The signal is a **badge on the Library rail item** (`NavPanel`'s `RailItem`, which
  must work at both 58px collapsed and 210px expanded), opening a small popover that names the
  broken source; the popover's one action navigates to the Library **Health** tab. A persistent top
  banner was rejected — it reflows every page and its dismissibility re-opens SC#4. ⚠ The app has
  **no router** (`SEED-185`); navigation is a `useState<ActiveView>` switch in `App.tsx`, so the
  popover action must go through `onNavigate`, not a URL.
- **D-235-05:** The badge reads a **server-computed health verdict** from one lightweight polled
  endpoint that has **already applied the threshold** (D-235-10). The debounce rule lives in exactly
  one place so the badge, the Health row and the source card can never disagree. Client-side
  derivation was rejected for that reason. Realtime may be added as a *hint* only, never as the
  source of truth, and always with a fetch reconcile on connect (`D-v2.5-03`).

### What a "run" is, and what it counts

- **D-235-06:** The **watch loop writes its own run row**. `WatchService.sync_watch` already computes
  `{new, modified, renamed, missing, restored, errors}` and currently **logs it and discards it**
  (`watch_service.py:~436`); migration **172** gives that dict a home. One INSERT into
  `connector_sync_runs` at `release_watch` time, written by the one piece of code that knows what
  the tick did.
  - ⛔ **Deriving from `ingestion_jobs` was rejected** — `BUG-260906-03` measured that table
    incomplete (2 of 5 completed documents had no job row; counting jobs would have undercounted
    one batch by 40%). **This choice deliberately demotes `BUG-260906-03` from a blocker to an
    observability debt**, and that demotion is the decision — not an inheritance.
  - ⛔ Deriving from `connector_watch_items` was rejected — it records current state, not history.
- **D-235-07:** **Every tick gets a row**, zero-count ticks included. This is what makes "when did it
  last successfully READ" answerable, which is distinct from "when did it last CHANGE anything" —
  the exact confusion that let a dead watch look fine. The UI collapses consecutive quiet runs into
  one line (e.g. *"checked 14 times, no changes"*), so density is a rendering concern, not a
  storage one.
- **D-235-08:** **Retention: keep the most recent N runs per watch (~200), pruned on write.** No
  scheduled job, no new daemon; bounded per-tenant by construction. `N` is a settings knob, not a
  constant, so `SEED-250` (retention & archival) can govern it centrally later without this table
  having invented its own policy.
- **D-235-09:** Failure copy follows **`frontend/src/components/library/ingestionErrorVocabulary.ts`'s
  pattern** in a **new sibling module for source failures** — a strict zero-import leaf under the
  same five binding rules (a sentence is presentation never a rule; no severity word; no
  exclamation; no mechanism; em-dash asserted by codepoint), including its **honest fallback that
  never invents a cause** and its pass-through gated on *positive proof of plainness*. Reusing the
  existing module directly was rejected: its table is written for upload/extraction failures, and
  source failures (token expired, folder unshared, rate limited, listing incomplete) would nearly
  all hit the fallback — correct but useless.

### When a source is "stopped", and the one control

- **D-235-10:** **Cause-dependent promotion to `stopped`.** A cause the next tick **cannot** recover
  from — token revoked/expired, folder unshared or deleted, connection removed — is stopped on the
  **first** failure. A cause that **might** recover — timeout, 5xx, rate limit — needs **3
  consecutive** failures. A uniform N-failure rule was rejected: at a 6-hour cadence it would keep a
  definitively-dead token silent for 18 hours. ⚠ The hard/soft classifier is also what option C will
  need when its trigger fires, so it is built as data, not as an inline branch.
- **D-235-11:** **Cause → one named control, table-driven** (the mapping is **data** in the
  vocabulary leaf, never branches in the card):
  - token expired / revoked → **Reconnect {connection name}**
  - folder unshared / deleted / not found → **Pick a different folder**
  - reader switched off → an **operator-facing sentence naming the setting**, not a button a member
    can press
  - unknown / transient → **Retry now**

  "Always Reconnect" was rejected — an OAuth dance cannot fix an unshared folder. "Always Retry" was
  rejected — SC#2's word is *fixes*, and Retry does not fix a revoked token.
- **D-235-12:** `watch_process_enabled = false` is an **instance-level condition with its own
  surface**, shown **once** — not the same red state repeated on every watch card. Per-watch cards
  stay honest (*"waiting — the reader is off"*) without each claiming to be individually broken.
  **Rule: the banner owns platform-wide truth; the row owns only what is true of that row.** The
  same slot is intended to carry the next instance-level truth (queue worker off, embedder
  unreachable) without inventing a second banner. ⚠ Marking every watch stopped was rejected: the
  rail badge would then count N broken sources when nothing is wrong with any of them.
- **D-235-13:** **`SEED-239` folds in as a per-row projection boundary plus a named degraded row.**
  Every row that fails to project is caught individually; the list renders every healthy source and
  shows the broken one as a **degraded row saying the app could not read *it*** — never an error
  page, and never a silent omission (a source that vanishes from its own list is the definition of
  the silence `LIB-10` forbids). This is testable by planting a malformed `config` row, and it is
  the same boundary shape `list_connections` itself needs when `SEED-239` is fixed at its root.

### The Sync button's honesty (`BUG-260906-02`)

- **D-235-14:** **All three parts are in scope.** (1) Refuse when the reader is off and say why —
  the cause is configuration, not the folder. (2) Render the **outcome** (`last_run_at` /
  `last_status` / counts) instead of the request — *"Checked 4 minutes ago · 6 files"* replaces
  *"scheduled"*. (3) Show a pending state between click and tick (`SEED-248`).
- **D-235-15:** ⛔ **BINDING CONSTRAINT — do NOT make the endpoint sync inline.** The scheduler poke
  is deliberately safe across multiple uvicorn workers; an inline Drive listing in a request handler
  would hold a web worker for the length of the listing and re-open the concurrency problem
  `claim_due_watches` was built to solve.
- **D-235-16:** The pending state says **"Asked · next check within N"**, derived from `next_run_at`
  and the poll interval, flipping to the real outcome when `last_run_at` advances past the click.
  A bare spinner was rejected (up to 60s of spinner reads as a hang and implies work is happening
  now); an optimistic *"Checking now…"* was rejected as a politer version of the same overclaim
  this bug is about.

### Where each surface lives

- **D-235-17:** **The run history renders on the source card** — inline expansion on the watch card
  in the Library **Ingestion** tab (`WatchedFoldersSection`), because SC#1's sentence is *"a person
  opens a **source**"*. The Library **Health** tab gets a **Sources signal section listing only
  sources that need attention**, each row deep-linking to that card. Division of labour:
  **Ingestion = every source and everything it did; Health = only what is wrong.** The rail badge
  routes to Health, and Health routes to the card. Rendering the full history in both places was
  rejected — two homes for one truth, even with a shared component.

### Sequencing

- **D-235-18:** **`BUG-260906-01` is fixed via `/gsd:quick` BEFORE `/gsd:plan-phase 235`.** It is a
  located extraction: move the rule-evaluation block out of `ingest_document`
  (`backend/app/api/documents.py:2385-2396`) into `backend/app/services/ingest_enrich.py` beside the
  metadata step, and call it from both paths. ⚠ **The test that ships with it is an AGREEMENT test
  in `backend/tests/unit/test_ingest_enrich_shared.py`, never a second per-path test** — five
  defects of this shape have now shipped past suites where both paths had tests and none asserted
  they agree. ⚠ `run_in_threadpool` around `enrich_for_ingest` is load-bearing (it calls
  `asyncio.run` internally). Carrying it as a plan inside 235 was rejected: a backend ingestion
  extraction inside a surface phase widens the review, and the G-2 sketch has nothing to say about it.
- **D-235-19:** **G-2 is honoured, not overridden.** `/gsd:sketch` runs before `/gsd:plan-phase 235`
  and must settle **all four surfaces together**: (a) the run-history list including quiet-run
  collapsing, (b) the stopped-reading card with its one control, (c) the rail badge + its popover,
  (d) the instance-level reader-off statement. They are sketched together because *"reaches a
  person"* and *"does not train you to ignore it"* are judgements only a live mockup settles, and
  because the four must not shout over each other.

### Corrections this phase must not inherit

- **D-235-20:** ⚠ **The migration number is 172, not 161.** ROADMAP's Phase 235 detail block says
  `161_connector_sync_runs.sql`; the Phase Table says `172`. Phase 234 consumed **168–171**, and
  migrations are monotonic from 153, so **`172_connector_sync_runs.sql` is correct and the detail
  block is stale**. Apply it by pasting into the Supabase SQL editor — never `supabase db push` /
  `db reset` — then regenerate with `bash scripts/regenerate-full-schema.sh` (no `--reset`).
- **D-235-21:** ⚠ **A capability behind a flag defaulting to off has not shipped — it has been
  written.** Phase 234 passed every gate across 5 waves and 38 backend tests while being incapable
  of running in the operator's process. **This phase's verification must state which value the
  operator's environment actually holds for every process-level flag it depends on — measured, never
  assumed from the default.**

### Claude's Discretion

- Exact column set and indexes on `connector_sync_runs` (the counts dict is the content; shape is
  the planner's call).
- The precise `N` for retention (~200) and the settings-key name.
- The endpoint path and payload for the health verdict.
- Poll interval for the shell signal.
- Whether the degraded-row boundary is a `try/except` per row in the service or a per-row model
  fallback — either satisfies D-235-13.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §"Phase 235: The Source Says What It Did" (line ~475) — goal, 4 success
  criteria, flags, "How we'd know this failed". ⚠ Its migration number is stale (see D-235-20).
- `.planning/ROADMAP.md` §"SURF-03 has no home in this product" (lines 210-231) — the three
  cost-ordered options A/B/C and the recommendation this phase acted on.
- `.planning/REQUIREMENTS.md` — `LIB-10` (line 46), `SURF-02` / `SURF-03` (lines 96-97), and the
  requirement→phase table rows (lines 152, 181-182).
- `.planning/ROADMAP.md` lines 100-140 — the corrections block, including the "fix `BUG-260906-01`
  before Phase 235" instruction (line 119) and the migration-monotonicity rule (correction 5).

### The defects routed into this phase
- `.planning/reported-bugs/watch-sync-button-reports-success-for-work-that-cannot-happen.md`
  (`BUG-260906-02`) — the Sync-button honesty fix, its three parts, and the ⛔ do-not-sync-inline
  constraint. **Read in full before touching `sources.py`.**
- `.planning/reported-bugs/completed-document-with-no-ingestion-job-row.md` (`BUG-260906-03`) —
  why `ingestion_jobs` cannot be the counting source of truth.
- `.planning/reported-bugs/classification-never-runs-on-the-queue-ingest-path.md`
  (`BUG-260906-01`) — the pre-phase fix and its agreement-test requirement.

### Seeds folded or referenced
- `.planning/seeds/SEED-239-*.md` — the per-row blast radius; the measured incident where one
  malformed `config` key made all nine connections unreadable (503).
- `.planning/seeds/SEED-248-a-surface-that-is-still-loading-must-say-so.md` — the pending-state
  rule, and the measured table of which surfaces already do this correctly.
- `.planning/seeds/SEED-231-nobody-is-told-an-approval-is-waiting.md` — **the notification
  register**. D-235-02's re-open trigger is recorded here; D-235-03's seam exists for it.
- `.planning/seeds/SEED-185-the-app-has-no-router-twelve-views-zero-addressable.md` — why the
  popover navigates via `onNavigate`, not a URL.
- `.planning/seeds/SEED-250-retention-and-archival-is-the-one-absent-dms-capability.md` — why
  D-235-08's bound is a knob, not a constant.

### Phase 234's record (this phase's foundation)
- `.planning/phases/234-the-watch-loop-the-library-reads-by-itself/234-VERIFICATION.md` — the
  drive that found the disabled flag; the four findings; what is *unexercised* vs *failed*.
- `.planning/STATE.md` §"Phase 234 — CLOSED 2026-09-06" — D-235-21's lesson in full.

### Standing project rules that bind this phase
- `CLAUDE.md` §Rules — migration discipline (SQL editor, never `db push`), RLS on every table,
  `run_in_threadpool` around blocking Supabase calls in async handlers (`D-v2.5-01`), Realtime is a
  hint not truth (`D-v2.5-03`).
- `CLAUDE.md` §"Workflow guardrails" — G-2 (sketch first, MANDATORY here), G-5 hot-file ledger.
- `docs/HOT-FILE-LEDGER.md` — sections for `LibraryPage.tsx`, `DocumentList.tsx`,
  `useDocuments.ts`, `IngestionTab.tsx`, `WatchedFoldersSection.tsx`, `api/sources.py`,
  `watch_service.py`, `db/watches.py`, `knowledge_health.py`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets — the counts already exist and are thrown away
- `backend/app/services/watch_service.py` `sync_watch` (~:119-440) computes
  `counts = {new, modified, renamed, missing, restored, errors}`, logs it at :436, releases the
  watch at :434 with `release_watch(..., status="success")`, and **returns it to a caller that
  discards it**. ⭐ **Migration 172's entire job is to stop discarding this.** The insert belongs
  next to `release_watch`, on both the success and failure arms.
- `backend/app/db/watches.py` — the DAL leaf; `claim_due_watches` (SKIP LOCKED), `release_watch`,
  `update_item_state`, `get_watch_items`. The run-row insert and the prune belong here, not in the
  service.
- `supabase/migrations/168_connector_watches.sql` — `connector_watches` **already carries**
  `last_run_at`, `last_status`, `last_error`, `interval_minutes`, `next_run_at`, `leased_until`,
  `is_active`. `last_status` values documented in the column COMMENT: `success`, `failed`,
  `running`, `skipped_still_running`, `partial`. ⚠ The frontend also checks for `"disconnected"`
  (`WatchedFoldersSection.tsx:210`), which is **not** in that COMMENT — reconcile before adding a
  sixth value.
- `supabase/migrations/169_connector_watch_items.sql` — per-file truth already exists: `state` in
  `{present, missing, unauthorized, skipped_type, skipped_size, failed}`, plus `last_error`,
  `source_version`, `content_hash`, `document_id`. **The per-file failure reason is already stored**;
  D-235-09's vocabulary maps it, it does not invent it.
- `frontend/src/components/library/ingestionErrorVocabulary.ts` — the pattern D-235-09 copies:
  five binding rules, `looksHumanWritten` positive-proof pass-through, an honest fallback, ZERO
  imports, and a test (`ingestionFailureCopy.test.ts`) pinned against the backend's **live source**
  rather than a copy of its table. Do the same for source failures.
- `frontend/src/components/layout/NavPanel.tsx:100-175` — `RailItem` in a rail that is **58px
  collapsed / 210px expanded**; nav entries come from the shared `frontend/src/lib/nav-items.ts`
  (`NAV_ITEMS`), filtered by effective features. The badge slot belongs on `RailItem`, generically.
- `frontend/src/components/library/HealthTab.tsx` — the fifth Library tab; composition is
  coverage ring → stat tiles → signal chips → per-document bars, with lazy `Suspense` sections.
  The Sources signal section mounts here as a **sibling**, honouring G-5 by construction.
- `frontend/src/components/library/IngestionTab.tsx` — already mounts `WatchedFoldersSection`
  beside `ConnectedSourceSection`. The history expansion lands inside the watch card.
- `frontend/src/components/sources/WatchedFoldersSection.tsx` — already renders `last_status`
  (:272-285), `last_error` (:371-373), the disconnect banner (:210-212) and the SURF-01 invariant
  copy `checked every {interval_minutes} minutes` (:305). ⚠ **That sentence is a pinned invariant
  from 234 — do not reword it.**
- `backend/app/api/knowledge_health.py` — 8 GET routes under a health router; the verdict endpoint
  can live beside them or under `/sources`. Note it reads with the service role by exception.

### Established patterns that constrain this phase
- **Vocabulary leaves.** `ingestionErrorVocabulary.ts`, `publishRefusalVocabulary.ts`,
  `previewVocabulary.ts` — presentation-only, zero imports, nothing branches on the text.
  D-235-11's cause→control map is data in such a leaf.
- **Realtime is a hint (`D-v2.5-03`).** `useDocuments.ts` reconciles by fetch. Any Realtime on the
  badge must reconcile the same way.
- **`run_in_threadpool` (`D-v2.5-01`).** `watch_service.py` already wraps its Supabase calls; the
  run-row insert must too.
- **The vitest count gate has TWO knobs.** `TARGETS` decides what RUNS; `BASELINE` decides what is
  GUARDED. ⚠ `src/components/sources` is **not** a TARGETS directory entry (measured at 233), so a
  new suite there runs only if pinned — pin every new file in the same commit.
- **`GSD_VITEST_MAX_WORKERS=2`**, run from the repo root.

### Integration points
- `WatchService.sync_watch` → `connector_sync_runs` INSERT + prune (D-235-06/07/08).
- `backend/app/api/sources.py:262-296` → the Sync endpoint's refusal + outcome vocabulary (D-235-14).
- A new health-verdict endpoint → the shell badge (D-235-05).
- `NavPanel` `RailItem` → badge slot → popover → `onNavigate("documents")` + Health tab (D-235-04).
- `HealthTab` → Sources signal section → deep-link back to the Ingestion tab's watch card (D-235-17).
- `main.py:570` / `config.py:1203` → the instance-level reader-off statement's source of truth
  (D-235-12) — the surface must read the **live** value, not a client assumption.

### G-5 hot-file status (re-derive before planning — cells rot)
- `frontend/src/pages/LibraryPage.tsx` — FIRES; honoured by construction (a tab body is a child).
- `frontend/src/components/ingestion/DocumentList.tsx` — FIRES; ⚠ its **7-column order is
  load-bearing** (`LibraryPage` sheds cols 3-5 by `nth-child`). This phase should not need it.
- `frontend/src/hooks/useDocuments.ts` — FIRES; ⚠ also `SEED-248`'s named gap (no loading flag).
- `frontend/src/components/library/IngestionTab.tsx` — FIRES (4 phases); honoured by construction.
- `backend/app/api/sources.py`, `backend/app/services/watch_service.py`,
  `backend/app/db/watches.py`, `frontend/src/components/sources/WatchedFoldersSection.tsx` — all
  young (0-1 phases) with ledger rows added at 234. **Update their rows and their
  `docs/HOT-FILE-LEDGER.md` sections in the SAME commit** (same-commit sync rule).

</code_context>

<specifics>
## Specific Ideas

- *"Checked 4 minutes ago · 6 files"* is the honest replacement for *"scheduled"* — named in
  `BUG-260906-02`'s own fix shape and adopted verbatim as the target sentence.
- *"Asked · next check within N"* — the pending state, said as a request rather than as work in
  progress.
- *"checked every N minutes"* — the pinned `SURF-01` invariant from 234; unchanged.
- Quiet runs collapse to one line: *"checked 14 times, no changes"* — density is rendering, not
  storage.
- The division that decides tab placement, stated as a rule so it scales: **Ingestion = every source
  and everything it did; Health = only what is wrong.**
- The rule that decides the reader-off placement, likewise: **the banner owns platform-wide truth;
  the row owns only what is true of that row.**

</specifics>

<deferred>
## Deferred Ideas

- **Option C — email on permanent failure (`SURF-03`).** Deferred with the named two-part trigger in
  D-235-02, recorded on `SEED-231`. ⚠ Not "done", not dropped.
- **Registering a second notification producer** (pending approvals, `SEED-231`; loading honesty,
  `SEED-248`) into the shell surface built here. The seam is built; the tenant is not. Trigger:
  the first phase that owns one of those producers.
- **`BUG-260906-03` (a completed document with no `ingestion_jobs` row).** Demoted by D-235-06 from
  a blocker to an **observability debt** — this phase counts from its own run rows, so the job
  table's incompleteness no longer corrupts the history. It remains open and its `folded_into`
  stays `null`; the re-open trigger is any future retry / resume / audit / cost-attribution feature
  built on `ingestion_jobs`.
- **`SEED-239`'s root fix** (`connector_service.list_connections` validating inside a list
  comprehension). This phase folds in only its **observable** half — the per-row boundary and the
  degraded row (D-235-13). The service-side fix stays with the seed.
- **`SEED-252` — metadata-driven filing** (many rules contributing; the file actually moved). Its
  plumbing half is `BUG-260906-01` (D-235-18); its design half stays a seed for Phase 237's rule
  engine.
- **`SEED-046` — Library Health dashboard enrichment.** A Sources signal section is added here for
  `SURF-03` only; the broader enrichment stays dormant.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — matched at 0.6 on the generic keywords *phases / run /
  trigger*. **False positive**: it concerns NL→workflow authoring, which shares no surface, table
  or requirement with this phase. Not folded.

</deferred>

---

*Phase: 235-The Source Says What It Did*
*Context gathered: 2026-09-06*
