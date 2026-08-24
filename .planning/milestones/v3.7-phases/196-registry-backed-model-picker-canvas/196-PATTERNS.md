# Phase 196: Registry-Backed Model Picker (canvas) - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 28 (11 new incl. tests · 17 modified)
**Analogs found:** 27 / 28 — **one admitted gap** (`ModelField.tsx`'s `<optgroup>` fitness grouping: no shipped `<select>` in this tree uses `<optgroup>`; see §"No Analog Found")

> **How to read this document.** Every excerpt below was read at the quoted `file:line` **in this
> session**. Nothing is inherited from RESEARCH.md — where research named an analog, it was opened
> and verified; where research named none, one was searched for. Line numbers move: re-open the file,
> do not trust the number alone.
>
> **The phase's own bias, restated:** RESEARCH.md §"Don't Hand-Roll" says almost every capability is
> already implemented **one seam away**. This map's job is to name that seam per file, so the planner
> writes *"move it"* rather than *"build it"*.

---

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `backend/app/services/model_registry.py` | service (leaf, no route/no auth) | transform (pure composition over 2 sources) | `backend/app/services/run_model_resolution.py` | **exact** — same extraction discipline, same origin file class (a hot `api/` module) |
| `backend/app/api/model_registry.py` | route (router module) | request-response (read-only) | `backend/app/api/me_preferences.py` | **exact** — non-operator top-level authed read, sibling registration in `main.py` |
| `frontend/src/components/workflows/ModelField.tsx` | component (presentational, no fetch) | request-response (props in, callbacks out) | `frontend/src/components/settings/ModelDefaultPreference.tsx` **minus its fetch** + `PhaseFormPanel.tsx:336-376` `SelectField` | **role-match** — the closest shipped picker is page-level and self-fetching; `ModelField` must be a pure function of props |
| `frontend/src/components/workflows/modelFitness.ts` | utility (pure mapping) | transform | `frontend/src/components/workflows/runVocabulary.ts` | **exact** — engine reading → user words, pure, no React, colocated, own `.test.ts` |
| `frontend/src/hooks/useComposerModel.ts` | hook (state + one load effect) | event-driven (state machine) | `frontend/src/hooks/useFollowScroll.ts` (state extracted out of a hot chat component) + `frontend/src/hooks/useTemplatePlaceholders.ts` (leaf-hook + abort discipline) | **role-match** (two partial analogs, each covering a half) |
| `supabase/migrations/120_model_capabilities_overrides_emit_tier.sql` | migration | schema | `supabase/migrations/081_eval_verdict_and_ratings.sql:46-47` (ADD COLUMN text + inline enum CHECK) + `099_model_registry_deprecated.sql` (**same table**, `IF NOT EXISTS` idempotence + the apply/parity header) | **exact** (composite — take the CHECK from 081, the header + idempotence from 099) |
| `backend/tests/test_196_model_registry_route.py` | test (integration) | request-response | `backend/tests/test_149_registry_read.py` + `backend/tests/test_149_model_gate.py` | **exact** — same route family, same fixtures |
| `backend/tests/unit/test_196_judge_model_db_backed.py` | test (unit, patched settings) | transform | `backend/tests/test_149_default_guard.py:51-64` | **exact** — the `_load_settings_from_db` patch idiom, parallel-safe |
| `backend/tests/unit/test_196_emit_tier_two_layer_pin.py` (A7) | test (structural guard) | transform | `backend/tests/unit/test_audit_event_registration.py` | **exact** — Python-set ≡ SQL-CHECK equality + positive control + non-vacuity |
| `frontend/src/components/workflows/ModelField.test.tsx` | test (render) | request-response | `frontend/src/components/settings/ModelDefaultPreference.test.tsx` | **exact** — option-set assertions, `(current)` retention, `within(select).getAllByRole("option")` |
| *(new fence inside)* `frontend/src/components/workflows/PhaseFormPanel.test.tsx` | test (source fence) | transform | `PhaseFormPanel.test.tsx:480-488` | **exact** — quoted verbatim in §S1 below |

### Modified files

| Modified file | Role | Data flow | The local convention to follow | Analog |
|---|---|---|---|---|
| `backend/app/config.py` (overlay tuple `:717-718`) | config | transform | Append one string to a literal tuple inside `get_model_capability_async` | the tuple itself, `config.py:717-718` |
| `backend/app/api/admin.py` (`_MODEL_CAP_COLUMNS` `:129-137`; guard loop `:1374-1394`) | route | CRUD | A 4th `elif` branch in the existing per-column guard loop; a new `_MODEL_CAP_ENUM_COLUMNS` constant beside `_MODEL_CAP_INT_COLUMNS`/`_BOOL_COLUMNS` | `admin.py:1383-1394` (the `_BOOL`/`deprecated_reason` branches) |
| `backend/app/api/admin.py` (`get_model_registry` `:1106-1143`) | route | request-response | Becomes a thin call into the leaf; **keep the function-local import** (Pitfall 4) | `admin.py:1122-1123` |
| `backend/app/api/workflows.py` (`create_draft` `:1166-1178`, `update_draft`) | route | CRUD | One `await` line after the status force, before the DB call; refusal object shaped like `stale_token` | `workflows.py:1288-1312` |
| `backend/app/services/harness/phase_types.py:393-395` | service | transform | Additive `_effective_model_checked`, 5 call sites gain `await` + a name; **`_effective_model` stays sync + exported** | `run_model_resolution.py` docstring §PATCH SURFACE |
| `backend/app/services/harness/validator_kinds.py:531-536` + 3 judge consumers | service | transform | Swap the `from app.config import settings` function-local for `load_app_settings_async` | `backend/app/api/skill_tuner.py:728-730` |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | component | request-response | **4 one-line gated mounts + 1 spread prop**; zero added `useMemo`/`useState`/`useEffect`/`.filter(`/`.map(` | `PhaseFormPanel.tsx:202-204, :760, :1116` |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | component | CRUD | A per-row control; the tab's controls are `NUM_FIELDS` (int) or `RowToggle` (bool) — **`emit_tier` is its first enum**, so a new small control, not a reuse | `ModelRegistryTab.tsx:61-74`, `:690-713` |
| `frontend/src/components/chat/ChatArea.tsx:59-65, :141-158, :198-205` | component | event-driven | **Move state OUT** (the G-5 seam); one destructure remains | `useFollowScroll.ts` |
| `frontend/src/lib/api.ts` | service (client) | request-response | Envelope unwrapped **in the client**, never in the component | `api.ts:5132-5143` |
| `scripts/vitest-count-gate.cjs` (`TARGETS`, `:2285`+) | config | transform | A new entry carries a **stated reason**; adopt/decline both need one | `vitest-count-gate.cjs:2286`+ comment blocks |
| `backend/app/main.py` | config | request-response | `app.include_router(...)` + a trailing `# Phase NNN …` comment naming the gate posture | `main.py` `features.router` / `me_preferences.router` lines |

---

## Pattern Assignments

### `backend/app/services/model_registry.py` (service leaf, transform)

**Analog:** `backend/app/services/run_model_resolution.py` — the repo's own name for this discipline is
**"additive-then-repoint"**, and it was applied to *exactly* this situation (helpers extracted out of a
2,444-LOC hot `api/` module).

**Module docstring pattern** (`run_model_resolution.py:1-27`) — the shape a reviewer expects:

```python
"""Phase 162.5 Plan 01 (D-A2 / D-A4 / D-A5) — the run model/provider resolution transform.

Behavior-preserving G-5 refactor: the disabled-model fallback + provider-resolution helpers
(``_resolve_enabled_model`` / ``_reresolve_fallback_provider`` / ``_apply_fallback_to_request``)
and the ``send_message`` inline model/provider resolution block move VERBATIM out of the
2,444-LOC ``backend/app/api/threads.py`` into this leaf module. Zero "while-I'm-in-here"
edits — the bodies are copied unchanged (bugs included). This is the ``run_lifecycle.py``
extraction discipline (D-A4): docstring-states-invariant, additive-then-repoint, late imports
to break the ``threads.py`` <-> service cycle.

PATCH SURFACE (D-A4 — the acceptance bar):

- The three helpers are re-imported at module scope back into ``threads.py`` so
  ``test_149_fallback_notice.py``'s ``from app.api.threads import _resolve_enabled_model``
  + ``threads_mod._reresolve_fallback_provider`` / ``threads_mod._apply_fallback_to_request``
  still resolve.
"""
```

> ⚠ **The `PATCH SURFACE` section is not decoration — copy the habit.** Any existing test that does
> `from app.api.admin import _registry_row` must keep resolving. `grep -rn "_registry_row\|get_model_registry" backend/tests/`
> before moving, and if a hit exists, re-import at module scope in `admin.py` and say so in the docstring.

**Explicit `__all__` at the bottom** (`run_model_resolution.py:302-308`):

```python
__all__ = [
    "_resolve_enabled_model",
    "_reresolve_fallback_provider",
    "_apply_fallback_to_request",
    "apply_user_model_default",
    "resolve_run_model",
]
```

**The code being moved, verbatim** (`backend/app/api/admin.py:1063-1103`) — do not retype it:

```python
    cap = cap or {}
    ovr = ovr or {}

    def _eff(col, default=None):
        v = ovr.get(col)
        if v is not None:
            return v
        return cap.get(col, default)

    provider = ovr.get("provider") or cap.get("provider") or _infer_provider_for(model_id)
    # DB-only OR any model carrying a stored override row → db_override; else the built-in.
    source = "db_override" if ovr else "registry"
    overridden_fields = sorted(c for c in _MODEL_CAP_COLUMNS if ovr.get(c) is not None)

    _enabled = ovr.get("enabled")
    _deprecated = ovr.get("deprecated")
    return {
        "model_id": model_id,  # verbatim casing (Pitfall 6)
        "provider": provider,
        "capability_source": source,
        "enabled": bool(_enabled) if _enabled is not None else True,
        "deprecated": bool(_deprecated) if _deprecated is not None else False,
        ...
        # WR-04: distinguish "not tracked in the registry" from a real 0. ... Return the RAW
        # effective value or None; the tab renders None as "—" (not a concrete 0).
        "context_window_tokens": _eff("context_window_tokens"),
```

> ⚠ **`_registry_row` reads two module-scope names from `admin.py`: `_infer_provider_for` and
> `_MODEL_CAP_COLUMNS`.** The move must carry or re-import both. `_MODEL_CAP_COLUMNS` is
> `admin.py:129-137` (the SQLi allowlist) — **it is also the thing D-14 edits**, which is precisely
> why RESEARCH.md §K.30 serialises P-01 before P-02.

**The union loop, verbatim** (`admin.py:1129-1143`):

```python
    overrides = await load_all_model_overrides()

    rows = []
    seen = set()
    # DEF rows (built-in registry) overlaid with any OVR.
    for model_id, cap in MODEL_CAPABILITIES.items():
        rows.append(_registry_row(model_id, cap, overrides.get(model_id), default_model, model_locked))
        seen.add(model_id)
    # DB-only rows (in overrides, not in the built-in registry) — discovery-confirmed models.
    for model_id, ovr in overrides.items():
        if model_id in seen:
            continue
        rows.append(_registry_row(model_id, None, ovr, default_model, model_locked))

    return {"models": rows}
```

**Late/function-local import pattern for a leaf's collaborators** (`run_model_resolution.py:53`):

```python
    from app.api.threads import load_all_model_overrides  # noqa: PLC0415 — D-A4 patch surface
```

…and the read-blip swallow immediately after (`:54-57`) — a registry read must never sink the caller:

```python
    try:
        overrides = await load_all_model_overrides()
    except Exception:  # noqa: BLE001 — an override-read blip must never sink send_message
        return resolved_model, None
```

> ⚠ **Contrast, and pick deliberately.** For the *new* leaf, import
> `load_all_model_overrides` / `_load_settings_from_db` from **`app.models.user_settings`**, which is
> what `admin.py:1123` does. Importing them off `app.api.threads` (as `run_model_resolution.py` does)
> exists only to preserve `test_149`'s patch surface — it is a *legacy constraint*, not the pattern.

**The allowlist projection (`to_author_row`) — build it like a code-constant allowlist, never a
drop-list.** The shipped instance of that habit is `_MODEL_CAP_COLUMNS` (`admin.py:124-137`):

```python
# Phase 149 (MODEL-01 / T-149-11): the ONLY columns a capability PATCH may write — the
# seven editable columns of model_capabilities_overrides. A client-supplied field name
# must NEVER reach the upsert's column list (which interpolates names into SQL). An
# unknown key → 422 BEFORE any DB touch (mirrors set_flag's _FLAG_KEYS guard); the upsert
# values are parameterized $N binds — no client field name reaches a SET clause (Pattern 2).
_MODEL_CAP_COLUMNS = {
    "llm_call_timeout_seconds",
    ...
}
```

---

### `backend/app/api/model_registry.py` (route, request-response)

**Analog:** `backend/app/api/me_preferences.py` — verified as the non-operator, top-level, authed-read precedent.

**Router construction — no prefix, no router-level gate** (`me_preferences.py:36`):

```python
router = APIRouter(tags=["preferences"])
```

**Authz + flat server-derived response** (`me_preferences.py:44-67`):

```python
@router.get("/me/preferences")
async def get_my_preferences(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Return the caller's per-user model default + the two-layer context. ..."""
    user_id = current_user["id"]
    effective = await load_app_settings_async()
    allowed = await enabled_model_allowed_set()
    locked = await operator_model_default_locked()
    pref = await load_user_model_default(user_id)
    effective_model = compose_effective_model_default(pref, effective, allowed, locked)
    return {
        "default_model": pref,
        "effective_model": effective_model,
        "locked": locked,
        "allowed_models": sorted(allowed),
    }
```

**Module-docstring convention: enumerate the endpoints at the bottom of the docstring**
(`me_preferences.py:14-18`):

```python
Endpoints:
- GET  /me/preferences — {default_model, effective_model, locked, allowed_models}
                         (the picker + always-on 🔒 footer data for Plan 07).
- PUT  /me/preferences — body {default_model: str | None}: set (validated ∈ allowed-set)
                         or clear (null) the caller's own model default.
```

**Registration in `main.py`** — the two sibling lines, quoted with their trailing comments, because
the comment is the convention (it records the gate posture so a reader never has to infer it):

```python
app.include_router(features.router)  # Phase 148 VIS-01 — authenticated per-user GET /features effective-map (NOT operator-gated; top-level, not under /admin — non-operators must reach it to learn their own map)
app.include_router(me_preferences.router)  # Phase 167 VIS-02 — per-user model-default preference (SEED-116 two-layer: operator allowed-set + lock; per-user RLS write, NOT the service-role settings writer)
```

> ⚠ **The import line is a single flat `from app.api import ...` list** (`main.py`, one line, ~30
> names). Add `model_registry` to it — a second import statement would be a diff nobody else's row has.

**The gate that must NOT be widened, verified today** (`admin.py:152-157`):

```python
# The single load-bearing security line: default-deny at the router (Pattern 1).
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_operator)],
)
```

---

### `frontend/src/components/workflows/ModelField.tsx` (component, request-response)

**Primary analog:** `frontend/src/components/settings/ModelDefaultPreference.tsx` — but **subtract its
data layer**. Read in full; here is what transfers and what must not.

**✅ CLONE — the `(current)` retention + dedupe + sort** (`ModelDefaultPreference.tsx:67-70`):

```tsx
// Registry-only options (VIS-02), deduped + sorted. A persisted value the allowed-set no
// longer contains stays selectable as "(current)" so the round-trip never drops it.
const models = Array.from(new Set(pref?.allowed_models ?? [])).sort((a, b) => a.localeCompare(b))
const currentIsUnknown = !!defaultModel && !models.includes(defaultModel)
```

Identical idiom, shipped twice — `JudgeModelPicker.tsx:71-74`:

```tsx
// Registry-only options (D-12), deduped + sorted. A persisted value the registry no
// longer knows stays selectable as "(current)" so a round-trip never silently drops it.
const models = Array.from(new Set(registryModels)).sort((a, b) => a.localeCompare(b))
const currentIsCustom = !!judgeModel && !models.includes(judgeModel)
```

**✅ CLONE — the option assembly order: leading auto/inherit option, then `(current)`, then the list**
(`ModelDefaultPreference.tsx:94-103`):

```tsx
<option value="">Auto · {pref?.effective_model || "organization default"}</option>
{/* Keep an unknown persisted value selectable so the round-trip never drops it. */}
{currentIsUnknown && defaultModel && (
  <option value={defaultModel}>{defaultModel} (current)</option>
)}
{models.map((m) => (
  <option key={m} value={m}>
    {m}
  </option>
))}
```

> ⚠ **D-06 diverges from this analog deliberately, and the divergence is the phase's point.** The
> shipped leading option asserts a resolved default (`Auto · {effective_model}`) and both shipped
> pickers back it with an always-on footer that asserts one too (`ModelDefaultPreference.tsx:122-124`:
> ``Effective model: ${effective}``). **`ModelField` must not.** The label carries the hedge, and when
> no run-default resolves it degrades to the bare sentence — never to a guessed id.

**✅ CLONE — the disabled-select classes** (`ModelDefaultPreference.tsx:92`):

```
"h-8 flex-1 rounded-md bg-muted/30 px-2 text-xs font-mono ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
```

> But **prefer the panel's own classes** where they conflict — see `SelectField` below. `ModelField`
> lives in the panel, not in a settings card.

**❌ DO NOT CLONE — the fetch pair** (`ModelDefaultPreference.tsx:28-45`):

```tsx
const [pref, setPref] = useState<ModelDefault | null>(null)
...
useEffect(() => {
  let cancelled = false
  void (async () => {
    try {
      const p = await getModelDefault()
      if (!cancelled) setPref(p)
    } catch (e) { ... }
  })()
  return () => { cancelled = true }
}, [])
```

Both shipped pickers own their fetch because each mounts **once**, as a page-level card. `ModelField`
mounts **four times** inside one panel. **The rows arrive as a prop.** This is also what makes
RESEARCH.md §F.16b's "no `useEffect`, no `useState`" source fence *satisfiable*.

**The panel primitive `ModelField` must compose with** — `PhaseFormPanel.tsx:336-376`, read in full:

```tsx
/** A labeled select. `disabled` greys it (read-only — integrity_policy). */
function SelectField(props: {
  label: string
  qualifier?: string
  hint?: string
  help?: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  onPersist: () => void
  disabled?: boolean
  full?: boolean
  caption?: string
}) {
  const id = useId()
  return (
    <div className={props.full ? "col-span-2" : ""}>
      <FieldLabel htmlFor={id} text={props.label} qualifier={props.qualifier} hint={props.hint} help={props.help} />
      <select
        id={id}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onPersist}
        className={[
          "w-full rounded border border-border px-2 py-1.5 text-[12px] focus:border-primary focus:outline-none",
          props.disabled
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-card text-foreground",
        ].join(" ")}
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {props.caption && <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{props.caption}</p>}
    </div>
  )
}
```

> **Four things to copy from it verbatim:** `const id = useId()` + `<FieldLabel htmlFor={id} …>`;
> `onChange` on the `<select>`, `onPersist` on `onBlur`; the exact `className` array; and the
> **`caption` slot** — D-08's *"not in the registry — forced emission unavailable…"* sentence goes
> there, not into a new markup shape.
>
> ⚠ `SelectField` takes `options: readonly string[]` and **cannot express `<optgroup>`**. Do not widen
> it (that puts picker logic back in the guarded file). `ModelField` renders its own `<select>` and
> reuses `FieldLabel`.

**The field it replaces** — `PhaseFormPanel.tsx:876-884`, the `llm_single` mount (the other three are
byte-similar at `:912-920`, and the `llm_batch_agents` / `llm_emit` sites):

```tsx
<TextField
  label="AI model"
  qualifier="(optional — uses the default if blank)"
  hint="model — pick a specific model, or leave blank to use the workspace default."
  help="Leave blank to use the workspace default."
  value={asStr(cfg.model)}
  onChange={set("model")}
  onPersist={onPersist}
/>
```

> ⚠ **`hint` and `help` are the panel's two-audience seam already in place.** `hint` carries the
> technical term (`model — …`) behind an ⓘ; `help` is the always-visible plain sentence. D-15's
> engine-words-vs-user-words rule has a home here — reuse it rather than inventing a third slot.

**Badging vocabulary + the ICON CONVENTION seam** — `frontend/src/components/settings/ModelPillRow.tsx`.
Import site, `:2`:

```tsx
import { providerLogo, modelLogo } from "@/lib/providerLogo"
```

Use site, `:105` (the **`modelLogo` first, `providerLogo` fallback** order):

```tsx
// Model-icons pass: the model's OWN @lobehub family mark per pill
// (Claude / Gemini / Llama / …), falling back to the active provider's mark
// — the same single-source seam the composer uses (ICON CONVENTION). Absent
// both → no icon, so the pill renders exactly as before.
const PillMark = modelLogo(m) ?? ProviderMark
```

And the deprecated badge — informational, **stays selectable** (`ModelPillRow.tsx:128-134`):

```tsx
{isDeprecated && (
  <span
    className="text-[9px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full ghost-border"
    title="This model is deprecated. It still works, but consider moving to a newer model."
  >
    deprecated
  </span>
)}
```

> ⚠ **`ModelPillRow` is a row of `<button>`s, so its chips are DOM siblings. A native `<option>`
> cannot host them.** Clone the *vocabulary* and the *deprecated ≠ disabled* rule; a logo cannot
> render inside an `<option>` at all. If a logo is wanted anywhere on this surface it must sit
> **outside** the `<select>` (e.g. beside the label), and it comes from `@/lib/providerLogo` — never a
> direct `@lobehub/icons` import.

---

### `frontend/src/components/workflows/modelFitness.ts` (utility, transform)

**Analog:** `frontend/src/components/workflows/runVocabulary.ts` — the shipped "one derivation, two
vocabularies" module, colocated in the same directory, with its own `runVocabulary.test.ts`.

**Docblock pattern — state the fence the file exists to keep** (`runVocabulary.ts:1-16`):

```
/**
 * Phase 188 Plan 06 (RUNVIZ-01 — SPEC Req 5, D-188-02 / …) — the CANVAS's run vocabulary.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: one derivation, two vocabularies. `lib/phaseState`
 * owns the DERIVATION (which reading a step is in) and holds no user-facing words at
 * all. This module owns the canvas's WORDS for those readings, and holds no derivation
 * at all — no status mapping, no collapse rule, no database literals. …
 *
 * Siting the words HERE rather than inside `phaseState.ts` is what keeps that fence
 * able to tell vocabulary from derivation (D-188-02).
 */
```

**Purity declaration** (`runVocabulary.ts:37-40`):

```
 * Pure data + pure functions. No React, no hooks, no JSX, and exactly TWO imports,
 * both type-only — so this module contributes nothing to the runtime graph and an ESM
 * cycle is impossible by construction.
```

**Export shape — a `Record` keyed on the engine value, plus a lookup function** (`:79`, `:136`, `:262`):

```ts
export const RUN_READING_WORD: Record<CanvasReading, string> = {
  "not-started": "Not started",
  ...
}
export function runReadingWord(reading: CanvasReading): string { ... }
export function runReadingLabel(reading: CanvasReading, emitFailure?: EmitFailure | null): string { ... }
```

**Direct transfer for `modelFitness.ts`:** `EMIT_TIER_WORD: Record<EmitTier, string>` + a
`modelFitnessWord(tier: string | null | undefined): string` that applies the **`?? "coerce"`** default —
mirroring the backend read-time default at `backend/app/services/forced_emit.py:376-378`:

```python
emit_tier = cap.get("emit_tier", "coerce")
if emit_tier not in _RUNGS_BY_TIER:  # boundary guard — an unknown value is coerce-safe
    emit_tier = "coerce"
```

> ⚠ **Copy the boundary guard too, not just the default.** An unrecognised tier string must land on
> `coerce`, never render blank — otherwise a DB row an operator typo'd shows a model as unlabelled
> rather than best-effort, which is the optimistic direction.

> ⚠ **`runVocabulary.ts:19-33` records a real trap worth honouring here:** *"a comment that quotes the
> token a fence forbids makes the fence vacuous"* (the 187-24 lesson). If `ModelField.test.tsx` greps
> the component source for `useEffect`, then **`modelFitness.ts`'s docblock must not contain the word
> either** if it shares a fence — check the fence's scope before writing prose.

---

### `frontend/src/hooks/useComposerModel.ts` (hook, event-driven)

**No single exact analog — two partial ones, each covering a half. Both were read.**

**(a) Shape + purpose: `frontend/src/hooks/useFollowScroll.ts`** — the closest shipped case of
*state lifted out of a hot chat component into a hooks-directory leaf*.

Docblock (`:3-12`):

```
/**
 * Phase 095 Plan 04 (D-03) — the follow-but-release scroll state machine.
 *
 * The one genuinely-new behavior on the chat scroll container (BUG-260529-02 #1,
 * SKETCH-CONSISTENCY §B "Smart follow-scroll"). It EXTENDS — never replaces — the
 * MessageList `isNearBottom < 120` heuristic and the BL-05 listener-attach guard.
 *
 * The machine:
 *   - `isPinned` (default true): the chat is following the live edge.
 *   …
```

Signature + return (`:46-49`, `:99`):

```ts
export function useFollowScroll(
  getViewport: () => HTMLElement | null,
  isStreaming: boolean,
): FollowScroll {
  ...
  return { isPinned, showJumpToLive, jumpToLive, onScroll, beginProgrammaticScroll }
}
```

> **Two habits to copy:** an **exported named return type** (`FollowScroll`) rather than an inline
> object type, and a docblock that spells the **state machine as bullets** before any code. For
> `useComposerModel`, those bullets are exactly the D-18 fallback chain:
> *last-used enabled model → the `active_model` global-default seed → `activeProvider.models[0]` → `""`*.

**(b) Load-effect discipline: `frontend/src/hooks/useTemplatePlaceholders.ts:1-18`** — the tree's most
recent leaf hook, and it names its own template:

```
 * Modelled on `useGroundingBundle.ts` — same module shape, same discipline: the two
 * waiting readings are DERIVED and frozen at module scope (the
 * `react-hooks/set-state-in-effect` shape that hook documents), the abort predicate is a
 * module-local copy, and a failed read resolves to a distinct union member rather than
 * to an empty success.
```

> ⚠ **"A failed read resolves to a distinct union member rather than to an empty success"** is the
> rule that matters for D-18: a thread whose model cannot be derived is **not** the same as a thread
> whose model is the global default. Model it as a distinct state, or the restore is silently
> indistinguishable from never having tried.

**What is being moved, verbatim** (`ChatArea.tsx:59-65` — 5 `useState`):

```tsx
const [providers, setProviders] = useState<Provider[]>([])
const [selectedProvider, setSelectedProvider] = useState<string>("")
const [models, setModels] = useState<string[]>([])
const [selectedModel, setSelectedModel] = useState<string>("")
// Phase 149 (IN-01 / D-149-05): the registry's deprecated-model ids, threaded from
// getProviders() into MessageInput so the chat picker renders the informational
// `deprecated` badge (deprecated ≠ disabled — the model stays selectable).
const [deprecatedModels, setDeprecatedModels] = useState<Set<string>>(new Set())
```

The load effect (`ChatArea.tsx:142-157`) — note it **already contains the seed rule D-18 prepends to**:

```tsx
useEffect(() => {
  getProviders()
    .then(({ active, active_model, providers: list, deprecated_models }) => {
      setProviders(list)
      // Defensive: absent → empty set → no badge (older backend / read blip).
      setDeprecatedModels(new Set(deprecated_models ?? []))
      const activeProvider = list.find((p) => p.id === active) ?? list[0]
      if (activeProvider) {
        setSelectedProvider(activeProvider.id)
        setModels(activeProvider.models)
        const preferred = active_model && activeProvider.models.includes(active_model)
          ? active_model
          : (activeProvider.models[0] ?? "")
        setSelectedModel(preferred)
      }
    })
    .catch(console.error)
}, [])
```

And the clobberer (`ChatArea.tsx:198-205`) — RESEARCH.md Pitfall 6 in source form:

```tsx
// Update model list when provider changes
const handleProviderChange = (providerId: string) => {
  setSelectedProvider(providerId)
  const p = providers.find((x) => x.id === providerId)
  if (p) {
    setModels(p.models)
    setSelectedModel(p.models[0] ?? "")
  }
}
```

> ⚠ **The `preferred` ternary at `:151-153` is the pattern D-18 extends, not replaces.** It already
> implements *"use the stored value **iff** it is in the current provider's list, else fall back"* —
> the same shape D-07's enabled-check needs. Prepend a rung; do not author a second rule.

---

### `supabase/migrations/120_model_capabilities_overrides_emit_tier.sql` (migration, schema)

**Composite analog — two files, each contributing a half.**

**(a) The CHECK'd text column: `supabase/migrations/081_eval_verdict_and_ratings.sql:46-47`** — the only
shipped `ADD COLUMN` carrying an inline enum CHECK:

```sql
ALTER TABLE public.eval_results
  ADD COLUMN verdict_state text NOT NULL DEFAULT 'not_measured' CHECK (verdict_state IN ('graded','not_measured','judge_error')),
  ADD COLUMN verdict_passed  boolean,   -- NULL unless verdict_state='graded'
```

…plus 081's `COMMENT ON COLUMN` habit (`:52-58`), which is how this repo records *why a value set is
what it is* next to the constraint that enforces it.

**(b) The same-table header, idempotence and parity discipline: `supabase/migrations/099_model_registry_deprecated.sql`** — this migration
last touched **`model_capabilities_overrides` itself**:

```sql
-- Metadata-only: three idempotent ADD COLUMN statements. No data backfill — existing override rows
-- inherit `deprecated=false` from the column DEFAULT. No RLS policy: migration 053 already ships
-- `FOR SELECT TO authenticated USING (true)` on model_capabilities_overrides (read-all), and
-- app_settings writes are service-role only. Analog shape: 098_feature_visibility.sql.
--
-- APPLY (CLAUDE.md): paste the FULL contents of this file into the LOCAL Supabase SQL editor and
--   run it. Idempotent (ADD COLUMN IF NOT EXISTS) — safe to re-run.
--   NEVER `supabase db push` / `supabase db reset` — those wipe local dev data.
-- THEN: from the repo root run `bash scripts/regenerate-full-schema.sh` (no --reset — a live-DB
--   schema dump that preserves data) to rebuild supabase/full-schema.sql, then commit this file +
--   full-schema.sql together.
-- CLOUD PARITY: paste this same SQL into the CLOUD Supabase SQL editor at promotion — a new column
--   is a non-code deploy half (docs/DEPLOYMENT-WORKFLOW.md deploy-parity checklist).

-- ── D-149-04: deprecated state on model_capabilities_overrides ──────────────
ALTER TABLE public.model_capabilities_overrides
  ADD COLUMN IF NOT EXISTS deprecated boolean NOT NULL DEFAULT false;
```

> **The synthesis the planner writes:** 099's header + `IF NOT EXISTS` + "no RLS policy needed, mig
> 053 already ships read-all" paragraph, with 081's `text … CHECK (… IN (…))` and a
> `COMMENT ON COLUMN`. Nullable with **no** `NOT NULL DEFAULT` (37 existing rows must read `NULL` →
> read-time `coerce`, i.e. byte-identical behaviour).
>
> ⚠ **`ADD COLUMN IF NOT EXISTS x text CHECK (...)` re-run behaviour is NOT proven by either analog** —
> 099 is idempotent but has no CHECK; 081 has a CHECK but no `IF NOT EXISTS`. Drive it on the local DB
> before declaring the file idempotent; do not assert it in a comment on faith.

**(c) The two-layer lesson that binds the CHECK — `114_harness_audit_action_risk_pending.sql:17-22`:**

```sql
-- ALTER (NOT CREATE — harness_audit exists since 059; the CHECK was last widened by
-- 070). Adds exactly ONE literal (22 → 23) and changes nothing else … The closed-vocabulary
-- property the CHECK exists for is preserved — this widens it by one REVIEWED literal, and the
-- Python set is pinned equal to this list by backend/tests/unit/test_audit_event_registration.py.
```

---

### `backend/tests/test_196_model_registry_route.py` (test, integration)

**Analog:** `backend/tests/test_149_registry_read.py` — the *same route family*, same fixtures.

**The shared fixtures, verified in `backend/tests/conftest.py:222-235`:**

```python
@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_user():
    return mock_user_data


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}
```

**⚠ The authenticated-NON-operator drive is a POOL PATCH, not a dependency override.** The conftest
warns about this explicitly (`conftest.py:250-262`):

```python
@pytest.fixture
def operator_override():
    """Phase 146 (ADMIN-01) — force the operator-present branch of the /admin gate. …

    NOTE: overriding ``require_operator`` bypasses ``request.state.operator = ...``, so
    the audit floor teardown sees no operator and writes nothing. To exercise the
    real gate + floor write path, drive the operator branch via the asyncpg pool mock
    (``set_fetchrow_result({...})``) instead of this override.
    """
```

**The non-operator pattern to copy, verbatim** (`test_149_model_gate.py:24-31`):

```python
def test_get_models_404_for_non_operator(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """GET /admin/models → byte-identical 404 for a non-operator (non-discoverable)."""
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(None)  # operator_users lookup → no row
    res = client.get("/admin/models", headers=auth_headers)
    assert res.status_code == 404
    assert res.json() == {"detail": "Not Found"}  # byte-identical body
    assert "application/json" in res.headers.get("content-type", "")
```

> **This is the exact fixture combination SC#1's two route tests need:** the *same*
> `set_fetchrow_result(None)` non-operator identity must **200** on `GET /models/registry` and **404**
> on `GET /admin/models`, in the same file, so "the gate was not widened" is proven by contrast rather
> than by a second file that could drift.

**The union assertions to clone** (`test_149_registry_read.py:105-140`):

```python
def test_get_models_returns_union_with_sources(client, auth_headers, mock_asyncpg_pool, monkeypatch):
    """The union carries DEF (registry) + OVR (db_override) + DB-only rows; a disabled
    row is PRESENT (all-rows, not filtered)."""
    _prime_endpoint(monkeypatch, mock_asyncpg_pool, {"user_id": "op-1"}, [
        # OVR over a built-in model, DISABLED — must still appear in the registry read.
        {"model_id": "gpt-4o", "provider": "openai", "enabled": False, "deprecated": True, ...},
        # DB-only row (not in MODEL_CAPABILITIES) — a discovery-confirmed model.
        {"model_id": "brand-new-model", "provider": "openai", "enabled": True, "deprecated": False},
    ])

    res = client.get("/admin/models", headers=auth_headers)
    assert res.status_code == 200
    by_id = {r["model_id"]: r for r in body["models"]}
    assert by_id["gpt-4o"]["capability_source"] == "db_override"
    assert by_id["brand-new-model"]["capability_source"] == "db_override"
    def_row = by_id["claude-opus-4-8"]
    assert def_row["capability_source"] == "registry"
    assert def_row["enabled"] is True
```

**The priming helper — the parallel-safe, zero-DB-mutation seeding** (`test_149_registry_read.py:89-102`):

```python
def _prime_endpoint(monkeypatch, mock_asyncpg_pool, fetchrow_row, override_rows):
    """Drive the operator branch + seed the reads for the union endpoint.

    The mock pool's sticky ``fetchrow`` doubles as (a) the operator-membership row for
    ``is_operator`` (any truthy dict → operator) and (b) the app_settings row for
    ``_load_settings_from_db`` (read via ``.get`` — extra keys like llm_model steer
    is_default/is_locked). ``fetch`` returns the override rows for load_all_model_overrides.
    """
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result(fetchrow_row)
    mock_asyncpg_pool.set_fetch_result(override_rows)
    us._settings_cache = None
    us._settings_cache_time = 0.0
    _reset_override_caches()
```

And the cache reset it calls (`:34-38`) — **load-bearing: without it the 30 s TTL leaks state between
tests and the union assertions go non-deterministic:**

```python
def _reset_override_caches():
    us._model_overrides_cache = {}
    us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}
    us._all_model_overrides_cache_time = 0.0
```

> ✅ **Parallel-safety verdict: this whole family patches `app.dependencies._pg_pool` and mutates zero
> database rows.** Under CLAUDE.md rule 4 these plans need **no serialisation**.

---

### `backend/tests/unit/test_196_judge_model_db_backed.py` (test, unit — D-17, BINDING)

**Analog:** `backend/tests/test_149_default_guard.py:51-64` — the shipped `_load_settings_from_db` patch,
verified at 5 call sites across the suite.

```python
def _mock_settings(monkeypatch, *, llm_model="", llm_model_locked=False):
    """Patch the function-local _load_settings_from_db the disable guard reads."""
    async def _fake():
        return {"llm_model": llm_model, "llm_model_locked": llm_model_locked}

    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake)


def _mock_overrides(monkeypatch, overrides):
    """Patch the function-local load_all_model_overrides the lock guard reads."""
    async def _fake():
        return overrides

    monkeypatch.setattr("app.models.user_settings.load_all_model_overrides", _fake)
```

**The "no write reached" assertion shape** (`test_149_default_guard.py:31-40, :76-86`) — reusable
verbatim for D-09's *"the refusal fires before any write"*:

```python
class _RecordingPool:
    """asyncpg-pool stand-in recording every ``execute(sql, *args)`` — proves whether the
    upsert write path was reached (a 409 guard must leave ``.calls`` empty)."""

    def __init__(self):
        self.calls = []

    async def execute(self, sql, *args):
        self.calls.append((sql, args))
        return "INSERT 0 1"

...
    with pytest.raises(HTTPException) as ei:
        await set_model_capability("gpt-4o", {"enabled": False}, _fake_request(), _floor=None)
    assert ei.value.status_code == 409
    assert not pool.calls, "the disable guard must 409 BEFORE any capability write"
```

**Also copy the ordering-assertion trick** (`:96-111`) — it proves a *sequence*, not just an outcome:

```python
    order: list[str] = []
    ...
    assert order == ["invalidate", "load"], "the guard must invalidate the cache BEFORE reading"
```

> ⚠ **The anti-pattern this test exists to avoid is in the same tree.** `test_149_default_guard.py:43-48`
> builds a `SimpleNamespace` request stub — legitimately, for a *request*. But
> `backend/tests/unit/test_settings.py:17-65` builds `SimpleNamespace(harness_judge_model=...)` and
> hands it to the resolver, which is the shape RESEARCH.md Pitfall 5 says *is why the bug survived*.
> **`SimpleNamespace` must not appear anywhere near the settings object in the new file.**

**The DB-backed loader the four consumers must adopt — a real shipped call site**
(`backend/app/api/skill_tuner.py:728-730`):

```python
            from app.models.user_settings import load_app_settings_async  # function-local (Pitfall 4)

            eff = await load_app_settings_async()
            targets = skill_tuner_service.configured_targets(eff)
```

Note its docblock reason at `:724-727`, which is **the same defect class D-17 fixes**:

```python
            # (provider keys saved through the Settings UI live in app_settings, surfaced via
            # UserEffectiveSettings.providers), NOT the env-level ``settings`` singleton whose
            # flat ``{provider}_api_key`` attrs are empty for UI-configured installs.
```

**The resolver that must NOT change** (`backend/app/services/harness/validator_kinds.py:65-87`):

```python
def resolve_judge_model(settings) -> str | None:
    """... Resolution order (D-03 …):
      1. ``settings.harness_judge_model`` if set.
      2. else the first registry default in ``("claude-opus-4-8", "gpt-5.5")`` whose
         ``get_model_capability(candidate).get("forced_emission")`` is truthy.
      3. else ``None`` (the caller emits an honest "no judge model resolved" failure).
    """
    model = getattr(settings, "harness_judge_model", None)
    if model:
        return model
```

**Consumer 4's precedence chain — only the third rung changes** (`validator_kinds.py:531-536`):

```python
    # Resolve the INDEPENDENT judge model (D-03) — config override, ctx, then the
    # shared resolver (WR-05) so the in-run validator gets the SAME registry default
    # (claude-opus-4-8 / gpt-5.5) the publish path resolves.
    model = config.get("model") or getattr(ctx, "judge_model", None)
    if model is None:
        from app.config import settings  # function-local

        model = resolve_judge_model(settings)
```

---

### `backend/tests/unit/test_196_emit_tier_two_layer_pin.py` (test, structural guard — A7)

**Analog:** `backend/tests/unit/test_audit_event_registration.py` — read in full. It is the tree's only
two-layer (Python-constant ≡ SQL-CHECK) pin, and RESEARCH.md A7 asks for exactly its shape.

**The docblock states why the file may not be deleted** (`:1-31`, abridged):

```python
"""Structural guards for the harness_audit event vocabulary — TWO layers, kept equal.

WHY THIS FILE EXISTS (do not mistake it for ceremony and delete it).
...
Registering a kind in only layer 1 does not fix anything; it MOVES the failure from a
ValueError to a mid-run Postgres error. So ``G2`` (the two sets are equal) is the
load-bearing guard here — it is the check that would have caught this at author time.
...
Both guards carry a POSITIVE CONTROL that exercises THE SAME extractor over an inline
fixture known to be broken. A guard whose control was never observed red is not evidence.
Both guards also assert NON-VACUITY: a regex that silently matched nothing would otherwise
pass forever while checking absolutely nothing.
"""
```

**Path derivation from the test file's own location** (`:41-45`):

```python
# backend/tests/unit/<this file> → parents[2] == backend/, parents[3] == repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_APP_DIR = _BACKEND_DIR / "app"
_MIGRATIONS_DIR = _REPO_ROOT / "supabase" / "migrations"
```

**"Highest-numbered migration wins" — so the pin never goes stale on the next migration** (`:103-116`):

```python
def _highest_numbered_check_migration() -> tuple[Path, list[str]]:
    """The CHECK literal set from the HIGHEST-numbered migration that defines it."""
    candidates: list[tuple[int, Path, list[str]]] = []
    for path in sorted(_MIGRATIONS_DIR.glob("*.sql")):
        literals = _extract_check_literals(path.read_text(encoding="utf-8"))
        if literals is not None:
            candidates.append((_migration_number(path), path, literals))
    assert candidates, (
        f"NON-VACUITY FAILURE: no migration under {_MIGRATIONS_DIR} defines "
        f"harness_audit_event_type_check. The parser matched nothing — fix the parser, "
        f"do not weaken this assertion."
    )
```

**The equality assertion, both directions, each with its own failure sentence** (`:216-230`):

```python
    missing_from_sql = python_set - sql_set
    missing_from_python = sql_set - python_set

    assert not missing_from_sql, (
        f"Registered in Python but ABSENT from {migration_path.name}'s CHECK: "
        f"{sorted(missing_from_sql)}. write_audit would pass its allow-list and then "
        f"die on a Postgres 23514 MID-RUN. Ship a migration extending "
        f"harness_audit_event_type_check."
    )
    assert not missing_from_python, ( ... )
    assert python_set == sql_set
```

**The SQL-comment stripping gotcha, which any CHECK parser inherits** (`:83-95`):

```python
def _extract_check_literals(sql: str) -> list[str] | None:
    """The quoted literals of the ``harness_audit_event_type_check`` body, or ``None``.

    SQL line comments are stripped FIRST: the grouping comments inside the CHECK body
    contain parentheses (``-- 069 (Phase 101.1) emit transitions:``) which would
    otherwise terminate the body match early and silently under-report the literal set.
    That exact mis-parse was observed while authoring this guard.
    """
```

> **For A7, the two layers are:** the `120_` CHECK's `('force_strict','force','coerce')` and the Python
> `set(_RUNGS_BY_TIER)` in `backend/app/services/forced_emit.py`. Assert **equality**, add a positive
> control over the *same* parser, and add the non-vacuity floor. ⚠ **Note the direction difference:**
> `test_g1` is deliberately one-directional (`registered-but-unemitted is benign`) while `test_g2` is
> an equality — for `emit_tier` the equality is the right one in **both** directions, because a tier
> the DB accepts and the ladder rejects degrades a run silently.

---

### `frontend/src/components/workflows/ModelField.test.tsx` (test, render)

**Analog:** `frontend/src/components/settings/ModelDefaultPreference.test.tsx` — read in full; it is
already ~90 % of the assertions SC#1/SC#2 need.

**Option-set assertion (SC#1: "renders only ids from the payload")** (`:52-64`):

```tsx
it("offers ONLY the allowed/enabled models (plus the Auto default), never a disallowed model", async () => {
  render(<ModelDefaultPreference />)
  await screen.findByTestId("model-default-effective")
  const select = screen.getByRole("combobox", { name: /default model/i })
  const options = within(select).getAllByRole("option")
  // Auto default + the 3 allowed models — nothing else.
  expect(options).toHaveLength(ALLOWED.length + 1)
  for (const m of ALLOWED) {
    expect(within(select).getByRole("option", { name: m })).toBeInTheDocument()
  }
  // A model the operator has NOT enabled is never selectable.
  expect(within(select).queryByRole("option", { name: "totally-disallowed-model" })).toBeNull()
})
```

**`(current)` retention (D-07 / D-08)** (`:108-118`):

```tsx
it("keeps a persisted UNKNOWN value selectable as (current) so a round-trip never drops it", async () => {
  mockGet.mockResolvedValue(
    pref({ default_model: "legacy-retired-model", effective_model: "legacy-retired-model" }),
  )
  render(<ModelDefaultPreference />)
  await screen.findByTestId("model-default-effective")
  const select = screen.getByRole("combobox", { name: /default model/i }) as HTMLSelectElement
  // The unknown persisted value is preserved as a "(current)" option and stays selected.
  expect(within(select).getByText(/legacy-retired-model \(current\)/i)).toBeInTheDocument()
  await waitFor(() => expect(select.value).toBe("legacy-retired-model"))
})
```

**Fixture-builder pattern — a `pref(overrides)` factory + `beforeEach` defaults** (`:31-49`):

```tsx
const ALLOWED = ["claude-opus-4-8", "gpt-5.4", "gemini-2.5-pro"]

function pref(overrides: Partial<ModelDefault> = {}): ModelDefault {
  return { default_model: null, effective_model: "claude-opus-4-8", locked: false, allowed_models: ALLOWED, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue(pref())
  ...
})
```

> ⚠ **Two things this analog does NOT give you, and both are load-bearing for 196:**
>
> 1. **No `vi.mock("@/lib/api")` block** in `ModelField.test.tsx` — the component takes `models` as a
>    prop, so there is nothing to mock. That absence is itself the proof of the F.16b property.
> 2. **No "does not write on open" case exists anywhere in this tree.** Both shipped pickers get it
>    right by accident (they persist in `onSelect`). The new case is genuinely novel:
>    render with `value="gpt-5.2"` and `value="not-a-real-model"`, assert `onChange`/`onPersist` are
>    `toHaveBeenCalledTimes(0)`, and assert `(select as HTMLSelectElement).value` equals the stored id.
> 3. ⚠ **Pitfall 4 applies to the fixture array too:** `ALLOWED` above is exactly the "safe values"
>    shape. Use `gpt-5.2` (disabled), `gpt-5.5` (code-only), `glm-4.7-flash` (DB-only/`coerce`),
>    `gemini-3.6-flash` — a fixture of only registry-known enabled ids proves nothing.

---

## Shared Patterns

### S1 — The source fence (apply to: `PhaseFormPanel.test.tsx`, `ModelField.test.tsx`)

**Source:** `frontend/src/components/workflows/PhaseFormPanel.test.tsx:480-488` — **quoted verbatim**,
because Phase 196 owes a fence of exactly this shape scoped to `<ModelField`:

```tsx
  it("SOURCE — the mount really is ONE gated line and the panel computes nothing for it", () => {
    // The G-5 shape this file's ledger row demands, asserted rather than described. The whole
    // cost of this surface in this file is an import, a prop, a destructure and one line.
    const mounts = phaseFormPanelSource.split("\n").filter((line) => line.includes("<TemplateNameCheck"))
    expect(mounts).toHaveLength(1)
    expect(mounts[0]).toContain('pt === "llm_emit"')
    // …and it forwards the prop whole rather than picking it apart here.
    expect(mounts[0]).toContain("{...nameCheck}")
  })
})
```

**The `?raw` import that makes it possible** (`PhaseFormPanel.test.tsx:22-24`):

```tsx
// Read the component SOURCE via Vite's ?raw loader (typechecks under `vite/client`).
import phaseFormPanelSource from "./PhaseFormPanel?raw"
import { PhaseFormPanel } from "./PhaseFormPanel"
```

**The property it guards, in source** (`PhaseFormPanel.tsx:1116`):

```tsx
        {nameCheck && pt === "llm_emit" && <TemplateNameCheck {...nameCheck} />}
```

**The one-new-prop threading, all three touch points** — this is the whole cost the fence's comment
refers to (*"an import, a prop, a destructure and one line"*):

`PhaseFormPanel.tsx:202-204` (the prop, on `PhaseFormPanelProps`):

```tsx
  nameCheck?: {
    classification: TemplateNameClassification
  }
```

`PhaseFormPanel.tsx:760` (the destructure, one identifier in the existing list):

```tsx
  template,
  nameCheck,
}: PhaseFormPanelProps) {
```

And the standing order the prop's own docblock carries (`PhaseFormPanel.tsx:195-200`):

```
   * ⚠ ONE GATED LINE, BY STANDING ORDER (G-5 / D-22). This file measures 15 commits across 7
   * phases and 1136 lines, so G-5 fires on it, and its hot-file ledger row closes with an
   * instruction rather than a status: *"the next surface that needs the panel gets its own
   * component and one gated line."* Phase 185 honoured it, Phase 193 honoured it again at the
   * mount below, and this is the third. A name check written inline here would turn an
   * honoured guardrail into a violated one. **No override is recorded for Phase 193.1.**
```

> ⚠ **The shipped fence is scoped to `<TemplateNameCheck` and will NOT fire on a `ModelField` mount.**
> Phase 196's new fence expects **4** mounts (not 1), so `toHaveLength(4)`, a sorted `pt ===` capture,
> `{...modelField}` on every line, and `showFitness` only on the `llm_emit` one.
>
> ⚠ **`PhaseFormPanel.rails.test.tsx:485-500` holds two sibling source assertions** (capability names
> ABSENT from the panel source; `<ToolsField` appears exactly twice). Re-read both before adding text
> to the panel — a `ModelField` mount does not affect them, but a new *label string* might.

### S2 — The 400-on-out-of-set refusal (apply to: `workflows.py` `create_draft` / `update_draft`)

**Source:** `backend/app/api/me_preferences.py:87-96` — named by D-09 as the precedent, verified today:

```python
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

**But the object-shaped refusal in the destination file is the closer match** — `workflows.py:1296-1310`:

```python
        if cause == "stale_token":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                # THE CLIENT BRANCHES ON ``code``, NEVER ON THIS PROSE. The message is
                # for a human reading a log; rewording it must never change behaviour.
                detail={
                    "code": "stale_token",
                    "message": "this draft was changed somewhere else since you loaded it",
                    "token": row.get("token"),
                },
            )
        # ``not_found`` — and any cause this route does not recognise — fails closed to
        # the dullest answer there is. A new refusal cause must be mapped deliberately.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="draft not found")
```

> ⚠ **Two rules the comments make explicit and the plan must honour:** (1) the client branches on
> `code`, never prose — so the `unknown_model` refusal is an **object**; (2) *"a new refusal cause must
> be mapped deliberately"* — the new refusal joins this register, it does not sit above it.
>
> ⚠ **Ordering, from the Security Domain section:** the refusal must fire **after** the existing
> ownership resolution, so a 400 never distinguishes "not yours" from "bad model". The place to hook
> `create_draft` is right after its server-side status force (`workflows.py:1166-1168`):
>
> ```python
> pool = await get_pg_pool()
> user_id = _coerce_user_id(current_user)
> # Force draft status server-side — never trust the client's ``status``:
> body = body.model_copy(update={"status": "draft"})
> ```

### S3 — 422-before-any-DB-touch on the enum PATCH (apply to: `admin.py` `set_model_capability`)

**Source:** `backend/app/api/admin.py:1374-1394` — the existing per-column guard loop. D-14 adds a
**fourth `elif`**, structurally identical to the three that ship:

```python
    for col, val in body.items():
        if val is None:
            continue  # explicit null → Reset (clears to DEF); valid for any column.
        if col in _MODEL_CAP_INT_COLUMNS:
            if isinstance(val, bool) or not isinstance(val, int):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"'{col}' must be an integer or null.",
                )
        elif col in _MODEL_CAP_BOOL_COLUMNS:
            if not isinstance(val, bool):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"'{col}' must be a boolean or null.",
                )
        elif col == "deprecated_reason":
            if not isinstance(val, str):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="'deprecated_reason' must be a string or null.",
                )
