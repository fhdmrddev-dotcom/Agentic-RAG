# Phase 187: Business Vocabulary + AI-Seeded Canvas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-01
**Phase:** 187-business-vocabulary-ai-seeded-canvas
**Areas discussed:** armed-gate fix shape (SC#6), derived node face (precedence + wording),
seed receipt (placement, dismissal, empty case), scope gap (/validate verdict half + SC#10 method)

**Mode:** default interactive. SPEC.md found (7 requirements locked) — discussion covered
implementation decisions only. Advisor mode off (no USER-PROFILE.md).

---

## Gray area selection

All four offered areas were selected. The template door (Req 6) was not offered as an area —
sketch 151-C locks its shape and the `initialDescribe` seam already exists — and was routed to
Claude's discretion with stated bounds.

Two findings were surfaced **before** the selection because they change scope:
1. The SPEC omits `BUG-260731-03`'s verdict half, which D-186-14 routed to this phase.
2. The SPEC's SC#10 method is unreachable — `harness_authoring_model` is env-only
   (`config.py:1164`; 2 non-cache grep hits across `backend/app`, `frontend/src`,
   `supabase/migrations`).

---

## The armed-gate fix shape (SC#6 / SEED-137)

**Evidence gathered before asking:** `test_185_engine_attachment.py:153-165` pins that the engine
seeds `phase_max_retries` **and** `on_failure` from `validators[0]` (WR-03) — so a prepend would
silently rebind the author's `max_retries: 7` to the armed spec's `0`. This is a measured defect
in option A beyond the ordering objection the ROADMAP recorded.

| Option | Description | Selected |
|--------|-------------|----------|
| C — explicit pre-body checkpoint | Hoist the armed check out of the validator list into a checkpoint keyed on `phase.action_risk_armed`, run unconditionally before the body. The only shape where the guarantee is a **property** rather than a position — what SPEC Req 7 locks. D-185-05's append untouched, so the 185 attachment test stays green as-is. | ✓ |
| B — re-run remaining pre-gates after Proceed | More faithful to "every declared gate is asked", fixes the general case. Cost: control-flow change on a path shared with non-armed workflows, plus a re-entrancy story; guarantee stays positional. | |
| A — graft the armed spec at index 0 | Cheapest. Rebinds the author's retry bound to `max_retries=0` (measured), skips the author's own pre-gate on Proceed, and leaves the guarantee positional — which Req 7 rules out. | |
| C now, B recorded as a deferred follow-up | Build C, record the broader "a Proceed skips every remaining pre-gate" hole with a re-open trigger. | |

**User's choice:** C — explicit pre-body checkpoint.

### Follow-up: checkpoint placement

| Option | Description | Selected |
|--------|-------------|----------|
| After pre-gates resolve, immediately before the body | A step an author's gate SKIPS never runs, so approving it would approve something that will not happen — and an approval receipt would exist for a step with no body. Accepted cost: an author `ask_user` Proceed followed by the armed checkpoint = two prompts in a row. | ✓ |
| Before any pre-gates run | Impossible to preempt by construction, but a person can approve a step a later gate then skips — the approval is spent on something that never runs. | |
| Both — ask before, re-confirm nothing after | Avoids the double-prompt, keeps the wasted-approval problem. | |

**User's choice:** After pre-gates resolve, immediately before the body.

### Follow-up: fate of the `action_risk_approval` ValidatorSpec

| Option | Description | Selected |
|--------|-------------|----------|
| Stop appending it; the checkpoint builds the sentence directly | No double-gate, no resolved-marker mechanism, `_is_action_risk_finding`'s string-prefix sniff deleted, `validator_index` arithmetic returns to its pre-185 shape (T-185-03-03's doubled gate row disappears). The armed reading becomes a boolean on the phase. | ✓ |
| Keep appending it as the finding producer | Closer to the ROADMAP's literal wording; existing audit/index accounting untouched. Needs a resolved-marker mechanism and keeps two readings of "armed". | |
| You decide at plan time | Lock the checkpoint shape, let research pick the seam, with exactly ONE reading of "armed". | |

**User's choice:** Stop appending it; the checkpoint builds the sentence directly.

**Notes:** Verified during this area — `_interactive_phase_failures` reads the **raw** definition
(`publish_service.py:196`), so armed phases were never caught by the publish interactive fence.
Dropping the append changes nothing there. The separate live hole this exposed was routed to the
scope area rather than asserted here.

---

## The derived node face — precedence + wording

**Three findings surfaced before asking:**
1. SPEC Req 1 and sketch 148-C disagree on precedence, and `folder_scope` being a subset of the
   single `project_folder_id` means folder-first collapses distinct steps into identical faces.
2. `folder_scope` / `skill_ref` store resolved UUIDs, not names; `skill_snapshot` is `None` on
   drafts; the template lives on the definition. A pure function of the phase alone cannot name
   anything. But `folderNames`/`skillNames` maps already exist (`PhaseFormPanel.tsx:126-128`) and
   `toCanvas` already has the `kbTools` injection precedent.
3. `phaseVocabulary.ts:123`'s docblock still carries the refuted "10 of 119" figure.

| Option | Description | Selected |
|--------|-------------|----------|
| Sketch 148-C order: skill → template → folder → human input | Most-specific-first. Folder-first would defeat SC#5 check 2, the phase's own falsifiable bar. Overrides SPEC Req 1's wording as a drafting slip. | ✓ |
| SPEC Req 1 order: folder scope → skill → template | Keeps the SPEC verbatim; in practice renders most steps in a workflow identically. | |
| Skill → template → folder, folder only when narrower than the workflow default | Strictly more specific, one more rule to hold. | |

**User's choice:** Sketch 148-C order.

### Follow-up: how the derivation gets real names

| Option | Description | Selected |
|--------|-------------|----------|
| Pass a name-lookup context in, exactly like `kbTools` | `nodeTitle()` gains a second optional parameter (folder/skill id→name maps + template filename). Absent ⇒ type sentence, never a fabricated or id-shaped name. The projection stays PURE; every existing caller renders byte-identically. | ✓ |
| Derive without names — "Run a skill" / "Search a folder" | No new parameter, but two steps with different skills render the same face — fails SC#5 check 2. | |
| Use `skill_snapshot.name` when present | No lookup needed, but it is `None` on drafts — the exact case that matters. | |

**User's choice:** Pass a name-lookup context in, exactly like `kbTools`.

### Follow-up: does the type subtitle survive a specific title?

| Option | Description | Selected |
|--------|-------------|----------|
| Always keep it — it answers a different question | Title = what THIS step does; subtitle = what KIND of step. One rule, no conditional, Req 4's swap always has something to swap. Measured redundancy confined to `llm_human_input` and `llm_emit`. | ✓ |
| Drop the derived tier for `llm_human_input` specifically | Removes the worst restatement without a render-time conditional. | |
| Suppress the subtitle whenever the derived tier resolved | Most compact card; card height then depends on which tier won, and the reveal adds a line rather than swapping one. | |

**User's choice:** Always keep it.

### Follow-up: which config edits demote a seeded name

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly the fields the derived tier reads | An edit demotes precisely when it could change the derived face. Stays correct automatically if the derivation gains a field. | ✓ |
| Any edit to the phase config at all | Simplest, but bumping `max_steps` would erase a good AI-written name. | |
| The SPEC's four fields, frozen as a literal list | Same behaviour today; drifts when the derivation changes. | |

**User's choice:** Exactly the fields the derived tier reads.

---

## The seed receipt

**Conflict surfaced before asking:** SPEC Req 5 demands the receipt render "from the server's own
verdict verbatim", but `/generate` returns only `{ok, definition}` — there is no verdict in it.
What Phase 185 shipped is server-supplied `kb_tools` with `groundingCauseOf` declared "THE ONE
CLIENT GROUNDING DERIVATION" over it.

| Option | Description | Selected |
|--------|-------------|----------|
| The shipped `groundingCauseOf` over server `kb_tools` | The safety-defining input is the server's and has one home; the client only renders it. Adding a second verdict channel would create two sources of truth — what D-182-06 forbids. Req 5 read as "never invent a REASON STRING client-side". | ✓ |
| Add a grounding verdict to the `/generate` response | Literal reading of Req 5. Costs a second server statement of a fact the canvas already derives, and covers only the seed path. | |
| You decide at plan time | Lock "exactly ONE grounding reading reaches this surface", let research pick the seam. | |

**User's choice:** The shipped `groundingCauseOf` over server `kb_tools`.

### Follow-up: placement and dismissal persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Above the canvas, in-memory dismissal, per draft | Sketch 150-B's placement. Does not reappear while you work; a reload re-shows it, which is honest since nothing was persisted. No storage key to go stale. | ✓ |
| Above the canvas, dismissal persisted per draft id | A reload does not bring it back. But a seeded draft is not persisted at generation time — there may be no id to key on. | |
| Inside the canvas as a floating panel | Spatially attached to the nodes it names; competes with the viewport and the toolbar. | |

**User's choice:** Above the canvas, in-memory dismissal, per draft.

### Follow-up: the zero-grounded-steps case

| Option | Description | Selected |
|--------|-------------|----------|
| Receipt still appears, without the grounded list | Orientation + "nothing is saved or published yet" are useful regardless; only the grounding paragraph is conditional. One component, one arrival behaviour. | ✓ |
| No receipt at all | Nothing to explain ⇒ noise. Costs the orientation and reassurance, and makes arrival behaviour unpredictable. | |

**User's choice:** Receipt still appears, without the grounded list.

---

## Scope gap

**Two findings verified before asking:** `effective_phase` has one call site
(`harness_engine.py:1339`) that the golden run also goes through, so an armed phase's checkpoint
fires inside a synchronous publish while `_interactive_phase_failures` reads the raw definition and
cannot see it. And `/validate` already aggregates the full static gauntlet including
`grounding_verdicts`, and already carries an `incomplete` severity.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold it — one new `incomplete` verdict in the existing `/validate` seam | KB-tool intersection with no `project_folder_id` ⇒ deterministic `incomplete`. One check on an existing seam. SC#3's counterexample closed. | ✓ |
| Re-defer with a concrete trigger | The bug's own trigger says it cannot close until both halves ship; the operator's live evidence stays unaddressed. | |
| Fold it, and also block the armed-phase golden-run hole | Both, in the same pre-run lint-class check. | |

**User's choice:** Fold it — one new `incomplete` verdict in `/validate`. (The armed-phase hole was
handled separately below, since this option did not include it.)

