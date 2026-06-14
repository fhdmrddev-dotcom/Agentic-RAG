---
phase: 104
slug: pm-flagship-content-pack
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-14
---

# Phase 104 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: see `## Validation Architecture` in 104-RESEARCH.md.

> NOTE (pre-execution authoring): the Per-Task Verification Map below is PRE-POPULATED for all
> Wave-1 (Plan 01) and Wave-2 (Plan 02) tasks BEFORE those plans execute — every executing task has a
> mapped `<automated>` verify in this file at execution time (the Nyquist contract). `nyquist_compliant`
> stays `false` until Plan 03 Task 1 adds the manual SC#10 cross-provider scoreboard rows + flips it
> `true` (Plan 03's own tasks are then the only remaining unmapped rows, and Task 3 is a manual
> human-verify checkpoint by design).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) |
| **Config file** | backend/pytest.ini (existing) |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_pm_pack_templates.py tests/integration/test_seed_pm_pack.py -q` |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest -q` |
| **Estimated runtime** | Quick run ~5-15s (CONFIRMED at Plan 03 Task 1: Plan 02 ran `test_seed_pm_pack.py` at **4 passed in 4.14s** with the live `:54322` stack up; `test_pm_pack_templates.py` unit is sub-second. Integration SKIPs cleanly when `:54322` is down — `SEED_PM_RUN_INGEST` unset, so no embeddings fire) |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}`
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 104-01-01 | 01 | 1 | PM-01 | T-104-01-02 / T-104-01-03 | Synthetic-only corpus (no PII/secrets, no adversarial citation strings); content + template files only — no DB/network | unit (build + reopen) | `backend/venv/Scripts/python.exe scripts/pm-pack/make_pm_corpus.py && backend/venv/Scripts/python.exe scripts/pm-pack/make_pm_templates.py` | ❌ W0 | ⬜ pending |
| 104-01-02 | 01 | 1 | PM-01 | T-104-01-01 | Inline P×I Score is a fixed author expression inside docxtpl SandboxedEnvironment(autoescape) — no arbitrary Python, no user-controlled template; operates only on citation-gated cells | unit (build + reopen) | `backend/venv/Scripts/python.exe scripts/pm-pack/make_pm_templates.py && backend/venv/Scripts/python.exe -c "from docx import Document; d=Document('scripts/pm-pack/templates/risk-register.docx'); print('reopen ok', len(d.tables))"` | ❌ W0 | ⬜ pending |
| 104-01-03 | 01 | 1 | PM-01 | T-104-01-01 | Proves the worded→numeric Score renders via the sandboxed inline Jinja (no backend code); fixture shape provably matches build_context dict output (no divergent false-pass) | unit | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_pm_pack_templates.py -x -q` | ❌ W0 | ⬜ pending |
| 104-02-01 | 02 | 2 | PM-01 | T-104-02-01 / T-104-02-03 / T-104-02-07 | Slug regex guard (no path traversal); secrets NAME-ONLY via dotenv; DEMO_USER_ID pre-flight aborts on RLS-owner mismatch (no wrong-owner seed) | unit (ast.parse + grep) | `cd "C:/Vibe Apps/Agentic RAG" && backend/venv/Scripts/python.exe -c "import ast; ast.parse(open('scripts/seed-pm-pack.py').read()); print('parses ok')"` | ❌ W0 | ⬜ pending |
| 104-02-02 | 02 | 2 | PM-01 | T-104-02-04 / T-104-02-06 | 2-phase def validates; render_template absent from any available_tools (clean server-side bound-template shape); output_file_valid config:{} re-opens the produced file (SC#2 integrity gate provably live, not false-green); DELETE-then-INSERT only | unit (model_validate + def-shape assert) | `cd "C:/Vibe Apps/Agentic RAG" && backend/venv/Scripts/python.exe -c "import sys; sys.path.insert(0,'backend'); from dotenv import load_dotenv; load_dotenv('backend/.env'); import importlib.util as u; s=u.spec_from_file_location('seed','scripts/seed-pm-pack.py'); m=u.module_from_spec(s); s.loader.exec_module(m); from app.models.harness import WorkflowDefinition; f='11111111-1111-1111-1111-111111111111'; d=m.build_status_def(f,'d8a54002-6a29-4b88-b918-cff2aa4a06d5/_library/pm-weekly-status-report.docx'); WorkflowDefinition.model_validate(d); r=m.build_risk_def(f,'d8a54002-6a29-4b88-b918-cff2aa4a06d5/_library/pm-risk-register.docx'); WorkflowDefinition.model_validate(r); import json; assert 'render_template' not in json.dumps([p['config'].get('available_tools',[]) for p in d['phases']]); ofv=[v for v in d['phases'][1]['validators'] if v['kind']=='output_file_valid'][0]; assert ofv['config']=={}; print('ok')"` | ❌ W0 | ⬜ pending |
| 104-02-03 | 02 | 2 | PM-01 | T-104-02-02 / T-104-02-04 / T-104-02-06 / T-104-02-07 | Live-DB proof: idempotency (no dup rows), 2-phase def shape (render_template absent, output_file_valid config:{}), immutability UPDATE→CheckViolation, RLS isolation (is_global=false, owner-scoped corpus) | integration (live :54322 or SKIP) | `cd backend && venv/Scripts/python.exe -m pytest tests/integration/test_seed_pm_pack.py -x -q` | ❌ W0 | ⬜ pending |
| 104-03-01 | 03 | 3 | PM-01 | T-104-03-02 | Cross-provider kickoff harness opt-in gated (no auto provider-spend); pure client (no backend write paths). VALIDATION.md finalized (SC#10 scoreboard + nyquist flip) | unit (ast.parse + grep) | `cd "C:/Vibe Apps/Agentic RAG" && backend/venv/Scripts/python.exe -c "import ast; ast.parse(open('scripts/pm-pack/scoreboard_smoke.py').read()); print('ok')"` | ✅ harness | ✅ green |
| 104-03-02 | 03 | 3 | PM-01 | T-104-03-03 / T-104-03-04 | Runbook drives the LIVE publish gauntlet (judge hard-wall) on a Tweak v2 fork with v1 immutability psql read-back | doc (grep) | `cd "C:/Vibe Apps/Agentic RAG" && grep -q "UAT-1" ".planning/phases/104-pm-flagship-content-pack/104-HUMAN-UAT.md"` | ✅ runbook | ✅ green |
| 104-03-03 | 03 | 3 | PM-01 | T-104-03-01 / T-104-03-03 | Live human-verify checkpoint (manual by design): SC#2 cited integrity-checked .docx, SC#1/#3 author proof, SC#10 scoreboard incl. honest-fail/no-silent-narration | manual (human-verify) | MANUAL — see 104-HUMAN-UAT.md + the SC#10 manual scoreboard rows below | ❌ pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*The map above covers the failure modes in 104-RESEARCH.md `## Validation Architecture`:*
- *citation-gate false-green → 104-02-02/03 def shape (2-phase, render_template absent) + the live headline run citation red-case (UAT-2)*
- *integrity-gate false-green → 104-02-02 output_file_valid config:{} (produced-file re-open proven) + 104-01-03 unit + the live UAT-1*
- *RLS pollution → 104-02-03 Test 4 (is_global=false, owner-scoped)*
- *immutability UPDATE failure → 104-02-03 Test 3 (CheckViolation)*
- *RLS-owner mismatch (stale DEMO_USER_ID) → 104-02-01 assert_demo_uid pre-flight (T-104-02-07)*
- *GLM/MiniMax case-miss silent coerce → the SC#10 exact-ID scoreboard rows (PascalCase MiniMax-M3 / glm-4.6) + the COERCE-tier watch below*
- *reasoning-truncation half-emit → the long-deliverable manual scoreboard row below*

---

## Wave 0 Requirements

- [x] Per-task verification map pre-populated for all Wave-1/Wave-2 tasks (this file) BEFORE Plan 01 executes
- [ ] Test stubs for PM-01 land WITH their tasks (104-01-03 unit + 104-02-03 integration are the test tasks themselves — no separate stub needed; the `❌ W0` File-Exists flips ✅ when the task creates the test)
- [x] Shared fixtures: mirror `backend/tests/fixtures/seed_library_asset.py` recipe (Plan 02 canonical_analog)

*No separate Wave-0 stub task is required: the two test artifacts (test_pm_pack_templates.py, test_seed_pm_pack.py) are produced by the tasks they verify (104-01-03, 104-02-03), and each guards itself with skip-if-not-built / skip-if-stack-down so the suite stays green out of order. The `<automated>` command for every executing task already exists in this map.*

---

## Manual-Only Verifications (SC#10 4-axis cross-provider scoreboard — authored by Plan 03 Task 1)

> Plan 03 Task 1 fills the EXACT PascalCase registry model IDs (D-104-6 / S-7 — a wrong case silently
> degrades to coerce) into the rows below, then sets `nyquist_compliant: true`. The runs execute at the
> Plan 03 Task 3 human-verify checkpoint (104-HUMAN-UAT.md), evidence captured from
> `scripts/pm-pack/out/scoreboard-*.json` (emitted by the **opt-in** cross-provider harness
> `scripts/pm-pack/scoreboard_smoke.py --run` — preview-only by default, never auto-fires provider spend).
>
> **The harness automates the kickoff + outcome capture** (produced `.docx`, `citation_gate`,
> `integrity_gate`, `truncated`, `honest_failure`, `narrated_text`) per pinned model ID. A FORCE-tier row
> PASSES only on a cited, integrity-clean `.docx`; a COERCE-tier row PASSES on a produced file OR an
> honest failure — a `narrated_text:true` (silent field-map-as-prose) is ALWAYS a FAIL (T-104-03-01).
> The "opens clean in a real editor", the parallel-thread axis, and the live author-flow stay MANUAL.

| Axis | Behavior | Requirement | Why Manual | Test Instructions / Expected |
|------|----------|-------------|------------|------------------------------|
| Cross-provider FORCE+strict | Status def fill produces a clean cited `.docx` | PM-01 | Live cross-provider run | Run the headline Status fill on OpenAI `gpt-5.4` + DeepSeek `deepseek-v4-pro` (FORCE-tier + strict) — clean cited .docx, citation + integrity gates pass |
| Cross-provider FORCE (no strict) | Status def fill produces a clean cited `.docx` | PM-01 | Live cross-provider run | Run on Anthropic `claude-opus-4-8` (thinking off) + Google `gemini-2.5-pro` + MiniMax `MiniMax-M3` (PascalCase) + GLM `glm-4.6` — clean cited .docx. WATCH: `minimax-m3-invalid-tool-args-400` on the MiniMax row; the exact PascalCase ID mitigates the case-drop path |
| Cross-provider COERCE | Coerce-success OR honest-fail, NEVER silent narration | PM-01 | Live cross-provider run | Run on Moonshot `kimi-k2.6` (COERCE-tier) — passes ONLY on a real coerce-success or a visible honest failure; a narrated field-map as prose is a FAIL |
| Case-miss NEGATIVE control (optional) | A wrong-case id silently degrades to coerce (the trap is real) | PM-01 | Live cross-provider run | Optional demonstration row: run a DELIBERATELY wrong-case id (e.g. `minimax-m3` lowercase, or `GLM-4.6`) — observe it degrade to COERCE (field-map narrated, not forced). This is the negative control that PROVES the exact-PascalCase rows above are load-bearing (RESEARCH §Validation Architecture "GLM/MiniMax case-miss silent coerce"). NOT a pass/fail gate — a documented control |
| Multi-tool | 2-phase retrieve(search_documents)+emit(render_template) exercises 2 tools in one run | PM-01 | Inherent in the pipeline | The seeded def IS 2-tool (search_documents then the bound-template emit) — note satisfied by any FORCE-tier headline run |
| Parallel-thread | Thread A streaming a status run while Thread B accepts a new prompt | PM-01 | Live multi-thread UI | Kick off a Status run in Thread A; while it streams, open Thread B and submit a prompt — both hold (no cross-thread bleed/drop) |
| Long-message / long-deliverable | `is_truncated` fires as an HONEST failure, never a half-emitted .docx | PM-01 | Live long-output run per provider | Run the long-deliverable row on DeepSeek `deepseek-v4-pro` OR Moonshot `kimi-k2.6` — expected to fire `is_truncated` as an honest failure, NOT a half-emitted/corrupt .docx |
| Charter NL-authoring | OpenAI + DeepSeek author a TEXT-deliverable Charter (no template) without a strict-mode 400 | PM-01 | Live UI authoring flow | Author a Project Charter (describe→draft→refine→publish) on OpenAI `gpt-5.4` + DeepSeek `deepseek-v4-pro` — confirm the Phase-103 `strict=False` override avoids a strict-mode 400; deliverable is llm_single/llm_agent TEXT, never render_template |
| Tweak → v(N+1) re-author | Fork published def → edit → re-publish through the live gauntlet; v1 frozen | PM-01 | Live publish/fork flow | Fork the seeded Status def via Tweak → v2 draft → edit → drive `POST /workflows/{id}/publish` (golden run + judge HARD blocker) → flips published; psql-confirm v1 unchanged (immutability). Repeat the publish fork on the Risk Register |

*If any of the above become automatable during planning, move to the per-task map. (The scoreboard_smoke.py harness from Plan 03 Task 1 AUTOMATES the kickoff + outcome capture for the cross-provider rows; the "opens clean in a real editor" + parallel-thread + author-flow confirms stay manual.)*

---

## Validation Sign-Off

- [x] All Wave-1/Wave-2 tasks have an `<automated>` verify mapped in the Per-Task Map (pre-populated)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (104-01-01..104-02-03 each carry an `<automated>` command; Plan 03's 104-03-01/02 are automated, 104-03-03 is the by-design manual human-verify)
- [x] Wave 0 covers all MISSING references (the two test artifacts are produced by the tasks they verify; no separate stub task — see the Wave 0 note)
- [x] No watch-mode flags (the only flag is the MiniMax `minimax-m3-invalid-tool-args-400` SCOREBOARD watch — a live-run caution, NOT a test watch-mode flag)
- [x] Feedback latency < 30s (quick run CONFIRMED ~5-15s — Plan 02 integration ran 4 passed in 4.14s)
- [x] SC#10 4-axis scoreboard rows filled with EXACT PascalCase registry IDs (Plan 03 Task 1 — `gpt-5.4`, `deepseek-v4-pro`, `claude-opus-4-8`, `gemini-2.5-pro`, `MiniMax-M3`, `glm-4.6`, `kimi-k2.6`, + the Charter NL-authoring row, the long-deliverable truncation row, the parallel-thread axis, and the optional case-miss negative control)
- [x] `nyquist_compliant: true` set in frontmatter (Plan 03 Task 1, after the SC#10 rows are filled)

**Approval:** Nyquist contract finalized 2026-06-15 (Plan 03 Task 1). Per-task map complete (all 6 Wave-1/2 IDs); SC#10 4-axis scoreboard authored with exact registry IDs; `scripts/pm-pack/scoreboard_smoke.py` automates the cross-provider kickoff+capture. The live SC#10 runs + the "opens clean in a real editor" / parallel-thread / author-flow manual confirms execute at the Plan 03 Task 3 human-verify checkpoint (104-HUMAN-UAT.md).
</content>
