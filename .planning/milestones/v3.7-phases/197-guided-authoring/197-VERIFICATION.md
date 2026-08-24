---
phase: 197-guided-authoring
verified: 2026-08-18T15:10:00Z
status: human_needed
score: 3/3 roadmap success criteria verified in code; 11/11 plan must-haves verified; 9 G-4 UAT rows owed
overrides_applied: 0
human_verification:
  - test: "U1 — the arrival moment: describe a workflow, press the CTA, confirm what lands is ONE card of about four lines (not two stacked cards, not a wall), and the graph is still the biggest thing on screen. Also check below ~900px viewport width."
    expected: "One compact arrival card; graph remains dominant; below ~900px the layout does not collapse the graph to near-zero."
    why_human: "jsdom applies no CSS — geometry/visual composition can only be proven by looking, not by DOM assertions. Recommended first row to drive (cheapest, exact defect sketch 174 shipped)."
  - test: "U2 — the fast door still feels fast: run both the LOOSE door (WorkflowDoorSwitch) and the GOVERN door (WorkflowBuilderPage) pre-draft describe screens and confirm neither asks for anything new."
    expected: "No extra control, no extra required field, no new gate on either door."
    why_human: "Lived-experience 'feel' of friction is not reducible to the mechanical numstat criteria (which passed)."
  - test: "U3 — a decision is answerable and the answer sticks: change the knowledge base from the arrival card, confirm the header agrees instantly; reload the draft and confirm the answer persisted."
    expected: "Header and card show one answer instantly; the change survives a reload of the draft."
    why_human: "Requires a live browser session + DB read to confirm end-to-end persistence and instant reactivity."
  - test: "U4 — the requirement row on >= 2 providers (anthropic + openai minimum, per 193.2-FREQUENCY.md's measured 0/5 vs 5/5 contrast)."
    expected: "On one provider the row shows something durable; on another it may show a one-run parameter the author can see and fix in the row."
    why_human: "Generation quality is provider-dependent and must not be scored on a single provider — no automated check can assess 'durability' of free text."
  - test: "U5 — row and header do not contradict: confirm the arrival card's name row and the header strip show the SAME workflow name, never two different answers."
    expected: "Card row 4 and header identity slot agree on the workflow's name at all times."
    why_human: "This is the exact defect sketch 174 shipped and was caught only by looking; both plans 197-09/197-10 named it explicitly owed."
  - test: "U6 — the name row is the name's first honest display: edit the name via row 4's inline field, confirm what was typed is what subsequently displays (not the slug, e.g. not northwind-qbr-fa65a43c)."
    expected: "After editing, the header and row show the typed name, not the slug."
    why_human: "Requires driving the actual inline-edit interaction and observing the rendered result live."
  - test: "U7 — dismissal is an offer, not a wall: press the dismiss (X) control and confirm the card disappears and the graph takes the freed space, with nothing lost or silently saved."
    expected: "Card unmounts cleanly; graph expands to fill the freed row; no side effects."
    why_human: "Visual/layout confirmation, not a DOM-presence assertion."
  - test: "U8 — the deliverable row leads somewhere real: click the deliverable row's action and confirm it opens the step that actually produces the file, landing on the field that decides what it says."
    expected: "Jump navigates to the terminal llm_emit step's Instructions field."
    why_human: "Requires driving real navigation/focus behavior in a live canvas, option (ii) only per 197-VALIDATION.md."
  - test: "U9 — legibility of the 11px controls: confirm rows route to header controls that are actually readable, and the 'AI-proposed' mark reads beside a real sentence."
    expected: "Header affordances reached via row actions are legible; AI-proposed mark is not orphaned."
    why_human: "Visual legibility judgement; inherits 193.2-09's owed sliver (never browser-UAT'd)."
---

# Phase 197: Guided Authoring Verification Report

