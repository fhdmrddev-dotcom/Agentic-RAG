# Phase 235: The Source Says What It Did - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-06
**Phase:** 235-the-source-says-what-it-did
**Areas discussed:** SURF-03's home (forced), What a "run" is and what it counts, When a source
counts as "stopped" and the one control, The Sync button's honesty, plus a closing pass on surface
placement and the option-C deferral trigger.

**Mode:** default interactive. Every question carried a marked recommendation. **The operator
accepted the recommended option on all 14 questions.**

---

## SURF-03's home (the forced scoping decision)

| Option | Description | Selected |
|--------|-------------|----------|
| B + A (Recommended) | App-shell signal on any page + Health-tab detail; C deferred | ✓ |
| B + A + C now | Adds email — no system mailer exists; the SMTP path is a user's connection | |
| A only | Health-tab row alone — roadmap says this does NOT satisfy the requirement | |
| B only | Signal with no destination to lead to | |

**User's choice:** B + A.
**Notes:** C is deferred, never closed. The roadmap warned that closing SURF-03 against option A
would close it against its own sentence.

| Option | Description | Selected |
|--------|-------------|----------|
| General surface, one tenant (Recommended) | Generic shell signal; 235 registers exactly one producer | ✓ |
| Watch-specific only | A badge meaning "a watch is broken" and nothing else | |
| General surface, register SEED-231 too | Would drag harness_engine into a Library phase — scope creep | |

**User's choice:** General surface, one tenant.
**Notes:** The rejected watch-only option would have grown a sibling surface at the next
notification need — the two-paths-one-outcome shape this codebase has shipped five times.

| Option | Description | Selected |
|--------|-------------|----------|
| Rail badge → Library Health (Recommended) | Badge on NavPanel RailItem, popover names the source, action navigates | ✓ |
| Persistent top banner | Louder; reflows every page; dismissibility re-opens SC#4 | |
| Both — badge always, banner when severe | Most graded; two surfaces + a severity threshold to settle | |

**User's choice:** Rail badge → Health.
**Notes:** The app has no router (SEED-185) — the popover action goes through `onNavigate`.

| Option | Description | Selected |
|--------|-------------|----------|
| Server-computed health verdict (Recommended) | One polled endpoint with the threshold already applied | ✓ |
| Client derives from the watch list | No new endpoint; threshold logic would exist in two places | |
| Supabase Realtime push | A hint, not truth (D-v2.5-03) — an addition, not an alternative | |

**User's choice:** Server-computed verdict.

---

## What a "run" is, and what it counts

| Option | Description | Selected |
|--------|-------------|----------|
| Watch loop writes its own row (Recommended) | `sync_watch` already computes the counts and discards them | ✓ |
| Derive from `ingestion_jobs` | Measured incomplete — would have undercounted one batch by 40% | |
| Derive from `connector_watch_items` | Records current state, not history | |

**User's choice:** Watch loop writes its own row.
**Notes:** This deliberately demotes `BUG-260906-03` from a blocker to an observability debt. The
bug report itself said that choice was the decision and should be made deliberately rather than
inherited.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, every tick (Recommended) | Zero-count rows included; UI collapses quiet runs | ✓ |
| Only ticks that changed something | Cannot distinguish "nothing changed" from "never ran" | |
| Every tick, pruned aggressively | Keeps failures, prunes quiet successes; adds a pruning job | |

**User's choice:** Every tick.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep N per watch, prune on write (Recommended) | ~200, bounded by construction, N is a settings knob | ✓ |
| Time-based (90 days) | Size becomes a function of tenant behaviour; needs a scheduled prune | |
| Keep everything for now | How the audit_log grew | |

**User's choice:** Keep N per watch, prune on write.

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ingestionErrorVocabulary's pattern (Recommended) | New sibling leaf under the same five binding rules | ✓ |
| Reuse the existing module directly | Its table is for upload failures; source failures would hit the fallback | |
| Backend returns the human sentence | Copy would live in Python, away from the vocabulary discipline | |

**User's choice:** Extend the pattern in a new sibling module.

---

## When a source counts as "stopped", and the one control

| Option | Description | Selected |
|--------|-------------|----------|
| Cause-dependent: hard immediately, soft after 3 (Recommended) | Revoked token stops on failure 1; timeout needs 3 | ✓ |
| N consecutive failures, uniformly (3) | At a 6-hour cadence a dead token stays silent for 18 hours | |
| Time since last success > 2× interval | Cannot distinguish failing from switched-off from paused | |

**User's choice:** Cause-dependent.
**Notes:** The hard/soft classifier is also what option C needs when its trigger fires.

| Option | Description | Selected |
|--------|-------------|----------|
| Cause → one named control, table-driven (Recommended) | Reconnect / Pick a different folder / operator sentence / Retry | ✓ |
| Always Reconnect | An OAuth dance cannot fix an unshared folder | |
| Always Retry, with the cause as text | SC#2's word is *fixes*; Retry does not fix a revoked token | |

