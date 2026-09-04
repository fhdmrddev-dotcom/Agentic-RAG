---
phase: 210-ground-truth-operability-and-failure-honesty
artifact: VERIFICATION
author: claude (reviewer — did not build)
builder: gemini
date: 2026-08-26
verified_at_head: 7bd77065
verdict: CLOSED WITH OWED ROWS — SC#1 driven, SC#5 measured+fixed via the SC#10 roster, SC#2/#3/#4 undriven
independent_verifier_absent_for: ["SC#5 (W-1 fix)", "the SC#10 fix (reviewer-authored)"]
---

# Phase 210 — verification

**This phase closes as a DECISION, not as a claim that everything passed.** One success criterion
was driven end to end. Three could not be driven because the install has no test data to drive them
with, and one is code-complete but never observed against a real failure. Every ⛔ below is recorded
with its reason; none is omitted.

## Success criteria

| SC | Requirement | Verdict | Evidence |
|---|---|---|---|
| **#1** | Operator sees the `live_connectors` kill-switch with its current state, flips it, and a subsequent external call is refused | ✅ **PASS** | Driven in-browser. UI state matched the DB (`everyone`); binary Off/On only; flip → DB `"audience": "off"` + receipt `✎ Turned Off · recorded`; Connections rendered **⛨ "Live sending is off for this platform"** read-only refusal naming the Control Room; flipped back, receipt `✎ Set to Everyone · recorded`, install restored |
| **#2** | A user saving a schedule on a scheduler-disabled install is told so at save time | ⛔ **NOT DRIVEN** | Code shipped. The door is gated on `provenance === "published"` (`WorkflowCard.tsx:1426`); this install reads `Yours 0` and every visible row is a Shared **starter**, so `data-testid="workflow-schedules"` never renders |
| **#3** | A scheduled run starts with a budget a realistic workflow can finish inside | ⛔ **NOT DRIVEN — structurally unreachable via the UI** | `workflow_schedules` = **0 rows**, and the lift fires only on an exact `50_000` (`scheduler_service.py:142-147`) while the modal now defaults to `500_000`. The UI can no longer create a qualifying row |
| **#4** | A null-`org_id` user triggers a schedule manually — no 500, no CORS error | ⛔ **NOT DRIVEN** | Depends on #2's row |
| **#5** | When the embedding provider fails, the answer says the provider failed **and names it** | ⚠ **CODE COMPLETE, NOT OBSERVED** | Fixed across three rounds (V-1/V-2/V-3, then W-1). Never driven against a real outage. See the disclosure below |

## ⚠ SC#10 WAS SUBSEQUENTLY RUN, AND IT FAILED THEN WAS FIXED — see `210-SC10-ROSTER.md`

The paragraph below is preserved as written; it is no longer true. **The roster was driven: 9 presets
x 2 label states = 18 rows, of which 5 MISNAMED the provider** — `lmstudio`, `cohere`, `jina`,
`mistral` and a custom endpoint all claimed `openai` when `embedding_provider` was empty, which is the
default state of every env-configured install. **This reopened W-1** (BUS-010) and refuted the
reviewer's own earlier downgrade of it. Fixed by making `resolve_embedding_endpoint` the single
resolution both the client and the name are read from; re-driven **18/18 honest, 0 misname**, guarded
by `test_210_sc10_embedding_provider_naming.py` (19 cases, driven RED first).

⚠ **That fix is reviewer-authored** (Gemini unavailable, operator instructed continue), so it joins
SC#5's W-1 fix in having **no independent verifier**. `/code-review ultra` is the gate for both.

**The original paragraph, preserved:**

> **Also owed: SC#10 was never run.** The ROADMAP binds 210 to SC#10 *with the embedding roster*
(OpenAI / Google / Ollama / LM Studio / OpenAI-compatible — **not** the 8-row chat roster). No row was
executed. This is the axis where W-1's residual weakness lives: the provider name falls back to
substring-matching base URLs, so a self-hosted OpenAI-compatible endpoint on a custom domain resolves
to `openai`. One row per provider, blocked ones recorded ⛔ with a reason.

## Gates — re-derived by the reviewer, never inherited

