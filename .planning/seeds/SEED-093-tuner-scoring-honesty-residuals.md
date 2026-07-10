---
seed_id: SEED-093
title: Skill Trigger Tuner scoring/UX honesty residuals — vacuous no_false=1.0, echoed-n vs scored count, reconnect stale-skill defense-in-depth
status: planted
planted: 2026-06-24
phase_origin: "Phase 123.1 execute-phase code review (123.1-REVIEW.md WR-04/WR-05/WR-06) + adversarial verification workflow wf_bbd0b007-927 (2026-06-24)"
category: honesty / correctness hardening of the Skill Trigger Tuner scoring + run-UX — all PRE-EXISTING Phase-123 code, adversarially downgraded out of 123.1 scope
related_seeds: []
related_memories: [project_123_executed, project_123_1_planned, project_123_sketched]
related_decisions:
  - "TRIG-01 (Phase 123) tuner scoring: deterministic 60/40 per-class split + 3-repeat aggregate + pick_winner BY HELD-OUT; every cell shows BOTH fires + no-false rails (042-A)."
re_open_triggers:
  - Phase 126 (TRIG-02 smart-dispatch relevance pre-filter) or any phase that re-touches `skill_tuner_service.py` scoring (`_score_axis`/`build_cell`/`pick_winner`) — close WR-06 in the same change while the scoring semantics are already open.
  - A user reports a candidate winning on a provider/case-set where they supplied ONLY should-fire cases (no should-NOT) and the no-false rail reads a suspicious 1.0 — escalate WR-06 immediately (it is shown + persisted, not just internal).
  - A future refactor switches SkillTunerPage from unmount-on-skill-switch to an in-place A→B prop change — WR-05 becomes reachable (stale setScoreboard could land cross-skill); add the aborted-recheck guards then.
  - `StartTunerRunResponse.n` ever becomes user-rendered — fix WR-04 (echo the real scored count) before shipping that surface.
priority: low
suggested_phase: Phase 126 (TRIG-02) or a dedicated tuner-polish follow-up — decide WR-06's score semantics deliberately (it changes the displayed/persisted cell score). NOT a 123.1 blocker.
---

# SEED-093 — Skill Trigger Tuner scoring/UX honesty residuals

Three findings surfaced by the Phase-123.1 code review, **adversarially re-verified**
(workflow `wf_bbd0b007-927`, 2026-06-24) and deferred: all are PRE-EXISTING
Phase-123 code (not introduced or materially changed by 123.1), and the two most
alarming sub-claims were **refuted**. The 5 in-scope load-bearing findings (WR-07,
WR-01, CR-01, WR-02, WR-03) were fixed in 123.1; these three roll forward.

## WR-06 — vacuous `no_false = 1.0` (partial; load-bearing on honesty, winner-pick REFUTED)

`_score_axis([], expected)` returns `1.0` (`skill_tuner_service.py:380-386`). When an
author supplies a custom case set with **zero should-NOT cases**, the per-class held-out
split yields an empty no-false set, so `build_cell` reports `no_false = 1.0` — a perfect
false-fire-rail score that was **never measured** — and `score = (fires + 1.0)/2`. This
cell is shown (`EVENT_PROVIDER_DONE`) and persisted into `tuner_runs.scoreboard`, despite
`build_cell`'s docstring claiming "the false-fire rail is NEVER hidden".

- **Refuted sub-claim:** "inflates the winner pick." The `+1.0` is added **uniformly** to
  every candidate's cell (all candidates score the identical held-out set), so `pick_winner`
  (argmax of held-out mean) is **invariant** to the uniform additive constant. The winner
  SELECTION is not distorted — only the displayed/persisted number is dishonest.
- **Mitigation already present:** the default/seeded path always injects `_GENERIC_OFF_TOPIC`
  into should_not (`auto_seed_cases` + `seed_cases_with_provenance`), so the 123.1 seeded
  surface always has a real false-fire rail. The vacuous 1.0 only reaches the
  author-supplied-all-fire-cases path.
- **Fix (when re-opened):** distinguish "no signal" from "perfect" — return `None`/sentinel for
  an empty axis, exclude it from the `score` mean (score = fires alone when no_false is
  unmeasured), and render/persist it as "n/a — no should-NOT cases" rather than `1.0`.
  Touches scoring semantics + the scoreboard cell render + persistence + tests, so do it
  deliberately, not as a drive-by.

## WR-04 — echoed `n` ≠ actual scored candidate count (confirmed; not load-bearing)

`POST .../tuner/runs` echoes the requested/clamped builder-candidate count `n`
(`skill_tuner.py` response), but the actual scored set is baseline-first + capped at
`MAX_ITERATIONS=5`, so the scored count is `min(n+1, 5)`. **Not surfaced:** the frontend
never renders `StartTunerRunResponse.n` (the user-visible candidate count comes from
`scoreboard.candidates`). Cosmetic semantics mismatch. Fix only if/when `n` becomes rendered:
either drop the field or return the real planned scored count.

## WR-05 — reconnect stale-skill race (partial; cross-skill leak REFUTED)

`onTerminal`'s transient-reconnect `.then` continuations (`SkillTunerPage.tsx:251-296`)
lack an `aborted` re-check after the async `getTunerResults(skillId, ...)` resolves, so a
fetch resolving post-abort calls the setters. **Refuted sub-claim:** "reconcile for skill A
... setScoreboard after the user switched to skill B." Every skill switch goes through
`onNavigate("skills")` which **unmounts** SkillTunerPage (the only A→B path; `tunerSkillId`
changes only from the SkillsPage, which is a different `activeView`). A stale `.then` for
skill A thus lands on a **dead/unmounted** instance (React no-op) — it cannot reach skill B's
fresh mount. The only reachable variant is a same-skill same-run cancel-override (the real
scoreboard for that run briefly overriding a cancel) — not fabricated, not cross-user.
**Fix (defense-in-depth, when reachable):** add `if (controller.signal.aborted) return;`
inside both resolved `.then` bodies. Becomes necessary only if SkillTunerPage is refactored
to switch skills in place rather than unmount.
