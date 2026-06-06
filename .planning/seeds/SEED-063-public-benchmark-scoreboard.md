---
seed_id: SEED-063
title: Public benchmark scoreboard — root-level BENCHMARKS.md aggregating app-wide scores per release (industry/competitive credibility artifact)
status: planted
planted: 2026-06-07
phase_origin: Phase 096 planning session 2026-06-07 (operator idea during plan-phase — "show the scores of our app overall, industry/competition perspective")
category: B — builds on 096 deliverables; thin aggregation layer, near-zero risk
related_seeds: [SEED-059, SEED-020, SEED-034]
relates_to:
  - "Phase 096 D-04 capability table (`.planning/eval/capability-table-*.{json,md}`) — the per-provider data source (tool-use fidelity, workflow completion, retry counts, wall-clock); versioned artifact ships in 096 Plan 06"
  - "`scripts/eval_cross_provider.py` greppable scoreboard — pass/fail per provider per run (Deep + workflow modes after 096)"
  - "096 CONC-01 measurements — cross-tab GET p95, thread-switch reconcile time, fan-out bounds (conc_probe.py output)"
  - "096 restart-smoke matrix — harness reliability/resumability pass rate (restart_smoke.py SMOKE_ markers)"
  - "Memory: project_provider_feature_fit_routing — the v2.9 routing pass consumes the SAME capability table; scoreboard and routing are sibling consumers"
re_open_triggers:
  - v2.9 `/gsd:new-milestone` sweep (alongside the feature-fit routing pass — same data source, plan together)
  - First 096 live eval run completes — real numbers exist; a `/gsd:fast` task can seed BENCHMARKS.md v0 from actual output (don't publish promises, publish measurements)
  - Retrieval-quality eval fixtures land (SEED-059/SEED-020) — adds the "RAG accuracy" row a Glean-competitor scoreboard needs
  - Any external-facing moment (demo, pitch, README polish, open-sourcing decision) where credibility numbers matter
priority: medium — cheap, high competitive-credibility value, but data source must ship first (096)
suggested_phase: v2.9 — small phase or /gsd:fast follow-up after 096 verifies; pairs naturally with the feature-fit routing decision pass
---

# SEED-063 — Public benchmark scoreboard (BENCHMARKS.md)

## The idea

A root-level `BENCHMARKS.md` that shows the app's overall scores the way the
industry does it — one honest, versioned, reproducible scoreboard per release,
instead of internal artifacts scattered under `.planning/`.

## Industry patterns surveyed (2026-06-07)

1. **Enterprise RAG vendors (Glean, Perplexity):** capability + quality
   matrices — retrieval accuracy, answer faithfulness, latency percentiles,
   provider/model coverage. Living doc updated per release.
2. **Eval-tooling ecosystems (LangSmith, Braintrust, Ragas):** versioned eval
   dashboards — every release scored against a frozen test set; the
   release-over-release diff is the headline.
3. **OSS projects:** `BENCHMARKS.md` at repo root — table per dimension, with
   date + commit + method footnoted so numbers are reproducible and honest.

## What feeds it (all shipping in 096 — do not rebuild)

| Scoreboard row | Data source |
|---|---|
| Per-provider tool-use fidelity / workflow completion | D-04 capability table (096 Plan 06) |
| Harness reliability (restart/resume pass rate) | restart-smoke matrix (096 Plan 07) |
| Concurrency / responsiveness (GET p95, reconcile <1s, fan-out bounds) | conc_probe.py (096 Plan 07) |
| Provider matrix currency (native-7 model IDs) | D-05 curation artifact (096 Plan 08) |
| RAG retrieval accuracy | NOT YET — SEED-059/SEED-020 fixtures (the missing row) |

## Shape (v0)

- One table per dimension; every number carries date + commit + the command
  that produced it (reproducibility = honesty — same philosophy as 096's
  "CI proves structure, only live eval proves providers").
- Native-7 is the pass bar; OpenRouter recorded best-effort (D-03 carried).
- Release-over-release diff section at top ("v2.8 → v2.9: what changed").
- Never hand-edit numbers; always regenerate from eval artifacts.

## Deliberately NOT in scope

- Building new measurement infrastructure (096 builds it all)
- Public hosting / web dashboard (a markdown file first; dashboard is a later
  milestone if the SaaS story needs it)
- Marketing language — measurements only
