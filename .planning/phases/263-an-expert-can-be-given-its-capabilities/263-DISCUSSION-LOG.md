# Phase 263: An Expert Can Be Given Its Capabilities - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-21
**Phase:** 263-an-expert-can-be-given-its-capabilities
**Areas discussed:** Org-visibility of a born-for-an-Expert skill · Which existing write path
creates the skill · Who writes the instructions body · When the row is written and orphans ·
(follow-ups) arm width · schema shape · save fence · refusal shape · provenance timing

---

## Which existing write path creates the skill

| Option | Description | Selected |
|--------|-------------|----------|
| `POST /skills` — the UI path | What `SkillFormDialog` already calls. Variant A's UI IS that dialog, so zero new API surface. PACK-15's "no second authoring engine" is about not inventing an engine, not about the transport. | ✓ |
| `save_skill` tool path | Literally what PACK-15 names (`tool_dispatcher.py:1435`). Needs a `ToolContext` — unreachable from a UI dialog without building an adapter, which is itself new surface. | |
| Extract a shared service both call | One insert function; both paths delegate. Most correct, removes the divergence permanently. Costs a refactor of two shipped paths and touches `tool_dispatcher.py` (85 commits / 35 phases, G-5 FIRING). | |

**User's choice:** `POST /skills` — the UI path.
**Notes:** Recorded in CONTEXT as **D-263-03** with the reading of PACK-15's wording made explicit
rather than glossed, since the requirement names `save_skill` by name.

---

## Org-visibility of a born-for-an-Expert skill

*Surfaced by measurement during scouting, not from the ROADMAP: `POST /skills` hard-sets
`is_org_shared = False` (`api/skills.py:250`), but `resolve_expert_bundle`'s phase-2 check needs
`is_system OR (org_id match AND (user_id == caller OR is_org_shared))`. So an org-wide Expert would
be hollow for every member except its author. `toggle-global` refuses with a 409 unless the
`eval_runs` publish gate is met or overridden.*

| Option | Description | Selected |
|--------|-------------|----------|
| Third arm on the member check | The skill predicate gains "OR referenced by an expert bundle this caller can already access". The `org_id` fence stays intact so PACK-17 is unaffected. Changes D-259-04 — needs its own RED drive. | ✓ |
| Route the author through `toggle-global` | Create private, then walk the author through the existing publish flow (409 + explicit override, recorded in `skill_publish_overrides`). Honors GATE-01, invents nothing. Friction: five skills = five gate passes or five recorded overrides. | |
| Warn only — extend the PACK-16 banner | Create private; the banner also says "these skills will only work for you". Cheapest, fully honest, Expert still doesn't match its description for anyone else. | |
| Record it and ship private-only | Plant a seed with a trigger, ship the private path, close on PACK-14/15/16/17 as written. | |

**User's choice:** Third arm on the member check.
**Notes:** Recorded as **D-263-06**. Explicitly noted that the `org_id` fence is untouched, so
PACK-17 must still be driven independently (**D-263-12**).

---

## Arm width (follow-up — the third arm could expose a colleague's private skill)

| Option | Description | Selected |
|--------|-------------|----------|
| Provenance marker — narrowest | One migration column. The arm resolves ONLY skills created through this flow for that bundle. A pre-existing private skill an admin attaches still behaves as today. | ✓ |
| Owned by the bundle's author | Any skill whose `user_id` == the bundle's author. No migration. Broader: an admin attaching their own private skill silently publishes its instructions to every grantee. | |
| Any skill in the org | `org_id` fence only. An admin could expose a colleague's private skill — SEED-125's failure class one door over. | |

**User's choice:** Provenance marker.
**Notes:** Recorded as **D-263-07** (Migration 190, `skills.born_for_expert_bundle_id`).

---

## Provenance timing (follow-up — a new Expert has no bundle id at create time)

*Conflict created by combining "write immediately" (D-263-05) with the provenance marker
(D-263-07). Surfaced rather than guessed.*

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill the bundle id on Expert save | Create with `NULL`, one `UPDATE` at save stamps it. Narrowest — a skill born for Expert A is never resolvable through Expert B. An abandoned Expert leaves `NULL` and the skill behaves exactly as today. | ✓ |
| Boolean marker + author linkage | `born_for_expert` set at create. No backfill. Wider: any Expert-born skill of that author resolves through ANY of that author's Experts. | |
| Stamp it, and re-stamp on reuse | Always names the most recent bundle. Actively wrong at two bundles — the first Expert silently loses the skill. | |

