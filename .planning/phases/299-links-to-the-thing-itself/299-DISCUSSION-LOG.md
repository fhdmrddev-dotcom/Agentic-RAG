# Phase 299: Links to the Thing Itself - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 299-links-to-the-thing-itself
**Mode:** `--auto` (operator: "continue autonomously end to end") — recommended option taken each time.
**Areas discussed:** address shapes, server resolver, can't-be-opened, switch prompt, copy link, sign-in return + boot, FIX-02, WR-08 routing

The four sketch winners were picked by the operator on 2026-10-28 (MANIFEST §Sketch 299) and were not re-asked.

---

[auto] Addresses — Q: "Address shapes?" → Selected: `/app/chat|workflows|runs|experts/<uuid>` as proposed in sketch 299-3 (recommended)
[auto] Addresses — Q: "What does a published-workflow link open?" → Selected: library with the card focused, no fork (alternatives: Builder fork — rejected, a link must not write; run modal — rejected, implies an action)
[auto] Resolver — Q: "How does the client tell other-org from missing?" → Selected: one new `GET /links/{kind}/{id}` in a new module, identical 404 (alternatives: per-kind reads with an org header loop — rejected, leaks via 400/403 and touches FIRING files)
[auto] Switch — Q: "Show the item title in the prompt?" → Selected: yes — the resolver returns it only to someone who may open it (sketch 299-2 asked to confirm here)
[auto] Copy link — Q: "Who-can-open wording?" → Selected: derived per kind from the actual visibility rule, never promising more
[auto] Boot — Q: "Thresholds?" → Selected: 8 s / 20 s as sketched
[auto] FIX-02 — Q: "Mobile loading treatment?" → Selected: the desktop "Loading your chats…" words, no skeleton (one vocabulary)
[auto] Sign-in — Q: "How does SSO/sign-up carry the return?" → Selected: `redirectTo`/`emailRedirectTo` rebuilt from `formatAppRoute` + sessionStorage copy; operator adds Redirect URLs
[auto] Seeds — Folded SEED-178, SEED-015, SEED-312 and BUG-261027-02 (named by ROADMAP); seeds sweep matched 0 structured triggers (phase had no plans yet)
[auto] WR-08 (298 deferral naming 299) — Selected: reviewed, deferred with reason (link opens equalise viewer and item org; residual is a hint, never a write)

## Deferred Ideas
- 298 WR-08, skill-studio tab in URL, public/outside-org share links.
