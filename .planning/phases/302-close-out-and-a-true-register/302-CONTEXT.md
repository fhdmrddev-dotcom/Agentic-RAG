# Phase 302: Close-Out and a True Register - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning
**Mode:** `--auto` (operator: "keep going", continuing the autonomous mandate) — recommended option each time,
logged in `302-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

The remaining v4.7 defects are fixed or accepted with a reason, and the register reads true. FIX-01: the Workspace
panel lists the files a thread produced instead of "No files yet". FIX-03: a schedule row words a launch failure in
plain language and Run now updates only that row. FIX-06: each of the six `SEED-391` review findings is fixed
(test driven RED first) or accepted with a written reason. REG-08: every seed and bug folded, corrected or found in
v4.8 reads true, and `node scripts/check-seeds-register.cjs` is clear.

Requirements: FIX-01, FIX-03, FIX-06, REG-08.

Out of scope: any new capability (a close-out fix that adds one is a phase, not a fix); the operator-owed UAT of
298/300/301; deploying anything.
</domain>

<decisions>
## Implementation Decisions

### FIX-01 — the Workspace panel shows the thread's files (auto — recommended)
- **D-01: Research the real cause first.** BUG-261027-01's hypothesis (sandbox `output_files` live under
  `/sandbox-outputs/…` and never enter the panel's `workspace_files` list) is unverified. The fix targets the measured
  cause, driven RED in a test before the fix.
- **D-02: If the hypothesis holds, the fix is read-side:** the panel's FILES section also lists the thread's produced
  output files from the SAME source the chat's "Generated files" uses (one home for the bytes; no copying into
  `workspace_files`, no second storage path). Rows reuse the existing `FileRow` / per-extension icon; download works
  the same way the chat's does. Nothing new for the user to learn.
- **D-03: Lands in chat first** — `ChatLayout.tsx` is the panel's only mount; the fix is verified in a real thread that
  produced files (the BUG's own repro: `execute_code` → PNGs + a PDF).
- **D-04: G-5** — `WorkspacePanel.tsx` (11), `FilesSection.tsx` (8), `backend/app/api/workspace.py` (8) are FIRING:
  one small hunk each, honoured by construction; any new read logic lives in a new module (frontend helper / backend
  service), never grown inside the hot file.

### FIX-03 — schedule row words + row-local Run now (auto — recommended)
- **D-05: Already built by Phase 300** (300 D-15 / D-16, plan 300-01: every `last_outcome` mapped to a sentence;
  Run now marks only its own row). 302 does NOT rebuild it: it drives it live (G-4) and, if it passes, closes
  BUG-261027-03 with `verified_closed_by: 302`. Only a defect the drive finds gets code (fast-fix, G-3).

### FIX-06 — the six SEED-391 findings (auto — recommended: fix all six; each is small)
- **D-06: BE-IN-01** — the judge's "recorded by design" note reads connector liveness through the executor's own
  freshness check (one shared predicate), so the two can never disagree within the cache TTL.
- **D-07: BE-IN-03** — the publish note never claims a missing example for input types the practice run never asks
  for (Look-it-up / file inputs).
- **D-08: BE-IN-04** — a recursive `$ref` in a tool schema on a Moonshot endpoint no longer fails the whole request:
  research Moonshot's own docs first (provider-docs-first); bounded resolution or a per-tool skip with a logged
  reason, decided by research. Other providers byte-unchanged.
- **D-09: FE-IN-01** — an in-thread start 409 is worded by its cause (already running / paused workflow / Expert org
  mismatch), never one "already running" sentence.
- **D-10: FE-IN-04** — a disabled Word-blank tick says why (accessible description).
- **D-11: FE-IN-06** — the Team view's scroll region and its figure get distinct accessible names.
- **D-12:** each finding gets a test driven RED before its fix; if research shows a finding is not real or not worth a
  change, it is ACCEPTED with a written reason in `SEED-391` instead (never silently dropped).

### REG-08 — a true register (auto — recommended)
- **D-13: Runs last** (its own plan, after FIX-01/03/06). It writes the register to the TRUE state as of its run:
  298 / 300 / 301 are `human_needed`, so their seeds and bugs read `folded` with a `status_note` naming what is
  owed — never `closed` ahead of the operator's UAT. Re-checked at `/gsd:complete-milestone`.
- **D-14:** `SEED-281` premises corrected ("no app-owned mailer" — false since 300; "unanswered fails the run" — false:
  an unanswered run waits); the excluded pause kinds recorded (tool-round cap, chat `ask_user`); in-app half → 301.
- **D-15:** bug reports filed for (a) built images unable to send invite email — fixed by 300 D-21, filed with
  `verified_closed_by: 300` once its live check exists, else `folded` noting the owed real-mail row; (b) `*.vercel.app`
  previews unable to open the app — filed `open` with evidence/hypothesis (no fix in this phase).
- **D-16:** BUG-261029-01 stays `folded` → 301 until 301's keyboard arm is driven; SEED-391 flips to answered.
- **D-17:** `node scripts/check-seeds-register.cjs` exits clear; reported-bugs frontmatter valid.

### Guardrails and plan shape
- **D-18: G-2** — FIX-01 restores content into an existing surface with existing row components; no new visual
  design, so no sketch. Self-approved under the autonomous mandate, recorded in STATE.md → Guardrail overrides.
- **D-19: G-4 scenarios (set now):** (1) a thread whose turn ran `execute_code` and produced files → the panel's FILES
  lists them, each downloads; (2) a schedule row whose launch failed reads a sentence, Run now on one row leaves the
  others untouched (no list-wide "Loading…"); (3) the 409 wording for an in-thread start in each cause (where drivable).
- **D-20: Four-axis for FIX-01** (chat UI state): cross-provider = the files-produced row on the native roster +
  OpenRouter (derive from `MODEL_CAPABILITIES`; ⛔ with reason where blocked); multi-tool (`search_documents` +
  `execute_code`); parallel-thread (files land while another thread streams); long-message (a thread with ≥ 50 messages).
- **D-21: G-8** — 3 plans: (1) FIX-01; (2) FIX-06 six findings; (3) FIX-03 live verify + REG-08 register. No migration
  expected. Targeted suites per task, full gates once per wave; backend baseline ceiling 71 holds.

### Claude's Discretion
- Exact wording of the 409 sentences, the disabled-tick reason, the Team-view names; module names.

### Folded
- **BUG-261027-01** → FIX-01 (D-01..D-04). **BUG-261027-03** → verify-and-close (D-05; built in 300). **SEED-391** →
  FIX-06 (D-06..D-12). Seeds sweep: `0 seeds matched`.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` §"#### Phase 302" — goal, 4 SCs, failure list, flags
