---
phase: 124
slug: workflow-studio-ux-soul-strict-loose
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 124 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `124-RESEARCH.md` → `## Validation Architecture`. This is a **pure-frontend
> visual/interaction re-skin** whose acceptance bar is two operator-approved sketches
> (046-A soul object, 047-A two doors, SC#4). The planner fills the Per-Task
> Verification Map below from each plan's tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library (frontend) |
| **Config file** | `frontend/vitest.config.ts` (existing) |
| **Quick run command** | `cd frontend && npx vitest run <touched-test-file>` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~{N} seconds (planner to confirm) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched component test
- **After every plan wave:** Run the full vitest suite
- **Before `/gsd:verify-work`:** Full suite green + sketch-match live UAT against 046-A/047-A
- **Max feedback latency:** {N} seconds (planner to confirm)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {to be filled by planner — one row per task; every WUX-01/WUX-02 task mapped} | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Validation Architecture anchors (from RESEARCH.md — planner derives concrete rows from these):**
- **Tier-consistency invariant** — shared `tierForDefinition` so library card / run header / publish summary can NEVER show disagreeing tiers (component-render assertion across all 3 sizes).
- **Shared glyph map invariant** — extracted `PHASE_GLYPHS` single source; glyph-dot `PhaseSpine` renders type glyphs only (no ribbons/index noise).
- **Honest empty-states** — draft purpose renders "draft · purpose not declared yet"; no-file-deliverable output line renders "produces: answer in chat" (render assertions, D-03).
- **G-5 additive-sibling assertion** — `PhaseTimeline.tsx` / `PhaseCard.tsx` internals byte-identical; soul header mounts as a new `<PanelSection>` sibling in `WorkspacePanel.tsx`. Proof = source-grep + `git diff --stat` backstop (precedent: `PhaseSpineGraph.test.tsx:153-158`).
- **D-01 launch path unchanged** — `doRun` (createThread → postMessage → create_workflow_run) byte-identical; fork lives at Studio authoring entry only.
- **Sketch-match (manual)** — visual diff of the built surfaces against 046-A / 047-A across all 3 soul sizes + both doors + live deriveTier recompute (STRICT→MIDDLE→LOOSE) + locked judge.

---

## Wave 0 Requirements

- [ ] Extraction tests for shared `tierForDefinition` + `PHASE_GLYPHS` (consistency invariant) — planner to name files
- [ ] G-5 additive-sibling regression guard (PhaseTimeline/PhaseCard internals unchanged)

*Planner confirms final Wave 0 set against the existing vitest infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sketch-match across 3 soul sizes + both doors | WUX-01 / WUX-02 | Visual fidelity to operator-approved 046-A/047-A is the acceptance bar (SC#4) — not assertable by render shape alone | Open built surfaces; diff against `.planning/sketches/046-*/index.html` + `047-*/index.html` |
| Live deriveTier recompute + locked judge in "Author & govern" | WUX-02 | Interactive recompute (STRICT→MIDDLE→LOOSE) + judge-always-on lock is a felt behavior | Toggle citation_policy / gate chips; confirm tier chip recomputes and judge stays locked-on |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
