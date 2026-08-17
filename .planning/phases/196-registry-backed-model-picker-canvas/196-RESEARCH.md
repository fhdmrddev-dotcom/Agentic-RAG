# Phase 196: Registry-Backed Model Picker (canvas) — Research

**Researched:** 2026-08-17
**Domain:** Cross-provider model registry surfacing (backend union read + three client model controls)
**Confidence:** HIGH — every numeric claim in this document was re-derived in this session against the live local DB (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) and the shipped source. Nothing was inherited.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

*Copied verbatim from `196-CONTEXT.md` `<decisions>`. Full prose lives there; this is the binding list the planner must honour.*

| ID | Decision |
|---|---|
| **D-01** | **LOAD-BEARING** — a NEW non-operator **union** endpoint is the picker's source. Neither `verified_models` (61, code) nor `allowed_models` (34, enabled DB rows) is "the live registry". |
| **D-02** | The union logic is **COPIED, not invented** — `_registry_row` + `get_model_registry` (`backend/app/api/admin.py:1054-1149`). ⚠ `GET /admin/models` itself CANNOT be reused; the `require_operator` router gate at `admin.py:153-157` is correct and **must not be widened**. |
| **D-03** | Measured union size is **69** (61 + 8). Re-derive rather than trust. |
| **D-04** | Blank stays `""` on the wire — **ZERO data change**. |
| **D-05** | Blank is a **NAMED first option**, not an empty slot — *"Use the run's model"*. |
| **D-06** | **HONESTY** — the inherit option's **label carries the hedge**; it does NOT assert a fixed default. A bare `Effective: gpt-5.4` footer would assert a default the code does not implement. |
| **D-07** | A **DISABLED** model is NOT offered but is **KEPT if already stored** as `(current)`. ⚠ The form must **NOT rewrite a stored value as a side effect of being opened**. |
| **D-08** | An **UNKNOWN** model is kept as `(current)` AND **names its consequence**: *"not in the registry — forced emission unavailable, document steps run best-effort."* Saving is **not** blocked. |
| **D-09** | Client list + **SERVER rejection** on the workflow save path. Precedent: `PUT /me/preferences` 400 (`me_preferences.py:87-96`). |
| **D-10** | The harness gains the **enabled-check it has never had** — route the per-phase model through `_resolve_enabled_model` (`run_model_resolution.py:35`) with an honest notice. |
| **D-11** | The AI-draft path is **VERIFIED, then left alone**. Research must CONFIRM, not inherit. |
| **D-12** | Fitness is annotated on **`llm_emit` ONLY**. Other step types get a plain list. |
| **D-13** | **`emit_tier` goes on the wire.** Measured 17 `force_strict` · 39 `force` · 5 `coerce`. |
| **D-14** | `emit_tier` is **ADDED to the DB overlay list in the SAME phase** (`config.py:717-718`) + the editable-column set (`_MODEL_CAP_COLUMNS`). |
| **D-15** | **Engine words never become user words** (SEED-085 two-audience rule; ⌥ Technical-names reveal). |
| **D-16** | Judge **FITNESS stays OUT** — the `$defs`/`$ref` hypothesis is UNVERIFIED. **No document may state the cause as fact.** |
| **D-17** | `BUG-260731-01` — route the **four judge consumers** to DB-backed settings. ⚠ **BINDING: the fix MUST include a test that sets the row and asserts the RESOLVED model changes.** |
| **D-18** | `BUG-260718-04` — a thread restores its model by **DERIVING it from its last message**. No new storage, no schema change, no migration. Falls back to the global default for new threads **or when the stored model is no longer enabled** (reuses D-07's rule). |
| **D-19** | `BUG-260809-01` (cloud eval engine 0/8) **STAYS OPEN** — not folded. |
| **D-20** | **G-5 on `PhaseFormPanel.tsx` is HONOURED BY CONSTRUCTION** — a `ModelField` component with **one gated mount line per phase type**. ⚠ Inlining `useMemo`/`useState`/`useEffect`/`.filter(`/`.map(` into the panel body **breaks the 193.1 fence**. |
| **D-21** | G-2 (sketch) **FIRED AND WAS DECLINED**, on a reason — the picker idiom ships twice already. |
| **D-22** | **FIVE FILES THIS PHASE TOUCHES ARE ABSENT FROM THE HOT-FILE LEDGER** (`config.py` 70/41/1275 · `SettingsPage.tsx` · `admin.py` · `validator_kinds.py` · `ModelRegistryTab.tsx`). |
| **D-23** | This phase **discharges the ledger debt for the files it ACTUALLY MODIFIES**, measured at close — a row **and** its detail section (SAME-COMMIT SYNC RULE). |
| **G-1/G-3/G-7** | None fire. |

### Claude's Discretion

- The exact **route name and shape** of the D-01 union endpoint — the **contract** is fixed (non-operator readable; returns the union with `enabled` / `deprecated` / `capability_source` / `emit_tier` per row), the URL is not.
- **Component naming and file placement** for the picker (`ModelField.tsx` is a suggestion, not a lock).
- Whether the `llm_emit` fitness annotation renders as a **chip, a suffix, or a grouped `<optgroup>`** — the **requirement** is that a `coerce` model is distinguishable from a `force`/`force_strict` one *before* selection, in user words.
- **Wave/plan decomposition**, and whether the three surfaces ship as separate plans (they almost certainly should — surfaces 2 and 3 are independent of surface 1).

### Deferred Ideas (OUT OF SCOPE)

- **Judge fitness as a capability facet** — SEED-135 item 6. Re-open: someone reproduces the `gemini-3.5-flash` judge failure with the sanitized Google tool payload captured.
- **Refusing a `coerce`-tier judge at `settings.py:448-457`** — SEED-135 item 3. Deferred with judge fitness.
- **The app-wide model single-source sweep (SEED-040 / SEED-088)** — re-open: its own milestone.
- **Per-workflow (rather than per-step) default model** — re-open: an author asks for it.
- **Having the AI drafter CHOOSE a fit model per step** — collides with AUTH-02 / Phase 197.
- **A "re-measure loaded context" action in the Model Registry tab** — SEED-172 finding 4.
- **Numeric range validation on the registry PATCH path** — SEED-172 finding 3, ~10 lines. ⚠ *"the planner should check whether this becomes free"* — **answered in §D.12 below: YES, it is free.**
- **Ledger rows for the four absent files 196 does not modify.**
- `BUG-260809-01` — reviewed, left `open`.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **AUTH-04** | *"A user selects the model for a step from the live model registry, rather than typing a model name or slug by hand."* (`REQUIREMENTS.md:66` — canvas/workflow surface only) | §A (the union endpoint + extraction seam), §F (the picker contract + the exact one-gated-line mount shape), §B (the server refusal that makes "selects from the registry" true against a direct API call, not only through the form) |

### ROADMAP Success Criteria → evidence layer

| SC | Statement | Proven by |
|---|---|---|
| **SC#1** | A step's model is chosen from a list sourced from the live registry. | New union route returns 69 rows (§A); `ModelField` renders only from that payload (§F); render test + source fence. |
| **SC#2** | An unregistered model cannot be **silently** selected. | Server refusal on the save path (§B) + the `(current)` retention with a named consequence (§F/D-08) + the `llm_emit` fitness grouping (§E). |
| **SC#3** | The app-wide sweep is NOT attempted. | Negative fence — `files_modified` across all plans contains no `SettingsPage.tsx` model-box change, no `ModelPillRow` change, no `verified_models` payload change. |
</phase_requirements>

---

## Summary

This phase is **surfacing work over data that already exists**, plus **two wiring fixes on other surfaces**. There is no new subsystem, no new provider integration and no LLM-call-path change. Every capability it needs is already computed somewhere in the codebase — the union registry composition, the disabled-model fallback with an honest notice, the `(current)` retention idiom, the 400-on-out-of-set write, the two-audience ⌥ reveal. The phase's job is to **move each of those one seam outward** so a workflow author, a settings operator and a chat user each see the truth the backend already knows.

**Every figure in `196-CONTEXT.md` reproduced exactly** — 61 / 34 / 26 / 8 / union 69, the 17·39·5 `emit_tier` distribution, 257 phases / 242 definitions / 239 blank / 18 `gpt-5.4`, the three-row judge measurement, the single `emit_tier` hit in `frontend/src`. That is unusual for this project and worth stating: CONTEXT.md's measurements are trustworthy. **Three findings diverge or extend, and all three change the plan shape:**

1. ⚠ **D-14 is NOT a one-line change — it needs a MIGRATION.** `model_capabilities_overrides` has **no `emit_tier` column** (measured against `information_schema`). SEED-135 called the overlay list *"a one-line prerequisite"*, and the overlay list *is* one line — but the column it would copy does not exist. D-14's real change set is **7 artifacts including migration `120_`** (§D.11).
2. ⚠ **D-18's premise is imprecise in a way that matters.** `public.messages` has **no `model` column**. The model is stored on `public.runs.model` and JOIN-derived onto assistant messages at read time (Phase 095.1-03, `MessageResponse.model`). The mechanism still works and is still zero-migration — but "the most recent message" must be "the most recent message with a **non-null, non-`'unknown'`** `model`", and `provider` must be restored alongside it or `ChatArea.tsx:201` clobbers the restore (§H).
3. ⚠ **Two incompatible `enabled` semantics ship today, and D-01/D-07/D-10 must pick one.** `_registry_row` treats *"no override row"* as `enabled: true` (66 of 69 enabled). `enabled_model_allowed_set()` treats it as *not offerable* (34 of 69). `_resolve_enabled_model` agrees with `_registry_row`. **Pick `_registry_row`'s semantics** — it is what the runtime already enforces, so the picker and the harness stay in agreement (§A.3).

**Primary recommendation:** ship a leaf service module `backend/app/services/model_registry.py` that owns the union composition (extracted from `admin.py`, additive-then-repoint), expose it on a new top-level non-operator route `GET /models/registry` in its own router module, and have all three client surfaces plus the save-path refusal read that ONE function. Every G-5 fire in this phase is then honoured by construction, because the new concern lives in a new leaf rather than growing a hot file.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Compose the model registry union (DEF ∪ OVR ∪ DB-only) | **API / Backend** (new leaf service) | — | Requires `MODEL_CAPABILITIES` (code) + `model_capabilities_overrides` (DB). Impossible client-side. |
| Expose the union to non-operator authors | **API / Backend** (new top-level router) | — | The `require_operator` gate is a router-level default-deny; a second, narrower route is the only correct door (D-02). |
| Refuse an unregistered `config.model` | **API / Backend** (workflows save path) | Browser (courtesy disable) | *"The disable is courtesy, the server is the wall"* — T-167-14b. A client-only list is bypassable by any direct API call. |
| Fall back from a disabled per-phase model at run time | **API / Backend** (harness executors) | — | Only the run knows the effective org default; the author's browser is long gone. |
| Persist `emit_tier` as an operator-correctable value | **Database / Storage** | API (overlay + PATCH guards) | The value must survive a restart and be editable without a code deploy (SEED-135 §"one-line prerequisite"). |
| Render the picker, the inherit option, `(current)` retention | **Browser / Client** | — | Pure presentation over a server-derived payload. |
| Annotate `llm_emit` fitness in user words | **Browser / Client** | API (ships `emit_tier`) | Vocabulary is a client concern (SEED-085); the engine value is a server concern (D-15). |
| Resolve the judge model from operator-set config | **API / Backend** (4 service consumers) | — | The knob lives in `app_settings`; only the backend reads it. Pure wiring. |
| Restore a thread's last-used model | **Browser / Client** | API (already ships `model`/`provider` on messages) | The data is already on the wire. Client-only derivation. |

---

## Standard Stack

**No new packages.** This phase adds no dependency to `backend/requirements.txt` or `frontend/package.json`. Every library it uses already ships.

### Core (already installed — used, not added)

| Library | Version in tree | Purpose | Why standard here |
|---|---|---|---|
| FastAPI + Pydantic v2 | shipped | Route + response models, `extra="forbid"` strict parse | `WorkflowDefinition` / `_StrictBase` are already the repo's strict-parse layer (`models/harness.py:38-41`) |
| asyncpg (via `deps._pg_pool`) | shipped | The registry read/write path | `set_model_capability` and `load_all_model_overrides` already use it; introducing supabase-py here would violate D-v2.5-01 |
| React + Vite + Tailwind + shadcn/ui | shipped | The three client surfaces | — |
| `@lobehub/icons` via `@/lib/providerLogo` | shipped | `modelLogo()` / `providerLogo()` | Phase 127 ICON CONVENTION — **single-source, everywhere**. Do not import a lobehub icon directly. |
| vitest + @testing-library/react | shipped | Frontend gate | Count gate contract in §Validation Architecture |
| pytest + pytest-asyncio | shipped | Backend gate | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| A new leaf service module for the union | Import `_registry_row` directly from `app.api.admin` | Creates an `api → api` import and drags `admin.py`'s function-local-import discipline (Pitfall 4: *"keep the settings module off admin's load path"*) into a non-admin route. **Rejected.** |
| A new top-level `GET /models/registry` route | Widen `GET /me/preferences` to return the union | Conflates a *preference* with a *catalogue* — violates SEED-135's own G3 (*one knob, one concern*) and breaks the existing `allowed_models` contract every current caller reads. **Rejected.** |
| Storing `emit_tier` as a DB column | Deriving it client-side from a hardcoded tier map | Re-creates the exact SEED-040 code-edit pain the operator named. **Rejected.** |
| `<optgroup>` grouping for fitness | A per-option text suffix | A native `<option>` cannot render markup, so a "chip" is a text suffix either way; grouping additionally guarantees a `coerce` row is never visually adjacent to a `force` one. See §E. |

**Installation:** none.

**Version verification:** N/A — no packages added. Verified by inspection: this phase's change set touches only files already in the tree.

---

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.**

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| *(none)* | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none — no packages proposed.
**Packages flagged as suspicious [SUS]:** none.

If a planner later proposes a package (none is needed), the Package Legitimacy Gate must be run before it is written into any plan.

---

## Measurement Ledger — re-derived 2026-08-17

> ⚠ **Every row here carries the command that produced it.** CONTEXT.md's own instruction was to RE-MEASURE rather than inherit. Agreement is recorded as agreement; divergence is recorded as a finding.

### M-1 — D-01 / D-03: the three counts and the union size

```bash
cd backend && ./venv/Scripts/python.exe -c "
import psycopg2, sys; sys.path.insert(0,'.')
from app.config import MODEL_CAPABILITIES
c=psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); cur=c.cursor()
cur.execute('select model_id, enabled, deprecated from model_capabilities_overrides')
rows=cur.fetchall(); code=set(MODEL_CAPABILITIES)
en=[r[0] for r in rows if r[1]]
print(len(code), len(en), len(set(en)&code), len([r for r in rows if r[0] not in code]), len(code|{r[0] for r in rows}))"
```

| Quantity | CONTEXT.md | **Measured 2026-08-17** | Verdict |
|---|---|---|---|
| `MODEL_CAPABILITIES` ids (code) | 61 | **61** | ✅ agrees |
| enabled `model_capabilities_overrides` ids | 34 | **34** | ✅ agrees |
| overlap | 26 | **26** | ✅ agrees |
| DB-only ids | 8 | **8** | ✅ agrees |
| **union size** | **69** | **69** | ✅ agrees |
| total override rows (any `enabled`) | *(not stated)* | **37** | ⓘ new — 34 enabled + 3 disabled |
| disabled rows | 3 | **3** — `gpt-4o-mini`, `gpt-5.2`, `o1` | ✅ agrees, now named |
| deprecated rows | *(not stated)* | **3** — `deepseek/deepseek-chat`, `gpt-4.1-nano`, `o1` | ⓘ new |

**The 8 DB-only ids (verbatim):** `claude-opus-5`, `gemini-3.6-flash`, `gemini-3.7-flash`, `glm-4.7-flash`, `kimi-k3`, `nvidia_nvidia-nemotron-nano-9b-v2`, `openai/gpt-oss-20b`, `qwen/qwen3.8-max`. ✅ identical to D-01's list.

**Source of each shipped list, confirmed by reading:**
- `verified_models` = `sorted(MODEL_CAPABILITIES.keys())` — `backend/app/api/settings.py:274`. Code-only, by construction. `[VERIFIED: source read]`
- `allowed_models` = `enabled_model_allowed_set()` — `backend/app/models/user_settings.py:1008-1020`, which iterates **only** override rows. DB-only, by construction. `[VERIFIED: source read]`

### M-2 — D-13: the `emit_tier` distribution

```bash
cd backend && ./venv/Scripts/python.exe -c "
import sys,collections; sys.path.insert(0,'.')
from app.config import MODEL_CAPABILITIES
print(dict(collections.Counter(v.get('emit_tier') for v in MODEL_CAPABILITIES.values())))"
```

→ `{'force_strict': 17, 'force': 39, 'coerce': 5}` ✅ **exact agreement with D-13.**

`emit_tier` on the wire today:
```bash
grep -rn "emit_tier" frontend/src        # → 1 hit: ProviderScoreboard.tsx:19 (a prose comment)
```
✅ **exact agreement with D-13.** The data has never travelled.

### M-3 — D-04: the workflow-definition model corpus

⚠ **The table is `workflow_definitions`, not `workflows`** (there is no `workflows` table; `workflow_phases` is the *run* phase table, 570 rows).

```bash
cd backend && ./venv/Scripts/python.exe -c "
import psycopg2, json, collections
c=psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); cur=c.cursor()
cur.execute('select id, definition from workflow_definitions'); rows=cur.fetchall()
n=0; m=collections.Counter()
for _,d in rows:
    d=json.loads(d) if isinstance(d,str) else d
    for p in (d.get('phases') or []):
        n+=1; m[(p.get('config') or {}).get('model') or '<blank>']+=1
print(len(rows), n, dict(m))"
```

| Quantity | CONTEXT.md | **Measured** | Verdict |
|---|---|---|---|
| workflow definitions | 242 | **242** | ✅ |
| phases across them | 257 | **257** | ✅ |
| phases with no model | 239 (93 %) | **239** | ✅ |
| phases with a model | 18, all `gpt-5.4` | **18, all `gpt-5.4`** | ✅ |
| definitions carrying any model | *(not stated)* | **10** | ⓘ new |

**Zero-migration claim for the picker itself: CONFIRMED.** `config.model` is already `str | None = None` on all four config classes (`models/harness.py:80, 103, 122, 157`) and the JSONB stores it as-is. The picker changes no persisted shape. ⚠ **This does not extend to D-14** — see M-5.

### M-4 — D-17: the three-row judge measurement, on today's `develop` HEAD (`895926c8`)

```bash
# row 1
cd backend && ./venv/Scripts/python.exe -c "
import psycopg2; c=psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur=c.cursor(); cur.execute('select harness_judge_model from app_settings'); print(cur.fetchone())"
# rows 2 + 3
cd backend && ./venv/Scripts/python.exe -c "
import sys; sys.path.insert(0,'.')
from app.config import settings
from app.services.harness.validator_kinds import resolve_judge_model
print(repr(settings.harness_judge_model), repr(resolve_judge_model(settings)))"
```

| Source | Report (2026-08-17) | **Measured 2026-08-17** | Verdict |
|---|---|---|---|
| `app_settings.harness_judge_model` (what the operator set) | `deepseek-v4-pro` | **`deepseek-v4-pro`** | ✅ |
| `settings.harness_judge_model` (env singleton) | `None` | **`None`** | ✅ |
| `resolve_judge_model(settings)` (what the judge uses) | `claude-opus-4-8` | **`claude-opus-4-8`** | ✅ |

**The defect reproduces exactly. It is live on `develop` right now.** `[VERIFIED: live DB + live import]`

⚠ **Divergence (line numbers, not behaviour):** `BUG-260731-01`'s consumer table cites `publish_service.py:882 / :894`. Measured today: **`:1136` (import) / `:1148` (call)** — the file grew. The report's file/function identification is correct; its line refs are stale. Same for `eval_runner_service.py:639/645` → measured **`:640` (import) / `:645` (call)** ✅ and `:305/:312` ✅ and `validator_kinds.py:534/:536` ✅.

### M-5 — ⚠ **DIVERGENCE / NEW FINDING:** `model_capabilities_overrides` has no `emit_tier` column

```bash
cd backend && ./venv/Scripts/python.exe -c "
import psycopg2; c=psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
cur=c.cursor(); cur.execute(\"select column_name,data_type from information_schema.columns where table_name='model_capabilities_overrides' order by ordinal_position\")
[print(r) for r in cur.fetchall()]"
```

**Live columns (11):** `model_id`, `provider`, `llm_call_timeout_seconds`, `context_window_tokens`, `max_output_tokens`, `native_tools`, `enabled`, `created_at`, `updated_at`, `deprecated`, `deprecated_reason`.

**`emit_tier` is absent.** So D-14's overlay-list edit at `config.py:717-718` has nothing to copy until a column exists. **D-14 requires a migration.** See §D.11 for the full change set. Highest existing migration: `119_workflow_phases_cancelled.sql` → the new one is `120_`.

### M-6 — ⚠ **NEW FINDING:** two incompatible `enabled` semantics ship today

```bash
# _registry_row (admin.py:1079-1086): absent override row -> enabled True
# enabled_model_allowed_set (user_settings.py:1019-1020): iterates ONLY override rows
```

| Model | override row? | `_registry_row.enabled` | in `allowed_models`? |
|---|---|---|---|
| `gpt-5.4` | yes, `enabled=true` | **true** | **yes** |
| `gpt-5.2` | yes, `enabled=false` | **false** | **no** |
| `gpt-5.5` | **no row** | **true** | **no** |
| `glm-4.7-flash` | yes, `enabled=true` (DB-only) | **true** | **yes** |
| `gemini-3.6-flash` | yes, `enabled=true` (DB-only) | **true** | **yes** |

`_resolve_enabled_model` (`run_model_resolution.py:58`) uses `(overrides.get(m) or {}).get("enabled") is False` — i.e. **`_registry_row`'s semantics**. Under the union endpoint, **66 of 69** rows read `enabled: true`. Under `allowed_models`, **34**. See §A.3 for the recommendation.

### M-7 — the four interesting test values, verified in the state CONTEXT.md claims

| Model | in code registry | override row | `enabled` | in `allowed_models` | `emit_tier` (code) | ✔ |
|---|---|---|---|---|---|---|
| `gpt-5.4` | ✅ | yes | true | ✅ | `force_strict` | passes every check — **proves nothing** |
| `gpt-5.2` | ✅ | yes | **false** | ❌ | `force_strict` | **DISABLED** — D-07 case ✅ |
| `glm-4.7-flash` | ❌ | yes | true | ✅ | **absent → `coerce`** | **DB-only, local, coerce** ✅ |
| `gpt-5.5` | ✅ | **no row** | true | ❌ | `force_strict` | **code-only, absent from `allowed_models`** ✅ |
| `gemini-3.6-flash` | ❌ | yes | true | ✅ | **absent → `coerce`** | **DB-only, absent from `verified_models`** ✅ |

All four interesting values are in the state `<specifics>` claims. `[VERIFIED: live DB + live import]`

### M-8 — D-13's `coerce` default is a **read-time default, not a stored value**

```bash
cd backend && ./venv/Scripts/python.exe -c "
import sys; sys.path.insert(0,'.')
from app.config import _build_inferred_defaults
print(sorted(_build_inferred_defaults('glm-4.7-flash','zhipu')))"
# -> ['capability_source','llm_call_timeout_seconds','max_output_tokens','native_tools','provider']
```

`_build_inferred_defaults` **never sets `emit_tier`**. The only defaulting is `forced_emit.py:376` — `cap.get("emit_tier", "coerce")` with a boundary guard at `:377-378`. ✅ Matches SEED-135's reading exactly. **The picker must apply the same `("emit_tier", "coerce")` default client-side** or a DB-only row renders a blank tier instead of the honest `coerce`.

### M-9 — D-122-04's drift is LATENT, not live

```bash
cd backend && ./venv/Scripts/python.exe -c "
import sys; sys.path.insert(0,'.')
from app.config import MODEL_CAPABILITIES
bad=[m for m,c in MODEL_CAPABILITIES.items() if bool(c.get('forced_emission')) != (c.get('emit_tier') in ('force','force_strict'))]
print(len(bad), bad)"
# -> 0 []
```

`forced_emission` and `emit_tier` **agree on all 61 rows**. `resolve_judge_model`'s fallback at `validator_kinds.py:84-85` reads `forced_emission`; both candidates (`claude-opus-4-8` → `force`, `gpt-5.5` → `force_strict`) resolve identically under either flag. ✅ Exact agreement with CONTEXT.md's *"both candidates agree today, so there is no live divergence"*.

### M-10 — D-20: `PhaseFormPanel.tsx`'s G-5 triple, re-derived

```bash
git log --oneline -- frontend/src/components/workflows/PhaseFormPanel.tsx | wc -l   # 16
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u
wc -l frontend/src/components/workflows/PhaseFormPanel.tsx                          # 1167
```

**16 commits / 8 phases / 1167 L** ✅ identical to D-20 **and** to the ledger row. This row is healthy.

### M-11 — D-11: the AI drafter emits no `config.model`

```bash
grep -n "model" backend/app/services/workflow_authoring.py \
  | grep -v "model_validate\|model_dump\|model_copy\|BaseModel\|model_config"
```

Every remaining hit is about `resolve_authoring_model` (the *authoring* model — a `resolve_judge_model` sibling) or `WorkflowDefinition.model_json_schema()`. **Zero hits emit a phase `config.model`.** ✅ **D-11 CONFIRMED, not inherited.**

⚠ **Two extensions to D-11 the planner needs:**
- `generate_workflow` (`api/workflows.py:1577`) returns `{ok, definition}` and **does not persist**. The client then `POST`s / `PATCH`es it — so the D-09 refusal on `create_draft` / `update_draft` **covers the AI-draft path structurally**, with no separate guard. ✅
- `resolve_authoring_model` (`workflow_authoring.py:185-206`) reads `getattr(settings, "harness_authoring_model", None)` off the **same env singleton** as the judge. It is **a fifth instance of the D-17 defect class**. It is **not** one of D-17's four consumers, `harness_authoring_model` has no `app_settings` column and no UI knob, so **there is no inert knob to fix** — it is inert-by-absence, not inert-by-wiring. **Out of scope; worth a seed.**

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────────┐
   CODE  MODEL_CAPABILITIES│  61 ids · emit_tier per row      │
                          └───────────────┬──────────────────┘
   DB  model_capabilities_ ┌──────────────┴──────────────────┐
       overrides (37 rows) │  8 DB-only · 3 disabled          │
                          └───────────────┬──────────────────┘
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │  NEW LEAF:  services/model_registry.py      │
                    │  build_model_registry_rows() -> 69 rows     │
                    │  (extracted from admin.py _registry_row)    │
                    └───┬──────────────┬───────────────┬──────────┘
                        │              │               │
          require_operator│    (no gate)│      (no gate)│
                        ▼              ▼               ▼
              GET /admin/models   GET /models/     assert_phase_models_
              (operator editor)     registry        registered(defn)
                   [unchanged]     (NEW route)      (NEW pure helper)
                                       │                    │
                                       │                    ▼
                                       │        POST /workflows  ─┐
                                       │        PATCH /workflows/{id} ─► 400 on
                                       │                            unregistered
                                       ▼
        ┌──────────────────────────────┴────────────────────────────┐
        │              BROWSER — three model controls               │
        ├───────────────────────────────────────────────────────────┤
        │ 1. ModelField (NEW)  ──1 gated line ×4──► PhaseFormPanel   │
        │      · inherit option (label carries hedge)                │
        │      · (current) retention for disabled + unknown          │
        │      · llm_emit ONLY: <optgroup> fitness in user words     │
        │ 2. JudgeModelPicker  ── unchanged UI, backend rewired      │
        │ 3. ChatArea/composer ── restore from last message model    │
        └───────────────────────────────────────────────────────────┘

   RUN TIME (the half a picker cannot fix):
        workflow_kickoff ──ctx.model──► phase executor
                                          │
                          _effective_model(phase, ctx)
                                          │  phase.config.model or ctx.model
                                          ▼
                    NEW: _resolve_enabled_model(model, ctx.user_settings.llm_model)
                                          │
                          disabled? ──yes──► fall back to run model
                                          │                 + honest notice
                                          ▼                   (carrier: §C.8)
                                    provider SDK

   JUDGE (surface 2):
        publish_service:1148 ─┐
        validator_kinds:536  ─┼─ resolve_judge_model(  settings  )   ← env singleton (WRONG)
        eval_runner:312      ─┤                     └─► load_app_settings_async()  (RIGHT)
        eval_runner:645      ─┘
```

### Recommended file placement

```
backend/app/
├── services/
│   └── model_registry.py            # NEW leaf — union composition + the refusal helper
├── api/
│   ├── model_registry.py            # NEW router — GET /models/registry (no operator gate)
│   ├── admin.py                     # get_model_registry becomes a thin call (repoint)
│   └── workflows.py                 # +2 call lines in create_draft / update_draft
├── config.py                        # overlay list += emit_tier
└── services/harness/
    ├── phase_types.py               # +1 async helper, 5 call sites repointed
    └── validator_kinds.py           # (D-17 consumer 4)

supabase/migrations/120_model_capabilities_overrides_emit_tier.sql   # NEW

frontend/src/
├── components/workflows/
│   ├── ModelField.tsx               # NEW — the picker
│   ├── modelFitness.ts              # NEW leaf — tier -> user words (pure, testable)
│   └── PhaseFormPanel.tsx           # 4 TextField -> 4 one-line ModelField mounts
├── hooks/
│   └── useComposerModel.ts          # NEW — see §H (the ChatArea G-5 seam)
└── lib/api.ts                       # + getModelRegistry (non-operator) type & fetch
```

---

## §A — The D-01 union endpoint

### A.1 — What `admin.py:1054-1149` actually computes

`_registry_row(model_id, cap, ovr, default_model, model_locked)` returns **13 fields**:

`model_id` · `provider` · `capability_source` (`"registry"` | `"db_override"`) · `enabled` · `deprecated` · `deprecated_reason` · `context_window_tokens` · `max_output_tokens` · `native_tools` · `llm_call_timeout_seconds` · `is_default` · `is_locked` · `overridden_fields`

`get_model_registry` then does: DEF loop over `MODEL_CAPABILITIES` overlaid with `overrides.get(id)`, then a DB-only loop over `overrides` for ids not `seen`. Reads `load_all_model_overrides()` — the **ALL-ROWS** cache (*"disabled rows INCLUDED, Pitfall 1"*), plus `_load_settings_from_db()` for `llm_model` / `llm_model_locked`.

### A.2 — The extraction seam (D-02)

**Extract to a leaf service, additive-then-repoint** — the discipline this repo names for itself in `run_model_resolution.py:1-27` and `run_lifecycle.py`:

```
backend/app/services/model_registry.py          # NEW leaf, no route, no auth

  def _registry_row(...)                        # MOVED VERBATIM from admin.py:1054-1103
  async def build_model_registry_rows() -> list[dict]
                                                # MOVED VERBATIM from admin.py:1131-1143
  def to_author_row(row: dict) -> dict          # NEW — the NARROWED projection (§J)
  async def registered_model_ids() -> set[str]  # NEW — the D-09 refusal's allowed set
  async def assert_phase_models_registered(definition) -> None   # NEW — raises 400
```

Then `admin.py`'s `get_model_registry` becomes:

```python
@router.get("/models")
async def get_model_registry(request: Request):
    request.state.audit_is_write = False
    from app.services.model_registry import build_model_registry_rows   # function-local (Pitfall 4)
    return {"models": await build_model_registry_rows()}
```

**Why a leaf and not a shared import from `admin.py`:** `admin.py` carries a documented *"Pitfall 4 — keep the settings module off admin's load path"* function-local-import discipline and a router-level `require_operator`. A non-admin module importing from it inherits both constraints for no benefit, and creates an `api → api` edge. **`admin.py` is also absent from the hot-file ledger at 30 commits / 11 phases (D-22)** — moving code OUT of it is the right direction.

⚠ **The `require_operator` gate at `admin.py:153-157` is NOT widened.** Verified today:

```python
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_operator)])
```

The extraction moves a *pure composition function*; the gate stays on the router and `GET /admin/models` keeps returning a byte-identical 404 to a non-operator (SC#4 / D-149-09).

### A.3 — ⚠ **Which `enabled` semantics** (the M-6 finding)

**Recommendation: adopt `_registry_row`'s semantics** — *absent override row ⇒ `enabled: true`.*

Reasons, in order of weight:
1. **It is what the runtime already enforces.** `_resolve_enabled_model` (`run_model_resolution.py:58`) fires only on `enabled is False`. If the picker used `allowed_models` semantics it would hide 32 models that the runtime happily runs — a picker narrower than the engine is a *different* lie from the one this phase removes.
2. **D-10 routes the harness through that same resolver.** Two semantics would make the picker and the harness disagree about the same model, which is the failure this phase exists to end.
3. `allowed_models`' narrowness is a *governance* choice for the per-user chat default (SEED-116 two-layer, T-167-13) — a different question from *"what models exist"*.

⚠ **State this explicitly in the plan**, because a reviewer comparing the new route's 66-enabled against `/me/preferences`' 34 will read it as a bug. It is not — they answer different questions.

### A.4 — The `me_preferences.py` precedent (authz + response shape)

**Authz:** `Depends(get_current_user)` only. **No operator gate, no `require_visible` gate, no RLS backstop needed** — verified `model_capabilities_overrides` RLS is `model_overrides_read_all` `FOR SELECT TO authenticated USING (true)` (§J.2). Router registered top-level in `main.py` beside `me_preferences.router` (`main.py:733`) and `features.router` (`main.py:728` — *"NOT operator-gated; top-level, not under /admin — non-operators must reach it to learn their own map"* — **the exact precedent**).

**Read shape** (`me_preferences.py:62-67`): a flat dict of server-derived facts, no envelope beyond the object. **Write refusal shape** (`:87-96`): `HTTPException(400, detail="<a sentence a human can act on>")` — prose, not a code, because the client does not branch on it. **Server-derived loop** (`:120`): the write returns the *fresh read* so the client never holds an optimistic value.

### A.5 — RECOMMENDATION (Claude's Discretion)

| Decision | Recommendation | Reason |
|---|---|---|
| **Path** | `GET /models/registry` | Sibling of `/features` and `/me/preferences` — a top-level authenticated read of a global fact. Reads as a catalogue, not a preference. Leaves room for a future `GET /models/registry/{id}`. |
| **Method** | `GET` | Pure read. |
| **Response model** | `{"models": [AuthorModelRow, ...]}` — a Pydantic `BaseModel`, **not a bare dict** | Mirrors `{"models": [...]}` from `/admin/models` so `getModelRegistry`'s existing *"`.models` HERE — casting the raw object would ship a `{models}` object into list state"* client lesson (`api.ts:5135-5137`) transfers unchanged. |
| **Router file** | new `backend/app/api/model_registry.py` | Keeps `admin.py` (absent from ledger, 11 phases) and `settings.py` from growing. |
| **Registration** | `app.include_router(model_registry.router)` in `main.py`, beside `:728` / `:733` | Same tier, same gate posture. |
| **Caching** | none new — `build_model_registry_rows()` already reads the 30 s-TTL `load_all_model_overrides()` cache | Adding a second cache layer would create a staleness window nobody can reason about. |

`AuthorModelRow` fields (the narrowed projection — see §J.1 for what is deliberately dropped):

```
model_id · provider · capability_source · enabled · deprecated · emit_tier
```

---

## §B — The server-side refusal (D-09, SC#2)

### B.5 — Where `config.model` arrives, and what validates it today

**Two write doors, both taking `body: WorkflowDefinition`:**

| Route | File:line | Body |
|---|---|---|
| `POST /workflows` (`create_draft`) | `backend/app/api/workflows.py:1147-1178` | `WorkflowDefinition` |
| `PATCH /workflows/{definition_id}` (`update_draft`) | `backend/app/api/workflows.py:1218-1312` | `WorkflowDefinition` |

`config.model` lands on four Pydantic classes, all `_StrictBase` (`extra="forbid"`):

| Class | Field | `models/harness.py` |
|---|---|---|
| `LlmSinglePhaseConfig` | `model: str \| None = None` | `:80` |
| `LlmAgentPhaseConfig` | `model: str \| None = None` | `:103` |
| `LlmBatchAgentsPhaseConfig` | `model: str \| None = None` | `:122` |
| `LlmEmitPhaseConfig` | `model: str \| None = None` | `:157` |

**What validates it today: NOTHING.** ✅ CONTEXT.md's measurement confirmed. `create_draft` forces `status='draft'` and catches a `UniqueViolationError`; `update_draft` forces `status='draft'`, maps three named refusals and catches `CheckViolationError`. Neither inspects `phases[*].config.model`. There is no `model_validator` on any of the four config classes touching it (`models/harness.py:297` and `:438` are the only two, and they cover `external_action` / name derivation).

### B.5b — Where the refusal belongs

**In the route body, one line each, delegating to the leaf helper:**

```python
# create_draft — after the status force, before create_workflow_definition
await assert_phase_models_registered(body)     # raises 400; no-op when every model is known
```

**NOT as a Pydantic `model_validator`** — three reasons, all measured:
1. The check is **async** (it reads `load_all_model_overrides()`); Pydantic v2 validators are sync.
2. `models/harness.py:384-389` and `:428-433` record the file's own standing rule: *"the draft save path persists `model_dump(mode="json")`, so a derivation living in this model would be BAKED into the JSONB"*. A validator is the wrong layer here by this file's own decision.
3. A registry row an operator retires later must not make an existing definition **unparseable** — D-08's *"saving is not blocked"* for already-stored values depends on the check being a route-level policy, not a parse-level invariant.

**The idiom to mirror in that file:** `update_draft`'s named-refusal block (`:1289-1310`) — `raise HTTPException(status_code=..., detail=...)` with a sentence, and the `not_found` fall-through comment *"a new refusal cause must be mapped deliberately"*. The refusal's `detail` should mirror `me_preferences.py:91-95`'s register: name the model, name what to do.

**Recommended shape:**
```
400  {"code": "unknown_model", "message": "<phase name> uses a model that is not in the registry: <id>.
                                            Pick one from the list, or leave it blank to use the run's model.",
      "phase_slug": "...", "model": "..."}
