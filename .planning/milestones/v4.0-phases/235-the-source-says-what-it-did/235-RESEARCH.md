# Phase 235: The Source Says What It Did — Research

**Researched:** 2026-09-06
**Domain:** Existing-codebase measurement (watch run history · stopped-source state · app-shell signal)
**Confidence:** HIGH — every file:line below was read in this session; every gate figure was RUN in this session.

---

## Summary

This is a **measurement report, not a literature review.** Nothing this phase needs is new
technology. Every integration point already exists in the tree, and the value of this document is
that the planner does not have to re-derive any of it — and, more importantly, that **eleven claims
inherited from CONTEXT.md, the BUILD-CONTRACT and CLAUDE.md were measured FALSE or STALE** and are
corrected below rather than carried forward.

The three biggest measured facts: (1) `WATCH_PROCESS_ENABLED=true` in the operator's real
`backend/.env` **right now** — D-235-21's obligation is discharged with a measured value, and it is
the opposite of the default; (2) the frontend count gate reads **7544 / 6814 / 227 files / 0
failing**, not CLAUDE.md's `6355 / 5266 / 120`; (3) the backend unit baseline reads **72 failed**
against CLAUDE.md's ceiling of **71** — the tree is already one over the gate **before this phase
starts**, and the overage is pre-existing (234-VERIFICATION measured the same 72 on the merge base).

