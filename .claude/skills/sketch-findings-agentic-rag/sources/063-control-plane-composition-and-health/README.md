---
sketch: 063
name: control-plane-composition-and-health
question: "How does the Control Plane tab compose the live signals — dependency health + capacity + active runs + controls — for the 3-second 'healthy? + what's happening?' read, and does it all fit one tab or need sub-nav?"
winner: "B"
tags: [phase-147, admin-shell, operator, control-plane, system-health, dependency-health, backpressure, composition, layout, ad-02]
---

# Sketch 063: Control Plane Composition & Live Health

## Design Question

Phase 147 (ADMIN-02) makes the **Control Plane** tab live inside the locked 061-B shell.
Four live surfaces now share one tab: **dependency health** (Redis / Supabase / Code
sandbox — up · latency, net-new for 147), **capacity** (the real `/admin/backpressure`
signals), **active runs** (net-new, deep-dived in 064), and **platform controls**
(kill-switches + maintenance, deep-dived in 065) — plus the 062-A **always-on ledger**.

The question is **composition**: how do these stack so an operator lands cold and answers
"is the platform healthy, and what's happening right now?" in three seconds — and does it
all fit one scroll, or does the surface need its own sub-navigation?

Whatever composition wins is the frame that 064's active-runs table and 065's controls
move into.

## How to View

open .planning/sketches/063-control-plane-composition-and-health/index.html

## Variants

- **A: One-scroll instrument** — everything on a single scroll: health → capacity →
  active runs → controls → activity. The path of least resistance; directly extends the
  062-A overview stacking. One surface, scroll to see it all.
- **B: Pinned health header** — a compact "vital signs" strip pins at the top of the
  Control Plane and never scrolls away (dependency dots + agents-working + capacity always
  in your eye — a monitoring posture); details scroll below.
- **C: Sub-tabbed control plane** — the Control Plane gets its own inner nav (Health ·
  Active runs · Controls · Activity), each full-room. Scales best when the runs table and
  the audit browser grow past a preview.

**Winner: B — Pinned health header** (operator, 2026-07-11). The vital signs stay in the
operator's eye even while scrolled into controls — a monitoring posture. Active runs +
controls + activity are sections in the scroll below (Active runs renders as **064-B**;
Controls as **065-A**). The assembled surface is **sketch 066**.

## What to Look For

1. **The 3-second read at rest** — land in each variant cold. Can you instantly answer
   "healthy?" AND "what's running?" Which composition surfaces both fastest?
2. **When something breaks** — click the **preview** cycler (All healthy · One slow · One
   down) in the health header. Watch a dependency card go amber/red. In which composition
   does a degrade *catch your eye* vs get lost — especially in B, where the pinned vitals
   change even while you're scrolled into the controls?
3. **The recording beat** — hit ↻ Refresh, flip a control switch, or Kill a run. Each lands
   a new top row in Activity and flashes "every action recorded" (062-A). Does the ledger
   stay legible in each shape?
4. **Cross-provider runs (SC#10)** — the active-runs preview shows Claude / GPT-5 /
   Gemini side by side with live-ticking elapsed. (Full Kill treatment + provider logos =
   sketch 064.)
5. **Plain-language ⌥** — flip "⌥ Technical names" in the band: "Server capacity" ⟷
   `anyio_threadpool_depth`. This prototypes the LANG-01 / Phase 154 two-audience reveal
   at 147.
6. **Growth fit** — imagine 8 active runs + the full 065 controls + a busy ledger. Which
   composition absorbs the volume without becoming a wall?

## Grounding (real, not invented)

- **Capacity signals** are the REAL `/admin/backpressure` payload (`anyio_threadpool_depth`,
  `redis_active_runs`, `postgres_pool_in_use`, `per_worker_run_count` — Phase 078,
  additive-only D-078-08). Dependency **health** (Redis/Supabase/sandbox reachability +
  latency) is net-new for 147, added on the same additive JSON contract.
- **Active runs** read the `runs:active` sorted set (run_id → started score → elapsed);
  Kill delegates to the existing `cancel_run` zombie-heal path (`runs.py:1097`).
- **Controls** ride the `app_settings` TTL-cached substrate — `web_search_enabled` +
  `sandbox_enabled` already exist (`main.py:103`); self-improve / workflows / maintenance
  are net-new keys on the same substrate (no new flag infrastructure, per SC#4).
- **Ledger** = `operator_audit_log` (who/what/when — net-new 146); write actions carry ✎.
- The shell is the locked **061-B** (operator band + tabs, plain-language-first); the
  receipt vocabulary is the locked **062-A** (always-on ledger). "Control Plane" is the
  061-B tab that was locked at 146 and unlocks here.
