# Phase 255 — PREFLIGHT (measurement pack)

**From:** claude (REVIEWER) · **To:** gemini (BUILDER) · **Date:** 2026-09-18
**Base SHA:** `fee85754a` on `develop`

> ⛔ **AGENTS.md §3.1 carve-out.** This is a **measurement pack**: re-derived facts with **no
> recommendation attached**. CLAUDE.md makes three things mandatory at `discuss-phase` — the
> reported-bugs cross-check, the seeds sweep and the G-5 hot-file scan — and those are the
> reviewer's stated ownership. **What to do about any of it is yours.** If you find a sentence here
> that reads *"so you should…"*, treat it as a defect in this file and ignore it.

---

## 0 · Start here

⚠ **Assert your base.** Agent worktrees start on the **default branch**, which is `master` and is
stuck at the v3.9 ship commit. Five consecutive executors have had to reset. Your base is
**`fee85754a` on `develop`** — assert it before reading the plan.

⚠ **Bootstrap every worktree FIRST**, before the HEAD assertion and before anything else:

```bash
bash scripts/bootstrap-worktree.sh "$(pwd)"
```

A worktree that skipped it reports green typechecks and red tests for reasons that look like the
plan's fault. Cap vitest at `GSD_VITEST_MAX_WORKERS=2`.

---

## 1 · Gate baselines — captured BEFORE you touch anything

| Gate | Baseline at `fee85754a` |
|---|---|
| Backend unit (`pytest tests/unit -q --continue-on-collection-errors`) | ⏳ **capturing — posted to the bus when it lands** |
| Frontend count gate (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, repo root) | ⏳ **capturing — posted to the bus when it lands** |

⚠ **The backend ceiling is 71 and has ZERO headroom** (CLAUDE.md). It is also **STALE against suite
growth** — set at `3497 passed`, now ~4900 — and was left untouched by operator decision. Any new
failure above 71 breaks the gate.

⚠ **A count is not a set.** When you report a gate, capture the failing **filenames**, not a
`| tail`. This project published a baseline of 71 when the truth was 72 because a `tail` kept the
count and threw away 60 of the names.

⚠ **`npx tsc --noEmit` type-checks ZERO files** — `frontend/tsconfig.json` is solution-style
(`{"files": [], "references": [...]}`). Use `npx tsc -p tsconfig.app.json --noEmit`, and measure a
**set diff**: the app config reports **67 errors at base**, so "zero errors" is not a reachable
criterion.

---

## 2 · G-5 hot-file scan — re-derived today, not copied

The six files `SEED-291` names as `trigger_paths` are the ones the guard must read.

| File | commits / phases / lines | Ledger row | G-5 |
|---|---|---|---|
| `backend/app/services/harness/phase_types.py` | **53 / 26 / 2937** | present, ⚠ **STALE** (reads `51/24/2925`) | FIRES |
| `backend/app/services/tool_dispatcher.py` | **85 / 35 / 5048** | present, ✅ accurate | FIRES |
| `backend/app/services/agent_loop.py` | **48 / 22 / 3441** | present, ⚠ **STALE** (reads `44/21/3326`) | FIRES |
| `backend/app/services/harness/validator_kinds.py` | **14 / 6 / 762** | present, ⚠ **STALE** (reads `12/5/749`) | FIRES |
| `backend/app/services/harness/programmatic.py` | **3 / 3 / 137** | ⛔ **NO ROW — zero hits in CLAUDE.md AND docs/HOT-FILE-LEDGER.md** | ⛔ **FIRES at 3 phases, invisible to its own guardrail** |
| `backend/app/services/harness/emitters.py` | **4 / 2 / 188** | ⛔ **NO ROW** | does not fire yet (2 phases) |

⛔ **Mechanical consequence:** `node scripts/check-hot-file-ledger.cjs 255` **will fail** the moment
a PLAN's `files_modified` names `programmatic.py` or `emitters.py`, because the gate fails on a
non-test source file with no ledger row. The `.claude/hooks/hot-file-ledger-guard.js` hook runs it
in the turn a PLAN.md is written, so it fires immediately, not later.

⚠ Four of the six rows were measured wrong or absent. **Re-derive rather than trusting a cell** —
a row that is present and WRONG answers the auditor with `satisfied` and stops the audit.

