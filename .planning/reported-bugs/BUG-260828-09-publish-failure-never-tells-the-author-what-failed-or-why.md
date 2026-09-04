---
id: BUG-260828-09
title: A failed publish never tells the author what failed, in which step, or why — the plain sentence exists and is written where nobody looks
surface: Agentic-RAG
severity: high
status: closed
folded_into: BUG-260828-09 direct fix (2026-08-28) — no phase; closes Phase 214 SC#6
reported: 2026-08-28
reported_by: operator, after three failed publish attempts on one workflow
affected_areas:
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - backend/app/services/harness/publish_service.py
re_open_trigger: a publish block that renders no step name, or a `blocked_step` whose face is a slug
relates_to:
  - BUG-260828-04 (a refusal the author cannot read — same family: the system knows, the author does not)
  - SEED-228 (the two-gate bind that produced these failures)
---

# The operator's words

> *"this golden gate is annoying sometimes and I don't know why it is failing. A lot of information
> are displayed and none of them are useful for the user. For me I did not know what is the real
> reason why this failed, in which step, and why — from a user perspective."*

Three publish attempts on one workflow (17:12, 17:08, 16:55 on 2026-08-28), none of which told the
author what to do next.

# ⚠ The system knew the answer in plain language the whole time

The golden run wrote exactly this, and it is a good sentence:

> `Phase 1 (survey-library) gate failed after 3 attempt(s): citations_required: nothing was`
> `retrieved (0 sources) — this step reads your documents and must show where its answer came from`

Step named. Cause named. Attempts named. Consequence named.

**It was written as an assistant message inside the thread
`[validation] publish golden run — <workflow name>`** — a thread the author never opens and is
never linked to from the failure. It is discoverable only by querying Postgres, which is how it was
found here.

# What the author gets instead

`publish_service.py:337-341` returns, on any golden-run exception:

```python
stage="golden_run_error",
named_failures=[f"golden run could not complete: {err_msg}"],   # err_msg = f"{type(e).__name__}: {e}"
```

So the surface receives a **stage code** and a **Python exception string**, rendered beside a
**ten-row stage spine**. The author is shown the shape of the pipeline and the class name of a
crash. Neither answers *which step of MY workflow*, nor *what was wrong with it*, nor *what to do*.

⚠ **The information volume is itself the defect.** Ten stage rows plus a polymorphic
`named_failures` blob is more text than the one sentence that would have answered the question —
which is why the operator described it as *"a lot of information, none of them useful."*

# The fix, stated as a property rather than a design

A failed publish must show, at the top and without navigation:

1. **which step of the author's own workflow** blocked it — by the author's step name, never a slug
   or a stage index;
2. **why**, in the sentence the run already produced;
3. **what to do next**.

The stage spine is context and belongs below that, not instead of it. The raw code and exception
belong behind a disclosure for whoever wants them.

⚠ **Nothing needs to be invented.** The sentence exists and is already well written. This is a
plumbing failure — it is produced in one place and rendered in another — not a copywriting task.

# Why no test caught it

The gauntlet's suite asserts that `named_failures` entries render. They do. What is untested is
whether a person reading the result can name the failing step — and that is not assertable from
inside jsdom, which is the same blind spot as `BUG-260828-04`.


---

# ✅ CLOSED 2026-08-28 — AND THE REPORT'S HYPOTHESIS WAS WRONG IN A WAY THAT MATTERS

**The report guessed `golden_run_error` and a Python exception string. It was measured, and all
four attempts actually blocked at `structural_gate` with the FALLBACK sentence.** Queried against
the live database — golden runs `22ad0cf3` (17:46), `1f841ade` (17:12), `c22f4bb2` (17:08),
`ffa38fa6` (16:55), all on definition `4ddadece` — every one had the identical shape:

```
0 survey-library  failed   {"_failure_reason": "Phase 1 (survey-library) gate failed after 3 attempt(s): citations_required: …"}
1 write-summary   pending  {}
2 act             pending  {}

publish_blocked → named_failures: ["the golden run failed a structural gate"]
```

## The root cause is ONE WORD, and it is not a copywriting problem

`_drive_golden_run` harvested the deliverable as *the last phase whose output is a dict*. **A
`pending` phase's `{}` IS a dict.** So the two pending rows overwrote the failed row,
`_structural_failures` was handed `{}`, returned `[]`, and the caller's `or [...]` fallback
fired. The good sentence was produced, persisted three separate ways, and then discarded by the
harvest before anything could render it.

⚠ **The report's framing — "produced in one place, rendered in another" — was exactly right, and
its diagnosis of WHICH place was wrong.** It named the render site; the defect was upstream of it.

## What shipped

