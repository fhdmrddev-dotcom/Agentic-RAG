---
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
plan: 03
subsystem: schema-acl-parity-gates
status: partial — Task 3's `.claude/settings.json` half is AT A BLOCKING CHECKPOINT
gap_closure: true
gap_closure_round: 1
tags: [gap-closure, tdd, guards, ci, acl-parity, greenfield, hooks]
requirements: [CRED-03, CRED-04]
independent_review: owed
requires:
  - scripts/check-schema-acl-parity.cjs (253-02)
  - scripts/check-greenfield-privileges.py (253-01)
  - .claude/hooks/schema-acl-parity-guard.js (253-02)
provides:
  - "assertTailIdentity — the D-11 same-commit rule enforced with NO database, inside the gate the PostToolUse hook and the CI backstop both already run"
  - "_statements — a literal/dollar/nested-block-comment-aware SQL splitter in the greenfield harness"
  - "backend/tests/unit/test_253_greenfield_sql_lexer.py — 14 arms, no DB/driver/env"
  - "backend/tests/unit/test_253_ci_path_coverage.py — 5 arms, a DERIVED CI-path-coverage fence with a non-vacuity floor"
  - "backend-tests.yml path filters covering the two scripts/ files backend unit tests read"
affects:
  - supabase/full-schema.sql (READ ONLY — byte-unchanged, md5 proven)
tech-stack:
  added: []
  patterns:
    - "port a byte-level tail compare, never a string round-trip (core.autocrlf=true makes re-encoding lossy here)"
    - "a derived-set fence needs its own non-vacuity floor arm — the coverage arm passes vacuously over an empty set"
    - "plant the SHIPPED implementation under the NEW name so a RED fails for the DEFECT, not for a missing attribute"
key-files:
  created:
    - backend/tests/unit/test_253_greenfield_sql_lexer.py
    - backend/tests/unit/test_253_ci_path_coverage.py
  modified:
    - scripts/check-schema-acl-parity.cjs
    - scripts/check-greenfield-privileges.py
    - .claude/hooks/schema-acl-parity-guard.js
    - .github/workflows/backend-tests.yml
    - docs/HOT-FILE-LEDGER.md
  not_modified_by_decision:
    - .claude/settings.json   # BLOCKING CHECKPOINT — operator config
    - CLAUDE.md               # no touched file has an abridged row or newly fires at 3 phases
    - supabase/full-schema.sql
decisions:
  - "D-11's tail identity is now checked in `check-schema-acl-parity.cjs` as well as in the Python harness — two implementations, deliberately, because only one of them can run without a database"
  - "The tail verdict prints and returns BEFORE the tuple verdict: a mutilated artifact makes every tuple claim about it meaningless"
  - "`artifactPath` defaults to the real full-schema.sql rather than being opt-out, so a self-test call that forgets fails LOUDLY"
  - "CLAUDE.md left byte-unchanged — recorded as a decision, not silence"
  - "`.github/workflows/backend-tests.yml`'s push/pull_request asymmetry PINNED rather than repaired (outside the operator's lock)"
metrics:
  duration: ~2h
  completed: 2026-09-16
  tasks_complete: 4.5 of 5
  commits: 5
---

# Phase 253 Plan 03: Gap-closure round 1 — four guards that could not fail, now driven Summary

`assertTailIdentity` makes the ACL parity gate read `supabase/full-schema.sql` for the first time
in its life; `_statements` stops the greenfield harness losing an ACL behind a `--` inside a string
literal; the PostToolUse guard extracts a MultiEdit payload's paths; and both `scripts/` files that
backend unit tests read now sit in both of `backend-tests.yml`'s trigger arms, held by a derived
fence with its own non-vacuity floor. **Every one of the four was SEEN to fail before it was
fixed.**

⛔ **THIS PLAN IS NOT COMPLETE.** Task 3's second half — one matcher string in
`.claude/settings.json` — is at the plan's declared **blocking checkpoint** and was deliberately
not taken. See *"The checkpoint"* below. Tasks 1, 2, 4, 5 and the code half of Task 3 are done and
committed.

---

## Commits

| # | Hash | Task | What |
|---|---|---|---|
| 1 | `507b3210e` | 1 (CR-01) | the gate reads the artifact it exists to protect |
| 2 | `a3aa2e1df` | 2 (CR-02) | the harness stops losing an ACL behind a `--` inside a literal |
| 3 | `7025ef08b` | 4 (WR-08/06) | the `scripts/` fences run in CI for the change that breaks them |
| 4 | `b6dce5010` | 3 (WR-02, code half) | the guard extracts a MultiEdit payload's paths |
| 5 | `34011964d` | 5 | the ledger stops claiming D-11 has no gate behind it |

