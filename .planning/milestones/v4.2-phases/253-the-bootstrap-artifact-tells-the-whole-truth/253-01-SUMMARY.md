---
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
plan: 01
subsystem: deploy-artifacts / database-privileges
tags: [CRED-03, CR-01, BUG-260911-01, greenfield, acl, security]
requires:
  - supabase/migrations/ (the 12 ACL-bearing migrations)
  - backend/app/services/connector_service.py (_TABLE_SELECTABLE_KEYS)
  - backend/venv (asyncpg)
  - local Supabase Postgres on 127.0.0.1:54322
provides:
  - scripts/check-greenfield-privileges.py (the re-runnable greenfield privilege gate)
  - "scripts/full-schema-supplement.sql §5/§5b/§5c/§5d (all seven ACL-bearing tables)"
  - backend/tests/unit/test_253_supplement_column_parity.py (the no-database drift fence)
affects:
  - supabase/full-schema.sql (tail region only; dump half byte-unchanged)
  - docs/DEPLOYMENT-WORKFLOW.md (§5 parity row, §6 pre-promotion checkbox, changelog)
tech-stack:
  added: []
  patterns:
    - "assert_bench_target's refusal seam, with an ANCHORED generated-name grammar instead of =="
    - "derive-then-replay, last-statement-wins, with no exception list"
    - "has_table_privilege / has_column_privilege, never information_schema.column_privileges"
    - "extractor falsified on synthetic input BEFORE the real file is read"
key-files:
  created:
    - scripts/check-greenfield-privileges.py
    - backend/tests/unit/test_253_supplement_column_parity.py
  modified:
    - scripts/full-schema-supplement.sql
    - supabase/full-schema.sql
    - docs/DEPLOYMENT-WORKFLOW.md
decisions:
  - "The blocking `type \"vector\" does not exist` defect is fixed with a §0 `SET search_path = public;`, NOT by qualifying `public.vector` — qualifying would change the signature text check-schema-acl-parity.cjs compares against the migrations."
  - "§5's column list is 20, not D-17's 19 — `created_by` is granted by migration 118 and is not a response key (MC-3). The fence pins that single difference BY NAME rather than asserting set equality."
  - "The greenfield harness stays OUT of backend/tests/unit (D-04): that suite sits at a 71-failure ceiling with zero headroom and must not gain a live-database precondition."
metrics:
  duration: ~2h
  completed: 2026-09-16
  tasks: 4
  commits: 5
  base_sha: 09f4cfbe546da32c4259bbb87da9ca78a4740cd0
---

# Phase 253 Plan 01: The bootstrap artifact tells the whole truth — Summary

A database born from `supabase/full-schema.sql` alone now carries the same TABLE and COLUMN
privileges as one built by replaying `supabase/migrations/`, proved by connecting to a real
scratch database **as `authenticated`** — and on the way, the harness found that the artifact
**did not apply at all**.

## Base commit

Measured at agent start, after `git reset --hard`:
`09f4cfbe546da32c4259bbb87da9ca78a4740cd0` on branch `worktree-agent-a2befd1c3eca731bd`.

## Commits

| Hash | Subject |
|---|---|
| `10002454c` | `feat(253-01): the greenfield privilege harness — measured as \`authenticated\`` |
| `3192f480f` | `fix(253-01): restore search_path in the supplement — full-schema.sql did not apply` |
| `c73463658` | `feat(253-01): mirror all seven ACL-bearing tables into both bootstrap artifacts` |
| `95e9a1314` | `test(253-01): pin §5 to _TABLE_SELECTABLE_KEYS, and put the harness on the deploy checklist` |

(A fifth commit carries this SUMMARY.)

---

## ⛔ THE FINDING THE PLAN DID NOT ANTICIPATE — `supabase/full-schema.sql` DID NOT APPLY

The harness's **first run against a real database** did not reach a privilege verdict at all.
It exited 2:

