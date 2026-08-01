---
phase: 186-concurrency-autosave
verified: 2026-08-01T21:15:00Z
status: human_needed
score: 8/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/9
  gaps_closed:
    - "CR-03 (BLOCKER) — the flag-off publish refusal is now reachable. Re-derived from source in this session: `WorkflowBuilderPage.tsx:1093-1094` — `blockedReason`'s FIRST statement is now `if (persistState.kind === \"saving\") return SAVING_PUBLISH_WAIT`, one line ABOVE the `!canvasEnabled || builderPhase !== \"drafted\"` short-circuit (now `:1094`). Traced the consumer chain independently: `actionGroup` (`WorkflowBuilderPage.tsx:1722-1742`) mounts `renderPublish(definition, draftId, blockedReason, …)` unconditionally and is rendered by BOTH header branches (`:1763` BuilderHeaderBar `actions` prop, `:1768` the plain flag-off header div) — so the fix is reachable on the exact surface CR-03 named. `PublishGauntlet.tsx` correctly consumes whatever `blockedReason` is fed (unchanged, confirmed already-sound in the prior report). Ran the new RED-then-GREEN test independently: `WorkflowBuilderPage.canvas.test.tsx` line 1903 'a CHOSEN save on the flag-OFF surface blocks publish too (CR-03)' exists and is green in a fresh run in this session (170/170 across the 3-suite set, see spot-checks)."
    - "WR-13 — `overwrite()` clears `heldPendingRef.current = false` at `useDraftPersistence.ts:1072`, above `await performWrite()` — re-derived directly from source in this session, matching the SUMMARY/REVIEW claim exactly."
  gaps_remaining: []
  new_findings:
    - "WR-19 (Warning, found by 186-REVIEW.md's gap-closure pass, not yet recorded as a formal deferral) — the WR-12 fix's replacement sentence only fires when the pre-hold reading was `idle` (`useDraftPersistence.ts:908` `s.kind === \"idle\" ? {kind:\"held\", sentence: HOLD_ENDED_UNSAVED} : s`). A `saved`-then-edited author (Save pressed, then edited, then a publish holds and ends) still lands in silence — the verbatim WR-12 symptom, reachable through a sibling prior state the fix's predicate does not cover. Re-derived from source at the cited line; the code exactly matches the review's quoted snippet. Not a CONCUR-01/02 safety defect — it is an honesty gap in an edge-case sequence of the hold-release UI, the same class as the already-deferred WR-14..18, and does not affect whether writes are safe or reachable."
    - "WR-20 (Warning, same review pass) — a `held` reading is never refreshed when a second hold begins immediately after the first (the release effect's `if (previous === null || holdReason !== null) return` skips every non-null → non-null transition and every null → non-null transition after the mirror update). Re-derived from source at `useDraftPersistence.ts:889-891`; matches the review's cited lines and logic. Same class as WR-19: a stale sentence problem, not a write-safety problem — the server-side token guard and the halt-and-offer-exits mechanism (truth 7) are untouched."
  regressions: []
gaps: []
deferred:
  - truth: "WR-19 / WR-20 — full honesty of the hold-release sentence across every prior-state and re-hold sequence"
    addressed_in: "not yet scheduled — recommend adding to deferred-items.md in the next phase-186 touch, or folding into whichever phase next touches useDraftPersistence.ts's hold-release effect"
    evidence: "186-REVIEW.md (gap-closure pass, 2026-08-01T20:45:00Z) — Warnings WR-19 and WR-20, both re-derived independently in this session against the live tree and confirmed accurate. Same non-blocking class as the five already-recorded deferrals (WR-14..WR-18) in deferred-items.md; recommend giving these two the same treatment (a `##` entry with a re-open trigger) before the next verification pass, so they are consciously deferred rather than merely unmentioned."
