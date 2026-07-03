---
phase: 137
slug: skill-evals-panel-ui-panel-01
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-04
---

# Phase 137 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| server PublishGate → client render | The server (`publish_gate_service`) owns publish readiness; every client surface (LifecycleStepper full/strip, EvalsTab, SkillStudioPage header, slim SkillDetailPanel) is a pure renderer of `getPublishGate` | gate state (met/state/measured/passed/last_override) |
| skillId → owner-scoped reads | listSkillVersions / listEvalRuns / listProposals / listTestCases / getPublishGate are owner-scoped server-side (404-never-403) | skill versions, eval runs/results, proposals, test cases |
| rating / proposal writes → owner-scoped mutations | rate / propose / approve / reject / rerun / force-promote hit owner-gated endpoints; client refetches the reconciled row | ratings, proposal status transitions |
| eval SSE stream → client live state | The stream is a best-effort hint; durable truth is `getEvalRun` (DB) | live eval progress events |
| ActiveView nav state → Studio mount | Nav is client `useState<ActiveView>` (no router); no new server trust boundary | selected skill id (owner's own) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-137-01 | Elevation of Privilege | Gate surfaces: LifecycleStepper (full+strip), EvalsTab feed, SkillStudioPage strip, slim panel stepper, ProposalCard force-promote | mitigate | Server `getPublishGate` rendered verbatim (`LifecycleStepper.tsx:123` `const met = publishGate.met`); no client recompute of readiness from passed/measured at any of the 5 surfaces (`EvalsTab.tsx:541`, `SkillStudioPage.tsx:159`, `SkillFormDialog.tsx:594`); force-promote only calls the injected handler (`ProposalCard.tsx:296`), `override_forced` echoed un-softened (`ProposalCard.tsx:277`) | closed |
| T-137-02 | Information Disclosure | Cross-skill stale state in all 5 stateful fetchers (EvalsTab, VersionsTab, CaseEditor, SkillStudioPage, SkillFormDialog) | mitigate | Skill-switch guards bail before setState: `EvalsTab.tsx:110-128,212` (currentSkillRef+requestedSkill) + `[skillId]` reset clears readout/live/proposal/gate/cases (`EvalsTab.tsx:256-274`); `VersionsTab.tsx:136-163`; `CaseEditor.tsx:54-71`; `SkillStudioPage.tsx:80` alive() guard; `SkillFormDialog.tsx:481-496` cancelled flag keyed to `[skill]` (BUG-260701-02 pattern) | closed |
| T-137-03 | Information Disclosure (IDOR) | version/eval/proposal/run/case reads; "Review evals →" navigation | mitigate | Only `skillId` passed to owner-scoped endpoints (404-never-403); no cross-user id construction; missing case renders neutral fallback, never a leaked id (`RunCaseDetail.tsx:93`); `PublishGateDialog.tsx:137` passes only the owner's skillId, unmet branch only | closed |
| T-137-04 | Tampering | Mutation truth: RunCaseDetail thumbs, RunHistory rows, ProposalCard status, all 6 EvalsTab mutations | mitigate | Endpoint-then-refetch for every mutation, no optimistic truth (T-135-04 pattern): rate `EvalsTab.tsx:366-370`, approve `:400-402`, reject `:417-419`, rerun `:431-433`, forcePromote `:448-450`, propose `:383-385`; ProposalCard imports zero API fns, renders reconciled `proposal.status`; thumbs reflect server `r.rating` (`RunCaseDetail.tsx:190,204`); no mid-run verdicts (`RunHistory.tsx:17,92,110`) | closed |
| T-137-05 | Tampering / Injection (XSS) | All text render surfaces: stepper copy/override receipt, version instructions + lineDiff, eval output/judge reason/prompt/expected_behavior, proposal diff/rationale/evidence, panel counts/gate copy | mitigate | Zero `dangerouslySetInnerHTML` across all phase implementation files (grep-verified); all copy renders as React text nodes | closed |
| T-137-06 | Tampering (design integrity) | SkillTunerPage absorption into TriggeringTab | mitigate | `TriggeringTab.tsx:13` imports only top-level `@/pages/SkillTunerPage` (no tuner internals); single additive `embedded?: boolean` prop (`SkillTunerPage.tsx:63`) gates only the header block (`:547`); tuner behavior untouched (D-02) | closed |
| T-137-SC | Tampering (supply chain) | npm install surface | accept | Zero new packages: no Phase-137 commit (all 24 SHAs audited) touched `frontend/package.json`/`package-lock.json`; latest manifest change predates the phase (Phase 127, `b3bedfbf`). See Accepted Risks Log | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-137-01 | T-137-SC | Phase installed zero npm packages (git-verified across all 24 phase commits — no package manifest changes), so supply-chain/slopcheck registry verification is N/A for this phase | operator (secure-phase run) | 2026-07-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-04 | 7 | 7 | 0 | gsd-security-auditor (opus) |

Audit notes: register authored at plan time across all 7 plans (register_authored_at_plan_time: true); auditor verified mitigations only (no new-threat scan). Adversarial coverage: T-137-01 checked at all 5 gate surfaces; T-137-02 at all 5 stateful fetchers; T-137-04 at all 6 mutation handlers + 3 rendering leaves; T-137-SC verified by git manifest diff, not intent. SUMMARY threat flags (plans 03/05/07) all report "None"; no unregistered attack surface found.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-04
