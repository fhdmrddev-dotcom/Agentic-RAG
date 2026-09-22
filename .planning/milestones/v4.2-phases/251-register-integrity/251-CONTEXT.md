# Phase 251: Register Integrity - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The registers become a trustworthy **index**: a reference by id resolves to exactly one thing, a
`trigger_when` is swept by something executable rather than by hope, and the operator's bus queue is
a list they can actually rule on.

**In scope:** `.planning/seeds/` (283 files), `.agent-bus/OPEN.md` open `to:operator` items, the
sweep instrument itself (`scripts/`), its wiring into `.claude/commands/gsd/`, and the CLAUDE.md /
REQUIREMENTS.md prose that describes them.

**Out of scope:** every product surface. No migration, no G-2 sketch, no SC#10 cross-provider
roster, no product-surface G-5 rows. This phase ships no user-visible behaviour.

⚠ **Sequenced LAST on purpose** — 247-250 each planted, flipped and answered seeds, so `REG-02`'s
new sweep runs over **this milestone's own seeds** as its first real exercise.

</domain>

<premise_corrections>
## ⚠ THREE REQUIREMENT PREMISES WERE RE-MEASURED AT THIS DISCUSS-PHASE — READ BEFORE PLANNING

Measured **2026-09-15**, on the live tree, at `717bd63f6`. Originals are recorded beside the
corrections, never over them, because a plan written against the stale figure builds the wrong thing.

| Claim as written | Measured 2026-09-15 | Consequence for planning |
|---|---|---|
| `REG-01`: 8 duplicate seed ids — `022, 092, 228, 229, 231, 253, 259, 269` | ✅ **CONFIRMED.** All 8 are genuine collisions — **two distinct seeds per id**, not one file listed twice. Highest allocated id is `276`; register holds **283 `.md` files** | Stands as written. Fresh ids start at `277`. |
| `REG-02`: "161 planted seeds of 280" | ≈ **160 `status: planted` of 283** — close enough that the requirement is unaffected | Stands as written. |
| `REG-03`: "**23 items** open `--to operator`, most 5-10 days old" | ⛔ **STALE.** **5** are open: `BUS-040, BUS-208, BUS-246, BUS-247, BUS-248` — and **four of those five are NEWER than BUS-171**. **22 of BUS-171's 23 named items are CLOSED.** The triage itself **already shipped** at commit **`88a9ff861` (2026-09-14)**, whose message records that it counted `2` with `grep -c` and that its **third arm found one true orphan** — a finding held by nothing for 14 days — and planted **`SEED-276`** | ⛔ **REG-03 IS RE-SCOPED — see D-10.** Planning it as written would re-do work that shipped yesterday. |

### Per-id inbound reference load (measured 2026-09-15, repo-wide, excluding the seed files themselves)

| dup id | inbound files | note for D-05/D-07 |
|---|---|---|
| `SEED-253` | **52** | the heaviest — the redirect stub matters most here |
| `SEED-022` | 33 | |
| `SEED-092` | 33 | |
| `SEED-231` | 22 | |
| `SEED-259` | 16 | |
| `SEED-228` | 11 | |
| `SEED-229` | 8 | |
| `SEED-269` | 6 | the lightest |

⚠ **These are FILE counts and they overlap** — one file can reference several of the eight — so they
do not sum to the 130-file / 448-occurrence aggregate above. They size the work per pair, nothing
more. ⛔ **They are NOT a tie-breaker:** D-07 rules that the **oldest** seed keeps the id, deliberately
rejecting "most-referenced keeps it". The planner should still **report any pair where D-07 hands the
id to the markedly less-referenced seed**, as an observation recorded beside the rule — not as a
reason to depart from it.

⭐ **The third arm paid for itself exactly as BUS-171 predicted it would**, and that is recorded here
so it is not re-litigated: `BUS-040` carried a measured finding (`localhost` resolves `::1` first
while uvicorn binds IPv4 only → ~2 s per local Python call, 4 ms vs 2048 ms) held by **no register**
for 14 days. `SEED-276` now holds it.

### Two defects nobody named — both larger than the ones the requirements DO name

**1. More than half the register is invisible to its own documented sweep rule.** CLAUDE.md's seeds
cross-check says to list seeds with `status: planted` **AND `surface: Agentic-RAG`**. Measured key
presence across the 283 files:

| key | present in | missing from |
|---|---|---|
| `status` | **278** | **5** |
| `title` | 254 | 29 |
| `seed_id` | **177** | **106** |
| `trigger_when` | **157** | **126** |
| `relates_to` | 144 | 139 |
| `surface` | **128** | **155** |

