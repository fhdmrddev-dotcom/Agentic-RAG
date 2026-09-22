# Phase 262: An Expert You Can Discover — Research

**Researched:** 2026-09-22
**Domain:** Frontend surface addition in an existing, heavily-fenced React codebase. No new library, no new endpoint.
**Method:** Repository measurement only. No web research (per the brief).
**Confidence:** HIGH on everything tagged `[MEASURED]`; each claim carries `file:line` or command output.

---

## 1 · Verdict

**CONTEXT's approach is sound and its scope is right — but four of its load-bearing factual
claims are FALSE, and one of them (the trailing fallback) is copied verbatim from prose in
`App.tsx` that has itself been stale since Phase 217.1.** The reachability triad is still the
correct discipline; what is wrong is the *consequence* CONTEXT assigns to skipping it.

The two questions that decide whether this is a frontend-only phase both resolve **YES,
frontend-only**: `ExpertBundle` already carries all four presentation fields, `list_experts`
has **no `response_model`** so `SELECT *` reaches the client intact, and the only id→name
resolution the detail modal needs is **folders** — `member_skills` and `required_connections`
are already stored as human strings. `[MEASURED]`

The two things that *are* bigger than CONTEXT assumes are **(a) D-262-09's nav-governance
question, which CONTEXT frames against the wrong governance system** — `experts` is a *tier
entitlement*, not a `GovernedFeature`, and `NavItem.feature` cannot carry it without a
code-level union widening in three files — and **(b) D-262-08's "reuse the `onSelectExpert`
seam", which is not reachable from a 4th home**: that seam lives inside `MessageInput` and
needs a `threadId`, and `ChatLayout`'s else-branch structurally mounts neither `ChatArea` nor
`MessageInput` (fenced by `ChatLayout.launch.test.tsx:558-576`). PACK-13 is still satisfiable
without a second mechanism, but through a *different* existing seam than the one named.

Finally, the gate picture, measured on a quiet tree: the **frontend count gate is RED at the phase
base for a reason this phase does not own** — `RESULT: COUNT GATE VIOLATED · failed 2`, both
failures in `sketchComposition.test.tsx`, on a tree whose `git diff --stat HEAD -- frontend/` is
**empty**. The **backend baseline is GREEN but at exactly zero headroom** (`71 == 71`, 0 errors),
and `tsc -p tsconfig.app.json` reports **70** base errors. **Plans must write SET-DIFF acceptance
criteria** — *"count gate OK"* and *"zero tsc errors"* are both unreachable here. `[MEASURED]`

---

## 2 · Refuted / corrected CONTEXT claims

### ⛔ R-1 — The trailing fallback is **NOT** `KnowledgeHealthPage`, and a branchless member does **NOT** silently render Knowledge Health

CONTEXT `<measured_state>` row *"ChatLayout render chain :853-979 — a long `? :` ladder ending
in a **trailing positional `KnowledgeHealthPage` else**"*, and D-262-03's ⛔ block, are both
**REFUTED**.

```
frontend/src/components/layout/ChatLayout.tsx:979-983
          ) : activeView === "admin-spend" ? (
            <AdminSpendPage onBack={() => onNavigate("control-room")} />
          ) : (
            <UnknownViewFallback view={activeView as never} />
          )}
```

`KnowledgeHealthPage` was retired from this ladder at **Phase 217.1-14**. The replacement
renders a visible honest line — `frontend/src/components/layout/UnknownViewFallback.tsx:15-21`:
*"This view has no screen: `{view}`"*. Two live fences assert the retirement:
`ChatLayout.fallback.test.tsx:18-22` (`expect(LAYOUT).not.toContain("<KnowledgeHealthPage />")`)
and `renameFence.test.ts:146-153`. `[MEASURED]`

**Why this still matters, and why the triad discipline survives:** the branch is still
POSITIONAL and still required. A 13th member with no branch renders a *dead-end explainer*
instead of a *wrong product page* — better, but still built-and-unreachable. **Keep D-262-03;
correct its reason.** ⚠ And correct it *beside* the original: `App.tsx:103-105` still carries
the stale prose (*"ChatLayout's trailing `<KnowledgeHealthPage />` … silently renders Knowledge
Health"*), which is where CONTEXT inherited it from. That comment is the source of the rot and
should be corrected in the same commit, with the original preserved.

### ⛔ R-2 — `ChatLayout.fallback.test.tsx` does **NOT** already fail when a union member has no branch. There is **no readymade RED** for the triad

Read in full. All four cases are **source-text assertions** over `ChatLayout.tsx?raw` and
`UnknownViewFallback.tsx?raw`. None mounts anything; none enumerates `ActiveView`. Its own
fourth case is titled *"the compile-time exhaustiveness check is **bypassed** via as never in a
ternary"*. `[MEASURED]`

And the compile-time arm the component's docstring claims (`UnknownViewFallback.tsx:9-10`:
*"Unreachable in a correct build via the caller's `satisfies never` compile-time assertion
(TS2322 …)"*) **does not exist in the code**: the call site writes `activeView as never`, a
*type assertion*, and `X as never` is always legal because `never` is assignable to everything.
⭐ **The docstring describes `satisfies never`; the code ships `as never`. They are not the same
guarantee, and only the weaker one is in the file.** `[MEASURED]`

Nor does `renameFence.test.ts` help: its `ActiveView` case asserts
`members.length).toBeGreaterThanOrEqual(10)` (`:142`) — a 13th member passes.

**Consequence for planning:** the triad's third leg (the entry action) and its second leg (the
branch) are guarded by **nothing automatic**. The one precedent that closed this by hand is
Phase 257.1's four NavPanel cases (§6 below) — copy that shape.

### ⛔ R-3 — `OrgExpertsTab.tsx` renders **three** of the four presentation fields, and renders **COUNTS, not names**

CONTEXT `<canonical_refs>` calls it *"the admin surface that already renders **all four**
presentation fields"* and the RECORD says *"An admin can see them."* Measured:

| Field | Rendered in `OrgExpertsTab.tsx`? |
|---|---|
| `icon` | ✅ `:44-46` via a local `ICON_MAP` (11 lucide glyphs) |
| `category` | ✅ `:222` |
| `when_to_use` | ✅ `:264-266` |
| `example_output` | ⛔ **NOT RENDERED ANYWHERE** — `grep -n "example_output" OrgExpertsTab.tsx` → no hit |

And its members section (`:274-276`) is verbatim:

```tsx
<span>📁 {(exp.knowledge_folder_ids || []).length} folders</span>
<span>⚡ {(exp.member_skills || []).length} skills</span>
<span>🔌 {(exp.required_connections || []).length} conns</span>
```

⭐ **So `example_output` renders in exactly ZERO components today, admin included** — it is
strictly worse off than the other three, and PACK-12's *"example prompts / sample deliverable"*
half has no precedent to copy at all. `[MEASURED]`

