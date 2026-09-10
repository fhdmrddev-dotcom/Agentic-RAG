---
phase: 228-v3.9-closeout-the-debt-gets-a-number
type: preflight
author: Claude (reviewer)
builder: Gemini
date: 2026-09-04
plans_reviewed: [228-01, 228-02, 228-03, 228-04]
also_read: [228-CONTEXT.md, 228-DISCUSSION-LOG.md, 228-SEAM-AUDIT.md]
verdict: execute — 9 gaps to close DURING execution, 2 of them BLOCKING
---

# Phase 228 — Pre-flight

A gap pass, not a re-plan. Everything below closes **inside the existing four plans**; no plan is
being added, split or re-sequenced.

⚠ **The reviewer wrote this milestone's ROADMAP and REQUIREMENTS.** That makes this review neutral on
the *plans* (Gemini wrote them) but **NOT neutral on the requirements they trace to** — and the very
first finding is a requirement of mine that measurement refuted. Read §0 before §2.

---

## 0. ⛔ A REQUIREMENT I WROTE IS WRONG, AND THE PLAN IS RIGHT

**`DEBT-05` asserts the `71` baseline is unsound.** Verbatim from `REQUIREMENTS.md`:

> *"`pytest tests/unit -q --continue-on-collection-errors` reads **95 failed / 3394 passed / 2 errors**;
> the `71` quoted all through v3.9 was measured over a different set (two collection errors from
> missing `ezdxf` / `reportlab` abort collection without that flag)."*

**Measured at HEAD on 2026-09-04, main working tree, quiet, verdict line read verbatim:**

```
71 failed, 3497 passed, 2 xfailed, 2 xpassed, 35 warnings in 77.75s (0:01:17)
```

`backend/venv/Scripts/pytest.exe tests/unit -q --continue-on-collection-errors`, exit 0.

| | `REQUIREMENTS.md` / `STATE.md` say | **measured 2026-09-04** |
|---|---|---|
| failed | 95 | **71** |
| passed | 3394 | **3497** |
| collection errors | 2 | **0** |

⭐ **`228-01` and `228-CONTEXT.md` D-09 are CORRECT and my requirement text is STALE.** The `71`
reproduces exactly, and there are **no** collection errors — the missing `ezdxf` / `reportlab` that
caused them have since been installed into the venv. **Do not weaken the plan to match my number.**

**Action (reviewer, not the executor):** `REQUIREMENTS.md` `DEBT-05` and `STATE.md`'s *Inherited from
v3.9* bullet are being corrected to the measured figures, with the original preserved beside them.
`DEBT-05`'s *intent* is unchanged and is still met by `228-01`: the baseline is re-derived honestly
and can gate again.

⚠ **One consequence the plan should state:** at `failed <= 71` with a measured `71`, the gate has
**ZERO headroom** — one new failing backend test breaks it. That is the gate working, not a defect,
but `228-02` modifies `threads.py` and `runs.py`, so wave 4's run is where it will show up. Say so in
`228-VERIFICATION.md` rather than treating a 72 as a mystery.

---

## 1. Verified correct — do NOT re-check these during execution

