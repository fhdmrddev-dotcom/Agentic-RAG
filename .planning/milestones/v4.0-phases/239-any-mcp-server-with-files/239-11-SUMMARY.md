---
phase: 239
plan: 11
subsystem: backend/settings-cache
title: "BUG-260902-06 — settings and model-override invalidation crosses the worker boundary"
bug: BUG-260902-06
related_seeds: [SEED-258]
base_commit: 66320828d
date: 2026-09-09
---

# Phase 239 Plan 11: cross-worker cache invalidation — Summary

Settings and model-registry cache invalidation now crosses the process boundary over one Redis
pub/sub channel; each worker re-warms on receipt. Both module globals with the identical defect
are covered, not one. **Proved with a real second interpreter** — the property under test is the
process boundary, and a single-process test would have passed against the broken code.

## Base

Landed on `1335b4b1a` (master ship commit) exactly as the brief predicted — reset to
**`66320828d`** and proceeded. `bash scripts/bootstrap-worktree.sh` ran first: `BOOTSTRAP OK`.

## The channel and the payload

**Channel:** `settings:cache-invalidate` — **one** channel, not one per scope, so the subscriber
count stays at exactly one per worker and a new scope needs no lifespan change.

```json
{"kind": "cache-invalidate", "scope": "app_settings", "origin_pid": 12345, "ts": 1757…}
```

`scope` ∈ `app_settings` | `model_overrides` | `all`. An unknown scope is refused on **both**
sides (publisher will not send it, subscriber drops it).

⚠ **`origin_pid` is diagnostic only and is deliberately NOT filtered on.** Pids are reused across
container restarts, so a collision would silently drop a real invalidation; the re-warm is
idempotent, so the writing worker doing one redundant re-read is the cheaper failure by a wide
margin. This is a decision, not an oversight.

## Where the subscriber starts and how it dies

`backend/app/main.py` lifespan, immediately after `_watch_service` and before `yield`:
constructed → `start()` (returns immediately; startup is **never** blocked on Redis) → parked on
`app_instance.state.settings_cache_subscriber`. Stopped as the **first** step after `yield`.

`stop()` sets an event, waits on the task under `asyncio.wait_for(..., 5.0)`, and cancels if it
overruns — a half-dead Redis socket cannot wedge shutdown. Both `start()` and `stop()` are
idempotent. Loop discipline follows the `ask_user_service.py` precedent: SUBSCRIBE first,
`get_message(timeout=1.0)` (never 0 — Pitfall 1), `aclose()` under `wait_for(2.0)` (Pitfall 3),
each cleanup step in its own try/except.

It is **deliberately unconditional** — no kill switch, unlike the scheduler/queue/watch trio
above it. A box with no Redis already degrades to the pre-existing TTL, so a flag would only add
a way to turn the fix off silently.

## ⛔ Re-warm, never merely invalidate

`apply_cache_invalidation` calls `refresh_settings_cache()` for `app_settings` (expire → re-read
→ re-expire), and invalidate-then-reload **both** `_load_model_overrides()` and
`load_all_model_overrides()` for the registry. Not the invalidate-only path — the file's own
docstring calls that "only half a contract", because `load_app_settings()` is sync and checks no
timestamp. **This is proved, not asserted:** planting `invalidate_settings_cache()` in place of
the re-warm fails both the unit fence and the cross-process test (Plant A below).

## Write seams that broadcast — and the two that deliberately do not

| Seam | File | Broadcasts |
|---|---|---|
| `save_app_settings()` | `user_settings.py` | ✅ — the single seam **every** `app_settings` write passes through, so SEED-258's `source_max_file_size_mb` ceiling is covered by construction |
| model **add** (`model.added`) | `admin.py:~1307` | ✅ |
| model **capability/enabled set** | `admin.py:~1489` | ✅ |
| disable-guard `invalidate_settings_cache()` | `admin.py:~1428` | ⛔ **no — by design** |
| lock-guard `invalidate_model_overrides_cache()` | `admin.py:~1561` | ⛔ **no — by design** |

