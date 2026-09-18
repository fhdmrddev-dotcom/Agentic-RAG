---
sketch: 247
name: sources-and-watches
question: "How does a watched-source card honestly report its connection health separately from its run outcome, and where does 'Sync now' put its answer without destroying the screen?"
winner: "A"
tags: [phase-247, watch-03, watch-04, watch-05, watch-06, watch-07, g2-sketch-gate, sources-and-watches]
---

# Sketch 247 — Sources & Watches: Truth in Health, Sync & Time

**Phase:** 247 — Sources & Watches  
**Requirements:** `WATCH-03`, `WATCH-04`, `WATCH-05`, `WATCH-06`, `WATCH-07`  
**Context:** `.planning/phases/247-sources-and-watches/247-SKETCH-BRIEF.md`  

---

## 1. Design Questions & Scope

> **How does a watched-source card tell the truth about both its connection health and its sync runs without conflating them, where does "Sync now" deliver its answer without unmounting the list, and how does the surface consistently speak about time?**

This sketch addresses the four surface decisions mandated by G-2 before `/gsd:plan-phase 247`:

| REQ | Surface Issue | Core Decision Mocked |
|---|---|---|
| `WATCH-03` | Conflating run outcome with connection health (`BUG-260909-03`) | Separating connection state (`● Connected` vs `⊙ Switched Off in Settings`) from run outcome (`⚠ Run failed 429` vs `✓ Success`). |
| `WATCH-04` | "Sync now" collapses section into loading screen (`BUG-260909-04`) | Row-level in-flight state (`Syncing...`); inline persistent result tag without unmounting or discarding view. |
| `WATCH-05` | Missing file has no disappearance timestamp (`BUG-260909-05`) | Explicit `missing_since` formatting (`Missing since 5 Sep (9d ago)`), retained in Library until purged. |
| `WATCH-06` | Button labelled as a write only navigates (`BUG-260909-06`) | Control reads as navigation (`Open Connection Settings ↗`), never an imperative write (`Turn back on`). |
| `WATCH-07` | Grammatical collision: preposition + relative time (`BUG-260909-07`) | Elimination of *"on [relative]"* (`Last read successfully 8m ago` vs `Last read successfully 2 Sep, 09:14`). |

---

## 2. How to View

To view the interactive sketch:
```bash
start .planning/sketches/247-sources-and-watches/index.html
```
*(Or open `.planning/sketches/247-sources-and-watches/index.html` in your browser)*

### Key Interactive Actions to Try

1. **Switch Variants (A / B / C):**
   - Click the top pill tabs to compare the three visual architectures.
2. **Click "Sync now":**
   - Click **Sync now** on Row 1 or Row 3 in any variant.
   - **Observe:** The section **never unmounts or collapses** into *"Loading watched folders..."*. The row enters a focused `Syncing...` state, then presents the outcome directly inline.
3. **Simulate Connection Toggle:**
   - In the top-right toolbar, toggle the **Google HR Connection** checkbox between *Switched Off* and *Active (Enabled)*.
   - **Observe:** Watch Row 2 (HR Resumes CV) immediately updates its rendered truth without waiting for a scheduled tick or showing stale claims.
4. **Inspect Missing File Row:**
   - In Row 3 (OneDrive), inspect `Q3_Cashflow_Forecast.xlsx`: observe the honest `missing_since` representation (`5 Sep 2026 (9d ago)`).

---

## 3. The Three Variants

### Variant A: Two-Tier Status Pill + Inline Feedback (Recommended)
- **WATCH-03 (Dual Health):**
  - Uses a **Dual Status Pill** in the card header:
    - Primary Pill: `● Connected` (or `⊙ Connection Off`).
    - Secondary Pill: `⚠ Run failed (429)` (or quiet at rest when successful).
  - A transient API rate limit or timeout clearly displays: *"Transient run refusal (Connection is healthy): Google Gmail API returned 429. Next scheduled check in 11m."*
  - When connection is disabled in Settings, the primary pill turns `⊙ Connection Off` with a neutral banner.
