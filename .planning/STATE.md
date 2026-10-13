---
gsd_state_version: 1.0
milestone: v4.6
milestone_name: Pay It Down
status: executing
last_updated: "2026-10-13T15:15:53.102Z"
last_activity: 2026-10-13 -- Phase 279 execution started
progress:
  total_phases: 14
  completed_phases: 2
  total_plans: 10
  completed_plans: 6
  percent: 14
---

# Project State

> ⚠ **This file was RESET at the v4.5 close (2026-10-12)** — the eighth reset, same reason each time.
> **Nothing was deleted:** the full pre-close file (315 lines) is archived verbatim at
> [`.planning/milestones/v4.5-STATE-at-close.md`](milestones/v4.5-STATE-at-close.md), including every
> per-phase position entry, the v4.5 guardrail overrides (OV-271-01, OV-273-01..05) and the post-close
> deploy table.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs or `milestone.complete`.** The v4.5
> close was done by hand for that reason (eight prior false-record occurrences, see the v4.2 archive).

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-12)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** Phase 279 — the-expert-scope-seam

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Milestone close (2026-10-12)

**v4.5 Find It, Show It COMPLETED by hand** (not `milestone.complete`): archives in
`.planning/milestones/v4.5-*` (ROADMAP, REQUIREMENTS, MILESTONE-AUDIT, STATE-at-close, phases/),
tag `v4.5` (local, not pushed), 25/25 requirements, audit `tech_debt`, no blockers. Integration 8/8
seams, flows 3/3. Closed core 7 phase types / 1 emitter / **30 tools** (+`show_artifact`, recorded).

---

## Current Position

Milestone: **v4.6 Pay It Down** (started 2026-10-12)
Phase: 279 (the-expert-scope-seam) — EXECUTING
Next: **279** (The Expert Scope Seam) — context gathered 2026-10-13 (`79a0b9afe`, `279-CONTEXT.md` D-01..D-14): 3-part split of `expert_scope.py` (pure / statement / events, repoint, 278 pure-move kit); all 16 SEED-328 items measured still open — fix all small ones, IN-02 + CR-01 gateway test recorded not-fixed; WR-04 reworded to "Won't search", WR-05 quoted background; 4 G-4 Chrome scenarios + two-org CR-03(b) drive. Seeds: 328 folded; 327/320/067 deferred; 303 note. Resume: `/gsd:plan-phase 279`.
Plan: 2 of 4 (279-01 COMPLETE 2026-10-13 — move commit `fa164ef3e`; next 279-02, then 279-03, then 279-04)
Status: Executing Phase 279
Last activity: 2026-10-13 -- 279-01 complete: pins `a90dde594`, checker `24ed4131a`, pure move `fa164ef3e`

**279-01 (2026-10-13):** `expert_scope.py` split into pure (143 lines, no `app.` import) /
`expert_scope_statement.py` / `expert_scope_events.py`, AST-identical to `a5a94ba67`, no shim, 0 fixture
bytes changed; checker CLEAR in both modes; root-level set equal (35/35); backend gate 71 failed, SET ==
`279-base-failed.txt`. Measured surprise: model docstrings are OpenAPI descriptions, so the move commit
also regenerated `docs/public/api/openapi.{snapshot,public}.json`. 279-02 owns: `RETIRED` entries
(D-07, WR-08) and removing the 8 strict-xfail markers in `test_279_org_helper.py`.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261012-x1l | fix 277-REVIEW WR-01 (size hook leads with STOP/WARNING when ledger findings exist) + WR-08 (uniform `· ⛔` marker on 66 moved FIRING cells + legend) | 2026-10-12 | 30d659415 | [261012-x1l-fix-review-warnings-wr-01-and-wr-08-from](./quick/261012-x1l-fix-review-warnings-wr-01-and-wr-08-from/) |
| fast 2026-10-13 | landing drift: `facts.ts` BUILTIN_TOOL_COUNT 29 → 30 (+ `Artifacts` group for `show_artifact`); landing vitest 53/53 | 2026-10-13 | 6ba316b6a | — |