**Primary recommendation:** Write the run row from `db/watches.py` over the **asyncpg pool** (not
Supabase — `watches.py` never touches the Supabase client, so CONTEXT.md's `run_in_threadpool`
instruction does not apply there), insert at **four** `release_watch` call sites (not two), derive
the consecutive-failure count **from `connector_sync_runs` itself** rather than adding a counter
column, and put the health-verdict endpoint in **`api/sources.py`**, not `knowledge_health.py` —
because `connector_watches` has a working `authenticated` SELECT policy and does not need
`knowledge_health.py`'s service-role carve-out.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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
- **D-235-17:** **The run history renders on the source card** — inline expansion on the watch card
  in the Library **Ingestion** tab (`WatchedFoldersSection`), because SC#1's sentence is *"a person
  opens a **source**"*. The Library **Health** tab gets a **Sources signal section listing only
  sources that need attention**, each row deep-linking to that card. Division of labour:
  **Ingestion = every source and everything it did; Health = only what is wrong.** The rail badge
  routes to Health, and Health routes to the card. Rendering the full history in both places was
  rejected — two homes for one truth, even with a shared component.
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

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LIB-10** | A source that has stopped reading **says so**, says **when** it stopped, and offers **the one action** that fixes it. It is never silently quiet. | §3 (`last_status` enumeration reconciled — measured), §6 (the four `release_watch` sites that must classify a cause), §13 (consecutive-failure derivation), §9 (`sourceHealthVocabulary.ts` shape + the cause→control map as data) |
| **SURF-02** | A person can see what a sync **actually did** — a per-source run history with counts and errors. | §1 (the `counts` dict, measured, discarded at `watch_service.py:439`), §2 (`db/watches.py` insert idiom), §5 (migration 172 shape), §7 (`WatchedFoldersSection` composition + where the expansion attaches) |
| **SURF-03** | A broken watch reaches a person who is not already looking at the page. ⚠ There is no in-app notification surface. | §8 (`RailItem` badge slot, measured — pure presentational, 1 prop), §10 (the Library tab is INTERNAL state — an external caller **cannot** open the Health tab today; §10.3 names exactly what must change), §4 (the verdict endpoint's home, with a reason) |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

These bind the plan and the plan-checker must verify them:

| Directive | Where it lands in this phase |
|---|---|
| **Migrations via the Supabase SQL editor — never `db push` / `db reset`**; filename `<digits>_name.sql`; then `bash scripts/regenerate-full-schema.sh` (no `--reset`), never hand-edit `full-schema.sql` | `172_connector_sync_runs.sql`. D-235-20 is confirmed correct — see §5. |
| **RLS on every table** — users only see their own data | `connector_sync_runs` copies migration 168's Shape A policy idiom **verbatim** (§5.3) |
| **No blocking I/O inside async handlers** — wrap with `run_in_threadpool` (D-v2.5-01) | ⚠ **Applies to the Supabase client only.** `db/watches.py` uses **asyncpg** exclusively — see Correction C-2. |
| **Realtime is a hint, not truth** — reconcile via fetch on (re)connect (D-v2.5-03) | The badge is a **poll** (D-235-05). If Realtime is added it must fetch-reconcile. |
| **Settings live in `user_settings`/`app_settings`; env vars are for secrets and infra only** | The retention `N` knob — §5.5 recommends `config.py` with a stated reason and a `SEED-250` note. |
| **The vitest count gate has TWO knobs** (`TARGETS` runs, `BASELINE` guards) | §10 gives the exact file:line of both, and the measured verdict line. |
| **`GSD_VITEST_MAX_WORKERS=2`, run from the repo root** | Used for the measurement in §10. |
| **Backend unit gate: `pytest tests/unit -q --continue-on-collection-errors`, ceiling 71 failed** | ⚠ **MEASURED 72** — see Correction C-1. |
| **Worktrees ENABLED** — `bash scripts/bootstrap-worktree.sh "$(pwd)"` is the executor's FIRST action; never `rm -rf` a worktree | Every plan in this phase. |
| **Hot-file ledger same-commit sync rule** — a row here and its section in `docs/HOT-FILE-LEDGER.md` update in the SAME commit | §14 — **five rows are stale and four files have NO row at all**. |
| **`check-deploy-drift.sh`** — an env var the app reads must update `deploy/onebox.env.example` in the same commit | Only if §5.5 puts the retention knob in `config.py`. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Writing a run row for every tick | **Database / DAL** (`db/watches.py`, asyncpg) | Watch service (calls it) | The DAL is the ONE data-access home for `connector_*`; the service knows *what* the tick did, the DAL knows *how* to store it (`db/watches.py:1-13` docstring states this contract) |
| Pruning to N runs per watch | **Database / DAL** — same statement as the insert | — | D-235-08 says "pruned on write"; a second round-trip is a second failure mode |
| Classifying a failure into hard/soft cause | **API / Backend service** — a new data leaf under `services/sources/` | — | D-235-10 says it is DATA, not an inline branch; it is also what option C needs later |
| Applying the "3 consecutive soft failures" threshold | **API / Backend** (the verdict endpoint) | — | D-235-05: the debounce lives in exactly ONE place so badge/Health/card cannot disagree |
| Rendering the run history + quiet-run collapsing | **Browser / Client** (`WatchedFoldersSection`) | — | D-235-07: density is rendering, never storage |
| The rail badge + popover | **Browser / Client** (`NavPanel` → `RailItem`) | — | Presentational; the server already applied the threshold |
| Navigating badge → Health tab | **Browser / Client** (`App.tsx` `useState<ActiveView>` + a NEW `LibraryPage` prop) | — | There is no router (`SEED-185`); §10.3 measures what must change |
| The instance-level "reader is off" statement | **API / Backend** (live `app.state.watch_service`), rendered by client | — | Correction C-4: the *config flag* is not the same fact as *the loop is running* |
| Per-row degraded projection boundary | **API / Backend** (`sources.py` `_enrich_watch_rows` / response model) | Client renders the degraded row | SEED-239's blast radius is created by a server-side list projection, so the boundary belongs there |

---

## ⭐ Corrections — things measured FALSE or STALE

These are the most valuable output of this research. Each is a claim the planner would otherwise
have inherited.

### C-1 · The backend unit baseline is **72 failed**, not 71 — the gate is already breached

**Measured this session**, `backend/` with the venv, verbatim tail line:

```
72 failed, 3785 passed, 2 xfailed, 2 xpassed, 42 warnings in 116.50s (0:01:56)
```

`grep -c FAILED` = **72**; **no collection-error line**. CLAUDE.md's rule states the milestone locks
the baseline at *"71 failed, 3497 passed, 2 xfailed, 2 xpassed (0 collection errors)"* with **zero
headroom**. So the tree is **one over the ceiling before Phase 235 writes a line**, and the passed
count has grown by 288.

⚠ **This is pre-existing, not attributable to anything Phase 235 will do.**
`234-VERIFICATION.md` measured **72 failed / 3781 passed** on the merge base and recorded it as
*"1 over the stale 71 ceiling, pre-existing (BUS-117 class)"*. My reading is 4 passes higher, which
is consistent with the `/gsd:quick` fix for `BUG-260906-01` (`test_ingest_enrich_shared.py` now
exists — verified) landing between.

**Planner obligation:** state **72** as the phase's starting baseline in every plan's verification
block, so a plan cannot be red-flagged for an inherited failure — and raise the ceiling question to
the operator rather than silently re-pinning it. `[VERIFIED: measured in session]`

### C-2 · `db/watches.py` uses **asyncpg only** — `run_in_threadpool` does not apply there

CONTEXT.md §"Established patterns" says *"`run_in_threadpool` (D-v2.5-01). `watch_service.py`
already wraps its Supabase calls; the run-row insert must too."*

**Measured:** `backend/app/db/watches.py` imports `asyncpg` (`:20`) and **nothing else** — no
`supabase`, no `run_in_threadpool`. Every function is `async with pool.acquire() as con: await
con.fetchrow(...)`. The Supabase client appears in `watch_service.py` only (for `documents`,
`connector_connections`, and storage), and *those* are correctly wrapped.

**So:** the run-row INSERT belongs in `db/watches.py` as a plain `await con.execute(...)` — it is
already non-blocking. Adding `run_in_threadpool` there would be wrong. `[VERIFIED: read in session]`

### C-3 · `sync_watch` has **four** `release_watch` sites, not two — and one writes an undocumented status

CONTEXT.md D-235-06 says *"The insert belongs next to `release_watch`, on both the success and
failure arms."* There are **four**:

| # | file:line | status written | notes |
|---|---|---|---|
| 1 | `watch_service.py:115` | `"failed"` | in `tick()`, the per-watch `except` — **outside `sync_watch` entirely**. A plan that only edits `sync_watch` misses this arm and loses every crash-shaped failure from the history. |
| 2 | `watch_service.py:143` | `"paused"` | connection disabled. ⚠ `"paused"` is **NOT** in migration 168's `last_status` COMMENT. |
| 3 | `watch_service.py:434` | `"success"` | the happy path, immediately before the discard at `:435-438` |
| 4 | `watch_service.py:458` | `"failed"` | `_handle_unauthorized_watch`, the VIS-04 403 arm — the one that carries the `token_revoked`/`folder_gone` evidence |

⭐ **Recommended shape:** move the run-row write **inside `release_watch` itself** in
`db/watches.py`, taking the counts + cause as optional kwargs. Then all four arms get a row by
construction and no future fifth arm can forget. This is the same "one home" rule D-235-17 applies
to the surface. `[VERIFIED: read in session]`

### C-4 · The config flag is not the same fact as "the reader is running"

CONTEXT.md's integration point says *"`main.py:570` / `config.py:1203` → the instance-level
reader-off statement's source of truth."*

**Measured:** `main.py:571` gates the start on `settings.watch_process_enabled`, but `:587-589` is a
`try/except Exception: logger.exception(...); _watch_service = None` — **a failed start is swallowed
and the flag still reads `true`.** `:591` then sets `app_instance.state.watch_service = _watch_service`.

**So the honest source of truth is `request.app.state.watch_service is not None`, not the setting.**
Reading the setting alone would reproduce, one level up, the exact class of overclaim
`BUG-260906-02` is about. `[VERIFIED: read in session, `main.py:568-591`]`

### C-5 · `WATCH_PROCESS_ENABLED` — MEASURED `true` in the operator's real `backend/.env`

D-235-21 requires this be measured. `backend/.env` is deny-listed to direct reads; measured by
reading **only** keys matching `WATCH_*` / `QUEUE_*` via the venv python:

```
SANDBOX_ENABLED=true
WATCH_PROCESS_ENABLED=true
```

| Knob | `config.py` default | `.env.example` | **Operator's live `backend/.env`** |
|---|---|---|---|
| `watch_process_enabled` | `False` (`config.py:1203`) | `WATCH_PROCESS_ENABLED=false` (`:326`) | ⭐ **`true`** — set by the 234 verification session |
| `watch_poll_interval_seconds` | `60` (`config.py:1205`) | `WATCH_POLL_INTERVAL_SECONDS=60` (`:327`) | **absent → default 60s applies** |
| `watch_lease_seconds` | `600` (`config.py:1207`) | not present | **absent → default 600s applies** |

⚠ **The operator's box is the exception, not the rule.** `deploy/onebox.env.example:267` still ships
`false`, so any fresh deployment has the reader OFF — which is exactly why D-235-12's instance-level
statement is load-bearing rather than decorative. `[VERIFIED: measured in session]`

### C-6 · The `last_status` enumeration is wrong in **three** places, and none of them is authoritative

CONTEXT.md asks this be reconciled. Measured:

| Value | Migration 168 COMMENT (`:65-66`) | Written by production code? | Read by the frontend? |
|---|---|---|---|
| `running` | ✅ | ✅ `db/watches.py:238` (claim) | ✅ `WatchedFoldersSection.tsx:272` → "Syncing" |
| `success` | ✅ | ✅ `watch_service.py:434` | ⛔ no branch — falls to the `else` "Active" |
| `failed` | ✅ | ✅ `watch_service.py:115`, `:458` | ✅ `:274` → "Error" |
| `partial` | ✅ | ⛔ **never written** | ⛔ |
| `skipped_still_running` | ✅ | ⛔ **never written** — `record_skipped_still_running` is imported at `watch_service.py:32` and **called nowhere**; only `tests/unit/db/test_watches_db.py:191` calls it | ⛔ |
| `paused` | ⛔ **absent** | ✅ `watch_service.py:143` | ⛔ no branch |
| `disconnected` | ⛔ absent | ⛔ **never written** | ✅ `WatchedFoldersSection.tsx:210` — **a dead branch** |
| `completed` | ⛔ absent | ⛔ never written | ⛔ — but it is the **test fixture's** value (`WatchedFoldersSection.test.tsx:60`), so the shipped suite exercises a status that cannot exist |
| `pending` | ⛔ absent | ⚠ **synthesised at READ time**, never stored: `sources.py:84-85` sets `record["last_status"] = "pending"` when the column is falsy | ✅ falls to `else` |

**Which is authoritative?** ⛔ **Neither, today.** The COMMENT documents two values nothing writes
and omits one value production does write; the frontend branches on two values nothing writes. The
honest answer for the planner:

> **The CODE is authoritative for what exists; the COMMENT is authoritative for intent; and Phase
> 235 must make them agree in the same commit.** Recommended reconciliation: a `CHECK` constraint is
> **deliberately NOT** added (`connector_watches.last_status` is free `text` today, and a constraint
> would make an unanticipated status a 500 in a background loop). Instead: update the COMMENT to the
> measured set `{running, success, failed, paused}` plus whatever 235 adds, delete the dead
> `disconnected` branch, and either call `record_skipped_still_running` or delete it and its COMMENT
> entry. `[VERIFIED: read in session]`

⚠ `WatchedFoldersSection.tsx:210-212` is not *entirely* dead: the `last_error.includes("disconnected"|"revoked")`
arms **do** fire, because `watch_service.py:458` writes `f"Source access unauthorized: {exc}"`. So
the banner is reachable **by substring-sniffing a free-text error** — precisely the mechanism
D-235-10's data-driven classifier replaces.

### C-7 · The word **"scheduled"** also lives in the FRONTEND, not only the backend response

BUILD-CONTRACT §4 forbids the word anywhere. Measured occurrences:

- `backend/app/api/sources.py:293-294` — `status="scheduled"` + `"...scheduled for immediate sync."`
- `frontend/src/components/sources/WatchedFoldersSection.tsx:78` — `setFeedbackMessage(\`Sync scheduled for ${watch.source_folder_name}.\`)`

A plan that only fixes the endpoint leaves the invariant broken on screen. `[VERIFIED: grep + read]`

### C-8 · BUILD-CONTRACT §2's per-screen block lists are an **artifact of an unscoped emitter** — and the sketch's own code says so

The four A-variant §2 lists ("Ingestion tab", "Health tab", "Reader switched off", "Badge popover —
variant A") are **byte-identical, all 104 entries**, including 12 `source-card`s inside the "Health
tab" list. That is not a design statement.

**Cause, measured in `drive.cjs`:** `--emit` at `:394` calls the **unscoped** `blocks(h)` /
`actions(h)` over the whole rendered page. The same file, at `:355-361`, carries this warning about
exactly that:

> *"⚠ SCOPE EVERY COUNT TO ITS REGION. Both tab bodies live in the DOM at once (only `.on` is
> displayed) … an unscoped `blocks()`/`actions()` over a whole page counts the OTHER tab's controls
> and TWELVE cards' run rows. Three assertions passed against the wrong region before this helper
> existed; scoping is not tidiness, it is correctness."*

The emitter has a `region(h, blk)` helper (`:356-362`) and **does not use it in `--emit`**.

**What in §2 IS load-bearing and must be honoured:**
1. The **distinct block-kind set** — 20 names, verified against `index.html` directly:
   `rail-item · rail-item-library · badge · popover · pop-item · instance-statement · tab-ingestion ·
   tab-health · body-ingestion · body-health · source-card · source-line · outcome ·
   stopped-sentence · history · run · quiet-fold · fail-reason · attention-list · attention-row`
2. The **per-card ordering**: `source-card` → `outcome` → [`stopped-sentence`] → `history` → `run`* / `quiet-fold` / `fail-reason`
3. The **variant-B fork** (§2, the only list that differs): healthy source = `source-line`, stopped/degraded = `source-card`
4. **"Counts that must hold"** — this block IS per-screen-scoped and is correct as emitted.

**Planner action:** either (a) fix `--emit` to use `region()` and regenerate, or (b) treat §2 as the
distinct-set + ordering contract above and say so in the plan. **Do not transcribe the 104-entry
list into a test.** `[VERIFIED: read drive.cjs:334-448 and index.html in session]`

### C-9 · The build contract says `data-block`; the shipped house convention says `data-testid` and forbids `data-block` in the build

BUILD-CONTRACT §2: *"Every entry is a `data-block` the React build must emit under the same name."*

`frontend/src/components/library/__tests__/sketchComposition.test.tsx:33-38` — the **shipped**
217.1 precedent for this exact kind of fence — says the opposite:

> *"`data-testid="<screen>-<block-kind>"` … `data-testid` is the house convention at ~1500
> occurrences … ⚠ `data-block` is the SKETCH's marker and **must never appear in the build**."*

**Recommendation: follow the shipped convention** — the build emits
`data-testid="sources-source-card"`, `data-testid="sources-run"`, etc.; the sketch keeps
`data-block`; the suite maps one to the other exactly as `sketchComposition.test.tsx:hook()` does.
Contradicting a 1500-occurrence house convention on the strength of one generated sentence is the
wrong trade. **Record the deviation from the literal contract wording in the plan.**
`[VERIFIED: read both in session]`

### C-10 · `--emit` writes **no JSON companion** — there is nothing for a suite to import

`sketchComposition.test.tsx:22-31` imports `../__generated__/sketchComposition.json`, written by
sketch 218's `drive.cjs --emit`, and explains why: *"Hand-listing the blocks here would reintroduce
exactly the staleness the emitter exists to prevent."*

**Measured:** sketch 233's `drive.cjs --emit` (`:447`) writes **only** `BUILD-CONTRACT.generated.md`.
There is no `.json`, and `ls .planning/sketches/233-the-source-says-what-it-did/` shows four files:
`BUILD-CONTRACT.generated.md`, `drive.cjs`, `index.html`, `README.md`.

**Planner action (Wave 0):** add a `--emit-json` arm to `drive.cjs` writing a **region-scoped**
`sourceComposition.json` into `frontend/src/components/sources/__generated__/`, following 217.1's
in-package-copy rule (⚠ *not* a `?raw` reach into `.planning/sketches/`, which
`/gsd:complete-milestone` archives). This is ~20 lines and it is what makes the composition fence
non-transcribed. `[VERIFIED: read in session]`

### C-11 · §1's COPY table is **incomplete** and §1b's sentences are **fixture-specialised**

The emitted §1 table lists 18 keys. The sketch's `COPY` object (`index.html:309-390`) has **27**.
Missing from the table, and all needed by the build:

`degradedAction` = `"Report this source"` · `popTitle` = `"Needs attention"` ·
`popOpenHealth` = `"Open Library health"` · `goToSource` = `"Go to source"` ·
`roster(total, need)` = `"{total} connected, {need} need you"` · `syncNow` = `"Sync now"` ·
`history` = `"History"` · `hideHistory` = `"Hide history"` · `collapse` = `"Collapse"`

⚠ **And §1b bakes the fixture's connection name into the sentence.** `COPY.cause.token_revoked.says`
is literally *"Access to **Legal SharePoint** was withdrawn — …"* and `.action` is *"Reconnect
**Legal SharePoint**"*. In the build these MUST be **functions of the connection name**, exactly like
`cadence(m)` and `badgeTitle(n)` already are. Porting them as constants would ship a hardcoded
fixture name to every customer. `[VERIFIED: read index.html:309-390 in session]`

### C-12 · Migration 168 documents `last_status`, but there is **no consecutive-failure counter anywhere**

Answering the direct question in §13 below: `connector_watches` (mig 168) has **no** failure-count
column, and neither does `connector_watch_items` (mig 169). It must be added, or derived. §13
recommends derivation and says why.

---

## 1 · `backend/app/services/watch_service.py` — the counts dict (458 lines)

### 1.1 The counts dict, exactly

`watch_service.py:203`:

```python
counts = {"new": 0, "modified": 0, "renamed": 0, "missing": 0, "restored": 0, "errors": 0}
```

Six integer keys, flat, no nesting. Incremented at:

| key | line | condition |
|---|---|---|
| `new` | `:281` | a file with no existing `connector_watch_items` row — after mint + (upload + enqueue, unless `mint_res.is_duplicate`) |
| `restored` | `:290` | an existing item whose `state` was `missing` or `unauthorized` and is now present |
| `modified` | `:342` | `item.modified_at != existing.source_version`, both non-empty |
| `renamed` | `:346` | `item.name != existing.name` — the `elif` arm of the modified check, so **a file cannot be both** in one tick |
| `errors` | `:368` | the per-item `except`; the loop `continue`s |
| `missing` | `:423` | **only** inside the `else` of `if not listing.complete` (`:415`) — the H-5 / SRC-06 structural guard |

⭐ **`listing.complete` is a fact the run row must carry.** A tick with `complete=False` produced a
*deliberately suppressed* `missing` count (`:417-420` logs it), and a history that renders `0 missing`
for such a tick without saying the listing was incomplete would be the Onyx-#1161 lie one layer up.
**Recommend a `listing_complete boolean` column on `connector_sync_runs`.**

### 1.2 Where it is logged and discarded

`watch_service.py:435-439`:

```python
logger.info(
    "Watch %s sync complete: %d new, %d modified, %d renamed, %d missing, %d restored, %d errors",
    watch_id, counts["new"], counts["modified"], counts["renamed"], counts["missing"], counts["restored"], counts["errors"],
)
return {"status": "success", "counts": counts}
```

The return value goes to `tick()` at `:111` (`await self.sync_watch(watch)`) whose result is
**not assigned to anything**. Confirmed: `processed += 1` on the next line. The dict dies there.
`[VERIFIED: read in session]`

### 1.3 The success and failure arms around `release_watch`

See **Correction C-3** — there are four, and one of them (`:115`) is in `tick()`, not `sync_watch`.

Two additional early returns that write **no** run row today and would still write none if the
insert is placed only at `:434`:
- `:144` — `return {"status": "paused", "reason": "Connection disabled"}` (after `release_watch(status="paused")`)
- `:196` — `return {"status": "unauthorized", ...}` (after `_handle_unauthorized_watch` → `release_watch(status="failed")`)

### 1.4 How errors are classified today

**They are not.** The only classification is a substring sniff at `:192-193`:

```python
err_str = str(list_exc).lower()
if "403" in err_str or "permission" in err_str or "unauthorized" in err_str:
```

Everything else `raise`s to `tick()`'s generic handler, which writes `status="failed",
error=str(exc)` — an arbitrary Python exception string into a `text` column. That string is what
`WatchedFoldersSection.tsx:373` renders verbatim today (`Last check error: {watch.last_error}`) —
**the exact defect `ingestionErrorVocabulary.ts` was built to close, one directory over.**

⭐ D-235-10's classifier is therefore the FIRST place this codebase turns a source failure into a
named cause. Recommended home: **a new zero-dependency leaf `backend/app/services/sources/failure_cause.py`**,
mapping exception text / HTTP status → `Literal["token_revoked","folder_gone","unreachable","unknown"]`
plus a `hard: bool`, and consumed at all four release sites. **Not** an inline branch.

### 1.5 `run_in_threadpool` usage

Present and correct at **eight** sites, always wrapping the **Supabase** client:
`:131` (connector_connections read), `:256` (storage upload), `:293` (documents update — source_state
clear), `:317` (storage upload, modified path), `:360` (documents filename update), `:389`
(documents failure update), `:426` (documents source_state=missing_at_source), `:451`
(documents source_state=unauthorized_at_source).

⚠ Note the **late-binding closure discipline** the file already uses:
`lambda doc_id=existing["document_id"]: ...` (`:294`, `:361`, `:390`, `:427`, `:452`) — default-arg
capture inside a loop. Any new lambda in a loop must follow it.

Every `db/watches.py` call is a bare `await` over asyncpg (Correction C-2).

---

## 2 · `backend/app/db/watches.py` — the DAL idiom (439 lines)

### 2.1 Client acquisition idiom — asyncpg, one shape, no exceptions

```python
async with pool.acquire() as con:
    row = await con.fetchrow(query, *args)
    return dict(row) if row else {}
```

`import asyncpg` at `:20`. No Supabase import. No `run_in_threadpool`. Column tuples are module
constants reused in f-strings (`_WATCH_COLUMNS` `:24`, `_WATCH_CLAIM_COLUMNS` `:30`,
`_WATCH_ITEM_COLUMNS` `:35`) — **a new `_SYNC_RUN_COLUMNS` constant is the matching shape.**
`_as_uuid(value)` at `:42` normalises every UUID argument.

### 2.2 Error handling — two distinct policies, and the split is deliberate

| Policy | Functions | Shape |
|---|---|---|
| **Raise** (caller owns the failure) | `create_watch`, `get_watch`, `list_watches`, `update_watch`, `delete_watch`, `claim_due_watches`, `get_watch_items`, `get_watch_item_by_external_id`, `upsert_watch_item`, `update_item_state`, `bulk_update_item_states` | no try/except |
| **Swallow + log** (best-effort, must never break the loop) | `release_watch` (`:257-273`), `record_skipped_still_running` (`:281-293`) | `try: ... except Exception: logger.exception(...)` |

⭐ **The run-row insert belongs in the second category.** A failure to record history must never
turn a successful sync into a failed one. If the insert is folded into `release_watch` (C-3's
recommendation) it inherits that policy for free.

### 2.3 Return shapes

`dict(row) if row else {}` for inserts/upserts; `dict(row) if row else None` for reads;
`[dict(r) for r in rows]` for lists; `None` for the two best-effort writers;
`tag.rsplit(" ", 1)[-1] != "0"` (bool) for `delete_watch`.

### 2.4 Where the insert + prune belong

A single function, best-effort, ONE round trip:

```python
async def insert_sync_run(
    pool: asyncpg.Pool,
    *,
    watch_id: UUID,
    user_id: UUID,
    org_id: UUID | None,
    status: str,
    counts: dict[str, int] | None = None,
    listing_complete: bool = False,
    failure_cause: str | None = None,
    error: str | None = None,
    retain: int = 200,
) -> None:
```

**Prune in the same statement** (D-235-08, "pruned on write") — a CTE, not a second query:

```sql
WITH ins AS (
  INSERT INTO connector_sync_runs (...) VALUES (...) RETURNING watch_id
)
DELETE FROM connector_sync_runs
WHERE watch_id = (SELECT watch_id FROM ins)
  AND id NOT IN (
    SELECT id FROM connector_sync_runs
    WHERE watch_id = (SELECT watch_id FROM ins)
    ORDER BY started_at DESC
    LIMIT $retain
  );
```

⚠ `claim_due_watches` (`:210-246`) is the file's precedent for a multi-statement write inside
`async with con.transaction():` if the CTE proves awkward.

### 2.5 The claim's timestamp discipline is relevant

`claim_due_watches:236-238` already sets `last_run_at = now(), last_status = 'running'` **at claim
time**, before any work. So `last_run_at` means *"when the tick STARTED"*, not when it finished.
The run row should carry both `started_at` and `finished_at` so the history is not ambiguous the way
the column is.

---

## 3 · Migrations 168 & 169 — the exact shapes to copy

### 3.1 `connector_watches` (168, 122 lines) — full column set

`id` uuid PK · `org_id` uuid NOT NULL → `organizations` CASCADE · `user_id` uuid NOT NULL →
`auth.users` CASCADE · `connection_id` uuid NOT NULL → `connector_connections` CASCADE ·
`source_folder_id` text NOT NULL · `source_folder_name` text NOT NULL · `source_drive_id` text ·
`library_folder_id` uuid → `folders` SET NULL · `interval_minutes` int NOT NULL DEFAULT 30 ·
`next_run_at` timestamptz NOT NULL DEFAULT now() · `leased_until` timestamptz ·
`is_active` bool NOT NULL DEFAULT true · `last_run_at` timestamptz · `last_status` text ·
`last_error` text · `created_at` · `updated_at`
+ `CONSTRAINT connector_watches_interval_floor CHECK (interval_minutes >= 5)`

⛔ **No consecutive-failure counter. No run count. No `stopped_at`.** (See §13.)
⛔ **`last_status` has NO CHECK constraint** — it is free `text`. The COMMENT at `:65-66` is the only
documentation, and it is wrong in two directions (Correction C-6).

### 3.2 Indexes (168:70-80)

```sql
CREATE INDEX IF NOT EXISTS idx_connector_watches_due
  ON public.connector_watches USING btree (next_run_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_connector_watches_org_user
  ON public.connector_watches USING btree (org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_connector_watches_connection_id
  ON public.connector_watches USING btree (connection_id);
```

### 3.3 ⭐ The RLS policy idiom — copy this VERBATIM (168:82-104)

```sql
ALTER TABLE public.connector_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_sync_runs_select ON public.connector_sync_runs;
CREATE POLICY connector_sync_runs_select ON public.connector_sync_runs
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));
```

(…and the matching `_insert` `WITH CHECK`, `_update` `USING` + `WITH CHECK`, `_delete` `USING`, all
with the identical predicate — "Shape A: Tenant membership AND owner".)

### 3.4 Triggers + grants (168:106-120)

```sql
DROP TRIGGER IF EXISTS <t>_autofill_org_id ON public.<t>;
CREATE TRIGGER <t>_autofill_org_id BEFORE INSERT ON public.<t>
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');

DROP TRIGGER IF EXISTS <t>_set_updated_at ON public.<t>;
CREATE TRIGGER <t>_set_updated_at BEFORE UPDATE ON public.<t>
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON TABLE public.<t> FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<t> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<t> TO service_role;
```

⚠ **Recommended deviation for `connector_sync_runs`, stated rather than silent:** the table is
**append-only history**. Grant `SELECT` to `authenticated` and `SELECT, INSERT, DELETE` to
`service_role`; the writer is the asyncpg pool (which is how `db/watches.py` already writes
`connector_watches` — pool writes are not RLS-gated the way the PostgREST path is). Granting a user
`UPDATE`/`DELETE` on their own audit history is a capability nothing in the product needs and one a
history table should not offer. **Skip `updated_at` and its trigger too** — a row that is never
updated does not need the column.

### 3.5 `connector_watch_items` (169, 119 lines) — the per-file truth already exists

`state text NOT NULL DEFAULT 'present'` with a **real CHECK** (`:47-49`):
`present | missing | unauthorized | skipped_type | skipped_size | failed`
plus `last_error text` (`:41`), `source_version`, `content_hash`, `document_id`, `missing_since`.

⭐ **The per-file failure reason IS stored** — `upsert_watch_item(..., state="failed",
last_error=str(item_err))` at `watch_service.py:375-387`. D-235-09's vocabulary **maps** this, it
does not invent it. The BUILD-CONTRACT §1c per-file kinds (`password`, `too_big`, `unknown`) are
classifications OF `last_error`, exactly as `classifyIngestionFailure` classifies
`documents.error_message`.

⚠ **But `skipped_type` and `skipped_size` are written by NOTHING** — `grep` over
`watch_service.py` shows only `state="present"`, `"failed"`, `"missing"`, `"unauthorized"`. The
BUILD-CONTRACT's `too_big` per-file sentence therefore has **no producer today**. Say so in the plan
rather than shipping a sentence nothing can reach.

---

## 4 · `backend/app/api/sources.py` — the endpoint surface (356 lines)

### 4.1 Router + registration

- `router = APIRouter(prefix="/sources", tags=["sources"])` (`:48`)
- ⚠ **Registered TWICE** in `main.py`: `:861` at `/sources` and `:862` with `prefix="/api"` → `/api/sources`.
  A new route is automatically available at both. `frontend/src/lib/api/sources.ts:82` uses
  `${API_BASE}/sources/watches`.

### 4.2 The auth / org dependency idiom

```python
current_user: dict = Depends(get_current_user),
supabase: Client = Depends(get_user_supabase_client),   # user-JWT, not service-role
pool = Depends(get_pg_pool),
```
plus, where the org matters (`create_folder_watch:105-106`):
```python
active_org_str = await resolve_active_org_or_none(request, current_user)
org_id = _as_uuid(active_org_str) if active_org_str else None
```
`_as_uuid` is a module-local helper at `:51-52`.

### 4.3 Error idiom

Uniform `raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watch not found.")` —
**404-not-403 on every ownership miss** (`:117`, `:175`, `:210`, `:234`, `:255`, `:274`, `:312`);
one 500 at `:135`. Best-effort side effects are `try/except` + `logger.warning` (`:250`, `:342`).

### 4.4 The `/sync` endpoint IN FULL (`:261-295`)

```python
@router.post("/watches/{watch_id}/sync", response_model=WatchSyncResponse)
async def trigger_watch_sync(watch_id: UUID, current_user=Depends(get_current_user), pool=Depends(get_pg_pool)):
    user_id = _as_uuid(current_user["id"])
    existing = await get_watch(pool, watch_id, user_id=user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Watch not found or unauthorized.")
    async with pool.acquire() as con:
        await con.execute(
            "UPDATE connector_watches SET next_run_at = now(), leased_until = NULL, updated_at = now() "
            "WHERE id = $1 AND user_id = $2", watch_id, user_id)
    return WatchSyncResponse(status="scheduled", message=f"Watch {watch_id} scheduled for immediate sync.")
```

`WatchSyncResponse` = `{status: str, message: str}` (`models/source.py:71-73`). Both fields are
free strings — **the model needs no migration to carry an honest reply**, but D-235-14/16's
`"Asked · next check within N"` needs `next_run_at` and the poll interval, so the model should gain
`next_run_at: datetime | None` and `next_check_within_seconds: int | None`.

⚠ **`watch_poll_interval_seconds` reaches NO route today.** `grep` over `backend/app` returns
`config.py:1205`, `main.py:585`, `watch_service.py:70,80` — four references, zero of them an API.
The refusal + pending vocabulary both need it exposed. `[VERIFIED: grep in session]`

### 4.5 SEED-239's blast radius lives HERE, and it is real

`list_folder_watches` (`:147-159`) declares `response_model=list[WatchResponse]`. FastAPI validates
the **whole list**; one row failing `WatchResponse` validation is a **500 for every watch the caller
owns** — the identical shape SEED-239 measured on `list_connections`. `_enrich_watch_rows`
(`:55-88`) loops with **no per-row `try/except`**, and its `connector_connections` lookup at `:76-79`
is the row-specific step most likely to fail.

⭐ **D-235-13's boundary is therefore a per-row `try/except` inside `_enrich_watch_rows` plus a
`degraded: bool` + `degraded_reason` field on `WatchResponse`**, with the route returning
`list[WatchResponse]` where a failed row projects to a minimal degraded record carrying `id` and
`source_folder_name` only. Testable by planting a malformed `connector_connections.config` row —
exactly SEED-239's own reproduction.

---

## 5 · Migration 172 — recommended shape

**D-235-20 CONFIRMED CORRECT.** `ls supabase/migrations/` tail: `…167, 168_connector_watches,
169_connector_watch_items, 170_documents_source_state, 171_reserved`. Highest is **171**, so
**`172_connector_sync_runs.sql`** is right and the ROADMAP detail block's `161` is stale.

### 5.1 Columns

```sql
CREATE TABLE IF NOT EXISTS public.connector_sync_runs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id          uuid NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
    watch_id         uuid NOT NULL REFERENCES public.connector_watches(id) ON DELETE CASCADE,

    started_at       timestamptz NOT NULL DEFAULT now(),
    finished_at      timestamptz,

    status           text NOT NULL,          -- success | failed | paused | unauthorized
    failure_cause    text,                   -- token_revoked | folder_gone | unreachable | unknown
    last_error       text,

    -- H-5 / SRC-06 provenance: a tick whose listing did not complete SUPPRESSED its
    -- missing count (watch_service.py:415-420). Rendering `0 missing` for such a tick
    -- without this flag is the Onyx-#1161 lie one layer up.
    listing_complete boolean NOT NULL DEFAULT false,

    count_new        integer NOT NULL DEFAULT 0,
    count_modified   integer NOT NULL DEFAULT 0,
    count_renamed    integer NOT NULL DEFAULT 0,
    count_missing    integer NOT NULL DEFAULT 0,
    count_restored   integer NOT NULL DEFAULT 0,
    count_errors     integer NOT NULL DEFAULT 0,

    created_at       timestamptz NOT NULL DEFAULT now()
);
```

**Six flat integer columns, not a `jsonb` blob.** ⚠ There is a measured project hazard here: memory
records *"the 4th `jsonb` string-scalar column (`workflow_phases.output`) silently kills Phase 200's
per-step count"*. Six named integers cannot suffer that, index cleanly, and let the Health verdict
be a SQL aggregate.

`failure_cause` is `text` with no CHECK, matching `last_status`'s existing looseness — an
unanticipated cause in a background loop must never become a 500 (same reasoning as §C-6).

### 5.2 Indexes

```sql
-- THE history read AND the consecutive-failure derivation (§13). One index serves both.
CREATE INDEX IF NOT EXISTS idx_connector_sync_runs_watch_time
  ON public.connector_sync_runs USING btree (watch_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_sync_runs_org_user
  ON public.connector_sync_runs USING btree (org_id, user_id);
```

### 5.3 RLS — copy §3.3 verbatim, four policies, Shape A.

### 5.4 Trigger + grants — see §3.4, including the stated append-only deviation.

### 5.5 The retention `N` knob (D-235-08)

⚠ **A genuine tension between two CLAUDE.md rules**, surfaced rather than resolved silently:
*"Settings live in `user_settings`/`app_settings`… env vars are for secrets and infra only"* vs.
this being an operational bound on a background writer, not a user preference.

**Recommendation: `config.py`, beside its three existing siblings**
(`watch_process_enabled:1203`, `watch_poll_interval_seconds:1205`, `watch_lease_seconds:1207`):

```python
# Phase 235 (SURF-02 / D-235-08) — bound on per-watch run history, pruned on write.
watch_run_history_retention: int = 200
```

Reason: it is a storage bound on a daemon, in the same block as the daemon's other bounds; putting
it in `app_settings` would mean the background loop reads a DB setting on every tick. **Record on
`SEED-250`** that when retention becomes a governed *policy* (rather than a bound) it moves to
`app_settings`, which is exactly what D-235-08 asks for.
⚠ If taken, `deploy/onebox.env.example` + `backend/.env.example` must change in the **same commit**
(`scripts/check-deploy-drift.sh` gates it).

---

## 6 · The health-verdict endpoint — where it belongs, with a reason

### 6.1 `knowledge_health.py` measured

- `router = APIRouter(prefix="/knowledge-health", tags=["knowledge-health"])` (`:22`)
- Registered `main.py:831`.
- **8 GET routes** at `:579, 596, 614, 632, 651, 669, 687, 704`.
- Every one: `supabase: Client = Depends(get_supabase)  # SERVICE-ROLE (classified)` with an inline
  comment pointing to the module docstring.
- **The service-role rationale (`:1-13`)** is specific: it reads `audit_log`, whose RLS *"is
  INSERT-only for `authenticated` (mig 108 adds NO SELECT policy), so a user-JWT client would
  silently read back an EMPTY audit set"*. Owner scoping is enforced in app code via `.eq("user_id", …)`.
- **Response-model idiom: there is none.** No route declares `response_model`; each returns a bare
  `dict`. Errors are uniform `raise HTTPException(status_code=502, detail="Health metrics
  temporarily unavailable") from exc`.
- Module constants at the top (`TOP_N`, `LOW_CONF_THRESHOLD = 0.38`, `WINDOW_DAYS = 30`, …).

### 6.2 ⭐ Recommendation: put the verdict in `api/sources.py`, NOT `knowledge_health.py`

Three measured reasons:

1. **`connector_watches` has a working `authenticated` SELECT policy** (mig 168:86-88). It does
   **not** need `knowledge_health.py`'s service-role carve-out. Mounting it there would inherit a
   security exception it does not require — and that module's docstring is explicit that it is kept
   *"uniformly service-role so the surface has ONE auditable rationale"*, which a non-service-role
   route would break.
2. **The verdict is polled from every page** (D-235-04/05). `sources.py` reaches it over the
   `get_pg_pool` asyncpg path already used by every watch read; `knowledge_health.py` is a
   Supabase-client module with no pool dependency at all.
3. **`sources.py` is the domain owner.** `GET /sources/health` sits beside `GET /sources/watches`,
   and `main.py:856-857`'s own comments establish the precedent for one-route modules with their own
   classified rationale rather than bolting onto an unrelated router.

**The Health TAB's Sources section** (D-235-17) consumes the same endpoint — it is a different
*surface*, not a different *endpoint*. One verdict source, per D-235-05.

Proposed: `GET /sources/health` → `{ stopped: [{watch_id, source_folder_name, connection_name,
cause, hard, stopped_since, last_good_at}], reader_running: bool, poll_interval_seconds: int }`.
`reader_running` reads `request.app.state.watch_service is not None` (Correction C-4).

---

## 7 · `frontend/src/components/sources/WatchedFoldersSection.tsx` (393 lines)

### 7.1 Current composition, top to bottom

| Lines | Block |
|---|---|
| `:141` | root `div` — `space-y-4 rounded-xl border …` |
| `:142-161` | header: `<HardDrive/>` + "Watched Folders" + subtitle + **Add Watched Folder** button |
| `:163-174` | `feedbackMessage` emerald strip + Dismiss |
| `:176-181` | `error` destructive strip |
| `:183-187` | loading arm — `<Loader2 className="animate-spin"/> Loading watched folders...` |
| `:188-205` | empty arm — "No watched folders configured" + **Watch a Folder** |
| `:206-380` | `watches.map` |
| `:382-390` | `<CreateWatchModal …/>` |

### 7.2 `data-*` hooks it emits TODAY — exactly two

- `data-testid={`watch-card-${watch.id}`}` (`:219`)
- `data-testid="watch-disconnected-banner"` (`:232`)

**No `data-block` anywhere.** Every one of the 20 BUILD-CONTRACT block names is net-new.

### 7.3 The named anchors CONTEXT.md asks about

| What | Measured line | Note |
|---|---|---|
| SURF-01 pinned sentence | **`:305`** — `<span>checked every {watch.interval_minutes} minutes</span>`, preceded by the comment `{/* SURF-01: Exact copy 'checked every N minutes' */}` at `:302` | ⛔ **Do not reword.** Pinned by `WatchedFoldersSection.test.tsx` |
| Disconnect banner | **`:230-257`**, gated on `isDisconnected` computed at `:209-212` | See C-6 — the `last_status === "disconnected"` arm is dead; the `last_error` substring arms fire |
| `last_status` pill | `:265-288` — 5-arm nested ternary on class + a second 5-arm ternary on text | ⚠ Two parallel ternaries over the same condition set: a sixth state means editing both |
| `last_error` raw render | `:371-375` — `Last check error: {watch.last_error}` | ⛔ **The `ingestionErrorVocabulary` defect, verbatim, one directory over.** D-235-09 replaces this |
| Actions toolbar | `:311-368` — Sync now (`:312-325`), Pause/Resume (`:327-341`), Purge missing files (`:344-354`), Delete (`:356-367`) | The **one control** (D-235-11) attaches here or in the stopped block |

### 7.4 Where the new surfaces attach

- **`outcome` line** → replaces/joins the metadata row at `:291-307`, beside the cadence span.
- **`stopped-sentence` + the one control** → a new block between the pill row (`:259-308`) and the
  actions toolbar, replacing the `isDisconnected` banner at `:230-257`.
- **`history` / `run` / `quiet-fold` / `fail-reason`** → an inline expansion appended after
  `:371-375`, inside the card `div` that closes at `:376`.
- **`instance-statement`** → ⛔ **NOT here.** D-235-12 says once, not per row. It belongs in
  `IngestionTab` above both sections (see §8.1), or in the Library page shell.

### 7.5 Two latent defects the plan should sweep

1. **`:78`** — `setFeedbackMessage(\`Sync scheduled for …\`)` — the forbidden word (C-7).
2. **`:250`** — `window.location.href = "/settings/connections"` as the fallback when
   `onNavigateToConnections` is absent. In a no-router app (`SEED-185`) that is a **full page reload
   onto a path that renders the chat home**. `IngestionTab` mounts this component **without**
   `onNavigateToConnections` (`:228-230`), so **the fallback is the live path today.** The
   Reconnect control D-235-11 specifies must route through `onNavigate`, not this.

---

## 8 · `IngestionTab.tsx` (487 lines) and `HealthTab.tsx` (184 lines)

### 8.1 `IngestionTab` — the mount points

- Root: `<section data-testid="ingestion-tab" className="flex flex-col gap-6 overflow-y-auto">` (`:158`)
- Four sub-tabs via shadcn `Tabs` (`:160`, `data-testid="ingestion-subnav"`):
  `add-files` (default) · `in-progress` · `needs-attention` · `history`
- **`WatchedFoldersSection` mounts at `:228-230`**, inside `<TabsContent value="add-files"
  data-testid="ingestion-subtab-add-files">` (`:196`), immediately after `ConnectedSourceSection`
  (`:224-227`):

```tsx
<ConnectedSourceSection
  destinationFolderId={uploadFolderId}
  destinationFolderName={uploadFolderName}
/>
<WatchedFoldersSection
  destinationFolderId={uploadFolderId}
/>
```

- ⛔ **`IngestionTab` uses NO `lazy`/`Suspense`.** Every child is a static import (`:27-46`).
- ⭐ It already imports `classifyIngestionError` from `@/components/library/ingestionErrorVocabulary`
  (`:36`) — the exact pattern D-235-09 mirrors.
- **The `instance-statement` (reader-off) belongs at `:158-159`**, immediately inside the root
  `<section>` and above the `Tabs` — so it is stated once, above every sub-tab, and cannot be
  mistaken for a per-source claim.

### 8.2 `HealthTab` — the lazy/Suspense idiom the new section must match

```tsx
import { lazy, Suspense } from "react"                                    // :12
const RetrievalTrendChart = lazy(() =>                                    // :22-26
  import("@/components/health/RetrievalTrendChart").then((m) => ({ default: m.RetrievalTrendChart })),
)
...
<Suspense fallback={<ChartSkeleton />}>                                    // :103
```

Composition (`:87-183`): ring+chart row (`:90-135`) → 5 stat tiles (`:138-173`) →
`<HealthSignalChips />` (`:176`) → `<HealthDocumentBars />` (`:179`) →
`<CheckedQueriesSection onTotalChange={setCheckedCount} />` (`:182`).

**The Sources attention section mounts as a sibling at `:183`** (after `CheckedQueriesSection`,
before the closing `</div>`), self-fetching from `GET /sources/health` in its own `useEffect` — the
pattern every sibling already uses (`:77-83`). **Zero branches enter `HealthTab`** → G-5 honoured by
construction.

⚠ `HealthTab` fetches with `.catch(() => setOverview(null))` and renders `animate-pulse` skeletons —
a usable precedent for the attention section's own loading state (`SEED-248`).

---

## 9 · `ingestionErrorVocabulary.ts` (206 lines) + its test (270 lines)

### 9.1 The five binding rules, verbatim from the docblock (`:13-24`)

1. A sentence is **PRESENTATION**, never a rule. Nothing branches on the text.
2. **NO SEVERITY WORD** — the row is already under a heading that says something is wrong.
3. **NO EXCLAMATION.**
4. **NO MECHANISM.** It names what is TRUE OF THE FILE and what to DO — never what the code experienced.
5. The dash is an **EM DASH (U+2014)**, asserted by codepoint over the whole table.

Plus two structural rules the docblock adds: **zero imports** (`:47-49`) and **the default arm never
invents a cause** (`:25-30`).

### 9.2 The exported surface (the shape `sourceHealthVocabulary.ts` copies)

| Export | Line | Role |
|---|---|---|
| `type IngestionFailureKind` | `:67` | the union — a new kind cannot be added without a sentence |
| `UNKNOWN_FAILURE_SENTENCE` | `:70` | `"It stopped, and no reason was recorded."` ⭐ **the sketch's `cause.unknown.says` and `fileFail.unknown` are this string, byte-identical** |
| `SENTENCE_FOR_KIND` | `:76` | `Record<Kind, string>` — keyed by the union |
| `MATCHERS` | `:99` (module-private) | ordered `{kind, test: RegExp}[]` — broad on the fact, narrow on the wording |
| `MACHINE_TELLS` | `:118` (module-private) | 9 regexes; ANY hit ⇒ not safe to show |
| `looksHumanWritten(msg)` | `:137` | **positive proof**: length 10–300, ends `[.?]`, no machine tell |
| `classifyIngestionFailure(msg)` | `:149` | raw → kind (exported so a suite can test classification separately from copy) |
| `classifyIngestionError(msg, filename?)` | `:194` | ⭐ **the ONE entry point.** Order: recognised kind → provably-human passthrough → honest fallback |

### 9.3 The `looksHumanWritten` positive-proof idiom (`:137-143`)

```ts
export function looksHumanWritten(message: string): boolean {
  const trimmed = message.trim()
  if (trimmed.length < 10 || trimmed.length > 300) return false
  if (!/[.?]$/.test(trimmed)) return false
  return !MACHINE_TELLS.some((tell) => tell.test(trimmed))
}
```

The docblock (`:133-135`) states the reason: *"'Does it look machine-y?' fails open… This asks for
proof and refuses without it."* **Deny by default.**

### 9.4 How the test pins against the backend's LIVE source

`ingestionFailureCopy.test.ts:34-37`:

```ts
// Same `?raw` cross-language idiom as `IngestionStrip.test.tsx:39`.
import documentsPySource from "../../../../../backend/app/api/documents.py?raw"
```

Then (`:196-270`): a **non-vacuity control** (`documentsPySource.length > 20000` and contains
`"empty_text_message"`), then it reconstructs every VALUE of `_EMPTY_TEXT_MESSAGES` by walking the
Python literals and asserts each is `looksHumanWritten` and passes through unchanged.

The five-rule whole-table property is at `:45-96`, with:
- a **non-vacuity case FIRST** (`:49-55`) — *"an empty table would satisfy every 'for each' vacuously"*
- the **em dash computed at runtime** — `const EM_DASH = String.fromCharCode(0x2014)` (`:41`),
  because *"a counted literal spelled inside a docblock comment is itself a string the fence would match"* (Pitfall 8)

### 9.5 ⭐ What `sourceHealthVocabulary.ts` must be

Same shape, and it must be bound to a **live backend source** the same way. The natural target:

```ts
import watchServiceSource from "../../../../backend/app/services/watch_service.py?raw"
// or, better, the new cause classifier:
import failureCauseSource from "../../../../backend/app/services/sources/failure_cause.py?raw"
```

so that a cause added on the backend cannot silently stop having a sentence. **This is the single
most valuable thing to carry over** — it is why 217.1's vocabulary cannot rot.

⚠ **C-11 applies:** port the WHOLE `COPY` object (27 keys, `index.html:309-390`), not §1's 18-row
table, and make the `cause.*.says`/`.action` entries **functions of the connection name**.

---

## 10 · The vitest count gate — MEASURED, and the exact knobs to edit

### 10.1 ⭐ The verbatim verdict line (run this session, repo root, `GSD_VITEST_MAX_WORKERS=2`)

```
  total                                      6814    7544    +730
  total 7544  ·  failed 0  ·  pinned total 6814
count gate OK — 227/227 pinned files present, no per-file decrease, 0 failing.
```

Exit code **0**.

| | CLAUDE.md's last correction (2026-08-28) | **MEASURED 2026-09-06** |
|---|---|---|
| grand total | 6355 | **7544** |
| pinned total | 5266 | **6814** |
| pinned files | 120/120 | **227/227** |
| failed | 0 | **0** |

⚠ **This is the SIXTH rot of that figure, and it took nine days** — consistent with the trajectory
CLAUDE.md publishes. A plan reading a larger number has read the correct current one; the gate's
contract is *no per-file DECREASE* and *zero failing*, never a fixed total. `[VERIFIED: run in session]`

Also observed and benign: `MessageInput.connectors.test.tsx  5 → 9  +4` (an existing pinned file
that grew) and five files printed `new` with no pin (`PromptVariableChips`, `RunHero`,
`automationFacts`, `nodeEffectBanner`, `toolReadOnlyMap`) — pre-existing unpinned growth, not
Phase 235's to fix.

### 10.2 ⛔ Only TWO directory entries exist in the whole `TARGETS` array

Derived mechanically (`awk NR>=3568 && NR<=4493 | grep -v '\.(test|spec)\.'`):

```
"src/landing"
"src/components/workflows"
```

**Everything else is file-level.** So `src/components/sources`, `src/components/library` AND
`src/components/layout` are ALL file-level — CONTEXT.md flags only `sources`, but the same is true
of the other two. `[VERIFIED: measured in session]`

### 10.3 The exact edit sites

| Knob | File | Line | What to add |
|---|---|---|---|
| **`BASELINE`** (what is GUARDED) | `scripts/vitest-count-gate.cjs` | insert after **`:3197`** (`"WatchedFoldersSection.test.tsx": 6,`); the object closes at **`:3198`** | one `"<basename>": <n>,` per new suite — keyed by **BASENAME only**, never a path |
| **`TARGETS`** (what RUNS) | `scripts/vitest-count-gate.cjs` | insert after **`:4492`** (`"src/components/sources/WatchedFoldersSection.test.tsx",`); the array closes at **`:4493`** | one full `"src/…/X.test.tsx",` **path** per new suite |

⛔ **BOTH knobs, in the SAME commit.** `scripts/vitest-count-gate.cjs:3166-3175` records why, in
this project's own words: *"a `BASELINE` key naming a path that does not yet exist makes this gate
ERROR (exit 2) rather than fail."*

Anticipated new suites and their two lines each:
```
src/components/sources/sourceHealthVocabulary.test.ts
src/components/sources/sourceComposition.test.tsx      # the C-8/C-9/C-10 composition fence
src/components/sources/WatchedFoldersSection.history.test.tsx
src/components/layout/__tests__/NavPanel.badge.test.tsx
src/components/library/__tests__/SourcesAttentionSection.test.tsx
```

⚠ **The composition fence is deliberately RED when it lands** (the 217.1 rule at
`sketchComposition.test.tsx:13-21`): *"⛔ IT IS NOT IN `scripts/vitest-count-gate.cjs` — neither
`TARGETS` nor `BASELINE`. The gate's contract is zero failing, forever… The phase's FINAL wave
adopts it, once each wave has turned its own blocks green."* **Plan the same sequencing.**

---

## 11 · The backend unit baseline — MEASURED

Command run: `pytest tests/unit -q --continue-on-collection-errors` in `backend/` with
`venv/Scripts/python.exe`.

**Verbatim tail line:**
```
72 failed, 3785 passed, 2 xfailed, 2 xpassed, 42 warnings in 116.50s (0:01:56)
```

No collection-error line; `grep -c FAILED` = 72 (agrees with the tail). See **Correction C-1**.
The failing set is the known rot cluster (`test_retrieval_service.py`, `test_sandbox_service.py`,
`test_sql_service.py`, `test_streaming_reliability.py`, …) — none of it touches watches, sources or
ingest. Phase 234's watch suites all pass.

---

## 12 · `WATCH_PROCESS_ENABLED` — MEASURED

See **Correction C-5** for the full table. Summary: `config.py:1203` default `False`;
`main.py:571` is the gate; `main.py:591` publishes `app_instance.state.watch_service`;
**the operator's `backend/.env` holds `WATCH_PROCESS_ENABLED=true` right now**;
`WATCH_POLL_INTERVAL_SECONDS` and `WATCH_LEASE_SECONDS` are absent, so 60s / 600s apply.

---

## 13 · The "3 consecutive soft failures" counter — concrete answer

### 13.1 Does one exist? **No.**

`connector_watches` (mig 168) has **no** failure counter, no run count, no `stopped_at`,
no `consecutive_failures`. `connector_watch_items` (mig 169) has none either. Nothing anywhere in
`backend/app` counts consecutive failures. `[VERIFIED: read both migrations + grep]`

### 13.2 ⭐ Recommendation: DERIVE it from `connector_sync_runs`. Do not add a column.

```sql
SELECT status, failure_cause
FROM connector_sync_runs
WHERE watch_id = $1
ORDER BY started_at DESC
LIMIT 5;
```

Count leading rows whose `status <> 'success'`. Served entirely by
`idx_connector_sync_runs_watch_time` (§5.2) — the same index the history read uses.

**Why this and not an `ALTER TABLE connector_watches ADD COLUMN consecutive_failures`:**

| | Derived from run rows | Counter column |
|---|---|---|
| Correct by construction? | ✅ **Yes** — D-235-07 guarantees every tick writes a row, so the sequence IS the truth | ⛔ Only if **all four** `release_watch` arms (C-3) increment/reset it. A fifth arm added later silently drifts |
| New write discipline? | none | four sites, plus a reset on success |
| Can it disagree with the history the user sees? | ⛔ impossible — same rows | ✅ possible, and undetectable |
| Migration cost | zero (the table is new anyway) | one more column + backfill semantics |
| Shape this codebase keeps getting bitten by | — | ⚠ **"two paths serving one outcome"** — five measured instances |

⚠ **One honest caveat:** derivation requires at least one run row to exist. A watch created but
never ticked has no rows — and that is correctly *not* "stopped": it is "has not read yet", which
BUILD-CONTRACT §1 already has a sentence for (`neverRead` = `"It has not read successfully yet."`).
The verdict endpoint must distinguish `no rows` from `N failures`, and D-235-10's hard causes must
still promote on failure **1**, which the derivation handles naturally (leading row is hard ⇒ stopped).

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Turning a raw exception string into a sentence | a new classifier from scratch | `ingestionErrorVocabulary.ts`'s **shape**, in a new sibling leaf (D-235-09) | The 5 rules, the positive-proof passthrough, the honest fallback and the live-source binding are all already worked out and tested (§9) |
| Asserting the sketch's composition | a hand-listed array of block names in the suite | the `sketchComposition.test.tsx` template + a generated JSON (C-10) | `sketchComposition.test.tsx:22-31` states the reason: hand-listing reintroduces the staleness the emitter exists to prevent |
| Atomic claim / lease for background work | anything | `claim_due_watches` (`db/watches.py:193-246`), already shipped | ⛔ D-235-15 — an inline sync re-opens the concurrency problem it solved |
| Per-tenant RLS on a new table | a new predicate | migration 168's **Shape A** verbatim (§3.3) | Four tables in this milestone use it identically; a novel predicate is a novel audit |
| A pending/loading state | a spinner | `SEED-248`'s rule + `HealthTab`'s `animate-pulse` + `ConnectionsTab`'s named `CONNECTIONS_LOADING` copy | D-235-16 rejected the bare spinner explicitly |
| Navigating between homes | a URL / `window.location.href` | `onNavigate(view)` threaded from `App.tsx` | `SEED-185` — there is no router. ⚠ `WatchedFoldersSection.tsx:250` already breaks this and is the live path (§7.5) |
| Counting consecutive failures | a counter column | derive from `connector_sync_runs` (§13.2) | Correct by construction; no fifth-arm drift |

---

## Common Pitfalls

### P-1 · Writing the run row only inside `sync_watch`
**What goes wrong:** `tick():115` — the arm that catches *every crash-shaped failure* — is outside
`sync_watch`. Those ticks would silently have no history, which is exactly the invisibility LIB-10
forbids.
**Avoid:** fold the write into `release_watch` (C-3).
**Warning sign:** a plan whose `files_modified` names `watch_service.py` but not `db/watches.py`.

### P-2 · Rendering `0 missing` for a tick whose listing was incomplete
**What goes wrong:** `watch_service.py:415-420` **suppresses** missing transitions when
`listing.complete` is false. A history row showing `0 missing` reads as "nothing was deleted" when
the truth is "we could not tell".
**Avoid:** the `listing_complete` column (§5.1) + a distinct sentence for it.

### P-3 · Trusting `settings.watch_process_enabled` for "the reader is running"
See Correction C-4. `main.py:587-589` swallows a failed start.

### P-4 · A BASELINE key without its TARGETS line (or vice versa)
The gate **errors (exit 2)**, not fails. `vitest-count-gate.cjs:3166-3175` records this in the
project's own words. Both knobs, same commit, checked against the array — not assumed.

### P-5 · Adopting the composition fence GREEN
`sketchComposition.test.tsx:13-21`: *"a guard adopted green on a tree it never failed on has proved
nothing about its own wiring."* Land it red, record the red run, adopt in the final wave.

### P-6 · A single bad row 500-ing the whole watch list
`response_model=list[WatchResponse]` at `sources.py:149` + a boundary-free loop at `:55-88`.
This is SEED-239's exact shape and it is live. §4.5.

### P-7 · Porting the sketch's `cause` sentences as constants
They contain the fixture's connection name ("Legal SharePoint"). C-11.

### P-8 · Transcribing BUILD-CONTRACT §2's 104-entry list
It is an unscoped-emitter artifact and the sketch's own code says so. C-8.

### P-9 · Late-binding closures in `run_in_threadpool` lambdas inside loops
`watch_service.py` uses default-arg capture (`lambda doc_id=…:`) at five sites. A new lambda without
it captures the loop variable's final value.

### P-10 · Assuming `frontend/src/lib/api/sources.ts` is in the `@/lib/api` barrel
**It is not.** `grep 'api/sources' frontend/src/lib/api.ts` returns nothing; consumers import
`@/lib/api/sources` directly. A new suite must `vi.mock("@/lib/api/sources", …)` **separately** from
`vi.mock("@/lib/api", …)` — which `WatchedFoldersSection.test.tsx:20-31` already does correctly and
is the template.

---

## Code Examples (verified, from this repo)

### The RLS policy to copy — `supabase/migrations/168_connector_watches.sql:85-88`
```sql
DROP POLICY IF EXISTS connector_watches_select ON public.connector_watches;
CREATE POLICY connector_watches_select ON public.connector_watches
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.current_user_org_ids()) AND (auth.uid() = user_id));
```

### The DAL best-effort writer to copy — `backend/app/db/watches.py:249-273`
```python
async def release_watch(pool, watch_id, *, status: str, error: str | None = None) -> None:
    try:
        async with pool.acquire() as con:
            await con.execute(
                "UPDATE connector_watches SET leased_until = NULL, last_status = $2, "
                "last_error = $3, updated_at = now() WHERE id = $1",
                _as_uuid(watch_id), status, error)
    except Exception:  # noqa: BLE001
        logger.exception("release_watch failed for %s", watch_id)
```

### The vocabulary entry point to mirror — `ingestionErrorVocabulary.ts:194-206`
```ts
export function classifyIngestionError(errorMessage: string | null | undefined, filename?: string | null): string {
  const kind = classifyIngestionFailure(errorMessage)
  if (kind === "not_a_zip") return notAZipSentence(filename)
  if (kind !== "unknown") return SENTENCE_FOR_KIND[kind]
  const raw = (errorMessage ?? "").trim()
  if (raw && looksHumanWritten(raw)) return raw
  return UNKNOWN_FAILURE_SENTENCE
}
```

### The composition assertion to copy — `sketchComposition.test.tsx:410-419`
```ts
for (const screenName of SCREENS) {
  describe(`${screenName}`, () => {
    const blocks = CONTRACT[screenName]?.blocks ?? []
    for (const block of blocks) {
      it(`renders the \`${block.kind}\` block as [data-testid="${hook(screenName, block.kind)}"]`, async () => {
        await mountScreen(screenName, block.kind)
        expect(screen.getByTestId(hook(screenName, block.kind))).toBeInTheDocument()
      })
    }
  })
}
```

### The `RailItem` badge slot — the ONE-prop change (`NavPanel.tsx:61-98`)
The component is pure presentational; `className` already carries per-item tone. The badge must go
**inside `button`** so it survives both renderings (`:91` returns `button` bare when expanded;
`:92-97` wraps it in a Tooltip when collapsed), and `button` needs `relative` added to its
`cn(...)` for absolute positioning at the 40px collapsed size (`:83` — `expanded ? "w-full
justify-start gap-3 px-3" : "w-10 justify-center"`).