| # | Claim | Evidence |
|---|---|---|
| V-1 | The backend baseline is `71 / 3497` | Measured above. `228-01` Task 1 and `228-CONTEXT` D-09 are accurate. |
| V-2 | `primary_frontend_origin()` exists and is already the OAuth redirect base | `connectors.py:1274`, `:1330`, `:1461`, each carrying the `# BUG-260904-04: FRONTEND_URL is a LIST` comment. `228-01` Task 2's premise holds; it is hardening a correct call site, not fixing the list bug again. |
| V-3 | CLAUDE.md has room for `228-01`'s documentation | `node scripts/check-claude-md-size.cjs` → **106,939 chars, 71.3% of limit, 43,061 headroom, [OK]**. |
| V-4 | `cap_paused` already exists end-to-end in the DB and backend | `threads.py:1237-1252` reads `runs.status = 'cap_paused'` directly in SQL; `runs.py:973` is a working `continue_run`; `agent_loop.persist_cap_paused` is referenced at `runs.py:926`. **No migration is needed for `cap_paused`** — do not invent one. |
| V-5 | A fetch-based (non-SSE) path for `cap_paused` already exists | `threads.py:1111` docblock: *"cap_paused case (RESEARCH Q3). NEVER writes"*; it returns `cap_paused=` at `:1423`; `ChatArea.tsx:167` maps `capPaused: state.cap_paused`; `MessageItem.tsx:523` gates the Continue card on `workflowLock?.capPaused`. |
| V-6 | Phase 228 needs no migration | Roadmap reserved none; no plan declares one; V-4 removes the only candidate. `228-04`'s `regenerate-full-schema.sh` **without `--reset`** is the correct CLAUDE.md-compliant action. |

---

## 2. Gaps to close during execution

### ⛔ G-1 (BLOCKING) — `228-02` widens `runStatus` and owns none of the three files on the path

`228-02` Task 2 asserts `message.runStatus === "cap_paused"`. **`runStatus` is a closed 5-value union
on both sides and `cap_paused` is not in it:**

- `frontend/src/types/index.ts:171` — `runStatus?: "streaming" | "completed" | "failed" | "cancelled" | "timed_out"`
- `backend/app/models/message.py:108` — `run_status: Literal["streaming","completed","failed","cancelled","timed_out"] | None`
  (its own comment: *"Mirrors public.runs.status enum values post-migration 038 (5 values)"*)
- `frontend/src/lib/api/threads.ts:91` — `runStatus: run_status ?? undefined`, **a hand-built object
  construction on the seam path** — the exact shape the Phase 214 post-mortem names as failure mode #1.

**None of the three appears in `228-02`'s `files_modified`.** Consequence, precisely: TypeScript will
**error** on comparing a 5-member union to `"cap_paused"`, so this one fails loudly rather than
silently — but only after the executor has written the branch. Pydantic would separately reject or
null the value server-side.

**Close it by:** adding `backend/app/models/message.py`, `frontend/src/types/index.ts` and
`frontend/src/lib/api/threads.ts` to `228-02`'s `files_modified`, and widening all three in the same
commit as the branch that reads the value. **Then re-run the phase's own seam rule** — for every field
this phase widens, grep producer → every consumer and require each file on the path to be owned by
some plan, *even where it needs no change*.

### ⛔ G-2 (BLOCKING — design, cheaper than it looks) — `228-02` adds a SECOND source of truth for one fact

Per V-4/V-5, `cap_paused` **already** reaches the frontend through `workflowLock.capPaused`, via a
thread-state endpoint that already special-cases it and explicitly never writes. `BUG-260818-03`'s own
recorded diagnosis is:

> *"The Continue feature ALREADY EXISTS and did not render — a live-SSE gate with no fetch reconcile,
> which is D-v2.5-03 exactly."*

So the defect is a **missing reconcile on mount**, not a missing field. `228-02` proposes to carry the
same fact a second way (on the message row) and to OR the two conditions — leaving two sources of truth
for one state, which is this repo's signature defect class and the thing D-v2.5-03 exists to forbid.

**Close it by:** before writing any field, determine whether `ChatArea` / `StreamsProvider` fetch that
thread-state on mount and reload. **If the reconcile is missing, fix the reconcile** and `G-1`
evaporates with it. Only if the lock genuinely cannot carry the fact across reload does the message
field become justified — and then `228-02` must say *why*, in the plan, before the branch is written.
⚠ Do not implement both.

### G-3 — `DEBT-02` names six bugs; the plans implement four, and two vanish silently

