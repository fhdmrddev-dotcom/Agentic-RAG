# Project Research Summary

**Project:** Syrel (Agentic RAG), milestone v4.8 "Every Page Has a Link". Phases continue at 297, migrations at 217.
**Researched:** 2026-10-27. **Confidence:** MEDIUM-HIGH.
**Inputs:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` (this directory). Synthesized by the research synthesizer; written by the orchestrator because the synthesizer's Write was refused.

## Executive Summary

The app has no router: the view is one `useState<ActiveView>` in `App.tsx`. v4.8 gives every view and entity (thread, run, workflow, Expert) an address, tells a person when a run is waiting on them, and makes the Library and Workflows lists follow the active org.

All four files agree on the core design:
- **Canonical URLs are `/app/...`.** It is the only prefix that already works on Vite dev, Vercel, `*.vercel.app` and one-box nginx with no host-config change.
- **Routing is a pure parse/format leaf** (`appRoutes.ts`); entity pages load by id from the URL.
- **Waiting runs are detected by Postgres triggers** on the existing `ask_user_prompt` / `ask_user_response` `messages` rows. That gives one notice per waiting run and needs no edits to G-5 engine files.
- **Email goes through an outbox**, drained in every worker with `FOR UPDATE SKIP LOCKED`, at most one email per notice, after a grace window.
- **The badge is the second tenant of `ATTENTION_PRODUCERS`.** The `length === 1` pin is re-baselined in the same commit.
- **Dependencies:** one new frontend package, no new Python packages.

Top risks:
1. Hot files guarded by about 19 source-reading or "no router" fences. Extract first, then re-target the fences; never delete them.
2. Links that work in dev but break on one-box or previews.
3. Links to another org's items (see Critical pitfalls, item 4).
4. Silent or duplicate email.
5. Org-scoping inside `fetch_visible_folders`. It has about 20 callers and would break unattended runs.

## Where the files disagree — recommended answer

### Router: react-router@8 vs hand-rolled
**Recommendation: react-router@8.5 in data mode, used for routing only.** Wrap it in a project-owned pure `appRoutes.ts` and a `useAppNavigation` hook.
- **Why not hand-rolled:** `useBlocker` (needed for dirty editors), anchors, history and scroll are bug farms to hand-roll. `docs/router.ts` is a read-only docs router.
- **Costs:**
  - React 19.2.4 → 19.2.9.
  - CI Node 20 → 22.
  - Imports come from `react-router` and `react-router/dom`; `react-router-dom` no longer exists.
  - About +18 KB gzipped, in the app chunk only.
- Confirm at discuss-phase 297.

### `resend` package vs Resend REST via httpx
**Recommendation: REST via the existing `httpx`.**
- It removes the root cause: today's code lazy-imports a package that is in no image.
- It goes out on port 443, and `Idempotency-Key` is just a header.
- Add stdlib `smtplib` as `EMAIL_PROVIDER=smtp` for the one-box, run off the event loop.
- Add a clean-image import test.

### DB trigger vs outbox sweep — they combine
- **Triggers write the notices.** They cover all four pause writers and every resolution path, with no engine edits.
- **The outbox sends the email,** drained by every worker.

Rules:
- The trigger body swallows its own errors, because the engine's prompt insert is fail-closed.
- `org_id` comes from `workflow_runs`, never from `messages`, whose autofill uses `LIMIT 1`.
- "Still waiting" is re-checked before each send.
- The delivery outcome is stored.
- A DB-backed test is required.

### Email wording
**Recommendation: content-free.** The email carries the escaped workflow name, the org name, how long it has been waiting and the link. The worded reason appears only in-app, behind sign-in.

### Cross-org link
**Recommendation: ask first — "This is in Org B. Switch?"**
- Never switch automatically: a switch aborts every live stream and rewrites other tabs' stored org.
- Non-members get the same 404 as a missing item.

### Route shapes
- `/app/chat/:threadId`
- `/app/runs/:runId`
- `/app/workflows/:id`
- `/app/experts/:id`
- `/app/settings/:tab`, and so on

The parser also accepts bare paths on `app.*`. Rules:
- No dots in path segments.
- Org is never in the path.
- Legacy shapes keep working for good: `?run=`, `?connections=1&...`, `/admin/spend`, `/setup`, `/invite`.

### Email timing
A grace window applies to every run: 120 s by default, an `app_settings` knob. The email is skipped if the ask was already answered.

### Stale seed premises
SEED-281 needs correcting:
- **"No app-owned mailer"** is stale. The seam exists; it has just never been able to send.
- **N-2, "unanswered fails the run"**, is partly stale. Since Phase 200, a timed-out human step pauses durably. Re-measure expiry for each pause type, and never state an expiry time in the email.

## Key Findings

### Stack
- react-router 8.5 (data mode, router only)
- Resend REST via httpx
- stdlib smtplib for the one-box
- Jinja2 autoescape (already installed)
- Postgres + RLS + Realtime as a hint + TanStack Query
- No Novu or Knock: the VPS has 1 vCPU / 4 GB, and Novu needs 4 vCPU / 8 GB.
- No Vercel or nginx changes. Add a parity test across `devRouting.ts`, `vercel.json` and `nginx.conf`.

### Features
**Must have:**
- A path for each of the 12 `ActiveView` members, plus links for threads, runs, workflows and Experts.
- Refresh and Back/Forward land in the same place.
- One identical "can't be opened" page for missing and forbidden items.
- Sign-in returns to the link.
- A copy-link affordance, and real anchors.
- A server-side "waiting on you" query, per user, across all orgs.
- A badge and list.
- One email per waiting run, to the run owner.
- A per-user off switch for email.
- Library, Workflows and KB pickers scoped to the active org, with the server rejecting foreign-org folder ids.

**Should have:**
- The run page is the answer page; the email carries no decision.
- A worded in-app reason.
- The email is skipped if already resolved.
- The org-mismatch prompt.
- One reminder.

**Defer:**
- Public share links
- Org slug in the URL
- Approver groups or escalation
- Push or Slack notices
- A notification-history centre
- Auto-approve on timeout
- Notices for cap-pauses and chat Deep `ask_user`
- A "scheduled run failed" email

### Architecture
**New frontend pieces:**
- `appRoutes.ts`
- `useAppNavigation.ts`
- `AppViewSwitch.tsx`: ChatLayout's mount switch, moved verbatim
- `useDeepLinkResolver.ts`

**New backend pieces:**
- Migration 217:
  - `notifications`: one open notice per recipient and run, enforced by a partial unique index.
  - `notification_deliveries`: the email outbox, RLS deny-all.
- Triggers on the `messages` ask rows and on `workflow_runs` status.
- `notification_drainer.py`
- `GET /notifications`
- `app_links.py`

**Org narrowing** applies only to the four list routes below, via the existing `restrict_org_ids`; `fetch_visible_folders` itself is unchanged:
- `/folders`
- `/folders/{id}/children`
- `/workflows/published`
- `/workflows/drafts`

The router never calls `StreamsProvider`; the sole-writer gate on `setViewingThread` stays.

### Critical pitfalls
1. **Dev-only links.** Use `/app/...` everywhere, allow no dots in segments, and add the parity test.
2. **Hot-file fences.** Extract first. Re-target each fence under a decision id. No unexplained per-file decrease in the count gate.
3. **Streams torn down by navigation.** The router sits above the providers, with no keyed remounts and no automatic org switch. Test that `subscriptionsRef.size` is unchanged across 6 navigations.
4. **Cross-org links.**
   - Run reads are owner-scoped, but writes stamp the active org, so a fork or re-run from another org's page lands in the wrong org.
   - Thread fetches are org-scoped.
   - Fix: the server resolves each entity's org, and writes use that org or are refused.
5. **Email.**
   - Store each delivery's outcome.
   - Use a unique key plus `Idempotency-Key`.
   - Keep the body content-free.
   - Links only navigate, because mail scanners open GET links. No token in the URL.
   - A dev redirect-all guard.
   - An anon-role RLS test.
6. **Org-scoping the shared helper.** Unattended runs send no `X-Org-Id` and get a 400 for two-org users. Run the before/after matrix: chat retrieval, scheduled, API-key, publish, and the empty-set case.
7. **Mis-stamped old rows** (mig 105 backfill, mig 106 `LIMIT 1` autofill).
   - Run a read-only audit first.
   - Show an honest "N items in your other org" state.
   - Offer an audited per-item move. Never bulk re-stamp.

## Implications for Roadmap (6 phases)

- **297 Router core, extraction first.** Plan 1 is behaviour-neutral extraction (`AppViewSwitch`, `useAppNavigation`). Then:
  - `appRoutes.ts` and view URLs
  - Back/Forward, with `useBlocker`
  - Legacy aliases kept, and the `?run=` writers retired
  - `/app/runs/:id` fixed as the link contract
  - The route parity test, and a route leg in `activeViewReachability`
- **298 Lists follow the active org.** Runs beside 297; no shared files.
  - Four routes narrowed.
  - Lists refetch when `activeOrgId` changes.
  - The server rejects foreign-org folder ids.
  - Out-of-org bindings render by name.
  - The audit is recorded first.
- **299 Entity deep links and org resolution.**
  - `/app/chat/:id` (SEED-178), Expert URL, and the Skill Studio, Settings and Org tabs
  - Worded loading and not-found states
  - The switch prompt, and SSO return-to-link
  - Additive `org_id` on the run read, and copy link
  - Folds in BUG-261027-02 and SEED-312.
- **300 Notifications backend.**
  - Migration 217, the triggers and RLS, `/notifications`, and the drainer
  - The generalised email provider (REST + smtp)
  - The per-user opt-out and the grace-window knob
  - Deploy-parity artifacts
  - BUG-261027-04 and -05 land first or beside it.
- **301 In-app notice.**
  - The second attention tenant
  - Badge placement beyond the Library
  - Rows that name their org, and mark-read
  - Sketch first (G-2), then lived-experience UAT (G-4).
- **302 v4.7 close-out.** BUG-261027-01 and -03, and SEED-391. Independent of the other phases.

**Research flags:**
- **297:** confirm the router; check Vercel's Node version; inventory the fences.
- **299:** Expert bundle org semantics; an SSO round trip on cloud.
- **300:** terminal-status literals; per-type pause expiry; whether production has ever sent email; VPS SMTP ports; DNS.
- **301:** sketch first.
- **298 and 302** use standard patterns.

## Open questions for the operator

1. Do the thread list and the workflow run log also follow the active org? Recommendation: yes for threads; the run log is undecided.
2. Should the badge count waiting runs across all orgs or only the active one? Recommendation: all orgs, each row naming its org.
3. Is `/app/...` acceptable in the address bar on `app.<domain>`? Recommendation: accept it, and still parse bare paths.
4. What sender address should email use? Recommendation: a `notify.<domain>` subdomain with SPF, DKIM and DMARC `p=none`. The DNS records are an operator step at Hostinger.
5. Should attended runs get email? Recommendation: a grace window for every run.
6. Who receives email? v1: the run owner only, re-checked as a current member at send time. Approver groups become a seed.
7. Should the email include the question text? Recommendation: no, keep it content-free.
8. Cross-org links: prompt or switch automatically? Recommendation: prompt.
9. Mis-stamped items: offer a per-item move, or leave them hidden? Decide after the audit.
10. Chat retrieval and the KB picker still see every org's folders. Accept that, or seed it?
11. Should v4.8 include the reminder and the org-mismatch prompt? Recommendation: the prompt in 299; defer the reminder.
12. Confirm that cap-pauses and chat Deep `ask_user` get no notice in v4.8, and register both in SEED-281.
13. Confirm react-router@8 and the React and Node bumps.
14. The Supabase Auth Redirect URLs must include `https://app.<domain>/**`. This is an operator action and goes on the parity checklist.