```tsx
function RailItem({ expanded, icon: Icon, label, active, onClick, className, badge }: {
  ... ; badge?: React.ReactNode          // ← generic slot; NavPanel decides what goes in it
}) {
  const button = (
    <button ... className={cn("relative flex items-center h-10 rounded-lg …", …)}>
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && <span className="text-sm font-medium truncate">{label}</span>}
      {badge}
    </button>
  )
```

---

## 14 · Navigation, and the thing that MUST change (SURF-03's real cost)

### 14.1 The chain, measured end to end

| Step | file:line | Fact |
|---|---|---|
| `ActiveView` union | `App.tsx:102` | `"chat" \| "documents" \| "skills" \| "settings" \| "workflows" \| "classification-rules" \| "connections" \| "skill-studio" \| "control-room" \| "org-admin" \| "workflow-run"` — **11 members** |
| The switch | `App.tsx:126` | `const [activeView, setActiveView] = useState<ActiveView>(() => …)` |
| Threaded to layout | `App.tsx:304` | `onNavigate={setActiveView}` |
| ⭐ **The Library's `ActiveView` value** | `ChatLayout.tsx:762` | **`"documents"`** — `activeView === "documents" ? <LibraryPage onNavigate={onNavigate} /> : …` |
| The rail entry | `nav-items.ts:37` | `{ view: "documents", icon: FileText, label: "Library" }` — **ungoverned** (no `feature` key ⇒ always visible) |
| Rail render | `NavPanel.tsx:163-177` | `navItems.map(({view, icon, label}) => <RailItem … onClick={() => onNavigate(view)} />)` |

