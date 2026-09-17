# Phase 254: Independent review of 249-253 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-17
**Phase:** 254-independent-review-of-249-253
**Areas discussed:** Review set (5 or 10 phases), What happens if Gemini stays silent, Depth per phase, The artifact and the closing condition

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Review set — 5 or 10 phases | Your five vs DEBT-06's named set vs all ten | ✓ |
| What happens if Gemini stays silent | Five asks already filed, unanswered behind a 9-item queue | ✓ |
| Depth per phase — uniform or risk-ranked | 251 has no review at all; the other four have a claude pass | ✓ |
| The artifact and the closing condition | What must exist for a row to stop reading `owed` | ✓ |

**User's choice:** all four.

---

## Review set — 5 or 10 phases

| Option | Description | Selected |
|--------|-------------|----------|
| 249-253 only | The five v4.2 phases that closed self-verified; makes the current milestone closeable | ✓ |
| DEBT-06's set only — 238/240/241/242-246 | What the requirement literally names; leaves the freshly-built five unreviewed | |
| All ten — both sets | Full discharge, but ten reviews is not a G-8-sized phase | |

**User's choice:** 249-253 only → **D-01**.
**Notes:** The older arm stays visible as `BUS-252`..`BUS-255` rather than dropped.

### Sub-question: DEBT-06's wording

| Option | Description | Selected |
|--------|-------------|----------|
| Amend DEBT-06 to name every owed phase | Re-derive the list from the `*-VERIFICATION.md` files, not from typing | ✓ |
| Leave it — record that 254 does not tick it | Honest, but keeps a requirement whose text and usage disagree | |
| New requirement id for v4.2's own five | Clean separation, but moves a denominator v4.2 froze at 26 | |

**User's choice:** amend → **D-02**.
**Notes (raised by Claude, not asked):** amending widens the requirement to ten phases, so 254 closes
only its 249-253 arm and `DEBT-06` stays untickable at this phase's close — recorded as **D-03** so
the consequence is not discovered later.

---

## What happens if Gemini stays silent

| Option | Description | Selected |
|--------|-------------|----------|
| Time-boxed, then written refusal | A stated window; anything unanswered converts to a refusal naming the decider | ✓ |
| Block until Gemini answers all five | Purest independence; the phase gets no completion condition it controls | |
| Claude reviews now, recorded as self-assessed | Fast and it does find defects, but ticks nothing under §6.3 | |
| Chase + escalate the bus first | Treat the 9-item backlog as the problem to solve first | |

**User's choice:** time-boxed, then written refusal → **D-04**.

### Sub-question: who may write a refusal

| Option | Description | Selected |
|--------|-------------|----------|
| Operator ruling, Claude drafts the file | Matches REG-03 and DEBT-06's "naming who decided and why" | ✓ |
| Claude writes it unilaterally | The builder judging its own work — the thing §6.3 exists to prevent | |
| You write it yourself | Maximum authority, zero drafting help | |

**User's choice:** operator rules, Claude drafts → **D-05**.

---

## Depth per phase (and the window the time-box needs)

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days — deadline 2026-09-24 | Items are 1 day old; the bus hook goes loud at 3 days | ✓ |
| 48 hours | May expire on queue depth rather than on Gemini declining | |
| Until milestone close | Unbounded, and the milestone is what DEBT-06 gates | |

**User's choice:** 7 days → **D-04** deadline.

| Option | Description | Selected |
|--------|-------------|----------|
| Risk-ranked | 251 (no review at all) → 253 → 252 (security-bearing) → 249 → 250 | ✓ |
| Uniform — same depth for all five | Simple, but spends equal effort on the reviewed and the unread | |
| Only what is missing — 251 alone | Accepts builder self-assessment as the quality bar on four phases | |

**User's choice:** risk-ranked → **D-07**.

| Option | Description | Selected |
|--------|-------------|----------|
| Amend the five bus asks in place | Add deadline + rank; keeps ids stable | ✓ |
| Leave them untouched | Gemini never learns there is a deadline | |
| Close and re-file as one consolidated ask | Cleaner queue, but Claude may not close bus items (REG-03) | |

**User's choice:** amend in place → **D-06**.

---

## The artifact and the closing condition

| Option | Description | Selected |
|--------|-------------|----------|
| In the reviewed phase's own directory | `<phase>-REVIEW-IND.md` / `<phase>-REVIEW-REFUSAL.md` beside the phase it judges | ✓ |
| All five inside 254's directory | Reads as one set; a future reader of 251 sees no sign it was reviewed | |
| One combined file in 254 | Smallest artifact, hardest to flip per-phase state from | |

**User's choice:** the reviewed phase's own directory → **D-09**.

| Option | Description | Selected |
|--------|-------------|----------|
| All four registers, Claude writes, operator rules | frontmatter + ROADMAP + REQUIREMENTS + bus (operator closes) | ✓ |
| Frontmatter + ROADMAP only | Leaves the DEBT-06 line wrong in the meantime | |
| Summary table now, registers swept at close | Defers the propagation step that has silently failed before (248's checklist box) | |

**User's choice:** all four → **D-10**.

| Option | Description | Selected |
|--------|-------------|----------|
| Triage list for operator ruling; fixes are separate | Findings + recommended disposition each | ✓ |
| Fix anything `/gsd:fast`-sized inline | Reviewer fixing its own finding stops being independent of it | |
| Fix everything found, in 254 | Unboundable; the G-7 runaway Phase 187 measured | |

**User's choice:** triage only → **D-11**.

---

## Closing fork: 251, which has no review of any kind

| Option | Description | Selected |
|--------|-------------|----------|
| Run a claude pass on 251 as a floor | `/gsd:code-review 251`, labelled self-assessed; ticks nothing | ✓ |
| No — refusal alone is the honest record | Cheapest; leaves one phase wholly unread | |
| Only if the deadline actually expires | Avoids duplicate work; pushes work to the close | |

**User's choice:** run the floor pass → **D-08**.

---

## Claude's Discretion

- Shape and section order of `<phase>-REVIEW-IND.md`, `<phase>-REVIEW-REFUSAL.md`, and 254's index.
- The per-phase review brief appended to each amended bus item (`BUS-256`'s brief is the pattern).
- Plan decomposition within G-8's 3-5 plan target.

## Deferred Ideas

- The older owed arm — 238 / 240 / 241 / 242-246 (`BUS-252`..`BUS-255`). Re-open at
  `/gsd:complete-milestone`.
- The 9-item Gemini queue as a problem in its own right. Re-open if 2026-09-24 passes unmoved.
- `BUG-260916-01` — live defect in Phase 249's domain; an INPUT to 249's review, not a fix for 254.
- `spike-nl-workflow-authoring.md` — todo matched at score 0.6 on keywords only; reviewed, not folded.
