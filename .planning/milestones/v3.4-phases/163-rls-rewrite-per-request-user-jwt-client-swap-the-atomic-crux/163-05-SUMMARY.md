---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 05
wave: 3
completed: 2026-07-19
status: complete
requirements-completed: []
key-files:
  modified:
    - supabase/full-schema.sql
tests: "95 passed (full test_163_* suite GREEN post-apply)"
---

# 163-05 SUMMARY — [BLOCKING] Apply Gate (migrations 107 → 108)

## What shipped
Migrations **107 (TEN-04 `org_id` substrate)** then **108 (37-table membership-RLS rewrite)** were applied
to the **live local Supabase DB** (`127.0.0.1:54322`), `supabase/full-schema.sql` was regenerated from the
applied state, and the entire `test_163_*` suite flipped **RED → GREEN**. The membership predicates + the
`SET LOCAL ROLE authenticated` mechanism now isolate cross-org at the DB/factory level — while the app is
still **inert** (service-role/BYPASSRLS; no client swapped). This is the "predicates land, inert" checkpoint
of the atomic flip.

## Apply method (operator-delegated to Claude — "you do it")
The operator directed Claude to apply directly. Done via **psycopg2 against the live DB — NOT `db push`/`db reset`**
(non-destructive; preserves dev data, honoring the CLAUDE.md rule whose purpose is to avoid the destructive
reset path):
- **107** applied **statement-by-statement in `autocommit=True`** (a dollar-quote/comment-aware splitter) —
  required because the batched-backfill procedure `_mig163_backfill` issues a per-batch `COMMIT`, legal only
  when each top-level statement runs standalone (a single wrapping-transaction paste raises "invalid
  transaction termination", exactly as the migration header warns).
- **108** applied as **one atomic `execute()`** — its explicit `BEGIN/COMMIT` keeps all 97 policy DROP/CREATEs
  all-or-nothing (never a half-rewritten RLS set).

## Verification (live-DB, psycopg2 @ :54322)
- **36/37 target tables now reference `current_user_org_ids`** — the 1 exception is `profiles` (the documented
  163-03 owner-only deviation: `profiles` has no `org_id` column live; org-roster visibility → Phase 166).
- `document_chunks.org_id` + `skill_embeddings.org_id` are **NOT NULL** with a **btree(org_id)**; the
  **HNSW + GIN** vector indexes on `document_chunks` are **intact** (untouched).
- Pre-flip NULL census read **0 / 0** — both self-guarded NOT-NULL flips passed with no orphan straggler.
- `bash scripts/regenerate-full-schema.sh` (no --reset) → `full-schema.sql` at 5780 lines, reflects 108.
- **`pytest tests/integration/test_163_*.py` → 95 passed** (6 RLS cluster tests, both two-user leak tests,
  role-swap-noop/spoof/fail-closed, ten04 backfill, factories).
- **Inert-first held:** `grep get_user_pg_connection|get_user_supabase backend/app/{api,services}` → **0** call
  sites. No client swapped; the flip is Wave 4.

## Deviations
- **Same-commit rule (minor, structural):** the GSD plan set intentionally split *authoring* (Wave 2: migrations
  107/108 committed in 5eb13afb / 470eec07+6e27e2b7) from *apply+regen* (this Wave-3 plan), so the migrations
  were already committed; this commit adds the regenerated `full-schema.sql` (+ tracking) that reflects them.
  The intent (schema artifact in sync with the migrations, both in-repo) is satisfied.
- **Requirements kept Pending:** TEN-01/TEN-04 are NOT marked complete here. The predicates are applied but
  inert; TEN-01 enforcement lands with the Wave-4 client swap and TEN-04's CONCUR-01 benchmark is Wave 5
  (163-10). Mirrors the 163-02/03/04 discipline.

## Threat model status
- **T-163-ORDER** (108-before-107 misorder): mitigated — 107 applied first; 108's `document_chunks` predicate
  would have errored on a missing `org_id` column (apply-time fail-loud). Verified applied in order.
- **T-163-APPLY** (file-exists ≠ applied): mitigated — applied state proven by live-DB query, not file presence.
- **T-163-02** (half-flip window): held — predicates applied inert, 0 clients swapped; the atomic order is intact.

## Next
Wave 4 — the client swap (163-06/07/08/09): flip request-scoped handlers to the user-JWT clients so RLS
becomes the real gate. Then Wave 5 (163-10) — the operator-run CONCUR-01 benchmark + live two-user leak
test + SC#10 4-axis UAT (needs the backend running).
