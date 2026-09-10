---
phase: 239
plan: "09"
subsystem: sources / settings
seed: SEED-258
tags: [settings, app_settings, source-adapters, mcp, dos-guard, migration-174]
requires:
  - Phase 239 (SRC-04) — the MCP source family and the two constants that disagreed
  - SEED-227 precedent — a bounded numeric knob on `app_settings` (`multimodal_max_vision_calls`)
  - Phase 075.10 precedent — a never-raise runtime accessor (`tool_args_progress_emit_boundary_bytes()`)
provides:
  - "app_settings.source_max_file_size_mb — ONE operator knob, bounded 1..50 MB"
  - "source_max_file_bytes() — the single source of truth all three source families read"
  - "mcp_client.mcp_max_body_bytes() — the envelope cap, DERIVED, never a second field"
  - "migration 174 (authored, NOT applied — operator pastes it)"
affects:
  - backend/app/models/user_settings.py
  - backend/app/api/settings.py
  - backend/app/services/mcp_client.py
  - backend/app/services/sources/adapters/{google_drive,microsoft_graph,mcp_source}.py
tech-stack:
  added: []
  patterns: [never-raise settings accessor, derived-not-declared limits, API-is-the-boundary bounds, AST structural fence]
key-files:
  created:
    - supabase/migrations/174_app_settings_source_max_file_size.sql
    - backend/tests/unit/services/sources/test_258_the_file_ceiling_is_a_setting.py
    - backend/tests/unit/services/sources/test_258_the_ceiling_is_operator_scope.py
    - backend/tests/unit/services/sources/test_258_the_api_is_the_boundary.py
  modified:
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/app/services/mcp_client.py
    - backend/app/services/sources/adapters/google_drive.py
    - backend/app/services/sources/adapters/microsoft_graph.py
    - backend/app/services/sources/adapters/mcp_source.py
    - backend/tests/unit/services/sources/test_239_body_cap_admits_the_file_ceiling.py
    - backend/tests/unit/services/sources/test_239_mcp_source_adapter.py
    - backend/tests/unit/test_mcp_egress_hardening.py
    - backend/tests/unit/test_settings.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
metrics:
  duration: ~1h50m
  completed: 2026-09-08
  tasks: 6
  commits: 6
---

# Phase 239 Plan 09: The Source File Ceiling Becomes an Operator Setting — Summary

**Backend only.** Three duplicated `MAX_FILE_BYTES` constants and one disagreeing
`MAX_MCP_BODY_BYTES` collapse into **one bounded `app_settings` knob** whose envelope cap is
derived server-side; the operator can now see the number, change it, and — the actual point of
the seed — read what raising it costs.

---

## ⚠ Base correction, first

The worktree came up on **`1335b4b1a`** (the v3.9 ship commit on `master`), **not** the specified
`d05c4e2af`. This is the documented `origin/HEAD` default-branch behaviour and it has now caught
**eight** agents in a row. Reset with `git reset --hard d05c4e2af` before any other action, and
verified (`d05c4e2af docs: the frontend typecheck gate checks ZERO files`). Bootstrap ran clean
afterwards: `BOOTSTRAP OK`, both junctions live, both `.env` files copied.

---

## The setting: name, bounds, and why these bounds

| | Value | Why |
|---|---|---|
| **Name** | `app_settings.source_max_file_size_mb` | The number a person thinks in — *"how big a file can I import"*. MB, not bytes, following `multimodal_max_b64_bytes_kb`'s unit-suffixed convention. |
| **Home** | `app_settings` (RLS disabled, global singleton) | ⛔ **Not `user_settings`.** It bounds how much memory ONE in-flight request buffers from a server we do not control. A DoS guard a user can raise for themselves is not a guard. |
| **Floor** | **1 MB** | Below this essentially nothing imports. A ceiling of `0` is not a narrower policy — it is ingestion switched off while every sync still reports success. |
| **Default** | **25 MB** | ⭐ **The shipped value, unchanged.** This plan moves the number's HOME, not the number. |
| **Hard maximum** | **50 MB** | ⭐ **Derived, not picked.** `app/api/documents.py:594` refuses a hand-uploaded file at 50 MB, so a *connected* source may never admit a file the app would refuse from a person's own disk. |

