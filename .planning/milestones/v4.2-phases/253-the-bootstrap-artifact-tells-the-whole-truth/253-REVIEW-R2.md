---
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
round: gap-closure round 1 (R2 review)
reviewed: 2026-09-17T00:00:00Z
depth: standard
diff_base: ec50add8f0eee4951a94d3a051f998a8e7681b1d
files_reviewed: 7
files_reviewed_list:
  - scripts/check-schema-acl-parity.cjs
  - scripts/check-greenfield-privileges.py
  - .claude/hooks/schema-acl-parity-guard.js
  - .github/workflows/backend-tests.yml
  - backend/tests/unit/test_253_greenfield_sql_lexer.py
  - backend/tests/unit/test_253_ci_path_coverage.py
  - .claude/settings.json
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 253 gap-closure round 1: Code Review Report (R2)

**Reviewed:** 2026-09-17
**Depth:** standard (with driven reproductions)
**Diff base:** `ec50add8f0eee4951a94d3a051f998a8e7681b1d..HEAD`
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Round 1 closed five findings. Three of them are genuinely and verifiably closed, and I drove each
one rather than reading it:

- **CR-01 (the gate never opened the artifact)** — closed. `assertTailIdentity` is a byte-level
  tail comparison with no encoding hole: it reads Buffers, slices with a keep-ends line splitter
  that agrees with Python's `bytes.splitlines`, and compares with `Buffer.equals`. `--self-test`
  arms 5a/5b/5c all fire. The reviewer's original `split('\n').join('\n')` hazard is genuinely
  avoided.
- **CR-02 (the Python comment stripper)** — closed, and the port is faithful. I differential-tested
  `check-greenfield-privileges.py::_statements` against `check-schema-acl-parity.cjs::statements`
  over ten adversarial inputs (backslash escapes, `$$` inside a literal, `;` inside a dollar body,
  tag-mismatched dollar quotes, unterminated block comments, nested block comments, doubled-quote
  identifiers, `--` at EOF, `$`-bearing identifiers): **zero divergences**. Both also derive the
  same real-corpus figures (148 files, 32 table/column statements, 12 files, 7 tables).
- **WR-02 (the hook never received MultiEdit)** — closed on both halves. I drove eight payload
  shapes through `.claude/hooks/schema-acl-parity-guard.js` against a stub gate that exits 1:
  an `edits[]`-only MultiEdit with a real Windows backslash path **does** now dispatch and emit
  the payload; empty `edits[]`, missing `edits`, `edits` as a string, `null`/string/number entries,
  `tool_input: null` and malformed JSON all exit 0 without throwing. `.claude/settings.json` is
  valid JSON, the diff is exactly the one matcher string, and no `settings.local.json` override
  shadows it.

What is **not** closed is the round's own subject. Two findings are blockers, and both are the
vacuity shape the round was convened to eliminate:

1. The parity gate's non-vacuity floor guards **file count**, not **tuples parsed**. I planted a
   parser regression and the gate printed `mirrored: 0/0` and `schema ACL parity OK`, **exit 0**.
   The only runner that catches that is `--self-test`, which lives exclusively in a CI workflow
   that has **never executed once**.
2. `backend-tests.yml` — the job WR-08 widened — **aborts at collection and runs zero tests**, on
   every one of its last eight runs. So the two Python fences this round added are executed by
   nothing, and `scripts/check-greenfield-privileges.py` is still invoked by no hook, no CI job and
   no npm script. WR-06 and WR-08 are closed on paper.

Every finding below that says "DRIVEN" was reproduced by running the code. One tracked file
(`scripts/check-schema-acl-parity.cjs`) was mutated to plant CR-01's defect; it was restored and
the restore is proven by md5 `b72ffaad805ef3e3def7443b8663de0a` (identical before and after) with a
clean `git status` on that path.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: the parity gate's floor guards file COUNT, not tuples parsed — a parser regression exits 0 GREEN

**Severity:** BLOCKER
**File:** `scripts/check-schema-acl-parity.cjs:128` (`MIN_MIGRATION_FILES`), `:562-594` (`analyse`), `:597-644` (`report`)