```
FATAL: HarnessError: full-schema.sql failed to apply -- UndefinedObjectError: type "vector" does not exist
```

**Diagnosis, measured rather than reasoned about.** `pg_dump` emits
`SELECT pg_catalog.set_config('search_path', '', false);` at `full-schema.sql:29`. That is a
SESSION setting and it survives the entire paste. The supplement is appended to the SAME
paste, and §6 (Phase 252's function-ACL mirror) contains, copied verbatim from migration 181:

```sql
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_skills(vector, uuid, text) FROM PUBLIC;
```

The **type name `vector` is unqualified**. With `search_path = ''` it cannot resolve, and the
statement fails with SQLSTATE `42704`. The Supabase SQL editor wraps a paste in one
transaction, so the **entire greenfield schema rolls back** — the artifact has been
unappliable end-to-end since `a7efe17d1` (Phase 252-01, the same day).

**Why the migration is fine and the artifact is not:** a migration paste never resets
`search_path`, so `vector` resolves there. Only the dump's own `set_config` creates the
condition.

**Confirmed by counterfactual**, not by inspection — the same artifact with one
`SET search_path = public;` inserted immediately before the supplement region:

```
APPLIED OK with search_path=public before the supplement
authenticated can SELECT access_token_ciphertext: True
```

**Deviation, Rule 3 (blocking) + Rule 1 (bug).** Fixed inline as a new §0 in the supplement,
mirrored into the tail in the same commit (`3192f480f`).

⛔ **The fix is deliberately NOT `public.vector`.** Qualifying the type would change the
signature TEXT, which is exactly the key `scripts/check-schema-acl-parity.cjs` compares
against the migrations — a green gate would go red over a correct artifact. Re-verified after
every subsequent edit: `schema ACL parity OK — 16/16 mirrored`, exit 0.

**Consequence for Task 2's acceptance criteria, stated rather than quietly applied:** the
criterion *"`md5sum scripts/full-schema-supplement.sql` still reads
`6a58a47651156ef6dccdf75b93365e66` at the end of this task"* is **NOT met**, and could not be:
the harness cannot measure a privilege on a database that does not exist. What the RED drive
actually depends on — that the supplement contained **zero** occurrences of `connector_tokens`
— was preserved and asserted before the drive (`grep -c connector_tokens` → `0`).

---

## D-19 — THE RED → GREEN PAIR

### RED arm 1 — the real, unfixed artifact · **exit 1 · 1045 violations**

Supplement state at this moment: `grep -c connector_tokens scripts/full-schema-supplement.sql`
→ **0**.

```
MC-1 / D-11 tail identity OK -- scripts/full-schema-supplement.sql (456 lines) == the last 456 lines of supabase/full-schema.sql
migration scan -- files read: 148 (floor 120) · table/column GRANT+REVOKE statements parsed: 32 · tables named: 7
  per-file statement counts: 118 (4) · 126 (1) · 127 (1) · 128 (1) · 129 (3) · 150 (1) · 151 (2) · 156 (6) · 168 (3) · 169 (3) · 172 (3) · 177 (4)

named cases (SC#1, SC#2, BUG-260911-01's pair):
  [control ] SELECT id FROM public.connector_tokens as authenticated -> the read SUCCEEDED
  [SC#1    ] SELECT access_token_ciphertext FROM public.connector_tokens as authenticated -> the read SUCCEEDED
  [SC#1    ] SELECT refresh_token_ciphertext FROM public.connector_tokens as authenticated -> the read SUCCEEDED
  [SC#2    ] supplement §5 grants 15 columns on public.connector_connections
  [SC#2    ] all 15 are readable as authenticated
  [BUG-260911-01] has_table_privilege('anon', 'public.app_settings', 'SELECT') = True
  [BUG-260911-01] has_table_privilege('anon', 'public.user_settings', 'SELECT') = True
  [catalog ] pg_class.relacl public.connector_tokens = {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
  [catalog ] pg_attribute.attacl connector_tokens.access_token_ciphertext = (none)

1045 PRIVILEGE VIOLATION(S) ...
greenfield privileges FAILED -- 1045 violation(s).
exit=1
```

⭐ **The `[control]` line is what makes the two SC#1 lines meaningful.** It proves
`connector_tokens` was reachable as `authenticated` at all; without it, a later refusal could
be green for the wrong reason.

**Violations by table** (derived arm only, `[table-privilege]` + `[column-privilege]`):

| Table | violations |
|---|---|
| `public.app_settings` | 678 |
| `public.connector_tokens` | 101 |
| `public.connector_watch_items` | 79 |
| `public.connector_sync_runs` | 75 |
| `public.connector_watches` | 75 |
| `public.user_settings` | 28 |
| `public.connector_connections` | **5** |

The five on `connector_connections` are D-17's five columns, arrived at **independently** by
the derived model rather than copied from the plan:

```
[column-privilege] has_column_privilege('authenticated', 'public.connector_connections', 'default_approval_posture', 'SELECT') = False, the migrations say True
[column-privilege] has_column_privilege('authenticated', 'public.connector_connections', 'auth_type', 'SELECT') = False, the migrations say True
[column-privilege] has_column_privilege('authenticated', 'public.connector_connections', 'status', 'SELECT') = False, the migrations say True
[column-privilege] has_column_privilege('authenticated', 'public.connector_connections', 'error_message', 'SELECT') = False, the migrations say True
[column-privilege] has_column_privilege('authenticated', 'public.connector_connections', 'default_ingest_visibility', 'SELECT') = False, the migrations say True
```

### RED arm 2 — the COUNTERFACTUAL · **passed**

```
secret_ciphertext in violation lines: 0
```

`public.connector_connections.secret_ciphertext` is correctly ungranted by §5 today, and the
harness does **not** report it. A gate that printed everything it knew would have listed it;
this one has the predicate the right way round.

### RED arm 3 — the target guard · **five refusals + a positive control**

```
REFUSED      non-loopback host: refusing host '10.0.0.5': the greenfield scratch database is LOCAL-ONLY ...
REFUSED      comma-separated LIST: '127.0.0.1:54322,prod.example.com:5432' is a comma-separated host LIST ...
REFUSED      ?host= query param: query parameters ('host=prod.example.com') can carry host= / hostaddr= / port= / dbname= overrides ...
REFUSED      the operator's live DB: refusing database 'postgres': only a database this script GENERATED may be created or dropped ...
REFUSED      UNANCHORED would pass: refusing database 'greenfield_acl_1_1_prod': ... the grammar is anchored ...
ACCEPTED     positive control: greenfield_acl_113000_1789586529
RED arm 3: all five refused, control accepted
exit=0
```

⭐ **The positive control was added beyond the plan.** Five refusals prove nothing if the guard
refuses everything; a name the script would really generate must still be accepted.

### RED arm 4 — the SKIP is not a pass · **exit 2**

```
greenfield privileges SKIPPED -- no Postgres on 127.0.0.1:54399 (ConnectionRefusedError: [WinError 1225] The remote computer refused the network connection); start it with scripts/start-local-infra.ps1
greenfield privileges SKIPPED -- exit 2, never 0. A skip is not a pass.
exit=2
```

### GREEN — after the mirror · **exit 0 · 0 violations**

```
MC-1 / D-11 tail identity OK -- scripts/full-schema-supplement.sql (643 lines) == the last 643 lines of supabase/full-schema.sql, md5 3a9b13bd557da238eeb7cfe9226d87af
migration scan -- files read: 148 (floor 120) · table/column GRANT+REVOKE statements parsed: 32 · tables named: 7
  derived checks issued: 126 table-level · 1688 column-level

named cases (SC#1, SC#2, BUG-260911-01's pair):
  [control ] SELECT id FROM public.connector_tokens as authenticated -> the read SUCCEEDED
  [SC#1    ] SELECT access_token_ciphertext FROM public.connector_tokens as authenticated -> InsufficientPrivilegeError: permission denied for table connector_tokens
  [SC#1    ] SELECT refresh_token_ciphertext FROM public.connector_tokens as authenticated -> InsufficientPrivilegeError: permission denied for table connector_tokens
  [SC#2    ] supplement §5 grants 20 columns on public.connector_connections
  [SC#2    ] all 20 are readable as authenticated
  [BUG-260911-01] has_table_privilege('anon', 'public.app_settings', 'SELECT') = False
  [BUG-260911-01] has_table_privilege('anon', 'public.user_settings', 'SELECT') = False
  [catalog ] pg_class.relacl public.connector_tokens = {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
  [catalog ] pg_attribute.attacl connector_tokens.id = {authenticated=r/postgres}
  [catalog ] pg_attribute.attacl connector_tokens.access_token_ciphertext = (none)
  [catalog ] pg_attribute.attacl connector_tokens.refresh_token_ciphertext = (none)
  [catalog ] pg_attribute.attacl connector_tokens.refresh_claimed_until = (none)
teardown verified: pg_database has 0 rows for greenfield_acl_96732_1789586806

greenfield privileges OK -- 148 migrations scanned, 32 table/column ACL statements replayed,
every expectation measured as the granted role on a database bootstrapped from
supabase/full-schema.sql alone.
exit=0
```

**Side-by-side, the one line that is the whole phase:**

| | RED (before) | GREEN (after) |
|---|---|---|
| `SELECT access_token_ciphertext FROM connector_tokens` as `authenticated` | **the read SUCCEEDED** | `InsufficientPrivilegeError: permission denied` |
| `has_table_privilege('anon', 'public.app_settings', 'SELECT')` | **True** | False |
| `has_table_privilege('anon', 'public.user_settings', 'SELECT')` | **True** | False |
| §5 columns readable | 15 | **20** |
| `connector_tokens.relacl` | `anon=arwdDxtm, authenticated=arwdDxtm, …` | `postgres, service_role` only |
| violations | **1045** | **0** |

---

## The measured corrections, recorded BESIDE the CONTEXT claim they correct

### MC-1 — CONFIRMED. The supplement IS `full-schema.sql`'s byte-identical tail.

Re-measured at execution start: `tail -n 433 supabase/full-schema.sql | md5sum` and
`md5sum scripts/full-schema-supplement.sql` both read
**`6a58a47651156ef6dccdf75b93365e66`**. The harness re-asserts this equality on **every run**
before it touches a database, so it is also the same-commit-rule checker (D-11) for free.

⚠ **This is not "hand-editing `full-schema.sql`" in the sense CLAUDE.md forbids.** The
forbidden thing is hand-authoring *dump* content. The tail region is a verbatim copy produced
by `cat "${SUPPLEMENT}"` at `scripts/regenerate-full-schema.sh:137-151`, and its equality is
machine-checkable. `scripts/regenerate-full-schema.sh` was NOT run (it hard-exits without
`docker` and the `supabase` CLI, and would re-dump live drift). The head region is provably
untouched: the head is lines 1..7254, the banner is at 7250, and every diff hunk in
`supabase/full-schema.sql` starts at **7282 or later**:

```
@@ -7282,7 +7282,24 @@   @@ -7476,3 +7493,11 @@   @@ -7513,4 +7538,17 @@
@@ -7517,0 +7556,20 @@   @@ -7533 +7591,6 @@     @@ -7540,0 +7604,124 @@
```

Final md5 pair: `tail -n 643 supabase/full-schema.sql` == `scripts/full-schema-supplement.sql`
== **`3a9b13bd557da238eeb7cfe9226d87af`**.

### MC-2 — CONFIRMED. 32 statements across 12 files, not "7 tables / 25 statements".

Re-derived mechanically by the harness at run time (never a constant), and independently by
the shell recipe:

```
per-file statement counts: 118 (4) · 126 (1) · 127 (1) · 128 (1) · 129 (3) · 150 (1)
                         · 151 (2) · 156 (6) · 168 (3) · 169 (3) · 172 (3) · 177 (4)
tables: public.app_settings, public.connector_connections, public.connector_sync_runs,
        public.connector_tokens, public.connector_watch_items, public.connector_watches,
        public.user_settings
```

**12 files · 32 statements · 7 tables.** The seven tables DO reproduce; the statement count and
the file list do not. `126`, `127` and `150` each carry a `connector_connections` column grant
and were named **nowhere** in the CONTEXT — nor in the supplement's own `ACLs ->` maintenance
list, which named 118 and 181 only. That list is corrected in this commit, with the original
struck through beside it.

### MC-3 — CONFIRMED. §5 is **20** columns, not D-17's 19.

Measured directly from the running code:

```
len(_TABLE_SELECTABLE_KEYS) = 19
['id','org_id','capability','service_id','name','auth_type','status','error_message','config',
 'mcp_server_url','default_approval_posture','default_ingest_visibility','tool_grants',
 'discovered_tools','is_enabled','last_checked_at','last_check_verdict','created_at','updated_at']
```

§5 previously granted **15**, one of which — **`created_by`** — is **not a response key at
all** (granted by `118:112-124`). D-05 admits no exception list, so it stays. The union is
therefore **20**:

```
id · org_id · created_by · capability · name · config · is_enabled · last_checked_at
last_check_verdict · created_at · updated_at · mcp_server_url · tool_grants · discovered_tools
service_id · auth_type · status · error_message · default_approval_posture · default_ingest_visibility
```

`secret_ciphertext` is **not** among them, and `access_token_ciphertext` appears in the
supplement only inside comments (lines 370, 379, 397) — never inside a `GRANT SELECT (` list.

The fence is therefore the three-part form MC-3 requires, never plain set equality:
`keys - §5 == set()`; `§5 - keys == {"created_by"}` pinned by name; `secret_ciphertext ∉ §5`.

### MC-4 — CONFIRMED BY MEASUREMENT, and handed to plan `253-02`.

```
$ node scripts/check-hot-file-ledger.cjs 253
hot-file ledger — .planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth
  scan list: 281 rows · subject: 12 files · watched: 0
ledger gate OK — every watched file has a row.
exit=0
```

⚠ **`watched: 0` out of 12 subject files.** `scripts/check-hot-file-ledger.cjs:67` sets
`WATCHED = [/^backend\/app\//, /^frontend\/src\//]` and `:51`'s `EXEMPT` additionally drops
`/^scripts\//`, `.md` and `.sql`. So the gate exits 0 whether the D-23 rows exist or not — it
is **structurally blind to every file this plan touches**. That is the structural cause of
CR-08's finding that `full-schema-supplement.sql` had no ledger row for its entire life at 5
phases: the guardrail was blind by construction, not the author careless.

⛔ **This plan therefore does NOT claim the ledger gate as proof of anything.** D-23 is a
MANUAL task on `253-02`, with its own evidence. Widening `WATCHED` is out of this phase's
fixed scope (it is a change to a shared guardrail affecting every phase) and `253-02` Task 4
plants it as a named finding.

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] `supabase/full-schema.sql` did not apply at all

