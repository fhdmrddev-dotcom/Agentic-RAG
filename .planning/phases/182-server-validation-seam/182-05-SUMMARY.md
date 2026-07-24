---
phase: 182-server-validation-seam
plan: 05
subsystem: planning
tags: [seeds, verification-gap-closure, bookkeeping, decision-record, authz-404-posture]

# Dependency graph
requires:
  - phase: 182-server-validation-seam (plans 01-03)
    provides: the /validate + /grounding-bundle seam and the grounding.py shared module whose verification surfaced these findings
  - phase: 182-server-validation-seam (verification)
    provides: 182-VERIFICATION.md's Anti-Patterns table — the WR-03/WR-04/WR-07/WR-08 findings this plan dispositions
provides:
  - SEED-130 — the template_placeholders dead path (WR-03), with the silent-degrade diagnosis and the two fix options Phase 184 must choose between
  - SEED-131 — the unsealed /validate ALWAYS-200 invariant (WR-04), with the fail-closed vs unsealed read inventory and an explicit rejection of the blanket try/except fix
  - SEED-132 — the two model_validator rules that bypass the {ok, verdicts} envelope (WR-07), with the extra="forbid"-is-forbidden constraint recorded
  - 182-DECISION-NOTES.md — WR-08 recorded as REJECTED with the D-182-05 rationale, the honest residual risk, and a supersede-only re-open trigger
  - deferred-items.md D3 — 29/133 seed files have unparseable frontmatter (out-of-scope discovery)
affects: [184-editable-canvas, 185-graded-governance, seed-backlog, milestone-close-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rejected-finding record in the phase directory — a locked decision gets a written verdict + rationale + residual risk + narrow re-open trigger, so re-verification does not re-raise it as a defect"

key-files:
  created:
    - .planning/seeds/SEED-130-workflow-template-placeholders-dead-path.md
    - .planning/seeds/SEED-131-validate-always-200-invariant-unsealed.md
    - .planning/seeds/SEED-132-harness-model-validator-bypasses-verdict-envelope.md
    - .planning/phases/182-server-validation-seam/182-DECISION-NOTES.md
  modified:
    - .planning/phases/182-server-validation-seam/deferred-items.md

key-decisions:
  - "WR-08 REJECTED, not deferred — D-182-05 locks the require_canvas-alone posture; require_visible raises 403 (dependencies.py:551) which leaks route existence and would defeat the byte-identical-404 REVERT gate. Recorded with an honest residual-risk paragraph rather than a bare won't-fix."
  - "WR-03/WR-04/WR-07 seeded rather than fixed — each has a concrete downstream consumer (Phase 184 node-config, Phase 184 live canvas, Phase 184 per-node badges) that determines the correct fix shape; fixing blind now would be unverifiable."
  - "SEED-131 explicitly forecloses the blanket try/except fix — sealing the route by returning ok:true on a failed read would paint a broken workflow green, which is worse than the 500 and is exactly the drift D-182-06 exists to prevent."
  - "SEED-132 explicitly forecloses relaxing extra=\"forbid\" (182-RESEARCH.md:253) — the fix must be a 422-to-verdict mapping, ideally via the typed-exception precedent plan 182-04 set with FolderScopeSubsetError."

patterns-established:
  - "Seed frontmatter is authored strict-YAML-parseable and verified with yaml.safe_load before commit — the seed index is machine-read, so an unparseable seed is an invisible seed"
  - "A seed's source coordinates cite BOTH the verification-time line range and a symbol anchor, so the citation survives later file drift"

requirements-completed: [VALID-01]

# Metrics
duration: 10min
completed: 2026-07-25
---

# Phase 182 Plan 05: Verification Gap Bookkeeping Summary

**Three deferred verification findings (WR-03/WR-04/WR-07) planted as SEED-130/131/132 with concrete Phase-184/185 re-open triggers, and WR-08 recorded as a REJECTED finding with its D-182-05 rationale so re-verification does not re-raise a locked decision as a defect.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-24T22:42:30Z
- **Completed:** 2026-07-24T22:52:30Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 appended) — all under `.planning/`