```
An object (like `stale_token` at `:1299-1305`), not bare prose, because the Builder will want to focus the offending phase's field.

### B.6 — ⚠ G-5 on `backend/app/api/workflows.py`

**Measured 2026-08-17:** `35 commits / 17 phases / 1962 L` — **G-5 FIRES.** The ledger says *"extraction due — not taken in q5r (no 2nd concern)"*, and names the seam: *"this one module hosts the definition CRUD, the validate/lint surface, the grounding palette, the publish gauntlet, the run launcher and the template door."*

**Recommendation: honour by construction. Do NOT take the extraction in this phase.**

The ledger's own repeated test is *does this add a genuinely SECOND concern?* — applied twice already (*"a door that mints an id and a door that reads it are one concern"*). Here the addition is **a validation on the definition CRUD this module already owns**, and the *logic* lives in the new `model_registry.py` leaf. The file's diff is **two call lines and one import**. Under the ledger's own standard that is a call-out, not a concern.

**Cost of the alternative (taking the extraction now):** the named seam is a five-way split of a 1962-line module that six other phases have edited. That is a refactor phase, not a task inside a model-picker phase — and G-5's purpose is to make that a *deliberate* phase, not a smuggled one. **Cost of NOT taking it:** the row inherits `35 / 17 / 1962` +2 lines, and the next phase adding a real second concern still owes the recommendation first. That is the correct trade.

⚠ **D-23 obligation:** this file **is** in the ledger, so its row + detail section must be re-derived and updated at close (SAME-COMMIT SYNC RULE).

### B.7 — The AI-draft path and the publish path

| Path | Does it bypass the save validator? | Consequence |
|---|---|---|
| **AI draft** (`POST /workflows/generate`, `:1577`) | **No.** It returns `{ok, definition}` **unpersisted**; the Builder then calls `create_draft` / `update_draft`. | ✅ Structurally covered. **And** M-11 confirms the drafter emits no `config.model` at all, so the refusal is a no-op on this path today. |
| **Publish** (`POST /workflows/{id}/publish`, `:1056`) | **YES — it reads the STORED definition.** | ⚠ **A definition saved BEFORE this phase can carry an unregistered model and publish without ever meeting the refusal.** 18 phases store `gpt-5.4` (registry-known + enabled), and **zero** phases are currently in the unknown state (D-08), so the live blast radius is **zero today**. |

**Recommendation:** do **not** add a second refusal to the publish gauntlet in this phase.
- It would be an **eighth stage** in an 8-stage gauntlet whose ordering is doubly documented (*"the two docstrings must never disagree"*, `:1063-1066`) — a real second concern in `publish_service.py` (19 commits / 7 phases, G-5 FIRES).
- The measured population it would catch is **empty**.
- D-10's **runtime** enabled-check already covers the dangerous half (a model that *became* disabled), and covers it for every path including publish.

Record it as a known, measured, empty gap with a re-open trigger: *the first definition observed with an unregistered `config.model`.*

---

## §C — The harness enabled-check (D-10)

### C.8 — Routing the per-phase model through the shipped resolver

**What ships today:**

```python
# backend/app/services/harness/phase_types.py:393-395
def _effective_model(phase, ctx) -> str:
    """The per-phase model override or the run's inherited model."""
    return getattr(phase.config, "model", None) or getattr(ctx, "model", "") or ""
