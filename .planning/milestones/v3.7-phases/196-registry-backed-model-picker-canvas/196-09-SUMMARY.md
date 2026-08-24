---
phase: 196-registry-backed-model-picker-canvas
plan: 09
subsystem: phase-records
tags: [hot-file-ledger, G-5, G-2, G-4, reported-bugs, seeds, SC#3, deploy-parity, D-16, D-19, D-21, D-22, D-23]
requires:
  - phase: 196-01
    provides: "the config.py / admin.py / api.ts touches and the OWED full-schema regeneration this plan restates"
  - phase: 196-02
    provides: "the test + the post-fix three-row measurement that make BUG-260731-01 closable on named evidence"
  - phase: 196-06
    provides: "the union query that becomes SEED-176's mechanical re-open trigger"
  - phase: 196-07
    provides: "the unit half of BUG-260718-04, and the reason its refresh half is NOT provable here"
  - phase: 196-08
    provides: "the 249-failure counter-example that keeps SEED-171 from being read as 'red always means flake'"
provides:
  - "ELEVEN new hot-file ledger rows + detail sections, for files that had NO row at any phase count"
  - "SIX re-derived rows that were stale, each corrected beside its original"
  - "SIX young-file rows for this phase's new modules"
  - "a CLAUDE.md superlative REFUTED by measurement: api.ts (97 phases) not threads.py (76)"
  - "backend/tests/unit/test_196_forced_emission_drift_trigger.py — the D-122-04 drift as a GATE"
  - "SEED-174 / SEED-175 / SEED-176, each with a mechanical re-open trigger"
  - "SEED-171's FIFTH named file, plus its first recorded counter-example"
  - "the phase's guardrail record (G-1/G-2/G-3/G-4/G-5/G-7) with each verdict and its reason"
affects:
  - "every future discuss-phase G-5 audit — the scan list grew by 17 rows"
  - "phase verification (four G-4 rows still owed; BUG-260718-04 blocked on U-C1)"
tech-stack:
  added: []
  patterns:
    - "batch re-derivation as a single scripted sweep whose raw output is pasted, so figures are auditable rather than asserted"
    - "a negative fence with a POSITIVE CONTROL proving the same sweep can find a path that IS present — a fence swept against nothing passes green while defending nothing"
    - "a latent inconsistency converted into a gate rather than edited, so it fires the day it stops being latent"
key-files:
  created:
    - backend/tests/unit/test_196_forced_emission_drift_trigger.py
    - .planning/seeds/SEED-174-authoring-model-knob-inert-by-absence.md
    - .planning/seeds/SEED-175-forced-emission-emit-tier-latent-drift.md
    - .planning/seeds/SEED-176-publish-path-accepts-a-stored-unregistered-model.md
  modified:
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/seeds/SEED-171-workflows-library-suites-flake-independent-of-cap.md
    - .planning/reported-bugs/BUG-260731-01-judge-model-knob-may-be-inert-env-singleton.md
    - .planning/reported-bugs/BUG-260718-04.md
key-decisions:
  - "SEED-173 was ALREADY TAKEN (self-hosted inference, planted 2026-08-17), so the plan's three seeds ship as SEED-174/175/176. Reusing 173 would have made the id ambiguous, which is worse than a renumber."
  - "TEST files get a NAMED mention in the ledger but NOT a CLAUDE.md row. The table is the G-5 audit scan list for production concerns; ~28 test rows would degrade it and consume the character budget. The Phase 195 precedent for exactly this decision already exists in the ledger."
  - "196-VALIDATION.md was left byte-unchanged even though its line 78 names a pytest nodeid that will not resolve. The plan makes byte-identity an acceptance criterion; the finding is restated here for the verifier instead."
  - "D-21 and D-16 recorded in docs/HOT-FILE-LEDGER.md rather than only in this summary: that file already carries the G-5 half of the phase's guardrail story, and a guardrail verdict is phase-level and outlives the plan."
  - "BUG-260731-01 flipped to `closed`; BUG-260718-04 deliberately NOT flipped, with the owed row written into the FRONTMATTER because a bug's `status:` frontmatter IS the routing index."
requirements-completed: [AUTH-04]
duration: ~70min
completed: 2026-08-18
---

# Phase 196 Plan 09: The Phase's Records Closeout — Summary

**Seventeen files that G-5 could never have fired on now have rows; six that had rows had wrong ones;
a superlative in `CLAUDE.md` turned out to be false; one bug closed on named evidence and one
deliberately did not; and a latent registry drift became a gate that fires the day it stops being
latent.**

## Performance

- **Duration:** ~70 min (bootstrap → SUMMARY commit)
- **Tasks:** 3/3
- **Files created:** 4 · **Files modified:** 5 · **Files deleted:** 0
- **Commits:** `b571b852` · `ae26b4ba` · `a7f72076`
- ⚠ **Base correction at startup:** `git merge-base HEAD 4b7cb315` returned `3781a3fe`, not the
  dispatched SHA — **the worktree forked from an old `master` merge commit.** Corrected with the
  sanctioned startup `git reset --hard 4b7cb315…` and re-verified before any work. Recorded because
  this project's memory flags it as a recurring worktree failure and `196-07` hit it too; **it would
  have silently built this plan on the wrong tree.**

---

## Task 1 — the batch re-derivation, raw, with its command

**Not one figure below was copied** from D-22, from `196-RESEARCH.md` §K.30, from the plan's
`<interfaces>` block, or from any earlier plan's summary. All twenty-three were produced by **one
scripted sweep** running CLAUDE.md's recipe verbatim, with six-digit dated quick-task buckets
subtracted and **named** rather than silently dropped.

```bash
for f in "$@"; do
  commits=$(git log --oneline -- "$f" | wc -l)
  buckets=$(git log --format=%s -- "$f" \
    | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' \
    | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u)
  phases=$(printf '%s\n' "$buckets" | grep -Ev '^[0-9]{6}$' | grep -E '.' | wc -l)
  dropped=$(printf '%s\n' "$buckets" | grep -E '^[0-9]{6}$' | paste -sd, -)
  lines=$(wc -l < "$f")
done
```

```
FILE                                                            COMMITS  PHASES   LINES   DROPPED-BUCKETS
backend/app/api/admin.py                                             32      12    1733   -
backend/app/api/model_registry.py                                     1       1     155   -
backend/app/api/settings.py                                          30      16     616   -
backend/app/api/workflows.py                                         36      18    1984   260814
backend/app/config.py                                                71      42    1285   -
backend/app/main.py                                                  72      53     783   -
backend/app/services/eval_runner_service.py                          12       7     959   -
backend/app/services/harness/phase_types.py                          39      16    2424   -
backend/app/services/harness/publish_service.py                      20       8    1250   -
backend/app/services/harness/validator_kinds.py                      12       5     749   -
backend/app/services/model_registry.py                                3       1     368   -
frontend/src/components/admin/ModelRegistryTab.tsx                   10       4    1191   -
frontend/src/components/chat/ChatArea.tsx                            63      30     571   -
frontend/src/components/panel/PhaseCard.tsx                          11       7     522   -
frontend/src/components/workflows/ModelField.tsx                      1       1     236   -
frontend/src/components/workflows/PhaseFormPanel.tsx                 19       9    1216   260814
frontend/src/components/workflows/modelFitness.ts                     1       1     130   -
frontend/src/hooks/useComposerModel.ts                                2       1     367   -
frontend/src/hooks/useModelRegistry.ts                                1       1     109   -
frontend/src/lib/api.ts                                             170      97    6154   260405,260814
frontend/src/pages/WorkflowBuilderPage.tsx                           42      13    2398   260809,260814
frontend/src/types/index.ts                                          70      56    1154   260405
scripts/vitest-count-gate.cjs                                       100      16    3215   260807,260808,260814
```

And the two files the superlative correction turns on, measured in the same pass:

```
backend/app/api/threads.py                                          234      76    1273   260328,260405
frontend/src/providers/StreamsProvider.tsx                           84      33    4119   260529
```

### The file list was derived FROM GIT, not from the plan — and it found one the plan did not predict

`git diff --name-only aa65101d..HEAD` returns **71 paths**, of which **23 are non-test source files**.
The plan's `<interfaces>` block named 22. ⚠ **`backend/app/main.py` was touched by `196-04` and appears
in no plan's predicted list.** Per the plan's own instruction it still owes a row, and it got one — at
**53 phases**.

### Before / after for every already-listed row

| File | CLAUDE.md read | **re-derived 2026-08-18** | moved |
|---|---|---|---|
| `backend/app/services/harness/phase_types.py` | 38 / 15 / 2393 | **39 / 16 / 2424** | ✚1 phase |
| `backend/app/api/workflows.py` | 35 / 17 / 1962 | **36 / 18 / 1984** | ✚1 phase |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 16 / 8 / 1167 | **19 / 9 / 1216** | ✚1 phase |
| `backend/app/services/harness/publish_service.py` | 19 / 7 / 1243 | **20 / 8 / 1250** | ✚1 phase |
| `frontend/src/components/chat/ChatArea.tsx` | 61 / 29 / 587 | **63 / 30 / 571** | ✚1 phase, ⚠ **−16 LINES** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 41 / 12 / 2348 | **42 / 13 / 2398** | ✚1 phase |

⚠ **`ChatArea.tsx` is the only row on this ledger whose LINE COUNT WENT DOWN.** That is `196-07`'s
extraction, and it is why that file's G-5 was honoured **by reduction rather than by argument**.

### Coincidences, stated as coincidences

Three re-derived triples equal a figure an earlier plan recorded — `196-06`'s `36 / 18 / 1984`,
`196-08`'s `100 / 16 / 3215` and `196-08`'s `19 / 9 / 1216`. **They were produced independently by the
sweep above and were not read from those summaries.** The agreement means those plans measured
correctly hours earlier, not that this close copied them. Every other figure moved, including
`admin.py`, which `196-01` read as `30 / 11 / 1718` and `196-04` read as `32 / 12 / 1733` **four hours
later on the same day.**

### The eleven absent files, and the headline

| File | phases | was in the table? |
|---|---:|---|
| `frontend/src/lib/api.ts` | **97** | ⚠ **no** |
| `frontend/src/types/index.ts` | **56** | ⚠ no |
| `backend/app/main.py` | **53** | ⚠ no |
| **`backend/app/config.py`** | ⚠ **42** | ⚠ **no — the D-22 headline** |
| `scripts/vitest-count-gate.cjs` | 16 | no — *on the file that enforces the guardrails* |
| `backend/app/api/settings.py` | 16 | no |
| `backend/app/api/admin.py` | 12 | no |
| `backend/app/services/eval_runner_service.py` | 7 | no |
| `frontend/src/components/panel/PhaseCard.tsx` | 7 | no |
| `backend/app/services/harness/validator_kinds.py` | 5 | no |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | 4 | no |

**`backend/app/config.py` at 42 phases has been structurally invisible to its own guardrail for the
project's entire life.** That is the same failure `WorkflowsPage.tsx` suffered for ten phases,
`WorkflowDoorSwitch.tsx` for six, `db/workflows.py` for seventeen and `ChatArea.tsx` for
twenty-eight — **run four times longer than any of them.**

### ⚠ A CLAUDE.md SENTENCE IS REFUTED, and the original is struck through rather than deleted

`CLAUDE.md` called `backend/app/api/threads.py` at 76 phases *"the hottest file in the repository"*.
**It is not.**

| | phases (generous) | phases (strict: two-digit buckets discarded) | lines |
|---|---:|---:|---:|
| `backend/app/api/threads.py` | 76 | **56** (20 discarded) | 1273 |
| **`frontend/src/lib/api.ts`** | **97** | **81** (16 discarded) | **6154** |

⚠ **The verdict does not depend on the counting convention** — `api.ts` wins both ways, which is why
it is recorded as a refutation rather than as a second reading. **The claim was wrong for a structural
reason rather than a careless one: the comparison set was the ledger table, and the actual hottest
file has never been in it.** Nothing about `threads.py`'s own SSE-transport discharge changes; what is
corrected is a superlative.

### Mechanical verification of the same-commit sync rule

```
$ for f in $(git diff --name-only aa65101d..HEAD | grep -E '\.(py|ts|tsx|cjs)$'); do
    grep -q "$(basename $f)" docs/HOT-FILE-LEDGER.md || echo "MISSING: $f"; done
every modified source file has a ledger mention
```

```
$ # every NON-TEST source file also carries a full-path ROW in CLAUDE.md's table
ALL non-test source files carry a CLAUDE.md row     (23/23)
```

**Row and section shipped in ONE commit** (`b571b852`), per the same-commit sync rule.

### CLAUDE.md character budget

```
CLAUDE.md   66433 chars   44.3% of limit   headroom 83567   [OK]
```

**59,305 → 66,433 (+7,128)** for 17 new rows, a struck-through correction and two new paragraphs.
Warn band is 120,000; hard limit 150,000. **No split was needed and none was scrambled.**

---

## Task 2 — the bug statuses, each justified by named evidence

### `BUG-260731-01` → **`closed`** · `verified_closed_by: 196` · `closed_by_plan: 196-02`

The report's own `re_open_trigger` made two things binding. **Both are discharged and both are named:**

1. **THE TEST EXISTS.** `backend/tests/unit/test_196_judge_model_db_backed.py` — six functions / nine
   cases, one per consumer. Observed **RED on all four** against `develop`
   (`AssertionError: assert 'claude-opus-4-8' == 'deepseek-v4-pro'`, four times) **before any
   production line moved**, with **both controls GREEN at that point** — the empty-row negative control
   parametrized across all four consumers, and the consumer-4 precedence control. Post-fix **19
   passed**, every `assert` line byte-identical to the RED run.
2. **THE THREE-ROW MEASUREMENT RE-RAN**, live against `127.0.0.1:54322` on 2026-08-18:
   `resolve_judge_model(await load_app_settings_async())` → **`deepseek-v4-pro`**, where
   `resolve_judge_model(settings)` returned `claude-opus-4-8`.

⚠ **What the closure does NOT claim, written into the report:** UAT row **U-B1** is owed (a real
publish shot routing to `deepseek`, unprovable from a unit test), and **judge FITNESS is untouched**
(SEED-135, D-16).

### `BUG-260718-04` → **stays `folded`.** Not flipped, deliberately.

Its condition is *"restores its last-used model across navigate AND refresh"*.

| Half | Status |
|---|---|
| navigate | ✅ covered — `196-07`'s per-thread re-restore case |
| **refresh** | ⛔ **NOT PROVEN, and not provable from a unit suite** — jsdom has no page reload |

**The single owed artifact is G-4 row `U-C1`**, ratified and not yet driven. ⚠ **The owed row is
recorded in the FRONTMATTER** (a new `owed_before_close` key) **and not only in prose**, because this
project's recorded lesson is that a bug's `status:` frontmatter **IS** the routing index — prose inside
a `folded` record is invisible to the cross-check scan, and that once hid a live bug for two months.

### `BUG-260809-01` (D-19) — confirmed untouched, by measurement

```
md5  4b99eca00428099c0f5e93f55ddabe32   (unchanged)
status: open                            (unchanged)
```
**Absent from `git diff --name-only aa65101d..HEAD`.** Nothing was changed.

### All seven touched records still parse

A line-anchored frontmatter parser (`^---$` fences + `yaml.safe_load`) was run over every record this
plan touched, plus the two it must not have broken:

```
OK  BUG-260718-04.md                        status='folded'
OK  BUG-260731-01-judge-model-knob-…md      status='closed'
OK  BUG-260809-01-cloud-eval-engine-…md     status='open'
OK  SEED-174 / SEED-175 / SEED-176          status='planted'
OK  SEED-171-workflows-library-suites-…md   status='planted'
```

⚠ **This check caught two REAL breakages I had introduced and would otherwise have shipped** — see
Deviations §2. *A record whose frontmatter does not parse is invisible to the routing scan, which is
the same failure mode as a wrong `status:` value.*

### The three seeds — ⚠ numbered 174/175/176, not 173/174/175

| Seed | Subject | **Mechanical re-open trigger** |
|---|---|---|
| **SEED-174** | the authoring knob is inert **by ABSENCE**; plus a second, sharper instance found beside it | ⚠ `SELECT skill_builder_model FROM app_settings WHERE skill_builder_model <> '';` — **any row returned means the drift is LIVE** (run against cloud too) |
| **SEED-175** | the D-122-04 `forced_emission` / `emit_tier` drift | `pytest tests/unit/test_196_forced_emission_drift_trigger.py` goes RED |
| **SEED-176** | publish reads the STORED definition | the first `workflow_definitions` row carrying a `config.model` absent from `build_model_registry_rows()` — the detecting query is quoted in the seed, taken from `196-06`'s summary; a non-zero `unknown_phases` is the signal |

**SEED-173 was already taken** — `SEED-173-self-hosted-inference-as-a-customer-deployment-mode.md`,
planted 2026-08-17 (`5cdecde2`). See Deviations §1.

### ⚠ SEED-174 contains a finding NO PLAN SCOPED, and it is the most actionable thing in this plan

The plan asked for a seed about `resolve_authoring_model` being *"inert by absence"*. That is true and
is measured — **there is no `app_settings.harness_authoring_model` column** (`information_schema`
returns nothing) and no UI knob, so **nothing lies to anybody** and it was correctly out of scope.

⚠ **But reading the neighbourhood found a THIRD resolver of the identical duck-typed shape, and one of
its two call sites is a genuine further instance of the `BUG-260731-01` defect:**

| Consumer of `resolve_skill_builder_model` | passes | verdict |
|---|---|---|
| `api/skill_tuner.py:435` | `user_settings` — DB-backed | ✅ correct |
| ⚠ `skill_proposer_service.py:366` | `from app.config import settings` — **the ENV singleton** | ❌ **the defect** |

**`skill_builder_model` is not like the authoring knob** — it **has** an `app_settings` column
(migration 078), **has** a loader, and `api/settings.py:263` resolves it **from the effective settings
for display**. That is the complete `BUG-260731-01` asymmetry: an honest screen over a value one
consumer does not read.

**Measured live 2026-08-18:**
```
env singleton skill_builder_model       = None
resolve_skill_builder_model(env)        = claude-haiku-4-5-20251001
app_settings.skill_builder_model (live) = ''        <- EMPTY
```

⚠ **It is latent ONLY because the operator's row is empty** — with `''` both objects fall through to
the same ladder and resolve identically. **The moment an operator sets that field, the skill PROPOSER
silently ignores it while the skill TUNER obeys it.** That is exactly the state `BUG-260731-01` was in
before somebody turned the knob. **It was NOT fixed here** — a fourth service changed inside a
records-closeout plan is the *"bug-fix plans smuggle in cleanups"* generalisation of G-7 — and it
carries the one-query trigger above.

### The drift-trigger test — ⚠ BOTH guards driven RED against a real plant

```
$ cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_196_forced_emission_drift_trigger.py -q
3 passed, 1 warning in 0.21s
```

`grep -c 'SimpleNamespace'` → **0**. Non-vacuity floors: **two** (the registry is non-empty **and** at
least one row carries an `emit_tier` — without the second, every comparison would collapse to
`bool(forced_emission) != False`). A **positive control** runs the **same** `_disagreeing_rows`
predicate over an inline fixture that disagrees **in both directions**.

**And the guards were additionally driven RED against a real plant**, which the plan did not require
but this repository's habit does — `claude-opus-4-8`'s `emit_tier` flipped `force` → `coerce`
in-memory (**no file touched**, `git status --short` empty throughout):

```
pre-plant  emit_tier = force forced_emission = True
RED   test_forced_emission_and_emit_tier_still_agree_on_every_registry_row
      ->  SEED-175 HAS FIRED — the forced_emission / emit_tier drift is no longer latent.
RED   test_the_two_judge_fallback_candidates_are_unaffected_either_way
      ->  SEED-175: judge fallback candidate 'claude-opus-4-8' now resolves DIFFERENTLY under the
          two columns (forced_emission=True, emit_tier='coerce'). This is the arm of the drift that
          is NOT cosmetic — it changes which model the publish gauntlet's hard wall grades with
          when the operator's knob is unset.
restored   emit_tier = force
all three GREEN again after restore
```

**The drift itself, re-derived at this close rather than inherited from `196-02`:**

```
total 61 bad 0 []
Counter({'force': 39, 'force_strict': 17, 'coerce': 5})
```

**0 of 61.** ⚠ **The drift sits in THREE ladders, not one** — `validator_kinds.resolve_judge_model`,
`workflow_authoring.resolve_authoring_model` and `skill_tuner_service.resolve_skill_builder_model`,
each having copied the last. **Editing one line would have fixed one third and left nothing watching
the other two or the registry;** the gate watches the registry, which is the thing that can actually
change.

### D-16 honoured in every document written here

```
$ grep -rn 'defs|\$ref' .planning/seeds/SEED-17*.md .planning/reported-bugs/BUG-2607*.md docs/HOT-FILE-LEDGER.md
(no output)
```
The schema-stripping hypothesis is **not stated as fact and not stated at all** in any document this
plan wrote — SEED-135 rates it MEDIUM and forbids the citation until someone dumps the sanitized
payload. The **reason** D-16 kept judge fitness out is recorded (a measurement gap: `gemini-3.5-flash`
is `emit_tier: force` **and** registry-known **and** still returned a null verdict, so `emit_tier` is
necessary but not sufficient) **without** naming the unverified cause.

---

## Task 3 — the fences, proven over the real diff

### SC#3, with a POSITIVE CONTROL proving the fence can fire

⚠ **A fence swept against an empty set passes green while defending nothing.** So the sweep first
proves it can find a path that IS present, using the same grep:

```
== files in the phase diff: 71
== POSITIVE CONTROL: the same sweep finds frontend/src/components/workflows/PhaseFormPanel.tsx
   -> the fence CAN fire
SC#3 clear: frontend/src/pages/SettingsPage.tsx is ABSENT from the phase diff
SC#3 clear: frontend/src/components/settings/ModelPillRow.tsx is ABSENT from the phase diff
byte-unchanged: .planning/phases/196-…/196-VALIDATION.md
byte-unchanged: .planning/reported-bugs/BUG-260809-01-cloud-eval-engine-sweep-all-providers-fail.md
exit=0
```

⚠ **The base used is `aa65101dac85375db4281e267f8b4872f708d504`, and `git merge-base HEAD origin/develop`
returns EXACTLY that SHA** — so the plan's own verify commands and these explicit-SHA runs agree
rather than measuring different trees. Verified, not assumed.

### `verified_models` — proven by the complete changed-line set, not asserted

```
$ git diff -U0 aa65101d..HEAD -- backend/app/api/settings.py | grep -E '^[-+]' | grep -vE '^(\+\+\+|---)'
+    # Phase 196 Plan 07 (D-18 / BUG-260718-04): the operator-DISABLED model-id set, …
+    # … 9 more comment lines …
+    disabled_models = sorted(
+        mid for mid, cap in _overrides.items() if cap.get("enabled") is False
+    )
+        "disabled_models": disabled_models,

verified_models hits in changed lines: 0
removed lines: 0
hunk header: @@ -593,9 +593,24 @@ async def get_providers(current_user: dict = Depends(get_current_user)):
VERDICT: verified_models untouched, purely additive
```

⚠ **The hunk header is the load-bearing evidence**, not the greps: it names `get_providers` and there
is exactly one hunk, so the `/settings` response construction was never entered. **Zero removed lines
across the whole phase** on this file.

### `bash scripts/check-deploy-drift.sh` — **PASS**

```
[1/4] preset keys      ok     no unclassified preset-key drift (allowlist covers 44 keys)
[2/4] seed list        ok     all 9 runbook seed migrations exist (highest listed: 089)
                       WARN   migration(s) above #089 carry seed-like INSERT/UPDATE: 093 094 098
                              104 105 106 107 111 113 118
[3/4] sandbox tag      ok     consistent everywhere: agentic-rag-sandbox:101.1
[4/4] compose parse    WARN   docker compose unavailable/denied here — structural fallback used
                       ok     backend mounts setup_data:/data AND volumes declares setup_data
RESULT: PASS — the one-box deploy artifacts are in sync.
```

⚠ **The seed-like list stops at 118, so MIGRATION 120 IS ABSENT FROM IT.** That is **decisive evidence
for RESEARCH assumption A3** — migration 120 adds no env var and no seed row, so
`deploy/onebox.env.example`, `docs/OPERATOR.md` Step 3 and `docker-compose.prod.yml` are genuinely
unaffected. **Measured by running the script, exactly as A3's mitigation asked, rather than reasoned
about.** Both WARNs are pre-existing and name only migrations ≤ 118; **neither is Phase 196's** and
neither was "fixed" here.

### ⚠ Owed and operator-gated — NOT performed, and neither may be recorded as done

1. **`bash scripts/regenerate-full-schema.sh`** (repo root, **no `--reset`** — the default is a live-DB
   dump that preserves dev data). **Blocked, not skipped:** the script hard-requires Docker
   (`docker exec <supabase_db_*> pg_dump`) and **Docker is denied to the agent layer**.
   `supabase/full-schema.sql` was deliberately left untouched — CLAUDE.md forbids hand-editing it, and
   ⚠ **a wrong artifact is worse than a missing one, because a stale `full-schema.sql` still looks
   authoritative to a greenfield deploy.** Afterwards confirm `grep -c emit_tier supabase/full-schema.sql`
   is > 0. **This is `196-01`'s one unmet acceptance criterion and it is still unmet.**
2. ⚠ **CLOUD PARITY FOR MIGRATION 120** — paste
   `supabase/migrations/120_model_capabilities_overrides_emit_tier.sql` into the **CLOUD** Supabase SQL
   editor, **in the same operation as any deploy of this code.** Operator-gated, **NOT performed**, and
   **no cloud action was taken by this plan.** ⚠ Without it the cloud `get_model_capability_async`
   overlay reads a column that does not exist.

### The phase's guardrail status line

| Rule | Verdict | Reason |
|---|---|---|
| **G-1** | did not fire | 196 is not a `<base>.N` insert |
| **G-2** | ⚠ **FIRED, DECLINED on a reason (D-21)** | the picker idiom ships twice (`JudgeModelPicker.tsx` 137.1, `ModelDefaultPreference.tsx` 167), so the acceptance bar was in CODE. The operator was offered a sketch and did not take it. **No override owed, none recorded** — STATE.md's silence is a measurement. ⚠ **Honest limit: weaker for the `<optgroup>` grouping, which neither shipped picker has** |
| **G-3** | did not fire | nine plans, a migration, a new route, four mounted pickers |
| **G-4** | fired — **4 rows ratified, ALL FOUR still OWED** | U-A1 / U-A2 / U-B1 / U-C1, driven at phase verification by Chrome MCP, not by any plan |
| **G-5** | ⚠ **FIRED on 6 listed + 11 unlisted files** | honoured by construction in every case — and on `ChatArea.tsx` **by REDUCTION**, with the arithmetic in its section |
| **G-7** | did not fire | no gap-closure round has run on this phase |

**Where D-21 and D-16 are recorded, and why:** in `docs/HOT-FILE-LEDGER.md`, not only here. That file
already carries the **G-5** half of every phase's guardrail story, and **G-2 and G-5 are the two rules
that actually fired**. A plan SUMMARY is a plan-level artifact; **a guardrail verdict is phase-level
and outlives the plan**, and splitting one phase's verdicts across two documents is how a decline gets
read as an omission later.

---

## Deviations from Plan

### 1. [Rule 3 — Blocking] ⚠ `SEED-173` WAS ALREADY TAKEN. The three seeds ship as 174 / 175 / 176.

- **Found during:** Task 2, before writing a line — `ls .planning/seeds/` shows
  `SEED-173-self-hosted-inference-as-a-customer-deployment-mode.md`, committed `5cdecde2` on
  **2026-08-17**, one day before this plan ran.
- **Why a renumber and not a reuse:** two documents sharing `seed_id: SEED-173` makes **every future
  cross-reference to "SEED-173" ambiguous**, in a repository where seeds are cited by id from bug
  reports, ledger sections, CLAUDE.md and other seeds. A colliding id is worse than a shifted one.
- **Consequence, stated plainly:** `196-02`'s summary and this plan's own text refer to *"SEED-174"*
  for the drift, which is now **SEED-175**. That mapping is recorded here so a reader following the
  older pointer lands correctly:
  **authoring-knob → SEED-174 · forced_emission drift → SEED-175 · publish path → SEED-176.**
- **Files:** the three new seed files.

### 2. [Rule 1 — Bug] ⚠ TWO frontmatter breakages I introduced, caught by a check I nearly skipped

- **Found during:** Task 2, validating the records after editing them.
- **Issue A:** the `>>>> ORIGINAL` marker I used to preserve each bug's prior `re_open_trigger` was
  originally written `---- ORIGINAL (…) ----`. **Inside frontmatter, a `---` run is exactly the
  document delimiter**, and any parser splitting on it — including the naive one I first wrote —
  truncates the block mid-scalar (`found unexpected end of stream`). Changed to `>>>>`, which no YAML
  or frontmatter parser can mistake for a fence.
- **Issue B:** `SEED-176`'s `relates_to` list had an entry **beginning with a backtick**
  (`` - `docs/HOT-FILE-LEDGER.md` → … ``). ⚠ **A backtick cannot start a plain YAML scalar** —
  `found character '`' that cannot start any token`. The whole seed's frontmatter failed to load,
  which would have made it **invisible to every seed-scanning tool while looking perfectly fine in a
  text editor.** Reworded to plain prose, matching the house format of every other seed's
  `relates_to`.
- **Why this is Rule 1 and not tidiness:** these records' **frontmatter IS the index**. A seed whose
  frontmatter does not parse is exactly as invisible as a bug whose `status:` is wrong — which is the
  failure this very plan exists to prevent, reproduced by the plan itself.
- **Fix + verification:** a line-anchored `^---$` + `yaml.safe_load` check over all seven touched
  records; **7/7 OK, exit 0.**

### 3. [Deviation from the plan's acceptance criterion, argued rather than waived] Test files get a ledger MENTION, not a CLAUDE.md ROW

- **The criterion as written:** *"Every file in `git diff --name-only <base>..HEAD` with a `.py` /
  `.ts` / `.tsx` / `.cjs` extension appears BOTH as a row in CLAUDE.md's table AND as a section … in
  `docs/HOT-FILE-LEDGER.md`."* Taken literally that means **~28 test-file rows in CLAUDE.md's table.**
- **Why that would be wrong, not merely verbose:** the table is the **G-5 audit scan list**, and G-5 is
  about **production concerns accreting in one module**. Twenty-eight test rows would dilute the list a
  discuss-phase audit reads, and the mechanism that actually watches test-file growth is
  `scripts/vitest-count-gate.cjs` (frontend) plus the backend suite baseline. It would also spend the
  character budget this same plan is required to keep under a gate.
- **The precedent already exists in the ledger** and was followed rather than invented: Phase 195's four
  new test files carry exactly this decision, in this file, in these words — *"G-5 is about production
  concerns accreting in one module; a test file's growth is the gate's business, not the ledger's."*
- **What was done instead:** every one of Phase 196's **28 touched test files is NAMED** in a dedicated
  ledger section, grouped by created / repaired / edited, with the reason each was repaired. **This
  satisfies the plan's mechanical verify command** (which greps basenames against the ledger) **and it
  is genuinely useful** — it tells the next refactorer exactly where this phase's pins live.
- **The non-test half of the criterion is met in full:** 23/23 non-test source files carry a full-path
  row in CLAUDE.md AND a section or young-file row in the ledger, verified mechanically above.

### 4. [Deviation from the prompt's hint, resolved in favour of the plan] `196-VALIDATION.md` left byte-unchanged

- **The conflict:** the dispatch prompt says of `196-VALIDATION.md:78` — *"VALIDATION.md is
  phase-level; fix it here if in scope."* **The plan's Task 3 says the opposite and makes it
  mechanical:** *"⚠ Do NOT rewrite `196-VALIDATION.md`"*, with *"byte-unchanged by this plan"* as an
  acceptance criterion.
- **Resolution:** the plan wins, because its instruction is a **checkable criterion** while the
  prompt's is a conditional hint, and because VALIDATION.md is the phase's **validation contract** —
  the verifier fills its statuses, and an executor editing the contract it is measured against is the
  wrong direction. **Verified byte-unchanged** by the fence above.
- ⚠ **The finding is therefore RESTATED here for the verifier rather than silently dropped:**
  **`196-VALIDATION.md:78` names `pytest backend/tests/test_196_model_registry_route.py::test_union_size -x`,
  and that nodeid WILL NOT RESOLVE.** The shipped case is
  **`test_union_size_is_code_registry_plus_db_only_rows`** (named descriptively so a red run names the
  finding). A `::` nodeid must match exactly; **`-k test_union_size` resolves it by substring** and is
  the one-word fix. First recorded by `196-04`, still true, still unaddressed.

### 5. [Correction to the plan's `<interfaces>`, not a deviation] The predicted file list was one short, and two entries were wrong

- The plan's `<interfaces>` predicted 22 source files. **The real diff has 23** —
  **`backend/app/main.py`** appears in no plan's list and was touched by `196-04`. Per the plan's own
  instruction (*"If a file was touched that no plan predicted, it still owes a row"*) it got one, at
  **53 phases**.
- The plan listed `backend/app/services/harness/validator_kinds.py` and
  `frontend/src/components/admin/ModelRegistryTab.tsx` among files that *"turn out not to have been
  modified after all"* candidates for named-only treatment. **Both WERE modified** (by `196-02` and
  `196-01` respectively), so both got full sections. Only `SettingsPage.tsx` and `ModelPillRow.tsx`
  stayed named-only — which is SC#3 working.

