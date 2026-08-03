---
phase: 187-business-vocabulary-ai-seeded-canvas
verified: 2026-08-03T19:15:00Z
status: gaps_found
score: 10/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "CR-03: the carried paragraph (`data-testid=\"seed-receipt-carried\"`) is now under presence/count/character-identity/zero-case guard in `SeedReceipt.test.tsx`, plus a standing testid-coverage sweep — confirmed live: `npx vitest run` over `SeedReceipt.test.tsx` + `definitionOps.test.ts` reproduces 288/288 independently this session (up from the pre-round baseline of 275: 47+228 → 60+228). `rerender(` does not appear anywhere in `SeedReceipt.test.tsx` (0 hits, independently confirmed) but that gap is exactly what CR-04 below re-identifies, not what CR-03 was scoped to."
    - "WR-09: `seedReceiptCarriedLead` no longer ends \"by its own settings\"/\"by their own settings\" — confirmed live: `grep -n \"own settings\" frontend/src/components/workflows/definitionOps.ts` returns exactly one hit, and it is inside the repaired docblock (line 600), not inside the function's return expressions. The sentence is now cause-agnostic (\"N steps were already set to must prove it.\"), so it no longer contradicts `seedReceiptStepReason(\"escalated\")`'s \"you turned this on by hand\" two lines below on the same card."
  gaps_remaining:
    - "VOCAB-02 Req 5 (seed receipt legibility / honesty about who applied the gate) is STILL FAILED — a THIRD, structurally different reason than rounds 1 and 2. CR-01 (round 1) and CR-03/WR-09 (round 2) were both sentence-content defects, closed by editing what the copy says. CR-04 (round 3, newly identified in `187-REVIEW.md` and independently confirmed here against the live code) is a DATA-FLOW defect: `SeedReceipt` is mounted with `phases={phases}`, a LIVE `useStore` selector (`WorkflowBuilderPage.tsx:573`), not a snapshot of the definition `/generate` returned. `showReceipt` is set `true` only in `onDraft` (`:1211`) and `false` only by the dismiss button (`:1641`) — nothing closes it on an edit. `PhaseFormPanel` (`:1819`), which lets the author edit `available_tools` on the selected step via free-text `ToolsField` (`PhaseFormPanel.tsx:871-876,923-928`), is mounted as a sibling on the same screen and writes through `onPhaseChange` -> `store.getState().patchConfig` (`:1245-1251`) into the SAME `phases` state the receipt reads. So: describe -> generate a typical `llm_agent -> llm_emit` draft with no KB tool bound (`detectedCount === 0`, no detected paragraph) -> leave the receipt open -> type `search_documents` into the agent step's tools field -> the receipt re-renders with `detectedCount === 1` and now prints \"1 step reads your documents, so I set it to must prove it\" — a sentence the AI never said, about an edit the user just made ten seconds ago. This is CR-01's exact failure shape (a sentence misattributing who applied a governance gate), reached this time through unsnapshotted live props rather than through the copy itself, and it is unguarded: zero `rerender(` calls exist anywhere in either reviewed suite (independently confirmed, 0 hits), so no test can see a post-arrival edit."
  regressions: []
