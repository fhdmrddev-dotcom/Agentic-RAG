# Phase 242 — Ship It, and Prove What Already Shipped · CONTEXT

**Discussed:** 2026-09-11 · **Milestone:** v4.1 Ship It & Feel It · **Requirements:** SHIP-01..04

<domain>

Make the search settings saveable on the database production serves from, turn a Python-only bound
into a schema constraint, and replace the register's SHIP claims with measurements.

⛔ **THE PHASE SHRANK DURING DISCUSSION, BECAUSE THREE OF ITS FOUR REQUIREMENTS WERE MEASURED DONE.**
Cloud was read directly over the Supabase MCP (read-only OAuth, project `esnfauggawekgbvkqkyf`) —
the read-capable connection the phase was written as **blocked on**. What remains is genuinely
preventive work plus one tool repair, and that is a smaller phase than the roadmap scoped.

</domain>

<measurements>

**All taken against CLOUD on 2026-09-11 via `mcp__supabase__execute_sql`. Nothing here is inferred.**

| Claim as scoped | Measured | Verdict |
|---|---|---|
| `SHIP-01` — Search tab unsaveable, **blocking** | cloud `multimodal_max_vision_calls = 100` (the column default), in range | ⛔ **NOT blocking anywhere.** The defect was local-only, and the local data fix (`1001 → 1000`) already cleared it |
| `SHIP-02` — 241's UAT row 5 owed, expiring | `241-HUMAN-UAT.md` = `status: complete`, 6/6; row 5 ran on a local substitute; retired in writing at `dbd63864b` | ✅ **Spent and retired.** Not re-plannable |
| `SHIP-03` — 15 migrations owed to cloud | **17 structural checks PASS.** `153, 154, 155, 156, 166..176` all present | ✅ **Landed.** See the two false alarms below |
| `SHIP-04` — production push owed | `production` = `e65610ac2`, contains `1f313670b` (2026-09-10). `git log production..develop` = 2 commits, both v4.1 planning docs | ✅ **Already happened** |

⚠ **TWO FALSE ALARMS, AND BOTH WOULD HAVE BEEN BELIEVED.**

1. **`156` read FAIL and the database is fine.** `scripts/verify-v40-cloud-migrations.sql` checks the
   grant via `information_schema.column_privileges`, which **only shows grants visible to the
   connecting role** — it returned empty for *every* column, not just the one. Re-read authoritatively
   from `pg_attribute.attacl`: `default_ingest_visibility` carries
   `authenticated=arw/postgres, service_role=arw/postgres` — exactly migration 156's grant set, and
   deliberately wider than every other column (which carry `r` only). **The script is wrong, not the
   database.** ⭐ This is the third time the `connector_connections` column-grant trap has been in
   play on this table, and the first time the *checker* was the thing at fault.
2. **`176` read FAIL by design.** That row asserts the HNSW knobs are **absent** — it was written to
   guard the pre-deploy window. They are present, so the FAIL is the expected inversion and confirms
   176 landed.

⭐ **THE RECALL CLIFF CANNOT FIRE IN PRODUCTION, AND THIS WAS MEASURED RATHER THAN ASSUMED.**
Cloud holds **2,068 chunks · 47 documents · 1 distinct owner · 1 distinct org**, and
`hnsw_ef_search` / `hnsw_iterative_scan` are both `NULL` (server default 40 applies).
`QUEUE-06`'s degradation needs a tenant owning a small **fraction** of a large corpus — 0.2% of
100k chunks at the measured reading. Here the filter selects **100%** of a corpus **50× smaller**.
**`RECALL-01` is scale-ahead work, not a live production defect.** It stays in Phase 246 and does
not get promoted.

</measurements>

<decisions>

### D-242-01 — Migration 178 CLAMPS an out-of-range row; it never resets to default (operator)

A CHECK cannot be added while a row violates it, so the value must move first. ⚠ **Renumbered 177 → 178 on 2026-09-11** — `177` was taken by the security fix found during this
very discussion (`BUG-260911-01`), which ships first because it is a live production exposure.

**Clamp:**
`least(greatest(multimodal_max_vision_calls, 1), 1000)`.

⚠ **Generalised, never keyed to the one value we happened to see.** The local row was `1001`; cloud
is `100`. The migration repairs *whatever* is out of range, in any environment, and is safe to
re-run.

