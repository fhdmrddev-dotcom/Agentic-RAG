---
phase: 182-server-validation-seam
plan: 09
subsystem: api
tags: [fastapi, dependency-injection, request-state, auth, run-in-threadpool, event-loop, wr-08]

# Dependency graph
requires:
  - phase: 181-revert-foundation
    provides: "require_canvas() — the 404-when-off canvas gate that already resolves the caller via authenticate_canvas_request (D-181-01/02)"
  - phase: 182-server-validation-seam (plans 01-03)
    provides: "the two canvas-gated routes POST /workflows/validate + GET /workflows/grounding-bundle"
  - phase: 182-server-validation-seam (plan 08)
    provides: "CanvasGateMiddleware — the pre-routing master off-switch; Depends(require_canvas()) deliberately retained on both routes as defense in depth"
provides:
  - "canvas_caller — the consumer half of the WR-08 request.state hand-off; hands the gate's already-validated identity to canvas handlers and fails CLOSED to the byte-identical 404"
  - "require_canvas publishing its validated identity on request.state.canvas_caller (and returning it from all three success branches)"
  - "authenticate_canvas_request's GoTrue read wrapped in run_in_threadpool (D-v2.5-01) — off the event loop that also serves SSE chat streams"
  - "tests/unit/test_182_canvas_auth.py — 6 tests; the two counting-fake probes FAIL against the pre-fix code with an observed GoTrue count of exactly 2"
affects: [183-read-only-canvas, 184-editable-canvas, 185-graded-governance, 189-governed-external-action-node-model]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate-publishes / handler-consumes: a dependency that has already converted an untrusted token into a trusted identity publishes it on request.state rather than letting the handler re-derive it (the admin.py request.state.audit_action precedent)"
    - "The consumer half of a request.state hand-off fails CLOSED onto the producer's OWN deny response — here the same _NOT_FOUND, so an absent hand-off can never soften a 404-posture gate into a 500 or 403"
    - "Count auth cost at the seam BOTH resolution paths traverse (supabase.auth.get_user), not at either path's own entry point — a counter on one path's helper reads 1 in both the fixed and the broken world"
    - "Scoped D-v2.5-01 fix with the non-goal recorded IN-SOURCE, so a reviewer reads the asymmetry with the untouched shared path as a decision rather than a missed site"

key-files:
  created:
    - backend/tests/unit/test_182_canvas_auth.py
  modified:
    - backend/app/dependencies.py
    - backend/app/api/workflows.py

key-decisions:
  - "The identity hand-off rides request.state (the admin.py audit_action precedent) rather than promoting require_canvas to a handler parameter — dependencies=[...] discards the return value, so request.state is the minimal change that keeps the gate stack byte-identical"
  - "canvas_caller fails CLOSED to the SAME _NOT_FOUND the gate raises — never 500 (an existence signal), never 403 (D-182-05 forbids it), never 401 (CR-01's leak channel)"
  - "run_in_threadpool applied to the CANVAS auth read only; the shared get_current_user is deliberately untouched and that non-goal is recorded in the docstring"
  - "The counting fake is installed at supabase.auth.get_user, NOT at authenticate_canvas_request as the plan's action text literally said — get_current_user never calls that helper, so a counter there reads 1 both before and after the fix and the plan's own required falsification (counter -> 2) would have been unreachable"
  - "The handler parameter stays named current_user — tests/unit/test_182_validate.py (owned by plan 182-08 in the same wave) calls the handler directly with that keyword"

patterns-established:
  - "A future canvas route declares `current_user: dict = Depends(canvas_caller)`, never `Depends(get_current_user)` — the gate above it has already validated the token"

requirements-completed: [VALID-01]

# Metrics
duration: 25min
completed: 2026-07-25
---

# Phase 182 Plan 09: Single Caller Resolution on the Canvas Seam Summary

**The two canvas routes now validate the caller's bearer token exactly ONCE per request instead of twice — the gate publishes the identity it already validated on `request.state.canvas_caller`, a new `canvas_caller` dependency hands it to the handler, and the canvas GoTrue read rides `run_in_threadpool` so it no longer occupies the event loop that also serves every SSE chat stream on the worker.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-25T02:14:00Z
- **Completed:** 2026-07-25T02:39:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified) — a strict subset of the plan's `files_modified` (the 4th, `tests/test_182_grounding_bundle.py`, was conditional and proved unnecessary)

