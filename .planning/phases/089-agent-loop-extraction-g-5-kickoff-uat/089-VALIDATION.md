---
phase: 089
slug: agent-loop-extraction-g-5-kickoff-uat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 089 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 089-RESEARCH.md §"Validation Architecture". Acceptance bar = **byte-identical SSE per native-7 provider** (captured-diff-empty), NOT "tests pass".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (`asyncio_mode = auto`) — `backend/pytest.ini` (`testpaths = tests`) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/integration/test_075_4_terminal_race.py backend/tests/unit/test_chunk_handler_provider_aware.py -x` |
| **Full suite command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/ -q` |
| **E2E backstop** | `frontend/tests/e2e/scenario-*.spec.ts` (13 Playwright scenarios) via `frontend-tests.yml` |
| **Eval gate** | `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py` (**operator-run, live native-7 keys**) |
| **Estimated runtime** | quick ~30s · full suite ~minutes · eval/E2E operator-driven |

---

## Sampling Rate

- **After every task commit:** Run quick run command (terminal-race + chunk-handler unit tests) — **< 30s**.
- **After every plan wave:** Run full pytest suite — must be GREEN.
- **Before `/gsd-verify-work`:** Full suite GREEN **+** eval scoreboard GREEN **before AND after** the lift **+** SSE-diff empty per native-7 provider **+** 4-axis UAT in BOTH modes **+** CF-01 dispositions recorded.
- **Max feedback latency:** 30 seconds (commit-level).

---

## Per-Task Verification Map

> Task IDs are filled by the planner once PLAN.md files exist. Every task must map to an automated `<automated>` verify or a Wave 0 dependency. SC→validation mapping below is the contract the planner's tasks must satisfy.

| SC | Behavior | Validation type | Command / surface | Exists? |
|----|----------|-----------------|-------------------|---------|
| SC#1 (FOUND-03) | Loop + `_on_chunk_*` + `_persist_assistant_message` + tool-dispatch round moved **verbatim** into `agent_loop.py::run_agent_loop()`; `threads.py` retains only route + producer shell + `_emit`/`_spawn` + `_shielded_finalize` | structural diff + full suite | full pytest GREEN + `git diff` review of the seam | ✅ suite; ❌ W0 monkeypatch-target update |
| SC#2 | Every per-provider invariant (I1–I14) carried verbatim + **NAMED in VERIFICATION** | unit + named checklist | `test_066_*`, `test_075_*`, `test_chunk_handler_provider_aware`, `test_explorer_agent` + the I1–I14 table | ✅ tests; ❌ VERIFICATION enumerates I1–I14 |
| SC#3 | Byte-identical SSE per native-7 provider (captured-diff-empty) | NEW capture+diff harness | `capture_run_events` XRANGE before/after + `normalize()` → assert empty diff per provider (operator-run live) | ❌ W0 — new capture helper + before/after runbook |
| SC#3 (backstop) | Eval + E2E GREEN **before AND after** | eval + Playwright | `eval_cross_provider.py` (native-7) + `scenario-*.spec.ts` | ✅ exist; ❌ W0 +2 providers (D-089-09) |
| SC#4 | Explorer branch preserved byte-identically (6-KB tools, dedicated prompt, `max_iterations=8`) | unit + 4-axis UAT in BOTH modes | `test_explorer_agent.py` + manual UAT General AND Explorer | ✅ unit; ❌ UAT rows below |
| SC#5 / EVAL-02 | 4-axis UAT (cross-provider × multi-tool × parallel-thread × long-message) | manual UAT scoreboard | UAT rows below (NOT PLAN tasks) — Chrome MCP + operator backend | ❌ authoring |
| CF-01 | 3 carry-forwards verified-closed or re-opened with a re-open trigger | hybrid (Chrome MCP + eval) | per-item checks (title-gen native-7, Google-404, download-link) | ❌ runbook + dispositions |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Monkeypatch-target sweep** — update ~15 integration tests' `app.api.threads.create_adaptive_streaming_chat` → `app.services.agent_loop.create_adaptive_streaming_chat` (grep-driven). `generate_thread_title` patches **STAY** (title-gen stays in `threads.py`). *Prerequisite — without it the suite goes red on the move.*
- [ ] **`scripts/eval_cross_provider.py` +2 providers** — add `("zhipu","<curated-glm-id>")` + `("minimax","<curated-minimax-id>")` to `PROVIDERS`; add `ZHIPU_API_KEY`/`MINIMAX_API_KEY` to `report_env_presence()` (D-089-09 — additive proof-harness work, NOT loop edits). Keys now live in operator `backend/.env` (added 2026-05-30).
- [ ] **SSE capture helper** — `capture_run_events(redis, run_id)` (XRANGE `run:{run_id} - +`) + `normalize()` masking run_id/message_id/timestamps + a before/after diff runbook the operator runs per native-7 provider.
- [ ] **`AgentLoopResult` seam test** — assert the finalizer (`_shielded_finalize`, STAYS) still receives a valid persisted message id + token totals + warnings from the moved loop (no existing test covers this seam).
- [ ] **VALIDATION UAT rows** — authored below (4-axis × both modes + CF-01 dispositions).