human_verification:
  - test: "Two tabs — same draft open in A and B; edit in A (let it autosave), then edit in B"
    expected: "B shows the honest banner, stops writing, offers Reload (default) then Overwrite. A's content intact."
    why_human: "SC#4 / SC#10 parallel axis. G-4 mandates live Chrome-driven UAT. `186-VALIDATION.md` row 1 status is still `to run` — unchanged since the prior verification."
  - test: "Stale tab — leave B open, edit + save in A, return to B minutes later and type"
    expected: "Same honest outcome. No silent overwrite, no retry storm."
    why_human: "`186-VALIDATION.md` row 2 is still `to run`."
  - test: "Publish race — start a publish in A, edit in B mid-gauntlet"
    expected: "Publish refuses with the worded `draft_changed` verdict; the golden-run receipt still browsable; the spine shows a block, not 8 green pips."
    why_human: "`186-VALIDATION.md` row 3 is still `to run`."
  - test: "Publish hold, both halves of the flag — start a publish in A, then edit in A; repeat once with `visual_workflow_canvas` ON and once OFF"
    expected: "Flag ON: 'Publishing — changes will save when it finishes', edit flushes on resolution. Flag OFF: the manual sentence is on screen while the gauntlet runs and is GONE from the header once it ends, without ever having written anything."
    why_human: "`186-VALIDATION.md` row 3b is still `to run`. Also the live observation point for WR-19/WR-20's residual honesty gaps."
  - test: "Conflict-exit failure — reach the conflict banner (row 1), then go offline and press Reload"
    expected: "The banner stays on screen with BOTH exits present and pressable, plus the extra line 'We couldn't reach the server to reload...'. Restoring the network and pressing Reload again succeeds and clears the banner."
    why_human: "`186-VALIDATION.md` row 7 is still `to run`. Live confirmation of GAP-4/CR-02, which this session re-confirmed at the source level (unchanged from the prior verification's re-derivation)."
  - test: "KB re-bind, three paths — bind/re-bind from NL-generated, forked starter, and Tweak fork"
    expected: "The chip is a picker in all three; unbound reads the invitation sentence with no severity/code/tray row; binding persists through autosave and survives reload."
    why_human: "`186-VALIDATION.md` row 5 is still `to run`; BUG-260731-03's frontmatter requires live confirmation before closing the control half."
  - test: "Force a 422 mid-edit (invalid shape) and observe the save state"
    expected: "'Not saved — ...'; the draft stays dirty; the leave guard fires on navigate-away."
    why_human: "`186-VALIDATION.md` row 6 is still `to run`."
  - test: "Chosen save then publish, flag OFF — with `visual_workflow_canvas` off, edit, press Save draft, then within that round trip open Publish and click the inner Publish button"
    expected: "Both the outer trigger and the inner Publish button are disabled and show 'Saving your last change — Publish will be ready in a moment' while the PATCH is outstanding. No golden run spent. Both controls re-enable the instant the save lands."
    why_human: "`186-VALIDATION.md` row 8 (added by 186-18) is still `to run`. This is the live confirmation of CR-03's fix — unit-level closure is confirmed in this session, but G-4 makes live Chrome-driven observation the acceptance bar, not a unit test."
---

# Phase 186: Concurrency & Autosave — Verification Report (RE-VERIFICATION, gap-closure round: 186-18/19/20)

**Phase Goal:** Continuous canvas autosave is safe on org-shared workflows — a cosmetic drag never mints a definition version or re-arms the golden-run gauntlet, and two editors cannot silently clobber each other. Closed before real usage, not discovered live.
**Verified:** 2026-08-01T21:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after the gap-closure round (plans 186-18, 186-19, 186-20), following the 2026-08-01T18:30:00Z re-verification that found blocker CR-03 (score 7/9)

Every claim below marked "re-derived" or "independently confirmed" was established by reading
the named source lines and/or running the named command in THIS session — not accepted from any
SUMMARY.md or REVIEW.md. `186-REVIEW.md` (the gap-closure pass) was read as INPUT; its findings
(CR-03/WR-12/WR-13 closure, and new Warnings WR-19/WR-20) were independently re-derived from
source and, for the test claims, re-run live rather than trusted.

## Gap-Closure Ledger (traceability preserved across all rounds)

