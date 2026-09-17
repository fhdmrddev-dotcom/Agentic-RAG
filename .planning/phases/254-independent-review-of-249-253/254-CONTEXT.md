# Phase 254: Independent review of 249-253 - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning

<domain>
## Phase Boundary

For each of **249, 250, 251, 252 and 253**, this phase produces **either a review by an agent that
did not build it, or a written refusal naming who decided and why** — and leaves every register
readable afterwards.

⛔ **This is a REVIEW phase, not a build phase.** It ships findings and a routing for them. It does
not ship fixes, and it does not ship a new user-facing capability — that is a phase, not this one
(G-7 / G-3).

⛔ **Claude built all five.** A claude-run pass over them is a *self-assessment* under `AGENTS.md`
§6.3 and must be labelled as one wherever it appears. It improves quality; it discharges nothing.

</domain>

<decisions>
## Implementation Decisions

### Scope of the review set

- **D-01: The set is exactly 249, 250, 251, 252, 253.** Operator decision, 2026-09-17. The older
  owed set — **238 / 240 / 241 / 242-246** — is explicitly NOT in this phase and stays visible as
  `BUS-252` (245), `BUS-253` (241), `BUS-254` (242), `BUS-255` (244). ⛔ A plan that widens this to
  ten phases has widened the phase.
- **D-02: `DEBT-06`'s text is amended to name every phase that actually carries
  `independent_review: owed`, re-derived from the `*-VERIFICATION.md` files rather than re-typed.**
  Today `REQUIREMENTS.md:185` reads *"Phases **238, 240, 241** and **242-246**"* — measured, that
  sentence does not name a single phase this milestone built, so **reviewing 249-253 ticks none of
  `DEBT-06` as worded.** The requirement is being used to mean *"every owed phase"*; the amendment
  makes it say that.
- **D-03: The amendment does NOT let this phase tick `DEBT-06`, and the phase must say so.**
  Once amended, the requirement covers ten phases: 254 closes its **249-253 arm**; the **238/240/241
  + 242-246 arm stays owed**. `DEBT-06` becomes tickable when both arms are — not at this close.
  ⛔ Ticking it here would be exactly the claim `ROADMAP.md:271` forbids.

### Completion — what happens when the reviewer stays silent

- **D-04: Time-boxed, then a written refusal.** Gemini has until **2026-09-24** (7 days from
  2026-09-17). Any phase still unanswered at that deadline closes with a **written refusal** naming
  the operator as the decider and the reason — the door `DEBT-06` itself offers.
  ⭐ **The reason this is not "block until Gemini answers": the phase would have no completion
  condition it controls.** The five asks were filed 2026-09-16 and none has moved; Gemini holds
  **9** open bus items.
- **D-05: A refusal is drafted by Claude and becomes real only on an operator ruling.** Claude
  prepares the per-phase draft with the evidence and the reason; the operator decides. ⛔ `REG-03`:
  **Claude may not close bus items.** A refusal written by the builder about its own work is the
  self-assessment §6.3 exists to prevent.
- **D-06: The five existing bus asks are AMENDED IN PLACE with the deadline and the rank — never
  re-filed.** `BUS-251` (249), `BUS-250` (250), `BUS-249` (251), `BUS-256` (252), `BUS-257` (253).
  ⛔ A duplicate ask is how a 9-item queue got to be 9 items.

### Depth and order

- **D-07: Risk-ranked, not uniform. The order is `251 → 253 → 252 → 249 → 250`.**
  - **251 first** — measured: it is the only one of the five with **no review file of any kind**.
  - **253, then 252** — security-bearing (credential boundary, privilege model, greenfield ACLs);
    `AGENTS.md` §3.1's critical tests apply to them and to no other phase in this set.
  - **249, then 250** — each already carries a claude code-review pass, so what is missing is
    **independence**, not a first reading.
- **D-08: 251 gets a claude `/gsd:code-review 251` pass as a QUALITY FLOOR, labelled
  `self-assessed`.** ⛔ It does not tick `DEBT-06` and the refusal (if one is written) must say so.
  ⭐ Its purpose is that **no phase of v4.2 ships wholly unread** — and this instrument has a
  measured catch rate here: it found 2 blockers on 249 (`BUS-247`) and 2 criticals on 253, each
  past a green self-verified close.

