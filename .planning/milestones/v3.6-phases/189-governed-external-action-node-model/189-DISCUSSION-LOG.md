# Phase 189: Governed External-Action Node Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 189-governed-external-action-node-model
**Areas discussed:** G-5 routing (gate), Node structure, No-live-egress at run time, Decision record, Node face & governance marks

---

## G-5 Routing (guardrail gate, asked before any gray area)

Surfaced first per the orchestrator protocol — G-5 fires on `PhaseNodeCard.tsx`, measured at
**797 L across 4 distinct phases** (184, 185, 188, 188.1) rather than read off the ledger.

| Option | Description | Selected |
|--------|-------------|----------|
| Insert refactor phase 188.2 first | Dedicated behaviour-preserving extraction before the feature phase, the 188.1 shape | ✓ |
| Fold a bounded extraction into 189 as Wave 0 | One phase; mixes refactor and feature in one charter | |
| Proceed as-is, override recorded | Skip the refactor, record the override in STATE.md | |

**User's choice:** Insert 188.2 first.
**Notes:** The foil that argued against folding is 188's own history — it honoured its G-5 budget
by measurement (13 ins / 2 del vs a ≤15/≤4 cap), which capped the diff without reducing the file,
and 188.1 had to exist as a result. `BUG-260806-01` is a natural fold into 188.2.

---

## Node structure

| Option | Description | Selected |
|--------|-------------|----------|
| A 7th `phase_type`: `external_action` | Additive discriminated-union member, the `llm_emit`/101.1 path | ✓ |
| Config on the existing `llm_agent` | MCP tool name in `available_tools`; smallest diff | |
| A `programmatic` registry entry | Closed named operation, deterministic, no LLM | |

**User's choice:** A 7th `phase_type`.
**Notes:** Decided against config-on-`llm_agent` because it makes "external action" invisible in
the schema — the canvas would infer the node's nature from a tool-name string, the exact inference
the 187 face ladder exists to remove. `programmatic` was ruled out on authoring surface: those
phases are internal engine operations with no author-facing config.

| Option | Description | Selected |
|--------|-------------|----------|
| Named capability from a closed set | Closed server-known list; 190 binds each to a real MCP server | ✓ |
| One generic "external action" node | Free-text intent; specific action binds in 190 | |
| Author names the MCP server + tool | Most faithful to "MCP-backed" | |

**User's choice:** Named capability from a closed set.
**Notes:** The MCP-identifier option was weakened by a measured fact — there is **zero MCP code in
the backend**, so nothing could reject a typo until 190.

---

## Governance rails

| Option | Description | Selected |
|--------|-------------|----------|
| The capability IS an entry in `available_tools` | Rides `resolve_phase_available_tools` (D-08) + `_TOOL_REGISTRY` | ✓ |
| A separate capability field + parallel guard | Cleaner separation of concerns | |
| Both — mirrored server-side | Nicest authoring surface | |

**User's choice:** The capability IS an entry in `available_tools`.
**Notes:** Makes SC#1 literally true rather than approximately true. The mirrored option was
rejected on the project's own drift history (two representations of one fact).

| Option | Description | Selected |
|--------|-------------|----------|
| Armed and NOT disarmable on this node type | Structurally true; matches "cannot be wired around a gate" | ✓ |
| Armed by default, author may disarm | Consistent with the graded-governance philosophy | |
| Armed only for capabilities marked high-risk | Genuinely graded, mirrors the grounding dial | |

**User's choice:** Armed and NOT disarmable.
**Notes:** Independently corroborated after the fact — sketch 144 (Phase 185) had already reached
*"the unarmed outbound step on screen argues armed-on by default (= 189 SC#2)"*. The decision
matches the design record rather than inventing against it.

---

## What "no live egress" looks like at run time

| Option | Description | Selected |
|--------|-------------|----------|
| Record the intended action, continue | Structured record as output; 190 swaps the no-op behind an unchanged seam | ✓ |
| Stop with an honest "not connected yet" refusal | Maximally honest; workflow can never complete | |
| Skip the step, mark it not-run | Keeps whole-workflow demos working | |

**User's choice:** Record the intended action, continue.
**Notes:** Skip was argued against as the fail-open shape Phase 188 spent two plans closing
(`finalizeAllPhasesForThread` sweeping `pending` → `done`), which would also make the arming
decorative.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — it publishes, node's state visible | Real shippable slice; 190 upgrades a live workflow in place | ✓ |
| No — gauntlet blocks until a connector exists | Nobody ships a workflow whose external step does nothing | |
| Publishes, but the run refuses to launch | Fails fast and early | |

**User's choice:** Publishes, with the node's state visible.

