---
phase: 253-the-bootstrap-artifact-tells-the-whole-truth
reviewed: 2026-09-17T01:20:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - scripts/check-schema-acl-parity.cjs
  - scripts/check-greenfield-privileges.py
  - scripts/full-schema-supplement.sql
  - .claude/hooks/schema-acl-parity-guard.js
  - .github/workflows/schema-acl-parity.yml
  - backend/tests/unit/test_253_supplement_column_parity.py
  - .claude/settings.json
  - supabase/full-schema.sql
  - docs/DEPLOYMENT-WORKFLOW.md
  - docs/HOT-FILE-LEDGER.md
findings:
  critical: 2
  warning: 11
  info: 5
  total: 18
status: issues_found
---

# Phase 253: Code Review Report

**Reviewed:** 2026-09-17T01:20:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The phase's *substance* holds up under measurement. I drove everything rather than read it:

| What I drove | Result |
|---|---|
| `node scripts/check-schema-acl-parity.cjs` | exit 0 · 148 migrations · 61 function + 32 table/column statements → **133/133 mirrored** |
| `node scripts/check-schema-acl-parity.cjs --self-test` | exit 0 · **29/29** arms, every RED arm and both counterfactuals fire |
| `backend/venv/Scripts/python scripts/check-greenfield-privileges.py` | exit **0** on a real scratch DB; `SELECT access_token_ciphertext … as authenticated` → `InsufficientPrivilegeError`; `has_table_privilege('anon','public.app_settings','SELECT')` = **False**; teardown verified |
| `--self-test-skip` | exit **2**, SKIP is not a pass ✅ |
| `pytest tests/unit/test_253_supplement_column_parity.py` | 7 passed |
| tail byte-identity | `tail -n 653 supabase/full-schema.sql` == supplement, md5 `da9c561634d417ebd289bedf07b75f69` ✅ |
| head-region ACL count | `0` GRANT/REVOKE above the supplement banner; `0` `TO anon` / `TO PUBLIC` anywhere in the artifact ✅ |
| hook, driven RED | fires, names the tuple, exit 0 (non-blocking) ✅ |
| ledger triples | all three re-derived exactly (`11/6/653`, `3/2/883`, `1/1/1157`) ✅ |

**The two blockers are both about what the gate CANNOT see, and both are the phase's own named failure class recurring one file over.**

1. **The gate never reads `supabase/full-schema.sql`** — the deploy artifact the phase exists to make honest. I proved this: I stripped every `resize_embedding_column` ACL line out of `supabase/full-schema.sql`, left the supplement untouched, and the gate printed `schema ACL parity OK` and exited 0. The PostToolUse hook even *fires* on writes to that exact path — so it runs a check that is structurally blind to the file that was just edited. (Artifact restored; `git status` clean, tail md5 re-verified.)
2. **`check-greenfield-privileges.py` still carries the CR-03 defect that the sibling gate fixed in this same phase.** Its `_strip_sql_comments` truncates at `line.find("--")`, including inside a string literal. I reproduced it on a two-statement fixture: the following `REVOKE ALL ON public.secrets FROM anon;` became invisible. Migration 180 already contains the triggering shape (`COMMENT ON COLUMN … IS '… -- stored and used verbatim …';`). A dropped REVOKE makes the expectation model believe the permissive state, and a greenfield database that is *also* missing that REVOKE then **matches** — exit 0, in the permissive direction. That is the harness that measures SC#1.

The remaining eleven warnings cluster on four themes: both gates can still pass vacuously on a parser regression (the floor is on file *count*, not on parsed *statements*); two independent SQL-ACL parsers of one truth that already disagree in three measured ways; CI/hook path filters that miss the change that would break the fence; and an irreversible-`DROP DATABASE` guard shipped with no regression fence while its own docstring cites the fenced analog as precedent.

---

## Critical Issues

### CR-01: The ACL parity gate cannot see `supabase/full-schema.sql` — the artifact it exists to protect

**File:** `scripts/check-schema-acl-parity.cjs:89-91,463-484` · `.claude/hooks/schema-acl-parity-guard.js:48-52`

**Issue:**
`analyse()` reads exactly two things: `supabase/migrations/` and `scripts/full-schema-supplement.sql`. `supabase/full-schema.sql` — the single-file artifact an operator actually pastes into a greenfield Supabase project — is never opened. The property that makes the supplement matter at all ("the supplement IS the artifact's byte-identical tail", D-11) is enforced by **nothing the hook or CI runs**.

Driven, not argued:

