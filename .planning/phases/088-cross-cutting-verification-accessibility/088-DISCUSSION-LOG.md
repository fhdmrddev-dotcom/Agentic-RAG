# Phase 088: Cross-Cutting Verification + Accessibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 088-cross-cutting-verification-accessibility
**Areas discussed:** SEED-034 routing, Accessibility depth, A11y scan tooling, Verify + bug routing

---

## SEED-034 routing

### Appetite after measuring per-provider tool-use reliability
| Option | Description | Selected |
|--------|-------------|----------|
| Conditional fold | Measure first; fold a slice ONLY if cheap/universal/low-risk and provably lifts weak models without regressing strong; architecture → v2.8 | ✓ |
| Measure-only, defer all | Pure verification; produce scoreboard, route ALL of SEED-034 to v2.8 | |
| Commit to fold now | Decide up front to fold tuning regardless of measurement | |

### If a slice is folded, its boundary
| Option | Description | Selected |
|--------|-------------|----------|
| Universal only | Shared prompt + tool-description clarity, NO per-provider branching (approach A) | ✓ |
| Universal + overlay scaffold | Also stand up the per-provider overlay injection point (approach B seed) | |
| N/A — deferring all | (only if measure-only chosen) | |

### Measurement rigor
| Option | Description | Selected |
|--------|-------------|----------|
| Reusable eval script | Repeatable script; assert tool-invocation + arg-shape + persistence; seeds v2.8 harness + regression gate | ✓ |
| One-off Chrome MCP scoreboard | Manual UAT scoreboard recorded in VALIDATION.md, no reusable artifact | |

**User's choice:** Conditional fold + Universal only + Reusable eval script.
**Notes:** Fold-gate encoded as Claude's discretion: fold only if prompt/tool-desc text-only + ≥1 weak model recovers + zero strong-model regressions. Google tested on 3.x+ (gemini-2.5 known-degraded). Architecture (overlays + harness + onboarding checklist) → v2.8.

---

## Accessibility depth

### How to treat WCAG 2.1 AA audit findings
| Option | Description | Selected |
|--------|-------------|----------|
| Fix all to AA | Remediate every finding so A11Y-01/02 genuinely pass; defer only restructures as SEED | ✓ |
| AA criticals + triage rest | Fix must-haves; log lower-impact findings to v2.8 polish SEED | |

### Which surfaces in a11y scope
| Option | Description | Selected |
|--------|-------------|----------|
| Panel + seam cards | All components/panel/* PLUS the 087 chat-surface seam additions | ✓ |
| Panel only | Just the right-side panel components | |

### Screen-reader announcements depth
| Option | Description | Selected |
|--------|-------------|----------|
| Targeted live-regions | aria-live for diff line counts, todo status changes, ask_user prompt appearing | ✓ |
| Static labels only | ARIA labels + roles only, no dynamic announcements | |

**User's choice:** Fix all to AA + Panel + seam cards + Targeted live-regions.
**Notes:** Scout flagged TodosSection (0 roles/focus/SR) and missing global :focus-visible ring as priority gaps.

---

## A11y scan tooling

### Which automated a11y tooling
| Option | Description | Selected |
|--------|-------------|----------|
| Both | jest-axe regression gate (panel test suite) + Chrome MCP Lighthouse on live app | ✓ |
| Chrome MCP only | Lighthouse + manual walk, no regression gate | |
| jest-axe only | axe-core in tests, can't measure contrast / real focus | |

### Who drives the manual keyboard walk
| Option | Description | Selected |
|--------|-------------|----------|
| Chrome MCP + you | Chrome MCP systematic walk + screenshots, then operator lived-experience pass | ✓ |
| Chrome MCP only | Orchestrator-driven full walk | |
| You only | Operator-driven, highest fidelity, no automated evidence | |

**User's choice:** Both tools + Chrome MCP + you.
**Notes:** jest-axe is a dev-dep only (~$0); attaches to the existing 087-01 panel test harness.

---

## Verify + bug routing

### Which providers run the deep E2E flow
| Option | Description | Selected |
|--------|-------------|----------|
| Anthropic + Google | Strong native caller + known-variance Google (reopened gemini-3 thought-signature) | ✓ |
| All 4 providers | Full sequential E2E on OpenAI/Anthropic/Google/OpenRouter | |
| OpenAI + Anthropic | Two strongest; lowest risk, lowest discovery | |

### Bug policy at milestone-close gate
| Option | Description | Selected |
|--------|-------------|----------|
| Fix blockers, defer polish | Fix only verified-capability blockers; log the rest with re_open_trigger | ✓ |
| Fix everything found | Any UAT-surfaced bug fixed before close (075.x cascade risk) | |
| Log everything, fix nothing | Pure verification, zero fixes | |

**User's choice:** Anthropic + Google + Fix blockers, defer polish.
**Notes:** gemini-3 thought-signature folded into 088 (live re-verify of 075.4 hotfix; fix if it reproduces, else close as verified). The 4-axis UAT still covers all 4 providers at the event level — E2E depth is on the 2 most-divergent adapters.

## Claude's Discretion
- Exact fold-gate thresholds + canonical prompt set N for the eval script.
- jest-axe wiring mechanics; aria-live politeness levels; representative model per provider; eval-script location; Playwright-vs-Chrome-MCP authoring of the deep E2E.

## Deferred Ideas
- SEED-034 architecture (per-provider overlays + productized eval harness + new-model onboarding checklist) → v2.8.
- 087 deferrals SEED-037 / SEED-038 / SEED-039 → v2.8 (SEED-039 fast-switch race may be observed in UAT; pulled in only if it blocks the E2E flow).
- Reported bugs left open & deferred: chat-tool-cards-scroll-collapse-duplicate (chat-surface), non-anthropic-generic-code-task-descriptions (display polish), step-count-mismatch-timer-vs-panel, timer-disappears-long-runs (streaming polish).
