---
phase: 137
slug: skill-evals-panel-ui-panel-01
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
updated: 2026-07-03
---

# Phase 137 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 137 is a pure frontend consolidation (Skill Studio) over a fully-shipped, secured
> eval/versioning/gate backend (Phases 132–136). No backend change, no migration.
> Component vitest covers the wire/render truths; the SC#10 + G-4 live UAT (below) covers the
> felt experience the wire format can't (the documented lived-experience UAT-gap pattern).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react (frontend). Backend not primary — this phase adds no backend code. |
| **Config file** | `frontend/vitest.config.ts` (existing — no install needed) |
| **Quick run command** | `cd frontend && npx vitest run <path/to/spec>` |
| **Full suite command** | `cd frontend && npm run test` (`vitest run`) |
| **Estimated runtime** | Quick spec ~5–20s; full suite ~60–120s |

**Rot baseline (SEED-056):** ~14–17 frontend vitest tests fail at baseline AND HEAD (pre-existing rot). The phase gate is "no NEW failures beyond that documented baseline." All Phase-137 specs are authored FRESH with `@/lib/api` fully mocked (the Phase-136 `SkillEvalSection.test.tsx` pattern) — never leaning on a rotted sibling (RESEARCH Pitfall 4).

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run <the touched spec>` (< 30s).
- **After every plan wave:** Run `cd frontend && npm run test` (full vitest — assert no NEW failures beyond the SEED-056 rot baseline).
- **Before `/gsd:verify-work`:** Full vitest green (modulo the documented rot baseline) + `cd frontend && npx tsc -p tsconfig.json --noEmit` clean, then the SC#10 + G-4 live UAT below.
- **Max feedback latency:** ~30 seconds per task; ~120 seconds per wave.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 137-01-01 | 01 | 1 | PANEL-01 (D-03/D-10) | T-137-01 / T-137-05 | Renders getPublishGate verbatim; never recomputes `met`; no dangerouslySetInnerHTML | unit | `cd frontend && npx vitest run src/components/skills/studio/LifecycleStepper.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-01-02 | 01 | 1 | PANEL-01 (D-03) | T-137-01 | 4 gate states + ⚡ collision as two labeled facts + no-recompute proof | unit | `cd frontend && npx vitest run src/components/skills/studio/LifecycleStepper.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-02-01 | 02 | 1 | PANEL-01 (D-05/D-15) | T-137-03 / T-137-02 | Owner-scoped reads only; skill-switch guard; provenance maps 5 real source values (no "forced") | unit | `cd frontend && npx vitest run src/components/skills/studio/VersionsTab.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-02-02 | 02 | 1 | PANEL-01 (VER-01/D-05) | T-137-05 | Compare diff via lineDiff as text; no Restore; no dangerouslySetInnerHTML | unit | `cd frontend && npx vitest run src/components/skills/studio/VersionsTab.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-02-03 | 02 | 1 | PANEL-01 (VER-01) | — | Table + provenance + joins + no-Restore asserted | unit | `cd frontend && npx vitest run src/components/skills/studio/VersionsTab.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-03-01 | 03 | 1 | PANEL-01 (EVAL-04/D-04/D-11) | T-137-04 / T-137-05 | not_measured/judge_error never fail-colored; thumbs distinct from judge; prompt-first (no uuid label) | unit | `cd frontend && npx vitest run src/components/skills/studio/RunCaseDetail.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-03-02 | 03 | 1 | PANEL-01 (D-04) | T-137-04 / T-137-03 | Honest rollup "· N not measured"; interrupted banner+re-run; no mid-run verdict | unit | `cd frontend && npx vitest run src/components/skills/studio/RunHistory.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-03-03 | 03 | 1 | PANEL-01 (D-12) | — | Run button disabled while running/empty; controlled component (no launch logic) | unit | `cd frontend && npx vitest run src/components/skills/studio/RunBar.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-04-01 | 04 | 1 | PANEL-01 (D-08) | T-137-04 / T-137-01 / T-137-05 | Reconciled server status only (no optimistic promoted); override_forced un-softened; diff as text | unit | `cd frontend && npx vitest run src/components/skills/studio/ProposalCard.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-04-02 | 04 | 1 | PANEL-01 (D-08) | T-137-04 | All 6 statuses + honest interrupted + gate=null contributes no fabricated pass | unit | `cd frontend && npx vitest run src/components/skills/studio/ProposalCard.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-05-01 | 05 | 2 | PANEL-01 (D-11) | T-137-02 | Prompt-first CRUD; no uuid label; no version-list leak; no migration | unit | `cd frontend && npx vitest run src/components/skills/studio/CaseEditor.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-05-02 | 05 | 2 | PANEL-01 (D-04/D-08/D-12/D-15) | T-137-02 / T-137-04 / T-137-01 / T-137-03 | currentSkillRef guard; endpoint-then-refetch; no mid-run verdict; durable getEvalRun readout | unit | `cd frontend && npx vitest run src/components/skills/studio/EvalsTab.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-06-01 | 06 | 3 | PANEL-01 (D-01/D-06) | T-137-01 / T-137-02 | skill-studio ActiveView + legacy redirect; header strip = same server gate | unit + typecheck | `cd frontend && npx vitest run src/pages/SkillStudioPage.test.tsx && npx tsc -p tsconfig.json --noEmit` | ❌ authored-in-plan | ⬜ pending |
| 137-06-02 | 06 | 3 | PANEL-01 (D-01/D-02) | T-137-06 / T-137-01 | Landing=Evals; deep-linkable tabs; tuner mounted UNMODIFIED (no tuner/* import) | unit | `cd frontend && npx vitest run src/pages/SkillStudioPage.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-06-03 | 06 | 3 | PANEL-01 (D-06) | T-137-02 | "Open studio" entry reaches Studio·Evals (owner skill id only) | unit | `cd frontend && npx vitest run src/pages/SkillStudioPage.test.tsx` | ❌ authored-in-plan | ⬜ pending |
| 137-07-01 | 07 | 4 | PANEL-01 (D-07/D-10) | T-137-01 / T-137-02 | Sections removed; panel status = SHARED full LifecycleStepper (no recompute); skill-switch guard | unit | `cd frontend && npx vitest run src/components/skills/SkillFormDialog.test.tsx` | ✅ (extend) | ⬜ pending |
| 137-07-02 | 07 | 4 | PANEL-01 (D-06) | T-137-03 / T-137-05 | "Review evals →" only on unmet; navigator drill typechecks end-to-end | unit + typecheck | `cd frontend && npx vitest run src/components/skills/PublishGateDialog.test.tsx && npx tsc -p tsconfig.json --noEmit` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** no run of 3 consecutive tasks lacks an automated verify — every task above carries a `npx vitest run` (component) or a vitest+tsc pair (integration). No watch-mode flags used.

