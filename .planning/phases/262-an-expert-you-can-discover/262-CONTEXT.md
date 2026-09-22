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

---

# ⛔ AMENDED 2026-09-22 BY RESEARCH — six claims refuted, two decisions re-aimed

Every original above is left standing rather than overwritten. In this project a claim that rots is
the finding, and **four of these were load-bearing.**

## R-1 — the trailing fallback is NOT `KnowledgeHealthPage`

`ChatLayout.tsx:981-983` renders `<UnknownViewFallback view={activeView as never} />`, retired at
Phase **217.1-14** and fenced by `ChatLayout.fallback.test.tsx:18-22` + `renameFence.test.ts:146-153`.
A branchless member renders **"This view has no screen: experts"** — not Knowledge Health.
⭐ **CONTEXT inherited that from stale prose still sitting at `App.tsx:103-105`.** That comment is
the rot's source; correct it in-phase, **beside** the original.

## R-2 — ⛔ THERE IS NO READYMADE RED. The triad is guarded by NOTHING automatic

`ChatLayout.fallback.test.tsx` is four **source-text** assertions — nothing mounts, nothing
enumerates `ActiveView`. Its own fourth case is titled *"the compile-time exhaustiveness check is
**bypassed** via as never"*. `UnknownViewFallback.tsx:9-10`'s docstring claims a `satisfies never`
guarantee **the code does not ship** (`as never` is always a legal assertion), and
`renameFence.test.ts:142` only asserts `members.length >= 10`.
⛔ **So a branchless member ships green.** This phase must BUILD the guard, not inherit one.

## R-3 — `OrgExpertsTab` is a weaker analog than CONTEXT claimed

It renders **3 of 4** fields and shows **counts, not names** (`:274-276` — `📁 N folders / ⚡ N
skills / 🔌 N conns`). **`example_output` renders in ZERO components, admin included.**
⭐ Its `ICON_MAP` + `renderExpertIcon` (`:30-46`) **is** the ready-made replacement for D-262-06.

## R-4 — the ROADMAP's "no test drives the no-grant user" is FALSE

`test_261_expert_grants_db.py:354-364` drives `list_expert_bundles_for_caller` against real PG with
a plain-member no-grant user and asserts the bundle is absent. ⚠ It `pytest.skip`s without `:54322`.
**The genuine gap is the API layer and the frontend** — narrow the claim, do not repeat it.

## R-7 — FIVE hardcoded sites, not two (D-262-06 widens)

`getExpertIcon` is duplicated **verbatim** in `InviteExpertDialog.tsx:27-37` **and**
`ExpertSpotlightCard.tsx:70-81`; plus `DEFAULT_FINANCIAL_TILES` (`:26-42`), `folderLabel` →
`"SEC Filings & Reports"` (`:93-96`), `skillLabel` → `"ratio_calculator"` (`:98-103`).

## R-6 — `NAV_ITEMS` already carries seven entries; this is the eighth

---

# The two "is it frontend-only?" answers — BOTH YES

**The type + serializer are clean.** `types/index.ts:17-35` carries all four fields (optional);
`api/experts.py:385` `list_experts` has **no `response_model`** and the chain ends in `SELECT *` +
`_row_to_dict`. Everything reaches the client.
⛔ **The one endpoint that WOULD strip them is `/resolve`** — `ResolvedExpertBundle` has none of the
four. **Do not use it for the modal.**

**Only FOLDERS need id→name.** `member_skills` are already skill NAMES; `required_connections` are
already display names. ⭐ **`ChatLayout.tsx:142` already holds `folders` from `useFolders()`** and
threads it to three mounts — pass a fourth.
⛔ **A folder id can legitimately fail to resolve** (the one system Expert binds a folder seeded into
org `430bffc6` alone, `mig 188:29-37`), so the modal needs an **honest "a folder you cannot see"
state** — never a blank.

---

# D-262-09 RE-AIMED — CONTEXT asked the right question of the wrong system

⛔ **`experts` is NOT a `GovernedFeature`.** That union is closed at six members
(`lib/api/_core.ts:104-110`, mirrored `user_settings.py:1578-1606`).
`require_capability("experts")` is a **per-org TIER entitlement** through `tier_capabilities` — a
different axis with **no frontend read path at all**. ⭐ **Tagging the nav entry would not prevent
the 403.**

**DECISION: leave the nav entry UNGOVERNED**, precedent `connections` (`nav-items.ts:59`, pinned by
`navItemsConnections.test.ts:44-49`), and `visibleNavItems` has been **fail-OPEN since 2026-09-09**
(`:118`). The catalog instead renders an **honest refusal** if the API 403s.

⛔ **AND THE REAL HAZARD, which is a UAT blocker not a build one:** `mig 186:72` grants `experts` to
**enterprise only**, and `db/entitlements.py:152-156` **fails closed on a NULL tier**. This is the
same condition `BUS-283` raises for production. **Verify the local org's `subscription_tier` before
G-4**, or the catalog 403s and reads as a build defect.

---

# ⛔ D-262-08 RE-AIMED — PACK-13's seam is not the one it named