**User's choice:** Backfill on Expert save.
**Notes:** Recorded as **D-263-08**.

---

## Who writes the instructions body

| Option | Description | Selected |
|--------|-------------|----------|
| `skill-creator`, on approval | Proposal carries name + description only; pressing Create runs the EXISTING `skill-creator` to author the body. The reuse PACK-15 asks for by name. Costs one LLM round-trip (~5-15 s) per approved skill. | ✓ |
| Drafter returns full instructions upfront | One call produces everything — what the sketch mocked. Fastest. Risk is measured: the drafter already returns 6-char `example_output` under load, which is why 261 had to add `min_length` floors. | |
| The human types it in the dialog | Pre-fill name + description, leave Instructions blank. Cheapest. But the premise is that the admin doesn't know PRISMA. | |

**User's choice:** `skill-creator`, on approval.
**Notes:** Recorded as **D-263-04**. Created a UX moment the sketch does not show (a loading state
between click and dialog) — resolved under Claude's Discretion below.

---

## When the row is written

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately on approve | A skill is useful standalone, so an abandoned Expert leaves real library rows, not garbage. Staging would need a holding store and a deferred write — arguably the second engine PACK-15 forbids. | ✓ |
| Staged until the Expert saves | Atomic: no Expert, no skills. Needs a staging store, and a browser crash loses approvals a human already gave. | |

**User's choice:** Immediately on approve.
**Notes:** Recorded as **D-263-05**.

---

## Schema shape for `suggested_new_skills`

| Option | Description | Selected |
|--------|-------------|----------|
| Required, may be empty | `Field(..., min_length=0)` over a nested model. The model MUST emit the key; an empty list is a real answer. Avoids the default-everywhere pattern 261 measured as a richness lottery. | ✓ |
| Required, at least one | `min_length=1` forces a proposal on every draft — would manufacture a skill to satisfy a schema. | |
| Optional with default `[]` | The exact shape 261 had to fix at `757bb9e25`. | |

**User's choice:** Required, may be empty.
**Notes:** Recorded as **D-263-02**.

---

## Where PACK-16's save fence lives

| Option | Description | Selected |
|--------|-------------|----------|
| Both — UI banner + server fence | The sketch's disabled Save is the UX; `POST`/`PATCH /experts` independently re-checks against the live library. A UI-only fence isn't a fence. | ✓ |
| Server only | Unskippable, but the author finds out on submit instead of while editing — weaker than the sketch promised. | |
| Frontend only | Exactly the sketch, nothing more. A direct `POST /experts` still saves a hollow Expert silently. | |

**User's choice:** Both.
**Notes:** Recorded as **D-263-09**.

---

## Refusal shape at save

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse with a named 422 | Consistent with variant A's disabled Save. The response names each unknown skill so any client can render the banner. | ✓ |
| Accept, strip, and report what was stripped | Nothing is silent, but the blueprint still describes capabilities the row no longer claims — the drift moves rather than closing. | |

**User's choice:** Refuse with a named 422.
**Notes:** Recorded as **D-263-10**.

---

## Claude's Discretion

- **The generating state between click and dialog** (created by D-263-04). Render it in place on
  the proposal card; do not open an empty dialog and fill it, and do not add a separate "Generate
  instructions" button. Derived from D-263-01 (variant A) rather than asked.
- **Test shapes** — mirror `test_259_closed_core_inventory.py` (D-263-11) and
  `test_259_expert_member_isolation.py` (D-263-12) rather than inventing new fence styles.

## Deferred Ideas

- The blueprint prose is never rewritten when a claimed capability is dropped — an Expert can still
  *describe* a capability it knowingly lacks. Named, not fixed.
- `is_org_shared` and the publish gate stay untouched; D-263-06/07 route around the gate with a
  provenance marker rather than through it.
- `SEED-103` (batched skill-creator interview), `SEED-104` (agent-driven skill file attachment),
  `SEED-187` (document → skill) — adjacent, reviewed, not folded.
- `spike-nl-workflow-authoring.md` todo (score 0.60) — keyword false positive, not folded.

## Register routing written back

- `SEED-303` — `status_note` updated and `folded_into` set to `"263 (S9 only - the other arms
  remain open)"`. Its S3 / S8 / spend-attribution arms are untouched and stay open.
- `BUG-260921-01` — already `status: folded`, `folded_into: "263"`. No change needed.
