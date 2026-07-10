---
phase: 145
slug: run-lifecycle-honesty-threads-py-extraction-stretch
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-10
---

# Phase 145 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> FND-01 — run-lifecycle honesty + G-5 `threads.py` extraction. Inverts the run-state
> authority model (Postgres `runs.status` authoritative; Redis `runs:active` a derived
> mirror), extracts an atomic run-lifecycle owner (`run_lifecycle.py`), re-points
> `threads.py`/`runs.py` onto it, adds a periodic stream-age staleness sweep to the
> reconciler, and derives the frontend `streamingThreads` set from the authoritative
> snapshot. Mechanism-swap phase: no new route, no schema change, no package install.
> The load-bearing security properties are (a) the extraction must NOT move or weaken
> the pre-existing cross-user ownership gates and cancel side-effects, and (b) the new
> staleness sweep must NEVER false-kill a legitimately-live-but-quiet run.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| authenticated request → `threads.py` get_snapshot ownership SELECT | Cross-user IDOR gate; must fire before any messages/runs leak | `thread_id` + `current_user["id"]` |
| authenticated request → `runs.py` DELETE `/runs/{id}` ownership SELECT | Cross-user cancel gate; 404-not-403 existence hiding | `run_id` + `current_user["id"]` |
| already-authorized caller → `run_lifecycle` owner | Pure service module; owner takes pre-authorized `run_id`/`thread_id`/`user_id` — no route, no request handling, no cross-user lookup | trusted identifiers from the caller |
| caller-supplied `error` string → RLS-readable `runs.error` | Terminal/reconcile note written verbatim into an RLS-readable column | short identifier reason strings |
| Redis stream liveness (`xinfo_stream`/`redis.time()`) → orphan predicate | Stream freshness decides whether a non-terminal run is terminalized | `last-generated-id` age vs STALE_TIMEOUT |
| authoritative `snapshot.active_runs` → frontend `streamingThreads` | Client Stop affordance derived from server truth, never a local flag | `run.status` per active run |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-145-01-01 | Information Disclosure | 145-REPRO.md capturing run rows | mitigate | REPRO.md commits to identifier-only evidence in its header banner (`145-REPRO.md:5-6` "Identifier-only per T-145-01-01 — no message content, prompts, or secrets recorded here"). All captured signals are run_id/thread_id/`runs.status`/timestamps/stream-age (xlen, last-id) — e.g. the Direction A/B tables (`:35-46`, `:73-97`). No real user prompts, KB content, tokens, or secrets recorded. Residual advisory below (a single synthetic `"pong"` echo from Claude's own 1-word self-test — not sensitive data). | closed |
| T-145-01-SC | Tampering (supply chain) | package installs | accept | No installs in Plan 01 (observation/REPRO only — psycopg2/redis-cli reads against local dev instances). `145-01-SUMMARY.md` introduces no new dependency. See AR-145-03. | closed |
| T-145-02-01 | Information Disclosure | error string → RLS-readable `runs.error` | mitigate | `run_lifecycle.py` writes the caller-supplied `error` verbatim through the shared `finalize_run` writer (`:140-149`) and logs NOTHING containing message bodies or tracebacks. The module's ONLY logging call is the best-effort mirror-ZADD failure path, which logs `run_id` only (`:106-110`). Owner docstring codifies the T-073-04 discipline ("callers pass short identifier/reason strings, never tracebacks" `:33-36`). | closed |
| T-145-02-02 | Tampering (partial co-write) | status write ok, Redis ZADD/ZREM fails | accept | Owner stays thin; a missed mirror write is eventually self-healed by the Plan-04 reconciler stream-age sweep. The eventual-consistency invariant is documented in the module docstring: INVARIANT block (`run_lifecycle.py:18-21`), THINNESS/best-effort block (`:30-36`), and the CR-01 comment ("the stale-stream sweep reconciles any run left out of the mirror" `:95-101`). See Accepted Risks Log AR-145-01. | closed |
| T-145-02-EoP | Elevation of Privilege | owner bypassing ownership checks | accept | `run_lifecycle.py` is a pure service module — NO route decorator, NO FastAPI dependency, NO cross-user lookup. Both public functions take pre-authorized `run_id`/`thread_id`/`user_id` kwargs from already-authenticated callers (`threads.py:1118` after auth; `runs.py:1181` AFTER the ownership SELECT at `:1107-1119`; `run_reconciler` from a trusted boot/periodic context). It is NOT wired as an unauthenticated entry point. See AR-145-02. | closed |
| T-145-02-SC | Tampering (supply chain) | package installs | accept | No installs — first-party module reusing installed `redis`/`asyncpg`. `145-02-SUMMARY.md` tech-stack `added: []`. See AR-145-03. | closed |
| T-145-03-01 | Info Disclosure / EoP | cross-user cancel/snapshot | mitigate | Ownership SELECTs PRESERVED (404-not-403, T-062-01). `runs.py` cancel: `.eq("user_id", …).maybe_single()` → 404 (`runs.py:1107-1119`). `threads.py` get_snapshot: ownership SELECT fires FIRST with `.eq("user_id", …).maybe_single()` → 404 before any messages/runs read (`threads.py:381-393`). Neither was moved or weakened by the re-wire — only the terminal WRITER changed. | closed |
| T-145-03-02 | Tampering | cancel side-effects (lock/sentinel) | mitigate | `cancel_lock` SETNX preserved: `redis.set(f"run:{run_id}:cancel_lock", "1", nx=True, ex=60)` (`runs.py:1225-1237`); synthetic sentinel gated on the lock (`:1238-1247`); `EXPIRE` 60s (`:1256-1261`). Only the terminal writer swapped to `finalize_run_terminal('cancelled')` (`:1181-1189`); every ownership/lock/short-circuit/EXPIRE control is byte-identical. | closed |
| T-145-03-03 | Tampering (cross-worker cancel) | `task.cancel` in-process under WORKER_COUNT=2 | accept | Pre-existing gap unchanged: the happy-path Stop still calls in-process `task.cancel()` on the owning worker's `RUN_TASKS` (`runs.py:1154`); a Stop on the non-owning worker falls to zombie-heal. NO new cross-worker cancel code was added (the `publish_cancel_sentinel` at `:1149` is the pre-existing Phase-085 ask_user wake, not a task-cancel bus). Flagged → SEED-109. See AR-145-04. | closed |
| T-145-03-04 | Information Disclosure | error strings → RLS-readable `runs.error` | mitigate | Cancel/spawn-fail errors are short identifiers, never tracebacks: `error="cancelled_by_user"` (`runs.py:1187`), `error="spawn_failed"` (`threads.py:1141`). | closed |
| T-145-03-SC | Tampering (supply chain) | package installs | accept | No installs. `145-03-SUMMARY.md` tech-stack `added: []`. See AR-145-03. | closed |
| T-145-04-01 | Tampering (self-inflicted false-orphan) | `_is_chat_orphan` on a Redis hiccup | mitigate | Only a `no such key` `ResponseError` means orphan; ANY other exception is RAISED (`run_reconciler.py:287-290`) and propagates to the per-row handler which logs + SKIPS the row (`:250-251`) — never flips on unverifiable liveness (Pitfall 6). The eval oracle `_is_orphan` has the same skip-on-raise posture (`:303-312`). | closed |
| T-145-04-02 | Tampering (false-kill of live-but-quiet run) | STALE_TIMEOUT too low | mitigate | `run_stale_sweep_timeout_seconds = 2400` (`config.py:1002`) exceeds the 1800s `ask_user_max_timeout_seconds` ceiling (`:985`) + covers the ~900s reasoning ceiling; `run_start_grace_seconds = 60` start-grace guards a just-started run (`config.py:1015`; enforced `run_reconciler.py:281-284`). `cap_paused` EXCLUDED from the periodic sweep — `main.py:338` passes `include_cap_paused=False` → `run_reconciler.py:217` narrows the candidate set to `["streaming"]`. Config-driven bounds validator rejects a sub-ceiling timeout / sub-5s interval at boot (`config.py:1017-1045`, WR-02). | closed |
| T-145-04-03 | DoS / correctness (sweep double-run) | WORKER_COUNT=2 periodic ticks | mitigate | `SET NX run_reconcile_lock` guard: `redis.set(_RECONCILE_LOCK_KEY, "1", nx=True, ex=lock_ttl)`; loser returns 0 (`run_reconciler.py:129-132`). Periodic caller passes `lock_ttl=90` (`main.py:337`) < the 120s `run_stale_sweep_interval_seconds` tick (`config.py:1003`) so the guard self-expires before the next tick → exactly one worker sweeps per tick. | closed |
| T-145-04-04 | Information Disclosure | reconciler note → RLS-readable `runs.error` | mitigate | Notes are short, identifier-only constants — never a traceback: `_ERROR_CHAT = "failed: orphaned — stream stale, reconciled by staleness sweep"` (`run_reconciler.py:90`), `_ERROR_EVAL = "interrupted: orphaned by backend restart (reconciled at boot)"` (`:89`). Field comment pins the <200-char T-073-04 discipline (`:86-88`). | closed |
| T-145-04-SC | Tampering (supply chain) | package installs | accept | No installs. `145-04-SUMMARY.md` tech-stack `added: []`. See AR-145-03. | closed |
| T-145-05-01 | Tampering (client trusts stale local flag) | `streamingThreads` as truth | mitigate | `streamingThreads` is DERIVED from the authoritative `snapshot.active_runs` (`runs.status`) on every reconcile: `hasStreamingRun = activeRuns.some(r => r.status === "streaming")` drives both the add and the guarded delete (`StreamsProvider.tsx:1462-1496`). The watchdog `probeThread` re-fetches via `getSnapshot` (`:2745`) and checks `active_runs.some(r => r.status === "streaming")` (`:2751`) — the local flag never decides. WR-01: the silent finalize derives the HONEST persisted terminal status from `snapshot.messages`, not a hardcoded "completed" (`:2724-2736`). | closed |
| T-145-05-02 | DoS (getSnapshot churn) | watchdog too-aggressive probing | accept | ONE shared `setInterval(tick, WATCHDOG_TICK_MS=5000)` (`StreamsProvider.tsx:154`, `:2778`); a thread is probed only after `WATCHDOG_INACTIVITY_MS=20000` of silence (`:155`, `:2771`); the sweep early-returns when `streamingThreads.size === 0` (`:2764-2765`) and is bounded by that set size. No per-run timer is created. See AR-145-05. | closed |
| T-145-05-03 | Tampering (clobber in-flight send) | derive deleting a thread mid-send | mitigate | Every `streamingThreads` delete is guarded by `sendingThreadsRef.current.has(threadId)` — the reconcile-derive delete (`StreamsProvider.tsx:1488`), the watchdog `finalizeThreadSilently` (`:2706`), and the watchdog `tick` (`:2769`) all skip a thread with an in-flight send, which owns its own send-path `finally` streaming-end write. | closed |
| T-145-05-SC | Tampering (supply chain) | package installs | accept | No new npm packages. `145-05-SUMMARY.md` tech-stack `added: []`. See AR-145-03. | closed |
| T-145-06-01 | (n/a — docs) | `.planning/*.md` edits | accept | Documentation-only (FND-01 correction + SEED). No executable code, no runtime surface, no trust boundary crossed (`145-06-SUMMARY.md:88`). See AR-145-06. | closed |
| T-145-06-SC | Tampering (supply chain) | package installs | accept | No installs. See AR-145-03. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-145-01 | T-145-02-02 | The atomic owner is thin by design: the Postgres `runs.status` INSERT/finalize is the fatal authoritative write; the two mirror ZADDs/ZREMs are best-effort. A partial co-write (status lands, mirror op fails) is NOT a hard failure — it is eventually reconciled by the Plan-04 stream-age sweep (`run_reconciler._reconcile_chat_runs`), which trusts `runs.status` and re-issues the ZREM through the same owner. `runs:active` is a derived liveness mirror, never the chat authority (D-145-01/02). Under WORKER_COUNT=2 the drift window is bounded by `run_stale_sweep_interval_seconds` (120s). This is the intended eventual-consistency invariant, documented in `run_lifecycle.py:18-36,95-101`. | operator | 2026-07-10 |
| AR-145-02 | T-145-02-EoP | `run_lifecycle.py` introduces no new attack surface: it has no HTTP route, no auth dependency, and performs no cross-user lookup. It is called only by already-authorized code paths (`threads.py` send handler after `get_current_user`; `runs.py` cancel AFTER its ownership SELECT; the boot/periodic reconciler). It cannot be reached by an unauthenticated request. | operator | 2026-07-10 |
| AR-145-03 | T-145-0{1,2,3,4,5,6}-SC | This phase installs no new packages (backend or frontend). Every SUMMARY declares `tech-stack.added: []`. The owner and reconciler reuse the already-installed `redis`/`asyncpg`; the frontend adds no npm dependency. No supply-chain surface introduced. | operator | 2026-07-10 |
| AR-145-04 | T-145-03-03 | Cross-worker cancel of an in-process `asyncio` task under WORKER_COUNT=2 is a PRE-EXISTING gap, explicitly out of scope for this honesty/extraction phase and NOT fixed here. A Stop issued on the worker that does not hold the run's `RUN_TASKS` entry falls through to the zombie-heal terminal write (still honest — the run is terminalized + the mirror ZREM'd), it just does not synchronously interrupt the live task on the owning worker. No new cross-worker cancel code was added that would change this surface; the happy-path `task.cancel()` remains in-process. Flagged with a concrete re-open trigger → SEED-109. | operator | 2026-07-10 |
| AR-145-05 | T-145-05-02 | The client watchdog cannot storm `getSnapshot`: it is a single shared 5s interval that probes a thread only after 20s of inactivity, early-returns on an empty `streamingThreads` set, and is bounded by that set's size (typically 1). No per-run timer is created, so probe volume scales with concurrently-streaming threads, not with runs or events. The probe itself is a read-only reconcile-via-fetch. | operator | 2026-07-10 |
| AR-145-06 | T-145-06-01 | Plan 06 is documentation-only (the FND-01 wording correction + SEED-109 authoring). It touches no executable code, adds no route/handler, and crosses no trust boundary. Nothing to mitigate. | operator | 2026-07-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-10 | 22 | 22 | 0 | gsd-security-auditor (opus, verify-mitigations mode) + orchestrator (added omitted T-145-01-SC register row) |