```
$ grep -v "resize_embedding_column" supabase/full-schema.sql > mutated && cp mutated supabase/full-schema.sql
$ grep -c "resize_embedding_column" supabase/full-schema.sql
0
$ node scripts/check-schema-acl-parity.cjs
schema ACL parity — migrations scanned: 148 · … · mirrored: 133/133
schema ACL parity OK — every function AND table/column ACL … is mirrored in the supplement.
GATE EXIT=0
```

`resize_embedding_column` is the RPC `BUG-260911-01` found callable unauthenticated in production; it NULLs every vector in `document_chunks` and `skill_embeddings`. Its four ACL statements were gone from the deploy artifact and both the gate and the hook reported clear. (Artifact restored byte-identical; `git status --short` empty, tail md5 `da9c5616…` re-verified.)

Worse, `SUBJECTS[2]` in the hook is `/supabase\/full-schema\.sql$/` — so editing that file *triggers* a gate that structurally cannot read it, and the author gets silence, which reads as a pass. This is the gate's own docstring warning ("a guard whose prose claims more than its code is precisely the defect CR-01 is") landing on the gate itself, and `docs/HOT-FILE-LEDGER.md` already admits it in prose (*"⚠ There is no gate behind that rule"*) — prose is what did not work three times.

The only thing that would catch the divergence is `check-greenfield-privileges.py::assert_supplement_is_the_artifact_tail`, which requires a live Postgres and is invoked by no hook, no CI job and no npm script (see WR-06).

**Fix:** the check needs no database and is ~15 lines. Add it to the gate so the primary hook and the CI backstop both carry it:

```js
const FULL_SCHEMA = path.join(root, 'supabase', 'full-schema.sql');

/** D-11 — the supplement IS the artifact's tail, byte for byte. No database needed. */
function assertTailIdentity(supplementPath, artifactPath) {
  const sup = fs.readFileSync(supplementPath);
  const art = fs.readFileSync(artifactPath);
  const n = sup.toString('utf8').split('\n').length - (sup.toString('utf8').endsWith('\n') ? 1 : 0);
  const tail = Buffer.from(art.toString('utf8').split('\n').slice(-n).join('\n'), 'utf8');
  if (!tail.equals(sup)) {
    return {
      ok: false,
      detail: `the last ${n} lines of supabase/full-schema.sql do not match `
        + 'scripts/full-schema-supplement.sql. regenerate-full-schema.sh appends the supplement '
        + 'verbatim, so these two MUST be identical — apply the SAME text to both, in the SAME commit.',
    };
  }
  return { ok: true, lines: n };
}
```

Call it from `analyse()` (or from `report()` before the tuple verdict) and return exit 1 on mismatch. Then add `--self-test` arms: mutate a fixture artifact tail and assert exit 1, and assert an identical pair stays green (the counterfactual). Also drop `supabase/full-schema.sql` from the hook's `SUBJECTS` *or* make the gate honour it — today it is in one and not the other, which is the drift itself.

---

### CR-02: The greenfield harness's comment stripper reproduces CR-03 — a false GREEN in the permissive direction

**File:** `scripts/check-greenfield-privileges.py:564-575` (`_strip_sql_comments`), `733-742` (`sql.split(";")`)

**Issue:**
`scripts/check-schema-acl-parity.cjs` replaced `line.indexOf('--')` with a real lexer this phase, and its own docstring (lines 157-164) records *why*: a `--` inside a string literal eats the literal's closing quote **and its semicolon**, so every statement boundary after it is wrong. The Python harness — shipped in the same phase, measuring the same property against a real database — still does exactly the rejected thing:

```python
i = line.find("--")
out.append(line if i == -1 else line[:i])
```

Reproduced on this tree:

```
input:  COMMENT ON COLUMN public.t.c IS 'a value -- with a dash';
        REVOKE ALL ON public.secrets FROM anon;

after _strip_sql_comments:
        "COMMENT ON COLUMN public.t.c IS 'a value \nREVOKE ALL ON public.secrets FROM anon;\n"

chunks: ["COMMENT ON COLUMN … 'a value \nREVOKE ALL ON public.secrets FROM anon"]  -> _parse_statement = None
        ["\n"]                                                                     -> None
```

The REVOKE is **gone from the expectation model**. `PrivilegeModel` then leaves `anon` seeded with the stock `GRANT ALL` — which is precisely what a greenfield database missing that mirrored REVOKE actually has — so expected == measured and the harness exits **0**. A false green, in the permissive direction, on the exact defect class this phase exists to close.

This is not hypothetical shape: `supabase/migrations/180_app_settings_self_hosted_endpoints.sql:29-30` already writes

```sql
COMMENT ON COLUMN app_settings.lmstudio_base_url IS
  'LM Studio OpenAI-compatible endpoint. INCLUDES /v1 -- stored and used verbatim (…).';
```

