# Phase 145: Run-Lifecycle Honesty + threads.py Extraction - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the chat's run-state signal ("is it running? / can I Stop it?") authoritative and honest in **both** directions, and pay down the overdue G-5 debt by extracting the run-lifecycle logic out of the 2,226-line `backend/app/api/threads.py` into a dedicated, unit-tested module.

**In scope:**
- Pick ONE authoritative streaming signal and make every other representation agree with it (kill the three-signal drift).
- Direction A fix: a finished run must finalize the UI with no phantom "running" / dead Stop, even when the terminal SSE event is missed.
- Direction B fix: a genuinely-streaming run must show a working Stop; a dead-producer run (backend restart / broken SSE) must be detected and terminalized instead of showing a live-but-dead stream.
- Extract chat-run lifecycle into a tested module that atomically owns the authoritative status transition.
- Fold BUG-260709-01 (the phase's raison d'être), extend BUG-260702-02 (boot→live), fold BUG-260707-01 (transient-reattach affordance honesty).

**Out of scope (do NOT do here):**
- New run-lifecycle features / new run states / new UI surfaces (honesty + correctness only).
- Migrating eval / tuner / eval_runner run-lifecycle writers onto the new module (deferred — see Deferred Ideas).
- A `last_heartbeat` schema column (no schema this phase — stream-age is the liveness oracle).
- Forking the shared Deep chat path (red line D-14).

</domain>

<decisions>
## Implementation Decisions

### Authoritative signal (the reshaping decision)
- **D-145-01:** **Postgres `runs.status` is THE authoritative "is this run streaming?" signal.** The frontend already derives `isStreaming` from it via `get_snapshot` (`threads.py` ~:364 / :413-423; `StreamsProvider` ~:232), and a browser refresh already self-heals Direction A precisely because that SELECT returns `[]` once `completed`. **This SUPERSEDES the FND-01 / ROADMAP wording that named Redis `runs:active` as the single source of truth** — that wording came from the pre-trace hypothesis (`c12ff264` corrected it). The FND-01 requirement text should be updated to reflect this at plan time.
- **D-145-02:** **`runs:active` becomes a DERIVED MIRROR, not a source of truth.** The extracted owner writes `runs.status` and `runs:active` **together on every transition** (register on start / ZREM on terminal), so `runs:active == {runs WHERE status='streaming'}` by construction. Existing consumers keep reading it (admin backpressure `ZCARD` `api/admin.py:72`) but it can no longer drift from the truth. This co-write is the core anti-drift fix — today the ZADD/ZREM live in different code paths than the status writes, which is exactly how they got out of sync (observed: `runs:active` empty while `runs.status='streaming'`).

### Direction A — UI self-heals a phantom-running run
- **D-145-03:** **Client inactivity watchdog** is the trigger. While a run shows "running", if the SSE produces no bytes for N seconds, fire a reconcile `getSnapshot`; if `runs.status` is not `streaming`, finalize the UI to done. This is the ONLY mechanism that catches the observed case (tab open 16 min, NO `done`/`error`/close event ever arrived, so the existing close-triggered `_isTransientStreamEnd` path never fired). Add **reconcile-on-tab-focus** (`visibilitychange`) as a cheap additive belt. **Reuse the existing `_isTransientStreamEnd` / `getSnapshot` reconcile plumbing** — just add the timer trigger.
- **D-145-04:** **Silent finalize** — no banner, no "reconnecting…" state. If the reconcile confirms terminal, the UI transitions straight to the finished state (final answer + done affordances); if still streaming, nothing changes. Avoids flicker on every watchdog tick during a legitimately-slow run; matches how a refresh already silently fixes it.
- **D-145-05:** Watchdog inactivity window N is a **short** window (default ~20s, tunable) — safe because it only RECONCILES (never kills). Researcher/planner to pin the exact value with evidence (long legit gaps = code-exec / long tool calls).

### Direction B — backend corrects a lying `runs.status` (dead producer)
- **D-145-06:** **Periodic + boot staleness sweep**, extending `run_reconciler.py` to also run on an interval (not just boot). The liveness oracle is the **`run:{run_id}` stream's last-event age**, NOT `runs:active` membership — because `runs:active` is now a derived mirror (D-145-02) and can no longer detect orphans (a genuine orphan HAS `status='streaming'` and would be PRESENT in the mirror). A run non-terminal in PG whose stream has produced no new events in > `STALE_TIMEOUT` is terminalized to `failed` via the atomic owner (which also ZREMs `runs:active`). **No schema** (reuses the existing Redis stream).
  - *Why this is REQUIRED, not optional:* since `runs.status` is authoritative (D-145-01) and Direction B is literally "`runs.status` is lying," the frontend watchdog CANNOT fix it (it trusts `runs.status`). Only a backend mechanism can correct a lying status.