Base: `ec50add8f0eee4951a94d3a051f998a8e7681b1d` on `develop`. ⚠ The worktree started on `master`
and was reset to the declared base — the fifth-plus consecutive executor to have to do this.

---

## Task 1 — CR-01: the parity gate reads `supabase/full-schema.sql`

### The RED, observed twice

**(a) The reviewer's reproduction, re-driven with an IDENTICAL driver** (scratchpad copy of the
artifact with every `resize_embedding_column` line stripped, pointed at `analyse()`/`report()` via
`artifactPath`). Against the gate as it shipped the option is simply **ignored** — there was no
`FULL_SCHEMA` constant and the artifact was never opened, so the arm could not even be *expressed*:

```
grep -c resize_embedding_column <copy> = 0
schema ACL parity — migrations scanned: 148 · … · mirrored: 133/133
schema ACL parity OK — every function AND table/column ACL … is mirrored in the supplement.
NAMES full-schema.sql = false
GATE EXIT=0
```

**(b) The self-test arms, with `assertTailIdentity` STUBBED to a no-op** — i.e. the shipped gate:

```
  FAIL  NEW RED arm 5a (ARTIFACT TAIL): an artifact with the `resize_embedding_column` ACLs stripped exits 1  — exit=0, resize_embedding_column occurrences in the artifact=0
  FAIL  NEW RED arm 5a: the failure NAMES supabase/full-schema.sql, the line count and BOTH md5s  — 0 lines · artifact (not checked) · supplement (not checked)
  FAIL  NEW RED arm 5b (ARTIFACT TAIL): a SINGLE-BYTE tail divergence exits 1  — tail md5 (not checked) vs supplement (not checked)
  FAIL  NEW RED arm 5c (ARTIFACT TAIL): a MISSING artifact is a harness error (exit 2), never a pass  — nothing was thrown
  PASS  NEW RED arm 5d (COUNTERFACTUAL): head + the REAL supplement over the REAL migrations exits 0  — exit=0 · 0 lines · md5 (not checked)
  PASS  NEW RED arm 5e (COUNTERFACTUAL, CRLF): an identical \r\n pair is tail-OK and its line count matches the \n pair  — crlf 0 lines vs lf 0 lines
self-test FAILED — 4/35 assertion(s) did not hold.
```

⭐ **The two counterfactuals staying GREEN under the stub is the correct shape, not a weakness.**
They assert the ABSENCE of a problem, so removing the check cannot make them red. An arm set where
every arm flips is an arm set with no control in it.

### The GREEN

```
$ node scripts/check-schema-acl-parity.cjs --self-test
self-test OK — 35/35 assertions: the partial-revoke, comment-swallow, table/column and
ARTIFACT-TAIL arms all fired, the counterfactuals held (LF and CRLF, functions and tables), and
both the collapsed-scan-set and missing-artifact cases were refused as harness errors rather than
passed.
EXIT=0
```

**29 → 35 arms** (the plan required ≥ 34).

```
$ node scripts/check-schema-acl-parity.cjs
schema ACL parity — migrations scanned: 148 · FUNCTION: 61 statement(s) in 5 file(s) → 61 tuple(s) · TABLE/COLUMN: 32 statement(s) in 12 file(s) → 72 tuple(s) · mirrored: 133/133 · tail: 653 lines · md5 da9c561634d417ebd289bedf07b75f69
  table/column statements per migration: 118 (4) · 126 (1) · 127 (1) · 128 (1) · 129 (3) · 150 (1) · 151 (2) · 156 (6) · 168 (3) · 169 (3) · 172 (3) · 177 (4)
schema ACL parity OK — …
SCAN EXIT=0
```

The printed tail md5 equals the md5 computed independently in the shell:

```
$ md5sum scripts/full-schema-supplement.sql
da9c561634d417ebd289bedf07b75f69 *scripts/full-schema-supplement.sql
$ wc -l scripts/full-schema-supplement.sql
653
```

Same driver re-run after the fix: `GATE EXIT=1`, `NAMES full-schema.sql = true`, failure block
printing `last 653 lines → md5 11d04049739c768d655bb542b689a8bf` against the supplement's
`da9c5616…`. **Exit 0 before, exit 1 after, identical driver.**

### Why the review's proposed snippet was evaluated and NOT pasted

`253-REVIEW.md` §CR-01 proposed `Buffer.from(art.toString('utf8').split('\n').slice(-n).join('\n'))`.
Rejected, and the reason is written into the code:

- it **round-trips through a string**, so it loses the distinction between a file that ends with a
  newline and one that does not;
