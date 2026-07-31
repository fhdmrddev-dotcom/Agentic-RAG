# Phase 186: Concurrency & Autosave - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 186-concurrency-autosave
**Areas discussed:** Autosave trigger & cost, Clobber guard mechanism, Publish / dirty-draft guard (SC#3), BUG-260731-03 routing + KB binding

---

## Autosave trigger & cost

### Q1 — What should actually trigger an autosave write?

| Option | Description | Selected |
|--------|-------------|----------|
| Debounce on any edit | One uniform rule, ~500-1000ms after the author stops; reuses the shipped `VALIDATE_DEBOUNCE_MS` / `CONFIG_COALESCE_MS` shape. Cosmetic drags stay browser-local. | ✓ |
| Structural now, config debounced | Add/delete/move → immediate PATCH; typing → debounced. Closer to what the edit costs, but two code paths and two failure modes. | |
| Save on commit points only | Write on panel dismissal, tab blur, navigation. Fewest writes, no timer — but a 20-minute editing session sits fully at risk. | |

**User's choice:** Debounce on any edit
**Notes:** Recommended because one timer / one writer is the simplest thing to test, and the codebase already ships the identical shape twice.

### Q2 — What survives autosave from 184's Save button / dirty indicator / leave guard?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep button, add quiet status | Silent autosave + quiet `Saving… / Saved · just now`; explicit Save stays as commit-now; the leave guard survives but now means "a write failed", not "you forgot". | ✓ |
| Autosave only — retire the button | Drop the button and the leave guard. Cleanest surface, but deletes shipped tested affordances and removes the force-a-write escape. | |
| You decide | Leave the affordance set to sketch/plan, with the constraint that a failed write stays visible. | |

**User's choice:** Keep button, add quiet status
**Notes:** Nothing shipped gets deleted; the guard changes meaning rather than disappearing.

### Q3 — What does autosave do on a shape-invalid (Pydantic 422) definition?

| Option | Description | Selected |
|--------|-------------|----------|
| Hold the write, say why | No write, stay dirty, `Not saved — <reason>`, never a false `Saved ✓`. Key on the `useLiveValidation` unreadable/422 branch that already exists. | ✓ |
| Always attempt, surface the 422 | Fire regardless; a 422 lands in the existing save-error path. Simpler, but a burst of doomed requests and a flickering error state mid-thought. | |
| Persist last-known-good | Always keep something loadable on the server. Strongest against loss, but the server copy silently differs from the screen — a second source of truth (D-14 forbids). | |

**User's choice:** Hold the write, say why
**Notes:** Framed as the T-185-04-01 lesson — never file a receipt for something that did not happen.

### Q4 — How far should the 184-deferred seam extraction go?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract a `useDraftPersistence` hook | One hook owns create-once-then-PATCH, the debounce, dirty/saved state, the token, the error branches; page composes it like `useLiveValidation`. | ✓ |
| Rewrite in place, no extraction | Smallest diff, lowest regression risk — but grows the exact file 184 promised would shrink, and entangles concurrency logic with page state. | |
| Extract more than persistence | Also lift selection or validation wiring. Bigger cleanup, but scope beyond the phase and churn against surfaces 185 just verified. | |

**User's choice:** Extract a `useDraftPersistence` hook
**Notes:** Honours the D-184-05 promise recorded verbatim in three files.

---

## Clobber guard mechanism

### Q1 — Who is CONCUR-02's guard actually protecting against?

| Option | Description | Selected |
|--------|-------------|----------|
| Build for the reachable case | Same user across two tabs / devices / a stale tab. The mechanism is identical either way — it keys on "the row moved", not on who moved it. Record the org-share gap honestly. | ✓ |
| Build for both, including org-share | Add the `is_org_shared` toggle so a real two-person edit exists, then guard it. Makes CONCUR-02 literally true — but migration + RLS rewrite + sharing UI is a new capability. | |
| Guard the row, say nothing about who | Pure row-level invariant, leave the "who" out. Honest and minimal, but leaves the success criterion unverifiable as written. | |

**User's choice:** Build for the reachable case
**Notes:** Presented after verifying mig 111 gave workflows `is_system_global` (a platform flag) rather than `is_org_shared`, and that UPDATE is `created_by`-only at both RLS and service layers.

### Q2 — What backs the optimistic-concurrency token?

| Option | Description | Selected |
|--------|-------------|----------|
| Opaque token over `updated_at` | Column + `set_updated_at` trigger already exist; serve as an opaque string, add `AND updated_at = $N` to the PATCH WHERE. Zero migrations. Hard constraint: echo verbatim, never parse into a JS `Date`. | ✓ |
| New `revision` integer column | Migration 115 + trigger bump. Monotonic, no precision hazard — but breaks the zero-migration promise (would need the 185-13 open-amendment precedent). | |
| Content hash / ETag | No schema change, no precision hazard — but an identical-content rewrite looks like no conflict, and it adds hashing machinery for a problem the row already answers. | |

**User's choice:** Opaque token over `updated_at`
**Notes:** Fallback to the `revision` column at slot 115 is explicitly allowed **if** research shows the round-trip cannot be made precision-safe — amended in the open, never silently.

### Q3 — What happens in the losing tab on 409?

| Option | Description | Selected |
|--------|-------------|----------|
| Stop writing + honest banner + escape hatch | Autosave halts; banner offers Reload (default) or Overwrite (deliberate second click). No work trapped, none lost by accident. Satisfies SC#4 as written. | ✓ |
| Silent reload of the newer version | Always converges, zero friction — but discards the losing tab's screen without asking: the clobber relocated to the client. | |
| Soft-lock instead of a token | Prevents rather than detects — but needs leases, heartbeats and expiry, and strands an author behind their own crashed tab. | |

**User's choice:** Stop writing + honest banner + escape hatch
**Notes:** Resolves the roadmap's explicit "block vs warn vs merge" discuss call in favour of warn-with-both-exits.

### Q4 — How does the route tell the three 0-row causes apart?

| Option | Description | Selected |
|--------|-------------|----------|
| Disambiguating re-read + typed error code | On 0 rows, re-read owner-scoped: missing → 404, published → 409 `already_published`, token differs → 409 with a distinct machine-readable code. Client branches on the code, never the prose. | ✓ |
| Separate HTTP status (412) | Textbook for If-Match and no client-side disambiguation — but still needs the server re-read, so it buys clarity, not work. | |
| You decide | Leave the split to research/planning under two hard constraints. | |

**User's choice:** Disambiguating re-read + typed error code
**Notes:** Raised because adding the token clause would otherwise make a stale token surface as `404 "draft not found"` — a lie — and 184-11 had already spent the 409 slot on the published-row sentence.

---

## Publish / dirty-draft guard (SC#3)

### Q1 — What should publish do when the draft moves mid-gauntlet?

| Option | Description | Selected |
|--------|-------------|----------|
| Carry the token through, refuse on drift | Capture at stage 0, add `AND updated_at = $N` to the stage-5 flip; on drift return an honest new `blocked_stage` with the golden run + audit rows preserved. Reuses the WR-03 sentinel shape. | ✓ |
| Freeze the draft during the gauntlet | Prevents drift instead of detecting it — but a third status-ish state needs a release path on every crash/timeout/worker death; a stranded row is unrecoverable without an operator. | |
| Publish the validated snapshot | Always ships something that passed — but silently discards later edits: a clobber wearing a different hat. | |

**User's choice:** Carry the token through, refuse on drift
**Notes:** Presented after confirming stage 5 currently guards only on `status='draft'`, so an autosave landing mid-gauntlet publishes something that never passed.

### Q2 — Should the client also hold writes while a publish is in flight?

| Option | Description | Selected |
|--------|-------------|----------|
| Hold writes, same mechanism as invalid-draft | Same hold-and-say-why path, second sentence: "Publishing — changes will save when it finishes." Prevents the wasted golden run; the stage-5 check stays the structural backstop. | ✓ |
| Server guard only | Identical correctness guarantee, fewer client parts — but an author who tidies a prompt during a 3-minute publish loses the whole run and pays for another. | |
| Block all editing during publish | Unambiguous, but freezes the author out for minutes over a race a hold already solves. | |

**User's choice:** Hold writes, same mechanism as invalid-draft
**Notes:** Confirmed during discussion that the new `blocked_stage` needs **no** migration — it is free-form metadata on the already-registered `publish_blocked` event type, unlike 185-13's `action_risk_pending`.

### Q3 — What is the honest SC#10 parallel-axis UAT row?

| Option | Description | Selected |
|--------|-------------|----------|
| Two tabs, same account, driven live | Two-tab, stale-tab and publish-race rows — all reachable in the product and drivable in the browser. The colleague-clobber row recorded ⛔ with its reason, never dropped. | ✓ |
| Two accounts via a direct DB grant | Tests the literal requirement wording — but exercises a configuration the product cannot produce, so a pass proves nothing about shipped behaviour. | |
| Automated concurrent-PATCH test only | Cheap and deterministic and worth having regardless — but G-4 says wire format alone is insufficient for a user-visible surface. | |

**User's choice:** Two tabs, same account, driven live

---

## BUG-260731-03 routing + KB binding

### Q1 — Where does the blocking bug land?

| Option | Description | Selected |
|--------|-------------|----------|
| Split: control here, verdict in 187 | 186 folds the author-time binding control (persisted through the save path it is already rebuilding); 187 keeps the deterministic build-time `/validate` verdict with its safe-by-construction claim. | ✓ |
| Whole bug into 186 | Closes the blocker in one phase — but the verdict half means new lint codes and severity vocabulary, which is 182's envelope and 187's claim. | |
| Whole bug into 187 | Cleanest conceptual fit — but ships 186 with a blocking bug open, and 187 would have to reopen the save seam 186 just rebuilt. | |

**User's choice:** Split: control here, verdict in 187
**Notes:** Routing was mandatory at this touchpoint (`severity: blocking`, `folded_into: null`). Report frontmatter updated to reflect the split; status stays `open` until 187 closes the verdict half.

### Q2 — Where does the knowledge-base control live?

| Option | Description | Selected |
|--------|-------------|----------|
| Make the existing header chip the control | Promote the display-only `📁` chip into the picker; show an explicit unbound state. Reachable from all three creation paths; reuses the existing component. | ✓ |
| A workflow-settings panel | More room to grow for 187/189 — but a net-new surface in a phase whose UI budget is a status line and a banner, and it fires G-2. | |
| Both — chip opens the panel | Middle ground, but builds the panel anyway and carries most of its cost. | |

**User's choice:** Make the existing header chip the control
**Notes:** The bug's own correction #3 established that the chip exists and is display-only — "visible only after opening the builder, and never editable".

### Q3 — Should 186 say anything at author time about an unbound workflow?

| Option | Description | Selected |
|--------|-------------|----------|
| An invitation on the chip, no verdict | "No knowledge base · searches everything" as a neutral configuration fact — no severity, no code, no tray row. Follows the `EMPTY_DRAFT_INVITATION` precedent, so D-182-06 stays intact. | ✓ |
| Say nothing until 187 | Smallest diff and zero risk to D-182-06 — but the bug's core complaint is that the default is silently wrong, and a control nobody knows to use does not fix that. | |
| Change the default to require a choice | Strongest fix — but a behaviour change to three creation flows and to whole-KB retrieval semantics: a requirements change, not a bug fold. | |

**User's choice:** An invitation on the chip, no verdict

### Q4 — Route SEED-138 (definition jsonb double-encoded)?

| Option | Description | Selected |
|--------|-------------|----------|
| Note it, don't fold | Record that autosave heals-on-write; keep the defensive decode; no backfill (all rows are test fixtures). Give it a concrete re-open trigger. | ✓ |
| Fold a normalization + backfill | Closes the seed properly and removes a defensive branch — but breaks zero-migration for data cleanup on rows that are all fixtures. | |
| Fold detection only | Cheap visibility, but it is monitoring for a condition whose count we already know. | |

**User's choice:** Note it, don't fold
**Notes:** This was the second of the two items STATE.md listed as owed before Phase 186; both are now routed.

---

## Claude's Discretion

- Exact debounce constant within the 500–1000 ms band.
- Exact wording of the conflict banner, the two hold sentences, and the new `blocked_stage` verdict (content locked, phrasing not).
- Whether `builderStore`'s unread `saveState` slot earns its keep or is retired (`builderStore.ts:199` explicitly defers this call to Phase 186).
- Whether the stale-token conflict uses 409-with-code or 412 Precondition Failed, under D-186-09's two hard constraints.

## Deferred Ideas

- Workflow org-share toggle (`is_org_shared` + RLS rewrite + sharing UI) — own phase; re-open on the first real customer ask or when Dept-Admin (169) lands.
- Real-time collaborative multi-cursor editing (CRDT/OT) — already cut as OPEN-04.
- SEED-138 backfill — re-open on the first non-fixture production rows.
- The `BUG-260731-03` verdict half — Phase 187.
- Making `folder_scope` editable per-phase — carries the D-186-17 trap (raw 422 + hold-the-write = permanently-unsaveable draft).
- A dedicated workflow-settings panel — natural home if 187/189 add more workflow-level fields.
