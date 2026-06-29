# Phase 133: Eval Runner — With-Skill vs Without-Skill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 133-eval-runner-with-skill-vs-without-skill
**Areas discussed:** Provider scope per run, What "with-skill" injects, What "without-skill" means, Live progress + run lifecycle, UI scope

---

## Provider scope per run

| Option | Description | Selected |
|--------|-------------|----------|
| One provider per run (pick at launch) | Single provider/model selected at launch; compare via separate runs; results stay provider-keyed | ✓ |
| Multi-provider fan-out in one run | One run executes every case on every ticked provider; richest but cost = #providers × 2 × N | |
| Default to the skill's / chat's current model | No picker; uses current chat model; can't deliberately eval a specific provider | |

**User's choice:** One provider per run (pick at launch)
**Notes:** Result schema stays provider-keyed so multi-provider fan-out is a later additive change (D-02).

---

## What "with-skill" injects (SEED-002)

| Option | Description | Selected |
|--------|-------------|----------|
| Target skill only | Inject just the evaluated skill; with/without delta is purely this skill; cheaper, honest A/B | ✓ |
| Full catalog (production-realistic) | Inject whole enabled catalog like a real chat; realistic but noisier attribution; higher cost | |

**User's choice:** Target skill only
**Notes:** Resolves the SEED-002 catalog-injection-cost pre-work note.

---

## What "without-skill" means

| Option | Description | Selected |
|--------|-------------|----------|
| No skills at all (clean A/B) | Empty catalog (explorer-mode lever); only variable across arms is the target skill | ✓ |
| Full catalog minus the target skill | Every other enabled skill but not target; mismatched against target-only with-arm | |

**User's choice:** No skills at all (clean A/B)
**Notes:** Pairs with target-only with-arm for a single-variable comparison.

---

## Live progress + run lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Per-case/variant status + text-on-complete | Stream status transitions + drop full output when each arm finishes; lighter SSE | ✓ |
| Full token streaming per completion | Stream every completion's tokens live for both arms; richest but heavy/overwhelming | |
| Persist-per-case, reattach on reload, no server-crash resume | Persist each result on completion; reload reattaches to live run; backend death → interrupted + partials readable; no new worker infra | ✓ |
| Fully resumable runs | Restarted backend finishes remaining cases; needs durable job/worker model | |

**User's choice:** Per-case/variant status + text-on-complete; Persist-per-case + reattach, no server-crash resume
**Notes:** Both reuse the existing chat-run SSE + reattach model.

---

## UI scope

| Option | Description | Selected |
|--------|-------------|----------|
| Thin functional surface now, design in 137 | Minimal non-designed run control + live progress + plain results; --skip-ui; mirrors Phase 132 | ✓ |
| Design the run UI now | Polished surface this phase; trips G-2 sketch-before-plan; pulls Phase 137 forward | |

**User's choice:** Thin functional surface now, design in 137
**Notes:** Designed Skill Evals panel stays Phase 137 (PANEL-01, G-2).

---

## Claude's Discretion

- Threadless vs throwaway-thread execution of an eval completion through the thread-keyed `run_agent_loop`.
- Sequential vs concurrent execution of the two arms per case.
- Exact `eval_runs` / `eval_results` columns, status enums, SSE event type names, endpoint shapes.
- Provider/model picker UI specifics in the thin surface.

## Deferred Ideas

- Multi-provider fan-out in one run → later additive (results already provider-keyed).
- Full token-by-token streaming of completions → only if per-case status feels insufficient.
- Fully resumable runs (server-crash auto-resume) → v3.3+.
- Per-provider verdict + side-by-side comparison + ratings → Phase 134 (EVAL-03/04).
- Designed Skill Evals panel → Phase 137 (PANEL-01, G-2).
