---
phase: 186-concurrency-autosave
plan: 01
subsystem: api
tags: [asyncpg, postgres, fastapi, pydantic, optimistic-concurrency, if-match, http-409]

# Dependency graph
requires:
  - phase: 103-workflow-studio
    provides: the owner-scoped draft-CRUD substrate (`update_workflow_definition`, `update_draft`, the 404-collapse, the published-row freeze)
  - phase: 184-editable-canvas
    provides: the `onPersist` / `onSaveDraft` seam that 186-03/186-06 rewrite against this wire contract
provides:
  - "`CONCURRENCY_TOKEN_SQL` — one SQL expression rendering an opaque, UTC-pinned, constant-width concurrency token from `workflow_definitions.updated_at`"
  - "A `token: str` on `DraftCreateResponse` (create + PATCH) and `DraftRow` (drafts list)"
  - "An OPTIONAL `If-Match` request header on `PATCH /workflows/{definition_id}`"
  - "A three-way refusal: 404 `draft not found` (code-less) / 409 `already_published` / 409 `stale_token` carrying the current token"
  - "A refusal-aware `update_workflow_definition` return contract (`{ok, cause, token}`) replacing the ambiguous `dict | None`"
affects: [186-02 publish race guard, 186-03 useDraftPersistence, 186-05, 186-06, 187 validation envelope]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optimistic concurrency via a SQL-rendered text token, compared in text space (never as a timestamptz bind)"
    - "Refusal-aware return dicts that name their cause, so a route never has to infer one from an absence"
    - "`Annotated[T, Header(...)] = None` rather than `= Header(default=None)` wherever route functions are called directly in tests"

key-files:
  created:
    - backend/tests/unit/test_186_concurrent_patch.py
  modified:
    - backend/app/db/workflows.py
    - backend/app/api/workflows.py
    - backend/tests/unit/test_103_published_409.py

key-decisions:
  - "D-186-07 amended in the open: the token is compared in TEXT space via `to_char(updated_at AT TIME ZONE 'UTC', ...)`, not as `AND updated_at = $N` — asyncpg refuses a str bind to timestamptz with and without a `::timestamptz` cast. Zero migrations; head stays 114."
  - "The token rides in an `If-Match` header, not a wrapper body model — `WorkflowDefinition` is `extra='forbid'` and the token is transport metadata (D-14)."
  - "`If-Match` is OPTIONAL for one release; an absent header runs today's byte-identical unguarded UPDATE. Dated concession, recorded in the source."
  - "409 + machine code, not 412 — the shipped client already branches on 409 and throws the body away; 412 would split one concept across two statuses."
  - "A published-row PATCH now answers 409 `already_published` instead of the pre-186 404. Deliberate D-186-09 consequence of disambiguating the 0-row write."
  - "The token conjunct is a THIRD conjunct after `created_by = $2 AND status = 'draft'`, never in place of either — a concurrency check, never an authorization check."

patterns-established:
  - "One canonical SQL constant referenced by read AND guard, so the value handed to a client and the value compared in the WHERE can never drift"
  - "Owner-scoped disambiguating probe: a refusal may only distinguish causes for rows the caller already owns, so the 404-collapse stays closed"
  - "`Annotated[str | None, Header(alias=...)] = None` — the direct-route-call-safe header form"

requirements-completed: [CONCUR-01, CONCUR-02]

# Metrics
duration: 62min
completed: 2026-08-01
---

# Phase 186 Plan 01: Concurrency Token & Clobber Guard Summary

**An opaque `to_char`-rendered concurrency token on every draft read, a third-conjunct token guard on the draft PATCH, and a three-way honest refusal (404 / 409 `already_published` / 409 `stale_token`) that keeps the existence-leak collapse closed — zero migrations.**

## Performance

- **Duration:** ~62 min
- **Started:** 2026-08-01T20:38Z
- **Completed:** 2026-08-01T21:40Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified) — 696 insertions / 52 deletions

## Accomplishments

