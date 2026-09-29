---
phase: 258-a-tier-becomes-enforceable
reviewer: claude
builder: gemini
review_type: independent (AGENTS.md 6.3 — whoever built it does not verify it)
fixes_applied_by: gemini (the builder fixed its own work; the reviewer did NOT become the builder)
separation_held: yes — this is the 257 lesson applied rather than repeated
base_sha: da56c543632fc0999b7229d28852cc0dd5fdb512
head_reviewed: 0e92c1b4e
date: 2026-09-19
verdict: PASS — five findings fixed and driven; two items OWED to the operator, neither a defect
---

# Phase 258 — independent review

## Verdict

**PASS.** Seven findings. **Five fixed and independently verified by driving each one**; the two
that remain are not defects but operator calls, and both are recorded as owed rather than closed.

⭐ **The separation held, and that is the headline.** Phase 257's reusable finding was that an
operator override saying *fix it directly* silently converts the REVIEWER into the BUILDER — an
independent pass then found **14 of 17 findings were against the reviewer's own fixes**. Here the
builder fixed its own work and the reviewer re-drove it. Every verification below is a plant that
was made, observed, and removed with the tree proven md5-identical.

⚠ **What the review caught was not sloppiness — it was two claims the tests agreed with.** The
fail-open default (`F-1`) had a docstring promising strict fail-closed directly above it, and a
suite that never once passed a NULL tier. The fence (`F-3`) was real, substantive, and had been
driven RED by the builder — against one of the two columns its own criterion names.

## Baselines — captured BEFORE the builder touched source

Captured at `da56c5436` while the builder was still in discuss-phase (docs-only), because a
baseline taken after source work starts measures the change against itself (AGENTS.md 6.1).

| gate | at `da56c5436` (base) | after 3 plans (`4e2f55ad5`) | after fixes (`a9bf8ef07`) |
|---|---|---|---|
| backend pytest | **71 failed / 5100 passed** / 2 xfailed / 2 xpassed | 71 / **5126** | 71 / **5133** |
| vitest count gate | 8468 · failed 0 · pinned 7727 · 293/293 | identical | identical |
| tsc `tsconfig.app.json` | 65 errors | not re-run (zero frontend files in diff) | same |

⭐ **The backend failure SET was diffed, never the count.** `comm` in both directions returns
**empty** at every stage — the 71 are byte-identical to base, so nothing red here is new and
nothing inherited was silently repaired. +33 net passing tests across the phase.

⚠ The full 71-name set was very nearly lost to a `tail -30` in the reviewer's own first capture
(29 of 71 names). Recorded because it is the second appearance of this exact mistake in this
repository's history — capture the SET, never a tail.

## Findings

| id | severity | finding | status |
|---|---|---|---|
| F-1 | **HIGH** | An unreadable `subscription_tier` was silently granted `standard` — fail-OPEN on the exact case TIER-05 names | **FIXED** (`a9bf8ef07`) |
| F-2 | HIGH | The run path is ungated: a Standard org cannot author a workflow but can still execute one | **OWED — operator call** |
| F-3 | MEDIUM | The TIER-04 fence guarded one of the two columns SC#1 names | **FIXED** (`a9bf8ef07`) |
| F-4 | MEDIUM | A database outage told a paying customer to upgrade (403, not 503) | **FIXED** (`a9bf8ef07`) |
| F-5 | MEDIUM | Deploy-ordering hazard — migration 186 absent from production | **OWED — operator action** |
| F-6 | LOW | Three ledger rows were predictions, not measurements | **FIXED** (`a9bf8ef07` + `207639dda`) |
| F-7 | LOW | `TIER_ORDER` was dead; its ordering duplicated as a hardcoded SQL `CASE` | **FIXED** (`a9bf8ef07`) |

### F-1 — the rejected option was the one that shipped

`backend/app/db/entitlements.py` read:

```python
current_tier = (raw_tier or "").strip().lower() or "standard"
```

**D-258-06 explicitly rejected** the option *"Fallback to Minimum Tier — if the tier is unreadable,
treat org as default 'standard' tier"*. The code implemented it anyway, under a docstring
promising *"Strict fail-closed"*.