- on this box `core.autocrlf=true` leaves a `\r` inside every working-tree line, so a re-encode is
  a second place for bytes to move — **normalising away exactly the drift a same-commit rule
  exists to catch**.

What shipped instead is a port of `check-greenfield-privileges.py::_tail_lines` —
`splitlines(keepends=True)[-n:]` over **bytes**, compared with `Buffer.equals`. The two
implementations agree independently: the Python harness prints
`MC-1 / D-11 tail identity OK — scripts/full-schema-supplement.sql (653 lines) == the last 653
lines of supabase/full-schema.sql, md5 da9c561634d417ebd289bedf07b75f69`, and the `.cjs` prints
the same 653 and the same md5.

### The tracked artifact is byte-unchanged

```
$ md5sum supabase/full-schema.sql          # before the task AND after every drive
a4f570396a44035102567ec1e3b7ff62 *supabase/full-schema.sql
$ git status --short                       # supabase/full-schema.sql absent throughout
```

Every fixture artifact is built inside `fs.mkdtempSync(os.tmpdir())`, guarded by the existing
`assertOutsideWatchedTree`. ⛔ `supabase/full-schema.sql` is **not** in this plan's
`files_modified` and was never written.

### One design decision worth naming

`artifactPath` **defaults to the real `supabase/full-schema.sql`**. That means a `--self-test` call
that forgets to pass a fixture compares a fixture supplement against the repository's artifact and
fails **loudly**. That was chosen over an opt-out flag (`artifactPath: null` to skip) deliberately:
a flag is a hole a caller can silently take, and this whole round exists because of holes callers
took silently. All eight existing `analyse()` calls in the self-test were wired to fixture
artifacts built from the **real** supplement (never a typed copy) by an `artifactFor()` helper.

---

## Task 2 — CR-02: the greenfield harness stops losing an ACL behind a `--` inside a literal

### The RED, driven against the SHIPPED pipeline planted under the NEW name

⭐ **Method note, because it matters.** Writing the fence against a `_statements` that does not
exist yet would have produced a RED that fails for a *missing attribute*, which proves nothing
about behaviour. So the shipped pipeline — `_strip_sql_comments(sql).split(";")` — was planted
verbatim under the new name, the fence was run against it, and every arm therefore failed for the
**defect**.

```
$ cd backend && venv/Scripts/python -m pytest tests/unit/test_253_greenfield_sql_lexer.py -q
10 failed, 4 passed
FAILED ::test_a_revoke_after_a_dash_bearing_literal_is_parsed
FAILED ::test_the_literal_bearing_comment_statement_keeps_its_own_boundary
FAILED ::test_a_revoke_from_public_after_a_dash_bearing_literal_is_split_out
FAILED ::test_an_acl_shaped_line_inside_a_dollar_quoted_body_is_a_phantom
FAILED ::test_a_tagged_dollar_quote_is_recognised_too
FAILED ::test_a_doubled_single_quote_does_not_end_the_literal
FAILED ::test_a_double_quoted_identifier_containing_a_dash_pair_is_not_a_comment
FAILED ::test_a_block_comment_hides_its_contents_and_separates_its_neighbours
FAILED ::test_nested_block_comments_are_handled_like_postgres_does
FAILED ::test_crlf_input_yields_the_same_parsed_statements_as_lf
```

The review's own reproduction, verbatim from the failure:

```
E  AssertionError: ["COMMENT ON COLUMN public.t.c IS 'a value
E    REVOKE ALL ON public.secrets FROM anon"]
E  assert 1 == 2
```

⛔ **The failure direction is PERMISSIVE**, which is why this was a critical rather than a nit: the
REVOKE vanishes from the expectation model, `PrivilegeModel` leaves `anon` with the stock
`GRANT ALL`, and a greenfield database *missing that same mirrored REVOKE* then **matches** —
expected == measured, exit 0.

**The 4 that passed are exactly the PRESERVED set**: the non-vacuity control, the
entirely-commented VERIFY block contributing nothing, the real-corpus floor, and the §5 extraction.

### ⚠ A VACUOUS ARM WAS CAUGHT AND REPAIRED — the same shape 253-02 found, one file over

`test_a_tagged_dollar_quote_is_recognised_too` **PASSED against the shipped splitter on its first
version**, and it was not written off. The reason it passed had nothing to do with dollar quoting:
the naive `split(";")` produced a chunk beginning `CREATE FUNCTION …`, which `_ACL_RE`'s `^` anchor
rejects for an unrelated reason. Adding a `SELECT 1;` inside the body makes the naive splitter
yield a chunk that **starts with `REVOKE`** and count the phantom — and the arm went red. The
reason is written into the test's docstring rather than into this SUMMARY alone.