180 happens to carry no ACL after it, so the harness is correct *today* (I verified: both parsers agree at 32 statements / 12 files). The next migration that puts a GRANT or REVOKE after such a COMMENT silently loses it.

The same function has a second hole: `sql.split(";")` splits inside dollar-quoted bodies and inside string literals, so an ACL-shaped line in a `DO $$ … $$` body would be counted as a real statement (a phantom expectation → false RED) and a `;` inside a literal mis-chunks everything after it. I checked: no migration currently puts GRANT/REVOKE text inside `$$…$$`, so this arm is latent too.

**Fix:** stop maintaining two parsers (see WR-11). The cheap, immediate fix is to make the Python side use the same lexer semantics:

```python
def _statements(sql: str) -> list[str]:
    """Split on top-level `;`, stripping comments — quote-, dollar- and block-comment aware.
    ⛔ A `--` inside a literal is NOT a comment (CR-03): truncating at line.find('--') eats the
       closing quote AND the semicolon, and every later boundary is wrong."""
    out, buf, i, n = [], [], 0, len(sql)
    while i < n:
        c, c2 = sql[i], sql[i + 1 : i + 2]
        if c == "-" and c2 == "-":
            i += 2
            while i < n and sql[i] != "\n":
                i += 1
            continue
        if c == "/" and c2 == "*":
            depth, i = 1, i + 2
            while i < n and depth:
                if sql[i : i + 2] == "/*": depth, i = depth + 1, i + 2; continue
                if sql[i : i + 2] == "*/": depth, i = depth - 1, i + 2; continue
                i += 1
            buf.append(" ")
            continue
        if c in ("'", '"'):
            buf.append(c); i += 1
            while i < n:
                if sql[i] == c and sql[i + 1 : i + 2] == c: buf.append(c * 2); i += 2; continue
                if sql[i] == c: buf.append(c); i += 1; break
                buf.append(sql[i]); i += 1
            continue
        if c == "$":
            m = re.match(r"^\$([A-Za-z_][A-Za-z0-9_]*)?\$", sql[i:])
            if m:
                tag = m.group(0)
                end = sql.find(tag, i + len(tag))
                if end == -1: buf.append(sql[i:]); i = n; continue
                buf.append(sql[i : end + len(tag)]); i = end + len(tag); continue
        if c == ";":
            out.append("".join(buf)); buf = []; i += 1; continue
        buf.append(c); i += 1
    out.append("".join(buf))
    return out
```

…and drive it RED: a fixture with `COMMENT … IS '… -- …';` followed by a `REVOKE`, asserting the REVOKE **is** parsed, plus a `DO $$ … GRANT … $$` phantom control asserting it is **not**. Both arms exist verbatim in `check-schema-acl-parity.cjs --self-test` and can be ported.

---

## Warnings

### WR-01: Both gates can still pass vacuously — the non-vacuity floor guards file COUNT, not parsed statements

**File:** `scripts/check-schema-acl-parity.cjs:414-435,463-484` · `scripts/check-greenfield-privileges.py:704-743`

**Issue:** `MIN_MIGRATION_FILES = 120` protects against a collapsed *directory*. It does not protect against a collapsed *parse*. If `FUNC_ACL_RE` / `TABLE_ACL_RE` (or `_ACL_RE`) ever stops matching — a regex edit, a SQL dialect change, a CRLF surprise — `aclsIn` returns `[]`, `expected` is empty, `missing` is empty, and `report()` prints the green verdict:

```
… FUNCTION: 0 statement(s) in 0 file(s) → 0 tuple(s) · … · mirrored: 0/0
schema ACL parity OK — every function AND table/column ACL … is mirrored in the supplement.
```

Exit 0. Identically in Python: `statement_count == 0` and `model.tables == set()` yields zero derived checks, zero violations, `greenfield privileges OK`. This is the same shape as the two guards Phase 242 caught exiting 0 over zero parsed files. Compounding it, **the local hook — the primary guard by CLAUDE.md's own two-guards rule — does not run `--self-test`**; only CI does, and `develop` has run 634 commits over 8 days without a push.

**Fix:** floor the *derived* set too, and falsify locally:

```js
const MIN_ACL_TUPLES = 100;           // measured 133 at 2026-09-17; a FLOOR, never an exact figure
if (expected.size < MIN_ACL_TUPLES) {
  throw new VacuousScanError(
    `only ${expected.size} ACL tuple(s) parsed from ${migrationCount} migration file(s), below the `
    + `floor of ${MIN_ACL_TUPLES} — the directory is intact, so this is a PARSER regression, not a `
    + 'collapsed scan. Refusing to report a verdict.');
}
```

