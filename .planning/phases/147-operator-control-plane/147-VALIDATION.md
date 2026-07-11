---
phase: 147
slug: operator-control-plane
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-11
---

# Phase 147 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> ADMIN-02 + FLAG-01. Active-runs + Kill touch run/stream state → SC#10 live UAT is MANDATORY (bottom).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest (existing `backend/tests/`; `test_146_operator_gate.py` precedent) |
| **Frontend framework** | Vitest + Testing Library (`frontend/src/**/__tests__/`; note ~14-17 pre-existing ROT tests — SEED-056, NOT attributable to this phase) |
| **Typecheck** | `npx tsc --noEmit -p tsconfig.json` (pure-presentational / type-only tasks use this as their automated gate) |
| **Config file** | backend: `backend/pytest.ini` / `pyproject`; frontend: `frontend/vitest.config.*` (both existing — no Wave 0 install) |
| **Backend quick run** | `cd backend && venv/Scripts/python -m pytest tests/test_147_*.py -x` |
| **Frontend quick run** | `cd frontend && npm run test -- <ComponentName>` |
| **Full suites** | `cd backend && venv/Scripts/python -m pytest` · `cd frontend && npm run test` |
| **Estimated runtime** | backend 147 subset ~30-60s; frontend component subset ~10-20s |

---

## Sampling Rate

- **After every task commit:** Run the touched module's quick pytest / vitest (or `tsc --noEmit` for type-only tasks).
- **After every plan wave:** Full backend pytest + frontend vitest (accepting the documented SEED-056 rot baseline — a test that fails at HEAD before the phase is not a phase regression).
- **Before `/gsd:verify-work`:** Full suite green (modulo documented rot), THEN the SC#10 live UAT below.
- **Max feedback latency:** < 60s (quick run per task).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 147-01-01 | 01 | 1 | FLAG-01 | T-147-01 / T-147-02 / T-147-COLD | last-known-good on blip; D-Q4 cold polarity; SQLi-safe column allowlist | unit | `cd backend && venv/Scripts/python -m pytest tests/test_147_flag_failure_semantics.py -x` | ❌ W0 | ⬜ pending |
| 147-01-02 | 01 | 1 | FLAG-01 | — | migration applied to live DB; schema regen | manual | operator SQL-editor apply + `bash scripts/regenerate-full-schema.sh` | N/A | ⬜ pending |
| 147-02-01 | 02 | 1 | ADMIN-02 | — | additive-only /backpressure; sandbox off≠down; poll floor-exempt | unit | `cd backend && venv/Scripts/python -m pytest tests/test_147_health_probe.py -x` | ❌ W0 | ⬜ pending |
| 147-02-02 | 02 | 1 | ADMIN-02 | T-147-03 / T-147-04 / T-147-05 / T-147-13 | cross-user list gated; 404 non-discoverable; no free-text audit action; tuner no-Kill | integration | `cd backend && venv/Scripts/python -m pytest tests/test_147_active_runs.py -x` | ❌ W0 | ⬜ pending |
| 147-06-01 | 06 | 1 | ADMIN-02 | — | client contract types | typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.json` | ✅ (extend api.ts) | ⬜ pending |
| 147-06-02 | 06 | 1 | ADMIN-02 | T-147-07 | victim sees exactly a self-cancel (D-03) across reload | unit (Vitest) | `cd frontend && npm run test -- MessageItem` | ⚠️ extend | ⬜ pending |
| 147-03-01 | 03 | 2 | ADMIN-02 | T-147-08 | shared cancel discipline; owner path still 404s cross-user | integration | `cd backend && venv/Scripts/python -m pytest tests/test_062_cancel_run.py -x` | ⚠️ extend | ⬜ pending |
| 147-03-02 | 03 | 2 | ADMIN-02, FLAG-01 | T-147-06 / T-147-07 / T-147-01 | operator kill no-ownership behind gate; victim-only audit; flag key allowlist | integration | `cd backend && venv/Scripts/python -m pytest tests/test_147_operator_kill.py -x` | ❌ W0 | ⬜ pending |
| 147-04-01 | 04 | 2 | FLAG-01 | T-147-09 / T-147-14 | two-layer fail-closed; provider-agnostic; Deep byte-identical when on | unit | `cd backend && venv/Scripts/python -m pytest tests/test_147_flag_hide.py tests/test_147_flag_refuse.py -x` | ❌ W0 | ⬜ pending |
| 147-04-02 | 04 | 2 | FLAG-01 | — | D-05 block new launches only; in-flight + Deep untouched | integration | `cd backend && venv/Scripts/python -m pytest tests/test_147_workflows_flag.py -x` | ❌ W0 | ⬜ pending |
| 147-05-01 | 05 | 2 | FLAG-01 | T-147-10 / T-147-11 / T-147-15 / T-147-COLD | off-switch allowlist; no blocking I/O; cold-cache OPEN; /health boolean-only | integration | `cd backend && venv/Scripts/python -m pytest tests/test_147_maintenance_mw.py -x` | ❌ W0 | ⬜ pending |
| 147-07-01 | 07 | 2 | ADMIN-02 | — | sandbox off neutral not red (Pitfall 6) | typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.json` | ✅ (extend) | ⬜ pending |
| 147-07-02 | 07 | 2 | ADMIN-02 | T-147-05 / T-147-12 | metadata-only cards; no optimistic Kill removal; tuner no-Kill | unit (Vitest) | `cd frontend && npm run test -- ActiveRunsSection` | ❌ W0 | ⬜ pending |
| 147-08-01 | 08 | 2 | FLAG-01 | T-147-12 | armed-OFF weight; direct flip via setFlag | unit (Vitest) | `cd frontend && npm run test -- CapabilityGrid` | ❌ W0 | ⬜ pending |
| 147-08-02 | 08 | 2 | FLAG-01 | T-147-16 | arm-to-confirm; consequence≠receipt | typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.json` | ✅ (new) | ⬜ pending |
| 147-09-01 | 09 | 3 | ADMIN-02, FLAG-01 | T-147-17 | silent poll (no ledger spam); one visit-row; hidden-tab pause | unit (Vitest) | `cd frontend && npm run test -- ControlRoomPage` | ❌ W0 | ⬜ pending |
| 147-09-02 | 09 | 3 | FLAG-01 | T-147-15 | banner reads public flag only, never /admin | typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.json` | ✅ (extend App) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Sampling continuity: no run of 3 consecutive tasks lacks an automated gate — every task has a pytest, vitest, or `tsc --noEmit` command (147-01-02 is the one BLOCKING human-action apply, bracketed by automated tasks).*