```

**Five call sites, ALL inside `async def` executors** (measured):

| Line | Enclosing function |
|---|---|
| `:455` | (llm-human-input tool context builder) |
| `:529` | `async def _exec_llm_single` (`:509`) |
| `:548` | `async def _exec_llm_agent` (`:535`) |
| `:642` | `async def _exec_llm_batch_agents` (`:624`) |
| `:1234` | `async def _exec_llm_emit` (`:1194`) |

**What the resolver needs, and whether the harness has it:**

| `_resolve_enabled_model(resolved_model, org_default)` needs | Available on the harness ctx? |
|---|---|
| `resolved_model` | ✅ `_effective_model(phase, ctx)` |
| `org_default` | ✅ **`ctx.user_settings.llm_model`** — `workflow_kickoff.py:478` passes `user_settings=user_settings` into the ctx; `phase_types.py` already reads `getattr(ctx, "user_settings", None)` at `:449, :530, :561, :647, :1346` |
| an SSE emitter for the notice | ✅ `ctx.redis` + `ctx.producer_run_id`/`ctx.run_id` + `ctx.emit` — see the carrier below |
| a DB pool for a receipt | ✅ `ctx.pool` + `ctx.current_user` |

**Recommended shape — additive-then-repoint, the `run_lifecycle.py` discipline:**

```python
async def _effective_model_checked(phase, ctx) -> str:
    """D-10: the per-phase model, with the SHIPPED disabled-model fallback the chat
    path has had since Phase 149 and the harness has never had."""
    model = _effective_model(phase, ctx)                       # unchanged, still exported
    org_default = getattr(getattr(ctx, "user_settings", None), "llm_model", "") or ""
    from app.services.run_model_resolution import _resolve_enabled_model   # late import
    model, notice = await _resolve_enabled_model(model, org_default)
    if notice:
        await _emit_model_fallback(ctx, phase, notice)          # the carrier, below
    return model
