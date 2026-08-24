---
phase: 189
plan: 16
subsystem: phase-close-validation-and-driven-uat
tags: [wave-9, stale-figure-correction, coverage-consolidation, driven-uat, chrome-mcp, two-sessions, blocker-found-and-cleared, failed-row-into-successor]
written: 2026-08-08
written_at: /gsd:verify-work 189
requires:
  - "189-01..15 — every automated V row this plan consolidates; the plan asserts nothing of its own about them"
  - "189-06 — migration 115 applied to the live local DB, which is U7 and the precondition for any recorded_not_sent row"
  - "BUG-260807-02 (quick-260808-148 + quick-260807-x9p) — the StepTypePicker fixes WITHOUT WHICH the 7th step type could not be placed at all; the second session depends on them"
provides:
  - "the corrected migration-head figure in ROADMAP.md — live head is 115, not 113 (T-189-48)"
  - "the consolidated coverage map in 189-VALIDATION.md — 23/23 automated V rows with commands and verdicts, 7 driven U rows"
  - "the DRIVEN evidence for U1-U7, D-25, CR-02, SC#4 and D-19 — the claims a green unit suite structurally cannot make"
  - "BUG-260807-02 — the blocker this plan FOUND (the 7th type unreachable by mouse), since fixed and closed"
  - "BUG-260808-01 — the seventh WR-04 sink, found by the one row that FAILED"
  - "SEED-140, SEED-141, BUG-260808-02 — three operator observations captured and routed OUT of 189"
affects:
  - "189-VALIDATION.md nyquist_compliant: false -> true — this plan's Task 3 IS that flag's written trigger"
  - "Phase 190 — inherits BUG-260808-02 (approval hands off to chat), the D-189-DEF-04 residual, and the approve-label surface this plan's UAT flagged"
tech-stack:
  added: []
  patterns:
    - "a driven row is worth more than a green suite, and a FAILED driven row is a result rather than a gap"
    - "an occlusion check is worthless unfalsified — plant, observe the failure, remove, observe the pass"
    - "when a blocker stops a session, name it and record the rows it blocks rather than reporting what passed"
---

# 189-16 — Phase close: stale-figure correction, coverage consolidation, and the driven UAT

> ⚠ **This SUMMARY was written retroactively at `/gsd:verify-work 189` (2026-08-08), not by the
> executor.** The plan's three tasks were all committed — the file was simply never written, and the
> missing artifact tripped the transition safety rail at 16 plans / 15 summaries. Everything below is
> reconstructed from the four commits and from `189-VALIDATION.md`, which is where this plan's
> evidence actually landed. Nothing here is a fresh claim: every figure is quoted from a committed
> artifact, and where this workflow re-verified something independently it says so.

## The commits

| Commit | Task | What |
|---|---|---|
| `7a78fd87` | 1 | correct the self-contradicting migration head — live head is **115**, not 113 |
| `7d82e6bc` | 2 | consolidate the validation coverage map — 23/23 automated, 6 driven rows NOT driven |
| `267df91d` | 3 | drive the live UAT session — **8 PASS · 3 owed · 1 NEW BLOCKER** |
| `00afaa55` | 3 | drive the owed rows on a PUBLISHED external-action workflow |
| `5a4f4228` | 3 (fallout) | capture three operator observations — **NOT folded into 189** |

## Task 1 — the stale figure (T-189-48)

Both stale ROADMAP bullets were corrected against a re-derived `ls supabase/migrations/`. This is
not tidiness: a letter-suffixed migration is **silently skipped by the Supabase CLI**, so a future
executor authoring `115_*` from a stale "head is 113" reading would collide. Independently
re-verified at this gate — `ls supabase/migrations/ | tail` reads `112 / 113 / 114 / 115`.

## Task 2 — the coverage map

23 automated V rows, each with the command that produces it and its verdict, plus 7 driven U rows
with an explicit owed/blocked state. The map's own honesty rule is what makes the rest of this file
readable: **rows may be blocked, but never silently omitted** (T-189-50).

At the time Task 2 closed, the board read **1 driven (U7) · 1 half (U3) · 5 not driven**. That is the
state Task 3 inherited, and it is why `nyquist_compliant` was deliberately held `false`.

## Task 3 — the driven UAT, across TWO sessions

