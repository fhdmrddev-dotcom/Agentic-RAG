# 242-01 — SUMMARY

**Executed 2026-09-11** · base `7ac71638ecf25e234399eeba81ef996742d414bc` · branch `develop`
**Commits:** `d3eae092b` (fence + migration 178 + apply script + full-schema), plus this record.
**Requirement:** SHIP-01 · **ROADMAP SC#3.**
⚠ **Solo run.** No independent reviewer exists (Gemini unavailable since 2026-09-09). Everything
below that is mechanical — a driven RED, a row count, a `pg_constraint` read — stands on its own;
the judgement calls are flagged as such.

---

## The headline, and it changed the plan

⚠⚠ **`242-CONTEXT.md`'s `<deferred>` item was measured FALSE, and the plan was rewritten before a
line was executed.** It reads:

> `vision_max_pages`, `retrieval_top_k`, `rrf_k` and the HNSW knobs all carry Python-side bounds
> with no schema constraint. **Sweeping the rest is a phase, not a gap.**

Driven against `pg_constraint` on the live local database:

```
select conname from pg_constraint where conrelid='public.app_settings'::regclass
  app_settings_extraction_table_engine_pdf_check
  app_settings_hnsw_ef_search_bounds              ← migration 176
  app_settings_hnsw_iterative_scan_values         ← migration 176
  app_settings_pkey
  app_settings_source_max_file_size_mb_bounds     ← migration 174
```

- **Three of the five named columns were already constrained.** 174 and 176 shipped CHECKs in the
  exact `CHECK (col IS NULL OR (col >= lo AND col <= hi))` shape 178 was about to "invent", each
  with a header comment calling the CHECK *"the backstop for a hand-edit in this very SQL editor"*.
- **`retrieval_top_k` and `rrf_k` carry no bound AT ALL** — `settings.py:535-541` is a bare
  `is not None`. They are not *bounded-without-a-CHECK*; they are **unvalidated**, a different and
  arguably worse finding.

⛔ **`242-CONTEXT.md:181` — *"`supabase/migrations/` | no CHECK on `app_settings` bounded columns |
178 is the first"* — IS FALSE. 174 was first.** Recorded here rather than silently corrected there.

### The declared deviation, and why it is the right call

**Migration 178 covers TWO columns, not one:** `multimodal_max_vision_calls` **and**
`vision_max_pages`. The deferral's premise was *"sweeping the rest is a phase"* — sized against
five columns. With three already done, the remainder is **one column, six lines, in a pattern this
repo already established twice**, with no design work left: its bound is two literals exactly like
the one being added.

The consequence is the point: **the fence's allow-list is EMPTY.** ROADMAP SC#3 asks for *"the
general fix, not the specific one"*, and the ROADMAP's own failure list names the alternative —
*"the bound is fixed for `multimodal_max_vision_calls` only, and the next settings column with a
Python-side bound reproduces the identical outage."* Leaving one known column unconstrained when
the fix is six lines would have shipped that failure knowingly.

⚖ **This is a judgement call made without the operator**, on a deferral the operator did not
personally set (it was Claude's discretion at discussion time, per `242-DISCUSSION-LOG.md`'s
*"Claude's discretion"* section). It is reversible by dropping one constraint.

---

## What shipped

### 1. The class fence — `backend/tests/unit/test_242_settings_bounds_have_schema_constraints.py`

**17 cases.** It parses `api/settings.py` with `ast` (never imports it, never regexes a formatted
line) and requires every numeric bound to have a matching `CHECK ( … )` in `supabase/migrations/`.

**Driven RED before migration 178 existed** — the output, verbatim:

```
FAILED ...::TestEveryBoundIsAlsoAConstraint::test_no_python_bound_lacks_a_schema_constraint
FAILED ...::TestEveryBoundIsAlsoAConstraint::test_the_two_columns_migration_178_closes
2 failed, 11 passed
```

with the failure naming both columns:

```
  · app_settings.multimodal_max_vision_calls
  · app_settings.vision_max_pages
```

**After the migration: `17 passed`** — green on the migration, not on an edit to the test.

