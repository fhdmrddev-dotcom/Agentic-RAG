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

### BEFORE — Baseline eval (Task 1, 2026-05-30, against `http://127.0.0.1:8000` localhost hard-gate confirmed)

**Operator-approved scope extension (additive, no logic change):** the eval `PROVIDERS` list was extended 4 → 6 by appending the two NATIVE weak-model providers the SEED-034 fold-gate is specifically meant to catch (`deepseek`/`deepseek-v4-flash`, `moonshot`/`kimi-k2.6`). The 4-axis recipe FLOOR (OpenAI / Anthropic / Google 3.x / OpenRouter) is still fully met; deepseek + moonshot are a superset that only strengthens the gate's zero-regression condition. The change is text/list-additive only — no assertion logic, localhost gate, per-request override, or prompt/schema change.

Canonical prompt set N=4 (RESEARCH §Code Examples): `factual-doc-search` (assert `search_documents`/`query_tables` invoked) · `multi-tool` (assert `write_todos` **and** `workspace_write` invoked + arg-shape `todos` is a list + DB rows in `todos` and `workspace_files`) · `task` (assert sub-agent spawned) · `ask_user` (assert `ask_user` invoked — `tool_calls @> '[{"kind":"ask_user_prompt"}]'`).

Per-cell PASS/FAIL grid (greppable `EVAL_ROW`/`EVAL_SUMMARY` source: `scripts/.eval_<provider>.log`). Each cell PASSES only when every APPLICABLE assertion (invoked / arg_shape / persisted; `-` = N/A for that prompt) is True.

| Provider (representative) | factual-doc-search | multi-tool (write_todos + workspace_write) | task (sub-agent) | ask_user | Cells PASS |
|---------------------------|--------------------|---------------------------------------------|------------------|----------|------------|
| OpenAI (gpt-5.4-mini)     | ✅ PASS | ❌ FAIL (invoked/arg_shape/persisted) | ❌ FAIL | ✅ PASS | **2/4** |
| Anthropic (claude-haiku-4-5) | ✅ PASS | ❌ FAIL | ❌ FAIL | ❌ FAIL | **1/4** |
| Google (gemini-3.5-flash) | ✅ PASS\* | ❌ FAIL † | ❌ FAIL † | ❌ FAIL † | **1/4 (confounded)** |
| OpenRouter (z-ai/glm-5.1) | ✅ PASS | ❌ FAIL | ❌ FAIL | ❌ FAIL | **1/4** |
| DeepSeek (deepseek-v4-flash) — *native, added* | ✅ PASS | ✅ PASS | ✅ PASS | ❌ FAIL | **3/4** |
| Moonshot (kimi-k2.6) — *native, added* | ✅ PASS | ❌ FAIL | ✅ PASS | ✅ PASS | **3/4** |

`*` Google `factual-doc-search` invoked `search_documents` (PASS) **before** the run crashed.
`†` **All four Google cells terminated `run_status=failed`** — NOT a tool-use-quality signal and NOT the D-17 thought-signature bug. DB `runs.error` shows the run starts correctly on `gemini-3.5-flash` (real `search_documents`/`query_documents` calls) but a LATER iteration crashes with `ClientError: 404 NOT_FOUND … Model not found: models/gemini-v4p1s-rev24-ajax-sentinel` — a non-existent / placeholder model name sent on a SECONDARY call (consistent with the known title-gen / secondary-model routing bug, memory `project_title_gen_deepseek_moonshot_broken`). This is a **pre-existing local-env config/routing artifact, NOT introduced by 088-04** (which only appended two list entries; Google was already present). It **confounds the Google axis** — Google's multi-tool/task/ask_user rows are FAIL-but-confounded (the run died before the tool sequence completed). Logged to `deferred-items.md` → v2.8. The fold-gate decision does NOT rely on Google; clean `completed`-run evidence from the other 5 providers carries it.

**Failing rows explicitly identified (the SEED-034 evidence, verified per-thread in `messages.tool_calls` + `todos`/`workspace_files`):**

