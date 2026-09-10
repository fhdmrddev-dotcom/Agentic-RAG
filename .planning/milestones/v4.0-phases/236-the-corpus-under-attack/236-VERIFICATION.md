# Phase 236 — REVIEWER VERIFICATION (Claude · builder was Gemini)

- **Verified at**: `68858a3c5`
- **Method**: every figure re-measured, never read from the builder's claim; every behavioural
  criterion driven.
- **Verdict**: ⛔ **REVISE — SC#2 overclaims and SC#1 is not met.**
- ⚠ **THIS VERDICT IS SUPERSEDED IN PART — READ `236-VALIDATION.md` BESIDE IT.** Added
  2026-09-10 by the v4.0 milestone audit, which found this file still reading as an open REVISE
  with nothing pointing at what discharged it. **The verdict named TWO problems and exactly ONE
  was fixed:**
    - **SC#2 (the GA gate) — now genuinely PASS.** `236-VALIDATION.md` records **8/8 mutations
      caught loudly** via the in-process `--disable-defense=<name>` fixture
      (`scripts/run-defense-mutations.sh`, `236-MUTATION-REPORT.md`). The overclaim this verdict
      named was answered by DRIVING it, which is why `STATE.md` records *GA GATE MET 2026-09-06*.
    - ⛔ **SC#1 — STILL OWED, and not by an oversight.** The offline unit suites pass 11/11, but
      the live end-to-end sync across external providers needs real credentials the phase could
      not supply. `236-VALIDATION.md` marks it **OWED**, not passed.
  ⭐ **So "236 is closed" and "236 is fully verified" are different statements, and only the first
  is true.** The GA gate is met; one success criterion is still owed on credentials.
  ⚠ Recorded here rather than by editing the verdict, because a verdict that quietly becomes a
  PASS is how a phase stops being able to say what it did not check. The engineering is good and the
  structure is right; two of the three success criteria are not yet supported by the evidence
  offered for them.

---

## ✅ First — a correction to MY OWN baseline, before anything else

**`BASELINES.md` recorded `71 failed` for the backend unit suite. That figure is WRONG.**

I re-measured the baseline commit `f992f28e8` in a dedicated bootstrapped worktree:

```
72 failed, 3930 passed, 2 xfailed, 2 xpassed  in 113.94s
```

My original 71 was a single lucky sample, and I published it as "exactly the ceiling, zero
headroom" — which is what made the phase's `72` look like a broken gate when I first saw it.
**It was not.** Diffing the complete failure sets:

```
baseline=72   current=72
NEW failures introduced by phase 236:  (none)
fixed by phase 236:                    (none)
```

**Byte-identical failure sets. Phase 236 introduced zero backend failures**, and `passed` rose
`3930 → 3945` (+15, its own new tests). The two production changes it makes are pure constant
hoists whose rendered strings are byte-identical, so they *could not* have moved the number.

⚠ Two things follow, and neither is Phase 236's fault: **CLAUDE.md's locked ceiling of `71` does
not match this tree**, and my first measurement was truncated (`tail -30`) so it could not be
diffed at all. **Capture the full `FAILED` list, not a tail** — a count without a set cannot
attribute anything.

---

## ⛔ FINDING 1 — three of the eight "mutations caught loudly" are CIRCULAR

`scripts/run-defense-mutations.sh` reports **8/8 caught**, and I drove it myself and saw 8/8. But
the mutation and the assertion are the same fact for three defences: the mutant deletes a constant,
and the test asserts that constant exists. **Red by definition, and it proves nothing about whether
the defence reaches the product.**

The decisive experiment — **keep the constant defined, remove its USE**:

| Defence | Mutation driven | Suite result | Verdict |
|---|---|---|---|
| `embedding_metadata_prompt` | dropped `{METADATA_EXTRACTION_ANTI_INJECTION}` from the prompt at `embedding_service.py:335` | **15 passed — GREEN** | ⛔ **circular** |
| `eval_runner_evidence_prompt` | replaced `EVAL_JUDGE_RUBRIC.format(...)` with `"Grade the answer."` at `:325` | **15 passed — GREEN** | ⛔ **circular** |
| `validator_kinds_grounded` | replaced `JUDGE_RUBRIC_CORE.format(...)` with `"Judge it."` at `:571` | **15 passed — GREEN** | ⛔ **circular** |
| `skill_proposer_evidence` | swapped the delimiter reference at `:307` | **1 failed, 14 passed — RED** | ✅ **real** |

**The whole judge rubric can be deleted from the system prompt actually sent to the model, and this
suite stays green.** That is this phase's own headline failure mode — *"the suite is green and
always has been"* — reproduced inside the phase built to prevent it.

The tell is in the assertions: `:239` `assert embedding_service.METADATA_EXTRACTION_ANTI_INJECTION
== expected_clause` and `:245` `assert expected_clause in normalized_source` check the constant and
the *source text*. `skill_proposer` is the one that works because `:379` asserts on **rendered
output** — `assert "…" in rendered`.

