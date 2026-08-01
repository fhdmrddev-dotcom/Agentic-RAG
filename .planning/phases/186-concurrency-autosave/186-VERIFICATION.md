---
phase: 186-concurrency-autosave
verified: 2026-08-01T18:30:00Z
status: gaps_found
score: 7/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/8
  gaps_closed:
    - "GAP-4 / CR-02 — a failed `reload()` no longer strands the draft. Re-derived from source: the catch at `useDraftPersistence.ts:937-949` now RESTORES `{kind:\"conflict\", currentToken, note: RELOAD_FAILED_NOTE}` when `haltedRef.current` is true, and mutates nothing else. The banner (`BuilderSaveRegion.tsx`) renders the note additively, so both Reload and Overwrite stay mounted and enabled through a failed exit."
  gaps_remaining: []
  new_findings:
    - "CR-03 (BLOCKER, new this round) — 186-16's publish guard (`persistState.kind === \"saving\"`) is computed BELOW `if (!canvasEnabled || builderPhase !== \"drafted\") return null` in `blockedReason` (`WorkflowBuilderPage.tsx:1075-1077`). With `visual_workflow_canvas` OFF, `blockedReason` is always `null`, so `PublishGauntlet` never gates either the trigger or the inner Publish click — while `saveNow` is deliberately NOT gated on `enabled` (D-186-03) and both `BuilderSaveRegion` (Save-draft) and `renderPublish` mount unconditionally on both branches of the header gate (`:1745`/`:1750`, `:1723-1725`). Independently re-derived from source, not accepted from `186-REVIEW.md`."
    - "WR-12/WR-13 (warnings) — 186-17's hold-release fix has two residual holes: on the flag-off path the hold resolves to a bare `{kind:\"idle\"}` with no replacement sentence, so the author is left with unsent work and zero surface indication until they try to leave (WR-12); and `heldPendingRef` is left untouched on the `haltedRef` early-return, so a later clean-store hold cycle can still issue a no-op PATCH that mints a fresh token (WR-13). Both re-derived directly from `useDraftPersistence.ts:825-846` in this session."
  regressions: []