Mirror it in Python (`statement_count < 25`, `len(model.tables) < 5`), and have the hook run `--self-test` first (it is <1 s; the hook budget is 20 s) so the primary half is falsified in the turn it fires.

---

### WR-02: The hook is registered for `Write|Edit` only — a `MultiEdit` to a migration or the supplement fires nothing

**File:** `.claude/settings.json:114-122`

**Issue:** The new entry uses `"matcher": "Write|Edit"`. `MultiEdit` is a live tool in this configuration — `react-hooks-rules-guard.js` at line 144 matches `Write|Edit|MultiEdit`. Editing `scripts/full-schema-supplement.sql` or a migration with MultiEdit therefore runs no ACL check at all, and the hook is documented as the *primary* half. The hook body is also unprepared for MultiEdit's payload shape: it reads only `tool_input.file_path` / `filePath`.

**Fix:**
```json
{ "matcher": "Write|Edit|MultiEdit", "hooks": [ { "type": "command",
  "command": "\"C:/Program Files/nodejs/node.exe\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/schema-acl-parity-guard.js",
  "timeout": 20 } ] }
```
and in `schema-acl-parity-guard.js`, widen the path extraction so a MultiEdit payload is not silently empty:
```js
const ti = input.tool_input || {};
const candidates = [ti.file_path, ti.filePath, ti.notebook_path,
  ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e.file_path) : [])].filter(Boolean);
if (!candidates.some((p) => SUBJECTS.some((re) => re.test(String(p).split(path.sep).join('/'))))) process.exit(0);
```

---

### WR-03: Reverse drift — a supplement MORE permissive than the migrations — is caught by nothing automated

**File:** `scripts/check-schema-acl-parity.cjs:63-66,463-484` · `scripts/full-schema-supplement.sql:504-506`

**Issue:** `analyse()` computes `missing = expected \ mirrored`. A tuple present in the supplement but in no migration is never examined. So hand-adding `GRANT SELECT ON public.connector_tokens TO anon;` to the supplement passes the hook and CI green, and ships it to every greenfield bootstrap. This is D-13, an explicit decision — but its own recorded re-open trigger is *"any phase that edits the supplement's grants by hand"*, and hand-editing is the supplement's entire premise (its header says so). The only thing that would detect it is `check-greenfield-privileges.py`, which is invoked by nothing (WR-06). The permissive direction is the dangerous one and it is currently unguarded end to end.

**Fix:** the tuple space already exists on both sides — reporting the reverse set is ~8 lines and needs no new parsing:

```js
const extra = [...mirroredSet].filter((k) => !expected.has(k) && k.startsWith('tbl|GRANT'));
// GRANT-only, so a defensive extra REVOKE in the supplement is not reported as drift
if (extra.length) {
  log(`${RED}${extra.length} SUPPLEMENT-ONLY GRANT(S)${RST} — the bootstrap is MORE permissive than the migration history:`);
  for (const k of extra) log(`  [reverse-drift]  ${k}`);
  return 1;
}
```
If that is too strict to ship today, gate it behind `--strict` and run `--strict` in CI only, so at least the shared-branch path is covered.

---

### WR-04: `assert_derived_set` pairs measured rows to expectations by array position, relying on unspecified `unnest()` ordering

**File:** `scripts/check-greenfield-privileges.py:853-884`

**Issue:** The query is `SELECT x.r, x.t, x.p, has_table_privilege(…) FROM unnest($1,$2,$3) AS x(r,t,p)` with **no `ORDER BY`**, and the result is consumed as `zip(measured_table, expected_table)`. Postgres has no contract that an unordered scan returns rows in array order; parallelism or a plan change can reorder them. If it ever does, every expectation is silently compared against the wrong measurement **and the violation message names the wrong tuple** — the harness would be both wrong and misleading. The row already carries `r`, `t`, `p`; nothing forces the positional coupling. `measured_col` has the identical shape at lines 869-878.

**Fix:** key the lookup instead of zipping (and make it robust to a short result set, which the `zip` silently truncates):

```python
exp = {(r, t, p): e for r, t, p, e in zip(t_roles, t_tables, t_privs, expected_table)}
assert len(exp) == len(expected_table), "duplicate (role, table, privilege) probe — the set is not a key"
seen = 0
for row in measured_table:
    key = (row["r"], row["t"], row["p"])
    expected = exp[key]          # KeyError here is a harness error, never a silent pass
    seen += 1
    if bool(row["ok"]) != expected:
        violations.append(...)
if seen != len(exp):
    raise HarnessError(f"{seen} rows measured for {len(exp)} probes — the measurement set collapsed")
```
Apply the same to the column half.

---

### WR-05: The Python model drops the `PUBLIC` grantee entirely — the one grantee this project's own trap is about