## Accomplishments

- **Closed WR-08 (round 2), item 4 of the D-182-R2-03 scope.** Both routes carried `dependencies=[Depends(require_canvas())]` **and** `current_user: dict = Depends(get_current_user)`. `require_canvas._dep` resolved the caller through `authenticate_canvas_request` (`supabase.auth.get_user` + `_is_banned`), then `get_current_user` validated **the same token** again — 2 GoTrue round-trips + 2 `auth.users` ban queries per request, on a route the seam header documents as firing "on every canvas edit". It is now **1 of each**, and the second call is *gone*, not merely made cheaper.
- **The proof is falsifiable and was falsified.** The counting probe observed **exactly 2** GoTrue calls against the reverted code, with the token list `['canvas-token-abc', 'canvas-token-abc']` — the same token, twice. That is WR-08's claim reproduced as a literal test artifact rather than an argument.
- **D-v2.5-01 honored on the canvas auth path.** `authenticate_canvas_request` now does `await run_in_threadpool(supabase.auth.get_user, ...)`. This matters more than a style rule here: the same worker process serves SSE chat streams, so a blocking GoTrue call on a keystroke-frequency route stalled every concurrent stream for its duration. The shared `get_current_user` is deliberately untouched, with the non-goal recorded in-source.
- **The 404 posture is provably unperturbed.** Every `raise _NOT_FOUND` in `require_canvas` is byte-identical; only the three success branches changed (bare `return` → `return caller`, a value `dependencies=[...]` discards). The hand-off itself fails CLOSED to that same 404 — proven by removing the `request.state` assignment and observing **404, not 500**.
- **D-182-05 is not weakened.** `Depends(require_canvas())` still gates both routes ALONE; `require_visible("workflow_authoring")` count is unchanged at **8**, and both shipped structural gate tests still pass.
- **`tests/unit/test_182_validate.py` was NOT touched** — it belongs to plan 182-08 in the same wave, and the handler parameter name `current_user` was preserved precisely so its direct-call helper keeps working.

## Task Commits

1. **Task 1: Publish the gate's already-validated caller and stop the second authentication** — `6febf36a` (fix)
2. **Task 2: Counting-fake proof of single resolution, threadpool proof, and the fail-closed hand-off** — `ea0df96d` (test)

## Files Created/Modified

- `backend/app/dependencies.py` **(modified, +69/-3)** — five hunks, none inside `get_current_user`:
  - `from starlette.concurrency import run_in_threadpool` added to the third-party block (it genuinely was not imported; the two pre-existing matches in this file were prose inside comments).
  - `authenticate_canvas_request` — the blocking call becomes `await run_in_threadpool(supabase.auth.get_user, credentials.credentials)`. Exception handling, the `getattr(response, "user", None)` line, the `_is_banned` check, the returned `{"id", "email"}` shape and the never-raises contract are all unchanged. Docstring gains a D-v2.5-01 paragraph **and** an `EXPLICIT NON-GOAL` paragraph naming `get_current_user` as deliberately out of blast radius.
  - `require_canvas` docstring — a WR-08 paragraph carrying the measured cost removed (2 round-trips + 2 ban queries → 1 of each).
  - `require_canvas._dep` — publishes `request.state.canvas_caller = caller` immediately after the `caller is None` deny and before the operator check (guarded on `request is not None`, since `_dep` declares it Optional); all three success branches now `return caller`.
  - **`canvas_caller`** (new module-level async dependency) — reads `getattr(request.state, "canvas_caller", None)` and raises the SAME `_NOT_FOUND` when falsy, with the fail-closed rationale spelled out per status (not 500 / not 403 / not 401).
- `backend/app/api/workflows.py` **(modified, +17/-2)** — `canvas_caller` added to the `from app.dependencies import (...)` block in alphabetical position; both canvas handlers swap `Depends(get_current_user)` → `Depends(canvas_caller)` while **keeping the parameter named `current_user`**; a WR-08 comment on each route; a WR-08 sentence appended to the seam header's GATE paragraph. `_coerce_user_id(current_user)` call sites, response models and parameter order are untouched.
- `backend/tests/unit/test_182_canvas_auth.py` **(created, 369 lines, 6 tests)** — module docstring states the defect in numbers, states why the pre-existing suite structurally could not see it, and records the two falsification recipes verbatim so a future reader can re-run them.