### 14.2 ⛔ **An external caller CANNOT open the Library Health tab today**

- `LibraryPage`'s signature is `export function LibraryPage({ onNavigate }: { onNavigate?: (view: ActiveView) => void } = {})`
  (`LibraryPage.tsx:169`) — **`onNavigate` is its only prop.**
- The tab is INTERNAL reducer state: `const [lib, dispatch] = useReducer(pageReducer, initialLibraryState)` (`:177`),
  `const tab = lib.selection.tab` (`:178`).
- `initialLibraryState` (`pages/librarySelection.ts:143-151`) hardcodes `selection: { tab: "documents", folderId: null }`.
- The only way to change it is `dispatch({ type: "SELECT_TAB", tab })` (`:705`, `:719`, `:735`) — all
  three call sites are **inside** `LibraryPage`.
- `LibraryTab` is a 5-member union with `TAB_LABELS` at `:99-107` as the single source
  (`documents | views | ingestion | indexing | health`), and `D-217-15` treats a sixth key as a
  schema change.

**What must change, minimally:**

```tsx
export function LibraryPage({ onNavigate, initialTab }: {
  onNavigate?: (view: ActiveView) => void
  initialTab?: LibraryTab                         // ← net-new
} = {}) {
  const [lib, dispatch] = useReducer(pageReducer,
    initialTab ? { ...initialLibraryState, selection: { tab: initialTab, folderId: null } }
               : initialLibraryState)
```

