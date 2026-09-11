"""Throwaway apply script for Phase 242 Plan 01 — migration 178.

Applies `supabase/migrations/178_app_settings_vision_calls_bound.sql` to the live LOCAL Supabase DB
(:54322) via psycopg2-direct, then proves the two properties the migration claims:

  1. NOTHING WAS LOST — the `app_settings` row count is identical before and after.
  2. IT IS RE-RUNNABLE — the file is applied a SECOND time in the same run and the resulting values
     and constraint set are asserted identical to after the first apply.

⚠ THE MIGRATION OWNS ITS OWN TRANSACTION, NOT THIS SCRIPT. The file carries `BEGIN;` / `COMMIT;`
  (correct for the SQL-editor paste path, which has no implicit transaction), so running it through
  psycopg2 — which has ALREADY opened one — prints two harmless server warnings:
  `there is already a transaction in progress` and then `there is no transaction in progress`.
  Both are expected. Atomicity is the migration's, and it is real; the script's `conn.commit()`
  afterwards is a no-op. ⛔ Do NOT "fix" the warnings by stripping BEGIN/COMMIT from the file — that
  would remove the atomicity the paste path depends on, which is the path the operator uses.

⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ. Applying 178 to cloud is
   a production write and needs explicit per-action operator approval (CLAUDE.md → "Supabase MCP —
   reads are free, WRITES ARE APPROVAL-GATED"). This script cannot reach cloud even by accident.

⛔ NEVER `supabase db push` / `db reset` — both destroy the operator's dev data. This is the
   `scripts/apply_migration_075.py` precedent, which exists for the same reason.

Run: backend/venv/Scripts/python scripts/apply_migration_178.py
"""

import re
import sys
from pathlib import Path

import psycopg2

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "supabase"
    / "migrations"
    / "178_app_settings_vision_calls_bound.sql"
)
CONSTRAINTS = (
    "app_settings_multimodal_max_vision_calls_bound",
    "app_settings_vision_max_pages_bound",
)


def _snapshot(cur) -> dict:
    cur.execute("select count(*) from public.app_settings")
    rows = cur.fetchone()[0]
    cur.execute(
        "select multimodal_max_vision_calls, vision_max_pages "
        "from public.app_settings order by 1 nulls first, 2 nulls first"
    )
    values = cur.fetchall()
    cur.execute(
        "select conname from pg_constraint "
        "where conrelid = 'public.app_settings'::regclass order by conname"
    )
    constraints = [r[0] for r in cur.fetchall()]
    return {"rows": rows, "values": values, "constraints": constraints}