## Pre-existing defects found (record, do not fix silently)

1. **Built images cannot send invite email.**
   - `email_provider.py` lazy-imports `resend`, which is in no requirements file or image.
   - `org.py` only logs the failure.
   - `docs/OPERATOR.md` advises a `pip install` inside the container, which is lost when the container is recreated.
   - Whether production has ever sent an invite is unverified.
2. **`*.vercel.app` previews cannot open the app.** The apex redirect regex matches `vercel.app`, so `/app` redirects to a host that does not exist (measured: the DNS lookup fails).

## Confidence

| Area | Level | Notes |
|---|---|---|
| Stack | HIGH (MEDIUM on the router choice) | Versions, bundle size and hosting were measured. VPS SMTP egress was not measured. |
| Features | MEDIUM | Official docs for notifications and mail rules. Other products' URL shapes are third-party sources. |
| Architecture | HIGH for existing code; MEDIUM for designs | Expert bundle org semantics are unverified. |
| Pitfalls | HIGH for project-specific; MEDIUM for external | Taken from vendor docs and community reports. |

**Gaps:**
- Expert bundle org semantics.
- The terminal-status literals, and how each pause type expires.
- Row counts of mis-stamped and null-org items, on local and cloud.
- Whether production has ever sent email, and which SMTP ports the VPS allows.
- How SSO return-to-link interacts with the hash token handling in supabase-js `^2.99.2`.
- Vercel's project Node version.
- The hot-file ledger rows for the files 299 will touch.
