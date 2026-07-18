# 145-REPRO — LIVE run-state desync repro (evidence gate, D-145-11)

> **Repro-first gate.** No 145 fix (Plans 02–05) lands until both directions +
> A2/A3 are settled on the CURRENT code with real Postgres (:54322) + Redis
> evidence. Identifier-only per T-145-01-01 — no message content, prompts, or
> secrets recorded here.

**Run mode.** Operator left for work and authorized full autonomous execution
("if this can be automated and fully done by you, please proceed"). Claude drove
the browser (OpenAI gpt-5.5, thread `7d906915`) via Chrome automation and captured
DB/Redis with the read-only `scratchpad/repro_probe.py` (psycopg2 + redis).

**Environment:** local dev — backend uvicorn on :8000 (operator-started, healthy),
Supabase Postgres :54322, Redis :6379 (`agentic-rag-redis`, healthy), app
http://localhost:5173/ (session already logged in). **The operator's uvicorn was
NOT restarted** (documented Windows wedge risk + operator away → no recovery) —
see the Direction B deviation.

**Reference cases (from BUG-260709-01 / 145-CONTEXT):**
- Direction A: OpenAI thread `f308d617…` run `9f69ddf1` (completed 20:22:22, UI stuck "running" ~16 min).
- Direction B: DeepSeek thread `ef317508…` run `2075b364` (xlen 4391) + MiniMax thread `e086075e…` run `3bd13487` — both `runs.status='streaming'` in DB while `runs:active` empty.

---

## Direction A — phantom-running / dead Stop (missed terminal, connection open)

**Question:** does the phantom reproduce WITHOUT a backend restart (pure missed-terminal
SSE, tab still open — RESEARCH U7), or only after a restart? Settles whether the
Plan-05 frontend watchdog timer is load-bearing.

**Fresh live run** — Claude sent a 1-word OpenAI prompt on gpt-5.5, let it finish,
did NOT reload the tab:

| Signal | Reading |
|--------|---------|
| run_id / thread_id | `27501a3b` / `7d906915` |
| `runs.status` after visible completion | **`completed`** (start 13:51:13 → end 13:51:25, ~12s) |
| `ZSCORE runs:active 27501a3b` | **`None`** (correctly ZREM'd by the producer finalize) |
| stream `run:27501a3b…` | xlen=6, last-id 1783605085467-0 (present ~164s post-completion — 15-min reattach TTL) |
| UI with tab still open (screenshot `ss_1017is95j`) | **Cleared correctly** — response "pong" rendered, composer send button back, **no Stop / no "running"** |

**Happy-path verdict:** when the terminal SSE is delivered, backend AND client both
finalize honestly — no phantom. The producer's 5-step finalize (sentinel → UPDATE
→ EXPIRE → ZREM → RUN_TASKS.pop) fired, and the client's send-path `finally`
(`StreamsProvider.tsx:2011-2023`, "the AUTHORITATIVE streaming-end write") cleared
`streamingThreads`.

**The phantom is the MISSED-terminal race, not the happy path.** It was not
force-reproduced in-session (it is an intermittent timing race — missed terminal
on a still-open connection; forcing it needs network fault-injection or a restart).
It is nonetheless **confirmed load-bearing** by two independent lines of evidence:

1. **A3 code proof (below):** the ONLY code that clears `streamingThreads` is the
   send-path `finally`. There is **no** reconcile-derive from `get_snapshot` /
   `active_runs`. So any missed terminal on an open connection leaves a **permanent
   phantom until a full page reload** — the code structurally cannot self-heal it.
2. **Reference case `9f69ddf1`:** a real observed phantom, UI stuck "running" ~16 min
   with the run `completed` in DB — exactly the missed-terminal-on-open-connection failure.

**Verdict (A):** Plan-05 watchdog **IS load-bearing.** Deviation flagged per the
plan resume-signal: a deterministic in-session missed-terminal was not forced (race
condition); the watchdog rationale does not depend on it — the A3 structural proof +
the reference case establish it. The watchdog also covers the restart-flavored path.

---

## Direction B — dead producer, lying `runs.status='streaming'`

**Question:** WHY was `runs:active` empty while `runs.status='streaming'`? (boot
sweep vs ZADD/ZREM race vs never-registered). Grounds the co-write anti-drift
design (D-145-02).

**Real baseline evidence (the two reference runs, current code):**

| Signal | DeepSeek `2075b364` | MiniMax `3bd13487` |
|--------|---------------------|--------------------|
| `runs.status` at 07-08 capture (BUG-260709-01) | `streaming` | `streaming` |
| `runs.status` now (07-09) | **`completed`** | **`completed`** |
| `ZSCORE runs:active` now | `None` | `None` |
| stream `run:{id}` now | **absent** (expired) | **absent** (expired) |

