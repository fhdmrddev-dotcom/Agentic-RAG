# Requirements: Agentic RAG — v4.3 What You Can Actually Sell

**Defined:** 2026-09-18
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Milestone goal:** turn a product that works into a product that can be **packaged, priced and
shipped to a client** — without touching the trust boundary.

---

## How this milestone was scoped — measured, not remembered

⭐ **Every requirement below was DRIVEN against the tree on 2026-09-18, not read from a seed's prose.**
That method is load-bearing here, because the sweep corrected **four** claims — one of them mine,
mid-measurement:

| Claim | Measured 2026-09-18 | Consequence |
|---|---|---|
| `max_tokens_per_run` is a cap that cannot bind | **FALSE — it CAN.** `harness_engine.py:1818` wires a real token source into `CircuitBreaker`, and the code's own comment says so explicitly | ⭐ **The gap is PERSISTENCE and USD, not counting.** `METER-*` is scoped to the rollup, not to instrumentation that already exists |
| `SEED-080`: "the v3.0 stub `_is_tier_pro_or_higher(user)` that returns True" | **Never built.** Zero matches in `backend/app`. It is a PRD artifact (`PRDs/v3.0.md`), not a code stub | There is **no stub to replace**. `TIER-01` builds the first one, greenfield |
| `subscription_tier` / `add_ons` are "unread" | **Exactly right, and stronger than stated** — zero matches anywhere in `backend/app`. They exist **only** in migration 104 | `TIER-*` is a pure greenfield read-path over columns that already exist |
| `MODEL_CAPABILITIES` might carry rate data | **No structured cost field.** One prose comment (`"$3-5/1M"`, `config.py:121`) and nothing else | `METER-01` builds the rate table; it cannot be derived from the roster |

**Also measured, and it is the shape of `METER-*`:**

| Piece | State at scoping |
|---|---|
| Chat token capture | ✅ counted and persisted to `runs.input_tokens` / `output_tokens` |
| Chat token capture on the **ask_user re-drive** and **continuation** paths | ⛔ **writes `input_tokens=None`** at `api/runs.py:677` and `:1331` — a run that paused for a question loses its count |
| Harness token capture | ⚠ **in-memory only** — the ceiling trips, nothing is persisted |
| `workflow_runs` token columns | ⛔ **zero** — migration 057 has none, no later `ALTER` adds any |
| `llm_emit` / `forced_emit` phases | ⛔ **uncounted**, already named at `harness_engine.py:1833` |
| Token → USD | ⛔ **nothing** — 0 files match `cost_usd`, `token_to_usd`, `spend_ledger`, `spend_cap` |

⛔ **`EXT-01` is this milestone's FIRST work item and it is a DECISION, not a feature.** `SEED-291`
says so in its own trigger. Its whole value is being written down *before* the first plausible
exception is proposed, and it costs a page.

---

## v4.3 Requirements

### Extension contract — what a plugin is permitted to be

`SEED-291`. The closed core (workflow executors, emitters, validators, programmatic functions, agent
tools) **is** the graded-governance product claim. A claim about what is *structurally impossible*
survives exactly zero exceptions, so a third-party executor does not weaken it — it deletes it.

- [ ] **EXT-01**: The extension contract is written down as binding project law — *a plugin is DATA,
      an EXTERNAL PROCESS, or SANDBOXED CODE, and never engine code* — in one durable home, naming
      the three permitted mechanisms and, explicitly, the things it **refuses**: third-party
      executors / emitters / validators, a generic HTTP egress node, and branching-or-looping
      workflow graphs as a plugin concern.
- [ ] **EXT-02**: A mechanical guard **fails** when an executor, emitter, validator, programmatic
      function or agent tool becomes resolvable from data, config, a database row or a user-supplied
      name — over the six `trigger_paths` `SEED-291` names. ⛔ Driven **RED against a planted
      violation** before it is trusted; a guard nobody has seen fire is not a guard.
- [ ] **EXT-03**: Each of the three permitted mechanisms has a named home and one worked example a
      third party could follow **without seeing engine code** (data → a skill / workflow definition /
      template; external process → `mcp_client.py`; sandboxed code → `sandbox_service.py`).

### Metering — cost becomes attributable