- **Found during:** Task 2, RED arm 1 (the harness's first run against a real database)
- **Issue:** `type "vector" does not exist` (42704). The dump's `search_path = ''` at `:29`
  survives into §6's unqualified `ON FUNCTION ... (vector, uuid, ...)`. Introduced at
  `a7efe17d1` (Phase 252-01). A SQL-editor paste is one transaction, so the whole bootstrap
  rolls back — every greenfield deploy since that commit.
- **Fix:** a new §0 `SET search_path = public;` at the head of the supplement, with the
  measured reason and the counterfactual written into the file. NOT a `public.vector`
  qualification, which would have broken `check-schema-acl-parity.cjs`'s signature comparison.
- **Files modified:** `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql`
- **Commit:** `3192f480f`
- **Verified:** artifact applies; `node scripts/check-schema-acl-parity.cjs` still exits 0
  (16/16 mirrored).

### 2. [Documented] Task 2's md5-unchanged acceptance criterion could not be met

- The criterion *"`md5sum scripts/full-schema-supplement.sql` still reads
  `6a58a47651156ef6dccdf75b93365e66` at the end of this task"* assumed the artifact was
  measurable as it stood. It was not. Deviation 1 necessarily changed the supplement by one
  statement **before** any privilege could be measured.
- **What was preserved:** the property the RED drive actually rests on — the supplement
  contained **zero** occurrences of `connector_tokens` — was asserted immediately before the
  drive and is recorded above. The RED is substantive, not procedural.
- Likewise `git status --short scripts/full-schema-supplement.sql supabase/full-schema.sql`
  was NOT clean after Task 2; it showed the blocking fix, which was committed on its own.

### 3. [Documented] Two acceptance greps match their own refusal comments

- `grep -c "information_schema.column_privileges" scripts/check-greenfield-privileges.py` → **3**,
  and `grep -cE "db (reset|push)"` → **1**. Every match is inside a docstring or comment
  explaining why the thing is refused (lines 51, 800, 1003 and 32 respectively) — which is
  exactly the carve-out the criterion states for the first grep, and the same situation for
  the second. No such call or command exists in the file.
- `grep -cE "psycopg|asyncpg|supabase|requests|os\.environ" backend/tests/unit/test_253_supplement_column_parity.py`
  → **3**. All three are the literal path strings `supabase/migrations/...` and
  `supabase/full-schema.sql` inside assertion prose (lines 65, 192, 211). The test imports no
  driver, opens no connection and reads no environment variable; the criterion's intent —
  **no database, no network, no env var** — holds.

### 4. [Beyond plan] Two extra controls added

- **A positive control in the target-guard drive** (RED arm 3): a name the script would really
  generate must be ACCEPTED. Five refusals prove nothing if the guard refuses everything.
- **A positive control in the named cases** (`[control]` line): `SELECT id FROM
  connector_tokens` as `authenticated` must SUCCEED. Without it, the two SC#1 refusals could be
  green because the table was unreachable for an unrelated reason — a false green of exactly
  the kind D-03 exists to prevent.
- **Two extra RED plants on the pytest fence** beyond the plan's two (granting
  `secret_ciphertext`; removing the block entirely).

