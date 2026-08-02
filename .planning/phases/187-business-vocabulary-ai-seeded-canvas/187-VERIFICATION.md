---
phase: 187-business-vocabulary-ai-seeded-canvas
verified: 2026-08-02T09:30:00Z
status: gaps_found
score: 10/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/11
  gaps_closed:
    - "CR-01: the receipt's lead sentence no longer counts already-set/escalated steps under a 'so I set them' authorship claim — confirmed live at HEAD, SeedReceipt.tsx:212-217 splits detectedCount from carriedCount at the point of use"
    - "CR-02: SeedReceipt.test.tsx's llm_emit fixtures now use the shipped, real backend default citation_policy: 'strict' (not the unrepresentable 'loose'), with a representability guard pinning the member set"
    - "WR-02: derivedFace's folder tier (3) is now gated on GROUNDING_DIAL_TYPES (llm_agent, llm_batch_agents only) — confirmed live at phaseVocabulary.ts:516, a step type that cannot search no longer renders 'Search {folder}'"
  gaps_remaining:
    - "VOCAB-02 Req 5 (seed receipt legibility) is STILL FAILED, for a narrower, DIFFERENT reason than round 1. CR-01's fix (187-16) introduced a new sentence, seedReceiptCarriedLead ('N steps were already set to must prove it by its own settings'), which has ZERO test assertions anywhere in the repo (CR-03, confirmed live) and misattributes the 'escalated' cause (an author's deliberate hand-toggle) to 'its own settings' — a passive-policy phrase that is true of 'already-set' but false of 'escalated' (WR-09, confirmed live). This is the same failure class (a sentence claiming something false about who did what) recurring inside the very fix that closed the first instance."
  regressions: []
gaps:
  - truth: "A seeded draft with grounded steps shows a receipt naming exactly those steps, with reasons; a seeded draft with zero grounded steps shows no grounded-step list; every rendered sentence is honest about who applied the gate (SPEC Req 5 acceptance, extended by the CR-01 closure's own stated properties)"
    status: failed
    reason: "CR-01/CR-02 (round 1's blocker) are genuinely closed — confirmed independently: SeedReceipt.tsx:212-217 splits detectedCount from carriedCount, the detected-only lead is the only sentence making the 'so I set them' authorship claim, and SeedReceipt.test.tsx:104-109/127-150 use the real backend default 'strict' instead of the unrepresentable 'loose'. But the CR-01 fix introduced a NEW sentence — seedReceiptCarriedLead (definitionOps.ts:613-620), rendered as the 'seed-receipt-carried' paragraph (SeedReceipt.tsx:274-281) — that has two independently confirmed defects: (1) CR-03 — `grep -rn \"seed-receipt-carried\" frontend/src/` returns exactly ONE hit, the component's own data-testid attribute; no test file queries it, imports seedReceiptCarriedLead for a rendered assertion, or checks its count, so the paragraph could be deleted, show the wrong count, or drift from its formatter and all 452 passing tests would stay green — directly contradicting SeedReceipt.test.tsx's own docblock claim that 'every sentence is compared character-for-character against its definitionOps export'; (2) WR-09 — the sentence conflates 'already-set' (a policy default) and 'escalated' (the author's deliberate hand-toggle) into one claim, 'was already set to must prove it by its own settings' — which is literally false for an escalated step, since GROUNDING_WHY_ESCALATED (definitionOps.ts:475) and seedReceiptStepReason('escalated') (definitionOps.ts:654) both correctly say 'you turned this on by hand' two lines below the SAME card. On an escalated-only draft the receipt contradicts itself between its lead paragraph and its own per-step reason. This is CR-01's exact failure shape (a sentence misattributing who applied a governance gate) recurring inside the code that fixed CR-01, one plan later, unguarded by any test."
    artifacts:
      - path: "frontend/src/components/workflows/SeedReceipt.tsx"
        issue: "lines 274-281 render the carried paragraph with data-testid=seed-receipt-carried; confirmed zero test files query this testid (only the component itself references the string)"
      - path: "frontend/src/components/workflows/definitionOps.ts"
        issue: "seedReceiptCarriedLead (line 613-620) merges already-set + escalated into one 'by its own settings' claim; false for the escalated cause, whose own per-step reason (line 654, 'you turned this on by hand') directly contradicts it on the same card"
      - path: "frontend/src/components/workflows/SeedReceipt.test.tsx"
        issue: "does not import seedReceiptCarriedLead, never queries seed-receipt-carried, and its 'renders each sentence identically to its definitionOps export' case enumerates heading/lead/one-way/close and stops before the carried sentence"
    missing:
      - "Add SeedReceipt.test.tsx assertions for the carried paragraph: presence, count (character-identical to seedReceiptCarriedLead(carriedCount)), and the zero-carried case where it must be absent — the same rigor already applied to its sibling detected paragraph"
      - "Either give 'escalated' its own sentence, or make seedReceiptCarriedLead cause-agnostic (e.g. 'N more steps were already set to must prove it before I started' — claims nothing about settings vs. hand-toggle) so it is true of both causes it covers"
