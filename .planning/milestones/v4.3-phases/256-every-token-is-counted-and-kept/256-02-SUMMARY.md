---
phase: 256-every-token-is-counted-and-kept
plan: 02
subsystem: metering / registers
tags: [fence, ast, hot-file-ledger, seeds-register, meter-04, meter-06]
requires: []
provides:
  - "Fence 1 — the parent_run_id IS NULL narrowing fence (D-256-02), RED-driven"
  - "hot-file ledger rows for circuit_breaker.py, task_service.py, run_reconciler.py"
  - "SEED-297..300; SEED-074 flipped to partially-answered"
affects:
  - "backend/tests/unit/test_256_token_sum_narrowing.py"
  - "CLAUDE.md"
  - "docs/HOT-FILE-LEDGER.md"
  - ".planning/seeds/"
tech-stack:
  added: []
  patterns:
    - "ast.parse CONJUNCTION fence over joined leaf statements (not a line grep)"
    - "one matcher function driven by BOTH the real walk and every in-test haystack control"
    - "md5-proved transient plant (digest #1 == #3, empty numstat)"
key-files:
  created:
    - "backend/tests/unit/test_256_token_sum_narrowing.py"
    - ".planning/seeds/SEED-297-boot-reconciler-nulls-cap-paused-token-totals.md"
    - ".planning/seeds/SEED-298-max-tokens-per-run-is-really-per-segment.md"
    - ".planning/seeds/SEED-299-stranded-deep-chat-run-token-count-unknowable.md"
    - ".planning/seeds/SEED-300-three-token-holes-surviving-phase-256.md"
  modified:
    - "CLAUDE.md"
    - "docs/HOT-FILE-LEDGER.md"
    - ".planning/seeds/SEED-074-workflow-harness-token-usage-rollup.md"
decisions:
  - "D-256-02 fenced BEFORE its first reader exists — Phase 257 is the first consumer"
  - "R-1 dispositioned REGISTER, not fix, with the reason recorded in SEED-297"
  - "forced_emit.py's ledger row deliberately WITHHELD for plan 256-04 (O-6)"
metrics:
  duration: "~75 min"
  completed: 2026-09-18
  tasks: 3
  commits: 3
---

# Phase 256 Plan 02: The Read Rule and the Register Debts — Summary

**Fence 1 established the `parent_run_id IS NULL` read rule before any reader exists, proved it
non-vacuous against a planted un-narrowed SUM, added ledger rows for three files G-5 could never
have fired on, and registered five holes this phase does not close — including one NEW measured
defect and one gate found to be structurally incapable of firing.**

Base: `902701e89` on `develop`. Worktree bootstrapped as the first action; HEAD asserted on
`worktree-agent-a171e2eb7e1fa7aba` and reset onto the required base (it had started on the stale
default branch, as the standing memory predicts).

---

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `c6d97895d` | `test(256-02)` — Fence 1, with its RED evidence |
| 2 | `e1e36b76f` | `docs(256-02)` — 3 ledger rows added, 3 stale triples corrected, both registers, ONE commit |
| 3 | `d61c946dd` | `docs(256-02)` — SEED-297..300 planted, SEED-074 flipped |

---

## Task 1 — Fence 1, and its RED drive

`backend/tests/unit/test_256_token_sum_narrowing.py`, **12 cases, all passing.**

### The three md5 digests — #1 == #3, as required

| # | When | Digest of `backend/app/db/runs.py` |
|---|---|---|
| **#1** | before the plant | `de39712121ef82ff7cf789301b0bd1c4` |
| **#2** | with the plant live | `e6f86eaa16d57f80b23f45b3b57f11dc` ⚠ **differs, as it must** |
| **#3** | after removal | `de39712121ef82ff7cf789301b0bd1c4` ⭐ **byte-identical to #1** |

`git diff --numstat -- backend/app/db/runs.py` → **no output**.
`git status --short backend/app/` → **no output**. The plant left nothing behind.

⛔ The proof is mechanical, never timing and never *"I reverted it"* — the Phase 255 `emitters.py`
incident (a planted `eval()` that sat live) is why.

### The RED output line, verbatim

