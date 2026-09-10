# ⚠ 241-04's cloud parity test is REFUTED — a NULL does not mean pgvector < 0.8

Measured 2026-09-10, before 241-04 was dispatched. The original claim is preserved
below rather than overwritten, because the claim being WRONG is the finding.

## What the plan says

`241-04-PLAN.md` `<interfaces>`, verbatim:

> ⚠ On pgvector < 0.8 the third statement returns NULL for `iterative_scan` rather than erroring
> (`current_setting(..., true)` is the missing_ok form) — a NULL there IS the parity answer.

D-14 gates `hnsw.iterative_scan` as the production remedy on this test. So a false
negative here does not merely mis-record a row — it **withdraws the remedy** on no evidence.

## What was measured

The operator ran the parity query against CLOUD and it returned:

    { "ef_search": null, "iterative_scan": null }

Read through the plan's rule, that says cloud is below pgvector 0.8 and `iterative_scan`
cannot be claimed. **It says no such thing.** The identical query was run against the LOCAL
server, which is known to be pgvector **0.8.0**:

    LOCAL pgvector: 0.8.0
    --- fresh session, before any vector op ---
      ef_search      : None
      iterative_scan : None
    --- same session, AFTER touching a vector op ('[1,0,0]'::vector <=> '[0,1,0]'::vector) ---
      ef_search      : 40
      iterative_scan : off

**Same session. Same query. NULL, then 40/off.** The `hnsw.*` GUCs are registered by the
extension when it is first used in a session; `current_setting(..., true)` on an
unregistered GUC returns NULL. So NULL is indistinguishable between:

  * pgvector older than 0.8 (the GUC does not exist), and
  * pgvector 0.8+ in a session that has not yet touched a vector operation.

⭐ **The local server is the control that breaks the inference, and it was already in hand.**
The plan asserted the NULL semantics without ever running the query against a server of a
KNOWN version — which is the only thing that could have falsified it.

## A second, independent defect in the same test

The parity block is FOUR statements pasted together. **The Supabase SQL editor returns only
the LAST statement's result set**, so `SELECT extversion ...` and `SELECT version()` — the two
statements that actually answer the question — never came back at all. The operator's paste
was complete and correct; the test could not surface its own answer.

## The corrected probe — one statement, GUCs forced to register first

```sql
SELECT
  (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS pgvector,
  version()                                                       AS postgres,
  ('[1,0,0]'::vector <=> '[0,1,0]'::vector)                       AS forces_guc_registration,
  current_setting('hnsw.ef_search', true)                         AS ef_search,
  current_setting('hnsw.iterative_scan', true)                    AS iterative_scan;
```

One statement, so no editor can hide it. The `<=>` forces the extension to load before the
two `current_setting` calls are evaluated, so a NULL in THIS result is real evidence.

⛔ **`pgvector` is the load-bearing column, not `iterative_scan`.** Read the version and
compare it to 0.8; never infer the version from the GUC. If the version column is NULL the
extension is not installed at all, which is a different and larger finding.

## Consequence for 241-04

Task 1's acceptance must read the VERSION, not the NULL. Task 3's D-14 verdict —
*"if cloud is below 0.8 the verdict says `ef_search` alone carries production"* — stands
unchanged as a rule; what changes is the evidence that is allowed to trigger it.

---

## ✅ RESOLVED 2026-09-10 — cloud is at EXACT parity, and the refuted probe would have hidden it

The corrected single-statement probe was run by the operator against CLOUD and returned:

```json
{
  "pgvector": "0.8.0",
  "postgres": "PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit",
  "forces_guc_registration": 1,
  "ef_search": "40",
  "iterative_scan": "off"
}
```

| | Local (measured 241 start) | **Cloud (measured here)** |
|---|---|---|
| pgvector | 0.8.0 | **0.8.0** |
| PostgreSQL | 17.6 | **17.6** |
| `hnsw.ef_search` | 40 | **40** |
| `hnsw.iterative_scan` | off | **off** |

**D-14's gate is SATISFIED.** `hnsw.iterative_scan` exists on the production server, so the
phase may claim it as the remedy. The ROADMAP's fallback verdict — *"if cloud is below 0.8 the
verdict says `ef_search` alone carries production"* — does NOT fire.

⭐ **This is why the refutation mattered, and it is the whole lesson.** The original probe
returned `{ "ef_search": null, "iterative_scan": null }` on a server that is, in fact, byte-for-byte
at the same version as local. Read through the plan's stated rule, that NULL meant *"cloud is below
0.8, withdraw the remedy"*. **The remedy would have been withdrawn from a server that fully
supports it**, and `241-VALIDATION.md` would have recorded a hardware limitation that does not
exist — an unfalsifiable claim, since nobody re-runs a verdict.

The cost of catching it was one query against a server of a KNOWN version. That control was
available the entire time.

⚠ **Carry this into the verdict.** `forces_guc_registration: 1` is not decoration — it is the
evidence that the two `current_setting` values in the same row were read AFTER the extension
loaded. A future re-run that drops the `<=>` term gets NULLs again and means nothing by it.
