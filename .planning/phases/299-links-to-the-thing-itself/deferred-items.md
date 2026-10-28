# Phase 299 — deferred items (out of scope for the plan that found them)

## Found by 299-05 (2026-10-28): `docsCoverageGate.test.ts` red, `[uncovered] router:links`

- **What:** `node scripts/check-docs-coverage.cjs` prints `[uncovered] router:links`, which reds
  `frontend/src/docs/__tests__/docsCoverageGate.test.ts` (case "check-docs-coverage.cjs (DOCS-02)
  passes on a faithful copy of the real tree and prints the summary line") and therefore the vitest
  count gate (`[failing-tests] 1`).
- **Cause:** 299-01's new backend router `backend/app/api/links.py` (added at `cc2875ee5`) has no
  `docs/public` page whose `covers:` names `router:links`.
- **Proof it is inherited, not 299-05's:** the script was run against `git archive` copies of each
  ref (`--root <dir>`):
  - `593068492` (phase base): `docs coverage OK` (119 code keys)
  - `8cbeed1d7` (299-05's base, after 299-01): `FAILED — [uncovered] router:links` (120 code keys)
  - `HEAD` after 299-05: the same single finding
  299-05 touched nothing under `backend/`, `docs/public/`, `frontend/src/docs/` or the script
  (`git diff --name-only 8cbeed1d7 HEAD -- backend docs/public frontend/src/docs scripts/check-docs-coverage.cjs`
  prints nothing).
- **Fix (owed by the 299-01 owner / phase close):** add `router:links` to the `covers:` of the
  docs page for links/sharing in `docs/public` (or write that page). The gate itself says: fix the
  page's covers, never add an exclusion.