⛔ **A sweep filtering on `surface: Agentic-RAG` sees 128 of 283 — 45%.** The rule as written cannot
see 155 seeds, and five seeds carry no `status` at all
(`SEED-084`, `SEED-163`, `SEED-164`, `SEED-165`, `SEED-166`), so they are invisible to *any* status
scan. **`status:` frontmatter IS the index** — that is this project's own recorded finding, and here
the index itself is missing.

**2. `status:` is not an enum.** **40+ distinct values**, most carrying trailing prose in the same
line — e.g. `status: partially-answered  # trigger #2 ANSWERED by Phase 206 (2026-08-25)…`,
`status: DONE ✅ — backend implemented + unit-tested + LIVE-VERIFIED 2026-06-07…`. The prose carries
real information and must not be destroyed; the field is nevertheless unparseable as it stands.

**3. `trigger_when` is free-form English.** 157 files carry one; **126 carry none**. REG-02's
success criterion — *"prints the seeds whose trigger is already true"* — is **not literally
computable** from that field. D-01/D-02 resolve this; a plan that assumes the field is machine-
readable will build an evaluator over prose.

</premise_corrections>

<decisions>
## Implementation Decisions

### REG-02 — the executable sweep

- **D-01 (locked): structured trigger fields land BESIDE the prose, never replacing it.** Each seed
  gains machine-readable trigger keys — `trigger_paths:` (globs), `trigger_surfaces:`,
  `trigger_phase_touches:` — while `trigger_when:` stays as the human explanation. The sweep matches
  a phase's blast radius (`files_modified`, surface names) against the structured keys and prints
  exact hits with the matched token quoted. **Deterministic and RED-drivable.** ⛔ Rejected:
  evaluating the prose, and dropping trigger evaluation to ship an integrity-only gate — the latter
  would be a written re-scope of REG-02's success criterion and was not chosen.
- **D-02 (locked): derive structured fields for all 157 seeds that have prose; mark the other 126
  EXPLICITLY.** The backfill reads each existing `trigger_when` and emits `trigger_paths` /
  `trigger_surfaces` from the paths and surface names it **already names**. The 126 with no trigger
  get `trigger_when: unset` so they are **visible as unswept rather than silently absent** — the gate
  then reports *"126 seeds carry no trigger"* as a number that must shrink, not a blind spot.
  ⛔ Rejected: "new seeds only, backfill on touch" — it leaves the sweep near-blind for months, which
  is the exact failure REG-02 exists to end (`SEED-172` sat reachable for four weeks).
- **D-03 (locked): the sweep is a script AND it is WIRED INTO the two GSD touchpoints.**
  `scripts/check-seeds-register.cjs` follows the house convention — **exit `0` clear · `1` fails ·
  `2` harness error**, and it **prints its derivation** so the number is auditable rather than
  asserted (precedent: `check-hot-file-ledger.cjs`, `check-gap-closure-rounds.cjs`,
  `check-verification-honesty.cjs`). ⛔ **The wiring is the deliverable, not the script.**
  `grep -rln "SEED" .claude/commands/gsd/` returns **`capture.md` only** — the command that *writes*
  seeds. An actual call is added to `discuss-phase` and `new-milestone`, because
  **a rule that exists and is not applied is the same as no rule** and this project has paid for that
  finding twice.
- **D-04 (locked): the sweep is driven RED on FOUR arms, and the fourth is the counterfactual.**
  1. a planted **duplicate id** → must FAIL;
  2. a seed with **missing or unknown `status`** → must FAIL;
  3. a seed whose structured trigger **matches** the phase's blast radius → must be **PRINTED**;
  4. ⭐ a seed whose trigger **does NOT match** → must be **ABSENT from the output**.
  **Plus: assert the parsed-file COUNT is non-zero and equals the register size.** ⚠ Arm 4 and the
  count assertion are non-negotiable: Phase 242 measured `check-hot-file-ledger.cjs` exiting `0` over
  **zero parsed files**, and a pinned a11y suite red in **neither** knob. **A gate that prints
  everything is not a sweep, and a gate nobody has seen fire is not a guard.**

### REG-01 — duplicate resolution

- **D-05 (locked): renumber the younger seed of each pair to a fresh id (`277`+), and leave a
  REDIRECT STUB at the old id.** The stub is a tiny file carrying `status: superseded-id` and
  pointing at **both** resolutions, so any historical reference still lands somewhere that
  disambiguates. **The gate treats a stub as a legitimate resolution, not as a duplicate.**