⭐ **The one genuinely reusable asset is `ICON_MAP` + `renderExpertIcon` at
`OrgExpertsTab.tsx:30-46`** — that is the ready-made replacement for D-262-06's artefact 1.

### ⛔ R-4 — The ROADMAP's *"no test drives the no-grant user"* is **FALSE**. It IS driven, at the DB layer

`backend/tests/unit/test_261_expert_grants_db.py:354-364`, inside
`test_live_db_expert_grants_crud_and_access`:

```python
# 7. Verify list_expert_bundles_for_caller
list_a = await list_expert_bundles_for_caller(conn, org_id, user_a, ["member"], include_system=False)
assert any(b["id"] == expert_id for b in list_a)
# user_b (plain member) does NOT see it
list_b = await list_expert_bundles_for_caller(conn, org_id, user_b, ["member"], include_system=False)
assert not any(b["id"] == expert_id for b in list_b)
# user_b (with hr-role) sees it
list_b_hr = await list_expert_bundles_for_caller(conn, org_id, user_b, ["member", "hr-role"], include_system=False)
assert any(b["id"] == expert_id for b in list_b_hr)
```

That is *exactly* PACK-11's honesty criterion, driven against a real Postgres on `:54322`. ⚠ **It
`pytest.skip`s when the local DB is unreachable (`:296-299`)**, so a green CI run proves nothing
about it — which is why the claim was believable. What is genuinely undriven is the **API layer**
(`GET /experts` with `for_management=False`) and the **frontend**. §6 has the exact gap. `[MEASURED]`

### ⚠ R-5 — CONTEXT's ledger triples are stale in **all six** rows it quotes (it says so; here are the current numbers)

See §7. Every one of the six moved; `nav-items.ts` is `+23` lines out.

### ⚠ R-6 — "a 4th top-level nav home" is a count of *conceptual homes*, not of rail entries

`NAV_ITEMS` carries **seven** entries today (`nav-items.ts:30-83`: chat · workflows · documents ·
classification-rules · connections · skills · settings). `NavPanel` additionally renders the
control-room shield (`:353`) and the admin-spend entry (`:395`) *outside* the array. So this phase
adds an **eighth `NAV_ITEMS` entry** / a **tenth rail affordance**. D-262-01's "update both
registers" still stands; just do not write "three → four" as if it described the array. `[MEASURED]`

### ⚠ R-7 — `ExpertSpotlightCard.tsx` has **FOUR** hardcoded `financial-analyzer` sites, not one; and `getExpertIcon` is DUPLICATED across two files

`grep -rn "getExpertIcon\|financial-analyzer" frontend/src`:

| Site | File:line |
|---|---|
| icon by slug/name | `InviteExpertDialog.tsx:27-37` |
| icon by slug/name (**verbatim duplicate**) | `ExpertSpotlightCard.tsx:70-81` |
| `DEFAULT_FINANCIAL_TILES` fallback | `ExpertSpotlightCard.tsx:26-42`, used at `:58-59` |
| `folderLabel` → `"SEC Filings & Reports"` | `ExpertSpotlightCard.tsx:93-96` |
| `skillLabel` → `"ratio_calculator"` | `ExpertSpotlightCard.tsx:98-103` |

D-262-06 names two artefacts. There are **five sites in two files**, and the icon function is a
one-home-per-concern violation on its own. `[MEASURED]`

### ✅ Claims that HELD

- `App.tsx:107` — the `ActiveView` union has **twelve** members. ✅
- `App.tsx:171` — `⛔ NO TWELFTH ActiveView MEMBER` is exactly where CONTEXT says. ✅ (and see P-3)
- `MessageInput.tsx:591-601` — the `+` menu hosts `Invite Expert...` via
  `data-testid="invite-expert-door"` → `setInviteExpertOpen(true)`. ✅
- `nav-items.ts` — `NavItem.feature?: GovernedFeature`, and `visibleNavItems` drops an entry whose
  key is `=== false` (`:118`, *"HIDE ONLY WHAT IS KNOWN TO BE DENIED"* — note it is `!== false`,
  i.e. fail-**OPEN** since 2026-09-09, not fail-closed). ✅ with a nuance.
- Migration 189 presentation columns exist; `ExpertAuthoringStudio` writes all four. ✅
- `lib/api/experts.ts` already exports `listExperts` + `getExpert`. ✅

---

## 3 · The ordered edit list — the reachability triad and everything hanging off it

### 3a · The render ladder, exactly as it stands `[MEASURED]`

`frontend/src/components/layout/ChatLayout.tsx` — the chat/non-chat split is at `:787`
(`{activeView === "chat" ? (`). The non-chat ladder lives inside
`<main className="flex-1 overflow-hidden">` (`:846`):

| # | Line | Branch | Mounts |
|---|---|---|---|
| 1 | 853 | `activeView === "documents"` | `<LibraryPage>` |
| 2 | 855 | `activeView === "skills"` | `<SkillsPage>` |
| 3 | 862 | `activeView === "connections"` | `<ConnectionsPage />` |
| 4 | 874 | `activeView === "settings"` | `<SettingsPage />` |
| 5 | 876 | `activeView === "workflows"` | `<WorkflowsPage>` |
| 6 | 892 | `activeView === "classification-rules"` | `<ClassificationRulesPage />` |
| 7 | 898 | `activeView === "skill-studio"` | `<SkillStudioPage>` |
| 8 | 914 | `activeView === "control-room"` | `<ControlRoomPage>` |
| 9 | 923 | `activeView === "org-admin"` | `<OrgAdminShell>` |
| 10 | 932 | `activeView === "workflow-run" && canvasEnabled` | `<WorkflowRunPage>` |
| 11 | **979** | `activeView === "admin-spend"` | `<AdminSpendPage>` |
| — | **981** | **trailing positional else** | `<UnknownViewFallback view={activeView as never} />` |

**The precise insertion point.** The new branch goes between these two lines, verbatim:

```
980                <AdminSpendPage onBack={() => onNavigate("control-room")} />
981              ) : (
```

i.e. immediately after `:980` and before `:981`, so the `) : activeView === "experts" ? (`
keyword lands as branch **12**, and `<UnknownViewFallback` remains last. This preserves
`ChatLayout.launch.test.tsx:547-556`, which asserts
`indexOf('activeView === "workflow-run"') < indexOf("<UnknownViewFallback")`.

### 3b · The `admin-spend` precedent — the template commit `[MEASURED]`

```
45ab1830d35d8e2340a4b00fcc0749e5b539f195
feat(257-03): admin spend dashboard, svg charts, honesty card and vitest suite
Sat Sep 19 08:25:33 2026 +0400
```

File list (11 files, +1754/−1):