- **A stale writer's PATCH now matches 0 rows and the winner's row content provably survives.** F1 asserts the surviving `name` on the row itself, not just the status code.
- **A stale token can never surface as 404.** The 0-row write is disambiguated by one owner-scoped probe that names the real cause; the client branches on a machine `code`, never on prose.
- **The 404-collapse survived the new refusal cause.** A foreign draft id and an unknown id return byte-identical, plain-string details — asserted by comparing the two details to each other.
- **Autosave is proven not to mint a version.** Three chained PATCHes, each carrying the token the previous one returned, leave `version` identical on the response AND on the row.
- **The zero-migration promise held.** `git diff --name-only -- supabase/migrations` = 0 files; head stays `114_harness_audit_action_risk_pending.sql`; slot 115 is still free.

## Task Commits

1. **Task 1: Wave 0 falsification suite (RED first)** — `42734175` (test)
2. **Task 2: The token in SQL — one expression, four query sites, one honest refusal** — `684e63b2` (feat)
3. **Task 3: The route — optional If-Match, a token on the wire, three named refusals** — `5cb1f5f7` (feat)

## Files Created/Modified

- `backend/tests/unit/test_186_concurrent_patch.py` — **created.** F1/F2/F3/F13 against the live local DB; module-level `_pg_reachable` skip-guard, imports inside test bodies, `os.getpid()`-suffixed slugs.
- `backend/app/db/workflows.py` — `CONCURRENCY_TOKEN_SQL` + its three-reason docblock; the constant wired into `get_definition`, `create_workflow_definition`, `list_draft_workflows`, `update_workflow_definition` and the probe; the token-guarded UPDATE; the refusal-aware return contract; the amended `$N`-only discipline comment.
- `backend/app/api/workflows.py` — `token: str` on `DraftCreateResponse` and `DraftRow`; the optional `If-Match` header; the 3-way refusal mapping; `_ALREADY_PUBLISHED_DETAIL` shared by the cause branch and the `CheckViolationError` race backstop.
- `backend/tests/unit/test_103_published_409.py` — **extended, not replaced.** 4 tests before, 4 after, zero deleted; one renamed to match the deliberate 404→409 status change; F4 assertions added to both 409 paths plus a pin on the DELETE 409's bare-string detail.

## RED evidence (required by the plan's output spec)

All four observed RED with the local DB up, at **runtime**, never as a collection error. `--collect-only -q` exited 0 reporting exactly 4 tests; with an unreachable DSN the file reported **4 skipped**.

| Guard | Test | RED output |
|---|---|---|
| F1 | `test_stale_patch_is_refused_and_the_winners_content_survives` | `AttributeError: 'DraftCreateResponse' object has no attribute 'token'` |
| F2 | `test_a_stale_token_is_409_stale_token_never_404` | `AttributeError: 'DraftCreateResponse' object has no attribute 'token'` |
| F3 | `test_foreign_and_unknown_ids_are_the_same_404` | `TypeError: update_draft() got an unexpected keyword argument 'if_match'` |
| F13 | `test_autosave_never_mints_a_version` | `AttributeError: 'DraftCreateResponse' object has no attribute 'token'` |

`4 failed, 1 warning in 0.79s` at Task 1 → `4 passed` after Task 3.

## Counts (required by the plan's output spec)

| Measure | Before | After |
|---|---|---|
| `test_103_published_409.py` tests | 4 | 4 (0 deleted, 1 renamed, 5 assertions added) |
| Backend collected count | 3457 | **3461** (+4, non-decreasing) |
| Backend failing tests (full suite) | 211 | 211 — **identical failing set**, see below |
| Migration files changed | — | 0 |
| Frontend files changed | — | 0 |

**On the 211 failures:** these are pre-existing rot (SEED-049 / SEED-056 class), not a regression. Proven by running the full suite twice — once at HEAD, once with `backend/app/api/workflows.py` and `backend/app/db/workflows.py` restored to the pre-186 commit `a4c4eb86` (the two new/changed test files excluded). Both runs: `211 failed`. `diff` of the two sorted `FAILED` lists shows **one** differing line, and the difference is a stray `RuntimeWarning` appended to an identical test id — the failing *sets* are the same. Representative cause sampled: `test_sql_service.py` `DID NOT RAISE ValueError`, unrelated to any workflow surface.

