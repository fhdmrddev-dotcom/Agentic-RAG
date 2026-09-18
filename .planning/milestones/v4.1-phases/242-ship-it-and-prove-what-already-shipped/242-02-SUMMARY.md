# 242-02 — SUMMARY

**Executed 2026-09-11** · **Commit:** `46292bb81` · **Requirement:** SHIP-01 · **ROADMAP SC#1, SC#2.**
⚠ **Solo run.** No independent reviewer exists. The mechanical evidence below — two planted defects
driven RED, an md5-identical restore, a set diff, a re-derived triple — stands on its own; the
judgement calls are flagged.

---

## What shipped

### 1. The Search tab sends CHANGED FIELDS ONLY (D-242-02)

`frontend/src/pages/SettingsPage.tsx`, four additions and one changed line:

- `searchPayloadFrom(data)` — **exported** — the 24-key payload as `hydrate` leaves it, using
  `hydrate`'s expressions verbatim, with both API keys as `KEY_PLACEHOLDER`.
- `onlyChanged(next, baseline)` — **exported** — keeps keys where `!Object.is(value, baseline[key])`,
  iterating `Object.keys(next)`.
- `searchBaseline` state, set inside `hydrate` — which runs on load AND after every successful save,
  so the baseline re-arms for free and a second save of the same edit correctly sends `{}`.
- `handleSaveSearch`: the 24-key literal is unchanged and renamed `full`;
  `const body = searchBaseline ? onlyChanged(full, searchBaseline) : full`.

⚠ **`null` baseline sends EVERYTHING.** "We never loaded settings" must never collapse into
"nothing changed".

**Rejected, and it is the decision that makes this worth doing:** *report every failing field at
once*. That makes the failure LEGIBLE and leaves it POSSIBLE — you can still be blocked by a value
you never typed. And `hnsw_ef_search` rides this payload (Phase 241 D-09), so under the old shape
**Phase 246's remedy was hostage to any unrelated stored value drifting out of range.**

### 2. The refusal names the STORED value (D-242-03)

`backend/app/api/settings.py`: one module-level `_range_refusal_detail(...)`, and all **four**
numeric bound sites route their `detail=` through it. When the refused value equals the one already
stored:

> `'Images read per document' was already set to 1001, which is outside the allowed range of 1–1000.
> That is what is blocking this save — nothing you just changed is at fault. Set it to a value
> between 1 and 1000 to save this tab.`

Otherwise it returns today's sentence **byte for byte** — and today's sentence is the right one when
the operator genuinely typed a bad number, because it carries what the bound BUYS (SEED-226 /
SEED-227 / SEED-258 / the Phase 241 cost paragraph). ⛔ **Not one of those comment blocks was
deleted or reworded**, and a fence asserts all three markers still appear in the module.

⛔ **The lookup can never turn a 400 into a 500.** It is wrapped, and §4 drives it with a
monkeypatch that raises, plus a settings object with no attributes at all. Both return the typed
sentence.

---

## The RED drives — and the second one is the finding

### Frontend, two planted defects, `SettingsPage.tsx` restored **md5-identical**

| plant | what it simulates | failing set |
|---|---|---|
| **A** — `const body = full` | the pre-242 unconditional payload | **6 failed / 11 passed** — §1 both fixtures, §2, §2b, §3, §4 |
| **B** — `hnsw_ef_search: 40` (a constant, not `data.hnsw_ef_search ?? 40`) | a hard-coded baseline | **3 failed / 14 passed** — the `searchPayloadFrom` unit case, §1 **FIXTURE B only**, and §2b |

⭐⭐ **PLANT B IS THE WHOLE POINT, AND §1 FIXTURE A STAYED GREEN UNDER IT.** That is the
plan-checker's B-3 finding, reproduced as a measurement rather than accepted as an argument: with
only the all-NULL fixture, a baseline of hard-coded constants is indistinguishable from a
data-derived one — because the constants ARE what `hydrate`'s `??` fallbacks produce. In production,
where the column holds 200, an operator dragging **200 → 40** would have `Object.is(40, 40)`, the
key dropped, the save reporting success, and the database still holding 200. **Phase 240's "screen
that discards its own answer", on the exact knob Phase 246's remedy is delivered on.**

