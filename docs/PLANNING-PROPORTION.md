# Planning proportion — G-8

> **Why this file exists.** Phase 235 ran **17 plans over ~10 hours** to deliver one screen's worth
> of UI plus one table. The operator stopped it at 16.5 and said, correctly, that the ceremony was
> not proportionate to the deliverable. **The work was 4–6 plans of substance.** This file records
> what was measured, what was changed, and what must NOT be cut — so the correction survives the
> session that made it.

⚠ **`.planning/config.json` is the enforcement; this file is the reason.** Change them together.

---

## 1. What was measured at Phase 235

Every figure below is from that phase's own run, not an estimate.

| Agent / gate | Cost | What it actually caught | Verdict |
|---|---|---|---|
| `verifier` | ~26 min | ⭐ **The blocking defect** — `SENTENCE_FOR_FILE_FAILURE` written, tested and consumed by nothing; SC#1 unmet; plus two more `FAILED` gaps (a sticky Library tab, an invariant the code contradicted) | **KEEP — highest value in the whole flow** |
| `research` | ~18 min | **12 corrections to CONTEXT.md**, three of them phase-shaping: four `release_watch` seams not two; `settings.watch_process_enabled` is not "the reader is running"; the Health tab was unreachable by any external caller | **KEEP** |
| `code_review` | — | (not reached before the stop) — it is a security net, not a style pass | **KEEP** |
| `security_enforcement` | ~0 | The `<threat_model>` block per plan | **KEEP — now explicit, so it cannot drift to absent** |
| `pattern_mapper` | **~8.5 min (1.4%)** | The `studioSkillId` threading precedent quoted end-to-end; **8 stale ledger rows** | **KEEP ON** — see §1b |
| `nyquist_validation` | ~10 min | A V-01..V-20 map that largely restated what the plans already said | **OFF** |
| `plan_check` | **~7.9 min (1.3%)** | 0 blockers, 4 warnings — three paperwork, **one real** (an acceptance criterion that could never have fired) | **KEEP ON** — see §1b |
| `post_planning_gaps` | fast | `⚠ 37 of 42 items not covered` — 37 belong to *other phases* | **OFF — noise** |
| TDD RED drives | ~0 | ⭐ The fixture name hiding in a docblock · the config flag named in a comment · the hook name quoted in prose · 9 of 10 breakdown cases red before the fix | **NOW ENFORCED (`tdd_mode: true`)** |


## 1b. ⚠ CORRECTION, SAME DAY — the first cut was aimed at the wrong 3%

**The original verdicts above are struck through rather than deleted, because being wrong about
WHICH costs matter is the finding.** The operator pushed back — *"if it is a small percentage of the
time, maybe we can keep it? what is the added value?"* — and the measurement says they were right.

**Agent-time actually spent at Phase 235**, from the run's own durations:

| | agent-time | share |
|---|---|---|
| **Executors (16 plans)** | **~454 min** | **~80%** |
| planner + gap-planner | ~48 min | 8% |
| `verifier` | ~26 min | 5% |
| `research` | ~18 min | 3% |
| **`pattern_mapper` + `plan_check`** | **~16 min** | **~3%** |

⛔ **Turning those two off buys ~16 minutes of a ~10-hour run and loses real coverage.** Both are
**back ON**. `nyquist_validation` and `post_planning_gaps` stay off — the first restated the plans,
the second reported 37 of 42 items "not covered" that belong to other phases.

### ⭐ Where the time ACTUALLY went: executors running FULL gates

A backend suite run is **~7 min**; the vitest count gate **~6 min**. Plan 235-13 ran the backend
suite **three times** (~21 min). Across sixteen executors that is roughly **3.5 hours of gate runs
inside plans.**

⚠ **CLAUDE.md's own sampling rule already says targeted-per-task, full-gates-per-wave** — it simply
was not enforced, because the executor prompts did not say so. **That, not the agent roster, is the
speed lever.**

