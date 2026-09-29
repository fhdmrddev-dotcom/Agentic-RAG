---
phase: 263-an-expert-can-be-given-its-capabilities
reviewed: 2026-09-22T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - backend/app/api/experts.py
  - backend/app/db/experts.py
  - backend/app/models/expert.py
  - backend/app/services/expert_authoring.py
  - backend/app/services/expert_service.py
  - backend/app/services/skill_body_authoring.py
  - frontend/src/components/experts/ExpertAuthoringStudio.tsx
  - frontend/src/components/experts/ProposedSkillCard.tsx
  - frontend/src/components/skills/SkillFormDialog.tsx
  - frontend/src/lib/api/experts.ts
  - supabase/migrations/191_skill_expert_provenance.sql
  - scripts/vitest-count-gate.cjs
  - backend/tests/unit/test_263_craft_block_is_read.py
  - backend/tests/unit/test_263_draft_skill_body_route.py
  - backend/tests/unit/test_263_drafter_output_fits_its_consumers.py
  - backend/tests/unit/test_263_expert_born_skill_resolution.py
  - backend/tests/unit/test_263_expert_draft_suggested_skills.py
  - backend/tests/unit/test_263_expert_save_refuses_unknown_skills.py
  - backend/tests/unit/test_seed125_skill_visibility_filter.py
  - backend/tests/unit/test_259_closed_core_inventory.py
  - backend/tests/integration/test_263_craft_block_live_read.py
  - backend/tests/integration/test_263_skill_org_stamp_live.py
  - frontend/src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx
  - frontend/src/components/experts/__tests__/OrgExpertsTab.test.tsx
  - frontend/src/components/skills/SkillFormDialog.test.tsx
findings:
  critical: 3
  warning: 9
  info: 6
  total: 18
status: issues_found
---

# Phase 263: Code Review Report

**Reviewed:** 2026-09-22
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

The Phase 263 work is unusually well fenced. The four things this project has historically
got wrong — the 422-above-the-try placement, the `None == None` trap, the org fence sitting
structurally above the new provenance arm, and a suite adopted into only one knob of the
count gate — are all **correct here, and driven rather than asserted**. The verified list
below names each one with the line that makes it true.

The headline finding is not a coding slip; it is a **seam between two visibility predicates
that the phase deliberately left asymmetric**. `filter_visible_skill_names` now admits a
born-for skill at *resolve* time, but the agent's `load_skill` path still resolves skills
through `build_skill_visibility_or`, which knows nothing about the new column. So for every
org member but the author, the Expert's catalog advertises a capability the agent then
cannot load. That is the *same* "second hollowness" D-263-06 set out to close, one layer
down, and R-7 of the UAT could not see it because it drove the predicate directly rather
than a real run.

