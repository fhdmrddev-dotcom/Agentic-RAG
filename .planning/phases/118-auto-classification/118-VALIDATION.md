---
phase: 118
slug: auto-classification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 118 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `118-RESEARCH.md` §"Validation Architecture". The planner refines the
> Per-Task Verification Map against the authored plans; validate-phase reconciles
> to executed reality.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && venv/Scripts/python -m pytest tests/ -k "118" -q` |
| **Full suite command** | backend `pytest tests/` + frontend `npm run test` |
| **Estimated runtime** | ~60–90 seconds (phase subset much faster) |

---

## Sampling Rate

- **After every task commit:** Run the quick `-k "118"` subset.
- **After every plan wave:** Run the full suite (backend + frontend).
- **Before `/gsd:verify-work`:** Full suite green; live :54322 integration green.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD — planner fills from authored plans | — | — | CLASS-01/02/03 | T-118-* | leak-safe user-scoped rule reads; never silent move; audit-after-write | unit + live-integration | `pytest tests/ -k "118"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend test scaffolds for the net-new `classification_matcher` (in-Python AST eval), the `/classification-rules` CRUD service/router, the rule-eval splice in `ingest_document` (suggestion-not-move), and the accept/dismiss reversible-move + `classification.apply` audit.
- [ ] Frontend test scaffolds for `ClassificationSection` (panel), the row chip, and the rules page + builder.
- [ ] Two-user leak proof scaffold for global-rule scoping (D-118-8), mirroring 113/115/117.

*Planner authors exact filenames matching the Per-Task Verification Map.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider upload-path classification parity (a `document_type=invoice` rule fires identically across OpenAI/Anthropic/Google/OpenRouter) | CLASS-02 | Metadata-build is provider-routed; matcher normalization must hold across providers | Upload the same doc under each provider's enrichment model; confirm identical suggestion |
| Deep Midnight / Aether visual + mobile-responsive + WCAG 2.1 AA | UX-01 | Lived-experience UI per G-2; Chrome-MCP screenshots | Drive suggestion chip, panel Classification card, rules page + builder live; verify a11y |

*Per RESEARCH SC#10 note: multi-tool / parallel-thread / long-message axes are N/A-with-justification (classification touches neither streaming nor the agent loop) — mirrors Phase 117.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