**Unregistered flags:** None. No SUMMARY carries a `## Threat Flags` section (the tooling emits one only when new attack surface is detected). Each of `145-02/03/06-SUMMARY.md` instead carries a `## Threat Register Coverage` section that maps every touched surface to a registered T-145 ID and explicitly states "No new threat surface introduced beyond the plan's `<threat_model>`" (`145-02-SUMMARY.md:102`, `145-03-SUMMARY.md:140`, `145-06-SUMMARY.md:88`). Plans 04/05 introduce only the reconciler sweep + frontend derive already enumerated in the register. No new/unmapped attack surface reported.

**REVIEW fix verification:** `145-REVIEW.md` found 5 findings (2 critical, 2 warning, 1 info), all marked resolved. The four security-/correctness-relevant fixes are CONFIRMED present in executable code (not merely documented):
- **CR-01** (`47ccbf67`, resilience — a transient Redis mirror-ZADD failure must not hard-fail the send) — verified: the two mirror ZADDs are wrapped in a best-effort `try/except` that logs `run_id` and continues (`run_lifecycle.py:102-110`). Reinforces the AR-145-01 posture; the Postgres INSERT stays the fatal write.
- **CR-02** (`06035f6b`, the direct reinforcement of T-145-04-02 — missing-stream false-kill) — verified: `run_start_grace_seconds=60` (`config.py:1015`) enforced as the first check in `_is_chat_orphan` (`run_reconciler.py:281-284`), and `started_at` is now selected + threaded (`:220`, `:231-233`) so a just-started run past-INSERT-but-pre-first-`_emit` is SKIPPED, not killed.
- **WR-01** (`11080aa4`, reinforces T-145-05-01 honesty) — verified: `finalizeThreadSilently` derives the honest persisted terminal status from `snapshot.messages` rather than hardcoding "completed" (`StreamsProvider.tsx:2724-2736`).
- **WR-02** (`b817fd30`, reinforces T-145-04-02/03) — verified: `_validate_run_stale_sweep_bounds` `model_validator` rejects a sub-`ask_user`-ceiling timeout and a sub-5s interval at boot (`config.py:1017-1045`).
- **IN-01** (`a7b64365`, dead-import cleanup) — cosmetic, no security impact.

