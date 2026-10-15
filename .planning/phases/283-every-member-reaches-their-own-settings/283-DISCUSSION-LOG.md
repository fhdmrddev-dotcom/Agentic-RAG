# Phase 283: Every Member Reaches Their Own Settings - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 283-every-member-reaches-their-own-settings
**Mode:** `--auto` (operator: "continue autonomously on this phase end to end"). Every choice below is Claude's recommended option; nothing was asked.
**Areas discussed:** The member's door · Where the toggle lives · API authority and fences · SettingsPage seam depth · Chunks bound · G-4 scenarios

---

## The member's door

| Option | Description | Selected |
|--------|-------------|----------|
| Un-gate the existing rail entry | Remove `feature: "model_management"` from `NAV_ITEMS.settings`; page already gates per tab | ✓ |
| Profile-menu item | Second door in ProfileMenu (BUG-260923-01's direction) | |
| Widen `model_management` audience | The documented workaround; ruled out by the roadmap's failure list | |

**Choice:** [auto] un-gate the rail entry (no new door, so the G-2 sketch skip holds).

## Where "Show technical names" lives

| Option | Description | Selected |
|--------|-------------|----------|
| New "Preferences" tab (id "6"), toggle + default-model picker moved verbatim | One home for personal preferences | ✓ |
| Put the toggle at the top of the Memory tab | Mixes concerns | |
| Un-gate the AI Model tab partially | Leaves operator controls next to member controls | |

**Choice:** [auto] Preferences tab; operator strip keeps AI Model first and as the default landing.

## API authority and fences

| Option | Description | Selected |
|--------|-------------|----------|
| No gate moves; two-role fence with real `require_visible` + route-inventory fence, both driven RED | API stays the wall | ✓ |
| Split `/settings` into member and operator endpoints | Unneeded: member data already flows through ungated owner-scoped routes | |

**Choice:** [auto] fences only.

## SettingsPage G-5 seam depth

| Option | Description | Selected |
|--------|-------------|----------|
| Tab-registration seam + extract AuditLogSection, behaviour-preserving; deeper split stays owed | What FIX-01 needs, low risk | ✓ |
| Full per-tab split (state, hydrate, payload, save beside each panel) | The full named seam; high risk on 1,814 lines | |

**Choice:** [auto] registration seam; recorded as partial discharge.

## Chunks bound

| Option | Description | Selected |
|--------|-------------|----------|
| `max-h` + `overflow-y-auto`, focusable region, no overscroll containment | The report's smallest real fix | ✓ |
| Virtualised list | Only if measured slow | |
| "Show first 20 / Show all" | Ruled out by the report | |

**Choice:** [auto] bounded list.

## G-4 scenarios

**Choice:** [auto] member's first visit · operator's view unchanged · 1,000-chunk document, each driven as the real role via Chrome MCP by the orchestrator.

## Claude's Discretion

Registry shape/file name; exact max-height value; Preferences section heading wording.

## Deferred Ideas

Chunk endpoint 1,000-row truncation (→ Phase 284); chunk finding/filter; virtualisation; deeper SettingsPage split; BUG-260923-01 rail density (IA, with SEED-166/196); `app/security/access.py` seam.
