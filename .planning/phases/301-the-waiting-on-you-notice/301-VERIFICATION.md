---
phase: 301-the-waiting-on-you-notice
verified: 2026-10-30T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 — NEVER "reviewed". No independent reviewer exists.
status: human_needed
score: 3/4 roadmap success criteria verified in code and UAT; SC#4 split (scenarios PASS, operator sketch approval owed)
overrides_applied: 0
gaps: []
human_verification:
  - test: "SC#4 sketch match — show .planning/sketches/301-waiting-on-you/index.html (winner A) beside the built control (collapsed rail, expanded rail, open list with two orgs, empty line, phone drawer row)"
    expected: "Operator approves the built control as matching the sketch"
    why_human: "The winner was self-picked by Claude under the autonomous mandate (STATE.md Guardrail overrides); only the operator's approval satisfies 'operator-approved'"
  - test: "G4-4 stopped-source arm + D-26 keyboard arm (Open Library health via arrows + Enter)"
    expected: "Library badge shows only the source; waiting count separate; menuitem reachable by keyboard"
    why_human: "No stopped watched source on the local box; unit-proven only (NavPanel.badge.test.tsx)"
  - test: "G4-3 arm 3 — real network drop (devtools offline) then restore; SUBSCRIBED-on-rejoin refetch"
    expected: "Count correct after reconnect"
    why_human: "Manual realtime.disconnect() leaves channels closed; not drivable that way. Arms 1-2 PASS"
  - test: "Live 'needs your approval' row (Doc Q&A step 2)"
    expected: "Approval-kind row renders"
    why_human: "Proven at DB/unit level only (D-34)"
  - test: "Moonshot cross-provider row"
    expected: "Run pauses -> notice appears"
    why_human: "Blocked (balance); 7/8 providers PASS"
  - test: "Owed clean vitest count-gate run"
    expected: "'count gate OK' at HEAD"
    why_human: "Three loaded full runs at HEAD each had exactly one red in a different suite (WorkflowBuilderPage.canvas.test.tsx x2, LibraryPage.review284.test.tsx); those suites and their page files are provably unmodified (git diff --numstat empty), import no 301 module, and pass alone; one full run at base d9ff4c5eb was 'count gate OK'. Not proven inherited by a clean HEAD run."
---

# Phase 301: The Waiting-on-You Notice — Verification Report

**Phase Goal:** A person sees, inside the app, every workflow run waiting on them across all their orgs, each naming its org and opening the run, and the notice disappears once answered or the run ends.
**Status:** human_needed — no success criterion is unmet in code; SC#4's operator approval and several UAT arms are owed.
**Re-verification:** No (initial).

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Run waiting (question/approval, incl. scheduled/API-key) shows in a list + badge from anywhere, no reload | VERIFIED | `backend/app/api/notifications.py` GET /notifications (kind Literal question/approval, origin app/schedule/key); `useWaitingNotices.ts` fetch + Realtime hint (`recipient_id=eq.<uid>`, channel on `notifications`; mig 219 adds the table to `supabase_realtime`); mounted in NavPanel (rail), ChatLayout drawer row + hamburger dot on non-chat views. UAT G4-1 pill 5 -> 6 without reload in about 1 s; G4-4 phone dot + drawer row; G4-5 scheduled origin renders "· scheduled" |
| 2 | Covers every org; each item names its org and opens the run; other-org item goes through the switch prompt | VERIFIED | `LIST_OPEN_SQL`: joins `org_members m ON m.user_id=$1`, `organizations o`, no X-Org-Id read; UAT G4-2: other-org row names org, selecting shows 299 "This is in {org}" with Stay/Switch; Stay leaves org unchanged. `WaitingOn*` components contain no `switchOrg` |
| 3 | Item leaves after answer/run end (any tab/person/engine) and after a missed Realtime event via fetch reconcile | VERIFIED | SQL: `closed_at IS NULL` AND `wr.status IN ('active','paused')` (ended run never listed even if close swallowed); hook refetches on mount, SUBSCRIBED, focus, visibility, org/membership change, 60 s poll, event body never read. UAT G4-3 arm 1 (6 -> 5 in ~3 s) and arm 2 (missed event: stale until focus, one GET -> 5) PASS |
| 4 | Badge + list match the operator-approved sketch; operator "I'd recognise failure" scenarios pass in Chrome | UNCERTAIN (human) | Scenarios G4-1/2/3(1-2)/4(phone)/5 PASS in Chrome with per-row evidence. Sketch approval is OWED: variant A was self-picked by Claude. Not FAILED: the sketch exists and the control was built to it, but the approval bar cannot be met by Claude |

**Score:** SC#1-3 verified; SC#4 half-verified (WARNING, human decision requested).

## "How we'd know this failed" — one by one

