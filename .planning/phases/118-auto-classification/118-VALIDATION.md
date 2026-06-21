---
phase: 118
slug: auto-classification
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
---

# Phase 118 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `118-RESEARCH.md` §"Validation Architecture". The planner refined the
> Per-Task Verification Map against the authored plans (118-01..06); validate-phase
> reconciles to executed reality.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend, live :54322) + vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -k "118" -q` |
| **Full suite command** | backend `pytest tests/` + frontend `npm run test` |
| **Estimated runtime** | ~60–90 seconds (phase subset much faster) |

---

## Sampling Rate

- **After every task commit:** Run the quick `-k "118"` subset (backend) / `vitest run <component>` (frontend).
- **After every plan wave:** Run the full suite (backend + frontend) + the prior-phase regression spot
  (`-k "118 or 117 or 116 or 113 or 112 or 111"`) since `ingest_document` + `DocumentDetailPanel` are shared edits.
- **Before `/gsd:verify-work`:** Full suite green; live :54322 integration green; frontend net-new failures 0 via base-checkout.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 118-01-T1 | 01 | 1 | CLASS-01/02 | — | Wave-0 scaffolds (incl. the two-user leak proof harness) | scaffold | `pytest tests/ -k 118 --co` | ❌ W0 | ⬜ pending |
| 118-01-T2 | 01 | 1 | CLASS-02 | T-118-01-01/02 | matcher is pure (no eval, no DB); _-prefix provenance keys rejected | unit | `pytest tests/unit/test_118_matcher.py -x` | ❌ W0 | ⬜ pending |
| 118-01-T3 | 01 | 1 | CLASS-01 | T-118-01-01 | ViewFilter Literal op-reject at parse | unit | `pytest tests/unit/test_118_rule_validation.py -x` | ❌ W0 | ⬜ pending |
| 118-02-T1 | 02 | 2 | CLASS-01 | T-118-02-01/02/03 | is_global hard-false; own+global 404-not-403; _uid guard | live-integration | `pytest tests/integration/test_118_rule_crud.py -x` | ❌ W0 | ⬜ pending |
| 118-02-T2 | 02 | 2 | CLASS-01 | T-118-02-04/05 | validate_fields/operands 422; uniform 404; classification.rule.create audit | live-integration + unit | `pytest tests/integration/test_118_rule_crud.py tests/unit/test_118_rule_validation.py -x` | ❌ W0 | ⬜ pending |
| 118-03-T1 | 03 | 2 | CLASS-02 | T-118-03-01/02/06 | user-scoped rule read; never silent move; first-match-wins one object; classification never blocks ingest | live-integration (incl. two-user) | `pytest tests/integration/test_118_ingest_suggest.py tests/integration/test_118_rule_leak.py tests/integration/test_118_flat_filter_compat.py -x` | ❌ W0 | ⬜ pending |
| 118-03-T2 | 03 | 2 | CLASS-03 | T-118-03-03/04/05 | reversible move; target-folder readability re-check; audit-after-move; uniform 404; dismiss clears | live-integration | `pytest tests/integration/test_118_accept.py tests/integration/test_118_dismiss_undo.py -x` | ❌ W0 | ⬜ pending |
| 118-04-T1 | 04 | 1 | CLASS-01/03 | T-118-04-01 | _classification typed; createRule body omits is_global | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 118-04-T2 | 04 | 1 | CLASS-01/03 | T-118-04-01/02 | rule CRUD + accept/dismiss client; preview+Undo reuse existing fns | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 118-05-T1 | 05 | 3 | CLASS-03/UX-01 | T-118-05-02/03 | provenance not %; honest states; re-fetch-not-optimistic; a11y always-on | frontend unit (RTL) | `vitest run ClassificationSection` | ❌ W0 | ⬜ pending |
| 118-05-T2 | 05 | 3 | CLASS-03/UX-01 | T-118-05-02/03 | row chip only for status=suggested; ✓/✕ wired; a11y aria-label | frontend unit (RTL) | `vitest run DocumentList` | ✅ extend | ⬜ pending |
| 118-06-T1 | 06 | 3 | CLASS-01/UX-01 | T-118-06-01/03 | folder-only action (no tag radio); resolveAdHoc preview; honesty line; createRule omits is_global | frontend unit (RTL) | `vitest run RuleBuilderPanel` | ❌ W0 | ⬜ pending |
| 118-06-T2 | 06 | 3 | CLASS-01/UX-01 | T-118-06-02/03 | own+global rules listed; live toggle; G pill; push/split builder | frontend unit (RTL) | `vitest run AutomationGroup ClassificationRulesPage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend test scaffolds (authored in 118-01-T1): `test_118_matcher.py`, `test_118_rule_validation.py`,
      `test_118_rule_crud.py`, `test_118_ingest_suggest.py`, `test_118_rule_leak.py` (two-user, secure-phase re-runs non-vacuous),
      `test_118_flat_filter_compat.py`, `test_118_accept.py`, `test_118_dismiss_undo.py`.
- [ ] Frontend test scaffolds: `ClassificationSection.test.tsx` (panel), `DocumentList.test.tsx` (row chip — extend),
      `RuleBuilderPanel.test.tsx`, `ClassificationRulesPage.test.tsx`, `AutomationGroup.test.tsx`.
- [ ] Two-user leak proof scaffold for global-rule scoping (D-118-8), mirroring 113/115/117 (`test_118_rule_leak.py`,
      authored in 118-01-T1, flipped GREEN in 118-03-T1; secure-phase re-runs it non-vacuous).
- [ ] No framework install needed — pytest + vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider upload-path classification parity (a `document_type=invoice` rule fires identically across OpenAI/Anthropic/Google/OpenRouter) | CLASS-02 | Metadata-build is provider-routed; matcher normalization must hold across providers | Upload the same doc under each provider's enrichment model; confirm identical suggestion. Author ≥1 UAT row per provider. |
| Deep Midnight / Aether visual + mobile-responsive + WCAG 2.1 AA | UX-01 | Lived-experience UI per G-2; Chrome-MCP screenshots | Drive the suggestion chip, the panel Classification card (suggested-not-moved reads instantly; accept → receipt + Undo; dismiss clears), the rules page + builder live count + the mobile bottom-sheet; verify a11y (keyboard + coarse-pointer always-on). |

*Per RESEARCH SC#10 note: the cross-provider axis APPLIES to the upload path (the deterministic matcher must fire identically on
each provider's enriched metadata). Multi-tool / parallel-thread / long-message axes are N/A-with-justification — classification
touches neither streaming, the agent loop, nor provider-routed chat (it is a one-shot ingest pass + REST CRUD). Mirrors Phase 117.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task in 118-01..06 carries an `<automated>` command; the
      backend integration tasks depend on the Wave-0 scaffolds authored in 118-01-T1)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (the 8 backend + 5 frontend scaffolds above)
- [x] No watch-mode flags (all commands use `-x`/`run`, never `--watch`)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved (reconciled to authored plans 118-01..06; validate-phase reconciles to executed reality)
