---
phase: 143-starter-workflow-library-stretch
plan: 04
subsystem: frontend
tags: [react, vite, workflows, starters, fork, shelf-reorder, scope-narrowing, tdd-green]

# Dependency graph
requires:
  - phase: 143-01
    provides: "the frontend RED backstops this plan turns GREEN (Starters shelf render, onUseStarter fresh-copy fork new-slug+v1, section-order fold) + the WorkflowDefinition.category field that lets the forked body carry category:'starter' without a 422"
  - phase: 143-02
    provides: "the backend contract this plan consumes — GET /workflows/starters (curated globals) + GET /workflows/published?scope=mine (mine-only de-dupe) + the 409-collision fork path"
  - phase: 103-workflows-page-authoring-api
    provides: "the WorkflowsPage two-shelf layout, onTweak fork flow, PublishedCard + WorkflowSoul(card) chrome, refetchPublished latest-wins guard, createWorkflowDraft client"
provides:
  - "listStarterWorkflows() client → GET /workflows/starters (curated Starters feed)"
  - "additive default-off { scope?: 'mine' } option on listPublishedWorkflows (3rd param, byte-identical for existing callers)"
  - "the user-facing Starters shelf (curated cards + Starter chip + Use-this fork affordance) on TOP of the Workflows page"
  - "onUseStarter fresh-copy fork (new <slug>-<6hash> + v1 + draft, INSERT never UPDATE, 409-retry-once)"
  - "shelf section reorder Starters → Published → Drafts (folds BUG-260628-01)"
  - "the Workflows-page Published shelf de-duped to mine-only via scope='mine' (composer picker + WorkspacePanel unchanged)"