### Artifacts and registers

- **D-09: Each verdict lands in the REVIEWED phase's own directory**, not in 254's:
  `<phase>-REVIEW-IND.md` for a review, `<phase>-REVIEW-REFUSAL.md` for a refusal.
  ⛔ Do NOT overwrite the existing `*-REVIEW.md` / `*-REVIEW-R2.md` files — 253's workflow step was
  measured to want to clobber `253-REVIEW.md` and was deliberately routed around. 254's own
  directory holds the **index** and the **routing**, nothing else.
- **D-10: Four registers must move before a row stops reading `owed`**, all prepared by Claude, the
  fourth ruled on by the operator:
  1. the phase's `*-VERIFICATION.md` frontmatter → `independent_review: done | refused`
  2. its **ROADMAP Progress** row
  3. the **`REQUIREMENTS.md` `DEBT-06`** line (per D-02 / D-03 — amend, do not tick)
  4. the **bus item** — ⛔ operator closes it, never Claude (`REG-03`)
- **D-11: Findings are TRIAGED, never fixed here.** Each finding ships with a recommended
  disposition — **fast-fix / next phase / accept** — and the operator rules. ⛔ Fixing inside 254
  turns a review phase into a build phase: that is the G-7 runaway that took Phase 187 from 15 plans
  to 29, and it is also why `/gsd:fast`-sized inline fixes were REJECTED here — the reviewer fixing
  what it found stops being an independent verifier of that fix (`AGENTS.md` §6.3, verbatim).

### Measured at scoping — facts a plan must not re-assert differently

- **M-1:** All five read `verification_mode: self-verified`. Source: `grep` across the five
  `*-VERIFICATION.md` files, 2026-09-17.
- **M-2: `251-VERIFICATION.md` carries NO `independent_review` key at all** — 4 of 5 have it, 251
  does not. ⛔ **A sweep that counts `independent_review: owed` returns 4 and silently omits 251**,
  which is the same class of invisibility as a hot file with no ledger row. The key is ADDED for
  251, not flipped.
- **M-3:** Review artifacts today — 249: `249-REVIEW.md` · 250: `250-REVIEW.md` · **251: none** ·
  252: `252-REVIEW.md` + `252-REVIEW-R2.md` · 253: `253-REVIEW.md` + `253-REVIEW-R2.md`. Every one
  authored by claude, the builder.
- **M-4:** `253-VERIFICATION.md` frontmatter reads `status: gaps_found` while the ROADMAP Progress
  row reads **COMPLETE** (the gap-closure round landed after the verification). Both are defensible;
  **a plan must not cite one as refuting the other.**
- **M-11 (added 2026-09-17 at plan-CHECK time — it CORRECTS D-03 above, which is preserved rather
  than rewritten because its over-claim is the finding): THE OLDER ARM IS NOT UNIFORMLY OWED, AND
  `independent_review` HAS SIX DISTINCT STATES ACROSS THE TEN PHASES.** Measured directly with
  `grep -m1 "independent_review:"` over each `*-VERIFICATION.md`, 2026-09-17:

  | Phase | value | Phase | value |
  |---|---|---|---|
  | 238 | `complete` (by Gemini, 2026-09-14) | 243 | `refused` (written 2026-09-16) |
  | 240 | `complete` | 244 | **key absent** |
  | 241 | **key absent** | 245 | **no `*-VERIFICATION.md` at all** |
  | 242 | **`false`** | 246 | `done` (written 2026-09-16) |

  ⛔ **`D-03`'s sentence *"the 238/240/241 + 242-246 arm stays owed"* is therefore FALSE for four of
  those rows** — 238, 240, 243 and 246 are already discharged, refused or done. `DEBT-06-AUDIT.md`
  independently reaches the same set: *"4 genuinely unmet: 241 · 242 · 244 · 245."*
  ⛔ **D-02's amendment must therefore RE-DERIVE the list and distinguish the two states in its own
  wording** — naming ten phase numbers in one undifferentiated clause would write a false sentence
  into the requirement this phase exists to make true.
  ⚠ **Three separate vocabulary defects are visible in that table and none is this phase's to fix:**
  `complete` and `done` are two spellings of one state; `242`'s `false` is in **no** register's
  vocabulary; and `245` has no verification file to carry any value. **Record them as findings**
  (D-11 routing), do not repair them here — a vocabulary fix across ten phase files is a phase.
