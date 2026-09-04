---
phase: 211-the-connection-is-a-service-not-a-verb
plan: 02
subsystem: api
tags: [connectors, migration, schema, constraints, service-identity, wire-contract]

requires:
  - phase: 211-01
    provides: "`static_descriptors_for_capability` — the exact JSON this plan writes into `discovered_tools`, both in SQL and at create time"
  - phase: 206-mcp-connections
    provides: "migration 126's `connector_connections_shape_is_one_of_two`, the constraint this plan replaces, and its own comment block's discipline for doing so"
  - phase: 190-connector-adapters
    provides: "migration 116's table, its capability CHECK, and migration 118's column-by-column SELECT grant"
provides:
  - "`connector_connections.service_id` — free-text service identity, backfilled onto every pre-existing row"
  - "two independent DB constraints replacing 126's dropped shape CHECK: identity mandatory + shapes mutually exclusive"
  - "the action-list backfill that makes SC#2 true for the two shipped legacy rows with no operator ritual"
  - "the model's third shape arm — a service-only connection saves through the API"
  - "`ConnectorNothingToDiscover` + two named 409s, so a third shape never meets a bare error"
  - "the frontend wire contract (`service_id`, widened `McpDiscoveredTool`) both wave-3 plans compile against"
affects: [211-03, 211-04, 211-05, 212, 214, 215, 216]

tech-stack:
  added: []
  patterns:
    - "A dropped CHECK states its replacement IN THE MIGRATION, and each replacement carries a negative control that names the constraint that fired"
    - "A cross-language source fence holds a JSON literal spelled in SQL equal to the Python that generated it — falsified on synthetic input first, non-vacuity asserted at exactly three, and carrying NO skip decorator so it can never report green by skipping"
    - "A comment must not quote the string it retires: `grep -rn` is the proof, and quoting defeats it"

key-files:
  created:
    - supabase/migrations/127_connector_connection_service_identity.sql
    - backend/tests/test_migration_127.py
  modified:
    - backend/app/models/connector.py
    - backend/app/services/connector_service.py
    - backend/app/api/connectors.py
    - frontend/src/lib/api/org.ts
    - backend/tests/unit/test_190_connectors_api.py
    - backend/tests/unit/test_190_connector_check.py
    - backend/tests/unit/test_190_review_fix_data_layer.py
    - backend/tests/unit/test_190_credentials.py
    - backend/tests/unit/test_mcp_connector_client.py

key-decisions:
  - "`service_id` is REQUIRED on Create AND on Response, not optional — the model and the database agree exactly, because a laxer model turns a CheckViolationError into a 500 where a 422 belongs (D-211-04 read literally)."
  - "`ServiceId` is `min_length=1, max_length=64` plus an AfterValidator that strips and rejects blank. `NonEmpty` alone accepts `'   '`, which the DB's `btrim` refuses — the gap between the two IS the 500."
  - "`resolve_connection`'s credential-less relaxation was widened from *the MCP shape* to *anything that is not a capability row*. Without it a service-only row 404s before any named refusal can be worded — the identical defect the MCP arm's own comment records."
  - "The descriptor literals are dollar-quoted (`$descriptor$…$descriptor$`) so no SQL escaping mangles the JSON and the fence's extractor is unambiguous."
  - "tsc rises 34 → 39 BY DESIGN. All five new errors are wave-3 call sites, each already in a wave-3 plan's `files_modified`. Softening the type to hold 34 is the exact laxity the wire contract exists to prevent."

patterns-established:
  - "Backfill-in-the-migration for anything a shipped row needs on day one: the application path that would otherwise fill it is reachable only through a control nobody has clicked yet"
  - "Two shapes, two reason codes — a refusal arm asserts it is NOT the neighbouring arm's code, so neither can absorb the other"

requirements-completed: [CONN-05, CONN-08]

duration: ~2h (including a stall and resume)
completed: 2026-08-26
---

# Phase 211 Plan 02: Service Identity, and the Third Shape Summary

**A connection now names a SERVICE — free text, backfilled onto every existing row — and a
connection that names a service and no way to reach it can finally be stored, at the database
and through the API; the two reachable shapes may no longer be worn at once, a guarantee this
table has never had.**

