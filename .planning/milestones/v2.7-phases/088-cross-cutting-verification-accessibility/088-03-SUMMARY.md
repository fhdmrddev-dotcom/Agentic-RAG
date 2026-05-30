---
phase: 088-cross-cutting-verification-accessibility
plan: 03
subsystem: testing
tags: [playwright, e2e, anthropic, google, gemini, thought-signature, workspace-panel, ask_user, accessibility]

# Dependency graph
requires:
  - phase: 087-panel-ui
    provides: "the workspace panel surfaces this scenario asserts — FILES listbox (FilesSection), the Versions diff region (VersionDiff), the PendingAskCard ask_user group, the complementary panel landmark + rail/open toggle (WorkspacePanel/ChatLayout)"
  - phase: 075.4-streaming-uat
    provides: "the 3 mature E2E fixtures (auth / db-teardown / langsmith), playwright.config.ts (testMatch /scenario-\\d+-.+\\.spec\\.ts$/, workers:1), the scenario-02 thought-signature template, and the 3-stage thought_signature wiring being re-verified"
provides:
  - "scenario-13-workspace-deep-flow.spec.ts — the CI wire-level backstop for SC#4: the deep workspace flow (write -> see -> update -> diff -> ask_user -> respond -> resume, no refresh) parameterized over Anthropic + Google"
  - "D-17 gemini-3 thought-signature live re-verify at the network level (zero 400 INVALID_ARGUMENT) encoded as an automated assertion on both providers"
affects: [088-05-verification-capstone, v2.7-close-out, cross-provider-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider-parameterized E2E: a `for (const provider of PROVIDERS) test.describe(...)` loop yields one describe block per provider (Anthropic + Google) from a single test body — the D-15 two-axis pattern"
    - "Disambiguated role=region selection: the VersionDiff diff region is selected by its aria-label (^=\"Diff v\"), never a bare [role=region] (PanelSection bodies are also regions)"
    - "Assert-then-expand panel open: assert the default-open complementary landmark; only click 'Expand workspace' if it's on the rail — never blind-toggle ⌘./Ctrl+. (which would CLOSE an open panel)"

key-files:
  created:
    - frontend/tests/e2e/scenario-13-workspace-deep-flow.spec.ts
  modified: []

key-decisions:
  - "Panel open via assert-then-expand (not the ⌘./Ctrl+. shortcut): ChatLayout defaults panelState to 'open', so blind-pressing the toggle would close it. Assert the landmark; fall back to the rail 'Expand workspace' button only if hidden."
  - "Diff region selected by aria-label '^=Diff v' rather than a bare [role=region], because PanelSection renders each section body as role=region — a bare selector would match Todos/Files/Versions bodies, not the VersionDiff."
  - "Reach the diff by clicking the file row (lifts selectedFile to WorkspacePanel via FilesSection.onSelectFile, 087-02) THEN expanding the Versions accordion (defaultOpen=false) — VersionDiff renders the region once 2+ versions exist."
  - "Kept the zero-400 toEqual([]) assertion on BOTH provider axes (not just Google): cheap, and it also catches an Anthropic round-trip regression — D-17 only mandates it on Google."

patterns-established:
  - "REUSE-AND-EXTEND for new E2E: extend scenario-02 + the 3 fixtures, never a new harness (RESEARCH correction #5 / Pattern 4)"
  - "No-refresh deep flow: the only navigations (goto /settings, goto /) happen BEFORE the first file write; every panel surface after the write is asserted with no page.reload / no post-write goto"

requirements-completed: [A11Y-01]

# Metrics
duration: 3min
completed: 2026-05-29
---

# Phase 088 Plan 03: Deep E2E scenario-13 (Anthropic + Google) Summary

**`scenario-13-workspace-deep-flow.spec.ts` — a provider-parameterized Playwright backstop that drives the full deep workspace flow (write -> see -> update -> diff -> ask_user -> respond -> resume) with NO page refresh on Anthropic AND Google, and asserts zero 400 INVALID_ARGUMENT on both (the D-17 gemini-3 thought-signature live re-verify at the network level).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-29T17:52:50Z
- **Completed:** 2026-05-29T17:55:59Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- Authored the SC#4 automated backstop: the complete deep workspace flow encoded as a single test body, parameterized over two providers via a `for (const provider of PROVIDERS) test.describe(...)` loop (Anthropic `/claude.*haiku|claude.*opus/i` + Google `/gemini.*3.*flash/i` — 3.x, NOT 2.5 per D-03/D-17).
- Encoded the D-17 thought-signature live re-verify: a whole-test 400 capture asserted `toEqual([])` on both axes — on Google this is the network-level confirmation that the 075.4 thought_signature hotfix still round-trips on the reconstructed-history path.
- Asserted every panel surface the flow touches: the FILES listbox row (`[role="listbox"][aria-label="Workspace files"] [role="option"]`), the VersionDiff region (by `aria-label^="Diff v"`), the PendingAskCard (`role=group` + "Needs you"), then `Send Answer` -> ask card hides (resume) -> run terminal — all with no page refresh.
- Reused all 3 mature fixtures (auth / db-teardown / langsmith) — the localhost-hard-gated teardown means scenario-13 adds no DB-wipe surface of its own.
- Verified the scenario is discovered by Playwright under BOTH provider describe blocks and is type-clean (no new tsc errors attributable to the file).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author scenario-13 — the deep flow as a provider-parameterized test** - `0e9469f4` (test)
2. **Task 2: Smoke-list the scenario + document the run command** - verification-only (no source change; deliverable is the discovery + type-check confirmation below, plus the operator run command recorded here). No separate commit.

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) — committed as the final docs commit.