- **D-06 (locked): ⛔ ARCHIVES ARE NOT REWRITTEN.** Measured: **448 references** to the 8 ids across
  **130 files**, and **378 of them (84%) sit inside sealed `.planning/milestones/`** — historical
  records of what was said at the time. Only ~70 occurrences are in live files. **Rewriting an
  archive edits history and is refused**; the redirect stub (D-05) is what keeps those 378 references
  followable. Live refs (`.planning/seeds/`, `.planning/ROADMAP.md`, `REQUIREMENTS.md`,
  `.planning/phases/`, `CLAUDE.md`, `docs/`) ARE updated.
- **D-07 (locked): the OLDEST seed keeps the id — by `created` date.** The seed that claimed the id
  first keeps it; the later squatter moves. Deterministic, needs no judgement, **and it matches what
  every archived reference most likely MEANT** — a reference written before the collision existed can
  only have meant the original. The rule is itself checkable by the gate. ⛔ Rejected: "most-
  referenced keeps it" (optimises the outcome over the principle, and can hand an id to a seed that
  never owned it) and "case by case" (8 judgement calls leaving no precedent for the ninth).
- **D-08 (locked): prevent the NINTH collision at the CAUSE, not only the symptom.** Two things
  ship: (a) the gate fails **`[duplicate-id]`**, so a collision cannot survive a commit; **and**
  (b) `/gsd:capture` gains a **next-id allocator that derives the number from the register** rather
  than from a human reading a listing. ⚠ The 8 collisions happened because two agents each read
  *"highest is N"* and both wrote `N+1` — **a gate alone still lets two parallel agents collide and
  then blames the second one.**

### REG-01 (widened) — register hygiene

- **D-09 (locked): a required-key contract, backfilled across all 283 and gate-enforced.** Minimum
  frontmatter every seed must carry: **`seed_id`, `title`, `status`, `surface`, `trigger_when`**.
  Derive what is derivable (`seed_id` from the filename, `title` from the H1, `surface` defaults to
  `Agentic-RAG`) and **mark what is not**. The gate then fails **`[missing-key]`**, so **the sweep
  can never again be blind to half its own input.**
- **D-10 (locked): `status` becomes a CLOSED ENUM and the prose moves to `status_note`, verbatim.**
  Enum: `planted | dormant | open | partially-answered | answered | folded | shipped | closed |
  deferred | superseded-id`. Everything after the value moves **byte-for-byte** into a new
  `status_note:` key. **Nothing is lost**, the scan gets a parseable field, and the gate fails
  **`[unknown-status]`**. ⭐ This mirrors the hot-file ledger's 200-char disposition rule — **verdict
  in the cell, reasons beside it** — which is the pattern that stopped CLAUDE.md's second size trip.
  ⚠ `partially-answered` vs `answered` is a distinction this project uses **deliberately**; a
  3-value collapse was rejected for exactly that reason.
- **D-11 (locked): the bulk pass proves every BODY byte-identical, by hash.** The migration script
  touches **only** the frontmatter block; every seed's body below the closing `---` is asserted
  **md5-identical** before and after, and the run prints the count of files changed and the set of
  keys added per file. **A body that moved by one byte fails the run.** Precedent: `244-04` left
  `App.tsx` byte-unchanged and fenced it. ⛔ Rejected: sample-diff review over 283 files whose
  frontmatter is *demonstrably* inconsistent.

### REG-03 — the operator queue (RE-SCOPED)

- **D-12 (locked): triage the CURRENT 5 open `to:operator` items, and close BUS-171 IN WRITING.**
  Apply the three-arm classification to **`BUS-040, BUS-208, BUS-246, BUS-247, BUS-248`**, hand the
  operator that list, and record — naming commit **`88a9ff861` (2026-09-14)** as the evidence — that
  BUS-171's original 23-item premise was discharged. **The requirement's GOAL is met; its stated
  COUNT was stale.** This is an honest re-scope recorded at discuss-phase, not a quiet narrowing.
- **D-13 (standing, unchanged): ⛔ CLAUDE MAY NOT CLOSE BUS ITEMS.** The deliverable is a **list the
  operator rules on**. An item closed without the operator seeing it is a decision taken by the wrong
  party. Each item is classified **superseded** (naming the evidence), **live decision** (one line so
  the operator can rule without re-reading the item), or **carries an unfixed finding** — and that
  last arm **must verify a durable register holds the finding and plant one where it does not.**
