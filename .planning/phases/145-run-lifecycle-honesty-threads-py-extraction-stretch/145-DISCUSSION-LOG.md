# Phase 145: Run-Lifecycle Honesty + threads.py Extraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 145-Run-Lifecycle Honesty + threads.py Extraction
**Areas discussed:** Which signal wins, UI un-sticks itself, Catching dead runs live, Extraction breadth (+ BUG-260707-01 routing)

---

## Which signal wins (authoritative streaming truth)

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres `runs.status` | Keep runs.status as the frontend-facing truth (get_snapshot already returns it; refresh already self-heals Direction A). runs:active + reconciler + backpressure derive from / agree with it. | ✓ |
| Re-plumb onto `runs:active` | Expose runs:active to the frontend (new endpoint/SSE field) per the original requirement wording. Bigger change, new frontend→server-set coupling, needs runs:active perfectly maintained. | |
| Stream liveness is truth | Make stream last-event age the oracle both signals reconcile against. Larger rethink. | (folded into "Catching dead runs live") |

**User's choice:** Postgres `runs.status` (Recommended).
**Notes:** Supersedes the FND-01 / ROADMAP "runs:active is the single source of truth" wording (pre-trace hypothesis, corrected by `c12ff264`). FND-01 text to be updated at plan time.

### Follow-up: role of `runs:active`

| Option | Description | Selected |
|--------|-------------|----------|
| Derived mirror, one atomic owner | Extracted module writes runs.status + runs:active together per transition, so runs:active == {runs streaming} by construction. Consumers unchanged but drift-proof. | ✓ |
| Demote to advisory hint | Keep runs:active as best-effort telemetry; switch reconciler + backpressure to check runs.status directly. Changes two shipped consumers, loses O(1) ZCARD. | |

**User's choice:** Derived mirror, one atomic owner (Recommended).
**Notes:** This is the core anti-drift fix and the reason the extraction matters — today the ZADD/ZREM live in different code paths than the status writes (how they got out of sync).

---

## UI un-sticks itself (Direction A — phantom running)

| Option | Description | Selected |
|--------|-------------|----------|
| Client inactivity watchdog | While running, no SSE bytes for N sec → reconcile getSnapshot → finalize if terminal. Only option that catches the observed tab-open-16-min / no-close-event case. Reuses _isTransientStreamEnd plumbing + tab-focus belt. | ✓ |
| Tab-focus + reconnect only | Reconcile on visibilitychange + SSE reconnect. No timer. FAILS the observed case (tab open, no refocus). | |
| Backend heartbeat SSE | Server emits periodic keepalive; client treats missing beats as trigger. More robust, more backend surface, couples to Direction B. | |

**User's choice:** Client inactivity watchdog (Recommended).

### Follow-up: self-heal UX

| Option | Description | Selected |
|--------|-------------|----------|
| Silent finalize | Reconcile runs quietly; UI transitions straight to done if terminal, no banner. No flicker on watchdog ticks. Matches refresh behavior today. | ✓ |
| Brief 'reconnecting…' state | Transient indicator during the reconcile fetch. More transparent but risks flicker on slow runs. | |

**User's choice:** Silent finalize (Recommended).
**Notes:** Watchdog window N ~20s default, tunable — short window is safe because it only reconciles, never kills.

---

## Catching dead runs live (Direction B — dead producer)

| Option | Description | Selected |
|--------|-------------|----------|
| Periodic sweep on stream age | Extend run_reconciler.py to run on an interval; liveness oracle = run:{id} stream last-event age (not runs:active membership, now a mirror). Terminalize non-terminal-PG runs stale > STALE_TIMEOUT. No schema. | ✓ |
| Heartbeat column + sweep | Producer writes runs.last_heartbeat every few sec; sweep flips stale rows. Adds migration + write-hot column (scope says no schema). | |
| Boot-only, accept the live gap | Keep 137.1 boot-only sweep; Direction B only heals on next reboot. Rejected — operator watched a dead run sit 'streaming' 6+ min live. | |

**User's choice:** Periodic sweep on stream age (Recommended).
**Notes:** REQUIRED (not optional) — since runs.status is authoritative, the frontend watchdog can't fix a lying status; only a backend mechanism can. Two timeouts by design: backend STALE_TIMEOUT generous/conservative (2–5 min, it kills) vs frontend watchdog short (it reconciles). WORKER_COUNT=2 single-flight via the existing SET NX guard.

---

## Extraction breadth (G-5 paydown)

| Option | Description | Selected |
|--------|-------------|----------|
| Chat-run lifecycle now; module is shared home | Extract threads.py chat-run lifecycle (start + terminal + atomic runs.status+runs:active writer) into a tested module; reuse finalize_run; eval/tuner keep their writes this phase; follow-up seed for their migration. Red-line-safe. | ✓ |
| Full consolidation now (all 5 writers) | Route chat + evals + runs + skill_tuner + eval_runner through one module. True single-owner, but touches shipped surfaces, bigger blast radius, higher D-14 risk. | |
| Move-only, no atomic-writer unification | Relocate code to satisfy G-5 mechanically without unifying the two writes. Rejected — leaves the drift bug. | |

**User's choice:** Chat-run lifecycle now; module is shared home (Recommended).

---

## BUG-260707-01 routing (composer flips Stop→Send + feedback mid-run on transient reattach)

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into 145 | Same _isTransientStreamEnd path; UI must not flip to 'done' affordances until runs.status terminal. Add VALIDATION row. Low added scope. | ✓ |
| Leave open, revisit later | Keep 145 tight; treat as separate follow-up. Risk: same code path, touched anyway without a guarding test. | |

**User's choice:** Fold into 145 (Recommended).

---

## Claude's Discretion

- Exact module name / file location for the extracted run-lifecycle owner (planner's call; `run_reconciler.py` / `skill_tuner.py` naming precedent).
- Whether the periodic sweep is a dedicated lifespan task or folded into an existing scheduler (`harness_engine.resume_stranded_workflows` precedent).
- Exact values for watchdog N, backend STALE_TIMEOUT, and sweep interval (researcher/planner to pin with evidence).

## Deferred Ideas

- Migrate eval / tuner / eval_runner run-lifecycle writers onto the shared extracted module (follow-up SEED; re-open on any eval/tuner `runs:active` drift or next G-5 touch of those files).
- `last_heartbeat` schema column (rejected — no schema this phase; re-open if stream-age proves insufficient).
- Full 5-writer consolidation in one phase (rejected — red-line risk / blast radius).
- `spike-nl-workflow-authoring.md` todo — reviewed, NOT folded (keyword false-positive, unrelated).
- BUG-260607-02 ("Setting up agent…" latency masking) — left open, different domain.
