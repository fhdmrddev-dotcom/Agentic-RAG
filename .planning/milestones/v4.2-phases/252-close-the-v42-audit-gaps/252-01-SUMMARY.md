---
phase: 252-close-the-v42-audit-gaps
plan: 01
subsystem: database
tags: [postgres, acl, security-definer, pg_dump, supabase, fastapi, guardrail, reported-bugs]

# Dependency graph
requires:
  - phase: 248-the-credential-boundary
    provides: "migration 181 — the 13 SECURITY DEFINER function revokes this plan makes reachable by a greenfield bootstrap"
  - phase: 249-the-model-you-actually-run
    provides: "SettingsWriteRefused + the four sibling 400 seams whose shape W-4 copies"
provides:
  - "scripts/full-schema-supplement.sql §6a/§6b — the function EXECUTE ACLs of migrations 012, 104, 106, 177 and 181, the only artifact that can carry a grant past `pg_dump --no-privileges`"
  - "supabase/full-schema.sql — the same text at its tail, byte-identical, so a greenfield paste revokes PUBLIC EXECUTE on 16 functions"
  - "scripts/check-schema-acl-parity.cjs — the durable guard for the ACL-mirror class, with --self-test"
  - "POST /setup/provider-key answers 400 on a refused write instead of an uncaught exception"
  - "a reported-bugs register with one BUG-260828-02 and six statuses that match reality"