**Issue — DRIVEN, not reasoned.** `scanMigrations` refuses a collapsed *directory* (`< 120` files)
and `assertTailIdentity` refuses a missing *artifact*. Nothing refuses an empty *tuple set*. I
planted a parser regression — replaced both occurrences of `(REVOKE|GRANT)` with
`(ZZNEVERA|ZZNEVERB)` in `FUNC_ACL_RE` and `TABLE_ACL_RE` — and ran the gate exactly as the hook
runs it:

```
schema ACL parity — migrations scanned: 148 · FUNCTION: 0 statement(s) in 0 file(s) → 0 tuple(s)
  · TABLE/COLUMN: 0 statement(s) in 0 file(s) → 0 tuple(s) · mirrored: 0/0
  · tail: 653 lines · md5 da9c561634d417ebd289bedf07b75f69
schema ACL parity OK — every function AND table/column ACL in supabase/migrations/ is mirrored…
EXIT=0
```

`148 ≥ 120` satisfies the floor; `missing.length === 0` because `expected` is empty; the verdict
reads **green**. This is exactly the shape the phase docstring cites four prior instances of
(`check-hot-file-ledger.cjs` exit 0 over 0 files, etc.), in the gate written to end it. The same
arithmetic makes the gate *greener* when a REVOKE is **deleted from a migration** — `expected`
shrinks and `missing` can only shrink with it.

**The mitigation is weaker than it looks, and I measured that too.**
- `--self-test` **does** catch it (16/35 assertions fail), but `--self-test` is invoked from exactly
  one place: `.github/workflows/schema-acl-parity.yml`.
- `gh run list --workflow=schema-acl-parity.yml` returns **`HTTP 404: workflow … not found on the
  default branch`** — that backstop has **never run**.
