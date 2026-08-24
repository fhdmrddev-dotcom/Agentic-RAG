---
phase: 192-workflow-library-ia
verified: 2026-08-11T03:41:31Z
status: gaps_closed
score: 6/6 must-haves verified (5/6 at verification; the one gap CLOSED under G-3 at 60b8842f)
overrides_applied: 0
gap_closure:
  applied_as: "G-3 fast-fix, NOT a gap-closure round"
  commit: "60b8842f"
  rationale: >
    G-7 ran clear (0 gap-closure plans in this phase). All four ROADMAP success criteria were
    already verified, so no criterion was unmet. The offending code was dated: the empty-state
    branch is b4d2f837 (192-10) and LIBRARY_STATES[source-failed] is 94a565f4 (192-05) — both
    this phase own output from the same day, which G-7 names as a signal to fast-fix rather
    than open a round. The fix is one render branch plus one regression test, no schema and no
    API surface, which is squarely G-3.
  proof: >
    The new test was driven RED against the pre-fix source, failing exactly on
    queryByTestId(library-empty) with "You have no workflows yet." rendered while all three
    feeds had rejected. The source was then restored md5-identical (b7799812) before the green
    run, so the RED was measured against the real defect and not against a mutilated file.
  gates_after: "count gate 60/60 pinned, total 3176, failed 0; WorkflowsPage suite 40/40; tsc unmoved at 33; eslint 0"
gaps_resolved:
  - truth: "The library never asserts 'You have no workflows yet' when it actually could not load any feed (the honest-empty-state contract this phase itself authored and enforces everywhere else)"
    status: resolved
    resolved_by: "60b8842f — three-way empty-state branch + all-three-feeds-fail regression test, RED-proved"
    reason: >
      Independently reproduced at HEAD (d83f7153, same commit that only ADDS 192-REVIEW.md —
      CR-01 was never fixed after being found). WorkflowsPage.tsx's empty-state branch
      (~lines 919-945, re-derived by content per the line-number-unreliability warning) keys
      off `rows.length === 0` alone and never consults `failedSources`. `loading` is
      `!anySettled`, and a *failed* source counts as settled. When every one of the three
      feeds (published/starters/drafts) rejects, the page renders three "we couldn't load X"
      banners AND "You have no workflows yet." simultaneously — two mutually contradictory
      claims about the same list. `LIBRARY_STATES["source-failed"]` in libraryVocabulary.ts:146
      was written for exactly this state (confirmed by grep: referenced nowhere but its own
      declaration). Neither of the two existing failure tests
      (WorkflowsPage.test.tsx:525-571, :1032-1065) exercises the all-fail case — both reject
      only /drafts while the other two feeds return rows, so the suite pins the correct branch
      and never enters the wrong one.
    artifacts:
      - path: "frontend/src/pages/WorkflowsPage.tsx"
        issue: "Empty-state ternary (~:919-945) is two-way (rows.length===0 vs filtered-empty) when it needs to be three-way; ignores failedSources.length entirely"
      - path: "frontend/src/components/workflows/library/libraryVocabulary.ts"
        issue: "LIBRARY_STATES['source-failed'] (:146) is dead code — the correct sentence exists and is never rendered"
    missing:
      - "Add a failedSources.length > 0 branch ahead of the rows.length === 0 check, rendering LIBRARY_STATES['source-failed'] with its own testid"
      - "A regression test that rejects ALL THREE feeds and asserts library-empty is null while a source-failed node is present"