**User's choice:** Table-driven cause→control map, held as data in the vocabulary leaf.

| Option | Description | Selected |
|--------|-------------|----------|
| Its own instance-level condition (Recommended) | Said once; the banner owns platform-wide truth, the row owns its own | ✓ |
| Mark every watch stopped | N alarms for one condition; the badge would miscount | |
| Refuse at the API only | A person who never clicks Sync is never told | |

**User's choice:** Instance-level condition with its own surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row boundary + a named degraded row (Recommended) | Healthy sources still render; the broken one says so | ✓ |
| Per-row boundary, silently skip | A source that vanishes from its own list is the silence LIB-10 forbids | |
| Out of scope — leave SEED-239 to its own fix | The roadmap folds it in because the blast radius is observable here | |

**User's choice:** Per-row boundary + a named degraded row.

---

## The Sync button's honesty (BUG-260906-02)

| Option | Description | Selected |
|--------|-------------|----------|
| All three (Recommended) | Refuse when the reader is off · report the outcome · show pending | ✓ |
| Parts 1 and 2 only | Leaves the click→tick window silent — the lived half of the bug | |
| Part 2 only | The endpoint would still report success for work nothing consumes | |

**User's choice:** All three.
**Notes:** Binding either way — the endpoint must NOT sync inline; the poke is deliberately safe
across uvicorn workers.

| Option | Description | Selected |
|--------|-------------|----------|
| "Asked · next check within N" (Recommended) | Says what was actually done; flips to the outcome | ✓ |
| Spinner until last_run_at advances | Up to 60s of spinner reads as a hang | |
| Optimistic "Checking now…" | A politer version of the same overclaim | |

**User's choice:** "Asked · next check within N".

| Option | Description | Selected |
|--------|-------------|----------|
| /gsd:quick before planning 235 (Recommended) | BUG-260906-01 is a located extraction + an agreement test | ✓ |
| Plan 235-01, inside this phase | Widens a surface phase with a backend ingestion extraction | |
| Defer it | The history would be designed around the hole | |

**User's choice:** /gsd:quick first.

| Option | Description | Selected |
|--------|-------------|----------|
| All four surfaces in one sketch (Recommended) | History · stopped card · badge+popover · reader-off statement | ✓ |
| Just the signal | The roadmap names all three of history/card/signal as the G-2 subject | |
| Skip the sketch — override G-2 | G-2 is marked MANDATORY for 235 | |

**User's choice:** All four in one sketch. **G-2 honoured, not overridden.**

---

## Closing pass — surface placement and the deferral trigger

| Option | Description | Selected |
|--------|-------------|----------|
| History on the source card; Health shows only broken sources (Recommended) | Ingestion = everything it did; Health = only what is wrong | ✓ |
| Full history in the Health tab | Splits "my folders" from "what they did" across two tabs | |
| Both — history rendered in each | Two homes for one truth, even with a shared component | |

**User's choice:** History on the source card; Health carries only the attention list.
**Notes:** Raised because the four locked answers left it genuinely ambiguous — the badge routes to
Health, but SC#1's sentence is about opening a *source*.

| Option | Description | Selected |
|--------|-------------|----------|
| First customer report + a system mailer exists (Recommended) | Two independent triggers, recorded on SEED-231 | ✓ |
| First customer report only | Orphaned if a mailer arrives for approvals first | |
| When a paying customer runs unattended watches | Nothing in the product would fire it | |

**User's choice:** Two-part trigger, recorded on SEED-231.

---

## Claude's Discretion

- Column set and indexes on `connector_sync_runs`.
- The precise retention `N` (~200) and its settings-key name.
- The health-verdict endpoint's path and payload.
- The shell signal's poll interval.
- Whether the degraded-row boundary is a per-row `try/except` or a per-row model fallback.

## Deferred Ideas

- Option C (email on permanent failure) — deferred with a named two-part trigger on `SEED-231`.
- A second notification producer in the shell surface (`SEED-231` approvals, `SEED-248` loading).
- `BUG-260906-03` — demoted to observability debt; stays open with a named re-open trigger.
- `SEED-239`'s root fix in `connector_service.list_connections` (only its observable half folds in).
- `SEED-252`'s design half (many rules contributing, the file actually moved) → Phase 237.
- `SEED-046` — broader Library Health enrichment stays dormant.

## Register updates made at this discuss-phase

- `BUG-260906-02` → `status: folded`, `folded_into: 235`.
- `BUG-260906-03` → `status: deferred` with a named `re_open_trigger` (any future retry / resume /
  audit / cost-attribution feature built on `ingestion_jobs`).
- `BUG-260906-01` → stays `open`; routed to `/gsd:quick` **before** planning, not folded into 235.
- `SEED-231` → carries option C's re-open trigger.
