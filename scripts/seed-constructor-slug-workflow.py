"""Seed ONE workflow definition whose MIDDLE phase is slugged `constructor` (Phase 200-06).

WHY THIS SCRIPT EXISTS — and why it is a fixture rather than a fix.

`BUG-260807-01` and `BUG-260808-01` are ALREADY CODE-FIXED, and both reports' own tails
say so. The guards shipped and are in the tree today:

  - `frontend/src/components/workflows/editAffordance.ts:540, :543` — `own(overlay, slug)`
    and `own(nudges, slug) ?? 0`, with the docblock at `:511` naming `BUG-260807-01`;
  - `frontend/src/components/workflows/WorkflowCanvas.tsx:699, :738, :942` — all three
    sinks route through `own()`;
  - guard leaf: `frontend/src/components/workflows/ownProperty.ts`.

What is OWED is not a repair. It is **ONE DRIVEN BROWSER ROW, shared by both reports**,
against a definition the product's own UI **cannot author**: `D-184-11` records that there
is no slug field anywhere in the Builder, and slugs are derived from the step TYPE
(`slugForType`), so `constructor` can never be typed by a person. A defect class reachable
only from seeded data needs seeded data to be closed on evidence rather than on reading.

────────────────────────────────────────────────────────────────────────────────
THE DRIVEN ROW THIS SCRIPT ENABLES — recorded here so it cannot drift from the fixture
────────────────────────────────────────────────────────────────────────────────

Recorded in `.planning/phases/200-the-workflow-journey/200-VALIDATION.md`. Run it after
this script reports `SEEDED`:

  1. Open the Builder on the seeded definition, Canvas tab. Three steps must be visible.
  2. Read `node.style.transform` on EACH of the three `.react-flow__node` wrappers —
     `document.querySelectorAll('.react-flow__node')`. **`BUG-260808-01`'s half:** every
     one must be a real `translate(<x>px, <y>px)` with FINITE numbers, and the middle card
     must NOT be sitting at the origin on top of step 1. The measured defect was a
     `position` that had become a FUNCTION with no `.x`/`.y`, after which the library wrote
     NO transform at all.
  3. Hover the middle card and read the **COMPUTED** transform of the `＋` / `✕` edit
     affordances beside it (`getComputedStyle(el).transform`). **`BUG-260807-01`'s half:**
     the vertical offset must track the card, not jump.
  4. **SWING THE SLUG BOTH WAYS.** Re-run steps 2-3 with `--slug harmless` (which reseeds
     the same shape with an ordinary middle slug) and confirm the two readings AGREE. A
     one-sided reading cannot distinguish "the guard works" from "nothing was ever wrong on
     this shape".
  5. Both readings agreeing ⇒ flip **BOTH** `BUG-260807-01` and `BUG-260808-01` to
     `status: closed` on that single row, and set `verified_closed_by: 200`.

An automated FLOOR sits beneath this row so the class is not left to a manual step alone:
`WorkflowCanvas.test.tsx` → *"the poisoned slug still renders a real, finite position"* and
*"a `constructor`-slugged branch TARGET resolves to a step, not to a function"*. The manual
row is what proves it in a real browser with real layout; the jsdom cases are what stop it
regressing between browsers.

⚠ THE CLASS STAYS OPEN, DELIBERATELY. `SEED-143` — constraining `slug` at the API/schema
boundary — is **NOT taken in Phase 200** (`200-CHECKLIST.md` §0.2 X-6): it is a schema plus
API-surface change on a phase already carrying a behaviour change, and `200-CONTEXT.md`
scoped neither. Its recorded trigger is *the next phase that opens a `workflow_phases`
migration for another reason.* The client-side `own()` guard is the compensating control.

────────────────────────────────────────────────────────────────────────────────
WHAT IT WRITES, AND WHAT IT REFUSES TO TOUCH
────────────────────────────────────────────────────────────────────────────────

  - EXACTLY ONE row in `public.workflow_definitions`, `status = 'draft'`, with a slug
    prefixed `zz-200-06-fixture-` so it sorts last in the library and is obvious as test
    data (`project_workflow_rows_are_test_data`).
  - `created_by` is REQUIRED (the column is `created_by`, not `user_id` — D-01) and is
    resolved to an EXISTING `auth.users` row: the newest one, or the id given by `--user`.
    The script REFUSES to run rather than inventing a user, because a definition owned by a
    non-existent user is invisible under RLS and would waste the operator's UAT session.
  - It writes NOTHING else: no `workflow_runs`, no `workflow_phases`, no publish, no
    settings. It never runs the workflow.
  - `--delete` removes every row this script has ever created (matched on the slug prefix),
    so the fixture can be cleaned up without hunting for it by hand.

RUN IT WITH THE BACKEND VENV INTERPRETER — `psycopg2` lives there:

    backend/venv/Scripts/python.exe scripts/seed-constructor-slug-workflow.py
    backend/venv/Scripts/python.exe scripts/seed-constructor-slug-workflow.py --slug harmless
    backend/venv/Scripts/python.exe scripts/seed-constructor-slug-workflow.py --delete
"""

from __future__ import annotations

import argparse
import json
import sys

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

SLUG_PREFIX = "zz-200-06-fixture-"

# ⚠ THE POISONED SLUG. `Object.prototype` members are the whole class; `constructor` is the
# one both reports measured, because it resolves to a FUNCTION through a bare index — never
# nullish, so a `?? 0` fallback does not fire and the poisoned value flows on.
POISON_SLUG = "constructor"

