---
phase: 187-business-vocabulary-ai-seeded-canvas
verified: 2026-08-02T03:25:40Z
status: gaps_found
score: 9/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A seeded draft with grounded steps shows a receipt naming exactly those steps, with reasons; a seeded draft with zero grounded steps shows no grounded-step list (SPEC Req 5 acceptance)"
    status: failed
    reason: "SeedReceipt.tsx includes ALL non-null groundingCauseOf results ('detected', 'already-set', 'escalated') under one lead sentence ('N steps read your documents, so I set them to must prove it') that is only true for 'detected'. LlmEmitPhaseConfig.citation_policy defaults to 'strict' (backend/app/models/harness.py:155) and POST /generate emits Pydantic defaults, so virtually every generated llm_emit phase resolves to 'already-set' and is counted — even when the step reads no documents. Both curated starter spines are llm_agent -> llm_emit (StarterTemplatePicker.tsx:50-53), so this fires on the typical draft, not an edge case. Confirmed live at HEAD by direct code read (not from REVIEW.md alone): SeedReceipt.tsx:173-186 `if (cause === null) continue`, definitionOps.ts:556-563 `seedReceiptGroundingLead` composes one sentence over the raw row count regardless of which cause populated it. This falsifies SC#3's legibility purpose for the surface built to discharge it — the receipt states a governance action the AI did not take."
    artifacts:
      - path: "frontend/src/components/workflows/SeedReceipt.tsx"
        issue: "rows built from `if (cause === null) continue` (line ~177) — keeps already-set/escalated causes under the detected-only lead sentence (CR-01, confirmed live)"
      - path: "frontend/src/components/workflows/definitionOps.ts"
        issue: "seedReceiptGroundingLead (line ~556) composes 'N steps read your documents, so I set them to must prove it' over the total row count irrespective of cause"
      - path: "frontend/src/components/workflows/SeedReceipt.test.tsx"
        issue: "llm_emit fixtures (lines 91, 107) use citation_policy: 'loose', which is NOT a member of the backend Literal['strict','flag','partial','draft'] (harness.py:155) — an unrepresentable state is what lets 'lists EXACTLY the steps that read the documents' and the zero-grounded case pass (CR-02, confirmed live)"
    missing:
      - "Restrict SeedReceipt's rows list to cause === 'detected' only, or compose a distinct sentence per cause instead of one sentence over the total (the review's proposed fix at REVIEW.md CR-01)"
      - "Fix SeedReceipt.test.tsx's llm_emit fixtures to citation_policy: 'strict' (the real, only-reachable default) and add a case pinning what the receipt says about an already-set step and an escalated step, so this regression class is observable going forward"