affects: [143-05 (BLOCKING operator apply of mig 094 — until applied GET /workflows/starters returns [] so the live Starters shelf shows the honest 'No starters available yet.' empty-state; the live fork UAT depends on the seeded rows)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scoped narrowing on a SHARED api client via an additive default-off options param (3rd positional, after the existing signal param) — only ONE call site opts in; every other caller stays byte-identical (D-143-2b / Pitfall 3)"
    - "Fresh-copy fork = a sibling of onTweak with exactly two deltas (new auto-suffixed slug + version:1 instead of same-slug v(N+1)) because UNIQUE(slug,version) is GLOBAL across users (D-143-1)"
    - "Robust 6-char base36 fork-slug suffix (accumulate until >=6 chars) so the fork slug always matches the <slug>-[a-z0-9]{6} collision-contract shape (Pitfall 5)"
    - "BUG-260628-01 fold = a JSX section REORDER (move sibling <section>s), NOT a within-list sort (Pitfall 6)"

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx

key-decisions:
  - "Threaded scope as a 3rd positional options param ({ scope?: 'mine' }) — NOT by repurposing the existing 2nd param — because WorkspacePanel.tsx:125 passes an AbortSignal as the 2nd arg and MUST stay byte-identical (D-143-2b). PATTERNS suggested a 2-arg { scope } shape, but that would break WorkspacePanel; the 3rd-param form satisfies both the plan intent and the byte-identical guarantee."
  - "The Starter-card fork button is labeled 'Use this →' (NOT the literal 'Use this starter') so the ONLY element matching the Plan-01 RED assertion getByText(/starter|official/i) is the 'Starter' chip — a 'Use this starter' label would ALSO match, making getByText find two elements and throw. The button is located by testid use-starter; the chip carries the curated distinction (D-143-8, Glean verified-badge analog)."
  - "StarterCard is a small dedicated component that REUSES the exact PublishedCard Tailwind chrome + the shared WorkflowSoul(card) atom (no new card design; G-2 waived) rather than overloading PublishedCard with a variant prop — keeps PublishedCard single-purpose while honoring 'reuse the card chrome + soul'."

patterns-established:
  - "Pattern 1: opt-in scope narrowing on a shared read client — add the param default-off at the END of the signature so positional callers (incl. those passing a signal) are untouched; only the one shelf that needs mine-only opts in."
  - "Pattern 2: turn a Wave-0 RED frontend backstop GREEN by implementing to the EXACT assertion (fork slug regex, version===1, section DOM order) — and update the pre-existing tests the new behavior intentionally supersedes rather than fighting them."

requirements-completed: []  # WF-01 is phase-spanning (5 plans); Plan 04 ships the user-facing shelf+fork, but the live feed needs Plan 05's seed apply

# Metrics
duration: 6min
completed: 2026-07-10
---

# Phase 143 Plan 04: Starters Shelf UI + Fresh-Copy Fork + Section Reorder Summary

**Shipped the WF-01 user experience — a curated Starters gallery on top of the Workflows page, a "Use this" fresh-copy fork that mints a brand-new owned draft (new suffixed slug + v1) off a shared starter, the BUG-260628-01 section reorder (Starters → Published → Drafts), and the mine-only Published de-dupe — turning all three Plan-01 frontend RED backstops GREEN while keeping the shared `listPublishedWorkflows` byte-identical for the composer picker + WorkspacePanel.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-10T06:31:46Z
- **Completed:** 2026-07-10T06:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `listStarterWorkflows(signal?)` — a clone of `listPublishedWorkflows` with NO query params, hitting `GET /workflows/starters` (the curated-globals feed added in Plan 02).
- Additive default-off `{ scope?: "mine" }` option on `listPublishedWorkflows` (3rd positional param, after `signal`): appends `?scope=mine` only when passed. The existing `project_folder_id` encoding is preserved byte-for-byte; the composer Harness picker + `WorkspacePanel.tsx:125` (which passes a signal as the 2nd arg) stay byte-identical.
- The **Starters shelf** (`data-testid="starters-shelf"`) on TOP of the page: a `StarterCard` per curated row (name + "Starter" chip + the shared `WorkflowSoul(scale="card")` + a `use-starter` "Use this →" button), honest `No starters available yet.` empty-state.
- `onUseStarter` — the **fresh-copy fork** (D-143-1): mints `<starter.slug>-<6hash>` + `version:1` + `status:"draft"`, `createWorkflowDraft` (server forces is_global=false/draft/created_by), `refetchDrafts`, then opens the Builder with `From starter · <name>`. On a 409 slug/version collision it retries ONCE with a fresh hash (Pitfall 5); the published starter row is never mutated (INSERT, never UPDATE).
- **Section reorder** Starters → Published → Drafts (a JSX section move — folds BUG-260628-01 so runnable published/starters aren't buried under drafts, D-143-5). The Build-card stays discoverable in the Drafts shelf.
- The Workflows-page Published shelf now calls `listPublishedWorkflows(projectArg, undefined, { scope: "mine" })` so the curated starters + the 5 mig-061 dev scaffolds stop double-rendering (D-143-2a end state); grep confirms a SINGLE `scope: "mine"` call site.

## Task Commits

Each task was committed atomically:

1. **Task 1: api.ts — listStarterWorkflows() + scope option on listPublishedWorkflows** - `59a35e98` (feat)
2. **Task 2: WorkflowsPage.tsx — Starters shelf, fork, section reorder, mine-only, chip** - `e16073c8` (feat)

**Plan metadata:** (final commit) `docs(143-04): complete Starters shelf UI + fork plan`

## Files Created/Modified
- `frontend/src/lib/api.ts` — Added `listStarterWorkflows()`; threaded a default-off `{ scope?: "mine" }` options param onto `listPublishedWorkflows` (rebuilt the URL from a `params` array so `project_folder_id` encoding is unchanged and `scope` appends only when opted in). `createWorkflowDraft` untouched.
- `frontend/src/pages/WorkflowsPage.tsx` — Added `starters` state + `refetchStarters` (mount fetch, latest-wins guard) + a `freshHash()` helper; `onUseStarter` fresh-copy fork; a `StarterCard` component; reordered the shelf `<section>`s to Starters → Published → Drafts; pointed `refetchPublished` at `scope:"mine"`.
- `frontend/src/pages/WorkflowsPage.test.tsx` — Turned the 3 Plan-01 RED backstops green (no assertion changes to them); updated 2 PRE-EXISTING tests the new behavior intentionally supersedes (see Deviations).

## Verification

- **Task 1:** `npx tsc --noEmit -p tsconfig.json` → no `api.ts` errors (`TS OK`).
- **Task 2:** `npx vitest run src/pages/WorkflowsPage.test.tsx` → **23 passed / 23** (3 new Starters backstops GREEN + 20 pre-existing intact). `tsc --noEmit` → no `WorkflowsPage.tsx`/`api.ts` errors.
- **Wave-merge regression (Pitfall 3):** `npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx` → **31 passed / 31** (the run-soul recovery still fetches globals — its `listPublishedWorkflows(undefined, ctrl.signal)` call is unchanged). `grep 'scope:\s*"mine"'` → a single source call site (`WorkflowsPage.tsx:132`), confirming the narrowing is scoped, not blanket.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] scope threaded as a 3rd positional param, not the PATTERNS-suggested 2-arg `{ scope }` shape**
- **Found during:** Task 1
- **Issue:** `143-PATTERNS.md` sketched `listPublishedWorkflows(projectArg, { scope: "mine" })` (options as the 2nd arg). But `WorkspacePanel.tsx:125` calls `listPublishedWorkflows(undefined, ctrl.signal)` — an `AbortSignal` as the 2nd positional arg — and the plan requires that call to stay byte-identical (D-143-2b). Repurposing the 2nd param to an options object would break it.
- **Fix:** Kept the existing `(projectFolderId?, signal?)` shape and added `opts?: { scope?: "mine" }` as the 3rd param. WorkflowsPage calls `listPublishedWorkflows(projectArg, undefined, { scope: "mine" })`; WorkspacePanel + the picker are untouched.
- **Files modified:** frontend/src/lib/api.ts, frontend/src/pages/WorkflowsPage.tsx
- **Verification:** WorkspacePanel suite 31/31 green; single `scope:"mine"` call site confirmed by grep.
- **Committed in:** `59a35e98` (Task 1) + `e16073c8` (Task 2)

**2. [Rule 1 - Test correctness] Starter-card fork button labeled "Use this →" (not the literal "Use this starter")**
- **Found during:** Task 2
- **Issue:** The Plan-01 RED assertion `within(card).getByText(/starter|official/i)` (the curated-chip check) requires EXACTLY ONE matching element. A button literally labeled "Use this starter" ALSO matches `/starter/i`, so `getByText` would find two elements (chip + button) and throw "multiple elements". The plan/competitor synthesis copy was "Use this starter".
- **Fix:** Labeled the visible button "Use this →" (no "starter"/"official" word) so the "Starter" chip is the single curated marker the assertion finds. The button is located by `data-testid="use-starter"` (label-independent); the chip carries the "curated ≠ user-made" distinction. Reads naturally on the card ("Starter" chip + "Use this →").
- **Files modified:** frontend/src/pages/WorkflowsPage.tsx
- **Verification:** the Starters-shelf render test passes (chip found uniquely; button found by testid).
- **Committed in:** `e16073c8` (Task 2)

**3. [Rule 3 - Blocking] Updated 2 pre-existing WorkflowsPage tests the new behavior supersedes**
- **Found during:** Task 2
- **Issue:** (a) The Phase-103 test "selecting a project re-queries listPublishedWorkflows with that project_folder_id" asserted `toHaveBeenCalledWith("folder-aaa")` (exact 1-arg); the D-143-2a scope narrowing makes the call `("folder-aaa", undefined, { scope: "mine" })`, so the exact-match assertion fails. (b) The Phase-103 test "the Drafts shelf renders ABOVE the Published shelf" directly contradicts the D-143-5 section reorder (this contradiction was flagged in the 143-01 SUMMARY as a Plan-04 to-do).
- **Fix:** (a) Updated the assertion to `toHaveBeenCalledWith("folder-aaa", undefined, { scope: "mine" })`. (b) Flipped the section-order test to assert Published renders ABOVE Drafts (and renamed the describe block); the full 3-shelf order is independently asserted by the new Starters backstop.
- **Files modified:** frontend/src/pages/WorkflowsPage.test.tsx
- **Verification:** both updated tests pass; full suite 23/23 green.
- **Committed in:** `e16073c8` (Task 2)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 test-correctness). No architectural (Rule 4) decisions arose. No package installs. No CLAUDE.md-driven adjustments beyond the coding-convention reuse the plan already called for.