## Decisions Made

- **The `$N`-only discipline comment was amended rather than silently violated.** The amendment is written in the draft-CRUD section comment (so a source grep for "no f-string on SQL" lands on it), in the constant's own docblock, and in the module docstring: `CONCURRENCY_TOKEN_SQL` is a module-level code literal with no user input; every *value* still travels as `$N`, including the token itself as `$5`.
- **Two UPDATE statements, not one with an `OR $5 IS NULL` escape hatch.** An OR'd-away guard is one refactor from being permanently disabled and reads as guarded when it is not. The token conjunct is present only when a token was supplied.
- **The no-token branch collapses to `not_found`, never `stale_token`.** An unguarded UPDATE cannot match 0 rows on an owned draft, so the third branch is unreachable without a token; it is collapsed defensively to the pre-186 answer with a comment saying exactly that.
- **`delete_draft`'s 409 keeps a bare-string detail.** Out of scope, no token, no ambiguity to resolve — recorded as a decision in the docstring and pinned by a new assertion so the asymmetry cannot read as drift.
- **Pitfall 9 written into the source.** `set_updated_at` uses `now()`, which is *transaction* time: two UPDATEs inside one transaction produce an identical token and would silently disable the guard. Both production writers are single-statement autocommit today; the constant's docblock says so.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Header(default=None, alias="If-Match")` leaked an unresolved `FieldInfo` into the SQL bind**

- **Found during:** Task 3 (the route)
- **Issue:** The plan specified `if_match: str | None = Header(default=None, alias="If-Match")`. FastAPI resolves that at request time — but this repo's shipped route-test idiom calls route functions **directly** (`test_workflows_routes.py:111-144`), where FastAPI never runs and the parameter arrives as the `Header` `FieldInfo` object itself. That object is truthy, so `token is not None` was true and it was passed straight to asyncpg: `DataError: invalid input for query argument $5: Header(None) (expected str, got Header)`. Two existing tests went red on it (`test_103_published_409.py`, `test_103_draft_crud.py`).
- **Fix:** Switched to `if_match: Annotated[str | None, Header(alias="If-Match")] = None`, whose *default* is a plain `None`, so a direct call takes the unguarded branch exactly as an absent header does over HTTP. The reason is recorded at the parameter so nobody "simplifies" it back.
- **Verification:** The two red tests went green; the OpenAPI schema still reports `('If-Match', 'header', required=False)` on the PATCH route; `alias="If-Match"` still greps to exactly one hit.
- **Committed in:** `5cb1f5f7` (Task 3 commit)

**2. [Rule 3 - Blocking] The plan's Task 2 `<verify>` block is not satisfiable at Task 2**

- **Found during:** Task 2 (the SQL layer)
- **Issue:** Task 2's verify block runs `test_103_published_409.py`, but Task 2 changes `update_workflow_definition`'s return contract while the route that consumes it is Task 3's file. Between the two commits the published-row route test necessarily fails (`DraftCreateResponse(**{"ok": False, ...})` → ValidationError). Task 2's own *acceptance criteria* only require `test_103_draft_crud.py` to pass, which it does.
- **Fix:** Committed Task 2 with the expected intermediate failure named explicitly in the commit message rather than blurring the task boundary by pulling route work forward. Task 3 closes it in the next commit.
- **Verification:** `test_103_draft_crud.py` 4 passed at Task 2; the full set green at Task 3.
- **Committed in:** `684e63b2` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/plan-internal)
**Impact on plan:** Neither changes scope. The `Header` fix is a correctness requirement discovered by a shipped test convention the plan itself told me to copy. No scope creep; no migration; no frontend file touched.

## Issues Encountered

