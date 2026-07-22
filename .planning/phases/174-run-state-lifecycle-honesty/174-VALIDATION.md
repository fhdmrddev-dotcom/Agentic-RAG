---
phase: 174
slug: run-state-lifecycle-honesty
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-22
---

# Phase 174 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> SC#10 4-axis mandate applies (cross-provider × multi-tool × parallel-thread × long-message). UAT rows are authored HERE, not in PLAN tasks (D-14). Render-layer only, Deep Mode byte-identical.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend unit/component) + manual live UAT (Chrome MCP / operator-driven) |
| **Config file** | `frontend/vitest.config.*` (existing; hot-file tests already present) |
| **Quick run command** | `cd frontend && npm test -- <file>` |
| **Full suite command** | `cd frontend && npm test` |
| **Estimated runtime** | ~30s per-file; full suite a few min |

> **Baseline rot note:** ~14-17 vitest tests are pre-existing ROT (SEED-056), red on both baseline AND HEAD. Validation is **differential** — the phase's touched-file tests must not NEWLY fail; do not chase the pre-existing rot.

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test -- <touched-file>` (the specific hot-file test).
- **After every plan wave:** Run `cd frontend && npm test` (full suite; differential against the SEED-056 rot baseline).
- **Before `/gsd:verify-work`:** Full vitest green (differential) + the SC#10 4-axis live UAT matrix passes with Deep Mode byte-identical.
- **Max feedback latency:** ~30s (per-file).

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| STATE-01a | empty cancelled row → "cancelled — no output yet" from `runStatus='cancelled'` + empty content | component | `npm test -- MessageItem` (extend) | ✅ extend for empty-content case | ⬜ pending |
| STATE-01a | reload-derive: `run_status` zip populates for empty row (DeepSeek early cancel → full cold reload) | manual live UAT | operator DeepSeek early cancel + cold reload | ❌ manual (backend join verified in research) | ⬜ pending |
| STATE-01b | `status===403` → amber bubble + composer unlocked; 400/409 unchanged | component | `npm test -- streamsProvider` (new) | ❌ W0 new test | ⬜ pending |
| STATE-02 | "Response stopped" renders from `runStatus` after nav + reload | component + manual | `npm test -- MessageItem`; manual cold reload | ✅ extend + manual | ⬜ pending |
| STATE-03 | `reasoningActive` → "Reasoning…"; default → "Setting up agent…" (byte-identical) | unit | `npm test -- toolMeta` (new) | ❌ W0 new test | ⬜ pending |
| STATE-03 | reasoning-heavy model shows "Reasoning…" pre-answer | manual live UAT | Kimi/DeepSeek/GLM long-reasoning prompt | ❌ manual | ⬜ pending |
| STATE-04 | single avatar (no pre-runId duplicate) | component | `npm test -- MessageList`/reconcile-race (extend) | ✅ extend for pre-runId case | ⬜ pending |
| STATE-04 | timer anchored to `startedAt` on nav-back | component + manual | extend RunCard/strip timer test; manual multi-minute workflow nav | ⚠ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## SC#10 4-Axis Live UAT Matrix (mandatory)

| Axis | Required coverage for 174 |
|------|---------------------------|
| **Cross-provider** | OpenAI, Anthropic, Google, **+ DeepSeek (REQUIRED for STATE-01a)**; STATE-03 reasoning proof on Kimi/Moonshot **or** GLM (OpenAI-compat). Anthropic/Google keep the "Setting up agent…" fallback for STATE-03 (by design — reasoning not emitted, not a failure). |
| **Multi-tool** | ≥1 row: a prompt driving 2+ tools (e.g. `search_documents` + `execute_code`) while watching the pre-answer → tool → terminal transitions (STATE-03 + STATE-04 timer). |
| **Parallel-thread** | ≥1 row: Thread A streaming a workflow while Thread B accepts a Deep prompt — verify per-thread workflow-lock isolation (STATE-01b lock-clear must not leak) and no cross-thread avatar/timer bleed (STATE-04). |
| **Long-message** | ≥1 row per provider: ≥50 prior messages OR ≥5 KB prompt — stays **manual per provider** (STATE-02 reload-derive on a long thread; STATE-03 reasoning window under load). |

### Reload / Nav Proofs
- **STATE-02:** mid-stream Stop → (a) nav away & back, (b) **full cold browser reload** → "Response stopped" still shown, both on ≥1 provider.
- **STATE-04:** multi-minute streaming workflow → nav away & back → timer continues from real elapsed (no reset) + exactly one avatar, on a fast (OpenAI) and a slow (Google/OpenRouter) provider.

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/__tests__/toolMeta.test.ts` — assert `outerBannerLabel` default byte-identical + the new `reasoningActive` branch (STATE-03 + D-14 guard).
- [ ] New StreamsProvider catch test — `status===403` → amber field set + workflow-lock cleared for the thread; 400/409 paths unchanged (STATE-01b).
- [ ] Extend `MessageItem.test.tsx` — empty-content `runStatus='cancelled'` → `cancelled-no-output` testid (STATE-01a).
- [ ] Extend the reconcile-race / dedup test with a **pre-runId** duplicate scenario (STATE-04 avatar).
- [ ] Timer-anchor test for the workflow-run strip (or extend the RunCard timer test for the kickoff-placeholder `startedAt`) — pin the target component in plan Wave-0.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DeepSeek early-cancel empty bubble → honest affordance after full cold reload | STATE-01a | Needs a live provider stream + real cancel timing before first token | Stream DeepSeek, Stop ~5-7s in, nav away+back, full browser reload → "cancelled — no output yet" holds |
| Kill-switch 403 amber reason + composer unlocked | STATE-01b | Needs the operator kill-switch OFF + a live workflow launch | Control Plane → Workflows kill-switch OFF; launch a workflow from chat → amber "disabled by the administrator" bubble, composer usable |
| Reasoning-heavy pre-answer "Reasoning…" | STATE-03 | Needs a live reasoning-model stream | Kimi/DeepSeek/GLM long-reasoning prompt → "Reasoning…" during the pre-first-token gap |
| Multi-minute workflow timer + single avatar on nav-back | STATE-04 | Needs a real multi-minute streaming workflow + navigation | Launch a long workflow, nav away+back on a fast + a slow provider → timer keeps climbing, exactly one avatar |
| Long-message reload-derive (SC#10 long axis) | STATE-02 | Provider-specific, long-thread manual | ≥50-msg thread, mid-stream Stop, cold reload per provider |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
