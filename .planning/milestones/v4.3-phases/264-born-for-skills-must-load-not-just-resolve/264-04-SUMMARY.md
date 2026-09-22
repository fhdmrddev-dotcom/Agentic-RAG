---
phase: 264-born-for-skills-must-load-not-just-resolve
plan: 04
subsystem: backend-tool-dispatch
tags: [pack-17, real-db, integration, ledger, registers, tdd, closing-sweep]
requires:
  - "_resolve_skill_visibility_or(ctx, *, born_for=False) and the three opted-in sites (264-03)"
  - "build_skill_visibility_or(..., expert_bundle_id=None) (264-02)"
  - "ToolContext.born_for_bundle_id (264-01)"
provides:
  - "the real-DB same-org NON-AUTHOR born-for load, beside the SEED-125 cross-org refusal"
  - "a real-DB read_skill_file leg where the two error strings arbitrate resolution vs download"
  - "six ledger triples re-derived POST-MERGE, in both registers, in one commit"
  - "the .or_() applications correction (six -> SEVEN) in both registers"
  - "the phase's closing evidence as a set-diff in both directions, not a count"
affects:
  - "264 phase close / verification — every gate run for real, every verdict quoted verbatim"
tech-stack:
  added: []
  patterns:
    - "dataclasses.replace over a neighbour's ctx helper so two test ctx shapes cannot drift"
    - "a teardown that RETURNS post-delete counts so the test asserts cleanup instead of trusting it"
    - "two distinct handler error strings used as the arbiter between resolution and download"
key-files:
  created: []
  modified:
    - backend/tests/integration/test_v3_4_org_isolation.py
    - backend/app/utils/skill_visibility.py
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/phases/264-born-for-skills-must-load-not-just-resolve/264-RESEARCH.md
    - .planning/phases/264-born-for-skills-must-load-not-just-resolve/deferred-items.md
decisions:
  - "SC#1's real-DB half DRIVEN, not blocked — local Supabase was up and both legs are green"
  - "RESEARCH §8.11's bundled-files [ASSUMED] is ANSWERED YES by measurement, not closed as an assumption"
  - "mig 191's FK refutes the plan's 'a fresh UUID' — a real expert_bundles row is required"
  - "no named seam claimed discharged; agent_loop's prompt-assembly seam is proven UNTOUCHED"
metrics:
  duration: "~1h45m"
  completed: 2026-09-22
  tasks: 3
  commits: 4
---

# Phase 264 Plan 04: The Real Database Agrees, and the Registers Tell the Truth Summary

A same-org **non-author** now loads the instruction **body** of a private born-for skill from a
**real local Postgres** — and a disjoint-org caller holding the *correct* bundle id still cannot —
while all six hot files this phase touched carry a triple re-derived **after the last merge**, in
both registers, in one commit. Backend unit gate at exactly **71 failed**, node-id set-diff **empty
in both directions**.

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `755dec19b` | `test(264-04): SC#1 on a REAL database — a same-org non-author loads the BODY` |
| 2 | `a34372f76` | `docs(264-04): the .or_() applications are SEVEN, corrected in both registers` |
| 3 | `892823ca7` | `docs(264-04): six ledger triples re-derived post-merge, both registers, one commit` |
| 4 | `08616b126` | `docs(264-04): frontend count gate — the EIGHTH rot, recorded beside its original` |

Base: `28dcb9a67` (waves 1-3 merged). `git diff --stat 28dcb9a67..HEAD` touches **six files**,
590 insertions / 17 deletions; `--diff-filter=D` is **empty**. STATE.md and ROADMAP.md untouched.

⚠ **This plan ran SEQUENTIALLY ON THE MAIN WORKING TREE, not in a worktree** — deliberately, because
it mutates the local Postgres and CLAUDE.md worktree rule 4 is explicit that worktrees isolate files,
not Postgres. `scripts/bootstrap-worktree.sh` was therefore **not** run (the plan's verification list
names it as the first command; that line applies to the worktree shape it assumed). Recorded rather
than silently skipped.