| Option | Description | Selected |
|--------|-------------|----------|
| Its own worded phase status | Distinct from passed/done at every surface | ✓ |
| Standard done, honesty in the payload | Zero schema change | |
| Both — payload now, worded status in 190 | Keeps 189 migration-free | |

**User's choice:** Its own worded phase status.

| Option | Description | Selected |
|--------|-------------|----------|
| Phase output only — no new audit event | Honours the no-migration flag; `action_risk_pending` already records the approval | ✓ |
| Also a new `harness_audit` event (migration 115) | Strongest operator story | |
| Defer the audit receipt to 190 | Cleanest ledger semantics | |

**User's choice:** Phase output only.

### Follow-up: the status/migration collision (surfaced mid-area, not deferred)

The worded-status choice collided with 189's "no migration" flag. Measured:
`workflow_phases_status_check` caps `status` at five values, so a 6th is migration 115. Put back
to the operator as an explicit fork rather than resolved silently.

| Option | Description | Selected |
|--------|-------------|----------|
| Migration 115 — persist the 6th status | Amend the flag, on the Phase 185 / migration 114 precedent | ✓ |
| Derive at render, column stays `completed` | Zero migration; the 188 "State unknown" precedent | |
| Reuse the existing `skipped` status | No new value | |

**User's choice:** Migration 115.
**Notes:** The 185 precedent's recorded reasoning transferred word for word — *"the zero-migration
promise was a scoping convenience; the honest-pause vocabulary is a correctness property."*
`skipped` was rejected as lying in a different direction: the step did run and a human did approve.

---

## Where the own-vs-Open-Platform decision lives

| Option | Description | Selected |
|--------|-------------|----------|
| A doc under `docs/` + a D-entry in `prd-reset/DECISIONS.md` | Reasoning in the doc, citability in the register | ✓ |
| Only a D-entry in DECISIONS.md | One home, no duplication | |
| Update SEED-013 + SEED-014 in place | Keeps the connector story in one narrative | |

**User's choice:** Doc + D-entry.
**Notes:** Seeds were rejected as a home because they are a dormant backlog with re-open triggers —
a decision buried in one reads as still-pending.

| Option | Description | Selected |
|--------|-------------|----------|
| Record it, with a dated re-open trigger | The deep crawl already reached the verdict | ✓ |
| Re-validate against the current MCP ecosystem | The verdict dates from 2026-07-24 | |
| Record as provisional, decide in 190 | Honest about what has been tested | |

**User's choice:** Record with a dated re-open trigger.
**Notes:** "Provisional" was argued not to satisfy an operator HARD gate.

---

## The node's face and its governance marks

Before this area, the `sketch-findings-agentic-rag` skill was loaded rather than paraphrased (the
standing rule after four icon drifts came from paraphrasing the manifest), and the badge budget was
then verified in `PhaseNodeCard.tsx` itself rather than taken from the ledger.

| Option | Description | Selected |
|--------|-------------|----------|
| Spend slot 1 on the not-yet-connected state | Carries what the card cannot otherwise say; retires when 190 lands | ✓ |
| Spend it on the armed-for-approval state | Most consequential fact on the card | |
| Spend nothing — keep slot 1 free | Most conservative reading of the enforced budget | |