- `.planning/REQUIREMENTS.md` — FIX-01, FIX-03, FIX-06, REG-08
- `.planning/reported-bugs/BUG-261027-01-workspace-files-panel-empty-while-thread-produced-files.md`
- `.planning/reported-bugs/BUG-261027-03-schedule-row-shows-raw-launch-failed-and-list-reloads.md`
- `.planning/seeds/SEED-391-296-review-info-findings.md` + `.planning/milestones/v4.7-phases/296-close-v4-7-debt/296-REVIEW.md` (BE-/FE- IN items, file:line)
- `.planning/seeds/SEED-281-nobody-is-told-an-approval-is-waiting.md`
- `.planning/phases/300-told-when-a-run-waits-backend-and-mailer/300-CONTEXT.md` (D-15/D-16/D-21), `300-01-SUMMARY.md`
- `.planning/phases/301-the-waiting-on-you-notice/301-HUMAN-UAT.md`, `298-…/298-HUMAN-UAT.md` if present, `300-…/300-HUMAN-UAT.md`
- `.planning/seeds/TEMPLATE.md`, `.planning/reported-bugs/TEMPLATE.md`, `scripts/check-seeds-register.cjs`
- `docs/HOT-FILE-LEDGER.md` (WorkspacePanel / FilesSection / workspace.py), `CLAUDE.md` (G-4, four-axis, G-5, G-8, provider-docs-first)
</canonical_refs>

<code_context>
## Existing Code Insights
- `frontend/src/components/panel/WorkspacePanel.tsx`, `FilesSection.tsx`; `frontend/src/components/files/FileRow.tsx`, `lib/fileIcon` — the panel and its row.
- `frontend/src/components/chat/OutputFileCard.tsx` / `MessageItem.tsx` "Generated files" — the chat's source of output files.
- `backend/app/api/workspace.py` — workspace files read; sandbox outputs served under `/sandbox-outputs/…`.
- `frontend/src/components/workflows/WorkflowScheduleModal.tsx` — 300's row words + row-local Run now.
</code_context>

<specifics>
## Specific Ideas
- BUG-261027-01 repro thread: `3586b900…` (Quarterly Revenue Three Charts PDF), evidence `296-close-v4-7-debt/evidence/g4/8-followup.jpg`.
</specifics>

<deferred>
## Deferred Ideas
- A fix for `*.vercel.app` previews opening the app — bug filed (D-15b), fix is its own phase.
- Copying sandbox outputs into workspace storage (rejected for D-02's one-home rule) — revisit only if the panel must edit them.
</deferred>

---

*Phase: 302-close-out-and-a-true-register*
*Context gathered: 2026-10-30*
