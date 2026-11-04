# Phase 304: Personal MCP Keys That Act as You - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-30
**Phase:** 304-personal-mcp-keys-that-act-as-you
**Mode:** `--auto` — the operator asked to "continue autonomously end to end". No question was put to the operator; each area took the recommended option (research `SUMMARY.md` recommendation, else the safest option consistent with it).
**Areas discussed:** Key screen home, Key data model, Expiry, Org narrowing mechanism, Resolver and liveness, Kill-switch refusal wording, Narrowing semantics, Snippet URL, Deploy order

---

## Key screen home

| Option | Description | Selected |
|--------|-------------|----------|
| Second kind inside the existing API keys tab | Reuses Phase 293 cards, show-once, revoke, activity; no SettingsPage mount | ✓ |
| A new "MCP" Settings tab | New mount on FIRING `SettingsPage.tsx`; worsens BUG-260923-01 | |

[auto] Key screen home — Q: "Where do MCP keys live?" → Selected: "Second kind inside the existing API keys tab" (recommended: fewest hot-file edits, most reuse)

## Key data model

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `api_keys` with `kind`, `folder_ids`, `tools`, `include_external` | Research D10; reuses revoke, audit, activity | ✓ |
| Sibling `mcp_keys` table | Second resolver risk (W-1 drift) | |

[auto] Key data model → Selected: "Extend api_keys" (research D10)

## Expiry

| Option | Description | Selected |
|--------|-------------|----------|
| Required, presets 30/90/365, default 90 | A standing personal credential is what outlives access | ✓ |
| Optional, default 90, "never" allowed | Matches workflow keys | |

[auto] Expiry → Selected: "Required" (safest option consistent with KEY-04)

## Org narrowing mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Transaction-local GUC intersected in `current_user_org_ids()`, gated by EXPLAIN + baseline + parity | Research D4/Q12 | ✓ |
| Explicit org predicates at each read | Research fallback only | |

[auto] Org narrowing → Selected: "GUC, gated" (research D4); fallback recorded

## Resolver and liveness

| Option | Description | Selected |
|--------|-------------|----------|
| Extract `authenticate_presented_key`; one `principal_still_allowed`; no cache | Research D5; W-1 drift prevention | ✓ |
| New MCP resolver beside `resolve_api_key` | The W-1 drift class | |

[auto] Resolver → Selected: "Extract + one predicate"

## Kill-switch refusal wording

| Option | Description | Selected |
|--------|-------------|----------|
| Own plain sentence for org/deployment switch-off; one shared refusal for credential failures | Switch-off is not a secret and is actionable | ✓ |
| Same refusal for everything | Hides an actionable state | |

[auto] Kill-switch wording → Selected: "Own sentence for switch-off"

## Narrowing semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Subtrees per call; globals excluded unless ticked; connector-fed excluded unless ticked; empty set refused | Research Q2/Q8 | ✓ |

[auto] Narrowing → Selected: research Q2/Q8 as written

## Snippet URL

| Option | Description | Selected |
|--------|-------------|----------|
| One function on `BACKEND_PUBLIC_URL` + one path constant; 305 confirms the path | Q19 is 305's decision | ✓ |

[auto] Snippet URL → Selected: one function + one constant

## Deploy order

| Option | Description | Selected |
|--------|-------------|----------|
| Deploy 304 together with 305 | Nobody mints a key with nothing to connect to | ✓ |
| Deploy 304 alone | Keys that do nothing | |

[auto] Deploy order → Selected: "with 305"

## Claude's Discretion

- Plan split (3-5), module and column names, copy wording within the decisions, whether views/relationships need their own adapter.

## Deferred Ideas

- "Test this key" button (305), KEY-07 limits and per-call audit (305), in-app chat org scoping (future), non-expiring MCP keys (only on request).

## Guardrails fired

- **G-2** (key screen is UI): no operator-approved sketch in autonomous mode; acceptance bar is the UI-SPEC plus Claude-driven G-4 rows. Recorded in `STATE.md → Guardrail overrides`.
- **G-5** (`dependencies.py`, `audit_service.py`, `user_settings.py`, `settings.py`, `SettingsPage.tsx`, `OrgAdminShell.tsx`): honoured by construction — one edit each, `SettingsPage.tsx` and `OrgAdminShell.tsx` likely untouched, `api_key_auth.py` extracted first.