def main() -> int:
    if not MIGRATION.is_file():
        print(f"FATAL: migration not found at {MIGRATION}")
        return 2
    sql = MIGRATION.read_text(encoding="utf-8")

    conn = psycopg2.connect(DSN)
    try:
        with conn.cursor() as cur:
            before = _snapshot(cur)
        print("BEFORE")
        print(f"  app_settings rows : {before['rows']}")
        print(f"  (vision_calls, vision_max_pages) : {before['values']}")
        print(f"  constraints : {before['constraints']}")

        # ── first apply ───────────────────────────────────────────────────────────────────────
        del conn.notices[:]
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        # ⚠ WR-08 (code review): the migration RAISEs a NOTICE saying how many rows it clamped, or
        #   that there was nothing to repair. This migration fixes a bug whose whole nature is a
        #   value that changed without saying so — repairing it with another silent value change
        #   would be the same fault wearing a different hat. On the SQL-editor paste path the
        #   NOTICE is the only report; here it is echoed so this path is not silent either.
        for note in conn.notices:
            print(f"  [migration] {note.strip()}")
        with conn.cursor() as cur:
            after1 = _snapshot(cur)
        print("\nAFTER FIRST APPLY")
        print(f"  app_settings rows : {after1['rows']}")
        print(f"  (vision_calls, vision_max_pages) : {after1['values']}")
        print(f"  constraints : {after1['constraints']}")

        # ── second apply — re-runnability is PROVEN, not claimed ──────────────────────────────
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        with conn.cursor() as cur:
            after2 = _snapshot(cur)
        print("\nAFTER SECOND APPLY (re-runnability check)")
        print(f"  app_settings rows : {after2['rows']}")
        print(f"  (vision_calls, vision_max_pages) : {after2['values']}")
        print(f"  constraints : {after2['constraints']}")

        failures = []
        if after1["rows"] != before["rows"]:
            failures.append(
                f"ROW COUNT CHANGED: {before['rows']} -> {after1['rows']} — data was lost"
            )
        for name in CONSTRAINTS:
            if name not in after1["constraints"]:
                failures.append(f"constraint {name} was not created")
            if after1["constraints"].count(name) != 1:
                failures.append(f"constraint {name} appears {after1['constraints'].count(name)}x")
        if after2 != after1:
            failures.append(
                "SECOND APPLY CHANGED THE DATABASE — the migration is not re-runnable:\n"
                f"    after#1 {after1}\n    after#2 {after2}"
            )
        # Every stored value must now satisfy the bound.
        with conn.cursor() as cur:
            cur.execute(
                "select count(*) from public.app_settings "
                "where (multimodal_max_vision_calls is not null "
                "       and (multimodal_max_vision_calls < 1 or multimodal_max_vision_calls > 1000)) "
                "   or (vision_max_pages is not null "
                "       and (vision_max_pages < 1 or vision_max_pages > 500))"
            )
            out_of_range = cur.fetchone()[0]
        if out_of_range:
            failures.append(f"{out_of_range} row(s) still out of range after the clamp")

        if failures:
            print("\n*** FAILED ***")
            for f in failures:
                print(f"  · {f}")
            return 1

        print("\nAPPLIED (local) — row count unchanged, both constraints present, re-run is a no-op.")

        # ── the clamp arm's positive control ──────────────────────────────────────────────────
        # ⚠ THE CLAMP DID NOTHING ON THIS DATABASE, because the operator's local row had already
        #   been hand-repaired from 1001 to 1000. An arm that never ran is an arm nobody has seen
        #   work. Drive it inside a transaction that is ROLLED BACK, so the operator's data is
        #   untouched: plant an out-of-range value, re-run the clamp, assert it lands on the bound.
        #   The constraint is dropped and restored inside the same rolled-back transaction — it
        #   would otherwise refuse the plant, which is itself worth seeing.
        print("\nCLAMP POSITIVE CONTROL (inside a ROLLED-BACK transaction)")
        with conn.cursor() as cur:
            cur.execute(
                "alter table public.app_settings "
                "drop constraint app_settings_multimodal_max_vision_calls_bound"
            )
            cur.execute("update public.app_settings set multimodal_max_vision_calls = 1001")
            cur.execute("select multimodal_max_vision_calls from public.app_settings")
            planted = cur.fetchall()
            cur.execute(
                "update public.app_settings "
                "   set multimodal_max_vision_calls = least(greatest(multimodal_max_vision_calls, 1), 1000) "
                " where multimodal_max_vision_calls is not null "
                "   and (multimodal_max_vision_calls < 1 or multimodal_max_vision_calls > 1000)"
            )
            cur.execute("select multimodal_max_vision_calls from public.app_settings")
            clamped = cur.fetchall()
            # and the low end, which is the arm that matters more (0 silently disables vision)
            cur.execute("update public.app_settings set multimodal_max_vision_calls = 0")
            cur.execute(
                "update public.app_settings "
                "   set multimodal_max_vision_calls = least(greatest(multimodal_max_vision_calls, 1), 1000) "
                " where multimodal_max_vision_calls is not null "
                "   and (multimodal_max_vision_calls < 1 or multimodal_max_vision_calls > 1000)"
            )
            cur.execute("select multimodal_max_vision_calls from public.app_settings")
            clamped_low = cur.fetchall()
        conn.rollback()
        print(f"  planted 1001 -> {planted}, clamped -> {clamped}   (expect [(1000,)])")
        print(f"  planted    0 -> clamped -> {clamped_low}          (expect [(1,)])")

        # ── the NULL arm's positive control ───────────────────────────────────────────────────
        # The CHECK permits NULL deliberately (`_val()` falls back to the config default, and a
        # pre-044 restore has no column at all). An arm justified in a comment and never driven is
        # an arm nobody has seen work — so plant NULL, re-apply the whole file, and assert it
        # survives. Rolled back; the operator's row is untouched.
        print("\nNULL ARM POSITIVE CONTROL (inside a ROLLED-BACK transaction)")
        null_ok = True
        null_err = ""
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "update public.app_settings "
                    "set multimodal_max_vision_calls = null, vision_max_pages = null"
                )
                # ⚠ WR-07 (code review): this strip used to be two literal `.replace()` calls,
                #   so the safety of a DESTRUCTIVE plant depended on a literal string in ANOTHER
                #   file. Renaming `COMMIT;` there would have committed the NULL plant to the
                #   operator's database. Now it is a regex on word boundaries AND an assertion —
                #   if either statement survives the strip, the plant does not run at all.
                inner = re.sub(r"(?im)^\s*(BEGIN|COMMIT)\s*;\s*$", "", sql)
                assert not re.search(r"(?im)^\s*(BEGIN|COMMIT)\s*;", inner), (
                    "refusing to run the NULL-arm plant: the migration still contains a "
                    "transaction statement after stripping, so a rollback could not undo it"
                )
                cur.execute(inner)
                cur.execute(
                    "select multimodal_max_vision_calls, vision_max_pages from public.app_settings"
                )
                nulls = cur.fetchall()
            print(f"  planted NULL/NULL -> after re-apply -> {nulls}   (expect [(None, None)])")
            if nulls != [(None, None)]:
                null_ok = False
        except Exception as exc:  # a CHECK violation on NULL would land here
            null_ok = False
            null_err = f"{type(exc).__name__}: {exc}"
            print(f"  *** the NULL arm RAISED: {null_err}")
        finally:
            conn.rollback()

        with conn.cursor() as cur:
            final = _snapshot(cur)
        print(f"\n  after ROLLBACK, live values : {final['values']}  (expect {after2['values']})")
        if clamped != [(1000,)] or clamped_low != [(1,)] or not null_ok or final != after2:
            print("\n*** POSITIVE CONTROLS FAILED ***")
            return 1
        print("  clamp arm PROVEN at both ends, NULL arm PROVEN; the operator's row is untouched.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