---

## Wave 0 Requirements

**Framework install:** NONE — vitest + @testing-library/react are already configured (`frontend/vitest.config.ts`, `package.json` `"test": "vitest run"`). No Wave-0 install task.

**Test specs (authored fresh WITHIN their owning plan, per the SEED-056 rot-avoidance rule — each is the task's own `<automated>` verify; tdd_mode=false so tests are co-authored with their component, not a separate wave):**

- [ ] `src/components/skills/studio/LifecycleStepper.test.tsx` — 4 gate states + ⚡ collision + no-recompute + both variants (Plan 01)
- [ ] `src/components/skills/studio/VersionsTab.test.tsx` — table + provenance mapping + client joins + compare diff + no-Restore (Plan 02)
- [ ] `src/components/skills/studio/RunCaseDetail.test.tsx` — side-by-side arms + honest verdict states + labeled thumbs + prompt-first (Plan 03)
- [ ] `src/components/skills/studio/RunHistory.test.tsx` — 055-B honest rollup + interrupted + no mid-run verdict + D-09 nudge (Plan 03)
- [ ] `src/components/skills/studio/RunBar.test.tsx` — disabled states + controlled component (Plan 03)
- [ ] `src/components/skills/studio/ProposalCard.test.tsx` — 6 statuses + honesty locks + diff (Plan 04)
- [ ] `src/components/skills/studio/CaseEditor.test.tsx` — prompt-first CRUD + no uuid label + no version leak (Plan 05)
- [ ] `src/components/skills/studio/EvalsTab.test.tsx` — lifted machinery: skill-switch guard + durable readout + no mid-run verdict + endpoint-then-refetch (Plan 05)
- [ ] `src/pages/SkillStudioPage.test.tsx` — shell mount, tab switch, landing=Evals, null-guard + back, tuner-unmodified (Plan 06)
- [ ] `src/components/skills/SkillFormDialog.test.tsx` (EXTEND existing) — sections gone + shared full stepper + Open studio (Plan 07)
- [ ] `src/components/skills/PublishGateDialog.test.tsx` (EXTEND existing) — "Review evals →" on unmet only (Plan 07)

All net-new specs mock `@/lib/api` fully and import no helper from a known-rotted sibling.

---

## Manual-Only Verifications

The 4-axis SC#10 live UAT + the G-4 lived-experience state-matrix sweep are authored HERE (not in PLAN tasks, per D-14). Driven via Chrome MCP + psycopg2 (:54322) cross-check per the project UAT recipe (dev app http://localhost:5173/, login fhdmrd@gmail.com / 123456; backend started by the operator). Component vitest proves the wire/render truths; these prove the felt experience.

### SC#10 — 4-axis cross-provider UAT (author under this section; run at `/gsd:verify-work`)

| # | Axis | Requirement | Why Manual | Test Instructions |
|---|------|-------------|------------|-------------------|
| U1 | Cross-provider (OpenAI) | PANEL-01 / D-04 / D-14 | Live per-provider verdict render + provider logo can't be proven by mocked wire | Open Studio·Evals for a skill; run an eval on an OpenAI model; confirm the run row shows the OpenAI provider logo (048 map), an honest WITH/WITHOUT rollup, and per-case verdict chips at finalize (no mid-run verdict). Cross-check the `eval_runs`/`eval_results` rows via psycopg2. |
| U2 | Cross-provider (Anthropic) | PANEL-01 / D-04 / D-14 | Provider-specific verdict honesty (MP-03 precedent) | Repeat U1 on an Anthropic model; confirm the Anthropic logo + honest rollup + finalize-only verdicts; DB cross-check. |
| U3 | Cross-provider (Google) | PANEL-01 / D-04 / D-14 | Google routing + render | Repeat U1 on a Google model; confirm logo + honest rollup + finalize verdicts; DB cross-check. |
| U4 | Cross-provider (OpenRouter) | PANEL-01 / D-04 / D-14 | 4th representative provider | Repeat U1 on an OpenRouter model; confirm logo (or Bot fallback) + honest rollup. (If OpenRouter upstream 404s — the known third-party flake — record BLOCKED with evidence; the axis is satisfied by U1–U3 live per prior-phase precedent.) |
| U5 | Multi-tool | PANEL-01 / D-04 / D-14 | A ≥2-tool eval case (e.g. search_documents + execute_code) proves the side-by-side arms render a multi-tool run honestly | Run an eval whose case exercises 2+ tools; expand the top row; confirm both arms render the multi-tool output + judge reason + tokens without truncation or a fabricated verdict. |
| U6 | Parallel-thread | PANEL-01 / D-04 / D-15 / D-14 | Eval SSE re-attach + skill-switch guard isolation can't be mocked | Start an eval in the Studio for Skill A; while it streams, in a second tab open the Studio for Skill B and start its own eval; confirm each Studio shows ONLY its own run (no cross-skill leak — BUG-260701-02), each live row self-heals on a transient drop, and the durable readout survives a reload. psycopg2/Redis snapshot to confirm two distinct runs. |
| U7 | Long-message | PANEL-01 / D-04 / D-14 | ≥50 prior messages OR a ≥5KB prompt in an eval case; render honesty under load | Run an eval whose case carries a ≥5KB prompt; confirm the arms render the long content in the widened full-surface (the "messy UI" cure) without crash/clip and the readout stays honest. |

### G-4 — lived-experience state-matrix sweep (operator-defined "I'd recognize failure here"; Chrome MCP drives all)

| # | Scenario | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| U8 | Tab switching + deep-link | D-01 / D-06 | Felt tab responsiveness + deep-link landing | From the panel gate → land on Evals; from a lint "Tune this →" → land on Triggering (the tuner, unmodified, its winners intact); from a version row → land on Versions. Switch all three tabs; confirm the persistent header + condensed gate strip stay stable and match the EvalsTab full stepper (one truth-teller). |
| U9 | Panel collapse + calm-at-rest | D-07 / D-10 | The U11 "messy UI" density complaint closes only if felt | Open the slimmed detail panel for a skill; confirm it reads calm at rest (form + one status stepper + Open studio + counts — no stacked eval/case machinery). Collapse/resize the panel; confirm the stepper stays legible at 384px. |
| U10 | Mid-run navigate-away/return | D-04 / D-15 | Re-attach + durable readout is a felt behavior | Start an eval; navigate away (‹ Skills, then reopen the Studio) mid-run; confirm the live row re-attaches and the readout is durable (not restarted, not a false error); then let it finalize and confirm honest verdicts. |
| U11 | Interrupted run | D-04 | Honest interrupted display (BUG-260702-02 render half, no reconciliation) | Force an interrupted run (e.g. backend restart mid-run — the known orphan case); confirm the row renders an interrupted banner + a re-run affordance, never a silent success/failure. |
| U12 | Gate-met vs gate-unmet + ⚡ collision | D-03 / D-10 | The literal 136-UAT contradiction is the acceptance test | On a gate-UNMET skill: confirm the stepper's current stage narrates the unmet reason + the header strip agrees. On a skill in the `passed_on_older_version` state: confirm the stepper reads the ⚡ collision as TWO labeled facts (a met Gate bound to the older passing run WITH an Eval node carrying the newest run's honest failing count + the "measured vN-1, live is vN" message) — never a flat "1/1 passed next to 0/2 passed" contradiction. Confirm the force-publish override receipt renders un-softened where present. |
| U13 | Versions compare + provenance | VER-01 / D-05 | Diff + provenance chips are a felt scan | On the Versions tab: confirm the scan-first table with LIVE badge + provenance chips (map the real source values), pick any two versions, confirm ONE unified diff; confirm a force-promoted version shows its un-softened failed-gate evidence; confirm there is NO "Restore" action. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or an authored-in-plan spec (no separate framework install needed)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (all specs authored within their owning plan; vitest pre-configured)
- [x] No watch-mode flags
- [x] Feedback latency < 30s per task / < 120s per wave
- [x] `nyquist_compliant: true` set in frontmatter
- [x] SC#10 4-axis + G-4 state-matrix UAT rows authored here (not in PLAN tasks — D-14)

**Approval:** approved 2026-07-03 (planner)
