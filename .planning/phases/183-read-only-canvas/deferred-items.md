# Phase 183 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY rule: issues found during execution that are
NOT caused by this phase's changes. Recorded, not fixed.

---

## D-ITEM-183-01 — `npx tsc -b` is RED on `develop` at baseline (33 pre-existing errors)

**Found during:** plan 183-01, Task 1 (the A4 toolchain gate).

**What:** `cd frontend && npx tsc -b` exits **2** with **33 distinct error signatures**
across ~20 files. `npm run build` is `tsc -b && vite build`, so the scripted frontend
build is red on `develop` today, before Phase 183 touched anything.

**Proof it is pre-existing, not caused by `@xyflow/react`:**

1. `git diff --stat frontend/package.json frontend/package-lock.json` → **178 insertions,
   0 deletions**. The lockfile change is purely additive; no existing dependency version
   was re-resolved.
2. `grep -c xyflow` over the full `tsc -b` output → **0**. Not one error mentions the new
   package.
3. `npm ls zustand` → `@xyflow/react@12.11.2 → zustand@4.5.7` (nested) alongside top-level
   `zustand@5.0.13` (unchanged). The one zustand-flavoured error
   (`src/stores/streamsStore.ts:295`) resolves against the untouched top-level v5.
4. `git status --porcelain -- frontend/` shows only `package.json` + `package-lock.json`
   modified — every erroring source file is byte-identical to HEAD.

**Representative sample** (full list captured at execution time):

| File | Error |
|---|---|
| `src/stores/streamsStore.ts(295,55)` | TS2345 — `StateCreator` / `subscribeWithSelector` mismatch |
| `src/pages/SettingsPage.tsx(776,9)` | TS2561 — `web_search_enabled` not in `SettingsUpdate` |
| `src/pages/SettingsPage.tsx(1054,60)` | TS2322 — stray `tooltip` prop |
| `src/components/skills/SkillFormDialog.tsx(396,13)` | TS2322 — `RefObject<T \| null>` vs `RefObject<T>` |
| `src/components/chat/MessageSkeleton.tsx(14,36)` | TS2503 — cannot find namespace `JSX` |
| `src/components/settings/MemorySection.tsx(52,8)` | TS2339 — `.finally` on `PromiseLike<void>` |
| `src/providers/StreamsProvider.tsx(74,3)` | TS6133 — unused `getActiveRuns` |
| + ~12 test-file signatures (`*.test.tsx` prop/type drift) | TS2322 / TS6133 / TS2304 / TS2554 |

Roughly two thirds are in `*.test.*` files (prop-shape drift of the same family as the
recorded vitest rot, SEED-056); the rest are genuine `src/` type errors.

**Disposition:** NOT fixed in Phase 183. Fixing 33 unrelated errors across ~20 shipped
files inside a canvas-projection phase is exactly the scope violation the boundary rule
forbids, and it would destroy the failing-name differential this phase grades on.

**Consequence for Phase 183's gates:** every plan in this phase that lists
`npx tsc -b exits 0` as an acceptance criterion must be read as a **differential**:
*no NEW error signature versus the recorded 33-signature baseline, and no new error
mentioning a Phase-183 file or `@xyflow`.* That is the honest, achievable form of the
gate. `npx vite build` genuinely exits **0** and stays a hard gate (Vite/rolldown does
not typecheck, which is why the build ships despite the red `tsc`).

**Re-open trigger:** a dedicated `tsc`-cleanup phase (natural sibling of SEED-056
"frontend vitest rot"), or the moment any Phase-183 file appears in the error list.

---

## D-ITEM-183-02 — the `dangerouslySetInnerHTML` grep gate is unsatisfiable as written

**Found during:** plan 183-06, Task 1.

**What:** Several plans in this phase carry an acceptance criterion of the form
`grep -c "dangerouslySetInnerHTML" <file>` **returns 0**, while the SAME task requires the
file's docblock to carry the house T-124-01 XSS clause **verbatim** — and that clause
contains the identifier:

```
 * XSS (T-124-01): every authored string (phase names) is rendered as a plain React
 * text child / `title=` attribute value — never `dangerouslySetInnerHTML`.
```

The two criteria contradict each other. The phase-level `<verification>` form,
`grep -rn "dangerouslySetInnerHTML" frontend/src/components/workflows` → 0 hits, has
**never** been satisfiable: three shipped files already carry the same clause in prose —
`PhaseSpine.tsx:14` (Phase 124), `WorkflowSoul.tsx:24` (Phase 124),
`WorkflowDoorSwitch.tsx:30`.

**Disposition:** NOT "fixed" by deleting the clause — the clause is the house convention
and is required by the plan. The gate is executed in its **call form** instead, which is
what it was always meant to mean:

```bash
grep -rEn "dangerouslySetInnerHTML\s*=" frontend/src/components/workflows   # → 0
```

That returns **0** across the whole directory including the two files plan 183-06 added.

**Why it keeps happening:** this is the fourth instance in Phase 183 of a grep guard
binding a *prefix or a comment* rather than the real call — 183-02 hit it with
`grounding_mode`, 183-04 with `PHASE_GLYPHS`, 183-05 with the migrations path, 183-06 with
this. A guard binds its own file's prose too.

**Re-open trigger:** any future plan copying the bare-identifier form of this criterion.
Planners should write the anchored form (`identifier\s*=` for a JSX prop, `identifier\(`
for a call) from the start.

---