```bash
git log --oneline -- <file> | wc -l                                     # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l  # phases (drop 6-digit dates)
wc -l <file>                                                            # lines
```

---

## 3 · Seeds sweep

```bash
node scripts/check-seeds-register.cjs --phase 255
```

Returned **no `[trigger-fires]` lines** — and that is an **artefact, not a result**: the sweep
matches a phase's `files_modified` against each seed's `trigger_paths`, and `.planning/phases/255-*`
has no PLAN.md yet. ⛔ **Re-run it after your first PLAN.md exists.**

Register state at base: **gate OK · 303/303 parsed · 0 duplicate ids**. Unswept, as two figures that
are ⛔ never summed: **134 carry no `trigger_when` at all** · **114 carry prose the sweep cannot
match**.

**Seeds naming this phase by prose** (a sweep is a floor, not a ceiling):

- **`SEED-291`** — the extension contract itself. It is `EXT-01`'s source and names the six
  `trigger_paths` above, plus a mechanical check in its own frontmatter.
- **`SEED-295`** — named outcomes / forward-only edges, planted 2026-09-18 as **UNJUSTIFIED**. Its
  `trigger_when` says it fires if `EXT-01` has not landed. It is **not** in this phase's scope; it is
  listed because `SEED-291`'s refusal list is what governs it.

---

## 4 · Reported-bugs cross-check

Open `surface: Agentic-RAG` reports whose `affected_areas` touch harness / workflow / executor /
validator territory:

- `BUG-260609-02`
- `BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar`
- `BUG-260730-02-emit-gate-reports-citations-when-citations-were-perfect`
- `BUG-260815-06-structural-gate-refusal-names-nothing-actionable`
- `BUG-260828-05-send-receipt-names-the-smtp-host-not-the-recipient`
- `BUG-260908-01-chunks-section-is-unbounded-and-buries-every-section-below-it`

⚠ **Overlap is by area, not by claim.** None was measured against the current tree for this pack.
Two of the three registers were stale in *both* directions at the v4.2 scoping — two read
"still broken" when fixed, one read "fine" when a live credential leak was open. **Drive the claim
before planning against it.**

---

## 5 · Standing facts this phase touches

- **`PHASE_TYPE_REGISTRY_ENTRIES` holds exactly 7 executors.** v3.6 `D-14` held that line across 13
  phases. `EXT-01` is the written form of it.
- **`PROGRAMMATIC_PHASE_REGISTRY`** is a closed dict with **2** fns (`split_topic`, `eval_slow_step`).
  **`PROGRAMMATIC_VALIDATOR_REGISTRY` is EMPTY** — `@register_programmatic_validator` has **zero**
  call sites.
- **`EMITTER_REGISTRY`** resolves by closed-dict lookup (`llm_emit.emitter`, default
  `render_template`).
- Measured today across the two dispatch files named in `SEED-291`'s own mechanical check:
  `grep -rn "getattr(\|importlib\|eval(\|exec(" phase_types.py tool_dispatcher.py` — **run it
  yourself and record the number**, because it is the number `EXT-02`'s guard has to keep at zero
  for the dynamic-resolution arms.

---

## 6 · Guardrails live on this phase

- **G-8** — target **3-5 plans**. Above 6, justify in CONTEXT.md by naming what cannot share a
  worktree. Overhead is **per plan**.
- **G-5** — see §2. Any plan naming `programmatic.py` owes a ledger row first.
- **G-2 / G-4** — the ROADMAP marks 255 `UI hint: no`, so neither fires here.
- **Operator decisions surfaced at 255's discuss, per the ROADMAP** — ⛔ both go `--to operator`,
  never settled agent-to-agent: **#2** Open Platform sequencing (`SEED-013`), where a third silent
  deferral needs a written reason; **#6** `OV-248-01` retire-or-record.

---

## 7 · What I will do as reviewer

Re-measure every figure rather than reading it from your claim, and **drive** anything whose
criterion is behavioural rather than structural — `EXT-02` in particular, whose success criterion is
that planting a violation makes the guard exit non-zero and removing it makes it pass.

⛔ I will not hand over fixes. A verdict is **pass**, or **revise with named blocking gaps**.
