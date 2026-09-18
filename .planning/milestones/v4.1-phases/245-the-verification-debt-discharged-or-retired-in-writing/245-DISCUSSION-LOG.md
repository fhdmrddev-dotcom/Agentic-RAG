# Phase 245: The Verification Debt — Discharged or Retired in Writing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 245-the-verification-debt-discharged-or-retired-in-writing
**Areas discussed:** DEBT-03's real deliverable · DEBT-01's residue · How 233's five rows get driven ·
240's five mail rows + 237's rule-builder

⚠ **Before the first question, all four success criteria were measured at HEAD against the artifacts
rather than read from the register, and three were found NOT in the state the ROADMAP describes.**
That measurement reshaped every question below. It is recorded in full in
`245-CONTEXT.md` → `<measured_at_head>`. Summary: 238's nine rows were already driven (2026-09-07);
all three VERIFICATION.md files already say "self-verified" in prose; `OV-SOLO-01` is already written
in full at `STATE.md:474-497`. Only 233's five rows were genuinely owed.

---

## DEBT-03's real deliverable

### Q1 — What is the actual deliverable, given SC#3 is unsatisfiable as written?

| Option | Description | Selected |
|--------|-------------|----------|
| Add the greppable marker, keep the prose | `verification_mode: self-verified` + ⛔ OV-SOLO-01 comment in all three (243's pattern); 241 gains the field, 238/240 gain a frontmatter block; every honest sentence stays | ✓ |
| Marker + audit each 'reviewed' occurrence | Also read all 33 occurrences, re-wording any that CLAIM a review happened | |
| Prose only — no frontmatter change | Record SC#3 as already satisfied with line numbers, change nothing | |

**User's choice:** Add the greppable marker, keep the prose.
**Notes:** The literal reading of SC#3 would delete the honesty it exists to protect — "reviewed"
appears 11× per file in sentences *naming the review that is owed*. What "cannot lapse unnoticed"
needs is machine-checkability. The 33-occurrence audit was the rejected option precisely because it
is the re-review the ROADMAP forbids.

### Q2 — Executable enforcement, or convention?

| Option | Description | Selected |
|--------|-------------|----------|
| A gate script, driven RED | `scripts/check-verification-honesty.cjs`, driven RED against a planted defect before being trusted | ✓ |
| Convention + a line in CLAUDE.md | Write the rule down, rely on each verifier reading it | |
| Marker only, no enforcement | Write the field into three files and stop | |

**User's choice:** A gate script, driven RED.
**Notes:** 243 and 244 carry the field only because those phases remembered to; nothing checks it.
Cited against the convention option: this project's own finding that *a fact in a register nobody
re-reads is the same as no fact*, paid for twice on the `tsc --noEmit` gate. Also the CLAUDE.md
150k precedent — the first split "changed nothing structural" and the trip recurred.

### Q3 — When does the gate fire?

| Option | Description | Selected |
|--------|-------------|----------|
| PostToolUse on any `*-VERIFICATION.md` write | Mirrors `hot-file-ledger-guard.js`; fires in the turn the verifier authors the file | ✓ |
| Script only, run at phase close | No hook; depends on a step remembering to call it | |
| Hook + CI backstop, both | The full `claude-md-size` arrangement | |

**User's choice:** PostToolUse on any `*-VERIFICATION.md` write.
**Notes:** The measured argument against CI-only was decisive — `develop` once ran **634 commits over
8 days without a push**, so an `on: push` gate could not have fired once in that window, and a
verification written and committed in one session would slip past it entirely. The CI backstop was
declined as a second file to keep in sync over a planning-doc rule.

### Q4 — What does 245 do about SC#4, already satisfied in full?

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm in writing with line numbers, add nothing | Record SC#4 measured satisfied at `STATE.md:474-497`, quoting the four elements and the trigger | ✓ |
| Confirm + make the re-arm trigger executable | Also build something that fires at "Gemini returns, or the v4.1 close" | |
| Re-derive the ruling from scratch | Treat as unmet until 245 rewrites the entry | |

**User's choice:** Confirm in writing with line numbers, add nothing.
**Notes:** A criterion already true is discharged by evidence, not by rewriting it; rewriting a
correct operator-authored ruling is churn. Making the trigger executable was acknowledged as the one
arm that would buy new safety — deferred rather than dismissed (CONTEXT `<deferred>`).

---

## DEBT-01's residue, now that the nine are driven

### Q1 — M-9: drive it, or retire it?

| Option | Description | Selected |
|--------|-------------|----------|
| Drive it — create the rule, import both doors | Fully drivable today; doubles as 237's first click | ✓ |
| Retire with a named trigger | The `path` fact is proven in the DB; only end-to-end matching is unproven | |
| Drive the rule only, skip the manual-import arm | Confirm on the watched document, leave the manual door owed | |

**User's choice:** Drive it — create the rule, import both doors.
**Notes:** The manual-import door is exactly where Defect 3 lived (`metadata.source` had two writers;
only the watch one was fixed), so the arm with the worse track record is the one that must be driven.
Cheapest honest discharge of two debts in one drive.

### Q2 — Where does S-1/S-2's retirement get written?

| Option | Description | Selected |
|--------|-------------|----------|
| All three registers, same commit | 245's verdict + `REQUIREMENTS.md` DEBT-01 row + `SEED-256` frontmatter, in one commit | ✓ |
| 245's verdict file + the seed | Leave REQUIREMENTS.md to the milestone close | |
| The seed only | SEED-256 is the durable home and already has four triggers | |

**User's choice:** All three registers, same commit.
**Notes:** Follows the existing same-commit sync rule (`Dockerfile.sandbox` ↔
`docs/SANDBOX-PACKAGES.md`; ledger row ↔ detail section). Seed-only was rejected on CLAUDE.md's own
measurement that the seeds register is swept by **nothing**. REQUIREMENTS.md was kept in because it
has been stale for four consecutive milestones by its own admission.

### Q3 — How is the stale "238 is blocked" claim corrected?

| Option | Description | Selected |
|--------|-------------|----------|
| Correct beside the original, never over it | House style; all four homes (ROADMAP, REQUIREMENTS, STATE.md, memory file) | ✓ |
| Overwrite with the measured truth | Shorter and easier to read | |
| Correct only where it would mislead a planner | Fix ROADMAP + REQUIREMENTS, leave STATE.md and memory | |

**User's choice:** Correct beside the original, never over it.
**Notes:** Overwriting would erase the evidence that three registers carried one false claim for six
days, which is this phase's most transferable output. STATE.md was explicitly kept in scope because
it is the file loaded at every session start.

### Q4 — M-8's headline still reads HALF PASS although its failing half was fixed.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-word to PASS, keep the half-pass history | Flip the headline, preserve the history inline | ✓ |
| Re-drive it, then re-word | Re-confirm disabled-refuses / enabled-allows live first | |
| Leave HALF PASS as shipped | Archival honesty; note the closure elsewhere | |

**User's choice:** Re-word to PASS, keep the half-pass history.
**Notes:** The row's own cell already records the fix and both drive directions; only the headline
disagrees with its own body — DEBT-03's failure mode mirrored. Re-driving was declined because it
means disabling a live integration again for a result already in the file. SC#1 admits only pass /
blocked / retired; "half" is none of those.

---

## How 233's five rows get driven

### Q1 — Fixture handling, given rows 3/4 write real documents?

| Option | Description | Selected |
|--------|-------------|----------|
| A dedicated throwaway Drive folder + a named Library folder | Purely additive; 243's "deletable" precedent | ✓ |
| An existing real Drive folder | More realistic; the 2026-09-05 import that found six defects was one | |
| You choose the folder at drive time | Defer the choice | |

**User's choice:** A dedicated throwaway Drive folder + a named Library folder.
**Notes:** The operational payoff is row 2 — its four-table unchanged-check becomes trivially
provable because the baseline is a folder that did not exist before. Deferring the choice was ruled
out because the fixture shape decides how rows 2 and 4 are measured, so the plan cannot write its own
acceptance criteria without it.

### Q2 — Who drives?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drives 1-4, operator does the Drive-side setup | Credentials and source-side writes are the operator's; observation is Claude's | ✓ |
| Operator drives all five, Claude reads the evidence | Closest to 238's operator rows | |
| Claude drives all five including the Drive setup | Fastest if the connection is already live | |

**User's choice:** Claude drives 1-4, operator does the Drive-side setup.
**Notes:** Split on the real boundary. 243 established self-driving is sound **when attribution is
verifiable** — true here (one connection, not eight providers, which is what killed 243's
cross-provider board). Claude driving the Drive setup was ruled out because creating a Drive folder
is a write to the operator's account, and 243 recorded a Google sign-in refusing a DevTools-driven
Chrome.

### Q3 — Row 5 needs a native Google Doc already in the Library.

| Option | Description | Selected |
|--------|-------------|----------|
| Put a native Doc in the fixture folder; row 5 runs after row 3 | One fixture serves all five; dependency becomes drive order | ✓ |
| Use a Google Doc already in the Library | Row 5 could run first | |
| Drive rows 1-4 and retire row 5 with a trigger | Four verdicts now | |

**User's choice:** Put a native Doc in the fixture folder; row 5 runs after row 3.
**Notes:** Noted during the answer: rows 4 and 5 overlap — both re-preview after an import — so they
may share one observation pass with two distinct assertions. An existing Library Doc was rejected for
reintroducing the live-corpus baseline the fixture decision had just removed. Retiring row 5 was
rejected because it is the *can't tell* → *already here* path, the preview's whole uncertainty story.

### Q4 — Where do the verdicts land?

| Option | Description | Selected |
|--------|-------------|----------|
| One `245-UAT-RESULTS.md`, 243's shape | Frontmatter with driven/partial/owed lists + a section per row | ✓ |
| One results file covering ALL of 245's drives | Fewest artifacts | |
| Per-row files, 244's shape | Most granular | |

**User's choice:** One `245-UAT-RESULTS.md`, 243's shape.
**Notes:** Per-row files earn their keep when each row rides its own plan (244 had six); this phase
targets 2-3, so five files would be overhead against G-8. Consequence captured in CONTEXT D-12: the
file covers both DEBT-01 and DEBT-02 rows, so each row must state which requirement it discharges,
since the filename no longer says.

---

## 240's five mail rows + 237's rule-builder

### Q1 — What does 245 do with 240's five owed mail rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Name them deferred, with a trigger each | Out of scope by the ROADMAP's wording, but recorded so they don't go silent again | ✓ |
| Fold all five in and drive them | Discharge the whole mail debt while a browser is open | |
| Fold in M-1 only | Drive the row that unblocks the other two | |

**User's choice:** Name them deferred, with a trigger each.
**Notes:** Folding five more live rows — M-4 disables a live integration, M-5 deletes at the source —
into a 2-3 plan phase is the consolidation failure mode PROJECT.md names. But going silent is how
they got here, and "the next milestone opens on ground whose measured extent is known" is this
phase's actual goal. M-1-only was rejected as the shape that reads as done and is not.

### Q2 — Does the M-9 drive discharge 237's never-clicked rule-builder?

| Option | Description | Selected |
|--------|-------------|----------|
| It discharges it, and the verdict must say which rows it covers | Partially discharged; name what the click covered and what it did not | ✓ |
| Treat it as fully discharged by the M-9 click | One real click ends "never manually clicked" | |
| Keep it separate — defer with its own trigger | Don't let M-9 count for 237 | |

**User's choice:** It discharges it, and the verdict must say which rows it covers.
**Notes:** 237 shipped a scope selector and out-of-scope condition filtering on scope switch, which a
single `path contains` rule does not exercise. Claiming "clicked" on one of three behaviours is the
same half-pass problem M-8 and M-9 are being corrected for.

### Q3 — `SEED-177`'s Flags claim is stale twice over.

| Option | Description | Selected |
|--------|-------------|----------|
| Record the Flags item as refuted; touch the seed only where wrong | Fix the prose (ROADMAP + CLAUDE.md), leave a correct seed alone | ✓ |
| Also sweep the seed's other triggers | Rule on all four `trigger_when` arms | |
| Drop the item from 245 entirely | The claim is false, so nothing to do | |

**User's choice:** Record the Flags item as refuted; touch the seed only where wrong.
**Notes:** Measured: the seed reads `status: partially-answered`, and its own frontmatter already
records the egress-fence trigger as answered by Phase 206. CLAUDE.md carries the same false sentence,
so the stale claim has two homes. A broader sweep was declined — SEED-177 is high-priority with Open
Platform attached, so ruling on its other triggers is a capability decision, not bookkeeping.

### Q4 — Where is the fast-fix line if a driven row exposes a defect?

| Option | Description | Selected |
|--------|-------------|----------|
| G-3's existing line — ≤1 file, ≤10 lines, no schema or API surface | Use the threshold already in CLAUDE.md | ✓ |
| Anything whose fix is provable by one driven re-run | The standard 238's M-8 fix met | |
| Zero fixes — file everything | 245 changes no source at all | |

**User's choice:** G-3's existing line — ≤1 file, ≤10 lines, no schema or API surface.
**Notes:** Driving has a strong defect-finding record here: one Drive folder found six defects
(2026-09-05); 238's rows found four, none caught by the unit suite. 238 could fix same-day because it
was a build phase with a plan budget; 245 has none. The "any size if one re-run proves it" option was
rejected for having no size bound — which is how a two-line honesty phase becomes the largest in the
milestone. Zero-fixes was rejected as too rigid against a one-line obvious fix.

---

## Claude's Discretion

- Field ordering and comment wording inside each new frontmatter block, provided the literal token
  `verification_mode: self-verified` is present and the guard accepts it.
- Whether the guard is a standalone `.cjs` the hook shells out to, or hook logic with the `.cjs` as
  the CI-callable entry point — as long as it is hand-invokable and driven RED.
- Structure of `245-UAT-RESULTS.md` beyond the frontmatter shape.
- Which specific files go in the throwaway Drive fixture, beyond "a handful" and "one native Doc".

## Deferred Ideas

- 240's five G-4 mail rows (M-1…M-5) — trigger: the next mail-ingestion phase, or the v4.1 close
  sweep. ⚠ No mail watch has ever run in this product.
- 237's scope selector + out-of-scope condition filtering — trigger: the next classification-rules
  phase.
- `SEED-177`'s remaining `trigger_when` arms — trigger: `SEED-013` / Open Platform getting a phase
  number.
- Making `OV-SOLO-01`'s re-arm trigger executable — trigger: the v4.1 close.
- The 13 `SECURITY DEFINER` functions still `anon`-executable (migration 177's own prediction).
- `BUS-171` — the 23-item operator queue triage, 6 days old. Parked, not dropped; it is a triage
  deliverable for the operator, not verification debt.
- 238's unfiled observation: deleting a watch cascade-deletes its entire run history
  (`connector_sync_runs`, `connector_watch_items`). May be intended; deserves a deliberate decision.