### Follow-up: SC#10 roster method

| Option | Description | Selected |
|--------|-------------|----------|
| Automated per-provider generation tests + one live restart row | All 8 rows via monkeypatched `settings.harness_authoring_model` with real `forced_emit` calls; one live row via a backend restart with `HARNESS_AUTHORING_MODEL` set, to prove the env path reaches the resolver. Blocked rows ⛔ with reasons. | ✓ |
| Live rows only — restart the backend per provider | Most faithful; eight restarts in one session, and still proves nothing about a knob no user can reach. | |
| Record the whole axis ⛔ blocked, cover the default model only | Honest and cheapest; leaves 7 of 8 rows unmeasured on the phase's headline feature. | |
| Add the knob to Settings / `app_settings` first | Closes the same defect class as `BUG-260731-01`; a scope addition the SPEC does not cover. | |

**User's choice:** Automated per-provider generation tests + one live restart row.

### Follow-up: disposition of the armed-phase golden-run hole

| Option | Description | Selected |
|--------|-------------|----------|
| Defer with a concrete re-open trigger | Trigger: whichever phase makes publish a background job (`publish_service.py:478-479`), or the first armed workflow publish. Keeps SC#6 scoped to the run, where the SPEC put it. | ✓ |
| Fold it — add `action_risk_armed` to the interactive fence | Same file, few lines; `/validate` picks it up for free. | |
| Report it as a new bug and leave 187 alone | Neither folds nor loses it. | |

