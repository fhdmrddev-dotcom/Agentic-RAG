# Phase 293: Start From Outside, and Close Out - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-24
**Phase:** 293-start-from-outside-and-close-out
**Areas discussed:** The key itself, The call and its answer, How a run says how it started, Where keys are managed

---

## The key itself

| Question | Options | Selected |
|---|---|---|
| Who does a key's run act as? | The person who made the key / The organisation (service account) / The workflow's author | The person who made the key |
| Which workflows can one key start? | A list chosen at creation / Exactly one / Every published workflow the person can run | A list chosen at creation |
| Who can make a key? | Any member for own runs, admins see+revoke all / Org admins only | Any member; admins see and revoke all |
| Does a key expire? | Chosen at creation, default 90, never allowed / Always expires / Never, revoke only | Chosen at creation (30/90/365/never), default 90 |

**Notes:** Claude added as locked defaults (not objected): every call re-checks membership, publish state, list membership and run permission; the 258 entitlement check applies as for scheduled runs.

## The call and its answer

| Question | Options | Selected |
|---|---|---|
| How does the caller get the answer? | Start + poll / + wait up to N s / + callback URL | Start + poll |
| What does status return? | Status + output + file links + per-step / Status + output only / 289 evidence payload | Status + output + file links + per-step |
| Where does an inbound run live? | Own thread in owner's history / One shared thread per key | Own thread |
| Paused run? | Waiting for a person, answered in app / Answer via API / Refuse pausable workflows | Waiting, answered in app |
| Inputs? | Declared launch fields, text only / Including file uploads | Declared fields, text only |
| Who may read status? | Only the starting key / Any key of the same person | Only the starting key |

## How a run says how it started

| Question | Options | Selected |
|---|---|---|
| Origin detail | Three kinds + name (app/schedule/key) / Every entry point | Three kinds + name |
| Old runs | Backfill schedule runs, others silent / Backfill + label others "app" | Backfill schedule runs, others silent |
| Where shown (multi) | Run page header / Evidence report + export / Run log rows / Chat run card | All four |
| Next run on card | Cadence + time / Replace cadence / Hover only | Cadence + time |
| Sketch (G-2) | Key screen only / Both / None | Key screen only |

## Where keys are managed

| Question | Options | Selected |
|---|---|---|
| Key home | Settings tab + card menu door / Card menu only / Settings only | Settings "API keys" tab + card menu door; admin list in org admin |
| Rate limit | Per key 10 starts/min, 120 reads/min, operator-set / + per-org ceiling / Fixed in code | Per key, operator-set in Settings |
| Key activity | Last used + recent calls + audit ledger / Audit ledger only | Last used + recent calls + audit ledger |
| Example after creation | curl for start and status / Docs link only | curl for start and status |

## Claude's Discretion

- Key format, hash choice, header name, endpoint paths, signed-link lifetime.
- Origin column placement (`workflow_runs` vs `runs`).
- Refusal sentence wording.
- SEED-163 status word: `shipped` (enum has no `delivered`).

## Deferred Ideas

- Callback URL on completion; wait-up-to-N start; file uploads through a key; org service-account keys; per-org ceiling; answering a paused run via the API (rejected); SEED-367.