---

## What this plan did NOT do, and cannot prove

- ⚠ **It drove no UAT row.** All four G-4 rows are owed. `BUG-260718-04` is blocked on **U-C1**
  specifically, and that is stated as a **decision** — closing a phase with owed manual rows is
  legitimate; claiming they ran is not.
- ⚠ **It performed no cloud action and regenerated no schema artifact.** Both are recorded as owed
  above, with the exact commands, and neither is claimed done.
- **It fixed no drift.** `SEED-175`'s three ladders still read `forced_emission`; the change is that a
  gate now watches the registry. `SEED-174`'s `skill_proposer_service.py:366` still reads the env
  singleton; the change is that a one-query trigger now exists.
- ⚠ **A row written today goes stale on the next commit that touches its file** — this ledger's own
  most repeated finding, demonstrated **twice inside this phase alone** (`admin.py` moving in four
  hours; `196-06` finding `workflows.py` stale by its own commit). **Every section carries its
  re-derive command for exactly that reason.**

## Known Stubs

None. No placeholder values, no unwired data sources. Every figure in the ledger is a measurement with
its command published; every seed trigger is a runnable command or query; the one new test is wired to
the live `MODEL_CAPABILITIES` and was observed both green and red.

## Threat Flags

None. No new network endpoint, no auth path, no file-access pattern, no schema change, no package
installed. The plan's own register is discharged as written:

