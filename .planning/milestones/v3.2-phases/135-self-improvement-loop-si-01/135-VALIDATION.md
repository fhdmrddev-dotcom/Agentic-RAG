---
phase: 135
slug: self-improvement-loop-si-01
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
---

# Phase 135 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `135-RESEARCH.md` → `## Validation Architecture`. **SC#10 applies (D-15)** — this
> phase touches agent-loop consumption (the instructions-override seam) + provider routing
> (proposer LLM + re-eval reuses the gateway) + UI state (proposal card), so the 4-axis manual
> UAT rows below are MANDATORY and live in this file (not in PLAN tasks).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, `asyncio_mode = auto`) · Vitest (frontend — pre-existing vitest rot SEED-056; new `lineDiff` util test is pure-logic and safe; render coverage → live UAT) |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`); `frontend/` vitest via `package.json` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/test_skill_proposals.py -x` (per net-new file, targeted) |
| **Full suite command** | `cd backend && venv/Scripts/python -m pytest tests -q` |
| **Estimated runtime** | ~30–90 seconds (proposer LLM + judge + runner all mocked — NO live LLM/DB in unit tests) |

**Test precedent to mirror:** `backend/tests/test_eval_runner.py` (mocks `run_agent_loop` to a fake
`AgentLoopResult`, in-memory supabase fake, `_FakeRedis`, `AsyncMock` pool) and
`backend/tests/test_evals_router.py` (route owner-scoping via `TestClient` + `get_supabase` fake).

---

## Sampling Rate

- **After every task commit:** Run the touched file's targeted test (`pytest tests/<file>.py -x`)
- **After every plan wave:** Run `cd backend && venv/Scripts/python -m pytest tests -q` + `cd frontend && npx vitest run src/lib/lineDiff.test.ts`
- **Before `/gsd:verify-work`:** Full backend suite green, THEN the live SC#10 UAT rows below
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Task IDs finalized after `/gsd:plan-phase` writes the PLAN.md files. Rows below key the
> automated tests to SI-01 behaviors and locked decisions. Proposer emission, judge, and
> `run_eval_job` are ALL mocked (`patch("app.services.forced_emit.forced_emit", ...)` /
> fake `AgentLoopResult`) — no live provider calls in unit tests.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | — | SI-01 / D-03, D-04 | prompt-injection (evidence-as-DATA) | Propose returns ONE schema-bound instruction edit from the evidence bundle; honest `None` (no fabrication) when no builder model resolves | unit | `pytest tests/test_skill_proposer.py::test_propose_emits_one_edit -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-02 | — | Evidence bundle surfaces the judge-PASS × human-DOWN disagreement row (U9 fixture) as top cue | unit | `pytest tests/test_skill_proposer.py::test_disagreement_is_top_cue -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-05 | never-auto-apply | Approve INSERTs `skill_versions(source='self_improve')` WITHOUT touching `skills` | unit | `pytest tests/test_skill_proposals.py::test_approve_creates_self_improve_version -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-07, D-10 | audit trail | Reject sets `status='rejected'`; no version row, no `skills` write | unit | `pytest tests/test_skill_proposals.py::test_reject_is_pure_audit -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-05, D-12 | Deep byte-identical (red line) | Re-eval loads the DRAFT instructions (override honored); `load_skill` unchanged when override is None; Deep-mode guard re-affirmed | unit | `pytest tests/test_load_skill_override.py -x` && `pytest tests/test_agent_loop_catalog_override.py::test_deep_mode_unchanged -x` | ❌ W0 (2nd exists — re-affirm) | ⬜ pending |
| TBD | TBD | — | SI-01 / D-13 | honest gate math | Gate: no-regression + ≥1 newly-passing, case-matched (join `test_case_id`, with-skill arm); `not_measured` excluded from BOTH sides; changed case set → intersection only | unit | `pytest tests/test_promotion_gate.py -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-05 | — | Pass → promotion UPDATEs live `skills` (132 trigger dup version accepted); Fail → `skills` untouched, `status='not_promoted'`, version row remains as evidence | unit | `pytest tests/test_skill_proposals.py::test_promotion_paths -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-06 | override-with-evidence | Force-promote on fail records the override on the proposal with the failed re-eval evidence linked | unit | `pytest tests/test_skill_proposals.py::test_force_promote_records_override -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-14 | honest interrupted state | Interrupted re-eval → proposal `status='interrupted'` + re-run affordance; never stuck `re_evaling` | unit | `pytest tests/test_skill_proposals.py::test_interrupted_state -x` | ❌ W0 | ⬜ pending |
| TBD | TBD | — | SI-01 / D-07 | T-IDOR (cross-user 404) | Cross-user propose/get/approve/reject/promote → 404 never 403 (owner gate before any read/write) | integration | `pytest tests/test_skill_proposals_router.py::test_cross_user_404 -x` | ❌ W0 (new file) | ⬜ pending |
| TBD | TBD | — | SI-01 / D-09 | — | Unified line diff util: add/remove/unchanged classification correct on insert/delete/replace/no-op cases | unit (vitest) | `cd frontend && npx vitest run src/lib/lineDiff.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **NEW** `backend/tests/test_skill_proposer.py` — proposer emission + disagreement-top-cue + honest-`None` floor (mirror `test_eval_runner.py` fakes)
- [ ] **NEW** `backend/tests/test_skill_proposals.py` — approve/reject/promote/force/interrupted lifecycle (in-memory supabase fake)
- [ ] **NEW** `backend/tests/test_skill_proposals_router.py` — owner-scoping / cross-user 404-not-403 (model on `test_evals_router.py`)
- [ ] **NEW** `backend/tests/test_load_skill_override.py` — additive instructions-override + None ⇒ byte-identical guard
- [ ] **NEW** `backend/tests/test_promotion_gate.py` — D-13 case-matched gate math (pure function, exhaustive edge cases)
- [ ] **NEW** `frontend/src/lib/lineDiff.test.ts` — LCS line-diff classification
- [ ] Shared fixtures: reuse `test_eval_runner.py`'s in-memory supabase fake + `_FakeRedis` (extend `conftest.py` only if needed)