1. **`multi-tool` — write_todos consistently SKIPPED (5/6 providers FAIL; only DeepSeek passes).** OpenAI, Anthropic, OpenRouter, Google(confounded), Moonshot all FAIL. DB evidence: OpenAI emitted `workspace_write` only (files=1, **todos=0** — no `write_todos`); Moonshot identical (files=1, todos=0); Anthropic went on a long doc-search/analyze exploration and emitted **neither** `write_todos` nor `workspace_write` (todos=0, files=0). The agents do the file-write half of "Plan a 3-step analysis … and write the summary to a file" but **narrate/skip the todo-tracking half**. This is the textbook SEED-034 narrate-instead-of-call case. **DeepSeek PASSED** (todos=4, files=1) — proving the prompt DOES elicit both tools and the harness assertion is sound; the gap is tool-selection variance, not capability.
2. **`ask_user` — ask_user tool NOT invoked on "confirm first" (4/6 providers FAIL; OpenAI + Moonshot pass).** Anthropic, OpenRouter, DeepSeek, Google(confounded) FAIL. DB evidence: OpenAI + Moonshot emitted a `tool_calls` entry with `kind='ask_user_prompt'` (PASS); the others interpreted "confirm with me first before you overwrite" **conversationally** (prose confirmation) without invoking the `ask_user` tool (DeepSeek called `workspace_list`/`query_documents`; Anthropic emitted no tool at all). A reproducible cross-provider tool-selection gap.
3. **`task` — sub-agent NOT spawned (4/6 providers FAIL; DeepSeek + Moonshot pass).** OpenAI, Anthropic, OpenRouter, Google(confounded) called `search_documents` directly instead of spawning the `task` sub-agent for "Find every mention … across all my documents and summarize." (This is the weakest gate candidate for a universal directive — answering-via-direct-search is arguably acceptable behavior, not a clear defect; noted but not the primary fold target.)

**gemini-2.5 (D-03):** not run in this baseline (the default matrix gates on Google 3.x). Per D-03 it is **known-degraded — not gating**; if recorded separately via `--provider google-2.5` it is a data point only.

### condition-b precondition (≥1 FAILING row a universal text directive could plausibly fix): **YES**

Multiple clean, reproducible failing rows on `completed` runs exist that universal-only text directives (RESEARCH candidates) directly target:
- **Candidate B (write_todos-for-multistep)** → the `multi-tool` write_todos miss (5/6 providers). The single strongest, most consistent failing capability.
- **An ask_user "confirm-first" universal directive** (Candidate-A/B shape; and/or **Candidate C** strengthening the `ASK_USER` / `WORKSPACE_WRITE` tool descriptions) → the `ask_user` miss (4/6 providers).
- DeepSeek (multi-tool PASS) + OpenAI/Moonshot (ask_user PASS) are the previously-PASSING rows the re-run must NOT regress (condition-c).

### Recommended decision (pending operator confirmation at the Task-2 checkpoint): **fold-and-apply**

Rationale: condition-b is clearly met with reproducible, DB-verified failing rows on `completed` runs across multiple native providers; the targeted misses (skip `write_todos` on multi-step work; skip `ask_user` on explicit "confirm first") are exactly the universal, provider-agnostic tool-use directives D-06 scopes, grounded in the already-cited provider docs (Anthropic "explicit instructions in a user message"; OpenAI/Google "be clear and specific about when to use a function"). The change would be TEXT-ONLY in `SYSTEM_PROMPT@threads.py:336` (Candidate B + an ask_user "confirm-first" line) and/or the `WRITE_TODOS_TOOL`/`ASK_USER`-style `*_TOOL["description"]` strings in `openai_service.get_tools()` (Candidate C) — zero schema/logic/per-provider/MODEL_CAPABILITIES change, fully reversible, re-verified by re-running this exact 6×4 eval (must show ≥1 improved row AND zero regressions of the DeepSeek/OpenAI/Moonshot passing cells).

Candidate directive(s) → exact failing capability they target:
- **Candidate B** → `multi-tool` write_todos skip (the headline fold target).
- **Candidate A/B-shape ask_user line + Candidate C tool-description strengthening** → `ask_user` confirm-first skip.

> Alternative (route-to-v2.8) remains EQUALLY VALID per D-08 (the eval script is the v2.8 harness seed) if the operator judges shared-`threads.py`-hot-file regression risk too high at milestone close. **This is the operator's binding decision at the Task-2 checkpoint — no change has been applied to `threads.py`/`openai_service.py`.**

_AFTER table + final verdict: recorded in Task 3, post-checkpoint, only on the `fold-and-apply` branch._

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