- **I destroyed my own uncommitted Task 3 edits.** While measuring whether the 211 suite failures were pre-existing, I ran `git checkout a4c4eb86 -- backend/app/api/workflows.py backend/app/db/workflows.py` followed by `git checkout HEAD -- <same files>` to restore. Task 2 was committed so `db/workflows.py` came back intact, but Task 3's `api/workflows.py` work was still **uncommitted** and was wiped by the restore. Recovered by re-applying the edits from context; the second baseline comparison was then run only after Task 3 was committed. **Lesson for later plans in this phase: never run a `git checkout <ref> -- <path>` baseline comparison while any work on that path is uncommitted.** Nothing was lost from the repository and no other file was touched.
- The plan's `grep -c '"draft not found"'` criterion initially read 3 instead of 2 because the new route docstring quoted the literal. Reworded the docstring to an rst literal (``` ``draft not found`` ```) so the criterion's grep stays a meaningful guard on *raises* rather than being diluted by prose. The substantive criterion — no 404 raise carries a dict detail — was verified directly.

## Known Stubs

None. Every surface this plan touches is wired end to end: the token is produced by SQL, carried on four response shapes, accepted on the request, compared in the WHERE, and asserted on the row by a live-DB test.

## Threat Flags

None. Every security-relevant surface this plan introduces (the `If-Match` value crossing the boundary, the token in the 409 body, the new 409 branch as a potential existence oracle) is already registered in the plan's `<threat_model>` as T-186-01-01 … T-186-01-06, and each mitigation is implemented and asserted:

| Threat | Where it is enforced | Where it is asserted |
|---|---|---|
| T-186-01-01 EoP via the WHERE clause | token is the **third** conjunct after `created_by = $2 AND status = 'draft'` | F3 (a foreign row is untouched); `grep "created_by = \$2"` on both queries |
| T-186-01-02 probe leaks existence | the probe carries `created_by = $2`, with a comment saying it is load-bearing | F3 |
| T-186-01-03 the 409 as an oracle | not-found and not-owned collapse to one code-less string 404 | F3 asserts the two details equal **each other** and `isinstance(detail, str)` |
| T-186-01-04 token in the 409 body | accepted — owner-scoped probe, so the caller already owns the row | F2 asserts the token is present and differs from the stale one |
| T-186-01-05 SQLi via the token | bound as `$5`; `CONCURRENCY_TOKEN_SQL` is a code constant | no value is f-string-interpolated anywhere |
| T-186-01-06 published-row immutability | the `CheckViolationError` handler is KEPT alongside the `status='draft'` conjunct | `test_103_published_409.py` drives both paths |

## User Setup Required

None — no environment variables, no migrations, no cloud parity step. `scripts/check-deploy-drift.sh` is unaffected.

## Next Phase Readiness

- **The wire contract 186-02 / 186-03 / 186-05 / 186-06 were written against is now live and named exactly as planned:** `CONCURRENCY_TOKEN_SQL`, `token: str`, header `If-Match`, `detail.code` ∈ {`already_published`, `stale_token`}, `detail.token` on the stale refusal.
- **186-02 (publish race) can capture its stage-0 token from `get_definition`, which now returns `token`.** Note for that plan: it must NOT wrap the stage-5 flip and any other UPDATE in one transaction — `now()` is transaction time and the tokens would be identical (documented on the constant).
- **186-03 / 186-06 (client) must honour two hard rules:** echo the token string verbatim, and never `new Date(...)` / `Date.parse(...)` it. F15's `?raw` source fence is the planned guard.
- **One consumer-visible behaviour change to carry forward:** a published-row PATCH now returns **409 `already_published`**, not 404. Any client code or test still asserting 404 on that path needs updating; `updateWorkflowDraft` already branches on 409 so the shipped client is unaffected.
- **No blockers.** The 211 pre-existing suite failures are unchanged and out of scope (SEED-049 / SEED-056).

## Self-Check: PASSED

All 5 claimed files exist on disk; all 3 claimed commit hashes (`42734175`, `684e63b2`, `5cb1f5f7`) resolve in `git log`.

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*
