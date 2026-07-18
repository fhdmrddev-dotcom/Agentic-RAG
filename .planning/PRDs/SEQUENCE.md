# PRD Sequence & Version Map — AUTHORITATIVE

**Updated:** 2026-06-21 (v3.0 Document Management SHIPPED; **Skill Studio split into v3.1 + v3.2**, GTM track shifts down one — see "What changed on 2026-06-21").

This table is the **single source of truth** for which version slot each capability ships in.
Version numbers track the **shipped train**; the PRD files are **capability briefs**.
If the sequence changes again, update **this table** and `.planning/ROADMAP.md` — not the (stale) version numbers buried inside each PRD body.

## Current map

| Slot | Capability | Brief | Status |
|------|-----------|-------|--------|
| v2.6 | Foundation (RAG quality + multi-worker + polish) | `PRDs/v2.6.md` | ✅ shipped 2026-05-27 |
| v2.7 | Agent Workspace & Panel | `PRDs/v2.7.md` | ✅ shipped 2026-05-30 *(ad-hoc — not in the original program)* |
| v2.8 | Harness Engine & Workflow Mode | — | ✅ shipped 2026-06-07 *(ad-hoc)* |
| v2.9 | Workflow Studio | — | ✅ shipped 2026-06-15 *(ad-hoc)* |
| **v3.0** | **Document Management** — SEED-005 Tier A (metadata-driven views / virtual folders, document relationships, auto-classification) + metadata enrichment | `milestones/v3.0-ROADMAP.md` + `milestones/v3.0-REQUIREMENTS.md` | ✅ **shipped 2026-06-21** |
| **v3.1** | **Workflow & Skill Studio — Trust, Clarity & Triggers** — workflow↔skill collision fix + cross-provider trust/honesty + Skill **Trigger Tuner** + Workflow Studio UX (soul card + strict↔loose) + bounded human-in-loop self-improve (STRETCH) | `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` (decided scope) · `PRDs/v3.1-skill-studio-eval.md` (eval spine, mostly → v3.2) | 📋 **next** |
| v3.2 | **Skill Eval Studio (full) + Self-Improving** — `skill_versions` + eval harness (`eval_cases/runs/run_outputs/feedback`) + grader/comparator/analyzer + review viewer + skill publish gate + full instruction-body self-improvement | `PRDs/v3.1-skill-studio-eval.md` (the eval+versioning spine) | 📋 planned |
| v3.3 | Operator UX (admin shell + secrets + presets) | `PRDs/v3.2-operator-ux.md` *(brief filename keeps old number)* | 📋 planned |
| v3.4 | **Multi-Tenancy & Org Access** (orgs/dept/roles + membership RLS rewrite + SAML SSO + org-admin) | `PRDs/v3.3-multi-tenancy.md` (STALE — re-authored live → `.planning/research/SUMMARY.md` + `.planning/ROADMAP.md`) | 🚧 **started 2026-07-18** (14 phases 160-173; research-first) |
| v3.5 | Open Platform (REST API + MCP + service accounts) | `PRDs/v3.4-open-platform.md` | 📋 planned |
| v3.6 | Automations & Routines (+ DM Tier B) | `PRDs/v3.5-automations.md` | 📋 planned |

## What changed on 2026-06-15

The original PRD program (authored 2026-05-10) was: **v3.0 Skill Studio → v3.1 Operator UX → v3.2 Multi-tenancy → v3.3 Open Platform → v3.4 Automations**.

Then the project pivoted — **v2.7 Workspace Panel, v2.8 Harness Engine, v2.9 Workflow Studio** shipped instead (a workflow/authoring track never in that program). That left **Skill Studio largely superseded**: multi-agent orchestration shipped in v2.8; the output-quality judge, NL authoring, and skill versioning/immutability shipped in v2.9.

Decision (operator-confirmed — "deepen the product"):
1. **Document Management (SEED-005 Tier A) takes v3.0** — ready-now on a verified foundation, zero dependency on the rest, compounds the v2.9 cited-deliverable engine.
2. **Skill Studio defers + re-scopes** → a **Workflow + Skill Eval Studio** (eval/regression over the Phase 102 judge + golden-run), re-slotted to **v3.1**.
3. **Everything else shifts down one slot**, themes unchanged (Operator UX v3.2, Multi-tenancy v3.3, Open Platform v3.4, Automations v3.5).