## Falsification Record

Both required observations were run against the shipped code and then reverted. `git diff HEAD` on each source file was **empty** afterwards, confirming byte-restoration before the test commit.

**(a) The two `Depends(canvas_caller)` route edits reverted to `Depends(get_current_user)`** → tests (1) and (2) **both FAIL**, with the exact observed values the plan asked for:

| Test | Observed |
|---|---|
| `test_the_get_route_resolves_the_caller_exactly_once` | `assert 2 == 1` |
| `test_the_post_route_resolves_the_caller_exactly_once` | `assert 2 == 1` |

Full message from the GET probe:

```
AssertionError: WR-08: the bearer token was validated 2x for ONE canvas request. A count of 2
means the handler re-authenticated the same token the gate had already validated (2 GoTrue
round-trips per canvas edit) - this is exactly what the pre-fix code did.
Tokens seen: ['canvas-token-abc', 'canvas-token-abc']
```

The token list is the load-bearing detail: it is the **same token string twice**, so this is provably a re-validation of an already-validated credential, not two different callers or an artifact of the fixture.

**(b) The `request.state.canvas_caller` assignment removed from `require_canvas._dep`** → **3 failed, 3 passed**. All three flag-ON route tests (1, 2, 3) observed:

```
AssertionError: {"detail":"Not Found"}
assert 404 == 200
```

**404, never 500** — the hand-off fails CLOSED onto the byte-identical 404, exactly as `canvas_caller`'s docstring claims. The three offline tests (threadpool, direct fail-closed, flag-off posture) correctly stayed green, since none of them depends on the hand-off succeeding.

**(c) Restored** → both source files byte-identical to their committed state; full plan verification suite green.

## Verification Evidence

**HEAD baselines recorded BEFORE editing** (as the plan required):

| Grep | HEAD | After |
|---|---|---|
| `require_visible("workflow_authoring")` in `workflows.py` | **8** | **8** (unchanged — D-182-05 intact) |
| `dependencies=[Depends(require_canvas())]` in `workflows.py` | 2 | 2 |
| `Depends(get_current_user)` in `workflows.py` | 12 | 11 |
| `run_in_threadpool` in `dependencies.py` | 2 (both prose in comments) | 4 (import + call + 2 prose) |

**Acceptance greps** (all as specified):

| Check | Required | Observed |
|---|---|---|
| `from starlette.concurrency import run_in_threadpool` | 1 | 1 |
| `run_in_threadpool(supabase.auth.get_user` | 1 | 1 |
| `request.state.canvas_caller` in `dependencies.py` | ≥ 2 | 3 (1 write in the gate, 1 read in `canvas_caller`, 1 in prose) |
| `current_user: dict = Depends(canvas_caller)` | 2 | 2 |
| `Depends(get_current_user)` in `workflows.py` | ≥ 6 | 11 |
| `def test_` in the new file | ≥ 6 | 6 |
| `dependency_overrides.pop` in the new file | ≥ 1 | 2 |
| exact `== 1` counter assertions | 1 per route | 2 |
| `<= 2` bound-style assertions | 0 | 0 |
| `!= 500` / `!= 403` / `!= 401` in the fail-closed test | present | 1 each |

**The `Depends(get_current_user)` count of 11 deserves a note.** HEAD was 12 and two were removed, so 10 was expected. The 11th is the WR-08 sentence added to the seam header, which quotes the token `Depends(get_current_user)` in prose (line 271). Verified by listing the match lines: the ten remaining real dependencies are on sibling routes at lines 161, 207, 675, 752, 784, 817, 851, 921, 951, 1091 — **neither canvas route appears**.

**`get_current_user` is provably untouched.** `git diff -U2 backend/app/dependencies.py` shows five hunks (import block, `authenticate_canvas_request`, `require_canvas` docstring, `_dep` body, new `canvas_caller`); none falls inside `async def get_current_user`, and a diff grep for its body tokens (`response.user is None`, `identity["id"]`, `Invalid or expired token`) returns **0** added-or-removed lines.

**Test runs:**