`onSelectExpert` → `handleSelectExpert` at **`MessageInput.tsx:159-172`** is local and
`threadId`-dependent, and `ChatLayout.launch.test.tsx:558-576` structurally fences `<ChatArea` out
of the non-chat branch. **The catalog cannot call it.**

⭐ **The seam that works is one register lower and already shipped:** `ChatArea.tsx:234-252`
hydrates the spotlight from `thread.active_expert_id`. So PACK-13 is
`setThreadActiveExpert` + `selectThread` + `onNavigate("chat")` — **the same mechanism, not a second
one**, which is what the criterion actually requires.

⚠ Two traps: `useThreads.newThread()` returns a Thread whose `active_expert_id` is `null` and there
is **no updater for that field**; and the clean alternative — mirroring `prefillMessage`
(`App.tsx:144/358-359` → `ChatLayout.tsx:96-97/817-818` → `ChatArea.tsx:573-586`, already used for
skills) — **must apply `libraryTabAfterNavigate`'s one-shot clearing lesson (`App.tsx:178-190`) or
it re-fires forever.** The `prefillMessage` mirror is the recommended shape: it has precedent.

---

# ⛔ THREE PITFALLS THAT WILL RED AN UNRELATED SUITE

**P-3 — `App.tsx:171`'s `NO TWELFTH` comment is a FENCE'S NON-VACUITY TOKEN.**
`LibraryPage.initialTab.test.tsx:502-503` asserts `APP` contains that string and `APP_CODE` does
not. ⛔ **Delete it and an unrelated pinned suite goes red.** That is the measured reason D-262-03
lacked — it is not merely impolite to remove, it is load-bearing.

**P-7 — retiring `DEFAULT_FINANCIAL_TILES` reds a pinned suite.**
`ExpertSpotlightCard.test.tsx:47-69` asserts all three tiles verbatim with `prompt_suggestions: []`.
Pin is **5**, so the rewrite must land **≥5** cases.

**P-11 — `renameFence.test.ts:121-127` greps the literal `"the three-homes contract holds"`, and
that exact string is `App.tsx:100` — the prose D-262-01 mandates changing.** Change the surrounding
text or update the fence **in the same commit**.

---

# Gates at base, measured on a quiet tree (NOT to be quoted later — re-derive)

| Gate | Result |
|---|---|
| vitest count gate | ⛔ **`COUNT GATE VIOLATED` · total 8676 · failed 2 · pinned 7935** |
| `tsc -p tsconfig.app.json --noEmit` | **70** errors (CLAUDE.md says 67 — stale) |
| backend baseline harness | ✅ `71 failed, 5490 passed` — the ceiling, **zero headroom** |
| ledger (`--files`) | ✅ all 12 have rows |
| CLAUDE.md size | ✅ 116,991 — ⚠ only **3,009** to the warn band |

⛔ **THE COUNT GATE IS RED AT BASE AND IT IS INHERITED.** Both failures are in
`frontend/src/components/library/__tests__/sketchComposition.test.tsx` (pinned 47, in BOTH knobs) —
one `STACK_TRACE_ERROR`, one **real** `TestingLibraryElementError: Found multiple elements with the
role "tab" and name "Documents"`. Proven inherited by an **empty** `git diff --stat HEAD --
frontend/`. **Not** in SEED-171's flaky five. ⭐ Captured from the gate's own persisted JSON
**before** any re-run, per the standing rule.

⛔ **`source venv/Scripts/activate` under Git Bash does NOT activate this venv** — that route reports
a bogus `96 failed … 3 errors`. **Always use `node scripts/check-backend-unit-baseline.cjs`.**

**Ledger, re-derived — all eight FIRE G-5 and every triple except `ChatArea.tsx` was STALE:**
`App.tsx` 33/24/378 · `ChatLayout.tsx` 52/27/1014 · `NavPanel.tsx` 24/13/417 · `nav-items.ts`
9/6/118 · `MessageInput.tsx` 35/17/942 · `ChatArea.tsx` 77/38/882 · `types/index.ts` 90/70/1434 ·
`lib/api/experts.ts` 6/3/313. No file is missing a row.

**Knob coverage:** only **two** bare-directory entries exist in TARGETS (`src/landing`,
`src/components/workflows`). ⛔ **`lib/nav-items.test.ts` and `lib/__tests__/navItemsConnections.test.ts`
run in NEITHER knob** while `nav-items.ts` fires G-5 — **adopt both**. ⛔ **A new catalog suite will
be in NEITHER unless the plan adds it.**

---

# D-262-10 — the `upgrade_hint` question, decided by me and flagged, not silently

`InviteExpertDialog.tsx:102-106` **already renders `upgrade_hint`** ("Upgrade to Enterprise…"),
shipped at Phase 260 — which sits against D-262-02's spirit.

**ASSUMPTION TAKEN, so the phase is not blocked:** D-262-02 governs **what the catalog LISTS** — a
locked Expert does not appear. The `upgrade_hint` is an **error string at a different moment** (an
invite attempt that failed), not a brochure entry, so it is **left alone and out of scope**.
⚠ **This is my call, not the operator's**, and it is the one place this phase touches the no-upsell
ruling's edge. Raise it at close; reverse cheaply if the operator disagrees.