human_verification:
  - test: "U6 — Pick a project in the toolbar and read what happens to the Starters group"
    expected: "Starter rows remain visible and the toolbar states in plain words why (e.g. 'Starters aren't tied to a project.') — never silent"
    why_human: "Requires a live 200-workflow dataset and reading actual rendered toolbar text on a running app; code confirms the string ships (PROJECT_STARTERS_NOTE) but not that it is visible/legible at real scale. Recorded as OWED in 192-VALIDATION.md (operator decision 2026-08-11, run this row first)."
  - test: "U3 — Confirm the create affordance is reachable with zero scroll at 200 workflows"
    expected: "getBoundingClientRect().top < window.innerHeight at first paint, and it is the first interactive element in DOM order"
    why_human: "DOM-order is unit-tested (compareDocumentPosition) but the actual scroll-free reachability at real viewport size and 200-row scale needs a live render. Recorded as OWED."
  - test: "U5 — Operator reads a card and states what 'Tweak'/fork will do before clicking, then clicks and compares"
    expected: "Stated expectation matches actual behavior — the surprise LIB-03 exists to end no longer occurs"
    why_human: "Subjective comprehension check; cannot be graded by grep/unit test. Recorded as OWED."
  - test: "U1, U2, U4, U7, U8, U9, U10, U11 — the remaining eight G-4 lived-experience rows"
    expected: "See 192-VALIDATION.md § Manual-Only Verifications for full pass bars"
    why_human: "Visual/interaction verification at 200-workflow scale via Chrome MCP. All eleven G-4 rows are recorded OWED — NOT RUN — as an explicit, dated operator decision (2026-08-11: 'close with the rows owed, U6 first'), per CLAUDE.md's explicit allowance for closing with owed UAT when stated as a decision rather than a claim."
---

# Phase 192: Workflow Library IA — Verification Report