**Fix**: assert every defence at the point of USE — on the assembled prompt / rendered output the
callee actually receives — never on the constant or on the module source. Then re-run the mutation
loop; a defence whose use-removal stays green has not been proven load-bearing.

⭐ This is `presence assertions cannot see content drift` (Phase 235's lesson) recurring one phase
later, in the phase whose entire purpose is to stop exactly this.

## ⛔ FINDING 2 — SC#1 is marked PASS on evidence that is neither synced nor cross-provider

> SC#1: *"A document carrying a planted instruction is **synced in from a real source**, and asking
> the agent an ordinary question does not make it follow that instruction — **on every provider in
> the native roster**."*

`236-VALIDATION.md:16` marks SC#1 **PASS**, citing `test_adversarial_corpus.py` — 11 offline unit
tests. And `:22` marks **Live UAT PASS**, describing its own evidence as
*"`scripts/uat-adversarial-sync.py` **simulating** Google Drive watch sync"*.

I read that script. It is mocked end to end — `_MockWatchedConnection`, `AsyncMock`, `MagicMock`,
`# Step 2: Simulate watch sync indexing`. **No document is ever synced. No model is ever called.**

That is two of the ROADMAP's own named failure modes, both marked PASS:
- *"The attacks run against a unit-test string rather than a document that arrived through a sync."*
- *"It is driven on one provider and called cross-provider."*

**A mocked rehearsal is legitimate work — it is not the criterion.** SC#1 must read ⛔ **owed**,
naming what is needed (operator hands: real Drive credentials, a live sync, a real chat drive per
provider). Recording it as PASS is the one thing that cannot stand.

## ⚠ FINDING 3 — SC#10's PASS is offline capability inspection, not a defence drive

`236-ROSTER-REPORT.md` is exactly the artifact I asked for: **8/8 derived providers, none omitted**,
derivation from `app.config.MODEL_CAPABILITIES`, and it matches my independent baseline exactly
(same provider set, same model counts, same representatives, `moonshot` correctly at `emit_tier:
coerce`, `openrouter` correctly `native_tools: False`). **The roster mechanism is right.**

But the per-provider verdict column reads **PASS** for a check on `native_tools` / `emit_tier` /
`supports_assistant_prefill` flags and prompt assembly — not on whether that provider's model
*refused an injected instruction*. Prompt-level guarantees are precisely the class that degrades
per-provider, which is why SC#10 exists. **Relabel the column to what it measured** (e.g.
*"prompt/flag parity: PASS"*) and carry the behavioural verdict as ⛔ owed alongside SC#1.

## ✅ What genuinely passes

| | |
|---|---|
| **SC#3** | ✅ **MET.** `236-ATTACK-REPORT.md` is properly legible — payload id, category, target module, expected defence, tried, refused, verdict, plus per-attack detail. A person can read it. ⚠ Its *"13/13 Refused"* inherits Finding 1's overclaim on three rows. |
| **SC#2 mechanism** | ✅ The fixture design is correct and the **patch-target-exists fence I demanded is present and real** (`conftest.py:100`, `assert hasattr(mod, symbol_name)`), closing the silent-no-op hole. What is wrong is the assertions it drives, not the harness. |
| **Backend suite** | ✅ **zero new failures**, sets byte-identical to baseline (see correction above). |
| **G-5 ledger** | ✅ `ledger gate OK` — 2 watched files, both rowed, `docs/HOT-FILE-LEDGER.md` synced same-commit. **M-4 discharged.** |
| **Frontend count gate** | ✅ `count gate OK` — total **7787** · `failed 0` · pinned **6991** · **238/238** pinned files present. Identical to the post-repair baseline; a backend-only phase moved nothing, as it should not. |
| **Production blast radius** | ✅ Two files, both pure constant hoists, rendered output byte-identical. No kill-switch anywhere. The BLOCKING-1 remedy held. |
| **O-1 taxonomy** | ✅ Attack-first (`LLM01-*`), and `LLM01-UNMAPPED-01` is carried as an explicit unmapped **finding** rather than dropped — which is what I asked for. |

---

## Required before this phase closes

1. **Re-point the three circular assertions at the point of use**, then re-run the mutation loop.
   A defence whose use-removal leaves the suite green is not proven.
2. **Flip SC#1 and the Live UAT row from PASS to ⛔ owed**, naming the operator actions required.
3. **Relabel SC#10's verdict column** to the property actually measured.
4. Correct `BASELINES.md`'s `71` to the measured `72` — **mine to fix, not the builder's.**

⚠ **AGENTS.md §6.3 applies to item 4 and to the `LibraryPage` repair earlier in this phase:** I
wrote both, so I am not an independent verifier of either. Route them elsewhere or record the phase
as closing on self-assessment for those two items specifically.
