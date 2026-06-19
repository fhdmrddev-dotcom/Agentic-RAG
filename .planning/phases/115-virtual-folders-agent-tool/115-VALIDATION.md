---
phase: 115
slug: virtual-folders-agent-tool
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 115 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) |
| **Config file** | backend/pytest.ini |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_115_*.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_115_*.py tests/integration/test_115_*.py -q` |
| **Estimated runtime** | ~{N} seconds (planner to confirm) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green (live integration on :54322)
- **Max feedback latency:** {N} seconds (planner to confirm)

---

## Per-Task Verification Map

> Planner populates from RESEARCH.md `## Validation Architecture`. Cover SC#1 (registry + advertised
> `get_tools` schema + model-actually-calls-it), SC#2 (caller-scoped leak-safe resolution, `phase_whitelist`
> guard), SC#3 (SC#10 4-axis cross-provider UAT). VIEW-07 maps to every plan's `requirements`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {planner fills} | | | VIEW-07 | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Planner authors the RED/xfail scaffolds matching the filenames below.

- [ ] `backend/tests/unit/test_115_*.py` — stubs for VIEW-07 (tool arg-shape, view-name-XOR-filter discriminator, catalog mode, newest-N + true-total result shape)
- [ ] `backend/tests/integration/test_115_*.py` — live :54322 caller-scoped resolution + the two-user leak proof (SC#2)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

> SC#10 4-axis cross-provider UAT (D-115-13) — authored here, NOT in PLAN.md tasks (CLAUDE.md UAT recipe).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#10 4-axis: native-7 cross-provider × multi-tool (view-query + search_documents) × parallel-thread × long-message | VIEW-07 / SC#3 | Live multi-provider chat behavior; the MiniMax row observes `minimax-m3-invalid-tool-args-400` | {planner fills concrete rows per provider} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
