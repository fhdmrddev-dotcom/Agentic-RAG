---
phase: 262-an-expert-you-can-discover
status: RECONSTRUCTED — not a SUMMARY
reconstructed: 2026-09-22
reconstructed_by: orchestrator, during the v4.3 record repair
requirements: [PACK-11, PACK-12, PACK-13]
verification: none — this phase never ran plan-phase, execute-phase or verify-work
independent_review: owed
---

# Phase 262 — An Expert You Can Discover · RECONSTRUCTED RECORD

⛔ **THIS IS NOT A SUMMARY AND MUST NOT BE READ AS ONE.** No PLAN.md was ever written for this
phase, no executor ran, no verifier ran. This file is a reconstruction assembled on 2026-09-22 from
git, the live schema and the shipped source, because the ROADMAP coverage table counts
**PACK-11/12/13** as covered by "Phase 262" and **that claim needed checking.**

---

## ⛔ Finding 1 — the commits tagged `(262)` are NOT this phase's work

`git log --grep="(262"` returns exactly three commits:

| Commit | Subject |
|---|---|
| `16b4d41d5` | `feat(262): route the gpt-5.6 family through /v1/responses so tools work natively` |
| `45adc0e3c` | `feat(262): a model's capabilities are DATA — adding one must never need a commit` |
| `5e91fc649` | `chore(262): apply migration 190 locally and regenerate the schema artifact` |

That is **model-capability routing** — `api_surface`, `provider_gateway/openai_responses.py`,
provider inference, migration 190's six capability columns, `ModelAdvancedCapabilities.tsx`.

**Phase 262's ROADMAP goal is a user-facing Expert catalog.** The two bodies of work share a number
and nothing else. ⭐ **The model-registry work is real, good and shipped** — `CLAUDE.md` already
documents it as *"A model's capabilities are DATA, not code (Phase 262 / migration 190)"*, and the
four-part `_SURFACE_ADAPTERS` contract is pinned by `test_262_capability_column_pin.py`. **What is
wrong is only the NUMBER it was filed under**, and therefore the coverage claim that rests on it.

⚠ **Consequence:** the v4.3 coverage table's line `| 262 | PACK-11, PACK-12, PACK-13 |` is backed by
commits that touch none of those requirements.

---

## What of Phase 262's ACTUAL scope is built

Measured on the live local DB and the shipped source, 2026-09-22.

**✅ The data layer EXISTS.** Migration **189** (`189_expert_presentation_and_grants.sql`) shipped the
presentation fields the ROADMAP said were missing. `expert_bundles` now carries:

```
id, org_id, created_by, name, slug, description, scope_mode, member_skills,
required_connections, knowledge_folder_ids, prompt_suggestions, visibility,
is_system, is_enabled, created_at, updated_at, icon, category, when_to_use,
example_output, tool_floor_enabled
```

⭐ `icon`, `category`, `when_to_use`, `example_output` are all present. The ROADMAP's *"no icon, no
category, no when-to-use, no example output"* gap is **closed at the schema level**, by 261's
migration rather than by a 262.

**✅ Authoring writes them.** `ExpertAuthoringStudio.tsx` reads and writes all four.

**✅ An admin can see them.** `OrgExpertsTab.tsx` renders them — mounted at
`OrgAdminShell.tsx:399`.

**🟡 A browse surface exists, but it is 260's.** `InviteExpertDialog.tsx` (Phase 260 / PACK-02)
lists Experts with name, description, and **counts** of knowledge folders and connections.

---

## ⛔ Finding 2 — the presentation fields are DEAD on the normal-user path

`grep` for `when_to_use|example_output|expert.category|expert.icon` across `frontend/src` returns
**six** files: `ExpertAuthoringStudio.tsx`, its test, `OrgExpertsTab.tsx`, its test,
`lib/api/experts.ts` and `types/index.ts`.

⛔ **`InviteExpertDialog.tsx` and `ExpertSpotlightCard.tsx` are NOT among them** — and those are the
only two Expert surfaces a normal user sees.

So the four columns are **authored by one role and rendered only to another.** Phase 262's goal
opens with *"A normal user — **not an admin** — browses the Experts available to them"*, and
`OrgExpertsTab` is behind `OrgAdminShell`.

Two consequences visible in the shipped code:

- **`InviteExpertDialog.tsx:26` `getExpertIcon()` hardcodes emoji by slug/name string-match**
  (`slug === "financial-analyzer" || name.toLowerCase().includes("financial")` → `📊`) **while an
  `icon` column sits unread in the row.**
- **`ExpertSpotlightCard.tsx` ships `DEFAULT_FINANCIAL_TILES`**, three hardcoded Financial-Analyzer
  prompts used as a fallback, and never reads `example_output`.

⭐ **This is the project's own recurring failure class, one register down:** a value can be pinned,
migrated and authored and still reach nobody. `CLAUDE.md` records it as *"presence assertions cannot
see content drift"*; here the content does not drift — **it is never rendered at all.**

---

## Requirement status — measured, not assumed

| Req | Criterion (ROADMAP) | Status |
|---|---|---|
| **PACK-11** | A normal user sees **every Expert they may use and none they may not** — tier entitlement AND per-user grants, driven against a user who can see the row but holds **no grant** | 🟡 **UNVERIFIED.** `InviteExpertDialog` browses; whether `listExperts` honours grants for a no-grant user **was never driven**. ⛔ The ROADMAP flags this as *"the honesty criterion and the one most likely to be faked."* |
| **PACK-12** | A detail view carrying what it does, when to use it, what knowledge it reads, which connections it needs, and example prompts — **rendered content asserted** | ⛔ **NOT MET on the user path.** `when_to_use` / `example_output` / `category` / `icon` render in **no** user-facing component. The dialog shows folder/connection **counts**, not what they are. |
| **PACK-13** | From the detail view, start a scoped conversation **in one action**, reusing 260's invite path | 🟡 **Arguably met by 260 itself** — `onSelectExpert` starts the scoped thread. But there is no detail view to start it *from*, so the criterion's subject does not exist. |

---

## What this record does NOT claim

- It does **not** claim the model-registry work is defective. It is verified by its own fences and is
  correctly described in `CLAUDE.md`. Only its phase NUMBER is wrong.
- It does **not** re-run any gate. No verification was performed for this phase and none is asserted.
- It does **not** decide what to do. Renumbering the shipped work, splitting PACK-11/12/13 into a new
  phase, or accepting the catalog as descoped are **operator decisions**.

## Open questions for the operator

1. **Do PACK-11/12/13 get a real phase**, or are they consciously descoped from v4.3 with a written
   reason? ⛔ The milestone cannot honestly report *"25/25 requirements"* while three of them are
   backed by unrelated commits.
2. **Should the model-registry work be renumbered** (e.g. to the next free phase number) so `(262)`
   stops meaning two things? The ROADMAP has already *"named an already-taken migration number twice
   running"*, by its own note — this is the same class of collision in the phase register.
3. **The sketch already exists** — `.planning/sketches/261-262-expert-authoring-and-catalog/` — so
   **G-2 is satisfied** if the catalog is built. That is the cheapest half already paid for.