**Rejected — reset to the column default (`100`):** it silently makes every ingestion read 10×
fewer images than the operator asked for, and nothing announces it. That is the same class of fault
as the bug being fixed. **Rejected — fail the migration:** honest, but blocks every environment on
manual work.

### D-242-02 — The payload sends CHANGED FIELDS ONLY; not merely better error reporting

`SettingsPage.tsx:888` sends all ~22 fields unconditionally, so any single stored value out of
range takes the whole tab down — including fields the operator never touched.

**Changed-fields-only makes the class impossible.** Reporting all failing fields at once only makes
the failure *legible*; you can still be blocked by a value you never typed.

⭐ **The deciding second reason:** `hnsw_ef_search` and `hnsw_iterative_scan` ride this same payload
(Phase 241 D-09). Under the current shape, **Phase 246's remedy is hostage to any unrelated stored
value drifting out of range.** Changed-fields-only unblocks 246 permanently.

⚠ **Smaller than it sounds — the baseline already exists in the component.** The confirm-on-save
gate already diffs against stored settings (`embeddingModel !== s.embedding_model`,
`SettingsPage.tsx:~905`). The diff source is present; it is not being used for the payload.

### D-242-03 — A refusal names the STORED value as the cause, and never presents it as a rejection of what was just typed

Today: *"Images read per document must be between 1 and 1000."* — truthful about the rule, actively
misleading about the cause, and pointing at a field on a part of the form the operator did not edit.

The refusal must say **that the value was already stored that way**, and name the field. Shape, not
final copy: *"'Images read per document' was already set to 1001, which is outside the allowed range
of 1–1000. That is blocking this save — nothing you just changed is at fault."*

⚠ **After D-242-02 this becomes rare rather than routine** — an untouched field stops being sent —
but it is still reachable when the operator edits the offending field itself, so the sentence is
still owed.

### D-242-04 — The cloud-DSN blocker is DISSOLVED: the Supabase MCP is the read path

The roadmap blocked SC#1 and SC#4 on *"a read-capable cloud DSN — the same blocker that killed 241's
row 5."* **It is not a blocker.** The Supabase MCP authenticates over OAuth with read-only scopes and
answers arbitrary SQL against the production project. Every measurement in this file was taken that
way, in one session, with no DSN and no credential handling.

⭐ **This has consequences beyond Phase 242** — `DEBT-01`/`DEBT-02` verification, RECALL measurement,
and every future *"we cannot see cloud"* claim should try this path first. **Recorded as reusable
capability, not as a one-off.**

### D-242-05 — Repair `scripts/verify-v40-cloud-migrations.sql` in this phase

It is the tool the phase was built to trust, and it produces **false FAILs** — it would have led the
next reader to conclude a shipped migration had not landed. Two fixes:

1. Read grants from **`pg_attribute.attacl`**, not `information_schema.column_privileges`.
2. The `176` row must stop asserting absence — that window closed on 2026-09-10. Assert **presence**,
   and say in the script why the polarity changed.

### D-242-06 — SHIP-02, SHIP-03 and SHIP-04 close as MEASURED or RETIRED, and the register is corrected

They are not carried forward as owed work and not silently ticked. Each closes with the evidence
named, in `REQUIREMENTS.md` and in the phase record. ⚠ **`REQUIREMENTS.md` and `STATE.md` still
contain sentences saying v4.0 has never deployed** — corrections were written beside the originals
at the roadmap commit; this phase confirms them against the database rather than against git alone.


### D-242-07 — A production security exposure was found BY this phase's own work, and it ships first

`BUG-260911-01` (**blocking**): `app_settings` and `user_settings` have RLS disabled in production
and `anon` holds all table privileges; `resize_embedding_column` — which deletes every vector — is
callable unauthenticated. Found by running the Supabase security advisor while discharging SC#4.

**Migration `177_rls_app_settings_user_settings.sql` is written and NOT applied** — it is a
production change and awaits operator authorisation. The safety of revoking was **traced, not
assumed**: the frontend never touches either table, the backend reads them on the service role, and
`get_user_supabase` runs as `authenticated` (never `anon`) and its callers do not reference them.

⭐ **The reusable lesson, and it belongs in the deploy checklist:** every gate this project runs
stayed green, because every one of them reads through the service role. **Nothing in the suite ever
makes a request as `anon`.** That is the same blind spot migration 156 recorded on
`connector_connections` — the third time this class has fired. **Add the Supabase advisor call to
the deploy parity checklist.**

