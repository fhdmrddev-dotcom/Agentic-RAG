---
seed_id: SEED-274
title: The backend unit "ceiling of 71 with ZERO headroom" is not a stable property of the suite — four different readings were measured on the SAME tree, so a phase can break or pass the gate by luck
created: 2026-09-14
planted_during: v4.2 scoping / BUS-202 closure — the finding is BUS-205's, made at the Phase 246 closing review (2026-09-13) and explicitly left unhomed there
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-171 — the frontend count gate's cap-independent flakes. ⚠ SAME CLASS, OTHER SUITE: a gate
    whose red is sometimes real and sometimes noise, where the project's own rule tells an agent to
    treat every red as a breach. SEED-171 was answered with a *triage procedure* rather than a
    number; this seed asks for the same shape on the backend.
  - SEED-056 — the original vitest baseline-rot cluster.
relates_to_registers:
  - "CLAUDE.md § Rules — the canonical gate text: `71 failed, 3497 passed, 2 xfailed, 2 xpassed`,
    'Any new failure above 71 breaks the gate (zero headroom)'."
  - "docs/ and scripts/check-backend-unit-baseline.cjs — the executable form of the same claim."
trigger_when: >
  ANY of: (1) a phase's backend run reads above 71 and the executor is about to attribute it to
  their own diff — this seed is the first thing to read; (2) the next milestone that touches
  backend test infrastructure or CI; (3) anyone proposes RAISING or LOWERING the ceiling number,
  which must not happen until the band is measured; (4) a second independent agent reports a
  different reading than the one in CLAUDE.md on an unmodified tree.
---

# SEED-274 — the ceiling is a set with a flake band, not an integer

## Why This Matters

`CLAUDE.md` states the backend gate as an exact integer with **zero headroom**:

> Milestone v4.0 locks the baseline at **71 failed, 3497 passed, 2 xfailed, 2 xpassed (0 collection
> errors)**. Any new failure above 71 breaks the gate (zero headroom).

⛔ **On measured evidence that is not a property the suite actually has.** Readings observed across a
single session, all on the same tree:

| Reading | Where |
|---|---|
| **71** | CLAUDE.md's locked figure |
| **72** | measured at Phase 233 — *before* that phase's first edit |
| **72** | Phase 239's baseline |
| **77** | Gemini's Phase 246 run |

**A gate with zero headroom over a value that moves by ±6 is a coin flip.** A phase can break it
without causing anything, or pass it while having caused something — and the project's own rule
instructs the executor to treat any reading above 71 as *their* breach.

## The half that was already refuted — do not re-propose it

⚠ **The obvious explanation was driven and is FALSE.** Phase 246's report attributed the `77` to
running `pytest` from the repo root instead of `backend/`, *"which causes path-sensitive suites
(`test_sql_service.py` 12, `test_explorer_agent.py` 6, `test_260905_ingest_fixes.py` 4) to fail on
relative paths/env loading."* Measured both CWDs, same interpreter (`BUS-205`):

```
test_sql_service.py     -> 12 failed from backend/  ·  12 failed from repo root   (IDENTICAL)
test_explorer_agent.py  ->  6 failed from backend/  ·   6 failed from repo root   (IDENTICAL)
```

And the arithmetic refutes it independently: the root run collected **4,787** items
(4706 + 77 + 2 + 2) and the `backend/` run collected **4,787** (4711 + 72 + 2 + 2) — the **same
collection set**. A CWD difference that changed which files were collected could not produce an
identical total. **The working directory is not the cause. The suite is simply unstable in this
range.**

⭐ **The method lesson `BUS-205` drew, which is worth more than the number:** a *mechanism-shaped*
explanation — named suites, named counts, a named cause — **feels** verified in a way a bare
observation does not. *"I re-ran it in `backend/` and got 71"* was true and sufficient; the causal
story added nothing and was wrong. **Report the observation; propose the mechanism only when you
have driven it.** Both agents made this exact error on the same day, in opposite directions.

## What the answer should look like

**Not a new number.** A number is what failed.

1. **Run the suite N times on ONE unmodified tree** (N ≥ 10), quiet box, no sibling agent.
2. **Capture the failing test NAME SET each time** — never the count. Counts cannot be diffed;
   sets can. Use `comm -13` against the baseline set, the way Phase 238's gate check did.
3. **Publish the UNION and the INTERSECTION.** The intersection is the true standing rot — the
   deterministic failures that are genuinely inherited. The union minus the intersection is the
   **flake band**, and its members should be named individually, as `SEED-171` names its five.
4. **Restate the gate as: the intersection set must not grow, and no failure outside the published
   union may appear.** That is checkable, survives a flaky run, and still catches a real regression
   — which the integer does not.
5. **Update `CLAUDE.md` and `scripts/check-backend-unit-baseline.cjs` in the SAME commit**, or the
   prose and the executable form will disagree, which is this project's most repeated defect.

⛔ **Do NOT simply raise the ceiling to 77.** That buys headroom by hiding the instability and makes
the gate weaker at every value in between. The instability is the finding.

## Why it is planted rather than scoped

`BUS-205` says it plainly: *"Do not fix this inside 246. It wants its own re-derivation."* It was
correctly kept out of Phase 246 and correctly kept off `SEED-273` (which is about
`hnsw.iterative_scan` and is not its home). It is **not** in v4.2's requirements either — v4.2 is
sources, credentials, models, run honesty and register integrity. ⚠ **So at the moment this seed is
planted, the finding is held by a CLOSED bus item and nothing else** — which is exactly the
disappearance `BUS-171`'s third triage arm exists to prevent, and the reason this file exists.

## Reference

- `BUS-205` (closed 2026-09-13) — the measurement, the refutation and the method lesson.
- `BUS-202` (closed 2026-09-14) — Phase 246's post-execution review, where the `77` was reported.
- `CLAUDE.md` § Rules — the integer the gate currently asserts.
- `scripts/check-backend-unit-baseline.cjs` — its executable form.
- [[SEED-171]] — the frontend precedent: a triage procedure, not a number.