gaps:
  - truth: "Every rendered sentence on the seed receipt is honest about who applied the gate, at every point the card can be viewed — not only at the instant it arrives (SPEC Req 5 acceptance, extended by the CR-01/CR-03/WR-09 closures' own stated properties)"
    status: failed
    reason: "CR-03 and WR-09 (round 2's blockers) are genuinely closed — independently re-confirmed by direct source read and an independent test run (288/288 over the two owning suites, not taken on 187-REVIEW.md's word alone): the carried paragraph now has presence/count/identity/zero-case coverage, and its sentence no longer attributes a false cause. But the receipt's copy is entirely a function of the `phases` PROP, and that prop is a live store selector rather than a snapshot of the generation that produced the copy's claims. Every number and sentence (`heading`, `detectedCount`, `carriedCount`, `groundingLead`, `carriedLead`) recomputes on every render from whatever `phases` currently holds (`SeedReceipt.tsx:193,208,212-213,216-217`), and the card stays mounted and open across an arbitrary number of live edits because nothing but the dismiss button clears `showReceipt` (`WorkflowBuilderPage.tsx:605,1211,1641`). The one screen this surface shares real estate with — `PhaseFormPanel`, mounted as a sibling (`:1819`) — lets the author edit the exact field (`available_tools`) that `groundingCauseOf` reads to decide `detected` vs not. An edit made after arrival is therefore indistinguishable, on this card, from something \"I\" (the AI) did — the identical false-attribution shape CR-01 fixed, now reachable by a path (a live prop, not a copy string) neither round 1 nor round 2 examined and that no existing test (0 `rerender(` calls in either suite) can catch."
    artifacts:
      - path: "frontend/src/pages/WorkflowBuilderPage.tsx"
        issue: "`phases` is a live `useStore` selector (line 573) passed straight into `<SeedReceipt phases={phases} .../>` (line 1637); `showReceipt` is cleared only by the dismiss handler (line 1641), never by an edit; `PhaseFormPanel` is mounted as a sibling (line 1819) and its `onChange` writes through `onPhaseChange` -> `store.getState().patchConfig` (lines 1245-1251) into the same `phases` state"
      - path: "frontend/src/components/workflows/SeedReceipt.tsx"
        issue: "every sentence and count is recomputed from the live `phases` prop on every render (lines 193, 208, 212-213, 216-217); the component holds no snapshot of the generation it narrates in past tense (\"Here's what I built\", \"so I set them\")"
      - path: "frontend/src/components/workflows/PhaseFormPanel.tsx"
        issue: "`available_tools` is free-text editable via `ToolsField` for `llm_agent`/`llm_batch_agents` steps (lines 871-876, 923-928), the exact field `groundingCauseOf`'s `detected` branch reads"
      - path: "frontend/src/components/workflows/SeedReceipt.test.tsx"
        issue: "zero `rerender(` calls anywhere in the file (independently confirmed) — every test renders once and never re-renders with mutated props, so a post-arrival edit is untested by construction"
    missing:
      - "Snapshot the phases at the moment the receipt opens (e.g. `setReceiptPhases(def.phases)` beside `setDrafted(def)` in `onDraft`, and pass that snapshot — not the live store selector — into `SeedReceipt`'s `phases` prop), OR re-tense every sentence to describe current state with no actor claim if live tracking is intentional"
      - "A falsifying test that renders, then `rerender()`s with a phases array reflecting a live edit (e.g. a KB tool switched on after arrival), asserting the authorship sentence ('so I set') still does not appear over the user's own act"
    artifacts_note: "Recorded as CR-04 in 187-REVIEW.md (round 3, committed today); independently re-derived here against the live source rather than accepted on the reviewer's word — every cited line number was re-read directly."
