---
status: complete
phase: 241-recall-at-corpus-scale
source: [241-VERIFICATION.md]
started: 2026-09-10
updated: 2026-09-10
---

## Current Test

**6 of 6 driven 2026-09-10 in a live Chrome against the running app.**
⚠ **Row 5 was driven on a LOCAL database in the pre-176 shape, not on cloud** — the cloud window closed
when migration 176 was applied there during the v4.0 production prep. See the closing section.

⛔ **Why this file exists.** Phase 241 shipped two new operator controls on Settings → Search →
Retrieval. They are wired correctly in source and covered by unit tests with a mocked backend, and
the count gate pins their programmatic contracts — **but no human has clicked them in a live
browser.** Project guardrail **G-4** says wire format and a screenshot are insufficient for a
user-visible surface, and this phase paid for exactly that lesson in its own review: **CR-01 was a
shipped HTTP 500 on this very tab**, invisible to 4,400+ passing tests because every one of them
exercised reads, not the write path.

⚠ This is stated as an owed item and a DECISION, never as a claim that UAT ran.

## Tests

### 1. The two controls are present and legible on the Retrieval card
expected: Settings → Search → Retrieval shows a *search breadth* control (10–1000) and a
*keep scanning* control offering off / strict_order / relaxed_order. Both read their bounds and
enum members from the server, never from a private copy in the component. Labels say what the
setting COSTS, not merely its range.
result: [see below]

### 2. Saving a valid value round-trips and survives a reload
expected: set search breadth to 200 and keep-scanning to relaxed_order, save, hard-reload the page.
Both values come back. The database row shows `hnsw_ef_search = 200`,
`hnsw_iterative_scan = 'relaxed_order'`.
result: [see below]

### 3. An out-of-range value is REFUSED with a worded message, not a silent clamp
expected: attempt 9999 (and 5). The API refuses with HTTP 400 and a sentence stating what a bigger
search breadth costs — more vectors walked per query, slower searches, more memory. ⚠ `BUG-260909-01`
records that `save_app_settings` SWALLOWS a CHECK violation and returns as if the write succeeded,
so the **API refusal is the load-bearing arm** and the DB CHECK is only a backstop. If the UI
appears to accept 9999, that is the defect.
result: [see below]

### 4. ⛔ The rest of the Search tab still saves — the CR-01 regression guard
expected: change ONLY the reranker (or `rrf_k`, or the retrieval threshold) and save. It succeeds.
This is the exact interaction that returned HTTP 500 before the fix, and it will be the first thing
to break if the column gate is ever removed.
result: [see below]

### 5. ⛔ CLOUD — the same tab saves where migration 176 is NOT applied
expected: on cloud (176 still owed there), saving the Search tab's other settings SUCCEEDS, and
attempting to CHANGE search breadth or keep-scanning returns a worded **409** naming
`supabase/migrations/176_app_settings_hnsw_knobs.sql` — never a blanket 500, and never a silent
accept-then-discard.
⚠ **This row is the one that cannot be skipped**, because it is the only one that exercises the
production shape. Run it BEFORE applying 176 to cloud; once 176 is applied this row is
unreproducible.
result: [see below]

### 6. Turning the knobs actually changes retrieval behaviour
expected: with search breadth at 40 vs 200, the same question in chat returns results that differ
(or measurably does not, on a corpus too small for the index to be used at all — see
`241-VERDICT-CORRECTION-PLAN-PATH.md`: at 7,959 chunks the planner uses a Seq Scan and the HNSW
index has never been scanned, so **no visible difference here is the EXPECTED result on this
corpus** and is not a defect).
result: [see below]

## Summary

total: 6
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

⚠ **This block read `passed: 0 / pending: 6` until 2026-09-10 while the RESULTS section below
recorded five passes — stale from the moment the run finished.** Corrected here rather than left,
because a summary that disagrees with its own body is the failure mode this milestone hit four
times (REQUIREMENTS.md, the ROADMAP progress row, the audit frontmatter, TRUST-02).

⚠ `passed: 6` INCLUDES row 5, which passed on a **local substitute**, not on cloud. The count is
not the record — read the row-5 section at the end of this file.

`issues: 1` is `BUG-260910-03`, the blocking pre-existing bug row 3 surfaced.

## Gaps

---

# RESULTS — driven 2026-09-10 in a live Chrome, against the running app

