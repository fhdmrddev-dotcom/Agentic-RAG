---
phase: 152
slug: workflow-run-inputs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 152 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed per-task rows + Wave 0 stubs are finalized by the planner/executor against `152-RESEARCH.md` §Validation Architecture. This file seeds the frontmatter + the MANDATORY SC#10 4-axis manual UAT (CLAUDE.md UAT scoreboard recipe — this phase touches provider routing / retrieval scope).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) + vitest (frontend) — existing |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -k 152 -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` + `cd frontend && npx vite build` |
| **Estimated runtime** | ~30–90 seconds (focused) |

---

## Sampling Rate

- **After every task commit:** Run the focused `-k 152` suite
- **After every plan wave:** Run the full backend suite + `vite build`
- **Before `/gsd:verify-work`:** Full suite green + `vite build` exit 0
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

*Populated by the planner from `152-RESEARCH.md` §Validation Architecture (one row per task, mapped to WFIN-01/02/03 + threat refs). Placeholder until plans land.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 152-XX-XX | XX | 1 | WFIN-0X | T-152-XX | {expected secure behavior} | unit | `pytest -k 152 -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Finalized by planner. Expected new test files:*
- [ ] `backend/tests/test_152_folder_override.py` — WFIN-02 per-run override + owner-reachability gate (D-05)
- [ ] `backend/tests/test_152_delete_cascade.py` — WFIN-03 FK-safe cascade + no-orphans + owner gate
- [ ] `frontend/src/pages/__tests__/RunModal.test.tsx` (or sibling) — WFIN-01/02 modal `<select>` + template upload sequencing

**WFIN-01 template-upload coverage note (plan-checker warning 4):** WFIN-01's backend is **pure reuse with zero code change** (`upload_template` / `validate_upload` were built + tested in Phase 100/151-03). Its SSTI/provenance threat property ("`kind='template_input'`, MIME/size-allowlisted, never routed to the Jinja engine") is already gated by the existing `backend/tests/test_workspace_template.py` suite (unmodified by this phase) plus the WFIN-01 live-UAT provenance row below. No net-new backend test is required for WFIN-01; the net-new work is frontend sequencing (covered by the RunModal frontend test) + the manual provenance UAT.

---

## Manual-Only Verifications

> **MANDATORY SC#10 4-axis bandwidth** (cross-provider × multi-tool × parallel-thread × long-message). Authored here, NOT in PLAN.md tasks. Phase verification only passes when all 4 axes are exercised LIVE. The operator drives the browser UAT.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Folder-scoped run retrieves ONLY from the chosen folder, identically across **OpenAI / Anthropic / Google / OpenRouter** | WFIN-02 (SC#10 cross-provider) | Live LLM behavior; model must not widen scope | For each of the 4 providers: launch the same workflow with a per-run folder override, ask "what documents do you have?" — answer must be constrained to the folder's subtree on all 4 |
| Multi-tool run: template upload + folder scope in one launch | WFIN-01+02 (multi-tool axis) | Exercises 2 input channels + retrieval in one run | Upload a docx template AND set a folder override, run a workflow that fills the template using folder-scoped retrieval; verify both take effect |
| Parallel-thread: Thread A workflow streaming while Thread B accepts a new run launch | WFIN-01/02 (parallel-thread axis) | Concurrency / run isolation | Start a folder-scoped run in Thread A; while it streams, open the Run modal in Thread B and launch — inputs must not cross-contaminate |
| Long-message: ≥50 prior messages OR ≥5 KB prompt in a folder-scoped workflow run | WFIN-02 (long-message axis) | Context-window pressure on scope enforcement | On a long thread, launch a folder-scoped run; scope must still constrain retrieval |
| Delete cascade: victim-naming sheet names exact Removed vs Kept counts; after delete no orphaned runs/threads; threads become normal chats | WFIN-03 | Destructive; requires visual confirmation of counts + post-delete state | Delete a workflow that has runs + linked threads (incl. one in-flight run → cancel-first); confirm sheet counts match DB, threads survive as normal chats, KB untouched, no orphaned `workflow_runs`/`workflow_phases` |
| Template stored untrusted — never executed / never fed to the Jinja fill engine | WFIN-01 (threat) | Security provenance | Upload a template containing Jinja/SSTI-looking content; confirm `kind='template_input'`, `render_replace` (not `docxtpl`) path, no code execution |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] SC#10 4-axis manual UAT rows all executed LIVE (cross-provider proof)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