## Accomplishments

- **Nothing surfaced by verification is silently dropped.** All four WARNING-level findings the gap-closure wave does not fix now have a written home: three seeds with 4 concrete `re_open_triggers` each (the plan required ≥ 3), and one rejection record.
- **Each seed names its downstream consumer,** so the next planner sequences it without re-deriving the analysis: SEED-130 → Phase 184 node-config template dropdown (the first real consumer, and the phase that settles how a template is identified); SEED-131 → Phase 184's live canvas, which calls `/validate` on every edit and turns one DB blip into a 500 storm; SEED-132 → Phase 184's per-node badge work (VALID-03), plus Phase 185's grounding-mode verdict needing one uniform envelope.
- **Three source-level corrections to the verification's own diagnosis** were made by reading the code rather than trusting the report (detailed under Decisions Made) — the seeds are more accurate than the findings they capture.
- **WR-08's rejection is auditable, not a bare won't-fix** — it carries the locked decision, four independent citations, the honest residual risk (naming exactly what a non-authoring caller could reach and why it is bounded), and a two-condition re-open trigger.
- **Zero backend/frontend/supabase change** — `git status --porcelain --untracked-files=no backend/ frontend/` is empty across all three commits, so this plan carried no file conflict with the backend gap-closure plans in the same wave.

## Task Commits

1. **Task 1: Plant SEED-130 / SEED-131 / SEED-132** — `d87f37ed` (docs)
2. **Task 2: Record WR-08 as REJECTED with its D-182-05 rationale** — `81831998` (docs)
3. **Scope-boundary discovery log (deviation, see below)** — `e5c2df23` (docs)

## Files Created/Modified

- `.planning/seeds/SEED-130-workflow-template-placeholders-dead-path.md` — WR-03. The `template_placeholders` path is dead code: `template_asset_id` is typed `UUID` but `resolve_template_source` Branch 1 keys `asset_id` as a **storage path** (`template_asset_service.py:158` says so verbatim), so no real library asset can match.
- `.planning/seeds/SEED-131-validate-always-200-invariant-unsealed.md` — WR-04. The documented ALWAYS-200 promise is not sealed; includes a per-read fail-closed inventory and an explicit rejection of the blanket try/except.
- `.planning/seeds/SEED-132-harness-model-validator-bypasses-verdict-envelope.md` — WR-07. Two `@model_validator` rules (`harness.py:252-280`) 422 before the handler; the only rules not expressible in `{ok, verdicts}`.
- `.planning/phases/182-server-validation-seam/182-DECISION-NOTES.md` — the standing answer to Phase-182 verifier findings that are decisions rather than defects. One section: WR-08, REJECTED.
- `.planning/phases/182-server-validation-seam/deferred-items.md` — appended D3 (see Deviations).

## Decisions Made

**1. WR-08 is REJECTED, not deferred.** A deferral would imply the asymmetry should eventually be closed. It should not: `require_visible` raises 403 (`dependencies.py:551`), and a 403 is by construction an admission that the route exists — which defeats the byte-identical-404 property REVERT-01/02 (the Phase 181 HARD gate) is built on. Every `require_canvas` deny path terminates in `_NOT_FOUND` (`:636`, `:642`, `:651`). Stacking would additionally couple canvas availability to a different feature's audience. Four citations recorded: `182-CONTEXT.md` D-182-05, the in-code rule at `workflows.py:244-248`, `182-RESEARCH.md:254`, `182-PATTERNS.md:270-272`.

**2. The residual risk is stated rather than argued away.** The verifier's concern is real: a caller inside the `visual_workflow_canvas` audience but outside `workflow_authoring`'s can reach both routes. The note bounds it precisely — `/validate` is read-only advice that never persists/executes/mints a version, and `/grounding-bundle` returns the caller's own org-gated palette (CR-01/CR-02 projections) plus the non-secret tool-name registry. No write path is reachable.