**File:** `scripts/check-greenfield-privileges.py:146` (`ROLES`), `665-670` (`if role not in ROLES: continue`)

**Issue:** `_parse_statement` lowercases grantees, so `FROM PUBLIC` becomes `"public"`, which is not in `ROLES = ("anon","authenticated","service_role")` and is dropped. A table-level `REVOKE ALL ON public.x FROM PUBLIC` therefore contributes **nothing** to the expectation model, and if no other grantee is named for that table the harness asserts nothing about it at all. CLAUDE.md records the exact trap this hides: *"functions are granted EXECUTE to PUBLIC by default, so `REVOKE … FROM anon` changes nothing while the PUBLIC grant stands — measured, when 177's first version applied cleanly and verify still read FAIL."* The `.cjs` gate keys PUBLIC correctly; the harness that measures the real database does not. I verified no migration currently writes a table-level `… FROM PUBLIC`, so this is latent — but the supplement's own §6 header says PUBLIC-first is *"a convention kept by hand"*, which is exactly the condition under which the first instance arrives unannounced.

**Fix:** model it. `has_table_privilege('anon', …)` already reflects PUBLIC inheritance, so the model must too:

```python
ROLES = ("anon", "authenticated", "service_role")
_PUBLIC = "public"          # a grantee, not a role — it propagates to every role below

# in apply():
targets = ROLES if role == _PUBLIC else ((role,) if role in ROLES else ())
for effective in targets:
    ...
```
and add a fixture arm asserting that `REVOKE ALL ON t FROM PUBLIC` alone narrows all three roles' expectations.

---

### WR-06: `scripts/check-greenfield-privileges.py` is invoked by nothing executable — and it is the sole enforcer of the D-11 tail rule

**File:** `scripts/check-greenfield-privileges.py` (whole file) · `docs/DEPLOYMENT-WORKFLOW.md:116,136-140`

**Issue:** Measured:

```
$ grep -rln "check-greenfield-privileges" --include=*.json --include=*.yml --include=*.js \
    --include=*.cjs --include=*.sh --include=*.py --include=*.md . | grep -v '^./.planning'
./backend/tests/unit/test_253_supplement_column_parity.py   (docstring mention only)
./docs/DEPLOYMENT-WORKFLOW.md
./docs/HOT-FILE-LEDGER.md
./scripts/check-greenfield-privileges.py
```

No hook, no CI job, no npm script. This is *verbatim* what this phase's own hook and workflow headers say about the sibling gate — *"for its entire life before Phase 253 this gate was invoked by NOTHING… a gate nobody runs cannot fail either way"* — reproduced one script over, in the same commit. Its only invocation is a human checklist line in `DEPLOYMENT-WORKFLOW.md`, and the hand-mirror discipline it replaces has failed three times with the instruction in plain sight.

The consequence is not just coverage: `assert_supplement_is_the_artifact_tail()` (the *only* executable enforcement of D-11, see CR-01) and reverse-drift detection (WR-03) both live inside it.

**Fix:** Two things, cheap and independent:
1. Move the no-database half out of the harness and into `check-schema-acl-parity.cjs` (CR-01's fix) so the hook and CI carry it.
2. Give the harness a real trigger. It needs a live Postgres so it cannot go on `ubuntu-latest` as-is, but it CAN go on the local side:
```json
{ "matcher": "Write|Edit|MultiEdit", "hooks": [ { "type": "command",
  "command": "\"C:/Program Files/Git/bin/bash.exe\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/greenfield-privileges-guard.sh",
  "timeout": 120 } ] }
```
firing only on the same three `SUBJECTS`, reporting exit 1 loudly and treating exit 2/SKIP as an advisory line (never as a pass). Alternatively add a `services: postgres:` job to CI — the harness already refuses anything but `127.0.0.1:54322`, so that would need `ALLOWED_PORTS` to become a small derived set rather than a constant; say which you chose in the file.

---

### WR-07: `assert_greenfield_target` guards an irreversible `DROP DATABASE` against the operator's live cluster with no regression fence

**File:** `scripts/check-greenfield-privileges.py:195-281,1030-1049`

**Issue:** The function's own docstring cites `build-recall-bench.py`'s `assert_bench_target` as its source, and notes that analog *"is itself fenced RED by `backend/tests/unit/test_241_bench_safety.py`"*. Nothing fences this one — `grep -rln "assert_greenfield_target\|GREENFIELD_DB_PATTERN" backend/tests/` returns only a docstring mention in `test_253_supplement_column_parity.py`. Its five refusal arms (non-postgres scheme, comma-separated host list, query string, non-loopback host, unanchored db name) were driven at plan time and at plan time only. Meanwhile `create_scratch_database` / `teardown_scratch_database` interpolate the name straight into `DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)` against a cluster holding the operator's live development data (159 documents / 7,953 chunks, per this file's own header). The guard is correct **today** because it only ever receives `generate_db_name()` output — it is one refactor away from being the only thing between a parsed value and that statement, and it would break silently.

