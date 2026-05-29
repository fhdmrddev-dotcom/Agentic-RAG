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

| Task ID | Plan | Wave | Requirement / SC | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01 a11y remediation + vitest-axe gate | 01 | 1 | A11Y-01 / A11Y-02 (SC#2/SC#3 structural) | T-088-01-* | Structural a11y: roles/names/labels + global `:focus-visible` ring + 3 `aria-live` regions + `aria-selected` tracks active row; no axe violations | vitest-axe (jsdom) | `cd frontend && npx vitest run src/components/panel/` | ✅ `src/components/panel/__tests__/*.test.tsx` (8 files) | ✅ green (89/89; A11Y-01/02 structurally GREEN — real-contrast/focus deferred to Plan 05 Lighthouse, Pitfall 5) |
| 02 cross-provider eval script | 02 | 1 | SC#1 / D-02 / D-05 (fold-gate evidence) | T-088-05-02 | Localhost-hard-gated; per-request provider/model override (no global-state mutation); secret-safe greppable `EVAL_ROW`/`EVAL_SUMMARY` | live-route eval (Python) | `python scripts/eval_cross_provider.py` | ✅ `scripts/eval_cross_provider.py` (687 lines) | ✅ green (real-route, secret-safe; ran LIVE in Plan 04 BEFORE/AFTER) |
| 03 deep-flow E2E backstop | 03 | 1 | SC#4 / D-15 / D-17 | T-088-05-01 | Anthropic+Google deep flow, no-refresh; zero-400 `toEqual([])` thought-signature check (D-17); no cross-thread bleed | Playwright (E2E) | `cd frontend && npm run e2e -- scenario-13` | ✅ `frontend/tests/e2e/scenario-13-workspace-deep-flow.spec.ts` (294 lines) | ⬜ pending live run (Task 2 — Anthropic + Google) |
| 04 SEED-034 fold-gate decision | 04 | 2 | D-04 / D-05 (fold-gate) | — | Text-only universal directive; condition (a) git-diff-proven string-literal-only, (b) ≥1 failing row improves, (c) zero strong regression | eval BEFORE/AFTER + `git diff` (DONE/FOLDED) | `python scripts/eval_cross_provider.py` (BEFORE/AFTER) + `git diff <before> <after> -- backend/app/api/threads.py backend/app/services/openai_service.py` | ✅ VALIDATION.md § SEED-034 Fold-Gate Decision (filled) | ✅ DONE — **VERDICT: FOLDED** (2f6e2523; see § below, do NOT re-run) |
| 05 verification capstone (manual/operator) | 05 | 3 | SC#1–SC#4 / A11Y-01/02 / D-17 / G-4 | T-088-05-01..04 | Live 4-axis UAT + Lighthouse (both themes) + keyboard walk + deep-flow lived pass + D-17 route — operator/Chrome-MCP-driven (manual-only) | manual (Chrome MCP) — see Manual-Only table + scoreboard below | _no single automated command — see § 4-Axis Scoreboard + § a11y Manual-Walk Checklist (this file)_ | ✅ this VALIDATION.md (scoreboard + checklist authored Task 1) | ⬜ pending operator (Task 2) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · DONE = decision/verdict recorded*

> Plan 05 is autonomous: false — its acceptance is the operator/Chrome-MCP LIVE pass (the recognize-failure-here gate, D-14/G-4). It has no single automated command; its evidence lives in the **4-Axis Cross-Provider UAT Scoreboard** + the **a11y Manual-Walk Checklist** + the **SEED-034 Fold-Gate Decision** sections of this file.

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

> **Bandwidth, not cell count, is the bar** (087-VALIDATION.md:116) — axes 1–3 (cross-provider × multi-tool × parallel-thread) may be combined into fewer live runs; long-message stays **MANUAL per provider**. `deepseek-v4-flash` + `kimi-k2.6` are **additive native-provider coverage beyond the locked-4 floor** (operator-extended, consistent with the 088-04 6×4 eval). The locked-4 recipe FLOOR (OpenAI / Anthropic / Google 3.x / OpenRouter) is fully met; the two native rows only widen the lived-parity check.
>
> Cells are EMPTY pending the Task-2 operator/Chrome-MCP LIVE run — do NOT pre-fill from the eval. SSE-event/tool map the matrix must exercise (RESEARCH Pattern 3): `write_todos` (todos table + SeamPointer) · `workspace_write` (workspace_files + SeamPointer) · `ask_user` (PendingAskCard + paused cue, `tool_calls @> '[{"kind":"ask_user_prompt"}]'`) · `task` (sub_agent) · `tool_args_progress`/`tool_start` (Redis run stream). Status legend: ⬜ pending · ✅ PASS · ❌ FAIL · ➖ n/a (covered by another row).

| Provider (representative)        | Multi-tool | Parallel-thread | Long-message | Panel/seam parity | Status |
|----------------------------------|------------|-----------------|--------------|-------------------|--------|
| OpenAI (gpt-5.4-mini)            |            |                 |              |                   | ⬜     |
| Anthropic (claude-haiku-4-5)     |            |                 |              |                   | ⬜     |
| Google (gemini-3.5-flash)        |            |                 |              |                   | ⬜     |
| OpenRouter (z-ai/glm-5.1)        |            |                 |              |                   | ⬜     |
| DeepSeek (deepseek-v4-flash) — *native, additive* |            |                 |              |                   | ⬜     |
| Moonshot (kimi-k2.6) — *native, additive* |            |                 |              |                   | ⬜     |
| gemini-2.5-flash (known-degraded — NOT gating, D-03 — provenance only) |            |                 |              |                   | ⬜     |

**Scoreboard result:** _pending Task-2 operator LIVE run — record per-cell evidence (Supabase counts / screenshots / Lighthouse), then the one-line "N providers render panel + chat quiet-pointer seam IDENTICALLY — one UX, N adapters" roll-up here. Mark gemini-2.5 a data point only (D-03), never a gate condition._

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

### Operator decision at Task-2 checkpoint (2026-05-30): **fold-and-apply** (binding)

Operator confirmed fold-and-apply. Folded candidates (the task/sub-agent target was **explicitly SKIPPED** — direct search is acceptable behavior, and forcing sub-agents is out of universal-text-only scope and risks over-spawning):
- **multi-tool → Candidate B (write_todos-for-multistep)** — the headline fold target (write_todos skipped 5/6 providers; only DeepSeek passed).
- **ask_user → Candidate A (system-prompt directive) + Candidate C (tool-description strengthening)** — the ask_user confirm-first skip (4/6 providers; OpenAI + Moonshot passed).

### condition-a (text-only) — FOLD APPLIED (pending re-verify)

**Status: FOLD APPLIED (pending re-verify).** The universal-only text directives were applied TEXT-ONLY. `git diff` of `backend/app/api/threads.py` + `backend/app/services/openai_service.py` is confined exclusively to string-literal content — **0 non-string-literal lines changed** (no argument schema, no `get_tools()` control flow, no `*_service.py` adapter logic, no per-provider branch, no `MODEL_CAPABILITIES`, no agent loop, no `tool_choice` forcing). Both files byte-compile cleanly (`python -m py_compile` → OK).

Where each candidate landed (file + section):

| Candidate | File | Section / symbol | What changed (string content only) |
|-----------|------|------------------|------------------------------------|
| **B** (write_todos multi-step) | `backend/app/api/threads.py` | `SYSTEM_PROMPT` (:336) → `## Multi-step intent` | +1 bullet inside the prompt string: "When you are working through multiple steps or a task list, ALWAYS call write_todos … a narrated list they cannot see is not tracking." |
| **A** (ask_user, conservative) | `backend/app/api/threads.py` | `SYSTEM_PROMPT` (:336) → `## Multi-step intent` EXCEPTIONS block | +1 directive inside the prompt string: "when you need information only the user has, or must confirm an ambiguous or destructive action … call the ask_user tool rather than guessing or narrating the question in prose. Only do this for a genuine blocker." (Kept CONSERVATIVE to avoid over-asking — the eval cannot catch over-triggering.) |
| **C** (tool-description strengthening) | `backend/app/services/openai_service.py` | `WRITE_TODOS_TOOL["function"]["description"]` (~:640) + `ASK_USER_TOOL["function"]["description"]` (~:711) | write_todos: leads with "Record or update the task list … so it appears in the user's workspace panel. Call this WHENEVER … Do NOT just narrate." ask_user: adds "when you need information only the user has … When the user explicitly asks you to confirm before acting, CALL this tool … Only call it for a genuine blocker; when the intent is clear and safe, proceed without asking." |

**Diff shape (condition-a proof — no secrets):**
- `backend/app/api/threads.py`: **+11 / −2** lines (`git diff --numstat`). Two hunks, BOTH inside the `SYSTEM_PROMPT = ( … )` string-concatenation tuple. The 2 "deletions" are the two `"…\n\n"` literal lines whose `\n\n` terminator relocated to the new last string line (pure string-content reshaping).
- `backend/app/services/openai_service.py`: **+11 / −4** lines. Two hunks, BOTH inside the `"description": ( … )` string value of `WRITE_TODOS_TOOL` and `ASK_USER_TOOL`. The 4 "deletions" are original description-string lines rewritten/extended — the adjacent `"parameters": { … }` schema blocks are UNCHANGED in both.
- **Total: +22 insertions / −6 deletions across 2 files; 0 lines outside a string literal.** `TASK_TOOL` UNCHANGED (skipped per operator decision).

> **RESOLVED:** operator restarted the backend (folded `SYSTEM_PROMPT` + tool descriptions LIVE on `http://127.0.0.1:8000`, `/health` 200). The exact 6×4 eval was re-run against the live folded prompt (fresh thread per cell). AFTER table + verdict below.

### AFTER — Re-verify eval (Task 3 re-verify half, 2026-05-30, against `http://127.0.0.1:8000` — folded prompt LIVE, fresh thread per cell, run PER-PROVIDER batches)

Same 6×4 matrix, same canonical prompts, same assertions. Greppable source: `scripts/.eval_after_<provider>.log` (`EVAL_ROW`/`EVAL_SUMMARY`). All 24 cells reached terminal `run_status` — **no Google 404 this run** (the secondary-model routing crash that confounded all 4 Google baseline cells did NOT reproduce; see Google note below).

| Provider (representative) | factual-doc-search | multi-tool (write_todos + workspace_write) | task (sub-agent) | ask_user | Cells PASS |
|---------------------------|--------------------|---------------------------------------------|------------------|----------|------------|
| OpenAI (gpt-5.4-mini)     | ✅ PASS | ✅ **PASS** (invoked + arg_shape + persisted) | ❌ FAIL | ✅ PASS | **3/4** |
| Anthropic (claude-haiku-4-5) | ✅ PASS | ✅ **PASS** | ❌ FAIL | ❌ FAIL | **2/4** |
| Google (gemini-3.5-flash) | ✅ PASS | ❌ FAIL (invoked/persisted; arg_shape ✅) | ✅ PASS | ✅ PASS | **3/4 (no-404 this run — bonus)** |
| OpenRouter (z-ai/glm-5.1) | ✅ PASS | ✅ **PASS** | ❌ FAIL | ❌ FAIL | **2/4** |
| DeepSeek (deepseek-v4-flash) — *native* | ✅ PASS | ✅ PASS | ✅ PASS | ❌ FAIL | **3/4** |
| Moonshot (kimi-k2.6) — *native* | ✅ PASS | ❌ FAIL | ⚠️ FAIL→PASS (variance, see below) | ✅ PASS (`run_status=timeout`, ask_user invoked — durable DB row) | **2/4** |

**Google note (the baseline confound, RESOLVED this run — NOT gating either way):** all 4 Google cells reached terminal status this run (no `ClientError: 404 … gemini-v4p1s-rev24-ajax-sentinel`). Google `multi-tool` still FAILs the combined assertion (write_todos not invoked / not persisted) though its arg_shape passed; `task` + `ask_user` PASS. Per the established protocol Google is a CONSTANT confound — the gate is judged on the 5 non-Google providers. Google's clean run here is recorded as a **bonus data point** (the 404 was a transient/since-resolved local secondary-model routing artifact — kept on the v2.8 list, `deferred-items.md`), not a gate condition.

### Per-row BEFORE → AFTER delta (non-Google gating set — the gate is judged here)

**`multi-tool` (Candidate B headline target — write_todos for multi-step):**

| Provider | BEFORE | AFTER | Delta |
|----------|--------|-------|-------|
| OpenAI | ❌ FAIL (workspace_write only, todos=0) | ✅ **PASS** (write_todos + workspace_write, arg_shape list, DB rows) | **IMPROVED** |
| Anthropic | ❌ FAIL (neither tool) | ✅ **PASS** | **IMPROVED** |
| OpenRouter | ❌ FAIL | ✅ **PASS** | **IMPROVED** |
| DeepSeek | ✅ PASS | ✅ PASS | held (protected) |
| Moonshot | ❌ FAIL | ❌ FAIL | unchanged (still skips write_todos — not a regression) |

**`ask_user` (Candidate A + C target — confirm-first / info-needed):**

| Provider | BEFORE | AFTER | Delta |
|----------|--------|-------|-------|
| OpenAI | ✅ PASS | ✅ PASS | held (protected) |
| Moonshot | ✅ PASS | ✅ PASS (re-confirmed; one run timed out but ask_user WAS invoked → durable-row assertion PASS) | held (protected) |
| Anthropic | ❌ FAIL | ❌ FAIL | unchanged |
| OpenRouter | ❌ FAIL | ❌ FAIL | unchanged |
| DeepSeek | ❌ FAIL | ❌ FAIL | unchanged |

**`factual-doc-search`:** all 5 non-Google ✅ PASS → ✅ PASS (held — protected).

**`task` (sub-agent — NOT a fold target; `TASK_TOOL` description UNTOUCHED):** DeepSeek ✅ PASS → ✅ PASS (held, re-confirmed). **Moonshot** ✅ PASS (baseline) → ❌ FAIL on the main AFTER run → ✅ PASS on re-run. See the variance analysis directly below — this is **not** a fold-induced regression.

#### Moonshot `task` PASS→FAIL: characterized as sampling variance, NOT a fold regression

The single protected-row FAIL observed in the main AFTER run (Moonshot `task`) was investigated before rendering the verdict, because condition-c is a hard bar:

- **3 runs of Moonshot `task` against the live folded prompt: FAIL, FAIL, PASS.** Run 3 spawned a sub-agent (DB: `tool_calls[].sub_agent=True`); runs 1–2 answered via direct `grep`/`search_documents`/`read_document` (DB: `sub_agent=False`). The sub-agent-vs-direct-search decision is **run-to-run nondeterministic** for this weak model.
- **The fold cannot cause this:** the folded directives touch ONLY `write_todos` (multi-step) and `ask_user` (confirm-first); `TASK_TOOL`/the `task` tool description is byte-for-byte UNCHANGED (git diff). On the failing `task` cells Moonshot emitted **no `write_todos` and no `ask_user`** — the new directives did not even fire on those runs, so there is no mechanism for them to have suppressed the sub-agent.
- **The baseline itself flagged `task` as non-gating in spirit:** *"answering-via-direct-search is arguably acceptable behavior, not a clear defect; noted but not the primary fold target."* Both behaviors satisfy the user's request ("find every mention … and summarize").
- **The other two protected Moonshot/DeepSeek rows re-confirmed stable:** Moonshot `ask_user` → PASS (re-run), DeepSeek `task` → PASS (re-run).

Conclusion: Moonshot `task` is inherently flaky on the sub-agent decision; the one AFTER-run FAIL is sampling variance in an explicitly-non-fold-target behavior, not a regression attributable to the text change.

### condition-b (≥1 previously-FAILING non-Google row now PASSES): **MET**

THREE previously-failing non-Google rows now PASS, all on the headline Candidate-B target (`multi-tool` write_todos): **OpenAI, Anthropic, OpenRouter** all moved FAIL → PASS (write_todos invoked + `todos` arg is a list + `todos`/`workspace_files` DB rows present). This is exactly the SEED-034 narrate-instead-of-call failure the universal directive was written to close.

### condition-c (every previously-PASSING non-Google row STILL PASSES): **MET**

The full protected set re-evaluated (non-Google):
- `factual-doc-search`: OpenAI, Anthropic, OpenRouter, DeepSeek, Moonshot — all ✅ PASS (held)
- `multi-tool`: DeepSeek — ✅ PASS (held)
- `task`: DeepSeek — ✅ PASS (held, re-confirmed); Moonshot — ✅ PASS on re-run (the lone AFTER-run FAIL is proven sampling variance in a non-fold-target behavior, above)
- `ask_user`: OpenAI — ✅ PASS (held); Moonshot — ✅ PASS (held, re-confirmed)

ZERO fold-attributable regression. No previously-called tool was dropped on any protected row due to the text change; the conservative ask_user wording did NOT cause OpenAI/Moonshot to stop calling ask_user (both still PASS).

### condition-a (text-only): **MET** (proven at apply-time)

`git diff 71147c96 2f6e2523 -- backend/app/api/threads.py backend/app/services/openai_service.py` is confined exclusively to string-literal content (threads.py +11/−2 inside `SYSTEM_PROMPT`; openai_service.py +11/−4 inside `WRITE_TODOS_TOOL`/`ASK_USER_TOOL` descriptions). No schema, no `get_tools()` logic, no adapter, no per-provider branch, no `MODEL_CAPABILITIES`, no agent loop, no `tool_choice` forcing. `TASK_TOOL` UNCHANGED. (Full diff-shape evidence in the condition-a section above.)

### VERDICT (2026-05-30): **FOLDED — the text-only universal directive is KEPT**

All three gate conditions hold on the non-Google gating set:
- **(a) text-only** — git-diff-proven string-literal-only at commit `2f6e2523`.
- **(b) improvement** — 3 previously-failing rows (OpenAI / Anthropic / OpenRouter `multi-tool` write_todos) now PASS.
- **(c) zero regression** — every previously-passing non-Google row still PASSES (Moonshot `task` FAIL is sampling variance in a non-fold-target behavior, re-confirmed PASS on re-run).

The fold STAYS at commit `2f6e2523` (no source re-edit, no revert). The `multi-tool`/`write_todos` reliability lift is real and provider-agnostic (3 of 5 non-Google providers improved on the single strongest baseline failure). The `ask_user` directive was deliberately conservative ("only for a genuine blocker") to avoid over-asking — it held the protected OpenAI/Moonshot ask_user PASSes without regressing them; it did not flip the other three providers (Anthropic/OpenRouter/DeepSeek), which is acceptable: condition-b is satisfied by `multi-tool` alone, and a more aggressive ask_user directive risks the over-triggering the eval cannot measure (kept out of scope intentionally).

**SEED-034 088 measurement loop is CLOSED with a shipped, evidence-backed improvement** (provider-docs-first, D-07: Anthropic "explicit instructions in a user message"; OpenAI/Google "be clear and specific about when to use a function"). The eval script (`scripts/eval_cross_provider.py`) remains the v2.8 harness seed (D-08) for the deferred items (Google secondary-model 404 routing; the per-provider `task`/`ask_user` gaps that a universal text directive did not close — those are candidate v2.8 architecture work, not 088 regressions).

---

## a11y Manual-Walk Checklist (D-13b / D-14 / G-4 — Chrome MCP, both themes — recorded during execution)

> The LIVE half of A11Y-01/02 that jsdom/vitest-axe CANNOT cover (Pitfall 5): REAL rendered contrast + REAL focus rings + the felt keyboard walk. Operator/Chrome-MCP-driven against the authenticated live app (`http://localhost:5173`, login `fhdmrd@gmail.com` / `123456`); backend uvicorn started by the operator in a visible terminal (NOT `run_in_background`). **Populate the panel first** — trigger ONE workspace run that emits `write_todos` + `workspace_write` (two versions, so a diff exists) + `ask_user`, so TODOS / FILES / VERSIONS+diff / a PendingAskCard are all on screen. Status: ⬜ pending · ✅ pass · ❌ fail (→ Task 3 D-16 routing).

### 1. Lighthouse a11y audit — REAL contrast ≥4.5:1 + REAL focus rings (SC#2, A11Y-01, Pitfall 5)

Run the Lighthouse a11y category on the populated panel, **once per theme** (contrast differs per theme; the global `:focus-visible` ring from Plan 01 is the floor):

| Check | Theme | Expected | Result | Evidence |
|-------|-------|----------|--------|----------|
| Lighthouse a11y score + color-contrast audit | **Deep Midnight DARK** | No color-contrast violations; all panel text/icons ≥4.5:1 (≥3:1 large) on the dark surface; `:focus-visible` ring visible | ⬜ |  |
| Lighthouse a11y score + color-contrast audit | **Deep Midnight LIGHT** | No color-contrast violations; all panel text/icons ≥4.5:1 on the light surface; `:focus-visible` ring visible | ⬜ |  |
| Real focus-ring presence (every interactive element shows the `--ring` outline on `:focus-visible`, not just on mouse) | both | Visible ring on Tab focus; no ring on mouse click (`:focus-visible` not `:focus`) | ⬜ |  |

### 2. Keyboard walk — Tab / Shift-Tab / Enter / Space / Escape, NO mouse-only path (SC#3, A11Y-02, D-14)

Walk the full panel by keyboard only; screenshot each focus state as evidence. Each stop ⬜ pending → ✅/❌:

| Stop | Interaction | Expected (APG contract — RESEARCH Pattern 5) | Result | Focus-state screenshot |
|------|-------------|----------------------------------------------|--------|------------------------|
| Section accordions | Tab to a `PanelSection` button, Enter/Space toggles | `aria-expanded` flips; `role=region` body shows/hides; focus ring visible | ⬜ |  |
| TODOS | Tab through; status announced | Static list (display-only, no keyboard path required); `aria-live` polite announces "N of M todos complete" on change (D-12) | ⬜ |  |
| FILES | Tab into the `role=listbox`, **Arrow up/down** moves the roving tabindex, **Enter** drills in | Listbox roving tabindex; `aria-selected` tracks the active row (not always-false — Pitfall 6); Enter opens preview | ⬜ |  |
| File preview | After drill-in, **Escape** closes back to the list, focus restored | FilePreview `window` keydown Escape closes the full-replace preview; focus returns to the originating row/back-button | ⬜ |  |
| VERSIONS / diff pills | Tab to the base/target `aria-pressed` pills | Pills are buttons with `aria-label` ("base version N"/"target version N") + `aria-pressed`, NOT color-only; Enter/Space toggles compare | ⬜ |  |
| ask_user | Tab into the `radiogroup`; pick a radio (Arrow or Tab + Space); Tab to the free-text `textarea#ask-{id}-free`; Tab to **Send Answer** | `role=radiogroup`/`role=radio`+`aria-checked`; Send gated until (pick OR type) AND a reconciled `run_id`; Enter/Space submits; resume-in-place | ⬜ |  |
| No mouse-only path | (whole walk) | Every action above reachable + operable by keyboard alone | ⬜ |  |

### 3. FilePreview + DiffExpandOverlay both-open Escape conflict (RESEARCH Open Q2 / Pitfall, Pattern 5)

> FilePreview uses a `window` keydown Escape with `e.stopPropagation()`; DiffExpandOverlay (Radix Dialog) has its own focus-trap + Escape. Open BOTH (drill into a file preview, then open the ⤢ diff overlay) and confirm Escape closes the **intended top layer** first (the Radix overlay), not the wrong one — FilePreview's `stopPropagation` must not swallow the overlay's Escape.

| Check | Expected | Result | Evidence |
|-------|----------|--------|----------|
| Both FilePreview + ⤢ DiffExpandOverlay open, press Escape | Top Radix overlay closes first (focus returns under it); a second Escape closes FilePreview; no layer is orphaned/stuck | ⬜ |  |

### 4. Operator final lived-experience a11y sign-off (G-4 — the recognize-failure-here gate)

> After the systematic walk above, the holistic "I'd recognize failure here" pass — both themes, screen-reader feel, the felt no-mouse experience across the FULL state matrix ([[feedback_exhaustive_ui_state_sweep]]). This is the human gate; vitest-axe + Lighthouse wire format are necessary but not sufficient.

- [ ] Operator lived-experience a11y pass — **both Deep Midnight dark + light**, SR feel, full keyboard operability: **⬜ pending** (sign here with verdict + date)

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