human_verification:
  - test: "M1 — every node face says what THIS step does (reads distinctly to a business user)"
    expected: "Generate a real 5-step workflow; every face is specific, none is a generic type sentence when a skill/template/folder is bound"
    why_human: "Judgement of prose quality, not a grep-able property (SPEC Req 1 / SC#5)"
  - test: "M2 — the plain title survives the reveal on both graph views without layout jump"
    expected: "Toggling the technical-names reveal ON/OFF x3 on canvas and spine: title unchanged, no height jump, full slug visible with no ellipsis"
    why_human: "Perceptual layout stability cannot be asserted from jsdom (Req 4)"
  - test: "M3 — the seed receipt arrives once, its seal pulses once, and implies nothing is still deciding"
    expected: "Watch arrival on a throttled connection on a REAL generated draft; single batch entrance, no staged/staggered reveal"
    why_human: "Temporal + perceptual behavior (Req 5) — repaired history preserved across three rounds (blocked by CR-01, unblocked by 187-16, repaired by 187-20); NOTE the operator should ALSO now try leaving the receipt open and editing a step's tools field, per the newly-identified CR-04 above — the animation being correct does not mean the copy stays honest across an edit"
  - test: "M4 — the derived face tracks a skill bind/unbind live, without a save and without flicker"
    expected: "Bind a skill to a step, then unbind, watching the face update on the async name-map settle"
    why_human: "The mount-fetch settle (miss-on-first-paint, resolve-on-mount) is only observable live, not in a render test (Req 1 / Pitfall-1)"
  - test: "M5 — the seeded describe text reads like something a person typed"
    expected: "Pick each of the 3 starter templates; the filled describe box reads naturally"
    why_human: "Copy-quality judgement (Req 6) — unchanged and still owed across all three rounds"
  - test: "M6 — SC#6 live: an armed checkpoint cannot be preempted by an author-declared pre-gate"
    expected: "Run an armed phase carrying a timing=\"pre\" ask_user validator. Answer the author's gate Proceed; confirm the ARMED checkpoint still appears in the chat PendingAskCard. Refuse it. Confirm the step did NOT run and harness_audit has ZERO validator_ask_user_approved rows for it."
    why_human: "Needs a live Redis rendezvous + a real browser answer; the property test proves the property in isolation but this is the end-to-end confirmation the SPEC's own acceptance criteria require"
  - test: "M7 — SC#10 live row: the HARNESS_AUTHORING_MODEL env path actually reaches resolve_authoring_model"
    expected: "Restart backend with HARNESS_AUTHORING_MODEL set; generate a workflow; confirm the model actually used matches the env var"
    why_human: "Requires a backend restart; the 8-row roster test proves the service function in isolation, not the env-to-running-process path"
  - test: "M8 — flag-OFF Builder first screen is byte-identical to today (whole-screen read)"
    expected: "Turn visual_workflow_canvas OFF; open the Builder's first screen; confirm no template line and nothing else changed"
    why_human: "An automated byte-pin covers the CTA flex column only; the manual row looks at the whole screen — re-confirmed byte-identical across all three rounds (WorkflowBuilderPage.tsx untouched by any closure round's diff)"
  - test: "M9 — the receipt's two paragraphs read as ONE honest account on a typical generated draft"
    expected: "Generate a real llm_agent -> llm_emit draft; the detected sentence counts only steps that actually retrieved; the deliverable still explains its own seal; no sentence claims the AI applied a gate its own citation_policy default applied; the one-way rule sits only with the detected paragraph; the paragraph and the per-step rows AGREE rather than needing to be checked for contradiction"
    why_human: "Whether sentences read as coherent or contradictory is a judgement only a person can make (Req 5 / VOCAB-02) — its note was repaired in round 3 to reflect the WR-09 fix, but CR-04 above means the operator should also try this AFTER an in-place edit, not only on first arrival"
  - test: "M10 — the zero-detected draft still arrives as one thing, not a card with a hole in it"
    expected: "Describe a workflow with no retrieval at all; the receipt still arrives whole, with heading and closing line intact and the one-way sentence absent"
    why_human: "A person is needed to see whether a component with a paragraph removed still reads as compositionally whole (Req 5 / D-187-10)"
  - test: "M11 — the card states no capability the step lacks, and still states the one it has"
    expected: "Bind a folder on a step type that cannot search (e.g. llm_single or human-input): the card must NOT say 'Search {folder}'. Bind the same folder on an agent step: it must say 'Search {folder}'. Read both side by side."
    why_human: "The contrast is only convincing when two cards are seen together — two isolated unit tests never show it (Req 1 / VOCAB-01, WR-02 closure)"
  - test: "M12 — the + row promises the sentence the card that lands actually says"
    expected: "Open + on the lane, read every row aloud, click the human-input row, confirm the card says the same sentence the row promised; repeat with a control row"
    why_human: "The drift this row tests for was semantic, not lexical — a person reading two sentences one click apart is the only instrument that catches it (Req 1 / VOCAB-01) — NOTE: WR-08 STANDS, unclosed across all three rounds and explicitly routed by the operator to Phase 188: StepTypePickerProps carries no nameContext field at all, so an llm_emit row with a template asset will still read 'Produce the deliverable' in the menu while the card that lands reads 'Fill <filename>.docx' — try the deliverable/llm_emit row on a template-bearing draft, not just the human-input control"
  - test: "M13 — the escalated-only draft, head-on"
    expected: "Reach a draft whose ONLY sealed step is hand-escalated (no step reading documents); read the card top to bottom and confirm: the paragraph states the count and the seal without saying what applied it; the row below names the author's own act; the two do not contradict; the one-way ('You can't turn that off') line is absent, because that is the detected lock and nothing here was detected"
    why_human: "Whether one card's paragraph and its own rows read as agreeing or contradicting, two lines apart, is a judgement only a person makes — the suite proves which words are present/absent, not whether they add up (Req 5 / WR-09 closure) — added in round 3"
---

# Phase 187: Business Vocabulary + AI-Seeded Canvas Verification Report

