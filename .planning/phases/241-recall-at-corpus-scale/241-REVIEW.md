---
phase: 241-recall-at-corpus-scale
reviewed: 2026-09-10T00:00:00Z
depth: standard
diff_base: 0ce1a7c43
files_reviewed: 19
files_reviewed_list:
  - backend/app/api/settings.py
  - backend/app/config.py
  - backend/app/models/user_settings.py
  - backend/app/services/recall_eval.py
  - backend/app/services/retrieval_service.py
  - backend/app/services/retrieval_tuning.py
  - backend/tests/unit/test_241_bench_safety.py
  - backend/tests/unit/test_241_hnsw_knobs.py
  - backend/tests/unit/test_241_recall_harness_honesty.py
  - backend/tests/unit/test_settings.py
  - frontend/src/lib/api/skills.ts
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/pages/SettingsPage.test.tsx
  - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
  - scripts/build-recall-bench.py
  - scripts/measure-recall.py
  - scripts/vitest-count-gate.cjs
  - supabase/full-schema.sql
  - supabase/migrations/176_app_settings_hnsw_knobs.sql
findings:
  critical: 1
  warning: 8
  info: 8
  total: 17
status: issues_found
---

# Phase 241: Code Review Report

**Reviewed:** 2026-09-10
**Depth:** standard (per-file, language-aware; cross-checked the settings write chain and the bench
DSN guard against the actual `asyncpg` 0.31.0 parser installed in this repo)
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The security surface this phase was most likely to get wrong — `SET LOCAL` / GUC injection — is
genuinely well built. The GUC **name** is a per-statement module constant and only the **value** is
an asyncpg bind parameter (`retrieval_tuning.py:96-99`); `set_config(..., true)` is asserted as an
*argument* rather than described in a comment; the memory companions are unreachable from any
column, request field or UI control, and that is asserted (`test_241_hnsw_knobs.py:114-126`). The
bench builder's destructive statements interpolate `BENCH_DB_NAME`, never a flag-parsed name, so
even a guard bypass could only ever drop a database literally called `recall_bench`. `full-schema.sql`
is a clean regeneration. Most of the new fences carry positive controls and several were driven RED
against real plants.

Three things are wrong anyway, and one of them ships a 500.

1. **The write path was never given the fail-soft treatment the read path got.** Every claim in
   this phase that the authored-but-unapplied migration "changes NOTHING" is a claim about *reads*.
   The Settings → Search tab now sends two columns unconditionally on every save, so in any
   environment where migration 176 has not been pasted — which is cloud production today, by
   241-04's own OWED list — **the entire Search settings tab fails with HTTP 500 and persists
   nothing.** That is `CR-01`.
2. **The bench's target guard enforces a weaker invariant than the one it states.** A
   comma-separated multi-host DSN passes `assert_bench_target` while `asyncpg` will fail over to
   the *second*, non-loopback host. `WR-01`.
3. **The measurement's "exact arm" is not proven to be exact.** `match_document_chunks` is
   `LANGUAGE plpgsql`, so its inner plan is cached and can be locked to a generic plan after five
   executions; nothing in the harness prevents that or asserts the two arms actually planned
   differently. The whole phase verdict rests on this arm. `WR-02`.

Plus a class of finding this project asks for by name: a small number of **claims in prose that the
code does not have** (`WR-05`, `WR-08`, `IN-04`) and **one test that cannot fail for the reason it
states** (`WR-07`).

The deleted `backend/tests/eval/*` files were not reviewed — the deletion is 241-01 Task 3's
explicit instruction.

---

## Critical Issues

### CR-01: Saving any Search setting returns HTTP 500 wherever migration 176 is unapplied — the whole tab, not just the knobs

**Severity:** BLOCKER
**File:** `backend/app/api/settings.py:561-599`, `frontend/src/pages/SettingsPage.tsx:873-901`,
`backend/app/models/user_settings.py:584-612`

**Issue.** `handleSaveSearch` builds one payload for the entire Search tab and now includes both new
keys **unconditionally**:

```ts
// SettingsPage.tsx:899-900
hnsw_ef_search: hnswEfSearch,
hnsw_iterative_scan: hnswIterativeScan,
```

They are never `undefined`, so `update_settings` always reaches
`updates["hnsw_ef_search"] = ...` (`settings.py:578`, `:599`). `save_app_settings` then composes a
single statement over *all* keys —

```python
# user_settings.py:584-598
set_clause = ", ".join(f"{col} = ${i+1}" for i, col in enumerate(cols))
await pool.execute(f"UPDATE app_settings SET {set_clause}, updated_at = now() WHERE id = ${len(vals)}", *vals)
```

