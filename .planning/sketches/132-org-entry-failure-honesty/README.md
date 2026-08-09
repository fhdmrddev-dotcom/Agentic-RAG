---
sketch: 132
name: org-entry-failure-honesty
question: "Identifier-first sign-in (fail-open to password) + the /invite landing's six outcome states — does 'coming into an org' feel calm, and does every failure read honestly and consistently?"
winner: "B"
tags: [phase-177, orgux-02, sign-in, identifier-first, sso-fail-open, accept-invite, invite-landing, failure-honesty, family-cohesion, g2-sketch-gate]
---

# Sketch 132: Org Entry & Failure Honesty (ORGUX-02, pre-auth)

## Winner — B (Unified card + one honest-notice) ★ (2026-07-23, delegated pick)

Sign-in and the `/invite` landing share ONE branded card shell, and **every** outcome routes
through one notice vocabulary keyed by severity: **calm-muted** for recoverable ("ask for a
fresh link" — expired / revoked / missing token), **indigo** for in-progress, **green** for
success, and **weight only** for a genuine system error. This is the cohesion + failure-honesty
synthesis in one direction — the key insight being that most invite "errors" are *recoverable
dead-ends the user can fix*, so they must read calm, never alarming red. **C's fail-open depth
folds into B** as the sign-in behavior (SSO domain → branded redirect; no SSO → password reveal;
route outage → fail-open to password with a reassuring note — never a lockout, T-168-07/SC#3).
A is the faithful baseline that exposed the per-failure inconsistency B resolves.

## Design Question

Two pre-auth surfaces shipped in Phases 167/168 **without a sketch**: the **identifier-first
sign-in** (`SignInForm` — email → Continue → SSO redirect *or* password reveal, always
**fail-open**) and the **`/invite` accept-invite landing** (`AcceptInvitePage` — six distinct
outcome states). Phase 177 polishes them to *calm + error-honest*.

The core tension is **failure honesty**: an invite can be expired, revoked, invalid, or
token-missing; SSO routing can succeed, find no SSO, or hit an outage that must **degrade to
password login — never a lockout** (T-168-07 / SC#3). Today each failure has its own ad-hoc
copy + a generic alert glyph. The polish question: can all outcomes share **one honest-notice
vocabulary** so "coming into an org" feels built-together, with loudness earned by severity?

## How to View

open .planning/sketches/132-org-entry-failure-honesty/index.html

Use the strip to flip **Surface** (Sign in ⇄ Accept invite). For sign-in, cycle the **scenario**
(Email step → SSO domain → No SSO → Route outage). For invite, cycle the six **states**
(Auth · Accepting · Joined · Already member · Missing token · Expired/revoked).

## Variants

- **A: As-shipped faithful** — both surfaces as built. Each failure keeps its own treatment
  (a generic alert glyph + plain grey copy). Baseline — surfaces the inconsistency to fix.
- **B: Unified card + one honest-notice** — sign-in and `/invite` share ONE card shell, and
  **every** outcome routes through one notice vocabulary keyed by severity: **calm-muted** for
  recoverable ("ask for a fresh link"), **indigo** for in-progress, **green** for success,
  and **weight only** for a genuine system error. The cohesion + honesty synthesis.
  *(Recommended.)*
- **C: Sign-in depth (fail-open)** — B's language, zoomed on the three identifier-first
  outcomes: **SSO domain** → branded "Continue with Acme SSO" redirect; **no SSO** → password
  reveal; **route outage** → **fail-open** to password with a quiet, reassuring note ("nothing's
  wrong with your account").

## What to Look For

- **Recoverable ≠ error:** in B/C, expired / revoked / missing-token read as *calm* ("ask for a
  fresh link"), not alarming red. Is that the right honesty — a dead-end that's the user's to
  fix, presented without panic?
- **Fail-open is never a lockout:** flip sign-in → Route outage. The password field must appear
  with a note that reassures, not a blank/locked form. Does C make that safety legible?
- **One card, two routes:** do sign-in and `/invite` feel like the same product surface (B/C),
  or two separate pages (A)?
- **Success calm:** Joined / Already-member — is green-with-a-line the right amount of celebration
  for an auth hop, or too much?
- **SSO detected:** the "SSO found for acme.com → Continue with Acme SSO" branded step — clear, or
  does it need the password escape hatch more prominent?
