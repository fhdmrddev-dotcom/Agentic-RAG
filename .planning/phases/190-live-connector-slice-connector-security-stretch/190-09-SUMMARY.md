---
phase: 190-live-connector-slice-connector-security-stretch
plan: 09
subsystem: backend-api
tags: [fastapi, router, org-scoping, rls, feature-flag, kill-switch, zero-migration, conn-02, conn-03, red-first, wave-3, frontend-client]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 03
    provides: "public.connector_connections (migration 116) + its four RLS policies, and the org:manage write permission the router's gate reuses"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "connector_service's CRUD + ConnectorConnectionCreate/Update/Response, ConnectorNotFound and ConnectorCipherUnavailable"
provides:
  - "backend/app/api/connectors.py — org-scoped connector CRUD with an API-ENFORCED org-admin write gate and 404-not-403 on every miss"
  - "the router registered in app.main (a route table entry, asserted by test, not by prose)"
  - "live_connectors in _VISIBILITY_FEATURES + a cold default of off in _GOVERNED_FEATURES — TWO lines, ZERO migrations"
  - "connector_service.delete_connection — the one CRUD verb 190-06 named and did not author"
  - "CIPHER_UNAVAILABLE_REASON = 'no_encryption_key' — the stable machine-readable code UI-SPEC §4b moment 9 renders from"
  - "five typed client functions + three TS types in frontend/src/lib/api.ts, in the house bare-fetch shape, with NO generic wrapper"
  - "ConnectorApiError — the server's reason_code surfaced verbatim so UI-SPEC §4d's three states stay three"
  - "backend/tests/unit/test_190_connectors_api.py — ten cases, NINE driven RED against real plants in production source"