**Re-sequence trigger:** v3.1 (Skill Studio) is next-up *unless a paying customer appears*, in which case the GTM track — Operator UX (v3.2) then Multi-tenancy (v3.3) — jumps the queue. Multi-tenancy is the one-way decision (D-PRD-02) whose RLS-rewrite cost grows with every feature milestone, so it should not slip more than ~2 milestones out.

## What changed on 2026-06-21

v3.0 Document Management **shipped** (11 phases, tag `v3.0`, merged to `master`). Two adversarially-verified research workflows + a live DB forensic (`.planning/research/v3.1-skills-eval/`) showed the originally-single "Workflow + Skill Eval Studio" is **~2-3 milestones of work**. Operator decision (2026-06-21, "Option A"):

1. **Split Skill Studio into v3.1 + v3.2.** **v3.1 = "Trust, Clarity & Triggers"** — the user-facing, fast-value half: the root-caused workflow↔skill file collision (Mechanism A, sandbox-harvest re-emit — proven live), cross-provider reliability/honesty (force→coerce retry ladder + task-label parity), the Skill **Trigger Tuner**, the Workflow Studio UX "soul + strict↔loose" re-skin, and a bounded human-in-loop self-improve proposer (STRETCH). **v3.2 = "Skill Eval Studio (full) + Self-Improving"** — the net-new eval+versioning backend (`skill_versions`, the eval harness, grader/comparator/analyzer, review viewer, publish gate; **not yet built** — 0 hits in `full-schema.sql`).
2. **The GTM track shifts down one slot:** Operator UX → v3.3, Multi-tenancy → v3.4, Open Platform → v3.5, Automations → v3.6. **Brief filenames keep their old numbers** (`v3.2-operator-ux.md` is now the v3.3 slot, etc.) per the "slots track the train, briefs are capability docs" rule.
3. ⚠ **One-way-door tension to watch:** Multi-tenancy (D-PRD-02, the RLS rewrite whose cost grows every milestone) now sits at **v3.4 — 3 slots out, exceeding the "~2 milestones" guidance** from the 2026-06-15 trigger. The escape valve still applies: **if a paying customer appears, the GTM track (Operator UX → Multi-tenancy) jumps the queue ahead of the v3.2 Eval Studio.** Re-evaluate at v3.1 close.

Decided-scope source of truth for v3.1: `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`.

## What changed on 2026-07-18

**v3.3 Operator UX shipped** (tag `v3.3`, 14 phases 146-159, deployed to production) and **v3.4 Multi-Tenancy & Org Access kicked off** via `/gsd:new-milestone` (research-first). Notes:

1. **v3.4 slot confirmed = Multi-Tenancy** (the one-way RLS door — no longer slippable; the GTM escape-valve is moot now that Operator UX has shipped). Scope re-authored against the LIVE schema (head 103): the stale 2026-05-10 brief's "18 tables / migration range 075-094" is obsolete — reality is 38 user-facing tables, 4 SECDEF retrieval functions, Supabase-native SAML, migrations from slot 104. Roadmap = 9 CORE (160-168) + 5 STRETCH (169-173).
2. **Naming-collision resolved:** SEED-117 planted itself as "v3.4 config-consolidation," but this authoritative map (v3.4 = Multi-tenancy) wins. The **tenancy-adjacent** governance/identity projection (profile menu, role/group greenlists, per-user preference layer) folded INTO v3.4; the **pure config-retrofit** (SEED-117 §1/§3 — retrofit every remaining knob into Control Room tabs, prompt governance, cost/budget caps, scheduler) is **deferred to a post-v3.4 config pass — slot TBD** (fold into v3.5 Open Platform as a sub-track, or take its own slot; decide at that milestone's kickoff). The scheduler half is really v3.6 Automations (SEED-014); cost-caps need telemetry (SEED-023).
3. **Deployment flexibility ratified as a binding v3.4 contract** (Phase-160 ADR SC#4): solo-local / small-VPS / medium-SaaS / enterprise-on-prem all stay a pure env-var switch; the org substrate stays forward-compatible with per-org provider config / BYO keys (SEED-120).

## Caveats for the deferred briefs (v3.1–v3.5)

All five `v3.x-*.md` briefs were authored 2026-05-10 and predate the v2.7–2.9 surface. Their **business-shape decisions (D-PRD-01..15) still hold**, but their **internal version numbers, migration ranges (`MIGRATION-RESERVATIONS.md` — now stale), phase counts, and prereq assumptions are obsolete** (they assumed Skill Studio shipped first and the migration head was ~038; it is past 070). Each will be **re-authored against the live codebase** when its milestone is started via `/gsd:new-milestone`. Do not consume any `v3.x-*.md` as-is.
