# Phase 223 — A Connection Leaves a Record

**Proposed 2026-09-02** from the UAT drive of the same day. Not yet in `ROADMAP.md` — this is the
scoping document the operator asked for, and it stops at the point where `/gsd:discuss-phase`
takes over.

---

## The one sentence

> After the fact, a person can answer **"which services was this conversation using, what did they
> send, on whose behalf, and who approved it"** — because today every part of that answer is
> discarded the moment it is used.

## Why now

⭐ **A shipped, verified success criterion is provably unmet.** ROADMAP **GRANT-05**, Phase 213:

> *"**Every** outbound call made through a connection appears in the audit ledger naming service,
> tool, actor and outcome."*

Driven end to end on 2026-09-02: the operator armed Google Workspace, the agent proposed
`search_files`, the run paused, **the operator clicked Approve once**, the call executed against
the live Google Drive API with their OAuth token, and returned an honest answer in 41 seconds.

**The chain works. It appears in no ledger.** `audit_log`'s newest row predated the call;
`operator_audit_log` and `harness_audit` were days old.

⚠ **The property is exactly inverted.** `tool_dispatcher.py` writes eight audit rows and every one
is an **internal** tool — `search.query`, `skill.load`, `code.execute`, `memory.remember`,
`memory.recall`. **The calls that never leave the machine are logged. The call that used a
customer credential against a third party is not.**

## The three defects, and why they are ONE phase

They are not a themed bundle. **They are one hole seen from three sides, and the fixes share a
call site and a data shape.**

| | what is missing | where |
|---|---|---|
| `BUG-260902-05` ⛔ | no record that a call **happened** | `tool_dispatcher.py` connector path |
| `BUG-260902-03` | no record of which connectors were **armed** | `active_connector_ids` is request-only |
| `BUG-260902-04` (copy half) | the model **invents** the recovery vocabulary | timeout path |
| *(no bug id yet)* | no record that a **permanent grant** was created | `update_grants` |

⚠ **`-03` and `-05` compound into something neither is alone:** no record of what was armed, no
record of what was called. **A connection's activity in chat is entirely unreconstructable** —
not degraded, not partial. Absent.

## Success criteria (what must be TRUE)

1. **An outbound connector call appears in the audit ledger** naming **service, tool, actor and
   outcome** — the four `GRANT-05` names, no more required, and a **refusal and a failure are
   recorded too**, not only a success.
1a. **Creating an `Always allow` grant appears too.** A permanent widening of what the agent may
   do without asking is at least as audit-worthy as one call made under it.
2. **A turn's armed connectors survive a reload.** Reopening a thread shows what it was using.
   ⚠ **And an explicit OFF stays off** — `MessageInput.tsx:81` is explicit that disarming is a
   decision; a restore that re-arms something a person switched off is worse than the bug.
3. **The model stops inventing UI.** On an approval timeout the person is pointed at the surface
   that actually holds the card, and is **not** told to re-authorize a healthy connection.
4. ⚠ **The ledger write cannot fail silently.** `write_audit_entry` swallows exceptions
   (`documents.py:1882`), so an unregistered `action_type` reproduces this bug with code that
   reads correctly. **A test must prove the row lands, not that the function was called.**

## How we'd know this failed (G-6)

- A connector call is audited **only on success**, leaving refusals and errors invisible — the two
  cases an audit exists for.
- The audit row stores **the whole `args` blob** verbatim. Arguments can carry a recipient, a
  query, a document body. *Service, tool, actor, outcome* are named by the criterion and none is
  sensitive; going further is a decision, not a default.
- The armed-connector restore **re-arms something a person turned off**.
- A new `action_type` is added and **not registered**, so the write fails silently and every gate
  stays green. ⭐ **This is the most likely way this phase ships broken.**
- The work grows to cover workflow-run connector calls or the operator audit UI. **Those are
  named in "not in scope" below for exactly that reason.** ⚠ The `Always allow` receipt was
  moved INTO scope on measurement — see below — so it is no longer an example of scope creep.

## Not in scope, deliberately

- **Workflow-run connector calls.** `harness_audit` exists and was never exercised in this drive.
  Whether it has the same hole is **not determined** and must be measured, not assumed.
- ~~**Whether creating an `Always allow` grant writes a receipt.**~~ ⭐ **MEASURED 2026-09-02 —
  it does NOT.** `update_grants` in `api/connectors.py` contains no `write_audit_entry` call, so
  a **permanent permission change** — the most consequential button on the approval card — leaves
  no record either. **This is now IN SCOPE**: same machinery, one call site, and leaving it out
  would ship an audit story with a hole in the middle of it.
- **`BUG-260902-04`'s duration and visibility halves** (the 120 s fuse, the card below the fold,
  a countdown). Those are the chat-surface phase's, with `SEED-240` and `SEED-128`, behind a G-2
  sketch. **Only the recovery COPY comes here**, because it is a factual correction rather than a
  design question.
- **`BUG-260902-01`** (todos stranded `in_progress`) and **`BUG-260902-06`** (the per-worker cache).
  Independent, and neither shares a call site with these three.

## What makes this small

Every field is **already in hand at the call site** — `matched_conn.name`, `matched_conn.id`,
`action_tool_name`, `args`, `ctx.user_id`, and the result status. **This is a missing write, not
a missing design.** The approval card already *displays* all four required fields before the call
and discards them after.

⚠ **The one real design question** is where the armed set lives. The cheapest correct-shaped
option is to persist `active_connector_ids` on the message row and seed the composer from the
thread's last message — it reuses a field already on the wire and yields the audit trail of
*arming* for free. **`localStorage` would fix the refresh and none of the rest** — not a second
device, not the backend's ability to answer the question at all.

## Flags

- ⚠ **Security-adjacent, not security-critical.** Nothing here grants new access or opens egress;
  it records what already happens. **But `AGENTS.md` §3.1's criteria include "credentials" and
  "permission model"**, so who builds it is the operator's call and should be stated out loud.
- ⚠ **`tool_dispatcher.py` is a G-5 hot file** — 72 commits / 29 phases / 4,624 lines, and its
  ledger row was already found stale once. Re-derive the triple at discuss-phase.
- ⚠ **A MIGRATION IS LIKELY REQUIRED, and I nearly recorded the opposite.** `audit_log` already
  has a `metadata` jsonb, so the ledger side needs none. For the armed set, my first query said
  `messages` has a `payload` jsonb — **it does not**. That column belongs to `realtime.messages`,
  a different table in a different schema; the query was not schema-scoped. **`public.messages`
  has `tool_calls` and `source_refs` jsonb and nothing else that fits**, and putting an armed-
  connector list in either would be a lie about what those columns mean. So this phase probably
  carries one numbered migration. ⚠ **Recorded because the near-miss is the lesson**: an
  unscoped `information_schema` query in a Supabase database silently unions `public` with
  `realtime`, `auth` and `storage`, and reads as a clean answer.