```

Preceded by the allowlist gate (`:1361-1367`):

```python
    # T-149-11: allowlist BEFORE any DB touch. An unknown field never reaches a SET clause.
    unknown = [k for k in body if k not in _MODEL_CAP_COLUMNS]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown capability field(s): {', '.join(sorted(unknown))}",
        )
```

> **The new constant goes beside its siblings** at `admin.py:145-150`
> (`_MODEL_CAP_INT_COLUMNS` / `_MODEL_CAP_BOOL_COLUMNS`) — i.e.
> `_MODEL_CAP_ENUM_COLUMNS = {"emit_tier": {"force_strict", "force", "coerce"}}`. ⚠ That literal set is
> **the second of A7's two layers** — the pin test (§`test_196_emit_tier_two_layer_pin.py`) should
> arguably assert **three-way** equality across the CHECK, this constant and `_RUNGS_BY_TIER`, or state
> in one line why it does not.
>
> ⚠ **SEED-172's numeric bounds check (a deferred idea whose re-open trigger this phase fires) lands
> inside the `_MODEL_CAP_INT_COLUMNS` branch above** — the same loop, the same 422, the same test file.
> RESEARCH.md §D.12 measures the cost at ~10 lines. Surface it as a plan-time question with the cost
> attached; do not fold it silently.

### S4 — Function-local imports on `admin.py`'s load path (apply to: every `admin.py` edit)

**Source:** `admin.py:1122-1123` — the discipline, and its stated reason:

```python
    # Function-local imports (Pitfall 4 — keep the settings module off admin's load path).
    from app.models.user_settings import _load_settings_from_db, load_all_model_overrides