affects: [252-02, 252-05, 252-verification, any future migration that narrows a privilege, deploy parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ACL parity gate: the supplement's mirror obligation is machine-checked against every migration, not asked for in prose"
    - "a bootstrap artifact edited by script (head + supplement) rather than by hand, so the equivalence is mechanically provable without Docker"

key-files:
  created:
    - scripts/check-schema-acl-parity.cjs
    - backend/tests/unit/test_252_setup_refusal.py
    - .planning/reported-bugs/BUG-260828-11-grant-override-marker-claims-a-person-changed-it.md
  modified:
    - scripts/full-schema-supplement.sql
    - supabase/full-schema.sql
    - backend/app/api/setup.py
    - .planning/ROADMAP.md
    - .planning/milestones/v3.9-ROADMAP.md
    - .planning/phases/248-the-credential-boundary/248-02-PLAN.md
    - .planning/phases/248-the-credential-boundary/248-CONTEXT.md

key-decisions:
  - "MIN_MIGRATION_FILES is 120, not the plan's 150 — there are 148 migration files, so a floor of 150 would have made the gate exit 2 on every run. A gate that can only fail is as useless as one that can only pass."
  - "The gate scans EVERY migration, not only 181 — and its first real run found three unmirrored functions the phase's research never measured. Scoping it to 181 would have shipped a guard that passes over a live greenfield gap."
  - "BUG-260902-06 and BUG-260907-02 are `folded`, not `closed`: Phase 249's own verifier says the multi-worker half was never observed, and 252's B-3 measured a writer that bypasses 248's validator. A wrong `closed` is worse than a stale `open`."
  - "The 500 arm of POST /setup/provider-key is byte-unchanged and pinned by a control test — a refusal and a write-through failure mean different things."

patterns-established:
  - "Pattern: a mirror obligation gets a gate, never a fourth prose note — full-schema.sql:7449 already documented this class verbatim for migration 118 and 181 reproduced it anyway"
  - "Pattern: the RED drive names a counterfactual — the gate must be seen NOT to fire on a mirrored signature, or it could pass its RED arm by printing everything it knows"

requirements-completed: [CRED-03, CRED-04, MODEL-08]

# Metrics
duration: ~95min
completed: 2026-09-16
---

# Phase 252 Plan 01: Greenfield ACL parity + the setup refusal — Summary

**Migration 181 was correct and unreachable: `pg_dump --no-privileges` means no dump can ever carry a function grant, so a greenfield bootstrap shipped all 13 SECURITY DEFINER functions `anon`-executable over PostgREST. This plan mirrors them into the one artifact a bootstrap reads, guards that mirror with something that has been seen to fire — and the guard's first real run found three MORE unmirrored functions, including the one that deletes every vector in the corpus.**

## Performance

- **Duration:** ~95 min
- **Base commit:** `53e2435b7` (asserted; the worktree was created on `master` at `84e3b020f` and reset)
- **Tasks:** 4/4
- **Files modified:** 15 (988 insertions, 31 deletions)

## Accomplishments

- **SC#1 is structurally true.** A greenfield paste of `supabase/full-schema.sql` now revokes `PUBLIC` EXECUTE on **16** functions — migration 181's 13, plus three the gate found.
- **The third recurrence of the ACL-mirror class is guarded by something executable**, driven RED on a planted omission *and* on the counterfactual, with the supplement restored md5-identical.
- **⭐ The guard found a real gap on its first run, before any planted defect.** `resize_embedding_column` — the RPC `BUG-260911-01` found callable **unauthenticated in production**, which NULLs every vector in `document_chunks` and `skill_embeddings` — was mirrored by nothing. Migration 177 closed it on every DB that ran 177; a greenfield deploy re-opened it.
- **A refused provider-key write is named (400) instead of escaping as an uncaught exception**, with the unrelated 500 path proven untouched by a control test.
- **The reported-bugs register has one `BUG-260828-02`** and six statuses that match measured reality — two of which are deliberately *not* `closed`.

## Task Commits

1. **Task 1: Mirror migration 181 into the supplement** — `a7efe17d1` (feat)
2. **Task 2: The parity gate, driven RED on both arms** — `588373b4c` (feat)
3. **Task 3: W-4 — a refused provider-key write answers 400** — `098503f64` (test)
4. **Task 4: The reported-bugs register sweep** — `c27cabeef` (docs)

---

# Task 1 — the evidence, printed

## BEFORE

```
$ wc -l scripts/full-schema-supplement.sql supabase/full-schema.sql
   259 scripts/full-schema-supplement.sql
  7513 supabase/full-schema.sql

$ diff <(tail -n 259 supabase/full-schema.sql) scripts/full-schema-supplement.sql
diff exit=0                       # BEFORE: tail == supplement

$ grep -c "REVOKE.*EXECUTE ON FUNCTION" supabase/full-schema.sql scripts/full-schema-supplement.sql
supabase/full-schema.sql:0
scripts/full-schema-supplement.sql:0
```

The D-06 licence held: the supplement was the dump's verbatim tail, and neither artifact carried a single function ACL.

## AFTER — the tail-parity diff, verbatim

```
$ SUP=$(wc -l < scripts/full-schema-supplement.sql)   # 433
$ diff <(tail -n "$SUP" supabase/full-schema.sql) scripts/full-schema-supplement.sql
diff exit=0
```

**The diff is empty.** Not paraphrased — that is the entire output of the command.

## AFTER — the counts

```
$ grep -c "REVOKE EXECUTE ON FUNCTION" scripts/full-schema-supplement.sql supabase/full-schema.sql supabase/migrations/181_...sql
scripts/full-schema-supplement.sql:30
supabase/full-schema.sql:30
supabase/migrations/181_revoke_public_secdef_functions.sql:30

$ grep -c "GRANT EXECUTE ON FUNCTION" (same three)
30 / 20 / 20 / 20

$ grep -o "ON FUNCTION public\.[a-z_]*" scripts/full-schema-supplement.sql | sort -u | wc -l
13                                      # after §6a; 16 after §6b

$ grep -c "BEGIN;" scripts/full-schema-supplement.sql
0
$ grep -c "COMMIT;" scripts/full-schema-supplement.sql
0
```

## ⚠ WHERE THE CODE DISAGREED WITH THE PLAN — the counts

The plan's must_have and acceptance criteria say **"31 REVOKEs and 17 GRANTs"**. Migration 181 has **30 REVOKEs and 20 GRANTs**, measured:

```
$ grep -c "^REVOKE EXECUTE ON FUNCTION" supabase/migrations/181_...sql   → 30
$ grep -c "^GRANT EXECUTE ON FUNCTION"  supabase/migrations/181_...sql   → 20
$ grep -n "REVOKE" ...sql | grep -v "^[0-9]*:REVOKE EXECUTE ON FUNCTION"
7:-- so `REVOKE ... FROM anon` changes nothing while the PUBLIC grant stands …
```

The **31** in `252-RESEARCH.md §1.1` came from `grep -c REVOKE`, which counted **one comment line**. The **17** is simply wrong — arithmetic on the three groups gives `(4×3) + (2×2) + (7×2) = 30` revokes and `4 + 2 + (7×2) = 20` grants. ⭐ **The machine-checked criterion — signature-set parity — is the one that matters, and it holds exactly.** A count that is off by a comment is a count; a signature that is off by an argument is a different function.

## ⭐ Signature parity, machine-checked

```
$ grep -o "ON FUNCTION .*" <file> | sed 's/ FROM .*//; s/ TO .*//' | sort -u
$ diff sig-mig.txt sig-sup.txt
diff exit=0          # 13 lines each, identical
```

The 13, as the migration names them (argument lists intact — `f(uuid, text)` is not `f(uuid)`):

```
public.autofill_org_id_by_owner()
public.autofill_org_id_from_parent()
public.capture_skill_version()
public.connection_doc_is_visible(uuid, text)
public.current_user_has_permission(uuid, text)
public.current_user_org_ids()
public.folder_is_org_shared(uuid)
public.handle_new_user()
public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[])
public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)
public.match_skills(vector, uuid, text)
public.stale_skill_embedding()
public.stale_skill_embedding_from_case()
```

## PUBLIC-before-anon, per function

Asserted mechanically over the final file (line numbers are the supplement's):

```
  OK   public.autofill_org_id_by_owner()                       PUBLIC@341 < anon@342
  OK   public.autofill_org_id_from_parent()                    PUBLIC@347 < anon@348
  OK   public.capture_skill_version()                          PUBLIC@311 < anon@312
  OK   public.connection_doc_is_visible(uuid, text)            PUBLIC@363 < anon@364
  OK   public.create_org_with_default_dept(text, text, text)   PUBLIC@421 < anon@422
  OK   public.current_user_has_permission(uuid, text)          PUBLIC@368 < anon@369
  OK   public.current_user_org_ids()                           PUBLIC@358 < anon@359
  OK   public.folder_is_org_shared(uuid)                       PUBLIC@373 < anon@374
  OK   public.handle_new_user()                                PUBLIC@316 < anon@317
  OK   public.keyword_search_chunks(…)                         PUBLIC@379 < anon@380
  OK   public.match_document_chunks(…)                         PUBLIC@384 < anon@385
  OK   public.match_skills(vector, uuid, text)                 PUBLIC@389 < anon@390
  OK   public.resize_embedding_column(integer)                 PUBLIC@427 < anon@428
  OK   public.stale_skill_embedding()                          PUBLIC@321 < anon@322
  OK   public.stale_skill_embedding_from_case()                PUBLIC@326 < anon@327

functions with an anon revoke: 15 · PUBLIC-before-anon violations: 0
```

(The 16th, `public.query_user_documents(text)`, carries only a GRANT.)

## The Docker substitute, and why it is equivalent

`regenerate-full-schema.sh` could not run (Docker denied). The mechanical substitute, done in Python so CRLF is preserved byte-exactly:

```
head = full-schema.sql minus its last 259 lines      # asserted == the OLD supplement first
full-schema.sql := head + the NEW supplement
```

**Migration 181 changes no schema object — only ACLs — so the `pg_dump` half of the artifact is unchanged by construction**, and the supplement is appended verbatim as the tail (proven both before and after). `git diff --unified=0` confirms exactly two hunks, both inside the supplement region (`@@ -7280,9 +7280,12 @@` — the MAINTENANCE header — and `@@ -7511,3 +7514,123 @@` — the append). No line above the old supplement boundary is touched.

---

# Task 2 — the gate, and what it found

## Scan mode, today

```
$ node scripts/check-schema-acl-parity.cjs; echo "exit=$?"
schema ACL parity — migrations scanned: 148 · function ACLs found: 16 · mirrored: 16 (61 GRANT/REVOKE statements)
schema ACL parity OK — every function ACL in supabase/migrations/ is mirrored in the supplement.
exit=0
```

## ⭐⭐ THE FINDING: the gate fired FOR REAL on its first run, before any planted defect

```
schema ACL parity — migrations scanned: 148 · function ACLs found: 16 · mirrored: 13 (61 …)

3 FUNCTION ACL(S) ARE NOT MIRRORED — a greenfield bootstrap does not carry them:
  [not-mirrored]  public.create_org_with_default_dept(text, text, text)  — migrations/104_org_dept_role_schema.sql grants/revokes it; the supplement does not
  [not-mirrored]  public.query_user_documents(text)  — migrations/012_query_documents_fn.sql grants/revokes it; the supplement does not
  [not-mirrored]  public.resize_embedding_column(integer)  — migrations/177_rls_app_settings_user_settings.sql grants/revokes it; the supplement does not
exit=1
```

**The mirror gap was wider than the migration that prompted it.** `252-RESEARCH.md §1` measured 181 and stopped; five migrations carry function ACLs (`012`, `104`, `106`, `177`, `181`). Two of the three are **narrowing** revokes, i.e. real greenfield exposure:

- ⛔ **`resize_embedding_column(integer)`** — the destructive RPC `BUG-260911-01` found **callable unauthenticated in production**. It NULLs every vector in `document_chunks` **and** `skill_embeddings`. Migration 177 closed it everywhere 177 ran; every greenfield deploy re-opened it. **This is the file's own failure class, one function over.**
- **`create_org_with_default_dept(text, text, text)`** — migration 104 revokes PUBLIC/anon/authenticated; greenfield shipped it PUBLIC-executable.
- `query_user_documents(text)` — migration 012's GRANT is a *widening* and harmless, mirrored anyway so the rule stays "every function ACL appears here", with **no exception list**. An exception list rots; a complete statement of the posture does not.

## ⭐ AND A SECOND, STRUCTURAL FINDING: §6a alone is INERT for Group B on greenfield

Migration 181's Group B (`autofill_org_id_by_owner()`, `autofill_org_id_from_parent()`) revokes `anon` and `authenticated` but **not `PUBLIC`** — because migration **106** had already revoked PUBLIC on every live DB. `--no-privileges` loses 106's revoke too, so **on a greenfield database the PUBLIC grant is still standing and 181's two role revokes achieve nothing** — migration 177's measured trap, one register over. 106's two `FROM PUBLIC` revokes are now mirrored inside §6a's Group B, each immediately before its function's `anon` revoke, marked inline as coming from 106 rather than 181.

A signature-set gate would *not* have caught this on its own (both functions were already mirrored by signature). It was found by reading what 181's Group B comment actually asserts against what a greenfield DB actually looks like.

## RED arm 1 — driven on the working tree, restored md5-identical

```
$ md5sum scripts/full-schema-supplement.sql
6a58a47651156ef6dccdf75b93365e66 *scripts/full-schema-supplement.sql     # BEFORE

# planted: the four public.current_user_org_ids() lines deleted (removed 4 lines)

$ node scripts/check-schema-acl-parity.cjs; echo "exit=$?"
schema ACL parity — migrations scanned: 148 · function ACLs found: 16 · mirrored: 15 (61 …)

1 FUNCTION ACL(S) ARE NOT MIRRORED — a greenfield bootstrap does not carry them:
  [not-mirrored]  public.current_user_org_ids()  — migrations/181_revoke_public_secdef_functions.sql grants/revokes it; the supplement does not
exit=1

# restored
$ md5sum scripts/full-schema-supplement.sql
6a58a47651156ef6dccdf75b93365e66 *scripts/full-schema-supplement.sql     # AFTER — identical
$ node scripts/check-schema-acl-parity.cjs; echo "exit=$?"   → exit=0
```

## RED arm 2 — the counterfactual, measured in that same red run

```
$ grep -c "not-mirrored"          red.txt  → 1
$ grep -c "match_skills"          red.txt  → 0
$ grep -c "resize_embedding_column" red.txt → 0
```

**Exactly one line. Signatures present in both are ABSENT from the failure output** — the gate does not pass its RED arm by printing everything it knows.

## `--self-test` — 10/10

```
$ node scripts/check-schema-acl-parity.cjs --self-test; echo "exit=$?"
  PASS  normaliser: whitespace and case collapse  — public.f(uuid, text) / public.f(uuid, text)
  PASS  normaliser: the ARGUMENT LIST is identity  — public.f(uuid) !== public.f(uuid, text)
  PASS  normaliser: an unqualified name reads as public.
  PASS  GREEN: a complete supplement exits 0  — exit=0, found=3
  PASS  GREEN: the commented VERIFY block is NOT counted  — found public.alpha(), public.beta(uuid, text), public.gamma(uuid)
  PASS  RED arm 1: a planted omission exits 1  — exit=1
  PASS  RED arm 1: the failure NAMES the missing signature
  PASS  RED arm 1: the failure names the migration file
  PASS  RED arm 2 (COUNTERFACTUAL): a MIRRORED signature is ABSENT from the failure output
  PASS  COUNT: a collapsed scan set is a harness error, never a pass  — only 0 migration file(s) matched in …/empty-migrations, below the floor of 120

self-test OK — 10/10 assertions
exit=0
```

`public.f( uuid ,text )` and `PUBLIC.F(uuid, text)` both normalise to `public.f(uuid, text)`; `public.f(uuid)` does **not**, and the self-test asserts the inequality directly. The fixture is built under `os.tmpdir()` and `assertOutsideWatchedTree`-checked (no scratch in a watched tree), padded to the **real** `MIN_MIGRATION_FILES` so it exercises the shipped constant.

## Dependencies, and exit-2 wiring

```
$ grep -n "require(" scripts/check-schema-acl-parity.cjs
40:const fs = require('fs');
41:const path = require('path');
42:const os = require('os');

$ node scripts/check-schema-acl-parity.cjs --bogus-arg; echo "exit=$?"
FATAL: unknown argument(s): --bogus-arg. usage: check-schema-acl-parity.cjs [--self-test]
exit=2
```

⚠ **Stated precisely, because it matters:** the `--bogus-arg` run proves `fail()` really exits **2** at process level. The *count-assertion's* exit-2 path is proven by `--self-test`'s COUNT arm, which asserts the thrown `VacuousScanError` names the floor; the throw→`fail()` wiring is the module's single `try { process.exit(main()) } catch { fail() }` entry point, which the `--bogus-arg` run exercises. `main()` is not parameterised on the migrations directory **on purpose** — a `--migrations <dir>` flag would let a caller point the gate at a fixture and weaken it.

## ⚠ WHERE THE CODE DISAGREED WITH THE PLAN — the floor

The plan specifies `MIN_MIGRATION_FILES = 150`. **There are 148 migration files:**

```
$ ls supabase/migrations/ | grep -cE '^[0-9]+_.*\.sql$'   → 148
$ ls supabase/migrations/ | grep -v -E '^[0-9]+_.*\.sql$' → (nothing; all match)
```

A floor of 150 would have made the gate exit **2 on every run, forever** — a gate that can only fail is as useless as one that can only pass, and would have been switched off. **Shipped at 120**, with the measurement and the reason written into the constant's docblock.

---

# Task 3 — W-4, the quoted RED

## The pre-fix failure, quoted

The plan asked whether the test client re-raises or returns 500. **It re-raises** — the exception escapes the ASGI stack entirely; there is no 500:

```
app\api\setup.py:385: in provider_key
    if not await save_provider_key(body.provider, body.api_key, body.embedding_key):
_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _

_a = ('openai', 'sk-THROWAWAY-NOT-A-REAL-KEY-252', None), _k = {}

    async def _refuse(*_a, **_k):
>       raise SettingsWriteRefused(["openai_api_key"], "app_settings_openai_api_key_check")
E       app.models.user_settings.SettingsWriteRefused: The database refused this settings write. columns=['openai_api_key'] constraint=app_settings_openai_api_key_check

tests\unit\test_252_setup_refusal.py:73: SettingsWriteRefused
=========================== short test summary info ===========================
FAILED tests/unit/test_252_setup_refusal.py::test_provider_key_refusal_answers_400
1 failed, 1 passed, 1 warning in 0.89s
```

**`1 failed, 1 passed`** is the shape the plan asked for: case 1 red, and the control (case 2, the `False` → 500 path) green *before* the fix.

⭐ **That matters for the operator-visible story.** The docstring at `setup_service.py:342-345` says the exception *propagates by design* and must not be caught there — which is only correct if it is **caught here**. Uncaught, it left the stack as an unhandled exception: in production the operator gets an opaque 500 with no sentence, on the one wizard most likely to meet a *knob shipped without its migration*.

## GREEN

```
$ cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_252_setup_refusal.py -q
..                                                                       [100%]
2 passed, 1 warning in 0.24s
```

## The 500 arm is byte-unchanged

```
$ grep -c "status_code=500" backend/app/api/setup.py            → 1
$ git show HEAD:backend/app/api/setup.py | grep -c "status_code=500"  → 1    (before the fix)
```

`git diff backend/app/api/setup.py` contains exactly two hunks — `@@ -46,7 +46,7 @@` (the import) and `@@ -381,8 +381,26 @@` (`provider_key`). **No other route appears in the diff.**

## The full backend baseline — the SET, not a tail

```
$ cd backend && ./venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors
71 failed, 4866 passed, 2 xfailed, 2 xpassed, 42 warnings in 242.60s (0:04:02)
```

`4866 = 4864 baseline + this plan's 2`. The failing **set** was captured and compared id-by-id against `252-BASELINE-backend-failures.txt`:

```
baseline ids: 71
now ids:      71
NEW (this plan's, blocking): []
GONE (fixed by this plan):   []
```

⭐ **Zero new, zero gone.** At the locked ceiling with zero headroom, and no connector/setup/oauth/mcp id anywhere in the set.

---

# Task 4 — the register sweep

## The duplicate (D-36)

`git mv` → `BUG-260828-11-grant-override-marker-claims-a-person-changed-it.md`, `id: BUG-260828-11`, `previous_id: BUG-260828-02`, with the collision's history written into the body.

```
$ grep -l "^id: BUG-260828-02" .planning/reported-bugs/*.md
.planning/reported-bugs/BUG-260828-02-no-authoring-surface-can-declare-a-workflow-input.md
$ … | wc -l   → 1
$ ls .planning/reported-bugs/ | wc -l   → 190     (190 before; a rename, not an add or a delete)
```

## The citation grep — 90 hits before, 90 after, every one classified

Per-file counts are identical before and after (the two edited lines kept their id in a correction clause rather than losing it). **Every hit falls in exactly one of three classes:**

**(a) MEANS THE WORKFLOW-INPUT BUG — the id's rightful owner, left untouched (68 hits):**

| File | hits |
|---|---|
| `.planning/milestones/v3.9-phases/214.1-…/214.1-VERIFICATION.md` | 6 |
| `.planning/milestones/v3.9-ROADMAP.md` | 4 (of 5 — see (c)) |
| `.planning/milestones/v3.9-phases/214.1-…/214.1-02-PLAN.md` | 5 |
| `.planning/milestones/v3.9-phases/214.1-…/214.1-01-PLAN.md` | 5 |
| `docs/HOT-FILE-LEDGER.md` | 4 |
| `.planning/milestones/v3.9-phases/214-…/214-VERIFICATION.md` | 4 |
| `frontend/src/components/workflows/declaredInputs.test.ts` | 3 |
| `.planning/seeds/SEED-225-an-external-step-cannot-attach-a-file.md` | 3 |
| `.planning/milestones/v3.9-phases/214.1-…/214.1-CONTEXT.md` | 3 |
| `.planning/milestones/v3.9-phases/214.1-…/214.1-02-SUMMARY.md` | 3 |
| `frontend/src/pages/WorkflowBuilderPage.declaredInputs.test.tsx` | 2 |
| `frontend/src/components/workflows/DeclaredInputsEditor.test.tsx` | 2 |
| `frontend/src/components/workflows/declaredInputs.ts` | 2 |
| `.planning/seeds/SEED-232-a-workflow-cannot-be-started-from-inside-a-thread.md` | 2 |
| `.planning/milestones/v3.9-phases/214.1-…/214.1-01-SUMMARY.md` | 2 |
| `scripts/vitest-count-gate.cjs` · `frontend/src/lib/api/workflows.ts` · `declaredInputsVocabulary.ts` · `DeclaredInputsEditor.tsx` · `backend/tests/unit/test_workflow_authoring_requirement.py` · `backend/tests/unit/test_260828_09_publish_names_the_failing_step.py` · `backend/app/services/workflow_authoring.py` · `BUG-260828-10-….md` · `BUG-260828-02-….md` · `v3.9-REQUIREMENTS.md` | 1 each |

⭐ **This is exactly why the CLOSED report keeps `-02`.** Eight of those files are **source and test code**. Renaming the cited one would have produced dangling citations in shipped code; renaming the open one produced **none** — measured, not assumed.

**(b) RECORDS OF THE COLLISION ITSELF (kept, and now they resolve):** `248-CONTEXT.md` (4, one of which gained the resolution), `248-DISCUSSION-LOG.md` (2), `.planning/REQUIREMENTS.md` (2 — the `CRED-02` correction note that already cites by path), `BUG-260828-11`'s own body (3), and the Phase 252 planning docs (`252-01-PLAN.md` 13, `252-RESEARCH.md` 2, `252-CONTEXT.md` 2).

**(c) RE-POINTED — the two hits that MEANT the grant-override bug (2):**

- `.planning/phases/248-the-credential-boundary/248-02-PLAN.md:54` — *"Attribution Integrity (TM-248-02 / BUG-260828-02)"*. The affordance work is unmistakably the grant marker.
- `.planning/milestones/v3.9-ROADMAP.md:872` — Phase 213's row, *"Also open: `BUG-260828-02`"*. The report's own body records it as *"Driven in the live app during Phase 213's driven check"*.

Both were corrected **beside** the original id rather than overwriting it, so a reader of the old text can follow the change.

## The six statuses (D-35)

| id | before | after | verifier / reason |
|---|---|---|---|
| `BUG-260911-01` | `open` / `null` | **`closed`**, `verified_closed_by: 242` | migration `177_rls_app_settings_user_settings.sql`. Two independent **production** read-only measurements: `248-MEASUREMENTS.md` (`source: production`) puts `resize_embedding_column` in Group C — ACL `postgres=X \| service_role=X`, `anon` false **and** `authenticated` false — and `248-CONTEXT.md:221` records *"Production currently has zero ERROR"* from `get_advisors(security)`, the `rls_disabled_in_public` half |
| `BUG-260910-03` | `open` / `null` | **`closed`**, `verified_closed_by: 242` | commit `46292bb81` *"the Search tab sends only what CHANGED, and a refusal names the stored value"*; corroborated in `REQUIREMENTS.md:22` and `ROADMAP.md:289` |
| `BUG-260913-01` | `open` / `null` | **`closed`**, `verified_closed_by: 247` | `google_drive.py:_resolve_folder_path` + `test_google_drive_list_files_populates_source_file_path`; `247-VERIFICATION.md` SC#1 ✅ PASSED, `verification_mode: peer-reviewed`, 5/5 |
| `BUG-260828-11` | `open` / `null` | **`closed`**, `verified_closed_by: 248` | `GRANTS_COPY.OVERRIDDEN_LABEL` = `""` (`e615c0dad`) closes the headline; the affordance now reads *"Follow the default instead"*, asserted on **rendered DOM text** (9/9) rather than block presence. `248-VERIFICATION.md`, peer-reviewed |
| `BUG-260907-02` | `open` / `null` | **`folded`**, `folded_into: 252` | ⛔ **NOT closed.** `CRED-01` is legitimately ticked — 248 shipped the smell rule on all three *declared* homes, 422 — but 252's B-3 measured a **writer that bypasses all three**: `connectors.py:1323-1352` takes `registered.client_id` from a remote DCR response and `store_oauth_client_credentials` persists it unvalidated. Plan `252-02` owns it; the phase's verification closes it |
| `BUG-260902-06` | `open` / `null` | **`folded`**, `folded_into: 249` + `re_open_trigger` | ⛔ **NOT closed, on its own verifier's words.** `249-VERIFICATION.md` SC#3: *"MET BY CONSTRUCTION AND BY FENCE. ⛔ NOT MET BY MULTI-WORKER OBSERVATION."* `WORKER_COUNT=2` does not exist in the verifying environment (two `uvicorn --reload` servers = one worker each). A fence proves the code broadcasts; only a second worker proves a second worker hears it |

```
$ (script) reports parsed: 186 · closed-without-verifier among the six: 0
```

⚠ **Eight OTHER reports in the register are `closed` with no verifier, and two duplicate-id clusters remain** — all pre-existing, none touched here, and named so they stay re-openable: `BUG-260815-09`, `BUG-260828-09`, `BUG-260516-01`, `BUG-260814-01`, `BUG-260516-02`, `BUG-260517-01`, `BUG-260516-03`, `BUG-260516-04`; `BUG-260528-01` (→ **three** files, not the two `248-CONTEXT.md` recorded) and `BUG-260906-01` (→ two).

## ⚠ D-37 WAS MEASURED FALSE — the ROADMAP row

D-37 says the Phase 248 checklist row was *"already corrected to `[x]` at the audit — verify, do not re-do"*. **It read `[ ]`.** It was the **only unticked row of the five** in the v4.2 Phase Checklist, while all four of its requirements (`CRED-01..04`) are ticked in `REQUIREMENTS.md` and `248-VERIFICATION.md` reads `status: complete` / `verification_mode: peer-reviewed` / 4/4 passed.

The cause is structural, not careless: the audit's correction lives in `.planning/v4.2-MILESTONE-AUDIT.md`, which is **untracked**. **A correction in a register nobody commits is the same as no correction** — which is this project's own recurring finding, one register over. Ticked here, with the verifier named and with two things the row explicitly does *not* claim (see below).

---

## Decisions Made

1. **The gate scans every migration, not just 181.** Scoping it to the migration that prompted it would have shipped a guard that passes over three live greenfield gaps. The rule it enforces — *"every function ACL in `supabase/migrations/` appears in the supplement"* — has **no exception list**, because an exception list is a thing that rots.
2. **`MIN_MIGRATION_FILES = 120`, measured against 148.** See Task 2.
3. **`query_user_documents`'s widening GRANT is mirrored anyway**, to keep the rule exception-free.
4. **Two reports are `folded`, not `closed`.** *A wrong `closed` is worse than a stale `open`, because it stops the next reader looking.*
5. **The 500 arm of `provider_key` is byte-unchanged and pinned by a control test.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — missing critical functionality] Three function ACLs outside migration 181 were mirrored by nothing**
- **Found during:** Task 2, by the new gate's **first real run**, before any planted defect
- **Issue:** `resize_embedding_column(integer)` (mig 177), `create_org_with_default_dept(text, text, text)` (mig 104) and `query_user_documents(text)` (mig 012) had no mirror in either bootstrap artifact. The first is the RPC `BUG-260911-01` found callable **unauthenticated in production**; it NULLs every vector in the corpus. A greenfield deploy re-opened what 177 closed.
- **Fix:** §6b, copied from those migrations. All three functions were first verified to **exist** in the dump (`full-schema.sql:210`, `:424`, `:453`) — a GRANT on a dropped function would abort the whole bootstrap paste.
- **Files modified:** `scripts/full-schema-supplement.sql`, `supabase/full-schema.sql`
- **Verification:** gate `exit=0`, `16 / 16`; tail-parity diff empty; ordering check 15/15
- **Committed in:** `588373b4c`

**2. [Rule 1 — bug] §6a alone is INERT for migration 181's Group B on a greenfield database**
- **Found during:** Task 2, reading 181's Group B comment against what greenfield actually looks like
- **Issue:** 181 omits `REVOKE … FROM PUBLIC` for the two autofill trigger functions because migration **106** had already done it on live DBs. `--no-privileges` loses 106's revoke too, so on greenfield the PUBLIC grant still stands and 181's two role revokes achieve **nothing** — migration 177's measured trap, reproduced.
- **Fix:** 106's two `FROM PUBLIC` revokes inserted into §6a's Group B, each immediately **before** its function's `anon` revoke, marked inline as coming from 106.
- **Verification:** the ordering check now reads `OK` for both (it previously read *"no PUBLIC revoke"*)
- **Committed in:** `588373b4c`

**3. [Rule 3 — blocking] `MIN_MIGRATION_FILES = 150` would have made the gate unrunnable** — shipped at 120 against a measured 148. Committed in `588373b4c`.

**4. [Rule 1 — bug] D-37's premise was false; the ROADMAP Phase 248 row read `[ ]`** — ticked with its verifier named. Committed in `c27cabeef`.

### Files edited outside the plan's `files_modified`

Four, all planning docs, all required by Task 4's own instructions (*"re-point every citation that means the grant-override bug"* and Step 3's ROADMAP check):
`.planning/ROADMAP.md`, `.planning/milestones/v3.9-ROADMAP.md`, `.planning/phases/248-the-credential-boundary/248-02-PLAN.md`, `.planning/phases/248-the-credential-boundary/248-CONTEXT.md`. ⛔ `scripts/vitest-count-gate.cjs` was **not** touched — Plan 05 is its sole writer.

