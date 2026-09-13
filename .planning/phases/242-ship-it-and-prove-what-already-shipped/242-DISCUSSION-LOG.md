# Phase 242 — Discussion Log

**Date:** 2026-09-11 · Human reference only; downstream agents read `242-CONTEXT.md`.

## Areas selected

All four offered were selected.

## Area 1 — What migration 177 does to the bad row

**Options:** clamp to the bound (`1000`) · reset to the column default (`100`) · refuse to migrate.
**Recommendation given:** clamp — the local fix already clamped and was kept, so cloud clamping
matches what this install decided; reset-to-default silently changes behaviour, the same class of
fault as the bug.
**Operator:** *"clamp it"*.
**Note added after:** generalise it — cloud may hold a different value than the `1001` seen locally
(it holds `100`), so the migration repairs anything out of range rather than one literal.

## Area 2 — Changed-fields-only vs report-all-errors

**Options:** changed-fields-only · report-all-errors · both.
**Recommendation given:** changed-fields-only — report-all makes the failure legible,
changed-fields-only makes it impossible; and `hnsw_ef_search` rides the same payload, so Phase 246
is otherwise hostage to unrelated stored values.
**Noted:** the confirm-on-save gate already diffs against stored settings, so the baseline exists.
**Resolved under** *"do the best decision"* → changed-fields-only (D-242-02).

## Area 3 — What the refusal actually says

Not separately debated; resolved as D-242-03. The sentence must name the **stored** value as the
cause and say nothing the operator just typed is at fault. Becomes rare after D-242-02 but stays
reachable when the offending field is the one being edited, so it is still owed.

## Area 4 — The cloud DSN blocker

**Operator:** *"let's check Supabase MCP first for the cloud version"*.

This turned the area inside out. The Supabase MCP was authenticated over read-only OAuth and
answered arbitrary SQL against production — **the blocker does not exist** (D-242-04).

### What the measurements found, in order

1. `multimodal_max_vision_calls = 100` in cloud → the Search tab **saves fine in production**;
   SHIP-01 was never blocking anywhere but locally.
2. `supabase_migrations.schema_migrations` **does not exist** in cloud — expected, because this
   project applies migrations by pasting into the SQL editor. Verification had to be structural.
3. The verify script's 19 checks: **17 PASS, 2 FAIL**.
4. ⚠ **The `156` FAIL was chased before being reported, and was false.**
   `information_schema.column_privileges` only shows grants visible to the connecting role and
   returned empty for *every* column. `pg_attribute.attacl` shows
   `default_ingest_visibility → authenticated=arw, service_role=arw` — migration 156's exact grant
   set. **The script is wrong, not the database** (D-242-05).
5. The `176` FAIL is the script's designed inversion — it asserts the knobs are *absent*.
6. `hnsw_ef_search` is NULL in cloud → checked whether the recall cliff is live. Cloud holds
   **2,068 chunks · 47 docs · 1 owner · 1 org**. The cliff needs a small tenant fraction of a large
   corpus; production is single-tenant at 50× smaller. **Not live. RECALL-01 stays in Phase 246.**

## Scope creep — none

No new capability was proposed. The phase got **smaller**, not wider.

## Deferred

- Promoting RECALL-01 on urgency — refused on measurement; re-open at a second tenant or ~20k chunks.
- CHECK constraints on the other bounded settings columns (`vision_max_pages`, `retrieval_top_k`,
  `rrf_k`, the HNSW knobs) — a phase, not a gap.
- Setting `hnsw_ef_search` in cloud — Phase 246's call.

## Claude's discretion

- Generalising the clamp rather than keying it to `1001`.
- Adding D-242-05 (repair the verify script) to the phase — it is the tool the phase was built to
  trust, and it produces false FAILs.
- Recording the MCP read path as reusable capability rather than a one-off (D-242-04).