- **M-6 (added 2026-09-17 at plan time — the discussion did not know this): THREE `DEBT-06`
  ARTIFACTS ALREADY EXIST**, and they change what 254 has to invent:
  - `.planning/DEBT-06-REFUSALS.md` (2026-09-14, `decided_by: operator`, `phases: [241,242,243,244,245]`)
    — **the refusal format and the operator ruling that produced it already exist.** D-04's refusals
    follow this precedent; they do not invent one. ⛔ Its own rule: *"a refusal is not a pass"* — the
    phase keeps `verification_mode: self-verified` and `independent_review: owed`; what changes is
    that the debt stops being **silent**.
  - `.planning/DEBT-06-AUDIT.md` (2026-09-16) — **the counting rule, adopted from Phase 240's own
    verification, not invented here: a review file whose frontmatter does not assert
    `review_type: independent` is a CODE-REVIEW PASS, not a §6.3 review.** ⛔ This binds D-08
    directly: the claude floor pass on 251 must **not** carry `review_type: independent`.
    Its result line: *"2 discharged · 2 hold the substance but not the marker · 4 genuinely unmet."*
  - `.planning/DEBT-06-BUS-DRAFTS.md` (2026-09-16) — the drafted asks behind `BUS-249`..`257`.
- **M-7: NOTHING outside `.planning/` reads `independent_review`.** Measured:
  `grep -rn independent_review scripts/ .claude/ .github/ docs/ AGENTS.md CLAUDE.md` → **no matches**.
  ⛔ **The register flip is DOCUMENTATION, not an enforced state.** A plan may NOT write an acceptance
  criterion of the form *"the gate confirms `independent_review: done`"*, and **building** such a gate
  is a new capability inside a review phase — rejected by D-11 / G-7. Record the absence as a finding.
- **M-8: a two-register disagreement 254 inherits.** `ROADMAP.md:271` records `DEBT-06-AUDIT.md`
  calling four rows *"genuinely unmet"* — and the audit **never reads** `DEBT-06-REFUSALS.md`, which
  covers exactly those rows. ⛔ **A 254 refusal that does not state which reading it adopts
  re-creates the same conflict one milestone on.**
- **M-9:** a PostToolUse hook fires on any `*-VERIFICATION.md` edit —
  `.claude/settings.json` → `verification-honesty-guard.js` → `check-verification-honesty.cjs`. It
  reads **`verification_mode` only**, never `independent_review`, and **never blocks** (exit 0,
  `honesty gate OK`). Expect it in the transcript; do not plan around it.
- **M-10:** `node scripts/check-hot-file-ledger.cjs 254` **cannot be cited by this phase** — its
  `WATCHED` set is `backend/app` + `frontend/src` only, so once plans exist it watches **0** of this
  phase's files. ⛔ A green ledger gate here means *"nothing to see"*, never *"clear"*.
- **M-5:** The reviewer cannot be driven from here. Gemini runs in Antigravity and neither agent can
  wake the other — the bus is the only channel, and `scripts/agent-bus-watch.sh` dies with its
  session. ⛔ **No plan may have an acceptance criterion that depends on Gemini acting.**

### Claude's Discretion

- The shape and section order of `<phase>-REVIEW-IND.md` / `<phase>-REVIEW-REFUSAL.md`, and of
  254's index file.
- The per-phase review brief content appended to each amended bus item (the highest-value targets,
  the base commit, the artifacts to read first) — `BUS-256`'s existing brief is the pattern.
- Plan decomposition, within **G-8's 3-5 plan target**.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The rule being discharged
- `AGENTS.md` §6.3 — *"Whoever built it does not verify it"*, including the reviewer's own fixes;
  §6.3.1 (`scripts/arm-pair.sh`), §6.4 (the two briefing lines).
