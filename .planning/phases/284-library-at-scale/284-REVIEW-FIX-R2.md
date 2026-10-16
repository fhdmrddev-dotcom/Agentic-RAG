---
phase: 284-library-at-scale
review: 284-REVIEW.md (## Review round 2 — migration 208)
fixed_at: 2026-10-16
base: f6a9493c2
independent_review: self
fixed: [WR-R2-01, WR-R2-02, WR-R2-03, WR-R2-04, WR-R2-05]
not_addressed_info: [IN-R2-01, IN-R2-02, IN-R2-03, IN-R2-04, IN-R2-05]
migrations: 208 edited (local DB only; production still owes 207 and 208)
pushed: false
status: all_fixed_gates_green
---

# Phase 284: Code Review Fix Report, round 2 (migration 208)

All five round-2 warnings are fixed. Migration 208 is applied to the **local** DB only. Production is
still at 206 and owes 207 and 208, so the file could be edited in place: the production paste will use
the final file. 208 was re-applied locally only through `scripts/apply_migration_208.py`. Each change
was proved in a rolled-back transaction first (`--dry-run`: 16/16 PASS, view rows the same for 41/41
users).

## Commits

| Finding | Commit | Files |
|---|---|---|
| WR-R2-01, WR-R2-03, WR-R2-04 (+ the WR-R2-02 tooling) | `d0a11ec71` | `supabase/migrations/208_library_page_index.sql`, `scripts/apply_migration_208.py` |
| WR-R2-05 | `1ec242a84` | `backend/tests/integration/test_284_view_disjoint_live.py` (new) |
| WR-R2-02 (the record) | docs commit | `284-06-SUMMARY.md`, `284-MEASUREMENTS.md`, this file, `284-REVIEW.md` |

`supabase/full-schema.sql` was regenerated (no `--reset`) and came out **byte-identical**: `git add`
staged nothing. The objects did not change, only the file's statement order, its lock timeout and its
VERIFY. ACL parity: `349/349`, and 208's six table statements were recognised.

## WR-R2-01 — VERIFY proves content, not presence

VERIFY now opens with `SET search_path TO public, extensions;` and has 16 rows (it had 14).
- **Policy.** USING is compared **exactly** to 208's text. The policy must also be permissive,
  `FOR SELECT`, and `TO authenticated` only.
- **Policy count and names.** Exactly one permissive policy applies to SELECT for authenticated (or
  PUBLIC), named `Users can view own or global-folder documents`. Exactly one restrictive one,
  `documents_agent_read_retrievable`.
- **View.** `md5(pg_get_viewdef('public.library_documents'::regclass, true))` must equal
  `9d2b4cf53068ecc42342fdafd7816165`. That value is the file's own view: `--dry-run` creates it from
  the file inside a transaction, and the row passes there.
- **Row 8.** Its label now says it checks privileges only. A new row next to it does the actual read:
  with `auth.uid() IS NULL` (BYPASSRLS, the service role's case), `count(*)` from the view is 0.
- **Caveat.** The header notes that both deparsed texts were captured on PG 17.6. On another major
  version, a FAIL on those two rows means "diff the text", not "the wall is gone".

**Plants.** `apply_migration_208.py --prove-verify --old-verify <base 208>` runs each plant in its own
rolled-back transaction. The NEW VERIFY must FAIL the named row. The OLD VERIFY (from `f6a9493c2`) runs
on the same plant for comparison.

```
PLANT: policy: 208's USING with `OR true` appended inside the disjunction  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** the documents SELECT policy's USING is EXACTLY 208's (permissive, FOR SELECT, TO authenticated only)
  OLD VERIFY: 14/14 PASS
PLANT: policy: the org gate's AND turned into OR  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** the documents SELECT policy's USING is EXACTLY 208's (permissive, FOR SELECT, TO authenticated only)
  OLD VERIFY: 14/14 PASS
PLANT: policy: a SECOND permissive SELECT policy for authenticated (USING true)  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** exactly ONE permissive policy on documents applies to SELECT for authenticated, and it is 208's
  OLD VERIFY: 14/14 PASS
PLANT: policy: the restrictive documents_agent_read_retrievable dropped  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** exactly ONE restrictive policy on documents applies to SELECT for authenticated: documents_agent_read_retrievable
  OLD VERIFY: 14/14 PASS
PLANT: view: leg 2 without `u.user_id IS DISTINCT FROM uid` (duplicates)  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** the view definition is exactly 208's (md5 of pg_get_viewdef(..., true) = 9d2b4cf5…)
  OLD VERIFY: 14/14 PASS
PLANT: view: leg 2 without `f.user_id <> uid` (other users' docs in the caller's own shared folder)  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** the view definition is exactly 208's (md5 of pg_get_viewdef(..., true) = 9d2b4cf5…)
  OLD VERIFY: 14/14 PASS
PLANT: index: documents_library_added_idx INVALID (a failed CONCURRENTLY build)  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** documents_library_added_idx exists, is VALID and READY
  OLD VERIFY: 14/14 PASS
PLANT: index: documents_library_root_created_idx not READY  (rolled back)
  NEW VERIFY: 15/16 PASS
    *** FAIL *** documents_library_root_created_idx exists, is VALID and READY (partial: folder_id IS NULL)
  OLD VERIFY: 14/14 PASS
REAL OBJECTS (no plant)
VERIFY: 16/16 PASS
live policy == 208's: True; live view md5: 9d2b4cf53068ecc42342fdafd7816165
PROVED — every plant flips its VERIFY row to FAIL; the real objects read all PASS.
```

The old VERIFY passed all eight plants. That includes the two the review named: `OR true` in the
policy, and leg 2 without `IS DISTINCT FROM`. The two index plants edit `pg_index`, which needs the
local superuser (`supabase_admin`), and both ran inside a rolled-back transaction.

## WR-R2-02 — parity of the documents TABLE under 154's policy vs 208's

`apply_migration_208.py --parity-policy` runs everything in one rolled-back transaction:
- Installs 154's policy, then 208's. Each is confirmed by its deparsed text.
- Fingerprints the documents **table** (row count + md5 of the sorted ids) and the view, for every
  user plus a no-uid caller.
- Reads the way PostgREST does: `SET LOCAL ROLE authenticated` plus `request.jwt.claims` only, with
  `request.jwt.claim.sub` set empty.
- Covers `app.agent_read` off and on.
- Covers two data states. The second, "widened" state flips every connection document to `org` and
  makes 60 documents non-retrievable. That way the connection arm, which decides 0 local rows as-is,
  decides 696 rows.

Result:

| Documents | Callers | as-is, agent_read off / on | widened, agent_read off / on |
|---|---|---|---|
| 325 | 42 (41 users + no uid) | table 42/42 · view 42/42 same, both | table 42/42 · view 42/42 same, both |
| 50,545 | 44 (43 users + no uid) | table 44/44 · view 44/44 same, both | table 44/44 · view 44/44 same, both |

`agent_read` on vs off changed the table for 1 / 12 callers (325) and 2 / 6 callers (50k). So the
restrictive policy did take part in the comparison.

**RED drive of the check.** I ran it with `--plant-drop-connection-arm`, where the "208" side has no
connection arm. The table fingerprint differed for 4 callers in the widened state, and the command
reported `*** FAILED ***`. The view stayed 42/42 "same", which is the blind spot the review described.
The full output is in `284-MEASUREMENTS.md` under "WR-R2-02".

**Record corrected.** `284-06-SUMMARY.md`'s *"parity was checked for all 43 users"* is struck
through, not deleted. It now says what that run covered: the 207 view vs the 208 view under the
already-wrapped policy. It also says what covers the policy change: the run above. The apply script's
per-user view fingerprint now reads with claims only, too, where it used to take the cheap
`request.jwt.claim.sub` branch.

## WR-R2-03 — lock timeout, and the shortest ACCESS EXCLUSIVE hold

- `SET LOCAL lock_timeout = '3s'` now sits next to the pinned `search_path`.
- The guard (`DO $guard$`) moved to the top, so a drifted policy refuses before any index is built.
- `DROP/CREATE POLICY` moved to the very end, right before `COMMIT`. ACCESS EXCLUSIVE on `documents`
  is now held only from the DROP to the COMMIT.
- Reordering is safe because the view, the indexes and the grants do not depend on the policy. The
  dry run, two applies and VERIFY confirm it.
- New header note for production: on `canceling statement due to lock timeout`, re-paste the file.
  Never widen the timeout.

## WR-R2-04 — an INVALID index reads FAIL

- Each of the three index rows now joins `pg_index` and requires `indisvalid AND indisready`. The two
  index plants above show it.
- New header note: if a `CREATE INDEX CONCURRENTLY` fails, `DROP INDEX CONCURRENTLY IF EXISTS
  public.<name>;`, rebuild it, and only then paste 208.

## WR-R2-05 — a standing live test for the legs' disjointness

`test_284_view_disjoint_live.py` seeds the one shape that matches both legs, using `RouteUsers` and
real GoTrue users, and cleans up in `finally`:
- user B owns a document inside user A's org-shared folder, after B joins A's org;
- B also owns a document at Root;
- A owns a document in the same folder.

It then asserts:
- Through PostgREST with B's JWT: the document appears once, there are no duplicate ids,
  `count=exact` equals the distinct ids, and the set is exactly the 3 documents.
- In SQL with claims only: `count(*) == count(DISTINCT id)` and the probe row appears once.
- A sees only A's own document. B's document is in A's *own* shared folder, and 207/208 exclude that
  case even though RLS admits it.

**RED.** I applied a planted view (208's minus `AND u.user_id IS DISTINCT FROM (SELECT auth.uid())`)
to the local DB, after the same plant had already passed a rolled-back `--prove-verify` run:

```
PLANTED view applied locally; md5 now 6091feba5e0a78e35be58af0186e8b50 (208's is 9d2b4cf53068ecc42342fdafd7816165)
>       assert ids.count(str(probe)) == 1, (
E       AssertionError: B's own document in A's shared folder is listed 2 times (leg 1 and leg 2 both matched it: the legs are not disjoint)
E       assert 2 == 1
FAILED tests/integration/test_284_view_disjoint_live.py::test_callers_own_document_in_another_users_shared_folder_is_listed_once
1 failed in 3.68s
```

**Restore.** I ran `apply_migration_208.py --apply` right after. It applied the real file twice, and
both VERIFY runs read 16/16 PASS. documents stayed at 10,545 rows before and after. The view was
row-for-row the same for all 43 users (claims-only read), and the service role read 0 rows. The live
view md5 is back to `9d2b4cf53068ecc42342fdafd7816165`.

Then I checked that the Library list still worked: `test_284_view_disjoint_live.py` +
`test_284_view_live.py` gave **10 passed**. That includes the PostgREST page with
`document_tables(count)` / `document_images(count)` embeds through the view, which is the PGRST200
path.

## VERIFY on the final local objects (run twice, at 50,545 documents)

```
VERIFY (run 1)  … 16 rows, all PASS …   VERIFY: 16/16 PASS
VERIFY (run 2)  … 16 rows, all PASS …   VERIFY: 16/16 PASS
```

## Gates

| Gate | Result |
|---|---|
| `backend/tests/integration/test_284_*.py`, all together, scale account at 50k | **44 passed, 0 skipped**: the 43 of 284-06 plus the new disjointness test. At 10k, 3 suites fail and 2 skip because they need the 50k shape, so the gate run used 50k |
| Backend unit (`pytest tests/unit -q --continue-on-collection-errors`) | **71 failed, 7688 passed, 1 skipped, 2 xfailed, 2 xpassed**. `backend/` differs from base `f6a9493c2` only by the new integration test, so this is the base set by construction. Failing-set md5, warning-stripped: `0983ed65e3d60d3cc1f9d2f863502718` (71 ids) |
| `node scripts/check-schema-acl-parity.cjs` | OK 349/349 |
| `regenerate-full-schema.sh` (no `--reset`) | byte-identical: nothing to stage |
| Teardown | scale account torn down, `dev account documents: before=294 after=294`. Local DB back to 325 documents. Local-DB lock released |

## Not addressed (info, round 2)

IN-R2-01 through IN-R2-05 are as the review recorded them. None was in scope.
- IN-R2-03: the orchestrator's production read showed the policy deparses exactly to `v_154` on PG
  17.6, so the guard will pass in production.
- IN-R2-05: the apply script's loopback guard now covers both DSNs, but it is still a check on
  constants.

## Production paste (unchanged order, updated VERIFY)

Paste 207, then 208, then run `get_advisors(security)`, then the backend, then the frontend.
208's VERIFY must read **16/16** and has to be run *with its `SET search_path` line*. On a lock
timeout, re-paste.
