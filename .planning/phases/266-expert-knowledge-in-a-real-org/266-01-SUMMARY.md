---
phase: 266-expert-knowledge-in-a-real-org
plan: 01
subsystem: experts / database
tags: [experts, rls, migration, tenancy, PACK-18, PACK-19, SEED-304]
requires: []
provides:
  - "public.expert_installs (migration 195) — per-org install home, member-read RLS, backend-only writes"
  - "documents_completed_hash_unique_idx org-scoped (org_id, user_id, content_hash)"
  - "six install queries in app/db/experts.py (contract consumed by 266-03)"
  - "resolve_expert_bundle sources is_system folders from the caller org's install"
affects: [266-03, 266-04, 266-05]
tech-stack:
  added: []
  patterns:
    - "guarded upsert claim: INSERT … ON CONFLICT DO UPDATE … WHERE status <> 'installing' OR stale … RETURNING *"
    - "verbatim retirement comment for a deleted rule (SEED-177 / D-206-07)"
key-files:
  created:
    - supabase/migrations/195_expert_installs_and_seed_retirement.sql
    - backend/tests/unit/test_266_migration_195_shape.py
    - backend/tests/unit/test_266_install_queries.py
    - backend/tests/unit/test_266_system_folder_bypass_fence.py
    - backend/tests/unit/test_266_resolver_reads_installs.py
  modified:
    - scripts/full-schema-supplement.sql
    - backend/app/db/experts.py
    - backend/app/services/expert_service.py
decisions:
  - "195 is wrapped in BEGIN/COMMIT and builds the unique index WITHOUT CONCURRENTLY (cannot run in a transaction; documents is small)"
  - "claim_expert_install does not overwrite installed_by on conflict; set_expert_install_folder records the repairer"
  - "SYSTEM_USER_ID kept in expert_service.py with a comment (no reader after 266) so the retirement stays greppable"
metrics:
  duration: ~35 min
  completed: 2026-09-24
  tasks: "2 of 3 complete (Task 3 = operator/orchestrator checkpoint)"
---

# Phase 266 Plan 01: Expert installs data floor + resolver reads the install — Summary

Migration 195 adds `public.expert_installs` (member-read RLS, no client write grant), org-scopes the
completed-hash unique index, and retires migration 188's orphaned seed knowledge. `resolve_expert_bundle`
now takes a first-party Expert's folder ONLY from the caller org's install row, and the
`is_system_folder` bypass is gone, with a fence that was driven RED against the old rule.

## Tasks

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Migration 195 + supplement mirror, pinned by a shape test | `e8d266014` (RED) · `87d60eeb4` (GREEN) | done |
| 2 | Install queries + resolver reads the install; bypass deleted | `cc8466ef6` (RED) · `b89f7262a` (GREEN) | done |
| 3 | Operator applies 195 to the LOCAL DB + regenerates full-schema.sql | — | **PENDING. The orchestrator applies 195 to the local DB and regenerates full-schema.sql** |

## Task 1: evidence

**RED** (before the migration existed): `8 failed`. 7 were `FileNotFoundError: … supabase\migrations\195_expert_installs_and_seed_retirement.sql`, and 1 was `assert [] == ['195_expert_installs_and_seed_retirement.sql']` (empty glob).

**GREEN:** `tests/unit/test_266_migration_195_shape.py`: `8 passed`.

- `ls supabase/migrations/195_*.sql` returns exactly `195_expert_installs_and_seed_retirement.sql`.
- `grep -v '^--' … | grep -c "0264"` returns `0`. Skill …0264 is kept and named only in the header comment.
- `git diff --quiet HEAD -- supabase/full-schema.sql` shows no hand edit.
- FK pre-check (plan step): every FK referencing `public.documents(id)` / `public.folders(id)` in `full-schema.sql` carries an `ON DELETE` action (`grep … | grep -v "ON DELETE"` returned nothing). No extra dependent DELETE was needed.
- `node scripts/check-schema-acl-parity.cjs`:
  - **Tuple parity: `mirrored: 191/191`.** Research measured 183/183, so this is +8 tuples from 195's 5 statements (`195 (5)` in the per-migration list).
  - ⚠ **The gate EXITS 1 on its tail arm:** `THE BOOTSTRAP ARTIFACT HAS LOST ITS SUPPLEMENT TAIL`. The last 690 lines of `full-schema.sql` (md5 `7b60124b…`) differ from the supplement (md5 `784509d6…`). This is expected and cannot be closed in this task. The tail is appended by `regenerate-full-schema.sh`, which needs Docker (Task 3), and CLAUDE.md forbids hand-editing `full-schema.sql`. **Task 3's regeneration closes it. The orchestrator must re-run the gate after regenerating and see exit 0.**

## Task 2: evidence

**RED** (against the unmodified tree): `15 failed, 2 passed`.
- `test_266_install_queries.py`: 9 failed, all `AttributeError: module 'app.db.experts' has no attribute '<fn>'`.
- `test_266_system_folder_bypass_fence.py`: the fence failed with `assert [UUID(..)] == []`. The bypass admitted the foreign-org seed-user folder. The positive control passed.
- `test_266_resolver_reads_installs.py`: (a), (b), (c), (d) and (f) failed. (c) failed with `assert [UUID(..)] == []`, the pre-195 global …0260 admitted by the bypass. (e) passed on base, as intended: org-authored bundles are unchanged.