**Phase Goal:** The Workflows page can be searched, filtered and read at a glance, and its card actions are predictable.
**Verified:** 2026-08-11T03:41:31Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LIB-01 / SC#1: A user can find a named workflow by typing part of its name (and a word only in the purpose sentence, D-07) | ✓ VERIFIED | `libraryFilter.ts:171-190` — substring, case-insensitive match over `row.name` and `def.business_requirement`. `WorkflowsPage.test.tsx` + `libraryFilter.test.ts` pass (210/210 tests green, independently re-run). D-08 paraphrase-returns-zero is fenced (F5) and tested. |
| 2 | LIB-01/LIB-02 / SC#2: A user can narrow the list without reading every card, with honest chip counts | ✓ VERIFIED | Six chips (`Ready to run · Yours · Still building · Starters · Makes a file · 🔒 Strict`) computed by `chipCounts()` over the SAME rendered row set (`libraryFilter.ts:262-282`). `LibraryToolbar.test.tsx` asserts `chipCount(c) === renderedRows.filter(pred(c)).length`. D-17: published rows narrow server-side, drafts client-side, starters held out with `PROJECT_STARTERS_NOTE = "Starters aren't tied to a project."` (`libraryVocabulary.ts:131`) confirmed live in `LibraryToolbar.tsx:337`. |
| 3 | LIB-02: A card shows what the workflow is for, at a glance, without decoding internal vocabulary | ✓ VERIFIED | `WorkflowCard.tsx` consumes `WorkflowSoul scale="card"` unchanged (all five atoms). D-11 developer-vocabulary strings (`GET /workflows/published`) removed; fence F2 confirms no such text renders. Confirmed via grep: zero `title=` in production `library/**` source (only in test-fence plants). |
| 4 | LIB-03 / SC#3: A user can predict what a card action does before clicking; "Tweak" no longer surprises | ✓ VERIFIED (code) / see WR-03 note | `Publish…` (a button that lied — both `onClick={onOpen}`) removed; fence F3 with positive control confirms absence. One primary verb + `⋯` overflow per row state (`WorkflowCard.tsx:19-20`). Fork consequence sentence is real DOM text wired via `aria-describedby` (`:396`, `:405`), never `title=`. `onTweak`/`onUseStarter` correctly kept as siblings (D-12), not merged. **Caveat:** code review WR-03 (independently confirmed unfixed at HEAD) found both fork handlers swallow every error into `console.error` with zero user-visible signal — a 409/401/5xx on the fork click produces total silence, which undermines "predictable" for the failure path specifically. Not severe enough alone to fail the truth (the success-path promise IS met and tested), but it is a real, unfixed gap — see Anti-Patterns/Warnings below. |
| 5 | LIB-04 / SC#4: The create affordance is reachable without scrolling past existing workflows | ✓ VERIFIED (structural) | Create control is the first interactive element in the toolbar DOM (`LibraryToolbar.tsx:196-199`, `data-testid="library-create"`), asserted via `compareDocumentPosition` in both `LibraryToolbar.test.tsx` and `WorkflowsPage.test.tsx:1339-1349`. Structurally guaranteed — no grid can appear above it (D-02: shelves replaced by chips, not a grid). Real-viewport zero-scroll confirmation at 200 rows is UAT row U3, OWED (see Human Verification). |
| 6 | The library never claims "you have no workflows" when it actually could not load them (the honest-empty-state contract this phase's own vocabulary/comments establish everywhere else on this page) | ✗ FAILED | **CR-01, independently reproduced.** `WorkflowsPage.tsx` (~:919-945) branches only on `rows.length === 0`, ignoring `failedSources`. When every feed rejects, the page shows three "couldn't load" banners AND "You have no workflows yet." simultaneously. `LIBRARY_STATES["source-failed"]` exists for exactly this case and is dead code. Confirmed unfixed at HEAD (`d83f7153` only adds the review document, no follow-up commit). No test covers the all-fail case. |

**Score:** 5/6 truths verified (1 code-level defect independently confirmed as a live BLOCKER)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/workflows/library/libraryRow.ts` | Types-only leaf (`LibraryRow`, `Provenance`, `ChipId`) | ✓ VERIFIED | 100 L, exists, imported everywhere in subtree |
| `frontend/src/components/workflows/library/libraryVocabulary.ts` | Single vocabulary home | ✓ VERIFIED | 162 L, `FORK_CONSEQUENCE`, `LIBRARY_STATES`, `PROJECT_STARTERS_NOTE` all present |
| `frontend/src/components/workflows/library/libraryFilter.ts` | Merge/dedupe/chip/search logic, pure | ✓ VERIFIED | 284 L, pure (no runtime API import), `libraryFilter.test.ts` 100% green |
| `frontend/src/components/workflows/library/RunModal.tsx` | Verbatim move, 6-state characterization | ✓ VERIFIED | 430 L, `RunModal.test.tsx` + `.a11y.test.tsx` pass; import direction correct (page imports module, not reverse) |
| `frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx` | Verbatim move, 7-state characterization | ✓ VERIFIED | 296 L, `PublishedCardDelete.test.tsx` passes on original render path |
| `frontend/src/components/workflows/library/LibraryToolbar.tsx` | Create-leads, always-on search, 6 chips, project select + D-17 note | ✓ VERIFIED | 358 L, `LibraryToolbar.test.tsx` (365 L) covers DOM order, count honesty, a11y, no-title |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | Unified 159-C card | ✓ VERIFIED (with WR-03/WR-04 caveats, see Warnings) | 545 L, `WorkflowCard.test.tsx` 460 L covers verb contract, provenance branch, aria-describedby round trip |
| `frontend/src/components/workflows/library/librarySubtree.fences.test.ts` | F1-F5 negative fences | ✓ VERIFIED | 603 L, 64/64 tests pass; independently re-run |
| `frontend/src/pages/WorkflowsPage.tsx` | Composition — merged feed via `allSettled`, one flat list | ✓ VERIFIED (structure) / ✗ has CR-01 defect | 1007 L (was 1407), `allSettled` confirmed present; CR-01 lives here |
| `backend/app/api/workflows.py` + `backend/app/db/workflows.py` | `is_mine` + `is_system_global` computed server-side, no raw `created_by` on wire | ✓ VERIFIED | Confirmed by reading `list_published_workflows`/`list_starter_workflows` handlers; `test_published_workflow_ownership.py` 17/17 pass (independently re-run) |
| `scripts/vitest-count-gate.cjs` | Adopted + pinned suites for the phase | ✓ VERIFIED | Gate run independently: 60 files pinned, total 3175, **failed 1** (see below — not attributable to 192) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `WorkflowsPage.tsx` | `library/RunModal.tsx` | named import | ✓ WIRED | `import { RunModal } from "@/components/workflows/library/RunModal"` present; page declares no RunModal itself |
| `WorkflowsPage.tsx` | `library/WorkflowDeleteSheet.tsx` | named import | ✓ WIRED | Confirmed — Sheet lives in its own module, mounted from the card/page composition |
| `WorkflowsPage.tsx` | `library/libraryFilter.ts` | `filterLibrary`/`chipCounts`/`mergeLibrary` | ✓ WIRED | Confirmed used in the page's render path |
| `LibraryToolbar.tsx` | `libraryVocabulary.ts` | imports `CHIP_WORDS`, `PROJECT_STARTERS_NOTE`, etc. | ✓ WIRED | Confirmed |
| `WorkflowCard.tsx` | `deleteWorkflowDraft` (D-18) | draft delete calls this, never the cascade path | ✓ WIRED | Confirmed distinct from `deleteWorkflowCascade`; D-18 correctly wired |
| `library/*` modules | `@/pages/WorkflowsPage` (F4, forbidden direction) | negative fence | ✓ NOT_WIRED (correctly absent) | Fence F4 passes; no reverse import found |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Frontend typecheck stays at pre-phase baseline (33) | `npx tsc -p tsconfig.app.json --noEmit \| grep -c "error TS"` | `33` | ✓ PASS (unmoved from baseline) |
| eslint clean on the library subtree | `npx eslint src/components/workflows/library src/pages/WorkflowsPage.tsx` | no output (0 errors) | ✓ PASS |
| Library + WorkflowsPage test suite | `vitest run src/pages/WorkflowsPage.test.tsx src/components/workflows/library` | 5 files, 210/210 passed | ✓ PASS |
| Negative fences (F1-F5) suite | `vitest run librarySubtree.fences.test.ts` | 64/64 passed | ✓ PASS |
| Backend ownership contract + fence | `pytest tests/unit/test_published_workflow_ownership.py` | 17/17 passed | ✓ PASS |
| Full count gate | `node scripts/vitest-count-gate.cjs` | total 3175, pinned 3151, **failed 1** | ⚠ SEE NOTE — the 1 failure is inside `WorkflowBuilderPage.canvas.test.tsx`, the documented pre-existing Phase-184 D-14-11 positive-control intermittent (2 of 14 gate runs per ROADMAP). Re-run of that file in isolation: 133/133 passed. Independently confirmed as NOT attributable to Phase 192 — 192 never touches that file. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| LIB-01 | 01, 02, 05, 07, 10, 11, 12 | Search by name, filter the list, instead of scanning unlabelled shelves | ✓ SATISFIED (with CR-01 caveat affecting the "list is honest" half) | Substring search + chips + D-17 starters-carve-out all confirmed in code and tests |
| LIB-02 | 01, 02, 05, 07, 09, 10, 11, 12 | Card shows purpose at a glance, no internal vocabulary | ✓ SATISFIED | `WorkflowSoul` unchanged, D-11 dev-strings removed, F2 fence green |
| LIB-03 | 01, 03, 04, 05, 06, 08, 09, 10, 11, 12 | Predictable card actions; "Tweak" must not silently open a full edit surface | ✓ SATISFIED (WR-03 failure-silence is a real but non-blocking gap) | Publish removed (F3), one verb + `⋯`, consequence sentence via `aria-describedby`, D-12 siblings preserved |
| LIB-04 | 01, 07, 10, 11, 12 | Create affordance findable without scrolling past two shelves | ✓ SATISFIED (structural); runtime confirmation OWED (U3) | DOM-order proof via `compareDocumentPosition`, unit-tested |

No orphaned requirements found — REQUIREMENTS.md maps only LIB-01…04 to Phase 192, and all four are declared across the 12 plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/WorkflowsPage.tsx` | ~919-945 | Empty-state branch ignores `failedSources` (CR-01) | 🛑 Blocker | Page asserts "no workflows" during a total outage — the exact "looks like lost data" failure class this codebase has a standing memory entry about |
| `frontend/src/pages/WorkflowsPage.tsx` | :499-514, :538-555 | Fork handlers swallow all errors into `console.error` only (WR-03) | ⚠ Warning | Undermines "predictable" specifically on the failure path — click produces total silence on 409/401/5xx |
| `frontend/src/pages/WorkflowsPage.tsx` | :318-323, `libraryFilter.ts:214-233` | Failed published re-query leaves stale project's rows on screen, waved through the (now-stale) server-narrowed contract (WR-02) | ⚠ Warning | Contradicts its own failure banner — rows shown don't belong to the newly-selected project |
| `frontend/src/pages/WorkflowsPage.tsx` | :346-362, :869-877 | A by-design 403 on `/drafts` (visibility-gated) renders as a permanent generic failure banner (WR-01) | ⚠ Warning | Authorization refusal presented as an error to a normal, policy-correct audience |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | :345, :414-423 | Delete gate reuses the *Yours* chip predicate, whose degraded default is "assume it's yours" (WR-04) | ⚠ Warning | Latent — safe today only because `WorkflowsPage` fetches with `?scope=mine`; exported component has no such guarantee for future consumers |
| `frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx` | :128-140 | Preview fetch has no latest-wins sequence guard (WR-05, pre-existing/inherited) | ⚠ Warning | Inherited from the verbatim move; stale preview can hide a live run before a destructive action |
| `frontend/src/components/workflows/library/WorkflowCard.tsx` | :430-442 | Draft-delete confirmation prompt not announced/focused for a11y (WR-06) | ⚠ Warning | Screen-reader/keyboard user gets no signal a confirmation appeared |
| `scripts/vitest-count-gate.cjs` | :1512-1529 | Env var interpolated into `shell: true` spawn (WR-07, pre-existing) | ⚠ Warning | Defence-in-depth issue, not a live exploit; file is in-scope because the gate is load-bearing for this phase |
| `frontend/src/pages/WorkflowsPage.tsx` | :550-555 | Fork retry classifies 409 via `String(e).includes("409")` string-matching (WR-08) | ⚠ Warning | Fragile control flow keyed on error prose |

No `TBD`/`FIXME`/`XXX` debt markers found in any file touched by this phase (checked via targeted grep across `WorkflowsPage.tsx`, the entire `library/` subtree, and the two backend files).

### Human Verification Required

All eleven G-4 lived-experience UAT rows (U1–U11) are recorded **OWED — NOT RUN** in `192-VALIDATION.md`, per an explicit, dated operator decision (2026-08-11: *"close with the rows owed, U6 first"*). This is accepted under CLAUDE.md's explicit allowance for closing a phase with owed manual UAT when stated as a decision — it is being surfaced here, not double-penalized, but it does mean the phase's `human_needed` items are real and unresolved:

1. **U6 (run first)** — Pick a project → confirm starters remain visible **with a stated reason** in the live UI (not just in source). Silence is a FAIL. Exists because of a measured IA defect no structural test can catch.
2. **U4 (run second)** — Confirm zero `[title]` attributes render in the library's own chrome (excluding the inherited `WorkflowSoul`/`PhaseSpine` carve-out) via touch/no-hover.
3. **U1–U3, U5, U7–U11** — The remaining eight rows (search-at-scale, chip narrowing, zero-scroll create, Tweak-predictability, paraphrase-honesty, delete-Sheet behavior, Run-launch, touch-only, draft-delete). Full pass bars in `192-VALIDATION.md`.

See frontmatter `human_verification` for the structured form.

### Gaps Summary

**One BLOCKER, independently confirmed in the codebase at HEAD (`d83f7153`):** the library's empty-state logic asserts "You have no workflows yet" during a total feed outage, contradicting the "we couldn't load X" banners rendered on the same screen. The phase's own code review (`192-REVIEW.md`, CR-01) found this and it was never fixed — the review-adding commit is HEAD itself, with no follow-up commit. The fix is small and precisely scoped (the review even supplies the patch and the missing test), but it is unresolved as of this verification.

Everything else checked — search, chips, card verb unification, Publish removal, fork-consequence wiring, create-leads-toolbar, backend `is_mine`/`is_system_global`, all five negative fences, the two verbatim moves, count-gate adoption — is independently confirmed present, substantive, wired, and passing its own tests (210+64+17 = 291 tests independently re-run and green, plus the two known-flake/owed items explicitly called out and not double-counted against this phase).

The eleven owed G-4 UAT rows are a separate, already-acknowledged category (legitimate per CLAUDE.md, not treated as a fresh finding here) but they do mean LIB-04's "reachable without scrolling," LIB-01's "starters stay visible with a stated reason" at real scale, and LIB-03's "Tweak no longer surprises" (the human-comprehension half) remain formally unconfirmed at runtime.

**Recommendation:** CR-01 is a small, well-specified fix (the review supplies the diff). Given G-7's gap-closure-round guidance, this looks like a fast-fix (single file, well under 10 lines, no schema/API surface) rather than a full closure round — but it is a real, unresolved BLOCKER and should not be waved through without either the fix landing or an explicit override being recorded.

---

_Verified: 2026-08-11T03:41:31Z_
_Verifier: Claude (gsd-verifier)_