human_verification:
  - test: "M1 — every node face says what THIS step does (reads distinctly to a business user)"
    expected: "Generate a real 5-step workflow; every face is specific, none is a generic type sentence when a skill/template/folder is bound"
    why_human: "Judgement of prose quality, not a grep-able property (SPEC Req 1 / SC#5)"
  - test: "M2 — the plain title survives the ⌥ Technical-names reveal on both graph views without layout jump"
    expected: "Toggling ⌥ ON/OFF x3 on canvas and spine: title unchanged, no height jump, full slug visible with no ellipsis"
    why_human: "Perceptual layout stability cannot be asserted from jsdom (Req 4)"
  - test: "M3 — the seed receipt arrives once, its seal pulses once, and implies nothing is still deciding"
    expected: "Watch arrival on a throttled connection; single batch entrance, no staged/staggered reveal"
    why_human: "Temporal + perceptual behavior (Req 5) — NOTE: fix the CR-01 gap before running this, or the operator will be confirming a receipt that lies"
  - test: "M4 — the derived face tracks a skill bind/unbind live, without a save and without flicker"
    expected: "Bind a skill to a step, then unbind, watching the face update on the async name-map settle"
    why_human: "The mount-fetch settle (miss-on-first-paint, resolve-on-mount) is only observable live, not in a render test (Req 1 / Pitfall-1)"
  - test: "M5 — the seeded describe text reads like something a person typed"
    expected: "Pick each of the 3 starter templates; the filled describe box reads naturally"
    why_human: "Copy-quality judgement (Req 6)"
  - test: "M6 — SC#6 live: an armed checkpoint cannot be preempted by an author-declared pre-gate"
    expected: "Run an armed phase carrying a timing=\"pre\" ask_user validator. Answer the author's gate Proceed; confirm the ARMED checkpoint still appears in the chat PendingAskCard. Refuse it. Confirm the step did NOT run and harness_audit has ZERO validator_ask_user_approved rows for it."
    why_human: "Needs a live Redis rendezvous + a real browser answer; the property test proves the property in isolation but this is the end-to-end confirmation the SPEC's own acceptance criteria require"
  - test: "M7 — SC#10 live row: the HARNESS_AUTHORING_MODEL env path actually reaches resolve_authoring_model"
    expected: "Restart backend with HARNESS_AUTHORING_MODEL set; generate a workflow; confirm the model actually used matches the env var"
    why_human: "Requires a backend restart; the 8-row roster test proves the service function in isolation, not the env-to-running-process path"
  - test: "M8 — flag-OFF Builder first screen is byte-identical to today (whole-screen read)"
    expected: "Turn visual_workflow_canvas OFF; open the Builder's first screen; confirm no template line and nothing else changed"
    why_human: "An automated byte-pin (D-181-01, WorkflowBuilderPage.describe.test.tsx) covers the CTA flex column only; the manual row looks at the whole screen"
---

# Phase 187: Business Vocabulary + AI-Seeded Canvas Verification Report

