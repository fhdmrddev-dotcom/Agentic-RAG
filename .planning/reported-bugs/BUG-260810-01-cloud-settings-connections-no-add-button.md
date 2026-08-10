---
id: BUG-260810-01
title: Settings → Connections shows no "Add connection" button on cloud (local is fine)
reported: 2026-08-10
surface: Agentic-RAG
severity: needs-triage
status: open
affected_areas: [settings/connections, deployment/cloud-parity, admin/feature-visibility]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-144, SEED-145, SEED-146]
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 5d5ea200
  date: 2026-08-10
---

# BUG-260810-01: no "Add connection" button in the cloud Settings → Connections tab

## What we observed

Operator report, 2026-08-10: in **Settings → Connections**, there is no **Add connection**
button. **Cloud only** — the same tab on local dev renders it.

## The mechanism (measured locally, INFERRED for cloud)

This is very likely **`feature_visibility` drift, and the code behaving exactly as designed** —
not a rendering defect.

- `ConnectionsTab` reads `live_connectors` out of `getEffectiveFeatures()` and **fails CLOSED**:
  an absent key reads as OFF. Its own docblock states the intent — *"claiming sending is off when
  we cannot tell is the non-over-claiming error"* (`ConnectionsTab.tsx:792-794`).
- With the flag off, **every write affordance is REMOVED rather than disabled** — the Add button
  and the per-row `⋯` menu both go, by design under D-26 (`ConnectionsTab.tsx:54`). There is a
  shipped test for precisely this: *"an org ADMIN gets no Add and no ⋯ while live_connectors is
  off"* (`__tests__/ConnectionsTab.test.tsx:356`).
- The READS are deliberately **not** gated, so the tab still renders a real connections table
  under the banner instead of 403-ing into a dead page (plan 190-09 decision 2). That is why the
  tab looks normal apart from the missing button.
- **Measured on local:** `app_settings.feature_visibility` contains
  `"live_connectors": {"audience": "everyone", "roles": [], "groups": []}` — hence the button.
  Cloud's row was **not** inspected for this report; the claim that its key is absent or
  non-visible is an inference from the observed symptom, not a measurement. Confirm before acting.

## The one question that decides what this is

When the flag is off, a banner is supposed to render: **⛨ "Live sending is off for this
platform"** (`connectionsCopy.ts:387-394`, D-26 / UI-SPEC §2h).

- **If that banner IS visible on cloud** → not a bug. The product is correctly telling you sending
  is off, and this is a config question, not a defect. Close as `external-noted`/config.
- **If the banner is NOT visible** → this IS a bug, and a worse one than the missing button: the
  affordance vanishes with no explanation, which is the silent-absence failure the banner exists to
  prevent. Route it as a real defect against `ConnectionsTab`.

## ⚠ Do NOT reflexively turn `live_connectors` on in production

The obvious "fix" — flip it in `/admin` → feature visibility — is probably the **wrong** move
right now, and cloud being OFF may well be the correct state rather than the drifted one:

- **CONN-02 is the one UNSATISFIED requirement at v3.6 close.** Only 1 of 3 connector capabilities
  is drivable from a workflow, and **Slack works by coincidence** (`D-190-DEF-17`).
- **Every connector capability is a WRITE.** There is no read/search/list capability at all, so
  turning the surface on exposes only outbound side effects.
- The recorded standing rule is that the **approval model comes first**. The connections milestone
  (SEED-144 / 145 / 146) is the next milestone and is where this belongs.

So the honest reading is that **local is the drifted environment**, not cloud.

## Surface classification

**`Agentic-RAG`** — this app. Routing candidate for the connections milestone.

## Routing note

Same family as BUG-260809-02 and CONN-02: a surface that is present but cannot reach the thing the
backend requires. Here the removal is *deliberate*, so the defect — if any — is only in whether the
product says so. Answer the banner question first; everything else follows from it.
