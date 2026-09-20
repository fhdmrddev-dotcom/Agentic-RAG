---
seed_id: SEED-303
title: An Expert must ADD scope and capability, not replace them — binding is not usage, and four axes each need their own semantic
created: 2026-09-20
surface: Agentic-RAG
status: partially-answered
partial: true
status_note: Two arms RATIFIED by the operator 2026-09-20 as D-v4.3-01 (union-by-default knowledge) and D-v4.3-02 (additive tool floor); the fixes are owed in Phase 261. The remaining arms - S3 (two Experts), S8 (clone-on-customise) and per-Expert spend attribution - are still open.
trigger_when: Any phase that authors, lists, invites, scopes or prices an Expert — 261 and 262 both fire on it. Also fires on any phase that changes EXPERT_CORE_TOOLS, the thread scoping resolver, or the folder subtree override in the agent loop.
trigger_paths: ["backend/app/models/expert.py", "backend/app/services/expert_service.py", "backend/app/db/experts.py", "backend/app/api/experts.py", "backend/app/services/run_producer.py", "**/agent_loop.py", "**/tool_dispatcher.py", "frontend/src/components/chat/InviteExpertDialog.tsx", "frontend/src/components/chat/ActiveExpertChip.tsx", "frontend/src/components/chat/ExpertSpotlightCard.tsx", "frontend/src/lib/api/experts.ts"]
trigger_surfaces: [backend, frontend, chat]
migration_note:
relates_to: [BUG-260920-01, D-v4.3-01, D-v4.3-02, BUS-291, SEED-291, SEED-294, "259", "260", "261", "262"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-303: An Expert adds scope, it does not replace it

## The finding

An Expert declares **four** things, and Phase 260 gave all four the same semantic —
**replacement** — when only one of them wants it.

| Axis | Field today | Semantic shipped | Semantic it wants |
|---|---|---|---|
| Knowledge | `knowledge_folder_ids` | replaces the thread's folder | **union by default**, replace only when declared |
| Skills | `member_skills` | override catalog | additive — a skill is *method*, never a fence |
| Tools | derived `EXPERT_CORE_TOOLS` (10) | **subtracts 21 of 31** | additive floor, never a ceiling |
| Connections | `required_connections` | added | added, **plus a precondition check** |
| Who may use | `visibility` (+ 261 grants) | — | orthogonal to all of the above |

The operator named the knowledge axis before it was measured: an Expert bound to folder A,
invited into a thread scoped to folder B, is a contradiction — *"we need a clear separation
between the usage and the binding to a knowledge base."* Measured consequences are in
`BUG-260920-01`: the override at `agent_loop.py:1377` changes retrieval and **not** the
`scoped_folder_path` the prompt injects at `:1405`, and `scope_mode` — the one field that could
declare the intent — is read by nothing.

**The separation that resolves it:** the thread's folder is **where the user is**; the Expert's
folders are **what the Expert brings**. Those are different roles, not competing scopes, so the
default composition is union. `restricted` stays available because for some Experts the
restriction *is* the product (see S5) — but it is then stated at invite time, never discovered
mid-answer.

## Why it matters

Eight scenarios, each of which breaks or is unreachable under replacement semantics. S4 and S6
are the two that cost money.

- **S1 — onboarding (highest volume).** A new employee does not know the folder tree or what the
  system can do. Picking an Expert and clicking a prompt tile is the whole time-to-value story
  (PACK-03 / PACK-13). *Implication for 262: the catalog's most important entry point is the
  empty state of a new thread, not a nav item — that is where a new user actually is.*
- **S2 — mid-thread pivot.** Finance thread, then a legal question. Swapping the Expert silently
  changes what retrieval can see for the rest of the thread. *A swap must appear in the
  transcript as an event with its consequence named, in the run-honesty pattern this project
  already uses — not only as a chip changing.*
- **S3 — two Experts at once.** "Review this contract for legal AND financial exposure" is a real
  ask, and 259's decision #4 suspected *no*. Two restricted Experts intersect to nothing.
  *Recommendation: keep ONE active Expert — the schema shape is right — and serve the need with
  "ask a second Expert", which opens a NEW thread carrying a handoff summary. No schema change.*
- **S4 — the Expert whose folder you do not have. THE OPERATOR'S CASE, AND THE MOST VALUABLE
  ONE.** An "Accounting Standards" Expert invited into `/Client ACME`. The value **is** the cross
  product: the Expert brings the standards, the thread has the client's documents. Under today's
  code the client documents silently vanish. *Union is not a compromise here — it is the feature.*
- **S5 — the restriction that IS the product.** An HR Advisor that provably cannot read
  engineering. `restricted` is correct, and it is a sellable claim because `PACK-04` already
  proves the boundary with a driven test. *UX: state the cost before the run — "HR Advisor reads
  HR Policies only; the 4 documents in this chat's folder will not be used."*
- **S6 — the Expert that produces a deliverable.** "RFP Responder": read the RFP, read our
  boilerplate, **write the response**. Needs `workspace_write` + `render_template` +
  `execute_code` — all three stripped today. *An Expert that cannot produce an artifact is a
  search box with a personality, and it is the clearest gap against every competitor in this
  class.*
- **S7 — the Expert with an unmet precondition.** `required_connections` names HubSpot; the org
  has not connected it. *The card must read "Requires HubSpot — not connected" and the invite
  must offer the connect flow. Failing at run time is `PACK-11`'s "brochure for a locked door"
  one axis over.*
- **S8 — vendor-authored vs tenant-customised.** The operator sells "Financial Analyst"; the
  client's admin needs it pointed at *their* folders. System Experts are read-only (`D-259-06`),
  so without **clone-on-customise** every client needs a vendor-authored row — which does not
  scale and kills the pack business. *The seed Expert stays canonical; the clone carries the
  tenant's folder ids. This is how every template marketplace works, and it is a 261 decision.*

## Competitive reading

Custom GPTs, Claude Projects and Copilot Studio agents all ship a persona over uploaded files,
per-user, with no tenant isolation, no per-user grants, no tier gating and no cost attribution.
Four of our five differentiators are **already built**: live knowledge (connector watches),
RLS plus a driven member-boundary check, grounding provenance, tier entitlement, per-run cost.

The claim worth saying out loud: **an Expert cannot see what its owner did not grant, and we
prove it with a test rather than a promise.** Nobody in the Custom-GPT class can say that.

The claim we currently cannot make: *it produces work.* Fix the tool axis and we are ahead on
governance without being behind on capability — which is the whole position.

Nearly-free adjacency: per-Expert **usage and spend attribution**. `threads.active_expert_id`
exists (migration 188) and Phases 256/257 persist tokens and dollars per run, so "which Experts
earn their keep" is a join, not a build — and it is what a renewal conversation runs on.

## When to surface

Any phase whose `files_modified` touches the Expert model, service, db layer, API, the thread
scoping resolver, the agent-loop folder override, `EXPERT_CORE_TOOLS`, or the chat invite /
chip / spotlight components. **261 and 262 both fire on it by construction.**

## Scope estimate

**Small for the mechanics, Medium for the decisions.** The knowledge axis and the prompt desync
are ~15 lines plus a fence (`BUG-260920-01`). The tool axis is a constant and a default, with a
decision attached. S3 / S8 / the attribution join are each a phase's worth, and belong to 261,
261 and a later metering phase respectively.

⛔ **None of this needs a new executor, emitter or branch in the loop.** Union, mode and the
tool floor are all resolved as **data handed to** the loop, exactly as `D-260-05` requires — so
`EXT-01` and `PACK-01` stay intact. A phase that implements this by adding `if expert:` inside
the loop has failed the contract, not satisfied this seed.

## Operator ratification — 2026-09-20

Two of this seed's arms are **settled**, recorded in `.planning/PROJECT.md` -> Key Decisions:

- **`D-v4.3-01`** - knowledge composes by **UNION with the thread's folder** by default
  (`scope_mode: biased`). `restricted` / *Strict Isolation* stays opt-in **and states its cost at
  invite time**. S4 is the reason; S5 is why the other mode survives.
- **`D-v4.3-02`** - tools are an **additive floor, never a ceiling**: `execute_code`,
  `workspace_write`, `render_template` and `ask_user` are kept. A restricted Expert narrows
  **knowledge**, not competence. S6 is the reason.

Both fixes are owed in **Phase 261**, and `BUG-260920-01` is folded into it.

STILL OPEN, and not ratified by the above: **S3** (two Experts at once -> one active, second as a
handoff thread), **S8** (clone-on-customise for system Experts, which the pack business needs),
and per-Expert usage / spend attribution.

## Breadcrumbs

- `BUG-260920-01` — the three measured defects, with line numbers, at `d87d208c2`
- `BUS-291` — the vocabulary collision handed to Gemini before the 261/262 sketch hardens:
  the sketch uses "Restricted" for the **grant** axis (`Restricted Grant`, `Restricted (HR Only)`)
  while `scope_mode` uses it for the **knowledge** axis. One word, two axes, in the surface that
  teaches users the model.
- Measured 2026-09-20: `_TOOL_REGISTRY` 31 entries (`tool_dispatcher.py:4544`),
  `EXPERT_CORE_TOOLS` 10 (`:4585`), `scope_mode` read by zero call sites.
- Phase 259 operator decisions #3 (restrict or bias) and #4 (two at once) are the two this seed
  answers with evidence rather than suspicion.