### ⭐ A finding that fell out of choosing the hard maximum

`google_drive.py:31` read, for its **entire life**:

```python
MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB matching application upload ceiling
```

**That comment was FALSE.** Measured 2026-09-08, the manual-upload ceiling is **50 MB**. It never
matched anything. This is the same *class* of defect SEED-258 was planted about — **a relation
between two numbers asserted in prose, in one of the two files, with nothing executable connecting
them.** The seed found it between `mcp_source` and `mcp_client`; it was also sitting, unnoticed,
between `google_drive` and `documents.py`.

It is now **pinned by a test** rather than restated in a comment
(`test_the_hard_maximum_does_not_exceed_the_apps_own_upload_ceiling`), which fails if either side
moves. ⚠ Note what this does **not** do: it does not resolve the remaining asymmetry that a person
can hand-upload a 50 MB file while a connected source refuses at 25 MB. That is a **policy** call
for the operator, and it is now *visible and adjustable* rather than invisible and hardcoded —
which is exactly the state the seed asked for.

---

## How the envelope derivation works

```python
# backend/app/services/mcp_client.py
def mcp_max_body_bytes() -> int:
    ceiling = source_max_file_bytes()
    return -(-ceiling * 4 // 3) + _MCP_ENVELOPE_HEADROOM_BYTES   # ceil(x4/3), integer-only
```

⛔ **There is no envelope field, and a test asserts there never will be.** The seed's first named
failure mode is *"Two fields appear (file size and envelope size) — the original defect, now
user-operable."* `test_the_envelope_is_derived_and_is_not_a_second_setting` scans
`UserEffectiveSettings.model_fields` for anything matching `body_bytes` / `envelope` and fails if
one appears. The derivation is **one-way**: raising the file ceiling forces the envelope up; nothing
can raise the envelope alone.

**Measured across the configured range:**

| Configured | Ceiling (bytes) | Derived envelope | Envelope MB | ratio |
|---|---|---|---|---|
| 1 MB (floor) | 1,048,576 | 2,446,678 | 2.33 M | 2.3333 |
| 25 MB (default) | 26,214,400 | **36,001,110** | 34.33 M | 1.3733 |
| 50 MB (max) | 52,428,800 | 70,953,643 | 67.67 M | 1.3533 |

### ⚠ A deliberate, recorded 0.98% widening of a DoS guard

The shipped constant was `34 * 1024 * 1024` = **35,651,584**. The derived value at the same 25 MB
default is **36,001,110** — **+349,526 bytes, +0.98%**.

The gap is the headroom term. `25 MB × 4/3 = 33.33 MB`, so the old `34 MB` carried an unexplained
**~683 KB** that existed only because 33.33 rounds up to 34. I replaced it with a **named** `1 MB`
constant (`_MCP_ENVELOPE_HEADROOM_BYTES`) with a stated reason: JSON-RPC scaffolding, `result` /
`content` nesting, mime type, uri, and whatever else an untrusted server puts beside the blob.

**The alternative was to reverse-engineer a headroom value that preserved `34 MB` exactly — which
would encode a rounding artefact as a constant, i.e. the precise anti-pattern this plan removes.**
Flagging it explicitly because it is a security-relevant number moving in the permissive direction,
however slightly, and silence there would be wrong.

⚠ **Never read at import time.** The ceiling is live; a module-level read would freeze whatever the
DB held at process boot, and with `WORKER_COUNT=2` two workers could freeze different values.

---

## The relation test now sweeps the RANGE, not a value

`test_239_body_cap_admits_the_file_ceiling.py` was rewritten. It previously imported two module
constants and asserted the relation **at one number** — and the task brief is right that this is
exactly what missed the defect the first time. Every case is now parametrised over
`[FLOOR, DEFAULT, CEILING]`, because a *configurable* pair can be jointly wrong at one end of the
range and fine at the other, which is strictly easier to miss than a static pair.

