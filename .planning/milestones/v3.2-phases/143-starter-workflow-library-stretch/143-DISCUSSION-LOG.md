# Phase 143: Starter Workflow Library (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 143-starter-workflow-library-stretch
**Areas discussed:** Fork-a-starter semantics, Starter vs harness templates, Which starters ship + content, Shelf placement + bug fold

---

## Fork-a-starter semantics (D-143-1)

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh personal copy | Fork = new workflow you own: new slug, v1, created_by=you, is_global=false. No cross-user collision. Dedicated fork path. | ✓ |
| Same-slug Tweak→v(N+1) | Reuse existing Tweak verbatim (SEED-084's assumption). Two users forking the same starter both make v2 → 2nd INSERT hits UNIQUE(slug,version). | |

**User's choice:** Fresh personal copy.
**Notes:** Confirmed `UNIQUE(slug, version)` is global across all users (mig 056) — the same-slug Tweak genuinely collides on multi-user forks; SEED-084's "reuse Tweak verbatim" assumption is corrected. Fork UX: auto-suffix slug + open in Builder (D-143-1a), same landing as Tweak.

---

## Starter vs harness templates — curation (D-143-2)

| Option | Description | Selected |
|--------|-------------|----------|
| Curated marker, hide scaffolds | Tag starters with `definition.category='starter'`; render only those. The 5 dev is_global scaffolds stay hidden. JSONB-path filter (project_folder_id precedent). | ✓ |
| Render all is_global | Simplest, but surfaces dev/harness scaffolds (Plan→Execute→Verify etc.) to users. | |
| Retire the 5 scaffolds | Flip scaffolds to is_global=false/delete. More invasive; they may still be used by harness tests. | |

**User's choice:** Curated marker, hide scaffolds.
**Notes:** Consequence captured (D-143-2a): Published shelf should narrow to `created_by=me` so scaffolds vanish and starters don't double-render.

---

## Which starters ship + content (D-143-3)

| Option | Description | Selected |
|--------|-------------|----------|
| 3 starters: promote 2 + 1 fresh | Promote Risk Register (pm-risk-register) + Weekly Status Report (pm-weekly-status-report); author 1 fresh Compliance Gap Report per SEED-084. | ✓ |
| 2 starters: promote existing only | Ship just the two proven ones; grow later. | |
| 4+ starters | Promote 2 + author 2–3 fresh. Richer, more authoring/validation. | |

**User's choice:** 3 starters (promote 2 + 1 fresh).
**Notes:** All 3 are KB→document (no template upload needed — D-143-3a). "Promote" = copy definition JSONB into a system-owned seed row, not flip the user's rows (D-143-3b). Validation: trusted authored seed + manual run check, gauntlet bypassed by construction (D-143-4a).

---

## Shelf placement + bug fold (D-143-5)

| Option | Description | Selected |
|--------|-------------|----------|
| Starters top + fold BUG-260628-01 | Starters shelf on top; fix the drafts-bury-published sort. | ✓ |
| Starters between Drafts & Published, defer bug | Middle section; leave sort as-is. | |
| Starters at bottom, defer bug | Below Published; no sort change. | |

**User's choice:** Starters top + fold the sort bug.
**Notes:** BUG-260628-01 folded into Phase 143 (frontmatter updated: status=folded, folded_into=143).

---

## Claude's Discretion

- Exact slug-suffix scheme + forked-starter Builder header caption.
- Whether starters use a new endpoint, a query param, or a client-side split (subject to the D-143-2a end state: Published = my own; Starters = curated global).
- The Compliance Gap Report starter's exact phase composition (on existing primitives).
- Validation approach (D-143-4a): trusted seed + manual UAT run, no gauntlet wiring.

## Deferred Ideas

- **Run-time template/file upload → SEED-110** (elevated to v3.3 phase candidate; overlaps Phase 144 but distinct). Does not block 143. User raised it: "some workflows we need to upload maybe template… did not find any place." Claude's recommendation (accepted): keep 143 tight, make this a real v3.3 phase candidate rather than a rotting seed.
- **Workflow delete + cascade → SEED-111** (lifecycle hygiene; small standalone phase later). User raised: "no delete functionality in the workflows that also cascade deletion."
- **Competitor-gallery research (D-143-6)** — folded INTO 143's phase-researcher as a directive (n8n, Activepieces, Zapier, Gumloop, Glean, beam.ai). User's framing: study how others do it "to strengthen ours, not replace it."
- **Forked-from-starter provenance** — nice-to-have, deferred.
- **Growing the library past 3** — future content pass.
- **BUG-260610-01** (workflow run nav timer/duplicate avatar) — reviewed, left open (run surface, not the library).
- **NL-describe-first birth path** — unchanged; the shelf is the intended second birth path (no scope change).
