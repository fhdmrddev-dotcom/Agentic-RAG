---
title: Migrate the eval / tuner / eval_runner `runs:active` writers onto the shared `run_lifecycle` owner
seed_id: SEED-109
status: planted
planted: 2026-07-09
planted_during: v3.2 STRETCH (Phase 145 — Run-Lifecycle Honesty + threads.py extraction)
trigger_when: The eval / tuner / eval_runner run-lifecycle writers still ZADD/ZREM `runs:active` in their own code paths outside the shared `run_lifecycle` owner — migrate them onto it so the `runs:active == {status='streaming'}` invariant is GLOBAL, not just chat-scoped.
scope: Medium
related: [[Phase 145]], run_lifecycle.py, [[project_foundation_pass_cross_provider_uat]], [[SEED-096]] (bundle-fidelity lineage — same shared-owner adopt-later shape), api/evals.py, skill_tuner.py, eval_runner_service.py
re_open_trigger: "any future `runs:active` drift observed on eval or tuner runs, OR the next G-5 touch of evals.py / skill_tuner.py"
surface: Agentic-RAG
---

# SEED-109: Migrate the eval / tuner / eval_runner `runs:active` writers onto the shared `run_lifecycle` owner

> **Foundation lineage (2026-07-09).** Phase 145 (FND-01) made the run-state signal
> honest by shipping ONE atomic owner for the chat/Deep run lifecycle. This seed captures
> the deliberately-deferred rest — the true single-owner end-state — plus two adjacent
> gaps parked in the same phase, each with a concrete re-open trigger so nothing is lost.

## The gap

Phase 145 (Plan 02) created `backend/app/services/run_lifecycle.py` — the atomic owner
that co-writes a run's Postgres `runs.status` **and** its `runs:active` sorted-set mirror
**together** on every transition (`register_run_start` / `finalize_run_terminal`), so the
mirror can no longer drift from the authoritative status (D-145-01/02). Plan 03 re-pointed
the `threads.py` chat producer (start + terminal) and the `runs.py` cancel zombie-heal onto
it; Plan 04 routed the reconciler stream-age sweep through it.

But the owner's INVARIANT — `run_id ∈ runs:active ⇔ runs.status == 'streaming'` — is
**CHAT-SCOPED this phase, not global** (D-145-12, and the owner's own docstring calls this
out: *"A future reader must NOT assume a global invariant."*). The eval / tuner / eval_runner
run-lifecycle writers still ZADD/ZREM `runs:active` in their own code paths, in DIFFERENT
places than their status writes — exactly the split-path shape that let chat runs drift in
the first place (BUG-260709-01, 145-REPRO Direction B). Those writers can still get out of
sync; the anti-drift guarantee simply does not cover them yet.

**The five deferred writer paths** (the true single-owner end-state migrates each onto
`register_run_start` / `finalize_run_terminal`):

- `backend/app/api/evals.py` — companion run rows: **:315 / :1915 / :2624**
- `backend/app/services/skill_tuner.py` — tuner runs: **:643 / :738**
- `backend/app/services/eval_runner_service.py` — eval_runs: **:864**

(These are the five logical writer paths named in `run_lifecycle.py`'s docstring:
`eval_runner_service.py` eval_runs, `run_reconciler._reconcile_eval_runs` boot eval sweep,
`skill_tuner.py` tuner runs, `api/evals.py` companion rows, and the `agent_loop.py`
`cap_paused` non-terminal transition.)

**Explicitly excluded — already migrated:** `runs.py:1247` (the cancel **zombie-heal**) was
adopted onto the owner in Phase 145 **Plan 03** (RESEARCH U4 extraction note — it is a
chat-run terminal writer). Do NOT re-count it here.

## Why it was deferred