⛔ **Binding consequence, recorded in the ledger section too: never reduce §1 to one fixture.**

`md5sum -c` after restoring: `frontend/src/pages/SettingsPage.tsx: OK`. Suite back to 17/17.

### Backend, RED before the helper existed

```
10 failed, 2 passed
```

The two that passed are the two that characterise EXISTING behaviour — the SEED-comment-survival
guard and `save_app_settings({}) is True`. Every case about the helper failed, starting with
`test_there_is_one_shared_refusal_seam`. After the fix: **29 passed** across both 242 backend
suites.

---

## Two defects found that this phase did not cause

### ⛔ `SettingsPage.a11y.test.tsx` was RED — all four cases — and gated by nothing

`grep -n "SettingsPage" scripts/vitest-count-gate.cjs` returned exactly **two** hits before this
commit, while `src/pages/__tests__/` held two more SettingsPage suites. `src/pages` is not a
directory entry, so a file-level list was the only thing that could reach them, and nobody had added
them. **One had been failing, invisibly.**

**Proven inherited before anything was touched:** with Phase 242's `SettingsPage.tsx` stashed away,
all four still failed at the base commit.

**The cause was in the SUITE, not the page.** Its `renderSettings` lacked
`EffectiveFeaturesProvider`, and `SettingsPage` renders the AI Model / Search / Integrations tabs
only when `model_management` resolves true — a null context is fail-closed by contract. So every
case audited a page whose tab never mounted, and all four failed on
`Unable to find role="button" and name /technical names/i` — **an ABSENCE, never a defect in the
control they were written to audit.** `SettingsPage.test.tsx`'s own helper already carried the
provider and says so in a comment: *"THE PROVIDER IS NOT DECORATION — IT IS THE PRECONDITION FOR THE
TAB UNDER TEST."* The sibling simply never got it.

⚖ **Repairing it is a declared deviation** — it is a four-line test-file fix, not Phase 242's scope.
It was taken because the alternative was to adopt a red suite into the shared gate, and CLAUDE.md's
own Phase 235 decision forbids exactly that: *"pinning a red suite turns the shared gate red, and
pinning it with an allowance makes a gate that cannot fail."* Leaving it unadopted would have left
the finding as a note, which is the failure mode this project keeps paying for.

### ⛔⛔ `check-hot-file-ledger.cjs` PASSED VACUOUSLY over a plan it could not read

Found by accident and driven both ways. A `PLAN.md` rewritten with CRLF line endings makes
`/^---\n([\s\S]*?)\n---/` fail to match, `fm` come back `null`, and the **entire plan** be skipped
by a silent `continue`. The gate then printed:

```
scan list: 252 rows · subject: 0 files · watched: 0
ledger gate OK — every watched file has a row.
```

**Exit 0, over a phase it parsed nothing of.** ⛔ A gate that passes because it read nothing is
worse than no gate: it answers the auditor with *"clear"* and stops the audit — which is this
ledger's own recurring finding, arriving from a new direction. On Windows it is one careless file
write away.

**Fixed** by normalising `\r\n` at read, with the measurement written into the comment. Driven both
ways: CRLF → `subject: 13 files · watched: 2`; LF → the same.

---

## Gates

| gate | result |
|---|---|
| backend unit | `71 failed, 4546 passed, 2 xfailed, 2 xpassed`. **Failing SET diffed against `242-backend-base-set.txt` — `NEW: []`, `GONE: []`.** ⛔ 71 is the ceiling; it was not moved. Passed 4517 → 4546. |
| count gate | `total 8077 · failed 0 · pinned total 7307` · **`count gate OK — 259/259`**, no per-file decrease. Base was `8046 / 7276 / 256`. |
| typecheck | `npx tsc -p tsconfig.app.json --noEmit` → **67 errors, set diff against base EMPTY BOTH WAYS** (compared line-number-agnostically, since the insertions shifted two pre-existing errors). ⛔ Never `npx tsc --noEmit`: `tsconfig.json` is solution-style and checks zero files. |
| `check-claude-md-size.cjs` | exit 0 — `91,301 chars · 60.9% of limit · headroom 58,699`. |
| `check-hot-file-ledger.cjs 242` | exit 0 — `subject: 13 files · watched: 2`, both rows present. |