⚠ **Not theoretical — it was 100% of production.** `organizations.subscription_tier` is `text`,
**nullable, no default**, and `create_org_with_default_dept` takes `p_subscription_tier DEFAULT
NULL`. Measured against production through the Supabase MCP read path: **2 orgs, 2 with NULL
tier.**

⚠ **The suite agreed with the defect.** Every 258 test used `"standard"` (×3) or `"enterprise"`
(×1). No NULL, no blank, no unknown value — so `SC#5`'s *"that arm is driven"* was false while
reading green.

**Verified fixed:** the suite now exercises `None` (×2), whitespace-only `"   "`, an HTTP-level
refusal, and the null-tier-**with**-add-on ordering case — which matters, because the additive
override is checked *before* the fail-closed arm by design (D-258-08), so "fail-closed on an
unreadable tier" has one deliberate exception and it is now pinned rather than implied.

### F-3 — a real fence, guarding one of two columns

SC#1: *"nothing else reads those **two** columns directly."* The fence banned `subscription_tier`
across four AST node types and exempted only the two canonical homes. It did not mention `add_ons`.

**Driven, both before and after.** A planted module granting capabilities from a direct `add_ons`
read **PASSED** the fence at `4e2f55ad5` and **FAILS** it at `a9bf8ef07`. A planted
`subscription_tier` read fails correctly at both. Tree md5-identical after every plant.

⭐ The fence itself was never the problem and should not be read as one — it was built properly and
driven RED by the builder. The gap was in its **scope**, which is exactly what a second pair of
eyes exists to find.

### F-4 — the refusal that generates the support ticket it was designed to prevent

On any exception the resolver returned `(False, None, None, …)`, so `EntitlementDeniedException`
defaulted to `required_tier="enterprise"`, `current_tier="unknown"` → **403 "requires 'enterprise'
tier"**. An Enterprise customer hitting a transient DB blip was told to buy Enterprise.

**Verified fixed:** `EntitlementUnavailableException` → **503**, pinned at unit *and* HTTP level.

⚠ **Residual, recorded not blocking.** The 403/503 discriminator is a **prose match across two
modules** — `entitlement_service.py:125` sniffs `"database error"` in the reason string produced at
`entitlements.py:169`. **Driven:** renaming that message turns
`test_resolve_org_entitlement_fail_closed_on_db_exception` RED, so the coupling **is** pinned and
drift cannot ship silently. Restored md5-identical. What it lacks is a pin that *explains the
consequence* — the failure message says a string changed, not *"the 503 has silently become a
403."* A shared constant or a structured discriminator would say it outright.

### F-6 — figures written in the commit that invalidated them

Three ledger rows were predictions. `entitlements.py` and `entitlement_service.py` read
`0 / 0 / 0`; `workflows.py` read `42 / 22 / 2255` against a measured `43 / 23 / 2261`. Cause: the
ledger commit `363aac7ba` landed **before** the three feat commits.

The fix corrected `workflows.py` but re-introduced the same mechanism one turn later — both new
rows were written as `1 / 1 / …` inside `a9bf8ef07`, **itself the second commit touching each
file**. Corrected to `2 / 1 / …` in `207639dda`, across **both** registers in one commit.

⚠ Phases and line counts were right throughout, so **G-5's trigger was never misled** — the rows
were wrong without being dangerous. Recorded because *a row that is present and WRONG stops an
audit harder than an absent one* is this ledger's own finding, and it has now fired twice inside
one phase.

### F-7 — `TIER_ORDER` was dead, and is now alive

Defined at `entitlements.py:12`, referenced nowhere; the ordering it represented was duplicated as
a hardcoded SQL `CASE`. Now the single source of the ordering.

⚠ **TIER-02 is row-change-complete only for the three existing tiers.** Moving a capability between
`standard` / `pro` / `enterprise` is a row change with no deploy, as required. Introducing a
**fourth tier slug** still needs a code edit to `TIER_ORDER`. Not a defect against the criterion as
written; stated so the next packaging conversation does not discover it by surprise.

## Owed to the operator — neither is a defect

### F-2 — authoring is gated, execution is not