The last two are **WR-03 READ-freshness** forcing, not writes: they exist so a guard cannot pass
on a stale cache. Broadcasting there would make every worker re-read the DB because one worker
wanted to check something. A future edit that "makes them consistent" would be a regression.
`admin.py:1268` and `:1463` are the only two writers to `model_capabilities_overrides` in the
codebase (grepped, not assumed).

## ⭐ Exactly what the cross-process test proves — and what it does not

`test_cross_process_publish_rewarms_the_other_processes_settings_cache` spawns a **real second
interpreter** (`subprocess.Popen([sys.executable, "-c", …])`) against a **real Redis**. The child
imports `app.models.user_settings` itself, so it has its **own** module globals. It seeds its
cache with `"stale-value"` and a timestamp of `now()` — the sibling worker mid-TTL, exactly the
state the bug describes — then subscribes and reports readiness. The **parent** publishes. The
child's own `load_app_settings()` must return the sentinel.

**IT PROVES:**
- The invalidation **crosses the process boundary**. The child asserts `pid != parent pid`.
- The receiving process runs the **re-warming** path — the assertion reads the **sync** reader
  `load_app_settings()`, which is the reader an invalidate-only fix cannot reach.
- **No TTL wait.** The child's timestamp was set to `now()`, and the assertion bounds elapsed
  time under 25 s against a 30 s TTL, so expiry cannot explain the result.
- It is **sensitive to the actual defect**: Plant A (re-warm → invalidate-only) turns it red.

**IT DOES NOT PROVE:**
- ⚠ **That the child read the real Postgres row.** Its `get_pg_pool` is a stub returning the
  sentinel. The test measures *message delivery + re-warm dispatch*, not DB content. A defect
  where the re-warm reads the wrong table or row would pass here.
- ⚠ **Anything about uvicorn's own worker supervision.** Two `Popen` children are not two uvicorn
  workers behind a socket-sharing parent. Process-boundary semantics are identical; process
  *management* is untested.
- ⚠ **Nothing about ordering or loss.** Redis pub/sub is fire-and-forget: a worker that is
  restarting, GC-paused past the message, or briefly disconnected **misses it silently** and
  falls back to its TTL. That is the designed floor, not a covered case.
- ⚠ **It is skipped without a real Redis** (`requires_redis`). A skip here means UNPROVEN, not
  passing — the skip reason says so in words. **On this run it RAN and PASSED.**
- The other 10 tests are **units of the mechanism**. None of them, alone or together,
  demonstrates the cross-process property; each says so in its own docstring.

## Fail-soft evidence — driven against a REAL dead port, not only mocks

`REDIS_URL=redis://127.0.0.1:6399` (nothing listening), real `get_redis()` client:

```
[1] settings read with Redis DEAD: 'ttl-path-value'  -> OK
[2] publish to dead Redis returned 0 in 1.00s (no raise) -> OK
[3] broadcast_settings_change with Redis DEAD completed; sync reader still 'ttl-path-value' -> OK
[4] subscriber alive-and-retrying against dead Redis: stopped=False
[4] stop() returned in 0.03s; stopped=True -> OK
[5] final settings read: 'ttl-path-value' -> OK
```

### ⭐ A second bug found by measuring rather than reasoning

The first implementation passed every fail-soft assertion — **and took `2.05s` to do it.**
redis-py retries under its own connect timeout, and that call sits inside `save_app_settings`,
i.e. on a user's **write request**. *"Never raises"* is not the whole contract: 2 s of dead air
on every save while Redis is down is a second bug wearing the first one's clothes, and the brief
says fail-soft must "never block a request".

Bounded at `1.0s` via `asyncio.wait_for` (`_PUBLISH_TIMEOUT_SECONDS`). RED first: against a Redis
that accepts and never answers, the test hung the full **30 s**. Re-measured after: **2.05 s →
1.00 s**. A missed broadcast already degrades to the 30 s TTL, so waiting longer buys nothing.

## RED drives, plants and hashes

**Initial RED:** all **10** tests failed against the shipped code (`10 failed` at `67040567c`).
**Bound RED:** `test_publish_is_BOUNDED_when_redis_hangs` hung 30 s, `1 failed in 30.97s`.