**Phase Goal:** A business user sees plain-language node verbs and can describe a workflow in
natural language to get a safe, editable seeded canvas draft (AI + visual, not either/or) — and the
AI seed respects grounding mode (a seeded grounded node auto-gets its citation/confidence gate —
safe-by-construction).
**Requirements:** VOCAB-01, VOCAB-02, VOCAB-03 (+ SC#6 / SEED-137, folded 2026-07-31)
**Verified:** 2026-08-03T19:15:00Z
**Status:** gaps_found
**Re-verification:** Yes — this is the THIRD verification round, after gap-closure plans 187-20
and 187-21 (round-3 code review `187-REVIEW.md`, commit range `f632f9b6..HEAD`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VOCAB-01 (Req 1): `nodeTitle()` resolves 3 tiers (name -> derived -> type sentence), derived tier pure/unstored, never fabricates, totality holds | ✓ VERIFIED (2 carried Warnings) | Untouched by round 3 — `git diff --stat f632f9b6 HEAD -- frontend/src/components/workflows/StepTypePicker.tsx frontend/src/components/workflows/phaseVocabulary.ts` is empty (re-confirmed this session). WR-02 remains closed; WR-08 (`StepTypePickerProps` has no `nameContext` field) remains open, explicitly routed by the operator to Phase 188 — not closed by this round. |
| 2 | VOCAB-01 (Req 3): identity-bearing config edit clears a generator-seeded name, leaves a hand-typed name untouched; pre-187 rows load with the marker absent; zero migration | ✓ VERIFIED | Unaffected by round 3; re-confirmed empty migrations diff this session. |
| 3 | VOCAB-01 (Req 4): the reveal swaps the canvas card's SUBTITLE not its TITLE; canvas and spine agree on title in both toggle states | ✓ VERIFIED (documented narrowing) | `WorkflowBuilderPage.tsx` diff over `f632f9b6..HEAD` is empty (re-confirmed this session, `git diff --numstat`) — round 3 spent none of the D-187-14 mount-cap budget. |
| 4 | VOCAB-02 (Req 2): NL generator writes a non-empty per-step `name` on every phase; provider-call budget unchanged | ✓ VERIFIED (1 real cross-provider finding, unchanged) | Backend untouched by round 3 (`git diff --name-only f632f9b6 HEAD -- backend/` empty, re-confirmed). |
| 5 | VOCAB-02 (Req 5): a seeded draft with grounded steps shows a receipt naming exactly those steps with reasons; every rendered sentence is honest about who applied the gate, AT EVERY POINT THE CARD CAN BE VIEWED | ✗ **FAILED — BLOCKER (CR-04, newly identified in round 3, independently confirmed live against current source)** | Round 1 (CR-01/CR-02) and round 2 (CR-03/WR-09) are both genuinely closed — re-confirmed independently. A THIRD, structurally different defect remains: the receipt's `phases` prop is a live store selector, not a snapshot of the generation it narrates, and a sibling panel lets the author edit the exact field the receipt's classification reads while the card stays open. See Gaps below. |
| 6 | VOCAB-02 (Req 7 / SC#6): an armed action-risk checkpoint is asked before the body runs regardless of author-declared validators; a refusal writes ZERO approval receipts | ✓ VERIFIED (2 narrow carried Warnings, unchanged) | Backend untouched by round 3. Not re-run this session (no backend file changed since the prior round's independent 125/125 re-run; `git diff --name-only f632f9b6 HEAD -- backend/` empty is sufficient regression evidence per re-verification quick-check rules). |
| 7 | D-187-11 (folded `BUG-260731-03` verdict half): an unbound retrieval workflow earns a deterministic `incomplete` verdict from `/validate` before a golden run is spent | ✓ VERIFIED | Backend untouched by round 3; unaffected. |
| 8 | VOCAB-03 (Req 6): choosing a template fills the describe box and leaves the user on the describe screen with the CTA enabled; flag-OFF describe screen is byte-identical | ✓ VERIFIED | `StarterTemplatePicker.tsx`/`.test.tsx` untouched by round 3 (confirmed via the round's own `files_modified` list — only the 4 `SeedReceipt`/`definitionOps` files). |
| 9 | SC#5 check 1 (no jargon leak) and check 2 (no two materially-different steps share a face), over the named corpus | ✓ VERIFIED (documented narrowing, unchanged) | `phaseVocabulary.corpus.test.ts` untouched by round 3's diff. |
| 10 | SC#10: roster driven honestly, blocked/failed rows recorded with reasons, never silently omitted | ✓ VERIFIED (method superseded, honestly recorded, unchanged) | Backend untouched; the 8-row roster and its named blocked/failed rows stand unchanged from the prior round. |
| 11 | Zero migrations added by this phase (including all three closure rounds) | ✓ VERIFIED | Independently re-confirmed this session: `git diff --stat 35261e96 HEAD -- supabase/migrations` and `git status --porcelain supabase/migrations` both empty. |

**Score:** 10/11 truths verified (1 hard FAILED/BLOCKER — a third, distinct defect on the same
truth that has now failed in all three rounds, for three different reasons).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/workflows/SeedReceipt.tsx`, `definitionOps.ts` (`seedReceiptCarriedLead`, `seedReceiptGroundingLead`) | post-draft grounding receipt, every sentence honest about who applied the gate, at every point the card is viewed | ✗ **STILL FAILS — the sentences are correct at arrival but the component tracks LIVE state, not a snapshot of the arrival** | CR-03/WR-09 genuinely closed (re-confirmed: `grep -n "own settings" definitionOps.ts` → 1 hit, inside the docblock only). But `phases` (`SeedReceipt.tsx:193,208,212-213,216-217`) is read straight from the caller's live prop every render; the caller passes the live store selector (`WorkflowBuilderPage.tsx:573,1637`), not a snapshot captured at `onDraft` time. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | the receipt's data source and open/close lifecycle | ✗ **CR-04 — no snapshot, no edit-triggered close** | `const phases = useStore(store, (s) => s.phases)` (:573) flows directly into `<SeedReceipt phases={phases} .../>` (:1637). `showReceipt` (:605) is set `true` only in `onDraft` (:1211) and `false` only by `onDismiss` (:1641) — confirmed by grep, exactly those two writes exist in the file. `PhaseFormPanel` (:1819) is mounted as a sibling and its `onChange` reaches `onPhaseChange` -> `store.getState().patchConfig` (:1245-1251), which mutates the same `phases` the receipt reads. |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | the config-edit surface reachable while the receipt is open | (evidence artifact, not owned by this plan) | `available_tools` is free-text editable via `ToolsField` for `llm_agent`/`llm_batch_agents` (lines 871-876, 923-928) — the exact field `groundingCauseOf`'s `detected` branch reads. Confirmed by direct read. |
| `frontend/src/components/workflows/StepTypePicker.tsx` | the `+` row previews the exact sentence the card that lands will say, for all six step types | ⚠️ **STILL PARTIAL — WR-08 open, explicitly deferred to Phase 188** | Untouched by round 3 (`git diff --stat f632f9b6 HEAD -- StepTypePicker.tsx` empty, re-confirmed). `StepTypePickerProps` still has no `nameContext` field. Not a new gap for this round — the operator routed it to Phase 188; recorded here as a Deferred Item, not scored as met. |
| `backend/app/models/harness.py`, `harness_engine.py`, `/validate` route | unaffected by round 3 | ✓ VERIFIED (unchanged) | `git diff --name-only f632f9b6 HEAD -- backend/` empty. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `SeedReceipt` | `seedReceiptCarriedLead`/`seedReceiptGroundingLead` (`definitionOps.ts`) | direct import, rendered paragraphs | WIRED and now content-correct | CR-03/WR-09 closed; the sentences themselves no longer misattribute a cause. |
| `WorkflowBuilderPage.tsx` (`phases` live selector) | `SeedReceipt`'s `phases` prop | direct prop pass, no snapshot | **WIRED BUT SEMANTICALLY WRONG (CR-04)** | The link exists and renders correctly at arrival, but the same link re-renders the card with whatever `phases` holds at ANY later point while `showReceipt` stays true — including after an edit made through the sibling `PhaseFormPanel`. A wiring "success" that produces a false claim after the first render — the same shape CR-01/CR-03 were, one level up the data flow. |
| `PhaseFormPanel` (`onChange` -> `onPhaseChange`) | `store.patchConfig` -> `phases` state -> `SeedReceipt` re-render | store mutation observed by a live selector | **CONFIRMED REACHABLE** | Traced end to end: `PhaseFormPanel.tsx:874,926` -> `WorkflowBuilderPage.tsx:1245-1251` -> the same `useStore` selector at `:573` the receipt consumes. No guard anywhere breaks this chain while the receipt is open. |
| `StepTypePicker` | `nodeTitle` (`phaseVocabulary.ts`) | direct call, no `nameContext` argument | PARTIAL — unchanged, deferred | `StepTypePickerProps` still has no `nameContext` field (unchanged since round 2, confirmed by empty diff over the file). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `SeedReceipt` | `phases` prop -> `rows`/`detectedCount`/`carriedCount` | `WorkflowBuilderPage.tsx:573` (`useStore(store, s => s.phases)`) | Yes — real, live workflow state | ⚠️ **HOLLOW BY TIMING, NOT BY EMPTINESS** — the data is real and current, which is precisely the defect: the card's copy is PAST-TENSE ("so I set them", "here's what I built") but its data source is PRESENT-TENSE (whatever the store holds right now). Real data flowing through the wrong temporal reference produces a false claim just as surely as no data would. |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| VOCAB-01 | 187-02, 04, 08, 09, 10, 12, 15, 17, 18 | Plain-language node verbs + Technical-names reveal | ✓ SATISFIED (1 carried Warning: WR-08, deferred to Phase 188) | Truths #1-3, #9 |
| VOCAB-02 | 187-01, 02, 03, 06, 07, 10, 11, 13, 15, 16, 20, 21 | NL -> safe seeded editable canvas draft, AI seed structurally safe | ✗ **STILL BLOCKED on Req 5** (seed receipt honesty) — third distinct cause (CR-04) | Truth #5 FAILED; truths #4, #6, #7, #10 verified |
| VOCAB-03 | 187-05, 14, 15 | Start from a template/starter on the canvas | ✓ SATISFIED | Truth #8, unchanged |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only VOCAB-01/02/03 to Phase 187 and still
reads "Pending" for all three (re-confirmed this session: lines 42-44, 115-117) — correct, since the
flip is downstream of a passing verification.

### Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|---|---|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` / `SeedReceipt.tsx` | 573, 1211, 1637, 1641 / 193-217 | A past-tense narration card driven by a live, present-tense data selector with no snapshot and no edit-triggered close | 🛑 **Blocker (CR-04, newly identified round 3, independently confirmed)** | An in-place edit made after the receipt arrives is rendered as the AI's own act — the third occurrence of the CR-01 failure shape, reached through a data-flow path neither prior round examined |
| `frontend/src/components/workflows/definitionOps.ts` | 661-673 | `seedReceiptStepReason`'s `escalated` case still reads as a second-person actor claim ("you turned this on by hand") though the underlying bit only records that the lock is authored, not who authored it | ⚠️ Warning (WR-11, round 3, carried into this report) | On a model-emitted `grounding_escalated: true` (reachable by schema, not yet observed live), the row would falsely tell a user who clicked nothing that they turned a lock on |
| `frontend/src/components/workflows/definitionOps.test.ts` | 838-855 | The new WR-09 fence is a deny-list of one historical wording with no positive control | ⚠️ Warning (WR-12, round 3) | The next differently-worded cause attribution passes the fence unchanged |
| `frontend/src/components/workflows/SeedReceipt.test.tsx` | 911-936 | The new testid-coverage guard is lexical/patch-shaped: satisfiable by a comment, blind to `data-testid={"..."}`/`{'...'}` spellings and to sibling `data-*` state attributes | ⚠️ Warning (WR-13, round 3) | Measured directly by the reviewer's four probes; not re-run independently this session but the code shape (a plain string-match sweep) is confirmed by direct read |
| `frontend/src/components/workflows/SeedReceipt.tsx` | 20-29, 170-180 | Docblock claims "no second derivation to drift" while `intersectingKbTool` re-implements the same membership predicate `groundingCause` owns | ⚠️ Warning (WR-14, round 3) | Agree today; a drift risk if the membership rule ever stops being exact string equality |
| `frontend/src/components/workflows/definitionOps.ts` | 661-673 | `seedReceiptStepReason`'s `default:` arm silently returns `""` for any future `GroundingCause` member instead of a `never`-guard typecheck error | ⚠️ Warning (WR-15, round 3) | A 4th cause would render a sealed row with a dangling em-dash and no reason |
| `scripts/vitest-count-gate.cjs` | 70-88 | `SeedReceipt.test.tsx`/`definitionOps.test.ts` are not in `BASELINE`, so the 13 tests that close CR-03 could be deleted with the gate green | ⚠️ Warning (WR-16, round 3) | Confirmed by direct read: `grep -n "definitionOps\|SeedReceipt" scripts/vitest-count-gate.cjs` returns nothing |
| `backend/app/services/harness_engine.py` | 1065-1066 | No-transport fail-safe re-reads author disposition on an armed phase | ⚠️ Warning (WR-01, carried forward, unchanged) | Narrow, not production-reachable today |
| `backend/app/services/harness/validator_kinds.py` | 714-744 | Vestigial validator kind offers armed choices with un-armed semantics | ⚠️ Warning (WR-05, carried forward, unchanged) | Fenced today by publish |
| Various | — | WR-04, WR-06, WR-07, IN-01…IN-14 | ⚠️/ℹ️ carried forward, unchanged | Out of round 3's two-item scope; see `187-REVIEW.md` |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file touched by round 3 (re-confirmed this session
across the 4 files `git diff --name-only f632f9b6 HEAD -- frontend/src` lists).

### Behavioral Spot-Checks / Test Evidence (re-run independently this session)

| Check | Command | Result |
|---|---|---|
| The two round-3-owned suites | `npx vitest run src/components/workflows/SeedReceipt.test.tsx src/components/workflows/definitionOps.test.ts` (from `frontend/`) | **2 files, 288 passed, 0 failed** — matches `187-REVIEW.md`'s figure independently |
| WR-09 closure | `grep -n "own settings" frontend/src/components/workflows/definitionOps.ts` | **1 hit, inside the docblock only** (line 600) — zero inside `seedReceiptCarriedLead`'s return expressions |
| CR-04 (the new blocker) — data source | Direct read: `WorkflowBuilderPage.tsx:573` | **Confirmed**: `const phases = useStore(store, (s) => s.phases)` — a live selector, not a snapshot |
| CR-04 — lifecycle | `grep -n "setShowReceipt" frontend/src/pages/WorkflowBuilderPage.tsx` | **Confirmed**: exactly 2 writes — `useState(false)` init, `true` in `onDraft`, `false` only in `onDismiss`. No edit-triggered close exists. |
| CR-04 — the sibling edit path | Direct read: `PhaseFormPanel.tsx:871-876,923-928` -> `WorkflowBuilderPage.tsx:1245-1251,1819` | **Confirmed**: `available_tools` is free-text editable and reaches `store.patchConfig`, the same store the receipt's `phases` prop reads |
| CR-04 — no test sees it | `grep -c "rerender(" frontend/src/components/workflows/SeedReceipt.test.tsx` | **0** — no test in the file re-renders with mutated props |
| Zero-migration gate | `git diff --stat 35261e96 HEAD -- supabase/migrations` + `git status --porcelain supabase/migrations` | both **empty** |
| Round-3 scope fence | `git diff --stat f632f9b6 HEAD -- backend/ frontend/src/pages/WorkflowBuilderPage.tsx frontend/src/components/workflows/StepTypePicker.tsx` | **all empty** — round 3 touched exactly the 4 files it claimed |
| Requirements still Pending | `grep -n "VOCAB-01\|VOCAB-02\|VOCAB-03" .planning/REQUIREMENTS.md` | lines 42-44 (`[ ]`), 115-117 (`Pending`) — correctly unflipped |

Backend full-suite pre-existing rot is unaffected — round 3 committed zero backend files
(`git diff --name-only f632f9b6 HEAD -- backend/` empty, re-confirmed).

### Human Verification Required

**G-4 lived-experience gate.** Per CLAUDE.md, wire format + a screenshot are insufficient for phases
touching live UI. `187-VALIDATION.md` records **thirteen** rows (M1-M13) as UNPERFORMED at the close
of round 3 — M13 was added this round for the escalated-only case WR-09 broke, and M3/M9 were repaired
to describe what now ships. Because a code-level BLOCKER (CR-04) remains, `gaps_found` takes priority
over `human_needed` per the verification decision tree — but the manual board still stands, is one row
larger than round 2's, and is recorded in full in the frontmatter `human_verification` block above.
Full detail (all 13 rows, with round-3 amendments) is in that frontmatter block.

### Deferred Items (by name, with re-open trigger — not gaps of this phase)

- **WR-08** (`StepTypePickerProps` has no `nameContext` field) — explicitly routed by the operator to
  **Phase 188**. Open, not closed; not scored as met here, and not counted as a phase-187 blocker
  because a later phase in the same milestone is the named owner. **Re-open trigger:** Phase 188's
  `StepTypePicker`/`WorkflowCanvas.tsx` extraction work.
- `definitionOps.canRemovePhase`'s refusal notice stays on the undecorated `nodeTitle()` call — **re-open
  trigger: Phase 188's `WorkflowCanvas.tsx` extraction**.
- The armed-phase / synchronous-publish hole (D-187-12) — **re-open trigger:** the deferred Phase-103
  background-job publish rework, or the first live wedge.
- Making `harness_authoring_model` a real dynamic setting — **re-open trigger:** `BUG-260731-01`'s
  investigation or SEED-117 revival.
- Per-node review state, `technicalLine`, a direct template->canvas fork — excluded by SPEC, Phase 188.
- `tsc -b`'s 33 pre-existing errors (`D-ITEM-01`) — zero delta from round 3 too (re-confirmed via
  `187-20-SUMMARY.md`'s own measurement: 33 -> 33, 0 in touched files).
- A pre-existing `PublishGauntlet.test.tsx` parallel-execution flake affecting the frontend count gate
  (`D-ITEM-187-20-01`) — proved pre-existing by 187-20's own restore-and-re-run; not caused by this
  phase, not gating this verification.

**Not deferred (kept as an open gap, not moved to this section):** VOCAB-02 Req 5 / CR-04. No later
phase in the current ROADMAP names the seed receipt's data-flow lifecycle as in scope — Phase 188 is
named only for `StepTypePicker.tsx`/`WorkflowCanvas.tsx` extraction (WR-08's owner), not for
`WorkflowBuilderPage.tsx`'s `showReceipt`/`phases` wiring. Conservative matching per Step 9b: no
specific evidence ties CR-04 to a later phase's stated goal or success criteria, so it stays a gap.

### Gaps Summary

Round 3 closed exactly what it scoped to close, and closed it for real: CR-03 (zero test coverage on
the carried paragraph) and WR-09 (a false "by its own settings" cause claim) are both independently
re-confirmed fixed against live source and an independent 288/288 test run, not accepted on
`187-REVIEW.md`'s word. This is the third round in a row where the round's own two named findings were
verifiably closed.

But `187-REVIEW.md`'s own round-3 review — read first, then independently re-derived here rather than
trusted — surfaced a new Critical (CR-04) that this verification confirms is real: the receipt's
`phases` prop is a live store selector (`WorkflowBuilderPage.tsx:573`), not a snapshot of the definition
`/generate` returned, and nothing closes the receipt or freezes its data when the author edits a step
through the sibling `PhaseFormPanel` while the card is still open. The exact field the receipt's
grounding classification reads (`available_tools`) is one of the fields that panel lets the author
edit in free text, and the write path reaches the same store the receipt's prop pulls from — traced
end to end in this verification, not merely cited. The result: a user who switches on a KB tool ten
seconds after the receipt arrives sees the card's lead sentence flip to "so I set it to must prove it"
— attributing their own click to the AI, on the exact surface this phase built so that Phase 185's
grounding enforcement would be legible (SC#3). This is CR-01's failure shape for a third time, in a
third distinct place (round 1: the lead sentence's math; round 2: an uncovered sibling sentence; round
3: the data source's temporal reference), and no test in either owning suite exercises it — zero
`rerender()` calls exist in `SeedReceipt.test.tsx`, confirmed by direct grep.

VOCAB-02 Req 5 therefore remains not achieved. The phase goal's explicit safety clause — "a seeded
grounded node auto-gets its citation/confidence gate — safe-by-construction" — depends on this receipt
being a legible, honest record of what the AI actually did; a card that can start lying about authorship
the moment the user touches the form beside it is not safe-by-construction, it is safe only in the first
render.

Separately and unchanged: WR-08 (the `+` picker/card preview mismatch on `llm_emit` + a template asset)
remains open and was explicitly routed to Phase 188 by the operator — recorded as Deferred, not scored
as met and not counted against this round's score, per the operator's own routing decision. All other
truths (the 3-tier node-face ladder, generator-authored names, demote-on-edit, subtitle-only reveal, the
hoisted armed checkpoint (SC#6), the unbound-retrieval verdict, the template door (VOCAB-03), and the
SC#5/SC#10 measurement discipline) are unaffected by round 3's 4-file diff and remain independently
verified as green, with zero migrations across all three rounds and the D-187-14 mount cap untouched.

The fix is narrow and structurally clear: snapshot `phases` at the moment the receipt opens (mirroring
the pattern `187-REVIEW.md` itself proposes — a `receiptPhases` state set beside `setDrafted` in
`onDraft`, passed into `SeedReceipt` instead of the live selector) rather than re-plumb the whole page.
This is a closure-plan-sized gap, not a re-plan of the phase — but it is the third occurrence of the
same failure class on the same surface, and CLAUDE.md's workflow guardrails (G-1) note that repeated
insert-phases on the same hot surface should trigger a refactor consideration rather than a fourth
patch-sized fix, if a round 4 becomes necessary.

All thirteen manual rows (M1-M13) on `187-VALIDATION.md` remain unperformed and are the operator's;
`human_verification` items are recorded in this report's frontmatter but do not change the `gaps_found`
status, since a code-level BLOCKER (CR-04) takes priority in the decision tree.

---

*Verified: 2026-08-03T19:15:00Z*
*Verifier: Claude (gsd-verifier)*