## Status: 2 of 3 tasks complete — **Task 2 is a BLOCKING operator checkpoint**

Migration 127 is written, committed and **UNAPPLIED**. It cannot be applied by an executor:
CLAUDE.md requires schema changes to be pasted into the Supabase SQL editor, forbids the
Supabase CLI's push and reset subcommands, and `docker` (needed by `regenerate-full-schema.sh`
for `pg_dump`) is denied to the agent. The full paste-ready SQL, the four verification queries
and what remains are in the checkpoint returned with this summary.

## Performance

- **Tasks:** 2 of 3 (Task 2 is the operator gate; Task 3's code is done and committed)
- **Files created:** 2 · **Files modified:** 9
- **Commits:** 4

| Commit | What |
|---|---|
| `95d27909` | migration 127 + `test_migration_127.py`, with the pre-migration RED sample recorded |
| `f322d815` | the third shape: models, service, API — two named 409s and a narrowed 502 |
| `a90b3c5e` | the wire contract in `lib/api/org.ts` |
| `b3808f89` | two fixture files outside `files_modified`, pinned (deviation Rule 3) |

---

## Verbatim evidence (required by the plan's `<output>`)

### 1 · The pre-migration RED sample — the sample that cannot be taken later

Driven against `127.0.0.1:54322` on 2026-08-26, **every write inside a transaction that ROLLED
BACK** (verified: the table still held 3 rows afterwards).

⚠ **This is what separates *"the constraint was REPLACED"* from *"the constraint was DELETED"*.**
A single post-migration sample cannot tell the two apart, and deleting a guarantee is precisely
what migration 126's own comment block warned about, in this same table, one migration ago.

**(a) The SC#4 positive INSERT — a service-only row — was REFUSED:**

```
REFUSED   CheckViolationError: new row for relation "connector_connections" violates check
constraint "connector_connections_shape_is_one_of_two"
DETAIL:  Failing row contains (dcc1c74d-e12e-4039-bc6c-7eec27ca2c82, …, null, RED sample —
service-only row, {}, null, t, null, null, 2026-08-26 17:28:10.135714+00, …, null, {}, []).
    constraint_name = 'connector_connections_shape_is_one_of_two'
    sqlstate = '23514'
```

**(b) The both-shapes INSERT was ACCEPTED — so D-211-11 is a NEW guarantee, not a restatement:**

```
C · D-211-11 — a row wearing BOTH shapes
   Expected TODAY: ACCEPTED (no such constraint exists) — proving the guarantee is NEW
  ACCEPTED  id=7c424cc1-7db0-4c8c-9b94-93901c2a93b4  <-- the table has NO constraint against this today
```

**(c) The pre-migration `(id, capability)` baseline**, pinned into the gate as
`_PRE_MIGRATION_CAPABILITY` so *"capability is unchanged"* is a **comparison, not a claim**:

```
  id=e62eed75-9da8-48c8-9c80-6851d83f9423  capability='post_message'   name='Slack-rag-test'   mcp_server_url=None
  id=477a4074-1fa4-45fd-91f5-ca305ff366fe  capability='create_ticket'  name='Jira – KAN'       mcp_server_url=None
  id=7ca5e114-c5cd-4f7f-8c08-8885278bf42d  capability=None             name='DeepWiki (206.1 UAT)'  mcp_server_url='https://mcp.deepwiki.com/mcp'
  (3 rows)

does the service_id column exist? 0

constraints today:
   connector_connections_capability_check
   connector_connections_created_by_fkey
   connector_connections_last_check_verdict_check
   connector_connections_mcp_url_is_https
   connector_connections_org_id_fkey
   connector_connections_pkey
   connector_connections_shape_is_one_of_two
```

**(d) ⭐ SC#2's starting state — and it is the whole reason §2b exists:**

```
  'Slack-rag-test'        capability='post_message'    jsonb_array_length(discovered_tools)=0
  'Jira – KAN'            capability='create_ticket'   jsonb_array_length(discovered_tools)=0
  'DeepWiki (206.1 UAT)'  capability=None              jsonb_array_length(discovered_tools)=3
```

**Both shipped capability rows advertise NOTHING today, and no control in the shipped product
would have given them any** — `create_connection` writes descriptors for NEW rows only, and the
capability arm of `discover_connection_tools` is reachable solely through the tool picker.
Without the migration's own backfill, **SC#2 would be FALSE for every row that exists** on the
day the phase ships. That is this project's built-but-unreachable signature.

### 2 · The RED of the SC#4-through-the-API case, taken before the third arm landed

```
>       assert res.status_code == 201, res.text
E       AssertionError: {"detail":[{"type":"extra_forbidden","loc":["body","service_id"],
E       "msg":"Extra inputs are not permitted","input":"notion"}]}
E       assert 422 == 201
```

⚠ **AN HONEST QUALIFICATION OF WHAT THAT RED SHOWS.** It fails on `extra_forbidden` — a
STRICTLY EARLIER refusal than the old blanket one — because the model had no `service_id` field
yet. So it is not by itself evidence that the *shape* rule was what refused. The old rule was
driven separately, at the model, to show the actual sentence being retired:

```
$ ConnectorConnectionCreate(name='Notion (the team wiki)')
ValidationError
1 validation error for ConnectorConnectionCreate
  Value error, Either capability or mcp_server_url must be provided [type=value_error,
  input_value={'name': 'Notion (the team wiki)'}, input_type=dict]
```

All seven new API cases were RED together before any implementation landed. The `/discover` one
is quoted in full because its *content* is the finding, not merely its colour:

```
E       AssertionError: a service-only row must be refused by NAME, got 502:
E       {"detail":"MCP tool discovery failed: connection 99999999-9999-4999-8999-999999999999
E        is not configured with an mcp_server_url"}
```

**A bad gateway, naming a shape the row never had, about a server that was never contacted.**

### 3 · The SQL↔Python descriptor fence, falsified before it was believed

Driven by hand against **in-memory mutated copies** — the migration file on disk was never
modified:

```
REAL migration                     -> GREEN
PLANTED title drift (post_message) -> RED, drifted: ['post_message']
PLANTED required drift             -> RED, drifted: ['post_message']
section 2b DELETED                 -> NON-VACUITY FAILS: found 0 []
one WHERE capability misspelled    -> RED, KeyError "connector descriptor lookup: capability
                                      'send_mail' is not registered in EXTERNAL_ACTION_CAPABILITIES"
```

The extractor's own control (a synthetic string that MUST match and one that MUST NOT) ships
inside the test as `test_the_backfill_extractor_is_falsified_on_synthetic_input_first`. The
negative half is the important one: a regex loose enough to match any `UPDATE` would happily
find "three literals" in a file that had lost §2b entirely.

⚠ **The capability is taken from each statement's own `WHERE capability = '…'` clause, never
from the `"name"` inside the JSON.** Reading it from the payload would make the comparison
circular — a literal filed under the wrong capability would be compared against itself and pass.

### 4 · `test_migration_127.py` — the CURRENT (pre-apply) state

```
$ ./venv/Scripts/python.exe -m pytest tests/test_migration_127.py -q -rs
sssssss...                                                               [100%]
SKIPPED [7] tests\test_migration_127.py:175: migration 127 not applied —
public.connector_connections.service_id does not exist. Paste
supabase/migrations/127_connector_connection_service_identity.sql into the Supabase SQL
editor. ⚠ THIS SKIP IS NOT A PASS.
3 passed, 7 skipped, 1 warning in 0.39s
```

**7 skipped / 3 passed.** The three that pass need no database and carry no skip decorator by
design — the module deliberately does NOT use `test_migration_122.py`'s module-level
`pytestmark`, because a fence that can skip reports green in exactly the environment where
nobody is watching.

⚠ **THE SKIPPED→PASSED TRANSITION IS THE ONE PIECE OF EVIDENCE THIS PLAN CANNOT PRODUCE**, and
it is not fabricated here. It is owed after the operator applies the migration, and the command
that produces it is in the checkpoint.

### 5 · The derived projection now carries the column

```
$ ./venv/Scripts/python.exe -c "…from app.services.connector_service import _SELECTABLE_COLUMNS…"
id,org_id,capability,service_id,name,config,mcp_server_url,tool_grants,discovered_tools,
is_enabled,last_checked_at,last_check_verdict,created_at,updated_at
```

Point 4 of the five-point lockstep, obtained **by derivation** — there is no hand-maintained
column list. Which is exactly why point 5, the `GRANT SELECT (service_id)` in migration 127 §4,
is load-bearing: without it every read of the table answers `42501` and it looks like an outage.

### 6 · tsc after the wire contract: **34 → 39**, and all five are wave-3's

Baseline re-measured on the untouched tree: **34**, matching the plan's stated figure exactly.
After `lib/api/org.ts`: **39**. The five, verbatim, each mapped to the plan that closes it:

| # | Error | Closed by |
|---|---|---|
| 1 | `settings/__tests__/ConnectionFormPanel.test.tsx(145,3): error TS2322` — `service_id?: string \| undefined` not assignable | **211-03** |
| 2 | `settings/__tests__/ConnectionsTab.test.tsx(77,3): error TS2322` — same | **211-03** |
| 3 | `settings/ConnectionFormPanel.tsx(703,15): error TS2741: Property 'service_id' is missing in type '{ name; mcp_server_url; config }'` | **211-03** |
| 4 | `settings/ConnectionFormPanel.tsx(715,26): error TS2345` — `{ capability; name; config; secret }` not assignable to `ConnectorConnectionCreate` | **211-03** |
| 5 | `workflows/McpToolPicker.test.tsx(86,7): error TS2741: Property 'service_id' is missing` | **211-04** |

**`git diff --numstat frontend/src/components/ frontend/src/pages/` prints nothing.** No new
symbol is exported, so the `lib/api.ts` barrel needs no change — `McpDiscoveredTool`,
`ConnectorConnection` and `ConnectorConnectionCreate` are all already re-exported (lines
383-385); only their members grew.

### 7 · Backend unit suite vs the 68-failure rot baseline

```
68 failed, 2757 passed, 2 xfailed, 2 xpassed, 33 warnings in 188.12s (0:03:08)
```

| | baseline (211-01's close) | measured at this plan's close |
|---|---|---|
| failed | **68** | **68** |
| passed | 2749 | **2757** |

**`failed` is identical and no NEW failing file appears.** `passed` is `+8`, which is exactly
this plan's eight new unit cases (7 in `test_190_connectors_api.py`, 1 in
`test_190_connector_check.py`) — the arithmetic closes with no residual.

⚠ **IT DID NOT START THERE, AND THE INTERMEDIATE READING IS PUBLISHED RATHER THAN ABSORBED.**
The first full run measured **75 failed**. All seven were mine and all seven were the required
field firing on fixtures in two files outside `files_modified`; both were pinned and the number
returned to 68. See the deviation below. Trajectory: **68 → 75 → 68**.

### 8 · The send path, the fences and the closed-set asserts — green and UNTOUCHED

```
$ pytest test_190_connector_source_fence test_211_closed_set_agreement test_190_cross_org_credential
         test_190_ctx_org_scoping test_190_egress test_190_slack_ok_false test_190_jira_adapter
         test_190_smtp_header_injection test_190_review_fix_executor -q
172 passed
```

The executor's two-shape branch case is present and green, named verbatim per the plan:
**`test_WR03_a_capability_mismatch_records_instead_of_raising`**, with its non-vacuity partner
**`test_WR03_a_MATCHING_capability_still_sends_or_the_case_above_is_vacuous`**.

```
$ git diff --numstat backend/app/models/harness.py backend/app/services/harness/grounding.py \
                     backend/app/services/harness/phase_types.py
(no output)
```

### 9 · The remaining mechanical criteria

| Criterion | Measured |
|---|---|
| `GRANT SELECT (` in migration 127 | `1` |
| `connector_connections_has_a_service_identity` (non-comment) | `2` |
| `connector_connections_shape_is_not_ambiguous` (non-comment) | `2` |
| `DROP CONSTRAINT IF EXISTS connector_connections_shape_is_one_of_two` | `1` |
| `ALTER COLUMN capability` / `SET capability` | `0` / `0` |
| CLI push/reset subcommand strings in the migration | `0` |
| `discovered_tools` occurrences | `12` |
| `ALTER COLUMN discovered_tools` (non-comment) | `0` |
| `grep -rn "Either capability or mcp_server_url" backend/ \| wc -l` | `0` |
| `test_190_connectors_api.py` + `test_190_review_fix_data_layer.py` | **42 passed** (> 19) |
| `grep -c "service_id" frontend/src/lib/api/org.ts` | `5` (≥ 2) |
| `grep -c "outputSchema" frontend/src/lib/api/org.ts` | `2` (≥ 1) |
| `require_org_manage` among CHANGED diff lines in `api/connectors.py` | `0` |
| `bash scripts/check-deploy-drift.sh` | **PASS** |

⚠ **THREE OF THESE CRITERIA WERE INITIALLY FAILED BY MY OWN COMMENTS, AND THE FIX IS WORTH
NAMING** because it is a trap this repository has recorded twice before. `ALTER COLUMN
capability`, the CLI subcommand strings, and the retired refusal sentence each appeared only in
prose *forbidding* them — and a whole-file `grep` cannot tell a prohibition from a violation.
All three were reworded to describe rather than quote, and each now says in place that it is
deliberately not quoting the thing it forbids, so the next author does not "helpfully" restore it.

⚠ **ONE PLAN CRITERION WAS MEASURED AGAINST AND FOUND TO BE WORDED TOO STRICTLY:**
`git diff backend/app/api/connectors.py | grep -c "require_org_manage"` returns `1`, not `0` —
but that line is a **CONTEXT line** (leading space), i.e. proof the dependency is unchanged. The
property the criterion is about was verified with `git diff -U0 … | grep -E "^[+-]"`, which
returns `0`. The stricter reading is unsatisfiable for any hunk near that line.

### 10 · The deploy-drift WARN, and why 127 is not added to OPERATOR.md Step-3

`check-deploy-drift.sh` prints `RESULT: PASS` with a non-blocking WARN listing thirteen
migrations above #089 that carry seed-like `INSERT`/`UPDATE` — 127 **joins an existing list of
twelve** (093, 094, 098, 104, 105, 106, 107, 111, 113, 118, 122, 123). It is deliberately NOT
added to the Step-3 runbook list: that list names migrations a **greenfield** environment needs
for reference data, and 127's two `UPDATE`s **backfill rows that only exist in an
already-populated database** — on a fresh install both match zero rows and there is nothing to
run. Recorded here rather than left as an unexplained warning.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `resolve_connection` 404'd the service-only row before any named
refusal could be worded**

- **Found during:** Task 3(b2), wiring the `/check` and `/discover` refusals
- **Issue:** `resolve_connection` raises `ConnectorNotFound` for any row with no
  `secret_ciphertext` **unless it is MCP-shaped**. A service-only row has no secret by
  definition, so it took that door and both routes answered **404 "Connection not found"** —
  about a row sitting in the caller's own table, on their own screen. The plan's T-211-13 and
  T-211-13d refusals were literally unreachable.
- **Fix:** the relaxation's predicate was inverted from *"is it MCP?"* to *"is it a capability
  row?"* — `if row.get("capability"): raise ConnectorNotFound`. A capability row with no secret
  is still absent, byte-for-byte as before, because that is still true of it.
- **Why it is not a security relaxation, stated rather than assumed:** `_exec_external_action`
  branches on `mcp_tool_name` and then on `capability`; a service-only row has **neither**, so
  nothing in the executor can select it — no send path opens. Both org gates and the
  `is_enabled` gate are above this line and untouched, and there is no credential on such a row
  to disclose. ⚠ This is exactly the defect the MCP arm's own comment records from live UAT on
  2026-08-25, met a second time by a third shape.
- **Files modified:** `backend/app/services/connector_service.py`
- **Commit:** `f322d815`

**2. [Rule 3 — Blocking] Two fixture files outside `files_modified` went RED on the required field**

- **Found during:** the full-suite rot measurement (68 → 75)
- **Issue:** `test_190_credentials.py` (3 cases) builds a `ConnectorConnectionCreate` without
  `service_id`; `test_mcp_connector_client.py` (4 cases) does the same and also builds a stored
  row for `_to_response`. Neither file is in this plan's `files_modified`.

  ```
  E  pydantic_core._pydantic_core.ValidationError: 1 validation error for ConnectorConnectionCreate
  E  service_id
  E    Field required [type=missing, input_value={'capability': 'post_mess...ST-NEVER-BE-LOGGED-190'}]
  ```
- **Fix:** one field added per fixture, with the reason in place. **This is the model change
  working, not breaking** — a required field that no fixture noticed would be a required field
  nothing enforces.
- ⚠ **The MCP fixture's identity is `"github"` and is NOT derived from its `api.github.com`
  URL.** D-211-01 rejected URL-derived identity outright; a fixture that modelled the derivation
  would teach the next reader the opposite of the decision. Migration 127 §2 derives from a host
  **once**, for rows that predate the column, and nothing downstream re-derives.
- **Files modified:** `backend/tests/unit/test_190_credentials.py`,
  `backend/tests/unit/test_mcp_connector_client.py`
- **Commit:** `b3808f89`

**3. [Rule 2 — Missing critical functionality] `/discover`'s blanket `except Exception → 502`
was narrowed, and two more arms were named**

- **Found during:** Task 3(b2)
- **Issue:** the route caught everything below its three named clauses as a **502 bad gateway**.
  A capability refresh performs **no network call at all**, so any internal failure on that arm
  would have been reported as a remote-server problem.
- **Fix:** `ConnectorDisabled` → the existing 409; `ConnectorNothingToDiscover` → the new named
  409; any other `ConnectorError` → a 409 `cannot_refresh_actions`; only what is left reaches
  the 502. ⚠ Clause ORDER is load-bearing and is stated in place: `ConnectorNothingToDiscover`
  **is a** `ConnectorError`, so a broader clause above it would swallow it silently.
- **Files modified:** `backend/app/api/connectors.py`
- **Commit:** `f322d815`

### Deliberate departures from a written criterion

**4. tsc rises 34 → 39, against the plan's "at most 34".** The criterion and the plan's own
design are in direct tension: `lib/api/org.ts` is placed in THIS plan expressly so the two
wave-3 plans compile against it, and a REQUIRED `service_id` cannot land without the five
existing call sites going red. The alternative — `service_id?: string` — is the exact laxity the
plan's own action text forbids in writing (*"a laxer client type turns a 422 into a runtime
surprise in a browser instead of a typecheck"*). **Resolved in favour of the plan's stated
principle over its stated number**, and every one of the five errors is enumerated above and
already owned by a wave-3 plan's `files_modified`. Editing those files here was rejected: they
belong to two worktrees running in parallel and would have manufactured a merge conflict.

### Explicitly NOT done

- **Migration 127 is NOT applied.** No `psql` write, no CLI push, no CLI reset. `full-schema.sql`
  is therefore NOT regenerated — it can only be regenerated from a live post-migration database.
- **`ConnectorCapability` and `CONFIG_MODEL_FOR_CAPABILITY` are byte-unchanged**, both
  module-scope asserts intact, `test_211_closed_set_agreement.py` green untouched.
- **`list_connections` was NOT widened.** The `?capability=` parameter and its `.eq()` arm stay
  — removing a public query parameter is an API break for no gain (RESEARCH Open Question 3).
  Plan 211-03 stops the picker *calling* it; no server change is owed for SC#3.
- **Migration 116's `(org_id, capability)` index was NOT dropped.** Phase 212 owns that call,
  and owes a measurement of the live read pattern before making it.
- **`ConnectorConnectionUpdate` did NOT gain `service_id`.** Editing identity is CONN-07, which
  Phase 212 owns together with the surface that would do it.
- **No package was installed** (T-211-SC). No legitimacy checkpoint owed.

---

## Known Stubs

None. Every value this plan produces is derived from a live source: the identity backfill from
each row's own `capability` or URL, the action list from the adapter's own `INPUT_SCHEMA`. The
one hardcoded empty value — `discovered_tools = []` for a service-only row — is **not a stub**:
such a row genuinely has no action until OAuth ships in Phase 215, and it is asserted as a
deliberate counterfactual by `test_a_service_only_row_is_born_advertising_nothing`. Inventing a
placeholder action would be strictly worse than showing none.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: authz-surface-widened | `backend/app/services/connector_service.py` | `resolve_connection`'s credential-less arm now admits a second shape (deviation 1). Analysed above: no send path opens, both org gates and `is_enabled` are unchanged, and the row carries no credential. Recorded because widening a resolver is the kind of change that should never pass silently. |
| threat_flag: new-untrusted-input | `backend/app/models/connector.py` | `service_id` is free text from a request body reaching a `text` column (T-211-10). Parameterised everywhere, never interpolated into SQL; bounded at 64 chars and blank-rejecting at the model, `btrim` length > 0 at the database. ⚠ **Downstream TS reads must use `own(MAP, key)`, never `MAP[key]`** — a bare index into an object literal reaches `Object.prototype`. Stated in `org.ts` at the field. |

---

## ⚠ Carry-forward: a landmine this plan's nullable shape creates, NAMED and NOT FIXED

`backend/app/services/harness/phase_types.py:2460`:

```python
if not getattr(connection, "mcp_server_url", None) and getattr(connection, "capability", capability) != capability:
```

**Driven, not read** (the `getattr` default fires only when the attribute is MISSING, never when
it is `None`):

```
arm1                        = True
getattr(conn,'capability',capability) = None   <- the default does NOT fire on None
resolved != capability      = True
=> the whole branch is True
```

So a **service-shaped connection bound to a native `external_action` step records-and-sends-
nothing**, and the honest-failure sentence it records — *"the bound connection is for a different
capability"* — **is itself inaccurate**: it is not a *different* capability, it is *no*
capability.

**NOT fixed here, deliberately.** `phase_types.py` is in no Phase 211 plan's `files_modified`,
plan 211-04 promises that branch stays untouched, and the file carries Phase 210's open
`BUS-008`. **Re-open trigger:** the first plan whose `files_modified` names `phase_types.py`, or
the first UAT row that binds a service-shaped connection to a native external-action step.
Whoever takes it owes both halves — the predicate AND the recorded sentence.

## ⚠ `develop` moved while this plan ran

`develop` advanced from this plan's base `7aacbcbf` to `ca015df9` — four Phase 210 commits
(embedding-provider naming, closing SC#10) touching `openai_service.py`, `tool_dispatcher.py`
and two test files. **Zero overlap with this plan's `files_modified`.** This worktree was NOT
rebased and NOT reset; it stays on its dispatched base and the orchestrator owns the merge.

## What the next plans inherit

- **211-03 and 211-04** compile against `service_id: string` (required) and the two-key-wider
  `McpDiscoveredTool`. Their five typecheck errors are the contract telling them exactly which
  call sites to fix; the two plans remain file-disjoint.
- **211-04** additionally inherits a `/discover` endpoint that refreshes **either** reachable
  shape, unchanged in path, dependency and `response_model` — the self-heal path it un-gates is
  this endpoint, not a new one.
- **212** inherits an identity it may key a presentation lookup on, and the explicit instruction
  (in the column COMMENT and in `org.ts`) that a miss degrades to a generic mark, never to a
  refusal and never to a hidden row.
- **215** inherits a storable service-only row to attach OAuth to, and two worded refusals that
  already say *"not yet"* rather than *"broken"*.
- ⚠ **211-05's integration seam test cannot run until migration 127 is applied**, and neither
  can the seven DB cases in `test_migration_127.py`. That is the gate, and it is Task 2.

## Self-Check: PASSED

Files claimed created — both present:

- `supabase/migrations/127_connector_connection_service_identity.sql` — FOUND
- `backend/tests/test_migration_127.py` — FOUND

Commits claimed — all four present in `git log`:

- `95d27909` — FOUND
- `f322d815` — FOUND
- `a90b3c5e` — FOUND
- `b3808f89` — FOUND

⚠ **One claim in this summary is NOT self-checkable and is flagged rather than asserted:** the
skipped→passed transition of `test_migration_127.py`'s seven DB cases. It is owed after the
operator applies migration 127, and this plan does not claim it.