# The CONTROL slug. Step 4 of the driven row re-seeds with this and requires the two
# readings to agree; without it a green reading cannot be distinguished from a shape on
# which nothing was ever wrong.
CONTROL_SLUG = "harmless"


def definition_for(middle_slug: str) -> dict:
    """Three phases, the middle one carrying the slug under test.

    THREE, not two, and the middle position is load-bearing: `BUG-260808-01`'s visible
    symptom was the poisoned card painting at the ORIGIN, i.e. on top of step 1. A
    two-phase shape with the poison FIRST would put the defect and the origin in the same
    place and the row would read green while broken.

    The phase types are the three cheapest that need no configuration to project, so the
    canvas draws a complete three-card plane with no provider keys and no run.
    """
    return {
        "phases": [
            {
                "slug": "first",
                "phase_index": 0,
                "name": "The step before",
                "config": {"phase_type": "llm_single"},
            },
            {
                "slug": middle_slug,
                "phase_index": 1,
                "name": "The step under test",
                "config": {"phase_type": "llm_single"},
            },
            {
                "slug": "last",
                "phase_index": 2,
                "name": "The step after",
                "config": {"phase_type": "llm_single"},
            },
        ]
    }


def main() -> int:
    # ⚠ ASCII-ONLY, AND NOT `__doc__` — MEASURED, not stylistic. Passing the module
    # docstring here made `--help` raise `UnicodeEncodeError: 'charmap' codec can't encode`
    # on this box: a Windows console is cp1252 and this file's prose carries em-dashes, box
    # rules and `⚠`. The operator running the fixture would have hit a traceback instead of
    # usage text. The full story stays in the docstring, where a READER sees it; the console
    # gets a pointer.
    parser = argparse.ArgumentParser(
        description=(
            "Seed one workflow_definitions row whose MIDDLE phase carries the slug under "
            "test, for the BUG-260807-01 / BUG-260808-01 driven row. Read this file's "
            "docstring for the five steps of that row and for why it is a fixture rather "
            "than a fix."
        ),
    )
    parser.add_argument(
        "--slug",
        default=POISON_SLUG,
        help=(
            f"the MIDDLE phase's slug. Default {POISON_SLUG!r} (the poisoned one); pass "
            f"{CONTROL_SLUG!r} for the control half of the driven row."
        ),
    )
    parser.add_argument(
        "--user",
        default=None,
        help="the auth.users id to own the row. Default: the newest existing user.",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="remove every fixture this script has created, and write nothing.",
    )
    args = parser.parse_args()

    try:
        import psycopg2
    except Exception as exc:  # pragma: no cover - environment guard
        print(f"psycopg2 is not importable ({exc}).")
        print("Run this with the backend venv interpreter: backend/venv/Scripts/python.exe")
        return 2

    try:
        conn = psycopg2.connect(DSN, connect_timeout=5)
    except Exception as exc:
        # HONEST WHEN THE DATABASE IS DOWN — it never pretends to have seeded anything.
        print(f"NOT SEEDED — could not connect to {DSN}: {exc}")
        print("Bring local infra up first: powershell -File scripts/start-local-infra.ps1")
        return 2

    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            if args.delete:
                cur.execute(
                    "DELETE FROM public.workflow_definitions WHERE slug LIKE %s",
                    (SLUG_PREFIX + "%",),
                )
                removed = cur.rowcount
                conn.commit()
                print(f"DELETED {removed} fixture row(s) matching {SLUG_PREFIX}*")
                return 0

            if args.user is None:
                cur.execute("SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1")
                row = cur.fetchone()
            else:
                cur.execute("SELECT id FROM auth.users WHERE id = %s", (args.user,))
                row = cur.fetchone()

            if row is None:
                # REFUSES rather than inventing an owner: a definition owned by a
                # non-existent user is invisible under RLS, and the operator would open the
                # library, see nothing, and have no way to tell why.
                print("NOT SEEDED — no auth.users row to own the fixture.")
                print("Sign in to the local app once, then re-run.")
                conn.rollback()
                return 2

            owner = row[0]
            slug = f"{SLUG_PREFIX}{args.slug}"
            definition = definition_for(args.slug)

            # Idempotent: re-running replaces the fixture rather than colliding with the
            # (slug, version) unique constraint or accumulating near-duplicates.
            cur.execute("DELETE FROM public.workflow_definitions WHERE slug = %s", (slug,))
            cur.execute(
                """
                INSERT INTO public.workflow_definitions
                    (slug, version, name, description, status, definition, created_by)
                VALUES (%s, 1, %s, %s, 'draft', %s, %s)
                RETURNING id
                """,
                (
                    slug,
                    f"200-06 fixture — middle step slugged `{args.slug}`",
                    (
                        "Test data for the BUG-260807-01 / BUG-260808-01 driven row. "
                        "The UI cannot author this slug (D-184-11); safe to delete with "
                        "scripts/seed-constructor-slug-workflow.py --delete"
                    ),
                    json.dumps(definition),
                    owner,
                ),
            )
            new_id = cur.fetchone()[0]
            conn.commit()

        print(f"SEEDED workflow_definitions row {new_id}")
        print(f"  slug         : {slug}")
        print(f"  middle phase : {args.slug!r}")
        print(f"  owner        : {owner}")
        print("")
        # ASCII only, for the same cp1252 reason recorded at the argument parser above:
        # an em-dash here rendered as a replacement character on this box's console.
        print("Now drive the row in the Builder's Canvas tab. The five steps are in this")
        print("script's docstring. Re-run with `--slug harmless` for the control half; the")
        print("two readings must AGREE before either report may be closed.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
