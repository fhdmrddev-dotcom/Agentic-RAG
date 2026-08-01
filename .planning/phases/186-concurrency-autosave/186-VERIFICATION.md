---
phase: 186-concurrency-autosave
verified: 2026-08-01T10:07:31Z
status: gaps_found
score: 6/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/7
  gaps_closed:
    - "GAP-1 / CR-01 — never a false `Saved ✓`; the receipt is now gated on payload identity (`writtenPhases`/`writtenMeta`), not on a queue flag"
    - "GAP-2 / WR-01 — single flight is now a property of `performWrite` itself; both conflict exits additionally carry a re-entrancy guard and the banner survives its own resolution"
    - "GAP-3 / WR-03 — the hold-release effect now returns on `!enabled`, so no automatic write is reachable past the `visual_workflow_canvas` revert switch"
  gaps_remaining: []
  regressions:
    - "None in product behaviour. One test regression measured: `WorkflowBuilderPage.session.test.tsx > pane click — … ZERO PATCHes` now fails deterministically (3/3 runs, including fully isolated) — the 186-12 and 186-13 SUMMARY claim that it 'passes in isolation' is falsified on this machine."
  new_findings:
    - "GAP-4 / CR-02 — a transient failure inside `reload()` unmounts the conflict banner while leaving `haltedRef` set, permanently stranding the draft"
gaps:
  - truth: "D-186-08 — on conflict the loop halts and THE PERSON PICKS THE EXIT: Reload (default) and Overwrite (a deliberate second click) are always offered, and no control is ever a silent no-op (186-06 / 186-12 must_have; the WR-04 rule)"
    status: failed
    id: GAP-4
    closes_review_finding: CR-02
    reason: >
      Independently re-derived from source, not accepted from 186-REVIEW.md. `haltedRef.current`
      is set to `true` when the `stale_token` refusal arrives (`useDraftPersistence.ts:574`) and
      is cleared in exactly two places: `reload`'s SUCCESS branch (`:766`) and `overwrite` (`:803`).
      `reload`'s `catch` (`:770-771`) sets `{kind:"error", sentence: SAVE_FAILED_SENTENCE}` and its
      `finally` sets `resolving` back to false — it touches neither `haltedRef` nor
      `conflictTokenRef`. The banner that carries BOTH exits renders on
      `state.kind === "conflict" || resolving` (`BuilderSaveRegion.tsx:213`), and after the catch
      both operands are false, so the two controls leave the DOM in the same commit that the halt
      becomes permanent. Confirmed `BuilderSaveRegion` is the ONLY consumer of `onReload`/
      `onOverwrite` in non-test source (`WorkflowBuilderPage.tsx:1693-1694`), so there is no second
      surface offering an exit. From that state: `saveNow()` returns at `:711` without setting any
      state (the Save-draft button is enabled — `disabled={saving}` — and is a completely silent
      no-op, which is precisely the defect WR-04 was raised for and declared closed); the debounce
      effect returns at `:636` so no future edit ever schedules a timer; `dirty` stays true so
      `beforeunload` and the in-app leave guard both fire, telling the author they have unsaved
      work while giving them no mechanism to save it; and the sentence on screen is
      `SAVE_FAILED_SENTENCE`, which `DRAFT_GONE_SENTENCE`'s own docblock (`:189-197`) correctly
      identifies as a sentence that INVITES a retry — here the retry is structurally impossible.
      The trigger is ordinary and single-click: `listDraftWorkflows` throws on ANY non-2xx and on
      a dropped connection (`api.ts:3411`), so one flaky request, one token refresh, or one backend
      restart during a click on the RECOMMENDED DEFAULT exit is enough. The only recovery is
      leaving the Builder, which discards the on-screen work. No test drives a rejecting
      `listDraftWorkflows` — F19c (`useDraftPersistence.test.tsx:1184`) drives a double-click on
      Reload against a RESOLVING mock only.
    artifacts:
      - path: "frontend/src/hooks/useDraftPersistence.ts"
        issue: "Lines 743-776 — `reload`'s catch leaves `haltedRef` set and abandons the conflict state, so the halt outlives the only affordances that can clear it"
      - path: "frontend/src/components/workflows/BuilderSaveRegion.tsx"
        issue: "Line 213 — the banner (and with it both exits) unmounts the instant the state leaves `conflict`, including on a FAILED exit"
    missing:
      - "In `reload`'s catch, restore the conflict rather than replacing it: `setState({ kind: \"conflict\", currentToken: conflictTokenRef.current })`. A failed EXIT is not a failed WRITE — the row still moved, the loop is still halted, and both ways out must still be on screen."
      - "If the surface should also say WHY the reload failed, that belongs as an extra line on the banner, never as a replacement for it."
      - "A regression test that rejects `listDraftWorkflows` once and asserts (a) the state is still `conflict`, (b) a subsequent edit still issues nothing (the halt is intact), and (c) a second `reload()` is accepted and succeeds."
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
    why_human: "`186-VALIDATION.md` row 3 status is still `to run`. It is the parallel axis's sharpest instance — it spans a minutes-long server operation, and it is where WR-08 and WR-10 interact."
  - test: "Publish hold — start a publish in A, then edit in A (flag ON), and repeat with `visual_workflow_canvas` OFF pressing Save draft mid-publish"
    expected: "Flag ON: 'Publishing — changes will save when it finishes', and the edit flushes on resolution. Flag OFF: 'Publishing — not saved; press Save draft again when it finishes' — and after the gauntlet ends that sentence must not still be on screen (see WR-09)."
    why_human: "`186-VALIDATION.md` row 3b status is `to run`; the flag-off half is the live check for WR-09, which no automated test asserts."
  - test: "Conflict-exit failure — reach the conflict banner, then click Reload with the network interrupted (DevTools offline, or stop the backend for one click)"
    expected: "The banner is STILL on screen with both exits, and a second Reload after restoring the network succeeds."
    why_human: "This is GAP-4 / CR-02 observed live. Confirms the code trace above against the real product before and after the fix."
  - test: "KB re-bind, three paths — bind/re-bind from NL-generated, forked starter, and Tweak fork"
    expected: "The chip is a picker in all three; unbound reads the invitation sentence with no severity/code/tray row; binding persists through autosave and survives reload."
    why_human: "`186-VALIDATION.md` row 5 status is `to run`; BUG-260731-03's frontmatter requires live confirmation before closing even the control half."
  - test: "Force a 422 mid-edit (invalid shape) and observe the save state"
    expected: "'Not saved — …'; the draft stays dirty; the leave guard fires on navigate-away."
    why_human: "`186-VALIDATION.md` row 6 status is `to run`. F8 covers the branch in units; the whole leave-guard chain end to end is still owed live."