- **D-14 (locked): REG-03 leaves a MECHANISM behind — the SessionStart hook ages the queue.**
  `.claude/hooks/agent-bus-check.sh` already prints open `to:claude` items at every session and
  subagent start. It is extended to also print a **one-line count of open `to:operator` items with
  the oldest age** — e.g. `5 open to:operator, oldest 15 days`. ⚠ The queue went 23 → 5 **because a
  person noticed**, with no mechanism involved; this makes its size a number the operator sees rather
  than one somebody has to go and count.
- **D-15 (locked): the 26 open `to:gemini` items are OUT OF SCOPE, but COUNTED by the hook.** They
  are Gemini's to answer, and ruling on them here would be one agent deciding another's queue. The
  hook's one-line summary counts them so their size stops being invisible. ⚠ Measured for the record:
  **26 open `to:gemini`, 1 open `to:claude` (BUS-171 itself), 5 open `to:operator` — 32 open items
  total**, against 69 + 113 + 30 = **212 closed**.

### ⚠ AMENDMENTS RULED AT PLAN-PHASE — 2026-09-16, by the operator, on measured research evidence

⚠ **Five locked decisions were measured UNIMPLEMENTABLE AS WRITTEN by `251-RESEARCH.md`.** The
originals above are preserved byte-unchanged, never overwritten, per this file's own convention. The
amendments below **override** them where they conflict, and the planner is bound by the amended form.
Every figure names the command that produced it in `251-RESEARCH.md`; all measured 2026-09-15 at `0fa2674cd`.

- **D-16 (locked, amends D-10): `status` stays a 10-value closed enum; a NEW sibling key `partial:`
  (boolean) carries the qualifier on ANY axis.** Measured: 9 tokens covering **251 of 278 files
  (90.3%)** map 1:1 and need no judgement; **16 tokens covering 27 files fit no enum member**, and
  **15 of those are a `partially-*` family on four axes D-10's enum has no slot for**
  (`partially-folded` ×7, `partially-shipped` ×4, `shipped-in-part`, `partially-resolved`, `partial`,
  `partial-consumed`). So `partially-folded` → `status: folded` + `partial: true`, and the discarded
  prose still moves byte-for-byte to `status_note`. ⛔ **The remaining 12 orphans — `promoted` ×2,
  `DONE`/`done` ×3, `routed`, `scheduled`, `queued`, `in_progress`, `active`, `resolved`, `fixed` —
  each get an INDIVIDUALLY LISTED mapping in the plan**, per D-10's standing instruction that every
  mapping is listed and none silently coerced. ⚠ `SEED-100`/`SEED-101`'s `promoted` must be READ
  before mapping — it may mean *"became a requirement"*, which is `folded` to a different destination.
  ⭐ Chosen over widening the enum by two, and over mapping down onto `status_note` alone: the latter
  makes `status: folded` silently include half-open seeds, which is **REG-02's own failure mode in a
  new costume**. The gate validates `status ∈ enum` **independently of** `partial`, so a
  `partially-deferred` needs no re-open.

- **D-17 (locked, amends the D-06 live-file list): the REDIRECT STUB carries the product-source
  references, and NO product file is touched.** Measured: **84 of the 156 live duplicate-id
  occurrences (54%), across 33 files**, sit in `backend/app`, `backend/tests`, `frontend/src` and
  `scripts/` — which the phase boundary excludes and D-06's live list never named. **All 84 are
  comments or test docstrings; none is an executing identifier.** ⭐ `SEED-259` is harmless — D-07
  keeps the id on the seed the source code actually means, so `test_259_argument_shapes_are_rows_too.py`
  stays correct. ⛔ **`SEED-253` is the live one:** every live source reference means
  `source-file-path-is-synthetic-no-adapter-populates-it`, which D-07 makes the YOUNGER seed, so 25+
  backend/frontend references land on the stub. **The plan MUST record IN WRITING that those 33 files
  are deliberately left pointing at the stub**, and **the `SEED-253` stub's wording must be good enough
  to serve a developer reading a code comment** — naming both resolutions and saying plainly which one
  concerns source paths. ⛔ Rejected: a narrow exception to edit comment-only refs (puts product files
  in the blast radius for zero executable change), and departing from D-07 on the 253 pair (D-07
  rejects "most-referenced keeps it" by name, and one exception leaves no precedent for the ninth).

