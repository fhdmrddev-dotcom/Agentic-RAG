---
phase: 306-ask-the-agent-and-run-workflows
plan: 02
subsystem: admission / inbound / settings
tags: [admission, redis, lua, idempotency, settings-knobs, inbound, fail-closed]
requires:
  - 306-01 (migration 223 knobs, key_run_start.validate_key_start)
provides:
  - backend/app/services/outside_admission.py::acquire / release (lease in org / credential / provider scopes)
  - backend/app/services/outside_admission.py::claim / bind / drop / idem_redis_key (D-05 idempotency)
  - OutsideStartUnavailable, Admitted, Full, Claimed, Starting, Existing
  - REASON / UNAVAILABLE_REASON / MCP_FULL_SENTENCE / INBOUND_FULL_SENTENCE / ASK_* / RUN_* constants
  - AppSettings mcp_ask_wait_seconds, outside_inflight_per_key / _per_org / _per_provider (GET/PUT /settings)
  - /inbound start admission (429 + Retry-After, 503 fail closed, on_finish release)
  - Settings → Integrations "Questions and runs from outside" group; admission activity words
affects: [306-04, 306-05]
tech-stack:
  added: []
  patterns:
    - "lease = sorted-set member scored by its own expiry, taken in three scopes by one Lua script"
    - "a key's EXPIRE only ever extends its life (TTL < ttl+60), so a short lease never drops a long one"
    - "idempotency claim: SET NX EX on credential + sha256(tool NUL key); bind SET XX; drop DEL"
key-files:
  created:
    - backend/app/services/outside_admission.py
    - backend/tests/unit/test_306_admission.py
    - backend/tests/unit/test_306_idempotency.py
    - backend/tests/unit/test_306_settings_knobs.py
    - backend/tests/unit/test_306_inbound_admission.py
    - backend/tests/integration/test_306_admission_redis_live.py
  modified:
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/app/api/inbound.py
    - backend/tests/unit/phase293_inbound_fakes.py
    - backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py
    - backend/tests/unit/test_settings.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - frontend/src/components/settings/ApiKeyLimits.tsx
    - frontend/src/components/settings/__tests__/ApiKeyLimits.test.tsx
    - frontend/src/lib/api/skills.ts
    - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
    - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
    - frontend/src/components/settings/apiKeys/__tests__/apiKeyFacts.test.ts
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "306-02: the lease script EXPIREs a scope key only when that EXTENDS its life (TTL < ttl+60) — the RESEARCH Pattern 7 script re-set it on every acquire, so an ask lease (900 s) taken after a run lease (1860 s) would drop the shared key while the run was still in flight; a live test pins it"
  - "306-02: bind never raises (the run already started); a failed bind drops the claim so a retry can start instead of reading 'starting' for a day"
  - "306-02: the admission reasons are constants in outside_admission.py, and apiKeyFacts.test reads them from that file's source, since the 293 reason scan only sees reason=\"...\" literals"
  - "306-02: each in-flight bound is its own `if not 1 <= body.x <= 50` block with its own range-refusal call — the two 242 fences detect bounds by AST shape and count helper calls"
metrics:
  duration: ~2 h 15 min (3 tasks, 9 commits; two full backend baseline runs and one full vitest gate)
  completed: 2026-11-01
---

# Phase 306 Plan 02: Outside-start admission and the four knobs Summary

Outside starts now take a lease in three Redis sorted sets (org, key, AI provider) through one
atomic Lua script, expire on their own if a worker dies, and are refused (fail closed) when Redis
cannot answer. `/inbound` starts use it today: a full scope gets a 429 with `Retry-After` and the
UI-SPEC sentence, Redis down gets a 503, both audited as `api_key.refused` with an `admission:*`
reason. The four limits are real `app_settings` knobs, edited in the operator's API keys card, and
an admission refusal reads in plain words in a key's activity. Idempotency claims (D-05) are built
and live-tested, ready for the MCP tools in 306-04 / 306-05.

## Tasks

| # | Task | RED commit | GREEN commit |
|---|------|------------|--------------|
| 1 | outside_admission.py: Lua lease acquire/release + idempotency claims, fail closed (D-35, D-17, D-05) | `8ca832694` | `1efcd8632` |
| 2 | Four knobs (backend) + admission in front of /inbound starts, 429 + Retry-After (D-04, D-36, D-16, D-19) | `5933ab840` | `52cf832a9` (+ fix `e2b312db2`) |
| 3 | Limits card group + admission activity words (frontend); count-gate pins, ledger, CLAUDE.md | `24935abf8` | `08e2f61e8`, docs `71f2b3d7b`, `11f2ea11c` |

## Evidence

