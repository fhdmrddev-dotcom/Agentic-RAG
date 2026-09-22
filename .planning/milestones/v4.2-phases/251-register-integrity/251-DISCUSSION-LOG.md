# Phase 251: Register Integrity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15
**Phase:** 251-Register Integrity
**Areas discussed:** Sweep design (REG-02), Duplicate resolution (REG-01), Register hygiene depth, REG-03's new shape

---

## Measurements taken before the discussion

Recorded so the options can be audited against the evidence that shaped them. All measured
2026-09-15 on the live tree at `717bd63f6`.

| Measurement | Value |
|---|---|
| Seed `.md` files | 283 |
| Duplicate ids | 8 — `022, 092, 228, 229, 231, 253, 259, 269`, each a pair of **distinct** seeds |
| Highest allocated id | `276` |
| `status: planted` | ~160 |
| Distinct `status:` values | 40+ |
| Seeds with **no** `status` | 5 (`SEED-084/163/164/165/166`) |
| Key presence | `status` 278 · `title` 254 · `seed_id` 177 · `trigger_when` 157 · `relates_to` 144 · `surface` **128** |
| References to the 8 dup ids | **448 occurrences / 130 files** — **378 (84%) inside `.planning/milestones/`** |
| Open bus items | 5 `to:operator` · 26 `to:gemini` · 1 `to:claude` = **32 open**; 212 closed |
| BUS-171's 23 named items | **22 CLOSED**; only `BUS-040` still open |
| BUS-171 triage | **already shipped** at `88a9ff861`, 2026-09-14 — planted `SEED-276` via the third arm |

---

## Sweep design (REG-02)

### Q1 — How should the sweep decide a trigger has fired?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured fields beside the prose | Machine-readable `trigger_paths` / `trigger_surfaces` / `trigger_phase_touches` alongside the prose; sweep matches a phase's blast radius. Deterministic, RED-drivable; needs a backfill over ~157 seeds | ✓ |
| Deterministic narrowing, human rules | Extract every path/symbol/surface mentioned anywhere, match, print a ranked candidate list. Zero backfill; prints candidates, not verdicts | |
| Integrity gate only, no triggers | Check dup ids, bad status, missing keys, orphaned pointers; make no claim about triggers. Would be a written re-scope of REG-02's success criterion | |

**User's choice:** Structured fields beside the prose (→ D-01)
**Notes:** The prose is preserved as the human explanation. The rejected third option would have
required re-writing REG-02's stated success criterion.

### Q2 — How do the structured fields get populated across 283 seeds?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive all 157, leave 126 marked | Derive from existing prose; the 126 with no trigger get `trigger_when: unset` so they are visible as unswept rather than silently absent | ✓ |
| Backfill only live seeds | Only `planted`/`dormant`/`open` (~199 of 283); a re-opened seed comes back without fields | |
| New seeds only, backfill on touch | Template + `capture` require the fields going forward; existing seeds gain them when touched. Cheapest; leaves the sweep near-blind for months | |

**User's choice:** Derive all 157, leave 126 marked (→ D-02)
**Notes:** The 126 become a number that must shrink rather than a blind spot. The third option was
rejected against `SEED-172`'s measured four-week cost.

### Q3 — What actually RUNS the sweep?

| Option | Description | Selected |
|--------|-------------|----------|
| Script + wired into both GSD touchpoints | `check-seeds-register.cjs` plus an actual call in `discuss-phase` and `new-milestone` | ✓ |
| Script + a PostToolUse hook | Authoring-time guard on `.planning/seeds/` writes; catches malformed seeds but not fired triggers at phase start | |
| Both — gate at touchpoints, guard at authoring | Most complete; weigh against G-8's 3-5 plan cap | |

**User's choice:** Script + wired into both GSD touchpoints (→ D-03)
**Notes:** `grep -rln "SEED" .claude/commands/gsd/` returns `capture.md` only — the command that
*writes* seeds. The wiring is the deliverable, not the script.