Each case also asserts its own **fixture premise** (`ceiling == mb * 1024 * 1024`) before asserting
anything else — the brief warned that three tests in this phase passed vacuously on a wrong fixture.

### The sibling-parity case (SC#3) is kept, and strengthened

The old case asserted `mcp == DRIVE == GRAPH` — three constants that were equal. **Parity is now
IDENTITY rather than maintenance:** all three call one accessor, so they cannot drift. The test
proves the property parity actually rests on now, via **AST**:

- no adapter module contains a module-level **binding** of `MAX_FILE_BYTES`;
- every adapter module contains a **call** to `source_max_file_bytes()` — ⚠ *an import alone is not
  a read*.

⚠ **Why AST and not a string scan.** Each of the three files now carries a struck-through prose note
naming the constant it used to own (deliberately — the next author should find the history). A
`"MAX_FILE_BYTES" not in src` fence fires on that note and would have to be softened, **which is how
a fence stops meaning anything.** The AST fence refuses the *shape* and is indifferent to prose.

---

## RED evidence

TDD was on for every behavioural change. Three RED drives, each run before the implementing code
existed:

| Drive | Command | RED result |
|---|---|---|
| **1 — the setting + scope** | `pytest tests/unit/services/sources/test_258_the_file_ceiling_is_a_setting.py tests/unit/services/sources/test_258_the_ceiling_is_operator_scope.py -q` | **`10 failed, 1 passed`** — `AttributeError: module 'app.models.user_settings' has no attribute 'source_max_file_bytes'` |
| **2 — the relation across the range** | `pytest tests/unit/services/sources/test_239_body_cap_admits_the_file_ceiling.py -q` | **`7 failed, 1 passed`** |
| **3 — the API boundary** | `pytest tests/unit/services/sources/test_258_the_api_is_the_boundary.py -q` | **`9 failed, 1 passed`** |

⚠ **The `1 passed` in drive 1 is disclosed, not hidden.** It is
`test_the_knob_is_not_a_per_user_preference`, a **negative** fence — it passed vacuously because the
knob did not exist anywhere yet. That is inherent to a negative fence, which is why it carries its
own **positive control** (`assert "preferences->>'default_model'" in src`) that *does* fire and would
fail loudly if the surface it scans ever moved. Same structure in drive 3's `1 passed`
(`test_the_boundaries_under_test_are_the_ones_the_code_uses`, a premise pin on constants that did
not exist — it failed as part of the 9 and is listed here only for completeness of the count).

### Hashes

No structural fence in this plan required planting a defect in a shipped file, so **no md5
plant-and-restore cycle was performed** and there are no restore hashes to report. Saying so
plainly rather than leaving the section blank: **the brief's `sed -i` line-ending warning never
became relevant, because no shipped file was mutated and reverted.**

Every fence here is **RED by construction** instead — each was written against code that did not
yet exist and observed failing, which is a stronger guarantee than a plant-and-restore (the code
under test genuinely could not satisfy it). The two negative fences carry positive controls, listed
above, so neither can pass vacuously without saying so.

The commits themselves are the audit trail:

| Commit | What |
|---|---|
| `06d44aefe` | `test(239-09)` — RED, both contract files (10 failed) |
| `e4b045636` | `feat(239-09)` — the setting + never-raise accessor |
| `e5eed223c` | `feat(239-09)` — three copies → one setting, envelope derived |
| `e266f81ad` | `feat(239-09)` — the API boundary + its refusal sentence |
| `c86cdeb62` | `feat(239-09)` — migration 174 |
| `1014579e1` | `docs(239-09)` — ledger rows + sections |

---

## Is a migration owed? **YES — and it is authored, NOT applied.**

