---
status: partial
phase: 167-invitations-roles-greenlists-jit-per-user-prefs
source: [167-VERIFICATION.md, 167-VALIDATION.md, 167-REVIEW.md]
started: 2026-07-22
updated: 2026-07-22
---

## Current Test

[awaiting operator live UAT — needs a running uvicorn + browser + live provider keys + a seeded 2nd-org membership]

## Why this is human-needed

Phase 167 is **code-verified (4/4 SC), SECURED (24/24 threats closed, 0 open), and regression-clean**
(76 backend passed incl. the live JIT-race proof + the 23/23 org-isolation exit-gate; frontend tsc exit 0;
219 vitest). Code-review found 1 blocker + 5 warnings — **all fixed** (the blocker CR-01 = the role-greenlist
resolver leaking org-admin to everyone → now the validated active-org role, fail-closed to member). What
remains is the **live experience** — the SC#10 cross-provider proof, the full invite→accept→join round-trip,
and the two-user greenlist hide==refuse proof — which the G-4 guardrail requires be driven live in a browser.

**Setup:** seed a **second org membership** for a test user (invite `fhdmrd.automation@gmail.com` from
`fhdmrd@gmail.com`'s org, or vice-versa) so the switcher + shared-org roles are exercised.

## Tests

### 1. Invite → accept → join (INV-01/INV-02, E2E)
- **Do:** As an org-admin, open the org shell → Invitations & Roles → invite an email as **Member** (link-first: copy the link). Open the `/invite?token=…` link in a second browser/session; sign in or sign up; land back in the app.
- **Pass:** The invitee **joins the inviting org additively** (keeps their personal org) → the org switcher now shows both orgs; the roster shows them **active**; the invitation shows **accepted**. Re-opening the same link is idempotent (already-a-member, no dup membership). Expired/revoked links show honest messages.
- **Status:** pending

### 2. JIT concurrency (INV-02)
- **Do:** (Covered by the automated live race test `test_167_jit_race.py` — 1 membership under concurrent accept.) Optionally confirm two near-simultaneous accepts of the same invite converge to one membership.
- **Status:** pending (automated proof green)

### 3. Role greenlist hide == refuse (VIS-01, two-user)
- **Do:** As operator, set a feature's visibility to **By role → org-admin** in the Control Room. Log in as a **plain member** of a shared org (NOT org-admin of that org).
- **Pass:** The member does **not** see the feature AND a direct API call is **refused** server-side (hide == refuse). Set it to **member** and confirm the member now sees it. (This is the CR-01 fix — a member of a shared org must resolve to `member`, not org-admin-of-their-personal-org.)
- **Status:** pending

### 4. VIS-02 model default within allowed set + lock (SC#10 cross-provider — LOAD-BEARING)
- **Do:** In Settings → AI Model, pick a personal default model from the allowed set; start chats across **OpenAI / Anthropic / Google / OpenRouter**. Then have the operator **lock** the org model and confirm the picker disables (🔒) and the locked model wins.
- **Pass:** The chosen default routes to the **correct provider** on every provider — **including a DB-override cross-provider model (WR-04 fix — verify the model id routes to the right provider SDK, not the active provider's)**. A model outside the allowed set is rejected server-side. Deep Mode is byte-identical when no personal default is set.
- **Status:** pending (WR-04 is a routing change flagged for live cross-provider verification)

### 5. Adoption-chip correctness (WR-03 fix)
- **Do:** With enough members to paginate, confirm a pending invite for an off-page member does NOT render a false "pending" chip on the visible page.
- **Status:** pending

### 6. Control-Room greenlist state survives reload (WR-05 fix)
- **Do:** Set a feature's audience, reload the Control Room.
- **Pass:** The audience shown reflects **server truth** (via `GET /admin/visibility`), not a stale client default.
- **Status:** pending

---

*When all pass: flip `167-VERIFICATION.md` `status: human_needed` → `passed` and this file → `passed`.*