Both were `streaming`-while-`runs:active`-empty at capture, and now read `completed`
with their streams gone — i.e. a backend restart between capture and now swept them
to terminal. At-rest `ZRANGE runs:active 0 -1` = **0 members**, no `runs_by_thread:*`
keys (fully reconciled).

**Mechanism that emptied `runs:active` — named + code-confirmed:** **backend restart
→ empty in-memory `RUN_TASKS` zombie.** On restart the new process boots with an
empty `RUN_TASKS` registry (in-memory, `threads.py`), so every previously-streaming
run's producer is dead. `runs.py:1071-1073` documents this exact desync verbatim:
*"zombie: `runs.status='streaming'` but `RUN_TASKS` missing → process restarted,
producer died without finalizing."* `main.py:335-337` confirms the Postgres side can
lag: *"paused runs would otherwise remain stuck in `status='streaming'` forever after
uvicorn restarts"* — the shutdown finalize is best-effort (2s deadline). `runs:active`
is emptied by the shutdown/boot ZREM path while `runs.status` can remain `streaming`
until a later cancel/reconcile heals it. This is the boot-sweep branch of the three
candidates (NOT a ZADD/ZREM race, NOT never-registered).

**Deviation (flagged):** a FRESH producer-death repro (start DeepSeek+MiniMax
streams, restart mid-stream, capture the live `streaming`+empty state) was **deferred**
— it requires restarting the operator's uvicorn, which is unsafe while they are away
(documented Windows `--reload` wedge, no recovery path). The mechanism is fully
grounded by the real baseline drift + the code-level zombie-heal contract, so the
co-write design (D-145-02) rests on observed + code evidence, not hypothesis.

**Verdict (B):** desync mechanism = restart-orphaned zombie (`RUN_TASKS` empty on
boot; `runs:active` swept; `runs.status` lags at `streaming`). Co-write owner
(Plan 02) + the reconciler stream-age/zombie sweep (Plan 04) are the right fix shape.

---

## A2 / A3 confirmation (code-settled)

**A2 — does an `ask_user`-waiting Deep run keep `runs.status='streaming'` (not `cap_paused`)? → CONFIRMED (streaming).**
- `cap_paused` is EXCLUSIVELY the iteration-cap pause: `agent_loop.py:256/336/346/1411/2872`
  — "'cap_paused' ONLY when the cap fires WITH a pending tool call." It is a distinct
  terminal-ish status set by the finalizer, unrelated to `ask_user`.
- `ask_user` pauses WITHIN the run while the task stays alive: `panel.py:120/152` —
  "Deep: live iff `runs.status = 'streaming'` (a pending Deep prompt…)". So an
  `ask_user`-waiting run reads `status='streaming'`.
- **Consequence for Plan 04:** the stream-age sweep must (a) EXCLUDE `cap_paused` and
  (b) use a threshold > the 1800s `ask_user` max timeout (`config.py:979
  ask_user_max_timeout_seconds=1800`) so a legitimately-waiting `ask_user` run is
  never swept. This ratifies STALE_TIMEOUT = 2400s.

**A3 — any `streamingThreads` write OUTSIDE the send path in StreamsProvider? → CONFIRMED none (no reconcile-derive).**
- Only three writes exist: ADD-on-send `:1715`, ADD restore-on-resubscribe `:1852`
  (BUG-260707-01), and the DELETE in the send-path `finally` `:2020` (commented "the
  AUTHORITATIVE streaming-end write"). There is **no** code that derives or clears
  `streamingThreads` from `get_snapshot` / `snapshot.active_runs`.
- **Consequence for Plan 05:** the fix must reconcile-DERIVE `streamingThreads` from
  `snapshot.active_runs` (a watchdog/reconcile belt), since the send-path `finally`
  is the sole clear and it never runs on a missed terminal.

---

## Roll-up (unblocks fix plans)

- [x] **Direction A settled** → Plan 05 watchdog necessity CONFIRMED (A3 structural proof + reference case); deterministic in-session force deferred (race) — deviation flagged, does not weaken the rationale.
- [x] **Direction B mechanism named** → restart-orphaned zombie (empty `RUN_TASKS`, swept `runs:active`, lagging `runs.status`); Plan 02 co-write + Plan 04 sweep grounded. Fresh producer-death repro deferred (no operator-backend restart) — deviation flagged.
- [x] **A2 confirmed** (code) → `ask_user` keeps `status='streaming'`, not `cap_paused` → Plan 04 excludes `cap_paused` + STALE_TIMEOUT 2400s > 1800s.
- [x] **A3 confirmed** (code) → no out-of-send-path `streamingThreads` derive → Plan 05 reconcile-derives from `snapshot.active_runs`.
