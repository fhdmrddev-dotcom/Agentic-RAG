---
sketch: 061
name: control-room-shell
question: "What shape is the operator control room — how do the admin rail, the zone identity, and the honest day-one landing compose?"
winner: "B"
tags: [phase-146, admin-shell, operator, control-room, zone-identity, honest-locks, non-discoverable, layout]
---

# Sketch 061: Control-Room Shell

## Design Question

Phase 146 (ADMIN-01) ships the operator foundation: a gated `/admin` surface no ordinary
user can even discover, with every operator action audit-logged. This sketch answers the
**shape** question — what structure does the control room take, given:

- **Distinct control room** (operator intake decision 1): same Aether Deep Midnight theme,
  but crossing the threshold is *felt* — its own internal nav, an OPERATOR marker, a denser
  instrument posture.
- **Operator-only shield nav entry** (decision 2): a shield item at the bottom of the 52px
  app rail, rendered only after an operator probe; everyone else's nav is byte-identical
  to today.
- **Full map, honest locks** (decision 3): the rail/tabs/tiles show ALL planned sections
  from day one — Control Plane (147), Users & Access (148), Model Registry (149),
  Secrets (150) — dimmed + locked with their phase; the landing leads with what's REAL:
  the four live backpressure signals + the operator-audit feed.

Whatever shape wins here is the home Phases 147–150 move into.

## How to View

open .planning/sketches/061-control-room-shell/index.html

## Variants

- **A: Command Deck** — persistent left admin rail (~220px) with grouped **Now / Arriving**
  entries; identity + recording marker live in the rail footer. The whole intended shape
  is permanently visible; most "control room" of the three.
- **B: Operator Band** — a full-width amber-warmed zone band (Skill-Studio
  persistent-header precedent) + horizontal section tabs, locked tabs inline with phase
  tags. Content gets the full width; lightest structural net-new.
- **C: Tile Board** — no rail, no tabs: the landing IS the map (engine-health 060 tile
  precedent). Live tiles carry real content inline (posture signals, last 3 audit rows);
  locked tiles sit dimmed with an "arrives · 14x" tag; live tiles drill in full-replace
  with a ‹ back.

## What to Look For

1. **The 3-second read at rest** — land in each variant cold: can you instantly answer
   "is the platform healthy, what can I do today, what's coming"?
2. **Zone identity weight** — does the amber OPERATOR treatment (rail hairline vs band
   vs strip) say "you're holding the keys" without shouting? Amber is the app's
   needs-you color; here it marks the zone, sparingly.
3. **Honest locks** — click a locked section in each variant. The refusal ("Nothing here
   yet — arrives with Phase 147") must feel calm and truthful, not broken.
4. **The recording story** — hit ↻ Refresh on posture: the values update AND a new
   `backpressure.view` row lands at the top of the audit feed (your own view is a
   recorded action). Does the feed placement make that beat legible in each shape?
5. **Zero trace** — flip the "Viewing as" toggle to Regular user: the shield vanishes
   from the app rail and the surface becomes a plain 404. This is the ADMIN-01
   non-discoverability contract, shown, not told.
6. **Growth fit** — imagine 147's active-runs table + kill-switches, 148's audit browser
   + user list, 149's model registry landing inside each shape. Which structure absorbs
   four more sections most gracefully?

## Grounding (real, not invented)

- The four posture signals are the REAL `/admin/backpressure` payload fields
  (`anyio_threadpool_depth`, `redis_active_runs`, `postgres_pool_in_use`,
  `per_worker_run_count` — Phase 078, additive-only JSON contract D-078-08).
- `require_operator` replaces the current `BACKPRESSURE_ADMIN_USER_IDS` env allow-list
  gate on that endpoint (146 success criterion 3).
- The audit feed shape is `operator_audit_log` (who / what / when — net-new in 146; the
  violet `net-new · 146` flag marks its read endpoint as in-phase net-new wire).
- The audit BROWSER (filters, date range, CSV) is honestly deferred to Phase 148 in-surface.
- Navigation is a `useState<ActiveView>` full-surface swap (Skill Studio / Tuner
  precedent) — no router exists; the shield entry extends `NAV_ITEMS` conditionally.
- The shield glyph must stay distinct from Governance's `ShieldCheck` (plain shield +
  amber tint here).
