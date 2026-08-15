# Phase 194: Stop a Running Workflow - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A workflow (harness) run can be stopped mid-execution from the surface the user is watching it on,
and **everything that surface then shows says `cancelled`** — the run row, the interrupted phase row,
and the chat receipt. Stopping works whether or not the producer task is still alive on this worker.

**Requirement:** RUN-01 — *"A user can stop a running workflow at any point, and the run reports
honestly that it was stopped."*

⚠ **THE ROADMAP'S SCOPE FLAG IS MEASURABLY WRONG, AND SO IS THE CORRECTION STATE.md WROTE AGAINST
IT. BOTH ARE RECORDED HERE RATHER THAN OVERWRITTEN, because this phase's size depends on which is
believed.**

| Claim | Source | Measured at HEAD, 2026-08-16 |
|---|---|---|
| *"Depends on: Nothing structural — **mostly UI over an endpoint that already exists**"* · *"**this is not a new runtime path**"* | `ROADMAP.md:494-495` | ⚠ **HALF TRUE.** There is no workflow-run cancel endpoint — but the cancel *path* already runs end to end through the producer shell, including the `workflow_runs.status='cancelled'` write |
| *"⇒ **194 is a NEW runtime path on the workflow side**: an endpoint, a DB writer, and harness-engine cooperation"* | `STATE.md` § *PHASE 194 — TWO FINDINGS MEASURED 2026-08-16* | ⚠ **HALF TRUE.** Its four measurements are each individually correct; the **inference** is not. It searched `api/workflow_runs.py` and `db/workflows.py` for a cancel verb, found none, and concluded none exists — but a harness run is driven by the **same producer task as a Deep run**, so it is cancelled through `runs`, not through `workflow_runs` |

**What actually ships today** (all four re-derivable, file:line):

1. **A harness run and a Deep run share one producer task.** `run_producer.run_producer` takes
   `active_workflow_run_id`; the ONE additive branch at `run_producer.py:386` calls `run_workflow`
   when the thread holds a live workflow anchor, else the Deep loop. The task is registered in
   `RUN_TASKS` under the **`runs`-row id** (the producer shell), not the `workflow_run` id.
2. **`DELETE /runs/{run_id}` therefore already cancels a workflow run.** `api/runs.py:1155` →
   `run_lifecycle._cancel_run_internals` (`:158`) → Step 3a publishes the ask_user cancel sentinel,
   then `task.cancel()`.
3. **The producer classifies and cascades.** `CancelledError` → `_terminal_status = "cancelled"`
   (`run_producer.py:490-496`, `:619-620`), then the **F2 block** (`run_producer.py:254-277`) calls
   `db.workflows.finish_run(active_workflow_run_id, "cancelled")`. Its own comment names this the
   *"v2.8-audit cancel-honesty fix"*. `finish_run` (`db/workflows.py:1308`) writes
   `workflow_runs.status` **and** clears `threads.active_workflow_run_id` in ONE transaction.
4. **The engine already has a cancel arm.** `harness_engine.py:1615-1644` — on `CancelledError` it
   shields `_expire_pending_ask_user` (so a paused prompt cannot strand as a submittable-but-dead
   card), skips that expiry on graceful shutdown (096-09), then re-raises.

⇒ **194 is NOT "build cancel". It is "is the shipped cancel REACHABLE, HONEST and SAFE from the
workflow run surface?"** Three measured gaps say no, and they map one-to-one onto the three success
criteria. See `<code_context>` § *The three gaps*.

**In scope**
- A Stop control on the workflow run surface (four mounts, ONE mechanism — see D-08).
- Making the interrupted `workflow_phases` row honest (migration + terminalize write).
- Extending the zombie-heal arm across to `workflow_runs`, and healing the two historically stuck rows.
- The chat surface advancing past its pre-tools state so a run is legible as running (BUG-260815-04).
- Two `CLAUDE.md` hot-file ledger rows (D-02).