**3. Three corrections to the verification's diagnosis, made from source.** Recorded in the seeds because the corrections change the fix shape:

- **SEED-130 — the dead path is quieter than reported.** The verification assumed the `except Exception` degrade fires. It does not: `resolve_template_source` catches the storage failure internally (`template_asset_service.py:157-173`, per D-05 never surface a raw 404) and returns an error-shaped result with no `bytes`, so `_resolve_template_placeholders` exits via `if not data: return []`. The `logger.warning(...)` never fires — there is **no log at all**. Two individually-correct decisions compose into a failure mode with zero observability.
- **SEED-131 — "fails closed" needed splitting into two different senses.** `_resolve_caller_org_ids` and `fetch_visible_folders` DO fail closed against an *empty membership result* (the documented D-165-04 over-restrict posture) but NOT against a *raised* error — the `aexec` call is unguarded. Only `_skill_registry` has a true `except Exception: return []` (CR-01). Conflating the two would have made a closing phase think the reads were already safe.
- **SEED-131 — a second-order hazard the verification did not name.** `_folder_scope_violation` (`grounding.py:352-382`) catches bare `ValueError` by design, so any `ValueError` beneath the ⊆ walk is already rendered as a normal-looking `folder_scope` error verdict with `phase: None`. The route can therefore already paint a *healthy* workflow red because of an infrastructure problem — flagged under `needs_confirmation` as the shape a handler-level seal must not reproduce.

**4. `related_seeds: [SEED-110]` on SEED-130 was verified, not assumed.** The plan made it conditional on SEED-110 genuinely concerning workflow template files. It does (run-time template upload as a workflow run input), so the link was kept.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two of the three new seeds had frontmatter that failed strict YAML parse**

- **Found during:** Task 1 (verification step, before commit)
- **Issue:** SEED-130's and SEED-132's `category:` values were unquoted plain scalars containing `": "`, which YAML reads as a nested mapping key. `yaml.safe_load` raised `ScannerError: mapping values are not allowed here` on both. Inherited from the SEED-129 reference file the plan named as the schema to mirror — which has the identical defect.
- **Fix:** Quoted both `category` values. Mirroring the reference file's *schema* does not mean replicating its *parse bug*.
- **Files modified:** `SEED-130-...md`, `SEED-132-...md`
- **Verification:** All three seeds re-parsed with `yaml.safe_load`; all pass, plus a per-file assertion of `status: open`, `folded_into: null`, `planted: 2026-07-25`, non-empty `priority`/`suggested_phase`, and ≥ 3 `re_open_triggers` (all three carry 4).
- **Committed in:** `d87f37ed` (Task 1 commit)

### Out-of-scope discoveries (logged, NOT fixed)

**2. [Scope boundary] 29 of 133 seed files have unparseable frontmatter** — logged as D3 in `deferred-items.md`, committed separately as `e5c2df23`.