- `.planning/REQUIREMENTS.md:185-192` — `DEBT-06` as worded today (the text D-02 amends).
- `.planning/REQUIREMENTS.md:303-304` — the `DEBT-06` coverage row and the reason it was left
  unticked at the 251-04 sweep.
- `.planning/ROADMAP.md` §v4.2 — the `DEBT-06` at-milestone-close rule, the Phase 254 detail
  section, and the Progress rows this phase edits.
- `CLAUDE.md` § *Reported bugs cross-check* and § *Seeds register cross-check* — the two MANDATORY
  sweeps; the seeds sweep MUST be re-run at plan time (see `<code_context>`).

### The five phases under review
- `.planning/phases/249-the-model-you-actually-run/249-VERIFICATION.md`
- `.planning/phases/250-run-honesty-the-residue/250-VERIFICATION.md`
- `.planning/phases/251-register-integrity/251-VERIFICATION.md` (⛔ no `independent_review` key)
- `.planning/phases/252-close-the-v42-audit-gaps/252-VERIFICATION.md`
- `.planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-VERIFICATION.md`
- Existing review artifacts, **not to be overwritten**: `249-REVIEW.md`, `250-REVIEW.md`,
  `252-REVIEW.md`, `252-REVIEW-R2.md`, `253-REVIEW.md`, `253-REVIEW-R2.md`.

### The `DEBT-06` artifacts that already exist (added at plan time — see M-6)
- `.planning/DEBT-06-REFUSALS.md` — the refusal FORMAT and the 2026-09-14 operator ruling behind it.
- `.planning/DEBT-06-AUDIT.md` — the counting rule (`review_type: independent` or it is a code-review
  pass), row-by-row, plus the *"2 discharged · 2 hold the substance but not the marker · 4 genuinely
  unmet"* verdict this phase must not contradict silently.
- `.planning/DEBT-06-BUS-DRAFTS.md` — the drafted asks behind `BUS-249`..`BUS-257`.
- `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-INDEPENDENT-REVIEW.md` — the
  repo's ONLY file carrying `review_type: independent`; the shape a real §6.3 verdict takes here.

### The coordination channel
- `.agent-bus/OPEN.md` — `BUS-249` (251), `BUS-250` (250), `BUS-251` (249), `BUS-256` (252),
  `BUS-257` (253) are the five items D-06 amends; `BUS-252`..`BUS-255` are the older arm, out of
  scope; `BUS-246` / `BUS-248` are open to:operator.
- `scripts/agent-bus.sh` — `list` / `open` / `answer` / `close`. ⛔ `close` is the operator's verb.
- `scripts/arm-pair.sh`, `scripts/agent-bus-watch.sh` — §6.3.1's armings; a pairing is per SESSION
  as well as per phase.

### Prior context that shaped this phase
- `.planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-CONTEXT.md` — **D-21**:
  file the review ask at PLAN time, not at close, because a close-time filing lands behind the queue.
- `.planning/phases/251-register-integrity/251-BUS-TRIAGE.md` — the precedent artifact for
  *"a list the operator can rule on"*, which is what D-11 asks this phase to produce.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`/gsd:code-review <phase>`** — the instrument named by the ROADMAP and by the operator's
  standing decision; `/code-review ultra` stays ruled out on cost. Measured catch rate on this very
  set: 2 blockers on 249, 2 criticals on 253, 2 more blockers on 253's gap-closure round.
- ~~**`scripts/agent-bus.sh`** — already supports amend-in-place by editing `.agent-bus/OPEN.md`
  bodies; `list --to <agent>` is what the SessionStart hook runs.~~
  ⚠ **CORRECTED 2026-09-17 at plan time — the original is struck through rather than deleted, because
  a plan written against it would have called a verb that does not exist.** `scripts/agent-bus.sh`'s
  dispatch (`:168-172`) is exactly **`open | list | answer | close | archive`** — **there is no
  `amend` verb.** D-06's amend is therefore a **hand `Edit` of the item BODY**, which is legal only
  because `.agent-bus/OPEN.md:4-5` restricts its prohibition to the `###` header lines. Three
  mechanical constraints follow: ⛔ never touch the `### [OPEN] BUS-NNN · to:X · from:Y · DATE`
  header; ⛔ leave `**Answer:**` as an exact bare line or `cmd_answer` exits 3 on that item forever;
  ⛔ `close` stays the operator's verb. `list --to <agent>` is still what the SessionStart hook runs.
