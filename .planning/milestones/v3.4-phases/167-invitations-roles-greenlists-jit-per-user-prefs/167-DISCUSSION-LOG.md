# Phase 167 Discussion Log

**Date:** 2026-07-21
**Phase:** 167 — Invitations + Roles + Greenlists + JIT + Per-User Prefs

## Areas discussed (4 gray areas, all operator-decided)

### 1. Invited-user behavior (someone who already has their own org)
- **Options:** Join additively — keep both (Recommended) · Replace — join yours only
- **Chosen:** **Join additively — keep both** → D-167-01. Non-destructive; the 166 switcher handles the 2-org case.

### 2. Invitation delivery
- **Options:** Link-first + log/copy (Recommended) · Send real email now (Resend/SES)
- **Chosen:** **Link-first + log/copy** → D-167-02. No email service required by default; env-switch to Resend/SES; `none`-log default.

### 3. Invite role assignment
- **Options:** Member default + optional Org-admin (Recommended) · Member-only for now
- **Chosen:** **Member default + optional Org-admin** → D-167-03. Dept-admin greyed until Phase 169.

### 4. VIS-02 first preference instance
- **Options:** Default model within allowed set (Recommended) · Small bundle (model+theme+more)
- **Chosen:** **Default model within the allowed set** → D-167-04. Revives `user_settings.preferences`; SEED-116 two-layer proof.

## Grounding established (pre-discussion)
- `org_invitations` table COMPLETE (mig 104: email/role/status/token_hash/expires_at/invited_by) → INV-01 no migration.
- `feature_visibility` JSONB map (mig 098) extends to role greenlists with zero migration → VIS-01 no migration.
- `user_settings.preferences` exists (mig 011) → VIS-02 no migration.
- Reported-bugs cross-check: clean (no open Agentic-RAG bug overlaps this domain).

## Landmines carried forward
- D-167-05 JIT seam (trigger vs app-layer vs both) = the ONE possible migration — a research decision.
- D-167-06 VIS-01 zero-migration (extend the JSONB audience shape + `require_visible`, no new table).
- D-167-07 invitations home = the 166 org shell's Invitations & Roles tab (goes live) + Members roster adoption chips.
- D-167-08 security: `org:invite` gate, `token_hash` never leaves table, expiry + single-use, reuse 166 `get_active_org_id`.

## Deferred
SSO (168), departments/dept-admin (169), full group-management UI, entitlements (170), broader prefs bundle (SEED-117), branded email templates.

## G-2 sketch
Light — invite surfaces extend 166's shipped design system; optional `/gsd:sketch 167` for the net-new invite-flow + adoption chips if the operator wants a mockup bar.
