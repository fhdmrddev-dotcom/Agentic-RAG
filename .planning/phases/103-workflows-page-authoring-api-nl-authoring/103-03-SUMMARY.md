---
phase: 103-workflows-page-authoring-api-nl-authoring
plan: 03
subsystem: frontend
tags: [react, typescript, vite, vitest, nav, active-view, api-client, derive-tier, no-router, tdd]

# Dependency graph
requires:
  - phase: 103-workflows-page-authoring-api-nl-authoring
    plan: "01"
    provides: the draft-CRUD + generate + publish backend routes on the /workflows router this client layer mirrors (POST /workflows, GET /workflows/drafts, PATCH/DELETE /workflows/{id}, POST /workflows/generate, POST /workflows/{id}/publish)
provides:
  - "'workflows' ActiveView member (App.tsx) — the no-router nav model extension"
  - the single shared NAV_ITEMS const (frontend/src/lib/nav-items.ts) incl. the Workflows home with a distinct Workflow icon — kills the NavPanel/AppDock/ChatLayout triplication
  - 6 authoring client fns + PublishVerdict/LintError/WorkflowDraftRow/GenerateResult/PublishOutcome/WorkflowDefinitionJSON types + WorkflowConflictError/WorkflowNotFoundError (api.ts)
  - deriveTier()/TIERS — the client-side single source of truth for the strictness-tier badge (frontend/src/components/workflows/deriveTier.ts)
  - 2 frontend vitest files (deriveTier.test.ts 9 cases, api.workflows.test.ts 13 cases)
affects:
  - "103-04 (Builder consumes generateWorkflow/updateWorkflowDraft + deriveTier + the 400px form panel)"
  - "103-05 (publish gauntlet UI consumes publishWorkflow + PublishVerdict + renders named_failures by key-detection)"
  - "103-06 (Workflows page consumes listDraftWorkflows + the shared NAV_ITEMS for the mobile drawer + the 'workflows' render branch + deriveTier badge)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Router-less navigation: a 'workflows' ActiveView member + a useState<ActiveView> switch — NO react-router/useNavigate (sketch 023-A three-homes contract)"
    - "Single shared NAV_ITEMS const consumed by NavPanel (and Plan 06's mobile drawer) — the triplication killer; AppDock deleted"
    - "Client reads the SERVER verdict verbatim: publishWorkflow distinguishes 4 HTTP outcomes (200-with-block != success; 400/404/409 distinct) — no binary 200=ok handler"
    - "Typed conflict errors (WorkflowConflictError/WorkflowNotFoundError) — a 409/404 is thrown, never swallowed as a silent overwrite"
    - "deriveTier()/TIERS = client-derived single source of truth — the badge can't drift from a stored label; toggling citation_policy changes the tier with NO server round-trip"

key-files:
  created:
    - frontend/src/lib/nav-items.ts
    - frontend/src/components/workflows/deriveTier.ts
    - frontend/src/components/workflows/deriveTier.test.ts
    - frontend/src/lib/api.workflows.test.ts
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/lib/api.ts
  deleted:
    - frontend/src/components/layout/AppDock.tsx

key-decisions:
  - "deriveTier mapping: citation_policy strict -> STRICT; flag/partial -> MIDDLE (promoted to STRICT when the full floor-raising gate set output_file_valid+structure_check+freshness is present); draft -> LOOSE (promoted to MIDDLE when ANY floor-raising structural gate is present). Judge (llm_judge_rubric) is always-on across all tiers (judgeAlwaysOn: true)."
  - "Workflows nav entry placed second (after Chat) with the lucide `Workflow` icon (a distinct non-gear glyph per REQ-7 / Claude's discretion)."
  - "WorkflowDefinitionJSON is a permissive Record<string,unknown> alias the Builder (Plan 04) refines — the CRUD/generate client fns pass the definition through opaquely."

patterns-established:
  - "Net-new-failure proof the project way (SEED-056): the frontend has ~44 pre-existing tsc-rot errors at base AND HEAD; I proved net-new = 0 by simulating base (base versions of App/NavPanel/api + restored AppDock + hidden new files) and diffing the error sets — byte-identical (44 = 44, comm -13 empty)."

requirements-completed: [WFAUTH-04]

# Metrics
duration: 12min
completed: 2026-06-14
---

# Phase 103 Plan 03: Frontend Foundation (ActiveView + shared NAV_ITEMS + authoring client + deriveTier) Summary

**The frontend foundation the Builder, gauntlet UI, and Workflows page all consume: the `"workflows"` no-router `ActiveView` member + the single shared `NAV_ITEMS` const (killing the NavPanel/AppDock/ChatLayout triplication, AppDock deleted), the 6 authoring client fns + `PublishVerdict`/draft types in `api.ts` (publish distinguishes the 4 HTTP outcomes, 200-with-block != success), and the net-new client-side `deriveTier()`/`TIERS` single source of truth (judge always-on, toggle changes the badge with no round-trip) — 22 vitest cases GREEN, net-new tsc failures = 0 (base-checkout proven), no react-router.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-14 10:04 UTC
- **Completed:** 2026-06-14 10:16 UTC
- **Tasks:** 3
- **Files changed:** 8 (3 modified source + 1 deleted + 2 created source + 2 created tests)

