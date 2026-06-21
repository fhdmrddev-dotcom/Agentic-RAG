# PRD Sequence & Version Map — AUTHORITATIVE

**Updated:** 2026-06-15 (operator confirmed **v3.0 = Document Management**).

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
| **v3.0** | **Document Management** — SEED-005 Tier A (metadata-driven views / virtual folders, document relationships, auto-classification) + metadata enrichment | this milestone → `REQUIREMENTS.md` + `ROADMAP.md` | 🔨 **ACTIVE** |
| v3.1 | Workflow + Skill Eval Studio *(re-scoped Skill Studio)* | `PRDs/v3.1-skill-studio-eval.md` | 📋 planned — next |
| v3.2 | Operator UX (admin shell + secrets + presets) | `PRDs/v3.2-operator-ux.md` | 📋 planned |
| v3.3 | Multi-tenancy (orgs/SSO + RLS rewrite) | `PRDs/v3.3-multi-tenancy.md` | 📋 planned |
| v3.4 | Open Platform (REST API + MCP + service accounts) | `PRDs/v3.4-open-platform.md` | 📋 planned |
| v3.5 | Automations & Routines (+ DM Tier B) | `PRDs/v3.5-automations.md` | 📋 planned |

## What changed on 2026-06-15

The original PRD program (authored 2026-05-10) was: **v3.0 Skill Studio → v3.1 Operator UX → v3.2 Multi-tenancy → v3.3 Open Platform → v3.4 Automations**.

Then the project pivoted — **v2.7 Workspace Panel, v2.8 Harness Engine, v2.9 Workflow Studio** shipped instead (a workflow/authoring track never in that program). That left **Skill Studio largely superseded**: multi-agent orchestration shipped in v2.8; the output-quality judge, NL authoring, and skill versioning/immutability shipped in v2.9.

Decision (operator-confirmed — "deepen the product"):
1. **Document Management (SEED-005 Tier A) takes v3.0** — ready-now on a verified foundation, zero dependency on the rest, compounds the v2.9 cited-deliverable engine.
2. **Skill Studio defers + re-scopes** → a **Workflow + Skill Eval Studio** (eval/regression over the Phase 102 judge + golden-run), re-slotted to **v3.1**.
3. **Everything else shifts down one slot**, themes unchanged (Operator UX v3.2, Multi-tenancy v3.3, Open Platform v3.4, Automations v3.5).

**Re-sequence trigger:** v3.1 (Skill Studio) is next-up *unless a paying customer appears*, in which case the GTM track — Operator UX (v3.2) then Multi-tenancy (v3.3) — jumps the queue. Multi-tenancy is the one-way decision (D-PRD-02) whose RLS-rewrite cost grows with every feature milestone, so it should not slip more than ~2 milestones out.

## Caveats for the deferred briefs (v3.1–v3.5)

All five `v3.x-*.md` briefs were authored 2026-05-10 and predate the v2.7–2.9 surface. Their **business-shape decisions (D-PRD-01..15) still hold**, but their **internal version numbers, migration ranges (`MIGRATION-RESERVATIONS.md` — now stale), phase counts, and prereq assumptions are obsolete** (they assumed Skill Studio shipped first and the migration head was ~038; it is past 070). Each will be **re-authored against the live codebase** when its milestone is started via `/gsd:new-milestone`. Do not consume any `v3.x-*.md` as-is.
