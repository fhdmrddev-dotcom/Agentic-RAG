---
id: BUG-260909-02
title: A refresh sometimes loses Workflows, Settings and Control Room from the nav — an in-flight or failed effective-features fetch was rendered as "you are not allowed"
reported: 2026-09-09
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/navigation, nav-items, useEffectiveFeatures, App.tsx, feature-visibility, UX/honesty]
folded_into: 240
verified_closed_by: 240
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 173700576
  date: 2026-09-09
---

# BUG-260909-02: unknown was rendered as denied, and the doors vanished

## What the operator saw

*"Sometimes when I refresh the application, settings and control room does not load, or sometimes
organisation settings."* The screenshot shows a nav rail carrying **Chat · Library · Classification
· Connections · Skills** and **no Workflows, no Settings, no Control Room** — with all of them
present on the very next render.

## Cause

`frontend/src/lib/nav-items.ts`:

```ts
return NAV_ITEMS.filter((item) => !item.feature || features[item.feature] === true)
```

`App.tsx:211` already computes `featuresLoading`, and **line 212 never passed it**. So while
`GET /features` was in flight — or after it FAILED — every governed key read `undefined`,
`undefined === true` is `false`, and every governed door was filtered out.

⛔ **"We have not been told yet" was rendered as "you are not allowed."** A transient network
failure was indistinguishable from a permission decision, which is why it was intermittent.

⚠ **A test fixture had encoded the same confusion**, which is why no suite caught it:
`navItemsConnections.test.ts` used `const MEMBER: EffectiveFeatures = {}` to stand for a denied
member. But `api/features.py:61-78` builds its answer with a dict comprehension over **every**
governed feature, so a real member receives every key with an explicit boolean. `{}` only ever
means loading or failure. The fixture made the filter look correct while it was silently wrong.

## Fix

Hide only what is **known** to be denied:

```ts
return NAV_ITEMS.filter((item) => !item.feature || features[item.feature] !== false)
```

`undefined` (unknown / loading / failed) → visible. `false` (explicitly denied) → hidden.

⚠ **The direction is deliberate and it is the OPPOSITE of `sourceCapability.ts`'s.** That predicate
fails CLOSED, because offering a source that cannot be read is a dead control a person blames
themselves for. This one fails OPEN because **the API is the wall** — `nav-items.ts`'s own header
says *"Render-only; the API is the wall"*, and every governed route carries its own
`require_visible`. An optimistic door costs at worst one honest refusal; a hidden door costs a
person their Settings page for no reason they can see.

## Evidence

`navItemsUnknownIsNotDenied.test.ts` — 4 cases, including the positive control that an explicitly
denied item is **still hidden**, so the dead-click avoidance these entries were tagged for is
untouched. The `MEMBER` fixture is corrected to explicit `false`s with the reasoning written in.
The three other `visibleNavItems` consumers (`revertByteIdentical`, `SettingsPage`,
`navItemsConnections`) all stay green.