gaps:
  - truth: "CONCUR-02 / WR-10 — publish is refused while an autosave write is outstanding, on EVERY surface the write itself is reachable from (D-186-16's own stated goal, and D-186-03's asymmetry: chosen writes are not gated on the canvas flag)"
    status: failed
    id: CR-03
    reason: >
      Independently re-derived from source, not accepted from `186-REVIEW.md`. `blockedReason`
      is a `useMemo` whose FIRST line is `if (!canvasEnabled || builderPhase !== "drafted")
      return null` (`WorkflowBuilderPage.tsx:1076`) — the 186-16 guard
      (`if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT`) sits on the NEXT line
      (`:1077`), strictly after it. With `visual_workflow_canvas` OFF, the first line always
      fires, so `blockedReason` is always `null` regardless of `persistState.kind`. Confirmed
      the write is reachable on that surface: `saveNow` (`useDraftPersistence.ts:852-863`) has
      no `enabled`/`canvasEnabled` check at all — only `haltedRef` and `holdRef` — matching its
      own docblock at `:820-823` ("automatic writes obey the flag, chosen ones obey the
      person", D-186-03). Confirmed both affected controls are mounted regardless of the flag:
      `actionGroup` (containing `BuilderSaveRegion` with the Save-draft button, and
      `renderPublish` fed `blockedReason`) is rendered by BOTH the `canvasEnabled` branch
      (`WorkflowBuilderPage.tsx:1745`, via `BuilderHeaderBar`) and the flag-off branch
      (`:1750`, the plain `<header>`). Confirmed `PublishGauntlet` derives `blocked` straight
      from the string: `blocked = typeof blockedReason === "string" && blockedReason.trim().length > 0`
      (`PublishGauntlet.tsx:846`) gates the outer trigger's `disabled={blocked}` (`:921`), and
      `canPublish = ... && !blocked` (`:592`) gates the inner Publish click that actually spends
      a golden run (`:607` `if (!canPublish) return`). So on the flag-off surface `blocked` is
      always `false` and neither control refuses a click. Sequence, entirely within shipped
      affordances: flag-off Builder, author edits, presses Save draft (a PATCH goes out via
      `saveNow`/`performWrite`, no timeout/no abort by design — `api.ts:3430-3449`); within that
      round trip the author opens Publish and clicks the inner Publish button; nothing refuses
      either click; `publish_service.py` reads `stage0_token`, the PATCH commits after that
      read, and the stage-5 flip answers `draft_changed` AFTER a real golden run has burned wall
      clock and provider spend — the exact waste WR-10 was raised to prevent, just on the other
      flag branch. Confirmed this is unrecorded rather than an accepted trade-off:
      `deferred-items.md` §"The publish-time `flushPendingWrites()` seam — REJECTED" explicitly
      states the premise "`renderPublish` ... is mounted unconditionally on the Builder header,
      on both branches of the flag gate" as the reason to reject the STRONGER fix — the same
      premise that makes the WEAKER, shipped fix inert on that same branch — and the authors did
      not carry the premise to the implementation. The one new test covering the flag-off
      surface (`WorkflowBuilderPage.canvas.test.tsx` — "with the flag OFF nothing writes and
      nothing blocks") only drives an autosave-path edit (which the `enabled` gate correctly
      suppresses) and asserts `latest()).toBeNull()`; no test presses Save-draft on the flag-off
      surface and then reads `blockedReason`, so the defect is recorded as the expected result
      rather than caught. Note: this does NOT let an unsafe publish silently succeed — the
      server-side stage-0/stage-5 token guard (SC#3, truth 3 below) still refuses the drifted
      publish and preserves the golden-run receipt. The harm is the wasted golden run + a
      confusing post-hoc `draft_changed` refusal for an edit made before the Publish click,
      which is precisely the UX guard CONCUR-02's "publish is guarded against reading a dirty
      draft" text promises and WR-10 was raised, closed, and re-opened here to prevent.
    artifacts:
      - path: "frontend/src/pages/WorkflowBuilderPage.tsx"
        issue: "Lines 1075-1084 — the `!canvasEnabled` short-circuit on line 1076 sits ABOVE the `saving` check on line 1077, so the guard never evaluates when the canvas flag is off"
      - path: "frontend/src/components/workflows/PublishGauntlet.tsx"
        issue: "Line 846 (`blocked` derivation) and lines 592/921 (gates fed by it) correctly gate on `blockedReason`, but that prop is structurally unreachable-non-null on the flag-off surface"
    missing:
      - "Lift the `saving` check above the flag/phase check in `blockedReason` (the reviewer's proposed fix, `WorkflowBuilderPage.tsx:1075-1084`): a write this client has outstanding is a fact about the client, not a verdict about the workflow, so it should not sit behind the D-181-01 gate that hides verdicts."
      - "Add a canvas-test row that presses `builder-save-draft` on the flag-off surface against a deferred `mockUpdate` and asserts the captured `blockedReason` is `SAVING_PUBLISH_WAIT` (the exact hole the current flag-off row does not cover)."
      - "Re-check the D-181-01 markup-identity pin after the fix: `blockedReason` becomes non-null on the flag-off surface only while a write the person explicitly requested is outstanding, which is unreachable at rest, so the resting-header assertion in `WorkflowBuilderPage.header.test.tsx` should be unaffected — but this needs to be confirmed, not assumed."
deferred: []
human_verification:
  - test: "Two tabs — same draft open in A and B; edit in A (let it autosave), then edit in B"
    expected: "B shows the honest banner, stops writing, offers Reload (default) then Overwrite. A's content intact."
    why_human: "SC#4 / the SC#10 parallel axis. G-4 mandates live Chrome-driven UAT for user-visible surfaces. `186-VALIDATION.md` row 1 status is still `to run`."
  - test: "Stale tab — leave B open, edit + save in A, return to B minutes later and type"
    expected: "Same honest outcome. No silent overwrite, no retry storm."
    why_human: "`186-VALIDATION.md` row 2 status is still `to run`."
  - test: "Publish race — start a publish in A, edit in B mid-gauntlet"
    expected: "Publish refuses with the worded `draft_changed` verdict; the golden-run receipt still browsable; the spine shows a block, not 8 green pips."
    why_human: "`186-VALIDATION.md` row 3 status is still `to run`."
  - test: "Publish hold, both halves of the flag — start a publish in A, then edit in A; repeat once with `visual_workflow_canvas` ON and once OFF"
    expected: "Flag ON: 'Publishing — changes will save when it finishes', and the edit flushes on resolution. Flag OFF: the manual sentence is on screen while the gauntlet runs and is GONE from the header once it ends, without ever having written anything."
    why_human: "`186-VALIDATION.md` row 3b is still `to run`; this is also the live observation point for WR-12 (the flag-off resolution goes silent rather than saying what happened)."
  - test: "Conflict-exit failure — reach the conflict banner (row 1), then go offline and press Reload"
    expected: "The banner stays on screen with BOTH exits present and pressable, plus the extra line 'We couldn't reach the server to reload...'. Restoring the network and pressing Reload again succeeds and clears the banner."
    why_human: "`186-VALIDATION.md` row 7 is still `to run`. This is GAP-4/CR-02 observed live, confirming the source-level fix re-derived in this report against the real product."
  - test: "KB re-bind, three paths — bind/re-bind from NL-generated, forked starter, and Tweak fork"
    expected: "The chip is a picker in all three; unbound reads the invitation sentence with no severity/code/tray row; binding persists through autosave and survives reload."
    why_human: "`186-VALIDATION.md` row 5 is still `to run`; BUG-260731-03's frontmatter requires live confirmation before closing even the control half."
  - test: "Force a 422 mid-edit (invalid shape) and observe the save state"
    expected: "'Not saved — ...'; the draft stays dirty; the leave guard fires on navigate-away."
    why_human: "`186-VALIDATION.md` row 6 is still `to run`."
  - test: "Publish while the client's write loop shows `saving`, on the flag-OFF Builder — press Save draft, then within the same round trip open Publish and click the inner Publish button"
    expected: "Publish should refuse with a wait/'saving' reason, the same way it does on the flag-on surface. What the code currently does: neither the trigger nor the inner Publish button is disabled, and the gauntlet runs to a `draft_changed` refusal after burning a full golden run."
    why_human: "New this round — the live confirmation of CR-03. Not yet in `186-VALIDATION.md`; recommend adding it as a row before the next verification pass."
---

# Phase 186: Concurrency & Autosave — Verification Report (RE-VERIFICATION, waves 9-10)

**Phase Goal:** Continuous canvas autosave is safe on org-shared workflows — a cosmetic drag never mints a definition version or re-arms the golden-run gauntlet, and two editors cannot silently clobber each other. Closed before real usage, not discovered live.
**Verified:** 2026-08-01T18:30:00Z
**Status:** gaps_found
**Re-verification:** Yes — after all 17 plans (waves 1-10), following the 2026-08-01 re-verification that found GAP-4/CR-02 as the sole open blocker (score 6/8)

Every claim below marked "re-derived" was established by reading the named source lines in this
session, not accepted from any SUMMARY.md or REVIEW.md. `186-REVIEW.md` (waves 9-10) and
`186-REVIEW-waves-6-8.md` were read as INPUT; the critical finding (CR-03) and two of its
attached warnings (WR-12, WR-13) were independently re-derived from source in this session
rather than trusted. Test-count claims attributed to "the orchestrator's measurements" below
were supplied by the calling agent and accepted per the task's explicit instruction, not
re-run in this session; everything else was read directly.

## Gap-Closure Ledger (traceability preserved across all rounds)

| Id | Original finding | Resolution | Evidence re-derived this session |
|----|------------------|------------|----------------------------------|
| **GAP-1 / CR-01** | mid-flight edit silently dropped; false `Saved ✓` filed | ✅ **CLOSED** | Carried forward unchanged from the prior re-verification; not touched by waves 9-10. |
| **GAP-2 / WR-01** | `overwrite`/`reload` bypass single flight | ✅ **CLOSED** | Carried forward unchanged. |
| **GAP-3 / WR-03** | hold-release wrote with the canvas flag off | ✅ **CLOSED** | Carried forward unchanged. |
| **GAP-4 / CR-02** | a failed `reload()` strands the draft permanently | ✅ **CLOSED** (was the sole open blocker) | Re-derived this session: `useDraftPersistence.ts:937-949` — the catch restores `{kind:"conflict", currentToken: conflictTokenRef.current, note: RELOAD_FAILED_NOTE}` when `haltedRef.current` is true, mutating nothing else, and falls back to `SAVE_FAILED_SENTENCE` only when NOT halted (`:947-949`). `BuilderSaveRegion` renders the note additively (confirmed by the `RELOAD_FAILED_NOTE` wiring), so both exits stay mounted through a failed Reload. |
| **WR-06** | backend tests all vanish without Postgres | ✅ **CLOSED** (was partially closed) | Per `186-REVIEW.md`'s re-derivation: the module-level `pytestmark` is gone from `test_186_concurrent_patch.py`, replaced with per-test `skipif`; `grep -rn "stale_token"` now matches DB-free assertions. Not independently re-run this session; accepted from the review's direct grep evidence, which is itself a command result rather than a narrative claim. |
| **WR-07** | published-row 409 never halts | ✅ **CLOSED** | `isTerminalRefusal` now names both `WorkflowNotFoundError` and `WorkflowConflictError` per the review; consistent with the docblock language observed at `useDraftPersistence.ts:820-823` in this session (single home for the halt predicate). |
| **WR-08** | drain's unthrottled `continue` sets the rate by round-trip latency | ✅ **CLOSED as stated**, with a second-order effect | The 186-17 SUMMARY documents the fix by splitting the receipt-identity check from the re-entry check and returning control to the live debounce timer; the review confirms this closes WR-08's literal claim but widens the window WR-14/WR-15 describe (Publish trigger intermittently disabled during typing; the `saving` block has no ceiling). Not blockers. |
| **WR-09** | flag-off hold-release never resolves the `held` reading | ⚠️ **PARTIALLY CLOSED** | Re-derived this session at `useDraftPersistence.ts:825-846`: the resolution now runs unconditionally and above all three gates (`:832`), so a stale "Publishing —" sentence no longer survives past the gauntlet ending. Confirmed the residue: on the `!enabled` branch (`:834-839`) the state resolves to a bare `{kind:"idle"}` with no replacement sentence (WR-12), and on the `haltedRef` branch (`:833`) `heldPendingRef` is left untouched (WR-13). Both are warnings, not blockers — the underlying safety property (no automatic write past the flag) still holds. |
| **WR-10** | Publish not gated on an outstanding write | 🛑 **CLOSED FLAG-ON ONLY — new blocker CR-03** | See the gaps frontmatter and the Critical Issue section below. Independently re-derived from source, confirming `186-REVIEW.md`'s finding rather than accepting it. |
| **WR-11** | absolute PATCH counts over a drifting interval (test defect, not product defect) | ✅ **CLOSED** | Per the review: `patchDelta` now measures the dismissal with a positive control; both the RED and GREEN measurements are recorded rather than either being inherited on trust. |

## Goal Achievement

### Observable Truths

| # | Truth (source) | Status | Evidence |
|---|----------------|--------|----------|
| 1 | **SC#1 / CONCUR-01** — editing a draft autosaves by UPDATING THE DRAFT ROW IN PLACE; a cosmetic node drag never mints a version or re-arms the gauntlet | ✓ VERIFIED | Unaffected by waves 9-10 (no touched file in this round overlaps `update_workflow_definition`'s SET clause or `canvasNudge.ts`). Server-side guard confirmed unchanged in `186-REVIEW.md`'s own re-grep of every `updated_at` comparison site. Orchestrator-supplied regression gate: 35 prior-phase suites 1822/1822 at 30 s timeout, which includes the canvas/nudge suites this truth depends on. |
| 2 | **SC#2 server half / CONCUR-02** — a stale writer is refused with a machine-readable code, never a false 404, and the owner scope is never replaced | ✓ VERIFIED | Unaffected by waves 9-10; `CONCURRENCY_TOKEN_SQL` remains the sole rendering of the token. Orchestrator-supplied: backend `test_186_concurrent_patch.py` + `test_186_publish_race.py` + `test_103_published_409.py` 21/21 pass. |
| 3 | **SC#3** — publish is guarded against reading a dirty draft (server side), and the golden-run receipt survives the refusal | ✓ VERIFIED | Stage-0 token capture → stage-5 guarded flip → `-2` sentinel → `draft_changed` block, unchanged by waves 9-10. This is the SAFETY backstop that keeps truth 8 below from being a data-corruption issue rather than a wasted-work / confusing-UX issue. |
| 4 | **GAP-1 / D-186-04** — never a false `Saved ✓` | ✓ VERIFIED | Carried forward; unaffected by waves 9-10 per the ledger above. |
| 5 | **GAP-2 / 186-06 must_have** — at most ONE PATCH outstanding per draft at any instant | ✓ VERIFIED | Carried forward; unaffected by waves 9-10. |
| 6 | **GAP-3 / D-181-01** — with `visual_workflow_canvas` OFF no AUTOMATIC write behaviour is reachable | ✓ VERIFIED | Carried forward; unaffected by waves 9-10 (the `enabled` gate on the debounce/hold-release effects was not touched by 186-14..17 except to extend the hold-release's flag-off state resolution, which strengthens rather than weakens this truth). |
| 7 | **D-186-08 / 186-12 must_have** — on conflict the loop halts and THE PERSON PICKS THE EXIT; both exits stay offered and no control is a silent no-op, INCLUDING on a failed exit attempt | ✓ **VERIFIED (was FAILED as GAP-4/CR-02)** | Re-derived from `useDraftPersistence.ts:910-951` in this session (see the ledger row above). Residue WR-16/WR-17 (the catch's try-scope is too wide; a second Reload attempt still shows the previous failure's note momentarily) are warnings on the same mechanism, not failures of this truth — both exits are on screen and functional in every case reviewed. |
| 8 | **CONCUR-02 / WR-10 — publish is refused while THIS client's autosave write is outstanding, on every surface that write is reachable from** | ✗ **FAILED (new blocker, CR-03)** | Re-derived independently from source in this session — see the Critical Issue section and the gaps frontmatter. `blockedReason`'s flag/phase short-circuit (`WorkflowBuilderPage.tsx:1076`) runs before the `saving` check (`:1077`), so the guard 186-16 shipped never evaluates on the flag-off Builder, where `saveNow` (ungated by design) and the Publish controls (mounted on both header branches) are both reachable. The server-side safety backstop (truth 3) still prevents an unsafe publish from *succeeding*; what fails is the pre-flight refusal CONCUR-02's "publish is guarded against reading a dirty draft" text and WR-10 both promise — the author burns a full golden run and gets a confusing post-hoc refusal instead. |
| 9 | **SC#4** — the two-editor / parallel path is exercised in live UAT; a second editor gets an honest read-only banner or a merge-safe outcome, never a silent overwrite | ? **UNCERTAIN — human required** | `186-VALIDATION.md` re-read in full this session: rows 1, 2, 3, 3b, 5, 6, 7 are ALL still `to run`. Row 4 (literal colleague clobber) remains correctly ⛔ BLOCKED-not-reachable with its reason, matching the CONTEXT landmine (workflows UPDATE is `created_by`-only; the real conflict is one user, two tabs, covered by rows 1-3). G-4 makes this non-substitutable by any automated evidence. |

**Score:** 7/9 truths verified · 1 FAILED (blocker, new) · 1 UNCERTAIN (human, unchanged)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/db/workflows.py` | `CONCURRENCY_TOKEN_SQL`, guarded UPDATE, owner-scoped probe, `-1`/`-2` pair | ✓ VERIFIED | Unaffected by waves 9-10. |
| `backend/app/api/workflows.py` — `update_draft` | optional `If-Match`, three-way refusal, code-less 404 | ✓ VERIFIED | Unaffected. |
| `backend/app/services/harness/publish_service.py` | stage-0 capture → stage-5 guarded flip → `draft_changed` block | ✓ VERIFIED | Unaffected — this is the truth-3 safety backstop that still holds under CR-03. |
| `frontend/src/hooks/useDraftPersistence.ts` | the whole write seam: single flight, honest receipts, honest refusals, `enabled` gate, durable conflict exits | ✓ VERIFIED (with 3 open warnings) | Re-read in full this session. GAP-4/CR-02 genuinely closed. WR-12/13 (flag-off hold resolution) and WR-16/17/18 (reload's catch scope, a second Reload's stale note, `overwrite`'s unconditional null-token adoption) are real, re-derived residue — none of them reopens a closed blocker, none is CONCUR-01/02-blocking on its own. |
| `frontend/src/components/workflows/BuilderSaveRegion.tsx` (+ test) | four/five sentences, the banner, `resolving`-aware disable | ✓ VERIFIED | Unaffected structurally by waves 9-10 (186-17's SUMMARY notes the file's diff is empty — the hold sentence selection lives entirely in the hook). |
| `frontend/src/components/workflows/PublishGauntlet.tsx` (+ test) | a spine naming every server stage; fail-open closed; gated on an outstanding write | ⚠️ **SUBSTANTIVE, WIRED, BUT THE GATE IS INERT ON ONE SURFACE** | `blocked`/`canPublish` correctly consume `blockedReason` (`:846`, `:592`); the prop itself is the defect (CR-03), not this file's consumption of it. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` — `blockedReason` memo | names every reason Publish should refuse, on every surface the write is reachable from | ✗ **STUB ON THE FLAG-OFF BRANCH** | Lines 1075-1084 — re-derived this session. The `saving` line is dead code whenever `canvasEnabled` is false. |
| `.planning/phases/186-concurrency-autosave/deferred-items.md` | every conscious trade-off, each with a re-open trigger | ✓ VERIFIED, and load-bearing for this finding | Re-read in full this session. Confirms CR-03 is UNRECORDED, not deferred: §"The publish-time `flushPendingWrites()` seam — REJECTED" argues against the *stronger* fix using the exact premise ("`renderPublish` ... mounted unconditionally ... on both branches of the flag gate") that also defeats the *weaker*, shipped fix — and the authors did not carry that premise to the implementation. |
| `.planning/phases/186-concurrency-autosave/186-VALIDATION.md` | operator sign-off on the 7 manual rows | ✗ **NOT RUN** | Re-read in full this session — every row is `to run` except the correctly-⛔-recorded row 4. Approval line still reads `pending`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `update_draft` route | `update_workflow_definition` | `token=if_match` | ✓ WIRED | Unaffected. |
| `db/workflows.py` | `workflow_definitions.updated_at` | `CONCURRENCY_TOKEN_SQL` | ✓ WIRED | Unaffected. |
| `publish_service` stage 0 | stage 5 | `stage0_token` | ✓ WIRED | Unaffected. |
| `reload()` failure | the conflict banner | restore-not-replace | ✓ **NOW WIRED (was the GAP-4/CR-02 break)** | Re-derived this session at `useDraftPersistence.ts:937-949`. |
| `useDraftPersistence.saveNow` (an explicit Save on the flag-off surface) | `WorkflowBuilderPage.blockedReason` | `persistState.kind === "saving"` | ✗ **NOT WIRED — CR-03** | The memo's flag/phase short-circuit runs first and unconditionally returns `null`, so a `saving` state produced by `saveNow` on the flag-off surface never reaches `blockedReason`. |
| `blockedReason` | `PublishGauntlet`'s `blocked` | `typeof ... === "string" && .trim().length > 0` | ✓ WIRED (correctly consumes whatever it is fed) | The consumption is sound; the input is the defect. |

### Data-Flow Trace (Level 4)

Same shape as the prior report: the write itself is the "data." The new hop this round adds is
the **refusal** path — `persistState.kind` → `blockedReason` → `PublishGauntlet.blocked` →
gated trigger/inner-button. Traced end to end on the flag-ON surface, this hop is real: a
`saving` reading reaches the gauntlet and disables both controls (confirmed via
`WorkflowBuilderPage.canvas.test.tsx`'s "the saving reason OUTRANKS the empty-draft invitation"
row, read in this session). Traced on the flag-OFF surface, the hop is **severed at its source**
— `persistState.kind` is computed correctly by the hook, but `blockedReason`'s own short-circuit
discards it before it ever reaches `PublishGauntlet`. This is a HOLLOW wiring in the CR-03 sense:
the mechanism exists, is exercised by a test, and produces the right answer on one branch while
silently producing a constant on the other.

### Behavioral Spot-Checks

Per the task's explicit instruction, the following were supplied by the calling agent as
already-run measurements and are recorded here rather than re-run in this session:

| Behavior | Command | Result | Status | Source |
|----------|---------|--------|--------|--------|
| Frontend, 9 phase-186 suites | (orchestrator-run) | 380/380 pass | ✓ PASS | orchestrator |
| Backend, 3 phase-186 test files | (orchestrator-run) | 21/21 pass | ✓ PASS | orchestrator |
| `tsc --noEmit -p tsconfig.app.json` | (orchestrator-run) | 0 errors in any phase-186 file | ✓ PASS | orchestrator |
| Regression gate, 35 prior-phase suites | (orchestrator-run, `--testTimeout=30000`) | 1822/1822 pass | ✓ PASS | orchestrator |
| Schema drift | (orchestrator-run) | none, zero migrations | ✓ PASS | orchestrator |

Independently re-derived in this session (source reads, not command runs, per the file-based
nature of the finding):

| Behavior | Method | Result | Status |
|----------|--------|--------|--------|
| CR-03 reachability | Read `WorkflowBuilderPage.tsx:1060-1084`, `:1704-1727`, `:1740-1752`; `useDraftPersistence.ts:848-863`; `PublishGauntlet.tsx:576-607, 837-938` | Confirmed line-by-line: the flag short-circuit precedes the `saving` check; `saveNow` has no `enabled` gate; both header branches mount `actionGroup` | ✗ CONFIRMS BLOCKER |
| GAP-4/CR-02 closure | Read `useDraftPersistence.ts:910-951` | Confirmed the catch restores `conflict` with a note, guarded on `haltedRef` | ✓ CONFIRMS CLOSED |
| WR-12/WR-13 residue | Read `useDraftPersistence.ts:825-846` | Confirmed: unconditional `idle` on `!enabled` (no replacement sentence); `heldPendingRef` untouched on the `haltedRef` early return | ✓ CONFIRMS WARNINGS (not blockers) |
| The flag-off canvas test's coverage gap | Read `WorkflowBuilderPage.canvas.test.tsx:1849-1862` | Confirmed it drives an autosave-path edit only, never a Save-draft press, and asserts the CR-03 symptom (`latest()).toBeNull()`) as the expected result | ✓ CONFIRMS THE GAP IS UNCAUGHT BY TEST |
| CR-03 recorded as an accepted trade-off? | Read `deferred-items.md` in full | Not recorded. The nearest entry (§"flushPendingWrites — REJECTED") argues against a stronger fix using the same premise that defeats the shipped weaker one, without carrying the premise through | ✓ CONFIRMS UNRECORDED, NOT DEFERRED |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` convention governs this phase, and neither the
PLANs nor VALIDATION.md declare a probe. Skipped per the scope guidance (unchanged from the
prior verification).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|--------------|--------|----------|
| **CONCUR-01** | 186-01, 04, 06, 07, 08, 09, 12, 13 | Autosave updates the draft row in place; a cosmetic drag never mints a version or re-arms the gauntlet | ✓ **SATISFIED** | Truth 1 + truths 4/5/6. Untouched by waves 9-10; no residue against this requirement. |
| **CONCUR-02** | 186-01, 02, 03, 05, 06, 07, 09, 10, 11, 12, 13, 14, 15, 16, 17 | Concurrency guard protects the shared draft; publish is guarded against reading a dirty draft | ⚠️ **PARTIALLY SATISFIED** | The server guard (truth 2), the publish safety backstop (truth 3), and the client's halt-and-offer-durable-exits mechanism (truth 7, now including a failed exit) are all real and re-derived. What is NOT satisfied: the client-side publish PRE-FLIGHT guard this round's WR-10 fix was supposed to complete is inert on the flag-off Builder (truth 8 / CR-03), and the live two-editor UAT SC#4 requires (truth 9) has still not been run. |

Both `.planning/REQUIREMENTS.md:113-114` entries remain `Pending`, which is correct — neither
should flip to Complete while CR-03 is an open blocker and SC#4's UAT rows are unrun. No orphaned
requirements: only CONCUR-01 and CONCUR-02 map to Phase 186, and both are claimed across the 17
plans' frontmatter (cross-checked against `186-VALIDATION.md`'s own requirements→test map).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 1075-1084 | Publish guard inert on the flag-off surface (CR-03) | 🛑 **Blocker** | A person can press Save then Publish on the flag-off Builder without either control refusing, burning a full golden run for a publish that can only end in `draft_changed`. |
| `frontend/src/hooks/useDraftPersistence.ts` | 834-839 | Flag-off hold-release resolves to silence, not a replacement sentence (WR-12) | ⚠️ Warning | The instruction "press Save draft again when it finishes" is erased at the instant it becomes actionable, leaving unsent work with no on-screen indication until the leave guard fires. |
| `frontend/src/hooks/useDraftPersistence.ts` | 833 | `heldPendingRef` untouched on the halted early return (WR-13) | ⚠️ Warning | A later clean-store hold cycle can still issue a no-op PATCH that mints a fresh token, manufacturing exactly the kind of conflict this phase exists to prevent. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` / `PublishGauntlet.tsx` | 1077 / 921 | `SAVING_PUBLISH_WAIT` outranks every "what to fix" sentence and disables the free trigger click (WR-14) | ⚠️ Warning | During sustained typing the actionable reason flickers out roughly once per debounce beat, and the modal-opening trigger (which spends nothing) is intermittently unclickable. |
| `frontend/src/hooks/useDraftPersistence.ts` | 605-610 | `saving` block has no ceiling; one branch leaves it stuck forever (WR-15) | ⚠️ Warning | The deferred-items note's safety argument for gating only on `saving` assumes it is always bounded; one branch (currently unreachable per IN-01) violates that, and network stalls have no client-side timeout. |
| `frontend/src/hooks/useDraftPersistence.ts` | 915-949 | `reload()`'s catch spans more than the request (WR-16) | ⚠️ Warning | A failure after a successful read (e.g. `rows.find` on a malformed body) reports "couldn't reach the server" for a server that answered, inviting a retry that cannot work. |
| `frontend/src/hooks/useDraftPersistence.ts` | 910-914 | A second Reload attempt still shows the first failure's note (WR-17) | ⚠️ Warning | Momentarily asserts a past network failure while a new attempt is in flight and both controls are disabled. |
| `frontend/src/hooks/useDraftPersistence.ts` | 980 | `overwrite()` silently degrades to an unguarded write on a `null` token (WR-18) | ⚠️ Warning | If a refusal body lacked `detail.token`, "Overwrite" stops being a guarded single-shot write and can silently clobber a third writer with no refusal. |

No unresolved `TBD` / `FIXME` / `XXX` debt markers found in the files reviewed this session
(consistent with the orchestrator-supplied clean debt-marker sweep and the review's own file-by-file
check).

### Human Verification Required

Eight items, in the frontmatter (7 carried forward from `186-VALIDATION.md`'s own
"Manual-Only Verifications" table plus 1 new item this round for CR-03). All seven pre-existing
rows are STILL `to run` — none have been executed between the prior and this verification.
**SC#4 is not inferable from any automated evidence** — G-4 makes live Chrome-driven observation
the acceptance bar, and no wire-format or unit result substitutes for it. Recommend adding the
new CR-03 row to `186-VALIDATION.md` formally once the code fix lands, so the live check and the
fix ship together.

### Gaps Summary

**GAP-4/CR-02, the sole blocker from the last verification, is genuinely closed.** Re-derived
from source rather than accepted: a failed `reload()` now restores the conflict state with both
exits intact and an explanatory note, guarded correctly on `haltedRef` so it cannot fabricate a
conflict that did not happen. WR-06, WR-07, WR-08 (as literally stated), and WR-11 are also
closed, each re-derived or cross-checked against the waves-9-10 review's own command-level
evidence.

**One new blocker replaces it: CR-03.** 186-16 shipped the refusal WR-10 asked for, but placed it
behind a flag/phase check that unconditionally returns `null` before the new check is ever
reached — so the guard is dead code on exactly the surface where the write it guards against is
still reachable by design (`saveNow` is deliberately ungated on `canvasEnabled`, and the Save
button plus the Publish trigger both mount unconditionally on the flag-off header). This is
independently confirmed by direct source reading in this session, not accepted from the review.
It is important context that the SAFETY backstop — the server's stage-0/stage-5 token guard —
still refuses the drifted publish and preserves the golden-run receipt (truth 3), so no unsafe
publish can silently succeed. What is broken is the pre-flight economics/UX guard CONCUR-02's own
requirement text and WR-10's own reasoning both promise: an author on the flag-off surface can
still burn a full golden run and get a confusing after-the-fact refusal for an edit made before
they clicked Publish. The fix is small (reorder two lines in one `useMemo`) and is named
precisely in `186-REVIEW.md`.

**Five further warnings (WR-12/13/14/15, and the CR-02-adjacent WR-16/17/18) are real and
independently confirmed for the two I re-derived directly (WR-12, WR-13) — none reopens a closed
blocker and none independently fails a CONCUR-01/02 truth**, but they cluster in the same place
every round of this phase has found residue: the failure and flag-off paths of mechanisms that
are honest on their success path.

**SC#4's live UAT is still entirely unrun.** All 7 rows in `186-VALIDATION.md` (6 "to run" + the
correctly-blocked row 4) remain exactly where the prior verification left them — no operator
session has occurred between rounds. This alone would route the phase to `human_needed` were it
not for CR-03, which is a hard `gaps_found` on its own.

**This remains a goal problem, not a task-completion problem.** All seventeen plans' tasks are
done and committed, and every measurement the orchestrator supplied is green. The phase goal —
"two editors cannot silently clobber each other... closed before real usage, not discovered
live" — is not yet true for one concrete, reachable sequence on the flag-off Builder, and the
live two-editor UAT that would be the other half of "not discovered live" has not been run.

---

_Verified: 2026-08-01T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