**Residual advisories (NOT threat gaps — every declared mitigation is present in executable code):**
- `145-REPRO.md:40` records a single synthetic `"pong"` word (the response to Claude's own deliberately-trivial 1-word "ping" self-test run), noted only as UI-cleared evidence. This is a self-authored synthetic token, not a real operator prompt, KB document, token, or secret, and does not constitute sensitive-content disclosure under T-145-01-01 / T-073-04. Weighed and judged non-material; the identifier-only discipline is otherwise fully honored.
- Three live-infra integration tests (`test_062_delete_zombie.py`, `test_062_redis_down.py`, `test_066_terminal_classification.py`) still assert the pre-145-03 supabase cancel writer and are deferred (`deferred-items.md` → D-145-03-DEFER-01). This is test-maintenance debt behind a no-live-infra constraint, not a mitigation gap — the cancel semantics themselves are proven by the self-contained `test_cancel_run.py` unit file.

---

## Sign-Off

- [x] All 22 threats have a disposition (mitigate / accept / transfer)
- [x] Each `mitigate` threat proven by file:line evidence in executable code
- [x] Each `accept` threat verified free of contradicting code and logged in the Accepted Risks Log
- [x] The extraction preserves the T-062-01 ownership SELECTs (404-not-403) and cancel side-effects — grep + line-level confirmed
- [x] The staleness sweep's false-kill guards (2400s timeout, 60s start-grace, cap_paused exclusion, config bounds validator) confirmed present
- [x] The 4 security-/correctness-relevant REVIEW fixes (CR-01, CR-02, WR-01, WR-02) verified fixed in code
- [x] No unregistered attack-surface flags in any SUMMARY
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-10