---

## The pytest fence — RED-driven, then PASSING

`backend/tests/unit/test_253_supplement_column_parity.py` — **7 passing cases**, no database,
no network, no env var.

```
$ cd backend && venv/Scripts/python -m pytest tests/unit/test_253_supplement_column_parity.py -q
....... [100%]
7 passed, 1 warning in 0.27s
```

**RED drive against four planted defects, on a COPY** — the real artifact was never touched:

```
real supplement md5 BEFORE: 3a9b13bd557da238eeb7cfe9226d87af
RED  deleted_auth_type: test_every_response_key_the_service_projects_is_granted_by_section_5 FAILED naming 'auth_type'
     ['auth_type'] are projected by connector_service._TABLE_SELECTABLE_KEYS but are NOT granted by §5 ...
RED  added_bogus_col: test_the_only_extra_column_section_5_grants_is_the_one_named_here FAILED naming 'bogus_col'
     §5 grants ['bogus_col', 'created_by'] that the response model does not project ...
RED  granted_secret: test_section_5_never_grants_the_secret_column FAILED naming 'secret_ciphertext'
     §5 ... grants `secret_ciphertext` to `authenticated`. That is the tenant credential envelope ...
RED  block_removed: test_the_supplement_is_where_this_file_thinks_it_is_and_the_block_was_found FAILED naming 'was not found'
     the `GRANT SELECT ( ... ) ...` block was not found ... The extractor is proved non-vacuous by the controls above ...
real supplement md5 AFTER : 3a9b13bd557da238eeb7cfe9226d87af
real artifact md5-identical: True
RED drive: all four planted defects fired, naming the planted column.
```

