# Phase 256 — PREFLIGHT (measurement pack)

**Phase:** 256 — Every Token Is Counted And Kept · **Requirements:** METER-03, METER-04, METER-05, METER-06
**Base SHA:** `772f53354` on `develop` · **Captured:** 2026-09-18

> ⚠ **THIS PACK IS WEAKER THAN 255'S, AND THE REASON IS STRUCTURAL.** 255's pack was written by the
> phase's **reviewer** — facts from someone who would not build against them. Gemini was stopped, so
> **the same agent that captured these baselines will build this phase.** That is not independence;
> it is a builder writing down what it found before it started. Read it as such, and re-measure
> anything load-bearing rather than citing this file.

---

## 1 · Gate baselines at `772f53354`

| Gate | Baseline |
|---|---|
| Backend unit | PENDING_BE |
| Frontend count gate (repo root, cap 2) | PENDING_FE |

⚠ Backend ceiling is **71** with **zero headroom**. Diff the committed **SET**, never the count —
`.planning/phases/255-the-extension-contract/255-BASELINE-backend-failing-set.txt` is the 255 set and
this phase's own set is captured beside this file.

⚠ `npx tsc --noEmit` checks **zero files**; use `npx tsc -p tsconfig.app.json --noEmit` and diff the
set (**67 errors at base**).

---

## 2 · ⛔ G-5 — THE WORST EXPOSURE IN THE MILESTONE. Seven files, all firing.

Re-derived 2026-09-18 at this base. **Six of seven rows are now accurate; one was stale and has been
corrected in this pack's own commit.**

| File | commits / phases / lines | Row status |
|---|---|---|
| `backend/app/services/harness_engine.py` | **54 / 20 / 3135** | ✅ accurate |
| `backend/app/services/agent_loop.py` | **48 / 22 / 3441** | ✅ (re-derived at 255) |
| `backend/app/services/tool_dispatcher.py` | **85 / 35 / 5048** | ✅ accurate |
| `backend/app/api/runs.py` | **38 / 17 / 1695** | ⚠ **was STALE at `35/16/1430` — corrected** |
| `backend/app/services/harness/phase_types.py` | **53 / 26 / 2937** | ✅ (re-derived at 255) |
| `backend/app/db/workflows.py` | **48 / 25 / 2585** | ✅ accurate |
| `backend/app/models/harness.py` | **20 / 19 / 766** | ✅ accurate |

⛔ **Every one fires.** A plan that modifies any of them owes a refactor recommendation FIRST, and
must read that file's section in `docs/HOT-FILE-LEDGER.md` — the CLAUDE.md cell carries the verdict
only; the named seam lives in the detail file.

⚠ **255 showed the ledger gate can pass vacuously** (`watched: 0`) when a phase only *reads* its hot
files. **256 MODIFIES them**, so the gate will actually bite here. Run
`node scripts/check-hot-file-ledger.cjs 256` before planning, not after.

---

## 3 · ⭐ What already exists — and two seed claims are measurably out of date

⛔ **DO NOT BUILD COUNTING THAT EXISTS.** This is the phase's single largest waste risk.

| Piece | Measured at `772f53354` |
|---|---|
| Per-turn usage capture | ✅ `task_service._stream_one_iteration` has **SUMMED every turn's usage into a caller-supplied `usage_box` since Phase 093 (D-17)** |
| Sub-agent totals | ✅ `_sub_usage` sums across **every iteration**, and `finalize_run` **persists it to that sub-agent's own `runs.input_tokens/output_tokens`** |
| Sub-agent totals visible to callers | ✅ **Phase 204 (SCHED-02) added the return.** The comment is explicit: *"THE COUNTS WERE ALREADY BEING MEASURED; ONLY THE RETURN WAS MISSING."* |
| Harness in-run ceiling | ✅ `harness_engine.py:1818` wires a real token source into `CircuitBreaker`; `max_tokens_per_run` **can** trip |
| `None` vs `0` | ✅ **deliberately preserved** — "a provider that emitted no usage is a DIFFERENT fact from one that used zero tokens". ⛔ Do not coalesce |
| `workflow_runs` token columns | ⛔ **ZERO.** Migration 057 has none; six later `ALTER`s (062, 063, 064, 070, …) added `inputs`, `model`, `continues_used`, `user_id` — never tokens |
| `llm_emit` / `forced_emit` usage | ⛔ **uncounted**, named at `harness_engine.py:1833`: *"`forced_emit` measures no usage anywhere in its own module"* |
| Token → USD | ⛔ **nothing.** 0 files match `cost_usd`, `token_to_usd`, `spend_ledger`, `spend_cap` |

