# Phase 228: v3.9 Closeout — The Debt Gets a Number - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-04
**Phase:** 228-v3.9-closeout-the-debt-gets-a-number
**Areas discussed:** Resume vs Continue UX & State Recovery, Production Subdomain Cutover (app.<domain>), v3.9 Owed Verification Drive vs Deferral, Backend Test Baseline Gating Standard & OAuth Hardening

---

## Resume vs Continue UX & State Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Clarify copy to "Retry turn" | Honestly label it as a retry from the top with full thread context, eliminating confusion with mid-loop continuation | ✓ |
| Attempt true mid-loop resume | Try to recover partial execution state and continue the agent loop from the failed step | |
| Offer two buttons | "Retry turn" (always available) and "Resume" (enabled only when a recoverable checkpoint exists) | |

**User's choice:** Clarify copy to "Retry turn" — honestly label it as a retry from the top with full thread context.

---

## Model & Provider Persistence on Retry

| Option | Description | Selected |
|--------|-------------|----------|
| Use model/provider stamped on failed message/run | Guarantees the retry executes with the exact model originally chosen for that turn | ✓ |
| Use composer selection | Allows switching models in the composer before clicking Retry | |
| Check composer first, default to failed message | Hybrid approach | |

**User's choice:** Use the model and provider stamped on the failed message/run.

---

## Continue Affordance Persistence (Iteration Cap)

| Option | Description | Selected |
|--------|-------------|----------|
| Persist cap_paused on run record & reconcile on thread load | Renders the Continue card honestly even after page refresh or navigation | ✓ |
| Infer client-side | Infer from message metadata client-side | |
| Move to composer | Display Continue prompt inside the composer bar | |

**User's choice:** Persist run status as 'cap_paused' (with continue count) in the database and reconcile on thread load.

---

## Transcript Presentation on Retry

| Option | Description | Selected |
|--------|-------------|----------|
| Keep failed turn collapsed/marked, render retry cleanly | Avoids duplicate user prompt bubbles in the transcript | ✓ |
| Append standard new turn | Keep full historical log of failed turns visible with prompts | |
| Replace in-place | Replace failed assistant message in-place | |

**User's choice:** Keep failed turn collapsed/marked as failed attempt and render the retry cleanly without duplicating the user prompt bubble.

---

## Claude AI Parity Confirmation (Resume vs Continue)

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly match Claude AI | "Continue" for cap/interruption (resumes tools & generation seamlessly); "Retry" for errors/failures (re-runs turn cleanly with same model) | ✓ |
| Modify distinction | Custom wording or behavior | |

**User's choice:** Yes, exactly match Claude AI: "Continue" for cap/interruption (resumes tools & generation seamlessly); "Retry" for errors/failures (re-runs turn cleanly with same model).

---

## Production Subdomain Cutover (app.<domain> / SEED-242)

| Option | Description | Selected |
|--------|-------------|----------|
| Author configs now, defer live cloud steps to push | Author vercel.json, CORS, docs, drift checks now; operator performs cloud dashboard steps during next promotion | ✓ |
| Drive live cutover right now | Interactive step-by-step cutover during this phase | |

**User's choice:** Author the configuration changes now, and let the operator perform the cloud dashboard steps during the next production promotion.

---

## Preview Deployment Verification Gating

| Option | Description | Selected |
|--------|-------------|----------|
| Enforce preview deploy verification | Test root landing, 308 /app redirect, app mount, and OAuth return URL on preview before promotion | ✓ |
| Rely on local dev tests only | Leave cloud verification strictly to operator at push time | |

**User's choice:** Enforce preview deploy verification before promoting to production.

---

## Phase 214 Provider Roster & G-4 Drives

| Option | Description | Selected |
|--------|-------------|----------|
| Test available credentials locally, formally re-defer missing | Formal re-deferral with explicit named triggers and required operator steps | ✓ |
| Operator-only checklist | Skip agent execution entirely | |
| Block phase | Wait until all 8 external credentials active | |

**User's choice:** Test providers with available credentials locally; formally re-defer remaining provider rows and G-4 drives with explicit named triggers and required operator steps.

---

## Phase 210/211/217 UAT & Schema Regeneration

| Option | Description | Selected |
|--------|-------------|----------|
| Actively drive reachable rows locally | Regenerate schema, browser/DOM verification for 210/211/217, re-defer only cloud-dependent rows | ✓ |
| Re-defer all UI rows | Focus only on schema regeneration and backend debt | |

**User's choice:** Actively drive reachable rows locally (regenerate schema, browser/DOM verification for 210/211/217), re-deferring only rows requiring external multi-tenant/cloud setup.

---

## Backend Test Baseline Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated gate script/check | Enforce failed <= 71 and alert on any new failing test names | ✓ |
| Reference in CLAUDE.md only | Mechanical reference for manual checks | |
| Quarantine with xfail | Mark existing failing tests as xfail | |

**User's choice:** Create a dedicated backend gate script (or strict count check) that enforces failed <= 71 and alerts on any new failing test names.

---

## OAuth Review Findings (DEBT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Harden OAuth callback against Redis errors | Redirect cleanly instead of 500, log all review resolutions, leave /code-review ultra ready | ✓ |
| Documentation only | Leave code as is, record audit status | |

**User's choice:** Harden the OAuth callback against Redis errors (redirect cleanly instead of 500), log all review resolutions, and leave /code-review ultra ready for the operator.

---

## Claude's Discretion

None — all areas actively decided with operator preferences.

## Deferred Ideas

- SEED-180: Infinite continuation across context-window exhaustion.
- SEED-178: Thread persistence across browser reload via URL routing.