| Gate | Baseline | At `7bd77065` | |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 34 | **34** | ✅ exact |
| vitest count gate | OK 114/114, total 5793, failed 0 | **OK 114/114, total 5798, pinned 5180, failed 0** | ✅ growth attributable |
| backend `tests/unit` | 68 failed / 2680 passed | **68 failed / 2751 passed** | ✅ rot set exact; `+71` passing, of which `+61` is **211-01's** concurrent wave-1 landing, not 210's |
| `check-claude-md-size.cjs` | — | **OK** — 83,431 chars, 55.6% of limit | ✅ |
| `check-deploy-drift.sh` | — | **PASS** | ✅ 2 warnings, both pre-existing |

Per-file backend rot distribution unchanged (`test_retrieval_service.py` 15,
`test_111_1_reembed_kickoff.py` 4), and the 19 pre-phase failure names are recorded verbatim in
`210-PREFLIGHT.md`. Measured cause: async-conversion rot, not defects.

## ⚠ Disclosures — stated, not implied

1. **No independent verifier exists for SC#5's W-1 fix.** Gemini authored it and ran out of quota
   before committing; the **reviewer** committed it (`7bd77065`, disclosed in that commit message).
   AGENTS.md §6.3: *"A phase that closes on self-assessment should record that it did."* This is that
   record. **`/code-review ultra` — operator-only — is the outstanding independent gate.**
2. **The reviewer drove the UAT**, because the builder was out of quota and the operator authorised
   it. That is the correct seat under §3.1 (the driven check is the reviewer's), and the
   before-state was captured *before* any browser touched the install.
3. **A W-1 claim of mine was WRONG and is corrected in `210-REVIEW.md`** rather than edited away: I
   asserted the outage message would name the wrong provider on this install. It would not —
   `_val()` falls back to the env var, a dedicated embedding key is set, and the client really points
   at OpenAI. The structural gap survives; the observable claim does not.
   ⚠ **AND THEN MY CORRECTION WAS ITSELF TOO GENEROUS.** It downgraded W-1 to *"a latent gap this
   install does not exhibit"* — true of this install, **wrong about the product**. The SC#10 roster
   measured the gap reachable in **5 of 9 shipped presets** in the default configuration state.
   Both the original claim and its over-correction are preserved; the roster is the arbiter.
5. **The SC#10 fix is reviewer-authored** (Gemini unavailable, operator instructed continue) and has
   **no independent verifier**, exactly like the W-1 fix in (1). ⚠ Its first cut re-introduced W-1 for
   the no-dedicated-key path and was caught by **Gemini's** existing tests, not by mine — which is
   itself an argument for the separation this phase kept having to suspend.
4. **W-2 — the `phase_types.py` fence crossing — has no operator ruling.** `705a7412` modified a file
   BUS-006 ruled 210 would leave inside 211's fence, and 211 has since committed into that same file.
   Recorded, undecided.

## Review history

| Round | Verdict |
|---|---|
| Pre-flight (`210-PREFLIGHT.md`) | 7 findings before execution; 3 could have passed every gate with the feature broken |
| Review round 1 | **BLOCKER** — the error citation had no `document_id`; `KeyError` driven at 3 reachable sites |
| Review round 2 | V-1/V-3 fixed; SC#5 still unmet (W-1); fence crossing (W-2) |
| W-1 fix | Reviewed and committed; `resolve_effective_embedding_provider` mirrors the real routing |
| SC#10 roster | **W-1 REOPENED** (BUS-010) — 5 of 18 rows misnamed. Fixed reviewer-side; re-driven 18/18 honest |

## What closes this phase completely

- [ ] `/code-review ultra` on 210 — the independent gate for SC#5
- [x] ~~SC#10 embedding-roster rows~~ — **DONE**: 18 rows driven, 5 misnames found and fixed, 18/18 after (`210-SC10-ROSTER.md`)
- [ ] SC#2 / SC#4 driven once a `published`-provenance workflow exists
- [ ] SC#3 against pre-existing cloud schedule data, or a hand-inserted legacy row
- [ ] An operator ruling on W-2

Four reported bugs stay `status: folded` with their reasons in their own records
(`BUG-260815-05`, `-260826-03`, `-06`, `-07`); `BUG-260826-04` is `closed`,
`verified_closed_by: "210"`.
