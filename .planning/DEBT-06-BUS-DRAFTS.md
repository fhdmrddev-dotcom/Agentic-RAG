---
type: bus-drafts
requirement: DEBT-06
milestone: v4.2
derived: 2026-09-16
derived_by: claude (orchestrator)
status: DRAFT — not posted. The `agent-bus.sh open` commands are at the bottom.
bus_writes: 0
---

# DEBT-06 — seven review assignments, drafted

Seven phases owe an independent §6.3 review. **Claude built all seven**, so claude cannot review any
of them — and **gemini neither planned nor executed any**, so it is clean on all seven.

⛔ **Builder evidence, measured rather than assumed** (this is the fact the whole assignment rests on,
so it is published rather than asserted):

| Phase | evidence claude built it |
|---|---|
| 241 · 242 · 244 · 245 · 251 | every plan commit carries `Co-Authored-By: Claude` — 16 / 5 / 19 / 9 / 19 respectively |
| 249 | `249-VERIFICATION.md` frontmatter reads `builder: claude` · `reviewer: claude` verbatim |
| 250 | `250-VERIFICATION.md` reads `reviewer: null` and *"the builder and the reviewer of this phase are the same agent"* |

**Instrument:** the normal `/gsd:code-review <phase>`. ⛔ **`/code-review ultra` stays ruled out on
cost — operator standing decision.**

**Recommended order:** 251 → 250 → 249 (freshest, and the milestone close is blocked on them), then
245 → 241 → 242 → 244 (backlog; 244 is largest and can go last).

⚠ **A TRAP THAT WOULD CORRUPT EVERY SCOPE IN THIS FILE, measured — do not skip it.**
`git log --grep="(242"` between a phase's first and last commit **spans 242, 243, 244, 245 AND 246**,
because the phases interleave on `develop`. A file count derived that way is contaminated — my own
first pass produced `137` and `112` for 242 and 244 and both are wrong. **Derive each range from the
phase's own PLAN commits and verify the endpoints, then say what range you reviewed.** No file count
is published below for that reason.

---

## 1 · Phase 251 — Register Integrity ⬅ START HERE

> §6.3 INDEPENDENT REVIEW — PHASE 251 (Register Integrity), the last phase of v4.2. ⛔ WHY IT IS YOU:
> claude planned, executed and VERIFIED this phase in one session on 2026-09-16 — the verifier was a
> subagent of the session that orchestrated the build, which is precisely what §6.3 forbids. That is
> recorded in `251-VERIFICATION.md` as `verification_mode: self-verified` rather than allowed to read
> as reviewed, but recording a debt does not discharge it. You neither planned nor executed it.
>
> ARTIFACTS: `.planning/phases/251-register-integrity/` — four SUMMARYs, `251-GATE-BASELINE.md` (the
> pre-migration census), `251-RENUMBER-LEDGER.md`, `251-BUS-TRIAGE.md`, `251-VERIFICATION.md`.
>
> HIGHEST-VALUE TARGETS, named by the builder so you do not have to find them:
> (1) **`scripts/check-seeds-register.cjs` — DRIVE ITS ARMS RED YOURSELF.** It claims `--self-test
> 8/8 PASS`. Three times in this phase a planted defect left every arm green EXCEPT the
> counterfactual one, and the sharpest case is 251-02: defanging the md5 body check to `ok: true`
> left **6 of 7 arms green INCLUDING the arm whose whole job was that invariant**, because the bodies
> were genuinely fine and only the CHECK was dead. A happy-path arm cannot distinguish *the property
> holds* from *nothing is checking*. Assume nothing about arms `1c` and `2b`, which were added late.
> (2) **D-11, the body invariant.** 293 seed bodies are claimed md5-identical across the migration.
> ⚠ **Verify blob-vs-blob via `git archive`, NEVER against the working tree** — `core.autocrlf=true`
> on this box makes a working-tree read report **153/276 seeds drifted** when nothing drifted. My own
> verifier hit that and published it; do not re-pay for it. Equally, `git diff` CANNOT see
> line-ending damage in content, so it is not the instrument either.
> (3) **The wiring, which is the deliverable — not the script.** `discuss-phase.md` and
> `new-milestone.md` are claimed to CALL the sweep. ⛔ `grep -rn "check-seeds-register"` still HITS
> when the fenced command is replaced by a prose mention with zero runnable calls left. Extract the
> fence as authored and RUN it.
> (4) **The 8 renumbers and their redirect stubs.** D-07's rule is *oldest keeps the id, by date*.
> `seedDate()` is NOT total — `SEED-001` carries neither `created:` nor `planted:`. Two pairs broke on
> a git ADD-COMMIT tie-break.
>
> ⚠ A FINDING THE BUILDER FOUND IN ITS OWN GATE AND FIXED LATE: the stub carve-out read
> `stubs.length === 1`, a COUNT with no SHAPE check, so a keeper + squatter + stub trio was waved
> through carrying a live collision. Fixed in 251-04 as `members.length === 2 && stubs.length === 1`.
> **That it was found by the phase's own RED drive is the argument for driving rather than reading.**
>
> ⛔ BOUNDARIES THAT WERE DELIBERATE, so you do not raise them as defects: the 378+ references inside
> sealed `.planning/milestones/` were NOT rewritten (D-06); 33 product-source references in
> `backend/`/`frontend/` were left pointing at stubs ON PURPOSE (D-17), recorded in the ledger; the
> whole `251-register-integrity/` directory is deliberately not rewritten because it is the
> transcript OF the collision.
>
> RECORD: write `independent_review:` into `251-VERIFICATION.md` frontmatter and flip
> `verification_mode` only if it earns it. Decisions go `--to operator`, never to me.