---

**Total deviations:** 4 auto-fixed (2 × Rule 1, 1 × Rule 2, 1 × Rule 3). **Impact:** every one is a correctness or security requirement in the plan's own subject area. No scope creep — no new capability, no new surface.

## Where the code disagreed with the plan

| Plan says | Code says | Consequence |
|---|---|---|
| 181 has **31 REVOKEs / 17 GRANTs** | **30 / 20** (`grep -c "^REVOKE EXECUTE ON FUNCTION"`). The 31 counted a comment line; the 17 is arithmetically impossible against the three groups | Acceptance criteria 1–2 cannot be met as written. The machine-checked criterion (signature-set parity) **holds exactly**, which is the one that matters |
| `MIN_MIGRATION_FILES = 150` | **148** migration files exist | Shipped at **120** |
| gate prints `function ACLs found: 13 · mirrored: 13` | **16 / 16** | The gate found three functions the research never measured |
| supplement's distinct function names = 13 | **16** after §6b (13 after §6a) | — |
| D-37: the ROADMAP 248 row *"already reads `[x]`"* | It read **`[ ]`** | Ticked here |
| `grep -c "BEGIN;"` = 0 | My §6 header originally contained the literal in prose | Reworded to *"NO TRANSACTION WRAPPER HERE"*; now **0** |