| Suite | Result |
|---|---|
| Plan `<verification>` command (6 files) | **45 passed, 0 failed** |
| Task 2 acceptance (`test_182_canvas_auth` + `test_182_grounding_bundle`) | **12 passed, 0 failed** |
| No-regression baseline (the 9-file phase-182 surface) | **80 passed, 0 failed** — identical to the pre-plan measurement |
| 182-08's `tests/test_182_canvas_gate.py` (same-wave sibling) | **7 passed, 0 failed** — the middleware gate is unaffected |
| `venv/Scripts/python.exe -c "import app.main"` | exit **0** |

**Scope:** `git show --stat` across both commits touches **exactly 3 files**, all in the plan's `files_modified`. Every file was staged by explicit path (never `git add .` / `-A`), leaving the ~400 unrelated `.claude/` modifications and the 4 pre-existing untracked `backend/` files alone. `git diff --diff-filter=D` across both commits is empty — **no deletions**.

## Decisions Made

**1. The counting fake is installed at `supabase.auth.get_user`, not at `authenticate_canvas_request`.** This is the one substantive departure from the plan's literal action text, and it was forced by a contradiction inside the plan itself.

The plan's action said to *"install a counting fake at `app.dependencies.authenticate_canvas_request`"*, but its acceptance criteria required that reverting the two route dependencies makes the counter read **2**. Those cannot both be true: `get_current_user` does not call `authenticate_canvas_request` — only `require_canvas` does. A counter on that helper therefore reads **1 in both the fixed and the broken world**, and the required falsification would have been unreachable (the test would have been exactly the kind of decoration this phase's review keeps catching).

The plan's *own* module-docstring instruction states the correct rule — *"a test that wants to see the doubling must count at the ONE seam both paths would go through"* — and that seam is `supabase.auth.get_user`, which is also literally what WR-08 counts ("2 GoTrue round-trips"). So the load-bearing counter is installed there, via a fake supabase client injected through `app.dependency_overrides[get_supabase]`, plus a second counter on `_is_banned` for WR-08's other half (the 2 `auth.users` queries). Both read **1** after the fix and **2** before it.

The plan's literal instruction is *also* honored, in the only form that carries information: `authenticate_canvas_request` is **wrapped, not replaced**, so the gate's own resolution count is asserted separately (`counters["gate_resolutions"] == 1`) while its real threadpooled body still executes underneath. A regression now says *which* side doubled.

**2. `tests/test_182_grounding_bundle.py` was read but not modified.** The plan listed it in `files_modified` with the instruction *"only touch it if Task 1's change requires it"*. It did not: `_inject_caller` monkeypatches `authenticate_canvas_request` (which still runs and still returns the same dict), and its fake caller id already equals conftest's mock user id, so switching the handler off `get_current_user` changed nothing observable. All 6 of its tests pass untouched.

**3. Test (3) uses a caller id deliberately different from conftest's mock user.** The plan asked to prove the handler acts on "the gate's identity". Using conftest's own `00000000-...-0001` would have made the assertion pass even if the hand-off delivered the blanket override's dict. The distinctive `7f3a1c58-...-0abc` makes the test discriminating, and it carries an explicit second assertion that the observed id is *not* conftest's.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's counting seam could not observe the defect it was written to catch**

- **Found during:** Task 2
- **Issue:** The plan's action text placed the counting fake at `authenticate_canvas_request`, but that helper is called only by `require_canvas` — never by `get_current_user`. A counter there reads 1 regardless of whether the handler re-authenticates, making the plan's own required falsification ("confirm they FAIL with an observed counter of 2") impossible to produce.
- **Fix:** Counter moved to `supabase.auth.get_user` — the single seam both resolution paths traverse, and the exact quantity WR-08 measures. `authenticate_canvas_request` is additionally wrapped (not replaced) so the gate-side count is still asserted. A `_is_banned` counter was added for WR-08's second cost dimension.
- **Files modified:** `backend/tests/unit/test_182_canvas_auth.py`
- **Commit:** `ea0df96d`
- **Evidence it was the right call:** the falsification then produced exactly the required observation — `assert 2 == 1` with `Tokens seen: ['canvas-token-abc', 'canvas-token-abc']`.

No other deviations. No Rule 2 or Rule 3 fixes were required, and no Rule 4 architectural question arose.

## Issues Encountered

