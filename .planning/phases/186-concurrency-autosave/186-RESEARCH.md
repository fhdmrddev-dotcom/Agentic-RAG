# Phase 186: Concurrency & Autosave — Research

**Researched:** 2026-08-01
**Domain:** Optimistic concurrency control over Postgres/asyncpg + React 19 debounced-write hook composition
**Confidence:** HIGH (every load-bearing claim was executed against the live local stack or read at `file:line`; the two `[ASSUMED]` items are listed in the Assumptions Log)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `.planning/phases/186-concurrency-autosave/186-CONTEXT.md` `<decisions>`.

**Autosave trigger & cost**

- **D-186-01 — One debounce rule, on any edit.** Any change to the definition schedules a
  PATCH ~500–1000 ms after the author stops typing/editing. One uniform rule, one timer,
  one writer. Reuses the shape already shipped twice: `VALIDATE_DEBOUNCE_MS = 500`
  (`frontend/src/hooks/useLiveValidation.ts:92`) and `CONFIG_COALESCE_MS = 500`
  (`frontend/src/components/workflows/builderStore.ts:88`). Rejected: split
  structural-immediate / config-debounced (two code paths, two failure modes);
  commit-points-only (leaves a long loss window open).
- **D-186-02 — Cosmetic edits never enter the autosave path.** The 184-07 browser-local
  `canvasNudge` module stays exactly as shipped. CONCUR-01's *"a cosmetic drag never
  mints a version"* must remain true **by construction** (the module imports neither the
  builder store, the canvas model, nor the API client), not by a rule someone has to
  defend. Do not route drag offsets through the new hook.
- **D-186-03 — Keep the explicit Save button; add a quiet status.** Autosave runs
  silently with a quiet `Saving… / Saved · just now` status line. Phase 184's explicit
  "Save draft" button survives as the deliberate *commit-now* affordance and keeps its
  `Saved ✓`. The unsaved-work leave guard (`UNSAVED_LEAVE_PROMPT` +
  `beforeunload`) survives too, but **changes meaning** — from *"you forgot to save"* to
  *"a write genuinely failed"*, which is exactly when it should fire. Nothing shipped and
  tested gets deleted.
- **D-186-04 — On a shape-invalid definition: hold the write and say why.** `PATCH
  /{definition_id}` takes a Pydantic `WorkflowDefinition`, so a mid-edit state can 422.
  When it does: **do not write**, keep the draft dirty, and state it honestly
  (`Not saved — <reason>`), never a false `Saved ✓`. Key on the server verdict already
  available: `useLiveValidation` runs `POST /workflows/validate` on the same 500 ms
  debounce and already models an `unreadable`/422 branch. This is the T-185-04-01 lesson
  applied — never file a receipt for something that did not happen.
- **D-186-05 — Extract `useDraftPersistence`.** One hook owns the whole seam:
  create-once-then-PATCH, the debounce timer, dirty/saved state, the concurrency token,
  the hold conditions, and the honest error branches. The page composes it and passes
  props down, exactly as it already composes `useLiveValidation`. Honours the D-184-05
  promise, keeps `WorkflowBuilderPage.tsx` a composition point, and gives the concurrency
  logic a single testable home. **Do not** widen the extraction to selection or
  validation wiring — that is churn against surfaces 185 just verified.

**Clobber guard mechanism**

- **D-186-06 — Build for the reachable conflict, and say so.** The guard targets the same
  user across two tabs / two devices / a stale tab. The mechanism is **identical** either
  way — it keys on *"the row moved since I read it"*, not on *who* moved it — so this
  costs nothing in future-proofing. Adding a workflow org-share toggle is **out of scope**
  (new capability, migration + RLS rewrite + sharing UI). CONCUR-02's literal "two people"
  wording is recorded as currently-unreachable rather than quietly satisfied.
- **D-186-07 — Optimistic token = an OPAQUE string over `updated_at`.**
  `workflow_definitions.updated_at` already exists and is already bumped by the
  `set_updated_at` trigger on every UPDATE (mig 056). Serve it to the client as an opaque
  token; add `AND updated_at = $N` to the PATCH WHERE — 0 rows means someone else wrote.
  **Zero migrations** — the phase's no-migration promise holds.
  **HARD CONSTRAINT for the plan:** the client must echo the server's exact string
  verbatim and **never parse it into a JS `Date`** — ms precision would silently truncate
  Postgres microseconds and every save would 409. If research finds the round-trip cannot
  be made safe, the fallback is a `revision integer` column at migration slot **115** —
  which requires amending the zero-migration contract **in the open** (the 185-13
  precedent), never silently.
- **D-186-08 — On conflict: stop writing, honest banner, escape hatch.** The losing tab
  halts autosave immediately (no retry storm, no silent overwrite) and states plainly what
  happened — *"This draft was changed somewhere else. Reload to get the newer version, or
  overwrite it with what's on screen."* **Reload is the default; overwrite is a deliberate
  second click.** No work is trapped and no work is lost by accident. Satisfies SC#4 as
  written and mirrors the honest-refusal vocabulary Phase 185 established. Rejected:
  silent reload (relocates the clobber to the client); soft-lock (needs leases,
  heartbeats and expiry — materially more machinery than a token, and strands an author
  behind their own crashed tab).