```

Then five `_effective_model(phase, ctx)` → `await _effective_model_checked(phase, ctx)`.

⚠ **Keep `_effective_model` sync and exported.** Changing its signature would break any test importing it and would give the fence-readers a moving target. The new function is additive.

⚠ **`_resolve_enabled_model` resolves `load_all_model_overrides` LATE off `app.api.threads`** (`run_model_resolution.py:53`) — a documented patch surface (D-A4). Importing it from `phase_types.py` therefore drags an `app.api.threads` import into the harness at call time. **Verify no import cycle** — `threads.py` is 1273 L post-195 extraction and does not import `phase_types`. `[ASSUMED]` — the planner must confirm with an actual import in a RED test, not by reading.

**The honest notice — the concrete carrier.** The harness has **no chat SSE**; it has phases and events. Two candidates, both shipped:

| Carrier | File:line | Cost | Verdict |
|---|---|---|---|
| **`_emit_phase_substep(ctx, phase, status=...)`** — one XADD on the producer stream the frontend already tails | `phase_types.py:1076-1113` | **Zero migration.** But its `status` literal set is documented for the emit moment (`forcing/emitting/recovering/validating/rendering/validated`) and the frontend maps those to PhaseCard states. A new status value needs a frontend mapping. | ✅ **RECOMMENDED as the user-visible half** |
| **`_emit_audit(ctx, event_type=..., metadata=...)`** — an INSERT-only receipt | `phase_types.py:1061-1073` → `db/workflows.py:1601` | ⚠ **`event_type` is CHECK-constrained to 24 kinds** (measured live: `harness_audit_event_type_check`), mirrored in `_AUDIT_EVENT_TYPES` (`db/workflows.py:111`) and **pinned equal in both directions** by `backend/tests/unit/test_audit_event_registration.py`. A new kind = **migration + code set + pin update**. | ⚠ **costs a migration** |

**Recommendation:** emit the user-visible signal via `_emit_phase_substep` with a new `status="model_fallback"` (+ the two model ids in the fields), and write the durable receipt with the **existing** `policy_applied` kind rather than minting a 25th. Rationale: `policy_applied` is already registered in both layers, and *"an operator policy (disable) was applied to this run"* is precisely what happened. **Do not mint a new audit kind for this** — `BUG-260731-02`'s lesson (recorded in `db/workflows.py:107-110`) is that registering a kind in one layer only *moves* the failure; the two-layer cost is real and this phase does not need to pay it.

⚠ **If the planner prefers a dedicated kind anyway**, the full cost is: migration `121_` (or fold into `120_`), `_AUDIT_EVENT_TYPES` += the kind, and `test_audit_event_registration.py`'s equality pin updated. Say so in the plan; do not let it be discovered at execution.

### C.9 — ⚠ G-5 on `backend/app/services/harness/phase_types.py`

**Measured:** `38 commits / 15 phases / 2393 L` — **G-5 FIRES.** Ledger: *"extraction due — and deliberately NOT taken in 190"*, with the reason recorded as a **test**: *"190's whole change to this file is one function … so it adds a call-out, not a concern."* The named seam: *"one module per executor under `harness/phase_types/`, the same shape the 188.2 card cut used."*

**Recommendation: honour by construction — the 190 precedent applies verbatim.**

This phase adds **one function** (`_effective_model_checked`) and changes **five call sites by one word each** (`await` + name). It touches none of the file's five-plus concerns (the emit path, the fill/render path, the ask_user path, the tool-context builders, the seven executors). Diff estimate: **~15 lines added, 5 modified.** That is the same measured shape 190 was cleared on.

**Cost of taking the extraction:** splitting seven executors out of a 2393-line module, each with its own tool-context wiring and audit receipts, across a file 15 phases have edited. That is its own phase.

⚠ **D-23 obligation:** this file **is** in the ledger — re-derive its row + section at close.

---

## §D — `emit_tier` on the wire + the overlay list (D-13, D-14)

### D.10 — The distribution

Measured (M-2): **17 `force_strict` · 39 `force` · 5 `coerce`** across 61 code rows. ✅ Exact agreement with D-13.

The 5 `coerce` rows, named (they are the phase's most interesting client-side test data):
`kimi-k2.5` · `kimi-k2.6` · `moonshot-v1-8k` · `moonshotai/kimi-k2.5` · `moonshotai/kimi-k2.6`

Plus **all 8 DB-only ids default to `coerce`** at read time (M-8) — so the union's effective distribution is **17 / 39 / 13**.

### D.11 — ⚠ The COMPLETE one-commit change set for `emit_tier` end-to-end

**A migration IS needed. The table has no `emit_tier` column** (M-5). SEED-135's *"one-line prerequisite"* refers to the overlay list; the column it copies does not exist yet.

| # | Artifact | Change | Verified today |
|---|---|---|---|
| 1 | **`supabase/migrations/120_model_capabilities_overrides_emit_tier.sql`** | `ALTER TABLE public.model_capabilities_overrides ADD COLUMN emit_tier text;` + `CHECK (emit_tier IS NULL OR emit_tier IN ('force_strict','force','coerce'))` | Highest existing migration is `119_workflow_phases_cancelled.sql` ✅ |
| 2 | Apply it **by pasting into the Supabase SQL editor** (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` | CLAUDE.md §Rules, binding | — |
| 3 | **`backend/app/config.py:717-718`** | overlay copy tuple `("llm_call_timeout_seconds", "context_window_tokens", "max_output_tokens", "native_tools", "deprecated")` **+= `"emit_tier"`** | measured verbatim ✅ |
| 4 | **`backend/app/api/admin.py:129-137`** — `_MODEL_CAP_COLUMNS` | `+= "emit_tier"` (7 → 8 editable columns) | measured ✅ |
| 5 | **`backend/app/api/admin.py` — the per-column type guard** (`:1375-1395`) | new `_MODEL_CAP_ENUM_COLUMNS = {"emit_tier": {"force_strict","force","coerce"}}` branch, 422 on an off-allowlist value BEFORE any DB touch. The existing loop already handles int / bool / `deprecated_reason`; this is a fourth `elif`. | measured ✅ |
| 6 | **`_registry_row`** (now in the leaf) | `"emit_tier": _eff("emit_tier")` — WR-04 rule: return the **raw effective value or `None`**, never a coalesced false default. The **client** applies `?? "coerce"` (M-8's read-time default). | — |
| 7 | **`frontend/src/lib/api.ts`** — `ModelRegistryRow` (`:5010-5031`) | `+ emit_tier: "force_strict" \| "force" \| "coerce" \| null` | measured ✅ |
| 8 | **`frontend/src/components/admin/ModelRegistryTab.tsx`** | a control. ⚠ The tab's `NUMERIC_FIELDS` array (`:63-73`) is int-only and the `native_tools`/`deprecated` controls are toggles — `emit_tier` is the tab's **first enum field** and needs a small `<select>` control, not a reuse. | measured ✅ |

⚠ **Do NOT touch `_build_inferred_defaults`.** It deliberately never sets `emit_tier` (M-8), and `forced_emit.py:376`'s `cap.get("emit_tier", "coerce")` is the default-SAFE D-122-05 behaviour that must not change.

⚠ **`get_model_capability_async` is the async DB-tier reader** (`config.py:700-731`). The **sync** `get_model_capability` never reads the DB — so `get_model_capability("glm-4.7-flash")` returns `capability_source="inferred"` with no `emit_tier` even after this change (measured today). Any surface reading a DB-only model's tier **must use the async path or the union payload**, never the sync helper.

### D.12 — Is SEED-172's numeric range validation FREE? **YES.**

**Answer: yes, and the reason is mechanical.** D-14 change #5 above edits **the exact `for col, val in body.items():` loop** at `admin.py:1375-1395` that would host the bounds check. The loop already:
- skips explicit `null` (Reset semantics),
- branches on `_MODEL_CAP_INT_COLUMNS` and rejects `bool` explicitly,
- raises a 422 **before any DB touch**.

Adding bounds is a per-column min/max map plus one comparison inside the existing int branch. Estimated **~10 lines**, in the function D-14 is already opening, covered by the test file D-14 is already touching. SEED-172's own estimate (*"~10 lines to fix, and the natural home is beside the existing type guards"*) is accurate.

⚠ **But "free" is not "in scope."** It is a **deferred idea with a stated re-open trigger** (*"any phase editing `set_model_capability`'s guards — which D-14 may well be"*). The trigger has fired. **The researcher's finding is that the cost is genuinely ~10 lines; the DECISION to fold it is the operator's / planner's, not this document's.** Recommend surfacing it as a one-line plan-time question with the measured cost attached, and note it needs its own bounds decision per column (`llm_call_timeout_seconds` clamps to the env path's `1..3600`, `config.py:566-567`; `context_window_tokens` / `max_output_tokens` have no shipped clamp to mirror).

### D.13 — D-122-04 holds in the proposed change; the latent drift

**The rule holds.** Every surface in this phase reads `emit_tier`:
- the union row: `_eff("emit_tier")`
- the client fitness map: `row.emit_tier ?? "coerce"`
- the runtime ladder: `forced_emit.py:376` (unchanged)

`forced_emission` and `strict_json_schema` are read **nowhere** in the proposed change set. ✅

**The latent drift at `validator_kinds.py:83-86`:**
```python
for candidate in ("claude-opus-4-8", "gpt-5.5"):
    cap = get_model_capability(candidate) or {}
    if cap.get("forced_emission"):        # ← reads the DEPRECATED bool
        return candidate
```
Measured (M-9): **0 of 61 rows disagree**, and both candidates resolve identically under either flag. **The drift is latent, not live.** ✅ Exact agreement with CONTEXT.md.

**Should D-17 also fix it? Recommendation: NO — and record the reason.**

1. **It is a different function from the one D-17 changes.** D-17 changes the four *consumers* (which settings object they pass). `resolve_judge_model`'s fallback body is untouched by that fix.
2. **It is measurably inert.** Changing inert code inside a critical-bug plan adds risk with zero observable benefit — and would make D-17's binding test (§G.20) harder to attribute if it went red.
3. **It is exactly the pattern G-7 names** — *"closure rounds smuggle in features"*, generalised to *"bug-fix plans smuggle in cleanups"*.

**Instead:** plant it with a mechanical re-open trigger — *the first `MODEL_CAPABILITIES` row where `bool(forced_emission) != (emit_tier in {"force","force_strict"})`.* That trigger is a one-line test (the M-9 command), and if the planner wants a cheap guard, **adding that assertion as a test is a better use of this phase than changing the line**: it converts a latent drift into a gate that fires the day it stops being latent. ⚠ If added, it must be a **new** test, not a modification to a judge test, so a red result names the right thing.

---

## §E — Fitness annotation on `llm_emit` (D-12, D-15)

### E.14 — RECOMMENDATION: grouped `<optgroup>`, not a chip and not a suffix

**Recommendation: a grouped `<optgroup>` whose LABEL carries the user sentence, with the tier word appearing only under the ⌥ Technical-names reveal.**

Reasons:
1. **A native `<option>` cannot render markup.** A "chip" inside a `<select>` is necessarily a text suffix. So the real choice is *suffix vs grouping*, and grouping is strictly more informative for the same character budget.
2. **Grouping makes the distinction structural, not scanned.** The requirement is *"a `coerce` model is distinguishable from a `force`/`force_strict` one **before** selection"*. With a suffix, a user scanning a 69-row list must read each line. With `<optgroup>`, a `coerce` model can never appear adjacent to a `force` one — the distinction survives inattention.
3. **`<optgroup label>` is exactly the SEED-085 two-audience seam.** One string swaps under ⌥; the option text (the model id) never changes, so the value the user picks is never ambiguous.
4. It composes with `FieldLabel` / `hint` / `help` / `onPersist`-on-blur without restyling anything.

⚠ **`SelectField` (`PhaseFormPanel.tsx:337-379`) takes `options: readonly string[]` and cannot express groups.** Do **not** widen it — `ModelField` is its own component and should render its own `<select>` composing `FieldLabel`. Widening `SelectField` would put picker-shaped logic back into the panel file the D-20 fence guards.

### E.14b — The exact strings

**Group labels — `llm_emit` ONLY (D-12):**

| Tier | Default (user words) | ⌥ Technical names |
|---|---|---|
| `force_strict` | **`Can fill a document — guaranteed format`** | `emit_tier: force_strict` |
| `force` | **`Can fill a document`** | `emit_tier: force` |
| `coerce` *(incl. every unregistered / DB-only id)* | **`Best-effort only — may not fill a document`** | `emit_tier: coerce` |

**Non-`llm_emit` step types (`llm_single`, `llm_agent`, `llm_batch_agents`):** a **plain flat list, no groups, no tier** (D-12 — *"on `llm_single`/`llm_agent` the tier predicts nothing, and a warning that predicts nothing trains people to ignore the ones that do"*).

**The leading inherit option (D-05 / D-06) — the hedge is IN THE LABEL:**

> `Use the run's model — today that would be gpt-5.4`

⚠ **The `gpt-5.4` in that sentence is not a constant.** It is the value the server currently resolves as the org default (`app_settings.llm_model`, measured today: `deepseek-v4-flash`; the *sub-agent* default is `gpt-5.4-mini`; `gpt-5.4` is only what 18 phases happen to store). **The planner must decide which value the sentence names and read it from the server** — a hardcoded `gpt-5.4` would re-create the exact class of lie D-06 forbids. Recommended source: the union payload's `is_default` row, which `_registry_row` already stamps from `app_settings.llm_model` (`admin.py:1099`). If no default resolves, the sentence degrades honestly to `Use the run's model` with no clause — **never** to a guessed id.

⚠ **If no run-default can be resolved at all, do NOT fall back to a footer that asserts one.** D-06 is explicit: *"a bare `Effective: gpt-5.4` footer would assert a fixed default the code does not implement."*

**Retention labels:**

| State | Option text |
|---|---|
| stored value is **disabled** (D-07) | `<id> (current)` |
| stored value is **unknown** (D-08) | `<id> (current) — not in the registry` + a `caption` under the field: **`not in the registry — forced emission unavailable, document steps run best-effort`** |

D-08's consequence sentence is quoted verbatim from CONTEXT.md. Saving is **not** blocked (D-08).

### E.15 — Badging precedent + the logo seam

**`frontend/src/components/settings/ModelPillRow.tsx`** — read today. It ships:
- an inline **amber `unverified` chip** for ids absent from `verified_models` (`:124`)
- an **informational `deprecated` badge** with `title="This model is deprecated. It still works, but consider moving to a newer model."` (`:130-132`) — **badge only, no refusal, stays selectable** (D-149-05)
- the single-source logo seam: `import { providerLogo, modelLogo } from "@/lib/providerLogo"` (`:2`), used as `const PillMark = modelLogo(m) ?? ProviderMark` (`:105`) — the **`modelLogo` first, `providerLogo` fallback** order.

⚠ **`ModelPillRow` is a pill *row*, not a `<select>`** — its chips are DOM siblings. `ModelField` is a native `<select>`, which cannot host them. **Clone the vocabulary and the fallback order, not the markup.** The Phase 127 ICON CONVENTION binds regardless: any logo comes from `@/lib/providerLogo`, never a direct `@lobehub/icons` import.

⚠ **`deprecated` must stay selectable in `ModelField` too** (D-149-04 — *deprecated ≠ disabled*). The union row carries both flags; only `enabled=false` removes an option.

---

## §F — The picker component + the PhaseFormPanel seam (D-04 – D-08, D-20)

### F.16 — The component contract

Both shipped pickers were read in full. **`ModelDefaultPreference.tsx` is the closer analog** (two-layer governance + `(current)` retention + server-derived loop); `JudgeModelPicker.tsx` contributes the leading-auto-option shape.

**What to clone:** the `Array.from(new Set(...)).sort((a,b)=>a.localeCompare(b))` dedupe (`JudgeModelPicker:73`, `ModelDefaultPreference:69`); the `currentIsUnknown = !!value && !models.includes(value)` retention test (`:74` / `:70`); the `disabled:cursor-not-allowed disabled:opacity-70` classes.

**What NOT to clone:** the `useEffect` load + `useState` pair. **`ModelField` must not fetch.** Both shipped pickers own their own fetch because they are page-level cards. `ModelField` mounts **four times** inside a panel — four fetches per open is wrong, and the registry payload is a *panel-level* concern. **Fetch once at the panel's owner (`WorkflowBuilderPage` / the panel's existing data props) and pass `models` down** — this is also what keeps the D-20 fence satisfiable (no `useEffect` in the panel body).

**Proposed props:**

```
ModelFieldProps {
  value: string                        // cfg.model as stored ("" = inherit)
  onChange: (v: string) => void        // the panel's set("model")
  onPersist: () => void                // the panel's save-on-blur
  models: AuthorModelRow[]             // the union, fetched ONCE by the panel's owner
  runDefaultModel: string | null       // the is_default row's id, for D-06's clause
  showFitness?: boolean                // D-12 — true ONLY on the llm_emit mount
  showTechnical?: boolean              // SEED-085 ⌥ reveal, threaded from the existing panel flag
  disabled?: boolean
}
```

**Option assembly, in order:**
1. **Inherit** — `<option value="">Use the run's model{runDefaultModel ? ` — today that would be ${runDefaultModel}` : ""}</option>`
2. **`(current)` retention** — rendered **iff** `value !== "" && !offerable.some(m => m.model_id === value)`. Covers D-07 (disabled) and D-08 (unknown) with **one** branch; the *suffix* differs by whether the id appears in `models` at all.
3. **Offerable rows** — `models.filter(m => m.enabled)`, deduped, sorted. Grouped by fitness **iff** `showFitness`.

### F.16b — ⚠ The "must NOT rewrite a stored value as a side effect of being opened" property, and HOW to guarantee it

**This is the single most fence-able property in the phase, and both shipped pickers get it right by accident rather than by construction** — they persist in `onSelect`, which only a user gesture reaches.

**Guarantee it three ways, all cheap:**

1. **`ModelField` has NO `useEffect` and NO `useState` at all.** It is a pure function of props. A component with no effect cannot fire a write on mount. **Assert this with a source fence** — `grep` the component's `?raw` text for `useEffect`/`useState` and assert zero, with a positive control (the file is non-empty and contains `<select`), following the `StopControl.test.tsx` / `PhaseFormPanel.test.tsx` idiom already in the tree.
2. **`onChange` fires only from `<select onChange>`; `onPersist` only from `onBlur`.** Never call `onPersist` from a render path.
3. **A behavioural test:** render with `value="gpt-5.2"` (disabled) and `value="not-a-real-model"` (unknown), assert `onChange` and `onPersist` are **called zero times**, and assert the `<select>` reports the stored value as selected. This is the test that would have caught a "normalise on mount" implementation, and it is the one a reviewer will look for.

⚠ **The same property must hold at the PANEL level.** `PhaseFormPanel` persists on blur; a `<select>` fires `blur` when the user tabs past it *without changing it*. Verify `onPersist` is idempotent for an unchanged value — `SelectField` (`:361`) already wires `onBlur={props.onPersist}` for `citation_policy` and has shipped that way since 185, so the existing behaviour is the precedent. `[VERIFIED: source read]` — but a plan should still assert it for the new field, because "the old field did it too" is not the same as "it is correct."

### F.17 — The EXACT one-gated-line mount shape (D-20)

**The fence, located and read:**
`frontend/src/components/workflows/PhaseFormPanel.test.tsx:481-497` —
> `it("SOURCE — the mount really is ONE gated line and the panel computes nothing for it")`

It asserts, on `phaseFormPanelSource` (a `?raw` import at `:23`):
```js
const mounts = phaseFormPanelSource.split("\n").filter(l => l.includes("<TemplateNameCheck"))
expect(mounts).toHaveLength(1)
expect(mounts[0]).toContain('pt === "llm_emit"')
expect(mounts[0]).toContain("{...nameCheck}")
```

**The shipped line it guards (`PhaseFormPanel.tsx:1116`):**
```jsx
{nameCheck && pt === "llm_emit" && <TemplateNameCheck {...nameCheck} />}
```

⚠ **That fence is scoped to `<TemplateNameCheck` — it will NOT fire on a `ModelField` mount.** The phase must **add its own fence in the same shape** (the ledger's standing order is *"one gated line"*, and 193.1's contribution was making it mechanical rather than promised).

**Recommended mount lines — four, one per phase type, each ONE line:**
```jsx
{pt === "llm_single"        && <ModelField {...modelField} value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />}
{pt === "llm_agent"         && <ModelField {...modelField} value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />}
{pt === "llm_batch_agents"  && <ModelField {...modelField} value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} />}
{pt === "llm_emit"          && <ModelField {...modelField} value={asStr(cfg.model)} onChange={set("model")} onPersist={onPersist} showFitness />}
```
where `modelField` is **one new prop** on the panel carrying `{models, runDefaultModel, showTechnical}`, forwarded **whole** via spread — matching `{...nameCheck}`'s shape, which the existing fence explicitly rewards.

**The new fence to write (mirroring `:481-497` exactly):**
```js
const mounts = phaseFormPanelSource.split("\n").filter(l => l.includes("<ModelField"))
expect(mounts).toHaveLength(4)
expect(mounts.map(m => m.match(/pt === "(\w+)"/)?.[1]).sort())
  .toEqual(["llm_agent","llm_batch_agents","llm_emit","llm_single"])
mounts.forEach(m => expect(m).toContain("{...modelField}"))
expect(mounts.find(m => m.includes('pt === "llm_emit"'))).toContain("showFitness")
```

**⚠ What a planner must mechanically avoid (the property the 193.1 fence guards):**

| Forbidden **in the panel body** | Why |
|---|---|
| `useMemo(` | the 193.1 diff was measured at **zero** added lines containing it |
| `useState(` / `useState<` | same |
| `useEffect(` | same — and it would also break F.16b's no-write-on-open guarantee |
| `.filter(` | option filtering belongs in `ModelField` |
| `.map(` | option rendering belongs in `ModelField` |
| widening `SelectField` to take groups | puts picker logic back in the panel file |

**Verify with the same recipe the ledger records:** the panel diff for this phase must contain **zero** added lines matching `useMemo|useState|useEffect|\.filter\(|\.map\(`. That is a one-command check and belongs in the plan's acceptance criteria, not in prose.

⚠ **Also note:** `PhaseFormPanel.rails.test.tsx:485-497` asserts capability names are **absent** from the panel source, and `:500` asserts `<ToolsField` appears exactly **twice**. Neither is affected by a `ModelField` mount, but a planner adding text to the panel should re-read both before assuming.

### F.18 — D-04 re-verified

M-3: **242 definitions / 257 phases / 239 blank / 18 `gpt-5.4` / 10 definitions carrying any model.** ✅ Exact agreement.

**Zero-migration for the picker: CONFIRMED** — `config.model` is `str | None` on all four config classes, the JSONB shape is unchanged, and `gpt-5.4` is registry-known **and** enabled (M-7), so all 18 stored values survive as a normal offerable option under any candidate list. ⚠ **This claim is scoped to the picker.** D-14 needs migration `120_` (M-5).

---

## §G — Folded bug D-17 (the judge knob)

### G.19 — The four consumers, with file:line measured today

| # | Consumer | Wrong import | Wrong call |
|---|---|---|---|
| 1 | Eval judge — the shot | `backend/app/services/eval_runner_service.py:305` `from app.config import get_model_capability, settings` | `:312` `model = resolve_judge_model(settings)` |
| 2 | Eval judge — the recorded model | `backend/app/services/eval_runner_service.py:640` `from app.config import settings` | `:645` `judge_model = resolve_judge_model(settings)` |
| 3 | Publish-gauntlet judge | `backend/app/services/harness/publish_service.py:1136` `from app.config import get_model_capability, settings` | `:1148` `model = resolve_judge_model(settings)` |
| 4 | In-run `llm_judge_rubric` validator | `backend/app/services/harness/validator_kinds.py:534` `from app.config import settings` (function-local) | `:536` `model = resolve_judge_model(settings)` |

⚠ `resolve_judge_model` itself is **CORRECT** (`validator_kinds.py:65-87`) — it reads whatever object it is handed. **The defect is entirely in what the four consumers hand it.** Do not change the resolver's signature or its order.

### G.19b — The DB-backed pattern to adopt

| Piece | Where |
|---|---|
| The right type | `UserEffectiveSettings` — `backend/app/models/user_settings.py`, carrying `harness_judge_model: str = ""` at **`:231`**, populated from the DB row at **`:910`** (`harness_judge_model=str(_val(row, "harness_judge_model", None, ""))`) |
| The right loader | `async def load_app_settings_async() -> UserEffectiveSettings` — `backend/app/models/user_settings.py:947-954`. Refreshes from DB on TTL expiry and warms the all-rows override cache. |
| **A call site to copy** | `backend/app/api/skill_tuner.py:728-730` — the function-local-import form (Pitfall 4 discipline), which is what a *service* module needs: `from app.models.user_settings import load_app_settings_async  # function-local` then `eff = await load_app_settings_async()` |

⚠ **All four consumers already sit in `async` functions**, so `await load_app_settings_async()` needs no signature change at any of the four sites. The change at each is: replace the `settings` import with the loader, and replace `resolve_judge_model(settings)` with `resolve_judge_model(await load_app_settings_async())`.

⚠ **`load_app_settings_async` is not free** — it can read the DB on a cold TTL. Consumers 1/3/4 call it once per judge shot (negligible). **Consumer 2 (`eval_runner_service.py:645`) sits inside a per-arm loop.** Resolve it **once** above the loop and pass it down, or the eval matrix gains an N× settings read. `[VERIFIED: source read — the call is inside the per-arm `else` branch]`

⚠ **Consumer 4 has a precedence chain** (`validator_kinds.py:533-536`): `config.get("model")` → `ctx.judge_model` → the resolver. **Only the third rung changes.** Do not collapse the chain.

⚠ **`app_settings` has RLS DISABLED** (measured: `relrowsecurity = false`) and is read through the service-role settings path. That is the shipped posture for a global singleton row; this change introduces no new exposure.

### G.20 — ⚠ **BINDING: the exact test**

The report's condition is not optional: *"the fix MUST include a test that sets the row and asserts the RESOLVED model changes — the absence of that test is why this survived from 2026-07-31 to 2026-08-17."*

**Why the existing tests missed it — measured, and it dictates the fixture choice.** `backend/tests/unit/test_settings.py:17-65` and `test_skill_builder_model.py` both drive the resolver with a hand-built `SimpleNamespace(harness_judge_model=...)`. **A `SimpleNamespace` test can never catch this bug**, because the defect is *which object the consumer chooses*, and a test that supplies the object has already made that choice for it. **The new test must NOT pass a settings object.**

**Recommended test:**

| Property | Value |
|---|---|
| **File** | `backend/tests/unit/test_196_judge_model_db_backed.py` (new file — a *new* file, so a red result names D-17 and nothing else) |
| **Fixture** | `monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake_load)` — the **shipped idiom**, used at `tests/test_149_default_guard.py:56,106`, `tests/test_150_backpressure_secrets.py:47,141`, `tests/unit/test_168_sso_provider_service.py:223`. It patches the DB read at the bottom of the chain, so the **whole real path runs**: `_load_settings_from_db → _build_settings_from_row → UserEffectiveSettings → resolve_judge_model`. |
| **Also required** | `monkeypatch.setattr("app.config.settings.harness_judge_model", None)` (or leave it None — measured None today) so the test proves the value came from the **row**, not from the env. ⚠ Without this the test can pass for the wrong reason. |
| **Assertion** | Set the fake row's `harness_judge_model` to a value that is **NOT** either fallback candidate — e.g. `"deepseek-v4-pro"` (the operator's real value, and neither `claude-opus-4-8` nor `gpt-5.5`) — and assert each consumer's resolved model **equals it**. |
| **Coverage** | **One case per consumer, four cases** — not one case on the resolver. The defect is per-consumer, so a single shared case would let three of four regress silently. |
| **The negative control** | A fifth case: with the row set to `""`, assert the resolved model falls back to `claude-opus-4-8` — proving the test is reading the resolver, not a constant. |
| **RED first** | Every one of the four must be **driven RED against today's `develop`** before the fix. That is the whole point of the report's condition. |

⚠ **Consumers 1–3 call the resolver inside larger functions that make LLM calls.** The test must reach the resolution *without* a network shot — either by extracting the resolve into a tiny named helper per consumer (adds surface) or by patching `forced_emit` and asserting the `model=` it was called with. **Recommend the latter** — asserting the argument `forced_emit` actually received is a *stronger* claim than asserting a helper's return, and it is exactly the shape the report asks for (*"the RESOLVED model changes"*).

### G.21 — Reproduction on today's HEAD

✅ **Reproduces exactly** — see M-4. Today's values: row `deepseek-v4-pro` · env `None` · resolved `claude-opus-4-8`.

⚠ **The fallback is a top-tier model** (`claude-opus-4-8`), so the knob fails in the **expensive** direction while the operator's stated goal was to spend less — and the publish-gauntlet judge is a **hard wall**. Both re-confirmed by reading `resolve_judge_model` and the publish stage list.

⚠ **After the fix, the resolved judge on this machine becomes `deepseek-v4-pro`** (`emit_tier: force`, provider `deepseek`, ⚠ `strict_json_schema` inert — D-122-04 / no `/beta` base_url). **That is a live behaviour change to the publish gauntlet on the operator's own box.** It is the correct behaviour (the knob obeys), but it must be called out in the plan and in UAT — a publish that used to be graded by Opus will now be graded by DeepSeek.

---

## §H — Folded bug D-18 (chat composer model restore)

### H.22 — ⚠ **DIVERGENCE:** the model is not stored on `messages`

**Measured:** `public.messages` columns are `id, thread_id, user_id, role, content, created_at, updated_at, tool_calls, source_refs, confidence_level, confidence_avg_similarity, confidence_disclaimer, reasoning_content, origin, org_id`. **There is no `model` column.**

**Where the model actually lives:** `public.runs.model` (+ `runs.provider`, `runs.thread_id`, `runs.message_id`). Measured: 0 rows with a null model; **121 rows read `model='unknown', provider='unknown'`**.

**How it reaches the client — and it DOES:** `MessageResponse` (`backend/app/models/message.py:60-70`, Phase 095.1-03 D-04) carries `model` / `provider` / `started_at` / `completed_at`, *"stamped additively by `_enrich_messages_with_runs` from the SAME runs↔messages join … NO migration — runs already carries these."* The frontend `Message` type declares `model?: string` (`src/types/index.ts:178`) and `api.ts:219-220` maps `model: model ?? undefined, provider: provider ?? undefined`.

**Verdict on D-18:** the **decision is correct and the mechanism works**; the *premise sentence* ("every message persists the model it used") is imprecise in a way that changes the implementation. **No new storage, no schema change, no migration — CONFIRMED.** ✅

### H.22b — The exact derivation

**Which query/hook already returns it:** `useMessages()` (already consumed by `ChatArea.tsx:52-58`) holds the messages, which come from `GET /threads/{id}/messages` (`threads.py:651`) or `GET /threads/{id}/snapshot` (`threads.py:387`, whose `messages: list[MessageResponse]` is *"the same shape as GET /threads/{id}/messages"*). **Both already carry `model` and `provider`. No API change.**

**The rule:**
```
lastUsed = the LAST message in thread order for which
             m.model is truthy  AND  m.model !== "unknown"
           (user messages carry no run row → model is undefined; skip them)
```

**Four guards, each measured:**

| Guard | Why | Evidence |
|---|---|---|
| skip `undefined` | user-role messages have no run row | `MessageResponse.model: str \| None = None`, *"a legacy / pre-run-backed assistant message returns null"* |
| skip `"unknown"` | **121 live rows** carry it | measured `select model, count(*) from runs group by 1` |
| require the model be **enabled** in the union | D-18 says so and D-07 supplies the rule | reuses §A.3's `enabled` semantics — **not** `allowed_models` |
| restore **`provider` too**, before the model | `ChatArea.tsx:201` `handleProviderChange` sets `setSelectedModel(p.models[0] ?? "")` — restoring the model without the provider is clobbered on the next provider read | source read |

**Fallback chain (in order):** last-used enabled model → the existing `active_model` global-default seed (`ChatArea.tsx:154-156`) → `activeProvider.models[0]` → `""`. That is the shipped chain with one rung prepended.

⚠ **The known blind spot, named in the bug's own re-open trigger:** a thread whose last message predates run-backed attribution has no model. The fallback chain handles it — but the plan should state that the restore is **best-effort by design**, not a guarantee, and that a thread showing the global default is not necessarily a failure.

### H.23 — ⚠ G-5 on `frontend/src/components/chat/ChatArea.tsx`

**Measured:** `61 commits / 29 phases / 587 L` — **G-5 FIRES HARD.** The ledger calls it *"the strongest extraction case on the frontend side"* and records 194.1's honouring as a **measured test**: *"`useState[(<]` 7 → 7 · `useEffect(` 4 → 4 · props 8 → 8 — every one unmoved."*

⚠ **A naive D-18 implementation adds a `useEffect` and therefore fails that exact test (4 → 5).** This is the one place in this phase where G-5 genuinely bites.

**RECOMMENDATION: take a named narrow seam — extract the composer's model/provider selection into a leaf hook.**

```
frontend/src/hooks/useComposerModel.ts        # NEW
  useComposerModel({ threadId, messages }) -> {
    providers, selectedProvider, models, selectedModel, deprecatedModels,
    setSelectedModel, handleProviderChange
  }
```

Moves **out of `ChatArea.tsx`**: 5 `useState` (`providers`, `selectedProvider`, `models`, `selectedModel`, `deprecatedModels` — `:59-65`), the provider-load `useEffect` (`~:140-158`), and `handleProviderChange` (`:198-205`). Adds **1 destructure**.

**Why this is the right call and not scope creep:**
- The ledger's standing order is *"the next surface that needs the panel gets its own component"* — the frontend-hook analogue is exactly this.
- It nets the measured counts **DOWN**: `useState` 7 → 2, `useEffect` 4 → 3. A file that *loses* five state hooks has honoured G-5 by any reading.
- The new restore logic then lives in the hook, where it belongs, and is unit-testable **without rendering ChatArea** — which matters because `ChatArea` is expensive to render in a test.
- ⚠ **The ledger's hard fence survives:** `grep -c "onStop" ChatArea.tsx` must stay **0**, and this extraction touches nothing named `onStop`. Confirm in the plan.

**Cost:** ~40 lines moved, one new file, one new test file. **Cost of the alternative** (adding a `useEffect` and recording a G-5 override in `STATE.md`): a permanent entry in the override ledger on the file the ledger already calls its strongest extraction case, to save ~40 lines of movement. **Not worth it.**

⚠ **D-23 obligation:** `ChatArea.tsx` **is** in the ledger — its row + section must be re-derived at close, and the *new* `useComposerModel.ts` becomes a young-file row.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Compose the DEF ∪ OVR ∪ DB-only union | A second union loop in the new route | `_registry_row` + `get_model_registry`, **extracted** (§A.2) | D-02. Two unions drift; the shipped one already handles null-clears-to-DEF, `overridden_fields`, and the WR-04 absent-vs-zero rule. |
| Fall back from a disabled model + tell the user | A harness-local disabled check | `_resolve_enabled_model` (`run_model_resolution.py:35`) | D-10. It already handles the **dead-default** case (`:73-79`) that a fresh implementation would miss. |
| Keep an unknown stored value selectable | A custom "is it in the list" branch | The `currentIsUnknown` idiom (`ModelDefaultPreference.tsx:70`, `JudgeModelPicker.tsx:74`) | Shipped twice, identical both times. |
| Refuse an out-of-set model on write | A new refusal vocabulary | `me_preferences.py:87-96`'s 400 shape | D-09 names it as the precedent. |
| Provider / model logos | A local icon map | `modelLogo()` / `providerLogo()` from `@/lib/providerLogo` | Phase 127 ICON CONVENTION — single-source **everywhere**. |
| A default when `emit_tier` is absent | A tier lookup table | `?? "coerce"`, mirroring `forced_emit.py:376` | D-122-05. A second default table would drift from the ladder. |
| Read a DB-only model's capability | `get_model_capability` (sync) | `get_model_capability_async` or the union payload | The sync path never reads the DB — measured: `glm-4.7-flash` → `capability_source="inferred"`, `emit_tier=None`. |
| A new harness audit event kind | Minting a 25th kind | The existing `policy_applied` | `db/workflows.py:107-110` records why: registering in one layer **moves** the failure rather than removing it. |
| Test the judge fix with a settings stand-in | `SimpleNamespace(harness_judge_model=...)` | `monkeypatch.setattr("app.models.user_settings._load_settings_from_db", ...)` | §G.20 — the SimpleNamespace form is *why the bug survived*. |

**Key insight:** almost every capability this phase needs is already implemented **one seam away from where it is needed**. The failure mode to guard against is not "we can't build it" — it is "we built a second one that agrees today and drifts next quarter." Three of the four bugs this phase touches are exactly that: two things that should be one thing.

---

## Runtime State Inventory

> Included because this phase changes what a stored value **means** and adds a column. It is not a rename phase, but the same class of blindness applies.

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | `workflow_definitions.definition` JSONB — **257 phases, 239 blank, 18 `gpt-5.4`** (M-3). `gpt-5.4` is registry-known + enabled, so **zero rows need migration**. **Zero** rows are in the D-08 unknown state. | **None** — code change only. ⚠ Re-derive at execution time; an operator can author a new workflow between now and then. |
| **Live service config** | `app_settings.harness_judge_model = 'deepseek-v4-pro'` — set in the UI, stored in the DB, **currently ignored** (M-4). After D-17 it becomes live. | **No data change — but a live BEHAVIOUR change** on the operator's own box (§G.21). Call it out in the plan and UAT. |
| **OS-registered state** | **None** — verified: no scheduled task, pm2 process or service reads a model id. This phase adds no process. | None |
| **Secrets / env vars** | ⚠ `settings.harness_judge_model` is env-backed and reads **`None`** today (M-4) — **there is no `HARNESS_JUDGE_MODEL` in `backend/.env`**. D-17 makes the DB row authoritative; **no env var is renamed, removed or read differently by any other consumer**. All 8 provider keys are set via env (measured). | **None.** ⚠ Do **not** delete `Settings.harness_judge_model` (`config.py:1160`) in this phase — `resolve_judge_model`'s `getattr` would still work, but removing a field while changing its consumers makes a red test ambiguous. |
| **Build artifacts / installed packages** | **None** — no package added, no image rebuild. ⚠ `SANDBOX_IMAGE` / `Dockerfile.sandbox` are **untouched**, so the same-commit sync rule does not fire. | None |
| **DB schema** ⚠ | `model_capabilities_overrides` **gains `emit_tier`** (M-5, migration `120_`). 37 existing rows get `NULL` → read-time `coerce` → **byte-identical behaviour** to today for every existing row. | **Paste `120_` into the Supabase SQL editor** (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh`. ⚠ **Cloud parity:** `120_` must be applied to cloud Supabase in the same operation as any deploy of this code. |

---

## Common Pitfalls

### Pitfall 1 — Assuming the overlay list is the whole `emit_tier` change
**What goes wrong:** the plan adds `"emit_tier"` to `config.py:717-718`, ships, and the value is `NULL` for every row forever because the column does not exist.
**Why it happens:** SEED-135 calls it *"a one-line prerequisite"*, which is true of the list and false of the feature.
**How to avoid:** migration `120_` is task **one**, and the overlay edit is downstream of it.
**Warning sign:** a plan whose D-14 task list has fewer than 7 artifacts (§D.11).

### Pitfall 2 — Two `enabled` semantics leaking into one surface
**What goes wrong:** the picker reads `allowed_models` semantics (34) while the harness enforces `_registry_row` semantics (66). A model the picker refuses to offer runs fine; a model it offers is refused nowhere. Both directions are lies.
**Why it happens:** two shipped helpers answer the same-sounding question differently (M-6).
**How to avoid:** one function — `build_model_registry_rows()` — feeds the picker, the refusal and the harness check. Never `enabled_model_allowed_set()` in this phase.
**Warning sign:** `enabled_model_allowed_set` appearing in a plan's `files_modified` diff outside `me_preferences.py`.

### Pitfall 3 — The picker normalises a stored value on open
**What goes wrong:** viewing a workflow rewrites `config.model` (dropping a disabled or unknown value), so *reading* a workflow silently edits it. D-07 forbids exactly this.
**Why it happens:** a `useEffect` that "syncs" `value` into the options list is the natural React reflex.
**How to avoid:** `ModelField` has **no** `useEffect` and **no** `useState` (§F.16b), fenced on source and asserted behaviourally.
**Warning sign:** any `useEffect` in `ModelField.tsx`.

### Pitfall 4 — Testing only with `gpt-5.4`
**What goes wrong:** every check passes and nothing is proven — `gpt-5.4` is registry-known, enabled, `force_strict`, and in both shipped lists (M-7).
**How to avoid:** the four interesting values are verified in-state today (M-7). Use `gpt-5.2` (disabled), `gpt-5.5` (code-only, absent from `allowed_models`), `glm-4.7-flash` (DB-only, local, `coerce`), `gemini-3.6-flash` (DB-only, absent from `verified_models`).
**Warning sign:** `<specifics>` says it outright; a test file mentioning only `gpt-5.4` is the tell.

### Pitfall 5 — The judge test that cannot fail
**What goes wrong:** a test builds `SimpleNamespace(harness_judge_model="x")`, hands it to `resolve_judge_model`, gets `"x"`, and passes — against both the broken and the fixed code.
**Why it happens:** it is the existing idiom in `test_settings.py:17-65` and `test_skill_builder_model.py`.
**How to avoid:** patch `_load_settings_from_db` and assert **per consumer** (§G.20). Drive all four RED first.
**Warning sign:** the word `SimpleNamespace` in the new judge test file.

### Pitfall 6 — Restoring the model without the provider
**What goes wrong:** `selectedModel` is restored, then a provider read fires `handleProviderChange` (`ChatArea.tsx:198-205`) which does `setSelectedModel(p.models[0] ?? "")` and clobbers it. The bug appears fixed on mount and broken after any provider interaction.
**How to avoid:** restore `provider` first, `model` second, in the same hook (§H.22b).
**Warning sign:** a UAT row that passes on refresh but fails after touching the provider control.

### Pitfall 7 — Reading `emit_tier` through the SYNC capability helper
**What goes wrong:** `get_model_capability("glm-4.7-flash")` returns `capability_source="inferred"` with **no** `emit_tier` even after the DB column exists — because the sync path never reads the DB. A server-side fitness computation would then report `coerce` for a model the operator explicitly set to `force`.
**How to avoid:** compute fitness **client-side from the union payload**, or use `get_model_capability_async`.
**Warning sign:** `from app.config import get_model_capability` in any new fitness code.

### Pitfall 8 — Growing `PhaseFormPanel.tsx` while believing you didn't
**What goes wrong:** the mount looks like one line but the panel gains a `useMemo` to build `models`, and the 193.1 property is broken without the existing fence noticing (it only watches `<TemplateNameCheck`).
**How to avoid:** fetch the union at the panel's **owner**; write the new four-line fence (§F.17); assert **zero** added lines matching `useMemo|useState|useEffect|\.filter\(|\.map\(` in the panel diff.
**Warning sign:** `models` being computed anywhere inside `PhaseFormPanel.tsx`.

### Pitfall 9 — Chasing SEED-171's flaky suites
**What goes wrong:** the count gate reds on `WorkflowCard.test.tsx` (which lives under the gated `src/components/workflows` bare directory) and a plan re-runs it, adjusts `GSD_VITEST_MAX_WORKERS`, or "fixes" a suite it never touched.
**How to avoid:** capture the failing filenames from the gate's **own persisted JSON report BEFORE re-running anything**; check against `git diff --numstat`; if byte-unchanged and one of SEED-171's three, record as an observation. ⚠ **One green sample is not proof of innocence** — say *"provably unmodified"*, never *"fine"*.
**Warning sign:** a plan whose acceptance criterion is *"the gate is green"* with nothing else.

---

## Code Examples

### The one-gated-line mount shape (the property the fence guards)

```jsx
// Source: frontend/src/components/workflows/PhaseFormPanel.tsx:1116 — the SHIPPED example
{nameCheck && pt === "llm_emit" && <TemplateNameCheck {...nameCheck} />}
```

### The shipped `(current)` retention idiom

```tsx
// Source: frontend/src/components/settings/ModelDefaultPreference.tsx:67-70, 94-103
const models = Array.from(new Set(pref?.allowed_models ?? [])).sort((a, b) => a.localeCompare(b))
const currentIsUnknown = !!defaultModel && !models.includes(defaultModel)
// ...
<option value="">Auto · {pref?.effective_model || "organization default"}</option>
{currentIsUnknown && defaultModel && (
  <option value={defaultModel}>{defaultModel} (current)</option>
)}
{models.map((m) => <option key={m} value={m}>{m}</option>)}
```

### The shipped 400-on-out-of-set refusal (the D-09 shape)

```python
# Source: backend/app/api/me_preferences.py:87-96
if desired is not None:
    allowed = await enabled_model_allowed_set()
    if desired not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "That model is not in your organization's enabled set. "
                "Pick a model your administrator has enabled."
            ),
        )
```

### The shipped disabled-model fallback D-10 routes through

```python
# Source: backend/app/services/run_model_resolution.py:35-81 (abridged)
async def _resolve_enabled_model(resolved_model: str, org_default: str) -> tuple[str, dict | None]:
    overrides = await load_all_model_overrides()
    is_disabled = (overrides.get(resolved_model) or {}).get("enabled") is False
    if is_disabled and org_default and org_default != resolved_model:
        notice = {
            "disabled_model": resolved_model,
            "fallback_model": org_default,
            "message": f"{resolved_model} was disabled by your administrator — "
                       f"this reply used {org_default}.",
        }
        return org_default, notice
    return resolved_model, None
```

### The shipped DB-settings test fixture (§G.20's fixture)

```python
# Source: backend/tests/test_149_default_guard.py:56 (idiom, repeated at 4 more sites)
monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake)
```

### The read-time `coerce` default the client must mirror

```python
# Source: backend/app/services/forced_emit.py:376-378
emit_tier = cap.get("emit_tier", "coerce")
if emit_tier not in _RUNGS_BY_TIER:  # boundary guard — an unknown value is coerce-safe
    emit_tier = "coerce"
```

---

## Project Constraints (from CLAUDE.md)

| Directive | How it binds this phase |
|---|---|
| Python backend must use a `venv` | All backend commands run via `backend/venv/Scripts/python.exe` |
| **No LangChain, no LangGraph — raw SDK calls only** | Unaffected — no LLM-call-path change |
| **Use Pydantic for structured LLM outputs** | The new `AuthorModelRow` response model is Pydantic; the judge verdict schema is unchanged |
| **All tables need RLS** | ⚠ Migration `120_` **adds a column, not a table** — no new policy needed. `model_capabilities_overrides` already carries `model_overrides_read_all` (§J.2) |
| Stream chat responses via SSE | D-10's honest notice rides the **existing** producer stream (`_emit_phase_substep`) — no new wire path |
| **Schema changes ship as numbered SQL migrations** matching `<digits>_name.sql` | `120_model_capabilities_overrides_emit_tier.sql` — **no letter suffix** (`120b` is silently skipped by the CLI) |
| **Apply each migration by pasting into the Supabase SQL editor — never `db push`/`db reset`** | Binding. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`). **Never hand-edit `full-schema.sql`.** |
| **No blocking I/O in async handlers** | The new route uses `asyncpg` via `load_all_model_overrides` / `_load_settings_from_db` — no `supabase-py` call. ✅ |
| Settings live in `user_settings` / `app_settings`; env vars are for secrets and infra | ⚠ **This is precisely D-17's defect** — a setting was being read from env. The fix restores the rule. |
| **Provider-docs-first (evidence-based)** | This phase surfaces `emit_tier`, whose values are already doc-verified per provider (D-122-04). It **adds no new provider claim** — see §Open Q2. |
| **UAT scoreboard recipe — the FULL native roster, DERIVED from `MODEL_CAPABILITIES`** | §Validation Architecture — derived, published, **9 groups today, not 8** |
| Deployment-artifact parity (same-commit rule) | ⚠ **Check at plan time:** `120_` is a schema migration with **no seed rows** and no new env var, so `deploy/onebox.env.example` / `docs/OPERATOR.md` Step-3 / `docker-compose.prod.yml` are likely untouched. Run `scripts/check-deploy-drift.sh`; do not assume. |
| `GSD_VITEST_MAX_WORKERS=2`; the count gate contract | §Validation Architecture |
| Reported-bugs cross-check at `plan-phase` | ⚠ **BINDING:** verify `BUG-260731-01` and `BUG-260718-04` (both `folded_into: 196`) are each covered by ≥1 plan task. Update their frontmatter at plan time. `BUG-260809-01` stays `open`. |
| Hot-file ledger SAME-COMMIT SYNC RULE | §K.30 lists which rows/sections this phase owes at close (D-23) |

