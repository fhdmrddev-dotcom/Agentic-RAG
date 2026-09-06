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
| `pattern_mapper` | ~8 min, 1765 L | Real, well-anchored excerpts — but every executor re-reads the same files anyway with its own fresh context | **OFF** |
| `nyquist_validation` | ~10 min | A V-01..V-20 map that largely restated what the plans already said | **OFF** |
| `plan_check` | ~8 min | 0 blockers, 4 warnings — **three were paperwork** (a heading suffix, an unchecked box, a wave-grouping nit). One was real. | **OFF** — the verifier catches more, later, against real code |
| `post_planning_gaps` | fast | `⚠ 37 of 42 items not covered` — 37 belong to *other phases* | **OFF — noise** |
| TDD RED drives | ~0 | ⭐ The fixture name hiding in a docblock · the config flag named in a comment · the hook name quoted in prose · 9 of 10 breakdown cases red before the fix | **NOW ENFORCED (`tdd_mode: true`)** |

## 2. ⛔ The real cost driver was NOT a knob

**12 plans → 12 worktrees, 12 bootstraps, 12 SUMMARY files, 12 merges, 12 teardowns.** The overhead
is *per plan* and it dwarfed every agent toggle combined. Turning off three agents saves ~26 minutes;
halving the plan count saves hours.

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