</decisions>

<deferred>

- **Promoting `RECALL-01` on urgency** — measured against production and refused. It stays in
  Phase 246 as scale-ahead work. Re-open trigger: **a second tenant, or a corpus above ~20k chunks.**
- **A CHECK constraint on every other bounded settings column** — `vision_max_pages`,
  `retrieval_top_k`, `rrf_k` and the HNSW knobs all carry Python-side bounds with no schema
  constraint. 177 fixes the one that bit. **Sweeping the rest is a phase, not a gap** — and the
  general lesson belongs in the phase record either way.
- **Setting `hnsw_ef_search` in cloud** — Phase 246's call, not this phase's, and harmless to leave
  NULL at the current corpus size.

</deferred>

<canonical_refs>

| Path | Why |
|---|---|
| `.planning/ROADMAP.md` → `## v4.1` → corrections block | The four intake claims driven at HEAD; read before planning |
| `.planning/REQUIREMENTS.md` → SHIP correction block | Which SHIP claims are stale and what replaced them |
| `scripts/verify-v40-cloud-migrations.sql` | The tool being repaired (D-242-05) |
| `supabase/migrations/156_grant_default_ingest_visibility_column.sql` | States the column-grant rule this phase re-confirmed |
| `supabase/migrations/044_app_settings_multimodal_limits.sql` | Adds the column `DEFAULT 100`, **no CHECK** — the gap 177 fills |
| `docs/HOT-FILE-LEDGER.md` | `settings.py`, `SettingsPage.tsx`, `user_settings.py` all FIRE G-5 |
| `docs/DEPLOYMENT-WORKFLOW.md` | Migration apply discipline — SQL editor only, never `db push`/`db reset` |

</canonical_refs>

<code_context>

| File | Measured | Note |
|---|---|---|
| `backend/app/api/settings.py:466-467` | 36/19/854 — **G-5 FIRES** | `1 <= n <= 1000`, Python only. The SEED-227 comment explaining *why* the bound exists is good and must survive the move to a constraint |
| `frontend/src/pages/SettingsPage.tsx:876-901` | 45/23/1751 — **G-5 FIRES** | ~22 fields sent unconditionally; the confirm-gate diff sits ~4 lines below and is the reusable baseline |
| `backend/app/models/user_settings.py` | 50/32/1561 — **G-5 FIRES**, ledger stale for the 4th close running | Bounds constants live here |
| `supabase/migrations/` | no CHECK on `app_settings` bounded columns | 178 is the first |

⚠ **All three source files fire G-5 and are honoured by construction here** — a bound, a payload
shape and a sentence. **Update each ledger row AND its section in `docs/HOT-FILE-LEDGER.md` in the
same commit** (the same-commit sync rule).

</code_context>

<plan_shape>

**Target 2-3 plans, down from the roadmap's 3-4.** Three of four requirements are discharged by
measurement, so the phase is now: one migration, one payload change, one script repair, one
register correction.

⚠ **G-3 applies:** the script repair and the register correction are each ≤ 1 file with no schema
or API surface — `/gsd:fast`, never plans. The migration + the payload + the refusal sentence are
the real plan work.

</plan_shape>

<how_wed_know_this_failed>

- The CHECK is added for `multimodal_max_vision_calls` only, and the next settings column with a
  Python-side bound reproduces the identical outage. **The deliverable is the class fix, not the
  instance.**
- The migration hard-codes `1001` and does nothing in cloud, where the value is `100`.
- Migration 178 is applied with `db push` or `db reset`, and the operator's local data goes with it.
- The payload change ships as *"report all errors"* — the failure becomes legible and stays possible,
  and Phase 246 stays hostage.
- `verify-v40-cloud-migrations.sql` is left as-is and the next reader concludes migration 156 never
  landed. **A checker that fails closed on its own blind spot is worse than no checker.**
- SHIP-02/03/04 are ticked without their evidence written down, so the next milestone re-derives
  them — or worse, re-plans the unreproducible drive.
- `RECALL-01` gets promoted on the strength of a `NULL` in cloud, without anyone measuring that the
  corpus is 2,068 chunks and single-tenant.

</how_wed_know_this_failed>