⭐ This is the second time in this phase that an arm of exactly this shape was found unable to
fail. **Driving an arm against its own planted defect is not optional ceremony.**

### The GREEN, and the real-corpus counterfactual with NO delta to name

```
$ cd backend && venv/Scripts/python -m pytest tests/unit/test_253_greenfield_sql_lexer.py tests/unit/test_253_supplement_column_parity.py -q
21 passed, 1 warning in 0.38s
```

(14 lexer arms + the sibling fence's 7, still passing.)

| | BEFORE | AFTER |
|---|---|---|
| `derive_expectations()` statements | **32** | **32** |
| files contributing | **12** | **12** |
| per-file map | `118(4) 126(1) 127(1) 128(1) 129(3) 150(1) 151(2) 156(6) 168(3) 169(3) 172(3) 177(4)` | **identical** |
| `supplement_section5_columns()` | 20 cols, `created_by` present, `secret_ciphertext` absent | **byte-identical tuple** (`==` asserted in the shell) |

The review's measured `32 / 12` reproduces exactly, before and after. **Nothing moved, so nothing
is absorbed and there is no delta to name.**

### The end-to-end harness run — exit 0 on a REAL scratch database

⛔ Not a SKIP. Local Postgres accepted on `127.0.0.1:54322`, the run completed, and the verdict is
quoted verbatim:

```
$ backend/venv/Scripts/python scripts/check-greenfield-privileges.py
HARNESS EXIT=0
…
teardown verified: pg_database has 0 rows for greenfield_acl_106408_1789596309

greenfield privileges OK -- 148 migrations scanned, 32 table/column ACL statements replayed,
every expectation measured as the granted role on a database bootstrapped from
supabase/full-schema.sql alone.
```

Teardown and operator-data checks, run afterwards against the live cluster:

```
leftover greenfield_acl_* databases: []  count= 0
total databases: 5
documents 169        document_chunks 7995
```

⚠ **Serialisation (CLAUDE.md worktree rule 4) was satisfied by construction** — this is the only
plan in wave 3. Stated rather than left implicit, because no `files_modified` check can see a
shared Postgres.

### What was deliberately NOT touched in that file

`_split_top_level` (privilege-list commas — unrelated), `_NOT_A_TABLE_ACL` (WR-09), `ROLES` (WR-05)
and `assert_derived_set` (WR-04) are byte-unchanged. `_strip_sql_comments` **survives**, rebuilt on
the lexer — its `line.find("--")` body is gone rather than left beside the fix, because a defect
that survives behind a second door is the same defect.

---

## Task 4 — WR-08 + WR-06: the fences run in CI for the change that breaks them

### The RED

```
$ cd backend && venv/Scripts/python -m pytest tests/unit/test_253_ci_path_coverage.py -q
E  AssertionError: these files are READ by a backend unit test and matched by NO path filter in
E  backend-tests.yml, so the one change that breaks the fence is the one change that does not run it:
E    scripts/check-greenfield-privileges.py (read by tests.unit.test_253_greenfield_sql_lexer) — push=False pull_request=False
E    scripts/full-schema-supplement.sql (read by tests.unit.test_253_supplement_column_parity) — push=False pull_request=False
E
E  push.paths=['backend/**', 'supabase/migrations/**', '.github/workflows/backend-tests.yml']
E  pull_request.paths=['backend/**', 'supabase/migrations/**']
1 failed, 4 passed
```

### The GREEN

```
$ cd backend && venv/Scripts/python -m pytest tests/unit/test_253_ci_path_coverage.py -q
5 passed, 1 warning in 0.19s
```

`git diff .github/workflows/backend-tests.yml` — exactly two added entries in each of the two
`paths:` lists (plus the comments naming their readers) and nothing else.

### ⭐ The non-vacuity floor was driven separately, and the drive found the thing it exists for

With `_MODULES_THAT_REACH_OUTSIDE_BACKEND` emptied:

```
E  AssertionError: {}
E  assert 0 >= 2
FAILED ::test_the_derived_subject_set_is_not_empty
1 failed, 4 passed
```

⚠ **`test_every_out_of_backend_path…` PASSED over the empty set.** A derived-set coverage
assertion is *structurally* vacuous over nothing — which is Phase 242's measured defect (two guards
exiting 0 over zero parsed files) in a third place, and exactly why the floor is its **own arm**
rather than a line inside the coverage arm. Restored and re-verified green.

### The PyYAML trap, measured rather than asserted

