# Phase 262: An Expert You Can Discover — Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Source:** ROADMAP `#### Phase 262` + sketch `261-262-expert-authoring-and-catalog` (G-2 SATISFIED) + operator ruling on `BUS-303` + orchestrator measurement
**Requirements:** PACK-11, PACK-12, PACK-13

<domain>
## Phase Boundary

⛔ **READ `262-RECORD.md` FIRST.** This phase was believed shipped and was not. The three commits
tagged `(262)` in git deliver **model-capability routing and migration 190** — real, verified work
that shares nothing with an Expert catalog but the number. The coverage table credited
`PACK-11/12/13` to those commits. **This phase is the actual build.**

A normal user — **not an admin** — browses the Experts available to them, opens a card into a detail
view that answers *what does this do* and *when should I use it*, and starts a scoped conversation
in one action.

**IN scope**
- A **4th top-level nav home** `✨ Experts`, plus a `Browse Expert Catalog…` entry in the composer
  `+` menu (operator ruling, `BUS-303`).
- A catalog of Expert cards: search, category filter, the 5-element card anatomy from the sketch.
- A **detail modal** rendering `when_to_use`, `example_output`, `category`, `icon`, the **named**
  knowledge folders, the **named** connections and skills, and the prompt suggestions.
- **One-action start** from the detail modal, reusing Phase 260's invite path.
- **Driving** PACK-11's honesty criterion against a real no-grant user.
- Retiring the two hardcoded artefacts named in `262-RECORD.md`.

**OUT of scope**
- ⛔ **Clone & Customise** (`SEED-303 S8`). The sketch describes it; the ROADMAP's three success
  criteria do not require it. It is a WRITE on a read surface and belongs in its own phase.
- ⛔ **A per-Expert URL.** This app has **no router** (`SEED-185`); the ROADMAP says the URL "stays
  owed and belongs to the routing phase, not here."
- ⛔ **Any change to what an Expert DOES.** `PACK-01`'s *"an Expert is a manifest, not a runtime"*
  must not start leaking through the catalog.
- ⛔ **Upsell.** See D-262-02.
- ⛔ **Renumbering the misfiled `(262)` model-registry commits.** Not ruled on; stays open.

</domain>

<measured_state>
## Measured 2026-09-22 — re-derive, do not trust

| Fact | Where | Measured |
|---|---|---|
| **PACK-11's backend EXISTS** | `api/experts.py:386` `list_experts` | With `for_management=False` (the default) it passes `caller_user_id` + `caller_roles` to `list_experts_service`, which filters by visibility **and grants**. ⭐ **So PACK-11 is UNVERIFIED, not unbuilt** — it owes a driven no-grant user, not a rewrite. |
| Grants API | `api/experts.py:551/566/589` | `GET`/`POST`/`DELETE /{id}/grants` all exist (Phase 261). |
| Presentation columns | migration **189**, live schema | `icon`, `category`, `when_to_use`, `example_output`, `tool_floor_enabled` all present on `expert_bundles`. |
| ⛔ **They render NOWHERE a user sees** | grep `frontend/src` | Only `ExpertAuthoringStudio.tsx`, `OrgExpertsTab.tsx` (**admin-only**, mounted `OrgAdminShell.tsx:399`), `lib/api/experts.ts`, `types/index.ts`. **This is PACK-12's whole gap.** |
| Artefact 1 | `InviteExpertDialog.tsx:26` | `getExpertIcon()` **hardcodes emoji by slug/name string-match** (`slug === "financial-analyzer"` → `📊`) while the `icon` column sits unread. |
| Artefact 2 | `ExpertSpotlightCard.tsx` | Ships `DEFAULT_FINANCIAL_TILES` — three hardcoded Financial-Analyzer prompts as a fallback — and never reads `example_output`. |
| Existing browse surface | `InviteExpertDialog.tsx` (260 / PACK-02, 217 L) | Lists name + description + **counts** of folders/connections. Not names. No detail view. |
| `ActiveView` union | `App.tsx:107` | **Twelve** members today. |
| `ChatLayout` render chain | `:853-979` | A long `? :` ladder ending in a **trailing positional `KnowledgeHealthPage` else**. |
| Existing fallback fence | `ChatLayout.fallback.test.tsx` | Already guards this ladder. |
| Composer `+` menu | `MessageInput.tsx:591-601` | Already hosts `Invite Expert...` → `setInviteExpertOpen(true)`. The new entry sits beside it. |
| Nav | `lib/nav-items.ts` `NAV_ITEMS` | Carries an optional `feature?: GovernedFeature` key — an entry renders ONLY if the caller's effective map resolves it true (**the VANISH**, never a locked placeholder). |

</measured_state>

<decisions>
## Implementation Decisions (locked)

### D-262-01 — A 4th nav home, and the three-homes contract changes ON THE RECORD
**Operator ruling, `BUS-303`.** Add `{ view: "experts", icon: Sparkles, label: "Experts" }` to
`NAV_ITEMS`, **plus** `Browse Expert Catalog…` in the composer `+` menu beside the existing
`Invite Expert...`.

