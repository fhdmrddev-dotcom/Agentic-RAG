---
phase: 302
slug: close-out-and-a-true-register
status: planned
created: 2026-10-30
nyquist_validation: false   # config.json; this file holds the UAT rows the CLAUDE.md scoreboard rule requires
---

# Phase 302 — Validation: automated map, G-4 lived experience, four-axis UAT, register routing

The automated tests live in the plans (`302-01` … `302-03`). This file holds what code cannot prove:
the operator-recognisable G-4 scenarios set at scope time (D-19), FIX-01's four-axis rows (D-20, CLAUDE.md
"UAT scoreboard recipe"), and how the register routes at close. **Every row below is OWED — Claude drives
them in Chrome after the merge.** A row may be blocked (⛔ with the reason and the blocking id), but never
silently omitted.

## 1. Automated coverage (where each requirement is proven in code)

| Req | Proven by | Plan |
|-----|-----------|------|
| FIX-01 | `generatedFiles.test.ts`, `useSandboxDownload.test.tsx`, `GeneratedFilesGroup.test.tsx`, `FilesSection.test.tsx`, `WorkspacePanel.test.tsx`, `OutputFileCard.baseline.test.tsx` (unchanged, green) | 302-01 |
| FIX-06 | the six RED-first cases: BE-IN-01 / BE-IN-03 / BE-IN-04 in `test_296_judge_note_and_tasks.py`, `test_296_golden_inputs_and_lint.py`, `test_296_moonshot_schema.py` (RED `968d0b84d`); FE-IN-01 in `useStartWorkflowInThread.test.tsx`, `ThreadWorkflowPicker.test.tsx`, `streamsProvider.test.tsx` (RED `f9d06ab3c`); FE-IN-04 / FE-IN-06 in `DescribeTemplateRow.test.tsx`, `TeamPicture.test.tsx`, `teamVocabulary.test.ts` (RED `a0f831efa`) | 302-02 |
| FIX-03 | `WorkflowScheduleModal.test.tsx` (300-01 cases + the two 302-03 F-1 cases, RED `dd9610797`), `scheduleOutcomeVocabulary.test.ts` | 302-03 |
| REG-08 | `node scripts/check-seeds-register.cjs` exit 0 + the scratchpad reported-bug key check (no repo script, RESEARCH F8) | 302-03 |

## 2. G-4 lived-experience scenarios (D-19 — set at scope time; Claude drives Chrome after merge)

The dev account is in TWO orgs — prove the active org first. Each row carries its own evidence (a
screenshot or a DOM read plus the DB row); one row's evidence never stands in for another's.

| Row | Steps | Passes when | Verdict | Evidence |
|-----|-------|-------------|---------|----------|
| **G4-1** (run first) | Open repro thread `3586b900…` ("Quarterly Revenue Three Charts PDF") on the chat view — the panel mounted at `AppViewSwitch.tsx:308` (D-23), not a second mount. Then start a fresh thread whose `execute_code` turn writes one file. | FILES lists the PNGs and the PDF under **Generated files**; the section count and the rail's **Files — N** agree; no **No files yet.**; each file downloads (the same bytes the chat card downloads); the fresh thread's file shows without a reload. Passing closes BUG-261027-01 (`verified_closed_by: "302 G4-1"`). | **PASS (list + count)** · download click owed | 2026-10-30, local, merged develop + review fixes. The repro thread `3586b900` belongs to another account → 299's "This chat can't be opened" card (correct, not a 302 defect), so the fresh-thread arm stands in: thread `eb47db96`, DeepSeek, `execute_code` wrote `chart.png` + `sales.csv` → the panel (no reload) reads **FILES 2**, a **GENERATED FILES** group lists "chart.png · 37.3 KB · just now" and "sales.csv · 81 B · just now", and "No files yet." is absent (DOM read; screenshots time out on the hidden tab). **Not clicked:** a download writes a file to disk, which needs the operator's explicit OK — the shared `useSandboxDownload` path is unit-proven (`useSandboxDownload.test.ts`, `GeneratedFilesGroup.test.tsx`). |
| **G4-2** | On a schedule whose last launch was refused, run the five UI-SPEC §S2 checks: (1) `launch_failed` reads **Didn't start. Press Run now to see why.**, the token nowhere on screen; (2) a server sentence reads **Didn't run — {sentence}**, wrapping; (3) Run now busies only that row; (4) no list-wide **Loading…** after first load, `aria-busy` on refetch; (5) the result line sits on the pressed row only. **Plus F-1:** after Run now on the refused row, the refusal sentence appears **once** (the Run now line), not twice. | all five checks + F-1 hold. Passing closes BUG-261027-03 with `verified_closed_by: "300 G4-5 PASS 2026-10-29 + 302 G4-2"`. | **PASS** | 2026-10-30, local, dev org `c1f18150`, workflow "300 G4-5 schedule rows" → Schedules… (DOM reads). (1) Row 2 (status set to the launch-failure token locally for the drive, restored to `waiting` after) reads **Didn't start. Press Run now to see why.**; the token occurs 0 times in the dialog. (2) Row 1 reads **Didn't run — Client name is required and has no value. Add a new schedule with it filled in, then delete this one.** (3) Run now on Row 1: that button alone reads **Starting…** and is disabled; Rows 2-4 stay **Run now**, enabled. (4) no **Loading…** in the dialog during the refetch; one `aria-busy=true` element. (5) the result lands on Row 1 only; Rows 2-4 unchanged. **F-1:** after Run now, Row 1 carries the refusal sentence exactly **once** (count 1). |
| **G4-3** | Start a workflow from inside a thread (the "Run a workflow" trigger) for each drivable 409 cause: (a) while the thread's workflow runs; (b) while it is paused waiting for an answer; (c) from an Expert / org mismatch, using the two-org dev account. | (a) reads **A workflow is already running in this thread, so {name} didn't start.** (`startLocked`); (b) reads **{name} didn't start because this thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page.** (`startPaused`); (c) reads **{name} didn't start.** followed by the server's own sentence. **No Retry** on any of the three. A cause that cannot be driven is ⛔ with the reason, never omitted. | **PASS (b)** · (a) PASS by pre-emption · ⛔ (c) | 2026-10-30, local, dev org. **(b)** thread `72459249` (run `feee20fb` paused on an ask) → Run a workflow → "300 FIX-05 resume provider" → Run: the thread shows **300 FIX-05 resume provider didn't start because this thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page.** with a Dismiss control and **no Retry** (exact UI-SPEC words). **(a)** thread `bc0d3254`: started "300 MT-1 multi-tool then ask", then 1.5 s later the trigger already reads **A workflow is already running in this thread** and the picker does not open, so no second start is possible and no Retry shows. The server's worded 409 (`startLocked`) is reachable only in the race before the client learns of the run; that arm is unit-proven (`useStartWorkflowInThread.test.tsx`, `streamsProvider.test.tsx`, RED `f9d06ab3c`). **(c) ⛔ not drivable through the UI:** opening a thread from the other org (`eb47db96`, org `22f9c615`) shows 299's "This is in … Switch to … to open it?" card, so the Run a workflow trigger never renders; the worded fallback (`startRefusedWith`) is unit-proven. |

