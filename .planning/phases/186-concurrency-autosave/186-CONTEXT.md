# Phase 186: Concurrency & Autosave - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Make continuous canvas autosave **safe**: a write never mints a definition version,
a stale writer never silently clobbers a newer one, and publish never ships a draft
that moved under it mid-gauntlet. Plus the folded repair path for `BUG-260731-03`
(a workflow-level knowledge-base control on the built canvas).

Requirements: **CONCUR-01, CONCUR-02** (`.planning/REQUIREMENTS.md:54-55`).

**Not in this phase:** real-time collaborative multi-cursor editing (OPEN-04 — CRDT/OT
was explicitly cut for v3.6); the deterministic build-time `/validate` verdict for an
unbound workflow (routed to Phase 187); a workflow org-share toggle; any data backfill.

### Four scouting findings that reframe the roadmap wording

These were verified in code during discussion. Downstream agents should treat them as
established, not re-derive them.

1. **CONCUR-01 is already largely true.** `update_workflow_definition`
   (`backend/app/db/workflows.py:413`) is `UPDATE … SET name, definition` — it never
   bumps `version`. And Phase 184-07 moved the cosmetic drag offset into browser-local
   `canvasNudge.ts`, spy-proven at **0 network calls**. So *"a cosmetic drag never mints
   a version"* is true **by construction today**. What 186 actually builds is autosave
   itself; the risk is what autosave *adds*, not what it must fix.

2. **"Two people editing the same org-shared workflow" is NOT reachable in the product.**
   Migration 111 (D-165-01) renamed `workflow_definitions.is_global` →
   **`is_system_global`** — deliberately classified as a *platform* flag, **not** a user
   org-share toggle (folders and skills got `is_org_shared`; workflows did not). The
   INSERT policy forbids a user setting it, and UPDATE is `auth.uid() = created_by` at
   **both** the RLS layer (mig 108 §5) and the service-layer WHERE. No second person can
   PATCH your draft. The reachable writer conflict is **one user across two tabs / two
   devices / a stale tab**.

3. **The publish/dirty-draft race is real and unguarded.**
   `backend/app/services/harness/publish_service.py` loads the definition at stage 0,
   spends minutes on a golden run + judge, then flips at stage 5 on **`status='draft'`
   only**. WR-03 is the *double-publish* guard, not a dirty-draft guard. An autosave
   landing mid-gauntlet publishes a definition that never passed. This is the
   highest-value item in the phase.

4. **Phase 184 pre-authorized the seam rewrite.** `onPersist`, `onSaveDraft`,
   `draftIdRef`, `creatingRef` deliberately stayed on the 1656-line
   `WorkflowBuilderPage.tsx` — D-184-05 verbatim: *"Phase 186 rewrites exactly that seam
   for autosave — extracting it now would be churn against a seam about to move."* Same
   note at `builderStore.ts:50` and `:199`. G-5 on that file is satisfied by doing the
   extraction here.

</domain>

<decisions>
## Implementation Decisions

### Autosave trigger & cost

- **D-186-01 — One debounce rule, on any edit.** Any change to the definition schedules a
  PATCH ~500–1000 ms after the author stops typing/editing. One uniform rule, one timer,
  one writer. Reuses the shape already shipped twice: `VALIDATE_DEBOUNCE_MS = 500`
  (`frontend/src/hooks/useLiveValidation.ts:92`) and `CONFIG_COALESCE_MS = 500`
  (`frontend/src/components/workflows/builderStore.ts:88`). Rejected: split
  structural-immediate / config-debounced (two code paths, two failure modes);
  commit-points-only (leaves a long loss window open).
- **D-186-02 — Cosmetic edits never enter the autosave path.** The 184-07 browser-local
  `canvasNudge` module stays exactly as shipped. CONCUR-01's *"a cosmetic drag never
  mints a version"* must remain true **by construction** (the module imports neither the
  builder store, the canvas model, nor the API client), not by a rule someone has to
  defend. Do not route drag offsets through the new hook.
- **D-186-03 — Keep the explicit Save button; add a quiet status.** Autosave runs
  silently with a quiet `Saving… / Saved · just now` status line. Phase 184's explicit
  "Save draft" button survives as the deliberate *commit-now* affordance and keeps its
  `Saved ✓`. The unsaved-work leave guard (`UNSAVED_LEAVE_PROMPT` +
  `beforeunload`) survives too, but **changes meaning** — from *"you forgot to save"* to
  *"a write genuinely failed"*, which is exactly when it should fire. Nothing shipped and
  tested gets deleted.