### ⚠ Two seed framings that the tree contradicts

- **`SEED-074`** is titled *"workflow runs record NULL tokens today"*. **Partly stale.** The
  *sub-agent* path records real tokens on its own `runs` row and has since Phase 093. What is missing
  is (a) persistence on `workflow_runs` itself and (b) **aggregation onto the producer run**.
  ⭐ **So `METER-04` is "aggregate across run rows", not "instrument sub-agents".** Materially smaller.
- **`SEED-073`** stands unchallenged — the USD layer genuinely does not exist. But it is **`METER-01/02`,
  which is Phase 257**, not this phase. ⛔ Nothing here should build a rate table.

---

## 4 · The two `input_tokens=None` sites `METER-05` must close

Verified line-exact at this base:

```
backend/app/api/runs.py:677   input_tokens=None,     # ask_user re-drive, producer-shell finalize
backend/app/api/runs.py:1331  input_tokens=None,     # continuation, producer-shell finalize
```

Both are **producer-shell finalizes** — a chat run that paused for a question, or was continued,
finishes with its count thrown away.

---

## 5 · Migration

**Next number is 182** (`181_revoke_public_secdef_functions.sql` is the last on disk).
⛔ Filename must match `<digits>_name.sql` — a letter suffix like `182b` is **silently skipped** by
the Supabase CLI. ⛔ Apply by pasting into the Supabase SQL editor; never `db push` / `db reset`.
Then regenerate: `bash scripts/regenerate-full-schema.sh` (no `--reset`).

---

## 6 · Registers

- **Seeds gate at base:** OK, 303/303 parsed, 0 duplicate ids. Unswept, two figures ⛔ never summed:
  **134** no `trigger_when` · **114** prose the sweep cannot match.
- **`SEED-073` / `SEED-074`** both read `status: planted`. ⛔ Whatever this phase closes, **edit the
  seed** — a seed that shipped but still reads `planted` is re-proposed forever.
- ⛔ Re-run `node scripts/check-seeds-register.cjs --phase 256` **after** the first PLAN.md exists;
  before that it matches nothing and the empty result is an artefact, not a finding.
- **Open bugs overlapping runs / tokens / workflow:** `BUG-260609-02`,
  `BUG-260610-01-workflow-run-nav-timer-reset-duplicate-avatar`,
  `BUG-260730-02-emit-gate-reports-citations-when-citations-were-perfect`,
  `BUG-260815-06-structural-gate-refusal-names-nothing-actionable`,
  `BUG-260823-01-tool-call-smooth-scroll-rearms-the-pin`,
  `BUG-260908-01-chunks-section-is-unbounded-and-buries-every-section-below-it`.
  ⚠ Overlap is **by area, not by claim** — none was driven. Drive before planning against it.

---

## 7 · Guardrails

- **G-8** — target **3-5 plans**. 256 carries 4 requirements; that is not 4 plans.
- **G-5** — §2. This phase modifies hot files, so the gate bites.
- **G-2 / G-4** — ROADMAP marks 256 `UI hint: no`. Neither fires.
- **`METER-06` may close EITHER WAY — counted, or registered with a concrete re-open trigger.**
  ⛔ What it may not be is silently dropped. A spend figure with an unnamed hole is worse than none.

## 8 · Carried in, unresolved

- **Operator decisions #2** (Open Platform sequencing) and **#6** (`OV-248-01`) remain **OPEN** from 255.
- **Phase 255 is `self-verified`, `independent_review: owed`** — it joins the `DEBT-06` set.