Red line (D-14 / D-145-12): all of Phase 145's fixes are additive and boundary-safe — the
extracted module is new, and the shipped eval/tuner/Deep-chat surfaces are NOT forked.
A full 5-writer consolidation in one phase was rejected (blast radius / red-line risk) in
favour of the incremental adopt-later design (D-145-09): build the owner with a clean
`pool`/`redis`-DI API so eval/tuner/eval_runner CAN adopt it next, but do not migrate them
this phase. That "next" is this seed.

## Sketch of the migration

For each writer path, replace the inline `insert_run` + `ZADD` (start) and
`finalize_run` + `ZREM ×2` (terminal) with a single `register_run_start` /
`finalize_run_terminal` call, threading the same `pool`/`redis`. Once all five adopt it,
the invariant becomes GLOBAL — `runs:active` is written in exactly one module, nowhere else
— and admin backpressure (`api/admin.py:72` `ZCARD`) + the reconciler sweep can trust it for
every run kind, not just chat. Mind the non-terminal `cap_paused` transition in
`agent_loop.py`: it is NOT a true terminal and must keep its row in the active sets (route
it away from `finalize_run_terminal`, per the owner's docstring).

## Also deferred here (two adjacent gaps parked in Phase 145)

Both were surfaced + dispositioned during Phase 145 and left OUT of its scope on purpose.
Recorded with their own concrete re-open triggers so they are not silently lost.

### 1. Cross-worker cancel gap (Open Q1 — FLAGGED, not fixed in 145)

`task.cancel()` is **in-process**: it only works if `RUN_TASKS[run_id]` lives on the SAME
worker that receives the Stop. Under `WORKER_COUNT=2` (CLAUDE.md default), a Stop routed to
the *other* worker finds `RUN_TASKS` empty → falls to the zombie-heal (marks the DB
`cancelled`) while the **live producer keeps running** on the first worker — and may then
overwrite `cancelled` with `completed` at its own terminal, since `finalize_run` has **no
CAS**. The only cross-worker signal today is `publish_cancel_sentinel`, which wakes an
`ask_user` pause only (`ask_user_service.py:241`), not the main agent loop. Phase 145 records
this as accepted threat `T-145-03-03` and exercises it in the cancel-path UAT, but ships no
fix (honesty/extraction scope only). A future fix would add a `run:{id}:cancel` pub/sub the
producer subscribes to (+ a CAS on the terminal write).
**re_open_trigger:** "a live run is not cancellable when Stop lands on the non-owning worker."

### 2. `last_heartbeat` schema column (rejected this phase)

The Direction-B backend sweep uses the **`run:{run_id}` stream's last-event age** as its
liveness oracle (D-145-06) — no schema. A dedicated `last_heartbeat` column on `runs` was
considered and rejected: stream-age already answers "is this producer alive?" without a
migration, and the config-driven `STALE_TIMEOUT` (2400s, > the 1800s `ask_user` / 900s
reasoning legit-silence windows) keeps legitimately-quiet runs from being swept.
**re_open_trigger:** "stream-age proves insufficient — a provider legitimately emits zero
stream events for longer than `STALE_TIMEOUT` (so a real live run would be falsely swept),
requiring an explicit heartbeat write."

## Breadcrumbs

- `backend/app/services/run_lifecycle.py` — the shared owner (`register_run_start` /
  `finalize_run_terminal`); its docstring enumerates the five deferred writers and states
  the chat-scoped-not-global caveat.
- `backend/app/api/evals.py` :315 / :1915 / :2624 · `backend/app/services/skill_tuner.py`
  :643 / :738 · `backend/app/services/eval_runner_service.py` :864 — the migration targets.
- `backend/app/api/runs.py` :1247 — zombie-heal, ALREADY migrated (Phase 145 Plan 03); excluded.
- Grounding: 145-CONTEXT `<deferred>` + D-145-09/12, 145-RESEARCH §U4 (Open Q1) and
  §"Open Questions" resolutions (2026-07-09), 145-REPRO Direction B (the observed drift).
