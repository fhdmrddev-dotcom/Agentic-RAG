# Phase 300: Told When a Run Waits (Backend and Mailer) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-29
**Phase:** 300-told-when-a-run-waits-backend-and-mailer
**Mode:** interactive for area selection, bug routing and area 1; then `--auto` after the operator wrote
*"continue autonomously end to end for this phase"* mid-discussion.
**Areas discussed:** the email itself, who sets the delay, when a send fails, blank-input refusal

---

## Area selection (operator)
Selected all four: The email itself · Who sets the delay · When a send fails · Blank-input refusal.

## Bug routing (operator)
Options: Fold BUG-261027-04 + -05 (recommended) · Fold BUG-261027-03 · Fold BUG-260828-05 + -06.
Selected: all three → five reports folded into 300.

## The email itself (operator)
| Question | Options | Selected |
|---|---|---|
| A run asks twice — how many emails? | One per wait (rec.) · One per run, ever | One per wait |
| Subject line? | `<Workflow> is waiting on you` (rec.) · `Action needed: <Workflow>` · `Syrel: a run needs you` | `<Workflow> is waiting on you` |
| Sender? | Syrel, no-reply (rec.) · Syrel, reply-to the org admin | Syrel, no-reply |
| Extras beyond NOTE-03? (multi) | Say question vs approval · 'Turn these off' footer · Neither | Question vs approval + footer |

## Who sets the delay (auto)
[auto] Delay — Q: "App-wide operator knob or per-user?" → Selected: one app-wide `app_settings` knob, default 120 s, 60-3600 s (recommended)
[auto] Delay — Q: "Where do non-secret mail knobs live?" → Selected: Settings; env keeps provider switch + secrets; INVITE_FROM_EMAIL kept as fallback (recommended)
[auto] Delay — Q: "Opt-out scope and default?" → Selected: per-user `user_settings`, default on, read at send time (recommended)
[auto] Delay — Q: "How is dev mail kept out of real inboxes?" → Selected: non-production rewrites to a Settings redirect address; none set → suppressed + logged (recommended)

## When a send fails (auto)
[auto] Failures — Q: "Where does an invite email failure show?" → Selected: inline in the invite dialog with Copy link; row marked "Email not sent"; invite still created (recommended)
[auto] Failures — Q: "Where does a run-waiting email failure show?" → Selected: stored outcome on the outbox row + one Control Room dependency-health "Email" line; 3 bounded retries (recommended)
[auto] Failures — Q: "Re-check before send?" → Selected: re-check still-waiting and opt-out immediately before each send (recommended)

## Blank-input refusal (auto)
[auto] Refusal — Q: "Refuse at save, at fire time, or both?" → Selected: both, same `missing_required` predicate (recommended)
[auto] Refusal — Q: "How does the schedule row show it?" → Selected: one vocabulary sentence per outcome naming the input; no raw status word (recommended)
[auto] Refusal — Q: "Run now busy state?" → Selected: only its own row busy; no whole-list Loading (recommended)

## Claude's Discretion
Email body sentences, Settings labels, dependency-health line wording, retry backoff shape, drainer poll
interval, plan split within G-8.

## Deferred Ideas
In-app list/badge (301), per-user delay, owner-facing failure UI (301), reply-to org admin, 299's postponed rows.
