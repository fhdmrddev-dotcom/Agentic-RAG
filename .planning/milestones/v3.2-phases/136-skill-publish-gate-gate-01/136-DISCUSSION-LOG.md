# Phase 136: Skill Publish Gate (GATE-01) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 136-skill-publish-gate-gate-01
**Areas discussed:** Gate strictness, What counts as passed, Publish-flow UX, Gate coverage / side doors

---

## Gate strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Block + override (Recommended) | Publish blocked by default; owner can explicitly force-publish with unmet-gate evidence shown at override moment, override recorded (135 D-06 force-promote pattern) | ✓ |
| Hard block | No override — publish impossible until a passing eval exists | |
| Warn only | Publish always proceeds with a warning — the gate never actually gates | |

**User's choice:** Block + override

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-visible only (Recommended) | Override recorded (timestamp + gate state); owner sees honest "published without passing eval" status in the eval section; consumer badge deferred to 137 sketch | ✓ |
| Visible to everyone | Global skills published via override carry an "unverified" chip other users can see | |
| Recorded only, no UI | Override lands in data only; 137 decides all display | |

**User's choice:** Owner-visible only

---

## What counts as passed

| Option | Description | Selected |
|--------|-------------|----------|
| All measured pass (Recommended) | Gate satisfied when a run has ≥1 measured case AND every measured with-skill case passed — matches the 134 default rollup so UI and gate never disagree | ✓ |
| Percentage threshold | E.g. ≥80% of measured cases pass — invents a magic number, disagrees with the displayed rollup | |
| Configurable setting | app_settings knob with a default — flexibility nobody has asked for yet | |

**User's choice:** All measured pass

| Option | Description | Selected |
|--------|-------------|----------|
| No — current version only (Recommended) | Passing run must tie to the skill's CURRENT instructions (132 version snapshots + eval_runs.skill_version_id); edit after pass → gate unmet until re-evaled | ✓ |
| Yes — any past pass counts | One passing eval ever unlocks publishing forever | |
| Stale-pass warning | Old pass satisfies the gate but flagged "passed on an older version" | |

**User's choice:** No — current version only
**Notes:** Planner nuance recorded in CONTEXT D-04: 135 promotion creates a near-duplicate
version row with identical instructions — gate must treat promoted state as
current-version-passed (content equality or promotion linkage, not naive version-id match).

---

## Publish-flow UX

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm dialog always (Recommended) | "Share globally" opens a dialog both ways: met → satisfied status + Publish; unmet → honest status + run-an-eval pointer + explicit force-publish affordance | ✓ |
| Dialog only when unmet | One-click when met; weaker on SC#2's "shows the gate satisfied" | |
| Disabled menu item + status line | Disabled item can't carry evidence; override needs a second home anyway | |

**User's choice:** Confirm dialog always
**Notes:** Composes with the Area-1 decision — a small gate-status line in SkillEvalSection
is also the home of the owner-visible override record.

---

## Gate coverage / side doors

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-set false on create (Recommended) | Server ignores client-supplied is_global on create (classification-rules precedent T-118-02-01); gated toggle = only path to global | ✓ |
| Gate-check the create path too | Collapses to always-blocked for a brand-new skill — more code, same outcome | |
| Leave it open | API side door stays; gate decorative for API users | |

**User's choice:** Hard-set false on create

| Option | Description | Selected |
|--------|-------------|----------|
| Gate every share action (Recommended) | Unshare→re-share runs the same gate check; "publish" = the toggle-to-global action, every time; already-global skills untouched (SC#3) | ✓ |
| Grandfather once-published skills | Ever-global skips the gate on re-share — edited-then-reshared dodges the gate | |

**User's choice:** Gate every share action

---

## Claude's Discretion

- Override-record storage shape (columns on `skills` vs small audit row; migration 084 if needed)
- Structured-error shape from the gated toggle + dialog copy + gate-status compute/endpoint
- "Current version" equality implementation (content hash vs promotion linkage vs latest-version resolution)
- Dialog component reuse — kept plain per the 137 fence

## Deferred Ideas

- Consumer-facing "unverified" badge on override-published global skills → Phase 137 sketch candidate
- Configurable pass threshold → only if lived usage demands it
- Stale-pass warning state → rejected for now; revisit only if re-eval friction proves real
- Retroactive "published, never evaled" governance sweep → future governance phase (Phase 119 health-view idiom)
- Reviewed todo NOT folded: `spike-nl-workflow-authoring` (score 0.6, keyword-only, already satisfied by Phase 103 — same disposition as 134/135)