```
E       AssertionError: D-256-02 violation — a runs-table token aggregation is missing the `parent_run_id IS NULL` narrowing, so a sub-agent's spend is counted TWICE (the parent row is already INCLUSIVE of its children via phase_types.py `_record_run_usage`):
E         backend/app/db/runs.py:235 -> aggregates a runs-table token column without `parent_run_id IS NULL` (D-256-02)
```

Exit **1**, and it names **the file and the line**. With the plant removed: **12 passed**.

⭐ **The RED drive was run twice, and the second run is the one that matters.** The first attempt
failed with **two** violations, and the second was not the plant — see Finding A below.

### The matcher, and why it is an AST conjunction

`_violations_in_source(source, label)` parses with `ast.parse`, walks to the **leaf statements**
only (a compound statement textually contains everything beneath it, so checking those too would let
an unrelated narrowing four statements away satisfy the conjunction), and tests `ast.unparse(stmt)`.

`ast.unparse` rather than hand-joining `ast.Constant` pieces, for a reason worth keeping: the parser
has **already** merged implicitly-concatenated literals into one constant, and unparse additionally
preserves the attribute chain (`.is_(...)`, `.select(...)`) that the supabase-py dialect is written
in. **One text, both dialects.**

⭐ **D-256-03 is enforced by one regex and it is load-bearing:** `(?<![\w.])runs\b`. In
`workflow_runs` the character before `runs` is `_`, a word character, so there is no word boundary
and **`workflow_runs` cannot match**. That is what keeps this fence green over plan 256-01's
`persist_run_usage` writer — pinned explicitly as a negative control, not left to hope.

### The controls, all live

| Control | Form | Why it exists |
|---|---|---|
| A1 | matcher fires on `SELECT SUM(input_tokens) … FROM runs WHERE org_id = $1` | ⛔ the subject set is measurably EMPTY (RESEARCH §Q3, seven strategies), so without this the fence passes over nothing forever |
| A2 | matcher fires across **concatenated literals** spread over 6 lines | the exact shape a line-grep cannot see |
| A3 | matcher fires on the **supabase-py builder** form | dialect 2, or half the codebase is unguarded |
| B | `>= 150` `.py` files parsed (**measured 239**) | written LIVE — `test_189_no_egress.py`'s file-count guard is dead code with zero callers |
| C | missing walk root ⇒ `pytest.fail`, never a bypass | a renamed subject tree must FAIL, not silently empty the set |
| N1 | `persist_run_usage` (`workflow_runs` + `COALESCE`) not flagged | ⭐ **this is what stops Fence 1 breaking plan 256-01's merge** |
| N2 | `finalize_run` writer not flagged | a writer is not a roll-up |
| N3 | the four shipped narrowed identity joins not flagged | RESEARCH C-3 — they select no token column |
| N4 | a correctly-narrowed SUM passes | the rule must be satisfiable, or it forbids what Phase 257 builds |
| N5 | a correctly-narrowed builder read passes | dialect 2, satisfied form |
| N6 | a per-row CHILD read passes | D-256-01 is a HIERARCHY — reading a child alone is legitimate |

Acceptance greps: `ast.parse` **4** · `D-256-02` **6** · `parent_run_id IS NULL` **7**.

### ⚠ FINDING A — a UTF-8 BOM makes one module unparseable by any hand-rolled `ast` walk

The fence's first RED run reported **two** violations. The second was not the plant:

```
backend/app/services/email_extraction_service.py:1 -> could not be parsed:
  invalid non-printable character U+FEFF (<unknown>, line 1)
```

That file carries a **UTF-8 BOM**. CPython's own importer strips it, so the module is perfectly
valid at runtime and **only a hand-rolled `ast.parse` ever sees the problem**. The reader now uses
`utf-8-sig`; ⛔ the parse-failure-is-a-violation arm stays live, so a genuinely unparseable module is
still reported rather than skipped.

⭐ **The transferable lesson:** every existing source-walk fence in this repo that reads with plain
`utf-8` is either skipping this file or would red on it. This one found it on its first execution.

### ⚠ FINDING B — the fence's own control falsified the fence, exactly as budgeted for

