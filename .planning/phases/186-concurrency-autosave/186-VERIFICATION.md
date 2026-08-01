---
phase: 186-concurrency-autosave
verified: 2026-08-01T06:10:00Z
status: gaps_found
score: 4/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Never a false `Saved ✓`. A refusal — of any kind — leaves the draft dirty (D-186-04 / D-186-06 must_have; T-185-04-01 lesson)"
    status: failed
    reason: >
      Independently reproduced by reading `useDraftPersistence.ts` (not just trusting
      186-REVIEW.md's CR-01): the drain condition at line 403 (`if (pendingRef.current)`)
      is the ONLY thing that stops a completed write from calling `markSaved()`. `pendingRef`
      is set in exactly three places (debounce-timer-while-in-flight :458-460, `saveNow`
      :503-505, hold-release :484-486) — all three require `inFlightRef.current` to already
      be true AT THE MOMENT the edit is observed. An edit that lands during an in-flight
      PATCH but BEFORE its own 1000ms debounce timer has matured sets none of them (the
      timer is simply rescheduled via the effect's `[definition, enabled]` dependency
      change, with no re-check of `inFlightRef` at reschedule time — only at fire time,
      1000ms later). The in-flight write completes first (a PATCH round-trip is normally
      far under 1000ms), finds `pendingRef.current === false`, and calls
      `store.getState().markSaved()` — clearing `dirty` for a payload that predates the
      edit. When the edit's own timer fires at t+1000ms, it reads `if (!store.getState().dirty) return`
      (line 457) and silently discards the edit. This also disarms `beforeunload`, the
      in-app leave guard, and the blur rescue, all of which key on `dirty`. This is the
      common interleaving (type, pause ~1s, resume, stop), not an edge case, and it directly
      falsifies the plan's own must_have wording ("NO false `Saved ✓` is ever filed").
    artifacts:
      - path: "frontend/src/hooks/useDraftPersistence.ts"
        issue: "Lines 403-422 (drain/receipt) + 440-466 (debounce reschedule) + 457 (dirty gate) — silent data loss + false receipt on the common in-flight-edit interleaving"
    missing:
      - "Stop inferring 'nothing newer' from a queue flag; compare what was actually written (capture phases/meta identity at snapshot time, compare against the store's current values before filing the receipt) OR have the debounce effect set pendingRef.current=true whenever it reschedules while inFlightRef.current is true."
      - "A regression test whose second edit's timer does NOT mature during the first write's flight (the shipped F9 test only covers the timer maturing while held open, which already works)."
  - truth: "At every instant at most ONE PATCH is outstanding per draft, and each carries the token returned by the immediately preceding successful write (186-06 must_have)"
    status: failed
    reason: >
      Independently confirmed: `performWrite` (useDraftPersistence.ts:353) enforces only
      `haltedRef.current`. The single-flight rule (checking `inFlightRef.current` before
      calling `performWrite`) lives in the CALLERS — `saveNow` (:503), the debounce timer
      (:458), and the hold-release effect (:484) all check it — but `overwrite()` (:554-558)
      and `reload()` (:519-540) do not. `overwrite` calls `performWrite()` directly with no
      guard. The conflict banner's Overwrite button is never disabled, so a double-click
      issues two concurrent PATCHes carrying the same token; the loser is refused
      `stale_token`, producing a conflict banner for a conflict that does not exist — the
      exact user-facing lie the module's own docblock argues against.
    artifacts:
      - path: "frontend/src/hooks/useDraftPersistence.ts"
        issue: "Lines 554-558 (overwrite) and 519-540 (reload) bypass the inFlightRef check that every other caller of performWrite respects"
    missing:
      - "Move the single-flight check inside performWrite itself so it's a property of the writer, not of each caller (per the review's suggested fix)."
      - "Disable the Overwrite/Reload buttons while state.kind === 'saving'."
  - truth: "With `visual_workflow_canvas` OFF, the product is provably byte-identical to today (D-181-01, milestone HARD gate #1, inherited by every later phase including 186)"
    status: failed
    reason: >
      Independently traced: `enabled: canvasEnabled && builderPhase === "drafted"` is
      passed into `useDraftPersistence` (WorkflowBuilderPage.tsx:812), and the debounce
      effect correctly bails when `!enabled` (useDraftPersistence.ts:441). But the
      hold-release effect (:477-490) does NOT read `enabled` anywhere — it fires purely off
      `holdReason` transitioning non-null -> null. `renderPublish` (which supplies
      `setPublishInFlight`, the thing that drives `holdReason`) is mounted unconditionally —
      `{renderPublish && definition && (<div>{renderPublish(..., setPublishInFlight)}</div>)}`
      at WorkflowBuilderPage.tsx:1699-1701, not gated on `canvasEnabled` — because Publish is
      a pre-186 door that already worked with the canvas flag off. `BuilderSaveRegion`'s
      explicit Save-draft button is also unconditionally rendered (only the quiet status
      LINE is hidden via `autosaveEnabled={canvasEnabled}`), so `saveNow()` — which arms
      `heldPendingRef` while held (:498-501) — is reachable with the flag off. So: flag off,
      a user presses Save while a publish is in flight (or edits land while held, on
      whatever pre-186 editing surface remains reachable with the flag off) -> the hold
      resolves when publish finishes -> the hold-release effect fires an AUTOMATIC,
      unrequested PATCH, a write behavior that did not exist pre-186 on the flag-off
      surface. D-181-01 promises the flag-off product is provably byte-identical; this is
      new write behaviour leaking through the revert switch.
    artifacts:
      - path: "frontend/src/hooks/useDraftPersistence.ts"
        issue: "Lines 477-490 — the hold-release effect performs an automatic write without checking `enabled`"
    missing:
      - "Gate the automatic flush the same way the timer is gated: `if (!enabled) return` inside the hold-release effect, before calling performWrite() (saveNow/overwrite may stay ungated since they are user-initiated)."
      - "A flag-off regression test that drives a publish-in-flight -> resolve transition and asserts zero network calls."
deferred: []
human_verification:
  - test: "Two tabs — same draft open in A and B; edit in A (let it autosave), then edit in B"
    expected: "B shows the honest banner, stops writing, offers Reload (default) then Overwrite. A's content intact."
    why_human: "G-4 (CLAUDE.md workflow guardrails) mandates live Chrome-driven UAT for user-visible surfaces; wire format + screenshot are explicitly insufficient. 186-VALIDATION.md lists this as 'to run', not yet executed."
  - test: "Stale tab — leave B open, edit + save in A, return to B minutes later and type"
    expected: "Same honest outcome as above. No silent overwrite, no retry storm."
    why_human: "Same G-4 requirement; 186-VALIDATION.md row 2 status is 'to run'."
  - test: "Publish race — start a publish in A, edit in B mid-gauntlet"
    expected: "Publish refuses with the worded draft_changed verdict; the golden-run receipt still browsable; the spine shows a block, not 8 green pips."
    why_human: "Same G-4 requirement; 186-VALIDATION.md row 3 status is 'to run'. Also the sharpest instance of the CR-01/WR-01 interleavings found above, since it spans a minutes-long server operation."
  - test: "Publish hold — start a publish in A, then edit in A"
    expected: "Status line reads 'Publishing — changes will save when it finishes'; the edit flushes on resolution."
    why_human: "186-VALIDATION.md row 3b status is 'to run'; also the exact scenario WR-03 (flag-off leak) and CR-01 interact with."
  - test: "KB re-bind, three paths — bind/re-bind from NL-generated, forked starter, and Tweak fork"
    expected: "The chip is a picker in all three; unbound state reads the invitation sentence with no severity/code/tray row; binding persists through autosave and survives reload."
    why_human: "186-VALIDATION.md row 5 status is 'to run'; BUG-260731-03's own frontmatter explicitly requires live confirmation before closing even the control half ('shipped, pending live confirmation')."
  - test: "Force a 422 mid-edit (invalid shape) and observe the save state"
    expected: "'Not saved — ...'; the draft stays dirty; the leave guard fires on navigate-away."
    why_human: "186-VALIDATION.md row 6 status is 'to run'. Automated unit coverage exists for this branch (F8), but the CR-01 finding above shows a DIFFERENT interleaving (concurrent edit, not shape-invalid) that the unit suite does not cover — live confirmation is still owed for the whole leave-guard chain end to end."
---

# Phase 186: Concurrency & Autosave Verification Report

**Phase Goal:** Continuous canvas autosave is safe on org-shared workflows — a cosmetic drag never mints a definition version or re-arms the golden-run gauntlet, and two editors cannot silently clobber each other. Closed before real usage, not discovered live.
**Verified:** 2026-08-01T06:10:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

This report does not repeat 186-REVIEW.md's findings uncritically. Every claim below marked
"independently confirmed" was re-derived by reading the actual source files listed, not by
trusting the review's prose.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CONCUR-01: a cosmetic node drag never mints a version or reaches the write path | ✓ VERIFIED | `canvasNudge.ts:75` imports only `getCurrentUserIdSync` — no store, no API client. `update_workflow_definition` (`backend/app/db/workflows.py:552-560`) is `SET name = $3, definition = $4::jsonb` — no `version` column in the SET clause, confirmed by direct read. |
| 2 | CONCUR-01: autosave updates the draft row in place, not via a new-version path | ✓ VERIFIED | Same query above is the only write path `useDraftPersistence` calls (`updateWorkflowDraft` → `PATCH /workflows/{id}`); no create-a-new-version branch exists in the autosave loop. |
| 3 | CONCUR-02: a stale writer is refused with a machine-readable code, never a false 404 | ✓ VERIFIED | `update_workflow_definition` docblock + code confirms the `AND {CONCURRENCY_TOKEN_SQL} = $5` conjunct alongside `created_by = $2` (never replacing it), and the disambiguating re-read on 0 rows branches `not_found` / `already_published` / `stale_token` per D-186-09. Backend suites `test_186_concurrent_patch.py` / `test_186_publish_race.py` exist and were reported passing by the orchestrator (284/284). |
| 4 | CONCUR-02: publish refuses a draft that drifted mid-gauntlet, preserving the golden-run receipt | ✓ VERIFIED | `publish_service.py` stage-5 flip carries the token (per plan + review); `blocked_stage` is free-form metadata on the already-registered `publish_blocked` event, no migration needed. Test `test_the_golden_run_receipt_survives_a_draft_changed_refusal` exists (though see WR-06 note below — it is DB-free but sits under a module-level `pytestmark` skip that also gates the seven live-DB tests, so it is silently absent in any CI without local Postgres — a coverage gap, not a functional failure. Not scored as a blocking gap here because the underlying behavior is independently traceable in code, but flagged as a real coverage risk). |
| 5 | **Never a false `Saved ✓` — a refusal of any kind leaves the draft dirty** | ✗ FAILED | See gap #1. Independently reproduced by code trace: an edit landing mid-flight, before its own debounce timer matures, is silently dropped and the loop still files `{kind:"saved"}`. This is a direct falsification of the phase's central promise and of the plan's own must_have wording. |
| 6 | **At most one PATCH outstanding per draft at any instant** | ✗ FAILED | See gap #2. `overwrite()` and `reload()` bypass the `inFlightRef` single-flight check that `saveNow`/the debounce timer/the hold-release effect all respect. A double-click on the never-disabled Overwrite button issues two concurrent PATCHes. |
| 7 | **With `visual_workflow_canvas` OFF, the product is byte-identical to today (D-181-01, milestone HARD gate #1)** | ✗ FAILED | See gap #3. The hold-release effect in `useDraftPersistence.ts` does not check the `enabled` flag it is passed, and `renderPublish`/`setPublishInFlight`/the explicit Save button are all mounted unconditionally (pre-186 doors). This produces automatic PATCH behavior on the flag-off surface that did not exist before this phase. |

**Score:** 4/7 truths verified (57%)

Two additional Success-Criteria-level truths were checked and found unable to be verified
programmatically — they require live browser UAT per G-4 and are listed under Human
Verification below, not scored as pass/fail here: "SC#4 — the two-editor / parallel path is
exercised in UAT, a second editor gets an honest read-only banner or merge-safe outcome" and
"BUG-260731-03's control half works across all three creation paths, live."

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/db/workflows.py` — `update_workflow_definition` | token conjunct alongside owner scope, no version bump | ✓ VERIFIED | Confirmed by direct read; `SET name, definition` only. |
| `backend/app/db/workflows.py` — `publish_definition` | stage-5 token-guarded flip, `draft_changed` sentinel | ✓ VERIFIED (per review + plan cross-check; not independently re-derived line-by-line, backend suite green) |
| `backend/app/api/workflows.py` — `update_draft` route | 404 / 409 `already_published` / 409 `stale_token` three-way | ✓ VERIFIED (per review's explicit confirmation, backend suite green) |
| `frontend/src/hooks/useDraftPersistence.ts` | the whole persistence seam, single-flight, honest receipts | ⚠️ SUBSTANTIVE BUT NOT SAFE — exists, is wired, is exercised by tests, but independently confirmed to violate 2 of its own must_haves (CR-01, WR-01) |
| `frontend/src/hooks/useDraftPersistence.test.tsx` | F8/F9/F10/F11/F15 coverage | ⚠️ PARTIAL — covers the RED/GREEN shapes it was written against, but the shipped F9 test advances the fake clock only in the branch that already works; it does not cover the interleaving CR-01 reproduces (edit arriving before its own timer matures, mid-flight). |
| `frontend/src/components/workflows/PublishGauntlet.tsx` — `STAGES` table | superset of every `blocked_stage` the server can emit | ⚠️ ORPHANED GAP — the fail-open PROPERTY fix (`unknownBlock`) is real and correctly verified (F7 GREEN), but `grounding_fidelity` (`publish_service.py:239`) has no row in `STAGES` (confirmed: only 9 entries, no "Grounding" label/code). Not a false-green regression, but the single most likely real refusal renders as an unplaceable, fully-grey spine. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` — KB picker promotion (BUG-260731-03 control) | picker replaces the display-only chip, gated on `canvasEnabled` | ✓ VERIFIED as built; gating on `canvasEnabled` (rather than removing the old `boundFolderName &&` gate) is a deliberate, documented deviation from the plan's literal wording, made to protect D-181-01 — see Key Link Verification below. |
| `.planning/phases/186-concurrency-autosave/deferred-items.md` | records the folder_scope trap + BUG-260731-03 verdict-half deferral with re-open triggers | ✓ VERIFIED — file exists, both deferrals have concrete re-open triggers. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `WorkflowBuilderPage.tsx` (`kbAffordance`) | `updateWorkflowDraft` | `setProjectFolder` arms `dirty`, autosave PATCHes it | ✓ WIRED | Confirmed reachable: `setProjectFolder` writes `meta.project_folder_id` and arms `dirty` in one act (per 186-08-SUMMARY + `builderStore.ts` F14 test). |
| `useDraftPersistence`'s `enabled` prop | the debounce effect | `if (!enabled ...) return` | ✓ WIRED (partial) | The debounce effect correctly respects it. The hold-release effect does NOT — see gap #3. This is a PARTIAL wiring: one of two write triggers respects the flag, the other does not. |
| `renderPublish` / `setPublishInFlight` | `useDraftPersistence`'s `publishInFlight` arg | prop drilling, unconditional mount | ✓ WIRED, but this is exactly the leak — it is wired regardless of `canvasEnabled`, which is correct for the pre-186 Publish door but combines with the ungated hold-release effect to produce gap #3. |
| Deferral for D-186-17 (folder_scope unbind trap) | `PhaseFormPanel` staying read-only | a source-fence test | ✓ WIRED | `deferred-items.md` names the exact test (`WorkflowBuilderPage.header.test.tsx` — "PhaseFormPanel renders folder_scope, and writes it nowhere") that pins the precondition; not independently re-run here but the deferral itself is honestly recorded with a concrete re-open trigger, which is what was asked to be checked. |

### Data-Flow Trace (Level 4)

Not applicable in the usual sense (no dashboard/list rendering pipeline for this phase); the
relevant "data flow" is the write path itself, which is what Steps 3-5 above traced end to
end (edit → debounce/hold → PATCH → token adoption → receipt). That trace is what surfaced
gaps #1-3.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `update_workflow_definition` never bumps version | direct source read of the SQL literal | `SET name = $3, definition = $4::jsonb` — no version | ✓ PASS |
| `canvasNudge.ts` imports no store/API | `grep "^import" canvasNudge.ts` | single import, `getCurrentUserIdSync` only | ✓ PASS |
| `grounding_fidelity` absent from client `STAGES` but present server-side | `grep "grounding_fidelity" PublishGauntlet.tsx publish_service.py` | present in `publish_service.py:239`, absent from `STAGES` (9 entries, no match) | ✓ PASS (confirms WR-02) |
| `overwrite()`/`reload()` bypass single-flight | direct source read of `useDraftPersistence.ts:519-558` | neither checks `inFlightRef.current` before calling `performWrite()` | ✓ PASS (confirms WR-01) |
| hold-release effect checks `enabled` | direct source read of `useDraftPersistence.ts:477-490` | no reference to `enabled` in the effect body or its dependency array | ✓ PASS (confirms WR-03 is reachable in code, not just theorized) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` conventions apply to this phase (frontend/backend unit-test
phase, not a migration/CLI/tooling phase). Skipped per Step 7c's own scope guidance.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| CONCUR-01 | 186-01, 186-04, 186-06, 186-07, 186-08 | Autosave updates the draft row in place; cosmetic drag never mints a version or re-arms the gauntlet | ✓ SATISFIED at the level the requirement literally describes (version-minting, gauntlet re-arm). The AUTOSAVE MECHANISM built to deliver it (186-06/07) has the CR-01/WR-01/WR-03 defects above, which are safety defects in the delivery vehicle, not in the version/re-arm property itself. |
| CONCUR-02 | 186-01, 186-02, 186-03, 186-05, 186-06, 186-07 | Concurrency guard (soft-lock/optimistic token) protects the shared draft; publish guarded against a dirty draft | ⚠️ PARTIALLY SATISFIED. The server-side token mechanism (backend half) is solid and independently confirmed. The CLIENT half that is supposed to make the guard trustworthy in practice — "conflict halts writing, offers Reload/Overwrite, never a false Saved" — is undermined by CR-01 (false Saved receipt under a common interleaving) and WR-01 (the halt/overwrite mechanism itself is not single-flight-safe). SC#4 (live two-editor UAT) has not been run — see Human Verification. |

No orphaned requirements: `.planning/REQUIREMENTS.md:113-114` maps only CONCUR-01/CONCUR-02
to Phase 186, and both are claimed across the 8 plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/hooks/useDraftPersistence.ts` | 403-422, 457 | Silent-loss-with-false-receipt (CR-01) | 🛑 Blocker | Direct falsification of the phase's core safety promise. |
| `frontend/src/hooks/useDraftPersistence.ts` | 554-558, 519-540 | Missing single-flight guard in `overwrite`/`reload` (WR-01) | 🛑 Blocker | Concurrency guard's own escape hatches are not concurrency-safe. |
| `frontend/src/hooks/useDraftPersistence.ts` | 477-490 | Flag-off write leak (WR-03) | 🛑 Blocker | Violates D-181-01, this milestone's HARD gate #1, inherited by every phase after 181. |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | 141-151 | Missing `grounding_fidelity` stage row (WR-02) | ⚠️ Warning | Not a false-green regression (F7 property holds), but the commonest real refusal renders uninformatively. |
| `frontend/src/components/workflows/BuilderSaveRegion.tsx` | 103-112 | `held` state silent on flag-off surface (WR-04) | ⚠️ Warning | Save-draft button appears to do nothing during a publish, worse than pre-186 behavior. |
| `frontend/src/hooks/useDraftPersistence.ts` | 251-269 | 404-on-deleted-draft never halts the loop (WR-05) | ⚠️ Warning | Permanently doomed retries against a row that no longer exists. |
| `backend/tests/unit/test_186_publish_race.py` | 65-70 (module mark) | DB-free F6 guard skipped under the module-level live-Postgres skip (WR-06) | ⚠️ Warning | The phase's headline backend invariant (draft_changed refuses a stale publish) has no DB-free CI coverage. |

No unresolved `TBD`/`FIXME`/`XXX` debt markers found in the files reviewed (checked via
186-REVIEW.md's file list cross-referenced with the above reads; none of the Blocker/Warning
items above are debt-marker violations — they are logic defects in shipped code, which is a
stronger finding, not a weaker one).

### Human Verification Required

See YAML frontmatter `human_verification` — six items, all sourced directly from
`186-VALIDATION.md`'s own "Manual-Only Verifications" table, which the phase's own
validation strategy marks as **"to run"**, not run. None of rows 1-3, 3b, 5, or 6 have been
executed. These are G-4-mandated (live Chrome-driven) and cannot be satisfied by wire-format
or automated-suite evidence per the project's own workflow guardrails.

### Gaps Summary

The phase's backend half (the optimistic-concurrency token, the owner-scoped guarded UPDATE,
the three-way honest refusal, the publish-stage token guard) is solid and independently
verified — CONCUR-01's literal "no version mint" claim and the server-side half of CONCUR-02
both hold up to direct code inspection, not just to the review's prose.

The phase's own reason for existing — closing autosave risk "before real usage, not
discovered live" — is not met on the frontend. Three independently-reproduced defects sit in
the exact hook (`useDraftPersistence.ts`) this phase built to be the trustworthy seam:

1. **CR-01** — a common edit interleaving (type, pause ~1s, resume, stop) is silently
   dropped while the surface reports `Saved ✓`, and every downstream leave-guard mechanism
   (in-app prompt, `beforeunload`, blur rescue) is disarmed by the same false receipt. This
   directly contradicts the plan's own must_have wording for 186-06 ("NO false Saved ✓ is
   ever filed") and the phase's own docblock ("A refusal — of any kind — leaves the draft
   dirty").
2. **WR-01** — the conflict banner's own escape hatches (`overwrite`, `reload`) are not
   single-flight-safe, so the mechanism built specifically to resolve a concurrency conflict
   can itself manufacture a spurious one on an ordinary double-click.
3. **WR-03** — the hold mechanism that gates writes on the `enabled`/`visual_workflow_canvas`
   flag has a code path (hold-release) that ignores the flag entirely, producing new
   automatic write behavior on the flag-off surface — a direct hit against D-181-01, the
   milestone's HARD gate #1, which every phase after 181 is required to inherit unbroken.

None of these three were caught by the 1864/1864 frontend or 284/284 backend green suites —
they are interleaving/ordering defects the shipped tests do not exercise, which is exactly
why goal-backward code verification (rather than trusting suite-green + SUMMARY claims) was
warranted here.

**This is not a task-completion problem.** All 8 plans' tasks are done, committed, and their
individual unit tests pass. It is a goal problem: "safe" is the literal word in the phase
goal, and three of the seven observable truths derived from the phase's own must_haves and
success criteria are independently confirmed false in the shipped code.

BUG-260731-03 was checked separately and found to be handled exactly as documented — `status:
folded` (not `closed`), `verified_closed_by: null`, and the 2026-08-01 report update honestly
states "NOT verified. No live browser run, no live DB row, no golden run, no judge." This is
the honest state, not a gap.

**This looks intentional in one place, not accepted here.** The 186-08 deviation (gating the
KB picker on `canvasEnabled` instead of removing the `boundFolderName &&` gate as the plan's
literal wording said) is a defensible, documented choice made specifically to protect
D-181-01 — and it is recorded with a re-open trigger in `deferred-items.md`. No override is
needed for it because it is not a failure to close; it is correctly scoped and does not
appear in the gaps list above.

---

_Verified: 2026-08-01T06:10:00Z_
_Verifier: Claude (gsd-verifier)_
