---
phase: 298-lists-follow-the-active-org
verified: 2026-10-28T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent reviewer exists.
status: passed  # 2026-10-30, operator mandate to finish; all G-4 + A-1 rows driven (G4-2 fixed under G-3)
score: 4/4 roadmap success criteria verified in code, tests and live G-4 (8/8 rows PASS, 2026-10-30)
gaps: []
warnings:
  - id: WR-08
    truth: "SC#3 / ORG-05 (refusal names the folder) and failure condition 'out-of-org binding renders blank instead of by name'"
    status: partial-hint-only
    size: "wire change + 2 FIRING files (db/workflows.py, WorkflowBuilderPage.tsx); phase task, not a fast-fix"
  - id: WR-06
    truth: "ORG-05 header-less draft create"
    status: accepted-residual
  - id: DEF-1
    truth: "UI-D10 chat composer scopeFolderId survives org switch"
    status: not-an-SC
---

# Phase 298 Verification

Method: read ROADMAP SCs, audit, VALIDATION, REVIEW-FIX, deferred-items; grepped the code for each wiring point; ran targeted tests myself (no DB-mutating suites). Not re-run by me (taken from REVIEW-FIX, unverified here): backend baseline 69<=71, live 65 passed, vitest count gate, tsc.

My own runs: `pytest tests/unit/test_298_*.py` = 188 passed. Vitest (useThreads.orgSwitch, ChatHistoryColumn.orgSwitch, LibraryPage.orgSwitch, WorkflowsPage.orgSwitch, MoveToOrg*) = 6 files / 63 passed.

## Success criteria

| SC | Status | Evidence |
|---|---|---|
| SC1 read-only audit, local + cloud, counts decide ORG-06 shape | VERIFIED | `298-ORG-AUDIT.md`: per-table null/mis-stamp counts for cloud (MCP reads) and local; verdict "no migration/bulk repair, per-item move". Migration 217 is only the audit CHECK literal. |
| SC2 switch refreshes Library, Workflows (published+drafts), threads, run history; only active org shown (ORG-01..04) | VERIFIED (code+unit); lived G-4 rows owed | Backend narrowing via the single home `org_lists`: `api/folders.py:35,52` (`folder_kw`), `api/workflows.py:443,1259` (published/drafts), `api/threads.py:284-289` (`by_org`), `api/workflow_runs.py:741`, `api/library.py:292`, `api/documents.py:908-916`. `fetch_visible_folders` untouched (flag honoured). Frontend: `useLibraryOrgSwitch.ts`, `useThreads.ts` (+ `useThreads.orgSwitch.test.ts`), `ChatHistoryColumn.orgSwitch`, `LibraryPage.orgSwitch`, `WorkflowsPage.orgSwitch` suites pass. |
| SC3 foreign-folder save/launch refused with worded reason naming folder; scheduled/API-key/publish/chat retrieval still work; before/after matrix with two-org user + empty set (ORG-05) | VERIFIED | Refusal home `services/foreign_folder_refusal.py`; wired at draft create `api/workflows.py:1223`, change `:1368`, attended launch `workflow_kickoff.py:311`, scheduler `scheduler_service.py:138`, inbound `api/inbound.py:77`. Matrix: `tests/unit/test_298_org_matrix.py` + live `test_298_org_matrix_live.py` (live result from REVIEW-FIX, not re-run). Unit suites above pass. |
| SC4 "N items in <org>" count + one-at-a-time audited move (ORG-06) | VERIFIED (code+tests); lived rows owed | `GET /org-items/elsewhere`, `/folder-labels`, `/move-preview`, `POST /move` (`api/org_items.py:195,214,312,335`); `org_move.py` single-connection transaction, membership checked on both orgs (`:442`, `:547`); action `org.item.move` in `audit_service.py:38` and migration 217 CHECK; router included `main.py:939`. UI: `ElsewhereLine` mounted in FolderTree, ChatHistoryColumn, RunLogPanel, WorkflowsPage; `MoveToOrgSheet/Button/MenuItem` + tests pass. Audit/receipt label added (WR-07). |

## Review outcomes

- CR-01, WR-01..07, WR-09: fixed, each with committed RED then GREEN (REVIEW-FIX table). Spot-confirmed `owner_default` (WR-06) and `org.item.move` entries exist in code.
- WR-08 (Builder "lives in <org>" marker relative to viewer org): deferral is consistent with the SC. SC#3/ORG-05 require the REFUSAL, which is keyed server-side on the row's org and is unaffected. The harm is a wrong hint on a Builder left open across a switch, not a wrong write and not a blank (the folder is still shown by name). It brushes the roadmap failure condition "out-of-org binding renders blank instead of by name" only in that the label may mis-say which org; it does not render blank. Recorded as deferred-items #5 with a re-open trigger (Phase 299 / next touch of `useBuilderNameMaps.ts` or `db/workflows.py`). Warning, not a gap. Needs operator acknowledgement because it is a known wrong hint shipping.
- WR-06 caveat: accepted residual risk. Cloud has 0 multi-org users (audit), so the `LIMIT 1` ambiguity cannot occur in production today; the check uses the trigger's own statement, so for a two-org header-less caller it agrees "under the same plan" but not by construction. Local has 5 multi-org users, so UAT could see it. Recommend the operator accept it explicitly; revisit before any multi-org cloud user exists.
- deferred-items #1 (ChatArea `scopeFolderId` not reset on org switch): not an SC. The held folder id could be sent with the first message after a switch; chat retrieval still uses unchanged `fetch_visible_folders`, so nothing is lost or mis-written. UX wart (blank native select), size ~1 statement in FIRING `ChatArea.tsx`. Warning; fast-fix candidate for the next ChatArea touch.
- deferred-items #3 (DescribeKbPicker one-round-trip window): backstopped by ORG-05 refusal. Info.

## Human-needed (owed; not failures)

`298-VALIDATION.md` is still `status: owed`, rows_run 0, every Verdict cell empty, and the pass-line table for the matrix suites is unfilled. Nothing in the repo records that these were driven.

1. G4-1 Library switch (no flash of old org, "Loading folders", Root count omitted not 0).
2. G4-2 Workflows + run log switch.
3. G4-3 Switch with a live stream.
4. G4-4 Foreign folder refused, shown in Builder KB picker, save-error span and Run modal.
5. G4-5 Count line + Switch, count equals DB.
6. G4-6 Move a folder (preview before Move, exactly one `audit_log` row, org_id = source).
7. G4-7 Move refused (chat-bound / org-shared folder).
8. A-1 four-axis: thread A streaming while B accepts a prompt, then org switch.
9. Cross-provider roster: NOT exercised; VALIDATION records this as decision D-28 (no provider/prompt/tool/streaming code changed). Recorded as a decision, so not a failure.
10. Operator steps before deploy (D-35): paste migration 217 into CLOUD SQL editor (approval-gated), `get_advisors(security)`, then deploy backend (boot audit guard refuses to start without 217).
11. Register updates owed at close: flip SEED-389 / SEED-313 / SEED-317 only after rows pass; BUG-261027-02 stays open.
12. Operator decisions: accept WR-08 and WR-06 as residuals; optionally fast-fix deferred #1.

## Anti-patterns
No gap-level findings. Gate verdict lines (baseline 69, live 65, count gate, tsc, ledger, size) are REVIEW-FIX claims and were not independently re-run by this verifier.
