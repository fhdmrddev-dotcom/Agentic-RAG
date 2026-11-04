---
sketch: 308
name: webhooks
question: "Where does an endpoint's delivery log live, how does each endpoint state read, and what does an org admin see?"
winner: "A — rows expand in place, each with its own actions and delivery log (self-picked under the operator's autonomous mandate, 2026-11-04; operator approval owed at G-4)"
tags: [phase-308, hook-01, hook-02, hook-04, hook-05, hook-06, webhooks, delivery-log, org-admin, graded-guard, g2-sketch-gate]
phase: 308
requirements: [HOOK-01, HOOK-02, HOOK-04, HOOK-05, HOOK-06]
extends: [304 ApiKeysTab secret-once, 307 OrgConnectedApps admin section, 064/068 victim-naming sheet, 062-A ledger receipt]
---

# Sketch 308: Webhooks

## Design Question
A member adds endpoints, tests them, rolls secrets and reads deliveries; an org admin sees every endpoint
in the org and turns off or deletes one. Where does the delivery log live, and how does each state read?

## How to View
Serve `.planning/sketches` and open `308-webhooks/index.html`.

## Variants
- **A: Rows expand in place** — endpoint row (URL, events, last delivery, status chip); click opens actions + that endpoint's log. Same shape as an API key card.
- **B: List + detail split** — endpoints left, selected endpoint right.
- **C: One log under all endpoints** — compact rows, a shared log with an endpoint filter.

## Views
Member with three endpoints (on · off after 5 failures · turned off by an org admin) · add form with the
refused-address sentence · just created (secret shown once + Python/Node verify snippet + Send test) ·
none yet · org admin (table of every endpoint; Turn off with ledger receipt; Delete behind a
victim-naming sheet).

## Fixed in every variant
- Status words: **On** · **Off — kept failing** · **Off — the receiver said it is gone** · **Off — turned off by an org admin**.
- Refusal sentence: *"That address can't be reached from the internet, so Syrel won't send to it."*
- Log columns: event · about (link) · status · tries · HTTP code · latency · when · Resend. Footnote: the reply is never stored.
- Roll sheet names the 24-hour overlap and that a second roll ends it early. Delete sheet names what goes (pending deliveries, the log) and what stays.
- Admin hides query strings ("may hold a receiver's password"); an admin-off endpoint's **Turn on** is disabled for the owner with the reason.
- Send test answers in one sentence: code + latency + "It is in the log below."

## Winner
**A.** B needs width the 880 px Settings column doesn't have; C separates a log from the endpoint it is
about and makes a failing endpoint's evidence one filter away. A matches the API key card the member
already knows.