human_verification:
  - test: "M1 — every node face says what THIS step does (reads distinctly to a business user)"
    expected: "Generate a real 5-step workflow; every face is specific, none is a generic type sentence when a skill/template/folder is bound"
    why_human: "Judgement of prose quality, not a grep-able property (SPEC Req 1 / SC#5)"
  - test: "M2 — the plain title survives the ⌥ Technical-names reveal on both graph views without layout jump"
    expected: "Toggling ⌥ ON/OFF x3 on canvas and spine: title unchanged, no height jump, full slug visible with no ellipsis"
    why_human: "Perceptual layout stability cannot be asserted from jsdom (Req 4)"
  - test: "M3 — the seed receipt arrives once, its seal pulses once, and implies nothing is still deciding"
    expected: "Watch arrival on a throttled connection on a REAL generated draft; single batch entrance, no staged/staggered reveal"
    why_human: "Temporal + perceptual behavior (Req 5) — unblocked by the CR-01 fix, but NOTE the residual CR-03/WR-09 gap above means the operator should also read the carried sentence against the per-step reasons on an escalated draft, not just watch the animation"
  - test: "M4 — the derived face tracks a skill bind/unbind live, without a save and without flicker"
    expected: "Bind a skill to a step, then unbind, watching the face update on the async name-map settle"
    why_human: "The mount-fetch settle (miss-on-first-paint, resolve-on-mount) is only observable live, not in a render test (Req 1 / Pitfall-1)"
  - test: "M5 — the seeded describe text reads like something a person typed"
    expected: "Pick each of the 3 starter templates; the filled describe box reads naturally"
    why_human: "Copy-quality judgement (Req 6) — unchanged and still owed, untouched by the closure round"
  - test: "M6 — SC#6 live: an armed checkpoint cannot be preempted by an author-declared pre-gate"
    expected: "Run an armed phase carrying a timing=\"pre\" ask_user validator. Answer the author's gate Proceed; confirm the ARMED checkpoint still appears in the chat PendingAskCard. Refuse it. Confirm the step did NOT run and harness_audit has ZERO validator_ask_user_approved rows for it."
    why_human: "Needs a live Redis rendezvous + a real browser answer; the property test proves the property in isolation but this is the end-to-end confirmation the SPEC's own acceptance criteria require"
  - test: "M7 — SC#10 live row: the HARNESS_AUTHORING_MODEL env path actually reaches resolve_authoring_model"
    expected: "Restart backend with HARNESS_AUTHORING_MODEL set; generate a workflow; confirm the model actually used matches the env var"
    why_human: "Requires a backend restart; the 8-row roster test proves the service function in isolation, not the env-to-running-process path"
  - test: "M8 — flag-OFF Builder first screen is byte-identical to today (whole-screen read)"
    expected: "Turn visual_workflow_canvas OFF; open the Builder's first screen; confirm no template line and nothing else changed"
    why_human: "An automated byte-pin (D-181-01, WorkflowBuilderPage.describe.test.tsx) covers the CTA flex column only; the manual row looks at the whole screen — unchanged by the closure round, re-confirmed byte-identical (git diff --numstat ee5fff3b HEAD -- WorkflowBuilderPage.tsx is empty)"
  - test: "M9 — the receipt's two paragraphs read as ONE honest account on a typical generated draft"
    expected: "Generate a real llm_agent -> llm_emit draft; the detected sentence counts only steps that actually retrieved; the deliverable still explains its own seal; no sentence claims the AI applied a gate its own citation_policy default applied; the one-way rule sits only with the detected paragraph"
    why_human: "Whether two sentences read one after another as coherent or contradictory is a judgement only a person can make (Req 5 / VOCAB-02, CR-01 closure)"
  - test: "M10 — the zero-detected draft still arrives as one thing, not a card with a hole in it"
    expected: "Describe a workflow with no retrieval at all; the receipt still arrives whole, with heading and closing line intact and the one-way sentence absent"
    why_human: "A person is needed to see whether a component with a paragraph removed still reads as compositionally whole (Req 5 / D-187-10)"
  - test: "M11 — the card states no capability the step lacks, and still states the one it has"
    expected: "Bind a folder on a step type that cannot search (e.g. llm_single or human-input): the card must NOT say 'Search {folder}'. Bind the same folder on an agent step: it must say 'Search {folder}'. Read both side by side."
    why_human: "The contrast is only convincing when two cards are seen together — two isolated unit tests never show it (Req 1 / VOCAB-01, WR-02 closure)"
  - test: "M12 — the + row promises the sentence the card that lands actually says"
    expected: "Open + on the lane, read every row aloud, click the human-input row, confirm the card says the same sentence the row promised; repeat with a control row"
    why_human: "The drift this row is testing for was semantic, not lexical — a person reading two sentences one click apart is the only instrument that catches it (Req 1 / VOCAB-01, WR-03 closure) — NOTE: confirmed live that WR-03's fix is only PARTIAL (WR-08): StepTypePickerProps carries no nameContext field at all, so an llm_emit row with a template asset will still read 'Produce the deliverable' in the menu while the card that lands reads 'Fill <filename>.docx' — the operator running this row should specifically try the deliverable/llm_emit row on a template-bearing draft, not just the human-input control"