```
.planning/.../257-03-SUMMARY.md               |  63 +
frontend/src/App.tsx                          |   6 +-   ← union member + entry
frontend/src/api/spend.ts                     | 184 +
frontend/src/components/admin/spend/BlindSpotsCard.tsx    | 165 +
frontend/src/components/admin/spend/DailySpendChart.tsx   | 147 +
frontend/src/components/admin/spend/RepriceModal.tsx      | 212 +
frontend/src/components/admin/spend/SpendDonutChart.tsx   | 148 +
frontend/src/components/layout/ChatLayout.tsx |   4 +   ← import + branch
frontend/src/pages/admin/AdminSpendPage.test.tsx | 203 +
frontend/src/pages/admin/AdminSpendPage.tsx   | 553 +
frontend/src/types/spend.ts                   |  70 +
```

The ChatLayout half is **exactly four lines**: an import (`+2` incl. its comment) and the branch
(`+2`). The App half is **six lines**: `| "admin-spend"` appended to the union, plus a
`window.location.pathname` probe in the `useState` initialiser.

⛔ **The precedent is also a CAUTIONARY one, and the repo says so out loud.** Phase 257 shipped
the union member and the mount and **NO ENTRY ACTION** — the only way in was typing a URL. The
third leg landed a phase later, and its own test file records the diagnosis:
`frontend/src/components/layout/__tests__/NavPanel.test.tsx:100-106`:

> *"Phase 257 shipped the spend cockpit with its ActiveView and its ChatLayout mount and NO ENTRY
> ACTION … That is the Phase-118 built-but-unreachable lesson recurring, and it is exactly the leg
> of the triad that no typecheck and no unit test can notice on its own — which is why these three
> cases exist rather than a comment."*

⭐ **Those four cases (`:108-129`) are the shape this phase's entry-action test must copy.**
Note also `:124-129` — Spend is *deliberately* kept OUT of `NAV_ITEMS` because the array also
feeds ChatLayout's mobile drawer. **This phase wants the opposite**: `experts` belongs IN the
array precisely so the mobile drawer gets it for free (`ChatLayout.tsx:702`).

### 3c · The ordered edit list

| # | Edit | File:line | Note |
|---|---|---|---|
| 1 | Union member `\| "experts"` | `App.tsx:107` | ⛔ do **not** spell the literal in any comment in this file (D-262-04) |
| 2 | Import + render branch | `ChatLayout.tsx` import block (~`:35`), branch between `:980` and `:981` | additive; last-but-one |
| 3 | Nav entry `{ view: "experts", icon: Sparkles, label: "Experts" }` | `nav-items.ts` `NAV_ITEMS` | 8th entry; feeds rail **and** mobile drawer. `Sparkles` is already imported in this repo's lucide usage |
| 4 | Composer `+` entry `Browse Expert Catalog…` | `MessageInput.tsx` beside `:591-601` | needs a new prop — see #5 |
| 5 | Prop chain for #4 | `ChatLayout.tsx:828` → `ChatArea.tsx:36/58/540` → `MessageInput.tsx:82/146` | ⭐ **exact precedent already shipped:** `onOpenConnections={() => onNavigate("connections")}` at `ChatLayout.tsx:828`. Copy it as `onBrowseExperts={() => onNavigate("experts")}` |
| 6 | The catalog page + detail modal | new dir, e.g. `frontend/src/components/experts/catalog/` | Claude's discretion per CONTEXT |
| 7 | Retire artefact 1 (icon) | `InviteExpertDialog.tsx:27-37` **and** `ExpertSpotlightCard.tsx:70-81` | extract ONE home reusing `OrgExpertsTab.tsx:30-46`'s `ICON_MAP` |
| 8 | Retire artefact 2 (tiles) | `ExpertSpotlightCard.tsx:26-42,58-59` + `:93-96` + `:98-103` | four sites, not one (R-7) |
| 9 | Entry-action test | `NavPanel.test.tsx` pattern `:108-129` | the only leg nothing else can catch |
| 10 | Gate knobs | `scripts/vitest-count-gate.cjs` TARGETS **and** BASELINE | see §7c — a new suite is in NEITHER by default |
| 11 | Ledger rows | `docs/HOT-FILE-LEDGER.md` + the CLAUDE.md scan table, **same commit** | `check-hot-file-ledger.cjs 262` |
| 12 | IA-contract correction | `CLAUDE.md` + `Skill("sketch-findings-agentic-rag")` | D-262-01, same commit |

---

## 4 · The two questions that decide whether this phase is frontend-only

### 4a · `ExpertBundle` the TYPE, and the serializer — **both clean. No backend change.** `[MEASURED]`

`frontend/src/types/index.ts:17-35`:

```ts
export interface ExpertBundle {
  id: string; name: string; slug: string; description: string
  scope_mode: "restricted" | "biased"
  member_skills: string[]
  required_connections: string[]
  knowledge_folder_ids: string[]
  prompt_suggestions: Array<{ title: string; prompt: string }>
  visibility: string; is_system: boolean; is_enabled: boolean
  icon?: string
  category?: string
  when_to_use?: string
  example_output?: string
  tool_floor_enabled?: boolean
}
```

All four present (optional — a modal must therefore render an honest empty state, not `undefined`).

**The serializer does not strip them.** `backend/app/api/experts.py:385-387`:

```python
@router.get("", status_code=status.HTTP_200_OK)
async def list_experts(...) -> list[dict[str, Any]]:
```

⭐ **No `response_model`.** The chain is `list_experts_service` (`expert_service.py:163-186`) →
`experts_db.list_expert_bundles_for_caller` (`db/experts.py:299-306`) which issues
`SELECT * FROM public.expert_bundles` and maps each row through `_row_to_dict`
(`db/experts.py:61-67`) — a plain `dict(row)` with only `prompt_suggestions` post-processed.
**Every column reaches the client.** Same for `GET /experts/{id}` (`:429`, also no
`response_model`).

⛔ **The one endpoint that WOULD strip them is `/resolve`** — `@router.get(".../resolve",
response_model=ResolvedExpertBundle)` (`:460`), and `ResolvedExpertBundle`
(`expert_service.py:18-32`) carries **no `icon`, `category`, `when_to_use` or `example_output`**.
Do not reach for `/resolve` for the detail modal's presentation half.

**Verdict: PACK-12's data is already on the wire. This is a rendering phase.** `[MEASURED]`

### 4b · id → name — only **folders** need resolving, and there is a shipped 3-line precedent `[MEASURED]`

| Field | Stored as | Needs resolution? |
|---|---|---|
| `member_skills: string[]` | **skill NAMES.** `_refuse_unknown_member_skills` (`api/experts.py:54-90`) passes them to `filter_visible_skill_names(skill_names=member_skills, …)` | ⛔ **No** — render verbatim |
| `required_connections: string[]` | **connection NAMES.** `ExpertAuthoringStudio.tsx:1114` selects with `requiredConnections.includes(c.name)` where `c` came from `listConnectorConnections()` | ⛔ **No** — render verbatim |
| `knowledge_folder_ids: string[]` | **UUIDs** (mig 187: `uuid[]`) | ✅ **Yes** |