⭐ **The prose control is not decorative.** §5's real block is preceded by comment lines naming
`secret_ciphertext`, `mcp_server_url`, `tool_grants`, `discovered_tools` and `service_id`. An
extractor that read comments would silently admit the one column whose ABSENCE is the point of
the block, and the forbidden-column case would be vacuous. The control feeds it exactly that —
including a commented-out `GRANT SELECT (secret_ciphertext) ...` — and requires `None`.

---

## Backend unit baseline — INTACT, with the failing SET published

```
$ cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors
71 failed, 4878 passed, 2 xfailed, 2 xpassed, 44 warnings in 245.29s (0:04:05)
```

**71 failed · 0 collection errors** — exactly at the ceiling, zero headroom, unchanged. The 7
new cases are all PASSING, so the ceiling was not touched.

⚠ **CLAUDE.md's quoted `3497 passed` has rotted to `4878`.** A growing pass count is the suite
growing; the gate binds the *failed* ceiling of **71**, and that is what held.

**The failing SET, not just the count** (24 files, none of them touched by this plan):

| n | file |
|---|---|
| 15 | `tests/unit/test_retrieval_service.py` |
| 12 | `tests/unit/test_sql_service.py` |
| 6 | `tests/unit/test_explorer_agent.py` |
| 5 | `tests/unit/test_multimodal_query.py` |
| 4 | `tests/unit/test_111_1_reembed_kickoff.py` |
| 3 | `tests/unit/test_sandbox_service.py` |
| 3 | `tests/unit/test_lifespan.py` |
| 3 | `tests/unit/test_db_runs.py` |
| 2 | `tests/unit/test_module7_tools.py` |
| 2 | `tests/unit/test_extraction_service.py` |
| 2 | `tests/unit/test_cross_worker_cancellation.py` |
| 2 | `tests/unit/test_071_1_threadpool_sweep.py` |
| 1 each | `test_streaming_reliability.py` · `test_published_workflow_ownership.py` · `test_phase56_iteration_start.py` · `test_per_format_ingestion.py` · `test_get_model_capability_inference.py` · `test_forced_emit.py` · `test_chat_tool_approval.py` · `test_200_1_phase_output_shape.py` · `test_190_review_fix_data_layer.py` · `test_182_validate.py` · `test_075_4_unknown_provider_error.py` · `test_061_consumer.py` |