### The count-gate arithmetic, with every increment attributed — no residual

```
base                                    8046   (pinned 7276, 256 files)
  SettingsPage.test.tsx        23 → 24    +1   (one 241 case became two)
  SettingsPage.a11y.test.tsx    — →  4    +4   (ADOPTED — was red, repaired)
  SettingsPage.sourceCeiling    — →  9    +9   (ADOPTED — was green, ungated)
  SettingsPage.changedFields    — → 17   +17   (new, this plan)
                                       -----
final                                   8077   (pinned 7307, 259 files)   = +31
```

⭐ **Adoption raises the total. That is the desirable direction and is not drift.**

---

## Ledger — re-derived, with the raw output (W-10)

```
$ git log --oneline -- <f> | wc -l ; …phases… ; wc -l <f>
backend/app/api/settings.py       : 37 / 20 / 933
frontend/src/pages/SettingsPage.tsx : 46 / 24 / 1858
```

Both rows read stale for the **third consecutive close** (`35/19/814` and `44/23/1738`). Row and
section updated in the SAME commit; the sections carry seven new binding invariants between them,
including the never-reduce-§1-to-one-fixture rule and the `Object.is` correction.

⚠ **`backend/app/models/user_settings.py` was NOT modified by this plan**, so its row is untouched —
stated rather than left ambiguous. It reads `50 / 32 / 1561`, which is current.

---

## Deviations, each with its reason

| # | Deviation | Reason |
|---|---|---|
| 1 | `frontend/src/pages/SettingsPage.test.tsx` added to `files_modified` and edited | Plan-checker **B-2**: its Phase-241 case pinned `hnsw_ef_search: 40` on a save that edited only its sibling — exactly what D-242-02 makes false. The assertion was **not deleted** (that would erase 241 D-09's guarantee silently); it became two cases with the original quoted in a comment. |
| 2 | `searchPayloadFrom` / `onlyChanged` **exported** and unit-tested | Plan-checker **B-3c / W-8**: §7 as planned was undrivable (a rejecting `getSettings` leaves `s === null` and the page renders a full-page error branch with no Save button), and direct unit drives are stronger than the DOM for properties about the functions. |
| 3 | §1 runs **two** fixtures; §2b added | Plan-checker **B-3a/b**. Proven necessary by plant B. |
| 4 | The `Object.is` source comment states a **different** reason than the plan gave | Plan-checker **W-7**: the plan's rationale was factually wrong (`Object.is(NaN, 100)` is `false`; the baseline is never `NaN`). The real difference from `===` is `+0`/`-0`. Shipping a wrong reason in a comment is how prose rots. |
| 5 | One `settings.py` comment corrected **beside** its original | Plan-checker **W-6**: *"the frontend sends both keys UNCONDITIONALLY"* became false. Struck, not deleted, with the note that the stored-comparison is belt-and-braces for the UI path and **still load-bearing for every other client**. |
| 6 | `SettingsPage.a11y.test.tsx` repaired | See above — the alternative was adopting a red suite. |
| 7 | `scripts/check-hot-file-ledger.cjs` CRLF fix | A gate exiting 0 over 0 parsed files. |
| 8 | A `fieldInput(label)` test helper | `FieldRow` associates no control with its label, so `getByLabelText` throws for every Search field except two. Recorded as a real a11y gap in the ledger section rather than worked around silently. |

## Owed

- ⛔ **SC#1's operator UAT row** — G-4. Automated cases assert the wire payload; a person still has
  to open the tab. `242-VALIDATION.md` carries the row, written to say *read the network response,
  not the banner*.
- `FieldRow`'s missing label association (item 8) — a real accessibility gap, unfixed, named.