---

## Task 1 — SC#1's real-DB half: DRIVEN, not blocked

⭐ **The local Supabase stack was up and both legs are green.** Ports probed before anything else —
`54322 OPEN`, `54321 OPEN` — so the Windows port-reservation trap was never entered and
`_service_role_supabase_or_skip()` never skipped. **This row is a measured PASS, not a ⛔ BLOCKED.**

### What shipped

`backend/tests/integration/test_v3_4_org_isolation.py` gains **315 lines in ONE appended hunk** —
four helpers, a shared teardown-clean literal, and two tests — beside the SEED-125 legs it inverts.

**`test_load_skill_born_for_same_org_non_author_pack17`** — five cases, every one asserting on the
instruction **body string**, never a status word:

| # | Caller | `born_for_bundle_id` | Expected |
|---|---|---|---|
| 1 | the AUTHOR (A) | the stamped bundle | body (positive control) |
| 2 | ⭐ a SECOND member of **A's own org** | the stamped bundle | **body — the case that was broken** |
| 3 | the same member | `None` | refused |
| 4 | the same member | a WRONG uuid | refused |
| 5 | ⛔ a DISJOINT-org caller (B) | the **CORRECT** bundle | refused (T-264-19) |

**`test_read_skill_file_born_for_same_org_non_author_pack17`** — the same axis one layer down, where
**the two error strings arbitrate**: `Skill '<name>' not found.` is the skill-level refusal (the
pre-264 defect) and `File 'margin.md' not found: …` is a file-level miss, i.e. the caller got PAST
resolution. Author and same-org member must get the file-level one; the no-bundle case and the
cross-org case must get the skill-level one.

⛔ **Case 5 is the one worth naming.** The nested shape is what makes it pass: the born-for disjunct
sits **inside** `and(org_id.in.(…), …)`, so even a caller who somehow holds the right bundle id is
excluded by the org gate. Placed beside `is_system` it would have let a foreign org through — the
literal SEED-125 leak. That is now proven on Postgres, not inferred from a predicate string.

### TDD — the RED, quoted, with its blob pair