⚠ The 16 `^ERROR` lines in the transcript are **captured log output**, not pytest errors —
`grep -c "errors during collection\|ERROR collecting"` → **0**.

---

## Verification — every line of the plan's `<verification>` block

| Check | Result |
|---|---|
| `check-greenfield-privileges.py` → exit **1** before Task 3 | ✅ exit 1, 1045 violations |
| `check-greenfield-privileges.py` → exit **0** after | ✅ exit 0, 0 violations (re-run twice) |
| `grep -c connector_tokens scripts/full-schema-supplement.sql` → 0 before, ≥2 after | ✅ `0` → **9** |
| `grep -c connector_tokens supabase/full-schema.sql` ≥ 2 | ✅ **36** |
| `tail -n $(wc -l < supplement) full-schema.sql \| md5sum` == `md5sum supplement` | ✅ both `3a9b13bd557da238eeb7cfe9226d87af` |
| `pytest tests/unit/test_253_supplement_column_parity.py -q` → exit 0 | ✅ 7 passed |
| `pytest tests/unit -q --continue-on-collection-errors` ≤ 71 failed, 0 collection errors | ✅ 71 failed, 0 collection errors |
| `node scripts/check-schema-acl-parity.cjs` → exit 0 | ✅ 16/16 mirrored |
| `git status --short` shows exactly the five `files_modified` | ✅ clean tree; `git diff --name-only <base> HEAD` = exactly those five |
| `grep -c "check-greenfield-privileges" docs/DEPLOYMENT-WORKFLOW.md` ≥ 2 | ✅ **3** (§5 row, §6 checkbox, changelog) |
| §5 names exactly 20 columns, one per line, no `secret_ciphertext` | ✅ |
| `git diff -U0 supabase/full-schema.sql` — no hunk above the banner (7250) | ✅ first hunk at 7282 |
| head-region `grep -c '^GRANT\|^REVOKE'` | ✅ **0** |
| `public.app_settings` / `public.user_settings` in supplement | ✅ 3 each |
| the three watch tables in supplement | ✅ 11 matches |