## 2 · Phase 250 — Run Honesty, the residue

> §6.3 INDEPENDENT REVIEW — PHASE 250. ⛔ WHY IT IS YOU: `250-VERIFICATION.md` reads
> `reviewer: null` and, in its own words, *"the builder and the reviewer of this phase are the same
> agent"*. Artifacts at `.planning/phases/250-run-honesty-the-residue/` (3 plans).
>
> ⚠ A `/gsd:code-review 250` ALREADY RAN and closed 9 of 9 Critical+Warning and 4 of 5 Info
> (`250-REVIEW.md` → *Resolution log*). **That is a code-review pass, not a §6.3 review** — and
> `BUS-247` is the one-paragraph argument for the distinction: a self-verified close shipped two
> blockers past every green gate, six red-driven fences and three live browser scenarios, because
> **neither blocker was gate-catchable.** Review the phase, not the review.
>
> HIGHEST-VALUE TARGETS: the four HONEST-01..04 claims — trimming never eats the user's own question;
> a silent reasoning model says what happened; the panel stops working when the run ends; a finished
> task leaves no false todo. ⛔ **`BUG-260915-01` is FILED AND NOT FIXED** — open todos read
> `Not ticked` on a LIVE run after a plain thread open, because nothing reconciles on thread-switch.
> It was ruled a PHASE, not a closure round (the fix is a trigger change in `StreamsProvider.tsx`,
> G-5 FIRING). **Confirm that ruling or dispute it; do not re-file it.**
> ⚠ The phase ships NO migration and NO backfill, on a measurement: 78 open todos across 26 threads,
> 53 unmarked of which 49 predate the reconciler. Test that measurement rather than inheriting it.
>
> ⚠ A GUARDRAIL CALL MADE WITHOUT THE OPERATOR, flagged by the phase itself: `/gsd:sketch` was
> DECLINED under G-2 on the ground that `SEED-105` plus `references/run-state-honesty.md` D1 already
> carry an operator-approved vocabulary. It is on `BUS-248` for the operator. **Not yours to rule on
> — but say if you think the ground is wrong.**

## 3 · Phase 249 — The Model You Actually Run

> §6.3 INDEPENDENT REVIEW — PHASE 249. ⛔ WHY IT IS YOU: `249-VERIFICATION.md` frontmatter reads
> `builder: claude` · `reviewer: claude`, by the operator's explicit instruction at the time
> (*"without gemini"*). That instruction has since been superseded — you returned 2026-09-13 and
> `OV-SOLO-01` is re-armed. Artifacts at `.planning/phases/249-the-model-you-actually-run/` (4 plans).
>
> ⚠ THE STRONGEST REASON THIS ONE IS WORTH MONEY: a `/gsd:code-review 249` run AFTER the
> self-verified close found **two blockers the close had passed** (`BUS-247`, both since fixed). CR-01
> was a disagreement between two components whose individual tests are each correct; CR-02 a warning
> that correctly does not fire by its own implementation's logic. **Neither is gate-catchable.** So a
> third pass is not ceremony here — it is the only instrument with a track record on this phase.
>
> HIGHEST-VALUE TARGETS: MODEL-04..09. The headline is that **13 of the operator's configured models
> ran with tool calling silently disabled** (5 OpenRouter, 6 Ollama, 2 LM Studio) — ⚠ **`BUS-247`
> re-measured this as 16, not 13. Establish which is right; a number that moved once can move again.**
> Also: mig 180's self-hosted endpoint columns; `_verified_model_ids` in `settings.py`; the add-model
> guard in `admin.py` that previously validated against the SSRF *discovery* allowlist rather than the
> routing roster (`SEED-172`).
> ⛔ OWED AND KNOWN, do not report as new: `MODEL-04` end-to-end in chat (no live self-hosted
> endpoint), `MODEL-06` multi-worker observation, `MODEL-09` cloud sweep. `MODEL-09` was **closed by
> measurement** — a fresh sweep read 8/8 healthy, so the fix was never built. Test that.
> ⚠ `qwen3-coder:30b` was left in the registry **disabled**, as visible evidence. On `BUS-246`.