---

## Validation Architecture

> `workflow.nyquist_validation` is **`true`** in `.planning/config.json` — this section is required.

### Test Framework

| Property | Backend | Frontend |
|---|---|---|
| Framework | pytest + pytest-asyncio | vitest + @testing-library/react |
| Config file | `backend/pytest.ini` / `pyproject` | `frontend/vitest.config.*` |
| Quick run command | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_196_*.py -x -q` | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/ModelField.test.tsx` |
| Full suite command | `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` | `cd frontend && GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |
| Typecheck | — | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` ⚠ **the `-p` is load-bearing** — bare `tsc --noEmit` checks ZERO files |

### Phase requirements / criteria → test map

| Req / Criterion | Behaviour | Layer | Command | Exists? |
|---|---|---|---|---|
| **SC#1** | The union route returns 69 rows: 61 code ∪ 8 DB-only | integration | `pytest backend/tests/test_196_model_registry_route.py::test_union_size -x` | ❌ Wave 0 |
| **SC#1** | The route is reachable by a **non-operator** and NOT 404 | integration | `…::test_non_operator_can_read -x` | ❌ Wave 0 |
| **SC#1** | `GET /admin/models` still 404s a non-operator (the gate was not widened) | integration | `…::test_admin_route_still_gated -x` | ❌ Wave 0 |
| **SC#1** | `ModelField` renders only ids from the payload; no free-text input | unit (render) | `vitest ModelField.test.tsx -t "registry-only"` | ❌ Wave 0 |
| **SC#1** | The panel mounts it as **exactly 4 one-line gated mounts** | unit (source fence) | `vitest PhaseFormPanel.test.tsx -t "ONE gated line"` | ⚠ exists for `TemplateNameCheck`; **a new one is owed** |
| **SC#1 / D-20** | The panel body gains **zero** `useMemo\|useState\|useEffect\|.filter(\|.map(` lines | **manual / CI grep on the diff** | `git diff -U0 -- …/PhaseFormPanel.tsx \| grep '^+' \| grep -cE 'useMemo\|useState\|useEffect\|\.filter\(\|\.map\('` → must be `0` | ❌ Wave 0 |
| **SC#2** | `POST`/`PATCH /workflows` with `config.model="not-a-real-model"` → **400** | integration | `pytest backend/tests/test_196_save_refusal.py -x` | ❌ Wave 0 |
| **SC#2** | A **blank** model still saves (D-04) | integration | `…::test_blank_still_saves -x` | ❌ Wave 0 |
| **SC#2** | An already-stored **unknown** model still saves (D-08 — retiring a row must not brick a workflow) | integration | `…::test_stored_unknown_still_saves -x` | ❌ Wave 0 |
| **SC#2** | An unknown value is kept as `(current)` **and** names its consequence | unit (render) | `vitest ModelField.test.tsx -t "unknown keeps and names"` | ❌ Wave 0 |
| **SC#2** | ⚠ Opening the form **never** calls `onChange`/`onPersist` (D-07) | unit (render) | `vitest ModelField.test.tsx -t "does not rewrite on open"` | ❌ Wave 0 |
| **D-10** | A disabled per-phase model falls back to the run model **with a notice** | unit | `pytest backend/tests/unit/test_196_harness_enabled_check.py -x` | ❌ Wave 0 |
| **D-10** | An **enabled** model is byte-identical (no fallback, no notice) | unit | `…::test_enabled_is_noop -x` | ❌ Wave 0 |
| **D-13/D-14** | `emit_tier` reaches the client on every union row | integration | `…test_196_model_registry_route.py::test_emit_tier_on_wire -x` | ❌ Wave 0 |
| **D-14** | A DB `emit_tier` override wins over the code value | integration | `pytest backend/tests/test_196_emit_tier_overlay.py -x` | ❌ Wave 0 |
| **D-14** | An off-allowlist `emit_tier` PATCH → **422 before any DB touch** | integration | `…::test_bad_tier_422 -x` | ❌ Wave 0 |
| **D-12/D-15** | `llm_emit` groups by fitness in **user words**; other types do not group | unit (render) | `vitest ModelField.test.tsx -t "fitness"` | ❌ Wave 0 |
| **D-17** ⚠ | **Each of the 4 consumers** resolves the model set in `app_settings` | unit ×4 + 1 control | `pytest backend/tests/unit/test_196_judge_model_db_backed.py -x` — **RED-first, all 4** | ❌ Wave 0 — **BINDING** |
| **D-18** | A thread restores its last-used enabled model across **navigate AND refresh** | unit (hook) + **manual UAT** | `vitest useComposerModel.test.ts` + UAT row U-C1 | ❌ Wave 0 |
| **D-18** | `'unknown'` and `undefined` models are skipped | unit (hook) | `…-t "skips unknown"` | ❌ Wave 0 |
| **D-18** | A **disabled** last-used model falls back (reuses D-07) | unit (hook) | `…-t "disabled falls back"` | ❌ Wave 0 |
| **SC#3** | The app-wide sweep was not attempted | **negative fence** | assert no plan's `files_modified` names `SettingsPage.tsx`, `ModelPillRow.tsx`, or changes `verified_models` | ❌ Wave 0 |