…plus `ChatLayout.tsx:763` threading it, plus `App.tsx` holding a
`const [libraryTab, setLibraryTab] = useState<LibraryTab | undefined>()` beside `activeView` and a
navigator that sets both — **exactly the `studioSkillId`/`studioTab` precedent already shipped at
`App.tsx:138-151` and `ChatLayout.tsx:815-820`.** ⭐ Follow it; do not invent a second shape.

⚠ **`librarySelection.ts` is 312 lines with its own 25-case suite** (`pages/__tests__/librarySelection.test.ts`,
in TARGETS). Its docblock (`LibraryPage.tsx:118-127`) records that *"a 25-case suite asserts the
action set is exactly six"* — so **do NOT add a seventh action.** Compose the initial state at the
page boundary, as `pageReducer` already does for `SET_FOLDER_SHEET`.

### 14.3 `NavPanel` is DESKTOP-ONLY — `hidden md:flex` (`NavPanel.tsx:121`)

A badge on `RailItem` alone does not reach a mobile viewer. `nav-items.ts:5-6` names a mobile drawer
(`ChatLayout`'s `NAV_ITEMS_MOBILE`) consuming the same `NAV_ITEMS`. **The plan must state whether
mobile is in scope**; SC#3's sentence *"the signal reaches them where they already are"* is not
qualified by viewport. Either wire the drawer too, or record the mobile gap as an explicit decision.

### 14.4 G-5 status of the navigation files — re-derived this session

⚠ `git log --follow`, six-digit date buckets excluded:

| File | commits / phases / lines | G-5 | Ledger row |
|---|---|---|---|
| `frontend/src/components/layout/NavPanel.tsx` | **19 / 10 / 237** | ⚠ **FIRES** | ⛔ **NONE — absent for its entire life at 10 phases** |
| `frontend/src/lib/nav-items.ts` | **8 / 6 / 95** | ⚠ **FIRES** | ⛔ **NONE** |
| `frontend/src/App.tsx` | **30 / 22 / 326** | ⚠ **FIRES** | ⛔ **NONE — at 22 phases** |
| `frontend/src/components/library/HealthTab.tsx` | 8 / 1 / 184 | no (1 phase) | ⛔ NONE |
| `frontend/src/pages/librarySelection.ts` | 2 / 2 / 312 | no | ⛔ NONE |
| `frontend/src/lib/api/sources.ts` | 2 / 0 / 163 | no | ⛔ NONE |
| `frontend/src/components/library/IngestionTab.tsx` | **16 / 5 / 487** | ⚠ FIRES | ⚠ **STALE** — row reads `13 / 4 / 456` |
| `frontend/src/pages/LibraryPage.tsx` | **42 / 13 / 866** | ⚠ FIRES | ⚠ **STALE** — row reads `40 / 12 / 825` |
| `frontend/src/components/layout/ChatLayout.tsx` | 46 / 24 / 921 | ⚠ FIRES | ✅ current |
| `backend/app/api/knowledge_health.py` | 11 / 6 / 737 | ⚠ FIRES | ✅ current |
| `backend/app/services/watch_service.py` | 2 / 1 / 458 | no | ✅ current |
| `backend/app/db/watches.py` | 1 / 1 / 439 | no | ✅ current |
| `backend/app/api/sources.py` | 2 / 0 / 356 | no | ✅ current |
| `frontend/src/components/sources/WatchedFoldersSection.tsx` | 2 / 0 / 393 | no | ✅ current |

⭐ **Six files this phase touches have NO ledger row at all** — `NavPanel.tsx` and `App.tsx` are the
serious ones: G-5 has never been able to fire on either, at 10 and 22 phases. **Rows for all six +
their `docs/HOT-FILE-LEDGER.md` sections are owed in the same commit**, and the two stale rows must
be re-derived (CLAUDE.md's same-commit sync rule).

---

## Validation Architecture

Included because `.planning/config.json` sets `workflow.nyquist_validation: true`.

### Test Framework

| Property | Value |
|---|---|
| Backend framework | pytest (`backend/venv`) |
| Backend quick run | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/services/test_watch_*.py tests/unit/db/test_watches_db.py -x -q` |
| Backend full suite | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors` |
| Backend baseline **measured 2026-09-06** | **72 failed / 3785 passed / 2 xfailed / 2 xpassed / 0 collection errors** ⚠ already 1 over CLAUDE.md's ceiling of 71, pre-existing (C-1) |
| Frontend framework | vitest + @testing-library/react + jsdom |
| Frontend quick run | `cd frontend && npx vitest run src/components/sources --maxWorkers=2` |
| Frontend gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **from the repo root** |
| Frontend baseline **measured 2026-09-06** | `total 7544 · failed 0 · pinned total 6814` · `227/227 pinned files` · exit 0 |

### Phase Requirements → Test Map

| Req | Behaviour that must be pinned | Layer | Command | Exists? |
|---|---|---|---|---|
| SURF-02 | Every `release_watch` arm writes exactly one `connector_sync_runs` row — **all four** (C-3) | backend pytest | `pytest tests/unit/services/test_watch_sync_runs.py -x` | ❌ Wave 0 |
| SURF-02 | A tick with `listing.complete = False` writes `listing_complete = false`, and `count_missing = 0` is NOT rendered as "nothing deleted" | backend pytest | same file | ❌ Wave 0 |
| SURF-02 | Prune keeps exactly N rows per watch and deletes the oldest — driven at N+3 | backend pytest | `pytest tests/unit/db/test_watches_db.py::test_insert_sync_run_prunes -x` | ⚠ extend existing file |
| SURF-02 | Quiet-run collapsing is RENDERING: N stored rows → 1 `quiet-fold` line, and expanding shows all N | frontend vitest | `npx vitest run src/components/sources/WatchedFoldersSection.history.test.tsx` | ❌ Wave 0 |
| LIB-10 | Hard cause ⇒ stopped on failure **1**; soft cause ⇒ stopped only at failure **3**; failure 2 is NOT stopped | backend pytest | `pytest tests/unit/services/test_source_health_verdict.py -x` | ❌ Wave 0 |
| LIB-10 | `no run rows` ⇒ `neverRead`, **not** stopped | backend pytest | same file | ❌ Wave 0 |
| LIB-10 | Each cause maps to exactly ONE control, and the map is DATA (a new cause needs no branch edit) | frontend vitest | `npx vitest run src/components/sources/sourceHealthVocabulary.test.ts` | ❌ Wave 0 |
| LIB-10 | The 5 binding rules hold over the WHOLE `SENTENCE_FOR_CAUSE` table, with a non-vacuity case FIRST and the em dash computed at runtime | frontend vitest | same | ❌ Wave 0 |
| LIB-10 | Every cause the backend classifier can emit has a sentence — pinned against the **live** `failure_cause.py` via `?raw` | frontend vitest | same | ❌ Wave 0 |
| LIB-10 / D-235-12 | The reader-off statement appears **exactly once** and no card is marked individually broken | frontend vitest | composition fence | ❌ Wave 0 |
| SURF-03 | `RailItem` renders the badge at **both** 58px collapsed and 210px expanded | frontend vitest | `npx vitest run src/components/layout/__tests__/NavPanel.badge.test.tsx` | ❌ Wave 0 |
| SURF-03 | The popover's action calls `onNavigate("documents")` **and** selects the Health tab — no URL, no `window.location` | frontend vitest | same + a LibraryPage case | ❌ Wave 0 |
| SURF-03 / SC#4 | The badge does **not** render for a healthy source, nor for ONE soft failure | frontend vitest + backend | both | ❌ Wave 0 |
| SEED-239 / D-235-13 | One unprojectable row degrades ONE row; the other N−1 still render; the list is **not** a 500 | backend pytest | `pytest tests/unit/api/test_sources_degraded_row.py -x` | ❌ Wave 0 |
| BUG-260906-02 (1) | Reader off ⇒ `/sync` **refuses** and names configuration, not the folder | backend pytest | `pytest tests/unit/api/test_sources_sync_honesty.py -x` | ❌ Wave 0 |
| BUG-260906-02 (2) | The word **"scheduled"** appears in neither `api/sources.py` nor `WatchedFoldersSection.tsx` — a source fence over BOTH files | backend pytest **and** frontend `?raw` fence | both | ❌ Wave 0 |
| BUG-260906-02 (3) | Between click and tick the card shows `asked(...)`, flipping to the outcome when `last_run_at` advances past the click | frontend vitest | history suite | ❌ Wave 0 |
| SURF-01 (inherited) | `checked every {N} minutes` still renders verbatim | frontend vitest | `WatchedFoldersSection.test.tsx` | ✅ **exists, pinned at 6** |
| G-4 (lived) | A real watch fails, the badge appears on a non-Library page, the popover names the source, and the one control fixes it | **manual UAT** | operator, Chrome | ❌ VALIDATION.md |

### ⭐ How §2's composition and §1's COPY get asserted — driven RED first

**The sketch-218 lesson, in this project's own words** (`sketchComposition.test.tsx:5-9`):
> *"Phase 217 shipped against a contract that pinned WORDS… and every one of those assertions was
> green while four of the five tabs carried none of the sketch's furniture. **A contract that cannot
> name a MISSING BLOCK cannot tell 'built' from 'not built yet'.**"*

The mechanism, in four steps:

**Step 1 (Wave 0) — make the contract machine-readable.** Add `--emit-json` to
`.planning/sketches/233-the-source-says-what-it-did/drive.cjs` writing a **region-scoped**
`sourceComposition.json` (using the file's own `region()` helper at `:356-362`, which `--emit`
currently ignores — C-8) into `frontend/src/components/sources/__generated__/`. Ship the COPY object
in the same artifact so §1's strings are imported, never re-typed (C-11: **all 27 keys**).
⚠ In-package copy, **never** `?raw` into `.planning/sketches/` — that directory is archived by
`/gsd:complete-milestone` (`sketchComposition.test.tsx:27-31`).

**Step 2 (Wave 0) — write `sourceComposition.test.tsx` and land it RED.** Structure copied from
`sketchComposition.test.tsx`:
- **§1 non-vacuity floor** — assert the imported JSON has ≥ 15 block kinds. *A moved import can
  resolve EMPTY rather than throwing, and a contract of zero blocks makes every assertion pass over
  nothing.*
- **§2 positive controls** — 2-3 cases that are GREEN in the red baseline (the section's heading
  renders; `data-testid="ingestion-tab"` mounts). *A run in which EVERY case is red is
  indistinguishable from a broken mount harness.*
- **§3 every block** — one `it()` per kind: `expect(screen.getByTestId(hook("sources", kind))).toBeInTheDocument()`.
- **§4 every named control** — one `it()` per action: `expect(screen.getByRole("button", { name: label })).toBeInTheDocument()`
  for `badge · open-health · sync-now · toggle-history · toggle-quiet · fix · report-source · go-to-source`.
- **§5 the counts that must hold** — 1 `source-card` per source; exactly 2 `attention-row`s;
  collapsed 3 `run`s vs expanded 17; `instance-statement` **exactly once** (`getAllByTestId(...).length === 1`).
- **§6 the four §4 invariants as source fences** — no `"scheduled"`, no `"instantly"`, no `"on change"`,
  `--color-danger` never on a source state.
- ⛔ **NOT in `TARGETS` or `BASELINE` while red.** The gate's contract is *zero failing, forever*.

**Step 3 — record the RED run verbatim** in `.planning/phases/235-…/235-BASELINE.md`, the way
`217.1-BASELINE.md` did. **The red run is the deliverable.**

**Step 4 (final wave) — adopt both knobs in one commit**, at the gate's own printed `— N new`
figure, never a guessed number, and never while red.

⚠ **The COPY half is asserted separately**, in `sourceHealthVocabulary.test.ts`, over the whole
table — the `ingestionFailureCopy.test.ts` template (§9). Text assertions live there; composition
assertions live in the fence. **Neither substitutes for the other — that is the whole 218 lesson.**

### Sampling rate

- **Per task commit:** `npx vitest run src/components/sources --maxWorkers=2` + the touched backend file
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) **and**
  `pytest tests/unit -q --continue-on-collection-errors` — compare against **72**, not 71
- **Phase gate:** both green (gate `count gate OK`, backend ≤ 72) before `/gsd:verify-work`

### Wave 0 gaps

- [ ] `drive.cjs --emit-json` + `frontend/src/components/sources/__generated__/sourceComposition.json`
- [ ] `frontend/src/components/sources/sourceHealthVocabulary.ts` (+ `.test.ts`)
- [ ] `frontend/src/components/sources/sourceComposition.test.tsx` — **RED**
- [ ] `backend/app/services/sources/failure_cause.py` (+ unit tests) — the hard/soft classifier as data
- [ ] `backend/tests/unit/services/test_watch_sync_runs.py`
- [ ] `backend/tests/unit/services/test_source_health_verdict.py`
- [ ] `backend/tests/unit/api/test_sources_sync_honesty.py`
- [ ] `backend/tests/unit/api/test_sources_degraded_row.py`
- [ ] `frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx`
- [ ] Gate knobs for every file above — **both, same commit** (§10.3)

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json` ⇒ treated as **enabled**.

### Applicable ASVS categories

| Category | Applies | Standard control in this codebase |
|---|---|---|
| V2 Authentication | yes | `Depends(get_current_user)` on every route (`sources.py:99,152,168,195,226,267,304`) |
| V3 Session Management | no | Supabase Auth owns sessions; this phase adds none |
| **V4 Access Control** | **yes** | ⭐ Two layers: RLS Shape A on `connector_sync_runs` (§3.3) **and** app-code owner predicates. ⚠ The asyncpg pool path is NOT RLS-gated — `db/watches.py` enforces ownership in SQL (`WHERE id = $1 AND user_id = $2`, `:166`, `:183`). **The run-history read must carry the same predicate**, or a `watch_id` guess reads another tenant's history |
| V5 Input Validation | yes | Pydantic on every request model (`models/source.py`); `_as_uuid` normalisation; **every query parameterised** (`$1`-style, no f-string interpolation of values) |
| V6 Cryptography | no | This phase stores no secrets |
| V7 Error Handling & Logging | **yes** | ⛔ `last_error` currently carries `str(exc)` into a **user-visible** surface (`WatchedFoldersSection.tsx:373`). D-235-09's vocabulary is the control |

### Known threat patterns for this stack

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Cross-tenant read of another org's sync history | **Information disclosure** | RLS Shape A + explicit `user_id`/`org_id` predicate on the pool-path read. ⚠ 404-not-403 on every miss (`sources.py` idiom) |
| Leaking provider internals (tokens, URLs, stack frames) through `last_error` into the UI | Information disclosure | `MACHINE_TELLS` deny-by-default passthrough (§9.3) — an unrecognised string resolves to the honest fallback, never verbatim |
| Unbounded history growth as a storage-exhaustion vector | **DoS** | D-235-08's prune-on-write; bounded per-watch by construction |
| The verdict endpoint polled from every page becoming an amplification target | DoS | One indexed query (`idx_connector_sync_runs_watch_time`); the poll interval is a knob; ⚠ **do not** put it on `knowledge_health.py`, whose 8 routes are full table scans over `audit_log` |
| A `/sync` refusal leaking operator config to a member | Information disclosure | ⚠ BUILD-CONTRACT §4 is explicit: the operator half naming `WATCH_PROCESS_ENABLED` is **marked** and separate from `readerOffMember`. The member sentence must not name the env var |
| SQL injection through the retention `N` | Tampering | It is an int from `config.py`, bound as `$n` — never interpolated |

⛔ **No new credential scope, no new outbound egress, no new untrusted-content path.** A full threat
model is not indicated for this phase (contrast Phases 231/234, which carried mandatory ones).

---

## Environment Availability

| Dependency | Required by | Available | Version / value | Fallback |
|---|---|---|---|---|
| `backend/venv` python + pytest | backend baseline | ✅ | ran, 116.5 s | — |
| node + npx vitest | frontend gate | ✅ | ran, exit 0 | — |
| Local Supabase (54322) | applying mig 172 | ⚠ **not probed this session** | — | Operator pastes into the SQL editor; the phase does not need a live DB to plan |
| `WATCH_PROCESS_ENABLED` | the loop existing at all | ✅ **`true`** in `backend/.env` | measured (C-5) | — |
| Google Drive connection | G-4 lived UAT | ⚠ not probed | — | The 234 verification proved one exists and works |
| `scripts/check-deploy-drift.sh` | only if §5.5 adds an env knob | ✅ present | — | — |

**Missing with no fallback:** none.
**Not probed (state it, do not assume):** the local Supabase stack and a live Drive connection —
both are operator-owned and both matter only at execution/UAT, not at planning.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The asyncpg pool connects as a role that bypasses RLS, so a pool-path INSERT into `connector_sync_runs` succeeds without an `authenticated` INSERT grant | §3.4, §5.4 | The insert silently fails (caught by `release_watch`'s swallow) and history stays empty. **Mitigation: keep the 168 grant block verbatim rather than narrowing it, unless the pool role is verified first.** ⚠ Inferred from `db/watches.py` writing `connector_watches` successfully over the same pool — **not directly verified** |
| A2 | `N = 200` is the right retention bound | §5.5 (D-235-08 says "~200") | Too low loses history a person wanted; too high grows the table. It is a knob, so the cost of being wrong is one setting change |
| A3 | A 60 s badge poll is acceptable load | D-235-05 discretion | Too aggressive on a large tenant. The endpoint is one indexed query; measure before tightening |
| A4 | Mobile (the `ChatLayout` drawer) is OUT of scope for the badge | §14.3 | ⛔ **SC#3 would be closed against a desktop-only signal.** This is the single most likely place SURF-03 gets closed against its own sentence a second time — **must be an explicit decision, not an omission** |
| A5 | `skipped_type` / `skipped_size` per-file states are unreachable today, so BUILD-CONTRACT §1c's `too_big` sentence has no producer | §3.5 | A sentence ships that nothing can reach — harmless but dishonest. Verified by grep over `watch_service.py`; not exhaustively verified across future adapters |

---

## Open Questions (RESOLVED)

> ⭐ **All five were resolved at planning (2026-09-06) and each names its owning plan.** The heading
> carries the suffix so a later reader cannot mistake a settled question for an open one — a
> question that reads `open` forever is the seeds-register failure mode one file over.

1. **Should the backend ceiling of 71 be re-pinned to 72?**
   ✅ **RESOLVED — owner: plan `235-12`.** Not re-pinned inside this phase; 72 is stated as the
   measured starting point in every plan and the ceiling question is escalated to the operator
   as a decision, never silently applied.
   - Known: measured 72 here and 72 on 234's merge base; the failures are the pre-existing rot cluster.
   - Unclear: CLAUDE.md says *"Never weaken this ceiling without explicit operator authorisation."*
   - **Recommendation:** do **not** re-pin inside this phase. State 72 as the measured starting point
     in every plan, and raise the ceiling question to the operator separately. A surface phase is
     the wrong place to move a project-wide gate.

2. **Does the mobile drawer get the badge?**
   ✅ **RESOLVED — owner: plan `235-09` Task 3. YES, it is BUILT, not deferred:** the drawer's
   Library nav button carries the same badge (`aria-hidden`, so it cannot rename the control) and
   the drawer-opening hamburger carries a dot so a CLOSED drawer still signals; both read the same
   `ATTENTION_PRODUCERS` conditions — one producer, two renderers, no second fetch. The one
   residual (`onOpenDrawer` reaches only `ChatArea`, so a mobile non-chat view has no drawer
   trigger at all) is **pre-existing**, was not created here, and is planted as a seed with a
   concrete `trigger_when` rather than left silent. See A4. **Recommendation: yes, or an explicit written
   deferral with a trigger.** Closing SURF-03 against a desktop-only signal is the same class of
   error as closing it against the Health tab, which D-235-01 already rejected once.

3. **Is `--emit` fixed, or is §2 read as the distinct-set contract?**
   ✅ **RESOLVED — owner: plan `235-03`. Fixed:** `--emit-json` is added using the existing
   `region()` helper, and the region-scoped JSON is what the fence imports, so the contract is
   never transcribed by hand.
   - **Recommendation:** fix it (C-8/C-10) — the `region()` helper already exists and it is ~20
     lines; a regenerated, region-scoped JSON is what makes the fence non-transcribed.

4. **Where does `record_skipped_still_running` land?**
   ✅ **RESOLVED — owner: plan `235-05`.** Resolved in the run-row work, so the documented status
   and the code that writes it agree. Leaving a documented status nothing writes is how C-6
   happened, and this phase does not repeat it.
   - Known: dead import at `watch_service.py:32`; only a unit test calls it; its status is in mig
     168's COMMENT.
   - **Recommendation:** call it (there is a real skip case when a lease is live) **or** delete it
     and its COMMENT entry. Leaving a documented status nothing writes is how C-6 happened.

5. **Does the `paused` arm get a run row?**
   ✅ **RESOLVED — owner: plan `235-05`. YES:** `status='paused'`, all counts zero,
   `listing_complete = false`. D-235-07 says every tick gets a row, and a paused tick is a tick.

   A watch paused because its connection was disabled did
   not *read* — but it did *tick*. **Recommendation: yes, `status='paused'`, all counts zero,
   `listing_complete = false`** — D-235-07 says every tick gets a row, and this is a tick.

---

## Sources

### Primary (HIGH confidence — read in this session)
- `backend/app/services/watch_service.py` (458 L, full read)
- `backend/app/db/watches.py` (439 L, full read)
- `backend/app/api/sources.py` (356 L, full read)
- `backend/app/models/source.py` (79 L, full read)
- `backend/app/api/knowledge_health.py` (:1-90, :572-700, route list)
- `backend/app/config.py:1190-1207` · `backend/app/main.py:555-605`, `:821-862`
- `supabase/migrations/168_connector_watches.sql` (122 L, full) · `169_connector_watch_items.sql` (119 L, full)
- `frontend/src/components/sources/WatchedFoldersSection.tsx` (393 L, full) + `.test.tsx:1-60`
- `frontend/src/components/library/ingestionErrorVocabulary.ts` (206 L, full)
- `frontend/src/components/library/__tests__/ingestionFailureCopy.test.ts` (270 L)
- `frontend/src/components/library/__tests__/sketchComposition.test.tsx` (527 L)
- `frontend/src/components/library/HealthTab.tsx` (184 L, full) · `IngestionTab.tsx` (grep + :218-236)
- `frontend/src/components/layout/NavPanel.tsx` (237 L, full) · `frontend/src/lib/nav-items.ts` (95 L, full)
- `frontend/src/pages/LibraryPage.tsx` (:95-205, :725-850) · `frontend/src/pages/librarySelection.ts:138-152`
- `frontend/src/components/layout/ChatLayout.tsx:750-880` · `frontend/src/App.tsx:96-130, :300-306`
- `frontend/src/lib/api/sources.ts` (:1-140)
- `scripts/vitest-count-gate.cjs` (:122, :3160-3198, :3568-4493)
- `.planning/sketches/233-the-source-says-what-it-did/drive.cjs` (:44-100, :334-448) + `index.html` (:309-450)

### Commands RUN in this session
- `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) → **exit 0**, verdict quoted §10.1
- `pytest tests/unit -q --continue-on-collection-errors` (backend, venv) → tail quoted §11
- `git log --follow` triples for 14 files → §14.4
- `python` read of `backend/.env` filtered to `WATCH_*` → §12
- `awk`/`grep` derivation of `TARGETS` directory entries → §10.2