### Q4 — What does "driven RED" mean for this gate?

| Option | Description | Selected |
|--------|-------------|----------|
| Four arms, incl. the counterfactual | dup id → FAIL · bad status → FAIL · matching trigger → PRINTED · **non-matching trigger → ABSENT** · plus a non-zero parsed-file count assertion | ✓ |
| Three arms, skip the counterfactual | Cheaper; accepts that an over-broad matcher printing every seed still reads green | |
| Snapshot the register as the fixture | Realistic input; the fixture rots on every new seed | |

**User's choice:** Four arms, incl. the counterfactual (→ D-04)
**Notes:** Arm 4 and the count assertion are the two things Phase 242 measured missing —
`check-hot-file-ledger.cjs` exiting `0` over zero parsed files, and an a11y suite red in neither knob.

---

## Duplicate resolution (REG-01)

### Q5 — How does a renumbered seed stay followable, given 84% of refs are in sealed archives?

| Option | Description | Selected |
|--------|-------------|----------|
| Renumber + leave a redirect stub | Old id keeps a `status: superseded-id` stub pointing at both resolutions; archives stay byte-unchanged | ✓ |
| Renumber + rewrite live refs only, no stub | Fix ~70 live occurrences; an archived reference becomes unfollowable | |
| Keep both, disambiguate by full slug | The id stops being the key; every bare `SEED-022` stays ambiguous forever | |

**User's choice:** Renumber + leave a redirect stub (→ D-05, D-06)
**Notes:** 378 of 448 references sit inside `.planning/milestones/`. Rewriting them would edit
history, which this project's conventions refuse.

### Q6 — Which seed of each pair keeps the id?

| Option | Description | Selected |
|--------|-------------|----------|
| Oldest keeps it — by `created` date | Deterministic, no judgement, matches what a pre-collision reference can only have meant, and is itself gate-checkable | ✓ |
| Most-referenced keeps it | Minimises stale references; optimises outcome over principle | |
| Case by case, decided in the plan | Highest fidelity; 8 judgement calls leaving no precedent for the ninth | |

**User's choice:** Oldest keeps it — by created date (→ D-07)

### Q7 — What stops the NINTH collision?

| Option | Description | Selected |
|--------|-------------|----------|
| Gate refuses a duplicate **+ an allocator** | Gate fails `[duplicate-id]`; `/gsd:capture` derives the next id from the register rather than from a human reading a listing | ✓ |
| Gate refuses a duplicate — detection only | Stops a collision reaching `develop`; two parallel agents still collide | |
| Drop sequential ids for date-time ids | Structurally collision-free; breaks the 276-seed numbering and every convention on it | |

**User's choice:** Gate refuses a duplicate + an allocator command (→ D-08)
**Notes:** The cause was two agents each reading "highest is N" and both writing `N+1`. A gate alone
addresses the symptom and blames the second agent.

---

## Register hygiene depth

### Q8 — How much frontmatter gets normalised?

| Option | Description | Selected |
|--------|-------------|----------|
| Required-key contract, gate-enforced | `seed_id, title, status, surface, trigger_when` across all 283; gate fails `[missing-key]` | ✓ |
| Only the keys the sweep reads | `status`, `surface`, triggers. Leaves reference-by-id unresolvable in 106 seeds | |
| Fix only what blocks the sweep running | The 5 missing-status seeds + status normalisation. Leaves `surface` at 128/283 | |

**User's choice:** Required-key contract, gate-enforced (→ D-09)
**Notes:** CLAUDE.md's documented `surface: Agentic-RAG` filter currently sees 128 of 283 — 45%.

### Q9 — How does the `status` enum land without destroying the prose it carries?