**The cheapest correct path — already shipped, copy it.** `ExpertAuthoringStudio.tsx:203-229`:

```tsx
const [folders, skills, connections] = await Promise.all([
  listFolders().catch(() => []),
  listSkills().catch(() => null),
  listConnectorConnections().catch(() => []),
])
setAvailableFolders(folders.map((f: any) => ({ id: f.id, name: f.name })))
```

For the catalog the answer is cheaper still: **`ChatLayout` already holds `folders` from
`useFolders()` (`ChatLayout.tsx:142`) and threads it into three mounts (`:588 / :816 / :888`).**
Pass it as a fourth — one prop, zero new fetches, zero new API surface. `[MEASURED]`

⛔ **BUT A FOLDER ID CAN LEGITIMATELY FAIL TO RESOLVE, AND THE SEEDED SYSTEM EXPERT IS THE PROOF.**
The only system Expert binds folder `00000000-…-260` (mig `188_expert_chat_scoping.sql:172`), and
that folder row is seeded into **one specific org** — `430bffc6-7275-499b-b307-d932b4750051`
(`:31`) — with `is_org_shared = true`. **Any other org's `listFolders()` will not return it.** So
the detail modal MUST have a third state for a folder it cannot name. Per this project's own
recorded rule (*"unknown is not denied"*, `nav-items.ts:104-117`; *"a failed child load renders a
REASON"*, the `SourceFolderPicker` ledger row), that state says **"a knowledge folder you cannot
see"**, never a blank and never a silent drop. `[MEASURED]`

⚠ **A latent inconsistency, out of scope but worth naming so a plan does not "fix" it by accident:**
the backend resolver strips a connection whose value is not in `active_conn_keys`, built from
`r.get("capability")` (`expert_service.py:520-522`) — i.e. it expects **capability keys** — while the
studio writes **display names**. The catalog only *reads* `required_connections`, so it is unaffected;
but do not reconcile the two here. `[MEASURED]`

---

## 5 · Nav governance (D-262-09) — CONTEXT is asking the right question against the wrong system

### The measurement

⛔ **`experts` is NOT a `GovernedFeature`.** The union is closed, six members
(`frontend/src/lib/api/_core.ts:104-110`):

```ts
export type GovernedFeature =
  | "skill_studio" | "model_management" | "workflow_authoring"
  | "governance_health" | "visual_workflow_canvas" | "live_connectors"
```

Backend mirror — `backend/app/models/user_settings.py:1578-1606`, `_GOVERNED_FEATURES`, same six
keys. `[MEASURED]`

**`require_capability("experts")` (`api/experts.py:18,43-44`) is a completely different axis.** It
resolves through `entitlement_service.check_entitlement` → `db/entitlements.resolve_org_entitlement`
→ `public.tier_capabilities`. The two systems share no code and no data:

| | `GovernedFeature` / `NavItem.feature` | `require_capability("experts")` |
|---|---|---|
| Scope | per-USER audience | per-ORG subscription tier |
| Source | `app_settings.feature_visibility` + `_GOVERNED_FEATURES` | `public.tier_capabilities` + `organizations.add_ons` |
| Read path to the frontend | `GET /features` → `useEffectiveFeatures` | ⛔ **NONE EXISTS** |
| Failure shape | entry vanishes | HTTP **403** `{"error": "entitlement_required", …}` |

⛔ **So tagging the nav entry `feature: "experts"` would not prevent the 403 D-262-09 is worried
about.** It would add a *second, unrelated* governance axis whose value is controlled by the
operator's audience map, not by the org's plan.

### What adding the key would actually cost `[MEASURED]`

Not a migration — `live_connectors` is the precedent (added Phase 210, `grep -rn "live_connectors"
supabase/migrations/*.sql` → **no hits**; it lives only at `user_settings.py:1606` as `"off"`). The
cost is three files, because `FeatureVisibility.tsx:64` declares
`visibility: Record<GovernedFeature, AudienceValue>` — an **exhaustive** Record, so a missing key is
a `tsc` error:

1. `frontend/src/lib/api/_core.ts:104` — union `+1`
2. `backend/app/models/user_settings.py:1578` — dict `+1`
3. `frontend/src/components/admin/FeatureVisibility.tsx` — the `Record` **and** the feature-card list at `~:134`

### The measured hazard D-262-09 should actually be deciding about

`supabase/migrations/186_tier_capabilities.sql:72` — the **only** row granting `experts`:

```sql
('enterprise', 'experts', true),
```

No `standard`, no `pro`, no `free`. And `resolve_org_entitlement` (`db/entitlements.py:152-156`)
**fails closed on a NULL tier**:

```python
if not normalized_tier:
    required_tier = await get_minimum_tier_for_capability(pool, normalized_cap)
    return False, None, required_tier or "enterprise", "Organization has no subscription tier assigned (fail-closed)"
```

⚠ Memory of Phase 258 records *"2 of 2 prod orgs had a NULL tier"* — **UNVERIFIED in this session**
(I did not query the live DB). **Verify the dev org's `organizations.subscription_tier` before UAT**,
or the catalog will 403 wholesale and look like a build defect.

### ⚠ And the upsell tension D-262-02 has to resolve, because it is already shipped

`lib/api/experts.ts` `handleResponse` (`:148-160`) maps `err.detail.upgrade_hint` straight into the
thrown message, and `InviteExpertDialog.tsx:102-106` renders that message verbatim in a destructive
banner. **A non-enterprise org already sees *"Upgrade to Enterprise to use experts."* in the composer
today** — shipped at Phase 260. D-262-02 refuses upsell **in the catalog**; it should say explicitly
whether it also refuses it in the error path, because the shipped behaviour disagrees with the
decision's spirit. `[MEASURED]`

### Recommendation (the reason, both ways, as D-262-09 requires)

**Leave the nav entry UNGOVERNED — no `feature` key — and make the catalog page render the server's
refusal honestly.** Three measured reasons:

1. `experts` is not a `GovernedFeature`; adding one governs the wrong thing (above).
2. `visibleNavItems` has been **fail-OPEN since 2026-09-09** (`nav-items.ts:118`,
   `features[item.feature] !== false`), with a long comment explaining that *"the API is the wall"*
   and that hiding on `undefined` cost the operator their Settings page. A new governed entry buys
   no safety this predicate is willing to provide.
3. **The precedent is `connections`** — `nav-items.ts:59`, ungoverned **by design**, pinned by
   `navItemsConnections.test.ts:44-49` (*"keeps that door UNGOVERNED — a feature tag here would
   re-strand it"*).

⚠ **The honest-refusal page is not an upsell** and does not violate D-262-02 — D-262-02 forbids
advertising *locked Experts*; an empty catalog that says *"Experts are not part of your plan"* names
a fact about the plan, not a product it is dangling. If the operator wants even that hidden, the only
mechanism that works is a one-shot probe in `App` (a `GET /experts` HEAD-equivalent) feeding the nav
— which is net-new machinery and should be a written decision, not a default.

---

## 6 · PACK-11's backend and what actually drives it

### The predicate, traced exactly `[MEASURED]`

`api/experts.py:415-422` (the `for_management=False` arm) passes `caller_user_id` + `caller_roles`
→ `expert_service.list_experts_service:172-180` branches on `caller_user_id is not None` →
`db/experts.list_expert_bundles_for_caller:277-293`:

```sql
(
  is_system = true
  OR visibility IN ('org', 'public')
  OR (visibility = 'private' AND created_by = $N)
  OR (visibility = 'granted' AND (
        created_by = $N
        OR EXISTS (SELECT 1 FROM public.expert_grants eg
                   WHERE eg.expert_id = expert_bundles.id
                     AND ((eg.grantee_type = 'user' AND eg.grantee_id = $N_str)
                       OR (eg.grantee_type = 'role' AND eg.grantee_id = ANY($N_roles::text[]))))
  ))
)
```

⛔ **THE GRANT CHECK ONLY BITES FOR `visibility = 'granted'`.** An org Expert at `visibility='org'`
or `'public'` is visible to **every** org member no matter what grants exist. **A PACK-11 UAT row
that grants nothing and sets `visibility='org'` will show the card and look like a failure of the
criterion when it is a correct read of the data.** The honesty row must author the Expert with
`visibility='granted'`. `[MEASURED]`

### What drives it today, and what does not `[MEASURED]`

| Layer | Driven? | Where |
|---|---|---|
| **DB predicate**, no-grant user | ✅ **YES** — refutes the ROADMAP | `test_261_expert_grants_db.py:354-364` (live PG, **skips** without `:54322`) |
| `check_expert_grant_access` unit matrix | ✅ | `test_261_expert_grants_db.py:235-264` (mocked) — incl. *"Restricted bundle → False when no grant in DB"* |
| **API** `GET /experts` for a no-grant caller | ⛔ **NO** | `test_259_expert_entitlement_gate.py` drives only the **tier** 403/200 arms (`:30/65/101/133`); `grep -rn "list_expert_bundles_for_caller" backend/tests/unit/*.py` returns **one file only** |
| **Frontend** catalog honesty | ⛔ **NO** — the surface does not exist | — |

**So PACK-11's owed work is two rows, not a rewrite:** (1) an API-level test that a caller without
a grant does not receive a `visibility='granted'` bundle from `GET /experts`; (2) the frontend
vanish, and the G-4 lived-experience drive. ⭐ CONTEXT's `<specifics>` already names the right
real-data vehicle: `fhdmrd.dev@gmail.com` in org `22f9c615`.

### ⛔ PACK-13's seam is NOT the one D-262-08 names, and the correction matters `[MEASURED]`

`onSelectExpert` resolves to `handleSelectExpert` at **`MessageInput.tsx:159-172`**:

```tsx
const handleSelectExpert = async (expert: ExpertBundle) => {
  setInternalActiveExpert(expert)
  setInviteExpertOpen(false)
  if (onActiveExpertChange) onActiveExpertChange(expert)
  if (threadId) { try { await setThreadActiveExpert(threadId, expert.id) } catch (err) { … } }
}
```

It is **local to `MessageInput` and needs a `threadId`**. From `activeView === "experts"` neither
exists: `ChatLayout.launch.test.tsx:558-576` asserts `<ChatArea` and `<WorkspacePanel` appear
**only before** the non-chat `<main>` split point, with a positive control proving the probe works.
So the catalog cannot call that function.

⭐ **The reusable seam that DOES work is one register down and already shipped:
`ChatArea.tsx:234-252`** —

```tsx
useEffect(() => {
  const expertId = thread?.active_expert_id
  if (!expertId) { setActiveExpert(null); return }
  getExpert(expertId).then((exp) => { if (!cancelled) setActiveExpert(exp) })
}, [thread?.id, thread?.active_expert_id])
```

Chat hydrates its spotlight from `thread.active_expert_id`. So PACK-13 is: **create/choose a
thread → `setThreadActiveExpert(threadId, expert.id)` → `selectThread` → `onNavigate("chat")`**,
and ChatArea does the rest. That is the *same* mechanism `handleSelectExpert` uses, one layer
lower — so D-262-08's "never a second mechanism" holds; only its *name* for the seam was wrong.

⚠ **Two measured traps on that path:**
- `useThreads.newThread()` (`hooks/useThreads.ts:38-43`) returns the freshly-created `Thread`, whose
  `active_expert_id` is `null`. The effect above keys on `thread?.active_expert_id`, so setting the
  expert server-side **will not re-render chat** unless the local object is updated too. `useThreads`
  exposes `updateThreadTitle` and nothing else — there is no `active_expert_id` updater.
- ⭐ **The clean alternative is already in the file:** mirror `prefillMessage`. App owns
  `prefillMessage` + `setPrefillMessage` (`App.tsx:144, 358-359`), ChatLayout threads it
  (`:96-97, 817-818`), ChatArea consumes-and-clears (`:573-586`). A parallel one-shot `pendingExpert`
  handoff is byte-for-byte the same shape — **and `ChatLayout.tsx:252` already does exactly this for
  skills** (`onSetPrefillMessage(\`Use the ${skillName} skill\`)` + `onNavigate`).
  ⚠ Apply `libraryTabAfterNavigate`'s lesson (`App.tsx:178-190`): a one-shot handoff **must be
  cleared by the navigator**, or it re-fires on every later entry into chat — that exact defect
  shipped at 235-08 and needed a gap-closure round.

---

## 7 · Gates, ledger triples, and knob coverage

### 7a · Gates, measured now, on a quiet tree

`git status --short` → only `.planning/phases/236-…/236-ROSTER-REPORT.md` modified, plus untracked
`scratch/` and `screenshots/`. **`git diff --stat HEAD -- frontend/` is EMPTY** — the frontend tree
is byte-identical to `6d18202b4`.

**(1) Frontend count gate — ⛔ RED AT BASE.** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`
from the repo root, verdict lines **verbatim**:

```
  total                                      7935    8676    +741
  total 8676  ·  failed 2  ·  pinned total 7935
--------------------------------------------------------------
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

| | CLAUDE.md's 2026-09-21 correction | **measured 2026-09-22** |
|---|---|---|
| grand total | 8500 | **8676** |
| pinned total | 7746 | **7935** |
| failed | 0 | ⛔ **2** |

⚠ **THE EIGHTH ROT, AND IT TOOK ONE DAY.** `+176` grand / `+189` pinned since yesterday. Five new
suites appeared in the gate's own `— N new` column (`PromptVariableChips` 3, `RunHero` 18,
`automationFacts` 11, `nodeEffectBanner` 8, `toolReadOnlyMap` 7 = **47**), which is growth, not drift.

**The two failures, captured from the gate's own persisted JSON before any re-run** (per CLAUDE.md's
triage rule), both in `frontend/src/components/library/__tests__/sketchComposition.test.tsx`
(pinned at **47**, in BOTH knobs — `vitest-count-gate.cjs:3446` and `:5228`):