---

## Wave 0 Requirements

New test files each code task creates before/with its implementation (TDD mode is disabled, so these are authored inside their owning task, not a separate Wave 0 plan):

- [ ] `backend/tests/test_147_flag_failure_semantics.py` — last-known-good / D-Q4 cold-cache polarity (147-01-01)
- [ ] `backend/tests/test_147_health_probe.py` — Redis/Supabase/sandbox probes (up/down/off + latency); backpressure additive + floor-exempt (147-02-01)
- [ ] `backend/tests/test_147_active_runs.py` — cross-user list + D-Q1 kind derivation + tuner-no-Kill + /record events (147-02-02)
- [ ] `backend/tests/test_147_operator_kill.py` — operator Kill (shared internals, no ownership, victim-only audit, zombie-heal verb) + PUT /admin/flags allowlist (147-03-02)
- [ ] `backend/tests/test_147_flag_hide.py` / `backend/tests/test_147_flag_refuse.py` — two-layer fail-closed gate + Deep byte-identical no-op (147-04-01)
- [ ] `backend/tests/test_147_workflows_flag.py` — D-05 block-new-launches; in-flight + Deep untouched (147-04-02)
- [ ] `backend/tests/test_147_maintenance_mw.py` — write-block + off-switch allowlist + cold-cache OPEN + /health boolean (147-05-01)
- [ ] extend `backend/tests/test_062_cancel_run.py` — owner-path cross-user-404 regression after the refactor (147-03-01)
- [ ] extend `frontend/src/components/chat/__tests__/MessageItem.test.tsx` — the two cancelled-render bugs (147-06-02)
- [ ] `frontend/src/components/admin/__tests__/ActiveRunsSection.test.tsx` — cards + confirm-sheet Kill + no optimistic removal (147-07-02)
- [ ] `frontend/src/components/admin/__tests__/CapabilityGrid.test.tsx` — armed-OFF + impact copy + direct flip (147-08-01)
- [ ] `frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx` — five-tab IA + visit-row-once + hidden-tab pause + View-all→Audit (147-09-01)