## Accomplishments

- **REQ-7 nav plumbing** — `ActiveView` gains `"workflows"` (App.tsx); a NEW shared `NAV_ITEMS` const (`frontend/src/lib/nav-items.ts`) holds the single nav source incl. the Workflows top-level home (distinct lucide `Workflow` icon); NavPanel now imports the shared const and dropped its local array + 4 dead icon imports + the `// From AppDock` comment; the dead `AppDock.tsx` is DELETED (verified zero importers). No react-router introduced (the locked no-router three-homes contract, sketch 023-A).
- **REQ-7 h deriveTier()/TIERS** — net-new `frontend/src/components/workflows/deriveTier.ts`: the badge is DERIVED on every call from the real enums (`citation_policy` + the `ValidatorSpec.kind` set), `TIERS` is the single source of truth (🔒/◐/○ glyphs), no stored label, no invented numeric-level/compliance-mode vocabulary. The judge (`llm_judge_rubric`) is always-on across all tiers (`judgeAlwaysOn: true`). Toggling `citation_policy` strict->draft changes the tier with NO server round-trip (imports nothing from the API client).
- **REQ-6/REQ-1 client** — `api.ts` gains 6 authoring fns (`createWorkflowDraft` / `listDraftWorkflows` / `updateWorkflowDraft` / `deleteWorkflowDraft` / `generateWorkflow` / `publishWorkflow`) + the `PublishVerdict` (5 fields, `named_failures: unknown[]` polymorphic), `LintError`, `WorkflowDraftRow`, `GenerateResult`, `PublishOutcome`, `WorkflowDefinitionJSON` types + `WorkflowConflictError`/`WorkflowNotFoundError`. `publishWorkflow` distinguishes the 4 HTTP outcomes (a 200-with-`blocked_stage` surfaces `published:false` — NOT a success; 400 business_requirement / 404 not_found / 409 already_published distinct) reading the server verdict verbatim. `generateWorkflow` reads a 200 `ok:false` structured error without throwing. The mutations throw typed errors on 409/404 (never a silent overwrite).
- **22 vitest cases GREEN** — `deriveTier.test.ts` (9: tier mapping, the strict->draft flip changes the tier with no round-trip, judge-always-on, purity, locked glyphs) + `api.workflows.test.ts` (13: the 4 publish outcomes incl. 200-with-block, generate ok:false no-throw, typed 409/404 conflict errors).

## Task Commits

Each task was committed atomically:

1. **Task 1: ActiveView 'workflows' + shared NAV_ITEMS + AppDock deletion (no router)** — `1ac55485` (feat)
2. **Task 2: deriveTier()/TIERS client-side single source of truth (REQ-7 h)** — `1d3e5535` (feat, TDD RED->GREEN)
3. **Task 3: api.ts authoring fns + PublishVerdict/LintError/draft types (4 HTTP outcomes)** — `ebf336d5` (feat, TDD RED->GREEN)

## Files Created/Modified

- `frontend/src/App.tsx` — extend `ActiveView` union with `"workflows"` (no router; `useState<ActiveView>` stays the nav model).
- `frontend/src/lib/nav-items.ts` (NEW) — the single shared `NAV_ITEMS` const + `NavItem` interface; the Workflows home with the lucide `Workflow` icon.
- `frontend/src/components/layout/NavPanel.tsx` — consume `@/lib/nav-items`; remove the local `NAV_ITEMS` array, the 4 now-dead icon imports (`FileText`/`Activity`/`Zap`/`Settings`), and the `// From AppDock` comment.
- `frontend/src/components/layout/AppDock.tsx` (DELETED) — dead component (zero importers).
- `frontend/src/components/workflows/deriveTier.ts` (NEW) — `deriveTier()` + `TIERS` + the `CitationPolicy`/`ValidatorKind`/`Tier`/`TierId` types.
- `frontend/src/components/workflows/deriveTier.test.ts` (NEW) — 9 cases.
- `frontend/src/lib/api.ts` — the workflow authoring section (6 fns + 6 types/aliases + 2 typed error classes).
- `frontend/src/lib/api.workflows.test.ts` (NEW) — 13 cases (fetch + supabase-auth mocked).

## Decisions Made