- **D-186-04 — On a shape-invalid definition: hold the write and say why.** `PATCH
  /{definition_id}` takes a Pydantic `WorkflowDefinition`, so a mid-edit state can 422.
  When it does: **do not write**, keep the draft dirty, and state it honestly
  (`Not saved — <reason>`), never a false `Saved ✓`. Key on the server verdict already
  available: `useLiveValidation` runs `POST /workflows/validate` on the same 500 ms
  debounce and already models an `unreadable`/422 branch. This is the T-185-04-01 lesson
  applied — never file a receipt for something that did not happen.
- **D-186-05 — Extract `useDraftPersistence`.** One hook owns the whole seam:
  create-once-then-PATCH, the debounce timer, dirty/saved state, the concurrency token,
  the hold conditions, and the honest error branches. The page composes it and passes
  props down, exactly as it already composes `useLiveValidation`. Honours the D-184-05
  promise, keeps `WorkflowBuilderPage.tsx` a composition point, and gives the concurrency
  logic a single testable home. **Do not** widen the extraction to selection or
  validation wiring — that is churn against surfaces 185 just verified.

### Clobber guard mechanism

- **D-186-06 — Build for the reachable conflict, and say so.** The guard targets the same
  user across two tabs / two devices / a stale tab. The mechanism is **identical** either
  way — it keys on *"the row moved since I read it"*, not on *who* moved it — so this
  costs nothing in future-proofing. Adding a workflow org-share toggle is **out of scope**
  (new capability, migration + RLS rewrite + sharing UI). CONCUR-02's literal "two people"
  wording is recorded as currently-unreachable rather than quietly satisfied.
- **D-186-07 — Optimistic token = an OPAQUE string over `updated_at`.**
  `workflow_definitions.updated_at` already exists and is already bumped by the
  `set_updated_at` trigger on every UPDATE (mig 056). Serve it to the client as an opaque
  token; add `AND updated_at = $N` to the PATCH WHERE — 0 rows means someone else wrote.
  **Zero migrations** — the phase's no-migration promise holds.
  **HARD CONSTRAINT for the plan:** the client must echo the server's exact string
  verbatim and **never parse it into a JS `Date`** — ms precision would silently truncate
  Postgres microseconds and every save would 409. If research finds the round-trip cannot
  be made safe, the fallback is a `revision integer` column at migration slot **115** —
  which requires amending the zero-migration contract **in the open** (the 185-13
  precedent), never silently.
- **D-186-08 — On conflict: stop writing, honest banner, escape hatch.** The losing tab
  halts autosave immediately (no retry storm, no silent overwrite) and states plainly what
  happened — *"This draft was changed somewhere else. Reload to get the newer version, or
  overwrite it with what's on screen."* **Reload is the default; overwrite is a deliberate
  second click.** No work is trapped and no work is lost by accident. Satisfies SC#4 as
  written and mirrors the honest-refusal vocabulary Phase 185 established. Rejected:
  silent reload (relocates the clobber to the client); soft-lock (needs leases,
  heartbeats and expiry — materially more machinery than a token, and strands an author
  behind their own crashed tab).
