# Phase 177: v3.4 Org-Surface Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 177-v3-4-org-surface-polish
**Mode:** `--auto` (operator-delegated autonomous — operator set the primary lens to "family
cohesion" during the sketch intake, then delegated all downstream calls; Claude picked the
recommended option per area and logged them.)
**Areas discussed:** Scope & red lines, Org-identity cohesion (ORGUX-01), Management-surface
cohesion (ORGUX-02 in-app), Entry/failure honesty (ORGUX-02 pre-auth)

---

## Scope & Red Lines

| Option | Description | Selected |
|--------|-------------|----------|
| Cohesion/extraction refactor, behavior byte-identical | Extract shared primitives; no authz/wire/contract change; no migration/threat model | ✓ |
| Feature additions to org surfaces | New capabilities on the org surfaces | |
| Full re-architecture of the org shell | Rebuild the 166–168 surfaces | |

**Choice:** Polish/cohesion only — shipped structure + all authz + wire behavior held byte-identical.
**Notes:** G-2 already satisfied (sketches 131/132/133). G-5 light guard: StreamsProvider stream path
untouched, OrgContext stays outside it (067.5 Branch-D3). No SC#10 / no threat model / no migration —
consistent with the ROADMAP 177 flags. 166/167/168 live-UAT status-lag rolls forward as `human_needed`.

---

## Org-Identity Cohesion (ORGUX-01 — sketch 131-C)

| Option | Description | Selected |
|--------|-------------|----------|
| One org-identity primitive + per-org role honesty (131-C) | Shared avatar·name·role-badge reused in anchor/menu/band/rows; role follows active org | ✓ |
| Unified primitive, no per-org role (131-B) | Cohesion only; role stays a single toggle | |
| Faithful as-shipped (131-A) | Leave surfaces as built | |

**Choice:** 131-C. **Notes:** 131-C is the only variant that satisfies ORGUX-01's literal "honest
across states." Honest-absent (shield/menu-entry vanish for a member) + solo-calm switcher preserved.
Amber stays operator-only. D-05 flagged to verify at plan whether OrgProvider already re-derives role
on switch (likely yes → collapses to a display-consistency audit).

---

## Management-Surface Cohesion (ORGUX-02 in-app — sketch 133-B)

| Option | Description | Selected |
|--------|-------------|----------|
| One management language (133-B) | Shared StatusChip + one row anatomy + one 4px grid across dialog/invitations/SSO | ✓ |
| + admin-vs-member split view (133-C) | B plus a side-by-side honest-absent demo | |
| Faithful as-shipped (133-A) | Keep SsoTab's off-grid UPPERCASE chip fork | |

**Choice:** 133-B. **Notes:** Retire SsoTab's documented off-grid/UPPERCASE fork + the duplicated
chip maps. Preserve honest-absent, link-first, victim-naming. 133-C's split is B's read-only behavior
demonstrated — folded into B, not shipped as a split view.

---

## Entry / Failure Honesty (ORGUX-02 pre-auth — sketch 132-B)

| Option | Description | Selected |
|--------|-------------|----------|
| Unified card + one honest-notice (132-B) | One card shell + one severity-keyed notice; recoverable dead-ends read calm | ✓ |
| Sign-in depth on fail-open (132-C) | Focused fail-open detail | |
| Faithful as-shipped (132-A) | Per-failure ad-hoc copy | |

**Choice:** 132-B. **Notes:** Recolor recoverable invite dead-ends (expired/revoked/missing) to CALM,
weight only for genuine errors. Fail-open kept legible + reassuring (never a lockout, T-168-07/SC#3).
C's fail-open depth folds into B as the sign-in behavior.

---

## Claude's Discretion

- Exact extraction boundaries + naming for the shared chip / notice / identity primitives (follow
  shipped `cn()` + shadcn + lucide patterns).
- Resolving D-05 (per-org role already-correct vs light-wiring) at plan via an OrgProvider read.

## Deferred Ideas

- Broader chat/nav polish, provider logos, citation footer, run-state todos, workspace panel → STRETCH 178.
- Dept/role folder sharing + permission-aware citations → v3.4 STRETCH 169–173 carry-forwards.
- Any authz change → a new authz phase with its own threat model.

## Reported-Bugs Cross-Check

Swept `surface: Agentic-RAG` open/deferred reports — **zero overlap** with the org-surface domain
(all are chat/agent-loop/panel, owned by 174/176/178/180). Nothing folded into 177.