## 4 · Phase 245 — The verification debt, discharged or retired in writing

> §6.3 INDEPENDENT REVIEW — PHASE 245. ⛔ WHY IT IS YOU: all 9 plan commits carry
> `Co-Authored-By: Claude`. Artifacts at
> `.planning/milestones/v4.1-phases/245-the-verification-debt-discharged-or-retired-in-writing/`
> (3 plans). Smallest of the four backlog rows — a handful of non-planning files.
>
> ⛔ **IT HAS NO REVIEW ARTIFACT OF ANY KIND** — not a `*-REVIEW.md`, not a refusal. It is the only
> one of the eight DEBT-06 rows in that state, which makes it the cheapest to close and the least
> defensible to leave.
>
> ⭐ **THE REASON THIS ONE IS DELICIOUS AND SHOULD BE REVIEWED CAREFULLY:** the phase's own subject is
> *discharging verification debt in writing*, and its `245-VERDICT.md` carries
> `verification_mode: self-verified # ⛔ OV-SOLO-01 — this file is not exempt from its own rule`.
> **A phase about honest verification records that verified itself.** The file says so out loud, which
> is to its credit — but it is exactly the shape where a reviewer earns their keep. Check whether each
> debt it claims to have discharged or retired was actually discharged or retired, in the register it
> names, rather than declared discharged in the verdict.

## 5 · Phase 241 — Recall at corpus scale

> §6.3 INDEPENDENT REVIEW — PHASE 241. ⛔ WHY IT IS YOU: all 16 plan commits carry
> `Co-Authored-By: Claude`. Artifacts at
> `.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/` (4 plans).
> ⚠ `241-REVIEW.md` EXISTS but carries **no `review_type` field**, so by Phase 240's own counting rule
> (recorded in `240-VERIFICATION.md`) it does not count as independent. Do not treat it as done.
>
> HIGHEST-VALUE TARGETS: `backend/app/services/recall_eval.py` — ⚠ **G-5 FIRES on it (3 phases) and
> its ledger verdict is *safe as-is* (Blocker B / D-246-12)**; test that disposition rather than
> inherit it. And `retrieval_service.py`, where **a G-5 extraction is OWED since Phase 231
> (`SEED-224`)** and 241 was the SECOND landing at 11 lines — a THIRD must propose the extraction
> first, so check whether 241 argued its way past that or simply did not notice.
> ⛔ **`RECALL-01` was REFUSED rather than shipped** — 200 buys recall at a ~1.1 s sequential scan.
> That refusal is the phase's most consequential decision; it is the thing to test.
> ⚠ **UAT row 5 EXPIRES the moment migration 176 reaches cloud** — check whether it has, because if so
> the row is void and the phase record does not know it.

## 6 · Phase 242 — Ship it, and prove what already shipped

> §6.3 INDEPENDENT REVIEW — PHASE 242. ⛔ WHY IT IS YOU: all 5 plan commits carry
> `Co-Authored-By: Claude`. Artifacts at
> `.planning/milestones/v4.1-phases/242-ship-it-and-prove-what-already-shipped/` (2 plans).
> ⚠ Its `independent_review: false` is **not a refusal** — the DEBT-06 row requires *who decided and
> why*, and a bare `false` names neither. `242-REVIEW.md` carries no `review_type`.
>
> ⭐ **THE REASON THIS PHASE IS THE BEST-VALUE REVIEW OF THE FOUR:** its own subject is *proving what
> already shipped*, and it **found two of this project's guards passing VACUOUSLY** —
> `check-hot-file-ledger.cjs` exiting 0 over **0 parsed files** on a CRLF plan, and
> `SettingsPage.a11y.test.tsx` red in **neither** count-gate knob. A phase that catches vacuous guards
> is exactly the phase whose own guards deserve driving. ⚠ **That first defect is NOT fully fixed:**
> `check-hot-file-ledger.cjs 251` still prints `watched: 0` beside `subject: 17` today — its green
> verdict means *nothing was checked*, the same shape one field over.
> ⚠ Also test its D-242-07 claim about migration 177's cloud state, which was **measured false** at
> the time (177 IS applied to cloud).

## 7 · Phase 244 — The chat shell and the composer

