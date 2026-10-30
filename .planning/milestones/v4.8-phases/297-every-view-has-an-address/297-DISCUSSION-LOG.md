# Phase 297: Every View Has an Address - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-27
**Phase:** 297-every-view-has-an-address
**Mode:** `--auto` (operator: "proceed end to end by yourself") — recommended option taken every time.
**Areas discussed:** Router choice, Tree shape, Route table & URL rules, Legacy links, Unsaved-edit guard, Parity check, Verification

---

## Router choice
| Option | Description | Selected |
|---|---|---|
| react-router 8.5 data mode, routing only | `useBlocker` for POP; ~+18 KB gz; React 19.2.9 + Node 22 bumps | ✓ |
| Hand-rolled (docs/router.ts pattern) | zero deps; POP blocking, anchors, history all hand-built | |
| TanStack Router | typed params; restructures App/ChatLayout around a route tree + codegen | |
| wouter | 3 KB; no navigation blocker | |

[auto] Router — Q: "Which router?" → Selected: "react-router 8.5 data mode" (recommended default). Facts re-verified via `npm view` 2026-10-27.

## Tree shape
| Option | Description | Selected |
|---|---|---|
| RouterProvider above App, one catch-all route, activeView derived | no provider remounts, leaf components stay router-free | ✓ |
| Route per view with `<Outlet>` | idiomatic, but a path-keyed element remounts providers / kills streams | |

[auto] Tree — Q: "Where does the router sit?" → Selected: "above App, one catch-all route" (recommended default).

## Route table & URL rules
| Option | Description | Selected |
|---|---|---|
| Canonical `/app/...`, parse bare known prefixes and replace | works on all four hosts; fixes the SEED-185 `/workflows` case | ✓ |
| Bare paths canonical | breaks one-box (landing fallback) and previews | |

[auto] Routes — Q: "Unknown `/app/...` path?" → Selected: "minimal 'doesn't open anything' state, never chat" (recommended default; 299 owns the full page).
[auto] Routes — Q: "Control room address?" → Selected: "`/app/admin`, `/app/admin/spend`; `/admin/spend` kept as legacy alias".

## Legacy links
[auto] Q: "`?run=` writers?" → Selected: "retire in the same commit that routes runs; parser keeps the alias" (recommended; AP-2).
[auto] Q: "`/setup`, `/invite`?" → Selected: "pre-auth short-circuits byte-for-byte".

## Unsaved-edit guard
| Option | Description | Selected |
|---|---|---|
| One app-level `useBlocker` + registry, reuse `window.confirm(UNSAVED_LEAVE_PROMPT)` | existing pattern, no new UI, no sketch | ✓ |
| In-app AlertDialog | nicer, Chrome-MCP-friendly, but new UI → G-2 sketch first | |

[auto] Q: "Which editors?" → Selected: "Builder mandatory; Settings if its dirty state is readable without new state".

## Parity check
[auto] Q: "Form?" → Selected: "vitest suite over devRouting.ts + vercel.json + nginx.conf, driven RED vs a planted mismatch".

## Verification
[auto] Q: "UAT scope?" → Selected: "full four-axis board (8 provider rows) + 4 G-4 scenarios; confirm stubbed under Chrome MCP".

## Claude's Discretion
- No ScrollRestoration; focus/title deferred to 299; names of registry hook and not-found component.

## Deferred Ideas
- Entity and tab addresses, LinkNotFound, org prompt, sign-in return, copy-link → 299.
- Draft and document URLs; extra leave-guard tenants; storage handoffs → later.
- `*.vercel.app` preview defect → 302 (REG-08).

## Seeds / bugs routing
- [auto] SEED-185 → `status: folded`, `partial: true`, `folded_into: "297"` (entity half stays with 299).
- BUG-260610-01, BUG-260923-01 reviewed, left open.