- **D-18 (locked, amends D-02): the backfill is MECHANICAL ONLY, and the gate prints TWO numbers that
  must BOTH shrink.** Measured across the 157 seeds carrying `trigger_when`: only **20 name a full
  repo path** (a reliable glob), **45** if bare filenames count as `**/name.ext`, and **33 name
  nothing extractable at all**. ⛔ **So after a fully-automated backfill roughly 238 of 283 (84%) are
  still unswept — not the 126 D-02's gate message anticipates.** The gate therefore reports
  **`N seeds carry no trigger_when at all`** and **`M seeds carry prose but no structured trigger`**
  as two separate figures. **Conflating them hides the larger one, and a gate reporting `126` while
  238 are unswept is the comfortable lie REG-02 exists to end.** ⭐ `trigger_paths` is the
  LOAD-BEARING field — deterministic, matches `files_modified` directly, and the only one D-04's arms
  3 and 4 can be driven against. `trigger_surfaces` is a **small controlled enum** seeded from the
  ~15 domain words that actually repeat, NOT free extraction: measured, the quoted vocabulary is
  bespoke — **the most frequent quoted term across the whole register appears TWICE**, so free
  extraction yields ~53 seeds tagged with strings no other seed shares and no phase will declare.
  ⛔ **`trigger_phase_touches` is NOT built as a third matching axis** — the 31 seeds naming a phase
  number name it as *history*, not as a future trigger. ⛔ Rejected: an assisted hand-derivation pass
  over the remaining 112 (the single biggest budget item in the phase, and it breaches G-8 on its own).

- **D-19 (locked, amends D-03): the sweep call lands in `.claude/get-shit-done/workflows/`, where the
  steps actually are — following the G-7 precedent at `9d3d887de`.** Measured: the two files D-03
  names, `.claude/commands/gsd/discuss-phase.md` and `new-milestone.md`, are **76- and 45-line ROUTERS
  with no steps in them** — a call added there lands where nothing executes it in order, which is this
  project's own recorded *"a rule that exists and is not applied is the same as no rule"*. ⚠
  `.claude/get-shit-done/` is a **VENDORED framework at v1.42.3**; the edit is recorded as a known
  re-apply risk, and the one precedent (`9d3d887de`, the G-7 gate) **survived a later framework
  update**. ⛔ **AND D-03 RESOLVES A CONTRADICTION, NOT A VOID:** `/gsd:new-milestone` already carries
  a `## 2.5. Scan Planted Seeds` step that reads all 283 by hand **and explicitly forbids what
  CLAUDE.md mandates** — *"never delete or modify seed files during this workflow."* That step is
  **replaced** by the script call, and the prohibition is **scoped in writing**: the workflow itself
  does not edit seeds, while *answering a seed by editing it* (CLAUDE.md) stays correct outside it.
  ⛔ Rejected: the routers alone (wiring that reads correct and never fires), and a PostToolUse hook
  (fires on file writes, not at the two GSD touchpoints REG-02 names).

- **D-20 (locked, amends D-07): the date rule reads `created` IF PRESENT, ELSE `planted`, and ties
  break on the git ADD-COMMIT timestamp.** Measured: **`created` is present in only 99 of 283 seeds**
  (`planted:` 178; neither 6), and **five of the eight duplicate pairs carry only `planted:`** — so
  D-07 as written cannot evaluate its own rule on 5 of 8 cases. **Two pairs tie on the day and D-07
  gives no tie-break:** `SEED-231` (both `2026-08-29`) and `SEED-253` (both `2026-09-06`). Resolved by
  `git log --diff-filter=A --format=%ad --date=iso`, which is derived rather than judged — exactly what
  D-07 optimises for: `SEED-231` → `decision-coverage-gate-is-blind…` keeps it (older by 63 min);
  `SEED-253` → `mobile-has-no-drawer-trigger…` keeps it (older by 13h 24m). ⚠ **The frontmatter date
  is AUTHORITATIVE and the git timestamp is the tie-break ONLY** — they disagree on two pairs
  (`SEED-022-timeout-settings-ui` reads `2026-05-25`, added `2026-05-24`; both `228`/`229` movers read
  `2026-08-31`, added `2026-09-01`) without flipping any verdict, and the script must not pick silently.
  **The gate encodes the `created`-else-`planted` fallback**, or it fails to evaluate its own rule.

### ⚠ Research corrections the planner must carry (not operator decisions — measured facts)

