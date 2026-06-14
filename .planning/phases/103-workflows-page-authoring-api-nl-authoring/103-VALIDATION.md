---
phase: 103
slug: workflows-page-authoring-api-nl-authoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed strategy in `103-RESEARCH.md` → `## Validation Architecture`. The SC#10 4-axis
> cross-provider NL-gen rows are authored here (VALIDATION.md), NOT as PLAN.md tasks (CLAUDE.md).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests/ && cd ../frontend && npm run test` |
| **Estimated runtime** | ~90 seconds |

> NOTE: frontend vitest has ~14-17 pre-existing rot tests (fail at baseline AND HEAD) — prove net-new
> via baseline checkout, not raw count (SEED-056 / project_frontend_vitest_rot). Playwright E2E is rotted
> (SEED-049) — not a passing backstop.

---

## Sampling Rate

- **After every task commit:** Run quick command (scoped to the touched module where possible)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green (modulo documented pre-existing rot)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*Populated by the planner during planning — every plan task maps to a row with its requirement,
threat ref, test type, and automated command. Seeded from `103-RESEARCH.md` → `## Validation Architecture`.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | WFAUTH-01..04 | T-103-* | — | unit/integration | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Confirmed/refined by the planner.*

- [ ] Backend test stubs for REQ-1 (draft CRUD round-trip + 409-on-published + lint-block), REQ-2 (model_validate pass, exactly-once retry / `nl_generation_attempt` count, grounding-fidelity ⊆-check), REQ-3 (additive-optional `PhaseSpec.name` round-trip + pre-103 def validates)
- [ ] Frontend test stubs for REQ-4 (drag-free static DOM assertion), REQ-7 (`deriveTier()` no-round-trip)
- [ ] Shared fixtures: an owner-scoped draft, a second-user draft (RLS), a published row (immutability/409), a pre-103 definition lacking `phase.name`

*If existing infra covers a requirement, the planner marks it so.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single-state-transition draft reveal (one DOM batch, no per-node animation/stagger) | REQ-5 | Lived-experience visual contract — wire/snapshot insufficient (G-4) | Describe a workflow, observe the "Composing…"→full-graph reveal happens in one commit |
| 400px panel pushes (not overlays) the graph column; bottom-sheet <768px | REQ-5 | Layout geometry across viewport widths | Open a node form at ≥1100px (column shrinks, no h-scroll) and at <768px (bottom-sheet) |
| Read-only graph offers no drag/handle/add-node | REQ-4 | Behavioral backstop beyond static check | Attempt a pointer drag on a node → zero change to phase_index/edges |
| Judge block is a hard wall — no override anywhere | REQ-6 | Negative-space UI assertion | Force a judge block; confirm no "publish anyway" affordance, only "Fix & re-publish" |
| Deep chat byte-identical post-merge | Constraint | Cross-cutting regression | One Deep-mode (non-workflow) streaming chat row passes unchanged |
| **SC#10 4-axis cross-provider NL-gen matrix** | REQ-2 / REQ-7 | Cross-provider behavior variance — must run live, not mocked | See matrix below |

### SC#10 Cross-Provider NL-Gen Matrix (MANDATORY — authored here, not in PLAN.md)

| Axis | Coverage row | Pass condition |
|------|--------------|----------------|
| Cross-provider (reasoning-native) | NL-gen on **DeepSeek** or **Moonshot** | Returns a `model_validate()`-clean definition; no reasoning-token starvation; `attempt`=1 on valid |
| Cross-provider (tool-sensitive) | NL-gen on **Z.ai-GLM** or **MiniMax** | Forced `emit_workflow_definition` produces valid tool args — watch the `minimax-m3-invalid-tool-args-400` risk; no silent tool-drop |
| Cross-provider (baseline) | NL-gen on **OpenAI** (+ Anthropic/Google/OpenRouter spot) | Strict-mode override holds (optional-heavy `WorkflowDefinition` does not 400) |
| Multi-tool | A generate shot grounded over folder-tree + tool/skill registry + template placeholders | Grounding fidelity holds (UUIDs ⊆ subtree, tools/skills ∈ registry) |
| Parallel-thread | Run-from-page launch on Thread A while Thread B streams | Both threads keep correct workflow mode; `active_workflow_run_id` set on A |
| Long-message | NL-gen from a ≥5 KB describe prompt OR a thread with ≥50 prior messages | Definition still validates; retry semantics unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] SC#10 4-axis rows authored above and exercised at verification (one representative per axis)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