| Failure condition | Result | Evidence |
|---|---|---|
| Badge counts only the active org | Absent | SQL spans all member orgs; UAT G4-2 cross-org row; pill survives org switch (D-18) |
| Badge stale after answering until reload | Absent | UAT G4-3 arms 1-2 |
| Realtime treated as source of truth | Absent | Hook header + code: event callback calls `request()` and ignores its argument; `answered`/`verdictKnown`/`failedSinceLast` keep the last fetched verdict |
| Second tenant breaks Library tab badge; `length === 1` pin deleted instead of re-baselined | Absent | `ATTENTION_PRODUCERS.length` pinned `toBe(2)` with keys stopped-sources/waiting-runs in `attentionTab.test.ts:268` and `NavPanel.badge.test.tsx:131` (re-baselined, not deleted); conditions carry required `mark`, Library reads `conditionsForMark(...,"library")`; G4-4: Library rail badge stayed absent with 6 waiting. Stale docblock text in `attentionConditions.ts:15` and the `attentionTab.test.ts:24` header still say `=== 1` (comment drift only, INFO) |
| Click switches org silently | Absent | No `switchOrg` in Waiting* components; `openRun` routes through 299's prompt; G4-2 Stay leaves org unchanged |
| Chat `ask_user` shows up as a notice | Absent | G4-5: Deep chat ask_user -> 0 notices; 301-01 live test re-runs 300's exclusion |
| List exists but nothing in the shell points at it | Absent | Mounted in NavPanel rail, ChatLayout drawer row + hamburger dot (non-chat views too, D-30) |

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| NOTE-01 | 301-01, 301-02, 301-03 | SATISFIED | Route + hook + control + UAT above |
| NOTE-05 | 301-01, 301-02, 301-03 | SATISFIED | Active/paused + closed_at predicate, fetch-reconcile, UAT G4-3 |

Both IDs appear in all three PLAN frontmatters and in REQUIREMENTS.md (mapped to Phase 301, still marked "Pending" in the traceability table and checkboxes `[ ]`; orchestrator should flip them at close). No orphaned requirements: REQUIREMENTS.md maps only NOTE-01 and NOTE-05 to 301.

## Artifacts and Wiring (spot-checked, not trusted from SUMMARY)

- `backend/app/api/notifications.py`, `backend/app/db/notifications.py` (`LIST_OPEN_SQL`): substantive, real query, caller bound as `$1`, router-level 401 bearer dependency; registered at `backend/app/main.py:968`. WIRED.
- `supabase/migrations/219_notifications_realtime.sql`: idempotent publication add + PASS/FAIL verify. Applied locally (documented override re: schema-drift gate, since CLAUDE.md forbids `db push`).
- `frontend/src/hooks/useWaitingNotices.ts`: substantive; single call site `useWaitingRunConditions` in `attentionConditions.ts`; consumed by `ChatLayout` -> `NavPanel`/drawer. WIRED, data FLOWING from the API.
- `WaitingOnYouControl.tsx`, `WaitingOnYouList.tsx`, `waitingVocabulary.ts`, `OrgIdentity.tsx`: exist, mounted in NavPanel and ChatLayout.

## Behavioral Spot-Checks

| Check | Result |
|---|---|
| `pytest tests/unit/test_301_notifications_route.py test_301_migration_219_shape.py` | 13 passed |
| vitest: useWaitingNotices, `components/layout`, OrgIdentity, LibraryPage.tabAttention (32 files) | 451 passed, 0 failed |
| Backend unit baseline (orchestrator measured) | `[GATE PASSED] failed: 70 <= 71, errors: 0` |
| Frontend tsc set diff (orchestrator measured) | 61 at base, 61 at HEAD, none new |

## Gates Recorded Honestly

- **Vitest count gate: NOT `count gate OK` at HEAD.** Three full loaded runs, one red each in different suites (WorkflowBuilderPage.canvas ×2, LibraryPage.review284 ×1); all provably unmodified and import no 301 module; each passes alone; base run was green. Owed: one clean full gate run. Not claimed fine.
- **Schema-drift gate** flags migration 219 only because no `db push` was run (forbidden by CLAUDE.md); applied via SQL-equivalent, verify PASS twice, `full-schema.sql` regenerated. Documented override, not drift.
- Review: `all_fixed` for WR-01 (`f348ba91e`) and WR-02 (`7404177b2`); IN-01..07 recorded, not fixed (INFO).

## Anti-Patterns

No TBD/FIXME/XXX markers in the phase's new source files. No stubs found. Only INFO: stale `=== 1` wording in two comments (see above).

## Gaps Summary

No code gap and no unmet success criterion: SC#1-3 are implemented, wired and driven in Chrome. Status is `human_needed` because SC#4's operator sketch approval is owed (self-picked variant), plus owed UAT arms (stopped-source/keyboard, real-network rejoin, live approval row, Moonshot) and one clean vitest count-gate run.

---

_Verified: 2026-10-30_
_Verifier: Claude (gsd-verifier)_