**TWO detectors, because one idiom is not a fence** (the plan-checker's W-1, taken):

| | sees | on `settings.py` |
|---|---|---|
| `bounded_fields` | `if not lo <= body.x <= hi:` — the idiom all four sites use today | `{hnsw_ef_search, multimodal_max_vision_calls, source_max_file_size_mb, vision_max_pages}` |
| `bounded_fields_loose` | ANY ordering comparison of `body.x` against a number or a `*_FLOOR`/`*_CEILING`/`*_MIN`/`*_MAX`/`*_LIMIT` name | the same four |

⭐ The loose one exists because **a future phase has no obligation to use the narrow idiom.**
`if body.x < LO or body.x > HI:` is perfectly ordinary and invisible to the narrow detector — §2b
runs the same contract over the loose one, with its own positive control using a shape the narrow
detector provably cannot see (asserted both ways in the same case).

**Every control is driven, not assumed:**

| case | proves |
|---|---|
| §3 | the narrow detector sees a synthetic `brand_new_knob` bound |
| §3-neg ×2 | a bare `is not None` is NOT a bound; a bound on a local variable is NOT a request field |
| §2b-control | the loose detector sees `< LO or > HI` and `> CEIL`, which narrow returns `set()` for |
| coverage | `narrow ⊆ loose` on the real source |
| §4 ×4 | the scanner finds a constraint that exists (174's); refuses a name that has none; refuses a column named ONLY in a `--` comment; and finds the same name once the comment marker is gone |
| **§5b** | **every allow-list entry genuinely LACKS a constraint** |

⭐ **§5b is the plan-checker's catch and it is the most valuable case in the file.** The first draft
of this plan exempted three columns on the CONTEXT's word, two of which were already constrained —
and **§5 could not have caught it**, because §5 only asserts an entry is a real *bound*, never that
it genuinely lacks a *constraint*. Without §5b an allow-list accumulates fictional debt forever.

**What the fence CANNOT see is written into the test body, not hoped away:** a Pydantic
`Field(ge=, le=)` bound on `SettingsUpdate`; a bound that leaves `settings.py`; migration HISTORY vs
live schema (a CHECK added in N and dropped in N+1 still reads green); the table the CHECK is on;
and whether the SQL bound AGREES with the Python one. ⚠ **If validation ever moves to Pydantic, §1
fails LOUDLY** (the detected set empties against an equality) rather than passing vacuously — that
is deliberate, and the retirement instruction says *rewrite the detector, never delete the
requirement*.

### 2. `supabase/migrations/178_app_settings_vision_calls_bound.sql`

Clamp **first** (a CHECK cannot be added while a row violates it — the order is load-bearing, and
the file says so), then `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` so the file is re-runnable,
then a `COMMENT ON COLUMN` for each carrying the SEED-226/SEED-227 reasoning into the schema itself.

- **Generalised, never keyed to `1001`.** `grep -c 1001` in the migration is **0**. Local held
  `1000` (the operator's hand fix); cloud holds `100`. The clamp repairs whatever is out of range.
- **NULL stays legal**, matching 174/176's *"NULL MUST STAY LEGAL"*: `_val()` falls back to the
  `config.py` default on NULL, and a pre-044 restore has no column at all.
- Reset-to-default and fail-the-migration both rejected, with reasons, in the file header (D-242-01).

### 3. `scripts/apply_migration_178.py` — applied to LOCAL, and the arms PROVEN

Hard-coded DSN `127.0.0.1:54322`, reads **no** environment variable, so it cannot reach cloud even
by accident. Full output:

```
BEFORE   rows 1 · (1000, 50) · 5 constraints
AFTER FIRST APPLY   rows 1 · (1000, 50) · 7 constraints  (+ both new)
AFTER SECOND APPLY  identical  → re-runnable, PROVEN not claimed

CLAMP POSITIVE CONTROL (inside a ROLLED-BACK transaction)
  planted 1001 -> [(1001,)], clamped -> [(1000,)]   (expect [(1000,)])
  planted    0 -> clamped -> [(1,)]                 (expect [(1,)])
NULL ARM POSITIVE CONTROL (inside a ROLLED-BACK transaction)
  planted NULL/NULL -> after re-apply -> [(None, None)]
  after ROLLBACK, live values : [(1000, 50)]  (expect [(1000, 50)])
```

⭐ **These controls are the plan-checker's B-4, and it was right that without them the whole task
was untested.** The local row was already in range and cloud's is too, so **the clamp statement is a
no-op in every environment this phase touches** — `Task 2`'s original verification (parses as SQL ·
no `db push` · no literal `1001`) and `Task 3`'s (exit 0 · row count unchanged · constraint exists)
would all have passed over a migration whose clamp was **missing entirely, or bounded wrongly, or
placed AFTER the `ADD CONSTRAINT`**. Now the clamp is driven at both ends and the NULL arm too.

⭐ **The control also proves the CHECK is enforced**, as a side effect worth naming: planting `1001`
required `DROP CONSTRAINT` first, because the constraint refused it.

### 4. `supabase/full-schema.sql` regenerated — **no `--reset`**

`44 insertions, 2 deletions`, and the diff is confined to **two known sets**:

1. 178's two CHECK constraints and two column comments.
2. ⚠ **Migration 177's RLS enablement and `user_settings` policies** — `full-schema.sql` had not
   been regenerated since 176 (`d76686821`), and 177 was applied to local at `45d1b30bd`. **This is
   a catch-up, not drift**, and it is named here because Task 4's original criterion (*"confined to
   the constraint; a large diff means drift"*) would have sent the executor either into a halt or
   into absorbing it silently.

⭐ **And the second-order worry the plan-checker raised is VOID, measured:** folding 177 into the
greenfield artifact is not "shipping an un-approved production change", because **177 is already
applied to cloud** — see §"What cloud actually holds" below.

### 5. `SEED-271` planted — on what SURVIVED the measurement

Subject changed from *"the deferred CHECK sweep"* (done) to **`retrieval_top_k` and `rrf_k` have no
bound anywhere**. `status: planted`, `trigger_when` = the next phase touching `settings.py` or
`retrieval_service.py`, **or Phase 246**, whichever comes first — Phase 246 is the natural home
because `retrieval_top_k`'s ceiling interacts with `hnsw_ef_search`, which is that phase's subject.
The seed records why this one IS a phase: a bound needs a NUMBER and a reason, and per SEED-258 /
D-241-09 the refusal sentence must carry the COST, not just the range.

⭐ **The seed's trigger is mechanically detectable**: the fence is already watching — adding a bound
to `retrieval_top_k` without a migration reds it in the commit that adds it.

---

## Gates

| gate | result |
|---|---|
| backend unit | `71 failed, 4530 passed, 2 xfailed, 2 xpassed` — **failing SET identical to `242-backend-base-set.txt`**, diffed both ways, empty. Passed 4517 → 4530 (+13, this fence). ⛔ 71 is the ceiling with zero headroom and it was not moved. |
| `check-hot-file-ledger.cjs 242` | **exit 0.** `WATCHED` is `^backend/app/` + `^frontend/src/`, so `supabase/migrations/`, `scripts/` and `backend/tests/` carry no obligation — verified in the gate's source, not assumed. |
| `git diff --stat -- backend/app frontend/src` | **EMPTY.** This plan changed no application code. |
| `grep -rn "db push\|db reset"` over 178 + the apply script | **nothing.** |
| frontend | untouched — no count gate run owed by this plan. |

---

## What cloud actually holds — read over the Supabase MCP (reads are free)

Two things were measured while discharging SC#4, and **one of them corrects the CONTEXT**:

1. ⭐⭐ **MIGRATION 177 IS APPLIED TO CLOUD.** `242-CONTEXT.md` D-242-07 says it is *"written and
   NOT applied — awaits operator authorisation"*. 177's own VERIFY block run against production
   returns **7/7 PASS**: RLS on for both tables, `anon` cannot read or write either, `anon` cannot
   execute `resize_embedding_column`, `service_role` still writes. `pg_class.relrowsecurity` is
   `true` for both; `user_settings` carries all three owner policies; `anon` is gone from both
   table ACLs. **`BUG-260911-01` is remediated in production.** The security advisor confirms it
   from the other side: **`rls_disabled_in_public` is GONE and there is no ERROR-level finding
   left.**
2. ⛔ **MIGRATION 178 IS NOT APPLIED TO CLOUD, and this plan did not apply it.**
   `exists(select 1 from pg_constraint where conname='app_settings_multimodal_max_vision_calls_bound')`
   → **false**. A cloud write needs explicit per-action operator approval. **OPERATOR-OWED.**
   ⭐ Low urgency, measured: cloud holds `multimodal_max_vision_calls = 100` and
   `vision_max_pages = 50`, both in range, so nothing is refusing a save there today. The
   constraint is the *backstop* against a future hand-edit, which is exactly what 174's header says
   its own CHECK is for.

⚠ **The 13 SECURITY DEFINER functions the advisor still flags are unchanged and expected** — 177's
header predicted precisely this, and warns that a role-by-role revoke sweep of them would silently
achieve nothing because the grant comes from `PUBLIC`.

---

## Deviations from the plan, each with its reason

| # | Deviation | Reason |
|---|---|---|
| 1 | Migration 178 covers **two** columns, not one; the allow-list is **empty** | The CONTEXT's five-column deferral was measured to be one column. See "the declared deviation" above. |
| 2 | A **second, shape-independent detector** (`bounded_fields_loose`) and §2b | Plan-checker W-1: the narrow idiom is not the only way to write a bound, and §3's control used the same idiom it was controlling. |
| 3 | **§5b** added | Plan-checker B-1: §5 cannot catch an already-constrained allow-list entry — the exact error the first draft made. |
| 4 | The apply script grew **clamp and NULL positive controls** | Plan-checker B-4: both arms are no-ops in every environment this phase touches, so every stated verification passed over an untested clamp. |
| 5 | Task 4's criterion widened to **two** known diff sets | Plan-checker B-5: 177 was applied to local and `full-schema.sql` had not been regenerated since 176. Predicted and then observed exactly. |
| 6 | SEED-271's **subject** changed | Its planned subject was discharged by the measurement; what is left is a different finding. |

## Owed, and named rather than left implicit

- ⛔ **Apply migration 178 to CLOUD** — operator action, per-action approval. Not urgent (cloud's
  values are in range); it is a backstop.
- The `242-CONTEXT.md` `<code_context>` row *"178 is the first"* and the `<deferred>` item are both
  **false**. Corrected here and in SEED-271; the phase's VERIFICATION carries them forward.
- ⚠ **ROADMAP `#### Phase 242` names the migration `177_app_settings_vision_calls_bound.sql` in two
  places.** `177` is `BUG-260911-01`'s RLS fix; this phase's migration is **178**. A phase whose
  SC#5 is *"the register carries a measurement"* must not leave its own register wrong about which
  migration it shipped — fixed in the SC#5 fast task.