```
$ python -c "import yaml; d=yaml.safe_load(open('.github/workflows/backend-tests.yml')); print(list(d.keys()))"
keys: ['name', True, 'jobs']
doc.get('on') -> NoneType True
doc.get(True) -> dict
```

The bare key `on` really does parse as the **boolean `True`**. A fence using `doc.get("on", {})`
would have tested nothing and passed; the fence tries both and asserts it found something.

### The pre-existing asymmetry was PINNED, not repaired

`.github/workflows/backend-tests.yml` is in `push.paths` and **not** in `pull_request.paths`.
Out of the operator's five-finding lock, so it is left alone and held by
`test_the_workflows_own_file_is_in_the_push_arm_only`, whose own message says to delete the arm in
the same commit that fixes the asymmetry. A future reader meets a **fact**, not an accident.

### WR-06's residue, written down plainly

This round does **NOT** put the greenfield harness's **database** half into CI, and that is a
decision: it hardcodes `127.0.0.1:54322` (`ALLOWED_PORTS`), needs the `vector` extension, and
mutates a cluster. What the round DID wire:

1. the harness's **no-database** enforcement of D-11 now lives in `check-schema-acl-parity.cjs`,
   which the PostToolUse hook and the `schema-acl-parity` CI job both already run (Task 1);
2. the harness's **parsing** half is now executed by CI through `test_253_greenfield_sql_lexer.py`,
   and the path filter above is what makes a change to the harness trigger that run.

⛔ **The end-to-end DB run remains operator-invoked** via `docs/DEPLOYMENT-WORKFLOW.md`. **Re-open
trigger:** a CI runner that can host a pgvector-capable Postgres on 54322 (which would also require
`ALLOWED_PORTS` to become a small derived set rather than a constant), **or** the next promotion
where `get_advisors(security)` disagrees with a local run.

---

## Task 3 — WR-02: the code half is done; the config half is AT THE CHECKPOINT

### ⚠ THE PLAN'S OWN RED CLAIM WAS MEASURED FALSE, AND THAT IS THE MOST USEFUL FINDING HERE

`253-03-PLAN.md` states that **both** MultiEdit payload shapes "produce zero bytes of stdout
today". Driven, with the `resize_embedding_column` REVOKE deletion planted in the real supplement:

| | case | shipped hook | after the fix |
|---|---|---|---|
| A | `Write`, `file_path` = supplement | **2615 bytes**, `gate_exit=1` | 2615, `exit=1` |
| B | `MultiEdit`, `file_path` **+** `edits[]` | **2615 bytes**, `gate_exit=1` ⚠ | 2615, `exit=1` |
| C | `MultiEdit`, **ONLY** `edits[0].file_path` | **0 bytes** ⛔ **THE RED** | **2615 bytes**, `gate_exit=1` |
| D | `MultiEdit`, non-subject paths only | 0 bytes (NEGATIVE, defect planted) | 0 bytes |
| E | `Write`, non-subject path | 0 bytes (NEGATIVE, defect planted) | 0 bytes |

⭐ **Case B already fired**, because the shipped extraction reads `tool_input.file_path`, which that
payload carries. So **WR-02 has TWO INDEPENDENT CAUSES**:

1. the hook's path extraction — **closed** in `b6dce5010` (a candidate list: `file_path`,
   `filePath`, `notebook_path`, every `edits[].file_path` / `edits[].filePath`);
2. the `.claude/settings.json` matcher — `Write|Edit`, so **Claude Code never dispatches a
   `MultiEdit` to this hook at all**, whatever the hook can extract.

⛔ **Fixing either one alone changes nothing in a live session.** The finding is recorded in the
hook's docstring and in `docs/HOT-FILE-LEDGER.md`, not only here.

### The negative controls were driven WITH THE DEFECT STILL PLANTED

Cases D and E read `0 bytes` while the supplement was genuinely broken (md5
`1644f1c64244243cfb1600919eacd711`), so their silence proves the **path filter** and not a clean
tree — the rule `253-02-SUMMARY.md` §"The hook — the DRIVEN half" set, and the table format is
mirrored from it.

### The restore is md5-proven

```
supplement md5 BEFORE the drive: da9c561634d417ebd289bedf07b75f69
   supplement md5 while planted: 1644f1c64244243cfb1600919eacd711   (4 ACL lines deleted)
supplement md5 AFTER the restore: da9c561634d417ebd289bedf07b75f69
RESTORE PROVEN BY MD5: true
$ node scripts/check-schema-acl-parity.cjs   # on the restored tree
GATE EXIT=0
```

### ⛔ THE CHECKPOINT — `.claude/settings.json` is NOT edited

Current state, read out of the **parsed** JSON (not grepped):