```

Repeated at `:1403-1406` and `:1441`. **Any new import into `admin.py` follows it.** Conversely, the
new leaf service is *free of this constraint* — which is §A.2's whole argument for extracting rather
than importing across `api/ → api/`.

### S5 — Envelope unwrapping in the client, never the component (apply to: `api.ts`)

**Source:** `frontend/src/lib/api.ts:5132-5143`:

```ts
/** Read the model registry (`GET /admin/models`, Plan 05). Plain authed GET — the
 *  router gate returns 404 to non-operators. The backend returns an ENVELOPE
 *  `{"models": [...]}` (same shape as `getAdminActiveRuns`'s `{runs}`); unwrap
 *  `.models` HERE — casting the raw object to `ModelRegistryRow[]` would ship a
 *  `{models}` object into list state and crash the next `.map` (CR-01 precedent). */
export async function getModelRegistry(): Promise<ModelRegistryRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the model registry.", res.status)
  const body = (await res.json()) as { models?: ModelRegistryRow[] }
  return body.models ?? []
}
```

**And the row type it returns** (`api.ts`, the `ModelRegistryRow` interface) — note the two
doc-comments that are *rules*, not description:

```ts
  /** IN-02: the stored deprecation reason (operator context, never shown to end users). … */
  deprecated_reason?: string | null
  /** WR-04 honesty: a numeric capability NOT tracked in the built-in registry reads `null`
   *  (rendered as "—" in the tab), NOT a concrete `0`. … */
  context_window_tokens: number | null
