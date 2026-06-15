# `.planning/eval/` — cross-provider capability tables (D-04)

Versioned, git-committed artifacts emitted by the live cross-provider eval
(`scripts/eval_cross_provider.py`). The scoreboard the script prints is
ephemeral stdout; these files are the durable, diffable record the v2.9
feature-fit routing pass consumes.

**Measurement only (D-04 locked):** nothing in the app reads these files at
runtime, and the eval adds NO routing logic. Acting on the measurements
(per-feature provider routing) is explicitly deferred to a v2.9 decision pass
that reads the diffs across dated tables.

## Emit trigger

A FULL `--workflow` run (no `--provider` filter) writes both artifacts:

```bash
backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --workflow
```

- `capability-table-<YYYY-MM-DD>.json` — machine-diffable, one object per provider
- `capability-table-<YYYY-MM-DD>.md` — the same data as a human-readable table

Partial runs (`--workflow --provider openai`) print the scoreboard but do NOT
write the table — a one-off single-provider re-run must never clobber a full
table from the same day. Re-running the full matrix on the same date overwrites
that date's files (latest full run wins; git history keeps the prior state).

## JSON schema (one object per provider)

```json
{
  "provider": "openai",
  "model_effective": "gpt-4o",
  "workflow_completed": true,
  "phase_type_results": {
    "programmatic": "completed",
    "llm_batch_agents": "completed",
    "llm_agent": "completed",
    "llm_human_input": "completed",
    "llm_single": "completed"
  },
  "tool_invocation_fidelity": true,
  "arg_shape_ok": null,
  "retry_count": 0,
  "gate_failures": 0,
  "wall_clock_s": 54.5,
  "ask_user_roundtrip_ok": true,
  "outcome": "completed",
  "gated": true
}
```

Field notes:

| Field | Meaning |
|---|---|
| `provider` | Provider key (native-7 + openrouter) |
| `model_effective` | The model the SUB-AGENT `runs.model` rows actually recorded — NEVER the eval's requested model (Pitfall 1: `body.model` does not steer harness phases; the per-provider defaults table in `config.py` decides) |
| `workflow_completed` | `workflow_runs.status == 'completed'` |
| `phase_type_results` | phase-type → `workflow_phases.status`, derived from the published `eval_coverage` definition at runtime (covers all 5 phase types) |
| `tool_invocation_fidelity` | ≥1 `search_documents` round-trip proven from durable rows (thread `messages.tool_calls` OR grounding harvested into `workflow_phases.output.source_refs`) |
| `arg_shape_ok` | `null` for workflow rows in v2.8 — harness sub-agent transcripts are in-memory (tool args never persisted); kept for schema stability. The Deep-mode matrix (`--prompt multi-tool`) measures arg shape |
| `retry_count` | `gate_failed` audit rows beyond the first attempt (`metadata.attempt > 1`) — a measurement-only proxy that under-counts pass-after-retry |
| `gate_failures` | Count of `gate_failed` `harness_audit` events for the run |
| `wall_clock_s` | Kickoff → terminal wall clock per row |
| `ask_user_roundtrip_ok` | The D-02a robot answer was accepted (200) AND the run proceeded past the `llm_human_input` phase |
| `outcome` | Diagnostic: `completed` / `failed` / `timeout` / `missing_api_key` / `terminal_before_answer` (Pitfall 2 — terminal before the robot answer landed) / `no_workflow_run` |
| `gated` | D-03: `true` for native-7 (pass/fail bar); `false` for openrouter (best-effort, never gating) |

## The grep ritual (operator live gate — D-01 part 2)

MANDATORY GATE for phase closure on any provider-touching phase (same standing
as the 4-axis UAT recipe):

1. Run the full eval: `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --workflow`
2. Extract the scoreboard: `... --workflow | grep EVAL_ROW` (and `grep EVAL_SUMMARY`)
3. Diff against the prior table: `git diff -- .planning/eval/` (or compare the
   two dated JSON files directly)
4. Attach the scoreboard + the dated table to the phase's VALIDATION evidence

Localhost-only by design (`assert_localhost_only()` hard-gates before any
DB/HTTP work); provider keys never leave `backend/.env`; presence-only env
reporting; no CI secrets (D-01 — CI proves structure with a fake gateway,
ONLY the operator's live eval proves providers).

## v2.9 consumer

The feature-fit routing decision pass (v2.9, per D-04 and
`project_provider_feature_fit_routing`) reads the diffs across dated capability
tables to decide which provider serves which feature best. Until that pass
ships, these tables are evidence, not configuration — do not wire any runtime
behavior to them.