| Plant | Defect planted in the SHIPPED file | Fired |
|---|---|---|
| **A** | `settings_broadcast.py`: re-warm → `invalidate_settings_cache()` | ✅ `2 failed` — the cross-process test **and** the sync-reader fence |
| **B** | `main.py`: `SettingsCacheSubscriber(...)` → `None` | ⚠ **DID NOT FIRE** — see below |
| **B′** | same plant, strengthened fence | ✅ `1 failed` |
| **C** | write seams reverted to local-only invalidate | ✅ `1 failed` |

### ⚠ Plant B is the finding, not the footnote

The lifespan fence asserted `"SettingsCacheSubscriber" in src`. Planting the real defect left it
**GREEN** — the `import` line satisfied the substring. **A presence assertion cannot see content
drift.** This project already records that lesson (Phase 235, G-8); it cost a plant to re-learn.
The fence now asserts the **construction**, the `.start()` after it, the `app.state` parking and
the `.stop()` after `yield`, and the docstring describes the weaker version rather than quietly
replacing it. Committed separately (`d53a929cc`) so the failure is auditable.

### ⚠ Restore verification: md5 is NOT stable here, and that matters

`core.autocrlf=true` on this box. A file written LF and restored via `git checkout` comes back
**CRLF**, so its md5 changes while its content does not:

```
settings_broadcast.py  before plant (LF, as written)  366f5a8f9ae88a1177d670bb6701efff
settings_broadcast.py  after restore (CRLF, from git) af06901b53045cccb1a321cedd610e84
git diff HEAD --stat                                   (empty — blob identical)
```

**So restores are verified by git blob hash**, which is line-ending independent, plus an empty
`git diff HEAD`. Anyone re-running this and comparing working-tree md5s will see a false mismatch.

**Canonical blob hashes at restore (all plants restored, verified):**

```
backend/app/services/settings_broadcast.py            a351e85de5ee07187e8b2a1a364a1f441e30c150
backend/app/models/user_settings.py                   fd9915935429b3a80bb5e5ba2b697cd1cc172110
backend/app/main.py                                   8e040158c87cc91427d0212a4692fb1da930fa6c
backend/app/api/admin.py                              ef09ee885543a701f667f5cdb626f51fe30129c4
backend/tests/unit/test_239_…_invalidation.py         9043507d8e07aa44566d5117f61da300e4c38753
```

(`settings_broadcast.py` and the test file were legitimately changed *after* those hashes by the
publish-bound commit `55581b7b4`; the three others are unchanged from them.)

## Gates — verbatim

**Backend unit suite** (`pytest tests/unit -q --continue-on-collection-errors`, from `backend/`):

```
71 failed, 4260 passed, 2 xfailed, 2 xpassed, 44 warnings in 199.45s (0:03:19)
```

Ceiling is **71** with zero headroom — **held exactly.** `4249 → 4260` passed is `+11`, exactly
this plan's new tests.

**The failing SET was diffed, not the count.** Baseline re-measured *on this box, in this
worktree*, by reverting the three modified files to base and holding the two new files aside
(`71 failed, 4249 passed, 2 xfailed, 2 xpassed`):

```
before set: 71  after set: 71
NEW FAILURES : NONE
DISAPPEARED  : NONE
```

⚠ **The raw diff first reported a false delta**, exactly as the brief warned: pytest interleaved
`…unraisableexception.py:33: RuntimeWarning: coroutine 'AsyncMockMixin._execute_mock_call' was
never awaited` **into** a `FAILED` line for `test_071_1_threadpool_sweep.py`. Normalising (split
on the interleaved warning) resolves it. Nothing was `| tail`-ed — the set was captured whole.

**Hot-file ledger:**

```
hot-file ledger — 4 file(s) from the command line
  scan list: 237 rows · subject: 4 files · watched: 4
ledger gate OK — every watched file has a row.
```

(Before the fix it named `[no-row] backend/app/services/settings_broadcast.py`.)

**CLAUDE.md size:**