**Out of scope**
- A run-history surface reachable from the canvas (BUG-260815-03 — deferred to 195, D-15).
- Rewording the `"Starting workflow…"` banner string (D-13 — it is byte-pinned and DELIBERATE).
- Scheduled / recurring runs and spend caps (Phase 105 carry-forward; RUN-01 is their prerequisite,
  not their delivery).
- Any change to the Deep-run cancel path's existing behaviour.

</domain>

<decisions>
## Implementation Decisions

### Guardrails

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

- **D-03 [informational] — G-1 does not fire** (194 is not an `.N` insert on a hot file). **G-2 does not fire as a
  blocker**: the Stop control is an affordance on shipped surfaces, not a new visual surface. ⚠ If
  planning proposes a *new* run-surface layout rather than a control inside the shipped spine, G-2
  fires and a sketch is owed first.

### The interrupted phase (SC#3)

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

### Where Stop lives

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
  4. ~~**The Workflows page row — the LIVE half only.** A *running* workflow's library row gets a Stop
     using a run id the library already has. **No new history surface** (D-15).~~
     ⚠ **DESCOPED AT PLAN TIME — SEE D-16. The strikethrough text is kept because its FALSE PREMISE
     is the reason for the descope, and overwriting it would hide that.**

### The run that nobody can stop (SC#2)

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

### The aftermath (SC#2 / SC#3)

- **D-13 — A stopped run keeps its completed phases, marks the interrupted one, and is TERMINAL.**
  The spine shows what genuinely finished; the interrupted phase reads **stopped, not failed**; there
  is **no resume**. Resumability was offered and REJECTED: `workflow_runs.status` already carries a
  distinct **`paused`** for that meaning (migs 057/063), so making `cancelled` mean "pausable" would
  collapse two states SC#2 needs to keep apart. Collapsing to a bare `cancelled` that hides partial
  work was also rejected — it discards evidence the database still holds.
- **D-14 — `RunCard`'s shipped vocabulary is the starting point, not a rewrite.** It already maps
  `cancelled` → `"■"` / `"cancelled"` (`:534`, `:548`). Planning may extend it; it may not replace it
  without stating why.

### Folded bugs

- **`BUG-260815-07` — stuck-active runs block deletion (major). FOLDED.** Its reproducible half **is**
  D-09's gap. ⚠ **Its non-reproducible half stays OPEN** — the one-off delete failure was explicitly
  recorded as *NOT reproducible*, and folding the report must not be read as closing that clause.
  `folded_into: 194` on the frontmatter.
- **`BUG-260815-04` — chat stuck on "Starting workflow…" with a duplicate assistant icon (major).
  FOLDED.** It directly blocks SC#1: if the chat surface never leaves its pre-tools state, a user
  cannot tell the run is running, let alone reach a Stop — and it may be what defeats `stopThread`'s
  `runStatus === "streaming"` scan (D-08 mount 2).
  ⚠⚠ **THE STRING IS DELIBERATE AND BYTE-PINNED — DO NOT REWORD IT.** `outerBannerLabel`
  (`frontend/src/lib/toolMeta.ts:92`) returns `"Starting workflow…"` when the thread is harness-locked
  and pre-tools, pinned byte-exact by `toolMeta.test.ts:30` as a **D-14 decision**. **The defect is
  that the surface never ADVANCES out of the pre-tools condition while `workflow_phases` rows are
  being written throughout.** A plan that "fixes" this by editing the copy has fixed nothing and
  broken a pin. ⚠ The **duplicate assistant icon** is a SECOND symptom with a probably-different
  cause and is kept separate on purpose — the report names prior art to check first rather than
  re-derive.
- **`BUG-260808-02` — approval hands off to chat (major). FOLDED.** 194 is inside the approval
  checkpoint regardless: Step 3a **publishes the ask_user cancel sentinel BEFORE `task.cancel()`**
  (D-085-04) so a paused `_handle_ask_user` wakes and returns a normal `ToolResult`, and the engine's
  cancel arm shields `_expire_pending_ask_user`. ⚠ **Scope fence:** 194 covers **stopping a run that
  is waiting at an approval**, not redesigning where approval lives. If planning finds the fix needs
  the approval surface moved off chat, that is a phase, not a task — defer it with a trigger.