## 3. Four-axis UAT for FIX-01 (D-20 — CLAUDE.md scoreboard rule; this phase touches UI state)

Method (Phase 185 recipe): each row is a real run with a per-request `model` + `provider` on
`POST /threads/{id}/messages`, mutating no global setting. The verdict is read in the panel: FILES lists the
produced file under **Generated files**, and it downloads.

### 3a. Cross-provider — the files-produced row (full native roster + OpenRouter, 8 rows)

Prompt: *"Use execute_code to draw a bar chart of 3 numbers with matplotlib and save it as chart.png."*

Roster **derived from `MODEL_CAPABILITIES` on 2026-10-30** (grouped by `provider`, newest registry-backed id
per group; re-derive at run time — never trust this list over the registry):

| # | Provider | Representative id (re-derive) | Verdict | Evidence |
|---|----------|-------------------------------|---------|----------|
| 1 | OpenAI | gpt-5.6-sol (newest gpt-5.6 in registry) | owed | |
| 2 | Anthropic | claude-opus-4-8 | owed | |
| 3 | Google | gemini-3.5-flash | owed (highest-risk row for tool-call emission) | |
| 4 | DeepSeek | deepseek-v4-pro | owed | |
| 5 | Zhipu / GLM | glm-5.2 | owed | |
| 6 | MiniMax | MiniMax-M3 | owed | |
| 7 | Moonshot / Kimi | kimi-k2.6 | owed — **expected ⛔ — account suspended (296), confirm at run time** | |
| 8 | OpenRouter | deepseek/deepseek-v4-pro | owed — **expected ⛔ if 402 persists** (292.1) | |

### 3b. Multi-tool

| Row | Steps | Expected | Verdict | Evidence |
|-----|-------|----------|---------|----------|
| MT-1 | One prompt that uses `search_documents` and then `execute_code` to write a file from what it found | the file lists under Generated files and downloads | owed | |

### 3c. Parallel-thread

| Row | Steps | Expected | Verdict | Evidence |
|-----|-------|----------|---------|----------|
| PT-1 | Thread A's `execute_code` turn produces a file while thread B streams a long reply | A's panel lists the file; B's stream is intact | owed | |

### 3d. Long-message

| Row | Steps | Expected | Verdict | Evidence |
|-----|-------|----------|---------|----------|
| LM-1 | A thread with ≥ 50 messages whose EARLY turn produced a file | the early file still lists (tests RESEARCH A1 — the chat history is unpaged, so the fold sees every turn) | owed | |

## 4. Register routing at close

| Item | Routes to |
|------|-----------|
| BUG-261027-01 | `closed` when G4-1 passes (verification sets `closed` + `verified_closed_by`) |
| BUG-261027-03 | `closed` when G4-2 passes |
| everything else | as REG-08 (302-03 Task 2) wrote it — 298 / 300 / 301 items stay `folded` with the owed row named |