Plant: `sed -i 's/, born_for=True)/)/g'` on `tool_dispatcher.py` (`3 → 0` occurrences) — the exact
pre-264-03 state. No gate was running (264-01's `inspect.getsource` lesson).

```
E  assert None == 'PACK-17 born-for PRIVATE instructions 141d5e75-8f00-4ed1-a427-d79e247929e7'
E   +  where None = {'available_skills': ['financial_ratio_calculator', 'skill-creator'],
                     'error': "Skill 'pack17-born-for-141d5e75-8f00-4...found or not enabled.",
                     'hint': 'Call load_skill again with one of the names in available_skills,
                              exactly as written.'}.get('instructions')

E  assert "Skill 'pack17-born-for-4e865e40-…' not found." != "Skill 'pack17-born-for-4e865e40-…' not found."
FAILED …::test_load_skill_born_for_same_org_non_author_pack17
FAILED …::test_read_skill_file_born_for_same_org_non_author_pack17
2 failed, 27 deselected
```

⭐ **Both failed at the TARGET assertion, with the POSITIVE CONTROL already green** — so the RED is
located at the case under test and not at the fixture. ⭐ And PACK-17 is visible verbatim in the
first failure: the miss branch hands the model an `available_skills` list that **excludes** the skill
its Expert's prompt just promised, and tells it to retry with one of the others.

⭐ **The captured HTTP log is the strongest artefact here** — the wire the un-widened predicate
actually put on the socket:

```
GET /rest/v1/skills?…&or=(is_system.eq.true,and(org_id.in.(05d316e7-…),
    or(user_id.eq.5d18e3ff-…,is_org_shared.eq.true)))&name=eq.pack17-born-for-…&is_enabled=eq.True
```

No `born_for_expert_bundle_id` term. A unit test can assert a string; this shows PostgREST receiving it.

**Restoration proven per 264-02's rule — `git hash-object` against the index blob, never a raw md5**
(`pathlib.write_text` emits CRLF on Windows while the Write tool emits LF, so a digest comparison can
lie):

| File | blob before | blob after plant | blob after revert | `git diff --quiet` |
|---|---|---|---|---|
| `backend/app/services/tool_dispatcher.py` | `8940dbde…` | `c5717eb3…` | **`8940dbde…`** | CLEAN |

⭐ The planted blob `c5717eb3…` is **byte-identical to the one 264-03 recorded for its own RED 2** —
two independent plans, two different test surfaces, the same reverted file.

### The neighbour is byte-unchanged, proven

```
git diff --stat  → 315 insertions(+), 0 deletions
git diff -U0     → ONE hunk: @@ -1141,0 +1142,315 @@
md5 of HEAD:…test_v3_4_org_isolation.py        = ba7d7bd4735b93a7c483d7010fadf953
md5 of lines 1..1141 of the working copy       = ba7d7bd4735b93a7c483d7010fadf953
```

`test_load_skill_cross_org_refused_seed125` and every other pre-existing test are provably untouched.
`_make_seed125_tool_ctx`'s default is untouched too — the new ctx is built by `dataclasses.replace`
over that helper, so the two shapes cannot drift and the neighbour still measures the configuration
it measured before this commit.

### Teardown VERIFIED, not trusted

`_teardown_born_for_seed` deletes and then **returns the post-delete counts**, which the test asserts
inside `finally`:

```python
assert remaining == {"skills": 0, "skill_files": 0, "expert_bundles": 0,
                     "org_members": 0, "auth_users": 0}
```

Independently re-checked against the live DB after the RED run *and* the GREEN run:

| Probe | before any run | after both runs |
|---|---|---|
| `skills LIKE 'pack17-born-for-%'` | — | **0** |
| `expert_bundles slug LIKE 'pack17-born-for-%'` | — | **0** |
| `auth.users email LIKE 'pack17-member-%'` | — | **0** |
| `skills` TOTAL | 11 | **11** |
| `expert_bundles` TOTAL | 3 | **3** |
| `skill_files` TOTAL | 175 | **175** |

**Nothing kept, nothing left behind** — the `263-UAT.md` standard, with nothing to name under
"data left behind, deliberately".

### ⭐ RESEARCH §8.11's first `[ASSUMED]` is ANSWERED — **YES**, by measurement

The question: *do born-for skills in this deployment actually bundle files?* — the premise behind
widening `read_skill_file` and `execute_code`. Measured against the live local database:

```
skills total                                   11
born_for_expert_bundle_id IS NOT NULL           3
  search-strategy-builder   files:  0
  xlsx                      files: 53
  docx                      files: 64
skill_files total                             175
```

**Two of the three shipped born-for skills bundle files, 117 rows between them — 67% of every
`skill_files` row in the deployment.** The widening is now justified by *inspected rows*, not by the
`files: [...]` promise alone. ⚠ **Scope of the claim, stated honestly:** this is the LOCAL dev
deployment. It was not re-measured against production (the Supabase MCP's read path would settle
that for free and was not exercised here). The assumption is **answered where it was asked** — an
assumption named in RESEARCH must not close as an assumption — but "in every deployment" is not what
was measured.

⚠ The **second** `[ASSUMED]` (`caller_org_id` never `None` at `api/experts.py:81`) is 264-02's,
settled by its §8.10 driven case; nothing here changes it.

---

## Task 2 — six triples, both registers, one commit

Re-derived **after all four plans merged**, at `a34372f76`, with the CLAUDE.md recipe. Six-digit
dated quick-task buckets subtracted (`tool_dispatcher.py` drops `260529` and `260705`: 40 numeric
buckets → 38 phases; the other five files have none).

```bash
git log --oneline -- <file> | wc -l
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | grep -vE '^[0-9]{6}$' | wc -l
wc -l <file>
```

| File | CLAUDE.md row SAID | RESEARCH §7 (mid-phase) | **re-derived at CLOSE** | G-5 |
|---|---|---|---|---|
| `backend/app/services/tool_dispatcher.py` | 85 / 35 / 5048 | 87 / 37 / 5082 | **89 / 38 / 5169** | FIRES |
| `backend/app/services/agent_loop.py` | 48 / 22 / 3441 | 51 / 25 / 3473 | **52 / 26 / 3501** | FIRES |
| `backend/app/services/run_producer.py` | 5 / 3 / 749 | 9 / 5 / 899 | **11 / 6 / 932** | FIRES |
| `backend/app/services/expert_service.py` | 6 / 4 / 515 | 7 / 4 / 515 | **8 / 5 / 551** | FIRES |
| `backend/app/services/task_service.py` | 19 / 10 / 958 | 19 / 10 / 958 *(accurate then)* | **20 / 11 / 970** | FIRES |
| `backend/app/utils/skill_visibility.py` | 1 / 1 / 83 *(added at PLANNING)* | 1 / 1 / 83 | **3 / 2 / 209** | no (2 phases) |

**Five of six were stale, and every old figure is recorded BESIDE its replacement, never over it.**
Two of them are worth more than the arithmetic:

- ⭐ **`tool_dispatcher.py` had THREE published figures and all three were wrong by the close** —
  the CLAUDE.md row (`85/35/5048`), the plan's own text (`87/37/5082`), and 264-03's measurement
  (`88/38/5093`, taken at its base before its edits landed).
- ⭐ **`task_service.py` was ACCURATE when RESEARCH §7 measured it and `264-01` staled it inside the
  same phase.** It is the cleanest counter-example to *"the row agrees with my measurement, so it is
  current"* — **"the row matches" is a statement with a timestamp on it.**
- ⚠ **`agent_loop.py`'s two registers disagreed with EACH OTHER** (`48/22/3441` in CLAUDE.md vs
  `45/21/3326` in the detail file) — worse than either simply being old, because a reader who checks
  one and not the other gets a confident wrong answer.
