---
type: postflight-review
phase: 213
phase_name: "Per-Tool Grants and the Approval Moment"
builder: gemini
reviewer: claude
reviewed_at: 2026-08-27
reviewed_commit: 93fc2f52160c9148c38ced853837bd67bec8ea15
verdict: ⛔ NOT COMPLETE — GRANT-03 (the approval moment) is not implemented; the phase's own name is its gap
---

# Phase 213 — post-execution review

**Method:** read against `HEAD` (`93fc2f521`, clean tree), every claim checked at the file and line
that produced it. Nothing here is inferred from the summary.

**Severity key:** ⛔ blocking · ⚠ major · ▪ minor · ✅ verified-good.

---

## 0 · First, the operator's actual question

**`213-SUMMARY.md` EXISTS and IS committed** — 4,540 bytes, `93fc2f521`, 55 insertions. It was
written at 22:48 and committed at 22:49. If it looked absent, the editor had not refreshed.

---

## 1 · ⛔ THE HEADLINE — GRANT-03 IS NOT IMPLEMENTED, AND IT IS THE PHASE'S NAME

`213-SUMMARY.md:5` claims the phase *"delivers the full tri-state per-tool grant system **and
approval moment mechanics**"*. **The approval moment does not exist.** Four independent measurements,
each of which alone would be enough:

**(a) There is no `ask` arm in the executor.**

```
$ grep -n '"ask"' backend/app/services/harness/phase_types.py
(no output)
```

Gate 5.5 (`phase_types.py:2515`) refuses on `deny` and **falls through on everything else**. A tool
whose posture is `ask` is dispatched exactly like one set to `allow`.

**(b) The armed checkpoint was never extended, so nothing names service / tool / arguments.**
D-213-09 decided posture would feed the existing `action_risk_armed` checkpoint so its prompt gains
what SC#3 requires. `harness_engine.py` is **unchanged by this commit** — it is not in
`git show --stat 93fc2f521` at all.

**(c) The entire ask + refusal vocabulary is shipped and consumed by NOTHING.**
`grantsVocabulary.ts:37-54` ships `ASK_HEADLINE`, `ASK_NOTHING_SENT`, `ASK_ARGS_LABEL`,
`ASK_APPROVE`, `ASK_DENY`, `ASK_ALWAYS`, `ASK_ALWAYS_NOTE`, `REFUSED_HEADLINE`,
`REFUSED_BECAUSE_DENIED`, `REFUSED_BECAUSE_UNGRANTED`, `REFUSED_NEXT`.

```
$ grep -rn "REFUSED_HEADLINE\|REFUSED_BECAUSE_DENIED\|REFUSED_NEXT\|ASK_APPROVE\|ASK_ALWAYS" \
        frontend/src --include=*.tsx --include=*.ts | grep -v grantsVocabulary.ts
(no output)
```

⚠ **This is the exact shape `213-PREFLIGHT.md` §2 REACH-1 and the Phase 118 / Phase 200 SC#3
precedent name: built, gated, green, structurally unreachable.**

**(d) No test pins the pause.** Every `ask` assertion in `test_213_gate55_execution.py` checks only
that `resolve_effective_posture` **returns the string** `"ask"` (`:64`, `:99`). Nothing asserts a run
pauses, nothing asserts a person is asked, nothing asserts anything is withheld. **The function is
tested; the behaviour was never built.** *"Nothing typechecks prose"* — and a green suite over a
resolver is not evidence about a gate.

**Wave 3 is titled "Human Pause / Approval Moment Engine Dispatch & Recovery" and its recorded
content is** *"Confirmed `PendingAskCard` integration in `WorkflowRunPage.tsx` via `RunSpine`
`renderAsk`"* — i.e. it **confirmed a mount that already existed**, which `213-PREFLIGHT.md` §0
CORR-1 had already measured and told them existed. Confirming a pre-existing thing is not building
the thing.

### ⛔ 1b — and the `ask` posture being inert makes the MCP path MORE PERMISSIVE than before

This is the part that makes (a) a security finding rather than a missing feature.

**Before this phase**, Gate 6 read `grants.get(tool_name) is True` — **a missing key DENIED**, the
asymmetry `descriptors.py:56` calls *"the desirable direction (T-211-05)"*.

**That check was REMOVED.** Gate 6 at `:2551` no longer contains `is_granted`, `tool_grants` or any
refusal — Gate 5.5 is now the only grant enforcement anywhere. And Gate 5.5 refuses **only** on
`deny`. So:

```
new connection            → migration §1: default_approval_posture NOT NULL DEFAULT 'ask'
tool absent from grants   → resolve_effective_posture() returns "ask"      (grants.py rule 2)
Gate 5.5                  → posture != "deny" → falls through
Gate 6 / Gate 7           → DISPATCH
```

**A newly created connection, with no grant ever configured, dispatches.** The pre-213 behaviour
for that same row was *refuse*. ⚠ Existing rows are safe **only because** migration §3 backfills
`default_approval_posture = 'deny'` — so the fail-closed property now depends on a **column
default** rather than on the gate, and the column's default for anything new is `'ask'`.

⚠ **Workflow runs are still protected by the pre-existing armed `action_risk_armed` checkpoint**
(`models/harness.py:475`, structurally true on `external_action`), so this is **not** an unattended
send today. **It becomes one in Phase 216**, which is gated behind this phase precisely because
chat has no such checkpoint — and the standing rule is *never an outbound capability in
`_TOOL_REGISTRY` before the approval model exists*. **The approval model does not exist yet.**

---

## 2 · ⚠ GRANT-04 — the refusal does not name the grant that would allow it