Control C asserted `"pytest.skip" not in own_source` — and **tripped on its own explanatory
comment**, which contained the literal. The token is now assembled (`"pytest." + "s" + "kip"`) so
the assertion cannot be tripped by its own source text. Budgeted for explicitly by the plan
(`test_189_no_egress.py:59-71`, where a matcher was falsified by its own control): **the control was
strengthened, never weakened.**

### TDD gate compliance

`tdd_mode: true`. **RED was observed before the fence was green**, against a planted defect, with
the plant md5-proved removed. ⛔ **There is no `feat(...)` GREEN commit, and that is correct rather
than a gap:** this task's deliverable is a fence over source that is **already compliant**, which is
the whole point of authoring the read rule before its first reader exists. The plan's declared
proof-of-work is the RED drive, and the subject tree is deliberately byte-unchanged
(`git diff --numstat backend/app` → empty).

---

## Task 2 — the hot-file ledger

### Every triple RE-DERIVED at `902701e89`, none copied

⛔ Re-derived with CLAUDE.md's own recipe, per file, not read from RESEARCH.md or CONTEXT.md. **No
six-digit dated quick-task buckets appeared in any of the seven** — checked, not assumed.

| File | RESEARCH.md said | **Measured `902701e89`** | Verdict |
|---|---|---|---|
| `backend/app/services/circuit_breaker.py` | 1 / 1 / 331 | **1 / 1 / 331** | ✅ CONFIRMED |
| `backend/app/services/task_service.py` | 19 / 10 / 958 | **19 / 10 / 958** | ✅ CONFIRMED |
| `backend/app/services/run_reconciler.py` | 3 / 2 / 325 | **3 / 2 / 325** | ✅ CONFIRMED |
| `backend/app/services/harness/publish_service.py` | 26 / 11 / 1810 | **26 / 11 / 1810** | ✅ CONFIRMED (⚠ **CORRECTED vs the ROW**, which read `25`) |
| `backend/app/services/run_producer.py` | 5 / 3 / 749 | **5 / 3 / 749** | ✅ CONFIRMED (⚠ **CORRECTED vs the ROW**, `3 / 2 / 693`) |
| `backend/app/services/run_lifecycle.py` | 8 / 4 / 748 | **8 / 4 / 748** | ✅ CONFIRMED (⚠ **CORRECTED vs the ROW**, `6 / 3 / 459`) |
| `backend/app/services/forced_emit.py` | 8 / 5 / 578 | **8 / 5 / 578** | ✅ CONFIRMED — ⛔ row deliberately withheld, see below |

⭐ **RESEARCH.md's arithmetic was accurate on all seven.** What was stale was the **ledger**, in
three rows. Bucket lists, for audit: `circuit_breaker` `204` · `task_service` `085 091 092 093 096
099 135 142 204 210` · `run_reconciler` `137.1 145` · `publish_service` `102 163 182 186 189 190
193.2 196 200.3 214 214.1` · `run_producer` `162.5 204 250` · `run_lifecycle` `145 147 194 204` ·
`forced_emit` `101.1 102 103 111.1 122`.

### Rows ADDED — row + own section, same commit

1. **`circuit_breaker.py`** `1 / 1 / 331` — below threshold; added at plan 256-01's touch by the
   `settingsSearchPayload.ts` precedent. Invariant recorded: ⛔ the `max(0, …)` clamp must stay on
   the **returned** delta, or a reset box hands the DB a negative and **subtracts real spend**.
2. **`task_service.py`** `19 / 10 / 958` — ⛔ **FIRES at 10 phases and was absent from BOTH registers
   for its ENTIRE LIFE.** ⭐ **It is named by no decision — not by D-256-13 either.** It was found by
   *running* the recipe over the phase's read set rather than by reading the scan list. ⚠ **No plan
   in Phase 256 modifies it**, so `check-hot-file-ledger.cjs` could never have demanded the row: the
   gate reads `files_modified`, and a file that is only READ is invisible to it. Added anyway.
3. **`run_reconciler.py`** `3 / 2 / 325` — below threshold; carries the full R-1 defect chain as a
   binding invariant, pointing at `SEED-297`.

### Rows CORRECTED — corrected triple recorded BESIDE the original (S-5), never overwriting

- **`publish_service.py`** `25 → 26` commits. ⭐ Recorded because a **one-commit** drift is the
  interesting case: small enough to look like noise, and exactly the size at which a cell stops being
  re-checked.