### Plan-time amendments (2026-08-16, after `194-RESEARCH.md`)

⚠ **These three are OPERATOR RULINGS made at plan time, on measurements that refuted the discuss-time
premises. Each names the claim it overturns; the originals above are struck through, never deleted.**

- **D-16 — MOUNT 4 IS DESCOPED, AND THE PREMISE IT RESTED ON WAS MEASURED FALSE.** D-08 mount 4 said
  the library row gets a Stop *"using a run id the library already has"*. **There is no such id.**
  `LibraryRow` (`components/workflows/library/libraryRow.ts`) carries `id / slug / provenance / …`
  and **no run field of any kind**; all three feeds (`/workflows/published`, `/workflows/starters`,
  `/workflows/drafts`) are **definition** feeds; `grep -rE "runId|run_id|running|activeRun"` across
  the whole `library/` directory returns **one** hit and it is prose inside a docblock. Delivering it
  needs a new backend live-runs read **plus** a new `LibraryRow` field **plus** a poll or
  subscription — a genuinely **SECOND concern** on `WorkflowsPage.tsx`, whose ledger row already owes
  a G-5 refactor recommendation FIRST (inheriting `34 / 12 / 1176`).
  **Ruling: descoped with a written trigger** — `re_open_trigger: "the first phase that puts any
  live-run state on the library row"`. ⚠ **SC#1 is NOT weakened by this, and the reason is measured
  rather than argued: mount 3 (`ActiveRunsTray`) ALREADY ships per-run Stop + Stop-all
  (`ActiveRunsTray.tsx:114-136`), which delivers the *"stoppable from outside its thread without
  navigating in"* property mount 4 was reached for.** A plan may NOT quietly reinstate mount 4 as a
  wiring task; doing so is the second concern, and the refactor recommendation is owed first.

- **D-17 — THE TWO ORPHAN `workflow_phases` ROWS ARE HEALED TOO. D-12's receipt covers FOUR rows, not
  two.** Research found, beyond D-12's two stuck **run** rows, **two `workflow_phases` rows stuck
  `active` under runs that have already `failed`** (both `confirm` phases, stamped 2026-07-18) — which
  is **SC#3's exact failure mode already sitting in the live data**. Leaving a known orphan `active`
  phase row unhealed while shipping the fix that prevents new ones is precisely the inconsistency this
  phase exists to remove. **All four rows get ONE recorded before/after receipt** (row ids, `thread_id`,
  `created_at`, status before, status after), because *a data repair with no receipt is
  indistinguishable from a claim* (D-12). ⚠ **One of the two stuck run rows is `is_golden_run = True`**
  — a publish-validation artifact, permanently unresumable since Phase 190's A4 gate. It is healed like
  the others; if it needs distinguishing from a user-stopped run that is an `error`/audit note,
  **NEVER a new status literal** (that would be a second migration for a one-off).

- **D-18 — THE BANNER FIX SHIPS AND CROSSES PANEL-09 WITH THE COST STATED.** `BUG-260815-04`'s
  mechanism is named and it is not the copy: `hasAnyTools = tool_calls.length > 0`, a harness run
  writes **no** `tool_calls`, so `MessageItem.tsx:635` holds the pre-tools banner for the entire run.
  The advancing data is already inside a hook that same component already calls — **no backend change**
  — but consuming it crosses **PANEL-09**, a deliberate panel-only demux with a measured perf reason.
  **Ruling: accept the cost and state it explicitly.** The justification is that the re-render is
  **per-PHASE, not per-token** — a workflow run has a handful of phases, so the cost PANEL-09 was
  protecting against (token-rate re-renders) is **not the cost being incurred**. The plan MUST record
  the accepted cost **and the measured re-render count** beside PANEL-09's original reasoning, not over
  it. ⚠ **D-13's byte pin still binds: the `"Starting workflow…"` string is NOT edited.** The fix is
  the advancing mechanism; a plan that touches the copy has fixed nothing and broken a nine-phase-old
  pin.