```
 4  hot-file-ledger-guard       matcher="Write|Edit"
 5  schema-acl-parity-guard     matcher="Write|Edit"      ← the subject
 6  landing-drift-guard         matcher="Write|Edit"
 8  react-hooks-rules-guard     matcher="Write|Edit|MultiEdit"   ← the sibling that proves the string
top-level PostToolUse key present: true  []                       ← IN-02, deferred, NOT taken
```

**Proposed change: exactly one string, on entry 5 only** — `"Write|Edit"` → `"Write|Edit|MultiEdit"`.
Nothing else in the file moves: entries 4 and 6 keep `Write|Edit`, and the dead top-level
`"PostToolUse": []` (IN-02) is left alone, whose re-open trigger **technically fires here and is
deliberately not taken** under the operator's five-finding lock.

---

## Task 5 — the registers

### The `docs/HOT-FILE-LEDGER.md:14415` correction

The line read *"⚠ **There is no gate behind that rule**"* about D-11. Task 1 made that **false**,
and *"a row that is present and WRONG answers the auditor and stops the audit"* is this ledger's
own recurring finding — landing on this ledger. It is **struck through, not deleted**, and the
correction names `assertTailIdentity` plus both runners that now carry it
(`.claude/hooks/schema-acl-parity-guard.js` and `.github/workflows/schema-acl-parity.yml`).

### Triples RE-DERIVED with the CLAUDE.md recipe — none copied forward

```
$ git log --oneline -- <file> | wc -l
$ git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u
$ wc -l <file>
```

| File | row said | **measured 2026-09-17** | buckets | G-5 |
|---|---|---|---|---|
| `scripts/check-schema-acl-parity.cjs` | `3 / 2 / 883` | **`4 / 2 / 1156`** | 252, 253 | no (2) |
| `scripts/check-greenfield-privileges.py` | `1 / 1 / 1157` | **`2 / 1 / 1312`** | 253 | no (1) |
| `scripts/full-schema-supplement.sql` | `11 / 6 / 653` | **`11 / 6 / 653`** ✅ not stale | 162,165,190,211,252,253 | **FIRES** — but this plan does **not** modify it |
| `.claude/hooks/schema-acl-parity-guard.js` | *(absent)* | **`2 / 1 / 145`** | 253 | no (1) |
| `.github/workflows/backend-tests.yml` | *(absent for its ENTIRE LIFE)* | **`4 / 2 / 84`** | 061, 253 | no (2) |

⚠ **Both existing rows went stale the SAME DAY, one plan later**, and in both cases the **phase
count did not move** — only commits and lines. A reader auditing phases alone would see nothing.
That is a concrete data point for `252-REVIEW.md` CR-08 (make the ledger gate fail a row whose line
count disagrees with `wc -l`), which stays deferred.

Two rows and two matching detail sections were **ADDED** in the same commit (the same-commit sync
rule): the hook and the workflow. ⛔ **`.claude/` and `.github/` are BOTH exempt from
`check-hot-file-ledger.cjs` (`WATCHED` is `backend/app/` + `frontend/src/` only), so no gate could
ever have demanded either row** — the same structural blindness `scripts/` has.

### ⛔ `check-hot-file-ledger.cjs` was NOT run and is NOT cited

Per D-23 and the plan's execution rules: its `WATCHED` set cannot see a single file this plan
touched, so a green from it would be **meaningless** and quoting it would be the vacuous-guard
defect this whole round exists to close. The evidence above is carried by hand.

### CLAUDE.md — deliberately NOT touched, recorded as a decision

No file this plan modified has an abridged row in CLAUDE.md, and none newly fires at ≥ 3 phases.
`scripts/full-schema-supplement.sql` does have a row and does fire — but this plan **does not
modify it** (it was planted and restored inside the hook drive, md5-proven identical), and its row
`11 / 6 / 653` re-derives **exactly**. The gate was run anyway, per the plan's verification block:

```
$ node scripts/check-claude-md-size.cjs
  CLAUDE.md    104538 chars   69.7% of limit   headroom 45462  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
EXIT=0
```

---

## Verification — every line of the plan's `<verification>` block