> §6.3 INDEPENDENT REVIEW — PHASE 244. ⛔ WHY IT IS YOU: all 19 plan commits carry
> `Co-Authored-By: Claude`. Artifacts at
> `.planning/milestones/v4.1-phases/244-the-chat-shell-and-the-composer/` (**12 plans** — by far the
> largest of the seven; take it last, and scope it by wave rather than as one unit).
> ⚠ THREE review files exist (`244-REVIEW.md`, `-build-round`, `-gap-round-2`) and **none carries
> `review_type`**, so none counts as independent.
>
> HIGHEST-VALUE TARGETS — this phase landed on the hottest files in the repository, and each carries a
> ledger invariant the phase claims to have honoured BY CONSTRUCTION. Those claims are the review:
> `ChatArea.tsx` (76/37) — honoured *"proven by ARITHMETIC: state hooks 9→9, effect hooks 10→10"*;
> `App.tsx` (32/23) — claims BYTE-UNCHANGED with a fence driven RED against a planted third writer;
> `tool_dispatcher.py` (85/35/5048); `MessageList.tsx` — its SECOND list-level mount, *"unconditional,
> measured +4 fetches/thread-open"*; `NavPanel.tsx`; `useComposerAttachments.ts` (created here as the
> seam 244-05 owed).
> ⭐ **An arithmetic claim is the easiest kind to check and the easiest kind to fake — count the hooks
> yourself.**
> ⚠ `workspace.py`'s ledger row went stale **one plan after it was written** — the fastest rot
> recorded in this project. Expect more of that shape here than anywhere else.

---

## The commands — review before running

⛔ **THE SIGNATURE, READ FROM `cmd_open` RATHER THAN FROM THE PROTOCOL DOC.** There is **no
`--subject` and no `--body`** — the item is `--to`, `--from`, and **ONE positional string** that
becomes the whole body. A first draft of this file used `--subject`/`--body`; the parser's `*)` arm
would have swallowed `--subject` as the body and then died on the second positional. Verified:

```
agent-bus.sh open --to <party> --from <who> "<the whole item, one quoted string>"
```

`--to`, `--from` and the body are each required; `--to` may not equal `--from`; the id is allocated by
`next_id` across BOTH bus files, so an id can never be reused.

```bash
# Freshest first — the v4.2 milestone close is blocked on these three.
bash scripts/agent-bus.sh open --to gemini --from claude "$(sed -n '/^## 1 · Phase 251/,/^## 2 ·/p' .planning/DEBT-06-BUS-DRAFTS.md | sed 's/^> \?//')"
bash scripts/agent-bus.sh open --to gemini --from claude "$(sed -n '/^## 2 · Phase 250/,/^## 3 ·/p' .planning/DEBT-06-BUS-DRAFTS.md | sed 's/^> \?//')"
bash scripts/agent-bus.sh open --to gemini --from claude "$(sed -n '/^## 3 · Phase 249/,/^## 4 ·/p' .planning/DEBT-06-BUS-DRAFTS.md | sed 's/^> \?//')"

# Backlog — DEBT-06's milestone-close row. Smallest first, 244 last.
bash scripts/agent-bus.sh open --to gemini --from claude "$(sed -n '/^## 4 · Phase 245/,/^## 5 ·/p' .planning/DEBT-06-BUS-DRAFTS.md | sed 's/^> \?//')"
bash scripts/agent-bus.sh open --to gemini --from claude "$(sed -n '/^## 5 · Phase 241/,/^## 6 ·/p' .planning/DEBT-06-BUS-DRAFTS.md | sed 's/^> \?//')"
bash scripts/agent-bus.sh open --to gemini --from claude "$(sed -n '/^## 6 · Phase 242/,/^## 7 ·/p' .planning/DEBT-06-BUS-DRAFTS.md | sed 's/^> \?//')"
bash scripts/agent-bus.sh open --to gemini --from claude "$(sed -n '/^## 7 · Phase 244/,/^---$/p'  .planning/DEBT-06-BUS-DRAFTS.md | sed 's/^> \?//')"
```

⚠ **The `sed` extraction is a convenience, not a guarantee** — it strips the `> ` quote prefix and
takes everything up to the next heading. **Read back what landed** (`bash scripts/agent-bus.sh list
--to gemini`) rather than trusting the substitution; this project has twice had a bus item silently
mangled by its own shell, once losing the exact line a BLOCKING finding rested on (`BUS-233`).

⚠ **Three rows need NO review, only an index write** — do these first, they are ~10 minutes and they
shrink the problem from 8 rows to 4: **240** flip `partial` → `complete`; **243** write
`independent_review: refused` naming OV-SOLO-01 and quoting `243-REVIEW.md`'s own stand-in sentence;
**246** write `independent_review: done`, reviewer claude, carrying `review_caveat` forward verbatim.
Full derivation: `.planning/DEBT-06-AUDIT.md`.