- The PostToolUse hook, which CLAUDE.md designates the **primary** half ("`develop` ran 634 commits
  over 8 days without a push"), runs scan mode only — and scan mode exits 0, so the hook stays
  **silent**, which reads as "the gate is clear".

**Fix:** give the gate a tuple floor and make the hook falsify before it trusts.

```js
// scripts/check-schema-acl-parity.cjs — in analyse(), after `expected` is built
const MIN_ACL_TUPLES = 100;                 // measured 133 at 2026-09-17; a FLOOR, never an exact figure
if (expected.size < MIN_ACL_TUPLES) {
  throw new VacuousScanError(
    `only ${expected.size} ACL tuple(s) parsed from ${migrationCount} migration file(s), below the `
    + `floor of ${MIN_ACL_TUPLES} — the file count says the directory is intact, so this is a PARSER `
    + 'regression, not a collapsed scan. Refusing to report a verdict: a gate that passes over '
    + 'nothing is worse than absent.');
}
```

and add a self-test arm that plants the regression (mutate a copy of the module, or inject the
regexes) plus, in `.claude/hooks/schema-acl-parity-guard.js`, run `--self-test` first:

```js
// run the falsification before the verdict, exactly as schema-acl-parity.yml does
try { execFileSync(process.execPath, [gate, '--self-test'], { cwd: root, encoding: 'utf8', timeout: 30000 }); }
catch (e) { /* report as a harness error — a gate that has stopped being able to fail is the finding */ }
```

---

### CR-02: WR-08 routes the new fences into a CI job that aborts at collection and runs ZERO tests

**Severity:** BLOCKER
**File:** `.github/workflows/backend-tests.yml:14-15, 30-31` (the added paths) and `:70-75` (`pytest tests -q`)

**Issue — DRIVEN from real CI history.** WR-08's stated defect is *"the one change that can break
the fence is the one change that does not run it."* Round 1 added `scripts/full-schema-supplement.sql`
and `scripts/check-greenfield-privileges.py` to both trigger arms of `backend-tests.yml`. That job
does not run the fence either — it does not run **anything**:

```
$ gh run list --workflow=backend-tests.yml --limit 8
completed  failure  …  2026-09-13T14:22:50Z
completed  failure  …  2026-09-13T14:17:24Z
…  (8 of 8 = failure, 2026-09-08 → 2026-09-13)

$ gh run view 34762227525 --log
ERROR collecting tests/integration/test_140_migration_091.py
E   ModuleNotFoundError: No module named 'psycopg2'
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
1 skipped, 4 warnings, 1 error in 17.41s
##[error]Process completed with exit code 2.
```

`1 skipped` is the whole test run. `pytest tests -q` has no `--continue-on-collection-errors`, so a
single un-importable integration module interrupts collection and **no unit test executes**.

**Consequences, all of them inside this round's scope:**
- `backend/tests/unit/test_253_greenfield_sql_lexer.py` — the fence that closes CR-02 — is executed
  by nothing automated.
- `backend/tests/unit/test_253_ci_path_coverage.py` — the fence that closes WR-08 — is executed by
  nothing automated, including on a change to the very paths it was added to guard.
- `scripts/check-greenfield-privileges.py` is still invoked by **no hook, no CI job and no npm
  script** (`grep -rn "check-greenfield-privileges" .claude/hooks .github package.json scripts/*.sh`
  returns only the two new `paths:` comment lines). WR-06 is closed only for the parsing half, and
  only by a test nothing runs.
- A job that is red on every run cannot signal that a *specific* change broke a fence, so widening
  its triggers buys no information.

**Fix:** make the job capable of a verdict, in the same commit as the path widening.

```yaml
      - name: Run pytest
        run: |
          cd backend
          source venv/bin/activate
          # the repo's canonical backend command (CLAUDE.md baseline gate); a single un-importable
          # integration module must not be able to interrupt collection and run zero unit tests
          pytest tests/unit -q --continue-on-collection-errors
```

plus either add `psycopg2-binary` to `backend/requirements.txt` or guard
`tests/integration/test_140_migration_091.py:28` with `pytest.importorskip("psycopg2")`. If the
71-failure baseline means the job cannot be green, run
`node scripts/check-backend-unit-baseline.cjs` as the CI step instead of raw `pytest`, so the job's
colour means something. Until then, no `paths:` entry in this file is a guard.

---

## Warnings

### WR-01: self-test arm 5e (the CRLF counterfactual) is vacuous — it converts nothing

**Severity:** WARNING
**File:** `scripts/check-schema-acl-parity.cjs:1078-1094`

**Issue — DRIVEN.** The arm's comment claims: *"On this box `core.autocrlf=true`, so the working-tree
files ARE CRLF; a tail check that normalised line endings would pass here for the wrong reason, and
one that mis-counted them would red on a correct pair. Both files are converted together."* The
conversion is a no-op on the half that matters:

```
real   md5 da9c561634d417ebd289bedf07b75f69  42050 bytes
toCrlf md5 da9c561634d417ebd289bedf07b75f69  42050 bytes
IDENTICAL (arm 5e converts nothing): true
```

Measured directly: `scripts/full-schema-supplement.sql` is **653 CRLF, 0 bare LF**;
`supabase/full-schema.sql` is **7907 CRLF, 0 bare LF**. `toCrlf = replace(/\r?\n/g,'\r\n')` therefore
returns `realSupplement` byte-for-byte. Only `FIXTURE_ARTIFACT_HEAD` (a JS literal) is converted, and
the head is not part of the compared tail. So the assertion
`crlfRes.tail.lines === identRes.tail.lines` compares the same bytes with themselves, and the
LF-vs-CRLF property the arm names is never exercised. This is the same "arm that cannot fail" the
round corrected one file over (the dollar-quote arm).

**Fix:** build the **LF** variant explicitly and assert both directions.

```js
const toLf  = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
const toCrlf = (buf) => Buffer.from(toLf(buf).toString('utf8').replace(/\n/g, '\r\n'), 'utf8');
const lfSup = toLf(realSupplement);
check('5e(i): an identical LF pair is tail-OK and has the SAME line count as the CRLF pair', …);
check('5e(ii): an LF supplement against a CRLF artifact tail is RED (no normalisation)',
  !mixedRes.tail.ok, 'a tail check that normalised line endings would pass this and must not');
```

The second arm is the one that actually falsifies a normalising implementation.

---

### WR-02: the CI-coverage fence derives its PATHS but hand-types its MODULES — it sees 2 of ~49

**Severity:** WARNING
**File:** `backend/tests/unit/test_253_ci_path_coverage.py:42-47`, `.github/workflows/backend-tests.yml:12-13`

**Issue — DRIVEN.** The module docstring's first line claims *"every non-`backend/` file a backend
unit test READS must sit inside `backend-tests.yml`'s path filters"*, and the workflow comment says
the fence *"DERIVES this set from the test modules rather than trusting this list."* The **paths**
are derived; the **module set** is a typed 2-tuple. `grep -rln "parents\[3\]\|parents\[2\]"
backend/tests/unit/*.py` returns **49** modules.

I added two of them — both using the same "house idiom" that
`test_253_greenfield_sql_lexer.py:60` explicitly cites (`test_241_bench_safety.py`) — and the fence
immediately found uncovered files:

```
  scripts/build-recall-bench.py         push=False pull=False  (tests.unit.test_241_bench_safety)
  scripts/check-security-advisors.sh    push=False pull=False  (tests.unit.test_check_security_advisors)
  scripts/check-greenfield-privileges.py push=True  pull=True
  scripts/full-schema-supplement.sql     push=True  pull=True
UNCOVERED: ['scripts/build-recall-bench.py', 'scripts/check-security-advisors.sh']
```

So WR-08's defect is still live for at least two other scripts, and the fence structurally cannot
report it. A second blind spot: only **module-level** `pathlib.Path` constants are collected, so a
path built inside a test body is invisible.

**Fix:** derive the module list rather than typing it, and keep the import side effects out by
static-parsing instead of importing.

```python
import ast
_UNIT_DIR = _REPO_ROOT / "backend" / "tests" / "unit"

def _modules_that_reach_outside_backend() -> list[pathlib.Path]:
    """Every unit-test module whose SOURCE mentions a repo-root escape. Derived by readdir+AST,
    never typed: a hand list is a thing that rots, and this fence exists because one did."""
    hits = [p for p in sorted(_UNIT_DIR.glob("test_*.py"))
            if "parents[3]" in p.read_text(encoding="utf-8")]
    assert len(hits) >= 40, hits          # non-vacuity floor on the SCAN SET, not just the result
    return hits
```

At minimum, correct the two claims so a reader meets the limitation instead of the overstatement.

---

### WR-03: the fence exempts itself — including it in its own scan set makes its own assertion fail

**Severity:** WARNING
**File:** `backend/tests/unit/test_253_ci_path_coverage.py:42-47, 118-137, 168-182`

**Issue — DRIVEN.** `_WORKFLOW = _REPO_ROOT/".github"/"workflows"/"backend-tests.yml"` is a
module-level `pathlib.Path` constant in the fence itself — precisely the shape `_derived_subject_set`
collects. The fence is not in its own `_MODULES_THAT_REACH_OUTSIDE_BACKEND`. Adding it:

```
  .github/workflows/backend-tests.yml   push=True pull=False  (tests.unit.test_253_ci_path_coverage)
```

`test_every_out_of_backend_path_a_unit_test_reads_is_in_both_trigger_arms` would **fail**. The gap is
instead pinned as deliberate by `test_the_workflows_own_file_is_in_the_push_arm_only`. Two separate
tests therefore encode opposite verdicts about the same file, and the coverage assertion is green
partly because of what the allowlist omits rather than because of what the workflow contains.

**Fix:** once WR-02's derivation lands, either add `.github/workflows/backend-tests.yml` to
`pull_request.paths` (deleting the pinning arm in the same commit, as its own docstring instructs),
or make the exemption explicit and auditable in one place:

```python
#: Paths knowingly covered in the push arm only. Every entry needs a reason and a re-open trigger.
_PUSH_ARM_ONLY = {".github/workflows/backend-tests.yml": "pre-existing; 253-03 locked scope"}
```

---

### WR-04: a docstring added by this round states a divergence that does not reproduce

**Severity:** WARNING
**File:** `scripts/check-greenfield-privileges.py:606-608`

**Issue — DRIVEN.** The new `_statements` docstring records, as the *remaining* divergence between
the two lexers: *"the `.cjs` skips `ON ALL TABLES IN SCHEMA` while `_parse_statement` invents
`public.public` for it (WR-09, deferred)."* Measured on this tree, both sides agree:

| input | `_parse_statement` (py) | `aclsIn` (cjs) |
|---|---|---|
| `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon` | `None` | `[]` |
| `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role` | `None` | `[]` |
| `GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon` | `None` | `[]` |
| `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon` | `None` | `[]` |
| `GRANT USAGE ON SCHEMA public TO anon` | `None` | `[]` |

`_ACL_RE`'s table group is `[A-Za-z0-9_."]+`, which cannot span `ALL TABLES IN SCHEMA`, so no
variant matches. A *different* real mis-parse does exist — `GRANT ALL ON TABLES TO anon` yields
table `public.tables` — but that is the `ALTER DEFAULT PRIVILEGES` tail form, and such a chunk
starts with `ALTER`, which `_ACL_RE`'s `^` anchor rejects, so it is unreachable from
`derive_expectations`.

This matters because the claim is cited as the *reason* WR-09 is deferred. This repo's own recurring
finding is that a fact in a register nobody re-reads is the same as no fact; a fact that is wrong is
worse, because it answers the next auditor and stops the audit.

**Fix:** replace the bullet with what is measured, and record the reachable-vs-unreachable shape:

```
· ⚠ NO DIVERGENCE FOUND on `ON ALL TABLES IN SCHEMA`: both return nothing (measured 2026-09-17,
  five variants). What `_parse_statement` DOES mis-model is the bare `GRANT ALL ON TABLES TO role`
  form (-> table `public.tables`), which is unreachable because such a statement begins with
  `ALTER DEFAULT PRIVILEGES` and `_ACL_RE` is `^`-anchored. WR-09's re-open trigger is a migration
  that writes a schema-wide grant as a standalone statement.
```

---

### WR-05: `E'…'` escape strings reproduce the exact CR-02/CR-03 defect, in BOTH lexers

**Severity:** WARNING
**File:** `scripts/check-schema-acl-parity.cjs:226-236`, `scripts/check-greenfield-privileges.py:649-664`

**Issue — DRIVEN.** Postgres `E'…'` strings treat `\` as an escape, so `E'a \' -- x'` is ONE literal.
Neither lexer models backslash escapes, so the literal terminates early and the `--` then eats the
closing quote and the semicolon — the identical mechanism CR-02/CR-03 closed, reached by a different
construct. Both implementations produce the same wrong answer, byte for byte:

```
input : SELECT E'a \' -- not a comment';
        REVOKE ALL ON public.after_e FROM anon;
py/cjs: ["SELECT E'a \\' \nREVOKE ALL ON public.after_e FROM anon"]      # ONE chunk
```

The REVOKE is swallowed into a chunk beginning `SELECT`, `_parse_statement`/`FUNC_ACL_RE` return
nothing, and the privilege drops out of the expected set — silently, **in the permissive direction**,
which is the direction that ships a readable ciphertext column.

Two related silent-erasure shapes, same drive, same agreement between both lexers:
- an **unterminated `/*`** consumes the rest of the file → `[]` (every ACL below it vanishes);
- an identifier containing `$` (`public.a$b$c`) opens a phantom dollar quote → the rest of the file
  becomes one unterminated chunk.

Measured mitigation: there is currently **no** genuine `E'` literal in `supabase/migrations/`,
`scripts/full-schema-supplement.sql` or `supabase/full-schema.sql` (`grep -rnE "(^|[^A-Za-z0-9_])E'"`
returns nothing), so this is latent rather than live. But it is unrecorded in both docstrings and
unfenced in both test suites — and combined with CR-01 (no tuple floor) a single stray `E'` or `/*`
would produce a silent green.

**Fix:** handle the escape form in both lexers and pin it in both suites.

```python
        # -- single-quoted literal; E'...' honours backslash escapes (standard_conforming_strings
        #    is ON, so a PLAIN '...' does NOT -- the two forms differ and the lexer must too)
        if c == "'":
            escaped = i > 0 and src[i - 1] in "eE" and (i < 2 or not src[i - 2].isalnum())
            ...
            if escaped and src[i] == "\\":
                buf.append(src[i : i + 2]); i += 2; continue
```

and add, to `test_253_greenfield_sql_lexer.py` and the `.cjs` `--self-test`, a RED arm over
`E'a \' -- x';\nREVOKE …;` asserting two chunks. If the decision is to defer, write the limitation
into both docstrings with a re-open trigger ("the first migration that writes an `E'` literal") —
this round's own standard.

---

### WR-06: the WR-02 fix is fenced by nothing, in a round that fenced everything else

**Severity:** WARNING
**File:** `.claude/hooks/schema-acl-parity-guard.js:54-75`, `.claude/settings.json:111-122`

**Issue.** `grep -rn "schema-acl-parity-guard"` over `.claude`, `.github`, `backend`, `frontend`,
`scripts` and `package.json` returns only the hook itself, its `settings.json` registration, and
three prose mentions. Nothing executes it; nothing asserts the registration exists or that the
matcher still contains `MultiEdit`. The hook's own docstring names the risk and then leaves it:
*"if a future `/gsd:update` or a settings rewrite drops the PostToolUse entry, this file keeps
working and fires NEVER, with nothing to say so."* Round 1's response was a hot-file ledger row
(`docs/HOT-FILE-LEDGER.md` + `CLAUDE.md`) — documentation, not a check — while the same round wrote
executable fences for the CI path filter and the Python lexer. `check-hot-file-ledger.cjs` cannot
cover it either: `.claude/` is exempt (confirmed: the ledger gate reports `subject: 15 files ·
watched: 0` for this phase).

**Fix:** a node fence in the same shape as the existing guards — cheap, and it makes a silent
de-registration loud.

```js
// .claude/hooks/schema-acl-parity-guard.js  --self-test   (or scripts/check-hook-registration.cjs)
const cfg = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'));
const entry = (cfg.hooks?.PostToolUse || []).find((e) =>
  JSON.stringify(e).includes('schema-acl-parity-guard.js'));
assert(entry, 'the parity guard is REGISTERED BY NOTHING — it fires never, in silence');
for (const tool of ['Write', 'Edit', 'MultiEdit'])
  assert(entry.matcher.split('|').includes(tool), `matcher lost ${tool}: ${entry.matcher}`);
```

Drive it RED by deleting `MultiEdit` from a copy before shipping it.

---

### WR-07: the tail self-test arms run against the REAL repo, so a genuine ACL gap reds the falsification suite for the wrong reason

**Severity:** WARNING
**File:** `scripts/check-schema-acl-parity.cjs:1008-1094` (arms 5a, 5b, 5d, 5e)

**Issue.** Arms 5a/5b/5d/5e pass `migrationsDir: MIGRATIONS_DIR` and a copy of the real supplement.
Arm 5d asserts `identCode === 0` — i.e. it asserts that the **repository's actual ACL mirror is
complete**. The moment a real unmirrored tuple exists (exactly the condition the gate exists to
report), `--self-test` goes red with *"NEW RED arm 5d (COUNTERFACTUAL): head + the REAL supplement
over the REAL migrations exits 0 — FAIL"*, which tells the reader the falsification harness is
broken rather than that the mirror is incomplete. In `schema-acl-parity.yml` the self-test step runs
**before** the scan step, so the informative verdict never prints. Arm 5a is also weaker than it
reads: `tailStripCode === 1` would hold even if the exit came from missing tuples rather than the
stripped tail (it is saved only by the `!tailStripRes.tail.ok` conjunct).

**Fix:** decouple the tail arms from repo state — assert the tail property, not the exit code:

```js
check('NEW RED arm 5d (COUNTERFACTUAL): head + the REAL supplement is TAIL-IDENTICAL',
  identRes.tail.ok && identRes.tail.artifactMd5 === identRes.tail.supplementMd5,
  `${identRes.tail.lines} lines · md5 ${identRes.tail.artifactMd5}`);
// the exit code belongs to the SCAN step, which runs second and prints the useful verdict
```

and give arms 5a/5b their own fixture migrations directory (`padToFloor` + one ACL-bearing fixture)
so a real gap in `supabase/migrations/` cannot colour them.

---

## Info

### IN-01: unused import

**File:** `backend/tests/unit/test_253_ci_path_coverage.py:33` — `import pytest` is never used
(`grep -n pytest` returns only the import). Delete it.

### IN-02: `sys.path` is mutated on every call and never restored

**File:** `backend/tests/unit/test_253_ci_path_coverage.py:81` — `_derived_subject_set()` runs
`sys.path.insert(0, str(_REPO_ROOT / "backend"))` and is called by three tests, so `backend/` is
prepended three times per session and never removed. Hoist it to module scope, or guard it:
`p = str(_REPO_ROOT / "backend"); if p not in sys.path: sys.path.insert(0, p)`.

### IN-03: the "no environment variable" claim is false for the coverage fence

**File:** `backend/tests/unit/test_253_ci_path_coverage.py:20-21` — *"This module needs no database,
no network and no environment variable."* Driven outside pytest's conftest, importing
`tests.unit.test_253_supplement_column_parity` transitively imports
`app.services.connector_service` → `app.dependencies` → `app.config`, which constructs `Settings()`
at import time and raises `ValidationError: supabase_url … supabase_service_role_key Field required`.
It works under pytest only because conftest seeds those. The same docstring argues against a
directory walk because *"a walk would import every test module in the suite as a side effect"* —
while the hand list already imports one module with exactly those side effects. Reword, or make the
scan static (see WR-02's fix, which removes the side effect entirely).

### IN-04: dead variable in the self-test

**File:** `scripts/check-schema-acl-parity.cjs:955-957` — `tGreenLines` is collected and never read
(only `tGreenCode`/`tGreenRes` are used). Pass `() => {}` as the logger, as arms 5b/5d already do.

### IN-05: `.claude/settings.json` carries a stray top-level `"PostToolUse": []`

**File:** `.claude/settings.json:202` — a sibling of `hooks` and `statusLine`, not a valid settings
key. **Pre-existing** (present verbatim at `ec50add8f`), and the round's one-line diff is correct and
verified: the file parses, top-level keys are `permissions, hooks, statusLine, PostToolUse`, the
parity entry's matcher is exactly `Write|Edit|MultiEdit`, and `.claude/settings.local.json` declares
no `hooks` block that could shadow it. Worth deleting in a future housekeeping pass so nobody adds a
hook to the dead key.

### IN-06: `statements()` re-slices the whole remainder at every `$`

**File:** `scripts/check-schema-acl-parity.cjs:253` — `/^\$…/.exec(src.slice(i))` allocates a copy of
the rest of the file for each `$` character. Out of v1 performance scope, noted only because the
Python port already avoids it correctly with `_DOLLAR_TAG_RE.match(src, i)`; use
`re.exec` with a sticky flag (`/\$([A-Za-z_][A-Za-z0-9_]*)?\$/y` + `re.lastIndex = i`) to match the
port and keep the two implementations shaped the same.

---

## Verification notes (what I ran)

| Check | Result |
|---|---|
| `node scripts/check-schema-acl-parity.cjs` | exit 0 · 148 migrations · 61 fn + 32 tbl statements · 133/133 mirrored · tail 653 lines md5 `da9c561634d417ebd289bedf07b75f69` |
| `node scripts/check-schema-acl-parity.cjs --self-test` | exit 0 · 35/35 |
| same, with a planted parser regression | **exit 0, `mirrored: 0/0`, "schema ACL parity OK"** (CR-01); `--self-test` 16/35 FAIL |
| `pytest tests/unit/test_253_greenfield_sql_lexer.py tests/unit/test_253_ci_path_coverage.py -q` | 19 passed |
| lexer differential (`.py` vs `.cjs`), 10 adversarial inputs | 0 divergences |
| `derive_expectations()` vs the `.cjs` table half | identical — 148 files, 32 statements, 12 files, 7 tables |
| hook driven with 8 payload shapes + stub gate exit 1 | MultiEdit `edits[]`-only **fires**; all degenerate shapes exit 0 without throwing |
| `gh run list --workflow=backend-tests.yml --limit 8` | 8/8 `failure`; run 34762227525 = collection abort, `1 skipped … 1 error`, exit 2 |
| `gh run list --workflow=schema-acl-parity.yml` | `HTTP 404: workflow not found on the default branch` — never executed |
| `node scripts/check-claude-md-size.cjs` | OK — 104,782 chars, 69.9% of limit |
| `node scripts/check-hot-file-ledger.cjs 253-…` | ledger gate OK (`subject: 15 · watched: 0` — all exempt) |
| ledger triple `.claude/settings.json` `9 / 4 / 202` | re-derived: commits 9 · phases 226/245/250/253 = 4 · lines 202 ✅ |
| tracked-file mutation restored | `scripts/check-schema-acl-parity.cjs` md5 `b72ffaad805ef3e3def7443b8663de0a` before and after; `git status --short` clean on that path |
| nothing in the diff writes `supabase/full-schema.sql` | confirmed — all self-test artifacts are built under `os.tmpdir()` behind `assertOutsideWatchedTree` |

---

_Reviewed: 2026-09-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (driven)_