| # | Check | Result |
|---|---|---|
| 1 | `--self-test` → exit 0, ≥ 34 arms | ✅ exit 0, **35/35** |
| 2 | scan → exit 0, `mirrored: 133/133`+, **plus the tail line** | ✅ `mirrored: 133/133 · tail: 653 lines · md5 da9c5616…`, matching the shell md5 |
| 3 | CR-01 repro: exit **1** after, **0** against the shipped gate; artifact md5 unchanged | ✅ 1 / 0; `a4f57039…` unchanged, `git status --short` clean for it |
| 4 | the three `test_253_*` pytest files all pass | ✅ 14 + 5 + 7 = **26 passed** |
| 5 | `check-greenfield-privileges.py` → exit 0 on a real scratch DB | ✅ **exit 0**, teardown verified, 0 leftovers. ⛔ not a SKIP |
| 6 | the hook drive table, negatives silent with the defect planted, md5 restore | ✅ table above; `RESTORE PROVEN BY MD5: true` |
| 7 | `pytest tests/unit` → ≤ 71 failed, 0 collection errors, SET diffed | ✅ **71 / 0**, SET identical — see below |
| 8 | `check-gap-closure-rounds.cjs 253` → exit 0, `rounds completed: 1` | ✅ verbatim below |
| 9 | `check-claude-md-size.cjs` → exit 0 | ✅ 104,538 chars |
| 10 | `check-seeds-register.cjs --phase 253` → exit 0, routing in writing | ✅ below |

### G-7, verbatim

```
G-7 gap-closure round cap — 253-the-bootstrap-artifact-tells-the-whole-truth
  plans: 3 total · 1 gap-closure
  rounds derived from:
    highest explicit gap_closure_round : 1
    distinct commits adding gap plans  : 1
      cc28c98f6 2026-09-17  253-03
    => rounds completed: 1 (cap is 2)
G-7 clear — 1 round(s) completed, no new capability built inside a closure round.
EXIT=0
```

⭐ **No `[new-capability-in-closure]`**, which is the arm that matters: the two files this round
created are **tests**, not user-facing surface.

### Backend baseline — ceiling INTACT, failing SET diffed (not counted)

```
$ cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors
71 failed, 4897 passed, 2 xfailed, 2 xpassed, 45 warnings in 236.86s (0:03:56)
$ grep -c '^FAILED' pytest.txt                                    71
$ grep -c 'errors during collection\|ERROR collecting' pytest.txt  0
```

**71 failed · 0 collection errors — the ceiling exactly, zero headroom, unchanged.**
`4878 → 4897 passed` = **+19**, accounted for with no residual: **14** lexer arms + **5** CI-path
arms. ⛔ **Sets, never counts** — the failing set is the same **24 files** with the same per-file
counts `253-02-SUMMARY.md` published:

```
15 test_retrieval_service.py · 12 test_sql_service.py · 6 test_explorer_agent.py
 5 test_multimodal_query.py  ·  4 test_111_1_reembed_kickoff.py
 3 test_sandbox_service.py / test_lifespan.py / test_db_runs.py
 2 test_module7_tools.py / test_extraction_service.py / test_cross_worker_cancellation.py / test_071_1_threadpool_sweep.py
 1 × 12 (streaming_reliability, published_workflow_ownership, phase56_iteration_start, per_format_ingestion,
        get_model_capability_inference, forced_emit, chat_tool_approval, 200_1_phase_output_shape,
        190_review_fix_data_layer, 182_validate, 075_4_unknown_provider_error, 061_consumer)
```

⚠ CLAUDE.md's quoted `3497 passed` remains rotted (now `4897`); the gate binds the **failed**
ceiling of 71, and that is what held.

### The frontend count gate was NOT run — a decision, not an omission

This plan's frontend diff is **empty**: zero files under `frontend/src`, no vitest suite added.
`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` was therefore not invoked, exactly as
the plan's execution rules require. ⚠ Stated rather than assumed safe: *"frontend untouched ⇒ gate
unaffected"* is **unsound in this repo in general** (frontend suites `?raw`-import backend
sources), but the seven files touched here contain no `backend/app` or `frontend/src` source at
all.

### REG-02 seeds sweep — run, routed in writing

```
seeds register — .planning/seeds
  register: 296 files · parsed: 296 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger
trigger sweep — phase 253 (3 plan file(s), 15 path(s) in files_modified)
  ⚠ the phase declares NO surfaces, so `trigger_surfaces` matched nothing here.
  3 seed(s) matched
seeds register gate OK — 296/296 parsed, 0 duplicate ids, 296/296 carry all 5 required keys.
EXIT=0
```

⚠ **Read the two unswept figures and do not sum them** — `134` and `114` are different facts.

| Seed | Routing for THIS round |
|---|---|
| `SEED-188` (open) | **NOT folded — false positive.** The match is the `backend/tests/**` glob, not the subject. This round adds no untrusted-content channel and no injection surface. Status byte-unchanged. |
| `SEED-266` (partially-answered) | **NOT folded.** Arm (a) was answered by `253-02`; arms (b)/(c) are outside the operator's lock. ⚠ Task 1 makes the gate READ `full-schema.sql` for the first time — **if a later round widens that read beyond the TAIL, arm (b) is its natural home.** Status byte-unchanged. |
| `SEED-284` (planted) | **NOT folded — false positive.** Task 5 edits ledger ROWS; it touches no elapsed formatter. Status byte-unchanged. |