**Backend.** `_deliverable_output` (extracted from the inline loop, empty dicts no longer count,
reads through the ONE `phase_output_object` unwrap) · `_blocked_step` + `_blocked_step_for_run`
(the join nothing performed: the failed phase's identity and its cause, with the
`Phase {n} ({slug}) …:` machine prefix stripped and the raw sentence kept beside it) ·
`PublishVerdict.blocked_step`, additive and optional, threaded through `_block` and into the
`publish_blocked` receipt. `named_failures` is **untouched** — rule 4 is not widened.

**Frontend.** `publishBlockedStep.ts` (shape detection + the face ladder) ·
`PublishBlockedStepCard.tsx` (the card the block now leads with, in `PublishRefusalList`'s slot,
above the spine) · the wire type · `verdictModel.ts`'s `structural_gate` paragraph, which
**predicted this fix eleven days early** and is marked false rather than overwritten.

⭐ **Property (1) is honoured by construction, not by care.** The server returns `step_name: null`
when the author named nothing — it does **not** backfill the slug, which is what the sibling gate
does and why a shipped receipt reads `"step_name": "act"`. The visible face comes from the shipped
`phaseVocabulary.nodeTitle`, whose own floor is *"the SLUG NEVER appears in this string."*

## Evidence

- Driven against the operator's REAL rows (not a fixture): fallback no longer fires; `cause` is
  `citations_required: nothing was retrieved (0 sources) — this step reads your documents and
  must show where its answer came from`.
- Backend `tests/unit`: **68 failed / 3110 passed** — rot set exactly at baseline 68, `+18` = the
  new suite. Count gate: **`count gate OK` — 138/138 pinned · 0 failing** (both new suites pinned).
  `tsc -p tsconfig.app.json`: **34**, exactly baseline, none in a touched file.

## ⚠ What is NOT proven, and who has to prove it

**jsdom lays nothing out**, so no test in this repo can show that a person reading the result can
name the failing step — the property the report is actually about, and the same blind spot it
names. The suites prove the WIRING. **The READING is owed as an operator drive in a browser**, and
the cheapest row is: re-publish the same workflow and confirm the card leads with a step name
rather than the stage spine.

⚠ **A `structural_gate` block raised by the D-214-11 argument re-projection fails no phase and so
still names none** — it falls to the headline that shipped. That is correct, not a gap: there is
no failing step to name. `BUG-260828-04` (a refusal the author cannot read) is a different defect
and is untouched here.

---

# ⚠ SECOND DEFECT, FOUND ONLY BY DRIVING IT — RENDERING THE ANSWER IS NOT SHOWING IT

The card shipped, rendered correctly, and **was 399 pixels above the fold.** Measured in a real
browser on a real failed publish of `Summarize DeepWiki structure and post to Slack`
(golden run `22bbf8bb`, 2026-08-28 23:16):

```
scroller  scrollTop 713 of scrollHeight 1254   (clientHeight 493)
publish-blocked-step   top -399      ← the answer
verdict-headline       top  -69
raw-verdict            top   63      ← ON SCREEN
golden-no-send         top  408      ← ON SCREEN
document.activeElement = <summary> "Show raw verdict — the 5 server fields, verbatim"
```

**The cause is FOCUS, not layout.** The publish form unmounts when the verdict arrives, so the
browser hands focus to the first focusable element in the replacement content — the raw-verdict
disclosure — and scrolls it into view. ⭐ **The surface was aiming the reader's eye at the machine
fields and leaving the plain sentence off-screen above.** That is the operator's original complaint
restated as a DOM fact: *"a lot of information are displayed and none of them are useful."*

**Fix:** on verdict arrival, focus and scroll the LEADING ANSWER into view — the cause card when
one rendered, else the verdict headline. ⚠ **Scrolling to the top would be wrong on the arm that
has no card**: a judge block names no step, so its answer IS the headline below the spine. Both
anchors carry `tabIndex={-1}`, so no new keyboard tab stop is added.

**After:** card top `105` against scroll-port top `98`, `fullyVisible: true`, focus on the card.

## ⚠ THE IRONY IS THE FINDING, AND IT IS WORTH KEEPING

`scrollIntoView` had to be guarded because **jsdom does not implement it** — unguarded it threw
`TypeError` and took **44 of `PublishGauntlet.test.tsx`'s cases** down. So the SAME jsdom limitation
that hid the original defect for a whole phase (no layout, no viewport, no scrolling) also makes its
fix **unrunnable and therefore uncovered** in this repo's suite. That line is verified by exactly one
thing: a browser drive. **A green frontend suite is not evidence about anything a person has to SEE.**

## Cost of the two drives

Two real golden runs on the DeepWiki draft (it stays a draft — a refused publish changes nothing,
and D-16 records-not-sends, so nothing left the workflow). Both blocked at the same honest gate.
