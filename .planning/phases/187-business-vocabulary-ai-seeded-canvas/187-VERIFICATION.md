---
phase: 187-business-vocabulary-ai-seeded-canvas
verified: 2026-08-04T04:10:00Z
status: passed
score: 13/14 must-haves verified (1 UNCERTAIN — SC#5's lived-experience half, human_verification)
overrides_applied: 0
closure:
  closed: 2026-08-04T19:05:00Z
  closed_by: "operator decision — direct fast-fix, NOT a gap-closure round 6"
  why_not_a_round: >-
    The operator asked why a 15-plan phase had become 29 across five rounds. The answer,
    measured: BOTH open gaps lived in code round 5 itself authored that same day
    (`DescribeKbPicker.tsx` created 2026-08-04 `f5a28e7e`; the pin block edited 2026-08-04
    `51c44f37`). A round 6 would have been 100% cleanup of round 5 — the loop was feeding
    itself. Every ROADMAP success criterion was already verified. So the two items were
    fixed directly under G-3 (small, single-concern, no schema or API surface) and the
    phase was closed. See the G-7 proposal in deferred-items.md.
  gap_1_closed:
    truth: "D-187-11 / the folded BUG-260731-03 verdict half — the picker helps the author satisfy the gate rather than defeating it"
    fix: "12069204 + f2a43fc9"
    evidence: >-
      `DescribeKbPicker` now surrenders a held `value` the settled fetch does not offer,
      handing `""` back to the parent. Fails toward UNBOUND — the state D-187-11 reads as
      legitimate and the server says out loud — never toward a silent binding. `loading` is
      excluded (not-asked-yet is not not-offered); `unavailable` is included, because when
      nothing renders the author cannot see or change what would be sent. 7 component cases
      + 2 END-TO-END WIRE cases on the door asserting the `project_folder_id` KEY is absent
      from the request the client actually sends — exactly the fence this report's `missing`
      item 3 asked for. All observed RED with the single `onChange("")` severed, measured in
      one tool call (the 187-27 apply-and-measure rule), restore sha256-verified.
    not_fixed_deliberately: >-
      The server's `if body.project_folder_id is None:` still tests nullity rather than
      resolvability, so a dead id from ANY other client would still suppress the finding.
      This report listed that as OPTIONAL and "a separate decision"; it is pre-existing,
      not round 5's, and it is a backend behaviour change that does not belong in a fast
      fix. Logged as D-ITEM-187-CLOSE-01.
  gap_2_closed:
    truth: "Every guard round 5 added lives in a suite whose per-file count is PINNED"
    fix: "e854a505 + f2a43fc9"
    evidence: >-
      TARGETS and BASELINE are two knobs — what RUNS and what is PINNED — and a page-level
      suite lands outside both by default. `WorkflowBuilderPage.describe.test.tsx` added to
      TARGETS (it was never executed by the gate) and pinned at 19; `WorkflowDoorSwitch.test.tsx`
      13 → 23; `WorkflowBuilderPage.canvas.test.tsx` 22 → 128; `DescribeKbPicker.test.tsx`
      30 → 37. Every number read from the gate's own printed `actual` column. Both new pins
      OBSERVED producing a `[count-decrease]` on a genuinely deleted `it(` block. The
      WR-R5-02 mis-attribution in the pin comment is corrected in the same commit.
      Baseline total 804 → 946.
  gates_at_closure:
    count_gate: "exit 0 — 2196 tests, failed 0, 22/22 pinned files, no per-file decrease"
    typecheck: "33 errors via `npx tsc --noEmit -p tsconfig.app.json`, unchanged from baseline, ZERO in the touched tree. NOTE: plain `npx tsc --noEmit` reports 0 because tsconfig.json is a solution file (`files: []`) and checks nothing — do not quote it (D-ITEM-187-23-02)."
    build: "npx vite build exit 0"
    backend: "test_187_route_assigned_reach.py + test_182_severity_codes.py 16/16 green"
    publish_gauntlet_flake: "RESOLVED — 5d9ba921 raised this suite's per-test budget to 20s. Load-sensitive, never a logic race; nothing weakened, no case skipped (D-ITEM-187-20-01)."
  manual_debt_carried_forward: >-
    CLOSING THE PHASE IS A DECISION, NOT A CLAIM THAT EVERY ROW RAN. `187-UAT.md` stands at
    6 passed / 1 blocked (M11, non-performable through the Builder) / 7 pending, and this
    report's `human_verification` list has 12 items. They remain owed and will keep
    surfacing in /gsd:progress and /gsd:audit-uat. M15b — the browser falsification of
    CR-R5-01 against a really-deleted folder — is the one to run first; jsdom cannot
    reproduce an RLS scope change or a real 5xx on the second fetch.
re_verification:
  previous_status: gaps_found
  previous_score: 10/11
  previous_verified: 2026-08-03T19:15:00Z
  previous_round: 3 (plans 187-20, 187-21)
  this_round: 5 (plans 187-26 … 187-29), diff base 15339441
  gaps_closed:
    - "CR-04 (round 3's sole BLOCKER — the seed receipt rendered a LIVE store selector, not a snapshot of what `/generate` returned) is CLOSED. Independently re-derived at HEAD by direct source read, not taken from `187-REVIEW.md`: `WorkflowBuilderPage.tsx:615` declares `const [receiptPhases, setReceiptPhases] = useState<readonly PhaseSpecJSON[]>([])`; the single write is `setReceiptPhases(def.phases)` at `:1228`, placed beside `setDrafted(def)` inside `onDraft`'s ONE state transition; and `:1656` renders `<SeedReceipt phases={receiptPhases} …>` — the live `useStore(store, s => s.phases)` selector no longer reaches the card. The proposed snapshot shipped as proposed. AND it was falsified LIVE by the operator: `187-UAT.md` row 9 records toggling `search_documents` OFF on step 1 with the card open — the canvas face changed ('Find supplier contracts and delivery incident reports' → 'Work out how to do it') while the receipt text stayed BYTE-IDENTICAL, and byte-identical again on toggle-back. That is CR-04's exact failure scenario, executed in a browser, not reproducing."
    - "WR-16 (round 3 — `SeedReceipt.test.tsx`/`definitionOps.test.ts` outside the count gate's pin map, so CR-03's thirteen cases were deletable with the gate green) is CLOSED. Re-measured by running the gate myself at HEAD: `scripts/vitest-count-gate.cjs:110` pins `definitionOps.test.ts` at 232 and `:113` pins `SeedReceipt.test.tsx` at 68, and BOTH reported delta `0` in my own run — pinned exactly, no slack. NOTE: the same defect CLASS is reintroduced by round 5 on three different suites — see gap 2 below. WR-16 is closed; the lesson it taught is not held."
  gaps_remaining: []
  gaps_new:
    - "CR-R5-01 — round 5's GAP A (the describe door's KB picker) introduces the first surface in the product that can put a STALE, INVISIBLE, non-null `project_folder_id` on the wire, and the server's `unbound_retrieval` rule tests only `is None` — so the new control can SUPPRESS the very governance verdict it was built to help the author satisfy. This is a REGRESSION against truth #8, which round 3 verified."
    - "187-29's own headline must_have is FALSE as shipped: three suites carrying round 5's load-bearing fences are unpinned or outside the gate entirely."
  regressions:
    - "Truth #8 (D-187-11 / the folded `BUG-260731-03` verdict half) moves VERIFIED → FAILED. Nothing in the backend rule changed — round 5's backend delta is provably comment-only — but round 5 built the first client path that can defeat it."
gaps:
  - truth: "An unbound retrieval workflow earns a deterministic `incomplete` verdict from `/validate` before a golden run is spent (D-187-11, the folded `BUG-260731-03` verdict half) — and the describe door's new picker helps the author satisfy that gate rather than defeating it"
    status: resolved  # closed 2026-08-04 by direct fix, not a round 6 — see closure.gap_1_closed (12069204 + f2a43fc9)
    reason: "Three facts, each re-read in source at HEAD rather than accepted from `187-REVIEW.md`, compose into a defect none of them has alone. (1) `DescribeKbPicker` never reconciles the `value` it is handed against the folders it actually fetched — `value` is rendered straight onto the `<select>` (`DescribeKbPicker.tsx:149`) and the only write is the user's own `onChange` (`:150`); there is no effect, no reconcile, no `onChange(\"\")` when the fetched `options` do not contain `value`. I confirmed the suite has no such case: the ONLY `value`-carrying test (`DescribeKbPicker.test.tsx:132`, 'reflects the value PROP') passes `CONTRACTS.id`, an id that IS offered. (2) When there is nothing to offer the picker renders NO CONTROL AT ALL — `if (options.length === 0) return stateMarker` (`:140`) — and `options` is `[]` in BOTH zero-row states, including `unavailable` (a failed fetch, `:118-124`). So a fetch blip hides the control while the parent's choice stands, with no way on screen to see or clear it. (3) The parent's choice is DELIBERATELY made to outlive the picker: `WorkflowDoorSwitch.tsx:117-118` states it as the design ('deliberately NOT cleared by `goBoth` … a considered pick is not undone by looking around'), and `goBoth` (`:128-131`) clears `handoffDraft` and not `kbFolderId`. The picker remounts and refetches on every re-entry to the describe door (`useEffect(…, [])`, `:99-129`) while `kbFolderId` survives. The stale id then flows: `initialProjectFolderId` seeds `projectFolderId` (`WorkflowBuilderPage.tsx:592`) and `onDraft` sends it (`:1213`). AND THE SERVER DOES NOT CATCH IT — I re-read the gate myself: `backend/app/api/workflows.py:755` is `if body.project_folder_id is None:`, so a non-null id pointing at a deleted / out-of-RLS-scope / unfetchable folder suppresses the `unbound_retrieval` finding ENTIRELY, `ok:true`, `blockedReason` is `null`, and Publish is ENABLED on a workflow whose retrieval steps are scoped to a folder that does not exist. I further confirmed nothing else covers for it: `GenerateRequest.project_folder_id` is `UUID | None` with no ownership or existence check, and NOTHING in `backend/app/services/harness/grounding.py` validates that `project_folder_id` resolves against `fetch_visible_folders` — `render_grounding_prompt` (`:441,455`) will happily tell the model 'The workflow is BOUND to project folder id=<dead id>'. The `is None`-only test is pre-existing D-187-11 behaviour and is NOT attributable to round 5; what round 5 authored is the first surface that can produce a stale, invisible, non-null id, which is what makes the composition newly reachable. The consequence is the exact inversion of GAP A's stated purpose: the control built so an author would be ASKED can, in its own failure mode, answer the gate on their behalf with an answer that is wrong and that they cannot see."
    artifacts:
      - path: "frontend/src/components/workflows/DescribeKbPicker.tsx"
        issue: "`:149` renders `value` onto the `<select>` with no reconciliation against the fetched `options`; `:140` returns no control at all when `options.length === 0`, which includes the `unavailable` (failed-fetch) state — so a live binding can stand with nothing on screen able to show or clear it"
      - path: "frontend/src/components/workflows/WorkflowDoorSwitch.tsx"
        issue: "`:123` `kbFolderId` is owned by the shell and, by explicit design (`:117-118`), is NOT cleared by `goBoth` (`:128-131`) — so the choice outlives every remount of the component that validated it"
      - path: "frontend/src/pages/WorkflowBuilderPage.tsx"
        issue: "`:592` seeds `projectFolderId` from `initialProjectFolderId` and `:1213` puts it on the `generateWorkflow` request unconditionally when truthy — no existence check on either side of the wire"
      - path: "backend/app/api/workflows.py"
        issue: "`:755` `if body.project_folder_id is None:` — the `unbound_retrieval` rule tests ONLY null, so any non-null id (live, dead, or fabricated) suppresses the finding. Pre-existing, but it is the amplifier that turns the client defect into a suppressed governance verdict"
      - path: "frontend/src/components/workflows/DescribeKbPicker.test.tsx"
        issue: "30 cases, none supplying a `value` absent from the fetched list — verified by direct read: `:132` is the only value-carrying case and it uses an offered id. The property is untested by construction"
    missing:
      - "The component that owns the offer must own the reconcile: after `setOptions(rows)`, `if (value !== \"\" && !rows.some(r => r.id === value)) onChange(\"\")` — and the same retraction on the `catch` branch, which today hides the control while leaving the binding live. Retract to `\"\"`, never to a fabricated row: 'we could not confirm your pick' resolves to NOT BOUND, which is the state `unbound_retrieval` can still speak about"
      - "Two falsifying leaf tests, both RED before the fix: a value the refreshed list no longer offers is retracted; a value is retracted when the list could not be fetched at all"
      - "The end-to-end fence that actually protects the wire, in `WorkflowDoorSwitch.test.tsx`: pick a folder, leave and re-enter the door with `listFolders` now rejecting, draft — and assert `generateWorkflow`'s request has NO `project_folder_id` key at all"
      - "OPTIONAL but recommended, and a separate decision: make the server's rule test resolvability rather than nullity, so a dead id cannot suppress the finding from any client, present or future"
  - truth: "Every guard round 5 added lives in a suite whose per-file count is PINNED, so it cannot be deleted with the gate green (plan 187-29's own headline must_have, and the Phase-177 lesson `vitest-count-gate.cjs`'s header cites)"
    status: resolved  # closed 2026-08-04 by direct fix, not a round 6 — see closure.gap_2_closed (e854a505 + f2a43fc9)
    reason: "MEASURED FALSE by running the gate myself at HEAD (`node scripts/vitest-count-gate.cjs` — exit 0, total 2168, failed 0, 21/21 pinned files present). The three NEW pins are exact and correct: `DescribeKbPicker.test.tsx` 30/30, `ProblemsTray.test.tsx` 30/30, `verdictModel.test.ts` 29/29, all delta 0. But round 5's load-bearing fences do not all live in those three files. (a) GAP A's ONLY end-to-end fence — the born-bound round trip that asserts the chosen folder reaches `generateWorkflow`'s `project_folder_id` on the request the client actually sends — lives in `WorkflowDoorSwitch.test.tsx` (`:293-330`, confirmed by direct read), pinned at 13 against an actual of 21. All eight of round 5's cases there sit in +8 of slack and are deletable with the gate green. (b) The ENTIRE GAP-B page estate and the whole 187-28 'GATED half' live in `WorkflowBuilderPage.canvas.test.tsx` (`describe` blocks at `:2788` and `:2985`, confirmed by direct read), pinned at 22 against an actual of 128 — +106 of slack. (c) `WorkflowBuilderPage.describe.test.tsx`, which round 5 extended with the additive-prop pins, DID NOT APPEAR IN THE GATE RUN AT ALL: it is absent from `TARGETS` (`vitest-count-gate.cjs:168-179`, re-read directly), so the gate neither runs it nor pins it. I ran it separately — 19 tests, all green — which is precisely the point: it is healthy and entirely outside the gate's blast radius. This is round 3's WR-16 reintroduced on three new suites, in the same commit whose header block cites WR-16's lesson. A pin with slack in front of it is not a pin; a suite outside `TARGETS` is not covered by anything."
    artifacts:
      - path: "scripts/vitest-count-gate.cjs"
        issue: "`:153` pins `WorkflowDoorSwitch.test.tsx` at 13 (actual 21); `:148` pins `WorkflowBuilderPage.canvas.test.tsx` at 22 (actual 128); `:168-179` `TARGETS` omits `src/pages/WorkflowBuilderPage.describe.test.tsx` entirely. Additionally `:118-142`'s new comment block attributes GAP A's born-bound round trip to `DescribeKbPicker.test.tsx`, but that round trip is in `WorkflowDoorSwitch.test.tsx` — the comment names the wrong owner"
      - path: "frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx"
        issue: "carries GAP A's only end-to-end wire assertion (`:309-330`) inside 8 tests of unpinned slack"
      - path: "frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx"
        issue: "carries every GAP-B page fence and the whole GAP-C client half inside 106 tests of unpinned slack"
      - path: "frontend/src/pages/WorkflowBuilderPage.describe.test.tsx"
        issue: "19 green tests, zero gate coverage — the file is not in `TARGETS`, so the gate can neither run it nor notice its deletion"
    missing:
      - "Raise `WorkflowDoorSwitch.test.tsx` to its measured actual (21) and `WorkflowBuilderPage.canvas.test.tsx` to its measured actual (128) — numbers read from the gate's own `actual` column, never hand-counted"
      - "Add `src/pages/WorkflowBuilderPage.describe.test.tsx` to `TARGETS` and then pin it from the resulting `actual` column"
      - "Correct the `:118-142` comment so the born-bound round trip is attributed to the suite that actually holds it"
      - "Observe each new/raised pin biting: delete one `it(` block per file and confirm `[count-decrease]` names that file at `failed 0`. A pin never seen biting is a gesture"
deferred:
  - truth: "The `＋` row previews the exact sentence the card that lands will say, for all six step types (WR-08 — `StepTypePickerProps` carries no `nameContext` field)"
    addressed_in: "Phase 188"
    evidence: "Explicitly routed to Phase 188 by the operator and recorded across rounds 2/3; Phase 188's goal covers the run-observability rebuild of the canvas surfaces and the `WorkflowCanvas.tsx` extraction named as the re-open trigger. Confirmed still open at HEAD: `StepTypePicker.tsx` has no `nameContext` field."
  - truth: "`WorkflowDoorSwitch` reads no feature flag, so the KB picker renders on the loose 'Describe & run' door with `visual_workflow_canvas` OFF (D-ITEM-187-29-01)"
    addressed_in: "deferred-items.md — undecided, re-open trigger recorded"
    evidence: "Recorded as an undecided QUESTION, not a defect, with a concrete re-open trigger (the next plan touching `WorkflowDoorSwitch`, or any plan that must revert the v3.6 surfaces from the flag alone). Its D-181-01 scoping is CORRECT as measured — see the Anti-Patterns table for why it is a Warning here rather than a Blocker."
human_verification:
  - test: "M15 (NEW, round 5, UNPERFORMED) — you can say what the workflow is ABOUT before the AI drafts it, and the control is findable at the moment it matters"
    expected: "Open the loose 'Describe & run' door. The knowledge-base picker is visible and reads as something you may answer, not as decoration. Pick a folder, describe a workflow with a retrieval step, draft. The arriving draft is bound to what you picked, and Publish is NOT greyed for 'not bound to a knowledge base'."
    why_human: "The whole defect GAP A closes is that the fast path never ASKED. A picker that is technically present but reads as decoration reproduces the defect with every test green. Findability is perceptual."
  - test: "M15b (NEW, from CR-R5-01 — run this one FIRST, it is the falsification of the blocker above)"
    expected: "Pick a folder on the describe door. Click '‹ both doors', then re-enter the describe door with the folder list now failing or with that folder deleted. EXPECTED-CORRECT behaviour: nothing invisible is bound. OBSERVE what actually happens — the report predicts the draft is silently born bound to the folder you can no longer see, and that Publish is enabled with the unbound-retrieval verdict suppressed."
    why_human: "Confirms the blocker end-to-end in a real browser against a real server, with the folder actually deleted — jsdom cannot reproduce an RLS scope change or a real 5xx on the second fetch."
  - test: "M16 (NEW, round 5, UNPERFORMED) — a draft you just opened does not claim it passed a check nobody ran, and THE FIRST SECOND IS THE TEST"
    expected: "Open an existing draft into the canvas. In the first moments the tray must NOT show the all-clear line or the 'checked by the server' attribution, and Publish must be blocked with 'Not checked yet.' Then the real answer arrives and replaces it."
    why_human: "The jsdom cases prove the state machine but cannot see a FLASH. A card that renders the old all-clear for 200 ms and then corrects itself passes every assertion in the suite and is exactly the lie the operator originally caught (`validateCallsMade: 0`)."
  - test: "M17 (NEW, round 5, UNPERFORMED) — the fast path is still fast: ignore the picker entirely and nothing costs you anything"
    expected: "Type a requirement, ignore the picker, click 'Draft the workflow' in one motion. No hesitation beat, no sense that you ought to answer the picker first, and the CTA must not move under your cursor when the folder list resolves."
    why_human: "The suite asserts the CTA is enabled by text alone and that choosing nothing sends no `project_folder_id` key. It cannot measure friction or a post-resolve layout shift — the sketch-approved fast path's only promise is speed."
  - test: "M4 / UAT-6 (UNPERFORMED) — the derived face tracks a skill bind/unbind live, without a save and without flicker"
    expected: "Bind a skill to a step, then unbind, watching the face the whole time. It may briefly show the generic type sentence before the skill name settles; it must never flash a raw id, a placeholder, or blank."
    why_human: "The mount-fetch settle (miss-on-first-paint, resolve-on-mount) is only observable live (Req 1 / Pitfall 1)."
  - test: "M10 / UAT-10 (UNPERFORMED) — the zero-detected draft still arrives as one thing, not a card with a hole in it"
    expected: "Describe a workflow with no retrieval at all. The receipt still arrives whole, heading and closing line intact, the 'You can't turn that off' sentence absent."
    why_human: "Whether a component with a paragraph removed still reads as compositionally whole is a judgement only a person makes (Req 5 / D-187-10)."
  - test: "M11 / UAT-4 (BLOCKED — recorded ⛔, not omitted) — the card states no capability the step lacks, and still states the one it has"
    expected: "Bind a folder on a step type that cannot search: the card must NOT say 'Search {folder}'. Bind the same folder on an agent step: it must say 'Search {folder}'. Read both side by side."
    why_human: "The contrast only convinces when two cards are seen together. BLOCKED: `187-UAT.md` row 4 records the instruction is NOT performable through the Builder — `folder_scope` is display-only there (`PhaseFormPanel.tsx:387`, `testId=\"folder-scope-display\"`) and nothing in `frontend/src` writes it. Reaching the contrast requires PATCHing a non-searching phase via the API. Row is UNPERFORMED — not passed, not failed. This is the one hole in SC#5's lived-experience half."
  - test: "M12 / UAT-5 (UNPERFORMED) — the ＋ row promises the sentence the card that lands actually says"
    expected: "Open ＋ on the lane, read every row aloud, click the human-input row, confirm the card says the same sentence the row promised; repeat with a control row."
    why_human: "The drift is semantic, not lexical — both strings are imported identifiers, so every source fence stays green through the whole defect. NOTE WR-08 STANDS and is routed to Phase 188: an `llm_emit` row with a template asset still reads 'Produce the deliverable' in the menu while the card that lands reads 'Fill <filename>.docx'. Try the deliverable row on a template-bearing draft, not just the human-input control."
  - test: "M13 / UAT-11 (UNPERFORMED) — the escalated-only draft's card agrees with itself"
    expected: "On a no-retrieval draft, turn the grounding dial to 'must prove it' on ONE step yourself. The paragraph and the row two lines below must say the same thing about who applied the seal; the row must read 'it was set to must prove it by hand', NOT 'YOU turned this on by hand'; the one-way 'You can't turn that off' line must be absent."
    why_human: "Whether a paragraph and its own rows two lines apart read as agreeing or contradicting is a judgement only a person makes (Req 5 / WR-09)."
  - test: "M6 / UAT-13 (UNPERFORMED) — SC#6 live: an armed checkpoint cannot be preempted by an author-declared pre-gate"
    expected: "Run an armed phase carrying a `timing=\"pre\"` `ask_user` validator. Answer the author's gate Proceed; confirm the ARMED checkpoint still appears in the chat `PendingAskCard`. Refuse it. Confirm the step did NOT run and `harness_audit` has ZERO `validator_ask_user_approved` rows for it."
    why_human: "Needs a live Redis rendezvous and a real browser answer. The 38 green backend property tests prove the property in isolation, not the end-to-end path the SPEC's acceptance criteria require."
  - test: "M7 / UAT-12 (UNPERFORMED) — SC#10 live row: the `HARNESS_AUTHORING_MODEL` env path actually reaches `resolve_authoring_model`"
    expected: "Restart the backend with `HARNESS_AUTHORING_MODEL` set; generate a workflow; confirm the model actually used matches the env var (backend logs or LangSmith, not assumed)."
    why_human: "Requires a backend restart; the roster test proves the service function under a stub provider, not the env-to-running-process path. NOTE the standing landmine: `harness_authoring_model` is env-only — there is no Settings UI and no `app_settings` row — so SC#10's 'app setting' does not exist."
  - test: "M8 / UAT-14 (UNPERFORMED) — flag-OFF Builder first screen is byte-identical to today (whole-screen read)"
    expected: "Turn `visual_workflow_canvas` OFF; open the Builder's FIRST SCREEN; confirm no template line and nothing else changed. Then turn it back ON."
    why_human: "The automated byte-pins (`revertByteIdentical.test.tsx` 7/7, `WorkflowBuilderPage.header.test.tsx` 27/27, both green in my own gate run) cover specific regions; the manual row looks at the whole screen. IMPORTANT so you do not record a false failure: the loose 'Describe & run' DOOR — a different, upstream surface — now shows a KB picker regardless of the flag (D-ITEM-187-29-01). On the door that is the known item; on the BUILDER'S OWN first screen it IS a failure of this row."
  - test: "SC#5 residual — vocabulary expressiveness read as a whole, not as a corpus sweep"
    expected: "Against the PM pack + the 3 curated starters + the 4 canonical seed shapes: no jargon leak AND no over-simplification. The automated corpus half is green and genuinely covers the named corpus; what a person must judge is whether the plain-language layer has been flattened into vagueness — 'not a toy demo' is the SPEC's own phrasing and is not a grep-able property."
    why_human: "SC#5 is a lived-experience criterion by construction (G-4). M1/UAT-2 passed on a real 4-step generated draft, which is real evidence for one half; M11 (blocked) and M12 (pending) are the unmet remainder."
---

# Phase 187: Business Vocabulary + AI-Seeded Canvas — Verification Report

**Phase Goal:** A business user sees plain-language node verbs and can describe a workflow in
natural language to get a safe, editable seeded canvas draft (AI + visual, not either/or) — and
the AI seed respects grounding mode (a seeded grounded node auto-gets its citation/confidence
gate — safe-by-construction). Vocabulary work sits on the validated + graded model from
Phases 182-185.

**Requirements:** VOCAB-01, VOCAB-02, VOCAB-03 (+ SC#6 / SEED-137, folded 2026-07-31)
**Verified:** 2026-08-04T04:10:00Z
**Status:** gaps_found
**Re-verification:** Yes — FOURTH verification pass. The prior report covered round 3
(plans 187-20/21). Rounds 4 (22-25) and 5 (26-29) have shipped since. This pass verifies the
PHASE at HEAD, weighted toward round 5's delta (`15339441..HEAD`, 16 files).

---

## What changed since the last verification

Round 3's single blocker is genuinely closed and was falsified live in a browser. Round 5 built
three real things — and introduced one new blocker and one false honesty claim.

| | Round 3 finding | Status at HEAD | How established |
|---|---|---|---|
| CR-04 | Seed receipt rendered a live store selector | **CLOSED** | Snapshot shipped (`:615`/`:1228`/`:1656`) + operator falsified it live (`187-UAT.md` row 9) |
| WR-16 | Two suites outside the pin map | **CLOSED** | Both pinned, both delta 0 in my own gate run |
| — | — | **NEW BLOCKER: CR-R5-01** | Re-derived in source; server amplifier re-read at `workflows.py:755` |
| — | — | **NEW GAP: 187-29's headline must_have is false** | Re-measured by running the gate myself |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | **SC#1 / VOCAB-01** — plain-language node names/verbs with a Technical-names reveal; `nodeTitle()` resolves 3 tiers (author name → config-derived → type sentence), computed never stored | ✓ VERIFIED | `phaseVocabulary.ts:211` `nodeTitle(phase, ctx)`, `:152` `PHASE_TYPE_SENTENCES`, `:226` `technicalTitle`, `:595` `derivedFaceOf`. Reveal wired: `WorkflowCanvas.tsx:883-884,952,1292-1293`. **Live**: `187-UAT.md` row 2 PASSED on a real 4-step generated draft — four distinct business-language faces, no raw ids. 1 carried Warning (WR-08) deferred to Phase 188. |
| 2 | **VOCAB-01 Req 3** — an identity-bearing config edit clears a generator-seeded name and leaves a hand-typed name untouched; zero migration | ✓ VERIFIED | `definitionOps.ts:251-281` — clears BOTH `name` and `name_seeded_by_ai`, gated on a seeded name that actually exists (`:280-281`); `:254` a hand-typed name (marker absent/false) is never cleared. Marker is a JSONB field — zero-migration confirmed below. |
| 3 | **VOCAB-01 Req 4** — the reveal swaps the canvas card's SUBTITLE, not its TITLE; no layout jump | ✓ VERIFIED (live) | `187-UAT.md` row 3 PASSED with measurements over 3 ON/OFF cycles: title byte-identical in every state, only the subtitle swaps, node x/y identical across all 7 states, width constant; the 207→187 height change is entirely subtitle re-wrap with the title and seal pinned. |
| 4 | **SC#2 / VOCAB-02** — describe in NL → seeded, EDITABLE canvas draft, wiring `POST /generate` into `toCanvas` | ✓ VERIFIED | `WorkflowBuilderPage.tsx:1209` `generateWorkflow({describe, ...})` → `:1219-1222` → `store.getState().setDrafted(def)` in ONE state transition → store `phases` → `canvasModel.ts:354` `toCanvas` projection. **Live**: UAT row 2 rendered a real 4-step draft on the canvas; UAT row 9 edited it in place. |
| 5 | **SC#3 / VOCAB-02** — the AI seed structurally cannot emit an unsafe node: response schema IS the `extra="forbid"` union, the seeded draft passes the same server validate route, and a seeded grounded node auto-gets its citation/confidence gate | ✓ VERIFIED | (a) `workflow_authoring.py:140` `WF_SCHEMA = _strip_discriminator(WorkflowDefinition.model_json_schema())` is the emit tool schema, and `harness.py:35` `model_config = ConfigDict(extra="forbid")`; emission runs through `forced_emit(schema_model=WorkflowDefinition)` + `model_validate()`. (b) fidelity + verdicts delegate to the ONE shared `app.services.harness.grounding` that `/validate` and publish stage 2.6 both call (`workflow_authoring.py:26-31,174-216`). (c) `grounding.py:951-954` — `if grounding_cause(phase) == "detected"` synthesizes exactly one `citations_required` gate, computed at run time and NEVER stored, so there is no representable value that says a detected step is ungated (`:814-822`). |
| 6 | **VOCAB-02 Req 5** — a seeded draft shows a receipt naming exactly the grounded steps with reasons, and every sentence stays honest about who applied the gate AT EVERY POINT THE CARD CAN BE VIEWED | ✓ VERIFIED — round 3's blocker CLOSED | Snapshot shipped: `WorkflowBuilderPage.tsx:615` declares `receiptPhases`, `:1228` writes it once beside `setDrafted`, `:1656` renders it instead of the live selector. **Falsified live**: UAT row 9 — canvas face changed under an edit while the receipt stayed BYTE-IDENTICAL, both directions. This truth failed for three different reasons across rounds 1-3; it now holds. |
| 7 | **SC#6 / VOCAB-02 Req 7** — an armed action-risk checkpoint is always asked regardless of author-declared validators; a refusal writes ZERO approval receipts | ✓ VERIFIED (automated); live row owed | `test_187_armed_checkpoint_property.py` + `test_187_authoring_step_names.py` → **38 passed**, run by me at HEAD. Backend untouched by round 5 (delta is comment-only, proved below). The end-to-end confirmation the SPEC's acceptance asks for is M6/UAT-13, still unperformed → `human_verification`. |
| 8 | **D-187-11** (the folded `BUG-260731-03` verdict half) — an unbound retrieval workflow earns a deterministic `incomplete` verdict from `/validate` before a golden run is spent, and round 5's new picker helps the author satisfy that gate | ✗ **FAILED — BLOCKER (CR-R5-01). REGRESSION: this was VERIFIED in round 3.** | The rule itself is intact and its client reach is now correctly documented and fenced. But round 5 built the first surface that can put a stale, invisible, non-null `project_folder_id` on the wire, and `workflows.py:755` gates on `is None` only — so the new control can suppress the verdict it exists to help satisfy. Full derivation in Gaps below; every cited line re-read directly. |
| 9 | **SC#4 / VOCAB-03** — start from a template / starter flow; choosing one fills the describe box and leaves the user on the describe screen with the CTA enabled | ✓ VERIFIED (live) | `StarterTemplatePicker.test.tsx` 40/40 green in my gate run. **Live**: UAT row 1 PASSED — operator opened the starter door and confirmed all 3 templates seed human-sounding describe text. |
| 10 | **SC#5** — vocabulary expressiveness validated against the PM pack + Starter Library + all 4 canonical seed shapes; no jargon leak, no over-simplification | ? UNCERTAIN — automated half VERIFIED, lived-experience half INCOMPLETE | `phaseVocabulary.corpus.test.ts` 45/45 green, and it is a real acceptance bar: 15 fixtures / 36 phases drawn from `__fixtures__/canvasFixtures.ts`, with a corpus SELF-CHECK (`:155-181`) that fails if the sweep stops covering the 4 canonical seeds, the 3 starters or the PM pack, plus a witness that the pre-187 resolution FAILS on the corpus's same-face pair (`:356`). What it cannot judge is over-simplification. M1/UAT-2 passed (one half); M11 is BLOCKED as non-performable and M12 is pending → `human_verification`. |
| 11 | **SC#10** — the cross-provider roster is driven honestly; blocked/failed rows recorded with reasons, never silently omitted | ✓ VERIFIED (documented narrowing, unchanged) | Backend untouched by round 5. The roster method and its named blocked rows stand from the prior round; the automated unit half runs under a deliberately-fake `STUB_PROVIDER` with zero global mutation (`test_187_authoring_step_names.py:132-156`). The live env-path row (M7) is owed. |
| 12 | **Zero migrations added by this phase, across all five closure rounds** | ✓ VERIFIED | Re-run by me: `git diff --stat 35261e96..HEAD -- supabase/migrations` → empty; `git status --porcelain supabase/migrations` → empty. |
| 13 | **GAP B (187-27)** — a check that did NOT RUN never unblocks a publish; opening an existing draft ISSUES a validate; with the flag OFF it issues zero | ✓ VERIFIED (1 Warning) | Traced end to end in source: `verdictModel.ts:124` widens the union to `TrayCheckCause = DegradedValidationCause \| "not-run"`, `:126-132` gives it a sentence, `:150` `isCheckOutstanding` is keyed on `ValidationState["kind"]` so a renamed loop state is a typecheck error. `WorkflowBuilderPage.tsx:810` widens the hook's `enabled` to `hasEdited \|\| (canvasEnabled && phases.length > 0)` — the `canvasEnabled &&` is what keeps D-181-01. `:1130` fails CLOSED (`blockedReason` returns the not-run sentence while outstanding) and `:1377` makes never-ran OUTRANK the persisted mirror. Consumed at `ProblemsTray.tsx:150,205` and `WorkflowCanvas.tsx:473-474`. Warning WR-R5-04 below. |
| 14 | **187-29** — every guard round 5 added lives in a suite whose per-file count is PINNED, so it cannot be deleted with the gate green | ✗ **FAILED** | Re-measured by running the gate myself. Three new pins are exact (delta 0). But `WorkflowDoorSwitch.test.tsx` is 13/**21**, `WorkflowBuilderPage.canvas.test.tsx` is 22/**128**, and `WorkflowBuilderPage.describe.test.tsx` is not in `TARGETS` at all. Round 5's load-bearing fences sit in that slack. Full detail in Gaps. |

**Score: 11/14 truths verified.** 2 FAILED (both BLOCKER-class), 1 UNCERTAIN.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | WR-08 — `StepTypePickerProps` has no `nameContext` field, so the ＋ row can promise a different sentence than the card that lands | Phase 188 | Operator-routed across rounds 2/3; re-open trigger is Phase 188's `WorkflowCanvas.tsx` extraction. Confirmed still open at HEAD. |
| 2 | `definitionOps.canRemovePhase`'s refusal notice sits on the undecorated `nodeTitle()` call | Phase 188 | Same re-open trigger (`WorkflowCanvas.tsx` extraction). |
| 3 | The armed-phase / synchronous-publish hole (D-187-12) | deferred — Phase 103 background-job publish rework | Re-open trigger recorded; or the first live wedge. |
| 4 | `harness_authoring_model` as a real dynamic setting (env-only today) | deferred — `BUG-260731-01` | Standing landmine; SC#10's "app setting" does not exist. |
| 5 | D-ITEM-187-29-01 — `WorkflowDoorSwitch` reads no feature flag | undecided, re-open trigger recorded | See Anti-Patterns for why this is a Warning and not a D-181-01 Blocker. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/workflows/DescribeKbPicker.tsx` | the loose door's KB picker — one api symbol, no store, no route name; `contains: "project-folder-picker"` | ⚠️ **SUBSTANTIVE + WIRED, but SEMANTICALLY INCOMPLETE (CR-R5-01)** | 167 lines, real. Reuses the shipped `data-testid="project-folder-picker"` (`:147`) deliberately. Reads exactly one api symbol (`:52` `listFolders`). Holds four states apart (`:79`) and distinguishes "there are none" from "we could not ask" via a `hidden`/`aria-hidden` state marker (`:135-136`). Totality on nameless folders (`:114`). **The gap:** it never reconciles `value` against the folders it fetched, and returns no control at all at `:140` when there are none — so a binding it cannot show can still stand. |
| `frontend/src/components/workflows/DescribeKbPicker.test.tsx` | the picker's own suite; `contains: "POSITIVE CONTROL"` | ⚠️ **PRESENT, 30/30 green, BLIND TO THE DEFECT** | Pinned at 30 with delta 0. But the ONLY `value`-carrying case (`:132`) uses an id that IS offered — the reconcile property is untested by construction. |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | the picker mounted on the describe door + the chosen id carried through the existing handoff; `contains: "DescribeKbPicker"` | ✓ CONTRACT MET (with two Warnings) | `:34` imports it, `:257` mounts it, `:196` carries `initialProjectFolderId={kbFolderId}` into the govern-door Builder. Warnings: the mount is unconditional and the shell reads no flag (D-ITEM-187-29-01); and its `:82-83` docblock still says "the 13 shipped assertions in `WorkflowDoorSwitch.test.tsx`" when the file now runs 21 — a stale count in a docblock. |
| `frontend/src/components/workflows/verdictModel.ts` | the third check-state cause and its sentence; **planned** `contains: "unchecked"` | ✓ **INTENT MET — LETTER NOT MET, and the deviation is CORRECT** | The member shipped as `not-run` (`:124`, `:132`), not `unchecked`, because `"unchecked"` is on the graded-governance never-say list — confirmed at `governanceVocabulary.test.ts:141` (`tok("Unch","ecked")` inside `BANNED_WORDS`, swept word-anchored over user-visible strings). **The rename must NOT be reversed.** Scored honestly as a planned-artifact deviation; plan 187-29 already recorded it as such (decision D-187-29-03) rather than folding it into a green tick. |
| `frontend/src/components/workflows/ProblemsTray.test.tsx` | the fence that the all-clear sentence cannot render before a validate response; `contains: "POSITIVE CONTROL"` | ✓ VERIFIED | 30/30, pinned, delta 0. Absence assertions with a positive control — the correct shape for this class. |
| `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` | validate-on-open, the fail-closed publish window, the flag-OFF zero-request pin, and 187-28's client half; `contains: "unchecked"` / `"unbound_retrieval"` | ⚠️ **CONTENT VERIFIED, GATE COVERAGE NOT** | Both `describe` blocks present and green (`:2788` GAP B, `:2985` GAP C). Contains `"unchecked"` at `:2875` (a test title — user-invisible, so no vocabulary conflict). **But 106 of its 128 tests are unpinned slack.** |
| `backend/app/api/workflows.py` | the corrected comment above `_ROUTE_ASSIGNED_CODES`; `contains: "_ROUTE_ASSIGNED_CODES"` | ✓ VERIFIED | `:469-513` — a four-part correction that states what is TRUE (the codes stay out of the shared collector, so the SERVER gate is unchanged), what was FALSE (they DO reach `blockedReason` and grey the client Publish control), that this is intended per operator decision, and WHERE each half is measured. It deliberately does not quote the old sentence, so the source pin that fences its absence stays armed. |
| `backend/tests/unit/test_187_route_assigned_reach.py` | the server-side property + the source pin beneath it; `contains: "grounding_verdicts"` | ✓ VERIFIED | 370 new lines. Run by me with `test_182_severity_codes.py` → **16 passed**. Property over the quantified SET, with a subset positive control that cannot shadow the disjointness assertion. |
| `scripts/vitest-count-gate.cjs` | per-file pins for the three suites carrying round 5's honesty estate; `contains: "DescribeKbPicker.test.tsx"` | ⚠️ **CONTRACT MET LITERALLY, PURPOSE NOT MET** | The literal `contains` passes (`:143`). The three pins are exact. The must_have the artifact exists to serve — "every guard round 5 added cannot be deleted with the gate green" — is FALSE. See gap 2. |
| `.planning/.../187-VALIDATION.md` | the round-5 section; `contains: "187-26-T1"` | ⚠️ PRESENT, but its frontmatter counter is STALE | The round-5 section and M15/M16/M17 are present. `manual_rows_performed: 0` is FALSE at HEAD — see "Manual verification: the real count" below. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `WorkflowDoorSwitch.tsx` | `WorkflowBuilderPage.tsx` | the additive-optional `initialProjectFolderId` prop | ✓ WIRED | `:196` passes it; `WorkflowBuilderPage.tsx:523` declares it optional, `:592` uses it ONLY as the fallback after `initial?.definition.project_folder_id` — so an absent prop leaves today's initializer untouched. |
| `DescribeKbPicker.tsx` | `frontend/src/lib/api.ts` | `listFolders` — the ONE api symbol | ✓ WIRED | `:52` is the file's only api import; `:103` its only call. |
| door choice | `generateWorkflow`'s request | `kbFolderId` → `initialProjectFolderId` → `projectFolderId` → the request body | ⚠️ **WIRED, AND THAT IS THE PROBLEM (CR-R5-01)** | `WorkflowBuilderPage.tsx:1213` `...(projectFolderId ? { project_folder_id: projectFolderId } : {})` — key ABSENT when empty, which is the correct wire shape. The defect is that `projectFolderId` can hold an id the author cannot see and did not confirm on that mount. Guarded end-to-end by exactly one test (`WorkflowDoorSwitch.test.tsx:309-330`), which lives in unpinned slack. |
| `WorkflowBuilderPage.tsx` | `useLiveValidation` | the widened `enabled` argument | ✓ WIRED | `:810` `hasEdited \|\| (canvasEnabled && phases.length > 0)`. The `canvasEnabled &&` half has its own falsification test in the canvas suite. |
| `WorkflowBuilderPage.tsx` | `ProblemsTray.tsx` | the canvas session's check-state cause, through `WorkflowCanvas` | ✓ WIRED (planned pattern `"unchecked"` → shipped `"not-run"`) | `:1377` sets `degraded: isCheckOutstanding(...) ? "not-run" : …` → `WorkflowCanvas.tsx:473-474` types it `TrayCheckCause` → `ProblemsTray.tsx:150,205` renders `DEGRADED_SENTENCE[degraded]`. |
| `backend/app/api/workflows.py` | `test_187_route_assigned_reach.py` | the test imports the module and asserts over its real sets and real source | ✓ WIRED | 16/16 green, run by me. |
| `scripts/vitest-count-gate.cjs` | `DescribeKbPicker.test.tsx` | the BASELINE pin map | ✓ WIRED (this one link) — ✗ NOT WIRED for `WorkflowBuilderPage.describe.test.tsx` | `:143` pins the picker. `:168-179` `TARGETS` omits the describe suite entirely, so the gate cannot even run it. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `SeedReceipt` | `phases` prop | `WorkflowBuilderPage.tsx:615` `receiptPhases`, written once at `:1228` from `def.phases` | Yes — a real snapshot of the generation it narrates | ✓ **FLOWING, and now correctly TENSED.** Round 3's HOLLOW-BY-TIMING finding is resolved: past-tense copy over a past-tense snapshot. |
| `DescribeKbPicker` | `options` | `listFolders()` on mount (`:99-129`) | Yes — a real org/RLS-scoped folder read | ✓ FLOWING |
| `DescribeKbPicker` | `value` (what is actually SENT) | the parent's `kbFolderId`, which outlives every remount | **NOT ALWAYS** | ✗ **HOLLOW_PROP, inverted.** The usual failure is a prop hardcoded empty. Here the prop can be non-empty while the surface renders nothing (or renders a blank `<select>` at `selectedIndex = -1`), so the value on the wire is real, invisible, and possibly dead. Real data flowing under a false display is exactly as wrong as no data. |
| `ProblemsTray` | `degraded` cause | `WorkflowBuilderPage.tsx:1377` from the live validation state machine | Yes | ✓ FLOWING |
| canvas node marks | `groups: verdictGroups` | `WorkflowBuilderPage.tsx:1372` | Yes, but ungated by `isCheckOutstanding` | ⚠️ **STATIC during `not-run`** — see WR-R5-04. |

### Behavioral Spot-Checks (every command run by me at HEAD)

| Check | Command | Result | Status |
|---|---|---|---|
| Frontend count gate | `node scripts/vitest-count-gate.cjs` | exit **0** — total **2168**, failed **0**, 21/21 pinned present, no per-file decrease | ✓ PASS |
| Pin slack (the falsification of 187-29's headline) | same run, `pinned`/`actual` columns | `WorkflowDoorSwitch` 13/**21**; `canvas` 22/**128**; `DescribeKbPicker` 30/30; `ProblemsTray` 30/30; `verdictModel` 29/29; `describe.test.tsx` **absent from the run** | ✗ FAIL |
| The suite the gate cannot see | `npx vitest run src/pages/WorkflowBuilderPage.describe.test.tsx` | **19 passed**, 0 failed | ✓ PASS (and outside the gate — that is the finding) |
| Typecheck — the REAL one | `npx tsc --noEmit -p tsconfig.app.json` | **33 errors**, all pre-existing (D-ITEM-01 baseline); **ZERO** in `src/components/workflows/` or `WorkflowBuilderPage.tsx` — grouped by file, the 19 owning files are chat/panel/settings/stores/hooks | ✓ PASS for this phase |
| Typecheck — the VACUOUS one | `npx tsc --noEmit` (no `-p`) | exit **0**, no output | ⚠️ **Do not quote this as evidence.** `frontend/tsconfig.json` is a solution file (`files: []`), so this checks ZERO files. Recorded as D-ITEM-187-23-02. |
| Production build | `npx vite build` | exit **0**, built in 4.32s | ✓ PASS |
| Round-5 backend tests | `pytest tests/unit/test_187_route_assigned_reach.py tests/unit/test_182_severity_codes.py -q` | **16 passed** | ✓ PASS |
| Phase-187 backend property tests | `pytest tests/unit/test_187_armed_checkpoint_property.py tests/unit/test_187_authoring_step_names.py -q` | **38 passed** | ✓ PASS |
| Round-5 backend delta is comment-only | `git diff -U0 15339441..HEAD -- backend/app/api/workflows.py` filtered to non-comment, non-blank changed lines | **zero lines** (same for `test_182_severity_codes.py`) | ✓ PASS |
| Zero-migration gate | `git diff --stat 35261e96..HEAD -- supabase/migrations` + `git status --porcelain` | both **empty** | ✓ PASS |
| Debt markers in round 5's 16 files | `grep -nE "(^\|[^A-Za-z])(TBD\|FIXME\|XXX)([^A-Za-z]\|$)"` over the diff's file list | **zero hits** | ✓ PASS |
| Backend full unit suite | `pytest tests/unit -q` | **62 failed / 1700 passed** / 2 xfailed / 2 xpassed | ⚠️ PRE-EXISTING ROT — see below |

**The backend unit suite is not currently a usable regression backstop, and that is not this
phase's doing.** The 62 failures span 17 files, none of them touched by Phase 187 and none in the
workflow / harness / grounding subsystems: `test_retrieval_service` (15), `test_sql_service` (12),
`test_explorer_agent` (6), `test_multimodal_query` (5), `test_111_1_reembed_kickoff` (4),
`test_sandbox_service` / `test_lifespan` / `test_db_runs` (3 each), and eight others with 1-2 each.
The failure mode is async-test rot (`TypeError: argument of type 'coroutine' is not iterable`,
`object MagicMock can't be used in 'await' expression`). The one adjacent-looking failure,
`test_forced_emit_judge_verdict_unmocked`, is an unmocked live-provider test last touched at plan
122-02. Round 5 committed zero non-comment backend lines, so it cannot have caused any of this —
but it also means a backend regression from this phase would have had to be caught by the four
targeted 187 suites (54 tests, all green) rather than by a suite-wide differential.

### Probe Execution

Not applicable. No `scripts/*/tests/probe-*.sh` exists in this repository and no PLAN in this
phase declares one — this project's equivalent instruments are `scripts/vitest-count-gate.cjs`
(run above, exit 0) and the in-plan RED-observation probes recorded in `187-VALIDATION.md`. The
count gate's *result* is green; its *coverage* is the finding.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| **VOCAB-01** | 187-02, 04, 08, 09, 10, 12, 15, 17, 18, 23, 24 | Plain-language node names/verbs + Technical-names reveal | ✓ SATISFIED in code (1 carried Warning, WR-08 → Phase 188); **REQUIREMENT STAYS `Pending`** | Truths 1, 2, 3, 10 |
| **VOCAB-02** | 187-01, 02, 03, 06, 07, 10, 11, 13, 15, 16, 20, 21, 22, 26, 27, 28, 29 | NL → safe seeded editable canvas draft; the AI seed structurally cannot emit an unsafe node | ✗ **BLOCKED** — truth 8 FAILED (CR-R5-01) and truth 14 FAILED | Truths 4, 5, 6, 7, 13 verified; truths 8, 14 failed |
| **VOCAB-03** | 187-05, 14, 15, 26, 29 | Start from a template / starter flow on the canvas | ✓ SATISFIED in code; **REQUIREMENT STAYS `Pending`** | Truth 9 (incl. a live operator pass) |

**No orphaned requirements.** `.planning/REQUIREMENTS.md` maps only VOCAB-01/02/03 to Phase 187,
and all three still read `Pending` (lines 42-44 unchecked, lines 115-117 `Pending`) — re-confirmed
by grep this session. **That is correct and must not change on this pass.** VOCAB-02 has a live
blocker; VOCAB-01 and VOCAB-03 are code-complete but their acceptance is partly lived-experience
(SC#5 / G-4) with rows still owed. No `gsd-sdk` completion verb was run.

### Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|---|---|---|---|---|
| `DescribeKbPicker.tsx` + `WorkflowDoorSwitch.tsx` + `workflows.py` | `:140`, `:149` / `:117-131` / `:755` | A control that can hold a binding it cannot display, whose parent outlives it, feeding a server rule that tests nullity rather than resolvability | 🛑 **BLOCKER (CR-R5-01)** | The new safety affordance can suppress the governance verdict it was built to help satisfy. Full derivation in Gaps. |
| `scripts/vitest-count-gate.cjs` | `:148`, `:153`, `:168-179` | Pins with slack in front of them, and a load-bearing suite outside `TARGETS` — round 3's WR-16 reintroduced in the commit citing WR-16's lesson | 🛑 **BLOCKER (WR-R5-01)** | GAP A's only end-to-end wire fence and the whole GAP-B/GAP-C behavioural estate are deletable at `failed 0`. A guard that exists is not a guard that bites. |
| `scripts/vitest-count-gate.cjs` | `:118-142` | The new pin comment attributes GAP A's born-bound round trip to `DescribeKbPicker.test.tsx`; that round trip is in `WorkflowDoorSwitch.test.tsx` (`:309-330`) | ⚠️ Warning (WR-R5-02) | A comment that misnames what a pin protects is the same defect class as WR-14 and D-187-11's own stale comment — twice corrected in this phase already. |
| `WorkflowDoorSwitch.tsx` | `:257` (+ `:82` docblock) | The picker mount is unconditional and the shell reads NO feature flag, so a `visual_workflow_canvas`-OFF user meets the picker **and a `listFolders()` network call the shell's own docblock says it never makes** ("The shell adds NO API call") | ⚠️ Warning (WR-R5-03 / D-ITEM-187-29-01) | **Assessed against D-181-01 as that decision is actually scoped: NOT a breach.** D-181-01's stated subject is the Builder page's first-screen byte-identity, and that measured CLEAN — `initialProjectFolderId` ABSENT leaves `:592` at today's value, and `revertByteIdentical.test.tsx` (7/7) + `WorkflowBuilderPage.header.test.tsx` (27/27) are green in my own gate run. The door is a different, upstream surface whose flag-blindness PREDATES round 5. **But the deferred item understates the delta:** round 5 added not just a visible control but a network request and a request field to a screen a flag-off user reaches, so the flag no longer reverts GAP A. Correctly logged as an undecided question rather than swept in; it needs a written decision, not a silent assumption. |
| `WorkflowDoorSwitch.tsx` | `:82-83` | Docblock claims "the 13 shipped assertions in `WorkflowDoorSwitch.test.tsx`"; the file now runs 21 | ⚠️ Warning | A stale count in a docblock — harmless today, and the same class this phase corrected twice elsewhere. |
| `WorkflowBuilderPage.tsx` | `:1372` vs `:1377` | GAP B's fence reaches the tray strip and the Publish control but NOT the node marks — `groups: verdictGroups` is not gated by `isCheckOutstanding`, so during `not-run` every node renders identically to "checked and clean" | ⚠️ Warning (WR-R5-04) | The canvas's most-looked-at surface still implies a clean check during the window GAP B exists to make honest. Nothing tests it. |
| `verdictModel.ts` | `:150` | `isCheckOutstanding` — the entire GAP-B predicate — has no direct unit test in the suite pinned for GAP B | ⚠️ Warning (WR-R5-05) | Covered transitively; a direct total test over `ValidationState["kind"]` is cheap and would pin the predicate itself. |
| `WorkflowBuilderPage.tsx` | validation lifecycle | `validation` is never reset when `definition` goes null, so a second definition within one mount could inherit the first's `ok:true` | ⚠️ Warning (WR-R5-06) | Not currently reachable — the reviewer could not construct a live path and neither could I. Recorded so the next lifecycle change re-checks it. |
| `.../187-VALIDATION.md` | frontmatter | `manual_rows_performed: 0` is FALSE at HEAD | ⚠️ Warning | Contradicted by `187-UAT.md`'s own board (6 passed / 1 blocked / 7 pending). See below. |
| `harness_engine.py` `:1065-1066`; `validator_kinds.py` `:714-744`; WR-10…WR-15, IN-01…IN-14 | — | Carried forward from rounds 1-3, unverified this round | ⚠️/ℹ️ carried | Outside round 5's diff. Treat as an upper bound — some may have been closed by round 4. |

**No debt markers** (`TBD` / `FIXME` / `XXX`) in any of the 16 files round 5 touched — swept
directly, zero hits.

### Manual verification: the real count

**The `187-VALIDATION.md` frontmatter says `manual_rows_performed: 0`. That is stale, and the
correction matters in the phase's favour.** `187-UAT.md` — a separate, live operator board —
records **6 passed, 1 blocked, 7 pending** out of its 14 rows:

| UAT row | Manual row | Result |
|---|---|---|
| 1 — starter template copy | M5 | **pass** — operator confirmed all 3 templates |
| 2 — every node face says what THAT step does | M1 | **pass** — real 4-step draft, four distinct business-language faces quoted |
| 3 — plain title survives the ⌥ reveal | M2 | **pass** — measured over 3 cycles, node x/y identical in all 7 states |
| 4 — card states no capability the step lacks | M11 | ⛔ **BLOCKED — not performable** (`folder_scope` is display-only in the Builder) |
| 5 — the ＋ row promises the sentence the card says | M12 | pending |
| 6 — face tracks a skill bind/unbind | M4 | pending |
| 7 — receipt arrives ONCE as one batch | M3 | **pass** — MutationObserver caught exactly one insertion at t=16.3 s, all 347 chars present, throttled to Slow 4G |
| 8 — the receipt's two paragraphs read as ONE account | M9 | **pass** — arithmetic verified against the single `search_documents` step |
| 9 — the receipt is a RECEIPT, not a live readout | M14 | **pass** — **CR-04 falsified live**, receipt byte-identical across two in-place edits |
| 10 — zero-detected draft arrives whole | M10 | pending |
| 11 — escalated-only draft agrees with itself | M13 | pending |
| 12 — env path reaches the authoring model resolver | M7 | pending |
| 13 — armed checkpoint cannot be preempted (SC#6 live) | M6 | pending |
| 14 — flag-OFF Builder first screen unchanged | M8 | pending |

The board's `source` line reads "M1-M14", so it predates round 5 — **M15 / M16 / M17, the three
rows added for GAP A and GAP B, are definitively unperformed**, and they are the rows that would
catch this report's blocker.

**Honest total: 6 of 17 manual rows performed and passed, 1 blocked as non-performable, 10
unperformed.** Two of the passes (rows 3 and 9) are unusually strong — they carry measurements,
not impressions. The frontmatter counter should be corrected to reflect the board; a phase that
under-reports its own real UAT is as much a record defect as one that over-reports it.

### Gaps Summary

Round 5 was three different qualities of work and the phase's standing depends on telling them
apart.

**GAP B (187-27) and GAP C (187-28) are good.** GAP B is a real fail-open — a surface claiming a
server check passed when none had been made — closed at the right seam, with the D-184-15
narrowing written down in the open, the D-181-01 half-line given its own falsification test, and
the predicate keyed on the loop's discriminant so a rename is a typecheck error. GAP C is
comment-only in production with both halves of the corrected claim pinned by behavioural fences,
and it deliberately does not quote the false sentence so the pin fencing its absence stays armed.
Both are verified here independently, not on the reviewer's word.

**GAP A (187-26) shipped a clean leaf with a defect at its seam.** The picker is well-built —
one api symbol, no store, four states held apart, totality on nameless folders, a state marker
that adds nothing to the accessibility tree. But it is the one piece of round 5 that adds a new
*input path to a request*, and it never reconciles the value it is handed against the folders it
actually fetched, while the parent deliberately makes that value outlive it. Because the server's
`unbound_retrieval` rule tests only `is None`, a stale id **silently satisfies the very gate GAP A
exists to help the author satisfy**. The `is None`-only test is pre-existing and is not round 5's;
what round 5 authored is the first surface that can produce a stale, invisible, non-null id. The
composition is newly reachable, it is unguarded by any test, and it moves a previously-VERIFIED
truth back to FAILED. That is the phase's blocker.

**187-29, the round's own honesty instrument, does not hold what it claims to hold.** Its three
new pins are exact. But GAP A's only end-to-end wire fence sits in +8 of slack, the entire
GAP-B/GAP-C behavioural estate sits in +106 of slack, and the suite round 5 extended with the
additive-prop pins is outside `TARGETS` entirely — so the gate never runs it and never pins it.
This is round 3's WR-16 reintroduced on three new suites, in the same commit whose header block
cites WR-16's lesson. The distinction the operator asked to be held is exactly the one that fails
here: **a guard that exists is not a guard that bites, and a pin never observed biting is a
gesture.** The fix is small and mechanical — raise two pins to their measured actuals, add one
file to `TARGETS`, correct one misattributing comment, and observe each one biting on a real
deletion.

**One planned artifact contract was not met literally, and reversing it would be wrong.** Plan
187-27 specified `contains: "unchecked"`; the member shipped as `not-run` because `"unchecked"` is
on the shipped graded-governance never-say list. Intent met, letter not met, deviation correct —
and plan 187-29 already recorded it as a deviation rather than folding it into a green tick, which
is the right disposition and is preserved here.

**On requirements:** VOCAB-01/02/03 stay `Pending`. VOCAB-02 has a live blocker. VOCAB-01 and
VOCAB-03 are code-complete and each carries a live operator pass, but their acceptance bar (SC#5,
G-4) is lived-experience by construction and ten manual rows are still owed — including all three
of round 5's own. Nothing here authorises a flip.

---

_Verified: 2026-08-04T04:10:00Z_
_Verifier: Claude (gsd-verifier) — every figure in this report was produced by a command run in
this session against HEAD, not transcribed from SUMMARY.md, PLAN.md or 187-REVIEW.md_