⚠ **`CLAUDE.md` and the `sketch-findings-agentic-rag` skill both record a THREE-HOMES IA contract.**
This ruling changes it to four. **Update both registers in the same commit** and say *why*, rather
than letting a shipped 4th home silently contradict a written contract. That is this project's own
same-commit sync rule.

### D-262-02 — STRICT PACK-11 honesty. No upsell, no grey-out
**Operator ruling, `BUS-303`.** A user sees **every Expert they may actually use and none they may
not**. A tier-locked or grant-locked Expert **does not appear at all**. The sketch's words are the
bar: *"a catalog advertising locked Experts is a brochure for a locked door."*
⛔ **The UAT row is "the card VANISHES"**, never "the card is disabled".

### D-262-03 — ⛔ THE REACHABILITY TRIAD, in ONE commit
`App.tsx:95-105` records the rule and the reason. A 13th `ActiveView` member needs **all three**, or
it is built-and-unreachable (the Phase-118 lesson):

1. the union member in `App.tsx`,
2. **a matching render branch in `ChatLayout`, placed BEFORE the trailing positional
   `KnowledgeHealthPage` else**, and
3. an entry action that navigates to it (the nav item + the composer entry).

⛔ **`ChatLayout`'s trailing else is a POSITIONAL FALLBACK, not a `default:` that throws** — so a
union member with **no branch silently renders Knowledge Health**. A new branch must be added
additively before it, exactly as `classification-rules`, `skill-studio`, `control-room`,
`org-admin` and `admin-spend` each were.

⚠ **`App.tsx:171`'s `⛔ NO TWELFTH ActiveView MEMBER` is NOT a blanket ban and must not be read as
one.** It is Phase 235-08's *plan-scoped* refusal — *"the Library already has one"* — and a 12th
(`admin-spend`) landed afterwards at Phase 257. **Do not delete it.** Leave it addressed to its own
subject and, if a plan touches those lines, say in the same commit why this phase's member is not
the thing it refuses.

### D-262-04 — ⛔ A code measurement must not be satisfiable by a comment
`App.tsx:95-101` records the discipline twice: the acceptance fence **counts occurrences of the
literal in this file**, so prose that repeats the member name would let a comment satisfy a code
check (the `187-24` lesson). **Do not spell the new `ActiveView` literal in any new comment in
`App.tsx`.** Wave 3 of Phase 264 hit the same trap three times; prefer an **AST** fence over a
`grep -c` wherever one will do.

### D-262-05 — PACK-12 renders NAMES, not counts, and the rendered CONTENT is asserted
The ROADMAP is explicit: *"the **rendered content** is asserted, never the presence of a block."*
The detail modal shows the **named** folders, the **named** connections and skills, `when_to_use`
and `example_output` verbatim from the row.
⛔ **A `data-testid` presence assertion does not satisfy this criterion** — this project's recorded
finding is *"presence assertions cannot see content drift"*, and `262-RECORD.md` is the sharper
version: **the content here was never rendered at all**.

### D-262-06 — The two hardcoded artefacts are RETIRED, deliberately
- `InviteExpertDialog.getExpertIcon()` reads the **`icon` column**. Its emoji-by-slug map goes.
- `ExpertSpotlightCard`'s `DEFAULT_FINANCIAL_TILES` stops being a silent fallback.
⚠ Both retirements are **rewrites with the original reason preserved** (the `SEED-177` rule,
precedent `D-206-07`), never silent deletions — each shipped for a reason at Phase 260 and the
record should say what changed.

### D-262-07 — ONE read path, reusing what exists
`lib/api/experts.ts` already exports `listExperts` and `getExpert`. ⛔ **No new endpoint and no
second client function.** The catalog is a read surface over rows that already exist — that is the
ROADMAP's own framing.

### D-262-08 — PACK-13 reuses Phase 260's invite path, never a second mechanism
The detail modal's primary CTA calls the **same** `onSelectExpert` seam `InviteExpertDialog`
already uses. ⛔ A second way to start a scoped thread is exactly what the criterion forbids.

### D-262-09 — Nav governance: decide and RECORD, do not default silently
`NavItem.feature?` makes an entry vanish unless the caller's effective map resolves it true.
`experts` is already a governed capability (`require_capability('experts')`, PACK-06) on the API.
**Decide at planning whether the nav entry carries a `feature` key**, and write the reason either
way. ⚠ An ungoverned home that the API then 403s is a door to a locked room — the same shape
D-262-02 refuses.

### Claude's Discretion
- Component file names and how the catalog page is decomposed.
- Whether the catalog page and the detail modal are one plan or two.
- The exact search/filter implementation (client-side over the fetched list is acceptable — the
  roster is small and `listExperts` already returns it).

</decisions>

<canonical_refs>
## Canonical References — read before planning

