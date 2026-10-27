# Phase 296: Close v4.7 Debt - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-26
**Phase:** 296-close-v4-7-debt
**Areas discussed:** scope, deploy (operator, in chat before the phase existed); rulings D-04..D-13 (`--auto`)

---

## Scope (operator, in chat)

| Option | Description | Selected |
|--------|-------------|----------|
| All defects, one phase | Every bug, review finding and UAT finding; features → v4.8 seeds | ✓ |
| Majors + security only | 8 majors and security items; info findings keep triggers | |
| Everything incl. features | Also build unattended-pause expiry, spend ledger, kb_auto, canvas refactor | |

**User's choice:** All defects, one phase (recommended).

## Deploy (operator, in chat)

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy after the fixes | One deploy of 292.1 + 293 + 296; each cloud migration shown before it runs | ✓ |
| Deploy 292.1 + 293 now | Two deploys | |
| No deploy | Keep on develop | |

**User's choice:** Deploy after the fixes (recommended).

## Rulings (auto-selected, recommended option; operator may reverse)

- `[auto]` BUG-261021-05 — engine enforces vs change the seal copy → **engine enforces** (D-04)
- `[auto]` BUG-261020-02 — withhold downstream for non-owners vs operator ratifies the residual → **withhold downstream** (D-05)
- `[auto]` SEED-364 — neutral name for new orgs vs also rename existing → **new orgs only** (D-06)
- `[auto]` 295-IN-08 — gate the judge note on a present send grant vs leave → **gate it** (D-07)
- `[auto]` 291-S6-F7 — derive golden inputs vs keep placeholders → **derive** (D-08)
- `[auto]` 290-WR-02 — fix now (one-touch) vs keep accepted until the canvas refactor → **fix now** (D-09)
- `[auto]` BUG-261024-04 — split defect/policy vs defer whole → **split** (D-10)
- `[auto]` 291 network_mode — change sandbox egress now vs seed → **seed** (D-11)
- `[auto]` 287 SC#4 — accept menu + dialog vs remove the dialog → **accept** (D-12)
- `[auto]` SEED-365 — rate limit in 296 vs whole seed to v4.8 → **rate limit in 296** (D-13)

## Claude's Discretion

Wording of new sentences; folding S rows into the plan that shares their files; order within a plan.

## Deferred Ideas

See `296-INVENTORY.md` § SEED.
