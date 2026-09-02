---
id: BUG-260902-04
title: A tool approval expires after a hardcoded 120s with NO countdown anywhere — and the timeout message then sends the person to the wrong surface and tells them to re-authorize a healthy connection
reported: 2026-09-02
surface: Agentic-RAG
severity: major
status: open
affected_areas: [backend/tool-dispatcher, frontend/chat, connectors, grants, run-honesty]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-240]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 7651824c0
  date: 2026-09-02
---

# BUG-260902-04: the human-in-the-loop gate has a two-minute fuse and never says so

## What we observed

Driven twice, on the same thread, with the operator actively at the keyboard both times.

| | user prompt | assistant gave up | elapsed |
|---|---|---|---|
| attempt 1 | 14:29:00 | 14:31:06 | **2 m 06 s** |
| attempt 2 | 14:36:24 | 14:38:29 | **2 m 05 s** |

The approval card rendered correctly each time — `Google Workspace · search_files`, *"Nothing has
been sent yet."*, `query: rate sheet`, `limit: 50`, and three buttons: **Reject · Approve once ·
Always allow**. It is a good card.

**Both runs expired before a human clicked**, and on attempt 1 the operator was reading a message
*about that very card* when it lapsed.

## The cause, from source

`backend/app/services/tool_dispatcher.py:4443`:

```python
decision_payload = await asyncio.wait_for(_wait_for_decision(), timeout=120.0)
```

⚠ **Hardcoded. Not a setting, not an env var, not in `user_settings` or `app_settings`.**
And **nothing in the UI shows a countdown, a deadline, or any indication that the card is
perishable.** The card looks exactly as permanent as any other message.

⚠ **120 s is short for the thing it is gating.** The card asks a person to read a service name, a
tool name and its arguments, and make a security decision. Two minutes assumes the person is
already looking at that tab. Any interruption — a phone call, another window, scrolling up to
re-read the prompt — loses the run.

⚠ **It compounds with `SEED-240`'s layout fault.** The card renders **below the fold**, behind
the composer, so on attempt 1 the buttons were not even on screen until the message area was
scrolled. **The clock runs while the control is invisible.**

## ⛔ The second half, which is worse than the timeout

The recovery message the model produces on timeout is **confidently wrong in three ways**:

> *"please check your workspace panel — there should be a pending **approval prompt** … If it's
> not showing, you may need to: **1. Re-authorize/reconnect** the Google Workspace service … 3. If
> prompted, click **Allow**"*

1. ⛔ **Wrong surface.** The card is in the **chat column**. The workspace panel read *"No
   workspace activity yet"* for the entire run. It sends the person to an empty panel.
2. ⛔ **Wrong remedy, and an expensive one.** *"Re-authorize/reconnect"* would send the operator
   through a full OAuth round trip **on a connection that is perfectly healthy**. Nothing about
   the credential failed.
3. **Wrong button name.** The control says **Approve once**, not *Allow*.

⚠ **This is the `invalid_token` failure of Phase 222 all over again** (`222-CRYPTO-SUMMARY.md`
§3.5): *a confidently wrong diagnosis costs more than an absent one*. There the wrong word sent
somebody to re-mint a credential that was fine; here it sends them to re-authorize a connection
that is fine.

⚠ **And it is a MODEL-authored sentence, not product copy** — which is why no test caught it. The
timeout result the dispatcher returns is
`"Tool execution 'search_files' on Google Workspace timed out waiting for approval."` — accurate,
neutral, and says nothing about panels or re-authorizing. **The model invented the remedy**,
because nothing told it what the approval surface actually is.

## Why it matters

The approval gate is the security control that makes connectors safe to enable. A control that
**expires silently and then misdirects the person** trains them toward the one button that avoids
the whole problem — **Always allow** — which is the permanent grant. **A safety gate that is
annoying to satisfy is a safety gate that gets switched off.**

## For whoever fixes it — three separable pieces

1. **The duration.** 120 s is a guess with no user research behind it. ⚠ Making it a setting is
   the obvious move and is NOT obviously right — a very long fuse leaves a run parked and a
   connector call armed. **Whatever is chosen, the card must SHOW it.**
2. **The visibility.** A countdown, or at minimum "expires in…", plus not rendering the card
   below the fold (`SEED-240`).
3. ⭐ **The recovery text.** The dispatcher's own timeout string is correct; the model should be
   given the surface's real vocabulary so it stops inventing UI. **This is the cheapest of the
   three and removes the actively harmful part.**

## Not determined

- Whether a workflow-run approval (the panel's `PendingAskCard`) shares this 120 s fuse or has
  its own.
- Whether the timeout is per tool call or per run when several calls need approval.
