---
sketch: 068
name: users-and-access
question: "How does the operator manage user access — the roster with last-active, an immediate-but-reversible disable/enable with the right weight, and the (scope-flagged) grant/revoke-operator action?"
winner: "A"
tags: [phase-148, admin-03, users, disable-enable, last-active, operator-grant, confirm-sheet, victim-naming, honesty]
---

# Sketch 068: Users & Access — roster · disable/enable · operator grant

## Design Question

ADMIN-03's second slice (ROADMAP SC#2): list users with last-active; disable/enable a user;
a disabled user cannot access the app. Disabling a person is a **target-specific action with
a victim** — per the 066 graded-guard rule it takes the 064-B **victim-naming confirm sheet**
(never a bare toggle), while Enable is restorative and flips direct.

**Intake decision (operator, 2026-07-11):** the grant/revoke-operator action IS sketched,
visibly **flagged "possible scope — ratify at discuss"** — mig 095 anticipated it
(`operator_users.granted_by` is documented as "set when Phase 148 adds grant-by-operator").
Feature visibility (VIS-01) also lives on this tab, below the roster — sketched separately
in 069; a dimmed composition stub here shows where it lands.

## How to View

open .planning/sketches/068-users-and-access/index.html

## Variants

- **A: Instrument table** — the whole roster in one dense scan: identity (+ joined / docs /
  chats), last-active, status, role, per-row actions. Fastest "find the user, act."
- **B: Expandable rows** — the 055-B grammar: calm roster rows expand IN PLACE to facts,
  recent activity (deep-links to the 067 audit browser), the "what does a disabled user
  see" answer, and the actions. Investigation-first.
- **C: Roster + detail panel** — the app's push/split shape (027-A heritage): compact
  roster left, persistent user card right with stacked actions. Familiar app pattern, but
  a second layout inside one Control Room.

## What to Look For

1. **The Disable weight** — open the confirm sheet: it names the victim
   ("maria@acme.co loses access immediately — sign-in refused, API refused, in-flight run
   cancelled"), states what is KEPT (their data, untouched), states reversibility, and says
   it's recorded with your name. Is that the right weight — heavier than a capability
   switch, lighter than type-to-confirm?
2. **Enable is direct** — restorative actions don't need a guard. Does the asymmetry read
   as intentional?
3. **Self-protection** — your own row: Disable and Remove-operator are disabled with a
   tooltip ("You cannot disable yourself"). The lockout-proof guard.
4. **The operator grant (flagged)** — amber sheet, honest blast radius ("they can see every
   user's activity, kill anyone's runs…"). Should this ship in 148 or defer with a named
   trigger?
5. **Last-active honesty** — recent = green, stale = dim, `never signed in` italic — from
   sign-in records, never fabricated.
6. **Receipts** — every write flips the row to a `✎ … · recorded` receipt and flashes the
   band marker (062-A vocabulary), then the ledger holds the history.

## Grounding (real, not invented)

- **The roster read is net-new 148 API surface** — users live in Supabase `auth.users`
  (service-role `auth.admin.list_users()` is already used by backend integration tests);
  last-active = `last_sign_in_at`. Read paths explicitly filtered (ROADMAP SC#4 — no RLS
  backstop on the service-role client).
- **Disable/enable rides the auth ban mechanism** (GoTrue `banned_until`) + an app-layer
  check so API calls are refused too — "cannot access the app" is enforced, not UI-hidden.
- **Operator grant/revoke writes `operator_users`** (mig 095) with `granted_by` = the
  acting operator — the env-bootstrap provenance row (NULL) stays distinguishable.
- **Receipt vocabulary inherited from 062-A** (`user.disable` / `user.enable` ✎ writes,
  plain-sentence labels); the confirm-sheet shape inherited from 064-B (Kill's
  victim-naming rule).
- The band shell + five tabs = the LOCKED 061-B / 147-recomposed IA, with Users & Access
  now live.