- ⚠ **`skill_visibility.py`'s row was added at 264 PLANNING and was stale before 264 finished**
  (`264-02` added 126 lines, `264-04` corrected the docstring). A row can rot inside the phase that
  created it.

⛔ **NO NAMED SEAM CLAIMED DISCHARGED.**

- `agent_loop.py`'s prompt-assembly seam (six conditional appends inside one 400-line branch) is
  **untouched and still OWED** — said explicitly in both registers, because an absent note reads as
  a discharge. Proven: the whole-phase diff on that file is four hunks / 28 insertions, none in
  prompt assembly.
- `tool_dispatcher.py`'s `skills`-resolution seam is still OWED — the count is still **four** call
  sites, so the fifth-site trigger has not fired.
- `expert_service.py` got **tighter** (the hand-rolled fourth disjunct deleted, delegating to
  `skill_row_visible`), not extracted.

**Same-commit sync rule honoured:** `git show --stat 892823ca7` names **both** `CLAUDE.md` and
`docs/HOT-FILE-LEDGER.md`. Every disposition cell is under the 200-char cap (longest: 199).

### The `.or_()` prose correction (`a34372f76`) — the obligation 264-03 handed over

`RESEARCH §2.3` and, quoting it verbatim, `app/utils/skill_visibility.py`'s module docstring both
enumerated **six** applications and omitted `_handle_save_skill`'s `.or_(_sibling_filter)` — which
the same paragraph's own prose says exists. Corrected **beside** each original, in both registers, in
one commit.