I checked how `multimodal_max_b64_bytes_kb` persists before assuming, as the brief asked.
**`save_app_settings()` writes to real COLUMNS** — it builds a parameterised `UPDATE` with the key
interpolated as the column name (behind `_VALID_COLUMN_NAME`, the Phase 150 CR-01 injection guard).
It is not a JSONB blob. So a new setting **requires a column**, and
`166_app_settings_vision_model.sql` is the exact precedent.

**`supabase/migrations/174_app_settings_source_max_file_size.sql`** — number 174 because the
migrations directory ends at `173_classification_rules_scope.sql` and the ROADMAP had **already
reserved 174 for Phase 239 and left it unused** ("no migration — reserved 174 unused"). Numbers are
monotonic; gaps are never backfilled.

⛔ **I did not apply it.** Per CLAUDE.md the operator pastes it into the Supabase SQL editor — never
`db push` / `db reset`. **`supabase/full-schema.sql` was therefore NOT regenerated**, because
`scripts/regenerate-full-schema.sh` dumps the *live* DB and the live DB does not have this column
yet. Regenerating before applying would write an artifact that does not match either state.

**The authored-but-not-applied window is fail-soft by construction**, which is why shipping the code
ahead of the paste is safe: `_val()` reads `row.get(key)`, a missing column yields `None`, and the
default is the shipped 25 MB. Nothing changes size until the column exists **and** an operator sets
it. Same shape as `model_discovery_filter_enabled` before 159-03.

The migration also carries a `CHECK (… >= 1 AND … <= 50)`. That makes **three** enforcement points,
each covering a hole the others cannot:

1. **API** (`PATCH` refused, 400, with a sentence) — covers the app.
2. **Read** (`source_max_file_bytes()` clamps) — covers a row that got out of range some other way.
3. **CHECK** — covers a hand edit in the very SQL editor the operator uses to apply this file.

---

## The refusal says what raising it COSTS

⭐ **This is the part the seed actually cares about**, and a bare `400` would have missed it:

> *"The setting ships with no explanation of the cost, which leaves the operator exactly as blind as
> the constant did — **the problem was never the number**."*

The 400 body:

> The largest file a connected source may import must be between 1 and 50 MB. 0 would stop every
> source importing while each sync still reported success. Raising it costs memory: the whole
> response is held in memory per in-flight request from a server we do not control, and file content
> arrives base64-encoded at 4/3 its size. 50 MB is the app's own upload limit, so a connected source
> can never admit a file you could not upload by hand.

`test_the_refusal_says_what_raising_it_COSTS_not_just_that_it_refused` asserts the word *memory*
appears. That is a deliberately crude executable proxy for "this sentence explains itself" — and a
crude executable proxy beats an eloquent unexecuted intention.

**`GET /settings` also serves the bounds** (`source_max_file_size_mb_floor` / `_ceiling`) next to the
value, so the coming frontend states them without owning a copy. ⛔ **A form carrying its own `50`
would be a fourth private constant** — the exact shape this plan removed from three files.

---

## Gates — verbatim

**Targeted (per the brief):**
```
$ pytest tests/unit/services/sources tests/unit/test_239_mcp_source_discovery.py -q
338 passed, 1 warning in 1.92s
```

**Full backend, at the end:**
```
$ pytest tests/unit -q --continue-on-collection-errors
71 failed, 4249 passed, 2 xfailed, 2 xpassed, 42 warnings in 191.16s (0:03:11)
```

**Baseline, re-derived on this worktree at `d05c4e2af` BEFORE any edit:**
```
71 failed, 4222 passed, 2 xfailed, 2 xpassed, 41 warnings in 115.44s (0:01:55)
```

**⭐ Diffed as a SET by node id, never as a count:**
```
base=71  after=71
=== NEW ===
=== FIXED ===
SETS IDENTICAL
```

**Zero new failures. The backend sits exactly at the CLAUDE.md ceiling of 71 with zero headroom, as
it did at base.** Passed went `4222 → 4249`, **+27**, which reconciles exactly with no residual:
8 (`test_258_the_file_ceiling_is_a_setting`) + 3 (`test_258_the_ceiling_is_operator_scope`) +
10 (`test_258_the_api_is_the_boundary`) + 6 (`test_239_body_cap_admits_the_file_ceiling`, 2 → 8).

