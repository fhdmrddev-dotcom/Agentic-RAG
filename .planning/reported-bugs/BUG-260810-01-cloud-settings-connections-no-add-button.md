---
id: BUG-260810-01
title: Settings → Connections shows no "Add connection" button on cloud (local is fine)
reported: 2026-08-10
surface: Agentic-RAG
severity: medium
status: folded
affected_areas: [settings/connections, deployment/cloud-parity, admin/feature-visibility]
folded_into: "212"
verified_closed_by: null
related_seeds: [SEED-144, SEED-145, SEED-146]
re_open_trigger: "⚠ FOLDED INTO 212 AND SHIPPED, BUT THE CLOUD HALF WAS NEVER VERIFIED — that is why
  status stays `folded` and `verified_closed_by` stays null. Phase 212 shipped the catalog, the
  Popular row and the Add affordance, and the reviewer DROVE all of it on 2026-08-27 — but only on
  LOCAL, on an install whose `live_connectors` is flipped to `everyone` while the shipped cold
  default is `off` (user_settings.py:1214). This report reproduces on `production` at `5d5ea200`,
  and nothing in Phase 212 was driven there. The write affordance sits behind TWO conjuncts —
  `isOrgAdmin && liveConnectorsOn` (ConnectionsTab.tsx) — and only the second was exercised.
  FLIP TO `closed` ONLY AFTER: a cloud install shows the Add affordance and a Popular service
  connects there. Until then this is shipped-but-unverified on the exact surface it was filed
  against. Re-open immediately if a cloud user still sees no Add button after 212 deploys."
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

## ANSWERED 2026-08-10 — and the answer moved the defect

**The operator confirmed the ⛨ banner IS visible on cloud.** By the table below that means the
missing Add button is *not* the bug: the tab is honestly reporting that live sending is off.

**But the operator then could not find the switch — because it does not exist.** Measured:

- The Control Room's **Feature visibility** panel (Users & Access tab, `FeatureVisibility.tsx`)
  renders exactly **five** rows: `skill_studio`, `model_management`, `workflow_authoring`,
  `governance_health`, `visual_workflow_canvas`. `grep -rn "live_connectors"
  frontend/src/components/admin/` returns **nothing**.
- `frontend/src/lib/api.ts`'s `GovernedFeature` union names the same five and not
  `live_connectors` — so `features.live_connectors` is a type error client-side.
- The BACKEND accepts the write: `live_connectors` is in `_VISIBILITY_FEATURES`
  (`api/admin.py:113`), so `PUT /admin/visibility` would flip it. `GET /features` already
  returns the key. **Server-reachable, UI-unreachable.**

**So the real defect is a dead-end instruction:** the banner's closing line —
*"An operator turns `live_connectors` on in the Control Room"* — names a technical string
specifically so the operator can FIND it (the LANG-01 carve-out), and there is nothing there to
find. This is the THIRD instance of one pattern in two days: BUG-260809-02
(`business_requirement` demanded with no control), CONN-02 (capability not drivable), and now
this. Each was found by driving the product, not by any gate.

**It is a KNOWN, OWNED deferral: `D-190-DEF-09`** (`.planning/phases/190-live-connector-slice-connector-security-stretch/deferred-items.md:350`),
found during plan 190-16 while wiring this very banner. Both halves must land in ONE commit —
widening the union without the card edits five exhaustive maps for no visible reason; adding the
card without the union does not typecheck. Measured cost of the union widen alone:
`tsc -p tsconfig.app.json` **33 → 38**, all five being `Record<GovernedFeature, …>` maps missing a
key, each a one-line fix. Two are `/admin` source, which Phase 190's **D-25** fenced off.

**Amended routing:** this report now tracks the dead-end instruction, not the missing button. Fold
`D-190-DEF-09` into the connections milestone — the card must ship in the same milestone that makes
the switch safe to use, so the operator's first encounter with the control is one they can act on.

## The one question that decided what this is

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