```

> ⚠ **`deprecated_reason` is documented as "never shown to end users" — it must NOT appear on the new
> author row type.** The new `AuthorModelRow` is a **separate interface**, not `Pick<ModelRegistryRow, …>`
> and not an extension: a structural allowlist is what stops a field added later from travelling.
> (This is the `_MODEL_CAP_COLUMNS` habit from S3, applied on the wire.)

### S6 — The two-audience ⌥ Technical-names reveal (apply to: `ModelField.tsx`, `ModelRegistryTab.tsx`)

**Source:** `frontend/src/components/admin/ModelRegistryTab.tsx` — the prop and the render form:

```tsx
  /** When true, reveal the raw column names (⌥ LANG-01 reveal). */
  showTechnical: boolean
```

```tsx
Tools {showTechnical && <TechName>native_tools</TechName>}
```

And the same idea in the panel's own vocabulary — `PhaseFormPanel.tsx:877-880`, where the technical
term lives in `hint` and the plain sentence in `help`:

```tsx
  qualifier="(optional — uses the default if blank)"
  hint="model — pick a specific model, or leave blank to use the workspace default."
  help="Leave blank to use the workspace default."
```

> **For `ModelField`, D-15's mapping is:** `<optgroup label>` (or the fitness suffix) carries the user
> sentence by default and swaps to `emit_tier: force_strict` under `showTechnical` — the **subtitle
> swaps, the option text (the model id) never does**, so the picked value is never ambiguous.

### S7 — The registry tab's control vocabulary (apply to: `ModelRegistryTab.tsx`)

**Source:** the tab has exactly two control shapes, and `emit_tier` fits **neither**.

Numeric (`ModelRegistryTab.tsx:61-74`):

```tsx
/** The three inline-editable numeric columns (the 112/FolderNode inline-edit cells). */
interface NumField {
  key: "context_window_tokens" | "max_output_tokens" | "llm_call_timeout_seconds"
  label: string
  tech: string
  /** Render suffix — the timeout reads as seconds. */
  suffix?: string
}