- ⛔ **`.planning/seeds/TEMPLATE.md` DOES NOT EXIST.** The canonical-refs block above lists it as a
  file to *update*; it must be **CREATED**. The frontmatter contract has never had a written home —
  which is a sufficient explanation, on its own, for 40+ status spellings.
- ⛔ **`/gsd:capture`'s allocator is a live, quotable bug:** `plant-seed.md` allocates
  **`count(files) + 1`, not `max(id) + 1`** — it would emit **`SEED-284`** today, not D-08's `277`.
  D-08's stated cause (*"two agents each read 'highest is N'"*) is therefore **incomplete**; the
  allocator has been wrong on its own, single-threaded, the whole time.
- ⛔ **159 of 283 seeds contain CR and 6 have MIXED line endings inside one file.** With
  `core.autocrlf=true` and no `.gitattributes`, a normalising rewrite changes every working-tree line
  while producing **NO `git diff`** — so **`git diff` cannot verify D-11**. The md5 body proof must
  hash **raw Buffers**.
- ⛔ **102 bare `---` lines live inside seed BODIES** — a greedy frontmatter delimiter regex destroys
  ~40% of the register. The boundary must be *first* `---` to *next* `---`, anchored at file start.
- ⛔ **The 5 status-less seeds** (`SEED-084`, `163`, `164`, `165`, `166`) **have no frontmatter block
  at all** — they need a different CODE PATH, not a different value.
- ⛔ **The Phase-242 vacuity defect is guarded on the scan-set side and NOT the subject side** in
  `check-hot-file-ledger.cjs` — it can still print `subject: 0 files` and `ledger gate OK`.
  **`check-verification-honesty.cjs`'s `MIN_SUBJECT_FILES` is the pattern D-04's count assertion
  copies.**
- ⛔ **NO gate script has any test, runner, or self-test mode.** D-04's four RED arms are
  *executed-and-recorded*, which is what makes the plan decomposition load-bearing.
- ⭐ **`path.matchesGlob` is a Node built-in on v24.19.0** — D-01 needs no dependency. ⛔ **A YAML
  dependency is forbidden with evidence:** `244-VERIFICATION.md`'s frontmatter does not parse as YAML,
  so a parsing gate would exit `2`. Hand-rolled, as every sibling gate already does.
- ⚠ **`rg` skips dot-directories without `--hidden`** — it produced a confidently wrong zero during
  research. Every `.planning/` / `.agent-bus/` / `.claude/` scan needs the flag.
