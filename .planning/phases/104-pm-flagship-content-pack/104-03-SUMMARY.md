---
phase: 104-pm-flagship-content-pack
plan: 03
subsystem: validation
tags: [cross-provider, scoreboard, sc10, validation, human-uat, kickoff-harness, opt-in, pm-pack, segmented]

# Dependency graph
requires:
  - phase: 104-02
    provides: "the 2 published 2-phase fill defs (pm-weekly-status-report / pm-risk-register) + pm_pack_ids.json (the def ids + demo folder the harness + runbook consume)"
  - phase: 104-01
    provides: "the docxtpl templates + the synthetic 'Project Meridian' PM Demo corpus the headline run cites"
  - phase: 103
    provides: "the Workflows page (describe->draft->refine->publish + Tweak->v(N+1) fork) the Charter author-proof + the live publish gauntlet drive; the strict=False authoring override the OpenAI/DeepSeek rows confirm"
  - phase: 102
    provides: "the publish gauntlet (real golden run + judge HARD wall) + the citations_required/output_file_valid gates the runbook asserts; the immutability trigger UAT-4 psql-confirms"
provides:
  - "scripts/pm-pack/scoreboard_smoke.py — an OPT-IN (--run / PM_SCOREBOARD_RUN=1) cross-provider kickoff harness: per pinned EXACT registry id, kicks off the seeded Status def via the shipped POST /threads/{id}/messages + workflow_definition_id path and captures the per-model outcome (produced .docx / citation+integrity gates / truncation / honest_failure vs narrated_text) to scripts/pm-pack/out/scoreboard-*.json. Pure client — NO backend write paths."
  - "104-VALIDATION.md FINALIZED — per-task map confirmed complete (all 6 Wave-1/2 ids), SC#10 4-axis scoreboard authored with exact PascalCase ids + the MiniMax watch + the Charter NL-auth row + the long-deliverable truncation row + an optional case-miss negative control, nyquist_compliant: true, sign-off completed."
  - "104-HUMAN-UAT.md — the live UAT runbook (5 sections): SC#2 headline + citation red-case, SC#1/SC#3 Charter author proof, SC#3+QUAL-01 Tweak->v2 live publish gauntlet + v1 immutability, SC#10 cross-provider scoreboard."