### Claude's Discretion

- The exact wording of the stopped-state copy on each of the four mounts (constrained by D-14 and by
  `references/icon-convention.md` §4 for any canvas/spine mark).
- Whether the panel Stop is a per-run control or a per-phase one, provided it reads as stopping the
  RUN and cannot be confused with skipping a phase.
- Test-fence design, subject to the project's standing rule: **a fence is only real once you have
  watched it fail.** Every new fence is driven RED against a real plant in production source.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirement and its history
- `.planning/ROADMAP.md` §*Phase 194: Stop a Running Workflow* (`:491-503`) — goal, the three success
  criteria, and the **scope flag this CONTEXT measures WRONG** (`<domain>`).
- `.planning/REQUIREMENTS.md:70` — RUN-01 verbatim, and `:85`/`:87` for what depends on it
  (Phase 105 scheduled runs; the connections milestone, sequenced after RUN-01 on purpose).
- `.planning/STATE.md` §*PHASE 194 — TWO FINDINGS MEASURED 2026-08-16* — the pre-discuss findings;
  finding **1's inference is corrected in `<domain>`**, finding **2 (G-5) stands** and is D-01/D-02.

### The cancel path as it ships (read these before writing any cancel code)
- `backend/app/api/runs.py:1124-1200` — the `DELETE /runs/{run_id}` cancel verb and its four-arm
  contract (happy / zombie / terminal / cross-user), documented in the header comment.
- `backend/app/services/run_lifecycle.py:158-240` — `_cancel_run_internals`, the SHARED cancel /
  zombie-heal writer reused verbatim by the operator Kill path. **D-09/D-10 change this file.**
- `backend/app/services/run_producer.py:225-295` — the shielded finalize, the terminal-status
  classifier, and the **F2 harness terminalize** that already writes `cancelled` to `workflow_runs`.
- `backend/app/services/harness_engine.py:1615-1644` — the engine's `CancelledError` arm, the shielded
  ask_user expiry, and the 096-09 graceful-shutdown gate that must NOT be broken.
- `backend/app/db/workflows.py:1308-1338` — `finish_run`: the SINGLE authoritative anchor-clear site.
  ⚠ Its docstring says *"Terminal run status write (`completed` / `failed`)"* — the F2 caller already
  passes `"cancelled"`, so **the docstring is narrower than the function**; correct it beside, not over.

### Schema
- `supabase/migrations/115_workflow_phases_recorded_not_sent.sql` — **the template for D-05.** Read its
  header in full: the re-typed-`ARRAY` trap, the slug-not-prose rule, and the shape of its negative control.
- `supabase/migrations/063_dual_mode_continue.sql:50-57` — the current `runs` and `workflow_runs`
  status CHECKs; `workflow_runs` already admits `cancelled`.
- `supabase/migrations/057_workflow_runs.sql:19` — the original `workflow_runs` CHECK.
- `supabase/SETUP.md` — migration application story (D-06).

### The surfaces
- `frontend/src/components/panel/WorkspacePanel.tsx` — the primary Stop home; **G-5 fires** (D-01).
- `frontend/src/components/chat/RunCard.tsx:534,548` — the shipped `cancelled` vocabulary;
  **G-5 fires** (D-01).
- `frontend/src/components/chat/ActiveRunsTray.tsx:16-132` — the per-run Stop + Stop-all precedent and
  its *"one durable cancel path"* rule (D-08).
- `frontend/src/providers/StreamsProvider.tsx:2400-2416` — `stopThread`, and the
  `runStatus === "streaming"` scan that BUG-260815-04 may defeat.
- `frontend/src/components/chat/MessageInput.tsx:403-416` + `ChatArea.tsx:361` — the composer Stop.
- `frontend/src/lib/api.ts:1249-1267` — `cancelRun`, incl. its deliberate swallow of a
  cancelled-by-another-tab error.