### Documents read
- `235-CONTEXT.md` · `BUILD-CONTRACT.generated.md` · `.planning/ROADMAP.md` (Phase 235 block, SURF-03 options, corrections)
- `.planning/REQUIREMENTS.md` (LIB-10, SURF-02/03, the phase table)
- `.planning/reported-bugs/watch-sync-button-reports-success-for-work-that-cannot-happen.md` (full)
- `.planning/reported-bugs/completed-document-with-no-ingestion-job-row.md` · `classification-never-runs-on-the-queue-ingest-path.md` (frontmatter — **status `closed`, `folded_into: quick-260906-5qd`**; the `ingest_enrich.py:494-537` extraction and `tests/unit/test_ingest_enrich_shared.py` both verified present, so **D-235-18 is DISCHARGED**)
- `SEED-239` · `SEED-248` · `SEED-185` (frontmatter + measurement sections)
- `234-VERIFICATION.md` (full)
- `CLAUDE.md` (rules, guardrails, hot-file ledger)

### Not consulted
No external documentation, no Context7, no web search. **Nothing in this phase requires a library
that is not already in the tree** — every recommendation above is a shape this repository already
ships. Adding a dependency here would be a finding to raise, not a default.

---

## Metadata

**Confidence breakdown:**
- Existing-code measurements: **HIGH** — every file:line was read in this session
- Gate figures: **HIGH** — both commands were RUN, verdicts quoted verbatim
- `WATCH_PROCESS_ENABLED` value: **HIGH** — measured from the operator's real `.env`
- Migration 172 shape: **MEDIUM-HIGH** — the RLS/trigger/grant idiom is copied verbatim from a
  shipped migration; the column set is a recommendation within Claude's discretion. ⚠ A1 (pool role
  vs. grants) is the one unverified link
- The `--emit` artifact analysis (C-8/C-10/C-11): **HIGH** — read the emitter's source and its own
  contradicting docblock
- SURF-03 navigation cost (§14.2): **HIGH** — traced the full chain; the `initialTab` gap is
  measured, not inferred

**Research date:** 2026-09-06
**Valid until:** ⚠ **~7 days.** Two of the figures here (the vitest gate total, the hot-file triples)
are measured to rot in 1-9 days by this project's own published trajectory. **Re-derive the gate
verdict and the backend baseline at the start of execution rather than quoting this document.**