- **D-145-07:** **Two timeouts by design.** Backend sweep `STALE_TIMEOUT` is **generous / conservative** (e.g. 2–5 min, longer than any legitimate tool/code-exec gap) because it KILLS. The frontend watchdog N (D-145-05) is short because it only RECONCILES. Do not conflate them.
- **D-145-08:** The periodic sweep must be **WORKER_COUNT=2 single-flight-safe** — reuse the existing boot `SET NX` guard pattern (`run_reconcile_lock`) so exactly one worker sweeps per tick (D-PRD-12).

### Extraction (G-5 paydown)
- **D-145-09:** **Extract the chat-run lifecycle** (start register + terminal + the atomic `runs.status` + `runs:active` writer) out of `threads.py` into a **dedicated, unit-tested module** — the atomic owner from D-145-02. **Reuse `backend/app/db/runs.py:finalize_run`** as the terminal writer so reattach/cancel/reconciler parity holds. Build it with a clean API so eval/tuner/eval_runner CAN adopt it next, but do NOT migrate them this phase (red-line-safe — shipped surfaces untouched). File a follow-up seed for their migration.

### Bug folding + cross-cutting constraints
- **D-145-10:** **BUG-260707-01 folded** — the composer flipping Stop→Send + 👍/👎 feedback appearing mid-run after a transient reattach is the same affordance-honesty defect on the same `_isTransientStreamEnd` path. Contract: the UI must NOT flip to "done" affordances until `runs.status` is actually terminal. Add a VALIDATION row so it's verified, not assumed.
- **D-145-11:** **LIVE repro BEFORE the fix** (locked from scope). Reproduce, via DB + Redis, (i) why `runs:active` was empty during Direction B (restart-swept vs ZADD race vs reconciler `_drop_stream`), and (ii) whether Direction A reproduces WITHOUT a restart (pure missed-terminal-SSE) or only after one. Operator drives the repro.
- **D-145-12:** **Red line (D-14)** — all fixes additive / at the boundary. The extracted module is new; shipped eval/tuner/Deep chat paths are not forked.
- **D-145-13:** **SC#10 UAT** — cross-provider × UI-state × parallel-thread. The desync was seen cross-provider (OpenAI = Direction A; DeepSeek + MiniMax = Direction B), so UAT must exercise both directions across providers + a parallel-thread row (Thread A streaming while Thread B accepts a prompt). Authored under VALIDATION.md.
- **D-145-14:** **"Stop actually cancels" scope note** — the observed bug was Stop *absent* (Direction B) or *dead/no-op because nothing to cancel* (Direction A), not present-but-broken cancel. Treat cancel-correctness as covered by the existing `runs.py` cancel path + the now-honest affordance (Stop shows iff genuinely live). Researcher should VERIFY the cancel path works end-to-end cross-provider; do not assume new cancel logic is needed.