- `frontend/src/lib/toolMeta.ts:92` + `toolMeta.test.ts:30` — ⚠ **the byte-pinned banner string. Do
  not reword** (D-13).

### Reported bugs (frontmatter must be updated at plan time)
- `.planning/reported-bugs/BUG-260815-07-cannot-delete-a-workflow.md` — FOLDED, reproducible half only.
- `.planning/reported-bugs/chat-stuck-on-starting-workflow-with-duplicate-icon.md` (BUG-260815-04) — FOLDED.
- `.planning/reported-bugs/BUG-260808-02-approval-hands-off-to-chat.md` — FOLDED, with a scope fence.
- `.planning/reported-bugs/workflow-run-history-not-reachable-from-canvas.md` (BUG-260815-03) —
  **DEFERRED to 195** with the trigger in D-15.

### Project rules that bind this phase
- `CLAUDE.md` § *Workflow guardrails* + the **hot-file ledger** — D-01/D-02.
- `CLAUDE.md` § *UAT scoreboard recipe* — the 4-axis bandwidth. ⚠ **194 touches streaming, the agent
  loop and UI state, so SC#10 fires: the full native roster + OpenRouter (8 rows), derived from
  `MODEL_CAPABILITIES`, never re-typed.**
- `CLAUDE.md` § *Parallel execution* — worktrees ON; `GSD_VITEST_MAX_WORKERS=2`; ⚠ **rule 4 binds
  hard here: any plan whose tests MUTATE the local database must be SERIALIZED** (D-12's heal and the
  migration both do).
- `.claude/skills/sketch-findings-agentic-rag/` — the run-surface, phase-spine and panel design
  decisions; `references/icon-convention.md` §4 before drawing any canvas/spine mark.

</canonical_refs>

<code_context>
## Existing Code Insights

### The three gaps — one per success criterion

| # | SC | Gap, as measured |
|---|---|---|
| **G-A** | SC#1 *"can stop from the run surface"* | `WorkspacePanel.tsx` has **no Stop control at all**. Every shipped Stop keys off a streaming assistant message's `runId`, and `BUG-260815-04` reports the chat surface stuck pre-tools for the whole run — so the one control that exists may not be reachable during a workflow run |
| **G-B** | SC#2 *"reports `cancelled` honestly"* | `_cancel_run_internals` Step 3b heals **only** the `runs` row. `workflow_runs` stays `active`, the anchor stays set, the thread wedges. Measured consequence: **two runs stuck `active` since 2026-06-14 and 2026-08-01, a permanent delete blocker** |
| **G-C** | SC#3 *"no partial write presented as finished"* | `finish_run` writes the run row + anchor only; the in-flight `workflow_phases` row stays `active` forever. And `workflow_phases_status_check` has **no `cancelled` literal** |

### Reusable Assets
- **`_cancel_run_internals`** — the shared cancel/zombie-heal writer, already reused verbatim by the
  operator Kill path. Extend it; do not fork it.
- **`finish_run`** — already writes `workflow_runs.status` + clears the anchor in ONE transaction, and
  already accepts `"cancelled"` from the F2 caller. The zombie arm's workflow half should call it.
- **`finalize_run_terminal`** — the atomic status + mirror-ZREM co-write; the discipline D-10 mirrors.
- **`cancelRun` / `stopThread` / `ActiveRunsTray`** — the one durable frontend cancel path, three
  mounts already built. The fourth (panel) and fifth (library row) attach to the same call.
- **`RunCard`'s `cancelled` → `"■" / "cancelled"` mapping** — the vocabulary already exists.
- **Migration 115** — the exact ALTER-a-status-CHECK shape, with its own trap documented.

### Established Patterns
- **A harness run IS a producer run.** One task, one `runs` shell row, one `workflow_runs` row. Any
  new endpoint must respect that the cancellable unit is the producer task.
- **Terminal ordering:** durable Postgres write FIRST, then the Redis sentinel, every Redis op
  best-effort (D-062-13) — *"Postgres `runs.status` is the durable cancel record."*