### The design bar (G-2 SATISFIED — do not re-sketch)
- `.planning/sketches/261-262-expert-authoring-and-catalog/README.md` — the 5-element card anatomy,
  the catalog experience, the detail-modal contents, the honesty rule. **This is the acceptance bar.**
- `.planning/sketches/261-262-expert-authoring-and-catalog/index.html` — §`VIEW 1: DISCOVERY CATALOG`
  (line ~883) and the live PACK-11 honesty demo (~1756: *"Jane does not hold HR grant → card vanishes"*).
- `Skill("sketch-findings-agentic-rag")` — **the navigation/IA section is MANDATORY** before drawing
  a 4th home.

### What this phase is correcting
- `.planning/phases/262-an-expert-you-can-discover/262-RECORD.md`
- `.agent-bus/OPEN.md` → `BUS-303` (the operator ruling, verbatim)

### The surfaces
- `frontend/src/App.tsx:95-190` — the `ActiveView` union, the triad comment, the 235-08 refusal.
- `frontend/src/components/layout/ChatLayout.tsx:853-979` — the render ladder + trailing fallback.
- `frontend/src/components/layout/__tests__/ChatLayout.fallback.test.tsx`
- `frontend/src/lib/nav-items.ts` — `NAV_ITEMS`, `NavItem.feature`.
- `frontend/src/components/chat/InviteExpertDialog.tsx` — the existing browse surface + artefact 1.
- `frontend/src/components/chat/ExpertSpotlightCard.tsx` — artefact 2.
- `frontend/src/components/chat/MessageInput.tsx:591-601` — the composer `+` menu.
- `frontend/src/components/org/OrgExpertsTab.tsx` — **the admin surface that already renders all
  four presentation fields.** The closest analog for the detail modal's content.
- `frontend/src/lib/api/experts.ts`, `frontend/src/types/index.ts`
- `backend/app/api/experts.py:386` + `expert_service.list_experts_service`

### Guardrails (MANDATORY)
- `docs/HOT-FILE-LEDGER.md` → **`App.tsx` (32/23/374 — FIRES)**, **`NavPanel.tsx` (23/12/417 —
  FIRES)**, **`ChatArea.tsx` (77/38/882 — FIRES)**, **`MessageInput.tsx` (34/17/942 — FIRES)**,
  `nav-items.ts` (8/6/95 — ⚠ absent at 6 phases), `ChatLayout.tsx` (51/26/1010 — FIRES).
  ⛔ **Six hot files, five of them FIRING. Re-derive every triple; do not quote these.**
- `CLAUDE.md` § Workflow guardrails — **G-8** (3-5 plans), **G-5**, **G-4**, and the frontend count
  gate (`GSD_VITEST_MAX_WORKERS=2`, from the repo root).
- ⚠ `npx tsc --noEmit` checks **ZERO** files. Use `npx tsc -p tsconfig.app.json --noEmit` and
  measure a **set diff** — the app config reports a non-zero base.

</canonical_refs>

<specifics>
## Specific Ideas

- **The honesty row has a ready-made shape.** The sketch's own demo is *"switch to Jane → the
  role-gated card vanishes."* Phase 264's UAT proved the same discipline works against **real** org
  data: `fhdmrd.dev@gmail.com` is a genuine second member of org `22f9c615` who owns nothing. Grant
  an Expert to the author only, then drive the catalog as that member.
- **`OrgExpertsTab` is the content analog, not a component to reuse.** It proves the four fields
  render correctly; the detail modal is a different audience and a different layout.
- **The `+` menu entry and the nav home are two entry actions for one view** — the triad needs only
  one, so the second is a deliberate redundancy worth stating rather than an accident.

</specifics>

<deferred>
## Deferred Ideas

- **Clone & Customise** (`SEED-303 S8`) — a write on a read surface. Re-open trigger: the first
  phase that gives system templates a tenant-editable path.
- **A per-Expert URL / deep link** — owed to the routing phase (`SEED-185`, no router today).
- **Tier upsell in the catalog** — REFUSED by D-262-02 at the operator's ruling, not deferred.
  Re-open trigger: an explicit later commercial decision reversing `BUS-303`.

</deferred>

<cross_checks>
## Mandatory cross-checks at context time

- **Seeds register**: re-run `node scripts/check-seeds-register.cjs --phase 262` once PLAN.md files
  exist — a sweep before `files_modified` exists matches on nothing and must not be read as clean.
  `SEED-303` (S6 tool floor, S8 clone) and `SEED-185` (no router) are both live on this surface.
- **Reported bugs**: 14 open `surface: Agentic-RAG`; none names the Expert catalog. Nothing to fold.
- **G-7**: not applicable — a phase, not a gap-closure round.
- **G-2**: **SATISFIED** by the existing sketch. Do not re-sketch; read it.

</cross_checks>

---

*Phase: 262-an-expert-you-can-discover*
*Context gathered: 2026-09-22 — ROADMAP + existing sketch + BUS-303 operator ruling + measurement*