**Fix:** port `test_241_bench_safety.py` — it is a pure-function test, no database:

```python
@pytest.mark.parametrize("dsn", [
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",                   # the operator's DB
    "postgresql://postgres:postgres@127.0.0.1:54322/greenfield_acl_1_1_prod",    # the anchor arm
    "postgresql://postgres:postgres@prod.example.com:54322/greenfield_acl_1_1",  # non-loopback
    "postgresql://postgres:postgres@localhost:54322,prod.example.com:5432/greenfield_acl_1_1",
    "postgresql://postgres:postgres@127.0.0.1:5432/greenfield_acl_1_1",          # wrong port
    "postgresql://postgres:postgres@127.0.0.1:54322/greenfield_acl_1_1?host=prod.example.com",
])
def test_every_non_greenfield_target_is_refused(dsn):
    with pytest.raises(GreenfieldTargetRefused):
        assert_greenfield_target(dsn)

def test_the_generated_name_is_ACCEPTED():          # the counterfactual — the arms must fail for the
    assert_greenfield_target(scratch_dsn(generate_db_name()))   # defect, not for the fixture
```

---

### WR-08: The §5 column-parity fence does not run in CI for the change that breaks it

**File:** `backend/tests/unit/test_253_supplement_column_parity.py:57-58` · `.github/workflows/backend-tests.yml:9-17` · `.github/workflows/schema-acl-parity.yml:30-45`

**Issue:** The test reads `scripts/full-schema-supplement.sql` (via `parents[3]`). `backend-tests.yml` triggers only on `backend/**`, `supabase/migrations/**` and its own file. `schema-acl-parity.yml` triggers on the supplement but runs only the Node gate — and the Node gate explicitly cannot check this (D-08: `_TABLE_SELECTABLE_KEYS` is a Pydantic-derived value). So a PR that drops a column from §5 — the exact `42501-looks-like-an-outage` failure the test exists to prevent, which already shipped once at Phase 211 — trips **no** CI job. Locally there is no pytest hook either.

**Fix:** add the supplement to `backend-tests.yml`'s path filters (both `push` and `pull_request`):
```yaml
paths:
  - "backend/**"
  - "supabase/migrations/**"
  - "scripts/full-schema-supplement.sql"      # test_253_supplement_column_parity.py reads it
  - ".github/workflows/backend-tests.yml"
```
…or run that single file as a third step in `schema-acl-parity.yml` (it needs no Redis and no DB — 7 cases, 0.19 s).

---

### WR-09: The two SQL-ACL parsers disagree about `ON ALL TABLES IN SCHEMA` — one skips, the other invents a table

**File:** `scripts/check-greenfield-privileges.py:598-638` vs `scripts/check-schema-acl-parity.cjs:275-281`

**Issue:** The `.cjs` requires the privilege section to *start* with a table-privilege keyword and writes down the consequence: `GRANT ALL ON ALL TABLES IN SCHEMA public TO …` is silently skipped, *"that limitation is written down rather than assumed away"*. The Python `_ACL_RE` has no such constraint, and `_NOT_A_TABLE_ACL` only matches `ON SCHEMA`, not `IN SCHEMA`. Backtracking yields `privs = "ALL ON ALL TABLES IN SCHEMA"`, `table = "public"` → normalised to `public.public`, and `assert_derived_set` then emits a spurious `[missing-table] public.public …` violation. Exit 1 over a correct artifact — and a false red is how a guard gets switched off, which is this file's own stated reasoning at lines 566-570.

**Fix:** mirror the `.cjs` constraint so both parsers decline the same shapes, and make the decline visible rather than silent:

```python
_TABLE_PRIV_WORDS = r"ALL|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|MAINTAIN"
_ACL_RE = re.compile(
    rf"^\s*(?P<verb>GRANT|REVOKE)\s+(?P<privs>(?:{_TABLE_PRIV_WORDS})[\s\S]*?)\s+ON\s+(?:TABLE\s+)?"
    r"(?P<table>[A-Za-z0-9_.\"]+)\s+(?:TO|FROM)\s+(?P<roles>.+)$",
    re.IGNORECASE | re.DOTALL)
_NOT_A_TABLE_ACL = re.compile(
    r"\b(?:ON|IN)\s+(FUNCTION|SCHEMA|SEQUENCE|DATABASE|LANGUAGE|TYPE|ROUTINE|ALL\s+TABLES)\b",
    re.IGNORECASE)
```
and count the declines, printing `N statement(s) declined as not-a-table-ACL` in the scan line so a new shape is noticed instead of absorbed.

