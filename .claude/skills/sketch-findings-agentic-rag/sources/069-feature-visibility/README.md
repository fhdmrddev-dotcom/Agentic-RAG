---
sketch: 069
name: feature-visibility
question: "How does the per-feature visibility map read — hide advanced surfaces (Skill Studio, model management, workflow authoring) from end users, API-enforced not UI-only — and where does it live?"
winner: "A"
tags: [phase-148, vis-01, feature-visibility, audience, api-enforced, users-and-access, preview, honesty]
---

# Sketch 069: Feature Visibility — who sees the advanced surfaces

## Design Question

VIS-01 (ROADMAP SC#3): advanced/technical features are hidden from end users and visible
only to operators — **enforced at the API layer** (a non-operator API call is refused, not
merely UI-hidden), per a **per-feature visibility map**.

**Intake decision (operator, 2026-07-11): the map lives on the Users & Access tab** —
visibility governs *who can see what*, so it belongs with access governance; spatial
separation from the Control Plane's kill-switches carries the "hidden from end users" ≠
"off for everyone" distinction (the 065-A location-carries-meaning precedent). Variant C
renders the rejected-lean placement as a foil to confirm the choice.

## How to View

open .planning/sketches/069-feature-visibility/index.html

## Variants

- **A: Audience rows** — one card per feature with a two-position audience control
  (*Everyone* | *⛨ Operators only*). Flipping to operators-only reveals the concrete
  consequence line ("end users no longer see X — and their API calls are refused
  server-side") + an expandable "what exactly this controls" (UI surface · refused API ·
  who decides; API paths behind ⌥ Technical names).
- **B: Map + live end-user preview** — the same rows plus a sticky mini-app preview
  flippable between "as end user / as operator": hide Skill Studio and watch the button
  leave the Skills page, the nav entry vanish, and the API probe flip 200 → 404. The
  strongest proof the enforcement is real; more chrome.
- **C: In-Controls placement (foil)** — the map inside the Control Plane's Controls
  section next to the 147 kill-switches. The felt problem: "OFF for everyone" and
  "Operators only" become neighbors distinguished only by styling.

## What to Look For

1. **The audience control** — does *Everyone | ⛨ Operators only* read instantly as "who
   can see this," and is it clearly NOT a kill-switch? (Green/amber audience states vs the
   147 grid's on/off red.)
2. **API-enforcement honesty** — the consequence line and B's 404 probe: does the surface
   make "refused server-side, not just hidden" legible without jargon? The ⌥ toggle reveals
   the real route prefixes.
3. **The feature set** — Skill Studio (evals + tuner + versions as ONE surface — the tuner
   is a Studio tab per 057-A, so one flag covers the requirement's "eval studio" AND
   "trigger tuner"), model management, workflow authoring/publishing, governance health.
   Is this the right day-one map? What's missing / what shouldn't be hideable?
4. **Direct flip, no confirm** — visibility is reversible-per-feature with no victim
   (nothing is destroyed; users lose a door, not data) → per the 066 graded-guard rule it
   flips direct with a ✎ receipt. Agree, or should hiding warrant an arm-to-confirm?
5. **B's preview cost** — is the live preview worth its chrome, or is A's consequence line
   enough? (The preview could also ship later as a "view as user" affordance.)

## Grounding (real, not invented)

- **Feature surfaces are real**: Skill Studio (053/057 — `SkillStudioPage`, ActiveView
  full-surface), model management (Settings AI-model + embedding sections, 024-A/060-A),
  workflow Builder/publish (018/020), Governance health page (038-A). Nav model in B
  mirrors the real `NAV_ITEMS` (chat / workflows / documents / classification /
  library-health / governance / skills / settings).
- **Storage = the same `app_settings` TTL-cached substrate as the 147 kill-switches**
  (FLAG-01 shipped it; no new flag infra) — a per-feature visibility record read by both
  the frontend (to hide) and the routers (to refuse).
- **Enforcement = a require-visible dependency on each feature router** — same
  default-deny posture as `require_operator` (146): non-operator → refused; the sketch
  shows 404 (consistent with the 146 non-discoverable red line — confirm 403 vs 404 at
  discuss).
- **Every change is recorded**: ✎ `visibility.set` in the operator ledger (062-A
  vocabulary), visible in the 067 browser.
- Workflow authoring/publishing visibility is additive scope beyond the requirement's
  named three — flagged for discuss-phase (Run stays for everyone; only authoring hides).