**Phase Goal:** Drafting from a description guides the decisions that matter.
**Verified:** 2026-08-18T15:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user drafting from a description is asked the decisions that change the result, rather than receiving a finished draft in one shot | ✓ VERIFIED (mechanically, in code) | `DecisionsList.tsx` renders all 5 D-07 rows (`DECISION_ROW_ORDER` in `decisionsVocabulary.ts:83-89`) every time, each wired to a real interactive control: row 1 (`onClick={onChangeKb}` → focuses `project-folder-picker`), row 2/5 (`onOpenStep` → `jumpToStep` → selects the terminal `llm_emit` step via `terminalEmitSlug`), row 3 (`onClick={onChangeRequirement}` → focuses `business-requirement-input`), row 4 (`<input onChange={(e)=>onChangeName(e.target.value)}>` → `builderStore.setName`, verified as a genuine new store action at `builderStore.ts`). All controls confirmed wired end-to-end in `WorkflowBuilderPage.tsx:1685-1770`. This is genuinely "asked" (interactive, answer writes to the live definition) not merely "reported" — the distinction D-01/D-03 require. Full-suite green: 226 tests across the 5 new unit-level files, 254 tests across the 3 integration/page suites, all independently re-run by the verifier (not merely trusted from SUMMARY). |
| 2 | The fast door stays fast — guidance must not turn "Describe & run" into the strict door (D-05) | ✓ VERIFIED (mechanically, independently re-run) | The 4 D-05/D-02/D-11 numstat criteria from plan `197-01` were re-run independently by the verifier against the recorded phase base SHA `52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07` and HEAD: `WorkflowBuilderPage.preDraft.baseline.test.tsx` — empty diff (0 deletions); `WorkflowDoorSwitch.baseline.test.tsx` — empty diff (0 deletions); `SeedReceipt.tsx` — empty diff (0 0, never touched); `backend/.../publish_service.py` — empty diff (0 0, never touched). All four PASS, confirming the pre-draft screens on both doors are byte-unchanged and the governance receipt / publish gate were never widened. One self-imposed (non-SC) criterion inside plan `197-09` — "zero deletions on `WorkflowBuilderPage.canvas.test.tsx`" — was measured as FAILED (28 deletions) and is **honestly recorded as failed, not reinterpreted** in `197-09-SUMMARY.md`; it is a suite-level cleanup cost of the declared mount-replacement, not a violation of the SC#2 red line itself. |
| 3 | A user can still get a one-shot draft if they want one | ✓ VERIFIED by construction | The generation call site (`useTemplateFirstDraft.ts`), the CTA, and the single `/workflows/generate` call are untouched by this phase (confirmed: the only edit to `useTemplateFirstDraft.ts` is the `onDrafted` callback's *output* boundary, adding a second required parameter — never touching the screen or the generate call itself). The arrival card mounts with `open={showReceipt}`, and `showReceipt` is set exclusively inside the `onDrafted` handler (`WorkflowBuilderPage.tsx:2157`) — never gating or delaying the CTA. Dismissible (`onDismiss={() => setShowReceipt(false)}`), confirming the one-shot path is the path; guidance is strictly post-hoc and optional. |

**Score:** 3/3 roadmap success criteria verified in code.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/workflows/decisionsVocabulary.ts` | Copy-home for the 5 decision rows, DECISION_ROW_ORDER as data | ✓ VERIFIED | 226 lines (min 120), exports `DECISION_ROW_ORDER` (5 fixed keys), true leaf (no imports), D-20 fence present and passing |
| `frontend/src/components/workflows/decisionsVocabulary.test.ts` | Character-identity, exhaustiveness, D-20 fences | ✓ VERIFIED | 22 pinned cases, all pass in isolation and in full suite |
| `frontend/src/components/workflows/soulData.ts` (terminalEmitSlug) | Deterministic tie-break derivation for the deliverable step | ✓ VERIFIED | `terminalEmitSlug` exported at line 234, handles null/absent/malformed/multi-candidate cases |
| `frontend/src/components/workflows/soulData.test.ts` | RED-first tie-break/absence/malformed cases | ✓ VERIFIED | Passes in full suite run |
| `frontend/src/components/workflows/builderStore.ts` (setName) | Sole new store action, writes `meta.name` only, untracked by undo | ✓ VERIFIED | `setName` confirmed as the write path for row 4; slug fence present |
| `frontend/src/components/workflows/DecisionsList.tsx` | 5-row answerable decisions surface | ✓ VERIFIED | 329 lines (min 120), all 5 rows always rendered in fixed order, three-arm readiness read (`missing`/`present`/`undefined` → only `missing` renders anything) |
| `frontend/src/components/workflows/DecisionsList.test.tsx` | Row count/order, live answers, 3-arm readiness, writes, charter fences | ✓ VERIFIED | Full suite passes |
| `frontend/src/components/workflows/DraftArrivalCard.tsx` | Composing parent — ONE card, two components underneath | ✓ VERIFIED | 338 lines (min 100), composes `<SeedReceipt` unmodified behind a suppression wrapper, folds both default closed |
| `frontend/src/components/workflows/DraftArrivalCard.test.tsx` | One-card composition, fold contract, unmodified receipt, charter fences | ✓ VERIFIED | 35 cases, all pass, including positive controls for the suppression-list sweep |
| `backend/app/services/workflow_authoring.py` (readiness key) | D-13 readiness key on the single success return | ✓ VERIFIED | `readiness` dict built from `grounding.py`'s `business_requirement_missing` + `BUSINESS_REQUIREMENT_MISSING_MESSAGE`, single entry (`business_requirement`), never on the 4 failure arms |
| `backend/tests/unit/test_workflow_authoring_requirement.py` (D-14 fence) | ADVERTISED_BUT_NOT_ASKED fence + readiness cases | ✓ VERIFIED | 47 tests pass (independently re-run), fence has a positive control (`test_positive_control_the_checker_reports_a_synthetic_advertised_field`) |
| `frontend/src/lib/api.ts` (GenerateReadiness type) | Type-only union arm, no runtime export | ✓ VERIFIED | `export type GenerateReadiness` + widened `GenerateResult`, no runtime symbol added |
| `frontend/src/pages/WorkflowBuilderPage.tsx` (mount) | Arrival card mounted in receipt's place | ✓ VERIFIED | `<DraftArrivalCard` mounted at line 2162, `<SeedReceipt` no longer rendered directly on the page |
| `frontend/src/pages/WorkflowBuilderPage.tsx` (identity expression) | meta.name ?? meta.slug in header | ✓ VERIFIED | `identityLabel` expression at line 2456; slug never written |
| `scripts/vitest-count-gate.cjs` (3 new pins) | BASELINE pins for the 3 new suites | ✓ VERIFIED | `decisionsVocabulary.test.ts: 22`, `DecisionsList.test.tsx: 54`, `DraftArrivalCard.test.tsx: 35` all present |
| `CLAUDE.md` / `docs/HOT-FILE-LEDGER.md` (ledger sync) | Re-derived rows + matching detail sections | ✓ VERIFIED | Rows present for all 3 new files + re-derived `grounding.py` row (measured unchanged); matching `HOT-FILE-LEDGER.md` sections present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `workflow_authoring.py` | `grounding.py` | `from app.services.harness.grounding import business_requirement_missing, BUSINESS_REQUIREMENT_MISSING_MESSAGE` | ✓ WIRED | Confirmed at line 608-611; single-source predicate, no local copy |
| `useTemplateFirstDraft.ts` (`onDrafted`) | page's `onDrafted` handler | second required callback arg carrying `readiness` | ✓ WIRED | `onDraftedRef.current(def, result.readiness)` at line 577; page destructures `(def, verdict)` at line 883 |
| `DraftArrivalCard.tsx` | `SeedReceipt.tsx` | composition, unmodified | ✓ WIRED | `<SeedReceipt` rendered inside a suppression wrapper; `SeedReceipt.tsx` itself shows zero diff against phase base |
| `WorkflowBuilderPage.tsx` | `DraftArrivalCard.tsx` | mount replacing `<SeedReceipt/>` in place | ✓ WIRED | `<DraftArrivalCard phases=... open={showReceipt} decisions={decisions} .../>` confirmed at line 2162-2168, `graphColumn` still 3 children |
| Card rows | header affordances | `focusKbPicker`/`focusRequirementInput` → `project-folder-picker`/`business-requirement-input` testids | ✓ WIRED | Both ref-based focus handoffs confirmed targeting the real header controls |
| `DecisionsList.tsx` | `decisionsVocabulary.ts` | every visible string imported | ✓ WIRED | Confirmed via source read + passing charter fence tests |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `DecisionsList` (via `decisions` prop) | `readiness` | Server's `/workflows/generate` response, `readiness.business_requirement` derived from `grounding.py`'s live predicate over the freshly generated `WorkflowDefinition` | Yes — driven from the real stage-1 gauntlet predicate, not a static stub | ✓ FLOWING |
| `DecisionsList` (via `decisions` prop) | `folderName`, `templateFilename`, `businessRequirement`, `name`, `deliverableStepSlug` | All read LIVE off `meta`/`definition` on every render (no `useState` mirror), confirmed via `useMemo` dependency array including `meta`, `definition`, `boundFolderName`, `templateAsset` | Yes — live store reads, not snapshots | ✓ FLOWING |
| `DraftArrivalCard` (`phases` prop) | `receiptPhases` | SNAPSHOT captured once per generation (unchanged shipped behavior from `SeedReceipt`'s existing contract) | Yes, and correctly kept immutable per its documented contract | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend readiness verdict test suite | `pytest backend/tests/unit/test_workflow_authoring_requirement.py -q` | 47 passed | ✓ PASS |
| New frontend unit suites (5 files) | `vitest run decisionsVocabulary.test.ts DecisionsList.test.tsx DraftArrivalCard.test.tsx soulData.test.ts builderStore.test.ts` | 226 passed | ✓ PASS |
| Page-level integration suites | `vitest run WorkflowBuilderPage.canvas.test.tsx WorkflowBuilderPage.header.test.tsx useTemplateFirstDraft.test.tsx` | 254 passed | ✓ PASS |
| D-05 mechanical numstat criteria (4, independently re-run against HEAD) | `git diff --numstat <base> HEAD -- <path>` ×4 | all empty diffs (0 deletions / 0 0) | ✓ PASS |
| TypeScript baseline | `tsc --noEmit -p tsconfig.app.json` | 33 errors, unmoved from documented baseline; none in phase-touched files | ✓ PASS |
| Deploy-artifact drift | `bash scripts/check-deploy-drift.sh` | PASS (2 pre-existing non-blocking WARNs, unrelated to this phase) | ✓ PASS |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` | exit 0, 69,681 chars / 46.5% | ✓ PASS |
| G-7 gap-closure round cap | `node scripts/check-gap-closure-rounds.cjs 197` | clear, 0 gap-closure plans | ✓ PASS |
| Full count-gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | total 4447, pinned 4328, **failed 1** — `WorkflowsPage.test.tsx` (`STACK_TRACE_ERROR`) | ⚠ SEE NOTE |

**Note on the one count-gate failure:** the failing suite, `frontend/src/pages/WorkflowsPage.test.tsx`, is (a) confirmed byte-unchanged by this phase — `git diff --numstat <phase-base> HEAD -- frontend/src/pages/WorkflowsPage.test.tsx` returns empty — and (b) one of CLAUDE.md's five SEED-171-documented flaky suites. Re-run in isolation immediately after: 55/55 passed. Following CLAUDE.md's own recorded protocol ("if it is byte-unchanged and one of SEED-171's [suites], record it as an observation and move on"), this is recorded as a known flake, not a phase-197 regression, and does not affect the phase's status determination.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| AUTH-02 | 197-01 through 197-11 (all 11 plans) | "A user drafting from a description is guided through the decisions that matter, rather than getting one shot at a prompt and a finished draft" | ✓ SATISFIED (in code; UAT owed) | All three ROADMAP success criteria verified above; `.planning/REQUIREMENTS.md` line 27 checkbox remains unticked — this is the orchestrator's to update, not the verifier's, and is correctly left pending given the owed human-verification rows |

No orphaned requirements — REQUIREMENTS.md's phase-197 row (line 138) maps only AUTH-02 to this phase, and all 11 plans declare `requirements: [AUTH-02]` consistently.

### Anti-Patterns Found

None. Scanned all phase-touched non-test source files (`decisionsVocabulary.ts`, `soulData.ts`, `DecisionsList.tsx`, `DraftArrivalCard.tsx`, `builderStore.ts`, `api.ts`, `useTemplateFirstDraft.ts`, `WorkflowBuilderPage.tsx`, `workflow_authoring.py`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns. No unreferenced debt markers found; incidental `Todo` type-name and `todo_updated` SSE-event matches are not markers.

### Human Verification Required

**All nine G-4 lived-experience UAT rows (U1–U9) are owed** — no human has driven this surface. This is honestly and consistently disclosed across `197-VALIDATION.md`, `197-09-SUMMARY.md`, `197-10-SUMMARY.md`, and `197-11-SUMMARY.md` (which explicitly names all 9 as OWED, not run). Per the phase's own recommendation, drive **U5 first** (cheapest, the exact defect sketch 174 shipped), then U1, U4, U6 — the four the phase itself flags as highest-value. Full detail per row is in the frontmatter `human_verification` list above and in `.planning/phases/197-guided-authoring/197-VALIDATION.md`.

Closing with these rows owed is a legitimate, honestly-recorded decision (per this project's own G-4/CLAUDE.md precedent for prior phases) — not a code gap. Everything checkable mechanically (all 3 ROADMAP success criteria, all plan-level must-haves, all key links, all data flows) is verified and green.

### Gaps Summary

No code-level gaps found. Every artifact this phase claimed exists, is substantive (well above minimum line counts, with genuine positive-control test fences rather than tautological assertions), and is wired end-to-end from the backend predicate source through to interactive UI controls. The two items the phase itself declared "not met as literally written" (the `197-09` canvas-suite zero-deletion criterion, and the `197-11` `grep -c == 3` criterion) are self-imposed, non-SC criteria, honestly recorded as failed with sound reasoning, and do not touch any ROADMAP success criterion. The single count-gate test failure encountered during this verification (`WorkflowsPage.test.tsx`) was independently confirmed to be the pre-existing, byte-unchanged SEED-171 flake, not a phase regression.

The phase cannot be marked `passed` only because nine G-4 UAT rows are genuinely owed and no human has yet driven the live surface — the standing project rule is that `passed` requires an empty human-verification section, and this phase has nine open items by its own honest account.

---

*Verified: 2026-08-18T15:10:00Z*
*Verifier: Claude (gsd-verifier)*