⚠ **That paragraph is itself a correction** (264-02 rewrote it to retire a *"five call sites"*
claim), so this is **the second wrong number inside one already-corrected sentence** — which is why
it is recorded rather than quietly fixed.

Re-measured at the close (`grep -n "^\s*\.or_(" backend/app/services/tool_dispatcher.py`):

```
applications (7): 1373  1401  1533  1671  1683  2293  2305
call sites   (4): 1369  1529  1666  2283
```

⚠ **Three different line lists now exist for one file** — RESEARCH's `:1319…`, 264-03's
`1330/1358/1474/1605/1617/2217/2229` (taken at `53ece799f`, before its comment blocks landed), and
these. All three are published; **re-derive, never quote one.**

⭐ **The `four call sites` figure is CORRECT and UNAFFECTED, and both registers now say so
explicitly** — a reader who finds half a sentence wrong will distrust the other half, and *four* is
the number every D-264-04 per-site decision rests on. Only the applications count was ever wrong,
and it stays pinned executably at **7** by `test_no_or_application_line_moved`.

---

## Task 3 — the closing sweep, every gate run for real

### Backend unit gate — a set-diff, both directions

Base (this plan's, measured before any edit) and final (quiet tree, everything committed):

| | base `28dcb9a67` | final `08616b126` |
|---|---|---|
| verdict line | `71 failed, 5490 passed, 2 xfailed, 2 xpassed` | `71 failed, 5490 passed, 2 xfailed, 2 xpassed` |
| FAILED node ids | 71 | 71 |
| in this plan's blast radius | **0** | **0** |

```
base=71 final=71
NEW (final not in base):
GONE (base not in final):
=== both empty == identical set ===
```

⛔ **Reported in both directions even though both are empty** — a plan that fixes one inherited red
and introduces one new red reads `71` and is broken.

⚠ `passed` is unchanged at **5490** because this plan's two new cases live in
`tests/integration/`, **outside** the gate. That is the honest reading and the reason the plan
forbids quoting this test as a gate.

⚠ Node ids were extracted by cutting each `FAILED` line at the **first Windows drive-letter path**
and then at pytest's `" - "` separator. ⭐ **A `.split()[0]` truncation is not good enough here** —
`test_no_unwrapped_sync_calls_in_route[async def upload_document(]` contains spaces in its param id
and would collapse; caught and fixed before the diff was taken.

### The other four gates, verdict lines verbatim

```
node scripts/check-claude-md-size.cjs
  CLAUDE.md   116991 chars   78% of limit   headroom 33009  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.     EXIT=0

node scripts/check-hot-file-ledger.cjs 264
  scan list: 321 rows · subject: 18 files · watched: 6
ledger gate OK — every watched file has a row.                              EXIT=0

node scripts/check-gap-closure-rounds.cjs 264
  plans: 4 total · 0 gap-closure
G-7 clear — no gap-closure plans in this phase.                             EXIT=0

node scripts/check-seeds-register.cjs --phase 264
  register: 310 files · parsed: 310 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger
  14 seed(s) matched
seeds register gate OK — 310/310 parsed, 0 duplicate ids, 310/310 carry all 5 required keys.  EXIT=0
```

⚠ **Read the seeds gate's two unswept figures and never sum them.** Most of the register is still
unswept; the 14 below are only what a structured match can see.

### Frontend count gate — run from the repo root, verdict VERBATIM

```
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs
  total                                      7935    8676    +741
  total 8676  ·  failed 0  ·  pinned total 7935
count gate OK — 316/316 pinned files present, no per-file decrease, 0 failing.
```

`git diff --stat 28dcb9a67..HEAD -- frontend/` → **empty**, and over the phase's whole range
`git diff --stat e9d6a9410..HEAD -- frontend/` → **empty**. Phase 264 modified **zero** frontend
source in four plans.

⭐ **That makes this the EIGHTH rot of CLAUDE.md's figures — and the most instructive one.**
CLAUDE.md read `8500 / 7746 / 297`, measured **one day earlier** at Phase 262. The `+176 / +189 /
+19` is 263's landing, not this phase's: **a figure can rot without anybody editing the thing it
measures**, which is exactly why the rule is *re-derive*, never *check whether you changed anything
first*. Recorded in CLAUDE.md beside its original (`08616b126`). The cap held at `2` with `failed 0`
on the first invocation — the fifth consecutive close at which it was neither adjusted nor needed.

### `test_deep_mode_byte_identical_guard` — the warning 264-01 raised, now closed

```
pytest tests/test_eval_runner.py::test_deep_mode_byte_identical_guard -q
1 passed, 1 warning in 0.12s                                                EXIT=0
```

Everything is committed, so the `git diff --quiet backend/app/services/agent_loop.py` it asserts is
clean. This is the confirmation RESEARCH §6.5 asked for.

### SEED-129 — PROVEN untriggered, not assumed

`SEED-129` (open, high) re-opens on any phase touching `agent_loop.py`'s Deep skill-catalog block
(base `:1435`), which still carries the pre-SEED-125 flat predicate on the service-role client.

```
git diff e9d6a9410..HEAD -- backend/app/services/agent_loop.py
  → 4 hunks, 28 insertions(+), 0 deletions
  → @@ 268 (the dataclass field) · @@ 1332→1344 (the bind) · @@ 2055→2073 (resume build)
    · @@ 2937→2960 (primary build)
```

The catalog block is in **none** of them. Proven byte-for-byte rather than argued from hunk headers —
the block shifted `+18` lines, so the regions were aligned and hashed:

```
git show e9d6a9410:…/agent_loop.py | sed -n '1400,1560p'  →  md5 20cc514da65803ba61ec2c37a03e7705
sed -n '1418,1578p' …/agent_loop.py                        →  md5 20cc514da65803ba61ec2c37a03e7705
IDENTICAL
```

**SEED-129 stays open on its own terms, with no edit.** ⚠ A sweep that cannot see a trigger is not
the same as a trigger that did not fire — which is why this proof exists at all: the structured
sweep never surfaced SEED-129.

### Seeds routing — re-run against the REAL `files_modified`, and it holds

**14 seeds matched, the same 14 `264-SEEDS-SWEEP.md` recorded at planning**: SEED-052, 053, 054,
170, 177, 188, 192, 198, 272, 284, 288, 291, 299, 303. Every one was routed **leave open** with a
reason, and the routing is re-confirmed against the actual diff — nothing this phase shipped changes
any of their states, so **no frontmatter edit is owed** (`status:` IS the index, and a leave-open
does not move it). The two nearest neighbours, re-checked rather than re-quoted:

- **SEED-291** (the Extension Contract) — 264 adds **no engine branch**; the closed-core AST
  invariant on `agent_loop.py` is green by construction and was re-driven. The phase is evidence
  **for** the contract.
- **SEED-303** (an Expert must ADD scope) — 264 makes an already-resolvable born-for skill
  **loadable**, which completes 263's S9 work at run time rather than opening a new arm. Its S3 /
  S8 / spend-attribution arms are untouched; stays `partially-answered`.

---

## Deviations from Plan

### 1. [Rule 1 — measured correction] The plan's "a fresh UUID" for the born-for marker is REFUTED

Task 1's `<action>` says to stamp the skill with `born_for_expert_bundle_id=<a fresh UUID>`.
Migration 191 declares:

```sql
ADD COLUMN IF NOT EXISTS born_for_expert_bundle_id uuid
    REFERENCES public.expert_bundles(id) ON DELETE SET NULL;
```

An unbacked id is rejected by the FK, so `_seed_born_for_private_skill` seeds a **real
`public.expert_bundles` row** first (with `org_id` explicit — mig 187 carries
`CHECK (is_system = true OR org_id IS NOT NULL)`). The reason is written into the helper's
docstring, not just here. ⭐ This is also what makes case 4 meaningful: the *wrong* bundle is an
unbacked uuid passed on the **ctx**, never written to a row, so it exercises the predicate rather
than the FK.

### 2. [Rule 2 — added, threat-register-driven] Two proof cases beyond the plan's four

The plan's `<behavior>` lists four load_skill cases. Shipped: **five**, plus an entire second test.

- **Case 5** (a disjoint-org caller holding the CORRECT bundle) is `T-264-19` in this plan's own
  threat register with disposition `mitigate`. The plan discharges it by *"the existing cross-org
  test stays green"* — but that test's caller has **no bundle at all**, so it cannot see a
  wrongly-placed disjunct. Driving a cross-org caller **with** the bundle is the only case that
  distinguishes *nested inside the org gate* from *beside `is_system`*.
- **`test_read_skill_file_born_for_same_org_non_author_pack17`** covers the second of the three
  widened sites on the real DB. 264-03 proved it in-process only, and the `[ASSUMED]` behind it was
  the phase's weakest link. Cost: one extra test in the same file, same fixtures, same teardown.

### 3. [Rule 3 — scope] Three files outside this plan's declared `files_modified`

`264-04-PLAN.md` declares three files; six were modified. The extra three are the **prose-correction
obligation `264-03` registered as 264-04's** (`deferred-items.md`, owner and trigger named):
`backend/app/utils/skill_visibility.py` (the module docstring that quotes the wrong figure),
`264-RESEARCH.md` (§2.3, the source it quotes), and `deferred-items.md` itself (marking the
obligation TAKEN). `skill_visibility.py` already carries a ledger row in both registers, so
`check-hot-file-ledger.cjs 264` stays green.

### 4. [deliberate] Ran on the main working tree, no worktree bootstrap

Per the orchestrator's instruction and CLAUDE.md worktree rule 4 — this plan writes to the local
Postgres, which worktrees do not isolate. The plan's verification line
*"`bash scripts/bootstrap-worktree.sh "$(pwd)"` was the first command run"* is therefore **not met,
by design**. No `git stash` / `git reset --hard` / `git clean` / `rm -rf` was run at any point; the
operator's untracked `scratch/`, `screenshots/` and the unrelated modified
`236-ROSTER-REPORT.md` were left untouched throughout (confirmed in `git status --short` at the
close).

### 5. Out of scope, logged not fixed

**`node scripts/check-landing-drift.cjs` still FAILS**, byte-for-byte as 264-01 recorded it:

```
• Fact: SURFACE_TABS.orgAdmin (OrgAdminShell.tsx)
  Source Code: ["Members","Experts","Audit","Settings","Invitations & Roles","SSO","Subscription","Retention"]
  facts.ts:    ["Members",         "Audit","Settings","Invitations & Roles","SSO","Subscription","Retention"]
```

⭐ **Proven inherited by MEASUREMENT, not by repetition:** `git diff --stat e9d6a9410..HEAD --
frontend/` over the phase's whole range is **EMPTY**. Landed with 261 / 263; owner is whoever owns
the landing canvas; trigger recorded in `deferred-items.md`.

---

## Threat Flags

None. No new endpoint, no new auth path, no new file access pattern, no schema change. The one
trust boundary this plan touches — **writes to the local database** (T-264-20) — is mitigated by a
teardown whose counts are asserted and independently re-probed, and by serialisation as the only
wave-4 plan. The Supabase MCP (production) was **not used**: no read was needed and no write was
requested.

## Known Stubs

None. Every path added here is driven against a real database; no placeholder values, no empty
defaults flowing to a surface.

---

## Verification

| Check | Result |
|---|---|
| local Supabase reachable before anything else | ✅ `54322 OPEN`, `54321 OPEN` — no skip, no port trap |
| `pytest tests/integration/test_v3_4_org_isolation.py -q -k "seed125 or born_for"` | ✅ **6 passed** (4 seed125 + 2 new) |
| the two new legs driven RED against the reverted dispatcher | ✅ quoted above; both failed at the TARGET, positive controls green |
| plant restored — `git hash-object` vs the index blob | ✅ `8940dbde…` → `c5717eb3…` → **`8940dbde…`**, `git diff --quiet` CLEAN |
| `test_load_skill_cross_org_refused_seed125` byte-unchanged | ✅ one appended hunk; lines 1..1141 md5-identical to HEAD |
| all four/five cases assert the instruction BODY, none a status word | ✅ |
| teardown verified — post-run counts | ✅ all `0`; DB totals identical to the pre-run probe (11 / 3 / 175) |
| RESEARCH §8.11 bundled-files `[ASSUMED]` | ✅ answered **YES** — 2 of 3 born-for skills bundle 53 and 64 files |
| `pytest tests/unit -q --continue-on-collection-errors` | ✅ **71 failed**, node-id set-diff **empty both ways** |
| `node scripts/check-claude-md-size.cjs` | ✅ EXIT 0 — no `[disposition-too-long]`, `[duplicate-row]` or `[malformed-row]` |
| `node scripts/check-hot-file-ledger.cjs 264` | ✅ EXIT 0 — 321 scan rows, 6 watched files, all have rows |
| `node scripts/check-gap-closure-rounds.cjs 264` | ✅ EXIT 0 — G-7 clear, 0 gap-closure plans |
| `node scripts/check-seeds-register.cjs --phase 264` | ✅ EXIT 0 — 14 matched, routing re-confirmed, no frontmatter owed |
| frontend count gate, repo root, cap 2 | ✅ `total 8676 · failed 0 · pinned total 7935`, 316/316 |
| `git diff --stat` over `frontend/` (plan **and** whole phase) | ✅ empty both |
| `test_deep_mode_byte_identical_guard` | ✅ 1 passed |
| SEED-129 non-trigger | ✅ catalog region md5-identical `20cc514d…` base vs HEAD |
| six ledger rows in BOTH registers, one commit | ✅ `git show --stat 892823ca7` names both files |
| no named seam claimed discharged | ✅ prompt-assembly UNTOUCHED / still OWED in both registers |
| `git diff --diff-filter=D 28dcb9a67..HEAD` | ✅ empty |
| STATE.md / ROADMAP.md untouched | ✅ |
| `check-landing-drift.cjs` | ⛔ FAILS — **inherited**, zero frontend source in the whole phase |

## Notes for the phase

- **SC#1 is now proven on both halves, and neither half claims the other's.** 264-03's unit fence
  proves *the query we would send and the rows it would admit, in-process*; this plan proves *what
  Postgres returns*. Both docstrings say so in those words.
- ⛔ **Neither new test defends the ceiling.** They sit outside `pytest tests/unit`; the backend
  `passed` count did not move. They are UAT-adjacent evidence for D-264-09 and may never be quoted
  as a gate.
- **The reusable asset here is the teardown shape**: a cleanup helper that RETURNS post-delete
  counts so the test can assert them. A teardown nobody measures is a teardown nobody has.
- **`agent_loop.py:1435` (SEED-129) was NOT touched**, proven over the phase's whole diff.
- **The frontend count-gate figures in CLAUDE.md were stale by one day, from a phase that touched no
  frontend code.** Corrected; nothing further owed by 264.

## Self-Check: PASSED

- `backend/tests/integration/test_v3_4_org_isolation.py` — FOUND
- `backend/app/utils/skill_visibility.py` — FOUND
- `CLAUDE.md` — FOUND
- `docs/HOT-FILE-LEDGER.md` — FOUND
- `.planning/phases/264-born-for-skills-must-load-not-just-resolve/264-04-SUMMARY.md` — FOUND
- commits `755dec19b`, `a34372f76`, `892823ca7`, `08616b126` — all FOUND in `git log`