---

# Phase 186: Concurrency & Autosave — Verification Report (RE-VERIFICATION)

**Phase Goal:** Continuous canvas autosave is safe on org-shared workflows — a cosmetic drag never mints a definition version or re-arms the golden-run gauntlet, and two editors cannot silently clobber each other. Closed before real usage, not discovered live.
**Verified:** 2026-08-01T10:07:31Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plans 186-09 … 186-13 (previous: `gaps_found`, 4/7)

Every claim below marked "re-derived" was established by reading the named source lines or by
running the named command in this session. `186-REVIEW.md` was read as INPUT; each of its
findings that affects the verdict was confirmed or refuted independently.

## Gap-Closure Ledger (traceability preserved)

| Id | Original finding | Resolution | Evidence re-derived this session |
|----|------------------|------------|----------------------------------|
| **GAP-1 / CR-01** | mid-flight edit silently dropped; false `Saved ✓` filed | ✅ **CLOSED** | `performWrite` captures `writtenPhases`/`writtenMeta` at snapshot time (`useDraftPersistence.ts:544-545`) and the supersede test is now an identity compare, with `pendingRef` demoted to one of three reasons (`:592-594`). The two references genuinely cover the payload: `selectDefinition` is `{...state.meta, phases: state.phases}`. F17a/b/c hold the immature-timer interleaving open. **40/40 green**, run in isolation. |
| **GAP-2 / WR-01** | `overwrite`/`reload` bypass single flight | ✅ **CLOSED** | The guard has exactly one home, inside the writer (`:517-520`), above `inFlightRef.current = true`; no caller re-implements it. Both exits additionally carry `reloadingRef` (`:744`, `:798`) with the token assignment ordered AFTER the guard, and `resolving` keeps the banner mounted so the disabled state is visible (`BuilderSaveRegion.tsx:213`, `:224`, `:233`). F19a–d green. |
| **GAP-3 / WR-03** | hold-release wrote with the canvas flag off | ✅ **CLOSED** | `if (!enabled) return` at `useDraftPersistence.ts:698`, positioned after the `holdRef` mirror (`:695`) and after the halted check, before `heldPendingRef` is cleared and before `performWrite()`. F20a/b/c green. |
| **WR-02** | `grounding_fidelity` missing from `STAGES` | ✅ **CLOSED** | The row exists at its true pipeline position (`PublishGauntlet.tsx:165`) and `RUNNING_STAGE_INDEX` is derived (`:187`) rather than a literal. `unknownBlock` still guards BOTH `isPassed` (`:427`) and `connReached` (`:434`). 125/125 green across the four component suites. |
| **WR-04** | `held` invisible on the flag-off surface | ✅ **CLOSED at the component** | `quietLine` evaluates `held` before the flag gate (`BuilderSaveRegion.tsx:139-141`), and `HOLD_PUBLISHING_MANUAL` is a third honest sentence selected on the same input that decides the flush. Residue: WR-09 below (the hook never resolves the state flag-off). |
| **WR-05** | a deleted draft (404) neither halts nor exits | ✅ **CLOSED for 404** | `refusalOf` routes `WorkflowNotFoundError` to `DRAFT_GONE_SENTENCE` (`:350-352`) and `isTerminalRefusal` halts the loop (`:382-384`). Same class still open for the published-row 409 — WR-07 below. |
| **WR-06** | backend tests all vanish without Postgres | ⚠️ **PARTIALLY CLOSED** | Measured directly: with `POSTGRES_DSN` pointed at an unreachable port the three files report **3 passed / 9 skipped, exit 0**; with the live DB they report **12 passed**. So DB-free coverage went 0 → 3 and nothing fails for want of a database. But `grep -rn "stale_token" backend/tests/` still matches exactly ONE file, and that file is entirely `pytestmark`-skipped — the 409 wire shape the whole client conflict UX branches on has zero DB-free coverage. |
| **CR-02** *(new, this review)* | a failed `reload()` strands the draft permanently | 🛑 **CONFIRMED — new gap GAP-4** | See the gaps frontmatter. Re-derived line by line, including the sole-consumer check on the exits. |