- **Found during:** Task 1, while validating the new seeds against the reference schema.
- **Finding:** 28 seed files fail strict `yaml.safe_load` and `SEED-084-starter-workflow-library.md` has no frontmatter block at all. 104 parse cleanly. `SEED-129` — the file this plan was instructed to mirror — is itself one of the failures.
- **Why it was worth logging:** seed frontmatter is the machine-readable index the `audit-open` milestone sweep enumerates the deferred backlog from (STATE.md's v3.4 close counted "Seeds (dormant) | 9" from exactly this surface). A seed that does not parse is invisible to a strict consumer, which silently defeats the preserve-every-deferred-idea rule for ~22% of the backlog — the very rule this plan exists to honor.
- **Honestly bounded:** logged as a LATENT risk. It was not confirmed which consumers parse seed frontmatter strictly versus regex-scrape it; a lenient consumer would not have surfaced this. D3 says so and tells a closing phase to confirm the consumer set before sizing a fix.
- **Not fixed because:** 29 files, none in this plan's `files_modified`, and the plan's own acceptance criteria scope it to 4 files. The three seeds planted here were authored quoted and verified, so the defect is not being extended.

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in this plan's own artifacts) + 1 out-of-scope discovery logged.
**Impact on plan:** None on scope. The auto-fix was on files this plan created; the discovery was logged and left alone per the scope boundary.

## Issues Encountered

Three SDK state-verb quirks, all worked around; none blocked completion:

- `state.advance-plan` behaved correctly this time (5 → 6 of 7) and did **not** flip `status: executing` → `completed` — the quirk flagged in the execution prompt did not fire. Verified by re-reading the frontmatter after the call. It did, however, blank `last_activity` to a bare date, which was restored by hand.
- `state.update-progress` returned `{"updated": false, "reason": "Progress field not found in STATE.md"}` — the verb looks for a body Progress field this STATE.md does not carry (it uses a frontmatter `progress:` block). Hand-updated `completed_plans: 7 → 8`; `percent` is phase-based and stays at 6.
- `state.record-session` returned `{"recorded": false, "reason": "No session fields found in STATE.md"}` — same class; this STATE.md has no session block. The `Current Position` block was hand-updated instead.
- `state.add-decision` rejected a positional argument (`{"error": "summary required"}`); it needs `--summary`. It also stamps `[Phase ?]`, matching a pre-existing convention in this file, so the phase was named inline in the decision text.

## User Setup Required

None — no external service configuration required. This plan is `.planning/` bookkeeping only.

## Next Phase Readiness

- **Plans 06 and 07 are unblocked.** This plan touched no source file, so it carries zero conflict with the publish-grounding-enforcement (182-06) and fail-loud-severity (182-07) plans.
- **A re-verification of Phase 182 should now find WR-08 already answered.** `182-DECISION-NOTES.md` carries the verdict, the rationale, the residual risk, and the narrow re-open condition.
- **Phase 184 inherits three named obligations** — SEED-130 (template dropdown needs a real placeholder payload; also settles the UUID-vs-storage-path contract), SEED-131 (seal `/validate` before the canvas starts calling it on every edit — the `high`-priority one), SEED-132 (per-node badges cannot be honest about a node the server 422s on). All three should be surfaced at `/gsd:discuss-phase 184`.
- **One residual concern, not a blocker:** SEED-131's `needs_confirmation` flags that `/validate` can already render an infrastructure `ValueError` as a normal-looking `folder_scope` verdict. If that proves reachable in practice it is a correctness issue independent of the 500, and would raise the seed's urgency ahead of Phase 184.

## Self-Check: PASSED

- Files verified present: `SEED-130-workflow-template-placeholders-dead-path.md`, `SEED-131-validate-always-200-invariant-unsealed.md`, `SEED-132-harness-model-validator-bypasses-verdict-envelope.md`, `182-DECISION-NOTES.md`, `deferred-items.md` — 5/5 FOUND.
- Commits verified in `git log --all`: `d87f37ed`, `81831998`, `e5c2df23` — 3/3 FOUND.
- Scope verified: all three commits are `.planning/`-only (503 insertions, 0 deletions, 0 files under `backend/`, `frontend/`, or `supabase/`).
- Plan verification block satisfied: all four `files_modified` artifacts exist; each seed carries `status: open`, `folded_into: null`, and 4 `re_open_triggers`; `182-DECISION-NOTES.md` cites `D-182-05`, `workflows.py:374`, `workflows.py:474`, `workflows.py:244-248`, states the 403-vs-404 distinction, and carries both a residual-risk paragraph and a supersede-only re-open trigger.
- No stubs, placeholders, or TODO markers introduced. No new threat surface (documentation only — T-182-12 mitigation held: no secrets, tokens, connection strings, or real user/org ids in any file).

---
*Phase: 182-server-validation-seam*
*Completed: 2026-07-25*