| Option | Description | Selected |
|--------|-------------|----------|
| Enum value + prose → `status_note` | Closed enum the gate validates; everything after the value moves verbatim into `status_note`. Mirrors the ledger's 200-char disposition rule | ✓ |
| Enum value + prose stays inline | Parser strips after the first `#`; zero edits, but a novel status spelling stays invisible | |
| Collapse to 3 values: live / answered / closed | Simplest filter; flattens `partially-answered` vs `answered`, a distinction this project uses deliberately | |

**User's choice:** Enum value + the prose moves to `status_note` (→ D-10)

### Q10 — How is the 283-file bulk pass proven lossless?

| Option | Description | Selected |
|--------|-------------|----------|
| Body byte-identical, proven by hash | Frontmatter only; every body md5-identical before/after; run prints files changed and keys added per file | ✓ |
| Diff review of a sample, then apply | Relies on a 20-file sample representing 283 demonstrably inconsistent files | |
| Hand-edit, no script | Highest fidelity, largest work, leaves no reusable instrument | |

**User's choice:** Body byte-identical, proven by hash (→ D-11)
**Notes:** Precedent named — `244-04` left `App.tsx` byte-unchanged and fenced it.

---

## REG-03's new shape

### Q11 — Given the premise rotted, what is the deliverable?

| Option | Description | Selected |
|--------|-------------|----------|
| Triage the 5 open + close BUS-171 in writing | Three-arm classification of `BUS-040/208/246/247/248`; record `88a9ff861` as the evidence discharging the 23-item premise | ✓ |
| Widen to all 32 open items | Includes 26 `to:gemini`; arguably Gemini's queue to answer | |
| Also audit the 22 closures | The third arm applied retroactively; 21 of the 22 are unaudited | |

**User's choice:** Triage the 5 open + close BUS-171 in writing (→ D-12)
**Notes:** Recorded as an **honest re-scope at discuss-phase**, not a quiet narrowing. The
requirement's goal is met; its stated count was stale. The unchosen third option is preserved as a
deferred idea with a re-open trigger.

### Q12 — What stops the operator queue filling back up silently?

| Option | Description | Selected |
|--------|-------------|----------|
| Age the queue in the SessionStart hook | Extend `agent-bus-check.sh` to print a one-line count of open `to:operator` items with the oldest age | ✓ |
| A triage command the operator runs | Complete on demand; only works when someone remembers to run it | |
| Leave it — REG-03 is a one-time triage | Smallest scope; accepts that the queue can go quiet again | |

**User's choice:** Age the queue in the SessionStart hook (→ D-14)
**Notes:** The queue went 23 → 5 because a person noticed, with no mechanism involved.

### Q13 — Are the 26 open `to:gemini` items in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope, but counted by the hook | Gemini's queue to answer; size made visible so it stops being invisible | ✓ |
| In scope — apply the third arm only | Don't classify or close, but verify each one's findings are held by a durable register | |
| Fully out of scope, not counted | Keeps the phase small; leaves 26 items unswept and unmeasured | |

**User's choice:** Out of scope, but counted by the hook (→ D-15)

---

## Claude's Discretion

The user ruled explicitly on **every** question — **no "you decide" answers were given.** Discretion
is confined to: the glob syntax/matching semantics of `trigger_paths`; the exact mapping table from
each of the 40+ existing `status` spellings onto the D-10 enum (⛔ every mapping must be listed in
the plan and its discarded prose preserved in `status_note`); and plan decomposition under G-8.

## Deferred Ideas

- Triaging the 26 open `to:gemini` bus items — out of scope per D-15; counted by the hook.
- Applying the third arm retroactively to the 22 already-closed `to:operator` items — 21 unaudited.
- Giving `.planning/reported-bugs/` (19 open) the same executable sweep.
- `bash scripts/agent-bus.sh triage` as an on-demand grouped queue printer.
- Timestamp-based seed ids (`SEED-260915a`) — rejected at D-08; re-open if a collision recurs despite
  the allocator.
