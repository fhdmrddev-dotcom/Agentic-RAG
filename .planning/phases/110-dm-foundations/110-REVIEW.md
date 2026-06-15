---
phase: 110-dm-foundations
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - backend/app/main.py
  - backend/app/models/user_settings.py
  - backend/app/services/audit_service.py
  - supabase/migrations/071_dm_foundations.sql
  - backend/tests/integration/test_110_audit_drift_guard.py
  - backend/tests/integration/test_110_dm_audit_live.py
  - backend/tests/integration/test_110_dm_schema.py
  - backend/tests/integration/test_110_flag.py
  - backend/tests/test_110_boot_guard.py
  - backend/tests/test_110_flag_default.py
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 110: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found (3 Info only — no Critical, no Warning)

## Summary

Phase 110 (DM Foundations) is a clean, well-constructed backend substrate phase. The migration, the audit-enum lockstep, the boot drift guard, and the default-ON settings read chain are all correct on every focus area called out for scrutiny. I cross-checked the authored migration against the live `supabase/full-schema.sql` (already regenerated post-apply) and confirmed all 4 tables, all 16 RLS policies, both table CHECK constraints, the 19-value audit enum, and the `app_settings.document_management_enabled DEFAULT true` column landed byte-faithful to the migration source.

All four focus areas verified sound:

1. **RLS correctness** — All 4 tables `ENABLE ROW LEVEL SECURITY` with the full 4-policy set. SELECT is `own OR is_global` for the 3 library/config tables and `own-only` for `document_relationships` (correct by design). INSERT and UPDATE WITH CHECK both force `is_global = false`, so no end-user request can create or promote a global row (globals are service-role/migration-seeded only). The `mfd_reachable` CHECK (`user_id IS NOT NULL OR is_global = true`) correctly forecloses the RLS-unreachable orphan that a nullable owner would otherwise allow. Cross-user isolation is exercised live in `test_110_dm_schema.py` via the `SET LOCAL ROLE authenticated` + JWT-sub incantation.

2. **Audit-enum lockstep** — `VALID_ACTION_TYPES` (19 strings) is exactly the migration CHECK array (verified verbatim against both the migration and full-schema.sql line 341). The original 11 are preserved verbatim from migration 030. `test_valid_action_types_is_exactly_19` pins the frozenset; `test_110_dm_audit_live.py` drives a raw asyncpg INSERT+SELECT over all 8 new types (deliberately bypassing the 23514-swallowing service write — the correct way to test the silent-drop trap).

3. **Boot drift guard** — `assert_action_types_synced` correctly enforces the *one-directional* subset check (`frozenset ⊆ live CHECK`): a frozenset type missing from the DB hard-fails (the dangerous silent-drop direction), while an extra DB type is harmless and does not raise. The `None` (constraint-absent) branch hard-fails too. The `re.findall(r"'([^']+)'", ...)` parse operates only on the DB-controlled `pg_get_constraintdef` output, never on user input — no injection surface. It is wired into `lifespan` startup as a genuine `await` (not best-effort), so a drift crashes every worker loudly, matching the documented 075.4 UnknownProviderError pattern.

4. **Default-ON polarity** — `document_management_enabled()` returns `True` on any `load_app_settings()` exception, and `_val_bool(row, ..., default=True)` returns `True` for a missing/NULL column while still honoring an explicit DB `False`. The polarity flip vs `tool_args_progress_emit_boundary_bytes()` (fixed VALUE vs default-ON) is intentional and correctly implemented. Both `test_110_flag_default.py` cases pass.

The 3 Info items below are latent-assumption notes and documentation nits, not defects in the shipped behavior.

## Info

### IN-01: Constraint-def parser assumes action-type strings never contain an escaped apostrophe

**File:** `backend/app/services/audit_service.py:47`
**Issue:** `live_check = set(re.findall(r"'([^']+)'", row["def"]))` extracts each single-quoted literal from the `pg_get_constraintdef` output. This is correct for all 19 current action types (lowercase + dots only), but the regex would mis-tokenize any future action type containing a Postgres-escaped apostrophe (rendered as a doubled `''`), splitting it into two false tokens. This is not a live bug — the locked DMF-01 vocabulary contains no apostrophes — but it is an unstated invariant on the `VALID_ACTION_TYPES` naming convention. If a future phase ever introduces an apostrophe-bearing action type, the subset check would spuriously fail (fail-closed, so safe, but confusing).
**Fix:** No change required for this phase. Optionally add a one-line comment at the regex documenting the invariant, e.g. `# action_type values are dot.lower-case identifiers — no embedded quotes, so a naive '([^']+)' tokenizer is exact`. Alternatively, future-proof by collapsing Postgres-doubled quotes first: `row["def"].replace("''", "\x00")` then split, but this is overkill given the locked vocabulary.

### IN-02: `document_management_enabled()` `except` clause is effectively unreachable via the documented cold-cache path

**File:** `backend/app/models/user_settings.py:586-589`
**Issue:** The docstring and `test_flag_helper_returns_true_by_default` describe the cold-cache path returning `True`. In practice the cold cache (`_settings_cache is None` → `{}`) already yields `True` through `_val_bool({}, ..., default=True)` *without* tripping the `except`. The `except Exception: return True` therefore only fires when `_build_settings_from_row` itself raises (e.g., a malformed cached row failing one of the many `int(_val(...))` coercions and breaking Pydantic validation). That is a genuine defensive case, so the handler is justified — but the inline comment ("cold cache / DB read failure") slightly mischaracterizes when it actually triggers, since a cold cache does NOT raise.
**Fix:** Optional comment tweak for accuracy, e.g. `# defensive: default-on if a malformed cached row breaks settings construction`. Behavior is correct as-is; no code change needed.

### IN-03: Boot drift guard runs once per worker with a full constraint-def fetch on every startup

**File:** `backend/app/main.py:237-238`
**Issue:** `assert_action_types_synced(await get_pg_pool())` runs in `lifespan` startup for each of `WORKER_COUNT` workers (default 2). The comment correctly notes this is intentional ("runs per worker ... read-only, idempotent; a drift crashes all WORKER_COUNT workers identically — the desired loud fail"). The single `pg_get_constraintdef` lookup is negligible cost, so this is not a performance concern (and performance is out of v1 scope regardless). Flagging only to confirm the per-worker duplication is a deliberate design choice (loud, identical fail across all workers) rather than an oversight — which the surrounding comment already documents.
**Fix:** None — documented intentional behavior. No action required.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