Two further Critical items are **inherited from Phase 261** (commit `0dd31f2c5`, before this
review's diff base) but live in a reviewed file and are genuine authorization gaps: the
`POST /experts/draft` asset queries are not scoped the way every other folder/skill read in
this codebase is scoped.

Everything else is bounded: PATCH-vs-POST validation asymmetry, a silently-discarded `slug`,
fail-open grant revocation, an honesty banner that states a fact it cannot know, and one
suite in TARGETS-but-not-BASELINE that the file's own comment warns about four lines above.

---

## Verified (checked against the code, and CORRECT)

1. **422 sits ABOVE the `try`.** `backend/app/api/experts.py:147` is the
   `await _refuse_unknown_member_skills(...)` call; the bare `except Exception` `try:` opens
   at `:156`. `update_expert` has no try at all (`:460`). The placement is asserted
   mechanically, not by eye, at `test_263_expert_save_refuses_unknown_skills.py:262-280`.
2. **The client discriminates on `detail.error`, never the bare status.**
   `frontend/src/lib/api/experts.ts:201` returns early unless `res.status === 422`, then
   `:203` requires `d?.error === "expert_member_skills_unknown"`; `readRefusalDetail:131`
   rejects an `Array` body outright, so FastAPI's own LIST-bodied 422 falls through to
   `handleResponse`'s array arm at `:151`. `res.clone()` at `:129` leaves the body readable.
   Driven at `test_263_expert_save_refuses_unknown_skills.py:237-249`.
3. **The `bundle_id is not None` guard is present and load-bearing.**
   `backend/app/services/expert_service.py:342`:
   `or (bundle_id is not None and s_born_for == bundle_id)`. Driven directly against the
   save-time call shape at `test_263_expert_born_skill_resolution.py:297-332`.
4. **The born-for disjunct is INSIDE the org fence, structurally.**
   `expert_service.py:336-344` — `s_org_id == caller_org_id and s_enabled and ( … )`. The
   maximally-privileged foreign row (`born_for == this bundle` AND `is_org_shared = True`)
   is driven stripped at `test_263_expert_born_skill_resolution.py:191-233`, and the
   agent-side predicate is proven byte-unchanged at
   `test_seed125_skill_visibility_filter.py:93-123`.
5. **The stamp's three narrowing predicates are all present**
   (`db/experts.py:442-446`: `org_id = $3`, `user_id = $4`,
   `born_for_expert_bundle_id IS NULL`) and each is asserted individually, with a negative
   arm proving no runtime value is f-string-interpolated into the SQL
   (`test_263_expert_born_skill_resolution.py:413-415`).
6. **Migration 191's ACL claim is TRUE, and I checked rather than took it.**
   `grep -nE 'GRANT [A-Z]+ ?\('` finds column-scoped grants **only** on
   `connector_connections` (`scripts/full-schema-supplement.sql:322,353-361,400`) — none on
   `public.skills` — so the new column inherits the table-level grant and the
   `connector_connections` column-grant trap does not apply here.
   `node scripts/check-schema-acl-parity.cjs` exits **OK** (155/155 mirrored). All four
   `public.skills` RLS policies are row-scoped (`full-schema.sql:6453,6586,6712,6800`) and
   cover the new column on existence. The FK is `ON DELETE SET NULL`
   (`191_skill_expert_provenance.sql:11`), so deleting an Expert narrows its skills back
   rather than orphaning a grant. `supabase/full-schema.sql` carries the column (6
   occurrences), regenerated at `9c01c74e9` — greenfield parity holds.
7. **The count gate is correct in BOTH knobs for this phase's adoption.**
   `scripts/vitest-count-gate.cjs:179` (BASELINE `"SkillFormDialog.test.tsx": 13`) and
   `:4346` (TARGETS `src/components/skills/SkillFormDialog.test.tsx`). Counts match the
   files: 13 / 14 / 5 measured against `SkillFormDialog.test.tsx`,
   `ExpertAuthoringStudio.test.tsx`, `OrgExpertsTab.test.tsx`. The diff over
   `7526126d9^..HEAD` is purely additive apart from the intended `4 → 14` raise — **no
   pinned entry was lowered or dropped.**
8. **The `SkillFormDialog` reset hazard is closed at the only production call site.**
   The sole non-test consumer is `ExpertAuthoringStudio.tsx:1465`, passing
   `skillDialogInitial`, which is React state (`:167`) and not a render-time literal. The
   effect's dep array (`SkillFormDialog.tsx:344`) therefore fires only when a new proposal
   is opened. `SkillsPage.tsx` imports `SkillDetailPanel`, not the dialog.
9. **The BUG-260921-02 producer→consumer caps agree, field by field**, checked against the
   models rather than against the test's say-so: `description` 8000 → 8000
   (`ExpertBundleBase`) and 8000 (`SkillBodyDraftRequest.expert_description`);
   `example_output` 4000 → 4000; `when_to_use` 240 → 500; `name` 120 → 120; `slug` 120 →
   120; `category` 60 → 64; `SuggestedNewSkill.name` 80 → 120; `.description` 240 → 1000;
   `.why_needed` 2000 → 2000. One pair is still missing from the table — see WR-01.
10. **EXT-01 red line intact.** `_TOOL_REGISTRY` pinned at 29 with named-key negative arms
    (`test_259_closed_core_inventory.py:39-46, 89-101`); `skill_body_authoring.py` contains
    no write statement and the fence proves it by source scan (`:291-297`).
11. **No SQL injection.** Every runtime value is a numbered parameter; the one dynamic SET
    clause (`db/experts.py:379-396`) is built from the `allowed_fields` whitelist at
    `:362-377`, never from caller-supplied keys.
12. **No XSS surface.** `grep -rn dangerouslySetInnerHTML` over
    `frontend/src/components/experts/` and `SkillFormDialog.tsx` → **0**. Model-supplied
    text is rendered as React children (`ProposedSkillCard.tsx:57-60`,
    `ExpertAuthoringStudio.tsx:1285-1291`). Prompt-injection boundaries are real and
    delimiter-quoted (`skill_body_authoring.py:89-94, 250-266`).

---

## Critical Issues

### CR-01: The born-for skill is advertised to every org member and loadable by none of them — the "second hollowness" is closed at resolve time and still open at load time

**File:** `backend/app/services/expert_service.py:342` → `backend/app/services/run_producer.py:487-492` → `backend/app/services/tool_dispatcher.py:1315-1325`

**Issue:**
`filter_visible_skill_names` now admits a born-for skill for any org member:

```python
# expert_service.py:336-344
elif (
    s_org_id == caller_org_id
    and s_enabled
    and (
        s_user_id == caller_user_id
        or s_shared
        or (bundle_id is not None and s_born_for == bundle_id)
    )
):
```

That result becomes the **catalog only**:

```python
# run_producer.py:487-492
skill_catalog_override = None
if resolved.effective_skills:
    skill_catalog_override = tuple(
        {"name": s, "description": f"Expert member skill: {s}"}
        for s in resolved.effective_skills
    )
```

The instruction **body** is fetched later by the `load_skill` tool, through a completely
different predicate that does not know the new column exists:

```python
# tool_dispatcher.py:1315-1321
_skill_filter = await _resolve_skill_visibility_or(ctx)     # build_skill_visibility_or
_skill_resp = await aexec(
    ctx.supabase.table("skills")
    .select("id, name, description, instructions, user_id")
    .or_(_skill_filter)                # is_system OR (org_id ∈ orgs AND (owner OR is_org_shared))
    .eq("name", skill_name)
```

The phase's own suite records the asymmetry as deliberate and safe
(`test_seed125_skill_visibility_filter.py:126-142`: *"the Expert resolver DOES admit this
row … The two predicates may differ ONLY in this direction"*). It is safe — and it is also
why the feature does not deliver.

**Failure scenario (the default path, not an edge case):**
1. Author A (org-admin, org X) authors Expert *Doctoral LR Methodologist*, visibility `org`.
2. A approves the proposal `search-strategy-builder`. `POST /skills` hard-sets
   `is_org_shared = False` (`api/skills.py:250`), so the row is **private to A**.
3. The Expert save stamps `born_for_expert_bundle_id = <bundle>` (`db/experts.py:438-449`).
4. Member B (org X, not the author) opens a thread with that Expert active.
5. `resolve_expert_bundle` returns `effective_skills = ["search-strategy-builder"]` — the
   new arm fires. `stripped_members_count = 0`. B's system prompt lists the skill.
6. The model calls `load_skill("search-strategy-builder")`. The `.or_()` filter is
   `is_system OR (org_id ∈ {X} AND (user_id = B OR is_org_shared))` → **no row**.
7. B's run emits `skill_activated`, then falls into the miss branch at
   `tool_dispatcher.py:1326` and returns an error listing the loadable names — which
   excludes the one the catalog just promised. The Expert runs without the capability.

Exactly the outcome `263-CONTEXT.md` calls *"a second hollowness, at run time, for everyone
else"*. UAT R-7 drove `filter_visible_skill_names` in isolation and therefore could not see
step 6; no test in this phase drives `load_skill` for a non-author caller.

**Fix:** the load path must consult the same provenance the resolve path does. The narrow
option — and the one that keeps `skill_visibility.py` byte-unchanged for the agent loop and
workflow grounding, as D-263-06 requires — is to pass the resolved bundle id down into
`ToolContext` and add an Expert-scoped disjunct **only when a bundle is active**:

```python
# tool_dispatcher._resolve_skill_visibility_or — sketch, not a drop-in
org_ids = await _resolve_caller_org_ids(ctx.supabase, ctx.current_user["id"])
base = build_skill_visibility_or(ctx.current_user["id"], org_ids)
if ctx.active_expert_bundle_id:          # set by run_producer alongside skill_catalog_override
    base += (
        f",and(org_id.in.({','.join(sorted(org_ids))}),"
        f"born_for_expert_bundle_id.eq.{coerce_uid(ctx.active_expert_bundle_id)})"
    )
return base
```

⛔ The org gate must stay wrapped around the new disjunct exactly as it is around the
existing one, and the arm must be **absent** (not merely false) when no Expert is active —
otherwise this is the SEED-125 shape again on the agent axis. Drive it RED against a
top-level placement, the way `263-01` drove the resolver arm.

Whatever the fix, **add a test that drives `load_skill` as a non-author org member** — the
absence of one is why a green phase shipped a hollow Expert.

---

### CR-02: `POST /experts/draft` discloses other organizations' shared folder names and ids

**File:** `backend/app/api/experts.py:232`

**Issue:**

```python
folder_rows = await pool.fetch(
    "SELECT id, name FROM public.folders WHERE org_id = $1 OR is_org_shared = true ORDER BY name ASC LIMIT 50;",
    org_id,
)
```

`is_org_shared` is **not** a global flag in this codebase. The canonical rule requires both
predicates — `backend/app/utils/folder_utils.py:181`:

```python
if f.get("is_org_shared") and str(f.get("org_id")) in caller_org_ids:
```

and `expert_service.resolve_expert_bundle:441` mirrors it
(`f_org_id == caller_org_id and (f_user_id == caller_user_id or f_shared)`). The draft query
is the only read in this file that drops the org predicate.

**Failure scenario:** Org B has a folder `Acme / Project Cobalt — M&A diligence` with
`is_org_shared = true`. A user in Org A with `experts:manage` calls `POST /experts/draft`.
That folder's **name is serialised into the LLM prompt** (`expert_authoring.py:346-347`) and
its **UUID is returned in `knowledge_folder_ids`** if the model selects it
(`ExpertDraftOutput.knowledge_folder_ids`). Resolve-time stripping later discards the id, so
this is disclosure rather than access — but it is the SEED-124 / D-165-04 class this project
has already paid for twice.

⚠ **INHERITED**, not introduced by Phase 263: `git log -S` attributes the line to
`0dd31f2c5` (Phase 261, 2026-09-20), which is an ancestor of this review's diff base. It is
reported because it is live in a reviewed file and nothing has closed it.

**Fix:**
```python
"SELECT id, name FROM public.folders "
"WHERE org_id = $1 AND (user_id = $2 OR is_org_shared = true) "
"ORDER BY name ASC LIMIT 50;"
```
(and pass `user_id`, which the handler already resolves at `:253` — move that resolution
above the query).

---

### CR-03: `POST /experts/draft` hands other org members' PRIVATE skills to the drafter

**File:** `backend/app/api/experts.py:238`

**Issue:**

```python
skill_rows = await pool.fetch(
    "SELECT name, description FROM public.skills WHERE (org_id = $1 OR is_system = true) AND is_enabled = true ORDER BY name ASC LIMIT 50;",
    org_id,
)
```

There is no `user_id = <caller> OR is_org_shared` arm. Every other skill read in the
codebase has one — `expert_service.filter_visible_skill_names:336-344`,
`app/utils/skill_visibility.build_skill_visibility_or`, and the RLS SELECT policy itself
(`full-schema.sql:6800`: `is_system OR (org_id ∈ … AND (auth.uid() = user_id OR
is_org_shared))`). This query runs on the asyncpg pool, which bypasses RLS.

**Failure scenario:** User A's private skill `board-comp-benchmarks` (`is_org_shared =
false`, never through the publish gate) is in org X. User B, also org X with
`experts:manage`, drafts an Expert. A's skill **name and description are placed verbatim in
B's provider prompt** (`expert_authoring.py:350-351`), and item 11 of the system prompt tells
the model to *"Select all matching skill names from the provided available skills"* — so the
name can land in the returned `member_skills` and render as a `⚡ board-comp-benchmarks` pill
in B's studio (`ExpertAuthoringStudio.tsx:923`). B never had read access to that row.

This also produces a confusing second-order effect introduced by *this* phase: B saves, and
the new PACK-16 fence refuses with
`"1 of this Expert's capabilities do not exist in your library: board-comp-benchmarks."` —
a sentence that is false (it exists; B just cannot see it) about a name B should not have
been shown.

⚠ **INHERITED** from the same Phase 261 commit `0dd31f2c5`. Reported because Phase 263 built
the save-time refusal directly on top of it.

**Fix:** scope the query the way the rest of the codebase does, and prefer reusing the
predicate rather than restating it:
```python
"SELECT name, description FROM public.skills "
"WHERE is_enabled = true "
"  AND (is_system = true OR (org_id = $1 AND (user_id = $2 OR is_org_shared = true))) "
"ORDER BY name ASC LIMIT 50;"
```

---

## Warnings

### WR-01: `icon` is the one remaining unbounded-producer → bounded-consumer pair, and the fence written for exactly this class cannot see it

**File:** `backend/app/services/expert_authoring.py:63` · `backend/app/models/expert.py:51` ·
`backend/tests/unit/test_263_drafter_output_fits_its_consumers.py:52-65`

**Issue:** BUG-260921-02's fix bounded `description`, `example_output` and `why_needed`. It
did not bound `icon`:

```python
# expert_authoring.py:63 — producer, NO max_length
icon: str = Field(..., description="Lucide vector glyph name (one of: book, scale, chart, …)")
```
```python
# models/expert.py:51 — consumer, capped
icon: str = Field(default="chart", max_length=64, description="Icon identifier for expert card")
```

`PRODUCER_CONSUMER_PAIRS` covers `name`, `slug`, `category`, `when_to_use`,
`example_output`, `description` — **not `icon`**. `test_producer_field_is_bounded` is the
assertion that would fire, and it never runs for this field.

**Failure scenario:** a weaker model answers the enumerated-glyph instruction with
`"file-text (Document / General — best fit for a generic knowledge worker persona)"` (71
chars). `POST /experts/draft` returns 200 (producer unbounded); `POST /experts` then returns
a FastAPI **LIST-bodied** 422 `string_too_long`, which `throwIfMemberSkillsUnknown` correctly
ignores and `handleResponse` renders as `"String should have at most 64 characters, …"` —
the app again refusing to save the Expert its own AI wrote. The fence's docstring names this
exact shape.

**Fix:** add the constraint and the row, in the same commit.
```python
# expert_authoring.py
icon: str = Field(..., max_length=64, description="Lucide vector glyph name (one of: …)")
```
```python
# test_263_drafter_output_fits_its_consumers.py — PRODUCER_CONSUMER_PAIRS
(ExpertDraftOutput, "icon", ExpertBundleBase, "icon"),
```
Better still, derive the pair list from the intersection of the two models' field names so a
future field cannot be omitted by hand — the current table is a manual list, which is the
same "a register nobody re-derives" shape the fence's own docstring warns about.

---

### WR-02: `ExpertBundleUpdate` carries no constraints at all — every cap `ExpertBundleCreate` enforces is bypassable through PATCH, including a required non-empty name

**File:** `backend/app/models/expert.py:70-84` (vs `:48-64`) · `backend/app/db/experts.py:362-377`

**Issue:**

```python
class ExpertBundleUpdate(BaseModel):
    name: str | None = None          # ← no min_length, no max_length
    description: str | None = None   # ← create caps at 8000
    example_output: str | None = None
    when_to_use: str | None = None
    ...
```

`name` is `min_length=1, max_length=120` on create (`:49`) and completely unconstrained on
update. `update_expert_bundle`'s `allowed_fields` includes `"name"` (`db/experts.py:363`),
so the value persists.

**Failure scenario:** `PATCH /experts/{id} {"name": ""}` → 200, and the bundle now carries
an empty name. `ExpertAuthoringStudio.tsx:1408` guards `!name.trim()` client-side, so this
needs a direct call — but D-263-09's whole argument is that *"a stale client or a direct API
call walks straight past a UI-only check"*. The same call with a 200 KB `description`
succeeds where `POST` would 422.

**Fix:** mirror the create constraints on the optional fields:
```python
class ExpertBundleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=8000)
    example_output: str | None = Field(default=None, max_length=4000)
    when_to_use: str | None = Field(default=None, max_length=500)
    icon: str | None = Field(default=None, max_length=64)
    category: str | None = Field(default=None, max_length=64)
```
⚠ Keep `default=None` — `exclude_unset` in `update_expert_service:234` is what makes
"absent means unchanged" work, and a `Field(...)` without a default would break every
partial PATCH.

---

### WR-03: PATCH silently discards `slug` — the studio lets the author edit it and reports success

**File:** `frontend/src/components/experts/ExpertAuthoringStudio.tsx:426` ·
`backend/app/models/expert.py:70-84` · `backend/app/db/experts.py:362-377`

**Issue:** the edit payload sends `slug` (`ExpertAuthoringStudio.tsx:426`, and the client
type declares it at `lib/api/experts.ts:29`). The server model has no `slug` field, so
Pydantic drops it as an unknown extra; `update_expert_bundle`'s `allowed_fields` also omits
it, so even a re-added model field would `continue` at `db/experts.py:383`.

**Failure scenario:** an author opens an existing Expert, corrects
`finacial-analyzer` → `financial-analyzer` in the **Slug \*** input
(`ExpertAuthoringStudio.tsx:453-465`, enabled in edit mode), clicks *Update Expert*, gets a
success path (`onSaved` + `onClose`), and the slug is unchanged. `get_expert_by_slug_service`
keeps resolving the typo. Nothing anywhere reports the discard.

**Fix:** decide which it is, and make the code say so.
- If slug is immutable after creation: make the input `readOnly` in edit mode with a one-line
  reason beside it, and drop `slug` from the `ExpertBundleUpdate` TS interface so a future
  caller cannot send it.
- If it is mutable: add `slug: str | None = Field(default=None, min_length=1, max_length=120)`
  to `ExpertBundleUpdate` **and** `"slug"` to `allowed_fields`, and handle the
  `idx_expert_bundles_org_slug` unique violation as a named 409 rather than the generic
  400 arm.

---

### WR-04: grant revocation fails silently — the studio reports success after failing to remove access

**File:** `frontend/src/components/experts/ExpertAuthoringStudio.tsx:465, 469, 475`

**Issue:**
```tsx
const currentGrants = await getExpertGrants(saved.id).catch(() => [])
for (const cg of currentGrants) {
  if (!grants.some(...)) {
    await removeExpertGrant(saved.id, cg.id).catch(() => {})   // ← swallowed
  }
}
```

Two independent fail-open paths. If `getExpertGrants` fails, `currentGrants` is `[]`, the
removal loop body never executes, and every grant the author deleted in the UI **stays in the
database**. If the read succeeds but `removeExpertGrant` 500s, the `.catch(() => {})`
discards it. Either way `onSaved()` fires and the modal closes on a success path.

The additive direction fails *closed* (a dropped `addExpertGrant` just means less access), so
the asymmetry matters: only the security-relevant direction is silent.

**Failure scenario:** an org-admin removes a departed contractor's user grant from a
`granted`-visibility HR Expert and saves. The DELETE returns 500 (or the preceding GET does).
The UI shows the grant gone and the modal closes. The contractor still resolves the Expert.

**Fix:** collect failures and surface them instead of swallowing them — the save itself has
already succeeded, so this is a partial-success report, not a rollback:
```tsx
const grantErrors: string[] = []
for (const cg of currentGrants) {
  if (!grants.some(g => g.grantee_type === cg.grantee_type && g.grantee_id === cg.grantee_id)) {
    try { await removeExpertGrant(saved.id, cg.id) }
    catch { grantErrors.push(`could not revoke ${cg.grantee_type}:${cg.grantee_id}`) }
  }
}
// …and for the read:
let currentGrants: ExpertGrant[]
try { currentGrants = await getExpertGrants(saved.id) }
catch { grantErrors.push("could not read current grants — no revocation was applied"); currentGrants = [] }
if (grantErrors.length) { setSaveError(`Expert saved, but: ${grantErrors.join("; ")}`); return }
```

---

### WR-05: the honesty banner claims "Every capability in this blueprint exists" when the library was never read

**File:** `frontend/src/components/experts/ExpertAuthoringStudio.tsx:510-519, 905-907, 1273-1276`

**Issue:**
```tsx
const phantomMemberSkills = availableSkillsLoaded
  ? memberSkills.filter((n) => !availableSkills.some((s) => s.name === n))
  : []                                            // ← unread library ⇒ "nothing is phantom"
const resolvableSkillsCount = memberSkills.length - phantomMemberSkills.length
```

Not holding Save on a failed `listSkills()` is the right call and is documented at `:176-178`.
But the **positive arm of the banner still asserts a fact**:

```tsx
<b>Every capability in this blueprint exists.</b> {resolvableSkillsCount}{" "}
{…} skills, all resolvable by the member check at run time.
```

and the group heading at `:905-907` vouches for *"N skills this Expert can actually use"*
from the same unread snapshot.

**Failure scenario:** `listSkills()` rejects on mount (auth blip, 503).
`availableSkillsLoaded` stays `false`. The author drafts an Expert whose `member_skills`
contains three names that do not exist, and the surface designed to say *"they would be
stripped at run time — silently"* instead prints a green ✓ and *"3 skills, all resolvable by
the member check at run time."* The server's 422 is still the real fence, but this banner is
the phase's own honesty deliverable stating the exact opposite of the truth.

This is the project's recurring *presence-assertions-cannot-see-content-drift* shape inverted:
the fence is content-correct and its **input** is unknown.

**Fix:** make "unknown" a third rendered state rather than folding it into "clean".
```tsx
) : !availableSkillsLoaded ? (
  <span>
    <b>Your skill library could not be read.</b> This blueprint names{" "}
    {memberSkills.length} {memberSkills.length === 1 ? "capability" : "capabilities"} and
    none of them could be checked here — the server re-checks independently when you save.
  </span>
) : (
  <span><b>Every capability in this blueprint exists.</b> …</span>
)
```
and pin it with a case that mocks `listSkills` rejecting — no such case exists today.

---

### WR-06: `ModelAdvancedCapabilities.test.tsx` is in TARGETS with no BASELINE entry — it runs and guards nothing

**File:** `scripts/vitest-count-gate.cjs:5583-5591`

**Issue:** the entry was added with a comment that warns about this exact trap four lines
above it:

```js
// ⚠ NAMED, for the same reason the three above are: `src/components/admin/` has NO bare
// directory entry, so a suite added under it and not listed here RUNS NOWHERE …
"src/components/admin/__tests__/ModelAdvancedCapabilities.test.tsx",
```

`grep -n ModelAdvancedCapabilities scripts/vitest-count-gate.cjs` returns **exactly one
line — 5591, inside `TARGETS`** (the `BASELINE` object ends before `const TARGETS` at
`:4263`). TARGETS decides what RUNS; BASELINE decides what is GUARDED. This suite is on the
wrong side of exactly one knob, which is the condition the file documents in five separate
places.

**Failure scenario:** a future edit to `ModelAdvancedCapabilities.tsx` deletes two of its
cases, or a mock-factory drift makes four of them stop being collected. The gate's per-file
decrease check has no pinned number for this path, so the grand total drops and the verdict
line still reads `count gate OK`.

⚠ This is a Phase **262** addition inside this review's diff range, not 263's work.

**Fix:** pin it in the same commit style the file demands — read the number from the gate's
own `— N new` column on the run that first executes it, never hand-count `it(` literals:
```js
// ── Phase 262 ─────────────────────────────────────────────────────────────────
"ModelAdvancedCapabilities.test.tsx": <N from the gate's own actual column>,
```

---

### WR-07: UAT R-8's copy finding is NOT fixed — the Control Room still makes a claim UAT measured false

**File:** `frontend/src/components/admin/CapabilityGrid.tsx:86`

**Issue:** UAT R-8 measured that FLAG-01 gates **generation only** — manual `POST /skills`
returned 201 with the switch off. The operator-facing consequence line still reads:

```tsx
fallbackImpact: "No new skills can be saved until this is back on.",
```

I checked whether the finding was closed in code, as instructed: `grep -rn "No new skills can
be saved"` returns this one line, unchanged. The correct behaviour is already implemented in
`skill_body_authoring.py:312-322` and surfaced honestly in the studio
(`ExpertAuthoringStudio.tsx:336-339`, `lib/api/experts.ts:110-118`) — only the operator card
is wrong, and it is the surface on which an operator decides whether to flip the switch.

**Fix:**
```tsx
fallbackImpact: "AI drafting of skill instructions stops. Skills can still be created and written by hand.",
```
and pin the sentence in `CapabilityGrid`'s suite so the next behaviour change to FLAG-01
cannot silently re-falsify it.

---

### WR-08: the stamp claims ANY of the saver's unstamped skills, not only skills born from Expert authoring — so adding a long-standing private skill to an org-wide Expert silently widens it

**File:** `backend/app/db/experts.py:438-449` · `backend/app/services/expert_service.py:62-68, 246-253` ·
`supabase/migrations/191_skill_expert_provenance.sql:13-14`

**Issue:** the UPDATE's narrowing predicates are `org_id`, `user_id`, and
`born_for_expert_bundle_id IS NULL`. There is **no predicate tying the skill to this
authoring session**, so every unstamped skill of the saver's named anywhere in
`member_skills` is claimed — including rows created years earlier through `SkillsPage` and
deliberately never shared.

Migration 191's own `COMMENT ON COLUMN` states the opposite:

```sql
'… NULL for every skill not born from Expert authoring, INCLUDING an abandoned draft (D-263-08). …'
```

That sentence is false for a pre-existing private skill that an author merely *selects* in
the picker.

**Failure scenario:** author A has a private skill `exec-comp-benchmarks` (never
`is_org_shared`, never through the publish gate — `PATCH /skills/{id}/toggle-global` 409s
without eval evidence). A builds an `org`-visibility Expert and ticks that skill in the
existing-skills picker (`ExpertAuthoringStudio.tsx:1008-1030`). On save,
`_stamp_born_for` claims it. From then on every member of org X resolving that Expert gets
`exec-comp-benchmarks` in `effective_skills` — a sharing decision the publish gate exists to
mediate, taken by a checkbox with no disclosure anywhere in the UI.

D-263-06 acknowledges the widening in the abstract (*"the stamp IS a privilege widening"*),
so this is not an unnoticed hole — but the **scope** of the widening is broader than
D-263-08's wording, and nothing tells the author it happened.

⚠ It is *not* a cross-org leak: `org_id = $3` and the `s_org_id == caller_org_id` fence both
hold, and both are driven. That is why this is a Warning and not Critical.

**Fix (pick one, and make the comment agree with the code):**
- **Narrow the claim.** Stamp only names the client just created in this session — pass the
  approved names explicitly from `handleSaveProposedSkill` rather than re-deriving the set
  from `member_skills`. This matches the migration comment as written.
- **Or keep the breadth and disclose it.** Render, beside the picker, which selected skills
  are private-and-about-to-be-shared-through-this-Expert, and correct the column comment to
  *"the Expert bundle a skill was scoped to"*. Silent is the one option that is not available.

---

### WR-09: `create_expert` returns the stringified internal exception to the API client

**File:** `backend/app/api/experts.py:163-168`

**Issue:**
```python
except Exception as exc:
    logger.error("Failed to create expert bundle: %s", exc, exc_info=True)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Could not create expert bundle: {exc}",
    ) from exc
```

`exc` here is whatever asyncpg raised. `handleResponse` (`lib/api/experts.ts:146-148`) puts
it straight into `setSaveError` and the banner renders it.

**Failure scenario:** a duplicate slug raises
`UniqueViolationError: duplicate key value violates unique constraint
"idx_expert_bundles_org_slug" DETAIL: Key (org_id, slug)=(…, financial-analyzer) already
exists.` — internal index names, column tuple and another org-scoped identifier, rendered in
the browser. The same arm will forward connection strings and SQL fragments on a driver
error.

**Fix:** log the detail, return a stable message, and give the one case users actually hit
its own arm:
```python
except asyncpg.UniqueViolationError as exc:
    logger.warning("Duplicate expert slug for org %s: %s", org_id, exc)
    raise HTTPException(status.HTTP_409_CONFLICT, detail={
        "detail": f"An Expert with the slug '{payload.slug}' already exists in this organisation.",
        "error": "expert_slug_taken",
    }) from exc
except Exception as exc:
    logger.error("Failed to create expert bundle: %s", exc, exc_info=True)
    raise HTTPException(status.HTTP_400_BAD_REQUEST,
                        detail="Could not create expert bundle.") from exc
```

---

## Info

### IN-01: `AuthoredSkillBody.summary` is generated on every shot and consumed by nobody

**File:** `backend/app/services/skill_body_authoring.py:276-277` · `frontend/src/lib/api/experts.ts:86-89`
**Issue:** `grep -rn "\.summary" frontend/src/components/experts/ frontend/src/lib/api/experts.ts` → **0 hits**.
`handleCreateProposal` reads only `body.instructions` (`ExpertAuthoringStudio.tsx:334`); the
dialog's description is pre-filled from `proposal.description` instead (`:351`). The field is
in the emitter schema, costs tokens on every provider round trip, and is discarded.
**Fix:** either consume it (`description: body.summary || proposal.description` — it is the
authored body's own account of what the skill does, which is what drives skill triggering) or
drop it from `AuthoredSkillBody` and the emitter schema.

### IN-02: `refreshAvailableSkills()` can undo the optimistic append and re-lock Save

**File:** `frontend/src/components/experts/ExpertAuthoringStudio.tsx:363-372`
**Issue:** `handleSaveProposedSkill` appends the created skill to `availableSkills`, then
fires `void refreshAvailableSkills()`, whose `setAvailableSkills(skills.map(...))` **replaces**
the array wholesale. If that read does not yet include the new row, the just-approved skill
becomes phantom again, the banner flips back to *"1 capability is not real yet"* and Save
re-disables with no user-visible cause.
**Fix:** merge rather than replace, so the refresh can only ever add:
`setAvailableSkills(prev => { const seen = new Set(fresh.map(s => s.name)); return [...fresh, ...prev.filter(p => !seen.has(p.name))] })`.

### IN-03: two misplaced module-level imports in `expert_authoring.py`

**File:** `backend/app/services/expert_authoring.py:39, 144`
**Issue:** `from app.services.forced_emit import forced_emit` sits at `:39`, wedged between the
`SuggestedNewSkill` class body and the `logger` assignment; `import re` sits at `:144`,
after a 25-line prompt constant. Both are top-level and unconditional, so this is placement
only — but it defeats an import-order scan and reads as a function-local import that is not one.
**Fix:** move both into the import block at the top of the file.

### IN-04: the reset hazard's negative arm has no fence

**File:** `frontend/src/components/skills/SkillFormDialog.test.tsx:334-446` · `SkillFormDialog.tsx:338-343`
**Issue:** the suite drives the *positive* arm (a CHANGED `initialValues` re-runs the reset,
`:414-446`). Nothing drives the arm the ⛔ comment is actually about: that a **stable**
reference across a parent re-render does NOT re-run the reset and wipe typing. Nothing asserts
the studio holds `skillDialogInitial` in state either — the caller obligation is carried by
prose at `SkillFormDialog.tsx:338-343` and by nothing executable.
**Fix:** add a case that types into the instructions box, re-renders with the *same*
`initialValues` object, and asserts the typed value survived — it is three lines and it is the
half that can actually regress.

### IN-05: `member_skills` is unbounded in count and in element length

**File:** `backend/app/models/expert.py:58` · `backend/app/services/expert_service.py:315-321` · `backend/app/api/experts.py:88-107`
**Issue:** `member_skills: list[str] = Field(default_factory=list)` has no `max_length` and its
elements have no per-item cap. The save fence binds the whole list into
`name = ANY($1::text[])`, and the 422 echoes every unknown name back in `unknown_skills` and
in the human sentence. One authenticated `experts:manage` request can therefore carry — and
be answered with — an arbitrarily large list.
**Fix:** `Field(default_factory=list, max_length=100)` plus a per-item cap
(`list[Annotated[str, StringConstraints(max_length=120)]]`), matching the practical ceiling of
the picker.

### IN-06: `draft_expert` accumulates unbounded extracted text across an unbounded number of files

**File:** `backend/app/api/experts.py:187-228`
**Issue:** `MAX_FILE_BYTES` bounds each individual read, and `del data` releases each buffer,
but `brainstorm_snippets` keeps up to 30,000 characters **per file** with no cap on the number
of files in the multipart body. The prompt is later truncated to 10,000 chars
(`expert_authoring.py:343`), so the retained text is pure overhead.
**Fix:** cap the file count and stop accumulating once the prompt budget is reached:
```python
MAX_FILES, MAX_TOTAL_CHARS = 10, 30000
for f in (files or [])[:MAX_FILES]:
    ...
    if sum(len(s) for s in brainstorm_snippets) >= MAX_TOTAL_CHARS:
        break
```

---

_Reviewed: 2026-09-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