**Task 1.** `test_306_admission.py` + `test_306_idempotency.py` + `test_306_admission_redis_live.py`:
**40 passed, no SKIPPED line** (the live suite FAILS rather than skips when Redis is down). Against
real Redis on 6379: two acquires on one key admit and the third is `Full("credential")`; five across
three keys of one org admit four, the fifth is `Full("org")`; a provider limit of 1 refuses a second
org's start as `Full("provider")`; a 1 s lease expires with no release; release frees the slot at
once; **20 concurrent acquires on one key with limit 2 admit exactly 2**; a 5 s lease taken after an
1860 s lease leaves every key's TTL > 1860; the idempotency lifecycle (Claimed → Starting → bind →
Existing(same / different request) → another credential Claimed → drop → Claimed) with TTL in
(86000, 86400]. Static: `grep -ci incr` = 0, `ZREMRANGEBYSCORE` = 1, `{adm}:` = 5, no `app.api` /
`agent_loop` / `run_producer` import; `RUN_LEASE_TTL_S == inbound._DEFAULT_MAX_DURATION + 60` pinned;
a fence reads `threads.py`, `workflow_kickoff.py`, `agent_loop.py` for any `outside_admission` mention.

**Task 2.** The two new suites + `test_293_inbound_start`, `_review_kill_switch`,
`_review_refusal_flood`, `_rate_limit`, `test_298_foreign_binding`, `test_305_settings_knob`,
`test_306_key_run_pure_move`, `test_293_inbound_status`, `_review_file_link`, `_review_bad_definition`,
`test_296_kickoff_and_keys`, `test_298_org_matrix`, `test_306_admission`, `test_306_idempotency`:
**287 passed**. Settings neighbours (`test_242_*` ×2, `test_settings`, `test_305_*`): 102 passed.
`user_settings.py` diff: 0 removed, 8 added. `outside_admission.acquire(` = 1, `on_finish=` = 1,
`Retry-After` = 3 in `inbound.py`. `node scripts/build-public-openapi.cjs --check`: OK.

**Task 3.** Targeted: `ApiKeyLimits.test.tsx` + `apiKeyFacts.test.ts` **74 passed**.
`data-outside-limits` = 1; the four `admission*` cases = 4 in `apiKeyFacts.ts`.

**Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, worktree root): **`count gate OK — 594/594 pinned
files present, no per-file decrease, 0 failing`**, `total 13715 · failed 0`. Pins raised:
`apiKeyFacts.test.ts` 43 → 50, `ApiKeyLimits.test.tsx` 14 → 24 (both read 50 / 24 in the run).

**Frontend typecheck, as a set diff** (`npx tsc -p tsconfig.app.json --noEmit`; the six changed
frontend files checked out at base `6e4e1e33e`, then restored): base 61 errors, HEAD 61 errors, the
sets are identical. The only textual difference is one pre-existing `SettingsPage.test.tsx` TS2322
whose elided count reads `... 68 more ...` instead of `... 64 more ...` (the four new optional
`FullAppSettings` fields lengthen the type it prints); same file, same code, same error.

**Backend unit baseline gate** (`node scripts/check-backend-unit-baseline.cjs`):
- First run: **73 failed — GATE FAILED.** Two were this plan's: `test_242_stored_value_refusal::…every_bound_site_routes_its_detail_through_it`
  (12 helper calls for 14 bounds — a shared wrapper hid two) and `test_276_openapi_snapshot_fresh`
  (the snapshot lacked the four settings fields). Both fixed in `e2b312db2`.
- Second run, at `e2b312db2`: **`71 failed, 11506 passed, 1 skipped, 2 xfailed, 2 xpassed` — GATE
  PASSED (71 ≤ 71), 0 collection errors.**
- Inherited, proven by id comparison rather than a written number: the 71 failing ids were re-run
  with this plan's eight modified backend/doc files checked out at base `6e4e1e33e`, then again at
  HEAD — **68 fail in both, the identical set (`diff` empty)**. The other 3 pass in isolation on both
  trees: the two `test_cross_worker_cancellation` ids (order-dependent, named by 306-01) and
  `test_email_ingestion::test_ingest_email_populates_metadata_and_attachments`, whose title comes
  from `embedding_service.extract_metadata` — a LIVE LLM call (`get_llm_client()`), so the result
  depends on network and prior client state. It passes as a whole file at HEAD (31 passed) and with
  every new 306-02 suite run in front of it (110 passed); no file on its path
  (`api/documents.py`, `ingest_enrich.py`, `embedding_service.py`) is touched by this plan.

**Neutrality:** `git diff 6e4e1e33e --stat` on `threads.py`, `agent_loop.py`,
`provider_gateway/dispatcher.py`, `run_producer.py`, `workflow_kickoff.py`, `unattended_launch.py`,
`frontend/src/lib/api.ts`, `frontend/src/pages/SettingsPage.tsx`: empty.

**Ledger and size gates:** `check-hot-file-ledger.cjs 306` OK; `check-claude-md-size.cjs` OK.
`ApiKeyLimits.tsx` now fires (`3 / 3 / 320`) and gained a CLAUDE.md row and a named seam.

