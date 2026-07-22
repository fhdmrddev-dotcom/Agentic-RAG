---
phase: 160-tenancy-model-adr
plan: 01
subsystem: governance
tags: [adr, multi-tenancy, tenancy, rls, org, deployment-flexibility, d-prd-02, d-v3.4-01, seed-120]

# Dependency graph
requires:
  - phase: v3.3 (Phase 150 SEC-01)
    provides: app-layer MultiFernet enc:v1: envelope + DB>env _val precedence chain (reused by the SC#4 forward-compat contract)
  - phase: v3.3 (Phase 157 DEPLOY-01)
    provides: Solo/Team/Enterprise deploy presets that make co-tenant-vs-isolated a deploy-time env choice today
  - phase: v3.3 (migrations 095/096)
    provides: nullable org_id stubs on the 4 owned roots + org-agnostic operator_users (the ~80% already-shipped posture)
provides:
  - Ratified tenancy posture (D-PRD-02: co-tenant org_id + membership RLS default; isolation-via-deployment for enterprise)
  - Binding naming/renumbering locks for phases 161-168 (is_system_global reuse; is_global -> is_org_shared value-preserving rename; migrations at slot 104+)
  - The binding, non-negotiable 4-tier deployment-flexibility contract (solo-local / small-team-VPS / medium-SaaS / enterprise-BYO) with per-phase enforcement (161-173) + SEED-120 forward-compat
  - The stable canonical ADR path (.planning/phases/160-tenancy-model-adr/160-ADR.md) that phases 161-168 cite
  - D-v3.4-01 pointer entries in DECISIONS.md + PROJECT.md
affects: [161-org-schema, 162-backfill, 163-rls-crux, 164-secdef-isolation, 165-is_global-retirement, 166-org-admin, 167-invitations-prefs, 168-sso, 169-173-stretch, v3.5-seed-120]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ratify-not-relitigate ADR — records a settled ACCEPTED decision instead of re-opening it"
    - "D-vX.Y-NN per-milestone ADR register convention (first D-v3.4-01 entry recorded in DECISIONS.md alongside the cross-milestone D-PRD-NN ADRs, per locked D-02)"
    - "Per-phase deployment-flexibility enforcement clause — nothing a v3.4 phase ships may make any deployment tier harder (echoed into each phase's success criteria, not a milestone-exit-only check)"

key-files:
  created:
    - .planning/phases/160-tenancy-model-adr/160-ADR.md
  modified:
    - .planning/prd-reset/DECISIONS.md
    - .planning/PROJECT.md

key-decisions:
  - "D-01: The 4-tier deployment-flexibility contract is binding + non-negotiable with per-phase enforcement (both halves — pure env-var tier switch + SEED-120 forward-compat substrate)"
  - "D-02: The ADR lives in two places — the standalone 160-ADR.md canonical deliverable + a short D-v3.4-01 pointer in DECISIONS.md, plus a belt-and-suspenders row in PROJECT.md's Key Decisions table"
  - "D-03: A short Consequences+reversal section records the one-way-door cost (co-tenant -> isolated = redeploy on customer-owned Supabase, a deploy-time switch not a code fork) + the named escape valve (a paying customer forcing isolation)"
  - "D-04: Clean ratify — D-PRD-02 is confirmed unchanged; ~80% already shipped in v3.3; no code changes this phase"

patterns-established:
  - "Ratify-not-relitigate: an ADR can close a milestone's biggest posture call by recording prior acceptance + shipped evidence, not by re-debating"
  - "Naming/renumbering locks stated once, cited by downstream phases rather than re-derived"

requirements-completed: [ADR-01]

# Metrics
duration: 6min
completed: 2026-07-18
---

# Phase 160 Plan 01: Tenancy-Model ADR Summary

**A ratify-not-relitigate Tenancy-Model ADR (160-ADR.md) that ratifies D-PRD-02's co-tenant + isolation-via-deployment posture, locks the is_system_global / is_org_shared / slot-104+ naming decisions for phases 161-168, and pins the binding 4-tier deployment-flexibility contract — recorded as D-v3.4-01 in both decision registers.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-18T11:51:17Z
- **Completed:** 2026-07-18T11:57:07Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Authored `160-ADR.md` (101 lines) — the milestone's foundational decision document, framed throughout as settled/non-relitigated, with an explicit SC#1-4 coverage mapping so downstream verification is a lookup.
- Ratified D-PRD-02 unchanged (co-tenant `org_id` + membership RLS default; isolation-via-deployment on a customer-owned Supabase for enterprise) and disambiguated the version-slot staleness (multi-tenancy re-slotted v3.2 -> v3.3 -> v3.4; posture identical, only the slot shifted) so a reader is not thrown by D-PRD-02's older v3.1/v3.2/v3.3 Consequences references.
- Locked the binding naming/renumbering decisions for phases 161-168 (`is_system_global` reuse; value-preserving `is_global` -> `is_org_shared` rename; migrations continue at slot 104+).
- Pinned the one genuinely-new binding commitment: the non-negotiable 4-tier deployment-flexibility contract (solo-local / small-team-VPS / medium-SaaS / enterprise-BYO, pure env-var, no hardcoded URLs/keys/models/ports, local never breaks, deploy-time-not-code-fork) with a per-phase enforcement clause (161-173) + the SEED-120 forward-compat substrate (reusing the SEC-01 `enc:v1:` MultiFernet envelope so v3.5 adds per-org provider config / BYO keys / per-org model selection with no schema rewrite).
- Recorded the ADR as `D-v3.4-01` in both registers (DECISIONS.md pointer before the Cross-references footer + PROJECT.md Key Decisions row), leaving D-PRD-02's own section untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the Tenancy-Model ADR (160-ADR.md)** — `7c6d790e` (docs) — token gate printed OK (all 27 SC#1-4 tokens present with ASCII hyphens; 101 lines >= 60)
2. **Task 2: Record the ADR in both decision registers (D-v3.4-01)** — `0387cffb` (docs) — Task 2 gate printed OK (DECISIONS.md section references 160-ADR.md + D-PRD-02; Cross-references footer still last; PROJECT.md row present)

## Files Created/Modified
- `.planning/phases/160-tenancy-model-adr/160-ADR.md` — **created**. The Tenancy-Model ADR: header + Context (posture confirmation + version-slot disambiguation), Decision (SC#1), Binding Naming & Renumbering Locks (SC#2), Ratify-Not-Relitigate Scope (SC#3), 4-Tier Deployment-Flexibility Contract (SC#4/D-01), Consequences+Reversal (D-03), Success Criteria Coverage table, References. The stable canonical path phases 161-168 cite.
- `.planning/prd-reset/DECISIONS.md` — **modified**. Appended the short `## D-v3.4-01` pointer section immediately before the `## Cross-references` footer (which remains the final top-level heading). D-PRD-02's section (lines 101-183) untouched.
- `.planning/PROJECT.md` — **modified**. Added one `D-v3.4-01` row to the Key Decisions table pointing to `160-ADR.md`.

## Decisions Made
None beyond honoring the plan's locked framing decisions D-01..D-04 (documented in key-decisions above). All prose/heading/wording choices were within the plan's stated "Claude's Discretion" latitude; every mandated load-bearing token was included with ASCII hyphens so the automated `grep -qF` gates pass.

## Deviations from Plan

None - plan executed exactly as written. Both tasks landed as specified; both automated verify gates printed `OK`; no bugs, missing functionality, blocking issues, or architectural questions arose (this is a documentation-only phase — no code, schema, migration, test, or threat model, exactly as scoped).

## Issues Encountered
None. Git emitted a benign `LF will be replaced by CRLF` advisory on the Windows working tree (line-ending normalization only — not a content issue).

## Known Stubs
None. This phase produces decision documents, not code or UI — there are no data-wired components, placeholders, or hardcoded empty values.

## User Setup Required
None - no external service configuration required (documentation-only phase).

## Next Phase Readiness
- **Phase 161 (Org / Dept / Role Schema) is unblocked.** The tenancy posture, naming/renumbering locks (`is_system_global`, `is_org_shared`, slot 104+), and the deployment-flexibility contract are all settled and citable at `.planning/phases/160-tenancy-model-adr/160-ADR.md`.
- The per-phase deployment-flexibility enforcement clause (SC#4) is now a binding obligation on every subsequent v3.4 phase (161-173): each must verify nothing it ships makes a deployment tier harder, and phase 161's schema must keep the org-settings substrate SEED-120-forward-compatible.
- No blockers or concerns.

## Self-Check: PASSED

- Created file exists: `.planning/phases/160-tenancy-model-adr/160-ADR.md` — FOUND
- Task 1 commit `7c6d790e` — FOUND
- Task 2 commit `0387cffb` — FOUND
- Modified files present: `.planning/prd-reset/DECISIONS.md`, `.planning/PROJECT.md` — FOUND
- Scope integrity: no code/schema/migration/test file touched by either commit — only `.planning/` docs (confirmed)

---
*Phase: 160-tenancy-model-adr*
*Completed: 2026-07-18*