Existing infrastructure (pytest + vitest + tsc) covers all phase requirements — no framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration 097 applied to the live local DB | FLAG-01 | Migrations are pasted into the Supabase SQL editor by the operator (CLAUDE.md — never db push/reset) | Plan 01 Task 2 [BLOCKING]: paste 097, confirm 3 columns, run regenerate-full-schema.sh, commit both |
| Live cross-worker flag propagation ≤ TTL | FLAG-01 | Multi-worker (WORKER_COUNT=2) per-worker cache; a ≤30s skew is expected + honest (Pitfall 5) | Flip a switch, confirm the capability stops for a live chat within the TTL window on both workers |
| Long-message elapsed + "not responding" tag on the real card | ADMIN-02 | Requires a real ≥50-message / ≥5KB streaming run and a genuinely-stalled stream | SC#10 Axis 4 below (Chrome MCP / operator-driven) |

---

## SC#10 Live UAT (MANDATORY — active-runs + Kill + flags touch run/stream state)

> Authored HERE, NOT as PLAN.md tasks. Phase verification only passes when all 4 axes + the flag axis are exercised LIVE. Cross-provider = OpenAI / Anthropic / Google / OpenRouter (one representative model per axis). Operator-driven browser UAT (give simple steps, trust the operator's observation).

| # | Axis | Scenario | Pass condition |
|---|------|----------|----------------|
| 1 | **Cross-provider** | Start 4 concurrent runs — OpenAI, Anthropic, Google, OpenRouter — as different users; open the Control Plane active-runs list. | Each run shows its correct `@lobehub` provider mark, user, model, and live-ticking elapsed; the kind badge is correct. Kill each chat run → the victim sees exactly a self-cancel ("Response stopped"), NO operator attribution in their chat (D-03); the ledger names the victim (D-02). |
| 2 | **Multi-tool** | One run that uses 2+ tools in a single prompt (e.g. `search_documents` + `execute_code`). | The run appears ONCE with an honest activity line; killing it mid-tool cancels cleanly (Cancelling… → Cancelled, no zombie). |
| 3 | **Parallel-thread** | Thread A streaming (user 1) while the operator Kills a DIFFERENT user's run in Thread B. | Thread A is unaffected (no cross-run leak); only B's run terminates; B's victim sees a self-cancel. |
| 4 | **Long-message** | A ≥50-message OR ≥5KB run; let it run >8 min and/or force a stalled stream. | The card shows correct elapsed; the `long-running` (>8min) and `not-responding` (stalled) tags render on the right rows. |
| 5 | **Flag axis (capability)** | Flip each kill-switch (web / sandbox / self-improve / workflows) OFF, then a live chat tries that capability. | The disabled capability stops for the live chat within the TTL window — new runs never see the tool (hide), an in-flight call gets a plain "disabled by the administrator" refusal (refuse); flip back ON → recovery. Workflows OFF → a new Run button refuses with plain copy while an in-flight workflow finishes (D-05). |
| 6 | **Flag axis (maintenance)** | Flip maintenance ON. As an end user, attempt a write (send a chat / upload) and a read (browse). Then flip OFF. | Writes return 503 + the app-wide read-only banner shows; reads + self-cancel still work; the off-switch (PUT /admin/flags) stays reachable throughout; flip OFF → writes recover, banner clears. |
| 7 | **Zombie-heal honesty** | Kill a genuinely-stuck run (worker task already gone). | The card + ledger read "recovered a stuck run", never "killed" (064-B). |
| 8 | **Poll/visit honesty** | Open the Control Plane, scroll, leave it open ~1 min, hide the tab, return. | Exactly ONE "Opened the Control Plane" ledger row per visit (polls are silent); the pinned vitals can go amber/red on a poll while scrolled; polling pauses when the tab is hidden. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a documented Wave-0 test file (or the one BLOCKING manual apply)
- [x] Sampling continuity: no 3 consecutive tasks without an automated gate
- [x] Wave 0 covers all MISSING test references (listed above)
- [x] No watch-mode flags (all commands are single-run `-x` / `npm run test --`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