| Id | Original finding | Resolution | Evidence re-derived this session |
|----|------------------|------------|----------------------------------|
| **GAP-1 / CR-01** | mid-flight edit silently dropped; false `Saved ✓` filed | ✅ **CLOSED** | Carried forward, unaffected by this round. |
| **GAP-2 / WR-01** | `overwrite`/`reload` bypass single flight | ✅ **CLOSED** | Carried forward, unaffected. |
| **GAP-3 / WR-03** | hold-release wrote with the canvas flag off | ✅ **CLOSED** | Carried forward, unaffected. |
| **GAP-4 / CR-02** | a failed `reload()` strands the draft permanently | ✅ **CLOSED** | Carried forward; not touched by 186-18/19/20 (confirmed by `git diff --stat` on the reload catch region — 186-19 only touched the hold-release effect and `overwrite()`). |
| **CR-03** | publish guard dead code on the flag-off Builder | ✅ **CLOSED — verified this session** | Re-derived from `WorkflowBuilderPage.tsx:1093-1094`: `saving` check now precedes the flag/phase gate. Wiring traced independently to `actionGroup` (`:1722-1742`, mounted on both header branches at `:1763`/`:1768`). New test (`WorkflowBuilderPage.canvas.test.tsx:1903`) exists and passed in a live re-run this session (170/170 across the 3-suite set). |
| **WR-12** | flag-off hold release resolves to silence | ⚠️ **CLOSED for `idle`, new sibling gap WR-19 for `saved`** | Re-derived from `useDraftPersistence.ts:892-910`: the `!enabled` branch now reads `dirty` once and sets `{kind:"held", sentence: HOLD_ENDED_UNSAVED}` when true — but the predicate `s.kind === "idle"` (line 908) leaves a `saved`-then-edited author in the same silence. See WR-19. |
| **WR-13** | `heldPendingRef` survives a halt, flushes a no-op PATCH later | ✅ **CLOSED — verified this session** | Re-derived from `useDraftPersistence.ts:1072`: `overwrite()` now clears `heldPendingRef.current = false` above `await performWrite()`, restoring the symmetry `reload()`'s success path already had (`:1012`). |
| **WR-14** | wait reason outranks fixable ones; disables a free click | ➖ **DEFERRED (recorded)** | `deferred-items.md` §WR-14, with re-open trigger. Widened (not newly caused) by the CR-03 fix — the entry states this explicitly. Not a phase-goal blocker: it is a UX-friction cost of the correct safety fix, not a safety gap. |
| **WR-15** | `saving` block has no ceiling | ➖ **DEFERRED (recorded)** | `deferred-items.md` §WR-15, with re-open trigger. Unreachable today per IN-01 (confirmed unchanged this session). |
| **WR-16** | `reload()`'s catch spans more than the request | ➖ **DEFERRED (recorded)** | `deferred-items.md` §WR-16, with re-open trigger, explicitly grouped with WR-17 (one function, one future plan). |
| **WR-17** | a second Reload shows the first failure's note | ➖ **DEFERRED (recorded)** | `deferred-items.md` §WR-17, re-opens together with WR-16. |
| **WR-18** | `overwrite()` degrades to an unguarded write on a `null` token | ➖ **DEFERRED (recorded)** | `deferred-items.md` §WR-18, with re-open trigger and an explicit statement of the residual exposure (optimistic guard only, not authorization). |
| **WR-19 (new)** | `saved`-then-edited author gets no replacement sentence on hold-release (WR-12's uncovered sibling) | ⚠️ **OPEN, Warning — not yet formally deferred** | Found by `186-REVIEW.md`'s gap-closure pass; re-derived independently against source in this session (`useDraftPersistence.ts:908`). Recommend adding a `deferred-items.md` entry with a re-open trigger, matching the treatment WR-14..18 received. |
| **WR-20 (new)** | a `held` reading is never refreshed on a second/overlapping hold cycle | ⚠️ **OPEN, Warning — not yet formally deferred** | Found by the same review pass; re-derived independently against source (`useDraftPersistence.ts:889-891`). Same recommendation as WR-19. |

## Goal Achievement

### Observable Truths

| # | Truth (source) | Status | Evidence |
|---|----------------|--------|----------|
| 1 | **SC#1 / CONCUR-01** — editing a draft autosaves by UPDATING THE DRAFT ROW IN PLACE; a cosmetic node drag never mints a version or re-arms the gauntlet | ✓ VERIFIED | Unaffected by this round (no file 186-18/19/20 touched overlaps `update_workflow_definition`'s SET clause or `canvasNudge.ts`). Backend evidence re-run live this session: `test_186_concurrent_patch.py` 21/21 (see spot-checks). |
| 2 | **SC#2 server half / CONCUR-02** — a stale writer is refused with a machine-readable code, never a false 404, owner scope never replaced | ✓ VERIFIED | Unaffected; re-run live this session (backend suite, 21/21). |
| 3 | **SC#3** — publish is guarded against reading a dirty draft (server side); the golden-run receipt survives the refusal | ✓ VERIFIED | Unaffected; stage-0/stage-5 token guard in `publish_service.py` untouched by this round. This remains the safety backstop even while CR-03 was open, and is now reinforced by the closed pre-flight refusal (truth 8). |
| 4 | **GAP-1 / D-186-04** — never a false `Saved ✓` | ✓ VERIFIED | Carried forward, unaffected. |
| 5 | **GAP-2 / 186-06 must_have** — at most ONE PATCH outstanding per draft at any instant | ✓ VERIFIED | Carried forward, unaffected. |
| 6 | **GAP-3 / D-181-01** — with `visual_workflow_canvas` OFF, no AUTOMATIC write behaviour is reachable | ✓ VERIFIED | Strengthened by this round: 186-19's WR-12/WR-13 fixes touch only the SENTENCE shown and a ref clear, never an added write; `heldPendingRef.current = false` in `overwrite()` sits ABOVE `performWrite()` and doesn't add a call. Re-confirmed: `!enabled` branch still `return`s above any write in the flag-off hold-release path (`useDraftPersistence.ts:892-910`). |
| 7 | **D-186-08 / 186-12 must_have** — on conflict the loop halts and THE PERSON PICKS THE EXIT; both exits stay offered, no control is a silent no-op, including on a failed exit attempt | ✓ VERIFIED | Unaffected by this round (GAP-4/CR-02 closure carried forward; 186-19 touched a different function). |
| 8 | **CONCUR-02 / WR-10 — publish is refused while THIS client's autosave write is outstanding, on every surface that write is reachable from** | ✓ **VERIFIED (was FAILED as CR-03)** | Re-derived from source this session: `blockedReason`'s FIRST statement is the `saving` check (`WorkflowBuilderPage.tsx:1093-1094`), above the flag/phase gate. Traced independently: `actionGroup` mounts `renderPublish(definition, draftId, blockedReason, …)` unconditionally at `:1741-1742` and is rendered by BOTH header branches (`:1763`, `:1768`). New test exists and passed live in this session. |
| 9 | **SC#4** — the two-editor / parallel path is exercised in live UAT; a second editor gets an honest read-only banner or merge-safe outcome, never a silent overwrite | ? **UNCERTAIN — human required** | `186-VALIDATION.md` re-read in full this session: ALL 8 rows (1, 2, 3, 3b, 5, 6, 7, and the new row 8 for CR-03) are still `to run`. Row 4 (literal colleague clobber) remains correctly ⛔ BLOCKED-not-reachable. No operator session has occurred since the prior verification. |

**Score:** 8/9 truths verified · 0 FAILED · 1 UNCERTAIN (human, unchanged in count, content updated with row 8)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/db/workflows.py` | `CONCURRENCY_TOKEN_SQL`, guarded UPDATE, owner-scoped probe, `-1`/`-2` pair | ✓ VERIFIED | Unaffected by this round. |
| `backend/app/api/workflows.py` — `update_draft` | optional `If-Match`, three-way refusal, code-less 404 | ✓ VERIFIED | Unaffected. |
| `backend/app/services/harness/publish_service.py` | stage-0 capture → stage-5 guarded flip → `draft_changed` block | ✓ VERIFIED | Unaffected — safety backstop intact. |
| `frontend/src/hooks/useDraftPersistence.ts` | the whole write seam: single flight, honest receipts, honest refusals, `enabled` gate, durable conflict exits | ✓ VERIFIED (2 open warnings, WR-19/WR-20) | Re-read the touched regions in full this session. WR-13 genuinely closed (`:1072`). WR-12's fix is real but its predicate is narrower than its own docblock's claim (WR-19); the hold-release refresh gap (WR-20) is real. Neither is a write-safety defect — both are sentence-honesty gaps in edge sequences. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` — `blockedReason` memo | names every reason Publish should refuse, on every surface the write is reachable from | ✓ **VERIFIED — no longer a stub on the flag-off branch** | `:1093-1094` re-derived this session: `saving` is the memo's first statement now, unconditionally reachable regardless of `canvasEnabled`. |
| `frontend/src/components/workflows/PublishGauntlet.tsx` (+ test) | a spine naming every server stage; fail-open closed; gated on an outstanding write | ✓ VERIFIED | Consumption of `blockedReason` was always sound; the fix upstream makes the input correct on both branches now. |
| `.planning/phases/186-concurrency-autosave/deferred-items.md` | every conscious trade-off, each with a re-open trigger | ✓ VERIFIED, with a gap: WR-19/WR-20 not yet added | Re-read in full. WR-14..18 all present with re-open triggers. WR-19/WR-20 (found by the review AFTER this file was last written) are not yet entries — recommend adding before the next verification pass. |
| `.planning/phases/186-concurrency-autosave/186-VALIDATION.md` | operator sign-off on the manual rows | ✗ **NOT RUN** | Re-read in full this session — all 8 rows (including new row 8) are `to run`. Approval line still reads `pending`. This is what routes the phase to `human_needed`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `update_draft` route | `update_workflow_definition` | `token=if_match` | ✓ WIRED | Unaffected. |
| `db/workflows.py` | `workflow_definitions.updated_at` | `CONCURRENCY_TOKEN_SQL` | ✓ WIRED | Unaffected. |
| `publish_service` stage 0 | stage 5 | `stage0_token` | ✓ WIRED | Unaffected. |
| `reload()` failure | the conflict banner | restore-not-replace | ✓ WIRED | Unaffected by this round (GAP-4/CR-02, carried forward). |
| `useDraftPersistence.saveNow` (explicit Save, flag-off surface) | `WorkflowBuilderPage.blockedReason` | `persistState.kind === "saving"` | ✓ **NOW WIRED — was the CR-03 break** | Re-derived this session: the memo's `saving` check runs first, unconditionally; a chosen Save on the flag-off surface is now visible to `blockedReason`. |
| `blockedReason` | `PublishGauntlet`'s `blocked` | `typeof … === "string" && .trim().length > 0` | ✓ WIRED | Unaffected — was always sound; now receives a correct input on both branches. |
| hold-release effect | `BuilderSaveRegion`'s quiet line | `{kind:"held", sentence}` | ⚠️ **WIRED, but the source only fires the sentence from one prior state (`idle`)** | New this round (WR-19) — the wiring itself is correct; the effect's own predicate under-covers the states it claims to cover. |

### Data-Flow Trace (Level 4)

Continuing the prior report's shape: the write itself, and now the refusal, are the "data" being
traced. Re-traced the refusal hop end to end this session on BOTH branches:

- **Flag ON:** `persistState.kind` → `blockedReason` (`saving` check, first statement) →
  `PublishGauntlet.blocked` (`:846`) → `disabled={blocked}` on the trigger (`:921`) and
  `canPublish = … && !blocked` gating the inner click (`:592`). Confirmed via the live re-run of
  `WorkflowBuilderPage.canvas.test.tsx`'s pre-existing "186-16" describe (all rows green).
- **Flag OFF (the CR-03 hop):** previously severed at `blockedReason`'s own short-circuit;
  **now traced through, live**, in this session's re-run of the new "CR-03" test row
  (`WorkflowBuilderPage.canvas.test.tsx:1903`) — a chosen Save issues exactly one `mockUpdate`
  call, `blockedReason` reads `SAVING_PUBLISH_WAIT` while it's outstanding, and returns to the
  pre-save reading once the PATCH resolves. No longer HOLLOW.
- **The hold-release sentence hop (WR-19/WR-20):** `store.getState().dirty` → `heldPendingRef` /
  `setState` inside the release effect → `BuilderSaveRegion`'s quiet line. Traced and confirmed
  the data DOES flow correctly for the `idle` prior state (F20i, re-run green) but the same effect
  silently drops the transition for a `saved` prior state (WR-19) and for an overlapping second
  hold (WR-20) — these are gaps in the effect's own branch coverage, not breaks in the wiring
  chain itself, so they are classified as Warnings against artifact quality rather than
  NOT_WIRED / HOLLOW key links.

### Behavioral Spot-Checks

Independently re-run in this session (not inherited from any SUMMARY):

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-03 + WR-12 + WR-13 + flag-off header pin regression | `cd frontend && npx vitest run --fileParallelism=false src/pages/WorkflowBuilderPage.canvas.test.tsx src/hooks/useDraftPersistence.test.tsx src/pages/WorkflowBuilderPage.header.test.tsx` | **3 files passed, 170/170 tests passed** | ✓ PASS |
| Backend concurrency + publish-race + published-409 suite | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_186_concurrent_patch.py tests/unit/test_186_publish_race.py tests/unit/test_103_published_409.py -q` | **21 passed, 0 skipped** (live Postgres reachable) | ✓ PASS |
| Commit hashes claimed by 186-18/19/20 SUMMARYs exist in history | `git log --oneline -15` | `64042c12`, `bb693e10`, `bbccf283`, `17a1fd37`, `26b3a3ff`, `83a721fb`, `a27e3e39`, `4504daf1`, `be7303ca`, `5a1cc5c8`, `a72b1fd7`, `5002f249` all present in order | ✓ PASS |
| `blockedReason` wiring reaches both header branches | Read `WorkflowBuilderPage.tsx:1722-1770` | `actionGroup` mounts `renderPublish(…, blockedReason, …)` once; rendered at both `:1763` (BuilderHeaderBar) and `:1768` (plain header) | ✓ PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` convention governs this phase, and neither the
PLANs nor VALIDATION.md declare a probe. Skipped, unchanged from prior verifications.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|--------------|--------|----------|
| **CONCUR-01** | 186-01, 04, 06, 07, 08, 09, 12, 13 | Autosave updates the draft row in place; a cosmetic drag never mints a version or re-arms the gauntlet | ✓ **SATISFIED (automated evidence complete)** | Truths 1, 4, 5, 6. Untouched by this round; no residue against this requirement. `.planning/REQUIREMENTS.md:54` correctly stays `[ ]` (unchecked) pending live UAT sign-off. |
| **CONCUR-02** | 186-01, 02, 03, 05, 06, 07, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19 | Concurrency guard protects the shared draft; publish is guarded against reading a dirty draft | ✓ **SATISFIED (automated evidence complete) — human sign-off still owed** | Truths 2, 3, 7, 8 all now VERIFIED (CR-03 closed this round). The remaining open item is truth 9 (SC#4's live two-editor UAT), which is a human-verification gate, not an automated gap. `.planning/REQUIREMENTS.md:55` correctly stays `[ ]` pending that sign-off. |

Both `.planning/REQUIREMENTS.md:113-114` entries remain `Pending`, which is correct — automated
evidence is now complete for both requirements, but neither should flip to Complete until the
`186-VALIDATION.md` Manual-Only rows are actually driven live (G-4). No orphaned requirements:
only CONCUR-01 and CONCUR-02 map to Phase 186.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/hooks/useDraftPersistence.ts` | 908 | WR-19 — the flag-off hold-release sentence only fires from an `idle` prior state, missing the `saved` sibling | ⚠️ Warning (new, not yet in deferred-items.md) | A saved-then-edited author gets silence instead of the corrected instruction — same symptom class as WR-12, narrower trigger. No write-safety impact. |
| `frontend/src/hooks/useDraftPersistence.ts` | 889-891 | WR-20 — a `held` reading is never refreshed across an overlapping/second hold cycle | ⚠️ Warning (new, not yet in deferred-items.md) | `HOLD_ENDED_UNSAVED` can remain on screen through an entire second gauntlet, becoming false. No write-safety impact. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 1093-1102 (WR-14, deferred) | The wait reason outranks fixable reasons and disables the free-click trigger | ⚠️ Warning (recorded deferral, re-open trigger present) | Recorded in `deferred-items.md`; widened by the CR-03 fix, cost accepted deliberately. |
| `frontend/src/hooks/useDraftPersistence.ts` | 633-638 (WR-15, deferred) | `saving` block has no ceiling; one branch is theoretically unbounded | ⚠️ Warning (recorded deferral) | Unreachable today per IN-01; recorded with re-open trigger. |
| `frontend/src/hooks/useDraftPersistence.ts` | 988-1032 (WR-16/17, deferred) | `reload()`'s catch over-scopes; a second Reload shows a stale note | ⚠️ Warning (recorded deferral, shared re-open trigger) | Recorded in `deferred-items.md`. |
| `frontend/src/hooks/useDraftPersistence.ts` | 1058 (WR-18, deferred) | `overwrite()` degrades to an unguarded write on a `null` token | ⚠️ Warning (recorded deferral, containment stated) | Recorded; residual exposure is an optimistic-guard loss inside one owner's own drafts, not an authorization loss. |

No `TBD` / `FIXME` / `XXX` debt markers found in the files touched by 186-18/19/20 (consistent
with each SUMMARY's own clean sweep).

### Human Verification Required

Eight items (unchanged in count from the prior verification; content of the last row updated to
reflect the shipped CR-03 fix rather than the pre-fix symptom). All eight rows in
`186-VALIDATION.md`'s Manual-Only Verifications table are STILL `to run` — no operator session has
occurred between the last verification and this one. **SC#4 is not inferable from any automated
evidence** — G-4 makes live Chrome-driven observation the acceptance bar.

### Gaps Summary

**CR-03, the sole blocker from the last verification, is genuinely closed.** Independently
re-derived from source and confirmed with a live test run in this session (not inherited from any
SUMMARY or REVIEW): `blockedReason`'s `saving` check now runs before the flag/phase short-circuit,
and the wiring that makes this reachable — `actionGroup` mounting `renderPublish` unconditionally
on both header branches — was traced directly, not assumed. WR-13 is also genuinely closed
(`heldPendingRef` clears alongside `haltedRef` in `overwrite()`).

**WR-12 is closed for the reported symptom and narrower than its own docblock's claim.** The
gap-closure code review (`186-REVIEW.md`) found this independently and it re-derives correctly
against the live tree: the fix's predicate (`s.kind === "idle"`) covers the exact sequence WR-12
was raised about, but not a `saved`-then-edited sibling sequence with the identical symptom
(WR-19), and the hold-release mirror is never refreshed across a second hold (WR-20). Both are
UI-honesty gaps in edge sequences of the hold-release mechanism — the same non-blocking class as
the five already-recorded deferrals (WR-14..18) — not concurrency-safety defects. Neither affects
whether a write is safe, whether it happens automatically past the flag, or whether the person
can pick their exit on conflict (truths 6 and 7, both still fully verified).

**Recommendation, not a blocker:** add WR-19 and WR-20 to `deferred-items.md` with re-open
triggers before the next phase-186 touch, matching the treatment already given to WR-14..18, so
these two are consciously scheduled rather than merely unmentioned. This does not gate phase
completion — no observable truth backing CONCUR-01 or CONCUR-02 depends on them.

**All 8 automated must-haves now pass.** Score moved from 7/9 to 8/9. The single remaining
UNCERTAIN item — SC#4's live two-editor UAT — was uncertain in the prior verification and remains
uncertain now for the same reason: no operator session has run the `186-VALIDATION.md` board.
This routes the phase to `human_needed`, not `passed` — per the verification decision tree, a
non-empty human-verification section takes priority over an otherwise-complete automated score.

**This is now a human-verification gate, not a task-completion or goal problem.** All twenty
plans' tasks are done and committed; every measurement re-run in this session is green; the one
remaining blocker from the last round is closed and independently confirmed. What remains is
exactly what the phase goal's closing clause asks for — "closed before real usage, not discovered
live" — which requires the eight `186-VALIDATION.md` rows to actually be driven live before the
phase can be marked `passed`.

---

_Verified: 2026-08-01T21:15:00Z_
_Verifier: Claude (gsd-verifier)_