`SEED-073` + `SEED-074`. ⛔ **Nothing is priceable until cost is attributable**, and this is the
cheapest it will ever be: retrofitting cost attribution across a shipped plugin surface is materially
harder than building it before one exists.

- [ ] **METER-01**: A per-model cost-rate registry exists — input and output rate per model id,
      effective-dated so a repricing does not rewrite history. A model with **no** rate is
      **visible as unrated**, never silently free.
- [ ] **METER-02**: One token→USD conversion function, in one home, and every caller uses it. ⛔ A
      second conversion site anywhere is the fragmentation failure this requirement exists to prevent.
- [ ] **METER-03**: A workflow / harness run **persists** its token totals — `workflow_runs` gains
      token columns and the harness's existing in-memory box is rolled up at finalize.
- [ ] **METER-04**: Sub-agent token usage rolls up to the producer run instead of vanishing.
- [ ] **METER-05**: A chat run that paused for `ask_user` or was continued **keeps its token count** —
      the two `input_tokens=None` finalize sites at `api/runs.py:677` and `:1331` write real totals.
- [ ] **METER-06**: The `llm_emit` / `forced_emit` blind spot is **either counted or registered** —
      a named register entry with a re-open trigger. ⛔ It may not be left silently uncounted, because
      a spend figure with an unnamed hole in it is worse than no figure.
- [ ] **METER-07**: An operator can see spend in dollars per run and per org, and the view states
      **what it cannot see** (unrated models, any gap left open by `METER-06`).

### Entitlement — a tier becomes enforceable

`SEED-080` + `SEED-083`. The columns have existed since migration 104 and **nothing reads them**.

- [ ] **TIER-01**: ONE reusable entitlement check exists, in one home, reading
      `organizations.subscription_tier` + `add_ons`. Greenfield — there is no stub to replace.
- [ ] **TIER-02**: A capability map declares what each tier contains, **as data, not as branches** —
      so re-packaging is a row change and not a deploy.
- [ ] **TIER-03**: An entitlement refusal **names the tier that would allow it**. ⛔ Never a bare 403;
      a refusal a buyer cannot act on is a support ticket.
- [ ] **TIER-04**: A guard fails on a **second ad-hoc tier check** anywhere in the backend — the
      one-home rule enforced rather than asked for, before two implementations exist.
- [ ] **TIER-05**: The entitlement check **fails closed on an unreadable tier**, and that arm is
      driven. ⚠ Contrast `load_run_budget`, which fails **open** deliberately; these are opposite
      choices for opposite reasons and the difference is recorded, not inherited.

### Packs — an Expert becomes a thing you can ship

`SEED-198` — **the SKU**. An Expert is a **manifest over four subsystems that already ship**, not a
new agent type. ⛔ **No new executor. No expert-specific agent loop. No parallel dispatcher.** That is
`v3.6 D-14` verbatim, one subsystem over, and the moment an Expert has its own execution path this
requirement has failed.

- [ ] **PACK-01**: An Expert is a bundle row — name, description, member skills, required
      connections, knowledge scope, prompt suggestions, visibility — and **nothing executes it**. The
      existing agent loop executes; the Expert only decides what is in scope.
- [ ] **PACK-02**: An Expert is selectable in a chat thread and scopes that thread.
- [ ] **PACK-03**: An Expert ships its *"Try asking…"* prompts as the onboarding affordance.
- [ ] **PACK-04**: RLS applies to the **bundle AND to every member**, and the member check is **not**
      skipped because the bundle passed. ⚠ `SEED-125` was a **real** cross-org skill leak, not a
      hypothetical, and a bundle can leak a *folder reference* even when every skill in it is clean.
- [ ] **PACK-05**: One first-party Expert ships **end to end** — Financial Analyzer, because finance
      is where *answer from the documents or refuse* is most obviously correct. ⛔ If the slice is not
      valuable with one Expert, the feature is wrong and a directory of twelve will not save it.
- [ ] **PACK-06**: An Expert is gated by `TIER-01`. ⭐ **This is what makes a pack a SKU rather than a
      folder anyone can copy**, and it is why `TIER-*` sequences before `PACK-*`.

---

## Open decisions — named here so they are not decided by accident

⛔ **None of these is a requirement. Each is an operator decision that this milestone must SURFACE at
the right moment rather than resolve silently.**