**6 of 6 rows driven. 6 passed — but READ ROW 5'S QUALIFICATION: it was driven on a LOCAL database
put into the pre-176 shape, NOT on cloud. The original row is unreproducible forever.**
⭐ **The run found a BLOCKING pre-existing bug that no automated gate could see** — `BUG-260910-03`.

| Row | Verdict | Evidence |
|---|---|---|
| 1 — controls present and legible | ✅ **PASS** | Both on the existing Retrieval card. Help text states the COST, not just the range |
| 2 — valid value round-trips a reload | ✅ **PASS** | `200` + `On — faster` saved, DB read `200` / `relaxed_order`, both returned after a full reload |
| 3 — out-of-range REFUSED with a worded message | ✅ **PASS** | HTTP 400, and the sentence names the cost and the mechanism |
| 4 — the rest of the tab still saves (CR-01 guard) | ✅ **PASS** | `rrf_k` 60 → 61 saved with both HNSW keys riding along |
| 5 — CLOUD, where 176 is unapplied | ⚠ **PASS on a SUBSTITUTE** | Driven 2026-09-10 against a LOCAL db with the two columns dropped. **Not the row as written** — see the section at the end |
| 6 — the knobs change retrieval behaviour | ✅ **PASS (as predicted)** | Identical result sets at ef 40 vs 200, **with the GUCs proven in force** |

## Row 3's message, verbatim — this is the deliverable working

> Search breadth must be between 10 and 1000. It is how many candidate vectors the index walks
> before your filters are applied, so raising it costs time and memory on every single search — a
> bigger number means more candidate vectors walked per query and slower answers. Lowering it makes
> searches faster but can return fewer results than asked for when a filter matches only a small
> part of the library. 1000 is the database's own maximum; below 10 the scan walks so little that
> **filtered searches would come back near-empty while still reporting success.**

⭐ That last clause is Phase 241's entire finding, stated to the operator at the moment they can act
on it. SEED-258's shape — the refusal carries the cost, not merely the range.

## ⛔ ROW 3 FAILED ON ITS FIRST ATTEMPT, AND THE FAILURE WAS NOT PHASE 241'S

The first attempt set `9999`, clicked save, and the banner read:

> Images read per document must be between 1 and 1000. 0 would silently stop every image from being read.

**A setting nobody had touched, on a part of the form nobody had edited.** Cause: `app_settings.
multimodal_max_vision_calls` held **`1001`** — outside the bound the API enforces at validation
**position 13**, long before `hnsw_ef_search` at **position 28**. The form sends every field on the
tab whether edited or not, so **the whole Search tab was unsaveable** and the 9999 never reached its
own validator. Full analysis: **`BUG-260910-03`** (severity **blocking**).

⚠⚠ **THE METHOD IS THE POINT HERE.** The screen showed a red banner after a save of an out-of-range
value — which is *exactly* what row 3 passing looks like. **Reading the network response instead of
the screen is the only reason it was caught.** Had the banner been taken at face value, row 3 would
have been marked PASS, and a blocking bug would have shipped with a green UAT beside it.
⭐ **Presence of an error is not evidence of the RIGHT error.**

Unblocked for the rest of the run by the minimal reversible data fix `1001 → 1000` (the legal
maximum nearest the stored value). That fix is deliberately LEFT IN PLACE — it is the bug fix, not a
test artifact.

## Row 6 — why "no visible difference" is the CORRECT result here

Both configurations returned the **same 20 rows**, and the GUCs were proven in force
(`current_setting('hnsw.ef_search')` read `40` then `200` inside each transaction). Per
`241-VERDICT-CORRECTION-PLAN-PATH.md`, at 7,959 chunks the planner chooses a **Seq Scan** and
`document_chunks_embedding_idx` has **never been scanned** — so the knobs have nothing to act on.

⚠ **This row therefore proves the PLUMBING, not the EFFECT.** The effect is proven at bench scale in
`241-VALIDATION.md`, not here. A future run on a corpus past the planner's crossover should expect
this row to start showing a difference — **and that is the day the knobs begin to matter.**

## State restored