---

### WR-10: The default-privilege preamble is derived from the operator's live cluster, so the "greenfield" verdict is machine-dependent

**File:** `scripts/check-greenfield-privileges.py:518-558`

**Issue:** D-02/D-03 correctly refuse to *type* the stock default privileges, and refusing to run on zero rows is right. But the derived baseline is whatever `pg_default_acl` says on **this box** — a cluster on which every migration has been applied and which the operator can alter. On my run it rendered `GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO anon, authenticated, service_role`. If that row is ever narrowed locally, every expectation seeded by `PrivilegeModel._seed` (which hardcodes `set(TABLE_PRIVILEGES)`) exceeds the preamble and the harness false-REDs across the board; if widened, the model under-expects. The two halves — the *derived* preamble and the *hardcoded* `TABLE_PRIVILEGES` seed — are not reconciled anywhere, and the seed is a constant on the side of the code that claims to have no constants. It also means the result cannot be reproduced on any other machine or in CI, which is part of why WR-06 exists.

**Fix:** seed the model from the same rows the preamble was rendered from, and assert agreement rather than assuming it:

```python
def seed_privileges_from_preamble(rows) -> dict[str, set[str]]:
    """The per-role stock table privileges, read back from pg_default_acl — never typed."""
    ...

stock = seed_privileges_from_preamble(rows)
missing = set(TABLE_PRIVILEGES) - set().union(*stock.values())
if missing:
    raise HarnessError(
        f"this cluster's pg_default_acl does not grant {sorted(missing)} on TABLES, but the model "
        "seeds every named table with the full set — the baseline and the model disagree, so every "
        "verdict below would be about this machine rather than about the artifact.")
```
and print the stock set in the scan line so a reader can see what the verdict was relative to.

---

### WR-11: Two independent implementations of one truth, already measurably divergent

**File:** `scripts/check-schema-acl-parity.cjs:129-406` vs `scripts/check-greenfield-privileges.py:564-743` vs `backend/tests/unit/test_253_supplement_column_parity.py:72-98`

**Issue:** Three separate SQL-ACL extractors now ship in this repo — a JS lexer + two regex families in Python — over the same migration corpus and the same supplement. They already disagree in three measured ways (CR-02 comment handling, WR-05 PUBLIC, WR-09 `ALL TABLES IN SCHEMA`), and `docs/HOT-FILE-LEDGER.md` flags the risk in its own words (*"Two implementations of one truth in two [languages] … only one register ever gets updated"*). Every future SQL-shape fix must now be applied three times or the halves silently drift — and a drift between them is invisible, because nothing compares their outputs.

**Fix:** the cheapest durable move is to make the Node gate the authority for *extraction* and have Python consume it, which also kills CR-02, WR-05 and WR-09 at once:

```js
// check-schema-acl-parity.cjs
if (argv.includes('--emit-json')) {
  const { acls } = scanMigrations(MIGRATIONS_DIR, MIN_MIGRATION_FILES);
  process.stdout.write(JSON.stringify({ migrationCount, acls }, null, 0));
  return 0;
}
```
```python
# check-greenfield-privileges.py
raw = subprocess.run(["node", str(REPO_ROOT / "scripts" / "check-schema-acl-parity.cjs"),
                      "--emit-json"], capture_output=True, text=True, check=True).stdout
acls = json.loads(raw)["acls"]        # ONE extractor, two consumers
```
If that coupling is unwanted, the minimum is a cross-check arm: a test that runs both extractors over `supabase/migrations/` and asserts the `(verb, table, priv, column, grantee)` sets are **equal**, so a divergence reds the day it is introduced instead of the day it matters. (The `--emit-json` idea is already proposed in the ledger under §"a `--emit-missing` mode"; this is the same seam.)

---

## Info

### IN-01: The hook injects raw ANSI escape codes into `additionalContext`

**File:** `.claude/hooks/schema-acl-parity-guard.js:75-101`

**Issue:** `report()` colours its output with `\x1b[31m` / `\x1b[32m`, and the hook forwards `out.trim()` verbatim into a JSON string. The driven output contains `\u001b[31m1 ACL TUPLE(S) ARE NOT MIRRORED\u001b[0m`. Harmless, but it is noise in a context window, and it makes the payload awkward to grep in a transcript.

**Fix:** either strip on the way out — `out.replace(/\x1b\[[0-9;]*m/g, '')` — or have the gate honour `process.env.NO_COLOR` / `!process.stdout.isTTY` and set `NO_COLOR: '1'` in the `execFileSync` env.