- **deriveTier mapping rule (thresholds discretionary per CONTEXT D10):** `strict` -> STRICT; `flag`/`partial` -> MIDDLE, promoted to STRICT when the full floor-raising gate set is present; `draft` -> LOOSE, promoted to MIDDLE when ANY floor-raising structural gate (`output_file_valid`/`structure_check`/`freshness`) is present. The judge is always-on on every tier. This honest refinement (a draft-policy workflow that still carries structural gates genuinely isn't the absolute floor) is what surfaced the Task-2 test correction below.
- **Workflows nav placement + icon:** second slot (after Chat), lucide `Workflow` glyph — a distinct non-gear icon (Claude's discretion within the three-homes contract).
- **`WorkflowDefinitionJSON = Record<string, unknown>`:** a permissive alias the Builder (Plan 04) refines; the client CRUD/generate fns pass the definition opaquely so this plan does not over-commit the shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] deriveTier RED-phase test over-specified `draft + full gates -> LOOSE`**
- **Found during:** Task 2 (deriveTier TDD GREEN run)
- **Issue:** My first-draft test asserted that flipping `citation_policy` strict->draft with the SAME `FULL_GATES` set must yield LOOSE. But the intended (and correct) floor-raising refinement promotes `draft + full structural gates` to MIDDLE. The plan's behavior spec only requires the flip to produce a DIFFERENT tier (proving client-derivation), not specifically LOOSE — the test, not the implementation, was wrong.
- **Fix:** Rewrote the flip test to assert "STRICT != the draft result" (the real contract) for the full-gate case, and kept an explicit `draft + MINIMAL gates -> LOOSE` flip assertion alongside it. The implementation (the documented floor-raising refinement) is unchanged.
- **Files modified:** frontend/src/components/workflows/deriveTier.test.ts
- **Verification:** 9/9 GREEN.
- **Committed in:** `1d3e5535` (Task 2 commit)

**Total deviations:** 1 auto-fixed (a test-correctness bug in my own RED test). No production-code or scope changes.

## Deferred Issues

- **Pre-existing `NavPanel.tsx Button` unused-import (TS6133):** `import { Button } from "@/components/ui/button"` (line 3) has been imported-and-unused since BEFORE this plan (proven via `git show 76cc6d64:...NavPanel.tsx`). It is the ONLY tsc error in any file I touched, and it is out of scope (not caused by my changes — SCOPE BOUNDARY). Left as-is; a future cleanup or the Plan-06 NavPanel/mobile-drawer touch can remove it. Logged here, not fixed.

## Known Stubs

- **`WorkflowDefinitionJSON = Record<string, unknown>`** (`frontend/src/lib/api.ts`) — an intentional permissive placeholder, NOT a UI-rendering stub. The Builder (Plan 04) refines the real definition shape; the client fns pass it through opaquely by design (documented inline). This is a contract-boundary alias, resolved in Plan 04 — not a hidden empty/mock data source.

## Test Results

- **Plan target suite** (`deriveTier.test.ts` + `api.workflows.test.ts`): **22 passed** (9 + 13), exit 0.
- **Net-new tsc failures = 0 (base-checkout proven):** `tsc -p tsconfig.app.json --noEmit` reports **44 pre-existing rot errors at HEAD AND at simulated base 76cc6d64** (identical: `comm -13 base head` and `comm -23 base head` both empty — zero added, zero removed). The rot lives in 16 untouched files (FolderNode/FolderTree/IngestionPage/useMessages tests, MessageSkeleton, SettingsPage, StreamsProvider, streamsStore, etc. — documented SEED-056). The ONLY error in a file I touched is the pre-existing `NavPanel Button` TS6133 (proven present at base). `npx tsc -b` exits 0 on a warm incremental cache; on a cold rebuild it surfaces the same 44 pre-existing rot errors (exit 2 at base too) — this is the documented frontend-rot baseline, not a regression.
- **No-router contract:** `grep -rn "react-router\|useNavigate" frontend/src` — empty. The "workflows" view is a render branch / `ActiveView` member, not a route.
- **AppDock deletion clean:** `frontend/src/components/layout/AppDock.tsx` absent; no `.ts`/`.tsx` import/JSX references (only the cosmetic `index.css` comment + my own `nav-items.ts` doc comment describing the deletion).

## Next Phase Readiness

- **Plan 04 (Builder)** can consume `generateWorkflow` / `updateWorkflowDraft` / `createWorkflowDraft` + `deriveTier()`/`TIERS` for the strictness badge.
- **Plan 05 (publish gauntlet UI)** can consume `publishWorkflow` + the `PublishVerdict`/`PublishOutcome` types and render `named_failures` by key-detection.
- **Plan 06 (Workflows page)** can consume `listDraftWorkflows`, the shared `NAV_ITEMS` for the ChatLayout mobile drawer, the `"workflows"` render branch, and the `deriveTier` badge. (This plan intentionally did NOT touch `ChatLayout.tsx` — its `NAV_ITEMS_MOBILE` consumption + the "workflows" render branch are Plan 06's, to avoid an import-before-exists break on the WorkflowsPage.)
- No blockers.

## Self-Check: PASSED

- All 3 created source/test files + the 1 new test exist on disk: `frontend/src/lib/nav-items.ts`, `frontend/src/components/workflows/deriveTier.ts`, `frontend/src/components/workflows/deriveTier.test.ts`, `frontend/src/lib/api.workflows.test.ts` (verified). `AppDock.tsx` confirmed absent.
- All 3 task commits exist in git history: `1ac55485`, `1d3e5535`, `ebf336d5` (verified).
- Plan target suite GREEN (22/22); net-new tsc failures = 0 (base-checkout proven, 44 = 44 identical); no react-router; AppDock deleted clean.

---
*Phase: 103-workflows-page-authoring-api-nl-authoring*
*Completed: 2026-06-14*