## Success criteria

| Criterion | Status |
|---|---|
| SC#1 measured as `authenticated`: `select access_token_ciphertext from connector_tokens` is refused on a database bootstrapped from `full-schema.sql` alone | ✅ `InsufficientPrivilegeError: permission denied for table connector_tokens` |
| SC#2: every column `_TABLE_SELECTABLE_KEYS` names is granted on a fresh database, and a fence pins the two | ✅ all 20 readable; 7-case fence, RED-driven |
| All seven ACL-bearing tables mirrored — no allowlist, no exception list, no deferred table | ✅ §5 · §5b · §5c (×3) · §5d (×2) |
| Supplement and `full-schema.sql` ship in one commit with machine-checked byte identity | ✅ `c73463658`, md5 asserted in-script on every run |
| MC-1..MC-4 recorded beside the CONTEXT claim they correct | ✅ above |
| Backend ceiling of 71 intact, failing set published | ✅ |

**No `must_have` was left unsatisfied.**

---

## What the next plan should know

1. **MC-4 is live and unfixed.** `check-hot-file-ledger.cjs` reports `watched: 0` for this
   phase. D-23's rows must be added and evidenced BY HAND on `253-02`; the gate cannot be cited.
   ⛔ Two files created here have no ledger row and no gate can notice:
   `scripts/check-greenfield-privileges.py` and `scripts/full-schema-supplement.sql` (absent for
   its entire life at 5 phases, per CR-08).