- ⚠ **Two copies of the bus header parse already exist and have ALREADY DIVERGED** (`age_days` has a
  BSD fallback in `agent-bus.sh`; the hook's inline copy is GNU-only). D-14 must not add a third.
- ⚠ **`agent-bus.sh list` has NO 20-row cap** — CONTEXT.md's warning above is refuted by measurement.
  The `grep -c` discipline still stands on its own merits.

### Claude's Discretion

The user made an explicit ruling on every question asked — **no "you decide" answers were given**.
Discretion is therefore limited to:
- The exact glob syntax and matching semantics of `trigger_paths` (D-01).
- The precise mapping table from each of the 40+ existing `status` spellings onto the D-10 enum —
  ⛔ but **every mapping must be listed in the plan and its discarded prose preserved in
  `status_note`**, never silently coerced.
- Plan decomposition under **G-8** (target **3-5 plans**; above 6, justify in writing what genuinely
  cannot share a worktree).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirements and the phase
- `.planning/ROADMAP.md` → `#### Phase 251: Register Integrity` — goal, the three success criteria,
  and the Flags block (⛔ Claude may not close bus items · ⚠ drive the sweep RED · ⚠ `status:`
  frontmatter IS the index).
- `.planning/REQUIREMENTS.md` §`Register Integrity` (lines ~144-160) — `REG-01`, `REG-02`, `REG-03`
  in full, including the measured cost (`SEED-172` reachable for four weeks).

### The registers being repaired
- `.planning/seeds/` — 283 `.md` files. The subject of `REG-01` and `REG-02`.
- `.planning/seeds/TEMPLATE.md` — ⚠ **must be updated in the same commit as D-09/D-10**, or the very
  next seed authored re-introduces the defect the backfill just removed.
- `.agent-bus/OPEN.md` — 3049 lines; `### [OPEN] BUS-NNN · to:<addressee>` is the machine-read header
  shape. ⛔ **Do not hand-edit `###` header lines** — use the script.
- `.agent-bus/README.md` — bus protocol and roles.
- `.agent-bus/archive/CLOSED.md` — where closed items are swept by `agent-bus.sh archive`.
- `scripts/agent-bus.sh` — `list` / `open` / `answer` / `close` / `archive`. ⚠ **`list` prints at
  most 20 rows** — count with `grep -c`, never eyeball a tail (this hid the true size of BUS-171's
  own queue, twice).
- `AGENTS.md` — the two-agent protocol and role separation the bus implements.

### The gate conventions this phase must follow
- `scripts/check-hot-file-ledger.cjs` — the closest analog: takes a phase dir, parses planning files,
  exits `0/1/2`. ⚠ **Also the cautionary precedent** — Phase 242 measured it exiting `0` over **zero
  parsed files** on a CRLF plan.
- `scripts/check-gap-closure-rounds.cjs` — the worded-escape-hatch pattern
  (`--unmet-criterion "…"`), and the *derives-the-number-and-prints-the-derivation* convention.
- `scripts/check-claude-md-size.cjs` — enforces a per-cell char cap and named failure codes
  (`[disposition-too-long]`, `[duplicate-row]`, `[malformed-row]`). **The failure-code vocabulary
  D-04/D-08/D-09/D-10 should mirror.**
- `scripts/check-verification-honesty.cjs` — the most recently hardened gate; its scan set was made
  **derived rather than enumerated** after `SEED-275`.
- `.claude/hooks/hot-file-ledger-guard.js`, `.claude/hooks/claude-md-size-guard.js` — the PostToolUse
  guard pattern (fires in the turn the content is authored).
- `.claude/hooks/agent-bus-check.sh` — **the file D-14 extends.**
- `.claude/commands/gsd/discuss-phase.md`, `.claude/commands/gsd/new-milestone.md` — **the two files
  D-03's wiring lands in.**

### The rules being corrected in the same commit
- `CLAUDE.md` §`Seeds register cross-check (MANDATORY)` — its `surface: Agentic-RAG` filter is
  measured to see **128 of 283**. ⛔ **Correct it in the same commit as D-09**, and record the
  correction **beside** the original per this file's own convention, never over it.
- `CLAUDE.md` §`CLAUDE.md context budget (MANDATORY)` — the char gate; **any CLAUDE.md edit this
  phase makes must be re-measured with `node scripts/check-claude-md-size.cjs`**, never with `wc`.
- `CLAUDE.md` §`Workflow guardrails` **G-8** — the 3-5 plan cap that bounds this phase.

### Directly relevant seeds (read before building the gate)
- `.planning/seeds/SEED-275-*.md` — **a gate blind because of its SCAN SET.** The nearest prior art:
  its fix made the scan set *derived*. D-09's `[missing-key]` is the same lesson one register over.
- `.planning/seeds/SEED-274-*.md` — a gate whose **threshold is not a stable property**.
- `.planning/seeds/SEED-276-*.md` — planted by BUS-171's own third arm on 2026-09-14; **the evidence
  that the third arm works**, and D-12's proof that the triage ran.
- `.planning/seeds/SEED-172-*.md` — the measured cost of an unswept register (reachable four weeks).

### Evidence for the re-scope
- Commit **`88a9ff861`** — *"docs(BUS-171): triage delivered — and one true orphan found by its third
  arm"*, 2026-09-14. **The evidence D-12 must name in writing.**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/check-*.cjs` (8 files)** — an established, uniform gate shape: takes a target, derives
  its own numbers, prints the derivation, exits `0/1/2`, names failures in `[bracketed-codes]`.
  `check-seeds-register.cjs` should be indistinguishable in shape from its siblings.
- **`.claude/hooks/*-guard.js` (4 gate guards)** — PostToolUse wrappers that run a `check-*.cjs` in
  the turn content is authored. Available if D-03's touchpoint wiring proves insufficient, though the
  operator ruled the touchpoint wiring is what ships.
- **`scripts/agent-bus.sh`** — already parses the `### [STATE] BUS-NNN · to:X · from:Y · DATE` header
  shape. **D-14's age computation can reuse that parse rather than writing a second one** — ⚠ a
  second parser that disagrees with the first is this project's recurring defect.
- **`.planning/reported-bugs/TEMPLATE.md`** — a register that ALREADY has structured frontmatter
  (`surface`, `severity`, `status`, `affected_areas`, `folded_into`, `re_open_trigger`) and a
  documented status lifecycle. **The seeds register is being brought up to this standard; copy the
  shape rather than inventing one.**

### Established Patterns
- **Exit codes `0` clear · `1` fail · `2` harness error**, with a worded escape hatch rather than a
  boolean where an override is legitimate — an override prints `passed WITH OVERRIDES`, never
  `clear`, so a waved-through finding can never read as an absent one.
- **Same-commit sync rule** — `Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md`, ledger row ↔ detail
  section, deploy artifacts ↔ `check-deploy-drift.sh`. **D-09 ↔ `TEMPLATE.md` and D-09 ↔ CLAUDE.md's
  sweep rule are two more instances.**
- **Corrections sit BESIDE originals, never over them.** Applied throughout this document.
- **Derive, never transcribe** — the hot-file ledger's triples, the `MODEL_CAPABILITIES` roster, the
  count gate's totals. **D-08's allocator is the same rule applied to seed ids.**

### Integration Points
- `.claude/commands/gsd/discuss-phase.md` + `new-milestone.md` ← D-03 adds the sweep call.
- `.claude/hooks/agent-bus-check.sh` ← D-14 adds the one-line `to:operator` age summary.
- `.claude/skills/gsd-capture` / `.claude/commands/gsd/capture.md` ← D-08 adds the id allocator.
- `.planning/seeds/TEMPLATE.md` ← D-09/D-10 required-key contract + status enum.
- `CLAUDE.md` seeds cross-check table ← corrected sweep rule; ⚠ re-measure the char gate after.

### ⚠ Blast-radius note for G-5
This phase modifies **no product source file** — its blast radius is `.planning/`, `.agent-bus/`,
`scripts/` and `.claude/`. `node scripts/check-hot-file-ledger.cjs 251` should therefore come back
clean; **if it reports `[no-row]`, that is a finding about the gate's own scan set** (it should not
demand ledger rows for tooling), not about this phase — record it rather than adding spurious rows.