- **Graceful shutdown is NOT a cancel.** `is_app_shutting_down()` gates both the F2 terminalize
  (096-09) and the ask_user expiry, so a restarting app leaves runs resumable for the boot sweep.
  ⚠ **Any new terminalize must carry the same gate or it will break restart-resumability** — that was
  UAT Test 2 in Phase 096.
- **`RUN_TASKS` is per-process** and `WORKER_COUNT=2` is the default, so the zombie arm is not an edge
  case — it is roughly half of all Stops that miss.

### Integration Points
- `run_lifecycle._cancel_run_internals` Step 3b → new `workflow_runs` co-write (D-09/D-10).
- A phase-terminalize write on the cancel path → new `cancelled` literal (D-04/D-07).
- `WorkspacePanel` spine → `cancelRun` (D-08 mount 1).
- The library row → `cancelRun` (D-08 mount 4).
- Whatever advances the chat surface out of pre-tools → BUG-260815-04, and possibly `stopThread`'s
  `runStatus` scan (D-08 mount 2).

</code_context>

<specifics>
## Specific Ideas

- **"Stop at any point" is to be taken literally.** The zombie case was explicitly pulled INTO scope
  rather than qualified away, on the grounds that a dead producer is exactly when a user most wants
  to stop. RUN-01 is not met by a Stop that works only on the happy path.
- **Honesty over convenience on the phase row.** Reusing `failed`/`skipped` to dodge a migration was
  offered and rejected in one move — *the phase did not fail and was not skipped; it ran and was
  interrupted.*
- **The history surface was declined, deliberately and with its cost stated** — a new surface inside a
  stop-control phase would land UI with zero prior review cycles.
- **The `"Starting workflow…"` string is not the bug.** Stated three times across this file on
  purpose, because the obvious "fix" is to reword it and that would break a nine-phase-old byte pin
  while changing nothing a user experiences.

</specifics>

<deferred>
## Deferred Ideas

- **D-15 — `BUG-260815-03`, run history unreachable from the canvas → PHASE 195.** Its frontmatter
  becomes `status: deferred`, `folded_into: null`, with
  **`re_open_trigger: "the first phase that renders a completed workflow run's phases outside the
  chat thread"`**. Rationale: 194 gives the library row a Stop, which makes a **live** run actionable
  — but the operator's complaint was about a **completed** run's history after reopening the thread,
  which this phase structurally cannot close. Phase 195 (*Show the Deliverable*, RUN-02/03) must read
  a completed run's outputs from the run surface, so it is the natural home. ⚠ **It was FOLDED in the
  first pass and un-folded on measurement** — marking it `folded_into: 194` would have put a bug in
  the "claimed" state that the phase cannot address, which is the bookkeeping failure this project's
  ROADMAP keeps catching after the fact.
- **D-16 — The Workflows-page library-row Stop (former D-08 mount 4).** Descoped at plan time on a
  measured-false premise (there is no run id on the row or on the wire). **Trigger: *"the first phase
  that puts any live-run state on the library row"*.** Whichever phase takes it inherits
  `WorkflowsPage.tsx`'s standing G-5 obligation (`34 / 12 / 1176`) and owes the refactor
  recommendation FIRST.

- **The approval surface's home** — `BUG-260808-02` is folded only for *stopping a run waiting at an
  approval*. Moving approval off chat is a phase. Trigger: any plan whose fix requires relocating the
  approval checkpoint.
- **`BUG-260815-07`'s non-reproducible delete failure** — stays open. Trigger: a second sighting.
- **Scheduled / recurring runs + budget caps** (Phase 105 carry-forward,
  `.planning/v2.9-STRETCH-CARRYFORWARD.md`) — RUN-01 is their hard prerequisite; the spend-cap brake
  does not exist and is not built here.
- **Deep-run cancel behaviour** — untouched. Any change to it is a regression, not a deliverable.

</deferred>

---

*Phase: 194-stop-a-running-workflow*
*Context gathered: 2026-08-16*