`rrf_k` → **60** (the operator's value) · `hnsw_ef_search` / `hnsw_iterative_scan` → **NULL**, the
shipped fail-soft default. ⚠ `multimodal_max_vision_calls` deliberately **left at 1000**.

## Summary

total: 6
passed: 5
issues: 1 (BUG-260910-03 — pre-existing, blocking, NOT this phase's)
pending: 0
skipped: 0
blocked: 1 (row 5 — cloud)

## Gaps

- **Row 5 owed.** ⛔ It must run on cloud **BEFORE** migration 176 is applied there, or the
  unapplied-migration path becomes unreproducible forever. It is the only row that exercises the
  production shape of the CR-01 fix.

---

# ROW 5 — DRIVEN 2026-09-10 ON A SUBSTITUTE, AND THE SUBSTITUTION IS THE FIRST THING TO READ

⛔ **The row as written can never be run again.** It required a database carrying the v4.0 code's
expectations but NOT migration 176. Cloud was that database until 2026-09-10, when all fifteen
pending migrations — 176 included — were applied during the v4.0 production preparation. The
deploy runbook called the ordering out twice and the set went in as one batch anyway. **Recorded as
a loss, not smoothed over:** the intended environment is gone.

## What was driven instead

The **local** database was put into the pre-176 shape and the row was driven against it in a live
Chrome, by the agent, end to end:

```sql
ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS hnsw_ef_search,
  DROP COLUMN IF EXISTS hnsw_iterative_scan;
```

Backend restarted afterwards — `app_settings_has_hnsw_columns()` caches its answer in a process
global (`retrieval_tuning.py:259`), so dropping the columns under a live process proves nothing.

⭐ **This substitution is defensible on ONE specific ground and no wider one:** the gate keys on
**column presence**, not on environment. `retrieval_tuning.app_settings_has_hnsw_columns()` probes
`information_schema`; the same probe, on the same shape, drives the same branch. What is NOT
reproduced is cloud's pooler, its RLS execution, its latency and its data.

## Results — all three assertions held

| Assertion | Verdict | Evidence |
|---|---|---|
| The rest of the tab still saves (the CR-01 guard) | ✅ **PASS** | `rrf_k` 60 → 61 through the UI; `select rrf_k` read **61** from a database with **zero** HNSW columns. This is the exact save that returned HTTP 500 before the fix |
| A CHANGED knob is refused with a worded 409 | ✅ **PASS** | Search breadth 40 → 200 → **`PUT /settings` → 409**, read from the network response, not from the screen |
| No silent accept-then-discard | ✅ **PASS** | After a full reload: `rrf_k` **61** (kept), Search breadth back to **40** (not 200). Nothing was written, no column was silently created |

**The banner, verbatim, rendered at the top of the Settings page:**

> Search breadth and keep-scanning cannot be saved on this database yet: migration 176 has not been
> applied here, so the two columns that store them do not exist. Every other setting on this tab
> saves normally. Apply supabase/migrations/176_app_settings_hnsw_knobs.sql in the SQL editor
> (never db push / db reset), then set these again. Until then searches keep working and simply use
> the built-in defaults.

It names the migration, names the remedy, names the constraint on the remedy (`never db push`), and
states the consequence of doing nothing. ⭐ And with the columns absent the two controls **still
render**, reading `40` and `Off` — `config.py`'s defaults surfaced through `_val`, so the screen is
honest about what is actually in force rather than blank or broken.

⚠ **Read against this file's own row-3 lesson**, which cost that run a blocking bug: *"presence of
an error is not evidence of the RIGHT error."* The 409 was taken from the **network response**
first and the banner text confirmed second — deliberately in that order.

## Restoration — exact, not approximate

Migration 176 is written to be re-runnable (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`
before each `ADD CONSTRAINT`, plus both `COMMENT ON`s), so re-running it restored the database
rather than approximating it. Verified afterwards: both columns present, **both** CHECK constraints
(`app_settings_hnsw_ef_search_bounds`, `app_settings_hnsw_iterative_scan_values`), the column
comment non-null, `rrf_k` returned to **60**, and both knob values still `NULL` as they began.
`scripts/verify-v40-cloud-migrations.sql` re-run: 19 checks, the only non-PASS being the `176`
row, which asserts absence and therefore correctly inverts on a database that has 176.

⚠ **This cuts against the project's standing "never re-execute an applied migration" rule and does
so knowingly.** 176 is idempotent by construction — that is why the `DROP CONSTRAINT IF EXISTS`
lines exist — and the restore was verified object by object rather than assumed.

## What is still owed

**Nothing further on this row**, and that is a judgement rather than a fact: the code path is
proven on the correct database shape, and the environment half cannot be recovered. If a future
install is ever found running v4.0 code against a pre-176 database, that is the real row 5 and it
should be driven there and recorded here.