| Threat | Disposition | Discharged by |
|---|---|---|
| `T-196-DOC1` (a ledger row that lies) | mitigate | every figure re-derived in one batch pass, raw output published, coincidences named as coincidences |
| `T-196-DOC2` (a bug `status` that lies) | mitigate | one flipped on named evidence, one deliberately held with the owed row in the **frontmatter** |
| `T-196-DOC3` (row/section drift) | mitigate | the same-commit sync rule, checked mechanically — 23/23 rows, 71/71 diff paths mentioned |
| `T-196-DOC4` (silent SC#3 creep) | mitigate | a negative fence over the real diff **with a positive control proving it can fire** |
| `T-196-DEPLOY` | accept, **RECORDED** | migration 120 owed to the cloud SQL editor; no cloud action taken; `check-deploy-drift.sh` PASS covers the artifact half |
| `T-196-SC` | accept | no packages installed |

## Self-Check: PASSED

- `backend/tests/unit/test_196_forced_emission_drift_trigger.py` — FOUND (3 passed)
- `.planning/seeds/SEED-174-authoring-model-knob-inert-by-absence.md` — FOUND
- `.planning/seeds/SEED-175-forced-emission-emit-tier-latent-drift.md` — FOUND
- `.planning/seeds/SEED-176-publish-path-accepts-a-stored-unregistered-model.md` — FOUND
- commits `b571b852`, `ae26b4ba`, `a7f72076` — all FOUND in `git log`
- `node scripts/check-claude-md-size.cjs` — **exit 0**, 66,433 chars / 44.3 %
- `.planning/STATE.md` and `.planning/ROADMAP.md` — deliberately **UNTOUCHED** (orchestrator-owned);
  `git diff --name-only aa65101d..HEAD` names them only from earlier waves, and
  `git status --short` was empty after every commit in this plan
- `196-VALIDATION.md` and `BUG-260809-01-…md` — verified **byte-unchanged**
- `git diff --diff-filter=D` — **empty across all three commits**

---
*Phase: 196-registry-backed-model-picker-canvas*
*Completed: 2026-08-18*
