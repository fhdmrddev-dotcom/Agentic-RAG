# Phase 247 — Sketch brief for Gemini

**Written by:** Claude, 2026-09-14, at the operator's direction (*"I will hand sketch to gemini"*).
**Command to run:** `/gsd:sketch 247`
**Why this exists:** G-2 fires on 247, so `/gsd:sketch` must clear **before** `/gsd:plan-phase 247`.
This brief is the scope, the constraints and the acceptance bar, so the sketch does not have to
re-derive them from the register.

⚠ **Roles under the re-armed `OV-SOLO-01` (2026-09-13):** Gemini sketches and builds; **Claude
reviews and does not shape the build.** `AGENTS.md` §3 / §6.3 — *whoever REVIEWS a phase must not
have shaped it.* **This brief is scope transfer, not design direction.** Every design decision below
is stated as a *constraint already recorded elsewhere in the repo*, never as a preference of mine. If
something here reads like a design opinion, treat it as out of scope and take it to the operator —
decisions go `--to operator`, never settled agent-to-agent.

---

## The phase in one sentence

**A watched source tells the truth about itself** — what it brought in, where that came from, whether
it is healthy, and when something went missing.

**Why now:** v4.0 built the watch loop, v4.1 deployed it, and it reached real users for the first
time on **2026-09-13** (`production` = `eebc4c42f`). These eight defects are what stands between
*"it shipped"* and *"you can rely on it"*.

---

## The eight requirements, with their source reports

Read each report before sketching — ⚠ **and drive the claim before designing against it.** This
milestone's scoping found **two** `status: open` blocking reports that were already fixed and one
that read the same way and was live. A report is a CLAIM about code, not the code.

| REQ | Report file (in `.planning/reported-bugs/`) | Sev |
|---|---|---|
| `WATCH-01` | `google-drive-adapter-never-writes-source-path.md` | major |
| `WATCH-02` | `onedrive-adapter-silently-truncates-and-mismatches-folder-paths.md` | major |
| `WATCH-03` | `BUG-260909-03-a-watch-card-reads-its-last-run-not-the-connection-it-rides.md` | major |
| `WATCH-04` | `BUG-260909-04-sync-now-collapses-the-whole-section-and-throws-away-the-answer.md` | major |
| `WATCH-05` | `BUG-260909-05-missing-since-is-never-set-so-a-missing-file-cannot-say-when.md` | minor |
| `WATCH-06` | `BUG-260909-06-a-fix-button-labelled-as-a-write-only-navigates.md` | minor |
| `WATCH-07` | `BUG-260909-07-last-read-successfully-on-a-relative-time.md` | info |
| `WATCH-08` | `BUG-260910-02-phase-240-build-review-open-warnings.md` | minor |

Full requirement wording: `.planning/REQUIREMENTS.md` → *Sources & Watches*.
Success criteria + flags: `.planning/ROADMAP.md` → `#### Phase 247`.

---

## What the sketch must cover — and what it must NOT

**Sketch these (they are surface decisions):**

- **`WATCH-03` — the watch card.** Today it reports its **last run's** outcome as though that were the
  connection's health. The card must let a person distinguish *the connection is fine, that run
  failed* from *the connection is broken*. Two independent facts, one card.
- **`WATCH-04` — where "Sync now" puts its answer.** Today the section it reports into collapses, so
  the answer is thrown away. Where does the result land, and what does the section do while the sync
  runs?
- **`WATCH-05` / `WATCH-07` — the time vocabulary.** A missing file must say *when* it went missing,
  and no timestamp may concatenate absolute with relative (*"Last read successfully on 8 min ago"*).
  These two are the same decision seen twice: **one rule for how this surface states a time.**
- **`WATCH-06` — the label/behaviour contract.** A control worded as a write must write; one that
  navigates must read as navigation.

**Do NOT sketch these (they are backend correctness, no surface):**

- **`WATCH-01` / `WATCH-02`** — adapters not writing / truncating `metadata.source.path`. ⚠ There may
  be a **downstream** surface consequence worth drawing (a document whose path is missing, a
  classification rule that silently never matched), but the fix itself is backend.
