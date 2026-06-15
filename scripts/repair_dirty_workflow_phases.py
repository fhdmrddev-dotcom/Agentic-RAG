"""One-off idempotent repair of the 3 dirty workflow_phases rows (Plan 101.1-10 Task 1).

WHY: three live UAT runs (575e7345 / a7f415ad / 4ea9bc56) crashed SILENTLY mid-fill
before Plans 07-09 shipped the D-08 layer-6 backstop + the completed-branch phase flip
(harness_engine.run_workflow now flips a failure-bearing phase output to 'failed', and
forced_emit/_exec_llm_emit catch provider errors honestly). Their parent
workflow_runs.status is 'failed', but each run's `fill` (phase_index 1, llm_emit)
workflow_phases row was left status='active' FOREVER — a data state the engine cannot
retroactively repair (the runs are terminal; the new code only protects FUTURE runs).

This script flips exactly those stuck `active` fill rows to 'failed'. It is:
  - SCOPED to exactly the 3 named run_ids (resolved by prefix from workflow_runs).
  - GATED on the predicate `wp.status='active' AND parent wr.status='failed'` — it will
    NEVER touch a gather/completed row, a non-failed run, or any other run's rows.
  - DRY-RUN by default: prints the rows it WOULD change. Requires an explicit `--apply`
    flag to mutate (refuses without it — the seed-fixture safety convention).
  - IDEMPOTENT: a second --apply run finds 0 rows to change (already 'failed') and exits 0.
  - read-back asserted: after --apply, no 'active' fill row remains for those runs.

It never deletes, never touches workflow_runs or harness_audit (the receipts are the
audit trail and must be preserved), and connects directly to the live local Supabase
DB (:54322) — NEVER db push / db reset (the migration rule). Identifier-only logging
(run_id / phase_slug / phase_index) — never row content.

Usage:
    python scripts/repair_dirty_workflow_phases.py            # dry-run preview
    python scripts/repair_dirty_workflow_phases.py --apply    # mutate (idempotent)
"""

import sys

import psycopg2

# Local Supabase (the evidence/repair path from prior phases). Same DSN the seed
# fixtures + smoke harness use against the live local DB.
DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# The 3 dirty run prefixes (UAT Gaps section). Resolved to full UUIDs by prefix below.
RUN_PREFIXES = ("575e7345", "a7f415ad", "4ea9bc56")


def _resolve_run_ids(cur):
    """Resolve each short prefix to exactly one failed workflow_runs.id.

    Refuses (clean exit) if a prefix matches 0 or >1 runs, or matches a run that is
    NOT 'failed' — so the repair can only ever target the intended terminal runs.
    """
    resolved = []
    for prefix in RUN_PREFIXES:
        cur.execute(
            "SELECT id::text, status FROM workflow_runs WHERE id::text LIKE %s",
            (prefix + "%",),
        )
        rows = cur.fetchall()
        if len(rows) != 1:
            raise SystemExit(
                f"REFUSING: prefix {prefix} resolved to {len(rows)} workflow_runs "
                f"(expected exactly 1). No changes made."
            )
        run_id, status = rows[0]
        if status != "failed":
            raise SystemExit(
                f"REFUSING: run {prefix} has status={status!r} (expected 'failed'). "
                f"The repair only targets failed runs. No changes made."
            )
        resolved.append(run_id)
    return resolved


def _select_dirty(cur, run_ids):
    """The repair target: active fill rows whose parent run is failed, for the 3 runs."""
    cur.execute(
        """
        SELECT wp.workflow_run_id::text, wp.phase_index, wp.slug, wp.status
        FROM workflow_phases wp
        JOIN workflow_runs wr ON wr.id = wp.workflow_run_id
        WHERE wp.workflow_run_id = ANY(%s::uuid[])
          AND wp.status = 'active'
          AND wr.status = 'failed'
        ORDER BY wp.workflow_run_id, wp.phase_index
        """,
        (run_ids,),
    )
    return cur.fetchall()


def main():
    apply = "--apply" in sys.argv[1:]

    conn = psycopg2.connect(DSN)
    conn.autocommit = False  # explicit commit only after the read-back assertion passes
    cur = conn.cursor()

    try:
        run_ids = _resolve_run_ids(cur)
        print("Resolved the 3 dirty run_ids (all status='failed'):")
        for rid in run_ids:
            print(f"  {rid}")

        dirty = _select_dirty(cur, run_ids)
        print(f"\n=== {len(dirty)} stuck-active fill row(s) to repair (active -> failed) ===")
        for rid, idx, slug, status in dirty:
            print(f"  run {rid[:8]}  phase_index={idx}  slug={slug!r}  status={status!r}")

        if not dirty:
            print(
                "\nNothing to repair — no 'active' fill row remains for the 3 failed runs "
                "(already 'failed' / idempotent re-run). Exit 0."
            )
            conn.rollback()
            return 0

        if not apply:
            print(
                "\nDRY-RUN (no changes made). Re-run with --apply to flip the row(s) above "
                "to 'failed'."
            )
            conn.rollback()
            return 0

        # SCOPED UPDATE: exactly the 3 run_ids + the active-and-parent-failed predicate.
        # Never a blanket update; only the rows the SELECT above listed can change.
        cur.execute(
            """
            UPDATE workflow_phases wp
            SET status = 'failed', updated_at = now()
            FROM workflow_runs wr
            WHERE wp.workflow_run_id = wr.id
              AND wp.workflow_run_id = ANY(%s::uuid[])
              AND wp.status = 'active'
              AND wr.status = 'failed'
            """,
            (run_ids,),
        )
        changed = cur.rowcount
        print(f"\n--apply: UPDATEd {changed} row(s) active -> failed.")

        # Read-back assertion (within the same uncommitted txn): no active fill row remains.
        remaining = _select_dirty(cur, run_ids)
        if remaining:
            conn.rollback()
            raise SystemExit(
                f"ASSERTION FAILED: {len(remaining)} 'active' row(s) still present after "
                f"UPDATE — rolling back, no changes committed."
            )

        conn.commit()
        print(
            "Read-back assertion passed: 0 'active' fill rows remain for the 3 failed runs. "
            "Committed."
        )
        return 0
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