### Owed to the operator (carried from v4.5)

| # | Item | Notes |
|---|---|---|
| 1 | ~~Deploy 275~~ **DONE 2026-10-12** | prod `784647e2d` (master `8764137fe`, tag `v4.5` pushed). Migrations 204 → 205 → 206 applied via MCP, one approved write each, every VERIFY row PASS (205 first attempt failed with an MCP transport error before reaching the DB; retried). Backend live 18:32 (`/retention/summary` 404→403), `/docs` 401, frontend bundle carries the retention UI. Advisors 0 ERROR (+3 expected: `retention_sweeps` no-policy INFO; `document_is_retrievable`, `storage_object_backs_document` callable by authenticated — the policies need it). `source_state` all NULL (178 docs, all retrievable). 0 deletes during the 206→backend window. Coolify confirmed by the operator 2026-10-12: `RETENTION_SWEEP_ENABLED=false`, `ENVIRONMENT=production` |
| 2 | 275 hands-on UAT | `.planning/milestones/v4.5-phases/275-retention-legal-hold/275-UAT.md` — 18 rows, pending |
| 3 | 273 live STRUCTURED-path drive (run first of the re-checks) + WR-04/05 visual | `273-HUMAN-UAT.md` |
| 4 | 271 G-4 sign-off (G4-1..G4-6) + P-01 / P-03 decisions | `271-UAT.md` |
| 5 | 272 live re-drive of the review fixes | `272-HUMAN-UAT.md` |
| 6 | Logged-in production smoke test of v4.5 (270-274 + 276 live since 2026-10-05) | also owed from v4.4 |

### Carry into the next milestone's scoping (✅ consumed by v4.6 intake 2026-10-12 — kept as the record)

- Integration W-1 (`harness/freshness.py` counts archived docs), W-2 (artifact rows outlive retention
  disposition — needs a recorded decision), W-3 (filter vocabulary restated twice), W-5 / BUG-261012-01.

- Open bugs: BUG-261004-02, BUG-261005-01, BUG-261012-01, BUG-261012-02.
- SEED-354 (hold private documents), SEED-334 (272 SC#4 providers), SEED-224 (`retrieval_service.py`
  extraction), OV-273-02 (`tool_dispatcher.py` registry split), `expert_scope.py` extraction first.

- ~~CLAUDE.md past the 120k warn band — split scheduled.~~ **DONE in 277** (89,171 chars).

---

## Deferred Items

Items acknowledged and deferred at v4.5 milestone close on 2026-10-12 (47; acknowledged at close — the
operator asked to close the milestone):

| Category | Item | Status |
|----------|------|--------|
| quick_task | the same 29 historical quick-task dirs deferred at the v4.4 close (260322-26g … 260906-5qd; full list in `milestones/v4.5-STATE-at-close.md` → Deferred Items) | missing / unknown |
| todo | spike-nl-workflow-authoring.md | open |
| seed | SEED-041-conversation-compaction | dormant |
| seed | SEED-043-sandbox-package-management | dormant |
| seed | SEED-046-library-health-dashboard-enrichment | dormant |
| seed | SEED-127-reasoning-first-forced-emission-gap | dormant |
| uat | 270 270-UAT-LOG.md | unknown |
| uat | 271 271-UAT-LOG.md | unknown |
| uat | 271 271-UAT.md | partial |
| uat | 272 272-HUMAN-UAT.md | partial (1 open scenario) |
| uat | 272 272-UAT-LOG.md | unknown |
| uat | 273 273-HUMAN-UAT.md | partial |
| uat | 273 273-UAT-LOG.md | unknown |
| uat | 274 274-UAT-LOG.md | unknown |
| uat | 275 275-UAT.md | pending |
| uat | 276 276-UAT-LOG.md | unknown |
| verification | 271 271-VERIFICATION.md | human_needed |
| verification | 272 272-VERIFICATION.md | human_needed |
| verification | 273 273-VERIFICATION.md | human_needed |