1. `§2 positive controls › the page renders its heading — the mount harness works` — `STACK_TRACE_ERROR` (timeout)
2. `§2 positive controls › the four shipped tab triggers render — the tab bar is already built` —
   **`TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"`** — a REAL assertion, not a timeout

⭐ **INHERITED, established by measurement not by assumption:** the frontend diff against `HEAD` is
empty, so the suite and everything it mounts are byte-identical to the phase base.
⚠ Failure #2 matches the `LibraryHeaderBar.tsx` ledger row's recorded hazard (*"a hidden duplicate
broke 41 cases"*) and is **NOT** one of `SEED-171`'s five named flaky suites — treat it as a real
standing red, and **name it in the plan so a later run cannot mistake it for new**.

⛔ **Planning consequence:** `count gate OK` is **not reachable** at this base. A plan whose
acceptance criterion is *"the gate is green"* has written a criterion that cannot pass. Use
**per-file deltas + "no new failing filenames beyond `sketchComposition.test.tsx`"**.

**(2) Frontend typecheck.** `npx tsc -p tsconfig.app.json --noEmit` in `frontend/`:

```
70  (count of lines matching "error TS")
```

⚠ CLAUDE.md quotes **67** from Phase 239 — **now 70**. `npx tsc --noEmit` (no `-p`) still type-checks
**zero** files and exits 0 (`tsconfig.json` is `{"files": [], "references": […]}`). **Measure a set
diff against 70, never "zero errors".**

