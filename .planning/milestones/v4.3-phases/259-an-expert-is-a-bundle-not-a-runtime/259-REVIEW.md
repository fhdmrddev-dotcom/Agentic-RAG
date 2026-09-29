---
phase: 259-an-expert-is-a-bundle-not-a-runtime
reviewer: claude
builder: gemini
review_type: independent (AGENTS.md 6.3 — whoever built it does not verify it)
fixes_applied_by: gemini (the builder fixed its own work; the reviewer did NOT become the builder)
separation_held: yes — second consecutive phase
base_sha: a9bf8ef07 (source-identical to 259's start; every commit between was docs-only, proven by a path-filtered diff)
head_reviewed: 21755494e
date: 2026-09-20
verdict: PASS — three findings, all fixed and each RE-DRIVEN; one operator decision surfaced and answered
---

# Phase 259 — independent review

## Verdict

**PASS.** Three findings, **all fixed and every fix re-driven by the reviewer** with each planted
file restored md5-identical. One operator decision that had been encoded without being asked was
surfaced and answered (`D-259-06`).

⭐ **All three success criteria hold, and the red line was not crossed.** Measured independently at
base and at HEAD: **7 phase-type executors, 1 emitter, 29 tools — unchanged**. `PACK-01`'s
*"nothing executes it"* is true as a fact about the code, not merely as a claim in a test.

⚠ **What the review caught was a guard that could not fire and an arm that disagreed with its
siblings** — the same two shapes as Phase 258, which is itself the finding worth carrying forward.

## Baselines

⚠ **The fresh pre-259 baseline was NOT run when it should have been** — the reviewer said it would
capture one during discuss-phase and did not. **Recovered rather than assumed:** a path-filtered
diff proved **zero source files changed** between `a9bf8ef07` (where the 258 fixes were measured)
and 259's first commit, so the 258 figures remained a valid pre-259 baseline. **Recorded because
the recovery worked only by luck** — had any source commit landed in that window, the baseline
would have been unrecoverable without a worktree checkout of the base.

| gate | pre-259 (`a9bf8ef07`) | after 3 plans (`85a809ee5`) | after fixes (`8ef3b108f`) |
|---|---|---|---|
| backend pytest | **71 failed / 5133 passed** | 71 / **5161** | 71 / **5162** |
| vitest count gate | 8468 · failed 0 · 293/293 | not re-run — zero frontend files in the diff | same |

⭐ **The failure SET was diffed, never the count** — zero new, zero gone at both stages.

⚠ **A normalisation artifact nearly produced a false finding.** A `RuntimeWarning` about
`write_audit_entry` was appended mid-line to one `FAILED` entry, making the same test appear as
both *new* and *disappeared*. Two normalisation attempts were wrong before a third was right; the
warning was then measured as present **4 times in both runs**, so it is pre-existing and unrelated
to this phase. **A set diff is only as trustworthy as its normalisation.**

## Findings

| id | severity | finding | status |
|---|---|---|---|
| F-1 | **MEDIUM-HIGH** | The three member arms enforce three different rules; the folder arm admitted another user's private folder | **FIXED** (`8ef3b108f`) |
| F-2 | MEDIUM | The closed-core fence could not see inventory growth that was not *named* "expert" | **FIXED** (`8ef3b108f`) |
| F-3 | LOW | The `0 / 0 / 0` ledger rows returned, one phase after being fixed | **FIXED** (`8ef3b108f`) |

### F-1 — three arms, three rules

`resolve_expert_bundle` evaluates three member kinds, and they did not agree:

| arm | rule applied |
|---|---|
| skills | `is_system` OR (org **AND** enabled **AND** (`user_id == caller` OR `is_org_shared`)) |
| folders | `org_id == caller_org_id` — **and nothing else** |
| connections | org-scoped query — safe |

**Driven** with a scratch harness against the real resolver: a cross-org folder was correctly
stripped, but **another user's private, unshared folder in the same org was admitted.**
`public.folders` carries `user_id NOT NULL` **and** `is_org_shared`, and the skill arm honours
both — so the concept existed and one arm ignored it. `resolve_expert_bundle` runs on an asyncpg
pool (service role), so **RLS does not save it.**

⚠ **Stated precisely, because precision was the point:** `SC#2` is worded cross-**org**, and
cross-org held throughout. This was **adjacent to SC#2, not a failure of it**, and **latent rather
than live** — nothing consumes `effective_folder_ids` yet. Phase 260 will, which is exactly why
fixing it here was cheap.

**Verified fixed — and verified not over-corrected.** The first probe fed folder rows carrying no
`user_id` or `is_org_shared` at all, so *"both stripped"* was equally consistent with a fix that
strips **everything**. ⭐ **A second probe with positive controls settled it: 4 of 4** — the
caller's own private folder admitted, another user's org-shared folder admitted, another user's
private folder stripped, cross-org folder stripped. **A negative-only probe cannot tell a fix from
a lockout.**

### F-2 — a fence that measured nothing for two of three registries

`SC#1` requires the executor / emitter / dispatcher inventory *"measurably unchanged from the
phase's own base commit."* `PHASE_TYPE_REGISTRY_ENTRIES` was properly count-pinned at `== 7`.
`EMITTER_REGISTRY` and `_TOOL_REGISTRY` were only substring-checked for `"expert"`.

**Driven:** an emitter planted as **`bundle_emit`** — doubling that registry from 1 to 2 — **passed
all five fence tests.** The phase's own `DISCUSSION-LOG` claimed the fence asserted closed
registries across all three modules, which **overstated what was built**.

⭐ **The underlying fact held the whole time.** Base-vs-HEAD measurement: phase types 7, emitters 1,
tools 29 — identical. **It was the guard that was partial, never the claim.** That distinction is
why this is MEDIUM and not a red-line breach.

**Verified fixed:** all three registries now carry count pins (`7` / `1` / `29`), and **both** the
planted emitter and a planted tool now turn the fence RED.

⚠ **One plant failed before it succeeded, and the failure is recorded rather than hidden:** the
first tool plant inserted into what was assumed to be a dict literal and produced a `SyntaxError`,
so it **tested nothing**. The file was restored md5-identical and the plant redone as an append
that cannot break syntax. **A plant that errors is not a passing fence.**

### F-3 — `0 / 0 / 0` returned one phase after being fixed

All four new files carried `0 / 0 / 0` in **both** registers — the identical finding closed as
`F-6` in Phase 258, recurring immediately. Measured: `1 / 1 / 175`, `1 / 1 / 265`, `1 / 1 / 268`,
`1 / 1 / 52`; `main.py` also read `952` lines against a measured `951`.

⭐ **Verified fixed, and this time the lesson landed:** `expert_service.py` reads **`2 / 1 / 274`**,
correctly counting **its own fix commit**. That is the first time across three phases the triple
was written as a *measurement taken after the commit* rather than a prediction made inside it.

## Operator decision surfaced at review

**`D-259-06` — install vs author. Answered 2026-09-20: read-only reference.**

⚠ **The ROADMAP required this to be evaluated in discuss-phase** (*"Decision #5 must be pulled
forward into this phase's discuss if it would change the bundle row"*), and it appears **nowhere**
in the discussion log — neither asked nor deferred. **Migration 187 had already answered it
implicitly**: `is_system` + `org_id` is a reference model with no install or copy path.

The operator confirmed that shape deliberately, so **no schema change is owed**. ⚠ If
customisation is ever wanted it is an **additive** migration (a copy mechanism plus a provenance
column), **not a rewrite** — recorded so a future phase does not treat it as blocked.

⭐ **This is the `SEED-294` failure mode one subsystem over:** a decision gets made by whoever
writes the schema first, unless someone names the moment. The moment was named at review rather
than at discuss, which is later than it should have been but not too late.

## What was solid

- **The red line held, measured rather than asserted** — 7 / 1 / 29 identical at base and HEAD.
- **The entitlement gate is ROUTER-LEVEL**, covering all six routes from
  `APIRouter(dependencies=[Depends(require_capability("experts"))])`. ⭐ **Structurally immune to
  Phase 258's `F-2`**, where per-route gating left the run path open. This is the better pattern and
  should be the default for any future gated router.
- **`SC#3` is satisfied by calling the Phase 258 check, not by a second one** — the `TIER-04` fence
  stays green, which is precisely the outcome that fence was built to produce.
- **Migration 187 carries NO `anon` grant** — only `authenticated, service_role`. ⭐ Phase 258's
  `anon` finding **transferred to the next migration without being restated**, which is the first
  time a security lesson in this project has propagated on its own.
- **The member-isolation fence is real** — a planted *"the bundle passed, so trust every member"*
  bypass turns `test_resolve_strips_foreign_skill_seed_125` RED.

## Guardrails

- **G-5** — `backend/app/main.py` fires (83 / 60 / 951); honoured by construction (one router
  import plus one `include_router`). Row re-derived at close.
- **G-8** — 3 plans, inside the 3-5 target.
- **Ledger rows added AT CREATION** for all four new files, and **correct after the fix round**.
- **Migration numbering** — 187, after the reviewer flagged pre-execute that the ROADMAP's stated
  "Migration 185" was already taken. ⚠ **Second consecutive phase whose ROADMAP entry named an
  occupied migration number**; the ROADMAP's forward-looking numbers are written once at milestone
  open and are stale by construction.
