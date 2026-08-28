---
id: BUG-260828-09
title: A failed publish never tells the author what failed, in which step, or why — the plain sentence exists and is written where nobody looks
surface: Agentic-RAG
severity: high
status: open
folded_into: null
reported: 2026-08-28
reported_by: operator, after three failed publish attempts on one workflow
affected_areas:
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - backend/app/services/harness/publish_service.py
re_open_trigger: n/a — open
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