affects: [190-10, 190-11, 190-13, 190-15, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A THROWAWAY probe app (FastAPI() + the one router) sharing the live dependency_overrides DICT OBJECT — so a router's refusals are proved before, and independently of, its registration"
    - "A permission-gate test that forbids the SERVICE, not just the status: the plant made a member's create reach connector_service, which is a stronger RED than a status compare"
    - "Assert membership in one allowlist AND absence from the other — the absence half is what catches a later 'tidy-up' that silently owes a migration"
    - "Surface the server's reason_code verbatim in the client and return null rather than fabricating one — a fabricated code keys into a closed copy map and prints the wrong sentence"

key-files:
  created:
    - backend/app/api/connectors.py
    - backend/tests/unit/test_190_connectors_api.py
  modified:
    - backend/app/services/connector_service.py
    - backend/app/api/admin.py
    - backend/app/models/user_settings.py
    - backend/app/main.py
    - frontend/src/lib/api.ts
    - .planning/phases/190-live-connector-slice-connector-security-stretch/deferred-items.md

key-decisions:
  - "CORRECTION #6 RE-DERIVED AND UPHELD: visual_workflow_canvas is at admin.py:104 inside _VISIBILITY_FEATURES (:97-105), NOT _FLAG_HUMAN_NAMES (:67-79). live_connectors joined _VISIBILITY_FEATURES; migration count measured UNCHANGED at 111"
  - "The org-admin write gate REUSES the shipped require_org_manage rather than a bespoke check — mig 104's current_user_has_permission run AS THE CALLER on a user-JWT connection, the Phase 166-168 precedent"
  - "The READ endpoints are deliberately NOT feature-gated so the Settings tab can render UI-SPEC §2h's OFF banner over a real table; the asymmetry is stated in the module header as a decision"
  - "⚠ RECORDED CONFLICT (D-190-DEF-07): the plan's write gate makes UI-SPEC §2h's 'can be saved' banner FALSE while the switch is off. The PLAN was followed (the more restrictive of the two errors) and the contradiction is written in three places rather than smoothed"
  - "ConnectorCipherUnavailable -> 503 (not 400, not 500): the request was well-formed and the caller did nothing wrong — the INSTANCE cannot store a tenant credential safely"
  - "CIPHER_UNAVAILABLE_REASON is deliberately NOT a member of egress.REFUSAL_REASONS — that frozenset is a closed six-row table about DESTINATIONS with its own len()==6 assert; this code is about the PLATFORM"
  - "delete_connection landed in connector_service, not as SQL in the router — the org scope sits on the DELETE itself, where an unscoped predicate destroys another tenant's row rather than merely revealing it"

patterns-established:
  - "Prove the router and prove the registration SEPARATELY — a probe app for the refusals, a route-table assertion for the wiring, each with its own plant"
  - "When two governing documents disagree, follow the contract, then write the contradiction into the source header, the summary AND deferred-items with the one-line fix named for both branches"
  - "Establish a regression baseline by running the suite at the PARENT COMMIT in a throwaway worktree and set-diffing the FAILED lists — a raw count moves for env reasons and proves nothing"

requirements-completed: []

# Metrics
duration: 96min
completed: 2026-08-09
---

# Phase 190 Plan 09: The Connector Router, the Kill-Switch and the Client Summary

**`/connectors/connections` is live with org-WIDE reads, API-ENFORCED org-admin writes and one indistinguishable 404 for every miss; `live_connectors` joined the allowlist CORRECTION #6 names — measured, not inherited — for TWO lines and ZERO migrations; and ten test cases were driven RED against nine real plants, one of which let a plain member's create reach `connector_service`, which is the defect UI-SPEC §2b exists to prevent.**

## Performance

- **Duration:** ~96 min
- **Completed:** 2026-08-09
- **Tasks:** 3, each committed individually
- **Files:** 8 (2 created, 6 modified) — **1 074 insertions, 1 deletion, ZERO file deletions across all three commits** (the single deletion is `main.py`'s import line being replaced by the longer one)

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | `api/connectors.py` — CRUD, the org-admin gate, the no-existence-leak rule | `6c91ebe6` |
| 2 | Register the router + the `live_connectors` kill-switch (two lines, zero migrations) | `727d87b7` |
| 3 | `frontend/src/lib/api.ts` — five client functions, three types, no wrapper | `42932238` |

---

# ⭐ RESEARCH OPEN QUESTION #1, ANSWERED BY MEASUREMENT — AND THE PLAN WAS RIGHT

The plan asked for the correction to be re-derived **before** editing, against the source rather than against CONTEXT's prose. It was, and it holds:

```
$ grep -n "visual_workflow_canvas" backend/app/api/admin.py
104:    "visual_workflow_canvas",
```

Line **104** sits inside `_VISIBILITY_FEATURES` (`:97-105`). `_FLAG_HUMAN_NAMES` — the set CONTEXT **D-26** names while citing this very precedent — ends at `:79`, twenty-five lines earlier. The two paths do not cost the same thing:

| Allowlist | Endpoint | Storage | Cost of one entry |
|---|---|---|---|
| `_FLAG_HUMAN_NAMES` (`:67-79`) | `PUT /admin/flags` | an `app_settings` **boolean COLUMN** | **migration 118** |
| `_VISIBILITY_FEATURES` (`:97-105`) | `PUT /admin/visibility` | mig-098 JSONB + the audience enum | **ZERO migrations** |

**The consequence was measured after the edit, not asserted:** `ls supabase/migrations/ | wc -l` → **111**, which is exactly plan 190-03's recorded 109 plus migrations 116 and 117. `git status --short supabase/migrations/` prints nothing. **No migration 118 was created, and none is owed.**

The **absence** half is now a permanent fence: `test_live_connectors_is_in_the_zero_migration_allowlist_and_not_the_other` asserts membership in `_VISIBILITY_FEATURES` **and** absence from `_FLAG_HUMAN_NAMES`, so a later tidy-up that moves the key fails loudly instead of reading `False` forever off a column nobody wrote. Driven RED by a plant that did exactly that:

```
E  AssertionError: live_connectors moved into the /admin/flags allowlist — that path writes an
   app_settings BOOLEAN COLUMN and therefore owes migration 118. Move it back, or write the
   migration in the SAME commit
E  assert 'live_connectors' not in {'live_connectors': 'live connectors', 'maintenance_mode': …}
```

---

## The nine plant → RED → restore cycles

Each plant was applied to **real production source** by a `read_bytes`/`write_bytes` harness with the restore in a `finally`, the single case run, and the file restored **md5-identical**. `grep -c PLANT` on all three production files → **0**. `git diff --stat` on every plant target is empty.

| # | Case | Plant | Verbatim RED |
|---|---|---|---|
| 1 | cross-org id is ABSENT | the GET-by-id miss raises the forbidden status | `E AssertionError: {"detail":"connection belongs to another organization"}` / `assert 403 == 404` |
| 2 | **the org-admin write gate** | `Depends(require_org_manage)` → `Depends(get_current_user)` on POST | `E AssertionError: T-190-09-U02: a connector WRITE reached connector_service for a caller with no org:manage — the API gate did not hold` |
| 3 | reads stay ORG-WIDE | the LIST endpoint gains `require_org_manage` | `E AssertionError: {"detail":"You do not have permission to manage this organization."}` / `assert 403 == 200` |
| 4 | unkeyed cipher → 503 | the `except ConnectorCipherUnavailable` clause removed from POST | `E app.services.connector_service.ConnectorCipherUnavailable: a connector secret cannot be stored while no encryption key is configured` |
| 5 | no 422-vs-404 oracle | the `except ConnectorNotFound` clause removed from PATCH | `E app.services.connector_service.ConnectorNotFound: no connection cccccccc-…-00000000000b` |
| 6 | **T7** | `secret_ciphertext: str \| None = None` added to the response model | **exit 4, a COLLECTION ERROR** — `connector_service.py:101` → `E AssertionError: T7: ConnectorConnectionResponse grew a secret-bearing field … Fields: ('id', 'org_id', 'secret_ciphertext', …)` |
| 7 | the CORRECTED allowlist | `live_connectors` moved into `_FLAG_HUMAN_NAMES` | quoted in full above |
| 8 | the cold default | `"live_connectors": "off"` → `"everyone"` | `E AssertionError: assert 'everyone' == 'off'` |
| 9 | the kill-switch, OFF direction | the `dependencies=[Depends(require_visible("live_connectors"))]` line deleted from POST | `E AssertionError: live_connectors=off must refuse the write: '{"id":"dddddddd-…","org_id":"11111111-…","capability":"post_message",…}'` / `assert 201 == 403` |
| 10 | the registration | the `include_router(connectors.router)` line commented out in `main.py` | `E AssertionError: connectors.router is not included in app.main — every case above would keep passing on the probe app while the real surface 404s` |

**Case 2 is the one to read.** The plan asked for *"drop the permission check; observe the member create succeed"*, and that is literally what happened — the test does not merely compare a status, it makes every write verb in `connector_service` **explode if it is reached at all**, so the RED is the sentence *"a connector WRITE reached connector_service for a caller with no `org:manage`"*. A gate that refuses after the row is written is not a gate, and only this shape can tell the difference.

**Case 9's RED proves T7 as a by-product.** The 201 body it prints is a full serialised connection built from a row whose `secret_ciphertext` was the sentinel — and the envelope is absent from it. That was not planned; it is recorded because it is free corroboration.

**Case 6 needed a second control, and it got one.** The plant fails at **import**, which proves the response model is fenced but says nothing about whether the sweep can *see* a leak. So the case now runs its own three assertions over a deliberately-leaking payload and asserts each fires (the PATTERNS §3.20 idiom). Without it, a typo in a substring would leave the case green while checking nothing.

---

## Files Created/Modified

- **`backend/app/api/connectors.py`** *(created, 292 L)* — five routes in `classification_rules.py`'s shape. The header answers **D-15 for this file specifically** (every route runs on the per-request user-JWT client, so RLS is a real runtime gate — the OPPOSITE posture from the harness resolver's BYPASSRLS pool), states **D-25** (why this is a top-level `/connectors` router and not an `/admin` route), states the read/write feature-gate asymmetry as a decision, and records the UI-SPEC §2h conflict in the open. Measured: `grep -cE "403|HTTP_403"` → **0**; `grep -ciE "select |insert into|update .* set"` → **0**; `grep -c "connector_service\."` → **11**; `grep -c "org:manage"` → **6**; `grep -c "BYPASSRLS"` → **1**; no `dependencies=` on the `APIRouter(` line.
- **`backend/app/services/connector_service.py`** *(+41 / −0)* — `delete_connection`, org-scoped at the DELETE itself. Added to `__all__`.
- **`backend/app/api/admin.py`** *(+9 / −0)* — `"live_connectors"` in `_VISIBILITY_FEATURES`, in Phase 181's comment shape.
- **`backend/app/models/user_settings.py`** *(+11 / −0)* — `"live_connectors": "off"` in `_GOVERNED_FEATURES`, with the no-migration reasoning restated.
- **`backend/app/main.py`** *(+2 / −1)* — one import name, one phase-tagged `include_router` line.
- **`backend/tests/unit/test_190_connectors_api.py`** *(created, 477 L)* — ten cases; **12 passed** (case 2 is parametrised ×3).
- **`frontend/src/lib/api.ts`** *(+242 / −0)* — five functions, three request/response types plus the three per-capability config shapes, `ConnectorApiError` and `readConnectorReasonCode`.
- **`deferred-items.md`** *(+2 entries)* — D-190-DEF-06 and D-190-DEF-07.

## Decisions Made

1. **Reuse `require_org_manage`, do not mint a gate.** `dependencies.py:894-911` already runs mig 104's `current_user_has_permission(org_id, 'org:manage')` **as the caller** on a user-JWT connection (T-166-04: the helper reads `auth.uid()`, so a BYPASSRLS connection would evaluate `postgres`'s permissions, not the caller's). `org:manage` is already granted to `super-admin` + `org-admin` at `104:416-426` — exactly UI-SPEC §2b's audience. No `connectors:manage` was minted, per the plan and per 190-03's decision 3.
2. **The reads are NOT feature-gated, and that is written down.** Gating them would 403 the Settings tab into a dead page and take the §2h OFF banner — the one place a person learns the switch exists and who can flip it — down with it. It would also break *binding*, which U-02 makes org-wide and which rides the same read.
3. **503, with a code, for the unkeyed cipher.** Not 400 (the body was fine), not 500 (nothing broke). `CIPHER_UNAVAILABLE_REASON = "no_encryption_key"` is a **separate code space** from `egress.REFUSAL_REASONS`, deliberately: that frozenset is a closed six-row table about destinations carrying its own `len(...) == 6` assert, and merging a platform problem into it would let it be worded as a host problem.
4. **`delete_connection` lives in the service.** The router contracts to hold no SQL, and the DELETE is the one verb where an unscoped predicate *destroys* another tenant's row rather than merely revealing it — so it gets the scope at the statement, with mig 116's DELETE policy as the backstop.
5. **The TS type is documentation and behaves like it.** `ConnectorConnection` declares no credential field in either form (measured: 0 hits over the type block). The client returns `null` for a missing `reason_code` rather than inventing one, because a fabricated code keys into UI-SPEC §4c's **closed** map and prints the wrong sentence.

---

## Deviations from Plan

### 1. [RECORDED — two governing documents disagree, and the disagreement is stated rather than resolved by silence]

**The plan directs `require_visible("live_connectors")` onto the WRITE endpoints** (Task 1) and requires a both-directions test (Task 2 E). **UI-SPEC §2h's operator-approved banner says, verbatim:** *"Connections below **can be saved** and bound to a workflow, but no message, ticket or email will leave."* With the cold default `"off"`, a non-operator org admin is refused on create/edit/delete — so the banner is **false for exactly the audience that reads it**, and §9's panel notice inherits the same problem.

- **What was done:** the plan was followed. It is this executor's contract; it was authored with the UI-SPEC in its own `<context>`; and of the two possible errors this is the **more restrictive** one — a phase whose whole discipline is not over-claiming should not ship a live-credential surface *more* open than its plan says.
- **What was NOT done:** the UI-SPEC was not edited (out of `files_modified`, and operator-approved), and the copy was not quietly reinterpreted.
- **Recorded in three places** so it cannot surface as a UAT bug: `api/connectors.py`'s module header, this section, and **D-190-DEF-07** — which names the one-line fix for *both* branches and hands the decision to the Settings-UI plan (190-10 / 190-11), with the requirement that the copy and the gate move in the SAME commit.

### 2. [Rule 3 — auto-fixed, blocking] `connector_service.delete_connection` did not exist

- **Found during:** Task 1, wiring the DELETE route.
- **Issue:** the plan's Task 1 requires a `DELETE /connectors/connections/{id}` and its acceptance forbids SQL in the router — but plan 190-06's own summary records that it authored *"create / update / list / get / resolve and nothing else"*, and hands the verb on: *"Whoever adds delete | `delete_connection`, against migration 116's existing DELETE policy."* This plan is that place.
- **Fix:** `delete_connection` added to `connector_service.py` (+41 L), org-scoped on the DELETE itself, returning `False` for both "no such row" and "another org's" so the router's 404 stays one refusal.
- **Scope note:** `connector_service.py` is not in this plan's `files_modified`. It is committed with Task 1 and stated here rather than smuggled in — the alternative (SQL in the router) would have violated an acceptance criterion of the same task.

### 3. [RECORDED — a Task-3 acceptance criterion is unsatisfiable as written]

Task 3 asks for `cd frontend && npm test` to report **`0 failed`**. Measured at HEAD: **26 failed | 4562 passed (4588)**, across 9 files. **This is the recorded SEED-056 rot, not a regression** — and it was proved, not asserted (see Issues below, and D-190-DEF-06). The honest instrument for this phase is `node scripts/vitest-count-gate.cjs`, which the phase's own `deferred-items.md` (D-190-DEF-05) already designates: **count gate OK, 48/48 pinned files, `failed 0`, 2732 tests.**

### 4. [RECORDED — the plan's stated task/file split was honoured, which required splitting the test file across two commits]

Task 1's tests hit HTTP endpoints, but the router is only registered by Task 2. Rather than register early (breaking Task 2's contract) or let Task 1 ship failing tests (breaking its acceptance), the Task-1 cases drive a **throwaway probe app** — a bare `FastAPI()` holding only `connectors.router`, sharing the live `app.dependency_overrides` **dict object**. Task 2 then appends the four kill-switch/registration cases, one of which asserts the route exists on the real `app.main.app`. The split is a genuine improvement: *"the router refuses correctly"* and *"the router is reachable"* are now two separately-falsifiable claims with a plant each.

