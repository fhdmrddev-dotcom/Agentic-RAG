---
phase: 124
slug: workflow-studio-ux-soul-strict-loose
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-27
---

# Phase 124 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `124-RESEARCH.md` → `## Validation Architecture`. This is a **pure-frontend
> visual/interaction re-skin** whose acceptance bar is two operator-approved sketches
> (046-A soul object, 047-A two doors, SC#4). The Per-Task Verification Map below is
> filled from the three plans' tasks (Wave 1 = Plan 01 foundation; Wave 2 = Plans 02 + 03).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library (frontend) |
| **Config file** | `frontend/vitest.config.ts` (existing) |
| **Quick run command** | `cd frontend && npx vitest run <touched-test-file>` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~10–25 s per touched workflow/panel test file; full suite ~minutes |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched component test
- **After every plan wave:** Run the full vitest suite (`cd frontend && npx vitest run`) — confirms no regression in `panel/` (PhaseTimeline/PhaseCard/WorkspacePanel) + `workflows/` + `pages/`
- **Before `/gsd:verify-work`:** Full suite green + `git diff --stat` of the two G-5 hot files EMPTY + sketch-match live UAT against 046-A/047-A
- **Max feedback latency:** < 30 s for a single touched workflow/panel test file

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 124-01 | 1 | WUX-01 | T-124-02, T-124-03 | One shared tier derivation + glyph map + honest deliverable resolver (no duplication; no API import) | unit | `cd frontend && npx vitest run src/components/workflows/soulData.test.ts` | ❌ Wave 0 (this task creates it) | ⬜ pending |
| 01-T2 | 124-01 | 1 | WUX-01 | T-124-01, T-124-02, T-124-03 | 5-atom soul scale-keyed; tier-consistency invariant; honest empty-states; glyph+WORD; G-5 source-grep; glyph-dot spine strips ribbons/indices | unit + a11y + source-grep | `cd frontend && npx vitest run src/components/workflows/WorkflowSoul.test.tsx src/components/workflows/PhaseSpine.test.tsx` | ❌ Wave 0 (this task creates it) | ⬜ pending |
| 02-T1 | 124-02 | 2 | WUX-01 | T-124-05 | Card-scale soul on library cards; page consumes extracted soulData; Run path not wrapped (D-01) | unit + integration | `cd frontend && npx vitest run src/pages/WorkflowsPage.test.tsx` | ⚠️ extend/create | ⬜ pending |
| 02-T2 | 124-02 | 2 | WUX-02 | T-124-06, T-124-07 | Two doors render; "‹ both doors" return; "switch to Author & govern ›" strip; govern door = existing Builder; judge LOCKED | unit + interaction | `cd frontend && npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx` | ❌ Wave 0 (this task creates it) | ⬜ pending |
| 03-T1 | 124-03 | 2 | WUX-01 | T-124-09, T-124-10, T-124-11 | Run soul = additive sibling PanelSection; PhaseTimeline/PhaseCard byte-identical; no timer/slug; def sourced by id | unit + git-diff backstop | `cd frontend && npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx && git diff --stat -- frontend/src/components/panel/PhaseTimeline.tsx frontend/src/components/panel/PhaseCard.tsx` | ⚠️ extend existing | ⬜ pending |
| 03-T2 | 124-03 | 2 | WUX-01 | T-124-09, T-124-13 | Pub-scale soul block PREPENDED above the gauntlet; 8-stage ladder + verdict unchanged (D-06) | unit | `cd frontend && npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ✅ extend existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Validation Architecture anchors (from RESEARCH.md — concrete rows derived above):**
- **Tier-consistency invariant** — shared `tierForDefinition` (soulData.ts, 01-T1) so library card / run header / publish summary can NEVER show disagreeing tiers (01-T2 asserts identical `data-tier` across card/run/pub).
- **Shared glyph map invariant** — extracted `PHASE_GLYPHS` single source (01-T1); glyph-dot `PhaseSpine` renders type glyphs only, ribbons + indices stripped (01-T2).
- **Honest empty-states** — draft purpose → "draft · purpose not declared yet"; no-file-deliverable → "produces: answer in chat" (01-T2 render assertions, D-03).
- **G-5 additive-sibling assertion** — `PhaseTimeline.tsx`/`PhaseCard.tsx` internals byte-identical (03-T1 `git diff --stat` EMPTY + pinned HEAD blob hashes; soul source-grep clean in 01-T2 + 03-T1). Precedent: `PhaseSpineGraph.test.tsx:153-159`.
- **D-01 launch path unchanged** — `doRun` byte-identical; fork at Studio entry only; Run-not-wrapped test (02-T1).
- **Sketch-match (manual)** — visual diff of all 3 soul sizes + both doors against 046-A/047-A + live deriveTier recompute (STRICT→MIDDLE→LOOSE) + locked judge (phase-gate UAT).

---

## Wave 0 Requirements

- [x] Extraction tests for shared `tierForDefinition` + `PHASE_GLYPHS` (consistency invariant) → `src/components/workflows/soulData.test.ts` (01-T1) + the cross-size invariant in `WorkflowSoul.test.tsx` (01-T2). **Wave 1 / Plan 01 creates these BEFORE any size mounts in a host surface.**
- [x] G-5 additive-sibling regression guard (PhaseTimeline/PhaseCard internals unchanged) → the WorkflowSoul ?raw source-grep (01-T2) + the `git diff --stat` backstop on the two hot files (03-T1) + the pinned HEAD blob hashes (PhaseTimeline `9bf88c9b…`, PhaseCard `a489492f…`).

*All net-new test files are created by the task that introduces the component it tests (TDD-style: foundation Wave 1, then the host mounts in Wave 2). vitest + testing-library are already present — no framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sketch-match across 3 soul sizes (card / run header / publish summary) | WUX-01 | Visual fidelity to operator-approved 046-A is the acceptance bar (SC#4) — not assertable by render shape alone | Open the built surfaces; diff against `.planning/sketches/046-workflow-soul-object/index.html`. Confirm: purpose HERO, glyph-dot spine (no ribbons/indices), one tier chip (glyph+WORD), needs, output — and that switching workflow changes tier/spine/needs/output in lockstep across all three sizes |
| Sketch-match both doors + both contexts | WUX-02 | Operator-approved 047-A is the acceptance bar; the felt two-door + switch-strip behavior is visual | Open the Studio entry; diff against `.planning/sketches/047-strict-loose-two-doors/index.html`. Confirm two doors side by side, "‹ both doors" returns, "switch to Author & govern ›" strip, toggle Authoring↔Running |
| Live deriveTier recompute + locked judge in "Author & govern" | WUX-02 | Interactive recompute (STRICT→MIDDLE→LOOSE) + judge-always-on lock is a felt behavior | In the govern door flip `citation_policy` strict→draft (tier STRICT→MIDDLE) and toggle floor gates off (MIDDLE→LOOSE); confirm the tier chip recomputes and `llm_judge_rubric` stays LOCKED-on |
| A1 deliverable-label string | WUX-01 | The exact friendly label (name + ext) is not a guaranteed static field — match the rendered 046-A example | Confirm the output-atom label string against 046-A's rendered example + operator sign-off; the honest "produces: answer in chat" fallback is locked-asserted |
| Deep Mode byte-identical (D-08) | — | The soul section is gated to harness runs; confirm a Deep/no-run thread shows no soul chrome | Open a Deep chat thread; confirm the run soul `<PanelSection>` does not appear; the panel is byte-identical to pre-124 |
| Mobile / 375 width legibility (046-A toolbar tests 375) | WUX-01 | Responsive legibility is visual | Resize to 375px; confirm the soul is still legible at card + run scale |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task ships its own vitest spec; G-5 backed by `git diff --stat`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (all 6 tasks carry an automated command)
- [x] Wave 0 covers all MISSING references (soulData/WorkflowSoul/PhaseSpine/WorkflowDoorSwitch tests created in the task that introduces the component; WorkspacePanel/PublishGauntlet/WorkflowsPage tests extended)
- [x] No watch-mode flags (all commands are `vitest run`)
- [x] Feedback latency < 30 s for a single touched test file
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready (planner-filled 2026-06-27)