**Phase Goal:** A business user sees plain-language node verbs and can describe a workflow in
natural language to get a safe, editable seeded canvas draft — the AI seed respects grounding mode
(a seeded grounded node auto-gets its citation/confidence gate — safe-by-construction).
**Requirements:** VOCAB-01, VOCAB-02, VOCAB-03 (+ SC#6 / SEED-137, folded 2026-07-31)
**Verified:** 2026-08-02T03:25:40Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VOCAB-01 (Req 1): `nodeTitle()` resolves 3 tiers (name → derived → type sentence), derived tier pure/unstored, never fabricates, totality holds | ✓ VERIFIED (1 Warning) | `phaseVocabulary.ts` `derivedFace()` implements bound-skill → template(llm_emit) → folder → human-input → null, most-specific-first (D-187-04). `phaseVocabulary.test.ts` + `phaseVocabulary.corpus.test.ts` green (1331/1331 across the 13-file isolated set). **Warning (REVIEW WR-02, confirmed live):** tier 3 (folder) is ungated by phase type — an `llm_single` step with a bound folder renders "Search {folder}" though `llm_single` cannot search (harness.py:74-75 says the field is inert there). A real but narrow fabrication-of-capability defect, not a fabrication-of-name defect. |
| 2 | VOCAB-01 (Req 3): identity-bearing config edit clears a **generator-seeded** name, leaves a **hand-typed** name untouched; pre-187 rows load with the marker absent; zero migration | ✓ VERIFIED | `definitionOps.test.ts` green; `git diff --stat -- supabase/migrations` empty (confirmed independently); `name_seeded_by_ai` is additive-optional JSONB, same shape as `grounding_escalated`. |
| 3 | VOCAB-01 (Req 4): ⌥ reveal swaps the canvas card's SUBTITLE not its TITLE; canvas and spine agree on **title** in both toggle states | ✓ VERIFIED (documented narrowing) | `PhaseNode.test.tsx` / `PhaseNodeCard.test.tsx` / `PhaseSpineGraph.test.tsx` green. D-187-16 narrows "both views agree" to the title only — `PhaseSpineGraph` has no subtitle slot and prints a raw `phase_type` chip unconditionally (pre-existing, not this phase's regression); this is stated in-source and in CONTEXT, not silently dropped. |
| 4 | VOCAB-02 (Req 2): NL generator writes a non-empty per-step `name` on every phase; provider-call budget unchanged (1 valid / 2 on retry / never 3) | ✓ VERIFIED (1 real cross-provider finding) | `test_187_authoring_step_names.py` green (in the 125/125 backend run). Live 8-provider roster (187-07): 5/8 rows fully pass. **OpenRouter is a genuine, non-deterministic VOCAB-02 finding** — one of two identical samples emitted a fully valid definition with 0/5 phases named. Mitigated by Req 1's derived-face ladder (an unnamed phase falls to its config-derived face rather than rendering blank), so the product degrades rather than breaks — but the instruction is not reliably honoured on the non-native tool path. Recorded ❌ with reason, not omitted (roster rule honored). OpenAI/MiniMax ❌ rows are registry/emission defects unrelated to naming (verified: OpenAI's `gpt-5.5` sibling passed 5/5 named same day). |
| 5 | VOCAB-02 (Req 5): a seeded draft with grounded steps shows a receipt naming **exactly** those steps with reasons, verbatim from the server derivation; zero grounded steps shows **no** grounded-step list | ✗ **FAILED — BLOCKER (CR-01/CR-02, confirmed live at HEAD)** | See Gaps below. `SeedReceipt.test.tsx` is green only because its fixtures use an unrepresentable `citation_policy` value; the real default fires the bug on nearly every generated draft with an `llm_emit` step. |
| 6 | VOCAB-02 (Req 7 / SC#6): an armed action-risk checkpoint is asked before the body runs regardless of author-declared validators; property test observed RED on HEAD before the fix and green after; a refusal writes ZERO approval receipts; `test_185_engine_attachment.py:153-165` stays green | ✓ VERIFIED (2 narrow Warnings) | `test_187_armed_checkpoint_property.py` — RED-before signature recorded (187-01 T3), green after hoist (187-11), falsification re-observed (187-11 T3). Independently re-ran the full 187-owned backend set: **125/125 passed**, including `test_185_engine_attachment.py:153-165`'s `validators[0].max_retries == 7` assertion (confirmed by direct read, still present and green). **Warnings (not blockers, per review + my own read):** WR-01 — a `redis is None` no-transport fail-safe re-introduces author-routing on an armed checkpoint (narrow, no production caller passes `redis=None`, not exercised by the property test's own space). WR-05 — the now-vestigial `action_risk_approval` validator kind still offers the armed *choices* with un-armed *semantics* if ever author-reachable; fenced today by `publish_service.py:464-503` refusing author-declared `ask_user` validators, but that fence is named in-source as slated for removal by the deferred Phase-103 background-job publish — a live landmine for a future phase, not this one. |
| 7 | D-187-11 (folded `BUG-260731-03` verdict half): an unbound retrieval workflow earns a deterministic `incomplete` verdict from `/validate` before a golden run is spent | ✓ VERIFIED | `test_182_validate.py` + `test_182_severity_codes.py` green (in the 125/125 run). `unbound_retrieval` confirmed canvas-only, registered in both `_ROUTE_ASSIGNED_CODES` and `_INCOMPLETE_CODES` (REVIEW summary, independently spot-checked). `BUG-260731-03` frontmatter still reads `status: folded` — correctly NOT flipped to closed, since the re-open trigger requires BOTH halves (186's re-bind + 187's verdict) verified together; this is a bookkeeping item for the bug tracker, not a code gap. |
| 8 | VOCAB-03 (Req 6): choosing a template fills the describe box and leaves the user on the describe screen with the CTA enabled; no first-screen path places a definition on the canvas without generation; the flag-OFF describe screen is byte-identical (D-181-01) | ✓ VERIFIED | `StarterTemplatePicker.test.tsx` green (40 tests). REVIEW confirms `StarterTemplatePicker`'s only `@/lib/api` import is `listStarterWorkflows` — no create/update/publish/generate/validate symbol reachable. `WorkflowBuilderPage.describe.test.tsx` (D-181-01 byte pin, captured against the unmodified page) still green. |
| 9 | SC#5 check 1 (no jargon leak) and check 2 (no two materially-different steps share a face), over the named corpus (3 starters + 4 canonical seeds + PM pack) | ✓ VERIFIED (documented narrowing, D-187-15) | `phaseVocabulary.corpus.test.ts` green as a pure-function sweep (not a DOM scrape — correctly avoids the spine's pre-existing raw `phase_type` chip). Check 2 is narrowed to "materially different config" with `plan_execute_verify`'s two identical-config `llm_single` steps recorded as the documented, measured exception rather than edited away. |
| 10 | SC#10: roster driven honestly, blocked/failed rows recorded with reasons, never silently omitted | ✓ VERIFIED (method superseded, honestly recorded) | The SPEC's assumption that `harness_authoring_model` is a driveable app setting is refuted (it is env-only) — 187-07/CONTEXT (D-187-13) supersedes this with an equivalent-strength method: 8/8 real `forced_emit` calls, one stub `settings` per row (no global mutation, independently verifiable since `generate_workflow_definition` takes `settings` as a parameter). All 8 rows executed; 0 blocked; 3 red rows recorded with reasons (not omitted) — see truth #4 for the naming-relevant one. |
| 11 | Zero migrations added by this phase | ✓ VERIFIED | `git diff --stat 35261e96 HEAD -- supabase/migrations` and `git status --porcelain supabase/migrations` both empty (re-confirmed independently). `git diff --name-only 3bf72490 HEAD -- backend/app frontend/src` touches only the files already reviewed; no `supabase/migrations/` entries anywhere in the phase's diff range. |

**Score:** 9/11 truths verified (1 hard FAILED/BLOCKER, all others pass with named, non-blocking Warnings carried forward as findings).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/workflows/phaseVocabulary.ts` (`derivedFace`, `nodeTitle`, `groundingCauseOf`) | 3-tier resolution, ONE vocabulary module | ✓ VERIFIED | Present, wired into both graph views, `?raw` source guards green |
| `backend/app/services/workflow_authoring.py` (`AUTHORING_SYSTEM_PROMPT`) | per-step `name` instruction | ✓ VERIFIED | Confirmed in `test_187_authoring_step_names.py` (green) and the 8-row live roster |
| `backend/app/models/harness.py` (`PhaseSpec.name_seeded_by_ai`) | additive-optional JSONB provenance marker | ✓ VERIFIED | `test_harness_models.py` green; zero-migration confirmed |
| `backend/app/services/harness_engine.py` (hoisted armed checkpoint) | armed ⇒ asked as a property, not a position | ✓ VERIFIED | `test_187_armed_checkpoint_property.py` + `test_185_engine_attachment.py` green; 2 narrow Warnings (WR-01, WR-05) noted above |
| `frontend/src/components/workflows/SeedReceipt.tsx` | post-draft grounding receipt | ✗ **STUB-EQUIVALENT (CR-01)** | Component renders and is wired, but its core claim ("N steps read your documents, so I set them...") is FALSE on the typical generated draft — exists + wired + tested green, but the behavior is wrong and the test cannot see it (CR-02) |
| `frontend/src/components/workflows/StarterTemplatePicker.tsx` | template door on the Builder's first screen | ✓ VERIFIED | Wired, gated on `canvasEnabled`, no forward seam to canvas (REVIEW confirmed, no create/publish/generate symbol reachable) |
| `backend/app/api/workflows.py` (`/validate` `unbound_retrieval` check) | deterministic `incomplete` verdict | ✓ VERIFIED | Registered in `_ROUTE_ASSIGNED_CODES` + `_INCOMPLETE_CODES`; canvas-only, no publish-path leak |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `WorkflowBuilderPage.tsx` | `SeedReceipt` | one gated mount line, `nameContext`/`kbTools` props | WIRED | Confirmed by `WorkflowBuilderPage.canvas.test.tsx` (green) and the D-187-14 diff-cap gate (46 ins / 5 del, at the cap) |
| `WorkflowBuilderPage.tsx` | `StarterTemplatePicker` | one gated mount line, `initialDescribe` seam | WIRED | Reuses the shipped Phase-124 seam; no new channel |
| `SeedReceipt` | `groundingCauseOf` (`phaseVocabulary.ts`) | direct import, "the one client grounding derivation" | WIRED but MISUSED | The link is real and the derivation itself is correct; the DEFECT is in how `SeedReceipt` filters/interprets the derivation's output (CR-01) — a wiring success that still produces a wrong result |
| `harness_engine.py` pre-gate block | the hoisted armed checkpoint | `is_action_risk` as an explicit parameter | WIRED | REVIEW confirmed `is_action_risk` is never a `phase` read inside the shared `_resolve_failure_with_ask_user` helper — the exact hazard CONTEXT's corrections section called out is closed |
| `grounding.py` `effective_phase` | armed `ValidatorSpec` append | REMOVED (D-187-03) | WIRED (removal verified) | `_is_action_risk_finding` string-prefix sniff fully deleted, no stale references (REVIEW confirmed) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| VOCAB-01 | 187-02, 04, 08, 09, 10, 12, 15 | Plain-language node verbs + Technical-names reveal | ✓ SATISFIED (1 Warning: WR-02 folder-tier over-claim) | Truths #1–3, #9 |
| VOCAB-02 | 187-01, 02, 03, 06, 07, 10, 11, 13, 15 | NL → safe seeded editable canvas draft, AI seed structurally safe | ✗ **BLOCKED on Req 5** (seed receipt) | Truth #5 FAILED; truths #4, #6, #7, #10 verified |
| VOCAB-03 | 187-05, 14, 15 | Start from a template/starter on the canvas | ✓ SATISFIED | Truth #8 |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only VOCAB-01/02/03 to Phase 187, and all three are declared across the 15 plans' `requirements:` frontmatter. `REQUIREMENTS.md`'s status column still reads "Pending" for all three — correct, since that flip is this verification's own downstream action, not something to expect pre-verification.

### SPEC Success-Criteria Judgement

- **SC#3 (safe-by-construction / legibility) — NOT achieved.** The server-side enforcement (`citations_required` at `grounding.py:940`, unconditional at the run seam) is real and independently verified — a grounded step cannot skip its gate. But the SPEC's own stated purpose for this phase's receipt is to make that safety **legible**, and CR-01 makes the receipt say something false about *why* a step is gated on the majority of generated drafts. A surface that misexplains governance is arguably worse for trust than a surface with no explanation, because it teaches the user a wrong mental model of what the AI did. This is the single reason this phase does not pass.
- **SC#5 (no jargon leak / no over-simplification)** — met, with the honest, measured narrowing (D-187-15/16) recorded in-source rather than hidden.
- **SC#6 (armed checkpoint always asked)** — met on the property + the regression suite. The live end-to-end confirmation (M6) is still owed to the operator (see Human Verification below); two narrow, non-blocking Warnings (WR-01, WR-05) are carried forward as findings for a future phase, not blockers to this one.
- **SC#10 (cross-provider roster)** — met as an honest scoreboard; the one real naming defect it surfaced (OpenRouter) is a provider-emission finding, not an implementation gap, and Req 1's derived-face ladder is the documented graceful degradation for it.

### Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|---|---|---|---|---|
| `frontend/src/components/workflows/SeedReceipt.tsx` | ~173-186 | Over-inclusive filter feeding an under-qualified sentence | 🛑 Blocker (CR-01) | False governance claim on the majority of generated drafts |
| `frontend/src/components/workflows/SeedReceipt.test.tsx` | 91, 107 | Test fixture uses a value the backend model cannot produce | 🛑 Blocker (CR-02) | The regression suite cannot detect CR-01; green is not evidence |
| `frontend/src/components/workflows/phaseVocabulary.ts` | ~466 | Ungated capability claim (tier 3 folder search on non-retrieval types) | ⚠️ Warning (WR-02) | "Search {folder}" rendered on a step type that cannot search |
| `frontend/src/components/workflows/StepTypePicker.tsx` | ~156 | Reads `PHASE_TYPE_SENTENCES` directly instead of through `nodeTitle` | ⚠️ Warning (WR-03) | Picker row promises "Check with you"; the card that lands says "Wait for your approval" — one click, two sentences |
| `backend/app/services/harness_engine.py` | 1065-1066 | No-transport fail-safe re-reads author disposition on an armed phase | ⚠️ Warning (WR-01) | Narrow (`redis is None`), not production-reachable today |
| `backend/app/services/harness/validator_kinds.py` | 714-744 | Vestigial validator kind offers armed choices with un-armed semantics | ⚠️ Warning (WR-05) | Fenced today by publish; landmine for the deferred Phase-103 rework |
| `backend/app/models/harness.py` / `frontend/definitionOps.ts` | 262 / 263-289 | `name_seeded_by_ai` is client-writable on non-generate write paths | ⚠️ Warning (WR-06) | A hand-typed name falsely marked seeded can be silently deleted later |
| `backend/app/services/harness_engine.py` | 766 | Dead-in-production fallback composes a false step-position sentence | ⚠️ Warning (WR-07) | Governance-prompt honesty risk if a second call site is ever added |
| 5 Info-level items | various | Stale docblocks, minor a11y/state-purity nits | ℹ️ Info | See `187-REVIEW.md` IN-01..IN-05 |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file touched by this phase (`git diff --name-only 3bf72490 HEAD` swept clean).

### Behavioral Spot-Checks / Test Evidence (re-run independently, not transcribed)

| Check | Command | Result |
|---|---|---|
| Phase-owned backend suite | `pytest tests/unit/test_187_armed_checkpoint_property.py tests/unit/test_187_authoring_step_names.py tests/unit/test_182_validate.py tests/unit/test_182_severity_codes.py tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py tests/unit/test_harness_models.py tests/unit/test_pre_post_timing.py -q` | **125 passed, 0 failed** |
| Frontend 13-file vocabulary/canvas/receipt/door set | `npx vitest run` (phaseVocabulary·corpus, canvasModel×4, PhaseSpine×2, PhaseNodeCard, PhaseNode, SeedReceipt, StarterTemplatePicker, definitionOps) | **1331 passed, 0 failed** |
| Frontend consumer + WorkflowBuilderPage set | `npx vitest run` (WorkflowCanvas, PublishGauntlet, ProblemsTray, WorkflowBuilderPage.canvas/describe/header/page/session) | **286 passed, 0 failed** |
| Zero-migration gate | `git diff --stat 35261e96 HEAD -- supabase/migrations` + `git status --porcelain supabase/migrations` | both **empty** |
| Debt-marker sweep | `TBD\|FIXME\|XXX` over every file in `git diff --name-only 3bf72490 HEAD` | **zero matches** |
| CR-01 live confirmation | Direct read of `SeedReceipt.tsx:173-186`, `definitionOps.ts:556-563`, `harness.py:155` | **Confirmed unfixed at HEAD** — no commit after the `20ae79b6` review touches these files |
| CR-02 live confirmation | `grep -n 'citation_policy: "loose"' SeedReceipt.test.tsx` | **2 matches (lines 91, 107)** — confirmed unfixed |

Backend full-suite 211 failures and the 62-failure `tests/unit` baseline are pre-existing rot per the measured baseline provided to this verification — not attributed to this phase (this phase committed zero backend files outside the ones listed above, confirmed by `git diff --name-only`).

### Human Verification Required

**G-4 lived-experience gate.** Per CLAUDE.md, wire format + a screenshot are insufficient for phases touching live UI; these are the operator's, driven by Chrome MCP, not attempted here. All 8 rows (`187-VALIDATION.md` M1-M8) are recorded as **unperformed** at the close of the phase and remain so. Full detail in the frontmatter `human_verification` block above; summarized:

1. **M1** — every node face reads as business-specific to a human (Req 1/SC#5)
2. **M2** — the plain title survives the ⌥ reveal without layout jump, both views (Req 4)
3. **M3** — the receipt arrives once with one seal pulse — **recommend deferring this row until CR-01 is fixed**, otherwise the operator is confirming presentation of a false claim
4. **M4** — the derived face tracks a live skill bind/unbind without flicker (Req 1, Pitfall-1)
5. **M5** — the seeded describe text reads naturally, all 3 templates (Req 6)
6. **M6** — SC#6 live: an armed checkpoint survives an author Proceed and is actually asked; a refusal writes zero approval receipts
7. **M7** — SC#10 live: `HARNESS_AUTHORING_MODEL` env path reaches `resolve_authoring_model` after a backend restart
8. **M8** — flag-OFF Builder first screen is byte-identical to today, whole-screen read

### Deferred Items (by name, with re-open trigger — not gaps)

These were explicitly deferred during discuss-phase/research, each with a concrete trigger, and are **not** counted against this verification:

- `definitionOps.canRemovePhase`'s refusal notice stays on the undecorated `nodeTitle()` call (not threaded with `nameContext`) — **re-open trigger: Phase 188's `WorkflowCanvas.tsx` extraction** (asserted in-source at `WorkflowBuilderPage.canvas.test.tsx`, verified unmoved).
- The armed-phase / synchronous-publish hole (D-187-12: `_interactive_phase_failures` reads the raw definition, so an armed phase's checkpoint could fire inside a golden run with no subscriber) — **re-open trigger:** the deferred Phase-103 background-job publish rework, or the first live wedge.
- Making `harness_authoring_model` a real dynamic setting (Settings UI + `app_settings` row) — **re-open trigger:** `BUG-260731-01`'s investigation or SEED-117 revival.
- Per-node review state (✦/✓), filling `technicalLine`, a direct template→canvas fork — all excluded by SPEC with named re-open triggers (Phase 188 in each case), unchanged.
- `tsc -b`'s 33 pre-existing errors (`deferred-items.md` D-ITEM-01) — zero delta from this phase, zero inside `components/workflows` or `WorkflowBuilderPage*`, confirmed identical before/after.

### Gaps Summary

One BLOCKER: the seed receipt (VOCAB-02 Req 5) — the surface this phase built specifically to make Phase 185's grounding enforcement legible — states a false governance claim on the majority of generated drafts, because it treats the author's own default `citation_policy` and a hand-escalated dial as if the AI's seed had applied them. The regression suite that should catch this is itself broken in a way that hides the bug (its `llm_emit` fixtures use a `citation_policy` value the backend cannot produce). Both defects were independently confirmed live against HEAD, not taken on the strength of `187-REVIEW.md` alone. Everything else — the layered node-face ladder, the generator-authored names, the demote-on-edit rule, the subtitle-only reveal, the hoisted armed checkpoint (SC#6), the unbound-retrieval verdict, the template door (VOCAB-03), and the SC#5/SC#10 measurement discipline — is real, wired, and independently re-verified as green. The fix is narrow and already specified in the review (restrict `SeedReceipt`'s row filter to `cause === "detected"`, and repair the two test fixtures) — this is a closure-plan-sized gap, not a re-plan of the phase.

---

*Verified: 2026-08-02T03:25:40Z*
*Verifier: Claude (gsd-verifier)*