**GREEN:** the 5 verify-command suites plus the shape test: `43 passed`. `ls tests/unit/test_26[1-4]_*.py` (26 files): `304 passed`. Every suite that imports the resolver or `app.db.experts` (23 files, including `test_260_*` and `test_seed125_*`): `209 passed`.

**D-266-10 plant** (drives the fence against the old rule; explicit-path checkout only):

| Step | expert_service.py md5 | fence result |
|------|----------------------|--------------|
| new version (HEAD `b89f7262a`) | `9353193402f264cc930fa821d24c53f4` | — |
| `git checkout 522e7b4fc -- backend/app/services/expert_service.py` | `fa4bbc42a13fe20ab69a2fd228319c07` | **`1 failed, 1 passed`** (`Left contains one more item: UUID('f6c0ed87-…')`) |
| `git checkout HEAD -- backend/app/services/expert_service.py` | `9353193402f264cc930fa821d24c53f4` (identical) | **`2 passed`** |

**Acceptance greps:**
- `grep -n "is_system_folder" expert_service.py | grep -v "#"` returns nothing. The only occurrence is inside the verbatim retirement comment.
- The `EXPERT_MEMBER_CROSS_ORG_STRIPPED` count is `5`, and it was `5` at base.
- `git diff 522e7b4fc -- backend/app/db/experts.py | grep "^-" | grep -v "^---" | wc -l` returns `0`, so the change is additions only.
- `git diff --quiet 522e7b4fc HEAD -- backend/app/services/run_producer.py` exits 0 (run_producer unchanged).

**Backend baseline gate** (run once, in this worktree): `71 failed, 5559 passed, 1 skipped, 2 xfailed, 2 xpassed`, `[GATE PASSED] (failed: 71 <= 71, errors: 0)`.

## Task 3: PENDING (orchestrator)

The orchestrator applies 195 to the local DB and regenerates full-schema.sql, with operator authorisation. Steps:
1. Paste all of `supabase/migrations/195_expert_installs_and_seed_retirement.sql` into the LOCAL Studio SQL editor. Never use `db push` or `db reset`.
2. Run `bash scripts/regenerate-full-schema.sh` (no `--reset`), then `node scripts/check-schema-acl-parity.cjs`. The gate must now exit 0, because the tail arm closes.
3. Verify with SQL. Record `SELECT count(*) FROM skills WHERE id='00000000-0000-0000-0000-000000000264'` **before** the paste as well:
   - `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.expert_installs'::regclass` → `true`
   - `SELECT has_table_privilege('anon','public.expert_installs','SELECT'), has_table_privilege('authenticated','public.expert_installs','INSERT'), has_table_privilege('authenticated','public.expert_installs','SELECT')` → `false, false, true`
   - `SELECT count(*) FROM pg_policies WHERE tablename='expert_installs'` → `1`
   - `SELECT indexdef FROM pg_indexes WHERE indexname='documents_completed_hash_unique_idx'` → contains `(org_id, user_id, content_hash)`
   - `SELECT count(*) FROM documents WHERE id='00000000-0000-0000-0000-000000000261'`, `SELECT count(*) FROM folders WHERE id='00000000-0000-0000-0000-000000000260'`, `SELECT count(*) FROM document_chunks WHERE document_id='00000000-0000-0000-0000-000000000261'` → `0, 0, 0`
   - `SELECT knowledge_folder_ids FROM expert_bundles WHERE slug='financial-analyzer'` → does not contain …0260. `SELECT count(*) FROM skills WHERE id='00000000-0000-0000-0000-000000000264'` → unchanged from before the paste.
   - `git diff --stat supabase/full-schema.sql` shows the new table and index. `grep -c "expert_installs" supabase/full-schema.sql` > 0.

## Deviations from Plan

**1. [Rule 3, blocking, deferred to Task 3] The ACL parity gate cannot exit 0 inside Task 1**
- **Found during:** Task 1.
- **Issue:** since 253-03, `check-schema-acl-parity.cjs` also asserts that `full-schema.sql`'s tail is byte-identical to the supplement. Editing the supplement, which the plan requires, makes that arm red until the artifact is regenerated. Regenerating needs Docker (Task 3), and a hand edit of `full-schema.sql` is forbidden.
- **Resolution:** tuple parity is complete (`191/191`). The tail arm is left red on purpose and handed to Task 3. No file was hand-edited to force green.
- **Files:** none beyond the plan's.

Otherwise the plan was executed as written. The test for the kept skill was strengthened: it asserts no DELETE or UPDATE targets `skills` at all, not only that …0264 is absent.

## Known Stubs

None.

## Threat Flags

None. The new surface (`expert_installs`) is exactly the one in the plan's threat register (T-266-01..07). Mitigations applied: RLS on; REVOKE ALL FROM PUBLIC/anon/authenticated; SELECT only to authenticated; one FOR SELECT policy over `current_user_org_ids()`; a shape test that fails on any client write grant; numbered binds with no-interpolation tests; the bypass deleted with a RED-driven fence; install-sourced ids re-proved by the strict loop (test d).

## TDD Gate Compliance

Both RED `test(266-01)` commits (`e8d266014`, `cc8466ef6`) come before their GREEN `feat(266-01)` commits (`87d60eeb4`, `b89f7262a`). No refactor commit was needed.

## Self-Check: PASSED

- All 5 created files and 3 modified files are present in the tree.
- Commits `e8d266014`, `87d60eeb4`, `cc8466ef6` and `b89f7262a` are present in `git log`.
- STATE.md and ROADMAP.md were not modified.
