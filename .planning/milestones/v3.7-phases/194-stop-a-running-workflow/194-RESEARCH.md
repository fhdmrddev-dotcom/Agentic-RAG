# Phase 194: Stop a Running Workflow - Research

**Researched:** 2026-08-16
**Measured at HEAD:** `05f664a0` (`docs(state): 194 context gathered…`), branch `develop`
**Domain:** Run lifecycle / cancel semantics across two run tables + four frontend Stop mounts
**Confidence:** HIGH on the backend path and the id-type findings (all driven against live source + live DB); MEDIUM on the BUG-260815-04 duplicate-icon root cause (hypothesis with named evidence, not driven)

---

## Summary

CONTEXT's central re-scoping is **correct and re-verified**: the cancel path ships end to end
(`DELETE /runs/{id}` → `_cancel_run_internals` → `task.cancel()` → producer `CancelledError` →
F2 → `finish_run(workflow_run_id, 'cancelled')`), and every file:line CONTEXT cites still holds at
HEAD. 194 is not "build cancel."

But three of CONTEXT's *supporting* claims are measurably FALSE, and each changes the plan shape:

1. **The thread anchor IS already cleared on the zombie arm** (Phase 092-03, `run_lifecycle.py:243-254`).
   D-09's "the anchor is never cleared ⇒ the thread is permanently wedged" is half wrong. Only
   `workflow_runs.status` is missing. The fix is smaller and its *justification* must be restated.
2. **The two stuck rows are NOT a delete blocker.** `delete_workflow_cascade` already calls
   `_cancel_run_internals` **and** `finish_run(wf_id, "cancelled")` for every in-flight run before
   the delete (`api/workflows.py:1486-1512`). Measured: neither definition is `is_system_global`, so
   the 409 guard cannot fire either. D-12 still deserves to ship — but not for the reason given.
3. **The library feed carries no run id of any kind.** `LibraryRow` (`library/libraryRow.ts`) has no
   run/live concept and the three feeds are definition feeds. D-08 mount 4's premise — *"using a run
   id the library already has"* — is false. Mount 4 is a new backend read, i.e. a second concern.

And the single most dangerous finding, which nothing in CONTEXT anticipates:

> **`WorkflowLock.runId` carries two different id types depending on which code path last wrote it.**
> Two of its four write sites store a `workflow_runs.id`; two store a producer `runs.run_id`. Its own
> JSDoc (`streamsStore.ts:52`) asserts only the first. `DELETE /runs/{id}` accepts only the second, and
> `cancelRun` **swallows 404**. A Stop mount that reads `workflowLock.runId` therefore *silently
> succeeds while doing nothing*, roughly half the time — which is precisely the dishonesty SC#2 exists
> to forbid.

The good news is that the app has already solved this twice: `POST /runs/{id}/continue` and
`POST /runs/{id}/ask_user_response` both accept **either** id via an owner-scoped, thread-anchor-
confirmed fallback. `DELETE /runs/{id}` is the odd route out.

