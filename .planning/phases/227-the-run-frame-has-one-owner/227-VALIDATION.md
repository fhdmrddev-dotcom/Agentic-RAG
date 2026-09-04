---
phase: 227
title: "SC#2 — nothing changes on screen"
driven_by: claude (reviewer) with the operator, in a real browser
date: 2026-09-04
before: 7334f8d84   # the pre-flight commit, immediately before Wave 1
after: 57274c7e0    # Phase 227 complete (Waves 1-3)
verdict: "SC#2 DISCHARGED — all eight run states render identically across the two builds."
---

# Phase 227 — SC#2 validation: the before/after drive

## How it was driven, and why this is stronger than screenshots

Two dev servers, **one backend**, the same signed-in account, the same threads:

| Port | Build | Commit |
|---|---|---|
| `5173` | **AFTER** — Phase 227 complete | `57274c7e0` |
| `5174` | **BEFORE** — pre-227 | `7334f8d84`, in a bootstrapped worktree at `.claude/worktrees/pre227` |

One backend serves both because **Phase 227 changed no wire format** — that is what makes the
comparison sound rather than convenient. The same thread therefore renders from byte-identical
server data on both sides, and any difference is the frontend's.

⚠ **The comparison is the normalized rendered DOM, not a screenshot.** Radix-generated ids,
`aria-controls` / `aria-labelledby` and tick durations are stripped; for the live run the text
nodes are stripped too, since timers move while the run is streaming. A screenshot comparison
would have been defeated by animation timing and by the reviewer's own eyes — **the failure mode
this phase's ROADMAP names outright**: *"a refactor with no visual contract is a rewrite with
extra steps."*

⚠ **Two of the eight states were reached by DATABASE QUERY, not by hunting the sidebar.** The
run-status distribution in local Postgres is `completed 1264 · failed 159 · cancelled 56 ·
timed_out 7`, and the timed-out and sub-agent threads were selected from it by name. Guessing
which thread holds which state is how a state gets silently skipped and the table still reads
complete.

## The eight states

| # | State | Thread driven | Result |
|---|---|---|---|
| 1 | streaming (live) | new run, same prompt sent to both tabs | **IDENTICAL** — strip ×1, rows ×3, nodes ×3, rails ×2, snums ×3 (text-stripped skeletons) |
| 2 | settled | `Latest BOQ Price Search Request` | **IDENTICAL** — collapsed cards 1016 chars ×2; step rows 1177 / 1308 / 1386 / 1308; rail nodes 164 ×4 |
| 3 | failed | `Write and run a Python script that benchmarks…` | **IDENTICAL** — 1 row, 1 node |
| 4 | timed-out | `generate weekly report` | **IDENTICAL** — 3 rows, 3 nodes; *"Agent reached time limit"* present on both |
| 5 | cancelled | `History of the Internet` | **IDENTICAL** — *"Response stopped"* present on both |
| 6 | paused on approval | `UAT-C · approval pause (delete me)` | **IDENTICAL** — 2 rows, 1951 chars each |
| 7 | no tools | `Short Greeting Message` | **IDENTICAL** — 0 rows, 0 nodes on both |
| 8 | sub-agent | `can you search for RPA research and create…` | **IDENTICAL** — 3 rows, 3 nodes |

Raw captures are under the session scratchpad (`{before,after}-{runcards,steps,approval,sweep,sweep2,live}.json`);
each pair was diffed with `difflib` per element rather than compared by length alone.

## Two observations recorded rather than left implicit

- **`status-pill` count is 0 on every done step, on BOTH builds.** The operator's 2026-08-31
  noise audit renders exactly as decided, and it is unchanged by the refactor. ⚠ This is also
  why plan `227-01` had to correct a stale assertion rather than "fix" the component — the test
  was wrong, the shipped behaviour was right, and both facts are now proven from the running app.
- **"↓ Jump to live" appeared** during the live run once the view had been scrolled. So the
  follow-but-release affordance **exists and renders**; `BUG-260904-02` is therefore a *re-arming*
  defect, not a missing release. That narrows the search for whoever fixes it.

## What this does NOT prove

- **Pixel-level styling.** The DOM (tags, classes, attributes) is identical, so any pixel
  difference would have to come from CSS that changed outside these components. Phase 227 touched
  no stylesheet — but this drive did not measure rendered pixels, and saying otherwise would be
  the "shipped green against the wrong contract" failure again.
- **`BUG-260904-03`** (active-tool mark black in light theme) is **not attributable to 227**:
  the classes on the active node are byte-identical across the two builds, so whatever produces
  the black is present in the BEFORE build too. That is the check the bug report asked for, and
  it clears this phase.
- The states were driven on **one thread each**. A state is a shape, not a single row.