### Session 1 (2026-08-07) — 8 PASS, and a blocker that stopped the rest

**The blocker was the phase's own headline capability: the 7th step type could not be placed with a
mouse.** The `StepTypePicker` menu renders inside a `.react-flow` container with `overflow-y: hidden`,
is `position: static` / `z-index: auto`, and is not scrollable — rows past the container's bottom edge
were clipped with **no scroll path to them at all**. Rows 6 and 7 (row 7 being this phase's type) were
unreachable. All three insertion doors failed identically; four independent user actions were tried
(window resize, browser zoom at 0.67 and 0.5, keyboard, React Flow's own Zoom Out) and **all four
failed**. Reproduced on a second, independent workflow.

Recorded rather than smoothed: both placements in that session were made with a synthetic
`element.click()`, which bypasses hit-testing — **the steps were driven on a workflow a real user
could not have built with a mouse at that viewport.** Filed as `BUG-260807-02`.

Passing that session: **U1** (the 7th glyph — marks are *identical* to its six siblings, not merely
in-band, so the `llm_batch_agents` luminance-34.5 defect does not repeat), **U2** (badge occlusion,
**with the falsification control observed swinging both ways** — a planted `zIndex 99999` div drove
`badgeReachable` true → false, removal drove it false → true), **U4**, **U6**, plus WR-04 (the picker
is a real APG radiogroup), 189-14 (the arming switch renders ON and visibly refuses a real click), the
no-focusable-control card invariant, WR-03 and D-13/D-12.

Also proven that session: **SC#4 observed, not assumed** (the `act` output reads *"No email was sent.
Nothing left this workflow. This is a record of an intention, not a receipt."*), **WR-02's fix live**
(`recorded_intent.inputs` keys are `['content']`; `kickoff_prompt` absent), **D-19** (two golden runs
went straight through where the pre-fix behaviour died at 7200 s), and **CR-02 on the wire** — event 5
`phase_recorded_not_sent` arrives *before* event 7 `phase_started emit`, which is what fires
`finalizeEarlierPhasesForThread`.

**Why three rows stayed owed:** no external-action workflow could be published, so no run surface
could be opened. Three publish attempts, three honest blocks, **none caused by the external-action
step** — it cleared the Golden run and Citations stages every time; the blocks were judge/content
mismatches. Worth recording: the pip strip rendered ✓ for eight passed stages with Judge/Commit
unticked, so **the Phase-186 `findIndex → -1` bug does not reproduce.**

### Session 2 (2026-08-08) — the blocker cleared, and the last rows driven

`BUG-260807-02` shipped in the interim, so **the step was placed BY KEYBOARD** (`End` then `Enter`) —
a path that did not exist the day before. `End` scrolled the panel and row 7 became genuinely
hit-testable (`elementFromPoint` reached it) before `Enter` chose it.

The publish blocker was cleared by forking a STARTER (`Weekly Status Report`) — the only path that
populates `business_requirement` — and binding it to a KB a published sibling already used. Result:
**`weekly-status-report-wfzqel` v1 `published`**, phases `retrieve · act · emit`, with
`act = external_action / capability: send_email` at phase **2 of 3** — deliberately NOT last, because
that is the only arrangement in which the CR-02 mid-run sweep can fire.

| Row | Verdict |
|---|---|
| **U3** — the 8th ring distinguishable by SHAPE ALONE in greyscale | ✅ PASS — four arcs, `"32.044 21.363" ×4`, `dashoffset 16.022`, `animationName: none`, byte-identical under `grayscale(1)`. **Every number 189-10 predicted from a synthetic DOM confirmed on a real one.** The only ring on the canvas. |
| **U5** — the 188.2 debt (`D-188.2-DEF-07` A2) | ✅ PASS — `Running` genuinely spins (`animating: true`); `Not started`/`Locked`/`Complete` show no ring and are still. Four readings, four shapes, one run. |
| **D-25** — run-level verdict over a phase-level "Not sent" | ✅ PASS, the **RENDERED** half |
| **`BUG-260807-01`** — `constructor`-slug reachability | ⛔ **FAIL — and the failure is the point** |

**CR-02 proven on the PAINT, through BOTH sweeps.** After `emit` started (firing
`finalizeEarlierPhasesForThread`) and after the run completed (firing `finalizeAllPhasesForThread`),
the spine still read `retrieve ✓ Complete ▸ act ↛ Not sent ▸ emit ✓ Complete`. **`act` never flashed
"✓ Complete."** Before the fix it would have been repainted within milliseconds.

**The live armed checkpoint paused and refused to continue** — the correct counterpart to D-19. Both
halves (golden auto-continues, live pauses) are now observed on real runs.

## The one row that FAILED — and why that is a result

`BUG-260807-01` was held open for exactly this row, on the recorded ground that *"only the driven row
can confirm no other path produces the same rendered symptom."* **That caution was correct.**

Its `own()` guard **holds** (`transformHasNaN: false` on every node). But a phase slugged `constructor`
still renders wrong through a *different* sink that writes **no transform at all** — `retrieve` and
`constructor` measure at the identical rect `58,176`, the card stacked on phase 1. Control observed
swinging both ways: the same fixture slugged `ordinaryslug` renders `translate(320px, 0px)`.

Not a NaN — an **absent** value: the lookup resolves the inherited `Object.prototype.constructor` (a
function, never nullish, so every `!== undefined` / `?? fallback` passes). Filed as **`BUG-260808-01`**.
At the `/gsd:verify-work 189` gate the operator routed it OUT of 189: the slug is not user-authorable
(`D-184-11` — no slug field; the caller derives it), so the row was driven from a seeded fixture since
deleted.

## Deviations from Plan

1. **No SUMMARY was written at execution time.** The plan paused at its live-UAT checkpoint for the
   operator and its evidence was committed into `189-VALIDATION.md` instead. Corrected here.
2. **Task 3 took two sessions, not one** — the plan assumed one. A blocker found by the session's
   *first action* made the rendered-run rows unreachable until a separate fix shipped.
3. **The session found and filed more than it was scoped to.** `BUG-260807-02` (blocker),
   `BUG-260808-01` (the failed row), `BUG-260808-02`, `SEED-140`, `SEED-141`, and two authoring
   defects recorded in VALIDATION (the silent 409 on ⑂ Tweak; the LOOSE door never persisting
   `business_requirement`, so **nothing it creates can ever be published** — 87 of 193 definitions
   carry the field and every one traces to a STARTER template).

## Deferred Issues

| Item | Owner |
|---|---|
| `BUG-260808-01` — the seventh WR-04 sink | rolls forward; the systemic fix is to constrain `slug` (`models/harness.py:202` bare `str`), not an eighth guard |
| `BUG-260808-02`, `SEED-140`, `SEED-139` | one future phase — all three converge on *what the run surface owns versus chat* |
| `SEED-141` — deterministic utility nodes | research, not a build |
| ⑂ Tweak silent 409 · the LOOSE door's `business_requirement` | recorded in `189-VALIDATION.md`; neither is a 189 regression |

## Threat Flags

None new. This plan ships **no code** — it corrects two prose figures and records evidence. Its own
register was disposed at `/gsd:secure-phase 189`: **T-189-48** (stale head) mitigated and
independently re-derived; **T-189-49** (a visual claim asserted from a green suite) mitigated — four
rows driven with U2's control swinging both ways; **T-189-50** (an owed row silently dropped)
mitigated — every row carries PASS, FAIL or BLOCKED with a reason, and the one FAIL is reported as
prominently as the passes; **T-189-51** (the session mutating the operator's environment) `accept` —
logged as an accepted risk, and the seeded `constructor` fixture was deleted afterwards.

## One genuinely good result

**The AI seed placed `external_action` by itself.** Given *"…then email that answer to the requester"*,
the NL generator produced `Phase 4: Email the cited answer to the requester (external_action)` with
`capability: send_email`, and its seed receipt explained the grounding it chose. 189-09 holds on a real
request.

## Self-Check: PASSED

All five commits resolve in `git log --oneline --all` (`7a78fd87`, `7d82e6bc`, `267df91d`, `00afaa55`,
`5a4f4228`). `189-VALIDATION.md` exists and carries the driven rows. The published workflow was
re-verified against the live DB at this gate: `weekly-status-report-wfzqel` v1 `published`,
`act.config.phase_type = external_action`, `capability = send_email`, phase 2 of 3.