## Goal Achievement

### Observable Truths

| # | Truth (source) | Status | Evidence |
|---|----------------|--------|----------|
| 1 | **SC#1 / CONCUR-01** — editing a draft autosaves by UPDATING THE DRAFT ROW IN PLACE; a cosmetic node drag never mints a version or re-arms the gauntlet | ✓ VERIFIED | `update_workflow_definition`'s guarded UPDATE is `SET name = $3, definition = $4::jsonb` (`backend/app/db/workflows.py:559`, `:571`) — no `version` in either SET clause; F13 exercises it against the live DB. `canvasNudge.ts` imports exactly one symbol (`getCurrentUserIdSync`) — no store, no API client. F12 ("a cosmetic nudge writes nothing WITH autosave live") passes: `WorkflowCanvas.editing.test.tsx` + `WorkflowBuilderPage.canvas.test.tsx` = **141/141 green**. |
| 2 | **SC#2 server half / CONCUR-02** — a stale writer is refused with a machine-readable code, never a false 404, and the owner scope is never replaced | ✓ VERIFIED | The token is a THIRD conjunct alongside `created_by = $2` (`db/workflows.py:560-561`), never in place of it; the disambiguating probe is owner-scoped (`:589-594`) and returns `not_found` / `already_published` / `stale_token` (`:596-605`); the route maps them to 404 / 409 / 409-with-token and the 404 carries NO machine code, so not-found and not-owned stay byte-identical (`api/workflows.py:1013-1035`). `CONCURRENCY_TOKEN_SQL` is the only rendering of the token — all 8 comparison sites go through the constant, none in datetime space. Backend: **12/12 pass** with the live DB. |
| 3 | **SC#3** — publish is guarded against reading a dirty draft, and the golden-run receipt survives the refusal | ✓ VERIFIED | Stage 0 captures `stage0_token` (`publish_service.py:122`), stage 5 flips with it (`:372`), and `publish_definition` returns a SEPARATE `-2` sentinel (`db/workflows.py:432`) which the service routes to `_block(stage="draft_changed")` (`:405`) — a `_block` only ADDS a `publish_blocked` receipt and carries `golden_run_id` through. `-1` and `-2` are never collapsed. F5/F5b/F5c/F6 green. Zero migrations: head is still `114_harness_audit_action_risk_pending.sql`. |
| 4 | **GAP-1 / D-186-04** — never a false `Saved ✓`; a refusal of any kind leaves the draft dirty | ✓ VERIFIED (was FAILED) | Receipt gated on payload identity, not on a queue flag. See the ledger above. |
| 5 | **GAP-2 / 186-06 must_have** — at most ONE PATCH outstanding per draft at any instant, each carrying the token the preceding write returned | ✓ VERIFIED (was FAILED) | Single flight enforced inside `performWrite`. See the ledger above. |
| 6 | **GAP-3 / D-181-01** — with `visual_workflow_canvas` OFF no AUTOMATIC write behaviour that did not exist pre-186 is reachable | ✓ VERIFIED (was FAILED) | `if (!enabled) return` in the hold-release effect. See the ledger above. Note the deliberate, documented asymmetry: `saveNow`/`reload`/`overwrite` stay ungated because a person pressed them. |
| 7 | **D-186-08 / 186-12 must_have** — on conflict the loop halts and THE PERSON PICKS THE EXIT; both exits stay offered and no control is a silent no-op | ✗ **FAILED** | **GAP-4 / CR-02.** A transient failure inside `reload()` — the DEFAULT exit — unmounts the banner (and with it both exits) while leaving `haltedRef` set. Save draft then returns at `:711` with no state change, the debounce schedules nothing, `dirty` stays true so both leave guards fire, and the sentence on screen invites a retry that is structurally impossible. Re-derived from source; no test covers the path. |
| 8 | **SC#4** — the two-editor / parallel path is exercised in UAT; a second editor gets an honest read-only banner or a merge-safe outcome, never a silent overwrite | ? **UNCERTAIN — human required** | `186-VALIDATION.md` rows 1, 2, 3, 3b, 5, 6 are all still `to run`. Row 4 (colleague clobber) is correctly recorded ⛔ BLOCKED-not-reachable with its reason rather than dropped — matching the CONTEXT landmine (mig 111 gave workflows `is_system_global`, and UPDATE is `created_by`-only, so the real conflict is one user with two tabs, which rows 1-3 cover). G-4 makes this non-substitutable by wire-format or unit evidence. |