1. **The pricing metric is a one-way door** (`SEED-294`). Per-seat, per-run, per-token, per-capability
   — choosing one shapes every surface after it. ⚠ `SEED-294` warns that *metrics get picked by
   accident when nobody names the moment*. **`TIER-02` is that moment**; it must ask before it
   encodes.
2. **Open Platform sequencing** (`SEED-013`). `PRDs/SEQUENCE.md`'s next unbuilt slot, and the
   **external-process arm of `EXT-01`'s own contract** — so it sequences inside or immediately after
   this milestone, never against it. **Not in scope unless the operator puts it there.**
3. **Does selecting an Expert RESTRICT the agent or merely BIAS it?** (`SEED-198` Q1.) Restriction is
   more honest in finance; bias is friendlier in general chat. This may be the strict/loose door
   again (Phase 124) — in which case the answer is *both, declared*.
4. **Can two Experts be active at once?** (`SEED-198` Q2.) Suspected **no**, and that "no" is a
   feature rather than a limitation.
5. **Is an Expert a thing you INSTALL or a thing you AUTHOR?** (`SEED-198` Q3.) Probably both —
   but **which ships first decides the whole UI**.
6. **`OV-248-01`** is contradicted by its own phase's verdict and is left `live` rather than flipped.
   Retire it or record why it stays. ⛔ Not a Claude decision.

---

## Future Requirements — deferred, with triggers intact

| Item | Why deferred | Re-open trigger |
|---|---|---|
| **`SEED-292` assurance export** — the evidence artifact a buyer can file | Offered at intake and declined. ~106 KB of eval machinery exists with no export path | The first procurement conversation, or the first client asking for evaluation evidence |
| **`SEED-293` competitive re-crawl** | Declined at intake. Record is 40 days stale and **missed Airia**, which markets our exact claim | ⛔ **Before any pitch, landing-page or README language claims novelty.** Nothing in this milestone may write *"nobody else does this"* |
| **`SEED-013` Open Platform** (REST API + MCP + service accounts) | Open decision #2 above | An operator decision to sequence it |
| **`SEED-120` per-org BYO provider keys** | Enterprise buyers ask for it by name and it moves model cost to the customer — but it needs `METER-*` first | `METER-07` shipping |
| **`SEED-225` an external step cannot attach a file** | Real at `smtp_adapter.py:289`. A workflow that produces a deliverable cannot deliver it | The first sellable workflow shape that ends in a document |
| **`SEED-129` / `SEED-091` residual service-role reads that bypass org scoping** | ⚠ A cross-tenant read found during a customer security review is a **rejected vendor**, not a bug report | The first customer security review, or any multi-org pilot |
| **`SEED-003` / `SEED-075` install UX + backup/restore** | The self-hosted and sovereign offering | A self-hosted deal |

---

## Out of Scope — explicit exclusions

| Item | Reason |
|---|---|
| Third-party executors, emitters or validators | ⛔ **Refused by `EXT-01`, permanently.** Destroys the governance claim by construction — not a sequencing decision |
| A generic HTTP egress node | The architecture exists to make arbitrary egress **unrepresentable**. If it ever arrives it is a separate phase type with its own gate story, never a fourth capability name on the existing one |
| Branching / looping workflow graphs | Milestone-sized, and it breaks resumability, reachability and the publish gate. Forward-only jumps are the minimal move if revisited. **Not a plugin question** |
| A billing integration / payment processor | `METER-*` makes cost **attributable**; charging for it is a separate decision behind the two operator blockers |
| Dollar amounts / a published price list | `D-PRD-10` deliberately defers amounts until buyer signal. This milestone builds the machinery, not the number |
| A public marketplace / partner portal | Needs a legal entity. Blocked upstream of engineering |
| The department axis of multi-tenancy (`SEED-004`) | The org door shipped in v3.4; departments are inert. Not needed for a per-org offering |

---

## ⛔ Two operator blockers gate every commercial route, and neither is engineering

Per `SEED-294`, stated here because they get harder to unwind as the work compounds:

1. **No legal entity exists.** No accelerator, sponsor or client contract is reachable without one.
2. **The employment / IP position is unsettled.** The operator works in Digital Transformation at a
   firm serving a similar buyer set in the same market, so ownership, permission to commercialise and
   customer overlap need **written** certainty from a lawyer *before* anyone is approached.

⚠ **Neither blocks a single requirement above. Both block approaching anyone.**