const NUM_FIELDS: readonly NumField[] = [
  { key: "context_window_tokens", label: "Context", tech: "context_window_tokens" },
  ...
]
```

Boolean (`ModelRegistryTab.tsx:690-713`, used at `:335`, `:348`, `:565`):

```tsx
/** A small accessible toggle (role="switch") reused for native_tools / enabled /
 *  … */
function RowToggle({ ... on, onToggle, ... })
```

> ⚠ **`emit_tier` is this tab's FIRST enum column.** It needs a small `<select>` control — a new shape,
> authored in the `NumField`/`RowToggle` house style (same `tech` field for the ⌥ reveal, same
> `void write({ emit_tier: … })` call form as `:342` / `:353`).
>
> ⚠ **`RowToggle`'s own docblock records an "honest lock" precedent** (`:328-334`): a control is
> disabled with a stated reason when a write would *record* something the runtime ignores. Open
> Question 2 asks for a caption saying an operator-set `emit_tier` is **an assertion, not a verified
> fact** — that caption belongs in this same register.

### S8 — The count-gate `TARGETS` adoption habit (apply to: `scripts/vitest-count-gate.cjs`)

**Source:** `scripts/vitest-count-gate.cjs:2285` onward. The gated bare directory this phase inherits
for free is the first entry:

```js
// ── The Wave-0 blast radius (184-VALIDATION.md § "quick run command"). ──
const TARGETS = [
  "src/components/workflows",
  "src/pages/WorkflowBuilderPage.test.tsx",
  ...
```

**Every adoption AND every decline carries a written reason** — the file's own rule, stated in its
comments:

```js
  // ── DECLINED, with its reason, so a decline can never read as an oversight ────────────
  // `src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` (2 tests) is DELIBERATELY NOT
  // adopted — into neither TARGETS nor BASELINE. … This script's own adoption rule requires a
  // stated reason either way: a decline with no recorded reason is indistinguishable from an
  // oversight, which is exactly the failure mode the rule exists to prevent.
```

And the same block records how a pin is set — **from the script's own printed `actual`, never from a
number in a document:**

```js
  // ⚠ Phase 192 WILL LOWER `WorkflowsPage.test.tsx`'s pin when D-01 deletes the shelf-order
  // tests. That lowering rides in the SAME COMMIT as the deletion, at a number read from this
  // script's own `actual` column — never to make a red gate go quiet.
```

> **Consequence for 196:** `ModelField.test.tsx` and `modelFitness.test.ts` are gated automatically
> (bare `src/components/workflows`). `src/hooks/useComposerModel.test.ts` and any
> `src/components/chat/ChatArea*.test.tsx` are **not** — they need explicit entries **with a stated
> reason**, in the same commit as the suites themselves.

### S9 — `services/` leaf-module conventions (apply to: `model_registry.py`, and to reading `phase_types.py`)

Beyond the extraction docstring (see the `model_registry.py` section), three habits recur in
`run_model_resolution.py` and should carry over:

1. **`from __future__ import annotations` + a module `logger`** (`:28-32`).
2. **A "byte-identical for the common case" promise, stated in the docstring and honoured by an
   identity return** (`apply_user_model_default`, `:198-209`): *"Unset -> strict no-op BEFORE any
   further read: byte-identical (D-14)."* — the exact shape D-10's `_effective_model_checked` needs
   (an **enabled** model must be a no-op, no notice, no extra read).
3. **Fail-open on a settings/registry blip** (`:210-214`):

```python
    except Exception:  # noqa: BLE001 — fail-open: a preference blip never breaks a send
        logger.warning(
            "apply_user_model_default: overlay failed; using settings unchanged", exc_info=True
        )
        return user_settings
```

> ⚠ **D-10 must decide fail-open vs fail-closed explicitly.** `_resolve_enabled_model` fails **open**
> (a read blip returns the model unchanged, `run_model_resolution.py:56-57`). Inheriting that for the
> harness means a registry-read failure lets a disabled model run — which is the *shipped* chat
> behaviour and therefore consistent, but it is a decision, not a default. Say which it is.

---

## No Analog Found

| File / element | Role | Data flow | Reason — and the closest partial match |
|---|---|---|---|
| **`ModelField.tsx`'s `<optgroup>` fitness grouping** | component | request-response | **No shipped `<select>` in `frontend/src` uses `<optgroup>`.** Both shipped pickers render a flat `{models.map(…)}` list (`ModelDefaultPreference.tsx:99-103`, `JudgeModelPicker.tsx:99-103`) and `SelectField` (`PhaseFormPanel.tsx:367-371`) takes `readonly string[]`. **Closest partial match:** the grouping *semantics* exist in `runVocabulary.ts` (a `Record<reading, words>` keyed on an engine value) — group **labels** come from `modelFitness.ts`, and only the `<optgroup>` JSX itself is novel. Render-test it against the option→group relationship, not against a snapshot. |
| **"Opening the form does not rewrite the stored value"** (D-07 / F.16b) | test (render) | request-response | **No shipped test asserts a picker performs zero writes on mount.** Both shipped pickers hold the property *by accident* (they persist only in `onSelect`). **Closest partial match:** the "no write reached" backend idiom — `test_149_default_guard.py:86` `assert not pool.calls, "the disable guard must 409 BEFORE any capability write"` — transposed to `expect(onChange).toHaveBeenCalledTimes(0)`. |
| **D-06's hedged inherit-option label** | component copy | — | **Every shipped picker asserts a resolved default** (`ModelDefaultPreference.tsx:94, :122-124`; `JudgeModelPicker.tsx:96, :112`). The honest-hedge form is net-new copy by design (D-06 calls the shipped footer shape *the exact class of lie this phase exists to remove*). **Closest partial match in tone:** `run_model_resolution.py:74-79`'s dead-default warning — *"we do not pretend the fallback is a clean route"*. |
| **`_emit_phase_substep(status="model_fallback")`'s frontend mapping** | component | event-driven | Not analysed here — it lives on the PhaseCard status switch, outside this phase's named file set. **RESEARCH.md A2 flags it as an assumption**: verify the `phase_substep` status switch has a default arm before choosing that carrier, or the notice is silent. |
| **`ADD COLUMN IF NOT EXISTS … CHECK (…)` idempotence** | migration | schema | Two half-analogs (081 has the CHECK, 099 has the idempotence) but **no shipped file combines them**. Drive the re-run on the local DB; do not claim idempotence in a comment on faith. |

---

## Metadata

**Analog search scope:**
`backend/app/api/` · `backend/app/services/` (+ `services/harness/`) · `backend/app/models/` ·
`backend/app/config.py` · `backend/tests/` (+ `tests/unit/`, `tests/integration/`) ·
`frontend/src/components/{workflows,settings,admin,chat}/` · `frontend/src/hooks/` ·
`frontend/src/lib/` · `supabase/migrations/` · `scripts/vitest-count-gate.cjs`

**Files opened and read this session (every excerpt above comes from one of these):**
`backend/app/api/admin.py` (`:115-164`, `:1040-1159`, `:1350-1444`) ·
`backend/app/api/me_preferences.py` (full) ·
`backend/app/api/workflows.py` (`:1160-1182`, `:1285-1315`) ·
`backend/app/api/skill_tuner.py` (`:724-734`) ·
`backend/app/config.py` (`:695-739`) ·
`backend/app/main.py` (`:700-740`) ·
`backend/app/services/run_model_resolution.py` (full) ·
`backend/app/services/harness/validator_kinds.py` (`:60-90`, `:528-540`) ·
`backend/tests/conftest.py` (`:218-277`) ·
`backend/tests/test_149_registry_read.py` (`:1-140`) ·
`backend/tests/test_149_model_gate.py` (`:1-76`) ·
`backend/tests/test_149_default_guard.py` (`:30-114`) ·
`backend/tests/unit/test_audit_event_registration.py` (full) ·
`supabase/migrations/099_model_registry_deprecated.sql` (full) ·
`supabase/migrations/114_harness_audit_action_risk_pending.sql` (full) ·
`supabase/migrations/081_eval_verdict_and_ratings.sql` (`:35-60`) ·
`frontend/src/components/settings/ModelDefaultPreference.tsx` (full) ·
`frontend/src/components/settings/ModelDefaultPreference.test.tsx` (full) ·
`frontend/src/components/settings/JudgeModelPicker.tsx` (full) ·
`frontend/src/components/settings/ModelPillRow.tsx` (`:1-10`, `:95-140`) ·
`frontend/src/components/workflows/PhaseFormPanel.tsx` (`:190-215`, `:280-390`, `:750-775`, `:860-930`, `:1116`) ·
`frontend/src/components/workflows/PhaseFormPanel.test.tsx` (`:1-60`, `:440-489`) ·
`frontend/src/components/workflows/runVocabulary.ts` (`:1-80` + export index) ·
`frontend/src/components/admin/ModelRegistryTab.tsx` (`:55-80` + control grep) ·
`frontend/src/components/chat/ChatArea.tsx` (`:50-80`, `:140-215`) ·
`frontend/src/hooks/useFollowScroll.ts` (`:1-22`, `:46-100`) ·
`frontend/src/hooks/useTemplatePlaceholders.ts` (`:1-18`) ·
`frontend/src/lib/api.ts` (`:5000-5060`, `:5125-5150`) ·
`scripts/vitest-count-gate.cjs` (`:2280-2295`, `:2550-2600`)

**Pattern extraction date:** 2026-08-17

⚠ **Line numbers rot faster than the patterns do.** Three of RESEARCH.md's own inherited line refs
were already stale when it re-measured them (`publish_service.py:882/894` → `:1136/:1148`). Re-open
each file at plan time; the *idiom* is the durable part, the number is not.