- **`WATCH-08`** — dispositioning Phase 240's seven build-review warnings. Paperwork with a real
  deliverable, no pixels.

---

## Binding constraints — recorded, not my preference

1. ⚠ **These are LEGIBILITY complaints, and that sets the acceptance bar.** From the roadmap, verbatim:
   *a wire-format fix that does not change what a person reads has not satisfied this phase.*
   ⭐ This project has already shipped a legibility defect underneath a **green** composition fence,
   because **presence assertions cannot see content drift** — a test that asserts a block exists by
   `data-testid` says nothing about the words inside it. **Assert the rendered CONTENT where the
   words are the deliverable.**

2. ⭐ **Load `Skill("sketch-findings-agentic-rag")` before drawing.** It owns the validated design
   decisions and CSS patterns for these surfaces, including the icon convention. Drawing against it
   is cheaper than re-deriving it and keeps the surface in one visual family.

3. **Design system:** Aether Intelligence / Deep Midnight, Tailwind + shadcn/ui. Mobile-responsive.

4. ⚠ **Sketch with REALISTIC data, not fixtures.** A recorded operator preference — a sketch drawn on
   `Lorem ipsum` and three tidy rows hides exactly the cases these eight bugs live in (a long folder
   path, a failed run under a healthy connection, a file missing for nine days).

5. ⚠ **Verify any JS in the sketch before handing it over.** Another recorded lesson: a sketch that
   draws something the real component cannot render creates a build obligation nobody agreed to.

6. **The operator-approved mockup IS the acceptance bar.** The sketch is not advisory here; G-2 makes
   it the gate. Take the mockup to the operator, not to me.

---

## Traps already measured — do not re-discover these

- ⛔ **`backend/app/api/connectors.py` has a G-5 extraction OWED at its SIXTH landing**
  (2051→2071→2091→2102→2113→2140 lines). A plan landing there must say why it is not the seventh.
  Read that file's section in `docs/HOT-FILE-LEDGER.md` before planning.
- ⛔ **`backend/app/services/sources/failure_cause.py`** — its `Cause` union must stay **ONE plain-text
  line**. A frontend suite binds it by `?raw`, and a computed union is invisible to that fence.
- ⚠ **`frontend/src/components/sources/sourceHealthVocabulary.ts`** fires G-5 on the next touch, and
  `WATCH-03` is squarely a health-vocabulary change. It already carries **six** causes.
- ⚠ **`frontend/src/components/sources/sourceComposition.test.tsx` is a STANDING RED** at ~18 failed /
  31 passed, in **neither** count-gate knob by a Phase 235 decision. **It is inherited, not yours** —
  but establish that at your base commit before you touch the directory, or you will own it.
- ⚠ **`GSD_VITEST_MAX_WORKERS=2`**, run the count gate from the **repo root**, and capture failing
  filenames from the gate's persisted JSON **before** re-running anything. `SEED-171` names five
  suites that flake independently of the cap.
- ⚠ **Worktrees:** `bash scripts/bootstrap-worktree.sh "$(pwd)"` is the FIRST action in any worktree,
  before the HEAD assertion. Never `rm -rf` one — `bash scripts/teardown-worktree.sh <path>`.
- ⚠ **Base SHA:** `origin/HEAD` is `master`. State the base SHA explicitly and assert it — five
  consecutive executors have had to reset because a worktree started on the default branch.
  **Current `develop` tip at the time of writing: `1db32c863`.**

---

## Also owed at this phase's close, not by the sketch

- **242's UAT row 5** is unblocked and owed — the 2026-09-13 promotion was literally its trigger.
  Save a value on Settings → Search **in production**. It can ride 247's close.
- ⛔ **241's UAT row 5 is EXPIRED, not owed.** Migration 176 was already in cloud, so the "no columns"
  arm it existed to prove is unreproducible forever. Do not re-open it as *"never run"*.

---

## What Claude is doing in parallel (so we do not collide)

- **Reviewing Phase 246** — `BUS-202`, Gemini's own build, awaiting post-phase review.
- **`DEBT-06`** — the owed independent §6.3 reviews on 238, 240, 241 and 242-246.
- ⛔ **Not touching 247's files**, so the review of this phase stays independent.
