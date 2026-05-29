---
phase: 088
slug: cross-cutting-verification-accessibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 088 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed criterion→method map: see `088-RESEARCH.md` § Validation Architecture.
> This phase is verification + a11y remediation — D-01 mandates the 4-axis cross-provider
> UAT scoreboard + the long-message axis + the SEED-034 fold-gate decision + the a11y
> manual-walk checklist live HERE (VALIDATION.md), NOT in PLAN tasks.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (unit)** | Vitest ^4.1.0 + @testing-library/react + jsdom [VERIFIED: frontend/package.json, vitest.config.ts] |
| **Framework (E2E)** | Playwright ^1.60.0 [VERIFIED: frontend/playwright.config.ts] |
| **a11y matcher** | vitest-axe 0.1.0 (NEW dev-dep — NOT jest-axe; runner is Vitest) [VERIFIED: npm] |
| **Real-browser audit** | Chrome DevTools MCP (Lighthouse a11y + manual keyboard walk) |
| **Config files** | `frontend/vitest.config.ts`, `frontend/playwright.config.ts`, `frontend/src/setupTests.ts` |
| **Quick run command** | `cd frontend && npx vitest run src/components/panel/` |
| **Full suite command** | `cd frontend && npm test` (`vitest run`) |
| **E2E command** | `cd frontend && npm run e2e` (`playwright test`) |
| **Eval script** | `python scripts/eval_cross_provider.py` (NEW — modeled on `scripts/observe-run.py`) |
| **Estimated runtime** | panel quick run ~5s; full suite ~varies; E2E per-scenario ~minutes |

**Baseline note (carry from 087-VALIDATION.md:28):** Phase 086 has a known ~17-failure pre-existing
baseline in StreamsProvider tests — unrelated to panel/088 work. 088 must not regress past that
baseline; new vitest-axe assertions are GREEN-only.

---

## Sampling Rate

- **After every task commit (a11y):** Run `cd frontend && npx vitest run src/components/panel/` (panel + axe, ~5s)
- **After every plan wave:** Run `cd frontend && npm test` (full suite — must not regress past the ~17-failure baseline)
- **Before `/gsd-verify-work`:** Full vitest suite green + `scenario-13` green (Anthropic+Google) + Chrome MCP Lighthouse green + operator lived-experience pass (D-14) + 4-axis scoreboard filled (long-message manual) + SEED-034 fold-gate decision recorded
- **Max feedback latency:** ~5s (panel quick run)

---

## Per-Task Verification Map

> Populated by the planner once PLAN.md task IDs exist. Each task's `<acceptance_criteria>` must
> map to an automated command (vitest / vitest-axe / Playwright / eval-script) OR a Wave-0 dependency,
> OR be flagged manual-only below. Source map: `088-RESEARCH.md` § Validation Architecture
> (Success-Criteria → Validation Map table).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD by planner_ | — | — | A11Y-01 / A11Y-02 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/package.json` + `frontend/src/setupTests.ts` — install/wire `vitest-axe` (the only framework-install gap; `npm install -D vitest-axe` + `expect.extend` in setupTests.ts)
- [ ] `scripts/eval_cross_provider.py` — NEW (model on `scripts/observe-run.py`); no test-infra exists for it yet
- [ ] `frontend/tests/e2e/scenario-13-workspace-deep-flow.spec.ts` — NEW (extends `scenario-02` + existing fixtures)
- [ ] `088-VALIDATION.md` scoreboard sections (below) — author 4-axis UAT rows + long-message manual rows + deep-E2E manual rows + SEED-034 fold-gate decision + a11y manual-walk checklist (mirror 087-VALIDATION.md structure)

*(Existing test infrastructure — 8 panel test files + `fixtures.ts` + 3 E2E fixtures + `restart-backend.{sh,ps1}` + `/health` — covers everything else.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Long-message axis (≥50 prior messages OR ≥5 KB prompt) per provider | SC#1 / D-01 | Felt no-drop behavior, not wire-observable [LOCKED: CLAUDE.md + 087-VALIDATION.md:87] | Per provider: build a thread ≥50 msgs (or send a ≥5KB prompt), confirm the panel + stream don't drop/truncate; record in the 4-axis scoreboard |
| Operator final lived-experience a11y pass | A11Y-01 / A11Y-02 / D-14 / G-4 | The recognize-failure-here gate; SR feel + both themes can't be automated | Keyboard walk todos→files→preview→diff→ask_user; screen-reader pass; both Deep Midnight dark + light themes |
| Real-contrast ≥4.5:1 verification | SC#2 / A11Y-01 | jsdom/axe-core cannot measure rendered colors (Pitfall 5) | Chrome MCP Lighthouse a11y audit on the live populated panel, both themes |
| Cross-provider lived parity | SC#1 | Panel renders identically across providers — the felt parity check ([[feedback_uat_lived_experience_gap]]) | Chrome MCP: same multi-tool prompt on each representative model; confirm panel/seam parity |
| Deep E2E lived pass (write→see→update→diff→ask_user→respond→resume, no refresh) | SC#4 / D-15 | G-4 lived-experience gate beyond the Playwright wire backstop | Chrome MCP on Anthropic + Google; the `scenario-13` Playwright run is the automated backstop |

---

## 4-Axis Cross-Provider UAT Scoreboard (D-01 — authored during execution)

> Reuse the 087-VALIDATION.md:107-114 row format verbatim. Representative models (D-01, Google per D-03):
> OpenAI `gpt-5.4-mini` · Anthropic `claude-haiku-4-5` (or opus) · **Google `gemini-3.5-flash` (3.x+)** ·
> OpenRouter `z-ai/glm-5.1`. Include a clearly-marked `gemini-2.5-flash (known-degraded — not gating)` row for provenance.
> Axes: cross-provider × multi-tool (≥1 row 2+ tools) × parallel-thread × long-message (manual).

_Scoreboard table authored here during execution — see 088-RESEARCH.md Pattern 2/3 for the format + the SSE-event/tool map._

---

## SEED-034 Fold-Gate Decision (D-04/D-05 — recorded during execution)

> Run `scripts/eval_cross_provider.py` → if folding, apply the universal-only text change → re-run → record:
> (a) text-only `git diff` proof · (b) ≥1 previously-failing model now passes · (c) ZERO strong-model regressions.
> ALL three hold → FOLD (universal directive in threads.py:336 SYSTEM_PROMPT + openai_service get_tools() descriptions).
> Any fails → DO NOT FOLD; route SEED-034 architecture to v2.8. Decision + evidence recorded here.

_Decision: TBD during execution._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest-axe install, eval script, scenario-13, scoreboard sections)
- [ ] No watch-mode flags
- [ ] Feedback latency < ~5s (panel quick run)
- [ ] 4-axis scoreboard filled (axes 1–3 + manual long-message) across all 4 providers
- [ ] SEED-034 fold-gate decision + evidence recorded
- [ ] D-17 gemini-3 thought-signature re-verified live (close report or fix-in-088)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