### Claude's Discretion
- Exact module name / file location for the extracted run-lifecycle owner (planner's call; `run_reconciler.py` and `skill_tuner.py` are naming/precedent analogs).
- Whether the periodic sweep is a dedicated lifespan task or folded into an existing scheduler (`harness_engine.resume_stranded_workflows` is the interval-sweep precedent).

### Folded Todos
None — the only `todo.match-phase` hit was a keyword false-positive (see Reviewed Todos below).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The bug + corrected root cause (read FIRST)
- `.planning/reported-bugs/BUG-260709-01-run-state-stop-button-desync.md` — **the corrected static root-cause trace (`c12ff264`)**: three drifting signals, two directions with DIFFERENT causes, and the explicit finding that the frontend does NOT read `runs:active`. This reshaped the whole phase. MANDATORY.
- `.planning/reported-bugs/BUG-260702-02-in-flight-runs-orphaned-on-backend-restart-no-reconciliation.md` — restart-orphan class (folded into 137.1's boot sweep; 145 extends it to a LIVE sweep).
- `.planning/reported-bugs/BUG-260707-01-composer-and-feedback-flip-to-done-mid-run-on-transient-reattach.md` — folded into 145 (D-145-10).

### The code being changed / extended
- `backend/app/services/run_reconciler.py` — the shipped BOOT reconciler to EXTEND (periodic + stream-age oracle). Note its current orphan predicate ("absent from `runs:active`") becomes unsafe under D-145-02 and must switch to stream-age.
- `backend/app/api/threads.py` — extraction source: `runs:active` ZADD :1125, ZREM :1138 (spawn-fail) / :1721 / :2209 (terminal); `get_snapshot` :364 / :413-423 (the Postgres `runs.status` reconcile read).
- `frontend/src/providers/StreamsProvider.tsx` — `_isTransientStreamEnd` (~:194) + reattach helper (~:238) + `isStreaming` derive (~:232); the watchdog + tab-focus reconcile land here.
- `backend/app/db/runs.py` — `finalize_run` (the shared terminal writer the extracted module + reconciler must reuse for parity).
- `backend/app/api/admin.py:72` — `ZCARD runs:active` backpressure (a `runs:active` consumer; stays unchanged, just drift-proof now).

### Requirement / roadmap / conventions
- `.planning/REQUIREMENTS.md` — **FND-01** (wording to be updated per D-145-01: `runs.status` authoritative, `runs:active` derived).
- `.planning/ROADMAP.md` — Phase 145 details + Scope note (root-cause CORRECTED `c12ff264`).
- `CLAUDE.md` — run-buffer key conventions (`runs:active`, `runs_by_thread:{tid}`, `run:{run_id}`); D-v2.5-03 (Realtime is a hint — reconcile via fetch on reconnect); D-v2.5-01 (`run_in_threadpool` for blocking supabase-py); D-PRD-12 (multi-worker singleton audit).

### Other `runs:active` writers (future adopters — NOT changed this phase)
- `backend/app/api/evals.py` (:315 / :1915 / :2624), `backend/app/api/runs.py` (:1247 zombie-heal), `backend/app/api/skill_tuner.py` (:643 / :738), `backend/app/services/eval_runner_service.py` (:864).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`run_reconciler.py`** — near-copy of `harness_engine.resume_stranded_workflows`; already has the `SET NX` single-flight guard, `run_in_threadpool` wrapping, best-effort per-row try/except, and `finalize_run` terminal-write parity. Extend it (interval trigger + stream-age oracle) rather than writing new.
- **`_isTransientStreamEnd` / `getSnapshot` reconcile plumbing** (StreamsProvider, Phase 075.1) — the snapshot-probe-and-finalize path already exists; the watchdog only needs to add a *timer* trigger for the missed-terminal case.
- **`db.runs.finalize_run`** — the one terminal writer used by the live producer AND the reconciler; the extracted owner must route terminal writes through it.
- **`SET NX` guard pattern** (`run_reconcile_lock`) — reuse for the periodic sweep's single-flight.

### Established Patterns
- **Atomic co-write** (new): status transition + `runs:active` membership must move as one unit in the extracted owner.
- **Reconcile-on-reconnect** (D-v2.5-03) — the watchdog is an extension of this: reconcile via fetch, never trust the live signal as truth.
- **Per-thread streaming Set** (Phase 075.4) — `isStreaming` is a per-thread Set delete, not a global boolean; the watchdog must respect per-thread state (parallel threads).
- **Blocking I/O off the event loop** — supabase-py via `run_in_threadpool` (D-v2.5-01); asyncpg is natively async (`_reconcile_chat_runs` uses the pool directly).

### Integration Points
- Extracted module ← consumed by `threads.py` (start + terminal), and its stream-age oracle ← consumed by `run_reconciler.py`.
- Periodic sweep ← a lifespan-spawned interval task (precedent: `harness_engine.resume_stranded_workflows`).
- Frontend watchdog timer ← lives in StreamsProvider alongside the existing per-run stream handling; fires `getSnapshot`.
- `admin.py` ZCARD backpressure ← unchanged consumer of `runs:active` (now drift-proof).

</code_context>

<specifics>
## Specific Ideas

The two operator-observed repros are the reference cases for the LIVE repro (D-145-11) and the SC#10 UAT (D-145-13):
- **Direction A:** OpenAI thread `f308d617-04a6-4c59-b4c2-30d381b64a86`, run `9f69ddf1` completed 20:22:22, UI stuck "running" + dead Stop 16 min later; refresh reconciled.
- **Direction B:** DeepSeek `ef317508…` run `2075b364` (xlen 4391) and MiniMax `e086075e…` run `3bd13487` — both `status='streaming'` in DB while `runs:active` empty → no Stop. MiniMax (off the DeepSeek/openai_compat path) rules out the 2026-07-08 change as cause.

</specifics>

<deferred>
## Deferred Ideas

- **Migrate eval / tuner / eval_runner run-lifecycle writers onto the shared extracted module** — the true single-owner end-state (no `runs:active` write anywhere but the module). Deferred out of 145 to keep shipped eval/tuner paths untouched (red line). **Plant as a follow-up SEED** with re-open trigger = "any future `runs:active` drift observed on eval or tuner runs, or the next G-5 touch of evals.py/skill_tuner.py."
- **`last_heartbeat` schema column** — rejected this phase (no schema; stream-age is the oracle). Re-open trigger = stream-age proves insufficient (e.g., a provider that legitimately produces zero stream events for > STALE_TIMEOUT).
- **Full 5-writer consolidation in one phase** — rejected (red-line risk / blast radius). Superseded by the incremental adopt-later design (D-145-09).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.6) — keyword false-positive ("template / phases / run / case / 2026"); unrelated to run-lifecycle honesty. Not folded.

### External / left-open
- **BUG-260607-02** ("Setting up agent…" hides model activity) — open, but a dispatch-latency-masking problem, a different domain from run-state honesty. Left open, NOT folded.

</deferred>

---

*Phase: 145-Run-Lifecycle Honesty + threads.py Extraction*
*Context gathered: 2026-07-09*