`require_capability` appears at exactly two sites: `workflows.py:1301` (publish) and `:1401`
(create_draft). Workflow runs start through `POST /threads/{id}/messages` →
`preflight_workflow_kickoff`; `threads.py` has **zero** capability gates. Also ungated:
`POST /workflows/generate` (LLM-powered authoring), `/template/placeholders`, `/{id}/template`.

⚠ **D-258-09's premise was wrong and nobody re-derived it.** The decision chose *"POST /workflows
**and POST /workflow-runs**"* — but `workflow_runs.py` is **GET-only** (D-188-14), so the named
surface does not exist. The plan silently narrowed to the half that does.

**Disposition (builder, recorded in STATE.md):** deferred to an execution phase, to preserve
`threads.py`'s G-5 invariants and avoid entangling general thread chat. A legitimate call, stated
as a decision rather than as a claim that everything shipped.

⛔ **Consequence carried into the phase close, in plain words: `SC#1`'s *"every gated capability
calls it"* is PARTIAL.** A Standard org cannot create or publish a workflow, but can run any
existing one — and running is the half that consumes tokens and compute. A milestone about what
you can *sell* should not leave the expensive half ungated without saying so out loud.

### F-5 — migration 186 is not in production

`to_regclass('public.tier_capabilities')` returns **null** in production. Local has it (the
`full-schema.sql` regeneration dumps the live local DB and gained 90 lines).

**Deploy order is migration-then-backend, never the reverse.** If the backend ships first, every
entitlement check throws on the missing table, fails closed, and **all workflow authoring 403s for
every org**.

**Operator decision 2026-09-19:** production migrations are applied as a batch at milestone close,
per standing practice — so 186 rides with the rest of v4.3 rather than being applied alone.

⛔ **Two things must happen in the same window as that paste:**

1. **Both production orgs have `subscription_tier IS NULL`.** Once the backend carrying these gates
   reaches production, both are refused workflow authoring — correctly by design, and
   catastrophically if nobody set a tier first. Set both tiers **before** the backend ships.
2. ⚠ **The migration grants `SELECT` on the capability map to `anon`** — an unauthenticated reader
   can fetch the full pricing/packaging matrix. Nothing needs this; the backend reads through
   `service_role`. **`anon` over-grants are this repository's most-repeated security finding**
   (BUG-260911-01, migration 156, migration 177 — three prior occurrences, each found by a read
   that no gate performs). The clean fix is a follow-up numbered migration that revokes it, **not**
   an edit to 186, which is already applied locally and must never be re-executed.

## What was solid

- **The AST fence is real, not decorative** — four node types, a full `backend/app` walk, two
  exemptions, and it fires. Independently driven RED by the reviewer rather than taken on trust.
- **Migration 186 is clean** — RLS enabled, writes restricted to `service_role`, seed matches
  D-258-07 exactly, `ON CONFLICT DO UPDATE` makes it re-runnable.
- **`workflows.py` is genuinely "honoured by construction"** — two `Depends`, no new branch, on a
  G-5-firing file whose extraction is still owed. Checked against the diff, not accepted from the
  ledger cell.
- **The Phase 256 fence pin was re-derived properly** — `api/workflows.py:1802 → 1809`, with the
  original recorded beside the new value, exactly as that fence's own docstring demands.
- **The one-way door was asked before it was encoded.** `TIER-02`'s pricing metric went to the
  operator as four alternatives and came back as D-258-01 (Ascending Capability Bundles).
  `SEED-294`'s entire warning is that metrics get chosen by accident when nobody names the moment;
  the moment was named.

## Guardrails

- **G-5** — `backend/app/api/workflows.py` fires (43 / 23 / 2261) with its extraction still owed.
  Disposition recorded as honoured-by-construction and verified against the diff. ⚠ The G-5
  obligation was **absent from every phase artifact** until the reviewer raised it pre-execute; the
  ledger *gate* passed throughout, because a gate checks that a row exists, not that the guardrail
  was discharged.
- **G-8** — 3 plans, inside the 3-5 target.
- **Ledger rows added AT CREATION** for both new files, per the standing precedent.
- **CLAUDE.md size gate** — 107,869 chars, 71.9% of limit, OK.