affects: [104-verification, pm-flagship-scoreboard, 104-Task3-human-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in cross-provider kickoff harness: reuse the conc_probe.py five-piece plumbing kit by import (load_env -> assert_localhost_only FIRST -> report_env_presence -> get_bearer_token -> connect_db) + create_thread/kickoff_workflow/_fetch helpers — the same way longmsg_workflow_smoke.py reuses it (096-PATTERNS.md Assignment 6: copy the kit, never hand-roll, never touch backend)"
    - "Default-SAFE provider-spend gate: the harness is PREVIEW-ONLY unless --run/PM_SCOREBOARD_RUN=1 — it lists the model matrix it WOULD drive and exits 0, never firing a provider call or even a DB connection (the executor verifies it via ast.parse, which never auto-fires)"
    - "Honesty-outcome classification from DB truth: produced_file vs honest_failure vs narrated_text (the COERCE/false-green trap = terminal 'completed' with NO .docx) — a FORCE-tier row passes only on a cited integrity-clean .docx; a narrated_text:true is always a FAIL (T-104-03-01)"
    - "EXACT registry model IDs as a load-bearing invariant: a wrong-case id (minimax-m3 vs MiniMax-M3) silently degrades to coerce (forced_emit.py:246 default-safe miss) — the pinned defaults are case-correct and tier-tagged, with a --models case-mismatch warning + an optional case-miss negative-control row"

key-files:
  created:
    - "scripts/pm-pack/scoreboard_smoke.py"
    - ".planning/phases/104-pm-flagship-content-pack/104-HUMAN-UAT.md"
  modified:
    - ".planning/phases/104-pm-flagship-content-pack/104-VALIDATION.md"

key-decisions:
  - "The harness REUSES conc_probe.py's kit by import (not eval_cross_provider.py's) — conc_probe's kit is the workflow-kickoff superset (kickoff_workflow passes workflow_definition_id + model; resolve_definition/resolve_workflow_run_id/workflow_status read DB truth) that longmsg_workflow_smoke.py already imports; eval_cross_provider's run_workflow_kickoff deliberately omits the model field (its Pitfall 1), which the scoreboard NEEDS to steer the per-tier model."
  - "Default = PREVIEW (no provider spend, no DB connection); --run is the opt-in. This satisfies the critical constraint (NEVER auto-fire expensive cross-provider calls during execution) AND the T-104-03-02 disposition (opt-in gating is the accepted control). The executor verified ONLY via ast.parse + a safe preview run."
  - "The SC#10 scoreboard scaffold was ALREADY filled with the exact PascalCase ids at planning time — this plan CONFIRMED them (all 7 present + the MiniMax watch) and ADDED an artifact-source note + an optional case-miss negative-control row (the RESEARCH 'wrong-case control demonstrates the coerce degrade'); it did NOT re-author the rows."
  - "STATE.md / ROADMAP.md were left UNTOUCHED by the executor (the orchestrator owns those writes per the sequential-executor contract — avoids the STATE.md re-stamping balloon bug)."

requirements-completed: [PM-01]

# Metrics
duration: 6min
completed: 2026-06-15
---

# Phase 104 Plan 03: PM Flagship Content Pack — Live Proof Orchestration Summary (Tasks 1+2; Task 3 PENDING)

**The cross-provider kickoff harness + the finalized SC#10 Nyquist contract + the live UAT runbook — the automatable backbone and the operator runbook for PM-01's three Success Criteria (SC#2 headline cited `.docx`, SC#1/SC#3 Charter author proof + Tweak->v(N+1) publish gauntlet, SC#10 4-axis cross-provider scoreboard). This plan is SEGMENTED (Pattern B): Tasks 1+2 (`type: auto`) are COMPLETE and committed here; Task 3 (`checkpoint:human-verify` — the live UAT) is PENDING, left for the orchestrator's human-verify gate. ZERO engine code, ZERO route, ZERO migration; the harness is a pure client that drives the shipped kickoff/publish/authoring surfaces.**

## Segmentation note (why Task 3 is not here)

`104-03-PLAN.md` is `autonomous: false` because it CONTAINS a `checkpoint:human-verify` task (the repo convention the structure validator enforces). Per execute-plan's Pattern B routing, the autonomous tasks (1, 2) run in the executor subagent and the human-verify checkpoint (3) runs in main. This executor was spawned to run **ONLY Tasks 1 and 2** and STOP. **Task 3 (the live UAT — SC#2 headline + SC#1/SC#3 author proofs + SC#10 scoreboard) is PENDING and was NOT executed** — it awaits the operator-driven human-verify gate (see `104-HUMAN-UAT.md`).

## Performance

- **Duration:** ~6 min (autonomous Tasks 1+2)
- **Started:** 2026-06-14T20:19:29Z
- **Completed:** 2026-06-14T20:25:24Z (Tasks 1+2 committed)
- **Tasks executed:** 2 of 3 (Task 3 = human-verify, PENDING by design)
- **Files:** 2 created (harness, runbook); 1 modified (VALIDATION.md)

## Accomplishments

### Task 1 — cross-provider kickoff harness + VALIDATION finalize (commit `23e3c117`)

- Wrote `scripts/pm-pack/scoreboard_smoke.py` (531 lines). It **reuses `conc_probe.py`'s five-piece plumbing kit by import** (`load_env` -> `assert_localhost_only` FIRST -> `report_env_presence` presence-only -> `get_bearer_token` -> `connect_db`) plus `create_thread` / `kickoff_workflow` (which posts `workflow_definition_id` + `model`) / `resolve_definition` / `resolve_workflow_run_id` / `workflow_status` / `_fetchall` — the exact path `longmsg_workflow_smoke.py` reuses. NO backend `app.*` import; NO hand-rolled auth/DB plumbing.
- **Opt-in gated (T-104-03-02):** PREVIEW-ONLY by default — without `--run` (or `PM_SCOREBOARD_RUN=1`) it lists the model matrix it WOULD drive and exits 0, firing NO provider call and NOT even opening a DB connection. The live sweep is the explicit opt-in.
- For each pinned EXACT registry id (tier-tagged: FORCE+strict `gpt-5.4`/`deepseek-v4-pro`; FORCE `claude-opus-4-8`/`gemini-2.5-pro`/`MiniMax-M3`/`glm-4.6`; COERCE `kimi-k2.6`), it reads the Status `def_id` from `pm_pack_ids.json` (live-slug fallback), kicks off via `POST /threads` -> `POST /threads/{id}/messages` with `{content, workflow_definition_id, provider, model}`, polls `workflow_runs.status` to terminal, and captures the outcome from DB truth (`workflow_phases.output`, `harness_audit`, `workspace_files`): `{model, tier, run_id, terminal_state, produced_file, citation_gate, integrity_gate, truncated, honest_failure, narrated_text}` to `scripts/pm-pack/out/scoreboard-<timestamp>.json`.
- **Honesty classification:** distinguishes `produced_file` (FORCE-tier success bar), `honest_failure` (non-completion or a truncation guard fire with no half-emit), and `narrated_text` (the COERCE/false-green trap — terminal `completed` but NO `.docx`). A FORCE-tier row passes only on a cited, integrity-clean `.docx`; a `narrated_text:true` is ALWAYS a FAIL (T-104-03-01).
- Flags the MiniMax row with the `minimax-m3-invalid-tool-args-400` watch; warns on a `--models` case mismatch.
- **Finalized `104-VALIDATION.md`** (NARROW finalize, not a re-author): confirmed the per-task map already carries all 6 Wave-1/2 ids (104-01-01..104-02-03); confirmed the quick-run runtime (~5-15s — Plan 02 ran `test_seed_pm_pack.py` at 4 passed in 4.14s with the live stack); confirmed the SC#10 scaffold already holds the 7 exact PascalCase ids + the MiniMax watch, added the harness-artifact-source note + an optional case-miss negative-control row; set `nyquist_compliant: true`; flipped the 104-03-01/02 rows to green; completed the Validation Sign-Off.

### Task 2 — live UAT runbook (commit `6e42cfd3`)

- Wrote `.planning/phases/104-pm-flagship-content-pack/104-HUMAN-UAT.md` mirroring `103-HUMAN-UAT.md`, with 5 UAT sections + a pre-req checklist (seed run with `SEED_PM_RUN_INGEST=1`, `pm_pack_ids.json`, embedding + provider keys, app at `http://localhost:5173/` login `fhdmrd@gmail.com`/`123456`, backend up):
  - **UAT-1 SC#2 headline:** kick off the seeded Status def (Run modal OR `scoreboard_smoke.py --run --models gpt-5.4`) -> cited integrity-checked `.docx`; download + **opens-clean-in-a-real-editor** with cited non-null Project-Meridian values (the spike's strongest evidence bar).
  - **UAT-2 SC#2 citation red-case:** empty-scope / invent-tempting prompt -> a VISIBLE honest-fail naming the gate, NEVER a silent invented `.docx`.
  - **UAT-3 SC#1/SC#3 Charter author proof:** describe->draft->refine->publish a TEXT Charter (no template; final phase `llm_single`/`llm_agent`, NOT `render_template`) on OpenAI `gpt-5.4` + DeepSeek `deepseek-v4-pro` confirming the Phase-103 `strict=False` avoids a 400.
  - **UAT-4 SC#3+QUAL-01:** Tweak the seeded Status def -> v2 DRAFT (new id, same slug, version 2) -> drive `POST /workflows/{id}/publish` (real golden run + judge HARD wall) -> flips published; **psql-confirm v1 UNCHANGED (immutability) + v2 exists**; repeat the publish fork on the Risk Register.
  - **UAT-5 SC#10 scoreboard:** `scoreboard_smoke.py --run` across the pinned tier ids + a `--long` truncation row + the parallel-thread axis; fill 104-VALIDATION.md from the artifact; FORCE-tier clean cited `.docx`, COERCE honest-fail-or-coerce (no silent narration), long-deliverable `is_truncated` honest fail, parallel-thread holds; EXACT PascalCase ids + the MiniMax watch.
  - Each row: steps, expected observable, pass/fail, evidence (run_id / downloaded-file path / psql read-back).

## Task Commits

| # | Task | Type | Commit |
|---|------|------|--------|
| 1 | Cross-provider harness + finalize VALIDATION (SC#10, nyquist true) | feat | `23e3c117` |
| 2 | Live UAT runbook (104-HUMAN-UAT.md) | docs | `6e42cfd3` |
| 3 | Run the live UAT (SC#2 + SC#1/SC#3 + SC#10) | checkpoint:human-verify | **PENDING — not executed (operator-driven gate)** |

## Verify Results

| Task | Command | Result |
|---|---|---|
| 1 (harness) | `python -c "import ast; ast.parse(open('scripts/pm-pack/scoreboard_smoke.py').read())"` | **PASS** — `harness parses ok` |
| 1 (preview safety) | `scoreboard_smoke.py` (no `--run`) | **PASS** — preview-only, exit 0, NO provider/DB call, NO `out/` dir created |
| 1 (VALIDATION) | full plan verify (MiniMax-M3 + nyquist true + all 6 per-task ids) | **PASS** — `VALIDATION finalized: per-task map complete + SC#10 rows + nyquist true` |
| 2 (runbook) | `grep UAT-1 && grep Tweak && grep kimi-k2.6` | **PASS** — `UAT runbook authored` (5 UAT sections; all tier ids + is_truncated + parallel-thread + immutability + narrated_text present) |

## Constraint compliance

- **NO `backend/app/**` modified; NO migration; NO new route.** `git diff --name-only HEAD~2 HEAD` = exactly the 3 contracted files; the `backend/app|migrations|STATE.md|ROADMAP.md` grep = NONE.
- **STATE.md + ROADMAP.md UNTOUCHED** — the orchestrator owns those writes (sequential-executor contract; STATE.md re-stamping bug avoided).
- **The scoreboard was NOT run live** — only `ast.parse` + a safe PREVIEW invocation (which fires nothing). The opt-in gate (`--run` / `PM_SCOREBOARD_RUN=1`) is closed by default; the live sweep runs at the Task 3 human-verify gate.
- **Per-task atomic commits** with conventional-commit scope `104-03`, hooks enabled (no `--no-verify`).

## Deviations from Plan

### Auto-fixed / clarifications (no Rule-4 architectural changes)

**1. [Rule 3 - Blocking-resolution] Kit choice — import conc_probe.py, not eval_cross_provider.py.**
- **Found during:** Task 1 (selecting the canonical plumbing to reuse).
- **Detail:** The plan named both `longmsg_workflow_smoke.py` and `eval_cross_provider.py` as analogs. `longmsg_workflow_smoke.py` itself imports `conc_probe.py` for the five-piece kit + `kickoff_workflow` (which posts `workflow_definition_id` AND `model`). `eval_cross_provider.py`'s `run_workflow_kickoff` deliberately OMITS the `model` field (its Pitfall 1 — body.model doesn't steer harness phases there). The scoreboard NEEDS to steer the per-tier model, so it reuses `conc_probe.py`'s `kickoff_workflow` (the workflow-kickoff superset) — the same import path `longmsg_workflow_smoke.py` uses. Not a behavior change to either file; a reuse choice.
- **Files:** none modified beyond the new harness.

**2. [Rule 2 - Additive] Added an optional case-miss negative-control scoreboard row.**
- **Found during:** Task 1 Part B (mapping RESEARCH §Validation Architecture failure modes to coverage).
- **Detail:** RESEARCH §Validation Architecture lists "GLM/MiniMax case-miss silent coerce — a wrong-case control row demonstrates the coerce degrade" as a critical failure mode. The scaffold had the positive (exact-id) rows but no negative control. Added a clearly-labeled OPTIONAL negative-control row (run a deliberately wrong-case id, observe the coerce degrade) — NOT a pass/fail gate, a documented control that proves the exact-PascalCase rows are load-bearing.
- **Files:** `104-VALIDATION.md` (committed with Task 1, `23e3c117`).

## Known Stubs

None. The harness is a real client (it drives the live kickoff path when `--run` is passed); the PREVIEW default is an intentional, documented opt-in gate (T-104-03-02), not a stub. The `scripts/pm-pack/out/` directory is created on first real run (no empty artifact committed). The 104-VALIDATION.md SC#10 scoreboard table is INTENTIONALLY unfilled-with-results until the Task 3 human-verify gate runs `scoreboard_smoke.py --run` (the runs are operator-driven by design — RESEARCH §6 + the UAT recipe; long-message stays manual per provider).

## Threat Flags

None. The harness introduces NO new network endpoint, auth path, or schema surface — it is a pure client that authenticates as the demo user via the existing Supabase password grant and posts to the shipped `POST /threads` / `POST /threads/{id}/messages` routes (inheriting the run path's RLS/scope binding). The STRIDE register's dispositions hold: T-104-03-01 (scoreboard false-green) is mitigated by the `narrated_text`/`honest_failure` distinction + the exact registry ids + the UAT-5 acceptance bar; T-104-03-02 (provider spend) is the accepted opt-in-gated cost; T-104-03-03/-04 (judge bypass / v1 mutation) are engine-side controls the UAT-4 runbook exercises live.

## Next Phase Readiness (Task 3 hand-off)

- **Task 3 = the `checkpoint:human-verify` live UAT, PENDING.** The orchestrator runs `104-HUMAN-UAT.md` against the live app: SC#2 headline + citation red-case, SC#1/SC#3 Charter author proof, SC#3+QUAL-01 Tweak->v2 live publish gauntlet + v1 immutability, SC#10 cross-provider scoreboard (`scoreboard_smoke.py --run`).
- **Pre-req for Task 3:** the seed must run with `SEED_PM_RUN_INGEST=1` (embed the corpus) so the headline run can actually retrieve + fill — otherwise the citation gate honest-fails on an empty scope.
- The harness is ready (`--run`), the SC#10 scoreboard table is ready to fill from `scripts/pm-pack/out/scoreboard-*.json`, and the runbook carries the exact tier ids + evidence fields.
- The resume signal for the checkpoint is "approved" once all 5 UAT rows pass (or the failures route to a 104 gap-closure plan).

## Self-Check: PASSED

- Files: `scripts/pm-pack/scoreboard_smoke.py` FOUND; `.planning/phases/104-pm-flagship-content-pack/104-HUMAN-UAT.md` FOUND; `.planning/phases/104-pm-flagship-content-pack/104-VALIDATION.md` FOUND (modified, `nyquist_compliant: true`).
- Commits: `23e3c117` FOUND; `6e42cfd3` FOUND.
- Both task `<verify>` commands pass (Task 1 ast.parse + the full SC#10/nyquist/per-task-id loop; Task 2 the UAT-1/Tweak/kimi-k2.6 grep).
- No `backend/app/**`, no migration, no route; STATE.md + ROADMAP.md untouched (`git diff --name-only HEAD~2 HEAD` = exactly 3 contracted files).
- Task 3 (human-verify) correctly NOT executed — left for the operator-driven gate.

---
*Phase: 104-pm-flagship-content-pack · Plan: 03 (Tasks 1+2 of 3; Task 3 = human-verify, PENDING)*
*Completed: 2026-06-15*