```
  CLAUDE.md   87713 chars   58.5% of limit  headroom   62287  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

## Re-derived triples — three rows were stale, one by fourteen phases

Derived with the documented recipe in the commit that lands them, six-digit dated quick-task
buckets dropped:

| File | Row said | **Measured 2026-09-09** |
|---|---|---|
| `backend/app/main.py` | `79 / 45 / 876` | **`82 / 59 / 950`** — ⚠ stale by **14 phases** |
| `backend/app/api/admin.py` | `32 / 12 / 1733` | **`33 / 13 / 1740`** |
| `backend/app/models/user_settings.py` | `48 / 31 / 1460` | **`49 / 31 / 1524`** — stale at a **third** consecutive close |
| `backend/app/services/settings_broadcast.py` | *(no row at all)* | **`1 / 1 / 228`** |

Both `main.py` and `user_settings.py` **FIRE G-5** and are honoured by construction: one more
start/stop pair beside four existing ones; two short verbs beside the existing refresh/invalidate
pair, with **no reader signature changed**. Rows updated in CLAUDE.md **and** sections added to
`docs/HOT-FILE-LEDGER.md` in the same commit (same-commit sync rule), carrying the five binding
invariants and the named seam (*if a scope ever needs ordering/replay, that is a Redis **Stream**,
not a second pub/sub channel*).

## Commits

| Hash | Subject |
|---|---|
| `67040567c` | `test(239-11)` RED — the invalidation must cross the process boundary |
| `300da9e5d` | `feat(239-11)` settings + model-registry invalidation crosses the worker boundary |
| `d53a929cc` | `test(239-11)` the lifespan fence could not see its own defect |
| `01c501a9f` | `docs(239-11)` ledger rows re-derived — main.py was stale by fourteen phases |
| `55581b7b4` | `fix(239-11)` bound the publish — "never raises" is not the whole contract |

## ⛔ What I did NOT do — silence would read as done

- **No live multi-worker UAT.** I never started `uvicorn --workers 2` and watched an operator add
  a model. The proof is two `Popen` interpreters, which is the right *boundary* but not the
  shipped *arrangement*. **This is the single most valuable owed check** and should be the first
  thing run: start the backend with `WORKER_COUNT=2`, add a model in Settings, and hit the list
  repeatedly — the coin flip should be gone.
- **No frontend work at all**, per the brief. ⚠ The bug report's own "Not determined" list asks
  *"whether the frontend also caches the model list, which would extend the window"* — **still
  undetermined.** If it does, an operator may still see staleness and this fix will look
  incomplete.
- **No answer to the report's other open question** — whether the operator's *"it is not added"*
  case is ever **permanent** rather than TTL-bounded. If it is, there is a second defect behind
  this one and this fix will not close the report.
- **`SEED-258`'s `source_max_file_size_mb` is covered by construction, not by a test.** It rides
  `save_app_settings`, which broadcasts; I did not write a row proving that specific knob
  propagates.
- **No Redis Stream / durability.** A worker that is restarting or disconnected when the message
  fires **misses it** and waits out its TTL. Accepted deliberately: the TTL is the floor and the
  bug is that there was no ceiling.
- **No cloud/deploy artifacts touched.** No new env var was added, so `check-deploy-drift.sh` has
  nothing to sync — but I did not run it.
- **`ensure_settings_fresh()` left alone.** It is the per-worker TTL-bounding helper for gated
  reads; this fix makes it less necessary but I did not remove or re-point any caller.
- **Not pushed. `master` / `production` / `frontend/` untouched.**
- **No `.planning/STATE.md` or ROADMAP update** — this is a bug-fix plan run in a worktree; the
  reported-bug file's `status` is still `open` and should be flipped only after the live
  two-worker UAT above.

## Self-Check: PASSED

- `backend/app/services/settings_broadcast.py` — FOUND
- `backend/tests/unit/test_239_settings_cross_worker_invalidation.py` — FOUND
- `.planning/phases/239-any-mcp-server-with-files/239-11-SUMMARY.md` — FOUND
- Commits `67040567c`, `300da9e5d`, `d53a929cc`, `01c501a9f`, `55581b7b4` — all present in
  `git log`