## Issues Encountered

- **The worktree was created on `master` (`84e3b020f`), not the plan's base.** `git reset --hard 53e2435b7` as the setup instructions require. Every line number in this summary holds at `53e2435b7`.
- **MSYS `grep`/`sed` strip CR on CRLF files** while the files are genuinely CRLF on disk (`core.autocrlf=true`). Every byte-level edit was done in Python with explicit `b"\r\n"` handling, which is why the tail-parity diff can be empty rather than approximately empty.
- **Docker is denied**, so `regenerate-full-schema.sh` could not run. The mechanical substitute and its equivalence argument are in Task 1 above.
- `.planning/v4.2-MILESTONE-AUDIT.md` does not exist in this worktree — it is untracked in the main checkout. That is the direct cause of the D-37 miss.

## ⚠ Two claims elsewhere in the registers that this plan refutes

Recorded rather than fixed, because neither file is this plan's to edit and both belong to the phase's verification:

1. **`REQUIREMENTS.md` `CRED-03` reads *"`supabase/full-schema.sql` regenerated"*.** That is **false for the ACL half, and was false when written** — `pg_dump --no-privileges` cannot carry a function grant, so regenerating produced a file with zero function ACLs (`grep -c` → `0`, measured). The migration was correct and unreachable; **that is the whole of B-1**. Now true, by this plan.
2. **`REQUIREMENTS.md` `CRED-01` is ticked while `BUG-260907-02` is not closed** — legitimately, but the distinction needs saying: 248 validated three *declared* homes and 252's B-3 found a writer beside them.