- **`run_lifecycle.py`** `6 / 3 / 459 → 8 / 4 / 748` — the line count had grown **63%** while the
  cell read `459`.
- **`run_producer.py`** `3 / 2 / 693 → 5 / 3 / 749`. ⛔ **Not only the number rotted — the VERDICT
  did.** The cell read `below`; the file measures 3 phases, so **G-5 FIRES**. ⭐ Its own section
  said *"this file will be touched again"* on 2026-09-15 — **that prediction came true in three
  days**, and the row did not move.

⚠ **All three corrections are on files this phase does not MODIFY** — they were re-derived because
they were READ. That is precisely the blind spot no gate covers.

### `forced_emit.py` — deliberately WITHHELD

⛔ Its row is owed **in the same commit as that file's first edit** (O-6), which is plan **256-04**.
Adding it here would satisfy the gate and break the rule. The omission is deliberate and is recorded
here so it reads as a decision, not a miss.

### Gate readings — the exit code alone would have been misleading

```
hot-file ledger — .planning/phases/256-every-token-is-counted-and-kept
  scan list: 290 rows · subject: 29 files · watched: 9

G-5 CANNOT FIRE ON 1 FILE(S) — they have no ledger row:
  [no-row] backend/app/services/forced_emit.py   (named by 256-04-PLAN.md)
```