— and its only key filter is the `_VALID_COLUMN_NAME` identifier regex, which `hnsw_ef_search`
passes. If the column does not exist, the whole `UPDATE` raises `UndefinedColumnError`, is caught by
`except Exception`, and returns `False`; `settings.py:669` turns that into
`HTTPException(500, "Failed to save settings")`.

**Failure scenario (concrete).** The operator deploys this commit to production. Per 241-04-SUMMARY
§"What is OWED", item 1, **cloud migration 176 has not been applied**. The operator opens Settings →
Search, changes the reranker model (or the retrieval threshold, or the embedding model, or `rrf_k`
— none of which this phase touched), presses **Save Search Settings**, and gets
`Failed to save settings`. Nothing on that tab can be saved until someone pastes 176. Every other
tab still works, so the failure looks like a Search-tab bug rather than a missing migration; the
only diagnostic is a `save_app_settings: DB write failed` WARNING in the backend log with the
`UndefinedColumnError` inside it.

The same happens on any self-hosted install that pulls the code before running the migration, and
on any environment where the operator applies migrations after the deploy (the normal order in
`docs/DEPLOYMENT-WORKFLOW.md`'s "code deploying ≠ cloud configured").

**Why this is not covered by the existing tests.** Every 241 case runs without a database
(`test_241_hnsw_knobs.py:13-16` says so), so the unapplied-migration state is proved harmless for
`_build_settings_from_row` (a read) and never exercised for the write. `migration 176`'s own header
and `241-03-SUMMARY` both assert the state "changes NOTHING" and cite migration 174 as the fail-soft
precedent — that precedent covers reads only, and the phase inherited the claim without re-checking
the write half.

**Fix.** Apply the module's own principle — *degrade the tuning, never the search* — to the write
boundary. Gate the two assignments on the column actually existing, cached once:

```python
# backend/app/api/settings.py — near the two knob blocks
from app.models.user_settings import app_settings_has_columns   # new, cached probe

if body.hnsw_ef_search is not None:
    if not HNSW_EF_SEARCH_FLOOR <= body.hnsw_ef_search <= HNSW_EF_SEARCH_CEILING:
        raise HTTPException(status_code=400, detail=...)   # unchanged
    # ⛔ migration 176 may not be applied yet (241-04 OWED #1). Writing a column that does not
    #    exist fails the WHOLE app_settings UPDATE, taking every other Search setting with it.
    if await app_settings_has_columns("hnsw_ef_search"):
        updates["hnsw_ef_search"] = body.hnsw_ef_search
    else:
        logger.warning("hnsw_ef_search ignored: migration 176 is not applied on this database")
```

with

```python
# backend/app/models/user_settings.py
_APP_SETTINGS_COLUMNS: set[str] | None = None

async def app_settings_has_columns(*names: str) -> bool:
    """True only when every name is a real column on app_settings (cached per process)."""
    global _APP_SETTINGS_COLUMNS
    if _APP_SETTINGS_COLUMNS is None:
        pool = await get_pg_pool()
        rows = await pool.fetch(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'app_settings'"
        )
        _APP_SETTINGS_COLUMNS = {r["column_name"] for r in rows}
    return all(n in _APP_SETTINGS_COLUMNS for n in names)
```

A cheaper stopgap that closes the production hole but not the class: have the frontend send the two
keys only when they actually changed (`hnswEfSearch !== s?.hnsw_ef_search`). That leaves an operator
who *does* touch the knobs on an unmigrated database with the same 500, so it is a mitigation rather
than a fix.

**Add a test that would have caught it.** Drive `update_settings` with `save_app_settings`
monkeypatched to raise `asyncpg.exceptions.UndefinedColumnError` for the two columns, and assert the
handler still persists the rest of the payload.

---

## Warnings

### WR-01: `assert_bench_target` accepts a multi-host DSN whose second host is not loopback — `DROP DATABASE` can reach a remote cluster

**Severity:** WARNING (security / data loss; requires an operator-supplied DSN, so not an
untrusted-input attack — but the guard's stated invariant is stronger than the one it enforces)
**File:** `scripts/build-recall-bench.py:90-133` (`assert_bench_target`), `:136-145`
(`maintenance_dsn`)

**Issue.** The guard reads the host with `urllib.parse.urlparse(dsn).hostname`. `asyncpg` 0.31.0 —
the version installed in `backend/venv` — supports a **comma-separated host list in the URI netloc**
(`asyncpg/connect_utils.py::_parse_hostlist` splits on `,`). `urlparse` reports only the first entry.
Measured in this repo:

```
'postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/recall_bench'
   hostname= 'localhost'   path= '/recall_bench'
   maint   = postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/postgres
```

`assert_bench_target` passes (`localhost` ∈ `LOOPBACK_HOSTS`, database `== recall_bench`), and
`maintenance_dsn` carries the full host list through verbatim.

**Failure scenario.** The operator pastes a multi-host DSN (a shape libpq/asyncpg encourages for
failover) or edits one from a HA connection string. Local Docker is down — a documented, frequent
condition in this repo (`CLAUDE.md` §Windows port-reservation trap: containers report `Up (healthy)`
while the port accepts nothing). asyncpg fails over to `prod.example.com:5432` and the guarded
statement runs there:

```
DROP DATABASE IF EXISTS "recall_bench" WITH (FORCE)
```

If that cluster happens to hold a database called `recall_bench`, it is gone. The module docstring
claims the script "issues irreversible … statements against a **local** Postgres cluster"; that
property does not hold for this DSN shape. The test suite parametrises five hostile hosts
(`test_241_bench_safety.py:104-118`) and none of them is a host **list**.

Two smaller gaps in the same function: **the port is never checked**, so a loopback DSN pointed at a
local SSH tunnel forwarding a remote cluster also passes; and `localhost` is resolver-dependent
(`hosts` file), where `127.0.0.1` / `::1` are not.

**Fix.** Refuse the shapes the guard cannot reason about, and check the port:

```python
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1"})          # drop the resolver-dependent alias
ALLOWED_PORTS = frozenset({54322})                         # the local Supabase db port

netloc_hostspec = parsed.netloc.rpartition("@")[2]
if "," in netloc_hostspec:
    raise BenchTargetRefused(
        f"refusing target {dsn!r}: a comma-separated host LIST cannot be proven loopback — "
        "asyncpg fails over to later hosts that urlparse().hostname never reports"
    )
if parsed.query:
    raise BenchTargetRefused(
        f"refusing target {dsn!r}: query parameters (host=/port=/dbname=) can redirect the "
        "connection past this guard"
    )
try:
    port = parsed.port
except ValueError as exc:
    raise BenchTargetRefused(f"refusing target {dsn!r}: unparseable port") from exc
if port not in ALLOWED_PORTS:
    raise BenchTargetRefused(f"refusing port {port!r}: the bench is local-only")
```

and add the parametrised cases to `test_241_bench_safety.py`:
`"postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/recall_bench"`,
`"postgresql://127.0.0.1:54322,10.0.0.9:5432/recall_bench"`.

*(Checked and found closed, recorded so the next reviewer does not re-derive them: `?host=` /
`?dbname=` query overrides are ignored by asyncpg when the netloc already supplies them; a hostless
DSN (`postgresql:///recall_bench?host=evil`) is refused by the `if not host` arm; percent-encoded
hosts and `//recall_bench` double-slash paths fail closed; `PGHOST`/`PGDATABASE` cannot override a
DSN that supplies both; and the `dbname=` keyword form is refused by the scheme check.)*

### WR-02: the Layer-1 "exact" arm is not proven to be exact — plpgsql plan caching can silently defeat `enable_indexscan = off`

**Severity:** WARNING (correctness of the phase's own deliverable)
**File:** `backend/app/services/recall_eval.py:507-516` (`_set_planner`), `:612-637`
(the per-vector exact/ann loop)

**Issue.** The exact arm is forced off-index purely by session GUCs:

```python
value = "on" if use_index else "off"
for guc in _PLANNER_GUCS:
    await conn.execute(f"SET LOCAL {guc} = {value}")
```

But the query under measurement is `public.match_document_chunks(...)`, which
`supabase/migrations/154_connection_scoped_visibility.sql:148-153` declares
**`LANGUAGE plpgsql SECURITY DEFINER`**. A plpgsql function's inner `RETURN QUERY` plan is cached by
the SPI plancache for the life of the session, with PostgreSQL's standard custom→generic transition
after five executions. Planner-cost GUCs (`enable_indexscan` et al.) do **not** invalidate a cached
plan. Nothing here sets `plan_cache_mode`, and `asyncpg`'s statement cache reuses the outer prepared
statement too (`statement_cache_size` is left at its default of 100).

One run makes 25 vectors × 2 arms × 4 shapes = 200 executions on one connection, so the transition
window is crossed almost immediately.

**Failure scenario.** After the fifth execution the planner locks in a generic plan. Both arms then
execute the *same* plan, `ann_ids == exact_ids`, and `measure_layer1` reports
`recall_at_k = 1.000` — the exact number the whole harness was rewritten to stop being able to print
by accident. Because `enable_indexscan = off` adds `disable_cost` to every custom plan, the *average
custom plan cost* is astronomically higher than the generic plan's, which is precisely the condition
under which PostgreSQL switches to the generic plan.

This is not purely theoretical for this phase: 241-04-SUMMARY reports
`recall_at_k = 1.000` in **all 63** `folder` / `metadata` / `source_system` shape-runs, and records
as "measured surprise #4" that the 20% tenant's `none` shape returned `ann_size` 4–17 while its own
*subset* shapes returned 20/20 — calling that "impossible under one execution plan". Plan reuse
across arms is a candidate explanation that was never excluded. The direction of the error would
*understate* the collapse rather than manufacture it, so the phase's headline finding is not
overturned — but "recall@k = 1.000" for a whole shape is exactly the reading that cannot be trusted
until this is closed.

**Fix.** Make replanning mandatory for the measuring session, and prove the arms differed:

```python
# in measuring_connection(), right after the role/claims setup
await conn.execute("SET LOCAL plan_cache_mode = force_custom_plan")
```

plus `asyncpg.connect(dsn, timeout=timeout, statement_cache_size=0)`, and a positive control in
`measure_layer1`: on the first query vector of each shape, run the exact arm twice — once with the
planner forced off-index and once with it free — and refuse (`RecallUnmeasurable`) if the two agree
on a corpus large enough that they should not. A cheaper alternative is to record
`pg_stat_user_indexes.idx_scan` for `document_chunks_embedding_idx` on both sides of the exact arm
and assert it did not move.

### WR-03: `resolve_probe_targets`'s substring fallback can bind a probe to a different document run-to-run

**Severity:** WARNING (measurement repeatability)
**File:** `backend/app/services/recall_eval.py:681-708`

**Issue.** Two ordering bugs in one function:

```python
rows = await conn.fetch(
    "SELECT id::text AS id, filename FROM public.documents WHERE is_latest = true"
)                                              # ← no ORDER BY
by_filename = {row["filename"].lower(): row["id"] for row in rows if row["filename"]}
...
    for filename, candidate in by_filename.items():
        if stem and stem in filename:
            document_id = candidate
            break                              # ← first match in an arbitrary order
```

There is no `ORDER BY`, so Postgres may return rows in any order (and *will* change order after a
`VACUUM`, an update, or a plan change). The dict therefore (a) keeps an arbitrary one of any two
documents sharing a lowercased filename, and (b) hands the substring fallback an arbitrary iteration
order.

**Failure scenario.** The corpus contains `sample_master_rate_sheet.xlsx` and
`sample_master_rate_sheet_v2.xlsx`. The probe names the first; the exact-match arm misses because the
file was renamed, so the fallback fires and binds to whichever of the two the scan returned first.
Run A binds to the original and scores `#1`; run B — same database, same probe cache — binds to `_v2`
and scores `MISS`. `Hit@1` moves by 0.1 with no configuration change, and 241-04's whole "before /
after at two corpus sizes" argument silently absorbs it. The report records the resolved
`target_document_id`, so the drift is *visible* after the fact, but nothing refuses.

**Fix.** Make the resolution deterministic and make an ambiguous resolution a refusal, not a coin
flip:

```python
rows = await conn.fetch(
    "SELECT id::text AS id, filename FROM public.documents "
    "WHERE is_latest = true ORDER BY filename, id"          # deterministic
)
...
    matches = sorted(c for f, c in by_filename.items() if stem and stem in f)
    if len(matches) > 1:
        raise RecallUnmeasurable(
            f"could not measure: probe target {probe['target_filename']!r} matches "
            f"{len(matches)} documents by stem; the probe would score a different document "
            "on a different run"
        )
    document_id = matches[0] if matches else None
```

### WR-04: the probe-vector cache is silently rebuilt on any read failure, and its `embedding_model` is written but never checked

**Severity:** WARNING (measurement comparability — the property 241-04 leans on hardest)
**File:** `backend/app/services/recall_eval.py:785-816` (`_read_probe_cache` / `_write_probe_cache`),
`:819-873` (`ensure_probe_vectors`)

**Issue.** `_read_probe_cache` returns `None` — meaning "cold cache, go embed" — for *every* failure
mode: file missing, unreadable, truncated JSON, wrong shape, a probe string not present. It then
`_write_probe_cache`s over the file. The cache records `"embedding_model"` and `"version"`, and
**neither is ever read back**: `_read_probe_cache` never compares `payload["embedding_model"]` to the
`embedding_model` argument, and `_PROBE_CACHE_VERSION` (`:782`) is write-only.

**Failure scenario.** 241-04 pins its entire before/after argument on one file:
"`reports/probe-vectors.json`, md5 `5be60f80…`, re-checked unchanged at the end of the plan."
A later run is interrupted mid-write, or is executed from a directory where the file is truncated, or
is run after the operator switches `embedding_model` (the local-embeddings work in
`project_local_embedding_switch_findings` is exactly this scenario). The harness silently embeds ten
fresh vectors — possibly in a *different vector space* with different dimensionality — writes them
over the cache, prints a full report with `Hit@1`, and exits 0. Every earlier report is now
incomparable with every later one, and the only evidence is an md5 nobody re-checks. The module
docstring says "Measuring under a different model would silently compare across vector spaces";
that is precisely what this path does.

**Fix.**

```python
def _read_probe_cache(cache_path, probes, *, embedding_model):
    if not cache_path.is_file():
        return None                                    # the ONLY silent miss
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RecallUnmeasurable(                      # ⛔ never silently re-embed over it
            f"could not measure: the probe cache at {cache_path} exists but is unreadable "
            f"({type(exc).__name__}). Delete it deliberately if you mean to rebuild it."
        ) from exc
    if payload.get("version") != _PROBE_CACHE_VERSION:
        raise RecallUnmeasurable(f"probe cache version {payload.get('version')!r} != {_PROBE_CACHE_VERSION}")
    if payload.get("embedding_model") != embedding_model:
        raise RecallUnmeasurable(
            f"could not measure: the probe cache was built with "
            f"{payload.get('embedding_model')!r} and this run asks for {embedding_model!r} — "
            "the two are different vector spaces and the numbers would not be comparable"
        )
    ...
```

### WR-05: `apply_hnsw_session_knobs` bounds nothing — the `ef_search` "second door" the module builds for `iterative_scan` does not exist for the other knob

**Severity:** WARNING
**File:** `backend/app/services/retrieval_tuning.py:118-125`; `backend/app/config.py:940`

**Issue.** The module deliberately validates `iterative_scan` a second time at the apply boundary,
with the reason written out (`retrieval_tuning.py:135-141`): *"this value is also READ BACK OUT of a
database column that a hand-edit in the SQL editor could have written."* `ef_search` gets no such
door — only `int()`:

```python
resolved_ef = int(ef_search)
...
if resolved_ef != _SERVER_DEFAULT_EF_SEARCH:
    await _set_local(conn, _SQL_EF_SEARCH, str(resolved_ef), guc="hnsw.ef_search")
```

`HNSW_EF_SEARCH_FLOOR` / `HNSW_EF_SEARCH_CEILING` are never imported here. And there is a route that
reaches this code past **both** the API 400 and the DB CHECK: `config.py:940` declares
`hnsw_ef_search: int = 40` on a `BaseSettings`, so `HNSW_EF_SEARCH=100000` in `backend/.env` is read
by `_val`'s env link (`user_settings.py:717-718`) whenever the column is NULL — which is the state of
every row until an operator sets a value.

**Failure scenario.** An operator, or a copied `.env.example`, carries `HNSW_EF_SEARCH=250000`.
Every search issues `set_config('hnsw.ef_search', '250000', true)`. On a session where pgvector is
already loaded, the server raises `InvalidParameterValueError`, which `_set_local` swallows — so the
observable effect is a `WARNING` log **on every single search**, forever, with the tuning silently
inert. On a *fresh* pooled connection the GUC is still an unregistered placeholder at `SET` time
(241-04 measured exactly this: *"the `hnsw.*` GUCs register on first extension use"*), so the
`set_config` succeeds and the value is validated later, when pgvector loads inside the vector query
— outside the `try`. That path is **unproven** and I am flagging it as a hypothesis, not a
measurement; the log-spam path above is certain either way.

**Fix.** Clamp at the apply boundary, using the constants that already exist:

```python
from app.models.user_settings import HNSW_EF_SEARCH_CEILING, HNSW_EF_SEARCH_FLOOR, HNSW_ITERATIVE_SCAN_VALUES
...
if not HNSW_EF_SEARCH_FLOOR <= resolved_ef <= HNSW_EF_SEARCH_CEILING:
    # ⛔ THE SECOND DOOR, symmetric with iterative_scan below: this value can arrive from a
    #    hand-edited column OR from config.py's env field, neither of which the API 400 sees.
    logger.warning(
        "Ignoring an out-of-range hnsw.ef_search value %r (allowed %d..%d)",
        resolved_ef, HNSW_EF_SEARCH_FLOOR, HNSW_EF_SEARCH_CEILING,
    )
    return
```

### WR-06: an operator who deliberately chooses `40` gets whatever the server has, and the UI shows a value that is not in effect

**Severity:** WARNING (behaviour; the *choice* is deliberate and pinned, the *consequence* is not
stated anywhere the operator can see)
**File:** `backend/app/services/retrieval_tuning.py:56-59`, `:124`

**Issue.** The no-op optimisation compares against a hardcoded constant measured on one machine on
one day:

```python
_SERVER_DEFAULT_EF_SEARCH = 40       # "measured live 2026-09-10 (pgvector 0.8.0 / PG 17.6)"
...
if resolved_ef != _SERVER_DEFAULT_EF_SEARCH:
```

The code cannot know the server's actual default, and never asks — even though `recall_eval.py:390`
demonstrates the one-line way to (`SELECT current_setting('hnsw.ef_search', true)`).

**Failure scenario.** A production DBA sets `hnsw.ef_search = 200` in `postgresql.conf` (or via
`ALTER DATABASE ... SET`). Later, an operator diagnosing slow searches lowers **Search breadth** to
`40` in the Settings UI and saves. The value is stored, the UI renders `40`, `GET /settings` returns
`40` — and `apply_hnsw_session_knobs` issues nothing, so every search continues to run at `200`. The
module's stated rationale for the optimisation is that issuing the statement "would silently
override a server whose `postgresql.conf` had been tuned away from 40 by somebody who meant it"; in
this scenario the thing being silently overridden is the operator's explicit, current choice, and
they have no way to see it. The same applies to `iterative_scan = "off"`.

**Fix (cheapest honest one).** Keep the optimisation but make it about *nothing stored* rather than
about a guessed server value — i.e. pass `None` from `_vector_search` when the settings column is
NULL, and issue the statement whenever a value **was** chosen:

```python
# retrieval_service.py:126 — resolve to None rather than to the config default
hnsw_ef_search=(user_settings.hnsw_ef_search if user_settings else None),
```

If the two round trips per search are genuinely unacceptable, read the server's own value once at
pool warm-up and compare against *that*, and say in the UI helper text that a value equal to the
server default is not sent.

### WR-07: `test_the_api_accepts_both_boundaries_and_the_shipped_default` cannot fail for the reason its docstring gives

**Severity:** WARNING (a fence that cannot fire)
**File:** `backend/tests/unit/test_241_hnsw_knobs.py:242-246`

**Issue.**

```python
@pytest.mark.parametrize("ok", [10, 40, 200, 1000])
def test_the_api_accepts_both_boundaries_and_the_shipped_default(ok):
    """An off-by-one here silently narrows what an operator may choose and nothing would say so."""
    assert settings_api.SettingsUpdate(hnsw_ef_search=ok).hnsw_ef_search == ok
```

This constructs a Pydantic model and reads the field back. It never calls `update_settings`, which
is where the bound actually lives (`settings.py:562`). The file's own `_patch()` helper —
used by the refusal cases eight lines above — is the tool that would exercise it, and is not used.

**Failure scenario.** Someone "tightens" the bound to
`if not HNSW_EF_SEARCH_FLOOR < body.hnsw_ef_search < HNSW_EF_SEARCH_CEILING`. The floor and ceiling
served to the UI still say `10` and `1000`, the `<input min="10" max="1000">` still accepts them, and
an operator entering `1000` is refused with a message that says `1000` is allowed. All four
parameters of this test stay green, and so does every other case in the file.

**Fix.**

```python
@pytest.mark.parametrize("ok", [10, 40, 200, 1000])
def test_the_api_accepts_both_boundaries_and_the_shipped_default(ok, monkeypatch):
    saved = {}
    async def _save(updates):
        saved.update(updates); return True
    monkeypatch.setattr(settings_api, "save_app_settings", _save)
    monkeypatch.setattr(settings_api, "load_app_settings_async", _stub_settings)
    _patch(hnsw_ef_search=ok)                      # must NOT raise
    assert saved["hnsw_ef_search"] == ok           # and must reach the write
```

### WR-08: `_apply_hnsw_knobs` interpolates `iterative_scan` into SQL and its docstring claims a validation it does not perform

**Severity:** WARNING (dev-only harness; operator-supplied input, so injection is self-inflicted —
but the claim is false and the public entry points bypass the check)
**File:** `backend/app/services/recall_eval.py:518-530`, `:533-555`

**Issue.**

```python
async def _apply_hnsw_knobs(conn, *, ef_search, iterative_scan):
    """... both are therefore constrained first: ``ef_search`` through ``int()`` and a range,
    ``iterative_scan`` through a closed allow-list. An unknown value refuses (T-241-02)."""
    if ef_search is not None:
        await conn.execute(f"SET LOCAL hnsw.ef_search = {int(ef_search)}")
    if iterative_scan is not None:
        await conn.execute(f"SET LOCAL hnsw.iterative_scan = '{iterative_scan}'")
```

Neither constraint is in this function. `int()` is applied inline (so `ef_search` is genuinely safe),
but the allow-list lives in `validate_knobs` — a *separate* function that only `run_measurement`
calls (`:905`). `measure_layer1` (`:585`) and `measure_layer2` (`:709`) are public, take
`iterative_scan: str | None` and pass it straight through unvalidated, and the string is spliced
into single quotes with no escaping. `_match`'s docstring likewise asserts "the only interpolated
text in this module is the two allow-listed GUC values" — true of `run_measurement`, not of the
module.

**Failure scenario.** A future plan (or a test, or a notebook) calls
`measure_layer1(conn, ..., iterative_scan=some_string)` directly — an entirely reasonable thing to do
given the function is public and documented — and `SET LOCAL hnsw.iterative_scan = '<string>'` is
executed verbatim on a connection that has `SET LOCAL ROLE authenticated`. The docstring says that
cannot happen.

**Fix.** Validate where the interpolation happens, which also makes the docstring true:

```python
async def _apply_hnsw_knobs(conn, *, ef_search, iterative_scan):
    checked_ef, checked_scan = validate_knobs(ef_search, iterative_scan)   # refuses, never passes through
    if checked_ef is not None:
        await conn.execute(f"SET LOCAL hnsw.ef_search = {checked_ef}")
    if checked_scan is not None:
        await conn.execute(f"SET LOCAL hnsw.iterative_scan = '{checked_scan}'")
```

`validate_knobs` is idempotent, so `run_measurement` keeps working unchanged. Add a case to
`test_241_recall_harness_honesty.py` driving `measure_layer1(iterative_scan="'; DROP TABLE x --")`
and asserting `RecallUnmeasurable` — the sibling module already has exactly that case
(`test_241_hnsw_knobs.py:446-453`).

---

## Info

### IN-01: `--chunks-per-doc 0` makes the bench builder loop forever while growing `doc_batch` without bound

**File:** `scripts/build-recall-bench.py:813-833`

`while inserted < chunk_budget:` relies on the inner
`for chunk_index in range(min(chunks_per_doc, chunk_budget - inserted))` to advance `inserted`. With
`--chunks-per-doc 0` (or a negative value) the inner range is empty, `inserted` never moves, and the
loop appends a synthetic document row per iteration to `doc_batch` — which is only flushed when
`len(chunk_batch) >= batch_size`, and `chunk_batch` stays empty. Result: a hang that consumes memory
until the process is killed.

**Fix.** Validate in `build_parser`:
`parser.add_argument("--chunks-per-doc", type=int, default=25, choices=None)` plus an explicit
`if args.chunks_per_doc < 1: raise SystemExit("--chunks-per-doc must be >= 1")` in `run()`, or use
`type=lambda v: _positive_int(v, "--chunks-per-doc")`.

### IN-02: `_redact` misses a percent-encoded password, and the CLI's only `except` is `RecallUnmeasurable`

**File:** `backend/app/services/recall_eval.py:175-188`; `scripts/measure-recall.py:239`

`urlsplit(dsn).password` returns the **encoded** form, so a DSN carrying `p%40ss` is redacted against
the literal `p%40ss` while asyncpg decodes it to `p@ss` — a driver message quoting the decoded value
survives `_redact`. Separately, `main()` catches only `RecallUnmeasurable`; any other exception
(e.g. an `asyncpg` error raised mid-Layer-1, outside the wrapped paths) propagates as an unredacted
traceback. The exit code stays non-zero, so the exit-code contract holds; only T-241-01's
"the password never reaches a printed line" claim is weakened.

**Fix.** `password = urllib.parse.unquote(urlsplit(dsn).password or "")` and redact both forms; wrap
`main()`'s `asyncio.run` in a broad `except Exception as exc:` that prints
`_redact(str(exc), args.dsn)` to stderr and returns `_EXIT_UNMEASURABLE`.

### IN-03: `_PROBE_CACHE_VERSION` is write-only

**File:** `backend/app/services/recall_eval.py:782`, `:807`

Written into every cache file, never read. Covered by the fix in `WR-04`; listed separately because
a version field nobody checks reads as a guarantee that is not there.

### IN-04: the "no concatenated SET" source fence matches one spelling, not the property

**File:** `backend/tests/unit/test_241_hnsw_knobs.py:336-350`

```python
assert 'f"SET' not in body and "f'SET" not in body
```

The shipped statements do not start with `SET` at all — they are
`SELECT set_config('hnsw.ef_search', $1, true)`. So
`f"SELECT set_config('hnsw.{name}', $1, true)"` — the exact injection this fence is named for, with
the GUC **name** interpolated — passes it. The behavioural sibling
(`test_the_guc_name_is_a_literal_and_only_the_value_is_bound`) does catch value interpolation via its
`"$1" in sql` assertion, so the real risk is covered; the source fence is the weaker of the pair and
reads stronger than it is.

**Fix.** `assert not re.search(r'f["\'].*set_config', body, re.I)` alongside the existing checks.

### IN-05: the 12-line G-5 landing cap counts only lines containing `hnsw` / `retrieval_tuning`

**File:** `backend/tests/unit/test_241_hnsw_knobs.py:466-495`

`_hnsw_lines_in_retrieval_service()` selects lines by substring, so logic added under a neutral name
(`if tuning_enabled:`, a helper called `_resolve_scan_budget`) does not count against the cap. The
fence is a good-faith policy marker rather than an enforceable bound; worth saying so in its
docstring so a future reader does not treat a green cap as proof the landing stayed small.

### IN-06: the iterative-scan `<select>` renders zero options when the server does not serve the list

**File:** `frontend/src/pages/SettingsPage.tsx:685`, `:1594-1600`

`hnswIterativeScanValues` initialises to `[]` and `hydrate` uses `?? []`, so a backend predating the
field (or any response where the key is missing) renders an empty picker with a blank value while
state still holds `"off"`. Similarly, a stored value that is not in the served list leaves the
`<select>` displaying the first option while `hnswIterativeScan` holds the stored one — what is shown
and what Save sends disagree.

**Fix.** Fall back to `["off"]` when the served list is empty, and render the stored value as an
extra `<option>` when it is not in the list (the same "unmapped mode falls back to its raw value"
principle the label map already applies).

### IN-07: `test_the_config_defaults_are_the_minimal_hardcoded_values_d09_names` reads a developer's `.env`

**File:** `backend/tests/unit/test_241_hnsw_knobs.py:71-78`

`env_settings.hnsw_ef_search` is a `BaseSettings` field, so `HNSW_EF_SEARCH=200` in `backend/.env`
turns this case — and `test_the_val_fallback_literal_is_the_same_number_config_holds`, and
`test_the_memory_companions_are_hardcoded_only_and_never_settings` — red on the canonical gate, which
has zero headroom above 71. Pin the class default instead:
`Settings.model_fields["hnsw_ef_search"].default == 40`.

### IN-08: `recall_eval.py` is a dev measurement harness living inside the shipped backend package

**File:** `backend/app/services/recall_eval.py`

`241-02` states its rationale for putting the bench builder under `scripts/` explicitly: *"a throwaway
harness must not acquire a hot-file-ledger obligation nor a place in the shipped `backend/app`
package."* The measurement harness — 981 lines, imported by one CLI and one test, imported by nothing
under `backend/app` — sits in `app/services/` and now carries a ledger row. Not a defect (the
`openai_service` import is lazy, so it costs nothing at import time), but the two sibling harnesses
of one phase were placed by opposite rules and only one rule is written down.

---

## What was checked and found sound

Recorded so the next reviewer does not re-derive it:

- **GUC injection (T-241-14).** `retrieval_tuning.py:96-99` — one statement constant per GUC, name
  inside the literal, value as `$1`. No path composes a GUC name. `set_config`'s third argument is
  `true` in all four statements and is asserted as an argument, not described in a comment.
- **Pool leakage (T-241-15).** `_call_as_user` applies the knobs inside the transaction
  `get_user_pg_connection` already opens; the ordering ("knobs before the fetch, on the same
  connection") is driven by a test, and a call with neither knob is byte-identical to the shipped one.
- **Memory companions (T-241-16).** Absent from `UserEffectiveSettings.model_fields` and from
  `SettingsUpdate.model_fields`, asserted by name; reachable only from `config.py`; applied only after
  `iterative_scan` was accepted.
- **Bounds served, not re-typed.** `FullSettingsResponse` carries floor/ceiling/enum from the single
  `user_settings.py` home; `settings_api.HNSW_EF_SEARCH_FLOOR is us.HNSW_EF_SEARCH_FLOOR` is asserted;
  the frontend fixture serves `17` / `823` so a hardcoded copy in the component could not pass.
- **The `auth.uid()` stub and the signup-trigger drop are bench-only.** `PRELUDE_SQL` is a Python
  string inside `scripts/`, executed against the freshly-created `recall_bench` connection only;
  `git diff` shows no `supabase/` byte carrying it; the `ALTER DEFAULT PRIVILEGES` widening likewise
  runs only on the bench connection. The source connection is opened with server-enforced
  `default_transaction_read_only = on`.
- **Migration 176.** Filename matches `^[0-9]+_[a-z0-9_]+\.sql$`, columns nullable, both CHECKs
  `IS NULL OR ...`, `DROP CONSTRAINT IF EXISTS` before each `ADD` so a re-paste is idempotent.
- **`full-schema.sql`** is a clean `+18` regeneration inside the existing `app_settings` DDL — two
  columns, two constraints, two `COMMENT ON COLUMN`. No hand edit.
- **`vitest-count-gate.cjs`** — the `shell: false` / `process.execPath` fix is correct;
  `args.slice(1)` correctly drops the literal `"vitest"` the npx form needed, and the
  `require.resolve("vitest/package.json")` + `bin` join avoids `ERR_PACKAGE_PATH_NOT_EXPORTED`. The
  `running: npx …` log line is now cosmetically wrong but the following line says so.

---

_Reviewed: 2026-09-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_⚠ This review is part of a SOLO phase. It is an adversarial read of the diff, not the independent
§6.3 review Phase 241 still owes (241-04-SUMMARY, OWED #3)._
