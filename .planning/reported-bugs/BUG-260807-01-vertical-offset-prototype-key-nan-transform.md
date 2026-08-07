---
id: BUG-260807-01
title: verticalOffsetFor is an unguarded WR-04 sink — a prototype-key phase slug returns NaN and drops the affordance transform, now above the cards
reported: 2026-08-07
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/workflow-canvas, frontend/edit-affordances, security/WR-04]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: HEAD at /gsd:secure-phase 188.2 (post d6dfe716)
  date: 2026-08-07
---

# BUG-260807-01: `verticalOffsetFor` is a sixth, unguarded WR-04 prototype-pollution sink

> Found by `gsd-security-auditor` during `/gsd:secure-phase 188.2` as an **unregistered flag** —
> it is not in any of Phase 188.2's seven `<threat_model>` blocks. Independently re-verified by
> the orchestrator before filing; every number below was executed, not inherited.

## What we observed

`frontend/src/components/workflows/editAffordance.ts:214-224`:

```ts
export function verticalOffsetFor(
  slug: string | undefined,
  nudges: Record<string, number> | undefined,
  overlay: Record<string, XYPosition>,
  laneY: number,
): number {
  if (slug === undefined) return 0
  const live = overlay[slug]
  if (live !== undefined) return live.y - laneY   // ← unguarded lookup
  return nudges?.[slug] ?? 0                      // ← unguarded lookup
}
```

Both lookups index a plain object literal with an author-supplied slug and no own-property guard.
For any `slug` that names an `Object.prototype` member, `overlay[slug]` resolves to the inherited
value (a function), which is `!== undefined`, so the guard **passes** and the function evaluates
`live.y - laneY` where `live.y` is `undefined`.

Executed against the verbatim function body with both tables empty (`{}`):

```
constructor    => NaN
toString       => NaN
valueOf        => NaN
__proto__      => NaN
normal-slug    => 0     ← the correct answer for every ordinary slug
```

**The slug is unconstrained end-to-end.** `backend/app/models/harness.py:202` declares
`slug: str` with no pattern, no enum and no reserved-word list, and
`supabase/migrations/058_workflow_phases.sql:18` is a bare `text NOT NULL`. Nothing between the
author and this function rejects `constructor` as a phase slug.

## Why it matters

The return value is interpolated straight into a CSS transform:

```
transform: translate(… px, …px)      // PlaneEditingLayer.tsx:176-177, :225, :256-262
```

A `NaN` term makes the whole `translate()` declaration invalid, so the browser drops the entire
`transform` and the element renders at its **untransformed** position.

**Phase 188.2 amplified the consequence, which is why this is worth filing now rather than
later.** Plan 02 added `zIndex: AFFORDANCE_Z` (1002) to the very same three style objects that
carry these transforms — `PlaneEditingLayer.tsx:183`, `:231`, `:269`, sitting directly beside the
`verticalOffsetFor` calls at `:176-177`, `:225` and `:256-262`. Before that fix a mispositioned
affordance landed *behind* the cards at the default stacking level. After it, a mispositioned
affordance lands **above** every card, at z-index 1002, because the elevation survives the dropped
transform. The fix for `BUG-260806-01` was correct and should stay; it simply raised the cost of
this latent defect.

Severity is **minor** rather than major on reachability, stated plainly: it needs a workflow author
to name a phase such that its slug is one of a small set of `Object.prototype` member names. That
is unlikely by accident and trivially reachable on purpose. It is not a privilege escalation and
leaks nothing — the blast radius is a misplaced, over-elevated `＋` / `✕` overlay on the canvas.

## Hypothesized cause

*(Finding, not hypothesis — the mechanism was executed above.)* The guard was never applied here.
`own<T>()` — this project's WR-04 mitigation — was introduced at 188.1-04 and covers five sinks;
`verticalOffsetFor` moved **verbatim** out of `WorkflowCanvas.tsx` into `editAffordance.ts` during
188.1-03, and a verbatim move by construction carries forward whatever guard the original had,
which was none.

`188.2-DEFERRED.md` **D-188.2-DEF-02 does not cover this.** That entry defers consolidating four
inline `hasOwnProperty` guards — sites that are each *already correct* and merely un-deduplicated.
This is a site with **no guard at all**. Closing D-02 would not close this.

One more inherited, unguarded sink was noted in the same sweep and is filed here so it is not lost:
`frontend/src/lib/providerLogo.tsx:107-108`.

## Surface classification

`Agentic-RAG` — this app's own frontend. Routes at the four GSD touchpoints.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 188.2 is closing at `/gsd:secure-phase`, and adding a
  fix here would be new capability inside a closure step (the exact shape G-7 exists to stop).
- **Defer to future phase / milestone:** **Phase 189.** Its discuss-phase already owes a
  `PhaseNodeCard.tsx` G-5 audit over this same directory, so this is a natural, cheap rider.
- **Plant as seed:** n/a — concrete and local.
- **External — note only:** no

## Fix sketch

One import of the zero-import leaf Phase 188.2 just created:

```ts
import { own } from "@/components/workflows/ownProperty"
const live = own(overlay, slug)
…
return own(nudges ?? {}, slug) ?? 0
```

⚠ `editAffordance.ts` is asserted to be a **LEAF** by a live fence
(`WorkflowCanvas.test.tsx` — "editAffordance is a LEAF — no react import, and no component
module at all"). `ownProperty.ts` is camelCase and imports nothing, so it satisfies that fence's
`COMPONENT_SIBLING` rule — but the fence must be re-read, not assumed, by whoever fixes this.

⚠ **jsdom cannot see this defect.** It applies no CSS and computes no stacking contexts, so a
green unit suite is not evidence either way. The regression check is a driven Chrome MCP row:
author a phase slugged `constructor`, then read the affordance's computed `transform` and confirm
it is not `none`, plus an `elementFromPoint` reachability check on a neighbouring card.

## Reference / evidence links

- `frontend/src/components/workflows/editAffordance.ts:214-224` — the sink
- `frontend/src/components/workflows/PlaneEditingLayer.tsx:176-177`, `:225`, `:256-262` — the three
  consuming transforms; `:183`, `:231`, `:269` — the `zIndex: AFFORDANCE_Z` that amplifies it
- `frontend/src/components/workflows/ownProperty.ts:82-86` — the WR-04 guard that should apply
- `backend/app/models/harness.py:202` — `slug: str`, unconstrained
- `.planning/phases/188.2-…/188.2-SECURITY.md` § Unregistered Flags — FLAG-01, the origin
- `BUG-260806-01` — the fix whose `zIndex` this defect now rides on