⚠ **A methodology note worth keeping.** My first baseline run captured only `| tail -5`, which kept
the count and threw away the set — the exact mistake the project's own
`feedback_capture_the_set_never_a_tail` note describes. I re-ran the baseline properly against the
**unmodified** `user_settings.py` (saved my diff, `git checkout -- <the one file>`, ran, `git apply`
back) rather than reasoning that my change was "additive and therefore safe".

⚠ **A second normalisation trap, recorded because it produced a false diff.** pytest interleaves an
unraisable `RuntimeWarning` into the `FAILED` lines at a nondeterministic point, concatenating it
onto whichever node id it lands beside. Raw-sorted, the two sets looked to differ by two entries.
They did not — the same two node ids were in both, one carrying the warning suffix in each run.
Stripping from `C:` onward before sorting shows the sets are identical. **A set diff needs
normalising before it can be trusted, or it manufactures exactly the finding you were looking for.**

**Other gates:**
```
$ node scripts/check-hot-file-ledger.cjs --files <the 6 touched source files>
ledger gate OK — every watched file has a row.

$ node scripts/check-claude-md-size.cjs
  CLAUDE.md   86767 chars   57.8% of limit   headroom 63233  [OK]
claude-md size gate OK
```

⚠ The ledger gate **FAILED first**, unprompted, with `[no-row]
backend/app/services/sources/adapters/google_drive.py`.

---

## Re-derived triples

| File | Row said | **Measured 2026-09-08** | Fires G-5? |
|---|---|---|---|
| `backend/app/services/sources/adapters/google_drive.py` | **NO ROW AT ALL** | **`3 / 2 / 407`** | no (2 phases) |
| `backend/app/models/user_settings.py` | `46 / 30 / 1352` | **`48 / 31 / 1460`** | ⚠ **FIRES** (31) |
| `backend/app/services/mcp_client.py` | `7 / 5 / 480` | **`9 / 6 / 526`** | ⚠ **FIRES** (6) |
| `backend/app/api/settings.py` | `30 / 16 / 639` | **`34 / 18 / 738`** | ⚠ **FIRES** (18) |
| `backend/app/services/sources/adapters/microsoft_graph.py` | `0 / 0 / 352` | **`3 / 2 / 376`** | no (2 phases) |
| `backend/app/services/sources/adapters/mcp_source.py` | `8 / 1 / 1259` | **`9 / 1 / 1271`** | no (1 phase) |

**Five of six rows were stale or absent.** Each old value is recorded **beside** its replacement in
`docs/HOT-FILE-LEDGER.md`, never over it. Sections added in the **same commit** (sync rule);
disposition cells kept under the 200-char cap.

Three observations worth carrying:

- ⚠ **`google_drive.py` was invisible to G-5 for its entire life** — and it is the *original* source
  adapter, the one every later family was written to match. The gate caught what no table-reading
  would have.
- ⚠ **`user_settings.py`'s row was stale one phase after being added** at 214, having been absent
  for 30 phases before that.
- ⚠ **`microsoft_graph.py` read `0 / 0 / 352`.** A row minted in the commit that *creates* a file
  reads `0 / 0` forever unless re-derived — **indistinguishable from an unmeasured row.**

**All three G-5-firing files are honoured by construction**, not by refactor: one field + one
accessor on an existing pattern (`user_settings`), one constant deleted in favour of a derivation
(`mcp_client`), one knob at the four seams `rerank_enabled` already uses (`api/settings`). The
extraction owed on `user_settings.py` (the runtime-accessor shelf) is **named in the ledger and
stays OWED** — this plan added to it rather than taking it.

---

## Deviations from plan

**None requiring a rule.** Three in-scope adjustments, all Rule 3 (blocking) or Rule 2 (correctness):