| Bug | `REQUIREMENTS.md` `DEBT-02` | `228-CONTEXT` | `228-02` tasks |
|---|---|---|---|
| `BUG-260818-01` | ✅ | ✅ | ✅ Task 1 |
| `BUG-260818-02` | ✅ | ✅ | ✅ Task 1 |
| `BUG-260818-03` | ✅ | ✅ | ✅ Task 2 |
| `BUG-260823-02` | ✅ | ✅ | ✅ Task 3 |
| `BUG-260823-03` | ✅ | ⛔ absent | ⛔ absent |
| `BUG-260823-04` | ✅ | ✅ (listed, incl. canonical refs) | ⛔ **no task** |

`BUG-260823-04` is named in `228-CONTEXT`'s own boundary statement *and* its canonical refs, then has
no task anywhere. `BUG-260823-03` is in the requirement and in neither.

**Close it by:** either giving each a task in `228-02`, or recording both in `228-VERIFICATION.md` as
**re-deferred with a named trigger**. ⚠ A bug that appears in a requirement and disappears from the
plans without a verdict is exactly the failure `DEBT-01` exists to end — it must not be closed by
silence.

### ⛔ G-4 — `DEBT-03` cannot be discharged by `228-01`, and would read green if not stated

`DEBT-03` verbatim: *"`/code-review ultra review-base-225` runs on the OAuth state rework."* Its
re-open trigger is *credits available before the v3.9 production push*.

`/code-review ultra` is **user-triggered and billed — no agent can launch it.** `228-01` instead ships
Redis-outage hardening and `228-CONTEXT` D-10 describes leaving the review *"ready for the operator"*.
That is reasonable work, but it is **not** the requirement, and `228-01`'s must_have currently reads
*"resolve Phase 225 OAuth state rework review findings"* — **there are no findings, because the review
has never run.**

**Close it by:** (a) rewording that must_have to what is true — hardening a call site against an
unhandled Redis failure, with no review findings in hand; and (b) recording `DEBT-03` in
`228-VERIFICATION.md` as **⛔ blocked on operator** with the credits trigger restated. The hardening is
ADDITIONAL work, not `DEBT-03`'s discharge.

### G-5 — two plans edit `scripts/vitest-count-gate.cjs`, and the seam audit lists it twice without noticing

`228-02` Task 3 adds two suites to `TARGETS`/`BASELINE` and re-derives. `228-03` Task 2 adds a third
and re-derives. The seam audit names the file in **Seam 2 and Seam 3 separately** and never observes it
is the same file. Both plans declare `depends_on: ["228-01"]` only.

**Close it by:** stating that `228-03` re-derives **from the tree as `228-02` left it**, never from a
stale copy, and that the two must not run concurrently. ⚠ Also relevant: CLAUDE.md caps concurrent
test-running agents at **two** and requires `GSD_VITEST_MAX_WORKERS=2`; both these plans run vitest.

### G-6 — `228-04`'s acceptance criteria are partly not reachable on demand

Task 3 requires *"`vitest-count-gate.cjs` (0 failures)"* and *"tsc (<= 65 errors)"*.

- **`SEED-171` is binding here:** five named suites flake **independently of the worker cap and of
  machine load**, three of them failing with plain `AssertionError` rather than a timeout. CLAUDE.md
  states the consequence directly — *a plan whose acceptance criterion is "the gate is green" has
  written a criterion that can fail for reasons no plan controls.*
- **The `65` tsc figure is UNVERIFIED by this review.** Ledger figures in this repo were measured to
  have drifted in 8 of 12 rows at roadmapping.

**Close it by:** pairing the gate criterion with **per-file deltas and the explicitly-run in-scope
suites**, which are deterministic; and **re-deriving the tsc baseline** at execution rather than
asserting 65. If the gate reds, capture failing filenames from the gate's own persisted JSON **before**
re-running anything, and check each against `git diff --numstat` — do not reach for the cap.

### G-7 — `228-03` touches deploy artifacts but not `docker-compose.prod.yml`