2. **`supabase/full-schema.sql` was unappliable for the whole of 2026-09-16 until `3192f480f`.**
   If any greenfield deploy was attempted in that window it failed wholesale and rolled back.
   No cloud or production database is affected — the artifact is only used for **new**
   environments, and nothing in it was applied anywhere by this plan.
3. **The class is not closed.** `pg_dump --no-privileges` loses TABLE ACLs, FUNCTION ACLs and
   — as this phase discovered — silently changes the SESSION the supplement executes in. Both
   ACL halves are now guarded by something executable. The **session** half is guarded only by
   §0's comment and by the harness happening to apply the artifact end to end. A
   `SET` a future pg_dump emits could break it again the same way.
4. **`refresh_claimed_until` is correctly ungranted** and was never in scope — recorded because
   its `attacl = (none)` line in the GREEN transcript could otherwise read as an omission.

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `scripts/check-greenfield-privileges.py` exists | ✅ FOUND |
| `scripts/full-schema-supplement.sql` exists | ✅ FOUND |
| `supabase/full-schema.sql` exists | ✅ FOUND |
| `backend/tests/unit/test_253_supplement_column_parity.py` exists | ✅ FOUND |
| `docs/DEPLOYMENT-WORKFLOW.md` exists | ✅ FOUND |
| commit `10002454c` | ✅ FOUND |
| commit `3192f480f` | ✅ FOUND |
| commit `c73463658` | ✅ FOUND |
| commit `95e9a1314` | ✅ FOUND |
