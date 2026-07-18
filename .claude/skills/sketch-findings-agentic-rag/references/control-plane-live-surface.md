# Control Plane — Health, Active Runs & System Controls (Phase 147)

The operator's live surface inside the 061-B shell: pinned vitals over one sectioned scroll
(Health → Active runs → Controls → Activity). Locked winners: **063-B** (composition) +
**064-B** (runs + Kill) + **065-A** (controls + maintenance).

## Design Decisions

### Composition (063-B — pinned health header + sectioned scroll)
- A compact **always-pinned VITALS strip** (dependency status dots Redis/Database/Sandbox +
  agents-working + capacity read + `N in flight`) that never scrolls away — a *monitoring
  posture*. Hosts the ⌥ Technical-names toggle + ↻ Refresh.
- Below: ONE scroll of **Health detail** (3 dependency cards: reachability + latency, on the
  additive-only backpressure JSON) → the four REAL `/admin/backpressure` signals under plain
  labels (Server capacity · Agents working · Database connections · Work spread) →
  **Active runs** → **Controls** → **Activity** (the 062-A ledger preview + "View all ›" →
  Audit tab).
- **The honest degrade state is load-bearing**: the pinned vitals go amber/red even while
  scrolled deep into Controls — a monitor you can't see isn't a monitor. Roll-up rule:
  `down` wins over `slow` (latency > ~500ms while up) wins over `up`; absent probes = unknown,
  never green.
- Read failures keep last-known values (honest degrade, never a crash); each fetch guarded
  independently so one failure never nukes the others.

### Active runs + Kill (064-B — cards + a confirm sheet that names the victim)
- Each in-flight run = a calm card: **real `@lobehub` provider mark** (048 map) + model +
  user/workflow + live-ticking elapsed (stable start-ts — the 095 never-vanishes lesson) +
  **what it's DOING now** (current tool/step with a pulsing dot).
- A healthy run reads distinct from a runaway: `long-running` amber tag at ≥8 min;
  `not responding` red tag + red-tinted card for a stalled run.
- **Kill opens a small confirm sheet that NAMES the victim**: "End **maria's run** on
  **GPT-5**, **2m 14s** in — cancels immediately, the user sees it stop. Recorded with your
  name." Chosen live over inline arm-to-confirm (too easy to fire for an action with a
  victim). This victim-naming sheet is THE pattern for every target-specific destructive
  action (066 guard; inherited by 148's user-disable).
- Kill delegates to the existing **`cancel_run` zombie-heal** (`runs.py:1097`, D-062-11):
  the killed card shows an honest two-state **Cancelling… → ✎ Cancelled · recorded**; a
  stuck run resolves as "**recovered** a stuck run", never "killed". Not optimistic — the
  re-fetch is the truth.
- Empty state is calm ("No runs in flight"), never broken-looking. Run cards are READ-ONLY
  (monitoring, not surveillance — no drill into another user's thread).

### Controls (065-A — capability card grid + spatially-separated maintenance)
- The four fail-closed kill-switches (Web search · Code sandbox · Self-improvement ·
  Workflows) ride the existing **`app_settings` TTL cache** (`web_search_enabled` +
  `sandbox_enabled` pre-existed; the rest are new KEYS, **no new flag infrastructure**).
- Rendered as a **2×2 card grid**; turning one OFF tints the card red, adds an
  **"off for everyone"** tag, and reveals the CONCRETE impact when honestly derivable
  ("2 runs using code will error on their next call") — **OFF looks armed, not a neutral
  preference**. Never fabricate an impact count — no number is better than a fake one.
- **Maintenance/read-only mode is set APART** in its own amber-framed "Platform state"
  panel — the "one capability off" vs "whole platform read-only" distinction is carried by
  WHERE it lives (location-carries-meaning), not styling alone.
- **Graded guards**: capability switches flip DIRECTLY (fast for an emergency, reversible,
  no individual victim); maintenance uses **arm-to-confirm**; while ON, the persistent
  062-A consequence banner shows.

## CSS Patterns

```css
/* Pinned vitals (sticky within the tab scroll) */
.vitals { position: sticky; top: 0; z-index: 10; border-bottom: 1px solid var(--color-border);
  background: hsl(216 45% 4% / 0.95); backdrop-filter: blur(8px); }

/* Run card — stuck variant */
.run-card { display: flex; align-items: center; gap: 14px; background: var(--color-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 13px 16px; }
.run-card.stuck { border-color: hsl(0 72% 51% / 0.4); background: hsl(0 72% 51% / 0.05); }
.tag.long  { color: var(--color-warning); background: var(--color-warning-dim); }
.tag.stuck { color: var(--color-danger); background: var(--color-danger-dim);
  border: 1px solid hsl(0 72% 51% / 0.35); }

/* The victim-naming confirm sheet — anchored to the card, danger-bordered */
.confirm-sheet { position: absolute; right: 14px; top: calc(100% - 6px); width: 320px;
  background: var(--color-surface-hi); border: 1px solid hsl(0 72% 51% / 0.4);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg); padding: 15px 16px;
  animation: fadeSlideUp var(--dur-base) var(--ease-out); }

/* Honest cancel states */
.state-cancelling { color: var(--color-warning); }   /* spinner ring + "Cancelling…" */
.run-card.done { opacity: 0.55; }                     /* "✎ Cancelled · recorded" */

/* Capability card — OFF looks armed */
.cap-card.off { border-color: hsl(0 72% 51% / 0.35); background: hsl(0 72% 51% / 0.04); }
```

```js
// Live elapsed from a stable start-ts (never a resettable counter)
setInterval(() => { el.textContent = fmtElapsed(Date.now() - Number(el.dataset.started)); }, 1000);
```

## HTML Structures

Run card: `[provider logo 26px] [model + provider name + tags / user · ●doing · thread]
[elapsed mono] [Kill]`. Confirm sheet: `<h4>Kill this run?</h4><p>End <b>{victim}</b> on
<b>{model}</b>, <b>{elapsed}</b> in…</p> [Keep it running] [Kill run]`.

## What to Avoid

- **Inline arm-to-confirm or press-and-hold for Kill** (064-A/C rejected — an action with a
  victim warrants the naming sheet).
- **Health that scrolls away** (063-A rejected) and sub-tabs (063-C — over-structured; the
  documented scale-up only if runs table + audit browser outgrow previews).
- **Fabricated impact counts** on kill-switch cards; only honestly-derivable numbers render.
- **"Killed" language for a zombie-heal** — a stuck run is *recovered*.
- Mixing maintenance into the capability grid (the separation IS the meaning).
- Optimistic kill UI — show Cancelling… until the server truth lands.

## Origin

Synthesized from sketches: 063, 064, 065 (Phase 147; operator-locked 2026-07-11; 066 carries
the assembled composition). Source files: `sources/063-…/`, `sources/064-…/` (incl. provider
logo SVGs), `sources/065-…/`. Shipped code: `frontend/src/components/admin/`
(ControlRoomPage — poll/visit discipline, HealthSignals, ActiveRunsSection, CapabilityGrid,
MaintenancePanel).
