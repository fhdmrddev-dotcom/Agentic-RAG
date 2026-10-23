# Phase 295: Runs That Don't Dead-End - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 295-runs-that-don-t-dead-end
**Mode:** `--auto` (operator: "proceed autonomously end to end"). No AskUserQuestion was used. Every selection is the recommended option, chosen from code evidence gathered by two read-only scouts.
**Areas discussed:** The found-nothing pause, Continue-unsourced marking, Missing-template refusal, Judge and recorded-not-sent, Truthful run ends, Folding bugs/seeds, Guardrails

---

## The found-nothing pause (RUN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Flip the engine gate's default to `ask_user` | One-line change; reuses the in-process validator ask | |
| Durable pause, the human-step kind, with three server-built choices | `pause_run` + re-drive; never fails on an unanswered window | ✓ |
| New phase type for "review sources" | Engine change, breaks the closed core | |

**[auto] Selected:** a durable pause (D-01/D-02).
**Notes:** The scout measured that the in-process ask offers only Proceed/Abort. Proceed leaves no mark, and an unanswered ask fails the run. Each of those is a named roadmap failure mode, so the one-line flip is refuted.

## Search another folder (RUN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Any folder the person can read | Simple; can widen the run's scope beyond the author's subtree | |
| Folders the run's existing scope rule permits; hidden if none | Re-uses `resolve_run_scope_root` owner gate | ✓ |

**[auto] Selected:** bounded by the existing rule (D-03).

## Continue-unsourced (RUN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Accept the output (today's Proceed) | Silent pass | |
| One optional `unsourced` output field, shown on step, evidence page, receipt and downstream input | 289 D-08 pattern | ✓ |

**[auto] Selected:** the optional field (D-04). A locked step (escalated / already-set) never offers it, and a forged continue is refused (D-05).

## Missing-template refusal (RUN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Hard refusal at save and publish | Literal SC#2; breaks draft autosave (288 AUTH-03) | |
| Lint code: refused at publish and at run start, named warning at save | Keeps autosave; drafts cannot fail at run time | ✓ |
| Publish only | The roadmap names this as a failure mode | |

**[auto] Selected:** lint plus run-start refusal plus save warning (D-12/D-13). The SC interpretation is recorded for the verifier.

## Judge and recorded-not-sent (RUN-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Lower the judge threshold / skip the judge for external_action | Loosens it for every workflow | |
| A fixed note in `_judge_graded_text`, only when output carries `recorded_intent` | Byte-identical input otherwise | ✓ |

**[auto] Selected:** a keyed note (D-15/D-16). SEED-360 F-2 is reproduced first, and its sibling note is written only if the cause is the auto-answered step (D-17).

## Truthful run ends (RUN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| New `waiting` run status (migration) | Wider surface | |
| Engine-owned asks become durable `paused`; existing waiting tone | No new status | ✓ |
| Hide stuck runs in the UI | The roadmap names this as a failure mode | |
| Backfill reasons for historical failed runs | Invents data | |

**[auto] Selected:** `paused` for waits (D-18), cancel reads cancelled (D-19), finalise on every exit path (D-20), a reconciler sweep (D-21), and "No reason was recorded" wording instead of a backfill (D-22).

## Folding bugs and seeds

| Item | Decision |
|------|----------|
| BUG-261020-01 (answer never reaches next step) | Folded (roadmap's first candidate): D-10 |
| BUG-261015-01 (repeated emit failure messages) | Folded (its re_open_trigger fired): D-23 |
| SEED-360 F-2 (judge blocks pause workflow) | Folded into RUN-03: D-17 |
| BUG-261020-02 (evidence privacy) | Left open, re_open_trigger written |
| BUG-260828-05 (receipt names SMTP host) | Left open, re_open_trigger written |
| SEED-360 F-4 | Left |
| Todo `spike-nl-workflow-authoring` (score 0.6) | Not folded. A keyword match only, already routed to Phase 152. This overrides the auto-fold rule (≥ 0.4) on the scope guardrail. |

## Guardrails

- G-2 sketch: **skipped, audited** (operator away; 288 D-13 precedent). The pause reuses `PendingAskCard` and 289 evidence-line vocabulary.
- G-5: `harness_engine.py` fires (seam owed). One touch per hot file, claimed arithmetically. If the durable pause needs more than one helper, take the seam first.
- G-8: 5 plans suggested.

## Claude's Discretion

- Pause prompt and choice wording, within the plain-language rule.
- Where the per-run folder override is stored (phase row vs run inputs).

## Deferred Ideas

- SEED-295 branching/loops; SEED-360 F-4; a hard save refusal for a missing template; a `waiting` status; reason backfill.