- **WATCH-04 (Sync Now Placement):**
  - "Sync now" button shows a lightweight spinner during request.
  - A clean, animated badge appears adjacent to the button: `✓ Synced just now (0 changes)`.
- **WATCH-05 & 07 (Time Vocabulary):**
  - Relative times drop the preposition `"on"`: `Last read successfully 8m ago`.
  - Absolute times retain clean dating: `Last read successfully 2 Sep, 09:14`.
  - Missing file displays: `Missing since 5 Sep 2026 (9d ago) · Retained in Library`.
- **WATCH-06 (Action Honesty):**
  - Clear navigation action: `Open Connection Settings ↗`.

### Variant B: Diagnostic Callout Box + Top-Docked Banner
- **WATCH-03 (Dual Health):**
  - Card header retains a single high-level watch status badge (`● Active` / `⊙ Paused`).
  - Below the header, if a run fails or connection is disabled, an explicit **Callout Box** explains the exact state:
    - `⚠ Run Issue: Rate Limit (Connection is Healthy) [HTTP 429]`
- **WATCH-04 (Sync Now Placement):**
  - Outcome lands in a top-docked ephemeral notification banner within the card:
    `[✓ Sync Completed: 48 items verified with Google Workspace INBOX. 0 changes · Dismiss [✕]]`
- **WATCH-06 (Action Honesty):**
  - Button reads `Manage in Connections ↗`.

### Variant C: Split Anatomy (Connection Pillar + Watch Channel)
- **WATCH-03 (Dual Health):**
  - Physical split in card layout:
    - **Left Pillar:** Connection identity, service mark, connection status (`● Auth Active` / `⊙ Disabled`), quick link to Settings.
    - **Right Channel:** Watch name, folder target, sync cadence, run outcome, and sync controls.
  - Conflation is structurally impossible because connection health and run outcome occupy different layout zones.
- **WATCH-04 (Sync Now Placement):**
  - Sync button and outcome tag sit directly in the right channel header.

---

## 4. Evaluation & Trade-offs

| Criterion | Variant A (Dual Status Pill) | Variant B (Diagnostic Callout) | Variant C (Split Anatomy) |
|---|---|---|---|
| **Scannability at Rest** | High (compact, single-line card when collapsed) | Medium (callout adds vertical height) | High (dense, distinct horizontal split) |
| **Separation of Concerns (`WATCH-03`)** | Strong (connection pill vs run pill) | Moderate (explained in prose box) | Absolute (physical 2-column layout separation) |
| **Sync Now Feedback (`WATCH-04`)** | Smooth, inline, zero layout shift | Ephemeral banner (slight shift) | Embedded in right header |
| **Mobile Responsiveness** | Excellent (natural flex wrapping) | Good (vertical stack) | Requires column collapse on narrow screens |
| **Code Compatibility** | Direct drop-in to `WatchedFoldersSection.tsx` & `sourceHealthVocabulary.ts` | Minor layout change to `WatchRow` | Significant layout refactor |

---

## 5. Approved Design Direction

> ## ★ WINNER: **A — Two-Tier Status Pill + Inline Sync** (operator, 2026-09-14)
>
> 1. **WATCH-03 (Dual Health Separation):** Cleanest scannability across many watched folders while maintaining strict truthfulness. Connection status (`● Connected` / `⊙ Connection Off`) and run outcome (`⚠ Run failed 429`) sit as two distinct indicators.
> 2. **WATCH-04 (Sync Now Placement):** Keeps row-level state (`Syncing...`) and renders the sync outcome inline (`✓ Synced just now (0 changes)`) without any section-wide refetch collapse.
> 3. **WATCH-05 & WATCH-07 (Time Vocabulary):** Eliminates preposition collision (*"on 8m ago"*) and provides explicit `missing_since` formatting (`Missing since 5 Sep (9d ago)`), retained in Library until purged.
> 4. **WATCH-06 (Action Honesty):** Navigation buttons clearly read as navigation (`Open Connection Settings ↗`), never promising an inline mutation.