---

**Total deviations:** 1 recorded document conflict (escalated, not resolved), 1 auto-fixed (Rule 3 — blocking), 2 recorded criterion/structure notes. **Zero packages installed** — `git diff --numstat backend/requirements.txt frontend/package.json` prints nothing (T-190-SC).

## Issues Encountered

- **The `npm test` rot GREW since it was last recorded, and the extra file was attributed by driving it.** D-190-DEF-05 recorded 21 failures in 8 files; HEAD reads 26 in 9. The extra is `ChatHistoryColumn.test.tsx`. `api.ts` was rolled back to its `HEAD~1` bytes and the file re-run: **4 failed / 16 passed with the change absent, and 4 failed / 16 passed with it present** — identical. `api.ts` was restored md5-identical (`fb4b4de7…`, `git diff --stat` empty), and the test file has not been touched since Phase 165 and imports nothing from `lib/api`. Logged as **D-190-DEF-06** rather than folded into D-190-DEF-05, because a deferral quoting a stale count invites the next plan to read a real regression as known rot.
- **A raw failure count is not a regression baseline, and the first attempt to use one was misleading.** `pytest tests/unit` reads 66 failed here vs **68** at the parent commit — *fewer*, which looks like an improvement and is not. The two that "improved" are `test_190_credentials` / `test_190_cross_org_credential` cases that need `SECRETS_ENCRYPTION_KEY` from `backend/.env`, which the throwaway worktree does not carry. The claim was therefore re-derived as a **set-diff of the FAILED lists**: `comm -13 base now` → **empty. Zero new failures.**
- **A heredoc silently refused to write the 242-line TS block** (`unexpected EOF while looking for matching '`), and `git diff --stat` confirmed nothing had been appended. Rewritten via a scratch file + `cat >>`. Recorded because the failure mode is quiet: had the check not been run, the commit would have carried an empty change.
- **The plant harness's byte-exact restore needed a CRLF branch.** `app/models/connector.py` is CRLF (225 pairs) while `app/api/connectors.py` is LF (0) — an LF-anchored plant found 0 matches and aborted rather than corrupting the file, which is the harness's abort guard doing its job. Fixed by translating the anchor when the target is CRLF; every restore since is md5-identical.

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_connectors_api.py -q` | **12 passed** (plan asks ≥ 6) |
| `pytest tests/unit/test_190_credentials.py test_190_cross_org_credential.py test_190_connectors_api.py -q` | **19 passed** |
| `python -c "from app.api.admin import _VISIBILITY_FEATURES as V, _FLAG_HUMAN_NAMES as F; print('live_connectors' in V, 'live_connectors' in F)"` | **`True False`** |
| `python -c "from app.models.user_settings import _GOVERNED_FEATURES as G; print(G['live_connectors'])"` | **`off`** |
| `ls supabase/migrations/ \| wc -l` | **111** — unchanged since 190-03 (109 + 116 + 117). No migration 118 |
| `python -c "import app.main"` | exits **0** — no import cycle |
| `grep -c "connectors" backend/app/main.py` | **2** (import + `include_router`, the latter phase-tagged) |
| `pytest tests/unit` — **regression set-diff vs the parent commit `3f5f2328` in a throwaway worktree** | **ZERO new failures** (68→66; the 2 that differ are the env-dependent `SECRETS_ENCRYPTION_KEY` cases) |
| `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33 → 33**, unmoved (baseline re-measured, not quoted) |
| `node scripts/vitest-count-gate.cjs` | **count gate OK** — 48/48 pinned files, no per-file decrease, **0 failing**, 2732 tests |
| the eight D-23/D-24 empty-diff fences | **`0 0` / empty for all eight** (`PhaseFormPanel`, `PhaseNode`, `PhaseNodeCard`, `phaseNodeCardContract`, `ownProperty`, `NodeCornerMarks`, `NodeRunOverlay`, `NodeIconWell`) |
| `pytest` on the visibility/flag/org consumers (148 ×4, 147 ×3, 166, 167, 182, revert-byte-identical) | **71 passed** across the two runs |
| `bash scripts/check-deploy-drift.sh` | **`RESULT: PASS`** (2 pre-existing non-blocking WARNs, neither naming this plan) |
| `git diff --numstat backend/requirements.txt frontend/package.json` | **empty** — zero installs (T-190-SC) |
| `grep -c PLANT` on the three production files | **0 / 0 / 0** |
| `git diff --diff-filter=D --name-only HEAD~3 HEAD` | **empty** — no file deleted by any commit |
| `graphify update .` | 19 727 nodes / 51 560 edges rebuilt (untracked artefact) |

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| **T-190-09-U02** | `require_org_manage` on all three write endpoints, driven by a test that calls the API with **no UI** and forbids the service from being reached at all. Plant = drop the dependency; observed RED as *a member's create reaching `connector_service`*. Case 3 is its non-vacuity control (reads stay org-wide), itself plant-driven |
| **T-190-09-T7** | `response_model=ConnectorConnectionResponse` on every route; the model declares neither field, is `extra='forbid'`, and `connector_service`'s module-scope assert makes adding one an **import failure**. Swept across LIST and GET for the field name, the ciphertext AND a `xoxb-` shape, with the sweep's own positive control. The TS type declares nothing either (measured 0 over the block) |
| **T-190-09-LEAK** | One module-scope `_NOT_FOUND` for every miss, so all misses are byte-identical. `grep -cE "403\|HTTP_403"` → **0**. The body is asserted to name no org, owner, permission verb or forbidden status. Ownership is checked before any body field is interpreted, and the parse-level 422 is proved identical for an owned and an unowned id |
| **T-190-09-FLAG** | The allowlist re-derived by `grep` **before** editing; membership asserted in one set and **absence** in the other; cold default read from `_GOVERNED_FEATURES` rather than retyped; the switch exercised in BOTH directions (off → refused, everyone → 201) with the read proved ungated in both. Four plants, four REDs |
| **T-190-09-503** | Accepted, as dispositioned: a 503 with a stable reason code is the honest answer when the platform cannot store a tenant credential safely. The submitted secret is asserted absent from the refusal body |
| **T-190-SC** | Zero installs across all three commits; no generic HTTP wrapper and no client SDK added (`git diff -U0 \| grep -ciE "function (request\|apiFetch\|http)\("` → 0) |