## Files Created/Modified

- `frontend/tests/e2e/scenario-13-workspace-deep-flow.spec.ts` (294 lines) — Provider-parameterized E2E: switch provider/model in Settings -> open the workspace panel -> agent writes analysis.md (assert FILES listbox row) -> agent updates the same file (assert the Diff-v region after clicking the row + expanding the Versions accordion) -> agent calls ask_user (assert the PendingAskCard "Needs you" group) -> fill textarea + Send Answer (assert the ask card hides = resume + run terminal) -> assert zero 400 (D-17) -> LangSmith provider-matched trace (soft if key unset). No `page.reload`; the only `page.goto`s (`/settings`, `/`) precede the first file write.

## Verification Results (Task 2 — automated, no live backend)

- `cd frontend && npx playwright test --list` → lists scenario-13 under **both** an `[anthropic]` and a `[google]` describe block (parameterized — confirmed).
- `cd frontend && npx tsc --noEmit` → grep for `scenario-13` returns nothing (no new type errors attributable to the file).
- Structural checks: 294 lines (>= 120); imports `./fixtures/{auth,db-teardown,langsmith}.fixture`; references `claude.*haiku` + `gemini.*3.*flash` (no real `gemini-2.5` model regex — only a comment noting why it's excluded); contains `role="listbox"`/`role="option"`/`role="region"`/`role=group`, `ask_user`/`Needs you`, `Send Answer`, the `askCard.toBeHidden` resume assertion, and the `bad400Responses ... toEqual([])` assertion; **zero** `page.reload(`; both `page.goto` calls occur before the file write.

## Operator Run Command (live green pass — Plan 05 / VALIDATION gate)

This plan AUTHORS the scenario; it does NOT run it live (no backend started here — [[feedback_user_starts_backend]]). The live green pass on both providers is the operator's job in Plan 05 / `088-VALIDATION.md`.

```
# 1. Start the local backend (orphan-worker aware) in a visible terminal:
#    (PowerShell) scripts/restart-backend.ps1   |   (bash) scripts/restart-backend.sh
# 2. Confirm Anthropic API key + Google API key with a gemini-3.x model
#    available (Settings UI / backend/.env). The scenario fails LOUDLY if a
#    provider/key/model is missing — by design (scenario-02 precedent, no silent skip).
# 3. Run scenario-13 (workers:1 -> serial, shared DB-teardown):
cd frontend && npm run e2e -- scenario-13
```

Notes: `npm run e2e` = `playwright test` (frontend/package.json). For the LangSmith provider-match assertion to be enforced (not soft-skipped), set `LANGSMITH_API_KEY`. For the DB-teardown fixture to operate, `SUPABASE_URL` must contain `localhost`/`127.0.0.1` and `SUPABASE_SERVICE_ROLE_KEY` must be set (localhost service-role key only).

## Decisions Made

See `key-decisions` in the frontmatter. Summary: assert-then-expand to open the default-open panel (never blind-toggle the ⌘./Ctrl+. shortcut); select the diff region by `aria-label^="Diff v"` to disambiguate from the PanelSection bodies (which are also `role=region`); reach the diff via file-row click (lifts `selectedFile`, 087-02) + expand the Versions accordion (defaultOpen=false); keep the zero-400 assertion on both axes (D-17 only requires Google).

## Deviations from Plan

None - plan executed exactly as written.

The plan's interface notes anticipated a bare `[role="region"]` diff selector; the authored selector tightens this to `aria-label^="Diff v"` (with a bare-region+has fallback) — this is a faithfulness improvement, not a deviation: it matches the same VersionDiff region the plan named (`VersionDiff:216`, `aria-label={label}` where label is "Diff v...") while avoiding false matches against the PanelSection region bodies (`PanelSection:91`). The plan explicitly allowed this ("or by aria-label^=\"Diff v\"").

## Issues Encountered

None. The panel-open mechanism required a source check (ChatLayout defaults to "open"; the 087-08 consolidation removed the chat-header toggle, leaving the in-panel "Collapse workspace" + rail "Expand workspace" controls and the ⌘./Ctrl+. toggle) — resolved by reading ChatLayout/WorkspacePanel/PanelRail and choosing the assert-then-expand approach so the test is robust whether the panel starts open or on the rail.

## User Setup Required

The scenario's LIVE execution (Plan 05 gate) requires the operator to configure providers — captured in the plan's `user_setup` (Anthropic API key + Google API key with a gemini-3.x model; `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` default to the local test login). No new setup is introduced by authoring the spec itself.

## Next Phase Readiness

- scenario-13 is authored, discovered by Playwright (both provider blocks), and type-clean — ready for the Plan 05 operator live green pass (Anthropic + Google) as the SC#4 / D-17 automated backstop.
- Plan 04 (SEED-034 conditional fold) and Plan 05 (verification capstone: 4-axis scoreboard, long-message manual axis, SEED-034 fold-gate decision, a11y Lighthouse + lived-experience pass, D-17 report close) remain.
- D-17 close: the report flips to `closed (verified)` only after the live run shows zero 400 on Google (Plan 05); this plan provides the automated guard, not the live evidence.

## Self-Check: PASSED

- FOUND: `frontend/tests/e2e/scenario-13-workspace-deep-flow.spec.ts`
- FOUND: `.planning/phases/088-cross-cutting-verification-accessibility/088-03-SUMMARY.md`
- FOUND: commit `0e9469f4` (Task 1)

---
*Phase: 088-cross-cutting-verification-accessibility*
*Completed: 2026-05-29*