**User's choice:** The not-yet-connected state.
**Notes:** The shipped docblock confirmed 189 holds the **last** free word-badge (*"188 spends ZERO
badge slots: slot 1 is still empty and still reserved for Phase 189"*). Armed-state was argued
against as invariant for the type — and 185 set the precedent by spending no badge at all on
governance, using the corner seal instead.

| Option | Description | Selected |
|--------|-------------|----------|
| Config-derived from the chosen capability | Tier 2 of the 148-C ladder, computed at render | ✓ |
| One fixed type sentence for all external actions | Simplest, honest at the type level | |
| Technical capability name as title, sentence beneath | Most precise | |

**User's choice:** Config-derived from the chosen capability.
**Notes:** The fixed-sentence option reproduces the measured VOCAB-02 failure (only 10 of 119
phases carry a `phase.name`, so the generic sentence is what users see). The technical-title option
inverts 149-C, which puts the meaningful plain title first and swaps only the subtitle.

---

## Claude's Discretion

- The exact membership and naming of the closed capability set — constrained to align with 190's
  email / JIRA / Slack slice and to stay disjoint from `KB_TOOLS`.
- The exact status word (D-07) and badge word (D-12), constrained by the recorded vocabulary rules.
- The 7th `PHASE_GLYPHS` entry — mechanical under the single-source icon convention.

## Deferred Ideas

- A `harness_audit` event for the recorded intent → Phase 190 (trigger: the first live outbound call).
- An escape hatch to disarm action-risk on a low-consequence action → Phase 190 (trigger: real
  usage showing an external capability whose consequence does not warrant approval).
- A per-capability risk taxonomy — no egress exists in 189 to calibrate risk against.
- Who may extend the closed capability set, and how → with 190's credential/org-scoping work.
- How 190 swaps the no-op for a real call without re-authoring → a 190 planning concern.
- **Reviewed, not folded:** `spike-nl-workflow-authoring.md` (todo match, score 0.6 on generic
  keywords) — NL authoring is Phase 187's shipped territory, no genuine overlap.

---

# Refresh session — 2026-08-07

**Trigger:** `/gsd:discuss-phase 189` re-run after Phase 188.2 shipped. `check_existing` found an
existing CONTEXT.md; the operator chose **"Update it"** over a fresh discussion, and D-01…D-13 were
kept locked as written. No decision changed. What changed was measurements and file pointers.

## Area: What 188.2 invalidated

**Options presented:** Update it / Update it + reopen specific decisions / View it / Skip to planning.
**User's choice:** Update it — targeted refresh, decisions stay locked.
**Notes:** The `<gate>` block's whole premise ("188.2 ships FIRST") was discharged. Rather than
delete it, it is preserved as superseded wording with a then/now table — the same convention the
ROADMAP used when it amended 189's own no-migration flag. Measured: `PhaseNodeCard.tsx` 797 → 274 L;
`BUG-260806-01` closed by 188.2 on a driven row with a falsification control.

## Area: Re-verification rather than inheritance

**Notes:** Every load-bearing measurement behind D-01…D-13 was re-executed, not carried. Six held
(the 5-value status CHECK at `full-schema.sql:1932`; migration 115 still free with 114 as live head;
the 6-member `PhaseConfig` union; the badge-slot-1 reservation; the max-2 tuple; the claimed
top-right corner). **Two were false.**

1. `PhaseNodeCard.tsx` at 797 L / G-5 firing — false *because of* 188.2. Expected.
2. **`PHASE_GLYPHS` in `phaseVocabulary.ts` — false, and false BEFORE 188.2 moved anything.** The
   glyph map is `soulData.ts:43` (6 entries), resolved by `lib/phaseGlyph.tsx`. `phaseVocabulary.ts`
   holds the per-type *label/sentence* maps, which is how the two got conflated. This is the same
   drift class 188.2 found in four `icon-convention.md` pointers, three of which were also already
   wrong. **The lesson generalises: a wrong pointer written into a CONTEXT survives every gate,
   because nothing typechecks prose.**

The refresh also strengthened D-12 rather than restating it: the slot-1 reservation survived the cut
and is now asserted in five source files and guarded by two live test suites, and the max-2 budget
gained an `@ts-expect-error` control observed RED at 34 type errors and green at 33.

## Area: Reported-bugs cross-check (mandatory touchpoint)

Filtered to `status: open` + `surface: Agentic-RAG` with `affected_areas` overlapping 189's domain.
Three candidates surfaced.

**`BUG-260807-01`** — `verticalOffsetFor` is an unguarded WR-04 sink; a prototype-key slug returns
`NaN`, which invalidates the `translate()` on the three elements 188.2 just gave `zIndex 1002`, so a
mispositioned affordance now lands *above* the cards.

**Options presented:** `/gsd:fast` before 189 / fold into 189 / leave open and defer.
**User's choice:** `/gsd:fast` now, before 189.
**Notes:** ⚠ **This diverges from the bug report's own "Suggested routing", which proposed folding
it into 189 as "a natural, cheap rider" — recorded because a later reader will find the two in
conflict.** The operator's routing is better supported by the sizing: one file, one import, two call
sites, no schema and no API surface — G-3 territory. It is 188.2's residue and degrades a fix 188.2
just shipped, so it does not belong on 189's ledger. Captured as **D-14** with the two constraints
the fixer must honour (the `editAffordance.ts` LEAF fence must be re-read not assumed; **jsdom
cannot see this defect**, so the regression check is a driven Chrome MCP row) and the second sink
from the same sweep, `lib/providerLogo.tsx:107-108`.

**`BUG-260730-02`** (emit gate reports citations when citations were perfect) and **`BUG-260731-01`**
(judge-model knob may be inert) — both `workflows/publish-gauntlet`.

**Options presented:** leave open + note in `<deferred>` / fold 260730-02 / fold both.
**User's choice:** leave open, note in `<deferred>` with re-open triggers.
**Notes:** Both are emit-gate/judge defects, not external-action-node defects. D-06 only requires
that a workflow containing the node not be *blocked* from publishing, and neither bug changes that.
Concrete re-open triggers recorded for each, per the standing rule that no deferral ships without
one. `BUG-260609-02` was reviewed and found to have no overlap.

## Deferred Ideas added this session

- 188.2's two owed manual UAT rows ride into 189 as *look-while-you're-there* items, not blockers:
  **row A2 ⛔** needs a live run (189 will launch live runs under D-06 — run it on the first one),
  and **row A1's subjective visual half** is one glance at a Builder card.
- New landmines recorded for planning: the subtree GREW +67.1 % (797 → 1332 L) so 189 should fill an
  existing slot rather than add a sixth module; the count gate's `failed` column is not a regression
  backstop on this machine (`D-188.2-DEF-01`); the app has no URL router.

---

# Operator discussion — 2026-08-07 (session 2)

**Trigger:** the operator declined to route straight to `/gsd:plan-phase 189` — *"I think the next
phase should be discussed not planned directly"* — after `/gsd:fast` closed the BUG-260807-01 code
half. Since discuss-phase had already run twice, this session was not context-gathering: it was the
operator pressure-testing decisions someone else had locked, plus closing the two wording items
CONTEXT had left to Claude's discretion.

**Framing used:** plain language first (what the node IS, what it deliberately does NOT do), then
the strategic risk stated openly BEFORE any option list — that 190 is STRETCH and gated, so there
is a real path where 189's node never sends at all and its user-visible value is a step that says
*"I would have emailed Sarah"* and doesn't. Surfacing that was the point of the session; a
discussion that only lists implementation options cannot reach it.

## Area: the 189/190 split

**Options presented:** keep the split / merge 189+190 / promote 190 out of STRETCH first / explain
the risk before choosing.
**User's choice:** keep the split as scoped.
**Notes:** The counter-case was stated rather than hidden — merging would pull in the full 190
threat model (SSRF, org-scoped credentials, the n8n "guarded only when a credential is attached"
CVE class), which is the highest-risk surface in the milestone. Doing the governance work while
there is nothing to leak is the cheap moment. **No ROADMAP change.**

## Area: the closed capability set (was Claude's discretion → now D-15)

**Options presented:** email + ticket + message / email only / add a fourth.
**User's choice:** all three — `send_email`, `create_ticket`, `post_message`.
**Notes:** Locks the operator's alignment rule literally — nothing is built here that 190 cannot
later make real. A fourth capability would ship a node that can never be connected. The `KB_TOOLS`
disjointness check (D-03) must now be verified against three concrete names at planning.

## Area: the approval gate

**Options presented:** always armed / armed-but-disarmable / per-capability.
**User's choice:** always armed, no escape hatch.
**Notes:** **The point of asking was to move the cost onto the operator's ledger.** D-04 was
carrying a real usability cost (even a harmless external action needs a human click) on Claude's
reasoning alone; it now carries an operator decision. The alternatives were shown with their true
price: disarmable would require ROADMAP SC#2 to be rewritten, and per-capability was already
deferred by CONTEXT because 189 has no real egress to calibrate risk against.

## Area: the recorded architecture decision (SC#3)

**Options presented:** record the existing verdict / re-validate first / drop it from 189.
**User's choice:** record it, do not re-research.
**Notes:** The 2026-07-24 Beam/Glean/n8n crawl stands; 189 writes it down with a dated re-open
trigger. SC#3 stays in the phase.

## Area: the run-time status word (was Claude's discretion → now D-16/D-17)

**Options presented, each with a rendered preview across all three surfaces:** "Not sent —
recorded" / "Would have sent" / "Simulated" / "Recorded only".
**User's choice:** **"Not sent — recorded"**.
**Notes:** Outcome first, consolation second. Previews were used deliberately because this word
lands on three different surfaces and reads differently beside `Done`/`Failed` than it does alone.

**⚠ A TECHNICAL DISTINCTION WAS RAISED BEFORE THE ANSWER WAS RECORDED, and it became D-17:** the
persisted value and the rendered word are different things. Migration 115 adds the SLUG
`recorded_not_sent` — matching the shape of the five literals already in
`workflow_phases_status_check` — and the em-dash sentence is what the vocabulary layer renders.
Writing display prose into a CHECK constraint would put an em-dash in the database, break the
column's shape, and make the wording un-editable without a second migration. Flagged here because
the operator's answer was a SENTENCE and a planner could reasonably have taken it literally.

## Area: the last badge slot (was Claude's discretion → now D-18)

**Options presented, with before/after previews showing the badge retiring when 190 lands:**
"Not connected" / "No destination" / "Won't send yet" / spend no badge at all.
**User's choice:** **"Not connected"**.
**Notes:** The "spend nothing" option was shown honestly with its real cost — 185's precedent is
genuine, but the preview made visible that the card would look IDENTICAL before and after 190,
so a user could not tell from the canvas whether a step will really send or quietly record.

## Nothing deferred this session

No scope creep was raised. The `<deferred>` register is unchanged from the 2026-08-07 refresh.