**Local-DB lock:** taken with noclobber (`306-02 1630 2026-10-31T19:42:37Z`) before the live Redis
suite; released after the second baseline run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The research lease script could drop a running run's lease**
- **Found during:** Task 1
- **Issue:** Pattern 7 runs `EXPIRE key ttl+60` on every acquire. Ask (900 s) and run (1860 s)
  leases share the org / credential / provider keys, so an ask taken after a run would shorten the
  key's life to 960 s and the whole set (with the run's lease) would vanish while the run still ran.
- **Fix:** `if redis.call('TTL', KEYS[i]) < life then redis.call('EXPIRE', KEYS[i], life) end`; a
  live test asserts every key's TTL stays > 1860 after a 5 s lease follows an 1860 s one.
- **Commit:** `1efcd8632`

**2. [Rule 3 - Blocking] The 293 shared fakes had no admission**
- **Found during:** Task 2
- **Issue:** every 293/296/298 inbound suite drives the start route; with admission in place their
  `FakeRedis` has no `eval`, so every start would read 503.
- **Fix:** `phase293_inbound_fakes.audit_spies` (which all of them call) now patches
  `outside_admission.acquire` to admit, `release` to a mock, and `resolve_owner_run_model` to
  `(None, None)`. `test_306_inbound_admission.py` overrides these to drive the refusals.
- **Commit:** `5933ab840`

**3. [Rule 1 - Bug] Two 242 fences could not see the new bounds**
- **Found during:** Task 2 (first fence) and the backend baseline run (second fence)
- **Issue:** a loop over field names hid the three in-flight bounds from the AST bound detector; the
  shared wrapper that replaced it hid two of three helper calls from the helper-count fence.
- **Fix:** three explicit `if not 1 <= body.<field> <= 50:` blocks, each calling
  `_range_refusal_detail` itself; the comment no longer contains the helper's call text (it was being
  counted). Deliberate pin updates: the 242 expected bounded-field set (+4) and `test_settings.py`'s
  response stub (+4 fields).
- **Commits:** `52cf832a9`, `e2b312db2`

**4. [Rule 3 - Blocking] The committed OpenAPI snapshot went stale**
- **Found during:** the backend baseline run (`test_276_openapi_snapshot_fresh`)
- **Fix:** `scripts/export-openapi.py` then `scripts/build-public-openapi.cjs`; the diff in both files
  is exactly the four new settings fields on the response and update schemas.
- **Commit:** `e2b312db2`

**5. [Rule 1 - Inherited red repaired] The 293 reason scan fell to 13 at this plan's base**
- **Found during:** Task 3 RED
- **Issue:** `apiKeyFacts.test.ts` "every refusal reason the backend audits has words" scans
  `inbound.py` for `reason="..."` literals; 306-01 moved the start checks to `key_run_start.py`
  (where reasons are `KeyStartRefusal("...", ...)` arguments), so the scan read 13 < 15 and was red
  at base `6e4e1e33e` (inbound.py has 6 such literals at base and HEAD, 15 at `c3a5ea888`).
- **Fix:** the scan also reads `key_run_start.py` by its `KeyStartRefusal("` shape.
- **Commit:** `24935abf8`

**6. [Plan path] The ApiKeyLimits test lives under `__tests__/`**
- The plan listed `frontend/src/components/settings/ApiKeyLimits.test.tsx`; the shipped suite is
  `frontend/src/components/settings/__tests__/ApiKeyLimits.test.tsx`, which is the one extended. Its
  shipped footer pin was updated deliberately to the UI-SPEC rewording.

## Known Stubs

None. `claim` / `bind` / `drop` have no caller yet by design: the plan wires idempotency for MCP in
306-04 / 306-05 (threat T-306-09).

## Threat Flags

None. Every new surface is in the plan's register: T-306-10 (leases, in-app path fenced), T-306-11
(per-member expiry, live-tested), T-306-12 (fail closed, tested), T-306-09 / T-306-20 / T-306-16
(claims keyed on credential + hash, no client key in logs, tested), T-306-27 (PUT 400 = mig 223
CHECK = card clamp), T-306-28 (`api_key.refused` with `admission:*`, through the throttled `_refused`).

## Owed (not done here, by design)

- Cloud: migration 223 is still owed to the cloud project (306-01's note). This plan added no
  migration and touched neither the cloud project nor the Supabase MCP.
- The defaults (2 / 4 / 6, retry 15 / 30 s) are assumptions until the D-21 burst measures them.

## TDD Gate Compliance

RED (`test(306-02)`) precedes GREEN for every task: `8ca832694` → `1efcd8632`,
`5933ab840` → `52cf832a9`, `24935abf8` → `08e2f61e8`. Each RED was run and failed first (collection
error on the missing module; 42 failed; 17 failed). The inline snapshot of the shipped three rows was
written from the BASE component during RED, so it proves those rows are unchanged.

## Self-Check: PASSED

All 6 created files exist; all 9 commits (`8ca832694`, `1efcd8632`, `5933ab840`, `52cf832a9`,
`24935abf8`, `08e2f61e8`, `71f2b3d7b`, `e2b312db2`, `11f2ea11c`) are in the branch history since
base `6e4e1e33e`. STATE.md and ROADMAP.md were not modified (the orchestrator owns them).