</code_context>

<specifics>
## Specific Ideas

- **"A gate nobody has seen fire is not a guard."** D-04's arm 4 — the counterfactual — is the
  specific thing Phase 242 found missing twice in one phase. A sweep that prints all 283 seeds passes
  arms 1-3 and is useless.
- **"`status:` frontmatter IS the index."** Prose inside a seed body saying *"still open"* is
  invisible to any scan. This is why D-10 moves prose into `status_note` instead of deleting it, and
  why the five seeds with no `status` block are treated as a defect rather than as an omission.
- **The register is being brought up to the reported-bugs register's standard**, not to a new one.
  `.planning/reported-bugs/TEMPLATE.md` already has the frontmatter contract seeds lack.
- **`SEED-276`'s asymmetry is worth carrying into the gate's own design**: one *"always use X"* rule
  was wrong half the time because the frontend and backend bind opposite address families. Applied
  here: a single filter (`surface: Agentic-RAG`) that looks universal is wrong for 155 of 283 seeds.

</specifics>

<deferred>
## Deferred Ideas

- **Triaging the 26 open `to:gemini` bus items.** D-15 rules them out of scope — they are Gemini's
  queue to answer. Counted by the hook so their size is visible. **Re-open trigger:** any one of them
  is found to carry an unfixed finding held by no durable register, or the count crosses a threshold
  the operator cares about.
- **Applying the third arm retroactively to the 22 already-closed `to:operator` items.** Offered and
  not taken (D-12). `88a9ff861` claims the arm was applied to `BUS-040`; the other 21 closures are
  **unaudited**. **Re-open trigger:** a finding is discovered to have been lost in one of those 21
  closures — which is precisely the failure mode BUS-171 warned about.
- **Giving `.planning/reported-bugs/` the same executable sweep.** 19 open reports today, swept by
  the same "an agent reads the folder" mechanism REG-02 is replacing for seeds. Out of scope; the
  instrument built here should be shaped so a second register can reuse it.
- **A `bash scripts/agent-bus.sh triage` command** — prints every open item grouped by addressee with
  age, for ruling on in one sitting. Offered as an alternative to D-14 and not taken, because it only
  works when somebody remembers to run it.
- **Timestamp-based seed ids** (`SEED-260915a`, the `BUG-260912-01` shape) — structurally cannot
  collide. Rejected at D-08 because it breaks the existing 276-seed numbering and every convention
  built on it. **Re-open trigger:** a collision recurs *despite* D-08's allocator.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.60) — matched on generic keywords only
  (`derived, phases, run, real, 2026`). **No relationship to register integrity.** Not folded.

</deferred>

---

*Phase: 251-Register Integrity*
*Context gathered: 2026-09-15*