## Known Stubs

**None.** Every route is wired to a real `connector_service` function; every client function opens a real request against a registered route. Nothing returns a hardcoded empty value and no placeholder text exists in any file this plan wrote.

Two things are **deliberately absent** rather than stubbed, both with a named owner: the **check endpoint's client function** (`190-15`, so the function and the endpoint arrive together — stated in `api.ts`'s section header) and the **Settings → Connections UI** that consumes all of this (`190-10` / `190-11`).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| `threat_flag: new-network-endpoint` | `backend/app/api/connectors.py` | Five net-new authenticated HTTP endpoints — the first surface in this phase that a browser can reach. Every one is dispositioned above (T-190-09-U02 / -T7 / -LEAK / -503) and each disposition is a driven test rather than a sentence; recorded here because a NEW ENDPOINT is new attack surface by definition and `/gsd:secure-phase` should see it named, not inferred from the plan's threat table. |

## Cloud parity (D-22)

**Nothing new is owed.** This plan reads **no new env var**, seeds no reference data, adds no bundled service and changes no sandbox tag — so `deploy/onebox.env.example`, `docs/OPERATOR.md` Step-3 and `docker-compose.prod.yml` are untouched by construction, and `scripts/check-deploy-drift.sh` returns **`RESULT: PASS`** (checked, not assumed). The standing queue is unchanged at **`099 → 117` + `SECRETS_ENCRYPTION_KEY`**.

