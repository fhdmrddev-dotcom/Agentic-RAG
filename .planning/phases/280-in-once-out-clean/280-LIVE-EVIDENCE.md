# Phase 280 — live evidence

Every row below was measured against the **real local stack**: Postgres on :54322, GoTrue, PostgREST
and Storage on :54321. The drives used real signed-in GoTrue users and their user-JWT clients, and
each test file was run under the local-DB lock. A skip counts as a failure of the row, never as a
pass. HEAD at measurement: `b794a40c5` (plans 01-03 merged), 2026-10-14.

| SC arm | Status | Evidence |
|---|---|---|
| SC#1 same-bytes minter + CR-01 | ✅ PASS | live re-run at `b794a40c5` |
| SC#2 OneDrive re-drive | ⏳ pending — Task 4 | operator-gated (Task 3 checkpoint) |
| SC#3 door 1 | ✅ PASS | 2/2 paths `1 -> 0`, rows gone |
| SC#3 door 2 | ✅ PASS | 2/2 paths `1 -> 0`, rows gone, `purged_count == 2` |
| SC#3 held (both doors) | ✅ PASS | 409 `legal_hold`; rows present; paths `1 -> 1` |
| SC#3 positive control | ✅ the check CAN fail | no-op bytes step → path `1 -> 1`, orphan seen |
| SC#4 live DELETE 404 | ✅ PASS | foreign id and random id → identical `404 'Document not found'` |

## SC#1 — same-bytes minter (FIX-02 / BUG-261005-01) and CR-01 (BUG-261014-01)

Plan 03's live suites were re-run unchanged at `b794a40c5`, under the lock:

```
venv/Scripts/python -m pytest tests/integration/test_280_same_bytes_live.py tests/integration/test_280_cr01_two_org_live.py -q -rs
24 passed, 127 warnings in 46.90s          (0 skipped)
```

- **`test_280_same_bytes_live.py` (18 cases):**
  - in-flight same bytes return the in-flight copy (same folder and another folder);
  - 5 rounds of two concurrent `asyncio.gather` same-bytes mints leave exactly one copy;
  - 3 rounds of concurrent v2 mints;
  - all 7 minter caller shapes get the in-flight copy.
  - Fix commit `89d41fd79`. RED at `a3d9406bc` was recorded in `280-03-SUMMARY.md` (`c07829457`).
- **`test_280_cr01_two_org_live.py` (6 cases):**
  - a two-org user's `/upload` into a folder of the non-default org lands in **that folder's** org;
  - a non-member org's folder (user JWT and service role) gets the byte-identical
    `404 "Folder not found"`;
  - an explicit org that differs from the folder's org gets the same 404.
  - Fix commit `8f83c307e`. Filed as BUG-261014-01 (`86ab344e8`) before the fix.

## SC#3 — both watch purge doors remove the bytes, PER PATH (DEBT-10 / BUG-261012-01; D-13, D-31)

`backend/tests/integration/test_280_purge_bytes_live.py`, run with `-q -rs -s` under the lock:
**6 passed, 0 skipped in 48.63s**.

How the assertion works:

- It is per path: `SELECT count(*) FROM storage.objects WHERE bucket_id = 'documents' AND name = $path`.
  A global orphan count would prove nothing here, because the local DB already holds pre-existing
  orphans.
- The bytes were uploaded by the user-JWT client to each minted document's `file_path`.
- The doors are the route coroutines, called with the live user client, a service-role client for the
  hold predicates, and a real asyncpg pool.

Rows copied from the `EVIDENCE` lines the run printed:

| Arm | Path | storage.objects before → after | documents row after |
|---|---|---|---|
| door 1 (DELETE watch, `purge_documents=true`) | `bb77ef79-…/0eb53ee9-28b9-4332-8f6d-0e848bcdc235/280-pb-d1-0-329613.txt` | 1 → **0** | gone |
| door 1 | `bb77ef79-…/650dbc96-ca8d-4043-9114-36fb2eb8bcd7/280-pb-d1-1-15d1e2.txt` | 1 → **0** | gone |
| door 2 (POST purge, state `missing`) | `649273cc-…/0858ba73-9669-4dd9-9be3-497b14e17636/280-pb-d2-0-618947.txt` | 1 → **0** | gone |
| door 2 | `649273cc-…/fd2dc6e4-a68f-414b-bfc1-486b3fddf0f8/280-pb-d2-1-945734.txt` | 1 → **0** | gone |
| held, door 1 → **409** (held doc) | `6992b1f4-…/af015c61-45c8-44c4-8d03-58624856c264/280-pb-held-door1-a71bf0.txt` | 1 → **1** | present |
| held, door 1 → 409 (unheld sibling) | `6992b1f4-…/a21690fa-0bd6-439e-a333-4458e860f524/280-pb-held-sibling-door1-8e5a32.txt` | 1 → **1** | present |
| held, door 2 → **409** (held doc) | `874c6aa3-…/3448eae8-4596-469a-b067-d636549fd9e9/280-pb-held-door2-b79403.txt` | 1 → **1** | present |
| held, door 2 → 409 (unheld sibling) | `874c6aa3-…/c77223c9-1d17-4e53-8080-815b89f80555/280-pb-held-sibling-door2-e34f42.txt` | 1 → **1** | present |
| **CONTROL**: `remove_document_bytes` planted as a no-op, door 2 | `7a251f3a-…/57f723fb-8c42-408b-bc44-c0778b3a85f0/280-pb-control-da6d7b.txt` | 1 → **1** (orphan SEEN) | gone |

Each path's first segment is the throwaway user's id; it is shortened above. Every user was
different.

What the rows show:

- **Door 1** also deleted the watch.
- **Door 2** left a `present` item's document and object untouched.
- **Held, both doors:**
  - the 409 carried `detail.code == "legal_hold"`;
  - the hold was a real `legal_holds` + `legal_hold_documents` row in the user's org, matched by
    `retention_held_documents` through the service role;
  - the watch survived;
  - the unheld sibling was not purged either, because the whole purge refuses.
- **The control** is the T-280-20 mitigation. It shows the per-path check is able to see the exact
  orphan DEBT-10 used to leave. The row is gone and the object remains.

**Cleanup**, verified by SQL after the run (`residue_280_04.py`, outside the repo), all zero:

- `auth.users` `phase-271-p280pb%`;
- organizations `phase-271-280-pb%`;
- documents `280-pb-%`;
- connections `service_id = 'p280-test'`;
- holds `280 purge-bytes matter%`;
- storage objects `%/280-pb-%`.

Each fixture also asserts its own per-user residue (rows and `storage.objects` under `<uid>/`) is 0.

## SC#4 — live `DELETE /documents/{id}` 404 (DEBT-11 / BUG-261012-02; D-09)

The same run called `documents.delete_document` with a live signed-in user's client (real postgrest
2.29):

```
SC#4 delete_document foreign id -> 404 'Document not found'
SC#4 delete_document random id -> 404 'Document not found'
```

- The "foreign id" is a real document owned by a second GoTrue user in a second org.
- `(status_code, detail, headers)` are equal for both ids, so there is no existence oracle.
- The foreign document still exists afterwards.
- Before `51a9e7962` this path answered a 500, because `maybe_single()` returned `None` for a 0-row
  miss.

## SC#2 — OneDrive re-drive (FIX-03/04/05; D-14, D-15, D-27)

**Status: pending — Task 4.** This row needs the operator: they upload `Team Docs` (95 top-level +
`Q3 Plans/` 10 = 105 files) to OneDrive and approve the drive (Task 3, blocking). Until then it is
neither a pass nor omitted.