## User Setup Required

None. ⚠ **But the ACL mirror is a DEPLOY-PARITY artifact:** it changes what a *greenfield* bootstrap ships and nothing about an existing database. Migrations 104/106/177/181 already ran where they ran; the supplement is idempotent (REVOKE and GRANT both are), so re-pasting it onto a provisioned DB is a no-op for all 16 functions.

## Next Phase Readiness

- `252-02` (B-2/B-3) owns `BUG-260907-02`'s close; its routing is now written into the report.
- `252-05` is still the sole writer of `scripts/vitest-count-gate.cjs`, untouched here.
- `node scripts/check-schema-acl-parity.cjs` is ready to join the deploy parity checklist beside `get_advisors(security)` (`CRED-04`) — it answers the question the advisor cannot: *"will the NEXT greenfield deploy carry this revoke?"*
- ⛔ **Owed and named:** migration 181 is **not yet applied to cloud**; `CRED-04`'s `get_advisors(security)` run at promotion is what will confirm it. And the eight verifier-less `closed` reports plus the two remaining duplicate-id clusters (`BUG-260528-01` ×3, `BUG-260906-01` ×2) are still open register debt — Phase 251's `REG-01` did not clear them.

## Self-Check: PASSED

**Files claimed created/modified — all present on disk:**

```
FOUND: scripts/check-schema-acl-parity.cjs
FOUND: backend/tests/unit/test_252_setup_refusal.py
FOUND: .planning/reported-bugs/BUG-260828-11-grant-override-marker-claims-a-person-changed-it.md
FOUND: scripts/full-schema-supplement.sql
FOUND: supabase/full-schema.sql
FOUND: backend/app/api/setup.py
FOUND: .planning/phases/252-close-the-v42-audit-gaps/252-01-SUMMARY.md
```

**Commits claimed — all resolve in `git log 53e2435b7..HEAD`:**

```
c27cabeef docs(252-01): one BUG-260828-02, six honest statuses, and a ROADMAP row D-37 got wrong
098503f64 test(252-01): W-4 — a refused provider-key write answers 400, not an uncaught 500
588373b4c feat(252-01): the schema ACL parity gate, and the three gaps it found on run one
a7efe17d1 feat(252-01): mirror migration 181's function ACLs into the bootstrap artifacts
```

No file deletions in any of the four commits (`git diff --diff-filter=D HEAD~1 HEAD` empty at each; the register change is a `rename`, shown as `R`, and the file count is 190 before and after).

---
*Phase: 252-close-the-v42-audit-gaps*
*Completed: 2026-09-16*