- **`251-BUS-TRIAGE.md`** — the shape D-11's triage list should follow.
- **`scripts/check-seeds-register.cjs --phase 254`** — ran clean at discuss time
  (`297/297 parsed · 0 duplicate ids · exit 0`) but matched **0 triggers, because the phase has no
  PLAN.md yet and therefore declares no `files_modified`.** ⛔ **Re-run it at `/gsd:plan-phase 254`**
  — the identical limitation was recorded at 253's discuss and is not a clean sweep.

### Established Patterns
- **Registers are hand-edited here.** ⛔ Do NOT call the `state.*` SDK verbs — they have corrupted
  `STATE.md` **seven** times, twice inside worktree commits. `STATE.md` says so in its own banner.
- **`gsd-sdk query phase.add` writes ROADMAP entries into the wrong section** — measured twice in
  two days (Phase 252 on 2026-09-16, Phase 254 on 2026-09-17). Read the diff, never the return value.
- **A finding is reported OPEN only after it has been DRIVEN against the tree.** On 2026-09-10 two
  Phase 239 criticals were escalated as live when they had been fixed two days earlier, in an
  ancestor of the reviewer's own base commit.

### Integration Points
- `*-VERIFICATION.md` frontmatter (5 files) · `.planning/ROADMAP.md` Progress rows (5 rows) ·
  `.planning/REQUIREMENTS.md` `DEBT-06` (1 line + 1 coverage row) · `.agent-bus/OPEN.md` (5 items) ·
  `.planning/STATE.md` (hand-edited).
- ⛔ **No product source file is in this phase's blast radius.** A plan whose `files_modified` names
  one has left the phase boundary.

</code_context>

<specifics>
## Specific Ideas

- The operator's words for the phase, verbatim: *"254 = new phase at end — independent review of
  249-253."*
- ⭐ The one-paragraph argument for why this phase exists at all, from `BUS-247`: **a self-verified
  close shipped two blockers with every gate green, six fences driven red and three live browser
  scenarios — because neither blocker was gate-catchable.** *"A code-review pass is not a peer
  review."*
- Phase 253 then repeated the shape one level up: a **14/14, `0 gaps`** verification passed over
  **two live criticals**, and a review of the *gap-closure round* found **two more**.

</specifics>

<deferred>
## Deferred Ideas

- **The older owed arm — 238 / 240 / 241 / 242-246.** Named by `DEBT-06` today, already filed as
  `BUS-252`..`BUS-255`, deliberately out of D-01's scope. **Re-open trigger:**
  `/gsd:complete-milestone` for v4.2, which cannot tick `DEBT-06` while this arm is owed.
- **The 9-item Gemini queue as a problem in itself.** Reducing/ranking the whole backlog was offered
  and not chosen; D-06 amends only the five items this phase owns. **Re-open trigger:** the
  2026-09-24 deadline expiring with the queue still unmoved.
- **`BUG-260916-01`** (`llm-call-timeout above 600s is silently ineffective`, `affected_areas:
  backend/provider-routing, admin/model-registry, local-models`) — an open `surface: Agentic-RAG`
  report squarely in **Phase 249's** domain. ⛔ **Not folded: 254 fixes nothing.** It is named here
  as an INPUT to 249's review — a live defect in the reviewed surface is evidence the reviewer
  should weigh. **Re-open trigger:** 249's review verdict, or the next phase touching model routing.
- **The other 10 open `surface: Agentic-RAG` reports** were swept at discuss time and none is in
  this phase's domain (all name product surfaces; 254 touches none).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (`todo.match-phase 254`, score 0.6) — a keyword false
  positive ("derived, phases, human, run, real"). Nothing to do with reviewing a phase. Not folded.

</deferred>

---

*Phase: 254-independent-review-of-249-253*
*Context gathered: 2026-09-17*
