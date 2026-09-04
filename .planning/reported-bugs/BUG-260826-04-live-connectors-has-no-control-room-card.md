---
id: BUG-260826-04
title: live_connectors has no Control Room card — the only way to turn live sending on is a devtools console call
reported: 2026-08-26
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/admin, frontend/settings, backend/api, operator-surface]
folded_into: 210
verified_closed_by: "210"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 386b5a4
  date: 2026-08-26
---

# BUG-260826-04: The `live_connectors` kill-switch has no operator UI

## What we observed

Settings → Connections renders the OFF banner:

> Live sending is off for this platform … **An operator turns `live_connectors` on in the Control Room.**

There is no such control in the Control Room. The feature-visibility map renders from a
client-side `FEATURES` array (`FeatureVisibility.tsx:99+`) that has no entry for
`live_connectors`, so the banner instructs the operator to use a surface that does not exist.

The server half is complete and correct:

- `live_connectors` is in the `PUT /admin/visibility` allowlist (`admin.py:119`)
- it is in `_GOVERNED_FEATURES` with cold default `"off"` (`user_settings.py:1214`)
- `GET /admin/visibility` **does** return it (it iterates `_GOVERNED_FEATURES`, `admin.py:1024`)
- `GET /features` returns the key too

Only the client is stale, and knowingly so — `_core.ts:88-97` carries an explicit warning that the
`GovernedFeature` union is deliberately stale against the server, owned by **`D-190-DEF-09`**,
because widening it fails five `Record<GovernedFeature, …>` exhaustive maps (two inside `/admin`,
fenced by Phase 190's D-25). `connectionsCopy.ts:47-64` reads the key through a documented
fail-closed cast instead. Both comments state that the union and the operator card were to land in
the same later commit; the card has not landed.

`scripts/set-feature-visibility.py` exists solely to paper over this, and says so in its own
docstring: *"the only way to turn it on is pasting JS into the browser devtools console, which is
not a reasonable thing to ask an operator to do."* That script targets the local DB by default and
**bypasses the operator audit ledger**.

Turning it on in production on 2026-08-26 required exactly that console call:
`PUT /admin/visibility {"feature":"live_connectors","audience":"everyone","roles":[]}` → 204.

## Why it matters

Major, on three counts.

1. **The banner names a control that does not exist.** An operator reading it correctly concludes
   the product is broken.
2. **The audience value is silently load-bearing.** The endpoint accepts four audiences for this
   key, but the send executor requires a positive `"everyone"`
   (`phase_types.py:2391`, the CR-03 fix). An operator who picks `"operators"` or `"role"` — both
   valid to the API — gets a Connections table that looks enabled over a platform that sends
   nothing. Nothing warns them. A card would constrain this to the two meaningful states.
3. **Security hygiene.** The only shipped path trains operators to paste JavaScript into a devtools
   console — precisely the habit self-XSS attacks exploit, on the account with the highest
   privilege in the product. That makes the missing card a security-adjacent item, not just a
   convenience one.

## Hypothesized cause

Not a hypothesis — documented. `D-190-DEF-09`, deferred by plan 190-16 because widening the union
breaks five exhaustive maps and the honest completion is an operator card, which is a user-facing
capability belonging to its own plan.

## Surface classification

`Agentic-RAG`.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** its own small phase (it is a user-facing capability, so
  under G-7 it must not be smuggled into a gap-closure round)
- **Plant as seed:** n/a — it is already a named deferred item with an owner
- **External — note only:** no

Scope: add `"live_connectors"` to the `GovernedFeature` union (`_core.ts:79`), add its `FeatureDef`
row to `FeatureVisibility.FEATURES`, add the `DEFAULT_VISIBILITY` entry
(`ControlRoomPage.tsx:188`), and repair the five exhaustive `Record<GovernedFeature, …>` maps the
widening breaks. Retire the `liveConnectorsOnFrom` cast in the same commit — both halves were
always meant to land together. Consider constraining this key's card to On/Off only, given the
executor's `== "everyone"` requirement.

## Workarounds (prompt-side, code-side, or UI-side)

Operator console call against the production backend (audited — writes a `visibility.set` row):

```js
await fetch(`${API}/admin/visibility`, {
  method: "PUT", headers: H,
  body: JSON.stringify({feature: "live_connectors", audience: "everyone", roles: []})
});   // 204
```

Or direct SQL (**bypasses the audit ledger**, and re-warms no worker cache — the 30s TTL applies):

```sql
UPDATE app_settings
SET feature_visibility = coalesce(feature_visibility,'{}'::jsonb)
    || '{"live_connectors":{"audience":"everyone","roles":[],"groups":[]}}'::jsonb,
    updated_at = now()
WHERE id = 'global';
```

Or `python scripts/set-feature-visibility.py live_connectors on` (local DB by default; also
bypasses the ledger).

## Reference / evidence links

- `frontend/src/lib/api/_core.ts:79-97` — the deliberately stale union + the D-190-DEF-09 note
- `frontend/src/components/settings/connectionsCopy.ts:39-66` — `liveConnectorsOnFrom`, the interim reader
- `frontend/src/components/admin/FeatureVisibility.tsx:99+` — the `FEATURES` array with no entry
- `backend/app/api/admin.py:110-121, 1008-1030, 1044-1086` — the server half, complete
- `backend/app/services/harness/phase_types.py:2381-2392` — the `== "everyone"` requirement
- `scripts/set-feature-visibility.py:1-24` — the workaround script and its own account of why it exists