### ⚠ What CANNOT be proven by a unit test

| Claim | Why not | The layer that CAN prove it |
|---|---|---|
| *"the operator's judge knob now takes effect"* | A unit test proves the resolver returns the row's value; it cannot prove a real publish shot routed to that provider | **manual UAT** — set the knob, run a real publish, read `workflow_runs` / `harness_audit` `judge_verdict` metadata for the model actually used |
| *"a thread restores its model across refresh"* | jsdom has no page reload; a hook test proves the derivation, not the lifecycle | **manual UAT / Chrome MCP** — refresh and read the composer's DOM value |
| *"a `coerce` model is distinguishable BEFORE selection"* | A render test proves the markup exists; it cannot prove a human sees it | **operator UAT (G-4)** — the lived-experience row |
| *"the harness fallback notice is visible in the run surface"* | The emit is testable; the PhaseCard rendering of a new `status` is a separate surface | **manual UAT** on a real workflow run |
| *"an unregistered model cannot be silently selected"* — the **silently** | Coverage of the honest-consequence copy is a judgement | **operator UAT** |
| *"`emit_tier` for a local LM Studio model is correct"* | Requires LM Studio running | **manual, blocked today** (§Environment Availability) |

### Sampling rate

- **Per task commit:** the touched suite only, e.g. `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/ModelField.test.tsx`, plus `pytest tests/unit/test_196_*.py -x`
- **Per wave merge:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` + `pytest backend/tests -q` + `npx tsc --noEmit -p tsconfig.app.json`
- **Phase gate:** both suites green (per the gate's own contract, below) before `/gsd:verify-work`

### ⚠ Count-gate contract and coverage (Q27)

**The contract is NOT a fixed total.** It is: **no per-file DECREASE** and **zero failing**. A growing grand total is the gate **working**. Re-derive with `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` and read the **verdict line**, never a summary. The last recorded figure (`4170 · pinned 4096 · 83/83`, 2026-08-17) is a *reading*, not a target, and this document does not restate it as a goal.

**Are this phase's suites gated?** Measured — `TARGETS` has exactly **one** bare-directory entry:

| Suite this phase touches | In `TARGETS`? | Consequence |
|---|---|---|
| `src/components/workflows/**` (`ModelField.test.tsx`, `PhaseFormPanel*.test.tsx`, `modelFitness.test.ts`) | ✅ **YES** — bare directory `"src/components/workflows"` at `scripts/vitest-count-gate.cjs:2286` | New tests are gated automatically. No action. |
| `src/components/chat/ChatArea*.test.tsx` | ❌ **NO** — only `OutputFileCard.baseline` and `StopControl.baseline` are listed; the file's own comment at `:2664` records *"no bare-directory entry"* | ⚠ **A new ChatArea/composer test is UNGATED unless the planner adds it to `TARGETS`** |
| `src/hooks/useComposerModel.test.ts` | ❌ **NO** — `src/hooks` has no entry | ⚠ same |
| `src/components/settings/**` | ❌ **NO** — only the two Connections tests | ⚠ (this phase changes no settings *frontend*, so likely moot) |

**Wave 0 action:** add `src/components/chat/__tests__/ChatArea.model.test.tsx` and `src/hooks/__tests__/useComposerModel.test.ts` to `TARGETS`, **and reconcile the pinned totals to the gate's own printed `actual`** — never to a number quoted in a document.

**SEED-171's three flaky suites** — one of them lives under the gated bare directory this phase touches:

| Suite | Under a gated target? |
|---|---|
| `src/pages/WorkflowsPage.test.tsx` | ✅ listed at `:2558` |
| **`src/components/workflows/library/WorkflowCard.test.tsx`** | ✅ **inside the bare `src/components/workflows` directory** ⚠ |
| `src/pages/WorkflowBuilderPage.session.test.tsx` | ✅ listed at `:2593` |

⚠ **All three run on every gate run for this phase.** If the gate reds: capture the failing filenames from the gate's persisted JSON **before** re-running, check `git diff --numstat` + `git status --short`, and if the file is byte-unchanged and one of these three, record it as an observation. **Do NOT adjust `GSD_VITEST_MAX_WORKERS`** — SEED-171 measures that adjusting the cap does not fix these. **Do NOT write an acceptance criterion of "the gate is green"** without pairing it with per-file deltas and the explicitly-run in-scope suites, which ARE deterministic.

### ⚠ Local-DB mutation and worktree serialisation

Per CLAUDE.md rule 4, **any plan whose tests MUTATE the local Postgres must be serialised** — worktrees isolate files, not the database. Assessment per plan is in §K.30. The pattern to prefer: `monkeypatch.setattr("app.models.user_settings._load_settings_from_db", ...)` and `load_all_model_overrides` patching, which mutate **nothing** and are therefore parallel-safe. ⚠ **A test that actually `INSERT`s into `model_capabilities_overrides` or `UPDATE`s `app_settings` is a serialisation trigger.** Recommend authoring all of this phase's tests as patched/stubbed, which removes the constraint entirely.

---

### ⚠ UAT scoreboard — the roster, DERIVED not typed

**The derivation command (run 2026-08-17):**

```bash
cd backend && ./venv/Scripts/python.exe -c "
import sys, collections, psycopg2; sys.path.insert(0,'.')
from app.config import MODEL_CAPABILITIES
by = collections.defaultdict(list)
for m, c in MODEL_CAPABILITIES.items(): by[c.get('provider')].append((m, c.get('emit_tier'), 'code'))
c = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); cur = c.cursor()
cur.execute('select model_id, provider, enabled from model_capabilities_overrides')
for m, p, e in cur.fetchall():
    if m not in MODEL_CAPABILITIES: by[p].append((m, None, 'db-only'))
for p in sorted(by): print(p, len(by[p]), sorted(by[p]))"
```

⚠ **THE DERIVATION RETURNS NINE PROVIDER GROUPS, NOT EIGHT.** CLAUDE.md's roster table names 7 native + OpenRouter = 8. The **union** adds a ninth — **`lmstudio`**, contributed entirely by SEED-172's three hand-inserted DB-only rows. **This is exactly why the rule says derive, never re-type**, and it is a finding: a phase about the *live registry* whose UAT used the hand-typed 8 would test 8/9 of the registry it is surfacing.

| # | Provider | Representative (newest, registry-backed where one exists) | `emit_tier` | Source | Key configured | Status |
|---|---|---|---|---|---|---|
| 1 | `openai` | `gpt-5.6-terra` | `force_strict` | code | ✅ env | **RUN** |
| 2 | `anthropic` | `claude-sonnet-5` | `force` | code | ✅ env | **RUN** |
| 3 | `google` | `gemini-3.5-flash` | `force` | code | ✅ env | **RUN** ⚠ historically the highest-risk tool-call row; also SEED-135's null-verdict judge |
| 4 | `deepseek` | `deepseek-v4-pro` | `force` | code | ✅ env | **RUN** ⚠ `strict_json_schema` is **inert** (DEMOTED — no `/beta` base_url, D-122-04). ⚠ Also becomes the **live judge** after D-17 (§G.21) |
| 5 | `zhipu` | `glm-5.2` | `force` | code | ✅ env | **RUN** ⚠ **zero zhipu rows have an override**, so no zhipu model is in `allowed_models` — the cleanest live demonstration of why D-01's union is needed |
| 6 | `minimax` | `MiniMax-M3` | `force` | code | ✅ env | **RUN** |
| 7 | `moonshot` | `kimi-k2.6` | **`coerce`** | code | ✅ env | **RUN** ⚠ **the only `coerce` native rows** — the weakest emission guarantee in the registry, and therefore **the single most important `llm_emit` fitness row in this phase** |
| 8 | `openrouter` | `z-ai/glm-5.2` | `force` | code | ✅ env | **RUN** ⚠ every OpenRouter row is `native_tools: False` — the non-native tool path |
| 9 | **`lmstudio`** ⚠ | `glm-4.7-flash` | **absent → `coerce`** | **db-only** | n/a (local) | ⛔ **BLOCKED** — LM Studio is not listening on `127.0.0.1:1234` at research time (measured: `curl -s -m 3 http://127.0.0.1:1234/api/v0/models` returned nothing). **Blocking id: SEED-172.** Row is **recorded, never omitted.** Unblocks the moment the operator starts LM Studio with `glm-4.7-flash` loaded. |

**Cheapest honest method** (proven in Phase 185): drive each row as a real run with a **per-request** `model` + `provider` on `POST /threads/{id}/messages`, and read verdicts from `workflow_runs` / `workflow_phases` / `harness_audit`. **Mutates no global setting.**

⚠ **Prefer a registry-backed id.** An id absent from `MODEL_CAPABILITIES` resolves `capability_source=inferred` and silently loses `emit_tier` — the row would measure a weaker configuration than the one that ships (SEED-040 §2026-07-31, SEED-135).

**The other three required axes:**

| Axis | Required row |
|---|---|
| **Multi-tool** | ≥1 row exercising 2+ tools in one prompt (`search_documents` + `execute_code`) |
| **Parallel-thread** | ≥1 row with Thread A streaming while Thread B accepts a new prompt — ⚠ **doubles as D-18's hardest case**: does Thread A's restored model survive a switch to B and back? |
| **Long-message** | ≥1 row with ≥50 prior messages OR a ≥5 KB prompt — ⚠ also D-18's realistic case (a long thread with a mid-thread model switch) |

**UAT rows must be authored under VALIDATION.md, not in PLAN.md tasks.**

### G-4 lived-experience rows (operator-defined, at scope time)

Three surfaces, three "I'd recognise failure here" moments. **These must be operator-defined before planning, not post-hoc:**

| # | Surface | Candidate scenario |
|---|---|---|
| U-A1 | Canvas | Open a saved workflow with an `llm_emit` step, **do not touch anything**, close it — and verify (via DB) `config.model` is byte-unchanged. *The D-07 no-rewrite property, as a lived moment.* |
| U-B1 | Settings | Set the judge knob to a cheap model, run a real publish, and see **that model** named in the verdict receipt. *The knob the operator turns is the control the code obeys.* |
| U-C1 | Chat | Pick a non-default model in a thread, send a message, navigate away, come back, **refresh**, and see the model still selected. |

---

## Security Domain

> `security_enforcement` is not `false` in config — this section applies.

### Applicable ASVS categories

| ASVS Category | Applies | Standard control in this phase |
|---|---|---|
| **V2 Authentication** | yes | The new route uses `Depends(get_current_user)` — the shipped JWT path. No new auth surface. |
| **V3 Session Management** | no | No session state added. |
| **V4 Access Control** | **yes — the load-bearing one** | ⚠ The new route **deliberately removes an operator gate** from data that was operator-only. §J below is the analysis. `require_operator` on `/admin` is **not** widened; a **second, narrower** route is added. |
| **V5 Input Validation** | **yes** | `emit_tier` PATCH → allowlist + 422 before any DB touch (§D.11 #5). Save-path `config.model` → 400 before any write (§B). Both mirror shipped guards. |
| **V6 Cryptography** | no | No crypto. ⚠ But §J.1's field-omission rule exists precisely so no key ever reaches a payload. |

### Known threat patterns

| Pattern | STRIDE | Mitigation in this phase |
|---|---|---|
| **Privilege boundary erosion** — an operator-only payload reaching every author | Information Disclosure | **Narrowed projection** (§J.1): the author row carries 6 of `_registry_row`'s 13 fields. Assert on the response model, not by convention. |
| **Credential / endpoint leak via a registry row** | Information Disclosure | ⚠ SEED-172's `_PROVIDER_BASE_URLS` (11, routing) vs `PROVIDER_ENDPOINTS` (8, SSRF allowlist). **Neither appears in `_registry_row`** (verified by reading all 13 fields). The projection must be **allowlist-shaped**, so a future field added to `_registry_row` cannot silently travel. |
| **SQL injection via a column name** | Tampering | Unchanged — `_MODEL_CAP_COLUMNS` is a code-constant allowlist and values are `$N` binds (`admin.py:1362, 1431`). Adding `emit_tier` extends the allowlist; it does not weaken the mechanism. |
| **Existence oracle** on a workflow | Information Disclosure | The D-09 refusal must fire **after** the existing ownership resolution in `update_draft`, so a 400 never distinguishes "not yours" from "bad model". ⚠ **Verify ordering explicitly** — `update_draft`'s `not_found` is deliberately *"the dullest of them"* (`:1256-1260`). |
| **SSRF via a provider name** | Tampering | Untouched — this phase makes **no outbound request** and adds no provider. SEED-172's `PROVIDER_ENDPOINTS`-vs-`_PROVIDER_BASE_URLS` fix is **out of scope**. |
| **Stored-value tampering via a picker** | Tampering | §F.16b's no-write-on-open guarantee. A form that rewrites on open is a silent integrity change. |

### J.28 — What each field leaks, and what MUST NOT travel

| Field | Ship to authors? | Reason |
|---|---|---|
| `model_id` | ✅ **yes** | The picker's whole purpose. |
| `provider` | ✅ **yes** | Already public — `getProviders()` returns provider ids + model lists to every chat user today. No new information. |
| `capability_source` | ✅ **yes** | `"registry"` vs `"db_override"` reveals *that* an operator added a row. Low value to an attacker; **necessary** for the D-08 unknown-vs-known distinction. Accept. |
| `enabled` | ✅ **yes** | Required by D-07. Also already inferable — `/me/preferences.allowed_models` exposes an enabled set today. |
| `deprecated` | ✅ **yes** | Already shipped to every chat user via `deprecated_models` in the settings payload (`settings.py:287`). No new exposure. |
| `emit_tier` | ✅ **yes** | D-13's whole point. Reveals a doc-verified capability class, not a secret. |
| **`deprecated_reason`** | ❌ **NO** | `api.ts:5016-5018` states it verbatim: *"operator context, **never shown to end users**"*. **Must not travel.** |
| **`is_default` / `is_locked`** | ⚠ **`is_default` only, and only if D-06 needs it** | Org configuration. `/me/preferences` already returns `locked` + `effective_model`, so the *fact* is not novel — but ship the **minimum**. If D-06's clause reads the default from an existing settings call instead, omit both. |
| **`overridden_fields`** | ❌ **NO** | Pure operator-editor internal (drives the Reset button). Zero author value. |
| **`llm_call_timeout_seconds`** | ❌ **NO** | Operational detail; no picker use. Omit. |
| **`context_window_tokens` / `max_output_tokens`** | ❌ **NO** in this phase | No surface consumes them. ⚠ SEED-172 finding 4 records that a **stale** `context_window_tokens` on a local row is a real hazard; shipping a number nobody validates invites it to be trusted. Omit until a surface needs it. |
| **any base URL / endpoint / API key** | ❌ **ABSOLUTELY NOT** | Verified: `_registry_row` carries none today. The allowlist projection makes it structurally impossible to add one by accident. |

⚠ **Implement the projection as an explicit allowlist (`to_author_row`), never as a `del` of unwanted keys.** A drop-list silently ships any field added to `_registry_row` later — which is exactly how `_MODEL_CAP_COLUMNS`-shaped guards are supposed to work in this codebase, and how mig 116's RLS copy leaked a secret column in Phase 190 (CR-01).

### J.29 — Tenancy scope

**The model registry is GLOBAL — not per-org, not per-user.** Measured:

```sql
select relrowsecurity from pg_class where relname='model_capabilities_overrides';   -- t
select polname, polcmd, (select array_agg(rolname) from pg_roles where oid = any(polroles))
  from pg_policy where polrelid='model_capabilities_overrides'::regclass;
-- ('model_overrides_read_all', 'r', {authenticated})   USING (true)
```

- RLS is **enabled**; the sole policy is `model_overrides_read_all`, **`FOR SELECT TO authenticated USING (true)`**.
- There is **no `org_id` column** on the table (11 columns, listed in M-5).
- **Every authenticated user can already SELECT every row at the RLS layer today.** The `require_operator` gate on `/admin/models` is an *API* boundary over data RLS already permits.

**Consequence for the threat model:** the new route exposes **nothing RLS forbids**. The genuine exposure delta is the **composition** — the union with the code registry — and the **narrowed projection** (§J.1) is what keeps that delta to the six fields an author needs.

⚠ **This also means the new route needs no RLS work and no `org_id` filter** — and a reviewer expecting one should be pointed at this measurement rather than left to infer.

⚠ **`app_settings` has RLS DISABLED** (`relrowsecurity = false`) — the shipped posture for the global singleton row, read through the service-role settings path. D-17 changes *which object* is read, not *how*. No new exposure.

---

## Environment Availability

| Dependency | Required by | Available | Version / detail | Fallback |
|---|---|---|---|---|
| Local Supabase Postgres @ `127.0.0.1:54322` | every measurement; migration `120_`; integration tests | ✅ | reachable this session | — |
| `backend/venv` | all backend commands | ✅ | Python 3.12 | — |
| Supabase SQL editor | applying `120_` | ✅ (operator action) | — | ⚠ **never** `db push` / `db reset` |
| `scripts/regenerate-full-schema.sh` | rebuilding `full-schema.sql` after `120_` | ✅ present | run **without** `--reset` | — |
| OpenAI / Anthropic / Google / OpenRouter / DeepSeek / Moonshot / MiniMax / Zhipu keys | 8 of 9 UAT roster rows | ✅ **all 8 SET in `backend/.env`** | measured via `app.config.settings` | — |
| **LM Studio @ `127.0.0.1:1234`** | UAT roster row 9 (`lmstudio`); any live check of a DB-only local model's tier | ⛔ **NOT RUNNING** | `curl -s -m 3 http://127.0.0.1:1234/api/v0/models` → no response | ⚠ **`glm-4.7-flash` can still be tested as a DB-only *registry row*** (it exists in the DB and appears in the union) without LM Studio running. Only a **live run** on it is blocked. |
| Redis @ `6379` | harness run tests (`_emit_phase_substep`) | not probed this session | — | ⚠ `UNVERIFIED` — probe before authoring a harness integration test |
| Docker (sandbox) | not needed | n/a | — | — |

**Missing with no fallback:** none blocking.
**Missing with fallback:** LM Studio — the registry-row half of row 9 is testable; the live-run half is not. **Record row 9 as ⛔ with blocking id SEED-172; never omit it.**

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|---|---|---|---|
| `forced_emission` + `strict_json_schema` two-bool guess | **`emit_tier` enum — the single source of truth** | Phase 122 (D-122-04) | Every fitness surface reads `emit_tier`. The two bools are DEPRECATED-UNREAD. |
| `config.py` edit to add a model | `model_capabilities_overrides` DB rows + the operator registry tab | Phase 149 (MODEL-01) | The union exists because both tiers now do. |
| Model default is a global setting only | **Two-layer**: operator/org allowed-set + per-user preference, server-re-validated | Phase 167 (VIS-02 / SEED-116) | `ModelDefaultPreference.tsx` is the closest analog to build against. |
| Disabled models could still be sent | `_resolve_enabled_model` on the chat path with an honest SSE notice | Phase 149 (D-149-10) | D-10 extends it to the harness — **reuse, do not re-implement.** |
| `runs.model` invisible to the client | `MessageResponse.model` / `.provider`, JOIN-stamped | Phase 095.1-03 (D-04) | **This is what makes D-18 zero-migration.** |
| SSE transport inline in `threads.py` | `run_transport.py` leaf | Phase 195 (2026-08-17) | The extraction discipline this phase's §A.2 and §H.23 both follow. |

**Deprecated / outdated:**
- `forced_emission`, `strict_json_schema` — superseded by `emit_tier`. ⚠ Still read at `validator_kinds.py:84-85` (latent, §D.13).
- `backend/supabase/migrations.archive/` — dead. Migrations live at `supabase/migrations/`.
- ⚠ **`BUG-260731-01`'s consumer-table line numbers** (`publish_service.py:882/894`) are **stale**; measured `:1136/:1148` (M-4).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| **A1** | Importing `_resolve_enabled_model` from `phase_types.py` introduces no import cycle (it resolves `load_all_model_overrides` late off `app.api.threads`) | §C.8 | A cycle at harness import time → the backend fails to start. **Mitigation: a RED test that imports `phase_types` fresh, before any other work in that plan.** |
| **A2** | A new `status="model_fallback"` on `phase_substep` needs only a frontend mapping, not a new wire path | §C.8 | The PhaseCard renders an unmapped status as blank → a silent notice, which is the defect this phase removes. **Mitigation: verify the frontend's `phase_substep` status switch has a default arm before choosing this carrier.** |
| **A3** | `deploy/onebox.env.example`, `docs/OPERATOR.md` Step-3 and `docker-compose.prod.yml` are unaffected (no new env var, no seed row) | §Project Constraints | CI `deploy-artifacts` goes red. **Mitigation: run `scripts/check-deploy-drift.sh` in Wave 0 — cheap and decisive.** |
| **A4** | `gpt-5.6-terra` / `claude-sonnet-5` / `MiniMax-M3` / `glm-5.2` are the "newest" per group | §UAT roster | A UAT row measures a slightly older model than intended — low impact; the tier and provider are what the rows probe. **Mitigation: re-derive at UAT time; "newest" is a judgement over the printed candidate list.** |
| **A5** | Redis is available for a harness integration test | §Environment Availability | A harness test hangs or is skipped. **Mitigation: probe `redis-cli ping` before authoring one; prefer a patched `ctx.emit` unit test.** |
| **A6** | `onPersist` is idempotent for an unchanged `<select>` blur | §F.16b | Opening + tabbing past the field writes the definition — violating D-07. **Mitigation: a behavioural test, not an inference from `citation_policy`'s shipped behaviour.** |
| **A7** | The `emit_tier` CHECK constraint values `('force_strict','force','coerce')` match the code's `_RUNGS_BY_TIER` keys exactly | §D.11 | An operator sets a tier the ladder rejects → silent coerce. **Mitigation: a test asserting the CHECK's value set equals `set(_RUNGS_BY_TIER)`, in the `test_audit_event_registration.py` two-layer-pin style.** |

**Nothing else in this document is assumed.** Every other claim carries either a command that produced it in this session or a file:line that was read.

---

## Open Questions

1. **Which value does D-06's *"today that would be X"* clause name?**
   - **What we know:** `app_settings.llm_model` = `deepseek-v4-flash` today; the *sub-agent* default is `gpt-5.4-mini`; `gpt-5.4` is what 18 stored phases happen to carry. `_effective_model` inherits **`ctx.model`**, which `workflow_kickoff.py:485` sets from `resolve_workflow_ctx_model(user_settings)`.
   - **What's unclear:** whether the honest clause should name the *org default* or the value `resolve_workflow_ctx_model` would produce — they can differ.
   - **Recommendation:** name the value the **run** would actually inherit, sourced server-side. If that is expensive, name the org default and word the clause so it stays true (*"whatever model starts the run — usually X"*). ⚠ **Never hardcode `gpt-5.4`.**

2. **Does surfacing `emit_tier` constitute a provider claim requiring provider-docs-first research?**
   - **What we know:** CLAUDE.md's provider-docs-first rule binds work that touches provider emission behaviour. This phase **surfaces** an already-doc-verified value (D-122-04 records the per-provider verification); it makes no new claim.
   - **What's unclear:** whether D-14 making `emit_tier` **operator-editable** reopens the question — an operator can now assert `force_strict` for a model nobody verified.
   - **Recommendation:** treat the override as an **operator assertion**, not a verified fact, and make the registry tab say so (a one-line caption). Do **not** research each provider's emission docs again in this phase; do record the caption as a requirement.

3. **Should the union route be paginated or cached client-side?**
   - **What we know:** 69 rows today, growing whenever an operator adds one. `/admin/models` returns all of them unpaginated and is documented as *"floor-EXEMPT poll-style read"*.
   - **Recommendation:** no pagination. Fetch once at the Builder page level. Revisit at ~500 rows.

4. **Does `_registry_row`'s `is_default` reflect the workflow run's inherited model, or the chat default?**
   - **What we know:** it is stamped from `app_settings.llm_model` (`admin.py:1099, 1126`). `ctx.model` comes from `resolve_workflow_ctx_model(user_settings)` — a *different* function.
   - **Recommendation:** resolve this before writing D-06's copy. It is Open Q1's mechanical half.

5. ⚠ **Is `harness_authoring_model` a fifth instance of the D-17 defect?**
   - **What we know:** `resolve_authoring_model` (`workflow_authoring.py:197`) reads `getattr(settings, "harness_authoring_model", None)` off the same env singleton. There is **no `app_settings` column** and **no UI knob** for it.
   - **Recommendation:** **out of scope** — there is no inert knob to fix (nothing lies to an operator, because nothing offers the control). **Plant a seed**, with re-open trigger: *the first time an authoring-model knob is added to the Settings UI.*

---

## §K — Plan decomposition recommendation

### K.30 — Waves, plans, and the two constraints that bind them

**Three surfaces, and CONTEXT.md is right that 2 and 3 are independent of 1.** But surface 1 has an internal dependency chain that surfaces 2 and 3 do not.

| Wave | Plan | Scope | Files (primary) | Parallel-safe? | DB-mutating tests? |
|---|---|---|---|---|---|
| **0** | **P-01** | Migration `120_` + `emit_tier` end-to-end (D-14): overlay list, `_MODEL_CAP_COLUMNS`, the enum guard, `ModelRegistryRow`, the tab control, `full-schema.sql` regen | `supabase/migrations/120_*.sql`, `config.py`, `admin.py`, `api.ts`, `ModelRegistryTab.tsx` | **blocks P-02** | ⚠ **the migration itself is an operator action**; the tests should patch, not insert |
| **0** | **P-02** | The union leaf + the new route (D-01/D-02): extract `_registry_row` → `services/model_registry.py`, repoint `admin.py`, new `api/model_registry.py` router, `main.py` registration, `api.ts` client | `services/model_registry.py` **(new)**, `api/model_registry.py` **(new)**, `admin.py`, `main.py`, `api.ts` | ⚠ **shares `admin.py` + `api.ts` with P-01** → **SERIALISE after P-01** | no (patch `load_all_model_overrides`) |
| **0** | **P-03** | Test-infrastructure Wave 0: add the ungated `TARGETS` entries; reconcile pins to the gate's printed `actual` | `scripts/vitest-count-gate.cjs` | ✅ | no |
| **1** | **P-04** | The picker (D-04–D-08, D-12, D-15, D-20): `ModelField.tsx`, `modelFitness.ts`, the 4 gated mounts, the new source fence | `ModelField.tsx` **(new)**, `modelFitness.ts` **(new)**, `PhaseFormPanel.tsx`, `PhaseFormPanel.test.tsx` | depends on **P-02** | no |
| **1** | **P-05** | The server refusal (D-09): `assert_phase_models_registered` in the leaf + 2 call lines | `services/model_registry.py`, `api/workflows.py` | ⚠ **shares `services/model_registry.py` with P-02** → **after P-02**; ✅ parallel with P-04 | no |
| **1** | **P-06** | The harness enabled-check (D-10): `_effective_model_checked` + 5 repointed call sites + the notice carrier | `harness/phase_types.py` | ✅ **fully independent** — parallel with P-04 and P-05 | ⚠ **check** — a harness integration test may need Redis + a run row |
| **1** | **P-07** | **Surface 2 — the judge knob (D-17)**: 4 consumers + the BINDING RED-first test ×4 + 1 control | `eval_runner_service.py`, `publish_service.py`, `validator_kinds.py`, new `tests/unit/test_196_judge_model_db_backed.py` | ✅ **fully independent of surfaces 1 and 3** — parallel with everything in Wave 1 | ✅ **no** if it patches `_load_settings_from_db` — **which it must** (§G.20) |
| **1** | **P-08** | **Surface 3 — the composer (D-18)**: extract `useComposerModel.ts` (the G-5 seam), add the restore, tests | `hooks/useComposerModel.ts` **(new)**, `ChatArea.tsx`, new test files | ✅ **fully independent** — parallel with everything in Wave 1 | no |
| **2** | **P-09** | The records: hot-file ledger rows + detail sections (D-23), reported-bug frontmatter flips, seeds (Open Q5, §D.13's drift trigger), `check-deploy-drift.sh` | `docs/HOT-FILE-LEDGER.md`, `.planning/reported-bugs/*`, `.planning/seeds/*` | after everything | no |

### ⚠ File-collision flags (worktrees isolate files, not merges)

| Collision | Plans | Resolution |
|---|---|---|
| `backend/app/api/admin.py` | P-01, P-02 | **SERIALISE** — P-01 then P-02 |
| `frontend/src/lib/api.ts` | P-01 (`ModelRegistryRow`), P-02 (`getModelRegistry`) | **SERIALISE** (same as above) — or split the type change into P-02 alone |
| `backend/app/services/model_registry.py` | P-02 (creates), P-05 (extends) | **SERIALISE** — P-02 then P-05 |
| `frontend/src/components/workflows/PhaseFormPanel.test.tsx` | P-04 only | ✅ single owner |
| `scripts/vitest-count-gate.cjs` | P-03 only, then reconciled at each wave close | ✅ ⚠ **but every plan that adds a test file changes the gate's counts** — reconcile to the gate's own printed `actual`, never to a number |

### ⚠ DB-mutation serialisation flags (CLAUDE.md rule 4)

**Recommendation: author every test in this phase as patched/stubbed, and the constraint disappears.** The idioms exist and are named in this document: `monkeypatch.setattr("app.models.user_settings._load_settings_from_db", …)` and patching `load_all_model_overrides`.

⚠ **Two plans could accidentally become DB-mutating:**
- **P-01** — if an `emit_tier` overlay test **INSERTs** a real override row. **Serialise it, or patch.**
- **P-06** — if a harness test creates a real `workflow_runs` row. **Serialise it, or stub the ctx.**

**Flag both at plan time.** A `files_modified` check cannot see a database write.

### ⚠ Hot-file ledger obligations at close (D-23)

**Files this phase modifies that are ALREADY in the ledger** — row + detail section, re-derived, SAME-COMMIT:

| File | Row today | Owed |
|---|---|---|
| `backend/app/api/workflows.py` | 35 / 17 / 1962 | re-derive + note honoured-by-construction (§B.6) |
| `backend/app/services/harness/phase_types.py` | 38 / 15 / 2393 | re-derive + note honoured-by-construction (§C.9) |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 16 / 8 / 1167 | re-derive + record the **new four-line fence** |
| `frontend/src/components/chat/ChatArea.tsx` | 61 / 29 / 587 | re-derive + record the `useComposerModel` extraction and the **new counts** (§H.23) |
| `backend/app/services/harness/publish_service.py` | 19 / 7 / 1243 | re-derive **if P-07 touches it** — it does (D-17 consumer 3) |

**Files this phase modifies that are ABSENT from the ledger** — D-23 says these move from *"named"* to *"owed a row"* automatically:

| File | D-22's figure | Modified by |
|---|---|---|
| `backend/app/config.py` | 70 / 41 / 1275 ⚠ **second-hottest file measured anywhere** | **P-01** → **owes a row + section** |
| `backend/app/api/admin.py` | 30 / 11 / 1718 | **P-01, P-02** → **owes a row + section** |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | 9 / 3 / 1083 (exactly at threshold) | **P-01** → **owes a row + section** |
| `backend/app/services/harness/validator_kinds.py` | 11 / 4 / 744 | **P-07** → **owes a row + section** |
| `frontend/src/pages/SettingsPage.tsx` | 34 / 21 / 1426 | **not modified** (SC#3 fence) → stays named-only |

⚠ **Re-derive every one of these at close rather than copying D-22's figures** — this table's own documented failure mode is a figure going stale on the next commit, sometimes the same afternoon.

**New young files owed a tracked row:** `services/model_registry.py`, `api/model_registry.py`, `ModelField.tsx`, `modelFitness.ts`, `useComposerModel.ts`.

---

## Sources

### Primary (HIGH confidence — read or executed this session)

- **Live local Postgres** `postgresql://postgres:postgres@127.0.0.1:54322/postgres` — `model_capabilities_overrides` (37 rows, 11 columns, RLS policy), `workflow_definitions` (242), `app_settings`, `messages`, `runs`, `pg_constraint` on `harness_audit`, `pg_policy`
- **Live Python import** of `app.config` / `app.services.harness.validator_kinds` in `backend/venv` — `MODEL_CAPABILITIES`, `settings`, `resolve_judge_model`, `_build_inferred_defaults`, `get_model_capability`
- `backend/app/api/admin.py:120-160, 1044-1460` · `backend/app/api/me_preferences.py` (full) · `backend/app/api/workflows.py:1056-1320, 1573-1600` · `backend/app/api/settings.py:109-290, 443-460` · `backend/app/main.py:703-733`
- `backend/app/config.py:180-210, 700-745` · `backend/app/models/harness.py:38-160` · `backend/app/models/message.py:27-70` · `backend/app/models/thread.py:29-46` · `backend/app/models/user_settings.py:214-231, 900-1030`
- `backend/app/services/run_model_resolution.py` (full) · `backend/app/services/harness/phase_types.py:380-400, 1061-1115` · `backend/app/services/harness/validator_kinds.py:60-110, 525-545` · `backend/app/services/harness/publish_service.py:1135-1155` · `backend/app/services/eval_runner_service.py:300-320, 630-650` · `backend/app/services/workflow_authoring.py:185-210` · `backend/app/services/forced_emit.py:206, 334-380` · `backend/app/services/workflow_kickoff.py:475-495` · `backend/app/db/workflows.py:95-140, 1595-1660`
- `frontend/src/components/settings/JudgeModelPicker.tsx` (full) · `ModelDefaultPreference.tsx` (full) · `ModelPillRow.tsx` (grep) · `frontend/src/components/workflows/PhaseFormPanel.tsx:337-382, 868-1120` · `PhaseFormPanel.test.tsx:330-500` · `PhaseFormPanel.rails.test.tsx:478-510` · `frontend/src/components/chat/ChatArea.tsx:55-215, 312-330` · `frontend/src/lib/api.ts:210-225, 5005-5145` · `frontend/src/types/index.ts:165-215` · `frontend/src/components/admin/ModelRegistryTab.tsx` (grep) · `scripts/vitest-count-gate.cjs` `TARGETS`
- `docs/HOT-FILE-LEDGER.md` — the `PhaseFormPanel.tsx`, `workflows.py`, `phase_types.py` and `ChatArea.tsx` sections read verbatim
- `.planning/seeds/SEED-135` (full) · `SEED-172` (§1, §3, §4) · `.planning/reported-bugs/BUG-260731-01` · `BUG-260718-04` (full)
- `CLAUDE.md` · `.planning/config.json` · `.planning/ROADMAP.md` §Phase 196 · `.planning/REQUIREMENTS.md:66, 110`

### Secondary (MEDIUM confidence)

- `196-CONTEXT.md` D-01/D-03/D-04/D-13/D-17/D-20's own measurements — **independently re-derived here and found to agree** (M-1 … M-4, M-10)
- `196-DISCUSSION-LOG.md` — not read in full; CONTEXT.md is the binding artifact

### Tertiary (LOW confidence — flagged)

- None. No WebSearch was used. **No external documentation was consulted, and none was needed:** this phase introduces no library and makes no new provider claim (Open Q2).

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Measured figures (M-1 … M-11) | **HIGH** | Every number re-derived this session against the live DB / live import, with the command recorded |
| Standard stack | **HIGH** | No packages added; every library confirmed present by reading its import site |
| Backend architecture (§A, §B, §C, §D, §G) | **HIGH** | Every seam read at file:line; extraction discipline is the repo's own, quoted from `run_model_resolution.py:1-27` |
| Frontend architecture (§E, §F, §H) | **HIGH** | Both shipped pickers read in full; the 193.1 fence located and quoted; the ledger's measured G-5 tests quoted |
| Security / tenancy (§J) | **HIGH** | RLS policy and roles read from `pg_policy`; every one of `_registry_row`'s 13 fields enumerated |
| Pitfalls | **HIGH** | Each traced to a measurement or a shipped comment, not to intuition |
| Validation architecture | **MEDIUM-HIGH** | `TARGETS` coverage measured; the count-gate's non-determinism is honestly stated; test *file* names are proposals |
| UAT roster | **HIGH** for the derivation, **MEDIUM** for "newest" per group | The 9 groups are measured; "newest" is a judgement (A4) |
| Assumptions A1–A7 | **LOW by construction** | Explicitly flagged; each carries a named cheap mitigation |

**Research date:** 2026-08-17
**Valid until:** **2026-08-24 (7 days).** ⚠ Short, deliberately. Three of this document's figures are known to move: the union size moves whenever an operator adds a registry row; the count-gate totals moved **three times in four days** in Phase 195; and `app_settings.harness_judge_model` is a live operator knob. **Re-derive M-1, M-3 and the gate figures at plan time rather than trusting them** — this project's own most repeated finding is that a number written at a phase's close goes stale on the next commit, sometimes the same afternoon.