1. **`tests/unit/test_settings.py`'s `_fake_settings` stub** needed the new field (3 pre-existing
   tests went red). Its own comment says a `getattr` default there *"would hide a field the API
   forgot to build"*, so I added the field rather than weakening the response. Fixed within the same
   task; final set is identical to base.
2. **`test_239_mcp_source_adapter.py` and `test_mcp_egress_hardening.py`** imported the deleted
   constants. Re-pointed at the accessors — which *improves* them: they no longer re-type `25 MB`.
3. **The AST fence** replaced my own first draft's string fence, for the reason given above.

---

## ⛔ What I did NOT do — silence would read as done

- **No frontend work at all.** `frontend/` is untouched, by instruction. **The Settings UI does not
  yet show this knob**, so today the setting is reachable only via the API. ⚠ **SEED-258's headline
  requirement — the on-screen copy stating the value, that it applies to every connected source, and
  what raising it costs — is therefore NOT met yet.** The backend serves everything that pass needs
  (value + floor + ceiling + a cost-bearing refusal sentence), but **the seed is not dischargeable
  until the frontend lands.** ⛔ **`SEED-258` must stay `status: planted` — I did not flip it.**
- **I did NOT apply migration 174.** Operator action, via the SQL editor. Until then the column does
  not exist anywhere, including on this machine.
- **I did NOT regenerate `supabase/full-schema.sql`** — see the migration section for why doing so
  before the paste would write a wrong artifact.
- **No cloud/deployment parity.** Migration 174 is owed on any deployed environment. No
  `deploy/onebox.env.example` or `docker-compose.prod.yml` change is needed — this is a DB column and
  a settings row, **not an env var** (CLAUDE.md: env vars are for secrets and infra only).
- **I did NOT run `graphify update .`** despite the standing CLAUDE.md rule. It writes into
  `graphify-out/`, which is outside this plan's stated backend-only scope and would put unrelated
  files in the merge. **Flagging it as owed rather than doing it silently.**
- **No manual UAT.** Nothing here was exercised against a live MCP server or a real Google Drive
  file at a changed ceiling — every claim above is unit-level or measured arithmetic. **A row that
  proves an operator can raise the ceiling and then import a 30 MB file is owed**, and it cannot run
  until migration 174 is applied.
- **No frontend gates run** (`vitest-count-gate`, `tsc -p tsconfig.app.json`). Frontend is
  byte-unchanged, so they are not applicable — but I state that rather than implying they passed.
- **I did NOT resolve the 25-vs-50 MB asymmetry** between hand upload and connected sources. It is
  now visible and adjustable; choosing a value is the operator's.
- **I did NOT touch the four other places `MAX_ATTACHMENT_BYTES` / `MAX_FILE_SIZE` /
  `workspace_service.MAX_FILE_SIZE` live** (email attachments 25 MB, document upload 50 MB,
  workspace files 10 MB). ⚠ **These are three more independent size constants with no relation
  pinned between them or to this one.** SEED-258's general case is *not* fully closed by this plan —
  it closed the **source-family** cluster. Recording it here because the seed's own trigger (c) —
  *"a FIFTH size constant is added"* — is measured to be **already true** and nobody has counted.
- **No independent reviewer.** `OV-239-01` still stands: I built this alone. `/code-review ultra` is
  the only independent gate available.

---

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `supabase/migrations/174_app_settings_source_max_file_size.sql` | FOUND |
| `backend/tests/unit/services/sources/test_258_the_file_ceiling_is_a_setting.py` | FOUND |
| `backend/tests/unit/services/sources/test_258_the_ceiling_is_operator_scope.py` | FOUND |
| `backend/tests/unit/services/sources/test_258_the_api_is_the_boundary.py` | FOUND |
| Commits `06d44aefe` `e4b045636` `e5eed223c` `e266f81ad` `c86cdeb62` `1014579e1` | FOUND in `git log` |
| Failing SET identical to base | VERIFIED (`SETS IDENTICAL`, 71/71) |
| Ledger gate | `ledger gate OK` |
| CLAUDE.md size gate | `[OK]` 86,767 chars |