**Exit `1`** — expected, with **exactly one** finding, the one O-6 assigns to 256-04. ⭐ **`watched:
9`, not 0** — the gate is non-vacuous here (255's vacuous pass was `watched: 0` with exit 0). The
plan's acceptance criterion asked for exit `0` *and* predicted this `[no-row]` reading in the same
breath; the two cannot both hold, and the honest reading is recorded rather than the expected one.
Before this commit the finding set was **two** (`circuit_breaker.py` + `forced_emit.py`); it is now
one.

### `node scripts/check-claude-md-size.cjs` — exit 0

```
CLAUDE.md   107212 chars   71.5% of limit   headroom 42788   [OK]
```

`106,060 → 107,212` chars (**+1,152**). Warn band 120,000, hard limit 150,000.

### ⛔ FINDING C — the 200-char disposition cap is VACUOUS, and it was driven RED to prove it

CLAUDE.md asserts the cap is *"enforced, not merely asked"*. **Measured: it is not enforced
anywhere.**

Driven RED rather than reasoned about: a **260-character** disposition cell was planted in
CLAUDE.md's shortlist table and `node scripts/check-claude-md-size.cjs` **passed, exit 0**. The
plant was then removed and CLAUDE.md verified **md5-identical** (`42610ec19d09f51af2d9785ff3364601`
before and after).

The mechanism, measured:

- `ledgerRows()` binds to the **exact** header `| File | commits / phases / lines | G-5 | Disposition |`.
- That header occurs **0 times in CLAUDE.md** and **1 time in `docs/HOT-FILE-LEDGER.md`**.
- `findClaudeMd()` walks for files **named `CLAUDE.md`** and never opens `docs/HOT-FILE-LEDGER.md`.
- `main()` does `if (f.rows === 0) continue;` — **a zero-row parse is a silent skip.**

⇒ **`[disposition-too-long]`, `[duplicate-row]` and `[malformed-row]` are all structurally
unreachable today.** They were written when the scan list lived in CLAUDE.md; the **2026-09-06 split
moved the table out and the guard stayed pointed at the old home.** This is the same class as
`test_189_no_egress.py`'s dead file-count guard, which this very plan was warned about — twice in one
plan, in two different files.

⚠ **Not fixed here — out of `files_modified`,** and a change to a guard script deserves its own
review. ⭐ **All six cells authored by this plan were measured by hand against the cap anyway**
(197 / 196 / 180 / 186 / 185 / 164 bytes, so ≤ 200 characters under either metric), because the gate
that was supposed to check them cannot.

---

## Task 3 — the register

### Ids allocated by `max(id)+1`, re-derived at execution time

Highest id in the register at execution: **SEED-296** → allocated **297, 298, 299, 300**, exactly as
the plan expected. No shift was needed.

| Seed | What it carries | Disposition |
|---|---|---|
| **SEED-297** | R-1, a NEW measured defect — the BOOT reconciler NULLs a `cap_paused` run's already-persisted totals | ⛔ **REGISTER, NOT FIX**, reason recorded |
| **SEED-298** | D-256-10 — `max_tokens_per_run` is per-SEGMENT, and exists ONLY on a schedule | ⛔ NAMED, NOT FIXED |
| **SEED-299** | D-256-08 site #7 — a stranded Deep chat run's count is genuinely unknowable | honest `NULL`, registered |
| **SEED-300** | three holes: failed-rung attribution, the eval WITHOUT arm, ⭐ the eval JUDGE shot covered by **no decision** | registered |
| **SEED-074** | flipped `planted` → `partially-answered` | `partial: true`, `folded_into: "256"` |

### R-1's disposition, stated out loud

**REGISTER, not fix.** The reason is in the seed body, not merely implied: the apparent two-line
repair (`input_tokens = COALESCE($6, input_tokens)`) changes a **shipped writer with multiple
callers** and would silently make a genuine `None`-after-a-value **un-writable** — a semantic change
to a shared writer, not a patch, and inconsistent with D-256-05's posture on `finish_run`.

The chain is recorded link by link in the seed and mirrored as a binding invariant in
`docs/HOT-FILE-LEDGER.md` → `run_reconciler.py`, so an editor of that file meets it without reading
the seed. ⭐ The bounding nuance is recorded too: `:217-247` touches **non-terminal rows only**, so a
COMPLETED run's real total can never be overwritten — and a future edit widening that set converts a
`cap_paused`-only defect into general data loss.

### ⛔ The U-3 sizing READ was ATTEMPTED and could not run — no figure was invented

`mcp__supabase__execute_sql` returns **`No such tool available`** inside a GSD worktree-executor
agent (the known upstream bug that strips MCP tools from agents carrying a `tools:` frontmatter
restriction; `.mcp.json` does configure the server). The local Supabase is **not** the production
population, so querying it would have produced a number that looks like the answer and is not.

⭐ **No figure is recorded in SEED-297.** The exact query is written into the seed for a top-level
session to run, together with the caveat that it is an **upper bound with a known contaminant** — it
cannot separate rows this defect NULLed from rows that were never counted (`SEED-299`).

⛔ **Affirmatively: NO write, NO DDL, NO DML, NO `apply_migration` and NO settings change was issued
against the Supabase MCP by this plan.** Zero MCP calls succeeded at all.

### SEED-074's three stale claims, recorded BESIDE the originals

| The body says | Measured 2026-09-18 |
|---|---|
| *"`harness_engine.py:1413-1421` … the only `finalize_run` call in the engine"* | line numbers MOVED — the producer-shell finalize is now **`:3044-3053`** |
| *"`sub_agent_service.py` (no rollup of per-sub-agent usage …)"* | ⛔ **FALSE since Phase 093/204** — `phase_types.py:768 _record_run_usage` does exactly that. ⭐ A seed can rot into being wrong about the **DEFECT**, not merely a line number: this one under-stated how much was already built, for roughly a year |
| *"Decide the storage shape … (b) a per-phase usage table"* | resolved as **(a)**, columns on `workflow_runs`, by D-256-06. The table is **NOT built**; the seed's *"more future-proof"* is a **preference, not a decision** |

⛔ **`partially-answered`, not `answered` and not `shipped`:** the seed's **step 4 cross-provider
parity check** is not discharged — nothing in Phase 256 drives a live provider. The rollup is proven
by unit fences over fake event streams, which is the right proof for the arithmetic and **no proof
at all** for per-provider usage-emission quirks.

⛔ **SEED-073 is byte-unchanged** — `git diff --numstat .planning/seeds/SEED-073*` produces no
output. It is the price table (METER-01/02, Phase 257) and nothing here builds a rate.

### The sweep — figures recorded, and ⛔ the two unswept figures NEVER summed

`node scripts/check-seeds-register.cjs --phase 256`:

```
register: 307 files · parsed: 307 · skipped: 0 · duplicate ids: 0
unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger
12 seed(s) matched
```

Full register gate: **exit 0**, `307/307 parsed, 0 duplicate ids, 307/307 carry all 5 required keys`.

⛔ **134 and 114 are separate figures and must never be added.** ⭐ Both are **unchanged** from the
planning-time reading despite the register growing 303 → 307, which is the correct signal: all four
new seeds carry a `trigger_when` **and** non-empty `trigger_paths`, so they enter neither unswept
bucket.

**Matched set: 12, up from the 10 measured at planning time.** The two additions are **this plan's
own new seeds** — `SEED-298` (matched on `circuit_breaker.py`, `harness_engine.py`) and `SEED-300`
(matched on `forced_emit.py`, `eval_runner_service.py`, `phase_types.py`) — i.e. the register
demonstrably fires on entries planted minutes earlier. The planning-time prediction of the other ten
was exact.

| Seed | Matched on | Routing |
|---|---|---|
| `SEED-266` | `**/full-schema.sql` | **LEAVE OPEN** — 256-01 regenerates the artifact but adds no privilege |
| `SEED-291` | `phase_types.py` | **LEAVE `partially-answered`** — fired as a CONSTRAINT and honoured; `check-extension-contract.cjs` green |
| `SEED-177` · `SEED-188` · `SEED-198` | broad `backend/app/**` globs | **LEAVE OPEN** — glob matches, not surface overlap |
| `SEED-292` · `SEED-296` | `eval_runner_service.py` | **LEAVE OPEN** — this phase adds a rollup, no export and no UI |
| `SEED-295` | `harness_engine.py`, `publish_service.py` | **LEAVE OPEN** — self-declared UNJUSTIFIED until a real workflow is recorded blocked |
| `SEED-284` · `SEED-290` | `docs/HOT-FILE-LEDGER.md`, `full-schema.sql` | **LEAVE OPEN** — artifact-path matches, no bearing on token accounting |
| `SEED-298` · `SEED-300` | this plan's own new seeds | n/a — planted by this plan |

⛔ **No seed was flipped to `folded`** — none is claimed by this phase, exactly as the plan directs.

⚠ **The routing was NOT written back into the ten matched seeds' frontmatter, and that is a
disclosed deviation rather than an omission.** Two reasons: (1) none of those ten is in this plan's
`files_modified`, and the executor prompt's hard constraint is *"do NOT edit any file outside your
plan's declared `files_modified`"*; (2) ⭐ **the frontmatter contract has no key for "swept and
deliberately left"** — the routing for all ten is LEAVE, which is a no-op in every key the contract
defines, so it could only be expressed by appending prose to `status_note`. The routing is recorded
in full above instead. **Owed follow-up:** either a `last_swept` / `swept_at` key in
`.planning/seeds/TEMPLATE.md` (synced with the gate, per the template's own pair/triple rule), or an
explicit decision that a LEAVE routing lives in the phase SUMMARY and nowhere else.

⚠ `SEED-074` remains in the **114 carry prose but no structured trigger** bucket — it has no
`trigger_paths`. Adding them would change when it fires, which is a semantic change outside this
plan's brief; recorded rather than done quietly.

---

## Verification

| # | Check | Result |
|---|---|---|
| 1 | `pytest tests/unit/test_256_token_sum_narrowing.py -q` | ✅ **12 passed**, 0 failed |
| 2 | **Backend baseline, ONCE, SET-diffed** | ✅ see below |
| 3 | `check-hot-file-ledger.cjs 256` | exit **1** — one `[no-row]`, `forced_emit.py`, owed to 256-04 (O-6). ⭐ `watched: 9`, non-vacuous |
| 4 | `check-claude-md-size.cjs` | ✅ exit 0 — **107,212 chars** |
| 5 | `check-seeds-register.cjs` / `--phase 256` | ✅ exit 0 — 307/307; **12 matched**; unswept **134** · **114** ⛔ unsummed |
| 6 | `check-extension-contract.cjs` | ✅ exit 0 — 6/6 files conform, 0 violations |
| 7 | Frontend gates | **SKIPPED, deliberately** — zero files under `frontend/` modified, so `vitest-count-gate.cjs` has no subject (D-256-14: it is non-deterministic at base, so neither reading would mean anything) |

### The backend baseline — ⛔ the SET, not the count

```
71 failed, 4918 passed, 2 xfailed, 2 xpassed, 43 warnings in 383.98s
```

`grep -c "^FAILED"` → **71** (counted with `grep -c`, ⛔ never a `| tail`, which is how this project
once published 71 when the truth was 72).

**`comm` both directions against `256-BASELINE-backend-failing-set.txt` (71 names):**

```
=== NEW (in now, not in base) ===      <empty>
=== GONE (in base, not in now) ===     <empty>
```

⭐ **The failing SET is identical — zero new, zero gone.** Zero collection errors. The ceiling has
zero headroom and it is intact.

⚠ **A first pass at the diff reported a spurious one-in/one-out**, because a pytest
`RuntimeWarning` had been printed onto the tail of one `FAILED` line, mangling that test id. Both
"differences" were the **same test**. Recorded because a naive `comm` on raw pytest output will
manufacture exactly this false positive, and a reader who sees `1 new` here would wrongly conclude
the gate broke.

⚠ **Observation, not a change:** CLAUDE.md's locked baseline reads *"71 failed, **3497** passed"*.
The passed count now measures **4918**. The gate's contract is the **failing** ceiling, which holds
exactly — but the `passed` figure in that rule has rotted by 1,421, the same class as every other
rotted constant in that file. Not edited here (out of scope).

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] `utf-8` → `utf-8-sig` in the fence's file reader**
- **Found during:** Task 1, the first RED run
- **Issue:** `backend/app/services/email_extraction_service.py` carries a UTF-8 BOM; `ast.parse`
  refuses `U+FEFF` and the fence reported it as a violation, so the fence could not be green at rest
- **Fix:** read with `utf-8-sig`; ⛔ the parse-failure-is-a-violation arm kept live
- **Files modified:** `backend/tests/unit/test_256_token_sum_narrowing.py`
- **Commit:** `c6d97895d`

**2. [Rule 1 — Bug] Control C tripped on its own comment**
- **Found during:** Task 1, the second RED run
- **Issue:** the control asserted a forbidden literal was absent from the module while the module's
  own explanatory comment contained it
- **Fix:** the token is assembled at runtime; the **control was strengthened, not weakened**
- **Commit:** `c6d97895d`

### Disclosed, not auto-fixed

**3. Routing not written into the ten matched seeds' frontmatter** — outside `files_modified`, and
the contract has no key for a LEAVE routing. Full routing table recorded above with an owed
follow-up.

**4. `scripts/check-claude-md-size.cjs`'s ledger checks are unreachable (Finding C)** — a real guard
hole, proven RED. Not fixed: outside `files_modified`, and a guard-script change deserves its own
review.

**5. The U-3 production READ could not execute** — MCP tool unavailable in this agent context. No
number invented.

---

## Known Stubs

None. This plan adds no product surface — one test file, two register documents and five seed files.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change is introduced. `backend/`
source is byte-unchanged (`git diff --numstat backend/app` → empty).
`git diff --numstat backend/requirements.txt frontend/package.json` → **empty**; ⭐ no package was
installed by this plan (T-256-SC).

---

## Self-Check: PASSED

**Files claimed as created/modified — all 8 verified present on disk:**
`backend/tests/unit/test_256_token_sum_narrowing.py` · `SEED-297` · `SEED-298` · `SEED-299` ·
`SEED-300` · `256-02-SUMMARY.md` · `CLAUDE.md` · `docs/HOT-FILE-LEDGER.md`.

**Commits claimed — all 3 verified in `git log`:** `c6d97895d` · `e1e36b76f` · `d61c946dd`.

**Digests re-verified at the close, after every task:**
- `backend/app/db/runs.py` → `de39712121ef82ff7cf789301b0bd1c4` ⭐ still equal to digest **#1**, so
  the Task-1 plant is provably gone at the plan's end and not merely at the moment it was removed.
- `CLAUDE.md` → `42610ec19d09f51af2d9785ff3364601`, equal to the pre-plant digest from Finding C's
  RED drive.

**Scope assertions:**
- `git status --short` → only the untracked SUMMARY (committed immediately after this check).
- `git diff --numstat 902701e89..HEAD -- .planning/STATE.md .planning/ROADMAP.md` → **empty**.
  ⛔ Neither file was touched; the orchestrator owns those writes.
- `git diff --numstat -- backend/app/` → **empty**. No product source was changed by this plan.