---

# Phase 187: Business Vocabulary + AI-Seeded Canvas Verification Report

**Phase Goal:** A business user sees plain-language node verbs and can describe a workflow in
natural language to get a safe, editable seeded canvas draft (AI + visual, not either/or) — and the
AI seed respects grounding mode (a seeded grounded node auto-gets its citation/confidence gate —
safe-by-construction).
**Requirements:** VOCAB-01, VOCAB-02, VOCAB-03 (+ SC#6 / SEED-137, folded 2026-07-31)
**Verified:** 2026-08-02T09:30:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 187-16, 187-17, 187-18, 187-19; round-2 code
review `187-REVIEW.md`, commit `025fb4c3`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VOCAB-01 (Req 1): `nodeTitle()` resolves 3 tiers (name → derived → type sentence), derived tier pure/unstored, never fabricates, totality holds | ✓ VERIFIED (2 Warnings) | Unchanged core resolver, re-confirmed. **WR-02 is now CLOSED** (independently re-derived): `phaseVocabulary.ts:516` — `if (inputs.folderName && GROUNDING_DIAL_TYPES.includes(inputs.phaseType))`, `GROUNDING_DIAL_TYPES = ["llm_agent", "llm_batch_agents"]` (`:277`); a folder-bound `llm_single` or human-input step no longer renders `Search {folder}`. **New Warning (WR-08, confirmed live):** `StepTypePicker.tsx`'s `StepTypePickerProps` interface (`:90-101`) carries NO `nameContext` field at all — the `＋` row's preview (`nodeTitle(minimalPhaseFor(choice.type, PREVIEW_SLUG, index))`, line 185) cannot see a template asset, while the real caller's card resolves through a `nameContext` built from `templateFilename` (`WorkflowBuilderPage.tsx:613-617`). Confirmed by reading the props interface directly — no threading exists to omit accidentally, it structurally cannot be there. |
| 2 | VOCAB-01 (Req 3): identity-bearing config edit clears a **generator-seeded** name, leaves a **hand-typed** name untouched; pre-187 rows load with the marker absent; zero migration | ✓ VERIFIED | Unaffected by the closure round; re-confirmed empty migrations diff independently (below). |
| 3 | VOCAB-01 (Req 4): ⌥ reveal swaps the canvas card's SUBTITLE not its TITLE; canvas and spine agree on **title** in both toggle states | ✓ VERIFIED (documented narrowing) | Unaffected by the closure round; `WorkflowBuilderPage.tsx` untouched by `ee5fff3b..HEAD` (confirmed: `git diff --numstat` empty). |
| 4 | VOCAB-02 (Req 2): NL generator writes a non-empty per-step `name` on every phase; provider-call budget unchanged (1 valid / 2 on retry / never 3) | ✓ VERIFIED (1 real cross-provider finding, unchanged) | Backend untouched by the closure round (`git diff --name-only ee5fff3b HEAD -- backend/` empty); the OpenRouter non-deterministic name-drop finding and its mitigation (Req 1's derived-face fallback) stand as previously recorded. |
| 5 | VOCAB-02 (Req 5): a seeded draft with grounded steps shows a receipt naming **exactly** those steps with reasons, verbatim from the server derivation; zero grounded steps shows **no** grounded-step list; every rendered sentence is honest about who applied the gate | ✗ **FAILED — BLOCKER (CR-03 + WR-09, confirmed live at HEAD)** | Round 1's blocker (CR-01/CR-02) is genuinely closed. A NEW, narrower defect ships inside the fix itself — see Gaps below. |
| 6 | VOCAB-02 (Req 7 / SC#6): an armed action-risk checkpoint is asked before the body runs regardless of author-declared validators; property test observed RED on HEAD before the fix and green after; a refusal writes ZERO approval receipts; `test_185_engine_attachment.py:153-165` stays green | ✓ VERIFIED (2 narrow Warnings, unchanged) | Backend untouched by the closure round. Independently re-ran: `pytest tests/unit/test_187_armed_checkpoint_property.py tests/unit/test_187_authoring_step_names.py tests/unit/test_182_validate.py tests/unit/test_182_severity_codes.py tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py tests/unit/test_harness_models.py tests/unit/test_pre_post_timing.py -q` → **125 passed, 0 failed**, reproduced this session. WR-01/WR-05 carried forward, unchanged. |
| 7 | D-187-11 (folded `BUG-260731-03` verdict half): an unbound retrieval workflow earns a deterministic `incomplete` verdict from `/validate` before a golden run is spent | ✓ VERIFIED | Included in the 125/125 re-run above (`test_182_validate.py`, `test_182_severity_codes.py`); unaffected by the closure round. |
| 8 | VOCAB-03 (Req 6): choosing a template fills the describe box and leaves the user on the describe screen with the CTA enabled; no first-screen path places a definition on the canvas without generation; the flag-OFF describe screen is byte-identical (D-181-01) | ✓ VERIFIED | Unaffected by the closure round; `StarterTemplatePicker.tsx`/`.test.tsx` untouched by `ee5fff3b..HEAD`. |
| 9 | SC#5 check 1 (no jargon leak) and check 2 (no two materially-different steps share a face), over the named corpus (3 starters + 4 canonical seeds + PM pack) | ✓ VERIFIED (documented narrowing, unchanged) | `phaseVocabulary.corpus.test.ts` re-confirmed green in this session's independent 452-test run; strengthened by the WR-02 gate landing underneath it. |
| 10 | SC#10: roster driven honestly, blocked/failed rows recorded with reasons, never silently omitted | ✓ VERIFIED (method superseded, honestly recorded, unchanged) | Backend untouched by the closure round; the 8-row roster and its 3 named ❌ rows stand unchanged, confirmed not re-run and not needing to be (no frontend fix could move a provider-side finding). |
| 11 | Zero migrations added by this phase (including the closure round) | ✓ VERIFIED | Independently re-confirmed this session: `git diff --stat 35261e96 HEAD -- supabase/migrations` and `git status --porcelain supabase/migrations` both empty; also `git diff --numstat ee5fff3b HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` empty (the D-187-14 mount cap is untouched by the closure round — all four fixes landed inside `components/workflows/`). |

**Score:** 10/11 truths verified (1 hard FAILED/BLOCKER — narrower in scope than round 1, but a
genuine, independently-confirmed live defect, not a residual test-coverage nit).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/workflows/phaseVocabulary.ts` (`derivedFace`, `nodeTitle`, `groundingCauseOf`, `GROUNDING_DIAL_TYPES`) | 3-tier resolution, folder tier gated to types that can retrieve | ✓ VERIFIED | Re-confirmed live: `GROUNDING_DIAL_TYPES = ["llm_agent", "llm_batch_agents"]` (`:277`), gate at `:516`. WR-02 closed. |
| `frontend/src/components/workflows/SeedReceipt.tsx` + `definitionOps.ts` (`seedReceiptGroundingLead`, `seedReceiptCarriedLead`) | post-draft grounding receipt, every sentence honest about who applied the gate | ✗ **PARTIALLY FIXED — the NEW `carriedLead` sentence is unguarded and misattributes `escalated`** | `seedReceiptGroundingLead`'s claim is now correctly scoped to `detected` only (CR-01 fixed). `seedReceiptCarriedLead` (its sibling, introduced by the same fix) has zero test coverage (CR-03) and states "by its own settings" for the `escalated` cause, which `seedReceiptStepReason('escalated')` two lines below correctly calls "you turned this on by hand" — a live self-contradiction on an escalated-only draft (WR-09). |
| `frontend/src/components/workflows/StepTypePicker.tsx` | the `＋` row previews the exact sentence the card that lands will say, for all six step types | ⚠️ **PARTIALLY FIXED** | `PHASE_TYPE_SENTENCES` import removed, now reads `nodeTitle` — the symptom (a locally-declared sentence table) is gone. But `StepTypePickerProps` has no `nameContext` field, so an `llm_emit` row with a template asset previews `PHASE_TYPE_SENTENCES.llm_emit`-equivalent generic copy while the landed card reads `Fill <filename>` — the property the plan's own must_have claims ("for every one of the six step types") does not hold. Not promoted to a failed truth (matches the code review's own Warning-level classification, WR-08), but flagged here because it is the direct, confirmed non-closure of one of the round's four scoped items. |
| `backend/app/models/harness.py`, `harness_engine.py`, `/validate` route | unaffected by this round | ✓ VERIFIED (unchanged) | Confirmed `git diff --name-only ee5fff3b HEAD -- backend/` empty; all backend-owned truths (#4, #6, #7, #10) stand on the same evidence as round 1, independently re-run. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `SeedReceipt` | `seedReceiptCarriedLead` (`definitionOps.ts`) | direct import, rendered as the `seed-receipt-carried` paragraph | WIRED but **UNTESTED AND PARTIALLY WRONG** | The link exists and renders at runtime (confirmed by direct source read), but no test exercises the rendered output, and the underlying formatter's claim is false for the `escalated` cause (WR-09). A wiring success producing a wrong, unguarded result — the same shape CR-01 was. |
| `StepTypePicker` | `nodeTitle` (`phaseVocabulary.ts`) | direct call, no `nameContext` argument | PARTIAL — **structurally cannot carry the caller's context** | `StepTypePickerProps` has no `nameContext` field (confirmed by reading the interface); the resolver call is correct in isolation but the caller-side context that would make its preview match the landed card is never threaded through. |
| `WorkflowBuilderPage.tsx` | `SeedReceipt` / `StarterTemplatePicker` | two gated mount lines, unchanged | WIRED | Re-confirmed: `git diff --numstat ee5fff3b HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` is empty — the closure round spent none of the D-187-14 mount-cap budget. |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| VOCAB-01 | 187-02, 04, 08, 09, 10, 12, 15, 17, 18 | Plain-language node verbs + Technical-names reveal | ✓ SATISFIED (2 Warnings: WR-08 residual picker/card mismatch on `llm_emit`+template; other carried-forward items unchanged) | Truths #1–3, #9 |
| VOCAB-02 | 187-01, 02, 03, 06, 07, 10, 11, 13, 15, 16 | NL → safe seeded editable canvas draft, AI seed structurally safe | ✗ **STILL BLOCKED on Req 5** (seed receipt) — narrower cause than round 1 | Truth #5 FAILED; truths #4, #6, #7, #10 verified |
| VOCAB-03 | 187-05, 14, 15 | Start from a template/starter on the canvas | ✓ SATISFIED | Truth #8, unchanged |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only VOCAB-01/02/03 to Phase 187 and still
reads "Pending" for all three (re-confirmed this session) — correct, since that flip is downstream of
this verification passing, not something to expect pre-verification.

### Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|---|---|---|---|---|
| `frontend/src/components/workflows/SeedReceipt.tsx` / `.test.tsx` | 274-281 / (absent) | A user-visible sentence with zero test assertions anywhere in the repo | 🛑 Blocker (CR-03, confirmed live) | The receipt's own suite docblock claims character-for-character coverage of every sentence; this one is exempt from that claim by omission, not by design |
| `frontend/src/components/workflows/definitionOps.ts` | 613-620 | One sentence spanning two causes the module keeps apart everywhere else | ⚠️ Warning (WR-09, confirmed live) | On an escalated-only draft the receipt's lead paragraph and its own per-step reason contradict each other, two lines apart, on the same card |
| `frontend/src/components/workflows/StepTypePicker.tsx` | 90-101, 185 | Preview resolver deliberately called with no name context | ⚠️ Warning (WR-08, confirmed live) | The picker row for `llm_emit` with a template asset promises different copy than the card that lands — the exact defect class WR-03 was raised to close, recurring on a type WR-03's own fix didn't cover |
| `backend/app/services/harness_engine.py` | 1065-1066 | No-transport fail-safe re-reads author disposition on an armed phase | ⚠️ Warning (WR-01, carried forward, unchanged) | Narrow (`redis is None`), not production-reachable today |
| `backend/app/services/harness/validator_kinds.py` | 714-744 | Vestigial validator kind offers armed choices with un-armed semantics | ⚠️ Warning (WR-05, carried forward, unchanged) | Fenced today by publish; landmine for the deferred Phase-103 rework |
| Various | — | WR-04, WR-06, WR-07, IN-01…IN-05 | ⚠️/ℹ️ carried forward, unchanged | Out of the closure round's operator-scoped four items; see `187-REVIEW.md` |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file touched by the closure round (re-confirmed this
session across all 10 files in `git diff --name-only ee5fff3b HEAD -- frontend/src`).

### Behavioral Spot-Checks / Test Evidence (re-run independently this session, not transcribed)

| Check | Command | Result |
|---|---|---|
| The five closure-round frontend suites | `npx vitest run src/components/workflows/SeedReceipt.test.tsx src/components/workflows/StepTypePicker.test.tsx src/components/workflows/phaseVocabulary.test.ts src/components/workflows/phaseVocabulary.corpus.test.ts src/components/workflows/definitionOps.test.ts` | **5 files, 452 passed, 0 failed** — matches `187-REVIEW.md`'s figure independently |
| Phase-owned backend suite | `pytest tests/unit/test_187_armed_checkpoint_property.py tests/unit/test_187_authoring_step_names.py tests/unit/test_182_validate.py tests/unit/test_182_severity_codes.py tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py tests/unit/test_harness_models.py tests/unit/test_pre_post_timing.py -q` | **125 passed, 0 failed** |
| Zero-migration gate | `git diff --stat 35261e96 HEAD -- supabase/migrations` + `git status --porcelain supabase/migrations` | both **empty** |
| D-187-14 mount cap, closure round | `git diff --numstat ee5fff3b HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` | **empty** — the closure round spent none of the budget |
| WR-02 closure | Direct read of `phaseVocabulary.ts:277,516` | **Confirmed**: `GROUNDING_DIAL_TYPES` gates the folder tier |
| CR-03 (the new blocker) | `grep -rn "seed-receipt-carried" frontend/src/` | **1 hit — the component's own testid attribute.** No test file queries it. |
| WR-09 (the new warning) | Direct read of `definitionOps.ts:475,613-620,654` | **Confirmed**: `seedReceiptCarriedLead`'s "by its own settings" contradicts `seedReceiptStepReason('escalated')`'s "you turned this on by hand" |
| WR-08 (WR-03's residual) | Direct read of `StepTypePicker.tsx:90-101` (`StepTypePickerProps`) | **Confirmed**: no `nameContext` field exists on the interface |
| Debt-marker sweep | `TBD\|FIXME\|XXX` over the 10 files touched by the closure round | **zero matches** |

Backend full-suite pre-existing rot (211 failures) is unaffected — the closure round committed zero
backend files (`git diff --name-only ee5fff3b HEAD -- backend/` empty, re-confirmed).

### Human Verification Required

**G-4 lived-experience gate.** Per CLAUDE.md, wire format + a screenshot are insufficient for phases
touching live UI. `187-VALIDATION.md` records all **twelve** rows (M1–M12) as UNPERFORMED at the close
of the gap-closure round — M3 was unblocked by the CR-01 fix but not performed, and the round added
M9–M12 for its own user-visible changes. Full detail in the frontmatter `human_verification` block
above. Because code-level gaps (CR-03/WR-09) remain, `gaps_found` takes priority over `human_needed`
per the verification decision tree — but the manual board still stands and is unchanged in scope. Two
rows now carry an extra note from this re-verification:

- **M3** — should be run only after weighing that the receipt's residual WR-09 defect means an
  escalated-only draft will still show an internally-contradictory card; the operator should read the
  carried sentence against the per-step reasons, not just watch the arrival animation.
- **M12** — should specifically try the deliverable/`llm_emit` row on a template-bearing draft (not
  only the human-input control), since WR-08 confirms the picker's preview still diverges from the
  landed card in exactly that case.

### Deferred Items (by name, with re-open trigger — not gaps)

Unchanged from round 1's list — re-confirmed still accurate, since the closure round touched only the
files named in the four scoped findings:

- `definitionOps.canRemovePhase`'s refusal notice stays on the undecorated `nodeTitle()` call — **re-open trigger: Phase 188's `WorkflowCanvas.tsx` extraction**.
- The armed-phase / synchronous-publish hole (D-187-12) — **re-open trigger:** the deferred Phase-103 background-job publish rework, or the first live wedge.
- Making `harness_authoring_model` a real dynamic setting — **re-open trigger:** `BUG-260731-01`'s investigation or SEED-117 revival.
- Per-node review state, `technicalLine`, a direct template→canvas fork — excluded by SPEC, Phase 188.
- `tsc -b`'s 33 pre-existing errors (`D-ITEM-01`) — zero delta from the closure round too (re-confirmed: `33 → 33`, 0 in touched files).

### Gaps Summary

The round-1 BLOCKER (CR-01/CR-02) is genuinely closed — independently re-confirmed by direct source
read and an independent test run (452/452), not taken on the strength of `187-REVIEW.md` alone. WR-02
is also genuinely closed. But the closure round's own fix for CR-01 introduced a **new**, narrower
defect inside the exact surface it was repairing: `seedReceiptCarriedLead`, the sentence covering
`already-set` and `escalated` steps, has zero test coverage anywhere in the repo (CR-03) and states a
claim ("by its own settings") that directly contradicts the correct, adjacent per-step reason for an
`escalated` cause ("you turned this on by hand" — WR-09). This is confirmed live at HEAD by direct
code read, not inherited from the review. Because the seed receipt is specifically the surface this
phase built to make Phase 185's grounding enforcement legible (SC#3), and because this defect recurs
inside the very code that closed the first instance of the same failure class, VOCAB-02 Req 5 remains
not fully achieved — narrower in blast radius (only the `escalated` cause, not the typical
`llm_agent → llm_emit` draft that broke round 1), but real and unguarded. Separately, WR-03's fix
(187-18) is only partial: the `＋` picker structurally cannot preview an `llm_emit` row's real card
because `StepTypePickerProps` carries no `nameContext` field at all — this is Warning-level (matches
the code review's own classification) rather than promoted to a failed truth, but it is the direct,
confirmed non-closure of one of the round's four operator-scoped items, so it is named here rather
than left silent. Everything else — the 3-tier node-face ladder (now correctly gated), the
generator-authored names, the demote-on-edit rule, the subtitle-only reveal, the hoisted armed
checkpoint (SC#6), the unbound-retrieval verdict, the template door (VOCAB-03), and the SC#5/SC#10
measurement discipline — is real, wired, and independently re-verified as green in this session, with
zero migrations and the D-187-14 mount cap untouched by the closure round.

The fix is narrow: add SeedReceipt.test.tsx coverage for the carried paragraph (presence, count,
character identity, and the zero case — the same rigor the detected paragraph already has), and either
split `seedReceiptCarriedLead` into a cause-specific sentence or make it cause-agnostic so it claims
nothing false about either cause. This is a closure-plan-sized gap, not a re-plan of the phase.

All twelve manual rows (M1–M12) on `187-VALIDATION.md` remain unperformed and are the operator's;
`human_verification` items are recorded in this report's frontmatter but do not change the `gaps_found`
status, since a code-level BLOCKER (CR-03/WR-09) takes priority in the decision tree.

---

*Verified: 2026-08-02T09:30:00Z*
*Verifier: Claude (gsd-verifier)*