**The three levers, in order of size:**
1. **Fewer plans** (G-8) — every plan is a worktree + bootstrap + SUMMARY + merge + teardown + gates
2. **Executors run TARGETED suites only; the ORCHESTRATOR runs full gates once per wave** — ~2-3 h
3. **Cap SUMMARY length** — several ran very long, and that is model time

## 2. ⛔ The real cost driver was NOT a knob

**12 plans → 12 worktrees, 12 bootstraps, 12 SUMMARY files, 12 merges, 12 teardowns.** The overhead
is *per plan* and it dwarfed every agent toggle combined. **The entire optional-agent roster is ~3%
of a run; the executors are ~80%** (§1b) — so the toggles were never the lever. Halving the plan
count, and moving full gates out of executors and up to the wave, saves hours.

⚠ **`feedback_efficiency_calibration.md` already said this** — *"ONE PLAN PER PHASE — ceremony scales
with plan count, not risk"* — and Phase 235 ignored it at planning time. **A rule that exists and is
not applied is the same as no rule**, which is this repository's most frequently rediscovered finding.

## 3. What a plan IS

> **A plan is a WAVE-SIZED unit of work, not a task.**

If two plans would land in the same wave, touch adjacent files, and be reviewed together — they are
**one plan with two tasks**. Splitting them buys a worktree, a merge and a SUMMARY, and buys nothing
else.

**Target: 3–5 plans per phase. Above 6, justify it in CONTEXT.md by naming what genuinely cannot
share a worktree** (a migration that mutates Postgres; two agents that would edit the same file).

## 4. ⛔ What must NEVER be cut to save time

These are not ceremony. Each one caught something real that everything else missed.

1. **The verifier.** One adversarial pass found what **twelve successful plans and a green fence** all
   missed. If exactly one gate survives, it is this one.
2. **TDD RED drives.** Prove a test can fail before trusting it. Three separate defects this phase
   were caught only because an executor planted a defect and watched the fence go red.
3. **`security_enforcement` and `code_review`.** Never trade security review for speed. Set
   explicitly in config so an absent key can never be read as an absent gate.
4. **Migration discipline.** SQL editor / direct apply — **never** `supabase db push` or `db reset`.
   Unchanged, non-negotiable.
5. **The measured-baseline habit.** CLAUDE.md's own gate figures were stale for BOTH gates at this
   phase. Re-derive; never quote.

## 5. ⭐ The finding worth more than the config change

**A green fence coexisted with a shipped defect, and the fence was working as designed.**

`sourceComposition.test.tsx` asserts blocks are **present** by `data-testid`. `sources-run` and
`sources-fail-reason` were present the entire time — **rendering the wrong content**. So ROADMAP
failure mode #3 (*"the run history shows counts but not the reason a file failed"*) shipped past a
fence built specifically to prevent that class of miss.

> ⛔ **Presence assertions cannot see content drift.** A contract test that names a MISSING BLOCK is
> necessary and is not sufficient. **Assert the rendered CONTENT** wherever the words are the
> deliverable — and say so in the suite, so the next author does not re-derive it.

This is the sketch-218 lesson one turn deeper: 218 asserted vocabulary and no composition; 235
asserted composition and no content.

## 6. Standing routing (unchanged, now actually applied)

- **≤ 1 file, ≤ 10 lines, no schema/API surface** → `/gsd:fast` (inline, no agents)
- **Small but wants a commit + state** → `/gsd:quick`
- **Full phase** → the flow above, capped at 3–5 plans

`workflow.inline_plan_threshold: 4` encodes the cap; **G-3 in CLAUDE.md already required the first
two and was not applied.**

---

*Written 2026-09-06 at Phase 235's stop, from that phase's own measurements.*
*Enforcement: `.planning/config.json`. Rule: CLAUDE.md § Workflow guardrails, G-8.*