### IN-02: `.claude/settings.json` carries a dead top-level `"PostToolUse": []`

**File:** `.claude/settings.json:201`

**Issue:** Pre-existing, not introduced by this phase, but it sits one line from the new registration and is a trap for the next editor: a top-level `PostToolUse` key outside `"hooks"` is read by nothing, and someone adding a hook there would get exactly the "keeps working and fires NEVER" outcome the guard's own header warns about (lines 31-36).

**Fix:** delete the key.

### IN-03: The new workflow declares no `permissions:` block

**File:** `.github/workflows/schema-acl-parity.yml:47-49`

**Issue:** The job needs only `contents: read` (checkout + node), but inherits the repository-default `GITHUB_TOKEN` scope. None of the five existing workflows declares one either, so this is a repo-wide convention rather than a regression — but a brand-new file is the cheapest place to start the better one.

**Fix:**
```yaml
permissions:
  contents: read
```

### IN-04: The Python docstring's md5 constant is already stale

**File:** `scripts/check-greenfield-privileges.py:16`

**Issue:** The MC-1 paragraph states the supplement and the artifact tail *"both hash to `6a58a47651156ef6dccdf75b93365e66`"*. Measured today: `da9c561634d417ebd289bedf07b75f69` — which is the value `docs/HOT-FILE-LEDGER.md` correctly carries. The runtime assertion is dynamic so nothing is broken, but by this project's own doctrine a measured figure written into prose and left to rot is a defect class, and it disagrees with a sibling register in the same commit.

**Fix:** delete the literal rather than refreshing it — the script prints the live value on every run (`_run` line 1057) and the ledger owns the current pair. Replace with *"…both hash to the same value, printed by this script on every run; the current pair is recorded in `docs/HOT-FILE-LEDGER.md`."*

### IN-05: Stale cross-file line reference

**File:** `scripts/check-greenfield-privileges.py:137`

**Issue:** *"Same value and same reasoning as `scripts/check-schema-acl-parity.cjs:63`"* — `MIN_MIGRATION_FILES` is at `check-schema-acl-parity.cjs:108`; line 63 is mid-docstring.

**Fix:** cite the symbol, not the line: *"same value and same reasoning as `check-schema-acl-parity.cjs`'s `MIN_MIGRATION_FILES`"*.

---

## Verified clean (recorded so a later reader does not re-derive it)

- **No `GRANT … TO anon` or `TO PUBLIC` anywhere in `supabase/full-schema.sql`** (86 ACL lines, all in the appended supplement tail; `0` in the generated head region — the supplement's own §5 claim reproduces exactly).
- **`ALTER TABLE … ENABLE ROW LEVEL SECURITY` present for all 59 tables**, including `public.app_settings:6332` and `public.user_settings:7019` — the two `BUG-260911-01` found with RLS disabled in production. §5d's decision not to repeat the `ENABLE` line is correct: `pg_dump` carries it.
- **Supplement ↔ artifact tail is byte-identical** (md5 `da9c561634d417ebd289bedf07b75f69`, 653 lines) — the D-11 rule *holds today*; CR-01 is about it being unenforced, not about it being broken.
- **All three `docs/HOT-FILE-LEDGER.md` triples re-derive exactly** (`11/6/653`, `3/2/883`, `1/1/1157`), and the ledger's admission *"There is no gate behind that rule"* is accurate — the documentation is honest about the CR-01 gap, which is why CR-01 is a code finding and not a doc one.
- **`SET row_security = off` is deliberately untouched** — `SEED-266` arm (b), an explicit out-of-scope decision with its trigger unchanged. Noting only that this phase's own harness is now literally an instance of the seed's trigger arm (2) ("any program … applies full-schema.sql and then issues further statements on the SAME connection"), which the seed already records; the harness handles it locally with `SET row_security = on` at `apply_artifact:774`.
- **`scripts/full-schema-supplement.sql` §0 `SET search_path = public`** — the reasoning (qualifying `vector` would change the signature text the parity gate keys on) checks out against `normaliseSignature`; the alternative really would turn a green gate red over a correct artifact.
- **Shell/path injection:** none. The hook uses `execFileSync(process.execPath, [gate])` — no shell, no interpolation. The CI workflow runs two fixed `node` commands with no expression interpolation. The Python harness reads no environment variable and accepts no DSN (S-5), and every interpolated database name is `generate_db_name()` output matched by an anchored `fullmatch`.
- **Platform:** the `.cjs` lexer treats `\r` as ordinary whitespace and never rewrites input; the CRLF parity arm in `--self-test` pins it and passes. The hook normalises `path.sep` → `/` before matching. No `wc -c`-style char/byte confusion in any of the new code.

---

_Reviewed: 2026-09-17T01:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
