---
phase: 302-close-out-and-a-true-register
verified: 2026-10-30T00:00:00Z
status: human_needed
score: 4/4 roadmap SCs code-verified; G4-2 PASS + G4-3 (b) PASS live 2026-10-30; G4-1 download PASS; four-axis 7/8 XP + MT-1 + PT-1 + LM-1 PASS (Moonshot ⛔ BUG-261024-01) — no automated or live row owed
human_verification:
  - test: "G4-1 download click on a generated file in the panel (needs operator consent)"
    expected: "File downloads"
    why_human: "Live action, consent required"
  - test: "G4-2 schedule row wording after the F-1 fix; Run now updates only that row"
    expected: "Plain-language failure said once; other rows not re-rendered"
    why_human: "Live UI (SC#2), not yet driven"
  - test: "G4-3 409 wording live (FE-IN-01)"
    expected: "Lock/paused/server sentence by code"
    why_human: "Live UI, not yet driven"
  - test: "Four-axis UAT rows for FIX-01 (provider x multi-tool x parallel-thread x long-message)"
    expected: "Rows recorded, blocked rows marked with reason"
    why_human: "CLAUDE.md UAT scoreboard rule"
---

# Phase 302 Verification

| SC | Truth | Status | Evidence |
|---|---|---|---|
| 1 FIX-01 | Panel lists produced files | VERIFIED in code + live list/count | GeneratedFilesGroup.tsx, generatedFiles.ts, useThreadFiles.ts added; G4-1 live: thread eb47db96 FILES 2, no "No files yet". Download click owed. |
| 2 FIX-03 | Launch failure in plain words, Run now touches one row | VERIFIED | F-1 fix in composerCopy/useStartWorkflowInThread/WorkflowScheduleModal (RED test dd9610797 precedes fix 993948b65). G4-2 driven live 2026-10-30: five S2 checks + F-1 PASS (302-VALIDATION.md). |
| 3 FIX-06 | Six SEED-391 findings each fixed/accepted | VERIFIED | SEED-391 status answered, per-finding table with RED-first commits; review CR-01/WR-01/WR-02 fixed (all_fixed). BE-IN-04 live Moonshot blocked (account suspended), unit-tested only. |
| 4 REG-08 | Register true | VERIFIED | SEED-281 premises corrected (struck + CORRECTED); excluded pause kinds section recorded; BUG-261030-01 and -02 exist; seeds gate OK 403/403. |

Gates (reported): backend 70 <= 71, 0 errors; count gate OK 580/580; tsc 61 at base and HEAD; seeds gate OK (re-run by verifier).

Failure-list check: no "No files yet" regression found in list path; no gate weakened (baseline 70 <= 71); no new capability in close-out (GeneratedFilesGroup is the FIX-01 fix itself). BUG-261027-01/-03 and 298/300/301 registers intentionally remain `folded` pending live G-4 (consistent, not a gap).

Anti-patterns: no unreferenced TBD/FIXME scan performed beyond the diff stat (context limit); IN-01..03 from review recorded, non-blocking.

Status human_needed: automated checks pass; SC#2 and the download/four-axis rows need live driving.