**Score:** 6/8 truths verified · 1 FAILED (blocker) · 1 UNCERTAIN (human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/db/workflows.py` | `CONCURRENCY_TOKEN_SQL`, token-guarded UPDATE, owner-scoped probe, `-1`/`-2` pair | ✓ VERIFIED | Re-read in full. Owner scope never replaced; no version bump; both sentinels distinct. |
| `backend/app/api/workflows.py` — `update_draft` | optional `If-Match`, three-way refusal, code-less 404 | ✓ VERIFIED | Re-read `:942-1036`. The `Annotated[...] = None` header form is deliberate and documented. |
| `backend/app/services/harness/publish_service.py` | stage-0 capture → stage-5 guarded flip → `draft_changed` block | ✓ VERIFIED | Re-read `:122`, `:372-412`. |
| `frontend/src/hooks/useDraftPersistence.ts` | the whole write seam: single flight, honest receipts, honest refusals, `enabled` gate | ⚠️ **SUBSTANTIVE, WIRED, BUT ONE EXIT PATH UNSAFE** | Three of its four prior defects are genuinely fixed as PROPERTIES (not patches). GAP-4 sits in `reload`'s catch. WR-07/WR-08/WR-09 are further warnings below. |
| `frontend/src/hooks/useDraftPersistence.test.tsx` | F8/F9/F10/F11/F15 + F17/F19/F20 | ✓ VERIFIED (with a coverage hole) | **40/40 green in isolation.** F17 drives the immature-timer branch (`AUTOSAVE_DEBOUNCE_MS / 2`), which is the branch the old F9 missed. Hole: no test rejects `listDraftWorkflows` (GAP-4), and no test bounds the sustained write RATE (WR-08). |
| `frontend/src/components/workflows/BuilderSaveRegion.tsx` (+ test) | four sentences, the banner, `resolving`-aware disable | ✓ VERIFIED | Re-read. `held` correctly evaluated before the flag gate. The `|| resolving` render clause is what makes the disable visible — and is also the clause GAP-4 falls through. |
| `frontend/src/components/workflows/PublishGauntlet.tsx` (+ test) | a spine naming every server stage; fail-open closed as a property | ✓ VERIFIED | `grounding_fidelity` row present; `RUNNING_STAGE_INDEX` derived; F18 extracts the stage literals from the Python source at test time. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` — KB picker (BUG-260731-03 control) | picker replaces the display-only chip; unbound is an INVITATION | ✓ VERIFIED | `:1605-1663` — a real `<select>` calling `store.getState().setProjectFolder(...)` + `setHasEdited(true)`, `UNBOUND_KB_INVITATION` as the empty option. The `canvasEnabled` gate is a documented deviation taken to protect D-181-01, recorded in `deferred-items.md` §3 with a re-open trigger. |
| `.planning/phases/186-concurrency-autosave/deferred-items.md` | folder_scope trap + BUG-260731-03 verdict half + the flag-off cost, each with a re-open trigger | ✓ VERIFIED | Four entries, all with concrete triggers. |
| `.planning/reported-bugs/BUG-260731-03-…md` | honest status | ✓ VERIFIED | `status: folded`, `verified_closed_by: null`, `folded_into: "186 (control) / 187 (verdict)"`. Not prematurely closed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `update_draft` route | `update_workflow_definition` | `token=if_match` | ✓ WIRED | `api/workflows.py:1002-1004`. |
| `db/workflows.py` | `workflow_definitions.updated_at` | `CONCURRENCY_TOKEN_SQL` in WHERE + RETURNING | ✓ WIRED | 8 sites, all via the constant; no bypass, no datetime-space compare. |
| `publish_service` stage 0 | stage 5 | `stage0_token` → `publish_definition(token=…)` | ✓ WIRED | `:122` → `:372`. |
| `useDraftPersistence` | `updateWorkflowDraft` | single-flight queue carrying `tokenRef.current` as `If-Match` | ✓ WIRED | `:564-569`; `api.ts:3440-3443` adds the header only when a token exists. |
| a confirmed 200 | `store.markSaved()` | the identity-gated completion handler, and nothing else | ✓ WIRED | Exactly one `markSaved()` call site (`:612`), guarded by `:593-594`. |
| `enabled` prop | BOTH write triggers | early return in the debounce effect AND in the hold release | ✓ WIRED | `:634` and `:698`. This was the PARTIAL wiring the previous report failed; it is now complete for automatic paths. |
| `useDraftPersistence.resolving` | the banner's two buttons | prop through `WorkflowBuilderPage` | ✓ WIRED | `WorkflowBuilderPage.tsx:1687-1694` → `BuilderSaveRegion.tsx:213, 224, 233`. |
| `reload()` failure | the conflict banner | *(nothing)* | ✗ **NOT WIRED — GAP-4** | The catch abandons `conflict` for `error`, and the banner's render condition drops both operands, so the only two exits leave the DOM on a failed exit. |
| `setProjectFolder` | `dirty` → autosave PATCH | one `set()` writing `meta` and `dirty` together | ✓ WIRED | `builderStore.ts` F14 + the page call site `:1618-1621`. |

### Data-Flow Trace (Level 4)

The "data" this phase moves is the write itself, so Level 4 is the write path traced end to
end rather than a render pipeline: **edit → store mutation (`dirty` armed) → debounce timer →
`performWrite` snapshot (`phases`/`meta` captured) → PATCH with `If-Match` → server guarded
UPDATE (owner + draft + token) → new token adopted → identity re-compare → `markSaved()`**.
Every hop was re-derived. The trace is real end to end and produces real data (the live-DB
tests observe an actual row change and an actual token rotation). The trace surfaced GAP-4 at
the EXIT of that path, not in the path itself.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| The phase's own hook suite | `npx vitest run src/hooks/useDraftPersistence.test.tsx --testTimeout=30000` | **40 passed / 40**, 9.1 s | ✓ PASS |
| The four component/transport suites | `npx vitest run …BuilderSaveRegion.test.tsx …PublishGauntlet.test.tsx …builderStore.test.ts src/lib/api.workflows.test.ts --testTimeout=30000` | **125 passed / 125** | ✓ PASS |
| The canvas suites (F12) | `npx vitest run …WorkflowBuilderPage.canvas.test.tsx …WorkflowCanvas.editing.test.tsx --testTimeout=30000` | **141 passed / 141** | ✓ PASS |
| The page suites | `npx vitest run …WorkflowBuilderPage.header.test.tsx …WorkflowBuilderPage.session.test.tsx --testTimeout=30000` | **49 passed, 1 FAILED** | ✗ FAIL — see WR-11 |
| Same, session suite ALONE | `npx vitest run src/pages/WorkflowBuilderPage.session.test.tsx --testTimeout=30000` | **22 passed, 1 FAILED** (same test, 1785 ms) | ✗ FAIL — falsifies the SUMMARY claim |
| Same, six-file consumer set | `npx vitest run …useDraftPersistence …BuilderSaveRegion …builderStore …session …canvas …header` | **233 passed, 1 FAILED** (same test) | ✗ FAIL — 3/3 configurations |
| Backend, phase files, live DB | `pytest tests/unit/test_186_concurrent_patch.py test_186_publish_race.py test_103_published_409.py -q` | **12 passed** in 3.9 s | ✓ PASS |
| Backend, phase files, DB UNREACHABLE | same with `POSTGRES_DSN=…:59999` | **3 passed, 9 skipped**, exit 0 | ✓ PASS (WR-06 half-closed; nine live tests, not seven) |
| Zero migrations | `ls supabase/migrations \| tail -1` | `114_harness_audit_action_risk_pending.sql` | ✓ PASS |
| Token never parsed (F15 property) | `grep -n "new Date\|Date.parse" useDraftPersistence.ts` | no matches | ✓ PASS |
| Debt markers in the 10 touched source files | `grep -n "TBD\|FIXME\|XXX"` | no matches in any file | ✓ PASS |
| `stale_token` wire shape has DB-free coverage | `grep -rn "stale_token" backend/tests/` | one file only, and it is fully `pytestmark`-skipped | ✗ FAIL — WR-06 residue |

Per the established measurement conditions, the frontend full suite was NOT used as a
single-number gate; every judgement above is per-file, in isolation, at a 30 s timeout.

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` convention governs this phase, and neither
the PLANs nor VALIDATION.md declare a probe. Skipped per the scope guidance.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|--------------|--------|----------|
| **CONCUR-01** | 186-01, 04, 06, 07, 08, 09, 12, 13 | Autosave updates the draft row in place; a cosmetic drag never mints a version or re-arms the gauntlet | ✓ **SATISFIED** | Truth 1 + truths 4/5/6. The version property is proven in SQL and by F13; the drag property by `canvasNudge`'s import list and F12. The delivery vehicle's three prior safety defects are closed. |
| **CONCUR-02** | 186-01, 02, 03, 05, 06, 07, 09, 10, 11, 12, 13 | Concurrency guard protects the shared draft; publish is guarded against a dirty draft | ⚠️ **PARTIALLY SATISFIED** | The server guard (truth 2), the publish guard (truth 3) and the client's halt-and-offer-exits mechanism are all real and re-derived. What is NOT satisfied: the exits are not durable — a failed Reload removes them permanently (truth 7 / GAP-4) — and the live two-editor UAT that SC#4 requires has not been run (truth 8). |

No orphaned requirements: `.planning/REQUIREMENTS.md:113-114` maps only CONCUR-01 and CONCUR-02
to Phase 186, and both are claimed in plan frontmatter. Both are still `Pending` in the
requirements table, which is correct — neither should be flipped to Complete while GAP-4 and
SC#4 are open.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/hooks/useDraftPersistence.ts` | 743-776 | Failed exit destroys the only exits (GAP-4 / CR-02) | 🛑 **Blocker** | A single click on the recommended default exit, plus one flaky request, permanently strands the draft. Save becomes a silent no-op — the exact defect WR-04 was raised for. |
| `frontend/src/pages/WorkflowBuilderPage.session.test.tsx` | 591 | Time-dependent assertion now red (WR-11, new) | ⚠️ Warning | `expect(mockUpdate).toHaveBeenCalledTimes(0)` fails deterministically (3/3 runs incl. fully isolated). Cause re-derived: the test types (arming a real 1000 ms debounce with `draftId: "draft-1"` seeded), then waits up to 10 s for the lazily-imported canvas pane; whenever that wait exceeds the debounce the autosave fires a legitimate PATCH. The two sibling rows (✕, Escape) assert the same thing, skip the lazy import, and pass. **This is a test defect, not a product defect** — but 186-12 and 186-13 both recorded "passes in isolation", and that claim is false on this machine. Fix: assert a call-count DELTA around the dismissal, or drive the dismissal under fake timers. |
| `frontend/src/hooks/useDraftPersistence.ts` | 382-384 | A published-row 409 is not terminal (WR-07) | ⚠️ Warning | `isTerminalRefusal` names only `WorkflowNotFoundError`. A published row is frozen by the DB trigger and can never become a draft again, so every subsequent edit re-issues a doomed PATCH for the life of the session — WR-05's own argument applied to the other terminal cause. Confirmed by reading the predicate. |
| `frontend/src/hooks/useDraftPersistence.ts` | 592-608 | The drain's `continue` defeats the debounce (WR-08) | ⚠️ Warning | Confirmed: the supersede test is now an identity compare, and `PhaseFormPanel`'s fields call `onChange` per keystroke into the store (which is exactly why the session test above PATCHes at all). So while an author types, each completed PATCH immediately re-enters the loop — write rate becomes one-per-round-trip, not one-per-1000 ms, contradicting the module's own `:50` and `:126` docblocks. Knock-on: every extra write mints a new token, so it manufactures the very conflicts this phase exists to prevent, and widens WR-10's window. No test bounds the rate (F17b asserts 2 calls for 2 edits — the right count for a single follow-up, silent about a sustained run). |
| `frontend/src/hooks/useDraftPersistence.ts` | 693-704 | The flag-off gate suppresses the state resolution, not just the write (WR-09) | ⚠️ Warning | Confirmed: on `!enabled` the effect returns before anything clears `{kind:"held"}`, and `BuilderSaveRegion` renders that sentence unconditionally (deliberately, per the WR-04 fix). So flag-off, the header keeps claiming *"Publishing — not saved; press Save draft again when it finishes"* after the gauntlet has ended — a false claim about system state. `heldPendingRef` is also left armed. Mitigating: `holdRef` IS mirrored before the return, so a later Save press does succeed; only the sentence lies. F20b asserts zero calls and never asserts what the surface says afterwards. |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | 581-598, 878-892 | Publish is not gated on an outstanding autosave write (WR-10) | ⚠️ Warning | Confirmed by construction: the hold stops NEW writes once `publishInFlight` is true but cannot recall an outstanding one, and nothing on the client refuses a gauntlet while `state.kind === "saving"`. A PATCH committing after stage 0's token read burns a full golden run for a publish that can only end in `draft_changed`. WR-08 widens the window. |
| `backend/tests/unit/test_186_concurrent_patch.py` | 52-55 | The `stale_token` 409 wire shape has no DB-free coverage (WR-06 residue) | ⚠️ Warning | Measured: `grep -rn "stale_token" backend/tests/` matches one file; that file is module-`pytestmark`-skipped. The client branches its ENTIRE conflict UX on `detail.code === "stale_token"` + `detail.token` (`api.ts:3459-3460`) and that half is covered only against a mock. The two halves can drift with every suite green. |
| `frontend/src/hooks/useDraftPersistence.ts` | 547-552 | `creatingRef` branch is now unreachable dead code (IN-01) | ℹ️ Info | With single flight inside `performWrite`, `creatingRef` can only be true within the same synchronous region that set it. The `setState({kind:"saving"})` still precedes it, so if it were ever reached the button would stick disabled. |
| `backend/app/api/workflows.py`, `frontend/src/lib/api.ts` | 961 / 3440-3443 | `If-Match` carries a bare non-entity-tag and a failed precondition answers 409, not 412 (IN-03) | ℹ️ Info | Off-spec use of a standard precondition header invites a proxy to normalise or strip it, at which point the guard silently disappears. |
| `backend/app/db/workflows.py` | 428-432 | `publish_definition`'s probe has no owner clause (IN-04) | ℹ️ Info | Explicitly accepted and documented in-code (T-186-02-02) — but the file's own stated rule at `:439` ("EVERY query self-scopes `created_by = $N`") is now literally false, which is what a future grep finds. |
| `frontend/src/pages/WorkflowsPage.tsx` | 297 | `definition: (draft.definition ?? {})` can seed `phases: undefined` (IN-06) | ℹ️ Info | Pre-existing, but it now sits on the autosave path, where the same value would be PATCHed straight back. |

No unresolved `TBD` / `FIXME` / `XXX` debt markers exist in any of the ten source files this
phase modified — checked directly, file by file.

### Human Verification Required

Seven items, in the frontmatter. Six are `186-VALIDATION.md`'s own "Manual-Only Verifications"
rows, every one of which is still marked `to run`; the seventh is the live observation of
GAP-4. **SC#4 is not inferable from any automated evidence** — G-4 makes live Chrome-driven
observation the acceptance bar for user-visible surfaces, and no wire-format or unit result
substitutes for it. Row 4 of that table (the literal "colleague clobber") stays ⛔ BLOCKED with
its reason recorded, which is the correct scoreboard behaviour and matches the CONTEXT
landmine: the reachable conflict is one user with two tabs, which rows 1-3 cover.

### Gaps Summary

**The three gaps this re-verification exists to check are genuinely closed, and closed as
properties rather than as patches.** Each was re-derived from source, not accepted from the
gap-closure SUMMARYs: the receipt now compares what was actually written; single flight now
lives inside the writer where no future caller can forget it; and the automatic flush now
reads the revert switch. WR-02, WR-04 and WR-05 are closed too. The backend half —
owner-scoped guarded UPDATE, opaque token, three-way honest refusal, token-guarded publish
flip with a preserved golden-run receipt, zero migrations — holds up to direct inspection and
to a live-DB run.

**One new blocker replaces them.** GAP-4 (the review's CR-02) is the same failure mode this
phase has now met three times, in a third place: a mechanism that is honest on its success
path and silently destructive on its failure path. `reload()` is the DEFAULT exit the banner
recommends. When it fails for any transport reason — one dropped connection, one token
refresh, one backend restart — it replaces the conflict state with a generic error, the banner
unmounts, and the halt it was supposed to clear becomes permanent. From there the Save-draft
button is enabled and does nothing at all, no edit ever schedules a write again, and both
leave guards fire to tell the author about work they now have no way to save. The sentence
shown invites exactly the retry that is structurally impossible. The fix is three lines and is
named in the review; the missing test is one rejecting `listDraftWorkflows`.

**Four warnings are worth reading before the next phase touches this file**, because two of
them interact: WR-08 (the drain's `continue` gives back the debounce, so a typing author holds
a PATCH outstanding far more of the time than 1000 ms implies) directly widens WR-10 (nothing
stops a gauntlet from starting while a write is outstanding, which burns a full golden run for
a publish that can only be refused). WR-07 leaves a doomed retry loop on the published-row
409. WR-09 leaves a false "Publishing —" claim on the flag-off header after the gauntlet ends.

**A measurement claim in the SUMMARYs is false and should not be inherited.**
`WorkflowBuilderPage.session.test.tsx > pane click — … ZERO PATCHes` fails deterministically
here in three separate configurations including full isolation, while 186-12 and 186-13 both
record it as parallel-load flake that "passes in isolation". The product behaviour is correct
(the PATCH is a legitimate autosave one second after the author typed); the TEST encodes its
claim as an absolute call count over an interval that now routinely exceeds the debounce. It
is a warning, not a blocker — but the next reader must not take "passes in isolation" on
trust, because it does not.

**This is not a task-completion problem.** All thirteen plans' tasks are done and committed,
and every suite that this phase owns is green except the one time-dependent row above. It is a
goal problem, and a narrower one than last time: seven of the eight observable truths hold,
the eighth (SC#4) is owed live, and the failed one is a single failure path inside the exit
mechanism that CONCUR-02's client half depends on.

---

_Verified: 2026-08-01T10:07:31Z_
_Verifier: Claude (gsd-verifier)_