---

## Carried in from v4.2 — not feature work, and not scoped here

- **`DEBT-06`** — three drafted refusals at `phases/25{1,2,3}/*-REVIEW-REFUSAL.md` await an operator
  ruling or a Gemini review by **2026-09-24**. ⛔ A refusal is not a pass.
- **`F-1`..`F-4`** — four one-line register repairs, including `254`'s **own** unparseable
  verification frontmatter and two duplicate-id clusters in `.planning/reported-bugs/`, a register
  **no gate sweeps**.
- **Two live criticals in `251-REVIEW.md`** — both guards that cannot fail (`--self-test` passes 8/8
  with no arm for its own missing-key check; the `status:` enum rule has zero executable enforcement).
- **`SEED-290`** (253's 13 unfixed review findings) · **`SEED-287`**.
- **The unswept seeds**, as two figures ⛔ **never summed**: **134 carry no `trigger_when` at all** ·
  **114 carry prose the sweep cannot match**. Register gate green at **301/301 parsed, 0 duplicate
  ids**.

---

## Traceability

*Filled by the roadmapper 2026-09-18 — every REQ-ID maps to exactly one phase.*
**Coverage: 21 / 21 mapped · 0 orphans · 0 duplicates.** Phase detail: `.planning/ROADMAP.md` →
*v4.3 What You Can Actually Sell*.

| REQ-ID | Phase | Status |
|---|---|---|
| EXT-01 | Phase 255 — The Extension Contract | Pending |
| EXT-02 | Phase 255 — The Extension Contract | Pending |
| EXT-03 | Phase 255 — The Extension Contract | Pending |
| METER-03 | Phase 256 — Every Token Is Counted And Kept | Pending |
| METER-04 | Phase 256 — Every Token Is Counted And Kept | Pending |
| METER-05 | Phase 256 — Every Token Is Counted And Kept | Pending |
| METER-06 | Phase 256 — Every Token Is Counted And Kept | Pending |
| METER-01 | Phase 257 — Cost in Dollars, and What It Cannot See | Pending |
| METER-02 | Phase 257 — Cost in Dollars, and What It Cannot See | Pending |
| METER-07 | Phase 257 — Cost in Dollars, and What It Cannot See | Pending |
| TIER-01 | Phase 258 — A Tier Becomes Enforceable | Pending |
| TIER-02 | Phase 258 — A Tier Becomes Enforceable | Pending |
| TIER-03 | Phase 258 — A Tier Becomes Enforceable | Pending |
| TIER-04 | Phase 258 — A Tier Becomes Enforceable | Pending |
| TIER-05 | Phase 258 — A Tier Becomes Enforceable | Pending |
| PACK-01 | Phase 259 — An Expert Is a Bundle, Not a Runtime | Pending |
| PACK-04 | Phase 259 — An Expert Is a Bundle, Not a Runtime | Pending |
| PACK-06 | Phase 259 — An Expert Is a Bundle, Not a Runtime | Pending |
| PACK-02 | Phase 260 — The Expert You Can Actually Use | Pending |
| PACK-03 | Phase 260 — The Expert You Can Actually Use | Pending |
| PACK-05 | Phase 260 — The Expert You Can Actually Use | Pending |

⚠ **The `METER-*` rows are NOT in id order, and that is deliberate.** `METER-03/04/05/06` are one
delivery boundary — *a token that was spent is written down* — and `METER-01/02/07` are another — *a
written-down token has a price someone can read*. Mapping by id order would have put the rate registry
in a phase with nothing persisted to price.

⛔ **The six open decisions above are NOT requirements and appear in no row.** Each is surfaced at a
named phase — #1 pricing metric → **258** (`TIER-02`, the one-way door) · #2 Open Platform → **255** ·
#3 restrict-vs-bias and #4 two-at-once → **259** · #5 install-vs-author → **260** · #6 `OV-248-01` →
**255**.

⛔ **The v4.2 carry-ins (`DEBT-06`, `F-1`..`F-4`, the two `251-REVIEW.md` criticals, `SEED-290`,
`SEED-287`, the unswept seeds) are mapped to NO phase, deliberately.** They are not v4.3 requirements,
and mapping them would let this milestone's success criteria absorb another milestone's debt. They stay
open on their own registers with their own triggers.