**(3) Backend unit baseline — ✅ GREEN, exactly at the ceiling.** `node scripts/check-backend-unit-baseline.cjs`,
verdict **verbatim**:

```
Summary:        71 failed, 5490 passed, 2 xfailed, 2 xpassed, 48 warnings in 284.70s (0:04:44)
Failed tests:   71 (allowed ceiling: <= 71)
Passed tests:   5490
Errors:         0 (allowed: 0)

[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

⚠ **Zero headroom — literally.** `71 == 71`. One new backend failure breaks the gate. This phase is
expected to touch **zero** backend files (§4), so treat this as a pre-flight observation rather than a
per-task gate; but if anything backend-side is added, the margin is *nil*.
⚠ CLAUDE.md's baseline line quotes `71 failed, **3497** passed` — the **passed** figure has rotted to
**5490**. The *ceiling* (71) is what the gate enforces and it still holds; the passed count is
descriptive and stale.

⛔ **AND A HARNESS TRAP WORTH NOT REDISCOVERING.** A naive
`source venv/Scripts/activate && python -m pytest …` under Git Bash **does not activate this venv** —
that route reported `96 failed … 3 errors in 317.82s` with collection errors in
`test_connector_credential_boundary.py`, `test_dxf_takeoff_extractor.py`,
`test_per_format_ingestion.py`. Re-running those same three files with the venv interpreter
explicitly (`backend/venv/Scripts/python.exe -m pytest …`) gives **`1 failed, 64 passed`, zero
collection errors**. **The `96 / 3 errors` figure is an artefact of the wrong interpreter and must
never be quoted.** Always use `node scripts/check-backend-unit-baseline.cjs`, which resolves
`backend/venv/Scripts/pytest.exe` directly (`:84`).

**(4) `node scripts/check-hot-file-ledger.cjs 262`** → `FATAL: no *-PLAN.md in …` , **exit 2**
(harness error, not a failure). Expected — re-run once PLAN.md files exist. Driven against the
candidate file set instead:

```
node scripts/check-hot-file-ledger.cjs --files <the 12 files below>
  scan list: 321 rows · subject: 12 files · watched: 12