- **The `Depends(get_current_user)` grep count landed at 11 rather than the expected 10**, because the WR-08 seam-header sentence quotes that token in prose. Resolved by listing the match lines and confirming neither canvas route is among them (documented in Verification Evidence above) rather than by rewording the comment — the sentence is the most useful documentation in that header, and the acceptance criterion was a `>= 6` floor, not an exact count.
- **Falsification (a) needed an `Authorization` header to be meaningful.** Without one, the reverted `Depends(get_current_user)` chain would raise 403 from the shared `auto_error=True` `bearer_scheme` *before* ever reaching `supabase.auth.get_user`, and the counter would have read 1 for the wrong reason. The probes therefore send a real bearer header, so the pre-fix path genuinely executes its second GoTrue call.
- **No scratch `.py` files were written under `backend/`** (uvicorn `--reload` wedges on Windows). Both falsifications were armed by a one-line `python -c` edit run from the repo root and reverted with `git checkout -- <path>`; no `git stash`, no `git clean`, no blanket reset.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data paths were introduced. A scan of all three files for `TODO` / `FIXME` / `placeholder` / "coming soon" / "not available" returned only two pre-existing prose mentions of `template_placeholders`, which is a real populated field.

## Threat Flags

None — this plan introduces no new network endpoint, no new auth path, no file access and no schema change; it strictly *reduces* the number of times an untrusted token is converted into a trusted identity.

Threat register dispositions, all `mitigate` and all now pinned by named tests:

| Threat | Status |
|---|---|
| T-182-32 (DoS — double resolution) | **CLOSED** — pinned by the two counting probes; falsified at exactly 2 |
| T-182-33 (DoS — blocking GoTrue on the event loop) | **CLOSED** — pinned by the thread-identity test; the untouched `get_current_user` non-goal is recorded in-source |
| T-182-34 (EoP — `canvas_caller` on unset state) | **CLOSED** — direct-call test asserts 404 **and** not-500 / not-403 / not-401; falsified live at 404 |
| T-182-35 (Spoofing — reaching a handler without the gate) | **CLOSED** — `dependencies=[Depends(require_canvas())]` retained (grep = 2), both structural gate tests green, and T-182-34's fail-closed default converts any future bypass into a 404 |
| T-182-36 (Info disclosure — identity on `request.state`) | **accept**, as planned — per-request, in-process, never serialized; same `{"id", "email"}` dict `get_current_user` would have handed the same handler; `admin.py`'s `request.state.audit_action` is the in-repo precedent |
| T-182-37 (Tampering — weakening the off-switch) | **CLOSED** — every `raise _NOT_FOUND` byte-identical; the flag-off regression test covers anonymous / operator / bogus-token on both routes |
| T-182-SC (package installs) | **accept** — zero installs; `starlette.concurrency` is already a FastAPI dependency and is imported this way elsewhere in the app. No `requirements.txt` change. |

## User Setup Required

None — no environment variable, migration, seed row, cloud configuration, new dependency or frontend file. Backend-only.

## Next Phase Readiness

- **The pattern for Phase 183+ is now one line:** a new canvas route declares `current_user: dict = Depends(canvas_caller)`, never `Depends(get_current_user)`. The gate above it has already validated the token, and `canvas_caller` fails closed to the same 404 if it somehow has not.
- **This composes cleanly with 182-08.** `CanvasGateMiddleware` owns the master off-switch ahead of routing; `require_canvas` owns caller resolution plus the operator/everyone/role audience *and now publishes the result*; `canvas_caller` distributes it. Three layers, one token validation.
- **Deliberately still open (recorded, not forgotten):** the shared `get_current_user` still calls `supabase.auth.get_user` directly on the event loop for every other route in the app. That is a pre-existing, app-wide D-v2.5-01 residual and is out of this phase's blast radius; the non-goal is written into `authenticate_canvas_request`'s docstring so a future editor reads the asymmetry as scoped rather than missed. A general fix belongs in a dedicated phase that can carry the whole-app regression surface.
- Remaining round-2 gap-closure plans in this phase: **10-12**.

## Self-Check: PASSED

All 4 claimed files exist on disk (`backend/app/dependencies.py`, `backend/app/api/workflows.py`, `backend/tests/unit/test_182_canvas_auth.py`, this SUMMARY) and both claimed commits resolve in `git log --all` (`6febf36a`, `ea0df96d`).

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