## Issues Encountered
- Git emitted cosmetic `LF will be replaced by CRLF` warnings (Windows autocrlf) on the edited files — expected, no action. The WorkspacePanel run emitted jsdom `HTMLCanvasElement.getContext()` not-implemented warnings — pre-existing environment noise (no `canvas` npm package), unrelated to this plan.

## Threat Flags
None. The plan's trust boundaries are mitigated exactly as the threat register prescribes: T-143-02 — `onUseStarter` is a fresh owner-bound INSERT (`createWorkflowDraft`; the frozen starter is never UPDATEd — the fork test asserts `mockUpdate` not called); T-143-04 — ONLY `refetchPublished` opts into `scope="mine"` (grep-verified single usage; WorkspacePanel + picker keep globals); V5 — the forked body carries `category:"starter"` safely because Plan 01 added the additive field (no 422). No new network endpoint, auth path, file-access pattern, or schema-at-trust-boundary surface was introduced (the starters/scope routes shipped in Plan 02).

## Known Stubs
None. The Starters shelf is wired to the real `listStarterWorkflows()` → `GET /workflows/starters`; the fork uses the real `createWorkflowDraft`. The `No starters available yet.` message is an honest empty-state (against a DB where mig 094 is not yet applied — Plan 05), NOT a hardcoded stub. No placeholder text or mock data flows to rendering.

## User Setup Required
None for this plan. NOTE: the live Starters shelf is EMPTY until Plan 05 (BLOCKING) applies migration 094 via the Supabase SQL editor + runs `seed-starters.py --upload` — until then `GET /workflows/starters` returns `[]` and the shelf shows the honest empty-state. The UI, fork path, and de-dupe are complete and test-verified regardless.

## Next Phase Readiness
- Plan 05 (BLOCKING operator apply): once migration 094 is applied + the 3 `.docx` templates uploaded, `GET /workflows/starters` returns the 3 curated starters and this shelf renders them live; the fork → Builder → publish → run loop is then exercisable end-to-end (SC-d manual UAT).
- WF-01 remains NOT marked complete — it is phase-spanning (5 plans); Plan 04 delivers the user-facing shelf + fork, but the requirement is satisfied only when Plan 05 lands the live seed.

## Self-Check: PASSED

All 3 modified files exist on disk (api.ts, WorkflowsPage.tsx, WorkflowsPage.test.tsx) plus this SUMMARY; both task commits (`59a35e98`, `e16073c8`) are present in the git log.