**Primary recommendation:** Make `DELETE /runs/{run_id}` accept either id via the shipped
Continue/ask_user fallback shape (resolving forward to the live producer `runs.run_id`), extend
Step 3b's zombie arm with `finish_run` + an in-flight-phase terminalize behind migration 119, and
mount the panel Stop as an **additive sibling `PanelSection` calling `stopThread(threadId)`** — never
`workflowLock.runId`. Descope or re-justify mount 4.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cancel intent (user gesture) | Browser / Client | — | Four mounts, one `cancelRun` call |
| Run-id resolution (which id is this?) | **API / Backend** | — | The client cannot know which id it holds; the two shipped fallbacks already put this on the server |
| Producer task interruption | API / Backend | — | `RUN_TASKS` is per-process, in-memory |
| Terminal status durability (`runs`, `workflow_runs`) | Database / Storage | API | `finish_run` + `finalize_run_terminal` own the transactions |
| Interrupted-phase honesty | Database / Storage | API | A CHECK constraint + a targeted UPDATE; the value is persisted, not derived (mig 115's D-17 rule) |
| Stopped-state vocabulary | Browser / Client | — | The slug is stored; the sentence is rendered (mig 115 D-17, inherited) |
| Chat-surface progress legibility (BUG-260815-04) | Browser / Client | — | ⚠ The data is already in the client store; this is a consumption gap, not a propagation gap |
| Historical data repair (D-12) | Database / Storage | — | Two rows, one recorded write |

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `194-CONTEXT.md` `<decisions>`. Where research measured a claim inside a
decision to be false, the decision is reproduced **unchanged** and the correction appears in
§*CONTEXT claims measured FALSE or STALE* — never edited into the decision text.

**Guardrails**
- **D-01 — G-5 FIRES ON TWO FILES AND IS HONOURED BY CONSTRUCTION, NOT WAIVED.**
  `frontend/src/components/chat/RunCard.tsx` (**20 commits / ~9 buckets**) and
  `frontend/src/components/panel/WorkspacePanel.tsx` (**13 / ~8**) are both far past the ≥3
  threshold, and **neither is a ROW in the `CLAUDE.md` hot-file ledger** — both names occur only
  inside other rows' prose, which is the same invisibility that hid `WorkflowsPage.tsx` for ten
  phases, `WorkflowDoorSwitch.tsx` for six and `WorkflowBuilderPage.tsx` for ten. **No extraction is
  taken.** The measured reason, which must be re-verified at plan time rather than inherited: 194
  adds a **Stop affordance to surfaces that already own run state** — `RunCard.tsx` already renders
  `cancelled` (`:534`, `:548`) and `WorkspacePanel.tsx` already reads the run — so it adds a control,
  not a second concern. ⚠ **If planning finds the Stop requires new state ownership in either file,
  that is a SECOND concern and the refactor recommendation is owed FIRST.**
  ⚠ **A G-5 override was OFFERED AND DECLINED.** If `.planning/STATE.md` records no guardrail
  override for Phase 194, that absence is a measurement — the fourth consecutive phase to decline one.
- **D-02 — Writing the two missing ledger rows is a PHASE DELIVERABLE, not a nicety.** Each row must
  carry re-derivable commands (`git log --oneline -- <file> | wc -l`, the standard `sed` bucket
  recipe with quick-task buckets **subtracted**, `wc -l`), the G-5 verdict, the invariants that bind
  the file, and the named next seam — the shape the `db/workflows.py` and `publish_service.py` rows
  use. **The sentence explaining that the file was absent from the table must survive future edits.**
- **D-03 — G-1 does not fire** (194 is not an `.N` insert on a hot file). **G-2 does not fire as a
  blocker**: the Stop control is an affordance on shipped surfaces, not a new visual surface. ⚠ If
  planning proposes a *new* run-surface layout rather than a control inside the shipped spine, G-2
  fires and a sketch is owed first.

**The interrupted phase (SC#3)**
- **D-04 — A NEW MIGRATION ADDS A `cancelled` LITERAL TO `workflow_phases_status_check`.**
  Measured: `finish_run` writes the run row + the anchor and **nothing else**, so the in-flight
  `workflow_phases` row stays `active` **forever** on a cancelled run; and the CHECK (mig 115,
  `:113-119`) admits exactly **`pending / active / completed / failed / skipped /
  recorded_not_sent`** — there is **no `cancelled`**. Reusing `failed` or `skipped` was offered and
  **REJECTED as dishonest** in a phase whose entire requirement is honesty: the phase did not fail,
  and it was not skipped — it ran and was interrupted.
- **D-05 — The migration is `119_*.sql`** (112 files present; highest number **118**). It follows the
  **mig-115 shape exactly**: `ALTER … DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT` with **all six
  shipped literals re-added verbatim** plus the one new one (6 → 7), no table/column/index/grant
  change, **no RLS touched**. ⚠ **A re-typed `ARRAY[…]` is precisely where a shipped literal gets
  silently dropped and orphans every existing row using it** — mig 115 says so in its own header and
  pins all six with a test; 119 must do the same, plus a NEGATIVE control asserting a nonsense value
  is still refused with SQLSTATE `23514` naming the constraint.
- **D-06 — Apply it by pasting into the Supabase SQL editor**, never `db push` / `db reset`, then
  regenerate with `bash scripts/regenerate-full-schema.sh` (no `--reset`). Project rule, not a choice.
- **D-07 — The cancel path terminalizes the in-flight phase.** A stopped run's interrupted phase
  reads `cancelled`; completed phases are **left untouched** — the engine's existing D-07 rule
  (*"Completed phases' outputs are ALREADY durable — `finish_run` does NOT touch them"*) is preserved
  verbatim, not re-litigated.

**Where Stop lives**
- **D-08 — FOUR MOUNTS, ONE MECHANISM. Every Stop routes through the single durable cancel path
  (`cancelRun` → `DELETE /runs/{id}`); no second cancel path may be introduced.** This mirrors
  `ActiveRunsTray`'s own shipped rule (*"Every Stop routes through the one durable cancel path"*).
  1. **The panel's phase spine — PRIMARY.** `WorkspacePanel.tsx` currently has **no Stop control of
     any kind** (`grep` returns only local `let cancelled` effect flags). This is where a user
     watches a workflow run, per the Phase 094/103 design decision that **the panel owns the
     meaningful phase spine and chat carries a thin run receipt**.
  2. **The composer Stop, made reliable during a harness run.** `composer-stop`
     (`MessageInput.tsx:403-416`) and `ChatArea.tsx:361` `onStop={stopStreaming}` already ship.
     ⚠ **Whether it actually renders and fires during a workflow run is UNVERIFIED and must be
     MEASURED, not assumed** — `BUG-260815-04` reports the chat surface stuck pre-tools for the whole
     run, and `stopThread` (`StreamsProvider.tsx:2400-2416`) finds its `runId` by scanning for an
     assistant message with `runStatus === "streaming"`, which that stuck state may defeat.
  3. **The `ActiveRunsTray` row.** Already has per-run Stop + Stop-all routed through `stopThread`;
     a workflow run should be stoppable from outside its thread without navigating in.
  4. **The Workflows page row — the LIVE half only.** A *running* workflow's library row gets a Stop
     using a run id the library already has. **No new history surface** (D-15).

**The run that nobody can stop (SC#2)**
- **D-09 — THE ZOMBIE ARM IS EXTENDED ACROSS TO `workflow_runs`, AND THIS IS THE PHASE'S LOAD-BEARING
  BACKEND CHANGE.** Measured: `_cancel_run_internals` Step 3b heals **only** the `runs` row —
  `finalize_run_terminal` never touches `workflow_runs`. With `WORKER_COUNT=2` and a **per-process**
  `RUN_TASKS` dict, a Stop landing on the wrong worker takes this arm, so `workflow_runs` stays
  `active` forever and the thread anchor is never cleared ⇒ **the thread is permanently wedged.**
  Without this, *"stop at **any** point"* is false precisely when a user most wants to stop.
- **D-10 — The heal must co-write in ONE discipline**, the way `finalize_run_terminal` already
  co-writes `runs.status` + both mirror ZREMs atomically (*"so a healed zombie can't leave
  `runs.status` terminal while `runs:active` still lists it"*). The workflow half is
  `workflow_runs.status='cancelled'` **+ the `threads.active_workflow_run_id` clear**, which
  `finish_run` already pairs in one transaction — **reuse it; do not write a second writer.**
- **D-11 — The outcome discriminator's honesty rule is INHERITED, not re-decided.** A
  `"zombie_healed"` outcome renders **"recovered a stuck run"**, NEVER "killed" (064-B). A workflow
  zombie heal must obey the same rule.
- **D-12 — The two historically stuck rows ARE healed in this phase.** Two `workflow_runs` rows have
  been `active` since **2026-06-14** and **2026-08-01** and are a **permanent delete blocker**
  (`BUG-260815-07`). ⚠ **They are DATA, not code** — the plan must state whether they are healed by
  running the new path against them or by a one-off recorded write, and the row ids + before/after
  status must be captured, because *a data repair with no receipt is indistinguishable from a claim*.

**The aftermath (SC#2 / SC#3)**
- **D-13 — A stopped run keeps its completed phases, marks the interrupted one, and is TERMINAL.**
  The spine shows what genuinely finished; the interrupted phase reads **stopped, not failed**; there
  is **no resume**. Resumability was offered and REJECTED: `workflow_runs.status` already carries a
  distinct **`paused`** for that meaning (migs 057/063), so making `cancelled` mean "pausable" would
  collapse two states SC#2 needs to keep apart. Collapsing to a bare `cancelled` that hides partial
  work was also rejected — it discards evidence the database still holds.
- **D-14 — `RunCard`'s shipped vocabulary is the starting point, not a rewrite.** It already maps
  `cancelled` → `"■"` / `"cancelled"` (`:534`, `:548`). Planning may extend it; it may not replace it
  without stating why.

**Folded bugs** — `BUG-260815-07` FOLDED (reproducible half only; the non-reproducible delete failure
stays open); `BUG-260815-04` FOLDED (⚠⚠ the string is DELIBERATE and byte-pinned — the defect is that
the surface never ADVANCES; the duplicate assistant icon is a SECOND symptom kept separate on
purpose); `BUG-260808-02` FOLDED with a scope fence (194 covers *stopping a run that is waiting at an
approval*, not redesigning where approval lives).

### Claude's Discretion

- The exact wording of the stopped-state copy on each of the four mounts (constrained by D-14 and by
  `references/icon-convention.md` §4 for any canvas/spine mark).
- Whether the panel Stop is a per-run control or a per-phase one, provided it reads as stopping the
  RUN and cannot be confused with skipping a phase.
- Test-fence design, subject to the project's standing rule: **a fence is only real once you have
  watched it fail.** Every new fence is driven RED against a real plant in production source.

### Deferred Ideas (OUT OF SCOPE)

- **D-15 — `BUG-260815-03`, run history unreachable from the canvas → PHASE 195**, with
  `re_open_trigger: "the first phase that renders a completed workflow run's phases outside the chat
  thread"`.
- **The approval surface's home** — `BUG-260808-02` folded only for *stopping a run waiting at an
  approval*. Moving approval off chat is a phase. Trigger: any plan whose fix requires relocating the
  approval checkpoint.
- **`BUG-260815-07`'s non-reproducible delete failure** — stays open. Trigger: a second sighting.
- **Scheduled / recurring runs + budget caps** (Phase 105 carry-forward) — RUN-01 is their hard
  prerequisite; the spend-cap brake does not exist and is not built here.
- **Deep-run cancel behaviour** — untouched. Any change to it is a regression, not a deliverable.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **RUN-01** | *A user can stop a running workflow at any point, and the run reports honestly that it was stopped.* (`REQUIREMENTS.md:70`) | **SC#1** ← §*The id-type landmine* + §*The dual-id fallback precedent* (the reachability fix) and §*Mount-by-mount verdict*. **SC#2** ← §*The zombie arm* (D-09/D-10 corrected) + §*The two stuck rows*. **SC#3** ← §*The interrupted phase row* + §*Migration 119*. Downstream dependents re-verified: `REQUIREMENTS.md:85` (Phase 105 scheduled runs) and `:87` (the connections milestone) both name RUN-01 as a hard prerequisite. |

---

## Project Constraints (from CLAUDE.md)

Directives that bind this phase, extracted and re-verified at HEAD:

| Directive | Binding here |
|---|---|
| Python backend must use a `venv` | All backend commands run through `backend/venv/Scripts/python.exe` |
| No LangChain / LangGraph; raw SDK only | No new orchestration layer for cancel |
| All tables need RLS | ⚠ **The workflow cluster reads through a service-role pool that BYPASSES RLS** — on `_cancel_run_internals` and the delete cascade the `WHERE` clause **is** the access boundary (`db/workflows.py:849-850`, `api/workflows.py:1428-1431`). Any new query added here is a security surface. |
| Do not run blocking I/O in async handlers | The existing zombie arm uses `aexec(...)` (`app.utils.db`) to wrap the supabase client; any new supabase read must too. `finish_run` takes an `asyncpg.Pool` and is natively async — safe. |
| Schema changes ship as numbered SQL migrations at `supabase/migrations/`, `<digits>_name.sql` | Migration **119** (D-05) |
| **Apply migrations by pasting into the Supabase SQL editor — never `db push`/`db reset`**, then `bash scripts/regenerate-full-schema.sh` (no `--reset`); never hand-edit `full-schema.sql` | D-06, verbatim |
| Multi-worker uvicorn default `WORKER_COUNT=2` | The reason the zombie arm is ~half of missed Stops, not an edge case |
| Realtime is a hint, not truth — reconcile via fetch | The Stop's truth is `runs.status` / `workflow_runs.status`, not an SSE sentinel |
| Deployment-artifact parity (same-commit rule) | No env var, bundled service or sandbox tag changes here ⇒ `scripts/check-deploy-drift.sh` should be unaffected; **the migration must be added to the standing cloud parity window, not applied to cloud in this phase** (mig 115's own precedent) |
| Worktrees ON; `GSD_VITEST_MAX_WORKERS=2`; **rule 4 — serialize DB-mutating plans** | See §*Validation Architecture → Wave serialization* |
| Reported-bugs cross-check at `plan-phase` | Verify every report with `folded_into: 194` is addressed by at least one plan task |
| Provider-docs-first | Not triggered — no provider-specific behaviour in this phase |

---

## Standard Stack

**No new packages. This phase adds zero dependencies.**

Everything it needs already ships. Verified present in the tree at HEAD:

### Core (all pre-existing)
| Module | Location | Purpose | Why it is the standard here |
|---|---|---|---|
| `_cancel_run_internals` | `backend/app/services/run_lifecycle.py:158-291` | The shared cancel / zombie-heal writer | Already reused **verbatim** by the operator Kill path **and** the delete cascade — three callers, one discipline. Extend; never fork. |
| `finish_run` | `backend/app/db/workflows.py:1308-1338` | `workflow_runs.status` + anchor clear in ONE transaction | Already accepts `"cancelled"` from the F2 caller; already idempotent |
| `finalize_run_terminal` | `run_lifecycle.py:118-155` | Atomic `runs.status` + both mirror ZREMs | The co-write discipline D-10 mirrors |
| `get_active_phase` | `db/workflows.py:1088-1106` | The single `status='active'` phase row for a run | Exactly the read the phase-terminalize needs on the zombie path |
| `cancelRun` | `frontend/src/lib/api.ts:1259-1268` | `DELETE /runs/{id}`, 404-tolerant | The one durable frontend cancel path |
| `stopThread` | `frontend/src/providers/StreamsProvider.tsx:2400-2424` | Resolve a thread's producer runId, then `cancelRun` | ⚠ **The only client-side resolver that gets the id type right.** Prefer it over `workflowLock.runId` everywhere. |
| `PanelSection` | `frontend/src/components/panel/PanelSection.tsx` | Additive-sibling panel section | The G-5-safe mount shape the panel already uses five times |

### Supporting
| Module | Location | When to use |
|---|---|---|
| `publish_cancel_sentinel` | `app/services/ask_user_service` | Waking a paused `ask_user` — already fired in Step 3a AND by the delete cascade on the **workflow-run** channel |
| `aexec` | `app/utils/db` | Wrapping any supabase-client call inside an async handler |
| `is_app_shutting_down` | `harness_engine.py:92-94` | ⚠ Gates F2 and the ask_user expiry. See §*Does the zombie co-write need the shutdown gate?* — the answer is **no**, with proof |
| `test_migration_115.py` | `backend/tests/` | The live-DB-gate template for migration 119's test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Extending `DELETE /runs/{id}` to accept either id | A new `DELETE /workflow_runs/{id}` | Rejected on D-08's "one mechanism" and on the shipped precedent: `/continue` and `/ask_user_response` both chose the fallback, not a second route. A second route would also need its own ownership gate, its own `RUN_TASKS` resolution and its own audit verb. |
| `finish_run` on the zombie arm | A new `cancel_workflow_run` writer | Rejected by D-10 and by measurement: `finish_run` already pairs the status write and the anchor clear in one transaction, is idempotent, and is already called from a cancel context by `delete_workflow_cascade` |
| Terminalizing the phase inside the engine's `CancelledError` arm | Inside `finish_run`'s transaction | See §*Where the phase terminalize belongs* — the recommendation is **both**, for a measured reason (the zombie path has no engine) |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** The `Standard Stack` above is entirely
first-party modules already present in the repository, verified by direct file read at HEAD. No
`slopcheck` run is owed because no registry package is recommended.

If a plan later proposes a package (e.g. a toast library for a Stop confirmation), it must run the
Package Legitimacy Gate first. ⚠ Prior art: Phase 192's gap-closure round explicitly **refused** to
acquire `sonner` for exactly this reason — *"a gap round is the wrong place to add a dependency."*

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────── 4 STOP MOUNTS, ONE MECHANISM (D-08) ───────────────┐
                         │                                                                     │
 (1) WorkspacePanel      │  (2) composer-stop      (3) ActiveRunsTray      (4) library row     │
     phase spine         │      MessageInput           per-run + all           ⚠ NO RUN ID     │
        │                │          │                      │                    EXISTS         │
        └── stopThread ──┴── stopStream ─────────┴── stopThread ────┘         (see §Mount 4)   │
                    (threadId) │                                                                │
                               ▼                                                                │
        scan chat bucket → assistant msg where runStatus==="streaming" → msg.runId               │
                               │        ⚠ msg.runId is the PRODUCER runs.run_id  ✔ correct type │
                               ▼                                                                │
                        cancelRun(runId)  ──────► DELETE /runs/{run_id}                          │
                          ⚠ swallows 404          api/runs.py:1155                               │
                                                        │                                        │
                    ┌───────────────────────────────────┴──────────────────────────────┐         │
                    │ Step 1 ownership SELECT on `runs` (RLS client)                    │         │
                    │   ⚠ MISS ⇒ 404 today.  ✚ NEW: fall back to workflow_runs           │         │
                    │      (owner-scoped + thread-anchor-confirmed) → resolve forward   │         │
                    │      to the thread's live `runs` row  [copy /continue + /ask_user] │         │
                    └───────────────────────────────────┬──────────────────────────────┘         │
                                                        ▼                                        │
                                    run_lifecycle._cancel_run_internals(:158)                    │
                    ┌───────────────┬────────────────────┴───────────────────┐                   │
                    ▼               ▼                                        ▼                   │
             Step 2 TERMINAL   Step 3a HAPPY                          Step 3b ZOMBIE             │
             already terminal  RUN_TASKS has a live task              no live task               │
             → "terminal_noop" → publish ask_user sentinel            (~half of Stops:           │
               no writes         → task.cancel()                       WORKER_COUNT=2,           │
                                 → "task_cancelled"                    per-process RUN_TASKS)    │
                                        │                                     │                  │
                                        ▼                                     ▼                  │
                          producer CancelledError                  finalize_run_terminal          │
                          run_producer.py:490-496                    runs.status='cancelled'      │
                                        │                            + 2 mirror ZREMs            │
                          engine cancel arm :1614-1644                        │                   │
                            shield _expire_pending_ask_user           anchor clear (092-03)       │
                            ⚠ skipped on graceful shutdown            threads.active_wf=NULL      │
                            ✚ NEW: cancel the in-flight phase                 │                   │
                                        │                             ✚ NEW: finish_run(wf_id,   │
                                        ▼                                'cancelled')             │
                          _finalize_producer_run  →  F2 (:255-286)     ✚ NEW: terminalize the    │
                            finish_run(wf_run_id,'cancelled')             active phase row        │
                            ⚠ gated by is_app_shutting_down()              (no engine here)       │
                                        │                                     │                   │
                                        └──────────────┬──────────────────────┘                   │
                                                       ▼                                          │
                                    workflow_runs.status='cancelled'                              │
                                    threads.active_workflow_run_id = NULL   (ONE txn)             │
                                    workflow_phases: interrupted row = 'cancelled'  ◄─ MIG 119    │
                                    completed phases UNTOUCHED (D-07, inherited)                  │
                                                       │                                          │
                                                       ▼                                          │
                    RunCard "■ cancelled" (:534,:548) · panel spine · receipt                     │
                    ⚠ chat banner never advances (BUG-260815-04) — see §The banner mechanism      │
                         └──────────────────────────────────────────────────────────────────────┘
```

### The id-type landmine — **the single most important finding in this document**

`WorkflowLock.runId` is documented in `frontend/src/stores/streamsStore.ts:52-53` as:

> `/** The workflow_runs.id (active_workflow_run_id) that owns the lock. */`

**That doc is false at half its write sites.** Measured, all four:

| Write site | Value assigned | Actual id type |
|---|---|---|
| `StreamsProvider.tsx:1839` (mount reconcile) | `wf.active_workflow_run_id` | **`workflow_runs.id`** |
| `ChatArea.tsx:176` (banner path) | `state.active_workflow_run_id` | **`workflow_runs.id`** |
| `StreamsProvider.tsx:1983` (kickoff seed) | `run_id` from the kickoff POST body | **`runs.run_id`** (producer) |
| `StreamsProvider.tsx:3032` (Continue re-subscribe) | `producerRunId` | **`runs.run_id`** (producer) |
| `StreamsProvider.tsx:965` (`cap_paused` SSE) | `info.runId` | inherits whichever the SSE carries |

⚠ **This is not a new discovery by this research — it is a REDISCOVERY, and the project already wrote
it down once.** `WorkspacePanel.tsx:161-165` (the Phase 188 `RunSeam` docblock) says:

> *"The lock's id field is documented as the anchor but is **overwritten with a PRODUCER run id at
> kickoff** and again on a Continue re-subscribe (StreamsProvider) … **Both ids are bare uuids, so a
> swap typechecks and then resolves nothing.**"*

And `ChatLayout.launch.test.tsx:45` carries a comment reading *"`threads.active_workflow_run_id` — the
`workflow_runs` row. **The RIGHT one.**"* — a test written because someone already got this wrong.

**Why it is fatal for this phase specifically:** `cancelRun` (`api.ts:1265-1267`) treats **404 as
success**:

```ts
if (!res.ok && res.status !== 404) { throw new Error(...) }
```

That swallow is *deliberate and correct* for its original purpose (a run cancelled by another tab).
But combined with the id ambiguity it produces the exact failure SC#2 forbids: a user clicks Stop,
the request 404s because the id was a `workflow_runs.id`, the client reports nothing, and the run
keeps running. **A silent success is worse than a visible failure in a phase about honesty.**

### Pattern 1: The dual-id fallback — a shipped, twice-used, security-reviewed precedent

**What:** a `/runs/{id}` route whose Step-1 `runs` SELECT misses falls back to resolving the id as a
`workflow_runs.id`, **owner-scoped** and **thread-anchor-confirmed**, then synthesizes the Step-1 row.
404 (never 403) on any miss so existence is not leaked.

**Where it already ships — twice:**
- `POST /runs/{id}/continue` — `backend/app/api/runs.py:722-755` (Facet C, 092-07). Its comment names
  the exact cause: *"after a page reload `workflowLock.runId` carries the WORKFLOW_RUN id
  (StreamsProvider seeds it from `wf.active_workflow_run_id` on reconcile), which is NOT a `runs` row
  → the SELECT above 404s."*
- `POST /runs/{id}/ask_user_response` — `backend/app/api/runs.py:535-585` (F10, 093 / D-07 / D-08),
  which explicitly says it is *"the EXACT owner-scoped, anchor-confirmed pattern the Continue endpoint
  already uses."*

**`DELETE /runs/{run_id}` (`:1155`) is the third route on the same prefix and the only one WITHOUT it.**

**Example (the shipped shape, `runs.py:722-755` — copy this, do not invent):**
```python
# Source: backend/app/api/runs.py:722-755 (verified at HEAD 05f664a0)
if not row:
    wf_self_resp = await aexec(
        supabase.table("workflow_runs")
        .select("id, thread_id")
        .eq("id", str(run_id))
        .eq("user_id", current_user["id"])   # owner-scoped — no existence leak
        .maybe_single()
    )
    wf_self = wf_self_resp.data if wf_self_resp is not None else None
    if wf_self:
        anchor_resp = await aexec(
            supabase.table("threads")
            .select("active_workflow_run_id")
            .eq("id", wf_self["thread_id"])
            .eq("user_id", current_user["id"])   # thread-anchor confirm
            .maybe_single()
        )
        _anchor = (anchor_resp.data if anchor_resp is not None else None) or {}
        if str(_anchor.get("active_workflow_run_id")) == str(run_id):
            row = {"run_id": str(run_id), "status": None, "thread_id": wf_self["thread_id"]}
```

⚠ **BUT `cancel_run` cannot stop where `/continue` stops.** `_cancel_run_internals` keys `RUN_TASKS`
and `finalize_run_terminal` on the **producer** `runs.run_id`. Passing it a `workflow_runs.id` would:
`RUN_TASKS.get(wf_id)` → miss → Step 3b → `finalize_run_terminal` updates **zero** `runs` rows →
**the live producer task is never cancelled** while the API returns 204. That is the silent-success
failure again, moved server-side.

**So the fallback must resolve FORWARD to the producer id**, and the app already shows how — the
delete cascade's LEFT JOIN:

```sql
-- Source: backend/app/api/workflows.py:1486-1494 (verified at HEAD)
SELECT wr.id AS wf_id, wr.thread_id,
       r.run_id AS producer_id, r.status AS producer_status
FROM workflow_runs wr
JOIN workflow_definitions wd ON wd.id = wr.definition_id
LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming'
WHERE ... AND wr.status IN ('active', 'paused', 'cap_paused')
```

Its own comment states the rule verbatim: *"a live kickoff-started run's producer task is registered
in `RUN_TASKS` under the PRODUCER `runs.run_id` … NOT the `workflow_runs.id`."* And when
`producer_id is None` it skips `_cancel_run_internals` and calls `finish_run(wf_id, "cancelled")`
directly — **which is exactly D-09/D-10's fix, already written, in a different file.**

### Pattern 2: The additive-sibling panel mount (G-5-safe)

**What:** a new panel affordance is a sibling `PanelSection` under the existing harness gate that
reads no internals of `PhaseCard` / `PhaseTimeline` and adds a prop to neither.

**Why it satisfies D-01 without an extraction:** `WorkspacePanel.tsx` already calls
`useViewingThread()` (`:271`) for its thread id and already imports **eight** hooks from
`StreamsProvider` (`:34-43`) including `useWorkflowLockForThread`. Adding `useStreamActions` is a
ninth import from the same module. The gate already exists: `showTimeline = isHarness || phases.length > 0`
(`:292`). **No new fetch, no new prop, no new store slice, no new state.**

```tsx
// The G-5-safe shape. NOTE: stopThread(threadId), NEVER workflowLock.runId — see the id-type landmine.
const streamActions = useStreamActions()
// … inside the existing showTimeline gate, as a sibling of the PhaseTimeline PanelSection:
<button onClick={() => void streamActions.stopThread(threadId)} data-testid="panel-stop-run">…</button>
```

The precedent is written into the file itself (`WorkspacePanel.tsx:88-93`, the Phase 124 run-soul
section): *"An ADDITIVE SIBLING of the live PhaseTimeline (the G-5 red line): it … does not read
PhaseCard / PhaseTimeline internals or add a prop to either."* Phase 188's `RunSeam` (`:194-246`)
follows the identical shape.

### Pattern 3: The migration-115 CHECK-widening shape

```sql
-- Source: supabase/migrations/115_workflow_phases_recorded_not_sent.sql:110-122 (verified at HEAD)
BEGIN;

ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (
    status = ANY (ARRAY[
        'pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text,
        'recorded_not_sent'::text
    ])
);

COMMIT;
```

Its header names four rules 119 must copy, each for a stated reason:
1. **`BEGIN`/`COMMIT`** — WR-01 (2026-08-07). Without it, a dropped session between the two ALTERs
   leaves the table with **no CHECK at all** — fail-open, silently.
2. **`DROP CONSTRAINT IF EXISTS`** — makes a re-paste safe (house style: migs 048, 063).
3. **`= ANY (ARRAY[…])` with `::text` casts, NOT `IN (…)`** — matches the form `pg_dump` regenerates,
   so the `full-schema.sql` diff stays ~one line instead of a whole-constraint reformat.
4. **Re-add every shipped literal verbatim** — *"A re-typed `ARRAY[…]` is precisely where a shipped
   literal gets silently dropped, which would orphan every existing row using it."*

### Anti-Patterns to Avoid

- **Reading `workflowLock.runId` for a cancel.** Half the time it is the wrong id, `cancelRun`
  swallows the 404, and the Stop reports success while doing nothing. Use `stopThread(threadId)`.
- **A second cancel route.** D-08 forbids it and the two shipped fallbacks show the app's answer.
- **Editing the `"Starting workflow…"` string.** `toolMeta.ts:92`, byte-pinned by
  `frontend/src/lib/__tests__/toolMeta.test.ts:31`. A copy edit fixes nothing and breaks a pin.
- **Adding `is_app_shutting_down()` to the zombie arm.** See the proof below — it would be wrong here.
- **Deriving the interrupted-phase word instead of storing it.** Mig 115's own header rejects exactly
  this (*"the ROW would then read `completed` forever to anything querying the table directly"*).
- **Terminalizing phases in bulk.** D-07 is inherited verbatim: completed phases are already durable
  and are left untouched. Only the single `active` row moves.
- **Assuming the two stuck rows block deletion.** They do not — measured. See below.
- **Inventing a canvas/spine mark.** `icon-convention.md` §4: net-new marks must be FLAGGED as
  proposals; see §*Icon vocabulary conflict*.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Resolving a bare uuid to the right run | A client-side "is this a workflow id?" guess | The server-side owner-scoped + anchor-confirmed fallback | Both ids are bare uuids — a swap **typechecks** (`WorkspacePanel.tsx:164`). The client cannot know; the server can. Twice-shipped. |
| Terminalizing `workflow_runs` on cancel | A new `cancel_workflow_run()` writer | `finish_run(pool, wf_id, "cancelled")` | Already pairs the status write + anchor clear in ONE transaction, already idempotent, already called from a cancel context by `delete_workflow_cascade` |
| Cancelling a run with no live producer | A bespoke "force stop" path | `_cancel_run_internals` Step 3b | Already handles the SETNX sentinel lock, the synthetic terminal XADD, the EXPIRE bucket and the best-effort discipline (D-062-13) |
| Finding the in-flight phase | A fresh query | `get_active_phase(pool, run_id)` (`db/workflows.py:1088`) | Already RUN-KEYED on `workflow_run_id` — ⚠ a bare `wp.run_id` raises Postgres **42703**; that column does not exist |
| Waking a paused approval on cancel | New sentinel plumbing | `publish_cancel_sentinel` before `task.cancel()` (D-085-04) | Ordering is load-bearing: publish FIRST so `_handle_ask_user` returns a normal `ToolResult` before `CancelledError` propagates |
| Cross-thread Stop | New per-thread cancel plumbing | `stopThread(threadId)` | Ships, resolves the correct id, already used by `ActiveRunsTray` |
| Stopped-state vocabulary | A new status word map | `RunCard.statusGlyph` / `statusWord` (`:530-550`) | D-14 |

**Key insight:** every backend piece this phase needs already exists **and is already composed
correctly in one place** — `delete_workflow_cascade` (`api/workflows.py:1481-1512`). 194's backend work
is largely *moving a composition that already works into the shared writer where all three callers get
it*, not inventing one.

---

## Runtime State Inventory

194 is not a rename, but it **is** a phase whose correctness depends on live runtime state, so the
inventory is completed rather than skipped.

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | **2 `workflow_runs` rows stuck `active`** (full receipt below). **3 `workflow_phases` rows stuck `active`**, of which **only 1 belongs to a stuck run** — the other 2 sit under runs already `failed`. | D-12 heal (rows) + a decision on the 2 orphan phase rows (see below) |
| **Live service config** | None — no n8n/Datadog/Cloudflare surface touches run cancel | None — verified by absence of any such integration in `run_lifecycle.py` / `api/runs.py` |
| **OS-registered state** | None. `RUN_TASKS` is an **in-process dict**, not an OS registration; it dies with the worker (which is the whole G-B gap) | None |
| **Secrets/env vars** | `WORKER_COUNT` (default 2) is read, not written. No new var. | None — ⇒ `check-deploy-drift.sh` is unaffected |
| **Build artifacts** | None. No package, no sandbox image, no compiled asset. | None |
| **Schema (live DB)** | `workflow_phases_status_check` currently admits 6 literals; `workflow_runs_status_check` admits 6 including `cancelled` | Migration 119 (D-04/D-05), applied via SQL editor, then `regenerate-full-schema.sh` |

### The two stuck rows — the "before" receipt D-12 requires

Queried directly against the live local DB (`psycopg2`, `127.0.0.1:54322`), 2026-08-16:

| # | `workflow_runs.id` | `thread_id` | status | created_at | updated_at | `is_golden_run` | anchor points here? |
|---|---|---|---|---|---|---|---|
| 1 | `fde3bbe3-02c2-4664-902f-921411bb1fe7` | `4bf89cbc-5630-4fb3-982e-5fd179450003` | `active` | **2026-06-14 21:15:56Z** | 2026-07-18 20:43:42Z | `False` | ✅ **yes** |
| 2 | `4b0feda7-c524-4a18-8ea0-4c6fc9705868` | `e52a19f7-52cc-45ba-bedf-03247a8c4133` | `active` | **2026-08-01 17:04:34Z** | 2026-08-09 06:12:35Z | ⚠ **`True`** | ✅ **yes** |

Supporting context, all measured:

- **Definitions:** #1 → `pm-weekly-status-report` (*Weekly Status Report*, published, owner
  `d8a54002…`); #2 → `meridian-risk-summary-good-07aedc33` (*Project Meridian Risk Summary (GOOD)*,
  published, same owner). **Neither is `is_system_global`.**
- **Threads:** #1 → *"PM scoreboard openai/gpt-4o"*; #2 → *"[validation] publish golden run — Project
  Meridian Risk Summary (GOOD)"*.
- **⚠ #2 IS A GOLDEN RUN — a publish-validation artifact, not a user run.** Per Phase 190 (A4),
  `find_resumable_runs` now excludes `is_golden_run = true` outright (*"a golden run is not a thing to
  resume"*), so nothing will ever pick it up again.
- **#1's producer `runs` row is ALREADY `cancelled`** — `652ec9bb-f8f8-4937-8a61-655959e25749`,
  `status='cancelled'`, completed 84 ms after it started on 2026-06-14. ⇒ **This row is the historical
  proof of the G-B gap in its purest form: the `runs` half was cancelled and the `workflow_runs` half
  was never told.**
- **#2's thread carries five `runs` rows, all `failed` with `error='resume re-drive failed'`**
  (2026-08-08/09) — the boot sweep re-drove it five times and failed, then Phase 190's A4 gate landed
  and it was abandoned. A precise, dated story.
- **Zero `runs` rows are currently `streaming`** across the whole DB. Run histogram: `completed` 1001,
  `failed` 136, `cancelled` 28, `timed_out` 1.
- `workflow_runs` histogram: `completed` 179, `failed` 31, **`active` 2**.

### The 2 orphan `active` phase rows — a finding CONTEXT does not mention

| phase id | run | run status | slug | index | updated_at |
|---|---|---|---|---|---|
| `961c290d-8ec7-46c2-b6d9-58923f8612cc` | `5aa42b6b-2bc0-43b3-8044-bc2d25ff7355` | **`failed`** | `confirm` | 1 | 2026-07-18 20:43:42Z |
| `9e6acf54-8c10-46d8-8351-5d31dc3946af` | `e0d1f740-31ef-400c-b0e7-625aac8ab62f` | **`failed`** | `confirm` | 1 | 2026-07-18 20:43:42Z |
| `0e0cf57c-b2ba-4b49-8b05-1448a2531aad` | `4b0feda7…` (stuck #2) | `active` | `summarize` | 1 | 2026-08-01 17:06:14Z |

**Two phase rows read `active` under runs that are terminally `failed`.** That is SC#3's failure mode
already present in the data: *a partial write presented as still running*. Both are `confirm` phases
(interactive), both stamped at the same instant — consistent with a single historical event.

**Recommendation for the planner:** treat these as a **third D-12 item, or explicitly out of scope
with a stated reason.** They are not covered by D-12 as written (which names only the two run rows),
and a phase that ships "no partial write is presented as finished" while leaving two of them in the
database should say so on purpose rather than by omission.

### Recommendation on HOW to heal (D-12's open question)

**Heal by running the new path against them**, not by a one-off `UPDATE`. Reasons, in order:

1. **It is the only version that is verifiable.** A one-off `UPDATE` proves the rows changed; running
   the path proves *the thing this phase built* changes them. The receipt then evidences SC#2 rather
   than merely evidencing an operator's SQL.
2. **The path is directly reachable for both rows.** Both threads still hold the anchor, so the new
   `DELETE /runs/{id}` fallback resolves each `workflow_runs.id` → owner-scoped → anchor-confirmed →
   no live `runs` row (`producer_id IS NULL`, measured: 0 streaming) → **Step 3b zombie arm** → the
   new `finish_run` co-write + phase terminalize. That is the exact arm D-09 adds, exercised on real
   data.
3. **⚠ One caveat that must be stated, not discovered:** row #2 is a **golden run**. Cancelling it is
   honest (it is abandoned and unresumable), but the plan should say so explicitly, because a future
   reader finding a `cancelled` golden run needs to know it was healed rather than user-stopped.
   Consider a distinguishing `error`/audit note — but **not** a new status literal.
4. **The heal MUST be a `checkpoint:human-verify` task** and must capture before/after for both rows.
   Per CLAUDE.md parallel-execution rule 4, its plan is **serialized**.

---

## The three gaps, re-measured

### G-B: the zombie arm — what is actually missing

`_cancel_run_internals` Step 3b (`run_lifecycle.py:225-291`) does **four** things today:

1. `finalize_run_terminal(...)` → `runs.status='cancelled'` + both mirror ZREMs, atomically (`:236-252`)
2. ⚠ **`UPDATE threads SET active_workflow_run_id = NULL WHERE id = thread_id`** — Phase 092
   (092-03 / SC#2, MODE-02), best-effort via `aexec` (`:256-268`)
3. SETNX-gated synthetic terminal sentinel + `_emit_terminal(..., reason="zombie_healed")` (`:260-282`)
4. `EXPIRE run:{id} 60` (`:284-288`)

**⇒ D-09's claim that "the anchor is never cleared" is FALSE. Step 2 above clears it, and has since
Phase 092.** The *only* thing missing is `workflow_runs.status`.

This is not a small correction — it **changes the argument**, and D-10's argument has to be rebuilt on
the true fact:

- **The wedge D-09 describes does not exist as described.** The thread is not "permanently harness-
  locked" after a zombie heal; the anchor is cleared, so the composer unlocks.
- **What actually persists is worse in a different way:** `workflow_runs.status='active'` **forever,
  with no anchor pointing at it.** It is invisible to `find_resumable_runs` (which requires
  `t.active_workflow_run_id = wr.id`), so no sweep will ever touch it, and it renders as a live run to
  anything that reads run status without joining the anchor. **An orphaned lie, not a lock.**
- Both stuck rows measured above still *have* their anchors — consistent with their never having gone
  through Step 3b at all (row #1's producer went terminal in-process; row #2 died to restarts).

**The correct D-10 shape, given `finish_run` already clears the anchor in its own transaction:**

```
# Step 3b, after finalize_run_terminal and BEFORE the existing anchor-clear:
wf_id = read threads.active_workflow_run_id for thread_id     # must read BEFORE any clear
if wf_id:
    await finish_run(pool, UUID(wf_id), "cancelled")          # status + anchor clear, ONE txn
    await <terminalize the run's active workflow_phases row>  # D-07, mig 119
# the shipped best-effort anchor-clear stays as the belt-and-braces arm for the wf_id-is-None case
```

Three properties the planner must preserve:

| Property | Why |
|---|---|
| **Read the anchor BEFORE the existing clear** | `finish_run` keys its anchor clear on `active_workflow_run_id = $1`; if the standalone clear ran first, `wf_id` is gone and the run row is unreachable |
| **Keep the standalone anchor clear** | It covers the case where the anchor is set but the `workflow_runs` read fails, and it is the Deep-run path's no-op. Deleting it would be a behaviour change on the Deep path — forbidden by the deferred list |
| **Keep it best-effort (its own `try/except`)** | D-062-13: *"Postgres `runs.status` is the durable cancel record"*; a Redis or workflow-side failure must not fail the cancel |

**Is `finish_run` safely callable from `_cancel_run_internals`?** Yes, verified on five axes:
- **Async:** `async def finish_run(pool: asyncpg.Pool, run_id: UUID, status: str) -> None` — natively
  async, no `run_in_threadpool` needed.
- **Pool:** Step 3b already does `from app.dependencies import get_pg_pool; pool = await get_pg_pool()`
  (`:237-238`). The pool is in hand.
- **Transaction nesting:** `finish_run` opens its own `pool.acquire()` → `con.transaction()`.
  `_cancel_run_internals` holds no outer transaction. No nesting.
- **Import cycle:** the file already late-imports from `app.api.threads`, `app.dependencies` and
  `app.services.ask_user_service`. Late-import `finish_run` the same way — and note
  `delete_workflow_cascade` already imports it at module top-level from `api/workflows.py`.
- **Idempotence:** `UPDATE workflow_runs SET status=$2 WHERE id=$1` on an already-`cancelled` row is a
  no-op write; the anchor clear finds 0 rows (its own docstring says so). **Safe on a double call.**

**Does the happy path double-call `finish_run`?** Only across arms, never within one:
- Step 3a (`task_cancelled`) returns immediately after `task.cancel()` — it never reaches 3b.
- The producer's F2 then calls `finish_run` once.
- The delete cascade may call `_cancel_run_internals` **and** `finish_run` for the same run (it already
  does, today, `api/workflows.py:1497-1512`) — and that has shipped since Phase 152 without incident,
  which is direct evidence the double call is benign.
- ⚠ **A genuine race exists and should be named rather than guarded:** a Stop landing on worker A
  (Step 3b → `finish_run`) while worker B's producer is mid-F2 could interleave two identical
  `UPDATE … SET status='cancelled'` writes. Both write the same value; row-level locking serializes
  them; the anchor clear is idempotent. **Benign by value-identity, not by exclusion.** The one thing
  a plan must not do is make the two writes disagree (e.g. one writing `'failed'`).

### Does the zombie co-write need the `is_app_shutting_down()` gate? **No — definitively.**

CONTEXT warns that *"any new terminalize must carry the same gate or it will break restart-
resumability."* Measured, three independent reasons say the gate would be **wrong** here:

1. **Step 3b is only reachable on explicit cancel intent.** Its two callers are `DELETE /runs/{id}`
   (the owner's Stop) and `POST /admin/runs/{id}/kill` (the operator's). Neither fires during a
   shutdown. F2's gate exists because F2 runs on **any** producer exit, shutdown-induced included.
2. **A shutdown-affected run cannot reach Step 3b.** On graceful shutdown the producer's
   `_finalize_producer_run` still writes `runs.status='cancelled'` (only the *workflow* half is
   gated). A subsequent `DELETE` therefore hits **Step 2, `terminal_noop`** — no writes at all.
3. **Resumability is already forfeit at Step 3b.** The shipped 092-03 anchor clear runs there
   unconditionally, and `find_resumable_runs` requires `t.active_workflow_run_id = wr.id`
   (`db/workflows.py:1063-1067`). Once the anchor is cleared the run is unsweepable regardless of its
   status. **Adding the status write cannot remove resumability that is already gone — it only stops
   the row from lying about itself.**

⇒ **Do not add the gate to Step 3b.** ⚠ **Do not remove it from F2 either** (Phase 096 UAT Test 2). A
plan that touches `run_producer.py:255-260` is out of scope.

### G-C: the interrupted phase row — where the terminalize belongs

Three candidate homes were weighed against four criteria:

| Home | Sees the phase id? | Runs on happy cancel? | Runs on zombie heal? | Durable-write ordering |
|---|---|---|---|---|
| **A. Engine `CancelledError` arm** (`harness_engine.py:1614-1644`) | ✅ **yes** — `phase_id = row["id"]` is bound at `:1572`, inside the same `while` iteration, before the `try` at `:1596`, so it is in scope in the `except` | ✅ yes | ❌ **no — there is no engine on the zombie path at all** | ✅ inside the shielded cleanup, before the re-raise |
| **B. Inside `finish_run`'s transaction** | ⚠ would have to query for it | ✅ (via F2) | ✅ (via the new co-write) | ✅ same txn as the status write |
| **C. The producer's F2 block** | ❌ no | ✅ yes | ❌ no | ✅ |

**Recommendation: A *and* B, and the reason is structural, not belt-and-braces.**

- **A is the only home that knows *which* phase without a query**, and it is the only home that can
  distinguish "the phase the user interrupted" from "some phase row that happens to be `active`."
- **B is the only home the zombie path reaches**, because the zombie path has no engine, no loop and
  no `phase_id`. There, the row must be found: `UPDATE workflow_phases SET status='cancelled',
  updated_at=now() WHERE workflow_run_id=$1 AND status='active'` — the `get_active_phase` predicate,
  applied as a write.
- ⚠ **Do NOT put B literally inside `finish_run`.** `finish_run` is called on the `completed` path
  too (`harness_engine.py` success arm) and by the delete cascade; adding a phase write there changes
  behaviour on paths this phase must not touch. Put it in a **new sibling writer in `db/workflows.py`**
  called from the two cancel sites, or extend it behind an explicit `status == "cancelled"` guard and
  say why.

**Is there exactly one `active` phase row per run?** **Typical, not guaranteed.** Measured: 3 runs
have exactly 1 each, 0 runs have more. `get_active_phase` itself hedges with `ORDER BY phase_index
LIMIT 1`, and the engine's structure (one `mark_phase_active` per loop iteration, `:1578`) makes >1
unreachable in normal operation. ⇒ **Write the UPDATE as a set-predicate** (`WHERE workflow_run_id=$1
AND status='active'`), not as a single-row update by id fetched first — it is correct for 0, 1 or N
and needs no read.

The query for identification:
```sql
-- Source: adapted from db/workflows.py:1096-1104 (get_active_phase), verified at HEAD
SELECT id, slug, phase_index FROM workflow_phases
WHERE workflow_run_id = $1 AND status = 'active' ORDER BY phase_index
```

### Migration 119 — the confirmed facts

- **Current CHECK, read from the live DB via `pg_constraint`** (not from a file):
  `CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'recorded_not_sent'::text])))`
  — **6 literals**, byte-identical to `supabase/full-schema.sql:1975`. ✅ D-04 confirmed.
- **`grep -rln workflow_phases_status_check supabase/migrations/`** returns **only** `115_*.sql`.
  ✅ No later migration altered it.
- **`ls supabase/migrations/ | wc -l` → 112**; highest number **118** (`118_connector_secret_column_privilege.sql`).
  ✅ D-05's `119_*.sql` confirmed.
- **`workflow_runs_status_check`** already admits `cancelled` (mig 057:19, re-asserted mig 063:55-57;
  live: `active, paused, cap_paused, completed, failed, cancelled`). ✅ No migration owed on that side.
- **⚠ Mig 115's header contains a STALE pointer, and 119 must not copy it.** It says the phase-status
  literals live *"inside the four UPDATEs in `backend/app/db/workflows.py` (lines 965, 979, 1001, 1013)"*.
  Measured at HEAD those lines are inside `count_foreign_runs_on_global` / `load_run_phases`. The
  **actual** writers are `mark_phase_active` `:1208`, `complete_phase` `:1222`, `fail_phase` `:1244`,
  `skip_phase` `:1256`, `record_phase_not_sent` `:1287`. 119 adds a **sixth** writer.
- **The test template is `backend/tests/test_migration_115.py`** (168+ lines): a live-DB gate against
  `POSTGRES_DSN` (default `:54322`), **all writes inside a transaction that ROLLS BACK**, the rejection
  branch in a nested savepoint, the FK chain seeded inside the same rolled-back transaction, and **two
  clean skips only** — `:54322` unreachable, or the migration unapplied. **It green-skips until applied
  and MUST pass afterwards.**

---

## Answers to the frontend questions

### A. G-5 re-verification (D-01) — re-derived, not inherited

**`frontend/src/components/chat/RunCard.tsx`**
```
git log --oneline -- frontend/src/components/chat/RunCard.tsx | wc -l          → 20
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u
                                                                               → 9 buckets
wc -l frontend/src/components/chat/RunCard.tsx                                 → 550
```
Buckets: `075.7 075.8 076.1 076.2 095 095.1 128 155 streaming`.
⚠ **`streaming` is NOT a phase** — it comes from `fix(streaming): close silence gaps…` (`0dce56aa`)
and its revert (`61e5eb1e`), a 075.x follow-up pair committed without a phase tag. Counted OUT, the
same way `WorkflowBuilderPage.tsx`'s row already documents about `260809`/`260814`.
⇒ **`20 commits / 8 phases / 550 L`.** CONTEXT said *"20 commits / ~9 buckets"* — the commit count is
exact and the bucket count is exact; the **phase** count is 8.

**`frontend/src/components/panel/WorkspacePanel.tsx`**
```
git log --oneline -- frontend/src/components/panel/WorkspacePanel.tsx | wc -l  → 13
<the same sed recipe>                                                          → 8 buckets
wc -l frontend/src/components/panel/WorkspacePanel.tsx                         → 493
```
Buckets: `087 088 094 095.1 100 124 155 188`. **Zero quick-task buckets** — all eight are real phases.
⇒ **`13 commits / 8 phases / 493 L`.** Matches CONTEXT exactly.

**⚠ Both files are MORE invisible than D-01 states.** D-01 says *"both names occur only inside other
rows' prose."* Measured:
```
grep -o "RunCard.tsx" CLAUDE.md | wc -l        → 0
grep -o "WorkspacePanel.tsx" CLAUDE.md | wc -l → 0
```
**Neither filename appears in `CLAUDE.md` at all.** (`RunCard` bare appears once and *workspace panel*
twice — all three in the project-skills paragraph, none in the ledger.) The conclusion is unchanged
and strengthened.

**Does the Stop require NEW STATE OWNERSHIP? — the question D-01 makes blocking.**

| File | Verdict | Evidence |
|---|---|---|
| `WorkspacePanel.tsx` | ✅ **No new state ownership — IF and ONLY IF the mount calls `stopThread(threadId)`** | It already calls `useViewingThread()` (`:271`) and already imports 8 hooks from `StreamsProvider` (`:34-43`). Adding `useStreamActions` is a 9th import from the same module. The harness gate already exists (`showTimeline`, `:292`). **No new fetch, no new prop, no new store slice.** |
| `WorkspacePanel.tsx` | ⛔ **New state ownership IF the mount needs a producer run id of its own** | The panel's only run id today is `RunSeam`'s local `useState<string \| null>` fed from `getThreadWorkflow` — and that is the **`workflow_runs.id`** (`:219`), the wrong type for `cancelRun`. Acquiring a producer id would be a new fetch + new state ⇒ a SECOND concern ⇒ **the refactor recommendation is owed FIRST.** |
| `RunCard.tsx` | ✅ **No new state ownership** | It renders `cancelled` from the already-persisted `message.runStatus` (`:530-550`). Extending the vocabulary reads existing state. |

⇒ **G-5 is honourable by construction, but it is CONDITIONAL on the mount design.** The planner must
choose `stopThread(threadId)`. If a plan proposes plumbing a producer run id into `WorkspacePanel`,
D-01 fires and a refactor recommendation precedes the feature.

**Draft ledger-row content (D-02):** see §*Deliverable: the two CLAUDE.md ledger rows* below.

### B. The composer Stop during a harness run (D-08 mount 2) — MEASURED

**Does an assistant message with `runStatus === "streaming"` exist during a harness run?** **Yes —
and the stuck banner is itself the proof.**

The trace, all four hops verified at HEAD:
1. `sendMessage` inserts an optimistic assistant placeholder with `runStatus: "streaming"` and **no
   `runId`** (`StreamsProvider.tsx:1926-1936`), and adds the thread to `streamingThreads` (`:1942-1944`).
2. When the kickoff POST resolves, that placeholder is stamped `runId: run_id` — **the producer
   `runs.run_id` from the kickoff body** (`:2027-2031`). ✅ correct type.
3. `MessageItem` renders the banner in the branch `isStreaming && !hasAnyTools` (`:635`).
   **That branch requires the very message `stopThread` scans for.** So if the banner is on screen,
   the scan's target is on screen.
4. On reload/reattach, the placeholder is re-minted **with** `runId: run.run_id` from the active-runs
   reconcile (`:1621-1632`) — also the producer id.

⇒ **`stopThread` / `stopStream` are NOT defeated by BUG-260815-04.** The composer Stop renders
(`disabled={isStreaming}` at `ChatArea.tsx:363` → `MessageInput.tsx:410-419`) and fires. **Mount 2 is a
VERIFY-and-pin task, not a fix task** — CONTEXT's stated fear is not borne out.

⚠ **One real, narrow gap remains** — between hop 1 and hop 2 the message has `runStatus: "streaming"`
and **no `runId`**, and both resolvers do `if (!runId) return` (`:2386`, `:2409`). **A Stop in that
window is a silent no-op.** It is short (one kickoff RTT) but it is exactly the "silent success" class
this phase must not ship. Recommend: make the no-op observable (a console/telemetry line at minimum,
or disable the control until the id lands) rather than leaving `return`.

**The BUG-260815-04 banner mechanism — named, as required, not the wording**

`outerBannerLabel` returns the pinned string when `!hasAnyTools && !isPlanning` (`toolMeta.ts:87-91`).
`MessageItem.tsx:329`: `const hasAnyTools = (message.tool_calls?.length ?? 0) > 0`.

> **A harness run writes NO `tool_calls` onto the assistant message.** Its progress lives in
> `workflow_phases` rows and in `phase_started` / `phase_completed` SSE events. So `hasAnyTools` is
> `false` for the entire run, `isPlanning` is false, and the branch at `MessageItem.tsx:635` holds from
> kickoff to terminal. **The banner is structurally incapable of advancing.** It is not a
> subscription gap, not a propagation gap, and not a copy bug.

**The advancing mechanism — and it needs no backend change and no new subscription:**

The phase data is **already in the client store and already in the same component.**
`StreamsProvider`'s harness phase demux (`:971-1100`, Phase 094 PANEL-08/09) writes
`phasesByThread` and `workflowLockByThread` on every `phase_started` / `phase_completed`. The demux is
labelled **"ADDITIVE + PANEL-ONLY … never `bucketsBySurface`"** — deliberately, so panel events cost
zero chat re-renders (PANEL-09). `MessageItem` **already calls** `useWorkflowLockForThread(message.thread_id)`
at `:303` and **already passes `workflowLock != null`** into `outerBannerLabel` at `:644`. It passes the
*existence* of the lock and not the *progress*.

⇒ The fix is to give the harness branch a progress input — the current phase index / total / slug the
panel already renders — so the banner can say something true after phase 1. ⚠ **This deliberately
crosses the PANEL-09 boundary**, which was a considered performance decision, so a plan must state the
re-render cost it is accepting (the lock/phase slices are reassigned on phase transitions, not on
tokens — so the cost is per-phase, not per-token). **And the pinned `"Starting workflow…"` string must
survive as the pre-phase-1 value**, or `toolMeta.test.ts:31` reds correctly.

**The duplicate assistant icon — prior art checked, and it is NOT the one the report names**

The report points at `toolcallpanel-dedup-duplicates-tool-card.md` (`BUG-260521-01`). Read: that is a
**transient (~10-15 s) duplicate TOOL CARD**, minor, folded into 075.2 — different symptom, different
surface, different lifetime. **Not the same bug.**

The real prior art is two hops away and is much closer:
- `dedupMessages.ts:20-26`: *"everything else (user rows, **assistant rows without a runId such as
  harness answers**) passes through untouched."* ⇒ **harness assistant messages are structurally
  EXEMPT from the runId dedup.**
- `StreamsProvider.tsx:2490-2500` (BUG-260609-03): *"the harness producer-shell leaves
  `runs.message_id` NULL (`harness_engine.py:353-357`) so the fetched answer comes back with
  `runId=undefined`, `dbRunIds` never holds the run_id, and the cached temp + the DB copy both
  rendered (double answer on reload, persisted)."*
- `dedupMessages.ts:31-45` (Phase 174-04 / BUG-260610-01): the narrow collapse for two *empty,
  runId-less, `temp-`* assistant placeholders — *"the mount / first-SSE race can leave TWO of these for
  the SAME send in the bucket at once → **two avatars**."*

⇒ **HYPOTHESIS (MEDIUM confidence, not driven): the duplicate icon and the stuck banner share a root
— `runs.message_id` is NULL for harness, so the chat surface has no runId-keyed identity for a harness
run's assistant row, and both the dedup and the progress derivation lose their key.** This contradicts
the report's *"probably two causes"* framing and CONTEXT's *"probably-different cause."*
**The cheapest disproof:** during a live harness run, dump the chat bucket and count assistant rows —
if two `temp-` rows exist with `runStatus:"streaming"`, it is the 174-04 race; if one `temp-` and one
persisted row exist, it is BUG-260609-03's class. **Measure before planning a fix.**

### F. Mount-by-mount verdict

| # | Mount | Verdict | Measured basis |
|---|---|---|---|
| 1 | `WorkspacePanel` spine | ✅ **WIRING task** — one `useStreamActions` import + one sibling control inside `showTimeline`, calling `stopThread(threadId)` | `:271` `useViewingThread()`, `:34-43` eight existing provider hooks, `:292` the gate, `:88-93` the additive-sibling precedent. ⛔ **Becomes a state-plumbing task, and fires G-5, if it uses a run id of its own** |
| 2 | composer-stop | ✅ **VERIFY + pin task** — already renders and already resolves the right id | §B above. ⚠ Close the pre-stamp silent-no-op window |
| 3 | `ActiveRunsTray` | ✅ **Already ships** — `stopThread(id)` per row (`:126-133`) + Stop-all. Nothing to build; add a pin that a harness thread appears in `useStreamingThreadIds()` | `ActiveRunsTray.tsx:114-136` |
| 4 | Workflows-page library row | ⛔ **NOT a wiring task — the premise is false** | See below |

**Mount 4 in detail.** `LibraryRow` (`components/workflows/library/libraryRow.ts`) carries
`id / slug / provenance / …` and **no run field of any kind**. The three feeds
(`/workflows/published`, `/workflows/starters`, `/workflows/drafts`) are **definition** feeds. `grep`
for `runId|run_id|running|activeRun` across the whole `library/` directory returns **one** hit, and it
is prose inside a docblock. ⇒ *"using a run id the library already has"* is false: **there is no such
id, on the row or on the wire.**

Delivering mount 4 requires a **new backend read** (live runs by definition/slug for the caller) plus a
new field on `LibraryRow` plus a poll or subscription — i.e. a genuinely second concern on
`WorkflowsPage.tsx`, whose ledger row already carries a standing G-5 obligation
(*"the next phase that adds a genuinely SECOND concern here owes a refactor recommendation FIRST"*,
inheriting `34 / 12 / 1176`).

**Recommendation:** **descope mount 4 with a written trigger** (e.g. *"the first phase that puts any
live-run state on the library row"*), or plan it as its own wave that opens with the G-5 refactor
recommendation `WorkflowsPage.tsx`'s ledger row requires. **Do not plan it as a wiring task.**
Mitigating fact: with mounts 1-3 shipped, a running workflow is stoppable from its thread, from the
panel, and from the cross-thread tray **without navigating in** — mount 3 already delivers the
"stoppable from outside its thread" property mount 4 was reached for.

---

## Icon vocabulary conflict — three marks for one concept

`icon-convention.md`'s single rule is *"an icon for the same concept is byte-identical everywhere."*
Measured, the Stop/cancelled concept currently renders **three different marks**:

| Mark | Where | Status |
|---|---|---|
| `■` | `RunCard.statusGlyph` (`:534`) — the cancelled **state** | shipped, D-14 |
| lucide `<Square className="fill-current" />` | `MessageInput.tsx:420` (`composer-stop`), `ActiveRunsTray.tsx:132` — the Stop **control** | shipped |
| `⏹` | the validated sketch design (`workflow-run-surface.md:25`, `:135`, `:227`) | designed, not built |

⚠ **`■` and `⏹` are BOTH absent from the `icon-convention.md` §4 canvas glyph table.** §4's rule is
explicit: *"Net-new marks must be FLAGGED as proposals … `✦` additionally sits on the verdict mark's
coordinates, so it owes a placement before it could ship."* So **any spine/canvas stopped mark in 194
is a net-new canvas mark and owes a flagged proposal**, not a silent pick. The `PhaseNodeCard`
docblock's rule also applies to any word-badge: *the WORD carries the meaning; tone is decoration* —
so a `stopped` word-badge on the spine should carry no glyph at all.

⚠ **And the shipped design's cancel COPY contradicts D-13.** `workflow-run-surface.md:25` specifies:

> `⏹ Run cancelled — no deliverable produced · partial work discarded`

D-13 says a stopped run **keeps its completed phases** and explicitly rejects *"collapsing to a bare
`cancelled` that hides partial work … it discards evidence the database still holds."* **"partial work
discarded" is exactly the sentence D-13 forbids.** The planner must amend the sketch's copy under D-14
("may extend; may not replace without stating why") and record the amendment beside the original —
this project's standing habit — rather than quietly diverging from an operator-approved sketch.

**One design fact worth not re-litigating:** sketch 022-A's operator-decided winner is
**"A · Locked-in-thread ★"**, in which *"the composer locks to a status `.runchip` … + `⏹ Cancel`"*.
So the **composer Stop is the design-sanctioned primary**, while D-08 names the **panel** primary.
Both can ship (D-08 is four mounts, one mechanism), but a plan should note the divergence rather than
present the panel as the sketch's choice.

---

## Common Pitfalls

### Pitfall 1: The silent-success Stop
**What goes wrong:** the user clicks Stop, the run keeps running, and nothing anywhere says so.
**Why it happens:** `workflowLock.runId` may be a `workflow_runs.id`; `DELETE /runs/{id}` 404s;
`cancelRun` swallows 404 (`api.ts:1265-1267`); `stopThread`/`stopStream` `return` silently when
`runId` is falsy (`:2386`, `:2409`).
**How to avoid:** resolve via `stopThread(threadId)`; add the server-side dual-id fallback; make the
falsy-`runId` early-return observable.
**Warning signs:** a Stop that produces no network request; a 404 in the network tab with a calm UI.

### Pitfall 2: Cancelling through the wrong id server-side
**What goes wrong:** the API returns 204 and the producer task keeps running.
**Why:** `RUN_TASKS` is keyed by the producer `runs.run_id`; a `workflow_runs.id` misses, falls to
Step 3b, and `finalize_run_terminal` updates zero rows.
**How to avoid:** the fallback must resolve **forward** to the thread's live `runs` row before calling
`_cancel_run_internals` — the `LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status='streaming'`
shape at `api/workflows.py:1486-1494`.
**Warning signs:** 204 with `workflow_phases` rows still advancing.

### Pitfall 3: Breaking restart-resumability
**What goes wrong:** an app restart terminalizes runs the boot sweep should have resumed.
**Why:** removing or duplicating the `is_app_shutting_down()` gate (096-09, UAT Test 2).
**How to avoid:** do not touch `run_producer.py:255-260` or `harness_engine.py:1630`. Do **not** add
the gate to Step 3b (proof above).
**Warning signs:** `find_resumable_runs` returning 0 after a restart with in-flight work.

### Pitfall 4: The re-typed `ARRAY[…]`
**What goes wrong:** a shipped literal is dropped and every existing row using it is orphaned.
**Why:** the CHECK is re-typed by hand.
**How to avoid:** copy mig 115's block, add one element, and pin **all seven** plus a negative control
asserting SQLSTATE `23514` naming the constraint.
**Warning signs:** the negative control passing while a positive one is absent.

### Pitfall 5: A fence that cannot fire
**What goes wrong:** a green test defends nothing.
**Why:** this project has shipped inert fences five times in Phase 193.2 alone, three in 192.1, four in
193.1, five in 190 — **every one caught by planting, none by reading.** The sharpest instance:
`test_grounding_bundle_has_no_template_read_axis` **passed** under a planted `degraded.add("template")`
because it asserts the absence of *fields* and a set member adds no field.
**How to avoid:** every fence in §*Validation Architecture* names the plant it must be driven RED
against, **before** the change lands.
**Warning signs:** a fence whose scope is a module that no longer contains the thing it sweeps.

### Pitfall 6: Rewording the pinned banner
**What goes wrong:** the pin reds, the review calls it a regression, and the user's experience is
unchanged.
**How to avoid:** D-13/D-15 state this three times on purpose. Change what **advances** the surface.

### Pitfall 7: Assuming the stuck rows block deletion
**What goes wrong:** the plan claims a fix it did not make, and the review catches a false receipt.
**Why:** `BUG-260815-07` asserts *"a run that cannot be cancelled cleanly stalls the cascade"* —
measured false (below).
**How to avoid:** justify D-12 on the honest grounds (two rows lie about being live; two threads still
hold anchors; one is an abandoned golden run), never on the delete claim.

### Pitfall 8: Touching the Deep cancel path
**What goes wrong:** a regression that is not a deliverable.
**How to avoid:** every new branch must be entered **only** when a workflow anchor exists. The F2 block
is the shape to copy: *"Deep runs / continuations (`active_workflow_run_id is None`) skip this entirely
(byte-identical)."* Pin the Deep path byte-identical.

### Pitfall 9: Breaking the ask_user cancel ordering
**What goes wrong:** a paused approval strands as a submittable-but-dead card.
**Why:** D-085-04 requires `publish_cancel_sentinel` **before** `task.cancel()` (`:210-222`), and the
engine shields `_expire_pending_ask_user` on the way out (`:1630-1642`).
**How to avoid:** insert new work **after** Step 3a's return or **inside** Step 3b — never between the
sentinel publish and `task.cancel()`.

### Pitfall 10: The `finish_run` docstring
**What goes wrong:** a reader trusts *"Terminal run status write (`completed` / `failed`)"* and
concludes `cancelled` is unsupported.
**Reality:** the F2 caller has passed `"cancelled"` since v2.8 and the CHECK has admitted it since mig 057.
**How to avoid:** correct it **beside, not over** (CONTEXT's explicit instruction and this project's habit).

---

## Deliverable: the two `CLAUDE.md` ledger rows (D-02)

Draft **content**, measured at HEAD `05f664a0`. The planner should place these as full rows in the
hot-file ledger table using the `db/workflows.py` / `publish_service.py` shape.

### Row: `frontend/src/components/chat/RunCard.tsx`

**Touch-list cell.** `075.7 / 075.8 / 076.1 / 076.2 / 095 / 095.1 / 128 / 155`, **plus the untagged
`fix(streaming)` + `revert(streaming)` pair** (`0dce56aa`, `61e5eb1e` — a 075.x follow-up committed
without a phase tag) — **20 commits across 8 phases**, **550 lines**.
⚠ **ADDED by Phase 194, and the reason is the whole point of the row: THIS FILE WAS ABSENT FROM THIS
TABLE UNTIL PHASE 194. Eight phases touched it and G-5 never fired once, because the discuss-phase
audit scans PLAN.md `files_modified` *against this table* — a hot file missing from the table is
permanently invisible to its own guardrail.** That is the identical failure `WorkflowsPage.tsx`
suffered for ten phases, `WorkflowDoorSwitch.tsx` for six, `WorkflowBuilderPage.tsx` for ten and
`db/workflows.py` for seventeen. **That sentence is the reason this row exists and must survive future
edits.**
⚠ **The phase count is 8, not the 9 the raw recipe returns**, and the ninth bucket is `streaming`,
which is not a phase — counted OUT exactly as the `WorkflowBuilderPage.tsx` row documents about
`260809`/`260814`. ⚠ **A correction on measurement against Phase 194's own CONTEXT:** D-01 says the
filename *"occurs only inside other rows' prose"*; measured, `grep -o "RunCard.tsx" CLAUDE.md | wc -l`
returns **0** — it occurs **nowhere**. Re-derive with: `git log --oneline -- <file> | wc -l` → 20;
the standard `sed` recipe → nine buckets of which `streaming` is not a phase; `wc -l` → 550.

**Verdict cell.** **G-5 FIRES ON THE COUNT (8 phases against a threshold of 3) — honoured BY
CONSTRUCTION, no override.** The measured reason: 194 adds no state to this file. Its `cancelled`
vocabulary already ships — `statusGlyph` maps `cancelled → "■"` (`:534`) and `statusWord` maps
`cancelled → "cancelled"` (`:548`) — both read from the already-persisted `message.runStatus`, so a
vocabulary extension reads existing state and introduces no fetch, prop or store slice. **The
invariants that bind this file:** the `cancelled` glyph/word pair is the SHIPPED starting point and may
be extended but not replaced without a stated reason (D-14); ⚠ **`■` is NOT in the
`icon-convention.md` §4 canvas glyph table and neither is the sketch's `⏹`** — a spine mark is
net-new and owes a flagged proposal, and a word-badge carries no glyph at all; the terminal-state
tiering is Phase 174's and is not re-litigated here. **Per G-5 the next phase adding a genuinely second
concern owes a refactor recommendation FIRST; the natural seam is the run-identity header versus the
status/terminal vocabulary versus the elapsed-timer machinery. It inherits `20 / 8 / 550`.**

### Row: `frontend/src/components/panel/WorkspacePanel.tsx`

**Touch-list cell.** `087 / 088 / 094 / 095.1 / 100 / 124 / 155 / 188` — **13 commits across 8
phases**, **493 lines**. **ZERO quick-task buckets** — the recipe returns exactly eight and all eight
are real phases.
⚠ **ADDED by Phase 194. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194.** Eight phases touched
it and G-5 never fired once, for the same structural reason as the row above — **a hot file missing
from the table is permanently invisible to its own guardrail.** ⚠ **A correction on measurement:**
Phase 194's D-01 says the filename occurs *"inside other rows' prose"*; measured,
`grep -o "WorkspacePanel.tsx" CLAUDE.md | wc -l` returns **0**. Re-derive with:
`git log --oneline -- <file> | wc -l` → 13; the `sed` recipe → `087 088 094 095.1 100 124 155 188`;
`wc -l` → 493.

**Verdict cell.** **G-5 FIRES ON THE COUNT (8 phases) — honoured BY CONSTRUCTION, and the construction
is CONDITIONAL, which is stated rather than assumed.** The measured reason: the Stop mounts as an
**additive sibling** inside the harness gate the file already owns (`showTimeline = isHarness ||
phases.length > 0`, `:292`), calling `stopThread(threadId)` with a thread id the file already holds
(`useViewingThread()`, `:271`) through a ninth hook from a module it already imports eight from
(`:34-43`). **No new fetch, no new prop, no new store slice, no new state.** ⚠ **The condition, and it
is load-bearing: had the Stop instead needed a producer run id of its own, that would have been a
SECOND concern and the refactor recommendation would have been owed FIRST.** The file's only run id is
`RunSeam`'s local `useState` fed from `getThreadWorkflow` — and it is the **`workflow_runs.id`**
(`:219`), which `DELETE /runs/{id}` does not accept. **The invariants that bind this file:** an
additive sibling may NOT read `PhaseCard` / `PhaseTimeline` internals or add a prop to either (the
shipped G-5 red line, `:88-93` and `:183-186`); ⚠ **no control here may resolve a cancel through
`workflowLock.runId`** — the file's own `RunSeam` docblock (`:161-165`) records that the lock's id is
*"overwritten with a PRODUCER run id at kickoff"* and that *"both ids are bare uuids, so a swap
typechecks and then resolves nothing"*; a section renders nothing when its data is absent, so every
existing caller and panel test stays byte-unchanged. **Per G-5 the next phase adding a genuinely second
concern owes a refactor recommendation FIRST; the natural seam is the five data-section mounts versus
the panel shell/collapse state machine versus the `RunSeam`/soul receipts. It inherits `13 / 8 / 493`.**

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on 194 |
|---|---|---|---|
| `runs:active` as the source of truth | **Postgres `runs.status` is authoritative**; Redis is a derived mirror | Phase 145 / D-145-01 | A Stop's proof is a DB row, never an SSE sentinel |
| Cancel logic duplicated in `api/runs.py` and the admin Kill route | ONE shared `_cancel_run_internals` | Phase 163 / D-02 | Extend it; a third fork would be a regression |
| Bare `ALTER … ADD CONSTRAINT` pairs in migrations | `BEGIN` / `COMMIT` + `DROP … IF EXISTS` | Phase 189 WR-01 (2026-08-07) | 119 must use the atomic shape |
| A golden run could be resumed by the boot sweep | `find_resumable_runs` excludes `is_golden_run` | Phase 190 / A4 | Stuck row #2 will never self-heal — D-12 is its only exit |
| `workflowLock.runId` assumed to be the anchor | Measured to be **either** id | Phase 188 CR-03 (recorded in `WorkspacePanel.tsx:161-165`) | The central landmine of this phase |
| `/runs/{id}` routes accepting only a producer id | `/continue` (092-07) and `/ask_user_response` (093 F10) accept **either** | Phases 092 / 093 | The template for `DELETE` — the one route left behind |

**Deprecated / stale in the tree (flagged, not fixed here):**
- `finish_run`'s docstring — narrower than the function (D-14 / correct beside, not over).
- `streamsStore.ts:52-53` — `WorkflowLock.runId`'s JSDoc is false at two of four write sites.
- Mig 115's header line-number pointers into `db/workflows.py` — stale by ~240 lines.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Local Supabase Postgres `:54322` | mig 119 apply + the live-DB gate + D-12's heal | ✅ | connected, 112 migrations applied | — (the mig-115 test template green-skips when unreachable) |
| `backend/venv` python + `asyncpg` + `psycopg2` | backend tests, the D-12 receipt | ✅ | `backend/venv/Scripts/python.exe` | — |
| `pytest` | backend suites | ✅ | 12/12 pass on the cancel-path suites | — |
| Node + vitest + `scripts/vitest-count-gate.cjs` | frontend gate | ✅ | `count gate OK · 3918 · failed 0 · 75/75` | — |
| `npx tsc -p tsconfig.app.json` | typecheck | ✅ | **33 errors — the documented baseline, unmoved** | — |
| Redis `:6379` | the zombie arm's sentinel/EXPIRE ops | assumed up (compose) | — | ⚠ Every Redis op is best-effort by design (D-062-13) — a Redis outage must NOT fail a Stop; this is a **fence to assert**, not a dependency to require |
| Supabase SQL editor (operator) | applying mig 119 (D-06) | operator-gated | — | ⛔ **None. This is a `checkpoint:human-verify` task** — the plan authors the file, the operator applies it |
| Live LLM provider keys | the 8-row UAT scoreboard | ⚠ **unknown at research time** | — | Blocked rows are recorded ⛔ with the reason, never omitted. Prior art: Phase 193.2's OpenAI balance exhaustion blocked three publishes |

**Missing dependencies with no fallback:** the operator's SQL-editor paste for mig 119.
**Missing with fallback:** none.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Frontend framework | **vitest** + Testing Library, config `frontend/vitest.config.ts` |
| Frontend quick run | `cd frontend && npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx` |
| Frontend full gate | `cd frontend && GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs` |
| Frontend typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` ⚠ **bare `--noEmit` checks ZERO files** |
| Backend framework | **pytest** + `pytest_asyncio`, `backend/venv/Scripts/python.exe -m pytest` |
| Backend quick run | `cd backend && venv/Scripts/python.exe -m pytest tests/test_062_cancel_run.py tests/test_cancel_run.py tests/test_run_lifecycle.py -q` |
| Backend full suite | `cd backend && venv/Scripts/python.exe -m pytest tests/unit -q` |
| Live-DB gate template | `backend/tests/test_migration_115.py` (rollback txn, nested savepoint, two clean skips) |

### Measured baselines (re-derive; do not inherit)

| Gate | Baseline at `05f664a0` |
|---|---|
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | **`count gate OK` · total 3918 · failed 0 · pinned total 3868 · 75/75 pinned files present** · exit 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | **33 errors** (the documented, unmoved baseline) |
| `pytest test_062_cancel_run.py test_cancel_run.py test_run_lifecycle.py test_migration_115.py` | **12 passed** |
| `pytest tests/unit` | ⚠ known rot baseline **62 failed / ~2221 passed** (SEED-056/SEED-165) — re-derive at wave 0 and compare failures **by name**, never by count |

⚠ **A GROWING count-gate total is the gate WORKING.** Its contract is *no per-file decrease* and *zero
failing* — never a fixed grand total. The 3918 above will be larger by this phase's close.

### Phase Requirements → Test Map

| Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| RUN-01 / **SC#1** | `DELETE /runs/{id}` accepts a `workflow_runs.id`, owner-scoped + anchor-confirmed, and resolves forward to the producer id | unit (backend) | `pytest backend/tests/test_062_cancel_run.py -x -k dual_id` | ❌ **Wave 0** |
| RUN-01 / SC#1 | A cross-user `workflow_runs.id` returns **404, never 403** (no existence leak) | unit (backend) | `pytest backend/tests/test_062_cancel_run.py -x -k cross_user` | ❌ Wave 0 |
| RUN-01 / SC#1 | A `workflow_runs.id` that is NOT the thread's live anchor → 404 | unit (backend) | same file | ❌ Wave 0 |
| RUN-01 / SC#1 | The panel renders a Stop under the harness gate and calls `stopThread` with the **thread id** | unit (frontend) | `npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx` | ✅ extend |
| RUN-01 / SC#1 | ⚠ **No module under `components/panel/` passes `workflowLock.runId` to `cancelRun`** (source fence) | fence (frontend) | same file | ❌ Wave 0 |
| RUN-01 / SC#1 | The composer Stop resolves a **producer** run id during a harness run | unit (frontend) | `npx vitest run src/components/chat/__tests__/` | ❌ Wave 0 |
| RUN-01 / SC#1 | The chat banner advances past `"Starting workflow…"` once a phase completes, **and still reads it before phase 1** | unit (frontend) | `npx vitest run src/lib/__tests__/toolMeta.test.ts` | ✅ extend (`:31` pin unmoved) |
| RUN-01 / **SC#2** | Step 3b co-writes `workflow_runs.status='cancelled'` via `finish_run` | unit (backend) | `pytest backend/tests/test_062_cancel_run.py -x -k zombie_workflow` | ❌ Wave 0 |
| RUN-01 / SC#2 | Step 3b reads the anchor **BEFORE** the shipped 092-03 clear | unit (backend) | same file | ❌ Wave 0 |
| RUN-01 / SC#2 | A Deep run (`active_workflow_run_id IS NULL`) takes the arm **byte-identically** | unit (backend) | `pytest backend/tests/test_run_lifecycle.py -x` | ✅ extend |
| RUN-01 / SC#2 | ⚠ Step 3b carries **NO** `is_app_shutting_down()` gate, and F2 still **does** | fence (backend) | `pytest backend/tests/test_run_lifecycle.py -x -k shutdown_gate_scope` | ❌ Wave 0 |
| RUN-01 / SC#2 | A double `finish_run` is a no-op (idempotence) | unit (backend) | `pytest backend/tests/test_062_cancel_run.py -x -k idempotent` | ❌ Wave 0 |
| RUN-01 / **SC#3** | mig 119: **all seven** literals admitted, incl. the six shipped | live-DB gate | `pytest backend/tests/test_migration_119.py -x` | ❌ Wave 0 |
| RUN-01 / SC#3 | mig 119 **negative control**: a nonsense value is refused with SQLSTATE `23514` naming `workflow_phases_status_check` | live-DB gate | same file | ❌ Wave 0 |
| RUN-01 / SC#3 | The in-flight phase becomes `cancelled` on the **engine** cancel arm | unit (backend) | `pytest backend/tests/test_harness_engine.py -x -k cancel_phase` | ❌ Wave 0 |
| RUN-01 / SC#3 | The in-flight phase becomes `cancelled` on the **zombie** arm (no engine) | unit (backend) | `pytest backend/tests/test_062_cancel_run.py -x -k zombie_phase` | ❌ Wave 0 |
| RUN-01 / SC#3 | ⚠ **`completed` phases are UNTOUCHED** (D-07, inherited) | unit (backend) | same file | ❌ Wave 0 |
| RUN-01 / SC#3 | ⚠ A cancel **never** enters the `failed` or `skipped` vocabulary for the phase | fence (backend) | same file | ❌ Wave 0 |
| D-12 | Both stuck rows are `cancelled` after the heal, with before/after captured | **manual + recorded receipt** | `checkpoint:human-verify` + a committed SQL receipt | ❌ Wave N |

### The fences, and the REAL PLANT each must be driven RED against

> **The project's standing rule: a fence is only real once you have watched it FAIL.** Five inert
> fences shipped in Phase 193.2, four in 193.1, three in 192.1, five in 190 — **every one caught by
> planting, none by reading.** Each fence below therefore names the plant, and the plant must live in
> **production source** (not a fixture), be observed RED, and be reverted with the file restored
> md5-identical.

| # | Fence | The plant it must be driven RED against |
|---|---|---|
| **F-1** | No panel/library module passes `workflowLock.runId` (or any `*.runId` off the lock) to `cancelRun` | In `WorkspacePanel.tsx`, replace `stopThread(threadId)` with `cancelRun(workflowLock.runId)`. ⚠ **Must red on the `?.` form too** — plant `workflowLock?.runId` separately |
| **F-2** | Step 3b reads the anchor BEFORE the 092-03 clear | Move the anchor read **below** the existing `UPDATE threads SET active_workflow_run_id = NULL` block in `run_lifecycle.py`. The fence must red because `wf_id` is then `None` |
| **F-3** | The Deep path through Step 3b is byte-identical | Remove the `if wf_id:` guard so the workflow branch runs unconditionally. Must red on a Deep-run fixture |
| **F-4** | Step 3b carries no `is_app_shutting_down()` gate; F2 still does | ⚠ **Two plants, driven separately** — (a) add `and not is_app_shutting_down()` to Step 3b's workflow branch; (b) delete the gate from `run_producer.py:257`. **A fence asserting only (a) leaves (b) undefended** — this is the 193.2 "two arms, one assertion" lesson |
| **F-5** | Completed phases untouched by a cancel | Change the phase UPDATE's predicate from `status='active'` to `status IN ('active','completed')` |
| **F-6** | No cancel path writes `failed` or `skipped` to a `workflow_phases` row | Change `'cancelled'` to `'failed'` in the new phase writer. ⚠ **Scope the fence over the composed SQL/value, NOT the module source** — this file's docblocks legitimately name `failed` and `skipped` (the 193.2 F-3 lesson) |
| **F-7** | mig 119 admits all seven literals | Delete `'skipped'::text` from the new `ARRAY[…]`. The positive control must red on that literal specifically — **loop the assertion per-literal**, because a single `assert all(...)` short-circuits and proves only the first (the 193.2 clause-by-clause lesson) |
| **F-8** | mig 119 negative control | Attempt `'Run cancelled — no deliverable produced'` (the sketch's display sentence). Must raise `23514` naming `workflow_phases_status_check`. This is D-17's rule inherited: **the column stores the SLUG** |
| **F-9** | The banner still reads `"Starting workflow…"` before phase 1 | Make the harness branch return the phase label unconditionally. `toolMeta.test.ts:31` must red |
| **F-10** | The dual-id fallback is owner-scoped AND anchor-confirmed | ⚠ **Two plants, driven separately** — (a) delete `.eq("user_id", current_user["id"])` from the `workflow_runs` select; (b) delete the anchor-confirm `if`. Prior art: Phase 190's CR-01 was a **real credential exposure that 19 plans of RED-first self-checking missed**, because mig 116 copied RLS from a table with no secret column. **On this cluster the `WHERE` clause is the only boundary** — the pool is service-role and bypasses RLS |
| **F-11** | A Redis outage does not fail a Stop | Make one Redis op in Step 3b raise outside its `try`. The 204/`"zombie_healed"` contract must still hold (D-062-13) |
| **F-12** | The ask_user sentinel is published BEFORE `task.cancel()` | Swap the two statements at `run_lifecycle.py:210-222`. D-085-04 |

⚠ **F-1 has a scope trap this project has been bitten by twice.** A fence that sweeps
`components/panel/` will not see a Stop that later lands in `components/chat/` or `library/`. **Scope
it over the union of the four mount directories and drive it RED with a plant in EACH**, or it will
report green about files it cannot see — the exact failure of Phase 192.1's *"renamed module swept
against the empty string and passed green."*

### UAT scoreboard — SC#10 fires

194 touches **streaming, the agent loop and UI state**, so `CLAUDE.md` § *UAT scoreboard recipe*
applies in full. The 4-axis bandwidth:

| Axis | Coverage owed | Automatable? |
|---|---|---|
| **Cross-provider** | **8 rows — the FULL native roster + OpenRouter**, ⚠ **DERIVED from `MODEL_CAPABILITIES`, never re-typed** | ⛔ **Inescapably manual** — each row is a real run against a live provider |
| **Multi-tool** | ≥ 1 row stopping a run mid-`execute_code`/`search_documents` | ⛔ manual |
| **Parallel-thread** | ≥ 1 row: Thread A workflow streaming while Thread B accepts a prompt; Stop A; assert B unaffected | ⚠ partly automatable (the per-thread store slices), but the composer-lock behaviour is manual |
| **Long-message** | ≥ 1 row with ≥ 50 prior messages OR a ≥ 5 KB prompt | ⛔ manual |

**The derivation command — put this verbatim in `VALIDATION.md`, not the list:**
```bash
cd backend && venv/Scripts/python.exe -c "
from app.config import MODEL_CAPABILITIES
import collections
g=collections.defaultdict(list)
for k,v in MODEL_CAPABILITIES.items():
    g[v.get('provider') if isinstance(v,dict) else getattr(v,'provider',None)].append(k)
for p,ms in sorted(g.items()): print(p, len(ms), ms[-1])"
```
Measured at HEAD it returns **8 groups**: `anthropic · deepseek · google · minimax · moonshot ·
openai · openrouter · zhipu` — exactly the roster CLAUDE.md names. **Prefer the newest,
registry-backed model per provider**: an id absent from `MODEL_CAPABILITIES` resolves
`capability_source=inferred` and silently loses `emit_tier`, so the row would measure a weaker
configuration than the one that ships.

**Cheapest honest method** (proven in Phase 185, re-recommended here): drive each row as a real run
with a **per-request** `model` + `provider` on `POST /threads/{id}/messages`, then Stop it and read
verdicts from `workflow_runs` / `workflow_phases` / `harness_audit`. **That scores the whole board
without mutating any global setting**, so the operator's environment is untouched.

⚠ **Rows may be BLOCKED but never silently omitted.** A provider with no key, or one blocked by a
known defect, is recorded **⛔ with the reason and the blocking issue id**. A scoreboard listing only
what passed is not a scoreboard.

**G-4 lived-experience rows** (operator-defined at scope time, driven with Chrome MCP — ⚠
`take_screenshot` times out; read DOM geometry via `evaluate_script`):
1. Stop a run from the **panel** mid-phase → the spine shows the interrupted phase as stopped and the
   completed ones intact.
2. Stop a run **from another thread** via `ActiveRunsTray` → the originating thread's composer unlocks.
3. Stop a run **waiting at an approval** → the pending card resolves and does not strand
   (`BUG-260808-02`'s folded half).
4. ⚠ **The negative row that would have caught the id landmine:** reload the page mid-run (so the
   mount reconcile overwrites `workflowLock.runId` with the anchor), **then** press Stop. Before the
   fix this is a silent no-op; after it, it stops.

### Wave serialization — ⚠ CLAUDE.md § Parallel execution rule 4

> *"Serialize any plan whose tests MUTATE the local database. Worktrees isolate files, not Postgres."*

| Wave content | Serialize? | Why |
|---|---|---|
| Migration 119 authoring | ✅ parallel-safe | Authors a file; applies nothing |
| **Migration 119 apply (operator) + `test_migration_119.py`** | ⛔ **SERIALIZE** | DDL on the live local DB. ⚠ Its `DROP+ADD CONSTRAINT` takes a brief **ACCESS EXCLUSIVE** lock on `workflow_phases` — a concurrent suite writing that table will block |
| **Any backend test seeding `workflow_runs` / `workflow_phases`** | ⛔ **SERIALIZE** | Even with a rollback transaction, the ACCESS EXCLUSIVE lock above and FK contention are shared |
| **D-12's heal** | ⛔ **SERIALIZE**, and make it `checkpoint:human-verify` | It mutates two real, irreplaceable rows |
| Frontend mount plans (1-3) + fences | ✅ parallel-safe, ≤ 2 concurrent | Pure component/store tests. ⚠ **Cap `GSD_VITEST_MAX_WORKERS=2`** — at 3+ concurrent test-running agents the gate goes non-deterministic regardless of cap |
| Ledger rows (D-02) + docstring corrections | ✅ parallel-safe | Docs only |

⚠ **Every worktree MUST run `bash scripts/bootstrap-worktree.sh "$(pwd)"` FIRST**, and **never**
`rm -rf` one (it follows the junction and destroys the real 1.7 GB `venv`) — tear down with
`bash scripts/teardown-worktree.sh <path>`. ⚠ **Assert the dispatched base SHA in every executor
prompt** — worktrees have forked from the wrong base 12/12 in Phase 192 and again on a single worktree
on 2026-08-14. ⚠ **Capture failing filenames BEFORE re-running anything** — cap-2 is not deterministic
(Phase 193.2 measured `failed` 4, 11 and 6 on three consecutive runs of an unchanged tree).

### Sampling Rate

- **Per task commit:** the relevant quick run (backend `pytest -q` on the touched suite; frontend
  `npx vitest run <file>`) **+** `npx tsc -p tsconfig.app.json --noEmit` (expect **33**).
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` — read the
  **verdict line**, never a summary — **+** `pytest backend/tests/unit -q` compared **by failure name**
  against the wave-0 baseline.
- **Phase gate:** both full suites green (backend: no NEW failure vs. baseline) before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `backend/tests/test_migration_119.py` — the live-DB gate (copy `test_migration_115.py`'s shape:
      rollback txn, nested savepoint, two clean skips, **green-skip until applied**) — SC#3
- [ ] Extend `backend/tests/test_062_cancel_run.py` — the dual-id fallback, the zombie workflow
      co-write, idempotence, the phase terminalize on the zombie arm — SC#1/SC#2/SC#3
- [ ] Extend `backend/tests/test_run_lifecycle.py` — the Deep byte-identity fence and the
      shutdown-gate scope fence (F-3, F-4) — SC#2
- [ ] Extend `backend/tests/test_harness_engine.py` — the engine cancel arm's phase terminalize — SC#3
- [ ] Extend `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` — the Stop mount + the
      F-1 source fence — SC#1
- [ ] New frontend suite for the composer Stop during a harness run — SC#1
- [ ] Extend `frontend/src/lib/__tests__/toolMeta.test.ts` — the advance case, ⚠ **with `:31`'s byte
      pin unmoved** — SC#1
- [ ] **A measurement task, before any BUG-260815-04 fix is planned:** dump the chat bucket during a
      live harness run and count assistant rows, to decide between the 174-04 race and the
      BUG-260609-03 class for the duplicate icon

---

## Security Domain

`security_enforcement` is not `false` in `.planning/config.json`, so this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control here |
|---|---|---|
| V2 Authentication | yes | `Depends(get_current_user)` on every `/runs` route — unchanged |
| V3 Session Management | no | No session surface touched |
| **V4 Access Control** | ⚠ **yes — the highest-risk category in this phase** | The new `workflow_runs` fallback runs on a **service-role** client that **bypasses RLS**, so `.eq("user_id", …)` + the thread-anchor confirm **are** the boundary. **404, never 403.** Fence F-10, two plants |
| V5 Input Validation | yes | `run_id: UUID` path typing (FastAPI). ⚠ **This is exactly where q5r's cross-tenant near-miss lived** — a `UUID`-typed param and a path-shaped id are not interchangeable; confirm the id shapes before widening anything |
| V6 Cryptography | no | No secrets, tokens or crypto touched |
| V7 Error Handling & Logging | yes | Every Redis op logs via `logger.exception` and never leaks content (T-073-04 / T-145-02-01) |
| V8 Data Protection | yes | ⚠ **D-12 mutates real user data.** Recorded before/after, operator-gated |

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Cross-user run cancel via a guessed `workflow_runs.id` | Tampering / EoP | Owner-scope + anchor-confirm on the **service-role** client; **404 never 403** (T-062-01/02, T-092-07-02, T-093-IDOR) |
| Existence leak (404 vs 403 divergence) | Information Disclosure | One collapsed 404 for *doesn't exist* and *not yours* — the shipped `/continue` and `/ask_user_response` shape |
| SQL injection on the new phase UPDATE | Tampering | `$N` binds only — **never** an f-string on user values (T-152-05-05, T-091-03) |
| Stack-trace leak on a Redis failure | Information Disclosure | `try/except` + `logger.exception`; 204 returned even when every Redis op fails (T-062-03) |
| Denial of a legitimate Stop | Denial of Service | Every Redis op best-effort; Postgres is the durable record (D-062-13) |
| ⚠ **A resumed golden run performing an external action** | Tampering / EoP | **Already mitigated** by Phase 190's A4 gate. ⚠ **Do NOT let D-12's heal, or any new arm, reintroduce a golden run into a resumable state** — cancel it, never re-anchor it |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The duplicate assistant icon and the stuck banner share a root (`runs.message_id` NULL for harness) | §B | Medium — a fix targeting one may not close the other. **Mitigated by making the bucket dump a Wave-0 measurement task rather than an assumption** |
| A2 | Redis is up in the dev environment (not probed this session) | Environment Availability | Low — every Redis op is best-effort by design; F-11 asserts it |
| A3 | Provider API keys are funded for the 8-row scoreboard | Validation | Medium — Phase 193.2 lost three publishes to an exhausted OpenAI balance. **Mitigated by the ⛔-with-a-reason rule** |
| A4 | The `is_system_global` 409 guard cannot fire for the two stuck rows | Runtime State Inventory | Low — measured directly (both definitions `is_system_global = False`, owner `d8a54002…`, zero global versions for either slug) |
| A5 | No plan will need a new npm/PyPI package | Package Legitimacy Audit | Low — but if one appears, the Package Legitimacy Gate is owed |

---

## Open Questions

1. **Does mount 4 ship at all?**
   - Known: the library carries no run id and the feeds are definition feeds.
   - Unclear: whether the operator wants it enough to accept a `WorkflowsPage.tsx` G-5 refactor first.
   - Recommendation: **descope with a written trigger**; mounts 1-3 already deliver "stoppable from
     outside its thread" via `ActiveRunsTray`.
2. **Do the 2 orphan `active` phase rows under `failed` runs get healed?**
   - Known: they exist, they are `confirm` phases, both stamped 2026-07-18.
   - Unclear: D-12 names only the two run rows.
   - Recommendation: fold them into D-12's receipt, or state the exclusion. **Do not leave it silent
     in a phase about not presenting partial writes as finished.**
3. **How is a healed golden run distinguished from a user-stopped run?**
   - Known: stuck row #2 is `is_golden_run = True`.
   - Unclear: whether the `cancelled` status alone is honest enough.
   - Recommendation: an `error`/audit note, **never** a new status literal (that would be a second
     migration for a one-off).
4. **Does the banner fix accept the PANEL-09 re-render cost?**
   - Known: the demux is deliberately panel-only for a measured perf reason.
   - Unclear: whether per-phase chat re-renders are acceptable.
   - Recommendation: state the accepted cost explicitly; it is per-phase, not per-token.
5. **Which mark for the stopped state on the spine?**
   - Known: three marks ship for one concept; neither `■` nor `⏹` is in the §4 table.
   - Recommendation: flag as a proposal per §4, or use a **word-badge with no glyph** (the shipped
     `waitsForYou` precedent) — which needs no new vocabulary at all.

---

## ⚠ CONTEXT.md claims measured FALSE or STALE

Recorded **beside** the original, never over it — this project's standing habit.

| # | CONTEXT claim | Measured at HEAD `05f664a0` |
|---|---|---|
| **1** | D-09: *"`workflow_runs` stays `active` forever **and the thread anchor is never cleared** ⇒ the thread is permanently wedged"* | ⚠ **HALF FALSE.** The anchor **IS** cleared — `run_lifecycle.py:256-268`, Phase 092 (092-03 / SC#2, MODE-02), best-effort via `aexec`. Only `workflow_runs.status` is missing. **The gap is real; the stated consequence is not.** The true consequence is an *orphaned lie* (a row reading `active` with no anchor pointing at it, invisible to `find_resumable_runs`), not a lock |
| **2** | D-12 / `BUG-260815-07`: the two stuck rows are a *"permanent delete blocker"* because *"a run that cannot be cancelled cleanly stalls the cascade"* | ⚠ **FALSE.** `delete_workflow_cascade` (`api/workflows.py:1481-1512`) cancel-firsts **and** calls `finish_run(wf_id, "cancelled")` **unconditionally** for every in-flight row — including when `producer_id IS NULL`. Both definitions are `is_system_global = False` with **0** foreign runs, so the 409 guard cannot fire either. **D-12 should still ship; its justification must be restated** |
| **3** | D-08 mount 4: *"a run id the library already has"* | ⚠ **FALSE.** `LibraryRow` has no run field; the three feeds are definition feeds; `grep runId\|run_id\|running\|activeRun` over `library/` returns one prose hit. **There is no such id** |
| **4** | D-01: *"neither is a ROW in the ledger — **both names occur only inside other rows' prose**"* | ⚠ **FALSE, and the conclusion is strengthened.** `grep -o "RunCard.tsx" CLAUDE.md \| wc -l` → **0**; `grep -o "WorkspacePanel.tsx" …` → **0**. Neither filename appears in `CLAUDE.md` at all |
| **5** | D-01: `RunCard.tsx` *"20 commits / ~9 buckets"* | ✅ commits and buckets exact. ⚠ **The 9th bucket, `streaming`, is NOT a phase** (`fix(streaming)` `0dce56aa` + `revert(streaming)` `61e5eb1e`, an untagged 075.x follow-up pair). **The PHASE count is 8** |
| **6** | D-08 mount 2: *"whether it actually renders and fires during a workflow run is UNVERIFIED"* and BUG-260815-04 *"may defeat"* `stopThread`'s scan | ⚠ **MEASURED — it is NOT defeated.** The banner branch (`MessageItem.tsx:635`) *requires* `isStreaming && !hasAnyTools` on the very message the scan targets, and the kickoff stamps `runId = run_id`, the **producer** id (`StreamsProvider.tsx:2027-2031`). **The stuck banner is proof the scan's target exists.** ⚠ A narrow real gap remains: the pre-`runId`-stamp window is a silent no-op |
| **7** | `BUG-260815-04`: the duplicate icon *"is a SECOND symptom with a probably-different cause"*, prior art `toolcallpanel-dedup-duplicates-tool-card.md` | ⚠ **The named prior art is the WRONG one** — `BUG-260521-01` is a *transient tool-card* duplicate, minor, folded into 075.2. The real prior art is `dedupMessages.ts:20-26` + `StreamsProvider.tsx:2490-2500` (BUG-260609-03) + `dedupMessages.ts:31-45` (BUG-260610-01). **HYPOTHESIS (MEDIUM): the two symptoms SHARE a root** — harness leaves `runs.message_id` NULL, so the chat surface has no runId identity for a harness assistant row |
| **8** | `<canonical_refs>`: *"`frontend/src/lib/toolMeta.ts:92` + `toolMeta.test.ts:30`"* | ⚠ **STALE PATH.** The test is at `frontend/src/lib/__tests__/toolMeta.test.ts` and the byte-exact assertion is at **`:31`**. `toolMeta.ts:92` ✅ exact |
| **9** | Mig 115 header: the phase-status literals are *"the four UPDATEs in `db/workflows.py` (lines 965, 979, 1001, 1013)"* | ⚠ **STALE by ~240 lines** (not CONTEXT's error, but 119 must not copy it). Actual writers: `:1208`, `:1222`, `:1244`, `:1256`, `:1287` — **five**, not four |
| **10** | `<canonical_refs>`: `run_producer.py:225-295` / `:254-277` for the F2 block; `StreamsProvider.tsx:2400-2416` for `stopThread` | ⚠ **Slightly short at both ends.** F2's comment starts `:247` and its `finish_run` call runs `:262-277`, with the `is_app_shutting_down` gate at `:255-260`. `stopThread` spans `:2400-2424`, `cancelRun` at `:2411`. Both cited anchors are inside their blocks — usable, not exact |
| **11** | ✅ **Verified EXACT, no drift** | `api/runs.py:1155` (`async def cancel_run`) · `run_lifecycle.py:158` (`async def _cancel_run_internals`) · `db/workflows.py:1308` (`async def finish_run`) · `run_producer.py:386` (the harness branch) · `:490-496` (the `CancelledError` classifier) · `harness_engine.py:1614-1644` (the cancel arm + the 096-09 gate) · `RunCard.tsx:534` (`■`) and `:548` (`cancelled`) · `MessageInput.tsx:403-416` · `ChatArea.tsx:361` · `api.ts:1249`/`:1267` · mig 115 `:113-119` · mig 063 `:50-57` · mig 057 `:19` · 112 migration files, highest 118 · the mig-115 CHECK's six literals |

**Not a CONTEXT error, but the finding CONTEXT could not have had:** `WorkflowLock.runId` carries two
id types (§*The id-type landmine*). CONTEXT does not mention it; `streamsStore.ts:52` asserts the
opposite; and it is the mechanism by which a well-built Stop can silently do nothing.

---

## Sources

### Primary (HIGH confidence — direct file read / live DB / executed command, at `05f664a0`)
- `backend/app/services/run_lifecycle.py` (whole file, 299 L) — `_cancel_run_internals`, `finalize_run_terminal`
- `backend/app/api/runs.py:535-585, 715-800, 1124-1210` — the two dual-id fallbacks + the cancel verb
- `backend/app/api/workflows.py:1421-1512` — `delete_workflow_cascade` (the composed precedent)
- `backend/app/db/workflows.py:840-897, 955-1120, 1202-1340` — cascade, phase writers, `get_active_phase`, `find_resumable_runs`, `finish_run`
- `backend/app/services/run_producer.py:220-300, 378-400, 480-500, 610-630` — F2, the harness branch, the classifier
- `backend/app/services/harness_engine.py:92-94, 1560-1660` — the shutdown flag, the loop, the cancel arm
- `supabase/migrations/115_*.sql` (whole file) · `063_*.sql:50-57` · `057_*.sql:19` · `supabase/full-schema.sql:1975`
- Live local Postgres `127.0.0.1:54322` via `psycopg2` — 4 queries: stuck rows + anchors, phase/run/definition histograms, FK delete rules, `pg_constraint` definitions
- `frontend/src/providers/StreamsProvider.tsx:960-1100, 1620-1640, 1830-1850, 1920-2040, 2373-2424, 2485-2505, 3025-3040, 3317-3450`
- `frontend/src/components/panel/WorkspacePanel.tsx:150-300` · `chat/MessageItem.tsx:298-670` · `chat/RunCard.tsx:520-550` · `chat/ActiveRunsTray.tsx` (whole, 141 L) · `chat/MessageInput.tsx:390-425` · `chat/ChatArea.tsx:352-372` · `lib/toolMeta.ts:68-110` · `lib/api.ts:1249-1268` · `lib/dedupMessages.ts:1-50` · `stores/streamsStore.ts:51-60` · `components/workflows/library/libraryRow.ts`
- Executed: `git log`/`wc -l` G-5 derivations · `grep -o` ledger counts ·
  `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` → **OK · 3918 · failed 0 · 75/75** ·
  `npx tsc -p tsconfig.app.json --noEmit` → **33** · `pytest` on 4 cancel/migration suites → **12 passed** ·
  the `MODEL_CAPABILITIES` roster derivation → **8 groups**
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` + `references/workflow-run-surface.md` + `references/icon-convention.md` §4
- `CLAUDE.md` (guardrails, hot-file ledger, UAT recipe, parallel execution) · `.planning/config.json` ·
  `ROADMAP.md:488-503` · `REQUIREMENTS.md:70, 85, 87` · `STATE.md:95-135`
- `.planning/reported-bugs/BUG-260815-07-*.md` · `chat-stuck-on-starting-workflow-with-duplicate-icon.md` · `toolcallpanel-dedup-duplicates-tool-card.md`

### Secondary (MEDIUM confidence)
- The duplicate-assistant-icon root-cause hypothesis (A1) — assembled from three shipped docblocks
  naming the same `runs.message_id`-NULL mechanism, **not driven**
- The PANEL-09 re-render cost of the banner fix — reasoned from the demux's own comments, not profiled

### Tertiary (LOW confidence — flagged for validation)
- Redis liveness in the current dev environment (not probed)
- Provider key funding for the 8-row scoreboard (not probed; Phase 193.2 precedent says check)

---

## Metadata

**Confidence breakdown:**
- **Backend cancel path & the three gaps — HIGH.** Every claim read from source at HEAD or queried
  from the live DB; four CONTEXT claims falsified by measurement rather than by reading.
- **The id-type landmine — HIGH.** All four write sites read; corroborated independently by
  `WorkspacePanel.tsx:161-165` and `ChatLayout.launch.test.tsx:45`, both written by earlier phases.
- **Migration 119 — HIGH.** Constraint read from `pg_constraint` on the live DB, the migration
  inventory counted, no later ALTER found, the test template read in full.
- **The two stuck rows — HIGH.** Queried directly, with ids, anchors, definitions, owners and the
  producer-run history behind each.
- **G-5 re-derivation — HIGH.** Commands executed; the quick-task/untagged bucket subtracted and named.
- **Mount 1/2/3 verdicts — HIGH.** Traced hop by hop through live source.
- **Mount 4 — HIGH (that the premise is false).** The absence measured by grep over the whole `library/` dir.
- **BUG-260815-04 banner mechanism — HIGH.** `hasAnyTools` is one expression and the branch is one line.
- **BUG-260815-04 duplicate icon — MEDIUM.** Hypothesis with three corroborating docblocks; the
  disproof is specified and is a Wave-0 task.
- **Validation architecture — HIGH on gates and baselines (all executed); MEDIUM on fence design**
  (F-1's scope trap and F-4/F-10's two-plant requirements are the parts most likely to ship inert).

**Research date:** 2026-08-16
**Valid until:** ~2026-08-23 (7 days — this tree moves fast; `WorkflowsPage.tsx`'s ledger cell has
gone stale four consecutive times and once within a single day). **Re-derive every git/`wc -l` figure
and every baseline at Wave 0 rather than inheriting them from this file.**
