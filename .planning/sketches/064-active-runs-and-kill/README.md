---
sketch: 064
name: active-runs-and-kill
question: "How does the live cross-provider run list read (model/user/activity/elapsed), and how does 'Kill' — an action with a victim — feel deliberate + honest (delegates to zombie-heal) without a scary red-button wall?"
winner: "B"
tags: [phase-147, admin-shell, operator, active-runs, kill-run, cancel-run, zombie-heal, cross-provider, sc10, provider-logos, honest-states, ad-02]
---

# Sketch 064: Active Runs & the Kill Action

## Design Question

Phase 147's headline interaction and its highest-risk surface. The operator watches every
in-flight agent run **across all users, workflows, and providers**, and can **Kill** a
runaway. 062 explicitly flagged this as the open question: *"imagine 'Kill run' instead of
a toggle — an action with a victim. Which receipt treatment carries that weight?"*

Two things must be true at once:
- **Legible at a glance, cross-provider (SC#10):** Claude / GPT-5 / Gemini / DeepSeek /
  MiniMax / Kimi read as peers, each with its real provider mark, live-ticking elapsed, and
  what it's doing right now — so the operator can *tell a healthy run from a runaway*.
- **Kill feels deliberate + honest:** hard to fire by accident, it names its victim, and it
  tells the truth about the async cancel — a run doesn't blink out; it goes
  **Cancelling… → Cancelled**, and a stuck/zombie run is *recovered*, not silently dropped.

## How to View

open .planning/sketches/064-active-runs-and-kill/index.html

## Variants

- **A: Table + arm-to-confirm inline** *(the pre-review lead)* — dense instrument table;
  Kill flips in place to "Kill this run? · Kill / Keep". One deliberate second click, no
  modal, fast for a real runaway.
- **B: Cards + confirm sheet** ★ — each run a calm card; Kill opens a small sheet that *names
  the victim* ("End maria's run on GPT-5, 2m 14s in"). Heaviest, most explicit guard.
- **C: Table + press-and-hold** — same table; Kill is a press-and-hold (~1s fill). Physical
  friction as the safety; tactile but less conventional.

**Winner: B — Cards + confirm sheet** (operator, 2026-07-11). Chosen live over the
pre-review A lean: for an action *with a victim*, the sheet that spells out **who / which
model / how long in** is worth the extra surface — the arm-to-confirm A felt too easy to
fire. The confirm-that-names-the-target becomes the linkage rule for target-specific
destructive actions (see the 066 contract). The killed-card honest **Cancelling… →
Cancelled · recovered-a-stuck-run** two-state carries forward from A/C.

## What to Look For

1. **The runaway read** — the list is deliberately mixed: a fresh 8-second Gemini run, a
   normal 2-minute Claude run, an 8m41s MiniMax **workflow** run tagged *long-running*, and
   a 14-minute Kimi run tagged **not responding** (highlighted red). Can you spot *which one
   to kill* in under 3 seconds? That's the whole job.
2. **The Kill weight** — kill a run in each variant. Does A's inline arm feel *too easy*?
   Does B's victim-naming sheet feel *right* or *slow*? Does C's hold feel *safe* or
   *fiddly*? (You chose A as the lead — pressure-test whether it still feels safe enough.)
3. **Honest cancel** — after you confirm, the row does NOT vanish. It shows
   **Cancelling…** then **Cancelled · recorded**. Kill the **stuck** Kimi run: it reads
   *"recovering a stuck run" → "Cancelled · recovered a stuck run"* — the zombie-heal truth,
   surfaced, not hidden.
4. **Cross-provider parity (SC#10)** — every provider uses its real `@lobehub` mark and the
   same row grammar. Do the non-big-4 (DeepSeek, MiniMax, Moonshot) read as first-class, or
   like afterthoughts?
5. **Scale + empty** — flip the **preview scale** cycler (6 runs · 1 run · none). Does the
   surface hold at one run, and is the **"No runs in flight"** empty state calm and honest
   (not broken)?
6. **The recording beat** — every kill flashes "every action recorded" in the band (062-A);
   the killed row's ✎ *is* its receipt. Does that feel like enough proof for an action with
   a victim, or does it want the full ledger row too?

## Grounding (real, not invented)

- The list reads the `runs:active` sorted set (run_id → started score → elapsed); models &
  providers span the real native roster. Provider marks are the real `@lobehub/icons` set
  (same source locked in sketch 048).
- **Kill** delegates to the existing **`cancel_run`** (`runs.py:1097`) — including its
  **zombie-heal** branch (D-062-11): a run whose worker task is already gone is UPDATE'd to
  `cancelled` with a synthetic `zombie_healed` sentinel. That's why the stuck run reads
  *"recovered"*, not *"killed"* — the sketch tells that truth.
- `Cancelling…` reflects the async reality (cancel is not instantaneous); the two-state is
  the run-honesty the project already cares about.
- Every kill writes to `operator_audit_log` (net-new 146); the receipt vocabulary is the
  locked **062-A** (✎ write mark + "every action recorded" band flash).
- Lives inside the **Control Plane** tab of the locked 061-B shell; final composition (one
  scroll vs pinned-header vs sub-tabbed) comes from **sketch 063**.
