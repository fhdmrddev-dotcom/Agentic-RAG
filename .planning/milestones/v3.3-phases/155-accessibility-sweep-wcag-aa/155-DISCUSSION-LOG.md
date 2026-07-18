# Phase 155: Accessibility Sweep — WCAG AA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 155-accessibility-sweep-wcag-aa
**Areas discussed:** Axe tooling & gate home, Pre-existing offender strategy, Keyboard walkthrough protocol, Surface boundary & violation disposition

---

## Pre-discussion routing

- **Todo match:** `spike-nl-workflow-authoring.md` (score 0.6, keywords "inputs, phases, run") — presented; user chose **Don't fold** (false-positive keyword match).
- **Reported-bugs sweep:** 15 open `surface: Agentic-RAG` reports — none in the a11y domain; **none folded** (nav-crowding already routed → Phase 156).
- **Gray-area selection:** user selected **all four** proposed areas.

---

## Axe tooling & gate home

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid (Recommended) | vitest-axe per-surface tests (112/117 pattern) + ONE live real-browser axe/Lighthouse scan per surface via Chrome DevTools MCP for the contrast rules jsdom can't compute; skip @axe-core/playwright | ✓ |
| @axe-core/playwright | Roadmap's literal prescription; requires reviving the rotted E2E harness (SEED-049) | |
| vitest-axe only | Cheapest; contrast never machine-checked | |

**User's choice:** Hybrid.

| Option | Description | Selected |
|--------|-------------|----------|
| Errors, fix all (Recommended) | jsx-a11y recommended set as errors app-wide, fix every violation this phase | ✓ |
| Errors new, warn legacy | Errors only on net-new dirs, warnings elsewhere | |
| Warn-only advisory | Install as warnings, zero fix obligation | |

**User's choice:** Errors, fix all.

| Option | Description | Selected |
|--------|-------------|----------|
| Category-zero (Recommended) | Zero axe violations on net-new surfaces (live) + zero failing nodes in color-contrast & button-name app-wide on SEED-092's flagged pages | ✓ |
| Lighthouse score ≥ 95 | Headline number; blends out-of-scope audits | |
| Axe-clean net-new only | No app-wide re-scan proof | |

**User's choice:** Category-zero.

---

## Pre-existing offender strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fix at source (Recommended) | Retune global dim tokens to AA-passing values + sweep /60 /50 text usages; decorative/disabled exempt | ✓ |
| Migrate usages only | Re-point meaningful text to --muted-foreground; token stays failing | |
| Flagged nodes only | Fix the 19 Lighthouse nodes; false AA-clean per SEED-092 | |

**User's choice:** Fix at source.

| Option | Description | Selected |
|--------|-------------|----------|
| Full app sweep (Recommended) | Label every icon-only button app-wide (same work the lint errors force) | ✓ |
| Nav + net-new only | Legacy buttons would need eslint-disables | |
| Worst-visible only | Daily-use buttons only | |

**User's choice:** Full app sweep.

| Option | Description | Selected |
|--------|-------------|----------|
| Lint-drawn line (Recommended) | Two named classes + lint-forced + net-new surfaces; everything else → documented SEED-092-remainder list | ✓ |
| Also critical/serious | Additionally fix axe critical/serious app-wide | |
| Fix everything found | Full audit now (contradicts requirement scoping) | |

**User's choice:** Lint-drawn line.

| Option | Description | Selected |
|--------|-------------|----------|
| Quick eyeball (Recommended) | Mid-execution before/after look at 2-3 pages; approve or nudge values | ✓ |
| Trust the math | No checkpoint; judge at final UAT | |
| Sketch first | Full G-2 mockup treatment | |

**User's choice:** Quick eyeball.

---

## Keyboard walkthrough protocol

| Option | Description | Selected |
|--------|-------------|----------|
| Claude first, you confirm (Recommended) | Claude drives via Chrome MCP (satisfies G-4), operator re-runs the must-pass scenarios for lived-experience judgment; operator-driven fallback if MCP wedges | ✓ |
| You drive throughout | Operator executes the whole checklist | |
| Claude drives everything | Judgment calls automated away | |

**User's choice:** Claude first, you confirm.

**Must-pass G-4 scenarios (multiSelect — ALL FOUR selected):**
| Option | Selected |
|--------|----------|
| Launch a workflow run (Run modal → upload → scope → launch) | ✓ |
| Navigate a cited answer (marker → peek → pin → Esc → source doc) | ✓ |
| Operate the Control Room (tabs → kill-switch arm-to-confirm → audit receipt) | ✓ |
| Settings + nav traversal (collapse/expand → all destinations → 154 toggle) | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Task + 3 invariants (Recommended) | Scenario completes + visible focus + no traps + logical order everywhere on the surface | ✓ |
| Element-by-element | Every interactive element individually verified | |
| Scenario-only | The 4 flows only | |

**User's choice:** Task + 3 invariants.

| Option | Description | Selected |
|--------|-------------|----------|
| Names only (Recommended) | Accessible names via axe + DevTools a11y tree; no live NVDA pass | ✓ |
| One NVDA spot-check | Single NVDA run through the 4 flows | |
| Full SR pass | VPAT-level rigor (future slot) | |

**User's choice:** Names only.

---

## Surface boundary & violation disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Full inventory (Recommended) | Control Room all tabs (146-150 tile) + Run modal/inputs/delete confirm (152) + citation UI (153) + 154 toggle/relabels/composer helpers | ✓ |
| Requirement's literal three | Drops the 154-deferred toggle a11y | |
| Full inventory + tool cards | Drags the pre-existing Phase-095 card frame into the bar | |

**User's choice:** Full inventory.

| Option | Description | Selected |
|--------|-------------|----------|
| Fix at primitive (Recommended) | Fix shared shadcn/Radix wrappers once + consumer non-regression; G-5 display-additive exception for MessageItem/StreamsProvider | ✓ |
| Scoped per-surface | Patch only where the audit looks | |
| Case-by-case, ask me | Checkpoint per finding | |

**User's choice:** Fix at primitive.

| Option | Description | Selected |
|--------|-------------|----------|
| Documented exclusions (Recommended) | Each exception in VALIDATION.md (rule + node + why) + exclusion encoded per-rule/per-selector in the axe test — zero UNEXPLAINED violations | ✓ |
| No exceptions allowed | Replace/wrap any stubborn upstream component | |
| Claude's discretion, silent | Invisible exclusions (the false-green pattern) | |

**User's choice:** Documented exclusions.

---

## Post-discussion clarification

User asked (free-text, twice): **"what will this phase deliver from a user perspective"** — answered in plain language: (1) faint gray text becomes readable, (2) whole app keyboard-operable with visible focus, (3) every icon button announces its purpose, (4) build gates prevent regression; business value = documented WCAG 2.1 AA evidence for B2B procurement. No scope change resulted.

## Claude's Discretion

- Exact retuned token values (D-07 eyeball is the approval gate)
- Test file naming/placement, CI wiring, live-scan tooling detail
- aria-label copy per icon button (consistent with the 154 term-map)
- Plan/wave structure

## Deferred Ideas

- **Provider/model icons in the provider selector + selected-state icon in the composer** (operator request during the Done check) → Phase 156 POLISH-01, via the Phase-127 `@lobehub/icons` single-source convention.
- Exhaustive app-wide a11y audit + full screen-reader pass → SEED-092 remainder.
- Playwright E2E revival → SEED-049.