*Framework install: none — pytest + Playwright already present.*

---

## 4-Axis Kickoff UAT (SC#10 recipe — manual, authored here NOT in PLAN tasks)

> Native-7 = openai, anthropic, google, deepseek, moonshot, **zhipu/GLM, minimax** (D-089-05). Run on the EXTRACTED loop; no behavior change vs. pre-lift. Chrome MCP drives browser-observable rows (`http://localhost:5173/`, login `fhdmrd@gmail.com`); operator runs the backend eval for live-key rows.

| # | Axis | Mode | Scenario | Pass condition |
|---|------|------|----------|----------------|
| U1 | Cross-provider × Multi-tool | General | One multi-tool prompt (`search_documents` + `execute_code` and/or `write_todos`) run on EACH native-7 provider | Each provider completes the multi-tool round; SSE sequence matches the pre-lift capture (empty diff) |
| U2 | Cross-provider × Multi-tool | Explorer | Same multi-tool prompt on a representative provider in Explorer mode (6-KB tools, `max_iterations=8`) | Explorer toolset + cap unchanged; completes identically to pre-lift |
| U3 | Parallel-thread | General | Thread A streaming a long run while Thread B accepts + starts a new prompt | Both stream independently; no cross-thread bleed; no global `isStreaming` lockout |
| U4 | Long-message | General | A ≥50-message thread OR a ≥5 KB single user prompt | History reconstruction + trim unchanged; ask_user-history thread loads without 500 (086 filter intact) |
| U5 | Explorer preservation | Explorer | Load a thread that exercised Explorer pre-lift; replay | Byte-identical Explorer prompt/toolset/cap behavior |

---

## CF-01 Carry-Forward Dispositions (hybrid driver — D-089-11)

> Each item ends **verified-closed** OR **re-opened with a concrete `re_open_trigger`** and routed to a named later slot. **Zero feature fixes inside 089** (D-089-12).

| # | Item | Driver | Verification surface | Disposition (filled at sweep) |
|---|------|--------|----------------------|-------------------------------|
| C1 | Title-gen on native-7 (BUG-260527-01; ROADMAP names DeepSeek/Moonshot/Google — extend to all 7 per D-089-13) | operator eval + Chrome MCP | Thread auto-title appears + correct model name sent per provider | TBD — re-open → 093 vicinity / quick if still broken |
| C2 | Google secondary-model 404 routing (transient 088-04 artifact) | operator eval | sub-agent / secondary-model call returns 200 on Google | TBD — re-open → 093 vicinity if reproduces |
| C3 | Download-link payload (research: **already fixed in code** L2753-2762 projects `{filename,url,size}`) | Chrome MCP | Final-output card shows a working download link on `http://localhost:5173/` | TBD — verify-closed if working; else SEED-037 `/gsd:quick` (D-089-14) |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Byte-identical SSE per native-7 provider | FOUND-03 / SC#3 | Needs live provider API keys (operator `backend/.env` only) | Operator runs the SSE-capture runbook before + after the lift; assert empty `normalize()` diff per provider |
| Cross-provider eval GREEN before AND after | FOUND-03 / SC#3 | Live keys; operator-run | `python scripts/eval_cross_provider.py` → `EVAL_SUMMARY` native-7 all-pass, twice |
| 4-axis kickoff UAT (U1–U5) | CF-01 / SC#4 / EVAL-02 | Live multi-provider streaming + browser observation | Rows U1–U5 above (Chrome MCP + operator backend) |
| CF-01 dispositions C1–C3 | CF-01 / SC#5 | Live keys + browser | Rows C1–C3 above |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (monkeypatch sweep, eval +2, SSE capture helper, AgentLoopResult seam test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