---

## Manual-Only Verifications — SC#10 4-Axis UAT (D-15, MANDATORY)

> Authored here, NOT in PLAN tasks. The proposer is a NEW LLM call routed via
> `resolve_skill_builder_model`, and the re-eval reuses the 133 runner on the source run's
> provider (D-11) — UAT must prove the whole loop (propose → review diff → approve → re-eval →
> promote/not-promote) live on ≥2 providers, plus the honest `interrupted` and `not_measured`
> rows. G-4 lived-experience scenarios on the proposal card included (user-visible UI).
> Drive via Chrome MCP or operator-clicks (Chrome-MCP-hangs fallback, `feedback_chrome_mcp_testing`).

| # | Axis | Requirement | Scenario | Honest-loop assertion |
|---|------|-------------|----------|-----------------------|
| U1 | Cross-provider: OpenAI (full loop #1) | SI-01 SC#1–3 | Source eval run on a gpt-5.x model → "Propose improvement" → review diff → approve → auto re-eval → gate | Proposal is a real unified diff with rationale + cited evidence; re-eval runs on the SAME gpt-5.x model (D-11); verdict gates promotion with honest case-matched counts |
| U2 | Cross-provider: Anthropic (full loop #2) | SI-01 SC#1–3, SC#4 | Same full loop with a claude source run | Proposer (builder model) and re-eval both route correctly; no shared-path fork; promotion applies instructions to live skill only on pass |
| U3 | Cross-provider: Google | SI-01 SC#4 | Propose from a gemini-3.x source run | Proposer schema survives (no Gemini `type:[...]` trap — flat single-typed fields); diff renders; re-eval routes to Google |
| U4 | Cross-provider: OpenRouter | SI-01 SC#4 | Propose from an OpenRouter-representative source run | Loop holds (OpenRouter experimental — native-safe assertion only) |
| U5 | Multi-tool | SI-01 SC#3 | Re-eval a skill whose test case exercises 2+ tools (`search_documents` + `execute_code`) | Draft-version instructions actually loaded in the WITH arm (Pitfall #1 seam proven live); multi-tool answer graded; gate compares case-matched |
| U6 | Parallel-thread | SI-01 SC#3 | Re-eval streaming on skill A while a chat thread B streams | No cross-talk; proposal/re-eval events only on the eval run buffer; chat unaffected; both readouts correct |
| U7 | Long-message | SI-01 SC#1 | Propose on a skill with a long instruction body (≥5 KB) and a fat evidence bundle (many cases + ratings) | Proposer emission completes without truncation (16K-token forced-emit precedent); diff renders the long body legibly |
| **U8** | **Honest rejection + not_measured (D-13)** | **SI-01 SC#2–3** | **Reject a proposal (nothing changes); then approve one whose re-eval includes a `not_measured` case** | **Reject = pure audit (no version, live skill untouched); `not_measured` excluded from gate counts on BOTH sides, honest counts displayed alongside the verdict** |
| **U9** | **Interrupted re-eval (D-14 mandatory)** | **SI-01 SC#3** | **Restart the backend (or kill the run) mid-re-eval** | **Proposal surfaces honest "interrupted — not promoted" (NEVER stuck "re-evaling…"); re-run affordance works; live skill untouched** |
| U10 | Failed-gate + override (D-06) | SI-01 SC#3 | An approved version whose re-eval FAILS the gate; then force-promote | Default = not-promoted with the failing evidence rendered; explicit force-promote works, records the override on the proposal |
| U11 | G-4 lived experience: proposal card | SI-01 SC#1–2 | Watch the full card lifecycle end-to-end: propose (pending) → diff render → approve → live re-eval readout → terminal state; collapse/expand; both themes | Card states honest at every step; diff readable (red removed / green added); rationale + evidence shown; re-eval reuses the live eval readout + heartbeat (no frozen state) |

*U5 doubles as live proof of the Pitfall #1 fix (draft instructions actually measured). U9 is the
D-14 obligation (BUG-260702-02 deferred to SEED-100 — 135 owes exactly this honest state).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies *(finalize after plans written)*
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (6 new test files, precedent-mirrored)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [ ] SC#10 4-axis UAT (U1–U11) executed live before phase close (D-15) — *pending `/gsd:verify-work`*
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** plan-time structural sign-off pending plan-checker Nyquist dimension pass.