---

## Deviations from Plan

### 1. [Rule 1 — measured refutation] The plan's WR-02 RED claim was wrong about one of its two payloads

- **Found during:** Task 3, the hook drive.
- **Issue:** the plan asserts both MultiEdit shapes yield 0 bytes today. The shape carrying a
  top-level `file_path` alongside `edits[]` **already fired** (2615 bytes, `gate_exit=1`).
- **Consequence:** WR-02 has two independent causes, not one; the hook fix alone would have
  changed nothing in a live session, because the matcher never dispatches `MultiEdit` here.
- **Action:** recorded in the hook's docstring, in `docs/HOT-FILE-LEDGER.md`, in the commit message
  and above. Nothing was quietly "satisfied by a neighbouring property".
- **Commit:** `b6dce5010`

### 2. [Rule 1 — vacuous arm caught] `test_a_tagged_dollar_quote_is_recognised_too` passed against its own planted defect

- **Found during:** Task 2, the RED drive.
- **Issue:** it passed for a reason unrelated to dollar quoting (`_ACL_RE`'s `^` anchor rejecting a
  chunk that begins `CREATE FUNCTION`).
- **Fix:** a `SELECT 1;` added inside the body so the naive splitter yields a chunk starting with
  `REVOKE`; the arm then went red. Reason written into the test docstring.
- **Commit:** `a3aa2e1df`

### 3. [Rule 3 — a scripted edit silently wrote LF] one line in `check-schema-acl-parity.cjs`

- **Found during:** Task 1, by an explicit CR/LF byte count after a Python rewrite (`CR 1061 / LF
  1062`). `git diff` could not have shown it.
- **Fix:** the one line rewritten with `\r\n`; `CR 1062 / LF 1062`. Every file this plan wrote was
  checked the same way; the two new pytest files were normalised to CRLF to match their siblings.
- **Why it matters:** this is CLAUDE.md's measured CRLF trap, and it fired on the first scripted
  edit of the plan.

### 4. [decision] Task 3 split; `.claude/settings.json` deliberately not edited

The plan declares Task 3 a blocking checkpoint. The **code** half (the hook) was completed and
driven, because it is source and fully testable; the **config** half is held for explicit operator
approval. If the operator declines, the hook change remains correct and inert.

### 5. [decision] `CLAUDE.md` not modified despite being in `files_modified`

See Task 5. Recorded as a decision rather than left as silence, per the plan's own instruction.

---

## Known Stubs

None. Two temporary stubs were planted for the RED drives — `assertTailIdentity` as a no-op, and
the shipped pipeline under the name `_statements` — and both were restored from a scratchpad
backup, with the restored trees re-run green. No stub ships.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no schema change and no new file-access
pattern. The one file-read it adds (`supabase/full-schema.sql`, read-only, inside the repo) is the
mitigation for `T-253-03-01`. ⛔ **No package was installed** — the Package Legitimacy Gate has no
subject here.

---

## Independent review — OWED

⛔ `independent_review: owed`. **DEBT-06 / BUS-257 stands for this round too.** This would be the
**sixth consecutive self-verified close**: the plan was written by one agent and executed by
another instance of the same one, and CLAUDE.md's rule is that *whoever REVIEWS a phase must not
have shaped the build*. Said in writing rather than left to pass unremarked.

⛔ **Not driveable from here:** the `schema-acl-parity` and `backend-tests` GitHub jobs. The local
hook is the driven half; the CI half is confirmed on the next push touching a matching path. This
is the same residue `253-02-SUMMARY.md` recorded and it is **not silently inherited** — it is
re-stated because it is still true.

## Self-Check: PASSED

All 8 claimed files resolve on disk (`ls -1`, every path printed). All 5 claimed commits resolve in
`git log --oneline --all`. ⛔ `supabase/full-schema.sql` is **absent** from `git status --short` and
its md5 is `a4f570396a44035102567ec1e3b7ff62` — the value measured before Task 1 began.

⚠ **One claim is deliberately NOT satisfied and is not counted as a pass:**
`.claude/settings.json` is unmodified, by the plan's own blocking checkpoint. The plan is therefore
**4.5 of 5 tasks complete**, and `--self-test`'s config arm
(`matcher !== 'Write|Edit|MultiEdit'` → exit 1) will fail until the operator approves that one
string.