- **D-186-09 — A stale token must never surface as 404.** Adding `AND updated_at = $N`
  creates a collision: 0 rows → `None` → the existing route maps it to
  **404 "draft not found"**, which is a lie; and 184-11 (D-184-16 debt 3) already spent
  the 409 slot on the published-row sentence. On 0 rows, **re-read the row owner-scoped**
  and branch on the real cause:
  - missing / not-owned → **404** (the existence-leak collapse stays closed)
  - `status = 'published'` → **409** `already_published` (today's sentence, unchanged)
  - row exists, token differs → **409** with a **distinct machine-readable code**
    (e.g. `stale_token`)

  The client branches on the code, **never on the prose**. Costs one extra query on the
  failure path only.

**Publish / dirty-draft guard (SC#3)**

- **D-186-10 — Carry the token through the gauntlet; refuse on drift.** Capture the token
  at stage 0 and add `AND updated_at = $N` to the stage-5 flip
  (`publish_definition`, `backend/app/db/workflows.py:327`). If the draft moved, the flip
  matches 0 rows and publish returns an honest **new `blocked_stage`** — *"the draft
  changed while it was being checked — re-publish to check the new version"* — with the
  golden run and its `harness_audit` rows **preserved** as the real record of what was
  tested. Reuses the exact WR-03 sentinel shape already in `publish_definition`, and makes
  *"we published what we validated"* structurally true rather than merely likely.
  Rejected: a `publishing` freeze state (needs a release path on every crash/timeout/worker
  death; a stranded row is unrecoverable without an operator); publish-the-snapshot
  (silently discards later edits — a clobber wearing a different hat).
- **D-186-11 — The new `blocked_stage` needs NO migration.** Verified: `blocked_stage` is
  free-form **metadata** on the already-registered `publish_blocked` event type
  (`publish_service.py:_block`, `event_type="publish_blocked"`), and the API model types it
  as `blocked_stage: str | None` (`backend/app/api/workflows.py:760`). Unlike 185-13's
  `action_risk_pending`, this does **not** touch the `harness_audit` event_type CHECK.
  ⚠ It **does** need a worded verdict on the client — the Phase 127 energized pip-strip maps
  stages to sentences; a new stage without one falls through to a generic.
- **D-186-12 — Client holds writes while a publish is in flight.** Same
  hold-and-say-why mechanism as D-186-04, second reason: *"Publishing — changes will save
  when it finishes."* Edits accumulate as dirty and flush on resolution. This prevents the
  wasted golden run (minutes + real provider cost burned by one stray keystroke); the
  stage-5 token check (D-186-10) stays as the backstop that makes the guarantee
  **structural rather than cooperative**. One code path, two sentences.
- **D-186-13 — The SC#10 parallel-axis UAT is two tabs, same account, driven live.**
  Three browser-driven rows, all reachable in the product:
  1. **Two tabs** — same draft open twice; edit in A, then edit in B → B shows the honest
     banner and stops writing, never overwrites.
  2. **Stale tab** — leave a tab open, edit elsewhere, return later → same honest outcome.
  3. **Publish race** — start a publish, edit mid-gauntlet → honest refusal + the
     golden-run receipt preserved.

  The colleague-clobber row is recorded **⛔ with its reason** (blocked by owner-only
  UPDATE — see finding 2), **never silently dropped** — the scoreboard rule. An automated
  concurrent-PATCH backend test is worth having as well, but per **G-4** wire-format
  evidence alone is insufficient for a user-visible surface.

**BUG-260731-03 routing + KB binding (folded)**

- **D-186-14 — Split the blocking bug: control here, verdict in 187.** 186 folds the
  **minimum** fix — `project_folder_id` as an editable **workflow-level** setting on the
  built canvas, persisted through the very save path this phase is rebuilding. 187 keeps
  the **necessary** half: the deterministic build-time `/validate` `incomplete` verdict,
  which is validation-envelope work (SEED-132) and belongs with 187's SC#3
  safe-by-construction claim (the bug is a direct counterexample to it).
- **D-186-15 — The control is the existing header chip, promoted.** The builder header
  already renders a display-only `📁 Project Meridian — Risks` chip for a bound workflow —
  *visible, never editable*. Make it the picker: click to bind or re-bind, reusing the
  component that already exists at `WorkflowBuilderPage.tsx:1347-1367`. Show an **explicit
  unbound state** rather than rendering nothing. This is reachable from **all three**
  creation paths (NL generate, authoring fresh, forking a starter) because every one of
  them lands in the builder — and two of the three never offer the choice at all today.
  Rejected: a net-new workflow-settings panel (fires G-2 sketch-first; well beyond this
  phase's UI budget of a status line + a conflict banner).
- **D-186-16 — An invitation on the chip, never a verdict.** The unbound chip states the
  consequence plainly — *"No knowledge base · searches everything"* — as a neutral fact
  about configuration. **No severity, no code, no problems-tray row, nothing in the node
  marks.** Follows the `EMPTY_DRAFT_INVITATION` precedent exactly (D-184-15: *"an
  INVITATION, not a claimed verdict"*), so **D-182-06 stays intact** — the server still
  owns every verdict. Rejected: making binding mandatory at creation (a behaviour change
  to three flows and to whole-KB retrieval semantics, `scope.py` D-06 — that is a
  requirements change, not a bug fold).
- **D-186-17 — Correction to the bug's ordering constraint.** The report warns that a phase
  declaring `folder_scope` on an unbound workflow raises a raw Pydantic 422
  (`_folder_scope_requires_project`, `backend/app/models/harness.py:294`), and that the
  workflow-level binding must therefore be settable first. Verified: `folder_scope` is
  currently **read-only** in `PhaseFormPanel` (a bound display at `:347` / `:370-385`), so
  that dead end is **not reachable today**. It becomes reachable — and would combine badly
  with D-186-04's hold-the-write rule to produce a permanently-unsaveable draft — the
  moment any phase makes that field editable. **Carry this forward to whichever phase
  makes `folder_scope` editable.**

### Claude's Discretion

- Exact debounce constant within the 500–1000 ms band (align with the two shipped
  constants unless research shows a reason not to).
- Exact wording of the conflict banner, the hold sentences and the new `blocked_stage`
  verdict — the *content* is locked by D-186-08 / D-186-04 / D-186-12 / D-186-10; the
  phrasing is not.
- Whether `builderStore`'s currently-unread `saveState` slot earns its keep or is retired
  (`builderStore.ts:199` explicitly leaves this call to Phase 186).
- Whether the stale-token conflict uses 409-with-code or 412 Precondition Failed — the
  hard constraints are D-186-09's two rules (never 404; the two causes must be
  machine-distinguishable).

### Deferred Ideas (OUT OF SCOPE)

- **Workflow org-share toggle** (`is_org_shared` on `workflow_definitions` + RLS rewrite +
  sharing UI) — a new capability, its own phase. Re-open trigger: the first customer ask
  for a genuinely shared workflow, or when Dept-Admin (v3.4 carry-forward 169) lands.
  Until then CONCUR-02's "two people" wording is recorded as unreachable, not satisfied.
- **Real-time collaborative multi-cursor editing (CRDT/OT)** — already cut as **OPEN-04**
  in `.planning/REQUIREMENTS.md:77`. The soft-lock/token is the v3.6 answer.
- **SEED-138 — `definition` jsonb double-encoded (118/145 rows).** *Reviewed, not folded.*
  Autosave silently **heals on write**: `update_workflow_definition` already writes
  correctly (`json.dumps(...)` + `$N::jsonb`), so any draft an author touches is rewritten
  clean. The defensive `json.loads` at `publish_service.py:126` stays until a real
  backfill. No backfill in 186. **Re-open trigger:** the first non-fixture production rows,
  or any read path that cannot tolerate the defensive decode.
- **`BUG-260731-03` verdict half** — the deterministic build-time `/validate` `incomplete`
  verdict for an unbound retrieval workflow → **Phase 187**.
- **Making `folder_scope` editable per-phase** — out of scope here; D-186-17 records the trap.
- **A dedicated workflow-settings panel** — rejected for 186 (fires G-2, exceeds the UI budget).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (`.planning/REQUIREMENTS.md:54-55`) | Research Support |
|----|-------------|------------------|
| **CONCUR-01** | Editing a draft on the canvas autosaves by updating the draft row in place — a cosmetic node drag never mints a new definition version or re-arms the golden-run gauntlet. | Already true by construction and **must be kept so**: `update_workflow_definition` (`db/workflows.py:413-422`) is `UPDATE … SET name, definition` and never touches `version` [VERIFIED: code read]. `canvasNudge.ts` is browser-local and imports no API client. Research §"Don't Hand-Roll" and §"Autosave hook mechanics" specify the single-flight write path that keeps this true once autosave exists. |
| **CONCUR-02** | Two people editing the same org-shared workflow cannot silently clobber each other — a concurrency guard protects the shared draft; publish is guarded against reading a dirty draft. | Research §1 delivers a **falsification-tested** optimistic token (`to_char` over `updated_at`), §2 the honest failure-path contract, §4 the publish-race guard. The literal "two people" case is unreachable (owner-only UPDATE, mig 108 §5) — recorded ⛔ with reason per D-186-06/D-186-13. |
</phase_requirements>

---

## Summary

Three things about this phase were genuinely open, and all three now have evidence.

**First, the token.** D-186-07's plan — "add `AND updated_at = $N`" — does **not** work as
written, and the reason is not the one the context predicted. The workflows read/write path
runs on **asyncpg** (`pool.fetchrow`), not `supabase-py`, and asyncpg **refuses to bind a
string to a `timestamptz` parameter at all** — including with an explicit `$N::timestamptz`
cast. Executed against the live stack, both forms raise
`DataError: … expected a datetime.date or datetime.datetime instance, got 'str'`. So the
naive shape is a runtime error on the first stale-check, not a subtle precision bug. The
recommended fix is small and *safer* than the alternatives: render the token in SQL with
`to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` on **both** the
read and the guard, and type it `str` end-to-end. That form was proven equal-on-round-trip,
timezone-independent, constant-width, and correctly blocking. **The zero-migration contract
holds** — no slot 115 needed.

**Second, the publish spine renders a refusal as a pass.** D-186-11 warned that a new
`blocked_stage` "falls through to a generic". It is worse than that. `GauntletSpine`
computes `blockedIndex = STAGES.findIndex(...)`, which is `-1` for an unrecognised stage,
and line `PublishGauntlet.tsx:338` then reads `isPassed = blockedIndex === -1 ? !running : …`
— so an unrecognised block paints **all eight stages green with ✓ badges** while the
headline says `Blocked early — draft_changed`. That is a fail-open visual of exactly the
T-185-04-01 class this phase exists to prevent, and it is reachable the moment D-186-10
ships. Two changes are required, not one: a `STAGES` entry *and* a fix to the `-1` branch so
an unknown stage can never paint the spine green.

**Third, the KB chip does not arm anything.** `builderStore`'s dirty subscription fires only
on a **`phases`** reference change (`builderStore.ts:592-597`), and `hasEdited` explicitly
*excludes* `meta` changes (`WorkflowBuilderPage.tsx:715`). So promoting the header chip into
a picker that writes `meta.project_folder_id` would change the definition, produce a new
`definition` memo identity — and set neither `dirty` nor `hasEdited`. The leave guard would
not arm and validation would not start. The write must arm both explicitly.

**Primary recommendation:** token = a `to_char`-rendered UTC ISO string, `str`-typed on every
model, identical expression on read and guard; stale token = **409 + `{code:"stale_token"}`**
(not 412) because the shipped client already has a 409 branch and a named-error idiom to
extend; `useDraftPersistence` owns a **single-flight, never-aborted** write queue keyed on
`definition` identity with hold conditions read from refs; the store's `saveState` slot is
**retired**.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Concurrency token minting | Database (Postgres `set_updated_at` trigger) | — | The trigger already fires on every UPDATE; the value must be produced where the write happens or it is not authoritative. |
| Token rendering / canonical form | Database (SQL `to_char`) | — | Read and guard must use the **identical expression** or equality is not guaranteed. Rendering in Python would create two formatters. |
| Token comparison / clobber refusal | API / Backend (`db/workflows.py` WHERE clause) | — | The service role bypasses RLS; the WHERE is the only enforcement point (T-103-01-01 precedent). A client-side check would be advisory only. |
| Stale-vs-published-vs-missing disambiguation | API / Backend (route, `api/workflows.py`) | — | Requires an owner-scoped re-read; a client cannot distinguish these without an existence leak. |
| Publish/dirty-draft refusal | API / Backend (`publish_service` stage 0 + stage 5) | — | Must be a WHERE-guard on the flip, not a cooperative client hold — D-186-12 explicitly makes the server the backstop. |
| Autosave debounce / coalescing | Browser / Client (`useDraftPersistence`) | — | Edit cadence is a client fact; the server sees only committed writes. |
| Write ordering / single-flight | Browser / Client (hook refs) | — | Only the client knows which of several in-flight edits is newest. |
| Hold-the-write decision | Browser / Client (hook) | API (422 backstop) | Best-effort client hold + authoritative server 422 — the client hold saves a wasted round trip, the server 422 is what makes it honest. |
| Conflict banner + escape hatch | Browser / Client (page) | — | Pure presentation of a server verdict; the client re-derives nothing. |
| `project_folder_id` binding | Browser / Client (store `meta`) | API (persisted via the same PATCH) | It is a definition field; D-14 forbids a second source of truth. |
| Retrieval-scope consequence of an unbound workflow | API / Backend (`scope.py` D-06) | — | Unchanged in this phase; the client states the consequence but computes nothing (D-186-16). |

---

## Project Constraints (from CLAUDE.md)

Directives that bind this phase. The planner must verify each plan against these.

| Constraint | Effect on Phase 186 |
|---|---|
| Python backend must use a `venv` | All backend test/verify commands run via `backend/venv/Scripts/python.exe`. |
| No LangChain / no LangGraph | Not applicable — no LLM work in this phase. |
| Pydantic for structured LLM outputs | Token models are plain `BaseModel` fields; see §1 for the `str`-vs-`datetime` typing rule. |
| All tables need RLS | No new tables. `workflow_definitions` RLS is unchanged (mig 108 §5). |
| Stream chat responses via SSE | Not applicable. |
| Migrations = numbered SQL under `supabase/migrations/`, applied by pasting into the Supabase SQL editor, then `bash scripts/regenerate-full-schema.sh` | **Phase 186 requires ZERO migrations** (§1 recommendation). Head is `114_harness_audit_action_risk_pending.sql`; slot 115 stays free. If the fallback is ever taken, this whole procedure applies and the contract amendment is surfaced in the open (185-13 precedent). |
| Do not run blocking I/O directly in async handlers | The workflow path is already fully async asyncpg — no `run_in_threadpool` needed. Do **not** introduce `supabase-py` into this path. |
| Deployment-artifact parity (same-commit rule) | No env vars, no bundled services, no sandbox-image change → `scripts/check-deploy-drift.sh` unaffected. |
| **G-4 lived-experience UAT gate** | Fires — this phase touches user-visible UI. Three operator-defined browser rows are already locked by D-186-13. |
| **G-5 hot-file ledger** | `WorkflowBuilderPage.tsx` is a firing row. See §"G-5 status" below — the phase **satisfies** it by construction (the extraction *is* the honoured refactor). `WorkflowCanvas.tsx` (extraction due in 188) must **not** be touched. |
| **G-6 failure criteria upfront** | Satisfied by the `## Validation Architecture` falsification table below. |
| **UAT scoreboard recipe** — "blocked, never silently omitted" | The colleague-clobber row is ⛔ with its reason, in the table. |
| **Reported-bugs cross-check at plan-phase** | `BUG-260731-03` carries `folded_into: "186 (control) / 187 (verdict)"`. At least one plan task must cover D-186-15 + D-186-16. It must **not** flip to `closed` when 186 ships. |

### G-5 status for this phase

| File | Ledger status | 186's effect |
|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | Firing row (184 = 3rd authoring door) | **Honoured by construction.** D-186-05's `useDraftPersistence` extraction removes `onPersist`, `onSaveDraft`, `draftIdRef`, `creatingRef`, `saveState`, `saveErrorMessage`, `savedTimerRef` and the `beforeunload`/`canLeave` pair from this file. Net line count should go **down**. The planner should record the measured `git diff --stat` as the evidence, exactly as 185 did for `PhaseFormPanel.tsx`. |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | **G-5 fires — extraction due in Phase 188** | 186 needs **zero** changes here. The status line and conflict banner live in the page header (`identityGroup` / `actionGroup`, `:1533-1594`); the canvas toolbar already receives `saveState` through the existing `CanvasSession` prop (`:1237-1270`). If a plan proposes touching `WorkflowCanvas.tsx`, that is a guardrail fire the orchestrator must surface. |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | Watch (2 phases) | Untouched by 186. |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | G-5 honoured at 185 | Untouched by 186 (D-186-17 explicitly defers the `folder_scope` control). |

---

## RECOMMENDATION 1 — The optimistic token (D-186-07) · CRITICAL

### What the evidence says

All results below come from `token_roundtrip.py`, executed against the live local Supabase
(`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) on 2026-08-01 using
`backend/venv`'s asyncpg. The probe created a throwaway table with the **real**
`public.set_updated_at` trigger attached, exercised it, and dropped it.

| # | Probe | Result | What it proves |
|---|---|---|---|
| — | `SHOW server_version` | `17.6` | PG 17; `to_char` `US` semantics are stable. |
| — | `SHOW TimeZone` | `UTC` | Local default only — **not** guaranteed on cloud (see G below). |
| — | asyncpg type for `timestamptz` | `datetime`, `tzinfo=timezone.utc`, `microsecond=363036` | **Microseconds survive the driver.** No precision loss on the Python side. |
| A | `dt.isoformat()` → `fromisoformat()` → bind as `datetime` | **matched** | A datetime round trip is lossless *if* the server re-parses. |
| **B** | Bind a **millisecond-truncated** datetime (what `new Date(iso)` produces) | **matched = false** | **D-186-07's hard constraint confirmed with evidence.** A JS-`Date` round trip matches **zero** rows — every save would conflict. |
| **C** | Bind the ISO **string** to `WHERE updated_at = $2` | `DataError: invalid input for query argument $2: '2026-07-31T19:55:38.363036+00:00' (expected a datetime.date or datetime.datetime instance, got 'str')` | **The naive D-186-07 shape does not compile at runtime.** |
| **D** | Same, with explicit `$2::timestamptz` cast | **same `DataError`** | The cast does **not** help — PostgreSQL resolves the parameter type to `timestamptz`, so asyncpg still demands a `datetime`. |
| **E** | `to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') = $2` with the string | **matched** | The recommended form works. |
| **F** | Same expression re-evaluated under `SET TimeZone 'Asia/Kolkata'` | `2026-07-31T19:55:38.363036Z` — **identical** | The `to_char` token is **timezone-independent**. |
| **G** | `updated_at::text` under `Asia/Kolkata` | `2026-08-01 01:25:38.363036+05:30` — **different** | A bare text cast is **NOT** timezone-independent. Rejects the `updated_at::text = $N` option outright. |
| H | Token after a real UPDATE | changed | The trigger bumps as expected. |
| **I** | Stale writer: `… AND to_char(…) = <old token>` | **0 rows** | The guard actually guards. |
| **J** | Fresh writer with the new token | **1 row** | The guard does not over-block. |
| K | `UPDATE SET n = n` (no value change) | token **still bumps** | A no-op PATCH still invalidates other tabs. Correct, and worth knowing. |
| L | Two UPDATEs inside **one transaction** | tokens **identical** (`now()` is transaction time) | Irrelevant today (both writers are single-statement autocommit) but a latent trap if anyone wraps writes in a transaction. |
| M | Five rapid autocommit UPDATEs | **all 5 distinct** (≈1.4–3 ms apart) | Microsecond resolution is more than sufficient. |

Pydantic behaviour (`pydantic 2.12.5`, same venv):

| Form | JSON emitted | Note |
|---|---|---|
| `token: datetime` field, µs = 363036 | `"2026-07-31T19:55:38.363036Z"` | Pydantic emits `Z`, not `+00:00`. |
| `token: datetime` field, **µs = 0** | `"2026-07-31T19:55:38Z"` | **The microsecond component vanishes.** Variable-width token. |
| `token: str` field carrying the `to_char` value | `"2026-07-31T19:55:38.363036Z"` | Verbatim, always 6 fractional digits. |
| `datetime`-typed **request** field, echoing the wire value back | round-trips equal | Works — but silently accepts a lossy JS-Date string too. |

### RECOMMENDATION

**Adopt the SQL-rendered `to_char` token, typed `str` end-to-end. Zero migrations.**

Define the expression **once** in `backend/app/db/workflows.py` and reference it from every
site, so the read and the guard can never drift:

```python
# backend/app/db/workflows.py — ONE canonical definition, referenced by every query.
#
# WHY THIS EXPRESSION AND NOT `updated_at = $N`:
#   asyncpg REFUSES to bind a str to a timestamptz parameter — with or without an
#   explicit ::timestamptz cast (probed 2026-08-01, DataError both ways). Comparing
#   in TEXT space keeps the token a str from Postgres to the browser and back, so
#   "echo it verbatim" (D-186-07) is enforceable rather than merely requested.
# WHY `AT TIME ZONE 'UTC'` AND NOT `updated_at::text`:
#   a bare cast renders in the SESSION TimeZone. Probed: the same row renders
#   '...19:55:38.363036+00' under UTC and '...01:25:38.363036+05:30' under IST, so a
#   pooled connection that picked up a different TimeZone would 409 every save. This
#   form pins UTC and was proven byte-identical across both sessions.
# WHY `.US` AND NOT Python's isoformat():
#   `US` always emits 6 digits. Python's `.isoformat()` and Pydantic's datetime
#   serializer BOTH DROP the fractional part when microseconds == 0, so the token
#   width would vary with the clock. Constant width means one shape to compare.
CONCURRENCY_TOKEN_SQL = (
    "to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"
)
```

Wired into the four query sites:

```python
# create_workflow_definition  (db/workflows.py:359)
f"INSERT INTO workflow_definitions (...) VALUES (...) "
f"RETURNING id, version, {CONCURRENCY_TOKEN_SQL} AS token"

# list_draft_workflows  (db/workflows.py:380) — the Open-a-draft path's token source
f"SELECT id, slug, version, name, definition, {CONCURRENCY_TOKEN_SQL} AS token "
"FROM workflow_definitions WHERE status = 'draft' AND created_by = $1 ORDER BY name"

# get_definition  (db/workflows.py:300) — publish stage 0 captures the token here
f"SELECT id, slug, version, name, status, definition, created_by, "
f"{CONCURRENCY_TOKEN_SQL} AS token FROM workflow_definitions WHERE ..."

# update_workflow_definition  (db/workflows.py:413) — the guard + the NEXT token
f"UPDATE workflow_definitions SET name = $3, definition = $4::jsonb "
f"WHERE id = $1 AND created_by = $2 AND status = 'draft' "
f"AND {CONCURRENCY_TOKEN_SQL} = $5 "
f"RETURNING id, version, {CONCURRENCY_TOKEN_SQL} AS token"
```

> **`$N`-only discipline is preserved.** `CONCURRENCY_TOKEN_SQL` is a module-level
> constant containing no user input — it is a code literal spliced into an f-string, not
> an interpolated value. Every *value* still travels as `$N`. This is the same posture as
> the shipped queries; a plan-checker looking for "no f-string on SQL" should be told the
> distinction explicitly so it does not false-positive.

**In the RETURNING clause of the UPDATE, `to_char(updated_at …)` reads the NEW row** — the
`BEFORE UPDATE` trigger has already set `NEW.updated_at = now()`, so the response carries the
post-write token and the client can chain saves with no extra read. [VERIFIED: probe H/J.]

**Exact typing (this is the load-bearing part):**

| Surface | Type | Reason |
|---|---|---|
| `DraftCreateResponse.token` | **`str`** | A `datetime` field would re-serialize through Pydantic and drop µs when they are 0 — variable width. |
| `DraftRow.token` | **`str`** | Same. |
| PATCH request body — the token field | **`str`** | A `datetime`-typed field would happily coerce a lossy JS-Date string into a valid datetime that then matches 0 rows. Typed `str`, a wrong value becomes a **nameable 409**, not a silent mismatch. |
| SQL bind | `str` via `$N` | Compared in text space; no driver coercion. |
| Frontend | `string`, opaque | Never `new Date(...)`, never `Date.parse(...)`, never `.slice()`. |

**Where the token rides in the PATCH request.** `update_draft` currently takes
`body: WorkflowDefinition`, and `WorkflowDefinition` is `extra='forbid'` — adding a
`token` key to the definition JSON would 422, **and** it would be persisted into the
`definition` JSONB, which is wrong (D-14: the definition is the projection; the token is
transport metadata). Two clean options:

1. **An `If-Match`-style header** — `If-Match: <token>`, read via
   `if_match: str | None = Header(default=None, alias="If-Match")`. Semantically exact and
   keeps the body byte-identical. Cost: header plumbing in `updateWorkflowDraft`.
2. **A wrapper request model** — `class DraftUpdateRequest(BaseModel): definition: WorkflowDefinition; token: str`. Cost: a **breaking body-shape change** to `PATCH /workflows/{id}`; `updateWorkflowDraft` and every test that posts a bare definition must change.

**Recommend option 1 (the `If-Match` header).** It is additive (an absent header can keep
today's unguarded behaviour during the transition, then be made required), it does not touch
the `WorkflowDefinition` model or its `extra='forbid'` contract, and it is the standard HTTP
idiom for exactly this — which makes the 412-vs-409 question in §2 read naturally either way.
[CITED: RFC 9110 §13.1.1 `If-Match`.]

### The falsification test the executor runs FIRST (RED before GREEN)

```bash
# From the repo root. Proves the guard BEFORE the guard exists (expect FAIL on line I),
# then again after (expect PASS). Uses the shipped live-DB skip-guard idiom
# (backend/tests/unit/test_publish_flip.py:28-46).
cd "C:/Vibe Apps/Agentic RAG" && ./backend/venv/Scripts/python.exe - <<'PY'
import asyncio, asyncpg
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
TOK = "to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"
async def main():
    c = await asyncpg.connect(DSN)
    owner = await c.fetchval("SELECT id FROM auth.users LIMIT 1")
    rid = await c.fetchval(
        "INSERT INTO workflow_definitions (slug,version,name,status,definition,created_by) "
        "VALUES ('p186-probe',1,'p186','draft','{\"phases\":[]}'::jsonb,$1) RETURNING id", owner)
    stale = await c.fetchval(f"SELECT {TOK} FROM workflow_definitions WHERE id=$1", rid)
    await c.execute("UPDATE workflow_definitions SET name='winner' WHERE id=$1", rid)   # writer A
    loser = await c.fetchrow(                                                            # writer B, stale
        f"UPDATE workflow_definitions SET name='loser' WHERE id=$1 AND {TOK}=$2 RETURNING id", rid, stale)
    name = await c.fetchval("SELECT name FROM workflow_definitions WHERE id=$1", rid)
    print("stale writer blocked:", loser is None, "| surviving name:", name)
    assert loser is None and name == "winner"
    await c.execute("DELETE FROM workflow_definitions WHERE id=$1", rid)
    await c.close()
asyncio.run(main())
PY
```

### If (and only if) the round trip could not be made safe

It **can** — E/F/I/J all pass. The `revision integer` fallback at migration slot 115 is **not
needed** and the zero-migration contract stands. Recording this explicitly so a later reader
does not re-open it: *the fallback was evaluated, the primary approach was proven, slot 115
stays free.*

### Residual risks (small, but name them)

| Risk | Severity | Mitigation |
|---|---|---|
| Two writes landing in the **same microsecond** would produce an equal token and let a stale write through | Negligible (probe M: 5 back-to-back writes ≈1.4–3 ms apart) | None needed. Note it in the hook docblock so nobody claims the guard is absolute. |
| A future refactor wrapping two UPDATEs in **one transaction** would leave the token unchanged between them (probe L) | Low | A source comment on `CONCURRENCY_TOKEN_SQL` naming `now()`-is-transaction-time. |
| A pooled connection with a non-UTC `TimeZone` | **Eliminated** by `AT TIME ZONE 'UTC'` (probe F) | — |
| A third writer to `workflow_definitions` appearing later | Low | Verified today there are exactly **two** production writers — `db/workflows.py:328` (publish flip) and `:414` (draft PATCH). No background job, no trigger, no migration touches the row post-deploy. [VERIFIED: repo-wide grep] |

---

## RECOMMENDATION 2 — The stale-token failure path (D-186-09) · HIGH

### What the shipped code does today

```ts
// frontend/src/lib/api.ts:3341-3357 — updateWorkflowDraft
if (res.status === 409) throw new WorkflowConflictError()   // ← body NEVER read
if (res.status === 404) throw new WorkflowNotFoundError()
if (!res.ok) throw new Error(`Failed to update workflow draft (status ${res.status})`)
```

- The 409 branch **discards the body**, so a second 409 cause is invisible to the client today. [VERIFIED: `api.ts:3353`]
- `WorkflowConflictError` is consumed by name, not by `instanceof`
  (`WorkflowBuilderPage.tsx:1182-1183`) — the shipped idiom `useLiveValidation.causeOf` also uses.
- The 422 branch does **not** exist at all — a shape rejection currently becomes
  `Error("Failed to update workflow draft (status 422)")`, i.e. the generic `GENERIC_SAVE_ERROR`.
  D-186-04 needs a named class here. The exact precedent to copy is
  `WorkflowValidateUnreadableError` (`api.ts:3460-3467`) — a named error that logs the raw
  body at the boundary and never carries it into state.
- **`412` appears nowhere in this codebase** (the only hit repo-wide is a byte count in a
  test fixture). [VERIFIED: repo-wide grep]

### RECOMMENDATION

**Use 409 + a machine-readable code. Do not use 412.**

Reasoning, in order of weight:

1. **The client already branches on 409 and already discards the body.** Adding a code means
   *reading a body that is currently thrown away* — a strictly additive change at one call
   site. Adding 412 means a new status branch **plus** a body read anyway (to keep the two
   409 causes apart is no longer the issue, but the client still needs to know it is a
   conflict-with-token, not a conflict-with-freeze). 412 buys a nicer status line and costs
   the same body read.
2. **The published-freeze case is *also* a precondition failure.** If 412 is chosen for
   staleness, an honest reading says the published-row 409 should be 412 too — which is a
   change to a shipped, tested, operator-verified sentence (D-184-16 debt 3). D-186-09
   explicitly protects that sentence: *"today's sentence, unchanged"*.
3. **RFC 9110 permits both.** §15.5.10 defines 409 as "conflict with the current state of the
   target resource" — precisely this. §15.5.13 defines 412 as the `If-Match` evaluation
   failure. Since we *are* using `If-Match` (Recommendation 1), 412 is the more literal
   reading — but the RFC does not forbid 409, and specification purity does not outweigh
   "don't split one concept across two statuses in a shipped client".
   [CITED: RFC 9110 §15.5.10, §15.5.13]
4. **The one real argument for 412** — a generic HTTP proxy/cache could act on it — does not
   apply: this is a same-origin `fetch` with a bearer token behind Kong.

If the planner overrules and picks 412, the two hard D-186-09 rules are still satisfiable —
but then `PublishGauntlet`'s `httpStatusForKind` (`:124-135`) and the `PublishOutcome` union
would need a 5th kind for symmetry, which is more surface than the phase's budget.

### The exact response body

FastAPI's `HTTPException(detail=...)` nests the payload under `detail`, which is the shape the
client already handles for the publish 400 (`api.ts:3628-3631`). Follow it:

```python
raise HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={
        "code": "stale_token",
        # The prose is for a human reading logs. The CLIENT BRANCHES ON `code`, NEVER
        # ON THIS STRING (the WorkflowValidateUnreadableError / causeOf precedent).
        "message": "this draft was changed somewhere else since you loaded it",
        # The CURRENT token, so "overwrite with what's on screen" is ONE more PATCH
        # rather than a re-read + a PATCH. Safe to return: the re-read below is
        # owner-scoped, so the caller already owns this row and learns nothing new.
        "token": current_token,
    },
)
```

And the published case keeps a code so the client can stop string-matching:

```python
raise HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={"code": "already_published",
            "message": "workflow is published and cannot be modified"},
)
```

> ⚠ **This changes the shape of an existing 409 detail** from a bare string to an object.
> `updateWorkflowDraft` ignores the body so the client is unaffected — but any **backend
> test** asserting `exc.detail == "workflow is published and cannot be modified"` will break.
> `backend/tests/unit/test_103_published_409.py` is the likely one. The planner must budget
> for updating it, and must **not** delete it (guard the COUNT).

### The query order that keeps the 404-collapse closed

The disambiguating re-read must be **owner-scoped**, and it must run only after the guarded
UPDATE returns 0 rows. The order below is the one that preserves T-103-01-01:

```python
async def update_workflow_definition(pool, definition_id, *, definition, user_id, token):
    """Returns {id, version, token} on success, or a REFUSAL dict naming the cause.

    THE GUARD IS ADDED ALONGSIDE THE OWNER SCOPE, NEVER IN PLACE OF IT. `created_by = $2`
    is the ONLY authorization boundary on this table for the service-role pool (it bypasses
    RLS), so the token clause is a THIRD conjunct — a concurrency check, not an authz check.
    """
    row = await pool.fetchrow(
        f"UPDATE workflow_definitions SET name = $3, definition = $4::jsonb "
        f"WHERE id = $1 AND created_by = $2 AND status = 'draft' "
        f"AND {CONCURRENCY_TOKEN_SQL} = $5 "
        f"RETURNING id, version, {CONCURRENCY_TOKEN_SQL} AS token",
        definition_id, user_id, definition.name,
        json.dumps(definition.model_dump(mode="json")), token,
    )
    if row is not None:
        return {"ok": True, **dict(row)}

    # 0 rows. FOUR causes are now conflated; disambiguate with ONE owner-scoped re-read.
    # OWNER-SCOPED IS LOAD-BEARING: a re-read WITHOUT `created_by = $2` would answer
    # "that row exists but isn't yours" — the existence leak the 404-collapse closes.
    # This query can only ever describe a row the caller ALREADY OWNS.
    probe = await pool.fetchrow(
        f"SELECT status, {CONCURRENCY_TOKEN_SQL} AS token FROM workflow_definitions "
        f"WHERE id = $1 AND created_by = $2",
        definition_id, user_id,
    )
    if probe is None:
        return {"ok": False, "cause": "not_found"}          # missing OR not-owned -> 404
    if probe["status"] == "published":
        return {"ok": False, "cause": "already_published"}  # -> 409, today's sentence
    return {"ok": False, "cause": "stale_token", "token": probe["token"]}   # -> 409 + code
```

Three properties of this ordering, each worth a verification step:

1. `probe is None` covers **both** "no such id" and "someone else's id" — identical answer,
   no leak. Unchanged from today's behaviour.
2. The published branch is reached only for rows the caller owns, so it cannot confirm the
   existence of another user's published row.
3. The `CheckViolationError` path (`api/workflows.py:931`) is **still needed** and must not be
   removed: it fires when the immutability trigger raises on a published row, which the
   `status='draft'` conjunct usually pre-empts but not in a race. Keep both.

**Where the client branch lives:** `frontend/src/lib/api.ts`, inside `updateWorkflowDraft`
(`:3341`). Extend the 409 arm to read the body and throw one of two named errors —
`WorkflowConflictError` (unchanged, for `already_published`) or a new
`WorkflowStaleTokenError` carrying `currentToken`. Add a `WorkflowDraftUnreadableError` for
422. The hook then branches on `err.name`, never on `instanceof` and never on prose —
the shipped idiom at `useLiveValidation.ts:182-186` and `WorkflowBuilderPage.tsx:1182`.

> **Defensive default:** if the 409 body is missing or has no `code`, fall back to
> `WorkflowConflictError` (today's behaviour). An unparseable refusal must never become a
> success — mirror `publishWorkflow`'s WR-02 malformed-body guard (`api.ts:3624-3633`).

---

## RECOMMENDATION 3 — Autosave hook mechanics (D-186-01/04/05/12) · HIGH

### `useLiveValidation` is the pattern to mirror, and the signal to consume

`frontend/src/hooks/useLiveValidation.ts` is 275 lines and its docblock states every rule
`useDraftPersistence` should inherit. The pieces that transfer directly:

| Piece | Location | Transfers? |
|---|---|---|
| Discriminated-union state (never a boolean pair) | `:118-127` | **Yes** — the `PublishOutcome` "binary handler FORBIDDEN" rule applies doubly to a write. |
| Hand-rolled `setTimeout` debounce, cleared on every effect run | `:229`, `:264-271` | **Yes.** |
| Effect keyed on `def` **identity** (a `useMemo`, not a render-time literal) | `:272`, caller at `WorkflowBuilderPage.tsx:682-685` | **Yes** — and the caller contract is already satisfied: `definition` is memoized over `[builderPhase, meta, phases]`. |
| `AbortController` in the cleanup | `:270` | **NO — see the single-flight rule below.** |
| Monotonic `seqRef`/`appliedRef` last-write-wins | `:202-204`, `:239` | **Partially** — for *applying* a response, yes. For *issuing* the request, no. |
| StrictMode survival note | `:199-201` | **Yes**, and it matters more here (React **19.2** + `<StrictMode>` is live in `main.tsx:7`). |

**The 422 signal D-186-04 keys on** is `ValidationState.kind === "degraded" && cause === "unreadable"`
(`useLiveValidation.ts:101`, `:182-186`). The page already holds it as `validation` (`:727`).

### The render-loop / double-debounce hazard (real, and avoidable)

`useLiveValidation` produces a **new state object on every beat** — including the
`checking: true` → `checking: false` flips driven by `CHECKING_MIN_VISIBLE_MS`. If
`useDraftPersistence` puts `validation` (or any derived object) in its effect's dependency
array, the autosave debounce **restarts on every validation beat**, so a long check could
starve autosave entirely, and a fast one could double-fire it.

**Rule:** the autosave effect's dependency array is `[def, enabled]` — *exactly* the shape
`useLiveValidation` uses — and nothing else. Hold conditions are read from **refs** at fire
time.

```ts
// Hold conditions are read at FIRE TIME from a ref, never from the dependency array.
// Putting them in the deps would restart the debounce on every validation beat
// (useLiveValidation emits a new state object on each `checking` flip) — the timer
// would never mature while a check was cycling.
const holdRef = useRef<HoldReason | null>(null)
useEffect(() => { holdRef.current = holdReason }, [holdReason])
```

`holdReason` itself is a **string-or-null** computed with `useMemo` by the caller, so it is
value-stable across beats that do not change the answer:

```ts
// One hold mechanism, two sentences (186-CONTEXT <specifics>). Do NOT build two.
const holdReason = useMemo<string | null>(() => {
  if (publishInFlight) return HOLD_PUBLISHING       // D-186-12
  if (validation.kind === "degraded" && validation.cause === "unreadable")
    return HOLD_UNREADABLE                          // D-186-04
  return null
}, [publishInFlight, validation])
```

**Release must flush.** A timer that fires while held must not silently drop the write. Two
correct shapes; recommend the second:

- *Retry-on-a-second-timer* — re-arm the debounce when held. Simple, but burns timers and
  can loop while a publish runs for minutes.
- **Flush-on-release** — when the timer fires and `holdRef.current !== null`, mark
  `heldPendingRef.current = true` and issue nothing. A separate effect on `holdReason`
  detects the non-null → null transition and, if `heldPendingRef` (or `dirty`) is set,
  issues the write immediately. **Recommend this** — it is exactly D-186-12's
  *"edits accumulate as dirty and flush on resolution"*, and it costs no timer while held.

### Single-flight: never abort a write, never let two PATCHes race

`useLiveValidation` aborts in-flight requests. **That is correct for a read and wrong for a
write**: `AbortController.abort()` cancels the client's *interest*, not the server's
*execution*. An aborted PATCH may still have committed — and if it did, it consumed the
token, so the next write would 409 against a change the user actually made. Worse, two
concurrent PATCHes with the same token mean one wins arbitrarily and the loser 409s
spuriously.

**Recommended discipline — a single-flight queue with a token chain:**

```ts
// WRITES ARE SERIALIZED, NEVER ABORTED, AND NEVER CONCURRENT.
//
// Three refs and one rule: at most one PATCH is in flight; a newer edit that arrives
// while one is in flight sets a "dirty again" flag rather than issuing a second request;
// the completion handler adopts the returned token and, if the flag is set, issues
// exactly one follow-up with the FRESH token.
//
// WHY NOT AbortController (the useLiveValidation belt): abort cancels the CLIENT's
// interest, not the server's execution. An aborted PATCH may still have committed and
// consumed the token — the next write would then 409 against the user's OWN change.
// A read is idempotent; a write is not. This is the one place the two hooks diverge,
// and it is deliberate.
//
// WHY NOT "just send both": two PATCHes carrying the SAME token means one matches 0
// rows. The loser would raise a stale-token banner for a conflict that never existed.
const inFlightRef = useRef(false)
const pendingRef  = useRef(false)   // an edit arrived while a write was in flight
const tokenRef    = useRef<string | null>(initialToken)
```

Flow, stated as an invariant the test can assert: **at every instant, the number of
outstanding `PATCH /workflows/{id}` requests for a given draft is ≤ 1, and each carries the
token returned by the immediately preceding successful write.**

The `seqRef`/`appliedRef` idiom is still useful for *applying* the result (dropping a
response whose definition is already superseded), but the ordering guarantee comes from the
queue, not from the sequence number.

### Create-once under React 19 StrictMode

`main.tsx:7` wraps the app in `<StrictMode>` and React is **19.2.4** — dev-mode effects still
mount → unmount → mount. The shipped `creatingRef` guard (`WorkflowBuilderPage.tsx:538`,
`:1132-1143`) exists precisely because "several `onPersist` calls can fire while `draftId` is
still null and each would re-run `createWorkflowDraft` → a UniqueViolation storm on
(slug, version)". **Move it into the hook verbatim; do not re-derive it.** Note that the
`useEffect` cleanup clears the debounce timer before it fires, so the StrictMode double-invoke
does not itself issue a request — but a *user gesture* path (the explicit Save button) is not
double-invoked and the ref covers the interleaving of the two.

`draftIdRef` must remain a **synchronous** mirror of `draftId` for the same reason
(`setDraftId` is async; the ref is what makes "exactly one create" true).

### Stale closures over the token

`tokenRef` (not `useState`) is required for the same reason `draftIdRef` is: the debounce
callback closes over the render's values, and a token adopted by a write that resolved after
the timer was scheduled must be visible to it. Read `tokenRef.current` **inside** the fire
callback, never from a closed-over `token` variable.

### The debounce constant

**Recommend `AUTOSAVE_DEBOUNCE_MS = 1000`** (the top of D-186-01's 500–1000 band), not 500.

- At 500 ms, autosave and `useLiveValidation` (`VALIDATE_DEBOUNCE_MS = 500`) fire on the
  **same tick**, so the check that would have held the write has not answered yet — the hold
  gate would be reading a stale verdict on precisely the edit that needed it.
- At 1000 ms, the 500 ms check has had a full extra half-second (debounce + round trip) to
  land in the common case, so the hold usually has a current answer.
- It halves the write rate against a workflow row that also carries the golden-run history.
- **Be honest about the limit:** this is a *probability improvement, not a guarantee.* The
  authoritative backstop is the PATCH's own 422 → `WorkflowDraftUnreadableError` →
  `Not saved — <reason>`. Do not let the hook claim ordering it does not have. Record this in
  the hook docblock.
- The hold gate must **not** wait for `kind: "checking"` to resolve — that would stall
  autosave forever on a slow network. Hold only on an actual `degraded/unreadable`.

### The store's `saveState` slot — RECOMMENDATION: **RETIRE it**

Evidence:

- Zero production readers. The only call site of `setSaveState` in the whole repo is
  `builderStore.test.ts:339`. [VERIFIED: repo-wide grep]
- The store's `SaveState = "idle" | "saving" | "saved" | "error"` (`builderStore.ts:132`) is
  **strictly narrower** than the enum the app actually renders,
  `ToolbarSaveState = "idle" | "dirty" | "saving" | "saved" | "error"`
  (`CanvasToolbar.tsx:78`). Keeping it means two enums for one concept — the exact
  "two spellings of a locked string is how a locked string stops being locked" failure
  `SAVED_STILL_A_DRAFT`'s own docblock names (`builderStore.ts:143`).
- Phase 186's state is **wider still**: it must represent *held* (two reasons) and *conflict*.
  A flat 4-value enum cannot; and a boolean pair could represent "saved AND conflicted".
  `useDraftPersistence` needs a discriminated union in the `ValidationState` idiom.
- `builderStore.ts` carries a source fence forbidding it from naming the API client (D-184-03:
  undo never writes to the server). Persistence state whose one writer is a network call does
  not belong in the undo store. This is 184-13's own stated reason for declining the slot
  (`builderStore.ts:192-201`).

**Retirement is a 3-line deletion** (`SaveState` type, the `saveState` field, the
`setSaveState` action) plus the `SaveState` import site. `SAVED_STILL_A_DRAFT` **stays** in
`builderStore.ts` — it is imported by `CanvasToolbar` and re-exported by the page.

> ⚠ **Do not let this reduce the test count.** `builderStore.test.ts:337` asserts
> *"setSaveState and markSaved leave the undo stack untouched"* — an untracked-setter
> invariant that must survive. Retarget it onto another untracked setter (`setChecking` or
> `setDegraded`) rather than deleting it. The lesson from Phase 177 is explicit: guard the
> test COUNT, not just the failures.

### The KB-chip trap (D-186-15) — `meta` changes arm nothing

Two shipped facts collide:

```ts
// builderStore.ts:592-597 — dirty arms ONLY on a `phases` reference change.
store.subscribe((state, prev) => {
  if (suppressDirty) return
  if (state.phases !== prev.phases && state.dirty === false) { ... }
})

// WorkflowBuilderPage.tsx:713-717 — hasEdited EXCLUDES meta changes by design.
if (state.phases === prev.phases) return
if (state.builderPhase !== prev.builderPhase || state.meta !== prev.meta) return
setHasEdited(true)
```

So binding a knowledge base — which writes `meta.project_folder_id` — would:

- ✅ produce a new `definition` memo identity (deps are `[builderPhase, meta, phases]`,
  `WorkflowBuilderPage.tsx:682-685`), so the **autosave effect would fire**;
- ❌ **not** set `dirty` → no `beforeunload`, no `canLeave` prompt, `toolbarSaveState` never
  reads `"dirty"`;
- ❌ **not** set `hasEdited` → if binding is the author's first action, `/validate` stays idle.

**Recommended fix:** a dedicated store action, so the write and the arming are one atomic act
and cannot be forgotten at a second call site:

```ts
/**
 * Bind (or unbind) the workflow's knowledge base — a WORKFLOW-LEVEL definition edit
 * (D-186-15). It lives on `meta`, not `phases`, so it arms `dirty` EXPLICITLY:
 * the D-184-03 subscription watches the `phases` reference only, and a meta-only edit
 * would otherwise be a definition change the leave guard never noticed.
 *
 * UNTRACKED, deliberately: `partialize` narrows the undo stack to phases + the two
 * discriminators, so ⌘Z restores STEPS, never the workflow's identity (the `meta`
 * docblock's stated rule). A re-bind is undone by re-picking, not by ⌘Z.
 */
setProjectFolder: (id: string | null) => {
  const s = get()
  if (s.builderPhase !== "drafted") return
  set({ meta: { ...s.meta, project_folder_id: id }, dirty: true })
},
```

`hasEdited` is the second half and is a **decision for the planner**, not a mechanical fix.
Two options:

- **(a) Flip it at the call site** — the chip's `onChange` calls `setHasEdited(true)`
  alongside `setProjectFolder`. Keeps the subscription's document-transition exclusion at
  `:715` untouched (that line exists so generate/open do not start the loop). Binding a KB
  *is* an author edit, so this is consistent with D-184-15's actual rule.
- **(b) Leave `hasEdited` alone** — an author who binds a KB and does nothing else sees no
  verdicts. Safest w.r.t. D-184-15's letter, but means the very edit BUG-260731-03 is about
  produces no live check.

**Recommend (a)**, with the reasoning written into the code: D-184-15's rule is *"nothing is
claimed before the author's first EDIT"*, and a deliberate re-bind is an edit. Whichever is
chosen, the planner must state it — silently getting (b) by not thinking about it is the
failure mode.

**Reachability of all three creation paths** [VERIFIED: `WorkflowsPage.tsx`]:

| Path | Entry | Lands in Builder? | Binds a KB today? |
|---|---|---|---|
| NL generate (describe screen) | `openBuilderFresh` → describe → `onDraft` (`WorkflowBuilderPage.tsx:1038`) | yes | only if the dropdown is changed (default `""` = unbound) |
| Fork a starter ("Use this →") | `onUseStarter` (`WorkflowsPage.tsx:246-277`) → `createWorkflowDraft` → `setBuilderInitial` → `setPageView("builder")` | **yes, bypassing the describe screen** | **never** |
| Tweak a published workflow | `onTweak` (`:210-236`) → same shape | **yes, bypassing the describe screen** | inherits the parent's binding, cannot change it |
| Open an existing draft | `onOpenDraft` (`:281-288`) | yes | inherits, cannot change it |

All four land in the Builder, so **one control in `identityGroup` covers every path** — the
D-186-15 claim is confirmed.

**The chip itself.** The component to reuse is the `<select data-testid="project-folder-picker">`
at `WorkflowBuilderPage.tsx:1348-1367`; its options come from `folderOptions`, which is fetched
**unconditionally on mount** (`:1002-1028`), so it is already populated in the drafted view —
no new fetch. The chip renders at `:1542-1549` gated on `boundFolderName &&`; per D-186-15 that
gate must go so the **unbound** state renders too, with the D-186-16 invitation copy
(*"No knowledge base · searches everything"*) and **no severity, no code, no tray row** — the
`EMPTY_DRAFT_INVITATION` precedent (`:252-258`).

---

## RECOMMENDATION 4 — Publish / dirty-draft guard (D-186-10/11) · MEDIUM

### Threading the token through the gauntlet

`publish_service.publish_workflow` already loads the row at stage 0 via `get_definition`
(`publish_service.py:103`) and holds `row` in a local through the whole gauntlet. Once
`get_definition` returns `token`, the change is two lines:

```python
# stage 0 (publish_service.py:103) — capture alongside the existing load.
row = await get_definition(pool, definition_id, user_id=user_id)
...
stage0_token = row["token"]      # the draft AS IT WAS WHEN WE STARTED CHECKING IT

# stage 5 (publish_service.py:359) — the flip becomes token-guarded.
version = await publish_definition(pool, definition_id, token=stage0_token)
```

### Distinguishing the new 0-row case from the WR-03 sentinel

`publish_definition` currently returns `-1` for **any** 0-row flip (`db/workflows.py:327-332`),
and `publish_service.py:366-375` maps that to `already_published`. Adding a second conjunct
makes `-1` ambiguous: it would now mean *either* "already published" *or* "the draft moved".

**The two must be distinguishable, and the honest way is a second sentinel — not a re-read.**
Recommended: keep `-1` meaning exactly what it means today and add `-2` for the token miss,
disambiguated inside `publish_definition` by the same owner-free probe shape:

```python
async def publish_definition(pool, definition_id, *, token: str) -> int:
    """Flip draft -> published, guarded on BOTH `status='draft'` (WR-03) and the
    concurrency token (D-186-10). Returns the published version, or a sentinel:

      -1  the WR-03 case, UNCHANGED — not a draft / already published / not found
      -2  NEW — the row is still an owned draft, but it MOVED since stage 0

    Two sentinels rather than one because the caller words them differently and files
    a DIFFERENT receipt: -1 is "someone already published this", -2 is "the thing we
    spent a golden run checking is not the thing we were about to publish". Collapsing
    them would file a receipt for something that did not happen (the T-185-04-01 rule).
    """
    row = await pool.fetchrow(
        f"UPDATE workflow_definitions SET status = 'published' "
        f"WHERE id = $1 AND status = 'draft' AND {CONCURRENCY_TOKEN_SQL} = $2 "
        f"RETURNING version",
        definition_id, token,
    )
    if row is not None:
        return row["version"]
    # 0 rows. Which conjunct failed? One probe, no owner clause needed: the CALLER
    # (publish_service stage 0) already owner-checked via get_definition, and this
    # function is not reachable from any un-owner-checked path.
    still_a_draft = await pool.fetchval(
        "SELECT 1 FROM workflow_definitions WHERE id = $1 AND status = 'draft'",
        definition_id,
    )
    return -2 if still_a_draft else -1
```

Then in `publish_service`, immediately after the existing `if version == -1:` block:

```python
if version == -2:
    return await _block(
        pool, run_id=golden_run_id, user_id=user_id, definition_id=definition_id,
        stage="draft_changed",
        named_failures=["the draft changed while it was being checked — "
                        "re-publish to check the new version"],
        golden_run_id=golden_run_id,   # PRESERVED: the golden run really happened.
    )
```

The golden run and every `harness_audit` row written during it survive untouched — `_block`
only *adds* a `publish_blocked` receipt (`publish_service.py:413-424`). D-186-10's "the
golden run preserved as the real record of what was tested" is satisfied by doing nothing.

### `blocked_stage` needs NO migration — INDEPENDENTLY VERIFIED

D-186-11 asserts this; I re-verified rather than assuming.

- `_block` writes `event_type="publish_blocked"` and puts `blocked_stage` **inside the
  `metadata` JSONB** (`publish_service.py:417-423`). [VERIFIED: code read]
- `publish_blocked` has been in the `harness_audit_event_type_check` allow-list since
  migration 070 and is still present at the current head:
  `supabase/migrations/114_harness_audit_action_risk_pending.sql:36-49` lists
  `'judge_verdict','publish_attempted','publish_blocked','publish_succeeded'`.
  [VERIFIED: migration read]
- There is **no CHECK constraint on any `blocked_stage` value anywhere** — it is not a column.
  [VERIFIED: repo-wide grep of `supabase/migrations/`]
- `PublishVerdict.blocked_stage` is `str | None` (`api/workflows.py:760`), and the publish
  route's branch list (`:807-822`) matches only `not_found` / `already_published` /
  `business_requirement`, with the docstring explicitly stating that an unrecognised stage
  "falls through to the 200 + structured verdict — a new pre-run stage needs NO route branch
  here" (`:792-794`). So `draft_changed` returns **HTTP 200** with `published: false`.

**Conclusion: D-186-11 holds. Zero migrations for the publish half too.**

### ⚠ THE CLIENT DEFECT D-186-11 UNDERSTATES — the spine renders a refusal as 8/8 GREEN

This is the highest-value finding in section 4 and it is **not** what the context predicted.

```ts
// PublishGauntlet.tsx:329-338
const blockedIndex = blockedStage
  ? STAGES.findIndex((s) => s.codes.includes(blockedStage))   // -1 when UNRECOGNISED
  : -1
...
const isPassed = blockedIndex === -1 ? !running : i < blockedIndex
//               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ an UNKNOWN stage takes the same branch
//                                              as NO BLOCK AT ALL.
```

`STAGES` (`:112-121`) enumerates eight `codes` arrays: `not_found`, `definition_invalid`,
`business_requirement`, `lint`, `interactive_phase`, `golden_run_timeout`/`golden_run_error`,
`structural_gate`, `judge`. **`draft_changed` is in none of them.**

Trace for a D-186-10 refusal: route returns 200 → `PublishOutcome.kind === "verdict"` →
`verdict.published === false`, `blocked_stage === "draft_changed"` → `loading` is now `false`
→ `blockedIndex === -1` and `running === false` → **`isPassed` is `true` for all eight nodes**
→ every node renders `border-success/50 bg-success/10` with a ✓ badge. Meanwhile
`wordedHeadline` (`:520-525`) falls to the `else` arm and prints the **raw machine token** to a
business user: `Blocked early — draft_changed`.

So the surface simultaneously shows a full green pass spine and a refusal headline containing
a code. This is the T-185-04-01 pattern exactly — a green indicator scoped to the wrong thing.

**The plan needs TWO changes here, and the second is the important one:**

1. **A `STAGES` entry** so the code is not leaked and the spine highlights correctly. It belongs
   between `Judge` and the flip conceptually — but since `STAGES` models the eight *checks* and
   `draft_changed` is a **post-judge, pre-flip** refusal, the honest placement is a 9th entry
   after `Judge`, or a `codes` addition to a renamed final stage. Either way the label must be
   plain-language (Phase 127's lead-with-words rule), e.g.
   `{ label: "Commit", what: "Publish commit — the draft must not have changed while we checked it", codes: ["draft_changed"] }`.
2. **Fix the `-1` fail-open.** `isPassed` must not be `true` when a block exists but its stage
   is unrecognised. Minimal correct form:

```ts
// An UNRECOGNISED blocked_stage must never paint the spine green. `blockedStage != null`
// is server truth that a block HAPPENED; `blockedIndex === -1` only means WE don't know
// where. "We don't know where it failed" is not "everything passed" — and the previous
// shape said exactly that (a full 8/8 ✓ spine under a "Blocked early" headline).
// This is a latent fail-open for EVERY future stage, not just draft_changed.
const unknownBlock = blockedStage != null && blockedIndex === -1
const isPassed = unknownBlock ? false : blockedIndex === -1 ? !running : i < blockedIndex
```

3. **A worded headline** so `wordedHeadline` never prints a raw code. The current `else` arm
   (`:525`) interpolates `verdict.blocked_stage` directly. Extend the existing conditional
   with a `draft_changed` case, or introduce a small `BLOCKED_SENTENCE: Record<string,string>`
   map — the latter is the shape that scales and matches `DEGRADED_SENTENCE`
   (`verdictModel.ts`, already imported by the page). **Recommend the map**, with an explicit
   fallback that is a *sentence*, not a code.

**Exact file + symbols that must change:** `frontend/src/components/workflows/PublishGauntlet.tsx`
— `STAGES` (`:112`), `GauntletSpine`'s `isPassed` (`:338`), `wordedHeadline` (`:520-526`).

---

## RECOMMENDATION 5 — The folded BUG-260731-03 control (D-186-15/16) · MEDIUM

Covered inline in §3 (the KB-chip trap, the picker component, all-paths reachability). The
remaining plumbing questions:

**Does `project_folder_id` flow through the PATCH?** Yes, with no model change.
`WorkflowDefinition.project_folder_id: UUID | None = None` (`backend/app/models/harness.py:270`)
is a declared field, so it is neither blocked by `extra='forbid'` nor stripped.
`selectDefinition` recombines `{...meta, phases}` (`builderStore.ts:262-264`), and `meta` is
"the working definition MINUS phases" (`:165-167`, a key-remapped mapped type deliberately not
`Omit`, so `project_folder_id` survives). [VERIFIED: code read]

**Does binding trip any validator?** No. `_folder_scope_requires_project`
(`harness.py:293-305`) only raises when a **phase** declares `folder_scope` and the workflow has
none. **Setting** `project_folder_id` can only ever *satisfy* that rule, never violate it.
Unbinding (`None`) could violate it — but only if a phase carries `folder_scope`, which
`PhaseFormPanel` cannot author today (D-186-17). **The safe-today behaviour is still worth a
guard:** if unbinding produces a 422, D-186-04's hold rule would make the draft permanently
unsaveable. Recommend the plan add one defensive check — a client-side "can't unbind while a
step scopes a folder" refusal, or simply verify by test that no shipped draft can reach it.
This is the D-186-17 trap arriving one phase early through the *unbind* direction, and the
context's ordering note does not cover it.

**Unbound state as a neutral invitation.** The precedent is `EMPTY_DRAFT_INVITATION`
(`WorkflowBuilderPage.tsx:252-258`) — a client-authored *sentence about what to do next*,
explicitly not a verdict, with no severity and no code, feeding `blockedReason` only as prose.
`blockedReason` (`:989-997`) is the publish-block seam; the KB invitation must **not** join it
(that would make an unbound workflow unpublishable, which is 187's call, not 186's). The chip
states the consequence and nothing more. **No `verdicts` entry, no `groupVerdicts` row, no
problems-tray line** — D-182-06 stays intact.

**Copy (D-186-16 / `<specifics>`):** *"No knowledge base · searches everything"* — the
consequence, not the state. The operator's live evidence is that "no specific knowledge base"
sounds harmless (BUG-260731-03 §1: the bug reproduced within 10 minutes on the same operator).

---

## Standard Stack

No new dependencies. Everything this phase needs already ships.

### Core (already installed — verified in `backend/requirements.txt` / `frontend/package.json`)

| Library | Version in repo | Purpose here | Why standard |
|---|---|---|---|
| `asyncpg` | `>=0.29` (`requirements.txt:30`) | The only driver on the workflows read/write path (`pool.fetchrow`) | Already the house pool for `db/workflows.py`; `supabase-py` must **not** be introduced here (CLAUDE.md `run_in_threadpool` rule exists precisely because it is blocking) |
| `pydantic` | `2.12.5` (installed) | Request/response models | House rule |
| `fastapi` | (installed) | Routes, `HTTPException`, `Header` | House rule |
| `react` / `react-dom` | `^19.2.4` | Hooks | — |
| `zustand` / `zundo` | `^5.0.13` / `^2.3.0` | `builderStore` | — |
| `vitest` | `^4.1.0` | Frontend tests | — |
| `pytest` (`asyncio_mode = auto`) | (installed) | Backend tests (`backend/pytest.ini`) | — |
| `psycopg2` | (installed) | The live-DB test skip-guard idiom | The shipped pattern at `test_publish_flip.py:28-46` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `to_char` token | `revision integer` column + migration 115 | Conceptually cleanest and immune to the microsecond edge case — but **breaks the phase's zero-migration promise** for a problem that is already solved. Only if §1's evidence had failed. |
| `to_char` token | `xmin` system column | Postgres-native MVCC row version, zero schema change. Rejected: `xmin` is a 32-bit counter that **wraps**, is not preserved across `VACUUM FREEZE`, and is not preserved by `pg_dump`/restore — which this project does routinely (`scripts/regenerate-full-schema.sh`). A token that silently resets on a schema regen is worse than no token. [ASSUMED — reasoning from Postgres semantics, not probed] |
| `to_char` token | `updated_at::text` | **Rejected on evidence:** probe G shows it is session-`TimeZone`-dependent. |
| `to_char` token | `datetime`-typed Pydantic field + `fromisoformat` server-side | Works (probe A) — but reintroduces two formatters, a variable-width wire value (µs=0 drops the fraction), and silent acceptance of a lossy JS-Date string. |
| Optimistic token | Soft-lock / lease | Explicitly rejected in D-186-08 (leases, heartbeats, expiry; strands an author behind their own crashed tab). |
| 409 + code | 412 Precondition Failed | See §2 — viable, but splits one concept across two statuses in a shipped client. |
| Single-flight queue | `AbortController` per write | **Wrong for writes** — abort cancels client interest, not server execution. |

**Installation:** none.

---

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** Every library it uses is
already in `backend/requirements.txt` or `frontend/package.json` and has been running in
production since earlier milestones. No `slopcheck` run is required, and no
`checkpoint:human-verify` install gate needs to exist in the plan.

---

## Architecture Patterns

### System architecture — the write path after Phase 186

```
                    ┌──────────────────── BROWSER ────────────────────┐
  author edit  ──▶  │  builderStore (zustand + zundo)                 │
  (canvas /         │    phases  ──┐                                  │
   panel /          │    meta    ──┴─▶ definition = useMemo(...)      │
   KB chip)         │                        │  identity = 1/edit     │
                    │                        ▼                        │
                    │   ┌──── useDraftPersistence (NEW) ──────────┐   │
                    │   │  deps: [definition, enabled]  ONLY      │   │
                    │   │                                          │  │
                    │   │  debounce 1000ms ──▶ fire()             │   │
                    │   │        │                                 │  │
                    │   │        ├─ holdRef ≠ null? ──▶ hold,      │  │
                    │   │        │    heldPendingRef = true        │  │
                    │   │        │    (flush on release)           │  │
                    │   │        ├─ inFlightRef? ──▶ pendingRef=1  │  │
                    │   │        │    (NEVER a 2nd request)        │  │
                    │   │        └─ else ──▶ PATCH (If-Match: tok) │  │
                    │   │                        │                  │ │
                    │   │   ┌────────────────────┴──────────┐       │ │
                    │   │   │ 200  adopt new token, markSaved│      │ │
                    │   │   │ 409 stale_token ──▶ HALT + banner     │ │
                    │   │   │ 409 already_published ──▶ Tweak line  │ │
                    │   │   │ 422 ──▶ "Not saved — <reason>"        │ │
                    │   │   │ 404 / network ──▶ generic, stay dirty │ │
                    │   │   └───────────────────────────────┘       │ │
                    │   └──────────────────────────────────────────┘  │
                    │                        ▲                        │
                    │   useLiveValidation ───┘ (degraded/unreadable)  │
                    │        deps: [definition, hasEdited]            │
                    │                                                 │
                    │   canvasNudge.ts  ──✗── NEVER reaches the hook  │
                    │   (browser-local; CONCUR-01 by construction)    │
                    └────────────────────────┬────────────────────────┘
                                             │ HTTP
                    ┌────────────────────────▼────────────────────────┐
                    │  PATCH /workflows/{id}   (api/workflows.py:906) │
                    │    If-Match: <token>                            │
                    │        │                                        │
                    │        ▼  update_workflow_definition            │
                    │  UPDATE ... WHERE id=$1 AND created_by=$2       │
                    │         AND status='draft' AND to_char(...)=$5  │
                    │        │                                        │
                    │   1 row ──▶ 200 {id, version, token}            │
                    │   0 rows ──▶ owner-scoped re-read               │
                    │              ├─ absent      ──▶ 404 (collapse)  │
                    │              ├─ published   ──▶ 409 already_..  │
                    │              └─ token diff  ──▶ 409 stale_token │
                    └────────────────────────┬────────────────────────┘
                                             │
   POST /workflows/{id}/publish              │      (independent path)
     stage 0: get_definition ──▶ token ──────┼──────────────┐
     stages 1-4: lint, gates, GOLDEN RUN, judge (minutes)   │
     stage 5: publish_definition(token) ─────────────────────┘
              1 row  ──▶ 200 published:true
              -1     ──▶ blocked_stage "already_published"  (WR-03, unchanged)
              -2     ──▶ blocked_stage "draft_changed"      (NEW, D-186-10)
                          golden run + harness_audit PRESERVED
```

### Recommended file layout

```
frontend/src/hooks/
  useDraftPersistence.ts        # NEW — the whole seam (D-186-05)
  useDraftPersistence.test.tsx  # NEW — mirrors useLiveValidation.test.tsx
  useLiveValidation.ts          # unchanged (the pattern + the 422 signal)

frontend/src/pages/
  WorkflowBuilderPage.tsx       # SHRINKS: loses onPersist/onSaveDraft/draftIdRef/
                                #   creatingRef/saveState/saveErrorMessage/savedTimerRef/
                                #   beforeunload+canLeave. GAINS: the hook call, the
                                #   status line, the conflict banner, the promoted KB chip.

frontend/src/components/workflows/
  builderStore.ts               # -saveState/-setSaveState/-SaveState; +setProjectFolder
  PublishGauntlet.tsx           # +STAGES entry, FIX the -1 fail-open, +worded sentence
  WorkflowCanvas.tsx            # UNTOUCHED (G-5 — extraction due in 188)
  canvasNudge.ts                # UNTOUCHED (D-186-02 — by construction)

frontend/src/lib/
  api.ts                        # createWorkflowDraft/listDraftWorkflows/updateWorkflowDraft
                                #   carry the token; +WorkflowStaleTokenError,
                                #   +WorkflowDraftUnreadableError; 409 body is READ

backend/app/db/workflows.py     # +CONCURRENCY_TOKEN_SQL; 4 queries gain it;
                                #   publish_definition gains the token + the -2 sentinel
backend/app/api/workflows.py    # +If-Match header; +token on DraftCreateResponse/DraftRow;
                                #   the 3-way refusal mapping
backend/app/services/harness/publish_service.py
                                # stage-0 capture + the -2 branch -> "draft_changed"
```

### Pattern: composed-not-copied hook (`usePanelReconcile.ts:1-26` precedent)

`useLiveValidation`'s docblock names its own construction rule: there is no shipped debounced-fetch
hook to copy, so it composed one from the AbortController half and the timer half, **copying
verbatim rather than paraphrasing**. `useDraftPersistence` should say the same about what it
copies (`creatingRef` from `WorkflowBuilderPage.tsx:1132-1143`, the debounce shape from
`useLiveValidation.ts:229-271`) and what it **deliberately diverges on** (no abort, see §3).

### Anti-patterns to avoid

- **Aborting an in-flight PATCH.** Cancels client interest, not server execution. §3.
- **Putting `validation` (or any per-beat object) in the autosave effect's deps.** Restarts the
  debounce on every check beat. §3.
- **Parsing the token.** `new Date(token)` truncates to milliseconds → probe B → 0 rows → every
  save 409s. Also `Date.parse`, `.split(".")`, `.slice(0,19)`, and any "normalize the format"
  helper.
- **Replacing `created_by = $N` with the token clause.** The owner scope is the *only*
  authorization boundary (service role bypasses RLS). The token is added as a **third conjunct**.
- **A disambiguating re-read without `created_by`.** Reopens the existence leak T-103-01-01.
- **Collapsing the `-1` and `-2` publish sentinels.** Files a receipt for something that did not
  happen (T-185-04-01).
- **Adding a `token` key to `WorkflowDefinition`.** `extra='forbid'` would 422, and it would be
  persisted into the definition JSONB — a second source of truth (D-14).
- **Routing `canvasNudge` offsets through the hook.** D-186-02; CONCUR-01 must stay true by
  construction.
- **A client-side `blocked_stage` allow-list that filters unknown stages.** The client renders
  the server's verdict; it must fail *closed* on an unknown stage (never green), not filter it.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Row-version tracking | A `version` bump on every save, or a client-computed hash of the definition | The existing `set_updated_at` trigger (mig 056:68-74) rendered via `to_char` | A `version` bump is literally CONCUR-01's forbidden outcome. A content hash cannot detect a write that produced identical content but consumed the row. |
| Timestamp formatting | `datetime.strftime` / `isoformat()` in Python | SQL `to_char(... AT TIME ZONE 'UTC', '…US"Z"')` | One expression on both sides = equality by construction. Python's `isoformat()` **drops** the fractional part when µs = 0 (verified). |
| Debounce | `lodash.debounce`, `use-debounce`, a new dependency | The shipped `setTimeout` closure shape (`useLiveValidation.ts:229-271`, `lib/throttle.ts`) | House rule stated in `useLiveValidation`'s docblock: *"do not add a debounce dependency"*. |
| Optimistic concurrency | A custom lock table, a `locked_by`/`locked_at` pair, a heartbeat | The token | D-186-08 rejected leases explicitly; they need expiry, a release path on every crash, and they strand an author behind their own dead tab. |
| Draft re-read for the "Reload" escape hatch | A new `GET /workflows/{definition_id}` route | `listDraftWorkflows()` (`api.ts:3331`) + find by id, then `store.getState().setDrafted(def)` | Zero new backend surface, owner-scoped by construction, and it is **the exact same read the Open-a-draft path already performs** (`WorkflowsPage.tsx:281-288`). `setDrafted` correctly clears the undo history and `dirty` — which is what "reload discards local changes" means. |
| Fresh token for the "Overwrite" escape hatch | A second re-read round trip | The `token` returned in the 409 `stale_token` body (§2) | The disambiguating re-read already fetched it. Overwrite becomes **one** PATCH. |
| Publish freeze | A `publishing` status on the row | The stage-5 token guard | D-186-10: a freeze needs a release path on every crash/timeout/worker death, and a stranded row is unrecoverable without an operator. |
| An "is this stale?" client check | Comparing timestamps client-side | Let the server's WHERE clause answer | The service role bypasses RLS; only the WHERE is authoritative. A client check is at best a UX hint and at worst a false green. |

**Key insight:** every mechanism this phase needs already exists in the codebase and is already
tested — the trigger, the sentinel-instead-of-false-success shape, the debounced-hook shape, the
named-error branching idiom, the 404-collapse, the invitation-not-verdict precedent. The phase's
risk is not "can we build it" but "will the seams line up" — which is why §1's probe and §4's
spine finding are the load-bearing outputs here.

---

## Common Pitfalls

### Pitfall 1 — The token is parsed somewhere in the client

**What goes wrong:** every autosave 409s; the conflict banner shows constantly.
**Why it happens:** a `Date`, a `.toISOString()`, a "let's normalize this" helper, or a dev-tools
paste. Probe B proves a millisecond-truncated value matches **zero** rows.
**How to avoid:** type it `string` and name it `token` (not `updatedAt`); write the reason in the
type's docblock; add a source-fence test (`?raw` import + regex) asserting
`useDraftPersistence.ts` contains no `new Date`/`Date.parse`. That fence idiom already ships in
`builderStore` and `WorkflowCanvas`.
**Warning sign:** the conflict banner appears on the *first* edit of a fresh session.

### Pitfall 2 — asyncpg `DataError` on the very first stale check

**What goes wrong:** `invalid input for query argument $N … expected a datetime.date or
datetime.datetime instance, got 'str'` — a 500, not a 409.
**Why it happens:** implementing D-186-07 literally as `AND updated_at = $N` with a string bind.
Probes C **and** D show the explicit `::timestamptz` cast does not rescue it.
**How to avoid:** compare in text space via `CONCURRENCY_TOKEN_SQL`.
**Warning sign:** the guard "works" in a unit test with a mocked pool and 500s against :54322.

### Pitfall 3 — The publish spine paints a refusal green

**What goes wrong:** `draft_changed` → `blockedIndex === -1` → all eight stages ✓ green, headline
`Blocked early — draft_changed`.
**Why it happens:** `PublishGauntlet.tsx:338` treats "unknown stage" identically to "no block".
**How to avoid:** fix the `-1` branch (§4) *and* add the stage entry *and* add the sentence. All
three; any one alone leaves a lie on screen.
**Warning sign:** a UAT screenshot with green pips under a red headline. **Test for it directly**
— render the gauntlet with a deliberately bogus `blocked_stage` and assert zero ✓ badges. That
assertion protects every future stage, not just this one.

### Pitfall 4 — Binding a KB does not mark the draft dirty

**What goes wrong:** the author binds the KB, navigates away, and the binding is silently lost —
the leave guard never fires because `dirty` is false.
**Why it happens:** `builderStore.ts:594` watches the `phases` reference only.
**How to avoid:** the `setProjectFolder` action sets `dirty: true` explicitly (§3).
**Warning sign:** a test that asserts "the KB chip writes `meta`" passes while a test that asserts
"binding a KB arms the leave guard" was never written.

### Pitfall 5 — Two concurrent PATCHes from one tab

**What goes wrong:** the user edits during an in-flight save; both PATCHes carry the same token;
the second gets a 409 and raises a conflict banner for a conflict that never happened.
**Why it happens:** no single-flight discipline.
**How to avoid:** `inFlightRef` + `pendingRef` (§3). The invariant to assert: ≤ 1 outstanding
PATCH per draft at any instant.
**Warning sign:** a spurious conflict banner while the user is typing fast on one tab.

### Pitfall 6 — The 409-detail shape change breaks a backend test silently

**What goes wrong:** the published-row 409 detail becomes an object; a test asserting the exact
string fails — or worse, gets deleted to "fix" the suite.
**How to avoid:** locate it first (`backend/tests/unit/test_103_published_409.py` is the likely
site), update the assertion, **keep the test**. Guard the COUNT.

### Pitfall 7 — Retiring `saveState` reduces the frontend test count

**What goes wrong:** `builderStore.test.ts:337` is deleted along with the setter; the suite is
"green" with one fewer assertion.
**How to avoid:** retarget the untracked-setter invariant onto `setChecking`/`setDegraded`. Record
the before/after counts (baseline below).

### Pitfall 8 — Unbinding a KB produces a permanently unsaveable draft

**What goes wrong:** if any phase carries `folder_scope`, unbinding raises
`_folder_scope_requires_project` (422); D-186-04 then holds the write forever.
**Why it happens today:** it doesn't — `folder_scope` is read-only in `PhaseFormPanel`. But the
promoted chip creates the *unbind* direction that D-186-17 did not anticipate.
**How to avoid:** either refuse the unbind client-side when a step scopes a folder, or prove by
test that no reachable draft can carry `folder_scope`. State which.

### Pitfall 9 — A transaction wrapping two writes freezes the token

**What goes wrong:** `set_updated_at` uses `now()`, which is **transaction** time. Two UPDATEs in
one transaction produce the **same** token (probe L).
**Why it matters:** irrelevant today (both writers are single-statement autocommit), but a future
"batch these two writes" refactor would silently disable the guard.
**How to avoid:** a comment on `CONCURRENCY_TOKEN_SQL` naming it. If a transaction ever becomes
necessary, switch the trigger to `clock_timestamp()` — which is itself a migration, so it must be
surfaced in the open.

---

## Code Examples

All snippets are grounded in shipped code at the cited `file:line`.

### Reading the token at the three origins

```ts
// frontend/src/lib/api.ts — the token must ride EVERY response that seeds a builder
// session, because a draft reaches the Builder by FOUR routes (verified in
// WorkflowsPage.tsx): fresh build (create), fork a starter (create), Tweak (create),
// open a draft (the drafts LIST). Miss one and that path autosaves without a guard.
export interface WorkflowDraftRow {
  id: string; slug: string; version: number
  name: string | null
  definition?: WorkflowDefinitionJSON | null
  /** OPAQUE concurrency token (Phase 186 / D-186-07). Echo it VERBATIM on the next
   *  PATCH. NEVER `new Date(...)` it: Postgres keeps microseconds, JS `Date` keeps
   *  milliseconds, and the truncated value matches ZERO rows (probed 2026-08-01). */
  token: string
}
```

### The conflict branch (client)

```ts
// frontend/src/lib/api.ts — updateWorkflowDraft, extending the SHIPPED 409 arm.
// Today this arm throws WorkflowConflictError WITHOUT reading the body (:3353); the
// body is where the machine code now lives. Branch on `code`, NEVER on the prose —
// the same rule `useLiveValidation.causeOf` states at :182-186.
if (res.status === 409) {
  const body = (await res.json().catch(() => ({}))) as { detail?: { code?: string; token?: string } }
  const code = body.detail?.code
  if (code === "stale_token") throw new WorkflowStaleTokenError(body.detail?.token ?? null)
  // Unknown / missing code falls back to today's behaviour. A refusal we cannot
  // classify must never become a success (the WR-02 malformed-body rule, :3624-3633).
  throw new WorkflowConflictError()
}
if (res.status === 422) throw new WorkflowDraftUnreadableError(await res.json().catch(() => null))
```

### The hold gate (client)

```ts
// ONE hold mechanism, TWO sentences (186-CONTEXT <specifics>: "Do not build two").
export const HOLD_PUBLISHING = "Publishing — changes will save when it finishes"   // D-186-12
export const HOLD_UNREADABLE = "Not saved — we can't read this shape yet"          // D-186-04

// The write is NOT gated on the check COMPLETING — that would stall autosave forever
// on a slow network. It is gated on the LAST KNOWN verdict being `unreadable`. The
// authoritative backstop is the PATCH's own 422, which surfaces the same sentence.
```

### The publish stage-5 guard (server)

See §4 for the full `publish_definition` with the `-1` / `-2` sentinels.

---

## Runtime State Inventory

Phase 186 is not a rename/refactor/migration phase, but it **does** change a wire contract and a
persisted-row read path, so the equivalent audit is worth stating.

| Category | Items found | Action required |
|---|---|---|
| Stored data | **None.** No column added, no value rewritten. `updated_at` already exists and is already populated on every row. | None. |
| Live service config | **None.** No env var, no `app_settings` row, no feature flag. `visual_workflow_canvas` already gates the canvas and is unchanged. | None. |
| OS-registered state | **None** — verified: no Task Scheduler / pm2 / systemd artefact references workflow persistence. | None. |
| Secrets / env vars | **None.** No new key; `deploy/onebox.env.example` and `docs/OPERATOR.md` are untouched, so `scripts/check-deploy-drift.sh` cannot fire. | None. |
| Build artifacts | **None.** No `Dockerfile.sandbox` change, no `SANDBOX_IMAGE` bump, no new package. | None. |
| **In-flight browser sessions** | A tab open across the deploy holds a definition with **no token**. Its next PATCH would send no `If-Match`. | **Decide this explicitly.** Recommend the header be **optional at the route** for one release (absent ⇒ today's unguarded behaviour, exactly as it works now), because the alternative — 400/428 on a missing header — would break every already-open tab at deploy. Local dev is single-operator so it barely matters; recording it because the same code ships to cloud. |
| **`definition` jsonb double-encoding (SEED-138)** | 118/145 rows. Autosave **heals on write** — `update_workflow_definition` already writes `json.dumps(...)` + `$N::jsonb`. | None in 186 (deferred, per CONTEXT). But note: the token guard changes nothing about the encoding, and `publish_service.py:126-133`'s defensive decode must **stay**. |

---

## Validation Architecture

**Framework and commands (verified by execution, 2026-08-01):**

| Property | Backend | Frontend |
|---|---|---|
| Framework | pytest, `asyncio_mode = auto` (`backend/pytest.ini`) | vitest 4.1.0 + jsdom (`frontend/vitest.config.ts`) |
| Config file | `backend/pytest.ini` (`testpaths = tests`) | `frontend/vitest.config.ts` (excludes `tests/e2e/**`) |
| Quick run | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/<file> -x -q` | `cd frontend && npx vitest run <files>` |
| Full suite | `cd backend && ./venv/Scripts/python.exe -m pytest -q` | `cd frontend && npx vitest run` |
| **Measured baseline** | **3457 tests collected** (`--collect-only -q`, 5.22 s) | **209 passing across the 7 builder-related files** (30.9 s) — see the file list below |
| E2E | — | Playwright at `frontend/tests/e2e/` (`npx playwright test`). **Known rot: 16/17 fail (SEED-049). NOT a backstop for this phase.** |

The 209-test frontend baseline covers: `WorkflowBuilderPage.test.tsx`,
`WorkflowBuilderPage.session.test.tsx`, `WorkflowBuilderPage.header.test.tsx`,
`WorkflowBuilderPage.canvas.test.tsx`, `lib/api.workflows.test.ts`,
`components/workflows/PublishGauntlet.test.tsx`, `components/workflows/builderStore.test.ts`.

> **Guard the COUNT, not just the failures (the Phase 177 lesson).** Two changes in this phase
> delete assertions if handled carelessly: retiring `saveState` (`builderStore.test.ts:337`) and
> reshaping the published-409 detail (`test_103_published_409.py`). The plan must record
> before/after counts for **both** suites and treat a decrease as a failure. Note also the known
> frontend rot (~14–17 pre-existing failures repo-wide, SEED-056) — the 209 figure above is a
> **clean** subset, which is what makes it usable as a guard.

### Falsification-first design (G-6)

Each guard below has a **RED** state that must be observed failing before the fix and passing
after. The 185 lesson is explicit: *verify the PROPERTY, not the PATCH; observe falsification RED
first.*

| # | Guard | RED (must FAIL before the fix) | GREEN (must PASS after) | Where |
|---|---|---|---|---|
| F1 | Stale PATCH is refused | Two writers, one token: the second write **lands** and the first writer's content is lost | Second write matches 0 rows; the winner's content survives | `backend/tests/unit/test_186_concurrent_patch.py` (live :54322) |
| F2 | Stale ≠ 404 | Stale PATCH returns **404 "draft not found"** | Returns **409** with `detail.code == "stale_token"` | same file, route called directly |
| F3 | 404-collapse still closed | A *foreign* draft id returns something other than 404, or leaks status | Foreign id and unknown id both return **404**, identical detail | same file |
| F4 | Published 409 unchanged | (regression) | Published-row PATCH still 409, `detail.code == "already_published"` | `test_103_published_409.py` (updated, not replaced) |
| F5 | Publish race refused | Edit mid-gauntlet ⇒ publish **succeeds**, shipping an unchecked definition | `publish_definition` returns `-2`; verdict `blocked_stage == "draft_changed"`; row still `draft` | `backend/tests/unit/test_186_publish_race.py` |
| F6 | Golden-run receipt preserved | The `harness_audit` golden-run rows are absent after the refusal | `judge_verdict` + the run rows survive; a `publish_blocked` receipt is **added** | same file |
| F7 | **Unknown stage never renders green** | A bogus `blocked_stage` renders **8 ✓ badges** | Zero ✓ badges; the headline contains **no raw code** | `PublishGauntlet.test.tsx` |
| F8 | Never a false `Saved ✓` | A 422 PATCH still shows `Saved · still a draft` | Shows `Not saved — …`; `dirty` stays true | `useDraftPersistence.test.tsx` |
| F9 | Single-flight | Two overlapping edits issue **two** concurrent PATCHes | ≤ 1 outstanding PATCH; the second carries the token returned by the first | `useDraftPersistence.test.tsx` (fake timers + a spied fetch) |
| F10 | Conflict halts writing | After a `stale_token` 409, further edits keep PATCHing (retry storm) | Zero further PATCHes until Reload or Overwrite is pressed | `useDraftPersistence.test.tsx` |
| F11 | Hold flushes on release | A held edit is **dropped** when the hold clears | Exactly one PATCH fires on release, carrying the latest definition | `useDraftPersistence.test.tsx` |
| F12 | Cosmetic drag writes nothing | A nudge issues a PATCH | **0** network calls (extend the shipped 184-07 zero-call spy) | `WorkflowCanvas.editing.test.tsx` (existing) |
| F13 | No version minted | Autosave increments `version` | `version` is byte-identical across N autosaves | F1's file |
| F14 | KB bind arms the guard | Binding leaves `dirty === false` | `dirty === true`; the leave guard prompts | `builderStore.test.ts` + `WorkflowBuilderPage.session.test.tsx` |
| F15 | Token never parsed | — (source fence) | `useDraftPersistence.ts` source contains no `new Date` / `Date.parse` | `?raw` fence test, the shipped idiom |
| F16 | Unbound chip is an invitation | The unbound chip emits a severity/code, or adds a problems-tray row | Chip renders the consequence sentence; `verdicts` unchanged; tray count unchanged | `WorkflowBuilderPage.header.test.tsx` |

### Requirements → test map

| Req | Behaviour | Type | Automated command | Exists? |
|---|---|---|---|---|
| CONCUR-01 | Autosave updates in place; no version minted | unit (live DB) | `./venv/Scripts/python.exe -m pytest tests/unit/test_186_concurrent_patch.py -x -q` | ❌ Wave 0 |
| CONCUR-01 | Cosmetic drag = 0 network calls | unit | `npx vitest run src/components/workflows/WorkflowCanvas.editing.test.tsx` | ✅ extend |
| CONCUR-02 | Stale writer refused, honestly | unit (live DB) | same as above | ❌ Wave 0 |
| CONCUR-02 | Client halts + banner, never overwrites | unit | `npx vitest run src/hooks/useDraftPersistence.test.tsx` | ❌ Wave 0 |
| CONCUR-02 | Publish refuses a drifted draft | unit | `./venv/Scripts/python.exe -m pytest tests/unit/test_186_publish_race.py -x -q` | ❌ Wave 0 |
| CONCUR-02 (SC#4) | Two-tab / stale-tab / publish-race, lived | **manual (G-4)** | Chrome, operator-driven — see the scoreboard below | ❌ |
| BUG-260731-03 (control) | KB re-bindable from the canvas, all paths | unit + manual | `npx vitest run src/pages/WorkflowBuilderPage.header.test.tsx` + UAT | ❌ Wave 0 |

### Sampling rate

- **Per task commit:** the touched file's suite —
  `npx vitest run src/hooks/useDraftPersistence.test.tsx` (< 30 s) or
  `./venv/Scripts/python.exe -m pytest tests/unit/test_186_*.py -x -q` (< 30 s).
- **Per wave merge:** `npx vitest run` (frontend, full) **+** `pytest -q` (backend, full), with
  the **counts** compared against the 3457 / 209 baselines.
- **Phase gate:** both full suites green *and* counts non-decreasing, before `/gsd:verify-work`.

### Wave 0 gaps

- [ ] `backend/tests/unit/test_186_concurrent_patch.py` — F1/F2/F3/F13. Use the shipped live-DB
      skip-guard (`test_publish_flip.py:28-46`) and the direct-route-call idiom
      (`test_workflows_routes.py:17-21`: call the route fn with a `current_user` dict + a patched
      `get_pg_pool`, no HTTP client).
- [ ] `backend/tests/unit/test_186_publish_race.py` — F5/F6. Same idioms; `publish_definition` can
      be exercised directly without running a real golden run.
- [ ] `frontend/src/hooks/useDraftPersistence.test.tsx` — F8/F9/F10/F11/F15. Mirror
      `useLiveValidation.test.tsx`'s structure (fake timers + a spied API module).
- [ ] `PublishGauntlet.test.tsx` — **F7**, the fail-open guard. Highest-value single test in the
      phase; it protects every future `blocked_stage`, not just `draft_changed`.
- [ ] `test_103_published_409.py` — update for the object-shaped detail. **Do not delete.**
- [ ] `builderStore.test.ts` — retarget the `setSaveState` invariant; add F14.
- No framework install needed.

### G-4 lived-experience UAT (locked by D-186-13) — authored in VALIDATION.md, not PLAN.md

Chrome, driven live by the operator. Wire format + screenshot are **insufficient** per G-4.

| # | Scenario | Expected | Status |
|---|---|---|---|
| 1 | **Two tabs** — same draft open in A and B; edit in A (let it autosave), then edit in B | B shows the honest banner, **stops writing**, offers **Reload** (default) then **Overwrite**. A's content is intact. | to run |
| 2 | **Stale tab** — leave B open, edit + save in A, return to B minutes later and type | Same honest outcome. No silent overwrite, no retry storm. | to run |
| 3 | **Publish race** — start a publish in A, edit in B mid-gauntlet | Publish refuses with the worded `draft_changed` verdict; the golden-run receipt is still browsable; the spine shows a **block**, **not** 8 green pips. | to run |
| 3b | **Publish hold** — start a publish in A, then edit **in A** | The status line says *"Publishing — changes will save when it finishes"*; the edit flushes on resolution. | to run |
| 4 | **Colleague clobber** — a second user PATCHes the same draft | ⛔ **BLOCKED — not reachable in the product.** `workflow_definitions` UPDATE is `auth.uid() = created_by` at both the RLS layer (`108_rls_membership_rewrite.sql:484-500`) and the service-layer WHERE (`db/workflows.py:415`); mig 111 gave workflows `is_system_global` (a platform flag), **not** `is_org_shared`. Recorded with its reason, **never dropped** — the scoreboard rule. Re-opens if the org-share toggle ships. | ⛔ |
| 5 | **KB re-bind, three paths** — bind/re-bind from (a) NL-generated, (b) forked starter, (c) Tweak fork | The chip is a picker in all three; the unbound state reads *"No knowledge base · searches everything"* with **no** severity, code, or tray row; the binding persists through autosave and survives a reload. | to run |
| 6 | **Never a false `Saved ✓`** — force a 422 (e.g. mid-edit invalid shape) | `Not saved — …`; the draft stays dirty; the leave guard fires on navigate-away. | to run |

**On SC#10:** the roadmap scopes **no full cross-provider matrix** for this phase — *"Phase 186
(Concurrency) carries the SC#10 parallel axis (two-editor UAT row) but not full cross-provider
streaming"* (`.planning/ROADMAP.md`, §Guardrails firing (v3.6)). Nothing here touches streaming,
the agent loop, or provider routing. **The parallel axis alone requires rows 1–3 above** — two
concurrent editing sessions against one draft, driven live. The 8-provider roster is **not**
required and manufacturing it would be ceremony, not evidence. Row 3 is the parallel axis's
sharpest instance because it crosses a minutes-long server operation.

---

## Security Domain

The roadmap explicitly scopes **no threat model** for this phase — *"NO threat model on the other
pure-UX CORE canvas phases (183, 184, 186-189) unless a discuss-phase surfaces a real trust
boundary"* — and discuss-phase surfaced none. This section therefore records only the invariants
that **must not regress**, not a new model.

### Invariants that must not regress

| Invariant | Where enforced today | How 186 could break it |
|---|---|---|
| **Owner scope is the only authz boundary** — the service-role pool bypasses RLS, so `created_by = $N` in the WHERE *is* the wall (T-103-01-01) | `db/workflows.py:415`, `:303`, `:385`, `:445` | Replacing (rather than **adding to**) the WHERE conjuncts while wiring the token. The token is a **concurrency** check, never an **authorization** check. |
| **404-collapse** — not-found and not-owned are indistinguishable | `api/workflows.py:937`, `:810` | The D-186-09 disambiguating re-read, if written **without** `created_by = $2`, would answer "that row exists but isn't yours". §2's query order prevents this. |
| **Published-row immutability** | trigger `workflow_definitions_block_published_update` (mig 056:78+) + the `status='draft'` conjunct + the `CheckViolationError` → 409 mapping (`api/workflows.py:931`) | Removing the `CheckViolationError` handler because the `status='draft'` conjunct "already covers it" — it does not in a race. Keep both. |
| **Server-forced create invariants** — `status='draft'`, `is_system_global=false`, `created_by` bound to the trusted owner | `db/workflows.py:359-368`, `api/workflows.py:861` | Adding a token field to the create body should not open a path to any other client-supplied column. |
| **Client never re-derives a server verdict** (D-182-06 / VALID-03) | `useLiveValidation.ts:52-58`, `PublishGauntlet.tsx:108-110` | The `draft_changed` sentence must come from a client **wording map keyed on the server's code**, not from a client-computed decision about whether a block happened. |
| **Zero information leak in the 409 body** | new | The returned `token` is a timestamp of a row the caller **already owns** (the re-read is owner-scoped). Nothing new is disclosed. Do **not** add `created_by`, `slug`, or any other field to the refusal body. |

### ASVS categories touched

| Category | Applies | Control |
|---|---|---|
| V4 Access Control | **yes** | Owner-scoped `created_by = $N` on every query; 404-collapse. Unchanged by this phase — verified, not extended. |
| V5 Input Validation | **yes** | The token is `str`-typed and used **only** in a parameterized `$N` comparison — never interpolated, never parsed, never used to build SQL. `definition_id` stays a path `UUID` (FastAPI 422 on malformed). |
| V2 Authentication / V3 Session | no | Unchanged (`get_current_user`, `require_visible("workflow_authoring")`). |
| V6 Cryptography | no | The token is not a secret and carries no integrity claim. |

### Threat patterns considered and dismissed

| Pattern | STRIDE | Why not a concern here |
|---|---|---|
| SQL injection via the token | Tampering | The token is a `$N` bind parameter. `CONCURRENCY_TOKEN_SQL` is a code constant with no user input. |
| Token forgery to clobber another user | Elevation | The token is not an authz credential. Guessing it does not bypass `created_by = $N` — a forger with a perfect token still matches 0 rows on someone else's draft. |
| Information disclosure via the returned token | Information Disclosure | Owner-scoped re-read ⇒ the caller already owns the row. |
| Denial of service via autosave write amplification | DoS | Single-flight + a 1000 ms debounce bound the write rate to < 1/s per open draft. A no-op UPDATE still bumps the token (probe K) but writes one row. |

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|---|---|---|---|
| Persistence lives on `WorkflowBuilderPage.tsx` (`onPersist`, `draftIdRef`, `creatingRef`) | Extracted to `useDraftPersistence` | **This phase** — pre-authorized by D-184-05 verbatim | The extraction *is* the G-5 honouring. |
| `updateWorkflowDraft` throws away the 409 body | Reads `detail.code` | This phase | Enables D-186-09 without a new status. |
| `blocked_stage` unknown ⇒ spine renders green | Unknown ⇒ never green | This phase | Fixes a latent fail-open that predates 186. |
| Explicit-save-only (D-184-16: "there is no autosave in this phase") | Debounced autosave + explicit save | This phase | `UNSAVED_LEAVE_PROMPT` changes meaning (D-186-03) but is not deleted. |
| React 18 idioms | **React 19.2.4** | v3.x | StrictMode double-invoke still applies; `creatingRef` remains load-bearing. |
| `is_global` on `workflow_definitions` | **`is_system_global`** (a platform flag; folders/skills got `is_org_shared`) | mig 111 / D-165-01 | Why CONCUR-02's literal "two people" is unreachable. |

**Deprecated / do not use:**
- `updated_at::text` for comparison — session-`TimeZone`-dependent (probe G).
- `supabase-py` on the workflows path — it is blocking; this path is asyncpg end-to-end.
- Playwright E2E as a backstop — 16/17 rot (SEED-049).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `xmin` is unsuitable as a concurrency token because it wraps and is not preserved across `VACUUM FREEZE` / `pg_dump` restore. Reasoned from Postgres MVCC semantics; **not probed** in this session. | Alternatives Considered | None — `xmin` was rejected in favour of an approach that *was* probed. Only matters if someone revives it. |
| A2 | `backend/tests/unit/test_103_published_409.py` is the test most likely to assert the exact published-409 detail string. Inferred from the filename; the file body was not read. | Pitfall 6 / Wave 0 | Low — the planner will grep for the literal anyway. Worst case another file also needs updating. |
| A3 | An `If-Match` header is preferable to a wrapper request model. Reasoned from the shipped `extra='forbid'` contract and RFC idiom; not validated against a FastAPI implementation in this session. | §1 | Low — if header plumbing proves awkward, the wrapper model is a mechanical fallback that costs a body-shape change to `PATCH /workflows/{id}` and its tests. |

Everything else in this document is `[VERIFIED]` by execution against the live stack or by
reading the cited `file:line`.

---

## Open risks the planner must decide

1. **Where the token rides on the PATCH.** `If-Match` header (recommended, additive) vs a wrapper
   request model (breaking body change). §1. **A3.**
2. **Whether the token is required or optional on the route for one release.** Required ⇒ every
   browser tab open across the deploy breaks on its next save. Recommend optional-for-one-release
   with the absence meaning today's behaviour, then tightened. This is a real decision, not an
   oversight — record it either way.
3. **409-with-code vs 412.** Recommended 409 (§2). If overruled, `PublishOutcome` and
   `httpStatusForKind` (`PublishGauntlet.tsx:124-135`) grow a 5th kind.
4. **Whether binding a KB flips `hasEdited`.** Option (a) recommended (call-site flip). Option (b)
   means the very edit BUG-260731-03 is about produces no live check. Must be stated.
5. **Where `draft_changed` sits in `STAGES`.** A 9th entry after `Judge`, or `codes` on a renamed
   final stage. Both are honest; the spine's visual meaning differs. A sketch is **not** required
   (this is a label, not a "feels like" surface), but the planner should pick one and say why.
6. **Unbinding a KB while a phase carries `folder_scope`** (Pitfall 8) — refuse client-side, or
   prove unreachable by test. Not covered by D-186-17, which only anticipated the *bind-first*
   direction.
7. **How the `builderStore.test.ts` `setSaveState` assertion is preserved** when the slot is
   retired. Retarget, do not delete. Record before/after counts.
8. **Where the conflict banner mounts.** The header (`actionGroup`, `:1553-1594`) is already the
   phase's UI budget home and requires **no** `WorkflowCanvas.tsx` change — which is what keeps
   G-5 (188 extraction) clean. If a plan proposes the canvas bottom region instead, that is a
   guardrail fire.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Local Supabase Postgres (:54322) | Live-DB tests F1–F6, the §1 probe | ✓ | PG **17.6** | Tests skip cleanly via the shipped `_pg_reachable` guard |
| `backend/venv` python | All backend work | ✓ | 3.12 | — |
| `asyncpg` | The workflows path + probes | ✓ | ≥0.29 (installed) | — |
| `psycopg2` | Live-DB test skip-guard | ✓ | installed | — |
| `pydantic` | Models | ✓ | **2.12.5** | — |
| Node + `npx vitest` | Frontend tests | ✓ | vitest **4.1.0** | — |
| Chrome + Chrome MCP | G-4 UAT rows | ✓ (can hang) | — | Operator drives manually + psycopg2 for DB evidence (the shipped fallback) |
| Playwright | — | ✓ but **rotted** (16/17 fail, SEED-049) | 1.60 | Not used as a backstop |
| Docker / Redis / sandbox image | — | not needed | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none blocking.

---

## Sources

### Primary (HIGH — executed or read in this session)

- **Live probe** `token_roundtrip.py` against `postgresql://…@127.0.0.1:54322/postgres`, PG 17.6,
  `backend/venv` asyncpg — probes 0/A–M. The decisive evidence for §1.
- **Live probe** `pyd.py`, pydantic 2.12.5 — datetime-vs-str serialization behaviour.
- `backend/app/db/workflows.py:280-448` — `get_definition`, `publish_definition`,
  `create_workflow_definition`, `list_draft_workflows`, `update_workflow_definition`,
  `delete_workflow_definition`.
- `backend/app/api/workflows.py:132-151` (`DraftCreateResponse`/`DraftRow`), `:740-822` (publish
  route + `PublishVerdict`), `:825-969` (draft CRUD routes), `:1011-1049`.
- `backend/app/services/harness/publish_service.py:85-160` (stage 0), `:330-392` (stage 5 + WR-03),
  `:396-429` (`_block`).
- `backend/app/models/harness.py:270`, `:293-305` (`_folder_scope_requires_project`).
- `supabase/migrations/056_workflow_definitions.sql:16-90` — table, `set_updated_at` trigger,
  immutability trigger.
- `supabase/migrations/014_folders.sql:52-58` — `set_updated_at` = `NEW.updated_at = now()`.
- `supabase/migrations/114_harness_audit_action_risk_pending.sql:30-49` — the current
  `event_type` allow-list (`publish_blocked` present).
- `frontend/src/hooks/useLiveValidation.ts` (whole file).
- `frontend/src/components/workflows/builderStore.ts` (whole file).
- `frontend/src/components/workflows/PublishGauntlet.tsx:100-350`, `:508-546`.
- `frontend/src/components/workflows/CanvasToolbar.tsx:78-121`.
- `frontend/src/pages/WorkflowBuilderPage.tsx:70-136`, `:240-263`, `:400-470`, `:505-560`,
  `:676-735`, `:985-1071`, `:1110-1210`, `:1225-1310`, `:1330-1380`, `:1530-1657`.
- `frontend/src/pages/WorkflowsPage.tsx:176-295` — the four Builder entry paths.
- `frontend/src/lib/api.ts:1-70`, `:3230-3380`, `:3440-3505`, `:3596-3640`.
- `backend/tests/unit/test_publish_flip.py:1-80` — the live-DB skip-guard idiom.
- `backend/tests/integration/test_workflows_routes.py:1-55` — the direct-route-call idiom.
- Measured suite baselines: `pytest --collect-only -q` → 3457; `npx vitest run <7 files>` → 209.
- `.planning/ROADMAP.md` §Phase 186, §Guardrails firing (v3.6).
- `.planning/REQUIREMENTS.md:54-55`, `:77`.
- `.planning/reported-bugs/BUG-260731-03-…md` (whole file).
- `CLAUDE.md`, `.planning/config.json`.

### Secondary (MEDIUM)

- RFC 9110 §15.5.10 (409 Conflict), §15.5.13 (412 Precondition Failed), §13.1.1 (`If-Match`) —
  the status-code reasoning in §2.
- PostgreSQL `to_char` format-pattern semantics (`US` = 6-digit microseconds) — corroborated by
  probe E/F output rather than taken on faith.

### Tertiary (LOW — flagged, not relied upon)

- `xmin` durability characteristics (A1) — training knowledge, not probed. Only relevant to a
  rejected alternative.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Token round trip (§1) | **HIGH** | 13 probes executed against the live stack, including the two that falsify the naive approach (C/D) and the one that confirms the hard constraint (B). |
| Failure-path contract (§2) | **HIGH** on the code facts (the 409 body is discarded at `api.ts:3353`; 412 appears nowhere); **MEDIUM** on the recommendation, which is a judgement call between two RFC-legal options. |
| Hook mechanics (§3) | **HIGH** on the hazards (all read at `file:line`: the deps trap, the `phases`-only dirty subscription, the `meta` exclusion, StrictMode + React 19.2); **MEDIUM** on the 1000 ms constant, which is reasoned, not measured. |
| Publish guard (§4) | **HIGH** — the no-migration claim was independently re-verified against mig 114, and the spine fail-open was traced line by line. |
| KB control (§5) | **HIGH** — all four Builder entry paths read in `WorkflowsPage.tsx`; the picker, the chip, and `folderOptions`' unconditional fetch all located. |
| Test infrastructure | **HIGH** — both baselines measured by execution. |
| Pitfalls | **HIGH** — every one is traced to a specific shipped line, not a general worry. |

**Research date:** 2026-08-01
**Valid until:** ~2026-08-31 (stable domain; the only decay risk is further edits to
`WorkflowBuilderPage.tsx` or `PublishGauntlet.tsx` before the phase executes)