- **D-186-09 — A stale token must never surface as 404.** Adding `AND updated_at = $N`
  creates a collision: 0 rows → `None` → the existing route maps it to
  **404 "draft not found"**, which is a lie; and 184-11 (D-184-16 debt 3) already spent
  the 409 slot on the published-row sentence. On 0 rows, **re-read the row owner-scoped**
  and branch on the real cause:
  - missing / not-owned → **404** (the existence-leak collapse stays closed)
  - `status = 'published'` → **409** `already_published` (today's sentence, unchanged)
  - row exists, token differs → **409** with a **distinct machine-readable code**
    (e.g. `stale_token`)

  The client branches on the code, **never on the prose**. Costs one extra query on the
  failure path only.

### Publish / dirty-draft guard (SC#3)

- **D-186-10 — Carry the token through the gauntlet; refuse on drift.** Capture the token
  at stage 0 and add `AND updated_at = $N` to the stage-5 flip
  (`publish_definition`, `backend/app/db/workflows.py:327`). If the draft moved, the flip
  matches 0 rows and publish returns an honest **new `blocked_stage`** — *"the draft
  changed while it was being checked — re-publish to check the new version"* — with the
  golden run and its `harness_audit` rows **preserved** as the real record of what was
  tested. Reuses the exact WR-03 sentinel shape already in `publish_definition`, and makes
  *"we published what we validated"* structurally true rather than merely likely.
  Rejected: a `publishing` freeze state (needs a release path on every crash/timeout/worker
  death; a stranded row is unrecoverable without an operator); publish-the-snapshot
  (silently discards later edits — a clobber wearing a different hat).
- **D-186-11 — The new `blocked_stage` needs NO migration.** Verified: `blocked_stage` is
  free-form **metadata** on the already-registered `publish_blocked` event type
  (`publish_service.py:_block`, `event_type="publish_blocked"`), and the API model types it
  as `blocked_stage: str | None` (`backend/app/api/workflows.py:760`). Unlike 185-13's
  `action_risk_pending`, this does **not** touch the `harness_audit` event_type CHECK.
  ⚠ It **does** need a worded verdict on the client — the Phase 127 energized pip-strip maps
  stages to sentences; a new stage without one falls through to a generic.
- **D-186-12 — Client holds writes while a publish is in flight.** Same
  hold-and-say-why mechanism as D-186-04, second reason: *"Publishing — changes will save
  when it finishes."* Edits accumulate as dirty and flush on resolution. This prevents the
  wasted golden run (minutes + real provider cost burned by one stray keystroke); the
  stage-5 token check (D-186-10) stays as the backstop that makes the guarantee
  **structural rather than cooperative**. One code path, two sentences.
- **D-186-13 — The SC#10 parallel-axis UAT is two tabs, same account, driven live.**
  Three browser-driven rows, all reachable in the product:
  1. **Two tabs** — same draft open twice; edit in A, then edit in B → B shows the honest
     banner and stops writing, never overwrites.
  2. **Stale tab** — leave a tab open, edit elsewhere, return later → same honest outcome.
  3. **Publish race** — start a publish, edit mid-gauntlet → honest refusal + the
     golden-run receipt preserved.

  The colleague-clobber row is recorded **⛔ with its reason** (blocked by owner-only
  UPDATE — see finding 2), **never silently dropped** — the scoreboard rule. An automated
  concurrent-PATCH backend test is worth having as well, but per **G-4** wire-format
  evidence alone is insufficient for a user-visible surface.

### BUG-260731-03 routing + KB binding (folded — see Folded Bugs)

- **D-186-14 — Split the blocking bug: control here, verdict in 187.** 186 folds the
  **minimum** fix — `project_folder_id` as an editable **workflow-level** setting on the
  built canvas, persisted through the very save path this phase is rebuilding. 187 keeps
  the **necessary** half: the deterministic build-time `/validate` `incomplete` verdict,
  which is validation-envelope work (SEED-132) and belongs with 187's SC#3
  safe-by-construction claim (the bug is a direct counterexample to it).
- **D-186-15 — The control is the existing header chip, promoted.** The builder header
  already renders a display-only `📁 Project Meridian — Risks` chip for a bound workflow —
  *visible, never editable*. Make it the picker: click to bind or re-bind, reusing the
  component that already exists at `WorkflowBuilderPage.tsx:1347-1367`. Show an **explicit
  unbound state** rather than rendering nothing. This is reachable from **all three**
  creation paths (NL generate, authoring fresh, forking a starter) because every one of
  them lands in the builder — and two of the three never offer the choice at all today.
  Rejected: a net-new workflow-settings panel (fires G-2 sketch-first; well beyond this
  phase's UI budget of a status line + a conflict banner).
- **D-186-16 — An invitation on the chip, never a verdict.** The unbound chip states the
  consequence plainly — *"No knowledge base · searches everything"* — as a neutral fact
  about configuration. **No severity, no code, no problems-tray row, nothing in the node
  marks.** Follows the `EMPTY_DRAFT_INVITATION` precedent exactly (D-184-15: *"an
  INVITATION, not a claimed verdict"*), so **D-182-06 stays intact** — the server still
  owns every verdict. Rejected: making binding mandatory at creation (a behaviour change
  to three flows and to whole-KB retrieval semantics, `scope.py` D-06 — that is a
  requirements change, not a bug fold).
- **D-186-17 — Correction to the bug's ordering constraint.** The report warns that a phase
  declaring `folder_scope` on an unbound workflow raises a raw Pydantic 422
  (`_folder_scope_requires_project`, `backend/app/models/harness.py:294`), and that the
  workflow-level binding must therefore be settable first. Verified: `folder_scope` is
  currently **read-only** in `PhaseFormPanel` (a bound display at `:347` / `:370-385`), so
  that dead end is **not reachable today**. It becomes reachable — and would combine badly
  with D-186-04's hold-the-write rule to produce a permanently-unsaveable draft — the
  moment any phase makes that field editable. **Carry this forward to whichever phase
  makes `folder_scope` editable.**

### Claude's Discretion

- Exact debounce constant within the 500–1000 ms band (align with the two shipped
  constants unless research shows a reason not to).
- Exact wording of the conflict banner, the hold sentences and the new `blocked_stage`
  verdict — the *content* is locked by D-186-08 / D-186-04 / D-186-12 / D-186-10; the
  phrasing is not.
- Whether `builderStore`'s currently-unread `saveState` slot earns its keep or is retired
  (`builderStore.ts:199` explicitly leaves this call to Phase 186).
- Whether the stale-token conflict uses 409-with-code or 412 Precondition Failed — the
  hard constraints are D-186-09's two rules (never 404; the two causes must be
  machine-distinguishable).

### Folded Bugs

- **`BUG-260731-03`** (severity `blocking`) — *A workflow's knowledge base can only be
  chosen on the pre-draft describe screen.* **Partially folded** into 186 per D-186-14:
  the author-time binding **control** (D-186-15) and the unbound **invitation** (D-186-16)
  land here; the deterministic build-time `/validate` verdict is routed to **Phase 187**.
  Frontmatter updated at this touchpoint: `status: folded`,
  `folded_into: "186 (control) / 187 (verdict)"`, with a `re_open_trigger` stating that it
  must **not** flip to `closed` when 186 ships — 186 closes only the repair path.
  Path: `.planning/reported-bugs/BUG-260731-03-no-ui-to-rebind-workflow-knowledge-base.md`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The blocking bug being folded
- `.planning/reported-bugs/BUG-260731-03-no-ui-to-rebind-workflow-knowledge-base.md` —
  the full investigation, including the two same-day updates: the bug reproduced within
  10 minutes on the same operator, and **the judge PASSED a worse deliverable than it
  failed** (11 files / 5+ folders vs 3 files / 3 folders). That second finding is why the
  deterministic check matters and why a probabilistic hard-wall is not a control for this
  failure mode. Read §"Suggested fix direction" and §3 (three entry points) before
  planning the control.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md:54-55` — CONCUR-01 / CONCUR-02 verbatim; `:77` OPEN-04
  (CRDT/OT explicitly cut).
- `.planning/ROADMAP.md` §"Phase 186: Concurrency & Autosave" (~line 291) — goal, the four
  success criteria, and the flags line; §"Guardrails firing (v3.6)" (~line 415) for the
  SC#10 parallel-axis scoping and the migration ledger (live head **114** after 185-13;
  next free slot is **115**).

### Persistence seam (the thing being rewritten)
- `frontend/src/pages/WorkflowBuilderPage.tsx` — the D-184-05 handoff docblock at `:80-121`
  ("Phase 186 rewrites exactly that seam"), `:250-262` (`UNSAVED_LEAVE_PROMPT`),
  `:530-545` (`draftIdRef` / `creatingRef` / `saveState`), `:1128-1188` (`onPersist` /
  `onSaveDraft`), `:1347-1367` (the KB picker to reuse), `:1634` (the `onPersist` consumer).
- `frontend/src/components/workflows/builderStore.ts:50`, `:88` (`CONFIG_COALESCE_MS`),
  `:190-201` (`dirty` / `markSaved` contract + the explicit "Phase 186 decides" note on
  `saveState`).
- `frontend/src/components/workflows/canvasNudge.ts:17` — the browser-local cosmetic
  offset that makes CONCUR-01 true by construction. **Must not be routed through autosave.**
- `frontend/src/hooks/useLiveValidation.ts:92` (`VALIDATE_DEBOUNCE_MS`), `:96`
  (`CHECKING_MIN_VISIBLE_MS`), and its `degraded`/`unreadable` branch — the 422 signal
  D-186-04 keys on.

### Concurrency & publish (backend)
- `backend/app/db/workflows.py:392-422` — `update_workflow_definition`, the owner-scoped
  draft-only UPDATE that gains the token clause; `:310-332` — `publish_definition` and the
  WR-03 sentinel shape D-186-10 mirrors; `:341-350` — `create_workflow_definition`'s
  server-enforced invariants.
- `backend/app/api/workflows.py:906-940` — the `update_draft` route and its current
  `CheckViolationError` → 409 / `None` → 404 mapping (D-186-09 changes this); `:760` —
  `blocked_stage: str | None`; `:789-807` — the publish route's status mapping.
- `backend/app/services/harness/publish_service.py:100-130` (stage 0 load + the
  `already_published` block), `:340-385` (the stage-5 flip and the WR-03 `-1` sentinel),
  `:396-421` (`_block` / `_safe_audit` — confirms `blocked_stage` is free-form metadata,
  hence **no migration**).
- `backend/app/models/harness.py:294-305` — `_folder_scope_requires_project`, the raw-422
  ordering constraint behind D-186-17.

### Why the org-share premise doesn't hold
- `supabase/migrations/111_is_global_retirement_rename.sql:7-21, 69-71` — D-165-01: folders
  and skills → `is_org_shared`; **`workflow_definitions` → `is_system_global`** (a platform
  flag, not a user share toggle).
- `supabase/migrations/108_rls_membership_rewrite.sql:484-500` — the four
  `workflow_definitions` policies; UPDATE is `auth.uid() = created_by`.
- `supabase/migrations/056_workflow_definitions.sql:16-30, 68-74` — the table, the
  `set_updated_at` trigger backing the token, and the immutable-on-publish trigger.

### Project rules that bind this phase
- `CLAUDE.md` §"Workflow guardrails" — **G-4** (lived-experience UAT: wire format +
  screenshot are insufficient), **G-5** (hot-file ledger — `WorkflowBuilderPage.tsx`),
  **G-6** (failure criteria upfront); §"UAT scoreboard recipe" — the "blocked, never
  silently omitted" rule applied by D-186-13.
- `CLAUDE.md` §"Reported bugs cross-check" — the `plan-phase` touchpoint requires every
  report with `folded_into: 186` to be covered by at least one plan task.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useLiveValidation` (`frontend/src/hooks/useLiveValidation.ts`)** — the composition
  pattern `useDraftPersistence` should mirror exactly: fetched in the page, handed down as
  props, debounced, with an explicit degraded branch. Also the *source* of the 422 signal
  D-186-04 gates on, and the constant (`VALIDATE_DEBOUNCE_MS = 500`) the autosave cadence
  should align to.
- **`builderStore`'s `dirty` / `markSaved()` (`builderStore.ts:190-201`)** — already the
  single source of "does the server copy differ from what's on screen", already re-armed
  by undo (D-184-03). Autosave becomes a second caller of the same contract, not a new one.
  Note the shipped warning: `markSaved()` clears `dirty`, so it must **not** be reused as
  the validation-enable signal (184-11 hit this).
- **The KB picker at `WorkflowBuilderPage.tsx:1347-1367`** — the exact component D-186-15
  promotes into the header chip. One control, two mount points.
- **`publish_definition`'s WR-03 `-1` sentinel (`db/workflows.py:310-332`)** — the shape
  D-186-10 copies: a WHERE-guard that matches 0 rows becomes an *honest block*, never a
  false success receipt.

### Established Patterns
- **Owner-scoped `$N`-only SQL.** Every workflow query self-scopes `created_by = $N`
  because the service role bypasses RLS — that WHERE is the only authorization boundary
  (T-103-01-01). The token clause is added **alongside** it, never in place of it.
- **404-collapse for existence.** Not-found and not-owned collapse to the same 404 with no
  existence leak. D-186-09's disambiguating re-read **must preserve this** — it may only
  distinguish causes for rows the caller already owns.
- **Honest refusal vocabulary (Phase 185).** A refusal states what happened and what the
  person can do; it never files a receipt for something that did not occur. D-186-04,
  D-186-08, D-186-10 and D-186-12 are all instances of this one rule.
- **Invitation ≠ verdict (D-184-15 / D-182-06).** The client may state a neutral fact about
  configuration; it may never compute a severity, code, or lint finding. D-186-16 rides
  this precedent.
- **D-14 red line.** The canvas stays a pure projection — no second source of truth. This
  is why "persist last-known-good" was rejected in D-186-04.

### Integration Points
- `PATCH /workflows/{definition_id}` — gains the token in the request and the
  disambiguated 404 / 409-published / 409-stale response (D-186-07, D-186-09).
- `POST /workflows/{definition_id}/publish` — gains the stage-0 token capture, the
  token-guarded stage-5 flip, and the new `blocked_stage` (D-186-10, D-186-11).
- The draft create/read responses must now carry the token so the client has one to echo
  (`DraftCreateResponse` currently returns `{id, version}` — `api/workflows.py`).
- `WorkflowBuilderPage.tsx` — loses the persistence seam to `useDraftPersistence`, gains
  the status line, the conflict banner and the promoted KB chip.
- The Phase 127 publish pip-strip / worded-verdict map — needs a sentence for the new
  `blocked_stage` (D-186-11).

</code_context>

<specifics>
## Specific Ideas

- **Reload is the default, overwrite is a second click.** The conflict banner must offer
  both, in that order. No work trapped, no work lost by accident.
- **The unbound chip should say the consequence, not the state** — *"No knowledge base ·
  searches everything"*, not *"Unbound"*. The operator's live evidence is that the failure
  is invisible precisely because "no specific knowledge base" sounds harmless.
- **One hold mechanism, two sentences.** D-186-04 (shape-invalid) and D-186-12
  (publish in flight) are the same code path with different copy. Do not build two.
- **Never a false `Saved ✓`.** Stated three separate times during discussion; it is the
  T-185-04-01 lesson (a green invariant guard that was scoped to the wrong thing) applied
  to this surface.

</specifics>

<deferred>
## Deferred Ideas

- **Workflow org-share toggle** (`is_org_shared` on `workflow_definitions` + RLS rewrite +
  sharing UI) — a new capability, its own phase. Re-open trigger: the first customer ask
  for a genuinely shared workflow, or when Dept-Admin (v3.4 carry-forward 169) lands.
  Until then CONCUR-02's "two people" wording is recorded as unreachable, not satisfied.
- **Real-time collaborative multi-cursor editing (CRDT/OT)** — already cut as **OPEN-04**
  in `.planning/REQUIREMENTS.md:77`. The soft-lock/token is the v3.6 answer.
- **SEED-138 — `definition` jsonb double-encoded (118/145 rows).** *Reviewed, not folded.*
  Autosave silently **heals on write**: `update_workflow_definition` already writes
  correctly (`json.dumps(...)` + `$N::jsonb`), so any draft an author touches is rewritten
  clean. The defensive `json.loads` at `publish_service.py:126` stays until a real
  backfill. No backfill in 186 — all `workflow_definitions` rows are test fixtures (free
  to delete/reseed), the seed is medium with no live impact, and a data migration is
  orthogonal to concurrency. **Re-open trigger:** the first non-fixture production rows,
  or any read path that cannot tolerate the defensive decode.
- **`BUG-260731-03` verdict half** — the deterministic build-time `/validate` `incomplete`
  verdict for an unbound retrieval workflow → **Phase 187** (SEED-132 envelope, SC#3
  safe-by-construction claim).
- **Making `folder_scope` editable per-phase** — out of scope here, but D-186-17 records
  the trap it will spring: an editable `folder_scope` on an unbound workflow raises a raw
  422, which under D-186-04's hold-the-write rule produces a permanently-unsaveable draft.
  Whichever phase makes it editable must land the workflow-level binding first and gate
  the per-phase control on it.
- **A dedicated workflow-settings panel** — rejected for 186 (fires G-2, exceeds the UI
  budget). Natural home if 187/189 add more workflow-level fields; the promoted chip
  becomes its entry point.

</deferred>

---

*Phase: 186-Concurrency & Autosave*
*Context gathered: 2026-07-31*