CLAUDE.md's deployment-artifact parity rule (D-16, enforced by `scripts/check-deploy-drift.sh` in CI)
binds `deploy/onebox.env.example`, `docs/OPERATOR.md`, `docker-compose.prod.yml` and the
`SANDBOX_IMAGE` tag **in the same commit** whenever an env var the app reads changes. `228-03` changes
`VITE_APP_URL` / `FRONTEND_URL` handling and names the first two but not `docker-compose.prod.yml`.

**Close it by:** confirming during Task 2 whether the drift script requires it; if yes, add it to
`files_modified`; if the var is intentionally omitted, register it in the script's
`OMITTED_FROM_ONEBOX` list rather than letting it drift silently.

### G-8 — `228-04` plans to drive Phase 210 rows that are recorded as undrivable

`228-04` Task 2 lists *"Phase 210: 4 SCs"* as rows to execute. `STATE.md` records that **`CONN-10` and
`CONN-11` are structurally undrivable on this install** — a measured property, not a scheduling problem.

**Close it by:** honouring the recorded verdict — those rows go in as **⛔ blocked, with the recorded
reason and id** rather than being re-discovered at execution time. `228-04`'s own must_have already
demands *"pass, ⛔ blocked, or re-deferred; zero rows silently omitted"*, so this is applying its rule
to a case the task text pre-empted.

### G-9 — is there an integration test that mocks NEITHER side?

`228-02` spans `backend/app/api/{threads,runs}.py` and three frontend files. Both new suites
(`MessageItem.retry.test.tsx`, `MessageItem.capPaused.test.tsx`) are **component tests that supply the
backend's half as a prop** — they prove `f(s) ≡ g(s)` and are blind to `s_backend ≠ s_frontend`, which
is the Phase 214 failure shape #3.

**Close it by:** naming one case that obtains the cap-paused state through the **real serializer** —
`GET /threads/{id}/messages` (or the thread-state endpoint) against a seeded `cap_paused` run — and
asserts the value the frontend actually receives. If `G-2` resolves to "fix the reconcile", this test
is the one that proves the reconcile, and it is worth more than both component suites.

---

## 3. Checks run and found clean

- **Migration numbering** — no migration in this phase, correctly (V-4, V-6). Nothing to number, nothing
  to backfill. `regenerate-full-schema.sh` without `--reset` is right.
- **Hot-file G-5** — `MessageItem.tsx`, `ToolCallPanel.tsx`, `RunCard.tsx` were discharged at Phase 227;
  `228-02` adds a gated branch and copy, honoured by construction. `connectors.py` gains a `try/except`
  at a call site it already owns. No `.N` chain proposed anywhere; **G-1 (phase-chain cap) does not fire.**
- **CLAUDE.md budget** — 43,061 chars of headroom (V-3).
- **`user_setup`** — all four plans declare `[]`. Correct for 228: `DEBT-04`'s cloud dashboard steps are
  explicitly an operator checklist for promotion, not setup this phase performs.

---

## 4. Verdict

**`execute` — 9 gaps to close during execution. `G-1`, `G-2` and `G-4` are BLOCKING and must be settled
before the code they touch is written; the rest close inside the plans as they run.**

Order that minimises rework:

1. **`G-2` first** — it may delete `G-1` entirely. Establish whether the reconcile is missing before
   widening any type.
2. **`G-1`** — only if `G-2` concludes the message field is genuinely required.
3. **`G-4`** — a wording fix plus a `228-VERIFICATION.md` row; costs minutes and prevents `DEBT-03`
   reading green while the review never ran.
4. `G-3`, `G-5`, `G-6`, `G-7`, `G-8`, `G-9` close in the waves that already own them.

⭐ **The strongest thing about this plan set:** `228-01`'s baseline was measured, and it survived a
reviewer who arrived expecting to refute it. The number in my own requirement was the stale one.

*Reviewed: 2026-09-04 · Builder: Gemini · Reviewer: Claude*
