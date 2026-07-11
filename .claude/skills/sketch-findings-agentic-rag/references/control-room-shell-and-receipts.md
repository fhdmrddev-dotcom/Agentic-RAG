# Control-Room Shell & Audit Receipts (Phases 146–147)

The operator `/admin` zone: a DISTINCT control-room band-and-tabs shell inside the same app
(never a separate world, never a second left nav rail), where **every action is recorded and
the ledger IS the receipt**. Locked winners: **061-B** (shell) + **062-A** (receipts) +
**066** (the assembled navigation/linkage contract).

## Design Decisions

### The shell (061-B — operator band + horizontal tabs, plain-language-first)
- **Entry**: an operator-only amber shield at the BOTTOM of the 52px app rail, probe-gated —
  a non-operator's nav is byte-identical to today; guessing `/admin` URLs or calling any
  admin endpoint returns a plain **404** (non-discoverable by construction — the 146 red line).
- **Zone identity = a full-width amber-warmed operator band** over the content: shield +
  "Control Room" + `OPERATOR` mono chip + operator identity + the recording marker
  ("● every action recorded") + `‹ Back to app`. Same Deep Midnight theme — the band alone
  marks the zone.
- **Horizontal section tabs under the band** — deliberately NOT a second left rail beside
  the app's 52px rail (operator-rejected: two adjacent rails). Post-147 IA (D-08 / 066):
  **Control Plane (live, landing) · Users & Access · Model Registry 🔒 · Secrets 🔒 ·
  Audit log (live)**. The 146 "Overview" was PROMOTED into Control Plane — health lives in
  exactly ONE place.
- **Full map, honest locks**: future tabs render from day one, dimmed with a calm
  "coming soon" refusal that NAMES the arriving capability — **phase/roadmap numbers never
  appear in shipped copy** (T-146-10).
- **ALL copy plain-first** with a **"⌥ Technical names" toggle** revealing raw field/action/
  endpoint names (`anyio_threadpool_depth`, `operator.login`) — the LANG-01 two-audience
  pattern born here, not retrofitted.

### The receipts (062-A — the always-on ledger)
- **The receipt for an operator action = the action landing at the top of the always-visible
  "Recent operator actions" card** (row slides in; the band marker flashes gently).
  **No toasts, no counters** — the proof must not evaporate.
- **✎ write mark** on write actions so "what did I change" vs "what did I look at" scans
  instantly. Reads carry no mark.
- **Consequence ≠ receipt**: a write that STAYS in effect (maintenance mode) keeps its own
  persistent amber banner ("users currently see the platform read-only") — the feed row says
  *recorded*, the banner says *still true*. Two truths, two homes.
- Receipts are **plain sentences** ("Turned ON maintenance mode"), never action codes.
- **D-07 poll/visit discipline** (shipped 147): on mount record exactly ONE "Opened the
  Control Plane" visit row; silent ~10s auto-poll of read-only data (floor-exempt — polls
  never spam the ledger; pauses on hidden tab); the manual ↻ Refresh is the deliberate read —
  it records "refresh" AND pulses the marker.

### The linkage contract (066 — reference, mirrored in MANIFEST RDD 56)
- **7 consistency guards**: one 062-A receipt vocabulary everywhere · **graded action-guards
  by SHAPE** (target-specific destructive → victim-naming confirm sheet; global toggle →
  arm-to-confirm; reversible-per-feature no-victim → direct flip) · consequence ≠ receipt ·
  plain-language default + ⌥ reveal · honest locks · non-discoverable/404 · **read-only
  monitoring, not surveillance** (run cards never drill into another user's thread;
  impersonation = a named-trigger deferral).
- Every button→destination is enumerated (15 rows in the 066 README/sketch) — implementation
  builds ONE spec, not per-surface choices that drift.

## CSS Patterns

```css
/* The operator band — amber-warmed gradient over the elev1 surface */
.op-band {
  background: linear-gradient(180deg, hsl(38 92% 60% / 0.07), transparent), var(--color-bg-elev1);
  border-bottom: 1px solid hsl(38 92% 60% / 0.25);
  padding: 14px 22px 0;
}
.op-chip {   /* the OPERATOR chip */
  font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.12em;
  color: var(--color-warning); background: var(--color-warning-dim);
  border: 1px solid hsl(38 92% 60% / 0.3); border-radius: var(--radius-sm); padding: 2px 7px;
}

/* Recording marker — green at rest, flashes amber when a row lands */
.rec-marker { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs);
  color: var(--color-text-dim); border-radius: var(--radius-full); padding: 3px 10px;
  transition: all var(--dur-base) var(--ease-out); }
.rec-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-success);
  box-shadow: 0 0 6px hsl(142 71% 45% / 0.6); }
.rec-marker.flash { background: var(--color-warning-dim); color: var(--color-warning); }
.rec-marker.flash .rec-dot { background: var(--color-warning); animation: brandPulse 0.5s var(--ease-out) 2; }

/* Band tabs — underline-active, lock-dimmed */
.band-tab { padding: 8px 13px; color: var(--color-text-muted); border-bottom: 2px solid transparent; }
.band-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
.band-tab.locked { color: var(--color-text-dim); cursor: not-allowed; }
```

```js
// The flash-don't-toast receipt beat
function recFlash(){ marker.classList.remove('flash'); void marker.offsetWidth;
  marker.classList.add('flash'); setTimeout(() => marker.classList.remove('flash'), 1600); }
```

## HTML Structures

```html
<div class="op-band">
  <div class="band-top">
    <div class="band-title">[shield] Control Room</div>
    <span class="op-chip">OPERATOR</span>
    <span class="band-identity">operator@email</span>
    <span class="spacer"></span>
    <span class="rec-marker"><span class="rec-dot"></span> every action recorded</span>
    <span class="back-link">‹ Back to app</span>
  </div>
  <div class="band-tabs">
    <span class="band-tab active">Control Plane</span>
    <span class="band-tab">Users &amp; Access</span>
    <span class="band-tab locked">Model Registry <span class="lock">🔒</span></span>
    <span class="band-tab locked">Secrets <span class="lock">🔒</span></span>
    <span class="band-tab">Audit log <span class="pill">count</span></span>
  </div>
</div>
```

Ledger row: `[✎?] plain-sentence label ……… short timestamp` — baseline-aligned, newest first;
the write mark is amber with an `sr-only` "Change:" prefix.

## What to Avoid

- **A second left admin rail** (061-A rejected — two adjacent nav rails).
- **Receipt toasts / counting markers** (062-B/C rejected — proof evaporates; a count proves
  *something* was recorded, not *what*).
- **Phase/roadmap numbers in shipped copy** (locked tabs say what's coming, never "148").
- **Duplicated health homes** — the 146 Overview was promoted, not paralleled (D-147-IA).
- **Action codes in receipts** — plain sentences only; codes live behind ⌥ Technical names.
- Logging silent auto-polls to the ledger (every row must be a human action).

## Origin

Synthesized from sketches: 061, 062, 066 (Phases 146–147; operator-locked 2026-07-10/11).
Source files: `sources/061-control-room-shell/`, `sources/062-gate-honesty-and-receipts/`,
`sources/066-control-plane-assembled-and-linkage/`. Shipped code:
`frontend/src/components/admin/` (OperatorBand, ControlRoomPage, RecentActionsCard,
LockedTab, TechnicalNamesToggle).