SC#4 requires the refusal to *"name the grant that would allow it"*, and D-213-15 chose the sketch's
words. What ships at `phase_types.py:2546` is the **pre-existing** sentence:

```
"Tool execution refused: Tool '{tool}' is not granted permission on connection '{name}'."
```

That is `213-PREFLIGHT.md` §3's option 3 — *"keeps the mechanism-naming voice the sketch deliberately
replaced"* — which was **not** the chosen option. `REFUSED_BECAUSE_DENIED` and `REFUSED_NEXT` exist
in the vocabulary and are unused (§1c). It names no grant and offers no next step, so
`BUG-260827-02`'s closure is partial and `BUG-260815-06`'s class is untouched.

## 3 · ▪ D-213-16 — one `reason`, not three

Gate 5.5 writes `reason: "permission_denied"` only. D-213-16 asked for values distinguishing
*grant says deny* / *never granted, inherited a deny default* / *a PERSON pressed Deny*. The third
cannot exist yet (§1), but the first two are distinguishable today and are not distinguished — so
the ledger cannot answer the operator-facing question the decision was written for.

## 4 · ⚠ The migration claims re-paste safety it does not have

`128_...sql`'s header says *"The whole file is RE-PASTE-SAFE"*. §3 is not:

```sql
UPDATE ... SET default_approval_posture = 'deny',
               tool_grants = jsonb_build_object(capability, 'allow')
 WHERE capability IS NOT NULL;
```

Re-pasting after real use **discards every posture a person has set** on every capability row and
resets the connection default to `deny`. The MCP arm has the same property — its `WHERE value =
'true' OR value = '"allow"'` silently drops any `ask` or `deny` a person chose. It is idempotent in
the arithmetic sense and **destructive in the operator sense**, and the header's claim invites
exactly the re-paste that would do it. (The project rule *never re-execute an applied migration*
makes this latent rather than live — but the sentence should not be there.)

▪ `213-SUMMARY.md:12` also says the migration *"adds … `tool_grants` (jsonb DEFAULT '{}')"*. It does
not — `tool_grants` predates it (migration 126). Harmless, but it is a claim about a schema change
that did not happen.

---

## 5 · ✅ Verified good — real work, and it should not be re-litigated

- ✅ **SEC-1 is SATISFIED, and this was the ⛔ of the pre-flight.** Gate 5.5 sits at `:2515`, between
  Gate 5 (`:2428`) and the shape fork (Gate 6 `:2551` / Gate 7 `:2597`), and runs for **both**
  shapes. `BUG-260827-02`'s structural half — *the gate is MCP-only* — is genuinely closed.
- ✅ **SEC-2 is SATISFIED.** §4 grants `SELECT (default_approval_posture)` to `authenticated` in the
  same migration, with migration 127 §4's one-column-per-line convention and its reasoning quoted.
- ✅ **D-213-07's shape-aware backfill is correct.** Both populations land on `default_approval_posture
  = 'deny'`; MCP `true → 'allow'` with false keys dropped; capability rows get `{capability: 'allow'}`
  — which is exactly what they did before the gate closed. Nobody's shipped workflow breaks.
- ✅ **S-1 survived and was widened as designed.** `_LEGAL_GRANT_VALUES` went
  `frozenset({True, False})` → `frozenset({"allow","ask","deny"})` — the one-edit widening the data
  declaration existed for — and `_sanitize_tool_grants` is now called at **three** sites
  (`:683` create, `:823` update, `:944` grants), one more than before. The create path is newly
  covered.
- ✅ **D-213-00's backend cut was taken.** `connectors/grants.py` is a real leaf: 92 lines, imports
  only `logging` and `typing`, and imports neither `phase_types` nor `harness_engine`.
- ✅ **GRANT-05's receipt carries `tool_name` and not the arguments** — D-213-14 held; D-08 is not
  breached.
- ✅ **`ConnectionGrantsList.tsx` is a NEW component** (289 L), not new lines in
  `ConnectionFormPanel.tsx` — which actually **shrank** (79 changed, net negative). D-213-00's
  frontend cut was taken, and G-1 / G-5 are answered by construction.
- ✅ **The new suite was pinned.** `scripts/vitest-count-gate.cjs` gained 4 lines; the gate reads
  119/119, up from the 118/118 I measured pre-execution. GATE-1's trap was avoided.

---

## 6 · What I could not check

- **Nothing was driven.** This is a read of `93fc2f521`. The gates were not re-run here — and the
  claimed numbers are consistent with my own pre-execution baselines (118 → 119 pinned; 5857 → 5865
  total, `+8` matching the new suite's 8 cases).
- **Whether migration 128 was applied to the live local DB.** The summary says "created and applied";
  `full-schema.sql` moved `+9`, which is consistent with a regeneration against an applied migration,
  but I did not query the database.
- **The 10 sketch invariants** are claimed verified in `ConnectionGrantsList.test.tsx` (231 L). I did
  not read them one by one against `BUILD-CONTRACT.generated.md` §3.

---

## 7 · Disposition

**The phase delivered the GRANT half and not the APPROVAL half.** GRANT-01, GRANT-02, GRANT-04
(partially) and GRANT-05 have real implementations. **GRANT-03 has none**, and SC#3 — *"the run
pauses and shows a person the service, the tool and the exact arguments — and nothing leaves until
they answer"* — is false at HEAD.

Because Phase 216 is gated behind this phase for exactly that guarantee, **213 cannot be closed as
complete**, and the milestone's hard prerequisite is not yet met.

**This is a gap-closure round, not a new phase** — the surface, the vocabulary, the posture
resolution and the mount all exist; what is missing is the wiring between them. Run
`node scripts/check-gap-closure-rounds.cjs 213` first: this would be round 1, so G-7 does not fire.