ledger gate OK — every watched file has a row.
```

**All twelve candidate files already have rows.** `[MEASURED]`

**(5) `node scripts/check-claude-md-size.cjs`** → exit **0**:

```
CLAUDE.md   116991 chars   78% of limit   headroom 33009   [OK]
```

⚠ **Headroom to the 120,000 WARN BAND is only 3,009 chars.** D-262-01 mandates a CLAUDE.md edit
(the IA-contract correction) *plus* ledger-row updates. **Keep both terse** — a ledger disposition
cell is hard-capped at 200 chars by this same gate.

**(6) `node scripts/check-seeds-register.cjs`** → exit 0:

```
register: 310 files · parsed: 310 · skipped: 0 · duplicate ids: 0
unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger
seeds register gate OK
```

⚠ Re-run `--phase 262` **after** PLAN.md files exist. `SEED-303`'s `trigger_paths` explicitly names
`InviteExpertDialog.tsx`, `ExpertSpotlightCard.tsx` and `lib/api/experts.ts` — **it will fire**, and
its `status` is `partially-answered` with S8 (clone) and S3 (two Experts) still open. `SEED-185`
(`status: planted`, no router) fires on `frontend/src/**` breadth.

### 7b · Ledger triples — re-derived 2026-09-22 with the CLAUDE.md recipe

Six-digit dated-quick-task buckets excluded, as the recipe requires.

| File | **measured now** | CLAUDE.md / ledger row says | G-5 | Row present? |
|---|---|---|---|---|
| `frontend/src/App.tsx` | **33 / 24 / 378** | `32 / 23 / 374` | ⛔ **FIRES** | ✅ |
| `frontend/src/components/layout/ChatLayout.tsx` | **52 / 27 / 1014** | `51 / 26 / 1010` | ⛔ **FIRES** | ✅ |
| `frontend/src/components/layout/NavPanel.tsx` | **24 / 13 / 417** | `23 / 12 / 381` (ledger) / `…/417` (CLAUDE.md) ⚠ the two registers already disagree on LINES | ⛔ **FIRES** | ✅ |
| `frontend/src/lib/nav-items.ts` | **9 / 6 / 118** | `8 / 6 / 95` | ⛔ **FIRES** | ✅ |
| `frontend/src/components/chat/MessageInput.tsx` | **35 / 17 / 942** | `34 / 17 / 942` | ⛔ **FIRES** | ✅ |
| `frontend/src/components/chat/ChatArea.tsx` | **77 / 38 / 882** | `77 / 38 / 882` ✅ the one that held | ⛔ **FIRES** | ✅ |
| `frontend/src/types/index.ts` | **90 / 70 / 1434** | `85 / 65 / 1380` | ⛔ **FIRES** | ✅ |
| `frontend/src/lib/api/experts.ts` | **6 / 3 / 313** | `5 / 3 / 298` | ⛔ **FIRES (3 phases)** | ✅ |
| `frontend/src/components/chat/InviteExpertDialog.tsx` | **1 / 1 / 217** | `0 / 0 / 0` "young (created 260)" | no (1 phase) | ✅ |
| `frontend/src/components/chat/ExpertSpotlightCard.tsx` | **1 / 1 / 202** | `0 / 0 / 0` | no (1 phase) | ✅ |
| `frontend/src/components/chat/ActiveExpertChip.tsx` | **1 / 1 / 50** | `0 / 0 / 0` | no (1 phase) | ✅ |
| `frontend/src/components/org/OrgExpertsTab.tsx` | **1 / 1 / 346** | `1 / 1 / 347` | no (1 phase) | ✅ |
| `frontend/src/components/experts/ExpertAuthoringStudio.tsx` | **3 / 2 / 1550**¹ | `3 / 2 / 1475` | no (2 phases) | ✅ |

¹ from the CLAUDE.md scan table, which was updated at 263.

**Eight of thirteen FIRE G-5, and this phase's core triad is four of them (`App.tsx`,
`ChatLayout.tsx`, `NavPanel.tsx`, `nav-items.ts`).** ⭐ **Every one is "honoured by construction"
material, not a refactor trigger** — the edits are literally `+1 union member`, `+1 branch`,
`+1 array entry`, `+1 prop` — but G-5 requires that to be *stated and justified per file*, in the
ledger row and in the plan, not assumed. ⚠ No file here has a *missing* row (the gate confirms), so
there is no invisible-to-its-own-guardrail case this time.

⚠ **Every single triple except `ChatArea.tsx` was STALE.** Re-derive again at the phase close; the
ledger's own recurring finding is that a figure written at a close goes stale on the next commit.

### 7c · Which TARGETS knob covers these files — **the honest answer is "barely" `[MEASURED]`**

`scripts/vitest-count-gate.cjs` has two knobs: `BASELINE` (`:122-4300`, per-file case pins) and
`TARGETS` (`:4304-5713`, ~216 entries). **TARGETS decides what RUNS; BASELINE decides what is
GUARDED.**

**There are only TWO bare-directory entries in the whole array: `"src/landing"` and
`"src/components/workflows"`.** Everything else is file-by-file. And the script says so
deliberately, `:4859-4866`:

> *"FILE-LEVEL, deliberately NOT the bare directories `src/components/chat`,
> `src/components/panel/__tests__`, `src/lib/__tests__` or `src/__tests__` — the same reasoning this
> script already records for the panel directory, `src/lib`, `src/pages`, **`src/components/layout`**,
> `src/components/settings` … Verified with `grep -n '"src/components/chat"'` returning nothing."*

Confirmed independently: `grep -nE '"src/components/(chat|layout)"'` returns **no entry**, only that
comment.

| Suite | In TARGETS? | In BASELINE? |
|---|---|---|
| `components/layout/__tests__/ChatLayout.fallback.test.tsx` | ✅ `:5240` | ✅ pinned **4** (`:3458`) |
| `components/layout/__tests__/NavPanel.test.tsx` | ✅ (last entry) | ✅ |
| `components/layout/ChatLayout.launch.test.tsx` | ✅ | ✅ |
| `__tests__/library/renameFence.test.ts` | ✅ | ✅ |
| `pages/__tests__/LibraryPage.initialTab.test.tsx` | ✅ | ✅ |
| `components/chat/__tests__/ComposerExpert.test.tsx` | ✅ | ✅ pinned **5** (`:166`) |
| `components/chat/__tests__/ExpertSpotlightCard.test.tsx` | ✅ | ✅ pinned **5** (`:167`) |
| `components/experts/__tests__/OrgExpertsTab.test.tsx` | ✅ | ✅ pinned **5** |
| `components/experts/__tests__/ExpertAuthoringStudio.test.tsx` | ✅ | ✅ pinned **23** |
| ⛔ `lib/nav-items.test.ts` | ⛔ **NO** (`grep -c` → 0) | ⛔ **NO** |
| ⛔ `lib/__tests__/navItemsConnections.test.ts` | ⛔ **NO** (`grep -c` → 0) | ⛔ **NO** |
| ✅ `lib/__tests__/navItemsUnknownIsNotDenied.test.ts` | ✅ | ✅ |

⛔ **`nav-items.ts` FIRES G-5 at 6 phases and TWO of its three suites run in NEITHER knob** — the
D-07 non-discoverability lock and the connections-reachability pin are both invisible to the gate.
That is verbatim Phase 263's Control-Room finding, one directory over. **This phase should adopt
both in the same commit as its `NAV_ITEMS` edit** (adopting a suite raises the total — that is the
desirable direction and must not be read as drift).

⛔ **A new catalog directory will be in NEITHER knob.** `src/components/experts/__tests__/` is
covered **only** by the two explicit file entries above; there is no directory entry. A new suite
must be added to **both** `TARGETS` and `BASELINE` **in the same commit that creates it** — the
script's own comment at `:184-187` records exactly this trap firing at Phase 262's *other* work:

> *"⚠ ADOPTED, not raised. 262 added this suite to TARGETS and to NEITHER baseline, so it [hit] the
> trap the TARGETS comment four lines above its own entry warns about, fired in the commit that
> wrote the warning."*

---

## 8 · Pitfalls

### P-1 ⛔ The positional-fallback trap — still real, with a corrected consequence
A 13th `ActiveView` member with no branch does **not** render Knowledge Health (R-1); it renders
`UnknownViewFallback`'s *"This view has no screen: experts"*. **Nothing red-flags it** (R-2): not
`tsc` (`as never` is always a legal assertion), not `ChatLayout.fallback.test.tsx`, not
`renameFence.test.ts`. The branch must ship in the **same commit** as the member, between
`ChatLayout.tsx:980` and `:981`.

### P-2 ⛔ A code measurement must not be satisfiable by a comment (D-262-04)
`App.tsx:96-99` records the rule; Phase 264's wave 3 hit it three times. **Do not spell the new
`ActiveView` literal in any new comment in `App.tsx`.** Prefer AST over `grep -c`. ⚠ Note the
*existing* stale prose at `App.tsx:103-105` (R-1) needs correcting — do that by editing the
*existing* comment, not by adding a new one that repeats the member name.

### P-3 ⛔ `App.tsx:171`'s `NO TWELFTH` comment is a FENCE'S NON-VACUITY TOKEN — deleting it reds an unrelated suite
D-262-03 says "do not delete it". **Here is the measured reason it did not have.**
`frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx:502-503`:

```tsx
expect(APP).toContain("NO TWELFTH")
expect(APP_CODE).not.toContain("NO TWELFTH")
```

That pair is the comment-stripper's **non-vacuity control** — the thing that reds if `codeOf`
starts returning `""` and silently turns every `not.toContain` arm green. **Delete the comment and
that suite goes red for a reason that has nothing to do with it.** It is in both knobs. `[MEASURED]`

⚠ Bonus correction in the same file: its `setLibraryTab` case asserts
`expect(writes.length).toBeGreaterThanOrEqual(2)` (`:516`), while the CLAUDE.md ledger row claims
`App.tsx` was *"driven RED against a planted 3rd writer"*. A third writer would **pass** that
assertion. Not this phase's business; worth a line beside the original.

### P-4 ⛔ Both gates are RED at base — write a SET DIFF criterion, never an absolute
Count gate: `failed 2`, both in `sketchComposition.test.tsx` (inherited, proven by an empty
`git diff --stat HEAD -- frontend/`). Typecheck: `70` errors on `tsconfig.app.json`. A plan that
writes *"count gate OK"* or *"zero tsc errors"* has written a criterion that cannot pass. §7a has
the exact numbers to diff against.

### P-5 ⛔ `example_output` is rendered by NOTHING today — PACK-12's hardest half has no precedent
R-3. `when_to_use`/`category`/`icon` can be copied from `OrgExpertsTab`. `example_output` cannot.
And D-262-05 forbids a `data-testid` presence assertion: **assert the rendered CONTENT**, because
*"the content here was never rendered at all"* (`262-RECORD.md`).

### P-6 ⛔ A knowledge-folder id can legitimately fail to resolve, and the ONE system Expert proves it
The seeded folder `…-260` belongs to org `430bffc6-…` (`mig 188:29-37`). Any other org resolves
nothing. The modal needs a third state naming the fact — never a blank, never a silent drop.
"Unknown" is not "none" (`nav-items.ts:104-117`).

### P-7 ⛔ Retiring `DEFAULT_FINANCIAL_TILES` turns a PINNED suite RED — that is the readymade RED, and the pin is a FLOOR
`ExpertSpotlightCard.test.tsx:47-69` asserts all three fallback tiles **verbatim**
(`"Q3 Revenue Growth YoY"`, `"Gross Margin Comparison"`, `"Operating Cash Flow"`) against a fixture
with `prompt_suggestions: []` (`:6-19`). `:22-45` additionally asserts the two *other* hardcoded
strings, `"SEC Filings & Reports"` and `"ratio_calculator"` (R-7). **D-262-06's retirement must
REWRITE these cases with the original reason preserved** (`SEED-177` / precedent `D-206-07`), and
the file must end at **≥ 5 cases** — the gate's contract is *no per-file DECREASE* and its pin is 5.
`ComposerExpert.test.tsx` (also pinned 5) touches the icon indirectly via
`expert-card-financial-analyzer` testids — check it before editing `InviteExpertDialog`.

### P-8 ⛔ PACK-13 cannot call the seam D-262-08 names — see §6. Plan the handoff, don't discover it
The `prefillMessage` mirror (`App.tsx:144/358-359` → `ChatLayout.tsx:96-97/817-818` →
`ChatArea.tsx:573-586`) is the shipped shape, and `ChatLayout.tsx:252` already uses it for a
skill→chat handoff. ⚠ Apply `libraryTabAfterNavigate`'s one-shot clearing lesson
(`App.tsx:178-190`) or it re-fires on every later entry into chat.

### P-9 ⚠ The composer entry needs a prop chain through THREE G-5-firing files
`ChatLayout.tsx` → `ChatArea.tsx` → `MessageInput.tsx`. The `onOpenConnections` precedent
(`ChatLayout.tsx:828`, `ChatArea.tsx:36/58/540`, `MessageInput.tsx:82/146/616`) makes each one a
one-line additive change. ✅ `ComposerExpert.test.tsx:48-63`'s *"ZERO new top-level controls"*
budget is **safe** — it counts `<button>`s in the toolbar, and a `DropdownMenuItem` is not one.
✅ `ComposerExpert.test.tsx`'s `@/lib/api` mock uses `{...await vi.importActual(...)}` (`:8-15`), so
D-262-07's "no new client function" keeps the 196-08 mock-factory failure class out of reach.

### P-10 ⚠ `ChatLayout.launch.test.tsx`'s positional fences — safe, but know why
`:547-556` requires `activeView === "workflow-run"` to precede `<UnknownViewFallback`; `:558-576`
requires the tokens `<ChatArea` and `<WorkspacePanel` to appear **only** before
`<main className="flex-1 overflow-hidden">`. Inserting at `:980` satisfies both. ⛔ Do not name a
new component `<ChatArea…>`-prefixed, and do not write those two tag tokens in any new comment in
`ChatLayout.tsx` (its own `:962-965` records that trap).

### P-11 ⚠ `renameFence.test.ts` reads `App.tsx?raw` and greps prose non-vacuity tokens too
`:121-127` asserts `APP` contains `"the three-homes contract holds"` and `APP_CODE` does not.
⛔ **D-262-01 mandates changing the three-homes contract language — that exact string lives at
`App.tsx:100` and is a fence needle.** Change the *surrounding* prose, leave that substring intact,
or update the fence in the same commit with the reason written down.

### P-12 ⚠ `subscription_tier` gates the whole surface, and a NULL tier fails closed
`mig 186:72` grants `experts` to **enterprise only**; `db/entitlements.py:152-156` refuses a NULL
tier. Verify the dev/UAT org's tier **before** the G-4 drive, or the catalog 403s and reads as a
build defect. `[MEASURED from migration + code; live org rows UNVERIFIED in this session]`

### P-13 ⚠ CLAUDE.md headroom is 3,009 chars to the warn band
D-262-01 requires a CLAUDE.md edit and this phase requires ledger-row updates. Ledger disposition
cells are hard-capped at **200 chars**. Put verdicts in CLAUDE.md, reasons in
`docs/HOT-FILE-LEDGER.md`, same commit.

---

## 9 · Open questions for planning

1. **D-262-09's decision, restated correctly.** Given `experts` is a *tier* capability with no
   frontend read path, does the nav entry stay ungoverned (recommended, §5) — or does the phase
   spend a `GovernedFeature` widening (3 files) on an axis that will not prevent the 403 anyway?
2. **Does D-262-02's no-upsell rule extend to the shipped `upgrade_hint` error string?**
   `InviteExpertDialog` renders it today (§5).
3. **PACK-13's handoff shape** — `prefillMessage` mirror (recommended) vs. `useThreads` gaining an
   `active_expert_id` updater. Both are ~1 plan; only the first has a shipped precedent.
4. **`example_output`'s presentation** — the sketch calls it a *"collapsible preview showing a
   representative Markdown table"*. It is a free-text column with no renderer anywhere; whether it
   goes through the existing markdown renderer is a G-2-adjacent call the sketch does not settle.

---

*Researched 2026-09-22 against `6d18202b4` (develop). Every figure in §7 is re-derivable with the
command quoted beside it; none was copied from another register.*