**User's choice:** Defer with a concrete re-open trigger.

### Follow-up: G-5 audit on `WorkflowBuilderPage.tsx` (1810 L)

| Option | Description | Selected |
|--------|-------------|----------|
| Each new surface is its own component + one gated line | The shape CLAUDE.md's ledger praises from Phase 185 ("only 4 insertions reach the render body … keep this shape"). Satisfies G-5 without spending a phase on extraction. | ✓ |
| Insert a refactor phase before 187 | Strict G-5 reading; costs a whole phase when 185 already proved the by-construction route. | |
| Inline both surfaces in the page | Fastest; pushes the file past 1900 L and makes the next G-5 audit worse. | |

**User's choice:** Each new surface is its own component + one gated line.

---

## Claude's Discretion

- The exact derived sentence templates (`"Run the <skill>"` / `"Fill <template>"` /
  `"Search <folder>"`) — precedence and the never-fabricate floor are locked; phrasing is not.
- The provenance marker's field name and spelling on `PhaseSpec`.
- The receipt's exact copy, bounded by sketch 150-B's four load-bearing properties and the
  one-time seal arrival pulse.
- **The template picker's surface and seed sentence** (Req 6) — not discussed as an area; sketch
  151-C locks the shape, `initialDescribe` already exists as the seam, and a starter is identified
  by its phase **spine**, never one glyph (icon-convention §4 / finding #36).
- The per-step `name` wording in `AUTHORING_SYSTEM_PROMPT`.
- Whether `ValidatorSpec.kind`'s `"action_risk_approval"` literal is retained after D-187-03.

## Deferred Ideas

- The armed-phase / synchronous-publish hole (D-187-12) — trigger recorded.
- Per-node review state (✦ / ✓, sketch 150-C) — owes a placement and a meaning at publish.
- Filling `technicalLine` (sketch 149-B) — Phase 188's slot to spend.
- A direct template → canvas fork on the first screen (sketch 151-A/B).
- Making `harness_authoring_model` a real dynamic setting — linked to open bug `BUG-260731-01`.
- Making `folder_scope` editable per-phase — carries D-186-17's raw-422 trap forward.
- Suppressing the type subtitle when the derived tier resolves — re-open on live UAT evidence.

## Reported bugs cross-check (CLAUDE.md touchpoint)

Nine open `surface: Agentic-RAG` reports reviewed. **One folded** (`BUG-260731-03` verdict half,
D-187-11 — its frontmatter must be updated at plan-phase). Eight left `open` with reasons recorded
in CONTEXT.md `<deferred>` → "Reviewed Todos (not folded)". `BUG-260731-01` is flagged as the same
defect class as this phase's `harness_authoring_model` finding.