⚠ **One non-code half DOES exist, and it is not a migration:** `live_connectors` is `"off"` by cold default in every environment, including cloud. Turning it on is an **operator action** — `PUT /admin/visibility` with `feature=live_connectors`, `audience=everyone` — and it writes the `app_settings.feature_visibility` JSONB via `set_feature_visibility`'s atomic `||` merge. Nothing sends until an operator does that, by design (D-26).

## Next Phase Readiness

**Ready.** What downstream plans can now assume, and what they still owe:

| Owed by | What |
|---|---|
| **190-10 / 190-11** | The Settings → Connections UI. All five client functions and three types exist. **It MUST resolve D-190-DEF-07 first** — the §2h banner copy and the write gate contradict each other, and both halves move in the SAME commit |
| **190-13** | The send. `live_connectors` now HAS a home; whether the executor's send path also consults it is 190-13's call, and D-26 describes it as an executor gate |
| **190-15** | `checkConnectorConnection` in `api.ts` + its endpoint, in one commit. The client's section header says so |
| **`/gsd:verify-work 190`** | Do **not** read `npm test` as a regression signal (D-190-DEF-05 / -06). Use `node scripts/vitest-count-gate.cjs` + the per-suite runs |

**One thing not to re-litigate:** the allowlist. `_VISIBILITY_FEATURES` was chosen on a re-derived measurement, the migration count is unchanged at 111, and a test now fails loudly if the key is moved. Moving it costs a migration and buys nothing.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/api/connectors.py` | FOUND (292 L) |
| `backend/tests/unit/test_190_connectors_api.py` | FOUND (471 L) |
| `backend/app/services/connector_service.py` modified | FOUND (+41 / −0) |
| `backend/app/api/admin.py` modified | FOUND (+9 / −0) |
| `backend/app/models/user_settings.py` modified | FOUND (+11 / −0) |
| `backend/app/main.py` modified | FOUND (+2 / −1) |
| `frontend/src/lib/api.ts` modified | FOUND (+242 / −0) |
| commit `6c91ebe6` (Task 1) | FOUND |
| commit `727d87b7` (Task 2) | FOUND |
| commit `42932238` (Task 3) | FOUND |
| No file deletions in any of the three commits | CONFIRMED (`--diff-filter=D` empty over `HEAD~3..HEAD`) |
| No migration created | CONFIRMED (111, and `git status supabase/migrations/` empty) |
| `STATE.md` — hand-edited, history blocks intact | CONFIRMED |
| `ROADMAP.md` — `190-09` row `[x]`, progress cell `8/19` → `9/19` | CONFIRMED |
| `REQUIREMENTS.md` — CONN-02 / CONN-03 **deliberately NOT** marked | CONFIRMED (D-190-DEF-02 precedent) |

**CONN-02 and CONN-03 are not marked complete here, on purpose.** This plan's frontmatter claims neither. The phase convention set by 190-01 (D-190-DEF-02) and followed by every plan since is that they are marked **together at phase close**, after `/gsd:verify-work` + `/gsd:secure-phase`. CONN-03's SC#2 — the unconditional egress guard on a *real send* — is unmet until 190-13 lands the send at all, and CONN-02 has no UI until 190-10/11. Marking either now would assert a capability that does not exist, in the one phase whose whole discipline is not over-claiming (D-31).

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*
